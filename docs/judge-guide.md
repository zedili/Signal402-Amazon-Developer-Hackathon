# Signal402 judge guide

Signal402 gives Alexa+ a non-custodial way to purchase x402-protected digital
resources without handing an agent unrestricted wallet authority.

## Try it in 90 seconds

1. Open the [public interactive demo](https://zedili.github.io/Signal402-Amazon-Developer-Hackathon/).
2. Click **Run**. The 6.50 USDC request exceeds the 5 USDC autonomous limit.
3. Click **Approve $6.50**. The server records the human decision but still
   cannot sign the payment.
4. Click **Sign with demo wallet**. Only a signed payload crosses the boundary;
   a private key never does.
5. Click **Verify & unlock resource**. The flow reaches `SETTLED`, displays a
   transaction receipt, and returns the protected climate-risk signal.

The hosted page is deliberately a deterministic in-browser simulation so it
requires no account, wallet, API key, or real funds. Run the repository locally
to exercise the same interface against the real REST service and state machine.

## What to inspect

- [`src/mcp.ts`](../src/mcp.ts): seven Alexa+-ready tools using MCP Streamable HTTP.
- [`src/payment-service.ts`](../src/payment-service.ts): explicit payment state
  transitions, idempotency, payload erasure, and audit events.
- [`src/x402.ts`](../src/x402.ts): x402 v2 discovery, verification, retry, and
  settlement receipt validation.
- [`src/security.ts`](../src/security.ts): outbound URL restrictions and SSRF
  defenses.
- [`src/store.ts`](../src/store.ts): in-memory and DynamoDB persistence with a
  hash-chained audit trail.
- [`infra/aws-apprunner.yaml`](../infra/aws-apprunner.yaml): App Runner,
  DynamoDB, Secrets Manager, IAM, health checks, and autoscaling.
- [`test/`](../test): 33 automated tests with enforced coverage thresholds.

## Why it fits Alexa+

The Alexa+ MCP surface does not expose a single `pay` shortcut. It decomposes
commerce into policy evaluation, intent creation, human decision, wallet
handoff, execution, status, and audit. That lets an agent orchestrate a
multi-turn purchase while every security boundary remains visible and testable.

## Safety boundary

The demo moves no real funds. Production-value use still requires a supported
wallet adapter, production facilitator verifier, user-scoped authorization,
WAF/rate-limit hardening, and an independent security review.
