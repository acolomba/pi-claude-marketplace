---
phase: 261010-cfi
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - tests/orchestrators/reconcile/mcp-migration.test.ts
autonomous: true
requirements: [AMIG-02, NFR-4, NFR-9]

estimate:
  tokens: 48000
  raw_tokens: 48000
  tasks: 1
  confidence: low

must_haves:
  truths:
    - "Under Node 26 (`node`) and under Node 22 (`/usr/bin/node`, whose EISDIR read message carries no path, like the Node 24 that CI runs), `tests/orchestrators/reconcile/mcp-migration.test.ts` passes 65 of 65. Before the edit, the Node 22 run fails only the AMIG-02 stub-probe case, on its `detail` field."
    - "The AMIG-02 stub-probe case reads its expected `detail` back from a real `readFile` of the same `projectAdapterPath` directory after the act. It maps that absolute path to the basename literal `mcp-adapter.json` (NFR-9) and pins the probe failure to code EISDIR and syscall read."
    - "The case still compares the whole `{ rows, log }` value with one `assert.deepStrictEqual`. Its title, arrange phase, `commitPreparedMcp` override, log expectation, and final `legacyBytes` assertion are unchanged."
    - "The test file holds no hardcoded EISDIR message wording and no hardcoded quoted-basename suffix. Both negative grep counts in the task verify read 0."
    - "One Conventional Commit changes only `tests/orchestrators/reconcile/mcp-migration.test.ts`. Its pre-commit pass ran `npm run check:commit` and passed. No production, fixture, or other test file changed."
    - "`npm run check` exits 0 on the tree that holds the commit."
  artifacts:
    - path: "tests/orchestrators/reconcile/mcp-migration.test.ts"
      provides: "The AMIG-02 stub-probe case, with an expected detail that the runtime supplies and an identity pin on the probe"
      contains: 'detail: readFailure.replaceAll(projectAdapterPath, "mcp-adapter.json"),'
  key_links:
    - from: "The post-act probe in the AMIG-02 stub-probe case"
      to: "readOptionalText in extensions/pi-claude-marketplace/bridges/mcp/adapter-doc.ts, reached through projectDisableStubNames"
      via: "Both sides call readFile from node:fs/promises on the same path, so the runtime writes the same sentence on each side"
      pattern: 'readFile(projectAdapterPath, "utf8")'
    - from: "The expected detail of the AMIG-02 stub-probe case"
      to: "redactAbsolutePaths in extensions/pi-claude-marketplace/shared/redact-absolute-paths.ts, applied by pushRemovalFailureRow in extensions/pi-claude-marketplace/orchestrators/reconcile/mcp-migration.ts"
      via: "The expectation states the NFR-9 basename rule with its own literal, so on Node 26 a row that keeps the absolute path fails the case"
      pattern: 'replaceAll(projectAdapterPath, "mcp-adapter.json")'
---

# Accept the Node 24 and Node 26 EISDIR wording in the mcp-migration stub-probe test

<objective>
Make the AMIG-02 case "a project stub probe that throws keeps a user owner's legacy entry with an unfinished row" in `tests/orchestrators/reconcile/mcp-migration.test.ts` pass on every supported Node major (NFR-4). The case's expected `detail` hardcodes the Node 26 EISDIR sentence, which ends with the quoted file name. Node 24 leaves the file name out. So the PR #250 job "direct coverage (Node 24)" fails on this one assertion, although coverage itself is 100%. The "package manifest" and "sonarcloud" jobs are skipped behind it.

The fix takes the expected sentence from the runtime. After the act, the case makes the same `readFile` call that production's stub probe makes, on the same directory. It pins that failure's code and syscall, and it maps the absolute path to its basename, as the row does (NFR-9). The assertion stays one exact `assert.deepStrictEqual` over `{ rows, log }`.

Purpose: unblock CI on PR #250 without weakening the case. On Node 26 the case still fails if the row shows an absolute path.

Output: one test-only commit on `features/mcp-4`, and the SUMMARY. The plan has one task, the tracer: the edit, both runtimes, the commit, and the full gate.
</objective>

<execution_context>
@.claude/gsd-core/workflows/execute-plan.md
@.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@skills/typescript-unit-testing/SKILL.md
@skills/typescript-comments/SKILL.md
@skills/local-verification/SKILL.md
</context>

## Findings verified during planning

Planning ran on 2026-10-10 against HEAD `354e3cf8` ("chore(release): bump the version to 0.20.0"), a clean tree on branch `features/mcp-4`. That commit is the head of PR #250.

1. **CI.** In PR #250, the job "direct coverage (Node 24)" fails only this case. Its diff: the actual `detail` ends at `read`, and the expected `detail` adds the quoted basename. The "package manifest" and "sonarcloud" jobs are skipped because they depend on it. Static checks, integration tests, pinned e2e tests, pre-commit, and fallow-audit pass.
2. **Raw runtime text.** `readFile(<directory>, "utf8")` from `node:fs/promises` rejects with code `EISDIR` and syscall `read` on both runtimes. On Node 26.11.1 the message ends with the quoted absolute path, and the error has a `path` field. On Node 22.22.2 the message ends at `read`, with no path. This is the Node 24 form that CI shows.
3. **Production path.** `ownersWithStubs` (`extensions/pi-claude-marketplace/orchestrators/reconcile/mcp-migration.ts`) calls `projectDisableStubNames` (`bridges/mcp/legacy.ts`). That reaches `readMcpConfigDoc` and `readOptionalText` (`bridges/mcp/adapter-doc.ts`), which calls `readFile(filePath, "utf8")`. Only ENOENT and ENOTDIR read as an absent file, so EISDIR propagates. `pushRemovalFailureRow` sets `detail: redactAbsolutePaths(errorMessage(err))`. `redactAbsolutePaths` (`shared/redact-absolute-paths.ts`) collapses each absolute path to its basename (NFR-9).
4. **Baselines.** `node --test tests/orchestrators/reconcile/mcp-migration.test.ts` under Node 26: 65 tests, 65 pass. `/usr/bin/node --test tests/orchestrators/reconcile/mcp-migration.test.ts` under Node 22.22.2: 65 tests, 64 pass, and 1 fails, which is this case. The local Node 22 run reproduces the CI failure.
5. **Prototype.** An out-of-repo copy of the test file with the code edit of Task 1 (imports pointed back at the repository; the comment wording differed by one word) passed 65 of 65 under Node 26 and under Node 22.22.2. The prescribed comment lines are 95, 95, and 43 characters long at their indentation. Prettier with the repository's `.prettierrc.json` left the edited region unchanged. A mutant without the basename mapping failed this case under Node 26, with the absolute path in the expected value. So the mapping matters, and the case still checks NFR-9 on Node 26.
6. **House precedent.** Five suites read the runtime's errno text back with the same probe code: `tests/persistence/config-io.test.ts` (probe at about line 284), `tests/orchestrators/import/settings.test.ts` (about line 604), `tests/bridges/agents/unstage.test.ts` (about line 302), `tests/orchestrators/plugin/install-flow.test.ts` (about line 12763), and `tests/orchestrators/plugin/reinstall-flow.test.ts` (about line 7059). The last four open their comment with the exact sentence that Task 1 reuses; config-io words the same idea differently. `tests/persistence/state-io.test.ts` (about line 1134) builds its expected message from the caught cause instead. `npx fallow dupes` reports 29 clone groups, and none of them touches those files, so a sixth copy of the probe adds no clone group for the fallow-audit job.
7. **Current file.** `readFile`, `mkdir`, and `rm` are already imported from `node:fs/promises`. `scopeTexts` (about line 360) already uses `replaceAll` with string arguments. The EISDIR wording occurs on exactly one line, the case's `detail` (line 1963). The grep checks in the task verify read 1, 1, 0, and 0 at HEAD, and 0, 0, 1, and 1 on the prototype.

## Choices made

- **Read the text back, do not switch on the version.** `tests/bridges/commands/unstage.test.ts` (about line 215) switches on `process.platform` between two literals. That suits a fixed difference between operating systems. Here the text depends on the Node release. A switch on `process.versions` would encode which releases append the path, and a backport would break the case again. A read of the same directory gives the right text on every release. The user chose this route, and five suites already use it.
- **No prefix assertion.** A prefix would split the whole-value `deepStrictEqual`, which the unit-testing skill requires. It would also stop catching an unredacted absolute path on Node 26.
- **The probe goes at the end of the act phase.** The directory exists only after the act. The case's `commitPreparedMcp` override swaps the file for a directory during `migrateLegacyMcpEntries`, and nothing in the run removes it. `tests/persistence/config-write-back.test.ts` (about line 130) also reads a post-act failure at the end of its act phase.
- **A literal basename and `replaceAll` with string arguments.** The literal keeps the expected value independent of production. The test must not call `redactAbsolutePaths`. Sonar prefers `replaceAll` with string arguments.
- **A three-line comment.** The first line is the house sentence. The second cites NFR-9 for the mapping. The third explains the identity pin. The precedents' sentences about a fixture drifting to ENOENT are left out. In this case a missing file makes production find no stubs and emit `moved` rows, so those sentences do not describe it.
- **No CHANGELOG entry.** The change is test-only and changes nothing that users see.
- **No push.** The operator pushes `features/mcp-4`, and PR #250's Node 24 job gives the final proof.

## Scope rule

Change only `tests/orchestrators/reconcile/mcp-migration.test.ts`. Inside it, change only the AMIG-02 stub-probe case (lines 1929-1970 at HEAD `354e3cf8`): insert the probe after the act call, and replace the value on the `detail:` key (line 1963). Do not edit production code (`extensions/**`), any other test, fixtures, `package.json`, `package-lock.json`, `CHANGELOG.md`, or `.planning/STATE.md` (the quick workflow updates it). Do not bump the version.

## Source coverage audit

| Source | Item | Covered by |
| --- | --- | --- |
| GOAL | Accept the Node 24 and Node 26 EISDIR text in the mcp-migration test | Task 1 |
| Task detail | Derive the expected detail at runtime from a real `readFile` EISDIR on the same directory path, and keep the assertion exact and `deepStrictEqual`-shaped (the preferred route) | Task 1, Steps 2 and 3 |
| Task detail | Test-only change; no production edits | Scope rule; Task 1 Step 4; the `git show --stat` criterion |
| Task detail | The `tests/bridges/commands/unstage.test.ts` precedent | Read; Choices made explains why the read-back precedent fits a difference between Node releases |
| Constraint | Fixers first, foreground commit, no `--no-verify`, no `--amend`, Conventional Commit, title of 72 characters or fewer, body lines of 80 or fewer, no GSD mentions | Task 1 Step 6; `## Commit message` |
| Constraint | The pair passes under the local Node, grep proves that the Node-26-only suffix is gone, and CI on Node 24 is the final proof | Task 1 `<verify>`; `<verification>` item 5 |
| Constraint | `<threat_model>` at ASVS level 1, blocking on high | `<threat_model>` |
| REQ | AMIG-02 (the case), NFR-4 (supported Node majors), NFR-9 (the basename rule stays asserted) | Task 1 |
| RESEARCH | None: no research phase | n/a |
| CONTEXT | No CONTEXT.md: no discuss phase. The task detail is the decision source. | n/a |

## Execution environment

These are facts about this checkout, measured during planning.

- The checkout is a git worktree on branch `features/mcp-4`. Stay on that branch. Do not create or switch branches, stash, amend, rebase, or rewrite history.
- The operator can edit files in this checkout at the same time. Stage and commit by explicit path only.
- The `pre-commit` and `commit-msg` hooks are installed. When a staged file is a build input, the `npm-check` hook runs `npm run check:commit` in the pre-commit pass. Every file under `tests/` is a build input.
- `node` resolves to v26.11.1 (Homebrew). `/usr/bin/node` is v22.22.2 (the system package). Both are inside the `engines` range. `/usr/bin/node` is a system interpreter, not a repository path. It is the only absolute path in this plan's commands.
- Every case in the suite builds its own hermetic temporary home (`createHermeticEnvironment`), so the runs never touch the real `~/.pi/agent`.

## Commit message

Use this message as written. It cites no GSD milestone, phase, plan, or decision.

```text
test(reconcile): read the EISDIR wording back from the runtime

The legacy MCP migration case for a failing project stub probe pinned the
EISDIR message that Node 26 prints. Node 26 appends the file path to that
message and Node 24 does not, so the case failed in CI on Node 24.

The case now reads the message back from the same failing read, maps the
absolute path to the basename that the row shows, and pins the failure's
code and syscall. The row is still compared as a whole value.
```

<tasks>

<task type="tracer">
  <name>Task 1 (tracer): read the AMIG-02 stub-probe detail back from the runtime, prove it on Node 22 and Node 26, and commit</name>
  <precondition>At the checkout root, `node_modules/` exists, `node --version` prints a v26 release, and `/usr/bin/node --version` prints a v22 release (v26.11.1 and v22.22.2 at planning time).</precondition>
  <files>tests/orchestrators/reconcile/mcp-migration.test.ts</files>
  <read_first>
    - tests/orchestrators/reconcile/mcp-migration.test.ts: the case titled "AMIG-02: a project stub probe that throws keeps a user owner's legacy entry with an unfinished row" (lines 1929-1970 at HEAD `354e3cf8`), and `scopeTexts` (about line 360).
    - tests/persistence/config-io.test.ts lines 270-300: the house read-back probe in the case "returns the complete ordinary read failure".
    - Read only, do not edit: extensions/pi-claude-marketplace/orchestrators/reconcile/mcp-migration.ts lines 590-665 (`pushRemovalFailureRow`, `ownersWithStubs`); extensions/pi-claude-marketplace/bridges/mcp/adapter-doc.ts lines 134-145 (`readOptionalText`); extensions/pi-claude-marketplace/shared/redact-absolute-paths.ts lines 1-25 (`redactAbsolutePaths`).
    - skills/typescript-unit-testing/SKILL.md (sections Case structure and Assertions) and skills/typescript-comments/SKILL.md.
  </read_first>
  <action>
Step 1, baseline. Run `node --version` and `/usr/bin/node --version`, and record both. Run `/usr/bin/node --test tests/orchestrators/reconcile/mcp-migration.test.ts`. Save its output to a file in your scratchpad, and read its exit status directly. Do not pipe the run through `tail`. It must exit non-zero, with 65 tests, 64 passing, and 1 failing. The failing case must be the AMIG-02 stub-probe case. Its diff shows the actual `detail` without the quoted file name and the expected `detail` with it. This reproduces the PR #250 CI failure on this machine. If the run passes instead, stop and report it: `/usr/bin/node` no longer gives the Node 24 text, so the local proof does not hold.

Step 2, the probe. Find the case by its title. In its `// act` phase, directly after `await migrateLegacyMcpEntries(input, operations);` and with no blank line between, add a three-line `//` comment and then the house read-back probe. Write the comment text exactly, one line each: "Read back the runtime's own errno wording: later majors append the offending path to it." then "NFR-9: the unfinished row names that path by its basename. The failure's identity is not" then "runtime-owned, so the probe pins it." The probe is the statement `const readFailure = await readFile(projectAdapterPath, "utf8").catch((error: unknown) => { ... });`. Its callback body declares `const errno = error as NodeJS.ErrnoException;`, then calls `assert.deepStrictEqual` with `{ code: errno.code, syscall: errno.syscall }` and `{ code: "EISDIR", syscall: "read" }` as its two arguments, each on its own line, then returns `errno.message`. Copy the shape of the probe in tests/persistence/config-io.test.ts exactly; only the path argument differs. Do not copy the precedents' sentences about a fixture that drifts to ENOENT. They do not describe this case: a missing file makes production find no stubs and emit `moved` rows.

Step 3, the expectation. In the case's `// assert` phase, replace the hardcoded Node 26 message string on the `detail:` key with `readFailure.replaceAll(projectAdapterPath, "mcp-adapter.json")`. Use `replaceAll` with two string arguments, as `scopeTexts` in this file does. Keep the basename as the literal `"mcp-adapter.json"`, not `path.basename(...)`, so that the expected value stays independent. Do not call `redactAbsolutePaths` or any other production helper. Keep the single `assert.deepStrictEqual` over `{ rows: input.rows, log }`.

Step 4, nothing else. These stay byte-identical: the title, the arrange phase, the `commitPreparedMcp` override, the other row fields, the log expectation, the final `legacyBytes` assertion, the imports (`readFile` is already imported from `node:fs/promises`), and every other case. Add no import, helper, or export. Edit no production file.

Step 5, both runtimes. Run `node --test tests/orchestrators/reconcile/mcp-migration.test.ts` and `/usr/bin/node --test tests/orchestrators/reconcile/mcp-migration.test.ts`. Save each output to a scratchpad file, and read each exit status directly. Each run must exit 0 with 65 tests and 65 passing. Then run the grep checks from `<verify>`.

Step 6, commit. Run `SKIP=npm-check pre-commit run --files tests/orchestrators/reconcile/mcp-migration.test.ts`. If a fixer rewrites the file, run the command again until it passes clean. Stage the file by its explicit path with `git add tests/orchestrators/reconcile/mcp-migration.test.ts`. Never use `git add -A` or `git add .`. Write the message from this plan's `## Commit message` section to a file in your scratchpad. Then run `git commit -F <that file> -- tests/orchestrators/reconcile/mcp-migration.test.ts` in the foreground with the longest tool timeout available. Do not background it or poll for it. Its pre-commit pass runs `npm run check:commit`: the static checks, the unpaired tests, and direct coverage for this source-test pair. Read the whole hook output. In the first pass, `npm run check:commit` must show Passed. The second pass, for the commit message, always shows it as "(no files to check)" and Skipped, and that proves nothing. If a hook fails, the commit did not happen: fix the cause, restage, and commit again. Never use `--amend` or `--no-verify`. After the commit, run `git status --short`. It must not list the test file, because the prettier hook can rewrite a file during a commit. If it lists the file, commit the formatting change separately with its own Conventional Commit message.

Step 7, full gate. Run `npm run check` in the foreground, unpiped, with the longest timeout, and read its exit status directly. It must exit 0. Record the command, the exit status, the commit SHA, and the `node --version` output in the SUMMARY, as skills/local-verification/SKILL.md requires. This run uses Node 26, so it cannot show the Node 24 text; the `/usr/bin/node` run in Step 5 is the local proof of that form. If you work in an isolated executor worktree and not in the `features/mcp-4` checkout, say so in the SUMMARY. The orchestrator must then run `npm run check` again in the main checkout after the merge.

Step 8, hand-off. Do not push. After the operator pushes `features/mcp-4`, the PR #250 job "direct coverage (Node 24)" is the final proof. Record it in the SUMMARY as the open follow-up.
  </action>
  <verify>
    <automated>node --test tests/orchestrators/reconcile/mcp-migration.test.ts && /usr/bin/node --test tests/orchestrators/reconcile/mcp-migration.test.ts && test "$(grep -c 'illegal operation on a directory' tests/orchestrators/reconcile/mcp-migration.test.ts)" = 0 && test "$(grep -c "read 'mcp-adapter.json'" tests/orchestrators/reconcile/mcp-migration.test.ts)" = 0 && test "$(grep -c 'replaceAll(projectAdapterPath, "mcp-adapter.json")' tests/orchestrators/reconcile/mcp-migration.test.ts)" = 1 && test "$(grep -c 'code: "EISDIR", syscall: "read"' tests/orchestrators/reconcile/mcp-migration.test.ts)" = 1</automated>
  </verify>
  <acceptance_criteria>
    - Before the edit, `/usr/bin/node --test tests/orchestrators/reconcile/mcp-migration.test.ts` exits non-zero with 64 of 65 passing. The one failure is the AMIG-02 stub-probe case, on `detail`.
    - After the edit, `node --test tests/orchestrators/reconcile/mcp-migration.test.ts` (Node 26) and `/usr/bin/node --test tests/orchestrators/reconcile/mcp-migration.test.ts` (Node 22) each exit 0 with 65 of 65 passing.
    - `grep -c 'illegal operation on a directory' tests/orchestrators/reconcile/mcp-migration.test.ts` prints 0, and `grep -c "read 'mcp-adapter.json'" tests/orchestrators/reconcile/mcp-migration.test.ts` prints 0.
    - `grep -c 'replaceAll(projectAdapterPath, "mcp-adapter.json")' tests/orchestrators/reconcile/mcp-migration.test.ts` prints 1, and `grep -c 'code: "EISDIR", syscall: "read"' tests/orchestrators/reconcile/mcp-migration.test.ts` prints 1.
    - `git show --stat --format= <commit SHA>` names only `tests/orchestrators/reconcile/mcp-migration.test.ts`, and the commit title is `test(reconcile): read the EISDIR wording back from the runtime`.
    - The first hook pass of the commit shows `npm run check:commit` Passed, and `npm run check` exits 0 afterwards.
  </acceptance_criteria>
  <done>The AMIG-02 stub-probe case passes on Node 26 and on Node 22 with one exact whole-value assertion, whose detail comes from the runtime's own EISDIR read of the same directory with the NFR-9 basename mapping. One test-only Conventional Commit holds the change. The commit hook and `npm run check` passed. The SUMMARY records the evidence and the pending Node 24 CI proof on PR #250.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Test process to filesystem | The case reads and writes only inside its own temporary tree from `createHermeticEnvironment` (a `mkdtemp` directory under the OS temporary directory, removed by `t.after`). The new probe adds one read inside that tree. |
| Local commit to shared git state | The operator and other sessions share this checkout's index and the stash stack. |

The change adds no runtime trust boundary. It is test-only and adds no production code, network access, credential, or dependency.

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-261010-cfi-01 | Information disclosure | NFR-9 path-redaction coverage in the AMIG-02 stub-probe case | low | mitigate | The expected `detail` maps only the exact `projectAdapterPath` to the literal basename. So on Node 26 a row that shows the absolute path fails the case. During planning, a mutant without the mapping failed under Node 26 with the absolute path. The identity pin (code EISDIR, syscall read) keeps the probe from following a different failure without notice. |
| T-261010-cfi-02 | Tampering | The test's filesystem reach | low | accept | The probe reads one path inside the case's own hermetic tree. It writes nothing, and it touches no real home directory, repository file, or network resource. |
| T-261010-cfi-03 | Tampering | Commit contents in a checkout that the operator can edit at the same time | low | mitigate | Stage and commit by explicit path only (`git add <path>`, then `git commit -F <message file> -- <path>`). No `git add -A`, no stash, no amend, no history rewrite. `git show --stat` confirms that the commit holds one file. |
| T-261010-cfi-SC | Tampering | npm/pip/cargo installs | low | mitigate | The plan installs nothing: no `npm install` or `npm ci`, and no edit to `package.json` or `package-lock.json`. No package is [ASSUMED] or [SUS], so no legitimacy checkpoint applies. |

No threat reaches the `high` blocking threshold at ASVS level 1.
</threat_model>

<verification>
1. Task 1's `<verify>` passes: 65 of 65 on both runtimes, both negative grep counts 0, and both positive counts 1.
2. The commit's pre-commit pass ran `npm run check:commit` and passed. Read this from the first hook pass, not from the commit-msg pass.
3. `npm run check` exits 0 on the tree that holds the commit. It ran in the foreground and unpiped. The SUMMARY records the command, the exit status, the commit SHA, and the Node version. If the executor worked in an isolated worktree, the orchestrator runs `npm run check` again in the main checkout after the merge.
4. `git show --stat --format= <commit SHA>` lists only `tests/orchestrators/reconcile/mcp-migration.test.ts`.
5. After the operator pushes `features/mcp-4`, the PR #250 check "direct coverage (Node 24)" passes, and the "package manifest" and "sonarcloud" jobs run and are no longer skipped. This is the final proof, and it happens outside this run.
</verification>

<success_criteria>
- The AMIG-02 stub-probe case passes under Node 26 and under Node 22, and it stays one exact whole-value `assert.deepStrictEqual`.
- The test file hardcodes no EISDIR wording. The expected detail comes from the runtime's own read of the same directory, with the NFR-9 basename mapping.
- Exactly one test-only Conventional Commit exists for the change. The commit hook passed, and `npm run check` passed.
- After the push, the PR #250 job "direct coverage (Node 24)" passes.
</success_criteria>

<output>
Create `.planning/quick/261010-cfi-accept-node-24-and-26-eisdir-text-in-mcp/261010-cfi-SUMMARY.md` with `status: complete` in its frontmatter. Do not commit it: the orchestrator commits the docs. Record:

1. The `node --version` and `/usr/bin/node --version` outputs.
2. The baseline counts (Step 1) and the final counts (Step 5) for each runtime.
3. The commit SHA and title, and the result of the first hook pass.
4. The `npm run check` command, exit status, commit SHA, and Node version.
5. The open follow-up: the PR #250 job "direct coverage (Node 24)" after the push.
6. `## Threat Flags` (AGENTS.md). If nothing new appeared, write: "None -- no security-relevant surface outside the plan's `<threat_model>` was introduced."
</output>
