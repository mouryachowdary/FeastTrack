BEGIN;

CREATE TABLE IF NOT EXISTS public.employee_activity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  login_at timestamptz NOT NULL DEFAULT now(),
  logout_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT employee_activity_user_id_fkey
    FOREIGN KEY (user_id)
    REFERENCES auth.users (id)
    ON DELETE RESTRICT,
  CONSTRAINT employee_activity_logout_after_login_check
    CHECK (logout_at IS NULL OR logout_at >= login_at)
);

DO $$
DECLARE
  activity_table oid := 'public.employee_activity'::regclass;
  activity_user_id smallint;
  existing_foreign_key record;
  has_restrict_foreign_key boolean := false;
BEGIN
  SELECT attnum
  INTO activity_user_id
  FROM pg_attribute
  WHERE attrelid = activity_table
    AND attname = 'user_id'
    AND NOT attisdropped;

  IF activity_user_id IS NULL THEN
    RAISE EXCEPTION 'Expected public.employee_activity.user_id was not found';
  END IF;

  FOR existing_foreign_key IN
    SELECT conname, confdeltype
    FROM pg_constraint
    WHERE conrelid = activity_table
      AND contype = 'f'
      AND confrelid = 'auth.users'::regclass
      AND conkey = ARRAY[activity_user_id]
  LOOP
    IF existing_foreign_key.confdeltype = 'r' THEN
      has_restrict_foreign_key := true;
    ELSE
      EXECUTE format(
        'ALTER TABLE public.employee_activity DROP CONSTRAINT %I',
        existing_foreign_key.conname
      );
    END IF;
  END LOOP;

  IF NOT has_restrict_foreign_key THEN
    ALTER TABLE public.employee_activity
      ADD CONSTRAINT employee_activity_user_id_fkey
      FOREIGN KEY (user_id)
      REFERENCES auth.users (id)
      ON DELETE RESTRICT;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = activity_table
      AND contype = 'c'
      AND conname = 'employee_activity_logout_after_login_check'
  ) THEN
    ALTER TABLE public.employee_activity
      ADD CONSTRAINT employee_activity_logout_after_login_check
      CHECK (logout_at IS NULL OR logout_at >= login_at);
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS employee_activity_user_id_idx
  ON public.employee_activity (user_id);

CREATE INDEX IF NOT EXISTS employee_activity_login_at_idx
  ON public.employee_activity (login_at DESC);

ALTER TABLE public.employee_activity ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.employee_activity FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.employee_activity TO authenticated;
GRANT ALL ON TABLE public.employee_activity TO service_role;

DO $$
DECLARE
  activity_table oid := 'public.employee_activity'::regclass;
  existing_policy pg_policy%ROWTYPE;
  policy_expression text;
BEGIN
  SELECT *
  INTO existing_policy
  FROM pg_policy
  WHERE polrelid = activity_table
    AND polname = 'Admins can view employee activity';

  IF FOUND THEN
    policy_expression := regexp_replace(
      pg_get_expr(existing_policy.polqual, existing_policy.polrelid),
      '[[:space:]]+',
      '',
      'g'
    );

    IF existing_policy.polcmd <> 'r'
      OR existing_policy.polroles <> ARRAY['authenticated'::regrole::oid]
      OR NOT existing_policy.polpermissive
      OR existing_policy.polwithcheck IS NOT NULL
      OR policy_expression IS NULL
      OR policy_expression NOT IN ('public.is_admin()', 'is_admin()')
    THEN
      RAISE EXCEPTION
        'The existing "Admins can view employee activity" policy conflicts with the expected authenticated/public.is_admin() policy';
    END IF;
  ELSE
    EXECUTE 'CREATE POLICY "Admins can view employee activity"
      ON public.employee_activity
      FOR SELECT
      TO authenticated
      USING (public.is_admin())';
  END IF;
END
$$;

CREATE OR REPLACE FUNCTION public.record_employee_logout(
  p_activity_id uuid,
  p_user_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $function$
BEGIN
  UPDATE public.employee_activity
  SET logout_at = pg_catalog.now()
  WHERE id = p_activity_id
    AND user_id = p_user_id
    AND logout_at IS NULL;

  RETURN FOUND;
END;
$function$;

REVOKE ALL ON FUNCTION public.record_employee_logout(uuid, uuid)
  FROM PUBLIC, anon, authenticated;

DO $$
DECLARE
  function_oid oid := 'public.record_employee_logout(uuid, uuid)'::regprocedure;
  service_role_oid oid := 'service_role'::regrole;
  existing_grant record;
BEGIN
  FOR existing_grant IN
    SELECT DISTINCT acl.grantee, pg_get_userbyid(acl.grantee) AS role_name
    FROM pg_proc AS p
    CROSS JOIN LATERAL aclexplode(
      COALESCE(p.proacl, acldefault('f', p.proowner))
    ) AS acl
    WHERE p.oid = function_oid
      AND acl.privilege_type = 'EXECUTE'
      AND acl.grantee <> p.proowner
      AND acl.grantee <> service_role_oid
      AND acl.grantee <> 0
  LOOP
    EXECUTE format(
      'REVOKE ALL ON FUNCTION public.record_employee_logout(uuid, uuid) FROM %I',
      existing_grant.role_name
    );
  END LOOP;

END
$$;

REVOKE ALL ON FUNCTION public.record_employee_logout(uuid, uuid)
  FROM service_role;
GRANT EXECUTE ON FUNCTION public.record_employee_logout(uuid, uuid)
  TO service_role;

DO $$
DECLARE
  function_oid oid := 'public.record_employee_logout(uuid, uuid)'::regprocedure;
  service_role_oid oid := 'service_role'::regrole;
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_proc AS p
    CROSS JOIN LATERAL aclexplode(
      COALESCE(p.proacl, acldefault('f', p.proowner))
    ) AS acl
    WHERE p.oid = function_oid
      AND acl.privilege_type = 'EXECUTE'
      AND acl.grantee <> p.proowner
      AND acl.grantee <> service_role_oid
  ) THEN
    RAISE EXCEPTION
      'Could not restrict record_employee_logout execution to service_role and its owner';
  END IF;
END
$$;

COMMIT;
