---
phase: "8"
slug: "clear-milestone-debt"
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
created: "2026-10-10"
---

# Phase 8 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

Built from the 21 plan-time `<threat_model>` blocks and the SUMMARY threat
flags (all "None"). A security auditor checked every mitigation at grep and
read depth. It ran the mitigation suites (1544 pass), the architecture locks,
the adapter conformance cases against pi-mcp-adapter 5.2.0 and the fallow
audit (verdict pass). `ext/` stands for `extensions/pi-claude-marketplace/`.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| pi-mcp-adapter status event → info renderer | Adapter status tokens shown by `info` | untyped status strings |
| Marketplace manifest → info and state | Plugin and marketplace names become rows and state keys | untrusted names |
| User CLI ref → state lookups | `<plugin>@<marketplace>` refs select records | untrusted names |
| User config files → migration and bridge | `mcp.json`, `mcp-adapter.json` read and rewritten | user-owned JSON |
| Plugin MCP config → `mcp-adapter.json` entry | Headers, OAuth fields, URLs written for the adapter | possibly credential-bearing values |
| Process and staging environment → staged entries | Variable expansion at install, update, reinstall, migration | environment values |
| Plugin clone cache → source choice | Recorded-sha clone used when a mirror HEAD is unreadable | on-disk git objects |
| Pi session context → process environment | `CLAUDE_PROJECT_DIR` for the adapter | paths |
| Other MCP config sources → collision check | Foreign server keys | user-owned JSON |
| Operator machine → live-UAT stub; e2e harness → local processes | Test-only drivers | request metadata, PIDs |
| Docs and planning records → users and future agents | Claims about behavior and dispositions | prose |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-08-01 | Spoofing | `withCompanionRequirements` (info.ts) | low | mitigate | `ext/orchestrators/plugin/info.ts:2982` counts only supported MCP entries; info.test.ts:7052, 7076; 9a8cf3a1 | closed |
| T-08-02 | Tampering | `statusToken` (info-mcp-status.ts) | low | accept | Unknown status mapped to `unrecognized` in `lookup` (`ext/platform/mcp-status.ts:127`); AR-08-01 | closed |
| T-08-03 | Spoofing | `printable` in notices | medium | mitigate | `printable` (`ext/shared/notification-dispatch.ts:657`) on every migration-row name (e0187b8b); MCP config-notice lines escape plugin and server names after the audit follow-up (0717559f; notification-dispatch.test.ts U+2028/U+202E cases) | closed |
| T-08-04 | Repudiation | `notifyMcpMigration` | low | mitigate | Notices sent for a report with no rows (notification-dispatch.ts:897-901); e0187b8b | closed |
| T-08-05 | Denial of service | `clearProjectStubs` | low | mitigate | Failed stub probe gives one `unfinished` row per owner, no legacy removal (mcp-migration.ts:643-662); 70f91bd8 | closed |
| T-08-06 | Information disclosure | `source-outdated` row | low | mitigate | Row type has no path field; names through `printable`; 14c70964 | closed |
| T-08-07 | Information disclosure | choice-store capture | high | mitigate | `CARRIED_FIELDS` excludes env, headers, auth, oauth, url, command (`ext/bridges/mcp/adapter-entry.ts:45-57`); capture uses only that set (adapter-doc.ts:494-527); adapter-doc.test.ts:1073 seeds env and headers; fb345e31, 00e310e7 | closed |
| T-08-08 | Elevation of privilege | `storedChoicesFor` consume | high | mitigate | Only the recording plugin reuses a choice (adapter-doc.ts:482, 604-606); adapter-doc.test.ts:1235, mcp-override-lifecycle.test.ts:785 | closed |
| T-08-09 | Tampering | unstage legacy target | medium | mitigate | Only `mcp-adapter.json` keeps choices (unstage.ts:162-163) | closed |
| T-08-10 | Tampering | malformed store member | low | mitigate | `readChoiceStore` returns undefined, member kept as-is (adapter-doc.ts:437-447, 598-601) | closed |
| T-08-11 | Denial of service | `probeReinstallClone` | low | mitigate | Unreadable HEAD falls back to recorded-sha clone (reinstall-clone-probe.ts:46-102); 32bf8982 | closed |
| T-08-12 | Information disclosure | recorded-sha probe on /reload | medium | mitigate | File reads only; no `platform/git` import; BLOCK F applies (git-source-probe.ts:204-216); 5ba2752c | closed |
| T-08-13 | Spoofing | `applyMcpAdapterEnv` | medium | mitigate | Deletes `CLAUDE_PROJECT_DIR` before rethrowing (session-env.ts:121-126); 34fdb040 | closed |
| T-08-14 | Tampering | `holdsBytes` | low | mitigate | One guarded read; ENOENT/ENOTDIR/EISDIR refuse (prune-rollback.ts:247-289); b86ad6d3 | closed |
| T-08-15 | Repudiation | `fallow-ignore` markers | low | mitigate | 22 markers, each with a reason, matching CONVENTIONS.md; 5d8d0c8f | closed |
| T-08-16 | Information disclosure | OpenAI stub error handler | low | accept | Prints `error.message` only, binds 127.0.0.1; AR-08-02 | closed |
| T-08-17 | Denial of service | e2e `readPid` | medium | mitigate | Positive integer only (adapter-detection-rpc.test.ts:298-305); 6906fc3b | closed |
| T-08-18 | Tampering | `scripts/pi.sh` default home | low | mitigate | Session dir defaulted only on the default-home path (pi.sh:224-226); 64a49e4d | closed |
| T-08-19 | Repudiation | enable and import row severity | low | mitigate | Pinned adapter-loaded shapes (enable-disable.test.ts:7408, execute.test.ts:2034); f1a31171, 6a85e010 | closed |
| T-08-20 | Tampering | state writes keyed by manifest names | high | mitigate | `__proto__` refused (`ext/domain/name.ts:66-68`, plugin-resolver.ts:517-525, add.ts:333-337); `setOwn` defines properties (`ext/shared/own-key.ts`); c8faf222, 9e36c694 | closed |
| T-08-21 | Denial of service | `marketplace add` duplicate check | medium | mitigate | `ownValue` replaces `in` (add.ts:338); c8faf222 | closed |
| T-08-22 | Elevation of privilege | `authField` | medium | mitigate | Any key lower-casing to `authorization` writes no `auth`; plugin `auth` never copied (mcp-server-features.ts:82-169); 8cd7175f | closed |
| T-08-23 | Denial of service | header cleanliness | medium | mitigate | `withOAuthDecision` drops `auth` for unclean headers (adapter-entry.ts:90-155); conformance against 5.2.0; 8cd7175f, 57182472 | closed |
| T-08-24 | Information disclosure | the `auth` decision | low | mitigate | Reads only whether a variable is set; writes no value (adapter-entry.ts:84-118) | closed |
| T-08-25 | Spoofing | `authServerMetadataUrl` | low | mitigate | `URL.canParse` check, malformed otherwise (mcp-server-features.ts:117-123, 393-397); 3c686fca | closed |
| T-08-26 | Information disclosure | install staging environment | low | mitigate | `env` passed explicitly; defaults only at factories; f2bde391, e616660b | closed |
| T-08-27 | Information disclosure | update, reinstall, migration staging | low | mitigate | Defaults only at entry factories; threaded through swap and replace; 473f9dea, aa5419ed, 76bf597f | closed |
| T-08-28 | Tampering | `assertNoMcpCollisions` | medium | mitigate | Only the exact owned key is exempt (stage.ts:204-209); 94097beb | closed |
| T-08-29 | Repudiation | stage notices | low | mitigate | `override-restored` notice on stage (stage.ts:291); 94097beb | closed |
| T-08-30 | Information disclosure | staging environment | low | mitigate | No `process` use under `ext/bridges/mcp/`; `StageMcpInput.env` required; 84ff4aa0 | closed |
| T-08-31 | Repudiation | user docs | low | mitigate | Each claim names its reason (docs/mcp-compatibility.md:118, 135, 198, 395); 73200878, de427118, c2e89982 | closed |
| T-08-32 | Denial of service | `info x@constructor`, marketplace reads | medium | mitigate | Own-key reads (scope-fanout.ts:79-100, marketplace/shared.ts, info.ts:3029); b7ef10e7 | closed |
| T-08-33 | Spoofing | plugin target resolution | medium | mitigate | Own-key reads (info.ts, plugin/shared.ts, edge-deps.ts); b7ef10e7, 150dc7df | closed |
| T-08-34 | Tampering | state phase and disable writes | high | mitigate | `setOwn` at every state-map write in install and enable families; 841b15fc, 309f84e4 | closed |
| T-08-35 | Tampering | reinstall record, update and reinstall selection | high | mitigate | `ownValue`/`setOwn` across reinstall, update and list; 1c9f5b44, 57a41582 | closed |
| T-08-36 | Tampering | import, autoupdate, reconcile | high | mitigate | `setOwn`/`ownValue` in import, autoupdate, config write-back, reconcile; 954da5a4, ac4aceb5, 5ab12f70 | closed |
| T-08-37 | Repudiation | the own-key sweep | low | mitigate | `tests/integration/reserved-record-keys.test.ts` (14 cases); whole-tree grep leaves only `delete` lines; 2ac3d844, dfe0ae9d | closed |
| T-08-38 | Tampering | `isPlainObject`, `readMarker` | low | mitigate | One bridge `isPlainObject` (marker.ts:41-43); 8578407a, d45f5b5d | closed |
| T-08-39 | Repudiation | review disposition ledgers | low | mitigate | All seven ledgers read `open: 0`; parser-enum footer on 02-05; c3ee0035, a0ec3c7a, f47a2c9e | closed |
| T-08-40 | Tampering | fallow audit gate | medium | mitigate | No `ignoredClones`; audit verdict pass, 0 introduced | closed |
| T-08-SC | Tampering | package installs (all 21 plans) | high | accept | No manifest change in the phase range; AR-08-03 | closed |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-08-01 | T-08-02 | An unknown adapter status is mapped to `unrecognized` in `lookup` before `statusToken` indexes its table, so a hostile status cannot reach the renderer as a token | plan-time threat model, checked by audit | 2026-10-10 |
| AR-08-02 | T-08-16 | The operator-run stub prints only `error.message` and binds to 127.0.0.1 | plan-time threat model, checked by audit | 2026-10-10 |
| AR-08-03 | T-08-SC | No plan installs a package; `git diff a3576cfe..HEAD -- package.json package-lock.json` is empty | plan-time threat model, checked by audit | 2026-10-10 |

*Accepted risks do not resurface in future audit runs.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-10-10 | 41 | 40 | 1 (T-08-03, medium, non-blocking) | gsd-security-auditor (ASVS L1) |
| 2026-10-10 | 41 | 41 | 0 | orchestrator: T-08-03 closed by 0717559f (plugin and server names escaped in all five MCP config-notice lines) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-10-10
