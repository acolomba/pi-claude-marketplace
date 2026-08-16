---
phase: 105-no-op-parity-sweep-and-contract-documentation
plan: 01
subsystem: tests/orchestrators/plugin
tags: [dfen-08, parity, characterization, update-cascade, closed-sets]
status: complete

requires:
  - "tests/orchestrators/plugin/update.test.ts::seedPathMarketplace (entryDefaultEnabled + omitPluginJsonVersion knobs, unchanged)"
  - "tests/orchestrators/plugin/update.test.ts::rewriteManifest (entryDefaultEnabled knob, unchanged)"
  - "tests/architecture/no-lifecycle-default-enabled-read.test.ts (inherited, asserted not rebuilt)"
  - "tests/architecture/compat-01-no-expansion.test.ts (inherited, asserted not rebuilt)"
provides:
  - "DFEN-08 three-plugin parity case for the update cascade (declared-false / declared-true / silent)"
  - "the reusable assertion shape the reinstall and reconcile surfaces clone: whole-body literal + row-to-row equality + flip-with-version-control"
  - "recorded evidence that criterion 4 and the structural half of the lifecycle guarantee ride inherited gates"
affects:
  - "tests/orchestrators/plugin/reinstall.test.ts (next plan clones the shape)"
  - "tests/orchestrators/reconcile/apply.test.ts (next plan clones the shape)"

tech-stack:
  added: []
  patterns:
    - "whole-body `assert.equal` against a `+`-concatenated literal, one row per line"
    - "row-to-row equality with the plugin name normalized out, stated apart from the literals"
    - "one manifest rewrite carrying both the subject (declaration flip) and its control (version bump)"

key-files:
  created: []
  modified:
    - "tests/orchestrators/plugin/update.test.ts (+168 lines, one new test)"

decisions:
  - "The parity claim is asserted about ROWS, not the whole message: the declaring-false sibling legitimately moves the tally from three to two, which is the fixture's own third arm changing the count rather than a parity break."
  - "The silent arm is a first-class fixture plugin carrying no `defaultEnabled` key at all, not an implied default -- the seeder's conditional spread writes no key when the knob is absent."
  - "Criterion 4 is ASSERTED on the inherited no-expansion gate, never rebuilt beside it."

metrics:
  duration: ~25 min
  completed: 2026-08-15
  tasks: 2
  commits: 1 (plus this docs commit)

actuals:
  tokens: 3500
  tasks: 2
  commits: 1
---

# Phase 105 Plan 01: No-op parity sweep (update surface) Summary

A three-plugin DFEN-08 parity case now pins the update cascade byte-for-byte: an entry declaring the install-time default TRUE and an entry declaring nothing render identical rows, asserted against each other and against the pre-milestone form, under a manifest whose re-read is proven by a moving version.

## What Was Built

**Task 1 — the DFEN-08 triple (commit `63cc08d8`).** One new test in `tests/orchestrators/plugin/update.test.ts`, placed immediately after the single-plugin `DFEN-07 / D-103-10` flip case so a reader meets the general rule beside the specific one.

- **Fixture:** one path-source marketplace `mp`, project scope, three plugins at `1.0.0` each with a skill and `omitPluginJsonVersion: true` (so `entry.version` reaches the record). `alpha` declares the install-time default FALSE, `beta` declares it TRUE, `gamma` carries no declaration key at all. No `installedVersions` map — the records come from real installs. The seeder needed no new parameter.
- **Install:** three real `installPlugin` calls in name order, each with `applyDefaultEnabled: true` — the same flag the real install handler and the reconcile apply path pass. A precondition block asserts the three records landed disabled / enabled / enabled, all at `1.0.0`, before any update runs.
- **Flip:** ONE `rewriteManifest` carrying both halves — every version moves to `2.0.0`, and every declaration inverts (`alpha` to true, `beta` to false, `gamma` gains an explicit false).
- **Act:** one bulk `updatePlugins` over `{ kind: "marketplace", marketplace: "mp" }`.
- **Assert:** exactly one notification with `severity === undefined` (taken from the run, not chosen); the whole body equal to the literal recorded in the research probe; the parity claim stated separately (the `beta` and `gamma` rows each equal to their pre-milestone literal AND equal to each other with the plugin name normalized out); then records — `alpha` still disabled, `beta`/`gamma` still enabled, all three moved to `2.0.0` as the control.

No production file was touched, and no existing test was changed.

**Task 2 — evidence only.** No file modified. See "Inherited gate evidence" below.

## Inherited gate evidence (Task 2)

Both gates run on the current tree, counters quoted verbatim:

```text
=== gate 1: no-lifecycle-default-enabled-read ===
# tests 1
# pass 1
# fail 0
=== gate 2: compat-01-no-expansion ===
# tests 14
# pass 14
# fail 0
```

The complete delta of the closed-set gate since the milestone base (`git merge-base HEAD main` = `bb6af555136be3263df912b1870671f0ca889022`) is exactly one added line and zero removed lines:

```diff
+      "installs disabled",
```

Mechanically: `count_added=1`, `count_removed=0`, and the added line carries the one intended reason token (`installs disabled`, matched once). `ls tests/architecture/ | grep -c 'no-expansion'` returns `1` and `ls tests/architecture/ | grep -c 'no-lifecycle-default-enabled-read'` returns `1` — exactly one gate file of each kind.

This plan ASSERTS these two gates rather than rebuilding them, honoring CONTEXT's instruction that criterion 4 rides the existing `compat-01-no-expansion.test.ts` unchanged and that a second no-expansion test must not be built beside the inherited one.

Working-tree note: `git status --porcelain -- tests/architecture/` shows one modified file, `tests/architecture/no-orchestrator-network.test.ts`. That file belongs to a concurrently-running sibling plan in this shared worktree and is NOT attributable to this plan. Neither `compat-01-no-expansion.test.ts` nor `no-lifecycle-default-enabled-read.test.ts` was modified.

## Mutation check (performed by hand, NOT committed)

Required by the acceptance criteria, both outcomes recorded:

- **(a) One-character break in the expected literal — MUST fail.** Changed `"  ● beta v1.0.0 → v2.0.0 (updated)\n"` to `v2.0.1` inside the whole-body literal. Result: `not ok 1 - DFEN-08: ...`, `# fail 1`, and the assertion diff named the row directly (`+ '  ● beta v1.0.0 → v2.0.0 (updated)\n'` / `- '  ● beta v1.0.0 → v2.0.1 (updated)\n'`). Reverted.
- **(b) Silent plugin's seeded declaration changed from absent to `true` — MUST still pass.** Added `entryDefaultEnabled: true` to `gamma`'s fixture spec. Result: `ok 1 - DFEN-08: ...`, `# pass 1`, `# fail 0`. That is the parity claim being TRUE rather than the assertion being blind. Reverted.

Neither mutation is in the committed tree; the file was re-run green after both reverts and after prettier formatting.

## Verification

| Check | Result |
|-------|--------|
| `node --test tests/orchestrators/plugin/update.test.ts` | 101 tests, 101 pass, **0 fail** (100 pre-existing + 1 new) |
| New test present | `ok 54 - DFEN-08: a declared-true entry and a silent entry render identical update rows` |
| `node --test tests/architecture/no-lifecycle-default-enabled-read.test.ts` | 1 pass, 0 fail |
| `node --test tests/architecture/compat-01-no-expansion.test.ts` | 14 pass, 0 fail |
| `npx tsc --noEmit` | clean, no output |
| `npx eslint tests/orchestrators/plugin/update.test.ts` | clean |
| `npx prettier --check` | passes (formatted before commit) |
| `git diff --name-only -- extensions/` | empty — no production file touched |
| Added lines matching `\b(Phase\|Plan\|Wave\|Pitfall\|Milestone) [0-9]` | none |
| `pre-commit run --files tests/orchestrators/plugin/update.test.ts` | all applicable hooks Passed (TruffleHog skipped per worktree rule) |
| TruffleHog filesystem scan | exit 0, `verified_secrets: 0`, `unverified_secrets: 0` |

The full `npm test` / `npm run check` phase gate is deliberately NOT run here — two sibling plans are mid-edit in this shared worktree and the orchestrator owns the wave boundary.

## Deviations from Plan

None — the plan executed exactly as written. The prohibition against changing production behavior was honored: this is a characterization sweep and it uncovered no parity break. The recorded byte forms from the research probe matched the live run on the first attempt, including the `severity === undefined` value, which was taken from the run rather than chosen.

Two acceptance criteria were satisfied in a way worth naming precisely:

- The criterion forbidding `.includes(` inside the body-comparison region is satisfied strictly: the row extractor uses `String.prototype.startsWith` on the full row prefix (`"  ● beta "`), not a substring containment check, so it cannot match a row it was not aimed at.
- The row-to-row equality operands are both derived from the rendered body (`rows.find(...)` over `body.split("\n")`), not from the literals, so the comparison is a genuine coincidence claim rather than a restatement.

## Known Stubs

None.

## Threat Flags

None. No file under `extensions/` was modified, no network endpoint, auth path, file-access pattern or schema changed, and the asserted byte forms hold only frozen closed-set literals and fixture-authored plugin names.

## Notes for the sibling surfaces

The shape this plan commits, for `reinstall` and `reconcile` to clone without re-deriving:

1. Three plugins in one fixture — declared-false, declared-true, silent (no key at all).
2. Install every arm through the production path with the install-time opt-in set.
3. Precondition-assert the landed records BEFORE the verb under test runs.
4. ONE rewrite that flips every declaration and bumps every version — the version is the control that proves the manifest was re-read.
5. Whole-body `assert.equal` (pins row order, tally, trailer) PLUS a separate row-to-row equality with the plugin name normalized out.
6. Record assertions last, with the version equality commented as the control and the stale-cache failure mode named.

Note for `reconcile` specifically: its harness reads notifications off `ctx.ui.notify.mock.calls`, not off a `notifications[]` array, and its seeder is the one helper that needs widening. Do not port this file's harness idiom there.

## Self-Check: PASSED

- `tests/orchestrators/plugin/update.test.ts` — FOUND, contains `DFEN-08`
- Commit `63cc08d8` — FOUND in `git log`
- `git diff --name-only -- extensions/` — empty, as claimed
- Exactly one `no-expansion` and one `no-lifecycle-default-enabled-read` file under `tests/architecture/` — confirmed
