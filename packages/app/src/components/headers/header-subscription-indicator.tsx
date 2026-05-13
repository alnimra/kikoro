import { useCallback, useMemo } from "react";
import { Pressable, Text, View } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import { router, usePathname } from "expo-router";
import type { SubscriptionProviderCost } from "@server/shared/messages";
import { useHasCodexbarFeature, useSubscriptionUsage } from "@/hooks/use-subscription-usage";
import { parseServerIdFromPathname } from "@/utils/host-routes";
import { percentLeft as quotaPercentLeft } from "@/screens/settings/subscriptions-section";

/**
 * Small header chip showing the lowest `% left` across all tracked quota
 * windows for the active host's providers. Tap → navigates to the
 * Subscriptions settings screen.
 *
 * Renders nothing when:
 *   - there is no serverId in the path,
 *   - the daemon does not advertise `codexbarUsage`,
 *   - the snapshot is missing, in error state, or has no usable primary window.
 *
 * Color-coded: green (≥50%), yellow (20-49%), red (<20%).
 */
export function HeaderSubscriptionIndicator() {
  const pathname = usePathname();
  const serverId = useMemo(() => parseServerIdFromPathname(pathname), [pathname]);
  const hasFeature = useHasCodexbarFeature(serverId);
  const snapshot = useSubscriptionUsage(serverId);

  const lowestPctLeft = useMemo(() => {
    if (!hasFeature || !snapshot) return null;
    if (snapshot.status !== "ok" && snapshot.status !== "stale") return null;
    return lowestWindowPercentLeft(snapshot.providers);
  }, [hasFeature, snapshot]);

  const accent = useMemo(
    () => (lowestPctLeft === null ? null : colorStyleForPercentLeft(lowestPctLeft)),
    [lowestPctLeft],
  );
  const chipStyle = useMemo(() => (accent ? [styles.chip, accent.chip] : null), [accent]);
  const dotStyle = useMemo(() => (accent ? [styles.dot, accent.dot] : null), [accent]);
  const handlePress = useCallback(() => {
    router.push("/settings/subscriptions");
  }, []);

  if (lowestPctLeft === null) return null;

  return (
    <Pressable
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel={`${lowestPctLeft} percent left, open subscriptions`}
      style={styles.pressable}
      testID="header-subscription-indicator"
    >
      <View style={chipStyle}>
        <View style={dotStyle} />
        <Text style={styles.label}>{`${lowestPctLeft}%`}</Text>
      </View>
    </Pressable>
  );
}

function lowestWindowPercentLeft(providers: readonly SubscriptionProviderCost[]): number | null {
  let lowest: number | null = null;
  for (const provider of providers) {
    const candidates = [
      quotaPercentLeft(provider.primary),
      quotaPercentLeft(provider.secondary),
      provider.tertiary ? quotaPercentLeft(provider.tertiary) : null,
      ...(provider.extraWindows?.map((w) => quotaPercentLeft(w.window)) ?? []),
    ];
    for (const value of candidates) {
      if (value === null) continue;
      if (lowest === null || value < lowest) lowest = value;
    }
  }
  return lowest;
}

function colorStyleForPercentLeft(pctLeft: number) {
  if (pctLeft < 20) return { chip: styles.chipLow, dot: styles.dotLow };
  if (pctLeft < 50) return { chip: styles.chipMid, dot: styles.dotMid };
  return { chip: styles.chipHigh, dot: styles.dotHigh };
}

const styles = StyleSheet.create((theme) => ({
  pressable: {
    paddingHorizontal: theme.spacing[1],
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  label: {
    color: theme.colors.foreground,
    fontSize: theme.fontSize.sm,
    fontVariant: ["tabular-nums"],
    fontWeight: "500",
  },
  chipHigh: {
    borderColor: theme.colors.success,
    backgroundColor: theme.colors.surface1,
  },
  chipMid: {
    borderColor: theme.colors.statusWarning,
    backgroundColor: theme.colors.surface1,
  },
  chipLow: {
    borderColor: theme.colors.destructive,
    backgroundColor: theme.colors.surface1,
  },
  dotHigh: {
    backgroundColor: theme.colors.success,
  },
  dotMid: {
    backgroundColor: theme.colors.statusWarning,
  },
  dotLow: {
    backgroundColor: theme.colors.destructive,
  },
}));
