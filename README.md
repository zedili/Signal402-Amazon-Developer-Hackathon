# Signal402 Payment Guard for Alexa+

Signal402 Payment Guard is an Alexa+-ready Model Context Protocol (MCP) service
that helps autonomous agents pay for digital resources without receiving
unrestricted wallet authority.

The server evaluates each proposed payment against a human-defined budget,
trusted-payee list, and approval boundary. It can prepare an x402 payment plan,
but it never holds keys, signs transactions, or broadcasts payments itself.

## Amazon Developer Hackathon track

- Primary track: Alexa+
- Mini challenges: AWS Builder and Open Source (planned)
- Transport: Streamable HTTP at `/mcp`
- MCP SDK: official TypeScript SDK v2, compatible with the required 2025-11-25+
  protocol era
- Submission deadline: October 23, 2026 at 12:00 PM PDT

## Why this is more than an API wrapper

An ordinary payment tool gives an agent a wallet. Signal402 instead separates
intent, policy, approval, signing, and settlement. Alexa+ can coordinate a
multi-step purchase while the user retains the final authority for unfamiliar
payees or higher-value transactions.

## Current tools

- `evaluate_payment`: returns `approved`, `requires_approval`, or `denied` with
  an auditable explanation.
- `prepare_x402_payment`: produces a non-custodial x402 execution plan and stops
  at the wallet-signature boundary.

## Local development

```bash
npm install
npm run check
npm start
```

Health endpoint: `http://127.0.0.1:3000/health`

MCP endpoint: `http://127.0.0.1:3000/mcp`

List the available MCP tools:

```bash
curl -X POST http://127.0.0.1:3000/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

## Security position

- No seed phrases, private keys, or payment credentials enter the MCP server.
- Unknown payees and transactions over the autonomous limit require explicit
  human approval.
- Invalid, incomplete, or over-budget requests fail closed.
- A later integration will verify the full x402 challenge and settlement
  receipt before reporting success.

## Prior work and hackathon scope

The project is inspired by the pre-existing Signal402 market-intelligence
prototype. No source code has been copied from that repository into this
initial scaffold. The new Alexa+ MCP integration, payment-policy engine, human
approval workflow, AWS deployment, tests, and demonstration will be developed
for the Amazon Developer Hackathon. See
[`docs/source-provenance.md`](docs/source-provenance.md).

## License

MIT
