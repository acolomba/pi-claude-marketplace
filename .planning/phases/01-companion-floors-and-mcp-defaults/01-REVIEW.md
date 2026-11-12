---
phase: 01-companion-floors-and-mcp-defaults
reviewed: 2026-11-12T06:38:59Z
depth: standard
files_reviewed: 75
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
  - features/lib/upstream/subagents.ts
  - features/mcp-server/agent-grants.feature
  - features/mcp-server/builtin-values.feature
  - features/mcp-server/configuration.feature
  - features/mcp-server/legacy-move.feature
  - features/mcp-server/lifecycle.feature
  - features/mcp-server/listing.feature
  - features/plugin/subagent-child.feature
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
  critical: 1
  warning: 0
  info: 0
  total: 1
  necessity: 0
status: issues_found
---

# Phase 01: Code Review Report

**Reviewed:** 2026-11-12T06:38:59Z
**Depth:** standard
**Files Reviewed:** 75
**Status:** issues_found

## Summary

One confirmed blocker affects MCP hook dispatch: an ordinary 64-character tool name ending in eight hexadecimal characters is mistaken for a shortened name, suppressing a matching server-prefix hook even when a successful result supplies the original server and tool.

Scope was the explicit phase file list, combining summary key files with the actual per-plan changes, against base `b6f418f1dd93471d4906533eda9c4e6c5dfd3ce8` through `49b1ba0e`. The lockfile was excluded. Production changes and relevant call paths were examined; large existing test modules and documents were assessed through changed sections and supporting context, rather than every unchanged line of the approximately 98,852-line submitted scope. Consequently this report does not claim a complete full-file reading of those large modules.

The existing full check result was supplied by the orchestrator and was not rerun. Focused, read-only Node probes reproduced the blocker using both the domain helpers and the real dispatcher with the installed adapter's naming function. No source files were changed. No additional necessity finding was established.

## Structural Findings (fallow)

The supplied normalized report contains zero findings because the normalizer does not interpret the current raw report schema correctly. That zero is not a clean structural result.

The authoritative raw `FALLOW.json` reports 32 complexity advisories, no dead-code issues, and no duplication clone groups. There is one introduced complexity advisory, 31 inherited advisories, and one worsened inherited advisory. All 32 use **estimated**, partial coverage and have effective severity **WARNING**. The table preserves these structural observations; they are not independently confirmed defects and are not added to the narrative finding counts in frontmatter.

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
| `scripts/install-test-peers.mjs:42` | `<arrow>` | 5 | 4 | introduced (introduced) | WARNING |
| `scripts/install-test-peers.mjs:120` | `assertRegistryIntegrity` | 5 | 4 | inherited | WARNING |
| `test/live-uat/mcp-adapter-canary.mjs:630` | `onLine` | 5 | 3 | inherited | WARNING |
| `test/live-uat/mcp-adapter-canary.mjs:850` | `<arrow>` | 5 | 2 | inherited | WARNING |
| `test/live-uat/mcp-adapter-canary.mjs:1007` | `seedLegacy` | 5 | 4 | inherited | WARNING |
| `test/live-uat/mcp-adapter-canary.mjs:1065` | `assertBeforeReload` | 5 | 4 | inherited | WARNING |
| `test/live-uat/mcp-adapter-canary.mjs:1295` | `assertSearchMatch` | 5 | 3 | inherited | WARNING |
| `test/live-uat/mcp-adapter-canary.mjs:1312` | `assertToolSearchLoaded` | 5 | 3 | inherited | WARNING |
| `test/live-uat/mcp-adapter-canary.mjs:1479` | `main` | 5 | 4 | inherited | WARNING |

The inherited `readMarker` advisory worsened from cyclomatic/cognitive 12/9 to 14/11. Estimated-coverage CRAP scores do not establish that these functions lack direct coverage. If acting on these advisories, first compare their branches against measured coverage; simplify only where a concrete maintainability or correctness issue is established. No test-reliability defect is inferred merely from a test function's complexity.

The supplemental `fallow review --base ... --brief` invocation could not create its temporary worktree in the sandbox. The supplied authoritative raw structural report remains the basis of this section.

## Narrative Findings (AI reviewer)

### Critical Issues

#### CR-01: A valid 64-character adapter tool name suppresses its server-prefix hook

**Classification:** BLOCKER
**File:** `/home/acolomba/src/pi-claude-marketplace-gaps/extensions/pi-claude-marketplace/domain/components/hooks/builtin-mcp-tool-names.ts:75-77`
**Related lines:** `/home/acolomba/src/pi-claude-marketplace-gaps/extensions/pi-claude-marketplace/domain/components/hooks/builtin-mcp-tool-names.ts:54-58,137-148`; `/home/acolomba/src/pi-claude-marketplace-gaps/extensions/pi-claude-marketplace/bridges/hooks/dispatch.ts:917-920`

**Issue:** Hash-shaped names are treated as proof that the adapter shortened the tool name. A valid original name can already be exactly 64 characters and end in `_[0-9a-f]{8}`. For such a tool, `looksLikeCutAdapterToolName` returns true, while `recoverAdapterToolName` rejects the genuine original name because the candidate is not longer than 64 characters. `serverPrefixNames` then rejects every matching server prefix longer than 55 characters.

This silently skips a configured server-prefix hook. It also occurs for a successful `PostToolUse` event whose adapter result includes the original `details.server` and `details.tool`. Therefore it is outside the documented limitation for genuinely shortened tools whose original names are unavailable. Hooks used for auditing or guard behavior are affected.

**Reproduction:** Use plugin `demo`, a server name consisting of 37 `x` characters, and tool `deadbeef`. The resulting server key is `plugin_demo_` followed by those 37 characters and `_`. The installed adapter's `formatToolName("deadbeef", serverKey, "mcp")` produces:

```text
mcp__plugin_demo_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx__deadbeef
```

This name has length 64 and is unchanged by the adapter. Its server prefix has length 56. Register a `PostToolUse` matcher consisting of that full server prefix followed by `.*`, then dispatch a successful result with `details: { server: serverKey, tool: "deadbeef" }`. A read-only execution through `toolResultCompositeHandler` and the installed adapter naming function yielded:

```json
{
  "nameLength": 64,
  "prefixLength": 56,
  "unchangedByAdapter": true,
  "successfulResultHasOriginalName": true,
  "hooksCalled": []
}
```

The matching hook should run once. A focused helper probe also confirmed that adding the exact 64-character hook literal does not recover the name.

**Fix:** Treat the suffix pattern as a possible shortened name, not confirmation of shortening. Preserve a full name verified from successful adapter result metadata when its adapter-formatted value equals the event's registered name, including a full name of exactly 64 characters. Use that verified name for server-prefix matching. Keep the existing protection against assigning genuinely shortened names to sibling servers with a shared retained prefix; do not simply remove the 55-character guard. Add domain and dispatcher regressions for this unshortened hash-tail boundary, plus a behavioral scenario. Cover the ambiguity of pre-call/failure events separately without weakening the sibling-server protection.

## Review Boundaries and Accepted Limitations

- The companion declaration floors and actual suite versions are distinct: pi-subagents declares 0.87.0 support while the suite exercises 0.88.0. This review does not treat the suite as a runtime measurement of the lower floor.
- The documented long-name grant limitation in pi-subagents and pending detached-child/live tool checks remain acknowledged capability and validation gaps. They are not presented as newly working parity.
- The previously reported whole-server measurement overstatement in `docs/mcp-compatibility.md` was corrected in `49b1ba0e` and is not an open finding.
- The existing hash-shaped namespace proxy exception is a documented accepted tradeoff. CR-01 concerns a separate, reproducible hook suppression even when trustworthy adapter result metadata is available.
- Timeout provenance, transport defaults, migration/restaging behavior, agent exclusions, hook-name recovery, peer installation changes, test changes, and the related documentation were examined for additional concrete defects. No further narrative defect was established within the review coverage stated above.

---

_Reviewed: 2026-11-12T06:38:59Z_
_Reviewer: gsd-code-reviewer_
_Depth: standard_
