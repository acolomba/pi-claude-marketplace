---
phase: 07-docs-and-live-proof
plan: 05
subsystem: docs
tags: [docs, mcp, readme, upgrading, status, divergences]

requires:
  - phase: 07-docs-and-live-proof
    provides: "07-01 the pi-mcp-adapter 5.2.0 floor; 07-02/07-04 the live canary readings (1 reload, not loaded, status unknown -> connected, --no-extensions drops tool_search); 07-03 the CHANGELOG link to #upgrading"
provides:
  - "docs/mcp-compatibility.md: Upgrading, Server status in info, Project-scope servers, pi-mcp-adapter settings that change plugin servers, the 5.2.0 floor and advisory, the corrected lifecycle text, and the divergence list grouped under five subheadings"
  - "README.md / README.es.md: the 5.2.0 floor and one linking sentence each"
  - "docs/output-catalog.md: not loaded also covers a server the reload move wrote in this session"
affects: [ADOC-01, CHANGELOG #upgrading link, phase gate]

actuals:
  tokens: 9700
  tasks: 3
  commits: 3
plan_head_before: c06fb57a5043cfcddfc8ca908792931b39297c45
plan_head_after: 6d2abdbb37d0f495dc2f4d3ffc7e03629886cb86

tech-stack:
  added: []
  patterns:
    - "Divergence bullets grouped under ### subheadings, each ending in a Reason: line"

key-files:
  created: []
  modified:
    - README.md
    - README.es.md
    - docs/mcp-compatibility.md
    - docs/output-catalog.md

key-decisions:
  - "The upgrade notes give the old Pi tool name as `<old-name>_<tool>` (pi-mcp-adapter's default `server` prefix), not the plan's `mcp__<old-name>__<tool>`, because 0.19.2 entries carried no toolPrefix"
  - "The Task 1 link to #project-scope-servers was added in Task 3, when the heading exists, because markdownlint MD051 rejects a link to a missing heading"
  - "The per-tool alwaysLoad and the adapter-settings divergence bullets state no Claude Code contrast beyond the verified E1 behavior; no claim about Claude Code's --mcp-config handling was added"

patterns-established:
  - "MCP home sections link the output-catalog anchors for exact bytes instead of restating notice text"

requirements-completed: [ADOC-01]

coverage:
  - id: D1
    description: "Both READMEs name the pi-mcp-adapter 5.2.0 floor and gain one sentence linking docs/mcp-compatibility.md for the rename after an upgrade and the server state in info"
    requirement: ADOC-01
    verification:
      - kind: other
        ref: "Task 1 <automated> verify (grep for 5.2.0 phrases, exactly 4 mcp-compatibility.md links per README, PRECOMMIT_EXIT=0)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Upgrading section: rename rule with the notice example, each cost with its fix, entries left in place and removed, with catalog anchors"
    requirement: ADOC-01
    verification:
      - kind: other
        ref: "Task 1 <automated> verify + anchor check script (BAD_ANCHORS [], BAD_CATALOG [])"
        status: pass
    human_judgment: false
  - id: D3
    description: "Server status in info section lists all ten tokens and the deferred-session reading; lifecycle text matches pi-mcp-adapter 5.2.0; catalog sentence on not loaded for moved servers"
    requirement: ADOC-01
    verification:
      - kind: unit
        ref: "node --test tests/architecture/catalog-uat/catalog-contract.test.ts tests/architecture/partial-vocabulary-guard.test.ts (49 pass, 0 fail)"
        status: pass
      - kind: other
        ref: "Task 2 <automated> token check (tmp/p7-05-missing-tokens.txt empty); commit hook npm run check:commit Passed"
        status: pass
    human_judgment: false
  - id: D4
    description: "Project-scope approval, per-tool alwaysLoad, --no-extensions, adapter settings, 5.2.0 floor and advisory, and 26 grouped divergence bullets (18 unchanged byte for byte, 8 new, each with Reason:)"
    requirement: ADOC-01
    verification:
      - kind: other
        ref: "Task 3 <automated> verify (18 old bullets present verbatim, five ### subheadings, required terms) and acceptance criteria (26 bullets, all with Reason:)"
        status: pass
    human_judgment: false
  - id: D5
    description: "The approval text describes the adapter's prompt and links its rules without telling users to edit approval files or change trust settings (prohibition, judgment)"
    verification: []
    human_judgment: true
    rationale: "The prohibition is verified by judgment, as the plan's prohibitions block states"

duration: 7min
completed: 2026-10-09
status: complete
---

# Phase 7 Plan 05: MCP home, upgrade notes, status and grouped divergences Summary

**`docs/mcp-compatibility.md` now tells an upgrading user what the move to `plugin_<plugin>_<server>_` costs and how to fix each cost, explains every server state that info shows, documents project-scope approval, per-tool alwaysLoad and the adapter settings that drop plugin servers, names the 5.2.0 floor with GHSA-6qxp-vccf-f47h, and groups all 26 divergences under five subheadings. Both READMEs name 5.2.0 and link it.**

## Performance

- **Duration:** about 7 min
- **Started:** 2026-10-09T22:48:43Z
- **Completed:** 2026-10-09T22:55:47Z
- **Tasks:** 3
- **Files modified:** 4

## README sentence

- English: "To learn what you must do when an upgrade renames your plugin MCP servers, and what each server state in `/claude:plugin info` means, see [MCP compatibility](docs/mcp-compatibility.md)."
- Spanish: "Para saber qué debes hacer cuando una actualización cambia el nombre de tus servidores MCP de complementos, y qué significa cada estado de servidor que muestra `/claude:plugin info`, consulta [Compatibilidad de MCP](docs/mcp-compatibility.md)."

Each sits as its own paragraph after the MCP name-mapping paragraph. The Prerequisites line names `5.2.0 or a later 5.x release` / `5.2.0 o una versión 5.x posterior`. The Pi built-in MCP sub-bullet is unchanged.

## New sections of docs/mcp-compatibility.md

- Intro: a sentence that earlier releases wrote into `mcp.json` and `/reload` moves the entries (links `#upgrading`); a floor paragraph (5.2.0 or a later 5.x release, SDK 2.0.0 -> 2.3.1, GHSA-6qxp-vccf-f47h, no cross-host redirect, same-host `http` -> `https` still works); the basis line names pi-mcp-adapter 5.2.0 and the live canary `tests/live-uat/mcp-adapter-canary.mjs` (result recorded 2026-10-09), and keeps the 2026-10-06 measurement text.
- Tool search: a `_meta["anthropic/alwaysLoad"]` table row and paragraph (Claude Code 2.1.294, E1), and a `--no-extensions` / `-e builtin:tool-search` paragraph from the canary readings.
- Connection lifecycle: the stale startup sentence is replaced with the 5.2.0 rule (startup starts only a server without a valid cached tool list; a server with one starts on first use), plus a link to `#server-status-in-info`.
- `## Project-scope servers` (after Connection lifecycle).
- `## pi-mcp-adapter settings that change plugin servers` (`PI_MCP_CONFIG_MODE=exclusive`, `--mcp-config <file>`, `MCP_DIRECT_TOOLS`, link to the adapter's `docs/configuration.md`).
- Proof against pi-mcp-adapter: 5.2.0 and `>=5.2.0 <6`.
- `## Upgrading` with `### What the new names cost`, `### Entries that stay in mcp.json` (cause and remedy table) and `### Entries that the move removes`.
- `## Server status in info` (ten-token table, deferred sessions, where no state shows, severity, three catalog links).
- Divergences grouped; Further reading gains the adapter configuration docs and the canary section of `tests/live-uat/README.md`.

## Divergence groups

- `### Naming` (3 kept): the `-`/`_` refusal, the trailing `_` on the key, tool-name characters.
- `### Loading` (5 kept + 4 new): lazy servers, `tool_search` off by default, hooks and the `mcp` tool, a malformed server, the timeouts; new: project-scope approval (NFR-10), per-tool alwaysLoad (Pi capability gap), permission rules installed with a warning (ANAME-07), adapter settings with no warning (ADOC-01).
- `### Variables` (10 kept, current order).
- `### Migration` (3 new): one more `/reload` (Pi capability gap), the invalid-config removal (AMIG-01), nothing carried from old entries (AMIG-01).
- `### Status` (1 new): `failed` kept apart from `not connected` (ASTAT-01).

Total 26 bullets, every one with `Reason: `. The 18 base bullets match byte for byte (`tmp/p7-05-missing-bullets.txt` empty).

## Task Commits

1. **Task 1 (tracer): README floor and link, Upgrading section** - `85ed037b` `docs(mcp): add upgrade notes and name the 5.2.0 adapter floor`. Files: README.md, README.es.md, docs/mcp-compatibility.md. Hook: pre-commit passed; npm-check skipped (no build input). Tracer gate re-ran the automated verify after the commit and passed, so expansion continued.
2. **Task 2: server status, lifecycle, catalog sentence** - `b71469da` `docs(mcp): explain the server status that info shows`. Files: docs/mcp-compatibility.md, docs/output-catalog.md. Hook: `npm run check:commit` ran and passed (the catalog is a build input). The catalog diff is one prose line; no fence or `catalog-state` marker changed.
3. **Task 3: approval, settings, floor, grouped divergences** - `6d2abdbb` `docs(mcp): document approval, adapter settings and grouped divergences`. File: docs/mcp-compatibility.md. Hook: pre-commit passed; npm-check skipped (no build input).

## Verification

- Task 1 verify: `VERIFY_T1_OK`; no `5.1.0` adapter mention in either README; the diff carries no `D-0N-NN` ID.
- Task 2 verify: all ten tokens present; the ASTAT-02 catalog anchor present; `catalog-contract.test.ts` + `partial-vocabulary-guard.test.ts`: 49 pass, 0 fail; `PRECOMMIT_EXIT=0`.
- Task 3 verify: `VERIFY_T3_OK`; no `5.1.0` / `>=5.1.0` left; 26 bullets with `Reason: `; every in-file, catalog and live-UAT anchor resolves to a heading slug (script check, empty lists); no `D-0N-NN` ID in the diff.
- Plan verification: three Conventional Commits titles with no phase, plan or decision ID; README.md and README.es.md changed in the same commit.

Focused task verification passed; full phase/PR verification pending (the orchestrator runs the phase-gate `npm run check`).

## Files Created/Modified

- `README.md`, `README.es.md` - 5.2.0 floor and one linking sentence each
- `docs/mcp-compatibility.md` - the MCP home sections listed above
- `docs/output-catalog.md` - one prose sentence on `not loaded` for servers the move wrote in this session

## Decisions Made

See `key-decisions` in the frontmatter.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Old tool-name form in the upgrade notes**
- **Found during:** Task 1
- **Issue:** The plan's action said `mcp__<old-name>__<tool>` becomes `mcp__plugin_<plugin>_<server>__<tool>`. The 0.19.2 entries carried no `toolPrefix`, and pi-mcp-adapter 5.2.0 defaults to the `server` prefix (`types.ts` `getServerPrefix`, `formatToolName`), so the old Pi tool name was `<old-name>_<tool>`.
- **Fix:** The bullet says "A tool that pi-mcp-adapter named `<old-name>_<tool>` with its default prefix becomes `mcp__plugin_<plugin>_<server>__<tool>`". The `mcp:<old-name>` -> `mcp:plugin_<plugin>_<server>_` rule stays as planned.
- **Files modified:** docs/mcp-compatibility.md
- **Committed in:** 85ed037b

**2. [Rule 3 - Blocking] Forward link rejected by markdownlint**
- **Found during:** Task 1
- **Issue:** The `#project-scope-servers` link that the plan puts in Task 1 failed MD051 (link fragments), because Task 3 adds that heading.
- **Fix:** Task 1 shipped the bullet without the link; Task 3 added it, together with the heading. The status table's `pending approval` row also links it.
- **Files modified:** docs/mcp-compatibility.md
- **Committed in:** 85ed037b, 6d2abdbb

**Total deviations:** 2 auto-fixed (1 bug, 1 blocking). **Impact on plan:** both keep the docs correct and the hooks green; no scope change.

## Issues Encountered

None. mdformat re-padded the new tables on the first pre-commit pass of Tasks 2 and 3; the second pass was clean.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Last plan of phase 7. Ready for the phase gate (`npm run check` with `PI_MCP_ADAPTER_ROOT` pointing at a 5.2.0 install) and phase verification.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced. T-07-16: the Project-scope servers section describes the prompt, links the adapter's rules and states that this extension never writes the approval files; it does not tell users to edit approval files or set `projectServers`. T-07-17: the settings section and its divergence bullet name each setting and say that no warning is given. T-07-18: the floor paragraph restates the adapter's Security entry only.

## Self-Check: PASSED

- FOUND: README.md, README.es.md, docs/mcp-compatibility.md, docs/output-catalog.md
- FOUND: 85ed037b, b71469da, 6d2abdbb (ancestors of HEAD)
