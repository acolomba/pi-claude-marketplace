import assert from "node:assert/strict";
import { test } from "node:test";

import { ManualRecoveryError } from "../../extensions/pi-claude-marketplace/shared/errors.ts";
import {
  composeMarketplaceBlock,
  composePluginLinesWith,
  composeReconcileAppliedBody,
  composeReasons,
  composeVersionArrow,
  ICON_AVAILABLE,
  ICON_DISABLED,
  ICON_INSTALLED,
  ICON_PARTIALLY_AVAILABLE,
  ICON_PARTIALLY_INSTALLED,
  ICON_REMOTE,
  ICON_UNINSTALLABLE,
  installedLikeRow,
  joinTokens,
  partiallyInstalledRow,
  pluginRow,
  renderAvailableRow,
  renderDisabledRow,
  renderMarketplaceInfo,
  renderMarketplaceInfoCascade,
  renderMarketplaceNotAdded,
  renderMpHeader,
  renderPartiallyAvailableRow,
  renderPluginInfo,
  renderPluginInfoCascade,
  renderRemoteRow,
  renderScopeBracket,
  renderUnavailableRow,
  renderUninstalledRow,
  renderVersion,
} from "../../extensions/pi-claude-marketplace/shared/notification-grammar.ts";

import type { Reason } from "../../extensions/pi-claude-marketplace/shared/notification-types.ts";

test("exports notification grammar from its named owner", () => {
  // arrange
  const expectedType = "function";

  // act
  const actualType = typeof joinTokens;

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
    const rendered = renderMpHeader(marketplace as never, bothLoadedProbe());

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
      dependencies: [],
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
      dependencies: [],
      reasons: ["lsp"],
    },
    expected: "● alpha [project] v1 → v2 (updated) {lsp}",
  },
  {
    plugin: { status: "reinstalled", name: "alpha", scope: "user", version: "2", dependencies: [] },
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
    },
    expected: "○ alpha [project] v1 (uninstalled)",
  },
  {
    plugin: { status: "available", name: "alpha", version: "1" },
    expected: "○ alpha v1 (available)",
  },
  { plugin: { status: "remote", name: "alpha", version: "1" }, expected: "◌ alpha v1 (remote)" },
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
      dependencies: [],
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
      dependencies: [],
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
      dependencies: [],
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
    plugin: { status: "will install", name: "alpha", scope: "user" },
    expected: "● alpha (will install)",
  },
  {
    plugin: { status: "will install", name: "alpha", scope: "user", partial: true },
    expected: "● alpha (will partially install)",
  },
  {
    plugin: { status: "will uninstall", name: "alpha", scope: "user" },
    expected: "○ alpha (will uninstall)",
  },
  {
    plugin: { status: "will enable", name: "alpha", scope: "user" },
    expected: "● alpha (will enable)",
  },
  {
    plugin: { status: "will disable", name: "alpha", scope: "user" },
    expected: "◍ alpha (will disable)",
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
] as const;

for (const { plugin, expected } of ROW_CASES) {
  test(`renders exact ${plugin.status} row through the marketplace block`, () => {
    // arrange
    const marketplace = { ...MARKETPLACE_BASE, plugins: [plugin] };

    // act
    const rendered = composeMarketplaceBlock(marketplace as never, bothLoadedProbe());

    // assert
    assert.equal(rendered, `● official [user]\n  ${expected}`);
  });
}

test("composes descriptions, hints, causes, leaks, and rollback failures in order", () => {
  // arrange
  const cause = new ManualRecoveryError("outer", ["/tmp/leak"], { cause: new Error("inner") });
  const plugin = {
    status: "failed",
    name: "alpha",
    reasons: ["rollback partial"],
    partialHint: true,
    cause,
    rollbackPartial: [{ phase: "skills", cause: new Error("rollback") }, { phase: "commands" }],
  };

  // act
  const lines = composePluginLinesWith(
    plugin as never,
    bothLoadedProbe(),
    "user",
    () => "⊘ alpha (failed) {rollback partial}",
  );

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

for (const { plugin, trailer } of [
  {
    plugin: { status: "partially-available", name: "alpha", partialHint: true },
    trailer: "Re-run with --partial to install the supported components.",
  },
  {
    plugin: { status: "partially-upgradable", name: "alpha", partialHint: true },
    trailer: "Re-run with --partial to update with the supported components.",
  },
  {
    plugin: { status: "disabled", name: "alpha", enableHint: true },
    trailer: "Run enable on this plugin to use its components.",
  },
] as const) {
  test(`renders the exact ${plugin.status} trailer`, () => {
    // arrange / act
    const lines = composePluginLinesWith(plugin as never, bothLoadedProbe(), "user", () => "row");

    // assert
    assert.deepStrictEqual(lines, ["  row", `    ${trailer}`]);
  });
}

test("truncates a long inventory description and preserves a short one", () => {
  // arrange
  const longDescription = "x".repeat(67);

  // act
  const longLines = composePluginLinesWith(
    { status: "available", name: "alpha", description: longDescription } as never,
    bothLoadedProbe(),
    "user",
    () => "row",
  );
  const shortLines = composePluginLinesWith(
    { status: "available", name: "alpha", description: "short" } as never,
    bothLoadedProbe(),
    "user",
    () => "row",
  );

  // assert
  assert.deepStrictEqual(longLines, ["  row", `    ${"x".repeat(63)}...`]);
  assert.deepStrictEqual(shortLines, ["  row", "    short"]);
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
    const rendered = renderMarketplaceInfo(message as never, bothLoadedProbe());

    // assert
    const updated = source.sourceKind === "path" ? "" : "\nlast_updated: 2025-01-02T03:04:05.000Z";
    assert.equal(
      rendered,
      `● official [user] <no autoupdate>\n${expectedSource}${updated}\ndescription: Tools`,
    );
  });
}

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
  const empty = renderMarketplaceInfoCascade({ blocks: [] } as never, bothLoadedProbe());
  const many = renderMarketplaceInfoCascade(
    { blocks: [first, second] } as never,
    bothLoadedProbe(),
  );

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
    const rendered = renderPluginInfo(message as never, bothLoadedProbe());

    // assert
    assert.equal(
      rendered,
      `● official [user] <no autoupdate>\n  ${glyph} alpha (${status})\n    components: not resolved`,
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
      components: { agents: ["a"], commands: ["c"], hooks: undefined, mcp: ["m"], skills: ["s"] },
      dependencies: ["dep"],
    },
  };

  // act
  const rendered = renderPluginInfo(message as never, bothLoadedProbe());

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
      "    mcp: m",
      "    skills: s",
      "    dependencies: dep",
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
  const empty = renderPluginInfoCascade({ blocks: [] } as never, bothLoadedProbe());
  const once = renderPluginInfoCascade({ blocks: [block, block] } as never, bothLoadedProbe());
  const twice = renderPluginInfoCascade({ blocks: [block, block] } as never, bothLoadedProbe());

  // assert
  assert.equal(empty, "");
  assert.equal(once, twice);
  assert.equal(once.split("\n\n").length, 2);
});

for (const { message, expected } of [
  { message: { name: "missing" }, expected: "⊘ missing (failed) {marketplace not added}" },
  {
    message: { name: "missing", scope: "user", presentInOtherScope: true },
    expected: "⊘ missing [user] (failed) {marketplace not added to user scope}",
  },
  {
    message: { name: "missing", scope: "project", presentInOtherScope: true },
    expected: "⊘ missing [project] (failed) {marketplace not added to project scope}",
  },
] as const) {
  test(`renders marketplace-not-added as ${expected}`, () => {
    // arrange / act
    const rendered = renderMarketplaceNotAdded(message as never, bothLoadedProbe());

    // assert
    assert.equal(rendered, expected);
  });
}

test("reconcile applied body preserves empty and caller-ordered blocks", () => {
  // arrange
  const message = {
    marketplaces: [MARKETPLACE_BASE, { ...MARKETPLACE_BASE, name: "second", scope: "project" }],
  };

  // act
  const empty = composeReconcileAppliedBody({ marketplaces: [] } as never, bothLoadedProbe());
  const many = composeReconcileAppliedBody(message as never, bothLoadedProbe());

  // assert
  assert.equal(empty, "(no marketplaces)");
  assert.equal(many, "● official [user]\n\n● second [project]");
});

test("empty descriptions and invalid closed-set members take their exact boundary paths", () => {
  // arrange
  const infoBase = {
    marketplaceName: "official",
    marketplaceScope: "user",
    marketplaceDetails: { autoupdate: false },
  };

  // act
  const whitespace = renderPluginInfo(
    {
      ...infoBase,
      plugin: {
        status: "available",
        name: "alpha",
        description: " \t ",
        componentsResolved: false,
      },
    } as never,
    bothLoadedProbe(),
  );

  // assert
  assert.equal(whitespace.includes("\n     "), false);
  assert.throws(() =>
    renderMpHeader({ ...MARKETPLACE_BASE, status: "future" } as never, bothLoadedProbe()),
  );
  assert.throws(() =>
    composeMarketplaceBlock(
      { ...MARKETPLACE_BASE, plugins: [{ status: "future", name: "alpha" }] } as never,
      bothLoadedProbe(),
    ),
  );
  assert.throws(() =>
    renderMarketplaceInfo(
      {
        name: "official",
        scope: "user",
        details: { autoupdate: false },
        source: { sourceKind: "future" },
      } as never,
      bothLoadedProbe(),
    ),
  );
  assert.throws(() =>
    renderPluginInfo(
      {
        ...infoBase,
        plugin: { status: "future", name: "alpha", componentsResolved: false },
      } as never,
      bothLoadedProbe(),
    ),
  );
  assert.throws(() =>
    renderPluginInfo(
      {
        ...infoBase,
        plugin: { status: "available", name: "alpha", componentsResolved: "future" },
      } as never,
      bothLoadedProbe(),
    ),
  );
});

test("covers the unavailable install hint and long single-word wrap boundaries", () => {
  // arrange
  const longWord = "x".repeat(70);

  // act
  const hint = composePluginLinesWith(
    { status: "unavailable", name: "alpha", partialHint: true } as never,
    bothLoadedProbe(),
    "user",
    () => "row",
  );
  const info = renderPluginInfo(
    {
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
    } as never,
    bothLoadedProbe(),
  );

  // assert
  assert.deepStrictEqual(hint, [
    "  row",
    "    Re-run with --partial to install the supported components.",
  ]);
  assert.equal(info.endsWith(`\n    ${longWord}`), true);
});

test("optional dependency and empty cause branches collapse without extra tokens", () => {
  // arrange / act
  const partial = partiallyInstalledRow(
    { name: "alpha", reasons: [] },
    "user",
    neitherLoadedProbe(),
  );
  const failed = composePluginLinesWith(
    { status: "failed", name: "alpha", cause: null } as never,
    bothLoadedProbe(),
    "user",
    () => "row",
  );

  // assert
  assert.equal(partial, "◉ alpha (partially-installed)");
  assert.deepStrictEqual(failed, ["  row"]);
});

type Probe = Parameters<typeof composeReasons>[3];

function bothLoadedProbe(): Probe {
  return { piSubagentsLoaded: true, piMcpAdapterLoaded: true };
}

function neitherLoadedProbe(): Probe {
  return { piSubagentsLoaded: false, piMcpAdapterLoaded: false };
}

test("notification glyph constants preserve exact public values", () => {
  // arrange
  const expectedGlyphs = ["●", "○", "⊘", "◍", "◌", "◉", "⊖"];

  // act
  const glyphs = [
    ICON_INSTALLED,
    ICON_AVAILABLE,
    ICON_UNINSTALLABLE,
    ICON_DISABLED,
    ICON_REMOTE,
    ICON_PARTIALLY_INSTALLED,
    ICON_PARTIALLY_AVAILABLE,
  ];

  // assert
  assert.deepStrictEqual(glyphs, expectedGlyphs);
});

for (const { name, parts, expected } of [
  { name: "joins non-empty tokens with one space", parts: ["a", "b"], expected: "a b" },
  { name: "drops empty token slots", parts: ["a", "", "b", ""], expected: "a b" },
  { name: "joins an empty token list as an empty string", parts: [], expected: "" },
] as const) {
  test(name, () => {
    // arrange
    const expectedText = expected;

    // act
    const text = joinTokens(parts);

    // assert
    assert.equal(text, expectedText);
  });
}

for (const { name, version, expected } of [
  { name: "omits an undefined version", version: undefined, expected: "" },
  { name: "omits an empty version", version: "", expected: "" },
  { name: "renders a semantic version", version: "1.2.3", expected: "v1.2.3" },
  { name: "shortens an exact hash version", version: "hash-0123456789ab", expected: "v#0123456" },
  { name: "shortens an exact sha version", version: "sha-abcdef012345", expected: "v#abcdef0" },
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
    const expectedVersion = expected;

    // act
    const renderedVersion = renderVersion(version);

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
    const expectedBracket = expected;

    // act
    const bracket = renderScopeBracket(pluginScope, marketplaceScope);

    // assert
    assert.equal(bracket, expectedBracket);
  });
}

test("composeVersionArrow renders complete version bytes on both sides", () => {
  // arrange
  const expectedArrow = "v#0123456 → v2.0.0";

  // act
  const arrow = composeVersionArrow("hash-0123456789ab", "2.0.0");

  // assert
  assert.equal(arrow, expectedArrow);
});

for (const { name, reasons, agents, mcp, probe, expected } of [
  {
    name: "omits an empty reasons block",
    reasons: undefined,
    agents: false,
    mcp: false,
    probe: bothLoadedProbe(),
    expected: "",
  },
  {
    name: "renders caller reasons in their supplied order",
    reasons: ["not found", "permission denied"] satisfies readonly Reason[],
    agents: false,
    mcp: false,
    probe: bothLoadedProbe(),
    expected: "{not found, permission denied}",
  },
  {
    name: "appends missing companion markers after caller reasons",
    reasons: ["not found"] satisfies readonly Reason[],
    agents: true,
    mcp: true,
    probe: neitherLoadedProbe(),
    expected: "{not found, requires pi-subagents, requires pi-mcp}",
  },
] as const) {
  test(name, () => {
    // arrange
    const expectedReasons = expected;

    // act
    const renderedReasons = composeReasons(reasons, agents, mcp, probe);

    // assert
    assert.equal(renderedReasons, expectedReasons);
  });
}

test("pluginRow composes scope, version, label, and reasons exactly", () => {
  // arrange
  const expectedRow = "⊘ alpha [project] v1.0.0 (failed) {not found}";

  // act
  const row = pluginRow(
    "⊘",
    { name: "alpha", scope: "project", version: "1.0.0", reasons: ["not found"] },
    "user",
    "(failed)",
    bothLoadedProbe(),
  );

  // assert
  assert.equal(row, expectedRow);
});

test("partiallyInstalledRow composes dropped kinds before companion markers", () => {
  // arrange
  const expectedRow = "◉ alpha v1.0.0 (partially-installed) {lsp, requires pi-subagents}";

  // act
  const row = partiallyInstalledRow(
    { name: "alpha", version: "1.0.0", reasons: ["lsp"], dependencies: ["agents"] },
    "user",
    neitherLoadedProbe(),
  );

  // assert
  assert.equal(row, expectedRow);
});

test("installedLikeRow composes an exact transition row", () => {
  // arrange
  const expectedRow = "● alpha [project] v1.0.0 (installed) {orphan rewake}";

  // act
  const row = installedLikeRow(
    "●",
    { name: "alpha", scope: "project", dependencies: [] },
    "user",
    "v1.0.0",
    "(installed)",
    ["orphan rewake"],
    bothLoadedProbe(),
  );

  // assert
  assert.equal(row, expectedRow);
});

for (const { name, row, expected } of [
  {
    name: "renderUninstalledRow renders a realized removal",
    row: () =>
      renderUninstalledRow(
        {
          status: "uninstalled",
          name: "alpha",
          scope: "project",
          version: "1.0.0",
          severity: "info",
          needsReload: true,
        },
        bothLoadedProbe(),
        "user",
      ),
    expected: "○ alpha [project] v1.0.0 (uninstalled)",
  },
  {
    name: "renderAvailableRow renders an entry-derived reason",
    row: () =>
      renderAvailableRow(
        { status: "available", name: "alpha", version: "1.0.0" },
        bothLoadedProbe(),
        "user",
        ["installs disabled"],
      ),
    expected: "○ alpha v1.0.0 (available) {installs disabled}",
  },
  {
    name: "renderRemoteRow renders an entry-derived reason",
    row: () =>
      renderRemoteRow(
        { status: "remote", name: "alpha", version: "1.0.0" },
        bothLoadedProbe(),
        "user",
        ["installs disabled"],
      ),
    expected: "◌ alpha v1.0.0 (remote) {installs disabled}",
  },
  {
    name: "renderUnavailableRow renders structural reasons",
    row: () =>
      renderUnavailableRow(
        { status: "unavailable", name: "alpha", version: "1.0.0", reasons: ["invalid manifest"] },
        bothLoadedProbe(),
        "user",
      ),
    expected: "⊘ alpha v1.0.0 (unavailable) {invalid manifest}",
  },
  {
    name: "renderPartiallyAvailableRow renders dropped kinds",
    row: () =>
      renderPartiallyAvailableRow(
        { status: "partially-available", name: "alpha", version: "1.0.0", reasons: ["lsp"] },
        bothLoadedProbe(),
        "user",
      ),
    expected: "⊖ alpha v1.0.0 (partially-available) {lsp}",
  },
  {
    name: "renderDisabledRow renders an orphan-fold scope and reason",
    row: () =>
      renderDisabledRow(
        {
          status: "disabled",
          name: "alpha",
          scope: "project",
          version: "1.0.0",
          reasons: ["not in manifest"],
          severity: "info",
          needsReload: false,
        },
        bothLoadedProbe(),
        "user",
      ),
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
