import type { Logger } from "pino";

import {
  type SubscriptionProviderCost,
  type SubscriptionUsageSnapshot,
} from "../../shared/messages.js";

import { readCachedSnapshot, writeCachedSnapshot } from "./cache.js";
import { fetchCodexbarUsage, resolveCodexbarBinaryPath, type CodexbarCliResult } from "./cli.js";
import type { CodexbarUsageProviderRaw } from "./schemas.js";

export interface CodexbarServiceOptions {
  paseoHome: string;
  logger: Logger;
  broadcast: (snapshot: SubscriptionUsageSnapshot) => void;
  pollIntervalMs?: number;
  cliTimeoutMs?: number;
  binaryPath?: string;
  // Test seam: replaces fetchCodexbarUsage.
  fetchFn?: typeof fetchCodexbarUsage;
  // Test seam: replaces Date.now in capturedAt timestamps.
  now?: () => Date;
}

const DEFAULT_POLL_INTERVAL_MS = 60_000;
// `codexbar usage` hits remote APIs (codex web dashboard, claude.ai API);
// 60s is generous but cheap relative to the 60s poll cadence.
const DEFAULT_CLI_TIMEOUT_MS = 60_000;

export class CodexbarService {
  private readonly options: Required<
    Omit<CodexbarServiceOptions, "logger" | "broadcast" | "fetchFn" | "now">
  > & {
    logger: Logger;
    broadcast: (snapshot: SubscriptionUsageSnapshot) => void;
    fetchFn: typeof fetchCodexbarUsage;
    now: () => Date;
  };
  private latestSnapshot: SubscriptionUsageSnapshot | null = null;
  private timer: NodeJS.Timeout | null = null;
  private running = false;
  private pollInFlight: Promise<void> | null = null;

  constructor(options: CodexbarServiceOptions) {
    this.options = {
      paseoHome: options.paseoHome,
      logger: options.logger.child({ module: "codexbar" }),
      broadcast: options.broadcast,
      pollIntervalMs: options.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS,
      cliTimeoutMs: options.cliTimeoutMs ?? DEFAULT_CLI_TIMEOUT_MS,
      binaryPath: options.binaryPath ?? resolveCodexbarBinaryPath() ?? "codexbar",
      fetchFn: options.fetchFn ?? fetchCodexbarUsage,
      now: options.now ?? (() => new Date()),
    };
  }

  async start(): Promise<void> {
    if (this.running) {
      return;
    }
    this.running = true;
    // Surface the cached snapshot immediately on startup so the first
    // connected client sees something instead of "loading" indefinitely while
    // the first poll is in flight.
    const cached = await readCachedSnapshot(this.options.paseoHome, this.options.logger);
    if (cached) {
      const stale = stalifySnapshot(cached, this.options.now());
      this.latestSnapshot = stale;
      this.options.broadcast(stale);
    }
    // Fire-and-forget the first poll; loop scheduling handles the rest.
    void this.runPoll();
    this.scheduleNext();
  }

  stop(): void {
    this.running = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  getLatestSnapshot(): SubscriptionUsageSnapshot | null {
    return this.latestSnapshot;
  }

  async refresh(): Promise<void> {
    await this.runPoll();
  }

  private scheduleNext(): void {
    if (!this.running) {
      return;
    }
    this.timer = setTimeout(() => {
      void this.runPoll().finally(() => this.scheduleNext());
    }, this.options.pollIntervalMs);
  }

  private async runPoll(): Promise<void> {
    if (this.pollInFlight) {
      return this.pollInFlight;
    }
    this.pollInFlight = this.doPoll().finally(() => {
      this.pollInFlight = null;
    });
    return this.pollInFlight;
  }

  private async doPoll(): Promise<void> {
    const { logger, broadcast, paseoHome, binaryPath, cliTimeoutMs, fetchFn, now } = this.options;
    let result: CodexbarCliResult;
    try {
      result = await fetchFn({ binaryPath, timeoutMs: cliTimeoutMs, logger });
    } catch (error) {
      logger.warn({ err: error }, "codexbar.poll.threw");
      result = {
        kind: "cli_error",
        providers: [],
        cliVersion: null,
        errorMessage: error instanceof Error ? error.message : String(error),
        errorCode: "exception",
      };
    }

    const snapshot = buildSnapshot(result, now());

    if (snapshot.status === "ok") {
      this.latestSnapshot = snapshot;
      await writeCachedSnapshot(paseoHome, snapshot, logger);
      broadcast(snapshot);
      return;
    }

    // Non-ok path: if we have a previous successful snapshot in memory or on
    // disk, emit it tagged as stale instead of a hard error so the iOS app
    // can keep showing numbers with an "Updated X min ago" banner.
    const fallback = this.latestSnapshot ?? (await readCachedSnapshot(paseoHome, logger));
    if (fallback && fallback.status === "ok") {
      const staleSnapshot: SubscriptionUsageSnapshot = {
        ...fallback,
        status: "stale",
        error: {
          code: snapshot.error?.code,
          message: snapshot.error?.message ?? "codexbar poll failed; showing cached data",
        },
      };
      this.latestSnapshot = staleSnapshot;
      broadcast(staleSnapshot);
      return;
    }

    // No fallback available — broadcast the raw error snapshot so the UI can
    // surface the empty-state copy and the user knows why.
    this.latestSnapshot = snapshot;
    broadcast(snapshot);
  }
}

function stalifySnapshot(
  snapshot: SubscriptionUsageSnapshot,
  capturedAt: Date,
): SubscriptionUsageSnapshot {
  if (snapshot.status !== "ok") {
    return snapshot;
  }
  return {
    ...snapshot,
    status: "stale",
    capturedAt: capturedAt.toISOString(),
    error: {
      code: "boot_cache",
      message: "Cached snapshot loaded on daemon start; refreshing.",
    },
  };
}

export function buildSnapshot(
  result: CodexbarCliResult,
  capturedAt: Date,
): SubscriptionUsageSnapshot {
  const capturedAtIso = capturedAt.toISOString();
  if (result.kind === "ok") {
    return {
      status: "ok",
      capturedAt: capturedAtIso,
      providers: result.providers.map(normalizeProvider),
      cliVersion: result.cliVersion,
    };
  }
  return {
    status: result.kind,
    capturedAt: capturedAtIso,
    providers: [],
    cliVersion: result.cliVersion,
    error: {
      code: result.errorCode,
      message: result.errorMessage ?? "codexbar CLI failed",
    },
  };
}

// Maps one entry of `codexbar usage --format json --provider all` to the
// broadcast shape. Tolerates both success (`usage`) and per-provider error
// (`error`) entries. Drops the deprecated dollar fields entirely; old v1.1.0
// clients reading the wire will see them as undefined.
function normalizeIdentity(
  usage: CodexbarUsageProviderRaw["usage"],
): SubscriptionProviderCost["identity"] {
  if (usage?.identity) {
    return {
      accountEmail: usage.identity.accountEmail ?? usage.accountEmail,
      loginMethod: usage.identity.loginMethod ?? usage.loginMethod,
      providerId: usage.identity.providerID,
    };
  }
  if (usage?.loginMethod || usage?.accountEmail) {
    return {
      accountEmail: usage.accountEmail,
      loginMethod: usage.loginMethod,
    };
  }
  return undefined;
}

function normalizeProvider(raw: CodexbarUsageProviderRaw): SubscriptionProviderCost {
  const usage = raw.usage;
  return {
    provider: raw.provider ?? "unknown",
    source: raw.source,
    updatedAt: usage?.updatedAt,
    cliVersion: raw.version,

    identity: normalizeIdentity(usage),

    primary: usage?.primary,
    secondary: usage?.secondary,
    tertiary: usage?.tertiary ?? undefined,
    extraWindows: usage?.extraRateWindows
      ?.filter(
        (entry) =>
          entry.id !== undefined && entry.title !== undefined && entry.window !== undefined,
      )
      .map((entry) => ({
        id: entry.id as string,
        title: entry.title as string,
        window: entry.window as NonNullable<typeof entry.window>,
      })),
    credits: raw.credits ? { remaining: raw.credits.remaining } : undefined,
    providerError: raw.error
      ? {
          code: raw.error.code,
          kind: raw.error.kind,
          message: raw.error.message,
        }
      : undefined,
  };
}
