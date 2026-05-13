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

function okResult(): CodexbarCliResult {
  return {
    kind: "ok",
    providers: [
      {
        provider: "codex",
        source: "codex-cli",
        version: "0.130.0",
        credits: { remaining: 0 },
        usage: {
          identity: {
            accountEmail: "m@ray.vin",
            loginMethod: "pro",
            providerID: "codex",
          },
          loginMethod: "pro",
          accountEmail: "m@ray.vin",
          primary: {
            usedPercent: 0,
            windowMinutes: 300,
            resetsAt: "2026-05-13T19:20:45Z",
            resetDescription: "04:20",
          },
          secondary: {
            usedPercent: 0,
            windowMinutes: 10080,
            resetsAt: "2026-05-19T03:27:28Z",
            resetDescription: "May 19, 2026 at 12:27",
          },
          tertiary: null,
          updatedAt: "2026-05-13T15:54:26Z",
        },
      },
      {
        provider: "openai",
        source: "auto",
        error: { code: 1, kind: "provider", message: "No available fetch strategy for openai." },
      },
      {
        provider: "claude",
        source: "oauth",
        usage: {
          identity: { loginMethod: "Claude Max", providerID: "claude" },
          loginMethod: "Claude Max",
          primary: {
            usedPercent: 51,
            windowMinutes: 300,
            resetsAt: "2026-05-13T16:09:59Z",
            resetDescription: "May 14 at 1:09AM",
          },
          secondary: {
            usedPercent: 33,
            windowMinutes: 10080,
          },
          tertiary: null,
          extraRateWindows: [
            {
              id: "claude-design",
              title: "Designs",
              window: { usedPercent: 0, windowMinutes: 10080 },
            },
          ],
          updatedAt: "2026-05-13T15:54:27Z",
        },
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
  it("maps an ok CLI result into a normalized snapshot envelope", () => {
    const snapshot = buildSnapshot(okResult(), fixedNow);
    expect(snapshot.status).toBe("ok");
    expect(snapshot.capturedAt).toBe(fixedNow.toISOString());
    expect(snapshot.providers).toHaveLength(3);
  });

  it("maps the codex provider's identity + quota windows + credits", () => {
    const snapshot = buildSnapshot(okResult(), fixedNow);
    const codex = snapshot.providers[0];
    expect(codex?.provider).toBe("codex");
    expect(codex?.source).toBe("codex-cli");
    expect(codex?.cliVersion).toBe("0.130.0");
    expect(codex?.identity?.accountEmail).toBe("m@ray.vin");
    expect(codex?.identity?.loginMethod).toBe("pro");
    expect(codex?.identity?.providerId).toBe("codex");
    expect(codex?.primary?.usedPercent).toBe(0);
    expect(codex?.primary?.windowMinutes).toBe(300);
    expect(codex?.secondary?.windowMinutes).toBe(10080);
    expect(codex?.tertiary).toBeUndefined();
    expect(codex?.credits?.remaining).toBe(0);
  });

  it("does not populate deprecated 1.1.0 dollar fields", () => {
    const snapshot = buildSnapshot(okResult(), fixedNow);
    const codex = snapshot.providers[0];
    expect(codex?.sessionCostUsd).toBeUndefined();
    expect(codex?.last30DaysCostUsd).toBeUndefined();
  });

  it("passes through per-provider error entries (openai)", () => {
    const snapshot = buildSnapshot(okResult(), fixedNow);
    const openai = snapshot.providers[1];
    expect(openai?.provider).toBe("openai");
    expect(openai?.providerError?.message).toContain("No available fetch strategy");
    expect(openai?.providerError?.code).toBe(1);
    expect(openai?.primary).toBeUndefined();
  });

  it("maps Claude's extraWindows array", () => {
    const snapshot = buildSnapshot(okResult(), fixedNow);
    const claude = snapshot.providers[2];
    expect(claude?.provider).toBe("claude");
    expect(claude?.primary?.usedPercent).toBe(51);
    expect(claude?.extraWindows).toHaveLength(1);
    expect(claude?.extraWindows?.[0]?.id).toBe("claude-design");
    expect(claude?.extraWindows?.[0]?.title).toBe("Designs");
    expect(claude?.extraWindows?.[0]?.window.windowMinutes).toBe(10080);
  });

  it("maps an error CLI result into an error snapshot with empty providers", () => {
    const snapshot = buildSnapshot(errorResult(), fixedNow);
    expect(snapshot.status).toBe("cli_error");
    expect(snapshot.providers).toEqual([]);
    expect(snapshot.error?.code).toBe("exit_1");
    expect(snapshot.error?.message).toBe("boom");
  });

  it("handles a provider entry with no usage and no error gracefully", () => {
    const result: CodexbarCliResult = {
      kind: "ok",
      providers: [{ provider: "weirdprovider" }],
      cliVersion: null,
    };
    const snapshot = buildSnapshot(result, fixedNow);
    expect(snapshot.status).toBe("ok");
    expect(snapshot.providers[0]?.provider).toBe("weirdprovider");
    expect(snapshot.providers[0]?.primary).toBeUndefined();
    expect(snapshot.providers[0]?.providerError).toBeUndefined();
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
    await service.refresh();
    service.stop();

    const okBroadcasts = broadcastCalls.filter((s) => s.status === "ok");
    expect(okBroadcasts.length).toBeGreaterThanOrEqual(1);
    expect(okBroadcasts.at(-1)?.providers[0]?.provider).toBe("codex");
    expect(okBroadcasts.at(-1)?.providers[0]?.primary?.windowMinutes).toBe(300);

    const cached = await readCachedSnapshot(paseoHome);
    expect(cached?.status).toBe("ok");
  });

  it("on error after a previous success, broadcasts a stale snapshot using cached data", async () => {
    await writeCachedSnapshot(paseoHome, {
      status: "ok",
      capturedAt: "2026-05-13T04:00:00.000Z",
      providers: [
        {
          provider: "codex",
          primary: { usedPercent: 10, windowMinutes: 300 },
        },
      ],
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

    const stale = broadcastCalls.filter((s) => s.status === "stale");
    expect(stale.length).toBeGreaterThanOrEqual(1);
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
    expect(calls).toBe(1);
    release?.();
    await Promise.all([p1, p2]);
    service.stop();
    expect(calls).toBe(1);
  });
});
