import { z } from "zod";

// Raw shape of one provider entry returned by `codexbar cost --format json`.
// Everything is .passthrough() + every field optional — codexbar is a third
// party tool and we never want a CLI shape change to crash the daemon. The
// daemon normalizes this into shared/messages.SubscriptionProviderCostSchema
// before broadcasting.
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
