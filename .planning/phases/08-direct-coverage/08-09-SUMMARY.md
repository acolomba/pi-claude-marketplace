---
phase: 08-direct-coverage
plan: 09
subsystem: testing
tags: [direct-coverage, pre-commit, github-actions, gate-wiring, fail-closed]

requires:
  - phase: 08-direct-coverage
    provides: "08-01's repaired reporter and its widened `fix-unicode-dashes` exclusion, without which a new hook could not be verified inside an `--all-files` run that was already red"
  - phase: 08-direct-coverage
    provides: "08-04's `--base <ref>` fail-closed explicit base, the committed pin, and the bidirectional comparison in both gate arms"
  - phase: 08-direct-coverage
    provides: "08-08's second full sweep, its byte-identical pin, and the `CONTRIBUTING.md` section this plan finishes"
provides:
  - "`test:coverage:direct:commit` -- the same gate script with an explicitly named `HEAD` base, so the hook and the job are one implementation at one strictness"
  - "`npm-coverage-direct` -- a scoped local pre-commit hook, `language: system`, `pass_filenames: false`, matching the production root, the test root, `scripts/revalidation.mjs` and the pin file"
  - "`direct-coverage` -- a dedicated CI job at `fetch-depth: 0` that asserts `origin/main` resolves BEFORE measuring and asserts the base the gate printed AFTER, with `pipefail` set explicitly so a logging pipeline cannot mask the gate's exit status"
  - "`package` gated on `direct-coverage`, so a coverage shortfall blocks the release manifest check exactly as the other three gates do"
  - "`CONTRIBUTING.md` naming both scopes, both measured costs, the job, the hook, `pre-commit install`, the `SKIP=` escape and the `--no-verify` prohibition"
  - "a planted proof that `SEALED_REQUIREMENT_ROUTES` refuses an `RCOV-03` completion at this phase -- the blocker `CLOSE-01` inherits"
affects: [09-close, CLOSE-01, direct-coverage, ci-coverage-job, pre-commit-hook]

actuals:
  tokens: 3693
  tasks: 3
  commits: 3
  plan_head_before: 4e0f3a6eac6dabdeec5564df9a24b58b6573fa52
  # `commits` is MEASURED (`git rev-list --count 4e0f3a6e..HEAD`), not narrated: three task
  # commits. The plan metadata commit lands after this file is written and is not counted here.
  # `tokens` is estimateTokens (chars/4) over `git diff 4e0f3a6e..HEAD` across the four changed
  # files -- the same scale 08-04, 08-06, 08-07 and 08-08 used.

tech-stack:
  added: []
  patterns:
    - "A CI job that measures something asserts its own input first: one step proves the base candidate resolves, the gate prints the base it chose, and a later step asserts that printed line -- so a silent fallback to a one-commit diff fails loudly instead of passing quietly"
    - "A logging pipeline in a CI step is a correctness hazard, not a convenience: GitHub's default shell is `bash -e` and does not set `pipefail`, so `npm run gate | tee log` exits with tee's status"
    - "A pre-commit `files:` pattern for a pairing gate is deliberately WIDER than the gate's own correspondence rule -- over-matching costs a sub-second pass-over, under-matching is indistinguishable from a pass"
    - "One gate implementation, one strictness, two explicitly named bases: the scope difference lives in the argument, never in a second copy of the gate"

key-files:
  created:
    - .planning/phases/08-direct-coverage/08-09-SUMMARY.md
  modified:
    - package.json
    - .pre-commit-config.yaml
    - .github/workflows/ci.yml
    - CONTRIBUTING.md

key-decisions:
  - "The CI gate step uses `set -o pipefail` with `tee` rather than a bare file redirect. Both were sanctioned; the pipe keeps the gate's output in the job log, where a red gate's reason is legible, and `pipefail` removes the masking hazard that made the pipe wrong in the first place"
  - "The research block's assertion step (`run: grep -qx 'Changed-pair base: origin/main' ...`) does not parse as YAML -- a plain scalar cannot carry `: `. It is a block scalar here (deviation 1)"
  - "`RCOV-03` is NOT marked complete, and this is enforced rather than conventional: a planted completion makes `scope-impact --check` exit 1 with `requirement-route-contract: RCOV-03`. `CLOSE-01` owns the coordinated seal update"
  - "`CONTRIBUTING.md`'s `### Coverage sweeps (manual)` heading lost `(manual)`: two of the three sweeps now run without anyone remembering to invoke them. The whole-tree arm and the report are still described as manual, each with its own reason"
  - "Three count-dependent sentences in `CONTRIBUTING.md` (`Both stop at`, `the two commands above`, `Because both sweeps`) were corrected to three, because the new commit-scoped script made each of them false"

patterns-established:
  - "Prove a seal by planting a violation and restoring in one atomic command, not by reading the sealed table -- the read tells you the value, the plant tells you the checker fires"
  - "Run the long branch-scoped arm in the background while editing files the gate cannot pair; `CONTRIBUTING.md` and the workflow are safe to touch mid-run in a way `scripts/revalidation.mjs` is not"

requirements-completed: []

coverage:
  - id: D1
    description: "A scoped local pre-commit hook runs the same changed-pair gate with a commit-scoped base, and the whole pipeline is green with it in place"
    requirement: RCOV-03
    verification:
      - kind: other
        ref: "npm run test:coverage:direct:commit -- exit 0, prints `Changed-pair base: HEAD`, resolves zero changed pairs and measures both pinned pairs"
        status: pass
      - kind: other
        ref: "SKIP=trufflehog pre-commit run npm-coverage-direct --all-files -- `npm direct coverage (changed pairs).....Passed`, exit 0"
        status: pass
      - kind: other
        ref: "SKIP=trufflehog pre-commit run --all-files -- exit 0, 35 hooks, no `files were modified by this hook`"
        status: pass
    human_judgment: false
  - id: D2
    description: "The hook's `files:` pattern matches the production root, the test root, the special pair and the pin, and matches nothing else"
    requirement: RCOV-03
    verification:
      - kind: other
        ref: "node -e over the extracted pattern -- `hook pattern matches 5 scoped paths and none of 3 out-of-scope paths`"
        status: pass
    human_judgment: false
  - id: D3
    description: "A dedicated CI job checks out at full depth, asserts the base candidate resolves, runs the branch-scoped gate without a masked exit status, and asserts the base the gate printed"
    requirement: RCOV-03
    verification:
      - kind: other
        ref: "awk-extracted `direct-coverage` block carries `fetch-depth: 0`, `rev-parse --verify origin/main`, `Changed-pair base: origin/main` and `npm run test:coverage:direct`; the `tee` step also carries `pipefail`"
        status: pass
      - kind: other
        ref: "SKIP=trufflehog pre-commit run --files .github/workflows/ci.yml -- check-yaml, yamllint and yamlfmt all Passed, no rewrite"
        status: pass
      - kind: integration
        ref: "node scripts/test-coverage-direct.mjs --base origin/main -- exit 0, 147 pairs measured, `grep -qx 'Changed-pair base: origin/main'` matches; the same command and the same assertion string the job runs"
        status: pass
    human_judgment: false
  - id: D4
    description: "`package` is gated on the new job, so a shortfall blocks the manifest validation that gates release"
    requirement: RCOV-03
    verification:
      - kind: other
        ref: "grep -E 'needs: \\[[^]]*direct-coverage[^]]*\\]' -- `needs: [check, integration-tests, e2e-tests, direct-coverage]`"
        status: pass
    human_judgment: false
  - id: D5
    description: "`CONTRIBUTING.md` names both scopes, both measured costs, the job, the hook, the sanctioned escape and the forbidden one, and keeps coverage framed as reachability evidence only"
    requirement: RCOV-03
    verification:
      - kind: other
        ref: "node -e needle check over seven required strings plus negative greps for `ten focused test runs` and `Neither is wired yet` -- `states both scopes, both costs, the escape, and the reachability boundary`"
        status: pass
      - kind: other
        ref: "SKIP=trufflehog pre-commit run --files CONTRIBUTING.md package.json .pre-commit-config.yaml .github/workflows/ci.yml -- exit 0, mdformat and markdownlint-cli2 Passed, no rewrite"
        status: pass
    human_judgment: false
  - id: D6
    description: "`RCOV-03` cannot be marked complete inside this phase, and the constraint is a real blocker on closing the milestone"
    requirement: RCOV-03
    verification:
      - kind: other
        ref: "planted `- [x] **RCOV-03**` + `Complete` in the traceability row -- `requirement-route-contract: RCOV-03: traceability route/status differs from sealed requirement contract`, exit 1; restored, exit 0, `Scope impact valid: 40 records.`"
        status: pass
    human_judgment: false
  - id: D7
    description: "The `direct-coverage` job behaves on a real GitHub Actions `pull_request` event"
    verification: []
    human_judgment: true
    rationale: "GitHub Actions cannot be exercised in this environment, so the job's first real execution is observed on the pull request. Whether `actions/checkout@v7` at `fetch-depth: 0` creates `refs/remotes/origin/main` on a `pull_request` event is assumption A1 and is mitigated rather than settled: the base-resolution step and the printed-base assertion turn a wrong assumption into a red job rather than a silent one-commit diff. A reviewer should confirm both assertions are present and that the job ran green for the right reason -- a green job whose log shows a one-commit diff would be the exact defect this phase exists to retire."

duration: 34min
completed: 2026-09-11
status: complete
---

# Phase 8 Plan 09: Wiring the Gate Summary

**The changed-pair direct-coverage gate now runs in two places it can catch a regression -- a dedicated CI job that asserts its own base twice and cannot report green through a masked pipeline, and a commit-scoped pre-commit hook -- and `CONTRIBUTING.md` states what each one costs using only numbers this phase measured.**

## Performance

- **Duration:** 34 min
- **Started:** 2026-09-11T13:22:00Z
- **Completed:** 2026-09-11T13:56:00Z
- **Tasks:** 3 of 3
- **Files modified:** 5 (1 created, 4 modified)

## What landed

### One implementation, two named bases

`package.json` gained exactly one `scripts` entry, `test:coverage:direct:commit`, whose value is
`node scripts/test-coverage-direct.mjs --base HEAD`. No dependency was added, removed or re-pinned;
`check` is byte-unchanged and the slow sweep stays out of it. The hook invokes that script and the
CI job invokes `test:coverage:direct` -- the same file, the same strictness, differing only in the
base each one names.

With base `HEAD`, the gate's branch-wide query (`${base}...HEAD`) resolves to nothing and the other
three queries answer the working tree, the index and the untracked files. The selection is the pairs
this commit touches, plus the pinned pairs the gate measures on every run regardless of the change
set. On this tree that reads:

```
Changed-pair base: HEAD
No changed source-test pairs. Passed over 16 changed path(s):
```

and then measures `bridges/commands/discover.ts` and `orchestrators/plugin/install-outcome.ts`
anyway, which is how the stale direction of the pin fires on a commit that names no pinned file.

### The hook

Appended after `npm-fallow`, in the shape the four siblings share -- `language: system`,
`pass_filenames: false`, single-quoted anchored `files:`:

```
^(extensions/pi-claude-marketplace/.*\.ts|tests/.*\.ts|scripts/revalidation\.mjs|scripts/test-coverage-direct\.pin\.json)$
```

The test-root alternative is `tests/.*\.ts`, wider than the gate's own correspondence rule, and the
comment above the hook records why: the gate passes over a non-test file under the test root with a
stated reason and resolves zero pairs in under a second, while an under-match would skip a changed
owner test and be indistinguishable from a pass. The pattern was verified against five in-scope
paths and three out-of-scope ones rather than eyeballed.

The `prettier` mirror hook's pin and all four existing `npm-*` hooks have no diff. The known
devDependency drift on that pin is real and is not this phase's obligation.

### The job

`direct-coverage`, `direct coverage (changed pairs, Node 24)`, `timeout-minutes: 20`, following the
four siblings' step order. Three things make it a measurement rather than a ritual:

1. **`fetch-depth: 0`.** At the default depth-1 clone `origin/main` does not exist, so the gate's
   ordered candidate chain falls through to `HEAD~1` and diffs one commit *while still reporting a
   resolved base*. `lint.yml`'s `fallow-audit` job is the in-repo precedent.
2. **Two assertions bracketing the gate.** `git rev-parse --verify origin/main^{commit}` before it
   measures anything, and a whole-line `grep -qx 'Changed-pair base: origin/main'` against the
   captured log afterwards. The first catches a checkout that did not produce the ref; the second
   catches a gate that resolved a different one.
3. **`set -o pipefail`, explicitly.** GitHub's default shell is `bash -e`, which does not set it.
   Without that line `npm run test:coverage:direct | tee coverage-direct.log` exits with tee's
   status and a red gate reports green -- a coverage job that has never failed.

`package` now reads `needs: [check, integration-tests, e2e-tests, direct-coverage]`, which is how
the other three gates are made authoritative.

### The documentation

`CONTRIBUTING.md`'s one forward-looking clause -- "Neither is wired yet; until they land, run the
changed-pairs sweep by hand before you open a pull request" -- is gone, which was 08-08's named
obligation on this plan. In its place the section names the job, what the job asserts about its own
base, that `package` depends on it, the hook, `pre-commit install`, and
`pre-commit run npm-coverage-direct --all-files` for exercising the hook without making a commit.

Every cost figure in the section is measured: 147 pairs and about six and a half minutes
branch-scoped on a long-lived branch, one focused test run per pair plus the pinned pairs
commit-scoped, around eight minutes for the whole tree. `D-08-17`'s "ten focused test runs" does not
appear. The `SKIP=npm-coverage-direct` escape is stated together with why it is written down rather
than left to be discovered, and `--no-verify` is still forbidden.

The reachability boundary is unchanged and unblurred: a complete reading says every arm ran under
the owner test, and says nothing about whether that test asserted anything worth asserting.

## Accomplishments

- **The gate's own CI assertion string was proved locally, not assumed.** `node
  scripts/test-coverage-direct.mjs --base origin/main` ran the full branch-scoped selection on this
  branch -- 147 pairs, exit 0 -- and `grep -qx 'Changed-pair base: origin/main'` matched its log.
  That is the same command and the same whole-line assertion the job performs, so the only thing
  left unproved about the job is the GitHub-side ref creation the two in-job assertions exist to
  catch. It also re-confirms the 147 figure `CONTRIBUTING.md` states.
- **A new hook was verified inside a green `--all-files` run.** 08-01's four-hook cleanup is what
  made this possible; `SKIP=trufflehog pre-commit run --all-files` exits 0 with 35 hooks and no
  `files were modified by this hook`, the new one included.
- **The `RCOV-03` seal constraint is a measured blocker, not a convention.** Planting
  `- [x] **RCOV-03**` and a `Complete` traceability row makes
  `node scripts/revalidation.mjs scope-impact --check` exit 1 with
  `requirement-route-contract: RCOV-03: traceability route/status differs from sealed requirement
  contract`. Restored, it prints `Scope impact valid: 40 records.` again. Nobody had written this
  down as a `CLOSE-01` obligation; it is now in "Next Phase Readiness" below.
- **`npm run check` exits 0 in 258 s** on the final tree -- typecheck, lint, fallow, format check,
  both corresponding gates, the direct-coverage negative harness, the unit suite and the integration
  suite.

## Task Commits

1. **Task 1: Add the commit-scoped npm script and the scoped local pre-commit hook** -- `52a88cb6`
   (ci)
2. **Task 2: Add the dedicated CI job with fail-closed base resolution and an asserted printed
   base** -- `42c03e9a` (ci)
3. **Task 3: State both gate scopes and both real costs in `CONTRIBUTING.md`** -- `6d5cb6a0` (docs)

## Files Created/Modified

**Created**

- `.planning/phases/08-direct-coverage/08-09-SUMMARY.md` -- this file.

**Modified**

- `package.json` -- one `scripts` entry, `test:coverage:direct:commit`, in alphabetical position
  between `:all` and `:negative`. No dependency change; `check` byte-unchanged.
- `.pre-commit-config.yaml` -- one local hook, `npm-coverage-direct`, plus its comment. Nothing else
  in the file has a diff.
- `.github/workflows/ci.yml` -- one job, `direct-coverage`, and one entry in `package`'s `needs:`.
  The `on:` block, both `paths-ignore` lists, `permissions`, `concurrency` and the other four jobs
  are otherwise unchanged.
- `CONTRIBUTING.md` -- §"Coverage sweeps" (retitled from "Coverage sweeps (manual)") and the
  opening sentence of §"The whole-tree report".

## Decisions Made

1. **`pipefail` with `tee`, not a bare file redirect.** The plan sanctioned either. The pipe keeps
   the gate's output in the job log where a failure is legible; the redirect would hide it in a file
   nobody reads on a red run. `pipefail` removes the only reason the pipe was wrong.
2. **The assertion step is a block scalar.** See deviation 1 -- the research block's literal form
   does not parse.
3. **`(manual)` came off the "Coverage sweeps" heading.** Two of the three commands now run without
   anyone remembering to invoke them, so the heading was a claim that had just become false. The
   whole-tree arm and the report are each still described as manual, with their own reasons.
4. **Three count-dependent sentences were corrected.** Adding a third sweep command made "Both stop
   at the first pair", "Only the two commands above" and "Because both sweeps stop" false. Each was
   rewritten to three. This is outside the plan's literal task list and inside its file.
5. **`RCOV-03` stays unchecked and `requirements.mark-complete` was not run.** See "Next Phase
   Readiness".

## Deviations from Plan

### 1. [Rule 1 - Bug] The research block's printed-base assertion is not valid YAML

- **Found during:** Task 2, at the first `pre-commit run --files .github/workflows/ci.yml`.
- **Issue:** `08-RESEARCH.md` §"Gate Wiring" gives the step literally as
  `run: grep -qx 'Changed-pair base: origin/main' coverage-direct.log`. A plain YAML scalar cannot
  contain `: `, so the parser reads the colon as a mapping indicator. `check-yaml`, `yamllint` and
  `yamlfmt` all failed identically: `mapping values are not allowed here, line 168, column 41`.
  Copied as written, the whole workflow file would have been unparseable -- every job in CI, not
  only the new one.
- **Fix:** The step's `run:` is a block scalar, with a one-line comment recording why. The grep
  command itself is byte-for-byte what the research specified, so the assertion the plan asked for
  is unchanged.
- **Files modified:** `.github/workflows/ci.yml`
- **Verification:** `check-yaml`, `yamllint` and `yamlfmt` all `Passed` with no rewrite; the
  extracted job still contains `Changed-pair base: origin/main`.
- **Committed in:** `42c03e9a`

### 2. [Rule 1 - Bug] Three `CONTRIBUTING.md` sentences counted two sweeps

- **Found during:** Task 3, after adding `test:coverage:direct:commit` to the command block.
- **Issue:** "Both stop at the first pair that falls short", "Only the two commands above decide
  whether coverage is complete", and "Because both sweeps stop at the first shortfall" were each
  written against two sweep commands. The plan's own task adds a third. Left alone, the file would
  have gained three new false claims in the commit that removed its last one.
- **Fix:** Each rewritten to name three. The claims themselves are unchanged and still true of the
  new command: `test:coverage:direct:commit` is the same script, so it stops at the first shortfall
  and compares against the pin like the others.
- **Files modified:** `CONTRIBUTING.md`
- **Verification:** `pre-commit run --files CONTRIBUTING.md` exits 0; the needle check passes.
- **Committed in:** `6d5cb6a0`

---

**Total deviations:** 2 (both Rule 1)
**Impact on scope:** None. Both fixes are inside files the plan already owns, and neither changes
what the plan asked for -- one is the same command in a parseable wrapper, the other is the same
claims with a corrected count.

## Verification

| check | result |
|---|---|
| `npm run test:coverage:direct:commit` | exit 0, prints `Changed-pair base: HEAD`, both pinned pairs measured |
| hook `files:` pattern, 5 in-scope + 3 out-of-scope paths | `hook pattern matches 5 scoped paths and none of 3 out-of-scope paths` |
| `SKIP=trufflehog pre-commit run npm-coverage-direct --all-files` | exit 0, `Passed` |
| `SKIP=trufflehog pre-commit run --all-files` | **exit 0** -- 35 hooks, no `files were modified by this hook` |
| `SKIP=trufflehog pre-commit run --files .github/workflows/ci.yml` | exit 0, `check-yaml` / `yamllint` / `yamlfmt` all `Passed`, no rewrite |
| extracted `direct-coverage` job block | non-empty; carries `fetch-depth: 0`, `rev-parse --verify origin/main`, `Changed-pair base: origin/main`, `npm run test:coverage:direct` |
| `tee` present implies `pipefail` present | both present |
| `package`'s `needs:` | `[check, integration-tests, e2e-tests, direct-coverage]` |
| `git rev-parse --verify origin/main^{commit}` | `42a2886a`, exit 0 |
| `node scripts/test-coverage-direct.mjs --base origin/main` | **exit 0** -- 147 pairs measured, 0 refused; `grep -qx 'Changed-pair base: origin/main'` matches |
| `CONTRIBUTING.md` needle + negative check | all seven needles present; no `ten focused test runs`; no `Neither is wired yet` |
| `SKIP=trufflehog pre-commit run --files` (all four plan files) | every hook `Passed`, no `files were modified by this hook` |
| `node scripts/revalidation.mjs scope-impact --check` | `Scope impact valid: 40 records.`, exit 0 |
| planted `RCOV-03` completion, then restored | exit 1 `requirement-route-contract: RCOV-03`; restored clean, exit 0 |
| `npm run check` | **exit 0** in 258 s |

`trufflehog` is skipped for the reason 08-01 recorded and `CLAUDE.md` prescribes, and it was
re-confirmed on this tree rather than assumed: `pre-commit run trufflehog --all-files` fails with
`failed to read index file: /home/.../.git/index: not a directory`, because this checkout is a
linked worktree and `<root>/.git` is a file. It modifies nothing -- `git status` is unchanged after
the run. CI's Lint job runs `pre-commit run --all-files` without the skip, on a normal full clone
where the hook works.

## Issues Encountered

- **`.planning/WINDOWS.md` is still unwritable.** `gsd-tools windows append` for this plan's
  outstanding observation refused with the same rows 9 and 30 table/JSON desync that blocked 08-02
  and 08-08, a disagreement predating this phase. The ledger append is best-effort and does not
  block execution, so the observation is recorded here and in `deferred-items.md`'s existing
  operator-routed item instead.
- **The branch-scoped arm is serial time, not time to work in.** The `--base origin/main` run
  measures 147 pairs. It was run in the background while `CONTRIBUTING.md` and the workflow were
  edited, which is safe only because neither file is a pair the gate measures --
  `scripts/revalidation.mjs` is, and editing it mid-run would have failed that pair and reported it
  as a coverage failure (08-08 recorded the same hazard).

## Next Phase Readiness

- **`CLOSE-01` inherits a hard blocker nobody had written down: `RCOV-01`, `RCOV-02` and `RCOV-03`
  cannot be marked complete one at a time.** `SEALED_REQUIREMENT_ROUTES` in
  `scripts/revalidation.mjs` pins all three at `Phase 8` / `Pending`, and
  `validateRequirementDisposition` compares the live traceability row against it. This was proved by
  planting, not by reading the table: setting `RCOV-03` to `- [x]` and `Complete` makes
  `scope-impact --check` exit 1 with `requirement-route-contract: RCOV-03: traceability route/status
  differs from sealed requirement contract`. Closing the milestone therefore needs a **coordinated**
  change -- the three checkboxes, the three traceability rows, the sealed route entries, and any
  clause signature the edit disturbs -- landed together. `requirements.mark-complete` was
  deliberately not run by this plan.
- **The `direct-coverage` job has never executed.** Its first real run is on the pull request.
  Two things to look for in that first run rather than accepting a green tick: that the
  "Assert the base candidate resolved" step passed (which settles assumption A1 -- whether
  `actions/checkout@v7` at `fetch-depth: 0` creates `refs/remotes/origin/main` on a `pull_request`
  event), and that the gate's log line reads `Changed-pair base: origin/main` rather than a commit
  sha. A green job that diffed one commit is the defect class this phase exists to retire.
- **"Authoritative" is only partly discharged, and deliberately so.** The phase's edge-coverage
  probe left one `RCOV-03` row `unresolved`, and it stays unresolved. This plan makes the job
  authoritative the way the other three gates are -- `package` depends on it -- but whether it is
  also a *required status check* on the protected branch is a GitHub repository setting that lives
  outside any tracked file. No plan task can satisfy it. If the developer reads `RCOV-03` as
  requiring that setting too, it is a repository-settings change and a follow-on item, not
  something this phase closed.
- **The hook does not fire until someone runs `pre-commit install`.** This checkout's `.git/hooks`
  holds only `post-*` and `pre-push`, so the hook was verified by direct invocation rather than by
  committing. `CONTRIBUTING.md` now says so, and the "Development setup" block already lists the
  install command.

---
*Phase: 08-direct-coverage*
*Completed: 2026-09-11*

## Self-Check: PASSED

All five named artifacts exist on disk and all three task commits resolve in `git log`.
