import { useEffect, useMemo, useState } from "react";
import { Text, View } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import type { SubscriptionProviderCost, SubscriptionUsageSnapshot } from "@server/shared/messages";
import { useHasCodexbarFeature, useSubscriptionUsage } from "@/hooks/use-subscription-usage";
import { useHostRuntimeIsConnected } from "@/runtime/host-runtime";
import { SettingsSection } from "@/screens/settings/settings-section";
import { settingsStyles } from "@/styles/settings";
import { formatRelativeTime } from "@/utils/format-relative-time";

interface SubscriptionsSectionProps {
  serverId: string | null;
}

const PROVIDER_LABELS: Record<string, string> = {
  codex: "Codex",
  claude: "Claude",
  cursor: "Cursor",
  copilot: "Copilot",
  gemini: "Gemini",
};

const REFRESH_TICK_MS = 60_000;

/**
 * Codexbar subscription tracking. Shows per-provider session + last-30-day
 * usage for the codexbar.app data the daemon polls. Driven entirely by
 * snapshots arriving over the existing WebSocket — no separate transport.
 *
 * Hidden when the connected daemon does not advertise
 * `server_info.features.codexbarUsage` (kikoro 1.1.0+).
 */
export function SubscriptionsSection({ serverId }: SubscriptionsSectionProps) {
  const hasFeature = useHasCodexbarFeature(serverId);
  const snapshot = useSubscriptionUsage(serverId);
  const isConnected = useHostRuntimeIsConnected(serverId ?? "");

  // Force re-render once a minute so the "Updated Xm ago" string ticks.
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), REFRESH_TICK_MS);
    return () => clearInterval(id);
  }, []);

  if (!serverId) {
    return (
      <SettingsSection title="Subscriptions">
        <Text style={settingsStyles.rowHint}>Connect to a host to see Codex and Claude usage.</Text>
      </SettingsSection>
    );
  }

  if (!hasFeature) {
    return (
      <SettingsSection title="Subscriptions">
        <Text style={settingsStyles.rowHint}>
          This host does not support subscription tracking yet. It requires the kikoro 1.1.0 daemon
          and CodexBar.app installed on the Mac.
        </Text>
      </SettingsSection>
    );
  }

  return (
    <View>
      <StateBanner snapshot={snapshot} isConnected={isConnected} />
      <ProviderList snapshot={snapshot} />
    </View>
  );
}

function StateBanner({
  snapshot,
  isConnected,
}: {
  snapshot: SubscriptionUsageSnapshot | null;
  isConnected: boolean;
}) {
  const capturedAt = snapshot?.capturedAt;
  const trailing = useMemo(
    () => (capturedAt ? <UpdatedAt iso={capturedAt} /> : null),
    [capturedAt],
  );
  if (!snapshot) {
    return (
      <SettingsSection title="Subscriptions">
        <Text style={settingsStyles.rowHint}>
          {isConnected
            ? "Loading codexbar usage…"
            : "Disconnected — last known totals shown when connected."}
        </Text>
      </SettingsSection>
    );
  }
  if (snapshot.status === "ok") {
    return (
      <SettingsSection title="Subscriptions" trailing={trailing}>
        <Text style={settingsStyles.rowHint}>{summarizeProviders(snapshot.providers)}</Text>
      </SettingsSection>
    );
  }
  return (
    <SettingsSection title="Subscriptions" trailing={trailing}>
      <Text style={settingsStyles.rowHint}>{describeStatus(snapshot)}</Text>
    </SettingsSection>
  );
}

function summarizeProviders(providers: readonly SubscriptionProviderCost[]): string {
  if (providers.length === 0) {
    return "CodexBar hasn't returned any provider totals yet. Start CodexBar.app on the Mac if it isn't running.";
  }
  // Hero: one sentence covering today's spend across the providers we have.
  const todays = providers
    .filter((p) => typeof p.sessionCostUsd === "number")
    .map(
      (p) => `${PROVIDER_LABELS[p.provider] ?? p.provider}: ${formatUsd(p.sessionCostUsd)} today`,
    );
  if (todays.length === 0) {
    return "CodexBar has no session totals to show yet.";
  }
  return todays.join(" · ");
}

function describeStatus(snapshot: SubscriptionUsageSnapshot): string {
  switch (snapshot.status) {
    case "loading":
      return "Loading codexbar usage…";
    case "cli_missing":
      return "CodexBar CLI not found. Open CodexBar.app → Preferences → Advanced → Install CLI.";
    case "cli_error":
      return `CodexBar reported an error: ${snapshot.error?.message ?? "unknown"}`;
    case "parse_error":
      return "CodexBar returned an unexpected format. Update CodexBar.app or kikoro.";
    case "timeout":
      return "CodexBar timed out. Try again in a moment.";
    case "stale":
      return `Showing cached totals — ${snapshot.error?.message ?? "data may be out of date"}.`;
    default:
      return "No data.";
  }
}

function ProviderList({ snapshot }: { snapshot: SubscriptionUsageSnapshot | null }) {
  const providers = useMemo<readonly SubscriptionProviderCost[]>(
    () => sortProviders(snapshot?.providers ?? []),
    [snapshot?.providers],
  );
  if (providers.length === 0) {
    return null;
  }
  return (
    <SettingsSection title="Per-provider">
      {providers.map((provider, index) => (
        <ProviderRow
          key={provider.provider || `provider-${index}`}
          provider={provider}
          isFirst={index === 0}
        />
      ))}
    </SettingsSection>
  );
}

function sortProviders(
  providers: readonly SubscriptionProviderCost[],
): readonly SubscriptionProviderCost[] {
  const order = ["codex", "claude"];
  return [...providers].sort((a, b) => {
    const ai = order.indexOf(a.provider);
    const bi = order.indexOf(b.provider);
    if (ai !== -1 || bi !== -1) {
      return (
        (ai === -1 ? Number.MAX_SAFE_INTEGER : ai) - (bi === -1 ? Number.MAX_SAFE_INTEGER : bi)
      );
    }
    return a.provider.localeCompare(b.provider);
  });
}

function ProviderRow({
  provider,
  isFirst,
}: {
  provider: SubscriptionProviderCost;
  isFirst: boolean;
}) {
  const label = PROVIDER_LABELS[provider.provider] ?? provider.provider;
  const rowStyle = useMemo(
    () => [settingsStyles.row, !isFirst && settingsStyles.rowBorder, styles.row],
    [isFirst],
  );
  return (
    <View style={rowStyle}>
      <View style={styles.rowLeft}>
        <Text style={settingsStyles.rowTitle}>{label}</Text>
        <Text
          style={settingsStyles.rowHint}
          accessibilityLabel={a11yLabelForProvider(provider, label)}
        >
          {`Today ${formatUsd(provider.sessionCostUsd)} · 30d ${formatUsd(provider.last30DaysCostUsd)}`}
        </Text>
      </View>
      <View style={styles.rowRight}>
        <Text style={styles.rowValue}>{formatTokens(provider.last30DaysTokens)}</Text>
        <Text style={settingsStyles.rowHint}>30d tokens</Text>
      </View>
    </View>
  );
}

function a11yLabelForProvider(provider: SubscriptionProviderCost, label: string): string {
  return [
    `${label} subscription`,
    typeof provider.sessionCostUsd === "number"
      ? `today ${formatUsd(provider.sessionCostUsd)}`
      : null,
    typeof provider.last30DaysCostUsd === "number"
      ? `last thirty days ${formatUsd(provider.last30DaysCostUsd)}`
      : null,
  ]
    .filter((s): s is string => s !== null)
    .join(", ");
}

function formatUsd(value: number | undefined): string {
  if (typeof value !== "number" || Number.isNaN(value)) return "—";
  if (value >= 100) return `$${value.toFixed(0)}`;
  if (value >= 10) return `$${value.toFixed(1)}`;
  return `$${value.toFixed(2)}`;
}

function formatTokens(value: number | undefined): string {
  if (typeof value !== "number" || Number.isNaN(value)) return "—";
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(2)}B`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(0)}K`;
  return value.toString();
}

function UpdatedAt({ iso }: { iso: string }) {
  return <Text style={settingsStyles.rowHint}>{`Updated ${formatRelativeTime(iso)}`}</Text>;
}

const styles = StyleSheet.create((theme) => ({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: theme.spacing[3],
    gap: theme.spacing[3],
  },
  rowLeft: {
    flex: 1,
    gap: theme.spacing[1],
  },
  rowRight: {
    alignItems: "flex-end",
    gap: theme.spacing[1],
  },
  rowValue: {
    color: theme.colors.foreground,
    fontSize: theme.fontSize.base,
    fontVariant: ["tabular-nums"],
  },
}));
