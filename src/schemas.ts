import * as z from "zod/v4";

export const createIntentSchema = z.object({
  resourceUrl: z.string().min(1),
  amount: z.number().positive().max(10_000),
  currency: z.enum(["USD", "USDC"]).default("USDC"),
  purpose: z.string().trim().min(3).max(240),
  payee: z.string().trim().min(3).max(200),
  idempotencyKey: z.string().trim().min(8).max(128),
  policy: z.object({
    perTransactionLimit: z.number().positive().max(10_000).default(5),
    dailyLimit: z.number().positive().max(100_000).default(25),
    dailySpent: z.number().nonnegative().max(100_000).default(0),
    trustedPayees: z.array(z.string().min(1).max(200)).max(100).default([])
  })
});

export const decisionSchema = z.object({
  decision: z.enum(["approved", "denied"]),
  confirmedBy: z.string().trim().min(2).max(100),
  reason: z.string().trim().max(240).optional()
});

export const signatureSchema = z.object({
  paymentPayload: z.string().min(20).max(16_384)
});

export const evaluateSchema = z.object({
  amount: z.number().positive(),
  dailySpent: z.number().nonnegative().default(0),
  currency: z.enum(["USD", "USDC"]).default("USDC"),
  purpose: z.string().min(1),
  payee: z.string().min(1),
  perTransactionLimit: z.number().positive().default(10),
  dailyLimit: z.number().positive().default(25),
  trustedPayees: z.array(z.string()).default([])
});
