import { afterEach, describe, expect, it, vi } from "vitest";

import type { X402Challenge } from "../src/types.js";
import {
  encodeHeader,
  HttpsResourceClient,
  RemoteFacilitatorClient
} from "../src/x402.js";

const challenge = {
  x402Version: 2,
  scheme: "exact",
  network: "eip155:84532",
  amount: "2000000",
  asset: "0xToken",
  payTo: "0x1111111111111111111111111111111111111111",
  maxTimeoutSeconds: 60,
  resource: "https://resource.example/report",
  description: "Report",
  mimeType: "application/json",
  raw: { x402Version: 2, resource: { url: "https://resource.example/report" }, accepts: [] }
} satisfies X402Challenge;

afterEach(() => vi.unstubAllGlobals());

describe("production HTTP adapters", () => {
  it("forwards PAYMENT-SIGNATURE and reads x402 response headers", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ value: 42 }), {
      status: 200,
      headers: { "content-type": "application/json", "PAYMENT-RESPONSE": "receipt-header" }
    }));
    vi.stubGlobal("fetch", fetchMock);
    const result = await new HttpsResourceClient().request(challenge.resource, "signed-header");
    expect(result).toMatchObject({ status: 200, paymentResponse: "receipt-header", body: { value: 42 } });
    expect(fetchMock.mock.calls[0][1].headers).toEqual({ "PAYMENT-SIGNATURE": "signed-header" });
  });

  it("supports text 402 responses", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("payment needed", {
      status: 402,
      headers: { "content-type": "text/plain", "PAYMENT-REQUIRED": "required-header" }
    })));
    const result = await new HttpsResourceClient().request(challenge.resource);
    expect(result).toMatchObject({ status: 402, paymentRequired: "required-header", body: "payment needed" });
  });

  it("posts a decoded v2 payload to a remote facilitator", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ isValid: true, payer: "0xPayer" }), {
      status: 200, headers: { "content-type": "application/json" }
    }));
    vi.stubGlobal("fetch", fetchMock);
    const client = new RemoteFacilitatorClient("https://facilitator.example/api/", "secret");
    const result = await client.verify(challenge, encodeHeader({ x402Version: 2, payload: { signature: "0xabc" } }));
    expect(result).toEqual({ valid: true, payer: "0xPayer" });
    const request = fetchMock.mock.calls[0];
    expect(String(request[0])).toBe("https://facilitator.example/api/verify");
    expect(request[1].headers.authorization).toBe("Bearer secret");
    expect(JSON.parse(request[1].body).paymentRequirements.amount).toBe("2000000");
  });

  it("fails closed on facilitator rejection and HTTP errors", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ isValid: false, invalidReason: "bad_nonce" }), { status: 200 })));
    const client = new RemoteFacilitatorClient("https://facilitator.example");
    await expect(client.verify(challenge, encodeHeader({ payload: {} }))).rejects.toThrow("bad_nonce");

    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(new Response("unavailable", { status: 503 })));
    await expect(client.verify(challenge, encodeHeader({ payload: {} }))).rejects.toThrow("HTTP 503");
  });
});
