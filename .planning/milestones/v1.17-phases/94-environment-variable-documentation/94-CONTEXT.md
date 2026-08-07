# Phase 94: Environment-variable documentation - Context

**Gathered:** 2026-08-03
**Status:** Ready for planning

<domain>
## Phase Boundary

Document the environment-variable behavior shipped by milestone v1.17: a NEW
`docs/env-vars.md` presenting the per-variable × per-surface matrix (Claude
Code ground truth vs Pi delivery across skills, commands, agents, hooks, MCP
servers), the two-mechanism model (install-time textual substitution for
install-stable per-plugin values vs runtime env injection for session-scoped
values), the documented absences/divergences, and the verified pi-mcp-adapter
`process.env`-inheritance finding (DOC-06); plus `docs/hooks-compatibility.md`'s
environment-variable table reconciled against it (DOC-07). Docs-only phase —
describes SHIPPED behavior (phases 90-93), not intent. No source-code changes.

Runs sequentially (non-worktree) per house convention for docs phases.

</domain>

<decisions>
## Implementation Decisions

### Document structure (docs/env-vars.md)
- **D-94-01:** Hybrid structure — lead with ONE compact variables × surfaces
  overview matrix, followed by per-surface detail sections using the house
  table style (`Variable | Claude Code | Pi | Notes`) matching
  docs/hooks-compatibility.md. Satisfies DOC-06's literal "matrix" language
  while keeping per-surface detail readable.
- **D-94-02:** Overview-matrix cells encode the delivery mechanism with glyphs
  plus a single legend line: `S` = install-time substitution, `E` = runtime env
  injection, `—` = not applicable, `✗` = documented absence; footnote markers
  (e.g. `†`, `*`) on cells that carry a caveat. The two-mechanism model is
  visible at a glance in the matrix itself.

### Divergences and documented absences
- **D-94-03:** A dedicated "Divergences and documented absences" section holds
  the full prose — one subsection per caveat; matrix cells and per-surface
  rows carry ONLY footnote markers pointing there. Single citable home per
  caveat; no duplicated caveat text.
- **D-94-04:** The two pi-only variables get REAL rows in the overview matrix
  and per-surface tables, marked pi-only with Claude Code column `—` (does not
  exist upstream): `CLAUDE_SESSION_ID` (alias; bash children AND both hook
  lanes, SENV-03 + D-91-02) and `PI_CLAUDE_MARKETPLACE_PATH` (PATH-ledger
  bookkeeping var from D-90-01, visible to children). Hiding them would
  undercut the matrix's ground-truth claim.

### Out-of-scope (document-only) variables
- **D-94-05:** A dedicated "Not delivered (out of scope)" section lists each
  document-only item with a one-line why; they stay OUT of the overview matrix
  so it reflects delivered behavior. Items: `${user_config.*}` /
  `CLAUDE_PLUGIN_OPTION_*` (needs a plugin-options feature),
  `CLAUDE_CODE_CHILD_SESSION` + `CLAUDE_CODE_ENTRYPOINT` (identity semantics
  of a different host), headersHelper vars (`CLAUDE_CODE_MCP_SERVER_NAME`/
  `_URL` — pi-mcp-adapter territory), `CLAUDE_EFFORT` (Pi `thinkingLevel`
  mapping possible but semantically approximate).

### DOC-07 reconcile (docs/hooks-compatibility.md)
- **D-94-06:** Correct the env table IN PLACE and keep it hook-scoped and
  complete: fix the stale `CLAUDE_ENV_FILE` row (ships on both hook lanes,
  currently shows ✗), add the missing shipped rows (`CLAUDECODE`,
  `CLAUDE_CODE_SESSION_ID`, pi-only `CLAUDE_SESSION_ID`), and add ONE
  authority line declaring `docs/env-vars.md` authoritative on conflict.
  Readers of the hooks contract doc stay self-sufficient; authority is
  explicit. — **Reversibility:** reversible — a later milestone can slim to a
  pointer without breaking anything.

### Mandatory content inventory (carrier items — MUST land in docs/env-vars.md)
These are locked content requirements carried from phases 90-93; losing any of
them ships the milestone un-documented:
- **C-1 (WR-02 nested-host caveat):** inherited parent `CLAUDE_CODE_*` /
  `ANTHROPIC_*` vars ride the `process.env` spread into hook envs and are
  DELIBERATELY not scrubbed (non-interference stance; requirements never
  authorized scrubbing). Divergences section.
- **C-2 (PATH ledger):** pi-only `PI_CLAUDE_MARKETPLACE_PATH` env var —
  bookkeeping ledger for plugin-bin PATH ownership (D-90-01 revised: env-var
  ledger because module state does not survive `/reload` while `process.env`
  does); visible to children. Matrix row (D-94-04) + divergences subsection.
- **C-3 (session-id alias):** pi-only `CLAUDE_SESSION_ID` alias present in
  bash children AND both hook lanes, internally consistent with
  `CLAUDE_CODE_SESSION_ID`/`CLAUDECODE` within a dispatch (D-91-02). Matrix
  row (D-94-04) + divergences subsection.
- **C-4 (MCP runtime caveats):** spawn-order caveat (servers spawned before
  the extension's session-start handler miss the session vars) and
  session-switch staleness (a running server keeps spawn-time env) — already
  named in DOC-06 requirement text; pi-mcp-adapter 2.10.0
  `server-manager.ts::resolveEnv` spreads `{...process.env,
  ...interpolated(config.env)}` (config keys win; `${VAR}`/`$env:VAR`
  interpolation on env/cwd/headers/bearerToken, unknown var → empty string,
  NOT command/args).
- **C-5 (user-scope `${CLAUDE_PROJECT_DIR}` pass-through):** SUB-02 documented
  divergence — Claude Code substitutes at invoke time even for user-scope
  artifacts; Pi materializes once at install so user-scope occurrences stay
  literal; no env var rescues it (Claude Code's own bash children carry no
  `CLAUDE_PROJECT_DIR`, so Pi deliberately sets none in bash children either).
- **C-6 (threat dispositions):** 91-SECURITY.md and 92-SECURITY.md record the
  related threat dispositions (e.g. WR-02 no-scrub); cite where the
  divergences section touches them — do not restate registers.

### Claude's Discretion
- Exact glyph/footnote characters, section ordering within the doc, matrix
  column ordering (suggested: content surfaces first, then bash children,
  hooks, MCP), and the precise surface column set (e.g. whether MCP config
  substitution and MCP spawn env are one column or two) — planner/executor
  decide from readability.
- Wording and depth of each divergence subsection, provided every carrier item
  C-1..C-6 is present and accurate to the shipped code.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirement + ground truth
- `.planning/REQUIREMENTS.md` — DOC-06/DOC-07 full requirement text (DOC-06
  embeds the verified pi-mcp-adapter finding verbatim).
- `.planning/PROJECT.md` §"Current Milestone: v1.17 env-parity" — target
  features + Key context: ground truth verified against the Claude Code
  v2.1.212 binary and live session env; the out-of-scope (document-only) list.
- `.planning/ROADMAP.md` §"Phase 94" — goal + success criteria.

### Shipped-behavior sources (per-phase decisions the doc describes)
- `.planning/phases/91-hook-environment-parity/91-CONTEXT.md` — D-91-01
  (drift guard), D-91-02 (CLAUDE_SESSION_ID pinned both lanes).
- `.planning/phases/92-mcp-staging-parity/92-CONTEXT.md` — D-92-01
  (whole-entry deep substitution), D-92-02 (stdio-only env injection).
- `.planning/phases/93-substitution-completion/93-CONTEXT.md` — SUB-01/SUB-02
  lock text (skillDir value, projectDir = install cwd, user-scope
  pass-through).
- `.planning/phases/91-hook-environment-parity/91-SECURITY.md` and
  `.planning/phases/92-mcp-staging-parity/92-SECURITY.md` — threat
  dispositions the divergences section may cite (C-6).

### DOC-07 target
- `docs/hooks-compatibility.md` §"Environment variables" (~line 182) — the
  stale table to correct in place (CLAUDE_ENV_FILE shows ✗ but ships; Phase 91
  rows missing).

### Implementation ground truth (verify claims against code, not memory)
- `extensions/pi-claude-marketplace/shared/vars.ts` — the four-variable
  substitution helper (SUB-01/SUB-02).
- `extensions/pi-claude-marketplace/bridges/hooks/dispatch-exec.ts::prepareEnv`
  and `bridges/hooks/async-rewake/registry.ts::prepareAsyncEnv` — the hook env
  set (HENV-01/02).
- `extensions/pi-claude-marketplace/bridges/mcp/stage.ts::stampServers` — MCP
  substitution + injection (MENV-01..04).
- The Phase 90 session-start handler (session env init + PATH ledger —
  SENV-01..03, PENV-01).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `docs/hooks-compatibility.md` table style (`Variable | Claude Code | Pi |
  Notes` with ✓/✗) — the per-surface detail tables reuse this exact register.
- `docs/research/` holds the milestone's verification research if deeper
  citations are needed.

### Established Patterns
- House doc style: mdformat + markdownlint run via pre-commit; tables must
  pass both.
- Comment/citation policy (`.claude/rules/typescript-comments.md`) applies in
  spirit to docs: requirement IDs (DOC-06, SUB-02…) are good anchors;
  phase/plan/wave numbers are history — keep them out of the shipped doc
  (git has the history). Decision IDs may appear where they aid traceability.

### Integration Points
- `docs/env-vars.md` is NEW — no existing file to preserve.
- `docs/hooks-compatibility.md` §Environment variables — the only edit to an
  existing doc (D-94-06); the rest of that doc is untouched.

</code_context>

<specifics>
## Specific Ideas

- The overview matrix must make the two-mechanism model visible without
  reading prose (glyphs S/E per D-94-02).
- Absence must be affirmative: a reader searching for `CLAUDE_EFFORT` or
  user-scope `${CLAUDE_PROJECT_DIR}` behavior finds a recorded decision, not
  silence.
- Bash-children surface must state the PARITY fact that Claude Code's own
  bash children carry no `CLAUDE_PROJECT_DIR` — Pi's absence there is
  deliberate parity, not a gap.

</specifics>

<deferred>
## Deferred Ideas

### Reviewed Todos (not folded)
- `2026-06-12-coverage-sweep-test-rare-failure-arms-in-update-reinstall-in`
  ("Coverage sweep: test rare failure arms in update/reinstall/install",
  testing area, matched score 0.6) — reviewed, NOT folded: code-test coverage
  work is out of scope for a docs-only phase. Stays pending.

</deferred>

---

*Phase: 94-environment-variable-documentation*
*Context gathered: 2026-08-03*
