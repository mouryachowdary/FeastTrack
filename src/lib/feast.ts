export const REFUND_PER_PERSON = 160;
export const BIRYANI_CATEGORIES = [
  {
    label: "Veg",
    items: [
      { value: "Veg Item", label: "Vegetable Biryani" },
      { value: "Hyderabadi Veg Dum Biryani", label: "Hyderabadi Veg Dum Biryani" },
      { value: "Paneer Biryani", label: "Paneer Biryani" },
      { value: "Mushroom Biryani", label: "Mushroom Biryani" },
      { value: "Soya Chaap Biryani", label: "Soya Chaap Biryani" },
      { value: "Kathal Biryani", label: "Kathal (Jackfruit) Biryani" },
      { value: "Mixed Vegetable Biryani", label: "Mixed Vegetable Biryani" },
      { value: "Aloo Dum Biryani", label: "Aloo Dum Biryani" },
      { value: "Lucknowi Veg Biryani", label: "Lucknowi Veg Biryani" },
      { value: "Kolkata Veg Biryani", label: "Kolkata Veg Biryani" },
    ],
  },
  {
    label: "Non-Veg",
    items: [
      { value: "Chicken Dum", label: "Chicken Dum Biryani" },
      { value: "ChickenFry Piece", label: "Chicken Fry Piece Biryani" },
      { value: "Kalmi", label: "Chicken Kalmi Biryani" },
      { value: "Mughalai", label: "Mughlai Chicken Biryani" },
      { value: "Hyderabadi Chicken Biryani", label: "Hyderabadi Chicken Biryani" },
      { value: "Chicken 65 Biryani", label: "Chicken 65 Biryani" },
      { value: "Chicken Tikka Biryani", label: "Chicken Tikka Biryani" },
      { value: "Boneless Chicken Biryani", label: "Boneless Chicken Biryani" },
      { value: "Andhra Chicken Biryani", label: "Andhra Chicken Biryani" },
      { value: "Ambur Chicken Biryani", label: "Ambur Chicken Biryani" },
      { value: "Dindigul Chicken Biryani", label: "Dindigul Chicken Biryani" },
      { value: "Thalassery Chicken Biryani", label: "Thalassery Chicken Biryani" },
      { value: "Mutton Dum Biryani", label: "Mutton Dum Biryani" },
      { value: "Mutton Gosht Biryani", label: "Mutton Gosht Biryani" },
      { value: "Lucknowi Mutton Biryani", label: "Lucknowi Mutton Biryani" },
      { value: "Kolkata Chicken Biryani", label: "Kolkata Chicken Biryani" },
      { value: "Keema Biryani", label: "Keema Biryani" },
      { value: "Egg Biryani", label: "Egg Biryani" },
      { value: "Fish Biryani", label: "Fish Biryani" },
      { value: "Prawn Biryani", label: "Prawn Biryani" },
    ],
  },
] as const;
export type BiryaniChoice = { value: string; label: string; category: "Veg" | "Non-Veg" };
export const ITEMS: BiryaniChoice[] = BIRYANI_CATEGORIES.flatMap((category) =>
  category.items.map((item) => ({ ...item, category: category.label })),
);
export const CREW = [
  "Mani Bobby",
  "Siva",
  "Mohan",
  "Sujith",
  "Bharath",
  "Mahesh",
  "Govind",
  "Mourya",
  "Midhin",
  "Eswar",
  "Aravind",
  "Ahamad",
  "Naveen",
];

export type Order = { person: string; item: string; amount_paid: number };

/** Office refunds only ₹160 of each person's full amount. */
export function personRefund(amountPaid: number) {
  return Math.min(REFUND_PER_PERSON, Math.max(0, amountPaid));
}
export function officeDue(orders: Order[]) {
  return orders.reduce((s, o) => s + personRefund(Number(o.amount_paid)), 0);
}
/** Refund arrives in the 3rd week after the order (order date + 14 days). */
export function expectedRefundDate(orderDate: string) {
  const d = new Date(orderDate + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + 14);
  return d.toISOString().slice(0, 10);
}
export const rs = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;
export const fmtDate = (d: string) =>
  new Date(d + "T00:00:00Z").toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
