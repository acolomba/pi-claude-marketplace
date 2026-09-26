# Phase 101: Workflow component-kind recognition - Research

**Researched:** 2026-08-14
**Domain:** In-repo resolver extension — closed-set component-kind admission in a TypeScript/TypeBox layered extension
**Confidence:** HIGH (every claim below was read from the live source this session; three claims were executed against the running resolver)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Resolver admission shape**

- `workflows` joins **both** `SUPPORTED_COMPONENT_KINDS` (the public closed set)
  and `SUPPORTED_COMPONENT_PATH_KINDS` (the private path-bearing subset). The
  Claude manifest field is path-bearing (`string | array`, "Custom workflow
  script files or directories, replaces default `workflows/`") and the
  convention directory name equals the kind name, so `collectStrictComponentKind`
  already implements the required both-axes shape -- declared-in-manifest OR
  convention-on-disk -- with no new code.
- Both resolution modes admit it through the shared tuple. `resolveLoose`
  iterates the same `SUPPORTED_COMPONENT_PATH_KINDS`, so entry-declared
  workflows resolve and a manifest-only declaration produces the existing
  `component declarations conflict` note. No mode-specific split of the tuple.
- Both tuples get `workflows` **appended last**:
  `["skills", "commands", "agents", "hooks", "workflows"]` and
  `["skills", "commands", "agents", "workflows"]`. Order is a locked contract;
  appending is the minimal reviewable delta.
- `componentPaths.workflows` is **required, not optional** --
  `Type.Array(Type.String())` on `ComponentPathsSchema`, and `workflows: []` in
  `emptyResolution()`, matching the other three members. A missing-vs-empty
  distinction buys nothing and would force `?? []` at every consumer.

**Discovery and validation semantics**

- A declared path that does not exist on disk is **accepted into
  `componentPaths.workflows` with no note** -- identical to skills, commands and
  agents. `validateComponentPath` is shape-only (relative + containment); it
  never stats. WFLW-02 asks for exactly this treatment.
- A manifest field naming a **file** and one naming a **directory** are both
  accepted verbatim, because validation is shape-only and no branch is needed.
  The convention probe stays `statKind === "dir"` on `<pluginRoot>/workflows`.
- An **empty** `workflows/` directory still puts `workflows` into `supported[]`.
  The directory existing is the signal, exactly as for an empty `skills/`.
  Emptiness surfaces downstream as zero enumerated names.
- This phase emits **no** workflows-specific note or reason token. No
  degradation reason, no soft-dependency marker, no `contains workflows` note.
  Those belong with the `workflow_control` probe (WDEP, Phase 105); adding a
  placeholder now would fight the closed `REASONS` set twice.

**Surface signal and closed-set gates**

- The `info` `workflows:` line **lands in this phase**, because SC 3 names both
  `list` and `info`. That means: add `workflows?: readonly string[]` to
  `PluginInfoComponentsResolved.components`, grow `COMPONENT_KINDS` in
  `shared/notify.ts` from a 5-tuple to a 6-tuple, and widen
  `discoverComponentNames`'s `kind` union to accept `"workflows"` with `.js`
  entries.
- The line shows the **file stem** in this phase. Phase 102 swaps the name
  source to the extracted `meta.name`. This phase owns the plumbing; Phase 102
  owns the name. The intermediate stem-named state never reaches a user because
  both phases land in the same milestone.
- The pinned closed-set test at `tests/architecture/hooks-foundation.test.ts:199`
  is **updated in place** to the 5-tuple, dropping "4-tuple" from its title and
  keeping its locked-shape-and-order rationale. No second parallel pin.
- New tests **extend existing files**: `tests/domain/resolver-strict.test.ts` and
  `tests/domain/resolver-loose.test.ts` for behavior,
  `tests/architecture/hooks-foundation.test.ts` for the closed-set pin, and
  `docs/output-catalog.md` plus its byte-equality gate for the new `info` line.
  No new test file.

### Claude's Discretion

- The exact wording of updated comments and test titles, subject to
  `.claude/rules/typescript-comments.md` (decision and requirement IDs are
  traceability anchors and stay; planning-artifact references are forbidden).
- Whether `discoverComponentNames`'s `.js` handling reuses `nameFromEntry` with
  a new kind arm or takes a small dedicated branch, provided the sorted,
  deduped, `readonly string[]` contract is unchanged.
- Fixture placement and naming for the new resolver test cases.

### Deferred Ideas (OUT OF SCOPE)

- Extracting the command name from the script's exported `meta` with an acorn AST
  walk, and swapping the `info` line's name source from file stem to `meta.name`
  -- Phase 102.
- The engine-preprocessor pre-validation that admits or refuses each script --
  Phase 102.
- Writing any artifact, the `bridges/workflows/` triplet, the NFR-10 containment
  root amendment, and the 6th install-ledger phase -- Phase 103.
- The `workflow_control` soft-dependency probe, the third `DEPENDENCIES` member,
  and the new degradation reason token -- Phase 105.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| WFLW-01 | A plugin shipping `<pluginRoot>/workflows/` has its workflow scripts recognized as installable components even when its manifest declares no `workflows` field. | `collectStrictComponentKind` already probes `statKind(path.join(pluginRoot, kind)) === "dir"` and pushes the kind into `partial.supported` — see Code Example 1. Tuple membership alone delivers this; no new discovery code. `[VERIFIED: extensions/pi-claude-marketplace/domain/resolver.ts:882-908]` |
| WFLW-02 | A plugin declaring the `workflows` manifest field (`string \| array`) resolves those declared paths as workflow components, with a non-existent declared path treated as the existing per-kind validation treats it. | `readPathOrArray` normalizes both forms; `validateComponentPath` is shape-only (nested-array reject, non-string reject, absolute reject, `assertPathInside`) and never stats. Both are `SupportedPathKind`-typed and widen automatically. `[VERIFIED: extensions/pi-claude-marketplace/domain/resolver.ts:778-848]` |
| WFLW-03 | A workflow-bearing plugin never installs with zero signal. | Verified by execution: a plugin with `<pluginRoot>/workflows/` and nothing else resolves today as `state: "installable"`, `supported: []`, `unsupported: []`, `notes: []`. Joining `SUPPORTED_COMPONENT_KINDS` closes this by construction. `[VERIFIED: live resolveStrict execution, this session]` |
| WFLW-04 | The resolver exposes a `componentPaths.workflows` member. | `ComponentPathsSchema` gains a fourth `Type.Array(Type.String())`; `PartialResolution` and `emptyResolution()` follow. Every consumer is enumerated in the Change Map. `[VERIFIED: extensions/pi-claude-marketplace/domain/resolver.ts:62-66, 382, 410]` |
</phase_requirements>

## Summary

This is an **in-repo closed-set widening**, not a technology-selection phase. No new
package is installed, no external API is called, and no algorithm is invented. The
entire delivery is: append one string to two tuples, add one required member to one
TypeBox schema and its two mirrors, follow the compile errors that produces to
twenty-two object literals, and add one arm to the `info` renderer's kind vocabulary.
The resolver machinery WFLW-01 and WFLW-02 need — declared-in-manifest OR
convention-on-disk union with first-wins dedup, shape-only path validation, and the
`partial.supported.push(kind)` admission — already exists and is `SupportedPathKind`-typed,
so it widens automatically with the tuple. `[VERIFIED: extensions/pi-claude-marketplace/domain/resolver.ts:882-908]`

Three findings change the shape of the plan. **First**, making `componentPaths.workflows`
required (a locked decision, and the right one) turns twenty-two object-literal
construction sites into typecheck errors — six in `extensions/`, sixteen in `tests/`.
This is the loud, good failure mode; the Change Map below enumerates every one so none
is discovered by trial. **Second**, the two consequences of moving the supported-kind
boundary are narrower than feared but real, and both are one-time self-healing paths
with an exact precedent (HOOK-01 admitted `hooks` the same way): the reconcile backfill
scan only touches records with `compatibility.installable === false`, so a cleanly-installed
workflows-bearing plugin is never rescanned, and `update` on a **disabled** record will
newly detect a changed compatibility pin and write one refresh row. **Third**, the
`list` half of Success Criterion 3 cannot be met as rendered bytes in this phase:
`list` renders no per-kind component enumeration at all and derives every row token from
`unsupported`, never `supported`. That is a wording gap in the SC, not a defect in the
locked decisions — see Open Question 1.

The closed-set architecture gates are all safe. COMPAT-01 pins `REASONS`,
`STATUS_TOKENS`, `PLUGIN_STATUSES`, `MARKETPLACE_STATUSES`, seven glyphs, the persisted
install-record key set, and the state-schema version union — and enumerates **no**
component kinds. Admitting a supported kind trips none of them, precisely because the
locked decisions add no reason token, no status, no glyph, and no persisted field.
`compatibility.supported` is `Type.Array(Type.String())` with no enum, so there is no
schema migration. `[VERIFIED: tests/architecture/compat-01-no-expansion.test.ts:126-427; extensions/pi-claude-marketplace/persistence/state-io.ts:113-118]`

**Primary recommendation:** Treat the phase as one mechanical widening driven by the
compiler. Land the two tuples, the schema, and the three resolver mirrors first; run
`npm run typecheck` to enumerate the twenty-two literals; fix them; then land the `info`
renderer arm and the two closed-set/catalog gate updates. Write the convention-only
resolver test **first** — it is the case 16 of 16 sampled real plugins ship and the only
one a field-only implementation would miss.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Admitting `workflows` as a supported kind | `domain/` (`resolver.ts`) | — | The resolver is the sole authority on what a plugin "contains"; the tuples are its exported closed-set contract. It is a pure, network-free, disk-read-only layer with no upward dependency. |
| Discovering `<pluginRoot>/workflows` by convention | `domain/` (`resolver.ts`, via the injected `statKind` seam) | — | The convention probe is already inside `collectStrictComponentKind`; keeping it there preserves the injectable-`ResolveContext` test seam and the "domain never touches the platform" boundary. |
| Validating declared `workflows` paths | `domain/` (`validateComponentPath` → `shared/path-safety.ts`) | `shared/` | Path containment is the NFR-10 chokepoint; the resolver must not re-derive it. |
| Exposing `componentPaths.workflows` to consumers | `domain/` (TypeBox `ComponentPathsSchema`) | — | The schema is the type-level contract every bridge and orchestrator reads through `MaterializablePlugin`. |
| Enumerating workflow **names** for `info` | `orchestrators/plugin/info.ts` | — | Per-kind name enumeration is an orchestrator concern (it does disk I/O the resolver deliberately does not); the resolver supplies paths only. |
| Rendering the `workflows:` line | `shared/notify.ts` | — | IL-2: `notify.ts` is the single sanctioned output surface and the sole owner of the `COMPONENT_KINDS` ordering. |
| Persisting the grown supported set | `persistence/state-io.ts` (no change) | — | `compatibility.supported` is an untyped `string[]`; the new member rides through with no schema edit. |
| Writing any workflow artifact | **NONE — Phase 103** | — | This phase touches no bridge. Confirmed against `bridges/`: no `workflows` directory exists and none is created here. |

## Standard Stack

No package is added, removed, or upgraded in this phase.

### Core (existing, unchanged)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `typebox` | `^1.1.38` | `ComponentPathsSchema` gains its fourth member; `Type.Static<>` propagates the required field to every consumer | Already the project's sole runtime schema + discriminated-union modeller `[VERIFIED: package.json]` |
| `node:test` | Node 22.22.2 built-in | Every new and amended test | Project's only test runner; no framework config file exists `[VERIFIED: package.json scripts.test]` |
| `typescript` | `^6.0.3` (strict, `exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`) | The mechanism that surfaces the twenty-two literals | `tsc --noEmit`; there is no build step `[VERIFIED: .planning/codebase/STACK.md, package.json]` |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Required `componentPaths.workflows` | `Type.Optional(Type.Array(...))` | Would avoid the twenty-two typecheck errors, but forces `?? []` at every consumer and makes "no workflows declared" indistinguishable from "this record predates the key". **Locked against** in CONTEXT.md, and correctly: the loud compile failure is the feature. |
| A dedicated `workflows` discovery function | Reuse `collectStrictComponentKind` | No tradeoff — reuse is strictly better and is what the locked decision selects. A dedicated function would duplicate the union/dedup/`supported.push` logic and drift. |
| Adding `workflows` to `PLUGIN_ENTRY_SCHEMA` | Leaving it out | Verified by execution that both `PLUGIN_ENTRY_VALIDATOR` and `PLUGIN_MANIFEST_VALIDATOR` already accept an undeclared `workflows` field (string and array forms) — the TypeBox objects are open. Adding it is documentation, not function. See Open Question 2. |

**Installation:** none.

**Version verification:** not applicable — no package is installed. The `acorn` runtime
dependency the milestone needs is **Phase 102's** WDOC-03, explicitly deferred.

## Package Legitimacy Audit

**Not applicable to this phase.** Phase 101 installs no external packages. Every symbol
it touches is in-repo or an already-declared dependency (`typebox`), and every one was
read from the working tree this session.

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

The milestone's one new runtime dependency, `acorn`, belongs to Phase 102 (WDOC-03) and
must be legitimacy-audited **there**, not here.

## Architecture Patterns

### System Architecture Diagram

```text
  marketplace.json entry            <pluginRoot>/ on disk
  (workflows?: string|array)        (workflows/ convention dir)
            │                                  │
            └──────────────┬───────────────────┘
                           ▼
        ┌──────────────────────────────────────────────┐
        │  domain/resolver.ts                          │
        │                                              │
        │  for (kind of SUPPORTED_COMPONENT_PATH_KINDS)│  ← tuple gains "workflows"
        │      collectStrictComponentKind(...)         │
        │        ├─ readPathOrArray(entry[kind])       │
        │        ├─ readPathOrArray(manifest[kind])    │
        │        ├─ validateComponentPath (shape only) │  ← never stats
        │        ├─ statKind(pluginRoot/kind)=="dir"?  │  ← the convention axis
        │        └─ if paths.length>0                  │
        │             partial.supported.push(kind)     │
        │                                              │
        │  decideResolution(structuralDirty, unsupported)│
        └───────────────┬──────────────────────────────┘
                        │  ResolvedPlugin (discriminated)
        ┌───────────────┼───────────────────────────┬──────────────────┐
        ▼               ▼                           ▼                  ▼
  componentPaths   supported[]                 (installable)      (unavailable)
  .workflows                                                       no componentPaths
        │               │                                                │
        │               ├──► install.ts / update.ts / reinstall.ts       │
        │               │      compatibility.supported → state.json      │
        │               │           │                                    │
        │               │           ├──► reconcile/apply.ts              │
        │               │           │      supportedSetGrew()  ⚠ gated   │
        │               │           │      on installable===false        │
        │               │           └──► update.ts                       │
        │               │                  disabledPinProjection ⚠       │
        │               │                                                │
        ▼               ▼                                                ▼
  orchestrators/plugin/info.ts                              deriveLenientComponentPaths
    composeResolvedComponents                                (re-seeds conventions)
      └─ discoverComponentNames(paths, "workflows")  ← .js stem
                        │
                        ▼
              shared/notify.ts
                COMPONENT_KINDS 5-tuple → 6-tuple
                appendResolvedComponentLines
                        │
                        ▼
              "    workflows: a, b"
```

The two `⚠` markers are the boundary-move consequences documented under Common Pitfalls
2 and 3. Neither is on the primary path; both fire once, on the first `/reload` or
`update` after the extension version moves.

### Recommended Project Structure

No new files. The phase edits three production files and eleven test/doc files:

```text
extensions/pi-claude-marketplace/
├── domain/resolver.ts          # tuples, schema, PartialResolution, emptyResolution
├── shared/notify.ts            # PluginInfoComponentsResolved, COMPONENT_KINDS
└── orchestrators/plugin/info.ts # nameFromEntry, discoverComponentNames,
                                 # composeResolvedComponents, deriveLenientComponentPaths
```

### Pattern 1: Closed-set widening driven by a length-exact tuple

**What:** `COMPONENT_KINDS` in `notify.ts` is a length-exact tuple whose element type is
derived from `keyof PluginInfoComponentsResolved["components"]`. Adding a key to the
interface without growing the tuple is a **deliberate** typecheck failure.

**When to use:** whenever a rendered vocabulary grows. It is the mechanism that makes it
impossible for the renderer to silently omit the new kind.

**Example (verbatim, `extensions/pi-claude-marketplace/shared/notify.ts:3300-3314`):**

```typescript
// Derive the tuple's element type from the interface so the two
// declarations cannot drift. The tuple is sized exactly (5 entries):
// adding a 6th key to `PluginInfoComponentsResolved.components` without
// extending this tuple breaks the typecheck here -- TS rejects the
// literal because `ComponentKind` would no longer cover every keyof
// the interface. Without the explicit tuple length, the renderer
// would silently omit the new kind from output.
type ComponentKind = keyof PluginInfoComponentsResolved["components"];
const COMPONENT_KINDS: readonly [
  ComponentKind,
  ComponentKind,
  ComponentKind,
  ComponentKind,
  ComponentKind,
] = ["agents", "commands", "hooks", "mcp", "skills"];
```

**Ordering constraint, answered:** the tuple is alphabetical by kind name — `agents`,
`commands`, `hooks`, `mcp`, `skills`. `workflows` sorts **after** `skills`, so it is
appended **last**, and the tuple grows to six `ComponentKind` slots. This is the same
"appended last" answer the locked decision gives for the two resolver tuples, but for a
different reason: there it is minimal-delta, here it is alphabetical order the renderer
contract already states.

### Pattern 2: Both-axes admission (declared OR convention), already implemented

**What:** one loop unions entry-declared + manifest-declared + convention-on-disk paths
with first-wins dedup, then admits the kind iff any path landed.

**When to use:** it is the shape WFLW-01 + WFLW-02 require together. Do not reimplement.

**Example (verbatim, `extensions/pi-claude-marketplace/domain/resolver.ts:882-908`):**

```typescript
async function collectStrictComponentKind(
  entry: PluginEntry,
  manifest: Record<string, unknown> | null,
  partial: PartialResolution,
  pluginRoot: string,
  ctx: ResolveContext,
  kind: SupportedPathKind,
): Promise<boolean> {
  let dirty = false;
  const seenPaths = new Set<string>();
  const fromEntry = readPathOrArray((entry as Record<string, unknown>)[kind]);
  const fromManifest = readPathOrArray(manifest?.[kind]);

  for (const raw of [...fromEntry, ...fromManifest]) {
    dirty = (await addValidatedComponentPath(partial, kind, seenPaths, raw, pluginRoot)) || dirty;
  }

  if ((await statKindOf(ctx)(path.join(pluginRoot, kind))) === "dir") {
    addComponentPath(partial, kind, seenPaths, kind);
  }

  if (partial.componentPaths[kind].length > 0) {
    partial.supported.push(kind);
  }

  return dirty;
}
```

**Body change required: none.** `kind` is `SupportedPathKind`, which is
`(typeof SUPPORTED_COMPONENT_PATH_KINDS)[number]` — it widens with the tuple. The
convention probe is `path.join(pluginRoot, kind)`, and the convention directory name
equals the kind name (`workflows`), so it resolves `<pluginRoot>/workflows` with no
special case. Confirmed by reading the function; the CONTEXT claim holds.

### Pattern 3: Loose mode is entry-only through the same tuple

`resolveLoose` iterates the identical `SUPPORTED_COMPONENT_PATH_KINDS` and calls
`collectLooseComponentKind`, which reads the entry field only and emits
`component declarations conflict: manifest declares "<kind>" but entry does not` when the
manifest declares it and the entry does not. No convention probing.
`[VERIFIED: extensions/pi-claude-marketplace/domain/resolver.ts:1251-1283, 1445-1448]`

So a manifest-only `workflows` declaration in loose mode produces:
`component declarations conflict: manifest declares "workflows" but entry does not`,
and `dirty = true` → `unavailable`. That is the existing, correct behavior the locked
decision names; it needs a test, not code.

### Anti-Patterns to Avoid

- **Adding a `workflows` arm to `UNSUPPORTED_COMPONENT_KINDS` or `UNSUPPORTED_COMPONENT_CONVENTIONS`.** WFLW-03 is closed by joining the *supported* list. A member in both lists would produce `contains workflows` notes and demote every workflow plugin to `partially-available` — the opposite of the goal.
- **Reaching for `bridges/agents/` as a model.** There is no index to mutate and this phase touches no bridge at all. Stated in CONTEXT.md Specific Ideas; confirmed — no `bridges/workflows/` exists.
- **Letting `nameFromEntry` fall through to the `.md` branch for `workflows`.** See Pitfall 1. This produces a silent zero, which is the exact zero-signal failure the phase exists to remove.
- **Adding a reason token, status token, or glyph.** Every one of those trips COMPAT-01, and none is needed. Phase 105 owns the degradation token.
- **Bumping `schemaVersion` or touching `persistence/migrate.ts`.** No migration is required (see Runtime State Inventory); a third schema version would fail `tests/architecture/compat-01-no-expansion.test.ts:413`.

## Change Map (exhaustive edit sites)

This is the section the planner most needs. Every site was located by grep and confirmed
by reading the file. A site marked **compile-forced** will produce a `tsc --noEmit` error
the moment `componentPaths.workflows` becomes required.

### A. Production — `extensions/pi-claude-marketplace/domain/resolver.ts`

| # | Line | Symbol | Change |
|---|------|--------|--------|
| A1 | 62-66 | `ComponentPathsSchema` | add `workflows: Type.Array(Type.String()),` as the fourth member |
| A2 | 325 | `SUPPORTED_COMPONENT_KINDS` | `["skills", "commands", "agents", "hooks"]` → append `"workflows"` |
| A3 | 336 | `SUPPORTED_COMPONENT_PATH_KINDS` | `["skills", "commands", "agents"]` → append `"workflows"` |
| A4 | 382 | `PartialResolution.componentPaths` | `{ skills: string[]; commands: string[]; agents: string[] }` → add `workflows: string[]` |
| A5 | 410 | `emptyResolution()` | `{ skills: [], commands: [], agents: [] }` → add `workflows: []` |
| A6 | 24-30, 317-337, 1366-1369, 1444 | doc comments | the HOOK-01 rationale comments state which tuple carries which kinds and why; they must name `workflows` in the path-bearing subset. Subject to `.claude/rules/typescript-comments.md`. |

`collectStrictComponentKind` (882), `collectLooseComponentKind` (1251),
`validateComponentPath` (804), `addComponentPath` (850), `addValidatedComponentPath` (864),
`readPathOrArray` (778), `materializableFields` (431) — **no body change**. All are
`SupportedPathKind`-typed or index through `partial.componentPaths[kind]`.
`[VERIFIED: extensions/pi-claude-marketplace/domain/resolver.ts:778-908, 1251-1283]`

### B. Production — `extensions/pi-claude-marketplace/shared/notify.ts`

| # | Line | Symbol | Change |
|---|------|--------|--------|
| B1 | 1390-1400 | `PluginInfoComponentsResolved.components` | add `readonly workflows?: readonly string[];` |
| B2 | 3308-3314 | `COMPONENT_KINDS` | 5 `ComponentKind` slots → 6; value `["agents", "commands", "hooks", "mcp", "skills", "workflows"]` (alphabetical, appended last) |
| B3 | 3300-3307 | tuple doc comment | "sized exactly (5 entries) … adding a 6th key" → 6 / 7th |
| B4 | 1379-1389, 3316-3327 | doc comments | both state the render order as `agents, commands, mcp, skills` (already stale — omits `hooks`); update to the six-kind order |

`appendResolvedComponentLines` (3328-3348) needs **no body change**: it iterates
`COMPONENT_KINDS`, special-cases `hooks`, and comma-joins everything else. `workflows`
takes the default single-line arm. `[VERIFIED: extensions/pi-claude-marketplace/shared/notify.ts:3328-3348]`

### C. Production — `extensions/pi-claude-marketplace/orchestrators/plugin/info.ts`

| # | Line | Symbol | Change |
|---|------|--------|--------|
| C1 | 274-284 | `nameFromEntry` | widen `kind` union to include `"workflows"`; add the `.js` suffix arm (see Pitfall 1 for the correct shape) |
| C2 | 311-315 | `discoverComponentNames` | widen `kind` union to include `"workflows"` |
| C3 | 253-271 | doc comment | the per-kind enumeration list gains a `workflows` bullet |
| C4 | 669-686 | `composeResolvedComponents` | param `componentPaths` structural type gains `readonly workflows: readonly string[]`; return type gains `readonly workflows?: readonly string[]`; body gains one `discoverComponentNames(..., "workflows")` call and one `...(workflows.length > 0 && { workflows })` spread |
| C5 | 654-668 | doc comment | SURF-01 note names the enforced ordering; update |
| C6 | 1223-1242 | `deriveLenientComponentPaths` | return type + `out` literal + the `["skills", "commands", "agents"] as const` loop at 1233 — see Open Question 3 **compile-forced** |
| C7 | 1866 | warm-git `unavailable` component-path literal | `{ skills: ["skills"], commands: ["commands"], agents: ["agents"] }` — see Open Question 3 **compile-forced** |

`buildNotInstallablePathRowFields` (1172) and `buildAvailableRow` (2046) type their
`resolved` parameter as `Parameters<typeof composeResolvedComponents>[1]`, so they widen
automatically. The state-only info arms (INFO-09/INFO-10/INFO-11, ~1090-1146) read
`record.resources.*`, which has no `workflows` member until Phase 103 — **no change**.
`[VERIFIED: extensions/pi-claude-marketplace/orchestrators/plugin/info.ts:1172, 2046, 1090-1146]`

### D. Tests — compile-forced `componentPaths` literals (16 sites, 8 files)

Every one is inside a function whose return type or variable annotation is
`ResolvedPluginInstallable` / `ResolvedPlugin`, so each is a hard typecheck error.
Each fix is the same one line: `workflows: [],`.

| File | Lines |
|------|-------|
| `tests/bridges/integration.test.ts` | 76 |
| `tests/bridges/integration-foreign-content.test.ts` | 55 |
| `tests/bridges/integration-materialization-gate.test.ts` | 107 |
| `tests/bridges/agents/stage.test.ts` | 44 |
| `tests/bridges/commands/discover.test.ts` | 26, 221, 257 |
| `tests/bridges/commands/stage.test.ts` | 62 |
| `tests/bridges/skills/discover.test.ts` | 31, 187, 222, 251, 291 |
| `tests/bridges/skills/stage.test.ts` | 41 |
| `tests/orchestrators/plugin/plugin-state-classifier.test.ts` | 52, 68 |

There are **no** spread-based or `Object.assign` constructions of `componentPaths`
anywhere in the tree — the grep for `componentPaths: {` is exhaustive.
`[VERIFIED: grep over extensions/ and tests/, this session]`

### E. Tests and docs — deliberate amendments

| # | File | Change |
|---|------|--------|
| E1 | `tests/architecture/hooks-foundation.test.ts:199-205` | update the pin in place to the 5-tuple; drop "4-tuple" from the title; keep the locked-shape-and-order rationale in the assertion message |
| E2 | `tests/domain/resolver-strict.test.ts` | new cases: convention-only (**primary**), manifest string form, manifest array form, declared-but-absent path, empty `workflows/` dir, union+dedup with a declared path |
| E3 | `tests/domain/resolver-loose.test.ts` | new cases: entry-declared resolves; manifest-only produces the `component declarations conflict` note; no implicit-by-convention |
| E4 | `docs/output-catalog.md` (`## /claude:plugin info …`) | new `<!-- catalog-state: … -->` block showing a `workflows:` line; also fix the section preamble at line 1556, which states the order as `agents, commands, mcp, skills` and is already stale |
| E5 | `tests/architecture/catalog-uat.test.ts` | matching `FIXTURES` entry. **The gate is bidirectional**: a catalog annotation with no fixture fails the forward walk, a fixture with no annotation fails the inverse walk. Both must land in one change. |

### F. Comments referencing the old tuple sizes (grep-and-fix)

- `extensions/pi-claude-marketplace/orchestrators/plugin/info.ts:665` — "the renderer iterates `COMPONENT_KINDS` to enforce the `["agents", "commands", "hooks", "mcp", "skills"]` ordering"
- `tests/orchestrators/plugin/info.test.ts:1682` — "the 5-tuple `COMPONENT_KINDS`"
- `tests/shared/notify-v2.test.ts:4243` — "`mcp, skills` order (COMPONENT_KINDS tuple)"
- `extensions/pi-claude-marketplace/shared/concerns/hooks.ts:6` — mentions `COMPONENT_KINDS`

Note `extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts:365`
("COMPONENT_KINDS 5-tuple") refers to the **five artifact bridges**, not the info
renderer tuple. Leave it alone — it grows in Phase 103, not here.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Finding `<pluginRoot>/workflows` when the manifest is silent | A new convention-probe function | The existing `statKind(path.join(pluginRoot, kind)) === "dir"` inside `collectStrictComponentKind` | It already handles the union with declared paths, first-wins dedup, and the `supported.push`. A parallel probe would drift from the three kinds it must behave identically to. |
| Normalizing `string \| array` manifest forms | A `typeof x === "string" ? [x] : x` branch | `readPathOrArray` (resolver.ts:778) | It also maps `null`/`undefined` to `[]` and wraps a non-array non-string into a single element specifically so `validateComponentPath` emits the consistent "not a string" note. A hand-rolled ternary loses that. |
| Rejecting an escaping or absolute declared path | A `path.relative().startsWith("..")` check | `validateComponentPath` → `assertPathInside` | `assertPathInside` is the NFR-10 chokepoint and carries the D-14 symlink refusal. Re-deriving containment is how a path-escape becomes reachable. |
| Guaranteeing the renderer cannot drop the new kind | A code review checklist | The length-exact `COMPONENT_KINDS` tuple | It is already the enforcement mechanism; growing it is the whole job. |
| Sorting / deduping enumerated names | A local `Set` + `sort` | `discoverComponentNames` | It already returns a sorted, deduped `readonly string[]` using `localeCompare(…, { sensitivity: "base" })`, and the renderer explicitly does not sort defensively. Two comparators would produce two orders. |

**Key insight:** every mechanism this phase needs already exists and is generic over
`SupportedPathKind`. The single genuinely new line of behavior in the whole phase is the
`.js` suffix arm in `nameFromEntry`. Everything else is a tuple member and the compile
errors it forces.

## Runtime State Inventory

This phase moves a **closed-set boundary** that is persisted, so the inventory applies.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| **Stored data** | `state.json` → `marketplaces[*].plugins[*].compatibility.supported` is `Type.Array(Type.String())` — a plain untyped string array with no enum and no length pin. A record written before this phase carries `["skills"]`; after, a re-resolve yields `["skills", "workflows"]`. `[VERIFIED: extensions/pi-claude-marketplace/persistence/state-io.ts:113-118]` | **No data migration.** Records self-heal on the next install / update / reinstall / enable, and via the two paths below. No `persistence/migrate.ts` change. |
| **Live service config** | None — this extension has no external service. The reconcile backfill gate reads `state.lastReconciledExtensionVersion` and compares it to `EXTENSION_VERSION` (`"0.14.0"`, pinned to `package.json` by `tests/architecture/extension-version-sync.test.ts`). The gate opens once when the version moves at release. `[VERIFIED: extensions/pi-claude-marketplace/shared/extension-version.ts:16; orchestrators/reconcile/apply.ts:908]` | None in this phase. The version bump is the standing release checklist item, and the gate opening is the intended CR-01 path. |
| **OS-registered state** | None. Nothing registers with the OS. | None |
| **Secrets / env vars** | None touched. | None |
| **Build artifacts** | None — the project has no build step (`tsc --noEmit` only, Node runs `.ts` natively). No egg-info / dist / compiled artifact carries the kind list. `[VERIFIED: .planning/codebase/STACK.md]` | None |

**Schema migration verdict: NO.** `compatibility.supported` is an unconstrained
`string[]`; `PLUGIN_INSTALL_RECORD_SCHEMA` gains no key; `STATE_SCHEMA.schemaVersion`
stays the `[1, 2]` union that `tests/architecture/compat-01-no-expansion.test.ts:413`
pins. `[VERIFIED: extensions/pi-claude-marketplace/persistence/state-io.ts:113-118, 240-250]`

## Common Pitfalls

### Pitfall 1: `nameFromEntry` silently returning nothing for every workflow

**What goes wrong:** `nameFromEntry` today has two arms — `skills` (directories) and an
unguarded fallthrough for "commands + agents" that filters on `.md`. Adding `"workflows"`
to the `kind` union **without** an arm compiles cleanly and makes every `.js` script fail
the `.endsWith(".md")` test, so `discoverComponentNames` returns `[]`, so the
`components.workflows` spread is skipped, so the `workflows:` line never renders.

**Why it happens:** the fallthrough is written as a `return` on the tail rather than an
exhaustive switch with `assertNever`, so the compiler cannot help. Verbatim
(`extensions/pi-claude-marketplace/orchestrators/plugin/info.ts:274-284`):

```typescript
function nameFromEntry(
  entry: { name: string; isDirectory(): boolean; isFile(): boolean },
  kind: "skills" | "commands" | "agents",
): string | undefined {
  if (kind === "skills") {
    return entry.isDirectory() ? entry.name : undefined;
  }

  // commands + agents: `.md` files; strip the suffix for display.
  return entry.isFile() && entry.name.endsWith(".md") ? entry.name.slice(0, -3) : undefined;
}
```

**How to avoid:** make the suffix a variable rather than adding a near-duplicate branch —
one statement, no `sonarjs/no-identical-functions` exposure, and correct if a longer
suffix is ever introduced:

```typescript
  // commands + agents: `.md`; workflows: `.js`. Strip the suffix for display.
  const suffix = kind === "workflows" ? ".js" : ".md";
  return entry.isFile() && entry.name.endsWith(suffix)
    ? entry.name.slice(0, -suffix.length)
    : undefined;
```

**Warning signs:** the new resolver tests pass but the catalog-UAT fixture for the
`workflows:` line has to be hand-written with names the code never produces. If the
`info` test needs a fixture directory containing a `.js` file and renders nothing, this
is the cause.

### Pitfall 2: the reconcile backfill re-materializing installed plugins on `/reload`

**What goes wrong:** `supportedSetGrew` returns `true` when the re-resolved supported set
is a strict superset of the recorded one, and the caller then re-materializes the plugin
through `reinstallPlugin` with `render: "none"`, folding a `plugin-backfilled` row into
the reconcile cascade. Admitting `workflows` moves that boundary for every plugin
shipping `workflows/`.

**Why it is narrower than it looks — the load-bearing finding:** the scan is gated on
`compatibility.installable === false` **twice**, so a **cleanly installed** plugin is
never scanned at all. Verbatim
(`extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts:1090-1094`):

```typescript
  const { scope, marketplace, mp, plugin, record } = target;
  // D-68-03: scan ONLY partially-installed plugins.
  if (record.compatibility.installable) {
    return false;
  }
```

and the gate that decides whether the scan runs at all
(`extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts:908-921`):

```typescript
  if (state.lastReconciledExtensionVersion === EXTENSION_VERSION) {
    // Gate closed: the extension version has not moved since the last
    // reconcile, so the supported-kind boundary cannot have moved either.
    // No scan, no write -- RECON-05 mtime invariant preserved.
    return;
  }

  // WR-01: no state.json on disk AND nothing to promote -- skip silently. The
  // stamp write below would otherwise bring an unsolicited state.json into
  // existence purely to record the version (WR-05). When state.json already
  // exists, stamping it (even with zero promotions) stays correct per D-68-03.
  if (!readResult.stateExisted && !hasForceInstalledPlugin(state)) {
    return;
  }
```

So the exact trigger set is: a record that is (a) `installable: false`, (b) `enabled: true`,
(c) not already touched by `applyPlan` this load, (d) re-resolves non-`unavailable` with
a strictly-larger supported set, on (e) the first `/reload` after `EXTENSION_VERSION`
moves. In practice: a plugin that ships `workflows/` **and** an unsupported kind such as
`themes`.

**What it actually does with no bridge:** `reinstallPlugin` re-stages the five existing
kinds and rewrites `compatibility.supported` to include `"workflows"`. No workflow
artifact is written, because none exists. The result is a correct, idempotent record
refresh plus one cascade row on `/reload`.

**Is it intended?** Yes — this is the CR-01 self-healing path, and it has an exact
precedent: HOOK-01 moved the same boundary by admitting `hooks`, and the backfill
machinery (BFILL-01 / BFILL-02 / D-68-03) was built for precisely this event. The
`render: "none"` reinstall does not emit its own notification; the row rides the single
reconcile cascade.

**Can it fail?** Yes, and it degrades correctly: `backfillOnePluginIsolated` wraps each
plugin in try/catch and surfaces a plugin-scoped `(failed)` row; `anyFailure` keeps the
version gate **open** so the next load retries; `applyBackfillForScopeIsolated` coerces a
stamp-write throw into an `invalid-block` row rather than aborting the cascade. No new
failure mode is introduced.
`[VERIFIED: extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts:958-1126, 1158-1250]`

**How to avoid trouble:** nothing to avoid — but the plan should cover it with one test in
`tests/orchestrators/reconcile/backfill.test.ts` (which already has the tmpdir + fixture
harness and 20 sibling cases): a `installable: false` record whose recorded
`supported: ["skills"]` re-resolves to `["skills", "workflows"]` produces exactly one
backfill outcome, and the same record with `installable: true` produces none.

### Pitfall 3: `update` on a disabled record newly writing a refresh

**What goes wrong:** `disabledPinProjection` JSON-encodes
`[version, resolvedSource, resolvedSha, installable, notes, supported, unsupported]` and
`disabledRefreshWouldWrite` compares the projection the resolver would produce against
the one on the record. Adding `"workflows"` to `supported` changes that projection, so a
disabled workflow-bearing plugin's next `update` stops being a no-op and writes a refresh,
emitting the `disabled-record-refresh` row.

**Why it happens:** the projection deliberately includes `compatibility.supported` so the
refresh keeps the record's pin honest about what a future `enable` would install.
`[VERIFIED: extensions/pi-claude-marketplace/orchestrators/plugin/update.ts:1418-1437, 1464-1515]`

**Is it correct?** Yes — the pin genuinely changed, and the refresh is the mechanism that
records it. It is one-time and idempotent (the second `update` is a no-op again).

**How to avoid:** do not "fix" it by excluding `supported` from the projection — that
would break the D-99-05a guarantee that the pin describes what `enable` will install.
Note it in the plan so a reviewer seeing an unexpected `disabled-record-refresh` row
knows it is expected.

### Pitfall 4: assuming a catalog example lands for free

**What goes wrong:** `tests/architecture/catalog-uat.test.ts` walks the catalog for
`<!-- catalog-state: … -->` annotations, pairs each with a programmatic `FIXTURES`
entry, and asserts byte equality — **and** runs an inverse walk that fails on any fixture
with no annotation. Adding one without the other fails one of the two directions.

**Why it matters here:** because the fixtures are hand-written `NotificationMessage`
literals rather than derived from the renderer, **no existing catalog example changes**
when a sixth component kind is added. The gate stays green with zero edits. The new
`workflows:` example is therefore a deliberate addition, not a forced regeneration —
and it needs both halves in the same commit.
`[VERIFIED: tests/architecture/catalog-uat.test.ts:1-80 and the inverse-walk tail]`

### Pitfall 5: touching `docs/output-catalog.md` prose with the wrong tool

The repo formats Markdown with `mdformat` via pre-commit, **not** prettier
(`format:check` covers only `js,json,ts`). Running `prettier --write` on the catalog is
always wrong. Run `pre-commit run --files docs/output-catalog.md` before committing.
`[VERIFIED: package.json scripts; CLAUDE.md pre-commit policy]`

### Pitfall 6: forgetting the ESLint style rules on the new lines

`@stylistic/padding-line-between-statements` requires a blank line after every block-like
statement, `curly: ["error", "all"]` requires braces always, and
`@typescript-eslint/explicit-module-boundary-types` requires return annotations on
exports. The new `nameFromEntry` arm and the `composeResolvedComponents` addition both sit
in code where these already apply.
`[VERIFIED: .planning/codebase/CONVENTIONS.md]`

## Code Examples

### 1. The current supported-kind tuples (the two edit targets)

```typescript
// Source: extensions/pi-claude-marketplace/domain/resolver.ts:317-337 (verbatim)
/**
 * HOOK-01: the PUBLIC closed set of supported component kinds. Downstream
 * consumers (surface renderers, OBS/SURF tests) read this tuple as the
 * authoritative supported-kind list. `hooks` is admitted here even though
 * the path-validation loop iterates a narrower subset
 * (`SUPPORTED_COMPONENT_PATH_KINDS`) -- the hooks-config discovery path
 * is a convention file, not a component-path field.
 */
export const SUPPORTED_COMPONENT_KINDS = ["skills", "commands", "agents", "hooks"] as const;
export type SupportedKind = (typeof SUPPORTED_COMPONENT_KINDS)[number];

/**
 * HOOK-01: the PRIVATE subset of supported kinds that carry per-entry
 * component-path semantics (entry/manifest declares a relative dir; the
 * resolver validates each path and adds it to `componentPaths.<kind>`).
 * `hooks` is deliberately excluded -- its discovery path is the
 * convention file `<pluginRoot>/hooks/hooks.json`, parsed by
 * `parseHooksConfig`, NOT a path-bearing field.
 */
const SUPPORTED_COMPONENT_PATH_KINDS = ["skills", "commands", "agents"] as const;
type SupportedPathKind = (typeof SUPPORTED_COMPONENT_PATH_KINDS)[number];
```

### 2. The schema and its two mirrors

```typescript
// Source: extensions/pi-claude-marketplace/domain/resolver.ts:57-66 (verbatim)
// D-07 (COMP-01): array-per-kind shape. The resolver UNIONs declared
// (entry > manifest order) + implicit-by-convention paths with first-wins
// dedup; the array semantics let `componentPaths.skills` carry both the
// declared `custom/skills` and the conventional `skills` simultaneously.
// This is additive rather than PR-4 short-circuit semantics.
const ComponentPathsSchema = Type.Object({
  skills: Type.Array(Type.String()),
  commands: Type.Array(Type.String()),
  agents: Type.Array(Type.String()),
});
```

```typescript
// Source: extensions/pi-claude-marketplace/domain/resolver.ts:382 (verbatim)
  componentPaths: { skills: string[]; commands: string[]; agents: string[] };
```

```typescript
// Source: extensions/pi-claude-marketplace/domain/resolver.ts:410 (verbatim)
    componentPaths: { skills: [], commands: [], agents: [] },
```

### 3. The `info` render path

```typescript
// Source: extensions/pi-claude-marketplace/shared/notify.ts:1390-1400 (verbatim)
interface PluginInfoComponentsResolved {
  readonly componentsResolved: true;
  readonly components: {
    readonly agents?: readonly string[];
    readonly commands?: readonly string[];
    readonly hooks?: readonly HookSummaryEntry[];
    readonly mcp?: readonly string[];
    readonly skills?: readonly string[];
  };
  readonly dependencies?: readonly string[];
}
```

```typescript
// Source: extensions/pi-claude-marketplace/orchestrators/plugin/info.ts:672-686 (verbatim)
    readonly componentPaths: {
      readonly skills: readonly string[];
      readonly commands: readonly string[];
      readonly agents: readonly string[];
    };
    readonly mcpServers: Record<string, unknown>;
    readonly hooksConfigPath?: string;
  },
): Promise<{
  readonly agents?: readonly string[];
  readonly commands?: readonly string[];
  readonly hooks?: readonly HookSummaryEntry[];
  readonly mcp?: readonly string[];
  readonly skills?: readonly string[];
}> {
```

### 4. The lenient re-derivation for the `unavailable` arm (Open Question 3)

```typescript
// Source: extensions/pi-claude-marketplace/orchestrators/plugin/info.ts:1223-1242 (verbatim)
function deriveLenientComponentPaths(entry: MarketplaceManifest["plugins"][number]): {
  skills: string[];
  commands: string[];
  agents: string[];
} {
  const out = {
    skills: ["skills"],
    commands: ["commands"],
    agents: ["agents"],
  };
  for (const kind of ["skills", "commands", "agents"] as const) {
    for (const d of asDeclaredList((entry as Record<string, unknown>)[kind])) {
      if (typeof d === "string" && !out[kind].includes(d)) {
        out[kind].push(d);
      }
    }
  }

  return out;
}
```

```typescript
// Source: extensions/pi-claude-marketplace/orchestrators/plugin/info.ts:1862-1868 (verbatim)
  const forComponents =
    resolved.state === "partially-available"
      ? resolved
      : {
          componentPaths: { skills: ["skills"], commands: ["commands"], agents: ["agents"] },
          mcpServers: {},
        };
```

### 5. The closed-set pin to update in place

```typescript
// Source: tests/architecture/hooks-foundation.test.ts:199-205 (verbatim)
test("HOOK-01: SUPPORTED_COMPONENT_KINDS is the closed 4-tuple [skills,commands,agents,hooks]", () => {
  assert.deepEqual(
    [...SUPPORTED_COMPONENT_KINDS],
    ["skills", "commands", "agents", "hooks"],
    "SUPPORTED_COMPONENT_KINDS is a public closed-set contract -- shape and order are locked",
  );
});
```

### 6. The resolver test harness — the shortest convention-directory example to copy

Resolver tests use an **in-memory `ResolveContext`**, not memfs and not a tmpdir. The
`mockCtx` helper is declared identically at the top of both `resolver-strict.test.ts`
(lines 32-61) and `resolver-loose.test.ts` (lines 27-56), with the shared
`const MP = "/abs/marketplace"` and `const ROOT = (rel) => path.resolve(MP, rel)`.

```typescript
// Source: tests/domain/resolver-strict.test.ts:1066-1078 (verbatim)
test("PR-4 implicit-by-convention populates componentPaths.skills when neither entry nor manifest declares it", async () => {
  const ctx = mockCtx(MP, {
    [ROOT("./local")]: "dir",
    [path.join(ROOT("./local"), "skills")]: "dir",
  });
  const r = await resolveStrict(basicEntry({ source: "./local" }), ctx);
  assert.equal(r.state, "installable", `notes if not: ${r.notes.join(" / ")}`);

  if (r.state === "installable") {
    assert.deepEqual(r.componentPaths.skills, ["skills"]);
    assert.ok(r.supported.includes("skills"));
  }
});
```

This is the template for the **primary** WFLW-01 test: swap `"skills"` for `"workflows"`.
Note the `if (r.state === "installable")` narrowing guard — NFR-7 makes it mandatory
before reading `componentPaths`.

The union-with-declared-path template is at `tests/domain/resolver-strict.test.ts:1081-1096`
(asserts `["custom", "skills"]` — declared first, convention appended), and the loose-mode
no-convention negative is at `tests/domain/resolver-loose.test.ts:103-117`.
`[VERIFIED: tests/domain/resolver-strict.test.ts:32-78, 1066-1096; tests/domain/resolver-loose.test.ts:27-60, 103-117]`

### 7. Baseline behavior, executed this session

Running `resolveStrict` against an in-memory context with `<pluginRoot>` and
`<pluginRoot>/workflows` both present, and nothing else:

```json
{
  "state": "installable",
  "name": "p1",
  "pluginRoot": "/abs/mp/local",
  "supported": [],
  "unsupported": [],
  "notes": [],
  "componentPaths": { "skills": [], "commands": [], "agents": [] },
  "mcpServers": {}
}
```

`SUPPORTED_COMPONENT_KINDS` printed `skills,commands,agents,hooks`;
`UNSUPPORTED_COMPONENT_KINDS` printed
`lspServers,monitors,themes,outputStyles,channels,userConfig,settings`. This is the
zero-signal outcome WFLW-03 names, reproduced rather than asserted.
`[VERIFIED: live execution against the working tree, this session]`

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| One `SUPPORTED_COMPONENT_KINDS` tuple used for both the public contract and the path-validation loop | Two tuples: the public closed set and the private path-bearing subset | HOOK-01 (`hooks` joins the first only) | This phase adds `workflows` to **both**, which is a shape neither existing member has: `skills`/`commands`/`agents` are in both, `hooks` in only the first. `workflows` joins the majority shape. |
| Boolean `installable: true \| false` discriminant | Three-way `state: "installable" \| "partially-available" \| "unavailable"` | D-64-01 | Every new test must narrow on `r.state === "installable"` before reading `componentPaths`; the old `if (r.installable)` pattern no longer exists. |
| `hooks` in `UNSUPPORTED_COMPONENT_KINDS` | `hooks` admitted, discovered via its convention **file** | HOOK-01 | The exact precedent for this phase, including the backfill boundary-move handling. |

**Deprecated / not applicable here:**

- `bridges/agents/`'s index-file mutation model — no counterpart exists for workflows, and this phase touches no bridge regardless.
- Prettier for Markdown — the repo uses `mdformat`.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The Claude `workflows` manifest field is `string \| array` with the semantics "Custom workflow script files or directories, replaces default `workflows/`" | User Constraints (copied verbatim from CONTEXT.md, which sourced it from Spike 021) | Low. The resolver's handling is shape-only and mode-independent, so a string-vs-array mismatch changes nothing: `readPathOrArray` accepts both and any other shape produces the standard "not a string" note. The "replaces default" clause is **not** honored by the existing union semantics (D-07 makes convention paths additive, not fallback) — that divergence already exists for skills/commands/agents and is deliberate. |
| A2 | The `.js` extension is the correct filter for workflow scripts | Pitfall 1, Change Map C1 | Low, and self-correcting: WBRG-02 (Phase 103) independently specifies `.js`, and the spike observed real filenames (`drafter.workflow.js`). If a plugin ships `.mjs`, `info` under-reports names in this phase only; Phase 102's extractor is where the real admission decision lands. |
| A3 | Adding a catalog example is desirable rather than merely permitted | Change Map E4/E5, Open Question 1 | Low. CONTEXT.md names `docs/output-catalog.md` and its gate among the files new tests extend, so the intent is explicit. Verified independently that the gate does **not** force it (no existing example changes). |

Every other claim in this document was read from, or executed against, the working tree
this session and is tagged `[VERIFIED: path:lines]`.

## Open Questions

1. **Success Criterion 3 names `list`, but `list` renders no component enumeration.**
   - *What we know:* `list` composes rows from status glyph + name + version + status token + reasons brace, and every reason on it derives from `unsupported` — `narrowUnsupportedKinds(record.compatibility.unsupported)` for `partially-installed`, `narrowUnsupportedKinds(candidateResolved.unsupported)` for `partially-upgradable`. Nothing on the list surface reads `supported`. The catalog's `list` section contains no component lines in any of its 18 states. `[VERIFIED: extensions/pi-claude-marketplace/orchestrators/plugin/list.ts:495-545, 715-725; docs/output-catalog.md:170-451]`
   - *What is unclear:* whether SC 3's "reports a workflow component count on `list` and `info`" intends rendered bytes on `list`, or is loose wording for "no longer resolves as though the directory were not there".
   - *Recommendation:* satisfy the `list` half at the **state** level, not the render level — assert that a workflow-bearing plugin's `compatibility.supported` records `"workflows"` after install, which is what `list` reads through when a degradation reason arrives. Satisfy the `info` half at the render level with the `workflows:` line. State plainly in the plan that no `list` byte changes in this phase, because the locked decision (correctly) adds no reason token. The rendered `list` signal is Phase 105's `workflow_control` degradation token. Do **not** add a token here to force the SC — that trips COMPAT-01's `REASONS` pin and duplicates Phase 105.

2. **Should `workflows` be added to `PLUGIN_ENTRY_SCHEMA`'s `SUPPORTED_COMPONENT_PATH_FIELDS`?**
   - *What we know:* verified by execution that both validators already accept `workflows` in string and array form — the TypeBox objects are open (no `additionalProperties: false`), so the field passes today. The resolver reads it through `(entry as Record<string, unknown>)[kind]`, a cast that bypasses the schema entirely. There is **no** drift gate tying the schema's field lists to the resolver's tuples. `[VERIFIED: live PLUGIN_ENTRY_VALIDATOR.Check execution; extensions/pi-claude-marketplace/domain/components/plugin.ts:23-39]`
   - *What is unclear:* whether the project treats those field lists as documentation of the supported set or as pure validation.
   - *Recommendation:* **add it** (`workflows: Type.Optional(Type.Unknown())` in `SUPPORTED_COMPONENT_PATH_FIELDS`). It is a one-line, behavior-neutral change that keeps the schema's two named groups honest about which kinds are supported, and it costs nothing. Flag it as low-risk; it is squarely inside Claude's Discretion.

3. **Should the two lenient `unavailable`-arm component-path seeds gain a `workflows` convention entry?**
   - *What we know:* `deriveLenientComponentPaths` (info.ts:1223) and the inline literal at info.ts:1866 both re-seed `["skills"]`/`["commands"]`/`["agents"]` because the `unavailable` arm carries no `componentPaths` (NFR-7). Both are compile-forced by the required schema member, so the executor must decide — there is no "leave it alone" option that compiles.
   - *What is unclear:* nothing functionally; it is a consistency judgement.
   - *Recommendation:* **seed `workflows: ["workflows"]` in both**, and add `"workflows"` to the `["skills", "commands", "agents"] as const` loop at info.ts:1233. Rationale: these two sites exist specifically so a structurally-broken plugin still enumerates its on-disk components, and omitting `workflows` would make the `unavailable` arm the one surface where a workflows directory reads as absent — reintroducing the zero-signal outcome the phase removes. Consequence: an `unavailable` plugin shipping `workflows/` newly renders a `workflows:` line on `info`. Verified safe: **no** test fixture anywhere under `tests/` contains a `workflows` directory, so no existing assertion changes. `[VERIFIED: find over tests/, this session]`

4. **Does the PRD's component-kind prose need updating in this phase?**
   - *What we know:* `docs/prd/pi-claude-marketplace-prd.md` enumerates the supported/unsupported kinds at lines 77, 92, and 118. CONTEXT.md does not name the PRD, and WDOC-01/WDOC-02 (Phase 105) own documentation.
   - *Recommendation:* **defer to Phase 105.** A half-updated PRD (kind admitted, bridge absent, degradation unstated) is worse than a consistently-behind one. Note it as a forward dependency so Phase 105 does not miss it.

## Forward Dependencies (one line each, per scope discipline)

- Phase 102 replaces the `info` line's name source from the `.js` file stem to the acorn-extracted `meta.name`, so `discoverComponentNames`'s `workflows` arm is the seam it edits.
- Phase 103 adds the sixth **ledger** phase; note the separate "5-tuple" comment at `orchestrators/plugin/enable-disable.ts:365` refers to that bridge count, not the `info` renderer tuple this phase grows.
- Phase 105 adds the degradation reason token to the closed `REASONS` set, which **is** pinned by `tests/architecture/compat-01-no-expansion.test.ts:126` and `tests/architecture/notify-closed-set-locks.test.ts:29` (currently 38 entries) — that is the phase where the COMPAT-01 amendment lands, not this one.
- Phase 105 also owns the PRD prose at `docs/prd/pi-claude-marketplace-prd.md:77, 92, 118`.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | running `.ts` natively, `node:test` | ✓ | 22.22.2 (engines floor `>=20.19.0`) | — |
| npm | `npm run check` | ✓ | 10.9.7 | — |
| `typescript` (`tsc --noEmit`) | the compile-forced enumeration | ✓ | `^6.0.3`, installed | — |
| `typebox` | `ComponentPathsSchema` | ✓ | `^1.1.38`, installed | — |
| `pre-commit` | markdown/format hooks before commit | ✓ (repo policy) | — | — |
| Network | none | n/a | — | This phase is offline by construction; the resolver is network-free (NFR-5). |

**Missing dependencies with no fallback:** none
**Missing dependencies with fallback:** none

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | `node:test` (Node 22.22.2 built-in) |
| Config file | none — the runner is configured entirely by the `package.json` script glob |
| Quick run command | `node --test tests/domain/resolver-strict.test.ts tests/domain/resolver-loose.test.ts` |
| Full suite command | `npm run check` (typecheck → lint → format:check → test → test:integration) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| WFLW-01 | convention-only `workflows/`, no manifest field → `supported` includes `workflows`, `componentPaths.workflows === ["workflows"]` **(PRIMARY)** | unit | `node --test tests/domain/resolver-strict.test.ts` | ✅ extend |
| WFLW-01 | empty `workflows/` dir still admits the kind | unit | same | ✅ extend |
| WFLW-02 | manifest declares `workflows: "wf"` (string) → resolved | unit | same | ✅ extend |
| WFLW-02 | manifest declares `workflows: ["a","b"]` (array) → both resolved, first-wins dedup | unit | same | ✅ extend |
| WFLW-02 | declared path that does not exist → accepted, **no note**, still `installable` | unit | same | ✅ extend |
| WFLW-02 | declared path escaping `pluginRoot` → note + `unavailable` (parity with skills) | unit | same | ✅ extend |
| WFLW-02 | declared path + convention dir → union, declared first (`["custom", "workflows"]`) | unit | same | ✅ extend |
| WFLW-02 | loose mode: entry-declared resolves; manifest-only → `component declarations conflict`; convention dir alone → **not** admitted | unit | `node --test tests/domain/resolver-loose.test.ts` | ✅ extend |
| WFLW-03 | a workflows-only plugin resolves with `supported` non-empty (the regression this phase closes) | unit | `node --test tests/domain/resolver-strict.test.ts` | ✅ extend |
| WFLW-04 | `SUPPORTED_COMPONENT_KINDS` equals the 5-tuple in order | architecture | `node --test tests/architecture/hooks-foundation.test.ts` | ✅ amend in place (line 199) |
| WFLW-04 | COMPAT-01 no-expansion contract still passes unchanged | architecture | `node --test tests/architecture/compat-01-no-expansion.test.ts` | ✅ exists, expected green with **zero** edits |
| SC 3 (info) | `info` renders `    workflows: <stem>, <stem>` in the six-kind order | catalog byte-equality | `node --test tests/architecture/catalog-uat.test.ts` | ❌ Wave 0 — needs paired catalog block + `FIXTURES` entry |
| Pitfall 2 | a `installable: false` record whose supported set grows by `workflows` backfills once; a `installable: true` one does not | integration | `node --test tests/orchestrators/reconcile/backfill.test.ts` | ✅ extend (20 sibling cases, tmpdir harness present) |

### Sampling Rate

- **Per task commit:** `node --test tests/domain/resolver-strict.test.ts tests/domain/resolver-loose.test.ts && npm run typecheck`
- **Per wave merge:** `npm run test` (the full unit glob, including all architecture gates)
- **Phase gate:** `npm run check` green, then `pre-commit run --all-files` (CI runs `--all-files`; a scoped run hides pre-existing violations)

### Wave 0 Gaps

- [ ] `docs/output-catalog.md` — a `<!-- catalog-state: … -->` block under `## /claude:plugin info <plugin>@<marketplace>` showing the `workflows:` line — covers SC 3 (info half)
- [ ] `tests/architecture/catalog-uat.test.ts` — the paired `FIXTURES` entry; the gate is bidirectional and fails without both

No framework install is needed. No new test file is created (locked decision).

## Security Domain

`security_enforcement` is absent from `.planning/config.json`, so it is treated as
enabled.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | No credential path is touched. |
| V3 Session Management | no | No session concept exists in this layer. |
| V4 Access Control | no | No authorization decision is made. |
| V5 Input Validation | **yes** | The `workflows` manifest field is untrusted third-party input. It is validated by the existing `readPathOrArray` → `validateComponentPath` chain: nested-array reject, non-string reject, absolute-path reject, and `assertPathInside(pluginRoot, candidate)` containment. **No new validator is written.** `[VERIFIED: extensions/pi-claude-marketplace/domain/resolver.ts:778-848]` |
| V6 Cryptography | no | Nothing is hashed, signed, or encrypted here. (The project-key SHA-256 derivation is WPTH-03, Phase 103.) |
| V12 File and Resources | **yes** | Path containment (NFR-10) is the live control. This phase adds a fourth kind that flows through the same `assertPathInside` chokepoint; it does **not** amend the containment roots. The NFR-10 root amendment is WPTH-04, Phase 103. |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Malicious `workflows` path escaping the plugin root (`"../../etc"`) | Tampering | `assertPathInside` inside `validateComponentPath`; the escape becomes a note and a structural `dirty`, resolving `unavailable` — verified identical to the existing skills path |
| Absolute `workflows` path pointing outside the marketplace | Tampering | `path.isAbsolute(raw)` reject, before any resolve |
| Symlinked `workflows/` directory pointing outside | Tampering | D-14 all-symlink refusal lives inside `assertPathInside`. **Caveat:** the convention probe (`statKind === "dir"`) does *not* route through `assertPathInside` — it is a direct join under `pluginRoot`, so no escape is expressible. The symlink refusal that matters for a symlinked *script* is the bridge's concern (WBRG-02, Phase 103). |
| Executing untrusted script content to learn about it | Elevation of Privilege | **Not reachable in this phase.** Recognition performs `statKind` and (for `info`) `readdir` only. No file content is read, parsed, or evaluated. Phase 102 introduces static acorn parsing; nothing here executes anything. |
| A new upstream component kind being silently ignored | Repudiation | This phase is the mitigation. The T-02-25 closed-list warning at `resolver.ts:344` predicted exactly this; `workflows` was the open instance. |

**Net security posture change: none.** No new input path, no new write path, no new
execution path, no new network path. The phase widens a type union over an existing,
already-validated input channel.

## Project Constraints (from CLAUDE.md)

Directives the plan must honor:

- **Never commit to `main`.** Work lands on `features/workflows-spike` (the current branch) or a worktree under `.worktrees/`.
- **`npm run check` must stay green** (NFR-6): typecheck + ESLint + Prettier + unit tests + integration tests.
- **Run `pre-commit run --all-files` (or `--files <changed>`) BEFORE `git commit`.** Never `--no-verify`. Never recover from a hook failure with `--amend`. CI runs `--all-files`, so a scoped run can hide pre-existing violations.
- **Committing from a worktree:** prefix with `SKIP=trufflehog` only after a clean filesystem-mode trufflehog scan of the changed paths (the git-mode hook is structurally broken in linked worktrees). Do not extend `SKIP=` to other hooks.
- **Conventional Commits**, title 5-72 chars, body lines ≤80. **No GSD milestone/phase mentions** in commit messages or PR titles.
- **Never rebase, never rewrite history.** Update branches by merging.
- **All user-visible output through `ctx.ui.notify`** via `shared/notify.ts` (IL-2). This phase renders through `appendResolvedComponentLines`, which is already inside `notify.ts` — no new output surface.
- **`.claude/rules/typescript-comments.md`:** comments and test titles may cite `D-NN` / requirement IDs (`WFLW-01`, `HOOK-01`, `NFR-7`, `SC-3`) as traceability anchors; `Phase NN`, `Plan NN`, `Wave N`, `Task N`, `milestone vX.Y`, and bare `Pitfall N` / `Pattern N` are **forbidden**. This applies directly to the amended `hooks-foundation.test.ts` title and every new test title.
- **`no-console`** is a lint warning everywhere except `persistence/migrate.ts` (IL-3). Not touched here.
- **ESLint style:** `curly: ["error", "all"]`, blank line after every block-like statement, explicit return types on module boundaries, `sonarjs/cognitive-complexity: 15`.
- **Import order** enforced by `import-x/order`: builtin → external → internal → parent → sibling → index → object → type, blank line between groups, alphabetized, type-only imports last. Test files import production modules with explicit `.ts` extensions.
- **Markdown is formatted by `mdformat`**, not prettier. `format:check` covers only `js,json,ts`.
- **Version bump checklist** (if this phase ships a release): `package.json` + `package-lock.json` + `EXTENSION_VERSION` + `sonar-project.properties` `projectVersion` + `CHANGELOG.md`, then re-run `npm test` (pre-commit does not run the suite that guards the version).
- **Fish shell:** no word-splitting — `git add $FILES` passes one argument. Backticks inside `-m` execute. Use `git commit -F` for multi-line messages and explicit paths for `git add`. **Never `git add -A`.**

## Sources

### Primary (HIGH confidence — read or executed against the working tree this session)

- `extensions/pi-claude-marketplace/domain/resolver.ts` — lines 1-120, 150-449, 760-960, 1240-1534 (tuples, schema, `PartialResolution`, `emptyResolution`, `collectStrictComponentKind`, `collectLooseComponentKind`, `validateComponentPath`, `readPathOrArray`, `resolveStrict`, `resolveLoose`, `decideResolution`)
- `extensions/pi-claude-marketplace/shared/notify.ts` — lines 1360-1430, 3270-3380 (`PluginInfoComponentsResolved`, `COMPONENT_KINDS`, `appendResolvedComponentLines`)
- `extensions/pi-claude-marketplace/orchestrators/plugin/info.ts` — lines 240-330, 645-725, 1140-1300, 1840-1890, 1980-2060 (`nameFromEntry`, `discoverComponentNames`, `composeResolvedComponents`, `deriveLenientComponentPaths`, `buildNotInstallablePathRowFields`, `buildWarmGitNonInstallableRow`, `buildAvailableRow`)
- `extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts` — lines 840-1300 (backfill gate, `hasForceInstalledPlugin`, `scanForceInstalledBackfills`, `backfillOnePluginIsolated`, `maybeBackfillPlugin`, `supportedSetGrew`)
- `extensions/pi-claude-marketplace/orchestrators/plugin/update.ts` — lines 1340-1560 (`disabledPinProjection`, `nextDisabledPin`, `disabledRefreshWouldWrite`, `refreshDisabledRecord`)
- `extensions/pi-claude-marketplace/orchestrators/plugin/list.ts` — lines 495-545, 690-770 (row derivations; confirmed no `supported` read)
- `extensions/pi-claude-marketplace/persistence/state-io.ts` — lines 85-262 (`PLUGIN_INSTALL_RECORD_SCHEMA`, `compatibility`, `STATE_SCHEMA`, `DEFAULT_STATE`)
- `extensions/pi-claude-marketplace/persistence/migrate.ts` — lines 1-60 (confirmed no `supported` handling)
- `extensions/pi-claude-marketplace/domain/components/plugin.ts` — full file (`SUPPORTED_COMPONENT_PATH_FIELDS`, `UNSUPPORTED_COMPONENT_FIELDS`, both validators)
- `extensions/pi-claude-marketplace/shared/extension-version.ts:16` — `EXTENSION_VERSION = "0.14.0"`
- `tests/architecture/compat-01-no-expansion.test.ts` — full file (every COMPAT-01 clause; confirmed no component-kind enumeration)
- `tests/architecture/hooks-foundation.test.ts` — lines 180-230 (the closed-set pin)
- `tests/architecture/catalog-uat.test.ts` — lines 1-80 and the inverse-walk tail
- `tests/architecture/notify-closed-set-locks.test.ts` — the four length pins
- `tests/architecture/extension-version-sync.test.ts` — full file
- `tests/architecture/partial-vocabulary-guard.test.ts` — lines 1-60 (scope; confirmed unaffected)
- `tests/domain/resolver-strict.test.ts` — lines 1-120, 1040-1180 (harness + convention tests)
- `tests/domain/resolver-loose.test.ts` — lines 1-60, 100-130, 315-360 (harness + convention negative)
- `tests/orchestrators/reconcile/backfill.test.ts` — lines 1-50 + fixture shape survey
- `docs/output-catalog.md` — lines 170-455 (`list` states), 1554-1700 (`info` states)
- **Executed:** `resolveStrict` against an in-memory workflows-only plugin; `PLUGIN_ENTRY_VALIDATOR.Check` / `PLUGIN_MANIFEST_VALIDATOR.Check` with a `workflows` field in both string and array form; `node --version`, `npm --version`, `package.json` version
- **Exhaustive greps:** `componentPaths: {`, `ResolvedPluginInstallable|ResolvedPluginPartiallyAvailable|MaterializablePlugin`, `SUPPORTED_COMPONENT_KINDS|SUPPORTED_COMPONENT_PATH_KINDS`, `COMPONENT_KINDS`, `\.supported\b`, `nameFromEntry|discoverComponentNames`, `find tests -type d -name workflows`

### Secondary (project artifacts)

- `.claude/skills/spike-findings-pi-claude-marketplace/references/workflows-bridge.md` — the measured spike blueprint (008-013)
- `.planning/workstreams/workflows/{REQUIREMENTS,ROADMAP,STATE}.md`
- `.planning/workstreams/workflows/phases/101-.../101-CONTEXT.md`
- `CLAUDE.md`, `.claude/rules/typescript-comments.md`, `.planning/codebase/{STACK,CONVENTIONS,ARCHITECTURE}.md`

### Tertiary

None. No web search or external documentation lookup was needed or performed: the phase
is entirely in-repo, and the one external fact it depends on (the Claude `workflows`
manifest field shape) is already a locked, spike-measured decision in CONTEXT.md.

## Metadata

**Confidence breakdown:**

- Standard stack: **HIGH** — no packages involved; the two existing dependencies were read from `package.json`.
- Architecture / Change Map: **HIGH** — every edit site was located by exhaustive grep and confirmed by reading the file; the twenty-two compile-forced literals were verified to carry explicit `ResolvedPluginInstallable` / `ResolvedPlugin` annotations, so each is a genuine typecheck error rather than a structural-typing pass-through.
- Pitfalls: **HIGH** — Pitfalls 1-3 were each traced to specific line ranges and their gating conditions read in full. Pitfall 2's narrowing (`installable === false`) is the single most planning-relevant finding and was read directly at `apply.ts:1092`.
- Closed-set gate impact: **HIGH** — COMPAT-01 was read in full and enumerates no component kinds; the catalog gate's bidirectionality was read at both walks.
- SC 3's `list` half: **HIGH** on the finding (list reads only `unsupported`), **MEDIUM** on the recommended resolution, because it interprets intent the SC left ambiguous. Flagged as Open Question 1 rather than assumed.

**Research date:** 2026-08-14
**Valid until:** stable — this is in-repo research against a working tree at commit
`23f931ec`. It goes stale only if `domain/resolver.ts`, `shared/notify.ts`,
`orchestrators/plugin/info.ts`, or `orchestrators/reconcile/apply.ts` change before the
phase executes. Re-verify the Change Map line numbers if more than a few commits land
first.
