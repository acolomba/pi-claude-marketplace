# Phase 64: Resolver Three-Way State - Pattern Map

**Mapped:** 2026-06-27
**Files analyzed:** 9 (1 schema/type source, 4 consumers, 4 tests)
**Analogs found:** 9 / 9 (all in-file or sibling self-analogs — this is a refactor, every "new" arm clones an existing arm)

## Orientation

This phase MODIFIES existing files; it creates no new modules. The dominant
pattern source is the file under refactor itself: the new `unsupported` arm is
a tagged clone of today's `installable` arm, the new `unavailable` arm is a
*minimal subset* of today's `notInstallable` arm, and `requireForceInstallable`
is a widened clone of `requireInstallable`. Every consumer migration copies the
`switch (r.state)` shape (Code Examples in 64-RESEARCH.md) over its current
`if (r.installable)`.

**Comment / test-title policy (`.claude/rules/typescript-comments.md`):** code
comments and `test(...)` / `describe(...)` titles use decision and requirement
IDs only — `D-64-01..07`, `RSTATE-01..05`, `NFR-7`, plus surviving anchors
already in these files (`PR-3`, `PR-4`, `PR-6`, `D-57-04`, `HOOK-01`, `MM-5`,
`COMP-01`, `WR-01`, `SURF-01`). NEVER write `Phase 64`, `Plan NN`, `Wave N`, or
bare `Pitfall N` / `Pattern N`. Domain words like the hooks "convention file"
or two-phase commit narration stay unchanged.

## File Classification

| Modified/Created File | Role | Data Flow | Closest Analog | Match Quality |
|-----------------------|------|-----------|----------------|---------------|
| `extensions/pi-claude-marketplace/domain/resolver.ts` | model + producer (schema/union/factories/gates) | transform (disk probe → discriminated value) | itself (binary union → three-way) | self / exact |
| `extensions/pi-claude-marketplace/domain/index.ts` | barrel re-export | n/a | itself (current re-export block, lines 29-40) | self / exact |
| `extensions/pi-claude-marketplace/orchestrators/plugin/list.ts` | orchestrator (render row) | request-response | `if (resolved.installable)` site (list.ts:350) | self / exact |
| `extensions/pi-claude-marketplace/orchestrators/plugin/info.ts` | orchestrator (render row) | request-response | the two `installable` sites (info.ts:720, 801) | self / exact |
| `extensions/pi-claude-marketplace/orchestrators/edge-deps.ts` | orchestrator (completion cache) | batch/transform | `installable = resolved.installable` (edge-deps.ts:152) | self / exact |
| `extensions/pi-claude-marketplace/shared/probe-classifiers.ts` | utility (render marker derivation) | transform | `narrowResolverNotes` (probe-classifiers.ts:87) — D-64-02 shared helper | self / role-match |
| `tests/domain/resolver.types.test.ts` | test (NFR-7 compile assertion) | n/a | itself (rewrite for three arms) | self / exact |
| `tests/domain/resolver-strict.test.ts` | test (unit) | n/a | existing `assert.equal(r.installable, …)` + `requireInstallable` tests | self / exact |
| `tests/domain/resolver-loose.test.ts` | test (unit) | n/a | strict test sibling (same structure) | sibling / exact |

## Shared Patterns

### Pattern A — Tagged TypeBox arm (literal discriminant, NO `discriminator` option)

**Source:** `domain/resolver.ts:58-110`
**Apply to:** all three new arms + the union.

The current schema uses a boolean literal as the discriminant. Three-way keeps
the identical mechanism — a literal `state` field — with no `discriminator`
option passed to `Type.Union`. The header comment at resolver.ts:11-24 documents
this and MUST be updated (D-64-01 supersedes D-05; preserve the accurate
"Type.Union takes NO `discriminator` option" sentence).

```typescript
// CURRENT (resolver.ts:58-106)
const ResolvedPluginInstallableSchema = Type.Object({
  installable: Type.Literal(true),     // → state: Type.Literal("installable")
  name: Type.String(),
  pluginRoot: Type.String(),           // ONLY on installable variant (NFR-7)
  supported: Type.Array(Type.String()),
  unsupported: Type.Array(Type.String()),
  notes: Type.Array(Type.String()),
  componentPaths: ComponentPathsSchema,
  mcpServers: McpServersFieldSchema,
  hooksConfigPath: Type.Optional(Type.String()),
  orphanRewake: Type.Optional(Type.Boolean()),
});
const ResolvedPluginNotInstallableSchema = Type.Object({ /* same minus pluginRoot */ });

/** Literal-tagged variants ARE the discriminator. NO options arg. */
export const ResolvedPluginSchema = Type.Union([
  ResolvedPluginInstallableSchema,
  ResolvedPluginNotInstallableSchema,
]);
```

**Target shape** (per 64-RESEARCH Pattern 1 field-set table):
- `ResolvedPluginInstallableSchema` → swap `installable: Type.Literal(true)` for `state: Type.Literal("installable")`. All other fields unchanged.
- `ResolvedPluginUnsupportedSchema` → **clone of installable** with `state: Type.Literal("unsupported")`, KEEPING `pluginRoot` + `supported` + `unsupported` + `notes` + `componentPaths` + `mcpServers` + `hooksConfigPath?` + `orphanRewake?` (D-64-06 lists are a floor; A1 recommends the full payload so Phase 65 force-install and info's unsupported-row enumeration have the fields they read).
- `ResolvedPluginUnavailableSchema` → **minimal**: `state: Type.Literal("unavailable")`, `name`, `notes` only (D-64-05). NO `pluginRoot` (NFR-7), NO `supported`/`unsupported`/`componentPaths`/`mcpServers`/`hooksConfigPath`/`orphanRewake`.
- `ResolvedPluginSchema` → `Type.Union([Installable, Unsupported, Unavailable])`, still NO `discriminator` option.
- Export `ResolvedPluginUnsupported` / `ResolvedPluginUnavailable` `Type.Static` types beside the existing two; update `domain/index.ts:29-40` re-exports (Pattern E).

### Pattern B — Factory helpers (split `installable()` / `notInstallable()` into three)

**Source:** `domain/resolver.ts:244-279`

```typescript
// notInstallable() (resolver.ts:244-260) — carries the full partial payload
function notInstallable(name, partial, additionalNotes = []): ResolvedPluginNotInstallable {
  return {
    installable: false, name,
    supported: partial.supported, unsupported: partial.unsupported,
    notes: [...partial.notes, ...additionalNotes],
    componentPaths: partial.componentPaths, mcpServers: partial.mcpServers,
    ...(partial.hooksConfigPath !== undefined && { hooksConfigPath: partial.hooksConfigPath }),
    ...(partial.orphanRewake !== undefined && { orphanRewake: partial.orphanRewake }),
  };
}
// installable() (resolver.ts:262-279) — same plus pluginRoot, minus additionalNotes
```

**Target** (Claude's Discretion on exact names per D-64-01 discretion note):
- `installable(name, pluginRoot, partial)` → set `state: "installable"` instead of `installable: true`. Otherwise identical.
- `unsupported(name, pluginRoot, partial)` → clone of `installable()` with `state: "unsupported"` (carries `pluginRoot` + full payload, D-64-06/A1).
- `unavailable(name, notes)` → minimal: `{ state: "unavailable", name, notes }`. Does NOT spread `partial.componentPaths`/`mcpServers`/`pluginRoot` (D-64-05). Replaces the structural-defect uses of `notInstallable()`.

### Pattern C — Two-accumulator decision with structural precedence (RSTATE-02 / D-64-07)

**Source:** `domain/resolver.ts:912/949` (strict), `966/995` (loose) — single `dirty` boolean.

```typescript
// CURRENT (resolveStrict:912-949; resolveLoose mirrors at 966-995)
let dirty = false;
for (const kind of SUPPORTED_COMPONENT_PATH_KINDS) {
  dirty = (await collectStrictComponentKind(...)) || dirty;   // STRUCTURAL
}
dirty = (await applyStrictMcp(...)) || dirty;                 // STRUCTURAL
dirty = (await applyHooksConfig(ctx, pluginRoot, partial)) || dirty; // STRUCTURAL (D-64-07)
dirty = (await addUnsupportedKindNotes(...)) || dirty;        // UNSUPPORTED ← only this one
...
return dirty ? notInstallable(entry.name, partial) : installable(entry.name, pluginRoot, partial);
```

`addUnsupportedKindNotes` (resolver.ts:880-895) is the SOLE unsupported-signal
contributor — it pushes `contains <kind>` to `partial.notes` and the kind to
`partial.unsupported`. Lower-churn migration (64-RESEARCH option b): keep `dirty`
as the structural accumulator, **drop `addUnsupportedKindNotes` out of the
`dirty` chain** (call it for its side effect on `partial.unsupported`), then:

```typescript
// TARGET (replaces line 949 / 995) — structural wins (D-64-07)
await addUnsupportedKindNotes(entry, manifest, pluginRoot, ctx, partial); // side effect only
if (dirty) return unavailable(entry.name, partial.notes);                 // structural precedence
if (partial.unsupported.length > 0) return unsupported(entry.name, pluginRoot, partial);
return installable(entry.name, pluginRoot, partial);
```

**`preflightStages` short-circuits** (resolver.ts:415-471 → `resolveStrict:907`,
`resolveLoose:961`) currently return `pre.result` built via `notInstallable()`.
Those are ALL structural (bad source kind, escape, dir missing, malformed
plugin.json) → must return `unavailable()`. **Anti-pattern (Pitfall 2):** never
order the `unsupported.length` check before the structural check, and never
derive the arm from `notes` string prefixes — the authoritative signal is which
helper fired.

### Pattern D — Narrowing gates (D-64-04 / RSTATE-04)

**Source:** `domain/resolver.ts:1007-1020`

```typescript
export function requireInstallable(
  r: ResolvedPlugin, op: "install" | "update" = "install",
): asserts r is ResolvedPluginInstallable {
  if (r.installable) { return; }                  // → if (r.state === "installable")
  throw new PluginShapeError({
    kind: op === "update" ? "no-longer-installable" : "not-installable",
    plugin: r.name, reasons: r.notes,
  });
}
```

- `requireInstallable` → change the guard to `if (r.state === "installable")`. Throw shape unchanged; `r.notes` exists on all three arms so `reasons: r.notes` still compiles. Preserves `not-installable` / `no-longer-installable` kinds.
- `requireForceInstallable` (NEW, clone) → asserts `r is ResolvedPluginInstallable | ResolvedPluginUnsupported`; guard `if (r.state === "installable" || r.state === "unsupported") return;`; same throw on `unavailable`. **Zero production call sites this phase** (Phase 65 wires `--force`). Export it from `domain/index.ts` and cover by tests only so lint does not flag dead code (Pitfall 4).

### Pattern E — Barrel re-export

**Source:** `domain/index.ts:29-40`

```typescript
export type {
  ResolvedPlugin, ResolvedPluginInstallable, ResolvedPluginNotInstallable, ResolveContext,
} from "./resolver.ts";
export { ResolvedPluginSchema, resolveStrict, resolveLoose, requireInstallable } from "./resolver.ts";
```

**Target:** add `ResolvedPluginUnsupported` / `ResolvedPluginUnavailable` to the
type block (decide whether to keep `ResolvedPluginNotInstallable` exported — it
no longer corresponds to a union arm; the three-way arms replace it), and add
`requireForceInstallable` to the value block.

## Pattern Assignments (per consumer)

### `orchestrators/plugin/list.ts` (orchestrator, request-response)

**Site:** list.ts:350. Current `if (resolved.installable)` → `(available)` row,
else `(unavailable)` row via `sharedNarrowResolverNotes(resolved.notes)`.

```typescript
const resolved = await resolveStrict(manifestEntry, { marketplaceRoot });
if (resolved.installable) {
  return { status: "available", name: manifestEntry.name, ... };
}
return { status: "unavailable", name: manifestEntry.name,
  reasons: sharedNarrowResolverNotes(resolved.notes), ... };
```

**Migrate to** `switch (resolved.state)` (or `if (resolved.state === "installable")`):
`installable` → `available` row; `unsupported` AND `unavailable` → `unavailable`
row this phase (both still render `(unavailable)`; Phase 66 introduces distinct
glyphs/states). The `reasons:` derivation moves to the shared render helper
(D-64-02) — see Pattern F below.

### `orchestrators/plugin/info.ts` (orchestrator, request-response)

**Sites:** info.ts:720 (installed-row path) and info.ts:801 (not-installed-row).

Both branch on `if (resolved.installable)` / `if (!resolved.installable)` and
the not-installable branch calls `buildNotInstallablePathRowFields(resolved, …)`
(info.ts:736, 816), which reads `componentPaths` / `mcpServers` /
`hooksConfigPath` off the resolved value.

**Migrate to** `switch (resolved.state)`:
- `installable` → unchanged installed/available row using `resolved.pluginRoot`.
- `unsupported` → reuse `buildNotInstallablePathRowFields` (the arm HAS those fields per Pattern A) — works as-is.
- `unavailable` → the MINIMAL arm lacks those fields; render `componentsResolved: false` with structural reasons (Open Question #1 recommendation), OR rely on info.ts's existing independent disk re-derivation (`derivePluginRootForInfo`, quick task `260618-qkz`) which does not read the `unavailable` arm. Per D-64-05 discretion note, info.ts re-resolves independently and must NOT read the minimal arm's stripped fields.

### `orchestrators/edge-deps.ts` (orchestrator, completion cache)

**Site:** edge-deps.ts:152 `installable = resolved.installable;`

```typescript
let installable = false;
try {
  const resolved = await resolveStrict(entry, { marketplaceRoot: mp.marketplaceRoot });
  installable = resolved.installable;     // → resolved.state === "installable"
} catch { installable = false; }
const row: PluginIndexRow = { name: entry.name,
  status: installable ? "available" : "unavailable", ... };
```

**Migrate to** `installable = resolved.state === "installable";`. Both
`unsupported` and `unavailable` map to the `unavailable` completion bucket this
phase (boolean local is fine — the cache row has no diagnostic notes).

### `shared/probe-classifiers.ts` (utility — D-64-02 shared render helper)

**Source:** `narrowResolverNotes` (probe-classifiers.ts:87-123) maps free-form
`notes` strings to the closed REASON set (`unsupported hooks` | `lsp` |
`unsupported source`) with first-wins dedup (WR-01).

```typescript
const isHooksNote =
  note.startsWith("hooks.json is not valid JSON:") ||
  note.startsWith("hooks.json failed schema validation:") ||
  note.startsWith("unsupported hooks:") ||
  note.startsWith("malformed hooks.json:");
if (isHooksNote) { /* push "unsupported hooks" once */ continue; }
if (note.includes("lspServers")) { /* push "lsp" once */ continue; }
/* else push "unsupported source" once */
```

**D-64-02 shared helper:** add ONE render-time helper here that maps the
`unsupported: string[]` kind list (e.g. `"lspServers"` → `lsp`) to the closed
REASON set, consumed by BOTH `list` and `info` (and ideally collapsing the
third duplicate at `install.ts:1693-1707`, Pattern F). **Caveat (A2 / Open
Question #2):** the `unsupported hooks` marker is NOT a per-kind marker under
the new model — a malformed-hooks parse failure is STRUCTURAL (D-64-07) and
routes to `unavailable`, so its reason stays in `notes`/structural-reason path,
not the per-kind-from-`unsupported[]` path. Per-kind markers (`lsp`, future
kinds) come from `unsupported[]` on the `unsupported` arm; the hooks-structural
reason stays in `notes` on `unavailable`. Flag to confirm against the byte
contract in `docs/output-catalog.md` before locking the marker family scope.

### Pattern F — Third marker duplicate (cross-surface parity)

**Source:** `install.ts:1693-1707` — a verbatim copy of the hooks-prefix set,
pinned to `narrowResolverNotes` by
`tests/orchestrators/plugin/cross-surface-reason-parity.test.ts` (SURF-01). If
D-64-02's shared helper is introduced, this third copy should collapse into it;
the parity test is the safety net.

## Test Patterns

### `tests/domain/resolver.types.test.ts` (NFR-7 compile assertion — rewrite)

**Source:** full file (73 lines). The load-bearing assertion is the
`@ts-expect-error` on a `pluginRoot` read off the non-installable variant.

```typescript
declare const r: ResolvedPlugin;
function narrowOnDiscriminator(): string | undefined {
  if (r.installable) { return r.pluginRoot; }   // → if (r.state === "installable" || r.state === "unsupported")
  return undefined;
}
function narrowOnDiscriminatorNegative(): void {
  if (!r.installable) {
    // @ts-expect-error -- NFR-7: not-installable variant; pluginRoot inaccessible.
    void r.pluginRoot;
  }
}
```

**Rewrite for three arms** (64-RESEARCH Code Examples + Pitfall 3): positive
`pluginRoot` reads after narrowing to `installable` OR `unsupported`; negative
`@ts-expect-error` on `unavailable.pluginRoot`; add a type assertion that
`requireForceInstallable` cannot admit `unavailable` (RSTATE-04). Beware
"Unused @ts-expect-error directive" — every directive must still fire after the
rename, else `npm run typecheck` fails.

### `tests/domain/resolver-strict.test.ts` + `resolver-loose.test.ts` (unit)

**Source:** existing `requireInstallable` block (resolver-strict.test.ts:590-624)
and the `assert.equal(r.installable, …)` / `if (r.installable)` assertions.

```typescript
test("PR-6 requireInstallable on installable narrows to installable variant", async () => {
  const r: ResolvedPlugin = await resolveStrict(basicEntry({ source: "./local" }), ctx);
  requireInstallable(r);
  assert.equal(typeof r.pluginRoot, "string");
});
```

**Migrate per the 64-RESEARCH test-assertion map (lines 378-398):**
- Every `assert.equal(r.installable, true)` → `assert.equal(r.state, "installable")`; every `if (r.installable)` guard → `if (r.state === "installable")`.
- Every `assert.equal(r.installable, false)` splits by cause: structural fixtures (source-kind, path escape, dir missing, malformed plugin.json, hooks parse-fail, malformed mcp, component-path failures, manifest/mcp conflict) → `assert.equal(r.state, "unavailable")`; unsupported-kind fixtures (PR-4 default locations, PR-3 experimental themes/monitors, multiple unsupported components, entry unsupported component) → `assert.equal(r.state, "unsupported")`.
- ADD (Wave 0 gaps): RSTATE-02 precedence fixture (malformed manifest + unsupported kind → `unavailable`); `requireForceInstallable` tests (admits `installable` + `unsupported`, throws on `unavailable`) in both strict and loose files.

Test titles keep `PR-6` / `MM-5` / `PR-3` / `PR-4` / `D-57-04` anchors and add
`RSTATE-02` / `RSTATE-04`. NO `Phase 64` in any title.

## No Analog Found

None. Every modified file's pattern source is itself or a direct sibling — this
is a compiler-driven refactor, not a greenfield build. `requireForceInstallable`
and the `unavailable` arm have no production consumer yet, but their *shape*
analogs (`requireInstallable`, the `notInstallable` arm) exist in-file.

## Metadata

**Analog search scope:** `extensions/pi-claude-marketplace/domain/`,
`extensions/pi-claude-marketplace/orchestrators/plugin/`,
`extensions/pi-claude-marketplace/shared/`, `tests/domain/`.
**Files scanned:** resolver.ts, domain/index.ts, list.ts, info.ts, edge-deps.ts,
probe-classifiers.ts, install.ts, resolver.types.test.ts, resolver-strict.test.ts.
**Out-of-scope (DO NOT migrate — persisted `compatibility.installable` boolean):**
`reconcile/plan.ts:270`, `enable-disable.ts:184`, `update.ts:968`,
`reinstall.ts:1747`, `persistence/state-io.ts:58`, `persistence/migrate-config.ts`,
`persistence/migrate.ts`. These read/write the `state.json` boolean, a distinct
schema from the resolver union.
**Pattern extraction date:** 2026-06-27
</content>
</invoke>
