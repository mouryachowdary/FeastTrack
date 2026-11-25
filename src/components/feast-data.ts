import { supabase } from "@/integrations/supabase/client";
export type Week = { id: string; order_date: string; bill_total: number; paid_by: string; refund_received: boolean; refund_received_on: string | null; vendor: string; prices: Record<string, number> };
export type OrderRow = { id: string; week_id: string; person: string; item: string; amount_paid: number };
export const feastKey = ["feast"] as const;
export async function loadFeast() {
  const [w, o] = await Promise.all([
    supabase.from("weeks").select("*").order("order_date", { ascending: false }),
    supabase.from("orders").select("*").order("created_at"),
  ]);
  if (w.error) throw w.error;
  if (o.error) throw o.error;
  return { weeks: w.data as Week[], orders: o.data as OrderRow[] };
}
