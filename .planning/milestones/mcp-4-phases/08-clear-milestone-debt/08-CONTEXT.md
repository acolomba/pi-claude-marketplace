# Phase 8: Clear milestone debt - Context

**Gathered:** 2026-10-09
**Status:** Ready for planning

<domain>
## Phase Boundary

The mcp-4 milestone audit (`.planning/mcp-4-MILESTONE-AUDIT.md`) read
`tech_debt`. The operator chose to clear all of it before the milestone
closes. This phase:

- makes the PR pass the Lint `fallow-audit` job (verdict `pass`);
- fixes every open review finding of Phases 1-7 that is still real, and
  closes the rest with a recorded reason;
- settles MCPOVR-01 and MCPROW-01 by the decisions below;
- makes `openUi` and `trace` carried fields;
- makes name-indexed state lookups refuse inherited keys (OWNKEY-01);
- brings the planning records in line with the code.

Phase 1's Nyquist validation and security review were done before this
phase (`24d2d904`, `6f11df72`) and are out of scope.

Requirements: DEBT-01..05 (`.planning/REQUIREMENTS.md`, one per roadmap
success criterion). Each plan also cites the finding IDs it closes
(`P<phase> IN-NN` / `WR-NN`, `MCPOVR-01`, `MCPROW-01`, `OWNKEY-01`) and the
D-08 decisions below.

</domain>

<decisions>
## Implementation Decisions

### Carried fields

- **D-08-01:** `openUi` and `trace` join `CARRIED_FIELDS`
  (`bridges/mcp/adapter-entry.ts`). Both are user preferences in
  pi-mcp-adapter's `ServerEntry` with no credential content, the same class
  as `debug`. The AFILE-06 pin test against `ServerEntry` changes with it.

### MCPOVR-01: per-server choices outlive the plugin lifecycle

- **D-08-02:** A user's per-server choices (the carried fields, including
  `disabled` from `/mcp-adapter disable`) live apart from the plugin's
  lifecycle. They survive update and reinstall (already true, AFILE-06),
  plugin disable then enable, AND uninstall then reinstall. Upstream
  evidence: Claude Code 2.1.296 stores the `/mcp` choice in
  `~/.claude.json` `projects[<path>].disabledMcpServers`, keyed by
  `plugin:<plugin>:<server>`, and no plugin disable, enable or uninstall
  code touches it (`08-UPSTREAM-EVIDENCE.md` §1). The operator: "it's ok for
  the two lifecycles to be separate."
- Storage (operator ruling 2026-10-09, after research): a new top-level
  member `_piClaudeMarketplace.serverChoices` in the same
  `mcp-adapter.json`, outside `mcpServers`, keyed by the generated server
  key (`domain/name.ts`). Disable and uninstall move a server's carried
  choices into it; enable and reinstall move them back into the new entry;
  each move is part of the one atomic write of that file (NFR-1, NFR-10).
  pi-mcp-adapter 5.2.0 ignores and preserves unknown top-level keys
  (`08-RESEARCH.md`). Rejected: a leftover stub entry (the adapter loads it
  as a real server: a `disabled` stub shows as a disabled server, any other
  field fails to connect) and a `state.json` store (second file write,
  schema bump, every remover changes).
- Research side finding: `/mcp-adapter disable` writes to the project file,
  so a user-scope plugin's choice already survives per project; fix
  `docs/mcp-compatibility.md` accordingly.
- Divergence to document: upstream keys the choice per project; ours is per
  scope file. Record it as a Pi capability gap in `docs/mcp-compatibility.md`.

### MCPROW-01: success row plus separate notices

- **D-08-03:** The target behavior: `enable` and `import` of a plugin whose
  servers carry unset variables or withheld credentials report a success
  row with the MCP variable notices as their own warning lines, as
  `install` does. Research found this already holds with the adapter
  loaded: `(installed)` is the catalog's normal enable row, and the
  warning in the pinned test comes from SEV-01 (pi-mcp-adapter not
  loaded raises the row, exactly as for install). Operator ruling
  2026-10-09: keep SEV-01 consistent across install, enable and import;
  add tests pinning the adapter-loaded enable and import shapes; close
  MCPROW-01 in BACKLOG with this explanation. No renderer change. Upstream reports enable and install as plain success and shows
  missing-variable warnings separately (`/mcp`, `claude mcp list`);
  `08-UPSTREAM-EVIDENCE.md` §2. Showing the notice at enable and import is a
  Pi capability gap (Pi has no `/mcp`). `docs/output-catalog.md` gains one
  sentence on this; the renderer stays as it is.

### WR-02: OAuth with headers (parity fix)

- **D-08-04:** Write `auth: "oauth"` on a remote (http/sse) entry whose
  `headers` is non-empty and has no `Authorization` key
  (case-insensitive); otherwise leave `auth` unset. This matches Claude
  Code 2.1.296, which builds its OAuth provider unless `headers` carries
  Authorization (or a headersHelper mints one), with or without an `oauth`
  object; pi-mcp-adapter turns OAuth off for any non-empty `headers`
  unless `auth: "oauth"` is set (`08-UPSTREAM-EVIDENCE.md` §3). The
  Phase 3 UAT acceptance carried no decision ID and no capability gap, so
  the parity default applies. Operator ruling 2026-10-09: write
  `auth: "oauth"` only when every header value is clean. pi-mcp-adapter
  in OAuth mode refuses to connect when a header value is an unset
  `${VAR}`, a withheld credential written as `""`, or carries the escape
  token `{env:PI_CLAUDE_MARKETPLACE_EMPTY}` (`08-RESEARCH.md`); such a
  server keeps today's entry (connects without OAuth). Record that
  remainder as a Pi capability gap in `docs/mcp-compatibility.md`. Fix the `03-REVIEW.md` claim "Claude keeps
  OAuth in both cases" in the docs: true only without Authorization.
  Side check: in OAuth mode the adapter refuses to connect when a header
  `${VAR}` is unset or empty, where upstream warns and keeps the raw text;
  confirm what `bridges/mcp/substitute.ts` writes and record the result.

### Phase 5 remedy rows (IN-07, IN-08)

- **D-08-05:** Make both remedies true.
  - IN-08: reinstall falls back to a fresh clone when the mirror HEAD is
    unreadable (`orchestrators/plugin/reinstall-clone-probe.ts`), so the
    existing `reinstall` remedy works and retries are safe (NFR-3). Network
    use stays inside the existing git-source cache-miss rule (NFR-5).
  - IN-07: the warm recorded-sha clone that lacks the plugin subdir
    (`missing-subdir` / `escapes`) gets a row naming
    `/claude:plugin update <plugin>@<marketplace>`. Amend D-05-02 and the
    catalog block together.
  - Amended 2026-10-10 by review fix WR-04 (9003e476): only `missing-subdir`
    gets the `source-outdated` row. An `escapes` path fails in every commit,
    so `update` cannot clear it; it gets the `marketplace-unreadable` row.

### Phase 4 IN-02: explicit environment

- **D-08-06:** Thread a `ClaudeEnv` through the install ledger,
  update-swap, reinstall-replace and the reconcile migration into
  `prepareStageMcpServers`, defaulting to `process.env` at the entry point
  the way `orchestrators/plugin/info.ts` already does. House DI rule
  (CONVENTIONS "Dependency injection over test-only seams"). Its own plan:
  it collides with the migration and OWNKEY-01 batches.

### OWNKEY-01: inherited keys

- **D-08-07:** Name-indexed lookups on plain-object state maps refuse
  inherited keys (`constructor`, `__proto__`, `toString`, ...). Operator
  ruling 2026-10-09: name validation rejects only `__proto__`;
  `constructor`, `toString` and the other prototype names stay valid names
  and work because every read checks own keys. Fix at the
  source as well as the reads: names are validated by `assertSafeName`,
  which lets `constructor` and `__proto__` through; a `__proto__` key in a
  write drops the record. Triage counts 131 lookups in 30 files; a shared
  helper (e.g. `shared/own-key.ts`) plus a name-validation rule is the
  expected shape. Planner decides the split (triage suggests two waves).

### Fallow audit (PR blocker)

- **D-08-08:** `npx fallow audit --base <merge-base with origin/main>`
  must read `pass`. At `24d2d904` it reads `warn` with 14 clone groups:
  - Research correction: only the 2 `plugin-info.ts` fixture groups count
    as added at HEAD; hoisting their shared row turns the audit to `pass`
    (tested in a scratch clone). Editing lines inside an old group
    re-flags it as added, so run the audit after every plan that touches a
    listed file and at the end. Original list, for reference:
  - 4 looked new on this branch: the two `tests/architecture/catalog-uat/fixtures/plugin-info.ts`
    groups (P3 WR-05; hoist the shared fixture row), `bridges/agents/stage.ts:514`
    vs `bridges/skills/stage.ts:563`, and the live-uat canary pair
    `tests/live-uat/manifest-absence-canary.mjs:631` vs
    `tests/live-uat/stop-canary.mjs:485` (main's `ignoredClones` key
    `dup:cc950b18:2` no longer matches after this branch edited
    `stop-canary.mjs`).
  - 10 exist on main unchanged in content; the audit counts them because
    this branch edited lines inside their spans (all share the
    mid-expression hash `c77b3abb6f87acd9`, so their `-rN` handles cannot
    be `ignoredClones` keys).
  Remove the new groups by refactoring. For the 10 pre-existing groups,
  extract where cheap and safe; otherwise use the house precedent, a
  `fallow-ignore-next-line code-duplication -- <reason>` marker on a
  reviewed group (CONVENTIONS "Suppressions"), and update the marker count
  there. Re-run the audit after every change; marker spans move.

### Disposition ledgers

- GSD's ledger parser knows `open|fixed|skipped|deferred` only
  (`08-RESEARCH.md`). Write `fixed` for fixed and already-fixed rows (cite
  the commit), and `wontfix` rows with their reason; note in the plan that
  a later code-review rewrite of that ledger would read `wontfix` as
  `open`. Phase 7 has no ledger yet; create `07-REVIEW-DISPOSITION.md`.

### Claude's Discretion

- Every `fix` and `wontfix` classification in `08-TRIAGE.md`, unless a
  plan finds the triage wrong at HEAD (then record why). `wontfix` rows
  get their reason written into the disposition file.
- Plan split and wave order. Triage batches A-H touch disjoint files and
  can share a wave; OWNKEY-01 (batch I), D-08-06 and any catalog-wide
  change (D-08-03, D-08-05 IN-07) run alone or after the batches they
  collide with.
- Wording of new or changed catalog rows, within the notification grammar
  (subject-first rows; `Error:`/`Warning:` followed by a summary).

</decisions>

<compat_evidence>
## Claude Code evidence records

`08-UPSTREAM-EVIDENCE.md` holds the binary and docs excerpts for
MCPOVR-01 (§1), MCPROW-01 (§2) and WR-02 (§3), Claude Code 2.1.296 and
pi-mcp-adapter 5.2.0.

</compat_evidence>

<canonical_refs>
## Canonical References

- `.planning/mcp-4-MILESTONE-AUDIT.md` — the debt list this phase clears.
- `08-TRIAGE.md` — every open finding classified at `24d2d904`, with
  file:line, fix sketch, size, risk and suggested batches A-I.
- `08-UPSTREAM-EVIDENCE.md` — upstream contract for D-08-02..04.
- `0N-REVIEW.md`, `0N-REVIEW-FIX*.md`, `0N-REVIEW-DISPOSITION.md` for
  phases 1-7 — the findings' original text and the ledgers to close.
- `.planning/BACKLOG.md` — MCPOVR-01, MCPROW-01 (close them there).
- `.planning/codebase/CONVENTIONS.md` — suppression count, DI rule.
- `docs/output-catalog.md` — byte-locked notice blocks (D-08-03, D-08-05).
- `docs/mcp-compatibility.md` — divergences list (D-08-02, D-08-04).

</canonical_refs>

<code_context>
## Existing Code Insights

- Carried fields: `bridges/mcp/adapter-entry.ts` `CARRIED_FIELDS`.
- Unstage and stub write-back: `bridges/mcp/unstage.ts`,
  `_piClaudeMarketplace.keptOverride` (D-02-21..23).
- Key builder: `domain/name.ts` `generatedMcpServerKey`.
- Remote options: `domain/mcp-server-features.ts` `remoteOptions`.
- Migration rows: `orchestrators/reconcile/mcp-migration.ts`,
  `shared/notification-dispatch.ts`.
- Staging entry points: `install-outcome.ts` `mcpPhase`, `update-swap.ts`,
  `reinstall-replace.ts`, `reconcile/mcp-migration.ts`.

</code_context>

<specifics>
## Specific Ideas

- Disposition ledgers: mark P2 IN-04 and IN-06 `already-fixed`
  (6cb09db2), P2 WR-06 `wontfix (D-02-18)`, P3 WR-01 and the WR-03 code
  half `wontfix (accepted, 03-UAT.md)`, P3 WR-02 `fixed (D-08-04)`.
- Records: ROADMAP Phase 1 criterion 4 gains its amendment note
  (D-04-12, D-07-07, quick task 261006-kr1); `STATE.md:636` ADET-02
  wording says an *extension* command.
- Tests run under a hermetic home; no test or agent touches the real
  `~/.pi/agent`.
- Adapter conformance tests need
  `PI_MCP_ADAPTER_ROOT=/var/tmp/mcp4-p7-research/a520/node_modules/pi-mcp-adapter`;
  pi-subagents peer tests need a `PI_SUBAGENTS_ROOT` 0.74.0 scratch install
  (the global one is 0.47.1 and skips silently).

</specifics>

<deferred>
## Deferred Ideas

- P7 IN-06 sub-item (absolute path in a verbatim canary transcript):
  wontfix per triage; masking it requires a live re-run.

</deferred>
