import { describe, it, expect } from "vitest";
import { BIRYANI_CATEGORIES, CREW, ITEMS, personRefund, officeDue, expectedRefundDate } from "@/lib/feast";

describe("order choices", () => {
  it("uses the supplied team roster", () => {
    expect(CREW).toEqual([
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
    ]);
  });

  it("groups every unique biryani choice as veg or non-veg", () => {
    expect(BIRYANI_CATEGORIES.map((category) => category.label)).toEqual(["Veg", "Non-Veg"]);
    expect(new Set(ITEMS.map((item) => item.value)).size).toBe(ITEMS.length);
    expect(ITEMS.every((item) => item.category === "Veg" || item.category === "Non-Veg")).toBe(true);
  });
});

describe("refund rules", () => {
  it("refunds only ₹160 of a ₹250 meal", () => expect(personRefund(250)).toBe(160));
  it("never refunds more than was paid", () => expect(personRefund(100)).toBe(100));
  it("office due is ₹160 × 10 people = ₹1600", () =>
    expect(officeDue(Array.from({ length: 10 }, () => ({ person: "x", item: "Kalmi", amount_paid: 200 })))).toBe(1600));
  it("refund for 12 Nov order expected in 3rd week, 26 Nov", () => expect(expectedRefundDate("2026-11-12")).toBe("2026-11-26"));
});
