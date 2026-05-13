import { z } from "zod";

// Raw shape of one provider entry returned by
//   codexbar usage --format json --provider all
//
// Everything is .passthrough() + every field optional — codexbar is a third
// party tool and we never want a CLI shape change to crash the daemon. The
// daemon normalizes this into shared/messages.SubscriptionProviderCostSchema
// before broadcasting.
//
// Two top-level shapes are possible per provider:
//   1. Success: has `usage` (and optionally `credits`, `version`).
//   2. Error:   has `error: { code, kind, message }`. No `usage`.

const RawQuotaWindowSchema = z
  .object({
    usedPercent: z.number().optional(),
    windowMinutes: z.number().optional(),
    resetsAt: z.string().optional(),
    resetDescription: z.string().optional(),
  })
  .passthrough();

const RawExtraRateWindowSchema = z
  .object({
    id: z.string().optional(),
    title: z.string().optional(),
    window: RawQuotaWindowSchema.optional(),
  })
  .passthrough();

const RawIdentitySchema = z
  .object({
    accountEmail: z.string().optional(),
    loginMethod: z.string().optional(),
    providerID: z.string().optional(),
  })
  .passthrough();

const RawUsageSchema = z
  .object({
    identity: RawIdentitySchema.optional(),
    loginMethod: z.string().optional(),
    accountEmail: z.string().optional(),
    primary: RawQuotaWindowSchema.optional(),
    secondary: RawQuotaWindowSchema.optional(),
    tertiary: RawQuotaWindowSchema.nullable().optional(),
    extraRateWindows: z.array(RawExtraRateWindowSchema).optional(),
    updatedAt: z.string().optional(),
  })
  .passthrough();

const RawCreditsSchema = z
  .object({
    remaining: z.number().optional(),
    updatedAt: z.string().optional(),
  })
  .passthrough();

const RawProviderErrorSchema = z
  .object({
    code: z.number().optional(),
    kind: z.string().optional(),
    message: z.string(),
  })
  .passthrough();

export const CodexbarUsageProviderRawSchema = z
  .object({
    provider: z.string().optional(),
    source: z.string().optional(),
    version: z.string().optional(),
    usage: RawUsageSchema.optional(),
    credits: RawCreditsSchema.optional(),
    error: RawProviderErrorSchema.optional(),
  })
  .passthrough();

export const CodexbarUsagePayloadSchema = z.array(CodexbarUsageProviderRawSchema);

export type CodexbarUsageProviderRaw = z.infer<typeof CodexbarUsageProviderRawSchema>;

// 1.1.0 cost-shape schemas kept exported for any straggler caller / migration
// test. The daemon no longer invokes this CLI. Remove after 2026-11 once the
// floor pins kikoro >= 1.2.0.
export const CodexbarCostProviderRawSchema = z
  .object({
    provider: z.string().optional(),
    source: z.string().optional(),
    updatedAt: z.string().optional(),
    sessionTokens: z.number().optional(),
    sessionCostUSD: z.number().optional(),
    last30DaysTokens: z.number().optional(),
    last30DaysCostUSD: z.number().optional(),
    totals: z
      .object({
        totalCost: z.number().optional(),
        totalTokens: z.number().optional(),
        inputTokens: z.number().optional(),
        outputTokens: z.number().optional(),
        cacheReadTokens: z.number().optional(),
        cacheCreationTokens: z.number().optional(),
      })
      .partial()
      .passthrough()
      .optional(),
  })
  .passthrough();

export const CodexbarCostPayloadSchema = z.array(CodexbarCostProviderRawSchema);

export type CodexbarCostProviderRaw = z.infer<typeof CodexbarCostProviderRawSchema>;
