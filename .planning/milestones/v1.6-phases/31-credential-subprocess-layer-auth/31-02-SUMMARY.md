---
phase: 31-credential-subprocess-layer-auth
plan: 02
subsystem: auth
tags: [credential-ops, git-credential, child_process, spawn, os-keychain, mock-injection, architecture-gate, auth-09-no-leak]

# Dependency graph
requires:
  - phase: 30-duplicate-gitcredentials-type-fix
    provides: "GitCredentials type canonically exported from platform/git.ts (consumed by CredentialOps.fill return type)"
  - phase: 31-credential-subprocess-layer-auth/plan-01
    provides: "ALLOWED_CHILD_PROCESS_FILES whitelist permitting platform/git-credential.ts to import node:child_process + tests/platform/ folded into the npm test glob"
provides:
  - "CredentialOps interface + DEFAULT_CREDENTIAL_OPS exported from extensions/pi-claude-marketplace/platform/git-credential.ts (3 primitives: fill / approve / reject)"
  - "spawn-based default impl wrapping `git credential fill/approve/reject` with GIT_TERMINAL_PROMPT=0, .unref()ed 5s timeout, explicit stdin.write+end, ENOENT-tolerant catch"
  - "makeMockCredentialOps factory in tests/helpers/credential-mock.ts (sibling of git-mock.ts) for test injection -- never touches the dev's OS keychain"
  - "AUTH-09 architecture gate (tests/architecture/no-credential-leak.test.ts): (1) no credential field in any state-write code path; (2) no Error constructor in git-credential.ts interpolates a credential field"
affects:
  - "Phase 32 (Device Flow initiate): can `import { DEFAULT_CREDENTIAL_OPS } from \"./platform/git-credential.ts\"` and inject `makeMockCredentialOps` in its own tests"
  - "Phase 33 (buildAuthCallbacks): uses CredentialOps.fill for the onAuth pre-Device-Flow lookup and CredentialOps.approve+reject for the rotation sequence (Pitfall 5 -- reject-before-approve to evict macOS keychain duplicates)"
  - "Phase 34-35 (marketplace add/update wiring to onAuth/onAuthFailure)"

# Tech tracking
tech-stack:
  added: []  # No new deps -- node:child_process is a Node built-in; GitCredentials carries from platform/git.ts via Phase 30
  patterns:
    - "Subprocess + interface-injection seam -- mirrors platform/git.ts (isomorphic-git) + orchestrators/marketplace/shared.ts::GitOps. Default impl + interface co-located; tests inject a closure-scoped in-memory mock"
    - "Best-effort persistence (approve/reject) -- try/catch swallow on subprocess error so the current operation never blocks on keychain failures; only fill bubbles a structured null on miss"
    - "Pitfall 8 / AUTH-09 -- Error constructors reference operation name + numeric exit code or timeout-ms only; never a credential field. Enforced statically by tests/architecture/no-credential-leak.test.ts"

key-files:
  created:
    - extensions/pi-claude-marketplace/platform/git-credential.ts (237 lines)
    - tests/helpers/credential-mock.ts (104 lines)
    - tests/platform/git-credential.test.ts (149 lines)
    - tests/architecture/no-credential-leak.test.ts (94 lines)
  modified:
    - extensions/pi-claude-marketplace/platform/README.md (Purpose paragraph + Planned Contents bullet)

key-decisions:
  - "CredentialOps.fill returns Promise<GitCredentials | null> -- null is the affirmative no-result (RESEARCH Open Q2 resolution); matches isomorphic-git's GitAuth shape exactly via the Phase 30 re-export"
  - "approve/reject swallow ALL subprocess errors (best-effort) -- failure to persist must not block the operation that just succeeded auth; Phase 33+ caller learns of failure via the next fill returning null and re-runs Device Flow"
  - "Internal helpers (gitCredentialIO, buildAttributeBlock, parseCredentialOutput, credentialFill/Approve/Reject) NOT exported -- only CredentialOps + DEFAULT_CREDENTIAL_OPS are public; private surface stays maximally narrow"
  - "buildAttributeBlock NEVER emits a path= line (Pitfall 4) -- keychain keying must be identical between fill and approve/reject, else approve stores under a different key than fill reads from"
  - "5s subprocess timeout via setTimeout + .unref() (Pattern 1 CP-4) -- bounds worst-case latency while letting node exit naturally on success"
  - "Type-only CredentialOps import in tests/helpers/credential-mock.ts so the helper file does not import the production module at runtime (defense in depth alongside the eslint platform-import boundary)"

patterns-established:
  - "Whitelist-narrowed architecture-gate exception (carried from plan 31-01): a single legitimate child_process import sits at exactly one repo-relative path, asserted at lint AND runtime via a sibling exact-membership test. Plan 31-02's new production module lives at the whitelisted path."
  - "Mock helpers in tests/helpers/ are closure-scoped in-memory state + per-method call logs + optional throws-overrides. Pattern reaffirmed across GitOps (Phase 4) and now CredentialOps (Phase 31)."
  - "Conditional-spread initializer for exactOptionalPropertyTypes: `...(initial?.X !== undefined && { X: initial.X })` for every optional field in MockCredentialState; required fields use plain `??` defaulting (here `new Map(initial?.store ?? [])`)."

requirements-completed: [AUTH-06, AUTH-08, AUTH-09]

# Metrics
duration: 18min
completed: 2026-06-01
---

# Phase 31 Plan 02: CredentialOps Subprocess Seam Summary

**Spawn-based `git credential fill/approve/reject` wrapped behind an injectable CredentialOps interface, with a closure-scoped in-memory mock and a static AUTH-09 leak gate -- Phase 32+ can now build Device Flow + buildAuthCallbacks against a tested seam whose tests never touch the developer's OS keychain.**

## Performance

- **Duration:** ~18 min
- **Started:** 2026-06-01T11:04:00Z (orchestrator hand-off; first read after worktree reset)
- **Completed:** 2026-06-01T11:22:14Z
- **Tasks:** 2 (committed atomically as a single feat commit per the plan's commit strategy)
- **Files created:** 4 (git-credential.ts, credential-mock.ts, git-credential.test.ts, no-credential-leak.test.ts)
- **Files modified:** 1 (platform/README.md)
- **Lines added (production+tests, excluding README):** 584 (237 prod + 104 mock + 149 unit + 94 arch)

## Accomplishments

- `extensions/pi-claude-marketplace/platform/git-credential.ts` (NEW, 237 lines): exports `CredentialOps` interface + `DEFAULT_CREDENTIAL_OPS` only. Internal `gitCredentialIO` spawns `git credential <subcommand>` with `env: { ...process.env, GIT_TERMINAL_PROMPT: "0" }` (Pitfall 2), stdio pipe, explicit `child.stdin.write(input)` + `child.stdin.end()` (Pitfall 3), 5_000ms setTimeout with `.unref()` (CP-4 timer-leak prevention), and `child.on("error", ...)` for ENOENT surfacing. `credentialFill` wraps in try/catch and returns null on any miss path (ENOENT, timeout, non-zero exit, exit 0 but missing username= or password= line). `credentialApprove` and `credentialReject` are best-effort: any subprocess error is swallowed so the in-memory token still works for the current operation (Pattern 3). `buildAttributeBlock` emits `protocol=https\nhost=<host>\n` plus optional `username=`/`password=` lines, NEVER `path=` (Pitfall 4 -- keychain keying must match between fill and approve).
- `tests/helpers/credential-mock.ts` (NEW, 104 lines): `makeMockCredentialOps(initial?: Partial<MockCredentialState>): MockCredentialOpsHandle`. Closure-scoped state with `store: Map<string, GitCredentials>`, `fillCalls`/`approveCalls`/`rejectCalls` arrays, and optional `fillThrows`/`approveThrows`/`rejectThrows` Error overrides. Conditional-spread initializer satisfies `exactOptionalPropertyTypes`. Type-only `CredentialOps` import keeps the helper from runtime-coupling to the production module.
- `tests/platform/git-credential.test.ts` (NEW, 149 lines): 8 tests -- fill hit / fill miss / fillThrows / approve+fill round-trip / reject+fill eviction / DEFAULT_CREDENTIAL_OPS.fill ENOENT (PATH override forces real subprocess to fail-spawn) / opt-in real-subprocess smoke gated by `PI_CM_REAL_GIT_CREDENTIAL=1` / fill-call-log shape check (proves the seam never widens its host-only contract).
- `tests/architecture/no-credential-leak.test.ts` (NEW, 94 lines): the AUTH-09 architecture gate. Test 1 reads `persistence/state-io.ts`, `persistence/migrate.ts`, `transaction/with-state-guard.ts`, strips comments, and asserts the regex `/\b(password|access_token|githubToken|gitToken)\b/i` does NOT match. Test 2 reads `platform/git-credential.ts`, strips comments, and asserts `new Error(...${...password|access_token|cred.<field>}...)` template-literal interpolation does NOT match. Test 2 is forward-compatible: it skips vacuously when the production file is absent (was unused-but-present during the brief Task 1 → Task 2 RED window -- irrelevant for the published commit since both tasks landed atomically).
- `extensions/pi-claude-marketplace/platform/README.md`: Purpose paragraph rewritten to enumerate `git.ts`, `pi-api.ts`, and the new `git-credential.ts` with the D-21-whitelist call-out. Planned Contents adds `- [x] git-credential.ts ...` bullet between `git.ts` and `pi-api.ts`.
- `npm run check` exits 0 with **1277/1277 tests passing** -- baseline was 1267 (post-plan-31-01); +10 = 8 platform unit tests + 2 architecture leak-gate tests.

## Task Commits

Per the plan's `<verification>` commit strategy, Task 1 and Task 2 landed as a single atomic `feat` commit so the brief TypeScript RED window (mock helper references unresolved `CredentialOps` type) was never published:

1. **Task 1 + Task 2 (combined):** `cc64ce7` (feat) -- `feat(31): platform/git-credential CredentialOps seam (AUTH-06/08/09)`

Pre-commit hooks all passed except trufflehog (worktree-sandbox auto-updater failure documented in CLAUDE.md). Trufflehog scan run separately from the main checkout (`pre-commit run trufflehog --all-files`) -- clean.

## Files Created/Modified

- `extensions/pi-claude-marketplace/platform/git-credential.ts` (237 lines) -- CredentialOps + DEFAULT_CREDENTIAL_OPS + spawn-based fill/approve/reject impl + helpers. Imports: `spawn` from `node:child_process` (the sole permitted import per the Plan 31-01 whitelist), `GitCredentials` type from `./git.ts`.
- `tests/helpers/credential-mock.ts` (104 lines) -- `makeMockCredentialOps` + `MockCredentialState` + `MockCredentialOpsHandle`. Type-only imports for `CredentialOps` and `GitCredentials`.
- `tests/platform/git-credential.test.ts` (149 lines) -- 8 unit tests (Tests 1-5 mock-based; Test 6 PATH-forced ENOENT; Test 7 opt-in real-subprocess smoke; Test 8 host-only call-log shape).
- `tests/architecture/no-credential-leak.test.ts` (94 lines) -- 2 architecture tests (state-write field-name gate; Error-interpolation gate against git-credential.ts).
- `extensions/pi-claude-marketplace/platform/README.md` -- Purpose paragraph rewritten; Planned Contents bullet added.

## Public Surface Exported by `platform/git-credential.ts`

For Phase 32+ planning, the surface is:

```typescript
import type { GitCredentials } from "./git.ts";

export interface CredentialOps {
  fill(host: string): Promise<GitCredentials | null>;
  approve(host: string, cred: GitCredentials): Promise<void>;
  reject(host: string, cred: GitCredentials): Promise<void>;
}

export const DEFAULT_CREDENTIAL_OPS: CredentialOps;
```

No other public exports. Internal helpers (`gitCredentialIO`, `buildAttributeBlock`, `parseCredentialOutput`, `credentialFill`, `credentialApprove`, `credentialReject`) are private.

## Requirements → Test Map

| Req ID | Behavior | Proving Test (by title) |
|--------|----------|--------------------------|
| AUTH-06 | `approve` persists a credential; subsequent `fill` returns it | `Phase 31 credOps: approve persists -- subsequent fill returns the approved cred` |
| AUTH-08 | `fill` returns the stored credential on hit | `Phase 31 credOps: fill hit -- mock returns stored credential` |
| AUTH-08 | `fill` returns null on miss | `Phase 31 credOps: fill miss -- mock returns null on empty store` |
| AUTH-08 | `fill` propagates subprocess-error semantics (mock shape) | `Phase 31 credOps: fill ENOENT-equivalent -- mock fillThrows surfaces to caller` |
| AUTH-08 | `fill` returns null when the `git` binary is absent (production ENOENT path) | `Phase 31 credOps: DEFAULT_CREDENTIAL_OPS.fill returns null when git binary is absent (Pitfall 7)` |
| AUTH-08 | `reject` evicts a credential; subsequent `fill` returns null | `Phase 31 credOps: reject evicts -- subsequent fill returns null` |
| AUTH-08 | host-only attribute block (no path= leak across the seam) | `Phase 31 credOps: fill builds host-only attribute block (Pitfall 4 -- no path= field)` |
| AUTH-08 | real `git credential fill` does not hang against a missing helper (Pitfall 2 + 3) | `Phase 31 credOps: real `git credential fill` against invented host returns null within 2s (PI_CM_REAL_GIT_CREDENTIAL=1)` (opt-in) |
| AUTH-09 | no credential field name leaks into state-write code paths | `AUTH-09: no credential field name appears in any state-write code path` |
| AUTH-09 | no Error constructor in git-credential.ts interpolates a credential field | `AUTH-09: platform/git-credential.ts never interpolates a password in an Error message` |

## Architecture Gates Status

| Gate | File | Status |
|------|------|--------|
| D-21 + Phase 31 whitelist narrowing | `tests/architecture/no-shell-out.test.ts` (Plan 31-01) | GREEN -- `extensions/pi-claude-marketplace/platform/git-credential.ts` matches the sole whitelisted path; the gate's `import { spawn } from "node:child_process"` regex match is skipped via `ALLOWED_CHILD_PROCESS_FILES.has(rel)` |
| Phase 31 exact-membership guard | `tests/architecture/no-shell-out.test.ts` (Plan 31-01) | GREEN -- set still has exactly one entry |
| AUTH-09 state-write field gate | `tests/architecture/no-credential-leak.test.ts` (NEW) | GREEN -- no forbidden field name in `persistence/state-io.ts`, `persistence/migrate.ts`, `transaction/with-state-guard.ts` (outside comments) |
| AUTH-09 Error-interpolation gate | `tests/architecture/no-credential-leak.test.ts` (NEW) | GREEN (no longer vacuous) -- every `Error(...)` constructor in git-credential.ts references only operation name + exit code or timeout-ms |

## Net Test Delta

| Source | Δ |
|--------|---|
| 8 tests in `tests/platform/git-credential.test.ts` | +8 |
| 2 tests in `tests/architecture/no-credential-leak.test.ts` | +2 |
| **Total** | **+10** |

`npm test` count: 1267 (post-plan-31-01 baseline) → **1277** (this plan). `npm run check` exits 0.

## Note for Phase 32+

`makeMockCredentialOps` is importable from `tests/helpers/credential-mock.ts` and accepts a `Partial<MockCredentialState>` initializer:

```typescript
import { makeMockCredentialOps } from "../helpers/credential-mock.ts";

const { credOps, state } = makeMockCredentialOps({
  store: new Map([["github.com", { username: "u", password: "p" }]]),
  // optional: fillThrows: new Error("ENOENT"),
});
```

Phase 33's `buildAuthCallbacks` tests will use it the same way Phase 4's `add.test.ts` / `update.test.ts` use `makeMockGitOps` (closure-scoped state, mutate `state.store` between calls to simulate rotation, assert on `state.fillCalls` / `state.approveCalls` / `state.rejectCalls`).

For Phase 33's rotation sequence (Pitfall 5 -- macOS keychain duplicates on repeated approve): the production `approve` does NOT internally reject-before-approve; the caller is responsible for sequencing `await credOps.reject(host, oldCred) → await credOps.approve(host, newCred)`. This is documented in the `CredentialOps` interface docstring.

## Decisions Made

- **Single atomic commit for Task 1 + Task 2** per the plan's `<verification>` commit strategy. The TypeScript RED state on the unresolved `CredentialOps` import is the documented bridge between the tasks; landing them in one commit keeps the published history GREEN.
- **`null` (not `undefined`) on fill miss** per RESEARCH Open Q2 resolution; `null` is the affirmative no-result, matching the GitOps idiom in `git-mock.ts::currentBranchOverride`.
- **Type-only `CredentialOps` import in credential-mock.ts** -- defense in depth alongside the runtime platform-import boundary in eslint.config.js BLOCK C; the test helper expresses a pure type dependency on the seam.
- **`buildAttributeBlock` returns `lines.join("\n") + "\n\n"`** so the wire-format blank-line terminator is unambiguous and the helper has no other branching for the optional username/password lines (Pitfall 4 -- same attribute set for fill/approve).
- **5_000ms default timeout** matches Pattern 1's example; `.unref()` ensures a pending timer can't keep the event loop alive past success (CP-4).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] ESLint dot-notation rule on `parsed["username"]` / `parsed["password"]` access**

- **Found during:** Task 2 verification (`npm run check` after writing the production file)
- **Issue:** `@typescript-eslint/dot-notation` requires bracket access only when the key is a non-identifier or computed expression; `parsed["username"]` and `parsed["password"]` are valid identifiers, so the rule flagged both. Without the fix `npm run lint` (and therefore `npm run check`) exits non-zero -- Rule 3 blocking.
- **Fix:** Replaced bracket access with destructuring: `const { username, password } = parsed;`. Same runtime semantics, lint-compliant.
- **Files modified:** `extensions/pi-claude-marketplace/platform/git-credential.ts`
- **Verification:** `npm run lint` exits 0; unit tests still pass (the destructured form preserves `undefined` semantics for missing keys).
- **Committed in:** `cc64ce7` (part of the atomic Task 1 + Task 2 commit)

**2. [Rule 3 - Blocking] `import-x/order` on credential-mock.ts type-only imports**

- **Found during:** Task 2 verification (`npm run check`)
- **Issue:** `eslint-plugin-import-x` requires alphabetical ordering of type-only imports within their import block. The initial order was `git.ts` before `git-credential.ts`, but `git-credential.ts` sorts BEFORE `git.ts` (`-` ASCII 45 < `.` ASCII 46). `npm run lint` failed -- Rule 3 blocking.
- **Fix:** Swapped the two type imports so `CredentialOps` (from `git-credential.ts`) appears first, then `GitCredentials` (from `git.ts`).
- **Files modified:** `tests/helpers/credential-mock.ts`
- **Verification:** `npm run lint` exits 0.
- **Committed in:** `cc64ce7` (part of the atomic Task 1 + Task 2 commit)

**3. [Rule 3 - Blocking] Prettier formatting on the two new test files**

- **Found during:** Task 2 verification (`npm run check` step 3 = `npm run format:check`)
- **Issue:** Prettier flagged `tests/architecture/no-credential-leak.test.ts` and `tests/platform/git-credential.test.ts` for minor style normalization (multi-line `assert.ok(true, "...")` wrapping; multi-line `assert.equal(result, null, "...")` wrapping where the message string pushed past the print width). Without `--write` the format check exited non-zero -- Rule 3 blocking.
- **Fix:** Ran `npx prettier --write` on the two files; only whitespace + line-wrapping changed, no logic touched.
- **Files modified:** `tests/architecture/no-credential-leak.test.ts`, `tests/platform/git-credential.test.ts`
- **Verification:** `npm run format:check` exits 0; tests still pass (1277/1277).
- **Committed in:** `cc64ce7` (part of the atomic Task 1 + Task 2 commit)

---

**Total deviations:** 3 auto-fixed (all Rule 3 blocking lint/format issues against the new files; no logic changes, no scope creep). All three were detected during the same `npm run check` run that gates the commit; resolved before `git commit`.

**Impact on plan:** None -- all deviations were mechanical lint/format compliance against the same code the tasks authored. Every acceptance criterion bit holds; the behavior the plan describes is what the committed code does.

## Issues Encountered

- Trufflehog pre-commit hook fails inside the worktree sandbox (auto-updater cannot spawn child processes), exactly as documented in CLAUDE.md. Committed with `SKIP=trufflehog` and ran `pre-commit run trufflehog --all-files` from the main checkout separately -- scan clean.
- No other issues. The plan's `<read_first>` references (RESEARCH.md Patterns 1-3, Pitfalls 1-9, Examples 1 + 4; platform/git.ts GitCredentials shape; tests/helpers/git-mock.ts template) all matched the codebase exactly.

## User Setup Required

None -- no external service configuration, no environment variables (the opt-in `PI_CM_REAL_GIT_CREDENTIAL=1` smoke is operator-side, not a setup requirement), no dashboard.

## Next Phase Readiness

- Phase 32 (Device Flow initiate) can now `import { DEFAULT_CREDENTIAL_OPS } from "../../platform/git-credential.ts"` to call `approve(host, cred)` after a successful Device Flow exchange; it can inject `makeMockCredentialOps` in its own tests to assert the approve was called with the right host + cred shape without touching the real keychain.
- Phase 33 (buildAuthCallbacks) can compose:
  ```typescript
  const onAuth = async (_url: string) => {
    const cached = await credOps.fill(host);
    if (cached) return cached;
    const fresh = await deviceFlow(...);
    await credOps.approve(host, fresh);
    return fresh;
  };
  const onAuthFailure = async (_url: string) => {
    await credOps.reject(host, badCred);
    return { cancel: true };
  };
  ```
  Both callbacks are mock-injectable end-to-end.
- No blockers carried forward. The two architecture gates (D-21 whitelist + AUTH-09 no-leak) and the eight platform tests are all GREEN.

## Self-Check: PASSED

Verified before finalizing:

- `extensions/pi-claude-marketplace/platform/git-credential.ts` exists -- FOUND (`ls` shows 237 lines)
- `tests/helpers/credential-mock.ts` exists -- FOUND (104 lines)
- `tests/platform/git-credential.test.ts` exists -- FOUND (149 lines)
- `tests/architecture/no-credential-leak.test.ts` exists -- FOUND (94 lines)
- `extensions/pi-claude-marketplace/platform/README.md` modified -- FOUND (Purpose paragraph + new `[x] git-credential.ts` bullet)
- Commit `cc64ce7` -- FOUND (`git log --oneline -3` confirms)
- `npm run check` exits 0 with 1277/1277 tests -- FOUND (full run captured 2026-06-01T~11:20Z)
- Exactly 2 `^export ` lines in git-credential.ts -- FOUND (CredentialOps interface + DEFAULT_CREDENTIAL_OPS const)
- 1 `from "node:child_process"` match in git-credential.ts -- FOUND
- 1 `import type { GitCredentials } from "./git` match -- FOUND
- `GIT_TERMINAL_PROMPT` referenced and set to `"0"` -- FOUND (line 84)
- `child.stdin.end()` present -- FOUND (line 114)
- `unref()` present -- FOUND (line 102)
- 8 `test(` declarations in git-credential.test.ts -- FOUND
- 3 `^export (function|interface)` declarations in credential-mock.ts -- FOUND (MockCredentialState, MockCredentialOpsHandle, makeMockCredentialOps)
- 2 `^test(` declarations in no-credential-leak.test.ts -- FOUND
- Plan 31-01 whitelist still has exactly one entry (`extensions/pi-claude-marketplace/platform/git-credential.ts`) and the production file lives at that exact path -- FOUND
- No Error constructor in git-credential.ts interpolates a credential field (the AUTH-09 second test is GREEN, not vacuous) -- FOUND

---
*Phase: 31-credential-subprocess-layer-auth*
*Completed: 2026-06-01*
