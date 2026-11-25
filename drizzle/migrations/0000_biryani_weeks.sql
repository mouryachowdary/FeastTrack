CREATE TABLE public.weeks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_date date NOT NULL UNIQUE,
  bill_total numeric NOT NULL DEFAULT 0,
  paid_by text NOT NULL DEFAULT '',
  refund_received boolean NOT NULL DEFAULT false,
  refund_received_on date,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  week_id uuid NOT NULL REFERENCES public.weeks(id) ON DELETE CASCADE,
  person text NOT NULL,
  item text NOT NULL,
  amount_paid numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.weeks, public.orders TO anon, authenticated;
GRANT ALL ON public.weeks, public.orders TO service_role;
ALTER TABLE public.weeks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "team access weeks" ON public.weeks FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "team access orders" ON public.orders FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

INSERT INTO public.weeks (order_date, bill_total, paid_by, refund_received, refund_received_on) VALUES
 ('2026-11-12', 2000, 'Mohan', false, NULL),
 ('2026-11-26', 0, '', false, NULL);
INSERT INTO public.orders (week_id, person, item, amount_paid)
SELECT w.id, v.person, v.item, v.amt FROM public.weeks w,
 (VALUES ('Mohan','Kalmi',200),('Mourya','Kalmi',200),('Sujith','Mughalai',200),('Mahesh','Chicken Dum',200),
  ('Praveen','Chicken Dum',200),('Siva','Chicken Dum',200),('Bharath','ChickenFry Piece',200),('Govind','ChickenFry Piece',200),
  ('Eswar','Veg Item',200),('Naveen','Chicken Dum',200)) AS v(person,item,amt)
WHERE w.order_date = '2026-11-12';