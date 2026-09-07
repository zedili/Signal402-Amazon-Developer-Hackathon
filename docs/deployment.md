# AWS deployment runbook

## Prerequisites

- An AWS account with ECR, CloudFormation, App Runner, DynamoDB, IAM, and Secrets
  Manager permissions
- AWS CLI and Docker
- A private ECR repository named `signal402`

## Build and publish

```bash
aws ecr get-login-password --region us-east-1 | \
  docker login --username AWS --password-stdin ACCOUNT.dkr.ecr.us-east-1.amazonaws.com
docker build -t signal402 .
docker tag signal402:latest ACCOUNT.dkr.ecr.us-east-1.amazonaws.com/signal402:latest
docker push ACCOUNT.dkr.ecr.us-east-1.amazonaws.com/signal402:latest
```

## Create the stack

```bash
aws cloudformation deploy \
  --region us-east-1 \
  --template-file infra/aws-apprunner.yaml \
  --stack-name signal402 \
  --capabilities CAPABILITY_NAMED_IAM \
  --parameter-overrides ImageIdentifier=ACCOUNT.dkr.ecr.us-east-1.amazonaws.com/signal402:latest
```

Read the `ServiceUrl` and `McpUrl` outputs. App Runner terminates TLS, probes
`/health`, and streams container logs to CloudWatch. The container receives the
DynamoDB table name and an API key through an AWS Secrets Manager reference.

## Post-deployment checks

1. `GET /health` returns `ok: true` and version `1.0.0`.
2. MCP `tools/list` returns seven tools over Streamable HTTP.
3. An authenticated demo intent survives a service restart.
4. The DynamoDB table has point-in-time recovery enabled.
5. CloudWatch logs do not contain a payment payload or API key.

## Current production caveats

The CloudFormation template is deployable, but real-value use additionally
requires a production facilitator verifier, wallet adapter, WAF, user-scoped
authorization, and a security review. The included public web demo intentionally
uses a zero-value local adapter.

## Static judge fallback

The `pages.yml` workflow publishes `public/` to GitHub Pages. On `github.io`, the
same interface uses an in-browser deterministic adapter so judges can complete
the interaction even when no AWS service is running. This fallback is clearly
labeled TESTNET and does not pretend to be the MCP backend; local/AWS mode calls
the real REST API and payment state machine.
