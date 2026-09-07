# Architecture and state machine

Signal402 is deliberately split across trust boundaries. Alexa+ can propose and
coordinate a purchase, but cannot silently gain custody of the user's wallet.

```mermaid
flowchart LR
  A[Alexa+ / MCP client] -->|create intent| G[Signal402 guard]
  G -->|initial GET| R[x402 resource]
  R -->|402 + PAYMENT-REQUIRED| G
  G --> P{Policy engine}
  P -->|over limit / new payee| H[Human approval UI]
  P -->|allowed| W[External wallet]
  H -->|approved| W
  W -->|signed payment payload only| G
  G -->|verify| F[x402 facilitator]
  G -->|retry + PAYMENT-SIGNATURE| R
  R -->|resource + PAYMENT-RESPONSE| G
  G --> D[(DynamoDB intents + audit)]
  G -->|result + receipt| A
```

The MCP surface uses Streamable HTTP at `/mcp`. The same service exposes a small
REST API for the simulated Alexa+ experience. In production, App Runner keeps
the long-lived HTTP transport available and DynamoDB persists intent/audit data.

## State machine

```mermaid
stateDiagram-v2
  [*] --> challenge_received: HTTP 402 validated
  challenge_received --> denied: budget exceeded / invalid policy
  challenge_received --> awaiting_approval: limit or trust boundary
  challenge_received --> awaiting_signature: policy allows
  awaiting_approval --> denied: human denies
  awaiting_approval --> awaiting_signature: human approves
  awaiting_signature --> signed: external wallet payload
  signed --> verifying: execute
  verifying --> failed: invalid payload / response / receipt
  verifying --> settled: receipt validated
  settled --> settled: idempotent replay
```

The stored object begins directly in the post-policy state; the
`challenge_received` transition is still recorded conceptually during creation
and the validated challenge is immutable within the intent.

## Important implementation decisions

- Amounts are represented as bounded decimal numbers in the prototype. A mainnet
  adapter should use asset base units (`bigint`) before handling real value.
- The demo resource and facilitator are deterministic local adapters. HTTPS
  resources use the same state machine and hardened outbound fetcher.
- A wallet adapter must create the payment payload client-side. Signal402 stores
  it only until execution, audits a digest, then removes the original.
- Audit records include the previous record hash. DynamoDB point-in-time recovery
  protects availability; a production system can anchor periodic roots on-chain.
