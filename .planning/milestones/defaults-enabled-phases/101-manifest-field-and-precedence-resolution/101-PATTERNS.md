# Phase 101: Manifest field and precedence resolution - Pattern Map

**Mapped:** 2026-08-14
**Files analyzed:** 13 modified (2 production, 11 test) — 0 created
**Analogs found:** 12 / 13 (1 genuine absence, documented below)

> **Phase shape note.** This phase creates no new files. Every pattern below is
> an *in-place edit shape* against a real, quoted current excerpt. Line numbers
> are pre-edit and were read this session.

## File Classification

| Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---------------|------|-----------|----------------|---------------|
| `extensions/pi-claude-marketplace/domain/components/plugin.ts` | schema/model | validation (transform) | `version` in the same `PLUGIN_METADATA_FIELDS` bag | exact (sibling field) |
| `extensions/pi-claude-marketplace/domain/resolver.ts` — `MATERIALIZABLE_FIELDS` | model | transform | `orphanRewake` / `droppedHooks` in the same bag | role-match (they are `Type.Optional`; this one is not — see Pattern B) |
| `extensions/pi-claude-marketplace/domain/resolver.ts` — precedence helper | domain utility | pure transform | **none** — see [No Analog Found](#no-analog-found) | none |
| `extensions/pi-claude-marketplace/domain/resolver.ts` — `preflightStages` return + threading | domain utility | transform | `manifest` field on the same `ok` arm | exact |
| `tests/bridges/{agents,skills}/stage.test.ts`, `tests/bridges/{commands,skills}/discover.test.ts`, `tests/bridges/commands/stage.test.ts`, `tests/bridges/integration*.test.ts` (9 files, 16 sites) | test fixture | fixture construction | each other — one uniform shape | exact |
| `tests/orchestrators/plugin/plugin-state-classifier.test.ts` | test fixture | fixture construction | same uniform shape | exact |
| `tests/domain/manifest.test.ts` | test | validation assertion | `MM-2 PLUGIN_ENTRY rejects name as number` | exact |
| `tests/domain/resolver-strict.test.ts` | test | resolution assertion | `PR-2(4) malformed plugin.json` + `basicEntry` | exact |
| `tests/domain/resolver-loose.test.ts` | test | resolution assertion | `MM-6 entry.skills absent but manifest declares skills` | exact (inverted expectation) |
| `tests/domain/resolver.types.test.ts` | test | type-level assertion | `materializableExposesPluginRoot` / `consumeUnavailable` | exact |
| `tests/orchestrators/plugin/install.test.ts` | test | characterization | `pluginVersion` opt in `seedPathMarketplaceWithPlugin` | exact |

## Pattern Assignments

### Pattern A — the schema insertion

**File:** `extensions/pi-claude-marketplace/domain/components/plugin.ts`
**Analog:** the `version` line directly above the insertion point.

Current, verbatim (`plugin.ts:18-21`):

```ts
const PLUGIN_METADATA_FIELDS = {
  description: Type.Optional(Type.String()),
  version: Type.Optional(Type.String()),
};
```

The bag is spread into both declaration sites already — `plugin.ts:62`
(`// optional metadata (MM-2)` / `...PLUGIN_METADATA_FIELDS,` inside
`PLUGIN_ENTRY_SCHEMA`) and `plugin.ts:91` (`...PLUGIN_METADATA_FIELDS,` inside
`PLUGIN_MANIFEST_SCHEMA`). **One added line covers both.** No edit to
`PLUGIN_ENTRY_SCHEMA`, `PLUGIN_MANIFEST_SCHEMA`, or `manifest.ts`.

The compiled validators (`plugin.ts:81`, `plugin.ts:102`) are module-load
`Compile(...)` calls over the schema objects, so they pick the field up with no
edit:

```ts
export const PLUGIN_ENTRY_VALIDATOR = Compile(PLUGIN_ENTRY_SCHEMA);
```

**Binding file-header instruction** (`plugin.ts:10-11`) — this is where the
`=== undefined` rule in CONTEXT.md comes from:

```ts
// TypeBox `Type.Optional` produces `T | undefined` in Static<>, not `T?`.
// Use `=== undefined` checks downstream, not `in`.
```

---

### Pattern B — the resolver arm-field insertion

**File:** `extensions/pi-claude-marketplace/domain/resolver.ts`, inside
`MATERIALIZABLE_FIELDS` (bag opens at line 159).

**Analog with a deliberate deviation.** The three nearest neighbours
(`hooksConfigPath`, `orphanRewake`, `droppedHooks`) are all `Type.Optional`.
`defaultEnabled` must **not** copy them — it is non-optional `Type.Boolean()`.
The neighbours are optional because absence is meaningful (no hooks file, no
orphan, nothing dropped); `defaultEnabled` always has an answer. Copy the
*placement*, not the optionality.

The bag's own header comment states why it is the right insertion point
(`resolver.ts:154-158`):

```ts
// Extracted into one bag and spread into both schemas so the two arms stay
// token-identical by construction (spreading `state` first keeps the literal
// discriminant on each arm; TypeBox key order does not affect the static type).
```

The `unavailable` arm (`resolver.ts:211-216`) is **not** touched; its own
comment is the invariant to preserve:

```ts
const ResolvedPluginUnavailableSchema = Type.Object({
  state: Type.Literal("unavailable"),
  name: Type.String(),
  notes: Type.Array(Type.String()), // structural reasons
  // pluginRoot intentionally absent -- NFR-7 enforces non-readability
});
```

---

### Pattern C — threading the value through `preflightStages`

**File:** `extensions/pi-claude-marketplace/domain/resolver.ts`
**Analog:** the `manifest` field already on the same `ok` arm — same lifetime,
same producer, same two consumers.

Current signature (`resolver.ts:700-711`):

```ts
async function preflightStages(
  entry: PluginEntry,
  ctx: ResolveContext,
): Promise<
  | {
      kind: "ok";
      pluginRoot: string;
      manifest: Record<string, unknown> | null;
      partial: PartialResolution;
    }
  | { kind: "unavailable"; result: ResolvedPluginUnavailable }
> {
```

Current success return, the single call site of the new helper
(`resolver.ts:753-762`):

```ts
  // PR-2 case 4: malformed plugin.json (best-effort -- absence is OK).
  const manifestResult = await readManifest(ctx, pluginRoot);
  if (!manifestResult.ok) {
    return {
      kind: "unavailable",
      result: unavailable(entry.name, [...partial.notes, manifestResult.reason]),
    };
  }

  return { kind: "ok", pluginRoot, manifest: manifestResult.manifest, partial };
```

Downstream consumers to thread through — current bodies verbatim
(`resolver.ts:431-466`):

```ts
function materializableFields(
  name: string,
  pluginRoot: string,
  partial: PartialResolution,
): Omit<ResolvedPluginInstallable, "state"> {
  return {
    name,
    pluginRoot,
    supported: partial.supported,
    unsupported: partial.unsupported,
    notes: partial.notes,
    componentPaths: partial.componentPaths,
    mcpServers: partial.mcpServers,
    ...(partial.hooksConfigPath !== undefined && { hooksConfigPath: partial.hooksConfigPath }),
    ...(partial.orphanRewake !== undefined && { orphanRewake: partial.orphanRewake }),
    ...(partial.droppedHooks !== undefined && { droppedHooks: partial.droppedHooks }),
  };
}

function installable(
  name: string,
  pluginRoot: string,
  partial: PartialResolution,
): ResolvedPluginInstallable {
  return { state: "installable", ...materializableFields(name, pluginRoot, partial) };
}

// D-64-06: the partially-available arm. Identical payload to `installable`
// (including `pluginRoot`); only the `state` tag differs.
function partiallyAvailable(
  name: string,
  pluginRoot: string,
  partial: PartialResolution,
): ResolvedPluginPartiallyAvailable {
  return { state: "partially-available", ...materializableFields(name, pluginRoot, partial) };
}
```

The `Option B` alternative (a field on `PartialResolution`) has its own analog if
the planner prefers it — `emptyResolution()` (`resolver.ts:402-413`) seeds the
bag, and its comment documents the `exactOptionalPropertyTypes` reason the
optional fields are *omitted* rather than set to `undefined`:

```ts
function emptyResolution(): PartialResolution {
  // hooksConfigPath is left absent (not `undefined`) to satisfy
  // exactOptionalPropertyTypes; consumers narrow on
  // `partial.hooksConfigPath !== undefined`.
  return {
    supported: [],
    unsupported: [],
    notes: [],
    componentPaths: { skills: [], commands: [], agents: [] },
    mcpServers: {},
  };
}
```

---

### Pattern D — the 17 construction sites (the mechanical fan-out)

**All 16 test sites share one literal shape.** Every one is an object literal
annotated `ResolvedPluginInstallable` or `ResolvedPlugin` whose last property is
`mcpServers: {}`. The edit is identical everywhere: add `defaultEnabled: true`.
The planner can write this as one action with a site table rather than 16
actions.

The canonical helper shape, verbatim
(`tests/bridges/agents/stage.test.ts:35-47`):

```ts
function makeResolved(name: string, pluginRoot: string): ResolvedPluginInstallable {
  return {
    state: "installable",
    name,
    pluginRoot,
    supported: ["agents"],
    unsupported: [],
    notes: [],
    // D-07: componentPaths.agents is `readonly string[]`.
    componentPaths: { skills: [], commands: [], agents: ["agents"] },
    mcpServers: {},
  };
}
```

The canonical inline shape, verbatim
(`tests/bridges/skills/discover.test.ts:180-190`):

```ts
    const resolved: ResolvedPluginInstallable = {
      state: "installable",
      name: "acme",
      pluginRoot: tmp,
      supported: ["skills"],
      unsupported: [],
      notes: [],
      componentPaths: { skills: [a, b], commands: [], agents: [] },
      mcpServers: {},
    };
```

**The complete site table** (line = the literal's opening line, pre-edit):

| # | File | Line | Site kind |
|---|------|------|-----------|
| 1 | `extensions/pi-claude-marketplace/domain/resolver.ts` | 437 | production — `materializableFields` return (resolved by Pattern C) |
| 2 | `tests/bridges/agents/stage.test.ts` | 36 | `makeResolved(name, pluginRoot)` helper |
| 3 | `tests/bridges/commands/discover.test.ts` | 19 | `makeResolved(pluginRoot, commandsRel)` helper |
| 4 | `tests/bridges/commands/discover.test.ts` | 214 | inline — multi-element `componentPaths.commands` |
| 5 | `tests/bridges/commands/discover.test.ts` | 250 | inline — first-wins collision |
| 6 | `tests/bridges/commands/stage.test.ts` | 55 | `makeResolved(pluginRoot, commandsRel?)` helper |
| 7 | `tests/bridges/integration-foreign-content.test.ts` | 47 | `makeResolved()` helper |
| 8 | `tests/bridges/integration-materialization-gate.test.ts` | 99 | inline — AS-9 test |
| 9 | `tests/bridges/integration.test.ts` | 68 | `makeResolved()` helper |
| 10 | `tests/bridges/skills/discover.test.ts` | 24 | `makeResolved(pluginRoot, skillsDirAbs)` helper |
| 11 | `tests/bridges/skills/discover.test.ts` | 180 | inline — multi-element `componentPaths.skills` |
| 12 | `tests/bridges/skills/discover.test.ts` | 215 | inline — first-wins collision |
| 13 | `tests/bridges/skills/discover.test.ts` | 244 | inline — declared path is itself a skill dir |
| 14 | `tests/bridges/skills/discover.test.ts` | 284 | inline — direct + container mix |
| 15 | `tests/bridges/skills/stage.test.ts` | 34 | `makeResolved(name, pluginRoot, skillsDirAbs)` helper |
| 16 | `tests/orchestrators/plugin/plugin-state-classifier.test.ts` | 45 | `installable(name)` fixture, typed `ResolvedPlugin` |
| 17 | `tests/orchestrators/plugin/plugin-state-classifier.test.ts` | 61 | `unsupportedResolved(name, unsupported)` fixture, typed `ResolvedPlugin` |

**Site 17 is the `partially-available` one** and is the proof the field landed on
both materializable arms
(`tests/orchestrators/plugin/plugin-state-classifier.test.ts:57-71`):

```ts
function unsupportedResolved(
  name = "p",
  unsupported: readonly string[] = ["lspServers"],
): ResolvedPlugin {
  return {
    state: "partially-available",
    name,
    pluginRoot: `/tmp/${name}`,
    supported: [],
    unsupported: [...unsupported],
    notes: [...unsupported.map((k) => `contains ${k}`)],
    componentPaths: { skills: [], commands: [], agents: [] },
    mcpServers: {},
  };
}
```

**The adjacent site that must NOT be touched** — its continued compilation is a
free assertion that the field stayed off the `unavailable` arm
(`tests/orchestrators/plugin/plugin-state-classifier.test.ts:73-75`):

```ts
function unavailableResolved(name = "p"): ResolvedPlugin {
  return { state: "unavailable", name, notes: ["source dir does not exist"] };
}
```

---

### Pattern E — the real `tests/domain/` helpers (use these names verbatim)

`tests/domain/resolver-strict.test.ts` and `tests/domain/resolver-loose.test.ts`
each define a **character-identical private** `mockCtx`
(strict: lines 32-61; loose: lines 27-56). It is not shared and not exported —
do not plan to import it across files.

```ts
/**
 * Build an in-memory ResolveContext. `files` maps absolute paths to either:
 *   - "dir"           -> directory exists
 *   - "file"          -> file exists, but readFileText is not stubbed (will throw)
 *   - { contents: s } -> file exists with given contents
 * Anything not in the map -> null (does not exist).
 */
function mockCtx(
  marketplaceRoot: string,
  files: Record<string, "dir" | "file" | { contents: string }>,
): ResolveContext {
  return {
    marketplaceRoot,
    statKind(p: string): Promise<"file" | "dir" | null> { /* map lookup */ },
    readFileText(p: string): Promise<string> { /* {contents} or reject ENOENT */ },
  };
}
```

Both files then declare (strict 58-59, loose 58-59):

```ts
const MP = "/abs/marketplace";
const ROOT = (rel: string): string => path.resolve(MP, rel);
```

Both define the entry builder (strict 76-82, loose 63):

```ts
/**
 * Test entries are intentionally typed as `Record<string, unknown>` (the third-party
 * boundary -- a marketplace.json author can put any garbage here). ...
 */
type LooseEntry = Record<string, unknown>;

function basicEntry(over: LooseEntry = {}): PluginEntry {
  return { name: "p1", source: "./local", ...over };
}
```

`basicEntry({ defaultEnabled: false })` is the entry side of a precedence test.
The manifest side is a `mockCtx` file entry at
`path.join(ROOT("./local"), ".claude-plugin", "plugin.json")`.

**The two-sided (entry + manifest) test template**, verbatim from the closest
existing analog — `tests/domain/resolver-loose.test.ts:87-101`. The DFEN-02
manifest-only-does-not-conflict test is this test with the **opposite**
expectation (`installable`, not `unavailable`):

```ts
test("MM-6 entry.skills absent but manifest declares skills -> conflict notInstallable", async () => {
  const localRoot = ROOT("./local");
  const manifestPath = path.join(localRoot, ".claude-plugin", "plugin.json");
  const ctx = mockCtx(MP, {
    [localRoot]: "dir",
    [manifestPath]: { contents: JSON.stringify({ name: "p1", skills: "skills" }) },
    [path.join(localRoot, "skills")]: "dir",
  });
  const r = await resolveLoose(basicEntry({ source: "./local" }), ctx);
  assert.equal(r.state, "unavailable");
  assert.ok(
    r.notes.some((n) => n.includes("component declarations conflict") && n.includes("skills")),
    `notes: ${r.notes.join(" / ")}`,
  );
});
```

**The malformed-`plugin.json` template** for the DFEN-01 non-boolean manifest
test (`tests/domain/resolver-strict.test.ts:138-149`):

```ts
test("PR-2(4) malformed plugin.json -> notInstallable", async () => {
  const ctx = mockCtx(MP, {
    [ROOT("./local")]: "dir",
    [path.join(ROOT("./local"), ".claude-plugin", "plugin.json")]: { contents: "{ not json" },
  });
  const r = await resolveStrict(basicEntry({ source: "./local" }), ctx);
  assert.equal(r.state, "unavailable");
  assert.ok(
    r.notes.some((n) => n.includes("malformed plugin.json")),
    `notes: ${r.notes.join(" / ")}`,
  );
});
```

Title convention in both files: **requirement ID first, then behavior, then
`-> outcome`.** Use `DFEN-01` / `DFEN-02` / `DFEN-03` as the anchors.

---

### Pattern F — schema accept/reject assertions (`tests/domain/manifest.test.ts`)

This is the direct answer to "how does this file assert schema rejection today".
It is a plain one-liner `assert.equal(VALIDATOR.Check(...), false)` — no
`assert.throws`, no error-shape inspection (`manifest.test.ts:282-288`):

```ts
test("MM-2 PLUGIN_ENTRY rejects missing source", () => {
  assert.equal(PLUGIN_ENTRY_VALIDATOR.Check({ name: "p" }), false);
});

test("MM-2 PLUGIN_ENTRY rejects name as number", () => {
  assert.equal(PLUGIN_ENTRY_VALIDATOR.Check({ name: 1, source: "./local" }), false);
});
```

The accept side (`manifest.test.ts:153-163`):

```ts
test("MM-2 PLUGIN_ENTRY accepts metadata fields", () => {
  assert.equal(
    PLUGIN_ENTRY_VALIDATOR.Check({
      name: "p",
      source: "./local",
      description: "desc",
      version: "1.0.0",
    }),
    true,
  );
});
```

Manifest-side accept (`manifest.test.ts:298-310`) is the same call against
`PLUGIN_MANIFEST_VALIDATOR.Check({ name, version, description, mcpServers, hooks, dependencies })`.

**The marketplace-level throw** — copy this for the whole-manifest rejection
test (`manifest.test.ts:94-113`):

```ts
test("D-48-B loadMarketplaceManifest throws InvalidMarketplaceManifestError on schema-invalid marketplace.json", async () => {
  const tmp = await mkdtemp(path.join(os.tmpdir(), "pi-cm-manifest-invalid-"));
  try {
    const manifestPath = path.join(tmp, "marketplace.json");
    await writeFile(manifestPath, JSON.stringify({ name: "missing-plugins" }), "utf8");

    await assert.rejects(
      () => loadMarketplaceManifest(manifestPath),
      (err: unknown) => {
        assert.ok(
          err instanceof InvalidMarketplaceManifestError,
          "schema-invalid manifest must throw a typed InvalidMarketplaceManifestError",
        );
        assert.match(err.message, /marketplace\.json schema invalid/);
        return true;
      },
    );
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
});
```

**The contrast to pin deliberately.** The same file carries the opposite
precedent — a per-plugin defect that does *not* fail the load
(`manifest.test.ts:240-243`):

```ts
test("MCPR-03 marketplace with a broken string-ref plugin + valid sibling loads without throwing", async () => {
  // A broken reference is a RESOLUTION-time defect isolated to one plugin; the
  // schema still accepts the string, so the whole-manifest load never throws
  // and the sibling entry survives intact.
```

DFEN-01 is the *whole-manifest rejection* case. Its test should say so, or a
later reader will "fix" it toward MCPR-03.

---

### Pattern G — the type-level DFEN-03 proof

**File:** `tests/domain/resolver.types.test.ts` (135 lines, read in full).
It does not break under the resolver edit because it uses `declare const`, not
literals (lines 28-32):

```ts
declare const r: ResolvedPlugin;
declare const inst: ResolvedPluginInstallable;
declare const unsup: ResolvedPluginPartiallyAvailable;
declare const unavail: ResolvedPluginUnavailable;
declare const materializable: MaterializablePlugin;
```

The positive-read analog to copy (line 104-106):

```ts
function materializableExposesPluginRoot(): string {
  return materializable.pluginRoot; // OK -- both arms carry pluginRoot (NFR-7).
}
```

The negative-read analog to copy (line 59-62):

```ts
function consumeUnavailable(): void {
  // @ts-expect-error -- NFR-7: pluginRoot must NOT be accessible on the unavailable variant.
  void unavail.pluginRoot;
}
```

**Mandatory follow-through:** every helper must be added to the `void` reference
list at lines 116-126 (`void consumeInstallable;` … `void materializableExcludesUnavailable;`)
or `noUnusedLocals` fails `npm run typecheck`. The file header states the
enforcement model:

```ts
// The load-bearing assertions in this file are the // @ts-expect-error
// lines below ... If any expected error fails to materialize,
// TypeScript reports "Unused @ts-expect-error directive." and
// `npm run typecheck` fails.
```

---

### Pattern H — the criterion-5 characterization fixture

**File:** `tests/orchestrators/plugin/install.test.ts`
**Analog:** the `pluginVersion` opt on `seedPathMarketplaceWithPlugin`
(declared at line 130; opt documented at lines 136-137).

The seeder currently has **no knob for an arbitrary entry-level field**. Adding
`defaultEnabled?: boolean` follows the `pluginVersion` precedent exactly — a
documented optional opt, conditionally written into the entry object
(`install.test.ts:262-272`):

```ts
  // Marketplace manifest
  const entry: Record<string, unknown> = {
    name: pluginName,
    source: opts.rawSourceOverride ?? `./plugins/${pluginName}`,
  };
  if (opts.pluginVersion !== undefined) {
    entry.version = opts.pluginVersion;
  }

  if (opts.declareDependencies === true) {
    entry.dependencies = { "some-other-plugin": "*" };
  }
```

Note the pre-existing style inconsistency at that site (no blank line after the
first `if`, one after the second). Prettier and
`@stylistic/padding-line-between-statements` govern the new block; match the
second form.

For the *manifest*-side variant of the characterization test, the analog is the
`experimental` opt, which writes into the plugin's own `plugin.json`
(`install.test.ts:204-207`):

```ts
  if (opts.experimental !== undefined) {
    pluginManifest.experimental = opts.experimental;
  }
```

## Shared Patterns

### Comment and test-title anchors
**Source:** `.claude/rules/typescript-comments.md`
**Apply to:** every file this phase touches.

Cite requirement/decision IDs (`DFEN-01`, `DFEN-02`, `DFEN-03`, `D-64-05`,
`D-64-06`, `MM-2`, `NFR-7`). Never `Phase NN`, `Plan NN`, `Wave N`, `Task N`,
bare `Pitfall N`, or `vX.Y milestone` — in comments **or** test titles. Existing
titles in the target files already comply (`MM-2 PLUGIN_ENTRY rejects …`,
`PR-2(4) malformed plugin.json -> notInstallable`).

### Early-return + blank-line style for the new helper
**Source:** `extensions/pi-claude-marketplace/domain/resolver.ts` (whole file);
enforced by `curly: ["error", "all"]` and
`@stylistic/padding-line-between-statements`.
**Apply to:** the precedence helper.

Every guard gets braces and is followed by a blank line — visible in the
`mockCtx` bodies quoted in Pattern E and throughout `preflightStages`:

```ts
      if (v === undefined) {
        return Promise.resolve(null);
      }

      if (v === "dir") {
        return Promise.resolve("dir");
      }

      return Promise.resolve("file");
```

### Explicit return types
**Source:** `@typescript-eslint/explicit-module-boundary-types: "error"`
**Apply to:** the precedence helper (private, but every private function in
`resolver.ts` is annotated — `function unavailable(name: string, notes: string[]): ResolvedPluginUnavailable`).

### Test imports
**Source:** every file in `tests/domain/`
**Apply to:** all test edits.

Explicit `.ts` extensions on production imports; type-only imports last and
separated by a blank line (`tests/domain/resolver-strict.test.ts:13-23`):

```ts
import {
  type GitPluginRootResult,
  type ResolveContext,
  type ResolvedPlugin,
  requirePartialInstallable,
  requireInstallable,
  resolveStrict,
} from "../../extensions/pi-claude-marketplace/domain/resolver.ts";
import { PluginShapeError } from "../../extensions/pi-claude-marketplace/shared/errors.ts";

import type { PluginEntry } from "../../extensions/pi-claude-marketplace/domain/components/plugin.ts";
```

Note the file mixes inline `type` specifiers with a trailing `import type` block;
both are in use and neither is being enforced away.

## No Analog Found

| Element | Role | Data Flow | Reason |
|---------|------|-----------|--------|
| The `resolveDefaultEnabled(entry, manifest)` precedence helper | domain utility | pure transform (two-source scalar first-wins) | **No analog exists. Verified this session, not inferred.** |

RESEARCH.md's claim that no metadata field is resolved today is **confirmed**:

- `grep -n "description\|version" extensions/pi-claude-marketplace/domain/resolver.ts`
  returns exactly **one** hit, and it is a comment about `resolvedSha`
  (`resolver.ts:248`). Neither `description` nor `version` appears in resolver
  code at all.
- Every production read of `description` goes against a **raw parsed entry or
  manifest**, never against `ResolvedPlugin`:
  `orchestrators/plugin/info.ts:849` (`const description = entry.description;`),
  `orchestrators/plugin/list.ts:419` and `:643` (`manifestEntry?.description`),
  `orchestrators/plugin/fetch.ts:423` (`entry.description`),
  `orchestrators/marketplace/info.ts:90` (`parsed.description`).

The nearest structural relative is the strict-mode component-path union
(entry-order-then-manifest-order, `resolver.ts:1359-1364`), but it is **per
component kind and additive** — it concatenates two lists — whereas
`defaultEnabled` is a **scalar first-wins with a default**. It is close enough to
justify the *direction* of precedence as house-consistent, and too different to
copy code from.

**Guidance for the planner:** write the helper from RESEARCH.md's recommended
shape (§"The precedence helper") rather than pointing at an analog file. Do not
copy the `resolvedSha` side-channel in
`orchestrators/plugin/install.ts:582-591` — that pattern exists precisely because
`resolvedSha` is *not* derivable from the manifest, and `defaultEnabled` is.

## Metadata

**Analog search scope:** `extensions/pi-claude-marketplace/domain/`,
`extensions/pi-claude-marketplace/orchestrators/plugin/`, `tests/domain/`,
`tests/bridges/`, `tests/orchestrators/plugin/`
**Files read this session:** 12 (2 production in full/targeted, 10 test targeted)
**Pattern extraction date:** 2026-08-14
