import { describe, expect, it } from "vitest";

import { assertSafeExternalUrl, safeEqual } from "../src/security.js";

describe("resource URL protection", () => {
  it.each([
    "http://example.com/data",
    "https://localhost/data",
    "https://127.0.0.1/data",
    "https://169.254.169.254/latest/meta-data",
    "https://192.168.1.1/admin",
    "https://user:password@example.com/data"
  ])("blocks unsafe target %s", (url) => {
    expect(() => assertSafeExternalUrl(url)).toThrow();
  });

  it("accepts a public HTTPS target", () => {
    expect(assertSafeExternalUrl("https://api.example.com/report").hostname).toBe("api.example.com");
  });

  it("compares API keys safely", () => {
    expect(safeEqual("correct", "correct")).toBe(true);
    expect(safeEqual("correct", "wrong")).toBe(false);
  });
});
