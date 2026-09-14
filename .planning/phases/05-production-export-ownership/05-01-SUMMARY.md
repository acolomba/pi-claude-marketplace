---
phase: 05-production-export-ownership
plan: "01"
subsystem: architecture-tests
tags: [fallow, production-reachability, export-ownership, census]
status: pending-verification
requires:
  - phase: 03-reachable-agent-collision-contract
    provides: Full source agent names and collision ownership contract
  - phase: 04-strict-command-arguments
    provides: Verified 19-verb command catalog and shared argument contract
provides:
  - Real production Fallow offender and benign controls
  - Complete exact production finding census with a shared validated instrument
affects: [05-production-export-ownership]
tech-stack:
  added: []
  patterns: [isolated-filesystem-analyzer-controls, separate-subprocess-output-descriptors]
key-files:
  created:
    - tests/architecture/fallow-production-mode.test.ts
    - tests/architecture/fallow-report.ts
  modified:
    - tests/architecture/unowned-exports-census.test.ts
    - tests/architecture/gate-targets.ts
    - .planning/phases/05-production-export-ownership/05-01-PLAN.md
key-decisions:
  - Share one validated subprocess and report instrument between the census and its real controls.
  - Pin stable category, path, symbol/member and duplicate locations; omit unstable source coordinates.
  - Reject unknown nonzero finding categories rather than silently dropping new analyzer findings.
  - Preserve the historical 93-value census alongside the complete 111-finding pin.
duration: 20m
completed: 2026-09-14
plan_head_before: bcd2c0453877011d3da286d0e9de54340e07e866
actuals:
  tasks: 2
  commits: 0
---

# Phase 5 Plan 1: Complete production finding gate summary

Fifteen real Fallow fixture controls and six instrument-failure controls calibrate an exact 111-finding production census without relying on production findings remaining nonempty.

## Completion and commit ownership

Both implementation tasks are finished. Source and test writes are frozen for independent review. The parent owns aggregate verification, final precommit, commits, and root planning updates. This summary remains pending verification until those gates finish; the executor created no commits. The measured commit count from the recorded base is zero.

Phase 4's passed verification artifact and its completed source work were present before execution. CodeGraph traced the existing census, registry, and shared source-scan entry point before changes.

## Delivered behavior

The installed Fallow launcher analyzes isolated temporary projects cloned from the repository configuration. Fixtures override only the entry and production dead-code mode. Each run uses fixed argument arrays, no shell, no cache, JSON output, and fail-on-issues. Separate stdout and stderr descriptors preserve valid JSON despite analyzer diagnostic warnings and nested Node execution. Every temporary directory and opened output descriptor is cleaned on success or failure.

Real fixtures distinguish test-only versus production readers for values, types, files, and class members; same-named live exports versus distinct names; the exact adjacent entry-default annotation versus a stray named export and an unrelated default; and the exact local member annotation versus an unrelated read member. Complete normalized identities, issue totals, exactly one discovered fixture entry, and expected exit status are asserted. The common reader rejects launch errors, signals, invalid exit status, empty/malformed JSON, wrong kind/schema, missing categories or identity fields, inconsistent counts, duplicate identities, and unnormalized nonzero categories.

The production pin covers 93 unused values, 12 unused types, one unused file, one unused member, and four duplicate-export groups. The existing value-only pin and every historical disposition row assertion remain. Shipping and production measurements retain the current clean shipping observation while accepting matching complete reports once production entry points become the shipping setting.

## Assertion ledger

| Original test or contract | Replacement or retained observable assertions | Evidence |
| --- | --- | --- |
| Value census exact equality and detailed addition/removal diagnostics | Retained complete per-path name comparison against UNOWNED_EXPORT_CENSUS and original detailed drift message | Focused suite passes |
| Nonempty production value set used as an instrument check | Replaced with real offender/benign analyzer runs that still discriminate when the reviewed production census becomes empty | Fifteen real fixture cases pass |
| Subprocess launch, signal, and status checks | Shared runner retains absent launch-error/null-signal/allowed-exit checks; adds issue-count-to-status agreement and separate output descriptors | Six negative instrument cases plus all real fixtures pass |
| Unchecked JSON report cast | Runtime kind/schema, entry discovery, category, field, count, and unique-identity validation | Empty, malformed, wrong-kind, wrong-schema, missing-launcher, and signal controls pass |
| Value-only measured population | Full exact category/path/symbol/member/location comparison; old value pin remains compatible | All 111 identities match; no additions, removals, or swaps from research baseline |
| Addition/removal/swap rejection | Dedicated controls call the same canonical census comparison used by the live gate and assert complete structured comparison errors | Three drift controls pass |
| Shipping clean total, empty export list, and strictly more entries | In the current broader shipping entry branch, retain zero total and strengthen empty exports to all empty normalized findings; matching production entry counts require complete finding equality | Shipping comparison passes |
| Historical routed disposition rows | Original sixteen IDs, row parser, statuses, nonempty cells, and complete unanswered-list assertion retained | Disposition test passes |
| Registry resolution and literal-path obligations | New fixture path group names three existing real paths; complete pin remains object-shaped so identity lists are not mistaken for path groups | Fifteen registry checks pass |

No production operation, public export, source-test pairing, threshold, exclusion, or coverage seam changed. Direct production coverage runs are not applicable to this test-support-only plan. Aggregate production coverage remains the parent's required stable-wave gate.

## Verification

- `node --test tests/architecture/fallow-production-mode.test.ts tests/architecture/unowned-exports-census.test.ts tests/architecture/gate-targets.test.ts`: **43/43 passed**, zero skipped/cancelled/todo; 15 real fixtures, six instrument negatives, seven census checks, and 15 registry checks. Log: `/tmp/phase5-01-focused-final.log`.
- Earlier focused iteration: **42/42 passed**, before adding an independent wrong-schema control.
- `npm run typecheck`: passed, including the final post-format invocation; log: `/tmp/phase5-01-typecheck-final.log`.
- Scoped ESLint on all four architecture files: passed with no diagnostics. Log: `/tmp/phase5-01-eslint-final.log`.
- Prettier wrote all four owned architecture files successfully. Log: `/tmp/phase5-01-format.log`.
- Full unit/aggregate, integration, complete check, review, and commits: parent coordinated and pending.

## Deviations from plan

**[Rule 2 — Missing critical shared instrument] Concern-local analyzer support file.** The parent approved adding `tests/architecture/fallow-report.ts` and amending the plan's file lists. Both the live census and fixture controls must exercise the same report and process validation. A shared support file avoids duplicated validation or importing a test module that would register its cases again. No production test seam or new dependency was added.

**[Rule 1 — Analyzer report schema] Zero-count framework categories may omit arrays.** Initial strict validation exposed that Fallow schema 9 omits several framework-specific arrays while reporting their counts as zero. The reader permits absent arrays only outside the five normalized categories with zero summary counts, validates present array lengths, and rejects every unknown nonzero category. This preserves fail-closed accounting without misclassifying a legitimate report.

## Initial finding identities

The measured post-Phase-4 report exactly matches the 111-finding research snapshot: no identities changed. Every identity below is measured and still open; none is classified as retired or owned merely because this gate passes. Later owner plans must establish a real production caller or remove a retired surface and reconcile this pin.

```text
duplicate_exports|CompileIfPredicateContext|extensions/pi-claude-marketplace/bridges/hooks/if-field/index.ts|extensions/pi-claude-marketplace/domain/components/hooks.ts
duplicate_exports|ToolEvent|extensions/pi-claude-marketplace/domain/components/hook-events.ts|extensions/pi-claude-marketplace/shared/concerns/hooks.ts
duplicate_exports|assertNever|extensions/pi-claude-marketplace/bridges/hooks/exec-result.ts|extensions/pi-claude-marketplace/shared/errors.ts
duplicate_exports|translate|extensions/pi-claude-marketplace/bridges/hooks/payloads/post-compact.ts|extensions/pi-claude-marketplace/bridges/hooks/payloads/post-tool-use-failure.ts|extensions/pi-claude-marketplace/bridges/hooks/payloads/post-tool-use.ts|extensions/pi-claude-marketplace/bridges/hooks/payloads/pre-compact.ts|extensions/pi-claude-marketplace/bridges/hooks/payloads/pre-tool-use.ts|extensions/pi-claude-marketplace/bridges/hooks/payloads/session-end.ts|extensions/pi-claude-marketplace/bridges/hooks/payloads/session-start.ts|extensions/pi-claude-marketplace/bridges/hooks/payloads/stop-failure.ts|extensions/pi-claude-marketplace/bridges/hooks/payloads/stop.ts|extensions/pi-claude-marketplace/bridges/hooks/payloads/user-prompt-submit.ts
unused_class_members|extensions/pi-claude-marketplace/bridges/hooks/async-rewake/ring-buffer.ts|RingBuffer|read|class_method
unused_exports|extensions/pi-claude-marketplace/bridges/agents/convert.ts|MODEL_MAP
unused_exports|extensions/pi-claude-marketplace/bridges/agents/convert.ts|THINKING_VALUES
unused_exports|extensions/pi-claude-marketplace/bridges/agents/convert.ts|TOOL_MAP
unused_exports|extensions/pi-claude-marketplace/bridges/agents/frontmatter.ts|GENERATED_AGENT_MARKER
unused_exports|extensions/pi-claude-marketplace/bridges/agents/frontmatter.ts|emitYamlScalar
unused_exports|extensions/pi-claude-marketplace/bridges/agents/frontmatter.ts|sanitizeProvenanceValue
unused_exports|extensions/pi-claude-marketplace/bridges/agents/index.ts|GENERATED_AGENT_MARKER
unused_exports|extensions/pi-claude-marketplace/bridges/agents/index.ts|GENERATED_AGENT_MARKER_LEGACY
unused_exports|extensions/pi-claude-marketplace/bridges/agents/marker.ts|GENERATED_AGENT_MARKER_LEGACY
unused_exports|extensions/pi-claude-marketplace/bridges/agents/marker.ts|GENERATED_AGENT_PREFIX
unused_exports|extensions/pi-claude-marketplace/bridges/hooks/async-rewake/pid-table.ts|ASYNC_REWAKE_PIDS_FILENAME
unused_exports|extensions/pi-claude-marketplace/bridges/hooks/async-rewake/pid-table.ts|ASYNC_REWAKE_PID_TABLE_VERSION
unused_exports|extensions/pi-claude-marketplace/bridges/hooks/async-rewake/registry.ts|MARKER_ENV
unused_exports|extensions/pi-claude-marketplace/bridges/hooks/event-router.ts|createBeforeAgentStartHandler
unused_exports|extensions/pi-claude-marketplace/bridges/hooks/if-field/index.ts|bashSubcommandFires
unused_exports|extensions/pi-claude-marketplace/bridges/hooks/if-field/index.ts|compileBashGlob
unused_exports|extensions/pi-claude-marketplace/bridges/hooks/if-field/index.ts|compilePathGlob
unused_exports|extensions/pi-claude-marketplace/bridges/hooks/if-field/index.ts|compilePowerShellGlob
unused_exports|extensions/pi-claude-marketplace/bridges/hooks/if-field/index.ts|compilePowerShellRule
unused_exports|extensions/pi-claude-marketplace/bridges/hooks/if-field/index.ts|parseBashSubcommands
unused_exports|extensions/pi-claude-marketplace/bridges/hooks/if-field/index.ts|parsePowerShellSubcommands
unused_exports|extensions/pi-claude-marketplace/bridges/hooks/if-field/index.ts|powerShellSubcommandFires
unused_exports|extensions/pi-claude-marketplace/bridges/hooks/stage.ts|createWriteHookConfig
unused_exports|extensions/pi-claude-marketplace/bridges/hooks/stage.ts|hookConfigPathFor
unused_exports|extensions/pi-claude-marketplace/bridges/mcp/collision-slots.ts|MCP_COLLISION_SLOTS
unused_exports|extensions/pi-claude-marketplace/bridges/mcp/index.ts|resolvePluginMcpServers
unused_exports|extensions/pi-claude-marketplace/bridges/mcp/marker.ts|readMarker
unused_exports|extensions/pi-claude-marketplace/bridges/mcp/parse.ts|parseMcpServers
unused_exports|extensions/pi-claude-marketplace/bridges/mcp/parse.ts|resolvePluginMcpServers
unused_exports|extensions/pi-claude-marketplace/bridges/mcp/stage.ts|MalformedMcpServersError
unused_exports|extensions/pi-claude-marketplace/bridges/mcp/substitute.ts|deepSubstitute
unused_exports|extensions/pi-claude-marketplace/bridges/skills/unstage.ts|createUnstagePluginSkills
unused_exports|extensions/pi-claude-marketplace/domain/auth-registry.ts|GITLAB_PROVIDER
unused_exports|extensions/pi-claude-marketplace/domain/components/hooks.ts|HOOKS_CONFIG_SCHEMA
unused_exports|extensions/pi-claude-marketplace/domain/components/hooks.ts|HOOKS_VALIDATOR
unused_exports|extensions/pi-claude-marketplace/domain/components/hooks/schema.ts|HOOKS_CONFIG_SCHEMA
unused_exports|extensions/pi-claude-marketplace/domain/plugin-resolver.ts|resolveLoose
unused_exports|extensions/pi-claude-marketplace/domain/resolver-types.ts|ResolvedPluginSchema
unused_exports|extensions/pi-claude-marketplace/domain/unsupported-components.ts|SUPPORTED_COMPONENT_KINDS
unused_exports|extensions/pi-claude-marketplace/domain/unsupported-components.ts|UNSUPPORTED_COMPONENT_KINDS
unused_exports|extensions/pi-claude-marketplace/edge/completions/data.ts|buildItem
unused_exports|extensions/pi-claude-marketplace/edge/completions/data.ts|getPluginToMarketplacesMap
unused_exports|extensions/pi-claude-marketplace/edge/flag-catalog.ts|CATALOG_VERBS
unused_exports|extensions/pi-claude-marketplace/edge/handlers/plugin/fetch.ts|parseFetchTarget
unused_exports|extensions/pi-claude-marketplace/edge/handlers/tools.ts|projectRowStatus
unused_exports|extensions/pi-claude-marketplace/edge/router.ts|MARKETPLACE_USAGE
unused_exports|extensions/pi-claude-marketplace/edge/router.ts|TOP_LEVEL_USAGE
unused_exports|extensions/pi-claude-marketplace/index.ts|default
unused_exports|extensions/pi-claude-marketplace/orchestrators/import/marketplaces.ts|planMarketplaceSourcesForRefs
unused_exports|extensions/pi-claude-marketplace/orchestrators/import/refs.ts|parseEnabledPluginRef
unused_exports|extensions/pi-claude-marketplace/orchestrators/import/settings.ts|mergeClaudeSettings
unused_exports|extensions/pi-claude-marketplace/orchestrators/import/settings.ts|resolveClaudeSettingsPaths
unused_exports|extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts|resolveScopeFromState
unused_exports|extensions/pi-claude-marketplace/orchestrators/plugin-path.ts|collectBinDirs
unused_exports|extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts|createSetPluginEnabled
unused_exports|extensions/pi-claude-marketplace/orchestrators/plugin/fetch.ts|createFetchPlugins
unused_exports|extensions/pi-claude-marketplace/orchestrators/plugin/info.ts|createGetPluginInfo
unused_exports|extensions/pi-claude-marketplace/orchestrators/plugin/install-flow.ts|createInstallPlugin
unused_exports|extensions/pi-claude-marketplace/orchestrators/plugin/install.messaging.ts|narrowResolverReasons
unused_exports|extensions/pi-claude-marketplace/orchestrators/plugin/reinstall-flow.ts|createReinstallPlugin
unused_exports|extensions/pi-claude-marketplace/orchestrators/plugin/reinstall-replace.ts|finalizeReinstalledPlugin
unused_exports|extensions/pi-claude-marketplace/orchestrators/plugin/reinstall-replace.ts|replaceReinstalledPlugin
unused_exports|extensions/pi-claude-marketplace/orchestrators/plugin/reinstall-replace.ts|rollbackReinstalledPlugin
unused_exports|extensions/pi-claude-marketplace/orchestrators/plugin/reinstall-replace.ts|runPostSuccessMaintenance
unused_exports|extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.messaging.ts|outcomeToPluginMessage
unused_exports|extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts|createUninstallPlugin
unused_exports|extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts|createApplyReconcile
unused_exports|extensions/pi-claude-marketplace/orchestrators/reconcile/backfill.ts|scanForceInstalledBackfills
unused_exports|extensions/pi-claude-marketplace/orchestrators/reconcile/reconcile.messaging.ts|PENDING_STATUSES
unused_exports|extensions/pi-claude-marketplace/persistence/config-io.ts|CONFIG_VALIDATOR
unused_exports|extensions/pi-claude-marketplace/persistence/state-io.ts|PLUGIN_INSTALL_RECORD_SCHEMA
unused_exports|extensions/pi-claude-marketplace/persistence/state-io.ts|STATE_SCHEMA
unused_exports|extensions/pi-claude-marketplace/persistence/state-io.ts|STATE_VALIDATOR
unused_exports|extensions/pi-claude-marketplace/platform/git-credential.ts|createCredentialOps
unused_exports|extensions/pi-claude-marketplace/platform/git.ts|buildAuthCallbacks
unused_exports|extensions/pi-claude-marketplace/platform/git.ts|listBranches
unused_exports|extensions/pi-claude-marketplace/platform/git.ts|listRemotes
unused_exports|extensions/pi-claude-marketplace/platform/pi-api.ts|hasLoadedPiMcpAdapter
unused_exports|extensions/pi-claude-marketplace/platform/pi-api.ts|hasLoadedPiSubagents
unused_exports|extensions/pi-claude-marketplace/shared/completion-cache.ts|MARKETPLACE_NAMES_CACHE_SCHEMA
unused_exports|extensions/pi-claude-marketplace/shared/completion-cache.ts|PLUGIN_INDEX_CACHE_SCHEMA
unused_exports|extensions/pi-claude-marketplace/shared/errors-bridges.ts|AgentForeignContentError
unused_exports|extensions/pi-claude-marketplace/shared/errors.ts|ConcurrentUninstallError
unused_exports|extensions/pi-claude-marketplace/shared/markers.ts|STATE_LOCK_HELD_PREFIX
unused_exports|extensions/pi-claude-marketplace/shared/notification-dispatch.ts|emitWithSummary
unused_exports|extensions/pi-claude-marketplace/shared/notification-grammar.ts|ICON_PARTIALLY_AVAILABLE
unused_exports|extensions/pi-claude-marketplace/shared/notification-grammar.ts|ICON_REMOTE
unused_exports|extensions/pi-claude-marketplace/shared/notification-types.ts|MARKETPLACE_STATUSES
unused_exports|extensions/pi-claude-marketplace/shared/notification-types.ts|PLUGIN_STATUSES
unused_exports|extensions/pi-claude-marketplace/shared/notification-types.ts|REASONS
unused_exports|extensions/pi-claude-marketplace/shared/notification-types.ts|STATUS_TOKENS
unused_exports|extensions/pi-claude-marketplace/shared/path-safety.ts|LexicalTraversalError
unused_exports|extensions/pi-claude-marketplace/shared/path-safety.ts|createPathSafetyGuard
unused_files|scripts/check-phase-06-hub-ledger.mjs
unused_types|extensions/pi-claude-marketplace/bridges/hooks/index.ts|HooksFileReader
unused_types|extensions/pi-claude-marketplace/bridges/hooks/index.ts|HooksHydration
unused_types|extensions/pi-claude-marketplace/bridges/hooks/index.ts|HooksHydrationDeps
unused_types|extensions/pi-claude-marketplace/bridges/hooks/index.ts|HooksRuntime
unused_types|extensions/pi-claude-marketplace/bridges/hooks/index.ts|ReadAndCachePluginHooksOptions
unused_types|extensions/pi-claude-marketplace/domain/components/hook-events.ts|_BucketAEventsCoverageProof
unused_types|extensions/pi-claude-marketplace/domain/resolver-types.ts|DroppedHookArmKeysCheck
unused_types|extensions/pi-claude-marketplace/domain/resolver-types.ts|DroppedHookDriftCheck
unused_types|extensions/pi-claude-marketplace/orchestrators/marketplace/add.messaging.ts|AddPrivateReason
unused_types|extensions/pi-claude-marketplace/orchestrators/marketplace/remove.messaging.ts|RemovePrivateReason
unused_types|extensions/pi-claude-marketplace/persistence/state-io.ts|EnabledPluginRecord
unused_types|extensions/pi-claude-marketplace/shared/notify-reasons.ts|_ReasonsCoverageProof
```

## Self-Check: PASSED

The four architecture files and amended plan exist; focused validation is green, and the recorded full identity set matches the committed pin introduced by this work. No skipped tests, stubs, TODOs, coverage ignores, or linter suppressions were introduced. Parent verification and commits remain explicit pending work.
