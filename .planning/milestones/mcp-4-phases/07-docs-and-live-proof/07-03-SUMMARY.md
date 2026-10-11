---
phase: 07-docs-and-live-proof
plan: 03
subsystem: docs
tags: [docs, changelog, env-vars, hooks, prd, mcp, pi-mcp-adapter]

requires:
  - phase: 07-docs-and-live-proof
    provides: "07-01: the pi-mcp-adapter >=5.2.0 <6 floor that the CHANGELOG and env-vars.md name"
provides:
  - "CHANGELOG [Unreleased] opens with six grouped bullets for the milestone, with the action-needed link to docs/mcp-compatibility.md#upgrading"
  - "docs/env-vars.md states the shipped MCP variable rules (ENVDOC-01), the reserved PI_CLAUDE_MARKETPLACE_EMPTY, the exported CLAUDE_PROJECT_DIR, withheld credentials, an AI_AGENT row and the pi-mcp-adapter 5.2.0 runtime section"
  - "docs/hooks-compatibility.md scopes the MCP literal and server-prefix matcher rows to plugin tools on direct calls"
  - "The PRD names mcp-adapter.json for MCP delivery, uses the ADET-01 marker, and adds MC-9 (AVAR), MC-10 (AMIG), MC-11 (ASTAT)"
  - "ENVDOC-01 closed in .planning/BACKLOG.md"
affects: [07-05]

actuals:
  tokens: 34232
  tasks: 3
  commits: 3
plan_head_before: 2295efa0addb9135e929667119a8446d4bb7da82
plan_head_after: 1bad9ea3f9ceef4176eb577d558f5a60321bfd48

tech-stack:
  added: []
  patterns:
    - "Docs cite requirement IDs (AVAR, AMIG, ASTAT, ADET, ANAME), never a decision ID of this milestone"

key-files:
  created: []
  modified:
    - CHANGELOG.md
    - docs/env-vars.md
    - docs/hooks-compatibility.md
    - .planning/BACKLOG.md
    - docs/prd/pi-claude-marketplace-prd.md

key-decisions:
  - "CHANGELOG bullets follow D-07-10's grouping and carry no PR number yet; every [Unreleased] line from main is unchanged, and no version moved (D-07-11)"
  - "env-vars.md marks AI_AGENT with its own footnote, because Pi sets it at process start and it has no spawn-order caveat"
  - "PRD PI-11 (pi-subagents only) stays stale, as the plan scopes D-07-14 to MCP mentions"

patterns-established: []

requirements-completed: [ADOC-03, ADOC-01]

coverage:
  - id: D1
    description: "CHANGELOG [Unreleased] opens with the six grouped bullets (Pi 1.0 with pi-subagents 0.74.0, the pi-mcp-adapter 5.2.0 floor with GHSA-6qxp-vccf-f47h, mcp-adapter.json delivery with six sub-bullets, status in info, action needed with the Upgrading link, Internal) and keeps every line from main"
    requirement: "ADOC-03"
    verification:
      - kind: other
        ref: "Task 1 <verify> chains (phrases, heading, version files, 43 kept lines compared byte for byte) and acceptance criteria"
        status: pass
    human_judgment: true
    rationale: "Plain-English quality and the accuracy of the advisory wording against pi-mcp-adapter 5.2.0's own Security entry need a reader's review; the anchor #upgrading resolves only after 07-05 writes the section"
  - id: D2
    description: "docs/env-vars.md matches the shipped variable rules, hooks-compatibility.md scopes its MCP matcher rows, and ENVDOC-01 is closed"
    requirement: "ADOC-01"
    verification:
      - kind: other
        ref: "Task 2 <verify> chain and acceptance criteria (no old pass-through heading, no 'injected for project-scope installs only', 124 check marks before and after)"
        status: pass
    human_judgment: true
    rationale: "Whether the prose matches the shipped behavior and reads plainly is a review judgment; the grep chain proves only the presence of terms"
  - id: D3
    description: "The PRD describes MCP delivery through mcp-adapter.json, uses the ADET-01 marker in MU-9, PI-12, MC-8 and RH-5, keeps mcp.json for legacy entries until the migration window closes in SC-2 and NFR-10, and adds MC-9 to MC-11"
    requirement: "ADOC-01"
    verification:
      - kind: other
        ref: "Task 3 <verify> chain and acceptance criteria (2 'until the migration window closes' hits, 7.6 link text and heading match)"
        status: pass
    human_judgment: true
    rationale: "Requirement wording in the new rows is a judgment against REQUIREMENTS.md; the grep chain proves presence only"

duration: 8min
completed: 2026-10-09
status: complete
---

# Phase 7 Plan 03: CHANGELOG, env-vars, hooks and PRD for the mcp-4 delivery Summary

**The CHANGELOG `[Unreleased]` section now opens with six grouped bullets that tell an upgrading user about the Pi 1.0 floor, the pi-mcp-adapter 5.2.0 floor and advisory GHSA-6qxp-vccf-f47h, delivery into `mcp-adapter.json`, the status in info, and the four costs of the rename with a link to `docs/mcp-compatibility.md#upgrading`. `docs/env-vars.md` (ENVDOC-01), `docs/hooks-compatibility.md` and the PRD now describe the shipped MCP behavior.**

## Performance

- **Duration:** about 8 min
- **Started:** 2026-10-09T22:19:23Z
- **Completed:** 2026-10-09T22:27:21Z
- **Tasks:** 3
- **Files modified:** 5

## Accomplishments

- CHANGELOG: the earlier 5.1.0 adapter-floor bullet is replaced by six grouped bullets in the D-07-10 order. Each added line has at most 40 words. All 43 non-empty `[Unreleased]` lines from main are unchanged, the heading is still `## [Unreleased]`, and no version file changed.
- env-vars.md: mechanism S states the five-field rule, mechanism E adds `applyMcpAdapterEnv` with its skip rule, and mechanism I injects only `CLAUDE_PLUGIN_ROOT` and `CLAUDE_PLUGIN_DATA`. The matrix gains `PI_CLAUDE_MARKETPLACE_EMPTY` and `AI_AGENT` rows with a new ¶ footnote. "MCP config substitution" is the five-field table. "MCP runtime env inheritance" is re-anchored to pi-mcp-adapter 5.2.0 `resolveEnv` / `resolveCommandSecret`. The interpolation of `command`, `args`, `cwd` and `url`, the `headers` handling, and the leading `~` expansion were confirmed at the 5.2.0 call sites. The old pass-through section is replaced by "`CLAUDE_PROJECT_DIR` at user scope", plus new sections for the reserved variable, `AI_AGENT` and withheld credentials.
- hooks-compatibility.md: the two MCP matcher rows say that they match plugin MCP tools by their Claude Code names on direct calls only, and that a server you configure yourself keeps the adapter's `<server>_<tool>` names.
- PRD: §4 diagram and persistence list, MU-9, PI-12, MC-8 and RH-5, new rows MC-9, MC-10 and MC-11, the flowchart's last node, SC-2 and NFR-10, the 7.2 and 7.6 journeys (7.6 heading and table-of-contents link now read "(reload hint emitted)"), §9.1 `mcp/` subgraph, §9.2 tree and Appendix B. §8.3 and §8.4 name no `mcp.json`, so they did not change.

## Task Commits

1. **Task 1 (tracer): CHANGELOG entry** - `52b09944` (docs). Hook: npm-check skipped (no build input).
2. **Task 2: env-vars.md, hooks-compatibility.md, ENVDOC-01 closure** - `c437a541` (docs). Hook: npm-check skipped (no build input).
3. **Task 3: PRD** - `1bad9ea3` (docs). Hook: npm-check skipped (no build input).

The tracer gate re-ran Task 1's two `<verify>` chains after the commit. Both passed before the plan went on to Task 2.

## Files Created/Modified

- `CHANGELOG.md` - six grouped `[Unreleased]` bullets for the milestone
- `docs/env-vars.md` - the shipped MCP variable rules and the 5.2.0 runtime section
- `docs/hooks-compatibility.md` - MCP matcher rows scoped to plugin tools (mdformat re-padded the table)
- `.planning/BACKLOG.md` - ENVDOC-01 closed in the ENVLIT-01 form
- `docs/prd/pi-claude-marketplace-prd.md` - every MCP mention current, rows MC-9 to MC-11

## Version bump offer

Propose **0.20.0**, a minor bump, because the semver 0.x rule puts breaking changes in the minor number. Nothing was bumped in this plan (D-07-11). The offer goes to the operator before the PR. On acceptance, the PR changes these five touch points together and also adds the PR number to each new CHANGELOG bullet:

| Touch point | Current value |
| --- | --- |
| `package.json` line 110 | `"version": "0.19.2"` |
| `package-lock.json` lines 3 and 9 | `"version": "0.19.2",` |
| `extensions/pi-claude-marketplace/shared/extension-version.ts` line 14 | `export const EXTENSION_VERSION = "0.19.2";` |
| `sonar-project.properties` line 7 | `sonar.projectVersion=0.19.2` |
| `CHANGELOG.md` line 3 | `## [Unreleased]` becomes `## [0.20.0] - <date>` (format of `## [0.19.2] - 2026-09-24`) |

`npm version minor --no-git-tag-version` moves `package.json` and the lock together. `tests/architecture/extension-version-sync.test.ts` binds `EXTENSION_VERSION` to `package.json`.

## Stale non-MCP PRD rows left as they are

- **PI-11** still names the old message `pi-subagents is not loaded; install/load it and run /reload to make these agents available.` ADET-01 replaced it with the `{requires pi-subagents}` marker. The row is outside the MCP scope of D-07-14 and is left for a later docs pass.

## Decisions Made

- The CHANGELOG redirect sub-bullet keeps the same-host `http` to `https` exception in parentheses, so the bullet stays one sentence.
- The `{requires pi-mcp-adapter}` sub-bullet and the info `requires:` sub-bullet are two sub-bullets. This keeps each line under the 40-word and 25-word limits.
- env-vars.md uses a new ¶ footnote for `AI_AGENT` instead of the ‡ footnote, because ‡ carries the spawn-order caveat that `AI_AGENT` does not have.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- The first scripted edit of the MCP server-prefix row in `docs/hooks-compatibility.md` split the row at the escaped `\|` inside the Notes cell. The row was rebuilt from the committed text before any commit. The check-mark count stayed at 124.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced. The advisory text restates pi-mcp-adapter 5.2.0's own Security entry (T-07-11). The withheld-credentials section says that a stdio server still inherits Pi's process environment (T-07-12).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- The CHANGELOG link `docs/mcp-compatibility.md#upgrading` resolves once 07-05 writes the `## Upgrading` section.
- Focused task verification passed; full phase/PR verification pending.

## Self-Check: PASSED

- FOUND: CHANGELOG.md, docs/env-vars.md, docs/hooks-compatibility.md, .planning/BACKLOG.md, docs/prd/pi-claude-marketplace-prd.md
- FOUND: 52b09944, c437a541, 1bad9ea3 (ancestors of HEAD)
- Plan `<verification>`: three Conventional Commits titles with no phase, plan or decision ID; `git diff --quiet` over the four version files from the base exits 0.

---
*Phase: 07-docs-and-live-proof*
*Completed: 2026-10-09*
