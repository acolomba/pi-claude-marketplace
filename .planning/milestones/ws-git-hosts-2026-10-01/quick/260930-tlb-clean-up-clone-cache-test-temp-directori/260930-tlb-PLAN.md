---
phase: 260930-tlb
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - tests/orchestrators/plugin/clone-cache.test.ts
autonomous: true
requirements: [TREF-01, NFR-6]
tags: [tests, hermeticity, temp-directories, clone-cache]

estimate:
  tokens: 100000
  raw_tokens: 100000
  tasks: 2
  confidence: low

must_haves:
  truths:
    - "One run of tests/orchestrators/plugin/clone-cache.test.ts with an empty, disk-backed TMPDIR leaves that directory empty; a Node-owned node-compile-cache entry is the only tolerated name. Before the change one run left 54 directories there: 39 clone-cache-, 11 clone-cache-marketplace-, and one each of clone-cache-nongit-, clone-cache-subdir-, clone-cache-escape- and clone-cache-missing- (TREF-01)."
    - "Each of the six mkdtemp calls in the file is followed on the very next line by a t.after registration that removes the same variable with rm and the options recursive true and force true, on the TestContext of the case that owns the directory. The file imports from node:test exactly once, as the default test import plus an inline type TestContext, so no module-level lifecycle hook exists."
    - "freshLocations(t) and buildMarketplaceCheckout(t, options) take the calling case's TestContext; their 39 and 11 call sites pass the enclosing case's t, and exactly 42 of the 56 async test callbacks declare the (t) parameter."
    - "All 57 cases still pass with their titles, arrange/act/assert bodies and assertions unchanged, and direct coverage of extensions/pi-claude-marketplace/orchestrators/plugin/clone-cache.ts still passes at 99/99 branches, 12/12 functions and 629/629 lines."
    - "npm run check exits 0 (CHECK_EXIT=0 read from a log file, never through a pipe), and npx fallow audit reports verdict pass before each commit (NFR-6)."
    - "Both commits change only tests/orchestrators/plugin/clone-cache.test.ts. The pre-existing uncommitted edit to .agents/skills/new-gsd-workspace/SKILL.md is neither staged nor modified, and no production file, package.json, package-lock.json or CHANGELOG.md changes."
  artifacts:
    - path: "tests/orchestrators/plugin/clone-cache.test.ts"
      provides: "per-case removal of every temporary directory the file creates"
      contains: "t.after(() => rm(cwd, { recursive: true, force: true }));"
  key_links:
    - from: "tests/orchestrators/plugin/clone-cache.test.ts (each of the 39 freshLocations callers)"
      to: "tests/orchestrators/plugin/clone-cache.test.ts (freshLocations)"
      via: "the case passes its own TestContext; freshLocations registers removal of the project root it created on that context"
      pattern: "await freshLocations\\(t\\)"
    - from: "tests/orchestrators/plugin/clone-cache.test.ts (each of the 11 SEED callers)"
      to: "tests/orchestrators/plugin/clone-cache.test.ts (buildMarketplaceCheckout)"
      via: "the case passes its own TestContext; the helper registers removal of each checkout it created on that context"
      pattern: "await buildMarketplaceCheckout\\(t, "
---

<objective>
Make every temporary directory that tests/orchestrators/plugin/clone-cache.test.ts creates get removed by the case that created it, so a run of the file stops leaking directories into the shared system temp directory.

Purpose: /tmp on this host is a tmpfs capped at 1,048,576 inodes. One run of this file leaves 54 directories (830 inodes, measured at planning time on Node v26.10.0). The leftovers accumulated until the inode table ran out, and later test runs failed with ENOSPC in mkdtemp. The leak also breaks skills/typescript-unit-testing/SKILL.md (the Filesystem pattern and the completion checklist: one temporary directory per case, cleaned up through finally or t.after()) and TREF-01 (case-owned temporary filesystem state).

Output: one edited test file, landed in two commits. Task 1 is the tracer: it fixes the 39 freshLocations cases and takes one run from 54 leftovers to 15. Task 2 fixes the marketplace-checkout helper and the four inline sites, takes the run from 15 to 0, and passes the full gate. This is a test-only change: no production code, no version bump. CHANGELOG and version are PR-time concerns outside this plan.
</objective>

<execution_context>
@.claude/gsd-core/workflows/execute-plan.md
@.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@AGENTS.md
@tests/orchestrators/plugin/clone-cache.test.ts
@skills/typescript-unit-testing/SKILL.md
@skills/typescript-comments/SKILL.md
@skills/typescript-google-style-review/SKILL.md

House idiom to copy (read it; do not edit it): tests/bridges/agents/unstage.test.ts lines 1-21. It imports `import test, { type TestContext } from "node:test";`, its helper `createScope(t: TestContext, prefix)` calls mkdtemp and registers `t.after(() => rm(directory, { ... }))` on the next line, and its cases are declared `async (t) => {`. The same `t.after(() => rm(<dir>, { recursive: true, force: true }))` line appears in over 400 places under tests/.

**Measured at planning time (HEAD e40d3dda, Node v26.10.0).** Use these numbers. The original request's estimates (about 46 callers, 18 marketplace directories, 68 per run) do not match this file on this branch.

| mkdtemp site | Line | Prefix | Created per run | Cases | Task |
|---|---|---|---|---|---|
| freshLocations helper | 185 | clone-cache- | 39 | 39 callers | 1 |
| buildMarketplaceCheckout helper | 1256 | clone-cache-marketplace- | 11 | 11 SEED callers, all of which also call freshLocations | 2 |
| SEED-02 "a path marketplace without git metadata leaves the clone cache empty" | 1396 | clone-cache-nongit- | 1 | 1, also calls freshLocations | 2 |
| PURL-03 "a materialized git subdirectory resolves beneath the clone root" | 1623 | clone-cache-subdir- | 1 | 1 | 2 |
| PURL-03 "an escaping git subdirectory preserves the complete containment result" | 1642 | clone-cache-escape- | 1 | 1 | 2 |
| PURL-03 "a missing git subdirectory preserves the complete missing result" | 1662 | clone-cache-missing- | 1 | 1 | 2 |

Totals: 54 directories per run. The file has 57 cases: 56 async openers, each on one line as `void test("...", async () => {`, plus one sync case. 42 cases need the `(t)` parameter. There are no describe() blocks, no existing `(t)` parameter, and no existing identifier named `t`. Every count gate in this plan was checked against a scratch copy with the intended edits applied.

Gate facts:
- tsconfig.json sets noUnusedParameters, so typecheck catches both mistakes: TS2304 "Cannot find name 't'" marks a case missing the parameter, and TS6133 marks a superfluous `(t)`.
- The per-task checks take about 60 seconds together: typecheck 39 s, eslint on this file 16 s, prettier 1 s, one run of the file 4 s.
- fallow dupes sits at 1.37% against its 3% threshold, and this file is in none of the 44 clone groups.
- No line-pinned gate names this file: neither the type-member contracts nor the coverage pins.
- No pre-commit git hook is installed, so `git commit` runs no checks. Run pre-commit yourself before each commit.
- In the interactive zsh, `ls` and `find` are aliased (colour columns; bfs). The leak checks wrap their bodies in `bash -c` so they run GNU find.
- `npm run test:coverage:direct` and `npm run check` run this file under the default TMPDIR (/tmp). Until Task 2's edits are in, each such run leaves directories behind in /tmp (54 before Task 1, 15 after it), so run neither before then.

Source coverage audit (no ROADMAP phase, CONTEXT.md or RESEARCH.md exists for a quick task; the request's required fix shape and verification items stand in for them):

| Source | Item | Task | Status |
|---|---|---|---|
| GOAL | clone-cache test temp directories are cleaned up | 1, 2 | COVERED |
| REQ | TREF-01 case-owned temporary filesystem state | 1, 2 | COVERED |
| REQ | NFR-6 npm run check stays green | 2 | COVERED |
| REQUEST | freshLocations takes the TestContext and registers t.after removal; every caller becomes `async (t)` and passes t | 1 | COVERED |
| REQUEST | the five other mkdtemp sites get per-case cleanup; the shared helper registers cleanup per created directory | 2 | COVERED |
| REQUEST | per-case cleanup only, no file-level hook | 1, 2 | COVERED |
| REQUEST | match the house idiom (rm from node:fs/promises, t.after) | 1, 2 | COVERED |
| REQUEST | test-only, no production change, no version bump | 1, 2 | COVERED |
| REQUEST | leak check with an empty, disk-backed TMPDIR | 1 (15 left), 2 (0 left) | COVERED |
| REQUEST | every mkdtemp has a paired cleanup | 2 (pairing check) | COVERED |
| REQUEST | npm run check with the exit code written to a log, not piped | 2 | COVERED |
| REQUEST | never stage or touch .agents/skills/new-gsd-workspace/SKILL.md; stage explicit paths only | 1, 2 | COVERED |
| REQUEST | pre-commit run before committing; no --no-verify; no amend | 1, 2 | COVERED |
| REQUEST | Conventional Commits, title 5-72 characters, body lines at most 80, no GSD ids | 1, 2 | COVERED |
| REQUEST | comments follow skills/typescript-comments/SKILL.md | 1, 2 (no comments added) | COVERED |

Choices made at planning time:
- Two commits, one per task, follow the executor's per-task commit protocol. If Task 2 stalls, Task 1 alone has already removed 39 of the 54 leaks.
- The cleanup options use the key order `{ recursive: true, force: true }`, as in the house t.after idiom, the skill's own text and the request. The file's two existing in-body `rm(options.dir, { force: true, recursive: true })` calls (lines 637 and 1587) stay untouched.
- Each SEED case keeps its two directories, each removed by its own registration, as the request specifies.
- Cleanup is registered on the line right after mkdtemp, so a failure later in setup still removes the directory.
</context>

<tasks>

<task type="tracer">
  <name>Task 1: freshLocations removes its project root after each case (39 cases)</name>
  <files>tests/orchestrators/plugin/clone-cache.test.ts</files>
  <precondition>node_modules is installed at the checkout root (node_modules/.bin/tsc and node_modules/.bin/eslint exist); a fresh git worktree has none, and every check below needs it.</precondition>
  <read_first>
    - tests/orchestrators/plugin/clone-cache.test.ts: lines 1-40 (imports), 184-189 (freshLocations), and every `await freshLocations()` call site
    - tests/bridges/agents/unstage.test.ts: lines 1-21 (house idiom for a helper that takes the TestContext)
    - skills/typescript-unit-testing/SKILL.md: the Filesystem pattern (line 234) and the completion checklist (line 259)
  </read_first>
  <action>
RED baseline first. Before editing, record `git rev-parse HEAD` in the SUMMARY as the start SHA. Then run only the `bash -c '...'` leak command from this task's verify, and record its output in the SUMMARY. Expected today: the prefix counts 39/11/1/1/1/1, `TEST_EXIT=0 BARE=39 LEFTOVER=54`, and a non-zero exit.

Edits, all in tests/orchestrators/plugin/clone-cache.test.ts:

1. Change the node:test import on line 6 to the house form `import test, { type TestContext } from "node:test";` (default import plus inline type specifier, the same line tests/bridges/agents/unstage.test.ts uses). It stays where it is, in the builtin import group.

2. Change freshLocations (line 184) to the signature `async function freshLocations(t: TestContext): Promise<ScopedLocations>`. On the line directly after `const cwd = await mkdtemp(path.join(tmpdir(), "clone-cache-"));`, add `t.after(() => rm(cwd, { recursive: true, force: true }));`. It goes before locationsFor and the mkdir of extensionRoot, so a failure later in setup still removes the directory. rm is already imported from node:fs/promises. Keep the arrow body concise. The runner awaits the promise the hook returns, so the return value is used, which is the one case where Google style allows a concise body. A block body without `return` would let the case end before removal finishes.

3. Change all 39 calls `await freshLocations()` to `await freshLocations(t)`, and change each enclosing test opener from `async () => {` to `async (t) => {`. Each of these 39 cases is a top-level `void test(...)` with its opener on one line. A mechanical method is acceptable, for example a sed for the call text followed by an awk or perl pass that rewrites the opener of each `void test` block containing the call. Whatever the method, typecheck decides: TS2304 marks any case still missing `t`, and TS6133 marks any case given `(t)` that does not use it.

4. Leave the other five mkdtemp sites, the buildMarketplaceCheckout helper and its callers alone; Task 2 owns them. Do not change any test title. That includes the two titles beginning "Pitfall:" on lines 308 and 598, whose opener lines you do edit: change only the callback parameter there. Do not change the arrange/act/assert comments, any assertion, or any other line, and add no comments. Register cleanup only on the case's own context. Add no module-level lifecycle hook from node:test, because the unit-testing rule asks for per-case cleanup.

5. If `npx prettier --check tests/orchestrators/plugin/clone-cache.test.ts` fails, run `npx prettier --write tests/orchestrators/plugin/clone-cache.test.ts`. Never run prettier on Markdown.

6. Run the verify. The leak check must now print `TEST_EXIT=0 BARE=0 LEFTOVER=15` and `tests 57`, `pass 57`, `fail 0`. The 15 are the 11 marketplace checkouts and the four inline sites Task 2 owns.

Commit after the verify passes:
a. Run `pre-commit run --files tests/orchestrators/plugin/clone-cache.test.ts`. It must exit 0. Inside a git worktree, prefix it with `SKIP=trufflehog` (AGENTS.md). If a hook rewrites the file, re-run it until a run passes without rewriting anything. Never use --no-verify.
b. Run `npx fallow audit --format json --quiet --explain --gate-marker agent`. It must report `"verdict": "pass"` (the AGENTS.md fallow local gate).
c. Stage by explicit path only: `git add tests/orchestrators/plugin/clone-cache.test.ts`. Never run `git add -A` or `git add .`. The checkout carries an unrelated uncommitted edit to .agents/skills/new-gsd-workspace/SKILL.md, which must stay unstaged and untouched. Confirm that `git diff --cached --name-only HEAD` prints only the test file.
d. Commit with `git commit -F <message file>`, keeping the message file outside the repository (for example under /var/tmp) so it cannot be left untracked in the checkout. Follow Conventional Commits with no scope. Put no quick-task, milestone or phase id anywhere in the message; this overrides the executor's default `{type}({phase}-{plan})` subject. The title is 5-72 characters, for example `test: clean up clone-cache scope temp directories`. The body has lines of at most 80 characters and says in the present tense what changed and why: freshLocations takes the case's test context and removes the project root it creates, so its 39 cases stop leaving clone-cache- directories in the system temp directory. End with the attribution lines that `<output>` names. Never use --amend.
e. After the commit, `git status --porcelain` must show the test file clean and the SKILL.md edit still unstaged, and `git show --name-only --format= HEAD` must print only tests/orchestrators/plugin/clone-cache.test.ts. Record the commit SHA in the SUMMARY.
  </action>
  <verify>
    <automated>npm run typecheck && npx eslint tests/orchestrators/plugin/clone-cache.test.ts && npx prettier --check tests/orchestrators/plugin/clone-cache.test.ts && test "$(awk '{ fl += gsub(/await freshLocations\(t\)/, "&"); bm += gsub(/await buildMarketplaceCheckout\(t, \{/, "&"); op += gsub(/^void test\(.*async \(t\) => \{$/, "&"); mk += gsub(/mkdtemp\(/, "&"); ta += gsub(/t\.after\(\(\) => rm\(/, "&") } END { printf "freshLocations(t)=%d buildMarketplaceCheckout(t)=%d openers(t)=%d mkdtemp=%d cleanup=%d\n", fl, bm, op, mk, ta }' tests/orchestrators/plugin/clone-cache.test.ts)" = "freshLocations(t)=39 buildMarketplaceCheckout(t)=0 openers(t)=39 mkdtemp=6 cleanup=1" && test "$(grep -n 'from "node:test"' tests/orchestrators/plugin/clone-cache.test.ts)" = '6:import test, { type TestContext } from "node:test";' && test "$(grep -A1 -F 'const cwd = await mkdtemp(' tests/orchestrators/plugin/clone-cache.test.ts | tail -n 1)" = '  t.after(() => rm(cwd, { recursive: true, force: true }));' && bash -c 'T=$(mktemp -d -p /var/tmp) && TMPDIR="$T" node --test tests/orchestrators/plugin/clone-cache.test.ts > "$T.log" 2>&1; TEST_EXIT=$?; find "$T" -mindepth 1 -maxdepth 1 ! -name node-compile-cache -printf "%f\n" | sed -E "s/[A-Za-z0-9]{6}\$//" | sort | uniq -c; BARE=$(find "$T" -mindepth 1 -maxdepth 1 -regextype posix-extended -regex ".*/clone-cache-[A-Za-z0-9]{6}" | wc -l); LEFT=$(find "$T" -mindepth 1 -maxdepth 1 ! -name node-compile-cache | wc -l); grep -E "(tests|pass|fail) [0-9]+\$" "$T.log"; echo "TEST_EXIT=$TEST_EXIT BARE=$BARE LEFTOVER=$LEFT"; rm -rf "$T" "$T.log"; [ "$TEST_EXIT" -eq 0 ] && [ "$BARE" -eq 0 ] && [ "$LEFT" -eq 15 ]'</automated>
  </verify>
  <acceptance_criteria>
    - This task's verify checks the state between the two tasks: 15 directories left and one cleanup line. Once Task 2 lands, Task 2's verify replaces it, and this one is expected to fail. On the unedited file and on the final state alike, its structural segment exits 1.
    - The SUMMARY records the start SHA and the RED baseline: prefix counts 39/11/1/1/1/1 and `TEST_EXIT=0 BARE=39 LEFTOVER=54`.
    - The census awk in the verify prints `freshLocations(t)=39 buildMarketplaceCheckout(t)=0 openers(t)=39 mkdtemp=6 cleanup=1`. It counts matches, not lines. On the unedited file it printed `freshLocations(t)=0 buildMarketplaceCheckout(t)=0 openers(t)=0 mkdtemp=6 cleanup=0`.
    - `grep -n 'from "node:test"' tests/orchestrators/plugin/clone-cache.test.ts` prints exactly `6:import test, { type TestContext } from "node:test";`.
    - The line after `const cwd = await mkdtemp(path.join(tmpdir(), "clone-cache-"));` reads `t.after(() => rm(cwd, { recursive: true, force: true }));`.
    - The leak check prints `TEST_EXIT=0 BARE=0 LEFTOVER=15` with the prefix counts 11 clone-cache-marketplace-, 1 each of clone-cache-nongit-, -subdir-, -escape- and -missing-, and `tests 57`, `pass 57`, `fail 0`.
    - `npm run typecheck`, `npx eslint` on the file and `npx prettier --check` on the file exit 0.
    - `pre-commit run --files tests/orchestrators/plugin/clone-cache.test.ts` exits 0, and the fallow audit verdict is `pass`.
    - `git show --name-only --format= HEAD` prints only `tests/orchestrators/plugin/clone-cache.test.ts`. `MSG=$(git log -1 --format=%B) && printf '%s\n' "$MSG" | awk 'NR == 1 && length($0) > 72 { bad = 1 } NR > 1 && length($0) > 80 { bad = 1 } END { exit bad }'` exits 0. The subject starts with `test: ` and has no scope, and no line of the message names a milestone, phase or quick-task id.
    - `git status --porcelain` still lists .agents/skills/new-gsd-workspace/SKILL.md as an unstaged modification.
  </acceptance_criteria>
  <done>freshLocations takes the calling case's TestContext and removes the project root it created. The 39 cases that call it declare (t) and pass it. One run of the file with an empty TMPDIR leaves only the 15 directories Task 2 owns, and none with the clone-cache- prefix. All 57 cases pass, and typecheck, eslint, prettier, pre-commit and fallow audit are clean. One `test:` commit touches only the test file.</done>
</task>

<task type="auto">
  <name>Task 2: the marketplace checkout helper and the four inline sites remove their directories; full gate</name>
  <files>tests/orchestrators/plugin/clone-cache.test.ts</files>
  <read_first>
    - tests/orchestrators/plugin/clone-cache.test.ts: lines 1249-1283 (buildMarketplaceCheckout), 1393-1413 (the SEED-02 no-git-metadata case), 1602-1695 (the PURL-03 cases and the final re-exports case)
  </read_first>
  <action>
All edits are in tests/orchestrators/plugin/clone-cache.test.ts.

1. buildMarketplaceCheckout (about line 1252): add `t: TestContext` as the first parameter, before `options`, which is the position freshLocations uses. On the line directly after `const marketplaceRoot = await mkdtemp(path.join(tmpdir(), "clone-cache-marketplace-"));`, add `t.after(() => rm(marketplaceRoot, { recursive: true, force: true }));`. Each call registers removal of the checkout that call created, so cleanup is per created directory, as the request asks. Change its 11 call sites from `await buildMarketplaceCheckout({` to `await buildMarketplaceCheckout(t, {`. All 11 are in cases that already declare `(t)` after Task 1, so no opener changes are needed. Prettier reflows the helper's signature onto several lines; that is expected.

2. In the case "SEED-02: a path marketplace without git metadata leaves the clone cache empty" (about line 1393), add `t.after(() => rm(marketplaceRoot, { recursive: true, force: true }));` on the line directly after its `const marketplaceRoot = await mkdtemp(...)` with the clone-cache-nongit- prefix. Its opener already declares `(t)`.

3. In the three PURL-03 cases "a materialized git subdirectory resolves beneath the clone root", "an escaping git subdirectory preserves the complete containment result" and "a missing git subdirectory preserves the complete missing result" (about lines 1621, 1640 and 1660), add `t.after(() => rm(cloneRoot, { recursive: true, force: true }));` on the line directly after each `const cloneRoot = await mkdtemp(...)`. Change each of their openers from `async () => {` to `async (t) => {`. Do not change the PURL-03 non-subdirectory case or the final re-exports case; neither creates a directory.

4. Keep each SEED case's two directories, the project root from freshLocations and the marketplace checkout, each removed by its own registration, as the request specifies. Do not move the checkout inside the project root. That would change the marketplaceRoot each case records in state.json, which is fixture behavior rather than cleanup. Task 1's rules carry over: no title, comment or assertion changes, no comments added, no module-level lifecycle hook, the key order recursive then force, and a concise arrow body.

5. Run `npx prettier --write tests/orchestrators/plugin/clone-cache.test.ts` if `npx prettier --check` on the file fails.

6. Run the verify. It runs, in order: the fast structural checks, the pairing check (`paired=6`), the leak check (now `LEFTOVER=0`), direct coverage of the pair, and `npm run check`. `npm run check` runs every unit and integration suite and can come close to the 10-minute foreground limit. Run that last segment in the background or with the maximum timeout and read CHECK_EXIT from the log; never pipe npm run check. If CHECK_EXIT is not 0, find the failing step in the log. This change can only affect typecheck, lint, fallow, format and the clone-cache cases; the integration glob never loads this file. Give a failure anywhere else one isolated re-run, because concurrent-process tests are known to flake under coverage. If it persists, stop and report it with the failing test names, and do not edit any other file.

Commit after the verify passes, following steps a-e of Task 1. Use a title such as `test: clean up the remaining clone-cache temp directories`. The body says that buildMarketplaceCheckout takes the case's test context and removes each checkout it creates, that the four cases that create a directory inline remove it the same way, and that one run of the file now leaves the temp directory empty.

Then write the SUMMARY at the `<output>` path. It must record:
- the start SHA;
- the RED baseline (`BARE=39 LEFTOVER=54` with prefix counts);
- the Task 1 leak result (`LEFTOVER=15`);
- the final leak result (`LEFTOVER=0`) and the pairing result (`paired=6`);
- the test counts (57/57);
- the direct coverage line;
- `CHECK_EXIT=0` with the log's last lines;
- the fallow audit verdict for both commits;
- both commit SHAs and subjects;
- a `## Threat Flags` section reading "None -- no security-relevant surface outside the plan's `<threat_model>` was introduced." unless execution found one.
  </action>
  <verify>
    <automated>npm run typecheck && npx eslint tests/orchestrators/plugin/clone-cache.test.ts && npx prettier --check tests/orchestrators/plugin/clone-cache.test.ts && test "$(awk '{ fl += gsub(/await freshLocations\(t\)/, "&"); bm += gsub(/await buildMarketplaceCheckout\(t, \{/, "&"); op += gsub(/^void test\(.*async \(t\) => \{$/, "&"); mk += gsub(/mkdtemp\(/, "&"); ta += gsub(/t\.after\(\(\) => rm\(/, "&") } END { printf "freshLocations(t)=%d buildMarketplaceCheckout(t)=%d openers(t)=%d mkdtemp=%d cleanup=%d\n", fl, bm, op, mk, ta }' tests/orchestrators/plugin/clone-cache.test.ts)" = "freshLocations(t)=39 buildMarketplaceCheckout(t)=11 openers(t)=42 mkdtemp=6 cleanup=6" && test "$(grep -n 'from "node:test"' tests/orchestrators/plugin/clone-cache.test.ts)" = '6:import test, { type TestContext } from "node:test";' && awk '/= await mkdtemp\(/ { v = "?"; if (match($0, /const [A-Za-z]+ =/)) v = substr($0, RSTART + 6, RLENGTH - 8); line = NR; nxt = ""; if ((getline nxt) <= 0) nxt = ""; if (index(nxt, "t.after(() => rm(" v ", {") > 0 && nxt ~ /recursive: true/ && nxt ~ /force: true/) ok++; else { print "UNPAIRED line " line ": " v; bad = 1 } } END { print "paired=" ok + 0; exit (bad || ok != 6) }' tests/orchestrators/plugin/clone-cache.test.ts && bash -c 'T=$(mktemp -d -p /var/tmp) && TMPDIR="$T" node --test tests/orchestrators/plugin/clone-cache.test.ts > "$T.log" 2>&1; TEST_EXIT=$?; find "$T" -mindepth 1 -maxdepth 1 ! -name node-compile-cache -printf "%f\n"; LEFT=$(find "$T" -mindepth 1 -maxdepth 1 ! -name node-compile-cache | wc -l); grep -E "(tests|pass|fail) [0-9]+\$" "$T.log"; echo "TEST_EXIT=$TEST_EXIT LEFTOVER=$LEFT"; rm -rf "$T" "$T.log"; [ "$TEST_EXIT" -eq 0 ] && [ "$LEFT" -eq 0 ]' && npm run test:coverage:direct -- tests/orchestrators/plugin/clone-cache.test.ts && LOG=$(mktemp -p /var/tmp check-XXXXXX) && { npm run check > "$LOG" 2>&1; echo "CHECK_EXIT=$?" >> "$LOG"; } && tail -n 3 "$LOG" && grep -qx 'CHECK_EXIT=0' "$LOG"</automated>
  </verify>
  <acceptance_criteria>
    - The pairing check prints `paired=6` and exits 0. It also exits non-zero when the file holds any number of mkdtemp declarations other than six. Run against the unedited file at planning time, it printed six UNPAIRED lines (185 cwd, 1256 and 1396 marketplaceRoot, 1623, 1642 and 1662 cloneRoot) and exited 1.
    - The census awk prints `freshLocations(t)=39 buildMarketplaceCheckout(t)=11 openers(t)=42 mkdtemp=6 cleanup=6`. That means no new temporary-directory site, one cleanup per site, and the (t) parameter on exactly the 42 cases that use it.
    - `grep -n 'from "node:test"' tests/orchestrators/plugin/clone-cache.test.ts` prints exactly `6:import test, { type TestContext } from "node:test";`.
    - The leak check prints `TEST_EXIT=0 LEFTOVER=0`, lists no directory name, and reports `tests 57`, `pass 57`, `fail 0`.
    - `npm run test:coverage:direct -- tests/orchestrators/plugin/clone-cache.test.ts` prints `Direct coverage passed: extensions/pi-claude-marketplace/orchestrators/plugin/clone-cache.ts (branches 99/99, functions 12/12, lines 629/629)`.
    - The `npm run check` log ends with the line `CHECK_EXIT=0`.
    - `pre-commit run --files tests/orchestrators/plugin/clone-cache.test.ts` exits 0 before the commit, and the fallow audit verdict is `pass`.
    - With START set to the start SHA recorded in the SUMMARY, `git diff --name-only "$START"..HEAD` prints only `tests/orchestrators/plugin/clone-cache.test.ts`, and `git log --format=%s "$START"..HEAD` prints exactly two subjects, each starting with `test: ` with no scope.
    - For each of the two commits, the title-72/body-80 awk check from Task 1 exits 0, and no message line names a milestone, phase or quick-task id.
    - `git status --porcelain` still lists .agents/skills/new-gsd-workspace/SKILL.md as an unstaged modification, and the test file is clean.
    - The SUMMARY exists at the `<output>` path with `status: complete`, the before/after leak numbers, `CHECK_EXIT=0`, both commit SHAs, and a `## Threat Flags` section.
  </acceptance_criteria>
  <done>Every mkdtemp in the file pairs with a same-variable t.after removal on the next line (paired=6). One run of the file with an empty TMPDIR leaves it empty, down from 54 directories. All 57 cases pass, direct coverage of the pair is unchanged, npm run check is green (CHECK_EXIT=0 from the log), and fallow audit passes. A second `test:` commit touches only the test file, and the SUMMARY is written.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| test process -> shared system temp directory (`os.tmpdir()`, /tmp on this host, a tmpfs capped at 1,048,576 inodes) | every case that creates a directory there must remove it; a leftover stays across runs and consumes inodes that every other /tmp user shares |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-260930-tlb-01 | Denial of service | the six mkdtemp sites in tests/orchestrators/plugin/clone-cache.test.ts | medium | mitigate | Each site registers removal of its directory on the owning case's TestContext on the next line (`t.after` with `rm`, recursive and force). The empty-TMPDIR leak check proves `LEFTOVER=0` against a measured baseline of 54, and the pairing check proves `paired=6`. |
| T-260930-tlb-02 | Tampering (over-broad recursive delete) | the six t.after removals | low | mitigate | rm receives only the variable its own mkdtemp just returned in the same scope, and the pairing check matches the variable name on both lines. No joined, computed or shared path reaches rm, and `force` only suppresses an error for a path that is already gone. |
| T-260930-tlb-SC | Tampering | npm/pip/cargo installs | low | accept | The plan installs no package and changes no dependency; package.json and package-lock.json are untouched. |
</threat_model>

<verification>
- Leak: one run of the file with an empty, disk-backed TMPDIR leaves it empty (`LEFTOVER=0`), against a measured RED baseline of 54 directories and 830 inodes.
- Pairing: all six mkdtemp sites pair with a same-variable t.after removal on the next line (`paired=6`).
- Structure: 39 `freshLocations(t)` calls, 11 `buildMarketplaceCheckout(t, {` calls, 42 `(t)` openers, 6 mkdtemp lines, 6 cleanup lines, and one node:test import line.
- Tests: 57 pass and 0 fail. Direct coverage of clone-cache.ts passes unchanged (99/99, 12/12, 629/629).
- Gate: npm run check reports `CHECK_EXIT=0` in its log, fallow audit reports `pass`, and pre-commit exits 0 before each commit.
- Scope: `git diff --name-only "$START"..HEAD` (START is the recorded start SHA) prints only tests/orchestrators/plugin/clone-cache.test.ts, and .agents/skills/new-gsd-workspace/SKILL.md is still an unstaged modification.
</verification>

<success_criteria>
- A run of the clone-cache test file leaves no directory in the system temp directory (54 per run before, 0 after).
- Every case that creates a temporary directory removes it through its own TestContext, as skills/typescript-unit-testing/SKILL.md and TREF-01 require.
- Two Conventional Commits (`test: ...`) touch only the test file. A clean pre-commit run and a passing fallow audit precede each, neither is amended or skips hooks, and npm run check is green (NFR-6).
</success_criteria>

<output>
Create `.planning/workstreams/git-hosts/quick/260930-tlb-clean-up-clone-cache-test-temp-directori/260930-tlb-SUMMARY.md` with `status: complete` in its frontmatter; do not commit it.

End every commit message with the attribution lines your own system context specifies. When it gives none, end with exactly this line:

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
</output>
