# Security policy

Please do not open a public issue for a vulnerability. Send a private GitHub
security advisory to the repository owner with reproduction steps, impact, and
a proposed mitigation if available.

Signal402 is a hackathon reference implementation, not audited financial
software. Use test networks and test assets until the facilitator, wallet
adapter, resource provider, and deployed policy configuration have received an
independent security review.

The service must never receive a seed phrase or private key. A production wallet
integration should sign the exact challenge in the user's wallet and submit only
the resulting x402 payment payload.
