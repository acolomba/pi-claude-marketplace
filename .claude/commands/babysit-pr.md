---
description: After a PR is opened (e.g. by /gsd:ship), drive it to a clean state — pass the pr-review-toolkit review and get the SonarQube PR quality gate green — with the heavy work delegated to subagents. Invoke manually; not automatic.
argument-hint: "[PR number] (defaults to the current branch's PR)"
allowed-tools: Bash, Read, Edit, Write, Grep, Glob, Task, SlashCommand, mcp__sonarqube__*
---

# Babysit PR

Take an already-open pull request and harden it in two phases: a local **review-convergence** loop, then a **SonarQube** pass once CI has analyzed the pushed head. The point is to hand a human reviewer a PR that already clears the automated bars, with the expensive review and fixing done in subagents rather than in this conversation's context.

Invoke this yourself after the PR exists (`$ARGUMENTS` is an optional PR number; default to the current branch's PR). It is safe to re-run — a clean PR converges to a no-op.

## Phase 0 — Resolve the PR

Run `gh pr view $ARGUMENTS --json number,headRefName,url,state`. If there is no open PR for this branch, stop and say so — this command hardens an existing PR, it does not create one. Record the PR number and head branch.

## Phase 1 — Review convergence (local, fast)

Converge the PR's diff to review-clean before Sonar even runs. One review pass is never enough — reviewers miss things, fixes introduce new problems, and the only way to know a fix worked is to review again — so this is a bounded loop:

1. **Scope.** Review the PR's changes: the branch's commits versus its base (merge-base with `main`) plus any uncommitted work. If there is nothing to review, skip to Phase 2.
2. **Review.** Run `/pr-review-toolkit:review-pr` over all applicable aspects. Its specialized reviewers run as subagents. It sorts findings into **Critical** (must fix), **Important** (should fix), **Suggestions** (advisory), and **Strengths**.
3. **Triage.** Separate Critical + Important (actionable now) from Suggestions (advisory — these never block finishing).
4. **Fix, one cause at a time.** Address each Critical and Important finding at its root. Fix the actual defect; do not silence the reviewer with a blanket lint-disable or by deleting the test that caught it. After each fix, run the project's checks (`npm run check` and the pre-commit hooks) so a fix cannot quietly break the build, then commit it atomically. Never `--no-verify`. Delegate independent fixes to subagents.
5. **Re-review.** Return to step 2. The re-review is the point: it confirms the fixes landed and catches anything they introduced.
6. **Finish on advisory-only.** When a review returns no Critical or Important findings, make one pass over the Suggestions — apply the ones that clearly improve the code, and note in one line why you leave the rest — then stop. Optionally run the `simplify` aspect as a final polish; the toolkit is built to run that once a change passes review.

Cap at about four fix rounds. If a round does not reduce the combined Critical and Important count, or a just-fixed finding reappears, stop and report rather than thrash.

Push the resulting commits so the PR head updates — that push is what kicks CI and SonarCloud for Phase 2.

## Phase 2 — SonarQube hardening (async, gated on CI)

Sonar findings only exist **after** CI runs `sonarcloud.yml` on the pushed head, so this phase waits on CI before it can act.

1. **Wait for analysis.** Poll `gh pr checks` until the SonarCloud check completes (bounded — give up after ~15 min and report). Then confirm the PR analysis is live via `list_pull_requests` (project key `acolomba_pi-claude-marketplace`) and read the gate with `get_project_quality_gate_status` (pass the PR key, not the branch name).

2. **Read the PR-scoped findings** (fan out to subagents where it helps — one per concern):
   - Violations: `search_sonar_issues_in_projects` with the PR key.
   - Duplication: `get_duplications` / `search_duplicated_files`.
   - Coverage: `get_file_coverage_details` / `search_files_by_coverage`.

3. **Address, one subagent per cluster of related work:**
   - **Violations** — fix each at its root. Do not change an issue's status to won't-fix/false-positive to move the gate; fix the code.
   - **Duplication** — collapse it only where a shared helper genuinely reads better. Do not extract abstractions purely to lower a percentage.
   - **Coverage** — raise *new-code* coverage toward 100% within reason: add real tests for uncovered new lines, and stop at unreachable/defensive branches and eslint-ignored platform code (e.g. `pi-api.ts`). Gate-green is the target, not a vanity number.

4. **Commit atomically** (never `--no-verify`), push, and re-wait for re-analysis.

5. **Repeat 1–4** until the PR quality gate is green or a round makes no net progress. Cap at ~3 Sonar rounds — non-convergence means a human should look, not that you should grind.

## Guards

- **Bounded everywhere.** Cap the Phase 1 review rounds and the Phase 2 Sonar rounds. On oscillation or a no-progress round, stop and report rather than loop.
- **Never bypass hooks.** Every commit passes pre-commit; a failing hook is a defect to fix, not to `--no-verify` past.
- **Don't game either system.** No won't-fix flips, no blanket lint-disables, no deleting the test that caught the problem.
- **Autonomous but bounded.** This pushes fixes straight to your open PR without stopping to ask (that is what "babysit" means here). There is no branch protection on this repo, so treat the caps and the no-gaming rules as the real safety net. If it cannot converge within the caps, it stops and hands you a summary.
- **Subagents carry the weight.** Keep this orchestration turn lean: the review, the fixing, and the Sonar remediation happen in spawned subagents, so their transcripts stay out of the main context.

## Finish

Report: how many review rounds and what was fixed; the final Sonar gate status; violations fixed, duplication changes, and the coverage delta; and anything left unresolved with a one-line reason.
