---
phase: "04"
slug: "strict-command-arguments"
status: secured
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
created: "2026-09-19"
register_authored_at_plan_time: false
---

# Phase 04 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Enforcement point |
|----------|-------------|--------------------|
| User-typed slash-command line → router → per-verb parser | Raw `args: string` | `edge/args.ts` tokenizer + `edge/args-schema.ts` + per-handler guards |
| Parsed argument values → orchestrators → filesystem path composition | marketplace/plugin names, `<source>` | `persistence/locations.ts` (`assertSafeName` + `assertPathInside` at every chokepoint) |
| Parsed `<source>` → network/git | source string | `domain/source.ts` closed grammar → `orchestrators/marketplace/add.ts:336` → `platform/git.ts` (isomorphic-git, no shell) |
| Untrusted remote manifest content (marketplace/plugin `name`) re-entering the command line | names reinserted into an arg string that is re-tokenized | none found — see T-04-09 |
| Config-file target selection within a scope | `--local` / `--scope` | `edge/handlers/shared.ts::extractLocalFlag` + `edge/args.ts` scope closed set |
| Argument text echoed back to the user's terminal | error messages containing raw tokens | no sanitizer found — see T-04-10 |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-04-01 | Tampering / EoP | Surplus positional handling | high | mitigate | `edge/args-schema.ts:81-84` ("Too many arguments."). All entry points enumerated and independently verified across every handler and `router.ts:236`; behavioural proof `tests/edge/register.test.ts:1684`. | closed |
| T-04-02 | Tampering | Unknown long flag absorption | high | mitigate | `edge/args-schema.ts:75-79`; `edge/handlers/shared.ts:73-81` with explicit caller-supplied allow-lists (catalog-derived, not literal duplicates) across all handlers. | closed |
| T-04-03 | Elevation of privilege / scope confusion | `--scope` value validation | medium | mitigate | `edge/args.ts:40-49` closed set `{user, project}`, throws on missing/invalid; `skipValue` keeps the value out of the flag test. Empty-scope matrix over all 21 scope-taking spellings. | closed |
| T-04-04 | Tampering | Quoted positional / `--local` extraction | medium | mitigate | `edge/args.ts:69-100` emits `{value, start, end}` spans; residual rebuilt via `args.slice(token.start, token.end)`, never re-stringified. Verified in all 10 `extractLocalFlag` callers. | closed |
| T-04-05 | Tampering | `--scope` value spelling `--local` | medium | mitigate | `edge/handlers/shared.ts:53-65` — `--scope` sets `skipValue`, next token bypasses every flag test. | closed |
| T-04-06 | Tampering | Empty operand degrading targeted op to bulk op | high | mitigate | `edge/args-schema.ts:91-101` ("Argument must not be empty.") + `edge/args.ts:84-87` preserves explicit empty quotes as a supplied token. Tests at `tests/edge/handlers/marketplace/update.test.ts:435-436` and `tests/edge/register.test.ts:1674-1682`. | closed |
| T-04-07 | Tampering / EoP | Path traversal via name positional | high | mitigate | `persistence/locations.ts:216-277` — every path-composing accessor calls `assertSafeName` then `assertPathInside`; `domain/name.ts:25-56` rejects empty/`.`/`..`/separators/control chars. | closed |
| T-04-08 | Elevation of privilege | Git option/command injection via `<source>` | high | mitigate | Layered: `--`-prefixed positional rejection, closed source grammar (`domain/source.ts:89-108,177-192`), `kind:"unknown"` refused at `add.ts:336-346`, isomorphic-git (no shell/argv surface), and `git-credential.ts:135` uses fixed argv with `sanitizeAttrValue` rejecting `\r\n\0`. | closed |
| T-04-11 | Tampering (expectation) | `--local` inert on `marketplace info/list/update` | low | accept | Code confirms deliberate inertness, not a dropped wire — `marketplace/list.ts:43-48`, `marketplace/update.ts:56-77`, `marketplace/shared.ts:71-77` pass no `local`. Documented in README, PRD §5.1.3, and the flag catalog. Byte-identity of both config files asserted in tests. | closed — accepted |
| T-04-09 | Tampering / EoP | Untrusted name reinsertion into re-tokenized command line | medium | mitigate | No escaping/charset restriction found at the two reinsertion sites (TUI browser `browse.ts:95-98`, completions `completions/data.ts:155-161`); the strict parser turns most crafted names into hard rejections, which bounds this to medium rather than high. | open — below high threshold (non-blocking) |
| T-04-12 | Tampering | Unterminated quote silently accepted | low | mitigate | `tokenizeArgs` (`edge/args.ts:69-100`) never inspects `inSingle`/`inDouble` after the loop; no unterminated-quote diagnostic. | open — below high threshold (non-blocking) |
| T-04-10 | Information disclosure | Raw argument text echoed with no control-char/ANSI stripping | low | mitigate | No sanitizer found at `edge/args-schema.ts:77`, `edge/handlers/shared.ts:80`, `edge/router.ts:192,247`. | open — below high threshold (non-blocking) |

*Status: open · closed · closed — accepted · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-04-01 | T-04-11 | `--local` is accepted but intentionally inert on `marketplace info/list/update` — it neither narrows reads nor selects a write target. This is deliberate, documented behavior (README, PRD §5.1.3, flag catalog description), not a dropped wire; both physical config files are asserted byte-identical in tests. | gsd-security-auditor (retroactive audit) | 2026-09-19 |

---

## Unregistered Flags

Neither `04-01-SUMMARY.md`, `04-02-SUMMARY.md`, nor `04-03-SUMMARY.md` contains a `## Threat Flags` section at all (heading absent, not "none declared"). The register above was reconstructed from the implementation instead. This derivation surfaced one item the executor never flagged, registered above as **T-04-09**: untrusted marketplace/plugin names (from remote `marketplace.json`, validated only by `assertSafeName` which permits spaces and `--`) are reinserted unquoted into an arg string that is re-tokenized by the TUI browser's `actionArgs` and by completion items — a name like `official --partial` or `mp --local` injects a real flag token.

**Follow-up worth tracking, not blocking:**
- T-04-09 closes with a quoting/escaping helper at the two reinsertion sites, or a name charset restriction rejecting whitespace and leading `-` at add/manifest-validation time.
- T-04-12 closes with an end-of-input balanced-quote check that throws a usage error (or an explicit documented decision to accept fusion).
- T-04-10 closes with a control-character/escape-sequence filter on echoed tokens at the notification boundary.

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-09-19 | 12 | 9 | 3 (non-blocking) | gsd-security-auditor (retroactive STRIDE audit ahead of catch-up PR) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-09-19
