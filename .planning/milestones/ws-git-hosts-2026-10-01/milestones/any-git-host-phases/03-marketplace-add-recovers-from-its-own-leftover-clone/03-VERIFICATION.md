---
phase: 03-marketplace-add-recovers-from-its-own-leftover-clone
verified: 2026-09-30T00:00:00Z
status: passed
score: 7/7 must-haves verified
covered_files:
  - ".planning/workstreams/git-hosts/phases/03-marketplace-add-recovers-from-its-own-leftover-clone/03-01-PLAN.md"
  - ".planning/workstreams/git-hosts/phases/03-marketplace-add-recovers-from-its-own-leftover-clone/03-01-SUMMARY.md"
  - ".planning/workstreams/git-hosts/phases/03-marketplace-add-recovers-from-its-own-leftover-clone/03-02-PLAN.md"
  - ".planning/workstreams/git-hosts/phases/03-marketplace-add-recovers-from-its-own-leftover-clone/03-02-SUMMARY.md"
  - ".planning/workstreams/git-hosts/phases/03-marketplace-add-recovers-from-its-own-leftover-clone/03-03-PLAN.md"
  - ".planning/workstreams/git-hosts/phases/03-marketplace-add-recovers-from-its-own-leftover-clone/03-03-SUMMARY.md"
  - ".planning/workstreams/git-hosts/phases/03-marketplace-add-recovers-from-its-own-leftover-clone/03-04-PLAN.md"
  - ".planning/workstreams/git-hosts/phases/03-marketplace-add-recovers-from-its-own-leftover-clone/03-04-SUMMARY.md"
  - ".planning/workstreams/git-hosts/quick/260928-tt9-fix-url-raw-identity-mismatch-and-duplic/260928-tt9-PLAN.md"
  - ".planning/workstreams/git-hosts/quick/260928-tt9-fix-url-raw-identity-mismatch-and-duplic/260928-tt9-SUMMARY.md"
  - "extensions/pi-claude-marketplace/domain/source.ts"
  - "extensions/pi-claude-marketplace/orchestrators/auth-host.ts"
  - "extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts"
  - "extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts"
  - "extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts"
  - "extensions/pi-claude-marketplace/orchestrators/plugin/clone-cache.ts"
  - "extensions/pi-claude-marketplace/orchestrators/plugin/update-preflight.ts"
  - "extensions/pi-claude-marketplace/platform/git-auth-callbacks.ts"
  - "extensions/pi-claude-marketplace/platform/git.ts"
  - "extensions/pi-claude-marketplace/shared/errors.ts"
  - "scripts/check-unused-type-members.contracts.json"
  - "tests/domain/source.test.ts"
  - "tests/e2e/import-command.test.ts"
  - "tests/edge/types.test.ts"
  - "tests/orchestrators/auth-host.test.ts"
  - "tests/orchestrators/marketplace/add.test.ts"
  - "tests/orchestrators/marketplace/shared.test.ts"
  - "tests/orchestrators/marketplace/update.test.ts"
  - "tests/orchestrators/plugin/clone-cache.test.ts"
  - "tests/orchestrators/plugin/update-preflight.test.ts"
  - "tests/platform/git-auth-callbacks.test.ts"
  - "tests/platform/git-ops-contract.ts"
  - "tests/platform/git-ops-fake.test.ts"
  - "tests/platform/git-ops-fake.ts"
  - "tests/platform/git.test.ts"
  - "tests/shared/errors.test.ts"
covered_digest: "v2:sha256:be3645e6127134aa30ad1b67bfe1b45850df3efc40fe1405f184546ebff1fc08"
behavior_unverified: 0
overrides_applied: 0
re_verification:
  previous_status: "passed"
  previous_score: "7/7"
  gaps_closed: []
  gaps_remaining: []
  regressions: []
advisory:
  - finding: "ROADMAP.md Phase 3 SC2 (line ~166) still says an unreadable leftover refuses with the MA-6 `{stale clone}` row. Since c1286475 the code renders `{permission denied}` (EACCES/EPERM) or `{unreadable}` for a leftover whose `.git/config` cannot be read, and REQUIREMENTS.md MA-13 was amended to say so. The refusal, the subject, and the no-overwrite guarantee that SC2 protects all hold; only the row token differs from the roadmap text."
    category: other
    reason: "Documentation drift between the roadmap contract and the amended requirement. Resolve by amending SC2's wording to match MA-13, or by confirming the token change as a recorded decision."
    evidence_status: "code, requirement, and passing named tests agree with each other; only ROADMAP SC2 prose lags"
---

# Phase 3: `marketplace add` recovers from its own leftover clone Verification Report

**Phase Goal:** A Pi user retrying `marketplace add` after a crash or a state rebuild succeeds when
the directory left behind is a clone of the very source being added, still gets the MA-6 refusal
when it is anything else, and is never left with a half-removed tree recorded in state — with the
milestone's whole gate surface green at its final HEAD.

**Verified:** 2026-09-30
**Status:** passed
**Re-verification:** Yes — the prior `passed` (7/7) report (`c9c42c1d`, 2026-09-28) went stale under
commits `505dc912`, `23cc2218`, `ae8ce217`, `62ec0fa6`, `c1286475`, which touch covered files. Main was
merged back in afterwards (`a0d3aef1` squash of PR #221, `f42e5dd6` merge); the branch tree equals
`a0d3aef1`. Every must-have was re-checked against the CURRENT code.

## Scope of what changed since the prior verification (`0aeb92d2`..HEAD)

`git diff --stat 0aeb92d2..HEAD -- extensions tests scripts`: 29 files, +911/-669. Read directly, the
changes that bear on this phase are:

- **`platform/git.ts::listRemotes` — a fifth arm.** `ListRemotesResult` gains
  `{ kind: "permission-denied" }`. The pre-read of `<dir>/.git/config` maps ENOENT/ENOTDIR to
  `not-a-repo`, EACCES/EPERM to `permission-denied`, and every other error to `unreadable`. The
  `getConfigAll` single-value read (WR-11) is unchanged.
- **`add.ts::recognizeLeftover`.** `no-origin` and `not-a-repo` still throw `StaleSourceCloneError`;
  `permission-denied` and `unreadable` now throw the new `UnreadableSourceCloneError`
  (`shared/errors.ts`, carries `mpName` and `failure`). `unwrapAddError`, `classifyAddError` and
  `addSubjectName` all handle it, so the row renders on the marketplace SUBJECT as
  `{permission denied}` or `{unreadable}`, including through the one-level `Error.cause` wrapper that
  the MA-9 leak append produces. `permission denied` and `unreadable` are both already members of the
  closed `ContentReason` set (`notification-types.ts:29,43`).
- **Auth bundle `kind` discriminant** (`git-auth-callbacks.ts`, `auth-host.ts`, `marketplace/shared.ts`).
  `BuildAuthCallbacksOpts` is now a union of `device-flow` and `stored-credential`; `evictOnFailure` and
  `hasDeviceFlowProvider` are gone; `buildAuthForHost` and `buildCloneAuth` require a `ctx`;
  `buildStoredCredentialAuth(host, credentialOps)` is exported.
- **`update-preflight.ts::makeUpdateCloneProbe`.** A local `cloneAuth` picks
  `buildStoredCredentialAuth(hostFromCloneUrl(...), credentialOps)` when `auth.ctx === undefined`, else
  `buildCloneAuth(...)`. Both `probeUnpinned` and `probePinned` use it.
- **`domain/source.ts` (github host fold), `state-io.ts` (stored `url` record loads as `github`),
  `clone-cache.ts` (auth now required, `cloneIntoStaging` helper), `marketplace/update.ts` (cause line
  keyed on `auth.kind === "stored-credential"`).** Each was read; none alters `recognizeLeftover`'s
  comparison `stripGitSuffix(remotes.url) !== canonicalCloneUrl(source)` for an input that reaches it
  (`stripGitSuffix` is untouched). The github-host fold means a capitalized-host github url now parses
  as `github`, giving one canonical identity per repo, which strengthens SC1's same-source recognition.

## Goal Achievement

### Observable Truths (ROADMAP Phase 3 Success Criteria)

| # | Truth (SC) | Status | Evidence |
|---|------------|--------|----------|
| 1 | SC1 — `marketplace add` succeeds when `sources/<name>/` holds a leftover clone whose `origin` is the source being added | ✓ VERIFIED | `recognizeLeftover` `origin` arm: compares the identity, then `cleanupStaging(removalOps, finalDir, ...)` and returns to the rename. Run fresh: `✔ MA-12: a leftover clone whose origin names the same source recovers`. |
| 2 | SC2 — a leftover that is not a git clone, is unreadable, or whose `origin` names a different URL still refuses on the marketplace subject; recognition never widens into overwriting a directory the extension did not create | ✓ VERIFIED (against amended MA-13; see Advisory) | Every non-recognized outcome throws before `rename`. Not-a-clone, no-origin (including two-url, WR-11) and foreign-origin throw `StaleSourceCloneError` → `{stale clone}`. An unreadable `.git/config` throws `UnreadableSourceCloneError` → `{permission denied}` (EACCES/EPERM) or `{unreadable}` (other), exactly as MA-13 now reads. Run fresh: 7 origin-shape refusals, `permission-denied` and `unreadable` add-level refusals, ATTR-07 url-less, WR-11 two-url, RECON-03 orchestrated; platform-tier `reports permission-denied ... EACCES`, `... EPERM`, and `reports unreadable for a .git/config that cannot be read as a file` (no `chmod` anywhere in `tests/platform/git.test.ts`, so it also passes as root). |
| 3 | SC3 — a recognized leftover that cannot be fully removed fails as stale with the cleanup leak appended, and state records no destination | ✓ VERIFIED | `addGitClonedInGuard`: a non-undefined `leftoverLeak` throws `StaleSourceCloneError` before `rename` and before `state.marketplaces[...]` is assigned; the MA-9 catch folds leaks through `joinLeaks` into one `appendLeakToError`. Run fresh: `MA-14: an unremovable recognized leftover fails as stale, with the leak appended and no recorded destination` and `MA-14 double fault ... through one Error.cause level`. |
| 4 | SC4 — every introduced type member is read or pinned, and `npm run check` passes whole at the final HEAD | ✓ VERIFIED | `gh pr checks 221`: all checks pass, including `npm run check (Node 24)` (13m13s), `direct coverage (Node 24)`, `integration tests`, `pinned e2e tests`, `fallow-audit`, `pre-commit`, `SonarCloud`. PR #221 was squash-merged as `a0d3aef1`, and the branch tree equals it. Run fresh here: `npm run lint:type-members` → "passed with 4 recorded exception(s)" (unchanged set). The whole suite was NOT re-run, per instruction. |
| 5 | SC5 — the autoupdate cascade authenticates rather than cloning authless, on any host | ✓ VERIFIED | The cascade's `PluginUpdateFn` (`update-flow.ts::updateSinglePluginWith`) passes no `ctx`; `update-preflight.ts:576` forwards `ctx` only when defined; `cloneAuth` then returns `buildStoredCredentialAuth(...)`, a `kind: "stored-credential"` bundle that consults the helper via `fill` first. Decided by D-3-04 (fixed, not filed). Run fresh: `D-3-04: gives the autoupdate cascade a github.com stored-credential bundle when it has no notification context` asserts the whole bundle with `assert.deepStrictEqual` on both the pinned and unpinned arms. |
| 6 | SC6 — Phase 1/2 live canaries carried with reasons/resume commands, not marked passed on link-by-link evidence | ✓ VERIFIED (carried) | No change to ROADMAP.md or the BACKLOG carrier since the prior round (`git diff 0aeb92d2..HEAD` on ROADMAP.md empty). |
| 7 | SC7 — `PROJECT.md` D-79-03 rationale amended to match the code; OUTCOME untouched | ✓ VERIFIED (carried) | `git diff 0aeb92d2..HEAD -- .planning/PROJECT.md` empty; the D-79-03 row (line 683) still states the OUTCOME unchanged. |

**Score:** 7/7 truths verified (0 present-but-behavior-unverified)

### Advisory (New Scope, Unevidenced)

| # | Finding | Category | Why Advisory |
|---|---------|----------|--------------|
| 1 | ROADMAP.md Phase 3 SC2 prose (line ~166) still lists "is unreadable" among the cases that refuse with `{stale clone}`; the code and the amended REQUIREMENTS.md MA-13 render `{permission denied}` / `{unreadable}` for that case | other | Doc drift only. The row still refuses on the marketplace subject and never overwrites, so SC2's guarantee holds. Amend the roadmap sentence to match MA-13 (or record the token change as a decision ID); this verifier may not edit ROADMAP.md. |

Known review debt (`03-REVIEW-DISPOSITION.md` open items) is carried by BACKLOG entry `GHADD-01` and
does not falsify any must-have above.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `platform/git.ts::listRemotes` | 5-arm discriminated result; own fs probe before isomorphic-git; never throws | ✓ VERIFIED | `origin`, `no-origin`, `not-a-repo`, `permission-denied`, `unreadable`; errno mapping read directly. |
| `shared/errors.ts::UnreadableSourceCloneError` | typed error carrying `mpName` and `failure` | ✓ VERIFIED | Wired in `add.ts` (throw site, `unwrapAddError`, `classifyAddError`, `addSubjectName`); `tests/shared/errors.test.ts` covers it. |
| `orchestrators/marketplace/add.ts::recognizeLeftover` | recognize-remove-rename branch, single-level leak fold | ✓ VERIFIED | Read in full. |
| `orchestrators/auth-host.ts::buildStoredCredentialAuth` | explicit stored-credential builder for the cascade | ✓ VERIFIED | Exported; consumed by `buildAuthForHost` and `update-preflight.ts`. |
| `orchestrators/plugin/update-preflight.ts::cloneAuth` | cascade (no `ctx`) gets a stored-credential bundle | ✓ VERIFIED | Both pinned and unpinned arms use it. |
| `platform/git-auth-callbacks.ts::BuildAuthCallbacksOpts` | `kind` discriminant; helper-miss cancels for `stored-credential` | ✓ VERIFIED | `onAuth` returns `{ cancel: true }` on a helper miss; `onAuthFailure` skips eviction for `stored-credential`. |
| `scripts/check-unused-type-members.contracts.json` | pins current | ✓ VERIFIED | `lint:type-members` passes with the same 4 recorded exceptions. |
| Test files (`add`, `git`, `auth-host`, `update-preflight`, `errors`, `git-auth-callbacks`, `source`, `update`, `shared`, `git-ops-fake`) | paired coverage of the above | ✓ VERIFIED | 520/520 pass in one targeted run. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `.git/config` read errno | `listRemotes` arm | own `fs.promises.readFile` pre-read | ✓ WIRED | ENOENT/ENOTDIR, EACCES/EPERM, other. |
| `listRemotes` arm | row token | `recognizeLeftover` → `Stale/UnreadableSourceCloneError` → `classifyAddError` | ✓ WIRED | `{stale clone}`, `{permission denied}`, `{unreadable}`; subject via `addSubjectName`. |
| `recognizeLeftover` leak | no state record | `leftoverLeak` → throw before `rename` and state mutation | ✓ WIRED | MA-14 tests pass. |
| Cascade `PluginUpdateFn` (no `ctx`) | `buildStoredCredentialAuth` | `updateSinglePluginWith` → `update-preflight` `cloneAuth` | ✓ WIRED | D-3-04 test asserts the bundle. |
| `stored-credential` bundle | `buildAuthCallbacks` | `opts.kind` | ✓ WIRED | Cancel on a helper miss; no eviction on failure. |

### Data-Flow Trace (Level 4)

Not applicable (CLI/backend). The equivalent trace — a real on-disk `.git/config` state reaching the
row token — is covered by the platform-tier real-repository tests and the add-level tests that run the
real `listRemotes` adapter.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Phase surface (git, add, auth-host, update-preflight, shared, update, git-ops-fake, source, git-auth-callbacks) | `node --test` over those 9 files | `tests 520, pass 520, fail 0` | ✓ PASS |
| MA-12/13/14, permission-denied/unreadable, D-3-04 named cases | same run, filtered | all `✔` | ✓ PASS |
| Type-member gate | `npm run lint:type-members` | passed, 4 recorded exceptions | ✓ PASS |
| Whole gate at final HEAD | `gh pr checks 221` (accepted evidence) | all checks pass, squash-merged as `a0d3aef1` | ✓ PASS |

Full `npm run check` and the whole suite were deliberately not run.

### Probe Execution

SKIPPED (no probes declared for this phase).

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| MA-12 | 03-01, 03-02 | same-origin leftover recovers | ✓ SATISFIED | MA-12 test passes; `origin` arm. |
| MA-13 | 03-01, 03-02, 03-04, 260928-tt9 | not-a-clone / foreign / no-origin refuse as `{stale clone}`; unreadable `.git/config` refuses as `{permission denied}` or `{unreadable}` | ✓ SATISFIED | Code and the amended REQUIREMENTS.md wording agree line for line (EACCES/EPERM → `permission denied`, any other read error → `unreadable`). |
| MA-14 | 03-01, 03-02 | unremovable leftover fails as stale with the leak appended; no state entry | ✓ SATISFIED | Both MA-14 tests pass. |
| GATE-01 | 03-03, 03-04 | members read or pinned; whole check green | ✓ SATISFIED | PR #221 checks all pass; `lint:type-members` passes here. |

No orphaned requirements: REQUIREMENTS.md maps exactly MA-12, MA-13, MA-14, GATE-01 to Phase 3, all `[x]`.

### Anti-Patterns Found

None. Debt-marker scan (`TBD|FIXME|XXX|TODO|HACK|PLACEHOLDER`) over the phase's changed extension files
turned up nothing new.

### Human Verification Required

None.

### Gaps Summary

No gaps. All seven success criteria hold against the current code. The one finding is documentation
drift in ROADMAP.md SC2 (see Advisory), which does not falsify the criterion's guarantee.

---

_Verified: 2026-09-30_
_Verifier: Claude (gsd-verifier)_
