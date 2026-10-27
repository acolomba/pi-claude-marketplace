---
phase: 06-import-marketplace-planning
slug: import-marketplace-planning
status: verified
threats_open: 0
asvs_level: 1
block_on: high
register_authored_at_plan_time: true
audited_at: 9cdc6dc9
base: d98660a7
created: 2026-10-27
---

# Phase 6 - Security

> Threat verification for import marketplace planning (milestone `plugin-lifecycle`). Every mitigation below was checked in the code at HEAD `9cdc6dc9`, after the review fixes in `06-REVIEW-FIX.md`. Line numbers refer to that commit.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| Scenario fixture to sandbox filesystem | The read-only fixture changes directory modes inside the per-run sandbox only. | Directory modes under the sandbox HOME, agent, and project directories |
| Product output to feature tables | The projection turns sandbox paths and error messages into tokens before a step compares rows. | Rendered rows, error messages |
| Orchestrated outcome to consumer rows | Install and enable outcomes keep raw `Error` objects that can hold absolute paths. Import and apply render them. | Rollback phase causes, install errors, dependency errors |
| Claude Code settings JSON to import planning | `extraKnownMarketplaces` keys and values come from files the user can edit. | Marketplace names and sources |
| Import to the user's `claude-plugins.json` | The post-pass writes declarations that the next load and `apply` act on. | Marketplace and plugin keys |
| Import to the network | Adding a git-source marketplace clones it. | Git clone |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Evidence | Status |
|-----------|----------|-----------|----------|-------------|----------|--------|
| T-06-01 | Denial of service | Read-only fixture, sandbox cleanup | medium | mitigate | `features/step_definitions/plugin/publishing.steps.ts:121` registers `restoreDirectoryWrites([home, agentDir, projectDir])` before line 122 makes the directory `0o555` (`features/lib/published-marketplace.ts:474`). `restoreDirectoryWrites` / `addOwnerWrite` (`published-marketplace.ts:504-517`) add owner write to every directory under each root and do not follow symlinks. Releases run most recent first (`features/support/world.ts:377-391`), so the restore runs before every earlier removal. The three roots are the whole sandbox (`features/support/pi-process.ts:77-81`), and published marketplaces live under HOME (`pi-process.ts:99`). | closed |
| T-06-02 | Tampering | Read-only fixture run as root | medium | mitigate | `publishing.steps.ts:125-126` reproduces the removal in a scratch copy (`readOnlySkillRemovalError`, `published-marketplace.ts:485-497`) and asserts `["EACCES", "unlink"]`. A root run can unlink, so the Given fails. The scratch directory is under the sandbox HOME (`publishing.steps.ts:116`). | closed |
| T-06-03 | Information disclosure | Feature tables | low | accept | Test-only output inside a hermetic sandbox (`pi-process.ts:73`). `projectTokens` (`features/lib/run-tokens.ts:119-141`) replaces sandbox paths and recorded error messages with tokens. See R-06-01. | closed |
| T-06-04 | Information disclosure | Install and enable orchestrated failed outcomes | medium | mitigate | The doc comments state the consumer's duty: `orchestrators/plugin/install-flow.ts:1830-1834` (`memberPartials`), `orchestrators/plugin/enable-disable.ts:2920-2923`, and `orchestrators/reconcile/apply-outcomes.ts:215-238`. Both consumers redact. Import does it in `execute.ts:2132` and `2143-2150`, apply in `reconcile/apply.ts:475-483` and `569`. No other production code reads the new `rollbackPartials` members (grep over `extensions/`). | closed |
| T-06-05 | Tampering | `PluginInstallFailedOutcome.cause` widened to `Error` | medium | mitigate | The type is `readonly cause?: Error` (`apply-outcomes.ts:233`). Every cause this phase assigns is rebuilt first: `apply.ts:502` and `562` (`redactedDependencyCascadeError`, which redacts the head and the chain, `apply.ts:456-462`) and `apply.ts:578` (`redactCauseChain(error)`). The pre-existing `DirectoryPinUnsatisfiedError` arm (`apply.ts:838`) was already allowed by the old type and is built from names, ranges, and a version. `test/orchestrators/reconcile/apply.test.ts:2425-2485` and `2487-2548` assert the exact rendered text. It shows `unlink 'data.txt'` and holds no absolute path. | closed |
| T-06-06 | Tampering | Unreferenced `extraKnownMarketplaces` keys such as `__proto__` or `constructor` | medium | mitigate | The new pass walks own keys only: `Object.keys(extraKnownMarketplaces)` in `orchestrators/import/marketplaces.ts:137-140` and `166-171`. The section is built by object spread (`import/settings.ts:107-110`), so every key it holds is an own data property. Writes downstream use `setOwn` (`shared/own-key.ts:17-19`, `Object.defineProperty`): `desiredConfigFor` (`import/execute.ts:1452-1469`) and the post-pass (`execute.ts:1965`, `1977`, `2009`, `2018`, `2066`, `2077`). Reads use `ownValue` (`own-key.ts:9-14`): the planner (`reconcile/plan.ts:151`, `170`, `341`) and import (`execute.ts:1649`, `1697-1700`). Claims, aliases, and config names are held in `Map`/`Set` (`plan.ts:239-244`, `execute.ts:1502`, `1540`, `1546`). | closed |
| T-06-07 | Elevation of privilege | An unreferenced git-source entry now clones over the network | low | accept | Claude Code registers every entry (E1). NFR-5 allows network for a git-source marketplace add. The add shows as an `(added)` row and is declared in the config (`test/orchestrators/import/execute.test.ts:1144`). The user can undo it with `marketplace remove`. See R-06-02. | closed |
| T-06-08 | Tampering | A settings name aliased to the wrong recorded marketplace | high | mitigate | Import follows only the planner's one-to-one claims. `marketplaceSourceClaims` (`plan.ts:269-275`) returns `buildMarketplaceClaims(...).recordedByDeclared`. That map is set only for a claim by the record's own name (`plan.ts:170-172`) or for a single declaration claiming a single record (`plan.ts:212-217`). Records whose names are declared are never source candidates (`plan.ts:150-152`). An ambiguous source (`plan.ts:175-187`) or a multiply claimed record (`plan.ts:222-230`) becomes a planner `source-mismatch` (`plan.ts:387-394`). `ensurePlannedMarketplaces` checks that mismatch before any add (`execute.ts:1639-1648`, add at `1651`). It blocks the marketplace's plugins (`execute.ts:1076`, `968`). The read pass also drops self-claims and every claim of a name the settings declare, planned or not (WR-01, `execute.ts:1540`, `1546-1550`). CR-01 config names reuse the same claim rule (`execute.ts:1498-1510`). Tests: `execute.test.ts:5545`, `5594`, `5644` (conflicts block before any add), `5490` (WR-01), `5336` and `5390` (CR-01), and `plan.test.ts:2025` and `2102`. | closed |
| T-06-09 | Repudiation | A settings marketplace with a source mismatch and no plugins renders nothing | medium | mitigate | `recordPlannedMismatch` sends a plugin-less mismatch to `recordMarketplaceAddFailure` with the mismatch cause (`execute.ts:1062-1073`, `961-980`). The block renders `(failed)` with a cause row (`execute.ts:769-773`, `905-928`). Pinned by `execute.test.ts:1256-1301`, and for a conflicted claim by `5594` and `5644`. | closed |
| T-06-10 | Information disclosure | Import failed rows: rollback phase causes and the dependency row's cause | high | mitigate | `pushUnexpectedFailure` puts the head through `redactAbsolutePaths(errorMessage(error))` (`execute.ts:2118`) and the chain through `redactCauseChain(error.cause)` (`execute.ts:2107`, `2119`). Phase causes go through `redactCauseChain` (`execute.ts:2132`, `2143-2150`). The dependency row's cause is `failureCause(o)` (`execute.ts:649`, `598-604`), which is built from those redacted fields. Every install and enable failure arm, the defensive catch, and the not-installed race reach `pushUnexpectedFailure` (`execute.ts:1162`, `1191`, `1296`, `1328`, `1335`, `2195`, `2246`). The IN-02 dedupe (`execute.ts:637-670`) only drops a repeated row. Tests: `execute.test.ts:1762-1820` and `2190-2255` assert exact text with paths cut to `data.txt` and `mcp-adapter.json`. | closed |
| T-06-11 | Information disclosure | Apply failed-install rows: the root cause, every phase cause, and the dependency row's cause | high | mitigate | Root cause: `redactCauseChain(error)` (`apply.ts:578`). Phase causes: `redactedRollbackPartials` (`apply.ts:475-483`, called at `569`), which drops the raw ledger `msg`. Dependency row: `redactedDependencyCascadeError(error)` (`apply.ts:502`). The no-partial dependency arm also uses it (`apply.ts:562`). `notify.ts:1168-1174` passes the already-redacted phases to the row. Tests: `apply.test.ts:2425-2485` and `2487-2548` assert the exact rendered text. | closed |
| T-06-12 | Tampering | Splitting a dependency key into marketplace and plugin | low | mitigate | `dependencyRollbackOutcome` splits at `error.key.lastIndexOf("@")` (`apply.ts:495-499`). This is the same rule as `parsePluginKey` (`plan.ts:87-96`). | closed |
| T-06-13 | Tampering | Import enable rows after the outcome is narrowed | low | mitigate | `installedRow` rebuilds `stagedAgents`, `stagedMcpServers`, and `stagedWorkflows` from the required `declaresAgents`, `declaresMcp`, and `declaresWorkflows` members (`execute.ts:702-704`; the members are required at `execute.ts:130-131` and `161`; `enableSignals` omits the staged facts at `execute.ts:156-159`). The IMP-05 enable case asserts the companion markers in its exact rendered text (`execute.test.ts:5107`). | closed |
| T-06-SC | Tampering | npm/pip/cargo installs | low | accept | No plan installs a package. `git diff --stat d98660a7..HEAD -- package.json package-lock.json` is empty. See R-06-03. | closed |

*Only open threats at or above the configured `high` threshold count in `threats_open`.*

The redaction and aliasing unit cases above were re-run at `9cdc6dc9` on Node v26.12.1. The test files were `test/orchestrators/import/execute.test.ts`, `test/orchestrators/reconcile/apply.test.ts`, `test/orchestrators/reconcile/plan.test.ts`, and `test/orchestrators/import/marketplaces.test.ts`, filtered to D-PL6-12, D-PL6-04, D-PL6-09, D-PL6-02, CR-01, MIM-03, `marketplaceSourceClaims`, `marketplaceClaimConflicts`, and MIM-02 / D-PL6-01. Result: 26 pass, 0 fail.

---

## Unregistered Flags

None. Every plan SUMMARY's `## Threat Flags` section reads "None", and the threats it names map to the register above.

---

## Advisories (non-blocking)

These notes come from reading the review-fix changes. None of them is a missing mitigation, and none counts toward `threats_open`.

1. **The feature-table projection no longer tells a cut path from a full path (IN-05, `features/lib/run-tokens.ts:80-87`, `126-128`).** `projectTokens` now maps a recorded error message to its token in two more forms: with each quoted path cut to its last segment, and with that path replaced by any path that ends in the same segment. In the import and apply scenarios that use an error token in a cause cell, the scenario therefore passes whether the row shows `'data.txt'` or `'/abs/path/data.txt'`. The redaction of T-06-10 and T-06-11 is still pinned, because the unit cases listed above assert the exact text. But a scenario alone would not catch a regression that leaks the full path.
2. **A conflicted-claim or mismatch cause repeats the configured sources (D-PL6-09 / WR-02, `execute.ts:1004-1019`).** The plugin-less mismatch row now shows `Existing marketplace source <recorded> does not match Claude settings source <settings>.` or `Claude settings source <settings> matches more than one recorded marketplace: …`. Both values are config text that the user wrote. The recorded source is in its logical form (`sourceLogical`, `plan.ts:381`), which is how `marketplace list` shows a source. They are not paths found at run time, so the T-55-02-02 redaction rule does not apply. A user who writes an absolute `directory` source sees it again in this row.
3. **Raw causes that predate this phase stay unredacted (outside the register).** The standalone `install` row shows its rollback phase causes as they are (`orchestrators/plugin/install.messaging.ts:216-219`). Import's marketplace add-failure arms pass `outcome.cause` and `errorMessage(err)` unchanged (`execute.ts:1404-1407`, `1429-1434`). The lock-held arm shows the lock path by design (IMP-07, `execute.ts:987-993`). All of these exist at `d98660a7`. D-PL6-01 sends more marketplaces through the add arm (unreferenced `extraKnownMarketplaces` entries), but the cause text is the one `marketplace add` already shows.

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| R-06-01 | T-06-03 | Feature-table output is test-only and stays inside the per-run sandbox. The projection replaces sandbox paths with tokens, and the sandbox reads no real home directory. | Project plan (06-01) | 2026-10-27 |
| R-06-02 | T-06-07 | Claude Code registers every `extraKnownMarketplaces` entry, and NFR-5 allows network for a git-source marketplace add. The add is visible as an `(added)` row, is declared in the config, and can be undone with `marketplace remove`. | Project plan (06-03) | 2026-10-27 |
| R-06-03 | T-06-SC | The phase installs no package. The manifests and the lockfile are unchanged since `d98660a7`. | Project plan (06-01..06-06) | 2026-10-27 |

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-10-27 | 14 | 14 | 0 | GSD security auditor, ASVS level 1 (boundary placement checked for T-06-04, T-06-05, T-06-08, T-06-10, T-06-11) |

---

## Sign-Off

- [x] All threats have a disposition.
- [x] Accepted risks are in the Accepted Risks Log.
- [x] `threats_open: 0` is confirmed.
- [x] `status: verified` is set in frontmatter.

**Approval:** Verified 2026-10-27.
