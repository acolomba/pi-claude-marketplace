import Type from "typebox";

import type { Companion } from "./concerns/soft-dep.ts";
import type { RowHint } from "./notification-resolve.ts";
import type {
  MarketplaceStatus,
  McpConfigFileNotice,
  McpMigrationFileUnreadableRow,
  McpMigrationLeftRow,
  McpMigrationRemovalCause,
  McpMigrationUnfinishedRow,
  McpServerStatus,
  PluginInfoRow,
  PluginStatus,
  Reason,
  Severity,
} from "./notification-types.ts";
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
  "will update": true,
  disabled: true,
  "partially-installed": true,
  "partially-upgradable": true,
  "partially-available": true,
  remote: true,
} as const satisfies Record<PluginStatus, true>;

/** The statuses a plugin-info row can hold. */
const PLUGIN_INFO_STATUSES = {
  installed: true,
  available: true,
  remote: true,
  unavailable: true,
  "partially-available": true,
  failed: true,
  "partially-installed": true,
  disabled: true,
} as const satisfies Record<PluginInfoRow["status"], true>;

const MARKETPLACE_STATUSES = {
  added: true,
  removed: true,
  updated: true,
  failed: true,
  "autoupdate enabled": true,
  "autoupdate disabled": true,
  skipped: true,
  "will add": true,
  "will remove": true,
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
  "requires pi-mcp-adapter": true,
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
  "unsupported mcp": true,
  "marketplace in local layer only": true,
  "marketplace in base layer only": true,
  "plugin in local layer only": true,
  "plugin in base layer only": true,
  "already installed in base layer": true,
  "already installed in local layer": true,
  "still installed in base layer": true,
  "still installed in local layer": true,
  "disabled in local layer": true,
  "enabled in local layer": true,
  "network error": true,
  "already added": true,
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
  "catalog-partial-update": true,
  "stale-gate-update": true,
  enable: true,
} as const satisfies Record<RowHint, true>;

/** ASTAT-01 / ASTAT-02: the states plugin info shows for an MCP server. */
const MCP_SERVER_STATUSES = {
  connected: true,
  "cached, connects on first use": true,
  "needs authentication": true,
  "pending approval": true,
  disabled: true,
  "not connected": true,
  failed: true,
  "status unknown": true,
  "not loaded": true,
  "overridden by project scope": true,
} as const satisfies Record<McpServerStatus, true>;

const COMPANIONS = {
  "pi-dynamic-workflows": true,
  "pi-mcp-adapter": true,
  "pi-subagents": true,
} as const satisfies Record<Companion, true>;

const MCP_CONFIG_FILE_NOTICE_KINDS = {
  "comments-dropped": true,
  "left-unchanged": true,
} as const satisfies Record<McpConfigFileNotice["kind"], true>;

/** The scope config files a file notice or a file-unreadable row names; the two sets are one. */
const MCP_CONFIG_FILES = {
  "mcp-adapter.json": true,
  "mcp.json": true,
} as const satisfies Record<McpMigrationFileUnreadableRow["file"], true>;

/** The left-in-place rows that carry only an owner and its old names. */
const MCP_MIGRATION_OWNER_ROW_KINDS = {
  unowned: true,
  "not-listed": true,
  "source-unreadable": true,
  "source-outdated": true,
  "marketplace-unreadable": true,
} as const satisfies Record<
  Exclude<McpMigrationLeftRow["kind"], "stopped" | "file-unreadable" | "collision" | "unfinished">,
  true
>;

const MCP_MIGRATION_REMOVAL_CAUSES = {
  "not-declared": true,
  disabled: true,
  "unsupported-feature": true,
  malformed: true,
} as const satisfies Record<McpMigrationRemovalCause, true>;

const MCP_MIGRATION_UNFINISHED_FILES = {
  "mcp.json": true,
  "project-scope mcp-adapter.json": true,
} as const satisfies Record<McpMigrationUnfinishedRow["file"], true>;

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
const PLUGIN_INFO_STATUS = literalEnum(PLUGIN_INFO_STATUSES);
const MARKETPLACE_STATUS = literalEnum(MARKETPLACE_STATUSES);
const REASON = literalEnum(REASONS);
const SEVERITY = literalEnum(SEVERITIES);
const SCOPE = literalEnum(SCOPES);
const ROW_HINT = literalEnum(ROW_HINTS);
const MCP_SERVER_STATUS = literalEnum(MCP_SERVER_STATUSES);
const COMPANION = literalEnum(COMPANIONS);
const MCP_CONFIG_FILE_NOTICE_KIND = literalEnum(MCP_CONFIG_FILE_NOTICE_KINDS);
const MCP_CONFIG_FILE = literalEnum(MCP_CONFIG_FILES);
const MCP_MIGRATION_OWNER_ROW_KIND = literalEnum(MCP_MIGRATION_OWNER_ROW_KINDS);
const MCP_MIGRATION_REMOVAL_CAUSE = literalEnum(MCP_MIGRATION_REMOVAL_CAUSES);
const MCP_MIGRATION_UNFINISHED_FILE = literalEnum(MCP_MIGRATION_UNFINISHED_FILES);

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
 * WIRE-04 / WIRE-06: one plugin row. `id` is `<name>@<marketplace>`, a
 * dependency row's own `<plugin>@<marketplace>` key, or the name alone for a
 * row whose subject is a marketplace. `reasons` is always present; every other
 * optional field is absent when the row has no value for it.
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
    fromCommit: Type.Optional(Type.String()),
    toCommit: Type.Optional(Type.String()),
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
const COMMAND_ORIGIN = Type.Object(
  {
    kind: Type.Literal("command"),
    commandId: Type.String({ minLength: 1 }),
    invocationId: Type.String({ minLength: 1 }),
  },
  { additionalProperties: false },
);
const ORIGIN = Type.Union([
  COMMAND_ORIGIN,
  Type.Object({ kind: Type.Literal("load") }, { additionalProperties: false }),
  Type.Object({ kind: Type.Literal("hook") }, { additionalProperties: false }),
]);

const ENVELOPE_FIELDS = {
  schemaVersion: Type.Literal(1),
  origin: ORIGIN,
  severity: SEVERITY,
  needsReload: Type.Boolean(),
  summary: Type.Optional(Type.String()),
};

/**
 * D-04: a cascade. `marketplaces: []` is the empty cascade. Exported for the
 * JSON strategy's cascade overload, which reads its static type.
 */
export const CASCADE_PAYLOAD_SCHEMA = Type.Object(
  {
    ...ENVELOPE_FIELDS,
    kind: Type.Literal("cascade"),
    tally: Type.Optional(TALLY),
    noOp: Type.Optional(Type.Literal(true)),
    needsApply: Type.Optional(Type.Literal(true)),
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

const STRINGS = Type.Array(Type.String());

/**
 * D-04: the marketplace-info body. `source` follows `sourceKind`; a path
 * source carries the absolute path the text form shows (NFR-9).
 */
const MARKETPLACE_INFO_FIELDS = {
  name: Type.String(),
  scope: SCOPE,
  details: MARKETPLACE_DETAILS,
  source: Type.Union([
    Type.Object(
      {
        sourceKind: Type.Literal("github"),
        owner: Type.String(),
        repo: Type.String(),
        ref: Type.Optional(Type.String()),
      },
      { additionalProperties: false },
    ),
    Type.Object(
      { sourceKind: Type.Literal("url"), url: Type.String(), ref: Type.Optional(Type.String()) },
      { additionalProperties: false },
    ),
    Type.Object(
      { sourceKind: Type.Literal("path"), absPath: Type.String() },
      { additionalProperties: false },
    ),
  ]),
  description: Type.Optional(Type.String()),
  allowedMarketplaces: Type.Optional(STRINGS),
};

/** One `hooks:` entry: a plain event with an optional matcher, or a lenient one. */
const HOOK_ENTRY = Type.Union([
  Type.Object(
    { event: Type.String(), matcher: Type.Optional(Type.String()) },
    { additionalProperties: false },
  ),
  Type.Object(
    {
      kind: Type.Literal("lenient"),
      event: Type.String(),
      supported: Type.Boolean(),
      matcher: Type.Optional(Type.String()),
    },
    { additionalProperties: false },
  ),
]);

/**
 * WIRE-04 / WIRE-06: the fields both plugin-info row arms carry. `id` is
 * `<name>@<marketplaceName>`, `reasons` is always present, and `dependencies`
 * holds the pre-rendered plugin addresses the info text prints.
 */
const PLUGIN_INFO_ROW_FIELDS = {
  status: PLUGIN_INFO_STATUS,
  name: Type.String(),
  id: Type.String(),
  reasons: Type.Array(REASON),
  version: Type.Optional(Type.String()),
  scope: Type.Optional(SCOPE),
  description: Type.Optional(Type.String()),
  notes: Type.Optional(STRINGS),
  dependencies: Type.Optional(STRINGS),
};

/**
 * ANAME-01 / ANAME-07 / AVAR-04 / ASTAT-01: one plugin MCP server. `name` is
 * the name Claude Code gives it, `plugin:<plugin>:<server>`. A server a
 * partial install leaves out carries `unsupportedFeature`; a written server
 * may carry its unset and withheld variable names and its status.
 */
const MCP_SERVER = Type.Object(
  {
    name: Type.String(),
    unsupportedFeature: Type.Optional(Type.String()),
    unsetVariables: Type.Optional(STRINGS),
    withheldVariables: Type.Optional(STRINGS),
    status: Type.Optional(MCP_SERVER_STATUS),
  },
  { additionalProperties: false },
);

/** ADET-01: one companion extension the resolved components need. */
const COMPANION_REQUIREMENT = Type.Object(
  { companion: COMPANION, missing: Type.Boolean() },
  { additionalProperties: false },
);

/** D-04: a plugin-info row, discriminated by `componentsResolved`. */
const PLUGIN_INFO_ROW = Type.Union([
  Type.Object(
    {
      ...PLUGIN_INFO_ROW_FIELDS,
      componentsResolved: Type.Literal(true),
      components: Type.Object(
        {
          agents: Type.Optional(STRINGS),
          commands: Type.Optional(STRINGS),
          hooks: Type.Optional(Type.Array(HOOK_ENTRY)),
          mcp: Type.Optional(Type.Array(MCP_SERVER)),
          skills: Type.Optional(STRINGS),
          workflows: Type.Optional(STRINGS),
        },
        { additionalProperties: false },
      ),
      requires: Type.Optional(Type.Array(COMPANION_REQUIREMENT)),
    },
    { additionalProperties: false },
  ),
  Type.Object(
    { ...PLUGIN_INFO_ROW_FIELDS, componentsResolved: Type.Literal(false) },
    { additionalProperties: false },
  ),
]);

/** D-04: the plugin-info body: the marketplace it was read from, and the row. */
const PLUGIN_INFO_FIELDS = {
  marketplaceName: Type.String(),
  marketplaceScope: SCOPE,
  marketplaceDetails: MARKETPLACE_DETAILS,
  plugin: PLUGIN_INFO_ROW,
};

const MARKETPLACE_INFO_PAYLOAD = Type.Object(
  { ...ENVELOPE_FIELDS, kind: Type.Literal("marketplace-info"), ...MARKETPLACE_INFO_FIELDS },
  { additionalProperties: false },
);

const PLUGIN_INFO_PAYLOAD = Type.Object(
  { ...ENVELOPE_FIELDS, kind: Type.Literal("plugin-info"), ...PLUGIN_INFO_FIELDS },
  { additionalProperties: false },
);

/** D-04: an info fan-out. Its blocks carry no envelope fields of their own. */
const MARKETPLACE_INFO_CASCADE_PAYLOAD = Type.Object(
  {
    ...ENVELOPE_FIELDS,
    kind: Type.Literal("marketplace-info-cascade"),
    blocks: Type.Array(Type.Object(MARKETPLACE_INFO_FIELDS, { additionalProperties: false }), {
      minItems: 1,
    }),
  },
  { additionalProperties: false },
);

const PLUGIN_INFO_CASCADE_PAYLOAD = Type.Object(
  {
    ...ENVELOPE_FIELDS,
    kind: Type.Literal("plugin-info-cascade"),
    blocks: Type.Array(Type.Object(PLUGIN_INFO_FIELDS, { additionalProperties: false }), {
      minItems: 1,
    }),
  },
  { additionalProperties: false },
);

/** `reasons` holds the one resolved not-added token. */
const MARKETPLACE_NOT_ADDED_PAYLOAD = Type.Object(
  {
    ...ENVELOPE_FIELDS,
    kind: Type.Literal("marketplace-not-added"),
    name: Type.String(),
    scope: Type.Optional(SCOPE),
    reasons: Type.Array(REASON),
  },
  { additionalProperties: false },
);

const RECONCILE_PENDING_EMPTY_PAYLOAD = Type.Object(
  {
    ...ENVELOPE_FIELDS,
    kind: Type.Literal("reconcile-pending-empty"),
    advisories: Type.Optional(STRINGS),
    retainedWorkflows: Type.Optional(Type.Array(RETAINED_WORKFLOW)),
  },
  { additionalProperties: false },
);

const PRUNE_EMPTY_PAYLOAD = Type.Object(
  { ...ENVELOPE_FIELDS, kind: Type.Literal("prune-empty"), scope: SCOPE },
  { additionalProperties: false },
);

/** D-11: the prune's cause is its serialized, redacted chain. */
const PRUNE_COMMITTED_WARNING_PAYLOAD = Type.Object(
  {
    ...ENVELOPE_FIELDS,
    kind: Type.Literal("prune-committed-warning"),
    scope: SCOPE,
    cause: Type.Optional(CAUSE),
  },
  { additionalProperties: false },
);

/**
 * D-01: the envelope fields of a raw kind. A raw kind has no `summary`: the
 * model composes a summary line only for structured envelopes, and the typed
 * body fields carry the raw kind's text.
 */
const RAW_ENVELOPE_FIELDS = {
  schemaVersion: Type.Literal(1),
  origin: ORIGIN,
  severity: SEVERITY,
  needsReload: Type.Boolean(),
};

const USAGE_ERROR_PAYLOAD = Type.Object(
  {
    ...RAW_ENVELOPE_FIELDS,
    kind: Type.Literal("usage-error"),
    message: Type.String(),
    usage: Type.String(),
  },
  { additionalProperties: false },
);

const USAGE_INFO_PAYLOAD = Type.Object(
  { ...RAW_ENVELOPE_FIELDS, kind: Type.Literal("usage-info"), usage: Type.String() },
  { additionalProperties: false },
);

const AUTOAPPLY_CONFIG_FILE_FIELDS = {
  scope: SCOPE,
  file: Type.Union([
    Type.Literal("claude-plugins.json"),
    Type.Literal("claude-plugins.local.json"),
  ]),
};

/**
 * AAP-04: the effective `autoapply` value, the file that set it (absent for the
 * default), each listed file's own value (absent when not set), and the write
 * a set form made.
 */
const AUTOAPPLY_STATUS_PAYLOAD = Type.Object(
  {
    ...RAW_ENVELOPE_FIELDS,
    kind: Type.Literal("autoapply-status"),
    enabled: Type.Boolean(),
    source: Type.Optional(
      Type.Object(AUTOAPPLY_CONFIG_FILE_FIELDS, { additionalProperties: false }),
    ),
    files: Type.Array(
      Type.Object(
        { ...AUTOAPPLY_CONFIG_FILE_FIELDS, value: Type.Optional(Type.Boolean()) },
        { additionalProperties: false },
      ),
    ),
    set: Type.Optional(
      Type.Object(
        { ...AUTOAPPLY_CONFIG_FILE_FIELDS, value: Type.Boolean() },
        { additionalProperties: false },
      ),
    ),
  },
  { additionalProperties: false },
);

const DIAGNOSTIC_PAYLOAD = Type.Object(
  {
    ...RAW_ENVELOPE_FIELDS,
    kind: Type.Literal("diagnostic"),
    header: Type.String(),
    lines: STRINGS,
  },
  { additionalProperties: false },
);

const DEVICE_FLOW_PROMPT_PAYLOAD = Type.Object(
  {
    ...RAW_ENVELOPE_FIELDS,
    kind: Type.Literal("device-flow-prompt"),
    verificationUri: Type.String(),
    userCode: Type.String(),
  },
  { additionalProperties: false },
);

/**
 * RAWS-05 / D-08: the plugin author's summary, verbatim, as `text`: D-01
 * reserves `summary` for the warning and error summary line.
 */
const ASYNC_REWAKE_SUMMARY_PAYLOAD = Type.Object(
  { ...RAW_ENVELOPE_FIELDS, kind: Type.Literal("async-rewake-summary"), text: Type.String() },
  { additionalProperties: false },
);

const STOP_OVERRIDE_CAP_PAYLOAD = Type.Object(
  {
    ...RAW_ENVELOPE_FIELDS,
    kind: Type.Literal("stop-override-cap"),
    pluginId: Type.String(),
    cap: COUNT,
  },
  { additionalProperties: false },
);

const RECONCILE_ABORTED_PAYLOAD = Type.Object(
  {
    ...RAW_ENVELOPE_FIELDS,
    kind: Type.Literal("reconcile-aborted"),
    causeMessage: Type.String(),
  },
  { additionalProperties: false },
);

const PLUGIN_PATH_SKIPPED_PAYLOAD = Type.Object(
  {
    ...RAW_ENVELOPE_FIELDS,
    kind: Type.Literal("plugin-path-skipped"),
    scope: SCOPE,
    reason: Type.String(),
  },
  { additionalProperties: false },
);

const MCP_NOTICE_SUBJECT_FIELDS = {
  scope: SCOPE,
  file: Type.Literal("mcp-adapter.json"),
  plugin: Type.String(),
  server: Type.String(),
};

/**
 * AFILE-04 / AFILE-06 / AVAR-04 / ANAME-07 / AMIG-01: one MCP config notice. It
 * names fields and variables, never their values (AVAR-05).
 */
const MCP_CONFIG_NOTICE = Type.Union([
  Type.Object(
    { kind: MCP_CONFIG_FILE_NOTICE_KIND, scope: SCOPE, file: MCP_CONFIG_FILE },
    { additionalProperties: false },
  ),
  Type.Object(
    { kind: Type.Literal("override-kept"), ...MCP_NOTICE_SUBJECT_FIELDS, fields: STRINGS },
    { additionalProperties: false },
  ),
  Type.Object(
    { kind: Type.Literal("variables-missing"), ...MCP_NOTICE_SUBJECT_FIELDS, names: STRINGS },
    { additionalProperties: false },
  ),
  Type.Object(
    { kind: Type.Literal("credentials-blanked"), ...MCP_NOTICE_SUBJECT_FIELDS, names: STRINGS },
    { additionalProperties: false },
  ),
  Type.Object(
    { kind: Type.Literal("tool-rules-unenforced"), ...MCP_NOTICE_SUBJECT_FIELDS, fields: STRINGS },
    { additionalProperties: false },
  ),
  Type.Object(
    { kind: Type.Literal("leftover-removed"), ...MCP_NOTICE_SUBJECT_FIELDS },
    { additionalProperties: false },
  ),
]);

const MCP_ROW_OWNER_FIELDS = {
  scope: SCOPE,
  plugin: Type.String(),
  marketplace: Type.String(),
  servers: STRINGS,
};

/** AMIG-01 / AMIG-03 / AMIG-04: one row of the reload migration notice. */
const MCP_MIGRATION_ROW = Type.Union([
  Type.Object(
    {
      kind: Type.Literal("moved"),
      scope: SCOPE,
      plugin: Type.String(),
      marketplace: Type.String(),
      from: Type.String(),
      to: Type.String(),
    },
    { additionalProperties: false },
  ),
  Type.Object(
    {
      kind: Type.Literal("removed"),
      scope: SCOPE,
      plugin: Type.String(),
      marketplace: Type.String(),
      server: Type.String(),
      cause: MCP_MIGRATION_REMOVAL_CAUSE,
      feature: Type.Optional(Type.String()),
    },
    { additionalProperties: false },
  ),
  Type.Object(
    { kind: Type.Literal("stopped"), scope: SCOPE, detail: Type.String() },
    { additionalProperties: false },
  ),
  Type.Object(
    { kind: MCP_MIGRATION_OWNER_ROW_KIND, ...MCP_ROW_OWNER_FIELDS },
    { additionalProperties: false },
  ),
  Type.Object(
    {
      kind: Type.Literal("collision"),
      ...MCP_ROW_OWNER_FIELDS,
      key: Type.String(),
      source: Type.String(),
    },
    { additionalProperties: false },
  ),
  Type.Object(
    { kind: Type.Literal("file-unreadable"), scope: SCOPE, file: MCP_CONFIG_FILE },
    { additionalProperties: false },
  ),
  Type.Object(
    {
      kind: Type.Literal("unfinished"),
      ...MCP_ROW_OWNER_FIELDS,
      file: MCP_MIGRATION_UNFINISHED_FILE,
      detail: Type.String(),
    },
    { additionalProperties: false },
  ),
]);

/** AFILE-04: one non-empty section of MCP config notices, all of one kind. */
const MCP_CONFIG_NOTICES_PAYLOAD = Type.Object(
  {
    ...RAW_ENVELOPE_FIELDS,
    kind: Type.Literal("mcp-config-notices"),
    notices: Type.Array(MCP_CONFIG_NOTICE, { minItems: 1 }),
  },
  { additionalProperties: false },
);

/**
 * AMIG-03 / D-14: the reload migration notice. `rows` hold the moved, then
 * the removed, then the left-in-place rows; `notices` the config notices in
 * section order. `needsReload` is true exactly when a row moved or was
 * removed.
 */
const MCP_MIGRATION_PAYLOAD = Type.Object(
  {
    ...RAW_ENVELOPE_FIELDS,
    kind: Type.Literal("mcp-migration"),
    rows: Type.Array(MCP_MIGRATION_ROW, { minItems: 1 }),
    notices: Type.Array(MCP_CONFIG_NOTICE),
  },
  { additionalProperties: false },
);

/** AUP-03 / D-PL8-10: one install a background update moved (D-PL8-16). */
const BACKGROUND_UPDATE_PLUGIN = Type.Object(
  {
    name: Type.String(),
    marketplace: Type.String(),
    scope: SCOPE,
    fromVersion: Type.Optional(Type.String()),
    toVersion: Type.String(),
  },
  { additionalProperties: false },
);

/**
 * AUP-03 / D-PL8-10: the plugins one background update moved, one row per
 * updated install in update order. It always asks for a reload (D-PL8-11), and
 * an update that moved nothing emits no payload.
 */
const BACKGROUND_UPDATE_PAYLOAD = Type.Object(
  {
    ...RAW_ENVELOPE_FIELDS,
    needsReload: Type.Literal(true),
    kind: Type.Literal("background-update"),
    plugins: Type.Array(BACKGROUND_UPDATE_PLUGIN, { minItems: 1 }),
  },
  { additionalProperties: false },
);

/**
 * D-CF5-14 / D-CF5-24: one notice a plugin's hook shows the user, verbatim, as
 * `text`, as the rewake summary is: D-01 reserves `summary` for the warning
 * and error summary line.
 */
const HOOK_NOTICE_PAYLOAD = Type.Object(
  { ...RAW_ENVELOPE_FIELDS, kind: Type.Literal("hook-notice"), text: Type.String() },
  { additionalProperties: false },
);

/**
 * WIRE-01 / D-01..D-03: the one payload union, keyed by `kind`. Kinds appear
 * in their declared order. D-12: production reads only its static type.
 */
export const NOTIFICATION_PAYLOAD_SCHEMA = Type.Union([
  CASCADE_PAYLOAD_SCHEMA,
  RECONCILE_APPLIED_PAYLOAD,
  MARKETPLACE_INFO_PAYLOAD,
  PLUGIN_INFO_PAYLOAD,
  MARKETPLACE_INFO_CASCADE_PAYLOAD,
  PLUGIN_INFO_CASCADE_PAYLOAD,
  MARKETPLACE_NOT_ADDED_PAYLOAD,
  RECONCILE_PENDING_EMPTY_PAYLOAD,
  PRUNE_EMPTY_PAYLOAD,
  PRUNE_COMMITTED_WARNING_PAYLOAD,
  USAGE_ERROR_PAYLOAD,
  USAGE_INFO_PAYLOAD,
  AUTOAPPLY_STATUS_PAYLOAD,
  DIAGNOSTIC_PAYLOAD,
  DEVICE_FLOW_PROMPT_PAYLOAD,
  ASYNC_REWAKE_SUMMARY_PAYLOAD,
  STOP_OVERRIDE_CAP_PAYLOAD,
  RECONCILE_ABORTED_PAYLOAD,
  PLUGIN_PATH_SKIPPED_PAYLOAD,
  MCP_CONFIG_NOTICES_PAYLOAD,
  MCP_MIGRATION_PAYLOAD,
  BACKGROUND_UPDATE_PAYLOAD,
  HOOK_NOTICE_PAYLOAD,
  Type.Object(
    {
      schemaVersion: Type.Literal(1),
      kind: Type.Literal("internal-error"),
      origin: COMMAND_ORIGIN,
      severity: Type.Literal("error"),
      needsReload: Type.Boolean(),
      summary: Type.String(),
      cause: CAUSE,
    },
    { additionalProperties: false },
  ),
]);
