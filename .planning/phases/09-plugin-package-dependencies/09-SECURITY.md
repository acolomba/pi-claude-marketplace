---
phase: "9"
slug: "plugin-package-dependencies"
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
created: "2026-10-27"
---

# Phase 9 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| plugin manifest files -> package manager | a plugin's package.json and lockfile drive npm ci / bun install | untrusted plugin-supplied JSON and dependency URLs |
| extension -> child process | `platform/package-manager.ts` spawns npm or bun with no shell | argv from a closed table; env allowlist |
| package manager -> network | npm/bun fetch tarballs from the registry the user's config names | package tarballs (integrity-checked by the lockfile) |
| package manager output -> user notes | stderr/stdout become a warning note | possibly absolute paths; cut to 500 chars and redacted |
| scenarios -> loopback npm stand-in | cucumber npm runs only reach 127.0.0.1 | test tarballs |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-09-01 | Elevation of privilege | package-install.ts table rows | high | mitigate | Every runnable row carries `--ignore-scripts` (package-install.ts lines 56 and 61) | closed |
| T-09-02 | Tampering | work dir in sources-staging | high | mitigate | The work dir holds only package.json and the lockfile; a unit case pins it | closed |
| T-09-03 | Tampering | platform/package-manager.ts spawn | high | mitigate | `shell: false`, argv from the closed table, command as a parameter (package-manager.ts line 162) | closed |
| T-09-04 | Denial of service | the state lock during the ledger | medium | mitigate | 60 s timeout, SIGTERM then SIGKILL after 5 s, asynchronous spawn | closed |
| T-09-05 | Tampering | writes outside the extension root | high | mitigate | `assertPathInside(locations.extensionRoot, pluginRoot)` gates the run; undo removes only what it created | closed |
| T-09-06 | Information disclosure | symlinked or oversized package.json or lockfile | medium | mitigate | lstat regular-file check and the 32 MB cap | closed |
| T-09-07 | Information disclosure | npm output in notes | low | mitigate | Notes cut to 500 characters and rendered through `redactAbsolutePaths` | closed |
| T-09-08 | Tampering | lockfile entries with git, file, or link sources | medium | accept | Sanitizer not ported (D-PL9-08, PKGDEP-03) | closed |
| T-09-09 | Repudiation | a new child_process importer drifting in unnoticed | medium | mitigate | `no-shell-out.test.ts` four-file whitelist, `child-process-chokepoint`, the BLOCK C zone; all green in the gate run | closed |
| T-09-10 | Information disclosure | credentials in npm error output | low | accept | No port of Claude Code's secret redactor (PKGDEP-03); notes capped and local | closed |
| T-09-11 | Denial of service | work dirs left in sources-staging | low | accept | The `finally` removes the work dir; a failed removal only costs disk | closed |
| T-09-12 | Information disclosure | npm in scenarios reaching the public registry | high | mitigate | The package-file step requires the loopback stand-in, which writes the sandbox `.npmrc` first | closed |
| T-09-13 | Denial of service | stand-in outliving its scenario | low | mitigate | 127.0.0.1 port 0; the world release closes connections and removes `.npmrc` | closed |
| T-09-14 | Tampering | spike files left in the tree | low | mitigate | Spike files removed by a `trap`; only the uncommitted `09-02-SPIKE.txt` line remains, by design | closed |
| T-09-15 | Tampering | writes into a path-source folder or through a symlinked segment | high | mitigate | Any `assertPathInside` rejection means no write and the D-PL9-03 note; the symlink case pins it | closed |
| T-09-16 | Denial of service | losing a working node_modules during an update | medium | mitigate | Park and restore; two restore cases | closed |
| T-09-17 | Tampering | a parked directory left beside the plugin's files | low | mitigate | The park lives in the work dir (`previous-node_modules`) | closed |
| T-09-18 | Information disclosure | the D-PL9-03 note naming an absolute folder | low | mitigate | `redactAbsolutePaths` shows the basename | closed |
| T-09-19 | Tampering | the update hook running outside the state lock while another process updates the same marketplace clone | low | accept | The update hook runs after the rename-based swap; the worst case is a failure note | closed |
| T-09-20 | Tampering | fixture writes outside the sandbox | low | mitigate | `writePublishedPluginFiles` refuses paths outside the publication; the lockfile step accepts three names only | closed |
| T-09-21 | Tampering | a RED edit committed by mistake | medium | mitigate | Every RED edit was restored; `git diff --quiet -- extensions` before each commit | closed |
| T-09-22 | Tampering | a fix that silences a gate (suppression marker, lowered threshold, skipped test) | medium | mitigate | This plan made no fix, so it added no suppression marker, lowered no threshold, and skipped no test | closed |
| T-09-23 | Repudiation | reporting green from a piped or backgrounded run | medium | mitigate | The exit code was written into the log and read back (`CHECK_EXIT=0`), and the log body was read | closed |
| T-09-24 | Information disclosure | scenarios reaching the public npm registry (the 09-02 T-09-12 risk, for this plan's scenarios) | high | mitigate | Every scenario that can spawn npm starts the loopback stand-in first; dir-marketplace scenarios spawn nothing | closed |
| T-09-SC | Tampering | npm/pip/cargo installs by this plan | low | accept | No plan of the phase added a dependency (`package.json` and `package-lock.json` unchanged since 0483948f) | closed |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-01 | T-09-08 | Sanitizer not ported (D-PL9-08, PKGDEP-03) | phase plan register (autonomous run) | 2026-10-27 |
| AR-02 | T-09-10 | No port of Claude Code's secret redactor (PKGDEP-03); notes capped and local | phase plan register (autonomous run) | 2026-10-27 |
| AR-03 | T-09-11 | The `finally` removes the work dir; a failed removal only costs disk | phase plan register (autonomous run) | 2026-10-27 |
| AR-04 | T-09-19 | The update hook runs after the rename-based swap; the worst case is a failure note | phase plan register (autonomous run) | 2026-10-27 |
| AR-05 | T-09-SC | No plan of the phase added a dependency (`package.json` and `package-lock.json` unchanged since 0483948f) | phase plan register (autonomous run) | 2026-10-27 |

*Accepted risks do not resurface in future audit runs.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-10-27 | 25 | 25 | 0 | orchestrator (L1 grep-depth: `--ignore-scripts` rows, `shell: false`, SIGKILL grace, `assertPathInside`, 500-char note cap, `child-process-chokepoint` rule, no dependency change since 0483948f) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-10-27
