/**
 * Format an ISO-8601 timestamp as "Xm ago" / "Xh ago" / "Xd ago".
 * Returns "just now" for sub-minute (and clock-skew negative) deltas, and
 * an em-dash for unparseable input. Intentionally non-locale-aware — the
 * caller wants compact, glanceable strings, not internationalized prose.
 */
export function formatRelativeTime(iso: string, now: Date = new Date()): string {
  const parsed = Date.parse(iso);
  if (Number.isNaN(parsed)) return "—";
  const diffSec = Math.max(0, Math.floor((now.getTime() - parsed) / 1000));
  if (diffSec < 60) return "just now";
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86_400) return `${Math.floor(diffSec / 3600)}h ago`;
  return `${Math.floor(diffSec / 86_400)}d ago`;
}
