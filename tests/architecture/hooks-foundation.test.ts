// Architecture-level invariant pins for the HOOK-01 / HOOK-02 / HOOK-03 /
// D-57-01 / D-57-02 / D-57-04 / NFR-7 leaf-foundation contract.
//
// Each test in this file pins one load-bearing decision that is a single
// textual diff away from regression. If any of the five tests below
// red-fails CI, a future contributor inadvertently reverted a locked
// invariant.
//
// Static introspection of TypeBox schemas (via the JSON Schema shape they
// produce at module load) is the technique. Runtime parse round-trips
// exercise HOOK-03 lenience at every nesting level. A type-level
// `@ts-expect-error` directive locks the NFR-7 discriminated contract --
// `npm run typecheck` is the load-bearing assertion for that block.

import assert from "node:assert/strict";
import test from "node:test";

import { parseHooksConfig } from "../../extensions/pi-claude-marketplace/domain/components/hooks.ts";
import { resolveStrict } from "../../extensions/pi-claude-marketplace/domain/plugin-resolver.ts";
import { STATE_SCHEMA } from "../../extensions/pi-claude-marketplace/persistence/state-io.ts";

import type { PluginEntry } from "../../extensions/pi-claude-marketplace/domain/components/plugin.ts";
import type {
  ResolveContext,
  ResolvedPluginUnavailable,
} from "../../extensions/pi-claude-marketplace/domain/resolver-types.ts";

// ──────────────────────────────────────────────────────────────────────────
// Block 1: ENBL-02 -- STATE_SCHEMA.schemaVersion is Union(Literal(1), Literal(2))
// ──────────────────────────────────────────────────────────────────────────

test("ENBL-02: STATE_SCHEMA.schemaVersion is Type.Union([Literal(1), Literal(2)])", () => {
  const versionSchema = STATE_SCHEMA.properties.schemaVersion as unknown as Record<string, unknown>;

  // Type.Union([Type.Literal(1), Type.Literal(2)]) compiles to
  // { anyOf: [{ const: 1 }, { const: 2 }] }.
  // Asserting the anyOf structure pins the ENBL-02 migration contract:
  // both v1 (pre-enabled) and v2 (enabled) on-disk formats are accepted,
  // and any future widening to v3 requires this test to be updated.
  assert.ok(Array.isArray(versionSchema.anyOf), "schemaVersion must be a union (anyOf present)");
  const anyOf = versionSchema.anyOf as Array<Record<string, unknown>>;
  assert.equal(anyOf.length, 2, "schemaVersion union must have exactly two members (1 and 2)");
  assert.ok(
    anyOf.some((m) => m.const === 1),
    "schemaVersion union must include Literal(1)",
  );
  assert.ok(
    anyOf.some((m) => m.const === 2),
    "schemaVersion union must include Literal(2)",
  );
});

// ──────────────────────────────────────────────────────────────────────────
// Block 2: HOOK-02 / D-57-01 -- resources.hooks is REQUIRED Array(String)
// ──────────────────────────────────────────────────────────────────────────

test("HOOK-02 / D-57-01: PLUGIN_INSTALL_RECORD_SCHEMA.resources.hooks is REQUIRED Array(String)", () => {
  // Navigate the nested schema down to the plugin record's resources.
  // STATE_SCHEMA.marketplaces is a Type.Record so each marketplace lives
  // under patternProperties. Same for marketplaces.<mp>.plugins.
  type SchemaNode = Record<string, unknown>;
  const marketplacesSchema = STATE_SCHEMA.properties.marketplaces as unknown as SchemaNode;
  const marketplacesPattern = marketplacesSchema.patternProperties as Record<string, SchemaNode>;
  const marketplaceKey = Object.keys(marketplacesPattern)[0];
  assert.ok(marketplaceKey !== undefined, "marketplaces must have a patternProperties entry");
  const marketplaceSchema = marketplacesPattern[marketplaceKey]!;

  const marketplaceProps = marketplaceSchema.properties as Record<string, SchemaNode>;
  const pluginsSchema = marketplaceProps.plugins;
  assert.ok(pluginsSchema !== undefined, "marketplace must declare a plugins field");
  const pluginsPattern = pluginsSchema.patternProperties as Record<string, SchemaNode>;
  const pluginKey = Object.keys(pluginsPattern)[0];
  assert.ok(pluginKey !== undefined, "plugins must have a patternProperties entry");
  const pluginSchema = pluginsPattern[pluginKey]!;

  const pluginProps = pluginSchema.properties as Record<string, SchemaNode>;
  const resourcesSchema = pluginProps.resources;
  assert.ok(resourcesSchema !== undefined, "plugin record must declare a resources field");

  // Required-list contains `hooks` alongside the other four resource arrays.
  const required = resourcesSchema.required as string[];
  assert.ok(Array.isArray(required), "resources.required must be an array");
  assert.ok(
    required.includes("hooks"),
    `resources.required must include "hooks": ${required.join(",")}`,
  );
  assert.ok(required.includes("skills"));
  assert.ok(required.includes("prompts"));
  assert.ok(required.includes("agents"));
  assert.ok(required.includes("mcpServers"));

  // The shape of resources.hooks is Type.Array(Type.String()).
  const resourceProps = resourcesSchema.properties as Record<string, SchemaNode>;
  const hooksProp = resourceProps.hooks;
  assert.ok(hooksProp !== undefined, "resources must declare a hooks field");
  assert.equal(hooksProp.type, "array", "resources.hooks must be an array schema");
  const itemsSchema = hooksProp.items as Record<string, unknown>;
  assert.equal(
    itemsSchema.type,
    "string",
    "resources.hooks items must be strings (D-57-03 generatedName)",
  );
});

// ──────────────────────────────────────────────────────────────────────────
// Block 3: HOOK-03 -- public hook resolution accepts unknown fields at every
// nesting level (lenient stance).
// ──────────────────────────────────────────────────────────────────────────

for (const { label, raw, expectedValue, expectedDropped } of [
  {
    label: "handler extension",
    raw: '{"PreToolUse":[{"matcher":"Bash","hooks":[{"type":"command","command":"echo hi","futureHandlerField":"ignored"}]}]}',
    expectedValue: {
      PreToolUse: [
        {
          matcher: "Bash",
          hooks: [{ type: "command", command: "echo hi", futureHandlerField: "ignored" }],
        },
      ],
    },
    expectedDropped: [],
  },
  {
    label: "group extension",
    raw: '{"PreToolUse":[{"matcher":"Bash","hooks":[{"type":"command","command":"echo hi"}],"futureEntryField":"ignored"}]}',
    expectedValue: {
      PreToolUse: [
        {
          matcher: "Bash",
          hooks: [{ type: "command", command: "echo hi" }],
          futureEntryField: "ignored",
        },
      ],
    },
    expectedDropped: [],
  },
  {
    label: "future event",
    raw: '{"FutureEventX":[{"matcher":"Bash","hooks":[{"type":"command","command":"echo hi"}]}]}',
    expectedValue: {},
    expectedDropped: [{ kind: "event", event: "FutureEventX" }],
  },
]) {
  test(`HOOK-03: public hook resolution preserves ${label} lenience`, () => {
    // arrange
    const anchors = { homedir: "/home/u", cwd: "/plugins/alpha", projectRoot: "/plugins/alpha" };

    // act
    const resolvedHooks = parseHooksConfig(raw, anchors, () => null);

    // assert
    assert.deepStrictEqual(resolvedHooks, {
      ok: true,
      value: expectedValue,
      dropped: expectedDropped,
      ifPredicates: new Map(),
    });
  });
}

// ──────────────────────────────────────────────────────────────────────────
// Block 5: NFR-7 + HOOK-01 -- resolveStrict admits a
// hook-only plugin with a parseable hooks/hooks.json. The discriminated
// installable: true | false contract is enforced both at runtime (these
// assertions) and at compile time (the @ts-expect-error directive below).
// ──────────────────────────────────────────────────────────────────────────

/**
 * Build a ResolveContext where:
 *   - the plugin root exists as a directory
 *   - hooks/hooks.json is present + parseable
 *   - plugin.json is absent (no manifest)
 *   - everything else returns null
 */
function hookOnlyCtx(pluginRoot: string): ResolveContext {
  const hooksPath = `${pluginRoot}/hooks/hooks.json`;
  const validHooks = JSON.stringify({
    PreToolUse: [{ matcher: "Edit", hooks: [{ type: "command", command: "/bin/true" }] }],
  });

  return {
    marketplaceRoot: "/abs/marketplace",
    statKind(p: string): Promise<"file" | "dir" | null> {
      if (p === pluginRoot) {
        return Promise.resolve("dir");
      }

      if (p === hooksPath) {
        return Promise.resolve("file");
      }

      return Promise.resolve(null);
    },
    readFileText(p: string): Promise<string> {
      if (p === hooksPath) {
        return Promise.resolve(validHooks);
      }

      return Promise.reject(Object.assign(new Error("ENOENT"), { code: "ENOENT" }));
    },
  };
}

test("NFR-7 + HOOK-01: resolveStrict admits a hook-only plugin (installable: true with hooks supported)", async () => {
  const entry: PluginEntry = { name: "hookplug", source: "./hookplug" };
  const ctx = hookOnlyCtx("/abs/marketplace/hookplug");

  const r = await resolveStrict(entry, ctx);

  assert.deepStrictEqual(r, {
    state: "installable",
    installable: true,
    name: "hookplug",
    pluginRoot: "/abs/marketplace/hookplug",
    supported: ["hooks"],
    unsupported: [],
    notes: [],
    componentPaths: { skills: [], commands: [], agents: [] },
    mcpServers: {},
    hooksConfigPath: "hooks/hooks.json",
    defaultEnabled: true,
  });
});

// NFR-7 type-level check. The load-bearing assertion is the
// `@ts-expect-error` directive: TypeScript MUST refuse to compile a read of
// `pluginRoot` from the `unavailable` arm. If the discriminated contract
// regresses (e.g. someone adds `pluginRoot` to the `unavailable` variant),
// the @ts-expect-error becomes "Unused" and `npm run typecheck` fails.
function nfr7TypeLevelGuard(notInst: ResolvedPluginUnavailable): void {
  // @ts-expect-error -- NFR-7: pluginRoot must NOT be accessible on the unavailable variant.
  void notInst.pluginRoot;
}

void nfr7TypeLevelGuard;
