# Product friction log

These entries are formatted for the optional Devpost friction-log fields.

## 1. MCP version discovery

- **Task attempted:** Confirm the minimum MCP protocol version and transport for
  the Alexa+ track.
- **Steps:** Read the track overview, resources, and official rules; compared the
  stated version with the current TypeScript SDK packages.
- **Expected:** One canonical compatibility table connecting the Alexa+ track,
  protocol version, transport, and SDK release.
- **Actual:** The required protocol version was easy to find in the rules, but
  mapping it to SDK package entry points required moving between documentation.
- **Severity:** Medium.
- **Workaround:** Pinned the implementation to MCP Streamable HTTP and added an
  automated `tools/list` plus full tool-lifecycle test.
- **Suggestion:** Publish an Alexa+-specific MCP compatibility matrix with
  protocol version, SDK version, transport, sample client, and conformance test.

## 2. Simulated Alexa+ proof boundary

- **Task attempted:** Build a judge-accessible Alexa+ simulation while keeping
  the real MCP implementation independently inspectable.
- **Steps:** Implemented the real MCP server and REST workflow, then built a
  deterministic public browser adapter for a zero-setup judge demo.
- **Expected:** Clear guidance on exactly how simulations should distinguish
  simulated UI behavior from runtime MCP proof.
- **Actual:** The rules allow either path, but mixed projects need to infer how
  best to label which parts are simulated and which are real.
- **Severity:** Medium.
- **Workaround:** Added an explicit `PUBLIC JUDGE DEMO` label, a safety note,
  source links, and a judge guide pointing directly to runtime MCP code/tests.
- **Suggestion:** Provide a submission checklist for hybrid projects: required
  screen labels, recommended proof artifacts, and acceptable local MCP capture.

## 3. Public demo hosting

- **Task attempted:** Publish a static judge fallback from an existing GitHub
  Actions workflow.
- **Steps:** Added the Pages workflow, ran it, then enabled GitHub Actions as the
  repository's Pages publishing source.
- **Expected:** A workflow with Pages permissions would enable the site on its
  first run.
- **Actual:** The initial deployment failed until the publishing source was
  enabled once in repository settings.
- **Severity:** Low.
- **Workaround:** Enabled GitHub Actions in Pages settings and changed the
  workflow to redeploy on every push to `main`.
- **Suggestion:** Surface the required one-time repository setting prominently
  in deployment errors and static-site hackathon guidance.
