---
phase: "10"
slug: "constraint-aware-update"
status: secured
# Blocking threats at or above workflow.security_block_on (high).
threats_open: 0
asvs_level: 1
created: "2026-09-24"
---

# Phase 10 — Security

Plan-time threats were checked at ASVS level 1 against current source, the [validation map](10-VALIDATION.md), and the [goal verification](10-VERIFICATION.md). The current tree passed 7,760 unit tests and all 15 integration files. The full `npm run check` is still blocked by formatting in the operator-owned `.planning/config.json`.

## Trust Boundaries

| Boundary | Description | Data Crossing |
| --- | --- | --- |
| Installed declarations → update preflight | Recorded dependent ranges constrain an update | Guarded keys and bounded ranges |
| Tag probe → candidate resolver | A satisfying tag pin and auth bundle reach the resolver | Tag OID, version and auth bundle |
| Fetched candidate → update result | The landed version is checked and disclosed | Version, holder keys and redacted cause |

## Threat Register

Each plan has its own threat IDs. The plan column identifies repeated IDs. Control text comes from the plan. The evidence reference identifies the current test or goal check.

| Plan | Threat ID | Category | Component | Severity | Disposition | Plan control and current evidence | Status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 10-01-PLAN.md | T-10-01 | Denial of service | `update-constraint-gate.ts` range fold | medium | mitigate | The gate calls `intersectDependencyRanges` and nothing else; that function measures total input against a 4096-character cap and the projected conjunct count against a 1024 cap BEFORE any parse. A prohibition and an acceptance criterion (`from "semver"` count is 0) keep a second evaluator out. Plan control: `10-01-PLAN.md`; test: `tests/orchestrators/plugin/update-constraint-gate.test.ts`; current-tree suites passed. | closed |
| 10-01-PLAN.md | T-10-02 | Information disclosure | `describeConstraint` cause line | medium | mitigate | The line interpolates only `name@marketplace` keys and ranges already passed through `renderConstraintRange`; the fail-closed arm forwards the walk's own message, which `dependency-index.ts` already built path-redacted and without cause chaining. Task 3 asserts no absolute path reaches the line. Plan control: `10-01-PLAN.md`; test: `tests/orchestrators/plugin/update-constraint-gate.test.ts`; current-tree suites passed. | closed |
| 10-01-PLAN.md | T-10-03 | Spoofing | holder naming | low | mitigate | A holder's key is the walk's own `${name}@${marketplace}` composition over recorded names, not free text; the disabled marking is read from the state record rather than supplied by the declaration. Plan control: `10-01-PLAN.md`; goal check: `10-VERIFICATION.md`; current-tree suites passed. | closed |
| 10-01-PLAN.md | T-10-04 | Tampering | closed-set vocabulary | low | mitigate | The amendment lands on nine pinning surfaces in one commit; five independent gates (`notify-closed-set-locks`, `compat-01-no-expansion`, `notification-types.test`, `catalog-contract`, the `_UncoveredReason` / `_ExtraReason` proof) fail on a partial edit. Plan control: `10-01-PLAN.md`; test: `tests/orchestrators/plugin/update-constraint-gate.test.ts`; current-tree suites passed. | closed |
| 10-01-PLAN.md | T-10-05 | Elevation of privilege | `composePluginLinesWith` widened gate | low | mitigate | The widening is additive: `renderIndentedCauseChain(undefined, "    ")` returns the empty string and pushes nothing, so every existing `skipped` producer -- none of which sets `cause` -- keeps byte-frozen output. An acceptance criterion asserts the one-line composition. Plan control: `10-01-PLAN.md`; test: `tests/orchestrators/plugin/update-constraint-gate.test.ts`; current-tree suites passed. | closed |
| 10-01-PLAN.md | T-10-SC | Tampering | npm/pip/cargo installs | low | accept | This phase adds no runtime or dev dependency; RESEARCH.md records the Package Legitimacy Gate as not applicable, and no task runs a package-manager install. Plan control: `10-01-PLAN.md`; goal check: `10-VERIFICATION.md`; original plan acceptance is logged below. | closed |
| 10-02-PLAN.md | T-10-06 | Tampering | tag selection | high | mitigate | A crafted tag name cannot select an arbitrary ref: `selectHighestSatisfyingTag`'s `readPinCandidate` rejects any candidate whose name does not start with `${pluginName}--v`, and this plan reaches that selector only through the two existing probes -- an acceptance criterion pins that the gate names the selector zero times and the git surface zero times. Plan control: `10-02-PLAN.md`; test: `tests/orchestrators/plugin/update-constraint-gate.test.ts`; current-tree suites passed. | closed |
| 10-02-PLAN.md | T-10-07 | Tampering | pin materialization | high | mitigate | The pin travels as an oid through the resolver's own callbacks into the already-pinned arms of `materializePluginClone` / `materializeMarketplaceTagClone`; `entry.source` is never rewritten, and an acceptance criterion greps for the mutation. Plan control: `10-02-PLAN.md`; test: `tests/orchestrators/plugin/update-preflight.test.ts`; current-tree suites passed. | closed |
| 10-02-PLAN.md | T-10-08 | Information disclosure | credential handling on the listing | high | mitigate | AUTH-09: `preparePluginUpdate` composes ONE host bundle and hands the same object to the clone probe and the gate; the gate reads no field of it and places no credential value on any returned arm. The failure arm carries the transport classification and the rendered range only. Plan control: `10-02-PLAN.md`; test: `tests/orchestrators/plugin/update-constraint-gate.test.ts`; current-tree suites passed. | closed |
| 10-02-PLAN.md | T-10-09 | Spoofing | recorded version | medium | mitigate | The recorded `toVersion` for a pinned update is the tag's own `version` string from the probe result, not a value derived from the sha, so the record cannot claim a version the tag did not name. A dedicated case asserts it. Plan control: `10-02-PLAN.md`; test: `tests/orchestrators/plugin/update-preflight.test.ts`; current-tree suites passed. | closed |
| 10-02-PLAN.md | T-10-10 | Denial of service | bulk tag traffic | medium | mitigate | One memo pair per run bounds listings to one per repository URL and one per marketplace root; memos are written on success only, so a failure is still retried rather than cached. Three cases assert the counts. Plan control: `10-02-PLAN.md`; test: `tests/orchestrators/plugin/update-constraint-gate.test.ts`; current-tree suites passed. | closed |
| 10-02-PLAN.md | T-10-SC | Tampering | npm/pip/cargo installs | low | accept | No runtime or dev dependency is added; the Package Legitimacy Gate is recorded as not applicable in RESEARCH.md. Plan control: `10-02-PLAN.md`; goal check: `10-VERIFICATION.md`; original plan acceptance is logged below. | closed |
| 10-03-PLAN.md | T-10-11 | Tampering | `admitResolvedVersion` membership test | high | mitigate | The test is `recordedVersionSatisfies`, the single normalization ladder the load-time check already uses; no second comparator is introduced, and stage two re-folds nothing, so the caps enforced at fold time are not re-entered on attacker-influenced input. Plan control: `10-03-PLAN.md`; test: `tests/orchestrators/plugin/update-constraint-gate.test.ts`; current-tree suites passed. | closed |
| 10-03-PLAN.md | T-10-12 | Spoofing | per-dependent rejection filter | medium | mitigate | A holder is named only when its OWN declared range rejects the fetched version, so a declaration cannot cause an unrelated plugin to be blamed. A dedicated case asserts the satisfied holder's key is absent from the line. Plan control: `10-03-PLAN.md`; test: `tests/orchestrators/plugin/update-constraint-gate.test.ts`; current-tree suites passed. | closed |
| 10-03-PLAN.md | T-10-13 | Information disclosure | out-of-range cause line | medium | mitigate | The line interpolates the fetched version, the rendered range and recorded keys only; the range passes through `renderConstraintRange` and no path or credential is reachable from the composer's inputs. Plan control: `10-03-PLAN.md`; test: `tests/orchestrators/plugin/update-constraint-gate.test.ts`; current-tree suites passed. | closed |
| 10-03-PLAN.md | T-10-14 | Tampering | the disclosure carrier | medium | mitigate | TWO guards, covering two different failures (D-10-17a). (a) The member is declared REQUIRED-BUT-NULLABLE (`constraint: UpdateConstraintDisclosure \| undefined`, never `constraint?:`), so under `exactOptionalPropertyTypes` a construction site that OMITS it is a compile error -- and `!` / `as` are unavailable in `extensions/`, so the error cannot be dodged. This is the named silent-omission class this milestone has already shipped three times, and an optional member would not have caught it. (b) The sub-object is atomically shaped -- both members required inside it -- so a site cannot emit a HALF-FILLED disclosure. All 51 construction sites (4 production, 47 typed test literals) are swept in Task 1, and the sweep's completeness is proven by `npm run typecheck` rather than by a grep. Plan control: `10-03-PLAN.md`; test: `tests/orchestrators/plugin/update-constraint-gate.test.ts`; current-tree suites passed. | closed |
| 10-03-PLAN.md | T-10-20 | Tampering | `PreparedPluginUpdate.constraint` consumers | low | mitigate | The slot has exactly one justified consumer, `update-swap.ts`'s `updated`-outcome literal; both `unchanged` rows read the gate verdict instead, with the disabled-refresh site taking it as a required parameter. A filtered grep asserts `preflight.constraint` never appears inside `update-preflight.ts`, so a second consumer cannot be added without failing a criterion and re-opening D-10-17a. Plan control: `10-03-PLAN.md`; test: `tests/orchestrators/plugin/update-row.test.ts`; current-tree suites passed. | closed |
| 10-03-PLAN.md | T-10-15 | Repudiation | severity of the background row | medium | mitigate | The held row is `warning` on both surfaces through `skipSeverity`'s default; a direct `skipSeverity` assertion plus one case per cascade goes red if the token is ever moved into the idempotent set, which would silently downgrade a persistent condition to `info`. Plan control: `10-03-PLAN.md`; test: `tests/orchestrators/marketplace/update.messaging.test.ts`; current-tree suites passed. | closed |
| 10-03-PLAN.md | T-10-SC | Tampering | npm/pip/cargo installs | low | accept | No runtime or dev dependency is added; the Package Legitimacy Gate is recorded as not applicable in RESEARCH.md. Plan control: `10-03-PLAN.md`; goal check: `10-VERIFICATION.md`; original plan acceptance is logged below. | closed |
| 10-04-PLAN.md | T-10-16 | Tampering | the phase's own gates | high | mitigate | Three named prohibitions bound the closing run: no gate disarmed, no byte expectation repaired from actual output, no coverage exemption added. The pin file's empty row list is asserted programmatically, and the contract-file diff is required to show modifications rather than removals. Plan control: `10-04-PLAN.md`; test: `tests/orchestrators/plugin/update-cascade.test.ts`; current-tree suites passed. | closed |
| 10-04-PLAN.md | T-10-17 | Repudiation | the regression proof | high | mitigate | A vacuous self-comparison would let a real change in the unconstrained path pass unnoticed. The expected rows are required to be literals in the test file, and each fixture is required to contain a second declaring plugin so the walk genuinely runs. Plan control: `10-04-PLAN.md`; test: `tests/orchestrators/plugin/update-cascade.test.ts`; current-tree suites passed. | closed |
| 10-04-PLAN.md | T-10-18 | Information disclosure | documentation | low | mitigate | The prose names tokens and phrases the composer stamps and no absolute path, credential or internal identifier; an acceptance criterion pins that no decision identifier reaches the document body. Plan control: `10-04-PLAN.md`; test: `tests/architecture/dependency-doc-agreement.test.ts`; current-tree suites passed. | closed |
| 10-04-PLAN.md | T-10-19 | Tampering | network policy | high | mitigate | The gate leaf's absence from the network-free target list is asserted by grep, and `no-orchestrator-network` is run rather than trusted; adding the leaf to the list to pass something is named as a prohibited remedy. Plan control: `10-04-PLAN.md`; test: `tests/orchestrators/plugin/update-cascade.test.ts`; current-tree suites passed. | closed |
| 10-04-PLAN.md | T-10-SC | Tampering | npm/pip/cargo installs | low | accept | No runtime or dev dependency is added in this phase; the Package Legitimacy Gate is recorded as not applicable in RESEARCH.md, and no task runs a package-manager install. Plan control: `10-04-PLAN.md`; goal check: `10-VERIFICATION.md`; original plan acceptance is logged below. | closed |

24 plan-specific threat rows are closed by a shipped control, an accepted risk, or a documented transfer. Only an open high or critical threat counts toward `threats_open`.

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
| --- | --- | --- | --- | --- |
| R-10-01 | T-10-SC in 10-01-PLAN.md | This phase adds no runtime or dev dependency; RESEARCH.md records the Package Legitimacy Gate as not applicable, and no task runs a package-manager install. | original plan disposition, reviewed by orchestrator | 2026-09-24 |
| R-10-02 | T-10-SC in 10-02-PLAN.md | No runtime or dev dependency is added; the Package Legitimacy Gate is recorded as not applicable in RESEARCH.md. | original plan disposition, reviewed by orchestrator | 2026-09-24 |
| R-10-03 | T-10-SC in 10-03-PLAN.md | No runtime or dev dependency is added; the Package Legitimacy Gate is recorded as not applicable in RESEARCH.md. | original plan disposition, reviewed by orchestrator | 2026-09-24 |
| R-10-04 | T-10-SC in 10-04-PLAN.md | No runtime or dev dependency is added in this phase; the Package Legitimacy Gate is recorded as not applicable in RESEARCH.md, and no task runs a package-manager install. | original plan disposition, reviewed by orchestrator | 2026-09-24 |

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
| --- | ---: | ---: | ---: | --- |
| 2026-09-24 | 24 | 24 | 0 | orchestrator, ASVS L1 current-tree audit |

## Sign-Off

- [x] Every threat has a disposition.
- [x] Accepted risks are documented above.
- [x] No high or critical threats remain open.
- [x] `status: secured` and `threats_open: 0` are set.

**Approval:** verified 2026-09-24
