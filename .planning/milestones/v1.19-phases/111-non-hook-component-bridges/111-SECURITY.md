---
phase: 111
slug: non-hook-component-bridges
status: verified
threats_open: 0
asvs_level: 1
created: 2026-08-30
---

# Phase 111 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary                                                                 | Description                                                                                                                             | Data Crossing                                                                        |
| ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Untrusted plugin agent trees → generated agent files and ownership index | Discovery, conversion, ownership classification, staging, and removal must preserve exact ownership and content boundaries.             | Markdown, YAML frontmatter, path names, hashes, and ownership markers                |
| Untrusted plugin command trees → generated command files                 | Recursive discovery and lifecycle operations must reject unsafe paths and preserve exact bytes, rollback state, and foreign files.      | Markdown, path names, substitutions, and filesystem state                            |
| Plugin MCP declarations and environment → merged settings                | Parsing, marker checks, collision policy, substitution, and safe assignment must reject malformed or inherited ownership data.          | JSON-like objects, environment variables, provenance markers, and server definitions |
| Untrusted skill trees → staged skill directories                         | Traversal, YAML scanning, rewriting, degradation, staging, and removal must refuse linked or escaping paths and preserve exact content. | Directories, symlinks, Markdown, YAML spans, path names, and substitutions           |
| Existing mixed-owner targets → committed or rolled-back state            | Stage and unstage operations must update only owned artifacts, restore failures atomically, and report complete recovery data.          | Existing user files, indexes, settings, temporary paths, and recovery metadata       |

---

## Threat Register

| Threat ID   | Category               | Component                         | Severity | Disposition | Mitigation Evidence                                                                                                                              | Status |
| ----------- | ---------------------- | --------------------------------- | -------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ------ |
| T-111-01-01 | Tampering              | `convertAgent`                    | high     | mitigate    | `tests/bridges/agents/convert.test.ts` proves exact conversion bytes, mappings, warnings, and malformed-input outcomes.                          | closed |
| T-111-02-01 | Tampering              | `discoverPluginAgents`            | medium   | mitigate    | `tests/bridges/agents/discover.test.ts` proves deterministic names, hashes, skips, collisions, and ordering.                                     | closed |
| T-111-03-01 | Tampering              | agent frontmatter parser/renderer | high     | mitigate    | `tests/bridges/agents/frontmatter.test.ts` proves metadata, provenance, escaping, malformed input, and exact rendering.                          | closed |
| T-111-04-01 | Tampering              | agent index ownership             | high     | mitigate    | `tests/bridges/agents/index-mutation.test.ts` proves owner partitioning, conflict detection, and ordering.                                       | closed |
| T-111-05-01 | Tampering              | agent public surface              | low      | accept      | Direct binding and compiler evidence detect surface drift; this module adds no runtime boundary.                                                 | closed |
| T-111-06-01 | Spoofing               | `isOwnedAgentFile`                | high     | mitigate    | `tests/bridges/agents/marker.test.ts` distinguishes owned, legacy, foreign, missing, and invalid files.                                          | closed |
| T-111-07-01 | Tampering              | agent stage lifecycle             | high     | mitigate    | `tests/bridges/agents/stage.test.ts` proves no-op, commit, abort, replacement, rollback, finalization, foreign preservation, and index behavior. | closed |
| T-111-08-01 | Tampering              | agent type contract               | low      | accept      | Targeted compiler evidence detects record and discriminated-union drift; this module adds no runtime boundary.                                   | closed |
| T-111-09-01 | Tampering              | `unstagePluginAgents`             | high     | mitigate    | `tests/bridges/agents/unstage.test.ts` proves containment, owned-only removal, foreign preservation, index truth, and idempotence.               | closed |
| T-111-10-01 | Tampering              | `discoverPluginCommands`          | high     | mitigate    | `tests/bridges/commands/discover.test.ts` proves recursive names, skips, diagnostics, hashes, collision policy, symlink refusal, and ordering.   | closed |
| T-111-11-01 | Tampering              | command public surface            | low      | accept      | Direct binding and compiler evidence detect surface drift; this module adds no runtime boundary.                                                 | closed |
| T-111-12-01 | Tampering              | command stage lifecycle           | high     | mitigate    | `tests/bridges/commands/stage.test.ts` proves degradation, substitution, exact bytes, transitions, rollback, cleanup, and recovery payloads.     | closed |
| T-111-13-01 | Tampering              | command type contract             | low      | accept      | Targeted compiler evidence detects record and lifecycle-union drift; this module adds no runtime boundary.                                       | closed |
| T-111-14-01 | Elevation of Privilege | `unstagePluginCommands`           | high     | mitigate    | `tests/bridges/commands/unstage.test.ts` proves name validation, containment, exact removal, ordering, foreign preservation, and idempotence.    | closed |
| T-111-15-01 | Tampering              | `loadEffectiveServerNames`        | high     | mitigate    | `tests/bridges/mcp/collision-slots.test.ts` proves precedence, first-declarer ownership, malformed handling, and environment isolation.          | closed |
| T-111-16-01 | Tampering              | MCP public surface                | low      | accept      | Direct binding and compiler evidence detect surface drift; this module adds no runtime boundary.                                                 | closed |
| T-111-17-01 | Spoofing               | MCP provenance markers            | high     | mitigate    | `tests/bridges/mcp/marker.test.ts` proves exact ownership and rejects malformed or inherited marker and identity properties.                     | closed |
| T-111-18-01 | Tampering              | `resolvePluginMcpServers`         | high     | mitigate    | `tests/bridges/mcp/parse.test.ts` proves precedence, wrapped forms, complete maps, and fail-closed malformed-source behavior.                    | closed |
| T-111-19-01 | Tampering              | `safeSet`                         | high     | mitigate    | `tests/bridges/mcp/safe-set.test.ts` proves ordinary and `__proto__` keys remain own data without prototype mutation.                            | closed |
| T-111-20-01 | Tampering              | MCP stage lifecycle               | high     | mitigate    | `tests/bridges/mcp/stage.test.ts` proves merge, collision, substitution, atomic replacement, rollback, foreign preservation, and isolation.      | closed |
| T-111-21-01 | Tampering              | MCP substitution                  | medium   | mitigate    | `tests/bridges/mcp/substitute.test.ts` proves deep structure, fresh values, exact token semantics, and environment precedence.                   | closed |
| T-111-22-01 | Tampering              | MCP type contract                 | low      | accept      | Targeted compiler evidence detects record, source-tag, and lifecycle-union drift; this module adds no runtime boundary.                          | closed |
| T-111-23-01 | Tampering              | `unstageMcpServers`               | high     | mitigate    | `tests/bridges/mcp/unstage.test.ts` proves exact owned removal, no needless rewrite, and foreign byte and structure preservation.                | closed |
| T-111-24-01 | Tampering              | `discoverPluginSkills`            | high     | mitigate    | `tests/bridges/skills/discover.test.ts` proves traversal order, self-directory handling, symlink refusal, and first-wins collisions.             | closed |
| T-111-25-01 | Tampering              | skill frontmatter degradation     | medium   | mitigate    | `tests/bridges/skills/frontmatter-degrade.test.ts` proves fallback policy, folded descriptions, caps, multiline spans, and exact bytes.          | closed |
| T-111-26-01 | Tampering              | skill frontmatter scanning        | medium   | mitigate    | `tests/bridges/skills/frontmatter-scan.test.ts` proves exact block and key-value spans for scalar and multiline YAML.                            | closed |
| T-111-27-01 | Tampering              | skill public surface              | low      | accept      | Direct binding and compiler evidence detect surface drift; this module adds no runtime boundary.                                                 | closed |
| T-111-28-01 | Tampering              | `rewriteFrontmatterName`          | medium   | mitigate    | `tests/bridges/skills/rewrite-frontmatter.test.ts` proves exact replacement/insertion, byte preservation, and mismatch rejection.                | closed |
| T-111-29-01 | Tampering              | skill stage lifecycle             | high     | mitigate    | `tests/bridges/skills/stage.test.ts` proves recursive bytes, degradation, rewrite/substitution, lifecycle rollback, cleanup, and recovery data.  | closed |
| T-111-30-01 | Tampering              | skill type contract               | low      | accept      | Targeted compiler evidence detects record and lifecycle-union drift; this module adds no runtime boundary.                                       | closed |
| T-111-31-01 | Elevation of Privilege | `unstagePluginSkills`             | high     | mitigate    | `tests/bridges/skills/unstage.test.ts` proves name validation, containment, exact owned-tree removal, foreign preservation, and idempotence.     | closed |

_Status: open · closed · open below the `high` threshold (non-blocking)_

_Severity: critical > high > medium > low; only open threats at or above `workflow.security_block_on` count toward `threats_open`._

_Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third party)_

---

## Accepted Risks Log

| Risk ID   | Threat Ref  | Rationale                                                                                            | Accepted By    | Date       |
| --------- | ----------- | ---------------------------------------------------------------------------------------------------- | -------------- | ---------- |
| AR-111-01 | T-111-05-01 | The agent barrel adds no runtime boundary; direct identity and closed-surface checks detect drift.   | Phase 111 plan | 2026-08-30 |
| AR-111-02 | T-111-08-01 | Agent records and unions are compile-time contracts with targeted positive and negative evidence.    | Phase 111 plan | 2026-08-30 |
| AR-111-03 | T-111-11-01 | The command barrel adds no runtime boundary; direct identity and closed-surface checks detect drift. | Phase 111 plan | 2026-08-30 |
| AR-111-04 | T-111-13-01 | Command records and unions are compile-time contracts with targeted positive and negative evidence.  | Phase 111 plan | 2026-08-30 |
| AR-111-05 | T-111-16-01 | The MCP barrel adds no runtime boundary; direct identity and closed-surface checks detect drift.     | Phase 111 plan | 2026-08-30 |
| AR-111-06 | T-111-22-01 | MCP records and unions are compile-time contracts with targeted positive and negative evidence.      | Phase 111 plan | 2026-08-30 |
| AR-111-07 | T-111-27-01 | The skill barrel adds no runtime boundary; direct identity and closed-surface checks detect drift.   | Phase 111 plan | 2026-08-30 |
| AR-111-08 | T-111-30-01 | Skill records and unions are compile-time contracts with targeted positive and negative evidence.    | Phase 111 plan | 2026-08-30 |

Accepted risks do not resurface in future audit runs.

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By                                         |
| ---------- | ------------: | -----: | ---: | ---------------------------------------------- |
| 2026-08-30 |            31 |     31 |    0 | Codex goal verification and ASVS Level 1 audit |

The audit traced all 18 high-severity threats to current implementation and direct-owner behavior. The remaining five medium threats are mitigated by green direct owners, and eight low threats are accepted plan-time contract risks. All 31 direct gates pass with complete line, branch, and function coverage. The full suite reports 4,238 passed, zero failed, and one skipped unrelated test.

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer).
- [x] Accepted risks are documented in the Accepted Risks Log.
- [x] `threats_open: 0` is confirmed.
- [x] `status: verified` is set in frontmatter.

**Approval:** verified 2026-08-30
