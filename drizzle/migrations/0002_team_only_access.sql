CREATE TABLE public.team_members (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.team_invites (
  email text PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.team_members TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.team_invites TO authenticated;
GRANT ALL ON public.team_members, public.team_invites TO service_role;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_invites ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_team_member(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.team_members WHERE user_id = _uid)
$$;

CREATE OR REPLACE FUNCTION public.join_team_if_allowed()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.team_members)
     OR EXISTS (SELECT 1 FROM public.team_invites WHERE lower(email) = lower(NEW.email)) THEN
    INSERT INTO public.team_members (user_id, email) VALUES (NEW.id, coalesce(NEW.email, ''))
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER on_auth_user_join_team AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.join_team_if_allowed();

CREATE POLICY "members see team" ON public.team_members FOR SELECT TO authenticated USING (public.is_team_member(auth.uid()));
CREATE POLICY "members manage invites" ON public.team_invites FOR ALL TO authenticated
  USING (public.is_team_member(auth.uid())) WITH CHECK (public.is_team_member(auth.uid()));

DROP POLICY "team access weeks" ON public.weeks;
DROP POLICY "team access orders" ON public.orders;
REVOKE ALL ON public.weeks, public.orders FROM anon;
CREATE POLICY "team members weeks" ON public.weeks FOR ALL TO authenticated
  USING (public.is_team_member(auth.uid())) WITH CHECK (public.is_team_member(auth.uid()));
CREATE POLICY "team members orders" ON public.orders FOR ALL TO authenticated
  USING (public.is_team_member(auth.uid())) WITH CHECK (public.is_team_member(auth.uid()));

ALTER TABLE public.orders ADD CONSTRAINT orders_amount_range CHECK (amount_paid >= 0 AND amount_paid <= 5000) NOT VALID;
ALTER TABLE public.weeks ADD CONSTRAINT weeks_bill_range CHECK (bill_total >= 0 AND bill_total <= 100000) NOT VALID;