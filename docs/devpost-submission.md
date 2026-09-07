# Devpost submission draft

## Project name

Signal402 — Human control for Alexa+ agent payments

## Tagline

Your agent can pay. You stay in control.

## Inspiration

Agent commerce should not require handing an assistant an unrestricted wallet.
We wanted Alexa+ to purchase useful digital resources while preserving the
human boundaries people already understand: budgets, trusted merchants,
explicit approval, and a receipt.

## What it does

Signal402 is a non-custodial MCP payment guard. It discovers an HTTP 402
challenge, validates the exact x402 v2 terms, evaluates a user policy, pauses for
approval when necessary, accepts a payload signed in an external wallet,
verifies and retries the request, validates the settlement receipt, and records
every transition in a tamper-evident audit chain.

The repository includes a judge-ready Alexa+ simulator that runs this entire
flow without real funds. Its seven MCP tools expose the same state machine over
Streamable HTTP.

## How we built it

- TypeScript, Node.js, Express, Zod, and the official MCP TypeScript SDK v2
- x402 v2 challenge/receipt adapters with a safe zero-value demo implementation
- Explicit finite-state machine, idempotency keys, policy engine, and audit chain
- Responsive vanilla web experience simulating a multi-turn Alexa+ conversation
- AWS App Runner container deployment, DynamoDB persistence, Secrets Manager,
  CloudWatch logging, and least-privilege IAM through CloudFormation
- Vitest and Supertest coverage for policy, security, x402 validation, state
  transitions, idempotency, HTTP auth, and the full settlement path

## Challenges

The hard part was not sending a payment; it was making authorization durable
across a multi-turn agent workflow. We separated intent, policy, human decision,
wallet signature, facilitator verification, and settlement into states that can
be inspected and cannot be skipped.

## Accomplishments

- Complete 402-to-resource payment lifecycle with explicit safety boundaries
- No private key or seed phrase ever enters the service
- A runnable demonstration that explains why a payment paused
- Deployable AWS infrastructure and persistent, hash-chained audit history
- Fully open-source MIT repository with source provenance and threat model

## What we learned

MCP makes it easy to expose capabilities, but payment tools need more than a
function call. Human confirmation, idempotency, replay resistance, and receipt
validation must be first-class protocol states.

## What's next

We will replace the demo facilitator with a production x402 verifier, add a
wallet-standard adapter, use integer asset units, anchor audit roots on-chain,
and add user-scoped authorization through Amazon Cognito.

## Links to insert before final submission

- Public demo: pending AWS deployment
- Video (English, under 3 minutes): pending recording
- Repository: https://github.com/zedili/Signal402-Amazon-Developer-Hackathon

## Prior-work disclosure

The Signal402 concept previously appeared in a separate market-intelligence
prototype. This submission is a new implementation created for the Amazon
Developer Hackathon: Alexa+ MCP integration, payment state machine, policy and
human-approval workflow, simulated conversation, AWS deployment, DynamoDB audit
persistence, tests, and documentation. No source code was copied from the prior
repository.
