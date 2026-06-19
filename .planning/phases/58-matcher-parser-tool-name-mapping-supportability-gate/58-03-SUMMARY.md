---
phase: 58-matcher-parser-tool-name-mapping-supportability-gate
plan: 03
subsystem: domain/components/hooks
tags: [hooks, matcher-parser, supportability-gate, discriminated-result, MATCH-01, MATCH-02, TOOL-02, D-58-03]
requires:
  - extensions/pi-claude-marketplace/domain/components/hook-tool-names.ts (CLAUDE_TO_PI_TOOL_NAMES, PiToolName)
  - extensions/pi-claude-marketplace/domain/components/hook-events.ts (BUCKET_A_EVENTS, TOOL_EVENTS, NON_TOOL_EVENT_FIELDS, NON_TOOL_EVENT_CLOSED_SETS)
  - extensions/pi-claude-marketplace/domain/components/hooks.ts Phase 57 baseline (HOOKS_CONFIG_SCHEMA, HOOKS_VALIDATOR, parseHooksConfig, hookDebugLog)
provides:
  - parseMatcher (5-arm ParsedMatcher discriminated union)
  - checkMatcherSupportability (TOOL-02 four-condition gate)
  - extended parseHooksConfig with D-58-03 single-seam supportability arm
affects:
  - domain/resolver.ts (byte-unchanged; consumes the existing {ok:false, reason} arm)
tech-stack-added: []
tech-stack-patterns:
  - "discriminated-result extension: fold new failure mode into existing {ok:false, reason} arm (D-58-03 single seam) so consumers narrow on `ok` unchanged"
  - "parse-time translation: Claude->Pi tool-name reverse-map lookup at parse time rather than runtime translation (no silent never-match)"
  - "first-wins debug detail with locked prefix tokens (a)/(b)/(c)/(d) routed to env-gated hookDebugLog only"
key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/domain/components/hooks.ts (181 -> 513 lines; +332)
    - tests/domain/components/hooks.test.ts (162 -> 446 lines; +284)
    - tests/architecture/hooks-supportability.test.ts (186 -> 246 lines; +60)
decisions:
  - "D-58-03 single seam: TOOL-02 supportability failure folds into the EXISTING parseHooksConfig {ok:false, reason} arm; reason = 'unsupported hooks: ' + debugDetail; resolver.ts byte-unchanged"
  - "ParsedMatcher carries 5 arms (match-all / tool-set / mcp-literal / regex / unmapped) rather than collapsing regex+unmapped into one; preserved for per-condition debug-detail clarity even though checkMatcherSupportability collapses both to TOOL-02 trip"
  - "Pi-form lowercase tokens parse as {kind:'unmapped'} because CLAUDE_TO_PI_TOOL_NAMES keys are Claude-form PascalCase; strict-supportability sentinel test locks the invariant"
  - "malformed pipe-OR (lone |, leading |Edit, trailing Edit|, ||) parses as regex per D-58-06 strict-supportability stance; never silently treated as match-all"
  - "MCP-literal check runs BEFORE the safe-charset gate so mcp__server__tool routes to its own arm; pipe-OR mixing with MCP literals rejects (MCP segment fails per-token TOOL-01 reverse-map lookup -> unmapped)"
  - "match-all is always supportable on every bucket-A event (D-58-06 match-all rail); only non-empty matchers route through the closed-set or no-matcher-support gates"
  - "checkMatcherSupportability iterative complexity reduced via helper extraction (tryToolEventTrip / tryNonToolEventTrip / tryHandlerTrip / tryGroupTrip) to satisfy sonarjs/cognitive-complexity"
metrics:
  duration: ~35min
  completed_date: 2026-06-14
---

# Phase 58 Plan 03: Matcher Parser, Tool-Name Translation & Supportability Gate Summary

`parseMatcher` (5-arm discriminated `ParsedMatcher`) + `checkMatcherSupportability` (TOOL-02 four-condition gate) + extended `parseHooksConfig` with the D-58-03 single-seam supportability arm; `domain/resolver.ts` consumes the existing `{ok:false, reason}` arm byte-unchanged.

## What was built

### 1. `ParsedMatcher` discriminated union + `parseMatcher` (Task 1)

`extensions/pi-claude-marketplace/domain/components/hooks.ts` gained:

- `ParsedMatcher` discriminated union with 5 arms:
  - `{ kind: "match-all" }` — raw `""` or `"*"`.
  - `{ kind: "tool-set"; piTools: ReadonlySet<PiToolName> }` — Pi-form lowercase tokens via TOOL-01 reverse-map at parse time.
  - `{ kind: "mcp-literal"; literal: string }` — `mcp__server__tool` literal.
  - `{ kind: "regex" }` — MATCH-02 regex chars OR malformed pipe-OR OR mixed tool|mcp.
  - `{ kind: "unmapped"; token: string }` — Claude-form token with no TOOL-01 entry (`MultiEdit` / Pi-form lowercase / etc.).
- `parseMatcher(raw: string): ParsedMatcher` — pure total function; never throws.
- Module-private regex constants `SAFE_MATCHER_CHARS = /^[A-Za-z0-9_|-]+$/`, `SAFE_TOKEN_CHARS = /^[A-Za-z0-9_-]+$/`, `MCP_LITERAL = /^mcp__[A-Za-z0-9_-]+__[A-Za-z0-9_-]+$/`.

The MCP-literal shape is checked **before** the safe-charset gate so `mcp__server__tool` routes to its own arm rather than passing through to the per-token loop. Pipe-OR carrying an MCP segment fails the per-token TOOL-01 reverse-map lookup and produces `unmapped` (loud rejection either way).

**Pi-form rejection sentinel:** `parseMatcher("edit")` returns `{kind: "unmapped", token: "edit"}` because `CLAUDE_TO_PI_TOOL_NAMES["edit"]` is `undefined` — the map's keys are Claude-form PascalCase/uppercase. The matcher never silently matches a Pi runtime event.

**Malformed pipe-OR strict rejection:** `parseMatcher("|")` / `parseMatcher("Edit|")` / `parseMatcher("|Edit")` / `parseMatcher("Edit||Write")` all return `{kind: "regex"}` — strict-supportability loud rejection, never silently treated as match-all.

### 2. `checkMatcherSupportability` + D-58-03 single-seam `parseHooksConfig` extension (Task 2)

`extensions/pi-claude-marketplace/domain/components/hooks.ts` gained:

- `SupportabilityResult` type: `{ ok: true } | { ok: false; debugDetail: string }`.
- `checkMatcherSupportability(config: HooksConfig): SupportabilityResult` — pure total gate iterating every event / group / handler triple, returning the FIRST encountered failure with a per-condition `debugDetail`. First-wins per strict-supportability.
- Private helpers `tryToolEventTrip` / `tryNonToolEventTrip` / `tryHandlerTrip` / `tryGroupTrip` to keep cognitive complexity within the sonarjs/cognitive-complexity threshold.
- Module-private `BUCKET_A_MEMBERS` / `TOOL_EVENT_MEMBERS` `Set<string>` instances for O(1) membership lookup.
- `parseHooksConfig` extended with the D-58-03 single-seam arm: after the existing `HOOKS_VALIDATOR.Check(parsed)` success path, calls `checkMatcherSupportability(parsed)`. On `{ok:false, debugDetail}` builds `reason = "unsupported hooks: " + debugDetail`, calls `hookDebugLog(reason)`, and returns the existing `{ok:false, reason}` shape unchanged.

**Locked per-condition prefix tokens** (debugDetail strings; routed to `hookDebugLog` only, never `ctx.ui.notify`):

| Prefix | Condition | Example detail |
|---|---|---|
| `(a)` | regex matcher on tool event (MATCH-02) | `(a) regex matcher in PreToolUse: Edit.*` |
| `(b)` | unmapped tool on tool event | `(b) unmapped tool in PreToolUse: MultiEdit` |
| `(c)` | non-bucket-A event | `(c) non-bucket-A event: Stop` |
| `(c)` | matcher on no-matcher-support event | `(c) matcher on no-matcher-support event: UserPromptSubmit` |
| `(c)` | matcher value outside closed set | `(c) matcher value not in closed set for SessionStart: clear` |
| `(d)` | non-`command` handler type | `(d) non-command handler in PreToolUse: http` |

**Match-all rail (D-58-06):** Empty matcher `""` or `"*"` is always admissible on every bucket-A event, including non-tool events with empty Pi-side closed sets (`PreCompact` / `PostCompact` / `SessionEnd`). Only non-empty matchers route through the closed-set or no-matcher-support gates.

### 3. Architecture-test prefix-token contract (Task 2)

`tests/architecture/hooks-supportability.test.ts` gained one new architecture-test block (Block 6) locking the four `(a)`/`(b)`/`(c)`/`(d)` prefix tokens via direct `checkMatcherSupportability` fixtures — a future contributor who renames any prefix red-fails CI.

## Tests added

| File | New tests | Cumulative pass count |
|---|---|---|
| `tests/domain/components/hooks.test.ts` | +9 (parseMatcher) + 11 (checkMatcherSupportability + parseHooksConfig + hookDebugLog) = 20 | 35 (15 Phase 57 baseline + 20) |
| `tests/architecture/hooks-supportability.test.ts` | +1 (prefix-token contract) | 6 (5 from Plan 58-02 + 1) |
| `tests/architecture/hooks-foundation.test.ts` | 0 | 8 (Phase 57 baseline preserved, NO regression) |

Total new tests this plan: **21**. Total hooks-related tests after this plan: **49** (35 domain + 6 supportability + 8 foundation).

## Single-seam invariant verification

```bash
$ git diff --stat extensions/pi-claude-marketplace/domain/resolver.ts
# (empty -- resolver.ts byte-unchanged)
```

The D-58-03 single-seam claim holds: the resolver's not-installable cascade narrows on `{ok:false, reason}` exactly as it did for the Phase 57 JSON.parse + schema-validation failures. TOOL-02 supportability failure rides the same arm with the `"unsupported hooks: "` reason prefix that Plan 58-04 will collapse to the closed-set `{unsupported hooks}` Reason at the catalog layer.

## Verification

- `npm run typecheck` — GREEN.
- `npm run lint` — GREEN.
- `npm run format:check` — GREEN.
- `npm test` (unit suite) — GREEN.
- `npm run test:integration` — GREEN.
- `npm run check` (full pipeline) — GREEN.
- `node --test tests/domain/components/hooks.test.ts tests/architecture/hooks-supportability.test.ts tests/architecture/hooks-foundation.test.ts` — 49/49 PASS.
- `git diff --stat extensions/pi-claude-marketplace/domain/resolver.ts` — empty (single-seam invariant holds).
- `grep -c "parseMatcher:" tests/domain/components/hooks.test.ts` — 9.
- `grep -c "checkMatcherSupportability" extensions/pi-claude-marketplace/domain/components/hooks.ts` — 4 (definition + parseHooksConfig call site + export + JSDoc reference).
- All four `(a)`/`(b)`/`(c)`/`(d)` backtick-quoted prefix tokens present in the source.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — Lint] Unnecessary escape character in `SAFE_MATCHER_CHARS` regex**

- **Found during:** Task 1 pre-commit hook (ESLint `no-useless-escape`).
- **Issue:** The plan's read_first reference cited the regex as `/^[A-Za-z0-9_|\-]+$/`, but ESLint's `no-useless-escape` rule flags the trailing `\-` because a hyphen at the end of a character class needs no escape.
- **Fix:** Changed to `/^[A-Za-z0-9_|-]+$/` (identical character class, no escape).
- **Files modified:** `extensions/pi-claude-marketplace/domain/components/hooks.ts`.
- **Commit:** Folded into a688f22 (Task 1 commit).

**2. [Rule 1 — Lint] Cognitive complexity threshold + padding-line-between-statements in `checkMatcherSupportability`**

- **Found during:** Task 2 `npm run check` (ESLint `sonarjs/cognitive-complexity` 39 > 15; `@stylistic/padding-line-between-statements`).
- **Issue:** The inline three-level loop (event → group → handler) with nested branching on tool-event-vs-non-tool-event + closed-set lookup + null-sentinel + match-all rail tripped the cognitive-complexity threshold. The single `if` after a previous `if` in the tool-event arm also tripped the padding rule.
- **Fix:** Extracted four private helpers (`tryToolEventTrip`, `tryNonToolEventTrip`, `tryHandlerTrip`, `tryGroupTrip`) — each returns `SupportabilityResult | null` and the outer `checkMatcherSupportability` collapses to a clean event→group iteration. Helpers improved readability and reduced complexity below threshold without changing semantics. All 49 tests pass after refactor.
- **Files modified:** `extensions/pi-claude-marketplace/domain/components/hooks.ts`.
- **Commit:** Folded into 2d0620d (Task 2 commit).

Neither deviation affected the locked debug-detail prefix tokens or the public function signatures (`parseMatcher`, `checkMatcherSupportability`, `parseHooksConfig`).

### Authentication gates

None.

## Known Stubs

None. Both `parseMatcher` and `checkMatcherSupportability` are fully implemented per the plan's behavior spec.

## Commits

| Hash | Type | Message |
|---|---|---|
| `a688f22` | feat | feat(58-03): add parseMatcher discriminated union + ParsedMatcher |
| `2d0620d` | feat | feat(58-03): add checkMatcherSupportability + D-58-03 single-seam gate |

## Requirements closed

- **MATCH-01** — empty / `*` / single Claude tool / pipe-OR alternation / `mcp__server__tool` all classify into typed `ParsedMatcher` arms.
- **MATCH-02** — regex chars (and not part of MCP-literal shape) trip `{kind: "regex"}`; malformed pipe-OR also trips regex per strict-supportability.
- **TOOL-02** — four-condition gate `(a)`/`(b)`/`(c)`/`(d)` lives in `checkMatcherSupportability` and trips `parseHooksConfig` to `{ok:false, reason: "unsupported hooks: ..."}` via the D-58-03 single seam.

## Self-Check: PASSED

- All claimed files exist:
  - `extensions/pi-claude-marketplace/domain/components/hooks.ts` — FOUND (513 lines).
  - `tests/domain/components/hooks.test.ts` — FOUND (446 lines).
  - `tests/architecture/hooks-supportability.test.ts` — FOUND (246 lines).
- All claimed commits exist:
  - `a688f22` — FOUND.
  - `2d0620d` — FOUND.
- `git diff --stat extensions/pi-claude-marketplace/domain/resolver.ts` is empty — single-seam invariant holds.
- All 49 hooks-related tests pass.
- `npm run check` GREEN.
