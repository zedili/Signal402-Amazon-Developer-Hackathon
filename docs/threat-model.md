# Threat model

## Protected assets

- User funds and wallet authorization
- Human-defined spending policy
- Integrity of x402 price/payee/resource terms
- Payment intent idempotency and settlement receipts
- Purchased resource data and audit history

## Trust boundaries

Alexa+/MCP clients, web browsers, wallets, resource servers, facilitators, and
AWS are separate principals. Signal402 trusts no external challenge or payload
until it has been parsed and pinned to the intent. It never trusts a conversational
statement as proof of human approval.

| Threat | Control in this repository | Residual risk / production follow-up |
| --- | --- | --- |
| Agent spends outside user intent | Per-transaction/daily limits, payee allowlist, explicit approval state | Add user identity and signed policy versions. |
| Price/payee substitution | Exact match of amount, payee, resource, scheme, network, timeout | Use integer base units and wallet-side re-display. |
| Duplicate charge / replay | Client idempotency key and terminal-state idempotence | Use facilitator nonce and on-chain replay checks. |
| Server steals wallet key | Server accepts only an external payment payload; payload erased after execution | Independently audit wallet adapter. |
| SSRF to local/cloud metadata | HTTPS only; blocks loopback/private/link-local/metadata/credentials and redirects | Add DNS-resolution pinning against rebinding. |
| Forged resource receipt | Receipt presence, success, and network validation | Verify facilitator/merchant signatures cryptographically. |
| Audit alteration | SHA-256 previous-hash chain and DynamoDB PITR | Anchor roots externally and restrict operator access. |
| API abuse | Optional constant-time API-key check, body limit, CSP/headers, IP rate limit | Use Cognito/IAM auth and AWS WAF for public production. |
| Sensitive payload leakage | Logs contain digest/redacted preview; stored payload removed after use | Encrypt transient values and add log scanning. |
| Supply-chain compromise | Lockfile, minimal runtime image, non-root user, CI tests | Add Dependabot, SBOM, image signing, and scanning. |

## Fail-closed behavior

Invalid challenges, mismatched terms, unsafe URLs, invalid state transitions,
bad wallet payloads, non-2xx paid responses, and malformed receipts stop the
flow. Failures become terminal and are audited rather than automatically retried.

## Explicit demo boundary

`demo://` and `demo_x402:` exist only to make the full judge experience runnable
without funds. They are visibly labeled TESTNET in the UI. A deployment that
handles real value must replace `DemoFacilitatorClient` with a production x402
facilitator verifier and add a real wallet adapter.
