---
phase: 05-production-export-ownership
reviewed: 2026-09-14T16:33:00Z
depth: standard
diff_base: 80705c58c34f10fb810276669fc9ae8d9915aba0
files_reviewed: 56
files_reviewed_list:
  - eslint.config.js
  - extensions/pi-claude-marketplace/bridges/agents/convert.ts
  - extensions/pi-claude-marketplace/bridges/agents/frontmatter.ts
  - extensions/pi-claude-marketplace/bridges/agents/index.ts
  - extensions/pi-claude-marketplace/bridges/agents/marker.ts
  - extensions/pi-claude-marketplace/bridges/agents/stage.ts
  - extensions/pi-claude-marketplace/domain/auth-registry.ts
  - extensions/pi-claude-marketplace/domain/component-paths.ts
  - extensions/pi-claude-marketplace/domain/mcp-resolution.ts
  - extensions/pi-claude-marketplace/domain/plugin-resolver.ts
  - extensions/pi-claude-marketplace/domain/resolver-types.ts
  - extensions/pi-claude-marketplace/domain/unsupported-components.ts
  - extensions/pi-claude-marketplace/orchestrators/import/marketplaces.ts
  - extensions/pi-claude-marketplace/orchestrators/import/refs.ts
  - extensions/pi-claude-marketplace/orchestrators/import/settings.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/add.messaging.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/remove.messaging.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts
  - extensions/pi-claude-marketplace/shared/errors-bridges.ts
  - extensions/pi-claude-marketplace/shared/errors.ts
  - extensions/pi-claude-marketplace/shared/markers.ts
  - extensions/pi-claude-marketplace/shared/path-safety.ts
  - tests/architecture/gate-targets.ts
  - tests/architecture/hooks-foundation.test.ts
  - tests/architecture/sonar-test-rules.test.ts
  - tests/bridges/agents/convert.test.ts
  - tests/bridges/agents/frontmatter.test.ts
  - tests/bridges/agents/index.test.ts
  - tests/bridges/agents/marker.test.ts
  - tests/domain/auth-registry.test.ts
  - tests/domain/component-paths.test.ts
  - tests/domain/mcp-resolution.test.ts
  - tests/domain/plugin-resolver.test.ts
  - tests/domain/resolver-types.test.ts
  - tests/domain/unsupported-components.test.ts
  - tests/edge/handlers/plugin/enable-disable.test.ts
  - tests/edge/handlers/plugin/uninstall.test.ts
  - tests/integration/concurrent-install.test.ts
  - tests/integration/load-reconcile-race.test.ts
  - tests/orchestrators/import/execute.test.ts
  - tests/orchestrators/import/marketplaces.test.ts
  - tests/orchestrators/import/refs.test.ts
  - tests/orchestrators/import/settings.test.ts
  - tests/orchestrators/marketplace/add.messaging.test.ts
  - tests/orchestrators/marketplace/add.test.ts
  - tests/orchestrators/marketplace/remove.messaging.test.ts
  - tests/orchestrators/marketplace/shared.test.ts
  - tests/orchestrators/plugin/enable-disable.test.ts
  - tests/orchestrators/plugin/uninstall.test.ts
  - tests/orchestrators/reconcile/apply.test.ts
  - tests/shared/errors-bridges.test.ts
  - tests/shared/errors.test.ts
  - tests/shared/markers.test.ts
  - tests/shared/path-safety.test.ts
  - extensions/pi-claude-marketplace/shared/path-containment.ts
  - tests/shared/path-containment.test.ts
findings:
  critical: 0
  warning: 0
  info: 0
  total: 0
status: clean
scope_sha256: 3f5f1208ff3173548f2f1b39968ee4354d4d6155d7bb5f9be6fada208082350b
requirements_completed: []
---

# Phase 5 Wave 3: Code Review Report

## Narrative Findings (AI reviewer)

No actionable BLOCKER or WARNING was found in the submitted Wave 3 changes. This is a review of the changed behavior and assertion migrations in the exact 56-file scope, including the two new containment files. It is not a claim that the remaining Phase 5 backlog is closed.

The review compared the working tree with `80705c58`, followed affected production callers, checked the assertion dispositions for plans 03, 04, 10, 14 and 22, and independently challenged the census pins and resolver type contracts. Project instructions and both TypeScript review skills were applied. CodeGraph was consulted before locating production code; direct source and historical searches supplied omitted context.

## Census and ownership evidence

An independent TypeScript AST reader extracted both literal census pins from the base commit and current `tests/architecture/gate-targets.ts`. The complete production pin changes from **85 to 57**, with exactly the **28** identities below removed and **zero additions**. Its remaining identities equal the supplied analyzer report in `/tmp/test-backlog-wave3-census.json`. The separate unused-export pin changes from **68 to 44**, removing exactly the corresponding **24 unused-export identities** with zero additions. Each removed identity was independently checked for its current declaration/export status.

Paths in this table are relative to `extensions/pi-claude-marketplace/`. Each comma-separated name denotes a separate identity. All rows are `unused_exports` except the two explicitly marked `unused_types` rows.

| Original owner | Exact identities | Disposition checked against implementation and callers |
| --- | --- | --- |
| bridges/agents/convert.ts | MODEL_MAP, THINKING_VALUES, TOOL_MAP | Private declarations retain their real mapping reads through `convertAgent`; table values and freeze behavior are unchanged. |
| bridges/agents/frontmatter.ts | emitYamlScalar, sanitizeProvenanceValue | Private helpers remain called by the public generated-file writer and its provenance list writer. |
| bridges/agents/index.ts | GENERATED_AGENT_MARKER, GENERATED_AGENT_MARKER_LEGACY | Unused facade exports removed. Current marker still has its real defining-module writer consumer. |
| bridges/agents/marker.ts | GENERATED_AGENT_MARKER_LEGACY, GENERATED_AGENT_PREFIX | Private constants remain consumed by `isOwnedAgentFile`. |
| domain/auth-registry.ts | GITLAB_PROVIDER | Private provider remains in `PROVIDERS`, consumed by `findProviderForHost` and its real authentication caller. |
| domain/plugin-resolver.ts | resolveLoose | No production call existed at the base. Exclusive loose MCP/path collectors retire with that call chain. |
| domain/resolver-types.ts | ResolvedPluginSchema | Unconsumed runtime value becomes the private type shape of the existing public union. |
| domain/unsupported-components.ts | SUPPORTED_COMPONENT_KINDS, UNSUPPORTED_COMPONENT_KINDS | Unread supported tuple retires. Unsupported tuple remains private and drives the real ordered classifier and its type. |
| orchestrators/import/marketplaces.ts | planMarketplaceSourcesForRefs | Private helper remains called by `scopedPlan`, reached by `buildClaudeImportPlan` and import execution. |
| orchestrators/import/refs.ts | parseEnabledPluginRef | Private parser remains called by `extractEnabledPluginRefs`, used by the real plan builder. |
| orchestrators/import/settings.ts | mergeClaudeSettings, resolveClaudeSettingsPaths | Private helpers remain called by `loadMergedClaudeSettingsForScope`, used by import execution. |
| orchestrators/marketplace/shared.ts | resolveScopeFromState | Private helper remains called by `resolveScopeOrNotifyNotAdded`, used by update/remove. |
| shared/errors-bridges.ts | AgentForeignContentError | Unconstructed and unread production class retires; stage comment now describes its existing soft-failure result. |
| shared/errors.ts | ConcurrentUninstallError | Unconstructed and unread class retires. Live lock/error contracts remain. |
| shared/markers.ts | STATE_LOCK_HELD_PREFIX | Unread constant retires; live `StateLockHeldError` and independent integration message assertions remain. |
| shared/path-safety.ts | LexicalTraversalError, createPathSafetyGuard | Complete policy moves to `shared/path-containment.ts`; lexical subclass is private and the factory gains the actual Node adapter as consumer. |
| domain/resolver-types.ts (`unused_types`) | DroppedHookArmKeysCheck, DroppedHookDriftCheck | Private guards are consumed in the real `droppedHooks` schema field. |
| orchestrators/marketplace/add.messaging.ts; orchestrators/marketplace/remove.messaging.ts (`unused_types`) | AddPrivateReason; RemovePrivateReason | Neither alias constrained a production contract at the base; both unused subsets and their wrappers retire. |

Historical source searches confirm the retired loose resolver had no production caller, its two subordinate collectors had only the loose resolver as caller, and the retired errors, reason aliases and supported tuple had no production reader. Residual prose references do not constitute callers. The 57 remaining production findings stay pinned; the supplied report was compared, not treated as proof that a whole-project analyzer run occurred within this review.

## Assertion and boundary assessment

- Agent conversion replacements assert the complete converted object and independent emitted bytes for all three models, seven tools and six thinking values. Scalar and provenance rows preserve quote, empty-string and newline cases through complete public writer output. Current/legacy marker fixtures use independent literals; truncated prefix and marker negatives retain complete refusal results and unchanged file bytes. Retired object-freeze and barrel-binding checks concerned the removed private access.
- The six hook lifecycle changes only repoint `HooksRuntime` type imports to its defining module. Their runtime setup, assertions and operations are unchanged.
- Strict resolver stages retain component, MCP and hook evaluation order before structural precedence. Only loose-specific conflicts, refusal behavior and their exclusive assertions retire. Shared metadata, path order/deduplication, hooks, unsupported kinds and materializability checks remain. The hook-only architecture result is strengthened to a whole-object assertion.
- Import settings, ref parsing and source planning replacements assert complete public results, ordered diagnostics, scope information and skipped/installed records. Default settings paths use temporary roots, including the default cwd case. Scope-selection tests retain whole results and locations identity and add unchanged state-file bytes. The private missing-scope error is intentionally caught by the public wrapper; its retired constructor-shape assertions are replaced at that boundary by the existing exact notification/result contract.
- The add/remove reason aliases were never consumed by their rendering contracts. Complete add-outcome assignments now preserve the meaningful duplicate/stale reason membership checks and reject an unknown shared reason. Retiring the old add rejection of `plugins remain` does not widen the unchanged actual outcome type. Existing remove row-shape and renderer assertions remain.
- The containment factory and Node binding preserve lexical rejection before inspection, normalized fields, public parent-class identity, ordered segment inspection, symlink failures, unreadable targets, missing intermediate acceptance and propagation of unexpected lstat failures. Public adapter error re-exports retain the same defining class bindings. The policy's trusted parent boundary and documented TOCTOU assumptions are unchanged by this extraction.

## Independent checks executed

1. **Exact public type equality:** An in-memory TypeScript compiler host compared the actual base resolver schema with the current implementation, without writing source or temporary repository files. Generic exact equality passed for all nine contracts: `ResolvedPlugin`, `ResolvedPluginInstallable`, `ResolvedPluginPartiallyAvailable`, `ResolvedPluginUnavailable`, `MaterializablePlugin`, `ResolveContext`, `StatKind`, `StatKindReader`, and `GitPluginRootResult`.
2. **Current-source drift controls:** A second in-memory compiler experiment used the current source and real transitive imports. Unchanged source compiled; adding a source hook arm failed with TS2344 at line 41, adding an event-arm field failed at line 67, and adding a schema-only arm failed at line 42. Every failure originated in the intended guard, with no unrelated diagnostic.
3. **Genuine focused Node execution:** `node --test tests/shared/path-containment.test.ts tests/shared/path-safety.test.ts tests/domain/resolver-types.test.ts tests/architecture/sonar-test-rules.test.ts` ran through the authorized escalated path. It reported **42 passes**, zero failures/cancellations/skips/todos: **26 containment runtime cases, 15 Sonar controls, and one expected type-only file entry**. The type-only entry is not counted as a runtime assertion; the compiler proof above checks its contract.
4. **Both census pins:** Independent AST extraction and set comparison passed the exact 28-removal/zero-addition checks described above, including per-identity export/declaration checks.
5. **Patch hygiene:** `git diff --check 80705c58 -- eslint.config.js extensions/pi-claude-marketplace tests` passed.

The schema's one adjacent private-type-leak annotation was reviewed with the existing offending, benign and unrelated-sibling fixture sources and reports. The reports show the intended schema leak before suppression, no finding with the exact annotation, and the independent sibling leak still detected. This review did not rerun that analyzer fixture experiment. The global rule remains enabled. The only ESLint policy delta adds the ninth exact type-only owner; all fifteen independent Sonar controls passed. No production exclusion, coverage threshold, direct-coverage pin, runner gate or compiler setting is relaxed in the submitted scope.

## Limits and integration handoff

The parent owns whole-project typecheck/lint, native aggregate coverage, the complete direct-pair sweep, live whole-project analyzer execution, pre-commit and commits. This reviewer deliberately did not duplicate those expensive gates. Their final outcomes must be attached by the parent before accepting the wave; this report does not substitute focused passes for them.

The review is confined to the supplied 56-file Wave 3 change set. Unrelated working-tree settings, documentation and future-wave preparation are outside it. No tracked source, configuration, root planning state or Git index was changed by the reviewer. Only this review artifact was created. No commit was made. EXPORT-01 and EXPORT-02 remain open until the entire phase is complete. Actual token telemetry was unavailable and no diff-size token estimate is reported.

The scope hash is SHA-256 of newline-joined, sorted `path + NUL + SHA256(file bytes)` rows for the 56 submitted paths. A later source change requires rechecking the affected conclusions.


## Parent integration acceptance

After this independent review, the complete stable-wave gates passed: 6,238 unit tests with exact 100% production coverage, 234 direct pairs with unchanged pins, 43 analyzer/census controls, fifteen Sonar controls, and full pre-commit. Implementation is committed in `6a463603`. This supplements the review's explicit limits; it does not change its independent scope or verdict. See 05-WAVE-3-VERIFICATION.md for exact counts and logs.
