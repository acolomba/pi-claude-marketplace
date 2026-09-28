---
phase: 114-degradation-and-documentation
plan: 01
subsystem: notify
tags: [soft-dep, closed-set, workflows, severity, probe]
status: complete

requires:
  - "extensions/pi-claude-marketplace/platform/pi-api.ts::softDepStatus"
  - "extensions/pi-claude-marketplace/shared/notify.ts::REASONS"
  - "extensions/pi-claude-marketplace/orchestrators/plugin/install.ts::stagedWorkflowNames"
provides:
  - "platform/pi-api.ts::hasLoadedWorkflowEngine"
  - "platform/pi-api.ts::SoftDepStatus.workflowEngineLoaded"
  - "shared/concerns/soft-dep.ts::Dependency member \"workflows\""
  - "shared/concerns/soft-dep.ts::softDepMarkers 3rd declares-flag"
  - "shared/notify.ts::REASONS[44] = \"requires pi-dynamic-workflows\""
  - "shared/notify.ts::composeReasons 4th declares-flag"
  - "shared/notify-reasons.ts::companionSeverity third disjunct"
  - "orchestrators/types.ts::declaresWorkflows (3 outcome shapes)"
  - "orchestrators/plugin/shared.ts::LedgerDegradationSignals.stagedWorkflows"
affects:
  - "docs/output-catalog.md (two states, plan 04)"
  - "orchestrators/plugin/shared.ts::enableRowDependencies (plan 02)"
  - "orchestrators/plugin/update-row.ts::outcomeDependencies (plan 02)"

tech-stack:
  added: []
  patterns:
    - "required-positional-parameter forcing (compile errors as the coverage proof)"
    - "closed-set tail append with an amendment ledger comment"

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/platform/pi-api.ts
    - extensions/pi-claude-marketplace/shared/concerns/soft-dep.ts
    - extensions/pi-claude-marketplace/shared/notify.ts
    - extensions/pi-claude-marketplace/shared/notify-reasons.ts
    - extensions/pi-claude-marketplace/orchestrators/types.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/shared.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/install.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/update.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts
    - extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts
    - extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts
    - extensions/pi-claude-marketplace/orchestrators/marketplace/update.messaging.ts
    - extensions/pi-claude-marketplace/orchestrators/import/execute.messaging.ts
    - extensions/pi-claude-marketplace/orchestrators/reconcile/reconcile.messaging.ts
    - tests/edge/notification-boundary.ts

decisions:
  - "The `getAllTools()` read count per soft-dependency probe moved from two to three, so every mocked probe arity and the prose stating the ratio moved with it (52 test files)."
  - "`marketplace/update.messaging.ts`'s `updated` render is a SIXTH `dependencies` -> declares-flags translation site, not one of the five the plan enumerated. It derives the workflows flag like the other five."
  - "`stagedWorkflows` is EXCLUDED from the install outcome's `LedgerDegradationSignals` intersection and pinned `?: never` on the update `updated` arm, mirroring `stagedAgents` / `stagedMcpServers`: both verbs spell the fact as the required `declaresWorkflows` predicate and must not advertise a second spelling nothing writes."
  - "The four `hasLoadedWorkflowEngine` probe cases moved from task 3 into task 1: `fallow dead-code` reports an exported symbol with no consumer, and pre-commit runs `npm-fallow` on every commit, so task 1 could not be committed without them."

metrics:
  duration: "~2h40m"
  completed: 2026-09-08

actuals:
  tokens: 60000
  tasks: 3
  commits: 3

plan_head_before: 56ac5e7cf04fc4a10b0a32f7e284b92da7a76548
---

# Phase 114 Plan 01: The host workflow engine as a third soft dependency — Summary

The host workflow engine is now probed by the tool name only it registers, and
that verdict reaches the operator through the existing marker chain: probe →
`Dependency` → `softDepMarkers` → `composeReasons` → the rendered install row,
with the severity raise on top.

## What was built

**The probe (WDEP-01).** `hasLoadedWorkflowEngine(pi)` returns true iff
`pi.getAllTools()` contains a tool named exactly `workflow_control`, compared by
`===` with no case folding, no substring match and no `sourceInfo` fallback arm.
Its `catch` body is exactly `return false;`. `SoftDepStatus` gains a third
REQUIRED `workflowEngineLoaded` field and `softDepStatus` composes it with no
branching.

**The marker (WDEP-04).** `Dependency` is a three-member literal union; no
runtime `DEPENDENCIES` tuple was reintroduced. `SOFT_DEP_MARKER_WORKFLOWS` is
module-private, typed `Reason`, valued `requires pi-dynamic-workflows`, and its
doc comment records why the short unscoped spelling would name a different
package. `softDepMarkers` takes a third REQUIRED positional boolean before
`probe` and appends the new marker LAST.

**The token.** `REASONS` grew to 45 with the new literal at the TAIL, after
`stale workflow command`. `UnsupportedReason` gained it in the same commit —
`_ReasonsCoverageProof` is a TS2344 without it. `composeReasons` takes a fourth
REQUIRED positional boolean before `probe`.

**The install row (WDEP-02 / WDEP-03).** `composeInstalledRow` derives
`declaresWorkflows` from `installCtx.stagedWorkflowNames.length > 0` and pushes
`"workflows"` after the `mcp` arm.

**The severity raise (SEV-01).** `companionSeverity` takes a third REQUIRED
destructured boolean and returns `warning` on a third disjunct. Install, update
and enable pass it; reinstall keeps its no-raise asymmetry.

**The outcome vocabulary.** `declaresWorkflows` is REQUIRED on the reinstalled
arm, `PluginUpdateBase` and `InstallPluginOutcome`'s `installed` arm.
`LedgerDegradationSignals` gained an optional `stagedWorkflows`, wired through
the same conditional-spread idiom its siblings use.

## The forced sweep (the coverage evidence)

**`npm run typecheck` reported 89 errors on the first compile attempt** after the
required field and the required parameter landed, across 16 files. Working that
list to zero is what visited every call site; a defaulted parameter would have
compiled at all of them and visited none.

The list under-counted the real blast radius, because the sweep it names is only
the type-level half. The runtime half surfaced only on `npm test`: **629 failing
tests**, from a single cause. Each soft-dependency probe now reads
`pi.getAllTools()` three times instead of twice, and this repo pins that arity
with `strong-mock` in 52 test files — 299 `createNotificationBoundary(emissions,
toolProbes)` call sites plus 13 standalone `when(() => pi.getAllTools())`
expectations and four derived counts. Every `2` became `3`, every `4` became
`6`, and the prose stating the ratio (`tests/edge/notification-boundary.ts`
plus nine edge-handler headers naming "TWICE" / "FOUR times") moved with it.

That sweep is not a defect; it is the IL-2 sizing proof doing its job. It is
recorded here because it is roughly four times the size the plan's step 6
anticipated, and a later probe addition will pay the same price.

## The zero-byte verification (D-114-04, mandatory)

Run immediately after the probe field landed and **before any fixture edit**, with
no change to `docs/output-catalog.md` or to any `catalog-uat.test.ts` fixture:

```
$ node --test tests/architecture/catalog-uat.test.ts
✔ catalog UAT: every <!-- catalog-state: --> annotation pairs byte-equal with notify()
✔ catalog UAT inverse walk: every FIXTURES (section,state) has a matching catalog annotation
ℹ tests 6
ℹ pass 6
ℹ fail 0
```

**Confirmed: the third probe field moved zero catalog bytes.** RESEARCH assumption
A1 holds empirically. `git diff <base>..HEAD -- docs/` is empty for this plan.
`piWithBothLoaded` was NOT renamed here — plan 04 owns it.

## Deviations from Plan

### Auto-fixed issues

**1. [Rule 1 - Bug] `marketplace/update.messaging.ts` is a sixth declares-flag
translation site**

- **Found during:** Task 1
- **Issue:** The plan and RESEARCH both enumerate exactly FIVE `composeReasons`
  call sites that translate a `dependencies` array into declares-flags, all five
  in `shared/notify.ts`. `orchestrators/marketplace/update.messaging.ts:77` does
  the same thing (`p.dependencies.includes("agents")` / `("mcp")`) and is counted
  in the "other 14 pass literal `false`" bucket, which is wrong.
- **Fix:** Gave it `p.dependencies.includes("workflows")` like the other five.
  Passing literal `false` there would have made the autoupdate cascade's
  `(updated)` row the one surface that silently drops the marker.
- **Files modified:** `extensions/pi-claude-marketplace/orchestrators/marketplace/update.messaging.ts`
- **Commit:** b3d9b8e0

**2. [Rule 3 - Blocking] The four probe cases moved from Task 3 into Task 1**

- **Found during:** Task 1, at the pre-commit gate
- **Issue:** `fallow dead-code` reports `hasLoadedWorkflowEngine` as an unused
  export while nothing imports it (`softDepStatus` calls it in-file). The
  project's `.pre-commit-config.yaml` runs `npm-fallow` with `always_run: true`,
  so Task 1 could not be committed with the probe untested.
- **Fix:** Wrote the four `hasLoadedWorkflowEngine` cases — which Task 1's own
  `<behavior>` block already specifies as its red start — in Task 1. Task 3 then
  added the `softDepStatus` composition case, the union pin, the marker
  truth-table axis, the exact-array order row and the severity axis.
- **Files modified:** `tests/platform/pi-api.test.ts`
- **Commit:** b3d9b8e0

**3. [Rule 2 - Missing critical] `stagedWorkflows` excluded from the install
outcome and pinned `never` on the update arm**

- **Found during:** Task 2
- **Issue:** `InstallPluginOutcome`'s `installed` arm intersects
  `Omit<LedgerDegradationSignals, "stagedAgents" | "stagedMcpServers">`. Adding
  `stagedWorkflows` to the shared shape silently widened that arm with a field
  `installPlugin` never writes — exactly the hazard the arm's own WR-11 comment
  names, and `compat-01-no-expansion.test.ts` caught it. The
  `PluginUpdateUpdatedOutcome` arm has the same duplicate-spelling problem.
- **Fix:** Added `"stagedWorkflows"` to the install arm's exclusion list and
  `readonly stagedWorkflows?: never;` beside the two existing pins on the update
  arm. Both verbs spell the fact as the required `declaresWorkflows` predicate.
- **Files modified:** `extensions/pi-claude-marketplace/orchestrators/types.ts`
- **Commit:** eb131857

**4. [Rule 3 - Blocking] Two update-suite cases were using severity as a
discriminator that the raise invalidated**

- **Found during:** Task 2
- **Issue:** `WLIF-02: a workflow version B cannot admit reaches the standalone
  diagnostic channel` selects the diagnostic with
  `notifications.filter(n => n.severity === "warning")`, and `WLIF-06: an update
  that re-placed every recorded workflow stamps nothing` asserts
  `row.severity === undefined`. Both fixtures stage workflows into a session with
  an empty tool list, so both now see the engine-absent raise.
- **Fix:** Gave both fakes `getAllTools: () => [{ name: "workflow_control" }]`,
  which restores each case's original claim exactly rather than refitting the
  expected value until it went green.
- **Files modified:** `tests/orchestrators/plugin/update.test.ts`
- **Commit:** eb131857

### Notes on the `SoftDepStatus` literal sweep

The plan's step 6 says to default the new field to `true` (engine loaded)
wherever the case says nothing about workflows. Three sites where `false` was
correct instead, and the reason was not obvious:

- **`tests/platform/pi-api.test.ts`'s `softDepStatus` cases.** These are
  assertions ABOUT the composed snapshot, not inputs to a renderer, so the value
  has to match the case's tool list. All but one read `false`; the "every
  dependency as loaded" case gained `{ name: "workflow_control" }` to its list.
- **`tests/shared/notify-context.test.ts` (9 sites).** Same reason: the probe
  literals there are `deepStrictEqual` expectations against the snapshot the
  fixture's `getAllTools: () => []` actually produces. `true` made all nine red.
- **`tests/shared/notify.test.ts`'s `neitherLoadedProbe`.** Renamed to
  `noneLoadedProbe` (and `bothLoadedProbe` to `allLoadedProbe`, 14 call sites in
  one file) rather than left with a name that counts to two over three fields.
  These are file-private helpers, unrelated to the `piWithBothLoaded` rename
  plan 04 owns.

## Known Stubs

| Site | Issue | Resolution |
|---|---|---|
| `orchestrators/plugin/shared.ts::enableRowDependencies` | An `enable` that staged a workflow into a session with no host engine now stamps `warning` but renders NO `{requires pi-dynamic-workflows}` marker — the derivation still pushes only `agents` and `mcp`. | Plan 02 owns this derivation site. |
| `orchestrators/plugin/update-row.ts::outcomeDependencies` | Same gap on the `(updated)` row. | Plan 02 owns this derivation site. |

This is the plan's own task split: Task 2 lands the severity raise on install,
update and enable, while the marker lands only on install (`composeInstalledRow`)
because the other six `Dependency[]` derivation sites are plan 02's, along with
the coverage gate that proves them. Until plan 02 lands, an enable or update row
can carry the `needs attention` summary line with nothing in the brace naming
why. `tests/orchestrators/plugin/enable-disable.test.ts`'s
`WLIF-06: a name in both the recorded and the staged set retires nothing` case
currently pins those exact bytes and will need its expected message changed again
when plan 02 adds the marker.

Recorded in the cross-phase ledger:

```
gsd-tools windows append --kind deviation --phase 114 \
  --file extensions/pi-claude-marketplace/orchestrators/plugin/shared.ts --line 125 \
  --description "[workflows-replay] enable and update rows raise severity ... but render no marker"
```

## Verification

| Gate | Result |
|---|---|
| `npm run typecheck` | 0 errors (89 on the first compile attempt) |
| `node --test tests/architecture/catalog-uat.test.ts` | `# fail 0`, zero fixture edits |
| `node --test tests/architecture/notify-closed-set-locks.test.ts tests/architecture/compat-01-no-expansion.test.ts` | `# fail 0` at 45 members |
| `node --test tests/orchestrators/plugin/install.test.ts` | `# fail 0`, 151 tests, WDEP-02 case present |
| `node --test tests/platform/pi-api.test.ts tests/shared/concerns/soft-dep.test.ts tests/shared/notify-reasons.test.ts` | `# fail 0`, 94 tests |
| `node scripts/test-coverage-direct.mjs .../platform/pi-api.ts` | 100% lines / branches / functions (15/15 branches) |
| `grep -c 'requires pi-dynamic-workflows'` on the three named files | 3 / 2 / 2 — none zero |
| `grep -rn 'requires pi-workflows' extensions/ tests/` | no match |
| `git diff HEAD --name-only -- package.json package-lock.json` | empty |
| `grep -rn 'Parameters<typeof composeReasons>\[3\]' tests/` | no match (now `[4]`) |
| `npm run lint` / `npm run fallow` | clean; no `no-identical-functions`, no health breach |
| `npm run check` | exit 0 (5537 unit + 34 integration tests, 0 failures) |

Two acceptance criteria read differently than written, both benignly:

- `grep -c 'DEPENDENCIES' .../soft-dep.ts` prints **1**, not `0`. The single
  match is the pre-existing module-header sentence explaining why the union
  replaced the tuple, which the plan's own action step directs to leave
  byte-untouched. No `DEPENDENCIES` identifier exists.
- `grep -c 'declaresWorkflows' orchestrators/types.ts` prints **8**, not `3`.
  Three are the declarations (`grep -c 'readonly declaresWorkflows: boolean;'`
  is exactly 3); the other five are doc-comment mentions in the enumerations
  that already named the two siblings.

## Self-Check: PASSED

- `extensions/pi-claude-marketplace/platform/pi-api.ts` — FOUND, exports
  `hasLoadedWorkflowEngine`, `sourceInfo` count unchanged at 3
- `extensions/pi-claude-marketplace/shared/concerns/soft-dep.ts` — FOUND
- `extensions/pi-claude-marketplace/shared/notify.ts` — FOUND, `REASONS.length`
  is 45 with the new literal last
- `extensions/pi-claude-marketplace/orchestrators/types.ts` — FOUND, three
  required declarations, no `?:`
- `extensions/pi-claude-marketplace/orchestrators/plugin/shared.ts` — FOUND,
  `enableRowDependencies` body byte-unchanged
- `tests/platform/pi-api.test.ts` — FOUND, 7 `workflow_control` occurrences
- `tests/shared/concerns/soft-dep.test.ts` — FOUND, union pin + exact-array
  order row
- Commit `b3d9b8e0` — FOUND
- Commit `eb131857` — FOUND
- Commit `63a4ed8b` — FOUND
- `orchestrators/plugin/info.ts` — NOT in any commit's diff, as required
- `orchestrators/plugin/reinstall.messaging.ts` — NOT in any commit's diff, as
  required
