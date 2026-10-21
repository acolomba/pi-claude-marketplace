---
phase: 02-github-clone-base-override
verified: 2026-10-21T00:00:00Z
status: passed
score: 5/5 roadmap success criteria verified (45/45 plan truths, 3/3 prohibitions)
covered_files: [".planning/phases/02-github-clone-base-override/02-01-PLAN.md",".planning/phases/02-github-clone-base-override/02-01-SUMMARY.md",".planning/phases/02-github-clone-base-override/02-02-PLAN.md",".planning/phases/02-github-clone-base-override/02-02-SUMMARY.md",".planning/phases/02-github-clone-base-override/02-03-PLAN.md",".planning/phases/02-github-clone-base-override/02-03-SUMMARY.md",".planning/phases/02-github-clone-base-override/02-04-PLAN.md",".planning/phases/02-github-clone-base-override/02-04-SUMMARY.md",".planning/phases/02-github-clone-base-override/02-05-PLAN.md",".planning/phases/02-github-clone-base-override/02-05-SUMMARY.md","CHANGELOG.md","README.es.md","README.md","docs/output-catalog.md","eslint.config.js","extensions/pi-claude-marketplace/domain/auth-registry.ts","extensions/pi-claude-marketplace/domain/clone-key.ts","extensions/pi-claude-marketplace/domain/source.ts","extensions/pi-claude-marketplace/edge/handlers/plugin/bootstrap.ts","extensions/pi-claude-marketplace/edge/handlers/plugin/enable-disable.ts","extensions/pi-claude-marketplace/orchestrators/auth-host.ts","extensions/pi-claude-marketplace/orchestrators/import/execute.ts","extensions/pi-claude-marketplace/orchestrators/marketplace/add.messaging.ts","extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts","extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts","extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts","extensions/pi-claude-marketplace/orchestrators/plugin/clone-cache.ts","extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts","extensions/pi-claude-marketplace/orchestrators/plugin/fetch.ts","extensions/pi-claude-marketplace/orchestrators/plugin/info.ts","extensions/pi-claude-marketplace/orchestrators/plugin/install-clone-probe.ts","extensions/pi-claude-marketplace/orchestrators/plugin/install-flow.ts","extensions/pi-claude-marketplace/orchestrators/plugin/reinstall-clone-probe.ts","extensions/pi-claude-marketplace/orchestrators/plugin/reinstall-flow.ts","extensions/pi-claude-marketplace/orchestrators/plugin/update-flow.ts","extensions/pi-claude-marketplace/orchestrators/plugin/update-preflight.ts","extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts","extensions/pi-claude-marketplace/platform/git.ts","extensions/pi-claude-marketplace/shared/errors.ts","extensions/pi-claude-marketplace/shared/git-failure-classifiers.ts","extensions/pi-claude-marketplace/shared/github-base-url.ts","tests/architecture/catalog-uat/catalog-contract.test.ts","tests/architecture/catalog-uat/catalog-parser.test.ts","tests/architecture/catalog-uat/catalog-wire.test.ts","tests/architecture/catalog-uat/fixtures/marketplace-add.ts","tests/architecture/soft-dep-marker-policy.test.ts","tests/domain/clone-key.test.ts","tests/domain/source.test.ts","tests/edge/handlers/plugin/bootstrap.test.ts","tests/edge/handlers/plugin/enable-disable.test.ts","tests/orchestrators/auth-host.test.ts","tests/orchestrators/import/execute.test.ts","tests/orchestrators/marketplace/add.messaging.test.ts","tests/orchestrators/marketplace/add.test.ts","tests/orchestrators/marketplace/update.test.ts","tests/orchestrators/plugin/clone-cache.test.ts","tests/orchestrators/plugin/enable-disable.test.ts","tests/orchestrators/plugin/fetch.test.ts","tests/orchestrators/plugin/info.test.ts","tests/orchestrators/plugin/install-clone-probe.test.ts","tests/orchestrators/plugin/install-flow.test.ts","tests/orchestrators/plugin/reinstall-clone-probe.test.ts","tests/orchestrators/plugin/reinstall-flow.test.ts","tests/orchestrators/plugin/update-flow.test.ts","tests/orchestrators/plugin/update-preflight.test.ts","tests/platform/git.test.ts","tests/shared/errors.test.ts","tests/shared/git-failure-classifiers.test.ts","tests/shared/github-base-url-environment.ts","tests/shared/github-base-url.test.ts","tests/shared/notification-command-error.test.ts"]
covered_digest: "v3:sha256:4bf4372cd4c67d73b4cd79ee7afcfa448342ef5c2fc2d3358d64bec84ddad8e1"
behavior_unverified: 0
overrides_applied: 0
re_verification:
  previous_status: passed
  previous_score: 5/5
  gaps_closed: []
  gaps_remaining: []
  regressions: []
human_verification: []
---

# Phase 2: GitHub Clone-Base Override Verification Report

**Phase Goal:** With `PI_CLAUDE_MARKETPLACE_GITHUB_BASE_URL` set, every GitHub site (the clone URL, origin matching for leftover clones, marketplace update, and the auth host) uses the configured base through one seam, so the suite can serve GitHub sources locally. Unset, behavior does not change (D-MF-01).
**Verified:** 2026-10-21
**Status:** passed
**Re-verification:** Yes. The previous report (HEAD dda39179, 2026-10-16) went stale because later phases changed covered files. Every truth was re-checked against HEAD 13fcdde9.

**Behavioral evidence:** the full gate passed at HEAD 0110a355 (only planning Markdown changed since): `/tmp/claude-1000/-home-acolomba-src-pi-claude-marketplace-cucumber-behavioral-tests/e37b84b9-da30-433b-a2eb-65b65d26c976/scratchpad/regression-gate.log` shows typecheck, lint, lint:workflows, fallow, format:check, test:corresponding, and check:features passed, 433/433 scenarios and 4050/4050 steps passed, and direct coverage merged. `npm run check` was not re-run here.

## What changed since the last report

- `shared/github-base-url.ts`, `platform/git.ts`, `orchestrators/auth-host.ts`, and `domain/clone-key.ts` are byte-identical to dda39179 (`git diff dda39179 HEAD` is empty for all four, and for the seam test and env helper).
- Phase 10 added `lacksStoredCredential` (`orchestrators/marketplace/shared.ts:399`) and the `<host> rejected the stored credential` cause. It excludes a refused credential (`StoredCredentialRejectedError`) and a cross-origin challenge from the "no stored credential" line. It does not touch the override path. Under the override the bundle is still `stored-credential` bound to the override host, so a rejection names that host.
- `shared/git-failure-classifiers.ts::hostHttpFailureFrame` is a new consumer of the seam: it renders `{status} on {gitHubWireUrl(remoteUrl)}` after a fetch already went out, so the base was already validated. This extends the seam's use to failure text. It adds no literal and no second reader of the variable.
- A large unrelated test/refactor churn (layer renames, local-layer refusals) touched owner tests. The GHB cases still exist and pass.

## Goal Achievement

### Observable Truths (roadmap success criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | With an `https:` base set, `owner/repo` and `https://github.com/o/r[.git][#ref]` clone from `<base>/<owner>/<repo>.git`; leftover-clone recognition, `marketplace update`, and the auth host use the same base; the auth host binds the override's host and port so Device Flow never starts; each affected owner test has an override case | VERIFIED | `gitHubWireUrl` (seam, lines 84-91) rewrites the exact `https://github.com/` prefix onto `base.origin + pathname`. `platform/git.ts` calls it at :414 (`listServerRefsAt`), :446 (`clone`), :488 (`fetch`); `clone` resets `remote.origin.url` to the canonical URL at :465, so identity stays canonical and `originMatchesSource` still matches. `buildGitHubAuth` (auth-host.ts:222) returns `buildStoredCredentialAuth(overrideHost, ...)` with no provider lookup when `gitHubOverrideHost()` is set. `hostFromCloneUrl` (:95-100) binds a github source and a rewritten git-subdir URL to the override host. `buildCloneAuth` (:274) routes any source the base rewrites through `buildGitHubAuth`. `buildGitHubAuth` is called from add.ts, update.ts, and update-flow.ts. Tests pass at HEAD: seam, platform, auth-host, clone-key, source, errors, and failure-classifier suites (565 pass, 0 fail, variable unset, scratch HOME); 16 owner/edge/reconcile suites (1696 pass, 0 fail); `GHB-02: binds base https://[::1]:9/ to host [::1]:9` and the other bind cases. |
| 2 | A source-walk gate in `npm run check` fails on a new hard-coded `github.com` URL outside the seam | VERIFIED | `local/no-github-literal` is defined at eslint.config.js:121, set to `error` for the extension at :566 and `off` for the seam only at :575. Plant (stdin, nothing written) of `"https://github.com/x/y"` and `/github\.com/` into `domain/name.ts`: 2 errors, exit 1. Exactly 7 justified disables exist (3 in `auth-registry.ts`, 4 in `source.ts`). The lint stage passed in the gate log. |
| 3 | A set but invalid value fails the command with a typed error that names the variable | VERIFIED | `readGitHubBase` throws `InvalidGitHubBaseUrlError(GITHUB_BASE_URL_VARIABLE, <problem>)` for not-a-url, scheme, userinfo, fragment, query, in that order; the message carries the variable name and a fixed rule, never the value. `rethrowInvalidGitHubBaseUrl` has 18 call sites across add, update, install, import, enable (orchestrator and edge), bootstrap, reinstall, fetch, info, update-flow, and update-preflight. The seam and errors suites pass, and the `GHB-03` owner cases pass in the 1696-test run. |
| 4 | Unset: every GitHub-source operation is byte-identical; `list`, `info`, and `claude-plugins.json` show github.com terms whether set or not | VERIFIED | `gitHubWireUrl` returns its input when the variable is unset or empty and never reads it for a non-github.com URL. `clone-key.ts:84` builds identity from `GITHUB_ORIGIN`, so recorded identity does not follow the base. The 433 cucumber scenarios and the unit suites pass unset. The phase 10 additions do not read the variable. |
| 5 | README (with localized copies) and CHANGELOG document the variable as a divergence from Claude Code | VERIFIED | `README.md` "GitHub mirror" section (line ~206, includes "Claude Code has no such setting, so this behavior is a difference from Claude Code", line 240); `README.es.md` has the localized section (line ~206); `README.*.md` has only the `es` copy; `CHANGELOG.md:54` bullet names the variable and says Claude Code lacks the setting. |

**Score:** 5/5 roadmap criteria verified (0 present, behavior-unverified).

### Plan must-have truths (02-01 .. 02-05)

All 45 plan truths were re-checked against HEAD. The seam, platform wrappers, auth host, and clone identity are unchanged since the last report, and the named tests still pass.

| Plan | Truth group | Status | Evidence |
|------|-------------|--------|----------|
| 01 | Normalization (trailing slashes, WHATWG host/port/IPv6, exact prefix, empty = unset, per-call read, non-github URL never reads the variable); fetched-cause tail only on a rewritten failure; interrupted-clone backstop | VERIFIED | `tests/shared/github-base-url.test.ts` and `tests/platform/git.test.ts` pass; `setConfig` is awaited inside `clone()`, and production clones go to a staging dir that is promoted only afterward |
| 02 | Override host for add, update, sync, plugin clones/pins/tag probes; no Device Flow under the override; git-subdir on github.com binds the override host; url source and path-only update ignore an invalid variable | VERIFIED | auth-host.ts:95-100, 222-235, 274; auth-host suite passes |
| 03 | Typed error found under wrappers; no new reason token; reconcile aborts and `resources_discover` reports it | VERIFIED | `causeChain` walk in errors.ts; owner `GHB-03` cases pass |
| 04 | `info --fetch` and `update` degrade transport failures but let the typed error escape; bare `info` ignores the variable | VERIFIED | info.ts, update-preflight.ts call `rethrow` first; suites pass |
| 05 | Lint rule, 7 disables, identity from `GITHUB_ORIGIN`, docs, green check | VERIFIED | criteria 2, 4, 5 and the gate log |

### Prohibitions (test-tier)

| Prohibition | Status | Enforcement evidence |
|-------------|--------|----------------------|
| MUST NOT include the variable's value in any message | VERIFIED | `GHB-03: refuses base ... without echoing it` in the seam suite; errors.test.ts message cases; message built from the variable name and a fixed rule string |
| MUST NOT reach github.com or silently ignore the setting when set but invalid | VERIFIED | `gitHubWireUrl` throws synchronously before each network call; add's invalid-base case asserts `cloneCalls: []` |
| MUST NOT send a credential other than one `git credential` returns for the exact host, nor start Device Flow while set | VERIFIED | `buildGitHubAuth` returns only a `stored-credential` bundle under the override; `D-04: starts no Device Flow for a ... base` passes |

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `extensions/pi-claude-marketplace/shared/github-base-url.ts` | seam: `gitHubWireUrl`, `gitHubOverrideHost`, `GITHUB_HOST`, `GITHUB_ORIGIN` | VERIFIED | 102 lines, stateless; imported by git.ts, auth-host.ts, clone-key.ts, git-failure-classifiers.ts |
| `extensions/pi-claude-marketplace/shared/errors.ts` | `InvalidGitHubBaseUrlError`, `rethrowInvalidGitHubBaseUrl`, `FetchedUrlCause` | VERIFIED | 18 rethrow call sites |
| `extensions/pi-claude-marketplace/platform/git.ts` | wire URL on the network calls, origin reset, cause tail | VERIFIED | |
| `extensions/pi-claude-marketplace/orchestrators/auth-host.ts` | `buildGitHubAuth`, override-aware `hostFromCloneUrl`/`buildCloneAuth` | VERIFIED | |
| `eslint.config.js` | `local/no-github-literal` | VERIFIED | |
| `tests/shared/github-base-url.test.ts`, `tests/shared/github-base-url-environment.ts` | pair test, env helper | VERIFIED | |
| `README.md`, `README.es.md`, `CHANGELOG.md` | divergence docs | VERIFIED | |

### Key Link Verification

| From | To | Via | Status |
|------|----|-----|--------|
| platform/git.ts | shared/github-base-url.ts | `gitHubWireUrl(` in clone, fetch, listServerRefsAt | WIRED |
| shared/github-base-url.ts | shared/errors.ts | `new InvalidGitHubBaseUrlError(` | WIRED |
| platform/git.ts | isomorphic-git setConfig | `remote.origin.url` reset | WIRED |
| orchestrators/auth-host.ts | shared/github-base-url.ts | `gitHubOverrideHost(` / `gitHubWireUrl(` | WIRED |
| marketplace/add.ts, marketplace/update.ts, plugin/update-flow.ts | auth-host.ts | `buildGitHubAuth(` | WIRED |
| add, import, enable-disable, update-preflight, fetch, info, reinstall-flow, install-flow, bootstrap | shared/errors.ts | `rethrowInvalidGitHubBaseUrl(` | WIRED |
| eslint.config.js | extensions/**/*.ts | `local/no-github-literal` | WIRED |
| domain/clone-key.ts | shared/github-base-url.ts | `GITHUB_ORIGIN` | WIRED |
| shared/git-failure-classifiers.ts | shared/github-base-url.ts | `gitHubWireUrl(` in `hostHttpFailureFrame` | WIRED |

### Data-Flow Trace (Level 4)

| Artifact | Data | Source | Real data | Status |
|----------|------|--------|-----------|--------|
| `gitHubWireUrl` / `gitHubOverrideHost` | base URL, host | `process.env.PI_CLAUDE_MARKETPLACE_GITHUB_BASE_URL`, read per call | yes | FLOWING |
| `FetchedUrlCause` | wire URL | `withFetchedUrlCause` in git.ts, then add/import child rows and update/install cause chains | yes | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Seam, platform, auth, domain, errors, classifier suites | `node --test` over the 7 files (scratch HOME and PI_CODING_AGENT_DIR, variable unset) | 565 pass, 0 fail | PASS |
| 16 orchestrator, edge, and reconcile owner suites | `node --test` (scratch HOME) | 1696 pass, 0 fail | PASS |
| Literal gate rejects new literals | ESLint stdin plant into `domain/name.ts` | 2 errors, exit 1 | PASS |
| Full gate | log cited above (HEAD 0110a355) | 433/433 scenarios, all static and coverage stages passed | PASS |

### Probe Execution

No probes declared. SKIPPED.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| GHB-01 | 02-01 | GitHub sources clone from `<base>/<owner>/<repo>.git` | SATISFIED | criterion 1 |
| GHB-02 | 02-02, 02-05 | One seam for origin match, update, auth host; literal gate | SATISFIED | criteria 1, 2 |
| GHB-03 | 02-01, 02-03, 02-04 | Invalid value: typed error naming the variable | SATISFIED | criterion 3 |
| GHB-04 | 02-01, 02-02, 02-04, 02-05 | Unset byte-identical; github.com terms either way | SATISFIED | criterion 4 |
| GHB-05 | 02-05 | README and CHANGELOG divergence | SATISFIED | criterion 5 |

No orphaned requirements: REQUIREMENTS.md maps exactly GHB-01..05 to Phase 2.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| seam, auth-host.ts, platform/git.ts | - | TBD/FIXME/XXX | none found | - |
| orchestrators/marketplace/add.ts | - | Carried Info item (REVIEW IN-01): under the override, a clone failure whose staging cleanup also leaks repeats the head message | Info | Rare double failure, override only; recorded in 02-REVIEW-DISPOSITION.md |

### Human Verification Required

None.

### Gaps Summary

None. The phase goal holds at HEAD. One seam (`shared/github-base-url.ts`) feeds every GitHub network call in `platform/git.ts` and every GitHub auth bundle in `orchestrators/auth-host.ts`. Clone identity and output stay in github.com terms, an invalid value fails each GitHub network command with a typed, value-free error, unset behavior is unchanged, a lint gate blocks new `github.com` literals, and README and CHANGELOG record the divergence. Phase 10's rejected-credential cause extends the failure text without changing the override path.

---

_Verified: 2026-10-21_
_Verifier: Claude (gsd-verifier)_
