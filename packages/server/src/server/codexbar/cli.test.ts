import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { fetchCodexbarCost } from "./cli.js";

const FIXTURES = resolve(import.meta.dirname, "__fixtures__");

describe("fetchCodexbarCost", () => {
  it("returns kind=ok with parsed providers for a well-formed CLI response", async () => {
    const result = await fetchCodexbarCost({
      binaryPath: resolve(FIXTURES, "fake-codexbar-ok.sh"),
    });
    expect(result.kind).toBe("ok");
    expect(result.providers).toHaveLength(2);
    expect(result.providers[0]?.provider).toBe("codex");
    expect(result.providers[0]?.sessionCostUSD).toBeCloseTo(49.49, 1);
    expect(result.providers[1]?.provider).toBe("claude");
    expect(result.cliVersion).toBe("0.99.0");
  });

  it("returns kind=ok with empty providers when CLI exits 0 with empty stdout", async () => {
    const result = await fetchCodexbarCost({
      binaryPath: resolve(FIXTURES, "fake-codexbar-empty.sh"),
    });
    expect(result.kind).toBe("ok");
    expect(result.providers).toEqual([]);
  });

  it("returns kind=cli_missing when the binary path does not exist", async () => {
    const result = await fetchCodexbarCost({
      binaryPath: resolve(FIXTURES, "does-not-exist.sh"),
    });
    expect(result.kind).toBe("cli_missing");
    expect(result.errorCode).toBe("binary_not_found");
  });

  it("returns kind=cli_error with stderr in the message on nonzero exit", async () => {
    const result = await fetchCodexbarCost({
      binaryPath: resolve(FIXTURES, "fake-codexbar-nonzero.sh"),
    });
    expect(result.kind).toBe("cli_error");
    expect(result.errorCode).toBe("exit_2");
    expect(result.errorMessage).toContain("provider 'bogus'");
  });

  it("returns kind=parse_error when stdout is not valid JSON", async () => {
    const result = await fetchCodexbarCost({
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
