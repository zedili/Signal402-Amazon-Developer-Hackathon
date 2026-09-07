# Product feedback for Amazon

## What worked well

- The Alexa+ track correctly treats MCP as an open interoperability boundary,
  allowing a focused safety service instead of a monolithic assistant demo.
- Requiring Streamable HTTP encourages deployable services rather than a local
  stdio-only prototype.
- The AWS and Open Source mini challenges align with what makes an MCP server
  credible: hosting, observability, documentation, and reproducibility.

## Friction encountered

- The track language names a minimum MCP protocol date, while the current
  TypeScript SDK exposes product packages rather than a single obvious
  “protocol-date switch.” A short compatibility matrix would reduce ambiguity.
- Alexa+ access and regional availability can be a gating dependency for teams.
  The simulated-experience option is important and should remain prominent.
- A canonical example of Alexa+ calling a stateful, multi-turn approval MCP
  workflow would help teams avoid treating MCP as a one-shot function wrapper.

## Suggested improvements

1. Publish a minimal Alexa+ + remote Streamable HTTP MCP starter with auth,
   health checks, and tool-result schemas.
2. Provide an automated pre-submission validator for protocol version, public
   endpoint reachability, and required repository fields.
3. Add guidance for high-impact tools—payments, messaging, or account changes—
   covering confirmation UX, idempotency, and auditable state transitions.
4. Offer temporary AWS credits and a sandbox Alexa+ environment at registration
   time so every region can test the same integration path.
