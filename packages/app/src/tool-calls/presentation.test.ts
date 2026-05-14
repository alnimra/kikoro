import type { ToolCallDetail } from "@server/server/agent/agent-sdk-types";
import { describe, expect, it } from "vitest";

import { buildToolCallPresentation, type ToolCallPresentationIcon } from "./presentation";

const fakeIcons = {
  brain: (() => null) as ToolCallPresentationIcon,
  eye: (() => null) as ToolCallPresentationIcon,
  wrench: (() => null) as ToolCallPresentationIcon,
};

function fakeResolveIcon(
  toolName: string,
  detail: ToolCallDetail | undefined,
): ToolCallPresentationIcon {
  if (detail?.type === "plan") {
    return fakeIcons.brain;
  }
  if (detail?.type === "read") {
    return fakeIcons.eye;
  }
  if (toolName === "exec_command") {
    return fakeIcons.wrench;
  }
  return fakeIcons.wrench;
}

describe("tool-call presentation", () => {
  it("builds badge, detail, icon, and file-open policy in one model", () => {
    const presentation = buildToolCallPresentation({
      toolName: "read_file",
      status: "completed",
      error: null,
      cwd: "/tmp/repo",
      detail: {
        type: "read",
        filePath: "/tmp/repo/src/index.ts",
        content: "console.log('hi');",
      },
      resolveIcon: fakeResolveIcon,
    });

    expect(presentation).toMatchObject({
      displayName: "Read",
      summary: "src/index.ts",
      icon: fakeIcons.eye,
      isLoadingDetails: false,
      hasDetails: true,
      canOpenDetails: true,
      openFilePath: "/tmp/repo/src/index.ts",
      isPlan: false,
    });
  });

  it("marks running calls without meaningful detail as loading details", () => {
    const presentation = buildToolCallPresentation({
      toolName: "exec_command",
      status: "running",
      error: null,
      detail: {
        type: "unknown",
        input: {},
        output: null,
      },
      resolveIcon: fakeResolveIcon,
    });

    expect(presentation).toMatchObject({
      displayName: "Exec Command",
      icon: fakeIcons.wrench,
      isLoadingDetails: true,
      hasDetails: false,
      canOpenDetails: true,
      openFilePath: null,
      isPlan: false,
    });
  });

  it("surfaces an artifactPath for completed markdown writes", () => {
    const presentation = buildToolCallPresentation({
      toolName: "Write",
      status: "completed",
      error: null,
      detail: {
        type: "write",
        filePath: "/tmp/repo/docs/retro.md",
        content: "# Retro",
      },
      resolveIcon: fakeResolveIcon,
    });
    expect(presentation.artifactPath).toBe("/tmp/repo/docs/retro.md");
  });

  it("surfaces an artifactPath for completed bash redirects to .md", () => {
    const presentation = buildToolCallPresentation({
      toolName: "Bash",
      status: "completed",
      error: null,
      detail: {
        type: "shell",
        command: "echo hi > /tmp/notes.md",
      },
      resolveIcon: fakeResolveIcon,
    });
    expect(presentation.artifactPath).toBe("/tmp/notes.md");
  });

  it("surfaces an artifactPath for completed image writes (.png)", () => {
    const presentation = buildToolCallPresentation({
      toolName: "Write",
      status: "completed",
      error: null,
      detail: { type: "write", filePath: "/tmp/repo/screenshot.png", content: "" },
      resolveIcon: fakeResolveIcon,
    });
    expect(presentation.artifactPath).toBe("/tmp/repo/screenshot.png");
  });

  it("surfaces an artifactPath for completed video writes (.mp4)", () => {
    const presentation = buildToolCallPresentation({
      toolName: "Write",
      status: "completed",
      error: null,
      detail: { type: "write", filePath: "/tmp/repo/demo.mp4", content: "" },
      resolveIcon: fakeResolveIcon,
    });
    expect(presentation.artifactPath).toBe("/tmp/repo/demo.mp4");
  });

  it("surfaces an artifactPath for bash redirect to .png", () => {
    const presentation = buildToolCallPresentation({
      toolName: "Bash",
      status: "completed",
      error: null,
      detail: {
        type: "shell",
        command: "screencapture /tmp/cap.png && echo done > /tmp/cap.png",
      },
      resolveIcon: fakeResolveIcon,
    });
    expect(presentation.artifactPath).toBe("/tmp/cap.png");
  });

  it("does not surface an artifact for non-markdown writes", () => {
    const presentation = buildToolCallPresentation({
      toolName: "Write",
      status: "completed",
      error: null,
      detail: { type: "write", filePath: "/tmp/x.ts", content: "" },
      resolveIcon: fakeResolveIcon,
    });
    expect(presentation.artifactPath).toBeNull();
  });

  it("does not surface an artifact for markdown reads", () => {
    const presentation = buildToolCallPresentation({
      toolName: "read_file",
      status: "completed",
      error: null,
      detail: { type: "read", filePath: "/tmp/r.md", content: "" },
      resolveIcon: fakeResolveIcon,
    });
    expect(presentation.artifactPath).toBeNull();
  });

  it("does not surface an artifact for failed or running writes", () => {
    const running = buildToolCallPresentation({
      toolName: "Write",
      status: "running",
      error: null,
      detail: { type: "write", filePath: "/tmp/r.md", content: "" },
      resolveIcon: fakeResolveIcon,
    });
    expect(running.artifactPath).toBeNull();

    const failed = buildToolCallPresentation({
      toolName: "Write",
      status: "failed",
      error: new Error("nope"),
      detail: { type: "write", filePath: "/tmp/r.md", content: "" },
      resolveIcon: fakeResolveIcon,
    });
    expect(failed.artifactPath).toBeNull();
  });

  it("keeps plan calls out of the expandable badge path", () => {
    const presentation = buildToolCallPresentation({
      toolName: "ExitPlanMode",
      status: "completed",
      error: null,
      detail: {
        type: "plan",
        text: "1. Do the thing",
      },
      resolveIcon: fakeResolveIcon,
    });

    expect(presentation.isPlan).toBe(true);
    expect(presentation.icon).toBe(fakeIcons.brain);
  });
});
