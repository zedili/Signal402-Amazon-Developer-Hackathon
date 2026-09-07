import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { describe, expect, it, vi } from "vitest";

import { createDefaultStore, DynamoPaymentStore, InMemoryPaymentStore } from "../src/store.js";
import type { AuditEvent, PaymentIntent } from "../src/types.js";

const intent = {
  id: "intent-1",
  idempotencyKey: "idempotency-1",
  createdAt: "2026-09-07T00:00:00.000Z",
  updatedAt: "2026-09-07T00:00:00.000Z"
} as PaymentIntent;

const previous = { hash: "previous-hash" } as AuditEvent;

describe("DynamoDB persistence adapter", () => {
  it("maps intent, idempotency, audit, and paginated clear operations", async () => {
    const items = Array.from({ length: 30 }, (_, index) => ({ PK: `P#${index}`, SK: `S#${index}` }));
    const send = vi.fn()
      .mockResolvedValueOnce({ Item: { payload: intent } })
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ Items: [{ payload: intent }] })
      .mockResolvedValueOnce({ Items: [{ payload: intent }] })
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ Items: [{ payload: previous }] })
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ Items: [{ payload: previous }] })
      .mockResolvedValueOnce({ Items: [{ payload: previous }] })
      .mockResolvedValueOnce({ Items: items, LastEvaluatedKey: { PK: "next", SK: "next" } })
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ Items: [] });
    const client = { send } as unknown as DynamoDBDocumentClient;
    const store = new DynamoPaymentStore("table", client);

    expect(await store.getIntent("intent-1")).toMatchObject({ id: "intent-1" });
    expect(await store.getIntent("missing")).toBeUndefined();
    expect(await store.getIntentByIdempotencyKey("idempotency-1")).toMatchObject({ id: "intent-1" });
    expect(await store.listIntents()).toHaveLength(1);
    await store.saveIntent(intent);
    const audit = await store.appendAudit({
      intentId: intent.id, type: "test", actor: "system", at: "2026-09-07T00:00:01.000Z", detail: {}
    });
    expect(audit.previousHash).toBe("previous-hash");
    expect(await store.listAudit(intent.id)).toHaveLength(1);
    expect(await store.listAudit()).toHaveLength(1);
    await store.clear();
    expect(send).toHaveBeenCalledTimes(13);
  });

  it("selects storage from environment", () => {
    const prior = process.env.DYNAMODB_TABLE;
    delete process.env.DYNAMODB_TABLE;
    expect(createDefaultStore()).toBeInstanceOf(InMemoryPaymentStore);
    process.env.DYNAMODB_TABLE = "production-table";
    expect(createDefaultStore()).toBeInstanceOf(DynamoPaymentStore);
    if (prior === undefined) delete process.env.DYNAMODB_TABLE;
    else process.env.DYNAMODB_TABLE = prior;
  });
});
