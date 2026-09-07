export type PaymentDecision = "approved" | "requires_approval" | "denied";

export interface PaymentPolicyInput {
  amount: number;
  dailySpent: number;
  purpose: string;
  payee: string;
  currency?: "USD" | "USDC";
  perTransactionLimit?: number;
  dailyLimit?: number;
  trustedPayees?: string[];
}

export interface PaymentPolicyResult {
  decision: PaymentDecision;
  reason: string;
  remainingDailyBudget: number;
  requiresHumanConfirmation: boolean;
}

export function evaluatePaymentPolicy(input: PaymentPolicyInput): PaymentPolicyResult {
  const perTransactionLimit = input.perTransactionLimit ?? 10;
  const dailyLimit = input.dailyLimit ?? 25;
  const trustedPayees = new Set(input.trustedPayees ?? []);
  const remainingDailyBudget = Math.max(0, dailyLimit - input.dailySpent);

  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    return {
      decision: "denied",
      reason: "The amount must be a positive finite number.",
      remainingDailyBudget,
      requiresHumanConfirmation: false
    };
  }

  if (!input.purpose.trim() || !input.payee.trim()) {
    return {
      decision: "denied",
      reason: "A payment requires both a payee and a human-readable purpose.",
      remainingDailyBudget,
      requiresHumanConfirmation: false
    };
  }

  if (input.amount > remainingDailyBudget) {
    return {
      decision: "denied",
      reason: "The payment would exceed the remaining daily budget.",
      remainingDailyBudget,
      requiresHumanConfirmation: false
    };
  }

  if (input.amount > perTransactionLimit || !trustedPayees.has(input.payee)) {
    return {
      decision: "requires_approval",
      reason: input.amount > perTransactionLimit
        ? "The payment exceeds the autonomous per-transaction limit."
        : "The payee is not on the trusted allowlist.",
      remainingDailyBudget,
      requiresHumanConfirmation: true
    };
  }

  return {
    decision: "approved",
    reason: "The payment is within budget and the payee is trusted.",
    remainingDailyBudget,
    requiresHumanConfirmation: false
  };
}
