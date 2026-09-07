import request from "supertest";
import { describe, expect, it } from "vitest";

import { createApp } from "../src/app.js";

const mcpHeaders = { Accept: "application/json, text/event-stream" };

function parseSse(response: request.Response) {
  const data = response.text.split("\n").find((line) => line.startsWith("data: "));
  if (!data) throw new Error("Missing MCP SSE data event");
  return JSON.parse(data.slice(6));
}

async function call(app: ReturnType<typeof createApp>["app"], method: string, params: Record<string, unknown>) {
  const response = await request(app)
    .post("/mcp")
    .set(mcpHeaders)
    .send({ jsonrpc: "2.0", id: crypto.randomUUID(), method, params })
    .expect(200);
  return parseSse(response);
}

const intentInput = {
  resourceUrl: "demo://premium-climate-risk-signal",
  amount: 6.5,
  currency: "USDC",
  purpose: "Premium climate-risk signal pack",
  payee: "0x4020000000000000000000000000000000002026",
  idempotencyKey: "mcp-integration-intent",
  policy: { perTransactionLimit: 5, dailyLimit: 25, dailySpent: 0, trustedPayees: [] }
};

describe("MCP Streamable HTTP surface", () => {
  it("lists all seven tools and evaluates policy", async () => {
    const { app } = createApp({ apiKey: "" });
    const listed = await call(app, "tools/list", {});
    expect(listed.result.tools).toHaveLength(7);
    expect(listed.result.tools.map((tool: { name: string }) => tool.name)).toContain("execute_payment");

    const evaluated = await call(app, "tools/call", {
      name: "evaluate_payment",
      arguments: {
        amount: 1, dailySpent: 0, purpose: "test data", payee: "trusted.example",
        trustedPayees: ["trusted.example"], perTransactionLimit: 5, dailyLimit: 10
      }
    });
    expect(evaluated.result.structuredContent.decision).toBe("approved");
  });

  it("runs the entire payment lifecycle through MCP tools", async () => {
    const { app } = createApp({ apiKey: "" });
    const created = await call(app, "tools/call", { name: "create_payment_intent", arguments: intentInput });
    const id = created.result.structuredContent.id;
    expect(created.result.structuredContent.state).toBe("awaiting_approval");

    const approved = await call(app, "tools/call", {
      name: "record_human_decision",
      arguments: { intentId: id, decision: "approved", confirmedBy: "mcp-test-user" }
    });
    expect(approved.result.structuredContent.state).toBe("awaiting_signature");

    const signed = await call(app, "tools/call", {
      name: "submit_wallet_payment",
      arguments: { intentId: id, paymentPayload: "demo_x402:abcdefghijklmnop" }
    });
    expect(signed.result.structuredContent.state).toBe("signed");

    const settled = await call(app, "tools/call", { name: "execute_payment", arguments: { intentId: id } });
    expect(settled.result.structuredContent.state).toBe("settled");

    const fetched = await call(app, "tools/call", { name: "get_payment_intent", arguments: { intentId: id } });
    expect(fetched.result.structuredContent.receipt.success).toBe(true);
    const audit = await call(app, "tools/call", { name: "list_payment_audit", arguments: { intentId: id } });
    expect(audit.result.structuredContent.events).toHaveLength(5);
  });
});
