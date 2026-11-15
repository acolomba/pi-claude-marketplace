---
phase: "10"
iteration: 1
status: all_fixed
findings_in_scope: 3
fixed: 3
skipped: 0
created: "2026-11-15"
---

# Phase 10 — Code Review Fix Report (iteration 1)

Scope: Critical and Warning findings of `10-REVIEW.md` (0 Critical, 3 Warning). Info findings IN-01 to IN-08 are out of scope.

| Finding | Disposition | Commit | Evidence |
|---------|-------------|--------|----------|
| WR-01 | fixed: the AMIG-01 move writes the staged options to the record whatever its verdict; `userConfig` follows the staged source (reinstall parity), `mcpServerConfigs` still the record's own version (MREC-02) | 50106f97 | owner cases red then green (73/2 -> 75/75); `features/mcp-server/legacy-move.feature` red under both profiles, then 6/6 green under both |
| WR-02 | fixed under new decision D-PG10-25 (pending maintainer review): an unreadable stored `userConfig` reads as declared with no values, so the built-in MCP blocks servers that name an option instead of registering literal text | 99c33372 | state-io and builtin-registration-step owner cases red then green; `features/mcp-server/builtin-options.feature` (builtin) 4/5 red, then 5/5 green |
| WR-03 | resolved as parity, comment corrected: Claude Code 2.1.323 runs the exec-form hook option pass (`Frn`) after the path variables (10-RESEARCH, `BIN@312871364`), so the two passes stay; T-10-24 covers the content pass of `shared/vars.ts`, which is one pass | 75805061 | new owner case pins the order |

Residual (WR-01): when a path-source catalog has moved past the record's version, the hooks hydrate reads the newer version's option defaults.
