---
phase: 79-provider-auth-registry
verified: 2026-07-11T21:00:00Z
status: passed
score: 5/5 must-haves verified
behavior_unverified: 0
overrides_applied: 0
---

# Phase 79: Provider-auth registry Verification Report

**Phase Goal:** A Pi user can clone public repos from any host without authentication, authenticate against private/self-hosted hosts that have a registered provider, and receive a clean actionable error for hosts with no provider — all with no credential ever leaking into output.
**Verified:** 2026-07-11T21:00:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth (ROADMAP Success Criterion) | Status | Evidence |
|---|---|---|---|
| 1 | A `GitAuthProvider` registry (id, host match, authenticate) exists, and the GitHub provider wraps the existing RFC-8628 Device Flow with byte-identical behavior for github.com | ✓ VERIFIED | `domain/auth-registry.ts` defines `GitAuthProvider` (id, hostMatch, deviceCodeUrl, tokenUrl, clientId, scope, credentialFrom), `GITHUB_PROVIDER` with today's exact literals (client_id `Ov23liNcyK08uGdU0mMl`, scope `repo`), and `findProviderForHost`. `domain/github-auth.ts` parameterizes `initiateDeviceFlow` by an optional `provider` defaulting to `GITHUB_PROVIDER`. The three byte-identity test files (`tests/domain/github-auth.test.ts`, `tests/shared/device-flow-prompt.test.ts`, `tests/integration/auth-e2e.test.ts`) are byte-for-byte unmodified since before the phase (`git log` shows last commit `5f1d0c57`, predating the phase's `5c83dfac`/`9a24ef2b`/`4b04dc24`) and all 32 tests pass green. |
| 2 | A public repo on any host clones unauthenticated with no provider involved | ✓ VERIFIED | `buildAuthForHost` returns `undefined` when `findProviderForHost` misses; `addUrlInGuard`/plugin install probes only spread `auth` when defined (`...(auth !== undefined && { auth })`). `materializePluginClone` and `GitOps.clone`/`resolveRemoteRef` are byte-identical when `auth` is omitted. Confirmed by passing PROV-02 tests in `tests/orchestrators/marketplace/add.test.ts`, `tests/orchestrators/plugin/install-auth.test.ts`, `tests/orchestrators/plugin/update-reinstall-auth.test.ts`. |
| 3 | An auth-required clone against a host with a registered provider runs that provider's flow and stores the credential host-keyed via `CredentialOps` | ✓ VERIFIED | `buildAuthForHost`'s `onAuthRequired` calls `initiateDeviceFlow({ provider, host, credentialOps, ... })`; `CredentialOps` is host-keyed (pre-existing, confirmed unchanged). Wired at both marketplace (`add.ts`/`update.ts`, `buildAuthForHost` grep counts 6/4) and plugin (`install.ts`/`update.ts`/`reinstall.ts`, counts 5/3/2) call sites. Once-per-host `authMemo` verified in `tests/orchestrators/auth-host.test.ts` ("consults an authMemo so a provider host runs the flow AT MOST ONCE per host") and `tests/orchestrators/plugin/install-auth.test.ts`. |
| 4 | An auth-required clone against a host with no registered provider fails clean with an actionable error and no isomorphic-git retry loop | ✓ VERIFIED | `buildAuthForHost` returns `undefined` for a no-provider host, so no `onAuth`/`onAuthFailure` callback is registered at all on the clone — isomorphic-git has no retry hook to invoke (structural fail-clean). The 401/403 classifies as the existing closed-set `authentication required` reason. Per the AMENDED D-79-03 (Option C, user checkpoint 2026-07-11): the cause line `no auth provider is registered for <host>` renders ONLY on the update path's synthetic failed-plugin child row (`orchestrators/marketplace/update.ts:389`, `err.cause = new Error(NO_PROVIDER_CAUSE(host))`); marketplace add and plugin install/reinstall show the bare `(failed) {authentication required}` row with no cause line — verified directly: `grep NO_PROVIDER_CAUSE` finds it only in `update.ts`, absent from `add.ts` and `install.ts`. Test assertions confirm both sides of the amended contract in `add.test.ts:1455` (`includes("no auth provider is registered")` === false), `update.test.ts:333` (cause line present), and `install-auth.test.ts:387` (absent). |
| 5 | The no-credential-leak architecture gate (`tests/architecture/no-credential-leak.test.ts`) covers every provider file | ✓ VERIFIED | `PROVIDER_FILES` array includes `domain/auth-registry.ts` and `orchestrators/auth-host.ts`; gate test passes (6/6 in the full architecture suite run, including the PROV-05-titled test and the no-orchestrator-network NFR-5 test). `install.ts`/`reinstall.ts` verified to have zero `platform/git*` imports (grep returns empty), confirming they stay off the network gate while still reaching the auth surface through `auth-host.ts` re-exports. |

**Score:** 5/5 truths verified (0 present-but-behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
|---|---|---|---|
| `extensions/pi-claude-marketplace/domain/auth-registry.ts` | GitAuthProvider interface, GITHUB_PROVIDER const, findProviderForHost | ✓ VERIFIED | Exists, substantive (67 lines, full interface + descriptor + lookup), wired into github-auth.ts and auth-host.ts |
| `extensions/pi-claude-marketplace/domain/github-auth.ts` (modified) | provider param parameterizes the engine | ✓ VERIFIED | `provider?: GitAuthProvider` optional field; `opts.provider ?? GITHUB_PROVIDER` default; URLs/clientId/scope/credentialFrom all sourced from descriptor |
| `extensions/pi-claude-marketplace/orchestrators/auth-host.ts` | buildAuthForHost, hostFromCloneUrl, NO_PROVIDER_CAUSE | ✓ VERIFIED | Exists, substantive (113 lines), gate-clean (type-only platform/git.ts import), wired into add/update/install/update/reinstall |
| `tests/domain/auth-registry.test.ts` | PROV-01 lookup + descriptor shape | ✓ VERIFIED | Exists, passes (part of the 12-test auth-registry+auth-host run) |
| `tests/orchestrators/auth-host.test.ts` | provider-found bundle, no-provider undefined, host extraction, memo | ✓ VERIFIED | Exists, passes |
| `tests/architecture/no-credential-leak.test.ts` (extended) | PROVIDER_FILES gains auth-registry.ts, auth-host.ts | ✓ VERIFIED | Confirmed both files in PROVIDER_FILES array; gate green |
| `materializePluginClone` (clone-cache.ts, modified) | optional auth?: GitAuthBundle | ✓ VERIFIED | `auth?: GitAuthBundle` field + `auth: args.auth` spread confirmed at lines 63/83 |
| `tests/orchestrators/plugin/install-auth.test.ts` | PROV-02/03/04 + memo | ✓ VERIFIED | Exists, 4 core behaviors + full suite (27 tests across install-auth + update-reinstall-auth) pass |

### Key Link Verification

| From | To | Via | Status | Details |
|---|---|---|---|---|
| `github-auth.ts` engine | `auth-registry.ts` descriptor | `opts.provider ?? GITHUB_PROVIDER` | ✓ WIRED | Confirmed at github-auth.ts:389; clientId/scope/credentialFrom all read from provider |
| `add.ts`/`update.ts` | `auth-host.ts` | `buildAuthForHost(...)` replacing inline `host = "github.com"` | ✓ WIRED | Inline literal count = 0 in both files; buildAuthForHost call counts 6 (add.ts) / 4 (update.ts) |
| `install.ts`/`update.ts`/`reinstall.ts` (plugin) | `auth-host.ts` | `buildAuthForHost` via clone-cache seam | ✓ WIRED | Call counts 5/3/2 respectively; `install.ts`/`reinstall.ts` have zero direct `platform/git*` imports (gate-clean, auth surface reached via auth-host.ts re-exports) |
| `resolveRemoteRef` (platform/git.ts) | `listServerRefs` | optional `auth` bundle spread as `onAuth`/`onAuthFailure` | ✓ WIRED | `ResolveRemoteRefOptions.auth?` present; `onAuth` referenced in clone/fetch/resolveRemoteRef (3 occurrences confirmed in prior plan acceptance criteria, tests pass) |
| `resolvePluginPin` (clone-cache.ts) | `resolveRemoteRef` | optional auth forwarded for unpinned private HEAD (Q1) | ✓ WIRED | Confirmed via passing `update-reinstall-auth.test.ts` Q1 test and `clone-cache.test.ts` resolvePluginPin auth-passthrough test |
| no-provider host | isomorphic-git retry | `buildAuthForHost` returns `undefined` → no `onAuth` callback registered | ✓ WIRED (structural) | No callback = no retry hook; confirmed via code inspection of `CloneOptions.auth?`/spread pattern — omitted auth means no onAuth/onAuthFailure passed to isomorphic-git at all |

### Behavioral Spot-Checks / Test Execution

| Behavior | Command | Result | Status |
|---|---|---|---|
| Byte-identity trio (github-auth, device-flow-prompt, auth-e2e) | `node --test tests/domain/github-auth.test.ts tests/shared/device-flow-prompt.test.ts tests/integration/auth-e2e.test.ts` | 32/32 pass | ✓ PASS |
| Registry + host-keyed bundle factory | `node --test tests/domain/auth-registry.test.ts tests/orchestrators/auth-host.test.ts` | 12/12 pass | ✓ PASS |
| Architecture gates | `node --test tests/architecture/no-credential-leak.test.ts tests/architecture/no-orchestrator-network.test.ts` | 6/6 pass | ✓ PASS |
| Marketplace add/update auth wiring | `node --test tests/orchestrators/marketplace/add.test.ts tests/orchestrators/marketplace/update.test.ts` | 88/88 (combined) pass | ✓ PASS |
| Plugin install/update/reinstall/clone-cache auth wiring | `node --test tests/orchestrators/plugin/install-auth.test.ts tests/orchestrators/plugin/update-reinstall-auth.test.ts tests/orchestrators/plugin/clone-cache.test.ts` | 27/27 pass | ✓ PASS |
| Combined full-scope run (all 14 phase-relevant test files) | `node --test` (14 files listed) | 256/256 pass | ✓ PASS |
| Typecheck | `npx tsc --noEmit -p .` | exit 0, no output | ✓ PASS |

Note: per the prompt's provided context, `npm run check` was already verified green twice at HEAD by the executor; this verification ran targeted `node --test` invocations against the specific phase-relevant files (14 files, 256 tests) plus a standalone `tsc --noEmit`, rather than re-running the full suite, consistent with spot-check guidance.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|---|---|---|---|---|
| PROV-01 | 79-01 | GitAuthProvider registry; GitHub wraps RFC-8628 byte-identically | ✓ SATISFIED | auth-registry.ts + byte-identity trio green |
| PROV-02 | 79-02, 79-03 | Public repos on any host clone unauthenticated | ✓ SATISFIED | buildAuthForHost undefined-for-no-provider + tests |
| PROV-03 | 79-02, 79-03 | Registered-host auth runs the flow; credential stored host-keyed via CredentialOps | ✓ SATISFIED | buildAuthForHost onAuthRequired + CredentialOps host-keying (pre-existing, unchanged) + marketplace/plugin wiring tests |
| PROV-04 | 79-02, 79-03 | No-provider host fails clean, no retry loop | ✓ SATISFIED | undefined bundle → no onAuth registered; amended D-79-03 cause-line scoping verified in code and tests |
| PROV-05 | 79-01, 79-02 | no-credential-leak gate covers every provider file | ✓ SATISFIED | PROVIDER_FILES includes auth-registry.ts, auth-host.ts; gate passes |

No orphaned requirements: all 5 PROV-0x IDs from REQUIREMENTS.md are claimed across the three plans (79-01: PROV-01/05; 79-02: PROV-02/03/04; 79-03: PROV-02/03/04).

**Doc-sync note (non-blocking):** `.planning/workstreams/url-source/REQUIREMENTS.md` still shows PROV-01..05 as unchecked `[ ]` checkboxes and "Pending" in the Traceability table, even though all three phase summaries report `status: complete` and the code/tests confirm delivery. This is a stale-checkbox documentation gap, not a code gap — recommend updating REQUIREMENTS.md checkboxes and traceability status to reflect Phase 79 completion (mirroring how Phase 76/77 rows were updated).

### Anti-Patterns Found

None blocking. Scanned all phase-touched files (`domain/auth-registry.ts`, `orchestrators/auth-host.ts`, `domain/github-auth.ts`, `orchestrators/marketplace/add.ts`, `orchestrators/marketplace/update.ts`, `orchestrators/plugin/clone-cache.ts`, `orchestrators/plugin/install.ts`, `orchestrators/plugin/update.ts`, `orchestrators/plugin/reinstall.ts`, `platform/git.ts`) for TBD/FIXME/XXX/TODO/HACK/PLACEHOLDER/"not yet implemented" markers — none found. The one `PLACEHOLDER`-adjacent match (`SYNTHETIC_UPDATE_PLACEHOLDER_NAME` in `update.ts`) is a pre-existing domain constant name (a synthetic row label `"(update)"`), not a stub/debt marker.

### Human Verification Required

None. All five ROADMAP success criteria are verifiable via code inspection + automated tests; no visual, real-time, or external-service-dependent behavior in this phase's scope.

### Gaps Summary

No gaps. All 5 ROADMAP success criteria verified against actual codebase state (not SUMMARY claims): the registry exists and is byte-identical for github.com; public repos clone authless; registered-host auth runs host-keyed via CredentialOps; no-provider hosts fail clean with no retry loop (with the AMENDED D-79-03 cause-line scoping correctly implemented — cause line only on the update path's synthetic child row, bare row elsewhere); and the no-credential-leak gate covers every provider file (auth-registry.ts, auth-host.ts). All 256 tests across the 14 phase-relevant test files pass, plus a clean typecheck. The three byte-identity test files are confirmed unmodified via git log since before the phase's first commit. Only a non-blocking documentation-sync issue was found (REQUIREMENTS.md checkboxes/traceability table not updated to reflect completion) — this does not affect the phase goal being achieved in the codebase.

---

*Verified: 2026-07-11T21:00:00Z*
*Verifier: Claude (gsd-verifier)*
