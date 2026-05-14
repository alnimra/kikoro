// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

// Stub Unistyles so the chip can import without bringing the real native runtime
// into a jsdom environment. We don't assert theme-driven visuals here — that's
// what visual QA is for; this test covers render + press wiring.
const fakeTheme = {
  colors: { foreground: "#000", foregroundMuted: "#888", surface2: "#eee" },
  spacing: { 1: 4, 2: 8, 3: 12 },
  fontSize: { base: 16 },
  fontWeight: { normal: "400" as const },
  borderRadius: { md: 6 },
};

vi.mock("react-native-unistyles", () => ({
  StyleSheet: {
    create: (factory: (theme: typeof fakeTheme) => unknown) => factory(fakeTheme),
  },
  useUnistyles: () => ({ theme: fakeTheme }),
}));

vi.mock("lucide-react-native", () => ({
  FileText: (props: Record<string, unknown>) =>
    React.createElement("svg", { "data-testid": "icon-filetext", ...props }),
  ChevronRight: (props: Record<string, unknown>) =>
    React.createElement("svg", { "data-testid": "icon-chevron", ...props }),
}));

vi.mock("react-native", () => {
  const React2 = require("react");
  function passthrough(tag: string) {
    return React2.forwardRef(function Passthrough(props: Record<string, unknown>, ref: unknown) {
      const { children, ...rest } = props;
      return React2.createElement(tag, { ref, ...rest }, children);
    });
  }
  return {
    View: passthrough("div"),
    Text: passthrough("span"),
    Pressable: React2.forwardRef(function PressableMock(
      props: Record<string, unknown>,
      ref: unknown,
    ) {
      const { children, onPress, accessibilityRole, accessibilityLabel, testID } = props;
      return React2.createElement(
        "button",
        {
          ref,
          type: "button",
          role: accessibilityRole,
          "aria-label": accessibilityLabel,
          "data-testid": testID,
          onClick: onPress,
        },
        typeof children === "function" ? children({ pressed: false }) : children,
      );
    }),
  };
});

const { ArtifactChip } = await import("./artifact-chip");

afterEach(() => cleanup());

describe("<ArtifactChip>", () => {
  it("renders the basename of a deep path", () => {
    render(<ArtifactChip filename="/Users/rei/Documents/StudioAfima/retro.md" />);
    expect(screen.getByText("retro.md")).toBeTruthy();
  });

  it("renders the full string when no slash is present", () => {
    render(<ArtifactChip filename="notes.md" />);
    expect(screen.getByText("notes.md")).toBeTruthy();
  });

  it("invokes onPress when tapped", () => {
    const onPress = vi.fn();
    render(<ArtifactChip filename="/tmp/a.md" onPress={onPress} />);
    fireEvent.click(screen.getByTestId("artifact-chip"));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("uses default accessibility label derived from filename", () => {
    render(<ArtifactChip filename="/tmp/a.md" />);
    expect(screen.getByLabelText("Open a.md")).toBeTruthy();
  });

  it("honors a custom accessibility label when provided", () => {
    render(<ArtifactChip filename="/tmp/a.md" accessibilityLabel="Open retro from 2026-05-14" />);
    expect(screen.getByLabelText("Open retro from 2026-05-14")).toBeTruthy();
  });

  it("renders both the leading file icon and trailing chevron", () => {
    render(<ArtifactChip filename="x.md" />);
    expect(screen.getByTestId("icon-filetext")).toBeTruthy();
    expect(screen.getByTestId("icon-chevron")).toBeTruthy();
  });
});
