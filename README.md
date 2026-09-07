# Signal402 Payment Guard for Alexa+

Signal402 lets an Alexa+ agent buy an x402-protected digital resource while the
human keeps control of budget, approval, and wallet signing. It is a complete,
non-custodial reference implementation: MCP tools, HTTP API, conversational
simulator, state machine, x402 v2 validation, hash-chained audit log, DynamoDB
persistence, and an AWS App Runner deployment template.

**Live flow:** HTTP 402 → pin payment terms → apply policy → request approval →
accept an externally signed wallet payload → verify → retry → validate receipt.

> The bundled demo runs against a deterministic test resource and moves no real
> funds. Production mode accepts HTTPS x402 resources and externally signed
> payloads; the service never receives a seed phrase or private key.

## Amazon Developer Hackathon 2026

- Primary track: Alexa+
- Mini challenges: AWS Builder and Open Source
- MCP transport: Streamable HTTP at `/mcp`
- MCP SDK: official TypeScript SDK v2
- Public license: MIT
- Repository: https://github.com/zedili/Signal402-Amazon-Developer-Hackathon
- Zero-value public demo: https://cdn.jsdelivr.net/gh/zedili/Signal402-Amazon-Developer-Hackathon@main/public/index.html

## Try the end-to-end demo

```bash
npm install
npm run check
npm start
```

Open http://localhost:3000 and click **Run**. Approve the policy exception, sign
with the in-browser demo wallet, and settle to unlock the protected result.

The demo deliberately requests 6.50 USDC against a 5 USDC autonomous limit so
the human-approval boundary is visible. Resetting clears the local in-memory
session.

## MCP tools

| Tool | Purpose |
| --- | --- |
| `evaluate_payment` | Explain whether a proposed payment is allowed, denied, or needs approval. |
| `create_payment_intent` | Discover/validate the 402 challenge and create an idempotent intent. |
| `record_human_decision` | Record explicit approval or denial. |
| `submit_wallet_payment` | Accept a wallet-signed payload; never a private key. |
| `execute_payment` | Verify, retry the resource, validate receipt, and return protected data. |
| `get_payment_intent` | Read current state and settlement result. |
| `list_payment_audit` | Read the tamper-evident event chain. |

List tools with an MCP client or:

```bash
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

## REST integration

Mutating endpoints can be protected with `SIGNAL402_API_KEY`. The browser demo
is intentionally keyless when that variable is absent. Set it for every public
deployment and send it as `x-signal402-key` from a trusted backend.

```bash
curl -X POST http://localhost:3000/api/intents \
  -H "Content-Type: application/json" \
  -H "x-signal402-key: $SIGNAL402_API_KEY" \
  -d '{
    "resourceUrl":"demo://premium-climate-risk-signal",
    "amount":6.5,
    "currency":"USDC",
    "purpose":"Premium climate-risk signal pack",
    "payee":"0x4020000000000000000000000000000000002026",
    "idempotencyKey":"purchase-2026-001",
    "policy":{"perTransactionLimit":5,"dailyLimit":25,"dailySpent":0,"trustedPayees":[]}
  }'
```

## Security properties

- Strict state transitions and idempotency prevent duplicate execution.
- The server pins amount, payee, resource, network, scheme, and timeout from an
  x402 v2 challenge before presenting it to a wallet.
- HTTPS-only fetching blocks loopback, private, link-local, metadata, credential
  URLs, and redirects to reduce SSRF risk.
- Payment payloads are length-bounded, hashed for audit, and erased after use.
- Audit events are chained with SHA-256; DynamoDB can persist them in production.
- Helmet CSP/security headers, JSON size limits, optional API-key authentication,
  and per-IP rate limiting protect the public surface.

See [the threat model](docs/threat-model.md) and [architecture](docs/architecture.md).

## AWS deployment

Build and push the included container to Amazon ECR, then deploy
`infra/aws-apprunner.yaml`. The stack creates an App Runner service, DynamoDB
table, least-privilege instance role, generated API secret, health check, and
autoscaling policy.

```bash
docker build -t signal402 .
aws cloudformation deploy \
  --template-file infra/aws-apprunner.yaml \
  --stack-name signal402 \
  --capabilities CAPABILITY_NAMED_IAM \
  --parameter-overrides ImageIdentifier=ACCOUNT.dkr.ecr.REGION.amazonaws.com/signal402:latest
```

Operational details are in [docs/deployment.md](docs/deployment.md).

## Documentation

- [Architecture and state machine](docs/architecture.md)
- [Threat model](docs/threat-model.md)
- [Three-minute demo script](docs/demo-script.md)
- [Devpost submission draft](docs/devpost-submission.md)
- [Product feedback](docs/product-feedback.md)
- [Source provenance](docs/source-provenance.md)

## License

MIT
