import { beforeEach, describe, expect, it } from "vitest";
import type { SubscriptionUsageSnapshot } from "@server/shared/messages";
import { useSessionStore } from "@/stores/session-store";

describe("session-store subscription usage", () => {
  const serverId = "test-server";

  beforeEach(() => {
    // Reset the store between tests by clearing the sessions map.
    useSessionStore.setState({ sessions: {} });
    // Initialize an empty session record (mirrors what initializeSession does
    // minus the client wiring we don't need here).
    const action = useSessionStore.getState();
    action.initializeSession(serverId, {
      // We only need the minimum to attach a session; the store doesn't call
      // any methods of the client in the subscription-usage path.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
  });

  it("starts with null subscriptionUsage on a fresh session", () => {
    const session = useSessionStore.getState().getSession(serverId);
    expect(session?.subscriptionUsage).toBeNull();
  });

  it("updateSubscriptionUsage writes the snapshot for the given session", () => {
    const snapshot: SubscriptionUsageSnapshot = {
      status: "ok",
      capturedAt: "2026-05-13T05:00:00Z",
      providers: [
        {
          provider: "codex",
          source: "codex-cli",
          identity: { accountEmail: "m@ray.vin", loginMethod: "pro", providerId: "codex" },
          primary: { usedPercent: 0, windowMinutes: 300, resetsAt: "2026-05-13T19:20:45Z" },
          secondary: { usedPercent: 0, windowMinutes: 10080 },
          credits: { remaining: 0 },
        },
      ],
      cliVersion: "0.25.1",
    };
    useSessionStore.getState().updateSubscriptionUsage(serverId, snapshot);
    const session = useSessionStore.getState().getSession(serverId);
    expect(session?.subscriptionUsage).toEqual(snapshot);
  });

  it("does not re-emit when the next snapshot is structurally equal", () => {
    const snapshot: SubscriptionUsageSnapshot = {
      status: "ok",
      capturedAt: "2026-05-13T05:00:00Z",
      providers: [
        {
          provider: "codex",
          source: "codex-cli",
          identity: { accountEmail: "m@ray.vin", loginMethod: "pro", providerId: "codex" },
          primary: { usedPercent: 0, windowMinutes: 300, resetsAt: "2026-05-13T19:20:45Z" },
          secondary: { usedPercent: 0, windowMinutes: 10080 },
          credits: { remaining: 0 },
        },
      ],
      cliVersion: "0.25.1",
    };
    useSessionStore.getState().updateSubscriptionUsage(serverId, snapshot);
    const ref1 = useSessionStore.getState().getSession(serverId)?.subscriptionUsage;
    // Identical-shaped re-emit: store should keep the same reference.
    useSessionStore.getState().updateSubscriptionUsage(serverId, { ...snapshot });
    const ref2 = useSessionStore.getState().getSession(serverId)?.subscriptionUsage;
    expect(ref2).toBe(ref1);
  });

  it("is a no-op when the session does not exist", () => {
    useSessionStore.setState({ sessions: {} });
    useSessionStore.getState().updateSubscriptionUsage("missing", {
      status: "ok",
      capturedAt: "2026-05-13T05:00:00Z",
      providers: [],
    });
    expect(useSessionStore.getState().sessions["missing"]).toBeUndefined();
  });
});
