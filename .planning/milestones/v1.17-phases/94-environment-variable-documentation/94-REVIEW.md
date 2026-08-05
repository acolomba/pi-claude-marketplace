---
phase: 94-environment-variable-documentation
reviewed: 2026-08-03T00:00:00Z
depth: standard
files_reviewed: 2
files_reviewed_list:
  - docs/env-vars.md
  - docs/hooks-compatibility.md
findings:
  critical: 0
  warning: 0
  info: 3
  total: 3
status: issues_found
---

# Phase 94: Code Review Report (iteration 3, final)

**Reviewed:** 2026-08-03
**Depth:** standard
**Status:** issues_found (info-only)

## Summary

Final re-review of `docs/env-vars.md` and `docs/hooks-compatibility.md` after the
full fix loop (commits da78482a..a945573d). **The fix loop has converged with zero
critical and zero warning findings** — all one critical and six warning findings
across iterations 1 and 2 are verified closed against the shipped bridge sources.
Only three info-tier items remain, none of which block shipping.

Verification trail this iteration:

- **WR-01 (iteration 2) CLOSED** — commit a945573d added `PATH`
  (`hooks-compatibility.md:194`) and `PI_CLAUDE_MARKETPLACE_PATH` (`:195`) rows to
  the `## Environment variables` table, immediately after the `CLAUDE_SESSION_ID`
  row. Register is consistent (`PATH` = Claude Code `✓` / Pi `✓`;
  `PI_CLAUDE_MARKETPLACE_PATH` = Claude Code `—` / Pi `✓`, matching env-vars.md's
  matrix). Notes are consistent with env-vars.md's Hooks rows (`env-vars.md:95-96`)
  — both cite inheritance via the `...process.env` spread — and the PATH-append
  statement matches `shared/session-env.ts::applyPathLedger` (append, never
  prepend). No new contradiction introduced.

Prior closures (confirmed still holding this iteration):

- **CR-01** — `CLAUDE_ENV_FILE` marked `⚠` in both docs, matrix `E§` with a
  dedicated "exposed but not sourced" subsection; disposition matches code
  (`dispatch-exec.ts:326-329`, `async-rewake/registry.ts:623-626` set the path on
  SessionStart only; nothing sources it back).
- **WR-01..WR-05 (iteration 1)** — per-surface PATH/ledger rows, `E‡` markings +
  session-switch scoping, whole-entry/deep substitution wording matching
  `substitute.ts:52-74`, `⚠` legend entry, `§` subsection.

Carrier items C-1..C-6 present; content-policy scan clean (sanctioned
decision/finding IDs and `9x-SECURITY.md` refs only).

## Info

### IN-01: `pi-mcp-adapter 2.10.0` version and `resolveEnv` internals unverifiable from this tree

**File:** `docs/env-vars.md:149`
**Issue:**
The "MCP runtime env inheritance" subsection pins a specific external version
("pi-mcp-adapter 2.10.0") and quotes an internal implementation detail
(`server-manager.ts::resolveEnv` building `{...process.env,
...interpolated(config.env)}`; interpolation on `env`/`cwd`/`headers`/`bearerToken`
but not `command`/`args`). The package is absent from `node_modules` (re-confirmed
this iteration), so none of this is confirmable against source; a dependency bump
or refactor would silently falsify it with no signal in this repo.

**Fix:** Optional. Drop the hard `2.10.0` pin, or note the behavior was verified
against a specific released version and should be rechecked on adapter upgrades.

### IN-02: The `E` glyph conflates process.env inheritance with stage-time config writes for MCP plugin-root/data

**File:** `docs/env-vars.md:11,19-20,116-119`
**Issue:**
The MCP-env cells for `CLAUDE_PLUGIN_ROOT` / `CLAUDE_PLUGIN_DATA` (matrix lines
19-20; table lines 118-119) are marked `E`, but the code (`substitute.ts:113-120`,
via `stage.ts`) writes them into the server's `env` map baked into `mcp.json` at
stage time — an install-stable disk write closer to `S` than to the `process.env`
inheritance the `E` paragraph (line 11) describes. The per-surface note clarifies
it, but the shared `E` glyph spans two distinct delivery paths in one column.

**Fix:** Optional. A footnote noting the value is baked into the server's `env`
config at stage time (not inherited from `process.env`) would distinguish it from
the `‡` session vars.

### IN-03: `‡` footnote text blanket-asserts the session-switch caveat for PATH / ledger, which its own subsection contradicts

**File:** `docs/env-vars.md:32` vs `docs/env-vars.md:152`
**Issue:**
The MCP-env `PATH` (line 26) and `PI_CLAUDE_MARKETPLACE_PATH` (line 28) cells carry
`‡`, whose footnote text (line 32) reads "subject to the spawn-order **and
session-switch** caveats." The subsection it points to (line 152) correctly states
the session-switch half does not apply to those two vars. A reader of the footnote
alone is over-informed; only the subsection corrects it. Minor, because the
footnote directs to the authoritative subsection.

**Fix:** Optional. Soften the `‡` footnote to scope the session-switch half to the
session vars only.

---

_Reviewed: 2026-08-03_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
