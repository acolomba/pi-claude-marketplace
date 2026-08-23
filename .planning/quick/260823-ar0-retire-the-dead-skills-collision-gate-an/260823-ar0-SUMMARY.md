---
id: 260823-ar0
slug: retire-the-dead-skills-collision-gate-an
description: Retire the dead skills collision gate and deliver bridge warnings on update and reinstall
created: 2026-08-23
completed: 2026-08-23
mode: quick
status: complete
local_branch: pr-141
worktree: .worktrees/pr-141
pr: 141
tasks: 4
tasks_completed: 4
decisions:
  - D-141-04 the skills generated-name collision gate is retired, not moved
  - D-141-05 the discovery/hygiene split is every staging verb's policy
---

# Quick Task 260823-ar0 Summary

Two items closed, both carried over from `260821-eln-SUMMARY.md` under "Left
open, deliberately". `assertNoSkillCollisions` is gone and the documentation
that promised a hard error now describes the first-wins skip the code always
ran. `update.ts` and `reinstall.ts` now run install's warning policy from one
shared surface, so a standalone `update` or `reinstall` reports a skipped
declared component instead of dropping the warning.

Executed sequentially in the existing linked worktree on branch `pr-141`. No
worktree created, no branch switch, no rebase, no amend, no force-push. The
contributor commit `6bd79fea` is unchanged at the base of the branch and
remains reachable from `HEAD`.

## Commits

| Task | Commit | Title |
| ---- | ------ | ----- |
| 1 | `18f87ff2` | `refactor(skills): retire the collision gate the code never reached` |
| 2 | `4ebe5f73` | `feat(reinstall): give reinstall the install warning policy` |
| 3 | `a4749d09` | `feat(update): deliver the bridge warnings on the update path` |
| 4 | `fee24d1d` | `docs(changelog): name every verb the warnings now reach` |

Each commit passed `pre-commit run --all-files` before it was made, with the
structural trufflehog git-mode failure confirmed clean by a filesystem scan
over exactly that commit's paths (`verified_secrets: 0`,
`unverified_secrets: 0` every time) and `SKIP=trufflehog` applied to that one
hook only. `git status` was clean after each commit.

Two hook rewrites occurred and were folded into their own task's commit rather
than recovered afterwards: mdformat re-padded the PRD table in Task 1, and
prettier reformatted a line in Task 3. Both were caught by the mandated
post-hook re-run, not after the fact.

## Gate

`npm run check` redirected to `/tmp/260823-ar0-check.log`, never piped.

**Real exit code: `EXIT=0`.**

| Suite | tests | pass | fail | skipped |
| ----- | ----- | ---- | ---- | ------- |
| unit | 3627 | 3626 | 0 | 1 |
| integration | 21 | 21 | 0 | 0 |

The one skipped unit test is pre-existing and platform-conditional:
`D-62-05: reapOrphans on non-Linux platform soft-skips SIGKILL`, annotated
`non-Linux soft-skip arm; this host is Linux`. It is unrelated to this work.

Working tree clean after the final commit; the only untracked path is this
task's own planning directory, which the orchestrator commits.

## Task 3: the `notes` widening walk

The plan required confirming no `updated`-arm consumer READS `notes` before
widening `PluginUpdateUpdatedOutcome`. The added caution also required walking
every site that CONSTRUCTS an `updated` outcome and deciding, per site, whether
it should populate the new field. Both walks are below.

### Reader walk — result: no `updated`-arm reader exists

Every `.notes` read across `orchestrators/`, `edge/` and `index.ts` was
enumerated. Four are genuine outcome readers; the rest are resolver
`installable.notes` / `compatibility.notes`, a different subject.

| Site | Partition it is typed on | Reaches `updated`? |
| ---- | ------------------------ | ------------------ |
| `plugin/update.ts:2410` `narrowSkipReasons(outcome.notes)` | `PluginUpdateSkippedOutcome` | No |
| `plugin/update.ts:2511` `narrowFailReasons(outcome.notes)` | `PluginUpdateFailedOutcome` | No |
| `marketplace/update.messaging.ts:249` `narrowSkipReason` | `PluginUpdateSkippedOutcome` | No |
| `marketplace/update.messaging.ts:287` `narrowFailReason` | `PluginUpdateFailedOutcome` | No |
| `plugin/reinstall.messaging.ts:283,318`, `reinstall.ts:323`, `reconcile/backfill.ts:387` | reinstall union, `skipped` / `failed` arms | No — different union |

No third reader exists on the update union, so the widening reaches nobody.
Proceeded as planned.

### Constructor walk — 1 production site, 15 test fixtures

`grep -rn 'partition: "updated"' extensions/ tests/` returns exactly one
production construction site and fifteen test-fixture sites.

| Site | Decision | Why |
| ---- | -------- | --- |
| `plugin/update.ts:2302` (the phase-3b success literal) | **Populate.** | This is the only place the staging handles are in scope after a successful swap. It carries `notes` under the same NREG-01 non-empty spread rule `degradedKinds` uses, so a clean update's outcome shape is unchanged. |
| `tests/orchestrators/marketplace/update.test.ts` × 15 | **Do not populate.** | Every one of these builds an `updated` outcome to feed the marketplace cascade RENDERER. The reader walk above proves the renderer never reads `notes` on this arm, so populating them would assert nothing and would couple fixtures to a field their subject ignores. |

This is the case the caution names — an optional member added to a closed
outcome set, where every existing derivation site keeps compiling while
quietly omitting it. Here the omission is correct rather than silent: the
fifteen omitting sites are renderer fixtures whose subject provably does not
read the field, and the one site that must populate it does.

**The same failure class did bite in Task 2, and was caught by making the
field required rather than optional.** `LockedSuccess.discoveryWarnings` in
`reinstall.ts` was declared `readonly discoveryWarnings: readonly string[]`,
not `?:`. `tsc` immediately named two construction sites I had not considered
— the `not installed` and `already disabled` skipped arms at `reinstall.ts:878`
and `:899`. Both return before either warning path runs, so `[]` is correct
there, but an optional field would have compiled clean and left them
unexamined. Required-plus-compiler-error is what turned a silent omission into
a named one.

## Mutation plants

The plan required three plants. All three were run, all confirmed the new
tests can fail, and all were reverted before the commit.

| Plant | Result |
| ----- | ------ |
| Task 1: remove the `continue` in `discover.ts`'s `seenByGenerated.has` branch | The new `D-141-04` test failed (along with two pre-existing dedup tests). Restored; 41/41 pass. |
| Task 2 (added, not required by the plan): drop the `surfaceDiscoveryWarnings` call and the `discoveryWarnings` spread from reinstall's two arms | The new standalone reinstall test failed. Restored; 80/80 pass. |
| Task 3: drop the `notes` assignment from the `updated` outcome | Both new update tests failed. Restored; 103/103 pass. |

The Task 2 plant is worth one note: dropping `discoveryWarnings` from the
orchestrated `notes` array did **not** fail the second new reinstall test.
That is correct — that test guards the AGENTS warning, which rides
`bridgeWarnings`, so the discovery channel is not its subject.

`tests/orchestrators/plugin/install.test.ts` passed 127/127 **unedited** after
the Task 2 hoist, which is the evidence the plan named that moving
`surfaceStandaloneDiscoveryWarnings` into `shared.ts` changed no behavior. The
`installed`-verb header text is reproduced byte for byte.

## Deviations from the plan

Two, both additive, both reported here rather than buried.

**1. Two extra comment sites corrected in Task 1.** The plan listed six known
comment sites and instructed me to verify the list with two greps and fix
whatever they returned. They returned one more site the list did not name, and
a second surfaced while editing:

- `bridges/skills/stage.ts` — the `prepareStageSkills` doc comment's numbered
  step list opened with `2. Refuse on RN-6 collisions.` That is exactly the
  kind of claim the task exists to remove. Rewritten, and steps 3-5 renumbered
  to 2-4 with the trailing `On any error during step 4` reference corrected to
  `step 3`.
- Two unused imports created by the deletion (`DiscoveredSkill` in both
  `stage.ts` and `stage.test.ts`) were dropped, as `noUnusedLocals` required
  and as the plan anticipated for the test file.

**2. `splitHandleWarnings` wrapper in `reinstall.ts`.** The plan said to
replace `collectStagingWarnings` "with a call to `splitStagingWarnings`". I
kept a thin same-named-role wrapper that reads the four
`handles.<bridge>.result.warnings` off `PreparedHandles` and delegates. The
shared helper takes plain `readonly string[]` because `shared.ts` forbids
importing bridge types; the wrapper is where the bridge-shaped `PreparedHandles`
is unpacked, and it keeps that unpacking out of the already-long
`runLockedReinstall`. `update.ts` has the equivalent (`collectUpdateWarnings`),
which the plan explicitly asked for as its own named helper. Behavior is
identical to a direct call.

## Deliberately not done

| Item | Reason |
| ---- | ------ |
| `assertNoAgentCollisions` | Out of scope per the plan. Not measured, not settled by a decision, and PRD RN-6 points agents at AG-12. The agents bridge was touched only to READ its `result.warnings`. |
| The `duplicateWarning` "already produced by an earlier componentPaths.skills entry" clause | Out of scope per the plan. It is inaccurate for a within-entry collision, pre-existing on both the skills and commands bridges, and recorded by 260821-eln as a later pass. The new `D-141-04` test deliberately asserts on `"acme-foo"` and `ignoring duplicate` only, never on that clause, so nothing locks it in. |
| `discover-names.ts` | Out of scope per the plan. It still discards its copy of the discovery warnings on purpose; every caller re-walks the same directories during staging, and that pass is the one that reports. |
| Any version bump | Locked by the plan and the constraints. `package.json`, `package-lock.json`, `EXTENSION_VERSION` and `sonar.projectVersion` all verified still at `0.17.0`; `git diff main...HEAD` over the three version files is empty. |
| A CHANGELOG entry for the retired skills gate | Locked by the plan. The gate never fired, so retiring it changes no user-visible behavior, and the changelog rule forbids explaining what the old code did internally. |
| ROADMAP.md | Excluded by the execution constraints. |
| Committing docs artifacts (SUMMARY.md, PLAN.md, STATE.md) | Excluded by the execution constraints; the orchestrator commits those. |

## Verification summary

| Claim | Evidence |
| ----- | -------- |
| The skills gate is gone and nothing claims otherwise | `grep -rn "assertNoSkillCollisions" extensions/ tests/ docs/` returns nothing |
| Retiring it changed no behavior | the new `D-141-04` discover test passes, and fails under the planted first-wins mutation |
| The hoist changed no install behavior | `tests/orchestrators/plugin/install.test.ts` 127/127, unedited |
| A standalone reinstall surfaces a skills warning | new reinstall test: row plus exactly one `warning`-severity diagnostic |
| A standalone update surfaces one | new update test: row plus exactly one `warning`-severity diagnostic |
| Agents and mcp warnings stay orchestrated-only | both new orchestrated tests: present on `notes`, absent from every notification |
| No absolute path leaks | each standalone test asserts the marketplace root is not in the message (NFR-9) |
| Update reads the warnings at all | `grep -n "result.warnings" orchestrators/plugin/update.ts` returns the fold at lines 1343-1346 |
| The whole thing is green | `npm run check` exit 0, redirected to a file, not piped |

## Self-Check: PASSED

- `18f87ff2`, `4ebe5f73`, `a4749d09`, `fee24d1d` all present in `git log`.
- `6bd79fea` reachable from `HEAD` and unchanged.
- `extensions/pi-claude-marketplace/orchestrators/plugin/shared.ts` exports
  both `splitStagingWarnings` and `surfaceDiscoveryWarnings`; they are the
  only copies.
- `grep -rn "assertNoSkillCollisions" extensions/ tests/ docs/` returns
  nothing.
- Working tree clean apart from this task's untracked planning directory.
