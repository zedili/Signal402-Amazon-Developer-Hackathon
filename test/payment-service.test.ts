import { describe, expect, it } from "vitest";

import { PaymentService } from "../src/payment-service.js";
import { InMemoryPaymentStore } from "../src/store.js";
import { DemoFacilitatorClient, DemoResourceClient } from "../src/x402.js";

function setup() {
  const store = new InMemoryPaymentStore();
  return { store, service: new PaymentService(store, new DemoResourceClient(), new DemoFacilitatorClient()) };
}

const baseInput = {
  resourceUrl: "demo://premium-climate-risk-signal",
  amount: 6.5,
  currency: "USDC" as const,
  purpose: "Premium climate-risk signal pack",
  payee: "0x4020000000000000000000000000000000002026",
  idempotencyKey: "test-intent-one",
  policy: { perTransactionLimit: 5, dailyLimit: 25, dailySpent: 0, trustedPayees: [] as string[] }
};

describe("payment state machine", () => {
  it("runs approval, external signature, verification, and settlement", async () => {
    const { service } = setup();
    let intent = await service.create(baseInput);
    expect(intent.state).toBe("awaiting_approval");

    intent = await service.decide(intent.id, "approved", "test-human");
    expect(intent.state).toBe("awaiting_signature");

    intent = await service.submitSignature(intent.id, "demo_x402:abcdefghijklmnop");
    expect(intent.state).toBe("signed");

    intent = await service.execute(intent.id);
    expect(intent.state).toBe("settled");
    expect(intent.receipt?.success).toBe(true);
    expect(intent.resource).toMatchObject({ confidence: 0.87 });
    expect(intent.paymentPayload).toBeUndefined();
  });

  it("is idempotent for creation and settlement", async () => {
    const { service } = setup();
    const first = await service.create(baseInput);
    const duplicate = await service.create(baseInput);
    expect(duplicate.id).toBe(first.id);
    await service.decide(first.id, "approved", "test-human");
    await service.submitSignature(first.id, "demo_x402:abcdefghijklmnop");
    const settled = await service.execute(first.id);
    expect((await service.execute(first.id)).receipt?.transaction).toBe(settled.receipt?.transaction);
  });

  it("refuses invalid transitions and invalid signatures", async () => {
    const { service } = setup();
    const intent = await service.create(baseInput);
    await expect(service.execute(intent.id)).rejects.toMatchObject({ status: 409 });
    await service.decide(intent.id, "approved", "test-human");
    await service.submitSignature(intent.id, "this-payload-is-long-but-invalid");
    await expect(service.execute(intent.id)).rejects.toThrow("facilitator rejected");
    expect((await service.get(intent.id))?.state).toBe("failed");
  });

  it("creates a chained, redacted audit trail", async () => {
    const { service } = setup();
    const intent = await service.create(baseInput);
    await service.decide(intent.id, "approved", "test-human");
    await service.submitSignature(intent.id, "demo_x402:abcdefghijklmnop");
    const events = await service.listAudit(intent.id);
    expect(events).toHaveLength(3);
    expect(events[1].previousHash).toBe(events[0].hash);
    expect(JSON.stringify(events)).not.toContain("demo_x402:abcdefghijklmnop");
  });
});
