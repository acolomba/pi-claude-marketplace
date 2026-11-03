---
phase: "03"
slug: "slash-commands"
status: secured
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
created: "2026-11-01"
---

# Phase 03 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| Plugin files to staged command | A plugin's command files, `plugin.json` map, and marketplace entry become Pi prompt templates at install | Author-controlled Markdown and frontmatter |
| Typed input to the model | A user's `/<plugin>:<cmd> <args>` (interactive or RPC) is filled and its `!` commands run before the model sees it | User arguments, shell command output |
| Repository to project scope | A cloned repository can carry `.pi/pi-claude-marketplace/` staged commands | Untrusted staged files |
| User-scope ledger | `<agentDir>/pi-claude-marketplace/project-installs/<sha256>/skills.json` records which project commands this user installed | Command names, file digests |

---

## Threat Register

Mitigation evidence (file:line) is in the 2026-11-01 auditor verdict, summarized from the `<threat_model>` blocks of 03-01..03-09.

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-03-01 | Tampering | `bridges/commands/staged-command.ts` frontmatter rebuild | medium | mitigate | One JSON line per key; read-back through Pi's parser throws `BridgeStagingError` | closed |
| T-03-02 | Tampering | reference rewrite or substitution reading the record | medium | mitigate | Record added after substitution; author value under the key dropped | closed |
| T-03-03 | Information disclosure | absolute plugin paths in staged frontmatter | low | accept | See accepted risks | closed |
| T-03-04 | Repudiation | ignored frontmatter fields | medium | mitigate | D-CF1-05 dropped-fields install warning | closed |
| T-03-05 | Information disclosure | dropped-fields line | low | accept | See accepted risks | closed |
| T-03-06 | Elevation of privilege | `edge/command-invocation.ts`, `extension` input | high | mitigate | `extension` input returns `continue` before any read | closed |
| T-03-07 | Elevation of privilege | typed arguments forming a `!` command | high | mitigate | Substitution runs before injection; `guardBangs` escapes `!` in every value | closed |
| T-03-08 | Information disclosure | failing `!` command output | medium | mitigate | `ContextInjectionError` becomes a usage error; nothing reaches the model | closed |
| T-03-09 | Spoofing | user template with a staged-looking name | low | mitigate | Exact staged-path match; anything else keeps Pi's expansion | closed |
| T-03-10 | Denial of service | oversized invocation or runaway `!` command | medium | mitigate | 4,000,000-character cap; 120 s kill in the prompt shell | closed |
| T-03-11 | Tampering | body starting with `/<template>` re-expanded (E8) | low | accept | See accepted risks | closed |
| T-03-12 | Elevation of privilege | RPC client typing a command with `!` commands | medium | accept | See accepted risks | closed |
| T-03-13 | Tampering | declared command file that is a link or device | medium | mitigate | `lstat` and `declaredFileRefusal`; resolver containment refuses symlinks | closed |
| T-03-14 | Tampering | entry-declared `commands` adding to `commands/` | low | accept | See accepted risks | closed |
| T-03-15 | Elevation of privilege | disabled or uninstalled plugin's command still run | medium | mitigate | Unstage on uninstall, disable, marketplace remove; refusal when the staged file is gone | closed |
| T-03-16 | Tampering | ledger write over unreadable content | medium | mitigate | `ProjectSkillLedgerError` before any write; commit fails | closed |
| T-03-17 | Denial of service | ledger failure blocking uninstall or disable | medium | mitigate | Files removed first; ledger failure becomes a warning | closed |
| T-03-18 | Tampering | failed update keeps the new digests | low | accept | See accepted risks | closed |
| T-03-19 | Information disclosure | ledger lists hashed project paths and command names | low | accept | See accepted risks | closed |
| T-03-20 | Elevation of privilege | cloned repository's project command running `!` commands | high | mitigate | Trust check plus ledger digest check before render; fails closed | closed |
| T-03-21 | Tampering | staged command edited after install | high | mitigate | Ledger digest of the committed file must equal the digest of the file now | closed |
| T-03-22 | Tampering | file changed between check and fill | medium | mitigate | One read feeds both the digest and the fill | closed |
| T-03-23 | Tampering | plugin script a `!` command runs changed after install | medium | accept | See accepted risks | closed |
| T-03-24 | Tampering | map `source` absolute, escaping, or linked | medium | mitigate | `validateComponentPath`; `lstat` and refusals before any read | closed |
| T-03-25 | Spoofing | map key with hidden or bidi characters | low | mitigate | `\p{Cf}` keys skipped; hidden characters rendered `\u{XXXX}` | closed |
| T-03-26 | Tampering | manifest override forming new frontmatter keys | medium | mitigate | Overrides go through the same JSON-line rebuild and read-back | closed |
| T-03-27 | Denial of service | map key with `:` failing the install on Windows | low | accept | See accepted risks | closed |
| T-03-28 | Information disclosure | drafted Pi gap report | low | mitigate | Kept as "not filed" text in `03-09-SUMMARY.md` | closed |
| T-03-29 | Tampering | gate fix that weakens a test | medium | mitigate | No gate fix; no skipped or focused tests | closed |
| T-03-SC | Tampering | package installs | low | accept | See accepted risks | closed |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-03-01 | T-03-03 | The staged body already contains the same absolute paths (CM-3 substitution); the record is frontmatter Pi does not send | plan 03-01 threat model; orchestrator | 2026-11-01 |
| AR-03-02 | T-03-05 | The line names frontmatter keys only, never values | plan 03-02 threat model; orchestrator | 2026-11-01 |
| AR-03-03 | T-03-11 | Pi expands a returned text a second time; no safe mechanism in Pi 1.4.0; D-CF1-01 residual in the Pi gap report | plan 03-03 threat model; orchestrator | 2026-11-01 |
| AR-03-04 | T-03-12 | RPC is a user-controlled entry point, as upstream print mode is (D-CF3-06) | plan 03-03 threat model; orchestrator | 2026-11-01 |
| AR-03-05 | T-03-14 | Upstream parity (E4); entry paths stay inside the plugin root | plan 03-04 threat model; orchestrator | 2026-11-01 |
| AR-03-06 | T-03-18 | Same residual as the skills bridge; the digests are of files this user's own update staged | plan 03-06 threat model; orchestrator | 2026-11-01 |
| AR-03-07 | T-03-19 | The ledger lives in the user's own agent directory; project paths are hashed | plan 03-06 threat model; orchestrator | 2026-11-01 |
| AR-03-08 | T-03-23 | The digest covers the staged command file only (skills cover the staged directory); recorded residual and parent line | plan 03-07 threat model; orchestrator | 2026-11-01 |
| AR-03-09 | T-03-27 | The install fails cleanly through `BridgeStagingError` and its rollback; parent line | plan 03-08 threat model; orchestrator | 2026-11-01 |
| AR-03-10 | T-03-SC | No package is installed or changed in this phase | plans 03-01..03-09 threat models; orchestrator | 2026-11-01 |

*Accepted risks do not resurface in future audit runs.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-11-01 | 30 | 30 | 0 | gsd-security-auditor (ASVS L1; T-03-06, 07, 20, 21 traced end to end) |

Auditor notes kept for review: the `!` output size is uncapped (a pre-existing D-CF1-02 residual, outside T-03-10's stated mitigation); `orchestrators/plugin/info.ts` lists entry names from declared directories of an unavailable plugin without containment (pre-existing, shared across kinds, names only).

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
