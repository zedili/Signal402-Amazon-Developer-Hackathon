import { randomUUID } from "node:crypto";

import { evaluatePaymentPolicy } from "./policy.js";
import { redact, sha256 } from "./security.js";
import type { PaymentStore } from "./store.js";
import type { CreatePaymentIntentInput, PaymentIntent, PaymentState, SettlementReceipt } from "./types.js";
import type { FacilitatorClient, ResourceClient } from "./x402.js";
import { decodeHeader, validateChallenge } from "./x402.js";

const TERMINAL_STATES = new Set<PaymentState>(["settled", "denied", "failed"]);

export class PaymentError extends Error {
  constructor(message: string, public readonly status = 400) {
    super(message);
  }
}

export class PaymentService {
  constructor(
    private readonly store: PaymentStore,
    private readonly resources: ResourceClient,
    private readonly facilitator: FacilitatorClient
  ) {}

  async create(input: CreatePaymentIntentInput): Promise<PaymentIntent> {
    const existing = await this.store.getIntentByIdempotencyKey(input.idempotencyKey);
    if (existing) return existing;

    const initial = await this.resources.request(input.resourceUrl);
    if (initial.status !== 402 || !initial.paymentRequired) {
      throw new PaymentError("The resource did not return a valid HTTP 402 challenge.", 422);
    }
    const challenge = validateChallenge(initial.paymentRequired, {
      resourceUrl: input.resourceUrl,
      amount: input.amount,
      payee: input.payee
    });
    const policyResult = evaluatePaymentPolicy({
      amount: input.amount,
      dailySpent: input.policy.dailySpent,
      purpose: input.purpose,
      payee: input.payee,
      currency: input.currency,
      perTransactionLimit: input.policy.perTransactionLimit,
      dailyLimit: input.policy.dailyLimit,
      trustedPayees: input.policy.trustedPayees
    });
    const now = new Date().toISOString();
    const state: PaymentState = policyResult.decision === "denied"
      ? "denied"
      : policyResult.decision === "requires_approval"
        ? "awaiting_approval"
        : "awaiting_signature";
    const intent: PaymentIntent = {
      id: randomUUID(),
      idempotencyKey: input.idempotencyKey,
      state,
      resourceUrl: input.resourceUrl,
      purpose: input.purpose,
      amount: input.amount,
      currency: input.currency,
      payee: input.payee,
      createdAt: now,
      updatedAt: now,
      challenge,
      policy: {
        ...policyResult,
        perTransactionLimit: input.policy.perTransactionLimit,
        dailyLimit: input.policy.dailyLimit,
        dailySpent: input.policy.dailySpent,
        trustedPayees: [...input.policy.trustedPayees]
      }
    };
    await this.store.saveIntent(intent);
    await this.audit(intent.id, "intent.created", "agent", {
      state,
      amount: input.amount,
      currency: input.currency,
      resource: input.resourceUrl,
      policyDecision: policyResult.decision
    });
    return intent;
  }

  async decide(id: string, decision: "approved" | "denied", confirmedBy: string, reason?: string): Promise<PaymentIntent> {
    const intent = await this.requireIntent(id);
    this.requireState(intent, "awaiting_approval");
    intent.approval = { decision, confirmedBy, reason, at: new Date().toISOString() };
    intent.state = decision === "approved" ? "awaiting_signature" : "denied";
    intent.updatedAt = new Date().toISOString();
    await this.store.saveIntent(intent);
    await this.audit(id, `human.${decision}`, "human", { confirmedBy, reason: reason ?? "" });
    return intent;
  }

  async submitSignature(id: string, paymentPayload: string): Promise<PaymentIntent> {
    const intent = await this.requireIntent(id);
    this.requireState(intent, "awaiting_signature");
    if (paymentPayload.length < 20 || paymentPayload.length > 16_384) {
      throw new PaymentError("Wallet payment payload has an unsafe length.");
    }
    intent.paymentPayload = paymentPayload;
    intent.state = "signed";
    intent.updatedAt = new Date().toISOString();
    await this.store.saveIntent(intent);
    await this.audit(id, "wallet.payload_received", "wallet", {
      payloadDigest: sha256(paymentPayload),
      preview: redact(paymentPayload)
    });
    return intent;
  }

  async execute(id: string): Promise<PaymentIntent> {
    const intent = await this.requireIntent(id);
    if (intent.state === "settled") return intent;
    this.requireState(intent, "signed");
    intent.state = "verifying";
    intent.updatedAt = new Date().toISOString();
    await this.store.saveIntent(intent);

    try {
      const verification = await this.facilitator.verify(intent.challenge, intent.paymentPayload!);
      await this.audit(id, "facilitator.verified", "facilitator", { valid: verification.valid });
      if (!verification.valid) throw new PaymentError("The facilitator rejected the wallet payment payload.", 422);

      const response = await this.resources.request(intent.resourceUrl, intent.paymentPayload);
      if (response.status < 200 || response.status >= 300 || !response.paymentResponse) {
        throw new PaymentError("The paid resource did not return a settlement receipt.", 502);
      }
      const receipt = decodeHeader<SettlementReceipt>(response.paymentResponse);
      if (!receipt.success || receipt.network !== intent.challenge.network) {
        throw new PaymentError("The settlement receipt failed validation.", 502);
      }
      intent.state = "settled";
      intent.receipt = receipt;
      intent.resource = response.body;
      intent.paymentPayload = undefined;
      intent.updatedAt = new Date().toISOString();
      await this.store.saveIntent(intent);
      await this.audit(id, "payment.settled", "resource", {
        transaction: receipt.transaction,
        network: receipt.network,
        resourceDigest: receipt.resourceDigest ?? sha256(intent.resourceUrl)
      });
      return intent;
    } catch (error) {
      intent.state = "failed";
      intent.error = error instanceof Error ? error.message : "Payment execution failed.";
      intent.paymentPayload = undefined;
      intent.updatedAt = new Date().toISOString();
      await this.store.saveIntent(intent);
      await this.audit(id, "payment.failed", "system", { error: intent.error });
      throw error;
    }
  }

  get(id: string): Promise<PaymentIntent | undefined> {
    return this.store.getIntent(id);
  }

  list(): Promise<PaymentIntent[]> {
    return this.store.listIntents();
  }

  listAudit(id?: string) {
    return this.store.listAudit(id);
  }

  reset() {
    return this.store.clear();
  }

  private async requireIntent(id: string): Promise<PaymentIntent> {
    const intent = await this.store.getIntent(id);
    if (!intent) throw new PaymentError("Payment intent not found.", 404);
    if (TERMINAL_STATES.has(intent.state) && intent.state !== "settled") {
      throw new PaymentError(`Payment intent is already ${intent.state}.`, 409);
    }
    return intent;
  }

  private requireState(intent: PaymentIntent, expected: PaymentState): void {
    if (intent.state !== expected) {
      throw new PaymentError(`Expected state ${expected}, received ${intent.state}.`, 409);
    }
  }

  private async audit(intentId: string, type: string, actor: Parameters<PaymentStore["appendAudit"]>[0]["actor"], detail: Record<string, unknown>) {
    await this.store.appendAudit({ intentId, type, actor, at: new Date().toISOString(), detail });
  }
}
