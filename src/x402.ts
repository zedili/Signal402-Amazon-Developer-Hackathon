import { randomUUID } from "node:crypto";

import { assertSafeExternalUrl, sha256 } from "./security.js";
import type { PaymentRequired, SettlementReceipt, X402Challenge } from "./types.js";

export interface ResourceResponse {
  status: number;
  paymentRequired?: string;
  paymentResponse?: string;
  body?: unknown;
}

export interface ResourceClient {
  request(resourceUrl: string, paymentPayload?: string): Promise<ResourceResponse>;
}

export interface FacilitatorClient {
  verify(challenge: X402Challenge, paymentPayload: string): Promise<{ valid: boolean; payer: string }>;
}

export function encodeHeader(value: unknown): string {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}

export function decodeHeader<T>(value: string): T {
  try {
    return JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as T;
  } catch {
    throw new Error("The x402 header is not valid base64url JSON.");
  }
}

export function validateChallenge(raw: string, expected: { resourceUrl: string; amount: number; payee: string }): X402Challenge {
  const paymentRequired = decodeHeader<PaymentRequired>(raw);
  if (paymentRequired.x402Version !== 2) throw new Error("Only x402 v2 challenges are supported.");
  if (paymentRequired.resource?.url !== expected.resourceUrl) throw new Error("Challenge resource mismatch.");
  if (!Array.isArray(paymentRequired.accepts) || paymentRequired.accepts.length === 0) {
    throw new Error("Challenge contains no accepted payment method.");
  }
  const expectedAtomicAmount = BigInt(Math.round(expected.amount * 1_000_000)).toString();
  const requirement = paymentRequired.accepts.find((candidate) =>
    candidate.scheme === "exact" &&
    candidate.network?.startsWith("eip155:") &&
    candidate.amount === expectedAtomicAmount &&
    candidate.payTo?.toLowerCase() === expected.payee.toLowerCase()
  );
  if (!requirement) throw new Error("No exact payment method matches the pinned amount, payee, and network policy.");
  if (requirement.maxTimeoutSeconds < 1 || requirement.maxTimeoutSeconds > 300) throw new Error("Unsafe challenge timeout.");
  if (!/^\d+$/.test(requirement.amount) || BigInt(requirement.amount) <= 0n) throw new Error("Invalid atomic payment amount.");
  return {
    ...requirement,
    x402Version: 2,
    resource: paymentRequired.resource.url,
    description: paymentRequired.resource.description ?? "Paid resource",
    mimeType: paymentRequired.resource.mimeType ?? "application/octet-stream",
    raw: paymentRequired
  };
}

export class DemoResourceClient implements ResourceClient {
  async request(resourceUrl: string, paymentPayload?: string): Promise<ResourceResponse> {
    if (!resourceUrl.startsWith("demo://")) throw new Error("Demo client only handles demo:// resources.");
    const paymentRequired: PaymentRequired = {
      x402Version: 2,
      resource: {
        url: resourceUrl,
        description: "Premium climate-risk signal pack",
        mimeType: "application/json"
      },
      accepts: [{
        scheme: "exact",
        network: "eip155:84532",
        amount: "6500000",
        payTo: "0x4020000000000000000000000000000000002026",
        maxTimeoutSeconds: 90,
        asset: "0x036CbD53842c5426634e7929541eC2318f3dCF7c",
        extra: { name: "USD Coin", version: "2", assetDecimals: 6, demo: true }
      }],
      extensions: { "signal402.demo": { zeroValue: true } }
    };

    if (!paymentPayload) return { status: 402, paymentRequired: encodeHeader(paymentRequired) };

    const receipt: SettlementReceipt = {
      success: true,
      transaction: `0x${sha256(`${paymentPayload}:${randomUUID()}`)}`,
      network: paymentRequired.accepts[0].network,
      payer: "0xA11ce0000000000000000000000000000000402",
      settledAt: new Date().toISOString(),
      resourceDigest: sha256(resourceUrl)
    };
    return {
      status: 200,
      paymentResponse: encodeHeader(receipt),
      body: {
        signal: "Coastal logistics disruption risk is elevated for the next 72 hours.",
        confidence: 0.87,
        sources: 14,
        generatedAt: new Date().toISOString()
      }
    };
  }
}

export class HttpsResourceClient implements ResourceClient {
  constructor(private readonly timeoutMs = 8_000) {}

  async request(resourceUrl: string, paymentPayload?: string): Promise<ResourceResponse> {
    const url = assertSafeExternalUrl(resourceUrl);
    const response = await fetch(url, {
      redirect: "error",
      signal: AbortSignal.timeout(this.timeoutMs),
      headers: paymentPayload ? { "PAYMENT-SIGNATURE": paymentPayload } : undefined
    });
    const contentType = response.headers.get("content-type") ?? "";
    const body = contentType.includes("application/json") ? await response.json() : await response.text();
    return {
      status: response.status,
      paymentRequired: response.headers.get("PAYMENT-REQUIRED") ?? undefined,
      paymentResponse: response.headers.get("PAYMENT-RESPONSE") ?? undefined,
      body
    };
  }
}

export class CompositeResourceClient implements ResourceClient {
  constructor(
    private readonly demo = new DemoResourceClient(),
    private readonly network = new HttpsResourceClient()
  ) {}

  request(resourceUrl: string, paymentPayload?: string): Promise<ResourceResponse> {
    return resourceUrl.startsWith("demo://")
      ? this.demo.request(resourceUrl, paymentPayload)
      : this.network.request(resourceUrl, paymentPayload);
  }
}

export class DemoFacilitatorClient implements FacilitatorClient {
  async verify(challenge: X402Challenge, paymentPayload: string): Promise<{ valid: boolean; payer: string }> {
    return {
      valid: challenge.resource.startsWith("demo://") && /^demo_x402:[A-Za-z0-9_-]{16,}$/.test(paymentPayload),
      payer: "0xA11ce0000000000000000000000000000000402"
    };
  }
}

export class RemoteFacilitatorClient implements FacilitatorClient {
  private readonly baseUrl: URL;

  constructor(baseUrl: string, private readonly apiKey?: string, private readonly timeoutMs = 8_000) {
    this.baseUrl = assertSafeExternalUrl(baseUrl);
  }

  async verify(challenge: X402Challenge, paymentPayload: string): Promise<{ valid: boolean; payer: string }> {
    const url = new URL("verify", this.baseUrl.href.endsWith("/") ? this.baseUrl : `${this.baseUrl.href}/`);
    const response = await fetch(url, {
      method: "POST",
      redirect: "error",
      signal: AbortSignal.timeout(this.timeoutMs),
      headers: {
        "content-type": "application/json",
        ...(this.apiKey ? { authorization: `Bearer ${this.apiKey}` } : {})
      },
      body: JSON.stringify({
        x402Version: 2,
        paymentPayload: decodeHeader<Record<string, unknown>>(paymentPayload),
        paymentRequirements: {
          scheme: challenge.scheme,
          network: challenge.network,
          amount: challenge.amount,
          asset: challenge.asset,
          payTo: challenge.payTo,
          maxTimeoutSeconds: challenge.maxTimeoutSeconds,
          extra: challenge.extra
        }
      })
    });
    if (!response.ok) throw new Error(`Facilitator verification failed with HTTP ${response.status}.`);
    const result = await response.json() as { isValid?: boolean; payer?: string; invalidReason?: string };
    if (!result.isValid && result.invalidReason) throw new Error(`Facilitator rejected payment: ${result.invalidReason}.`);
    return { valid: result.isValid === true, payer: result.payer ?? "unknown" };
  }
}

export function createDefaultFacilitator(): FacilitatorClient {
  const url = process.env.X402_FACILITATOR_URL;
  return url ? new RemoteFacilitatorClient(url, process.env.X402_FACILITATOR_API_KEY) : new DemoFacilitatorClient();
}
