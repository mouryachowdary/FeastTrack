import { describe, expect, it } from "vitest";

import { usernameToAuthEmail } from "@/lib/usernames";

describe("usernameToAuthEmail", () => {
  it("normalizes usernames into their Supabase Auth email", () => {
    expect(usernameToAuthEmail("  Sam_2 ")).toBe("sam_2@login.feasttrack.invalid");
  });

  it("rejects usernames with unsupported characters", () => {
    expect(usernameToAuthEmail("-sam")).toBeUndefined();
    expect(usernameToAuthEmail("sam user")).toBeUndefined();
  });

  it("accepts usernames up to 50 characters and rejects longer ones", () => {
    expect(usernameToAuthEmail("a".repeat(50))).toBe("a".repeat(50) + "@login.feasttrack.invalid");
    expect(usernameToAuthEmail("a".repeat(51))).toBeUndefined();
  });
});
