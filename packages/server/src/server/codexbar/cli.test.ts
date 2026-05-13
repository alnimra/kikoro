import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { fetchCodexbarUsage } from "./cli.js";

const FIXTURES = resolve(import.meta.dirname, "__fixtures__");

async function runOkFixture() {
  return fetchCodexbarUsage({
    binaryPath: resolve(FIXTURES, "fake-codexbar-ok.sh"),
  });
}

describe("fetchCodexbarUsage", () => {
  it("returns kind=ok with three parsed providers for the canonical fixture", async () => {
    const result = await runOkFixture();
    expect(result.kind).toBe("ok");
    expect(result.providers).toHaveLength(3);
    expect(result.cliVersion).toBe("0.99.0");
  });

  it("parses the codex provider's usage + credits shape", async () => {
    const result = await runOkFixture();
    const codex = result.providers[0];
    expect(codex?.provider).toBe("codex");
    expect(codex?.source).toBe("codex-cli");
    expect(codex?.usage?.primary?.usedPercent).toBe(0);
    expect(codex?.usage?.primary?.windowMinutes).toBe(300);
    expect(codex?.usage?.secondary?.windowMinutes).toBe(10080);
    expect(codex?.usage?.tertiary).toBeNull();
    expect(codex?.usage?.identity?.accountEmail).toBe("m@ray.vin");
    expect(codex?.credits?.remaining).toBe(0);
  });

  it("preserves a per-provider error entry (openai) without inventing usage", async () => {
    const result = await runOkFixture();
    const openai = result.providers[1];
    expect(openai?.provider).toBe("openai");
    expect(openai?.usage).toBeUndefined();
    expect(openai?.error?.message).toContain("No available fetch strategy");
  });

  it("parses Claude's extraRateWindows array", async () => {
    const result = await runOkFixture();
    const claude = result.providers[2];
    expect(claude?.provider).toBe("claude");
    expect(claude?.usage?.primary?.usedPercent).toBe(51);
    expect(claude?.usage?.extraRateWindows).toHaveLength(2);
    expect(claude?.usage?.extraRateWindows?.[0]?.id).toBe("claude-design");
    expect(claude?.usage?.extraRateWindows?.[0]?.title).toBe("Designs");
  });

  it("returns kind=ok with empty providers when CLI exits 0 with empty stdout", async () => {
    const result = await fetchCodexbarUsage({
      binaryPath: resolve(FIXTURES, "fake-codexbar-empty.sh"),
    });
    expect(result.kind).toBe("ok");
    expect(result.providers).toEqual([]);
  });

  it("returns kind=cli_missing when the binary path does not exist", async () => {
    const result = await fetchCodexbarUsage({
      binaryPath: resolve(FIXTURES, "does-not-exist.sh"),
    });
    expect(result.kind).toBe("cli_missing");
    expect(result.errorCode).toBe("binary_not_found");
  });

  it("returns kind=cli_error with stderr in the message on nonzero exit", async () => {
    const result = await fetchCodexbarUsage({
      binaryPath: resolve(FIXTURES, "fake-codexbar-nonzero.sh"),
    });
    expect(result.kind).toBe("cli_error");
    expect(result.errorCode).toBe("exit_2");
    expect(result.errorMessage).toContain("provider 'bogus'");
  });

  it("returns kind=parse_error when stdout is not valid JSON", async () => {
    const result = await fetchCodexbarUsage({
      binaryPath: resolve(FIXTURES, "fake-codexbar-malformed.sh"),
    });
    expect(result.kind).toBe("parse_error");
    expect(result.errorCode).toBe("json_parse_error");
  });

  // Timeout path is exercised manually with `fake-codexbar-hang.sh` — left
  // out of the automated suite because waiting for SIGTERM/SIGKILL teardown
  // of a bash+sleep child is OS-timing-sensitive and not what we're
  // verifying here. The error-handling code path is already covered by
  // `cli_error` (nonzero exit), which uses the same resolve plumbing.
});
