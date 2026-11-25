import { createFileRoute } from "@tanstack/react-router";
import type React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader } from "@/components/site-header";
import { feastKey, loadFeast } from "@/components/feast-data";
import { BIRYANI_CATEGORIES, CREW, ITEMS, REFUND_PER_PERSON, expectedRefundDate, fmtDate, officeDue, personRefund, rs } from "@/lib/feast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_authenticated/")({
  head: () => ({
    meta: [
      { title: "FeastTrack — This week's order" },
      { name: "description", content: "Add and edit this Thursday's biryani order and track the ₹160 office refund." },
      { property: "og:title", content: "FeastTrack — This week's order" },
      { property: "og:description", content: "Who's eating what this Thursday, and what's coming back from the office." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Index,
});

function nextThursday() {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + ((4 - d.getUTCDay() + 7) % 7));
  return d.toISOString().slice(0, 10);
}

function Index() {
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery({ queryKey: feastKey, queryFn: loadFeast });
  const [weekId, setWeekId] = useState<string>("");
  const refresh = () => qc.invalidateQueries({ queryKey: feastKey });

  useEffect(() => {
    if (data && !data.weeks.find((w) => w.id === weekId) && data.weeks[0]) setWeekId(data.weeks[0].id);
  }, [data, weekId]);

  const [form, setForm] = useState({ person: CREW[0]!, item: ITEMS[0]!.value, amount: "200" });
  const [newDate, setNewDate] = useState(nextThursday());

  if (isLoading) return <Shell><p className="text-muted-foreground">Loading…</p></Shell>;
  if (error || !data) return <Shell><p className="text-destructive">Couldn't load orders. Try refreshing.</p></Shell>;

  const week = data.weeks.find((w) => w.id === weekId);
  const orders = data.orders.filter((o) => o.week_id === weekId);
  const paidTotal = orders.reduce((s, o) => s + Number(o.amount_paid), 0);
  const due = officeDue(orders);

  async function run(p: PromiseLike<{ error: unknown }>, ok?: string) {
    const { error } = await p;
    if (error) toast.error("Couldn't save. Try again.");
    else { if (ok) toast.success(ok); refresh(); }
  }

  return (
    <Shell>
      <section className="flex flex-wrap items-end gap-3">
        <label className="text-sm">
          <span className="mb-1 block font-mono text-xs uppercase text-muted-foreground">Thursday</span>
          <select className="h-9 rounded-md border border-input bg-card px-3" value={weekId} onChange={(e) => setWeekId(e.target.value)}>
            {data.weeks.map((w) => <option key={w.id} value={w.id}>{fmtDate(w.order_date)}</option>)}
          </select>
        </label>
        <div className="ml-auto flex items-end gap-2">
          <Input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} className="w-auto bg-card" />
          <Button onClick={async () => {
            const { data: w, error } = await supabase.from("weeks").insert({ order_date: newDate }).select().single();
            if (error) return toast.error("That date already exists or couldn't be added.");
            toast.success("New Thursday added"); setWeekId(w.id); refresh(); return undefined;
          }}>+ New Thursday</Button>
        </div>
      </section>

      {week && (
        <>
          <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="People" value={String(orders.length)} />
            <Stat label="Paid by everyone" value={rs(paidTotal)} />
            <Stat label={`Office refund (${rs(REFUND_PER_PERSON)}/person)`} value={rs(due)} />
            <Stat label={week.refund_received ? "Refund received" : "Refund expected by"} value={fmtDate(week.refund_received_on ?? expectedRefundDate(week.order_date))} accent={!week.refund_received} />
          </section>

          <section className="mt-6 flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card p-4">
            <label className="text-sm"><span className="mb-1 block font-mono text-xs uppercase text-muted-foreground">Vendor</span>
              <Input key={week.id + "v"} defaultValue={week.vendor} placeholder="Restaurant name" className="w-44" onBlur={(e) => e.target.value !== week.vendor && run(supabase.from("weeks").update({ vendor: e.target.value }).eq("id", week.id))} /></label>
            <label className="text-sm"><span className="mb-1 block font-mono text-xs uppercase text-muted-foreground">Total bill</span>
              <Input key={week.id + "b"} type="number" defaultValue={week.bill_total} className="w-32" onBlur={(e) => run(supabase.from("weeks").update({ bill_total: Number(e.target.value) }).eq("id", week.id))} /></label>
            <label className="text-sm"><span className="mb-1 block font-mono text-xs uppercase text-muted-foreground">Paid upfront by</span>
              <Input key={week.id + "p"} defaultValue={week.paid_by} className="w-40" onBlur={(e) => run(supabase.from("weeks").update({ paid_by: e.target.value }).eq("id", week.id))} /></label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={week.refund_received} onChange={(e) => run(supabase.from("weeks").update({ refund_received: e.target.checked, refund_received_on: e.target.checked ? new Date().toISOString().slice(0, 10) : null }).eq("id", week.id), e.target.checked ? "Marked refund as received" : undefined)} className="size-4 accent-[var(--primary)]" />
              Office refund received
            </label>
            {week.bill_total > 0 && <p className="ml-auto text-sm text-muted-foreground">Bill vs collected: <b className="text-foreground">{rs(paidTotal - Number(week.bill_total))}</b></p>}
          </section>

          <section className="mt-6 rounded-xl border border-border bg-card p-4">
            <h3 className="font-mono text-xs uppercase text-muted-foreground">This week's prices{week.vendor ? ` · ${week.vendor}` : ""}</h3>
            <div className="mt-2 flex flex-wrap gap-3">
              {BIRYANI_CATEGORIES.map((category) => (
                <div key={category.label} className="w-full">
                  <h4 className="mb-2 font-mono text-xs uppercase text-muted-foreground">{category.label}</h4>
                  <div className="flex flex-wrap gap-3">
                    {category.items.map((item) => (
                      <label key={week.id + item.value} className="text-sm"><span className="mb-1 block">{item.label}</span>
                        <Input type="number" min={0} placeholder="₹" defaultValue={week.prices?.[item.value] ?? ""} className="w-36" onBlur={(e) => {
                          const v = e.target.value === "" ? undefined : Number(e.target.value);
                          if (v === week.prices?.[item.value]) return;
                          const prices = { ...(week.prices ?? {}) }; if (v === undefined) delete prices[item.value]; else prices[item.value] = v;
                          run(supabase.from("weeks").update({ prices }).eq("id", week.id));
                        }} /></label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="mt-6 rounded-xl border border-border bg-card">
            <form className="flex flex-wrap items-end gap-3 border-b border-border p-4" onSubmit={(e) => {
              e.preventDefault();
              run(supabase.from("orders").insert({ week_id: week.id, person: form.person.trim(), item: form.item, amount_paid: Number(form.amount) || 0 }), "Order added");
            }}>
              <label className="text-sm"><span className="mb-1 block font-mono text-xs uppercase text-muted-foreground">Person</span>
                <select className="h-9 rounded-md border border-input bg-card px-3" value={form.person} onChange={(e) => setForm({ ...form, person: e.target.value })}>
                  {CREW.map((c) => <option key={c} value={c}>{c}</option>)}
                </select></label>
              <label className="text-sm"><span className="mb-1 block font-mono text-xs uppercase text-muted-foreground">Biryani</span>
                <select className="h-9 rounded-md border border-input bg-card px-3" value={form.item} onChange={(e) => { const item = e.target.value; const pr = week.prices?.[item]; setForm({ ...form, item, amount: pr != null ? String(pr) : form.amount }); }}>
                  {BIRYANI_CATEGORIES.map((category) => (
                    <optgroup key={category.label} label={category.label}>
                      {category.items.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                    </optgroup>
                  ))}
                </select></label>
              <label className="text-sm"><span className="mb-1 block font-mono text-xs uppercase text-muted-foreground">Paid (₹)</span>
                <Input type="number" min={0} value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className="w-28" /></label>
              <Button type="submit">Add order</Button>
            </form>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted font-mono text-xs uppercase text-muted-foreground">
                  <tr>{["Person", "Biryani", "Paid", "Refund", "Own cost", ""].map((h) => <th key={h} className="px-4 py-3 text-left">{h}</th>)}</tr>
                </thead>
                <tbody>
                  {orders.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">No orders yet for this Thursday.</td></tr>}
                  {orders.map((o) => {
                    const menuItem = ITEMS.find((item) => item.value === o.item);
                    return (
                      <tr key={o.id} className="border-t border-border">
                        <td className="px-4 py-2 font-medium">{o.person}</td>
                        <td className="px-4 py-2">
                          <span className="mr-2">{menuItem?.label ?? o.item}</span>
                          {menuItem && <span className="text-xs text-muted-foreground">({menuItem.category})</span>}
                          <select aria-label={`Change biryani for ${o.person}`} className="ml-2 rounded-md border border-input bg-card px-2 py-1" defaultValue={o.item} onChange={(e) => { const pr = week.prices?.[e.target.value]; run(supabase.from("orders").update(pr != null ? { item: e.target.value, amount_paid: pr } : { item: e.target.value }).eq("id", o.id)); }}>
                            {!ITEMS.some((item) => item.value === o.item) && <option value={o.item}>{o.item} (legacy)</option>}
                            {BIRYANI_CATEGORIES.map((category) => (
                              <optgroup key={category.label} label={category.label}>
                                {category.items.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                              </optgroup>
                            ))}
                          </select></td>
                        <td className="px-4 py-2"><Input key={o.id + o.amount_paid} type="number" defaultValue={o.amount_paid} className="h-8 w-24" onBlur={(e) => Number(e.target.value) !== Number(o.amount_paid) && run(supabase.from("orders").update({ amount_paid: Number(e.target.value) }).eq("id", o.id))} /></td>
                        <td className="px-4 py-2 text-primary">{rs(personRefund(Number(o.amount_paid)))}</td>
                        <td className="px-4 py-2">{rs(Number(o.amount_paid) - personRefund(Number(o.amount_paid)))}</td>
                        <td className="px-4 py-2 text-right"><Button variant="ghost" size="icon" aria-label={`Remove ${o.person}`} onClick={() => run(supabase.from("orders").delete().eq("id", o.id), "Removed")}><Trash2 /></Button></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
          <p className="mt-4 text-sm text-muted-foreground">Everyone pays the full amount upfront. The office refunds only {rs(REFUND_PER_PERSON)} per person, paid every two weeks — it arrives in the 3rd week after the order.</p>
        </>
      )}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return <main className="min-h-screen bg-background text-foreground"><SiteHeader /><div className="mx-auto max-w-6xl px-6 py-8">{children}</div></main>;
}
function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return <div className="rounded-xl border border-border bg-card p-4"><div className={`font-display text-4xl ${accent ? "text-primary" : ""}`}>{value}</div><div className="font-mono text-xs uppercase text-muted-foreground">{label}</div></div>;
}
