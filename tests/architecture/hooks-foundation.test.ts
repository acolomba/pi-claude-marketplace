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

import {
  HOOKS_CONFIG_SCHEMA,
  HOOKS_VALIDATOR,
} from "../../extensions/pi-claude-marketplace/domain/components/hooks.ts";
import {
  type ResolveContext,
  type ResolvedPluginUnavailable,
  SUPPORTED_COMPONENT_KINDS,
  UNSUPPORTED_COMPONENT_KINDS,
  resolveLoose,
  resolveStrict,
} from "../../extensions/pi-claude-marketplace/domain/resolver.ts";
import { STATE_SCHEMA } from "../../extensions/pi-claude-marketplace/persistence/state-io.ts";

import type { PluginEntry } from "../../extensions/pi-claude-marketplace/domain/components/plugin.ts";

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
// Block 3: HOOK-03 -- HOOKS_CONFIG_SCHEMA accepts unknown fields at every
// nesting level (lenient stance).
// ──────────────────────────────────────────────────────────────────────────

/**
 * Recursively walk a JSON-Schema-shaped object looking for any sub-object
 * carrying `additionalProperties: false`. Returns the dotted paths where
 * strict gates appear; an empty array means HOOK-03 lenience holds.
 */
function walkSchemaForStrictAdditionalProperties(schema: unknown, path: string[]): string[] {
  const offenders: string[] = [];
  if (typeof schema !== "object" || schema === null) {
    return offenders;
  }

  const obj = schema as Record<string, unknown>;
  if (obj.additionalProperties === false) {
    offenders.push(path.length === 0 ? "<root>" : path.join("."));
  }

  for (const [key, child] of Object.entries(obj)) {
    if (child === null || typeof child !== "object") {
      continue;
    }

    offenders.push(...walkSchemaForStrictAdditionalProperties(child, [...path, key]));
  }

  return offenders;
}

test("HOOK-03: HOOKS_CONFIG_SCHEMA carries NO `additionalProperties: false` at any nesting level", () => {
  const offenders = walkSchemaForStrictAdditionalProperties(HOOKS_CONFIG_SCHEMA, []);
  assert.deepEqual(
    offenders,
    [],
    `HOOK-03 lenient stance violated -- strict gates found at: ${offenders.join(", ")}`,
  );
});

test("HOOK-03: HOOKS_VALIDATOR.Check accepts unknown fields at handler, entry, and top level", () => {
  // Unknown field on a handler entry.
  const handlerExt = {
    PreToolUse: [
      {
        matcher: "Bash",
        hooks: [{ type: "command", command: "echo hi", futureHandlerField: "ignored" }],
      },
    ],
  };
  assert.equal(
    HOOKS_VALIDATOR.Check(handlerExt),
    true,
    "handler-level unknown field must pass (HOOK-03)",
  );

  // Unknown field on a hook-entry.
  const entryExt = {
    PreToolUse: [
      {
        matcher: "Bash",
        hooks: [{ type: "command", command: "echo hi" }],
        futureEntryField: "ignored",
      },
    ],
  };
  assert.equal(
    HOOKS_VALIDATOR.Check(entryExt),
    true,
    "entry-level unknown field must pass (HOOK-03)",
  );

  // Unknown event key at the top level (D-57-02 lenient top-level).
  const topExt = {
    FutureEventX: [{ matcher: "Bash", hooks: [{ type: "command", command: "echo hi" }] }],
  };
  assert.equal(
    HOOKS_VALIDATOR.Check(topExt),
    true,
    "top-level unknown event key must pass (D-57-02)",
  );
});

// ──────────────────────────────────────────────────────────────────────────
// Block 4: HOOK-01 -- SUPPORTED includes hooks, UNSUPPORTED excludes hooks.
// ──────────────────────────────────────────────────────────────────────────

test("HOOK-01: SUPPORTED_COMPONENT_KINDS is the closed 4-tuple [skills,commands,agents,hooks]", () => {
  assert.deepEqual(
    [...SUPPORTED_COMPONENT_KINDS],
    ["skills", "commands", "agents", "hooks"],
    "SUPPORTED_COMPONENT_KINDS is a public closed-set contract -- shape and order are locked",
  );
});

test("HOOK-01: UNSUPPORTED_COMPONENT_KINDS does NOT contain 'hooks'", () => {
  assert.ok(
    !(UNSUPPORTED_COMPONENT_KINDS as readonly string[]).includes("hooks"),
    `UNSUPPORTED_COMPONENT_KINDS must NOT contain "hooks": ${UNSUPPORTED_COMPONENT_KINDS.join(",")}`,
  );
});

// ──────────────────────────────────────────────────────────────────────────
// Block 5: NFR-7 + HOOK-01 -- resolveStrict and resolveLoose admit a
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

  assert.equal(r.state, "installable", `resolveStrict must admit: notes=${r.notes.join(" / ")}`);

  if (r.state === "installable") {
    assert.ok(r.supported.includes("hooks"), "supported must contain 'hooks'");
    assert.equal(typeof r.pluginRoot, "string");
    assert.ok(r.pluginRoot.length > 0);
  }
});

test("NFR-7 + HOOK-01: resolveLoose admits a hook-only plugin (installable: true with hooks supported)", async () => {
  const entry: PluginEntry = { name: "hookplug", source: "./hookplug" };
  const ctx = hookOnlyCtx("/abs/marketplace/hookplug");

  const r = await resolveLoose(entry, ctx);

  assert.equal(r.state, "installable", `resolveLoose must admit: notes=${r.notes.join(" / ")}`);

  if (r.state === "installable") {
    assert.ok(r.supported.includes("hooks"), "supported must contain 'hooks'");
    assert.equal(typeof r.pluginRoot, "string");
    assert.ok(r.pluginRoot.length > 0);
  }
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
