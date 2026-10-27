---
quick_id: 261027-9oq
phase: quick-261027-9oq
plan: 01
status: complete
subsystem: missing-dependency step (marketplace add, bootstrap, autoupdate cascade)
tags: [MISS-01, autoupdate, GHB-03, NFR-3, D-PL2-11, D-PL2-19, D-PL2-20, D-PL2-21]
requirements: [RCN-06, RCN-07]
requires:
  - D-PL2-09 / D-PL2-10 (the shared step and its autoupdate wiring)
  - runScopeIsolated (orchestrators/reconcile/read-pass.ts)
provides:
  - cascadeAutoupdates reports its cascade from a finally before a step throw leaves it
  - the step's failed scope read becomes apply's state.json (failed) row
  - D-PL2-19, D-PL2-20, D-PL2-21 and D-PL2-11's explicit divergence in 02-CONTEXT.md
affects:
  - /claude:plugin marketplace update (autoupdate on)
  - /claude:plugin marketplace add
  - /claude:plugin bootstrap
tech-stack:
  added: []
  patterns:
    - report callback called from a finally, as notifyAdded does
    - one row builder shared by apply's invalid-block arm and the step's rows
key-files:
  modified:
    - extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts
    - extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts
    - extensions/pi-claude-marketplace/orchestrators/reconcile/notify.ts
    - extensions/pi-claude-marketplace/orchestrators/types.ts
    - test/orchestrators/marketplace/update.test.ts
    - test/orchestrators/reconcile/apply.test.ts
    - test/orchestrators/reconcile/notify.test.ts
    - features/plugin/update-dependencies.feature
    - .planning/phases/02-apply-ordering-and-installed-declarations/02-CONTEXT.md
    - .planning/phases/02-apply-ordering-and-installed-declarations/02-05-SUMMARY.md
    - .planning/phases/02-apply-ordering-and-installed-declarations/02-06-SUMMARY.md
decisions:
  - "D-PL2-11 (user decision 2026-10-27): kept, and recorded explicitly as a deliberate divergence from Claude Code: rows over logs: Pi has no user-read log"
  - "D-PL2-19 (user decision 2026-10-27): one row per dependency per autoupdate command; the step skips a dependency a plugin update of the same command already reported"
  - "D-PL2-20 (user decision 2026-10-27): a scope read of the step that throws reports apply's state.json (failed) row with apply's classified reason and the redacted cause, and installs nothing"
  - "D-PL2-21 (user decision 2026-10-27): a throw out of the autoupdate step reports the marketplace's update rows and notices first, from a finally, then reaches the command"
  - "Orchestrator decision: keep the callback + finally design for D-PL2-21"
  - "Orchestrator decision: accept T-9oq-05 (a MIG-01 save failure is named state.json)"
metrics:
  completed: 2026-10-27
  tasks: 3
  files: 11
actuals:
  tokens: 21000
  tasks: 3
  commits: 3
plan_head_before: 8f4261eef42d7555fba41bde1ca079642f62231f
plan_head_after: 2ae7931d5cb42cbe2203b4ff8eaaeab021997a25
---

# Quick 261027-9oq: Dependency step reporting after add and autoupdate Summary

An autoupdate whose missing-dependency step throws (GHB-03) now reports the marketplace's update rows and MCP notices before the error reaches the command. A scope read of the shared step that throws now shows `apply`'s `state.json` `(failed)` row under `marketplace add`, `bootstrap` and the autoupdate block, instead of a debug-log line. 02-CONTEXT.md records D-PL2-19, D-PL2-20 and D-PL2-21, and states D-PL2-11's divergence explicitly.

## Commits

BASE1 (before Task 1): `8f4261ee`. BASE2 (before Task 2): `c1a76fc7`.

| Task | Commit | Subject |
|------|--------|---------|
| 1 (tracer) | `c1a76fc7` | fix(marketplace): report autoupdate rows before a dependency step throw |
| 2 | `7284febd` | fix(marketplace): report a failed scope read in the dependency step |
| 3 | `2ae7931d` | docs(plugin): record the dependency step reporting decisions |

All three landed through the pre-commit hook (`npm run check:commit` passed on the first two; the docs commit has no build input).

## What changed

**Task 1 (D-PL2-21), `orchestrators/marketplace/update.ts`.**
- `cascadeAutoupdates` takes a `report` callback and returns `void`. The autoupdate-off arm reports `NO_AUTOUPDATE_CASCADE`. The plugin-update loop is unchanged, including `rethrowInvalidGitHubBaseUrl`, so a plugin-update throw still leaves without a report. The step runs in a `try` and the `finally` calls `report({ outcomes, installs })`.
- The rendering after the cascade moved, unchanged, into the private `notifyRefreshed(args, snapshot, cascade)`. `refreshOneMarketplace` keeps the "CASCADE OUTSIDE the outer guard" comment and passes a block-bodied arrow to the cascade. `pluginUpdate` left its destructuring there.
- Header GHB-03 bullet and `installAutoupdateDependencies`' doc (D-PL2-19) updated.

**Task 2 (D-PL2-20).**
- `createScopeDependencyInstall` (`apply.ts`) runs only `readPlainPlanForScope` inside `runScopeIsolated(request.scope, outcomes, …)`, then applies `request.select` outside it, then runs `applyDependencyInstalls` outside it on the same `outcomes`. The debug-log call is gone (`hookDebugLog`, `errorMessage` and `PlannedDependencyInstall` keep other users). `read.invalidOutcomes` stays unused.
- `notify.ts`: the synthetic child of an `invalid-block` is now `invalidBlockRow(outcome)`, used by `applyMarketplaceOutcomeToBlock` (still behind its `cause !== undefined` guard) and by a new `invalid-block` arm in `dependencyInstallRows`.
- `types.ts`: the `ScopeDependencyInstallRow` and `ScopeDependencyInstallResult` docs name the row.

**Task 3.** 02-CONTEXT.md, 02-05-SUMMARY.md and 02-06-SUMMARY.md: additions only (`git diff` shows no removed line).

## RED evidence

Both RED runs were made on the untouched source before the source edits, after the cases were written (the same bytes as BASE1's `update.ts` and BASE2's `apply.ts`/`notify.ts`).

**Task 1.**
- Unit "D-PL2-21: a missing-dependency step that throws after the plugin updates reports their rows and notices before the error reaches the caller": `✖`. The rejection arrived with `notifications` empty: `+ []` against the expected `(updated)` block and the `mcp.json` notice.
- Scenario "An autoupdate that an invalid GitHub base address stops reports the plugin updates it made before stopping": failed at `the command reports these results`. Only the `internal-error` row came back (with `needs reload` `false`); the `cascade | info | true` row was missing.

**Task 2.**
- apply.test.ts "D-PL2-20: a read that throws a plain error reports apply's state.json row as unreadable and installs nothing" and "... a held state lock ... as lock held ...": both `✖`, `+ undefined` / `- 'failed'` (the step answered `{ rows: [] }`).
- notify.test.ts "D-PL2-20: a scope read that threw becomes apply's failed state.json row with its cause": `✖`, `+ []`.

## Verification

- Task 1: `node --test` on `update.test.ts`, `edge/handlers/marketplace/update.test.ts`, `edge/register.test.ts`: pass 411, fail 0. Direct coverage of `update.ts`: exit 0. `features/plugin/update-dependencies.feature`: 20 scenarios, all passed. `check:features`: exit 0. The GHB-03 plugin-update case ("an autoupdate cascade plugin failing on an invalid base fails the command") passes unchanged with `notifications` `[]`.
- Task 2: `node --test` on the apply, notify, read-pass, add and bootstrap suites: pass 478, fail 0. Direct coverage of `apply.ts` and `notify.ts`: exit 0. `features/marketplace/add.feature` + `features/plugin/bootstrap.feature`: 54 scenarios passed. "reports nothing for a scope whose config is invalid" and the invalid-config synthetic child case pass unchanged.
- Grep gates: `D-PL2-21` in update.ts 2, in update.test.ts 1; scenario title 1; `D-PL2-20` in apply.ts 1, in notify.ts 2; `runScopeIsolated(request.scope` in apply.ts 1. Task 3's seven gates pass (`rows over logs: Pi has no user-read log`: 4).

**Final gate.** `npm run check > "${TMPDIR:-/var/tmp}/261027-9oq-check.log" 2>&1; echo "exit=$?"` from the checkout root on HEAD `2ae7931d`, Node `v26.12.1`: **exit=0**. Log tail: `passed typecheck`, `passed lint`, `passed lint:workflows`, `passed fallow`, `passed format:check`, `passed test:corresponding`, `passed check:features`; cucumber `920 scenarios (920 passed)`, `9310 steps (9310 passed)`; `Merged LCOV: coverage/direct.lcov (292 records)`.

## Proof scope

D-PL2-21 has a unit case and the scenario above. D-PL2-20 has unit cases only. Why no scenario can trigger the read failure:

The step's read (`readPlainPlanForScope`) can throw at three points: taking the scope's state lock, loading `state.json`, and the MIG-01 save of the base config. The same command passed all three moments earlier, under the same lock and on the same files: the add, or the update's plugin updates, loaded and saved `state.json` and wrote the layer config into the same scope directory.

A scenario can change the sandbox only in `Given` steps, before its single `When` starts, and no `Given` may follow a `When` (`.agents/skills/cucumber/rules/features.md`). Nothing in the world can run between two lock acquisitions inside one command. The only lock stand-in, `another process holds the state lock of the <scope> scope` (`features/lib/state-lock-holder.ts`), takes the lock before the command starts, so the add itself fails as `lock held` and the step never runs ("Adding a marketplace while another process holds the state lock of the scope fails as lock held and leaves no marketplace" in `features/marketplace/state-lock.feature`). A corrupt installation record fails the add the same way, and no step may name the extension-owned `pi-claude-marketplace/state.json`. The MIG-01 save writes only when the base config is absent and the state records something no layer declares, a legacy pre-config record that no step can create. 02-REVIEW-FIX.md (WR-02, WR-05) reached the same limit.

## Deviations from Plan

1. **[Adaptation] Decision bullets placed in numeric order, not after the highest bullet.** Since the plan was written, 261027-a3r and 261027-cyg added D-PL2-22..25 under "### Amendments after research (2026-10-26)". "Right after the highest-numbered bullet" would have put D-PL2-19..21 after D-PL2-25. They went between D-PL2-18 and D-PL2-22 instead, which keeps the "in numeric order" half of the instruction. Additive only.
2. **[Adaptation] RED captured before the source edit, not by restoring BASE files after the commit.** The cases were written and run first on the untouched source, which is byte-identical to BASE1's `update.ts` and BASE2's `apply.ts`/`notify.ts`. The post-commit restore loop would have rerun the same bytes, so it was skipped.
3. **[Adaptation] Harness contingency not needed.** The `widget` update reported `(skipped) {up-to-date}` and threw nothing, so the step was the only GitHub-touching operation. The fixture is the one the plan describes.
4. **`types.ts`: both docs updated.** The `ScopeDependencyInstallResult` doc said "the rows of the installs the step ran", which leaves the read row out, so the plan's condition for changing it held.
5. **One phrase line break in the D-PL2-21 bullet.** "rows over logs: Pi has no user-read log." sits on its own line so the grep gate matches it (mdformat runs with `wrap = "no"` and left it).
6. **Scenario cells read from the post-change run.** The `internal-error` result's `needs reload` is `true` after the change (it was `false` on the pre-change source, where no reload-needing row went out first). This matches the `apply.feature` GHB-03 scenario.

## Decision rows

| ID | Rule | Evidence / reason |
|----|------|-------------------|
| D-PL2-11 | Kept: `apply` and the step's call sites render a MISS-01 refusal as a `(failed)` row. Now stated as a deliberate divergence from Claude Code | Upstream `bae` only logs (E3); rows over logs: Pi has no user-read log |
| D-PL2-19 | The autoupdate step skips a dependency a plugin update of the same command already reported (WR-04 extends it to a bare `marketplace update`) | `bae` would retry and only log (E3); a retry here would print the same refused dependency twice in one block |
| D-PL2-20 | A throw out of the step's scope read reports `apply`'s `state.json` `(failed)` row (classified reason, redacted cause, through `runScopeIsolated`), installs nothing; next `apply` installs (NFR-3). An invalid layer config still answers no row | Upstream only logs (E3); rows over logs |
| D-PL2-21 | A throw out of the autoupdate step reports the marketplace's update rows, dependency rows and MCP notices from a `finally`, then the same error reaches the command. A plugin-update GHB-03 is unchanged | The updates committed, so the user must see that `/reload` is due; GHB-03's variable is Pi's own |

## Uncertain choices (for user review)

1. **A failed read turns a no-op autoupdate into `(updated)`.** `notifyRefreshed`'s no-op gate counts `installs.rows.length`, so an unchanged marketplace whose step read threw reports `tools [project] (updated)` with the `state.json` `(failed)` row under it, at error severity, instead of `(skipped) {up-to-date}`. The alternative is a no-op gate that ignores a failed-read row, which would hide the failure.
2. **A bare `marketplace update` can repeat the row.** Each autoupdated marketplace of a scope runs the step and reads the scope again, so a scope whose read keeps failing shows one `state.json` row per marketplace block. `reportedDependencies` also records the key `project:state.json`, which is harmless because no dependency key lacks an `@`.
3. **The step's row has no cause guard.** `dependencyInstallRows` emits the `state.json` row even when an `invalid-block` outcome has no cause (the cause is then omitted). The step only produces the outcome through `runScopeIsolated`, which always sets one, so the difference from `apply`'s guarded arm cannot be observed.

## Follow-ups (observed, not changed)

1. An invalid layer config still gives no row from the step (`read.invalidOutcomes` is dropped), while `apply` reports it.
2. A GHB-03 from a plugin update inside the cascade still drops the rows of the updates before it, unlike D-PL2-21's step throw.
3. The rows of the dependencies the step installed before it threw are still lost (the WR-02 limit).

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced. T-9oq-01..03 are mitigated as planned: the `finally` report, the cause from `runScopeIsolated`'s `redactAbsolutePaths(errorMessage(err))`, and only the read inside the isolation. T-9oq-04 and T-9oq-05 are accepted (orchestrator decision for T-9oq-05).

## Self-Check: PASSED

- FOUND: all 11 modified files
- FOUND: `c1a76fc7`, `7284febd`, `2ae7931d` (ancestors of HEAD)
- Commits measured: `git rev-list --count 8f4261ee..HEAD` = 3
- `npm run check` exit 0 on `2ae7931d`
