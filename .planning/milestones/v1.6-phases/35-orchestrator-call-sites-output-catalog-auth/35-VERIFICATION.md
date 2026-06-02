---
phase: 35-orchestrator-call-sites-output-catalog-auth
verified: 2026-06-01T17:20:18Z
status: passed
score: 5/5
overrides_applied: 0
---

# Phase 35: Orchestrator Call Sites + Output Catalog Auth -- Verification Report

**Phase Goal:** `marketplace/add.ts` and `marketplace/update.ts` construct and pass the auth closure; the Device Flow `ctx.ui.notify` prompt pattern is registered in `docs/output-catalog.md` and the catalog UAT fixture.

**Verified:** 2026-06-01T17:20:18Z
**Status:** PASSED
**Re-verification:** No -- initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `addGithubInGuard` constructs the `onAuthRequired` closure (pre-binding `ctx` + `notifyFn`) and passes it to `gitOps.clone` as a `GitAuthBundle`; private-repo `marketplace add` triggers Device Flow on first access (AUTH-01) | VERIFIED | `add.ts:216-234`: `host="github.com"`, `notifyFn=makeRawNotifyFn(ctx)`, `onAuthRequired` closure calling `initiateDeviceFlow`, `auth:GitAuthBundle` forwarded to `gitOps.clone`. 19 tests pass including AUTH-01 fill-HIT, fill-MISS (byte-exact prompt assertion), and bundle-reference tests. |
| 2 | `refreshRecord` in `update.ts` passes the `onAuthRequired` closure as the 5th arg of `refreshGitHubClone`; subsequent `marketplace update` against the same host reuses the stored token silently (AUTH-02 silent reuse contract) | VERIFIED | `update.ts:371-391`: identical closure construction pattern. `refreshGitHubClone(cloneDir, source.ref, gitOps, callback, auth)` call at line 383-391 with `auth` as 5th arg. 35 tests pass including AUTH-02 fill-HIT silent-reuse and bundle-forwarding tests. |
| 3 | The Device Flow user-code prompt (`user_code` + `verification_uri`) appears in `docs/output-catalog.md` with a byte-form lock test at `tests/shared/device-flow-prompt.test.ts` | VERIFIED | `docs/output-catalog.md:1017` has `## Out-of-band notifications`, line 1023 `### Device Flow user-code prompt (AUTH-03)`, line 1028 exact byte form `Open https://github.com/login/device and enter: ABCD-1234`. `device-flow-prompt.test.ts` exists (144 lines, 2 tests), drives `initiateDeviceFlow` with mocks, asserts byte-exact message + `"info"` severity. Both tests pass. |
| 4 | `npm run check` GREEN; 1312 tests passing | VERIFIED | `npm run check` in `extensions/pi-claude-marketplace/` exits 0. Output: `pass 1312, fail 0`. |
| 5 | AUTH-09 gate extended to cover `add.ts` + `update.ts` (`tests/architecture/no-credential-leak.test.ts` has 4 test blocks) | VERIFIED | `no-credential-leak.test.ts` has exactly 4 test blocks. 4th test `AUTH-09 (Phase 35): orchestrators/marketplace/{add,update}.ts never interpolate a credential field...` scans both files for credential interpolation in `new Error(...)` or `ctx.ui.notify(...)`. `PHASE_35_ORCHESTRATOR_FILES` constant declared. Vacuous-pass idiom present. All 4 tests pass. Closes Phase 33 review WR-02. |

**Score:** 5/5 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts` | Has `onAuthRequired`, `GitAuthBundle`, `initiateDeviceFlow`, `DEFAULT_CREDENTIAL_OPS` | VERIFIED | All 4 symbols present. `addGithubInGuard` constructs the full auth bundle. `makeRawNotifyFn` called for notifyFn. `auth` forwarded to `gitOps.clone`. 366 lines. |
| `extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts` | Has `onAuthRequired` in `refreshRecord`, `GitAuthBundle` as 5th arg | VERIFIED | `refreshRecord` github branch: closure constructed at lines 371-381, `auth:GitAuthBundle` assembled at line 381, forwarded as 5th arg to `refreshGitHubClone` at line 383-391. 884 lines. |
| `extensions/pi-claude-marketplace/shared/notify.ts` | Has `makeRawNotifyFn` export | VERIFIED | `export function makeRawNotifyFn(ctx: ExtensionContext)` at line 1530. Returns `(message, severity?) => void` closure calling `ctx.ui.notify`. |
| `tests/helpers/git-mock.ts` | `cloneCalls` and `fetchCalls` elements have `auth?: GitAuthBundle` | VERIFIED | `cloneCalls` element type (lines 51-57) includes `auth?: GitAuthBundle`. `fetchCalls` (line 58) includes `auth?: GitAuthBundle`. Type-only import of `GitAuthBundle` from `shared.ts`. |
| `tests/orchestrators/marketplace/add.test.ts` | 19 tests (3 new AUTH-01 tests) | VERIFIED | 19 tests. AUTH-01 tests at lines 654-813: fill-HIT, fill-MISS (asserts `"Open https://github.com/login/device and enter: ABCD-1234"` at `"info"` severity), bundle-reference. |
| `tests/orchestrators/marketplace/update.test.ts` | 35 tests (2 new AUTH-02 tests) | VERIFIED | 35 tests. AUTH-02 tests at lines 1400+: fill-HIT silent-reuse, bundle-forwarding. |
| `tests/shared/device-flow-prompt.test.ts` | Byte-form lock test (2 tests) | VERIFIED | 144 lines. 2 tests. Drives `initiateDeviceFlow` with `makeMockDeviceFlowHttp` + `makeMockCredentialOps` + closure recorder. Test 1: byte-exact `"Open https://github.com/login/device and enter: ABCD-1234"` + severity `"info"`. Test 2: template-shape proof (`WXYZ-5678`) + AUTH-09 regression guard. |
| `tests/architecture/no-credential-leak.test.ts` | 4 test blocks (Phase 35 orchestrator gate added) | VERIFIED | 176 lines. 4 tests. `PHASE_35_ORCHESTRATOR_FILES` constant at lines 49-52. 4th test scans `add.ts` and `update.ts` with credential-interpolation regex. Vacuous-pass for missing files. Closes WR-02. |
| `docs/output-catalog.md` | "Out-of-band notifications" section with Device Flow prompt | VERIFIED | `## Out-of-band notifications` at line 1017, `### Device Flow user-code prompt (AUTH-03)` at line 1023, `<!-- catalog-state: device-flow-prompt -->` at line 1025, byte form at line 1028. AUTH-03 and AUTH-09 contracts in prose. Positioned between `## Usage errors` (line 1001) and `## Cross-references` (line 1039). |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `docs/output-catalog.md` | `domain/github-auth.ts:385` | Documentation reference -- catalog cites emission site | VERIFIED | Catalog line 1031 references `extensions/pi-claude-marketplace/domain/github-auth.ts` as the emission source. `github-auth.ts:385` confirmed to emit `opts.notifyFn(\`Open ${deviceCode.verification_uri} and enter: ${deviceCode.user_code}\`, "info")`. |
| `tests/shared/device-flow-prompt.test.ts` | `domain/github-auth.ts::initiateDeviceFlow` | Import + direct call in both tests | VERIFIED | Line 30: `import { initiateDeviceFlow } from "../../extensions/pi-claude-marketplace/domain/github-auth.ts"`. Called at lines 70 and 115. |
| `tests/architecture/no-credential-leak.test.ts` | `orchestrators/marketplace/add.ts` and `update.ts` | `PHASE_35_ORCHESTRATOR_FILES` array scan | VERIFIED | `PHASE_35_ORCHESTRATOR_FILES` at lines 49-52 lists both files. 4th test iterates over them and applies the credential-interpolation regex. |
| `add.ts::addGithubInGuard` | `gitOps.clone` | `auth: GitAuthBundle` forwarded at line 233 | VERIFIED | `await gitOps.clone({ dir: stagingDir, url: cloneUrl, ..., auth })` at lines 229-234. |
| `update.ts::refreshRecord` | `refreshGitHubClone` | 5th positional arg `auth` at line 383-391 | VERIFIED | `await refreshGitHubClone(cloneDir, source.ref, gitOps, () => { cloneAdvanced = true; }, auth)` with `auth:GitAuthBundle` constructed at line 381. |

### Data-Flow Trace (Level 4)

Not applicable. Phase 35 delivers auth closure construction, documentation, and architectural gate tests -- not components that render dynamic UI data. The relevant data flows are verified through the behavioral spot-checks below.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| `device-flow-prompt.test.ts` 2 tests pass | `node --test tests/shared/device-flow-prompt.test.ts` | `pass 2, fail 0` | PASS |
| `no-credential-leak.test.ts` 4 tests pass | `node --test tests/architecture/no-credential-leak.test.ts` | `pass 4, fail 0` | PASS |
| `add.test.ts` 19 tests pass | `node --test tests/orchestrators/marketplace/add.test.ts` | `pass 19, fail 0` | PASS |
| `update.test.ts` 35 tests pass | `node --test tests/orchestrators/marketplace/update.test.ts` | `pass 35, fail 0` | PASS |
| `npm run check` full suite | `npm run check` in `extensions/pi-claude-marketplace/` | `pass 1312, fail 0` | PASS |

### Probe Execution

No phase-declared probes. Behavioral spot-checks above serve as the functional verification.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| AUTH-01 | 35-01 | `addGithubInGuard` triggers Device Flow on private-repo clone miss | SATISFIED | `add.ts` constructs `onAuthRequired` closure; 3 AUTH-01 tests in `add.test.ts` including byte-exact prompt assertion on fill-MISS path |
| AUTH-02 | 35-02 | `marketplace update` silently reuses stored token; Device Flow only on eviction | SATISFIED | `refreshRecord` constructs auth bundle with same pattern; AUTH-02 fill-HIT test asserts no notify fires; fill-MISS test confirms bundle forwarded to `refreshGitHubClone` |
| AUTH-03 | 35-03 | Device Flow prompt byte form documented and locked | SATISFIED | `docs/output-catalog.md` section + `tests/shared/device-flow-prompt.test.ts` byte-form equality test |
| AUTH-09 (Phase 35 extension) | 35-03 | Architecture gate extended to `add.ts` + `update.ts` | SATISFIED | 4th test in `no-credential-leak.test.ts` scans both orchestrator files; closes WR-02 |

### Anti-Patterns Found

No debt markers (`TBD`, `FIXME`, `XXX`) found in any of the 8 files modified/created by this phase.

| File | Pattern | Severity | Impact |
|------|---------|----------|--------|
| None | -- | -- | -- |

### Human Verification Required

None. All success criteria are mechanically verifiable and confirmed by automated tests.

### Gaps Summary

No gaps. All 5 must-haves are VERIFIED with passing tests and real implementations.

---

_Verified: 2026-06-01T17:20:18Z_
_Verifier: Claude (gsd-verifier)_
