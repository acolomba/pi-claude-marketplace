---
phase: 05
slug: production-export-ownership
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-09-14
---

# Phase 5 Validation Strategy

This validates the executable plan set. Production implementation has not run. The leading 05-01 tracer creates the new instrument; existing public owner tests provide the other task checks.

## Baseline and Discovery

- Requirements: EXPORT-01 and EXPORT-02. Preserve 100% aggregate production unit coverage, assertion strength, and the distinct direct-pair requirements.
- Discovery: existing codebase patterns plus focused installed-version verification. CodeGraph was used before source exploration. No new dependencies or package installation.
- Installed Fallow 3.22.0, report schema 9: a temporary production-dead-code project kept includeEntryExports:true and one adjacent unused-export annotation on the manifest-loaded default. A same-entry stray export plus a helper read only by its test produced exactly those two findings, exit 1. Removing the two offenders produced zero issues, one discovered production entry, exit 0.
- This rejects the research recommendation to disable entry export analysis. The exact local annotation is sufficient; no production file is excluded.
- The historical hub-ledger test passed during planning. Package/workflow/production references are absent; archived references remain historical evidence.
- Calibration returned factor 1, sample_count 0 and confidence low. Plan estimates use that factor and confidence.
- The legacy 111-finding census is a planning snapshot. The executable baseline is measured after Phase 4; no gate freezes 111 or 93.

## Wave Structure and Parent-Owned Reconciliation

| Wave | Disjoint plans | Integration owner |
| --- | --- | --- |
| 1 | 05-01 | Parent reconciliation W1 |
| 2 | 05-02, 05-06, 05-08, 05-09, 05-13 | Parent reconciliation W2 |
| 3 | 05-03, 05-04, 05-10, 05-14, 05-22 | Parent reconciliation W3 |
| 4 | 05-05, 05-11 | Parent reconciliation W4 |
| 5 | 05-07, 05-12, 05-24 | Parent reconciliation W5 |
| 6 | 05-15, 05-19, 05-23, 05-25 | Parent reconciliation W6 |
| 7 | 05-16, 05-26 | Parent reconciliation W7 |
| 8 | 05-17, 05-27 | Parent reconciliation W8 |
| 9 | 05-18, 05-20 | Parent reconciliation W9 |
| 10 | 05-21 | Parent reconciliation W10 |
| 11 | 05-28 | Parent reconciliation W11 |

The parent owns tests/architecture/gate-targets.ts after each wave except the initial/final plan-owned transition. This ownership is an explicit orchestration task, not an implicit permission for parallel executors to write the pin.

For each wave W1 through W11:

1. Wait for every source-writing plan in the wave to finish. Inspect its summary's exact finding identities and old-to-public assertion mapping. Resolve an omitted assertion, unexpected transitive finding, or undeclared owner before advancing.
2. Run `node node_modules/fallow/bin/fallow dead-code --production --no-cache --format json` on the stable checkout. Compare the complete normalized identity set with the prior pin. Update only reviewed deltas in gate-targets.ts; an unexpected addition/removal/swap is a failure, not permission to refresh expectations.
3. Run `node --test tests/architecture/unowned-exports-census.test.ts tests/architecture/fallow-production-mode.test.ts tests/architecture/no-test-only-production-surface.test.ts`. The first two retain launch-error, signal, malformed-report, exact-identity, offender and benign assertions.
4. Run `npm run typecheck` and `npm run test:coverage:unit` after each stable wave containing production changes. Confirm production-only unit totals and unchanged assertion strength. Reuse that result for the wave; do not run the aggregate suite separately for each minor plan. Run the changed direct pairs (or direct all-pairs after a shared contract change) and preserve the current pin.
5. Record the measured delta, command exits and production coverage in the wave handoff. Advance only after the complete expected census and 100% aggregate production unit coverage agree. Unit execution and whole-tree measurement must not overlap source edits.

The final 05-28 transition removes the temporary known findings from the pin, validates the shipping command without forced production flags, runs `npm run test:coverage:direct:all`, `npm run test:coverage:unit`, and `npm run check`, and closes FLOW-09 with current evidence.

## Automated Coverage

| Obligation | Automated check | First owner |
| --- | --- | --- |
| Full current finding census and exact drift | `node tests/architecture/unowned-exports-census.test.ts` | 05-01 |
| Offender/benign cases for unused values/types/files/members and duplicate exports | `node --test tests/architecture/fallow-production-mode.test.ts` | 05-01 |
| Entry and member exceptions remain narrow | Same control file, plus `node --test tests/index.test.ts` and ring-buffer owner | 05-05, 05-28 |
| Public operation behavior and assertion preservation | Every task's exact `node --test` command | Each declared owner |
| Closed vocabulary, field and hook-arm proofs | `npm run typecheck` with positive and negative public type cases | 05-10, 05-11, 05-14, 05-23 |
| Explicit seams remain closed | `node --test tests/architecture/no-test-only-production-surface.test.ts` | Every wave |
| Legitimate type-only owner transition retains Sonar controls | `node --test tests/architecture/sonar-test-rules.test.ts` plus lint | 05-28 |
| Mirrored ownership and direct coverage | `npm run test:corresponding`, changed direct pairs, then direct all-pairs | Each wave and 05-28 |
| Production aggregate unit coverage remains 100% | `npm run test:coverage:unit`; inspect all production LCOV records and exact LF/LH, FNF/FNH, BRF/BRH totals | Parent per stable source wave |
| Complete quality gate and final closure | `npm run check` | 05-28 |

All controls use temporary roots, fixed argument vectors, guaranteed cleanup and no external services. Prefer the Phase 1 file-descriptor child-output pattern where Node 26 nested pipes lose output. An EPERM, launch error, non-normal exit or missing JSON is a failed instrument, never an empty clean report.

## Multi-Source Coverage Audit

| Source | ID | Requirement or constraint | Plans | Status |
| --- | --- | --- | --- | --- |
| GOAL | Phase 5 | Every current production finding has an evidence-backed disposition and public-contract tests | 05-01 through 05-28 | COVERED |
| REQ | EXPORT-01 | Triage current and transitive findings; remove ordinary test-only exports with coherent ownership | 05-02 through 05-27 | COVERED |
| REQ | EXPORT-02 | Production-mode enforcement and preserved explicit-seam protections | 05-01, 05-28 and every wave | COVERED |
| CONTEXT | D-01 | 100% aggregate unit coverage, exact assertions, distinct direct pair pin | All plans and wave task | COVERED |
| CONTEXT | D-02 | Fresh complete inventory after prior phases | 05-01, 05-28 and wave task | COVERED |
| CONTEXT | D-03 | Private helpers, real composition consumers, coherent concern splits | 05-02 through 05-27 | COVERED |
| CONTEXT | D-04 | Preserve lifecycle seams and Phase 3/4 contracts | All source plans | COVERED |
| CONTEXT | D-05 | Per-analysis production mode and retained entry analysis | 05-01, 05-28 | COVERED |
| CONTEXT | D-06 | Only exact proven entry/member annotations; no blanket settings | 05-05, 05-24 through 05-28 | COVERED |
| CONTEXT | D-07 | Five value contracts and six compile-time proofs retain their protection | 05-10, 05-11, 05-14, 05-23 | COVERED |
| CONTEXT | D-08 | Discriminating all-category control pairs and report validation | 05-01, 05-28 | COVERED |
| CONTEXT | D-09 | Factual script retirement and preserved archives | 05-28 | COVERED |
| CONTEXT | D-10 | Exact reviewed census updates once per stable wave | Parent wave task, 05-01, 05-28 | COVERED |
| RESEARCH | Composition | Twelve semantic factories retain real owners without twelve new modules | 05-05, 05-07, 05-15 through 05-22 | COVERED |
| RESEARCH | Callback protocol | Entire git auth callback concern, exact cancellation/rejection/redaction | 05-21 | COVERED |
| RESEARCH | Duplicates | One shared assertNever; distinct semantic type names; event-specific callback exports | 05-06, 05-11, 05-24 through 05-27 | COVERED |
| RESEARCH | Gate settings | Keep all current boundaries/rules and health/dupes test scope; no installs | 05-28 | COVERED |
| RESEARCH | Type-aware timeout | Use verified ordinary Fallow, compiler proofs and actual caller evidence; do not depend on the timed-out optional sidecar | All relevant plans | COVERED |
| RESEARCH | Entry recommendation correction | Exact annotation replaces the proposed includeEntryExports:false workaround, preserving stronger detection | 05-01, 05-28 | COVERED |
| RESEARCH | Transitive retirement | Uncalled loose MCP resolver, git wrappers, legacy bridge parser and orphan errors are retired with caller evidence; no artificial consumers | 05-08, 05-10, 05-21, 05-22 | COVERED |

The following rows map every identity in the research snapshot. Where a declaration's owner is touched in more than one plan, the task text determines which plan removes visibility or retires it; all listed plans preserve its contract through the sequence.

| Source | Finding identity | Production owner | Plans | Status |
| --- | --- | --- | --- | --- |
| RESEARCH | unused_files: file | scripts/check-phase-06-hub-ledger.mjs | 05-28 | COVERED |
| RESEARCH | unused_exports: MODEL_MAP | bridges/agents/convert.ts | 05-03 | COVERED |
| RESEARCH | unused_exports: TOOL_MAP | bridges/agents/convert.ts | 05-03 | COVERED |
| RESEARCH | unused_exports: THINKING_VALUES | bridges/agents/convert.ts | 05-03 | COVERED |
| RESEARCH | unused_exports: GENERATED_AGENT_MARKER | bridges/agents/frontmatter.ts | 05-03 | COVERED |
| RESEARCH | unused_exports: emitYamlScalar | bridges/agents/frontmatter.ts | 05-03 | COVERED |
| RESEARCH | unused_exports: sanitizeProvenanceValue | bridges/agents/frontmatter.ts | 05-03 | COVERED |
| RESEARCH | unused_exports: GENERATED_AGENT_MARKER | bridges/agents/index.ts | 05-03 | COVERED |
| RESEARCH | unused_exports: GENERATED_AGENT_MARKER_LEGACY | bridges/agents/index.ts | 05-03 | COVERED |
| RESEARCH | unused_exports: GENERATED_AGENT_PREFIX | bridges/agents/marker.ts | 05-03 | COVERED |
| RESEARCH | unused_exports: GENERATED_AGENT_MARKER_LEGACY | bridges/agents/marker.ts | 05-03 | COVERED |
| RESEARCH | unused_exports: ASYNC_REWAKE_PIDS_FILENAME | bridges/hooks/async-rewake/pid-table.ts | 05-05 | COVERED |
| RESEARCH | unused_exports: ASYNC_REWAKE_PID_TABLE_VERSION | bridges/hooks/async-rewake/pid-table.ts | 05-05 | COVERED |
| RESEARCH | unused_exports: MARKER_ENV | bridges/hooks/async-rewake/registry.ts | 05-05 | COVERED |
| RESEARCH | unused_exports: createBeforeAgentStartHandler | bridges/hooks/event-router.ts | 05-05 | COVERED |
| RESEARCH | unused_exports: compileBashGlob | bridges/hooks/if-field/index.ts | 05-06 | COVERED |
| RESEARCH | unused_exports: compilePathGlob | bridges/hooks/if-field/index.ts | 05-06 | COVERED |
| RESEARCH | unused_exports: compilePowerShellGlob | bridges/hooks/if-field/index.ts | 05-06 | COVERED |
| RESEARCH | unused_exports: bashSubcommandFires | bridges/hooks/if-field/index.ts | 05-06 | COVERED |
| RESEARCH | unused_exports: parseBashSubcommands | bridges/hooks/if-field/index.ts | 05-06 | COVERED |
| RESEARCH | unused_exports: compilePowerShellRule | bridges/hooks/if-field/index.ts | 05-06 | COVERED |
| RESEARCH | unused_exports: parsePowerShellSubcommands | bridges/hooks/if-field/index.ts | 05-06 | COVERED |
| RESEARCH | unused_exports: powerShellSubcommandFires | bridges/hooks/if-field/index.ts | 05-06 | COVERED |
| RESEARCH | unused_exports: hookConfigPathFor | bridges/hooks/stage.ts | 05-07 | COVERED |
| RESEARCH | unused_exports: createWriteHookConfig | bridges/hooks/stage.ts | 05-07 | COVERED |
| RESEARCH | unused_exports: MCP_COLLISION_SLOTS | bridges/mcp/collision-slots.ts | 05-09 | COVERED |
| RESEARCH | unused_exports: resolvePluginMcpServers | bridges/mcp/index.ts | 05-08 | COVERED |
| RESEARCH | unused_exports: readMarker | bridges/mcp/marker.ts | 05-09 | COVERED |
| RESEARCH | unused_exports: parseMcpServers | bridges/mcp/parse.ts | 05-08 | COVERED |
| RESEARCH | unused_exports: resolvePluginMcpServers | bridges/mcp/parse.ts | 05-08 | COVERED |
| RESEARCH | unused_exports: MalformedMcpServersError | bridges/mcp/stage.ts | 05-08 | COVERED |
| RESEARCH | unused_exports: deepSubstitute | bridges/mcp/substitute.ts | 05-08 | COVERED |
| RESEARCH | unused_exports: createUnstagePluginSkills | bridges/skills/unstage.ts | 05-07 | COVERED |
| RESEARCH | unused_exports: GITLAB_PROVIDER | domain/auth-registry.ts | 05-10 | COVERED |
| RESEARCH | unused_exports: HOOKS_CONFIG_SCHEMA | domain/components/hooks/schema.ts | 05-11 | COVERED |
| RESEARCH | unused_exports: HOOKS_CONFIG_SCHEMA | domain/components/hooks.ts | 05-11 | COVERED |
| RESEARCH | unused_exports: HOOKS_VALIDATOR | domain/components/hooks.ts | 05-11 | COVERED |
| RESEARCH | unused_exports: resolveLoose | domain/plugin-resolver.ts | 05-10 | COVERED |
| RESEARCH | unused_exports: ResolvedPluginSchema | domain/resolver-types.ts | 05-10 | COVERED |
| RESEARCH | unused_exports: SUPPORTED_COMPONENT_KINDS | domain/unsupported-components.ts | 05-10 | COVERED |
| RESEARCH | unused_exports: UNSUPPORTED_COMPONENT_KINDS | domain/unsupported-components.ts | 05-10 | COVERED |
| RESEARCH | unused_exports: buildItem | edge/completions/data.ts | 05-13 | COVERED |
| RESEARCH | unused_exports: getPluginToMarketplacesMap | edge/completions/data.ts | 05-13 | COVERED |
| RESEARCH | unused_exports: CATALOG_VERBS | edge/flag-catalog.ts | 05-13 | COVERED |
| RESEARCH | unused_exports: parseFetchTarget | edge/handlers/plugin/fetch.ts | 05-13 | COVERED |
| RESEARCH | unused_exports: projectRowStatus | edge/handlers/tools.ts | 05-13 | COVERED |
| RESEARCH | unused_exports: TOP_LEVEL_USAGE | edge/router.ts | 05-13 | COVERED |
| RESEARCH | unused_exports: MARKETPLACE_USAGE | edge/router.ts | 05-13 | COVERED |
| RESEARCH | unused_exports: default | index.ts | 05-28 | COVERED |
| RESEARCH | unused_exports: planMarketplaceSourcesForRefs | orchestrators/import/marketplaces.ts | 05-14 | COVERED |
| RESEARCH | unused_exports: parseEnabledPluginRef | orchestrators/import/refs.ts | 05-14 | COVERED |
| RESEARCH | unused_exports: resolveClaudeSettingsPaths | orchestrators/import/settings.ts | 05-14 | COVERED |
| RESEARCH | unused_exports: mergeClaudeSettings | orchestrators/import/settings.ts | 05-14 | COVERED |
| RESEARCH | unused_exports: resolveScopeFromState | orchestrators/marketplace/shared.ts | 05-14 | COVERED |
| RESEARCH | unused_exports: createSetPluginEnabled | orchestrators/plugin/enable-disable.ts | 05-16 | COVERED |
| RESEARCH | unused_exports: createFetchPlugins | orchestrators/plugin/fetch.ts | 05-18 | COVERED |
| RESEARCH | unused_exports: createGetPluginInfo | orchestrators/plugin/info.ts | 05-18 | COVERED |
| RESEARCH | unused_exports: createInstallPlugin | orchestrators/plugin/install-flow.ts | 05-15 | COVERED |
| RESEARCH | unused_exports: narrowResolverReasons | orchestrators/plugin/install.messaging.ts | 05-19 | COVERED |
| RESEARCH | unused_exports: createReinstallPlugin | orchestrators/plugin/reinstall-flow.ts | 05-17 | COVERED |
| RESEARCH | unused_exports: replaceReinstalledPlugin | orchestrators/plugin/reinstall-replace.ts | 05-19 | COVERED |
| RESEARCH | unused_exports: rollbackReinstalledPlugin | orchestrators/plugin/reinstall-replace.ts | 05-19 | COVERED |
| RESEARCH | unused_exports: finalizeReinstalledPlugin | orchestrators/plugin/reinstall-replace.ts | 05-19 | COVERED |
| RESEARCH | unused_exports: runPostSuccessMaintenance | orchestrators/plugin/reinstall-replace.ts | 05-19 | COVERED |
| RESEARCH | unused_exports: outcomeToPluginMessage | orchestrators/plugin/reinstall.messaging.ts | 05-19 | COVERED |
| RESEARCH | unused_exports: createUninstallPlugin | orchestrators/plugin/uninstall.ts | 05-16 | COVERED |
| RESEARCH | unused_exports: collectBinDirs | orchestrators/plugin-path.ts | 05-19 | COVERED |
| RESEARCH | unused_exports: createApplyReconcile | orchestrators/reconcile/apply.ts | 05-20 | COVERED |
| RESEARCH | unused_exports: scanForceInstalledBackfills | orchestrators/reconcile/backfill.ts | 05-20 | COVERED |
| RESEARCH | unused_exports: PENDING_STATUSES | orchestrators/reconcile/reconcile.messaging.ts | 05-20 | COVERED |
| RESEARCH | unused_exports: CONFIG_VALIDATOR | persistence/config-io.ts | 05-12 | COVERED |
| RESEARCH | unused_exports: PLUGIN_INSTALL_RECORD_SCHEMA | persistence/state-io.ts | 05-12 | COVERED |
| RESEARCH | unused_exports: STATE_SCHEMA | persistence/state-io.ts | 05-12 | COVERED |
| RESEARCH | unused_exports: STATE_VALIDATOR | persistence/state-io.ts | 05-12 | COVERED |
| RESEARCH | unused_exports: createCredentialOps | platform/git-credential.ts | 05-21 | COVERED |
| RESEARCH | unused_exports: listBranches | platform/git.ts | 05-21 | COVERED |
| RESEARCH | unused_exports: listRemotes | platform/git.ts | 05-21 | COVERED |
| RESEARCH | unused_exports: buildAuthCallbacks | platform/git.ts | 05-21 | COVERED |
| RESEARCH | unused_exports: hasLoadedPiSubagents | platform/pi-api.ts | 05-09 | COVERED |
| RESEARCH | unused_exports: hasLoadedPiMcpAdapter | platform/pi-api.ts | 05-09 | COVERED |
| RESEARCH | unused_exports: MARKETPLACE_NAMES_CACHE_SCHEMA | shared/completion-cache.ts | 05-12 | COVERED |
| RESEARCH | unused_exports: PLUGIN_INDEX_CACHE_SCHEMA | shared/completion-cache.ts | 05-12 | COVERED |
| RESEARCH | unused_exports: AgentForeignContentError | shared/errors-bridges.ts | 05-22 | COVERED |
| RESEARCH | unused_exports: ConcurrentUninstallError | shared/errors.ts | 05-22 | COVERED |
| RESEARCH | unused_exports: STATE_LOCK_HELD_PREFIX | shared/markers.ts | 05-22 | COVERED |
| RESEARCH | unused_exports: emitWithSummary | shared/notification-dispatch.ts | 05-23 | COVERED |
| RESEARCH | unused_exports: ICON_REMOTE | shared/notification-grammar.ts | 05-23 | COVERED |
| RESEARCH | unused_exports: ICON_PARTIALLY_AVAILABLE | shared/notification-grammar.ts | 05-23 | COVERED |
| RESEARCH | unused_exports: REASONS | shared/notification-types.ts | 05-23 | COVERED |
| RESEARCH | unused_exports: STATUS_TOKENS | shared/notification-types.ts | 05-23 | COVERED |
| RESEARCH | unused_exports: PLUGIN_STATUSES | shared/notification-types.ts | 05-23 | COVERED |
| RESEARCH | unused_exports: MARKETPLACE_STATUSES | shared/notification-types.ts | 05-23 | COVERED |
| RESEARCH | unused_exports: LexicalTraversalError | shared/path-safety.ts | 05-22 | COVERED |
| RESEARCH | unused_exports: createPathSafetyGuard | shared/path-safety.ts | 05-22 | COVERED |
| RESEARCH | unused_types: HooksFileReader | bridges/hooks/index.ts | 05-05 | COVERED |
| RESEARCH | unused_types: HooksHydration | bridges/hooks/index.ts | 05-05 | COVERED |
| RESEARCH | unused_types: HooksHydrationDeps | bridges/hooks/index.ts | 05-05 | COVERED |
| RESEARCH | unused_types: ReadAndCachePluginHooksOptions | bridges/hooks/index.ts | 05-05 | COVERED |
| RESEARCH | unused_types: HooksRuntime | bridges/hooks/index.ts | 05-05 | COVERED |
| RESEARCH | unused_types: _BucketAEventsCoverageProof | domain/components/hook-events.ts | 05-11 | COVERED |
| RESEARCH | unused_types: DroppedHookDriftCheck | domain/resolver-types.ts | 05-10 | COVERED |
| RESEARCH | unused_types: DroppedHookArmKeysCheck | domain/resolver-types.ts | 05-10 | COVERED |
| RESEARCH | unused_types: AddPrivateReason | orchestrators/marketplace/add.messaging.ts | 05-14 | COVERED |
| RESEARCH | unused_types: RemovePrivateReason | orchestrators/marketplace/remove.messaging.ts | 05-14 | COVERED |
| RESEARCH | unused_types: EnabledPluginRecord | persistence/state-io.ts | 05-12 | COVERED |
| RESEARCH | unused_types: _ReasonsCoverageProof | shared/notify-reasons.ts | 05-23 | COVERED |
| RESEARCH | unused_class_members: read | bridges/hooks/async-rewake/ring-buffer.ts | 05-05 | COVERED |
| RESEARCH | duplicate_exports: CompileIfPredicateContext | bridges/hooks/if-field/index.ts, domain/components/hooks.ts | 05-11 | COVERED |
| RESEARCH | duplicate_exports: ToolEvent | domain/components/hook-events.ts, shared/concerns/hooks.ts | 05-11 | COVERED |
| RESEARCH | duplicate_exports: assertNever | bridges/hooks/exec-result.ts, shared/errors.ts | 05-06, 05-22 | COVERED |
| RESEARCH | duplicate_exports: translate | bridges/hooks/payloads/post-compact.ts, bridges/hooks/payloads/post-tool-use-failure.ts, bridges/hooks/payloads/post-tool-use.ts, bridges/hooks/payloads/pre-compact.ts, bridges/hooks/payloads/pre-tool-use.ts, bridges/hooks/payloads/session-end.ts, bridges/hooks/payloads/session-start.ts, bridges/hooks/payloads/stop-failure.ts, bridges/hooks/payloads/stop.ts, bridges/hooks/payloads/user-prompt-submit.ts | 05-24, 05-25, 05-26, 05-27 | COVERED |

No source item is missing. Phase 6 interface-member analysis and Phase 7 coverage conversion/CRAP policy are separate roadmap obligations, not Phase 5 deferrals.

## Verification Status

- Planning: all task paths grounded against the checkout or explicitly created in their owning plan.
- Planned source modifications: maximum 14 files per plan; maximum 5 files per task.
- Parallelism: zero shared modified/deleted files inside a wave; shared source/test/composition owners form dependencies.
- Execution: pending. Tests cited as planning evidence are only the Fallow temporary probes and the historical hub-ledger test; full coverage and final gates must be measured during execution.


## Plan Review Revisions

The checker found no blockers. Every task now has an explicit failing direction. Every plan requires a per-task assertion ledger linking old assertions to the public result/error/state/byte proof and its focused/direct coverage. The 10–14 file batches remain coherent owners, split into tasks of at most five files; the ledger is required before each batch completes.
