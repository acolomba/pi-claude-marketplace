import assert from "node:assert/strict";
import { test } from "node:test";

import {
  composePluginLines,
  composeReconcileAppliedBody,
  formatEnvelopeArguments,
  formatRawSurface,
  renderMarketplaceInfo,
  renderMarketplaceInfoCascade,
  renderMarketplaceNotAdded,
  renderMpHeader,
  renderPluginInfo,
  renderPluginInfoCascade,
  renderPruneCommittedWarning,
  renderPruneEmpty,
  renderReconcilePendingEmpty,
} from "../../extensions/pi-claude-marketplace/shared/notification-grammar.ts";
import { shouldEmitReloadHint } from "../../extensions/pi-claude-marketplace/shared/notification-summary.ts";

import type { NotifyArguments } from "../../extensions/pi-claude-marketplace/shared/notification-grammar.ts";
import type {
  ResolvedMarketplace,
  ResolvedRawSurface,
  ResolvedRow,
} from "../../extensions/pi-claude-marketplace/shared/notification-resolve.ts";
import type {
  BackgroundUpdatePlugin,
  MarketplaceNotAddedMessage,
  MarketplaceNotificationMessage,
  McpServerSummaryEntry,
  PluginFailedMessage,
  PluginInfoMessage,
  PluginInstalledMessage,
  PluginNotificationMessage,
  PluginPartiallyInstalledMessage,
  PruneEmptyMessage,
  Reason,
} from "../../extensions/pi-claude-marketplace/shared/notification-types.ts";

/**
 * PL-4: `composePluginLines` selects the description-bearing rows by their
 * status discriminant. These two spellings of that set -- by the presence of the
 * optional member, and by the status literals -- must stay the same set, so the
 * control below pins them against each other in BOTH directions and fails if a
 * new variant ever joins one and not the other.
 */
type DescriptionBearingByMember = Extract<PluginNotificationMessage, { description?: string }>;
type DescriptionBearingByStatus = Extract<
  PluginNotificationMessage,
  {
    status:
      | "installed"
      | "upgradable"
      | "available"
      | "remote"
      | "unavailable"
      | "partially-available"
      | "disabled"
      | "partially-installed"
      | "partially-upgradable";
  }
>;
type MutuallyAssignable<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;

void (true satisfies MutuallyAssignable<DescriptionBearingByMember, DescriptionBearingByStatus>);

/**
 * D-13: `composePluginLines` accepts a resolved row and refuses the producer row
 * it was resolved from, alone or inside a union, so a caller cannot render a row
 * whose `{requires ...}` markers `resolveRows` has not composed yet.
 */
type Assignable<A, B> = [A] extends [B] ? true : false;
type PluginRowInput = Parameters<typeof composePluginLines>[0];
void (true satisfies Assignable<ResolvedRow<PluginPartiallyInstalledMessage>, PluginRowInput>);
void (false satisfies Assignable<PluginInstalledMessage, PluginRowInput>);
void ((row: PluginPartiallyInstalledMessage) =>
  // @ts-expect-error an unresolved producer row still declares its dependencies
  composePluginLines(row, "user"));
void ((row: PluginPartiallyInstalledMessage | ResolvedRow<PluginInstalledMessage>) =>
  // @ts-expect-error a union with an unresolved member still declares its dependencies
  composePluginLines(row, "user"));

for (const { row, expected } of [
  {
    row: { status: "unknown", name: "alpha", reasons: [], missingPolicy: true },
    expected: '  alpha (failed) {internal: no render arm for "unknown"}',
  },
  {
    row: { status: "unknown", reasons: [], missingPolicy: true },
    expected: '  ? (failed) {internal: no render arm for "unknown"}',
  },
]) {
  test(`formats the missing-policy diagnostic ${expected}`, () => {
    // act
    const lines = composePluginLines(row as never, "user");

    // assert
    assert.deepStrictEqual(lines, [expected]);
  });
}

test("exports notification grammar from its named owner", () => {
  // arrange
  const expectedType = "function";

  // act
  const actualType = typeof composePluginLines;

  // assert
  assert.equal(actualType, expectedType);
});

const MARKETPLACE_BASE = { name: "official", scope: "user", plugins: [] } as const;

for (const { status, extra, expected } of [
  { status: "added", extra: {}, expected: "● official [user] (added)" },
  { status: "removed", extra: {}, expected: "● official [user] (removed)" },
  { status: "updated", extra: {}, expected: "● official [user] (updated)" },
  { status: "failed", extra: {}, expected: "⊘ official [user] (failed)" },
  {
    status: "failed",
    extra: { reasons: ["not found"] },
    expected: "⊘ official [user] (failed) {not found}",
  },
  {
    status: "autoupdate enabled",
    extra: {},
    expected: "● official [user] <autoupdate>",
  },
  {
    status: "autoupdate disabled",
    extra: {},
    expected: "● official [user] <no autoupdate>",
  },
  { status: "skipped", extra: {}, expected: "● official [user] (skipped)" },
  {
    status: "skipped",
    extra: { reasons: ["up-to-date"] },
    expected: "● official [user] (skipped) {up-to-date}",
  },
  {
    status: "skipped",
    extra: { reasons: ["already autoupdate"] },
    expected: "● official [user] <autoupdate> {already autoupdate}",
  },
  {
    status: "skipped",
    extra: { reasons: ["already no autoupdate"] },
    expected: "● official [user] <no autoupdate> {already no autoupdate}",
  },
  { status: "will add", extra: {}, expected: "● official [user] (will add)" },
  { status: "will remove", extra: {}, expected: "● official [user] (will remove)" },
  { status: undefined, extra: {}, expected: "● official [user]" },
  {
    status: undefined,
    extra: { details: { autoupdate: false } },
    expected: "● official [user]",
  },
  {
    status: undefined,
    extra: { details: { autoupdate: true } },
    expected: "● official [user] <autoupdate>",
  },
] as const) {
  test(`renders the exact marketplace header for ${String(status)} ${expected}`, () => {
    // arrange
    const marketplace = { ...MARKETPLACE_BASE, status, ...extra };

    // act
    const rendered = renderMpHeader(marketplace as never);

    // assert
    assert.equal(rendered, expected);
  });
}

const ROW_CASES = [
  {
    plugin: {
      status: "installed",
      name: "alpha",
      scope: "user",
      version: "1.0.0",
      reasons: [],
      severity: "info",
      needsReload: true,
    },
    expected: "● alpha v1.0.0 (installed)",
  },
  {
    plugin: {
      status: "updated",
      name: "alpha",
      scope: "project",
      from: "1",
      to: "2",
      reasons: ["lsp"],
      severity: "info",
      needsReload: true,
    },
    expected: "● alpha [project] v1 → v2 (updated) {lsp}",
  },
  {
    plugin: {
      status: "reinstalled",
      name: "alpha",
      scope: "user",
      version: "2",
      reasons: [],
      severity: "info",
      needsReload: true,
    },
    expected: "● alpha v2 (reinstalled)",
  },
  {
    plugin: {
      status: "uninstalled",
      name: "alpha",
      scope: "project",
      version: "1",
      needsReload: true,
      severity: "info",
      reasons: [],
    },
    expected: "○ alpha [project] v1 (uninstalled)",
  },
  {
    plugin: { status: "available", name: "alpha", version: "1", reasons: [] },
    expected: "○ alpha v1 (available)",
  },
  {
    plugin: { status: "remote", name: "alpha", version: "1", reasons: [] },
    expected: "◌ alpha v1 (remote)",
  },
  {
    plugin: { status: "unavailable", name: "alpha", version: "1", reasons: ["invalid manifest"] },
    expected: "⊘ alpha v1 (unavailable) {invalid manifest}",
  },
  {
    plugin: { status: "partially-available", name: "alpha", version: "1", reasons: ["lsp"] },
    expected: "⊖ alpha v1 (partially-available) {lsp}",
  },
  {
    plugin: {
      status: "upgradable",
      name: "alpha",
      scope: "user",
      version: "2",
      reasons: [],
    },
    expected: "● alpha v2 (upgradable)",
  },
  {
    plugin: {
      status: "partially-installed",
      name: "alpha",
      scope: "user",
      version: "1",
      reasons: ["lsp"],
    },
    expected: "◉ alpha v1 (partially-installed) {lsp}",
  },
  {
    plugin: {
      status: "partially-upgradable",
      name: "alpha",
      scope: "user",
      version: "2",
      reasons: ["lsp"],
    },
    expected: "● alpha v2 (partially-upgradable) {lsp}",
  },
  {
    plugin: {
      status: "skipped",
      name: "alpha",
      scope: "user",
      version: "1",
      reasons: ["up-to-date"],
    },
    expected: "⊘ alpha v1 (skipped) {up-to-date}",
  },
  {
    plugin: {
      status: "failed",
      name: "alpha",
      scope: "user",
      version: "1",
      reasons: ["not found"],
      severity: "error",
    },
    expected: "⊘ alpha v1 (failed) {not found}",
  },
  {
    plugin: {
      status: "manual recovery",
      name: "alpha",
      scope: "user",
      version: "1",
      reasons: ["rollback partial"],
    },
    expected: "⊘ alpha v1 (manual recovery) {rollback partial}",
  },
  {
    plugin: { status: "will install", name: "alpha", scope: "user", reasons: [] },
    expected: "● alpha (will install)",
  },
  {
    plugin: { status: "will install", name: "alpha", scope: "user", partial: true, reasons: [] },
    expected: "● alpha (will partially install)",
  },
  {
    plugin: { status: "will uninstall", name: "alpha", scope: "user", reasons: [] },
    expected: "○ alpha (will uninstall)",
  },
  {
    plugin: { status: "will uninstall", name: "alpha", version: "1.2.0", reasons: [] },
    expected: "○ alpha v1.2.0 (will uninstall)",
  },
  {
    plugin: { status: "will enable", name: "alpha", scope: "user", reasons: [] },
    expected: "● alpha (will enable)",
  },
  {
    plugin: { status: "will disable", name: "alpha", scope: "user", reasons: [] },
    expected: "◍ alpha (will disable)",
  },
  {
    plugin: {
      status: "will update",
      name: "demo",
      scope: "user",
      from: "1.0.0",
      to: "1.1.0",
      reasons: [],
    },
    expected: "● demo v1.0.0 → v1.1.0 (will update)",
  },
  {
    plugin: {
      status: "disabled",
      name: "alpha",
      scope: "user",
      version: "1",
      reasons: [],
      needsReload: false,
      severity: "info",
    },
    expected: "◍ alpha v1 (disabled)",
  },
] as const satisfies readonly { plugin: ResolvedRow; expected: string }[];

for (const { plugin, expected } of ROW_CASES) {
  test(`renders exact ${plugin.status} row through the marketplace block`, () => {
    // arrange
    const marketplace = { ...MARKETPLACE_BASE, plugins: [plugin] };

    // act
    const rendered = composeReconcileAppliedBody([marketplace]);

    // assert
    assert.equal(rendered, `● official [user]\n  ${expected}`);
  });
}

test("pending uninstall stays bare while prune preview adds its reason without a reload", () => {
  // arrange
  const bare: MarketplaceNotificationMessage = {
    name: "official",
    scope: "user",
    plugins: [{ status: "will uninstall", name: "shared-lib" }],
  };
  const prunePreview: MarketplaceNotificationMessage = {
    name: "official",
    scope: "user",
    plugins: [{ status: "will uninstall", name: "shared-lib", reasons: ["dependency pruned"] }],
  };
  const resolvedBare: ResolvedMarketplace = {
    ...bare,
    plugins: [{ status: "will uninstall", name: "shared-lib", reasons: [] }],
  };
  const resolvedPreview: ResolvedMarketplace = {
    ...prunePreview,
    plugins: [{ status: "will uninstall", name: "shared-lib", reasons: ["dependency pruned"] }],
  };

  // act
  const bareBlock = composeReconcileAppliedBody([resolvedBare]);
  const previewBlock = composeReconcileAppliedBody([resolvedPreview]);

  // assert
  assert.equal(bareBlock, "● official [user]\n  ○ shared-lib (will uninstall)");
  assert.equal(
    previewBlock,
    "● official [user]\n  ○ shared-lib (will uninstall) {dependency pruned}",
  );
  assert.equal(shouldEmitReloadHint({ marketplaces: [bare] }), false);
  assert.equal(shouldEmitReloadHint({ kind: "cascade", marketplaces: [prunePreview] }), false);
});

test("composes descriptions, hints, causes, leaks, and rollback failures in order", () => {
  // arrange
  const plugin = {
    status: "failed",
    severity: "error",
    name: "alpha",
    reasons: ["rollback partial"],
    hint: "stale-gate-update",
    failure: {
      cause: { causeChain: ["outer", "inner"], truncated: false },
      leaks: ["/tmp/leak"],
      rollbackPartial: [
        { phase: "skills", cause: { causeChain: ["rollback"], truncated: false } },
        { phase: "commands" },
      ],
    },
  } satisfies ResolvedRow<PluginFailedMessage>;

  // act
  const lines = composePluginLines(plugin, "user");

  // assert
  assert.deepStrictEqual(lines, [
    "  ⊘ alpha (failed) {rollback partial}",
    "    Run update --partial on this plugin, then enable it again.",
    "    cause: outer -> inner",
    "    leaked: /tmp/leak",
    "    [skills] (rollback failed)",
    "      cause: rollback",
    "    [commands] (rollback failed)",
  ]);
});

test("renders the remedy cause line of a realized disabled row", () => {
  // arrange
  const row = {
    status: "disabled",
    name: "alpha",
    reasons: ["dependency unsatisfied"],
    severity: "warning",
    needsReload: false,
    failure: {
      cause: { causeChain: ['Install "vault@mp" or uninstall "alpha@mp"'], truncated: false },
      leaks: [],
      rollbackPartial: [],
    },
  } as const satisfies ResolvedRow;

  // act
  const lines = composePluginLines(row, "user");

  // assert
  assert.deepStrictEqual(lines, [
    "  ◍ alpha (disabled) {dependency unsatisfied}",
    '    cause: Install "vault@mp" or uninstall "alpha@mp"',
  ]);
});

test("renders the held-update cause line of a skipped row", () => {
  // arrange
  const row = {
    status: "skipped",
    name: "alpha",
    reasons: ["dependents constrain"],
    severity: "warning",
    needsReload: false,
    failure: {
      cause: {
        causeChain: ['the declared ranges admit no version in common -- required by "beta@mp"'],
        truncated: false,
      },
      leaks: [],
      rollbackPartial: [],
    },
  } as const satisfies ResolvedRow;

  // act
  const lines = composePluginLines(row, "user");

  // assert
  assert.deepStrictEqual(lines, [
    "  ⊘ alpha (skipped) {dependents constrain}",
    '    cause: the declared ranges admit no version in common -- required by "beta@mp"',
  ]);
});

test("D-10-13: renders the constraint disclosure line under an updated row", () => {
  // arrange
  const row = {
    status: "updated",
    name: "lib",
    from: "1.0.0",
    to: "1.1.0",
    reasons: ["dependency current copy"],
    severity: "info",
    needsReload: true,
    failure: {
      cause: {
        causeChain: ['constrained to the combined range (^1.0.0) -- required by "app@tools"'],
        truncated: false,
      },
      leaks: [],
      rollbackPartial: [],
    },
  } as const satisfies ResolvedRow;

  // act
  const lines = composePluginLines(row, "project");

  // assert
  assert.deepStrictEqual(lines, [
    "  ● lib v1.0.0 → v1.1.0 (updated) {dependency current copy}",
    '    cause: constrained to the combined range (^1.0.0) -- required by "app@tools"',
  ]);
});

for (const { plugin, expectedLines } of [
  {
    plugin: {
      status: "partially-available",
      name: "alpha",
      reasons: ["lsp"],
      description: "summary",
      hint: "partial-install",
    },
    expectedLines: [
      "  ⊖ alpha (partially-available) {lsp}",
      "    summary",
      "    Re-run with --partial to install the supported components.",
    ],
  },
  {
    plugin: {
      status: "partially-upgradable",
      name: "alpha",
      reasons: ["lsp"],
      description: "summary",
      hint: "partial-update",
    },
    expectedLines: [
      "  ● alpha (partially-upgradable) {lsp}",
      "    summary",
      "    Re-run with --partial to update with the supported components.",
    ],
  },
  {
    plugin: {
      status: "partially-upgradable",
      name: "alpha",
      reasons: ["unsupported component"],
      version: "1.0.0",
      hint: "catalog-partial-update",
    },
    expectedLines: [
      "  ● alpha v1.0.0 (partially-upgradable) {unsupported component}",
      "    Run update --partial on this plugin to update it with the supported components.",
    ],
  },
  {
    plugin: {
      status: "disabled",
      severity: "info",
      needsReload: true,
      name: "alpha",
      description: "summary",
      reasons: [],
      hint: "enable",
    },
    expectedLines: [
      "  ◍ alpha (disabled)",
      "    summary",
      "    Run enable on this plugin to use its components.",
    ],
  },
  {
    plugin: {
      status: "failed",
      severity: "error",
      name: "alpha",
      reasons: [],
      hint: "stale-gate-update",
      failure: {
        cause: { causeChain: ["gate"], truncated: false },
        leaks: [],
        rollbackPartial: [],
      },
    },
    expectedLines: [
      "  ⊘ alpha (failed)",
      "    Run update --partial on this plugin, then enable it again.",
      "    cause: gate",
    ],
  },
] as const satisfies readonly { plugin: ResolvedRow; expectedLines: readonly string[] }[]) {
  test(`renders the ${plugin.hint} hint after the description and before any failure line`, () => {
    // act
    const lines = composePluginLines(plugin, "user");

    // assert
    assert.deepStrictEqual(lines, expectedLines);
  });
}

test("truncates a long inventory description and preserves a short one", () => {
  // arrange
  const longDescription = "x".repeat(67);

  // act
  const longLines = composePluginLines(
    { status: "available", name: "alpha", description: longDescription, reasons: [] },
    "user",
  );
  const shortLines = composePluginLines(
    { status: "available", name: "alpha", description: "short", reasons: [] },
    "user",
  );

  // assert
  assert.deepStrictEqual(longLines, ["  ○ alpha (available)", `    ${"x".repeat(63)}...`]);
  assert.deepStrictEqual(shortLines, ["  ○ alpha (available)", "    short"]);
});

const INFO_DETAILS = { autoupdate: false, lastUpdatedAt: "2025-01-02T03:04:05.000Z" } as const;

for (const { source, expectedSource } of [
  {
    source: { sourceKind: "github", owner: "openai", repo: "tools", ref: "main" },
    expectedSource: "github: openai/tools#main",
  },
  {
    source: { sourceKind: "github", owner: "openai", repo: "tools" },
    expectedSource: "github: openai/tools",
  },
  {
    source: { sourceKind: "url", url: "https://example.test/repo.git", ref: "v1" },
    expectedSource: "url: https://example.test/repo.git#v1",
  },
  {
    source: { sourceKind: "url", url: "https://example.test/repo.git" },
    expectedSource: "url: https://example.test/repo.git",
  },
  { source: { sourceKind: "path", absPath: "/safe/repo" }, expectedSource: "path: /safe/repo" },
] as const) {
  test(`renders exact ${source.sourceKind} marketplace info`, () => {
    // arrange
    const message = {
      name: "official",
      scope: "user",
      details: INFO_DETAILS,
      source,
      description: "Tools",
    };

    // act
    const rendered = renderMarketplaceInfo(message as never);

    // assert
    const updated = source.sourceKind === "path" ? "" : "\nlast_updated: 2025-01-02T03:04:05.000Z";
    assert.equal(
      rendered,
      `● official [user] <no autoupdate>\n${expectedSource}${updated}\ndescription: Tools`,
    );
  });
}

test("marketplace info escapes hostile allowlist values on one line without mutation", () => {
  // arrange
  const allowedMarketplaces = [
    'quote"slash\\',
    "line\nfeed",
    "c1\u0085",
    "separators\u2028\u2029",
    "bidi\u061c\u200e\u200f\u202a\u202e\u2066\u2069",
    "café",
    "",
  ];
  const before = [...allowedMarketplaces];
  const message = {
    kind: "marketplace-info" as const,
    name: "policy",
    scope: "user" as const,
    details: { autoupdate: false },
    source: { sourceKind: "path" as const, absPath: "/policy" },
    allowedMarketplaces,
  };

  // act
  const rendered = renderMarketplaceInfo(message);

  // assert
  assert.equal(
    rendered,
    '● policy [user] <no autoupdate>\npath: /policy\nallowed_marketplaces: ["quote\\"slash\\\\","line\\nfeed","c1\\u0085","separators\\u2028\\u2029","bidi\\u061c\\u200e\\u200f\\u202a\\u202e\\u2066\\u2069","café",""]',
  );
  assert.deepEqual(allowedMarketplaces, before);
});

test("marketplace info cascades preserve zero and many shapes and order", () => {
  // arrange
  const first = {
    kind: "marketplace-info",
    name: "zeta",
    scope: "project",
    details: { autoupdate: true },
    source: { sourceKind: "path", absPath: "/z" },
  };
  const second = {
    kind: "marketplace-info",
    name: "alpha",
    scope: "user",
    details: { autoupdate: false },
    source: { sourceKind: "path", absPath: "/a" },
  };

  // act
  const empty = renderMarketplaceInfoCascade({ blocks: [] } as never);
  const many = renderMarketplaceInfoCascade({ blocks: [first, second] } as never);

  // assert
  assert.equal(empty, "");
  assert.equal(
    many,
    "● zeta [project] <autoupdate>\npath: /z\n\n● alpha [user] <no autoupdate>\npath: /a",
  );
});

for (const [status, glyph] of [
  ["installed", "●"],
  ["partially-installed", "◉"],
  ["disabled", "◍"],
  ["available", "○"],
  ["remote", "◌"],
  ["partially-available", "⊖"],
  ["unavailable", "⊘"],
  ["failed", "⊘"],
] as const) {
  test(`renders exact unresolved ${status} plugin info`, () => {
    // arrange
    const message = {
      marketplaceName: "official",
      marketplaceScope: "user",
      marketplaceDetails: { autoupdate: false },
      plugin: { status, name: "alpha", componentsResolved: false },
    };

    // act
    const rendered = renderPluginInfo(message as never);

    // assert
    assert.equal(
      rendered,
      `● official [user] <no autoupdate>\n  ${glyph} alpha (${status})\n    components: not resolved`,
    );
  });
}

test("renders the entry-declared dependencies line after the unresolved marker (D-01-32)", () => {
  // arrange
  const message: PluginInfoMessage = {
    kind: "plugin-info",
    marketplaceName: "official",
    marketplaceScope: "user",
    marketplaceDetails: { autoupdate: false },
    plugin: {
      status: "remote",
      name: "alpha",
      componentsResolved: false,
      dependencies: ["helper@mp"],
    },
  };

  // act
  const rendered = renderPluginInfo(message);

  // assert
  assert.equal(
    rendered,
    "● official [user] <no autoupdate>\n  ◌ alpha (remote)\n    components: not resolved\n    dependencies: helper@mp",
  );
});

test("renders no dependencies line for an unresolved row whose list is empty", () => {
  // arrange
  const message: PluginInfoMessage = {
    kind: "plugin-info",
    marketplaceName: "official",
    marketplaceScope: "user",
    marketplaceDetails: { autoupdate: false },
    plugin: { status: "remote", name: "alpha", componentsResolved: false, dependencies: [] },
  };

  // act
  const rendered = renderPluginInfo(message);

  // assert
  assert.equal(
    rendered,
    "● official [user] <no autoupdate>\n  ◌ alpha (remote)\n    components: not resolved",
  );
});

test("ADET-01: renders the stamped requires line after the components and before dependencies and notes", () => {
  // arrange
  const message: PluginInfoMessage = {
    kind: "plugin-info",
    marketplaceName: "official",
    marketplaceScope: "user",
    marketplaceDetails: { autoupdate: false },
    plugin: {
      status: "installed",
      name: "alpha",
      componentsResolved: true,
      components: { agents: ["a"], mcp: [{ name: "plugin:alpha:m" }] },
      requires: [
        { companion: "pi-mcp-adapter", missing: true },
        { companion: "pi-subagents", missing: false },
      ],
      dependencies: ["dep@mp"],
      notes: ["a note"],
    },
  };

  // act
  const rendered = renderPluginInfo(message);

  // assert
  assert.equal(
    rendered,
    [
      "● official [user] <no autoupdate>",
      "  ● alpha (installed)",
      "    agents: a",
      "    mcp: plugin:alpha:m",
      "    requires: pi-mcp-adapter (missing), pi-subagents",
      "    dependencies: dep@mp",
      "    note: a note",
    ].join("\n"),
  );
});

for (const { requirement, label, mcp, mcpLines } of [
  {
    requirement: "ANAME-07",
    label: "tags a left-out server with its blocking feature beside a plain one",
    mcp: [{ name: "plugin:a:x" }, { name: "plugin:a:y", unsupportedFeature: "headersHelper" }],
    mcpLines: ["    mcp: plugin:a:x, plugin:a:y (unsupported headersHelper)"],
  },
  { requirement: "ANAME-07", label: "prints no mcp line for an empty list", mcp: [], mcpLines: [] },
  {
    requirement: "ANAME-07",
    label: "prints no mcp line for an absent list",
    mcp: undefined,
    mcpLines: [],
  },
  {
    requirement: "AVAR-04",
    label: "renders each server's variable lists, its unsupported feature, or its bare name",
    mcp: [
      { name: "plugin:a:p", unsetVariables: ["A", "B"] },
      { name: "plugin:a:q", withheldVariables: ["C"] },
      { name: "plugin:a:r", unsetVariables: ["A"], withheldVariables: ["C"] },
      { name: "plugin:a:s", unsupportedFeature: "ws" },
      { name: "plugin:a:t" },
    ],
    mcpLines: [
      "    mcp: plugin:a:p (unset A, B), plugin:a:q (withheld C), " +
        "plugin:a:r (unset A; withheld C), plugin:a:s (unsupported ws), plugin:a:t",
    ],
  },
  {
    requirement: "AVAR-04",
    label: "renders the bare name for two empty variable lists",
    mcp: [{ name: "plugin:a:p", unsetVariables: [], withheldVariables: [] }],
    mcpLines: ["    mcp: plugin:a:p"],
  },
  {
    requirement: "ASTAT-01",
    label: "renders a server's state alone inside its parentheses",
    mcp: [{ name: "plugin:a:p", status: "connected" } satisfies McpServerSummaryEntry],
    mcpLines: ["    mcp: plugin:a:p (connected)"],
  },
  {
    requirement: "ASTAT-01",
    label: "renders a server's state first, then its unset and withheld lists",
    mcp: [
      {
        name: "plugin:a:p",
        status: "needs authentication",
        unsetVariables: ["A"],
        withheldVariables: ["C"],
      } satisfies McpServerSummaryEntry,
    ],
    mcpLines: ["    mcp: plugin:a:p (needs authentication; unset A; withheld C)"],
  },
]) {
  test(`${requirement}: ${label}`, () => {
    // arrange
    const message: PluginInfoMessage = {
      kind: "plugin-info",
      marketplaceName: "official",
      marketplaceScope: "user",
      marketplaceDetails: { autoupdate: false },
      plugin: {
        status: "installed",
        name: "a",
        componentsResolved: true,
        components: { agents: ["b"], ...(mcp !== undefined && { mcp }) },
      },
    };

    // act
    const rendered = renderPluginInfo(message);

    // assert
    assert.equal(
      rendered,
      ["● official [user] <no autoupdate>", "  ● a (installed)", "    agents: b", ...mcpLines].join(
        "\n",
      ),
    );
  });
}

test("ADET-01: formats the requires entries as stamped", () => {
  // arrange
  const message: PluginInfoMessage = {
    kind: "plugin-info",
    marketplaceName: "official",
    marketplaceScope: "user",
    marketplaceDetails: { autoupdate: false },
    plugin: {
      status: "installed",
      name: "alpha",
      componentsResolved: true,
      components: { workflows: ["alpha:w"] },
      requires: [{ companion: "pi-dynamic-workflows", missing: false }],
    },
  };

  // act
  const rendered = renderPluginInfo(message);

  // assert
  assert.equal(
    rendered,
    [
      "● official [user] <no autoupdate>",
      "  ● alpha (installed)",
      "    workflows: alpha:w",
      "    requires: pi-dynamic-workflows",
    ].join("\n"),
  );
});

for (const { label, stamp } of [
  { label: "absent", stamp: {} },
  { label: "empty", stamp: { requires: [] } },
]) {
  test(`ADET-01: renders no requires line when the stamped list is ${label}`, () => {
    // arrange
    const message: PluginInfoMessage = {
      kind: "plugin-info",
      marketplaceName: "official",
      marketplaceScope: "user",
      marketplaceDetails: { autoupdate: false },
      plugin: {
        status: "installed",
        name: "alpha",
        componentsResolved: true,
        components: { skills: ["s"] },
        ...stamp,
      },
    };

    // act
    const rendered = renderPluginInfo(message);

    // assert
    assert.equal(
      rendered,
      "● official [user] <no autoupdate>\n  ● alpha (installed)\n    skills: s",
    );
  });
}

test("renders resolved plugin components and wraps descriptions without ellipsis", () => {
  // arrange
  const description = `${"word ".repeat(20)}supercalifragilisticexpialidocious`.trim();
  const message = {
    marketplaceName: "official",
    marketplaceScope: "user",
    marketplaceDetails: { autoupdate: true },
    plugin: {
      status: "installed",
      name: "alpha",
      scope: "project",
      version: "1",
      reasons: ["not in manifest"],
      description,
      componentsResolved: true,
      components: {
        agents: ["a"],
        commands: ["c"],
        hooks: undefined,
        mcp: [{ name: "plugin:alpha:m" }],
        skills: ["s"],
      },
      dependencies: ["dep"],
    },
  };

  // act
  const rendered = renderPluginInfo(message as never);

  // assert
  assert.equal(
    rendered,
    [
      "● official [user] <autoupdate>",
      "  ● alpha [project] v1 (installed) {not in manifest}",
      `    ${"word ".repeat(12)}word`,
      `    ${"word ".repeat(6)}word`,
      "    supercalifragilisticexpialidocious",
      "    agents: a",
      "    commands: c",
      "    mcp: plugin:alpha:m",
      "    skills: s",
      "    dependencies: dep",
    ].join("\n"),
  );
});

test("WR-09: renders one note line per entry, last, in composer order", () => {
  // arrange
  const message = {
    marketplaceName: "official",
    marketplaceScope: "user",
    marketplaceDetails: { autoupdate: false },
    plugin: {
      status: "installed",
      name: "alpha",
      componentsResolved: true,
      components: {
        agents: undefined,
        commands: undefined,
        hooks: undefined,
        mcp: undefined,
        skills: undefined,
      },
      notes: ["first note", "second note"],
    },
  };

  // act
  const rendered = renderPluginInfo(message as never);

  // assert
  assert.equal(
    rendered,
    [
      "● official [user] <no autoupdate>",
      "  ● alpha (installed)",
      "    note: first note",
      "    note: second note",
    ].join("\n"),
  );
});

test("plugin info cascades preserve zero and repeated-render many shapes", () => {
  // arrange
  const block = {
    marketplaceName: "official",
    marketplaceScope: "user",
    marketplaceDetails: { autoupdate: false },
    plugin: { status: "available", name: "alpha", componentsResolved: false },
  };

  // act
  const empty = renderPluginInfoCascade({ blocks: [] } as never);
  const once = renderPluginInfoCascade({ blocks: [block, block] } as never);
  const twice = renderPluginInfoCascade({ blocks: [block, block] } as never);

  // assert
  assert.equal(empty, "");
  assert.equal(once, twice);
  assert.equal(once.split("\n\n").length, 2);
});

for (const { message, reason, expected } of [
  {
    message: { kind: "marketplace-not-added", name: "missing" },
    reason: "marketplace not added",
    expected: "⊘ missing (failed) {marketplace not added}",
  },
  {
    message: { kind: "marketplace-not-added", name: "missing", scope: "user" },
    reason: "marketplace not added to user scope",
    expected: "⊘ missing [user] (failed) {marketplace not added to user scope}",
  },
  {
    message: { kind: "marketplace-not-added", name: "missing", scope: "project" },
    reason: "marketplace not added to project scope",
    expected: "⊘ missing [project] (failed) {marketplace not added to project scope}",
  },
] as const satisfies readonly {
  message: MarketplaceNotAddedMessage;
  reason: Reason;
  expected: string;
}[]) {
  test(`renders marketplace-not-added as ${expected}`, () => {
    // act
    const rendered = renderMarketplaceNotAdded(message, reason);

    // assert
    assert.equal(rendered, expected);
  });
}

for (const { command, expected } of [
  { command: "pending", expected: "Pending: /claude:plugin apply has nothing to change." },
  { command: "apply", expected: "Apply: nothing to change." },
] as const) {
  test(`D-08 / D-14: renders the reconcile-pending-empty body line for ${command}`, () => {
    // act
    const rendered = renderReconcilePendingEmpty(command);

    // assert
    assert.equal(rendered, expected);
  });
}

for (const { scope, expected } of [
  {
    scope: "user",
    expected: "Nothing to prune in user scope: no orphaned dependency installs were found.",
  },
  {
    scope: "project",
    expected: "Nothing to prune in project scope: no orphaned dependency installs were found.",
  },
] as const) {
  test(`renders prune-empty for ${scope} scope`, () => {
    // arrange
    const message = { kind: "prune-empty", scope } as const satisfies PruneEmptyMessage;

    // act
    const rendered = renderPruneEmpty(message);

    // assert
    assert.equal(rendered, expected);
  });
}

test("renders prune-committed-warning as the scope line and the indented cause trailer", () => {
  // arrange
  const cause = { causeChain: ["save failed", "disk full"], truncated: false };

  // act
  const rendered = renderPruneCommittedWarning("project", cause);

  // assert
  assert.equal(rendered, "Prune committed in project scope.\n  cause: save failed -> disk full");
});

test("renders prune-committed-warning with an empty trailer when there is no cause", () => {
  // arrange
  const cause = undefined;

  // act
  const rendered = renderPruneCommittedWarning("user", cause);

  // assert
  assert.equal(rendered, "Prune committed in user scope.\n  ");
});

test("reconcile applied body preserves empty and caller-ordered blocks", () => {
  // arrange
  const marketplaces = [
    MARKETPLACE_BASE,
    { ...MARKETPLACE_BASE, name: "second", scope: "project" },
  ] as const satisfies readonly ResolvedMarketplace[];

  // act
  const empty = composeReconcileAppliedBody([]);
  const many = composeReconcileAppliedBody(marketplaces);

  // assert
  assert.equal(empty, "(no marketplaces)");
  assert.equal(many, "● official [user]\n\n● second [project]");
});

test("a whitespace-only description renders no description line", () => {
  // arrange
  const infoBase = {
    marketplaceName: "official",
    marketplaceScope: "user",
    marketplaceDetails: { autoupdate: false },
  };

  // act
  const whitespace = renderPluginInfo({
    ...infoBase,
    plugin: {
      status: "available",
      name: "alpha",
      description: " \t ",
      componentsResolved: false,
    },
  } as never);

  // assert
  assert.equal(whitespace.includes("\n     "), false);
});

test("covers the unavailable install hint and long single-word wrap boundaries", () => {
  // arrange
  const longWord = "x".repeat(70);

  // act
  const hint = composePluginLines(
    {
      status: "unavailable",
      name: "alpha",
      reasons: ["unsupported source"],
      hint: "partial-install",
    } satisfies ResolvedRow,
    "user",
  );
  const info = renderPluginInfo({
    marketplaceName: "official",
    marketplaceScope: "user",
    marketplaceDetails: { autoupdate: false },
    plugin: {
      status: "available",
      name: "alpha",
      description: longWord,
      componentsResolved: true,
      components: {},
    },
  } as never);

  // assert
  assert.deepStrictEqual(hint, [
    "  ⊘ alpha (unavailable) {unsupported source}",
    "    Re-run with --partial to install the supported components.",
  ]);
  assert.equal(info.endsWith(`\n    ${longWord}`), true);
});

test("optional dependency and empty cause branches collapse without extra tokens", () => {
  // arrange / act
  const partial = composePluginLines(
    {
      ...{ name: "alpha", reasons: [] },
      status: "partially-installed",
      severity: "warning",
      needsReload: true,
    },
    "user",
  )[0]!.slice(2);
  const failed = composePluginLines(
    {
      status: "failed",
      severity: "error",
      name: "alpha",
      reasons: [],
      failure: { leaks: [], rollbackPartial: [] },
    } satisfies ResolvedRow<PluginFailedMessage>,
    "user",
  );

  // assert
  assert.equal(partial, "◉ alpha (partially-installed)");
  assert.deepStrictEqual(failed, ["  ⊘ alpha (failed)"]);
});

test("the remote and partially-available glyphs preserve exact values on their rows", () => {
  // arrange
  // `◌` and `⊖` are module-private, and each is carried by exactly one row
  // renderer, so the glyph the row leads with is the value under test. The row
  // cases further down pin the whole line; this case pins the glyph alone, which
  // is what the constant comparison above states for the other five.
  const expectedGlyphs = ["◌", "⊖"];

  // act
  const glyphs = [
    composePluginLines({ status: "remote", name: "alpha", reasons: [] }, "user")[0]!
      .slice(2)
      .slice(0, 1),
    composePluginLines({ status: "partially-available", name: "alpha", reasons: [] }, "user")[0]!
      .slice(2)
      .slice(0, 1),
  ];

  // assert
  assert.deepStrictEqual(glyphs, expectedGlyphs);
});

for (const { name, version, expected } of [
  { name: "omits an undefined version", version: undefined, expected: "" },
  { name: "omits an empty version", version: "", expected: "" },
  { name: "renders a semantic version", version: "1.2.3", expected: "v1.2.3" },
  { name: "shortens an exact hash version", version: "hash-0123456789ab", expected: "v#0123456" },
  { name: "shortens a legacy sha version", version: "sha-abcdef012345", expected: "v#abcdef0" },
  { name: "GV-01: shortens a commit version", version: "abcdef012345", expected: "v#abcdef0" },
  {
    name: "GV-01: shortens a git-subdir commit version",
    version: "abcdef012345-3989e95a",
    expected: "v#abcdef0",
  },
  {
    name: "GV-01: preserves a commit version with a short path hash",
    version: "abcdef012345-3989e95",
    expected: "vabcdef012345-3989e95",
  },
  {
    name: "preserves an eleven-digit hash-like version",
    version: "hash-0123456789a",
    expected: "vhash-0123456789a",
  },
  {
    name: "preserves a thirteen-digit hash-like version",
    version: "hash-0123456789abc",
    expected: "vhash-0123456789abc",
  },
  {
    name: "preserves uppercase hash digits",
    version: "hash-0123456789AB",
    expected: "vhash-0123456789AB",
  },
  {
    name: "preserves an eleven-digit sha-like version",
    version: "sha-abcdef01234",
    expected: "vsha-abcdef01234",
  },
  {
    name: "preserves a thirteen-digit sha-like version",
    version: "sha-abcdef0123456",
    expected: "vsha-abcdef0123456",
  },
] as const) {
  test(name, () => {
    // arrange
    const expectedVersion = `  ○ alpha${expected === "" ? "" : ` ${expected}`} (available)`;

    // act
    const renderedVersion = composePluginLines(
      {
        status: "available",
        name: "alpha",
        reasons: [],
        ...(version === undefined ? {} : { version }),
      },
      "user",
    )[0];

    // assert
    assert.equal(renderedVersion, expectedVersion);
  });
}

for (const { name, pluginScope, marketplaceScope, expected } of [
  {
    name: "omits an absent plugin scope",
    pluginScope: undefined,
    marketplaceScope: "user",
    expected: "",
  },
  {
    name: "omits a matching plugin scope",
    pluginScope: "user",
    marketplaceScope: "user",
    expected: "",
  },
  {
    name: "renders a differing plugin scope",
    pluginScope: "project",
    marketplaceScope: "user",
    expected: "[project]",
  },
] as const) {
  test(name, () => {
    // arrange
    const expectedBracket = `  ● alpha${expected === "" ? "" : ` ${expected}`} (installed)`;

    // act
    const bracket = composePluginLines(
      {
        status: "installed",
        name: "alpha",
        reasons: [],
        severity: "info",
        needsReload: false,
        ...(pluginScope === undefined ? {} : { scope: pluginScope }),
      },
      marketplaceScope,
    )[0];

    // assert
    assert.equal(bracket, expectedBracket);
  });
}

test("composeVersionArrow renders complete version bytes on both sides", () => {
  // arrange
  const expectedArrow = "  ● alpha v#0123456 → v2.0.0 (updated)";

  // act
  const arrow = composePluginLines(
    {
      status: "updated",
      name: "alpha",
      from: "hash-0123456789ab",
      to: "2.0.0",
      reasons: [],
      severity: "info",
      needsReload: true,
    },
    "user",
  )[0];

  // assert
  assert.equal(arrow, expectedArrow);
});

test("UPR-02: an updated row with commits names each side's short commit", () => {
  // arrange
  const expectedArrow = "  ● ghp v1.0.0 (aaaaaaa) → v1.0.0 (bbbbbbb) (updated)";

  // act
  const arrow = composePluginLines(
    {
      status: "updated",
      name: "ghp",
      from: "1.0.0",
      to: "1.0.0",
      commits: { from: "a".repeat(40), to: "b".repeat(40) },
      reasons: [],
      severity: "info",
      needsReload: true,
    },
    "user",
  )[0];

  // assert
  assert.equal(arrow, expectedArrow);
});

test("NREG-01: an updated row without commits keeps the plain sha arrow", () => {
  // arrange
  const expectedArrow = "  ● ghp v#aaaaaaa → v#bbbbbbb (updated)";

  // act
  const arrow = composePluginLines(
    {
      status: "updated",
      name: "ghp",
      from: "sha-aaaaaaaaaaaa",
      to: "sha-bbbbbbbbbbbb",
      reasons: [],
      severity: "info",
      needsReload: true,
    },
    "user",
  )[0];

  // assert
  assert.equal(arrow, expectedArrow);
});

const MOVE_ROWS = [
  {
    title: "a reinstalled row",
    row: {
      status: "reinstalled",
      name: "ghp",
      version: "1.1.0",
      reasons: [],
      severity: "info",
      needsReload: true,
    },
    glyph: "●",
    tail: "(reinstalled)",
  },
  {
    title: "a partially-installed row",
    row: {
      status: "partially-installed",
      name: "ghp",
      version: "1.1.0",
      reasons: ["unsupported component"],
      severity: "info",
      needsReload: true,
    },
    glyph: "◉",
    tail: "(partially-installed) {unsupported component}",
  },
  {
    title: "a failed row",
    row: {
      status: "failed",
      name: "ghp",
      version: "1.1.0",
      reasons: ["lock held"],
      severity: "error",
    },
    glyph: "⊘",
    tail: "(failed) {lock held}",
  },
] as const satisfies readonly {
  readonly title: string;
  readonly row: ResolvedRow;
  readonly glyph: string;
  readonly tail: string;
}[];

for (const { title, row, glyph, tail } of MOVE_ROWS) {
  test(`NREG-01: ${title} without from keeps its single version`, () => {
    // act
    const line = composePluginLines(row, "user")[0];

    // assert
    assert.equal(line, `  ${glyph} ghp v1.1.0 ${tail}`);
  });

  test(`UPR-03: ${title} with from draws the version arrow`, () => {
    // act
    const line = composePluginLines({ ...row, from: "1.0.0" }, "user")[0];

    // assert
    assert.equal(line, `  ${glyph} ghp v1.0.0 → v1.1.0 ${tail}`);
  });

  test(`UPR-02: ${title} with from and commits names each side's short commit`, () => {
    // act
    const line = composePluginLines(
      {
        ...row,
        from: "1.1.0",
        commits: { from: "a".repeat(40), to: "b".repeat(40) },
      },
      "user",
    )[0];

    // assert
    assert.equal(line, `  ${glyph} ghp v1.1.0 (aaaaaaa) → v1.1.0 (bbbbbbb) ${tail}`);
  });
}

for (const { name, reasons, expected } of [
  {
    name: "omits an undefined reasons block",
    reasons: undefined,
    expected: "",
  },
  {
    name: "omits an empty reasons block",
    reasons: [] satisfies readonly Reason[],
    expected: "",
  },
  {
    name: "renders resolved reasons in their supplied order and adds none",
    reasons: ["not found", "requires pi-subagents"] satisfies readonly Reason[],
    expected: "{not found, requires pi-subagents}",
  },
] as const) {
  test(name, () => {
    // arrange
    const expectedReasons = `  ○ alpha (available)${expected === "" ? "" : ` ${expected}`}`;

    // act
    const renderedReasons = composePluginLines(
      { status: "available", name: "alpha", reasons: reasons ?? [] },
      "user",
    )[0];

    // assert
    assert.equal(renderedReasons, expectedReasons);
  });
}

test("pluginRow composes scope, version, label, and reasons exactly", () => {
  // arrange
  const expectedRow = "⊘ alpha [project] v1.0.0 (failed) {not found}";

  // act
  const row = composePluginLines(
    {
      ...{ name: "alpha", scope: "project", version: "1.0.0", reasons: ["not found"] },
      status: "failed",
      severity: "error",
    },
    "user",
  )[0]!.slice(2);

  // assert
  assert.equal(row, expectedRow);
});

test("partiallyInstalledRow composes its resolved reasons in order", () => {
  // arrange
  const expectedRow = "◉ alpha v1.0.0 (partially-installed) {lsp, requires pi-subagents}";

  // act
  const row = composePluginLines(
    {
      ...{ name: "alpha", version: "1.0.0", reasons: ["lsp", "requires pi-subagents"] },
      status: "partially-installed",
      severity: "warning",
      needsReload: true,
    },
    "user",
  )[0]!.slice(2);

  // assert
  assert.equal(row, expectedRow);
});

test("installedLikeRow composes an exact transition row", () => {
  // arrange
  const expectedRow = "● alpha [project] v1.0.0 (installed) {orphan rewake}";

  // act
  const row = composePluginLines(
    {
      ...{ name: "alpha", scope: "project", reasons: ["orphan rewake"] },
      status: "installed",
      version: "1.0.0",
      severity: "info",
      needsReload: true,
    },
    "user",
  )[0]!.slice(2);

  // assert
  assert.equal(row, expectedRow);
});

for (const { name, row, expected } of [
  {
    name: "composePluginLines renders a realized uninstalled row",
    row: () =>
      composePluginLines(
        {
          status: "uninstalled",
          name: "alpha",
          scope: "project",
          version: "1.0.0",
          severity: "info",
          needsReload: true,
          reasons: [],
        },
        "user",
      )[0]!.slice(2),
    expected: "○ alpha [project] v1.0.0 (uninstalled)",
  },
  {
    name: "composePluginLines renders the data disposition of an uninstalled row",
    row: () =>
      composePluginLines(
        {
          status: "uninstalled",
          name: "alpha",
          scope: "project",
          version: "1.0.0",
          reasons: ["data kept"],
          severity: "info",
          needsReload: true,
        },
        "user",
      )[0]!.slice(2),
    expected: "○ alpha [project] v1.0.0 (uninstalled) {data kept}",
  },
  {
    name: "composePluginLines renders an available row's entry-derived reason",
    row: () =>
      composePluginLines(
        {
          ...{ status: "available", name: "alpha", version: "1.0.0", reasons: [] },
          reasons: ["installs disabled"],
        },
        "user",
      )[0]!.slice(2),
    expected: "○ alpha v1.0.0 (available) {installs disabled}",
  },
  {
    name: "composePluginLines renders a remote row's entry-derived reason",
    row: () =>
      composePluginLines(
        {
          ...{ status: "remote", name: "alpha", version: "1.0.0", reasons: [] },
          reasons: ["installs disabled"],
        },
        "user",
      )[0]!.slice(2),
    expected: "◌ alpha v1.0.0 (remote) {installs disabled}",
  },
  {
    name: "composePluginLines renders an unavailable row's structural reasons",
    row: () =>
      composePluginLines(
        { status: "unavailable", name: "alpha", version: "1.0.0", reasons: ["invalid manifest"] },
        "user",
      )[0]!.slice(2),
    expected: "⊘ alpha v1.0.0 (unavailable) {invalid manifest}",
  },
  {
    name: "composePluginLines renders a partially-available row's dropped kinds",
    row: () =>
      composePluginLines(
        { status: "partially-available", name: "alpha", version: "1.0.0", reasons: ["lsp"] },
        "user",
      )[0]!.slice(2),
    expected: "⊖ alpha v1.0.0 (partially-available) {lsp}",
  },
  {
    name: "composePluginLines renders a disabled row's orphan-fold scope and reason",
    row: () =>
      composePluginLines(
        {
          status: "disabled",
          name: "alpha",
          scope: "project",
          version: "1.0.0",
          reasons: ["not in manifest"],
          severity: "info",
          needsReload: false,
        },
        "user",
      )[0]!.slice(2),
    expected: "◍ alpha [project] v1.0.0 (disabled) {not in manifest}",
  },
] as const) {
  test(name, () => {
    // arrange
    const expectedRow = expected;

    // act
    const renderedRow = row();

    // assert
    assert.equal(renderedRow, expectedRow);
  });
}

test("formatEnvelopeArguments returns an info body byte for byte as its only argument", () => {
  // arrange
  const body = "● official [user]\n  alpha (installed)";

  // act
  const notifyArguments = formatEnvelopeArguments(
    { severity: "info", needsReload: false, needsApply: false, noOp: false },
    body,
  );

  // assert
  assert.deepStrictEqual(notifyArguments, ["● official [user]\n  alpha (installed)"]);
});

for (const severity of ["warning", "error"] as const) {
  test(`formatEnvelopeArguments prepends a ${severity} summary as its own block`, () => {
    // arrange
    const envelope = {
      severity,
      summary: "A plugin operation has failed.",
      needsReload: false,
      needsApply: false,
      noOp: false,
    };

    // act
    const notifyArguments = formatEnvelopeArguments(
      envelope,
      "● official [user]\n  alpha (failed)",
    );

    // assert
    assert.deepStrictEqual(notifyArguments, [
      "A plugin operation has failed.\n\n● official [user]\n  alpha (failed)",
      severity,
    ]);
  });
}

for (const { name, envelope, expectedText } of [
  {
    name: "singular category words",
    envelope: {
      severity: "info",
      needsReload: false,
      needsApply: false,
      noOp: false,
      tally: { label: "Plugin update", failures: 1, warnings: 1, success: { count: 1 } },
    },
    expectedText: "body\n\nPlugin update: 1 failure, 1 warning, 1 success",
  },
  {
    name: "plural category words",
    envelope: {
      severity: "info",
      needsReload: false,
      needsApply: false,
      noOp: false,
      tally: { label: "Plugin import", failures: 2, warnings: 3, success: { count: 4 } },
    },
    expectedText: "body\n\nPlugin import: 2 failures, 3 warnings, 4 successes",
  },
  {
    name: "zero successes",
    envelope: {
      severity: "info",
      needsReload: false,
      needsApply: false,
      noOp: false,
      tally: { label: "Plugin list", failures: 0, warnings: 0, success: { count: 0 } },
    },
    expectedText: "body\n\nPlugin list: 0 successes",
  },
  {
    name: "a success verb without a plural form",
    envelope: {
      severity: "info",
      needsReload: false,
      needsApply: false,
      noOp: false,
      tally: {
        label: "Plugin update",
        failures: 0,
        warnings: 0,
        success: { count: 2, verb: "updated" },
      },
    },
    expectedText: "body\n\nPlugin update: 2 updated",
  },
  {
    name: "failures only",
    envelope: {
      severity: "info",
      needsReload: false,
      needsApply: false,
      noOp: false,
      tally: { label: "Plugin install", failures: 1, warnings: 0 },
    },
    expectedText: "body\n\nPlugin install: 1 failure",
  },
] satisfies readonly {
  readonly name: string;
  readonly envelope: Parameters<typeof formatEnvelopeArguments>[0];
  readonly expectedText: string;
}[]) {
  test(`formatEnvelopeArguments composes a tally sentence with ${name}`, () => {
    // act
    const notifyArguments = formatEnvelopeArguments(envelope, "body");

    // assert
    assert.deepStrictEqual(notifyArguments, [expectedText]);
  });
}

for (const { name, envelope, body, expectedArguments } of [
  {
    name: "orders the body, the tally, and the reload trailer",
    envelope: {
      severity: "info",
      needsReload: true,
      needsApply: false,
      noOp: false,
      tally: { label: "Plugin install", failures: 0, warnings: 0, success: { count: 1 } },
    },
    body: "body",
    expectedArguments: ["body\n\nPlugin install: 1 success\n\n/reload to pick up changes"],
  },
  {
    name: "leaves one blank line between the body and the trailer without a tally",
    envelope: { severity: "info", needsReload: true, needsApply: false, noOp: false },
    body: "body",
    expectedArguments: ["body\n\n/reload to pick up changes"],
  },
  {
    name: "puts the no-op headline in the tally slot",
    envelope: { severity: "info", needsReload: false, needsApply: false, noOp: true },
    body: "body",
    expectedArguments: ["body\n\nPlugin update: nothing to update"],
  },
  {
    name: "renders the no-op headline alone over an empty body",
    envelope: { severity: "info", needsReload: false, needsApply: false, noOp: true },
    body: "",
    expectedArguments: ["Plugin update: nothing to update"],
  },
  {
    name: "APL-04 / D-14: puts the apply trailer last, one blank line below the tally",
    envelope: {
      severity: "info",
      needsReload: false,
      needsApply: true,
      noOp: false,
      tally: { label: "Reconcile pending", failures: 0, warnings: 0, success: { count: 1 } },
    },
    body: "body",
    expectedArguments: [
      "body\n\nReconcile pending: 1 success\n\n/claude:plugin apply to make these changes",
    ],
  },
  {
    name: "APL-04 / D-14: puts the reload trailer before the apply trailer",
    envelope: { severity: "info", needsReload: true, needsApply: true, noOp: false },
    body: "body",
    expectedArguments: [
      "body\n\n/reload to pick up changes\n\n/claude:plugin apply to make these changes",
    ],
  },
  {
    name: "prepends the summary over the folded body",
    envelope: {
      severity: "error",
      summary: "A plugin operation has failed.",
      needsReload: true,
      needsApply: false,
      noOp: false,
      tally: { label: "Plugin install", failures: 1, warnings: 0 },
    },
    body: "body",
    expectedArguments: [
      "A plugin operation has failed.\n\nbody\n\nPlugin install: 1 failure\n\n/reload to pick up changes",
      "error",
    ],
  },
] satisfies readonly {
  readonly name: string;
  readonly envelope: Parameters<typeof formatEnvelopeArguments>[0];
  readonly body: string;
  readonly expectedArguments: NotifyArguments;
}[]) {
  test(`formatEnvelopeArguments ${name}`, () => {
    // act
    const notifyArguments = formatEnvelopeArguments(envelope, body);

    // assert
    assert.deepStrictEqual(notifyArguments, expectedArguments);
  });
}

/**
 * D-15: every raw kind passes its severity explicitly, so each formats to two
 * arguments. The mapped type requires one row per resolved kind, so a kind
 * without a row fails typecheck.
 */
const RAW_SURFACE_ROWS: {
  readonly [K in ResolvedRawSurface["kind"]]: {
    readonly surface: Extract<ResolvedRawSurface, { kind: K }>;
    readonly expectedArguments: NotifyArguments;
  };
} = {
  "reconcile-aborted": {
    surface: { kind: "reconcile-aborted", causeMessage: "boom" },
    expectedArguments: ["reconcile aborted: boom", "error"],
  },
  "plugin-path-skipped": {
    surface: { kind: "plugin-path-skipped", scope: "user", reason: "state.json is unreadable" },
    expectedArguments: [
      "plugin PATH not refreshed for user scope (install state unreadable): state.json is unreadable",
      "warning",
    ],
  },
  "usage-error": {
    surface: {
      kind: "usage-error",
      message: "Unknown plugin",
      usage: "Usage: /claude:plugin install <name>",
    },
    expectedArguments: ["Unknown plugin\n\nUsage: /claude:plugin install <name>", "error"],
  },
  "usage-info": {
    surface: { kind: "usage-info", usage: "Usage: /claude:plugin help [marketplace]" },
    expectedArguments: ["Usage: /claude:plugin help [marketplace]", "info"],
  },
  "autoapply-status": {
    surface: {
      kind: "autoapply-status",
      enabled: true,
      source: { scope: "project", file: "claude-plugins.local.json" },
      files: [{ scope: "project", file: "claude-plugins.local.json", value: true }],
      set: { scope: "project", file: "claude-plugins.local.json", value: true },
    },
    expectedArguments: [
      "Set autoapply to on in claude-plugins.local.json [project].\n\n" +
        "Autoapply: on (claude-plugins.local.json [project])\n\n" +
        "claude-plugins.local.json [project]: on",
      "info",
    ],
  },
  diagnostic: {
    surface: { kind: "diagnostic", header: "Warnings", lines: ["first", "second"] },
    expectedArguments: ["Warnings\n\nfirst\nsecond", "warning"],
  },
  // The example values come from catalog-state `device-flow-prompt` in
  // docs/output-catalog.md; this row holds that byte lock.
  "device-flow-prompt": {
    surface: {
      kind: "device-flow-prompt",
      verificationUri: "https://github.com/login/device",
      userCode: "ABCD-1234",
    },
    expectedArguments: ["Open https://github.com/login/device and enter: ABCD-1234", "info"],
  },
  "async-rewake-summary": {
    surface: { kind: "async-rewake-summary", summary: "ready" },
    expectedArguments: ["ready", "info"],
  },
  "stop-override-cap": {
    surface: { kind: "stop-override-cap", pluginId: "official:guard", cap: 8 },
    expectedArguments: [
      "Stop hook override cap reached.\n\n`official:guard`'s Stop hook blocked 8 times in a row; the turn ended despite its active block.",
      "warning",
    ],
  },
  "mcp-config-notices": {
    surface: {
      kind: "mcp-config-notices",
      section: "left-unchanged",
      notices: [{ kind: "left-unchanged", scope: "user", file: "mcp.json" }],
    },
    expectedArguments: [
      "MCP config left unchanged.\n\nThe user-scope mcp.json is not a valid MCP config, so it was left unchanged. Fix it before you install or update a plugin that has MCP servers.",
      "warning",
    ],
  },
  "mcp-migration": {
    surface: {
      kind: "mcp-migration",
      rows: [
        {
          kind: "removed",
          scope: "project",
          plugin: "hello",
          marketplace: "mp",
          server: "gone",
          cause: "not-declared",
        },
      ],
      notices: [],
      severity: "info",
      needsReload: true,
    },
    expectedArguments: [
      "Plugin MCP servers removed from mcp.json.\n\nRemoved from mcp.json:\n  gone (hello) [project] hello no longer declares it.\n/reload to pick up changes",
      "info",
    ],
  },
  "background-update": {
    surface: {
      kind: "background-update",
      plugins: [
        {
          name: "demo",
          marketplace: "tools",
          scope: "user",
          fromVersion: "1.0.0",
          toVersion: "1.10.0",
        },
      ],
    },
    expectedArguments: ["Plugin updated: demo · Run /reload to apply", "info"],
  },
};

for (const [kind, { surface, expectedArguments }] of Object.entries(RAW_SURFACE_ROWS)) {
  test(`formatRawSurface renders ${kind} with its explicit severity`, () => {
    // act
    const notifyArguments = formatRawSurface(surface);

    // assert
    assert.deepStrictEqual(notifyArguments, expectedArguments);
  });
}

function updatedRow(
  name: string,
  marketplace: string,
  scope: BackgroundUpdatePlugin["scope"],
): BackgroundUpdatePlugin {
  return { name, marketplace, scope, fromVersion: "1.0.0", toVersion: "1.1.0" };
}

for (const { title, plugins, text } of [
  {
    title: "joins two names with and",
    plugins: [updatedRow("alpha", "tools", "user"), updatedRow("beta", "tools", "user")],
    text: "Plugins updated: alpha and beta · Run /reload to apply",
  },
  {
    title: "counts three or more names",
    plugins: [
      updatedRow("alpha", "tools", "user"),
      updatedRow("beta", "tools", "user"),
      updatedRow("gamma", "tools", "user"),
    ],
    text: "Plugins updated: 3 plugins · Run /reload to apply",
  },
  {
    title: "names a plugin updated in both scopes once",
    plugins: [updatedRow("alpha", "tools", "project"), updatedRow("alpha", "tools", "user")],
    text: "Plugin updated: alpha · Run /reload to apply",
  },
  {
    title: "names a plugin of two marketplaces once",
    plugins: [updatedRow("alpha", "tools", "user"), updatedRow("alpha", "extras", "user")],
    text: "Plugin updated: alpha · Run /reload to apply",
  },
  {
    title: "names each plugin once in first-seen order",
    plugins: [
      updatedRow("alpha", "tools", "user"),
      updatedRow("alpha", "extras", "user"),
      updatedRow("beta", "tools", "user"),
    ],
    text: "Plugins updated: alpha and beta · Run /reload to apply",
  },
] as const) {
  test(`D-PL8-10 / D-PL8-21: formatRawSurface background-update ${title}`, () => {
    // act
    const notifyArguments = formatRawSurface({ kind: "background-update", plugins });

    // assert
    assert.deepStrictEqual(notifyArguments, [text, "info"]);
  });
}

test("AAP-04: formatRawSurface shows the default autoapply and every listed file's own value", () => {
  // act
  const notifyArguments = formatRawSurface({
    kind: "autoapply-status",
    enabled: false,
    files: [
      { scope: "user", file: "claude-plugins.json" },
      { scope: "user", file: "claude-plugins.local.json", value: false },
      { scope: "project", file: "claude-plugins.json", value: true },
    ],
  });

  // assert
  assert.deepStrictEqual(notifyArguments, [
    "Autoapply: off (default)\n\n" +
      "claude-plugins.json [user]: not set\n" +
      "claude-plugins.local.json [user]: off\n" +
      "claude-plugins.json [project]: on",
    "info",
  ]);
});

// RAWS-01 / D-06: nonempty usage joins the message with one blank line.
// Usage kinds have no no-op. RAWS-02 / D-05: a diagnostic keeps its lines
// in caller order, duplicates and empty strings included, and only a
// zero-length line list emits nothing. RAWS-05 / D-07 / D-08: the hook kinds
// pass the author's summary and the plugin id through untouched, the cap is
// data, and only a zero-length summary emits nothing. RAWS-03 / D-09: the
// device-flow values pass through verbatim, empty or carrying a query string.
for (const { title, surface, expectedArguments } of [
  {
    title: "keeps both blocks when the message equals the usage",
    surface: { kind: "usage-error", message: "Usage: x", usage: "Usage: x" },
    expectedArguments: ["Usage: x\n\nUsage: x", "error"],
  },
  {
    title: "emits an empty message without a separator when usage is empty",
    surface: { kind: "usage-error", message: "", usage: "" },
    expectedArguments: ["", "error"],
  },
  {
    title: "emits only the refusal when usage is empty",
    surface: {
      kind: "usage-error",
      message: "Browse is unavailable in print mode. Use /claude:plugin list instead.",
      usage: "",
    },
    expectedArguments: [
      "Browse is unavailable in print mode. Use /claude:plugin list instead.",
      "error",
    ],
  },
  {
    title: "keeps a trailing newline on the message untrimmed",
    surface: { kind: "usage-error", message: "Unknown plugin\n", usage: "Usage: x" },
    expectedArguments: ["Unknown plugin\n\n\nUsage: x", "error"],
  },
  {
    title: "emits an empty help usage at info severity",
    surface: { kind: "usage-info", usage: "" },
    expectedArguments: ["", "info"],
  },
  {
    title: "passes a non-ASCII message through unchanged",
    surface: { kind: "usage-error", message: "Plugin «café» introuvable ⊘", usage: "Usage: x" },
    expectedArguments: ["Plugin «café» introuvable ⊘\n\nUsage: x", "error"],
  },
  {
    title: "emits nothing for a diagnostic with zero lines",
    surface: { kind: "diagnostic", header: "Warnings", lines: [] },
    expectedArguments: undefined,
  },
  {
    title: "renders a single-line diagnostic as the header, one blank line, and the line",
    surface: { kind: "diagnostic", header: "Warnings", lines: ["only"] },
    expectedArguments: ["Warnings\n\nonly", "warning"],
  },
  {
    title: "keeps duplicate and empty diagnostic lines in caller order",
    surface: { kind: "diagnostic", header: "Warnings", lines: ["a", "", "a"] },
    expectedArguments: ["Warnings\n\na\n\na", "warning"],
  },
  {
    title: "renders empty device-flow values verbatim",
    surface: { kind: "device-flow-prompt", verificationUri: "", userCode: "" },
    expectedArguments: ["Open  and enter: ", "info"],
  },
  {
    title: "passes a device-flow URI with a query string through verbatim",
    surface: {
      kind: "device-flow-prompt",
      verificationUri: "https://verify.example/device?user_code=ab%2Fcd&lang=EN",
      userCode: "ab-CD",
    },
    expectedArguments: [
      "Open https://verify.example/device?user_code=ab%2Fcd&lang=EN and enter: ab-CD",
      "info",
    ],
  },
  {
    title: "emits nothing for an empty async-rewake summary",
    surface: { kind: "async-rewake-summary", summary: "" },
    expectedArguments: undefined,
  },
  {
    title: "returns a whitespace-padded async-rewake summary verbatim",
    surface: { kind: "async-rewake-summary", summary: "  ready  " },
    expectedArguments: ["  ready  ", "info"],
  },
  {
    title: "states the stop-override cap it is given",
    surface: { kind: "stop-override-cap", pluginId: "official:guard", cap: 3 },
    expectedArguments: [
      "Stop hook override cap reached.\n\n`official:guard`'s Stop hook blocked 3 times in a row; the turn ended despite its active block.",
      "warning",
    ],
  },
  {
    title:
      "ends a migration notice that needs no reload without the hint, at its resolved severity",
    surface: {
      kind: "mcp-migration",
      rows: [{ kind: "stopped", scope: "user", detail: "state.json is locked" }],
      notices: [],
      severity: "warning",
      needsReload: false,
    },
    expectedArguments: [
      "Plugin MCP servers in mcp.json need attention.\n\nLeft in mcp.json:\n  The user-scope move stopped: state.json is locked. The next /reload tries again.",
      "warning",
    ],
  },
  {
    title: "passes a backtick in the stop-override plugin id through unescaped",
    surface: { kind: "stop-override-cap", pluginId: "a`b", cap: 8 },
    expectedArguments: [
      "Stop hook override cap reached.\n\n`a`b`'s Stop hook blocked 8 times in a row; the turn ended despite its active block.",
      "warning",
    ],
  },
] satisfies readonly {
  readonly title: string;
  readonly surface: ResolvedRawSurface;
  readonly expectedArguments: NotifyArguments | undefined;
}[]) {
  test(`formatRawSurface ${title}`, () => {
    // act
    const notifyArguments = formatRawSurface(surface);

    // assert
    assert.deepStrictEqual(notifyArguments, expectedArguments);
  });
}

test("a missing-policy row retains its trailers before the adjacent valid row", () => {
  // arrange
  const marketplace = {
    name: "official",
    scope: "user",
    plugins: [
      {
        status: "partially-available",
        name: "orphan",
        missingPolicy: true,
        reasons: ["lsp"],
        description: "Unavailable tools",
        hint: "partial-install",
        failure: {
          cause: { causeChain: ["outer", "inner"], truncated: false },
          leaks: ["relative-leak"],
          rollbackPartial: [{ phase: "skills" }],
        },
      },
      { status: "available", name: "neighbor", reasons: [], description: "Available tools" },
    ],
  } as const satisfies ResolvedMarketplace;

  // act
  const text = composeReconcileAppliedBody([marketplace]);

  // assert
  assert.equal(
    text,
    [
      "● official [user]",
      '  orphan (failed) {internal: no render arm for "partially-available"}',
      "    Unavailable tools",
      "    Re-run with --partial to install the supported components.",
      "    cause: outer -> inner",
      "    leaked: relative-leak",
      "    [skills] (rollback failed)",
      "  ○ neighbor (available)",
      "    Available tools",
    ].join("\n"),
  );
});

test("empty plugin collections keep their header and singletons keep complete grammar", () => {
  // arrange
  const empty = { name: "official", scope: "project", plugins: [] } as const;
  const singleton = {
    name: "official",
    scope: "project",
    plugins: [
      {
        status: "installed",
        name: "alpha",
        scope: "user",
        version: "1.2.3",
        severity: "info",
        needsReload: true,
        reasons: ["lsp", "requires pi-mcp-adapter"],
        description: "One plugin",
      },
    ],
  } as const satisfies ResolvedMarketplace;

  // act
  const emptyText = composeReconcileAppliedBody([empty]);
  const singletonText = composeReconcileAppliedBody([singleton]);

  // assert
  assert.equal(emptyText, "● official [project]");
  assert.equal(
    singletonText,
    "● official [project]\n  ● alpha [user] v1.2.3 (installed) {lsp, requires pi-mcp-adapter}\n    One plugin",
  );
});
