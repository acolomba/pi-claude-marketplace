---
phase: "01"
slug: "companion-floors-and-mcp-defaults"
status: verified
threats_open: 0
asvs_level: 1
block_on: high
created: "2026-11-12"
register_authored_at_plan_time: true
---

# Phase 01 -- Security

The audit covers all 41 contextual threat entries in the eleven approved plans.
Repeated T-01-SC IDs retain their plan number. Product paths below are relative to
`extensions/pi-claude-marketplace/` unless a repository-root path is named.

## Trust Boundaries

- npm registry to the optional peer cache, then to test processes.
- Test and scenario processes to the developer home and temporary Pi homes.
- Plugin server and agent configuration to Pi registration and child tool selection.
- User-edited adapter entries and markers to default/user-value preservation.
- Adapter names and result details to hook identity and proxy classification.
- Adapter entry changes to project-server approval hashes.
- Temporary measurement changes to the committed tree.
- Compatibility documentation and decision records to user and later-plan decisions.

## Threat Register

| Plan / Threat ID | Category | Component | Severity | Disposition | Evidence | Status |
|---|---|---|---|---|---|---|
| 01-01 / T-01-01 | Tampering | `test/integration/optional-peer-suite-versions.json` and its readers | medium | mitigate | test/architecture/peer-floor.test.ts:156; scripts/install-test-peers.mjs:53,74; test/integration/optional-peer.ts:97,122; features/lib/companions.ts:103,137 | closed |
| 01-01 / T-01-02 | Information disclosure | check and scenario runs against the real `~/.pi` | high | mitigate | test/platform/isolated-pi-home.ts:20; features/support/isolated-pi-home.ts:45,55; auditor rechecked the preserved home stamp: no changed paths | closed |
| 01-01 / T-01-03 | Repudiation | measured texts and the break list | medium | mitigate | /tmp/p01-01-1794447032/run.sh:8; 29 output/status pairs; 01-01-SUMMARY.md measured texts; no capture write remains | closed |
| 01-01 / T-01-04 | Elevation of privilege | a mapped model ID that selects another provider's model | low | accept | Accepted Risks Log; D-PG1-04/05/06 | closed |
| 01-01 / T-01-SC | Tampering | npm installs of pi-subagents 0.88.0 and pi-mcp-adapter 7.0.1 | high | mitigate | scripts/install-test-peers.mjs:62,132,152; exact versions, ignore-scripts, publish-time cutoff, integrity checks; 01-01-SUMMARY.md matching shasums | closed |
| 01-02 / T-01-05 | Tampering | the pins of `scripts/pi.sh` and the canary's install instructions | medium | mitigate | scripts/pi.sh:118,119; test/live-uat/mcp-adapter-canary.mjs:59,120; verified exact-version pins | closed |
| 01-02 / T-01-06 | Tampering | `.github/workflows/ci.yml` | medium | mitigate | .github/workflows/ci.yml comment-only diff f8adca62..d5032509; enabled yamllint/zizmor; 01-02-SUMMARY.md hook results | closed |
| 01-02 / T-01-SC | Tampering | npm/pip/cargo installs | high | accept | Accepted Risks Log; 01-02-PLAN.md T-01-SC; setup reuses 01-01 verified exact versions and controls | closed |
| 01-03 / T-01-07 | Elevation of privilege | `fittedAdapterToolName` in `domain/mcp-implementation.ts` | high | mitigate | domain/mcp-implementation.ts:69,94; test/domain/mcp-implementation.test.ts:105,231,252; naming conformance test:100 | closed |
| 01-03 / T-01-08 | Tampering | a pi-mcp-adapter release that changes the naming rule | medium | mitigate | test/integration/adapter-tool-name-conformance.test.ts:103,109,112; package.json:116 | closed |
| 01-03 / T-01-SC | Tampering | npm/pip/cargo installs | high | accept | Accepted Risks Log; 01-03-PLAN.md T-01-SC; setup reuses 01-01 verified exact versions and controls | closed |
| 01-04 / T-01-09 | Denial of service | a hung stdio plugin server under built-in MCP | low | accept | Accepted Risks Log; D-PG1-11; docs/mcp-compatibility.md timeout defaults | closed |
| 01-04 / T-01-10 | Tampering | `defaultRequestTimeoutMs` reading a plugin-controlled `type` | low | mitigate | domain/mcp-server-features.ts:72,163; domain/mcp-builtin-translation.ts:85; closed type switch and existing bounds | closed |
| 01-04 / T-01-SC | Tampering | npm/pip/cargo installs | high | accept | Accepted Risks Log; 01-04-PLAN.md T-01-SC; setup reuses 01-01 verified exact versions and controls | closed |
| 01-05 / T-01-11 | Elevation of privilege | `excludeNameFor` in `bridges/agents/convert.ts` | high | mitigate | bridges/agents/convert.ts:119; paired test:2831,2852; features/mcp-server/agent-grants.feature:18; listing.steps.ts:238; staging proven, detached child pending | closed |
| 01-05 / T-01-12 | Elevation of privilege | agents installed before this change | medium | accept | Accepted Risks Log; docs/mcp-compatibility.md restaging guidance; CHANGELOG.md | closed |
| 01-05 / T-01-13 | Denial of service | pi-subagents' naming of a granted long tool | medium | transfer | .planning/BACKLOG.md AGTLONGNAME-01; docs/prd/parity-gaps-prd.md:925; .planning/upstream/pi-subagents-long-tool-names.md (unfiled draft); adapter grant conformance test:70 | closed |
| 01-05 / T-01-SC | Tampering | npm/pip/cargo installs | high | accept | Accepted Risks Log; 01-05-PLAN.md T-01-SC; setup reuses 01-01 verified exact versions and controls | closed |
| 01-06 / T-01-14 | Tampering | the marker member `defaultFields` read from a user-editable file | low | mitigate | bridges/mcp/marker.ts:52,85,91; test/bridges/mcp/marker.test.ts:125 malformed/own-property cases | closed |
| 01-06 / T-01-15 | Tampering | a default that overwrites the user's `requestTimeoutMs` | medium | mitigate | bridges/mcp/adapter-entry.ts:214,319,366; paired test:629,660,691,719; default equality and plugin/user precedence | closed |
| 01-06 / T-01-16 | Tampering | a default written at a load | medium | mitigate | Product diff a2c659a6..d7014463 changes marker.ts and adapter-entry.ts only; existing stampServers boundary; legacy restage exception documented | closed |
| 01-06 / T-01-17 | Repudiation | a changed project approval hash that nobody recorded | low | mitigate | pi-mcp-adapter/project-server-trust.ts:101,213,245; 01-06-SUMMARY.md Project approval; compatibility page and changelog mark source-derived reapproval | closed |
| 01-06 / T-01-SC | Tampering | npm/pip/cargo installs | high | accept | Accepted Risks Log; 01-06-PLAN.md T-01-SC; setup reuses 01-01 verified exact versions and controls | closed |
| 01-07 / T-01-18 | Elevation of privilege | a guard hook that names a long tool by its full name and no longer runs | high | mitigate | domain/components/hooks/builtin-mcp-tool-names.ts:116; bridges/hooks/dispatch.ts:814,917,1053,1108; hook scenarios and paired tests | closed |
| 01-07 / T-01-19 | Tampering | a hook that runs for a tool of another server through a long server prefix | medium | mitigate | domain/components/hooks/builtin-mcp-tool-names.ts:137; paired test:226,257; 55-character boundary and wrong-server cases | closed |
| 01-07 / T-01-20 | Spoofing | a full name sent to a hook that is not the tool's | medium | mitigate | domain/components/hooks/builtin-mcp-tool-names.ts:67; paired test:375,422; exact fit and candidate length checks | closed |
| 01-07 / T-01-21 | Elevation of privilege | a guard hook on a server prefix longer than 55 characters that does not run for a shortened tool on PreToolUse | medium | accept | Accepted Risks Log; D-PG1-08; features/hook/mcp-tool-names.feature:91; compatibility gap disclosed | closed |
| 01-07 / T-01-SC | Tampering | npm/pip/cargo installs | high | accept | Accepted Risks Log; 01-07-PLAN.md T-01-SC; setup reuses 01-01 verified exact versions and controls | closed |
| 01-08 / T-01-22 | Spoofing | a full name rebuilt from result details that another tool or extension wrote | medium | mitigate | bridges/hooks/dispatch.ts:1070,1108; test/bridges/hooks/dispatch.test.ts:5105 wrong server/tool/type cases | closed |
| 01-08 / T-01-23 | Elevation of privilege | a real tool call that runs no hook because its cut name has the proxy's shape | high | mitigate | bridges/hooks/dispatch.ts:710; paired test:3425; features/hook/tool-use.feature:416; residual namespace-proxy shape documented | closed |
| 01-08 / T-01-24 | Information disclosure | a PreToolUse or PostToolUseFailure hook that receives the shortened name, so a script that compares `tool_name` with the full name sees no match | medium | accept | Accepted Risks Log; D-PG1-08; features/hook/mcp-tool-names.feature:91,116; docs/hooks-compatibility.md | closed |
| 01-08 / T-01-SC | Tampering | npm/pip/cargo installs | high | accept | Accepted Risks Log; 01-08-PLAN.md T-01-SC; setup reuses 01-01 verified exact versions and controls | closed |
| 01-09 / T-01-25 | Tampering | a temporary wait of 150 seconds, a stub delay, or the slow feature file committed by mistake | medium | mitigate | No tracked slow-call feature; temporary harness files match 7ba310bc; waits restored to 30000/20000 ms; no STUB_CALL_DELAY_MS | closed |
| 01-09 / T-01-26 | Repudiation | a claim that a silent call of more than 60 seconds completes, with no evidence | low | mitigate | 01-09-SUMMARY.md Slow call; preserved adapter-slow.json/builtin-slow.json and exit 0 files; measured durations match | closed |
| 01-09 / T-01-27 | Tampering | a default that overwrites the user's `requestTimeoutMs` at a plugin verb | medium | mitigate | features/mcp-server/lifecycle.feature:394,424; user 45000 retained without defaultFields after update | closed |
| 01-09 / T-01-SC | Tampering | npm/pip/cargo installs | high | accept | Accepted Risks Log; 01-09-PLAN.md T-01-SC; setup reuses 01-01 verified exact versions and controls | closed |
| 01-10 / T-01-28 | Repudiation | a page that states more than a run or the source shows (a background child's call, a slow call, a full name on every hook event) | medium | mitigate | Corrected docs/mcp-compatibility.md Naming bullet: per-tool resolver measurement distinguished from source-derived whole-server and launch consequences; auditor confirmed | closed |
| 01-10 / T-01-SC | Tampering | npm/pip/cargo installs | high | accept | Accepted Risks Log; 01-10-PLAN.md T-01-SC; setup reuses 01-01 verified exact versions and controls | closed |
| 01-11 / T-01-29 | Repudiation | a decision row or a release note that states more than was decided or measured | medium | mitigate | .planning/PROJECT.md fourteen D-PG1 rows; D-PG1-02 says floor unproven by suite; D-PG1-03 retains live gap; D-PG1-14 records one-off runs; CHANGELOG adoption boundaries | closed |
| 01-11 / T-01-30 | Tampering | an edit of the 2.8 MB `PROJECT.md` that rewrites or reflows rows outside the insert | low | mitigate | git diff --numstat c716fff8 c394ca6d -- .planning/PROJECT.md: 17 additions, 0 deletions | closed |
| 01-11 / T-01-SC | Tampering | npm/pip/cargo installs | high | accept | Accepted Risks Log; 01-11-PLAN.md T-01-SC; setup reuses 01-01 verified exact versions and controls | closed |

## Accepted Risks Log

These entries record the existing `accept` dispositions from the user-approved
plans and their CONTEXT/PROJECT decisions. The user chose "Validate and use the
existing plans"; the separate size exceptions retained all checks. This log
adds no risk acceptance and does not waive either live-child check.

Later fresh worktrees installed the same pinned companions for setup. The plans'
"installs no package" language means no new dependency/version selection; the
setup installs still used the exact-version, ignore-scripts, cutoff and integrity
controls verified for 01-01. Each accepted supply-chain entry retains that scope.

| Risk ID | Plan / Threat Ref | Existing rationale | Accepted By | Date |
|---|---|---|---|---|
| AR-01-01 | 01-01 / T-01-04 | pi-subagents resolves a bare ID inside the session's own registry and prefers the session's provider; the six target IDs do not change (D-PG1-06), and no installed agent file is rewritten (D-PG1-05). Source: 01-01-PLAN.md. | Existing user approval of plans; recorded by orchestrator | 2026-11-11 |
| AR-01-02 | 01-02 / T-01-SC | No new dependency/version choice. Any fresh-worktree peer setup uses the versions and controls verified under 01-01 / T-01-SC. Source: 01-02-PLAN.md. | Existing user approval of plans; recorded by orchestrator | 2026-11-11 |
| AR-01-03 | 01-03 / T-01-SC | No new dependency/version choice. Any fresh-worktree peer setup uses the versions and controls verified under 01-01 / T-01-SC. Source: 01-03-PLAN.md. | Existing user approval of plans; recorded by orchestrator | 2026-11-11 |
| AR-01-04 | 01-04 / T-01-09 | A silent call now waits 30 minutes instead of 60 seconds. That is Claude Code's behavior and the user's decision (D-PG1-11); the compatibility page says so (plan 01-10). Pi reads no user value for the timeout of a registered server. Source: 01-04-PLAN.md. | Existing user approval of plans; recorded by orchestrator | 2026-11-11 |
| AR-01-05 | 01-04 / T-01-SC | No new dependency/version choice. Any fresh-worktree peer setup uses the versions and controls verified under 01-01 / T-01-SC. Source: 01-04-PLAN.md. | Existing user approval of plans; recorded by orchestrator | 2026-11-11 |
| AR-01-06 | 01-05 / T-01-12 | Such an agent keeps the full name in `excludeTools` until its next `update`, `reinstall`, or disable and enable, while pi-mcp-adapter 7.0.1 registers the cut name. Nothing rewrites it at load (APL-D1). The compatibility page (plan 01-10) and the CHANGELOG (plan 01-11) tell the user to restage. Source: 01-05-PLAN.md. | Existing user approval of plans; recorded by orchestrator | 2026-11-11 |
| AR-01-07 | 01-05 / T-01-SC | No new dependency/version choice. Any fresh-worktree peer setup uses the versions and controls verified under 01-01 / T-01-SC. Source: 01-05-PLAN.md. | Existing user approval of plans; recorded by orchestrator | 2026-11-11 |
| AR-01-08 | 01-06 / T-01-SC | No new dependency/version choice. Any fresh-worktree peer setup uses the versions and controls verified under 01-01 / T-01-SC. Source: 01-06-PLAN.md. | Existing user approval of plans; recorded by orchestrator | 2026-11-11 |
| AR-01-09 | 01-07 / T-01-21 | The orchestrator's resolution 4: a hook that runs for the wrong server is worse than one that does not run. The hook runs as soon as any tool-event hook spells the tool's full name. Plan 01-08 pins the cell in a scenario that names the gap, and the compatibility page records it as a pi-mcp-adapter capability gap (plan 01-10). Source: 01-07-PLAN.md. | Existing user approval of plans; recorded by orchestrator | 2026-11-11 |
| AR-01-10 | 01-07 / T-01-SC | No new dependency/version choice. Any fresh-worktree peer setup uses the versions and controls verified under 01-01 / T-01-SC. Source: 01-07-PLAN.md. | Existing user approval of plans; recorded by orchestrator | 2026-11-11 |
| AR-01-11 | 01-08 / T-01-24 | Pi's tool list and a failed result do not carry the original name. The hook's matcher and `if` field still match the full name (plan 01-07), and the full name reaches every hook once one hook spells it. Two scenarios name the gap, and the compatibility page records it as a pi-mcp-adapter capability gap (plan 01-10). Source: 01-08-PLAN.md. | Existing user approval of plans; recorded by orchestrator | 2026-11-11 |
| AR-01-12 | 01-08 / T-01-SC | No new dependency/version choice. Any fresh-worktree peer setup uses the versions and controls verified under 01-01 / T-01-SC. Source: 01-08-PLAN.md. | Existing user approval of plans; recorded by orchestrator | 2026-11-11 |
| AR-01-13 | 01-09 / T-01-SC | No new dependency/version choice. Any fresh-worktree peer setup uses the versions and controls verified under 01-01 / T-01-SC. Source: 01-09-PLAN.md. | Existing user approval of plans; recorded by orchestrator | 2026-11-11 |
| AR-01-14 | 01-10 / T-01-SC | No new dependency/version choice. Any fresh-worktree peer setup uses the versions and controls verified under 01-01 / T-01-SC. Source: 01-10-PLAN.md. | Existing user approval of plans; recorded by orchestrator | 2026-11-11 |
| AR-01-15 | 01-11 / T-01-SC | No new dependency/version choice. Any fresh-worktree peer setup uses the versions and controls verified under 01-01 / T-01-SC. Source: 01-11-PLAN.md. | Existing user approval of plans; recorded by orchestrator | 2026-11-11 |

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|---|---|---|---|---|
| 2026-11-12 | 41 | 25 | 16 (10 blocking recording gaps, 6 below threshold) | gsd-security-auditor |
| 2026-11-12 | 41 | 41 | 0 | gsd-security-auditor, narrow confirmation |

Audited commit: `c2317aee173ea34a2f9096f1cbb714a964b2468d`. No missing
high-severity implementation mitigation was found. Fifteen accepted entries
needed this log; one medium documentation claim overstated measured coverage.
The narrow follow-up audit confirmed all fifteen log entries and the corrected
wording. All 41 entries are now closed, with no unregistered flags. The initial
blocking count described a recording gap, not a missing code mitigation.

All eleven summaries have Threat Flags sections, with no unmapped flag found.
The detached-child granted-tool call and exclusion checks remain unperformed.

## Sign-Off

- [x] All 41 threats have a disposition.
- [x] Existing accepted risks recorded without new acceptance.
- [x] Narrow audit confirms the log and corrected evidence statement.
- [x] `threats_open: 0` confirmed.
- [x] `status: verified` set after confirmation.

**Approval:** verified 2026-11-12; live-child checks remain pending outside this mitigation audit.
