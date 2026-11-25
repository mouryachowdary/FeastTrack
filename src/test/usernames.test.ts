import { describe, expect, it } from "vitest";

import { usernameToAuthEmail } from "@/lib/usernames";

describe("usernameToAuthEmail", () => {
  it("normalizes usernames into their Supabase Auth email", () => {
    expect(usernameToAuthEmail("  Sam_2 ")).toBe("sam_2@login.feasttrack.invalid");
  });

  it("rejects usernames outside the supported character and length rules", () => {
    expect(usernameToAuthEmail("-sam")).toBeUndefined();
    expect(usernameToAuthEmail("sam user")).toBeUndefined();
    expect(usernameToAuthEmail("a".repeat(33))).toBeUndefined();
  });
});
