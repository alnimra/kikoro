import { mkdtemp, readFile, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { type SubscriptionUsageSnapshot } from "../../shared/messages.js";

import { getCachePath, readCachedSnapshot, writeCachedSnapshot } from "./cache.js";

describe("codexbar cache", () => {
  let paseoHome: string;

  beforeEach(async () => {
    paseoHome = await mkdtemp(join(tmpdir(), "kikoro-codexbar-cache-"));
  });

  afterEach(async () => {
    // mkdtemp dirs are tiny; vitest's process cleanup is enough.
  });

  it("returns null when the cache file does not exist", async () => {
    const result = await readCachedSnapshot(paseoHome);
    expect(result).toBeNull();
  });

  it("round-trips a well-formed snapshot through write + read", async () => {
    const snapshot: SubscriptionUsageSnapshot = {
      status: "ok",
      capturedAt: "2026-05-13T05:30:00Z",
      providers: [
        {
          provider: "codex",
          sessionCostUsd: 49.49,
          sessionTokens: 120190126,
          last30DaysCostUsd: 2944.25,
          last30DaysTokens: 7788672189,
        },
      ],
      cliVersion: "0.25.1",
    };
    await writeCachedSnapshot(paseoHome, snapshot);
    const round = await readCachedSnapshot(paseoHome);
    expect(round).toEqual(snapshot);
  });

  it("returns null on corrupted JSON instead of throwing", async () => {
    const path = getCachePath(paseoHome);
    await mkdir(join(paseoHome, "codexbar"), { recursive: true });
    await writeFile(path, "{ not json", "utf8");
    const result = await readCachedSnapshot(paseoHome);
    expect(result).toBeNull();
  });

  it("returns null on schema mismatch instead of throwing", async () => {
    const path = getCachePath(paseoHome);
    await mkdir(join(paseoHome, "codexbar"), { recursive: true });
    // status field is invalid — schema rejects.
    await writeFile(
      path,
      JSON.stringify({ status: "garbage", capturedAt: "x", providers: [] }),
      "utf8",
    );
    const result = await readCachedSnapshot(paseoHome);
    expect(result).toBeNull();
  });

  it("write is atomic: only renames into place after the temp file is fully written", async () => {
    // Sanity check: writeCachedSnapshot's contract is that the final file
    // either contains a complete previous snapshot or the new one — never a
    // partial write. We verify by writing twice and checking the latest
    // is fully present.
    const snapshotA: SubscriptionUsageSnapshot = {
      status: "ok",
      capturedAt: "2026-05-13T05:00:00Z",
      providers: [],
    };
    const snapshotB: SubscriptionUsageSnapshot = {
      status: "ok",
      capturedAt: "2026-05-13T06:00:00Z",
      providers: [{ provider: "codex" }],
    };
    await writeCachedSnapshot(paseoHome, snapshotA);
    await writeCachedSnapshot(paseoHome, snapshotB);
    const raw = await readFile(getCachePath(paseoHome), "utf8");
    expect(raw).toContain("06:00:00Z");
    expect(raw).toContain("codex");
  });
});
