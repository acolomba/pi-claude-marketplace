---
phase: 03-marketplace-layers-and-cross-scope-install
plan: "01"
subsystem: testing
tags: [cucumber, behavioral-tests, marketplace-layers, autoupdate, integration-migration]

requires:
  - phase: 02
    provides: the break helper, the whole-scope remember and unchanged steps, and the red-proof record format
provides:
  - the D-09 named-flip and unnamed-flip scenarios and the CFG-03 flip scenario in features/marketplace/autoupdate.feature
  - red proofs that the existing LAYER-02 and D-07 scenarios guard the other three cases
  - the deletion of test/integration/marketplace-layer-autoupdate.test.ts
affects: [integration-rescope, phase-08]

actuals:
  tokens: 3949
  tasks: 3
  commits: 3
plan_head_before: 792d2effb5602573522ac56ba22a60d430b0129a
plan_head_after: d1271faf9658c6d896e08d885d14b15374766a81

tech-stack:
  added: []
  patterns:
    - "Commit through a scratch script that asserts an agent branch, then runs git commit under the wave's heavy-job flock and the non-DAC script shell"

key-files:
  created: []
  modified:
    - features/marketplace/autoupdate.feature
  deleted:
    - test/integration/marketplace-layer-autoupdate.test.ts

key-decisions:
  - "No existing scenario was strengthened: every break failed its expected scenario on the first run, on an assertion"

patterns-established:
  - "A 'changes nothing' claim of an autoupdate flip uses the whole-scope remember and unchanged steps of the project scope"

requirements-completed: [ITMIG-05]

coverage:
  - id: D1
    description: "A named autoupdate flip of a marketplace the project scope records but no layer declares fails as marketplace-not-added and changes no file of the project scope (D-09)"
    requirement: ITMIG-05
    verification:
      - kind: other
        ref: "npm run test:cucumber:profile -- --profile adapter --parallel 1 features/marketplace/autoupdate.feature (46 passed); break A1 fails autoupdate.feature:695"
        status: pass
    human_judgment: false
  - id: D2
    description: "An unnamed autoupdate flip gives such a marketplace no row while the declared marketplace flips, and the base config then declares only the declared one with autoupdate true (D-09)"
    requirement: ITMIG-05
    verification:
      - kind: other
        ref: "same run; break A2 fails autoupdate.feature:714"
        status: pass
    human_judgment: false
  - id: D3
    description: "A named flip without --local of a marketplace only the local layer declares fails as invalid manifest naming claude-plugins.local.json while that file cannot be read, and changes no file of the project scope (CFG-03)"
    requirement: ITMIG-05
    verification:
      - kind: other
        ref: "same run; break A3 fails autoupdate.feature:739"
        status: pass
    human_judgment: false
  - id: D4
    description: "The existing LAYER-02 refusal and D-07 merge scenarios guard the integration file's other three cases, and the file is deleted"
    requirement: ITMIG-05
    verification:
      - kind: other
        ref: "breaks A4 (autoupdate.feature:262, :279), A5a (:241), A5b (:574); npm run check:static exit 0 without the file"
        status: pass
    human_judgment: false

duration: 30min
completed: 2026-11-21
status: complete
---

# Phase 3 Plan 01: Marketplace Layer Autoupdate Migration Summary

**Three new `marketplace autoupdate` scenarios (two D-09, one CFG-03) and red proofs for the existing LAYER-02 and D-07 scenarios replace all six cases of `marketplace-layer-autoupdate.test.ts`, which is deleted.**

## Performance

- **Duration:** about 30 min (2026-11-21T21:40:04Z to 2026-11-21T22:10Z)
- **Tasks:** 3 of 3
- **Files:** 1 modified, 1 deleted

## Accomplishments

- `features/marketplace/autoupdate.feature` gains three untagged scenarios after its last one. No existing line changed: the diff from the plan base has 63 added lines and 0 removed lines.
  - `:695` "Enabling autoupdate of a marketplace the scope records but no layer declares fails as not added and changes nothing (D-09)"
  - `:714` "Enabling autoupdate for every marketplace gives no row to a marketplace the scope records but no layer declares (D-09)"
  - `:739` "Enabling autoupdate without --local of a marketplace only the local layer declares fails as invalid manifest and changes nothing while the local config cannot be read (CFG-03)"
- Each of the six breaks failed its expected scenario on an assertion, never on a step timeout.
- `test/integration/marketplace-layer-autoupdate.test.ts` is deleted in its own commit. No file outside `.planning/` names it. Its three test helpers still have other importers: `test/edge/notification-boundary.ts` (18), `test/platform/hermetic-environment.ts` (130), and `test/shared/notification-run-seeds.ts` (103).

## Task Commits

1. **03-01-01 (tracer): the D-09 named-flip scenario.** `d638fcc` `test(marketplace): cover autoupdate of an undeclared marketplace`
2. **03-01-02: the D-09 unnamed-flip and CFG-03 scenarios.** `03cb1ce` `test(marketplace): cover autoupdate of undeclared or unreadable layers`
3. **03-01-03: delete the integration file.** `d1271fa` `test(marketplace): delete the autoupdate layer test that scenarios cover`

## Red proofs

- **Scratch folder:** `/tmp/claude-0/-home-user-pi-claude-marketplace/36571f01-5770-4f51-bd77-b22d58691339/scratchpad/phase03-plan01`
- **Checkout root:** every break log starts with `root=/home/user/pi-claude-marketplace/.claude/worktrees/agent-ab79d1a0d861a00fc`, which is this worktree's `git rev-parse --show-toplevel`.
- **Plan base:** `792d2effb5602573522ac56ba22a60d430b0129a`. The plan's line numbers were read at 43b7a14. All six old texts still occurred exactly once at the plan base, and the existing scenario lines (241, 262, 279, 296, 574) were unchanged.
- **Helper:** `break.sh` is copied from `phase02-plan02/break.sh`. It changes into `git rev-parse --show-toplevel`, writes `root=` first, refuses a dirty `extensions/` tree (exit 4), sets the EXIT trap (`git checkout -- <file>`, then `restored=clean` or `restored=DIRTY`) before it replaces the text, replaces only a text that occurs exactly once (otherwise exit 3), logs `git diff -- <file>`, then runs `npm run --silent test:cucumber:profile -- --profile <profile> --parallel 1 <args>` with the wrapper prefix and logs `exit=`. It names no fixed checkout path (`grep -c '/home/user/pi-claude-marketplace'` prints 0).
- **Green runs (adapter):** `green-autoupdate-1.log`: `44 scenarios (44 passed)`, `464 steps (464 passed)`, exit 0. It ran before the Task 1 commit and again after the commit for the tracer gate, with the same result. `green-autoupdate-2.log`: `46 scenarios (46 passed)`, `488 steps (488 passed)`, exit 0.
- **Builtin run:** `builtin.log` prints `0 scenarios` and exit 0. No scenario of the file has an implementation tag (DUAL-02).
- **Break text checks:** each `.old` and `.new` file was copied from `research-03/brk/` and checked with `cat -A` against the plan's `<context>`. Each text matched and has no trailing newline.

Every break ran with `bash "$D/break.sh" <id> adapter <file> "$D/<id>.old" "$D/<id>.new" features/marketplace/autoupdate.feature`. Each log ends with `exit=1` and `restored=clean`, and holds no `function timed out`. No break needed a rerun. `git status --porcelain -- extensions/` printed nothing after each break.

- **A1, tracer (Task 1, 44 scenarios):** `orchestrators/marketplace/autoupdate.ts:429`. Change: `-  if (verdict.kind === "undeclared") {` to `+  if (verdict.kind === "undeclared" && process.env.NEVER_SET === "x") {`. Result: `44 scenarios (43 passed, 1 failed)`. Failed: A01 (`autoupdate.feature:695`) at `Then the result has these fields:` with `AssertionError [ERR_ASSERTION]: Expected values to be strictly deep-equal`. The kind was `cascade`, not `marketplace-not-added`; the summary was `Some operations have failed.`; the `name`, `scope`, and `reasons` fields were missing. Passed: the other 43. Log: `A1-tracer-adapter.log`.
- **A1 (Task 2, 46 scenarios):** the same change. Result: `46 scenarios (45 passed, 1 failed)`. Failed: A01 (`:695`) with the same step and error. Passed: the other 45, A02 and A03 included. Log: `A1-adapter.log`.
- **A2:** `autoupdate.ts:516`. Change: `-    (name) => layers.filter((layer) => ownValue(layer.config.marketplaces, name) !== undefined),` to `+    (name) => layers,`. Result: `46 scenarios (43 passed, 3 failed)`. Failed, each at `Then the result has these fields:` with `AssertionError [ERR_ASSERTION]` (severity `error`, not `info`; `tally failures` 2, not 0; summary `Some operations have failed.`):
  - A02 (`:714`)
  - the existing `:343` "Enabling autoupdate for every marketplace writes a local entry the base config does not declare"
  - the existing `:611` "Disabling autoupdate for every marketplace with --local changes only the local config"

  Passed: the other 43, A01 and A03 included. Log: `A2-adapter.log`.
- **A3:** `autoupdate.ts:433`. Change: `-  if (verdict.kind === "other-unreadable") {` to `+  if (verdict.kind === "other-unreadable" && process.env.NEVER_SET === "x") {`. Result: `46 scenarios (45 passed, 1 failed)`. Failed: A03 (`:739`) at `Then the result lists these plugins:` with `AssertionError [ERR_ASSERTION]`. The reason was `unreadable`, not `invalid manifest`, and the cause was `saveConfig refused: in-memory config failed schema validation: /marketplaces/tools: must have required properties source`, not the `claude-plugins.local.json` schema message. Passed: the other 45, A01 and A02 included. Log: `A3-adapter.log`.
- **A4:** `autoupdate.ts:425`. Change: `-  if (verdict.kind === "refused") {` to `+  if (verdict.kind === "refused" && process.env.NEVER_SET === "x") {`. Result: `46 scenarios (43 passed, 3 failed)`. Failed:
  - `:262` "Enabling autoupdate without --local on a marketplace added with --local fails as marketplace in local layer only", at `Then the result lists these plugins:`. The reason was `unreadable`, not `marketplace in local layer only`, with the `saveConfig refused` cause.
  - `:279` "Disabling autoupdate with --local on a marketplace only the base layer declares fails as marketplace in base layer only", at `Then the result has these fields:`. The severity was `info`, not `error`, and the summary was missing.
  - `:296` "Enabling autoupdate without a scope changes only the scopes whose base layer declares the marketplace", at `Then the result has these fields:`. The severity was `error`, not `info`.

  Each failed with `AssertionError [ERR_ASSERTION]`. Passed: the other 43. Log: `A4-adapter.log`.
- **A5a:** `persistence/config-merge.ts:112`. Change: `-    marketplaceEntries.set(key, { entry: { ...baseEntry, ...entry }, source: "local" });` to `+    marketplaceEntries.set(key, { entry: { ...entry }, source: "local" });`. Result: `46 scenarios (45 passed, 1 failed)`. Failed: `:241` "A local declaration without autoupdate takes the setting from the declaration in the base layer", at `Then the result lists these marketplaces:` with `AssertionError [ERR_ASSERTION]` (autoupdate `false`, not `true`). Passed: the other 45. Log: `A5a-adapter.log`.
- **A5b:** the same line. Change: to `+    marketplaceEntries.set(key, { entry: { ...entry, ...baseEntry }, source: "local" });`. Result: `46 scenarios (45 passed, 1 failed)`. Failed: `:574` "A local autoupdate setting overrides the base-layer setting in the marketplace list", at `Then the result lists these marketplaces:` with `AssertionError [ERR_ASSERTION]` (autoupdate `true`, not `false`). Passed: the other 45. Log: `A5b-adapter.log`.

## Case map

These are the cases of `test/integration/marketplace-layer-autoupdate.test.ts` at the plan base.

| Case (line) | Replaced by | Break |
|---|---|---|
| `:127` "D-09: a recorded marketplace neither layer declares is not added to a named flip" | NEW `autoupdate.feature:695` (A01) | A1 |
| `:155` "D-09: an unnamed flip gives no row to a recorded marketplace no layer declares while a declared one flips" | NEW `autoupdate.feature:714` (A02) | A2 |
| `:211` "LAYER-02: a named flip without --local on a marketplace only the local config declares is refused and changes no file" | EXISTING `autoupdate.feature:262` | A4 |
| `:211` "LAYER-02: a named flip with --local on a marketplace only the base config declares is refused and changes no file" | EXISTING `autoupdate.feature:279` | A4 |
| `:234` "CFG-03: a named flip whose target layer is silent while the config of the other layer is invalid changes no file" | NEW `autoupdate.feature:739` (A03) | A3 |
| `:258` "D-07: the list reads the base value a local entry without one inherits, then the local override" | EXISTING `autoupdate.feature:241` (inherit) and `:574` (override) | A5a, A5b |

## Checks

Node `v24.22.3`. Each verify command was saved verbatim as a script under the scratch folder and run with `bash`, because the worktree's shell guard refuses one-line commands that call `git` inside `$(...)`.

| Script (verify command) | Tree it ran on | Exit |
|---|---|---|
| `verify-t1-1.sh` (adapter green, 44) | plan base + A01 (the content of `d638fcc`); rerun at `d638fcc` | 0, 0 |
| `verify-t1-2.sh` (A1 tracer detection) | `d638fcc` (also run before the commit) | 0 |
| `lint-warm.log` (lone `npm run lint` under the flock) | plan base + A01 | 0 |
| `verify-t1-3.sh` (`check:static`, `check-static-1.log`) | plan base + A01 | 0 |
| `verify-t1-4.sh` (only the feature file changed) | `d638fcc` | 0 |
| `verify-t2-1.sh` (adapter green, 46) | `d638fcc` + A02, A03 (the content of `03cb1ce`) | 0 |
| `verify-t2-2.sh` (A1, A2, A3 detections) | the same tree | 0 |
| `verify-t2-3.sh` (`check:static`, `check-static-2.log`) | the same tree | 0 |
| `verify-t2-4.sh` (only the feature file changed; `features/`, `extensions/` clean) | `03cb1ce` | 0 |
| `verify-t3-1.sh` (A4, A5a, A5b detections at their lines) | `03cb1ce`, rerun at `d1271fa` | 0, 0 |
| `verify-t3-2.sh` (`check:static` without the file, `check-static-3.log`) | `03cb1ce` + the staged deletion (the content of `d1271fa`) | 0 |
| `verify-t3-3.sh` (`fallow audit --base <plan base>`) | `d1271fa` | 0 |
| `verify-t3-4.sh` (builtin, `0 scenarios`) | `d1271fa` | 0 |
| `verify-t3-5.sh` (file gone, no reference, `extensions/` unchanged and clean) | `d1271fa` | 0 |
| `accept.sh` (acceptance criteria) | `d1271fa` | removed lines 0, `(D-09)` 2, `(CFG-03)` 1, `extensions/` diff and status empty |

Each `check:static` passed typecheck, lint, lint:workflows, fallow, format:check, test:corresponding, and check:features. `SKIP=npm-check pre-commit run --files features/marketplace/autoupdate.feature` passed before each feature-file commit. Inside the worktree the commit hook ran its text fixers and gitlint, and skipped `npm run check:commit`. The wave's post-merge `npm run check` is the full verdict.

## Issues for the milestone

- `npx --no fallow audit --base 792d2ef --format json --quiet` gives verdict `warn`: `{"dead_code_issues":0,"dead_code_has_errors":false,"complexity_findings":0,"max_cyclomatic":null,"duplication_clone_groups":0}`. Its only diff-risk finding is `weakened-tests:test/integration/marketplace-layer-autoupdate.test.ts`, the expected finding for a deleted test file. Per the user decision of 2026-11-21, `.fallowrc.json` and the CI workflows are unchanged, and the finding is left to the milestone.

## Deviations from Plan

- **The Task 2 commit title is shorter than the plan's example.** The example `test(marketplace): cover autoupdate flips of undeclared or unreadable layers` has 76 characters, and gitlint failed the hook (T1, 76 > 72), so no commit was made. The commit was retried as `test(marketplace): cover autoupdate of undeclared or unreadable layers` (70 characters) and passed. There was no `--amend` and no `--no-verify`.
- **A2 failed two more scenarios than the research listed.** The research named only A02. The run also failed the existing `:343` and `:611`, both unnamed flips, which shows that the D-MF-03 layer filter has more guards. This only adds coverage.
- **One commit attempt with nothing staged.** The shell guard refused a combined `pre-commit run` and `git add` command, so the first Task 2 commit attempt found nothing staged and changed nothing. The pre-commit run and the staging then ran as separate commands.
- **The commit script asserts the branch.** `commit.sh` is the Phase 2 script with an added check that HEAD is attached and on an agent branch. Then it runs the plan's exact `flock ... git commit -F` command.
- Every new scenario passed on a clean tree on its first run, with the values from the plan, so rule 4 did not apply. No scenario was strengthened.

## Parent lines

None. This plan changes only tests, with no user-visible behavior, so it has no CHANGELOG, BACKLOG, or Key Decisions line.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## Self-Check: PASSED

- FOUND: `features/marketplace/autoupdate.feature`. GONE: `test/integration/marketplace-layer-autoupdate.test.ts`.
- FOUND: commits `d638fcc`, `03cb1ce`, and `d1271fa` are ancestors of HEAD.
