import { describe, expect, it } from "vitest";

import { evaluatePaymentPolicy } from "../src/policy.js";

describe("evaluatePaymentPolicy", () => {
  it("approves a small payment to a trusted payee", () => {
    expect(
      evaluatePaymentPolicy({
        amount: 2,
        dailySpent: 3,
        purpose: "Purchase a verified market report",
        payee: "reports.example",
        trustedPayees: ["reports.example"]
      }).decision
    ).toBe("approved");
  });

  it("requires approval for an unknown payee", () => {
    const result = evaluatePaymentPolicy({
      amount: 2,
      dailySpent: 3,
      purpose: "Purchase external data",
      payee: "new-provider.example"
    });

    expect(result.decision).toBe("requires_approval");
    expect(result.requiresHumanConfirmation).toBe(true);
  });

  it("denies a payment above the remaining daily budget", () => {
    expect(
      evaluatePaymentPolicy({
        amount: 6,
        dailySpent: 20,
        dailyLimit: 25,
        purpose: "Purchase external data",
        payee: "reports.example",
        trustedPayees: ["reports.example"]
      }).decision
    ).toBe("denied");
  });
});
