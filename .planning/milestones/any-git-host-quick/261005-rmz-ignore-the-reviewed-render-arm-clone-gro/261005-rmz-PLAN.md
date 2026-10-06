---
phase: 261005-rmz
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - extensions/pi-claude-marketplace/orchestrators/marketplace/update.messaging.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.messaging.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.messaging.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/update.messaging.ts
  - .planning/codebase/CONVENTIONS.md
autonomous: true
requirements: [RMZ-01, RMZ-02, RMZ-03]

estimate:
  tokens: 45000
  raw_tokens: 45000
  tasks: 1
  confidence: low

must_haves:
  truths:
    - "RMZ-01: `npx fallow dupes --format json` reports no clone instance that spans the `skipped:` arm of UPDATE_CONTEXT.render, ENABLE_RENDER, REINSTALL_RENDER, or UPDATE_RENDER (the three reviewed render-arm groups), and still reports the enable-disable/install and enable-disable/fetch messaging groups."
    - "RMZ-01: `npx fallow audit --base origin/main --format json --quiet` returns verdict `pass`."
    - "RMZ-01: `.fallowrc.json` is unchanged; `duplicates.ignoredClones` still equals the single canary key, and no run-indexed `-rN` handle is used anywhere."
    - "RMZ-02: each of the four messaging files has exactly one `fallow-ignore-next-line code-duplication -- <reason>` marker, directly above its render map's `skipped:` arm, with the same reason text in all four files."
    - "RMZ-03: `.planning/codebase/CONVENTIONS.md` states the marker count that `rg -n \"fallow-ignore\" extensions tests scripts` prints, names the four code-duplication markers, and explains why these groups have no stable `ignoredClones` key."
    - "`npm run fallow` exits 0, the commit hook passes, and `npm run check` exits 0 on the final tree."
  artifacts:
    - path: extensions/pi-claude-marketplace/orchestrators/marketplace/update.messaging.ts
      provides: "marker above the `skipped:` arm of UPDATE_CONTEXT.render"
      contains: "fallow-ignore-next-line code-duplication -- reviewed: "
    - path: extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.messaging.ts
      provides: "marker above the `skipped:` arm of ENABLE_RENDER (DISABLE_RENDER stays unmarked)"
      contains: "fallow-ignore-next-line code-duplication -- reviewed: "
    - path: extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.messaging.ts
      provides: "marker above the `skipped:` arm of REINSTALL_RENDER"
      contains: "fallow-ignore-next-line code-duplication -- reviewed: "
    - path: extensions/pi-claude-marketplace/orchestrators/plugin/update.messaging.ts
      provides: "marker above the `skipped:` arm of UPDATE_RENDER"
      contains: "fallow-ignore-next-line code-duplication -- reviewed: "
    - path: .planning/codebase/CONVENTIONS.md
      provides: "Fallow duplication and Suppressions bullets that match the new markers"
      contains: "fallow-ignore-next-line code-duplication"
  key_links:
    - from: "each marker line"
      to: "fallow's line-suppression filter (apply_line_suppressions)"
      via: "a code-duplication next-line marker drops every clone instance whose span contains the following line; a group left with fewer than two instances is dropped"
      pattern: "fallow-ignore-next-line code-duplication"
    - from: "the ` -- <reason>` text of each marker"
      to: "`require-suppression-reason: error` in .fallowrc.json"
      via: "`fallow dead-code`, inside `npm run fallow`, fails on a marker without a reason"
      pattern: "code-duplication -- "
---

# Quick 261005-rmz: Hide the reviewed render-map arm clone groups from fallow

This plan replaces the requested `duplicates.ignoredClones` route with inline suppressions (option A of the planner checkpoint). Fallow 3.27.0 (local) and 3.28.0 (the CI action) give these three groups no stable key, and their run-indexed handle cannot serve as one. Background records the evidence.

<objective>
Hide the three reviewed render-map arm clone groups from fallow for good, and hide nothing else, so `npx fallow audit --base origin/main` returns `pass` and the CI `fallow-audit` job stops failing on `warn`.

Each file that a target group spans gets one `// fallow-ignore-next-line code-duplication -- <reason>` marker, directly above its render map's `skipped:` arm. The marker's reason carries the review's justification. `.fallowrc.json` does not change. CONVENTIONS.md records why these groups cannot go in `duplicates.ignoredClones` and lists the new markers.

Purpose: a comment-only change inside the clone span in `orchestrators/marketplace/update.messaging.ts` (a decision-ID rename) makes the audit report the group as introduced, and the CI job fails on any `warn`. The user reviewed these arms (per-command typed render-map wiring over shared composers) and wants them ignored permanently.

Output: four one-line markers, two rewritten CONVENTIONS.md bullets, one commit.
</objective>

<execution_context>
@.claude/gsd-core/workflows/execute-plan.md
@.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@skills/local-verification/SKILL.md
@skills/typescript-comments/SKILL.md
@.fallowrc.json
</context>

## Background (planner evidence: fallow 3.27.0, HEAD a01df2bc, origin/main 6fc114b4)

- **No stable key exists for these groups.** Fallow fingerprints a clone group by parsing each instance's fragment as a standalone `fragment.ts` (`hash_instances` in `crates/engine/src/duplication_detector/deepdive.rs`; v3.27.0 and v3.28.0 are identical here). These fragments start and end mid-expression (`),` through `}`), so the parse yields no tokens, and every such group gets the same 64-bit hash. 40 of the repo's 42 groups share it. Fallow gives each group in that bucket a `dup:<16 hex>-rN` handle whose ordinal counts the groups in the current report. `duplicates.ignoredClones` matches exactly `<that handle>:<instance count>`, so no 8-hex key exists for these groups.
- **A run-indexed handle cannot serve as the key.** `fallow dupes` reports all groups and numbers the flagged group `-r24`. `fallow audit` reports only the groups that touch changed files and numbers the same group `-r12`. Scratch-config test: the `-r24` key hides it from `fallow dupes`, but the audit still returns `warn` and hides `orchestrators/plugin/shared.ts:311-327 + 968-980` instead. The `-r12` key makes the audit pass, but `fallow dupes` then hides the unrelated `bridges/commands/stage.ts:290-303 + bridges/skills/stage.ts:398-408` group and still lists the render-arm one.
- **Target groups** (full `fallow dupes` run at a01df2bc; the handles identify them for that run only):
  - `-r24`: `orchestrators/marketplace/update.messaging.ts:86-95` + `orchestrators/plugin/enable-disable.messaging.ts:88-93`. The audit flags this one as introduced.
  - `-r38`: `marketplace/update.messaging.ts:92-94` + `plugin/enable-disable.messaging.ts:90-92` + `plugin/reinstall.messaging.ts:86-90`.
  - `-r10`: `plugin/enable-disable.messaging.ts:86-91` + `plugin/update.messaging.ts:68-77`.
  - No other group consists only of render-map arms. Two neighbours must stay reported: `plugin/enable-disable.messaging.ts:79-90 + plugin/install.messaging.ts:108-123` (map head and `installed` arm) and `plugin/enable-disable.messaging.ts:109-121 + plugin/fetch.messaging.ts:78-94` (DISABLE_RENDER and FETCH_RENDER arms plus the `*_CONTEXT` export).
- **Placement.** Fallow drops a clone instance when any line in its span is suppressed, and it drops a group left with fewer than two instances. At a01df2bc the `skipped:` arm lines (93, 91, 89, 77) lie inside every instance of the three targets and inside no other group. In `enable-disable.messaging.ts`, the `"partially-installed":` line is also inside the map-head neighbour, and the `skipped:` arm of `DISABLE_RENDER` (line 110) is inside the fetch neighbour. Neither of those lines may carry the marker.
- **Validated** in a throwaway clone at a01df2bc with the exact marker text from Task 1: `fallow dupes` went from 42 to 39 groups (exactly the three targets), both neighbours stayed listed, `fallow audit --base origin/main` returned `pass` with no introduced group, `fallow dead-code --fail-on-issues` exited 0, and the `<verify>` chain passed up to its CONVENTIONS.md greps (not run there). A marker without ` -- <reason>` fails `fallow dead-code` (`require-suppression-reason: error`). A misplaced `code-duplication` marker is not reported stale, because fallow leaves this kind out of its stale check.

Plan-local labels (RMZ-0N, T-rmz-NN, "option A") never go in a file, a comment, or the commit message. The quick ID `261005-rmz` appears only in the summary.

## Source coverage

| Source | Item | Status |
| --- | --- | --- |
| GOAL | Ignore the reviewed render-arm clone groups in fallow, permanently, and nothing else | COVERED by Task 1 (RMZ-01) |
| SCOPE 1 | Add each group to `duplicates.ignoredClones` with a stable `dup:<fingerprint>:<count>` key, never a `-rN` handle | REPLACED: infeasible in fallow 3.27.0 and 3.28.0 (Background); inline markers instead, per the planner checkpoint (RMZ-01) |
| SCOPE 2 | One justification comment per spanned file, per the comments skill; update CONVENTIONS.md | COVERED (RMZ-02, RMZ-03). No key exists to cite, so each marker's reason carries the justification |
| SCOPE 3 | `npm run fallow` exits 0 and the groups are unlisted; audit verdict `pass`; `npm run check` | COVERED (`<verify>`, Steps 4 and 6) |
| SCOPE | Concurrent session: stage named files only; Conventional Commits; pre-commit; foreground commit; no push or PR; REVIEW.md untouched | COVERED (Step 5) |

<tasks>

<task type="auto">
  <name>Task 1: Suppress the three reviewed render-arm clone groups inline and document the rule</name>
  <files>extensions/pi-claude-marketplace/orchestrators/marketplace/update.messaging.ts, extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.messaging.ts, extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.messaging.ts, extensions/pi-claude-marketplace/orchestrators/plugin/update.messaging.ts, .planning/codebase/CONVENTIONS.md</files>
  <read_first>
    - The render map in each messaging file: UPDATE_CONTEXT.render (lines 64-96 at a01df2bc), ENABLE_RENDER (79-93) and DISABLE_RENDER (108-112), REINSTALL_RENDER (73-93), UPDATE_RENDER (57-90)
    - .planning/codebase/CONVENTIONS.md: the two Fallow bullets that start with "`duplicates.threshold: 3`" and "Suppressions:" (lines 66-67 at a01df2bc)
    - skills/typescript-comments/SKILL.md and skills/local-verification/SKILL.md
  </read_first>
  <action>
Step 1, baseline (read-only). Run `npx fallow dupes --format json --no-fragments --quiet` and find the three target groups listed in Background. Match them by file set and by the arms they span, because line numbers can drift. If a target is gone, or another group made only of render-map arms appears, stop and report. Do not widen the scope.

Step 2, markers (RMZ-01, RMZ-02). In each file, insert one line directly above the render map's `skipped: (p, probe, mpScope) => pluginRow(ICON_UNINSTALLABLE, p, mpScope, "(skipped)", probe),` arm, at that arm's indentation:
- `orchestrators/marketplace/update.messaging.ts`: the arm in `UPDATE_CONTEXT.render`, line 93 at a01df2bc, 4-space indent, right after the `"partially-installed"` arm.
- `orchestrators/plugin/enable-disable.messaging.ts`: the arm in `ENABLE_RENDER`, line 91, 2-space indent, right after its `"partially-installed"` arm. Leave the `skipped:` arm in `DISABLE_RENDER` (line 110) unmarked.
- `orchestrators/plugin/reinstall.messaging.ts`: the arm in `REINSTALL_RENDER`, line 89, 2-space indent, right after the `reinstalled` arm's closing `),`.
- `orchestrators/plugin/update.messaging.ts`: the arm in `UPDATE_RENDER`, line 77, 2-space indent, right after its `"partially-installed"` arm.

The inserted text is the same in all four files, on one line, with ASCII hyphens: `// fallow-ignore-next-line code-duplication -- reviewed: per-command typed render-map arms are one-line calls to shared row composers; extracting them needs a cross-command generic.`

The reason restates the user's review in the style of skills/typescript-comments/SKILL.md: present tense, no GSD references. Change nothing else in these files. Do not edit `.fallowrc.json`: `duplicates.ignoredClones` keeps only its canary key, and no run-indexed `-rN` handle goes anywhere, because Background shows that such a handle hides the wrong group in one of the two reports.

Step 3, CONVENTIONS.md (RMZ-03). Edit only the two Fallow bullets named in read_first, and keep every other line.
- Duplication bullet: keep its opening about the single `ignoredClones` entry and the canary comment headers. Replace its bold closing sentence with these facts, in the bullet's style. An `ignoredClones` key is the group's report fingerprint plus its instance count, `dup:<fingerprint>:<count>`. Fallow hashes each clone fragment as a standalone file, so a fragment that starts or ends mid-expression yields no tokens, all such groups share one hash, and fallow tells them apart with a `dup:<16 hex>-rN` handle numbered per report; `fallow dupes` and `fallow audit` number the same group differently. A `-rN` or `-NN` handle is never a key, because it matches a different group in the other report. A reviewed group of this kind gets an inline marker (see Suppressions).
- Suppressions bullet: set the count to what `rg -n "fallow-ignore" extensions tests scripts | wc -l` prints after Step 2 (14 at a01df2bc: the 10 listed plus 4). Add that four are `fallow-ignore-next-line code-duplication`, one above the `skipped:` arm of the render map in each of `orchestrators/marketplace/update.messaging.ts` and `orchestrators/plugin/{enable-disable,reinstall,update}.messaging.ts`, and that they hide the reviewed render-arm clone groups, which have no stable `ignoredClones` key. Add that such a marker hides every clone instance whose span contains the next line, and that fallow never reports a `code-duplication` marker as stale; so when one of these render maps changes, delete its marker, run `npx fallow dupes`, and restore the marker only above an arm that the reviewed groups still span. Replace the closing sentence that rules out suppressed complexity and duplication findings with one that rules out only suppressed complexity findings. Keep the sentence that every marker carries a `--` justification.

Step 4, verify before committing. Run the `<verify>` chain from the repo root. It must print `dupes ok` and `audit pass`, and its last command, `npm run fallow`, must exit 0. `npm run fallow` hides the dupes report locally, so the chain reads `fallow dupes --format json` for the listing. If the audit verdict is not `pass`, read the `introduced: true` entries in `duplication.clone_groups` and the `dead_code` and `complexity` sections. If the cause lies outside the four render maps, for example a change the concurrent session committed, stop and report it; do not fix it in this task.

Step 5, commit. Another session commits to this branch at the same time, on other files. Stage only the five files, by explicit path; never run `git add -A` or `git add .`, and expect HEAD to move. Run `SKIP=npm-check pre-commit run --files` with the five paths. If a fixer rewrites a file, restage it and rerun until clean. Then run `git commit` in the foreground with the longest tool timeout; its hook runs `npm run check:commit`, because the `.ts` files are build inputs. Never pass `--no-verify` or `--amend`. If the hook fails, the commit did not happen: fix the cause, restage, and commit again. Title: `build(fallow): suppress the reviewed render-map clone groups`. Body, in lines of 80 columns or fewer: fallow gives these clone groups no stable ignoredClones key (their fragments do not parse alone, so they share one hash and get per-report -rN handles), so each spanned file carries a reasoned code-duplication marker above its render map's skipped arm, and CONVENTIONS.md records the rule. End with the attribution trailer that your session instructions specify. Put no GSD milestone, phase, plan, or quick-task reference in the message. Do not push, do not open a PR, and do not touch REVIEW.md.

Step 6, full gate. On the committed tree, run `npm run check; echo "exit=$?"` as its own command. Record the exit status, the commit SHA, and `node --version` in the summary. The exit status must be 0.
  </action>
  <verify>
    <automated>[ "$(rg -c 'fallow-ignore-next-line code-duplication -- reviewed: ' extensions tests scripts | LC_ALL=C sort)" = "$(printf '%s\n' extensions/pi-claude-marketplace/orchestrators/marketplace/update.messaging.ts:1 extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.messaging.ts:1 extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.messaging.ts:1 extensions/pi-claude-marketplace/orchestrators/plugin/update.messaging.ts:1)" ] &&
node -e 'const c=require("./.fallowrc.json");if(JSON.stringify(c.duplicates.ignoredClones)!==JSON.stringify(["dup:cc950b18:2"])){console.error("ignoredClones changed");process.exit(1)}' &&
npx fallow dupes --format json --no-fragments --quiet | node -e 'const fs=require("fs");const d=JSON.parse(fs.readFileSync(0,"utf8"));const o="extensions/pi-claude-marketplace/orchestrators/";const arm={};for(const f of ["marketplace/update.messaging.ts","plugin/enable-disable.messaging.ts","plugin/reinstall.messaging.ts","plugin/update.messaging.ts"]){const L=fs.readFileSync(o+f,"utf8").split("\n");const i=L.findIndex(l=>l.includes("fallow-ignore-next-line code-duplication"));const dr=L.findIndex(l=>l.startsWith("const DISABLE_RENDER"));if(i===-1||!L[i+1].trimStart().startsWith("skipped: (p, probe, mpScope) => pluginRow(ICON_UNINSTALLABLE")||(dr!==-1&&Math.max(i,dr)===i)){console.error("marker missing or misplaced in "+f);process.exit(1)}arm[o+f]=i+2}const hit=d.clone_groups.filter(g=>g.instances.some(x=>arm[x.file]&&Math.min(Math.max(arm[x.file],x.start_line),x.end_line)===arm[x.file]));const pair=(a,b)=>d.clone_groups.some(g=>g.instances.some(x=>x.file===o+a)&&g.instances.some(x=>x.file===o+b));if(hit.length){console.error("render-arm groups still listed: "+hit.length);process.exit(1)}if(!pair("plugin/enable-disable.messaging.ts","plugin/install.messaging.ts")||!pair("plugin/enable-disable.messaging.ts","plugin/fetch.messaging.ts")){console.error("an unreviewed messaging group was hidden");process.exit(1)}console.log("dupes ok")' &&
npx fallow audit --base origin/main --format json --quiet | node -e 'const d=JSON.parse(require("fs").readFileSync(0,"utf8"));if(d.verdict!=="pass"){console.error("audit verdict: "+d.verdict);process.exit(1)}console.log("audit pass")' &&
n=$(rg -n "fallow-ignore" extensions tests scripts | wc -l | tr -d " ") &&
grep -q "exactly \*\*$n\*\* \`fallow-ignore\` markers" .planning/codebase/CONVENTIONS.md &&
grep -q "fallow-ignore-next-line code-duplication" .planning/codebase/CONVENTIONS.md &&
! grep -q "or duplication finding is suppressed" .planning/codebase/CONVENTIONS.md &&
npm run fallow</automated>
  </verify>
  <acceptance_criteria>
    - `rg -c 'fallow-ignore-next-line code-duplication -- reviewed: ' extensions tests scripts` lists exactly the four messaging files, each with count 1 (first link of the verify chain).
    - In each file the line after the marker is the `skipped:` arm, and in `orchestrators/plugin/enable-disable.messaging.ts` the marker comes before `const DISABLE_RENDER` (checked by the dupes script).
    - `npx fallow dupes --format json` reports no instance that spans a marked `skipped:` line and still reports the enable-disable/install and enable-disable/fetch groups (the script prints `dupes ok`).
    - `npx fallow audit --base origin/main --format json --quiet` reports verdict `pass` (prints `audit pass`).
    - `.fallowrc.json` `duplicates.ignoredClones` equals `["dup:cc950b18:2"]`.
    - CONVENTIONS.md states the `rg` marker count, names `fallow-ignore-next-line code-duplication`, and no longer has the sentence that rules out suppressed duplication findings.
    - `npm run fallow` exits 0, the commit hook (`check:commit`) passes, and `npm run check` exits 0.
    - `git show --numstat --format= <commit>` lists exactly the five files, with `1	0` for each `.ts` file.
  </acceptance_criteria>
  <done>The three reviewed render-arm groups no longer appear in `fallow dupes` or `fallow audit` (verdict `pass`), both neighbouring messaging groups still appear, `.fallowrc.json` is unchanged, CONVENTIONS.md documents the four markers and why these groups have no `ignoredClones` key, one commit holds exactly the five files with a passing hook, and `npm run check` exited 0.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
| --- | --- |
| fallow duplication gate -> maintainers and CI | A suppression decides which clone groups the local gate and the CI `fallow-audit` job never show. |

## STRIDE Threat Register

ASVS level 1. Blocking threshold `high`. No threat below is high.

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
| --- | --- | --- | --- | --- | --- |
| T-rmz-01 | Tampering | `code-duplication` markers in the four messaging files | low | mitigate | Each marker sits directly above one `skipped:` arm. The verify chain proves that no reported instance spans a marked line and that both neighbouring messaging groups stay reported. CONVENTIONS.md records the four markers and the manual re-check, because fallow never reports a stale `code-duplication` marker. |
| T-rmz-02 | Repudiation | `duplicates.ignoredClones` in .fallowrc.json | low | mitigate | No run-indexed handle is added; the verify chain checks that the list still equals the canary key. A `-rN` key would hide an unrelated, unreviewed group in one of the two reports (Background). |
| T-rmz-SC | Tampering | npm installs | low | accept | No package is installed, added, or upgraded. |
</threat_model>

<verification>
The Task 1 `<verify>` chain passes on the final tree, the commit hook passed, and `npm run check` exited 0 in the executor's checkout. A merge does not run the hook, and the concurrent session's commits change the merged tree. So after the worktree merges, the orchestrator runs `npm run check; echo "exit=$?"` in the main checkout before the quick task finishes, or reuses the executor's result only under the local-verification skill's rule. This task pushes nothing.
</verification>

<success_criteria>
- `fallow dupes` and `fallow audit --base origin/main` no longer report the three reviewed render-arm groups, and the audit verdict is `pass`.
- Every other clone group still reports, including both neighbouring messaging groups.
- `.fallowrc.json` is unchanged.
- Each of the four files has one reasoned `code-duplication` marker above its render map's `skipped:` arm.
- CONVENTIONS.md explains the missing stable key and lists the markers with the correct count.
- One Conventional Commit holds exactly the five files, its hook passed, and `npm run check` exited 0.
</success_criteria>

<output>
Create `.planning/quick/261005-rmz-ignore-the-reviewed-render-arm-clone-gro/261005-rmz-SUMMARY.md` when done. Include the commit SHA and the hook's result and duration; the `fallow dupes` group count before and after; the audit verdict; the exit status of `npm run fallow` and of `npm run check`, with `node --version`; and a `## Threat Flags` section (per AGENTS.md), even when the answer is "None".
</output>
