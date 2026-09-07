const elements = {
  start: document.querySelector("#start-button"), reset: document.querySelector("#reset-button"),
  approve: document.querySelector("#approve-button"), deny: document.querySelector("#deny-button"),
  wallet: document.querySelector("#wallet-button"), settle: document.querySelector("#settle-button"),
  conversation: document.querySelector("#conversation"), empty: document.querySelector("#empty-state"),
  intent: document.querySelector("#intent-view"), approvalActions: document.querySelector("#approval-actions"),
  stateLabel: document.querySelector("#state-label"), stateDot: document.querySelector("#state-dot"),
  policy: document.querySelector("#policy-result"), receipt: document.querySelector("#receipt"),
  transaction: document.querySelector("#transaction"), payee: document.querySelector("#payee")
};

let currentIntent;
const staticMode = location.hostname.endsWith("github.io");
const demoInput = {
  resourceUrl: "demo://premium-climate-risk-signal",
  amount: 6.5,
  currency: "USDC",
  purpose: "Premium climate-risk signal pack",
  payee: "0x4020000000000000000000000000000000002026",
  policy: { perTransactionLimit: 5, dailyLimit: 25, dailySpent: 0, trustedPayees: [] }
};

async function api(path, options = {}) {
  if (staticMode) return staticApi(path, options);
  const response = await fetch(path, { ...options, headers: { "Content-Type": "application/json", ...options.headers } });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || `Request failed (${response.status})`);
  }
  return response.status === 204 ? undefined : response.json();
}

async function staticApi(path, options) {
  await new Promise(resolve => setTimeout(resolve, 180));
  const payload = options.body ? JSON.parse(options.body) : {};
  if (path === "/api/demo/reset") return;
  if (path === "/api/intents") {
    return {
      id: crypto.randomUUID(), state: "awaiting_approval", ...payload,
      challenge: { network: "eip155:84532", scheme: "exact", x402Version: 2 },
      policy: { ...payload.policy, decision: "requires_approval", requiresHumanConfirmation: true }
    };
  }
  if (path.endsWith("/decision")) return { ...currentIntent, state: payload.decision === "approved" ? "awaiting_signature" : "denied", approval: payload };
  if (path.endsWith("/signature")) return { ...currentIntent, state: "signed" };
  if (path.endsWith("/execute")) return {
    ...currentIntent, state: "settled",
    receipt: { success: true, transaction: `0x${crypto.randomUUID().replaceAll("-", "").padEnd(64, "0")}`, network: "eip155:84532" },
    resource: { signal: "Coastal logistics disruption risk is elevated for the next 72 hours.", confidence: 0.87 }
  };
  throw new Error("Unsupported static demo action");
}

function message(actor, text, kind = "alexa") {
  const node = document.createElement("div");
  node.className = `message ${kind}`;
  node.innerHTML = `<div class="avatar">${actor[0]}</div><div><span>${actor}</span><p></p></div>`;
  node.querySelector("p").textContent = text;
  elements.conversation.append(node);
  elements.conversation.scrollTop = elements.conversation.scrollHeight;
}

function shorten(value) { return `${value.slice(0, 6)}…${value.slice(-4)}`; }

function render(intent) {
  currentIntent = intent;
  elements.empty.classList.add("hidden");
  elements.intent.classList.remove("hidden");
  elements.stateLabel.textContent = intent.state.replaceAll("_", " ").toUpperCase();
  elements.payee.textContent = shorten(intent.payee);
  elements.approvalActions.classList.toggle("hidden", intent.state !== "awaiting_approval");
  elements.wallet.classList.toggle("hidden", intent.state !== "awaiting_signature");
  elements.settle.classList.toggle("hidden", intent.state !== "signed");
  elements.receipt.classList.toggle("hidden", intent.state !== "settled");
  elements.policy.classList.toggle("hidden", !["awaiting_approval", "denied"].includes(intent.state));
  const settled = intent.state === "settled";
  elements.stateDot.style.background = settled ? "var(--green)" : intent.state === "denied" ? "var(--red)" : "var(--orange)";
  elements.stateLabel.style.color = settled ? "var(--green)" : intent.state === "denied" ? "var(--red)" : "var(--orange)";
  if (intent.receipt) elements.transaction.textContent = shorten(intent.receipt.transaction);
}

async function runDemo() {
  elements.start.disabled = true;
  message("You", "Buy the premium climate-risk signal.", "user");
  message("Alexa+", "The provider returned HTTP 402. I’m asking Signal402 to validate the terms and check your rules.");
  try {
    const intent = await api("/api/intents", {
      method: "POST",
      body: JSON.stringify({ ...demoInput, idempotencyKey: `demo-${crypto.randomUUID()}` })
    });
    render(intent);
    message("Signal402", "Price and payee match the challenge. $6.50 is above the $5 auto-pay limit, so I paused for your approval.", "system");
  } catch (error) { message("Signal402", error.message, "system"); elements.start.disabled = false; }
}

async function decide(decision) {
  const intent = await api(`/api/intents/${currentIntent.id}/decision`, {
    method: "POST", body: JSON.stringify({ decision, confirmedBy: "demo-user", reason: "Explicit simulator choice" })
  });
  render(intent);
  if (decision === "approved") message("Alexa+", "Approved. Your wallet still needs to sign the exact x402 payload—Signal402 cannot access its private key.");
  else message("Signal402", "Payment denied. Nothing was signed or sent.", "system");
}

async function sign() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const payload = `demo_x402:${Array.from(bytes, byte => byte.toString(16).padStart(2, "0")).join("")}`;
  const intent = await api(`/api/intents/${currentIntent.id}/signature`, { method: "POST", body: JSON.stringify({ paymentPayload: payload }) });
  render(intent);
  message("Wallet", "Signed the price, payee, resource, and network. The private key never left this browser.", "system");
}

async function settle() {
  elements.settle.disabled = true;
  try {
    const intent = await api(`/api/intents/${currentIntent.id}/execute`, { method: "POST", body: "{}" });
    render(intent);
    message("Alexa+", `Payment verified. The protected result says: “${intent.resource.signal}”`);
  } catch (error) { message("Signal402", error.message, "system"); }
}

async function reset() {
  await api("/api/demo/reset", { method: "POST", body: "{}" });
  currentIntent = undefined;
  elements.intent.classList.add("hidden"); elements.empty.classList.remove("hidden");
  elements.start.disabled = false; elements.settle.disabled = false;
  elements.conversation.innerHTML = '<div class="message alexa"><div class="avatar">A</div><div><span>Alexa+</span><p>I can purchase the premium climate-risk signal you requested. Signal402 will check it before anything is signed.</p></div></div>';
}

elements.start.addEventListener("click", () => void runDemo());
elements.approve.addEventListener("click", () => void decide("approved"));
elements.deny.addEventListener("click", () => void decide("denied"));
elements.wallet.addEventListener("click", () => void sign());
elements.settle.addEventListener("click", () => void settle());
elements.reset.addEventListener("click", () => void reset());

if (staticMode) {
  const healthLink = document.querySelector("#health-link");
  healthLink.textContent = "View service source";
  healthLink.href = "https://github.com/zedili/Signal402-Amazon-Developer-Hackathon/tree/main/src";
}
