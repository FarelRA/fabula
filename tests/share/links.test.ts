import { describe, expect, test } from "vitest";
import {
  permissionDescription,
  permissionLabel,
  shareStatus,
  shareStatusLabel,
  shareUrl,
} from "@/lib/share/links";

describe("share link helpers", () => {
  test("builds absolute share URLs from any origin shape", () => {
    expect(shareUrl("https://fabula.example", "tok_123")).toBe(
      "https://fabula.example/share/tok_123",
    );
    expect(shareUrl("https://fabula.example/", "tok_123")).toBe(
      "https://fabula.example/share/tok_123",
    );
    expect(shareUrl("", "tok_123")).toBe("/share/tok_123");
  });

  test("labels permissions by what they actually allow", () => {
    expect(permissionLabel("viewer")).toBe("View only");
    expect(permissionLabel("director")).toBe("Can direct");
    expect(permissionDescription("director")).toMatch(/pick path options/);
    expect(permissionDescription("viewer")).toMatch(/read-only/);
  });

  test("derives active/revoked/expired status against a clock", () => {
    const now = 1_000;
    expect(shareStatus({}, now)).toBe("active");
    expect(shareStatus({ revokedAt: 500 }, now)).toBe("revoked");
    expect(shareStatus({ expiresAt: 999 }, now)).toBe("expired");
    expect(shareStatus({ expiresAt: 1_001 }, now)).toBe("active");
    expect(shareStatusLabel("revoked")).toBe("Revoked");
    expect(shareStatusLabel("expired")).toBe("Expired");
    expect(shareStatusLabel("active")).toBe("Active");
  });
});
