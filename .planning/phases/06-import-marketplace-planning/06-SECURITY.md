---
phase: 06-import-marketplace-planning
slug: import-marketplace-planning
status: verified
threats_open: 0
asvs_level: 1
block_on: high
register_authored_at_plan_time: true
audited_at: 0ea56531e157dabc4e4d7d5227f99178d6a8393a
source_commit: 0ea56531e157dabc4e4d7d5227f99178d6a8393a
base: d98660a7
created: 2026-10-27
updated: 2026-10-29
---

# Phase 6 - Security

> Final threat verification for import marketplace planning (milestone `plugin-lifecycle`). Every mitigation below was rechecked on the final merged tree at `0ea56531e157dabc4e4d7d5227f99178d6a8393a`, after the review fixes, SEC-06-01, and CR-01 diagnostic-redaction follow-up.

**Verdict:** SECURED — 14/14 threats closed; 11 mitigated and 3 documented accepted risks.

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
| T-06-08 | Tampering | A settings name resolves to the wrong recorded marketplace | high | mitigate | D-PL6-17/18 block installation under an absent settings name. `execute.ts:1638` records every plugin as `marketplace-not-added`; the unchanged-add arm also checks the returned canonical name at line 1404. Remaining config-name preservation uses the planner's one-to-one claims. Exact current regressions cover same-command reuse and canonical-only declarations. | closed |
| T-06-09 | Repudiation | A marketplace/add failure or reused-source failure is omitted | medium | mitigate | D-PL6-19 routes eligible source changes through re-add and shared failure bookkeeping. The unchanged-add branch records different-name reuse failures and preserves same-name plugin headers. `marketplaceBlocks` creates the failed header, and exact regressions assert error severity and tally. | closed |
| T-06-10 | Information disclosure | Import failure causes, rollback phases, and leaks expose paths | high | mitigate | Import rebuilds root and nested causes plus rollback phases through the shared redactor. SEC-06-01 is closed by `250acaad`: actual Node errno diagnostics with spaces, Unicode, `O'Brien`, `O' Brien`, two-path syscalls, UNC forms, nested causes, JSON serialization, and structured leaks reduce to basenames. CR-01 is closed by `2d258ae7`: state-read and config-write catches redact production `state.json at ...` and `Failed to read/write ...` forms before constructing returned diagnostics or notifications; exact owner and Cucumber regressions assert the absolute scope root is absent. | closed |
| T-06-11 | Information disclosure | Apply install/enable/move failure causes, phases, and leaks expose paths | high | mitigate | Apply rebuilds dependency, root, rollback, failed-enable, and failed-move causes through the shared redactor before notify/JSON projection. Exact TUI/JSON regressions cover install and enable recovery under a spaced Unicode `O' Brien` root; leaked resources remain basename-only. | closed |
| T-06-12 | Tampering | Splitting a dependency key into marketplace and plugin | low | mitigate | `dependencyRollbackOutcome` splits at `error.key.lastIndexOf("@")` (`apply.ts:495-499`). This is the same rule as `parsePluginKey` (`plan.ts:87-96`). | closed |
| T-06-13 | Tampering | Import enable rows after the outcome is narrowed | low | mitigate | `installedRow` rebuilds `stagedAgents`, `stagedMcpServers`, and `stagedWorkflows` from the required `declaresAgents`, `declaresMcp`, and `declaresWorkflows` members (`execute.ts:702-704`; the members are required at `execute.ts:130-131` and `161`; `enableSignals` omits the staged facts at `execute.ts:156-159`). The IMP-05 enable case asserts the companion markers in its exact rendered text (`execute.test.ts:5107`). | closed |
| T-06-SC | Tampering | npm/pip/cargo installs | low | accept | No plan installs a package. `git diff --stat d98660a7..HEAD -- package.json package-lock.json` is empty. See R-06-03. | closed |

*Only open threats at or above the configured `high` threshold count in `threats_open`.*

The final independent audit passed 131 read-only assertions over actual Node diagnostics, cause/rollback/JSON projections, UNC strings, exclusions, and both one- and two-path errno forms. The redactor owner suite also passed. Fresh `npm run check` at the exact source passed all static checks, 1,125 scenarios, 11,467 steps, and 309 direct-coverage records.

## SEC-06-01 Disposition

Closed by `250acaadf15622a66ee80b5e3443ad96be908016`. The preceding audit found that an internal apostrophe terminated a single-quoted Node errno path early and left parent directories visible. The final parser recognizes Node errno path fields, keeps internal apostrophes (including apostrophe-space) inside the path, and treats `' -> '` as a two-path separator only for Node's two-path syscalls. A literal `' -> '` inside an `open` path remains one path. Generic prose retains conservative boundaries.

---

## Unregistered Flags

None. Every plan SUMMARY's `## Threat Flags` section reads "None", and the threats it names map to the register above.

---

## Advisories (non-blocking)

These notes come from reading the review-fix changes. None of them is a missing mitigation, and none counts toward `threats_open`.

1. **The feature-table projection no longer tells a cut path from a full path (IN-05, `features/lib/run-tokens.ts:80-87`, `126-128`).** `projectTokens` now maps a recorded error message to its token in two more forms: with each quoted path cut to its last segment, and with that path replaced by any path that ends in the same segment. In the import and apply scenarios that use an error token in a cause cell, the scenario therefore passes whether the row shows `'data.txt'` or `'/abs/path/data.txt'`. The redaction of T-06-10 and T-06-11 is still pinned, because the unit cases listed above assert the exact text. But a scenario alone would not catch a regression that leaks the full path.
2. **A conflicted-claim or mismatch cause repeats the configured sources (D-PL6-09 / WR-02, `execute.ts:1004-1019`).** The plugin-less mismatch row now shows `Existing marketplace source <recorded> does not match Claude settings source <settings>.` or `Claude settings source <settings> matches more than one recorded marketplace: …`. Both values are config text that the user wrote. The recorded source is in its logical form (`sourceLogical`, `plan.ts:381`), which is how `marketplace list` shows a source. They are not paths found at run time, so the T-55-02-02 redaction rule does not apply. A user who writes an absolute `directory` source sees it again in this row.
3. **Parsing boundary.** Full quote-space handling follows Node errno grammar. Arbitrary free-form prose is inherently ambiguous and retains conservative path boundaries. UNC behavior is verified through platform-independent diagnostics and structured leak values, not a Windows filesystem run.

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
| 2026-10-29 | 14 | 12 | 2 | Fresh re-audit at `a04c4756`; SEC-06-01 opened T-06-10/T-06-11 |
| 2026-10-29 | 14 | 14 | 0 | Final independent re-audit at `250acaad`; 131 diagnostic/projection assertions |
| 2026-10-29 | 14 | 14 | 0 | Final merged-tree ASVS L1 re-audit at `59e5075b`; 11/11 mitigations verified, 3/3 accepted risks logged, no unregistered flags; exact green gate reused (1,142 scenarios, 11,734 steps, 309 LCOV records) |
| 2026-10-29 | 14 | 14 | 0 | Post-CR-01 merged-tree ASVS L1 re-audit at `0ea56531`; diagnostic disclosure closed by `2d258ae7`; returned data and all transports receive redacted text; fresh gate green (1,143 scenarios, 11,742 steps, 309 LCOV records) |

---

## Sign-Off

- [x] All threats have a disposition.
- [x] Accepted risks are in the Accepted Risks Log.
- [x] `threats_open: 0` is confirmed.
- [x] `status: verified` is set in frontmatter.

**Approval:** SECURED 2026-10-29 at `0ea56531e157dabc4e4d7d5227f99178d6a8393a`.
