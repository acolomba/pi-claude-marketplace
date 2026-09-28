---
phase: 105-workflow-degradation-and-documentation
plan: 02
subsystem: ui
tags: [notify, soft-dependency, workflows, pi-dynamic-workflows, architecture-gate]

# Dependency graph
requires:
  - phase: 105-workflow-degradation-and-documentation
    plan: 01
    provides: the probe, the `DEPENDENCIES` member, the marker, the reason token, and six of the seven `Dependency[]` derivations
provides:
  - "a stamp-coverage gate over the dep-bearing derivation set — reverting any ONE of the seven reddens exactly one case"
  - "`__test_` seams on the six file-private `Dependency[]` derivations, so each is reachable from a test that asserts the marker it produces"
  - "`installRowDependencies` — the install derivation named rather than inline, the seventh member of the set"
  - "behavioural coverage for the list, enable, import-cascade and reconcile-projection rows"
  - "a type-level assertion that the update and reinstall outcome shapes are still refused by `enableRowDependencies`"
affects: [workflows-compatibility docs, milestone close]

actuals:
  tokens: 11000
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "A derivation that returns a valid value either way needs a GATE, not a grep — the compiler cannot enumerate the sweep"
    - "A coverage gate drives each surface's OWN derivation; one shared renderer call hides exactly the omission it exists to catch"
    - "A non-stamp assertion pairs with a control row rendered by the same code under the same probe, or it passes for the wrong reason"
    - "A structural refusal is asserted by a type-level conditional, not by `@ts-expect-error` — the directive can be consumed by an unrelated error"

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/orchestrators/plugin/install.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/list.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/shared.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/update-row.ts
    - extensions/pi-claude-marketplace/orchestrators/import/execute.ts
    - extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts
    - extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts
    - tests/architecture/notify-stamp-coverage.test.ts
    - tests/orchestrators/plugin/list.test.ts
    - tests/orchestrators/plugin/enable-disable.test.ts
    - tests/orchestrators/import/execute.test.ts
    - tests/orchestrators/reconcile/notify.test.ts

key-decisions:
  - "The install derivation was NAMED rather than left inline: a gate that cannot reach a derivation cannot pin it, and install was the one member of the seven with no callable seam"
  - "The refusal test is a type-level conditional, not `@ts-expect-error` — the first draft passed with the `partition` refusal REMOVED, because the directive was consuming TypeScript's weak-type check instead"
  - "Each gate case drives its own derivation and composes the brace through the renderer's own `composeReasons`, so a case cannot pass on a sibling marker"
  - "The three structural non-stamps are asserted beside a control row from the same render path, so a bare row is evidence rather than a fixture accident"

patterns-established:
  - "A `__test_` seam on a file-private derivation is the cost of making the derivation set gateable; the alternative is a grep, which is what failed"
  - "Prove a gate by reverting each thing it claims to cover, one at a time, and recording the diagnostic"

requirements-completed: [WDEP-02, WDEP-04]

coverage:
  - id: D1
    description: "Every dep-bearing surface — install, update, reinstall, enable, the list inventory row, the import cascade row and both reconcile projections — can produce the host-engine marker; reverting any one derivation reddens the gate"
    requirement: WDEP-04
    verification:
      - kind: unit
        ref: "tests/architecture/notify-stamp-coverage.test.ts#WDEP-04/SNM-06: every dep-bearing surface can produce the host-engine marker"
        status: pass
      - kind: manual
        ref: "each of the seven derivations reverted in turn; the gate went red on exactly one case each time, then was restored"
        status: pass
    human_judgment: false
  - id: D2
    description: "The three structural non-stamps — the uninstalled row, the disabled row and the marketplace-update failed child row — carry no marker over a subject that WOULD stamp"
    requirement: WDEP-04
    verification:
      - kind: unit
        ref: "tests/architecture/notify-stamp-coverage.test.ts#MSG-SD-3: the uninstalled and disabled rows carry no marker beside a control row that does"
        status: pass
      - kind: unit
        ref: "tests/architecture/notify-stamp-coverage.test.ts#MSG-SD-3: the marketplace-update failed child row carries no marker beside its own updated row"
        status: pass
    human_judgment: false
  - id: D3
    description: "The list inventory row declares the host engine from the persisted record, below the disabled early return; a disabled record retaining a workflow renders the same bare row"
    requirement: WDEP-02
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/list.test.ts#WDEP-04: an installed record naming a workflow renders the host-engine marker on its list row"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/list.test.ts#WDEP-04: the list row joins agents and workflows in DEPENDENCIES order"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/list.test.ts#WDEP-04: a disabled record retaining a workflow renders the same bare row"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/list.test.ts#WDEP-04: an installed record naming no workflow renders the bare installed row"
        status: pass
    human_judgment: false
  - id: D4
    description: "The import cascade row and both reconcile projection rows render the marker; the enable derivation's refusal of the update and reinstall outcome shapes survived the widening"
    requirement: WDEP-04
    verification:
      - kind: unit
        ref: "tests/orchestrators/import/execute.test.ts#WDEP-04: importClaudeSettings propagates declaresWorkflows onto the outcome and the cascade row"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/reconcile/notify.test.ts#WDEP-04: a reconcile enable that staged a workflow projects a row declaring the workflows dependency"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/reconcile/notify.test.ts#WDEP-04: the install projection carries the workflows dependency through to its row"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/enable-disable.test.ts#WR-01: the update and reinstall outcome shapes still fail to satisfy the enable derivation"
        status: pass
    human_judgment: false

duration: 45min
completed: 2026-08-15
status: complete
---

# Phase 105 Plan 02: Workflow degradation and documentation Summary

**Every surface that can render a soft-dependency marker now renders the host-engine one, and a gate — not a grep — is what says so: reverting any one of the seven `Dependency[]` derivations turns exactly one case red.**

## Performance

- **Duration:** 45 min
- **Started:** 2026-08-15T22:00-04:00
- **Completed:** 2026-08-15T22:41:44-04:00
- **Tasks:** 3
- **Files modified:** 13

## Accomplishments

- The stamp-coverage gate covers eight dep-bearing surfaces, each driven through **its own** derivation rather than one shared renderer call — because a derivation that dropped an arm is exactly what a shared call would hide. Each case then composes its brace through the renderer's own `composeReasons` under a probe reporting the two older companions loaded and the host engine absent, so the expected brace is the host-engine marker alone and no case can pass on a sibling marker.
- The gate was **proved, not asserted**: all seven derivations were reverted one at a time and each turned exactly one case red, with a diagnostic naming the surface (`list (inventory row): its Dependency[] derivation dropped the workflows arm -- the row renders no host-engine marker`). Each revert was undone and the tree verified back to seven intact pushes.
- The mirror clause pins the three structural non-stamps beside a **control row rendered by the same code under the same probe**. The uninstalled and disabled rows sit in one cascade next to an `installed` row declaring `["workflows"]`; the marketplace-update failed child row is rendered by the same `UPDATE_CONTEXT.render` map as its `updated` sibling. A bare row is therefore evidence, not a fixture that had nothing to declare.
- The list inventory row's behaviour is now pinned in both directions, including a **disabled record that retains a workflow** — asserted against the array that actually reached `state.json`, so the suppression cannot be a seeder that quietly emptied it.
- The `enableRowDependencies` refusal is asserted at the type level and verified to redden: renaming `partition?: never` produces `error TS2322: Type 'true' is not assignable to type 'false'`.

## Task Commits

1. **Task 1: The cascade rows render the third marker** — `e6b3aef8` (test)
2. **Task 2: The list inventory row and the enable row derive it from their own signals** — `fbd41e5c` (test)
3. **Task 3: A gate proves every dep-bearing surface can produce the marker** — `f6241d36` (test)

## Files Created/Modified

- `orchestrators/plugin/install.ts` — the inline install derivation extracted into a named `installRowDependencies` with a `__test_` seam (the seventh member of the set, and the one that previously had no callable entry point)
- `orchestrators/plugin/{list,reinstall,update-row}.ts`, `orchestrators/import/execute.ts`, `orchestrators/reconcile/apply.ts` — `__test_` seams on their file-private derivations
- `orchestrators/plugin/list.ts` — the ENBL-15 rationale now names all three retained inventories
- `orchestrators/plugin/shared.ts` — the WR-01 doc comment now says the refusal guards three optional fields, and why widening the pick widened the hole rather than closing it
- `orchestrators/marketplace/update.ts` — the failed-child-row rationale names the third declares-flag
- `tests/architecture/notify-stamp-coverage.test.ts` — the coverage clause and the mirror clause
- `tests/orchestrators/plugin/list.test.ts` — the seeder now honours a `workflows` inventory override its option type already declared; four WDEP-04 cases
- `tests/orchestrators/plugin/enable-disable.test.ts` — the WR-01 type-level refusal assertion
- `tests/orchestrators/import/execute.test.ts` — a `workflowEngineLoaded` probe option (default loaded, so no existing case moved) and three WDEP-04 cases
- `tests/orchestrators/reconcile/notify.test.ts` — four WDEP-04 projection cases

## Decisions Made

- **The install derivation was named rather than left inline.** A gate that cannot reach a derivation cannot pin it, and the install row's array was built inline inside a 700-line ledger body. Extracting it makes install the seventh callable member of the set and removes the last copy that only a full end-to-end install could exercise. The extracted function is byte-equivalent: same order, same three conditions.
- **The refusal test is a type-level conditional, not `@ts-expect-error`.** The first draft used a directive on an object literal and passed — *including with the `partition?: never` refusal removed*. The directive was being consumed by TypeScript's **weak-type check** (a target whose properties are all optional rejects a source with no properties in common), not by the refusal under test. Real update and reinstall outcomes pin `stagedAgents` / `stagedMcpServers` / `stagedWorkflows` to `never`, so they *do* share members and the weak-type check never fires for them — the fixture was not the hazard. Replaced with `type Refuses<T> = T extends EnableDepsParam ? false : true` over the real exported outcome types, then verified by renaming the refusal field and watching `tsc` reject the initializer.
- **The gate's surface list is documented as OPEN, not closed.** The clause's comment says so explicitly: if a ninth derivation appears, add it. The plan's own flagged assumption A4 is that the set came from a search rather than a proof, and a gate that presents a searched list as exhaustive re-tells the same lie one layer up.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] The first refusal test passed with the refusal removed**

- **Found during:** Task 2
- **Issue:** `@ts-expect-error` on `enableRowDependencies(updateShaped)` suppressed TypeScript's weak-type check, not the `partition?: never` refusal. Renaming the refusal field left `tsc` green, so the test asserted nothing about WR-01.
- **Fix:** Replaced with a type-level conditional over the real `PluginUpdateUpdatedOutcome` and `ReinstallReinstalledOutcome`, which share members with the parameter and so reach the refusal.
- **Files modified:** `tests/orchestrators/plugin/enable-disable.test.ts`
- **Verification:** renaming `partition?: never` yields `tests/orchestrators/plugin/enable-disable.test.ts(2770,9): error TS2322: Type 'true' is not assignable to type 'false'.`; restored and green
- **Committed in:** `fbd41e5c`

**2. [Rule 2 - Missing Critical] The list test seeder ignored the `workflows` override it advertised**

- **Found during:** Task 2
- **Issue:** `SeedMarketplaceOpts.installed[].resources` declared `workflows?: readonly string[]`, but the seeder hard-coded `workflows: []`. A caller asking for a workflow-bearing record silently got one without.
- **Fix:** Wired the override through, with no default — neither seeded shape declares a workflow, so only a caller that asks gets one.
- **Files modified:** `tests/orchestrators/plugin/list.test.ts`
- **Committed in:** `fbd41e5c`

**3. [Rule 3 - Blocking] The gate's mock ctx tripped `@typescript-eslint/no-base-to-string`**

- **Found during:** Task 3
- **Issue:** Reading `ctx.ui.notify.mock.calls[0]?.arguments[0]` through `String(...)` on `node:test`'s untyped mock surface is a lint error.
- **Fix:** Replaced the `mock.fn()` recorder with a plain `string[]` recorder, matching the harness shape the orchestrator suites already use. No disable directive.
- **Files modified:** `tests/architecture/notify-stamp-coverage.test.ts`
- **Committed in:** `f6241d36`

**4. [Rule 1 - Bug] The mirror clause's row lookup could pass vacuously**

- **Found during:** Task 3
- **Issue:** `rowFor(token)` fell back to a placeholder string when no matching row rendered, so a *missing* uninstalled or disabled row would satisfy "carries no marker".
- **Fix:** Absence is now a failure with the whole rendered block in the message.
- **Files modified:** `tests/architecture/notify-stamp-coverage.test.ts`
- **Committed in:** `f6241d36`

### Scope adjustments

**5. Tasks 1 and 2's source edits were already on disk.** Wave 1 swept all six `Dependency[]` derivations plus the list record read (its own recorded deviation 1). This plan's Tasks 1 and 2 therefore reduced to the parts genuinely outstanding: the behavioural coverage for the four surfaces that had none (list, import cascade, both reconcile projections), the WR-01 refusal assertion, and the three rationale comments the plan asked to extend. The derivations were verified intact on the tree before any test was written, and each was then re-verified by revert.

**6. RED was demonstrated by neutralizing each derivation, not by writing against an unimplemented one.** The four surfaces' derivations already existed, so the honest equivalent of RED is: neutralize the arm, watch the new pair fail while every negative half stays green, restore. Recorded failures:

- reconcile enable projection, `shared.ts` push neutralized: cases 46 and 47 red, 47 pass
- import cascade, `execute.ts` push neutralized: cases 15 and 16 red, 25 pass
- list inventory row, `declaresWorkflows` forced `false`: cases 24 and 25 red, 77 pass
- the gate, each of the seven derivations reverted in turn: one case red each time

**7. `orchestrators/plugin/info.ts` was not touched**, per the plan's explicit carve-out — `git diff --name-only HEAD~3 HEAD` does not list it. Neither `persistence/` nor any dependency manifest appears either.

---

**Total deviations:** 4 auto-fixed (2 bugs, 1 missing critical, 1 blocking) + 3 scope adjustments
**Impact on plan:** Deviation 1 is the substantive one — the plan's Task 2 asked for "a compile-level check", and the obvious spelling of that check was silently inert. Everything else is small.

## Issues Encountered

- **The plan's `grep -rn 'requires pi-dynamic-workflows' orchestrators/` verification does not return nothing.** It returns four hits, all inside `/** */` doc comments that describe the marker (`shared.ts:94`, `list.ts:297`, `install.ts:713`, `reinstall.ts:1080`); three predate this plan and the fourth is the extracted install derivation's doc comment, written in the same house style as its siblings. The verification's *intent* — the marker is never caller-placed, only renderer-emitted from a row's `dependencies` — holds: no non-comment line in `orchestrators/` contains the literal.
- **`pre-commit run --files "$VAR"` still checks nothing in this shell**, as Wave 1 recorded. Every invocation here passed explicit literal paths and the hook output was read to confirm it named the files. `npm lint` / `npm format check` / `npm typecheck` reported Passed on each of the three runs; TruffleHog failed structurally on all three (worktree `.git` is a file), and each commit was preceded by a clean `trufflehog filesystem --results=verified,unknown --fail` over the same paths.
- **`npm run check` piped to `tail` reports the pipe's exit status, not the suite's.** The first run looked green on 18 tests; re-run unpiped it is `EXIT=0` over **3711 passing, 0 failing**.

## User Setup Required

None — this plan installs nothing and touches no dependency manifest.

## Next Phase Readiness

Ready. Open items unchanged from Wave 1:

- **WDOC-01 is untouched** — `docs/workflows-compatibility.md` and the README pair remain the phase's documentation work.
- **WDEP-03 still has no automated proof.** The claim is asserted in catalog prose with no test behind it; the research's layer-1 and layer-2 gaps are still open.
- **Three prose files carry stale soft-dep counts** no gate covers: `docs/messaging-style-guide.md` (`:28`, `:61`, `:67`, `:84`, `:166`) and `docs/open-closed-proof.md:56`.
- **The derivation set is now gated but still open.** If a future surface grows a `Dependency[]` derivation, it must be added to `DEP_BEARING_SURFACES` — the gate cannot discover it. That is stated in the clause's own comment.

## Self-Check: PASSED

All 13 modified files exist on disk; all three commit hashes resolve in `git log`; `git diff --diff-filter=D HEAD~3 HEAD` lists no deletion; neither `STATE.md` nor `ROADMAP.md` appears in any of the three commits; `npm run check` exits 0 (3711 passing).

---
*Phase: 105-workflow-degradation-and-documentation*
*Completed: 2026-08-15*
