import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { Logger } from "pino";

import {
  SubscriptionUsageSnapshotSchema,
  type SubscriptionUsageSnapshot,
} from "../../shared/messages.js";

const CACHE_FILENAME = "last-good.json";

export function getCachePath(paseoHome: string): string {
  return join(paseoHome, "codexbar", CACHE_FILENAME);
}

export async function readCachedSnapshot(
  paseoHome: string,
  logger?: Logger,
): Promise<SubscriptionUsageSnapshot | null> {
  const path = getCachePath(paseoHome);
  let raw: string;
  try {
    raw = await readFile(path, "utf8");
  } catch (error) {
    if (isMissingFileError(error)) {
      return null;
    }
    logger?.warn({ err: error, path }, "codexbar.cache.read_failed");
    return null;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    logger?.warn({ err: error, path }, "codexbar.cache.parse_failed");
    return null;
  }
  const result = SubscriptionUsageSnapshotSchema.safeParse(parsed);
  if (!result.success) {
    logger?.warn(
      { issues: result.error.issues.slice(0, 3), path },
      "codexbar.cache.schema_mismatch",
    );
    return null;
  }
  return result.data;
}

export async function writeCachedSnapshot(
  paseoHome: string,
  snapshot: SubscriptionUsageSnapshot,
  logger?: Logger,
): Promise<void> {
  const path = getCachePath(paseoHome);
  const tmpPath = `${path}.tmp-${process.pid}-${Date.now()}`;
  try {
    await mkdir(dirname(path), { recursive: true });
    await writeFile(tmpPath, JSON.stringify(snapshot, null, 2), "utf8");
    await rename(tmpPath, path);
  } catch (error) {
    logger?.warn({ err: error, path }, "codexbar.cache.write_failed");
  }
}

function isMissingFileError(error: unknown): boolean {
  return (
    error instanceof Error && "code" in error && (error as NodeJS.ErrnoException).code === "ENOENT"
  );
}
