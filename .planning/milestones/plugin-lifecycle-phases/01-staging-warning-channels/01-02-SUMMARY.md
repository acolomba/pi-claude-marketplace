---
phase: 01-staging-warning-channels
plan: 02
subsystem: staging-warnings
status: complete
tags: [warnings, update, reinstall, install, diagnostics, types]
requires:
  - "01-01: shared/staging-warnings.ts (DiscoveryWarning, HygieneWarning, StagingWarning, partitionStagingWarnings)"
provides:
  - "PluginUpdateUpdatedOutcome.stagingWarnings?: readonly StagingWarning[] (both halves, bridge order, both modes; `notes` removed from the updated arm) (D-PL1-10)"
  - "ReinstallReinstalledOutcome.discoveryWarnings?: readonly DiscoveryWarning[] (D-PL1-11)"
  - "orchestrators/plugin/shared.ts: StagingDiagnostic, surfaceStagingDiagnostics(ctx, run, diagnostics) (D-PL1-07, D-PL1-08)"
  - "surfaceDiscoveryWarnings takes readonly DiscoveryWarning[] only, pinned by @ts-expect-error (D-PL1-04)"
affects:
  - extensions/pi-claude-marketplace/orchestrators/types.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/{update-swap,update-flow,reinstall-flow,install-flow,shared}.ts
tech-stack:
  added: []
  patterns:
    - "One list renderer for every staging diagnostic; callers map outcomes to StagingDiagnostic entries"
key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/orchestrators/types.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/update-swap.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/update-flow.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/reinstall-flow.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/install-flow.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/shared.ts
    - test/orchestrators/types.test.ts
    - test/orchestrators/plugin/update-swap.test.ts
    - test/orchestrators/plugin/update-flow.test.ts
    - test/orchestrators/plugin/reinstall-flow.test.ts
    - test/orchestrators/plugin/reinstall-record.test.ts
    - test/orchestrators/plugin/shared.test.ts
decisions:
  - "surfaceDiscoveryWarnings' parameter is `Omit<StagingDiagnostic, \"warnings\"> & { warnings: readonly DiscoveryWarning[] }`, so the seven-verb union lives once, on StagingDiagnostic."
  - "The update and reinstall mappers (`updateStagingDiagnostic`, `reinstallStagingDiagnostic`) return a zero- or one-element array and feed `flatMap`, so the per-partition branch sits in a small helper and the render helpers are one line."
  - "The both-halves update-swap case uses an agents conversion note as the hygiene warning, as plan 01-01 did: the resolver refuses any plugin whose mcp entries would make the mcp bridge warn."
metrics:
  duration: "~40m"
  completed: "2026-10-27"
estimate:
  tokens: 95000
  tasks: 2
actuals:
  tokens: 11800
  tasks: 2
  commits: 2
plan_head_before: 0609c4a35068dd36fb35ca9b2d9561cec193f307
plan_head_after: e173016c0a723a9c411aa1a9cb4c8848ca0a4093
commits: 2
---

# Phase 1 Plan 02: Typed staging warning carriers and the list renderer Summary

The update runner now carries both halves of its bridge staging warnings,
typed and tagged, on the `updated` outcome's `stagingWarnings`. Reinstall
carries its discovery half typed. The one renderer accepts discovery warnings
only, so a hygiene warning cannot reach a diagnostic without a compile error.
One list renderer, `surfaceStagingDiagnostics`, gives every later cascade the
same placement rule. No diagnostic changed bytes.

## Tasks

| Task | Name | Commit | Hook |
| ---- | ---- | ------ | ---- |
| 1 | Carry typed staging warnings on the update and reinstall outcomes | cc945def | TruffleHog, prettier, `npm run check:commit`, gitlint: all Passed |
| 2 | Make the renderer accept discovery warnings only, behind one list renderer | e173016c | TruffleHog, prettier, `npm run check:commit`, gitlint: all Passed |

### Task 1 (D-PL1-10, D-PL1-11)

- `orchestrators/types.ts`: the `updated` arm loses `notes?` and gains
  `stagingWarnings?: readonly StagingWarning[]`.
  `ReinstallReinstalledOutcome.discoveryWarnings` is
  `readonly DiscoveryWarning[]`. Both docs are rewritten. The `failed` arm is
  unchanged (plan 01-06 adds its members).
- `update-swap.ts`: `collectUpdateWarnings(handles)` returns the five
  handles' warnings in bridge order, both halves. It has no cascade parameter.
  The success return spreads `stagingWarnings` only when non-empty. The old
  `notes` spread is deleted. The module header and the helper doc describe the
  typed carrier. The intent-mark `try` block is untouched.
- `update-flow.ts::surfaceUpdateDiscoveryWarnings` read the discovery half of
  `stagingWarnings`. Task 2 then replaced that body.
- `reinstall-flow.ts`: `ReinstallReached.discoveryWarnings` is typed.
  `runReinstall` takes the discovery half of `run.stagingWarnings`. The
  render-none arm folds the discovery messages and the maintenance warnings
  into `notes` behind `warning: `, with the same bytes as before, and spreads
  the typed `discoveryWarnings`. The module header comment is updated.
- Tests: the literals in `types.test.ts`, `reinstall-record.test.ts`,
  `update-flow.test.ts`, `reinstall-flow.test.ts` and `update-swap.test.ts`
  now use typed values. New `update-swap.test.ts` cases:
  - a direct swap and a cascade swap each return the same whole outcome. Its
    `stagingWarnings` holds a skills discovery warning, then an agents hygiene
    warning, and it has no `notes` key.
  - a clean swap's outcome has no `stagingWarnings` key and no `notes` key
    (NREG-01).
  - the D-18-15 cascade overwrite case now pins its agents fallback note as a
    hygiene-tagged `stagingWarnings` entry.

### Task 2 (D-PL1-04, D-PL1-07, D-PL1-08)

- `orchestrators/plugin/shared.ts`: `export interface StagingDiagnostic` has
  `plugin`, `scope`, the seven-verb union and `warnings: readonly
  StagingWarning[]`. `surfaceDiscoveryWarnings` takes `Omit<StagingDiagnostic,
  "warnings"> & { warnings: readonly DiscoveryWarning[] }` and redacts
  `warning.message`. `surfaceStagingDiagnostics(ctx, run, diagnostics)` sends
  each entry's discovery half, in entry order, through
  `surfaceDiscoveryWarnings`.
- Callers: install passes `installCtx.discoveryWarnings`. `update-flow.ts`
  and `reinstall-flow.ts` each map their outcomes to `StagingDiagnostic`
  entries and call `surfaceStagingDiagnostics` once. Both mappers are
  annotated with the type.
- `shared.test.ts`: the existing renderer cases pass `discoveryWarning(...)`
  values, with the same expected bytes. New `surfaceStagingDiagnostics`
  cases:
  - two mixed entries render two diagnostics in entry order, each with only
    its discovery lines. This case uses the JSON capture, so the order is
    asserted.
  - an entry with only hygiene warnings renders nothing (strong mock with no
    expectation).
  - an empty list renders nothing.
  - the D-PL1-04 compile-time negative: `// @ts-expect-error` above
    `void (HYGIENE_DIAGNOSTIC satisfies Parameters<typeof
    surfaceDiscoveryWarnings>[2]);`.

## Verification

- `npm run typecheck`: exit 0 after each task.
- Task 1 owner tests (types, update-swap, update-flow, reinstall-flow,
  reinstall-record): 708 tests, 0 fail after the fixes. Direct coverage of
  `update-swap.ts`, `update-flow.ts` and `reinstall-flow.ts`: exit 0 (100%).
- Task 2 owner tests (shared, install-flow, update-flow, reinstall-flow): 902
  pass, 0 fail. Direct coverage of `shared.ts`, `install-flow.ts`,
  `update-flow.ts` and `reinstall-flow.ts`: exit 0 (100%).
- `npx cucumber-js features/plugin/staging-warnings.feature`: 3 scenarios, 30
  steps passed. No scenario was edited.
- `npm run fallow` (dead code, cycles, health, dupes): exit 0 before the
  Task 2 commit. ESLint on every touched file: exit 0.
- Acceptance greps: `notes?:` in the updated arm 0, `stagingWarnings?` 1,
  `notes: updateWarnings` 0, typed `discoveryWarnings?` 1,
  `surfaceStagingDiagnostics` export 1, `StagingDiagnostic` export 1,
  `@ts-expect-error` in `shared.test.ts` 2, `surfaceStagingDiagnostics(` in
  `update-flow.ts` 1 and in `reinstall-flow.ts` 1.
- The wave gate (`npm run check` on the combined tree with plan 01-03) is the
  orchestrator's step.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Two reinstall-flow cases compared typed warnings against strings**

- **Found during:** Task 1 (owner tests)
- **Issue:** `PDEF-01: reinstall stages every agent directory` and
  `D-141-03: a reinstall carries its discovery warning on notes ...` compared
  `discoveryWarnings` with plain strings. Typecheck missed both because
  `deepStrictEqual` accepts `unknown`.
- **Fix:** Both cases now expect `{ kind: "discovery", message }` literals.
  `notes` keeps its string expectation.
- **Commit:** cc945def

### Scope notes (comment-only changes outside the named functions)

- `update-flow.ts`: the module header paragraph described the `notes`
  carrier and the cascade-only hygiene half. It is rewritten for
  `stagingWarnings` (comment only; Phase 7 edits code elsewhere in the file).
- `install-flow.ts`: the comment above
  `warnings.push(...installCtx.discoveryWarnings...)` in
  `collectPostCommitWarnings` said the caller renders the returned array. It
  now says the caller renders the typed `installCtx.discoveryWarnings`
  (comment only).

### Test support

- `seedCollidingSkills` in `update-flow.test.ts` is now exported, and
  `update-swap.test.ts` reuses it rather than copying it (no new clone group).
- `update-swap.test.ts` gains a `directSwapArgs(cwd)` helper. The existing
  direct duplicate case uses it in place of its inline literal. That case is
  renamed `D-PL1-10: a direct swap puts an agents duplicate on the updated
  outcome's stagingWarnings`.
- Some `update-flow.test.ts` titles named `notes` and now name
  `stagingWarnings`. The cascade case now also checks each warning's tag.
- The plan's "skills discovery and mcp hygiene" case uses an agents fallback
  note as its hygiene warning. The resolver refuses an install or update
  whose mcp entries would make the mcp bridge warn. The mcp hygiene tag stays
  pinned in `test/bridges/mcp/stage.test.ts`.

### Shared-worktree note

Twice, plan 01-03's `git commit` ran its pre-commit stash while this plan had
unstaged edits. Each time, the edits disappeared from the worktree for the
length of that hook run. I kept a copy of each stash patch in the scratchpad
and waited for the sibling's commit to finish. Pre-commit restored the edits
both times, and nothing was lost. I ran this plan's tests only when no
sibling commit was in progress.

## Backlog dispositions

- **WCHAN-01:** closed. The producer tags landed in plan 01-01. The renderer
  now takes `readonly DiscoveryWarning[]`, pinned by the `@ts-expect-error`
  in `test/orchestrators/plugin/shared.test.ts`. The list renderer passes
  only the discovery half.

## Requirement status

This plan completes WRN-03: tags at the producer, one classifier, and a
renderer that refuses hygiene warnings at compile time (phase criterion 3).
WRN-02's cascade rendering lands in later plans. Per the dispatch, this plan
leaves `.planning/REQUIREMENTS.md` and `.planning/STATE.md` unchanged for the
orchestrator to update.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

T-01-04 holds: `surfaceDiscoveryWarnings` takes `readonly DiscoveryWarning[]`
(compile error for a hygiene value, pinned by `@ts-expect-error`), and
`surfaceStagingDiagnostics` passes only the discovery half. The direct-mode
hygiene half that now rides `stagingWarnings` never renders; the
`D-PL1-08: an entry with only hygiene warnings renders nothing` case and the
unchanged update-flow standalone byte pins prove it. Every line still goes
through `redactAbsolutePaths` (NFR-9).

## Self-Check: PASSED
