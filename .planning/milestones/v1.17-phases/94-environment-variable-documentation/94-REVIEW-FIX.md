---
phase: 94-environment-variable-documentation
fixed_at: 2026-08-03T00:00:00Z
review_path: .planning/phases/94-environment-variable-documentation/94-REVIEW.md
iteration: 2
findings_in_scope: 1
fixed: 1
skipped: 0
status: all_fixed
---

# Phase 94: Code Review Fix Report

**Fixed at:** 2026-08-03
**Source review:** .planning/phases/94-environment-variable-documentation/94-REVIEW.md
**Iteration:** 2

## Iteration 2

**Summary:**

- Findings in scope (critical + warning): 1 (WR-01, cross-doc gap)
- Fixed: 1
- Skipped: 0

The iteration-2 re-review verified all iteration-1 fixes closed and surfaced
one new warning.

### WR-01 (iteration 2): hook env-vars table omits PATH / ledger rows

**Files modified:** `docs/hooks-compatibility.md`
**Commit:** a945573d
**Applied fix:** `docs/env-vars.md`'s matrix and Hooks per-surface table now
assert `PATH` and `PI_CLAUDE_MARKETPLACE_PATH` are hook-delivered via the
`...process.env` spread, but the `## Environment variables` table in
`docs/hooks-compatibility.md` omitted both (while listing the pi-only
`CLAUDE_SESSION_ID` alias — an inconsistent selection). Added a `PATH` row
(✓ upstream, ✓ Pi, plugin-`bin`-append note) and a `PI_CLAUDE_MARKETPLACE_PATH`
row (— upstream, ✓ Pi, pi-only ledger note) after the `CLAUDE_SESSION_ID` row,
keeping the `Variable | Claude Code | Pi | Notes` register and staying inside
the `## Environment variables` section. Both docs now agree.

**Verification:** `mdformat` and `markdownlint-cli2` both pass on both docs
(run as separate invocations); the content-policy scan
`grep -nEi '(phase|plan|wave) [0-9]'` is empty on both docs; the working tree is
clean except this fix report.

## Iteration 1

**Summary:**

- Findings in scope (critical + warning): 6 (CR-01, WR-01..05)
- Fixed: 6
- Skipped: 2 (IN-01, IN-02 — Info tier, out of scope)

All fixes are documentation-accuracy edits to `docs/env-vars.md` and the
`## Environment variables` section of `docs/hooks-compatibility.md`. No source
code was changed. Every claim was re-verified against the shipped bridge
sources before writing. Each commit passed the `mdformat` and
`markdownlint-cli2` pre-commit hooks, and the content-policy scan
(`grep -nEi '(phase|plan|wave) [0-9]'`) is empty on both docs.

**Commit-granularity note.** `mdformat` re-pads whole markdown tables, and
several findings touch the same tables, so per-finding git hunks were
interleaved. To keep truly atomic per-finding commits, the two docs were reset
to `HEAD` and the fixes re-applied finding-by-finding with the lint gates run
between each commit. WR-05 was committed together with CR-01 because the review
states WR-05 is closed by the CR-01 fix (the new divergences subsection gives
the `§` footnote its home).

## Fixed Issues

### CR-01: `CLAUDE_ENV_FILE` marked fully supported, but the env-file round-trip is not wired

**Files modified:** `docs/hooks-compatibility.md`, `docs/env-vars.md`
**Commit:** f1eb5590
**Applied fix:** Verified against source first — `prepareEnv`
(`bridges/hooks/dispatch-exec.ts:326-330`) and `prepareAsyncEnv`
(`bridges/hooks/async-rewake/registry.ts:623-627`) set
`env.CLAUDE_ENV_FILE` only when the event is `SessionStart`, and a repo-wide
grep found no code that reads, parses, or sources that file back. So the honest
disposition is exposure-without-sourcing. Demoted the
`hooks-compatibility.md` cell from `✓` to `⚠` with a note matching env-vars.md's
`⚠` cell, updated the env-vars.md Hooks per-surface note, and added a new
"`CLAUDE_ENV_FILE` is exposed but not sourced" divergences subsection stating
that both spawn lanes expose the path on the SessionStart event but nothing
sources it back, so vars a hook writes are inert. The two docs now agree.

### WR-01: Overview matrix lists PATH / ledger for Hooks and MCP env, but per-surface tables omit those rows

**Files modified:** `docs/env-vars.md`
**Commit:** afe3b8e3
**Applied fix:** Added `PATH` and `PI_CLAUDE_MARKETPLACE_PATH` rows to the Hooks
per-surface table and the MCP spawn env table, each noting they ride the
`...process.env` spread / inherit from Pi's live `process.env` at spawn, so the
matrix `E` cells and the per-surface tables now agree.

### WR-02: `‡` inheritance caveat applied to session vars but not to PATH / ledger in the MCP env column

**Files modified:** `docs/env-vars.md`
**Commit:** c07ef4c8
**Applied fix:** Marked the MCP-env `PATH` and `PI_CLAUDE_MARKETPLACE_PATH`
matrix cells `E‡` to match the session-var cells (same process.env-at-spawn
mechanism). Scoped the session-switch-staleness half of the `‡` footnote to the
session id in the "MCP runtime env inheritance" subsection, noting PATH and the
ledger do not change on a session switch so only the spawn-order caveat applies
to them.

### WR-03: MCP substitution scope described as command/args/env, but the code walks every string leaf

**Files modified:** `docs/env-vars.md`
**Commit:** 3e5a2ece
**Applied fix:** Verified against `bridges/mcp/substitute.ts` — `deepSubstitute`
recurses over every string leaf of the whole entry regardless of key. Dropped
the `command`/`args`/`env` qualifier in both the mechanisms overview (line 9)
and the MCP config per-surface intro, stating that every string value at any
nesting depth of the entry is substituted (url/headers/custom fields included)
and object keys are never substituted.

### WR-04: `⚠` glyph used in per-surface tables but never defined in the env-vars legend

**Files modified:** `docs/env-vars.md`
**Commit:** da78482a
**Applied fix:** Added `⚠ = partial / divergent delivery (scope- or event-gated;
see the marked subsection)` to the overview-matrix legend so the legend covers
every glyph used.

### WR-05: Footnote `§` has no matching divergences subsection

**Files modified:** `docs/env-vars.md`
**Commit:** f1eb5590 (with CR-01)
**Applied fix:** Repointed the `§` footnote at the new
"`CLAUDE_ENV_FILE` is exposed but not sourced" subsection added by the CR-01
fix, so the footnote resolves to a real subsection and the legend's stated
contract holds.

## Skipped Issues

### IN-01: `pi-mcp-adapter 2.10.0` version and `resolveEnv` internals unverifiable

**File:** `docs/env-vars.md:141`
**Reason:** skipped — Info tier, outside the critical_warning fix scope.
**Original issue:** The "MCP runtime env inheritance" subsection pins the
external `pi-mcp-adapter 2.10.0` version and quotes internal `resolveEnv`
details that are not confirmable from this tree.

### IN-02: The `E` glyph is overloaded — MCP-env plugin-root/data injection is a stage-time config write

**File:** `docs/env-vars.md:11,19-20,116-117`
**Reason:** skipped — Info tier, outside the critical_warning fix scope (the
review also marks this fix "Optional").
**Original issue:** MCP-env `CLAUDE_PLUGIN_ROOT` / `CLAUDE_PLUGIN_DATA` cells are
marked `E` but are written into the server's `env` at stage time, closer to `S`
semantics than to the process.env inheritance the `E` paragraph describes.

---

_Fixed: 2026-08-03_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 2_
