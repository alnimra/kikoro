import {
  ServerInfoStatusPayloadSchema,
  SubscriptionUsageSnapshotSchema,
  KnownStatusPayloadSchema,
} from "../packages/server/dist/server/shared/messages.js";

// Case 1: old daemon (no codexbarUsage field) — new client must still parse
const oldDaemonPayload = {
  status: "server_info",
  serverId: "abc",
  hostname: "old-mac",
  version: "0.1.50",
  features: { providersSnapshot: true },
};
const r1 = ServerInfoStatusPayloadSchema.safeParse(oldDaemonPayload);
console.log(
  "[1] OLD daemon → new client parse:",
  r1.success ? "PASS" : "FAIL",
  r1.success ? `(features.codexbarUsage = ${r1.data.features?.codexbarUsage})` : r1.error?.issues?.[0]?.message,
);

// Case 2: new daemon (with codexbarUsage) — new client parses
const newDaemonPayload = {
  status: "server_info",
  serverId: "abc",
  hostname: "new-mac",
  version: "0.1.75-kikoro",
  features: { providersSnapshot: true, codexbarUsage: true },
};
const r2 = ServerInfoStatusPayloadSchema.safeParse(newDaemonPayload);
console.log(
  "[2] NEW daemon → new client parse:",
  r2.success ? "PASS" : "FAIL",
  r2.success ? `(features.codexbarUsage = ${r2.data.features?.codexbarUsage})` : r2.error?.issues?.[0]?.message,
);

// Case 3: subscription_usage_updated with future-extra fields (passthrough must survive)
const futurePayload = {
  status: "subscription_usage_updated",
  snapshot: {
    status: "ok",
    capturedAt: "2026-05-13T05:00:00Z",
    providers: [{ provider: "codex", sessionCostUsd: 49.49, FUTURE_FIELD: "xyz" }],
    cliVersion: "0.25.1",
  },
  EXTRA_FUTURE_FIELD: 42,
};
const r3 = KnownStatusPayloadSchema.safeParse(futurePayload);
console.log(
  "[3] USAGE-msg parse with FUTURE_FIELDS:",
  r3.success ? "PASS" : "FAIL",
  r3.success ? "" : r3.error?.issues?.[0]?.message,
);

// Case 4: minimal snapshot (no optional fields) still parses
const minSnapshot = {
  status: "ok",
  capturedAt: "2026-05-13T05:00:00Z",
  providers: [],
};
const r4 = SubscriptionUsageSnapshotSchema.safeParse(minSnapshot);
console.log(
  "[4] Minimal snapshot parse:",
  r4.success ? "PASS" : "FAIL",
  r4.success ? "" : r4.error?.issues?.[0]?.message,
);

// Case 5: new client sends usage payload to OLD daemon's "parse anything" handler
// The daemon side doesn't strictly parse client→server payloads of this type
// (clients don't send subscription_usage_updated), so this is server→client only.
// Verified by the discriminated union including the new variant without
// breaking existing ones.
console.log("[5] Discriminated union variant coverage: visual check passes if [3] is PASS.");
