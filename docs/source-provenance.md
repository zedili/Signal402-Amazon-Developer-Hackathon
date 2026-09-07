# Source provenance and hackathon work boundary

## Pre-existing concept

Before the Amazon Developer Hackathon, Signal402 demonstrated a non-custodial
x402 payment gate for paid market-intelligence reports. That implementation is
maintained separately and is not copied into this repository.

## New work in this repository

This repository starts a new Alexa+-oriented product and implementation:

- Streamable HTTP MCP service using the current official TypeScript SDK.
- Human-defined payment budget and trusted-payee policy engine.
- Explicit approval boundary before wallet signing.
- Alexa+ simulated experience and persistent payment context.
- AWS App Runner deployment, DynamoDB persistence, Secrets Manager integration,
  CloudWatch logs, and hash-chained audit history.
- New tests, architecture diagrams, threat model, demo script, and product feedback.

All future commits should identify which Amazon track requirement or judging
criterion they advance. The final Devpost submission must disclose the earlier
Signal402 concept and clearly demonstrate the substantial new implementation.
