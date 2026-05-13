import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import type { Logger } from "pino";

import { CodexbarUsagePayloadSchema, type CodexbarUsageProviderRaw } from "./schemas.js";

export interface CodexbarCliResult {
  kind: "ok" | "cli_missing" | "cli_error" | "parse_error" | "timeout";
  providers: CodexbarUsageProviderRaw[];
  cliVersion: string | null;
  errorMessage?: string;
  errorCode?: string;
}

interface RunCommandResult {
  exitCode: number | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
}

const DEFAULT_BIN_CANDIDATES = [
  process.env.CODEXBAR_CLI_PATH ?? "",
  "/usr/local/bin/codexbar",
  "/opt/homebrew/bin/codexbar",
  "/Applications/CodexBar.app/Contents/Helpers/CodexBarCLI",
].filter((path): path is string => path.length > 0);

export function resolveCodexbarBinaryPath(): string | null {
  for (const candidate of DEFAULT_BIN_CANDIDATES) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }
  // Last-resort: rely on PATH lookup (codexbar shipped via `codexbar` on PATH).
  return "codexbar";
}

async function runCommand(
  binary: string,
  args: readonly string[],
  options: { timeoutMs: number },
): Promise<RunCommandResult> {
  return new Promise((resolve) => {
    const child = spawn(binary, args, {
      stdio: ["ignore", "pipe", "pipe"],
      env: process.env,
    });
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    let settled = false;
    const settle = (result: RunCommandResult) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      // oxlint-disable-next-line promise/no-multiple-resolved -- guarded by `settled` above.
      resolve(result);
    };
    const timer = setTimeout(() => {
      timedOut = true;
      try {
        child.kill("SIGTERM");
      } catch {
        /* ignore */
      }
      // If SIGTERM doesn't surface a close event within 1s (codexbar binary
      // ignores signals, stuck in syscall, etc.), escalate to SIGKILL so the
      // poll loop doesn't stall indefinitely.
      setTimeout(() => {
        try {
          child.kill("SIGKILL");
        } catch {
          /* ignore */
        }
      }, 1_000).unref();
    }, options.timeoutMs);

    child.stdout.on("data", (chunk: Buffer | string) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk: Buffer | string) => {
      stderr += chunk.toString();
    });
    child.on("error", () => {
      settle({ exitCode: null, stdout, stderr, timedOut });
    });
    child.on("close", (code: number | null) => {
      settle({ exitCode: code, stdout, stderr, timedOut });
    });
  });
}

export interface FetchCodexbarUsageOptions {
  binaryPath: string;
  timeoutMs?: number;
  logger?: Logger;
}

// Back-compat alias for any caller that hadn't been renamed yet.
export type FetchCodexbarCostOptions = FetchCodexbarUsageOptions;

export async function fetchCodexbarVersion(
  binaryPath: string,
  timeoutMs = 5_000,
): Promise<string | null> {
  // codexbar --version prints e.g. "CodexBar 0.25.1"
  if (!binaryPath || binaryPath === "codexbar" || !existsSync(binaryPath)) {
    // PATH-based discovery falls through to runCommand; if it fails, we return null.
  }
  const result = await runCommand(binaryPath, ["--version"], { timeoutMs });
  if (result.exitCode !== 0 || result.timedOut) {
    return null;
  }
  const match = result.stdout.match(/[\d.]+/);
  return match ? match[0] : null;
}

export async function fetchCodexbarUsage(
  options: FetchCodexbarUsageOptions,
): Promise<CodexbarCliResult> {
  const { binaryPath, logger } = options;
  // 60s — `codexbar usage` hits remote APIs (codex web dashboard, claude.ai
  // API) per provider and a cold first invocation can be slower than the
  // pure-local `cost` path. Keep generous; the poll cadence is much longer.
  const timeoutMs = options.timeoutMs ?? 60_000;

  // Refuse to spawn if the path is clearly missing (`codexbar` PATH fallback
  // still gets a chance — runCommand will report ENOENT).
  if (binaryPath !== "codexbar" && !existsSync(binaryPath)) {
    return {
      kind: "cli_missing",
      providers: [],
      cliVersion: null,
      errorMessage: `codexbar CLI not found at ${binaryPath}. Install CodexBar.app and ensure /Applications/CodexBar.app/Contents/Helpers/CodexBarCLI is present, or set CODEXBAR_CLI_PATH.`,
      errorCode: "binary_not_found",
    };
  }

  const cliVersion = await fetchCodexbarVersion(binaryPath).catch(() => null);

  const result = await runCommand(binaryPath, ["usage", "--format", "json", "--provider", "all"], {
    timeoutMs,
  });

  if (result.timedOut) {
    logger?.warn({ binaryPath, timeoutMs }, "codexbar.cli.timeout");
    return {
      kind: "timeout",
      providers: [],
      cliVersion,
      errorMessage: `codexbar CLI timed out after ${timeoutMs}ms`,
      errorCode: "timeout",
    };
  }
  if (result.exitCode === null) {
    return {
      kind: "cli_missing",
      providers: [],
      cliVersion,
      errorMessage: `codexbar CLI failed to spawn from ${binaryPath} (binary missing or not executable).`,
      errorCode: "spawn_failed",
    };
  }
  if (result.exitCode !== 0) {
    logger?.warn(
      { binaryPath, exitCode: result.exitCode, stderr: result.stderr.slice(0, 200) },
      "codexbar.cli.nonzero_exit",
    );
    return {
      kind: "cli_error",
      providers: [],
      cliVersion,
      errorMessage: `codexbar CLI exited ${result.exitCode}: ${result.stderr.trim().slice(0, 200) || "(no stderr)"}`,
      errorCode: `exit_${result.exitCode}`,
    };
  }

  const trimmed = result.stdout.trim();
  if (!trimmed) {
    // Exit 0 with empty stdout — known case when codexbar finds no enabled
    // providers, or when local JSONL scan returns nothing.
    return {
      kind: "ok",
      providers: [],
      cliVersion,
    };
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(trimmed);
  } catch (error) {
    return {
      kind: "parse_error",
      providers: [],
      cliVersion,
      errorMessage: `codexbar CLI output was not valid JSON: ${error instanceof Error ? error.message : String(error)}`,
      errorCode: "json_parse_error",
    };
  }

  const schemaResult = CodexbarUsagePayloadSchema.safeParse(parsedJson);
  if (!schemaResult.success) {
    logger?.warn({ issues: schemaResult.error.issues.slice(0, 3) }, "codexbar.cli.schema_mismatch");
    return {
      kind: "parse_error",
      providers: [],
      cliVersion,
      errorMessage: `codexbar CLI output did not match expected schema (first issue: ${schemaResult.error.issues[0]?.message ?? "unknown"})`,
      errorCode: "schema_mismatch",
    };
  }

  return {
    kind: "ok",
    providers: schemaResult.data,
    cliVersion,
  };
}

// Exposed for tests — lets us point at a fake codexbar shim.
export function defaultCodexbarHelperPath(): string {
  return join("/Applications", "CodexBar.app", "Contents", "Helpers", "CodexBarCLI");
}
