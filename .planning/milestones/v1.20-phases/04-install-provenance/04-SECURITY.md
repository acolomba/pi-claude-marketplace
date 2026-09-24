---
phase: "04"
slug: "install-provenance"
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
created: "2026-09-16"
---

# Phase 04 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| Hand-edited `state.json` -> `loadState` | An untrusted document crosses into the extension's own model | `provenance` field, whole install record |
| Plugin manifest -> install record | Plugin-supplied content could cross into persisted state | none for `provenance` (computed by this extension) |
| Test fixture -> `saveState` revalidation | A hand-built document crosses the same validator a real one does | record literals in 36 test files |
| `claude-plugins.json` (user-authored) -> `planReconcile` | The user's declared desired state crosses into a plan that deletes installs | declared plugin keys |
| `state.json` `provenance` -> uninstall bucket / `resources_discover` sweep | A persisted field now vetoes a deletion and is the sole protection for a cascade-installed plugin | `provenance: "dependency"` |
| User command line -> record mutation | `install <name>` now changes persisted state on a path that previously only refused | one record's `provenance` field |
| Promoted record -> `claude-plugins.json` | A state change writes into the user-authored desired-state file | the promoted plugin's key |
| Amended architecture pins -> future fields | Loosening an equality pin into a subset check would disarm the tripwire for every later field | test assertions |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-04-01 | Tampering | `state.json` `provenance` field (hand-edited) | low | accept | The user owns their own state file; a forged `dependency` value only stops reconcile sweeping that user's own orphans, and Phase 5's prune re-derives need from live manifests (`orchestrators/plugin/dependency-index.ts` walks declarations "whatever its provenance", header line 11) rather than trusting the field. Recorded in `04-01-SUMMARY.md` and `04-04-SUMMARY.md` threat register notes; see Accepted Risks Log AR-04-01 | closed |
| T-04-02 | Denial of service | `STATE_VALIDATOR.Check` / `loadState` / `saveState` | low | mitigate | `provenance: Type.Union([Type.Literal("explicit"), Type.Literal("dependency")])` (`persistence/state-io.ts:136`) is a closed two-literal union; `loadState` throws naming the file and the first validator error with a JSON pointer (`state-io.ts:332-347`); `saveState` re-checks `STATE_VALIDATOR.Check` before every write (`state-io.ts:503-504`), so the promotion path (plan 06) cannot put a malformed value on disk; proven by `tests/persistence/state-io.test.ts` (45 cases incl. the non-coercion row, `/marketplaces/catalog/plugins/plugin/provenance: must be equal to constant`) and a `@ts-expect-error` pin on the closed union | closed |
| T-04-03 | Tampering | removal of the cascade config write (CR-01 failure mode) | high | mitigate | Wave ordering: D-04-05's exemption in `buildUninstallBucket` (`orchestrators/reconcile/plan.ts:546`) landed in wave 4 and was green before plan 05 removed the write; `writeOrchestratedDeclarations` no longer writes cascade members (`install-flow.ts:400-407` header, D-04-02); `04-05-SUMMARY.md` records the planted revert of the exemption observed red on the reload assertion and restored byte for byte; proven by `tests/orchestrators/plugin/install-flow.test.ts` ("RESV-01 / D-04-04: an orchestrated install records its cascade dependency undeclared, and the next reload keeps it", "D-04-05 / CMP-3: a dependency adopted from a user-scope marketplace survives the project reload") | closed |
| T-04-04 | Information disclosure | statePhase record literal | low | accept | `provenance` is computed by this extension: `isRoot = member.key === rootKey` → `isRoot ? "explicit" : "dependency"` (`install-flow.ts:1443-1455`); no plugin manifest supplies it (contrast `hookEntries`, whose schema bounds plugin-supplied payload). `04-RESEARCH.md:1093` records the not-applicable verdict; see Accepted Risks Log AR-04-02 | closed |
| T-04-05 | Tampering | `persistMigratedState` silent rewrite | low | mitigate | The migrate fill touches only an ABSENT key (`if (pl.provenance === undefined) pl.provenance = "explicit"`, `persistence/migrate.ts:221-222`) and writes only through `persistMigratedState`; `tests/architecture/config-state-write-seams.test.ts` ("SPLIT-02: only saveState / persistMigratedState write state.json") gates the two-writer seam by equality | closed |
| T-04-06 | Tampering | the four amended architecture pins | medium | mitigate | `compat-01-no-expansion.test.ts` (key-set pin lists `provenance`, union pin `[1, 2, 3]`, default-state pin 3), `hooks-foundation.test.ts` (independent union pin, arity 3), `state-io.test.ts`, and the schema-version pins all remain `assert.deepEqual`/`assert.equal` under `node:assert/strict` — no subset checks; `04-02-SUMMARY.md` records planted violations (`provenance` → `provenanceX`, `schemaVersion` reverted to 2) each observed red in exactly one pin and restored | closed |
| T-04-07 | Tampering | the suite's own assertions (861-failure sweep) | high | mitigate | Strict-equality census in `04-03-SUMMARY.md`: over the plan's 36 files `deepStrictEqual` 1584 → 1592, `deepEqual` 284 → 284, `strictEqual` 500 → 502 — every increase is a new case; no expectation repaired from actual output, no case deleted or skipped; `install-flow.test.ts` alone still carries 188 `deepStrictEqual` lines | closed |
| T-04-08 | Spoofing | PROV-02's proof (requirement satisfied by an absence of code) | high | mitigate | `tests/orchestrators/plugin/install-flow.test.ts` ("D-04-01: a direct install stays a direct install when a later plugin declares it") is a whole-record `deepStrictEqual` against a `clonePluginRecord` snapshot; `04-03-SUMMARY.md` records it observed red against a three-site plant (`tdd-red-evidence` → `RED_EVIDENCE_OK`) and `git diff --quiet -- extensions/` → 0 after restore | closed |
| T-04-09 | Tampering | `buildUninstallBucket`'s new guard | high | mitigate | The exemption is one field test, `if (record.provenance === "dependency") continue;` (`orchestrators/reconcile/plan.ts:546`), and a recorded plugin that is neither declared nor a dependency is still swept (`:549-551`); `tests/orchestrators/reconcile/plan.test.ts` plans both D-04-05 cases over one shared `provenanceState()` (a dependency-provenance record beside a direct-install orphan) inside a `deepStrictEqual` that pins all buckets; `04-04-SUMMARY.md` records the over-broad plant observed red in both halves | closed |
| T-04-10 | Elevation of privilege | `plan.ts` purity | medium | mitigate | `plan.ts` imports only `domain/source.ts`, `persistence/config-io.ts`, `persistence/state-io.ts`, and `./types.ts` (`plan.ts:48-52`); `tests/architecture/reconcile-planner-purity.test.ts` ("DIFF-01: planReconcile is pure") runs unamended — `04-04-SUMMARY.md`: `git diff ffa6be6e..HEAD -- tests/architecture/` is empty | closed |
| T-04-11 | Tampering | `writeAdoptingConfigEntries` / `writeOrchestratedDeclarations` dead parameters | medium | mitigate | `writeBatchedConfigEntries` is no longer imported by `install-flow.ts` (grep: only `shared.ts:23` and its definition in `config-write-back.ts:180` remain); `fallow dead-code --fail-on-issues` → `No issues found` (re-run 2026-09-16) | closed |
| T-04-12 | Repudiation | doc prose stating retired behavior | medium | mitigate | `docs/dependency-resolution.md:116` now states "This extension does not write a dependency into `claude-plugins.json` or `claude-plugins.local.json`. Instead, its install record says that it arrived through another plugin."; literal-absence greps re-run 2026-09-16: `same file the asking plugin` → 0 in `docs/dependency-resolution.md`, `the same configuration file` → 0 in `README.md` | closed |
| T-04-13 | Tampering | the promotion's record mutation | high | mitigate | `promoteDependencyRecord` (`install-flow.ts:886-900`) flips `record.provenance = "explicit"` and runs no ledger for a record with artifacts on disk (header `:870-873` names the forbidden re-run-the-ledger implementation); proven by `tests/orchestrators/plugin/install-flow.test.ts` ("D-04-07: installing a dependency by name flips its provenance and nothing else in the state document" — whole-document equality) | closed |
| T-04-14 | Repudiation | the promotion's reported row | medium | mitigate | `dependency promoted` is a closed-set member in `shared/notification-types.ts:110` and documented in `shared/notify-reasons.ts:36`; the row is `installed` at info severity; proven by `tests/orchestrators/plugin/install-flow.test.ts` ("D-04-07: the promotion declares the promoted key and reports one installed row at info severity") with the catalog fixture pinning the bytes | closed |
| T-04-15 | Tampering | the promotion's config write | medium | mitigate | `declarePromotedPlugin` (`install-flow.ts:951-957`) returns early when `args.orchestrated` and otherwise writes through `writeAdoptingConfigEntries` with the promoted plugin's key only; proven by `tests/orchestrators/plugin/install-flow.test.ts` ("D-04-07: an orchestrated promotion flips the record, writes no declaration and emits nothing" — config bytes asserted unchanged) | closed |
| T-04-SC | Tampering | npm/pip/cargo installs | low | accept | No package-manager install task exists in this phase: `git log -- package.json` shows no phase-4 commit (last dependency change is plan 03-02's `semver`); `04-RESEARCH.md:238` records the not-applicable verdict. See Accepted Risks Log AR-04-03 | closed |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

**Note on T-04-02:** the plan registers list this threat three times (plans 01, 02, 06) because three plans each touch the validator boundary — the closed union, the non-coercion proof, and the promotion write. It is one threat with three evidence sites and is recorded once here.

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-04-01 | T-04-01 | A hand-edited `provenance` value is the user's own state file. A forged `dependency` value only exempts that user's own orphans from reconcile's sweep, is visible in the file, and cannot cause a deletion because Phase 5's prune re-derives need from live manifests. Low severity. | plan 04-01 / 04-04 registers, confirmed in `04-01-SUMMARY.md` and `04-04-SUMMARY.md` | 2026-09-16 |
| AR-04-02 | T-04-04 | `provenance` is computed from `member.key === rootKey`; no plugin manifest supplies it, so there is no plugin-supplied payload to bound. Low severity. | plan 04-01 register, `04-RESEARCH.md` § Package Legitimacy Audit and threat table | 2026-09-16 |
| AR-04-03 | T-04-SC | No package-manager install task exists in this phase; no `[ASSUMED]` or `[SUS]` package is introduced. Low severity. | all six plan registers, `04-RESEARCH.md:238` | 2026-09-16 |

*Accepted risks do not resurface in future audit runs.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-09-16 | 16 | 16 | 0 | Claude (orchestrator, grep-level ASVS L1 verification against source tree at `14b6a542`; 12 mitigate rows verified in code/tests/docs, 4 accept rows verified as documented; `fallow dead-code` and the two T-04-12 literal-absence greps re-run live) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-09-16
