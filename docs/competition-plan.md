# Amazon Developer Hackathon plan

## Target categories

1. Alexa+ primary track
2. AWS Builder mini challenge
3. Open Source mini challenge

## Milestones

- [x] Create standalone repository and provenance boundary.
- [x] Add a working Streamable HTTP MCP server.
- [x] Add deterministic payment-policy tests.
- [ ] Implement complete x402 challenge validation and receipt verification.
- [ ] Add persistent policy and audit storage on AWS.
- [ ] Build the simulated Alexa+ conversational experience.
- [ ] Add human approval and wallet-signature handoff.
- [ ] Deploy a judge-accessible endpoint.
- [ ] Produce architecture diagram and threat model.
- [ ] Record an English demo under three minutes.
- [ ] Write product feedback and friction log.

## Judging strategy

- Technical implementation: show real MCP calls, policy decisions, x402
  challenge validation, and AWS observability.
- Design: make approval prompts concise and explain why a payment was stopped.
- Impact: demonstrate safe agent commerce without giving an assistant custody.
- Originality: focus on persistent, context-aware purchasing policies instead
  of a single-turn payment wrapper.
