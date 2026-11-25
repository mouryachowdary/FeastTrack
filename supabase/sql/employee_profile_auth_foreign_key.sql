BEGIN;

DO $$
DECLARE
  profile_table oid := 'public."User Authentication"'::regclass;
  profile_id smallint;
  orphan_count bigint;
BEGIN
  SELECT attnum
  INTO profile_id
  FROM pg_attribute
  WHERE attrelid = profile_table
    AND attname = 'id'
    AND NOT attisdropped;

  IF profile_id IS NULL THEN
    RAISE EXCEPTION 'Expected public."User Authentication".id was not found';
  END IF;

  SELECT count(*)
  INTO orphan_count
  FROM public."User Authentication" AS profile
  LEFT JOIN auth.users AS auth_user ON auth_user.id = profile.id
  WHERE auth_user.id IS NULL;

  IF orphan_count > 0 THEN
    RAISE EXCEPTION
      'Foreign key not added: found % profile(s) without a matching auth.users row',
      orphan_count;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = profile_table
      AND contype = 'f'
      AND confrelid = 'auth.users'::regclass
      AND conkey = ARRAY[profile_id]
  ) THEN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conrelid = profile_table
        AND contype = 'f'
        AND confrelid = 'auth.users'::regclass
        AND conkey = ARRAY[profile_id]
        AND confdeltype = 'c'
    ) THEN
      RAISE EXCEPTION
        'An auth.users foreign key already exists without ON DELETE CASCADE; inspect it manually';
    END IF;
  ELSE
    ALTER TABLE public."User Authentication"
      ADD CONSTRAINT user_authentication_id_auth_users_fkey
      FOREIGN KEY (id)
      REFERENCES auth.users (id)
      ON DELETE CASCADE;
  END IF;
END
$$;

COMMIT;
