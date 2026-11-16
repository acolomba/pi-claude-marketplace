---
phase: "11"
slug: "skills-commands-and-records"
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
created: "2026-11-15"
---

# Phase 11 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Threats |
|----------|-------------|---------|
| Command frontmatter -> staged record and alias table | The author controls the record key and the names; the alias reader trusts only the record that install wrote, under the plugin's own prefix | T-11-01..03 |
| Plugin frontmatter text -> Pi's terminal menu | Author text goes into a row's description only, drawn on one line; never a value or a label | T-11-04, T-11-05 |
| Typed or forwarded arguments and `!` output -> files the extension reads | Neither may choose a file; the scan input is the authored body with only its variables filled | T-11-10, T-11-11, T-11-17 |
| Author body mentions -> user filesystem and model prompt | The author picks the files; a qualifying file is regular, at most 262,144 bytes, with no NUL; content stays out of logs | T-11-06..09, T-11-12, T-11-14, T-11-15, T-11-18 |
| Untrusted project and the model's own paths -> attachment step | An untrusted project reads no file; `fillSkillRead` and `run_plugin_command` never attach | T-11-13, T-11-19, T-11-20 |
| Records and docs -> the reader who decides from them | Each claim says how it was found; each status row cites a passing scenario | T-11-21..26 |

---

## Threat Register

Evidence for each row (file:line and test names) is in the auditor's verdict of 2026-11-15. `ext/` = `extensions/pi-claude-marketplace/`.

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-11-01 | Spoofing | planted `claudeName` in source frontmatter | medium | mitigate | `ext/bridges/commands/command-record.ts` replaces the whole key; `storedClaudeName` keeps only the plugin's own prefix, no whitespace; command-record, staged-command, skill-alias-state owner cases | closed |
| T-11-02 | Spoofing | stored name taking a reserved or claimed name | medium | mitigate | `reserved` + first-claim-wins in `skill-alias-state.ts`, skills claim first; owner cases | closed |
| T-11-03 | Tampering | grown record vs `assertReadsBack` / older file | medium | mitigate | optional schema member, fixed member order; round-trip and two-member cases | closed |
| T-11-04 | Spoofing | author text imitating another alias row | low | mitigate | text only in `description`; pi-tui `normalizeToSingleLine`; skill-aliases.test.ts | closed |
| T-11-05 | Tampering | object hint reaching the menu | low | mitigate | `argumentHint` scalar-only; table loop in skill-alias-state.test.ts | closed |
| T-11-06 | Info disclosure | mention in `!` text or example code | medium | mitigate | `ext/domain/file-mentions.ts` fence and span masks; file-mentions.test.ts | closed |
| T-11-07 | Denial of service | slow scan of a hostile body | medium | mitigate | linear expressions, one pass per rule; `sonarjs/slow-regex` at error | closed |
| T-11-08 | Tampering | content holding a closing tag | low | accept | AR-11-01; pinned by file-mentions.test.ts | closed |
| T-11-09 | Info disclosure | binary or oversized content | medium | mitigate | `renderMentionBlock` limit 262,144 bytes and NUL check; both sides tested | closed |
| T-11-10 | Info disclosure | argument names a file | high | mitigate | scan input `args: undefined` (D-PG11-02); `@$ARGUMENTS` case; `slash-command/invocation.feature:377` | closed |
| T-11-11 | Info disclosure | `!` output names a file | high | mitigate | scan input built before `expandContextInjections`; Outline row in `slash-command/invocation.feature:402`, recorded red under a rendered-text scan | closed |
| T-11-12 | Denial of service | FIFO, device, or growing file | medium | mitigate | `stat` first, regular files only, bounded read of 262,145 bytes; growth, directory, size, symlink cases. Residual: stat/open window needs local write as the user | closed |
| T-11-13 | Elevation of privilege | untrusted project command reads files | high | mitigate | attachment only in `renderCommand`, after `prepareCommand`'s refusal; D-LOC-01 `asked: []` case | closed |
| T-11-14 | Info disclosure | author mentions a private user file | medium | accept | AR-11-02 | closed |
| T-11-15 | Info disclosure | content in debug log or notice | low | mitigate | no notify import; debug line holds path and cause only; whole-log assertion | closed |
| T-11-16 | Repudiation | guard scenario that cannot fail | medium | mitigate | red runs recorded in 11-04 and 11-05 SUMMARYs (process evidence) | closed |
| T-11-17 | Info disclosure | skill wiring scans filled text | high | mitigate | `skill-invocation.ts` scan input `args: undefined`; `@$ARGUMENTS` case; `skill/invocation.feature:375` | closed |
| T-11-18 | Spoofing | file blocks after the skill block's closing line | medium | mitigate | attached text is the body argument of `skillBlock`; owner case and `skill/invocation.feature:350` | closed |
| T-11-19 | Elevation of privilege | untrusted project skill reads files | high | mitigate | trust abort before `fillSkill`; T-02-17 `asked: []` case | closed |
| T-11-20 | Info disclosure | model's skill read or `run_plugin_command` attaches | high | mitigate | `fillSkillRead` and `expandStagedCommand` never attach (D-PG11-07); two `asked: []` cases | closed |
| T-11-21 | Repudiation | unverified claim stated as fact | medium | mitigate | sources and versions named; codemode reach and `/reload` order marked unmeasured | closed |
| T-11-22 | Tampering | comment edit that changes code | medium | mitigate | the three sources changed only in comment lines (253ce6db) | closed |
| T-11-23 | Info disclosure | `bin` on `PATH` for hooks and MCP servers | low | mitigate | `docs/env-vars.md` states it as divergence D-PG11-10 | closed |
| T-11-24 | Repudiation | pending decision recorded as settled | medium | mitigate | D-PG11-01..03 rows hold "pending maintainer review", versions, license; S8 cell says no session ran | closed |
| T-11-25 | Repudiation | stale or wrong status citation | medium | mitigate | citation check (every citation is a `Scenario` line); full gate runs each cited scenario | closed |
| T-11-26 | Info disclosure | page understates file attachment reach | medium | mitigate | `docs/skills-commands-compatibility.md` states reach, no approval, no `PreToolUse`, and the three recorded differences | closed |
| T-11-SC | Tampering | npm/pip/cargo installs | high | mitigate | no change to `package.json`, `package-lock.json`, `sonar-project.properties` across the phase commits | closed |

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-11-01 | T-11-08 | File content can hold `</file>` or `</skill>`. The model gets the same text Pi's own file form gives; only Pi's display of a skill block can shift. Pinned by an owner case so a change is deliberate. | plan threat model | 2026-11-15 |
| AR-11-02 | T-11-14 | A plugin author's mention can name any file the user can read, with no approval and no `PreToolUse` hook. The `!` commands of the same body already have that reach (D-CF1-02, D-PG11-08); the compatibility page states it. | plan threat model | 2026-11-15 |

*Accepted risks do not resurface in future audit runs.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-11-15 | 27 | 27 | 0 | gsd-security-auditor (ASVS 1, block_on high), at 4e8d8d0b; 9 owner test files, ESLint on 6 modules, and 12 tagged scenarios run green in a hermetic home |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-11-15

Citations updated 2026-11-16 to the lines after the review fixes (`slash-command/invocation.feature:377` and `:402`). The fixes changed only the code-span mask and the alias reader. They did not change the scan input, the trust order, or the read limits that the register relies on.
