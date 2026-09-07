import { createMcpHandler, McpServer } from "@modelcontextprotocol/server";
import * as z from "zod/v4";

import type { PaymentService } from "./payment-service.js";
import { evaluatePaymentPolicy } from "./policy.js";
import { createIntentSchema, evaluateSchema } from "./schemas.js";

function toolResult(value: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }],
    structuredContent: value as Record<string, unknown>
  };
}

export function createSignal402McpHandler(service: PaymentService) {
  return createMcpHandler(() => {
    const server = new McpServer({ name: "signal402-payment-guard", version: "1.0.0" });

    server.registerTool("evaluate_payment", {
      description: "Evaluate an agent payment against human-defined budgets and a trusted-payee policy before signing.",
      inputSchema: evaluateSchema
    }, async (input) => toolResult(evaluatePaymentPolicy(input)));

    server.registerTool("create_payment_intent", {
      description: "Discover and validate an x402 challenge, apply policy, and create an auditable non-custodial payment intent.",
      inputSchema: createIntentSchema
    }, async (input) => toolResult(await service.create(input)));

    server.registerTool("record_human_decision", {
      description: "Record an explicit human approve/deny decision for an intent that requires confirmation.",
      inputSchema: z.object({
        intentId: z.uuid(),
        decision: z.enum(["approved", "denied"]),
        confirmedBy: z.string().min(2),
        reason: z.string().optional()
      })
    }, async ({ intentId, decision, confirmedBy, reason }) =>
      toolResult(await service.decide(intentId, decision, confirmedBy, reason)));

    server.registerTool("submit_wallet_payment", {
      description: "Attach a payment payload signed outside this server. Signal402 never receives or stores a private key.",
      inputSchema: z.object({ intentId: z.uuid(), paymentPayload: z.string().min(20).max(16_384) })
    }, async ({ intentId, paymentPayload }) => toolResult(await service.submitSignature(intentId, paymentPayload)));

    server.registerTool("execute_payment", {
      description: "Verify a signed payment, retry the protected resource request, validate the receipt, and return the result.",
      inputSchema: z.object({ intentId: z.uuid() })
    }, async ({ intentId }) => toolResult(await service.execute(intentId)));

    server.registerTool("get_payment_intent", {
      description: "Read the current state and receipt of a payment intent.",
      inputSchema: z.object({ intentId: z.uuid() })
    }, async ({ intentId }) => toolResult((await service.get(intentId)) ?? { error: "not_found" }));

    server.registerTool("list_payment_audit", {
      description: "List tamper-evident audit events for a payment intent.",
      inputSchema: z.object({ intentId: z.uuid().optional() })
    }, async ({ intentId }) => toolResult({ events: await service.listAudit(intentId) }));

    return server;
  });
}
