---
phase: 07-gate-integrity
plan: 11
subsystem: testing
tags: [architecture-gate, byte-pin, static-import, comment-hygiene, markers]

requires:
  - phase: 07-gate-integrity
    provides: "07-01's dynamic-`import()` pattern on the network gate, which stays in force independently of this plan's call-site change"
provides:
  - "`orchestrators/plugin/fetch.ts` reaches `resolveStrict` through a static import; the tree's only runtime dynamic import under `extensions/` is gone"
  - "One owner per shared-marker byte pin: `tests/shared/markers.test.ts` keeps both, the architecture snapshot keeps none"
  - "`tests/architecture/markers-snapshot.test.ts`'s header cites only files that resolve on disk"
  - "No comment in `orchestrators/plugin/info.ts` or `shared/markers.ts` describes surface that is not there"
affects: [07-15, gate-corpus, notification-vocabulary]

actuals:
  tokens: 32478
  tasks: 2
  commits: 2
  plan_head_before: f25c8b5fc6bb5e186a687645200feb2aea99b2d2
  commits_note: >-
    `git rev-list --count f25c8b5..HEAD` returns 20, not 2. This plan ran as one of
    six executors committing to the same branch in a shared working tree, so the
    ledger range contains every sibling's commits too. The two commits attributable
    to this plan are f9304d16 and 7883c16f; both are listed under Task Commits with
    their file lists.

tech-stack:
  added: []
  patterns:
    - "A byte pin lives in exactly one test: the production module's owner test when that test can express it, the architecture gate only when it cannot"
    - "An import form is settled by an observed `npm run check` result, not by argument about load cost"

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/orchestrators/plugin/fetch.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/info.ts
    - tests/architecture/markers-snapshot.test.ts
    - extensions/pi-claude-marketplace/shared/markers.ts

key-decisions:
  - "The static-import branch was taken: `npm run check` exited 0 with `resolveStrict` imported statically, so the dynamic form closes outright rather than acquiring a documented reason."
  - "`shared/markers.ts`'s three `drift-guarded by tests/architecture/markers-snapshot.test.ts` citations were repointed at `tests/shared/markers.test.ts` in the same commit that moved the pins, so the trim did not manufacture the stale-reference defect it was closing."
  - "The snapshot header states plainly where the surviving pins live rather than naming a vocabulary gate; no gate in the tree names the five superseded ES-5 literals by value."

patterns-established:
  - "Repointing a citation is part of moving a pin: when an assertion changes home, every comment naming its old home moves in the same commit"

requirements-completed: [GGAT-01, GGAT-04]

coverage:
  - id: D1
    description: "`fetch.ts` reaches `resolveStrict` through a static import, settled by a full gate run rather than by argument"
    requirement: GGAT-01
    verification:
      - kind: other
        ref: "npm run check (exit 0)"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/fetch.test.ts (159 pass / 0 fail with info.test.ts)"
        status: pass
      - kind: other
        ref: "npm run test:coverage:direct -- extensions/pi-claude-marketplace/orchestrators/plugin/fetch.ts (branches 78/78, functions 15/15, lines 571/571)"
        status: pass
      - kind: unit
        ref: "tests/architecture/no-orchestrator-network.test.ts (4 pass / 0 fail — fetch.ts still names zero git surface)"
        status: pass
    human_judgment: false
  - id: D2
    description: "The orphaned comment describing a removed test-only re-export is gone from `orchestrators/plugin/info.ts`"
    requirement: GGAT-01
    verification:
      - kind: other
        ref: "grep -c 'Test-only re-export' extensions/pi-claude-marketplace/orchestrators/plugin/info.ts == 0; tail -1 is `export const getPluginInfo = ...`"
        status: pass
      - kind: other
        ref: "npm run test:coverage:direct -- extensions/pi-claude-marketplace/orchestrators/plugin/info.ts (branches 314/314, functions 66/66, lines 2481/2481)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Each shared-marker byte pin has exactly one owner and the snapshot keeps only what the owner test does not carry"
    requirement: GGAT-04
    verification:
      - kind: unit
        ref: "tests/architecture/markers-snapshot.test.ts (4 pass / 0 fail) + tests/shared/markers.test.ts (6 pass / 0 fail combined)"
        status: pass
      - kind: other
        ref: "grep -c RECOVERY_PLUGIN_REINSTALL_PREFIX: snapshot 0, owner 2; grep -c STATE_LOCK_HELD_PREFIX: snapshot 0, owner 2"
        status: pass
      - kind: other
        ref: "npm run test:coverage:direct -- extensions/pi-claude-marketplace/shared/markers.ts (branches 1/1, lines 22/22)"
        status: pass
    human_judgment: false
  - id: D4
    description: "The snapshot gate's header cites no file that does not exist"
    requirement: GGAT-04
    verification:
      - kind: other
        ref: "grep -c no-legacy-markers tests/architecture/markers-snapshot.test.ts == 0; ls of all four cited paths resolves"
        status: pass
      - kind: unit
        ref: "node --test 'tests/architecture/*.test.ts' (372 pass / 0 fail) && npx eslint tests --max-warnings=0 (exit 0)"
        status: pass
    human_judgment: false

duration: 52 min
completed: 2026-09-10
status: complete
---

# Phase 07 Plan 11: Terminal Findings — Stale References in `fetch.ts`, `info.ts`, and the Markers Snapshot Summary

**The last runtime dynamic import under `extensions/` became a static import on a green `npm run check`, the two duplicated shared-marker byte pins collapsed to their owner test, and three comments that pointed at code or files that are not there now point at ones that are.**

## Performance

- **Duration:** 52 min
- **Started:** 2026-09-10T15:25:00Z
- **Completed:** 2026-09-10T16:17:30Z
- **Tasks:** 2
- **Files modified:** 4 (3 declared + 1 deviation)

## Accomplishments

- **`OPEFR-F007` closed outright, not documented.** `fetch.ts:483`'s `await import("../../domain/plugin-resolver.ts")` is now a static `import { resolveStrict } from "../../domain/plugin-resolver.ts"` in the existing `domain/` import group. `npm run check` exited 0. The finding asked for a cycle or load-cost reason for the dynamic form; the measured answer is that there is none, so the form went away instead of acquiring a sentence.
- **`SHC-F047` closed with one owner per pin.** `tests/shared/markers.test.ts` keeps the `RECOVERY_PLUGIN_REINSTALL_PREFIX` and `STATE_LOCK_HELD_PREFIX` byte pins. `tests/architecture/markers-snapshot.test.ts` dropped them and its `import * as markers`, retaining the three agents-bridge pins and the `locationsFor` state-lock-path case — 4 cases, all passing.
- **The dangling citation is gone.** The snapshot's header cited `tests/architecture/no-legacy-markers.test.ts`, which is not in the repository and never has been (see Issues Encountered). The replacement header describes what the gate asserts and names `tests/shared/markers.test.ts` as the pins' home.
- **The orphaned `info.ts` comment is deleted**, not restated in the past tense. The file ends at `export const getPluginInfo = createGetPluginInfo(NODE_PLUGIN_INFO_READER);`.

## Task Commits

1. **Task 1: Settle the fetch dynamic import by running the gate, and delete the orphaned comment** — `f9304d16` (refactor)
   - `extensions/pi-claude-marketplace/orchestrators/plugin/fetch.ts` (+1 −2)
   - `extensions/pi-claude-marketplace/orchestrators/plugin/info.ts` (−4)
2. **Task 2: Give each marker byte pin exactly one owner and repair the dangling citation** — `7883c16f` (test)
   - `tests/architecture/markers-snapshot.test.ts` (+7 −32)
   - `extensions/pi-claude-marketplace/shared/markers.ts` (+4 −4, deviation)

## The `npm run check` result for the static-import attempt

The plan's `OPEFR-F007` branch point required an observed run, not an argument. The static import was written first, then the full chain was run. **Result: exit 0. The static branch was taken.**

Verbatim from the run (`npm run check`, exit code 0):

```
> pi-claude-marketplace@0.18.1 check
> pi-claude-marketplace@0.18.1 typecheck
> tsc --noEmit
> pi-claude-marketplace@0.18.1 lint
> eslint extensions tests scripts eslint.config.js
> pi-claude-marketplace@0.18.1 fallow
> fallow dead-code --fail-on-issues --format human && fallow health --fail-on-issues --format human && fallow dupes --fail-on-issues --format human
✓ No issues found (0.66s)
■ Metrics: 279,737 LOC · dead files 0.0% · dead exports 0.0% · avg cyclomatic 1.7 · p90 cyclomatic 3 · maintainability 92.0 (good) · 1 churn hotspot (since 6 months) · duplication 1.1%
✗ 0 above threshold · 12658 analyzed · maintainability 92.0 (good) (0.10s)
✗ 879 lines (1.1%) duplicated across 38 files (0.11s)
> pi-claude-marketplace@0.18.1 format:check
> prettier --check "**/*.{js,json,ts}" "scripts/**/*.mjs"
Checking formatting...
All matched files use Prettier code style!
> pi-claude-marketplace@0.18.1 test:corresponding
> pi-claude-marketplace@0.18.1 test:corresponding:negative
> pi-claude-marketplace@0.18.1 test:coverage:direct:negative
> pi-claude-marketplace@0.18.1 test
ℹ fail 0
> pi-claude-marketplace@0.18.1 test:integration
ℹ fail 0
```

(The `✗` glyphs on the fallow `health` and `dupes` lines are those subcommands' own summary formatting for "0 above threshold" and the standing 1.1% duplication ratio; both subcommands exited 0, which is why the `&&` chain continued to `format:check`.)

A second full `npm run check` after Task 2 also exited 0 (`12704` units analyzed, same maintainability and duplication figures, `ℹ fail 0` on both suites).

**Why the static import was always the likely outcome, confirmed rather than assumed:** `domain/plugin-resolver.ts` imports only `shared/errors.ts`, `shared/path-safety.ts`, and eight `domain/` siblings — nothing under `orchestrators/`. There is no edge back, so no cycle for the dynamic form to have been hiding. `fetch.ts` already imported `domain/manifest.ts` and `domain/source.ts` statically, so the zone edge was in use before this change.

**Coverage did not move.** `npm run test:coverage:direct -- .../fetch.ts` reports `branches 78/78, functions 15/15, lines 571/571` — full, so no branch went out of reach with the `await import` removed.

**The network gate is unaffected.** `tests/architecture/no-orchestrator-network.test.ts` passes 4/4 after the change; `fetch.ts` still names zero git surface. As the plan's key-link states, 07-01's dynamic-`import()` pattern addresses the gate's blind spot rather than this call site, so removing the tree's only runtime dynamic import does not make that pattern redundant.

## Header citation resolution check

Every path named in `markers-snapshot.test.ts`'s new header was confirmed with `ls`:

| Cited path | Resolves |
|---|---|
| `extensions/pi-claude-marketplace/shared/markers.ts` | yes |
| `tests/shared/markers.test.ts` | yes |
| `extensions/pi-claude-marketplace/bridges/agents/marker.ts` (via the import) | yes |
| `extensions/pi-claude-marketplace/persistence/locations.ts` (via the import) | yes |

`grep -c "no-legacy-markers" tests/architecture/markers-snapshot.test.ts` returns `0`.

## Where the five superseded ES-5 literals are blocked today

The removed header claimed `tests/architecture/no-legacy-markers.test.ts` (D-13-12) blocks re-introduction. **That file does not exist and does not appear anywhere in this repository's git history:**

```
$ git log --all --oneline -- "*no-legacy-markers*"
(no output)
$ git log --all --diff-filter=A --oneline -- "tests/architecture/no-legacy-markers.test.ts"
(no output)
```

It is named as a planned artifact in `.planning/PROJECT.md:381,396,496` and in two archived v1.x roadmaps, but it was never written. The header was citing an intended gate as a live one.

Searching for the five literals themselves (`.planning/milestones/v1.3-ROADMAP.md:186` is the authority on their exact forms):

```
$ for lit in "pi-subagents is not loaded" "pi-mcp-adapter is not loaded" \
             "MANUAL RECOVERY REQUIRED" "rollback partial:" "Run /reload to"; do
    grep -rn -F "$lit" --include=*.ts extensions | wc -l
  done
pi-subagents is not loaded         extensions=0
pi-mcp-adapter is not loaded       extensions=0
MANUAL RECOVERY REQUIRED           extensions=0
rollback partial:                  extensions=0
Run /reload to                     extensions=1
```

The one `Run /reload to` hit is `shared/notification-summary.ts:576`, inside a comment quoting the **current** replacement trailer `Run /reload to pick up changes` — not the superseded parameterized `Run /reload to <verb> …` form. All five superseded literals are absent from the extension tree. Their surviving occurrences are in `docs/` (the style guide's §15 replacement table and the PRD's superseded §6.12), where they are the historical record, not emission sites.

**What actually blocks them today:** no gate names them by value. The control is structural and indirect:

- `shared/notification-types.ts` type-encodes the notification vocabulary as closed sets (`REASONS`, `STATUS_TOKENS`, `PLUGIN_STATUSES`, `MARKETPLACE_STATUSES`), and every row is composed from those members by `shared/notification-grammar.ts`.
- `tests/architecture/notify-closed-set-locks.test.ts` pins each set's exact length, so appending a member (which is what re-introducing a legacy marker as a reason or token would require) forces a conscious bump.
- `shared/notification-dispatch.ts` is the sole sanctioned `ctx.ui.notify` call site, enforced by the ESLint `no-restricted-syntax` selector and fallow's per-zone `calls.forbidden`, so a free-form legacy string cannot reach the user by bypassing the composer.
- `tests/architecture/catalog-uat/catalog-contract.test.ts` byte-compares rendered output against `docs/output-catalog.md`.

That is a real control, but it is a *class* control, not a per-literal one. The header now says plainly where the surviving pins live and makes no claim about a vocabulary gate, because the honest claim would be "these five strings are unreachable through the composer," which is a different assertion from "a gate pins them." **Recorded for the backlog, not papered over:** if a per-literal guard is wanted, it does not exist and would have to be written.

## Files Created/Modified

- `extensions/pi-claude-marketplace/orchestrators/plugin/fetch.ts` — `resolveStrict` now arrives via a static `domain/plugin-resolver.ts` import at line 30, alphabetized between `domain/manifest.ts` and `domain/source.ts`; the `await import(...)` line inside `reasonedRow` is gone. `reasonedRow`'s doc block is unchanged: it described *what* the function re-resolves and said nothing about the import form, and with the form now static there is no gap left for it to close.
- `extensions/pi-claude-marketplace/orchestrators/plugin/info.ts` — the trailing three-line comment describing a test-only re-export of the shared classifier is deleted. The file ends at its last statement.
- `tests/architecture/markers-snapshot.test.ts` — header replaced; `import * as markers` and the two duplicated byte-pin cases removed; the three agents-bridge pins and the `locationsFor` case retained. 49 lines, 4 cases.
- `extensions/pi-claude-marketplace/shared/markers.ts` — **deviation**, see below.

## Exports added or removed (for 07-15's census attribution)

**None.** This plan added no `export` and removed none.

For completeness, the two consumer-side changes that touch export *reachability* without changing any export:

| File | Line | Change | Effect on the census |
|---|---|---|---|
| `tests/architecture/markers-snapshot.test.ts` | 11 (removed) | `import * as markers from ".../shared/markers.ts"` deleted | `RECOVERY_PLUGIN_REINSTALL_PREFIX` and `STATE_LOCK_HELD_PREFIX` lose one test consumer; both remain consumed by `tests/shared/markers.test.ts:5-7` and by production (`orchestrators/plugin/update-swap.ts`, the transaction layer). `fallow dead-code` reports `✓ No issues found`. |
| `extensions/pi-claude-marketplace/orchestrators/plugin/fetch.ts` | 30 (added) | `import { resolveStrict } from "../../domain/plugin-resolver.ts"` | `resolveStrict` gains a *static* consumer where it had a dynamic one. Fallow's graph now sees the edge it could not see before; this is the one measurable change to the import graph this plan makes, and it makes `resolveStrict` more clearly owned, not less. |

If 07-15's pinned census differs from its Wave 1 baseline in either of those two directions, this plan is the attribution.

## Decisions Made

1. **Static, not documented-dynamic.** The plan's fallback branch (keep the dynamic form, add a rationale sentence naming the observed failure) was never reached because nothing failed. Recording "we kept it dynamic because reasons" when the gate is green would have been the finding restated, which is what `07-CONTEXT.md`'s ruling was written to prevent.
2. **The snapshot header names the pins' home rather than a vocabulary gate.** The plan allowed either citing the real gate or stating plainly that the owner test's pins are the control. Since no gate names the five literals by value, naming one would have replaced a dangling citation with an overclaiming one — the same defect wearing a different file path.
3. **The agents-bridge pins stay, per the `07-CONTEXT.md` ruling and the plan's 4-case acceptance criterion** — but see Issues Encountered for a measured fact the ruling did not have.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `shared/markers.ts`'s three drift-guard citations became false the moment the pins moved**

- **Found during:** Task 2 (giving each byte pin one owner)
- **Issue:** `extensions/pi-claude-marketplace/shared/markers.ts` said "drift-guarded by `tests/architecture/markers-snapshot.test.ts`" in three places — the file header at `:6-7` and both export doc blocks at `:13` and `:22`. Removing the pins from that snapshot would have made all three untrue: a stale reference reporting a control that is no longer where it says it is. That is criterion 4's exact failure class, and this plan would have *created* it while closing three others.
- **Fix:** repointed all three citations at `tests/shared/markers.test.ts`, which is where the pins now live. Present-tense fact about the current tree; no narration of the move, per `.claude/rules/typescript-comments.md`.
- **Files modified:** `extensions/pi-claude-marketplace/shared/markers.ts` (+4 −4)
- **Why this was outside `files_modified`:** the plan's declared set did not anticipate that the pin move would strand comments in the production module. No sibling plan in this wave declares `shared/markers.ts` (checked across all 16 `07-*-PLAN.md` frontmatter blocks), so there was no ownership collision.
- **Verification:** `node --test tests/shared/markers.test.ts tests/architecture/markers-snapshot.test.ts` → 6 pass / 0 fail; `npm run test:coverage:direct -- extensions/pi-claude-marketplace/shared/markers.ts` → exit 0 (branches 1/1, lines 22/22); `npm run check` → exit 0.
- **Committed in:** `7883c16f` (same commit as the pin move, so the citation is never stale in any commit)

---

**Total deviations:** 1 auto-fixed (1 × Rule 1 — a bug this plan's own change would otherwise have introduced).
**Impact on plan:** the edit is four words across three comments in one file, entirely inside the plan's stated purpose ("no comment survives the code it described"). No scope creep; no behavior change.

## Issues Encountered

**1. The agents-bridge pins retained here are also pinned by their own owner test.**

The `07-CONTEXT.md` ruling retains `markers-snapshot.test.ts:34-44` on the grounds that those constants "come from a different module" than the owner test being consulted (`tests/shared/markers.test.ts`), and the plan's acceptance criterion requires 4 surviving cases. Both were honored. But `bridges/agents/marker.ts` has its own owner test, and it already pins all three constants byte-for-byte:

```
$ grep -n "expectedPrefix\|expectedMarker" tests/bridges/agents/marker.test.ts
16:  const expectedPrefix = "pi-claude-marketplace-";
27:  const expectedMarker = "generatedBy: pi-claude-marketplace";
38:  const expectedMarker = "generated by pi-claude-marketplace";
```

So the three surviving snapshot cases are the *same* duplication class `SHC-F047` describes, one module over — the ruling closed the shared/markers instance without the measurement that the agents instance exists. This was **not** acted on: the plan's acceptance criterion is explicit about 4 cases, and unilaterally dropping three user-contract pins during a parallel wave is a decision for the operator, not the executor. It is recorded here so a later plan (or 07-15's disposition pass) can settle it with the measurement in hand rather than rediscovering it.

Note that the byte values are not at risk either way — `T-07-30`'s concern is that a pin be lost from *both* homes, and here there are demonstrably two.

**2. Shared-tree sibling noise on `pre-commit`, resolved by retry.**

Five sibling executors were committing to `features/refine-unit-tests` concurrently. The `npm-typecheck`, `npm-lint`, and `npm-format-check` hooks are `pass_filenames: false` and scan the whole repository, so they intermittently failed on files this plan does not own:

- `tests/orchestrators/plugin/reinstall-{flow,replace}.test.ts` — `error TS2554: Expected 2 arguments, but got 1` (plan 07-10 mid-edit)
- `tests/bridges/hooks/dispatch.test.ts` — `error TS2352` (plan 07-09 mid-edit)
- `domain/components/hook-events.ts` — `fallow dead-code` unused-type on `_BucketAEventsCoverageProof` before its consumer landed (plan 07-08 mid-edit)
- repeated bare `files were modified by this hook` on `npm-lint` / `npm-format-check` / `npm-typecheck` with no accompanying error text — mtime drift from siblings writing during the hook run

None named a file this plan owns; none was edited or worked around. Both task commits were made only after a run in which the owned files passed `prettier --check` and `eslint --max-warnings=0` cleanly and a whole-repo `pre-commit run --files <owned>` came back with no `Failed` line. The authoritative evidence is the two full `npm run check` runs, both exit 0.

**3. A stale test title observed but not touched.**

`tests/orchestrators/plugin/install-flow.test.ts:2765,2810` are titled "...success message includes 'pi-subagents is not loaded'" / "'pi-mcp-adapter is not loaded'" — the superseded ES-5 wording. The assertion bodies correctly match `/\{requires pi-subagents\}/` and the `{requires pi-mcp}` equivalent, so the tests are right and only their titles are stale. That file belongs to plan 07-14 in this wave; left alone and recorded here.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- `OPEFR-F007` and `SHC-F047` are closed with recorded current evidence; the `info.ts` orphan (`OPIB-F07`'s neighbor, called out in `07-PATTERNS.md:283` as the tree's worked example of the defect) is deleted.
- **For 07-15:** this plan adds and removes zero exports. The two import-graph edges it changes are tabulated above.
- **For 07-07:** `07-PATTERNS.md:275-283` cites `orchestrators/plugin/info.ts:2483-2485` as the in-tree example of an orphaned explanation left behind a removed body. That example no longer exists — the file is now 2481 lines. The pattern's guidance stands; only its illustration is gone.
- **Open, deliberately unclosed:** the agents-bridge pin duplication (Issues #1) and the absence of any per-literal guard on the five superseded ES-5 strings (see the search above). Both are recorded for disposition, not silently absorbed.

---
*Phase: 07-gate-integrity*
*Completed: 2026-09-10*
