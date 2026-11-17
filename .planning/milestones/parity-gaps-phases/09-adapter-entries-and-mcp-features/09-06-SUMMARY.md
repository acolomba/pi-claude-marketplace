---
phase: 09-adapter-entries-and-mcp-features
plan: "06"
subsystem: project records (MCP)
status: complete
tags: [records, changelog, upstream-draft, pi-mcp-adapter, sampling]
requires: [09-03, 09-04]
provides:
  - the drafted pi-mcp-adapter per-server sampling request, not filed
  - the CHANGELOG sub-bullet for the stdio lifecycle default and the four kept fields
  - exact parent-owned text for the three D-PG9 Key Decisions rows, the PROJECT.md update note, and BACKLOG MCPSAMPLING-01
affects: [09-05]
tech-stack:
  added: []
  patterns: []
key-files:
  created:
    - .planning/upstream/pi-mcp-adapter-per-server-sampling.md
  modified:
    - CHANGELOG.md
decisions:
  - "The CHANGELOG line follows the D-PG9-07 amendment: it says nothing about the MCP Apps UI, because no `openUi` default ships."
  - "PROJECT.md and BACKLOG.md edits are parent-owned under the dispatch rules; this plan delivers their exact text below instead of writing them."
metrics:
  duration: about 15 minutes
  completed: 2026-11-14
requirements: [PG-SEC-03, PG-MCP-06, PG-MCP-09]
actuals:
  tokens: 2600
  tasks: 3
  commits: 2
plan_head_before: b131df8e3b7b1ec9325451bb859daa216cd5ab74
plan_head_after: b564458720870c6727f15fadfc0c45bd884ae9b7
---

# Phase 9 Plan 06: Phase Records Summary

The per-server sampling request to pi-mcp-adapter is drafted and not filed, and `CHANGELOG.md`
has one sub-bullet for adapter users. The three Key Decisions rows, the `PROJECT.md` update
note, and the BACKLOG `MCPSAMPLING-01` entry are given below as exact parent-owned text,
because the dispatch rules reserve `PROJECT.md` and `BACKLOG.md` for the orchestrator.

## Commits

| Task | Commit | Title |
|------|--------|-------|
| 2 (draft half) | `3c94c645` | docs(planning): draft the pi-mcp-adapter per-server sampling request |
| 3 | `b5644587` | docs(changelog): describe the stdio lifecycle default and kept fields |

Both commits passed their hooks. `SKIP=npm-check pre-commit run --files <path>` exited 0
before each commit. The root-pin guard passed before the first edit and before each commit.
PLAN_BASE was `b131df8e`.

## The upstream draft

`.planning/upstream/pi-mcp-adapter-per-server-sampling.md`, titled "pi-mcp-adapter: no
per-server switch to withhold sampling". The draft issue is titled "Add a per-server
`sampling` field, read like `openUi`".

- The repository URL `https://github.com/nicobailon/pi-mcp-adapter` comes from the cached
  `package.json` (`git+https://github.com/nicobailon/pi-mcp-adapter.git`), version 7.0.1.
- Source lines, confirmed in the installed package: `init.ts:184-185` (the sampling gate),
  `server-manager.ts:1511-1528` (`buildClientCapabilities`; `openUi` at 1514, the manager-wide
  `sampling: {}` at 1517), `server-manager.ts:1531-1532` (`rootsFor`, a second per-server
  field), `types.ts:497`, `:501`, `:690-691`, and `sampling-handler.ts:168-177`
  (`confirmSampling`).
- Measured fact cited: the adapter `initialize` of a plugin server holds `sampling: {}`
  (09-03 SUMMARY, pi-mcp-adapter 7.0.1, Pi 1.5.0, 2026-11-14). All other source facts are
  marked as read.
- No home directory path and no credential. Nothing was filed.

## The CHANGELOG line

Added as the last sub-bullet of the parity-gaps entry under `## [Unreleased]`:

```markdown
  - Under pi-mcp-adapter, a plugin's stdio MCP server now stays running for the session once it starts, and updates keep your `protocolVersion`, `tasks`, `exposeResources`, and `caFile`. Run `/claude:plugin reinstall` once to apply this to an installed plugin.
```

36 words, two sentences (25 and 11 words), no decision ID, phase, or plan.

## Verification

| Check | Result |
|-------|--------|
| `test -f .planning/upstream/pi-mcp-adapter-per-server-sampling.md` | exit 0 |
| `grep -c 'Patch: no patch exists; this report is not filed.'` on the draft | 1 |
| `grep -c 'https://github.com/nicobailon/pi-mcp-adapter'` on the draft | 1 |
| `grep -c '^## Draft issue$'` on the draft | 1 |
| `sed -n '/^## \[Unreleased\]/,/^## \[0.23.0\]/p' CHANGELOG.md \| grep -c caFile` | 1 |
| `git diff --numstat b131df8e -- CHANGELOG.md` | `1	0	CHANGELOG.md` |
| `git diff --quiet b131df8e -- package.json package-lock.json sonar-project.properties` | exit 0 |
| pre-commit on each committed file | exit 0 |

No code changed, so no unit, integration, or cucumber run applies, and no red/green proof is
needed: this plan changes no `/claude:plugin` behavior.

## Deviations from Plan

1. **[Dispatch rule] Task 1 and the BACKLOG half of Task 2 are parent-owned.** The dispatch
   says not to touch `PROJECT.md` or `BACKLOG.md` and to list parent-owned lines. The first
   attempt to edit `PROJECT.md` was refused, so this plan wrote neither file. The exact text
   for both is below. The acceptance criteria for those two files are not met by this plan's
   commits; they are met once the orchestrator applies the text.
2. **[D-PG9-07 amendment] The D-PG9-07 row records the withheld default.** The row states the
   decision as discussed, then the amendment, the measured pi-subagents break, what ships, and
   the remaining UI-extension divergence. The plan's version described the `openUi: false`
   default as shipped.
3. **[D-PG9-07 amendment] The CHANGELOG line has no MCP Apps UI clause.** The plan asked the
   line to say "no plugin server gets the MCP Apps UI". That is false while the default is
   withheld, so it is left out.
4. **[D-PG9-07 amendment] MCPSAMPLING-01's unlocked work names the `lifecycle` default as its
   model.** The plan said "as `openUi: false` is written", which no longer ships.
5. **Draft detail.** The draft also cites `rootsFor` (`roots: false`) as a second per-server
   field that `buildClientCapabilities` already honors. It was confirmed in the installed
   source and strengthens the request.

## Parent-owned lines requested

### PROJECT.md: three Key Decisions rows

Insert after the row that starts `| **D-PG4-11/12` and before the blank line above
`## Evolution`, in this order:

```markdown
| **D-PG9-01 (parity-gaps, Phase 9, settled by upstream parity in the autonomous discussion of 2026-11-14, pending maintainer review; PRD decision 5; amends ANAME-05): stdio plugin servers stay running under pi-mcp-adapter**: The adapter entry of a stdio plugin server holds `lifecycle: "lazy-keep-alive"`. A remote server's entry holds no `lifecycle`, so the adapter's `lazy` applies (D-PG9-02). Premise: Claude Code connects a stdio plugin server at session start and keeps it for the session. Under pi-mcp-adapter 7.0.1, the default `lazy` stops an idle server after 10 minutes, so a server that holds state in memory loses it, and `lazy-keep-alive` keeps a started server for the session (read in `init.ts`). A `lifecycle` the user wrote on the entry wins. The marker's `defaultFields` records the written default, so a later restage recomputes it, and a server that changes from stdio to remote loses it (D-PG9-03). An installed plugin gets the default at its next restage: `install`, `update` to a new revision, `reinstall`, `enable`, `apply`, `import`, and the AMIG-01 move; no ordinary load rewrites `mcp-adapter.json` (D-PG9-04). Measured with pi-mcp-adapter 7.0.1 and Pi 1.5.0 on 2026-11-14: the startup connection serves the first tool call, where a `lazy` entry opened a second connection, and `info` reports the server `connected`. Read in source and not measured: a project server approved before its restage asks for approval once more. `keep-alive`, which starts every plugin server at every session start, is the deferred alternative. A "no" moves PG-MCP-06 to Out of Scope and removes the lifecycle default from the table. | See `phases/09-adapter-entries-and-mcp-features/09-CONTEXT.md`. | Pending maintainer review |
| **D-PG9-07 (parity-gaps, Phase 9, settled by upstream parity in the autonomous discussion of 2026-11-14 and amended during execution, pending maintainer review; PRD decision 20, the UI half): no `openUi` default for now**: The discussion chose to write `openUi: false` on every plugin server entry, stdio and remote, with a user's `openUi` winning. Premise: Claude Code 2.1.323 declares the client capabilities `{roots: {listChanged: true}, elicitation: {}}` and adds the MCP Apps UI extension only when `CLAUDE_CODE_MCP_APPS_HOST` is set, which the CLI does not set (binary grep). pi-mcp-adapter 7.0.1 declares the extension to every server unless its entry holds `openUi: false` (`server-manager.ts` `buildClientCapabilities`, read in source). Amended during execution: the default is withheld. pi-subagents 0.88.1's `computeMcpServerHash` copies pi-mcp-adapter 7.0.1's `computeServerHash` without `openUi`, so an entry with `openUi: false` makes pi-subagents read the adapter's tool cache as stale, and an agent with a plugin MCP grant does not launch (D-CF6-10). `test/integration/pi-subagents-child-identity.test.ts` measured this: it failed with the default and passed without it. What ships: a user's `openUi` is carried and survives an update (measured by scenario), and no default is written. The measured adapter `initialize` (pi-mcp-adapter 7.0.1, Pi 1.5.0, 2026-11-14) still declares the UI extension to plugin servers, a divergence from a Claude Code CLI session that a Pi-companion capability gap in pi-subagents licenses. The default comes back once the pi-subagents floor hashes `openUi`; filing that request is the maintainer's call. | See `phases/09-adapter-entries-and-mcp-features/09-CONTEXT.md`. | Pending maintainer review |
| **D-PG9-08 (parity-gaps, Phase 9, settled by upstream parity in the autonomous discussion of 2026-11-14, pending maintainer review; PRD decision 20, the sampling half): record the sampling divergence**: Write nothing for `sampling`. Premise: Claude Code 2.1.323 declares no `sampling` capability (the same capability object, binary grep). pi-mcp-adapter 7.0.1 has no per-server sampling field: one global `settings.sampling`, on by default when UI approval is available, governs every server, the user's own included (`init.ts`, `docs/configuration.md`, read in source). This project does not own the user's `settings`, so writing `settings.sampling: false` would remove a power from servers it did not install. The measured adapter `initialize` of a plugin server holds `sampling: {}` (pi-mcp-adapter 7.0.1, Pi 1.5.0, 2026-11-14). The divergence is licensed by a pi-mcp-adapter capability gap. The adapter's own guard, read in `init.ts` and `sampling-handler.ts` and not measured: in a UI session each sampling request asks the user to confirm, and in a session without UI sampling is off unless the user set `samplingAutoApprove`. The request for a per-server switch is drafted in `.planning/upstream/pi-mcp-adapter-per-server-sampling.md`, not filed, and BACKLOG MCPSAMPLING-01 waits for a release that has the switch. | See `phases/09-adapter-entries-and-mcp-features/09-CONTEXT.md`. | Pending maintainer review |
```

If the orchestrator adds the BACKLOG entry for the withheld `openUi` default (below), append
its ID to the last sentence of the D-PG9-07 row, for example "... is the maintainer's call;
BACKLOG <ID>."

### PROJECT.md: the update note

Append as the new last line of the file, after a blank line:

```markdown
_Last updated: 2026-11-14 during parity-gaps Phase 9; Key Decisions gains D-PG9-01, D-PG9-07, and D-PG9-08, each pending maintainer review, with D-PG9-01 amending ANAME-05._
```

Neither the archived `mcp-4-REQUIREMENTS.md` nor the Validated bullet that names ANAME-01..07
changes (RESEARCH open question 1, the D-PG1-11 precedent). D-PG9-12 also asks to append
"Amended by D-PG9-01" to the ANAME-05 text; no ANAME-05 text exists in `PROJECT.md`, so the
row title carries it.

### BACKLOG.md: MCPSAMPLING-01

Append to the end of the file, after a blank line:

```markdown
## MCPSAMPLING-01: withhold sampling from plugin servers once pi-mcp-adapter has a per-server switch

Noted 2026-11-14 (parity-gaps, Phase 9, D-PG9-08). Trigger: a published pi-mcp-adapter release with a per-server sampling switch. The request is drafted in `.planning/upstream/pi-mcp-adapter-per-server-sampling.md`, and the maintainer has not filed it yet. Under 7.0.1 every plugin server gets `sampling: {}` whenever the global `settings.sampling` allows it. The work it unlocks: raise or gate the pi-mcp-adapter floor on that release, write the switch on every plugin entry as a recorded default, as the stdio `lifecycle` default is written, and drop the sampling divergence from `docs/mcp-compatibility.md`.
```

### BACKLOG.md: the withheld `openUi` default (carried from 09-03)

09-03 asked for this entry and `09-CONTEXT.md`'s D-PG9-07 amendment says BACKLOG tracks it,
but `BACKLOG.md` holds no such entry at `b5644587`. Suggested text:

```markdown
## MCPOPENUI-01: write the `openUi: false` default once pi-subagents hashes `openUi`

Noted 2026-11-14 (parity-gaps, Phase 9, D-PG9-07 amendment). Trigger: a pi-subagents release whose `computeMcpServerHash` includes `openUi`, as pi-mcp-adapter 7.0.1's `computeServerHash` does, and a floor raised to it. pi-subagents 0.88.1 omits it, so an entry with `openUi: false` makes background MCP grants fail (`test/integration/pi-subagents-child-identity.test.ts`). The upstream request is the maintainer's to file. The work it unlocks: write `openUi: false` on every plugin entry as a recorded default and drop the UI-extension divergence from `docs/mcp-compatibility.md`.
```

### Other parent-owned lines

- **REQUIREMENTS.md:** PG-MCP-06 now has its decision recorded once the D-PG9-01 row lands.
  PG-MCP-09 has its CHANGELOG line. PG-SEC-03: the sampling divergence has its upstream
  draft; the decision rows and BACKLOG entry are pending the parent edits above, and the page
  citation is 09-05.
- **STATE.md / ROADMAP.md:** plan 09-06 complete, 3 tasks, 2 commits. Decision lines: the two
  `decisions` entries in this frontmatter.
- **09-05 (compatibility page):** the UI-extension divergence row (D-PG9-07 amendment) beside
  the D-PG9-08 sampling row, as 09-03 asked; the sampling row can cite the draft path.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

- T-09-20 (mitigated): every row text above says pending maintainer review in its first cell
  and its outcome, and says which facts were measured and which were read.
- T-09-21 (mitigated): `git diff --numstat b131df8e` shows added lines only (38 added, 0
  removed); `PROJECT.md` and `BACKLOG.md` are untouched.
- T-09-22 (mitigated): the draft cites package-relative paths and the repository URL from the
  cached `package.json` only; nothing was filed.
- T-09-SC: no package installs and no version changes.

## Self-Check: PASSED

- FOUND: `.planning/upstream/pi-mcp-adapter-per-server-sampling.md`
- FOUND: `CHANGELOG.md` sub-bullet with `caFile`
- FOUND: commit `3c94c645` in HEAD's history
- FOUND: commit `b5644587` in HEAD's history
