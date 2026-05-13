import { useEffect, useMemo, useState } from "react";
import { Text, View } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import type {
  QuotaWindow,
  SubscriptionExtraWindow,
  SubscriptionProviderCost,
  SubscriptionUsageSnapshot,
} from "@server/shared/messages";
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
 * Codexbar subscription tracking. Shows per-provider quota windows
 * (Session / Weekly / extras like Sonnet / Designs / Daily Routines) as bars
 * with % left + reset countdown + plan tier + account.
 *
 * Driven entirely by snapshots arriving over the existing WebSocket — no
 * separate transport. Hidden when the connected daemon does not advertise
 * `server_info.features.codexbarUsage` (kikoro 1.1.0+).
 *
 * 1.2.0 redesign: replaces the 1.1.0 dollar-totals UI. The old dollar fields
 * remain in the wire schema as deprecated (.optional) for back-compat with
 * v1.1.0 daemons — but a v1.2.0 daemon doesn't populate them, so showing
 * "Today $0" would be wrong. We render quota windows exclusively.
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
          This host does not support subscription tracking yet. It requires the kikoro 1.1.0+ daemon
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
            : "Disconnected — last known usage shown when connected."}
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
    return "CodexBar hasn't returned any provider data yet. Start CodexBar.app on the Mac if it isn't running.";
  }
  const succeeded = providers.filter((p) => p.primary !== undefined);
  if (succeeded.length === 0) {
    return "CodexBar reported no usable quota data — check that you're signed in to your providers in CodexBar.app.";
  }
  const minPct = succeeded
    .map((p) => percentLeft(p.primary))
    .filter((n): n is number => n !== null)
    .reduce<number | null>((acc, n) => (acc === null || n < acc ? n : acc), null);
  if (minPct === null) {
    return `${succeeded.length} provider${succeeded.length === 1 ? "" : "s"} tracked.`;
  }
  return `${minPct}% left on the lowest quota window across ${succeeded.length} provider${succeeded.length === 1 ? "" : "s"}.`;
}

function describeStatus(snapshot: SubscriptionUsageSnapshot): string {
  switch (snapshot.status) {
    case "loading":
      return "Loading codexbar usage…";
    case "cli_missing":
      return "CodexBar CLI not found. Make sure CodexBar.app is installed and running on the Mac.";
    case "cli_error":
      return `CodexBar reported an error: ${snapshot.error?.message ?? "unknown"}`;
    case "parse_error":
      return "CodexBar returned an unexpected format. Update CodexBar.app or kikoro.";
    case "timeout":
      return "CodexBar timed out. Try again in a moment.";
    case "stale":
      return `Showing cached usage — ${snapshot.error?.message ?? "data may be out of date"}.`;
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
    <View style={styles.cards}>
      {providers.map((provider, index) => (
        <ProviderCard key={provider.provider || `provider-${index}`} provider={provider} />
      ))}
    </View>
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

function ProviderCard({ provider }: { provider: SubscriptionProviderCost }) {
  const label = PROVIDER_LABELS[provider.provider] ?? provider.provider;
  const plan = provider.identity?.loginMethod;
  const account = provider.identity?.accountEmail;

  // Per-provider error case — show a one-line explanation, no bars.
  if (provider.providerError) {
    return (
      <View style={styles.card} accessibilityLabel={`${label} subscription error`}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>{label}</Text>
          {plan ? <Text style={styles.cardPlan}>{plan}</Text> : null}
        </View>
        <Text style={settingsStyles.rowHint}>
          {provider.providerError.message || "Provider reported an error."}
        </Text>
      </View>
    );
  }

  // No usage data and no error — provider was returned but empty.
  if (!provider.primary && !provider.secondary && !provider.extraWindows?.length) {
    return null;
  }

  return (
    <View style={styles.card} accessibilityLabel={a11yLabelForProvider(provider, label)}>
      <View style={styles.cardHeader}>
        <View style={styles.cardHeaderLeft}>
          <Text style={styles.cardTitle}>{label}</Text>
          {account ? <Text style={styles.cardAccount}>{account}</Text> : null}
        </View>
        {plan ? <Text style={styles.cardPlan}>{plan}</Text> : null}
      </View>

      {provider.primary ? <QuotaWindowRow title="Session" window={provider.primary} /> : null}
      {provider.secondary ? <QuotaWindowRow title="Weekly" window={provider.secondary} /> : null}
      {provider.tertiary ? <QuotaWindowRow title="Tertiary" window={provider.tertiary} /> : null}
      {(provider.extraWindows ?? []).map((extra) => (
        <ExtraWindowRow key={extra.id} extra={extra} />
      ))}
    </View>
  );
}

function QuotaWindowRow({ title, window }: { title: string; window: QuotaWindow }) {
  const pct = percentLeft(window);
  const pctLabel = pct !== null ? `${pct}% left` : "—";
  const reset = formatReset(window);
  return (
    <View style={styles.windowRow}>
      <View style={styles.windowLabelRow}>
        <Text style={styles.windowTitle}>{title}</Text>
        <Text style={styles.windowPct}>{pctLabel}</Text>
      </View>
      <ProgressBar pctLeft={pct} />
      {reset ? <Text style={styles.windowReset}>{reset}</Text> : null}
    </View>
  );
}

function ExtraWindowRow({ extra }: { extra: SubscriptionExtraWindow }) {
  const pct = percentLeft(extra.window);
  const pctLabel = pct !== null ? `${pct}% left` : "—";
  return (
    <View style={styles.windowRow}>
      <View style={styles.windowLabelRow}>
        <Text style={styles.windowTitle}>{extra.title}</Text>
        <Text style={styles.windowPct}>{pctLabel}</Text>
      </View>
      <ProgressBar pctLeft={pct} />
    </View>
  );
}

function ProgressBar({ pctLeft }: { pctLeft: number | null }) {
  const safePct = pctLeft === null ? 0 : Math.max(0, Math.min(100, pctLeft));
  const fillStyle = useMemo(
    () => [styles.barFill, { width: `${safePct}%` as `${number}%` }, barColorStyle(safePct)],
    [safePct],
  );
  return (
    <View style={styles.barTrack}>
      <View style={fillStyle} />
    </View>
  );
}

function barColorStyle(pctLeft: number) {
  if (pctLeft < 20) return styles.barFillLow;
  if (pctLeft < 50) return styles.barFillMid;
  return styles.barFillHigh;
}

/** Returns "% left" as 0–100 integer, or null when input is malformed. */
export function percentLeft(window: QuotaWindow | undefined): number | null {
  if (!window || typeof window.usedPercent !== "number" || Number.isNaN(window.usedPercent)) {
    return null;
  }
  const left = 100 - window.usedPercent;
  return Math.max(0, Math.min(100, Math.round(left)));
}

/** Returns "Resets in 4h 55m" / "Resets May 19, 2026 at 12:27" / null. */
function formatReset(window: QuotaWindow): string | null {
  if (window.resetsAt) {
    const remaining = formatDurationUntil(window.resetsAt);
    if (remaining) return `Resets in ${remaining}`;
  }
  if (window.resetDescription) return `Resets ${window.resetDescription}`;
  return null;
}

function formatDurationUntil(iso: string): string | null {
  const reset = Date.parse(iso);
  if (Number.isNaN(reset)) return null;
  const now = Date.now();
  const diffMs = reset - now;
  if (diffMs <= 0) return "now";
  const totalMin = Math.floor(diffMs / 60_000);
  const days = Math.floor(totalMin / (60 * 24));
  const hours = Math.floor((totalMin % (60 * 24)) / 60);
  const mins = totalMin % 60;
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

function a11yLabelForProvider(provider: SubscriptionProviderCost, label: string): string {
  const parts: string[] = [`${label} subscription`];
  if (provider.identity?.loginMethod) parts.push(`plan ${provider.identity.loginMethod}`);
  const sessionPct = percentLeft(provider.primary);
  if (sessionPct !== null) parts.push(`session ${sessionPct} percent left`);
  const weeklyPct = percentLeft(provider.secondary);
  if (weeklyPct !== null) parts.push(`weekly ${weeklyPct} percent left`);
  return parts.join(", ");
}

function UpdatedAt({ iso }: { iso: string }) {
  return <Text style={settingsStyles.rowHint}>{`Updated ${formatRelativeTime(iso)}`}</Text>;
}

const styles = StyleSheet.create((theme) => ({
  cards: {
    gap: theme.spacing[3],
    paddingTop: theme.spacing[2],
  },
  card: {
    backgroundColor: theme.colors.surface2,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing[4],
    gap: theme.spacing[3],
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.spacing[2],
  },
  cardHeaderLeft: {
    flex: 1,
    gap: 2,
  },
  cardTitle: {
    color: theme.colors.foreground,
    fontSize: theme.fontSize.lg,
    fontWeight: "600",
  },
  cardAccount: {
    color: theme.colors.foregroundMuted,
    fontSize: theme.fontSize.sm,
  },
  cardPlan: {
    color: theme.colors.foregroundMuted,
    fontSize: theme.fontSize.sm,
  },
  windowRow: {
    gap: 6,
  },
  windowLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  windowTitle: {
    color: theme.colors.foreground,
    fontSize: theme.fontSize.base,
    fontWeight: "500",
  },
  windowPct: {
    color: theme.colors.foreground,
    fontSize: theme.fontSize.base,
    fontVariant: ["tabular-nums"],
  },
  windowReset: {
    color: theme.colors.foregroundMuted,
    fontSize: theme.fontSize.sm,
  },
  barTrack: {
    height: 8,
    backgroundColor: theme.colors.muted,
    borderRadius: 4,
    overflow: "hidden",
  },
  barFill: {
    height: "100%",
    borderRadius: 4,
  },
  barFillHigh: {
    backgroundColor: theme.colors.success,
  },
  barFillMid: {
    backgroundColor: theme.colors.statusWarning,
  },
  barFillLow: {
    backgroundColor: theme.colors.destructive,
  },
}));
