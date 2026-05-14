import { describe, it, expect } from "vitest";
import {
  extractToolCallFilePath,
  extractToolCallFileRef,
  isMarkdownPath,
} from "./extract-tool-call-file-path";

describe("extractToolCallFilePath", () => {
  it("returns filePath for read/edit/write", () => {
    expect(extractToolCallFilePath({ type: "read", filePath: "/a.ts" })).toBe("/a.ts");
    expect(extractToolCallFilePath({ type: "edit", filePath: "/b.ts" })).toBe("/b.ts");
    expect(extractToolCallFilePath({ type: "write", filePath: "/c.ts" })).toBe("/c.ts");
  });

  it("returns null for empty filePath", () => {
    expect(extractToolCallFilePath({ type: "read", filePath: "" })).toBeNull();
  });

  it.each([
    ["cat ~/file.md", "~/file.md"],
    ["wc -l ~/.paseo/plans/projects-settings-page.md", "~/.paseo/plans/projects-settings-page.md"],
    ["head -n 20 src/index.ts", "src/index.ts"],
    ["tail -f /var/log/x.log", "/var/log/x.log"],
    ["less ./README.md", "./README.md"],
    ["stat /tmp/foo", "/tmp/foo"],
  ])("matches shell read command %s", (command, expected) => {
    expect(extractToolCallFilePath({ type: "shell", command })).toBe(expected);
  });

  it.each([
    ["echo hi > retro.md", "retro.md"],
    ["echo hi >> retro.md", "retro.md"],
    ["python plot.py > /tmp/output.md", "/tmp/output.md"],
    ["cat a.ts > b.ts", "b.ts"],
    ["printf 'x' > 'path with space.md'", "path with space.md"],
    ["curl https://x.example.com -s | tee notes.md", "notes.md"],
    ["something | tee -a /var/log/append.md", "/var/log/append.md"],
    ["cmd 2> errors.md", "errors.md"],
  ])("matches shell write command %s", (command, expected) => {
    expect(extractToolCallFilePath({ type: "shell", command })).toBe(expected);
  });

  it.each(["cat a.ts | grep foo", "cat a.ts b.ts", "echo hi", "ls /tmp", "rm -rf /tmp"])(
    "returns null for non-matching shell %s",
    (command) => {
      expect(extractToolCallFilePath({ type: "shell", command })).toBeNull();
    },
  );

  it("returns null for unrelated detail types", () => {
    expect(extractToolCallFilePath({ type: "search", query: "foo" })).toBeNull();
    expect(extractToolCallFilePath({ type: "unknown", input: null, output: null })).toBeNull();
    expect(extractToolCallFilePath(undefined)).toBeNull();
  });
});

describe("extractToolCallFileRef", () => {
  it("tags read intent for read tool kind", () => {
    expect(extractToolCallFileRef({ type: "read", filePath: "/a.md" })).toEqual({
      path: "/a.md",
      intent: "read",
    });
  });

  it("tags write intent for write/edit tool kinds", () => {
    expect(extractToolCallFileRef({ type: "write", filePath: "/a.md" })).toEqual({
      path: "/a.md",
      intent: "write",
    });
    expect(extractToolCallFileRef({ type: "edit", filePath: "/b.md" })).toEqual({
      path: "/b.md",
      intent: "write",
    });
  });

  it("tags read intent for shell read commands", () => {
    expect(extractToolCallFileRef({ type: "shell", command: "cat retro.md" })).toEqual({
      path: "retro.md",
      intent: "read",
    });
  });

  it("tags write intent for shell redirects and tee", () => {
    expect(extractToolCallFileRef({ type: "shell", command: "echo hi > retro.md" })).toEqual({
      path: "retro.md",
      intent: "write",
    });
    expect(extractToolCallFileRef({ type: "shell", command: "cmd | tee -a notes.md" })).toEqual({
      path: "notes.md",
      intent: "write",
    });
  });

  it("returns null for empty / unrelated cases", () => {
    expect(extractToolCallFileRef({ type: "read", filePath: "" })).toBeNull();
    expect(extractToolCallFileRef({ type: "shell", command: "echo hi" })).toBeNull();
    expect(extractToolCallFileRef(undefined)).toBeNull();
  });
});

describe("isMarkdownPath", () => {
  it.each([
    ["foo.md", true],
    ["foo.markdown", true],
    ["FOO.MD", true],
    ["a/b/c.md", true],
    ["a.md.txt", false],
    ["foo.ts", false],
    ["", false],
    [null, false],
    [undefined, false],
  ])("%s -> %s", (input, expected) => {
    expect(isMarkdownPath(input as string | null | undefined)).toBe(expected);
  });
});
