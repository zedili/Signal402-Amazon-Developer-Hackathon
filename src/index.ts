import { createMcpExpressApp } from "@modelcontextprotocol/express";
import { toNodeHandler } from "@modelcontextprotocol/node";
import { createMcpHandler, McpServer } from "@modelcontextprotocol/server";
import * as z from "zod/v4";

import { evaluatePaymentPolicy } from "./policy.js";

const handler = createMcpHandler(() => {
  const server = new McpServer({
    name: "signal402-payment-guard",
    version: "0.1.0"
  });

  server.registerTool(
    "evaluate_payment",
    {
      description:
        "Evaluate an agent-initiated payment against human-defined limits before any wallet signing or settlement occurs.",
      inputSchema: z.object({
        amount: z.number().positive(),
        dailySpent: z.number().nonnegative().default(0),
        currency: z.enum(["USD", "USDC"]).default("USDC"),
        purpose: z.string().min(1),
        payee: z.string().min(1),
        perTransactionLimit: z.number().positive().default(10),
        dailyLimit: z.number().positive().default(25),
        trustedPayees: z.array(z.string()).default([])
      })
    },
    async (input) => {
      const result = evaluatePaymentPolicy(input);
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        structuredContent: result
      };
    }
  );

  server.registerTool(
    "prepare_x402_payment",
    {
      description:
        "Prepare a safe, non-custodial x402 execution plan. This tool never signs or broadcasts a transaction.",
      inputSchema: z.object({
        resourceUrl: z.url(),
        amount: z.number().positive(),
        currency: z.enum(["USD", "USDC"]).default("USDC"),
        network: z.string().default("eip155:42161"),
        humanApproved: z.boolean().default(false)
      })
    },
    async ({ resourceUrl, amount, currency, network, humanApproved }) => {
      const plan = {
        status: humanApproved ? "ready_for_wallet_signature" : "awaiting_human_approval",
        resourceUrl,
        amount,
        currency,
        network,
        steps: [
          "request_resource",
          "validate_402_challenge",
          "apply_budget_and_payee_policy",
          "request_human_confirmation_if_needed",
          "sign_in_user_wallet",
          "retry_request_with_payment",
          "verify_settlement_receipt"
        ],
        custody: "none",
        broadcastPerformed: false
      };

      return {
        content: [{ type: "text", text: JSON.stringify(plan, null, 2) }],
        structuredContent: plan
      };
    }
  );

  return server;
});

const app = createMcpExpressApp();
const nodeHandler = toNodeHandler(handler);

app.get("/health", (_request, response) => {
  response.json({ ok: true, service: "signal402-payment-guard" });
});

app.all("/mcp", (request, response) => void nodeHandler(request, response, request.body));

const port = Number(process.env.PORT ?? 3000);
app.listen(port, "127.0.0.1", () => {
  console.log(`Signal402 MCP listening on http://127.0.0.1:${port}/mcp`);
});
