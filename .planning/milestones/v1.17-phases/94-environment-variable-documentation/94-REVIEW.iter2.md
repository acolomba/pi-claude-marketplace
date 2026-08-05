---
phase: 94-environment-variable-documentation
reviewed: 2026-08-03T00:00:00Z
depth: standard
files_reviewed: 2
files_reviewed_list:
  - docs/env-vars.md
  - docs/hooks-compatibility.md
findings:
  critical: 1
  warning: 5
  info: 2
  total: 8
status: issues_found
---

# Phase 94: Code Review Report

**Reviewed:** 2026-08-03
**Depth:** standard
**Files Reviewed:** 2
**Status:** issues_found

## Summary

This is a documentation-accuracy review of `docs/env-vars.md` (new, 162 lines) and
the reworked environment-variable section of `docs/hooks-compatibility.md`. I traced
every matrix cell and prose claim against the shipped bridge sources
(`shared/vars.ts`, `shared/session-env.ts`, `bridges/mcp/substitute.ts`,
`bridges/mcp/stage.ts`, `bridges/hooks/dispatch-exec.ts`,
`bridges/hooks/async-rewake/registry.ts`).

Verified good: all six mandatory carrier items are present (C-1 nested-host
non-scrub, C-2 PATH ledger, C-3 pi-only alias in bash + hooks, C-4 MCP
spawn-order/session-switch/resolveEnv, C-5 user-scope pass-through incl. the
Claude-Code-bash-children parity fact, C-6 the 91/92 security dispositions).
The session-env, PATH-ledger, hook-lane, and MCP substitution/injection mechanics
transcribe accurately, and the content-policy scan is clean (no phase/plan/wave
numbers; only requirement/decision IDs and the sanctioned `9x-SECURITY.md`
references).

The one Critical: this phase promoted `CLAUDE_ENV_FILE` from Pi `✗` to Pi `✓`
in `hooks-compatibility.md`, but only the *variable exposure* was implemented —
nothing sources the file back, so the feature the `✓` claims does not function.
The remaining findings are internal/cross-doc consistency defects (matrix vs
per-surface omissions, undefined glyph, a mis-scoped substitution claim).

## Critical Issues

### CR-01: `CLAUDE_ENV_FILE` marked fully supported (`✓`), but the env-file round-trip is not wired

**File:** `docs/hooks-compatibility.md:196` (and `docs/env-vars.md:95`, `docs/env-vars.md:25`)
**Issue:**
The phase diff flips `CLAUDE_ENV_FILE` from Pi `✗` ("sourced before each Bash
command") to Pi `✓` "set on the SessionStart hook spawn (both lanes)." The
upstream `CLAUDE_ENV_FILE` contract is a *round-trip*: a SessionStart hook writes
`KEY=VALUE` lines to `$CLAUDE_ENV_FILE`, and the host then sources that file so
subsequent Bash commands and the session inherit those vars.

The shipped code implements only the first half. `prepareEnv`
(`bridges/hooks/dispatch-exec.ts:326-330`) and `prepareAsyncEnv`
(`bridges/hooks/async-rewake/registry.ts:623-627`) set the path and
`event-router.ts` pre-creates the `_shared/` dir — but no code anywhere in
`extensions/` reads, parses, or sources that file back (grep for
`read|source|parse|load` against the env-file path returns nothing). Worse, this
same doc's own Bash-children description (`docs/env-vars.md:41`) states Pi's bash
tool's "only mutation prepends Pi's own managed bin dir to `PATH`" — i.e. the
bash tool does **not** source `CLAUDE_ENV_FILE`. Net effect: any env a
SessionStart hook writes to `$CLAUDE_ENV_FILE` is silently inert.

A plugin author reading `✓ supported` will assume env-file exports work and ship
a SessionStart hook that writes to the file; those vars will never reach their
Bash commands, with no diagnostic. The legend defines `✓` as "supported"; this is
at best `⚠` (partial). The two docs also disagree on the glyph — `env-vars.md:95`
marks it `⚠`, `hooks-compatibility.md:196` marks it `✓` — and neither discloses
the missing sourcing side in the "Divergences and documented absences" section.

(Residual uncertainty: I cannot inspect Pi-host internals outside this tree. If
Pi's host sources `CLAUDE_ENV_FILE` independently of this extension, the `✓` is
correct — but `docs/env-vars.md:41` is authored by this same team and asserts the
bash tool does not, which contradicts that possibility. Verify before shipping.)

**Fix:**
Confirm whether Pi sources `CLAUDE_ENV_FILE`. If it does not (the evidence says
so), demote the `hooks-compatibility.md` cell to `⚠` and add a divergence
subsection to `docs/env-vars.md` — e.g.:

```markdown
| `CLAUDE_ENV_FILE` | ✓ | ⚠ | Path exposed to the SessionStart hook (both lanes); Pi does NOT source the file back, so vars a hook writes to it are not applied to the session or bash children. See "CLAUDE_ENV_FILE is exposed but not sourced". |
```

and pin the caveat in one divergences subsection referenced by the `§` footnote.
If Pi *does* source it, keep `✓` but cite where, and reconcile `env-vars.md:95`
from `⚠` to match.

## Warnings

### WR-01: Overview matrix lists PATH / `PI_CLAUDE_MARKETPLACE_PATH` for Hooks and MCP env, but the per-surface tables omit those rows

**File:** `docs/env-vars.md:26,28` vs `docs/env-vars.md:87-96` and `docs/env-vars.md:114-121`
**Issue:**
The overview matrix marks `PATH` (line 26) and `PI_CLAUDE_MARKETPLACE_PATH`
(line 28) as delivered to **Hooks = E** and **MCP env = E**. Both are correct —
the hook lanes and MCP spawn inherit the mutated `process.env` (which carries the
appended PATH and the ledger var). But the per-surface **Hooks** table
(lines 87-96) and **MCP spawn env** table (lines 114-121) contain no rows for
either variable; only the **Bash children** table (lines 43-50) documents them.
Overview and per-surface tables must agree; here the per-surface tables under-list
two E cells the matrix asserts.

**Fix:** Add `PATH` and `PI_CLAUDE_MARKETPLACE_PATH` rows (inherited via
`...process.env`) to both the Hooks and MCP spawn env per-surface tables, or add a
one-line note in each table stating they ride the `...process.env` spread and are
documented under Bash children.

### WR-02: `‡` inheritance caveat applied to session vars but not to PATH / ledger in the MCP env column

**File:** `docs/env-vars.md:26,28` vs `docs/env-vars.md:23,24,27`
**Issue:**
In the MCP env column, the session vars (`CLAUDECODE`, `CLAUDE_CODE_SESSION_ID`,
`CLAUDE_SESSION_ID`) carry `‡` — "reaches MCP servers only through Pi's live
`process.env` at spawn time, subject to the spawn-order and session-switch
caveats." `PATH` (line 26) and `PI_CLAUDE_MARKETPLACE_PATH` (line 28) reach MCP
servers by the *identical* mechanism (`process.env` inheritance at spawn) and are
equally subject to the spawn-order caveat, yet are marked plain `E`. The marking
is internally inconsistent.

**Fix:** Either add `‡` to the MCP-env `PATH` / ledger cells, or split the
footnote so the spawn-order half covers all inherited vars while the
session-switch-staleness half is scoped to the session id (PATH does not change
on a session switch, so that half genuinely does not apply — worth stating).

### WR-03: MCP substitution scope described as "command/args/env" but the code walks every string leaf of the entry

**File:** `docs/env-vars.md:9` and `docs/env-vars.md:102`
**Issue:**
Line 9 says `substituteAndInject` "deep-substitutes the three tokens ... across an
MCP entry's `command`/`args`/`env`," and line 102 says "every string value at any
nesting depth in the entry's `command`/`args`/`env` is walked once." The code
(`bridges/mcp/substitute.ts:52-74`, `102-107`) calls `deepSubstitute(entry, map)`
on the **whole** entry object and recurses over *every* string leaf regardless of
key — a `url`, `headers`, `type`, or any custom field on an http/sse entry is also
substituted. Line 102 even leads with the correct "whole-entry and deep" before
contradicting itself with the `command`/`args`/`env` qualifier. A reader could
place `${CLAUDE_PLUGIN_ROOT}` in a `url` field expecting a literal pass-through and
get a (correct, but undocumented) substitution.

**Fix:** Drop the `command`/`args`/`env` qualifier. State: "every string value at
any nesting depth of the entry is substituted; object keys are never substituted."
Keep the injection wording scoped to stdio entries (that part matches the code).

### WR-04: `⚠` glyph used throughout the per-surface tables but never defined in the env-vars legend

**File:** `docs/env-vars.md:15` (legend) vs `docs/env-vars.md:61,71,81,95,108,118`
**Issue:**
The legend (line 15) defines `S`, `E`, `—`, `✗`, and (for the Claude Code column)
`✓` / `—`. It does not define `⚠`, yet `⚠` is used in the Pi column of the skills,
commands, agents, hooks, and MCP per-surface tables to mean "conditional /
project-scope-or-SessionStart-only." `hooks-compatibility.md` defines `⚠` in its
legend; `env-vars.md` does not. The instruction that "the legend must cover every
glyph used" is violated.

**Fix:** Add `⚠ = conditional / scope- or event-gated (see Notes)` to the
`env-vars.md` legend.

### WR-05: Footnote `§` has no matching divergences subsection, contradicting the legend's stated contract

**File:** `docs/env-vars.md:15,33`
**Issue:**
The legend (line 15) states: "Footnote markers on a cell point to the matching
subsection under 'Divergences and documented absences'." Footnotes `†` and `‡` do
point to subsections ("User-scope `${CLAUDE_PROJECT_DIR}` pass-through", "MCP
runtime env inheritance"). Footnote `§` (line 33, "SessionStart hook lane only") is
defined inline only and has no corresponding subsection, so it breaks the
contract the legend advertises. (This overlaps CR-01: a "CLAUDE_ENV_FILE exposed
but not sourced" divergence subsection would give `§` a home and fix both.)

**Fix:** Add a divergences subsection for the `CLAUDE_ENV_FILE` / SessionStart-only
behavior and point `§` at it, or soften the legend sentence to "footnote markers
are defined immediately below the matrix; some also link a divergence subsection."

## Info

### IN-01: `pi-mcp-adapter 2.10.0` version and `resolveEnv` internals are unverifiable from this tree

**File:** `docs/env-vars.md:141`
**Issue:**
The "MCP runtime env inheritance" subsection pins a specific external version
("pi-mcp-adapter 2.10.0") and quotes an internal implementation detail
(`server-manager.ts::resolveEnv` builds `{...process.env, ...interpolated(config.env)}`;
interpolation applies to `env`/`cwd`/`headers`/`bearerToken` but not
`command`/`args`). The package is not present in `node_modules`, so none of this
was confirmable against source. A version bump or refactor in that dependency
would silently falsify the claim without any signal in this repo.

**Fix:** Either drop the hard version pin (say "pi-mcp-adapter" without `2.10.0`)
or add a note that the behavior was verified against a specific released version
and should be rechecked on adapter upgrades.

### IN-02: The `E` glyph is overloaded — MCP-env plugin-root/data injection is a stage-time config write, not `process.env` inheritance

**File:** `docs/env-vars.md:11,19-20,116-117`
**Issue:**
The `E` mechanism paragraph (line 11) defines runtime env injection around live
`process.env` (session vars set on `process.env`, hook lanes adding keys to the
child env). But the MCP-env cells for `CLAUDE_PLUGIN_ROOT` / `CLAUDE_PLUGIN_DATA`
(matrix lines 19-20; table lines 116-117) are marked `E` while the code
(`bridges/mcp/substitute.ts:113-120`, via `stage.ts`) *writes them into the
server's `env` map in `mcp.json` at stage time* — an install-stable, disk-baked
write closer to `S` semantics than to the process.env inheritance the `E`
paragraph describes. The per-surface note ("Injected into each stdio server's
`env`") clarifies it, but the shared `E` glyph conflates two distinct delivery
paths in the same column.

**Fix:** Optional. Consider a footnote on the MCP-env plugin-root/data cells
noting the value is baked into the server's `env` config at stage time (not
inherited from `process.env`), distinguishing it from the `‡` session vars.

---

_Reviewed: 2026-08-03_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
