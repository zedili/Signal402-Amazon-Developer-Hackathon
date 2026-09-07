import request from "supertest";
import { describe, expect, it } from "vitest";

import { createApp } from "../src/app.js";

const body = {
  resourceUrl: "demo://premium-climate-risk-signal",
  amount: 6.5,
  currency: "USDC",
  purpose: "Premium climate-risk signal pack",
  payee: "0x4020000000000000000000000000000000002026",
  idempotencyKey: "integration-test-intent",
  policy: { perTransactionLimit: 5, dailyLimit: 25, dailySpent: 0, trustedPayees: [] }
};

describe("HTTP API", () => {
  it("serves the product and health endpoint with security headers", async () => {
    const { app } = createApp();
    const page = await request(app).get("/").expect(200);
    expect(page.text).toContain("Your agent can pay");
    expect(page.headers["content-security-policy"]).toContain("default-src 'self'");
    const health = await request(app).get("/health").expect(200);
    expect(health.body).toMatchObject({ ok: true, version: "1.0.0" });
  });

  it("protects mutations when an API key is configured", async () => {
    const { app } = createApp({ apiKey: "test-secret" });
    await request(app).post("/api/intents").send(body).expect(401);
    await request(app).post("/api/intents").set("x-signal402-key", "test-secret").send(body).expect(201);
  });

  it("runs the public demo lifecycle", async () => {
    const { app } = createApp({ apiKey: "" });
    const created = await request(app).post("/api/intents").send(body).expect(201);
    const id = created.body.id;
    await request(app).post(`/api/intents/${id}/decision`).send({ decision: "approved", confirmedBy: "integration-user" }).expect(200);
    await request(app).post(`/api/intents/${id}/signature`).send({ paymentPayload: "demo_x402:abcdefghijklmnop" }).expect(200);
    const settled = await request(app).post(`/api/intents/${id}/execute`).send({}).expect(200);
    expect(settled.body.state).toBe("settled");
    expect(settled.body.resource.signal).toContain("logistics disruption");
    const audit = await request(app).get(`/api/intents/${id}/audit`).expect(200);
    expect(audit.body.events).toHaveLength(5);
  });
});
