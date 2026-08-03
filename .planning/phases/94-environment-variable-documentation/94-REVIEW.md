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
  warning: 1
  info: 3
  total: 4
status: issues_found
---

# Phase 94: Code Review Report (iteration 2)

**Reviewed:** 2026-08-03
**Depth:** standard
**Status:** issues_found

## Summary

Re-review of `docs/env-vars.md` and `docs/hooks-compatibility.md` after the
iteration-1 fix loop (commits da78482a..f1eb5590). I re-traced every touched
matrix cell and prose claim against the shipped bridge sources
(`bridges/mcp/substitute.ts`, `shared/session-env.ts`,
`bridges/hooks/dispatch-exec.ts`, `bridges/hooks/async-rewake/registry.ts`,
`bridges/hooks/event-router.ts`).

**All six prior findings verified CLOSED:**

- **CR-01** (`CLAUDE_ENV_FILE` overstated) — now `⚠` in both docs
  (`hooks-compatibility.md:196`, `env-vars.md:97`), matrix cell `E§`
  (`env-vars.md:25`) with the `§` footnote (`env-vars.md:33`) and a dedicated
  divergence subsection (`env-vars.md:143`). The "exposed but not sourced"
  disposition is factually correct: `dispatch-exec.ts:326-329` and
  `async-rewake/registry.ts:623-626` set the path on the `SessionStart` event
  only (both spawn lanes, `assertPathInside`-guarded); `event-router.ts:761`
  merely pre-creates `_shared/`; nothing anywhere reads, parses, or sources the
  file back. Both docs now agree on `⚠`/not-sourced semantics.
- **WR-01** — per-surface Hooks table now carries `PATH` (`:95`) and
  `PI_CLAUDE_MARKETPLACE_PATH` (`:96`); MCP spawn env table carries both
  (`:124-125`).
- **WR-02** — MCP-env matrix cells for PATH/ledger now marked `E‡`
  (`:26,:28`); the inheritance subsection (`:152`) correctly scopes
  session-switch staleness to the session vars only.
- **WR-03** — substitution now described as whole-entry/deep (`:9`, `:102-104`),
  matching `substitute.ts:52-74` (`deepSubstitute` walks every string leaf; keys
  never substituted; injection scoped to stdio `command` entries).
- **WR-04** — `⚠` now defined in the env-vars legend (`:15`).
- **WR-05** — `§` now has a matching divergence subsection (`:143`).

Carrier items C-1..C-6 all present. Content-policy scan is clean — only
sanctioned decision/finding IDs (`D-90-01`, `T-91-01`, etc.) and the
`9x-SECURITY.md` cross-references; the lone version-regex hit (`v2.1.212`) is the
upstream Claude Code binary version, not a GSD milestone token.

One new cross-doc consistency gap remains (WR-01 below); the two info findings
carry forward from iteration 1, plus one minor footnote-scope nuance.

## Warnings

### WR-01: `hooks-compatibility.md` env-var table omits `PATH` / `PI_CLAUDE_MARKETPLACE_PATH`, contradicting `env-vars.md`'s hook delivery

**File:** `docs/hooks-compatibility.md:186-199` vs `docs/env-vars.md:26,28,95-96`
**Issue:**
`env-vars.md` now documents — in both the overview matrix (Hooks column `E` for
`PATH` line 26 and `PI_CLAUDE_MARKETPLACE_PATH` line 28) and the per-surface
Hooks table (rows added at lines 95-96) — that hook children inherit the
appended plugin-`bin` `PATH` and the pi-only ledger var via the
`...process.env` spread. This is correct against `dispatch-exec.ts:314` /
`async-rewake/registry.ts:611` (both spread `...process.env`, which carries the
`session_start` PATH mutation).

But `hooks-compatibility.md`'s "Environment variables" table (the self-described
"hook-scoped view", line 184) lists no row for either variable. It *does* list
the pi-only `CLAUDE_SESSION_ID` alias (line 193), so the omission is not a
"pi-only vars excluded" policy — it is an inconsistent selection. A plugin author
consulting the hook contract table alone will not learn that their plugin's
`bin/` is prepended-safe-appended onto `PATH` in hook children. This is the same
matrix-asserts-vs-table-omits defect the iteration-1 WR-01 fixed inside
`env-vars.md`; it survives across the doc boundary because iteration 1 scoped
WR-01 to `env-vars.md`'s internal tables only.

**Fix:** Add `PATH` and `PI_CLAUDE_MARKETPLACE_PATH` rows to the
`hooks-compatibility.md` env-var table (Pi `✓`, note: inherited via the hook
lane's `...process.env` spread; see `docs/env-vars.md`), or add a one-line note
under that table that PATH-related vars ride the `...process.env` spread and are
documented authoritatively in `env-vars.md`.

## Info

### IN-01: `pi-mcp-adapter 2.10.0` version and `resolveEnv` internals remain unverifiable from this tree

**File:** `docs/env-vars.md:149`
**Issue:**
The "MCP runtime env inheritance" subsection still pins a specific external
version ("pi-mcp-adapter 2.10.0") and quotes an internal implementation detail
(`server-manager.ts::resolveEnv` building `{...process.env,
...interpolated(config.env)}`; interpolation on `env`/`cwd`/`headers`/`bearerToken`
but not `command`/`args`). Confirmed the package is absent from `node_modules`
(re-checked this iteration), so none of this is confirmable against source. A
version bump or refactor in that dependency would silently falsify the claim with
no signal in this repo. Carried forward from iteration 1 (info-tier, unchanged).

**Fix:** Drop the hard `2.10.0` pin (say "pi-mcp-adapter") or add a note that the
behavior was verified against a specific released version and should be rechecked
on adapter upgrades.

### IN-02: The `E` glyph conflates process.env inheritance with stage-time config writes for MCP plugin-root/data

**File:** `docs/env-vars.md:11,19-20,116-119`
**Issue:**
The `E` mechanism paragraph (line 11) defines runtime env injection around live
`process.env`. But the MCP-env cells for `CLAUDE_PLUGIN_ROOT` /
`CLAUDE_PLUGIN_DATA` (matrix lines 19-20; table lines 118-119) are marked `E`
while the code (`substitute.ts:113-120`) writes them into the server's `env` map
that `stage.ts` bakes into `mcp.json` at stage time — an install-stable disk
write closer to `S` than to the `process.env` inheritance the `E` paragraph
describes. The per-surface note ("Injected into each stdio server's `env`")
clarifies it, but the shared `E` glyph spans two distinct delivery paths in the
same column. Carried forward from iteration 1 (info-tier, unchanged).

**Fix:** Optional. A footnote on the MCP-env plugin-root/data cells noting the
value is baked into the server's `env` config at stage time (not inherited from
`process.env`) would distinguish it from the `‡` session vars.

### IN-03: `‡` footnote text blanket-asserts the session-switch caveat for PATH / ledger, which its own subsection contradicts

**File:** `docs/env-vars.md:32` vs `docs/env-vars.md:152`
**Issue:**
The WR-02 fix marked the MCP-env `PATH` (line 26) and
`PI_CLAUDE_MARKETPLACE_PATH` (line 28) cells with `‡`, whose footnote text
(line 32) reads "subject to the spawn-order **and session-switch** caveats." But
the subsection that footnote points to (line 152) correctly states the
session-switch half does *not* apply to those two vars ("`PATH` and
`PI_CLAUDE_MARKETPLACE_PATH` do not change on a session switch, so only the
spawn-order caveat applies to them"). A reader who reads only the footnote is
told both caveats apply; only the subsection corrects it. This is a byproduct of
the chosen fix path (add `‡` rather than split the footnote) and is minor because
the footnote explicitly directs to the authoritative subsection.

**Fix:** Optional. Soften the `‡` footnote to "subject to the spawn-order caveat
(and, for the session vars, the session-switch caveat); see 'MCP runtime env
inheritance'", so the summary line no longer over-claims for PATH/ledger.

---

_Reviewed: 2026-08-03_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
