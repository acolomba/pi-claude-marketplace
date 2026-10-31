---
phase: "02"
slug: "adapter-file-delivery"
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
created: "2026-10-06"
---

# Phase 02 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| user / pi-mcp-adapter -> `mcp-adapter.json` -> bridge | The user edits the file and the adapter writes it (panel, `/mcp-adapter disable`); the bridge parses it, keeps overrides and writes them back | Untrusted JSONC, may hold credentials (`env`, `headers`, tokens) |
| user stub / previous entry -> new entry | Values the user or the adapter wrote are copied into what this extension writes | Carried fields; credential fields only inside the inert marker |
| plugin entry -> pi-mcp-adapter | Whatever the entry holds reaches the adapter, which starts servers and resolves secrets from named fields | Commands, URLs, env |
| user-global and project config files -> collision walk | Nine files the user, other tools and the adapter edit | Untrusted JSONC |
| project file -> ancestor discovery | A project-controlled file must not widen which files are read | Directory roots |
| one scope's write-back -> the other scope's file | A project-scope operation must not touch the user-scope file | Override entries |
| ledger undo / prune rollback -> shared config file | The rollback rewrites a file other writers also edit | Exact prior bytes |
| bridge facts / override content -> user-visible notice or failure row | File facts and field names become text the user reads | Scope, basename, plugin, server and field names; never values or paths |
| npm registry -> runtime dependency / proof scratch root | `strip-json-comments` runs in every install; the proof unpacks the pinned adapter tarball | Package code |
| source comment -> maintainer | A citation sends a reader to a decision or requirement | Traceability IDs |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-02-SC (02-01) | Tampering | `strip-json-comments@^5.0.3` install | high | mitigate | Legitimacy audit OK (the adapter's own dependency); no install scripts; lockfile entry carries its integrity hash | closed |
| T-02-SC (02-10) | Tampering | `npm pack pi-mcp-adapter@5.0.0` for the proof | high | mitigate | Tarball used only at pinned sha1 `6c20461d…`; nothing installed into the project; scratch HOME outside the repo; `tmp/p2-10-adapter-proof.log` ends `ADAPTER_PROOF=ok` | closed |
| T-02-SC (02-02..09, 11, 12) | Tampering | npm/pip/cargo installs | low | accept | These plans install no package | closed |
| T-02-01 | Tampering / DoS | stage over an unparseable shared file | high | mitigate | `readMcpConfigDoc` refuses with `McpConfigFileError`; stage and unstage tests assert identical bytes after each refusal | closed |
| T-02-02 | Information disclosure | `McpConfigFileError` message and cause | medium | mitigate | Fixed messages; `SyntaxError` never attached; `sk-secret-abc` fixture asserted absent | closed |
| T-02-03 | Tampering | server-key choice in `withPluginServers` | medium | mitigate | Adapter's key rule; byte tests for `mcp-servers`-only and both-key files | closed |
| T-02-04 | Tampering | `__proto__` server names | low | mitigate | `safeSet` on every copy; adapter-doc tests include a `__proto__` name | closed |
| T-02-05 | Elevation of privilege | write target outside the NFR-10 set | low | mitigate | `mcpAdapterJsonPath` is a fixed suffix on `scopeRoot` in `persistence/locations.ts` | closed |
| T-02-06 | Tampering | symlinked `mcp-adapter.json` | low | accept | D-02-16 (see Accepted Risks) | closed |
| T-02-07 | Spoofing | stage collision check | medium | mitigate | Every other full definition in the nine sources refuses and names the winning source | closed |
| T-02-08 | Elevation of privilege | `collision-ancestors.ts` | medium | mitigate | `ancestorConfigRoots` read from user-global sources only; roots realpath inside HOME and contain cwd; skip tests | closed |
| T-02-09 | DoS | unreadable foreign sources | low | mitigate | An unparseable source contributes nothing; `EACCES` propagates; both tested in `collision-slots.test.ts` | closed |
| T-02-10 | Tampering | legacy sweep in `unstage.ts` | medium | mitigate | Marker-keyed removal; both files read before either write; exact remaining bytes asserted | closed |
| T-02-11 | Information disclosure | carry-forward and stub absorption | high | mitigate | `CARRIED_FIELDS` holds no credential field; 34-key pin and stub cases assert credential fields never cross | closed |
| T-02-12 | Tampering (integrity) | prepare-to-commit window | low | accept | See Accepted Risks | closed |
| T-02-13 | Tampering | plugin-supplied values in carried fields | low | accept | D-02-06; Phase 3 carrier in ROADMAP; D-02-23 keeps plugin-declared carried fields out of write-back | closed |
| T-02-14 | Information disclosure | `notifyMcpConfigNotices` text | low | mitigate | Scope and closed basename only; byte lock in `mcp-config-notices.test.ts` | closed |
| T-02-15 | Tampering | failed install over a commented file | medium | mitigate | Exact prior-byte restore; fault-injection tests compare bytes and assert the rollback partial | closed |
| T-02-16 | Tampering (integrity) | byte restore between commit and undo | low | accept | See Accepted Risks | closed |
| T-02-17 | Repudiation | update and reinstall comment loss | medium | mitigate | Notice rides each outcome; `AFILE-04` whole-`notifications` cases in update-flow and reinstall-flow | closed |
| T-02-18 | Repudiation | uninstall, prune, marketplace remove comment loss | medium | mitigate | Per-file unstage report carried by `cascadeUnstagePlugin`; `AFILE-04` cases per verb | closed |
| T-02-19 | DoS | unstage refusal on an unparseable file | low | accept | D-02-14 (see Accepted Risks) | closed |
| T-02-20 | Repudiation | enable, disable, cascade-undo comment loss | medium | mitigate | Notices thread through explicit result types; `AFILE-04` cases in enable-disable | closed |
| T-02-21 | Repudiation | reconcile, import, marketplace update comment loss | medium | mitigate | Every bucket copies its notices; `AFILE-04` cases in apply, import, marketplace update | closed |
| T-02-22 | DoS (noise) | repeated notices across a cascade | low | mitigate | Seam renders one distinct line per notice; `apply.test.ts` "both rewrite one commented mcp-adapter.json shows one notice" | closed |
| T-02-23 | Spoofing | same-owner collision exemption | low | accept | D-02-17 (see Accepted Risks) | closed |
| T-02-24 | Repudiation (traceability) | rollback comments and test titles | low | mitigate | `rg 'D-02-(19\|20\|21\|22\|23)' extensions tests` prints nothing; v1.20 `D-02-0x` count is 11 | closed |
| T-02-25 | Information disclosure | stamping an absorbed override | high | mitigate | Active fields = translated entry + `CARRIED_FIELDS`; override only in `keptOverride`; integration asserts `stub-secret` only inside the marker | closed |
| T-02-26 | Tampering | write-back of a hand-edited `keptOverride` | medium | mitigate | `restorableOverride` writes back only an `isOverlay` value; owner tests cover each rejected shape | closed |
| T-02-27 | Elevation of privilege | adapter reading inside the marker | high | mitigate | Source read plus executable proof against pinned 5.0.0 (`ADAPTER_PROOF=ok`); floor-tie test demands a re-proof on a floor bump | closed |
| T-02-28 | Tampering (integrity) | lost or duplicated override on key move or dropped server | medium | mitigate | One write-back table (`keptServers`/`keptOverrides`); owner tests cover restage, dropped server, key move | closed |
| T-02-29 | Repudiation (approval identity) | adapter approval hash covers the marker | low | accept | See Accepted Risks | closed |
| T-02-30 | Tampering (integrity) | prepare-to-commit window inside the marker | low | accept | See Accepted Risks | closed |
| T-02-31 | Information disclosure | override-kept notice line | medium | mitigate | Field names only; install-flow asserts the stub secret in no notification; seam byte tests | closed |
| T-02-32 | Repudiation | warning for an override the same command wrote back | medium | mitigate | `override-restored` cancels the matching keep in the seam fold; landed-disabled and failed-cascade cases | closed |
| T-02-33 | Spoofing | crafted server or field name in notice text | low | accept | See Accepted Risks | closed |
| T-02-34 | Tampering (integrity) | prune rollback after a write-back | medium | mitigate | Rollback compares against the recorded bytes, which include the write-back; NFR-3 case restores the entry with its `keptOverride` | closed |
| T-02-35 | Spoofing | collision walk meeting a written-back override | medium | mitigate | Write-back is always partial; integration reinstalls at user scope over the project override without refusal | closed |
| T-02-36 | Tampering | project write-back reaching the user-scope file | medium | mitigate | Write-back inside `withPluginServers` for the source file; integration asserts user-file bytes unchanged at every project step | closed |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-02-01 | T-02-06 | D-02-16: keep `write-file-atomic`'s write-through-symlink behavior, as for `mcp.json`; NFR-10 containment does not check the link target | operator | 2026-10-03 |
| AR-02-02 | T-02-12, T-02-30 | A concurrent adapter edit between prepare and commit is overwritten; the same window update and reinstall already accept (backstop truth) | operator (plan approval) | 2026-10-03 |
| AR-02-03 | T-02-13 | D-02-06 closed carried set is locked; plugin-written carried values are a Phase 3 decision (ROADMAP carrier); D-02-23 already keeps plugin-declared carried fields out of the user's restored stub | operator | 2026-10-04 |
| AR-02-04 | T-02-16 | A concurrent adapter write between commit and undo is overwritten; the same window reinstall accepts | operator (plan approval) | 2026-10-03 |
| AR-02-05 | T-02-19 | D-02-14: unstage keeps refusing on an unparseable file, so uninstall is blocked until the user fixes it; the refusal names the file and leaves its bytes (fail-clean) | operator | 2026-10-02 |
| AR-02-06 | T-02-23 | D-02-17: an entry marked for the same `(plugin, marketplace)` never collides; a hand-copied marker suppresses the refusal, but only this extension writes the marker and the user still sees one effective server | operator | 2026-10-03 |
| AR-02-07 | T-02-29 | The adapter's project-approval hash is identity only and already covers `plugin`/`marketplace`; the kept override is set at creation and carried unchanged, so it adds no prompt beyond the install | operator (plan approval) | 2026-10-03 |
| AR-02-08 | T-02-33 | Names come from the user's own config and reach only that user's text UI; the notice carries no link or command | operator (plan approval) | 2026-10-03 |

*Accepted risks do not resurface in future audit runs.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-10-06 | 39 | 39 | 0 | secure-phase orchestrator (L1 grep evidence; auditor skipped by the ASVS 1 short-circuit) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-10-06
