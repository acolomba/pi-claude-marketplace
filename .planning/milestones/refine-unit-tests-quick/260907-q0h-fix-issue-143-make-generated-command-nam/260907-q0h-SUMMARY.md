---
phase: 260907-q0h
plan: 01
subsystem: commands
tags: [windows, ntfs, filename, command-name, platform, domain, bridges]

requires:
  - phase: v1.18 command nesting (#141)
    provides: the `generatedCommandName` segment-join site and the D-141-02 head rule this change parameterizes
provides:
  - "`platform/os.ts` exposing `commandNamespaceSeparator()`: `-` on win32, `:` elsewhere, read per call"
  - "`generatedCommandName` joins its segments with that separator instead of a literal colon"
  - "`tests/platform/case-platform.ts`, the shared one-case `process.platform` stub"
  - "doc comments in `domain/name.ts` and `bridges/commands/stage.ts` that state the real separator contract"
  - "a CHANGELOG `## [Unreleased]` bullet crediting @ricardofrantz"
affects: [command materialization on Windows, any future reader of a generated command name]

actuals:
  tokens: 2959
  tasks: 3
  commits: 3
plan_head_before: 3d6498de458ed446d9936ba3ad683d62cf4db502

tech-stack:
  added: []
  patterns:
    - "A host-OS fact reaches `domain/` through a `platform/` leaf, the sibling import both boundary gates already allow"
    - "A `process.platform` stub lives in one shared test-support module rather than a per-suite copy"

key-files:
  created:
    - extensions/pi-claude-marketplace/platform/os.ts
    - tests/platform/os.test.ts
    - tests/platform/case-platform.ts
  modified:
    - extensions/pi-claude-marketplace/domain/name.ts
    - extensions/pi-claude-marketplace/bridges/commands/stage.ts
    - tests/domain/name.test.ts
    - CHANGELOG.md

key-decisions:
  - "`process.platform` is read inside the function body, not captured at import: a module-level constant would be unstubbable and leave the win32 arm untestable."
  - "The Windows name collision (`foo.md` and `acme-foo.md` both reaching `acme-foo`) is accepted, not coded around: the D-07 first-wins discovery skip already resolves it with a warning, and `generatedSkillName` has carried the same shape since it shipped."
  - "Work landed as three atomic commits rather than the plan's single commit, per the executor's per-task commit constraint."

patterns-established:
  - "Platform-dependent naming: the branch lives in `platform/`, the caller stays branch-free, and the pair-level coverage of the caller is unchanged."

requirements-completed: [ISSUE-143]

coverage:
  - id: D1
    description: "`commandNamespaceSeparator()` returns `-` on win32 and `:` on darwin and linux, read per call"
    requirement: "ISSUE-143"
    verification:
      - kind: unit
        ref: "tests/platform/os.test.ts#separates a command namespace with \"-\" on win32"
        status: pass
      - kind: unit
        ref: "node scripts/test-coverage-direct.mjs extensions/pi-claude-marketplace/platform/os.ts (branches 4/4, functions 1/1, lines 20/20)"
        status: pass
    human_judgment: false
  - id: D2
    description: "`generatedCommandName` joins with `-` on win32 for flat, elided, nested, and D-141-02 head-preserving sources, and is byte-identical on POSIX"
    requirement: "ISSUE-143"
    verification:
      - kind: unit
        ref: "tests/domain/name.test.ts#describe(generatedCommandName) — 5 win32 rows plus 12 unchanged POSIX rows"
        status: pass
      - kind: unit
        ref: "node scripts/test-coverage-direct.mjs extensions/pi-claude-marketplace/domain/name.ts (branches 33/33, functions 4/4, lines 166/166)"
        status: pass
    human_judgment: false
  - id: D3
    description: "The whole quality gate stays green with the change in place"
    verification:
      - kind: integration
        ref: "npm run check (exit 0: typecheck, lint, fallow, format:check, both correspondence gates, direct-coverage negative control, 5244 unit tests, 31 integration tests)"
        status: pass
    human_judgment: false
  - id: D4
    description: "A Windows user can install a plugin carrying a `commands/` directory"
    verification: []
    human_judgment: true
    rationale: "No Windows host is available here. Every arm is proven through a stubbed `process.platform`, which proves the name, not the NTFS write that rejected it. The end-to-end claim needs a real Windows install."

duration: 25min
completed: 2026-09-07
status: complete
---

# Quick Task 260907-q0h: Platform-Dependent Command Name Separator

**A generated command name now joins with `-` on Windows and `:` everywhere else, so a plugin carrying a `commands/` directory materializes a basename NTFS accepts (#143).**

## Performance

- **Duration:** 25 min
- **Started:** 2026-09-07T22:52:00Z
- **Completed:** 2026-09-07T23:17:00Z
- **Tasks:** 3 of 3
- **Files modified:** 7 (3 created, 4 modified)

## Accomplishments

- **The bug is fixed at its single join site.** `domain/name.ts` had the only `join(":")` in `extensions/`, and nothing anywhere reverse-parses a generated command name, so parameterizing that one argument is the whole change.
- **The branch is testable because the read is per call.** `commandNamespaceSeparator()` reads `process.platform` inside the function body, so one process observes both return values and the pair reaches 4/4 branches.
- **POSIX output is provably unchanged.** All twelve pre-existing `generatedCommandName` rows run with no stub in place and still return their colon-joined names.
- **Three comment blocks stopped lying.** `domain/name.ts` hardcoded the colon in six places and `bridges/commands/stage.ts` said "Windows is explicitly not targeted"; both now state the platform-dependent contract, and `stage.ts` has no executable-line diff.
- **The Windows collision is recorded where a reader meets it,** in the `generatedCommandName` doc comment, naming the D-07 first-wins skip that already resolves it. The D-07 claim was verified in `bridges/commands/discover.ts` before being cited.

## Task Commits

1. **Task 1 (tracer): generate one win32 command name end-to-end** - `bf53dec0` (fix)
2. **Task 2: complete the win32 rows and rewrite the colon comments** - `32b9107d` (docs)
3. **Task 3: CHANGELOG entry** - `4a479232` (docs)

No plan-metadata commit: the orchestrator owns the docs commit.

## Files Created/Modified

- `extensions/pi-claude-marketplace/platform/os.ts` (created) - one exported `commandNamespaceSeparator(): string`, importing nothing, reading `process.platform` per call
- `tests/platform/os.test.ts` (created) - the direct owner pair; three rows (`win32`, `darwin`, `linux`) as sibling cases
- `tests/platform/case-platform.ts` (created) - the shared `setCasePlatform(t, platform)` stub; `defineProperty` in, captured descriptor back out through `t.after()`
- `extensions/pi-claude-marketplace/domain/name.ts` - imports the separator and joins with it; `generatedCommandName` and `generatedSkillName` doc comments and the join-site note rewritten
- `extensions/pi-claude-marketplace/bridges/commands/stage.ts` - comment-only: storage layout and the staged-filename note
- `tests/domain/name.test.ts` - five win32 rows in a second loop inside the existing `describe`; POSIX and rejection rows untouched
- `CHANGELOG.md` - `## [Unreleased]` with one 36-word bullet

## Decisions Made

1. **The read happens per call.** A module-level constant computed at import would freeze the value, make it unstubbable, and leave one arm of the ternary permanently uncovered — which the direct-coverage gate would then have no honest way to satisfy.
2. **The Windows collision is accepted, not coded around.** With `-`, plugin `acme` maps both `commands/foo.md` and `commands/acme-foo.md` to `acme-foo`. `bridges/commands/discover.ts` was read to confirm the D-07 first-wins dedup warns and names the winner before that claim went into a comment. No new code; skills have had this shape all along.
3. **`generatedSkillName`'s comment was qualified rather than deleted.** It said skills "cannot use the colon separator that command prompt filenames use", which is false on Windows; it now says "carry on POSIX". The function is unchanged.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `node_modules` was absent in this worktree**

- **Found during:** Task 1 (first `npm run typecheck`)
- **Issue:** `tsc` reported 5,350 errors, all `Cannot find name 'node:crypto'` / `Cannot find namespace 'NodeJS'` / `Cannot find module 'write-file-atomic'` — the dependency tree was never installed here, so no gate in the plan could run. The plan's Fact 7 assumed `npm run check` ran end to end in this checkout.
- **Fix:** `npm ci`, which restores exactly the lockfile-pinned set. No package name was introduced, chosen, or substituted, so the package-manager exclusion on Rule 3 does not apply.
- **Files modified:** none (`node_modules/` is ignored)
- **Verification:** `npm run typecheck` exits 0 with no output; `npm run check` later exits 0 end to end.
- **Committed in:** nothing to commit

**2. [Process] Three commits instead of one**

- **Found during:** Task 3
- **Issue:** The plan's Task 3 asked for one commit carrying all seven paths; the executor's standing constraint is one atomic commit per task.
- **Fix:** The constraint won. Tasks 1, 2 and 3 committed separately (`bf53dec0`, `32b9107d`, `4a479232`), together carrying exactly the seven planned paths and nothing else.
- **Verification:** `git diff --stat 3d6498de..HEAD` lists the seven planned paths; `git status --short` shows only the untracked planning directory.

---

**Total deviations:** 2 (1 Rule 3 auto-fix, 1 process). **Impact:** none on the delivered behavior. No scope creep.

### Gate-forced expansion: NOT triggered

The plan anticipated that `fallow dupes` would flag `tests/platform/case-platform.ts` as a third occurrence of the `setCasePlatform` idiom (`duplicates.threshold: 3`), and pre-authorized pointing `tests/bridges/hooks/async-rewake/registry.test.ts` and `tests/bridges/hooks/event-router.test.ts` at the shared module as the remedy.

**It did not fire.** `npm run fallow` exits 0 and its dupes report names neither `case-platform` nor `setCasePlatform`. Those two files are therefore untouched, and the change stayed inside the five locked items.

## Issues Encountered

- **The `import-x/order` gate rejected the first form of `tests/platform/os.test.ts`:** the production import (`../../extensions/...`, parent group) and `./case-platform.ts` (sibling group) need a blank line between them. Fixed before the Task 1 commit.
- **`npm run check` reached the end.** The plan warned that `format:check` can short-circuit on operator-owned untracked files, and that two integration cases resolving `pi-subagents` from the global npm root can fail on a stale global install. Neither happened: `npm ci` put `pi-subagents` in the local tree, and all 31 integration cases passed.
- **The trufflehog pre-commit hook failed structurally on all three commits,** as CLAUDE.md documents for a linked worktree (`.git` is a file, so the git-mode scan cannot read `.git/index`). Each commit was preceded by a clean filesystem-mode scan over its own paths (`verified_secrets: 0`, `unverified_secrets: 0`) and used `SKIP=trufflehog`. No other hook was skipped and `--no-verify` was never used.

## Measurement Notes

- **`domain/name.ts` pre-change coverage was not re-measured in isolation.** Its post-change reading is 100% line / 100% branch / 100% function (branches 33/33, functions 4/4, lines 166/166), matching the complete reading this pair already held. The pre-change number cannot be re-taken with the current suite, because the win32 rows the suite now carries are unsatisfiable by the pre-change source. The change adds no branch to `name.ts` — the ternary lives in `os.ts` — and the line denominator moved with the rewritten doc comment, since Node's line coverage counts every line in the file, comments included.
- **`actuals.tokens` is `estimateTokens` (chars/4) over the realized diff:** 11,837 diff characters. The plan's `estimate.tokens: 55000` is a projected agent-spend figure, so the two numbers are not on the same scale and the gap is not a 19x overestimate of the work.

## Deferred Follow-Up

Comments elsewhere in the commands bridge still spell the generated name with a colon. The plan put them out of scope deliberately; some of these lines describe what Claude Code registers upstream and stay true, while the ones describing **our** generated name go stale on Windows. Splitting them needs a line-by-line pass:

- `extensions/pi-claude-marketplace/bridges/commands/discover.ts:16` — `"<plugin>:build:web", one colon per path segment` (describes our name; stale on Windows)
- `extensions/pi-claude-marketplace/bridges/commands/discover.ts:19-20` — `acme:build:web` / `acme:build:web:prod` (describes what Claude Code registers; still true)
- `extensions/pi-claude-marketplace/bridges/commands/discover.ts:31` — `generated command name ('<plugin>:<command>' per RN-1)` (describes our name; stale on Windows)
- `extensions/pi-claude-marketplace/bridges/commands/discover.ts:35` — `acme:tools:lint under D-141-01` (describes our name; stale on Windows)
- `extensions/pi-claude-marketplace/bridges/commands/types.ts:32-33` — `'<plugin>:<command>' after CM-2 elision, with nested path segments joined by ':'` (describes our name; stale on Windows)

Also out of scope and still pending: the version bump in `package.json`, `package-lock.json`, and `sonar-project.properties`, which happens at PR time per repo convention.

## Known Stubs

None. No hardcoded empty value, placeholder string, TODO, FIXME, skipped test, or unrun `<verify>` was introduced.

## Threat Flags

None. The change introduces no network endpoint, auth path, or schema change. Both separators were already inside RN-2's allowed set, and the unchanged chokepoints still run on the joined form: `assertSafeName(generated)` in `domain/name.ts`, and `assertPathInside` on both the staged and target paths in `bridges/commands/stage.ts`.

## Self-Check: PASSED

- Files exist: `extensions/pi-claude-marketplace/platform/os.ts`, `tests/platform/case-platform.ts`, `tests/platform/os.test.ts` — all FOUND.
- Commits exist: `bf53dec0`, `32b9107d`, `4a479232` — all FOUND in `git log`.
- Measured commit count from `3d6498de..HEAD`: 3, matching `actuals.commits`.
- `git diff --stat 3d6498de..HEAD` lists exactly the seven planned paths.
