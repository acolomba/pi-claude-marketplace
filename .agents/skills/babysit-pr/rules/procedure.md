# Babysit PR: procedure

Part of the `babysit-pr` skill: `.agents/skills/babysit-pr/SKILL.md`.

## Phase 0 -- Resolve the PR

Run `gh pr view <number> --json number,headRefName,url,state` with the PR number the skill was given, or without a number for the current branch's PR. If there is no open PR for this branch, stop and say so -- this skill hardens an existing PR, it does not create one. Record the PR number and head branch.

## Phase 1 -- Review convergence (local, fast)

Converge the PR's diff to review-clean before Sonar even runs. One review pass is never enough -- reviewers miss things, fixes introduce new problems, and the only way to know a fix worked is to review again -- so this is a bounded loop:

1. **Scope.** Review the PR's changes: the branch's commits versus its base (merge-base with `main`) plus any uncommitted work. List the changed files (`git diff --name-only --diff-filter=d <merge-base>` plus `git status --short`) and note the `.ts` subset and the `features/` subset -- they drive step 2. If there is nothing to review, skip to Phase 2.

2. **Project skill loop.** Converge every changed `.ts` file and every changed file under `features/` against the project skills before the broader review runs. Each subagent reads the skill's `SKILL.md`, then the rules files it points to for the files under review. Route each file by kind:

   - `.agents/skills/typescript-style/SKILL.md` for every changed `.ts` file.
   - `.agents/skills/typescript-unit-tests/SKILL.md` for every changed `test/**/*.ts` file, and for every changed production module together with its paired test (`extensions/pi-claude-marketplace/.../x.ts` ↔ `test/.../x.test.ts`) -- it reviews the pair, so send a source module and its test to the same subagent.
   - `.agents/skills/cucumber/SKILL.md` for every changed file under `features/`, feature files included. Send a feature file and the step modules its scenarios use to the same subagent.

   Batch units (files or source-test pairs) into groups of 5-10 per subagent instead of one per file -- group by module/directory where the split allows it, sizing toward 5 for large or complex files and toward 10 for small ones, so a large PR does not spend its context on a subagent per file. Spawn one subagent per batch, in parallel only over disjoint file sets. Each subagent loops over its batch: run the applicable skill(s) on each file, fix every finding at its root, run the skill again, and stop on a file only when the skill comes back clean for it -- cap three passes per file. A subagent edits only its own files and does not commit; when the batch returns, run the project's checks once and commit the pass, staging explicit paths (never `git add -A`). A file that has not converged after three passes is reported, not ground on.

3. **Toolkit review.** Run `/pr-review-toolkit:review-pr` over all applicable aspects. Its specialized reviewers run as subagents. It sorts findings into **Critical** (must fix), **Important** (should fix), **Suggestions** (advisory), and **Strengths**.

4. **Triage.** Separate Critical + Important (actionable now) from Suggestions (advisory -- these never block finishing).

5. **Fix, one cause at a time.** Address each Critical and Important finding at its root. Fix the actual defect; do not silence the reviewer with a blanket lint-disable or by deleting the test that caught it. After each fix, run the project's checks (`npm run check` and the pre-commit hooks) so a fix cannot quietly break the build, then commit it atomically. Never `--no-verify`. Delegate independent fixes to subagents.

6. **Re-review.** Return to step 2 for every `.ts` file and `features/` file the fixes touched, then to step 3. The re-review is the point: it confirms the fixes landed and catches anything they introduced.

7. **Finish on advisory-only.** When the skill loop is clean for every changed file and the toolkit review returns no Critical or Important findings, make one pass over the Suggestions -- apply the ones that clearly improve the code, and note in one line why you leave the rest -- then stop. Optionally run the `simplify` aspect as a final polish; the toolkit is built to run that once a change passes review.

Cap at about four fix rounds. If a round does not reduce the combined Critical and Important count, or a just-fixed finding reappears, stop and report rather than thrash.

Push the resulting commits so the PR head updates -- that push is what kicks CI and SonarCloud for Phase 2.

## Phase 2 -- SonarQube hardening (async, gated on CI)

Sonar findings only exist **after** CI runs `sonarcloud.yml` on the pushed head, so this phase waits on CI before it can act.

1. **Wait for analysis.** Poll `gh pr checks` until the SonarCloud check completes (bounded -- give up after ~15 min and report). Then confirm the PR analysis is live via `list_pull_requests` (project key `acolomba_pi-claude-marketplace`) and read the gate with `get_project_quality_gate_status` (pass the PR key, not the branch name).

2. **Read the PR-scoped findings** (fan out to subagents where it helps -- one per concern):

   - Violations: `search_sonar_issues_in_projects` with the PR key.
   - Duplication: `get_duplications` / `search_duplicated_files`.
   - Coverage: `get_file_coverage_details` / `search_files_by_coverage`.

3. **Address, one subagent per cluster of related work:**

   - **Violations** -- fix each at its root. Do not change an issue's status to won't-fix/false-positive to move the gate; fix the code.
   - **Duplication** -- collapse it only where a shared helper genuinely reads better. Do not extract abstractions purely to lower a percentage.
   - **Coverage** -- raise *new-code* coverage toward 100% within reason: add real tests for uncovered new lines, and stop at unreachable/defensive branches and eslint-ignored platform code (e.g. `pi-api.ts`). Gate-green is the target, not a vanity number.

4. **Commit atomically** (never `--no-verify`), push, and re-wait for re-analysis.

5. **Repeat 1-4** until the PR quality gate is green or a round makes no net progress. Cap at ~3 Sonar rounds -- non-convergence means a human should look, not that you should grind.

## Phase 3 -- Milestone closeout (last, when the branch ships a milestone)

Close the milestone only after Phases 1 and 2 have stopped changing code. A closeout written earlier goes stale: later fixes, a deferred UAT that passes, or a PR number nobody recorded leave the archive describing a head that no longer exists. Skip this phase if Phase 1 or 2 stopped without converging -- a PR that still needs a human is not ready to close.

1. **Detect.** The branch ships a milestone when it carries live phase directories: `node .claude/gsd-core/bin/gsd-tools.cjs query init.milestone-op` (add `--ws <name>` when `.planning/workstreams/<name>/` exists) reports `phases_dir_exists: true` and `phase_count > 0`. If it carries none and STATE.md reads "Awaiting next milestone", the milestone is already closed -- skip to step 4.

2. **Run the phase-scoped gates before anything is archived.** Archiving moves the phase directories, and these commands cannot find an archived phase afterwards.

   - `/gsd-audit-uat`. If any UAT item is still `testing` or `pending` and the operator has not deferred it in writing, stop and report: a live UAT needs a human, so this phase cannot pass it for them.
   - `/gsd-secure-phase N` and `/gsd-validate-phase N` for each phase that has no `*-SECURITY.md` or no Nyquist validation.

3. **Close, in this order:**

   1. `/gsd-audit-milestone`. Read the status from the audit file you wrote; do not trust a workflow's grep of a guessed path. `gaps_found` stops the phase and is reported.
   2. `/gsd-complete-milestone`. Skip its git tag: tags here mark package releases, not milestones. Then do what the command leaves undone: reorganize ROADMAP.md, move PROJECT.md's milestone from Current to Previous, add the RETROSPECTIVE.md section, `git rm` the live REQUIREMENTS.md, stage the deletions it leaves at the original paths (`git add -u` on those paths only), and correct the dates it stamps.
   3. `/gsd-cleanup`. It archives any phase directory `complete-milestone` left behind; a no-op is the expected result.

4. **Consistency sweep.** `complete-milestone` checks none of these, and each one has drifted on a past close. Fix every hit:

   - No `HANDOFF*.md` or `HANDOFF*.json` at the `.planning/` root. Move each into `.planning/milestones/` with the milestone prefix, and repoint live references to it.
   - Every ROADMAP.md "Carried Forward" item still matches the status in the file it cites (a UAT that is now `complete` is not carried forward).
   - The milestone entries in ROADMAP.md, MILESTONES.md, PROJECT.md and RETROSPECTIVE.md name this PR's number. The merge date and squash SHA do not exist yet; record them after the merge, not here.
   - Every UAT exception or override in the audit is either still open or has a resolution note.
   - STATE.md's Current Position and frontmatter (`status`, `stopped_at`) describe the closed milestone, not the last phase.

5. **Commit and push.** Stage explicit paths, run pre-commit, commit (never `--no-verify`), and push. The closeout is planning-only, so it does not reopen Phase 2; confirm `gh pr checks` still passes and stop.

## Guards

- **Bounded everywhere.** Cap the per-file skill passes, the Phase 1 review rounds, and the Phase 2 Sonar rounds. On oscillation or a no-progress round, stop and report rather than loop.
- **Closeout runs last and once.** Phase 3 never runs while Phases 1 or 2 still change code. On a re-run against an already-closed milestone, only the step 4 sweep runs.
- **Never bypass hooks.** Every commit passes pre-commit; a failing hook is a defect to fix, not to `--no-verify` past.
- **Don't game either system.** No won't-fix flips, no blanket lint-disables, no deleting the test that caught the problem.
- **Autonomous but bounded.** This pushes fixes straight to your open PR without stopping to ask (that is what "babysit" means here). There is no branch protection on this repo, so treat the caps and the no-gaming rules as the real safety net. If it cannot converge within the caps, it stops and hands you a summary.
- **Subagents carry the weight.** Keep this orchestration turn lean: the skill passes, the review, the fixing, and the Sonar remediation happen in spawned subagents, so their transcripts stay out of the main context.

## Finish

Report: how many review rounds and what was fixed, including which files the skill loop touched and any that did not converge; the final Sonar gate status; violations fixed, duplication changes, and the coverage delta; whether a milestone was closed, which sweep items needed fixing, and what still needs recording after the merge; and anything left unresolved with a one-line reason.
