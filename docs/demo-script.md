# Three-minute English demo script

Target length: 2:35–2:50, leaving margin below the three-minute limit.

## 0:00–0:25 — Problem

“AI agents are increasingly able to discover and purchase digital resources.
But giving an assistant unrestricted wallet authority is a dangerous shortcut.
Signal402 is a policy and approval layer for Alexa+ that keeps every agent
payment non-custodial, bounded, and auditable.”

## 0:25–1:40 — Live flow

1. Show the home page and click **Run**.
2. Point out the simulated Alexa+ request and the validated HTTP 402 challenge.
3. Show that 6.50 USDC is above the 5 USDC autonomous limit.
4. Click **Approve $6.50**.
5. Explain that Signal402 still cannot sign; click **Sign with demo wallet**.
6. Click **Verify & unlock resource** and show the transaction receipt and
   protected climate-risk signal.

Narration: “The agent asks for a paid climate-risk feed. Signal402 pins the
resource, price, payee, network, and timeout from the x402 v2 challenge. Because
the amount crosses my policy boundary, the state machine pauses. I approve, but
the private key stays in my wallet. Signal402 receives only a signed payment
payload, verifies it, retries the resource, validates the settlement receipt,
and returns the paid result.”

## 1:40–2:20 — Alexa+ MCP and safety

Show the README tool table and architecture diagram.

“Alexa+ connects through the official TypeScript MCP SDK using Streamable HTTP.
Seven focused tools cover policy, intent creation, human decision, wallet
handoff, execution, status, and audit. Invalid transitions fail closed.
Idempotency prevents duplicate execution, outbound fetches block private and
metadata endpoints, and raw payment payloads are removed after use.”

## 2:20–2:45 — AWS and close

Show the AWS diagram or CloudFormation file.

“The same container deploys to AWS App Runner. DynamoDB persists intents and the
hash-chained audit trail, Secrets Manager provides the API credential, and the
service runs with a least-privilege role. Signal402 gives Alexa+ a safe path to
agent commerce: your agent can pay, and you stay in control.”

End on the settled receipt and GitHub URL.
