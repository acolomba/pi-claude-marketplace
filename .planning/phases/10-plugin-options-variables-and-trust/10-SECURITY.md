---
phase: "10"
slug: "plugin-options-variables-and-trust"
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
created: "2026-11-15"
---

# Phase 10 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| Plugin manifest -> resolver | A plugin's `userConfig` schema and defaults come from a third-party repository | option keys, defaults (untrusted text) |
| Project folder -> Pi process | A project's `state.json` feeds `PATH` and the option variables only when Pi trusts the project | bin paths, option values |
| Extension -> pi-mcp-adapter | `mcp-adapter.json` entries are re-read and expanded by the adapter | option references, never values |
| Extension -> Pi built-in MCP | Option values are filled in memory at each session | option values (escaped for Pi) |
| Extension -> hook processes | Hook env carries `CLAUDE_PLUGIN_OPTION_<KEY>` | option values |
| Staged content | Skills, commands, agents get option text at staging | defaults; sensitive keys get placeholder text |

---

## Threat Register

Evidence for each row (file:line and test names) is in the audit of 2026-11-15, summarized below. `ext/` = `extensions/pi-claude-marketplace/`.

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-10-01 | Tampering | trust writer in `features/support/world.ts` | medium | mitigate | sandbox path, `flag:"wx"`, read-back assert | closed |
| T-10-02 | Repudiation | guard scenario that cannot fail | medium | mitigate | red runs recorded in 10-01-SUMMARY (process evidence) | closed |
| T-10-03 | Tampering | `__proto__`/`constructor` option key | medium | mitigate | `ext/domain/user-config.ts` own-key maps; user-config.test.ts | closed |
| T-10-04 | Tampering | malformed `userConfig` accepted in part | medium | mitigate | strict schema, whole value `malformed` | closed |
| T-10-05 | Info disclosure | `{env:}` default expanded by the adapter | high | mitigate | adapter-expansion-conformance.test.ts (real `interpolateEnvVars`) | closed |
| T-10-06 | Info disclosure | project path in a user-scope skill or command | low | accept | D-PG10-16 | closed |
| T-10-07 | EoP | scope change removing a trust gate | high | mitigate | trust checks unchanged in command/skill invocation; untrusted cases | closed |
| T-10-08 | EoP | untrusted project bin on `PATH` | high | mitigate | `ext/orchestrators/plugin-path.ts` gate on `projectTrusted`; executables.feature | closed |
| T-10-09 | EoP | auto-trusted repository with no saved decision | high | accept | D-PG10-01 option A, confirmed by the maintainer review 2026-11-16 | closed (accepted) |
| T-10-10 | Tampering | `:` or shell metacharacter in a bin path | medium | mitigate | upstream character class, path dropped | closed |
| T-10-11 | Tampering | bin kept after other stat error / swap | low | accept | D-PG10-22; appended, never prepended | closed |
| T-10-12 | Tampering | malformed `userConfig` via `--partial` | medium | mitigate | structural dirty -> `unavailable` | closed |
| T-10-13 | Spoofing | entry `userConfig` overriding plugin.json | low | mitigate | manifest wins; resolver tests | closed |
| T-10-14 | Tampering | option key rerouting a note | low | mitigate | `startsWith` before `includes` arms | closed |
| T-10-15 | Repudiation | reason token in one home only | medium | mitigate | token in every catalog; lock/parity tests | closed |
| T-10-16 | Info disclosure | `info` line showing more than keys | low | mitigate | keys only, identifier pattern | closed |
| T-10-17 | Tampering | hand-edited record `userConfig` | medium | mitigate | `recordedOptionsOf` reparses at each read | closed |
| T-10-18 | EoP | option overriding a path/session variable | medium | mitigate | prefixed names, spread order in hook-env.ts | closed |
| T-10-19 | Tampering | stale option schema after refresh/enable/move | low | mitigate | pin fields carry `userConfig` | closed |
| T-10-20 | EoP | option spliced into shell-form hook | high | mitigate | `ShellFormOptionReferenceError` before spawn; exec `shell:false` | closed |
| T-10-21 | Info disclosure | refusal message carrying a path | low | accept | cause through `redactAbsolutePaths` | closed |
| T-10-22 | Info disclosure | sensitive value in a staged skill | high | mitigate | `optionText` checks sensitive first | closed |
| T-10-23 | Tampering | default holding `$ARGUMENTS`/`$1` | low | accept | argument-substitution.ts note; BACKLOG USRCFG-01 | closed |
| T-10-24 | Tampering | spliced value filled twice | low | mitigate | single alternation pass | closed |
| T-10-25 | EoP | untrusted project state in Pi's env | high | mitigate | `ext/orchestrators/plugin-options.ts` reads project only when trusted | closed |
| T-10-26 | Tampering | ledger entry naming an unrelated variable | medium | mitigate | ledger pattern + owned-prefix filter | closed |
| T-10-27 | Info disclosure | option variables visible to bash and children | low | accept | D-PG10-11, confirmed by the maintainer review 2026-11-16; docs/env-vars.md | closed |
| T-10-28 | Info disclosure | another plugin reading an option variable | low | accept | BACKLOG USRCFG-01 precondition | closed |
| T-10-29 | Info disclosure | raw default expanded in url/header | high | mitigate | `serializeLiteral` escape; adapter-escape.test.ts | closed |
| T-10-30 | Tampering | server started with an unset option | medium | mitigate | five-field option block; `partitionOptionBlocked` | closed |
| T-10-31 | Info disclosure | notice carrying a value or control chars | low | mitigate | `printable` names; redaction arm | closed |
| T-10-32 | DoS | blocked server failing collision check | low | mitigate | partition before collision check | closed |
| T-10-33 | Info disclosure | option value in mcp-adapter.json | medium | mitigate | `ref` segment with no fallback | closed |
| T-10-34 | EoP | `!` default run by the adapter | high | mitigate | conformance OPTION_FIELD_CASES | closed |
| T-10-35 | Tampering | `~` default at start of command/args | low | mitigate | home-path block | closed |
| T-10-36 | Info disclosure | option reference treated as ordinary variable | medium | mitigate | option segments skip scanning | closed |
| T-10-37 | Tampering | stage deciding caFile/auth without option vars | low | mitigate | `adapterSubstitution` env | closed |
| T-10-38 | Repudiation | decision or release line overstating | medium | mitigate | D-PG10 rows locked by the maintainer review 2026-11-16; CHANGELOG wording | closed |
| T-10-39 | Tampering | edits outside this phase's lines | low | mitigate | numstat of PROJECT/BACKLOG/CHANGELOG | closed |
| T-10-40 | Info disclosure | upstream draft carrying a local path | low | mitigate | package-relative paths only | closed |
| T-10-41 | Repudiation | docs read as trust gap closed | medium | mitigate | docs/env-vars.md, hooks-compatibility.md wording | closed |
| T-10-42 | Info disclosure | user unaware children inherit option vars | low | mitigate | docs/env-vars.md section | closed |
| T-10-43 | Tampering | stored userConfig diverging from manifest | low | mitigate | `userConfigFieldsOf` sole producer | closed |
| T-10-44 | Info disclosure | option default in a result row or JSON | low | mitigate | row type declares no options | closed |
| T-10-45 | Tampering | hooks cache with another plugin's options | low | mitigate | options from the same resolution; required type member | closed |
| T-10-46 | Tampering | built-in registration with literal reference | medium | mitigate | `mcpOptionBlock` -> no config | closed |
| T-10-47 | DoS | home rule blocking a non-leading field | low | mitigate | stdio command/args only, anchored | closed |
| T-10-48 | Info disclosure | sensitive value in command/agent/preload | high | mitigate | every content site uses `substituteClaudeContent` | closed |
| T-10-49 | EoP | `!`/`$NAME` default run by built-in MCP | high | mitigate | `escapedForPi`; mcp-builtin-encoding-conformance.test.ts | closed |
| T-10-50 | Tampering | restage path passing no options | medium | mitigate | `options` required on `StageMcpInput` | closed |
| T-10-51 | Repudiation | `option-blocked` notice kept after unstage | low | mitigate | `describesUnstaged` drops it | closed |
| T-10-SC | Tampering | package installs (all plans) | high | mitigate | no package.json/lockfile change in the phase range | closed |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-10-01 | T-10-09 | D-PG10-01 option A: Pi auto-trusts a folder with none of its trust paths, so a repository that ships only this extension's files runs its project plugins, `bin`, and option variables unless the user saved "Do not trust". Option B (an extension consent record) is safer and was not taken. PITRUSTPATHS-01; request to Pi drafted, not filed. Confirmed by the maintainer review 2026-11-16. | autonomous discussion (D-PG10-01) | 2026-11-14 |
| AR-10-02 | T-10-27 | D-PG10-11: option variables are in Pi's process env, so the bash tool and every child see them. Confirmed by the maintainer review 2026-11-16. | autonomous discussion (D-PG10-11) | 2026-11-14 |
| AR-10-03 | T-10-06 | D-PG10-16: a user-scope skill or command gets the project path, as upstream. | plan threat model | 2026-11-14 |
| AR-10-04 | T-10-11 | D-PG10-22: a bin kept after a non-ENOENT stat error; entries are appended only. | plan threat model | 2026-11-14 |
| AR-10-05 | T-10-21 | Refusal message cause goes through `redactAbsolutePaths`. | plan threat model | 2026-11-14 |
| AR-10-06 | T-10-23 | Defaults are plugin-authored; user-set values wait on USRCFG-01. | plan threat model | 2026-11-14 |
| AR-10-07 | T-10-28 | Cross-plugin read of option variables; USRCFG-01 precondition. | plan threat model | 2026-11-14 |

*Accepted risks do not resurface in future audit runs.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-11-15 | 52 | 52 | 0 | gsd-security-auditor (ASVS 1, block_on high), at d086f3d9; 990 owner and conformance tests run green in a hermetic home |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-11-15; AR-10-01 and AR-10-02 confirmed by the maintainer review 2026-11-16
