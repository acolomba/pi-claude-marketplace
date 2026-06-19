---
phase: 61
slug: if-field-permission-rule-matcher
status: verified
threats_open: 0
asvs_level: 1
created: 2026-06-15
---

# Phase 61 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.
>
> Phase scope: MATCH-03 `if` field permission-rule matcher (hand-authored glob
> engine, Bash subcommand parser, parse-time `compileIfPredicate`, dispatch-time
> `ifFires` consult). The `if` field is explicitly **not** a security boundary
> per upstream Claude documentation ("use the permission system rather than a
> hook to enforce a hard allow or deny"). Pi's user-confirmation prompt remains
> the authoritative deny gate; this layer is best-effort with documented fail-
> open semantics on every uncertainty (D-61-02 / D-61-04).

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| plugin author → `if` field string | Untrusted text from `hooks.json` crossing into parse-time compile (`compileIfPredicate`). Malformed input MUST fall open (D-61-02) — never throw past the parser. | string (permission-rule syntax) |
| runtime tool event → dispatch | Untrusted `event.input.command` / `event.input.path` / `event.toolName` crossing into `ifFires`. Unparseable Bash MUST fall open (D-61-04). | string |
| `if` field anchor resolution → filesystem-path comparison | Resolved absolute paths used **only** for `pathGlob.testAbsolute(...)` string comparison, never as a write target; NFR-10 has zero trip surface in Phase 61. | string |
| `hooks.json` `if` field → `parseHooksConfig` | Internal type-checked boundary; all failure modes collapse to `MATCH_ALL_IF` sentinel. | parser side-Map |
| parser side-Map → `RoutingEntry.ifPredicate` | Internal type-checked boundary; dispatch never observes `undefined` (always-present-with-sentinel). | `IfPredicate` discriminated union |

---

## Threat Register

| Threat ID | Category | Component | Disposition | Mitigation | Status |
|-----------|----------|-----------|-------------|------------|--------|
| T-61-01 | Tampering | `bash.ts` `parseBashSubcommands` (shell-command injection via compound separators) | accept | `bash.ts` file-leading comment (lines 33-38) anchors upstream's "best-effort, not a security boundary" contract per MATCH-03 §3. Bridge fires the hook; Pi's user-confirmation prompt is the authoritative deny gate. Each subcommand checked independently. | closed |
| T-61-02 | DoS | `glob.ts` `matchTokens` (catastrophic regex backtrack) | mitigate | Hand-authored linear recursive-descent matcher; zero `RegExp` construction over user input (`grep 'new RegExp\|RegExp('` on `if-field/*.ts` returns no matches). Path-mode `*` is segment-local (line 219: `!crossSegment && text[k] === "/"` short-circuit); Bash-mode `*` consumes across `/` per CR-01. Single-globstar patterns are O(N×M); multi-globstar worst case O(N^K) acknowledged in file-leading comment lines 33-44. | closed |
| T-61-03 | DoS | `bash.ts` `parseBashSubcommands` (stack overflow via nested `$()` / backticks) | mitigate | `MAX_RECURSION_DEPTH = 8` at `bash.ts:118`; `pushRecursed` (line 272) throws on overflow; outer `parseBashSubcommands` (lines 411-426) wraps in try/catch and returns `{ok: false, reason}`. Consumer (`ifFires` bash arm, `index.ts:382-386`) reads `!parsed.ok` as fail-OPEN per D-61-04. | closed |
| T-61-04 | Tampering | `glob.ts` `compilePathGlob` (path-traversal via `~/../../etc/passwd`) | accept | Anchors used ONLY for `testAbsolute` string comparison; no write target. Grep on `if-field/*.ts` for `fs.write` / `fs.mkdir` / `realpath` / `lstat` / `readlink` returns no matches. NFR-10 has zero trip surface; Phase 60's spawn surface enforces NFR-10 separately when the hook ultimately runs. | closed |
| T-61-05 | Tampering | `glob.ts` symlink-follow / TOCTOU on `event.input.path` | accept | Bridge does NOT call `fs.realpath` / `fs.lstat` / `fs.readlink` — verified via grep (only matches are explanatory comments at `index.ts:323-325` and `glob.ts` documenting the deliberate absence). `resolveTarget` (`index.ts:328-334`) is pure `path.normalize` + `path.resolve`. Documented intent: avoid per-dispatch I/O cost and TOCTOU race. | closed |
| T-61-06 | Tampering | `compileIfPredicate` (malformed `if` value throws past parser) | mitigate | `index.ts:200-235` `compileIfPredicate` guards every failure mode (empty trim, non-tool event, unrecognized shape) with explicit `return MATCH_ALL_IF`. `compileIfPrefixForm` (lines 243-276) wraps each compile arm in try/catch (Bash arm lines 250-258; path-tool arm lines 263-271); every catch emits `hookDebugLog` and returns `MATCH_ALL_IF`. Architecture test "D-61-02: every compile failure mode collapses to MATCH_ALL_IF" pins the contract end-to-end. | closed |
| T-61-07 | Information disclosure | `hookDebugLog` warnings containing user-supplied `if` field contents | accept | `shared/debug-log.ts:21` gates emission on `process.env.PI_CLAUDE_MARKETPLACE_DEBUG === "1"` (exact-equal, not fuzzy truthy). Production runs (without the env var) emit zero output. Echoing the raw `if` string is intentional so authors can debug fall-open events when they opt in. | closed |
| T-61-08 | DoS | parser side-Map growth on plugins with thousands of handlers | accept | Side-Map size is O(handlers); ~10,000 handlers ≈ ~1MB compiled predicate state. OS-level memory bounds the process. `MATCH_ALL_IF` is a referential-equality shared sentinel (`index.ts:119`) so absent-`if` rows reuse a single object reference — verified at `event-router.ts:310` fall-back. | closed |
| T-61-09 | Tampering | `ifFires` (event missing `toolName` / `input` shape) | mitigate | Per-event extractors at `index.ts:296-319` (`extractBashCommand`, `extractToolName`, `extractPath`) use `typeof === "string"` guards and return `string \| undefined` (or `""` for toolName) without throwing. Bash arm (line 378) returns false on undefined command. Path-tool arm (line 403) substitutes `ctx.cwd` per D-61-03. MCP arms (lines 408-411) compare against the empty-string coercion that fails every downstream check. | closed |
| T-61-10 | DoS | `ifFires` bash arm (`parseBashSubcommands` depth bomb) | mitigate | Same depth cap as T-61-03 (`MAX_RECURSION_DEPTH = 8`); on overflow `parsed.ok === false`; `ifFires` bash arm (`index.ts:382-386`) emits `hookDebugLog` and returns true (fail-OPEN). No retry, no unbounded loop. | closed |
| T-61-11 | Tampering | REQUIREMENTS.md drift — code vs MATCH-03 contract | mitigate | Verified `git show --stat ca5f585` lists exactly `.planning/REQUIREMENTS.md` AND `extensions/pi-claude-marketplace/bridges/hooks/if-field/index.ts` in a single commit. D-58-01 atomic-supersession lesson honored. Architecture test pins MATCH-03 wording to implementation via end-to-end truth-table fixtures. | closed |
| T-61-SC | Tampering | npm / pip / cargo installs (supply-chain) | mitigate | `git diff 7c0aa16..HEAD -- package.json package-lock.json` produces empty output; zero new runtime dependencies introduced in Phase 61. D-61-01 hand-authored stance preserved (no `picomatch` / `minimatch` / `micromatch`). | closed |

*Status: open · closed*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-61-01 | T-61-01 | The `if` field is explicitly NOT a security boundary per upstream docs (`code.claude.com/docs/en/hooks-guide`). Compound-separator splitting is upstream-faithful behavior. Pi's user-confirmation prompt is the authoritative deny gate; bridge merely fires the hook. Documented in `bash.ts:33-38`. | Phase 61 plan (D-61-04) | 2026-06-15 |
| AR-61-04 | T-61-04 | Anchors (`~/`, `/`, `//`, `./`, gitignore-bare) resolve via `path.resolve` and are used ONLY for `pathGlob.testAbsolute` string comparison. A malicious author can craft `Read(/etc/passwd)` to make a hook fire — but the hook still runs through Phase 60's spawn surface where NFR-10 applies. No write target in the `if`-field layer. | Phase 61 plan (D-61-02) | 2026-06-15 |
| AR-61-05 | T-61-05 | Symlink resolution at dispatch time would add async I/O on every tool event and surface TOCTOU race conditions. Upstream's permission-rule layer (not Pi's hooks bridge) does the symlink check. Documented in `index.ts:321-326`. | Phase 61 plan (D-61-02) | 2026-06-15 |
| AR-61-07 | T-61-07 | `hookDebugLog` gates on `PI_CLAUDE_MARKETPLACE_DEBUG=1` (OBS-01 / D-59-05). Production users never see the warnings. Echoing the user-supplied `if` string is the design intent: authors need to see their input to debug a fall-open event. | Phase 61 plan (OBS-01) | 2026-06-15 |
| AR-61-08 | T-61-08 | O(handlers) growth on a pathological plugin is bounded by OS-level memory. `MATCH_ALL_IF` referential-equality sentinel keeps absent-`if` overhead near-zero. No specific cap warranted at this layer. | Phase 61 plan (D-61-02) | 2026-06-15 |

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-06-15 | 12 | 12 | 0 | gsd-security-auditor |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-06-15
