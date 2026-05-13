import { describe, expect, it } from "vitest";

import { formatRelativeTime } from "./format-relative-time";

describe("formatRelativeTime", () => {
  const now = new Date("2026-05-13T05:00:00Z");

  it("returns 'just now' for sub-minute deltas", () => {
    expect(formatRelativeTime("2026-05-13T04:59:30Z", now)).toBe("just now");
  });

  it("returns minute granularity for under-an-hour deltas", () => {
    expect(formatRelativeTime("2026-05-13T04:55:00Z", now)).toBe("5m ago");
    expect(formatRelativeTime("2026-05-13T04:01:00Z", now)).toBe("59m ago");
  });

  it("returns hour granularity for under-a-day deltas", () => {
    expect(formatRelativeTime("2026-05-13T01:00:00Z", now)).toBe("4h ago");
    expect(formatRelativeTime("2026-05-12T06:00:01Z", now)).toBe("22h ago");
  });

  it("returns day granularity beyond 24 hours", () => {
    expect(formatRelativeTime("2026-05-11T05:00:00Z", now)).toBe("2d ago");
  });

  it("clamps negative deltas to 'just now' (clock skew)", () => {
    expect(formatRelativeTime("2026-05-13T05:00:05Z", now)).toBe("just now");
  });

  it("returns em-dash for unparseable input", () => {
    expect(formatRelativeTime("not-a-date", now)).toBe("—");
  });
});
