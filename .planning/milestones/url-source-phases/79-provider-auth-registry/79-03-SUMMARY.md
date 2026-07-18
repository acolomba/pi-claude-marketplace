---
phase: 79-provider-auth-registry
plan: 03
subsystem: auth
tags: [provider-auth, plugin-clone-cache, host-keyed-auth, once-per-host-memo, url-sources]

# Dependency graph
requires:
  - phase: 79-provider-auth-registry
    plan: 01
    provides: GitAuthProvider registry (findProviderForHost), provider-parameterized Device Flow
  - phase: 79-provider-auth-registry
    plan: 02
    provides: buildAuthForHost + hostFromCloneUrl + NO_PROVIDER_CAUSE (auth-host.ts), resolveRemoteRef auth thread, marketplace add/update host-keyed
provides:
  - materializePluginClone forwards an optional GitAuthBundle to gitOps.clone (clone-cache.ts)
  - resolvePluginPin forwards an optional GitAuthBundle into resolveRemoteRef (Q1 unpinned private HEAD)
  - install threads a host-keyed bundle + once-per-host authMemo through the clone probe (PROV-03, D-79-01/02)
  - install classifies a 401/403 clone throw as the bare `authentication required` reason (PROV-04, amended D-79-03)
  - update + reinstall probes build + thread the bundle (update Q1 pin-resolution + re-clone; reinstall Q3 cold-cache re-clone)
  - auth-host.ts re-exports DEFAULT_CREDENTIAL_OPS + credential/auth TYPES so the network-gated plugin files import them off the platform/git gate
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Gate-clean auth surface: install.ts / reinstall.ts import DEFAULT_CREDENTIAL_OPS + CredentialOps/DeviceFlowHttp/AuthAttemptResult TYPES from orchestrators/auth-host.ts, NOT platform/git*, because the no-orchestrator-network gate greps for ANY platform/git import (even type-only)"
    - "Command-scope authMemo Map threaded caller -> installPlugin -> runInstallLedger -> makeInstallCloneProbe -> buildAuthForHost.onAuthRequired caps the provider flow at once per host (D-79-02)"
    - "ctx-carries-auth-notify-seam: InstallLedgerOptions gains ctx solely so the clone probe can wire buildAuthForHost's notify seam; the ledger still never notifies success/failure itself"

key-files:
  created:
    - tests/orchestrators/plugin/install-auth.test.ts
    - tests/orchestrators/plugin/update-reinstall-auth.test.ts
  modified:
    - extensions/pi-claude-marketplace/orchestrators/plugin/clone-cache.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/install.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/update.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts
    - extensions/pi-claude-marketplace/orchestrators/auth-host.ts
    - tests/orchestrators/plugin/clone-cache.test.ts

key-decisions:
  - "Amended D-79-03 followed as authoritative (parallel_execution contract note + 79-CONTEXT): plugin install/reinstall no-provider failures render the BARE `(failed) {authentication required}` row with NO `no auth provider is registered for <host>` cause line and NO renderer change. The cause line lives only on the update path's synthetic failed-plugin child row, delivered in Plan 02. This overrides the plan's must_haves truth that called for a cause line on install."
  - "install.ts / reinstall.ts cannot import from platform/git.ts OR platform/git-credential.ts even type-only -- the no-orchestrator-network gate regex `from ...platform/git...` matches both. DEFAULT_CREDENTIAL_OPS + the credential/auth types are re-exported through the gate-exempt orchestrators/auth-host.ts (the module install already imports buildAuthForHost from). This corrects the plan's literal import instruction (Rule 3 blocking)."
  - "InstallLedgerOptions gains a required `ctx` (threaded from both callers: installPlugin + enable-disable's runEnableBranch) so the git-source clone probe can build buildAuthForHost's notify seam. The ledger's no-notify contract is preserved -- ctx feeds only the auth prompt."
  - "plugin update's git-probe 401/403 classification (classifyGitProbeFailure) is left UNCHANGED -- no new no-provider cause line added on the plugin-update path (amended D-79-03 scopes the cause line to Plan 02's marketplace-update child row; the Task 3 tests do not require it)."
  - "update's makeUpdateCloneProbe builds the bundle only when ctx is defined; cascade mode (updateSinglePlugin, ctx undefined) threads no bundle -- there is no user UI to prompt."

patterns-established:
  - "Capturing seam test pattern: wrap the real InstallCloneCacheSeam / UpdateCloneCacheSeam / ReinstallCloneCacheSeam to record the `auth` arg passed to materializePluginClone / resolvePluginPin, then assert install/update/reinstall built + threaded the host-keyed bundle."

requirements-completed: [PROV-02, PROV-03, PROV-04]

coverage:
  - id: D1
    description: "materializePluginClone forwards an optional auth bundle to gitOps.clone; omitting it is byte-identical public-only."
    requirement: "PROV-02, PROV-03"
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/clone-cache.test.ts (no-auth undefined + auth-threaded tests, 19 tests green)"
        status: pass
    human_judgment: false
  - id: D2
    description: "install threads the host-keyed bundle + once-per-host memo through the clone probe; provider hosts authenticate, public/no-provider hosts clone authless, no-provider 401 fails clean with the bare authentication-required row; install.ts stays gate-clean."
    requirement: "PROV-02, PROV-03, PROV-04, D-79-01, D-79-02"
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/install-auth.test.ts (PROV-03 threading, PROV-02 authless, D-79-02 memo-once, PROV-04 bare cause-line-free row -- 4 tests)"
        status: pass
      - kind: unit
        ref: "tests/architecture/no-orchestrator-network.test.ts (install.ts names no gitOps)"
        status: pass
    human_judgment: false
  - id: D3
    description: "update + reinstall thread the bundle through their probes; unpinned private update authenticates at pin-resolution (Q1); cold-cache reinstall re-clones with auth while warm cache stays offline (Q3); reinstall.ts honors its network gate."
    requirement: "PROV-02, PROV-03"
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/update-reinstall-auth.test.ts (update PROV-03 + Q1 unpinned, reinstall Q3 cold-cache, reinstall PROV-02 no-provider -- 4 tests)"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/clone-cache.test.ts#resolvePluginPin auth passthrough (Q1)"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/reinstall.test.ts warm-cache offline test (resolveRemoteRefCalls/cloneCalls empty, PURL-07 unbroken)"
        status: pass
      - kind: unit
        ref: "tests/architecture/no-orchestrator-network.test.ts (reinstall.ts names no gitOps)"
        status: pass
    human_judgment: false
  - id: D4
    description: "github.com behavior unchanged end-to-end (byte-identity trio) and no credential leaks introduced."
    requirement: "PROV-05, SC-1"
    verification:
      - kind: unit
        ref: "tests/domain/github-auth.test.ts + tests/integration/auth-e2e.test.ts + tests/platform/git-auth-callbacks.test.ts (50 tests, unchanged, pass)"
        status: pass
      - kind: unit
        ref: "tests/architecture/no-credential-leak.test.ts (pass)"
        status: pass
    human_judgment: false

# Metrics
duration: 46min
completed: 2026-07-11
status: complete
---

# Phase 79 Plan 03: Plugin Clone-Cache Auth Wiring Summary

**The plugin install / update / reinstall clone paths thread a host-keyed `GitAuthBundle` (from Plan 02's `buildAuthForHost`) through the clone-cache seam: private git-source plugins authenticate on provider hosts, public / no-provider hosts clone authless, no-provider clones fail clean with the bare `authentication required` row, and a command-scope once-per-host memo caps the flow -- all while `install.ts` / `reinstall.ts` stay off the platform-git gate.**

## Performance

- **Duration:** ~46 min
- **Started:** 2026-07-11T19:23:19Z
- **Completed:** 2026-07-11T20:08:58Z
- **Tasks:** 3 (all TDD)
- **Files modified:** 9 (2 test files created)

## Accomplishments

- **Task 1 (clone-cache):** `materializePluginClone` gained an optional `auth?: GitAuthBundle`, spread into `gitOps.clone` via `...(args.auth !== undefined && { auth })`. Omitting it is byte-identical to the public-only path (PROV-02); present, it authenticates the clone (PROV-03/D-79-01).
- **Task 2 (install):** `InstallPluginOptions` + `InstallLedgerOptions` gained `credentialOps?` / `deviceFlowHttp?` / `authMemo?` (+ a required `ctx` on the ledger options for the auth notify seam). `makeInstallCloneProbe` extracts the host from the resolved cloneUrl, builds the bundle via `buildAuthForHost`, and threads it to the seam. A 401/403 clone throw classifies as the bare closed-set `authentication required` reason (amended D-79-03: no cause line, no renderer change). The command-scope `authMemo` caps the provider flow at once per host (D-79-02).
- **Task 3 (update + reinstall):** `makeUpdateCloneProbe` builds the bundle and threads it into BOTH `resolvePluginPin` (so an unpinned private HEAD resolution authenticates its `resolveRemoteRef`, Q1) AND `materializePluginClone`; `resolvePluginPin` gained `auth?` forwarded into `resolveRemoteRef`. `makeReinstallCloneProbe` threads the bundle on the cold-cache re-clone (Q3) while the warm cache short-circuits before the clone (offline parity, PURL-07 unbroken).
- **Gate compliance:** `install.ts` and `reinstall.ts` name no `gitOps` / `DEFAULT_GIT_OPS` and import nothing from `platform/git*`; the credential/auth surface reaches them through `orchestrators/auth-host.ts` re-exports. The no-orchestrator-network gate stays green.
- **Byte-identity:** the three frozen auth test files (github-auth, auth-e2e, git-auth-callbacks) pass unchanged; `npm run check` is fully green (typecheck + eslint + prettier + tests + integration).

## Task Commits

Each task committed atomically (all TDD -- RED test written and confirmed failing before GREEN):

1. **Task 1: optional auth on materializePluginClone** - `1a59241e` (feat)
2. **Task 2: install auth bundle + once-per-host memo** - `4b04dc24` (feat)
3. **Task 3: update + reinstall probe auth threading** - `6add06b2` (feat)

## Files Created/Modified

- `orchestrators/plugin/clone-cache.ts` - `materializePluginClone` + `resolvePluginPin` gain `auth?: GitAuthBundle`, forwarded to `gitOps.clone` / `gitOps.resolveRemoteRef`.
- `orchestrators/plugin/install.ts` - auth options + memo threaded through `installPlugin` -> `runInstallLedger` -> `makeInstallCloneProbe`; `classifyGitAuthFailure` maps a 401/403 clone throw to the bare `authentication required` row; `buildInstallLedgerOptions` helper extracted to keep the guard closure under the complexity ceiling.
- `orchestrators/plugin/update.ts` - auth options on `UpdatePluginsOptions` + `ThreePhaseArgs`; `makeUpdateCloneProbe` builds the bundle (only when `ctx` present) and threads it into pin-resolution + re-clone.
- `orchestrators/plugin/reinstall.ts` - auth options on both entrypoints; `makeReinstallCloneProbe` threads the bundle on the cold-cache re-clone; stays gate-clean.
- `orchestrators/plugin/enable-disable.ts` - threads `ctx` into the `runInstallLedger` call (new required ledger field).
- `orchestrators/auth-host.ts` - re-exports `DEFAULT_CREDENTIAL_OPS` (value) + `AuthAttemptResult` / `CredentialOps` / `DeviceFlowHttp` (types) as the gate-clean import point for the network-gated plugin files.
- `tests/orchestrators/plugin/clone-cache.test.ts` - clone auth-threading + `resolvePluginPin` auth-passthrough tests.
- `tests/orchestrators/plugin/install-auth.test.ts` - PROV-02/03/04 + D-79-02 memo (mock-backed, network-free).
- `tests/orchestrators/plugin/update-reinstall-auth.test.ts` - update PROV-03/Q1 + reinstall Q3/PROV-02.

## Decisions Made

- **Amended D-79-03 honored (authoritative user checkpoint from Plan 02):** the plugin install/reinstall no-provider failure renders the BARE `(failed) {authentication required}` row -- NO `no auth provider is registered for <host>` cause line, NO renderer change. This intentionally overrides the plan's own must_haves truth ("... + the single `no auth provider is registered for <host>` cause line") because the parallel_execution contract note and the amended 79-CONTEXT D-79-03 supersede it. Task 2 Test 4 asserts the absence of the cause line.
- **Gate-forced re-export (Rule 3 blocking):** the no-orchestrator-network gate greps `from ...platform/git...` and matches BOTH `platform/git.ts` and `platform/git-credential.ts`, even for `import type`. The plan's literal instruction ("install.ts imports ... DEFAULT_CREDENTIAL_OPS + CredentialOps (platform/git-credential)") would trip the gate, so those symbols are re-exported through the gate-exempt `auth-host.ts`.
- **ctx on the ledger options:** added a required `ctx` to `InstallLedgerOptions` (threaded from both callers) purely to wire the clone probe's auth notify seam; the ledger's no-notify contract is otherwise unchanged.

## Deviations from Plan

### Contract-scoped (amended D-79-03)

**1. [Rule 4 -> prior user decision] No no-provider cause line on the plugin install/reinstall path**
- **Where:** Task 2 (PROV-04 classification + Test 4).
- **Plan text vs contract:** the plan action/must_have called for attaching `NO_PROVIDER_CAUSE(host)` so a cause line renders below `authentication required` on install. The amended D-79-03 (user checkpoint, Plan 02 Option C) scopes the cause line to the update path's synthetic child row only; plugin install/reinstall show the bare row.
- **Resolution:** classify the 401/403 clone throw as the bare `authentication required` reason with no cause; Test 4 asserts the cause line is absent. No renderer/REASONS changes.

### Auto-fixed Issues

**2. [Rule 3 - Blocking] Plan's platform/git-credential import path trips the no-orchestrator-network gate**
- **Found during:** Task 2 (install.ts imports).
- **Issue:** the gate regex matches any `platform/git*` import (type-only included), so importing `DEFAULT_CREDENTIAL_OPS` / `CredentialOps` / `AuthAttemptResult` from `platform/git-credential.ts` / `platform/git.ts` into `install.ts` / `reinstall.ts` would fail the gate.
- **Fix:** re-export those symbols from the gate-exempt `orchestrators/auth-host.ts`; the plugin files import them from there.
- **Files:** auth-host.ts, install.ts, reinstall.ts, update.ts.
- **Commit:** `4b04dc24`, `6add06b2`.

**3. [Rule 3 - Blocking] sonarjs cognitive-complexity after the install auth additions**
- **Found during:** Task 2 (lint).
- **Issue:** the three new conditional-spread option fields pushed `installPlugin`'s guard closure and `composeInstallFailureMessage` over the complexity-15 ceiling.
- **Fix:** extracted `buildInstallLedgerOptions` (moves the option-assembly ladder out of the closure) and folded the auth branch into the terminal runtime-error branch of `composeInstallFailureMessage`; behavior-neutral, verified by the install suites.
- **Files:** install.ts.
- **Commit:** `4b04dc24`.

**4. [Rule 3 - Blocking] Missing ctx on the update/reinstall probe auth inputs**
- **Found during:** Task 3.
- **Issue:** `buildAuthForHost` needs `ctx`; `ThreePhaseArgs.ctx` is optional (cascade mode). Threading it unconditionally would break the cascade.
- **Fix:** the update probe builds the bundle only when `ctx` is defined; cascade mode threads no bundle (no user UI to prompt).
- **Files:** update.ts.
- **Commit:** `6add06b2`.

---

**Total deviations:** 1 contract-scoped (prior user decision, amended D-79-03), 3 auto-fixed blocking. No scope creep beyond the plan-scoped files.

## Issues Encountered

- The `trufflehog` pre-commit hook cannot read the worktree git index (`.git/index: not a directory`) -- the known worktree-sandbox limitation documented in CLAUDE.md. All commits used `SKIP=trufflehog`; no other hooks skipped. The standalone scan errors on the same index-read limitation (not a real secret finding).
- `node_modules` was absent in the worktree; symlinked from the repo root for tooling (Node 22.22.2 strips TS natively, no tsx needed) and removed before returning so the worktree stays clean for the orchestrator merge.

## Requirements Status

- **PROV-02:** complete (public / no-provider hosts clone/re-clone authless on install/update/reinstall; no bundle without a registered provider).
- **PROV-03:** complete (plugin clone-cache side now authenticates host-keyed on install/update/reinstall; combined with Plan 02's marketplace side, PROV-03 is fully delivered).
- **PROV-04:** complete (no-provider plugin install/reinstall fails clean with the bare `authentication required` row per amended D-79-03).

## Known Stubs

None.

## User Setup Required

None.

## Self-Check: PASSED

---
*Phase: 79-provider-auth-registry*
*Completed: 2026-07-11*
