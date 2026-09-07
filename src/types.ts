import type { PaymentDecision } from "./policy.js";

export type PaymentState =
  | "challenge_received"
  | "awaiting_approval"
  | "awaiting_signature"
  | "signed"
  | "verifying"
  | "settled"
  | "denied"
  | "failed";

export interface PaymentRequirement {
  scheme: string;
  network: string;
  amount: string;
  asset: string;
  payTo: string;
  maxTimeoutSeconds: number;
  extra?: Record<string, unknown>;
}

export interface PaymentRequired {
  x402Version: number;
  error?: string;
  resource: { url: string; description?: string; mimeType?: string };
  accepts: PaymentRequirement[];
  extensions?: Record<string, unknown>;
}

export interface X402Challenge extends PaymentRequirement {
  x402Version: number;
  resource: string;
  description: string;
  mimeType: string;
  raw: PaymentRequired;
}

export interface PolicySnapshot {
  decision: PaymentDecision;
  reason: string;
  requiresHumanConfirmation: boolean;
  perTransactionLimit: number;
  dailyLimit: number;
  dailySpent: number;
  trustedPayees: string[];
}

export interface SettlementReceipt {
  success: boolean;
  transaction: string;
  network: string;
  payer: string;
  settledAt: string;
  amount?: string;
  resourceDigest?: string;
  errorReason?: string;
}

export interface PaymentIntent {
  id: string;
  idempotencyKey: string;
  state: PaymentState;
  resourceUrl: string;
  purpose: string;
  amount: number;
  currency: "USDC" | "USD";
  payee: string;
  createdAt: string;
  updatedAt: string;
  challenge: X402Challenge;
  policy: PolicySnapshot;
  approval?: {
    decision: "approved" | "denied";
    confirmedBy: string;
    reason?: string;
    at: string;
  };
  paymentPayload?: string;
  receipt?: SettlementReceipt;
  resource?: unknown;
  error?: string;
}

export interface AuditEvent {
  id: string;
  intentId: string;
  type: string;
  actor: "agent" | "human" | "wallet" | "facilitator" | "resource" | "system";
  at: string;
  detail: Record<string, unknown>;
  previousHash: string;
  hash: string;
}

export interface CreatePaymentIntentInput {
  resourceUrl: string;
  amount: number;
  currency: "USDC" | "USD";
  purpose: string;
  payee: string;
  idempotencyKey: string;
  policy: {
    perTransactionLimit: number;
    dailyLimit: number;
    dailySpent: number;
    trustedPayees: string[];
  };
}
