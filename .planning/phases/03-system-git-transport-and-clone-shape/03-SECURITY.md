---
phase: "3"
slug: "system-git-transport-and-clone-shape"
status: secured
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
created: "2026-11-24"
---

# Phase 3 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| marketplace data → git argv | refs, shas, URLs and paths from a third-party catalog become git operands | argv |
| Pi → git `-c` config | Pi's own request pairs and the D-SG-05 hardening pairs share one command line | config pairs |
| Device Flow token → git child | a signed-in token reaches git only through the one-shot helper | credential |
| user git config → git child | a user's `insteadOf`, helpers and redirects decide which host git contacts | URLs, credentials |
| remote → checkout on disk | a re-clone replaces a live marketplace checkout or plugin mirror | files, links, `.git` |
| interrupted run → next run | staging and backup folders survive a crash | directories |
| scenario sandbox → developer machine | the CONNECT proxy, the https git host and the stand-in CA | network, trust |

---

## Threat Register

Evidence lines are from the audit at `db85603`; the review fixes (`52eaf33`..`c59fa42`) were re-audited at `9a29f1e`.

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-03-01 | Elevation of privilege | `git-process.ts` request `-c` pairs | high | mitigate | Request pairs now come before the hardening pairs, so git's last-wins rule keeps the hardening (`git-process.ts:769-774`, fix `3b327f8`); real-git probe: `core.hooksPath`, `protocol.ext.allow`, `safe.bareRepository`, `core.fsmonitor` and `credential.interactive` overrides read back as the module's values | closed |
| T-03-02 | Spoofing | failure-kind rows | medium | mitigate | rows match git's own lines after `remote:` lines are removed (`git-failure-kind.ts:92-97,131`) | closed |
| T-03-03 | Information disclosure | `GitCommandError` message | low | accept | AR-03-01 | closed |
| T-03-04 | Tampering | ref operands | high | mitigate | `refRefusal` on every ref path (`domain/source.ts:161-170,186,532,700,779`); `--branch=` is one word (`git.ts:411`); `--end-of-options` (`git-process.ts:303-305`); scenarios `features/plugin/git-source.feature:445`, `features/marketplace/url-source.feature:116` | closed |
| T-03-05 | Tampering | abbreviated sha | medium | mitigate | a sha that is not 40 or 64 hex is refused (`domain/source.ts:143-152`); dependency `sha` refused separately (`domain/dependency-closure.ts:328-338`) | closed |
| T-03-06 | Elevation of privilege | CONNECT proxy (harness) | high | mitigate | tunnels only `github.com:443`, only to loopback (`features/lib/github-device-flow/connect-proxy.ts:36,44-53,107-114`) | closed |
| T-03-07 | Tampering | shell `CLAUDE_CODE_PLUGIN_*` | medium | mitigate | no such variable reaches a scenario child (`test/architecture/hermetic-git-environment.test.ts:96-97,448`) | closed |
| T-03-08 | Spoofing | stand-in CA | low | accept | AR-03-02 | closed |
| T-03-09 | Tampering | copy of an old clone | medium | mitigate | `core.symlinks`, `core.ignorecase`, `core.filemode` unset before checkout (`git.ts:509,528-541`; `clone-cache.ts:292-300`) | closed |
| T-03-10 | Tampering | checkout and rev-parse operands | medium | mitigate | checkout refuses a leading `-`; `rev-parse --verify --end-of-options` (`git-process.ts:314-345`) | closed |
| T-03-11 | Denial of service | git timeout variable | low | mitigate | capped at 2147483647, junk or 0 gives 120000 (`platform/git-timeout.ts:14-33`) | closed |
| T-03-12 | Information disclosure | one-shot credential | high | mitigate | 0600 file (`wx`) in a fresh 0700 `mkdtemp` directory, `get` only, removed in `finally`; no argv, log or message holds it (`git-one-shot-credential.ts`, `test/platform/git.test.ts:1383-1414`) | closed |
| T-03-13 | Tampering | GitHub base URL | high | mitigate | a base holding `=` is refused (`shared/github-base-url.ts:76-79`) | closed |
| T-03-14 | Tampering | `https_proxy` in scenarios | medium | mitigate | only the Device Flow profile sets it (`features/support/world.ts:1315-1327`) | closed |
| T-03-15 | Repudiation | refused credential kept | low | accept | AR-03-03 | closed |
| T-03-16 | Information disclosure | crash leaves the 0600 file | low | accept | AR-03-04 | closed |
| T-03-17 | Tampering | clone argv | high | mitigate | domain refusals, `--branch=<ref>` one word, URL and directory after `--end-of-options` (`git.ts:399-420`) | closed |
| T-03-18 | Tampering | pin ladder | high | mitigate | `HEAD` must equal the lower-cased pin, else `pin-mismatch` and staging removed (`clone-cache.ts:154,175-178,255-260`) | closed |
| T-03-19 | Elevation of privilege | submodules | medium | mitigate | `--no-recurse-submodules` and `submodule.recurse=false` (`git.ts:409`; `git-process.ts:253`) | closed |
| T-03-20 | Information disclosure | network reach | high | mitigate | one network path (`runRemote`), `insteadOf` pair on every remote request; changed suites pass in `unshare -n` with loopback only | closed |
| T-03-21 | Tampering | swap paths | high | mitigate | live, backup and staging paths come from contained `ScopedLocations` getters; moves are `rename` only (`persistence/locations.ts:405-438`; `clone-swap.ts`) | closed |
| T-03-22 | Tampering | interrupted swap | medium | mitigate | the lock covers check, clone and swap; a leftover backup is restored; a failed move-in renames back (`clone-swap.ts:276-293,353-371`) | closed |
| T-03-23 | Spoofing | ownership marker | medium | mitigate | marker written into staging before the swap (`clone-swap.ts:63-67,295-297`) | closed |
| T-03-24 | Repudiation | kept checkout | low | mitigate | a kept checkout warns with the variable name and the record is not stamped (`marketplace/update.ts:618-628,662-667`) | closed |
| T-03-25 | Information disclosure | release-tag listing | medium | mitigate | only the constrained path-source arm reaches it; architecture test `marketplace-tag-probe-remote.test.ts` | closed |
| T-03-26 | Tampering | hostile tag list | low | accept | AR-03-05 | closed |
| T-03-27 | Tampering | mirror swap | high | mitigate | getters for live, backup and staging; carry-over through `assertPathInside` (`clone-cache.ts:518-529,616-630`; `clone-swap.ts:377-412`) | closed |
| T-03-28 | Denial of service | mirror in use | medium | mitigate | `kept-in-use` fails as `permission denied`; a mirror is never kept on failure (`clone-cache.ts:625-633`) | closed |
| T-03-29 | Tampering | mirror swap race | medium | mitigate | callers hold the scope lock (`fetch.ts:411`, `info.ts:2551`, install, update) | closed |
| T-03-30 | Repudiation | kept sync | low | mitigate | each kept case writes a debug line (`plugin/update-flow.ts:241-253`) | closed |
| T-03-31 | Denial of service | orphan mirror backup | low | accept | AR-03-06 | closed |
| T-03-32 | Tampering | timeout and keep variables | medium | mitigate | reach only the scenario's own Pi (`hermetic-git-environment.test.ts:448-477`) | closed |
| T-03-33 | Denial of service | held clone | medium | mitigate | process-group kill on timeout; clean retry (`features/marketplace/failed-add.feature:145`) | closed |
| T-03-34 | Tampering | SHA-refusing host arm | low | mitigate | released at scenario end (`features/step_definitions/git-host.steps.ts:117-128,181`) | closed |
| T-03-35 | Tampering | capital-letter commit-id ref | medium | mitigate | refused before any lock, disk or git (`orchestrators/marketplace/add.ts:739-813`) | closed |
| T-03-36 | Tampering | interrupted update recovery | medium | mitigate | restore only when live is absent or unmarked (`clone-swap.ts:259-276`) | closed |
| T-03-37 | Tampering | force-moved tag (harness) | low | accept | AR-03-07 | closed |
| T-03-38 | Information disclosure | auth bundle types move | medium | mitigate | shapes unchanged (`platform/git-credential.ts:81-129`) | closed |
| T-03-39 | Tampering | network gate list | medium | mitigate | only the deleted wrapper's name left `NETWORK_SEAM_NAMES`; `clone-swap.ts` added with a reason (`eslint.config.js`) | closed |
| T-03-40 | Tampering | edge git injection proof | medium | mitigate | traps on `NODE_GIT_PROCESS.run` in four edge tests | closed |
| T-03-41 | Repudiation | test decoupling | low | mitigate | before and after case counts recorded (03-13-SUMMARY) | closed |
| T-03-42 | Tampering | link out of a marketplace | high | mitigate | manifest read keeps its `realpath` boundary (`domain/manifest-containment.ts:127-147`; `features/plugin/install.feature:455`) | closed |
| T-03-43 | Tampering | old clone copies | medium | mitigate | as T-03-09, with two scenarios | closed |
| T-03-44 | Repudiation | kept marketplace in `plugin update` | low | accept | AR-03-08 | closed |
| T-03-45 | Information disclosure | credential-leak gate | high | mitigate | the gate slot moved to `git-one-shot-credential.ts` (`test/architecture/gate-targets.ts:167`) | closed |
| T-03-46 | Tampering | `isomorphic-git` return | medium | mitigate | rule pack bans it with no exemption (`rule-packs/architecture.json`) | closed |
| T-03-47 | Tampering | lockfile | low | mitigate | removal only, no new package | closed |
| T-03-48 | Tampering | classifier pruning | medium | mitigate | live rungs kept (`shared/git-failure-classifiers.ts:106-110`) | closed |
| T-03-49 | Repudiation | stale comments | low | mitigate | no `isomorphic` text in `extensions/` | closed |
| T-03-50 | Repudiation | codebase map | medium | mitigate | ARCHITECTURE.md seam count equals `eslint.config.js` (19) | closed |
| T-03-51 | Repudiation | decision outcomes | low | mitigate | taken from the SUMMARYs (03-17-SUMMARY) | closed |
| T-03-52 | Tampering | lower-case commit-id ref | low | accept | AR-03-09 | closed |
| T-03-53 | Tampering | interim D-14 gate | medium | mitigate | real-git case ran before any table changed (03-06-SUMMARY) | closed |
| T-03-54 | Tampering | current old clone keeps its keys | low | accept | AR-03-10 | closed |
| T-03-55 | Information disclosure | Device Flow retry token | high | mitigate | found by review (CR-01) and audit. The retry acts only when the request URL after the D-SG-16 rewrite is https on the bundle's host (`git.ts:298-352`); the helper pairs are keyed `credential.<origin>.helper` after an empty reset, and an origin with `=` is refused (`git-one-shot-credential.ts:76-118`); the helper prints only when stdin's `host=` matches (`:89-93`). Fixes `52eaf33`, `30666ee`. Real-git reproduction (loopback, `unshare -n`) with a user `insteadOf` rewrite and with a redirect: 0 Authorization headers reached the other host; the pre-fix shape leaked in the same setup | closed |
| T-03-SC | Tampering | supply chain | high | mitigate | no package added; `isomorphic-git` removed | closed |

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-03-01 | T-03-03 | `GitCommandError` holds fields only; stderr is redacted (`shared/errors.ts:1365`) | phase orchestrator (plan threat model) | 2026-11-24 |
| AR-03-02 | T-03-08 | the stand-in CA is trusted only through the sandbox `GIT_SSL_CAINFO`; nothing writes a system trust store | phase orchestrator (plan threat model) | 2026-11-24 |
| AR-03-03 | T-03-15 | the extension erases no credential; git's own helper may (Phase 5 settles GAUTH-04 and AUTH-07) | phase orchestrator (plan threat model) | 2026-11-24 |
| AR-03-04 | T-03-16 | a crash between write and `finally` can leave the 0600 file in its 0700 directory | phase orchestrator (plan threat model) | 2026-11-24 |
| AR-03-05 | T-03-26 | a hostile tag list costs parsing and one checkout of the chosen commit | phase orchestrator (plan threat model) | 2026-11-24 |
| AR-03-06 | T-03-31 | an orphan `plugin-clones-backup/<key>` costs disk only (review IN-03, deferred) | phase orchestrator (plan threat model) | 2026-11-24 |
| AR-03-07 | T-03-37 | the force-moved tag lives in the scenario sandbox only | phase orchestrator (plan threat model) | 2026-11-24 |
| AR-03-08 | T-03-44 | a kept marketplace in `plugin update` is debug-logged, not shown | phase orchestrator (plan threat model) | 2026-11-24 |
| AR-03-09 | T-03-52 | a lower-case commit id reaches git as one `--branch=` word and fails clean until SG-PIN-01 | phase orchestrator (plan threat model) | 2026-11-24 |
| AR-03-10 | T-03-54 | an old clone whose remote has not moved keeps its `core.*` keys until its next re-clone | phase orchestrator (plan threat model) | 2026-11-24 |

## Open Low Findings (below `block_on`)

| ID | Severity | Finding | Owner |
|----|----------|---------|-------|
| F-2 | low | a `git-subdir` source `url` has no scheme gate, so `file:` and `ssh:` reach git; after T-03-55 such a URL never gets a token | Phase 4 (SSH sources and transport selection) |
| F-5 | low | the harness does not require `httpsProxy` when `withoutGitHubBaseOverride` is set (`features/support/world.ts:786-790,1140-1155`) | harness follow-up |
| F-6 (rest) | low | UUID staging under `sources-staging/` from add, hosted catalogs, pinned clones, commit and tag copies, seeding and package installs is never swept; the lock-free runs make a sweep unsafe | follow-up |
| R-1 | info | under a user `insteadOf` or a redirect, another host's 401 can still start a needless Device Flow prompt; no token leaves | Phase 5 |
| R-2 | info | a bare 401/403 now reads `no-credential`, so a token without repository access starts a sign-in (review WR-02; maintainer accepted for now, revisit in Phase 6) | Phase 6 |

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-11-24 | 56 | 55 | 1 (T-03-55) | gsd-security-auditor at `db85603` |
| 2026-11-24 | 56 | 56 | 0 | gsd-security-auditor re-audit at `9a29f1e` |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: secured` set in frontmatter

**Approval:** secured 2026-11-24
