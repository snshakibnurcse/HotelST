import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { maskNid } from "@/lib/utils";

describe("Security and Privacy Sanitization", () => {
  it("securely hashes and validates passwords using bcrypt", async () => {
    const raw = "SuperSecretHotelManager#2026";
    const hashed = await hashPassword(raw);

    expect(hashed).not.toBe(raw);
    expect(hashed.startsWith("$2")).toBe(true);

    const valid = await verifyPassword(raw, hashed);
    expect(valid).toBe(true);

    const invalid = await verifyPassword("WrongPassword", hashed);
    expect(invalid).toBe(false);
  });

  it("masks sensitive National ID numbers to prevent privacy leakage", () => {
    expect(maskNid("5948392019")).toBe("******2019");
    expect(maskNid("1234567890123")).toBe("*********0123");
    expect(maskNid(null)).toBe("—");
    expect(maskNid("")).toBe("—");
    expect(maskNid("1234")).toBe("****");
  });
});
