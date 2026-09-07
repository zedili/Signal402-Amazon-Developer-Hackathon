import path from "node:path";

import { createMcpExpressApp } from "@modelcontextprotocol/express";
import { toNodeHandler } from "@modelcontextprotocol/node";
import type { ErrorRequestHandler, NextFunction, Request, Response } from "express";
import express from "express";
import helmet from "helmet";
import { ZodError } from "zod/v4";

import { createSignal402McpHandler } from "./mcp.js";
import { PaymentError, PaymentService } from "./payment-service.js";
import { createIntentSchema, decisionSchema, signatureSchema } from "./schemas.js";
import { safeEqual } from "./security.js";
import { createDefaultStore, type PaymentStore } from "./store.js";
import { CompositeResourceClient, createDefaultFacilitator, type FacilitatorClient, type ResourceClient } from "./x402.js";

export interface AppOptions {
  store?: PaymentStore;
  resourceClient?: ResourceClient;
  facilitator?: FacilitatorClient;
  apiKey?: string;
}

function asyncRoute(handler: (request: Request, response: Response) => Promise<void>) {
  return (request: Request, response: Response, next: NextFunction) => {
    void handler(request, response).catch(next);
  };
}

function intentId(request: Request): string {
  const value = request.params.id;
  if (typeof value !== "string") throw new PaymentError("Invalid payment intent id.");
  return value;
}

function createRateLimiter(limit = 120, windowMs = 60_000) {
  const buckets = new Map<string, { count: number; resetAt: number }>();
  return (request: Request, response: Response, next: NextFunction) => {
    const key = request.ip ?? "unknown";
    const now = Date.now();
    const current = buckets.get(key);
    const bucket = !current || current.resetAt <= now ? { count: 0, resetAt: now + windowMs } : current;
    bucket.count += 1;
    buckets.set(key, bucket);
    response.setHeader("RateLimit-Limit", String(limit));
    response.setHeader("RateLimit-Remaining", String(Math.max(0, limit - bucket.count)));
    if (bucket.count > limit) return response.status(429).json({ error: "rate_limit_exceeded" });
    next();
  };
}

export function createApp(options: AppOptions = {}) {
  const store = options.store ?? createDefaultStore();
  const service = new PaymentService(
    store,
    options.resourceClient ?? new CompositeResourceClient(),
    options.facilitator ?? createDefaultFacilitator()
  );
  const app = createMcpExpressApp();
  app.disable("x-powered-by");
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        imgSrc: ["'self'", "data:"],
        connectSrc: ["'self'"]
      }
    }
  }));
  app.use(express.json({ limit: "32kb" }));
  app.use(createRateLimiter());

  const apiKey = options.apiKey ?? process.env.SIGNAL402_API_KEY;
  app.use("/api", (request, response, next) => {
    if (request.method === "GET" || !apiKey) return next();
    const supplied = request.header("x-signal402-key") ?? "";
    if (!safeEqual(apiKey, supplied)) return response.status(401).json({ error: "invalid_api_key" });
    next();
  });

  app.get("/health", (_request, response) => {
    response.json({ ok: true, service: "signal402-payment-guard", version: "1.0.0", mode: "non-custodial" });
  });
  app.get("/api/intents", asyncRoute(async (_request, response) => {
    response.json({ intents: await service.list() });
  }));
  app.get("/api/intents/:id", asyncRoute(async (request, response) => {
    const intent = await service.get(intentId(request));
    if (!intent) throw new PaymentError("Payment intent not found.", 404);
    response.json(intent);
  }));
  app.get("/api/intents/:id/audit", asyncRoute(async (request, response) => {
    response.json({ events: await service.listAudit(intentId(request)) });
  }));
  app.post("/api/intents", asyncRoute(async (request, response) => {
    response.status(201).json(await service.create(createIntentSchema.parse(request.body)));
  }));
  app.post("/api/intents/:id/decision", asyncRoute(async (request, response) => {
    const input = decisionSchema.parse(request.body);
    response.json(await service.decide(intentId(request), input.decision, input.confirmedBy, input.reason));
  }));
  app.post("/api/intents/:id/signature", asyncRoute(async (request, response) => {
    const input = signatureSchema.parse(request.body);
    response.json(await service.submitSignature(intentId(request), input.paymentPayload));
  }));
  app.post("/api/intents/:id/execute", asyncRoute(async (request, response) => {
    response.json(await service.execute(intentId(request)));
  }));
  app.post("/api/demo/reset", asyncRoute(async (_request, response) => {
    await service.reset();
    response.status(204).send();
  }));

  const mcpNodeHandler = toNodeHandler(createSignal402McpHandler(service));
  app.all("/mcp", (request, response) => void mcpNodeHandler(request, response, request.body));

  const publicDirectory = path.resolve(process.cwd(), "public");
  app.use(express.static(publicDirectory, { extensions: ["html"], maxAge: "1h" }));
  app.get("/{*path}", (request, response, next) => {
    if (request.path.startsWith("/api") || request.path.startsWith("/mcp")) return next();
    response.sendFile(path.join(publicDirectory, "index.html"));
  });

  const errorHandler: ErrorRequestHandler = (error, _request, response, _next) => {
    if (error instanceof ZodError) {
      response.status(400).json({ error: "invalid_request", issues: error.issues });
      return;
    }
    const status = error instanceof PaymentError ? error.status : 500;
    response.status(status).json({
      error: status === 500 ? "internal_error" : "payment_error",
      message: error instanceof Error ? error.message : "Unexpected error"
    });
  };
  app.use(errorHandler);

  return { app, service, store };
}
