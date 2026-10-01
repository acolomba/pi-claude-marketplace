---
phase: "09"
slug: "reload-installs-missing-dependencies"
status: secured
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
created: "2026-09-22"
---

# Phase 09 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| Marketplace manifest -> install record | A marketplace author's `plugin.json` declarations (names, marketplaces, ranges) decide what the reload installs | Plugin/marketplace names (guarded by `assertSafeName` / the dependency token rule), semver ranges (folded under the project-owned caps) |
| Reload apply pass -> network | The dependency-install step reaches git clone / tag probes only through the existing install cascade, for a member that is actually missing, and only on `resources_discover` `reason === "reload"` | Marketplace-declared sources; never a marketplace the user did not add (D-03-08) |
| Cascade failure -> rendered row | Error causes cross into the user-visible cascade through `redactedDependencyCascadeError` | Redacted messages; keys and bounded rendered ranges only, never absolute paths |
| Planner input -> plan | The LOAD-01 verdict (records + manifests) feeds the new bucket; the config is never read for it (D-04-02) | Recorded keys, declared ranges, `requiredBy` |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-09-01 | Tampering | `plan.ts::buildDependencyInstallBucket` | medium | mitigate | Bucket keys come from the verdict walk over `assertSafeName`-guarded records; a `parsePluginKey` failure drops the entry (tested) | closed |
| T-09-02 | Denial of service | `plan.ts` range carry | low | accept | Planner performs no fold; the fold and its caps live in the cascade | closed |
| T-09-03 | Elevation of privilege | `plan.ts` D-09-08 lift | medium | mitigate | `buildDependencyDisabledLift` requires the marker AND a live verdict that no longer holds the record, and never overturns a user's or config-declared disable (tests pin both refusals) | closed |
| T-09-04 | Information disclosure | `notify.ts::installedRowFromOutcome` | low | mitigate | The `{dependency installed}` row carries no cause line (D-09-09) | closed |
| T-09-05 | Tampering | closed-set vocabulary | low | mitigate | The 61st reason landed on every pinning surface in one commit (`036b1e7c`); locks, header count and catalog pins all green | closed |
| T-09-06 | Denial of service | `effectiveRanges` -> `intersectDependencyRanges` | medium | mitigate | The root's texts fold through the same call as every member's, under `MAX_*` caps; a failing fold is `constraint-failed`, never "no constraint" (T-06-10) | closed |
| T-09-07 | Tampering | `runInstallCascade` wall selection | medium | mitigate | `treatDisabledAsWall` is read at exactly one site (`install-cascade.ts:1172`); a walled record never becomes a `re-enable` phase | closed |
| T-09-08 | Information disclosure | `toIntersectionFailure` rendered range | low | mitigate | Rendered through `renderConstraintRange`'s bound; overflow marker, never the raw text | closed |
| T-09-09 | Elevation of privilege | `applyDependencyInstalls` gate | high | mitigate | `apply.ts:687` returns before any install unless `opts.reason === "reload"`; `index.ts` threads the harness's own `event.reason`; startup case pinned in `apply.test.ts` and `index.test.ts` | closed |
| T-09-10 | Tampering | `installMissingDependencyWithTransaction` reach | high | mitigate | `knownMarketplaces` comes from `collectInstallReachableMarketplaces` (`install-flow.ts:2125`), the same set `installPlugin` uses; a not-added marketplace fails the dependency (`marketplace-not-added`, tested) and is never auto-added | closed |
| T-09-11 | Tampering | partial materialization on failure | high | mitigate | The cascade's `runPhases` all-or-nothing rollback (D-03-07) is reused unchanged; the closure-failure and member-failure apply cases assert no record and no artifacts remain | closed |
| T-09-12 | Information disclosure | `plugin-install-failed.cause` | medium | mitigate | `redactedDependencyCascadeError` (`apply.ts:752`) rebuilds the whole cause chain redacted before it reaches the projection | closed |
| T-09-13 | Tampering | `refreshTogglePlan` | medium | mitigate | Only `pluginsToEnable` / `pluginsToDisable` / `pluginsToDependencyDisable` are taken from the fresh plan (`apply.ts:798-800`); install/uninstall/add/remove and source-mismatch rows stay round-1 | closed |
| T-09-14 | Denial of service | D-09-14 retry | low | accept | Each attempt is bounded by the cascade's own caps; the retry runs only on an explicit `/reload`, never at session start | closed |
| T-09-15 | Tampering | `dependencyInstalled` row names | low | mitigate | Member names reach the row through `CascadeMemberOutcome.name`, produced by the walk over guarded records; the projection renders them through the same row composer as every install | closed |
| T-09-16 | Repudiation | `docs/output-catalog.md` fenced bytes | medium | mitigate | Both new states' bytes were produced by the real dispatcher over the fixture and byte-matched against `apply.test.ts`; `catalog-contract.test.ts` pins 222 states / 30,538 bytes | closed |
| T-09-17 | Information disclosure | catalog and doc cause-line examples | low | mitigate | Every example names keys and marketplace names only, never a path | closed |
| T-09-18 | Tampering | `check-unused-type-members.contracts.json` remap | low | mitigate | Coordinates only, columns kept; the two non-coordinate corrections in `3d095182` are each justified by the gate's own message; gate green | closed |
| T-09-SC | Tampering | npm/pip/cargo installs | low | accept | No runtime or dev dependency was added by any plan (Package Legitimacy gate: not applicable) | closed |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| R-09-01 | T-09-02 | The planner carries raw range texts; the single fold site and its caps are in the cascade, so a pathological set costs nothing at plan time | orchestrator (autonomous run, per plan disposition) | 2026-09-22 |
| R-09-02 | T-09-14 | A missing dependency is re-attempted on every explicit `/reload` (upstream parity); each attempt is bounded and no attempt runs at session start | orchestrator (autonomous run, per plan disposition) | 2026-09-22 |
| R-09-03 | T-09-SC | No package added in any of the four plans | orchestrator (autonomous run, per plan disposition) | 2026-09-22 |

*Accepted risks do not resurface in future audit runs.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-09-22 | 19 | 19 | 0 | orchestrator L1 grep-depth verification (register authored at plan time; short-circuit rule, no auditor spawned) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
