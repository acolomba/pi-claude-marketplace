---
phase: 260912-pdh
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - scripts/test-coverage-direct.mjs
  - tests/architecture/gate-targets.ts
  - .pre-commit-config.yaml
  - .github/workflows/ci.yml
files_deleted:
  - scripts/revalidation.mjs
  - scripts/revalidation.negative.mjs
  - tests/architecture/revalidation.test.ts
autonomous: true

estimate:
  tokens: 70000
  raw_tokens: 35000
  tasks: 2
  confidence: low

must_haves:
  truths:
    - "`scripts/revalidation.mjs`, `scripts/revalidation.negative.mjs` and `tests/architecture/revalidation.test.ts` are absent from the working tree and from the commit's tree."
    - "`productionPaths()` returns exactly 232, down from the 233 re-measured while planning."
    - "`npm run check` exits 0, read from its own exit status with nothing piped after it. The unit total falls by exactly the focused suite's own test count and by nothing else; integration stays 32/32."
    - "The unowned-export census re-measurement deep-equals its committed pin, with no `scripts/` key on either side."
    - "No permanently-false branch survives in the direct-coverage gate. Both lookup tables and every guard that consulted them are gone, and the source-test correspondence rule is total over the production root and the test root by construction."
    - "`.pre-commit-config.yaml` names no deleted file, `fix-unicode-dashes` excludes only `.planning/`, and no comment is left explaining configuration that no longer exists."
    - "Nothing under `.planning/phases/01-live-evidence-revalidation/` is touched, and `.planning/REQUIREMENTS.md` and `.planning/ROADMAP.md` are byte-unchanged."
    - "No `fallow-ignore`, no `eslint-disable`, and no `.fallowrc.json` threshold override was added. The repo-wide marker count is still 11."
  artifacts:
    - scripts/test-coverage-direct.mjs
    - tests/architecture/gate-targets.ts
    - .pre-commit-config.yaml
    - .github/workflows/ci.yml
  key_links:
    - "`UNOWNED_EXPORT_CENSUS` in `tests/architecture/gate-targets.ts` keys an entry on `scripts/revalidation.mjs` and lists its 11 exports. `unowned-exports-census.test.ts` re-measures the same question with `fallow dead-code --production --unused-exports` and compares by `deepStrictEqual`, so a removal fails exactly as loudly as an addition. Deleting the file without dropping the census entry is red. THIS COUPLING IS NOT IN THE `STATE.md` CHECKLIST — it was found while planning."
    - "`pairForPath` stats BOTH members of any pair it resolves and throws `Missing source-test pair member` on a miss. A lookup table still naming a deleted path therefore converts a retired pair into a hard refusal of the whole gate run, not a skip. The table and the deletion are one change."
    - "`changedPaths` runs `git diff --diff-filter=ACMR`, which excludes deletions, so the `npm-coverage-direct` pre-commit hook never feeds a deleted path to `pairForPath`. The modified files in this change are all passed over with a stated reason and the run resolves zero pairs — that is the expected green, not a silent skip."
    - "`check-corresponding-tests.mjs` scopes only `extensions/pi-claude-marketplace` against `tests`, and treats `architecture` as a non-corresponding root. All three deletions are outside its reach in both arms, which is why deleting a paired source and its test together is clean — but both arms run in `npm run check` and must be read, not assumed."
---

<objective>
Retire the revalidation tooling with the milestone: delete the CLI, its negative control and its
focused suite, then remove every coupling in the tree that named them.

Purpose: the evidence ledger the tooling validates is a completed intake register with nothing
awaiting triage, and it archives with its phase directory. The tooling outlived its input. The
requirement seal it carried (`SEALED_REQUIREMENT_ROUTES`, the clause signatures, `scope-impact
--check`) lives entirely inside the deleted CLI — grep confirms no other file in the tree reads
`RCOV-01`, `SEALED_REQUIREMENT_ROUTES` or `scope-impact` — so the seal retires with it rather than
being broken by this change.

Output: three files deleted, four modified, one Conventional Commits commit, and a measured
`npm run check` exit 0 with the new counts on the committed tree.

Ground truth re-measured while planning, at `ba768e6e`:

- `productionPaths()` returns **233**.
- The only lookup-table entry is `["scripts/revalidation.mjs", "tests/architecture/revalidation.test.ts"]`
  at `scripts/test-coverage-direct.mjs:19-24`, and the reverse table is derived from it, so both
  empty together.
- Five sites consult those tables: `sourceToTest:38`, `testToSource:53`, two arms of
  `pairForPath`'s if/else chain at `:81` and `:84`, and the short-circuit pair in
  `pairabilityRefusal:352`. `productionPaths:117` spreads the keys, which is not a branch.
- `.pre-commit-config.yaml` carries five references: comment lines 51 and 55, the
  `fix-unicode-dashes` exclude at 60, comment line 143, and the `npm-coverage-direct` `files:`
  pattern at 150. The comment block is lines 51-58 and 143-144.
- `tests/architecture/gate-targets.ts:714` keys `UNOWNED_EXPORT_CENSUS` on `scripts/revalidation.mjs`
  with 11 export names.
- `.github/workflows/ci.yml:143` is a comment reading "around eight minutes locally over 233 pairs".
- All three files to be deleted import only Node builtins and each other. Nothing else in the tree
  imports any of them. The repo carries exactly 11 `fallow-ignore` markers and none is in them.
- Working tree is dirty with operator-owned files (`.claude/settings.json`, `.codex/config.toml`,
  `.gitignore`, `.claude/CLAUDE.md`, `.mcp.json`, `AGENTS.md`). Leave every one alone; stage only
  the seven paths this plan names.

**Re-verify each of these before acting. They were measured, not assumed, but the tree moves.**
</objective>

<decision id="empty-map-hazard">
## The lookup tables and their guards are DELETED, not emptied

The hazard is real and it is the deciding factor. The moment the only entry goes, five guards
become permanently false, and a taken-branch that can never again be exercised is residue this
repository has no way to excuse: `.fallowrc.json` carries zero `health.thresholdOverrides`, the
11 `fallow-ignore` markers cover no dead code, and the non-goals forbid adding a suppression.

The precedent points the same way, from the other direction. `WR-03` declined to add a presence
check to `scripts/revalidation.mjs` precisely because it would introduce an uncoverable branch,
and made the lookup **total by construction** instead. The same remedy applies here: once the one
pair outside the production root is gone, the correspondence rule is total over the production
root and the test root, and an escape hatch for exceptions to it has nothing left to describe.

"Keep them for a future special pair" is rejected on the facts. This milestone is closing, and
`scripts/revalidation.mjs` is the only pair outside the production root that has ever existed.

One nuance that cuts toward deletion rather than away from it, checked as the hazard note asked:
**`scripts/test-coverage-direct.mjs` is NOT itself inside the measured pair set.** `productionPaths()`
is the `extensions/pi-claude-marketplace` walk plus the table keys; the gate's own module is under
neither root. `check-corresponding-tests.mjs` does not reach `scripts/**` either, and there is no
owner test — `tests/scripts/` holds only `check-phase-06-hub-ledger.test.ts`. So a dead branch left
in this file would not be *caught* by the direct-coverage gate; it would sit there unmeasured. That
makes leaving one worse, not safer.

### How the decision is verified, separately from the change

1. A comment-stripped grep of the gate script finds zero occurrences of either table identifier.
   Comment lines are stripped first so a header describing the retirement cannot green its own gate.
2. `productionPaths()` returns exactly 232 — proof the key-spread site is gone and the enumeration
   is now purely the production-root walk, not merely that the table was emptied.
3. `npm run test:coverage:direct:negative` exits 0. That runner imports `pairForPath`,
   `enforcePairs` and `pairsForChangedPaths` and drives their refusal paths, so the simplified
   if/else chain is exercised against real fixtures rather than inspected.
4. `npm run fallow` exits 0, dead-code arm included, whole-repo, with no suppression available.
</decision>

<execution_context>
@/home/acolomba/pi-claude-marketplace-refine-unit-tests/.claude/gsd-core/workflows/execute-plan.md
@/home/acolomba/pi-claude-marketplace-refine-unit-tests/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@CLAUDE.md
@.planning/STATE.md
@.planning/refine-unit-tests-MILESTONE-AUDIT.md
@scripts/test-coverage-direct.mjs
@.pre-commit-config.yaml
</context>

<tasks>

<task type="tracer">
  <name>Task 1: Retire the tooling and every coupling that named it, in one atomic edit</name>
  <files>
    scripts/revalidation.mjs (deleted),
    scripts/revalidation.negative.mjs (deleted),
    tests/architecture/revalidation.test.ts (deleted),
    scripts/test-coverage-direct.mjs,
    tests/architecture/gate-targets.ts,
    .pre-commit-config.yaml,
    .github/workflows/ci.yml
  </files>
  <read_first>
    scripts/test-coverage-direct.mjs lines 16-120 and 337-380 — the two lookup tables, `sourceToTest`,
    `testToSource`, `pairForPath`, `productionPaths`, `pairabilityRefusal`. The docstrings on
    `pairForPath` and `pairabilityRefusal` explain obligations that SURVIVE this change; do not
    delete them with the guards.
    tests/architecture/gate-targets.ts lines 536-570 and 705-726 — the census docstring and the entry
    to remove. The docstring states the record is a measurement compared for exact equality in both
    directions; read it before editing so the removal is understood as a re-measurement.
    .pre-commit-config.yaml lines 47-62 and 131-150 — both hook blocks with their comments.
  </read_first>
  <action>
Re-measure the objective's ground truth first, unpiped, and stop if any reading differs: run
`node -e "import('./scripts/test-coverage-direct.mjs').then(m=>console.log(m.productionPaths().length))"`
and confirm 233; run `node --test tests/architecture/revalidation.test.ts` and record its exact
pass count and its exit status; run `grep -n revalidation .pre-commit-config.yaml` and confirm the
five line numbers. Record the focused suite's count — the expected unit-total drop in Task 2 is
computed from THIS run, not from the number quoted in the objective.

Then make all six edits as ONE working-tree change. Every partial state is red by construction: the
census pin fails if the CLI goes without its entry, and the gate's pair resolver throws
`Missing source-test pair member` if a lookup table outlives the file it names. Do not stage or
commit anything until all six are in place.

1. `git rm` the three files: `scripts/revalidation.mjs`, `scripts/revalidation.negative.mjs`,
   `tests/architecture/revalidation.test.ts`.

2. In `scripts/test-coverage-direct.mjs`, remove both lookup tables and every guard that reads
   them, per the `<decision id="empty-map-hazard">` block above. Concretely: delete the
   `specialPairs` and `specialTests` declarations; delete the leading early-return guard in
   `sourceToTest` and in `testToSource` so each function begins at its prefix check; delete the
   first two arms of `pairForPath`'s if/else chain so it begins with the production-root test and
   still ends with the `Path is not a source-test pair member` throw; make `productionPaths` return
   the sorted production-module walk with no key spread; delete the leading short-circuit in
   `pairabilityRefusal` so it begins with the production-root test. Leave the `let sourcePath` /
   `let testPath` declarations, the existence loop, and every surviving docstring untouched.
   <!-- planner-discipline-allow: specialPairs -->
   <!-- planner-discipline-allow: specialTests -->
   Do NOT leave a comment anywhere in this file naming either retired identifier or narrating the
   retirement — an acceptance gate greps for those two names with comment lines stripped, and a
   note about the removal placed in a comment would still be caught by the unstripped half of the
   reader's eye and is residue regardless. Git carries the history.

3. In `tests/architecture/gate-targets.ts`, remove the `UNOWNED_EXPORT_CENSUS` entry keyed on
   `scripts/revalidation.mjs` together with its 11 export names, leaving the object's remaining
   keys in their existing sorted order and the closing brace intact. This is a re-measurement of a
   tree that no longer publishes those exports, not a waiver. Do not touch the census docstring,
   which describes an obligation that continues.

4. In `.pre-commit-config.yaml`, the `fix-unicode-dashes` block: delete the whole comment block at
   lines 51-58 — it exists only to justify the two file exclusions and is orphaned without them —
   and reduce the `exclude:` to `^\.planning/`, matching its `fix-smartquotes` and `fix-ligatures`
   siblings byte for byte.

5. In `.pre-commit-config.yaml`, the `npm-coverage-direct` block: delete `scripts/revalidation\.mjs|`
   from the `files:` alternation, leaving the production-root, test-root and pin-file alternatives.
   Delete the comment sentence at lines 143-144 that explains the removed alternative, but KEEP its
   trailing clause about the pin file being listed so a pin edit re-runs the comparison — that
   clause explains a surviving list member and must be reflowed into a standalone comment, not
   dropped. In the same block, the earlier comment at lines 136-138 describes the gate's own
   correspondence rule as the test glob "plus the special pair"; that parenthetical stops being
   true here, so strike the trailing phrase and reflow the paragraph. Keep every other line of both
   comments.

6. In `.github/workflows/ci.yml` line 143, change the cost comment's pair count from 233 to 232.
   PLANNER JUDGMENT, flagged so the operator can strike it: this is a live description of the job
   that is about to run, not a historical measurement, which is why it is treated differently from
   `.planning/REQUIREMENTS.md` and `.planning/ROADMAP.md`. Those two are explicitly out of scope
   and must stay byte-unchanged — their 233 was true when measured and the count moved because
   tooling was removed, not because a baseline was lost.

Add no suppression of any kind. If a gate goes red, the change is wrong, not the gate.
  </action>
  <verify>
    <automated>node -e "import('./scripts/test-coverage-direct.mjs').then(m=>{const n=m.productionPaths().length;if(n!==232){throw new Error('expected 232, got '+n)}console.log('productionPaths OK',n)})" && test "$(grep -vE '^[[:space:]]*(//|\*|/\*)' scripts/test-coverage-direct.mjs | grep -cE 'specialPairs|specialTests')" = 0 && test ! -e scripts/revalidation.mjs && test ! -e scripts/revalidation.negative.mjs && test ! -e tests/architecture/revalidation.test.ts && ! grep -q revalidation .pre-commit-config.yaml && test "$(grep -rn 'fallow-ignore' scripts/ tests/ extensions/ | wc -l | tr -d ' ')" = 11 && node --test tests/architecture/gate-targets.test.ts tests/architecture/unowned-exports-census.test.ts && npm run typecheck && npm run lint && npm run fallow && npm run format:check && npm run test:corresponding && npm run test:corresponding:negative && npm run test:coverage:direct:negative && echo TASK1_GATES_GREEN</automated>
  </verify>
  <done>
The three files are gone from the working tree. `productionPaths()` returns 232. A
comment-stripped grep of `scripts/test-coverage-direct.mjs` finds zero occurrences of either
retired table identifier, and `grep revalidation .pre-commit-config.yaml` finds none. The census
gate and the registry gate both pass, as do typecheck, lint, fallow, format:check, both
corresponding-tests arms and the direct-coverage negative runner — each read from its own exit
status. No suppression was added: `grep -rn "fallow-ignore" scripts/ tests/ extensions/ | wc -l`
still reads 11, and `git diff .fallowrc.json` is empty. Nothing is staged or committed yet.
  </done>
</task>

<task type="auto">
  <name>Task 2: Prove the full gate chain, then land it as one commit</name>
  <files>
    scripts/test-coverage-direct.mjs,
    tests/architecture/gate-targets.ts,
    .pre-commit-config.yaml,
    .github/workflows/ci.yml
  </files>
  <action>
Run `npm run check` with nothing piped after it and read its own exit status. Do not pipe it
through `tail`, `head`, `tee` or anything else: a pipe hands the chain the pipe's exit code and
reports green on a failing command, which has bitten three times in this session including inside
a verifier. If the output volume is a problem, redirect to a file and read the file afterwards —
`npm run check > "$SCRATCH/check.log" 2>&1; echo "exit=$?"` keeps the status intact.

From that run, record three readings and check the arithmetic: the unit `pass`/`fail` totals, the
integration totals, and the exit status. The unit total must equal the pre-change total minus the
focused suite count Task 1 measured, exactly. A drop larger than that means something else stopped
running and must be explained before committing; a drop smaller means a suite is still resolving
the deleted file. Integration must stay 32/32.

Then run `pre-commit run --files .pre-commit-config.yaml scripts/test-coverage-direct.mjs
tests/architecture/gate-targets.ts .github/workflows/ci.yml` with `SKIP=trufflehog` — this is a
linked worktree, so `.git` is a file and trufflehog's `<root>/.git/index` read cannot succeed. Pass
only the modified paths; the deleted ones no longer exist and the hook runner refuses a missing
file. Because `.pre-commit-config.yaml` is itself one of the edited files, this run already reads
the NEW configuration from the working tree. Fix any failure, restage, and re-run until clean. A
failed hook means the commit did not happen, so never recover with `--amend`.

Stage exactly the seven paths this plan names and nothing else — `git add` them explicitly, never
`git add -A` or `git add -u`. The working tree carries operator-owned modified and untracked files
(`.claude/settings.json`, `.codex/config.toml`, `.gitignore`, `.claude/CLAUDE.md`, `.mcp.json`,
`AGENTS.md`); none of them belongs in this commit. Confirm with `git diff --cached --name-only`
before committing: it must list exactly seven paths, three of them deletions.

Commit on `features/refine-unit-tests` with a Conventional Commits subject of at most 72
characters and body lines of at most 80, naming no milestone, phase, plan or wave. The subject
describes the retirement; the body records what was deleted, that the lookup tables and their
guards were removed rather than emptied and why, the census entry removal, the two pre-commit
blocks, the pair count moving 233 to 232, and the measured `npm run check` result.

After the commit, capture the SHA explicitly — `SHA=$(git rev-parse HEAD)` — and use `$SHA^..$SHA`
for any range inspection. Never use `HEAD~1` or any other relative anchor: parallel work commits
to this checkout and a relative anchor can silently name someone else's commit.

Then do the post-landing checks. Re-run the same `pre-commit run --files` invocation against the
committed tree so the landed configuration is the one exercised, and re-run the two
lightweight readings — `productionPaths()` is 232 and the comment-stripped grep is still zero.
Finally run `git status --porcelain` and read it: the pre-commit hooks rewrite files in place while
the commit still succeeds, so an unexpected modification to one of this change's four files is a
hook rewrite that needs a follow-up commit — a second commit, never an amend.
  </action>
  <verify>
    <automated>npm run check > "${SCRATCH:-/tmp}/pdh-check.log" 2>&1; echo "check exit=$?"; grep -E "^# (pass|fail)" "${SCRATCH:-/tmp}/pdh-check.log"; SHA=$(git rev-parse HEAD); git diff --name-status "$SHA^..$SHA"; git status --porcelain</automated>
  </verify>
  <done>
`npm run check` exits 0, read from its own status with nothing piped after it. The unit total is
the pre-change total minus exactly the focused suite count Task 1 measured, and integration reads
32/32. `pre-commit run --files` with `SKIP=trufflehog` is clean both before and after the commit,
the second run reading the landed configuration. One commit exists on
`features/refine-unit-tests`, its subject Conventional Commits and at most 72 characters with no
milestone, phase, plan or wave reference, and `git diff --name-status $SHA^..$SHA` lists exactly
seven paths: three `D` and four `M`. `git status --porcelain` shows no residue among those files;
if a hook rewrote one, a follow-up commit landed it and no amend was used. `.planning/REQUIREMENTS.md`,
`.planning/ROADMAP.md` and everything under `.planning/phases/01-live-evidence-revalidation/` are
absent from the commit.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| deleted file -> gate registry | `UNOWNED_EXPORT_CENSUS` and the direct-coverage lookup tables both name paths by string literal. The tree and the registry are two independent records of the same fact, and a deletion that reaches only one leaves a gate asserting about a file that is not there. |
| deleted file -> hook `files:` pattern | `.pre-commit-config.yaml` names both deleted files in a regex. A pattern naming a vanished path silently matches nothing, so the hook keeps reporting success over a narrower set than its comment claims. |
| working tree -> commit | The checkout is shared with operator-owned edits to `.claude/`, `.codex/`, `.gitignore`, `.mcp.json` and `AGENTS.md`, and with parallel work. Anything staged by pattern rather than by explicit path crosses this boundary uninvited. |
| verifier -> exit status | A verify command piped into another process reports the pipe's status. Content that looks like a passing run on one side of this boundary is an unread failure on the other. |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-pdh-01 | Tampering | `UNOWNED_EXPORT_CENSUS` | high | mitigate | Deleting `scripts/revalidation.mjs` without dropping its census entry makes `unowned-exports-census.test.ts` fail its `deepStrictEqual` against the re-measurement. Both edits are in Task 1's single atomic change and Task 1's gate runs that test by name before anything is staged. This coupling is absent from the `STATE.md` checklist and was found by grep while planning. |
| T-pdh-02 | Denial of service | `pairForPath` | high | mitigate | A lookup table still naming a deleted path does not degrade to a skip: `pairForPath` stats both members and throws `Missing source-test pair member`, aborting the whole direct-coverage run and every pre-commit hook that invokes it. Table removal and file deletion land together, and `npm run test:coverage:direct:negative` exercises the simplified resolver against real fixtures. |
| T-pdh-03 | Tampering | `.pre-commit-config.yaml` `files:` / `exclude:` patterns | medium | mitigate | A regex alternative naming a vanished path matches nothing and reports success over a narrower scope than its comment claims — a gate that greens having inspected less. Both patterns are reduced in the same change, `grep revalidation .pre-commit-config.yaml` must return nothing, and the hooks are re-run after the edit lands so the new configuration is the one exercised. |
| T-pdh-04 | Repudiation | uncoverable branch left behind | medium | mitigate | An emptied table with live guards leaves five permanently-false branches that no gate in this repository measures, because the gate script is not in the pair set and has no owner test. Tables and guards are deleted outright per the recorded decision, verified by a comment-stripped grep and by `productionPaths()` reading 232 rather than merely by the tables being empty. |
| T-pdh-05 | Tampering | commit contents | medium | mitigate | Stage the seven named paths explicitly; never `git add -A` or `-u`. Confirm with `git diff --cached --name-only` before committing and `git diff --name-status $SHA^..$SHA` after. Use an explicit captured SHA, never `HEAD~1`, because parallel work commits to this checkout. |
| T-pdh-06 | Spoofing | verify command exit status | high | mitigate | Every verify command runs unpiped and is read from its own status; `npm run check` redirects to a file rather than piping. A piped chain returns the pipe's status and has produced a false green three times in this session, once inside a verifier. |
| T-pdh-07 | Tampering | pre-commit in-place rewrite | low | mitigate | The hooks rewrite files mid-commit while the commit still succeeds. Run `git status --porcelain` after committing and repair any rewrite with a follow-up commit, never an amend — a failed hook means the commit did not happen, so amending would alter the previous commit. |
| T-pdh-08 | Information disclosure | deleted evidence ledger tooling | low | accept | The deleted CLI reads only project-internal planning documents and holds no credential material. The ledger, shards and review inputs it validated are untouched and archive with their phase directory. `trufflehog` cannot run in this linked worktree at all — `.git` is a file — so the local gate has a permanent hole that only CI's full-clone Lint job closes; this change introduces no new secret-bearing content for it to miss. |
| T-pdh-SC | Tampering | npm/pip/cargo installs | low | accept | This change installs no packages and invokes no package manager beyond existing `npm run` scripts that execute committed local code. The package-legitimacy gate has no target, so no `RESEARCH.md` audit table is required. |
</threat_model>

<verification>
1. `test ! -e` passes for all three deleted paths, and `git diff --name-status $SHA^..$SHA` lists
   them as `D`.
2. `productionPaths()` returns exactly 232. Read the number, not a truthy result.
3. `grep -vE '^[[:space:]]*(//|\*|/\*)' scripts/test-coverage-direct.mjs` piped into a count of the
   two retired table identifiers reads 0, with the count captured in `$(...)` so the pipeline's own
   exit status cannot be mistaken for the verdict. Comments are stripped first so a header
   narrating the retirement cannot green its own gate. Both halves were smoke-tested against the
   pre-change tree while planning: the count reads 11 today, so the gate is discriminating rather
   than vacuous.
4. `node --test tests/architecture/unowned-exports-census.test.ts` passes, so the re-measured
   census deep-equals the pin with no `scripts/` key on either side.
5. `node --test tests/architecture/gate-targets.test.ts` passes, so every remaining registry target
   still resolves and no group was emptied.
6. `npm run test:corresponding` and `npm run test:corresponding:negative` both exit 0, proving that
   deleting a paired source together with its test is clean in both directions rather than assuming
   it.
7. `npm run test:coverage:direct:negative` exits 0, exercising the simplified pair resolver and its
   refusal paths against real fixtures.
8. `npm run check` exits 0, unpiped. Unit total equals the pre-change total minus exactly the
   focused suite count measured in Task 1; integration reads 32/32.
9. `grep -rn "fallow-ignore" scripts/ tests/ extensions/ | wc -l` still reads 11, and
   `git diff $SHA^..$SHA -- .fallowrc.json` is empty — no suppression and no threshold override.
10. `git diff $SHA^..$SHA --name-only` contains neither `.planning/REQUIREMENTS.md` nor
    `.planning/ROADMAP.md` nor any path under `.planning/phases/01-live-evidence-revalidation/`.
11. `git status --porcelain` shows no unexpected modification to the four files this change edits.
</verification>

<success_criteria>
- The three revalidation files are gone from the tree and from the commit; nothing else was deleted.
- The direct-coverage gate carries no lookup table and no guard consulting one. Its correspondence
  rule is total over the production root and the test root by construction, and its enumeration
  reads 232.
- `UNOWNED_EXPORT_CENSUS` no longer keys an entry on a file that does not exist, and its gate
  passes as a re-measurement rather than as a waiver.
- `.pre-commit-config.yaml` names no deleted file, and no comment survives explaining configuration
  that was removed with it.
- `npm run check` exits 0 with the expected unit-count drop and 32/32 integration, measured unpiped
  on the committed tree.
- One commit on `features/refine-unit-tests`, seven paths, Conventional Commits, no milestone or
  phase reference, no suppression added, no operator-owned file swept in.
- The SUMMARY records the exact before/after unit totals, the focused suite count that explains the
  difference, the `productionPaths()` reading, and the census entry removal as a coupling the
  `STATE.md` checklist did not name.
</success_criteria>

<output>
Create `.planning/quick/260912-pdh-retire-the-revalidation-tooling-with-the/260912-pdh-SUMMARY.md`
when done.
</output>
