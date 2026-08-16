# Phase 105: No-op parity sweep and contract documentation - Research

**Researched:** 2026-08-15
**Domain:** In-repo regression characterization + contract documentation (no external technology)
**Confidence:** HIGH — every behavioral claim below was produced by RUNNING the real orchestrators against both the current tree and the pre-milestone tree in this session, not by reading them.

## Summary

Every parity claim in this phase's goal was tested by execution, not by inspection. I built
throwaway fixtures carrying three plugins — one declaring `defaultEnabled: false`, one
declaring `true`, one silent — and ran the real `updatePlugins`, `reinstallPlugins` and
`applyReconcile` against them, twice: once on this branch and once on a detached worktree at
the milestone base commit `bb6af555`. The declaring-`true` and silent rows came out
**byte-identical across both trees on all three surfaces**, and the enablement never moved
even when the declaration was flipped between install and the lifecycle verb. DFEN-08 holds
today; the phase's work is to PIN it, not to fix it.

Three things materially change the shape of the plan versus what CONTEXT assumed. First, the
source-grep gate CONTEXT asks for **already exists and passes** —
`tests/architecture/no-lifecycle-default-enabled-read.test.ts` was landed in the previous
behavior phase and covers `update.ts` and `reinstall.ts` with both the `defaultEnabled` and
`applyDefaultEnabled` patterns; the phase owes only the behavioral half. Second, the
"one fixture, three plugins" decision is sound but forces **row-level assertions, never
message-level ones**: a bulk cascade emits ONE notification whose tally counts all three
plugins, and the declaring-`false` plugin's config write-back rewrites the whole
`claude-plugins.json`, so any whole-message or whole-file comparison is polluted by the
sibling under test. Third, criterion 4 costs nothing: `compat-01-no-expansion.test.ts` passes
14/14 with exactly one line changed since the base commit — `"installs disabled"` appended at
the tail of `REASONS` — and no glyph, status token, install-record key or schema version
moved.

The documentation half is well specified by the existing house pattern, and the one upstream
fact DOC-02 rests on I verified live this session against `code.claude.com/docs/en/plugins-reference`
rather than trusting the in-repo record. The phase goal's own phrasing about dependencies
("dropped entirely today") is imprecise against `info.ts::normalizeDependencies` and must be
corrected in the write-up — see Decision Conflicts.

**Primary recommendation:** Write three row-level parity tests into the three existing
per-surface test files (all three fixture helpers already take a `defaultEnabled` knob — none
needs a new parameter), delete only the hollow probe BLOCK inside `list.test.ts:2966` while
updating the sibling comment that points at it, and land the two catalog gaps plus a new
`docs/plugin-enablement.md` modeled byte-for-byte on the `docs/env-vars.md:129` section shape.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Parity proof for `update` | Test tier (`tests/orchestrators/plugin/update.test.ts`) | Architecture tier (existing grep gate) | The guarantee is behavioral (output unchanged); the structural half is already gated. |
| Parity proof for `reinstall` | Test tier (`tests/orchestrators/plugin/reinstall.test.ts`) | Architecture tier (existing grep gate) | Same. |
| Parity proof for `reconcile` | Test tier (`tests/orchestrators/reconcile/apply.test.ts`) | — | `reconcile` legitimately READS the field, so no grep gate is possible; only behavior can express the boundary. |
| Closed-set non-expansion | Architecture tier (`tests/architecture/compat-01-no-expansion.test.ts`) | — | Already owns all four sets by enumeration equality; consumed as-is. |
| Output-form contract | Docs tier (`docs/output-catalog.md`) + `catalog-uat.test.ts` | — | The catalog is the only byte-gated doc in the repo; a block must arrive with its fixture. |
| Enablement contract narrative | Docs tier (new `docs/plugin-enablement.md`) | Requirements tier (`REQUIREMENTS.md` OUT-02 amendment) | The divergence needs one citable prose home; the requirement text must stop contradicting its own implementation. |
| Type precision (IN-04) | Orchestrator tier (`orchestrators/plugin/list.ts`) | — | A local type annotation; no behavior. |

## User Constraints (from CONTEXT.md)

### Locked Decisions

**Scope of the DFEN-08 Parity Sweep**

- **Three surfaces need new coverage: `update`, `reinstall`, `reconcile`.** The
  other three are already covered and are not re-proven: `list` and `info` were
  proven at the notify layer in the previous phase
  (`tests/shared/notify-not-installed-reasons.test.ts` asserts absent-vs-empty
  byte-identity on both candidate arms), and `install` carries the D-103-01 case
  (`tests/orchestrators/plugin/install.test.ts:1231`).

- **Where the guarantee is STRUCTURALLY true, gate it with a source-level grep,
  not only a behavioral test.** This carries forward the Phase 103 decision
  verbatim: `update` and `reinstall` never read `defaultEnabled` today, so the
  gate should fail at the TOKEN, before a behavior exists to test. Pair the grep
  gate with a behavioral test rather than choosing between them — the grep proves
  the field is unreachable, the behavior proves the output is unchanged.

- **"Byte-identical to pre-milestone" is asserted as a self-contained triple, not
  against a recorded baseline.** One fixture carries three plugins — one
  declaring `defaultEnabled: false`, one declaring `true`, one silent — and the
  `true` and silent rows are asserted equal to each other and to the
  pre-milestone form in the same run. A snapshot file captured from the old tree
  would rot and would not survive the milestone archive.

- **Both the `true` case and the absent case are covered explicitly.** Phase 102
  recorded why: a precedence test over a three-valued key that only covers two
  values passes while the gate asks the wrong question. `entry.defaultEnabled !==
  undefined` and `entryDeclaresInstallDisabled(entry)` agree on `false` and
  disagree elsewhere.

**Contradictions Carried Out of the Previous Phase**

These are inputs, not optional polish. All four were surfaced by the previous
phase's code review or by its verification, and each is a place where the
repository currently contradicts itself.

- **Amend `OUT-02` in `REQUIREMENTS.md`.** It currently says the token renders
  when the **resolved** `defaultEnabled` is `false`. The rule that shipped is
  narrower and has THREE inputs: the marketplace entry answers on the manifest
  side (`plugin.json` is deliberately never read on a read path), and the user's
  own `enabled` value in `claude-plugins.json` outranks it in EITHER direction.
  A requirement its own implementation violates is exactly what a phase scoped
  "reconciled against what shipped" must fix.

- **Give the entry-only divergence a requirement-level anchor.** Source comments
  currently cite `D-104-01`, a phase decision ID that archives with its phase.
  The DOC-02 write-up becomes its durable home; re-point the comments at it.
  (They previously cited `DOC-02` by mistake, which is the unrelated
  dependency-requirement override — that error is already fixed.)

- **Write the three-input precedence rule into the contract.** The catalog prose
  at `docs/output-catalog.md:380` already states it correctly; the contract
  document must agree rather than restate a two-input version. Include the
  deliberate consequence: a config-chosen `enabled: false` also renders the row
  BARE, because the token names the AUTHOR-declared cause only.

- **DELETE the hollow NFR-5 guard** in `tests/orchestrators/plugin/list.test.ts`
  (~`:2593`). It calls `readFile` on a directory, so its boolean is
  unconditionally `false`, and it runs BEFORE the call it means to constrain — it
  can never fail. Its correct sibling now exists beside it, so a guard that
  cannot fail is strictly worse than no guard: it reads as coverage. Deleting is
  preferred over repairing, because the repair already exists.

**Contract Documentation: Home and Closure**

- **DOC-02 lands in a NEW `docs/plugin-enablement.md`** that owns the enablement
  contract end to end, carrying a `## Divergences and documented absences`
  section. This copies the established house pattern at `docs/env-vars.md:129`
  verbatim in spirit: that section is "the single citable home for a caveat …
  the caveat text is not duplicated elsewhere." Both divergences live there —
  the dependency-requirement override (PDEP-01) and the entry-only read rule.

- **DOC-01 has exactly two gaps left.** The token blocks themselves landed in the
  previous phase. What remains:
  1. `reinstall`'s `(skipped) {already disabled}` row has no catalog block
     (carried from Phase 103's backlog).
  2. The `(available)` token-table row was not updated alongside `(remote)`
     (previous phase's review finding IN-01).
  Do not re-audit the whole catalog; it was reconciled one phase ago.

- **Close all four open Info findings** from `104-REVIEW.md` (IN-01..IN-04). They
  are documentation and type-precision items, this is the documentation phase,
  and IN-01 is already DOC-01 scope. IN-04 is the one with a type dimension:
  `installsDisabledField` is typed off `PluginAvailableMessage` while also being
  spread into a `PluginRemoteMessage` literal.

- **Criterion 4 rides the EXISTING
  `tests/architecture/compat-01-no-expansion.test.ts` unchanged.** It already
  pins all four closed sets by enumeration equality, every glyph code point with
  an eighth-glyph tripwire, the install record's key set, the state schema
  version union, and the network clause. The criterion is that test continuing to
  pass with exactly one intended `REASONS` delta (`installs disabled`, appended
  at the tail). Assert that fact; do not build a second no-expansion test beside
  it.

### Claude's Discretion

- Plan/wave decomposition and how the doc work is split from the test work.
- The internal section structure of `docs/plugin-enablement.md`, beyond the
  required `## Divergences and documented absences` section.
- Whether the three new parity tests live in their existing per-surface test
  files or in one new parity suite — provided each surface's assertion is
  individually legible in failure output.

### Deferred Ideas (OUT OF SCOPE)

- **DFEN-V2-01 — honoring the dependency-requirement override.** Blocked on
  PDEP-01 (plugin `dependencies` are opaque and dropped entirely today). DOC-02
  documents the gap rather than half-building it.

- **The fourth flag-aimed config write** in `maybeWritePluginConfigBack`
  (`orchestrators/plugin/shared.ts`). Benign and pinned — its patch carries no
  field and runs only when the key is absent. Carried in the backlog, not this
  phase.

- **Re-auditing the whole output catalog.** It was reconciled one phase ago; only
  the two named gaps are in scope.

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DFEN-08 | `defaultEnabled: true` and an absent `defaultEnabled` produce byte-identical behavior and output to today, across install, update, reinstall, list, info, and reconcile. | Probe Results (all three uncovered surfaces run pre- and post-milestone, byte forms recorded verbatim); Parity Test Construction Guide (harness + helper knobs per surface); Reconcile Parity Boundary. |
| DOC-01 | `docs/output-catalog.md` is amended for the new token and the surfaces that emit it. | DOC-01 Gap A (reinstall block: exact bytes, model block, fixture shape, both-direction gate) and Gap B (verbatim `(available)` / `(remote)` cells). |
| DOC-02 | The dependency-requirement override is documented as a known divergence. | DOC-02 Fact Base (upstream verbatim quote verified live this session; in-repo counterpart behavior read from source); House Divergence Pattern. |

## Project Constraints (from CLAUDE.md)

Directives the plan must satisfy. These carry the same authority as locked decisions.

| Directive | Source | Consequence for this phase |
|-----------|--------|----------------------------|
| Comments and test titles cite durable spec IDs, NEVER GSD process artifacts (`Phase NN`, `Plan NN`, `Wave N`, `milestone vX.Y`, bare `Pitfall N` / `Pattern N`) | `.claude/rules/typescript-comments.md` | New test titles must cite `DFEN-08` / `OUT-02` / `DOC-01` / `D-1xx-NN`, not the phase. `docs/` prose is not covered by this rule, but the repo's habit is the same. |
| `npm run check` must stay green — typecheck + ESLint + Prettier + tests | CLAUDE.md Constraints (NFR-6) | Baseline confirmed green this session (see Environment Availability). |
| Markdown is formatted by **mdformat**, not prettier | `.mdformat.toml`, `.pre-commit-config.yaml`; `format:check` covers only js/json/ts | Never run `prettier --write` on `docs/*.md`. `docs/plugin-enablement.md` and `docs/output-catalog.md` edits go through `pre-commit run --files <paths>`. |
| Run `pre-commit run --all-files` BEFORE `git commit`; never `--no-verify`; never `--amend` after a hook failure | CLAUDE.md Git | CI Lint runs `--all-files`; a scoped run hides pre-existing violations. |
| Committing from inside a worktree needs `SKIP=trufflehog` after a filesystem-mode scan | CLAUDE.md Git | This phase runs in `.worktrees/defaults-enabled`. |
| All user-visible output via `ctx.ui.notify` (IL-2); `sonarjs/cognitive-complexity: 15`; `@typescript-eslint/explicit-module-boundary-types: error` | CLAUDE.md / CONVENTIONS.md | Only IN-04 touches production source, and it is a type annotation. |
| Surgical changes — every changed line traces to the request | CLAUDE.md §3 | Directly relevant to IN-03's disposition (see below). |

## Probe Results — the three uncovered surfaces, RUN not read

Method: a three-plugin marketplace (`alpha` declaring `defaultEnabled: false`, `beta`
declaring `true`, `gamma` silent), installed through the real `installPlugin` with
`applyDefaultEnabled: true`, then driven through the real lifecycle verb. Executed twice:
against this branch (`895f0aaa`) and against a detached worktree at the milestone base commit
`bb6af555` (the pre-milestone tree; on that tree `applyDefaultEnabled` does not exist, so the
option was dropped). `[VERIFIED: probe run this session]`

### Surface 1 — `update`

Post-milestone, after flipping every declaration to its opposite before the update:

```text
● mp [project]
  ⊘ alpha (skipped) {already disabled}
  ● beta v1.0.0 → v2.0.0 (updated)
  ● gamma v1.0.0 → v2.0.0 (updated)

Plugin update: 2 updated

/reload to pick up changes
```

Pre-milestone (`bb6af555`), same fixture:

```text
● mp [project]
  ● alpha v1.0.0 → v2.0.0 (updated)
  ● beta v1.0.0 → v2.0.0 (updated)
  ● gamma v1.0.0 → v2.0.0 (updated)

Plugin update: 3 updated

/reload to pick up changes
```

Records post-update: `{"alpha":{"enabled":false,"version":"2.0.0"},"beta":{"enabled":true,"version":"2.0.0"},"gamma":{"enabled":true,"version":"2.0.0"}}`.
Pre-milestone: all three `enabled:true`, all at `2.0.0`.

**Findings.** The `beta` and `gamma` rows are byte-identical across the two trees. The version
moved on all three (control: the flipped manifest WAS re-read), and enablement moved on none —
`beta` was flipped `true → false` and stayed enabled; `gamma` was flipped silent → `false` and
stayed enabled. `update` does not reach `defaultEnabled`, confirmed behaviorally, not only by
grep.

### Surface 2 — `reinstall`

Post-milestone, bulk `{ kind: "marketplace", marketplace: "mp" }`:

```text
● mp [project]
  ⊘ alpha (skipped) {already disabled}
  ● beta v1.0.0 (reinstalled)
  ● gamma v1.0.0 (reinstalled)

Plugin reinstall: 3 successes

/reload to pick up changes
```

Pre-milestone: all three `(reinstalled)`, same `3 successes` tally, same trailer.

**Findings.** `beta` / `gamma` rows byte-identical across trees. No record moved. Note the
tally reads `3 successes` on BOTH trees — post-milestone it counts 2 reinstalled + 1
info-severity skip. That is the documented default-tally rule
(`shared/notify.ts::composeTally`: "the default tally counts OPERATION rows uniformly", info
rows count as successes) and it is precedented in the catalog itself at
`docs/output-catalog.md:792` — `Plugin reinstall: 1 failure, 2 successes` where one of the two
successes is `⊘ beta (skipped) {up-to-date}`. **This is not a defect; do not chase it.**
`[VERIFIED: docs/output-catalog.md:789-797, quoted below]`

### Surface 3 — `reconcile`

Post-milestone, first `applyReconcile` pass over a config declaring all three as bare `{}`
entries:

```text
● mp [project] (added)
  ◍ alpha v1.2.3 (disabled) {installs disabled}
    Run enable on this plugin to use its components.
  ● beta (installed)
  ● gamma (installed)

Reconcile: 4 successes
```

Pre-milestone:

```text
● mp [project] (added)
  ● alpha (installed)
  ● beta (installed)
  ● gamma (installed)

Reconcile: 4 successes
```

Second pass on both trees: **silent** (zero notifications).

`claude-plugins.json` after the post-milestone pass:

```json
"plugins": {
  "alpha@mp": {
    "enabled": false
  },
  "beta@mp": {},
  "gamma@mp": {}
}
```

Pre-milestone: all three `{}`.

**Findings.** `beta` / `gamma` rows byte-identical across trees; their config ENTRIES are
byte-identical too (`{}` in both). Only `alpha@mp` gained `"enabled": false`. Reconcile's
`(installed)` rows carry no version slot (`● beta (installed)`) — that is the reconcile
projection's own shape and is unchanged pre/post. The tally is `4 successes` on both trees (mp
`added` row + three plugin rows).

### Surface 0 — `install` (already covered, recorded for the triple's baseline)

Post-milestone standalone install rows:

- `alpha` (declaring `false`): `● mp [project]\n  ◍ alpha v1.0.0 (disabled) {installs disabled}\n    Run enable on this plugin to use its components.` — **no** `/reload` trailer.
- `beta` (declaring `true`) and `gamma` (silent): `● mp [project]\n  ● <name> v1.0.0 (installed)\n\n/reload to pick up changes` — byte-identical to the pre-milestone form for all three plugins.

## Reconcile Parity Boundary — where `true`/silent stops and `false` begins

The brief asked for the exact boundary. `[VERIFIED: extensions/pi-claude-marketplace/orchestrators/reconcile/plan.ts:1-66, apply.ts:576-640]`

**The planner never sees the field.** `orchestrators/reconcile/plan.ts` contains zero
occurrences of `defaultEnabled` (whole-tree grep). Its only enablement inputs are
`isDeclaredEnabled` (config side) and `isRecordedButDisabled` (state side), quoted from its
header verbatim:

> `Disabled-entry rule: a plugin entry with `enabled === false` is declared-but-disabled; `=== true` OR `undefined` is declared-and-enabled (D-04 consume-time default -- the absent field includes, only an explicit `false` excludes).`

So the planner's output is identical for all three declarations. The boundary is entirely
inside `apply.ts`, at exactly one expression:

```ts
if (result.status === "installed" && result.landedDisabled === true) {
```
`[VERIFIED: extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts:610]`

Above it, `applyPluginInstalls` passes `applyDefaultEnabled: true` unconditionally
(`apply.ts:596`) with this rationale, quoted verbatim:

> `DFEN-04 / D-102-04: unconditional on this path. A user who hand-adds a bare `"p@mp": {}` entry has declared WHICH plugin, not WHETHER it is enabled -- which is the gap the plugin's own `defaultEnabled` exists to fill. An entry that DOES carry `enabled` is untouched: the install's own precedence gate answers only the absent key.`

**What a parity test must hold constant to be meaningful.** The `true`/silent path must reach
the same `pluginsToInstall` bucket as the `false` path, or the comparison proves nothing about
the boundary. Hold these fixed across the triple:

1. **Same action bucket.** All three plugins must be fresh installs — declared in config,
   absent from state. A recorded plugin takes the enable/disable/no-action path instead and
   never reaches `applyPluginInstalls`.
2. **No `enabled` key in any of the three config entries.** An explicit `enabled` short-circuits
   the install's own precedence gate (`declaredEnabled === undefined`), which would make the
   `false` plugin behave like the `true` one and collapse the test.
3. **Same `configSource`.** `op.configSource === "local"` flips the write-back to
   `claude-plugins.local.json` (`apply.ts:604`). Declare all three in the same physical file.
4. **Same scope and same marketplace.** Scope selects the `ScopedLocations` bundle; a
   cross-scope triple would compare different write targets.

**And what a parity test must NOT assert.** Whole-message and whole-file comparisons are
polluted by the sibling under test:

- The three plugins share ONE notification, whose tally counts all three rows. A pre/post
  message-level comparison differs by the `alpha` row alone even though `beta`/`gamma` are
  identical.
- The `false` plugin's write-back **rewrites the whole `claude-plugins.json`**. My pre-milestone
  probe left the file exactly as the fixture wrote it (no write-back ran); the post-milestone
  run rewrote it, adding a trailing newline. The KEYS are byte-identical; the file is not.
  Assert `config.plugins["beta@mp"]` and `["gamma@mp"]` per entry, not the file.

This is the concrete reason CONTEXT's "the `true` and silent rows are asserted equal to each
other" says **rows** — the plan must honor the word.

## The grep gate already exists — do not rebuild it

CONTEXT reads as if the source-level gate is still to be built ("the gate should fail at the
TOKEN"). It was landed in the previous behavior phase and is green today.
`[VERIFIED: tests/architecture/no-lifecycle-default-enabled-read.test.ts:1-74, read this session]`

```ts
const FORBIDDEN_TARGETS: ReadonlyArray<string> = [
  "extensions/pi-claude-marketplace/orchestrators/plugin/update.ts",
  "extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts",
];

const FORBIDDEN_PATTERNS: ReadonlyArray<{ name: string; pattern: RegExp }> = [
  { name: "defaultEnabled reference", pattern: /\bdefaultEnabled\b/ },
  { name: "applyDefaultEnabled reference", pattern: /\bapplyDefaultEnabled\b/ },
];
```

Its header already records the two-pattern rationale (the short identifier is a strict suffix
of the long one, so a `\b`-anchored match on the short name does not fire inside the long one —
removing either leaves a real hole), the resolver carve-out (the gate forbids NAMING the field,
not obtaining the object that carries it, so both verbs keep calling `resolveStrict`), and the
comment-strip delegation to `tests/helpers/source-scan.ts`.

**Consequence for the plan:** the "pair the grep gate with a behavioral test" decision is
already half-satisfied. The phase owes the behavioral half only. Re-adding a second grep gate
would duplicate an existing passing test.

**One gap the existing gate does not cover, and which I closed by reading instead.** The gate
targets `update.ts` and `reinstall.ts` but not the shared helper both call.
`orchestrators/plugin/shared.ts::maybeWritePluginConfigBack` cannot stamp enablement — its
patch is the empty object literal `{}`:

```ts
  await writePluginConfigEntry(
    current,
    targetConfigPath,
    opts.locations.scopeRoot,
    opts.plugin,
    opts.marketplace,
    {},
  );
```
`[VERIFIED: extensions/pi-claude-marketplace/orchestrators/plugin/shared.ts:980-987]`

with the doc comment above it stating the rule verbatim: `D-04: update / reinstall preserves
the consume-time `enabled` default and any forward-compat keys; the patch carries no
per-operation mutation.` `[VERIFIED: shared.ts:951-953]` A whole-tree grep for
`defaultEnabled` in `extensions/` returns hits in only seven files — `domain/components/plugin.ts`,
`domain/resolver.ts`, `edge/handlers/plugin/install.ts`, `orchestrators/plugin/install.ts`,
`orchestrators/plugin/install.messaging.ts`, `orchestrators/reconcile/apply.ts`,
`orchestrators/reconcile/apply-outcomes.ts` — plus prose-only mentions in
`shared/notify.ts` and `shared/notify-reasons.ts`. Neither `update.ts`, `reinstall.ts`,
`shared.ts` nor `reconcile/plan.ts` appears.

## Parity Test Construction Guide — per surface

Each surface's fixture helper **already takes a `defaultEnabled` knob**. None needs a new
parameter. This is the single most plan-relevant finding after the probes.

### `update` → `tests/orchestrators/plugin/update.test.ts`

| Property | Value |
|----------|-------|
| Harness | `withHermeticHome` + `makeCtx()` (local, `tests/orchestrators/plugin/update.test.ts:70-106`) |
| Seeder | `seedPathMarketplace({ cwd, marketplaceRoot, marketplaceName, manifestPlugins })` |
| Multi-plugin? | **Yes** — `manifestPlugins` is a `Record<pluginName, spec>` |
| `defaultEnabled` knob? | **Yes** — `spec.entryDefaultEnabled?: boolean`, stamped on the MARKETPLACE ENTRY (the precedence-winning side) |
| Flip helper | `rewriteManifest(manifestPath, name, plugins)` — carries the same `entryDefaultEnabled` knob |
| Version-control knob | `spec.omitPluginJsonVersion: true` — required so `entry.version` reaches the record and a manifest rewrite is observably re-read (defeats the `(mtimeMs, size)` manifest cache passing for the wrong reason) |
| Nearest model test | `update.test.ts:3255` — `"DFEN-07 / D-103-10: update against a flipped defaultEnabled moves the version, not the enablement"` |

The model test already carries the flip-and-control discipline the parity test needs; it is
single-plugin and covers the `false` arm only. The parity test widens it to the triple.

### `reinstall` → `tests/orchestrators/plugin/reinstall.test.ts`

| Property | Value |
|----------|-------|
| Harness | `withHermeticHome` + `makeCtx()` (local) |
| Seeder | `seedMarketplace({ cwd, marketplaceRoot, pluginName?, version?, resources?, install?, entryDefaultEnabled?, applyDefaultEnabled? })` |
| Multi-plugin? | **Yes, by repeat call** — `mergeManifestEntry` (`:234-272`) reads the existing manifest and merges the new entry AND its declaration; the state seed merges `previousMarketplace?.plugins ?? {}`. Precedented at `reinstall.test.ts:3967` (keeper + sleeper). |
| `defaultEnabled` knob? | **Yes** — `entryDefaultEnabled` (manifest side) AND `applyDefaultEnabled` (lets the install honor it so a record lands disabled through the production path rather than by hand) |
| Nearest model tests | `:3898` (writes nothing, stages nothing), `:3939` (standalone row bytes), `:3967` (bulk cascade), `:4007` (flipped declaration does not move the record) |

Byte form the standalone case already pins, quoted verbatim from `:3958-3961`:

```ts
      assert.equal(
        notifications[0]?.message,
        "● mp [project]\n  ⊘ hello (skipped) {already disabled}",
      );
```

### `reconcile` → `tests/orchestrators/reconcile/apply.test.ts`

| Property | Value |
|----------|-------|
| Harness | `withHermeticHome(async ({ cwd, home }) => …)` — note the destructured `home`; the marketplace clone must live OUTSIDE the scope dir so the apply pass materializes from cache (NFR-5) |
| Seeder | `seedRealPathMarketplace({ parentDir, marketplaceName, pluginName, version, entryDefaultEnabled? })` |
| Multi-plugin? | **No** — `pluginName` is a scalar and the helper writes a single-entry `plugins: [ … ]` array (`apply.test.ts:1385-1396`) |
| `defaultEnabled` knob? | **Yes** — `entryDefaultEnabled?: boolean`, on the entry |
| Nearest model tests | `:1908` (base-declared bare entry installs disabled + gains `enabled:false`), `:2223` (`enabled:true` entry installs ENABLED and is left as written), `:2105` (three-reload fixed point) |

**This is the one helper that needs work.** Two viable shapes, both cheap:

1. Widen `seedRealPathMarketplace` to take `plugins: ReadonlyArray<{ name, version, entryDefaultEnabled? }>` while keeping the current scalar signature as a one-element convenience (every existing caller passes one plugin).
2. Call it three times against the same `parentDir` and merge manifests — but the helper
   OVERWRITES `marketplace.json` rather than merging (unlike reinstall's `mergeManifestEntry`),
   so this needs a merge step anyway. **Prefer option 1.**

My probe used the widened shape and it works unmodified against the production path.

## Pre-milestone byte forms — how to establish them, and whether you need to

CONTEXT rejects a recorded snapshot in favor of a self-contained triple, and that decision
holds: the `true` and silent rows agreeing with EACH OTHER is the whole assertion, because
pre-milestone the field was an unknown key under the D-09 lenient tolerance and therefore
inert — a `defaultEnabled: true` entry and a silent entry were literally the same input.

I nonetheless established the pre-milestone bytes empirically rather than reasoning to that
conclusion, because the brief asked for it and because a lenient-schema assumption is exactly
the kind of thing that is true until it is not. Method, if it ever needs repeating:

```bash
git worktree add --detach /tmp/pcm-premilestone bb6af555
ln -s /home/acolomba/pi-claude-marketplace/node_modules /tmp/pcm-premilestone/node_modules
# run the probe with imports pointed at /tmp/pcm-premilestone/extensions/...
git worktree remove --force /tmp/pcm-premilestone   # symlink removed first
```

`bb6af555` is the milestone base (`git merge-base HEAD main`); 118 commits separate it from
`895f0aaa`. The worktree was created and removed inside this session; `git worktree list` is
back to its original three entries and `git status --short` shows only the pre-existing
untracked `.verification-ledger.json`.

**The pre-milestone forms are recorded verbatim in Probe Results above.** They do not need to
be committed anywhere — the triple asserts against itself, which is what CONTEXT decided.

## Criterion 4 — costs nothing, and here is the proof

`[VERIFIED: tests/architecture/compat-01-no-expansion.test.ts, run this session — 14 tests, 14 pass, 0 fail]`

The complete diff of that file since the milestone base is one line:

```diff
       "malformed skill",
       "malformed command",
+      "installs disabled",
     ],
```

Appended at the tail of the `REASONS` enumeration, exactly as OUT-01 / D-09 / OUT-08 require.
Nothing else in the file moved. The file's fourteen tests pin, by name:

| Test | What it pins | Moved? |
|------|--------------|--------|
| `REASONS holds exactly its inherited members, in order` | Reason tuple membership + order | **+1 at tail** (intended) |
| `STATUS_TOKENS holds exactly its inherited members, in order` | Status token set | no |
| `PLUGIN_STATUSES holds exactly its inherited members, in order` | 19-member plugin status set | no |
| `MARKETPLACE_STATUSES holds exactly its inherited members, in order` | 7-member marketplace status set | no |
| `every glyph constant holds its inherited code point` | Glyph code points | no |
| `the catalog names each glyph the way the code-point pins above name it` | Catalog ↔ code glyph agreement | no |
| `the notify module declares no eighth glyph export` | Eighth-glyph tripwire | no |
| `the glyph-declaration pattern recognises every spelling a glyph export can take` | Tripwire's own detector | no |
| `the persisted install record holds exactly its inherited key set` | 9 keys, `enabled` already among them | no |
| `the install outcome inherits exactly the signals installPlugin populates` | 3 ledger signals | no |
| `no manifest-snapshot or orphan field reached the install record` | Negative key set | no |
| `the state schema version union is unchanged` | Schema version union | no |
| `the default state still declares the current schema version` | Default state | no |
| `the network clause is covered by the orchestrator-network gate` | NFR-5 delegation | no |

Two things worth stating explicitly so the planner does not go looking:

- **`enabled` was already a pinned install-record key.** DFEN-04 writes an existing field; no
  key joined the record. `[VERIFIED: compat-01-no-expansion.test.ts:345-357, key list quoted: "compatibility", "enabled", "hookEntries", "installedAt", "resolvedSha", "resolvedSource", "resources", "updatedAt", "version"]`
- **`landedDisabled` did not widen the pinned outcome shape.** The pinned set is the three
  LEDGER signals (`unsupported`, `orphanRewake`, `degradedKinds`); `landedDisabled` is a
  separate field on the install return, outside the `Omit`'d shape the test guards.

**Recommendation:** criterion 4 is satisfied by a plan task that RUNS the test and records the
one-line delta as evidence. Do not add a second no-expansion test — CONTEXT forbids it and
nothing is missing.

## DOC-01 Gap A — `reinstall`'s `(skipped) {already disabled}` catalog block

### The code path that emits it

Landed in the previous behavior phase as the ENBL-05 short-circuit, quoted verbatim:
`[VERIFIED: extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts:1216-1239 (git diff vs bb6af555)]`

```ts
  if (isRecordedButDisabled(oldRecord)) {
    return {
      outcome: {
        partition: "skipped",
        name: plugin,
        marketplace,
        scope,
        notes: ["already disabled"],
      },
      bridgeWarnings: [],
    };
  }
```

with a companion arm in `narrowReason` so the note maps to the closed-set token rather than
falling through to `"unreadable"`:

```ts
  if (note === "already disabled") {
    return "already disabled";
  }
```

### The exact byte forms

Standalone (`reinstallPlugin`, single cardinality — no tally, no reload hint, severity
`undefined`), pinned today by `reinstall.test.ts:3958`:

```text
● mp [project]
  ⊘ hello (skipped) {already disabled}
```

Bulk (`reinstallPlugins`, plural cardinality), from my probe:

```text
● mp [project]
  ⊘ alpha (skipped) {already disabled}
  ● beta v1.0.0 (reinstalled)
  ● gamma v1.0.0 (reinstalled)

Plugin reinstall: 3 successes

/reload to pick up changes
```

### The model block and the fixture shape

The exact analog already exists on the update side —
`### Disabled-record refresh, no flag needed (WR-04 / D-98-04)` at `docs/output-catalog.md:1111-1120`:

```markdown
### Disabled-record refresh, no flag needed (WR-04 / D-98-04)

<!-- catalog-state: disabled-record-refresh -->

```text
● mp [project]
  ⊘ hello (skipped) {already disabled}
```

<one dense prose paragraph naming the trigger, the severity, the cardinality, the tally, and the reload-hint>
```

Its fixture, quoted verbatim from `tests/architecture/catalog-uat.test.ts:2232-2253`:

```ts
    "disabled-record-refresh": {
      pi: piWithBothLoaded(),
      message: {
        label: "Plugin update",
        cardinality: "single",
        marketplaces: [
          {
            name: "mp",
            scope: "project",
            plugins: [
              {
                status: "skipped",
                severity: "info",
                needsReload: false,
                name: "hello",
                reasons: ["already disabled"],
              },
            ],
          },
        ],
      },
    },
```

A reinstall standalone block would be this fixture with `label: "Plugin reinstall"`, filed
under the `/claude:plugin reinstall` section key — and would render **byte-identical bytes** to
the update block, since `composeTally` returns `""` for `cardinality: "single"`.

**Recommendation:** document the **BULK** form instead. It teaches what the update block does
not — that the skip rides alongside live reinstalled rows, and that the tally counts the
info-severity skip as a success. The precedent for exactly that pairing is the neighbor block
at `docs/output-catalog.md:780-797`, quoted verbatim:

```text
A plugin operation has failed.

● official [user]
  ● alpha v1.0.0 (reinstalled)
  ⊘ beta (skipped) {up-to-date}
  ⊘ delta (failed) {source missing}

Plugin reinstall: 1 failure, 2 successes

/reload to pick up changes
```

> Mixed-outcome cascade. OUT-03/D-04: the plural tally counts the `failed` row as the one failure and the `reinstalled` + `(skipped) {up-to-date}` (idempotent -> info per D-01) rows as the two successes; zero-count categories (warnings) are omitted.

### The gate the block must satisfy

`tests/architecture/catalog-uat.test.ts` runs BOTH directions:
`[VERIFIED: catalog-uat.test.ts:4836 and :5078, read this session]`

- Forward walk (`:4836`): every `<!-- catalog-state: X -->` annotation must have a `FIXTURES[section][X]` entry and render byte-equal (plus severity equality). A missing fixture is a `missing-fixture` failure.
- Inverse walk (`:5078`): every `FIXTURES[section][state]` must have a matching catalog annotation, or it is an `[ORPHAN FIXTURE]`.

So the block and the fixture must land in the same change, keyed by the same `(section, state)`
pair. There is no duplicate-bytes guard, so an id colliding on bytes with another section's
block is legal. `[VERIFIED: no duplicate/Set/seen guard in catalog-uat.test.ts]`

## DOC-01 Gap B — the `(available)` token-table row

Both cells verbatim, current tree. `[VERIFIED: docs/output-catalog.md:143-144, read this session]`

**Line 143 — `(available)`, NOT updated:**

```markdown
| `(available)`            | ○    | Plugin row -- `marketplace list` / plugin-list surface (no scope bracket per MSG-PL-6 / SNM-11).                                                                                                                                                                                                                                                                                                                                                                                                                                    |
```

**Line 144 — `(remote)`, updated in the previous phase:**

```markdown
| `(remote)`               | ◌    | Plugin row -- list / info / install-completion surfaces for a not-installed git-source plugin whose clone/mirror is not yet materialized locally (RSTA-01 / D-80-03). No scope bracket (SNM-11), and no probe-derived or soft-dependency-derived reason brace -- no materialized tree exists to derive one from. It admits exactly one entry-derived token, the author-declared `{installs disabled}` install-time-state marker, which needs no tree because the marketplace entry is readable from the cached manifest (D-104-06). |
```

The asymmetry is real: both shapes gained `reasons?: readonly ContentReason[]` in the same
change. `[VERIFIED: shared/notify.ts:855 (PluginAvailableMessage) and :884 (PluginRemoteMessage) — both `readonly reasons?: readonly ContentReason[];`]` The `(available)` cell should gain a
matching clause. Note the table is pipe-aligned and mdformat owns the alignment — do not
hand-pad; run `pre-commit run --files docs/output-catalog.md` and let it re-align.

Also note: the token-table header sentence one line above declares "ONE row per member of the
19-member `PLUGIN_STATUSES` tuple", and the `(disabled)` row at the table's tail was already
widened in the previous phase to name the install surfaces and the `{installs disabled}` brace.
Only the `(available)` cell is outstanding.

## DOC-02 Fact Base

### What Claude Code actually does — verified LIVE this session

`[VERIFIED: code.claude.com/docs/en/plugins-reference, fetched 2026-08-15]`

The page's two override clauses, quoted verbatim:

> "an entry for the plugin in `enabledPlugins` at any settings scope. Once written, it persists across plugin updates and reinstalls, so changing `defaultEnabled` in a later release does not flip an existing user."

> "when a plugin is required by another one that is active, Claude Code writes `true` for it at install or enable time. That gives it an explicit setting, so its own default no longer applies."

Also confirmed on the same page: `defaultEnabled` is a boolean defaulting to `true`; it may
appear in `plugin.json` **and** in a marketplace entry, where the marketplace entry takes
precedence; it requires Claude Code v2.1.154+, and earlier versions ignore it and enable on
install.

This corroborates `REQUIREMENTS.md:12` exactly, including the "writes `true` explicitly" detail
that appears in only one in-repo place. It adds one fact the in-repo record does not carry: the
write happens **"at install or enable time"**, not install only.

### What this extension does instead — read from source

`[VERIFIED: extensions/pi-claude-marketplace/domain/components/plugin.ts:79-80 and :101, read this session]`

`dependencies` is accepted opaquely on BOTH declaration sites:

```ts
  // optional dependencies (MM-2 / PI-13: opaque, surfaces as warning)
  dependencies: Type.Optional(Type.Unknown()),
```

The single consumer is `info`. `[VERIFIED: extensions/pi-claude-marketplace/orchestrators/plugin/info.ts:342-353]`

```ts
function normalizeDependencies(raw: unknown): readonly string[] | undefined {
  if (!Array.isArray(raw)) {
    return undefined;
  }

  const strings = raw.filter((d): d is string => typeof d === "string");
  if (strings.length === 0) {
    return undefined;
  }

  return [...strings].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
}
```

So the accurate statement of our side is: **plugin `dependencies` are schema-accepted as
opaque, surfaced on `info` in string-shaped form only, never resolved, never auto-installed,
and never consulted for enablement.** No code path anywhere writes `enabled: true` on behalf of
a dependent plugin — the only writer of an explicit enablement value at install time is the
DFEN-04 write-back, and it writes `false`, never `true`.

The backlog's own framing, quoted verbatim: `[VERIFIED: .planning/BACKLOG.md:352-372]`

> **The finding, in short:** Claude Code's `plugin.json` `dependencies` field accepts array elements in two shapes -- a bare string (plugin name) or an object `{name, version, marketplace}` carrying a semver constraint -- confirmed against the official reference docs, not inferred. Upstream auto-resolves and auto-installs these; this repo intentionally stays opaque (no auto-resolution -- PI-13/PR-5, a standing scope decision, not in question here). … `claude:plugin info` -- `orchestrators/plugin/info.ts`'s `normalizeDependencies()` -- filters the `dependencies` array to `typeof d === "string"` only, silently dropping every object-shaped (version-pinned) entry.

**Naming-collision hazard the write-up must avoid.** `dependencies` is ALSO the name of the
SOFT-DEP companion field on `PluginInstalledMessage` / `PluginUpdatedMessage` /
`PluginReinstalledMessage` (`DEPENDENCIES` closed set: `agents` → `pi-subagents`, `mcp` →
`pi-mcp-adapter`). `[VERIFIED: docs/messaging-style-guide.md:61 and :67]` A `docs/plugin-enablement.md`
paragraph that says "dependencies" without qualification will read as the companion-extension
concept to anyone who knows the notify layer. Say "plugin `dependencies` declarations" or
"Claude plugin dependency declarations" every time.

### The second divergence — the entry-only read rule

The canonical home today is `entryDeclaresInstallDisabled`'s docblock in `domain/resolver.ts`
(the previous phase's WR-03 fix collapsed ten copies into one). The THREE-input rule that
actually shipped is stated correctly in `docs/output-catalog.md:380`; the contract document
must reproduce that version, not a two-input one:

1. The **marketplace entry**'s `defaultEnabled === false` is the manifest-side answer. The
   plugin's own `plugin.json` is deliberately never read on a read path (OUT-05: reading it
   would need a materialized clone, and fetching to get one violates NFR-5).
2. The **user's `enabled` value in `claude-plugins.json`** outranks it in EITHER direction —
   `rowClaimsInstallDisabled(entry, declaredEnabled)` is `declaredEnabled === undefined &&
   entryDeclaresInstallDisabled(entry)`, mirroring `install.ts`'s own gate.
3. The deliberate consequence: a config-chosen `enabled: false` **also renders the row BARE**,
   because the token names the AUTHOR-declared cause only.

## House Divergence Pattern — `docs/env-vars.md:129`

Concrete conventions, read this session. `[VERIFIED: docs/env-vars.md:118-172]`

| Convention | Observed form |
|-----------|---------------|
| Heading depth | `## Divergences and documented absences` (H2), each divergence an **H3** with a descriptive title — not an ID, not a question |
| Lead-in paragraph | One sentence stating the no-duplication rule, verbatim: *"The behaviors below are deliberate divergences from Claude Code or documented absences. Each is the single citable home for a caveat that the overview matrix and per-surface tables mark with a footnote -- the caveat text is not duplicated elsewhere."* |
| Body form | ONE dense paragraph per H3. No bullets inside a divergence unless it has genuinely parallel consequences (only "MCP runtime env inheritance" uses them, for its two-consequence split) |
| ID citation | Requirement/decision IDs inline in parentheses at the point of claim (`MENV-02`, `SUB-02`, `PENV-01, D-90-01`, `SENV-03, D-91-02`) — never as a heading |
| "Footnote-marker" mechanism | **Not a superscript footnote.** The overview matrix uses a `⚠` glyph in the support column plus a literal `See "<H3 title>"` pointer in the Notes cell. Example, verbatim from `:122`: <code>\| `CLAUDE_PROJECT_DIR` \| ✓ \| ⚠ \| Injected for project-scope installs only (MENV-03). See "User-scope `${CLAUDE_PROJECT_DIR}` pass-through". \|</code> |
| Sibling section | `## Not delivered (out of scope)` (H2) for absences that are not divergences, as **bold-lead bullets**: `- **`CLAUDE_EFFORT`** -- a Pi `thinkingLevel` mapping is possible but semantically approximate; deferred (EFRT-01).` |
| Affirmative-absence idiom | A closing clause: *"Two absences are recorded affirmatively rather than by silence:"* followed by bullets — this is exactly the "a reader can tell a stated limit from an oversight" mechanism the phase goal names |
| Enforcement | **None.** `docs/env-vars.md` has no test gate; `tests/docs/` does not exist despite appearing in the `npm test` glob. The no-duplication rule is a documented convention, not a gate. |

**Consequence for the plan.** `docs/plugin-enablement.md` will be **ungated** by default. The
catalog is the only byte-gated doc in the repo. If the phase wants the new document defended,
it must add a gate deliberately; otherwise say so plainly rather than letting a reader assume
the contract is enforced. A cheap, precedented option is a grep-style architecture test in the
`assertNoForbiddenSurface` family asserting the source comments' anchor string resolves — but
this is Claude's discretion and nothing requires it.

## The hollow-guard deletion — exact range, and the dangling reference nobody named

### The hollow block

`[VERIFIED: tests/orchestrators/plugin/list.test.ts:2966-2998, read this session]`

The test is `RSTA-01 / NFR-5: list renders an uninstalled git plugin (remote) with no plugin-clones dir on disk (no clone, no network)` spanning **`:2966-2998`**. The hollow guard is
the block at **`:2980-2991`**, verbatim:

```ts
    // No plugin-clones/ directory is ever created; a clone (or any network
    // touch) would have to materialize one. Its absence after the render proves
    // the surface neither cloned nor fetched.
    const clonesDir = path.join(userRoot, "pi-claude-marketplace", "plugin-clones");
    let clonesExisted = true;
    try {
      await readFile(clonesDir);
    } catch {
      clonesExisted = false;
    }

    assert.equal(clonesExisted, false);
```

Both faults confirmed by reading: `readFile` on a directory throws `EISDIR` whether or not the
directory exists, so `clonesExisted` is unconditionally `false`; and the block sits at `:2980`
while the `listPlugins` call it means to constrain is at `:2994` — the probe runs BEFORE the
call, describing the fixture rather than the render.

### The correct sibling

`[VERIFIED: tests/orchestrators/plugin/list.test.ts:568-628]` — `OUT-05 / NFR-5 / RSTA-01: the cold `(remote)` claim is rendered with NO clone directory on disk after the call returns`. It
uses `stat` (metadata, not content), runs strictly AFTER the await, and asserts the caught
error's `code`:

```ts
    const locations = locationsFor("user", cwd);
    let probeCode: unknown;
    try {
      await stat(locations.pluginClonesDir);
    } catch (err) {
      probeCode = (err as { code?: unknown }).code;
    }

    assert.equal(probeCode, "ENOENT", "plugin-clones/ must not exist after the render");
```

### Does deleting remove unique coverage?

**Deleting the BLOCK removes none.** The offline claim is covered by the sibling at `:568`
(list surface, `stat`+ENOENT after the call) and by `info.test.ts:3063` (call-count assertion
on an injected git-ops mock — a strictly stronger claim).

**Deleting the whole TEST would remove one thin thing:** the assertion at `:2996`
(`assert.match(out, /◌ gplug v1\.0\.0 \(remote\)/)`) is the only place a git-source uninstalled
plugin renders a BARE `(remote)` row seeded through `seedMarketplace` with a plain
`https://example.com/repo` source. The nearest equivalents are `:561` (`◌ epsilon v1.0.0 (remote)`,
a bare row in the OUT-02 triple) and `:595` (a declaring `(remote)` row).

**Recommendation: delete lines `2980-2992` (the comment, the probe and the assert, plus the
trailing blank), keep the test.** That removes the false coverage and keeps the `(remote)`
render assertion. CONTEXT's phrasing ("DELETE the hollow NFR-5 guard") reads naturally as the
guard, not the test.

### The dangling reference the plan must also fix

The SIBLING test's comment explicitly points at the hollow block and instructs a future reader
not to harmonize toward it. Verbatim, `list.test.ts:615-617`:

```ts
    // A similar block near the tail of this file has both of those faults. It is
    // pre-existing and out of scope here, and it is deliberately left as found
    // -- do not harmonize this probe toward it.
```

Once the hollow block is gone this sentence points at nothing and will confuse the next reader
into hunting for a block that does not exist. **The deletion is a two-file-region change, not
one.** Neither CONTEXT nor the STATE backlog names this consequence; the plan must.

## IN-01..IN-04 — file, current text, minimal correct fix

### IN-01 — `(available)` token-table row

- **File:** `docs/output-catalog.md:143`
- **Current text:** quoted verbatim under **DOC-01 Gap B** above.
- **Minimal fix:** append a clause to the "Where it appears" cell naming the admitted token, mirroring the `(remote)` cell's phrasing but without the git/cold-clone framing (which does not apply to `(available)`). The review's own suggestion: *"...(no scope bracket per MSG-PL-6 / SNM-11). Admits the entry-derived `{installs disabled}` install-time-state marker (D-104-03)."* Note the anchor differs by arm — `D-104-03` for `(available)`, `D-104-06` for `(remote)` — and both are phase decision IDs that archive; consider re-anchoring both to the new `OUT-02`/`OUT-05` requirement text as part of the same pass (see Decision Conflicts).
- **Overlaps:** this IS DOC-01 Gap B. One edit closes both.

### IN-02 — network-free gate docstring and failure message

- **File:** `tests/architecture/no-orchestrator-network.test.ts:5-52` (header), `:101` (failure message).
- **Current state, verified by reading:** `FORBIDDEN_TARGETS` holds **11** entries; the header's "Forbidden surface, by file:" enumeration lists **5** (`install.ts`, `list.ts`, `reinstall.ts`, `plugin/info.ts`, `marketplace/info.ts`). The six not in the header are `reconcile/pending.ts`, `reconcile/plan.ts`, `reconcile/notify.ts`, `enable-disable.ts`, `fetch.ts`, `domain/resolver.ts` — all six DO carry inline rationale comments beside their array entries, so the information exists; it is the header enumeration that is stale.
- **The failure message, verbatim (`:101`):**
  ```
  `NFR-5 / PI-2 / PL-3 / PRL-07 violation: gitOps surface detected in plugin orchestrator(s):\n  ${offenders.join("\n  ")}\n  (install.ts, list.ts, and reinstall.ts are network-free by contract; only update.ts is permitted to import gitOps via Pattern S-9.)`
  ```
  Two staleness faults: `plugin orchestrator(s)` will misdescribe a `domain/resolver.ts` offender, and the parenthetical names three of the eleven targets.
- **Minimal fix:** (a) add a `domain/resolver.ts` bullet to the header enumeration and the five missing orchestrator entries, or — cheaper and drift-proof — replace the hand-maintained enumeration with a pointer sentence to the annotated `FORBIDDEN_TARGETS` array below it; (b) reword the message subject to `network-free module(s)` and generalize the parenthetical to `(every target above is network-free by contract; among the gated orchestrator candidates only update.ts is permitted the gitOps surface via Pattern S-9.)`.
- **Risk note:** the header is inside a `/** … */` block that `stripComments` removes before matching, so it may legally name the forbidden tokens. Editing it cannot break the gate.

### IN-03 — out-of-scope doc edits in the style guide

- **File:** `docs/messaging-style-guide.md:66`.
- **Current text (one sentence, both sub-edits inside it):**
  > `- `reasons: readonly Reason[]` REQUIRED only on `partially-available | unavailable | upgradable | skipped | failed | manual recovery` (D-15-01). It is OPTIONAL on four transition variants -- `installed` (SURF-05 / D-63-08), `updated` (WARN-01 / WR-12), `reinstalled` (WARN-01 / WR-09) and `disabled` (ENBL-16 / D-100-07) -- which carry a brace only when their ledger produced a fact worth naming, and render byte-identically to a reasons-less row when it did not. It is OPTIONAL on two not-installed candidate variants as well, `available` (OUT-02 / D-104-03) and `remote` (OUT-05 / D-104-06), where the brace states what an install WOULD do rather than what one did. Read `notify.ts` for which shapes declare the field; the variants that omit it cannot acquire one, so `(uninstalled) {up-to-date}` is a compile error.`
- **Sub-edit (a) — the `disabled` correction. I verified it is TRUE, and pre-existing.** `git show bb6af555:.../notify.ts` shows `PluginDisabledMessage` at `:791-798` already declaring `readonly reasons?: readonly ContentReason[];`. So the old "exactly three" was a genuine doc error predating this milestone, and the new "four … and `disabled`" is correct. **Recommendation: KEEP the correction and flag it in the phase summary** — the review offered exactly this option ("or leave it, but flag it in the summary rather than folding it in silently"), and reverting a true statement to a false one to satisfy a scope rule is the worse trade.
- **Sub-edit (b) — the enumerable clause. Restore it.** `Read `notify.ts` for which shapes declare the field` replaced `Every remaining variant omits the field entirely` — trading a checkable spec statement for a pointer at the implementation, in the one document whose job is to be the spec. **Recommendation: restore**, producing a tail of: `Every remaining variant omits the field entirely, so `(uninstalled) {up-to-date}` is a compile error.` Note the current text already ends with a semantically similar clause (`the variants that omit it cannot acquire one, so …`), so this is a mid-sentence replacement, not an append.

### IN-04 — `installsDisabledField` typed off one of its two consumers

- **File:** `extensions/pi-claude-marketplace/orchestrators/plugin/list.ts:674-676`.
- **Current text, verbatim:**
  ```ts
    const installsDisabledField: {
      readonly reasons?: NonNullable<PluginAvailableMessage["reasons"]>;
    } = claimsInstallDisabled ? { reasons: ["installs disabled"] } : {};
  ```
- **The two consumers, verified by reading every spread site** (`grep -n installsDisabledField` returns exactly `:635` (a comment), `:674` (the declaration), `:710`, `:753`):
  - `:710` — spread into a **`PluginRemoteMessage`** literal (`status: "remote"`).
  - `:753` — spread into a **`PluginAvailableMessage`** literal (`status: "available"`).
  - The `partially-available` arm at `:769-779` does **not** use the field; its `reasons` is REQUIRED, so it composes `"installs disabled"` into an existing array at the tail (`:773-776`). Any fix must leave that arm alone.
- **Why it compiles today and why that is fragile:** both shapes declare the field identically. `[VERIFIED: shared/notify.ts:855 `readonly reasons?: readonly ContentReason[];` and :884 `readonly reasons?: readonly ContentReason[];`]` A future narrowing of either surfaces the error at a site whose annotation names the other one.
- **The right typing, not just the smell.** Three candidates:

  | Option | Form | Assessment |
  |--------|------|------------|
  | A (review's suggestion) | `{ readonly reasons?: readonly ContentReason[] }` | Names the domain type both shapes actually use. **Requires importing `ContentReason`** — `list.ts` does not currently reference it (grep returns zero hits). `ContentReason` is exported from `shared/notify.ts:209` as `Exclude<Reason, "not added">`. One added type-only import. |
  | B | `NonNullable<PluginAvailableMessage["reasons"] & PluginRemoteMessage["reasons"]>` | Literally the intersection of the two consumers, so it tracks a narrowing of EITHER. No new import. Denser to read; `&` over two identical `readonly ContentReason[]` collapses to the same type today. |
  | C | `{ readonly reasons?: NonNullable<PluginAvailableMessage["reasons"]> & NonNullable<PluginRemoteMessage["reasons"]> }` | Same as B, verbose. |

  **Recommendation: A.** It is what the values ARE — the array elements are `ContentReason`
  literals — and the type-only import is a one-line, convention-conformant addition (`import type`
  group, alphabetized, last). B is cleverer but encodes the consumer list into a type expression
  that a third consumer would silently not join; A degrades gracefully. Whichever is chosen, the
  existing comment above the declaration (`INV-01: same conditional-spread idiom … NonNullable
  because the indexed access on an optional property yields | undefined, which the target rejects`)
  becomes partly stale under A and needs a one-line edit.
- **Verification for the fix:** `npm run typecheck` plus the `list.test.ts` suite. Behavior cannot change — the annotation constrains an object literal that is already correct.

## Decision Conflicts

Flagged explicitly rather than planned around, per the brief.

### DC-1 — CONTEXT reads as if the grep gate is still to be built; it exists and passes

`tests/architecture/no-lifecycle-default-enabled-read.test.ts` (74 lines, both targets, both
patterns, green) landed in the previous behavior phase. CONTEXT's decision ("Pair the grep gate
with a behavioral test rather than choosing between them") is **already half-satisfied**. No
decision needs reversing; the planner needs to know so the phase does not build a duplicate.
Suggested plan framing: one task that RUNS the existing gate and records it as the structural
half, plus the two behavioral tests.

### DC-2 — The phase goal's dependency wording contradicts `info.ts`

Success criterion 3 and the CONTEXT deferred-ideas entry both say plugin dependency
declarations are "dropped entirely today". Against `info.ts::normalizeDependencies` (quoted
above) that is false: string-shaped entries ARE rendered on `info`; only object-shaped
(version-pinned) entries are dropped, which is precisely the PDEP-01 defect. Writing "dropped
entirely" into `docs/plugin-enablement.md` would create exactly the class of
requirement-contradicts-implementation drift this phase exists to fix — the same fault as
`OUT-02`'s "resolved `defaultEnabled`".

**Recommended wording for the write-up:** *plugin `dependencies` declarations are accepted
opaquely by the schema and surfaced on `info` in string-shaped form only; they are never
resolved, never auto-installed, and never consulted for enablement, so no code path can write
the explicit `true` upstream writes.* This is what is true and it still supports DOC-02's point
in full.

### DC-3 — The upstream fact is slightly wider than the in-repo record

`REQUIREMENTS.md:12` says the dependency override happens at install; the live page says
**"at install or enable time"**. Minor, but DOC-02 should carry the verified wording. Also
worth noting: `.planning/BACKLOG.md:225` records the override WITHOUT the "writes `true`
explicitly" detail, while `REQUIREMENTS.md:12` has it. Both are now confirmed correct against
the live page — no conflict, just two records at different resolutions.

### DC-4 — The hollow-guard deletion has an unnamed second edit

See "the dangling reference the plan must also fix" above. `list.test.ts:615-617` points at the
block being deleted. In scope by necessity, not named by CONTEXT.

### DC-5 — CONTEXT's "one fixture, three plugins" needs a row-level qualifier

Not a reversal — CONTEXT already says "the `true` and silent ROWS are asserted equal". But the
plan must make the qualifier explicit, because the natural implementation (assert the whole
notification string) is polluted by the sibling: the cascade tally counts all three plugins,
and the declaring-`false` plugin's write-back rewrites the entire config file. See Reconcile
Parity Boundary for the four invariants and the two forbidden assertion shapes.

### DC-6 — `D-104-0N` anchors are phase decision IDs and will archive

CONTEXT's own second contradiction bullet says source comments citing `D-104-01` should be
re-pointed at DOC-02's durable home. The same problem applies to `D-104-03` and `D-104-06`,
which appear in `docs/output-catalog.md:144`, `docs/messaging-style-guide.md:66`, and several
source/test comments. Whether the re-anchoring extends beyond `D-104-01` is a scope call the
plan should make consciously rather than by omission.

## Common Pitfalls

### Pitfall: proving "the field is never re-read" against an unchanged manifest

**What goes wrong:** installing and updating against the same manifest cannot tell "never
re-read the field" apart from "re-read it and got the same answer". A test that does this
passes forever and proves nothing.
**How to avoid:** flip the declaration between the install and the lifecycle verb, and carry a
CONTROL in the same rewrite (a version bump) so a rewrite the manifest cache declined to notice
fails visibly instead of passing for the wrong reason.
**Warning signs:** the test has no assertion that something DID move.
**Precedent:** `update.test.ts:3236-3253` states this argument in full; my probe applied it and
the version moved `1.0.0 → 2.0.0` on all three plugins while enablement moved on none.

### Pitfall: the marketplace manifest cache silently serving the old entry

**What goes wrong:** `marketplace.json` is served from a process-lifetime cache keyed on
`(mtimeMs, size)`. A rewrite the cache declines to notice leaves the verb looking at the OLD
entry, so an enablement assertion passes against a manifest that never changed.
**How to avoid:** seed with `omitPluginJsonVersion: true` so `entry.version` reaches the record,
and assert the version moved. Also: two rewrites within the same millisecond that produce the
same byte length are indistinguishable to the cache — change the version string length if a
fixture ever needs two rewrites in a row.

### Pitfall: whole-message assertions in a mixed-declaration cascade

**What goes wrong:** the tally line and the summary line are computed over ALL rows, so the
declaring-`false` plugin changes the message bytes even when the `true`/silent rows are
identical. A whole-message pre/post comparison fails and looks like a parity break.
**How to avoid:** extract and compare the individual row lines.

### Pitfall: whole-file config assertions in a reconcile parity test

**What goes wrong:** the `false` plugin's write-back rewrites `claude-plugins.json` in full
(including its trailing-newline convention), so a whole-file comparison against a
pre-milestone capture differs even though every `true`/silent entry is byte-identical.
**How to avoid:** assert `config.plugins["<name>@<mp>"]` per entry.
**Evidence:** observed directly in my probe — pre-milestone the file was never rewritten and
kept the fixture's exact bytes; post-milestone it was rewritten and gained a trailing newline,
while `"beta@mp": {}` and `"gamma@mp": {}` stayed identical.

### Pitfall: reading the reinstall tally as a bug

**What goes wrong:** `Plugin reinstall: 3 successes` over 2 reinstalled + 1
`(skipped) {already disabled}` looks like a mis-tally.
**Why it is correct:** the default tally counts operation rows uniformly by severity, and
`already disabled` is in the idempotent closed set so `skipSeverity` returns `info`. Precedented
in the catalog at `:792` (`1 failure, 2 successes` where one success is a `{up-to-date}` skip).
`update` looks different only because it takes the UGRM-02 tally override (`2 updated`), which
counts realized transitions and skips the info-row math entirely.

### Pitfall: running prettier on the markdown

**What goes wrong:** `npm run format` covers only js/json/ts; markdown is owned by **mdformat**
via pre-commit. `prettier --write docs/*.md` reformats tables the repo does not want reformatted.
**How to avoid:** `pre-commit run --files docs/output-catalog.md docs/plugin-enablement.md docs/messaging-style-guide.md`.

### Pitfall: a catalog block without its fixture (or the reverse)

**What goes wrong:** `catalog-uat.test.ts` gates BOTH directions. An annotation without a
fixture fails `missing-fixture`; a fixture without an annotation fails the inverse walk as
`[ORPHAN FIXTURE]`. They must land in the same change, keyed by the same `(section, state)`.

### Pitfall: committing from the worktree

**What goes wrong:** the trufflehog pre-commit hook runs in git mode and cannot read
`.git/index` in a linked worktree, aborting structurally.
**How to avoid:** run the filesystem-mode scan documented in CLAUDE.md over the changed paths
first, then `SKIP=trufflehog git commit`. Do not extend `SKIP=` to other hooks.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Proving a token is unreachable in a source file | A bespoke `readFile` + regex in the test | `assertNoForbiddenSurface` (`tests/helpers/source-scan.ts`) | Strips comments before matching, so a source header that documents the rule in prose does not fail the gate on its own subject (D-98-09 / D-98-10). |
| A second closed-set no-expansion check | A new architecture test beside compat-01 | `tests/architecture/compat-01-no-expansion.test.ts` unchanged | It already pins all four sets by enumeration equality plus glyphs, record keys and schema version; CONTEXT forbids a second one. |
| A recorded pre-milestone snapshot file | A committed golden-output fixture | The self-contained declaring/true/silent triple | A snapshot rots and does not survive the milestone archive; the triple asserts against itself. |
| Byte-comparing catalog examples | A hand-written renderer call in a new test | The existing `catalog-uat.test.ts` forward + inverse walk | Already covers annotation↔fixture pairing in both directions plus severity equality. |
| A new fixture builder for the triple | A fresh seeder per surface | The three existing per-surface helpers, all of which already take `entryDefaultEnabled` | Only `seedRealPathMarketplace` (reconcile) needs widening, and only from scalar to array. |

**Key insight:** this phase's entire test surface is already built; what is missing is three
assertions and one helper signature. Any plan that introduces a new harness is doing the wrong
work.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | `node:test` (Node's built-in runner), Node v22.22.2 with native TS type-stripping |
| Config file | none — driven by `package.json` scripts and a path glob |
| Quick run command | `node --test tests/orchestrators/plugin/update.test.ts tests/orchestrators/plugin/reinstall.test.ts tests/orchestrators/reconcile/apply.test.ts tests/orchestrators/plugin/list.test.ts tests/architecture/catalog-uat.test.ts tests/architecture/compat-01-no-expansion.test.ts` |
| Full suite command | `npm test` |
| Full gate | `npm run check` (typecheck + lint + format:check + test) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DFEN-08 | `update` — declaring-`true` and silent rows identical to each other, and the flipped declaration moves nothing | unit/integration | `node --test tests/orchestrators/plugin/update.test.ts` | ✅ file exists; new test needed |
| DFEN-08 | `reinstall` — same, over the bulk cascade | unit/integration | `node --test tests/orchestrators/plugin/reinstall.test.ts` | ✅ file exists; new test needed |
| DFEN-08 | `reconcile` — same, plus per-entry config byte stability, plus a silent second pass | integration | `node --test tests/orchestrators/reconcile/apply.test.ts` | ✅ file exists; new test needed; `seedRealPathMarketplace` needs an array shape |
| DFEN-08 | Structural half for the two lifecycle verbs | architecture | `node --test tests/architecture/no-lifecycle-default-enabled-read.test.ts` | ✅ **exists and passes — no work** |
| DFEN-08 | `list` / `info` / `install` arms | already covered | `node --test tests/shared/notify-not-installed-reasons.test.ts tests/orchestrators/plugin/list.test.ts tests/orchestrators/plugin/info.test.ts tests/orchestrators/plugin/install.test.ts` | ✅ exists; not re-proven per CONTEXT |
| DOC-01 | The reinstall block renders byte-equal to its fixture, both walk directions | architecture | `node --test tests/architecture/catalog-uat.test.ts` | ✅ file exists; new block + fixture needed |
| DOC-01 | The `(available)` cell edit | manual-only | — | Prose in a non-gated table cell; no byte gate covers the token-reference table's text. Verify by reading. |
| DOC-02 | The contract document | manual-only | — | `docs/` prose has no test gate outside `output-catalog.md`; see House Divergence Pattern. Justified: the requirement is that a reader can find a stated limit, which no assertion expresses. |
| Criterion 4 | Exactly one `REASONS` delta, nothing else moved | architecture | `node --test tests/architecture/compat-01-no-expansion.test.ts` | ✅ **exists and passes 14/14 — no work** |
| IN-02 | Gate docstring/message accuracy | architecture (regression only) | `node --test tests/architecture/no-orchestrator-network.test.ts` | ✅ exists; comment-only edit must keep it green |
| IN-04 | Type precision | typecheck | `npm run typecheck && node --test tests/orchestrators/plugin/list.test.ts` | ✅ exists |

### Sampling Rate

- **Per task commit:** the quick run command above (≈8s for the six files; measured 312 tests / 7.97s this session).
- **Per wave merge:** `npm test`.
- **Phase gate:** `npm run check` green before `/gsd-verify-work`.

### Wave 0 Gaps

None. Every test file the phase needs already exists and is green. The only structural
prerequisite is widening `seedRealPathMarketplace` in `tests/orchestrators/reconcile/apply.test.ts`
from a scalar `pluginName` to a plugin array — a change inside a test file, not new
infrastructure.

## Security Domain

`security_enforcement` is absent from `.planning/config.json`, so it is treated as enabled.
`[VERIFIED: .planning/config.json read this session — no `security` key]`

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Phase touches no auth surface. |
| V3 Session Management | no | No session state. |
| V4 Access Control | no | No access-control decision. |
| V5 Input Validation | **no new surface** | The only third-party input in scope, `defaultEnabled`, is validated by `Type.Optional(Type.Boolean())` in `PLUGIN_METADATA_FIELDS` and landed in a previous phase. This phase adds no parser, no new field, and no new file read. |
| V6 Cryptography | no | None. |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| A plugin release flipping `defaultEnabled` to re-enable a plugin a user disabled (third-party content as a remote switch) | Tampering / Elevation | Already mitigated by DFEN-07 and gated two ways: `no-lifecycle-default-enabled-read.test.ts` (structural) and the behavioral tests this phase adds. **This phase's parity tests are the second half of that mitigation's proof.** |
| A documentation change asserting a security-relevant guarantee the code does not provide | Repudiation | `docs/plugin-enablement.md` must state the THREE-input rule that shipped, not the two-input version — see DC-2 and the OUT-02 amendment. |

No new attack surface. The phase adds tests, documentation, one type annotation, and one test
deletion.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | test runner, TS stripping | ✓ | v22.22.2 (>= 20.19.0 required) | — |
| npm | scripts | ✓ | 10.9.7 | — |
| `node_modules` in the worktree | all suites | ✓ | present (`typebox`, `memfs`, `isomorphic-git`, …) | — |
| `pre-commit` | commit gate | ✓ (repo `.pre-commit-config.yaml` present; cache at `$PRE_COMMIT_HOME`) | — | filesystem-mode trufflehog scan per CLAUDE.md |
| `git worktree` at the base commit | pre-milestone baseline (research only) | ✓ (used and removed this session) | — | not needed by the plan — the triple asserts against itself |
| Network | DOC-02 upstream verification | ✓ (used this session) | — | The verbatim quote is recorded in this document; no further fetch needed. |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** none.

**Baseline measured this session:**

| Check | Result |
|-------|--------|
| `node --test` over `update` + `reinstall` + `reconcile/apply` + `list` + `catalog-uat` + `no-lifecycle-default-enabled-read` | 312 tests, 312 pass, 0 fail |
| `node --test tests/architecture/compat-01-no-expansion.test.ts` | 14 tests, 14 pass, 0 fail |
| `git status --short` | clean but for the pre-existing untracked `.verification-ledger.json` |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | A reinstall catalog block documenting the BULK form teaches more than the standalone form (which would render bytes identical to the existing update block). | DOC-01 Gap A | Style preference only; either form passes the gate. Discretion per CONTEXT. |
| A2 | Option A (`readonly ContentReason[]`) is the better IN-04 typing than the two-consumer intersection. | IN-04 | A judgment about which type degrades better under a third consumer; both compile and both fix the stated smell. |
| A3 | Keeping IN-03's `disabled`-variant correction (rather than reverting it) is the right disposition. | IN-03 | The correction is verified TRUE against `bb6af555`'s `notify.ts`; the risk is a scope-purity objection, not a correctness one. The review explicitly offered "leave it, but flag it". |
| A4 | Deleting the hollow probe BLOCK (not the whole test) is what CONTEXT means by "DELETE the hollow NFR-5 guard". | Hollow-guard deletion | If the intent was the whole test, the `(remote)` bare-row assertion at `:2996` goes with it — thin but non-zero coverage. Worth one confirming sentence in the plan. |
| A5 | `docs/plugin-enablement.md` should be left ungated, matching `docs/env-vars.md`. | House Divergence Pattern | If the phase wants the contract defended, a gate must be added deliberately; the assumption is that matching the house pattern is preferred. |

## Open Questions

1. **Does the `D-104-0N` re-anchoring extend past `D-104-01`?**
   - What we know: CONTEXT names `D-104-01` specifically. `D-104-03` and `D-104-06` are cited in `docs/output-catalog.md:144`, `docs/messaging-style-guide.md:66`, `list.ts`, `info.ts` and both warm-clone tests, and archive on the same schedule.
   - What's unclear: whether the phase re-anchors all three or only the one CONTEXT named.
   - Recommendation: re-anchor all three to the amended `OUT-02` / `OUT-05` text and the new document, in one pass. Doing one and leaving two is the drift pattern the phase exists to close. Surface the widening in the plan rather than doing it silently.

2. **Does `docs/plugin-enablement.md` need an entry in any index?**
   - What we know: `docs/` has no index file; `README.md` links some docs.
   - What's unclear: whether a new top-level doc is expected to be linked from `README.md` or `docs/messaging-style-guide.md`.
   - Recommendation: grep `README.md` for how `docs/env-vars.md` and `docs/output-catalog.md` are referenced and match that treatment; a document nobody links is a document nobody finds, which defeats "a reader can tell this is a stated limit".

3. **Should the reconcile parity test also pin the SECOND pass silence for the `true`/silent arm?**
   - What we know: my probe confirmed pass 2 is silent on both trees; DFEN-06's fixed-point tests (`apply.test.ts:2105`, `:2179`) already pin it for the `false` arm.
   - What's unclear: whether pass-2 silence for `true`/silent is DFEN-08 scope or DFEN-06 scope.
   - Recommendation: include it — it is one extra assertion in a fixture that already exists, and it is the clearest single expression of "nothing about these plugins changed".

## Sources

### Primary (HIGH confidence)

Executed this session:

- Probe runs of `installPlugin`, `updatePlugins`, `reinstallPlugins`, `applyReconcile` against the current tree and against a detached worktree at `bb6af555` — all byte forms in Probe Results.
- `node --test` over `update.test.ts`, `reinstall.test.ts`, `reconcile/apply.test.ts`, `list.test.ts`, `catalog-uat.test.ts`, `no-lifecycle-default-enabled-read.test.ts` — 312/312.
- `node --test tests/architecture/compat-01-no-expansion.test.ts` — 14/14.
- `git diff bb6af555 HEAD -- tests/architecture/compat-01-no-expansion.test.ts` — the one-line delta.
- `git show bb6af555:extensions/pi-claude-marketplace/shared/notify.ts` — `PluginDisabledMessage` pre-milestone shape.

Read this session (path + line range cited at each claim):

- `extensions/pi-claude-marketplace/domain/components/plugin.ts` (whole file)
- `extensions/pi-claude-marketplace/orchestrators/plugin/list.ts:605-790`
- `extensions/pi-claude-marketplace/orchestrators/plugin/shared.ts:940-989`
- `extensions/pi-claude-marketplace/orchestrators/reconcile/plan.ts:1-120`
- `extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts:89-105, 555-640, 1365-1405`
- `extensions/pi-claude-marketplace/shared/notify.ts:90-140, 812-826, 850-942, 2930-3040`
- `extensions/pi-claude-marketplace/shared/notify-reasons.ts:1-68`
- `tests/architecture/no-lifecycle-default-enabled-read.test.ts` (whole file)
- `tests/architecture/no-orchestrator-network.test.ts:1-105`
- `tests/architecture/compat-01-no-expansion.test.ts:126-435`
- `tests/architecture/catalog-uat.test.ts:2227-2253, 4836, 5078-5125`
- `tests/orchestrators/plugin/list.test.ts:560-640, 2955-2999`
- `tests/orchestrators/plugin/update.test.ts:1-360, 3230-3345`
- `tests/orchestrators/plugin/reinstall.test.ts:105-300, 3898-4045`
- `tests/orchestrators/reconcile/apply.test.ts:1330-1450`
- `docs/output-catalog.md:125-160, 780-800, 1111-1150`
- `docs/env-vars.md:118-172`
- `docs/messaging-style-guide.md:60-70`
- `.planning/BACKLOG.md:215-245, 343-390`
- `.planning/config.json`, `CLAUDE.md`, `.claude/rules/typescript-comments.md`

### Secondary (MEDIUM confidence)

- `code.claude.com/docs/en/plugins-reference` — fetched 2026-08-15; the two override clauses quoted verbatim in DOC-02 Fact Base. MEDIUM rather than HIGH because it is a single-source fetch through a summarizing reader, though it corroborates two independent in-repo records dated 2026-08-13 and 2026-08-14.

### Tertiary (LOW confidence)

- None. Every claim in this document is either executed, read from a cited file range, or the one fetched page above.

## Metadata

**Confidence breakdown:**

- Parity behavior across the three surfaces: **HIGH** — run on both trees, byte forms recorded verbatim, flip-plus-control discipline applied.
- Existing test/gate inventory: **HIGH** — every cited file opened and, where relevant, executed.
- Criterion 4: **HIGH** — the test was run and its complete diff since the base commit inspected.
- Catalog mechanics and the reinstall gap: **HIGH** — model block, its fixture, and both gate directions read directly.
- DOC-02 upstream facts: **HIGH for our side** (source read), **MEDIUM for Claude Code's side** (single live fetch, corroborated by two in-repo records).
- IN-01..IN-04 dispositions: **HIGH on the facts** (every current text quoted verbatim from a read), **MEDIUM on the recommended fixes** where a judgment is involved (A2, A3).
- The `docs/plugin-enablement.md` gating question: **MEDIUM** — the absence of a gate is verified; whether the phase should add one is a judgment.

**Research date:** 2026-08-15
**Valid until:** 2026-09-14 (30 days — the subject is in-repo and stable; the only external fact is a documentation page whose relevant clauses are quoted verbatim here)
