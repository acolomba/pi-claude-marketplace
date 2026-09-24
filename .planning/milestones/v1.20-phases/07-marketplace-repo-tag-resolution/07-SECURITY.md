---
phase: "07"
slug: "marketplace-repo-tag-resolution"
status: secured
# Blocking threats at or above workflow.security_block_on (high).
threats_open: 0
asvs_level: 1
created: "2026-09-24"
---

# Phase 07 — Security

Plan-time threats were checked at ASVS level 1 against current source, the [validation map](07-VALIDATION.md), and the [goal verification](07-VERIFICATION.md). The current tree passed 7,760 unit tests and all 15 integration files. The full `npm run check` is still blocked by formatting in the operator-owned `.planning/config.json`.

## Trust Boundaries

| Boundary | Description | Data Crossing |
| --- | --- | --- |
| Marketplace clone → tagged plugin clone | A release tag selects a copied marketplace tree | Tag OID and plugin root |
| Tagged clone → install record | The pin and resolved SHA become install metadata | Clone path, version and SHA |
| Install outcome → notification | A missing satisfying tag appears on an install row | Guarded key and range |

## Threat Register

Each plan has its own threat IDs. The plan column identifies repeated IDs. Control text comes from the plan. The evidence reference identifies the current test or goal check.

| Plan | Threat ID | Category | Component | Severity | Disposition | Plan control and current evidence | Status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 07-01-PLAN.md | T-07-01 | Spoofing | `domain/release-tag.ts::readPinCandidate` (reused from `dependency-tag-probe.ts`) | high | mitigate | Candidacy requires the tag name to start with THIS plugin's own `{name}--v` prefix, and the remainder must pass `semver.valid()` before any satisfaction test. A tag named for another plugin in the same marketplace, or a crafted name whose remainder is not a version, is never a candidate. Task 2 `<behavior>` pins both cases; the logic is moved, not rewritten. Plan control: `07-01-PLAN.md`; test: `tests/orchestrators/plugin/marketplace-tag-probe.test.ts`; current-tree suites passed. | closed |
| 07-01-PLAN.md | T-07-02 | Denial of Service | `orchestrators/plugin/clone-gc.ts::deriveLiveCloneKeys` boundary | high | mitigate | The materialization returns `resolvedSha` on its `materialized` arm and `install-outcome.ts` stamps it onto the install record, so the sweep's live-key predicate protects the directory. Task 3 asserts both directions -- survives with the field, swept without it -- so the mitigation cannot pass vacuously. Plan control: `07-01-PLAN.md`; test: `tests/orchestrators/plugin/clone-gc.test.ts`; current-tree suites passed. | closed |
| 07-01-PLAN.md | T-07-03 | Elevation of Privilege | `domain/plugin-resolver.ts::sourceEscapeReason` under a pinned path source | high | mitigate | The existing NFR-10 containment check is re-run against the RETURNED clone root rather than the live marketplace root, because the root changes for a pinned install. Task 2 (i)(g) implements it; Task 3 asserts a `../../elsewhere` raw resolves `unavailable`. Plan control: `07-01-PLAN.md`; test: `tests/orchestrators/plugin/clone-cache.test.ts`; current-tree suites passed. | closed |
| 07-01-PLAN.md | T-07-04 | Tampering | `clone-cache.ts` copy of a marketplace tree containing symlinks that escape the copy | medium | accept | Not a threat this phase introduces: `cp -r` symlink handling and the `locations.pluginCloneDir` SC-7 chokepoint (`assertSafeName` + `assertPathInside`) already govern every `plugin-clones/<key>/` path, and `seedOnePluginMirror` has accepted the identical exposure since SEED-01. No new surface is added; the existing controls are reused unchanged. Plan control: `07-01-PLAN.md`; goal check: `07-VERIFICATION.md`; original plan acceptance is logged below. | closed |
| 07-01-PLAN.md | T-07-05 | Tampering | isomorphic-git `checkout` against a shared `gitdir` | high | mitigate | D-07-04 adopts copy-then-checkout: the tag is checked out inside a COPY's own gitdir, so no index write ever reaches the marketplace clone. Verified root cause: `checkout` writes `${gitdir}/index` regardless of `noUpdateHead`. Task 2's integration test asserts `.git/index` and `.git/HEAD` bytes are unchanged; Task 1's checkpoint puts the construction on the record. Plan control: `07-01-PLAN.md`; goal check: `07-VERIFICATION.md`; current-tree suites passed. | closed |
| 07-01-PLAN.md | T-07-SC | Tampering | npm/pip/cargo installs | low | accept | This phase installs no packages. `isomorphic-git` and `semver` are already declared dependencies vetted in Phase 3 (RESV-03) and are unchanged; RESEARCH.md's Package Legitimacy Audit section records the same. No install task exists, so no legitimacy checkpoint is required. Plan control: `07-01-PLAN.md`; goal check: `07-VERIFICATION.md`; original plan acceptance is logged below. | closed |
| 07-02-PLAN.md | T-07-06 | Repudiation | `install-cascade.messaging.ts::composeCascadeMemberRows` | high | mitigate | A silent fallback would leave the user believing their constraint was honoured while an arbitrary current copy is on disk -- no record on the row, nothing to point at later. The mitigation is the token itself, asserted by exact array equality on the row's `reasons` in Task 2 plus the rendered-bytes catalog contract, so the row cannot ship empty. Plan control: `07-02-PLAN.md`; goal check: `07-VERIFICATION.md`; current-tree suites passed. | closed |
| 07-02-PLAN.md | T-07-07 | Tampering | reason-class misassignment across `notify-reasons.ts` / `docs/output-catalog.md` | medium | mitigate | Carrying a successful install on a token typed and documented as a failed-row reason would misreport the outcome to every consumer that reads by class. The token is minted as a distinct `CommandPrivateReason`, never a reuse of `no matching version`, and the row-`reasons` equality assertion plus the `_ReasonsCoverageProof` compile-time partition keep it in exactly one group. Plan control: `07-02-PLAN.md`; goal check: `07-VERIFICATION.md`; current-tree suites passed. | closed |
| 07-02-PLAN.md | T-07-08 | Elevation of Privilege | the deliberately unenforced constraint at install time | medium | transfer | TAGS-02 transfers constraint enforcement to Phase 6's shipped load-time check (LOAD-01/LOAD-02), which disables a dependent whose dependency is out of range and lifts the disable when it comes back into range. Nothing in this plan re-checks the constraint; the transfer is stated on the row and, in plan 07-03, in the documentation. Plan control: `07-02-PLAN.md`; goal check: `07-VERIFICATION.md`; transferred to the prior load-time check. | closed |
| 07-02-PLAN.md | T-07-SC | Tampering | npm/pip/cargo installs | low | accept | This plan installs no packages. No install task exists, so no legitimacy checkpoint is required. Plan control: `07-02-PLAN.md`; goal check: `07-VERIFICATION.md`; original plan acceptance is logged below. | closed |
| 07-03-PLAN.md | T-07-09 | Repudiation | `docs/dependency-resolution.md` §"How a constrained dependency is resolved" | medium | mitigate | Stale text that tells authors a path-source constraint can never be satisfied would have them permanently declare dependencies with no version, silently discarding the constraint this phase just made work -- and leaving nothing in the record to say why. Task 1 rewrites the section; Task 2 pins the fallback half of it to the real composer so it cannot go stale silently again. Plan control: `07-03-PLAN.md`; goal check: `07-VERIFICATION.md`; current-tree suites passed. | closed |
| 07-03-PLAN.md | T-07-10 | Information Disclosure | `docs/dependency-resolution.md` divergence prose | low | accept | The document names upstream behavior and this extension's deliberate departures from it. No credential, path, host or user datum is disclosed; the content is the same public product behavior the upstream plugins reference already documents. No new surface. Plan control: `07-03-PLAN.md`; goal check: `07-VERIFICATION.md`; original plan acceptance is logged below. | closed |
| 07-03-PLAN.md | T-07-SC | Tampering | npm/pip/cargo installs | low | accept | This plan installs no packages and changes no dependency. No install task exists, so no legitimacy checkpoint is required. Plan control: `07-03-PLAN.md`; goal check: `07-VERIFICATION.md`; original plan acceptance is logged below. | closed |

13 plan-specific threat rows are closed by a shipped control, an accepted risk, or a documented transfer. Only an open high or critical threat counts toward `threats_open`.

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
| --- | --- | --- | --- | --- |
| R-07-01 | T-07-04 in 07-01-PLAN.md | Not a threat this phase introduces: `cp -r` symlink handling and the `locations.pluginCloneDir` SC-7 chokepoint (`assertSafeName` + `assertPathInside`) already govern every `plugin-clones/<key>/` path, and `seedOnePluginMirror` has accepted the identical exposure since SEED-01. No new surface is added; the existing controls are reused unchanged. | original plan disposition, reviewed by orchestrator | 2026-09-24 |
| R-07-02 | T-07-SC in 07-01-PLAN.md | This phase installs no packages. `isomorphic-git` and `semver` are already declared dependencies vetted in Phase 3 (RESV-03) and are unchanged; RESEARCH.md's Package Legitimacy Audit section records the same. No install task exists, so no legitimacy checkpoint is required. | original plan disposition, reviewed by orchestrator | 2026-09-24 |
| R-07-03 | T-07-SC in 07-02-PLAN.md | This plan installs no packages. No install task exists, so no legitimacy checkpoint is required. | original plan disposition, reviewed by orchestrator | 2026-09-24 |
| R-07-04 | T-07-10 in 07-03-PLAN.md | The document names upstream behavior and this extension's deliberate departures from it. No credential, path, host or user datum is disclosed; the content is the same public product behavior the upstream plugins reference already documents. No new surface. | original plan disposition, reviewed by orchestrator | 2026-09-24 |
| R-07-05 | T-07-SC in 07-03-PLAN.md | This plan installs no packages and changes no dependency. No install task exists, so no legitimacy checkpoint is required. | original plan disposition, reviewed by orchestrator | 2026-09-24 |

## Transferred Controls

- `T-07-08` in `07-02-PLAN.md`: Constraint enforcement is supplied by the previously shipped LOAD-01/LOAD-02 dependency check; see [Phase 6 verification](../06-load-time-dependency-check-and-allowed-uninstall/06-VERIFICATION.md).

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
| --- | ---: | ---: | ---: | --- |
| 2026-09-24 | 13 | 13 | 0 | orchestrator, ASVS L1 current-tree audit |

## Sign-Off

- [x] Every threat has a disposition.
- [x] Accepted risks are documented above.
- [x] No high or critical threats remain open.
- [x] `status: secured` and `threats_open: 0` are set.

**Approval:** verified 2026-09-24
