---
phase: 01-foundation-and-pi-1-5-0
plan: "01"
subsystem: infra
tags: [pi-coding-agent, pi-ai, pi-tui, npm, peer-dependency, e2e, docs]

requires: []
provides:
  - "Pi 1.5.0 peer floor (>=1.5.0) and dev pins (pi-coding-agent ^1.5.0, pi-tui ^1.5.0, pi-ai 1.5.0)"
  - "Regenerated package-lock.json and test/e2e/pi-peer-floor lock on Pi 1.5.0"
  - "Floor tests and the e2e peer-floor case asserting 1.5.0"
  - "Pi 1.5.0 version text in README pair, AGENTS.md, STACK.md, three compatibility docs, one source comment"
  - "One CHANGELOG Unreleased bullet for the raise"
affects: [01-02, 01-03, 01-05, 01-14, mcp-builtin child phases]

actuals:
  tokens: 13037
  tasks: 3
  commits: 2
plan_head_before: d8bba1bf9dc76655ad930f6c20177121a61319c3
plan_head_after: 6a87316a538e255a5472cd9556c2acb49fcf3dd9

tech-stack:
  added: []
  patterns: []

key-files:
  created: []
  modified:
    - package.json
    - package-lock.json
    - test/architecture/peer-floor.test.ts
    - test/e2e/pi-peer-floor/package.json
    - test/e2e/pi-peer-floor/package-lock.json
    - test/e2e/pi-json-output.test.ts
    - README.md
    - README.es.md
    - AGENTS.md
    - .planning/codebase/STACK.md
    - docs/workflows-compatibility.md
    - docs/mcp-compatibility.md
    - docs/hooks-compatibility.md
    - extensions/pi-claude-marketplace/bridges/skills/frontmatter-scan.ts
    - CHANGELOG.md

key-decisions:
  - "Automated package-legitimacy check (repository, maintainers, install scripts, integrity) replaced the human checkpoint for the Pi 1.5.0 trio (P1-DC-21); all three passed"
  - "Pi 1.5.0 needs no product code change: typecheck, unit, integration, cucumber, direct coverage, and pinned e2e all pass on the raised tree"
  - "No untrusted-profile scenario flips under Pi 1.5.0's isProjectTrusted() fix (17 untrusted-start scenarios pass)"

patterns-established: []

requirements-completed: [PI15-01, PI15-02, PI15-03]

coverage:
  - id: D1
    description: "package.json pins the Pi trio at 1.5.0 and the lock root mirrors the >=1.5.0 peer range"
    requirement: PI15-01
    verification:
      - kind: unit
        ref: "test/architecture/peer-floor.test.ts#package.json peerDependencies pins the pi-coding-agent floor at >=1.5.0 (FLOOR-01, VER-01)"
        status: pass
      - kind: unit
        ref: "test/architecture/peer-floor.test.ts#devDependencies pins pi-coding-agent and pi-tui at ^1.5.0 and pi-ai at exactly 1.5.0 (VER-01)"
        status: pass
      - kind: unit
        ref: "test/architecture/peer-floor.test.ts#package-lock.json root peerDependencies stays in sync with package.json for pi-coding-agent (FLOOR-01)"
        status: pass
      - kind: other
        ref: "npm ci --ignore-scripts --no-audit --no-fund (root lock, exit 0)"
        status: pass
    human_judgment: false
  - id: D2
    description: "The e2e peer-floor fixture installs exactly Pi 1.5.0 and pi-json-output reports it"
    requirement: PI15-02
    verification:
      - kind: e2e
        ref: "test/e2e/pi-json-output.test.ts#peer floor emits a schema-valid empty list with JSON stdin closed"
        status: pass
      - kind: other
        ref: "npm --prefix test/e2e/pi-peer-floor ci --ignore-scripts (exit 0)"
        status: pass
    human_judgment: false
  - id: D3
    description: "README.md, README.es.md, AGENTS.md, STACK.md, and the compatibility docs name Pi 1.5.0 as the floor"
    requirement: PI15-02
    verification:
      - kind: other
        ref: "! grep -q '1\\.4\\.0' README.md README.es.md AGENTS.md .planning/codebase/STACK.md (exit 0)"
        status: pass
    human_judgment: true
    rationale: "The grep proves the old floor is gone; whether the reworded hooks and MCP doc sentences read correctly is a prose judgment"
  - id: D4
    description: "The whole unit, integration, cucumber, direct-coverage, and pinned e2e suites pass on Pi 1.5.0 with no product code change"
    requirement: PI15-03
    verification:
      - kind: integration
        ref: "npm run test:integration (exit 0)"
        status: pass
      - kind: e2e
        ref: "npm run test:cucumber (1557/1557 scenarios)"
        status: pass
      - kind: unit
        ref: "npm run test:modules (exit 0); npm run test:unpaired (exit 0); npm run test:coverage:direct:all (328 records, exit 0)"
        status: pass
      - kind: e2e
        ref: "npm run test:e2e (exit 0)"
        status: pass
    human_judgment: false

duration: 30min
completed: 2026-11-04
status: complete
---

# Phase 1 Plan 01: Pi 1.5.0 Raise Summary

**The extension now requires Pi 1.5.0 (peer `>=1.5.0`, dev trio pinned at 1.5.0). Both locks are regenerated and verified against registry integrity, the floor tests and the e2e floor fixture prove 1.5.0, and every suite passes with no product code change.**

## Performance

- **Duration:** 30 min
- **Started:** 2026-11-04T03:58:48Z
- **Completed:** 2026-11-04T04:28:32Z
- **Tasks:** 3 (2 committed; Task 3 was verification only and needed no fix)
- **Files modified:** 15

## Accomplishments

- Pinned `@earendil-works/pi-coding-agent` peer `>=1.5.0` / dev `^1.5.0`, `@earendil-works/pi-tui` dev `^1.5.0`, and `@earendil-works/pi-ai` dev `1.5.0`. Regenerated `package-lock.json` and `test/e2e/pi-peer-floor/package-lock.json`.
- Updated the floor literals in `test/architecture/peer-floor.test.ts` (D-07-03 presence assertion and lock-sync case unchanged) and `test/e2e/pi-json-output.test.ts`.
- Named Pi 1.5.0 in the README pair, AGENTS.md, STACK.md, the workflows/MCP/hooks compatibility docs, and the `frontmatter-scan.ts` comment, and added one CHANGELOG bullet.
- Measured the whole tree on Pi 1.5.0: all suites green, no untrusted scenario flips, and no test quotes Pi's tool-validation text.

## Package legitimacy check (T-01-SC, automated per P1-DC-21)

`npm view <pkg>@<ver> repository.url maintainers scripts dist.integrity` for each package at 1.5.0 and 1.4.0:

| Package | Repository (1.5.0 = 1.4.0) | Maintainers (1.5.0 = 1.4.0) | preinstall/install/postinstall | 1.5.0 `dist.integrity` |
|---------|----------------------------|-----------------------------|-------------------------------|------------------------|
| `@earendil-works/pi-coding-agent` | `git+https://github.com/earendil-works/pi.git` | mitsuhiko, badlogic, rwachtler | none | `sha512-xNDZ5kqowO6Z03FS2gwAkPEGk1ssxVcYKQ6qZId84mFEvwACvvyc2l0vAMOS+c5zvxLRMLBE9r4y44IGYkMJaQ==` |
| `@earendil-works/pi-ai` | same | same | none | `sha512-VeWxNqTHSqRCf8AcY/6kvNwh+neRL6MPxZPePVztIQy6qqK9MR/YoCSN/ZgDnIyCD3pqEXgRyQbzk4KV4uvjbg==` |
| `@earendil-works/pi-tui` | same | same | none | `sha512-56KqrDVeLF18k+syppVbT35Ai1opbM44ot+sL7O3K40CaWwXCiwOpqEFugDBAILtAhseZh6uYIuYxPPOJHLFAA==` |

Result: **PASS**. The only script differences from 1.4.0 are build-time (`shx` replaced by `scripts/package-files.mjs`), and they do not run on install. The regenerated root lock records the same three integrity strings. The lock diff matches research exactly: it adds `@earendil-works/pi-schema` 1.5.0 (`sha512-RW0MbT2t...`), a nested `minimatch` 11.0.3, and `@isaacs/nonrecursive-glob-match` 1.0.3, drops the two nested `typebox` 1.3.27 copies, and moves `undici` 8.10.2 to 8.12.3. No new package has `hasInstallScript`. The three pre-existing ones (`@google/genai`, `protobufjs`, `unrs-resolver`) are unchanged.

## Measured results (PI15-03)

Node v24.22.1, commit `6a87316`, clean tree. The full gate ran in parts on the same commit:

| Command | Exit | Result | Duration |
|---------|------|--------|----------|
| `npm run check:static` | 0 | all 7 steps passed (run on the staged tree identical to `6a87316`) | ~70 s |
| `npm run test:unpaired` | 0 | pass | 21 s |
| `npm run test:integration` | 0 | pass | 57 s |
| `npm run test:cucumber` | 0 | 1557 scenarios / 16803 steps passed (seed 724111) | 5m 9s |
| `npm run test:coverage:direct:all` | 0 | 100% for every pair, 328 LCOV records merged | 161 s |
| `npm run test:modules` | 0 | pass | 153 s |
| `npm run test:e2e` | 0 | installed runtime and peer floor both report Pi 1.5.0 | 19 s |
| `npm ci --ignore-scripts` (root) | 0 | committed lock installs with integrity verified | 10 s |
| `npm --prefix test/e2e/pi-peer-floor ci --ignore-scripts` | 0 | fixture installs Pi 1.5.0 | — |

- **Untrusted-profile scenarios:** no flip. The five feature files that start Pi in an untrusted project were re-run on their own (`npx cucumber-js features/mcp-server/project-scope.feature features/agent/project-trust.feature features/plugin/project-trust.feature features/plugin/autoapply.feature features/skill/project-trust.feature`): 55/55 scenarios passed, 17 of them untrusted starts (1 MCP, 2 agent, 7 plugin via Background, 2 autoapply, 5 skill via Background). Pi 1.5.0's fix (pi#10947: a saved decision in `trust.json` now beats auto-trust) does not touch these scenarios, because the untrusted profile starts with no `trust.json` entry and a `.pi/settings.json`. No product trust code changed (D-LOC-01, D-MB-09).
- **pi-schema validation text:** no test or feature quotes Pi's tool-validation message (`Validation failed for tool`). It appears only under the installed fixture `node_modules`. The `must be boolean` / `must have required properties` expectations in `features/plugin/autoapply.feature` and `test/persistence/*` come from the extension's own typebox schemas.
- **`platform/pi-api.ts`:** `tsc` reported no Pi 1.5.0 break, so plan 01-05 has nothing to apply.
- `clientRegistration` needs no code (D-MB-11 as amended).

## Task Commits

1. **Task 1: Pin Pi 1.5.0, regenerate the locks, and prove the floor end to end** - `ec3a9b0` (build). The tracer gate re-ran the verify and it passed.
2. **Task 2: Name Pi 1.5.0 in the version text and add the one CHANGELOG line** - `6a87316` (docs)
3. **Task 3: Prove the whole tree passes on Pi 1.5.0** - no commit (no fix needed; results above)

## Files Created/Modified

- `package.json`, `package-lock.json` - Pi 1.5.0 pins and the regenerated lock
- `test/e2e/pi-peer-floor/package.json`, `test/e2e/pi-peer-floor/package-lock.json` - exact 1.5.0 fixture
- `test/architecture/peer-floor.test.ts` - 1.5.0 floor literals and titles
- `test/e2e/pi-json-output.test.ts` - expects 1.5.0 for the fixture manifest and runtime
- `README.md`, `README.es.md` - "1.5.0 or newer" / "1.5.0 o posterior"
- `AGENTS.md`, `.planning/codebase/STACK.md` - pins
- `docs/workflows-compatibility.md` - floor and scenario-basis statements on 1.5.0
- `docs/mcp-compatibility.md` - scenario basis on 1.5.0; the dated 2026-11-01 runs stay on 1.4.0
- `docs/hooks-compatibility.md` - auto-trust sentence on 1.5.0, plus the saved "Do not trust" behavior
- `extensions/pi-claude-marketplace/bridges/skills/frontmatter-scan.ts` - comment only
- `CHANGELOG.md` - one Unreleased bullet

## Decisions Made

- Followed the plan. The legitimacy check passed, so the install went ahead with no stop.

## Deviations from Plan

None. The plan was executed as written. The one wording adjustment in `docs/mcp-compatibility.md` line 9 is listed under Dubious Choices.

## Issues Encountered

- The commit hook printed "(no files to check)" for `npm run check:commit` inside the worktree, as the environment note predicted. `npm run check:static` and the touched tests were run by hand before each commit.
- The worktree sandbox rejected compound shell commands that mix git with variables, so git and npm steps ran as separate plain commands. The plan commit ledger file was not written. The base `d8bba1b` was verified at spawn and used directly for `git rev-list --count`.

## User Setup Required

None. No external service configuration is required.

## Next Phase Readiness

- Every later plan can build against Pi 1.5.0 (`pi.registerMcpServer`, `getMcpServers`).
- PI15-02 also names PROJECT.md's Pi API constraint, which plan 01-02 owns. PI15-01..03 stay unmarked in REQUIREMENTS.md until plan 01-14, which also declares them, finishes (shared-ID gate).

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## Dubious Choices

1. **Automated legitimacy check instead of a human checkpoint for the Pi 1.5.0 trio.** Chose: compare repository, maintainers, and install scripts against 1.4.0, and record the integrity strings. Alternative: stop at a `checkpoint:human-verify`. Why: the user ordered an unattended run, and the orchestrator accepted this as P1-DC-21. All checks passed, and `npm ci --ignore-scripts` verifies every sha512. Severity: Medium (the packages are two days old).
2. **The new transitive packages were not compared one by one against a prior release.** `@earendil-works/pi-schema` 1.5.0, `@isaacs/nonrecursive-glob-match` 1.0.3, and nested `minimatch` 11.0.3 have no 1.4.0 counterpart in this lock. Chose: check only that none has an install script and that the lock diff matches research. Alternative: run a full `npm view` maintainer audit on each one. Severity: Low.
3. **Reworded `docs/mcp-compatibility.md` line 9 beyond a token swap.** It said "a run of the same Pi and pi-mcp-adapter outside the cucumber harness, on 2026-11-01". After the swap to 1.5.0, "the same Pi" would wrongly mean 1.5.0. Chose: "a run of Pi 1.4.0 and pi-mcp-adapter 7.0.0". Alternative: leave the line unchanged, which keeps the run's Pi implicit and now wrong. Severity: Low.
4. **Added a second sentence to `docs/hooks-compatibility.md` line 344**: "Pi 1.5.0 honors a saved "Do not trust" answer for such a project too, and then its hooks do not run." The plan asked for the "honors" part. "and then its hooks do not run" follows from the paragraph's own rule. Source: Pi 1.5.0 CHANGELOG, pi#10947. No scenario exercises a saved "Do not trust" for a project with no settings files. Severity: Low.
5. **CHANGELOG bullet has no PR number.** The changelog rules want `(#N)` as the last token, but no PR exists yet, and the plan says "no PR number yet". The PR author must append it. Severity: Low.
6. **The full gate ran in parts, and `check:static` was reused from the pre-commit run on the same staged tree.** The parts ran in order on `6a87316`, not as one `npm run check`. Alternative: one chained `npm run check`, which risks exceeding the 10-minute foreground tool limit (cucumber alone took 5 min). The gates rule allows reusing evidence from this session for identical inputs. Severity: Low.
7. **Edited AGENTS.md (the project's agent-instructions file).** Only the Pi floor string changed. The plan lists the file and PI15-02 names it. Severity: Low.
8. **REQUIREMENTS.md left untouched.** Plan 01-14 also declares PI15-01..03 and has no SUMMARY, so the shared-ID gate would not mark them, and the orchestrator owns shared-file writes in this wave. Severity: Low.

## Self-Check: PASSED

- All 15 modified files exist and appear in `git diff --name-only d8bba1b..HEAD`.
- Commits `ec3a9b0` and `6a87316` are ancestors of HEAD. `git rev-list --count d8bba1b..HEAD` = 2 before this SUMMARY commit.
- All acceptance criteria of Tasks 1-3 were re-run and passed. Plan-level verification passed (`npm run check` parts, `test:modules`, `test:e2e`, `peer-floor.test.ts`).

---
*Phase: 01-foundation-and-pi-1-5-0*
*Completed: 2026-11-04*
