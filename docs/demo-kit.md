# Demo recording and submission kit

## Final video target

- Length: 2:35–2:50; never exceed 3:00.
- Language: English narration and English UI.
- Format: 1920×1080, 30 fps, H.264 MP4.
- Capture: browser at 100% zoom; disable notifications and hide bookmarks.
- Cursor: move slowly and pause on each state change.
- Audio: record narration separately if possible, then normalize it before export.

## Shot list

| Time | Visual | Narration goal |
| --- | --- | --- |
| 0:00–0:12 | Hero and tagline | Establish the unrestricted-agent-wallet problem. |
| 0:12–0:30 | Public demo, click **Run** | Show Alexa+ discovering a paid resource. |
| 0:30–0:55 | `AWAITING APPROVAL` and policy card | Explain pinned terms and the 5 USDC limit. |
| 0:55–1:15 | Approve, then wallet-sign | Show that approval is not a signature and the key stays local. |
| 1:15–1:30 | Settle and reveal result | Show receipt plus protected data. |
| 1:30–1:52 | `src/mcp.ts` tool registration | Prove real MCP Streamable HTTP integration. |
| 1:52–2:15 | State machine and test output | Explain fail-closed transitions, idempotency, and payload erasure. |
| 2:15–2:34 | AWS architecture/template | Show the deployable App Runner and DynamoDB path. |
| 2:34–2:45 | Return to settled UI and repository | Close on the value proposition and open-source link. |

Use the exact narration in [`demo-script.md`](demo-script.md). Do not spend video
time on installation, scrolling through the README, or terminal typing.

## YouTube/Vimeo metadata

**Title**

> Signal402 — Human-Controlled Alexa+ Agent Payments | Amazon Developer Hackathon 2026

**Description**

> Signal402 is a non-custodial MCP payment guard for Alexa+. It validates x402
> payment terms, applies user budgets and trusted-payee rules, pauses for human
> approval, keeps private keys in the wallet, verifies settlement, and records a
> tamper-evident audit trail.
>
> Interactive demo: https://zedili.github.io/Signal402-Amazon-Developer-Hackathon/
> Source: https://github.com/zedili/Signal402-Amazon-Developer-Hackathon
>
> Built for the Alexa+ primary track and the Open Source mini challenge in the
> Amazon Developer Hackathon 2026. The demonstration uses test data and moves no
> real funds.

**Thumbnail copy**

> YOUR AGENT CAN PAY
> YOU STAY IN CONTROL

Use [`public/social-card.png`](../public/social-card.png) as the ready-to-upload
1280×720 thumbnail. The editable vector source is
[`public/social-card.svg`](../public/social-card.svg).

## Required capture checklist

- `AWAITING APPROVAL` with 6.50 USDC and 5.00 USDC auto-pay limit visible.
- `AWAITING SIGNATURE` after explicit human approval.
- `SIGNED` before settlement.
- `SETTLED`, transaction receipt, and protected result.
- MCP `tools/list` showing all seven tools.
- Passing CI badge or 33-test output.
- AWS CloudFormation resources.
- Repository license and public URL.

## Devpost upload order

1. Upload the under-three-minute public English video.
2. Paste the public demo and repository URLs.
3. Use the copy from [`devpost-submission.md`](devpost-submission.md).
4. Paste product feedback from [`product-feedback.md`](product-feedback.md).
5. Add the entries from [`friction-log.md`](friction-log.md).
6. Select Alexa+ as the primary track and Open Source as a mini challenge.
7. Select AWS Builder only after a real AWS deployment has been completed and
   captured; the current repository contains deployable infrastructure but no
   public proof of a live AWS runtime.
