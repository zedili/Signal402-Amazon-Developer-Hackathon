import { describe, expect, it } from "vitest";

import { DemoResourceClient, encodeHeader, validateChallenge } from "../src/x402.js";

const expected = {
  resourceUrl: "https://api.example.com/report",
  amount: 2,
  payee: "0x1111111111111111111111111111111111111111"
};

function challenge(options: { version?: number; resource?: string; requirement?: Record<string, unknown> } = {}) {
  return encodeHeader({
    x402Version: options.version ?? 2,
    resource: { url: options.resource ?? expected.resourceUrl, description: "Report", mimeType: "application/json" },
    accepts: [{
      scheme: "exact",
      network: "eip155:84532",
      amount: "2000000",
      asset: "0x036CbD53842c5426634e7929541eC2318f3dCF7c",
      payTo: expected.payee,
      maxTimeoutSeconds: 60,
      ...options.requirement
    }]
  });
}

describe("x402 v2 challenge validation", () => {
  it("accepts pinned v2 payment terms in atomic units", () => {
    const parsed = validateChallenge(challenge(), expected);
    expect(parsed.network).toBe("eip155:84532");
    expect(parsed.amount).toBe("2000000");
    expect(parsed.raw.accepts).toHaveLength(1);
  });

  it.each([
    { requirement: { amount: "3000000" } },
    { requirement: { payTo: "0x2222222222222222222222222222222222222222" } },
    { resource: "https://evil.example/data" },
    { version: 1 },
    { requirement: { maxTimeoutSeconds: 500 } }
  ])("rejects modified terms %#", (override) => {
    expect(() => validateChallenge(challenge(override), expected)).toThrow();
  });

  it("returns a resource only after receiving a payment payload", async () => {
    const client = new DemoResourceClient();
    expect((await client.request("demo://premium-climate-risk-signal")).status).toBe(402);
    const paid = await client.request("demo://premium-climate-risk-signal", "demo_x402:abcdefghijklmnop");
    expect(paid.status).toBe(200);
    expect(paid.paymentResponse).toBeTruthy();
  });
});
