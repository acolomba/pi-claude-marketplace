# Phase 6: Release Docs and Combined Tree - Context

**Gathered:** 2026-11-04
**Status:** Ready for planning
**Mode:** autonomous smart discuss. Every answer is the recommended one,
chosen without the user. Each choice is logged in `DUBIOUS-CHOICES.md` as
P6-DC-NN for the user's review.

<domain>
## Phase Boundary

Phase 6 runs serially in the parent session on `features/mcp-builtin`. It
starts after the last phase merge (merge commit `a25cd35`: Phases 5, 4, 2,
and 3 on top of Phase 1). It delivers:

- the release documentation for built-in MCP support (MDOC-02);
- the switch scenario that needs Phase 2's registration and Phase 3's
  `{requires mcp}` marker together (DUAL-04);
- the cleanup of closed sets and frozen exports that no phase could do alone;
- every child phase's parent lines, applied or moved to BACKLOG.md;
- the root log of dubious choices for the user's review;
- a combined-tree gate and a CI timing run.

No new MCP capability is in scope. MCPV2-01..03 stay v2.

The work inventory is `06-PARENT-LINES.md` in this directory. It copies the
`## Parent lines` section of every phase SUMMARY verbatim, plus the parent's
notes from child messages.

</domain>

<decisions>
## Implementation Decisions

### Release documentation (MDOC-02)

- **D-P6-01:** `CHANGELOG.md` gets one lead bullet under `[Unreleased]` for
  the milestone pull request, with sub-bullets, in the shape of the 0.22.0
  entry (#295). The existing "Pi 1.5.0 or newer" bullet folds into it
  (P1-DC-27). The sub-bullets come from the parent lines of Phases 1-5,
  rewritten per the `changelog` skill (simple-english Plain plus humanizer,
  40 words or fewer each). The PR number is added when the PR exists. That
  is not in this phase.
- **D-P6-02:** `README.md` and `README.es.md` change together per the `readme`
  skill. The MCP text says three things:
  - Pi's built-in MCP serves plugin MCP servers without pi-mcp-adapter.
  - To use plugin MCP servers, turn on built-in MCP or install pi-mcp-adapter.
  - When both are loaded, the adapter is the one that runs.

  It also lists what the adapter adds over built-in, taken from
  `docs/mcp-compatibility.md` (each item cites a scenario or the Pi source),
  and the three `requires` markers (D-MB-07).
- **D-P6-03:** `docs/hooks-compatibility.md` describes two things:
  - the built-in tool-name divergence. Pi folds `-` to `_` in the tool
    segment, a hook matcher sees Claude's server segment, and long names are
    cut to 55 characters plus a hash (D-MB-08, D-MB-13).
  - the proxy-call rule, which now applies only under pi-mcp-adapter.
- **D-P6-04:** Each change to `docs/output-catalog.md` or `docs/json-output.md`
  (lines 69, 3041, 3161, 3176-3188; 723, 766) lands in the same commit as the
  matching literal in `test/architecture/catalog-uat/fixtures/plugin-info.ts`.
  `npm run test:unpaired` must pass on that commit.

### Switch scenario (DUAL-04)

- **D-P6-05:** DUAL-04 extends the existing `@own-implementation` scenario "A
  plugin's server moves from pi-mcp-adapter to pi's built-in mcp and back with
  no plugin command" in `features/mcp-server/implementation-switch.feature`.
  No new scenario is added. Right after "the user restarts pi without
  pi-mcp-adapter", while built-in MCP is still off, the scenario reads the
  plugin's state through the user surface and expects `{requires mcp}`. The
  existing read steps are `/claude:plugin list` or `info`, whichever already
  shows the marker under Phase 3's rows. The scenario keeps its other steps
  and adds no plugin command between restarts. The red proof: the new row
  fails on a tree that does not emit the marker, such as `d1711fd`, which
  has no Phase 3. Record the proof in the plan SUMMARY.
- **D-P6-06:** The merge procedure's re-verifications become plan tasks:
  - the switch scenario;
  - Phase 2's `info` status scenarios under both profiles;
  - `features/hook/mcp-tool-names.feature` and `tool-use.feature` under both
    profiles (Phase 5);
  - `agent-grants.feature` under both profiles (Phase 4).

  `npm run check` already runs both profiles. These tasks record the result
  per feature file.

### Closed sets, fallow, and frozen exports

- **D-P6-07:** Six closed-set entries are candidates: `requires mcp`,
  `requires builtin mcp`, `overridden by mcp.json`, `project not trusted`,
  and the companions `mcp` and `builtin mcp`. Each one that has no emitter on
  the combined tree is removed: no production code path builds it, and no
  scenario observes it. Each removal also updates the lock counts,
  `docs/json-output.md`, and the regenerated wire schema in the same commit.
  An entry that still has an emitter stays. The plan records the emitter for
  each kept entry.
- **D-P6-08:** `.fallowrc.json` changes as follows:
  - Drop the `entry` lines for `domain/mcp-implementation.ts` and
    `orchestrators/mcp/recorded-servers.ts`, and every `ignoreExports` name
    the combined tree now consumes. That is 7 names per the 03-09 SUMMARY,
    plus `ActiveMcpImplementation` and the `features/lib/mcp-implementation.ts`
    entry (P1-DC-33).
  - For each export with still no consumer (`StoredMcpCompatibility`,
    `LegacyServers`, `LegacyServersUnreadableError`,
    `LegacyServersUnreadableReason`, and any others that `fallow dead-code`
    reports), remove the `export` or the symbol itself. Do not keep the
    ignore. Before each removal, run `fallow dead-code --trace` on it.
  - Then update the entry and suppression counts in CONVENTIONS.md,
    STACK.md, and ARCHITECTURE.md.
- **D-P6-09:** Remove `SoftDepStatus.piMcpAdapterLoaded` once no reader is
  left. If readers remain, repoint them to `mcpImplementation`, and keep the
  change behavior-neutral.

### Parent-line code changes

- **D-P6-10:** These parent lines are applied in Phase 6 as code:
  - **P4-DC-60 (High):** repoint `updateAgentImplementation` to Phase 3's
    implementation field on `ThreePhaseArgs` and `PluginConvergeTarget`. Add
    a `@builtin-only` scenario for an autoupdate or apply catalog move that
    rewrites the agent grant for built-in MCP.
  - **P3-DC-22:** `edge/register.ts` passes the run's implementation to the
    completion resolver, and `shared/completion-cache.ts` keys by it. Add a
    cucumber scenario only if a user can see the difference. Otherwise
    write a unit test, and record why the change is invisible.
  - **P2-DC-53:** `adapter-expansion-conformance.test.ts` passes the encoder,
    and the parameter becomes required.
  - **MANF-01:** `manifest-read-agreement.test.ts` lists
    `bridges/mcp/builtin-description.ts`.
  - **P2-DC-18:** move `features/lib/mcp-builtin-tool-search.ts` into
    `features/lib/upstream/`.
  - **UF-4:** redact the frozen legacy reader's debug line.
  - **UF-1:** the legacy reader re-checks `resolvedSource` against the
    owning clone root with `assertPathInside` (NFR-10).
  - **01-FROZEN.md interface 3:** fix the outdated text.
- **D-P6-11:** P2-DC-77 (the Pi 1.5.0 RPC `new_session` double `session_start`
  that leaks built-in stdio connections): the harness waits for the
  stand-ins before `assertStandInsStopped`. If the leak still fails the
  scenario under built-in, the scenario stays `@adapter-only`. In that case:
  - Add a BACKLOG entry with a drafted upstream report.
  - File nothing upstream. Filing is outward-facing and the user's call.
- **D-P6-12:** Every other parent line that is not docs or records moves to
  BACKLOG.md as one entry each, with its source ID. This covers:
  - MCPV2-01..03;
  - the deny-list re-pin to 2.1.318 (P2-DC-22);
  - the BLT-04 load-time notice;
  - ToolSearch naming;
  - `details.tool` recovery;
  - the hardening for the case where both implementations are loaded
    (P5-DC-15);
  - the matcher gaps (P5-DC-16);
  - the no-implementation hook scenario (P5-DC-24);
  - the pending and apply disagreement (P3-DC-122);
  - the two Phase 4 BACKLOG items;
  - the Phase 1 "if Phase 2/3 does not settle them" items that are still
    open on the combined tree.

### Records and logs

- **D-P6-13:** PROJECT.md changes:
  - Add Key Decisions rows for the phase decisions the children proposed:
    the Phase 3 candidates, D-P5-01..04 and D-P5-06/07, and D-MB-03/12 text
    from Phase 4.
  - Mint D-MB-14 and up for the Phase 2 licenses cited in the docs (P2-DC-90:
    P2-DC-02/04/05/08/10/13/14/20/46), and re-point the citations in
    `docs/mcp-compatibility.md`.
  - D-MB-08..13 stay `-- Pending` for the user.
  - Mark the requirements validated.

  REQUIREMENTS.md traceability rows are marked Complete for Phase 2's 11 IDs.
- **D-P6-14:** The milestone's root log of dubious choices is committed at
  `.planning/DUBIOUS-CHOICES.md`:
  - The previous milestone's file there moves with `git mv` to
    `.planning/milestones/component-features-DUBIOUS-CHOICES.md`, beside
    that milestone's other archives.
  - The new root log is built from the parent's working log, which copies
    every P1..P5 entry, the parent's own P6-PRE entries, and the P6-DC
    entries.
  - Its "Decisions waiting on you" list leads with the High items.
- **D-P6-15:** The codebase maps (`.planning/codebase/*.md`) get targeted
  edits for the new modules, entries, counts, and zones. `/gsd-map-codebase`
  is not re-run. The cucumber skill gets the notes from Phases 2 and 5: the
  config probe, the profile-aware call step exception, and the stand-in
  entries.
- **D-P6-16:** CI timing: the parent pushes the final tree and dispatches
  `ci.yml` on `features/mcp-builtin`. Executors have no GitHub tools
  (P1-DC precedent). The plan's last task writes a handoff file. The
  D-CF1-16 row is amended with the new timings. A behavioral job timeout
  changes only if a leg uses more than 80% of it.
- **D-P6-17:** The version bump and the PR are not in this phase. AGENTS.md
  says to offer the bump before creating a PR, so the parent offers it in the
  user review after the milestone close.

### Claude's Discretion

- Plan split and wave order. Docs and records can run in parallel with the
  code changes. The closed-set cleanup and fallow changes come after the code
  changes that consume exports.
- The exact CHANGELOG and README wording, within the skills.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `features/mcp-server/implementation-switch.feature`: the restart steps
  (`the user restarts pi without pi-mcp-adapter`,
  `... with pi's built-in mcp turned on`, `... with pi-mcp-adapter`).
- Phase 3's verdict rows in `features/mcp-server/verdict-*.feature` show
  how `{requires mcp}` reads through `list` and `info`.
- `test/architecture/catalog-uat/fixtures/plugin-info.ts`: the catalog byte
  contract for the docs blocks.
- `features/lib/scenario-file.ts` (`writeScenarioFile`), extracted at the
  5+4+2 merge.

### Established Patterns
- Closed sets carry lock counts in architecture tests, and the wire schema is
  regenerated in the same commit (T-01-08).
- Frozen exports are listed in `.fallowrc.json` `ignoreExports`, never with
  source markers (CONVENTIONS.md).
- Commit titles carry no milestone, phase, or plan ID. Every plan SUMMARY has
  `## Threat Flags`.

### Integration Points
- `orchestrators/plugin/update-swap.ts` and `materialize-latest.ts` (the
  update and converge runner): P4-DC-60 repoints `updateAgentImplementation`
  there.
- `edge/register.ts` and `shared/completion-cache.ts`: P3-DC-22.
- `orchestrators/mcp/recorded-servers.ts`: UF-1 and UF-4.

</code_context>

<specifics>
## Specific Ideas

- Known flakes, which a gate reruns once rather than treating as failures:
  - `lifecycle.feature:396` "A new session offers the plugin's tool again"
    under load (P3-DC-111);
  - the TUI readiness timeouts, if the `/tmp/jiti` cache is cold.
- Gates in this environment run with `NODE_OPTIONS=--max-old-space-size=6144`
  and the non-DAC script shell, because the container runs as root. Long
  gates run in the background.

</specifics>

<deferred>
## Deferred Ideas

- The version bump and PR creation (D-P6-17).
- Filing the Pi 1.5.0 RPC defect upstream (D-P6-11).
- Every item D-P6-12 moves to BACKLOG.md.

</deferred>
