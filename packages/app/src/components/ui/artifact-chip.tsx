import React, { useCallback, useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import { ChevronRight, FileText } from "lucide-react-native";

interface ArtifactChipProps {
  filename: string;
  onPress?: () => void;
  accessibilityLabel?: string;
}

function basename(filePath: string): string {
  const trimmed = filePath.replace(/\/+$/, "");
  const idx = trimmed.lastIndexOf("/");
  return idx >= 0 ? trimmed.slice(idx + 1) : trimmed;
}

export function ArtifactChip({ filename, onPress, accessibilityLabel }: ArtifactChipProps) {
  const [isHovered, setIsHovered] = useState(false);
  const display = useMemo(() => basename(filename) || filename, [filename]);
  const handleHoverIn = useCallback(() => setIsHovered(true), []);
  const handleHoverOut = useCallback(() => setIsHovered(false), []);
  const computePressableStyle = useCallback(
    ({ pressed }: { pressed: boolean }) => [
      styles.row,
      isHovered && styles.rowHover,
      pressed && styles.rowPressed,
    ],
    [isHovered],
  );

  return (
    <Pressable
      onPress={onPress}
      onHoverIn={handleHoverIn}
      onHoverOut={handleHoverOut}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? `Open ${display}`}
      testID="artifact-chip"
      style={computePressableStyle}
      hitSlop={4}
    >
      <ChipIcons display={display} />
    </Pressable>
  );
}

// Leaf component for icon coloring per docs/unistyles.md rule #4: lucide icons
// take a raw `color` prop, so a small useUnistyles read is justified to honor
// the active theme. Pressable parent is the hot render path; this leaf is not.
function ChipIcons({ display }: { display: string }) {
  const { theme } = useUnistyles();
  const muted = theme.colors.foregroundMuted;
  const fg = theme.colors.foreground;
  return (
    <View style={styles.bodyRow}>
      <FileText size={14} color={muted} />
      <Text style={styles.filename} numberOfLines={1}>
        {display}
      </Text>
      <ChevronRight size={14} color={fg} />
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  row: {
    minHeight: 44,
    marginTop: theme.spacing[1],
    paddingHorizontal: theme.spacing[3],
    paddingVertical: theme.spacing[2],
    borderRadius: theme.borderRadius.md,
    backgroundColor: "transparent",
    justifyContent: "center",
  },
  rowHover: {
    backgroundColor: theme.colors.surface2,
  },
  rowPressed: {
    opacity: 0.7,
  },
  bodyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing[2],
  },
  filename: {
    flex: 1,
    fontSize: theme.fontSize.base,
    fontWeight: theme.fontWeight.normal,
    color: theme.colors.foreground,
  },
}));
