---
phase: 94-environment-variable-documentation
verified: 2026-08-03T00:00:00Z
status: passed
score: 15/15 must-haves verified
behavior_unverified: 0
overrides_applied: 0
---

# Phase 94: Environment-variable documentation Verification Report

**Phase Goal:** The environment-variable behavior shipped by this milestone is
documented as the per-variable × per-surface matrix and two-mechanism model in
a new `docs/env-vars.md`, with the hooks-compatibility env table reconciled
against it — describing shipped behavior, not intent.
**Verified:** 2026-08-03
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `docs/env-vars.md` exists and presents the per-variable × per-surface matrix (Claude Code vs Pi across skills/commands/agents/hooks/MCP), the two-mechanism model, and documented absences (DOC-06 / SC-1) | ✓ VERIFIED | File exists; "Two delivery mechanisms" section (lines 5–11) defines S/E; "Overview matrix" (lines 13–33) covers 11 variable rows × 8 surface columns; "Not delivered (out of scope)" section (158–170) lists absences affirmatively. |
| 2 | `docs/env-vars.md` records the verified pi-mcp-adapter finding — `resolveEnv` builds `{...process.env, ...interpolated(config.env)}`, config keys win, interpolation on env/cwd/headers/bearerToken (unknown var → empty string) NOT command/args — plus spawn-order caveat and session-switch staleness (DOC-06 / SC-2) | ✓ VERIFIED | "MCP runtime env inheritance" section (147–152). Cross-checked against the installed `pi-mcp-adapter@2.10.0` source (`server-manager.ts::resolveEnv`, `utils.ts::interpolateEnvVars`/`interpolateEnvRecord`/`resolveConfigPath`/`resolveBearerToken`) — every claim (spread-then-override, config-keys-win, interpolation targets, empty-string fallback, command/args excluded) matches the actual code verbatim. Spawn-order + session-switch staleness both documented (151–152). |
| 3 | `docs/hooks-compatibility.md` env table reconciled against `docs/env-vars.md` — no contradiction on which hook env vars ship (DOC-07 / SC-3) | ✓ VERIFIED | Table (186–201) adds `CLAUDECODE`, `CLAUDE_CODE_SESSION_ID`, pi-only `CLAUDE_SESSION_ID`, `PATH`, `PI_CLAUDE_MARKETPLACE_PATH`; `CLAUDE_ENV_FILE` corrected from stale `✗` to `⚠` (matches env-vars.md's own `⚠`/`§` treatment — more accurate than a bare `✓` since the write-back-and-source half is unimplemented). One authority line (184) names `docs/env-vars.md` authoritative on conflict. `git diff` confirms only the `## Environment variables` region changed. |
| 4 | C-1: inherited `CLAUDE_CODE_*`/`ANTHROPIC_*` vars ride the spread into hook envs, not scrubbed, citing 91-SECURITY WR-02/T-91-01 | ✓ VERIFIED | "Inherited `CLAUDE_CODE_*` / `ANTHROPIC_*` vars are not scrubbed" subsection (131–133); cites WR-02 and T-91-01/AR-91-01. |
| 5 | C-2: `PI_CLAUDE_MARKETPLACE_PATH` real matrix row (Claude Code column —) + divergences subsection | ✓ VERIFIED | Matrix row (line 28, Claude Code `—`); "Pi-only `PI_CLAUDE_MARKETPLACE_PATH` PATH ledger" subsection (135–137); appears ≥2× total (matrix + per-surface tables + subsection). Matches `shared/session-env.ts::PATH_LEDGER_ENV`/`applyPathLedger` source. |
| 6 | C-3: `CLAUDE_SESSION_ID` real matrix row (Claude Code —), pi-only alias in bash children AND hook envs | ✓ VERIFIED | Matrix row (line 27, Claude Code `—`); "Pi-only `CLAUDE_SESSION_ID` alias" subsection (139–141) states presence in bash children and both hook lanes. Matches `shared/session-env.ts::claudeSessionEnvFor`. |
| 7 | C-4: MCP spawn-order caveat + session-switch staleness + `resolveEnv` finding | ✓ VERIFIED | Same evidence as truth #2; both caveats explicit in "MCP runtime env inheritance" (151–152). |
| 8 | C-5: user-scope `${CLAUDE_PROJECT_DIR}` pass-through, incl. Claude Code's own bash children carrying no `CLAUDE_PROJECT_DIR` | ✓ VERIFIED | "User-scope `${CLAUDE_PROJECT_DIR}` pass-through" subsection (154–156) states materialization-once-at-install, literal pass-through, no env rescue, and explicitly notes Claude Code's own bash children carry none upstream (deliberate parity). Cites 92-SECURITY T-92-06. Matches `bridges/mcp/substitute.ts::buildVarMap` (user scope omits the key). |
| 9 | C-6: divergences subsections cite 91-SECURITY.md / 92-SECURITY.md dispositions rather than restating registers | ✓ VERIFIED | C-1 cites 91-SECURITY.md (WR-02/T-91-01); C-5 cites 92-SECURITY.md (T-92-06); no register restated. |
| 10 | Neither doc contains GSD phase/plan/wave numbers in shipped content | ✓ VERIFIED | `grep -nEi '(phase|plan|wave) [0-9]' docs/env-vars.md docs/hooks-compatibility.md` returns no matches. |

**Score:** 10/10 truths verified (0 present-but-behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `docs/env-vars.md` | New: two-mechanism prose, overview matrix + legend, per-surface tables, divergences (C-1..C-6), not-delivered section | ✓ VERIFIED | 171 lines. All sections present: intro, two-mechanism model, overview matrix + legend, 7 per-surface tables (bash, skills, commands, agents, hooks, MCP config, MCP env), divergences (5 subsections covering C-1..C-5, C-6 satisfied via citations), not-delivered section. |
| `docs/hooks-compatibility.md` | Modified: corrected + extended `## Environment variables` table plus one authority line | ✓ VERIFIED | Diff confirms single-section edit; table extended from 9 to 13 rows; authority line added. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| Overview-matrix glyphs (S/E) | Two-mechanism prose | Legend line + matrix cells | ✓ WIRED | Legend (line 15) defines S/E/—/✗/⚠ inline with the matrix; matrix cells (19–29) use exactly these glyphs. |
| Matrix + per-surface footnote markers | Divergences subsections | `†`/`‡`/`§` markers → named subsections | ✓ WIRED | `†` → "User-scope pass-through", `‡` → "MCP runtime env inheritance", `§` → "CLAUDE_ENV_FILE is exposed but not sourced" — each marker resolves to exactly one subsection; no duplicated caveat text found. |
| Pi-only matrix rows (C-2, C-3) | Their divergences subsections | Row → "See ..." pointer | ✓ WIRED | Both rows (27–28) and their per-surface table entries carry "See ..." pointers to the matching subsection. |
| `docs/hooks-compatibility.md` env table | `docs/env-vars.md` | Authority line + no contradicting cells | ✓ WIRED | Authority line present (184); cross-checked cell values (`CLAUDE_ENV_FILE` ⚠ in both, `PI_CLAUDE_MARKETPLACE_PATH` Claude Code `—`/Pi `✓` in both) — no contradiction. |

### Behavioral Spot-Checks

Docs-only phase (no runnable entry points to exercise) — code-level claims were instead source-cross-checked directly (see below), which is the appropriate substitute for a documentation deliverable.

| Claim | Source checked | Result |
|-------|----------------|--------|
| Four-token substitution, literal pass-through on absent value | `extensions/pi-claude-marketplace/shared/vars.ts` | ✓ Matches (`TOKEN_TO_FIELD`, `value ?? matched`) |
| `CLAUDECODE`/`CLAUDE_CODE_SESSION_ID`/`CLAUDE_SESSION_ID`/PATH ledger | `extensions/pi-claude-marketplace/shared/session-env.ts` | ✓ Matches (`claudeSessionEnvFor`, `PATH_LEDGER_ENV`, `applyPathLedger` append-only) |
| Hook lane spread order + `CLAUDE_ENV_FILE` SessionStart-only + `CLAUDE_CODE_REMOTE` unset | `bridges/hooks/dispatch-exec.ts` | ✓ Matches (lines 314–332) |
| Second hook lane parity | `bridges/hooks/async-rewake/registry.ts` | ✓ Matches (lines 611–626) |
| MCP deep substitution, stdio-only injection, declared-env-wins | `bridges/mcp/substitute.ts` | ✓ Matches (`deepSubstitute`, `substituteAndInject`) |
| `resolveEnv` spread-then-override, config keys win | Installed `pi-mcp-adapter@2.10.0` `server-manager.ts` | ✓ Matches exactly (lines 422–435) — **version pin 2.10.0 confirmed correct** against installed package |
| Interpolation on env/cwd/headers/bearerToken, unknown var → empty string, NOT command/args | Installed `pi-mcp-adapter@2.10.0` `utils.ts` | ✓ Matches exactly (`interpolateEnvVars`, `interpolateEnvRecord`, `resolveConfigPath`, `resolveBearerToken`; `command`/`args` used raw in `server-manager.ts:94-95,109`) |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| DOC-06 | 94-01-PLAN.md | New `docs/env-vars.md` matrix + two-mechanism model + pi-mcp-adapter finding | ✓ SATISFIED | Truths #1, #2, #4–9 above. |
| DOC-07 | 94-01-PLAN.md | `docs/hooks-compatibility.md` env table reconciled | ✓ SATISFIED | Truth #3 above. |

No orphaned requirements — `REQUIREMENTS.md` maps only DOC-06/DOC-07 to Phase 94, and both are claimed by the plan.

### Anti-Patterns Found

None. `grep` for `TBD|FIXME|XXX|TODO|HACK|PLACEHOLDER` across both files returns no matches. `grep -nEi '(phase|plan|wave) [0-9]'` returns no matches (content-policy clean). `pre-commit run mdformat markdownlint-cli2` exits 0 on both files.

### Prior Review (94-REVIEW.md)

The phase's own code-review/fix loop converged after 3 iterations to 0 critical / 0 warning / 3 info findings, all optional and non-blocking:
- IN-01: the `pi-mcp-adapter 2.10.0` version pin and `resolveEnv` internals were unverifiable *from this repo's tree* (package absent from `node_modules`). This verifier independently confirmed both against the globally installed `pi-mcp-adapter@2.10.0` package — the version and every implementation detail cited (spread order, interpolation targets, empty-string fallback, command/args exclusion) match exactly. IN-01's underlying concern (drift risk on adapter upgrade) is a legitimate forward-looking note, not a current defect.
- IN-02/IN-03: cosmetic footnote-scoping suggestions, non-blocking, do not affect any must-have.

## Gaps Summary

None. All 10 observable truths (including all six mandatory carrier items C-1..C-6) verified against both the documentation text and the underlying shipped source code, including a live cross-check of the externally-versioned `pi-mcp-adapter` dependency that the SUMMARY.md itself flagged as unverifiable in-repo. The hooks-compatibility.md reconciliation touches only the intended section and introduces no contradiction with the new authoritative doc. Lint and content-policy checks are clean.

---
_Verified: 2026-08-03_
_Verifier: Claude (gsd-verifier)_
