import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import pino from "pino";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { SubscriptionUsageSnapshot } from "../../shared/messages.js";

import { readCachedSnapshot, writeCachedSnapshot } from "./cache.js";
import type { CodexbarCliResult } from "./cli.js";
import { CodexbarService, buildSnapshot } from "./service.js";

const fixedNow = new Date("2026-05-13T05:00:00.000Z");
const silentLogger = pino({ level: "silent" });

function okResult(provider = "codex", sessionCostUSD = 49.49): CodexbarCliResult {
  return {
    kind: "ok",
    providers: [
      {
        provider,
        sessionCostUSD,
        sessionTokens: 120190126,
        last30DaysCostUSD: 2944.25,
        last30DaysTokens: 7788672189,
      },
    ],
    cliVersion: "0.25.1",
  };
}

function errorResult(): CodexbarCliResult {
  return {
    kind: "cli_error",
    providers: [],
    cliVersion: null,
    errorMessage: "boom",
    errorCode: "exit_1",
  };
}

describe("buildSnapshot", () => {
  it("maps an ok CLI result into a normalized snapshot", () => {
    const snapshot = buildSnapshot(okResult(), fixedNow);
    expect(snapshot.status).toBe("ok");
    expect(snapshot.capturedAt).toBe(fixedNow.toISOString());
    expect(snapshot.providers[0]?.provider).toBe("codex");
    // Normalized field name (Usd not USD).
    expect(snapshot.providers[0]?.sessionCostUsd).toBeCloseTo(49.49, 1);
    expect(snapshot.providers[0]?.last30DaysCostUsd).toBeCloseTo(2944.25, 1);
  });

  it("maps an error CLI result into an error snapshot with empty providers", () => {
    const snapshot = buildSnapshot(errorResult(), fixedNow);
    expect(snapshot.status).toBe("cli_error");
    expect(snapshot.providers).toEqual([]);
    expect(snapshot.error?.code).toBe("exit_1");
    expect(snapshot.error?.message).toBe("boom");
  });
});

describe("CodexbarService", () => {
  let paseoHome: string;
  const broadcastCalls: SubscriptionUsageSnapshot[] = [];

  beforeEach(async () => {
    paseoHome = await mkdtemp(join(tmpdir(), "kikoro-codexbar-svc-"));
    broadcastCalls.length = 0;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("broadcasts an ok snapshot on first poll and writes it to cache", async () => {
    const service = new CodexbarService({
      paseoHome,
      logger: silentLogger,
      broadcast: (s) => broadcastCalls.push(s),
      fetchFn: async () => okResult(),
      now: () => fixedNow,
      pollIntervalMs: 60_000,
    });

    await service.start();
    // start() fires-and-forgets the first poll; await refresh() to await it.
    await service.refresh();
    service.stop();

    const okBroadcasts = broadcastCalls.filter((s) => s.status === "ok");
    expect(okBroadcasts.length).toBeGreaterThanOrEqual(1);
    expect(okBroadcasts.at(-1)?.providers[0]?.provider).toBe("codex");

    // Cache reflects the latest ok snapshot.
    const cached = await readCachedSnapshot(paseoHome);
    expect(cached?.status).toBe("ok");
  });

  it("on error after a previous success, broadcasts a stale snapshot using cached data", async () => {
    // Pre-populate the cache so service.start() picks it up.
    await writeCachedSnapshot(paseoHome, {
      status: "ok",
      capturedAt: "2026-05-13T04:00:00.000Z",
      providers: [{ provider: "codex", sessionCostUsd: 10 }],
      cliVersion: "0.25.1",
    });

    const service = new CodexbarService({
      paseoHome,
      logger: silentLogger,
      broadcast: (s) => broadcastCalls.push(s),
      fetchFn: async () => errorResult(),
      now: () => fixedNow,
      pollIntervalMs: 60_000,
    });

    await service.start();
    await service.refresh();
    service.stop();

    // First broadcast: cached snapshot tagged as stale (boot replay).
    // Subsequent broadcast(s): error path also tagged stale because the
    // previous in-memory snapshot was ok.
    const stale = broadcastCalls.filter((s) => s.status === "stale");
    expect(stale.length).toBeGreaterThanOrEqual(1);
    // The in-memory previous ok snapshot's providers survive.
    expect(stale.at(-1)?.providers[0]?.provider).toBe("codex");
    expect(stale.at(-1)?.error?.code).toBeDefined();
  });

  it("broadcasts the raw error snapshot when no cache and no prior success exists", async () => {
    const service = new CodexbarService({
      paseoHome,
      logger: silentLogger,
      broadcast: (s) => broadcastCalls.push(s),
      fetchFn: async () => errorResult(),
      now: () => fixedNow,
      pollIntervalMs: 60_000,
    });

    await service.start();
    await service.refresh();
    service.stop();

    const lastBroadcast = broadcastCalls.at(-1);
    expect(lastBroadcast?.status).toBe("cli_error");
    expect(lastBroadcast?.providers).toEqual([]);
    expect(lastBroadcast?.error?.code).toBe("exit_1");
  });

  it("does not run overlapping polls when refresh is called concurrently", async () => {
    let calls = 0;
    let release: (() => void) | undefined;
    const fetchFn = async (): Promise<CodexbarCliResult> => {
      calls += 1;
      await new Promise<void>((r) => {
        release = r;
      });
      return okResult();
    };
    const service = new CodexbarService({
      paseoHome,
      logger: silentLogger,
      broadcast: (s) => broadcastCalls.push(s),
      fetchFn,
      now: () => fixedNow,
      pollIntervalMs: 60_000,
    });

    const p1 = service.refresh();
    const p2 = service.refresh();
    // Both should be awaiting the same in-flight poll.
    expect(calls).toBe(1);
    release?.();
    await Promise.all([p1, p2]);
    service.stop();
    expect(calls).toBe(1);
  });
});
