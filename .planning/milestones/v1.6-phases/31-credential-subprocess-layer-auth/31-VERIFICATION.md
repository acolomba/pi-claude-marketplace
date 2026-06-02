---
phase: 31-credential-subprocess-layer-auth
verified: 2026-06-01T12:00:00Z
status: passed
score: 7/7
overrides_applied: 0
---

# Phase 31: Credential Subprocess Layer Verification Report

**Phase Goal:** Introduce a `CredentialOps` injectable interface that wraps
`git credential fill/approve/reject` via `node:child_process.spawn`, with a
mock factory for tests, so Phase 32+ can consume OS keychain credentials
without touching the subprocess directly.

**Verified:** 2026-06-01T12:00:00Z
**Status:** passed
**Re-verification:** No -- initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `CredentialOps` interface exported from `platform/git-credential.ts` | VERIFIED | `export interface CredentialOps` at line 58; `export const DEFAULT_CREDENTIAL_OPS` at line 245; exactly two `^export ` lines in the file |
| 2 | `DEFAULT_CREDENTIAL_OPS` wires `fill`/`approve`/`reject` via `git credential` subprocess with `GIT_TERMINAL_PROMPT=0`, `stdin.write+end`, `.unref()`-ed timeout | VERIFIED | `spawn("git", ["credential", subcommand])` at line 81; `GIT_TERMINAL_PROMPT: "0"` at line 84; `child.stdin.write(input)` at line 113; `child.stdin.end()` at line 114; `timer.unref()` at line 102 |
| 3 | `makeMockCredentialOps()` factory with in-memory store + call logs exists in `tests/helpers/` | VERIFIED | `tests/helpers/credential-mock.ts` exports `MockCredentialState`, `MockCredentialOpsHandle`, `makeMockCredentialOps`; closure-scoped `Map<string, GitCredentials>` store; `fillCalls`, `approveCalls`, `rejectCalls` arrays; conditional-spread for `exactOptionalPropertyTypes` |
| 4 | `npm test` runs `tests/platform/git-credential.test.ts` and all 8 platform tests pass | VERIFIED | `package.json` `scripts.test` contains `platform` between `persistence` and `shared`; `node --test "tests/platform/git-credential.test.ts"` exits 0 with 8/8 pass; full `npm test` reports 1277/1277 |
| 5 | AUTH-09 architecture gate (`no-credential-leak.test.ts`) passes green | VERIFIED | Both tests pass; Test 1 confirms no forbidden field names in `persistence/state-io.ts`, `persistence/migrate.ts`, `transaction/with-state-guard.ts`; Test 2 confirms no credential-field interpolation in Error constructors; WR-03 fix extended the regex to cover `+` concatenation in addition to template literals |
| 6 | D-21 architecture gate (`no-shell-out.test.ts`) narrowed to whitelist exactly `platform/git-credential.ts` | VERIFIED | `ALLOWED_CHILD_PROCESS_FILES` set contains exactly one entry; "exactly one file" test asserts `deepEqual` against `["extensions/pi-claude-marketplace/platform/git-credential.ts"]`; WR-04 fix added two dynamic `import()` patterns to `FORBIDDEN_PATTERNS` (now 6 entries total); both tests pass |
| 7 | Code review REVIEW.md status is `clean` (all warnings fixed) | VERIFIED | `31-REVIEW.md` frontmatter `status: clean`; all four warnings (WR-01 through WR-04) resolved in iteration 2; commits `ea36312` (fixes) and `ce20a28` (re-review clean) confirmed in git log |

**Score:** 7/7 truths verified

---

## Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `extensions/pi-claude-marketplace/platform/git-credential.ts` | `CredentialOps` interface + `DEFAULT_CREDENTIAL_OPS` + spawn-based impl | VERIFIED | 250 lines; exactly 2 public exports; `spawn` from `node:child_process`; type-only `GitCredentials` import from `./git.ts`; `sanitizeAttrValue` helper (WR-01 fix); `\r$` stripping in `parseCredentialOutput` (WR-02 fix) |
| `tests/helpers/credential-mock.ts` | `makeMockCredentialOps` factory + type exports | VERIFIED | 105 lines; 3 exports; type-only `CredentialOps` import; conditional-spread for optional fields |
| `tests/platform/git-credential.test.ts` | 8 unit tests covering mock + real-ENOENT + opt-in smoke | VERIFIED | 150 lines; 8 `test()` declarations; Tests 1-5 mock-based; Test 6 PATH-forced ENOENT; Test 7 opt-in smoke; Test 8 call-log shape |
| `tests/architecture/no-credential-leak.test.ts` | AUTH-09 gate: no token in state writes; no Error interpolation | VERIFIED | 96 lines; 2 `test()` declarations; `STATE_WRITE_FILES` with 3 paths; `FORBIDDEN_STATE_FIELDS` regex; extended `errorWithCred` regex covering both template literals and `+` concatenation |
| `extensions/pi-claude-marketplace/platform/README.md` | New `git-credential.ts` bullet; updated Purpose paragraph | VERIFIED | `[x] git-credential.ts` bullet present; Purpose paragraph enumerates all three platform files with D-21 whitelist call-out |
| `tests/architecture/no-shell-out.test.ts` | `ALLOWED_CHILD_PROCESS_FILES` whitelist + exact-membership test; 6 `FORBIDDEN_PATTERNS` entries | VERIFIED | `ReadonlySet<string>` with sole entry; 2 tests; 6 patterns including 2 dynamic `import()` patterns (WR-04) |
| `package.json` | `platform` in `scripts.test` and `scripts.test:coverage:unit` globs | VERIFIED | Both globs contain `platform` alphabetically between `persistence` and `shared` |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `platform/git-credential.ts` | `platform/git.ts` | `import type { GitCredentials }` | VERIFIED | Line 36: `import type { GitCredentials } from "./git.ts"` |
| `tests/helpers/credential-mock.ts` | `platform/git-credential.ts` | `import type { CredentialOps }` | VERIFIED | Line 20: type-only import from production module |
| `tests/platform/git-credential.test.ts` | `tests/helpers/credential-mock.ts` | `makeMockCredentialOps` import | VERIFIED | Line 25: `import { makeMockCredentialOps } from "../helpers/credential-mock.ts"` |
| `tests/architecture/no-shell-out.test.ts` | `platform/git-credential.ts` | `ALLOWED_CHILD_PROCESS_FILES` whitelist | VERIFIED | Whitelist contains exactly `"extensions/pi-claude-marketplace/platform/git-credential.ts"`; the production file lives at that exact path |

---

## Data-Flow Trace (Level 4)

Not applicable -- all artifacts are platform/test modules, not UI-rendering components. The CredentialOps interface is a seam for injection; data flow verified through behavioral tests.

---

## Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| 8 platform unit tests pass | `node --test "tests/platform/git-credential.test.ts"` | 8/8 pass, exit 0 | PASS |
| AUTH-09 architecture gate | `node --test "tests/architecture/no-credential-leak.test.ts"` | 2/2 pass, exit 0 | PASS |
| D-21 no-shell-out gate | `node --test "tests/architecture/no-shell-out.test.ts"` | 2/2 pass, exit 0 | PASS |
| Full test suite | `npm test` | 1277/1277 pass, exit 0 | PASS |
| Full quality gate | `npm run check` | exit 0 | PASS |
| Only one child_process import in extension tree | `grep -rn 'from "node:child_process"' extensions/pi-claude-marketplace/` | exactly `platform/git-credential.ts:34` | PASS |

---

## Probe Execution

No probes declared for this phase. Step 7c: SKIPPED (no `scripts/*/tests/probe-*.sh` files referenced).

---

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| AUTH-06 | 31-01, 31-02 | `approve` persists credential to OS keychain | SATISFIED | `credentialApprove` spawns `git credential approve` with attribute block; test "approve persists" verifies round-trip via mock |
| AUTH-08 | 31-02 | `fill` returns `GitCredentials` on hit and `null` on miss | SATISFIED | `credentialFill` handles 5 miss paths (non-zero exit, empty stdout, ENOENT, timeout, missing username/password); 8 tests cover these; Test 6 exercises real ENOENT path |
| AUTH-09 | 31-02 | No access token leaks through state writes or Error messages | SATISFIED | `no-credential-leak.test.ts` tests 1 and 2 both pass and are non-vacuous (production file present); WR-03 extended the Error-interpolation regex to cover `+` concatenation |

---

## Anti-Patterns Found

No debt markers (TBD, FIXME, XXX) found in any phase-modified file. No stubs, no placeholder returns, no hardcoded empty data. All `return null` / `return void` returns are intentional per the seam contract (null = affirmative miss; void = best-effort).

---

## Human Verification Required

One item requires operator action to verify (not a blocking gap -- the implementation is correct and the opt-in guard is intentional):

### 1. Real OS keychain smoke test

**Test:** Set `PI_CM_REAL_GIT_CREDENTIAL=1` and run `node --test "tests/platform/git-credential.test.ts"`.
**Expected:** Test 7 ("real `git credential fill` against invented host returns null within 2s") passes, confirming `GIT_TERMINAL_PROMPT=0` + `stdin.end()` prevents the hang described in Research Pitfalls 2 and 3 against the actual macOS/Linux keychain stack.
**Why human:** Requires a real `git` binary and a configured credential helper. Intentionally opt-in per plan design; the automated suite covers the ENOENT path (Test 6) and all mock-based paths (Tests 1-5, 8).

> Note: This does NOT affect the `passed` status. The implementation is complete; the opt-in smoke is a developer convenience, not a gate. Status is `passed` because all 7 must-have truths are VERIFIED and this is the only human item -- it documents a deliberate design choice (opt-in gate), not an unresolved gap.

---

## Gaps Summary

None. All seven success criteria are verified by direct codebase inspection and live test execution.

---

_Verified: 2026-06-01T12:00:00Z_
_Verifier: Claude (gsd-verifier)_
