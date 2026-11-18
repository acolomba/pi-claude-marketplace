---
phase: 01-companion-floors-and-mcp-defaults
reviewed: 2026-11-12T07:06:52Z
depth: standard
files_reviewed: 77
files_reviewed_list:
  - .agents/skills/cucumber/rules/world-and-stand-ins.md
  - .github/workflows/ci.yml
  - CHANGELOG.md
  - CONTRIBUTING.md
  - README.es.md
  - README.md
  - docs/hooks-compatibility.md
  - docs/mcp-compatibility.md
  - docs/prd/parity-gaps-prd.md
  - extensions/pi-claude-marketplace/bridges/agents/convert.ts
  - extensions/pi-claude-marketplace/bridges/hooks/dispatch.ts
  - extensions/pi-claude-marketplace/bridges/hooks/if-field/index.ts
  - extensions/pi-claude-marketplace/bridges/mcp/adapter-entry.ts
  - extensions/pi-claude-marketplace/bridges/mcp/marker.ts
  - extensions/pi-claude-marketplace/domain/components/hooks/builtin-mcp-tool-names.ts
  - extensions/pi-claude-marketplace/domain/mcp-builtin-translation.ts
  - extensions/pi-claude-marketplace/domain/mcp-implementation.ts
  - extensions/pi-claude-marketplace/domain/mcp-server-features.ts
  - features/agent/frontmatter.feature
  - features/hook/mcp-tool-names.feature
  - features/hook/tool-use.feature
  - features/lib/companions.ts
  - features/lib/mcp-server-files.ts
  - features/lib/mcp-stub-server.ts
  - features/lib/upstream/subagents.ts
  - features/mcp-server/agent-grants.feature
  - features/mcp-server/builtin-values.feature
  - features/mcp-server/configuration.feature
  - features/mcp-server/legacy-move.feature
  - features/mcp-server/lifecycle.feature
  - features/mcp-server/listing.feature
  - features/plugin/subagent-child.feature
  - features/step_definitions/hook/tool-use.steps.ts
  - features/step_definitions/mcp-server/lifecycle.steps.ts
  - features/step_definitions/mcp-server/listing.steps.ts
  - package.json
  - scripts/install-test-peers.mjs
  - scripts/pi.sh
  - test/architecture/gate-targets.ts
  - test/architecture/integration-materialization-gate.test.ts
  - test/architecture/peer-floor.test.ts
  - test/bridges/agents/convert.test.ts
  - test/bridges/agents/stage.test.ts
  - test/bridges/hooks/dispatch.test.ts
  - test/bridges/mcp/adapter-entry.test.ts
  - test/bridges/mcp/builtin-entry.test.ts
  - test/bridges/mcp/marker.test.ts
  - test/bridges/mcp/stage.test.ts
  - test/domain/components/hooks/builtin-mcp-tool-names.test.ts
  - test/domain/mcp-builtin-translation.test.ts
  - test/domain/mcp-implementation.test.ts
  - test/domain/mcp-server-features.test.ts
  - test/edge/handlers/plugin/install.test.ts
  - test/edge/handlers/plugin/update.test.ts
  - test/integration/adapter-tool-name-conformance.test.ts
  - test/integration/agents-adapter-grant-conformance.test.ts
  - test/integration/agents-builtin-grant-conformance.test.ts
  - test/integration/mcp-adapter-entry-conformance.test.ts
  - test/integration/mcp-home-path-partial.test.ts
  - test/integration/mcp-legacy-sweep.test.ts
  - test/integration/mcp-override-lifecycle.test.ts
  - test/integration/mcp-tool-rules.test.ts
  - test/integration/mcp-variable-expansion.test.ts
  - test/integration/optional-peer-suite-versions.json
  - test/integration/optional-peer.ts
  - test/integration/pi-mcp-adapter-peer.ts
  - test/integration/pi-subagents-peer.ts
  - test/integration/provenance-invisibility.test.ts
  - test/integration/skill-path-resolution.test.ts
  - test/live-uat/README.md
  - test/live-uat/mcp-adapter-canary.mjs
  - test/orchestrators/mcp/builtin-registration-step.test.ts
  - test/orchestrators/plugin/install-flow-ledger.test.ts
  - test/orchestrators/plugin/reinstall-flow.test.ts
  - test/orchestrators/plugin/update-flow.test.ts
  - test/orchestrators/plugin/update-swap.test.ts
  - test/orchestrators/reconcile/mcp-migration.test.ts
findings:
  critical: 0
  warning: 0
  info: 0
  total: 0
  necessity: 0
status: clean
---

# Phase 01: Code Review Report

**Reviewed:** 2026-11-12T07:06:52Z
**Depth:** standard
**Files Reviewed:** 77
**Status:** clean

## Summary

Re-review iteration 2 confirms that CR-01 is fixed in `1e76274931b9536d9e0edb3f342c45748f8f7654`. No open narrative findings or newly introduced defects were established. The successful-result path now recovers an original 64-character adapter name from matching result metadata without relaxing the guard for unverified hook literals.

Scope is the original phase file list against base `b6f418f1dd93471d4906533eda9c4e6c5dfd3ce8`, plus `features/lib/mcp-stub-server.ts` and `features/step_definitions/hook/tool-use.steps.ts`: 77 paths after excluding the lockfile. This iteration independently inspected all seven files changed by the fix and their relevant call paths, reusing the initial review of unchanged phase content. The original large test modules and documents were assessed through changed sections and supporting context, rather than every unchanged line of the approximately 98,852-line initial scope. This report does not claim a complete full-file reading of those large modules.

The reviewer reran the original failure through the real dispatcher and installed adapter naming function, then directly asserted genuine-cut recovery and sibling-server rejection. All assertions passed on Node v26.13.0 at the fix commit. The fixer's reported focused unit, direct-coverage, and behavioral checks provide additional evidence; the full combined-tree `npm run check` is pending with the parent workflow and was not duplicated here. No source files were changed. No necessity defect was established.

## Structural Findings (fallow)

The supplied normalized report contains zero findings because the normalizer does not interpret the current raw report schema correctly. That zero is not a clean structural result.

The original pre-fix authoritative raw `FALLOW.json` reports 32 complexity advisories, no dead-code issues, and no duplication clone groups. There is one introduced complexity advisory, 31 inherited advisories, and one worsened inherited advisory. All 32 use **estimated**, partial coverage and have effective severity **WARNING**. The table preserves these structural observations; they are not independently confirmed defects and are not added to the narrative finding counts in frontmatter.

| File and line | Function | Cyclomatic | Cognitive | Attribution | Classification |
| --- | --- | ---: | ---: | --- | --- |
| `test/orchestrators/plugin/install-flow-ledger.test.ts:2543` | `<arrow>` | 17 | 3 | inherited | WARNING |
| `test/orchestrators/plugin/update-flow.test.ts:7005` | `<arrow>` | 16 | 1 | inherited | WARNING |
| `extensions/pi-claude-marketplace/bridges/agents/convert.ts:916` | `convertAgentOrEmpty` | 14 | 14 | inherited | WARNING |
| `extensions/pi-claude-marketplace/bridges/mcp/marker.ts:65` | `readMarker` | 14 | 11 | worsened | WARNING |
| `test/orchestrators/plugin/install-flow-ledger.test.ts:2365` | `<arrow>` | 14 | 12 | inherited | WARNING |
| `test/orchestrators/plugin/install-flow-ledger.test.ts:8512` | `<arrow>` | 14 | 5 | inherited | WARNING |
| `test/orchestrators/plugin/update-flow.test.ts:170` | `createGitOps` | 14 | 13 | inherited | WARNING |
| `test/orchestrators/plugin/install-flow-ledger.test.ts:441` | `writePluginComponents` | 13 | 12 | inherited | WARNING |
| `extensions/pi-claude-marketplace/domain/mcp-server-features.ts:132` | `oauthField` | 12 | 9 | inherited | WARNING |
| `test/orchestrators/plugin/reinstall-flow.test.ts:316` | `writePluginTree` | 12 | 11 | inherited | WARNING |
| `extensions/pi-claude-marketplace/bridges/hooks/dispatch.ts:502` | `blockNotices` | 11 | 5 | inherited | WARNING |
| `test/orchestrators/reconcile/mcp-migration.test.ts:626` | `describe("migrateLegacyMcpEntries")` | 11 | 10 | inherited | WARNING |
| `test/orchestrators/plugin/install-flow-ledger.test.ts:678` | `seedPathMarketplaceWithPlugin` | 10 | 12 | inherited | WARNING |
| `test/orchestrators/plugin/reinstall-flow.test.ts:228` | `seedMarketplace` | 10 | 8 | inherited | WARNING |
| `test/orchestrators/plugin/reinstall-flow.test.ts:6416` | `<arrow>` | 10 | 1 | inherited | WARNING |
| `test/live-uat/mcp-adapter-canary.mjs:324` | `requirePackage` | 7 | 5 | inherited | WARNING |
| `test/live-uat/mcp-adapter-canary.mjs:570` | `onResponse` | 7 | 6 | inherited | WARNING |
| `test/live-uat/mcp-adapter-canary.mjs:882` | `waitForPayload` | 7 | 8 | inherited | WARNING |
| `test/live-uat/mcp-adapter-canary.mjs:972` | `captureLegacy` | 6 | 2 | inherited | WARNING |
| `test/live-uat/mcp-adapter-canary.mjs:1094` | `entryProblems` | 6 | 2 | inherited | WARNING |
| `test/live-uat/mcp-adapter-canary.mjs:1108` | `assertMigratedFiles` | 6 | 3 | inherited | WARNING |
| `test/live-uat/mcp-adapter-canary.mjs:1346` | `assertDeclaredAfterSearch` | 6 | 5 | inherited | WARNING |
| `test/live-uat/mcp-adapter-canary.mjs:1365` | `assertToolResult` | 6 | 2 | inherited | WARNING |
| `scripts/install-test-peers.mjs:42` | `<arrow>` | 5 | 4 | introduced | WARNING |
| `scripts/install-test-peers.mjs:120` | `assertRegistryIntegrity` | 5 | 4 | inherited | WARNING |
| `test/live-uat/mcp-adapter-canary.mjs:630` | `onLine` | 5 | 3 | inherited | WARNING |
| `test/live-uat/mcp-adapter-canary.mjs:850` | `<arrow>` | 5 | 2 | inherited | WARNING |
| `test/live-uat/mcp-adapter-canary.mjs:1007` | `seedLegacy` | 5 | 4 | inherited | WARNING |
| `test/live-uat/mcp-adapter-canary.mjs:1065` | `assertBeforeReload` | 5 | 4 | inherited | WARNING |
| `test/live-uat/mcp-adapter-canary.mjs:1295` | `assertSearchMatch` | 5 | 3 | inherited | WARNING |
| `test/live-uat/mcp-adapter-canary.mjs:1312` | `assertToolSearchLoaded` | 5 | 3 | inherited | WARNING |
| `test/live-uat/mcp-adapter-canary.mjs:1479` | `main` | 5 | 4 | inherited | WARNING |

The inherited `readMarker` advisory worsened from cyclomatic/cognitive 12/9 to 14/11. Estimated-coverage CRAP scores do not establish that these functions lack direct coverage. If acting on these advisories, first compare their branches against measured coverage; simplify only where a concrete maintainability or correctness issue is established. No test-reliability defect is inferred merely from a test function's complexity.

The supplemental `fallow review --base ... --brief` invocation could not create its temporary worktree in the sandbox. The supplied authoritative raw structural report remains the basis of this section. It has not been regenerated for the seven-file fix; the table preserves the original structural evidence and line locations. The fix report separately records a passing Fallow audit with zero introduced findings.

## Narrative Findings (AI reviewer)

No open findings. The prior BLOCKER CR-01 is resolved.

### CR-01 Resolution Verification

The re-review traced `toolResultCompositeHandler` through `toolEventView` to `recoverAdapterToolName`. Successful result metadata is passed separately from hook literals and is accepted only when formatting the full name produces the registered event name. Literal-only recovery still requires a name longer than 64 characters. The existing 55-character server-prefix guard remains unchanged.

The original plugin `demo`, 37-character server, tool `deadbeef` reproduction now invokes the matching server-prefix hook exactly once. Additional direct assertions using a genuinely shortened name verified that:

- Correct full-name metadata enables the actual server prefix.
- A sibling server sharing the retained prefix is rejected, including when supplied as mismatched metadata.
- Missing metadata and a literal consisting only of the 64-character registered name cannot bypass the long-prefix guard.
- A matching original long literal still recovers the tool correctly.

The probe returned:

```json
{
  "boundaryHooksCalled": ["guard"],
  "genuineCutMetadataMatches": true,
  "genuineCutSiblingRejected": true,
  "unverifiedCutLiteralRejected": true,
  "longLiteralRecoveryPreserved": true
}
```

The new domain and dispatcher regression cases assert the repaired boundary, and the adapter-only Cucumber scenario exercises the real adapter with a named stub tool. The shared stub retains `echo` as its default, preserving existing callers; the added step supplies the alternate tool through the existing process arguments.

The fix report's “requires human verification” wording does not identify an actual human-only check for this deterministic defect. No manual verification is required to close CR-01. This disposition does not waive the parent workflow's pending combined-tree gate or the separate live-child checks already recorded for the phase.

## Review Boundaries and Accepted Limitations

- The companion declaration floors and actual suite versions are distinct: pi-subagents declares 0.87.0 support while the suite exercises 0.88.0. This review does not treat the suite as a runtime measurement of the lower floor.
- The documented long-name grant limitation in pi-subagents and pending detached-child/live tool checks remain acknowledged capability and validation gaps. They are not presented as newly working parity.
- The previously reported whole-server measurement overstatement in `docs/mcp-compatibility.md` was corrected in `49b1ba0e` and is not an open finding.
- The existing hash-shaped namespace proxy exception is a documented accepted tradeoff. The separate metadata-backed hook suppression recorded as CR-01 is now fixed.
- Timeout provenance, transport defaults, migration/restaging behavior, agent exclusions, hook-name recovery, peer installation changes, test changes, and the related documentation were examined for additional concrete defects. No further narrative defect was established within the review coverage stated above.

---

_Reviewed: 2026-11-12T07:06:52Z_
_Reviewer: gsd-code-reviewer_
_Depth: standard_
