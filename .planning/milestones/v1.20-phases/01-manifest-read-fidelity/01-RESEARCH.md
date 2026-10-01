# Phase 1: Manifest read fidelity - Research

**Researched:** 2026-09-12
**Domain:** In-repo TypeScript change — untrusted-manifest read path, component-path
normalization, and one read-only render surface. No new external technology.
**Confidence:** HIGH (every load-bearing claim was read out of the working tree
this session, and the two behavioral claims were executed against the real
production modules)

## Summary

This phase is entirely in-repo. There is no library to choose, no framework to
learn, and no package to install: every change lands in five existing modules
plus two new leaf modules under `domain/`. The research value is therefore not
"what stack" but "what will the gate reject, what does the fixture harness
already support, and does the locked mechanism actually satisfy the phase's own
success criteria".

Two findings dominate. First, **the repository enforces strict 1:1
source-to-test pairing as part of `npm run check`** — `scripts/check-corresponding-tests.mjs`
fails the build if a production module has no `tests/<mirror>.test.ts` that
imports it *directly*, and equally fails if a `.test.ts` under a corresponding
root has no production module behind it. The two new modules D-01-06 and D-01-20
mandate therefore each drag a mandatory paired test file, and the cross-reader
behavioral test D-01-12 asks for **cannot** live under `tests/domain/` or
`tests/orchestrators/` — it must land in `tests/architecture/`, `tests/integration/`,
or `tests/e2e/`, the three roots the gate exempts.

Second — and this is the one that changes the plan's shape — **the locked
normalization mechanism (D-01-14 / D-01-15) does not satisfy ROADMAP criterion 3
for `ui-theme-designer`.** I ran the real `resolveStrict` and the real
`discoverPluginSkills` against both witness shapes. Normalizing `"./skills/"` to
`"skills"` collapses it against the convention path and drops `ui5` from 8
warnings to 0. But `ui-theme-designer` declares `"./skills/<name>"` — normalizing
gives `"skills/<name>"`, which is a *different* key from `"skills"`, so the
convention path still re-enumerates the same two directories and still emits 2
duplicate warnings. The criterion names both plugins. The gap is in the skills
bridge, not the resolver, and it has a surgical fix that preserves all four
existing collision tests. This needs a decision before planning locks.

**Primary recommendation:** implement the four locked mechanisms as specified,
add the paired test files the corresponding-test gate requires, place the D-01-12
cross-reader test in `tests/architecture/`, and escalate the `ui-theme-designer`
gap to the user with the same-directory dedup in `bridges/skills/discover.ts` as
the recommended resolution.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Dependency rendering (DEPS-01, DEPS-02)

- **D-01-01:** An object dependency renders `<name>@<marketplace> (<version>)`.
  `@` keeps meaning marketplace, consistently with the project-wide
  `<plugin>@<marketplace>` address form used by `install`, `uninstall`, and the
  existing `dependencies:` line. The version constraint rides in parentheses.
  Upstream's npm-style `name@version` was rejected for overloading `@`.
  — **Reversibility:** costly — the byte form is a catalogued output state
  (`docs/output-catalog.md`, `installed-single-scope-with-dependencies`), so a
  later change means a catalog amendment plus every test asserting the line.

- **D-01-02:** An object that omits `marketplace` renders with the DECLARING
  plugin's marketplace filled in. Upstream resolves an unqualified dependency in
  the declaring plugin's own marketplace, so the fill-in states the real
  resolution target rather than leaving the field blank.

- **D-01-03:** Bare-string dependencies get the same fill-in, but ONLY when the
  string contains no `@`. A string already carrying an address is authoritative
  and passes through verbatim. This keeps the existing catalogued example
  (`dependencies: helper@utils-mp`, `docs/output-catalog.md:1765`) byte-valid
  while giving `audit-logger` the same treatment an equivalent object gets.

- **D-01-04:** The array sorts on the DEPENDENCY NAME (an object's `name`, or
  the bare string as written), not on the rendered display string. Identity
  ordering survives a later change to the render form.

- **D-01-05:** An element with no usable name -- `name` missing, empty, or not a
  string -- is dropped silently. The schema keeps this field `Type.Unknown()`, so
  any shape can arrive; `info` is a read-only surface and does not error on
  manifest content. A placeholder token was rejected as new catalog surface for
  a case with no known instance.

#### Manifest location (MANF-01, MANF-02, MANF-04, MANF-05)

- **D-01-06:** The two readers share an ordered candidate constant --
  `MANIFEST_CANDIDATES`, wrapped path first, bare path second -- exported from a
  NEW leaf module `extensions/pi-claude-marketplace/domain/manifest-path.ts`.
  Each reader loops it with its own I/O and keeps its own error contract; no
  shared read/parse function. A full shared reader was rejected because it would
  put `PLUGIN_MANIFEST_VALIDATOR` in the version path, where a schema-invalid
  manifest currently still yields a tier-1 version.
  — **Reversibility:** reversible — one new leaf module and two loop bodies.

- **D-01-07:** The loop falls through on ABSENCE ONLY. The first candidate that
  EXISTS is the manifest, and the loop stops there. A present-but-unusable
  candidate does not hand off to the next one.

- **D-01-08:** Parse failure and schema rejection are the same rule -- both stop
  the loop and produce the existing `malformed plugin.json: <detail>` reason.
  There is no second concept distinguishing "not JSON" from "JSON that violates
  the schema".

- **D-01-09:** An unreadable present candidate (EACCES and friends) surfaces as
  `malformed plugin.json:`, not as a silent skip. In `readManifest` this is
  already today's behavior -- its `try` wraps the read, so an EACCES throw
  already lands on the malformed arm. The decision records it so the version
  reader's new loop matches rather than swallowing it.

- **D-01-10:** ROADMAP criterion 2 and MANF-04 stand UNAMENDED. A plugin
  shipping a malformed wrapped manifest and a valid bare one resolves
  `(unavailable)`; the bare file cannot change the outcome. This was chosen
  explicitly over a more forgiving "first parsable file wins" reading.

- **D-01-11:** `resolvePluginVersion` tier 1 stats each candidate before reading,
  mirroring `readManifest`'s `statKindOf(ctx)` gate, rather than branching on
  `err.code === "ENOENT"`. D-01-07 requires telling absent from unreadable, and
  two structurally identical loops are what the D-01-12 behavioral test asserts.
  This is a deliberate change from the current swallow-everything `catch`.

- **D-01-12:** Agreement is proved by a BEHAVIORAL test that plants a
  bare-manifest fixture on disk and asserts BOTH that the resolver honors it and
  that `resolvePluginVersion` returns its declared version. Not a source-grep or
  config-reading test. Matches the CONVENTIONS.md rule that a gate wants a test
  that plants the violation.

- **D-01-13:** MANF-05 needs no behavior change. `readManifest` already returns
  `{ ok: true, manifest: null }` on a stat miss, so a plugin with no manifest at
  either location still installs. Preserve that; do not make absence fatal.

#### Component-path normalization (MANF-03)

- **D-01-14:** The normalized form is
  `path.relative(pluginRoot, path.resolve(pluginRoot, raw))`.
  `validateComponentPath` already computes the `path.resolve` for its
  `assertPathInside` check, so this is one additional line and it canonicalizes
  `./` prefixes, trailing separators, interior `..` segments, and separator
  style in a single step. A string-level strip of `./` and trailing `/` was
  rejected for leaving `a/../skills` as a distinct key.

- **D-01-15:** The normalized form REPLACES the value stored in
  `componentPaths[kind]`, not just the `seenPaths` dedup key. These values are
  never printed to the user -- bridges join them for I/O and `info` enumerates
  them into component names (`info.ts:667-673`) -- so canonicalizing them has no
  user-visible byte consequence. One spelling per directory flows downstream.

- **D-01-16:** When `path.relative` returns the empty string (a plugin declaring
  `"."` or `"./"`, resolving to `pluginRoot` itself), store `"."`. This
  preserves today's stored byte; `path.join(root, ".")` and `path.join(root, "")`
  both yield `root`, and the array never holds an empty string.

- **D-01-17:** The dedup key stays CASE-SENSITIVE. `Skills` and `skills` remain
  distinct, as today. Case folding would collapse two genuinely distinct
  directories on Linux, and no known plugin declares a case-variant path -- the
  four bare-manifest plugins all declare lowercase `./skills/`.

#### Dependency source and parsing (DEPS-01, DEPS-02)

- **D-01-18:** `info` continues to read `dependencies` from the MARKETPLACE
  ENTRY only. It does not read the plugin's own `plugin.json` for this field,
  even though this phase makes a bare manifest readable. This preserves the
  warm/cold render symmetry rule the read surfaces already follow (OUT-05 /
  DOC-02, `domain/resolver.ts:653`): the entry is readable for every plugin
  regardless of clone state, so an unfetched `(remote)` plugin renders the same
  dependency list a cloned one does. It also avoids a THIRD independent manifest
  read -- the resolver deliberately does not carry the manifest on its result
  (D-23-02 / NFR-7), and `info` re-resolves independently (`info.ts:1300`).
  DEPS-01/02 are therefore purely the filter fix.
  — **Reversibility:** reversible — the source is one expression at
  `info.ts:838`.

- **D-01-19:** Phase 3 is EXPLICITLY FREE to read dependencies from
  `plugin.json` for resolution. D-01-18 is a display decision, not a project-wide
  source of truth. Display must render identically warm and cold; resolution
  already requires a materialized clone and can read the manifest freely.
  Phase 3 must not read D-01-18 as precedent binding its own source choice.

- **D-01-20:** Dependency PARSING extracts now into a new
  `extensions/pi-claude-marketplace/domain/dependencies.ts`, returning typed
  `{ name, version?, marketplace? }` entries. `info.ts` is reduced to rendering
  the parsed result. Phase 3 reuses this parser rather than writing a second one
  beside it. The fill-in of a missing marketplace (D-01-02, D-01-03) is a
  RENDER-time concern -- the caller supplies the declaring marketplace -- so the
  parser stays pure and Phase 3 can apply its own resolution semantics to the
  same parsed shape.

### Claude's Discretion

- Exact wording and placement of doc comments, and which requirement IDs each
  cites. Follow the house convention: cite durable spec IDs, never GSD phase or
  plan numbers.
- Whether `MANIFEST_CANDIDATES` is typed as nested string arrays or as
  pre-joined relative paths, so long as both readers consume the same export.
- Test file placement and naming within the existing `tests/` layout.
- Whether the `domain/dependencies.ts` parser exposes one function or a small
  pair (parse + render helper), so long as parsing is reusable by Phase 3 and
  the marketplace fill-in stays out of the parse step.

### Deferred Ideas (OUT OF SCOPE)

- **Case-variant component paths on case-insensitive filesystems.** A plugin
  declaring `"./Skills/"` alongside a real `skills/` directory still produces
  two keys and therefore duplicate warnings on macOS and Windows (D-01-17). No
  known plugin does this. Backlog it if it ever bites.
- **PDEP-01's other half.** Whether the "declares dependencies, install them
  manually" note should also reappear on `install` (dropped per D-19-01) and
  `list` (which reads resolver notes only for an `unavailable` plugin). DEPS-01
  and DEPS-02 name `info` and only `info`, and `.planning/REQUIREMENTS.md`
  scopes this phase to the display fix.
- **MIGR-01's staleness gate.** Named in REQUIREMENTS as a dependency of
  PROV-04, which is Phase 4. Nothing for this phase.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| MANF-01 | A plugin whose manifest sits at a bare `<pluginRoot>/plugin.json` has that manifest read and honored. | Both hardcoded call sites located and quoted verbatim (§Integration Seams items 1–2). Resolver side is testable through the in-memory `resolveContext` harness; version side needs real disk. Cross-reader test placement resolved (§Test Harness). |
| MANF-02 | When a plugin ships both manifest locations, the wrapped `.claude-plugin/plugin.json` wins. | Falls straight out of D-01-06's ordered constant plus D-01-07's absence-only fall-through. Assertable in the in-memory harness by seeding both paths. |
| MANF-03 | A plugin that declares `"./skills/"` and also ships a conventional `skills/` directory produces one component path, so installing it emits no duplicate-skill warning. | **Partially satisfied by the locked mechanism.** Executed against both witness shapes: `ui5` goes 8→0, `ui-theme-designer` stays at 2. See §Open Question OQ-1 and §Pitfall 1. |
| MANF-04 | A plugin whose bare `plugin.json` is malformed resolves `(unavailable)` with the existing `malformed plugin.json:` reason. | `readManifest`'s existing `try`/`catch` already produces the reason; the loop change only widens which file reaches it. Assertion pattern already in the suite (`tests/domain/resolver.test.ts:191`). |
| MANF-05 | A plugin with no manifest at either location still installs. | No behavior change (D-01-13). The `{ ok: true, manifest: null }` arm is quoted verbatim in §Integration Seams item 1. A regression test belongs in the resolver pair. |
| DEPS-01 | `info` shows a dependency declared as `{name, version, marketplace}`, including its version constraint. | Filter located and quoted; the declaring marketplace is already destructured in scope at the call site. Upstream element shapes pinned from the validated spike. |
| DEPS-02 | `info` shows every element of a dependency array that mixes bare strings and objects. | Same seam. Existing fixtures all use `@`-bearing bare strings, so D-01-03's pass-through keeps every current assertion byte-valid (§Existing Tests). |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Ordered manifest candidate list | `domain/` (new leaf `manifest-path.ts`) | — | A pure constant with no I/O; `domain/` is the layer both readers may import. `orchestrators/` → `domain/` is an allowed edge in both gates. |
| Manifest read + schema verdict (resolver side) | `domain/resolver.ts` | — | Owns `PLUGIN_MANIFEST_VALIDATOR` and the `{ ok:false, reason }` contract. Unchanged ownership. |
| Manifest read for version tier 1 | `orchestrators/plugin/shared.ts` | — | Deliberately kept out of `domain/` (D-01-06): it must NOT run the validator, or a schema-invalid manifest would stop yielding a tier-1 version. |
| Component-path normalization | `domain/resolver.ts` (`validateComponentPath`) | — | The `path.resolve` it needs is already computed there for the containment check. |
| Same-physical-directory skill dedup (OQ-1) | `bridges/skills/discover.ts` | — | The warning is produced there; the resolver cannot see that two distinct component paths reach one directory tree. |
| Dependency parsing | `domain/dependencies.ts` (new) | — | Pure, shape-only, reusable by Phase 3 (D-01-20). No marketplace knowledge. |
| Dependency rendering + marketplace fill-in | `orchestrators/plugin/info.ts` | `shared/notify.ts` (dumb renderer) | The declaring marketplace is an orchestrator-scope value; notify must stay a dumb renderer. |

## Project Constraints (from CLAUDE.md)

Actionable directives extracted from `./CLAUDE.md` and the two embedded
`.planning/codebase/` documents. All are binding on the plan.

| Directive | Source | Consequence for this phase |
|-----------|--------|----------------------------|
| Read a file before editing it; trace callers before modifying a function. | CLAUDE.md §Guidelines/General | Each task must name the file and the caller set it touched. |
| Never commit to `main`; feature work on `features/*`. | CLAUDE.md §Git | Already on `features/manifest` `[VERIFIED: git rev-parse --abbrev-ref HEAD → features/manifest]`. |
| Run `pre-commit run --all-files` BEFORE `git commit`; never `--no-verify`; never amend after a hook failure. | CLAUDE.md §Git | A pre-commit failure means the commit did not happen. Scoped `--files` runs hide pre-existing violations that CI's `--all-files` run will surface. |
| Conventional Commits; title 5–72 chars; body lines ≤ 80; no GSD milestone/phase mentions. | CLAUDE.md §Git | Applies to every task commit. |
| All disk mutations atomic (NFR-1). | CLAUDE.md §Constraints | Not engaged — this phase adds reads only. |
| Refuse to write outside the three scope-rooted locations (NFR-10). | CLAUDE.md §Constraints | Not engaged. The normalization strengthens the invariant (§Security Domain). |
| `npm run check` must stay green (NFR-6). | CLAUDE.md §Constraints | The full chain is larger than STACK.md documents — see §Pitfall 2. |
| All user-visible messages through `ctx.ui.notify` via `shared/notify.ts` (IL-2). | CLAUDE.md §Constraints | The dependency render decision lands in the orchestrator/parser; notify stays a dumb renderer. |
| English only, no telemetry. | CLAUDE.md §Constraints (IL-1, IL-4) | No new message catalog, no metrics. |
| Comments cite durable spec IDs (`D-NN`, `MANF-NN`, `NFR-N`), never `Phase NN` / `Plan NN` / `Wave N` / `Pitfall N`. | CLAUDE.md §Conventions + `.claude/rules/typescript-comments.md` | Every new doc comment must obey. |
| All exported functions need explicit return type annotations. | CONVENTIONS.md §Function Design | Both new modules. |
| Two independently-computed cognitive-complexity ceilings at 15 (ESLint `sonarjs/cognitive-complexity` and fallow `health.maxCognitive`); fallow adds `maxCyclomatic: 20`, `maxUnitSize: 60`. | CONVENTIONS.md §Function Design | Green ESLint is not evidence fallow is green. Keep the new loop bodies flat. |
| A gate wants a test that PLANTS the violation, not one that reads the config. | CONVENTIONS.md §Fallow | Directly restates D-01-12. |
| Named exports only; no default exports. | CONVENTIONS.md §Module Design | Both new modules. |
| Import order: builtin → external → internal → parent → sibling → index → object → type, blank line between groups, alphabetized case-insensitively, type-only imports last. | CONVENTIONS.md §Import Organization | Enforced by `import-x/order`. |

## Standard Stack

**No new packages.** This phase adds no dependency. Everything it needs is
already in the tree.

### Core (already present, used by this phase)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `typebox` | `^1.1.38` (dev + peer `*`) | `PLUGIN_MANIFEST_VALIDATOR` — the schema the manifest loop still runs (D-01-08) | Already the project's sole runtime-validation library `[VERIFIED: package.json devDependencies/peerDependencies]` |
| `node:test` | Node built-in | Test runner for every new and amended test | House rule: "Do not add another runner, assertion library, or mocking library." `[VERIFIED: .claude/rules/typescript-unit-testing.md:21]` |
| `node:assert/strict` | Node built-in | Assertions | Same rule |
| `strong-mock` | `^9.2.2` | Strict interaction mocks, when a collaborator needs one | Already a devDependency `[VERIFIED: package.json:27]`; not needed for this phase's fs-backed tests |
| `node:path`, `node:fs/promises` | Node built-in | `path.relative` / `path.resolve` for D-01-14; `stat` for D-01-11 | Already imported at both seams |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `path.relative(root, path.resolve(root, raw))` | String-level `./`-strip plus trailing-`/`-strip | Rejected in CONTEXT (D-01-14): leaves `a/../skills` a distinct key. Also loses separator normalization. |
| A shared read-and-parse function in `domain/` | — | Rejected in CONTEXT (D-01-06): would put the validator in the version path, changing tier-1 behavior for schema-invalid manifests. |
| A semver library for the `version` constraint | `semver` (new dep) | Not needed in this phase — the parser carries `version` as an opaque string and `info` renders it verbatim. `.planning/REQUIREMENTS.md:198-200` flags this as a Phase 3 decision: "There is no semver library in the dependency tree, and PL-5 compares versions as strings deliberately." |

**Installation:** none.

## Package Legitimacy Audit

This phase installs no external packages, so the registry-verification gate has
no target. No `npm view` / `pip index` / `cargo search` lookups were run and no
package is recommended.

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

If planning later decides a semver library is needed (it should not — that is
explicitly Phase 3 scope), the Package Legitimacy Gate must run first.

## Architecture Patterns

### System Architecture Diagram

```text
                 ┌──────────────────────────────────────┐
   marketplace   │  <pluginRoot>/.claude-plugin/         │  ← candidate 1
   clone /       │      plugin.json                      │
   plugin clone  │  <pluginRoot>/plugin.json             │  ← candidate 2 (NEW)
   on disk       └───────────────┬──────────────────────┘
                                 │  both readers loop the SAME ordered list
                 ┌───────────────┴───────────────────────────────┐
                 │                                               │
                 ▼                                               ▼
   ┌───────────────────────────────┐          ┌──────────────────────────────────┐
   │ domain/resolver.ts            │          │ orchestrators/plugin/shared.ts   │
   │   readManifest()              │          │   resolvePluginVersion() tier 1  │
   │   • statKindOf(ctx) per cand. │          │   • stat() per candidate (NEW)   │
   │   • stop at first EXISTING    │          │   • stop at first EXISTING       │
   │   • JSON.parse + VALIDATOR    │          │   • JSON.parse, read `.version`  │
   │   • fail ⇒ malformed reason   │          │   • fail ⇒ fall to tier 2        │
   └───────────────┬───────────────┘          └──────────────┬───────────────────┘
                   │ manifest ∪ entry                        │ version string
                   ▼                                         ▼
   ┌───────────────────────────────┐               install / update record
   │ collectStrictComponentKind()  │
   │   declared paths ─┐           │
   │   convention path ┘→ addComponentPath(seenPaths, relative)
   │                       ▲                                 │
   │            validateComponentPath returns the            │
   │            NORMALIZED relative (D-01-14/15)             │
   └───────────────┬───────────────────────────────────────┘ │
                   │ componentPaths.{skills,commands,agents}  │
        ┌──────────┼───────────────┬──────────────┐          │
        ▼          ▼               ▼              ▼          │
   skills/     commands/       agents/      info.ts          │
   discover    discover        (pickAgents  discoverComponent│
   (warnings)  (warnings)       SourceDir)  Names (Set-deduped)
        │
        └─► surfaceDiscoveryWarnings() → notifyDiagnostic  ← the MANF-03 surface


   ── DEPS path (independent of everything above) ────────────────────────────
   marketplace.json entry.dependencies : unknown
        │
        ▼
   domain/dependencies.ts (NEW, pure)      parse → [{ name, version?, marketplace? }]
        │
        ▼
   orchestrators/plugin/info.ts            fill in declaring marketplace,
                                           sort by NAME, render display strings
        │
        ▼
   shared/notify.ts  `    dependencies: <joined>`   (dumb renderer, unchanged)
```

### Recommended Project Structure

```text
extensions/pi-claude-marketplace/
├── domain/
│   ├── manifest-path.ts       # NEW — MANIFEST_CANDIDATES (D-01-06)
│   ├── dependencies.ts        # NEW — pure dependency-element parser (D-01-20)
│   └── resolver.ts            # readManifest loop; validateComponentPath normalize
├── orchestrators/plugin/
│   ├── shared.ts              # resolvePluginVersion tier-1 loop
│   └── info.ts                # normalizeDependencies → render over parsed entries
└── bridges/skills/
    └── discover.ts            # OQ-1: same-directory dedup (pending decision)

tests/
├── domain/
│   ├── manifest-path.test.ts  # NEW — MANDATORY pair (corresponding-test gate)
│   ├── dependencies.test.ts   # NEW — MANDATORY pair
│   └── resolver.test.ts       # amended
├── orchestrators/plugin/
│   ├── shared.test.ts         # amended (resolvePluginVersion describe block)
│   └── info.test.ts           # amended (dependency rendering)
├── bridges/skills/
│   └── discover.test.ts       # amended if OQ-1 is taken
└── architecture/
    └── <cross-reader>.test.ts # NEW — D-01-12 lives here, NOT under domain/
```

### Pattern 1: Ordered-candidate loop with an absence-only fall-through

**What:** iterate an ordered constant; `stat` each candidate; the first one that
exists terminates the loop regardless of whether it turns out usable.

**When to use:** both manifest readers (D-01-07, D-01-11).

**Why it is written this way here:** the existing `readManifest` already has the
right shape — a stat gate before the read, with the read inside a `try`. The
change is to wrap that in a loop and `continue` only on the stat miss.

```ts
// Source: extensions/pi-claude-marketplace/domain/resolver.ts:624-651 (current shape)
async function readManifest(
  ctx: ResolveContext,
  pluginRoot: string,
): Promise<{ ok: true; manifest: Record<string, unknown> | null } | { ok: false; reason: string }> {
  const manifestPath = path.join(pluginRoot, ".claude-plugin", "plugin.json");
  if ((await statKindOf(ctx)(manifestPath)) !== "file") {
    return { ok: true, manifest: null };
  }

  try {
    const raw = await readFileTextOf(ctx)(manifestPath);
    const parsed: unknown = JSON.parse(raw);

    if (!PLUGIN_MANIFEST_VALIDATOR.Check(parsed)) {
      const detail = PLUGIN_MANIFEST_VALIDATOR.Errors(parsed)
        .slice(0, 1)
        .map((error) => `${error.instancePath || "(root)"}: ${error.message}`)
        .join("");
      return { ok: false, reason: `malformed plugin.json: ${detail}` };
    }

    return { ok: true, manifest: parsed };
  } catch (err) {
    return {
      ok: false,
      reason: `malformed plugin.json: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}
```

`[VERIFIED: extensions/pi-claude-marketplace/domain/resolver.ts:624-651]` — the
`{ ok: true, manifest: null }` stat-miss arm quoted above is exactly the
behavior D-01-13 says to preserve for MANF-05, and the two `malformed plugin.json: `
strings are the ones D-01-08 / D-01-09 keep.

### Pattern 2: Normalize where the resolve already happens

`validateComponentPath` already computes the resolved candidate for its
containment check, one line above the return that currently hands back the raw
string:

```ts
// Source: extensions/pi-claude-marketplace/domain/resolver.ts:987-999
  const candidate = path.resolve(pluginRoot, raw);

  try {
    await assertPathInside(pluginRoot, candidate, `component path "${kind}"`);
  } catch (err) {
    if (err instanceof PathContainmentError) {
      return { ok: false, reason: `component path for "${kind}" escapes plugin root: "${raw}"` };
    }

    throw err;
  }

  return { ok: true, relative: raw };
```

`[VERIFIED: extensions/pi-claude-marketplace/domain/resolver.ts:987-999]`

D-01-14 replaces the final `raw` with `path.relative(pluginRoot, candidate)`,
with D-01-16's `""` → `"."` guard. Note that `assertPathInside` itself computes
the identical `path.relative(parent, child)` at
`extensions/pi-claude-marketplace/shared/path-safety.ts:90` (`const relative = path.relative(parent, child);`)
`[VERIFIED: extensions/pi-claude-marketplace/shared/path-safety.ts:90]`, and its
containment check is purely string-level — `if (!isPathInside(parent, child))`
at line 83 — with no `realpath`. So once the check passes, `path.relative` can
never return a `..`-leading value. The normalized form is contained by
construction.

### Pattern 3: Untrusted-field read through `as Record<string, unknown>`

Every consumer of a `Type.Unknown()` manifest/entry field in this codebase reads
it through an explicit widening cast rather than trusting the `Static<>` type:

```ts
// Source: extensions/pi-claude-marketplace/orchestrators/plugin/info.ts:838
  const dependencies = normalizeDependencies((entry as Record<string, unknown>).dependencies);
```

```ts
// Source: extensions/pi-claude-marketplace/domain/resolver.ts:1616-1620
function noteDeclaredDependencies(entry: PluginEntry, partial: PartialResolution): void {
  if ((entry as Record<string, unknown>).dependencies !== undefined) {
    partial.notes.push(`declares dependencies that must be installed manually`);
  }
}
```

`[VERIFIED: extensions/pi-claude-marketplace/orchestrators/plugin/info.ts:838]`
`[VERIFIED: extensions/pi-claude-marketplace/domain/resolver.ts:1615-1620]`

The resolver states the reason for this in its own doc comment: "the schema-level
guard does not survive the `as unknown` coercion that the resolver uses to read
untrusted entry / manifest fields"
`[VERIFIED: extensions/pi-claude-marketplace/domain/resolver.ts:948-955]`.

`domain/dependencies.ts` should therefore accept `unknown` at its boundary and
narrow internally — never accept `PluginEntry["dependencies"]` or any
schema-derived type. The schema itself keeps the field fully open on both shapes:

```ts
// Source: extensions/pi-claude-marketplace/domain/components/plugin.ts
  // optional dependencies (MM-2 / PI-13: opaque, surfaces as warning)
  dependencies: Type.Optional(Type.Unknown()),
```

`[VERIFIED: extensions/pi-claude-marketplace/domain/components/plugin.ts:82-83]`
(entry schema) and the same line in `PLUGIN_MANIFEST_SCHEMA`
`[VERIFIED: extensions/pi-claude-marketplace/domain/components/plugin.ts:104]`.

Note the header caveat the file carries: "TypeBox `Type.Optional` produces
`T | undefined` in Static<>, not `T?`. Use `=== undefined` checks downstream,
not `in`." `[VERIFIED: extensions/pi-claude-marketplace/domain/components/plugin.ts:11-12]`

### Pattern 4: Typed result objects, not thrown errors, on this path

CONTEXT already records it and the source confirms it: the manifest failure path
is the `{ ok: false, reason }` shape, not a `shared/errors.ts` class. Do not
introduce a typed error for MANF-04. The resolver's `unavailable` arm carries
the reason as a free-form note string; it is NOT narrowed into a closed reason
token (`shared/probe-classifiers.ts` has arms for `malformed hooks.json:` and
`malformed mcp reference` but none for `malformed plugin.json:`)
`[VERIFIED: extensions/pi-claude-marketplace/shared/probe-classifiers.ts:136,147]`.
No closed-set amendment is needed.

### Anti-Patterns to Avoid

- **Adding a `_setXForTest` seam to `resolvePluginVersion`.** CONVENTIONS.md
  §Function Design forbids test-only module holes; dependency injection is the
  house answer. D-01-11 does not ask `resolvePluginVersion` to adopt the
  resolver's `ctx` seams — it needs a real `stat`. Test it against real disk.
- **Exporting `defaultStatKind` from `domain/resolver.ts` so `shared.ts` can
  reuse it.** It is module-private today
  (`async function defaultStatKind(p: string): Promise<StatKind> {` at
  `extensions/pi-claude-marketplace/domain/resolver.ts:309`)
  `[VERIFIED: extensions/pi-claude-marketplace/domain/resolver.ts:309]`.
  Exporting it widens the resolver's public surface for one caller and drags a
  100%-branch-coverage obligation onto `tests/domain/resolver.test.ts` for a
  helper that already has full coverage only incidentally. `shared.ts` already
  imports `readFile` from `node:fs/promises`; add `stat` there.
- **Making manifest absence fatal.** D-01-13 / MANF-05. The `{ ok: true, manifest: null }`
  arm must survive.
- **Sorting the dependency array on the rendered string.** D-01-04 sorts on the
  name. The existing comparator is
  `(a, b) => a.localeCompare(b, undefined, { sensitivity: "base" })`
  `[VERIFIED: extensions/pi-claude-marketplace/orchestrators/plugin/info.ts:343]` —
  keep the same comparator options or existing fixture byte order shifts.
- **Suppressing the convention path when a declared path lives under it.** This
  looks like a fix for OQ-1 and is a data-loss regression — see §Pitfall 1.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Canonicalizing a declared relative path | A `./`-strip + trailing-`/`-strip string routine | `path.relative(root, path.resolve(root, raw))` | Handles interior `..`, separator style, and `.`/`` collapse in one step; the resolve is already computed. D-01-14 already rejected the string routine. |
| Telling "file absent" from "file present but unreadable" | `catch (err) { if (err.code === "ENOENT") … }` | A `stat`-then-read gate | D-01-11. The errno ladder has more members than ENOENT (ENOTDIR, ELOOP, ENAMETOOLONG) and misclassifying any of them breaks D-01-07. The resolver's `statKindOf` gate is the in-repo precedent. |
| Deciding whether a component path escapes the plugin root | A prefix `startsWith` check | `assertPathInside` (`shared/path-safety.ts`) | The single NFR-10 chokepoint; also refuses symlinked parent segments (D-14/D-16). Already called at the seam. |
| Validating manifest shape | Hand-rolled `typeof` ladders over the whole manifest | `PLUGIN_MANIFEST_VALIDATOR` | Already compiled and already produces the `<instancePath>: <message>` detail the reason string embeds. |
| Semver range comparison | A regex range matcher | Nothing — carry `version` as an opaque string | Phase 1 only displays it. `.planning/REQUIREMENTS.md:198-200` reserves the decision for Phase 3. |
| Deduping two component paths that reach the same directory | Path-string cleverness in the resolver | An identity check on the resolved directory in the bridge | The resolver cannot know that `skills/help` and `skills` overlap on disk; the bridge already holds both resolved paths. See OQ-1. |

**Key insight:** every primitive this phase needs already exists in the tree at
the exact seam that needs it. The work is plumbing, not construction — which is
why the gates, not the algorithms, are where the plan can go wrong.

## Test Harness: what exists and what must be added

This answers the planner's question 1 directly.

### There is no shared `tests/helpers/` directory

`.planning/codebase/STACK.md` and `CONVENTIONS.md` both reference
`tests/helpers/credential-mock.ts`, `makeMockGitOps`, and `withHermeticHome` as
if a shared helper package existed. **It does not.**
`[VERIFIED: ls tests → architecture, bridges, domain, e2e, edge, fixtures, index.test.ts, integration, live-uat, orchestrators, persistence, platform, shared, transaction]`
There is no `tests/helpers/` path. Those documents describe a layout the v1.19
unit-test refactor removed. Treat them as stale on this point.

### `withHermeticHome` is a per-file local helper, duplicated

There is no exported `withHermeticHome`. Each suite defines its own:

- `tests/architecture/cross-op-convergence.test.ts:89` —
  `async function withHermeticHome<T>(fn: (env: { cwd: string }) => Promise<T>): Promise<T>`
- `tests/integration/transaction-lifecycle-cascade.test.ts:45` —
  `async function withHermeticHome<T>(fn: () => Promise<T>): Promise<T>`
- `tests/orchestrators/plugin/info.test.ts:272` —
  `async function withHermeticHome<T>(fn: (env: { home: string; cwd: string }) => Promise<T>): Promise<T>`

`[VERIFIED: grep -rn "withHermeticHome" tests]`. The three signatures differ.
The info.test.ts variant swaps `process.env.HOME` to a `mkdtemp` dir, creates a
separate `cwd` tmpdir, drains `pendingInteractionVerifications`, and cleans both
up in a `finally`
`[VERIFIED: tests/orchestrators/plugin/info.test.ts:272-295]`.

**Planning consequence:** a new test file needing hermetic HOME writes its own
local copy. That is the established pattern; do not try to extract a shared one
in this phase (it would touch every consumer and add duplication surface).

### `seedPathMarketplace` is also per-file, and CANNOT plant a plugin manifest

Two independent local definitions exist:

- `tests/orchestrators/marketplace/update.test.ts:1077` — minimal: seeds a
  state.json marketplace record pointing at an on-disk dir, plus an optional
  autoupdate config entry. No plugin tree at all.
- `tests/orchestrators/plugin/info.test.ts:351` — rich: writes
  `<mpRoot>/.claude-plugin/marketplace.json`, calls `materializeMarketplaceTree`,
  builds installed records, merges into state.json.

The one genuinely shared fixture module is
`tests/edge/handlers/marketplace-seed.ts`, which exports
`buildInstalledPluginRecord`, `mergeMarketplaceIntoState`, `seedAutoupdateConfig`,
and `materializeMarketplaceTree`
`[VERIFIED: tests/edge/handlers/marketplace-seed.ts:52,80,102,137]`.

**`materializeMarketplaceTree` writes exactly three things and no manifest:**

```ts
// Source: tests/edge/handlers/marketplace-seed.ts:137-155
export async function materializeMarketplaceTree(
  mpRoot: string,
  tree: {
    readonly installablePluginDirs?: readonly string[];
    readonly componentDirs?: Record<string, readonly string[]>;
    readonly componentFiles?: Record<string, readonly string[]>;
  },
): Promise<void> {
  for (const rel of tree.installablePluginDirs ?? []) {
    await mkdir(path.join(mpRoot, rel), { recursive: true });
  }

  for (const [pluginDir, components] of Object.entries(tree.componentDirs ?? {})) {
    for (const c of components) {
      await mkdir(path.join(mpRoot, pluginDir, c), { recursive: true });
    }
  }

  for (const [pluginDir, files] of Object.entries(tree.componentFiles ?? {})) {
    for (const rel of files) {
      const abs = path.join(mpRoot, pluginDir, rel);
      await mkdir(path.dirname(abs), { recursive: true });
      await writeFile(abs, "", "utf8");
    }
  }
}
```

`[VERIFIED: tests/edge/handlers/marketplace-seed.ts:137-155]`

So the answers to the planner's sub-questions:

- **Can it place a bare `<pluginRoot>/plugin.json`?** Only as an *empty* file, via
  `componentFiles`. An empty file is not valid JSON, so it plants a MANF-04
  negative fixture and nothing else.
- **Can it write a plugin-side manifest at all?** No. The only helper in the tree
  that writes a `plugin.json` is `seedWarmMirror` in `info.test.ts`, and it hard-codes
  the wrapped path:
  `await writeFile(path.join(mirrorDir, ".claude-plugin", "plugin.json"), JSON.stringify(opts.pluginJson), "utf8");`
  `[VERIFIED: tests/orchestrators/plugin/info.test.ts:424-428]` — and it is
  git-mirror-only (it runs `git.init` / `git.add` / `git.commit` right after).

**Planning consequence:** the plan must add manifest-planting capability. Two
viable shapes, both acceptable under the CONTEXT "test file placement and naming"
discretion:

1. Extend `materializeMarketplaceTree` with a `pluginManifests?: Record<string, { rel: string; json: unknown }>`
   option. Touches one shared file used by three suites; each caller keeps
   working because the option is optional.
2. Write the manifest inline in the new test with a plain `writeFile`. Lower
   blast radius; the cross-reader test needs only one plugin tree.

Recommendation: option 2 for the D-01-12 test, option 1 only if two or more
suites end up needing it.

### Manifest-shaped fixtures that already exist

- `tests/fixtures/` holds only hooks JSON and two directories (`bad-imports`,
  `import-command`) `[VERIFIED: ls tests/fixtures]`. No plugin.json fixtures.
- `tests/domain/fixtures/` exists; the resolver suite loads fixtures with
  `function fixture(name: string): Promise<string>` reading
  `tests/fixtures/<name>.json`
  `[VERIFIED: tests/domain/resolver.test.ts:73-76]`.
- The resolver suite's primary mechanism is **not** files on disk. It is an
  in-memory `ResolveContext`:

```ts
// Source: tests/domain/resolver.test.ts:37-66
function resolveContext(
  marketplaceRoot: string,
  files: Record<string, "dir" | "file" | { contents: string }>,
): ResolveContext {
  return {
    marketplaceRoot,
    statKind(p: string): Promise<"file" | "dir" | null> { … },
    readFileText(p: string): Promise<string> { … },
  };
}
```

`[VERIFIED: tests/domain/resolver.test.ts:37-66]`. The map keys are absolute
paths. So MANF-01/02/04/05 on the **resolver** side are cheap: seed
`path.join(localRoot, "plugin.json")` and/or
`path.join(localRoot, ".claude-plugin", "plugin.json")` in the `files` map. The
harness's `"file"` value (no `contents`) makes `readFileText` reject with a
synthetic `ENOENT`-coded error — a ready-made D-01-09 unreadable-present fixture.

`resolvePluginVersion`, by contrast, has no seam and reads real disk
(`const raw = await readFile(manifestPath, "utf8");`)
`[VERIFIED: extensions/pi-claude-marketplace/orchestrators/plugin/shared.ts:922]`.
Its existing tests use a `withTempScopes` wrapper and real `mkdir`/`writeFile`
`[VERIFIED: tests/orchestrators/plugin/shared.test.ts:1261-1352]`.

### Where the D-01-12 cross-reader test must live

`resolveStrict` runs against real disk when no seams are injected
(`ctx.statKind ?? defaultStatKind`, `ctx.readFileText ?? ((p) => readFile(p, "utf8"))`)
`[VERIFIED: extensions/pi-claude-marketplace/domain/resolver.ts:331-337]`. I
confirmed this empirically: my probe called
`resolveStrict(entry, { marketplaceRoot: mpRoot })` with no seams against a real
`mkdtemp` tree and got a populated `installable` result (§Empirical Verification).

So a single test file can drive both readers against one planted fixture. But it
**cannot** be a new file under `tests/domain/` or `tests/orchestrators/` — see
Pitfall 3. Put it in `tests/architecture/`.

## Common Pitfalls

### Pitfall 1: Normalization does not close MANF-03 for `ui-theme-designer`

**What goes wrong:** the plan implements D-01-14 / D-01-15, all resolver tests
go green, and ROADMAP criterion 3 still fails on one of its two named witnesses.

**Why it happens:** normalization collapses a declared path against the
convention path only when the two spell the *same* directory. `ui5` declares
`"./skills/"`, which normalizes to `"skills"` — identical to the convention path,
so `seenPaths` dedups it. `ui-theme-designer` declares `"./skills/<name>"`, which
normalizes to `"skills/<name>"` — a genuinely different key from `"skills"`, so
both survive, and the convention path re-enumerates the very directories the
declarations already named. The generated names collide and the bridge warns.

**Evidence (executed against the real modules this session):**

| Fixture | `componentPaths.skills` | warnings |
|---|---|---|
| `["./skills/"]`, 3 skill dirs, plugin `ui5` (today) | `["./skills/","skills"]` | **3** (one per dir; the real `ui5` has 8) |
| `["skills"]` normalized, same tree | `["skills"]` | **0** ✅ |
| `["./skills/help","./skills/tokens"]`, plugin `ui-theme-designer` (today) | `["./skills/help","./skills/tokens","skills"]` | **2** |
| `["skills/help","skills/tokens"]` normalized, same tree | `["skills/help","skills/tokens","skills"]` | **2** ❌ |

**How to avoid:** resolve OQ-1 before the plan locks. The recommended fix is a
same-resolved-directory dedup in `bridges/skills/discover.ts`, checked *before*
the generated-name warning: if the incoming skill directory resolves to the same
absolute path as the recorded winner's `skillDir`, it is literally the same skill
reached twice — skip silently, no warning. Different directories that merely
elide to the same generated name keep today's warning (D-141-04 semantics
preserved).

I verified this fix is surgical: all four existing collision tests in
`tests/bridges/skills/discover.test.ts` involve *distinct* directories
(`winning-parent/acme-shared` vs `losing-parent/shared` at line 283;
`<root>/implement` vs `<root>/skills/implement` at line 321), so a
same-directory check does not touch them
`[VERIFIED: tests/bridges/skills/discover.test.ts:283-320,321-357]`.

**Warning signs:** a plan that lists only `domain/resolver.ts` under MANF-03 and
asserts the criterion through resolver `componentPaths` shape alone.

### Pitfall 2: `npm run check` is a longer chain than the codebase docs say

**What goes wrong:** the plan budgets for "typecheck, lint, fallow, format, test,
integration" (what `.planning/codebase/CONVENTIONS.md` documents) and is blindsided
by three extra gates that fire before the test suites.

**The actual chain:**

```text
check = npm run typecheck && npm run lint && npm run fallow && npm run format:check
     && npm run test:corresponding && npm run test:corresponding:negative
     && npm run test:coverage:direct:negative && npm test && npm run test:integration
```

`[VERIFIED: package.json scripts.check]`

`test:corresponding` is the pairing gate (Pitfall 3). `test:corresponding:negative`
and `test:coverage:direct:negative` are meta-tests of the two gate scripts and
are unaffected by this phase. Baseline confirmed green:
`npm run test:corresponding` → `Corresponding-test gate passed.` `EXIT=0`
`[VERIFIED: executed 2026-09-12]`.

`npm run lint` also covers `scripts` now
(`lint = eslint extensions tests scripts eslint.config.js`)
`[VERIFIED: package.json scripts.lint]`.

**How to avoid:** every plan task that creates a production module must create
its paired test in the same task, or `check` fails at the fifth link, before any
test runs.

### Pitfall 3: The corresponding-test gate dictates where new files may live

**What goes wrong:** the D-01-12 cross-reader test is written as
`tests/domain/manifest-agreement.test.ts` (or anything similar) and `check` fails
with `unexpected-test`.

**The rule, read out of the gate script:**

```js
// Source: scripts/check-corresponding-tests.mjs:10
const nonCorrespondingRoots = new Set(["architecture", "e2e", "integration"]);
```

`[VERIFIED: scripts/check-corresponding-tests.mjs:10]`

Two directions are enforced
`[VERIFIED: scripts/check-corresponding-tests.mjs:134-171]`:

1. For every `extensions/pi-claude-marketplace/**/*.ts`, `tests/<mirror>.test.ts`
   must exist (`missing-test`) **and must import that exact source path**.
   Reaching the pair only through a re-exporting proxy is also a violation
   (`proxy-owned`), not an escape hatch — both branches push to `violations`.
2. For every `tests/**/*.test.ts` whose first path segment is NOT in
   `nonCorrespondingRoots`, the mirrored production module must exist
   (`unexpected-test`).

**Consequences for this phase:**

- `domain/manifest-path.ts` ⇒ `tests/domain/manifest-path.test.ts` importing it
  directly. **Mandatory.**
- `domain/dependencies.ts` ⇒ `tests/domain/dependencies.test.ts` importing it
  directly. **Mandatory.**
- The D-01-12 cross-reader test ⇒ `tests/architecture/…test.ts`. Precedent:
  `tests/architecture/cross-op-convergence.test.ts` and
  `cross-surface-reason-parity.test.ts` are exactly this kind of multi-module
  behavioral test.
- Non-`.test.ts` helper modules inside a corresponding root are *not* checked —
  `tests/architecture/source-scan.ts`, `tests/orchestrators/plugin/scope-tree-inventory.ts`,
  and `tests/edge/handlers/marketplace-seed.ts` all exist
  `[VERIFIED: ls tests/architecture, ls tests/orchestrators/plugin, ls tests/edge/handlers]`.
  A shared fixture helper is legal; a shared `.test.ts` is not.

### Pitfall 4: A new test file must land inside the `npm test` glob

**What goes wrong:** a test lands somewhere the glob does not reach; it never
runs, and a second architecture test fails.

The glob is a brace alternation:

```text
"tests/{architecture,bridges,domain,edge,orchestrators,persistence,platform,shared,transaction}/**/*.test.ts" "tests/index.test.ts"
```

`[VERIFIED: package.json scripts.test]`

`tests/architecture/unit-suite-glob-completeness.test.ts` asserts both `test` and
`test:coverage:unit` match *exactly* the set of `.test.ts` files on disk outside
`e2e`/`integration` — via `assert.deepStrictEqual(matchedPaths, expectedPaths)`
`[VERIFIED: tests/architecture/unit-suite-glob-completeness.test.ts:31,96-121]`.
`architecture` and `domain` are both in the alternation, so the placements
recommended above are safe with no script edit.

### Pitfall 5: The `dependencies` name collides with an unrelated notify concept

**What goes wrong:** a task edits the wrong `dependencies` field.

`shared/notify.ts` has two:

- `readonly dependencies: readonly Dependency[]` on `installed | updated | reinstalled | present`
  — the **soft-dependency probe targets**, a closed set of two
  (`agents` → `pi-subagents`, `mcp` → `pi-mcp-adapter`)
  `[VERIFIED: docs/messaging-style-guide.md:61,67]`.
- `readonly dependencies?: readonly string[];` on `PluginInfoComponentsResolved`
  — the **plugin dependency display strings** this phase changes
  `[VERIFIED: extensions/pi-claude-marketplace/shared/notify.ts:1524]`.

The catalog-UAT fixtures are full of `dependencies: []` and
`dependencies: ["agents", "mcp"]` entries that are the *soft-dep* field
`[VERIFIED: tests/architecture/catalog-uat.test.ts:381,494,502,510]`. Do not
touch them.

The renderer this phase feeds is one line:

```ts
// Source: extensions/pi-claude-marketplace/shared/notify.ts:3563-3565
  if (dependencies !== undefined && dependencies.length > 0) {
    lines.push(`    dependencies: ${dependencies.join(", ")}`);
  }
```

`[VERIFIED: extensions/pi-claude-marketplace/shared/notify.ts:3563-3565]`

Its interface doc comment says the line renders "in `<plugin>@<marketplace>` form"
`[VERIFIED: extensions/pi-claude-marketplace/shared/notify.ts:1504-1508]` — that
comment needs updating for D-01-01, but the code does not.

### Pitfall 6: The output catalog is gated in both directions

**What goes wrong:** a new byte form (`<name>@<mp> (<version>)`) ships with no
catalog entry, or a catalog entry ships with no fixture.

`tests/architecture/catalog-uat.test.ts` runs a forward walk (every
`<!-- catalog-state: STATE -->` must pair byte-equal with a `FIXTURES` entry
driven through the real `notify()`) *and* an inverse walk (every `FIXTURES`
`(section,state)` must have a catalog annotation, else `[ORPHAN FIXTURE]`)
`[VERIFIED: tests/architecture/catalog-uat.test.ts:5228,5372-5409]`.

The existing state is byte-safe under D-01-03: its fixture array is
`dependencies: ["helper@utils-mp"]`-shaped and every element already contains
`@`, so the fill-in rule leaves it verbatim. Adding coverage for the object shape
means adding **both** a `<!-- catalog-state: … -->` block under
`## /claude:plugin info <plugin>@<marketplace>` in `docs/output-catalog.md`
**and** a matching `FIXTURES` entry — in the same task, or one of the two walks
fails.

Markdown is formatted by `mdformat` + `markdownlint-cli2` in pre-commit, **not**
prettier (`format:check` covers only `js,json,ts` plus `scripts/**/*.mjs`)
`[VERIFIED: package.json scripts["format:check"]]`.

### Pitfall 7: Two structurally identical loops may register as a clone

**What goes wrong:** D-01-11 asks for "two structurally identical loops" and
`fallow dupes --fail-on-issues` is in the chain.

The gate is a **percentage**, not an occurrence count: `--threshold` is
documented as "Fail if duplication exceeds this percentage (0 = no limit)"
`[VERIFIED: npx fallow dupes --help]`, and `.fallowrc.json` sets
`"duplicates": { "ignoredClones": ["dup:cc950b18:2", "dup:6d8c002d:2"], "threshold": 3 }`
`[VERIFIED: .fallowrc.json]`.

Baseline measured this session: `✗ 887 lines (1.3%) duplicated across 40 files`,
and `npm run fallow` exits 0 `[VERIFIED: executed 2026-09-12 — npm run fallow → EXIT=0]`.
`fallow health` is also clean: `✗ 0 above threshold · 11144 analyzed · maintainability 92.3 (good)`
`[VERIFIED: executed 2026-09-12]`.

Headroom is comfortable (1.3% of 3%) and the two loop *bodies* diverge sharply
(validator + reason string vs. a `.version` string extraction), so the risk is
low. Re-run `npm run fallow` after the change rather than assuming.

**Note on `production: false`:** `.fallowrc.json` sets it deliberately, which
means test files stay in the analysis graph and an export consumed only by tests
does not read as dead. Do not propose flipping it.

## Runtime State Inventory

This phase is a read-path change. It writes nothing new to disk and changes no
persisted byte. Each category was checked explicitly.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | **None.** `componentPaths` is never persisted. The install record's `resources` axes hold generated component NAMES, not source paths — `grep -rn "componentPaths" extensions/…/install.ts extensions/…/reconcile/ extensions/…/persistence/` returns only three comment hits in `install.ts` (lines 754, 773, 850) and zero in `persistence/` or `reconcile/` `[VERIFIED: grep, 2026-09-12]`. Normalizing the stored value therefore cannot change `state.json`. | none |
| Live service config | **None.** No external service holds a manifest path or a component path. | none |
| OS-registered state | **None.** No OS registration references either. | none |
| Secrets / env vars | **None.** The phase touches no env var. `PI_CODING_AGENT_DIR`, `TEST_CONCURRENCY`, and `PI_CM_E2E_REF` are unaffected. | none |
| Build artifacts | **None.** No build step exists (`tsc --noEmit`; Node runs `.ts` natively) `[VERIFIED: package.json scripts.typecheck, tsconfig.json noEmit]`. Nothing is compiled or installed that could carry a stale value. | none |

One consequence worth stating positively: because `componentPaths` values are
ephemeral (recomputed on every resolve), D-01-15's replacement of the stored
value needs **no** migration and cannot desynchronize an existing install.

## Existing Tests That Assert Current Behavior

This answers the planner's question 2.

### `readManifest` — `tests/domain/resolver.test.ts`

Every manifest-bearing fixture in this suite seeds the **wrapped** path, so none
of them changes meaning under an ordered-candidate loop whose first candidate is
the wrapped path. 30+ call sites of the form
`path.join(localRoot, ".claude-plugin", "plugin.json")`
`[VERIFIED: grep -n "plugin.json" tests/domain/resolver.test.ts]`, including:

- `:176` `test("PR-2(4) malformed plugin.json -> notInstallable", …)` — the
  MANF-04 assertion template:
  `assert.ok(resolvedPlugin.notes.some((n) => n.includes("malformed plugin.json")))` at `:191`.
- `:1106-1108` — the D-101-09 comment "no `plugin.json` on disk -- `readManifest`
  reports `manifest: null`" and
  `test("DFEN-02 entry silent + no plugin.json on disk -> installable carrying true", …)`.
  **This is the MANF-05 guard.** Under the loop it must still pass: with neither
  candidate present, both stats miss, and the function returns
  `{ ok: true, manifest: null }`.
- `:940-1078` — the five entry-vs-manifest `defaultEnabled` precedence tests.
  Unchanged.

**Additions needed:** bare-path-honored, wrapped-wins-over-bare, malformed-bare,
and the D-01-09 unreadable-present case (seed the candidate as bare `"file"` in
the `files` map so `readFileText` rejects).

### `resolvePluginVersion` tier 1 — `tests/orchestrators/plugin/shared.test.ts:1261-1352`

Five tests in a `describe("resolvePluginVersion")` block, all seeding the wrapped
path on real disk:

| Line | Test | Behavior under the new loop |
|---|---|---|
| 1262 | prefers a non-empty plugin manifest version over the marketplace entry | unchanged (wrapped is candidate 1) |
| 1281 | uses the marketplace entry when the manifest version is not a string | unchanged |
| 1302 | uses the marketplace entry when the manifest version is empty | unchanged |
| 1323 | uses the marketplace entry when the manifest cannot be parsed (`writeFile(…, "{")`) | unchanged, and it becomes a D-01-07 witness: the present-but-unparseable wrapped candidate must NOT hand off to the bare path |
| 1343 | uses the content hash when neither declaration has a usable version | unchanged (both candidates absent → tier 2 → tier 3, `"hash-e3b0c44298fc"`) |

`[VERIFIED: tests/orchestrators/plugin/shared.test.ts:1261-1352]`

**Additions needed:** bare-manifest tier-1 hit; wrapped-wins-over-bare;
present-but-malformed-wrapped does not fall through to a valid bare file.

### `addComponentPath` / `componentPaths` values — `tests/domain/resolver.test.ts`

Every existing `componentPaths` assertion uses an **already-canonical** value, so
D-01-14 is a no-op for all of them:

| Line | Asserted value |
|---|---|
| 1718, 1855, 2502, 2699, 3196 | `["skills"]` |
| 1744 | `["custom", "skills"]` |
| 2532 | `["custom/skills"]` |
| 2564 | `["custom/skills", "skills"]` |
| 2605 | `["entry-only", "shared", "manifest-only"]` |
| 3197 | `["commands"]` |
| 3231 | `["a", "b"]` |

`[VERIFIED: grep -n "componentPaths" tests/domain/resolver.test.ts]`

The only non-canonical declared paths in the whole test tree are
`tests/domain/components/plugin.test.ts:91-92` (`skills: ["./skills"]`,
`commands: "./commands"`) — but that suite tests the typebox schema only and
never reaches the resolver `[VERIFIED: grep across tests/]`. Also unaffected:
`tests/domain/resolver.test.ts:1615` (`skills: "../outside"`, escape rejection),
`:1637` (`[42]`, non-string), `:1655` (`[["skills"]]`, nested array), and `:3438`
(`["/absolute/skills"]`, absolute rejection) — all reject *before* the return
D-01-14 changes.

**Additions needed:** normalization tests for `"./skills/"` → `"skills"`,
`"a/../skills"` → `"skills"`, and D-01-16's `"."`/`"./"` → `"."`.

### `normalizeDependencies` — `tests/orchestrators/plugin/info.test.ts`

| Line | Test | Behavior under DEPS-01/02 |
|---|---|---|
| 1481 | object-shaped `dependencies` field omits the line — the value is `{ foo: "1.0.0", bar: "2.0.0" }`, an **object, not an array of objects** | **stays correct, must not be deleted.** The new rule still requires an array. |
| 1517 | empty `dependencies: []` omits the line | stays correct |
| 1601 | `dependencies: ["helper@utils-mp", "another@aux"]` → `"    dependencies: another@aux, helper@utils-mp"` | byte-preserved: both strings contain `@`, so D-01-03 passes them through, and sorting by name equals sorting by display string |
| 6944 | `["zulu@mp", "bravo@mp"]` → `"    dependencies: bravo@mp, zulu@mp"` | byte-preserved |
| 4669, 4772, 4955 | `["dep@mp"]` | byte-preserved |

`[VERIFIED: grep -n "dependencies" tests/orchestrators/plugin/info.test.ts]`

Every existing fixture uses `@`-bearing bare strings. **No existing assertion
changes byte form.** That is a strong argument for D-01-03's `@`-gated fill-in
rule and worth stating in the plan as a regression-safety property.

### The skills bridge collision tests — `tests/bridges/skills/discover.test.ts`

Four warning-bearing tests, all with distinct directories on both sides
(`:246` within one parent, `:283` across parents, `:321` self-vs-parent, `:362`
self-skill loss) `[VERIFIED: grep -n "^test" tests/bridges/skills/discover.test.ts]`.
None is affected by a same-resolved-directory dedup (OQ-1).

### Baseline

`node --test tests/domain/resolver.test.ts tests/bridges/skills/discover.test.ts tests/orchestrators/plugin/shared.test.ts` →
`tests 244 / pass 244 / fail 0` `[VERIFIED: executed 2026-09-12]`.

## Gate Analysis for the Two New Modules

This answers the planner's question 3.

| Gate | Verdict for `domain/manifest-path.ts` and `domain/dependencies.ts` |
|---|---|
| `.fallowrc.json` `boundaries.zones` | Both land inside the existing `domain` zone glob `"extensions/pi-claude-marketplace/domain/**"`. No zone edit needed. `[VERIFIED: .fallowrc.json boundaries.zones]` |
| `.fallowrc.json` `boundaries.rules` | `{ "from": "domain", "allow": ["shared", "platform"] }` — `manifest-path.ts` imports nothing (or `node:path`); `dependencies.ts` imports nothing. Consumers: `{ "from": "orchestrators", "allow": [… "domain" …] }` covers both `shared.ts` and `info.ts`. `[VERIFIED: .fallowrc.json boundaries.rules]` |
| ESLint `import-x/no-restricted-paths` | Folder-level; `domain` is a permitted target for `orchestrators`. `orchestrators/plugin/shared.ts` already imports `../../domain/version.ts` `[VERIFIED: extensions/pi-claude-marketplace/orchestrators/plugin/shared.ts:19]`. |
| `tests/architecture/import-boundaries.test.ts` | Asserts the rule defines **exactly 8 zones (one per folder)** `[VERIFIED: tests/architecture/import-boundaries.test.ts:270-282]`. Adding files inside an existing folder does not change the count. **No amendment needed.** |
| `fallow dead-code` | Both modules' exports are imported from production code reachable from `index.ts`, so no `unused-export`. `production: false` additionally keeps test-only consumers counted. |
| `fallow health` | New functions must stay under `maxCognitive: 15`, `maxCyclomatic: 20`, `maxUnitSize: 60`. A candidate loop and a shape-narrowing parser are well inside. |
| `fallow dupes` | See Pitfall 7. |
| `scripts/check-corresponding-tests.mjs` | **Each new module needs a paired test importing it directly.** This is the binding constraint. |
| `tests/architecture/manifest-read-seam.test.ts` | Scans for `readFile`/`fs.readFile` within 400 chars of the literal `marketplace.json`, allowing only `domain/manifest.ts` `[VERIFIED: tests/architecture/manifest-read-seam.test.ts:32-34,39-43]`. **This phase reads `plugin.json`, not `marketplace.json`** — the regex cannot match. No conflict. Do not confuse the two files: the seam gate is about the marketplace manifest. |
| `tests/architecture/compat-01-no-expansion.test.ts` | Pins the install-record key set and four closed sets. This phase adds no record field. Not engaged (Phase 4's PROV-01 is what trips it). |
| `tests/architecture/catalog-uat.test.ts` | Engaged only if a new catalog state is added — see Pitfall 6. |
| `tests/architecture/notify-grammar-invariant.test.ts` | Applies to error/warning-severity emissions only; "Info-severity emissions … are exempt" `[VERIFIED: tests/architecture/notify-grammar-invariant.test.ts:19-20]`. `plugin-info` success rows are info-severity. Not engaged. |
| `tests/architecture/partial-vocabulary-guard.test.ts` | Guards the retired `force`/`unsupported` vocabulary. No overlap. |
| `tests/architecture/unit-suite-glob-completeness.test.ts` | Both `domain` and `architecture` are inside the `npm test` glob alternation. No script edit. |

## Code Examples

### Reader 1 — `domain/resolver.ts::readManifest` (the seam, current bytes)

Quoted in full under Pattern 1. The one line that becomes a loop:

```ts
// Source: extensions/pi-claude-marketplace/domain/resolver.ts:628
  const manifestPath = path.join(pluginRoot, ".claude-plugin", "plugin.json");
```

### Reader 2 — `orchestrators/plugin/shared.ts::resolvePluginVersion` tier 1 (current bytes)

```ts
// Source: extensions/pi-claude-marketplace/orchestrators/plugin/shared.ts:914-940
export async function resolvePluginVersion(
  entry: PluginEntry,
  installable: MaterializablePlugin,
): Promise<string> {
  // Tier 1: the plugin's own plugin.json `version`. Re-read in place; any
  // failure falls through to the next tier (D-23-02 / D-23-03).
  try {
    const manifestPath = path.join(installable.pluginRoot, ".claude-plugin", "plugin.json");
    const raw = await readFile(manifestPath, "utf8");
    const parsed: unknown = JSON.parse(raw);
    const pluginJsonVersion = (parsed as { version?: unknown }).version;
    if (typeof pluginJsonVersion === "string" && pluginJsonVersion.length > 0) {
      return pluginJsonVersion;
    }
  } catch {
    // Fall through -- plugin.json is absent, unparseable, or carries no usable
    // version; tier 2 / tier 3 cover it.
  }

  // Tier 2: the marketplace entry version.
  if (typeof entry.version === "string" && entry.version.length > 0) {
    return entry.version;
  }

  // Tier 3: PI-7 content hash (last resort, unchanged).
  return computeHashVersion(installable.pluginRoot);
}
```

`[VERIFIED: extensions/pi-claude-marketplace/orchestrators/plugin/shared.ts:914-940]`

Its only two callers are `install.ts` and `update.ts`, both passing a
`MaterializablePlugin`, so it runs only after the resolver already produced a
materializable verdict (CONTEXT records this; the signature above confirms the
parameter type).

### The dedup and the additive convention path

```ts
// Source: extensions/pi-claude-marketplace/domain/resolver.ts:1002-1014
function addComponentPath(
  partial: PartialResolution,
  kind: SupportedPathKind,
  seenPaths: Set<string>,
  relative: string,
): void {
  if (seenPaths.has(relative)) {
    return;
  }

  seenPaths.add(relative);
  partial.componentPaths[kind].push(relative);
}
```

```ts
// Source: extensions/pi-claude-marketplace/domain/resolver.ts:1034-1062
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

`[VERIFIED: extensions/pi-claude-marketplace/domain/resolver.ts:1002-1014,1034-1062]`

Note the ordering: entry paths, then manifest paths, then the convention path.
CONTEXT is right that the added `kind` string is already canonical, so no logic
change is needed there once the declared values are normalized.

There is a **loose-mode sibling**, `collectLooseComponentKind` at
`extensions/pi-claude-marketplace/domain/resolver.ts:1396`, which reads only
`fromEntry`, pushes a conflict note when the manifest declares a kind the entry
does not, and adds **no** convention path
`[VERIFIED: extensions/pi-claude-marketplace/domain/resolver.ts:1396-1436]`. It
goes through the same `addValidatedComponentPath`, so it inherits normalization
automatically. Worth naming in the plan so the change is not mistaken for
strict-only.

### Where the duplicate-skill warning is produced (MANF-03's assertion point)

```ts
// Source: extensions/pi-claude-marketplace/bridges/skills/discover.ts:77-90
function duplicateWarning(
  sourceName: string,
  skillsDir: string,
  generatedName: string,
  winningSourceName: string,
): string {
  return (
    `skill source "${sourceName}" in "${skillsDir}" elides to generated name ` +
    `"${generatedName}", already produced by skill source "${winningSourceName}"; ` +
    `ignoring duplicate.`
  );
}
```

The two emission points are `collectSelfSkillDir` (`:115-118`) and the subdir
loop (`:190-194`):

```ts
// Source: extensions/pi-claude-marketplace/bridges/skills/discover.ts:184-200
      const generatedName = generatedSkillName(input.pluginName, entry.name);

      // D-07: first-wins dedup by GENERATED name. …
      const winner = seenByGenerated.get(generatedName);
      if (winner !== undefined) {
        warnings.push(duplicateWarning(entry.name, skillsDir, generatedName, winner.sourceName));
        continue;
      }

      seenByGenerated.set(generatedName, {
        sourceName: entry.name,
        generatedName,
        skillDir: full,
      });
```

`[VERIFIED: extensions/pi-claude-marketplace/bridges/skills/discover.ts:77-90,184-200]`

`DiscoveredSkill` carries `skillDir`, so an OQ-1 fix has the resolved path
available on both sides at the moment it needs it.

The path join in the enumeration loop is:

```ts
// Source: extensions/pi-claude-marketplace/bridges/skills/discover.ts:154-156
    const skillsDir = path.isAbsolute(skillsRel)
      ? skillsRel
      : path.join(input.resolved.pluginRoot, skillsRel);
```

`[VERIFIED: extensions/pi-claude-marketplace/bridges/skills/discover.ts:154-156]`

Note `path.join` **preserves** a trailing separator:
`path.join("/a", "./skills/")` → `"/a/skills/"`
`[VERIFIED: executed node -e 'path.join("/a","./skills/")' → "/a/skills/"]`. The
commands bridge uses `path.resolve` instead, which strips it
`[VERIFIED: extensions/pi-claude-marketplace/bridges/commands/discover.ts:372-374]`.
That asymmetry is why the two bridges' string keys differ even for the same input.

### Every reader of `componentPaths` (planner question 5)

| Consumer | How it reads the value | Effect of normalization |
|---|---|---|
| `bridges/skills/discover.ts:147,154-156` | `path.isAbsolute(rel) ? rel : path.join(pluginRoot, rel)` | Same directory; fewer redundant iterations. Safe. |
| `bridges/commands/discover.ts:360,372-374` | `path.isAbsolute(rel) ? rel : path.resolve(pluginRoot, rel)` | Same directory. Safe. The bridge additionally keeps a `seenByFile` map keyed on the absolute source file, with its own `duplicateFileWarning` for overlapping entries `[VERIFIED: extensions/pi-claude-marketplace/bridges/commands/discover.ts:363-366,127-135]`. |
| `orchestrators/plugin/shared.ts:942-949` (`pickAgentsSourceDir`) | takes `componentPaths.agents[0]`, then `path.isAbsolute(first) ? first : path.join(pluginRoot, first)` | Same directory. The `isAbsolute` branch stays dead for declared paths (absolute declarations are rejected upstream). Safe. |
| `orchestrators/plugin/info.ts:667-673` → `discoverComponentNames:303-321` | joins each, collects into `const names = new Set<string>()`, returns sorted | Already immune to duplicate enumeration by construction. Safe. |
| `domain/resolver.ts:1055` and `:1433` | `partial.componentPaths[kind].length > 0` — used only to push `kind` into `supported` | Length can only shrink when two spellings collapse; it can never reach 0 from a non-zero value, because a collapse implies at least one entry remains. Safe. |
| `bridges/agents/stage.ts:121`, `bridges/commands/stage.ts:173`, `bridges/skills/stage.ts:197` | comments referencing the array shape; no independent path handling | Safe. |
| `orchestrators/plugin/info.ts:1372,1901` | `deriveLenientComponentPaths(entry)` and a hard-coded `{ skills: ["skills"], commands: ["commands"], agents: ["agents"] }` for the `unavailable` arm | Both construct their own already-canonical values, independent of the resolver. Safe. |

`[VERIFIED: grep -rn "componentPaths" extensions/, 2026-09-12]`

**Conclusion: no consumer breaks.** Every reader either joins the value against
`pluginRoot` (identical result) or checks array length. No consumer compares the
string to a literal, persists it, or shows it to the user.

## Empirical Verification

Two probe scripts were executed this session against the real production modules
(`resolveStrict` from `domain/resolver.ts`, `discoverPluginSkills` from
`bridges/skills/discover.ts`), with real `mkdtemp` trees and no seams injected.

**Probe 1 — today's behavior, declaring paths through the marketplace entry**
(the same `readPathOrArray` → `validateComponentPath` → `addComponentPath` path a
manifest declaration takes):

```text
ui5-shape          componentPaths.skills = ["./skills/","skills"]
                   discovered = [ 'ui5-a', 'ui5-b', 'ui5-c' ]
                   warnings = 3
uitheme-shape      componentPaths.skills = ["./skills/ui-theme-designer-help",
                                            "./skills/ui-theme-designer-design-tokens","skills"]
                   discovered = [ 'ui-theme-designer-help', 'ui-theme-designer-design-tokens' ]
                   warnings = 2
already-today-entry-subdir  componentPaths.skills = ["skills/help","skills"]
                   discovered = [ 'acme-help' ]
                   warnings = 1
```

**Probe 2 — the post-normalization shapes:**

```text
norm-ui5           paths= ["skills"]
                   skillDirs= [ 'skills/a', 'skills/b', 'skills/c' ]
                   warnings= 0
norm-uitheme       paths= ["skills/help","skills/tokens","skills"]
                   skillDirs= [ 'skills/help', 'skills/tokens' ]
                   warnings= 2
subdir-plus-sibling  paths= ["skills/help","skills"]
                   skillDirs= [ 'skills/help', 'skills/other' ]
                   warnings= 1
```

`[VERIFIED: executed 2026-09-12 against extensions/pi-claude-marketplace/domain/resolver.ts and bridges/skills/discover.ts]`

Three conclusions, all first-hand:

1. **Normalization fixes `ui5`** (8 → 0 in production; 3 → 0 in the probe, which
   used 3 dirs instead of 8).
2. **Normalization does not fix `ui-theme-designer`** (2 → 2).
3. **The `subdir-plus-sibling` row rules out the obvious alternative fix.**
   Suppressing the convention path when a declared path lives under it would
   silence the warning but would also **drop `skills/other`** — a plugin that
   declares one skill subdir and ships others would lose them. That is a data
   regression, not a warning fix. The dedup must therefore live in the bridge,
   where the identity of the resolved directory is knowable, not in the resolver.

## Upstream Dependency Contract

Pinned from the VALIDATED spike, which was researched against Anthropic's primary
docs (`code.claude.com/docs/en/plugin-dependencies`,
`code.claude.com/docs/en/plugins-reference`) — not from a web search this session.

Each `dependencies` array element is either:

- a bare string — the plugin name, unversioned, resolved in the same marketplace
  as the declaring plugin: `"audit-logger"`
- an object with `name` (string, required), `version` (string, optional — a
  semver range such as `~2.1.0`, `^2.0`, `>=1.4`, `=2.1.0`), and `marketplace`
  (string, optional — resolve `name` in a different marketplace)

```json
"dependencies": [
  "audit-logger",
  { "name": "secrets-vault", "version": "~2.1.0" }
]
```

`[CITED: .planning/spikes/004-claude-plugin-dependency-spec/README.md, verdict VALIDATED, sourced from code.claude.com/docs/en/plugin-dependencies]`

Use these exact shapes as the DEPS test fixtures. `.planning/REQUIREMENTS.md:184-187`
records that no in-the-wild fixture exists — 290 of 292 official-marketplace
manifests were checked, exactly one (`salesforce-development`) has the key, and
its value is `[]` — so all DEPS test data is necessarily synthetic and must be
pinned from the spike rather than invented.

Two upstream behaviors this phase deliberately does NOT adopt: auto-resolution
(Phase 3, RESV-*) and the npm-style `name@version` display form (rejected by
D-01-01 for overloading `@`).

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|---|---|---|---|
| Shared `tests/helpers/` module with `withHermeticHome`, `makeMockGitOps`, `makeMockCredentialOps` | Per-suite local helpers; one shared fixture module at `tests/edge/handlers/marketplace-seed.ts` | v1.19 Unit Test Refactor (closed 2026-09-04) | `.planning/codebase/STACK.md` and `CONVENTIONS.md` still describe the old layout. Do not plan against those paths. |
| `npm run check` = typecheck + lint + fallow + format + tests | plus `test:corresponding`, `test:corresponding:negative`, `test:coverage:direct:negative` | v1.19 | Pairing is now a build gate, not a convention. |
| ESLint `import-x/no-cycle` as the circular-import gate | `fallow dead-code` (unfiltered) | documented in ARCHITECTURE.md | The ESLint rule was measured inert and removed. |

**Deprecated / outdated in the codebase docs:**

- `tests/helpers/**` — path does not exist.
- `tests/orchestrators/plugin/info-manifest-absent.test.ts` — referenced in the
  header comment of `tests/edge/handlers/marketplace-seed.ts:9-11`, but the file
  is gone `[VERIFIED: find tests -name "*manifest-absent*" → no results]`. A
  stale comment, harmless, out of scope to fix.
- `.fallowrc.json` "13 zones" per CONVENTIONS.md — the file declares 13 zone
  entries but the ESLint gate counts 8 folders. Both statements are true about
  different gates; do not try to reconcile them.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|---|---|---|
| A1 | The real `ui5` plugin has 8 skill directories and `ui-theme-designer` has 2, with the declared shapes `["./skills/"]` and `["./skills/ui-theme-designer-help", "./skills/ui-theme-designer-design-tokens"]`. | Pitfall 1, Empirical Verification | Taken from `.planning/BACKLOG.md` PMAN-01, which states it was verified against the pinned SHAs on 2026-09-09. Not re-fetched this session (would require network, and NFR-5 keeps this repo offline-first). If the counts differ, the *ratio* conclusion is unchanged — the probe reproduced the mechanism with synthetic trees, so the finding does not depend on the exact count. |
| A2 | `npm run check` is currently green on `features/manifest` as a whole. | Pitfall 2 | Only the four fastest links were executed this session (`fallow`, `test:corresponding`, and three test files). The full chain including `test:integration` was not run. If something is already red, a plan task could be blamed for a pre-existing failure. Recommend the first plan task establish a full-chain baseline. |
| A3 | `strong-mock` is not needed for this phase's tests. | Standard Stack | Judgment call — the seams here are filesystem-shaped and the suites use real temp dirs or the in-memory `ResolveContext`. If a task finds a collaborator worth a strict mock, the library is already available. |
| A4 | A new catalog state for the object-dependency byte form is expected rather than optional. | Pitfall 6 | The catalog's own preamble says it holds "Per-command rendered output for each user-visible state", but no gate forces a NEW state to be documented — the bidirectional walk only pairs states that already exist on one side. If the plan skips it, `check` still passes; the user contract is just less complete. Worth a deliberate call rather than a default. |

## Open Questions

### OQ-1 (blocking): MANF-03 is not closed for `ui-theme-designer` by the locked mechanism

- **What we know:** verified by execution. D-01-14 / D-01-15 take `ui5` from 8
  warnings to 0 and leave `ui-theme-designer` at 2. ROADMAP criterion 3 names
  both plugins. The cause is that a declared path *nested under* the convention
  directory is a legitimately distinct component path that the convention probe
  then re-enumerates. The same defect already exists today for any plugin
  declaring `skills: "skills/<name>"` in its marketplace **entry** — it is not
  introduced by MANF-01; MANF-01 merely brings four more plugins onto the path.
- **What's unclear:** whether the phase absorbs the bridge-side fix or amends
  the criterion. CONTEXT locks the resolver mechanism and is silent on the
  bridge, so this is genuinely undecided rather than settled.
- **Recommendation:** absorb it. Add a `seenByDir: Map<string, DiscoveredSkill>`
  to `discoverPluginSkills`, keyed on the resolved skill directory, consulted
  **before** the `seenByGenerated` warning in both emission points. Same resolved
  directory ⇒ silent skip (it is one skill reached twice). Different directory,
  same generated name ⇒ today's warning, unchanged. I verified this preserves all
  four existing collision tests, because every one of them uses distinct
  directories. Cost: one map and two guards in one file, plus the paired test
  amendment. The alternative — suppressing the convention path — is a data
  regression (probe row `subdir-plus-sibling`).
  - **Symmetry note:** `bridges/commands/discover.ts` has the same shape and
    already carries a `seenByFile` map for a related overlap case, but its
    generated-name check runs first and `continue`s, so the identical
    same-directory scenario produces a name-collision warning there too. The four
    bare-manifest plugins declare no commands, so commands is out of MANF-03's
    letter. Flag it for the backlog rather than widening this phase — and note
    that the two bridges are already a fallow-reported "Mirrored" clone pair
    (`bridges/commands/` ↔ `bridges/skills/`, 3 files, 82 lines)
    `[VERIFIED: npx fallow dupes output, 2026-09-12]`, so changing both
    symmetrically is the lower-duplication move if it is ever done.

### OQ-2 (non-blocking): does the object-dependency byte form get a catalog state?

- **What we know:** the existing `installed-single-scope-with-dependencies` state
  stays byte-valid under D-01-03. Adding a state requires a doc block **and** a
  `FIXTURES` entry in the same change (both walks are gated).
- **What's unclear:** whether the phase's definition of done includes the catalog.
- **Recommendation:** add it. The output catalog is the user contract, D-01-01
  explicitly calls the byte form "a catalogued output state", and skipping it
  means the new form's only protection is an orchestrator test rather than the
  byte-equality gate.

### OQ-3 (non-blocking): where does `MANIFEST_CANDIDATES`'s stat helper live for reader 2?

- **What we know:** `defaultStatKind` is module-private in `domain/resolver.ts:309`;
  `orchestrators/plugin/shared.ts` currently imports only `readFile` from
  `node:fs/promises`.
- **What's unclear:** nothing blocking — this is a small structural choice inside
  the "Claude's Discretion" fence.
- **Recommendation:** add `stat` to the existing `node:fs/promises` import in
  `shared.ts` and keep the check local. Do not export `defaultStatKind` (see
  §Anti-Patterns). Keep `manifest-path.ts` a pure constant module per D-01-06.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|---|---|---|---|---|
| Node.js | Everything (native TS execution, `node --test`) | ✓ | v26.8.2 (engines floor `>=20.19.0`; CI pins 24) | — |
| npm | `npm run check` and every sub-gate | ✓ | 11.19.1 | — |
| TypeScript | `npm run typecheck` | ✓ | 6.0.3 | — |
| `fallow` | `npm run fallow` (three sub-gates) | ✓ | resolves from `devDependencies` `^3.17.0`; runs in ~0.2s | — |
| git | branch work, commits | ✓ | on `features/manifest` | — |
| Network | nothing in this phase | n/a | — | Not needed: no package install, no clone, no fetch. NFR-5 keeps the touched surfaces offline. |
| `pre-commit` | the commit gate | not probed | — | If absent, run the hooks' underlying commands manually; CI's Lint job runs them `--all-files` regardless. |

`[VERIFIED: node --version → v26.8.2; npm --version → 11.19.1; npx tsc --version → Version 6.0.3; npm run fallow → EXIT=0; git rev-parse --abbrev-ref HEAD → features/manifest]`

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** `pre-commit` availability was not probed
this session; CLAUDE.md requires running it before every commit, so the first
plan task should confirm it.

## Validation Architecture

`workflow.nyquist_validation` is `true` in `.planning/config.json`
`[VERIFIED: .planning/config.json workflow.nyquist_validation]`, so this section
is required.

### Test Framework

| Property | Value |
|---|---|
| Framework | `node:test` (Node built-in, v26.8.2 locally / Node 24 in CI) + `node:assert/strict`; `strong-mock@^9.2.2` available for strict interaction mocks |
| Config file | none — the runner is configured entirely by the `package.json` script globs |
| Quick run command | `node --test <test-path>` |
| Focused pair coverage | `npm run test:coverage:direct -- <path>` (100% function/line/branch required per pair; not part of `check`, but the house rule) |
| Full suite command | `npm run check` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|---|---|---|---|---|
| MANF-01 (resolver half) | a bare `<pluginRoot>/plugin.json` is read and honored | unit | `node --test tests/domain/resolver.test.ts` | ✅ amend |
| MANF-01 (version half) | `resolvePluginVersion` tier 1 reads the bare manifest's `version` | unit | `node --test tests/orchestrators/plugin/shared.test.ts` | ✅ amend |
| MANF-01 (agreement, D-01-12) | one planted bare-manifest fixture; both readers honor it | behavioral / cross-module | `node --test tests/architecture/<new>.test.ts` | ❌ Wave 0 |
| MANF-01 (constant) | `MANIFEST_CANDIDATES` ordering and shape | unit | `node --test tests/domain/manifest-path.test.ts` | ❌ Wave 0 — **mandatory pair** |
| MANF-02 | both present ⇒ wrapped wins, in both readers | unit ×2 | `node --test tests/domain/resolver.test.ts tests/orchestrators/plugin/shared.test.ts` | ✅ amend |
| MANF-03 (normalization) | `"./skills/"`, `"a/../skills"`, `"."` normalize; dedup against the convention path | unit | `node --test tests/domain/resolver.test.ts` | ✅ amend |
| MANF-03 (no warning) | `ui5` shape ⇒ 0 warnings; `ui-theme-designer` shape ⇒ 0 warnings (pending OQ-1) | unit | `node --test tests/bridges/skills/discover.test.ts` | ✅ amend |
| MANF-04 | malformed **bare** manifest ⇒ `unavailable` carrying `malformed plugin.json:` | unit | `node --test tests/domain/resolver.test.ts` | ✅ amend |
| MANF-04 (D-01-10) | malformed **wrapped** + valid bare ⇒ still `unavailable` | unit | `node --test tests/domain/resolver.test.ts` | ✅ amend |
| MANF-04 (D-01-09) | present-but-unreadable candidate ⇒ malformed, not skipped | unit | `node --test tests/domain/resolver.test.ts` | ✅ amend (harness's bare `"file"` value already rejects on read) |
| MANF-05 | neither candidate present ⇒ `{ ok: true, manifest: null }`, plugin still installs | unit | `node --test tests/domain/resolver.test.ts` | ✅ exists at `:1108`, keep green |
| DEPS-01 | object `{name, version, marketplace}` renders with its constraint | unit | `node --test tests/orchestrators/plugin/info.test.ts` | ✅ amend |
| DEPS-01 (parser) | object shape parses to `{ name, version?, marketplace? }` | unit | `node --test tests/domain/dependencies.test.ts` | ❌ Wave 0 — **mandatory pair** |
| DEPS-02 | mixed string/object array renders every element | unit | `node --test tests/orchestrators/plugin/info.test.ts` | ✅ amend |
| DEPS (D-01-02/03) | missing-marketplace fill-in; `@`-bearing bare string passes through verbatim | unit | `node --test tests/orchestrators/plugin/info.test.ts` | ✅ amend |
| DEPS (D-01-04) | sort on the dependency NAME, not the display string | unit | `node --test tests/orchestrators/plugin/info.test.ts` | ✅ amend |
| DEPS (D-01-05) | element with no usable `name` is dropped silently | unit | `node --test tests/domain/dependencies.test.ts` | ❌ Wave 0 |
| Regression (catalog) | new byte form pairs byte-equal with `notify()` (if OQ-2 is taken) | architecture | `node --test tests/architecture/catalog-uat.test.ts` | ✅ amend both sides |

### Sampling Rate

- **Per task commit:** `node --test <the touched pair(s)>` plus
  `npm run test:corresponding` (cheap, and it is the gate most likely to catch a
  half-finished module/test pair).
- **Per wave merge:** `npm run typecheck && npm run lint && npm run fallow && npm test`.
- **Phase gate:** full `npm run check` green before `/gsd-verify-work`, plus
  `pre-commit run --all-files`.

### Wave 0 Gaps

- [ ] `tests/domain/manifest-path.test.ts` — mandatory pair for the new constant
      module; covers MANF-01/MANF-02 ordering
- [ ] `tests/domain/dependencies.test.ts` — mandatory pair for the new parser;
      covers DEPS-01, DEPS-02, D-01-05
- [ ] `tests/architecture/<cross-reader>.test.ts` — D-01-12; needs its own local
      `withHermeticHome`-style temp-dir wrapper (no shared helper exists) and its
      own manifest-planting `writeFile`
- [ ] Manifest-planting fixture capability — either an inline `writeFile` in the
      new test or a `pluginManifests` option on
      `tests/edge/handlers/marketplace-seed.ts::materializeMarketplaceTree`
- [ ] Framework install: none needed

## Security Domain

`security_enforcement` is absent from `.planning/config.json`, so it is treated
as enabled.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---|---|---|
| V2 Authentication | no | This phase touches no credential path. `platform/git-credential.ts` is untouched. |
| V3 Session Management | no | No sessions. |
| V4 Access Control | no | No authorization decision changes. `defaultEnabled` precedence is untouched. |
| V5 Input Validation | **yes** | Untrusted third-party manifest content. Controls already in place and reused unchanged: `PLUGIN_MANIFEST_VALIDATOR` (typebox, compiled) for the manifest shape; explicit `as Record<string, unknown>` widening plus per-element narrowing for `Type.Unknown()` fields; `JSON.parse` inside a `try` whose `catch` produces a typed reason rather than propagating. |
| V6 Cryptography | no | None used. `computeHashVersion` is a content hash for identity, not a security control, and is untouched. |
| V12 File / Resource | **yes** | Path containment. `assertPathInside` (`shared/path-safety.ts`) remains the single NFR-10 chokepoint and is called before normalization, unchanged. |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---|---|---|
| Path traversal via a declared component path (`"../../etc"`) | Tampering / Information disclosure | `assertPathInside` at `domain/resolver.ts:990`, already present. **D-01-14 strengthens the posture:** today the RAW string (possibly `a/../skills`) is stored and later re-joined by three bridges; after normalization the stored value is the output of `path.relative(root, contained)`, which cannot begin with `..` once the containment check has passed. One canonical, provably-contained spelling flows downstream instead of an arbitrary author spelling. |
| Symlinked parent segment inside a plugin tree | Tampering | `assertPathInside` refuses every symlinked segment (D-14 / D-16), and `bridges/skills/discover.ts` independently `lstat`s and skips symlinks. Unchanged. |
| Malicious/oversized `plugin.json` (JSON bomb, prototype pollution via `__proto__`) | Denial of service / Tampering | Pre-existing exposure, **widened by exactly one additional candidate file**. `JSON.parse` does not assign `__proto__` as an own property in V8, and the validator rejects unknown top-level shape. No new class of exposure; the second candidate is a sibling of a file already parsed from the same untrusted tree. |
| Manifest content reaching a shell | Tampering / Elevation | Not applicable here. `tests/architecture/no-shell-out.test.ts` gates it repo-wide and this phase adds no process spawn. |
| Untrusted content reaching `ctx.ui.notify` | Spoofing (output forgery) | The dependency display strings are attacker-influenced. They already are today (bare strings render verbatim). The new object arm renders `name` and `version` verbatim too. `notify()` performs no escaping, and the row grammar is line-oriented — a dependency name containing `\n` could forge a row. **Worth a deliberate look during planning:** `assertSafeName` is not applied to dependency element values because they are not resolved in this phase. Recommend the parser reject any `name`/`version`/`marketplace` containing a control character or newline, consistent with `assertSafeName`'s existing ASCII-control check at `domain/name.ts:46-55`, and consistent with D-01-05's "no usable name ⇒ dropped silently". This is an addition to D-01-05's spirit, not a contradiction of it. |

### Threat not mitigated (documented, pre-existing)

The TOCTOU note in `shared/path-safety.ts:71-75` — "between this check returning
and the actual write, an attacker with write access to a parent dir could insert
a symlink. The threat model is 'careless or malicious *plugin author*', not
'concurrent in-process attacker'" `[VERIFIED: extensions/pi-claude-marketplace/shared/path-safety.ts:71-75]`.
Unchanged by this phase.

## Sources

### Primary (HIGH confidence) — read this session

- `extensions/pi-claude-marketplace/domain/resolver.ts` — `readManifest` (624-651),
  `statKindOf`/`readFileTextOf` (331-337), `defaultStatKind` (309),
  `validateComponentPath` (956-999), `addComponentPath` (1002-1014),
  `collectStrictComponentKind` (1034-1062), `collectLooseComponentKind` (1396-1436),
  `noteDeclaredDependencies` (1615-1620), `ResolveContext` (294-307)
- `extensions/pi-claude-marketplace/orchestrators/plugin/shared.ts` —
  `resolvePluginVersion` (901-940), `pickAgentsSourceDir` (942-949), imports (16-34)
- `extensions/pi-claude-marketplace/orchestrators/plugin/info.ts` —
  `discoverComponentNames` (303-321), `normalizeDependencies` (323-344),
  call site (838), `getPluginInfo` (2239)
- `extensions/pi-claude-marketplace/bridges/skills/discover.ts` — full file
- `extensions/pi-claude-marketplace/bridges/commands/discover.ts` — 55-145, 350-400
- `extensions/pi-claude-marketplace/domain/components/plugin.ts` — 60-108
- `extensions/pi-claude-marketplace/domain/name.ts` — `generatedSkillName` (58-83)
- `extensions/pi-claude-marketplace/shared/notify.ts` — 1495-1535, 3550-3566
- `extensions/pi-claude-marketplace/shared/path-safety.ts` — 57-101
- `extensions/pi-claude-marketplace/shared/probe-classifiers.ts` — 85-150
- `scripts/check-corresponding-tests.mjs` — full file
- `scripts/test-coverage-direct.mjs` — 1-80, 270-410
- `package.json` — scripts, dependencies
- `.fallowrc.json`, `eslint.config.js` (27-380), `tsconfig.json`
- `tests/domain/resolver.test.ts`, `tests/orchestrators/plugin/shared.test.ts`,
  `tests/orchestrators/plugin/info.test.ts`, `tests/bridges/skills/discover.test.ts`
- `tests/edge/handlers/marketplace-seed.ts` — full file
- `tests/architecture/{manifest-read-seam,unit-suite-glob-completeness,import-boundaries,catalog-uat,notify-grammar-invariant,partial-vocabulary-guard}.test.ts`
- `docs/output-catalog.md` (1-60, 1752-1800), `docs/messaging-style-guide.md`
- `.claude/rules/typescript-unit-testing.md`
- **Executed:** `npm run fallow`, `npm run test:corresponding`,
  `node --test` on three suites, two custom probe scripts against the real
  resolver and skills bridge, `npx fallow dupes --help`, `npx fallow dead-code --help`

### Secondary (MEDIUM confidence)

- `.planning/spikes/004-claude-plugin-dependency-spec/README.md` — VALIDATED
  spike, sourced from `code.claude.com/docs/en/plugin-dependencies` and
  `plugins-reference`. Read this session; the upstream docs themselves were not
  re-fetched.
- `.planning/BACKLOG.md` — PMAN-01 (2605-2665), PDEP-01 (1184-1229)
- `.planning/REQUIREMENTS.md` §Planning Notes
- `.planning/codebase/{STACK,CONVENTIONS,ARCHITECTURE}.md` — accurate on
  architecture and gates; **stale on the test-helper layout** (see §State of the Art)

### Tertiary (LOW confidence)

- None. No web search was performed; no claim in this document rests on one.

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — no new packages; every library claim read from
  `package.json` in the working tree
- Architecture / seams: HIGH — every line quoted verbatim from a file opened
  this session, with line ranges
- Test harness inventory: HIGH — helper absence and shape confirmed by `ls` and
  `grep` over the real tree, contradicting the codebase docs
- Gate analysis: HIGH — gate scripts read in full; three gates executed
- MANF-03 finding: HIGH — reproduced by executing the real production modules
  against synthetic trees matching both named witness shapes
- Upstream dependency contract: MEDIUM — from a VALIDATED in-repo spike rather
  than a live fetch of Anthropic's docs
- In-the-wild plugin counts (8 / 2): MEDIUM — from BACKLOG PMAN-01, verified
  there on 2026-09-09, not re-fetched (network)

**Research date:** 2026-09-12
**Valid until:** 2026-10-12 (30 days — in-repo findings against a stable tree; the
only expiry risk is another branch landing changes in the five touched modules)
