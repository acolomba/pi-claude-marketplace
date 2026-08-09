# Phase 97: Disabled-state classification repair - Research

**Researched:** 2026-08-09
**Domain:** In-repo predicate consolidation across five orchestrator surfaces (TypeScript, no external deps)
**Confidence:** HIGH — every claim below was read from the worktree source this session and is quoted verbatim with a line range.

## Summary

The phase is a pure in-repo refactor plus five behavior repairs. There is **one
canonical exported predicate** (`orchestrators/reconcile/plan.ts::isRecordedButDisabled`)
and **three hand-copied twins** of its body (`update.ts`, `enable-disable.ts`,
`plugin-state-classifier.ts`). `list.ts` and `info.ts` are **consumers of the canonical
export, not separate copies** — the CONTEXT's enumeration of the four copies names the
consumer surfaces rather than the definition sites, and the plan must target the
definitions. A **fifth** disabled-state read exists in `orchestrators/plugin-path.ts`
and is *already* keyed only on `enabled`; it is the in-repo proof that the correct rule
is the enabled-only one.

All four conjunctive copies are the identical expression
`record.compatibility.installable && !record.enabled`. Collapsing them onto `!enabled`
repairs ENBL-06 (list/info rendering), ENBL-07 (enable/disable idempotency),
ENBL-08 (reconcile disable re-plan), and ENBL-09 (update short-circuit) **at the
predicate alone** — but three call sites need a second edit beyond the predicate swap,
because the code behind each of them was written assuming a disabled record is always
`installable: true`: `update.ts::refreshDisabledRecord` hard-codes `installable: true`;
`enable-disable.ts::runEnableBranch` never passes `partial`, so re-materializing a
partial through `requireInstallable` would fail; and the BFILL-01 backfill scan in
`reconcile/apply.ts` has no `enabled` guard, so a disabled partial can be re-materialized
and silently re-enabled by `reinstall`.

The rendering discretion anchor resolves cleanly toward the conservative default: the
`(disabled)` row's message type (`PluginDisabledMessage`) has **no `reasons` field at
all**, and the catalog states this is by construction. Rendering the disabled partial
bare costs zero type/renderer/catalog change; showing unsupported-kind reasons would
require widening the union arm, the renderer, and adding a new byte-gated catalog state.

**Primary recommendation:** Move the single predicate to `persistence/state-io.ts` beside
`toDisabledRecord`/`DisabledPluginRecord` (its semantic owner and the only module that
already models the disabled shape), export it as `isRecordedButDisabled(record: { enabled: boolean })`,
re-export or import it at all five consumer surfaces, delete the three twins, convert the
textual drift-guard from a body-shape grep into a "no surviving conjunctive twin" source
gate, and pin the three second-order edits (update `installable` derivation, enable
`partial` gate, backfill `enabled` guard) as their own tasks.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Requirements are the spec (operator decision at discuss)**

- **D-97-01:** The operator reviewed the two surfaced gray areas (disabled-
  partial row reasons; enable on a manifest-absent partial) and ruled that the
  requirements suffice — both go to Claude's discretion anchored on **"keep
  existing semantics"**. No additional constraints beyond ENBL-05..09 and the
  Phase 97 success criteria.

### Claude's Discretion

- **Disabled-partial row reasons:** whether the `(disabled)` row for a partial
  record shows the persisted unsupported-kind reasons or renders bare like the
  canonical disabled row. Anchor: the conservative default is parity with the
  existing canonical `(disabled)` rendering (bare) — a new visible form is a
  deliberate catalog amendment; decide at planning from catalog precedent and
  pin byte-exact either way. INV-04's composition is non-negotiable: never
  `{not in manifest}` on a disabled row.
- **Enable on a manifest-absent disabled partial:** re-materialization needs a
  resolvable manifest entry; when the record is manifest-absent, the expected
  outcome is the EXISTING enable resolve-failure semantics (fail clean, no
  partial materialization) — pin it as a boundary test. Do not invent new
  behavior.
- Where the single predicate lives (`shared/`, `domain/`, or the classifier
  module) and its name, provided every surface consumes the one definition and
  the textual drift-guard is updated to assert the new body.
- Test organization for the ENBL-06..09 behavior suites.

### Folded Todos

- `2026-08-09-disabled-partial-reaches-state-only-info-arm.md`
  (resolves_phase: 97, from 96-REVIEW.md CR-01) — folded: soft-degraded
  (`installable: false`) disabled records bypass `partitionDisabledScopes`
  (predicate keys on `compatibility.installable && !enabled`) and reach Phase
  96's state-only info arm, rendering `(partially-installed) {not in manifest,
  ...}` with an empty resolved component map. The ENBL-05 single-predicate
  collapse (keyed only on `enabled`) fixes that arm; ENBL-06 must widen the
  guard test at `tests/orchestrators/plugin/info-manifest-absent.test.ts`
  (~line 841) that today covers only the `installable: true` half.
  `enable-disable.ts:476` has no installable guard on disable and
  `toDisabledRecord` empties every `resources.*` array — the disabled partial
  with empty resources is a REACHABLE persisted shape the new predicate must
  classify as disabled.

### Deferred Ideas (OUT OF SCOPE)

- `2026-06-12-coverage-sweep-test-rare-failure-arms-in-update-reinstall-in.md`
  — update/reinstall failure-arm coverage; out of scope, stays pending.
- `2026-08-08-notify-stale-comments-doc08-reconciliation.md` — Phase 98 DOC-08
  carrier.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description (verbatim from REQUIREMENTS.md:54-58) | Research Support |
|----|-------------|------------------|
| ENBL-05 | "The disabled-state predicate depends only on the `enabled` field, never on `compatibility.installable`. It has one definition that every surface consumes, replacing the four copies that can drift independently. The textual drift-guard asserting the predicate body and the truth-table cell that currently pins the defective behavior as intended are both updated." | §Predicate Inventory (exact 4 definition sites + 5th correct read); §Drift-Guard and Truth Table (exact test line ranges); §Where the Single Predicate Should Live |
| ENBL-06 | "`plugin list` and `plugin info` render a disabled partially-installed record as `(disabled)`, distinct from an enabled partially-installed record, completing ENBL-04 for the partial case. This composes with INV-04: a manifest-absent disabled partial record is `(disabled)` with no `{not in manifest}` reason." | §Rendering Evidence (row types carry no `reasons` by construction); §Guard Test to Widen (exact fixture axis) |
| ENBL-07 | "`plugin enable` re-materializes a disabled partially-installed record instead of reporting idempotent success, and `plugin disable` reports idempotent success on an already-disabled partial record instead of re-running the unstage cascade." | §ENBL-07 Two Behavior Sites (single `===` line drives both); §Pitfall 1 (`partial` gate); §Enable on a Manifest-Absent Partial |
| ENBL-08 | "Load-time reconcile reaches steady state for a disabled partially-installed record: a config declaring the plugin disabled does not re-plan a disable on every pass." | §ENBL-08 Reconcile Steady State (exact drifting comparison); §Pitfall 3 (BFILL-01 backfill re-materialize) |
| ENBL-09 | "`plugin update` leaves a disabled partially-installed record alone rather than re-staging its artifacts, matching the existing disabled-record short-circuit." | §ENBL-09 Update Short-Circuit (reachability via `--partial` only); §Pitfall 2 (`refreshDisabledRecord` hard-codes `installable: true`) |

INV-04's carve-out text (REQUIREMENTS.md:15, verbatim): "A disabled installation record
absent from a successfully loaded manifest remains `(disabled)` without a
`{not in manifest}` reason. Scope is the canonical disabled shape only -- `enabled: false`
with `compatibility.installable: true` -- because the partial-disabled shape is not
recognized as disabled by any surface until ENBL-05 repairs the predicate in Phase 97.
Do not pin the current partial-disabled rendering as correct here; ENBL-06 widens this
coverage after the repair."
</phase_requirements>

## Project Constraints (from CLAUDE.md)

Directives that bind this phase specifically:

- **Quality bar (NFR-6):** `npm run check` must stay green — `typecheck && lint && format:check && test && test:integration` [VERIFIED: package.json:77].
- **Comments cite durable spec IDs only.** `.claude/rules/typescript-comments.md` forbids `Phase NN`, `Plan NN`, `Wave N`, `Pitfall N`, `milestone vX.Y` in comments and test titles; `ENBL-NN`, `D-NN`, `INV-NN`, `NFR-N`, `CR-NN` are allowed and encouraged. Every comment this phase edits must be rewritten to that policy.
- **Layer import boundaries (ESLint `import-x/no-restricted-paths`, eslint.config.js:237-269):** `persistence/` may import only `domain/`, `shared/`, `platform/`; `shared/` may import only `platform/`; `domain/` must not import upward. `orchestrators/` may import `persistence/`. This constrains where the single predicate can live.
- **IL-2:** user-visible output only through `shared/notify.ts`. No new `ctx.ui.notify` call sites.
- **NFR-5 network boundary:** `list.ts`, `info.ts`, `enable-disable.ts`, `reconcile/plan.ts` are in `FORBIDDEN_TARGETS` of `tests/architecture/no-orchestrator-network.test.ts` [VERIFIED: tests/architecture/no-orchestrator-network.test.ts:57-79]. The gate greps for `platform/git`, `DEFAULT_GIT_OPS`, `gitOps`, `refreshGitHubClone` in comment-stripped source; nothing this phase adds trips it.
- **Byte gate:** `docs/output-catalog.md` is a binding user contract enforced by `tests/architecture/catalog-uat.test.ts`, which byte-compares each `<!-- catalog-state: STATE -->` fenced block against real `notify()` output [VERIFIED: tests/architecture/catalog-uat.test.ts:1-34].
- **Git:** never commit to main; run `pre-commit run --files <paths>` before commit; from a worktree prefix with `SKIP=trufflehog` after a filesystem trufflehog scan.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Disabled-state predicate definition | `persistence/` (state-io.ts) | — | `state-io.ts` already owns the disabled shape (`DisabledPluginRecord`, `toDisabledRecord`); the predicate is the read side of the same invariant. Legal for every consumer (orchestrators may import persistence). |
| Classification of an install record into a render token | `orchestrators/plugin/` (classifier + list/info row builders) | — | Existing D-67-02 seam: `plugin-state-classifier.ts` is the single shared classifier; `list.ts` applies the disabled guard *ahead* of it. |
| Planning enable/disable actions | `orchestrators/reconcile/plan.ts` | — | DIFF-01 pure planner; purity gate at `tests/architecture/reconcile-planner-purity.test.ts`. |
| Applying enable/disable and re-materialization | `orchestrators/plugin/enable-disable.ts` + guard-free `runInstallLedger` | `transaction/` | Lock re-entrancy contract: `proper-lockfile` `retries: 0`, so the enable branch must use the guard-free ledger body. |
| Rendering the `(disabled)` row | `shared/notify.ts` | `docs/output-catalog.md` byte gate | notify is a dumb renderer; orchestrators stamp status/severity/reasons. |
| Persisted shape / migration | `persistence/state-io.ts`, `persistence/migrate.ts` | — | No schema change this phase; `migrate.ts` already defaults absent `enabled` to `true`. |

## Predicate Inventory (ENBL-05)

### The four conjunctive definition sites

All four bodies are the **identical** expression. Verbatim:

| # | Site | Lines | Verbatim body | Export? |
|---|------|-------|---------------|---------|
| 1 | `extensions/pi-claude-marketplace/orchestrators/reconcile/plan.ts` | 272-276 | `export function isRecordedButDisabled(`<br>`  record: ExtensionState["marketplaces"][string]["plugins"][string],`<br>`): boolean {`<br>`  return record.compatibility.installable && !record.enabled;`<br>`}` | **yes** — the canonical one |
| 2 | `extensions/pi-claude-marketplace/orchestrators/plugin/update.ts` | 1350-1354 | `function isRecordedButDisabled(`<br>`  record: ExtensionState["marketplaces"][string]["plugins"][string],`<br>`): boolean {`<br>`  return record.compatibility.installable && !record.enabled;`<br>`}` | no (module-private twin) |
| 3 | `extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts` | 179-184 | `function isCurrentlyDisabled(installed: {`<br>`  compatibility: { installable: boolean };`<br>`  enabled: boolean;`<br>`}): boolean {`<br>`  return installed.compatibility.installable && !installed.enabled;`<br>`}` | no (module-private twin, different name) |
| 4 | `extensions/pi-claude-marketplace/orchestrators/plugin/plugin-state-classifier.ts` | 130-132 | `  if (record.compatibility.installable && !record.enabled) {`<br>`    return "installed";`<br>`  }` | no (inlined, unnamed) |

[VERIFIED: read this session at the cited line ranges]

### The consumer surfaces (NOT separate copies)

`list.ts` and `info.ts` import site #1 — they hold no local definition:

- `extensions/pi-claude-marketplace/orchestrators/plugin/list.ts:73` — `import { isRecordedButDisabled } from "../reconcile/plan.ts";`; used at `list.ts:422` — `  if (isRecordedButDisabled(record)) {`
- `extensions/pi-claude-marketplace/orchestrators/plugin/info.ts:72` — `import { isRecordedButDisabled } from "../reconcile/plan.ts";`; used inside `partitionDisabledScopes` at `info.ts:2077` — `    if (installed !== undefined && isRecordedButDisabled(installed)) {`
- `plan.ts` itself consumes it twice: `plan.ts:339` — `    if (recorded && record !== undefined && !isRecordedButDisabled(record)) {` (disable bucket) and `plan.ts:358` — `  if (record !== undefined && isRecordedButDisabled(record)) {` (enable bucket)
- `update.ts:1568` consumes its own twin — `  if (isRecordedButDisabled(preflight.record)) {`
- `enable-disable.ts:476` consumes its own twin — `      if (isCurrentlyDisabled(installed) === !enable) {`

[VERIFIED: read this session]

### The fifth site — already correct

`extensions/pi-claude-marketplace/orchestrators/plugin-path.ts:39` reads disabled-ness with
`enabled` alone:

```text
      if (!rec.enabled) {
        continue;
      }
```

Its docstring (plugin-path.ts:23-26, verbatim) says: "PENV-01: collect
`<resolvedSource>/bin` for every enabled plugin record in `state`, in a stable insertion
order (marketplace-then-plugin object order). Disabled records are excluded."
[VERIFIED: extensions/pi-claude-marketplace/orchestrators/plugin-path.ts:23-41]

**Planning consequence:** a full sweep found no sixth site. The exhaustive sweep command
that produced this inventory is `grep -rn "\.enabled" --include="*.ts" extensions`
filtered against config/autoupdate hits; the only non-config `.enabled` reads in the
extension are the five above plus `reinstall.ts:1999` (`enabled: record.enabled,` — a
clone-through, not a predicate) and `persistence/migrate.ts:175-176`.

### No migration needed (success criterion 6)

`persistence/migrate.ts:175-176`, verbatim:

```text
    if (pl.enabled === undefined) {
      pl.enabled = true;
```

An absent `enabled` field already loads as `true`, so nothing on disk becomes disabled by
accident. The disabled-partial shape already on disk (`enabled: false`,
`compatibility.installable: false`, all `resources.*` empty) simply starts classifying
correctly on the next load. [VERIFIED: extensions/pi-claude-marketplace/persistence/migrate.ts:175-176]

## Where the Single Predicate Should Live

**Recommendation: `extensions/pi-claude-marketplace/persistence/state-io.ts`.**

Evidence for that home — `state-io.ts` already owns the disabled shape and its sole
producer. Verbatim from `persistence/state-io.ts:99-127`:

```text
export type EnabledPluginRecord = PluginInstallRecord & { enabled: true };
export type DisabledPluginRecord = PluginInstallRecord & {
  enabled: false;
  resources: {
    skills: [];
    prompts: [];
    agents: [];
    mcpServers: [];
    hooks: [];
  };
};
```

```text
export function toDisabledRecord(
  record: PluginInstallRecord,
  updatedAt: string,
): DisabledPluginRecord {
  return {
    ...record,
    resources: { skills: [], prompts: [], agents: [], mcpServers: [], hooks: [] },
    enabled: false,
    updatedAt,
  };
}
```

[VERIFIED: extensions/pi-claude-marketplace/persistence/state-io.ts:99-127]

Legality and constraints checked:

| Consumer | May import `persistence/`? | Evidence |
|----------|---------------------------|----------|
| `orchestrators/reconcile/plan.ts` | yes — it already does | `plan.ts:49` — `import { isDeclaredEnabled } from "../../persistence/config-io.ts";` and `plan.ts:64` — `import type { ExtensionState } from "../../persistence/state-io.ts";` |
| `orchestrators/plugin/*.ts` | yes | eslint.config.js layer rules restrict `edge/`, `bridges/`, `domain/`, `transaction/`, `persistence/`, `platform/`, `shared/`; orchestrators are unrestricted upward-consumers |
| `plugin-state-classifier.ts` | yes (it is an orchestrator file) | its own header only claims *runtime* purity ("no disk or network I/O"), not import purity; there is **no** architecture test targeting it (`tests/architecture/` listing contains none) |

The DIFF-01 purity gate on `plan.ts` is a **textual** grep over comment-stripped source for
`node:fs`, `platform/git`, `gitOps`, `notify`, `saveState`, `saveConfig`,
`atomicWriteJson`, `withStateGuard`, `withLockedStateTransaction`
[VERIFIED: tests/architecture/reconcile-planner-purity.test.ts:31-45]. A value import of
`isRecordedButDisabled` from `persistence/state-io.ts` introduces none of those tokens, so
the gate stays green — **but** note it is a token grep, so if the planner instead re-exports
`saveState`-adjacent names into `plan.ts` the gate would trip. Import only the predicate.

Alternative homes and their trade-offs are in §Alternatives Considered.

**Signature recommendation:** keep it structural so no consumer needs the full record type:

```typescript
export function isRecordedButDisabled(record: { readonly enabled: boolean }): boolean {
  return !record.enabled;
}
```

Structural typing is already the house pattern here — `enable-disable.ts:179-182` takes a
structural literal, and `plugin-state-classifier.ts:75-81` defines `InstalledRecordLike`
for exactly this reason [VERIFIED: read this session].

## Drift-Guard and Truth Table (ENBL-05's two textual obligations)

Both live in **one file**: `tests/orchestrators/reconcile/plan.test.ts`.

### 1. The truth table with the defective cell

`tests/orchestrators/reconcile/plan.test.ts:694` — test title verbatim:
`"T5 / ENBL-02: isRecordedButDisabled truth table over installable x enabled -- only (installable:true, enabled:false) is 'disabled'"`

The defective cell is the fourth case, `plan.test.ts:723-728`, verbatim:

```text
    {
      name: "installable: false, enabled: false (soft-degraded disabled -- edge; never classifiable as pluginsToEnable)",
      installable: false,
      enabled: false,
      expected: false,
    },
```

That `expected: false` is the cell ENBL-05 must flip to `true`. The third cell
(`installable: false, enabled: true`, `expected: false`, plan.test.ts:717-722) stays
`false` and becomes the load-bearing proof that the collapse did not over-reach.
[VERIFIED: tests/orchestrators/reconcile/plan.test.ts:694-738]

Header prose above the tests also asserts the false invariant —
`plan.test.ts:636-639`, verbatim: "load-bearing for the convergence proof at
plan-convergence.test.ts: a soft-degraded (installable: false) plugin has `enabled: true`
and must NOT be classified as `pluginsToEnable`; both predicates read the installable axis
for this guard." This prose must be rewritten.

### 2. The textual drift-guard

`tests/orchestrators/reconcile/plan.test.ts:740` — test title verbatim:
`"T5 / ENBL-02: isCurrentlyDisabled (enable-disable.ts) source-shape pin -- same installable + !enabled axes as isRecordedButDisabled (drift gate)"`

Mechanism, verbatim (`plan.test.ts:755-777`):

```text
  const fnMatch = /function isCurrentlyDisabled\([\s\S]*?\): boolean \{([\s\S]*?)\n\}/.exec(
    enableSrc,
  );
```

```text
  const requiredAxes: ReadonlyArray<string> = ["compatibility.installable", "!installed.enabled"];
```

[VERIFIED: tests/orchestrators/reconcile/plan.test.ts:740-778]

**Design note for the planner:** after the collapse `isCurrentlyDisabled` no longer
exists, so the guard's regex would fail on its own `assert.ok(fnMatch, ...)`. The guard
must be *replaced*, not merely edited. The recommended replacement inverts the assertion
from "the twin has the right body" to "no twin exists": grep the comment-stripped source
of the four former definition files for the conjunction (e.g.
`/compatibility\.installable\s*&&\s*!\w+\.enabled/`) and assert zero matches, plus assert
each file imports the single predicate. That is a stronger, drift-proof gate and matches
the house pattern of source-grep architecture tests (`no-orchestrator-network.test.ts`,
`reconcile-planner-purity.test.ts`).

### The reconcile comment asserting a false invariant

`extensions/pi-claude-marketplace/orchestrators/reconcile/plan.ts:266-270`, verbatim:

```text
 * The `installable === true` guard is preserved: a soft-degraded
 * (`installable: false`) plugin has `enabled: true` in state (it was
 * never explicitly disabled; the disable orchestrator is the only writer
 * of `enabled: false`), so `record.compatibility.installable && !record.enabled`
 * naturally excludes soft-degraded entries.
```

The parenthetical is factually wrong: the disable orchestrator *is* the only writer of
`enabled: false`, but it places **no** `installable` guard before writing it
(`enable-disable.ts:476` and `runDisableBranch`), so a soft-degraded plugin absolutely can
carry `enabled: false`. [VERIFIED: extensions/pi-claude-marketplace/orchestrators/reconcile/plan.ts:266-270]

**A second false-invariant comment exists** and the CONTEXT does not name it —
`extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts:1057-1063`, verbatim:

```text
/**
 * Test seam (mirrors reinstall.ts's `__test_*` exports): exercise the WR-03
 * dedupe directly with a pre-populated `outcomes` array standing in for a
 * same-load applyPlan transition (the planner's enable bucket requires
 * installable === true, so a partially-installed plugin cannot reach it through a
 * real plan -- the seam injects the precondition).
 */
```

After ENBL-05 the planner's enable bucket no longer requires `installable === true`, so a
partially-installed plugin **can** reach it through a real plan. This comment must be
corrected too. [VERIFIED: extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts:1057-1063]

### Other stale prose referencing the old marker (traceability, low risk)

| File:line | Verbatim fragment |
|-----------|-------------------|
| `orchestrators/reconcile/plan.ts:19-20` | "`isRecordedButDisabled(record)` reads the explicit `enabled` field: `record.compatibility.installable && !record.enabled`." |
| `orchestrators/reconcile/types.ts:16-19` | "(recorded-but-disabled marker is \"all four resources arrays empty AND installable: true\" -- see plan.ts::isRecordedButDisabled)" |
| `orchestrators/reconcile/notify.ts:403-404` | "The bucket is populated only when a recorded plugin carries the empty-resources marker (`isRecordedButDisabled` in plan.ts)." |
| `orchestrators/plugin/plugin-state-classifier.ts:26, 69-73, 121-129` | "`installable: true` record with `enabled: false` was explicitly disabled" |
| `shared/notify.ts:723-727` | "for plugins whose state record carries the empty-resources + `installable: true` marker (the load-bearing predicate is `orchestrators/reconcile/plan.ts::isRecordedButDisabled`)" |
| `shared/notify.ts:993-997` | "The bucket is populated only when the recorded-but-disabled marker (all four resource arrays empty + `installable: true` ...)" |
| `docs/output-catalog.md:149` | "when the state record carries the empty-resources + `installable: true` marker" |
| `docs/output-catalog.md:331` | "Triggered when the state record carries the empty-resources + `installable: true` marker (the load-bearing predicate is `orchestrators/reconcile/plan.ts::isRecordedButDisabled`)." |
| `docs/output-catalog.md:2191` | "The four `resources.*` arrays reset to `[]`; the `installable: true` flag is retained. The combination is the load-bearing \"currently disabled\" marker" |
| `docs/output-catalog.md:2215` | "the plugin is already disabled (state record carries the empty-resources marker)" |

[VERIFIED: grep -n over the cited files this session; each fragment quoted verbatim]

The four `docs/output-catalog.md` fragments are **prose, not fenced byte blocks**, so
editing them does not move the catalog-uat byte gate. They should still be corrected in
this phase — the catalog is the binding user contract and DOC-08 (Phase 98) is scoped to
notify comments, not to this predicate's prose.

## ENBL-07: The Two Behavior Sites

Both halves are driven by **one line**, `enable-disable.ts:476`:

```text
      if (isCurrentlyDisabled(installed) === !enable) {
```

Truth table for a disabled partial (`installable: false`, `enabled: false`, so
`isCurrentlyDisabled` returns `false`):

| Command | `!enable` | `isCurrentlyDisabled` | Branch taken today | Correct behavior (ENBL-07) |
|---------|-----------|-----------------------|--------------------|----------------------------|
| `enable` | `false` | `false` | equality holds → early return `{ kind: "idempotent" }` → `(skipped) {already enabled}` | fall through to `runEnableBranch` → re-materialize |
| `disable` | `true` | `false` | equality fails → falls through to `runDisableBranch` → **re-runs the whole unstage cascade** | early return `{ kind: "idempotent" }` → `(skipped) {already disabled}` |

Flipping the predicate to `!installed.enabled` (returns `true` for the partial) inverts
both rows simultaneously. No structural change to `setPluginEnabled` is needed for the
disable half. [VERIFIED: extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts:476, 521-524]

### The enable half needs a second edit

`runEnableBranch` (enable-disable.ts:199-246) calls the guard-free ledger. Verbatim
argument object, `enable-disable.ts:212-225`:

```text
    const result = await runInstallLedger(
      state,
      locations,
      {
        ctx: opts.ctx,
        scope,
        cwd: opts.cwd,
        marketplace: opts.marketplace,
        plugin: opts.plugin,
        pinVersionOverride: recordedVersion,
        allowExistingRecord: true,
      },
      capture,
    );
```

No `partial` field. `InstallLedgerOptions` does expose one —
`install.ts:457-458`, verbatim: `  /** D-65-03 \`--partial\` gate-selection flag (see InstallPluginOptions.partial). */`
followed by `  readonly partial?: boolean;` [VERIFIED: extensions/pi-claude-marketplace/orchestrators/plugin/install.ts:443-485].

Inside the ledger the gate is `requireInstallable` unless `partial` is set (install.ts:791-800
comment block, verbatim: "the default path calls `requireInstallable` (admits only
`installable`); `--partial` calls `requirePartialInstallable` (also admits the
partially-available arm)"). Therefore, without a `partial` argument, enabling a disabled
partial whose manifest entry still resolves `partially-available` throws
`PluginShapeError{kind:"no-longer-installable"}` and the row is `(failed)` — it does not
re-materialize, which fails ENBL-07.

**Recommended edit (house-machinery reuse):** derive it from the record, e.g. pass
`partial: installed.compatibility.unsupported.length > 0` (or `!installed.compatibility.installable`).
The precedent is `reinstall.ts:1436-1441`, verbatim:

```text
// BFILL-01 / D-68-02: reinstall is partial-capable. It resolves through the
// `requirePartialInstallable` gate (admitting both `installable` and the
// partially-available arm) so backfill can re-materialize a
// still-partial plugin in place without throwing `{not-installable}`. The
// `unavailable` arm is still rejected (NFR-7). Resolution stays cache-only via
// `resolveStrict` -- no network (NFR-5).
```

[VERIFIED: extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts:1436-1441]

### Enable on a manifest-absent disabled partial (discretion anchor 2)

The existing resolve-failure path, traced end to end:

1. `runInstallLedger` reads the cached manifest and throws — `install.ts:749-752`, verbatim:
   ```text
   const entryRaw = manifest.plugins.find((p) => p.name === plugin);
   if (entryRaw === undefined) {
     throw new PluginShapeError({ kind: "not-in-manifest", plugin, marketplace });
   }
   ```
   This is **before** any ledger phase, so nothing is materialized — "fail clean" holds by construction.
2. `runEnableBranch` catches and returns `{ kind: "enable-failed", cause, recordedVersion }` (enable-disable.ts:238-245).
3. The closure returns without `tx.save()` — `enable-disable.ts:545-547`, verbatim:
   ```text
      if (outcome.kind !== "fresh") {
        return;
      }
   ```
4. Standalone rendering: `composeOutcomeRow`'s `enable-failed` arm computes
   `baseReasons = ... narrowEnableFailure(outcome.cause)` (enable-disable.ts:949-951), and
   `narrowEnableFailure` (enable-disable.ts:1025-1038) returns `["source missing"]` only for
   `ENOENT`, otherwise `[]` — verbatim: `  // Defensive: an empty reasons array lets the renderer suppress the brace / while still surfacing the cause via the 4-space-indent trailer.` then `  return [];`
5. Orchestrated rendering: `mapOutcome`'s `enable-failed` arm falls back —
   `enable-disable.ts:797-800`, verbatim: `        partials.length > 0 ? "rollback partial" : (narrowEnableFailure(outcome.cause)[0] ?? "unreadable");`

**So the existing semantics to pin are:** standalone → a brace-suppressed `(failed)` row
plus the 4-space cause-chain trailer at `error` severity; orchestrated → `status: "failed"`,
`reason: "unreadable"`. **Planning caution:** the enable section of `docs/output-catalog.md`
has catalog states `enable-fresh`, `enable-idempotent`, `enable-source-missing`,
`enable-not-installed`, `enable-marketplace-not-added`, `enable-invalid-config`
[VERIFIED: grep -n "catalog-state:" docs/output-catalog.md] — there is **no** state for the
brace-suppressed `(failed)` + cause-trailer form. The planner must decide whether pinning
this boundary adds a catalog state (byte gate) or stays a unit-level byte assertion in the
orchestrator test. Since the row form is not new to the *renderer* (the trailer is a general
`failed` affordance, notify.ts:2375-2390), a unit-level byte assertion is defensible and
avoids a catalog amendment the operator did not ask for.

## ENBL-08: Reconcile Steady State

The drifting comparison is `plan.ts:339`, verbatim in context (`plan.ts:328-346`):

```text
  if (enabledExplicitFalse) {
```
```text
    const record = state.marketplaces[marketplace]?.plugins[plugin];
    if (recorded && record !== undefined && !isRecordedButDisabled(record)) {
      // Declared-disabled but still materialised: drop artifacts without
      // removing the version pin (D-04 / ENBL-02).
      acc.disable.push({ scope, plugin, marketplace });
    }
```

For a disabled partial `isRecordedButDisabled` is `false`, so `!false === true` and a
`PlannedPluginDisable` is pushed on **every** pass. `applyPluginToggles` then calls
`setPluginEnabled({ enable: false, notifications: { mode: "orchestrated" } })`
(apply.ts:668-677), which — per §ENBL-07 — re-runs `runDisableBranch` and the whole
unstage cascade, forever. The collapse fixes both halves at once, and the idempotent
outcome is already dropped from the cascade: apply.ts:698-699, verbatim:
`      // skipped (idempotent) -> intentionally drop; the steady state isn't a` /
`      // user-visible action.` [VERIFIED: extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts:660-711]

### The planner-level convergence proof is unaffected

`tests/orchestrators/reconcile/plan-convergence.test.ts` asserts
`planReconcile(mergeScopeConfigs(buildConfigFromState(state), {}), state, scope)` deep-equals
`emptyReconcilePlan(scope)` over `tests/persistence/fixtures/legacy/state-populated-mixed.json`.
That fixture's three plugin records are (verbatim field values, extracted this session):

| marketplace | plugin | `enabled` | `compatibility.installable` | `compatibility.unsupported` |
|---|---|---|---|---|
| mp-path | code-reviewer | `true` | `true` | `[]` |
| mp-path | soft-degraded | `true` | `false` | `["agents"]` |
| mp-github | code-reviewer | `true` | `true` | `[]` |

No record carries `enabled: false`, so the collapse changes no bucket for this fixture and
SC#4 stays green. The `soft-degraded` record (`installable: false`, `enabled: true`) is the
regression anchor proving the collapse did **not** widen "disabled" to mean "degraded":
`buildConfigFromState` projects every plugin to `{}` (migrate-config.ts:142-144, verbatim:
`    for (const pluginName of Object.keys(mp.plugins)) {` / `      plugins[\`${pluginName}@${mpName}\`] = {};`),
which D-04 reads as declared-enabled; the enable bucket must stay empty for it.
[VERIFIED: tests/orchestrators/reconcile/plan-convergence.test.ts:19-33; extensions/pi-claude-marketplace/persistence/migrate-config.ts:140-144]

### Second steady-state hazard the requirement text does not name

The BFILL-01 backfill scan filters **only** on `installable`, with no `enabled` guard —
`apply.ts:1031-1035`, verbatim:

```text
  const { scope, marketplace, mp, plugin, record } = target;
  // D-68-03: scan ONLY partially-installed plugins.
  if (record.compatibility.installable) {
    return false;
  }
```

A disabled partial passes that filter. If its manifest entry's supported set grew
(`apply.ts:1104` — `  if (!supportedSetGrew(record.compatibility.supported, resolved.supported)) {`),
`maybeBackfillPlugin` calls `reinstallPlugin({ ..., render: "none" })` (apply.ts:1110-1118),
and reinstall's record write unconditionally sets the record back to enabled —
`reinstall.ts:1666-1681` writes `resources: resourcesFromHandles(handles, plugin, installable),`
followed by `    enabled: true,`. So a load-time reconcile can silently re-materialize **and
re-enable** a plugin the user deliberately disabled.

This is reachable today and is not created by the collapse, but it is squarely inside
ENBL-08's "reaches steady state" claim: a pass that re-materializes a disabled plugin is
not steady state. **Recommendation:** add an early `if (!record.enabled) return false;` to
`backfillOnePluginIsolated` (the same guard shape as the existing `installable` filter) and
pin it with a test. Note the mitigating condition: a **manifest-absent** disabled partial is
already skipped, because `resolveRecordedPluginOffline` returns `undefined` and
`maybeBackfillPlugin` returns `false` at apply.ts:1092-1102.
[VERIFIED: extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts:1019-1055, 1083-1118; extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts:1666-1681]

## ENBL-09: Update Short-Circuit

`update.ts:1568`, verbatim in context (`update.ts:1562-1578`):

```text
  // D-UPD: a disabled-but-recorded plugin (empty resources.* + installable=true,
  // the same marker the planner reads via isRecordedButDisabled) must NOT
  // re-materialize artifacts; an `enable` after the update is the rematerialization
  // surface. Refresh the record's version + resolvedSource so a future enable
  // reads the current pin, but keep `resources.*` empty. Renders the existing
  // `unchanged` byte form -- the artifact state really is unchanged.
  if (isRecordedButDisabled(preflight.record)) {
```

### Reachability analysis (important for test design)

The short-circuit runs **after** `preflightUpdate`, which resolves the candidate through
`resolveUpdateCandidate`. That function gates on `args.partial`
(update.ts:1086 — `      partial: args.partial === true,`), and the gate is
update.ts:904-908, verbatim:

```text
    if (partial) {
      requirePartialInstallable(resolved, "update");
    } else {
      requireInstallable(resolved, "update");
    }
```

Consequences for a disabled **partial** record:

- **`update` without `--partial`, candidate resolves `partially-available`:** the
  `requireInstallable` throw is caught and converted to a `skipped` outcome (the XSURF-03
  arm at update.ts:943-958) **before** line 1568 is reached. So today's behavior is already
  "no re-staging", by accident of the gate — and the collapse changes nothing on this path.
- **`update --partial`:** the candidate resolves and line 1568 **is** reached. Today
  `isRecordedButDisabled` is `false`, so the disabled partial falls into the full
  three-phase update and its artifacts are re-staged — the ENBL-09 defect. After the
  collapse it short-circuits into `refreshDisabledRecord`.
- **Candidate now resolves fully `installable` (the degrade was fixed upstream):** reached
  on both paths.

**So the ENBL-09 test must exercise `--partial`** (or a candidate that resolves clean) to
observe the defect at all. A plain `update` test would pass before and after the change and
prove nothing.

## Rendering Evidence (ENBL-06 and discretion anchor 1)

### The `(disabled)` row carries no reasons — by type

`shared/notify.ts:745-751`, verbatim:

```text
export interface PluginDisabledMessage extends TransitionMessageBase {
  readonly status: "disabled";
  readonly name: string;
  readonly version?: string;
  readonly scope?: Scope;
  readonly description?: string;
}
```

And the intent is documented at `shared/notify.ts:735-740`, verbatim: "Structurally
distinct from `(unavailable)`: the variant carries no `reasons` (a disabled plugin is in
the user-requested state, not a failure state) ... NO `dependencies` / `reasons` / `cause`
/ `rollbackPartial` by construction -- the inventory row is bare."
[VERIFIED: extensions/pi-claude-marketplace/shared/notify.ts:722-751]

### The catalog byte form

`docs/output-catalog.md:324-331`, verbatim block:

```text
<!-- catalog-state: disabled-inventory -->
```
```text
  ◍ foo-plugin v1.2.3 (disabled)
```

Catalog states that exist for disabled rows: `disabled-inventory` (line 324),
`disabled-inventory-with-description` (line 337), `disabled-fetch-skipped` (line 1548),
`disable-fresh` (line 2195), `disable-idempotent` (line 2208),
`enable-disable-transitions` (line 1764). There is **no** disabled-row state carrying a
reasons brace. [VERIFIED: grep -n "catalog-state:" docs/output-catalog.md; sed of the cited blocks]

### Recommendation on discretion anchor 1

**Render the disabled partial bare, at byte parity with the canonical `(disabled)` row.**
Cost comparison:

| Option | Type change | Renderer change | Catalog change | Byte gate |
|--------|-------------|-----------------|----------------|-----------|
| Bare (recommended) | none | none | prose only (predicate description) | unchanged — existing `disabled-inventory` block already covers the bytes |
| With unsupported-kind reasons | widen `PluginDisabledMessage` with `reasons` | new brace arm on the disabled renderer path | **new catalog state** required | new byte-gated block |

The bare option also composes with INV-04 for free: a row type with no `reasons` field
**cannot** emit `{not in manifest}`, which makes the non-negotiable constraint structural
rather than test-enforced. The `info` disabled block builder already omits everything but
name/version — `info.ts:2034-2044`, verbatim:

```text
    plugins: [
      {
        // D-03/D-06: a disabled INVENTORY row (info surface) is steady state,
        // not a realized transition -> info, never reloads.
        status: "disabled",
        name: pluginName,
        version: installed.version,
        severity: "info",
        needsReload: false,
      },
    ],
```

and `list.ts:422-434` builds the same shape plus optional `scope`/`description`.
[VERIFIED: extensions/pi-claude-marketplace/orchestrators/plugin/info.ts:2030-2045; list.ts:416-434]

### What the disabled partial renders TODAY (the defect to be replaced, not pinned)

- **`list`:** `isRecordedButDisabled` is false → `classifyInstalledRecord` → the
  `installable && !enabled` short-circuit is false → `record.compatibility.unsupported.length > 0`
  → `"partially-installed"` → row built at list.ts:496-505 with
  `reasons: partiallyInstalledReasons(record, notInManifest)`. `partiallyInstalledReasons`
  (list.ts:321-327), verbatim:
  ```text
    const kinds = narrowUnsupportedKinds(record.compatibility.unsupported);
    return notInManifest ? ["not in manifest", ...kinds] : kinds;
  ```
- **`info` (manifest-absent):** `partitionDisabledScopes` routes it to `infoFound`, the
  state-only arm builds the row via `derivePersistedInstalledStatus` (info.ts:1001-1005),
  verbatim: `  return record.compatibility.unsupported.length > 0 ? "partially-installed" : "installed";`
  with `reasons: ["not in manifest", ...narrowUnsupportedKinds(...), ...]` and
  `componentsResolved: true` over an empty components map (info.ts:975-991) — the exact
  false positive the CR-01 todo describes.

Per the roadmap and INV-04, **do not add a characterization test asserting these bytes as
correct.** Write the desired-state tests instead; the collapse's own diff is the evidence
the behavior changed.

### Guard test to widen (ENBL-06)

`tests/orchestrators/plugin/info-manifest-absent.test.ts:919-941` — title verbatim:
`"D-54-01: a manifest-absent DISABLED record still renders the \`(disabled)\` inventory cascade"`,
seeding `      installed: { alpha: { version: "1.0.0", disabled: true } },` and asserting

```text
      ["● mp [user]", "  ◍ alpha v1.0.0 (disabled)"].join("\n"),
```

Note the header is `● mp [user]` with **no** `<no autoupdate>` marker — the disabled block
emits `...autoupdateDetails(autoupdate)` only when autoupdate is set, unlike the
manifest-backed rows in the same file which render `● mp [user] <no autoupdate>`. Copy the
right one.

**The fixture already supports the missing axis with no factory change.**
`info-manifest-absent.test.ts:200-224`, verbatim:

```text
    const unsupported = info.unsupported ?? [];
```
```text
      compatibility: {
        installable: unsupported.length === 0,
```
```text
      resources:
        info.disabled === true
          ? { skills: [], prompts: [], agents: [], mcpServers: [], hooks: [] }
```
```text
      enabled: info.disabled !== true,
```

So `installed: { alpha: { version: "1.0.0", disabled: true, unsupported: ["lspServers"] } }`
produces exactly the reachable CR-01 shape: `enabled: false`, `installable: false`, all
`resources.*` empty. [VERIFIED: tests/orchestrators/plugin/info-manifest-absent.test.ts:198-225]

The sibling `--fetch` test at the same file (line 950, title verbatim:
`"D-96-04: \`info --fetch\` on an all-disabled marketplace emits the skip note"`) has the
same half-covered axis: after the collapse, a disabled partial with `--fetch` moves from the
state-only `{not in manifest}` skip note to the `{already disabled}` skip note
(info.ts:2190 — `      reason: "already disabled",`). That reason-token switch is a
user-visible behavior change worth an explicit test.

## Empty-Resources Persisted Shape

`toDisabledRecord` empties all five arrays (quoted above, state-io.ts:117-127). The
persisted disabled-partial record therefore has:

| Field | Value | Consequence for the new predicate |
|-------|-------|-----------------------------------|
| `enabled` | `false` | the sole input — classifies disabled |
| `compatibility.installable` | `false` | no longer read by the predicate |
| `compatibility.unsupported` | non-empty (e.g. `["lspServers"]`) | still read by `classifyInstalledRecord`'s **second** branch, but the enabled-only short-circuit at plugin-state-classifier.ts:130 now fires first |
| all `resources.*` | `[]` | not read by the predicate; the D-63-04 hooks-only regression (a hooks-only *installed* plugin misread as disabled) is structurally impossible once the predicate stops looking at resources |

The classifier consequence deserves a test: after the collapse,
`classifyInstalledRecord` returns `"installed"` for **any** `!enabled` record, including a
partial. `list` is unaffected (it guards ahead of the classifier at list.ts:422), but the
**completion bucketizer** changes: `orchestrators/edge-deps.ts` consumes the same
classifier (edge-deps.ts:37 — `import { classifyInstalledRecord } from "./plugin/plugin-state-classifier.ts";`),
so a disabled partial moves out of the `partially-installed` completion bucket and into
`installed` — i.e. it stops being offered as an `update --partial` candidate. That is the
*correct* outcome (a disabled record is version-frozen, per the WR-01 rationale at
plugin-state-classifier.ts:121-129) and matches the existing canonical-disabled parity
test at `tests/orchestrators/edge-deps.test.ts:760-790`, but it is a behavior change and
needs its own pin. [VERIFIED: extensions/pi-claude-marketplace/orchestrators/edge-deps.ts:37, 79-91; tests/orchestrators/edge-deps.test.ts:760-790]

## Architecture Patterns

### System Architecture Diagram

```text
                       ┌──────────────────────────────────────────┐
   state.json ────────►│ persistence/state-io.ts                  │
   (enabled: bool)     │  DisabledPluginRecord / toDisabledRecord  │
                       │  ★ isRecordedButDisabled(record)  ← NEW  │
                       └───────────────┬──────────────────────────┘
                                       │ (one definition, five consumers)
        ┌──────────────┬───────────────┼────────────────┬─────────────────┐
        ▼              ▼               ▼                ▼                 ▼
 reconcile/plan.ts  plugin/list.ts  plugin/info.ts  plugin/update.ts  plugin/enable-disable.ts
   enable bucket     row guard       partition-      short-circuit      idempotency test
   disable bucket    (pre-           DisabledScopes  (ENBL-09)          (ENBL-07)
   (ENBL-08)          classifier)    (ENBL-06/CR-01)      │                   │
        │             (ENBL-06)            │              ▼                   ▼
        ▼                 │                │      refreshDisabledRecord   runEnableBranch
 reconcile/apply.ts       ▼                ▼      ⚠ hard-codes             ⚠ no `partial`
   applyPluginToggles  plugin-state-classifier.ts   installable:true         → requireInstallable
   ⚠ BFILL-01 backfill   (also consumed by            (Pitfall 2)              (Pitfall 1)
     has no enabled       edge-deps.ts completion                                │
     guard (Pitfall 3)    bucketizer)                                            ▼
                                                                          runInstallLedger
                                                                          (guard-free body;
                                                                           caller owns lock)
                              ┌───────────────────────────────────────┐
    every row ───────────────►│ shared/notify.ts (dumb renderer)      │
                              │  PluginDisabledMessage — no `reasons` │
                              └───────────────┬───────────────────────┘
                                              ▼
                              docs/output-catalog.md byte gate
                              (tests/architecture/catalog-uat.test.ts)
```

★ = the new single definition. ⚠ = a call site whose surrounding code assumes
"disabled ⇒ installable: true" and needs a second edit.

### Pattern 1: Structural-parameter predicate

**What:** the predicate takes the minimal structural shape, not the full record type.
**When to use:** any cross-layer predicate consumed by modules with differing record views.
**Example:**
```typescript
// Source: extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts:179-184 (existing house pattern)
function isCurrentlyDisabled(installed: {
  compatibility: { installable: boolean };
  enabled: boolean;
}): boolean {
  return installed.compatibility.installable && !installed.enabled;
}
```
After the collapse the parameter narrows to `{ readonly enabled: boolean }`, which every
existing caller's argument satisfies structurally (no cast, no widening).

### Pattern 2: Source-grep architecture gate replacing a body-shape pin

**What:** assert an invariant over comment-stripped source text rather than over a value.
**When to use:** when the invariant is "no module re-derives X locally".
**Example:**
```typescript
// Source: tests/architecture/reconcile-planner-purity.test.ts:47-51
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "") // block comments
    .replace(/^\s*\/\/.*$/gm, ""); // line comments
}
```
Reuse this exact helper shape for the ENBL-05 replacement drift gate. Stripping comments
first is load-bearing: the JSDoc on the surviving predicate will legally *mention* the old
conjunction while explaining why it was removed.

### Pattern 3: Derive persisted `installable` from the resolution, never hard-code

**What:** when rewriting a record's `compatibility`, read the resolver's discriminant.
**Example:**
```typescript
// Source: extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts:1670-1677
    compatibility: {
      installable: installable.state === "installable",
      notes: [...installable.notes],
      supported: [...installable.supported],
      unsupported: [...installable.unsupported],
    },
```
This is the fix template for Pitfall 2.

### Anti-Patterns to Avoid

- **Adding a fifth predicate copy.** The CR-01 todo names this explicitly: "Repairing it
  locally inside `info.ts` would add a fifth divergent copy of the disable test."
- **Pinning today's `(partially-installed) {not in manifest, lsp}` bytes as correct.**
  Forbidden by the roadmap and by INV-04's carve-out text.
- **Nesting a second `withLockedStateTransaction` on the same scope.** `proper-lockfile` is
  `retries: 0` and not re-entrant; the guard-free `runInstallLedger` exists for this reason
  (install.ts:680-689). Any new re-materialization path must reuse the guard-free body.
- **Editing the drift-guard's regex to match a renamed function.** The correct move is to
  invert the gate to "no conjunctive twin survives"; a renamed-function regex re-creates the
  same drift surface one rename later.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Re-materializing a disabled record | a bespoke stage/commit sequence in `enable-disable.ts` | `runInstallLedger(..., { allowExistingRecord: true, pinVersionOverride })` | already lock-aware, rollback-composing, and version-pinning (install.ts:674-695) |
| Partial-capable re-materialization | a new `partially-available` gate | `InstallLedgerOptions.partial` → `requirePartialInstallable` | install.ts:457-458 + the reinstall precedent at reinstall.ts:1436-1441 |
| Writing the disabled record shape | field-by-field mutation | `toDisabledRecord(record, updatedAt)` | its empty-tuple return type makes "disabled but populated" a compile error (state-io.ts:85-98) |
| Composing unsupported-kind reason tokens | a local kind→token map | `narrowUnsupportedKinds` from `shared/probe-classifiers.ts` | the sole producer; cross-surface byte parity (list.ts:325, info.ts:986) |
| Asserting the collapse held | a hand-written matrix in each test file | one truth table + one source gate in `tests/orchestrators/reconcile/plan.test.ts` | that file already owns both obligations |
| Test fixtures for the disabled-partial shape | a new factory | `seedPathMarketplace({ installed: { alpha: { version, disabled: true, unsupported: ["lspServers"] } } })` | already produces the exact reachable shape (info-manifest-absent.test.ts:198-225) |

**Key insight:** every second-order edit this phase needs already has an in-repo template.
The phase is a consolidation, not a design.

## Runtime State Inventory

This is a refactor phase touching a persisted classification, so the inventory applies.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | `state.json` per scope holds `plugins[].enabled` (boolean) and `compatibility.installable`. Records already on disk in the disabled-partial shape (`enabled: false`, `installable: false`, empty `resources.*`) **reclassify on next load with no write**. No key, collection, or ID name changes. | **None** — code edit only. Success criterion 6 explicitly forbids a migration, and `migrate.ts:175-176` already defaults absent `enabled` to `true`. |
| Live service config | `claude-plugins.json` / `claude-plugins.local.json` carry `plugins["<p>@<mp>"].enabled`. The collapse does not change how config `enabled` is read (`isDeclaredEnabled`, D-04 consume-time default). | **None** — verified by reading plan.ts:323-325 and config-io.ts:83. |
| OS-registered state | None — this extension registers no OS tasks, services, or PATH entries beyond the in-process `plugin-path.ts` PATH ledger, which already keys on `enabled` alone and needs no change. | **None** — verified by reading plugin-path.ts:23-58. |
| Secrets/env vars | None referenced by any predicate site. `PI_CODING_AGENT_DIR`, `TEST_CONCURRENCY`, `PI_CM_E2E_REF` are unrelated. | **None** — verified by grep over the touched files. |
| Build artifacts | None — no build step (`tsc --noEmit` only, package.json:90); Node runs `.ts` sources natively. | **None**. |

## Common Pitfalls

### Pitfall 1: enable of a disabled partial fails the `requireInstallable` gate

**What goes wrong:** the predicate collapse makes `enable` fall through to
`runEnableBranch`, but the ledger call passes no `partial`, so a still-`partially-available`
candidate throws `PluginShapeError{kind:"no-longer-installable"}` and the row is `(failed)`
instead of re-materializing. ENBL-07 silently unmet with a green predicate test.
**Why it happens:** `runEnableBranch`'s options object (enable-disable.ts:212-225) was
written when a disabled record was `installable: true` by definition.
**How to avoid:** pass `partial` derived from the record (`!installed.compatibility.installable`
or `unsupported.length > 0`).
**Warning signs:** an ENBL-07 test that only exercises a candidate resolving fully
`installable` will pass without the fix. The test must seed an entry that resolves
`partially-available`.

### Pitfall 2: `refreshDisabledRecord` un-degrades the record

**What goes wrong:** after the collapse, `update --partial` on a disabled partial reaches
the short-circuit and calls `refreshDisabledRecord`, which writes, verbatim
(update.ts:1385-1390):

```text
    sRecord.compatibility = {
      installable: true,
      notes: [...installable.notes],
      supported: [...installable.supported],
      unsupported: [...installable.unsupported],
    };
```

`installable: true` is hard-coded while `unsupported` is copied from the resolution — a
self-contradictory record (`installable: true` with a non-empty `unsupported`) that would
then classify as `partially-installed` on list yet pass the old `installable` conjunct
elsewhere.
**Why it happens:** the same "disabled ⇒ installable: true" assumption.
**How to avoid:** derive it, exactly as reinstall does:
`installable: installable.state === "installable"`.
**Warning signs:** a post-update `list` row that flips between `(disabled)` and
`(partially-installed)` for the same record; a state.json with `installable: true` and a
non-empty `unsupported` array.

### Pitfall 3: BFILL-01 backfill re-enables a disabled partial

**What goes wrong:** `backfillOnePluginIsolated` filters on `installable` only
(apply.ts:1033), so a disabled partial whose manifest supported-set grew is passed to
`reinstallPlugin`, whose record write sets `enabled: true` (reinstall.ts:1680) and
re-stages every artifact. The user's disable is reverted at load time with no prompt.
**Why it happens:** BFILL-01 predates the disabled-partial shape being reachable.
**How to avoid:** early-return on `!record.enabled` in `backfillOnePluginIsolated`.
**Warning signs:** an ENBL-08 two-pass test that uses a *manifest-absent* fixture will not
catch this (the offline resolve returns `undefined` and the scan skips at apply.ts:1092-1102).
The catching test needs a **manifest-present** disabled partial whose manifest entry's
supported set grew.

### Pitfall 4: the drift-guard test fails on its own `assert.ok`

**What goes wrong:** deleting `isCurrentlyDisabled` makes the regex at plan.test.ts:755
return `null`, tripping `assert.ok(fnMatch, "T5: isCurrentlyDisabled declaration not found -- has the helper been renamed or removed without updating the drift gate?")`.
**How to avoid:** replace the test wholesale (see §Drift-Guard). Do not delete it — ENBL-05
requires a surviving textual guard.

### Pitfall 5: `exactOptionalPropertyTypes` on conditional message fields

**What goes wrong:** `tsconfig.json` enables `exactOptionalPropertyTypes`, so
`{ scope: maybeUndefined }` is not assignable to `{ scope?: Scope }`. Any new
disabled-row construction must use the conditional-spread idiom the codebase already uses.
**How to avoid:** copy the existing forms, e.g. list.ts:410-414, verbatim:
```text
  const scopeField: { readonly scope?: Scope } =
    pluginScope === marketplaceScope ? {} : { scope: pluginScope };
```
and `info.ts:2122` — `        ...(args.version !== undefined && { version: args.version }),`.
**Warning signs:** `tsc --noEmit` errors of the form "Type 'X | undefined' is not
assignable to type 'X'" on an optional property.

### Pitfall 6: Sonar cognitive-complexity ceilings on the touched functions

**What goes wrong:** two functions this phase edits already carry explicit suppressions and
cannot absorb another branch without tripping the lint gate:
- `enable-disable.ts:386` — `// eslint-disable-next-line sonarjs/cognitive-complexity` above `setPluginEnabled`
- `enable-disable.ts:459` — `// eslint-disable-next-line sonarjs/cognitive-complexity` above the `withLockedStateTransaction` closure
- `update.ts:1549` — `// eslint-disable-next-line sonarjs/cognitive-complexity` above `runThreePhaseUpdate`

**How to avoid:** put the ENBL-07 `partial` derivation inside `runEnableBranch` (a small
function) rather than in the already-suppressed closure; put the Pitfall-2 fix inside
`refreshDisabledRecord` (also small). Do **not** add branches to `setPluginEnabled`'s body.
**Warning signs:** `npm run lint` reporting `sonarjs/cognitive-complexity` on a *different*
function than the suppressed one, or `sonarjs/no-identical-functions` firing once the four
predicate twins are reduced to fewer than two copies (it will not — removing duplicates can
only help).

### Pitfall 7: tests that pin the CURRENT defective behavior

The roadmap forbids leaving tests that assert the defect is intended. Inventory of what
must be **updated** (not merely left green):

| File:line | What it pins | Required change |
|-----------|--------------|-----------------|
| `tests/orchestrators/reconcile/plan.test.ts:723-728` | `(installable:false, enabled:false) → expected: false` | flip to `true` |
| `tests/orchestrators/reconcile/plan.test.ts:636-639` | header prose asserting the false invariant | rewrite |
| `tests/orchestrators/reconcile/plan.test.ts:740-778` | the `isCurrentlyDisabled` body-shape gate | replace with a no-twin-survives gate |
| `tests/orchestrators/plugin/info-manifest-absent.test.ts:919-941` | disabled carve-out for `installable: true` only | widen with the `unsupported: ["lspServers"]` axis |
| `tests/orchestrators/plugin/info-manifest-absent.test.ts:950+` | `--fetch` skip note for the canonical shape only | widen; the partial now yields `{already disabled}` instead of `{not in manifest}` |
| `tests/orchestrators/edge-deps.test.ts:370-377` | fixture comment "`enabled: false` with `installable: true`. The canonical `isRecordedButDisabled` marker" | comment correction; consider adding a disabled-partial fixture row |
| `tests/orchestrators/plugin/plugin-state-classifier.test.ts:178-194` | "The `installable: true` + `enabled: false` marker (isRecordedButDisabled)" | add the `installable: false, enabled: false` case; correct the comment |
| `tests/orchestrators/reconcile/apply.ts` consumers of `__test_scanForceInstalledBackfills` | the stale seam comment at apply.ts:1057-1063 | correct the comment (and add the `enabled` guard test if Pitfall 3 is taken) |

Tests that must stay green **unchanged** — they are the over-reach guards:
`tests/orchestrators/plugin/list.test.ts:1064-1090` (D-63-04 hooks-only plugin renders
`(installed)`, never `(disabled)`), `tests/orchestrators/plugin/enable-disable.test.ts:340-361`
(disable preserves `installable: true` and writes `enabled: false`),
`tests/orchestrators/reconcile/plan-convergence.test.ts:75-84` (SC#4 empty plan).

## Code Examples

### The collapsed predicate (recommended placement)

```typescript
// Source: derived from extensions/pi-claude-marketplace/persistence/state-io.ts:99-127 (existing disabled-shape ownership)
/**
 * ENBL-05: the sole disabled-state predicate. A record is disabled iff the
 * disable orchestrator wrote `enabled: false`; `compatibility.installable` is an
 * orthogonal availability axis and is deliberately NOT read here -- a
 * soft-degraded record can be disabled too (the shape `toDisabledRecord`
 * produces from a partially-installed record).
 */
export function isRecordedButDisabled(record: { readonly enabled: boolean }): boolean {
  return !record.enabled;
}
```

### The ENBL-07 enable-branch fix

```typescript
// Source: extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts:212-225 (call site) +
//         extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts:1436-1441 (partial-capable precedent)
    const result = await runInstallLedger(
      state,
      locations,
      {
        ctx: opts.ctx,
        scope,
        cwd: opts.cwd,
        marketplace: opts.marketplace,
        plugin: opts.plugin,
        pinVersionOverride: recordedVersion,
        allowExistingRecord: true,
        // ENBL-07: a disabled PARTIAL record re-materializes through the
        // partial gate, or requireInstallable rejects the still-degraded
        // candidate and the enable fails instead of restoring the artifacts.
        partial: !installedCompatibilityInstallable,
      },
      capture,
    );
```

### The ENBL-09 `refreshDisabledRecord` fix

```typescript
// Source: extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts:1670-1677 (the derive-don't-hardcode template)
    sRecord.compatibility = {
      installable: installable.state === "installable",
      notes: [...installable.notes],
      supported: [...installable.supported],
      unsupported: [...installable.unsupported],
    };
```

### The ENBL-08 two-pass steady-state test shape

```typescript
// Source: tests/orchestrators/reconcile/plan-convergence.test.ts:19-33 (planner-level no-op proof idiom)
// Pass 1 may plan a disable (if the record is still materialized); pass 2 must plan nothing.
const first = planReconcile(merged, state, "user");
// ...apply the disable to `state`...
const second = planReconcile(merged, state, "user");
assert.deepEqual(second, emptyReconcilePlan("user"));
```
For the pure-planner variant, seed the state directly in the disabled-partial shape and
assert **both** passes are empty — `planReconcile` is pure, so two identical calls over an
unchanged state prove the fixed point without an apply step.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Disabled = "all four `resources.*` arrays empty AND `installable: true`" (heuristic) | Disabled = explicit `enabled: false` boolean on the record | ENBL-02 (v1.12) | The heuristic misclassified hooks-only installs; D-63-04 fixed the array count, ENBL-02 replaced the heuristic entirely — but left the `installable` conjunct behind |
| Disabled = `installable && !enabled` (four copies) | Disabled = `!enabled` (one definition) | **this phase, ENBL-05** | Restores the orthogonality of declared / enabled / available that ENBL-04 asserts |
| Resolver two-way `installable: true \| false` | Three-way `installable \| partially-available \| unavailable` (D-64-01) | v1.13-v1.15 | Made `compatibility.installable: false` a *common* persisted state, which is what silently broke ENBL-04 |

**Deprecated/outdated:** every source comment describing the "empty-resources +
`installable: true` marker" (inventory in §Drift-Guard). The empty-resources half was
superseded by ENBL-02; the `installable: true` half is superseded by this phase.

## Package Legitimacy Audit

**Not applicable** — this phase installs no external packages. It edits existing
TypeScript source and tests only. No `package.json` dependency change is expected.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | test runner + native TS execution | ✓ (repo requires `>=20.19.0`) | per `engines` | — |
| npm | `npm run check` | ✓ | — | — |
| Network | nothing in this phase | n/a | — | all touched orchestrators are under the NFR-5 no-network gate |
| `pi-subagents` global peer | two pre-existing integration tests | ✗ (known-absent locally and in CI) | — | those two tests skip in CI and may fail locally on a stale global version — **environment, not a regression** |

**Missing dependencies with no fallback:** none.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | `node:test` (Node built-in), no external runner |
| Config file | none — glob-driven via `package.json` scripts |
| Quick run command | `node --test "tests/orchestrators/plugin/enable-disable.test.ts"` (single file, seconds) |
| Full suite command | `npm run check` (typecheck + lint + format:check + test + test:integration) |

[VERIFIED: package.json:76-91]

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ENBL-05 | truth-table cell `(installable:false, enabled:false)` is disabled | unit | `node --test "tests/orchestrators/reconcile/plan.test.ts"` | ✅ (cell must flip) |
| ENBL-05 | no conjunctive twin survives in any of the four former definition files | architecture (source grep) | `node --test "tests/orchestrators/reconcile/plan.test.ts"` | ✅ (test replaced) |
| ENBL-06 | `info` renders a manifest-absent disabled **partial** as `(disabled)` with no `{not in manifest}` | integration (byte-exact) | `node --test "tests/orchestrators/plugin/info-manifest-absent.test.ts"` | ✅ (widen at :919) |
| ENBL-06 | `list` renders a disabled partial as `(disabled)`, distinct from an enabled partial | integration (byte-exact) | `node --test "tests/orchestrators/plugin/list.test.ts"` | ❌ new test |
| ENBL-06 | `info --fetch` on a disabled partial emits `{already disabled}`, not `{not in manifest}` | integration | `node --test "tests/orchestrators/plugin/info-manifest-absent.test.ts"` | ❌ new test |
| ENBL-07 | `enable` on a disabled partial re-materializes (candidate resolves `partially-available`) | integration | `node --test "tests/orchestrators/plugin/enable-disable.test.ts"` | ❌ new test |
| ENBL-07 | `enable` on a **manifest-absent** disabled partial fails clean, no materialization | integration (boundary) | `node --test "tests/orchestrators/plugin/enable-disable.test.ts"` | ❌ new test |
| ENBL-07 | `disable` on an already-disabled partial is idempotent (`(skipped) {already disabled}`, no cascade) | integration (byte-exact) | `node --test "tests/orchestrators/plugin/enable-disable.test.ts"` | ❌ new test |
| ENBL-08 | two consecutive `planReconcile` passes over a disabled partial + disabling config → zero actions | unit (pure planner) | `node --test "tests/orchestrators/reconcile/plan.test.ts"` | ❌ new test |
| ENBL-08 | BFILL-01 backfill does not re-materialize/re-enable a disabled partial (if Pitfall 3 is taken) | unit (via `__test_scanForceInstalledBackfills`) | `node --test "tests/orchestrators/reconcile/apply.test.ts"` | ❌ new test |
| ENBL-09 | `update --partial` on a disabled partial short-circuits (no re-staging, `unchanged` byte form) | integration | `node --test "tests/orchestrators/plugin/update.test.ts"` | ❌ new test |
| ENBL-09 | the short-circuit's record write derives `installable` from the resolution | unit/integration (state assertion) | `node --test "tests/orchestrators/plugin/update.test.ts"` | ❌ new test |
| cross | classifier returns `installed` for a disabled partial; completion bucketizer agrees | unit | `node --test "tests/orchestrators/plugin/plugin-state-classifier.test.ts" "tests/orchestrators/edge-deps.test.ts"` | ✅ (extend) |
| regression | D-63-04 hooks-only plugin still `(installed)` | integration | `node --test "tests/orchestrators/plugin/list.test.ts"` | ✅ unchanged |
| regression | SC#4 planner convergence stays empty | unit | `node --test "tests/orchestrators/reconcile/plan-convergence.test.ts"` | ✅ unchanged |
| regression | catalog byte gate | architecture | `node --test "tests/architecture/catalog-uat.test.ts"` | ✅ unchanged (bare-row recommendation) |

### Sampling Rate

- **Per task commit:** `node --test "tests/orchestrators/{plugin,reconcile}/**/*.test.ts"` plus `npm run typecheck`
- **Per wave merge:** `npm test` (the unit/architecture glob)
- **Phase gate:** `npm run check` fully green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] None for infrastructure — `node:test`, the hermetic-HOME helper, and `seedPathMarketplace`
      already exist in every target test file and support the disabled-partial axis unchanged.
- [ ] Fixture note: `tests/orchestrators/plugin/list.test.ts` and
      `tests/orchestrators/plugin/update.test.ts` each have their **own** local
      `seedPathMarketplace`/`seedMarketplace` factory (six distinct copies exist across the
      suite). Confirm the target file's local factory exposes both a `disabled` and an
      `unsupported`/`compatUnsupported` axis before writing the test; extend that file's local
      factory rather than importing across test trees (established house convention:
      "copy, don't import").

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | no auth surface touched; git credential paths untouched |
| V3 Session Management | no | no sessions |
| V4 Access Control | **yes (indirectly)** | the predicate gates whether a plugin's artifacts are materialized. Widening "disabled" is fail-**closed** (more records classify as disabled ⇒ fewer artifacts materialized), which is the safe direction. The one fail-open risk is Pitfall 3: a backfill that re-enables a disabled plugin re-materializes hooks/MCP entries the user deliberately removed. |
| V5 Input Validation | yes (unchanged) | `enabled` is `Type.Boolean()` on `PLUGIN_INSTALL_RECORD_SCHEMA` (state-io.ts:77); typebox validates at load |
| V6 Cryptography | no | none |
| V12 File Handling | yes (unchanged) | `assertPathInside` / `ScopedLocations` containment (NFR-10) is untouched; no new path derivation |

### Known Threat Patterns for this change

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| A disabled plugin's hooks/MCP servers silently re-materialize at load time | Elevation of Privilege | Pitfall 3's `!record.enabled` guard in `backfillOnePluginIsolated`; hooks cache is dropped on disable via `dropCachedHooks` (enable-disable.ts:333-351) |
| A `PATH` entry for a disabled plugin's `bin/` leaking into child processes (CWE-426) | Elevation of Privilege | already mitigated — `collectBinDirs` skips `!rec.enabled` and validates `resolvedSource` via `asAbsolutePluginRoot` (plugin-path.ts:34-56). The collapse aligns every other surface with this already-correct behavior. |
| A record classified disabled but still holding materialized artifacts | Repudiation / state lie | `DisabledPluginRecord`'s empty-tuple `resources` makes the contradiction a compile error (state-io.ts:100-109) |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Placing the predicate in `persistence/state-io.ts` will not trip the DIFF-01 planner purity gate, because the gate is a token grep and none of its forbidden tokens appear in an `isRecordedButDisabled` import line. | Where the Single Predicate Should Live | Low — trivially falsifiable by running `node --test tests/architecture/reconcile-planner-purity.test.ts` in the first task. If it trips, fall back to `shared/` with a structural parameter (zero imports). |
| A2 | Passing `partial: true` to `runInstallLedger` from the enable branch restores the *same* degraded materialization the record was installed with. | Pitfall 1 / ENBL-07 | Medium — if the manifest's unsupported set changed since install, the re-materialized set differs from the recorded `resources.*`. This may be desirable (fresher truth) but should be an explicit planning decision, mirroring reinstall's D-68-02 "repair/promotion" stance. |
| A3 | The operator wants Pitfall 3 (the BFILL-01 `enabled` guard) fixed inside Phase 97 rather than deferred. | ENBL-08 / Pitfall 3 | Medium — it is arguably a separate pre-existing defect. ENBL-08's literal text is only about the disable re-plan. If deferred, file a todo carrier so it is not lost (per the "verifier deferrals need a carrier" lesson). |
| A4 | Pinning the manifest-absent enable boundary as a unit-level byte assertion (not a new catalog state) satisfies the byte-gate convention. | Enable on a Manifest-Absent Partial | Low-Medium — if the operator considers any user-visible byte form catalog-bound, a new `enable-not-in-manifest` catalog state is required instead. |

## Open Questions (RESOLVED at planning)

1. **Does ENBL-08's "steady state" include the BFILL-01 backfill re-materialization?**
   - What we know: the backfill scan filters only on `installable`, has no `enabled` guard,
     and `reinstall` writes `enabled: true` — so a manifest-present disabled partial with a
     grown supported set is re-materialized and re-enabled at load time.
   - What's unclear: the requirement text names only the disable re-plan.
   - Recommendation: fix it in this phase (a two-line guard plus a test) and cite ENBL-08;
     it is the same class of defect and leaving it makes the "steady state" claim false.

2. **Should `enable` on a disabled partial restore the recorded component set or the current
   manifest's component set?**
   - What we know: the ledger re-discovers from the manifest, so it restores the *current*
     supported set, not the recorded one. `pinVersionOverride` freezes the version but not
     the component inventory.
   - What's unclear: whether ENBL-07's "re-materializes" means "restores what was there".
   - Recommendation: accept the current-manifest behavior (it matches reinstall's
     repair/promotion stance, D-68-02) and state it explicitly in the plan and the test name.

3. **Does the disabled-partial `(disabled)` row need a catalog amendment at all?**
   - What we know: with the bare-row recommendation the emitted bytes are byte-identical to
     the existing `disabled-inventory` state, so the byte gate needs no new block — only the
     four prose fragments describing the trigger predicate change.
   - Recommendation: prose-only catalog edit; no new `catalog-state` marker.

## Sources

### Primary (HIGH confidence)

All findings are from files read in the worktree
`/home/acolomba/pi-claude-marketplace/.worktrees/manifest-independent-plugin-info` on
2026-08-09, cited inline with `path:line-range` and quoted verbatim:

- `extensions/pi-claude-marketplace/orchestrators/reconcile/plan.ts` (1-60, 240-400)
- `extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts` (640-711, 900-1120)
- `extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts` (140-560, 760-960, 1025-1068)
- `extensions/pi-claude-marketplace/orchestrators/plugin/update.ts` (725-741, 860-1092, 1330-1400, 1540-1600)
- `extensions/pi-claude-marketplace/orchestrators/plugin/install.ts` (443-502, 656-800)
- `extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts` (1436-1460, 1650-1690, 1975-2005)
- `extensions/pi-claude-marketplace/orchestrators/plugin/list.ts` (321-345, 380-510)
- `extensions/pi-claude-marketplace/orchestrators/plugin/info.ts` (960-1010, 2030-2200, 2230-2372)
- `extensions/pi-claude-marketplace/orchestrators/plugin/plugin-state-classifier.ts` (full)
- `extensions/pi-claude-marketplace/orchestrators/plugin-path.ts` (1-60)
- `extensions/pi-claude-marketplace/orchestrators/edge-deps.ts` (12-95)
- `extensions/pi-claude-marketplace/persistence/state-io.ts` (60-148)
- `extensions/pi-claude-marketplace/persistence/migrate-config.ts` (78-148)
- `extensions/pi-claude-marketplace/persistence/migrate.ts` (175-176)
- `extensions/pi-claude-marketplace/shared/notify.ts` (722-790, 990-1005)
- `tests/orchestrators/reconcile/plan.test.ts` (620-778)
- `tests/orchestrators/reconcile/plan-convergence.test.ts` (1-84)
- `tests/orchestrators/plugin/info-manifest-absent.test.ts` (60-260, 800-980)
- `tests/orchestrators/plugin/list.test.ts` (1050-1090)
- `tests/orchestrators/plugin/enable-disable.test.ts` (330-400)
- `tests/orchestrators/plugin/plugin-state-classifier.test.ts` (165-215)
- `tests/orchestrators/edge-deps.test.ts` (360-390, 560-600, 760-800)
- `tests/architecture/reconcile-planner-purity.test.ts` (full)
- `tests/architecture/no-orchestrator-network.test.ts` (55-95)
- `tests/architecture/catalog-uat.test.ts` (1-70)
- `tests/persistence/fixtures/legacy/state-populated-mixed.json` (parsed)
- `docs/output-catalog.md` (lines 14, 149, 324-368, 1548-1602, 2110-2270)
- `.planning/REQUIREMENTS.md` (15, 54-58, 97-110)
- `.planning/ROADMAP.md` (24, 219-236)
- `.planning/STATE.md` (1-80)
- `.planning/phases/97-disabled-state-classification-repair/97-CONTEXT.md` (full)
- `.planning/todos/pending/2026-08-09-disabled-partial-reaches-state-only-info-arm.md` (full)
- `CLAUDE.md`, `.claude/rules/typescript-comments.md`, `package.json`, `eslint.config.js`, `.planning/config.json`

### Secondary (MEDIUM confidence)

None — no web sources were needed or consulted.

### Tertiary (LOW confidence)

None.

## Metadata

**Confidence breakdown:**

- Predicate inventory: **HIGH** — exhaustive `.enabled` sweep across `extensions/`, four conjunctive definitions and one correct read located and quoted with line ranges.
- Behavior sites (ENBL-06..09): **HIGH** — each defect traced from the predicate through the branching code to the rendered byte form, with the driving line quoted.
- Rendering / catalog decision: **HIGH** — the row type has no `reasons` field and no disabled catalog state carries a brace; the cost asymmetry is structural, not stylistic.
- Second-order pitfalls (1, 2, 3): **HIGH** for the code facts (all quoted); **MEDIUM** for whether the operator wants Pitfall 3 in scope (see A3).
- Test-update inventory: **HIGH** — each pinning test located and quoted.

**Research date:** 2026-08-09
**Valid until:** 2026-09-08 (in-repo facts; invalidated only by edits to the cited files)
