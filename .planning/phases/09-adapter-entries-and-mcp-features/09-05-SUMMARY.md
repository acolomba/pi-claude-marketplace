---
phase: 09-adapter-entries-and-mcp-features
plan: "05"
subsystem: docs (MCP)
status: complete
tags: [docs, mcp, pi-mcp-adapter, lifecycle, sampling, features-beyond-tools]
requires: [09-01, 09-03, 09-04, 09-06]
provides:
  - "the `## Features beyond tools` section of `docs/mcp-compatibility.md` (`#features-beyond-tools`)"
  - "corrected lifecycle, project-scope, dropped-field, user-override, status, and Loading passages"
  - "the sampling and MCP Apps UI divergence bullets under Divergences, Loading"
  - "the corrected status paragraph and carried-field list of `docs/output-catalog.md`"
affects: []
tech-stack:
  added: []
  patterns: []
key-files:
  created: []
  modified:
    - docs/mcp-compatibility.md
    - docs/output-catalog.md
decisions:
  - "Under the D-PG9-07 amendment the page says that pi-mcp-adapter 7.0.1 still declares the MCP Apps UI extension to every plugin server, with its own divergence bullet beside the D-PG9-08 sampling bullet; no text says that this extension writes `openUi: false`."
metrics:
  duration: about 40 minutes
  completed: 2026-11-14
requirements: [PG-MCP-08, PG-SEC-03, PG-MCP-06, PG-MCP-09]
actuals:
  tokens: 9000
  tasks: 2
  commits: 2
plan_head_before: ad52fb5ee072bba07b0976db7ef288471bff87fd
plan_head_after: c7dfbe44c31ad9191705892883898b309002d51e
---

# Phase 9 Plan 05: Compatibility Page and Catalog Summary

`docs/mcp-compatibility.md` now says that a stdio plugin server's adapter entry holds
`lifecycle: "lazy-keep-alive"`, what that does under pi-mcp-adapter 7.0.1, when an installed
plugin gets it, and which 17 fields a user keeps. It records the sampling divergence (D-PG9-08)
and the MCP Apps UI divergence (D-PG9-07 amendment), and has a new `## Features beyond tools`
table with evidence in every cell. `docs/output-catalog.md` names the lazy-keep-alive resting
state and lists the carried fields as the code holds them. No catalog example block changed.

## Commits

| Task | Commit | Title |
|------|--------|-------|
| 1 | `f9b36166` | docs(mcp): describe the stdio lifecycle, kept fields, and sampling |
| 2 | `c7dfbe44` | docs(mcp): add the MCP features a plugin server can use beyond tools |

Both commits passed their hooks. `SKIP=npm-check pre-commit run --files ...` exited 0 before each
commit (mdformat rewrote the files on the first pass, the second pass was clean). The root-pin
guard passed before the first edit and before each commit. PLAN_BASE was `ad52fb5e`.

## Passages changed

`docs/mcp-compatibility.md`:

- Opening list: names "the MCP features that a plugin server can use beyond tools".
- Connection lifecycle: the three paragraphs that started "This extension never", "On
  pi-mcp-adapter 7.0.0", and "Thus the first call" became five paragraphs: the stdio default
  and no remote lifecycle (D-PG9-01, D-PG9-02, `configuration.feature`); what `lazy-keep-alive`
  does under 7.0.1 with the one-connection measurement (`invocation.feature`, 09-03 `## Connection
  reuse`); what `lazy` does for a remote server (10-minute default, `init.ts`); the user's own
  `lifecycle` wins (D-PG9-03, `lifecycle.feature`, modes from the adapter's `docs/servers.md`);
  and when an installed plugin gets the default (D-PG9-04, 09-03 `## Lines for later plans`;
  `reinstall` once; a load writes only the AMIG-01 move).
- Project-scope servers: the approval bullet names the `lifecycle` default and the
  `defaultFields` record beside `requestTimeoutMs`, and says that `project-server-trust.ts`
  hashes the whole entry, read and not measured.
- Dropped fields: `protocolVersion` default `legacy` now cites the 7.0.1 `docs/servers.md`, and a
  `protocolVersion` you write is kept, with a link to User overrides.
- User overrides: the 17-name carried list in code order; a new paragraph on the four D-PG9-05
  fields and why `caFile` can only narrow trust; a new paragraph on the two defaults this
  extension writes (timeout, stdio lifecycle), their `defaultFields` record, the equal-value
  residual of D-PG9-03, no `openUi` default (D-PG9-07), and the Pitfall 9 downgrade residual.
- The exception paragraph: the `lifecycle` default is this extension's, never the plugin's.
- Server status in info: the `cached, connects on first use` and `not connected` rows say "a lazy
  or lazy-keep-alive server before its first use"; the no-report paragraph says "lazy or
  lazy-keep-alive" and cites `index.ts`; the 7.0.0 measurement became the 09-03 `## Status row`
  (`connected` after the startup listing, `companion-missing.feature`), with the earlier 7.0.0
  reading kept as history.
- Divergences, Loading: the ANAME-05 bullet became the D-PG9-01 bullet; new sampling bullet
  (D-PG9-08) and new MCP Apps UI bullet (D-PG9-07 amendment).
- New `## Features beyond tools` section between Connection lifecycle and Project-scope servers.

`docs/output-catalog.md`: the status paragraph (resting states and the no-report session now say
"lazy or lazy-keep-alive") and the override paragraph's carried list (adds
`appendStructuredContent`, `roots`, `protocolVersion`, `tasks`, `exposeResources`, `caFile`;
the "only `requestTimeoutMs`" sentence stays).

## Evidence of each new cell

| Feature | Claude Code 2.1.323 | pi-mcp-adapter 7.0.1 | Pi built-in 1.5.0 |
|---------|--------------------|----------------------|-------------------|
| Resources | unmeasured, MCP reference | measured, `features/mcp-server/resources.feature` (adapter scenario); `exposeResources` from `init.ts` | measured, `features/mcp-server/resources.feature` (built-in scenario); UI resources from `dist/extensions/mcp/resources.js` |
| Prompts | unmeasured, MCP reference | unmeasured in a session; spike S3 (`docs/prd/parity-gaps-prd.md` section 9, line 952), form from `docs/prompts-and-ui.md` | unmeasured, source read (no prompt code in `dist/extensions/mcp/`) |
| Elicitation | unmeasured, MCP reference and binary grep | measured declaration, adapter `initialize` rows of `invocation.feature`; modes from `docs/prompts-and-ui.md`, `init.ts`; no dialog ran | measured, built-in `initialize` rows declare only `roots` |
| Sampling | unmeasured, binary grep | measured declaration `"sampling":{}`; gate `init.ts:184-185`, confirmation `sampling-handler.ts:168-177`; no request ran; D-PG9-08 | measured, built-in `initialize` rows |
| Roots | unmeasured, MCP reference and binary grep | measured declaration; root list from `server-manager.ts:1531-1533` | measured declaration; root list from `dist/extensions/mcp/runtime.js:283` |
| Output limits | unmeasured, MCP reference | unmeasured, `types.ts:538-546` | unmeasured, `dist/extensions/mcp/tools.js:31`, `docs/mcp.md:234` |

After the table: `@server:uri` (unmeasured; no handler in the adapter source, no syntax in Pi's
`docs/mcp.md`, RESEARCH A3) and the MCP Apps UI (Claude Code binary grep, unmeasured; adapter
measured in the `initialize` rows; Pi `docs/mcp.md:248`, unmeasured).

Source lines confirmed in the installed packages before citing: pi-mcp-adapter 7.0.1 `init.ts:184-185`
(sampling gate), `:349-351` (lifecycle default, no idle time for `lazy-keep-alive`), `:336` and
`:1029-1034` (10-minute idle default), `:403` (`resident`), `:471` (`exposeResources`);
`index.ts:434-435`, `:1117` (lazy-keep-alive treated like lazy for the deferred runtime);
`server-manager.ts:1511-1533`; `sampling-handler.ts:168-177`; `types.ts:538-546`, `:690-691`;
`docs/servers.md:49`, `:53`; `docs/prompts-and-ui.md:7`, `:19-21`, `:60`; `docs/configuration.md:225-226`;
`project-server-trust.ts:101`. Pi 1.5.0 `dist/extensions/mcp/tools.js:31`, `resources.js:15-18`,
`runtime.js:283`, `docs/mcp.md:234`, `:248`; no `listPrompts`/`prompts/list`/`getPrompt` in
`dist/extensions/mcp/`.

## Verification

| Check | Result |
|-------|--------|
| `SKIP=npm-check pre-commit run --files docs/mcp-compatibility.md` (Task 1) | exit 0 |
| `SKIP=npm-check pre-commit run --files docs/mcp-compatibility.md docs/output-catalog.md` (Task 2) | exit 0 |
| `catalog-contract.test.ts` and `mcp-config-notices.test.ts` | 33 tests, 33 passed |
| the other catalog-reading architecture tests (`catalog-uat/*`, `mcp-migration-notice`, `background-update-notice`, `hooks-notice-notify`, `hooks-cap-notify`) | 106 tests, 106 passed |
| Task 1 greps: `never writes \`lifecycle\`` 0; `Reason: a project decision (ANAME-05)` 0; `D-PG9-01` 3; `D-PG9-07` 2; Divergences `D-PG9-08` 1; User overrides `caFile` 2; `D-PG9-05` 1 | all met |
| Task 2 greps: heading 1; `@server:uri` 1; `unmeasured` 9; `resources.feature` 1; `D-PG9-08` 1; catalog `lazy-keep-alive` 1, `caFile` 1; table lines 8 (header, rule, 6 rows) | all met |

No red/green proof applies: this plan changes two documents and no `/claude:plugin` behavior, so
no cucumber scenario was added. `npm run check` was not run (focused checks only, per dispatch).

## Deviations from Plan

1. **[D-PG9-07 amendment] No `openUi: false` default is described as written.** The plan's
   truth 2, action 1.4 ("`openUi: false` for every server"), 1.2 (`openUi` in the project
   approval bullet), 1.5 (the `openUi` default is this extension's), and 2.3 ("this extension
   writes `openUi: false` so pi-mcp-adapter declares it to no plugin server") are all inverted
   by the amendment. The page instead says that no `openUi` default is written, that the adapter
   declares the UI extension to every plugin server (measured), and gives that divergence its
   own Loading bullet with its reason (pi-subagents 0.88.1 hash gap, BACKLOG MCPOPENUI-01), as
   09-03 and 09-06 asked. `D-PG9-07` still appears twice, so the grep criterion holds.
2. **Claude Code cells say unmeasured.** No scenario of this repository runs Claude Code, so each
   Claude Code cell says unmeasured and names the MCP reference or the binary grep, under the
   PG-MCP-08 prohibition.
3. **Prompts under the built-in is "unmeasured, source read".** RESEARCH cited the measured
   client capabilities `{"roots":{}}` for this cell, but a client capability does not show
   whether the client lists server prompts, so the cell cites the source search instead.
4. **The sampling guard sentence follows `init.ts`.** The plan's wording "without UI a request
   fails unless you set `samplingAutoApprove`" is narrower than the source: without UI and
   without auto-approve, the adapter declares no sampling at all (`init.ts:185`). The page says
   that, as CONTEXT D-PG9-08 does.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

- T-09-18 (mitigated): every cell names a scenario or a source; every cell that no scenario backs
  says unmeasured (9 hits in the section); declarations are called measured, and the page says
  that no dialog and no sampling request ran.
- T-09-19 (mitigated): the sampling row and the Loading bullet say that pi-mcp-adapter 7.0.1
  declares `sampling` to every plugin server, cite D-PG9-08, and state the per-request
  confirmation. No text says that sampling is withheld.
- T-09-SC: no package installs and no version changes.

## Parent-owned lines requested

- **REQUIREMENTS.md:** PG-MCP-08 is complete (docs section plus the two 09-01 guard scenarios).
  PG-MCP-06 and PG-MCP-09 now have their user-facing text. PG-SEC-03: the record half is complete
  (the page cites D-PG9-08 and states the per-request guard); the UI half stays open under the
  D-PG9-07 amendment, recorded on the page as a divergence with BACKLOG MCPOPENUI-01.
- **STATE.md / ROADMAP.md:** plan 09-05 complete, 2 tasks, 2 commits (`f9b36166`, `c7dfbe44`).
  Decision line: the `decisions` entry in this frontmatter.
- **09-VALIDATION.md:** the PG-MCP-08 docs row is met by `docs/mcp-compatibility.md`
  `## Features beyond tools`; no red/green row (docs only).

## Self-Check: PASSED

- FOUND: `docs/mcp-compatibility.md` holds `## Features beyond tools`.
- FOUND: `docs/output-catalog.md` holds `lazy-keep-alive` and `caFile`.
- FOUND: `f9b36166` and `c7dfbe44` are ancestors of HEAD; `git rev-list --count ad52fb5e..HEAD` is 2.
