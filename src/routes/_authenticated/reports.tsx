import { createFileRoute } from "@tanstack/react-router";
import type React from "react";
import { useQuery } from "@tanstack/react-query";
import { SiteHeader } from "@/components/site-header";
import { feastKey, loadFeast } from "@/components/feast-data";
import { expectedRefundDate, fmtDate, officeDue, personRefund, rs } from "@/lib/feast";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/reports")({
  head: () => ({
    meta: [
      { title: "Reports — FeastTrack" },
      { name: "description", content: "Weekly and per-person reports of biryani spend and office refunds." },
      { property: "og:title", content: "Reports — FeastTrack" },
      { property: "og:description", content: "Who paid what, refunds pending and received, week by week." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Reports,
});

function safeCell(c: string | number) {
  const v = String(c);
  return typeof c === "string" && /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
}

function downloadCsv(name: string, rows: (string | number)[][]) {
  const csv = rows.map((r) => r.map((c) => `"${safeCell(c).replace(/"/g, '""')}"`).join(",")).join("\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  a.download = name; a.click();
}

function Reports() {
  const { data, isLoading, error } = useQuery({ queryKey: feastKey, queryFn: loadFeast });
  const body = (() => {
    if (isLoading) return <p className="text-muted-foreground">Loading…</p>;
    if (error || !data) return <p className="text-destructive">Couldn't load reports.</p>;
    const weekRows = [...data.weeks].sort((a, b) => a.order_date.localeCompare(b.order_date)).map((w) => {
      const os = data.orders.filter((o) => o.week_id === w.id);
      return { w, people: os.length, paid: os.reduce((s, o) => s + Number(o.amount_paid), 0), due: officeDue(os) };
    });
    const pendingWeeks = new Set(data.weeks.filter((w) => !w.refund_received).map((w) => w.id));
    const people = new Map<string, { orders: number; paid: number; refunded: number; pending: number }>();
    for (const o of data.orders) {
      const p = people.get(o.person) ?? { orders: 0, paid: 0, refunded: 0, pending: 0 };
      const r = personRefund(Number(o.amount_paid));
      p.orders++; p.paid += Number(o.amount_paid);
      if (pendingWeeks.has(o.week_id)) p.pending += r; else p.refunded += r;
      people.set(o.person, p);
    }
    const personRows = [...people.entries()].sort((a, b) => b[1].paid - a[1].paid);
    const totals = weekRows.reduce((t, r) => ({ paid: t.paid + r.paid, due: t.due + r.due, pending: t.pending + (r.w.refund_received ? 0 : r.due) }), { paid: 0, due: 0, pending: 0 });

    return (
      <>
        <section className="grid gap-4 sm:grid-cols-3">
          <Stat label="Total spent" value={rs(totals.paid)} />
          <Stat label="Total office refunds" value={rs(totals.due)} />
          <Stat label="Refunds still pending" value={rs(totals.pending)} accent />
        </section>

        <Header title="Week by week" onCsv={() => downloadCsv("feasttrack-weeks.csv", [["Thursday", "Vendor", "People", "Bill", "Collected", "Office refund", "Status", "Refund date"], ...weekRows.map((r) => [r.w.order_date, r.w.vendor, r.people, r.w.bill_total, r.paid, r.due, r.w.refund_received ? "Received" : "Pending", r.w.refund_received_on ?? expectedRefundDate(r.w.order_date)])])} />
        <Table head={["Thursday", "Vendor", "People", "Bill", "Collected", "Office refund", "Status", "Refund date"]}>
          {weekRows.map((r) => (
            <tr key={r.w.id} className="border-t border-border">
              <td className="px-4 py-3 font-medium">{fmtDate(r.w.order_date)}</td><td className="px-4 py-3">{r.w.vendor || "—"}</td><td className="px-4 py-3">{r.people}</td>
              <td className="px-4 py-3">{rs(Number(r.w.bill_total))}</td><td className="px-4 py-3">{rs(r.paid)}</td><td className="px-4 py-3 text-primary">{rs(r.due)}</td>
              <td className="px-4 py-3"><span className={`rounded-full px-2 py-0.5 text-xs ${r.w.refund_received ? "bg-accent text-accent-foreground" : "bg-primary text-primary-foreground"}`}>{r.w.refund_received ? "Received" : "Pending"}</span></td>
              <td className="px-4 py-3">{fmtDate(r.w.refund_received_on ?? expectedRefundDate(r.w.order_date))}{!r.w.refund_received && <span className="text-muted-foreground"> (expected)</span>}</td>
            </tr>
          ))}
        </Table>

        <Header title="Per person" onCsv={() => downloadCsv("feasttrack-people.csv", [["Person", "Orders", "Paid", "Refunded", "Refund pending", "Own cost"], ...personRows.map(([n, p]) => [n, p.orders, p.paid, p.refunded, p.pending, p.paid - p.refunded - p.pending])])} />
        <Table head={["Person", "Orders", "Paid", "Refunded", "Refund pending", "Own cost"]}>
          {personRows.map(([n, p]) => (
            <tr key={n} className="border-t border-border">
              <td className="px-4 py-3 font-medium">{n}</td><td className="px-4 py-3">{p.orders}</td><td className="px-4 py-3">{rs(p.paid)}</td>
              <td className="px-4 py-3">{rs(p.refunded)}</td><td className="px-4 py-3 text-primary">{rs(p.pending)}</td><td className="px-4 py-3">{rs(p.paid - p.refunded - p.pending)}</td>
            </tr>
          ))}
        </Table>
      </>
    );
  })();
  return <main className="min-h-screen bg-background text-foreground"><SiteHeader /><div className="mx-auto max-w-6xl px-6 py-8">{body}</div></main>;
}

function Header({ title, onCsv }: { title: string; onCsv: () => void }) {
  return <div className="mt-10 flex items-end justify-between"><h2 className="font-display text-4xl">{title}</h2><Button variant="outline" size="sm" onClick={onCsv}>Download CSV</Button></div>;
}
function Table({ head, children }: { head: string[]; children: React.ReactNode }) {
  return <div className="mt-4 overflow-x-auto rounded-xl border border-border bg-card"><table className="w-full text-sm"><thead className="bg-muted font-mono text-xs uppercase text-muted-foreground"><tr>{head.map((h) => <th key={h} className="px-4 py-3 text-left">{h}</th>)}</tr></thead><tbody>{children}</tbody></table></div>;
}
function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return <div className="rounded-xl border border-border bg-card p-4"><div className={`font-display text-4xl ${accent ? "text-primary" : ""}`}>{value}</div><div className="font-mono text-xs uppercase text-muted-foreground">{label}</div></div>;
}
