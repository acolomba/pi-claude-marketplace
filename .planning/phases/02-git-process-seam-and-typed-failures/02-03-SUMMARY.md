---
phase: 02-git-process-seam-and-typed-failures
plan: "03"
subsystem: platform
tags: [git, child-process, credential, hardening, eslint, fallow, rule-pack]

requires:
  - phase: 02-git-process-seam-and-typed-failures (02-01)
    provides: "platform/process-run.ts: runProcess, findOnWindowsPath, OutputCapture, stdin input, process-tree timeout"
  - phase: 02-git-process-seam-and-typed-failures (02-02)
    provides: "GitCommandError and the GitFailure kinds in shared/errors.ts"
provides:
  - "platform/git-process.ts: createGitProcess (absolute-PATH lookup that caches only a found git, D-SG-05 argv and environment, neutral directory with its ceiling, typed failures), NODE_GIT_HOST, NODE_GIT_SPAWN, NODE_GIT_PROCESS"
  - "git credential fill/approve/reject run through the git process module (CredentialGit port, NODE_CREDENTIAL_GIT = NODE_GIT_PROCESS)"
  - "The git process module is the sanctioned git spawn site: rule pack, shell-out whitelist, and a BLOCK C GIT_PROCESS_IMPORTERS zone"
affects: [02-04 stderr ladder and spawn backstops, 02-05 git-required gate, 02-06 local lane, 02-07 ssh, 02-08 docs, transport swap phase]

actuals:
  tokens: 27474
  tasks: 2
  commits: 2
plan_head_before: 7d5c54daf8494dbe5b04914de8ac69dffd92b04b
plan_head_after: 7ce5b31148a4824b6731a576d4ec3c44ea23e022

tech-stack:
  added: []
  patterns:
    - "Per-platform rule object (path flavor, variable-name matching, PATH entry unquoting, -c pair table) selected once, so the environment builder has no platform branches"
    - "Import-gate tables share one helper that computes each importer's real ESLint config, so a flat-config block that replaces another block's zones fails a row"

key-files:
  created:
    - extensions/pi-claude-marketplace/platform/git-process.ts
    - test/platform/git-process.test.ts
  modified:
    - extensions/pi-claude-marketplace/platform/git-credential.ts
    - extensions/pi-claude-marketplace/orchestrators/auth-host.ts
    - test/platform/git-credential.test.ts
    - test/orchestrators/auth-host.test.ts
    - rule-packs/architecture.json
    - eslint.config.js
    - test/architecture/gate-targets.ts
    - test/architecture/no-shell-out.test.ts
  deleted:
    - test/platform/credential-process-fake.ts

key-decisions:
  - "Three fallow-ignore-next-line unused-export markers in git-process.ts (createGitProcess, NODE_GIT_HOST, NODE_GIT_SPAWN): the module composes NODE_GIT_PROCESS itself, so no production module imports the factory pieces; a marker becomes stale and must go once a production module imports them"
  - "The child's PATH keeps only absolute entries and writes Windows entries unquoted"
  - "The Windows cwd refusal compares the candidate's directory, lexically and after realpath, with Pi's working directory, lexically and after realpath, ignoring case"
  - "E10 is proven three ways with real git (core.askPass, GIT_ASKPASS, SSH_ASKPASS); the GIT_ASKPASS row is the one that fails when the forced empty GIT_ASKPASS is removed, because -c core.askPass= alone already overrides a configured core.askPass"

patterns-established:
  - "A git failure's operation is the subcommand and its first Pi-owned word (`credential fill`), never an operand or the input (AUTH-09)"

requirements-completed: ["SG-PRC-01", "SG-PRC-02", "SG-PRC-03", "SG-PRC-05", "SG-PRC-06"]

coverage:
  - id: D1
    description: "git credential runs through the git process module with an argument array, no shell, an absolute git, stdin written then closed, the neutral directory, and a timeout that stops the process tree"
    requirement: "SG-PRC-01"
    verification:
      - kind: unit
        ref: "test/platform/git-process.test.ts#D-SG-04: spawns the first absolute git on PATH with the hardened argv and the neutral directory; #SG-PRC-01: rejects a run past its timeout with the limit after stopping its process tree"
        status: pass
    human_judgment: false
  - id: D2
    description: "The D-SG-05 hardening: forced non-interactive values over every Windows spelling, removed repository pointers and GIT_TEMPLATE_DIR, set-when-absent defaults, LC_MESSAGES=C with LC_ALL moved to LC_CTYPE, the ceiling at the parent of the real cwd, relative PATH entries dropped, the user's own git configuration kept"
    requirement: "SG-PRC-02"
    verification:
      - kind: unit
        ref: "test/platform/git-process.test.ts#SG-PRC-02, SG-PRC-03: forces the non-interactive values and keeps the user's git configuration; #SG-PRC-02: on Windows replaces every spelling of a forced variable and runs git.exe"
        status: pass
      - kind: integration
        ref: "test/platform/git-process.test.ts#E10: never runs the user's core.askPass / GIT_ASKPASS / SSH_ASKPASS program during a credential lookup (real git)"
        status: pass
    human_judgment: false
  - id: D3
    description: "A credential helper configured by a repository enclosing the neutral directory is never consulted"
    requirement: "SG-PRC-03"
    verification:
      - kind: integration
        ref: "test/platform/git-process.test.ts#SG-PRC-03: never consults the credential helper of a repository enclosing the neutral directory (real git)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Every failed run is a GitCommandError: timeout with its limit, aborted, git-missing (not-found, batch-launcher), refused-input, failed with exit code and redacted stderr; a missing cwd rejects with its own ENOENT"
    requirement: "SG-PRC-05"
    verification:
      - kind: unit
        ref: "test/platform/git-process.test.ts (45 pass); npm run test:coverage:direct -- platform/git-process.ts (100%)"
        status: pass
    human_judgment: false
  - id: D5
    description: "git is looked up on absolute PATH entries only, a miss is never cached, a found git is cached per PATH and working directory"
    requirement: "SG-PRC-06"
    verification:
      - kind: unit
        ref: "test/platform/git-process.test.ts#SG-PRC-06: gives git-missing for ... and spawns nothing; #NFR-2: finds a git installed after a lookup missed; #D-SG-04 cache rows"
        status: pass
    human_judgment: false
  - id: D6
    description: "The git process module is the one sanctioned git spawn site and only platform/git.ts and platform/git-credential.ts may import it"
    requirement: "SG-PRC-01"
    verification:
      - kind: unit
        ref: "test/architecture/no-shell-out.test.ts (14 pass); npm run lint; npm run fallow"
        status: pass
    human_judgment: false
  - id: D7
    description: "Windows behavior of the lookup, the `\\\\.\\NUL` hooks path, and taskkill on a real Windows host"
    verification: []
    human_judgment: true
    rationale: "Only fake-host rows cover win32 here; the roadmap plans one manual check on Windows for this phase."

duration: 34min
completed: 2026-11-23
status: complete
---

# Phase 2 Plan 03: The git process module and the credential launch Summary

**`platform/git-process.ts` starts every git process: an absolute git found on absolute PATH entries only, the D-SG-05 `-c` pairs and environment, the neutral directory with its ceiling, typed `GitCommandError` failures, and Node's spawn binding. `git credential` runs through it, so the user's askpass programs and the enclosing repository's credential helper no longer run.**

## Performance

- **Duration:** about 34 min
- **Started:** 2026-11-23T14:47:00Z
- **Completed:** 2026-11-23T15:20:50Z
- **Tasks:** 2
- **Files modified:** 11 (2 created, 8 modified, 1 deleted)

## Accomplishments

- `createGitProcess({ spawn, host, env, killGraceMs })` returns `{ locate, run }`. Construction does no I/O, and the instance keeps a found git per PATH value and working directory. A miss is never kept (NFR-2).
- The argv is the 47 hardening pairs in table order (28 hook keys among them), then the subcommand and the caller's options. The environment builder is a pure function. On Windows it removes every case spelling of a name before it sets the name.
- `git credential fill/approve/reject` runs as `git.run({ subcommand: "credential", options: [action], lane: "network", input, timeoutMs })` in the neutral directory. A non-zero exit rejects, so `fill` returns null and approve and reject debug-log the error message.
- Task 2 moved the spawn binding into the module (`NODE_GIT_SPAWN`, `NODE_GIT_PROCESS`). `NODE_CREDENTIAL_GIT` is `NODE_GIT_PROCESS`. The rule pack, `SHELL_OUT_EXEMPT_TARGETS`, the whitelist test, and a new BLOCK C zone changed in the same commit.

## Task Commits

1. **Task 1: Run git credential through a hardened createGitProcess** - `e1d6fd3` (feat, tracer, TDD: RED run locally, then RED+GREEN in one commit)
2. **Task 2: Move the spawn binding into the git process module and change its gates in the same commit** - `7ce5b31` (refactor, TDD: RED run locally, then RED+GREEN in one commit)

Tracer gate (Task 1): the mode is interactive with `human_verify_mode` at `end-of-phase`, and the verify block is automated only. All three verify commands were green before the commit, and the hook's `check:commit` passed. So execution went on to Task 2.

## TDD evidence

The commit hook runs typecheck and every architecture test, so it rejects a commit that holds only failing tests. Each RED below ran locally against the old sources (`node --test --test-reporter=tap`). RED and GREEN were then committed together, one commit per task. `workflow.tdd_mode` is off, so no separate `test(...)` commit was required.

**Task 1 RED** (base sources of `git-credential.ts` and `auth-host.ts`, no `git-process.ts`):
- `test/platform/git-process.test.ts`: exit 1, `ERR_MODULE_NOT_FOUND` for `platform/git-process.ts`. Semantic assessment: a load failure, which is the only RED a new module can have. It confirms that the module did not exist. It is not an assertion RED.
- `test/platform/git-credential.test.ts`: exit 1, 41 tests, 29 pass, 12 fail. Each failure is a target assertion. For example, "AUTH-08: fills a credential from the complete git wire response" got `null` for the expected credential. "sends a complete credential with the complete wire request to approve" got `[]` requests. The old protocol ignores the `git` option and spawns `undefined`. Six contract cases that need a stored credential failed for the same reason. Semantic assessment: valid RED on the planned assertions. The validation and miss cases passed in RED, because the old protocol already gives those answers.
- `test/orchestrators/auth-host.test.ts`: exit 0, 49 pass. The composition case only asserts that composing launches nothing, which the old code also did. It pins that the new composition keeps this property.

**Task 1 GREEN:** 41 + 41 + 49 + 34 (fake contract) pass. Direct coverage is 100% for `git-process.ts`, `git-credential.ts`, and `auth-host.ts`. typecheck, eslint, fallow, `no-shell-out.test.ts`, and `no-credential-leak.test.ts` are clean.

**Mutation checks on the real-git cases:** removing the forced empty `GIT_ASKPASS` fails the `GIT_ASKPASS` row. Removing it and `core.askPass=` together fails all three E10 rows. Removing the `GIT_CEILING_DIRECTORIES` line fails the enclosing-repository helper case. Each case discriminates.

**Task 2 RED** (Task 1 sources of `git-process.ts`, `git-credential.ts`, the rule pack, `eslint.config.js`, and `gate-targets.ts`):
- `test/architecture/no-shell-out.test.ts`: exit 1, 14 tests, 9 pass, 5 fail. The four forbidden git-process importer rows got `[]` instead of `['import-x/no-restricted-paths']`, and the whitelist got `platform/git-credential.ts` where `platform/git-process.ts` was expected. Semantic assessment: valid RED on the planned assertions. The two allowed-importer rows and the six package-runner rows passed, and they pin that the new BLOCK C composition keeps them.
- `test/platform/git-process.test.ts` and `test/platform/git-credential.test.ts`: exit 1, `SyntaxError: ... does not provide an export named 'NODE_GIT_PROCESS'`. This is a load failure for a new export.

**Task 2 GREEN:** 14 + 114 + 45 + 42 pass. Direct coverage is 100% for both pairs. typecheck, `npm run lint` (`--max-warnings 0`), and `npm run fallow` (rule-pack test included) are clean.

## Files Created/Modified

- `extensions/pi-claude-marketplace/platform/git-process.ts` - the git process module: types, lookup, hardened argv and environment, run, typed failures, the Node bindings
- `extensions/pi-claude-marketplace/platform/git-credential.ts` - the credential protocol over the `CredentialGit` port. `NODE_CREDENTIAL_GIT` is the production binding. The module spawns nothing.
- `extensions/pi-claude-marketplace/orchestrators/auth-host.ts` - `DEFAULT_CREDENTIAL_OPS = createCredentialOps({ git: NODE_CREDENTIAL_GIT, timeoutMs })`
- `test/platform/git-process.test.ts` - fake-host table rows for POSIX and Windows, exit mapping, timeout and abort with mocked timers, real-git E10 and enclosing-repository cases, `NODE_GIT_HOST` real-file cases, binding cases
- `test/platform/git-credential.test.ts` - rewritten over a local recording `CredentialGit` and the shared contract
- `test/orchestrators/auth-host.test.ts` - the composition case uses a recording `CredentialGit` whose `run` throws
- `test/platform/credential-process-fake.ts` - deleted. Its only importer was the old credential test.
- `rule-packs/architecture.json` - `child-process-chokepoint` names the git process module (D-SG-01). The `no-network-modules` message names the git subprocesses.
- `eslint.config.js` - `GIT_PROCESS_IMPORTERS`, `PACKAGE_MANAGER_ZONE`, `GIT_PROCESS_ZONE`, and the four-block BLOCK C layout
- `test/architecture/gate-targets.ts`, `test/architecture/no-shell-out.test.ts` - the whitelist swap, the D-SG-01 header, the shared `importViolations` helper, and the git process import-gate table

## Decisions Made

- The PATH of the child is rewritten under each of its spellings, with only its absolute entries. Windows entries are written unquoted (orchestrator answer 6).
- On Windows, a candidate is skipped when its directory, lexically or after `realpath`, is Pi's working directory or lies below it, lexically or after `realpath`, ignoring case. A candidate on another drive is outside.
- The git-missing error's operation is `lookup`. Every other error's operation is the subcommand plus its first option.
- `settleRun` checks the abort first, so an abort during the lookup or the run reports `aborted` even when the launcher then reports a start error.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] fallow reported the factory pieces as unused exports once the module composed NODE_GIT_PROCESS itself**
- **Found during:** Task 2
- **Issue:** After `git-credential.ts` imported only `NODE_GIT_PROCESS`, `fallow dead-code` (production mode) reported `createGitProcess`, `NODE_GIT_HOST`, and `NODE_GIT_SPAWN` as unused exports, and `GitProcessHost` and `GitProcessOptions` as unused types. Only tests import them, and the plan's artifacts require all of them.
- **Fix:** I added three `fallow-ignore-next-line unused-export` markers, each with a `--` justification. The types are no longer reported once the factory counts as used. git-process.ts is not frozen. When a production module imports one of these names, as the injected runner of the transport swap phase will, fallow reports its marker as stale, so the marker has to be removed then.
- **Files modified:** `extensions/pi-claude-marketplace/platform/git-process.ts`
- **Verification:** `npm run fallow` passes.
- **Committed in:** `7ce5b31`
- **Follow-up:** CONVENTIONS.md counts the repo's `fallow-ignore` markers (51, 13 of them `unused-export`). The count is now 54 and 16. Plan 02-08 owns the `.planning/codebase/*.md` updates.

**2. [Rule 1 - Plan conflict] One acceptance grep contradicts the plan's own behavior row**
- **Found during:** Task 2
- **Issue:** The criterion `grep -c '"platform/git-credential.ts"' test/architecture/no-shell-out.test.ts -eq 0` returns 1. The behavior list requires the import-gate row `{ importer: "platform/git-credential.ts", violations: [] }`, which is that one match.
- **Fix:** None needed in code. The sorted whitelist no longer names `platform/git-credential.ts`, which is the criterion's intent. The only match is the allowed-importer row.
- **Verification:** `grep -n '"platform/git-credential.ts"'` shows only line 64, the import-gate row.

---

**Total deviations:** 2 (1 blocking gate fix, 1 plan conflict recorded).
**Impact on plan:** The exports, the behavior, and the gates match the plan. There is no scope change.

## Issues Encountered

- The first Task 1 commit attempt failed in the hook before it ran any check. My commit script rebuilt `PATH` without `/usr/local/go/bin`, so pre-commit tried to download a Go toolchain for `yamlfmt` through the proxy. I kept the session `PATH` with the Node wrapper first, and the retry passed every hook. No commit was amended, and no hook was skipped.

## Lines for later plans

Final exports of `platform/git-process.ts`:

- Types: `GitLane` (`"network"`), `GitSubcommand` (`"credential"`), `GitRequest`, `GitResult` (`{ exitCode, stdout, stderr }`), `GitProcessHost` (`ProcessHost` + `isExecutable`, `realpath`, `cwd`, `tmpdir`), `GitProcessOptions` (`{ spawn, host, env, killGraceMs }`), `GitProcess` (`{ readonly locate: () => Promise<string>; readonly run: (request: GitRequest) => Promise<GitResult> }`, members declared as properties).
- Values: `createGitProcess`, `NODE_GIT_HOST`, `NODE_GIT_SPAWN`, `NODE_GIT_PROCESS`. The first three carry `fallow-ignore-next-line unused-export` markers (see Deviation 1).
- `GitRequest` = `{ readonly subcommand: GitSubcommand; readonly lane: GitLane; readonly options?: readonly string[]; readonly cwd?: string; readonly input?: string; readonly timeoutMs: number; readonly signal?: AbortSignal; readonly allowExit?: readonly number[] }`.
- `platform/git-credential.ts` exports `CredentialGit = Pick<GitProcess, "run">`, `CreateCredentialOpsOptions = { git; timeoutMs }`, and `NODE_CREDENTIAL_GIT` (the same object as `NODE_GIT_PROCESS`).
- Private names a later plan edits: `configPairs(hooksPath)` (the `-c` table), `REMOVED_VARIABLES`, `FORCED_VARIABLES` (`LC_MESSAGES` is in it), `DEFAULT_VARIABLES`, `WINDOWS_RULES` and `POSIX_RULES`, `gitEnvironment(base, rules, cwd)`, `gitArguments(request, rules)`, `findGitOnPosix`, `findGitOnWindows`, `operationOf`, and `settleRun(run, request, operation)`. The last `throw` of `settleRun` is the disallowed-exit mapping that the stderr ladder replaces.
- Test support: `test/platform/git-process.test.ts` has local `createHost(setup)`, `startedLauncher(control)`, `createFakeGit(env, setup)`, `gitFailure(expected)`, `caseDirectory(t)`, `recordingScript(root, name, output)`, and the template-literal `hardening(hooksPath)` expectation. These are local to that file. A later plan that copies one into another file makes a `fallow dupes` clone group.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

The mitigations hold. T-02-09: the POSIX, Windows batch-launcher, and cwd-skip lookup rows. T-02-10: the three real-git E10 rows. T-02-11: the real-git enclosing-repository case. T-02-12: the full argv rows. T-02-13: the environment row with all 12 pointer variables. T-02-14: the timeout row with the group SIGTERM and SIGKILL. T-02-15: the rule pack, the whitelist test, and the BLOCK C zone in one commit, checked by the computed-config import-gate table. T-02-16: the operation is `credential <action>`, stderr is redacted, approve and reject log only the error message, and `no-credential-leak.test.ts` passes.

## User Setup Required

None. No external service needs configuration.

## Next Phase Readiness

- Plan 02-04 can replace the last mapping in `settleRun` with the stderr ladder, and add the macOS shim check and the spawn backstops in `locate`/`run`.
- Plan 02-05 can import `NODE_GIT_PROCESS` in `platform/git.ts`. The BLOCK C zone allows that importer.
- `npm run check` on the combined tree is left to the wave gate.

## Self-Check: PASSED

- FOUND: extensions/pi-claude-marketplace/platform/git-process.ts
- FOUND: test/platform/git-process.test.ts
- ABSENT (deleted as planned): test/platform/credential-process-fake.ts
- FOUND: e1d6fd3, 7ce5b31 (both ancestors of HEAD)
