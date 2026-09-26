---
phase: 01-private-repos-on-any-git-host
plan: 01
subsystem: auth
tags: [git, credential-helper, isomorphic-git, device-flow, typescript]

requires:
  - phase: (none)
    provides: buildAuthForHost, buildAuthCallbacks and credentialOps.fill already existed; this plan only made the fill path reachable
provides:
  - buildAuthForHost returns a GitAuthBundle for every https host, so credentialOps.fill(host) is reached on hosts the provider registry does not claim
  - NO_STORED_CREDENTIAL_CAUSE(host), the cause line naming the host and `git credential approve`
  - hasDeviceFlowProvider(host), the registry probe update.ts uses to keep the cause line off github.com/gitlab.com
  - the update.ts cause attachment re-aimed at classifyGitTransportFailure, which covers UserCanceledError as well as HttpError 401/403
affects: [01-02 onAuth host-mismatch cancel, 01-03 plugin and edge surface realignment]

actuals:
  tokens: 12474
  tasks: 3
  commits: 4
  plan_head_before: f4f98c66b0e5489f90a329272fe1fdd20fb73178

tech-stack:
  added: []
  patterns:
    - "The provider registry gates the interactive auth closure only, never whether auth is attempted."
    - "A failure-cause constant is imported by the test that negative-asserts it, so the assertion cannot outlive the string."

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/orchestrators/auth-host.ts
    - extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts
    - extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/fetch.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/info.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/install-clone-probe.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/reinstall-clone-probe.ts
    - tests/orchestrators/auth-host.test.ts
    - tests/orchestrators/marketplace/update.test.ts
    - tests/orchestrators/marketplace/add.test.ts

key-decisions:
  - "Cause-line wording: `no credential stored for ${host}; add one with git credential approve` — host interpolated, command named literally, one line, no credential field (AUTH-09)."
  - "No residual case for NO_PROVIDER_CAUSE was found; it was retired outright (D-1-04)."
  - "The update.ts guard reuses classifyGitTransportFailure rather than a second duck-type, because it already folds HttpError 401/403 and UserCanceledError into one reason."
  - "The always-true `...(auth !== undefined && { auth })` spreads on four plugin clone paths had to be dropped: eslint no-unnecessary-condition and sonarjs/different-types-comparison fail on them once buildCloneAuth is non-nullable. The plan predicted the coverage gate tolerated them, which is true, but not the lint gate."

patterns-established:
  - "Registry-gates-the-closure: absence of a provider is itself a state (stored-credential-only), not a reason to skip the seam."
  - "Cause attached as the chain TAIL so transportReason's one-level unwrap still classifies the code-bearing transport error at cause-depth 1."

requirements-completed: [GAUTH-03, GAUTH-04, GAUTH-05]

coverage:
  - id: D1
    description: "buildAuthForHost returns a bundle for every host, so a credential already in the user's git credential helper authenticates a clone on a host the provider registry does not claim"
    requirement: GAUTH-03
    verification:
      - kind: unit
        ref: "tests/orchestrators/auth-host.test.ts#forwards an unregistered host's stored credential through the real auth callbacks"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/marketplace/update.test.ts#MURL-03 + D-14: url source refreshes via fetch+forceUpdateRef+checkout carrying its host-keyed auth bundle"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/marketplace/add.test.ts#MURL-01: url source clones source.url `.git`-suffixed with a bundle bound to its host"
        status: pass
    human_judgment: false
  - id: D2
    description: "A credential miss on a host with no Device Flow surfaces as an error whose cause chain names `git credential approve`, on the update path, driven by the failure identity that actually occurs"
    requirement: GAUTH-04
    verification:
      - kind: unit
        ref: "tests/orchestrators/marketplace/update.test.ts#GAUTH-04: a cancelled credential lookup on a host with no Device Flow renders {authentication required} plus the stored-credential cause line"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/marketplace/update.test.ts#GAUTH-04: a 401 challenge on a host with no Device Flow carries the same stored-credential cause line"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/auth-host.test.ts#cancels on an unregistered host whose helper is empty and logs the stored-credential cause"
        status: pass
    human_judgment: false
  - id: D3
    description: "github.com and gitlab.com run the identical Device Flow closure, memoization and prompt, and gain no stored-credential cause line on a declined flow"
    requirement: GAUTH-05
    verification:
      - kind: unit
        ref: "tests/orchestrators/marketplace/update.test.ts#GAUTH-05: a cancelled Device Flow on a github.com url refresh renders {authentication required} with NO stored-credential cause line"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/auth-host.test.ts#reruns an injected GitHub Device Flow when the memo is omitted"
        status: pass
      - kind: unit
        ref: "tests/domain/auth-registry.test.ts"
        status: pass
    human_judgment: false
  - id: D4
    description: "A private marketplace or plugin source on an arbitrary git host is actually cloneable end to end against a real remote using a credential in the operator's own helper"
    verification: []
    human_judgment: true
    rationale: "Every case in this plan drives injected fakes. No case reaches a real `git credential` subprocess or a real remote, by design (tests run offline with no credentials). Proving the feature against the operator's real helper and a real private repo needs a human with a credential."

duration: 36min
completed: 2026-09-26
status: complete
---

# Phase 01 Plan 01: Private repos on any git host — wave 1 Summary

**`buildAuthForHost` now returns a host-keyed bundle for every https host, so the already-written `credentialOps.fill(host)` lookup is finally reached off the two-host registry, and a credential miss carries a cause line naming `git credential approve` instead of a bare structural 401.**

## Performance

- **Duration:** 36 min
- **Started:** 2026-09-26T02:49:27Z
- **Completed:** 2026-09-26T03:25:29Z
- **Tasks:** 3
- **Files modified:** 10

## Accomplishments

- `buildAuthForHost` and `buildCloneAuth` are typed `GitAuthBundle`, never `| undefined`. `platform/git.ts` gates auth callbacks on `opts.auth !== undefined`, so this is what makes the fill path reachable on an unregistered host (GAUTH-03, D-1-01).
- A host the registry does not claim gets a pure `onAuthRequired` resolving `{ ok: false, reason: NO_STORED_CREDENTIAL_CAUSE(host), authAttempted: true }`, built **before** `makeRawNotifyFn(ctx)` and before the Device Flow closure. `auth-host.ts` stays a state producer and raises no notification (D-1-02).
- The `update.ts` cause attachment was rebuilt, not re-constanted. Both halves of the old guard were dead: `auth` is never `undefined` now, and an empty helper surfaces as `UserCanceledError`, not `HttpError` 401/403. The new guard is `err instanceof Error && err.cause === undefined && classifyGitTransportFailure(err) === "authentication required" && !hasDeviceFlowProvider(host)`.
- `NO_PROVIDER_CAUSE` and `update.ts::isAuthChallengeError` no longer exist anywhere in `extensions/` or `tests/`.
- `domain/auth-registry.ts` is untouched, no `kind` discriminant was introduced, and no hostname literal was added.

## Task Commits

1. **Task 1 (tracer, tdd): A stored credential reaches an unregistered host, end to end** — `96d8fe09` (feat)
2. **Task 2 (tdd): The cause line arrives on the failure that actually happens** — `4b497e52` (fix)
3. **Task 3: The add surface stops describing, and stops asserting, a contract it no longer has** — `3cad2db1` (refactor)
4. **Deviation (Rule 3): always-true auth spreads on the plugin clone paths** — `3edfce6e` (fix)

## Files Created/Modified

- `extensions/pi-claude-marketplace/orchestrators/auth-host.ts` — always returns a bundle; adds `NO_STORED_CREDENTIAL_CAUSE` and `hasDeviceFlowProvider`; retires `NO_PROVIDER_CAUSE`; three docstrings rewritten
- `extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts` — deletes `isAuthChallengeError`, rewrites the `refreshUrlClone` catch guard and docstring
- `extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts` — `addGitClonedInGuard` takes `auth: GitAuthBundle`; two docstrings rewritten
- `extensions/pi-claude-marketplace/orchestrators/plugin/{fetch,info,install-clone-probe,reinstall-clone-probe}.ts` — the conditional `auth` spread became a plain pass (deviation, below)
- `tests/orchestrators/auth-host.test.ts` — new constant and `hasDeviceFlowProvider` describes; the two absence cases became bundle/credential-forwarding cases; nine redundant `assert.ok(auth !== undefined)` narrowing lines dropped
- `tests/orchestrators/marketplace/update.test.ts` — five absent-`auth`-key assertions inverted to positive bundle assertions; cause-line case re-aimed at `UserCanceledError`; new sibling cases for `HttpError` 401, for `github.com` (no cause line), and for an error that already carries a cause; `seedUrlMarketplace` gained an optional `host`
- `tests/orchestrators/marketplace/add.test.ts` — two MURL-01 cases assert a host-bound bundle; the PROV-02 case keeps its real guarantees and renames; the negative assertion imports the live constant

## Decisions Made

**Cause-line wording (D-1-01 § Claude's discretion):**

```
no credential stored for ${host}; add one with git credential approve
```

One line, no backticks, the host interpolated once, `git credential approve` named literally, no credential field (AUTH-09, enforced by `tests/architecture/no-credential-leak.test.ts` PROV-05 which scans `auth-host.ts`).

**Residual case for `NO_PROVIDER_CAUSE`: none was found.** D-1-04 asked for this to be stated explicitly. The sentence "no auth provider is registered for {host}" is false everywhere after D-1-01, because authentication is attempted on every host through the credential helper. The constant, its test, and its one call site are gone; `grep -rn "NO_PROVIDER_CAUSE" extensions/ tests/` prints nothing.

**Test-shape decisions:**

- The five inverted `fetch`/`clone` call assertions inject a `createCredentialOps()` fake so the bundle can be compared **by value** (`{ credentialOps, host, onAuthRequired: <the recorded one> }`), rather than probing one property. Previously those cases used the production `DEFAULT_CREDENTIAL_OPS` default, which has no comparable identity.
- The GAUTH-05 no-cause-line case seeds a **url** source at `https://GitHub.com/...`. The `github.com` prefix check in `domain/source.ts` is case-sensitive, so it stays a `url` source, while `new URL(...).host` lowercases to `github.com`. That routes a registry host through `refreshUrlClone`, which is the only place the new guard lives — a `github` source would exercise a different function and prove nothing about `hasDeviceFlowProvider`.
- Every `onAuth(url)` call added to the test tree uses a URL whose host equals the bundle's bound host, so plan 02's mismatch cancel cannot turn a passing case red (T-01-01).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking] Always-true `auth` spreads fail the lint gate on four plugin clone paths**

- **Found during:** Task 3 (`npm run lint`, the task's second `<verify>`)
- **Issue:** The plan's §measured_facts #3 established that `...(auth !== undefined && { auth })` stays 100% branch-covered under V8 block coverage and concluded "Leave them". That is correct for the coverage gate and wrong for the lint gate: once `buildCloneAuth` returns a non-nullable `GitAuthBundle`, `@typescript-eslint/no-unnecessary-condition` and `sonarjs/different-types-comparison` both fire. 14 errors across `plugin/fetch.ts` (2 sites), `plugin/info.ts` (2), `plugin/install-clone-probe.ts` (2) and `plugin/reinstall-clone-probe.ts` (1). `npm run lint` is a named verification for this plan, so this was blocking.
- **Fix:** Replaced the seven conditional spreads with a plain `auth,` / `auth: authBundle,`. No behavior change — the spread was always taken. `plugin/clone-cache.ts` and `plugin/update-preflight.ts` keep theirs: `update-preflight.ts::buildBundle` still returns `undefined` when it has no `ctx`, exactly as the plan noted.
- **Files modified:** `extensions/pi-claude-marketplace/orchestrators/plugin/{fetch,info,install-clone-probe,reinstall-clone-probe}.ts`
- **Verification:** `npm run lint` exit 0; `npx tsc --noEmit` exit 0; the failing-test tally is unchanged at 20 in the predicted seven files, so plan 03's scope is unaffected.
- **Committed in:** `3edfce6e` (separate from the Task 3 commit — different files, different cause)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Mechanical, no behavior change, no scope creep. It closes a gap between the plan's measured facts (coverage-gate only) and the plan's own verification list (which names `npm run lint`).

## Issues Encountered

**RED evidence for the two `tdd="true"` tasks was compile-level, not assertion-level.** Task 1's first run failed with `SyntaxError: ... does not provide an export named 'NO_STORED_CREDENTIAL_CAUSE'` — a module-resolution failure, which the canonical TDD reference classifies as INVALID_RED. Naming a constant that does not exist yet cannot produce an assertion-level red without first landing a stub, and the plan carries `type: execute` (not `type: tdd`), so no plan-level RED gate applied. Recorded here rather than silently claimed as a clean RED.

**Verification sequencing.** Task 2's `<verify>` named `npm run test:coverage:unit` grepped for two rows. I proved both rows with `npm run test:coverage:direct` (the focused pair, a stricter 100%-or-fail measurement) at Task 2, then ran the full `test:coverage:unit` once at the end rather than twice across a multi-minute suite. Both routes report the same thing for those rows.

**`pre-commit run --files` was not invoked.** No pre-commit hook is installed in this repo, so committing runs nothing, and the plan's verification list does not name pre-commit. `lint`, `format:check`, `lint:type-members`, `test:corresponding`, `tsc` and `fallow` were all run directly instead.

## Gate results (real exit codes)

| Gate | Command | Exit |
|---|---|---|
| Task 1 focused tests | `node --test tests/orchestrators/auth-host.test.ts tests/platform/git-auth-callbacks.test.ts tests/domain/auth-registry.test.ts tests/architecture/no-credential-leak.test.ts` | 0 (58 pass, 0 fail) |
| Task 2 focused tests | `node --test tests/orchestrators/marketplace/update.test.ts` | 0 (63 pass, 0 fail) |
| Task 3 focused tests | `node --test tests/orchestrators/marketplace/{add,update}.test.ts tests/orchestrators/auth-host.test.ts` | 0 (149 pass, 0 fail) |
| Typecheck | `npx tsc --noEmit` | 0 |
| Lint | `npm run lint` | 0 (after the deviation fix; 1 before it) |
| Format | `npm run format:check` | 0 |
| Type members | `npm run lint:type-members` | 0 (4 pre-existing recorded exceptions) |
| Corresponding tests | `npm run test:corresponding` | 0 |
| Direct coverage, `auth-host.ts` | `npm run test:coverage:direct -- …/auth-host.ts` | 0 (branches 20/20, functions 7/7, lines 211/211) |
| Direct coverage, `marketplace/update.ts` | `npm run test:coverage:direct -- …/marketplace/update.ts` | 0 (branches 122/122, functions 16/16, lines 900/900) |
| Direct coverage, `marketplace/add.ts` | `npm run test:coverage:direct -- …/marketplace/add.ts` | 0 (branches 130/130, functions 14/14, lines 924/924) |
| Unit suite + coverage | `npm run test:coverage:unit` | 1 — **by design**, 7253 tests / 7233 pass / 20 fail. No `does not meet threshold` line was printed; `auth-host.ts`, `marketplace/update.ts` and `marketplace/add.ts` all show `100.00 \| 100.00 \| 100.00` with an empty uncovered-lines cell. |
| fallow | `npm run fallow` | 0 (prints `✗ 1,327 lines (1.4%) duplicated` — a pre-existing report line, not a failure; exit code captured on its own line) |

## Tests still failing — the measured list for plan 03

20 failures, matching the plan's predicted distribution exactly (31 measured, minus the 11 this plan owned: 6 update + 3 add + 2 auth-host).

| File | Failures |
|---|---|
| `tests/edge/handlers/marketplace/update.test.ts` | 6 |
| `tests/edge/handlers/marketplace/add.test.ts` | 6 |
| `tests/orchestrators/plugin/fetch.test.ts` | 4 |
| `tests/orchestrators/plugin/reinstall-flow.test.ts` | 1 |
| `tests/orchestrators/plugin/reinstall-clone-probe.test.ts` | 1 |
| `tests/orchestrators/plugin/install-flow.test.ts` | 1 |
| `tests/orchestrators/plugin/install-clone-probe.test.ts` | 1 |

Named cases still red (all the same shape — a `deepStrictEqual` on a recorded clone/fetch call that now carries an `auth` bundle, or a case asserting an authless clone):

- `tests/edge/handlers/marketplace/add.test.ts`: clones through the injected port into the user scope…; clones into the user scope when `--scope user` selects it; clones into the project scope when `--scope project` selects it; records the marketplace in the per-machine config when the scope-target flag is supplied after the source; …before the source; carries a scope flag and the scope-target flag through together
- `tests/edge/handlers/marketplace/update.test.ts`: updates every recorded marketplace in both scopes when no name is supplied; updates the named marketplace alone…; updates the user scope alone when `--scope user` narrows the command; updates the project scope alone when `--scope project` narrows the command; `update alpha --scope project` runs the real merged-config cascade…; `update --scope project` runs the real merged-config cascade…
- `tests/orchestrators/plugin/fetch.test.ts`: materializes a cold pinned URL clone at its recorded SHA; refreshes an unpinned warm mirror with its ref and leaves state immutable; continues a manifest-ordered sweep after a network failure; derives partially available and unavailable git rows exactly
- `tests/orchestrators/plugin/install-clone-probe.test.ts`: returns a missing-subdir result without exposing the resolved sha
- `tests/orchestrators/plugin/install-flow.test.ts`: plugin install authentication: leaves a providerless clone authless
- `tests/orchestrators/plugin/reinstall-clone-probe.test.ts`: falls back from an absent unpinned mirror to the recorded sha
- `tests/orchestrators/plugin/reinstall-flow.test.ts`: plugin reinstall authentication: a non-provider host threads no auth bundle

`tests/domain/auth-registry.test.ts` and `tests/orchestrators/plugin/info.test.ts` do not fail, as predicted.

## Known Stubs

None. No placeholder value, empty-literal data source, or TODO/FIXME marker was introduced.

## User Setup Required

None — no external service configuration required. The feature reads the operator's existing `git credential` helper; nothing is installed or configured by this plan.

## Next Phase Readiness

- **Plan 02** (`onAuth` host-mismatch cancel) is unblocked and is the mitigation for T-01-01: removing the two-host cap widens the blast radius of a bundle whose bound `host` disagrees with the URL being cloned, and the direct compare replaces the cap. Every `onAuth(url)` call added here already passes a host-matching URL, so plan 02 will not turn a green case red.
- **Plan 03** (plugin + edge realignment) starts from the measured 20-failure list above rather than a re-run.
- The tree is intentionally RED at the whole-suite level until plan 03 lands. Every other gate is green.

## Self-Check: PASSED

All seven modified/created files exist on disk; all four commit hashes (`96d8fe09`, `4b497e52`, `3cad2db1`, `3edfce6e`) resolve in `git log`.

---
*Phase: 01-private-repos-on-any-git-host*
*Completed: 2026-09-26*
