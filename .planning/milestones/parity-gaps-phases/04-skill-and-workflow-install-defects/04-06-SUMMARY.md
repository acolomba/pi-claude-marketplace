---
phase: 04-skill-and-workflow-install-defects
plan: "06"
subsystem: orchestrators/plugin (info, discover-names), docs, upstream drafts, CHANGELOG
status: complete
tags: [workflows, agents, info, security-note, docs, changelog, PG-SEC-01, PG-CORE-01]
requirements: [PG-SEC-01, PG-CORE-01]
requirements-completed: [PG-SEC-01, PG-CORE-01]
requires:
  - "04-02: the root-source info listing in info.ts"
  - "04-04: the Naming section of docs/workflows-compatibility.md"
  - "04-05: the restriction join and features/workflow/agent-restrictions.feature"
provides:
  - "the restriction notes in the notes of every resolved info row"
  - "exported workflowAgentRestrictionNotes, RestrictionAgent and RestrictionWorkflow in discover-names.ts"
  - "the compatibility row for an agent type's tool restriction (D-PG4-14) and the root-source skills exception (D-PG4-01)"
  - ".planning/upstream/pi-dynamic-workflows-agent-tool-restriction.md, a draft that is not filed"
  - "the phase's CHANGELOG sub-bullets with the reinstall instruction (D-PG4-02)"
affects:
  - docs/workflows-compatibility.md
  - CHANGELOG.md
tech-stack:
  added: []
  patterns: ["containment before any read on the lenient info listing; a failed note read costs the note, never the row"]
key-files:
  created:
    - .planning/upstream/pi-dynamic-workflows-agent-tool-restriction.md
  modified:
    - extensions/pi-claude-marketplace/orchestrators/plugin/info.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/discover-names.ts
    - test/orchestrators/plugin/info.test.ts
    - features/workflow/agent-restrictions.feature
    - docs/workflows-compatibility.md
    - CHANGELOG.md
key-decisions:
  - "The two input interfaces of the join are exported with it, because fallow reports an exported function whose signature names a same-file private type"
  - "The info note text is the install text: the D-PG4-12 sentence has no tensed verb about the install"
decisions:
  - "D-PG4-12/13 delivered on info: one composition site, recomputed at each run, never stored"
  - "D-PG4-14 and D-PG4-15 delivered as a compatibility row and an unfiled draft"
metrics:
  duration: "~55 min"
  completed: 2026-11-14
estimate:
  tokens: 60000
  tasks: 2
actuals:
  tokens: 10892
  tasks: 2
  commits: 2
plan_head_before: c621ea717aaa7d5e70ac6b0aa109964d2fdf0a05
plan_head_after: 7749589b42a1e121ed5bf6152bd7dbc0e99934d4
---

# Phase 04 Plan 06: Restriction note in info and the phase records Summary

`/claude:plugin info` now shows the workflow agent restriction note that install and update print, from the same join. The compatibility page records the restriction gap and the root-source skills exception. The engine request is drafted for the maintainer, and the CHANGELOG tells root-source skill users to reinstall once.

## What changed

- `orchestrators/plugin/discover-names.ts`: `workflowAgentRestrictionNotes` is exported, and its doc comment names its two consumers, install/update discovery and `info`. Its body did not change. `RestrictionAgent` and `RestrictionWorkflow` are exported too (deviation 1).
- `orchestrators/plugin/info.ts`:
  - `previewWorkflows` also returns the records it discovered.
  - The new `previewAgentRestrictionNotes` returns `[]` and reads nothing when no named verdict has `agentTypes`. Otherwise it resolves each agents path with `resolveContainedComponentPath` and keeps only the accepted ones. It then reads the agents with `discoverPluginAgents`, calls the join, and maps each note through `redactAbsolutePaths`. A throw anywhere in this function is debug-logged and gives `[]`.
  - `composeResolvedComponents` returns `notes: [...workflows.warnings, ...restrictionNotes]`. This is the one site that all four row builders call. `advisoryFields` still leaves the member out when the list is empty.
  - The comments cite PG-SEC-01, D-PG4-11, D-PG4-12, D-PG4-13 and NFR-10.
- `test/orchestrators/plugin/info.test.ts`: six new owner cases on real temporary trees. Each asserts the whole output:
  - the installed row carries the note after a workflow advisory, with `in "workflows"`;
  - a script with only a bound (non-literal) `agentType` gives the same row as before, and the agent file is read 0 times (a `readFile` spy);
  - an agent named `.` makes the agent read throw, and the row stays resolved with no note;
  - an escaping `../outside` and an absolute agents path are not read: 0 reads of either agent file, and no note;
  - the available (`○ (available)`) row carries the note;
  - the partially available (`⊖ (partially-available) {lsp}`) row carries the note.
  No WR-09 case was edited.
- `features/workflow/agent-restrictions.feature`: the new scenario "Info on a plugin whose workflow runs a tool-restricted agent shows the note". The feature description now names info. No step, library, or support module changed.
- `docs/workflows-compatibility.md`:
  - a new script-contract row after the `agent({ agentType })` row, which was not edited (`is not an error on either side` still appears once);
  - the D-PG4-01 exception added to the skills clause of the "declaring the field REPLACES the convention directory" row.
  mdformat re-padded both tables.
- `.planning/upstream/pi-dynamic-workflows-agent-tool-restriction.md`: a new draft with no patch. It has `Patch:`, `Repository:` and version lines, a problem section with per-version line evidence (3.15.0 lines rechecked against the installed package: 1210, 1247, 1260, 1262, 1448), the S4 tool list, the Claude Code 2.1.323 contrast, and a draft issue with a title and a fenced body. The body makes one request. The draft has no home path and no credential.
- `CHANGELOG.md`: five sub-bullets under the first `## [Unreleased]` bullet, which now reads "Plugin agents, MCP servers, skills, and workflows now behave more like Claude Code." The version requirement moved into a second sentence. No new top-level bullet.

**Nothing was filed, posted, or sent.** The engine request exists only as the draft file. The maintainer files it.

### Info note text (same as install and update)

```text
note: workflow script "scan.js" in "workflows" runs agent type "demo:reader", which restricts its tools; the workflow engine does not keep that restriction, so the agent can use read, bash, edit, and write
```

The JSON row carries the note in `notes`. The scenario reads it as `plugin notes`. The severity stays `info`.

## Red and green evidence

All runs used Node v26.13.1 on `features/gaps`.

- **Red**, on `c621ea71` (the tree as plans 04-01 to 04-05 left it), with only the new scenario added: `npm run test:cucumber:profile -- --profile adapter features/workflow/agent-restrictions.feature` exited 1, with 3 scenarios (2 passed, 1 failed) and 38 steps (37 passed, 1 failed). `Then the result has these fields:` failed. The actual fields had no `plugin notes` row, and every other field matched.
- **Green**, after the change: the same command exited 0, with 3 scenarios passed and 38 steps passed.
- Owner tests: `node --import "$PWD/test/platform/isolated-pi-home.ts" --test test/orchestrators/plugin/info.test.ts test/orchestrators/plugin/discover-names.test.ts` ran 305 tests: 305 passed, 0 failed, 0 cancelled.
- Direct coverage: `npm run test:coverage:direct -- extensions/pi-claude-marketplace/orchestrators/plugin/info.ts extensions/pi-claude-marketplace/orchestrators/plugin/discover-names.ts` exited 0, at 100% for both sources. The catch line in `previewAgentRestrictionNotes` shows a hit in `coverage/direct.lcov`.
- `npm run fallow` exited 0 (dead-code, the cycle run, health, dupes). ESLint on the three TypeScript files and `tsc --noEmit` were clean. `npm run check:features` exited 0.
- Task 2: `SKIP=npm-check pre-commit run --files docs/workflows-compatibility.md CHANGELOG.md .planning/upstream/pi-dynamic-workflows-agent-tool-restriction.md`. On the first run, mdformat re-padded the page's tables and the run exited 1. The second run exited 0. `npm run test:cucumber:profile -- --profile adapter features/workflow/agent-restrictions.feature features/workflow/references.feature` exited 0, with 6 scenarios and 81 steps passed.
- The commit hook ran `npm run check:commit` for the build-input commit `b9611ddc` and passed. The full `npm run check` was not run: the orchestrator runs it as the wave 3 and phase gate.

## Commits

- `b9611ddc` feat(workflows): show the agent restriction note in info
- `7749589b` docs(workflows): record the agent tool restriction gap

Neither commit touches a path under `extensions/pi-claude-marketplace/persistence/`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] fallow private-type-leak on the exported join**
- **Found during:** Task 04-06-01, `npm run fallow` after adding the `export` keyword.
- **Issue:** fallow reported `workflowAgentRestrictionNotes references private type RestrictionAgent` and `... RestrictionWorkflow` (error severity). The plan said to change nothing in discover-names.ts except the keyword and the doc comment.
- **Fix:** export both interfaces as well. A probe showed that fallow reports no unused export for them. `info.ts` imports `RestrictionWorkflow` as a type for the records it passes. Two `fallow-ignore-next-line private-type-leak` markers were the alternative. They were rejected because the conventions count every marker, and an export is the plain fix. The bodies did not change.
- **Files modified:** `orchestrators/plugin/discover-names.ts`, `orchestrators/plugin/info.ts`. **Commit:** `b9611ddc`.

### Other adjustments

- **Test titles and comments use durable IDs.** The containment case is titled `NFR-10 / PG-SEC-01`, and the redaction comment cites NFR-9. The comments and titles do not use T-04-12 and T-04-13, because those are phase-scoped threat numbers.
- **Existing behavior seen, not changed:** for a refused plugin, the lenient `agents:` line still lists names from a directory outside the root (the escape case shows `agents: spy`). `discoverComponentNames` reads the directory, not the agent files. Its behavior is out of this plan's scope. The new note read is contained.
- **CHANGELOG top line:** "widen only as far as it needs" was read as naming skills and workflows. The pi-subagents and pi-mcp-adapter versions apply only to agents and MCP servers, so they moved into a second sentence.

## Parent lines (for the orchestrator)

### PROJECT.md (from 04-CONTEXT.md "Parent lines for the orchestrator", verbatim)

1. Append to the D-CF1-06 decision text (Key Decisions table, row starting `**D-CF1-06 (component-features, Phase 1, ...`), after "Skills keep the union.":

   > Exception (D-PG4-01, Claude Code 2.1.323): when a marketplace entry's `source` is a string that names the marketplace root (every `/`- or `\`-separated segment is empty or `.`) and the entry lists a non-empty `skills`, only the listed paths load; `skills/` and the manifest's `skills` paths are not read unless a listed path is `skills/` or the root.

2. Replace the "Supplemental component paths" bullet under Out of Scope (`.planning/PROJECT.md:1750`) with:

   > - **Supplemental component paths for `commands`, `agents`, and `workflows`** -- a declared path replaces the conventional folder, and install warns when an existing folder is left unread, as in Claude Code 2.1.316. A declared `skills` path still adds to `skills/` (D-CF1-06), except for a root-source marketplace entry that lists `skills`, which loads only those paths (D-PG4-01). A marketplace entry's `commands` adds to `commands/`, as the 2.1.316 binary does (D-CF3-04).

3. Add decision rows D-PG4-01 (root-source skills), D-PG4-08 (workflow references keep the source's slash state), and D-PG4-11/12 (workflow agent-restriction note, licensed by the engine capability gap; spike S4) once the phase verifies. Mark D-PG4-01, D-PG4-02, and D-PG4-12 as accepted without review until the maintainer confirms them.

Also from the earlier plans of the phase:

- D-PG4-10 (04-04): the `docs/workflows-compatibility.md` Naming correction landed with the D-PG4-08 change. Record it beside the D-PG4-08 row.
- D-PG4-07 (04-03) was implemented as a **bridge-built sibling map**. The skills bridge builds the map (source skill folder to generated name) in `prepareStageSkills` from its own discovery, as a required `siblingSkills` member of the staging context. `StageSkillsInput` gained no field, and no orchestrator (`install-outcome.ts`, `update-swap.ts`, `marketplace/shared.ts`) passes the map. Record D-PG4-07 that way.
- **Accepted without maintainer review:** D-PG4-01, D-PG4-02, and D-PG4-12 stay "accepted without review" until the maintainer confirms them.

### BACKLOG.md (residual entries)

1. **Workflow and command name collision (D-PG4-08 precedence, 04-04):** "Workflow reference rewriting: a bare `plugin:wf` reference to a workflow whose installed name equals a command of the plugin still becomes `/plugin:wf`, because `names.commands` lists the command that staging later drops for the workflow (D-PG4-08 precedence; see docs/workflows-compatibility.md Naming)."
2. **Constant-bound `agentType` gives no note (D-PG4-11 residual, 04-05):** "Workflow agent restriction note: an `agentType` passed through a binding, not a string literal, gives no note. claude-security's `scan.js` passes `claude-security:scan-loader` (`tools: Read`) and `claude-security:scan-researcher` through the minified constants `Ut` and `zt`, so those two agents get no note. An option is to follow a `const` whose initializer is a string literal."
3. **Agent-preloaded skill body keeps a dead sibling path (04-03):** "Sibling skill links: `bridges/agents/skill-preload.ts` puts a skill's source body inside an agent without the sibling path rewrite, so a `../<sibling>/` path there stays dead. `domain/skill-sibling-paths.ts` is pure, so a later fix can reuse it."
4. **Optional cleanup (04-03):** "Check whether the second `fallow-ignore-next-line code-duplication` marker in `bridges/skills/stage.ts`, and its pair in `bridges/commands/stage.ts`, still covers a clone group after the sibling rewrite. Remove both markers if they are inert (delete, run `npx fallow dupes`, restore only if a group reappears)."
5. From 04-CONTEXT.md "Deferred Ideas", when the request is filed: "Version-gate or remove the PG-SEC-01 note once a pi-dynamic-workflows release applies the agent type's tool policy to Pi's built-in tools."

### Retained flags (not resolved by this plan)

- **A1** (04-01): an entry `skills` of `""` or `null` declares nothing under the root-source rule. Upstream reads `""` as the plugin root.
- **A2** (04-01): both an absolute and an escaping listed path count as a traversal.
- **A3** (04-04): the background `workflow` call settles inside the model turn. The step does not depend on it.
- **A4** (04-05): the order of the restriction note among other workflow notes in an install diagnostic was not traced. In `info`, the note follows the workflow advisories, and the first owner case pins that order.
- **PG-SKILL-04 / unclassified edge** (04-03): unresolved, and not dismissed. The verifier reviews 04-03's list of covered edges.
- **Prohibition** (04-04, `must_haves.prohibitions`): "MUST NOT add text to a staged command, skill, or agent that tells the model the user opted in to workflows, or that counters the opt-in guidance of the workflow engine; the bridge only keeps the reference the author wrote." Its status is judgment verification. This plan adds no such text: the info note and the docs describe the tool restriction only.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced. T-04-12 is mitigated: each agents path passes `resolveContainedComponentPath` before any read. The owner case proves that neither the escaping file nor the absolute file is read, and a throw gives no note. T-04-13 is mitigated: each note passes `redactAbsolutePaths`, and the scenario and owner cases state `in "workflows"`. T-04-14 is mitigated: the draft cites package-relative paths and versions only, and nothing was filed. T-04-SC: no package was installed or changed.

## Self-Check: PASSED

- FOUND: .planning/upstream/pi-dynamic-workflows-agent-tool-restriction.md (`^Patch: ` x1)
- FOUND: `export function workflowAgentRestrictionNotes` in discover-names.ts; `workflowAgentRestrictionNotes` in info.ts
- FOUND: `plugin notes` in features/workflow/agent-restrictions.feature
- FOUND: `D-PG4-14`, `D-PG4-01`, `agent-restrictions.feature` x1 each in docs/workflows-compatibility.md; `is not an error on either side` x1
- FOUND: `anthropics/skills` in CHANGELOG.md
- FOUND: b9611ddc, 7749589b (ancestors of HEAD); `git rev-list --count c621ea71..7749589b` = 2
- PROJECT.md, BACKLOG.md, ROADMAP.md, STATE.md, REQUIREMENTS.md and 04-VALIDATION.md are unchanged by this plan
