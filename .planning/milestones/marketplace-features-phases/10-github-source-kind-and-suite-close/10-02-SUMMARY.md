---
phase: 10-github-source-kind-and-suite-close
plan: "02"
subsystem: testing
tags: [cucumber, git-host, stand-in, node-24, HOST-01, HOST-03, HOST-04, D-14]
status: complete

requires:
  - phase: 10-github-source-kind-and-suite-close
    provides: "10-01: the github kind through the base override, on the same HttpsGitHost"
provides:
  - "runHttpBackend tolerates an EPIPE on the CGI's stdin; the backend's exit code decides (D-14, HOST-EPIPE)"
  - "Arms match the decoded, URL-resolved path the CGI serves; an undecodable path answers 500 before any arm check (IN-06)"
  - "A cut-off response logs `dropped`, not 500 (IN-09); the GitHostArm and GitHostRequest.status docs match what the host does (IN-03)"
  - "tests/architecture/https-git-host-server.test.ts: live-host cases for the 500 path, an unread GET body, and a percent-encoded armed repository (IN-10)"
  - "Run hooks that free the git host and the run root on a partial failure, reporting one AggregateError (IN-07)"
  - "The IN-04 comment, the folded url-source CHANGELOG entry (IN-02), and the redacted-source id wording (IN-08)"
  - "Node 24.21.0 evidence: three whole-suite runs at 379/379"
affects: [10-04, 10-07]

actuals:
  tokens: 6200
  tasks: 2
  commits: 3
plan_head_before: f8f7b3962eabae6e10da22ee9c536dfd19295f3f
plan_head_after: a8ec3abc6de46d5089f4788d2eb5f7dcb68c19ac

tech-stack:
  added: []
  patterns:
    - "A live-host architecture case starts a real HttpsGitHost per case in its own mkdtemp root, sends over node:https with the host's CA (verification on), and compares the status and the request log as one value"
    - "Run teardown runs its stages in order through settleInOrder and throws one AggregateError"

key-files:
  created:
    - tests/architecture/https-git-host-server.test.ts
  modified:
    - features/lib/https-git-host/cgi.ts
    - features/lib/https-git-host/server.ts
    - tests/architecture/https-git-host-cgi.test.ts
    - features/support/pi-process.ts
    - features/step_definitions/marketplace/git-host.steps.ts
    - CHANGELOG.md
    - docs/json-output.md

key-decisions:
  - "The unread-body case GETs the plain file /acme/tools.git/HEAD, not info/refs: for info/refs the backend forwards a GET body to upload-pack and exits 141 on SIGPIPE, which correctly stays a 500 after the fix"
  - "Each live-host case starts its own host and root (typescript-unit-tests: fresh state and one mkdtemp per case), not one host in before()"
  - "ADD-11 and UPD-12 are not marked complete here; their 401 rows belong to plan 10-04"

patterns-established:
  - "settleInOrder(stages) in features/support/pi-process.ts: ordered stages, every failure collected"

requirements-completed: []

duration: 14min
completed: 2026-10-21
---

# Phase 10 Plan 02: Git host EPIPE fix and Phase 9 info findings Summary

**The git host now answers from the backend when `git http-backend` exits before reading its stdin, matches arms on the decoded path the CGI serves, and logs `dropped` for a cut-off answer. New live-host cases cover all three. The run hooks free the host and root on a partial failure, the url-source CHANGELOG lines are one entry, and three whole-suite runs on Node 24.21.0 pass 379 of 379.**

## Performance

- **Duration:** about 14 min
- **Started:** 2026-10-21T14:02:15Z
- **Completed:** 2026-10-21T14:16Z
- **Tasks:** 2
- **Files modified:** 8 (1 created, 7 modified)

## Accomplishments

- D-14 (HOST-EPIPE): `runHttpBackend`'s stdin error handler ignores `EPIPE` and rejects on any other error. The exit code still decides, so a backend that fails still answers 500.
- IN-06: `receive` computes `servedPath` once: `decodeURIComponent(new URL(req.url, origin).pathname)`, the same value `cgiEnvironment` gives the CGI as `PATH_INFO`. `armFor` reads that path. An undecodable path answers 500 (logged) through `answerServerError` before any arm check. The log keeps the path as sent.
- IN-09: `answerServerError` logs `dropped` in the `headersSent` branch and 500 only when it really sends a 500. The `GitHostRequest.status` doc now says that `dropped` means the host destroyed the connection, by an arm or after a failure.
- IN-03: the `GitHostArm` doc says that an arm fails until the next reset, and that the drop arm drops the connection on every request.
- IN-10 / D-14 / IN-06: three live-host cases in `tests/architecture/https-git-host-server.test.ts`.
- IN-01: the no-blank-line parser case asserts `{ name, message }`, and a new case pins `the CGI response header "NoColon" has no colon`.
- IN-07: `BeforeAll()` closes the host and removes the root when `PiProcess.start` rejects, then rethrows. A cleanup failure joins the start error in one `AggregateError`. `AfterAll()` returns when no run exists. Otherwise it stops Pi, closes the host, and removes the root, in that order, runs every stage, and throws one `AggregateError`.
- IN-04: the comment above `the git host receives no request` uses the review's wording.
- IN-02 / IN-08: the two url-source CHANGELOG bullets are now one top-level entry with two sub-bullets, and every sentence has 25 words or fewer. The `Unreleased` top-level count went from 15 to 14. The `docs/json-output.md` plugin-row `id` meaning says that a failed `marketplace add` that has a child row names the source after redaction, and its id is that name alone.

## Task Commits

| Commit | Type | Content | Findings fixed |
|--------|------|---------|----------------|
| `7129ac02` | fix | Task 1: EPIPE tolerance, decoded arm path, `dropped` log, docs, live-host and parser cases | D-14, IN-01, IN-03, IN-06, IN-09, IN-10 |
| `72eac098` | test | Task 2: run hooks free the host and root; the keep-alive comment | IN-07, IN-04 |
| `a8ec3abc` | docs | Task 2: CHANGELOG fold and the redacted-source id wording | IN-02, IN-08 |

**Plan metadata:** the `docs(planning)` commit that follows this SUMMARY.

## RED Runs (Task 1, on the unchanged stand-in)

Command: `node --test tests/architecture/https-git-host-server.test.ts tests/architecture/https-git-host-cgi.test.ts`. On Node 24, the same command ran under `npx --prefer-offline -y -p node@24.21.0 -- node`.

| Case | Node 26.11.1 | Node 24.21.0 |
|------|--------------|--------------|
| answers 500 to a path that does not decode and keeps serving | pass | pass |
| answers a GET from the backend when the backend never reads its body | **fail** (answered and logged 500) | **fail** (answered and logged 500) |
| fails an armed repository whose name the request percent-encodes | **fail** (answered and logged 200) | **fail** (answered and logged 200) |
| throws on output with no blank line after its headers (message pinned) | pass | pass |
| throws on a header with no colon | pass | pass |

Summary on each runtime: `ℹ tests 18`, `ℹ pass 16`, `ℹ fail 2`, exit 1. The first RED run used the plan's `info/refs` path for the unread-body case. After the deviation below, the case moved to `/acme/tools.git/HEAD`. The original `cgi.ts` and `server.ts` were restored with `git checkout --`, and the RED run was repeated twice per runtime. All four runs gave the same two failures. The fixed files were then copied back from the scratchpad. The unread-body case fails on both runtimes, so it stays as D-14's case. It fails every time because a 1 MiB write is larger than the pipe buffer, so it does not depend on a race.

GREEN, after the fix, two runs per runtime: `ℹ tests 18`, `ℹ pass 18`, `ℹ fail 0`, exit 0.

## Verification Evidence

Tools: Node `v26.11.1` and `v24.21.0` (npx cache), git `2.55.0`, OpenSSL `4.0.3 29 Sep 2026`.

| Command | Exit | Result |
|---------|------|--------|
| `node --test <both architecture files>` (Node 26, after the fix) | 0 | 18 tests, `ℹ fail 0` |
| `npx --prefer-offline -y -p node@24.21.0 -- node --test <both files>` | 0 | 18 tests, `ℹ fail 0` |
| `npm run typecheck` | 0 | no `error TS` line |
| `npx eslint <changed .ts files> --max-warnings 0` | 0 | clean |
| `npm run test:cucumber` (after Task 1) | 0 | `379 scenarios (379 passed)`, `3471 steps (3471 passed)` |
| `npm run test:cucumber` (after the hook change) | 0 | `379 scenarios (379 passed)` |
| `npx fallow dupes --quiet` (after the hook change) | 0 | no clone group with `settleInOrder` or `pi-process.ts` |
| `node --test tests/architecture/json-output-docs.test.ts` | 0 | 117 tests, `ℹ fail 0` |
| `SKIP=npm-check pre-commit run --files CHANGELOG.md docs/json-output.md` | 1, then 0 | mdformat realigned the table on pass 1, then every hook passed |
| Commit hook `npm run check:commit` on all three commits | 0 | Passed, no `--no-verify` |

Acceptance greps: `EPIPE` in `cgi.ts`: 1. `logged.status = "dropped"` in `server.ts`: 2. `on every request` in `server.ts`: 1. The pinned no-blank-line message: 1. `has no colon`: 1. `listen(` or `createServer` in the new test: none. `AggregateError` in `pi-process.ts`: 2. `shows only in the requests`: 1. `Unreleased` top-level bullets: 14. `source you typed`: 0. `source as typed`: 0. `git status --short -- features tests CHANGELOG.md docs` was empty after the commits.

## D-14 / D-06 Evidence (committed tree `a8ec3abc`)

| Run | `node --version` | Command | Exit | Summary line | Wall time |
|-----|------------------|---------|------|--------------|-----------|
| 1 | v24.21.0 | `npx --prefer-offline -y -p node@24.21.0 -- node node_modules/@cucumber/cucumber/bin/cucumber.js` | 0 | `379 scenarios (379 passed)` | 17.3 s |
| 2 | v24.21.0 | same | 0 | `379 scenarios (379 passed)` | 16.9 s |
| 3 | v24.21.0 | same | 0 | `379 scenarios (379 passed)` | 16.8 s |
| 4 | v26.11.1 | `npm run test:cucumber` | 0 | `379 scenarios (379 passed)` | 13.1 s |

`PiProcess` spawns `process.execPath`, so in runs 1 to 3 Pi also ran on Node 24.21.0. No Node 24 failure occurred, so nothing needed investigation.

## Flagged Assumptions (carried from the plan)

- The unread-body case provokes `EPIPE` with a 1 MiB GET body. It is measured above, and it fails on the old handler on both runtimes. The plan's `info/refs` target did not work for this (see the deviation).
- The live-host cases run in `npm run test:unpaired`, so CI's static job now also needs `openssl` and `git http-backend`. 09-RESEARCH.md A1 and A4 stay open until the PR runs.
- IN-09's `headersSent` branch stays hard to reach, because `writeResponse` sends the headers and the body in one `end()`. No case drives it.

## Files Created/Modified

- `features/lib/https-git-host/cgi.ts`: the stdin error handler of `runHttpBackend` ignores `EPIPE`
- `features/lib/https-git-host/server.ts`: `servedPath`, `armFor` on the served path, the `dropped` log in `answerServerError`, and the arm and status docs
- `tests/architecture/https-git-host-server.test.ts`: new, with three live-host cases
- `tests/architecture/https-git-host-cgi.test.ts`: the message-pinned no-blank-line case and the no-colon case
- `features/support/pi-process.ts`: `settleInOrder`, cleanup when the Pi start fails, and the `AfterAll()` teardown
- `features/step_definitions/marketplace/git-host.steps.ts`: the IN-04 comment
- `CHANGELOG.md`: one url-source entry with two sub-bullets
- `docs/json-output.md`: the plugin-row `id` meaning

## Decisions Made

- The unread-body case GETs `/acme/tools.git/HEAD`, which the backend serves from the file without reading stdin, and which exits 0.
- `answer()`'s comment no longer names an undecodable path, because `receive` now answers that path before `answer` runs.
- ADD-11 and UPD-12 stay open. This plan makes the host they depend on reliable, and plan 10-04 adds their rows.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug in the test design] The unread-body case targets the plain `HEAD` file, not `info/refs`**
- **Found during:** Task 1, GREEN
- **Issue:** After the fix, the plan's case (a 1 MiB GET body to `/acme/tools.git/info/refs?service=git-upload-pack`) still answered 500 on both runtimes. A scratch probe showed the cause. For `info/refs`, `git http-backend` reads `CONTENT_LENGTH` bytes and forwards them to `upload-pack --advertise-refs`, which never reads them. The backend then hits SIGPIPE and exits 141. Our `EPIPE` arrives as well, but the exit code is not 0, so the 500 is correct, and the fix must keep it (the plan's prohibition: the exit code still decides). For `/acme/tools.git/HEAD`, the backend serves the file without reading stdin and exits 0, while Node raises `write EPIPE` on both runtimes. That matches the defect.
- **Fix:** The case requests `/acme/tools.git/HEAD` with the 1 MiB body and expects 200, answered and logged. The RED run was repeated on the unchanged stand-in, and it fails there on both runtimes.
- **Files modified:** `tests/architecture/https-git-host-server.test.ts`
- **Commit:** `7129ac02`

**2. [Skill rule over plan text] One host per case, not one host in `before()`**
- **Found during:** Task 1
- **Issue:** The plan said to start one host in `before` and reset it before each case. `.agents/skills/typescript-unit-tests/rules/cases.md` forbids `before()` for shared state, and `boundaries.md` asks for one `mkdtemp` per case.
- **Fix:** `startHost(t)` creates a root and a host for each case, publishes `tools`, and registers the close and the `rm` with `t.after()`. Each case costs about 60 to 150 ms.
- **Files modified:** `tests/architecture/https-git-host-server.test.ts`
- **Commit:** `7129ac02`

### Process note

- The Task 2 hook commit (`72eac098`) ran `git commit ... | grep -v` in the foreground, against the plan's "never pipe it" rule. The commit and its hook succeeded (`PIPESTATUS` 0, `npm run check:commit` passed, no `--no-verify`), and the later commits were not piped.

## Issues Encountered

None beyond the deviation above.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## Next Phase Readiness

- Plan 10-04 (401 rows on add and update) can rely on a host that answers every request it should on Node 24, and on arms that match however the client encodes the path.
- Plan 10-07 can cite the commits in the table above for IN-01, IN-02, IN-03, IN-04, IN-06, IN-07, IN-08, IN-09, and IN-10 in the Phase 9 ledger.

## Self-Check: PASSED

- FOUND: tests/architecture/https-git-host-server.test.ts, features/lib/https-git-host/cgi.ts, features/lib/https-git-host/server.ts, features/support/pi-process.ts
- FOUND: 7129ac02, 72eac098, a8ec3abc
