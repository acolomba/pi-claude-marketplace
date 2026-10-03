import Type from "typebox";

import type { RowHint } from "./notification-resolve.ts";
import type { MarketplaceStatus, PluginStatus, Reason, Severity } from "./notification-types.ts";
import type { Scope } from "./types.ts";

/**
 * shared/notification-wire.ts -- the versioned wire schema of every structured
 * notification payload (WIRE-01, D-01..D-03). It is one typebox union keyed by
 * `kind`. The JSON strategy in notification-json.ts builds values of its static
 * type, and the schema generator under `scripts/` writes it out as the shipped
 * JSON Schema document.
 *
 * D-12: production reads this module through `import type` only, so no payload
 * is validated at runtime. The module imports no internal value, because the
 * schema generator loads it under Node type stripping.
 *
 * Every object schema sets `additionalProperties: false`, so a payload carries
 * exactly the fields declared here (WIRE-04).
 */

// WIRE-03: each closed set is enrolled as a `Record<ClosedSet, true>`. The
// record is exhaustive in both directions, so adding or removing a member of
// the closed set fails typecheck here until the wire literal list follows it.
const PLUGIN_STATUSES = {
  installed: true,
  updated: true,
  reinstalled: true,
  uninstalled: true,
  available: true,
  unavailable: true,
  upgradable: true,
  failed: true,
  skipped: true,
  "manual recovery": true,
  "will install": true,
  "will uninstall": true,
  "will enable": true,
  "will disable": true,
  disabled: true,
  "partially-installed": true,
  "partially-upgradable": true,
  "partially-available": true,
  remote: true,
} as const satisfies Record<PluginStatus, true>;

const MARKETPLACE_STATUSES = {
  added: true,
  removed: true,
  updated: true,
  failed: true,
  "autoupdate enabled": true,
  "autoupdate disabled": true,
  skipped: true,
} as const satisfies Record<MarketplaceStatus, true>;

const REASONS = {
  "up-to-date": true,
  "not found": true,
  "already installed": true,
  "not installed": true,
  "not in manifest": true,
  "invalid manifest": true,
  "no longer installable": true,
  "unsupported source": true,
  "unsupported component": true,
  "unsupported hooks": true,
  lsp: true,
  "requires pi-subagents": true,
  "requires pi-mcp": true,
  "rollback partial": true,
  unreadable: true,
  unparseable: true,
  "unreadable manifest": true,
  "source mismatch": true,
  "plugins remain": true,
  "concurrently uninstalled": true,
  "concurrently updated": true,
  "stale clone": true,
  "duplicate name": true,
  "lock held": true,
  "already autoupdate": true,
  "already no autoupdate": true,
  "already enabled": true,
  "already disabled": true,
  "permission denied": true,
  "source missing": true,
  "network unreachable": true,
  "marketplace not added": true,
  "marketplace not added to user scope": true,
  "marketplace not added to project scope": true,
  "orphan rewake": true,
  "authentication required": true,
  "dangling reference": true,
  "malformed mcp": true,
  "malformed skill": true,
  "malformed command": true,
  "installs disabled": true,
  "marketplace in user scope": true,
  "marketplace in project scope": true,
  "data kept": true,
  "no matching version": true,
  "version conflict": true,
  "constraint too complex": true,
  "invalid version constraint": true,
  "dependency marketplace not added": true,
  "dependency cycle": true,
  "dependency failed": true,
  "dependency promoted": true,
  "dependency pruned": true,
  "dependency unsatisfied": true,
  "dependency version unsatisfied": true,
  "dependents unsatisfied": true,
  "dependency current copy": true,
  "dependency enabled": true,
  "dependents remain": true,
  "dependency installed": true,
  "dependents constrain": true,
  "cross-marketplace": true,
  "stale workflow command": true,
  "requires pi-dynamic-workflows": true,
  "components now supported": true,
} as const satisfies Record<Reason, true>;

const SEVERITIES = {
  info: true,
  warning: true,
  error: true,
} as const satisfies Record<Severity, true>;

const SCOPES = {
  user: true,
  project: true,
} as const satisfies Record<Scope, true>;

const ROW_HINTS = {
  "partial-install": true,
  "partial-update": true,
  "stale-gate-update": true,
  enable: true,
} as const satisfies Record<RowHint, true>;

/** The keys of an enrollment map, in declaration order. */
function enrolledKeys<K extends string>(map: Record<K, true>): K[] {
  return Object.keys(map).filter((key): key is K => Object.hasOwn(map, key));
}

/**
 * An enum of the enrolled keys, in declaration order. Its static type is the
 * closed set itself, so a payload field typed by it accepts exactly the
 * set's members.
 */
function literalEnum<K extends string>(map: Record<K, true>): Type.TEnum<K[]> {
  return Type.Enum(enrolledKeys(map));
}

const PLUGIN_STATUS = literalEnum(PLUGIN_STATUSES);
const MARKETPLACE_STATUS = literalEnum(MARKETPLACE_STATUSES);
const REASON = literalEnum(REASONS);
const SEVERITY = literalEnum(SEVERITIES);
const SCOPE = literalEnum(SCOPES);
const ROW_HINT = literalEnum(ROW_HINTS);

const COUNT = Type.Integer({ minimum: 0 });

/** D-11: one serialized `Error.cause` chain, head first. */
const CAUSE = Type.Object(
  { causeChain: Type.Array(Type.String()), truncated: Type.Boolean() },
  { additionalProperties: false },
);

const ROLLBACK_PHASE = Type.Object(
  { phase: Type.String(), cause: Type.Optional(CAUSE) },
  { additionalProperties: false },
);

/**
 * WIRE-04 / WIRE-06: one plugin row. `id` is `<name>@<marketplace>`. `reasons`
 * is always present; every other optional field is absent when the row has no
 * value for it.
 */
const PLUGIN_ROW = Type.Object(
  {
    status: PLUGIN_STATUS,
    name: Type.String(),
    id: Type.String(),
    reasons: Type.Array(REASON),
    version: Type.Optional(Type.String()),
    from: Type.Optional(Type.String()),
    to: Type.Optional(Type.String()),
    scope: Type.Optional(SCOPE),
    description: Type.Optional(Type.String()),
    partial: Type.Optional(Type.Boolean()),
    hint: Type.Optional(ROW_HINT),
    cause: Type.Optional(CAUSE),
    leaks: Type.Optional(Type.Array(Type.String())),
    rollbackPartial: Type.Optional(Type.Array(ROLLBACK_PHASE)),
  },
  { additionalProperties: false },
);

const MARKETPLACE_DETAILS = Type.Object(
  { autoupdate: Type.Boolean(), lastUpdatedAt: Type.Optional(Type.String()) },
  { additionalProperties: false },
);

/** WIRE-04: one marketplace block holding its plugin rows in model order. */
const MARKETPLACE_BLOCK = Type.Object(
  {
    name: Type.String(),
    scope: SCOPE,
    plugins: Type.Array(PLUGIN_ROW),
    status: Type.Optional(MARKETPLACE_STATUS),
    details: Type.Optional(MARKETPLACE_DETAILS),
    reasons: Type.Optional(Type.Array(REASON)),
  },
  { additionalProperties: false },
);

/** OUT-03: the numeric tally of a plural cascade. */
const TALLY = Type.Object(
  {
    label: Type.String(),
    failures: COUNT,
    warnings: COUNT,
    success: Type.Optional(
      Type.Object(
        { count: COUNT, verb: Type.Optional(Type.String()) },
        { additionalProperties: false },
      ),
    ),
  },
  { additionalProperties: false },
);

const RETAINED_WORKFLOW = Type.Object(
  { name: Type.String(), envelopeCount: Type.Optional(COUNT) },
  { additionalProperties: false },
);

/**
 * D-01 / WIRE-05: the envelope fields every payload kind carries. `summary` is
 * present on warning and error payloads only, and it may be empty.
 */
const ENVELOPE_FIELDS = {
  schemaVersion: Type.Literal(1),
  severity: SEVERITY,
  needsReload: Type.Boolean(),
  summary: Type.Optional(Type.String()),
};

/** D-04: a cascade. `marketplaces: []` is the empty cascade. */
const CASCADE_PAYLOAD = Type.Object(
  {
    ...ENVELOPE_FIELDS,
    kind: Type.Literal("cascade"),
    tally: Type.Optional(TALLY),
    noOp: Type.Optional(Type.Literal(true)),
    marketplaces: Type.Array(MARKETPLACE_BLOCK),
    advisories: Type.Optional(Type.Array(Type.String())),
    retainedWorkflows: Type.Optional(Type.Array(RETAINED_WORKFLOW)),
  },
  { additionalProperties: false },
);

/**
 * RECON-04 / D-04: an applied load-time reconcile. It carries no `noOp`, no
 * advisory lines, and no retained workflows.
 */
const RECONCILE_APPLIED_PAYLOAD = Type.Object(
  {
    ...ENVELOPE_FIELDS,
    kind: Type.Literal("reconcile-applied-cascade"),
    tally: Type.Optional(TALLY),
    marketplaces: Type.Array(MARKETPLACE_BLOCK),
  },
  { additionalProperties: false },
);

/**
 * WIRE-01 / D-01..D-03: the one payload union, keyed by `kind`. Kinds appear
 * in their declared order. D-12: production reads only its static type.
 */
export const NOTIFICATION_PAYLOAD_SCHEMA = Type.Union([CASCADE_PAYLOAD, RECONCILE_APPLIED_PAYLOAD]);
