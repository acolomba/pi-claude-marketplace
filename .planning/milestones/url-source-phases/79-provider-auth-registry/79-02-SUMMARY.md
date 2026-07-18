---
phase: 79-provider-auth-registry
plan: 02
subsystem: auth
tags: [provider-registry, device-flow, marketplace, host-keyed-auth, url-sources]

# Dependency graph
requires:
  - phase: 79-provider-auth-registry
    plan: 01
    provides: GitAuthProvider registry (findProviderForHost), provider-parameterized initiateDeviceFlow, PROVIDER_FILES leak-gate array
provides:
  - buildAuthForHost host->GitAuthBundle factory + hostFromCloneUrl + NO_PROVIDER_CAUSE (orchestrators/auth-host.ts)
  - resolveRemoteRef threads an optional auth bundle into listServerRefs (Q1; PROV-03 unpinned private HEAD)
  - marketplace add/update generalized off the inline host="github.com" blocks (PROV-02/03/04)
  - update-path no-provider cause line via the synthetic failed-plugin child row (D-79-03 as amended)
affects: [79-03 plugin clone-cache auth wiring (imports buildAuthForHost)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "buildAuthForHost: single host->bundle seam; undefined-for-no-provider is the cross-host leak guard (T-79-04)"
    - "Cause-line attach at chain TAIL (err.cause = new Error(line)) keeps the HttpError at depth 1 for one-level-unwrap classification"

key-files:
  created:
    - extensions/pi-claude-marketplace/orchestrators/auth-host.ts
    - tests/orchestrators/auth-host.test.ts
  modified:
    - extensions/pi-claude-marketplace/platform/git.ts
    - extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts
    - extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts
    - extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts
    - tests/helpers/git-mock.ts
    - tests/orchestrators/plugin/clone-cache.test.ts
    - tests/orchestrators/marketplace/add.test.ts
    - tests/orchestrators/marketplace/update.test.ts
    - tests/architecture/no-credential-leak.test.ts

key-decisions:
  - "Checkpoint decision (user, Option C): the no-provider cause line renders ONLY where the grammar already supports cause chains -- update's synthetic failed-plugin child row. Marketplace add keeps its no-child-rows invariant (D-01/D-10) and renders the bare (failed) {authentication required} row. D-79-03 amended accordingly; no renderer changes."
  - "The update-path cause line is attached as the chain TAIL (mutating err.cause on the HttpError when undefined), so the HttpError stays at cause-depth 1 where transportReason's one-level unwrap classifies it."
  - "transportReason gained an HttpError 401/403 arm so a marketplace-update auth challenge classifies as the existing closed-set 'authentication required' token instead of falling to 'network unreachable' (D-76-08 parity with add.ts; no new REASONS token)."
  - "auth-host.ts imports platform/git.ts type-only and never names gitOps/DEFAULT_GIT_OPS, so Plan 03's install.ts can import it without tripping the no-orchestrator-network gate."

patterns-established:
  - "Host-keyed auth seam: extract host via hostFromCloneUrl(url, kind), look up provider via buildAuthForHost, spread `...(auth !== undefined && { auth })` at the git-op call site."

requirements-completed: [PROV-02, PROV-04]

coverage:
  - id: D1
    description: "buildAuthForHost returns a provider-bound bundle for github.com and undefined for an unregistered host; hostFromCloneUrl is port-inclusive (Q2); authMemo caps the flow at once per host (D-79-02)."
    requirement: "PROV-03, PROV-04"
    verification:
      - kind: unit
        ref: "tests/orchestrators/auth-host.test.ts (5 tests)"
        status: pass
    human_judgment: false
  - id: D2
    description: "resolveRemoteRef threads an optional auth bundle into listServerRefs (Q1); public path byte-identical; git-mock records the bundle."
    requirement: "PROV-03"
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/clone-cache.test.ts#PROV-03 mock resolveRemoteRef records a threaded auth bundle"
        status: pass
      - kind: unit
        ref: "tests/platform/git-auth-callbacks.test.ts (unchanged, passes)"
        status: pass
    human_judgment: false
  - id: D3
    description: "add/update resolve auth per host via buildAuthForHost; github byte-identical; public no-provider url clones authless; no-provider 401 fails clean with the cause line on the update path only."
    requirement: "PROV-02, PROV-03, PROV-04"
    verification:
      - kind: unit
        ref: "tests/orchestrators/marketplace/add.test.ts#PROV-04 bare row + #PROV-02 authless public (38 tests)"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/marketplace/update.test.ts#PROV-04 / D-79-03 no-provider cause line (50 tests)"
        status: pass
      - kind: unit
        ref: "tests/domain/github-auth.test.ts + tests/integration/auth-e2e.test.ts + tests/platform/git-auth-callbacks.test.ts (byte-identical vs base commit, all pass)"
        status: pass
    human_judgment: false
  - id: D4
    description: "auth-host.ts is covered by the no-credential-leak gate (PROV-05) and stays clean under the no-orchestrator-network gate."
    requirement: "PROV-05"
    verification:
      - kind: unit
        ref: "tests/architecture/no-credential-leak.test.ts (PROVIDER_FILES includes auth-host.ts)"
        status: pass
      - kind: unit
        ref: "tests/architecture/no-orchestrator-network.test.ts (passes)"
        status: pass
    human_judgment: false

# Metrics
duration: 36min
completed: 2026-07-11
status: complete
---

# Phase 79 Plan 02: Marketplace Host-Keyed Auth Wiring Summary

**Registry-driven `buildAuthForHost` replaces the two inline `host="github.com"` Device Flow blocks in marketplace add/update, threads optional auth into `resolveRemoteRef`, and delivers the no-provider fail-clean contract -- with the D-79-03 cause line scoped (by user checkpoint decision) to the update path's cause-carrying child row.**

## Performance

- **Duration:** ~36 min (including one blocking checkpoint decision)
- **Started:** 2026-07-11T18:35:05Z
- **Completed:** 2026-07-11T19:11:00Z
- **Tasks:** 3
- **Files modified:** 11 (2 created)

## Accomplishments
- Created `orchestrators/auth-host.ts`: `buildAuthForHost` looks up the provider per host and binds its Device Flow as `onAuthRequired` (D-79-05); returns `undefined` for a no-provider host so no bundle can leak cross-host (PROV-04, T-79-04). `hostFromCloneUrl` extracts the port-inclusive `URL.host` (Q2); `NO_PROVIDER_CAUSE` owns the single cause line (D-79-03). An optional `authMemo` caps the flow at once per host per command (D-79-02, consumed by Plan 03).
- Threaded an optional auth bundle through `ResolveRemoteRefOptions` -> `listServerRefs` (Q1 resolved) so an unpinned private-repo HEAD resolution can authenticate; `GitOps.resolveRemoteRef` and the git-mock carry the widened shape; the public path is byte-identical.
- Replaced both inline `const host = "github.com"` blocks: add.ts (github + url arms) and update.ts (github + url arms) now resolve auth via `buildAuthForHost`. Public no-provider url sources clone/refresh authless (PROV-02); github stays byte-identical (all three frozen auth test files unmodified vs base and green); provider hosts authenticate host-keyed (PROV-03 marketplace side).
- No-provider fail-clean (PROV-04): a url-source 401/403 surfaces the existing `authentication required` token. On the update path the synthetic failed-plugin child row additionally carries `no auth provider is registered for <host>` in its cause-chain trailer; the add path renders the bare row (amended D-79-03, checkpoint Option C).
- Extended the no-credential-leak gate to scan `orchestrators/auth-host.ts` (PROV-05); auth-host.ts is gate-clean for the no-orchestrator-network gate (type-only platform/git.ts import, never names gitOps).

## Task Commits

Each task was committed atomically:

1. **Task 1: buildAuthForHost + hostFromCloneUrl (TDD)** - `9a24ef2b` (feat)
2. **Task 2: Thread optional auth into resolveRemoteRef (TDD)** - `368be94f` (feat)
3. **Task 3: Wire buildAuthForHost into add/update + leak gate (TDD)** - `a57ab073` (feat)

## Files Created/Modified
- `extensions/pi-claude-marketplace/orchestrators/auth-host.ts` - buildAuthForHost, hostFromCloneUrl, NO_PROVIDER_CAUSE (gate-clean).
- `extensions/pi-claude-marketplace/platform/git.ts` - ResolveRemoteRefOptions.auth?; resolveRemoteRef spreads onAuth/onAuthFailure into listServerRefs.
- `extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts` - GitOps.resolveRemoteRef gains auth?: GitAuthBundle.
- `extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts` - github/url arms use buildAuthForHost; addUrlInGuard threads ctx/credentialOps/deviceFlowHttp.
- `extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts` - github arm uses buildAuthForHost; new refreshUrlClone helper (auth + cause-line attach); transportReason helper classifies HttpError 401/403 as `authentication required`.
- `tests/orchestrators/auth-host.test.ts` - bundle shape, no-provider undefined, host extraction, memo (5 tests).
- `tests/helpers/git-mock.ts` - resolveRemoteRefCalls records the optional auth bundle.
- `tests/orchestrators/plugin/clone-cache.test.ts` - PROV-03 threaded-auth recording test.
- `tests/orchestrators/marketplace/add.test.ts` - PROV-04 bare-row lock, PROV-02 authless-public lock.
- `tests/orchestrators/marketplace/update.test.ts` - PROV-04 no-provider cause-line test.
- `tests/architecture/no-credential-leak.test.ts` - PROVIDER_FILES gains auth-host.ts.

## Decisions Made
- **Checkpoint (Rule 4 -> user decision, Option C):** The plan assumed the marketplace-add failure row renders `Error.cause` chains; it does not (add is architecturally committed to `plugins: []` with an empty render map -- D-01/D-10 -- and `renderMpHeader` renders no mp-level cause). The user chose Option C: D-79-03 amended so the cause line renders only on the update path's synthetic failed-plugin child row; the add row stays the bare `(failed) {authentication required}`; no renderer/ADD_CONTEXT changes.
- Cause line attached at the chain TAIL (`httpErr.cause = new Error(NO_PROVIDER_CAUSE(host))`, only when `cause` is undefined) so the causality reads "401 because no provider is registered" AND the HttpError stays at depth 1 for the classifier's one-level unwrap.
- `GITHUB_PROVIDER` is not imported by auth-host.ts: byte-identity flows through `findProviderForHost("github.com")` returning the descriptor; importing the unused symbol would only add lint noise.

## Deviations from Plan

### User-decided (Rule 4)

**1. [Rule 4 - Architectural] No-provider cause line dropped from the marketplace add path (Option C)**
- **Found during:** Task 3
- **Issue:** The plan's action directed attaching NO_PROVIDER_CAUSE via Error.cause "so the depth-5 causeChainTrailer renders it BELOW the `authentication required` row" on the add path. Verified empirically that marketplace-level add failure rows never render cause chains; surfacing the line would require breaking add's no-child-rows invariant (D-10) or changing the central renderer.
- **Resolution:** Checkpoint raised; user chose Option C. D-79-03 amended on main ("docs(79): amend D-79-03 cause line scope per checkpoint"). Plan Test 2 adjusted: add asserts the bare row; the cause-line assertion moved to the update-path test.
- **Commits:** `a57ab073`

### Auto-fixed Issues

**2. [Rule 1 - Bug] Marketplace update misclassified 401/403 as `network unreachable`**
- **Found during:** Task 3 (update-path cause-line test)
- **Issue:** `reasonsFromCascadeError` had no HttpError arm, so any 401/403 on a marketplace refresh fell through to the `?? ["network unreachable"]` default -- a lying reason, and incoherent next to the new no-provider cause line. add.ts and plugin/update.ts already classify this correctly (D-76-08).
- **Fix:** `transportReason` classifies a (one-level-unwrapped) HttpError with statusCode 401/403 as the existing closed-set `authentication required` token. No new REASONS token; no test asserted the old misclassification.
- **Files modified:** extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts
- **Commit:** `a57ab073`

**3. [Rule 3 - Blocking] sonarjs cognitive-complexity errors after the url-arm additions**
- **Found during:** Task 3 (lint)
- **Issue:** The url-arm try/catch pushed `refreshRecord` to complexity 17 and the HttpError arm pushed `reasonsFromCascadeError` to 16 (limit 15).
- **Fix:** Extracted `refreshUrlClone` (url refresh + cause-line attach) and `transportReason` (errno/HttpError narrowing) as documented helpers; behavior-neutral, verified by the full marketplace suites.
- **Files modified:** extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts
- **Commit:** `a57ab073`

---

**Total deviations:** 1 user-decided (Rule 4 checkpoint, Option C), 2 auto-fixed (1 bug, 1 blocking). No scope creep beyond the plan-scoped files.

## Issues Encountered
- The `trufflehog` pre-commit hook cannot read the worktree git index (`.git/index: not a directory`) -- the known worktree-sandbox limitation in CLAUDE.md. All commits used `SKIP=trufflehog`; no other hooks skipped.

## Requirements Status
- **PROV-02:** complete (public repos on any host clone/refresh authless; no auth bundle without a registered provider).
- **PROV-04:** complete (no-provider hosts fail clean with `authentication required`; the single cause line renders on the update path per amended D-79-03).
- **PROV-03:** marketplace side complete (host-keyed flow + storage on add/update, plus the resolveRemoteRef auth thread). The plugin clone-cache side lands in Plan 03 -- do not mark PROV-03 fully complete until then.

## Known Stubs
None.

## User Setup Required
None.

## Next Phase Readiness
- Plan 03 imports `buildAuthForHost` / `hostFromCloneUrl` / `NO_PROVIDER_CAUSE` from `orchestrators/auth-host.ts`; the module is gate-clean (type-only platform/git.ts import) so install.ts stays clean under the no-orchestrator-network gate.
- The `authMemo` parameter (D-79-02 once-per-host) is wired and tested, ready for Plan 03's command-scope memo.
- `GitOps.resolveRemoteRef` accepts `auth?: GitAuthBundle` for Plan 03's unpinned private-repo pin resolution.

## Self-Check: PASSED

---
*Phase: 79-provider-auth-registry*
*Completed: 2026-07-11*
