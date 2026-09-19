---
phase: "03"
slug: "reachable-agent-collision-contract"
status: secured
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
created: "2026-09-19"
register_authored_at_plan_time: true
---

# Phase 03 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Source |
|----------|-------------|--------|
| Plugin source to generated filename | Local plugin names control scoped target names. | 03-02 |
| Ownership index to filesystem commit | New names may already identify unrelated local content. | 03-02 |
| Plugin markdown to discovery | Source files supply identities and paths reported in diagnostics. | 03-03 |
| Bridge warnings to lifecycle output | Users rely on the diagnostic to identify the retained file. | 03-03 |
| Legacy ownership data to newly generated names | A new target may be unrelated content or another owner's artifact. | 03-04 |
| Filesystem replacement to state persistence | A failure can occur after files have moved but before state is saved. | 03-04 |
| Source `tools:` declaration to emitted Pi allowlist | An explicit allowlist that maps to empty must not silently become the default-builtins grant. | 03-01 [retro] |
| Direct-coverage pin file to the quality gate | Removing a pin row can mask a real coverage shortfall in an unrelated owner. | 03-01 [retro] |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-03-01-R1 [retro] | Elevation of privilege | Agent tool-mapping conversion | high | mitigate | `extensions/pi-claude-marketplace/bridges/agents/convert.ts:533` calls `assertMappedToolsNonEmpty` before any emission; the runtime throw survives the assertion-function conversion at `convert.ts:632-650`. An explicit `tools:` mapping to empty still hard-fails rather than falling through to the omitted arm (which grants pi-subagents default builtins). | closed |
| T-03-01-R2 [retro] | Tampering | Agent tool-mapping conversion | medium | mitigate | The removed second throw was unreachable-by-construction and stays that way: `toolsFields` (`convert.ts:661`) is module-private, has exactly one call site (`convert.ts:582`, after line 533), and its parameter type is `ValidatedToolMapping`. No `as unknown` / `@ts-expect-error` / `eslint-disable` narrowing bypass in `convert.ts`. | closed |
| T-03-01-R3 [retro] | Tampering | Coverage pin file | medium | mitigate | `git show b663bc68 -- scripts/test-coverage-direct.pin.json` removes only the obsolete `bridges/agents/convert.ts` row (AG-11). Both unrelated rows (`commands/discover.ts` BC-019, `install-outcome.ts` D-08-A14) retain their readings, findingIds and reasons verbatim; no threshold field, exclusion, or new pin was added. | closed |
| T-03-02-01 | Tampering | Generated agent filename / name.ts | high | mitigate | `extensions/pi-claude-marketplace/domain/name.ts:162-166` retains `assertSafeName(plugin)`, `assertSafeName(source)`, and `assertSafeName(generated)`. Containment at staging is doubled: `stage.ts:214,222,224` plus `stage.ts:463/474/480` on the replacement path. | closed |
| T-03-02-02 | Tampering | Filesystem commit / stage.ts | high | mitigate | `stage.ts:339-346`: `previousTargets` built from the safe `_previousEntries` set; every new target outside it rejected via `lstat`-based `pathExists` before the `rm` loop (`stage.ts:348`). Tests `tests/bridges/agents/stage.test.ts:936-1043` parameterize file/dir/dangling-symlink/late-file/indexed-foreign-file obstacles. All commit entry points covered (`install-outcome.ts:768`, `update-swap.ts:837`, `reinstall-replace.ts:379`); `replacePreparedAgents({force:true})` guard (`stage.ts:492-500`) still derives `ownedNames` from `_previousEntries` only. | closed |
| T-03-02-03 | Denial of service | Filesystem commit / stage.ts | medium | mitigate | Sequential rename with `completedRenames` tracking and reverse rollback at `stage.ts:372-414`; rollback never throws, leaks surface via `appendLeaks`. Partial-failure proof at `tests/bridges/agents/stage.test.ts:1477-1546`. `saveAgentsIndex` moved inside the rollback boundary (`stage.ts:383-390`), pinned by four read-only-root EACCES cases (`stage.test.ts:764-869`). | closed |
| T-03-03-01 | Tampering | Agent discovery / discover.ts | high | mitigate | `discover.ts:80` gates on `isPlainMarkdownFile` (lstat symlink refusal + dotfile + `.md` filter); `discover.ts:86-87` hashes raw bytes; `discover.ts:93` calls `assertSafeName`. Pinned by `tests/bridges/agents/discover.test.ts:223` (symlink), `:72` (dotfile), byte-exact `sourceHash` assertions throughout. | closed |
| T-03-03-02 | Repudiation | Agent discovery / discover.ts | medium | mitigate | `discover.ts:38-48` `duplicateWarning` emits incoming name+path, generated name, incumbent name+path; invoked at `discover.ts:98-101`; propagates through `stage.ts:173` into `result.warnings`. Asserted end to end across `discover.test.ts`, `stage.test.ts`, and all three lifecycle owners (install/update/reinstall flow tests). | closed |
| T-03-04-01 | Tampering | Filesystem replacement / update-swap, reinstall | high | mitigate | `tests/orchestrators/plugin/update-swap.test.ts:28,120-150` and `tests/orchestrators/plugin/reinstall-flow.test.ts:687,740-742` assert unchanged old/foreign bytes and byte-identical index on occupied/conflict cases. Cross-owner conflicts still throw at prepare (`stage.ts:152-164`). | closed |
| T-03-04-02 | Denial of service | Filesystem replacement + state persistence | high | mitigate | `reinstall-flow.test.ts:743-752` asserts restored old target bytes, restored index text, restored `state.json` text, and `ENOENT` on the abandoned new name. Direct proof at `stage.test.ts:1610-1760` via `rollbackAgentsReplacement`. Index restore path: `stage.ts:606,610-626`. | closed |
| T-03-04-03 | Spoofing | Filesystem replacement / provenance identity | medium | mitigate | Coexistence cases compare complete generated bytes including the full provenance block: `stage.test.ts:1726-1735`, `update-swap.test.ts:211,222` assert per-agent `sourceAgent`/`sourcePath` in both index row and file bytes. | closed |
| T-03-03-03 | Information disclosure | Agent discovery diagnostics | low | accept | Duplicate-collision diagnostics embed absolute source file paths (`discover.ts:38-48`) and propagate to install/update/reinstall output and `state.json` notes. No remote transmission path exists in the agents bridge (verified: grep for `fetch(`/`http(s)://`/`node:http`/`undici`/`axios` across the five changed production files returns nothing). Accepted as a local-user diagnostic. | closed — accepted |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-03-01 | T-03-03-03 | Agent duplicate diagnostics embed absolute source file paths and propagate to install/update/reinstall output and `state.json` notes. These are local-user diagnostics required to identify which of two colliding files was retained; no remote transmission path exists in the agents bridge. | gsd-security-auditor (retroactive audit) | 2026-09-19 |

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-09-19 | 12 | 12 | 0 | gsd-security-auditor (retroactive, archived-milestone audit ahead of catch-up PR) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-09-19
