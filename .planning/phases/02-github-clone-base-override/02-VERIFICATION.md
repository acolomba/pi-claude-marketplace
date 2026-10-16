---
phase: 02-github-clone-base-override
verified: 2026-10-16T10:56:00Z
status: passed
score: 5/5 roadmap success criteria verified (45/45 plan truths, 3/3 prohibitions)
covered_files: [".planning/phases/02-github-clone-base-override/02-01-PLAN.md",".planning/phases/02-github-clone-base-override/02-01-SUMMARY.md",".planning/phases/02-github-clone-base-override/02-02-PLAN.md",".planning/phases/02-github-clone-base-override/02-02-SUMMARY.md",".planning/phases/02-github-clone-base-override/02-03-PLAN.md",".planning/phases/02-github-clone-base-override/02-03-SUMMARY.md",".planning/phases/02-github-clone-base-override/02-04-PLAN.md",".planning/phases/02-github-clone-base-override/02-04-SUMMARY.md",".planning/phases/02-github-clone-base-override/02-05-PLAN.md",".planning/phases/02-github-clone-base-override/02-05-SUMMARY.md","CHANGELOG.md","README.es.md","README.md","docs/output-catalog.md","eslint.config.js","extensions/pi-claude-marketplace/domain/auth-registry.ts","extensions/pi-claude-marketplace/domain/clone-key.ts","extensions/pi-claude-marketplace/domain/source.ts","extensions/pi-claude-marketplace/edge/handlers/plugin/bootstrap.ts","extensions/pi-claude-marketplace/edge/handlers/plugin/enable-disable.ts","extensions/pi-claude-marketplace/orchestrators/auth-host.ts","extensions/pi-claude-marketplace/orchestrators/import/execute.ts","extensions/pi-claude-marketplace/orchestrators/marketplace/add.messaging.ts","extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts","extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts","extensions/pi-claude-marketplace/orchestrators/plugin/clone-cache.ts","extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts","extensions/pi-claude-marketplace/orchestrators/plugin/fetch.ts","extensions/pi-claude-marketplace/orchestrators/plugin/info.ts","extensions/pi-claude-marketplace/orchestrators/plugin/install-clone-probe.ts","extensions/pi-claude-marketplace/orchestrators/plugin/install-flow.ts","extensions/pi-claude-marketplace/orchestrators/plugin/reinstall-clone-probe.ts","extensions/pi-claude-marketplace/orchestrators/plugin/reinstall-flow.ts","extensions/pi-claude-marketplace/orchestrators/plugin/update-flow.ts","extensions/pi-claude-marketplace/orchestrators/plugin/update-preflight.ts","extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts","extensions/pi-claude-marketplace/platform/git.ts","extensions/pi-claude-marketplace/shared/errors.ts","extensions/pi-claude-marketplace/shared/github-base-url.ts","tests/architecture/catalog-uat/catalog-contract.test.ts","tests/architecture/catalog-uat/catalog-parser.test.ts","tests/architecture/catalog-uat/catalog-wire.test.ts","tests/architecture/catalog-uat/fixtures/marketplace-add.ts","tests/architecture/soft-dep-marker-policy.test.ts","tests/domain/clone-key.test.ts","tests/domain/source.test.ts","tests/edge/handlers/plugin/bootstrap.test.ts","tests/edge/handlers/plugin/enable-disable.test.ts","tests/orchestrators/auth-host.test.ts","tests/orchestrators/import/execute.test.ts","tests/orchestrators/marketplace/add.messaging.test.ts","tests/orchestrators/marketplace/add.test.ts","tests/orchestrators/marketplace/update.test.ts","tests/orchestrators/plugin/clone-cache.test.ts","tests/orchestrators/plugin/enable-disable.test.ts","tests/orchestrators/plugin/fetch.test.ts","tests/orchestrators/plugin/info.test.ts","tests/orchestrators/plugin/install-clone-probe.test.ts","tests/orchestrators/plugin/install-flow.test.ts","tests/orchestrators/plugin/reinstall-clone-probe.test.ts","tests/orchestrators/plugin/reinstall-flow.test.ts","tests/orchestrators/plugin/update-flow.test.ts","tests/orchestrators/plugin/update-preflight.test.ts","tests/platform/git.test.ts","tests/shared/errors.test.ts","tests/shared/github-base-url-environment.ts","tests/shared/github-base-url.test.ts","tests/shared/notification-command-error.test.ts"]
covered_digest: "v3:sha256:ce53f5e32526fcc732cc1fec691aaf9478c206a21875df043f6776458167b74e"
behavior_unverified: 0
overrides_applied: 0
human_verification: []
---

# Phase 2: GitHub Clone-Base Override Verification Report

**Phase Goal:** With `PI_CLAUDE_MARKETPLACE_GITHUB_BASE_URL` set, every GitHub site (the clone URL, origin matching for leftover clones, marketplace update, and the auth host) uses the configured base through one seam, so the suite can serve GitHub sources locally. Unset, behavior does not change (D-MF-01).
**Verified:** 2026-10-16T10:56:00Z
**Status:** passed
**Re-verification:** No (initial verification)
**Tree:** HEAD dda39179. `npm run check` exited 0 at e542527d, and `git diff --stat e542527d HEAD` touches only four `.planning/` files, so that result was reused rather than re-run.

Accepted rulings, not counted as gaps: the WR-01 exception (an invalid base after rollback partials or an MCP config rewrite ends in that target's failed row), eager update-preflight auth, bootstrap's causeless row (SNM-10), and `/reload` rows that may omit the fetched URL (documented in README; user ruling 2026-10-16). README.es.md drift from before this milestone is tracked as WINDOWS entry 93.

## Goal Achievement

### Observable Truths (roadmap success criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | With an `https:` base set, `owner/repo` and `https://github.com/o/r[.git][#ref]` clone from `<base>/<owner>/<repo>.git`; leftover-clone recognition, `marketplace update`, and the auth host use the same base; the auth host binds the override's host and port so Device Flow never starts; each affected owner test has an override case | VERIFIED | `shared/github-base-url.ts::gitHubWireUrl` rewrites the exact `https://github.com/` prefix onto `base.origin + pathname` (WHATWG). All four network calls in `platform/git.ts` (`clone` :446, `fetch` :488, `listServerRefsAt` :414 for `resolveRemoteRef`/`listRemoteTags`) send `gitHubWireUrl(...)`; these are the file's only `git.clone`/`git.fetch`/`git.listServerRefs` calls. `clone` resets `remote.origin.url` to the canonical URL (:465), and `fetch` passes the rewritten `url` beside the remote name, so `.git/config` stays canonical. `canonicalCloneUrl` builds from `GITHUB_ORIGIN`, so `originMatchesSource` still matches. `buildGitHubAuth` (auth-host.ts:222) returns a stored-credential bundle for `gitHubOverrideHost()` with no provider lookup. `marketplace add` (add.ts:1017), `marketplace update` (update.ts:404), the plugin-update sync (update-flow.ts:172), and every plugin clone, pin, and tag probe (`buildCloneAuth`, `hostFromCloneUrl`) route through it. The tests pass: `GHB-01: clones a github.com URL from the base and records the canonical origin`, `GHB-01 / D-02: fetches a canonical github.com origin from the base and keeps the recorded origin`, `GHB-02 / D-02: an owned leftover with a canonical origin recovers under the override`, `D-04: starts no Device Flow for a ... base`, `GHB-02: binds base https://mirror.example:8443/git to host mirror.example:8443`, and the override cases in add, update, update-flow, install/reinstall clone probes, and auth-host. |
| 2 | A source-walk gate in `npm run check` fails on a new hard-coded `github.com` URL outside the seam | VERIFIED | `eslint.config.js` defines `local/no-github-literal` over `extensions/pi-claude-marketplace/**/*.ts`, turned off only for `shared/github-base-url.ts`. It checks string literals, cooked template text, and regex patterns with `\.` read as `.`. `npm run lint` runs inside `check:static`. Hand plant (stdin, nothing written): adding `"https://github.com/x/y"`, `/github\.com/`, and a template literal with `api.github.com` to `domain/source.ts`, which already carries four disables, gave 3 errors (exit 1). A comment line in the same plant gave none. Exactly 7 justified disables exist: 3 in `auth-registry.ts`, 4 in `source.ts`. |
| 3 | A set but invalid value (not `https:`, userinfo, query, fragment) fails the command with a typed error that names the variable | VERIFIED | `InvalidGitHubBaseUrlError` (errors.ts:458) has `variable` and `problem` fields. Its message is `<VARIABLE> <rule>`, with no slash and no value. The checks run in a fixed order: not-a-url, scheme, userinfo, fragment, query. `rethrowInvalidGitHubBaseUrl` walks the cause chain. It is called first in every per-target catch on a GitHub path: add, update (refresh and autoupdate cascade), install (incl. missing-dependency), import (marketplace and plugin), enable (orchestrator and edge), bootstrap, reinstall, fetch, `info --fetch` (both builders), update-flow (sync, per-target, cascade), and update-preflight. The `GHB-03` tests for each command pass, and `add` asserts `cloneCalls: []`, so nothing reaches the network. json/rpc: `GHB-03: a command failing on an invalid base reports the variable unredacted` passes. |
| 4 | Unset: every GitHub-source operation is byte-identical; `list`, `info`, and `claude-plugins.json` show github.com terms whether set or not | VERIFIED | Unset, `gitHubWireUrl` returns its input and reads nothing more. `withFetchedUrlCause` skips its `try` when `wireUrl === url`. `fetch` adds `url` only when it was rewritten, and `clone` skips `setConfig`. The only new unset-path step is a local `getConfig` read, which returns undefined for a missing config, so `git.fetch` fails as before (test `a fetch whose remote records no url passes none and fails as before`). The `FetchedUrlCause` child row in add/import appears only when `hasFetchedUrlCause` is true, which needs a rewrite. Only `platform/git.ts`, `orchestrators/auth-host.ts`, and `domain/clone-key.ts` (constant only) import the seam. Display (`source.ts:766`), `canonicalCloneUrl`, and config never read the variable. Tests pass: `GHB-04: keeps github.com terms with the override set`, `GHB-02 / D-01: keeps the github.com identity with the override set`, `GHB-04 / NFR-5: bare info on a GitHub plugin ignores an invalid base`, and `GHB-04: an unrewritten failed fetch carries no fetched cause`. The existing platform suite passes, and its earlier tests are unchanged. |
| 5 | README (with localized copies) and CHANGELOG document the variable as a divergence from Claude Code | VERIFIED | `README.md` and `README.es.md` both have a "GitHub mirror" / "Espejo de GitHub" section. It covers the purpose, a path-prefix example whose stated wire URL is correct, the refused forms, empty-as-unset, no Device Flow, credentials from `git credential` keyed by host:port, github.com output, the changed-value-on-next-fetch rule, the bootstrap and `/reload` caveat, and the statement that Claude Code has no such setting. `README.*.md` has only the `es` copy. `CHANGELOG.md` `[Unreleased]` has one bullet that names the variable and says Claude Code lacks the setting. |

**Score:** 5/5 roadmap criteria verified (0 present, behavior-unverified).

### Plan must-have truths (02-01 .. 02-05)

All 45 plan truths were checked against code and named tests. The ones that go beyond the roadmap criteria:

| Plan | Truth | Status | Evidence |
|------|-------|--------|----------|
| 01 | Trailing slashes normalize; WHATWG host/port/IPv6; exact-prefix (no case folding, `www.`, `:443`, look-alike hosts unchanged); empty = unset; whitespace or `https://` = not-a-url; `?`/`#` refused even when empty; per-call read; idempotent; a non-github URL never reads the variable | VERIFIED | `tests/shared/github-base-url.test.ts` parameterized cases pass (498 tests across the seam, platform, auth-host, domain, and errors suites, 0 fail) |
| 01 | Fetched cause tail only on a rewritten failure; an existing cause is kept | VERIFIED | `D-10: a failed clone/fetch/resolution/listing from the base names the fetched URL`, `D-10: a rewritten failure keeps a cause it already carries` |
| 01 | Backstop: a clone interrupted between the wire-URL origin and the canonical reset never becomes a final clone | VERIFIED | `setConfig` is awaited inside `clone()` (git.ts:465), so a failure there rejects `clone()`. Both production clone sites clone into a `randomUUID()` staging dir (add.ts:904, clone-cache.ts `cloneIntoStaging`), and only a later rename promotes it. Passing behavioral tests on that rejection path: `MA-9: a clone failure cleans staging and rethrows with the leak suffix appended` and `MIRR-01/03: a clone failure cleans staging and rethrows the original error`. A crashed staging dir is never promoted or recorded. |
| 02 | Override host for add, update, sync, plugin clones/pins/tag probes; Device Flow hosts still get stored credentials; a `https://github.com` base binds stored credentials; git-subdir on github.com binds the override host; a url source and a path-only update ignore an invalid variable | VERIFIED | auth-host.ts:95-101, 222-235, 274; tests `D-09: binds a github.com git-subdir url to the override host`, `a url source host ignores an invalid override`, `GHB-04: a path-only update ignores an invalid override`, `GHB-04: updating a url marketplace ignores an invalid override` |
| 03 | Typed error found under wrappers; no new reason token; reconcile ends the pass and `resources_discover` reports reconcile-aborted | VERIFIED | `causeChain` walk; `index.ts:123-133` wraps `applyReconcile` in a catch that calls `notifyReconcileAborted` (existing `tests/index.test.ts` reconcile-aborted case); `GHB-03: an orchestrated add/install/enable rethrows an invalid base` pass |
| 04 | `info --fetch` and `update` still degrade transport failures; only the typed error escapes; bare `info` ignores the variable | VERIFIED | info.ts:2210/2508 and update-preflight.ts:398 call `rethrow` before classifying; tests pass |
| 05 | Lint rule, 7 disables, per-line coverage, identity from `GITHUB_ORIGIN`, docs, green check | VERIFIED | see criteria 2, 4, 5 above; check exit 0 at e542527d |

### Prohibitions (test-tier)

| Prohibition | Status | Enforcement evidence |
|-------------|--------|----------------------|
| MUST NOT include the variable's value in any message | VERIFIED | `GHB-03: refuses base ... without echoing it` (seam), errors.test.ts message cases; message built only from the variable name and a fixed rule string |
| MUST NOT reach github.com or silently ignore the setting when set but invalid | VERIFIED | `gitHubWireUrl` throws synchronously before each network call; `GHB-03: a standalone GitHub add fails the command on an invalid base` asserts `cloneCalls: []` |
| MUST NOT send a credential other than one `git credential` returns for the exact host, nor start Device Flow while set | VERIFIED | `buildGitHubAuth` returns `stored-credential` only; `onAuth` compares `new URL(url).host` to the bundle host (git-auth-callbacks.ts:177-178); `D-04: starts no Device Flow for a ... base` |

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `extensions/pi-claude-marketplace/shared/github-base-url.ts` | seam: `gitHubWireUrl`, `gitHubOverrideHost`, `GITHUB_HOST`, `GITHUB_ORIGIN` | VERIFIED | 102 lines, no state, imported by git.ts, auth-host.ts, and clone-key.ts |
| `extensions/pi-claude-marketplace/shared/errors.ts` | `InvalidGitHubBaseUrlError`, `rethrowInvalidGitHubBaseUrl`, `FetchedUrlCause` | VERIFIED | 14 rethrow call sites |
| `extensions/pi-claude-marketplace/platform/git.ts` | the 4 calls rewritten, origin reset, cause tail | VERIFIED | |
| `extensions/pi-claude-marketplace/orchestrators/auth-host.ts` | `buildGitHubAuth`, override-aware `hostFromCloneUrl`/`buildCloneAuth` | VERIFIED | |
| `eslint.config.js` | `local/no-github-literal` | VERIFIED | |
| `tests/shared/github-base-url.test.ts`, `tests/shared/github-base-url-environment.ts` | pair test, env helper with `t.after` restore | VERIFIED | |
| `README.md`, `README.es.md`, `CHANGELOG.md` | divergence docs | VERIFIED | |

`gsd-tools verify.artifacts`: plans 01-05 all_passed (18/18). `verify.key-links`: all_verified (14/14).

### Key Link Verification

| From | To | Via | Status |
|------|----|-----|--------|
| platform/git.ts | shared/github-base-url.ts | `gitHubWireUrl(` in clone/fetch/listServerRefsAt | WIRED |
| shared/github-base-url.ts | shared/errors.ts | `new InvalidGitHubBaseUrlError(` | WIRED |
| platform/git.ts | isomorphic-git setConfig | `remote.origin.url` reset | WIRED |
| orchestrators/auth-host.ts | shared/github-base-url.ts | `gitHubOverrideHost(` / `gitHubWireUrl(` | WIRED |
| marketplace/add.ts, marketplace/update.ts, plugin/update-flow.ts | auth-host.ts | `buildGitHubAuth(` | WIRED |
| add, import, edge enable-disable, update-preflight, fetch, reinstall-flow | shared/errors.ts | `rethrowInvalidGitHubBaseUrl(` | WIRED |
| eslint.config.js | extensions/**/*.ts | `local/no-github-literal` | WIRED |
| domain/clone-key.ts | shared/github-base-url.ts | `GITHUB_ORIGIN` | WIRED |

### Data-Flow Trace (Level 4)

| Artifact | Data | Source | Real data | Status |
|----------|------|--------|-----------|--------|
| `gitHubWireUrl` / `gitHubOverrideHost` | base URL, host | `process.env.PI_CLAUDE_MARKETPLACE_GITHUB_BASE_URL`, read per call | yes | FLOWING |
| `FetchedUrlCause` | wire URL | `withFetchedUrlCause` in git.ts, then add/import child-row cause, update/install cause chains | yes | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Seam, platform, auth, domain, errors suites | `node --test tests/shared/github-base-url.test.ts tests/platform/git.test.ts tests/orchestrators/auth-host.test.ts tests/domain/clone-key.test.ts tests/domain/source.test.ts tests/shared/errors.test.ts` (scratch HOME and PI_CODING_AGENT_DIR, variable unset) | 498 pass, 0 fail | PASS |
| 17 orchestrator, edge, and reconcile owner suites touched by the phase | `node --test` over add, update, install-flow, import/execute, enable-disable (x2), bootstrap, reinstall-flow, fetch, info, update-flow, update-preflight, clone-cache, install/reinstall clone probes, notification-command-error, reconcile/apply (scratch HOME) | 2092 pass, 0 fail; 67 GHB/override-titled cases among them | PASS |
| Literal gate rejects new literals | ESLint stdin plant into `domain/source.ts` | 3 errors, exit 1; comment not flagged | PASS |

### Probe Execution

No probes declared or conventional for this phase (`scripts/*/tests/probe-*.sh` not referenced). SKIPPED.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| GHB-01 | 02-01 | GitHub sources clone from `<base>/<owner>/<repo>.git` | SATISFIED | criterion 1 |
| GHB-02 | 02-02, 02-05 | One seam for origin match, update, auth host; literal gate | SATISFIED | criteria 1, 2 |
| GHB-03 | 02-01, 02-03, 02-04 | Invalid value: typed error naming the variable | SATISFIED | criterion 3 |
| GHB-04 | 02-01, 02-02, 02-04, 02-05 | Unset byte-identical; github.com terms either way | SATISFIED | criterion 4 |
| GHB-05 | 02-05 | README and CHANGELOG divergence | SATISFIED | criterion 5 |

No orphaned requirements: REQUIREMENTS.md maps exactly GHB-01..05 to Phase 2.

### Decision Coverage

`check.decision-coverage-verify`: 10/10 trackable CONTEXT.md decisions honored. Not honored: none.

### Test Quality Audit

| Test File | Linked Req | Skipped | Circular | Assertion Level | Verdict |
|-----------|-----------|---------|----------|-----------------|---------|
| tests/shared/github-base-url.test.ts | GHB-01/02/03 | 0 | no | value (exact URLs, hosts, typed error deep-equal) | OK |
| tests/platform/git.test.ts | GHB-01/04, D-10 | 0 new (pre-existing FIFO skips are unrelated) | no | behavioral (real repo over stubbed transport, recorded origin, request log) | OK |
| tests/orchestrators/auth-host.test.ts | GHB-02 | 0 | no | value (bundle kind and host) | OK |
| orchestrator owner tests (add, update, install-flow, import, enable-disable, reinstall, fetch, info, update-flow, update-preflight, bootstrap) | GHB-03 | 0 | no | behavioral (rejects with the typed instance, no rows, no clone calls) | OK |
| tests/domain/{clone-key,source}.test.ts | GHB-04 | 0 | no | value | OK |

Disabled tests on requirements: 0. Circular patterns: 0. Insufficient assertions: 0.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| (all 58 changed files, added lines) | - | TBD/FIXME/XXX/TODO/HACK/placeholder | none found | - |
| orchestrators/marketplace/add.ts | ~576-586, 913-917 | REVIEW IN-01 (deferred): under the override, a clone failure whose staging cleanup also leaks repeats the head message and prints the full staging path on the child cause row | Info | Rare double failure, override only. Its only record is 02-REVIEW-DISPOSITION.md, with no BACKLOG or todo entry. |
| tests/orchestrators/plugin/dependency-tag-probe.test.ts, update-preflight.test.ts | - | No `setGitHubBaseUrl` case for the tag-probe auth or the autoupdate cascade's stored-credential host under the override | Info | The behavior lives in `buildCloneAuth`/`hostFromCloneUrl`, whose override arms are tested in auth-host.test.ts. The tag-probe module was not changed in this phase. |
| (none) | - | No single test drives an authenticated clone end to end under the override (credential sent to the override host) | Info | The bundle host (auth-host tests) and the `onAuth` host check are both tested, and they compose by WHATWG `host`. Phase 10 covers 401 on GitHub rows through the override. |

### Human Verification Required

None. Every criterion was checked by code reading, named passing tests, and a hand plant of the lint rule. The README section was read directly.

### Gaps Summary

None. The phase goal holds in the codebase. A single seam (`shared/github-base-url.ts`) feeds every GitHub network call in `platform/git.ts` and every GitHub auth bundle in `orchestrators/auth-host.ts`. Clone identity, origins, and output stay in github.com terms. An invalid value fails every GitHub network command as a whole with a typed, value-free error. Unset behavior is unchanged. A lint gate stops new `github.com` literals. The README and CHANGELOG record the divergence. The three Info items above are advisory and need no closure plan. IN-01 would benefit from a BACKLOG carrier if it should outlive the review record.

---

_Verified: 2026-10-16T10:56:00Z_
_Verifier: Claude (gsd-verifier)_
