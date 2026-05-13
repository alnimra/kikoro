import type { SubscriptionUsageSnapshot } from "@server/shared/messages";
import { useSessionStore } from "@/stores/session-store";

/**
 * Subscribe to the latest codexbar subscription-usage snapshot for a host.
 *
 * The daemon broadcasts these via `subscription_usage_updated` status payloads
 * (see packages/server/src/server/codexbar/service.ts). Older daemons without
 * `server_info.features.codexbarUsage` never emit them; callers should also
 * check the feature flag before rendering.
 */
export function useSubscriptionUsage(serverId: string | null): SubscriptionUsageSnapshot | null {
  return useSessionStore((state) => {
    if (!serverId) return null;
    return state.sessions[serverId]?.subscriptionUsage ?? null;
  });
}

/**
 * Returns true when the daemon advertises codexbarUsage support in its
 * server_info handshake. The subscriptions screen is hidden when false.
 */
export function useHasCodexbarFeature(serverId: string | null): boolean {
  return useSessionStore((state) => {
    if (!serverId) return false;
    return state.sessions[serverId]?.serverInfo?.features?.codexbarUsage === true;
  });
}
