# Roadmap: pi-claude-marketplace

## Milestones

- **mcp-builtin** MCP Built-in — in progress on branch `features/mcp-builtin`, started 2026-11-04; 6 phases, 31 requirements.
- ✅ **component-features** Component Behavioral Tests — completed 2026-11-03 on branch `claude/quirky-planck-hhm592` (first closed 2026-11-02, reopened for the user's decisions; PR [#295](https://github.com/acolomba/pi-claude-marketplace/pull/295), no npm release yet); 8 phases, 65 plans, 62/62 requirements. [Archive](milestones/component-features-ROADMAP.md), [requirements](milestones/component-features-REQUIREMENTS.md), [audit](milestones/component-features-MILESTONE-AUDIT.md).
- ✅ **plugin-lifecycle** Marketplace and Plugin Lifecycle Backlog — completed 2026-10-29 on branch `features/plugin-lifecycle-p11` in PR #290 (not yet merged, no npm release); 11 phases, 80 plans, 64/64 requirements. [Archive](milestones/plugin-lifecycle-ROADMAP.md), [requirements](milestones/plugin-lifecycle-REQUIREMENTS.md), [audit](milestones/plugin-lifecycle-MILESTONE-AUDIT.md).
- ✅ **lifecycle-coverage** Plugin Lifecycle Behavioral Tests — completed 2026-10-25 on branch `claude/plugin-lifecycle-coverage-b1d431` (not yet pushed); 30 phases, 76 plans, 104/104 requirements. [Archive](milestones/lifecycle-coverage-ROADMAP.md), [requirements](milestones/lifecycle-coverage-REQUIREMENTS.md), [audit](milestones/lifecycle-coverage-MILESTONE-AUDIT.md).
- ✅ **marketplace-features** Marketplace Behavioral Tests — completed 2026-10-21 on branch `features/cucumber-behavioral-tests` (PR #271, merged 2026-10-22, not yet released); 14 phases, 82 plans, 97/97 requirements. [Archive](milestones/marketplace-features-ROADMAP.md), [requirements](milestones/marketplace-features-REQUIREMENTS.md), [audit](milestones/marketplace-features-MILESTONE-AUDIT.md).
- ✅ **json-output** Mode-Keyed Presentation Strategies — completed 2026-10-11, merged to main 2026-10-11 (PR #251, squash `0e45ffd9`), not yet released; 9 phases, 50 plans, 36/36 requirements. [Archive](milestones/json-output-ROADMAP.md), [requirements](milestones/json-output-REQUIREMENTS.md), [audit](milestones/json-output-MILESTONE-AUDIT.md).
- ✅ **mcp-4** MCP 4 — completed 2026-10-10, merged to main 2026-10-10 (PR #250, squash `94160614`), released as 0.20.0; 8 phases, 73 plans, 41/41 requirements. [Archive](milestones/mcp-4-ROADMAP.md), [requirements](milestones/mcp-4-REQUIREMENTS.md), [audit](milestones/mcp-4-MILESTONE-AUDIT.md).
- ✅ **any-git-host** — completed 2026-09-30, merged to main 2026-09-30 (PR #221). [Archive](milestones/ws-git-hosts-2026-10-01/milestones/any-git-host-ROADMAP.md).
- ✅ **v1.20 transitive-dependencies** — completed 2026-09-24, merged to main 2026-10-01 (PR #198); 12 phases, 55 plans, 45/45 requirements. [Archive](milestones/v1.20-ROADMAP.md), [requirements](milestones/v1.20-REQUIREMENTS.md), [audit](milestones/v1.20-MILESTONE-AUDIT.md).
- ✅ **workflows-replay** — completed 2026-09-21, merged to main 2026-09-24 (PR #205). [Archive](milestones/ws-workflows-2026-09-27/milestones/workflows-replay-ROADMAP.md).
- ✅ **test-backlog** — completed 2026-09-18. [Archive](milestones/test-backlog-ROADMAP.md).
- ✅ **refine-unit-tests** — completed 2026-09-13. [Archive](milestones/refine-unit-tests-ROADMAP.md).
- ✅ **v1.19 Unit Test Refactor** — completed 2026-09-04. [Archive](milestones/v1.19-ROADMAP.md).

Earlier milestones remain in [MILESTONES.md](MILESTONES.md).

## Phases

<details>
<summary>✅ component-features — Component Behavioral Tests — SHIPPED 2026-11-03</summary>

- [x] Phase 1: Harness and Version Raise (15/15 plans) — completed 2026-11-01
- [x] Phase 2: Skills (7/7 plans) — completed 2026-11-02
- [x] Phase 3: Slash Commands (9/9 plans) — completed 2026-11-01
- [x] Phase 4: Agents (6/6 plans) — completed 2026-11-01
- [x] Phase 5: Hooks (9/9 plans) — completed 2026-11-01
- [x] Phase 6: MCP Servers (9/9 plans) — completed 2026-11-02
- [x] Phase 7: Workflows (6/6 plans) — completed 2026-11-01
- [x] Phase 8: Locality and Upstream Alignment (4/4 plans, retroactive) — completed 2026-11-03

**Outcome:** 62/62 requirements, 8/8 phases, 6/6 integration seams, and 5/5 end-to-end flows pass; 1539 cucumber scenarios. The audit has no blockers. MCP-07 stays an accepted deviation (MCPBG-01); W2 and W4 are guarded non-defects; T-05-33 is fixed and T-05-34 accepted under D-LOC-01, which replaced the D-CF2-13..16 and D-CF3-07 provenance ledger.

</details>

<details>
<summary>✅ plugin-lifecycle — Marketplace and Plugin Lifecycle Backlog — SHIPPED 2026-10-29</summary>

- [x] Phase 1: Staging Warning Channels (8/8 plans)
- [x] Phase 2: Apply Ordering and Installed Declarations (6/6 plans)
- [x] Phase 3: Dependency Cascade Rows and Status (6/6 plans)
- [x] Phase 4: Dependency Resolver Residue (6/6 plans)
- [x] Phase 5: Marketplace Command Parity (9/9 plans)
- [x] Phase 6: Import Marketplace Planning (6/6 plans)
- [x] Phase 7: Git Errors and Lock Discipline (10/10 plans)
- [x] Phase 8: Background Autoupdate (4/4 plans)
- [x] Phase 9: Plugin Package Dependencies (5/5 plans)
- [x] Phase 10: Lifecycle Test and Harness Gaps (7/7 plans)
- [x] Phase 11: Cleanup, Split, and Docs (13/13 plans)

**Outcome:** 64/64 requirements, 11/11 phases, 12/12 integration groups, and 10/10 end-to-end flows pass. The audit has no blockers and carries only the accepted HOSTED-DNS-01 residual under D-PL5-31.

</details>

### In progress mcp-builtin -- MCP Built-in

**Milestone goal:** A plugin's MCP servers run through pi-mcp-adapter when it
is installed and through Pi's built-in MCP when it is not. The two are equal
implementations, and a switch between them never needs action from the user.

Inputs: the user's brief (`.planning/inputs/mcp-builtin/BRIEF.md`, with its
amendment), `.planning/REQUIREMENTS.md` (31 requirements, D-MB-01..07), and the
research in `.planning/research/` (`SUMMARY.md`, `ARCHITECTURE.md`). The
settings-cleanup phase the research once proposed is dropped: the extension
never edits Pi settings (D-MB-01).

#### Parallelism

Phase 1 is the only prerequisite. It runs serially in the parent session on
the milestone branch `features/mcp-builtin`, and inside it the GSD executors
run each wave's plans in parallel worktrees. Phase 1 freezes every shared file
and every cross-phase interface (see below), so the parallel phases never edit
a common file.

When Phase 1 is verified and pushed, the parent creates
`features/mcp-builtin-phase-2`, `-phase-3`, `-phase-4`, and `-phase-5` at the
milestone head and pushes them. Phases 2, 3, 4, and 5 then run concurrently:
one child session per phase, each in its own git worktree on its own branch
`features/mcp-builtin-phase-N`. The parent starts Phase 3 first, because it is
the critical path and merges last. Each child session reads
`.planning/CHILD-SESSION-BRIEF.md`.

- Each child session is **authorized to push its own branch** to GitHub:
  `git push -u origin features/mcp-builtin-phase-N`. It never pushes `main`,
  another phase's branch, or the milestone branch `features/mcp-builtin`, and
  it opens no pull request.
- The parent merges each finished phase branch into `features/mcp-builtin`
  with a merge commit (never a rebase) and pushes the milestone branch.
- A child that needs a sibling's merged work merges `origin/features/mcp-builtin`
  into its own branch. It never rebases and never merges a sibling's phase
  branch directly.
- Phase 6 runs serially in the parent session on `features/mcp-builtin` after
  the last merge.

```text
W0  Phase 1         Foundation and Pi 1.5.0   parent session, features/mcp-builtin; parallel executors per wave
W1  Phases 2 3 4 5  four child sessions       one worktree and branch features/mcp-builtin-phase-N each; Phase 3 starts first
W2  merges 5 4 2 3, then Phase 6              parent session, features/mcp-builtin
```

**Why four parallel phases.**

- Phases 2-5 own disjoint files (the ownership table below), so four child
  sessions run at once with no shared file. Phase 1's first wave adds up to
  four parallel executors before the fan-out.
- Phase 3 is not split. Its five requirements share one rule (the effective
  state is the neutral stored state joined with the active profile) and land
  on the same output rows: one install, list, or info row shows the state,
  the marker, and the reason together. Two sessions would edit the same
  scenario rows and `orchestrators/plugin/info.ts`.
- Phase 2 is not split. Translation, trust, status, lifecycle, and the switch
  all need its registration path before any scenario can pass, so they are
  waves inside one session.
- The built-in status reader moves from the research's Phase 3 to Phase 2.
  Its scenarios need registered servers, and its `overridden by mcp.json`
  status is the report BLT-04 asks for. Phase 1 wires the status call in
  `info.ts`, so Phase 2 never edits that file, and Phase 3, the critical
  path, gets shorter.
- Phase 5 is small but keeps its own session. If the session budget is tight,
  it can run in Phase 4's session after Phase 4, still on its own branch.
- No phase is added for the switch scenario: Phase 2 owns
  `implementation-switch.feature`, and Phase 1's harness gives it the restart
  steps it needs. Phase 6 exists only because no child may edit the
  CHANGELOG, the READMEs, or a closed-set entry it did not add, so no parallel
  phase can own MDOC-02.

**Built-in servers in Phases 4 and 5.** Their built-in-profile scenarios need
a plugin MCP tool that built-in serves. Phase 1's harness serves the stub
through built-in without the extension (a stand-in server, for example an
entry in the sandbox's Pi MCP configuration), so these phases do not wait for
Phase 2. A scenario that truly needs the extension's own registration is
finished after Phase 2 merges: the child merges the milestone branch, and that
phase then merges after Phase 2. After Phase 2 merges, the parent re-runs the
Phase 4 and Phase 5 built-in scenarios.

Inside a phase, plans in one wave own disjoint files, so the executor runs
them in parallel. A step that two plans of one wave both need moves to an
earlier wave. Iterate with `npx cucumber-js` on the owned feature files under
one profile, and run `npm run check` only at gates.

#### File ownership

Product paths are relative to `extensions/pi-claude-marketplace/`, step module
paths to `features/step_definitions/`, and lib paths to `features/lib/`. Each
phase owns the unit pair (`test/<same path>.test.ts`) of every product file it
owns. A new file takes its phase's name prefix, so two phases never create the
same file.

**Frozen after Phase 1** (no later phase edits these; a change one needs is a
parent line, applied at merge or in Phase 6):

- Build and CI: `package.json`, `package-lock.json`,
  `.github/workflows/ci.yml`, `cucumber.json`, `scripts/check-features.mjs`,
  `scripts/install-test-peers.mjs`, `.fallowrc.json`,
  `rule-packs/architecture.json`, `eslint.config.js`.
- Harness: `test/e2e/_rpc.ts`, `features/support/**`,
  `{pi-process,pi-commands,companions,run-tokens,published-marketplace,mcp-stub-server,mcp-server-files,mcp-configuration}.ts`,
  `scripted-model/**`, `pi-registry-probe/**`, `hook-recorder.ts`; the shared
  step modules (`command`, `session`, `config`, `companion`, `model`,
  `mcp-configuration`, `plugin/publishing`, `marketplace/publishing`,
  `mcp-server/listing`, `mcp-server/status`, and the new shared "MCP
  implementation" module); `.agents/skills/cucumber/**`; the architecture
  tests Phase 1 adds (the profile-tag rule, the factory-time probe ban).
- Product: `platform/pi-api.ts`, `domain/mcp-implementation.ts`,
  `domain/mcp-server-features.ts`, `domain/mcp-builtin-features.ts`, the MCP
  functions in `domain/name.ts`, `persistence/state-io.ts`,
  `orchestrators/mcp/session-materialize.ts`,
  `orchestrators/mcp/recorded-servers.ts`, `index.ts`, `edge/register.ts`,
  `edge/types.ts`, `edge/handlers/plugin/info.ts`.
- Closed sets, frozen except for append-only additions:
  `shared/notification-types.ts`, `shared/notification-wire.ts`, the reason
  table in `shared/notify-reasons.ts`,
  `test/architecture/notify-closed-set-locks.test.ts`, `docs/json-output.md`,
  and the catalog counters (`docs/output-catalog.md`, `EXPECTED_STATE_COUNT`,
  `EXPECTED_UTF8_BYTES`).

| Phase | Owns (product) | Owns (tests and features) | Must not touch |
| --- | --- | --- | --- |
| 1 (serial) | Everything frozen above; the record producer (`declaredMcpServers` in `domain/{mcp-resolution,plugin-resolver,resolver-types}.ts`, `statePhase` in `orchestrators/plugin/install-outcome.ts`, the record write in `update-swap.ts`); the step seeds `orchestrators/mcp/{builtin-registration-step,agent-grants-step}.ts`; the seed `platform/mcp-builtin-status.ts`; the status call in `orchestrators/plugin/info.ts`; `.planning/PROJECT.md`; the Pi version lines in the READMEs, docs, `AGENTS.md`, `STACK.md`, and `CHANGELOG.md` | their unit pairs; the floor tests; `features/mcp-server/agent-grants.feature` (the MCP-07 split); the `@adapter-only` tags; moving every row whose MCP marker or state depends on the active implementation into a Phase 3 file | none (runs alone) |
| 2 Built-in materialization | NEW `domain/mcp-builtin-translation.ts`; `bridges/mcp/**` (NEW `builtin-{entry,escape,registration}.ts`, the `substitute.ts` encoder parameter; the adapter files keep writing `mcp-adapter.json`); `orchestrators/mcp/builtin-registration-step.ts`; `orchestrators/plugin/info-mcp-status.ts`; `platform/mcp-builtin-status.ts`; `platform/mcp-status.ts` (its `McpStatusReader` interface stays frozen); `docs/mcp-compatibility.md` | NEW `test/integration/mcp-builtin-*`; `features/mcp-server/{listing,configuration,sources,project-scope,lifecycle,invocation}.feature`; NEW `features/mcp-server/{implementation-switch,builtin-*}.feature`; `mcp-server/{configuration,sources,lifecycle,invocation}` and NEW `mcp-server/{implementation-switch,builtin-*}` step modules; `mcp-server-{http,environment}.ts`; NEW `mcp-builtin-*.ts` libs | the resolver and verdict readers (Phase 3), `orchestrators/plugin/info.ts`, `bridges/agents/**`, `bridges/hooks/**`, frozen files |
| 3 Read-time verdicts | `domain/{mcp-resolution,plugin-resolver,resolver-types}.ts` (state and verdicts; the producer and the entry points `recorded-servers.ts` calls stay as Phase 1 left them); `orchestrators/plugin/info.ts` (all but the status call); `list-installed-row.ts`; `plugin-state-classifier.ts`; `update-preflight.ts`; the consent gate function in `install-outcome.ts`; the `partial` functions in `enable-disable.ts`, `install-cascade.ts`, `install-flow-results.ts`, `update-swap.ts`, and `orchestrators/import/execute.ts`; every other site that emits the MCP soft-dependency marker (own function each); `shared/concerns/soft-dep.ts` (MCP arm); `companionSeverity` and the MCP wording in `shared/notify-reasons.ts`; `orchestrators/reconcile/{convergence,mcp-migration}.ts`; `docs/messaging-style-guide.md` (marker text) | their unit pairs; the marker and state assertions in existing `test/integration/mcp-*` tests; NEW `test/integration/mcp-verdict-*`; the e2e marker tests (`adapter-detection-rpc`, `install-soft-deps`); `features/mcp-server/{companion-missing,invalid-configs}.feature`; NEW `features/mcp-server/verdict-*.feature`; `mcp-server/invalid-configs` and NEW `mcp-server/verdict-*` step modules; NEW `mcp-verdict-*.ts` libs; the MCP marker and state rows in `features/plugin/*.feature` and `features/marketplace/update.feature` | `bridges/**`, `orchestrators/mcp/**`, `info-mcp-status.ts`, `platform/mcp-*status.ts`, frozen files |
| 4 Agent grants | `bridges/agents/**`; `persistence/agents-index-{schema,io}.ts`; `orchestrators/mcp/agent-grants-step.ts`; `agentsPhase` in `install-outcome.ts`; the agent staging function in `update-swap.ts` | their unit pairs; `test/integration/agents-*`; `features/mcp-server/agent-grants.feature`; `features/agent/**`; NEW `mcp-server/agent-grants` step module; `agent-files.ts`; NEW `mcp-agent-*.ts` libs | `bridges/mcp/**`, `bridges/hooks/**`, the verdict readers, frozen files |
| 5 Hook tool names | `bridges/hooks/**`; `domain/components/hooks/**`; `docs/hooks-compatibility.md` | their unit pairs; `test/integration/hooks-*`; `features/hook/**` (NEW `mcp-tool-names.feature`); `hook/**` step modules; `hook-files.ts` | every MCP file outside hooks, frozen files |
| 6 (serial) | `CHANGELOG.md`, `README.md`, `README.es.md`, `.planning/PROJECT.md`, `.planning/BACKLOG.md`, closed-set removals, the root `.planning/DUBIOUS-CHOICES.md`, CI timeouts if the combined run needs more | any file a combined-tree fix needs | none (runs alone after the last merge) |

Shared by function: `orchestrators/plugin/install-outcome.ts` (Phase 1
`statePhase` before the fan-out, Phase 3 the consent gate, Phase 4
`agentsPhase`) and `orchestrators/plugin/update-swap.ts` (Phase 1 the record
write, Phase 3 the `partial` functions, Phase 4 the agent staging). In a shared
test file, a phase changes only the cases for its own function. An existing
integration test belongs to the phase whose behavior it pins; if it pins both
Phase 2's materialization and Phase 3's marker or state, Phase 3 changes the
marker and state assertions and Phase 2 adds its cases in a new
`test/integration/mcp-builtin-*` file.

#### Frozen cross-phase interfaces

Every parallel phase codes against these. Phase 1 creates them; no later phase
changes their names or shapes.

1. `domain/mcp-implementation.ts`: `McpImplementationId = "adapter" | "builtin"`,
   `ActiveMcpImplementation = McpImplementationId | "none"`,
   `McpImplementationProfile { id; classify(config); serverName(plugin, server); toolNamePrefix(plugin, server); grantSelector(plugin, server) }`,
   `profileFor(id)`, and the pure
   `effectiveMcpCompatibility(stored, recorded, active) -> { installable, unsupported, blocked }`,
   which also reads a legacy stored compatibility that carries the adapter
   verdict. Malformed is one Claude-shape check for both profiles; blocked is
   per profile (built-in adds `sse`).
2. `SoftDepStatus.mcpImplementation: ActiveMcpImplementation` in the D-05 run
   snapshot, with the precedence adapter, then built-in, then none;
   `piMcpAdapterLoaded` stays as `mcpImplementation === "adapter"`;
   `hasLoadedBuiltinMcp` reads an `mcp` command whose source path is
   `builtin:mcp`. Nothing probes before `session_start`.
3. The record field `mcpServerConfigs?: ReadonlyArray<{ readonly name: string; readonly config: unknown }>`:
   every declared, non-malformed server in D-CF6-01 merge order, verbatim
   Claude JSON before plugin-variable substitution (D-MB-04); absent means the
   record predates the field, never "no servers". It is read only through
   `recordedMcpServers(record, reader)` in
   `orchestrators/mcp/recorded-servers.ts`, whose legacy fallback re-resolves
   read-only from `record.resolvedSource`.
4. `resolved.declaredMcpServers: Record<string, unknown>` (all non-malformed
   servers, merge order). `resolved.mcpServers` stays the adapter-supported
   subset that the mcp phase stages into `mcp-adapter.json` under every
   implementation (MSEL-04).
5. Step contracts in `orchestrators/mcp/`: `builtinRegistrationStep({ pi, ctx, snapshot })`,
   `resyncBuiltinRegistrations(...)`, and `agentGrantsStep({ ctx, snapshot })`,
   each returning `Promise<void>` and never throwing. `session-materialize.ts`
   calls them in a fixed order at `session_start`, and `index.ts` runs the
   resync again after `loadReconcile`.
6. `PiMcpRegistry { registerMcpServer; unregisterMcpServer; getMcpServers }`,
   `McpServerConfig`, and `RegisteredMcpServer` in `platform/pi-api.ts`;
   `McpStatusReader.lookup(serverName)`.
7. `EdgeDeps.mcpStatus: { adapter: McpStatusReader; builtin: McpStatusReader }`
   and the status call in `info.ts`, which picks the reader by
   `run.softDeps.mcpImplementation`. Phase 1 freezes the call; Phase 2 owns
   the body of `withMcpServerStatus`.
8. `builtinMcpServerName(plugin, server)` in `domain/name.ts`:
   `plugin_<plugin>_<server>`, no trailing `_`, with Pi's long-name rule.
9. Cucumber: the profiles `adapter` and `builtin`, the world parameter
   `mcpImplementation`, the tags `@mcp`, `@adapter-only`, `@builtin-only`, and
   the tag for scenarios that choose their own implementation (`none`, the
   switch), the "MCP implementation" step wording, the restart steps (adapter
   added, adapter removed, no MCP via `--no-mcp`), and the built-in stand-in
   server step.
10. Closed set: the reasons `requires mcp` and `requires builtin mcp`
    (D-MB-07; `requires pi-mcp-adapter` stays) and the built-in status tokens
    BLT-05 names that do not exist yet (`overridden by mcp.json`,
    `project not trusted`).

#### Milestone rules

- **Upstream parity.** Every expected behavior is Claude Code's (binary
  2.1.318 and the code.claude.com docs) unless a recorded decision with an ID
  or a Pi capability gap licenses a divergence. Research the upstream contract
  with `claude-code-compat-research`.
- **Bug policy.** A scenario that exposes a product bug fixes it in the same
  phase when the fix is in owned files. A fix in a frozen or sibling-owned
  file is a parent line and a dubious choice, never a direct edit.
- **Never edited by a child phase:** `CHANGELOG.md`, `README.md`,
  `README.es.md`, `.planning/PROJECT.md` Key Decisions, `.planning/BACKLOG.md`,
  and the frozen files. Each phase lists its lines for those files under
  "Parent lines" in its last plan's SUMMARY.md, and the parent applies them at
  merge or in Phase 6. ROADMAP.md, STATE.md, REQUIREMENTS.md, and WINDOWS.md are
  tool-written; prefix every WINDOWS description with `[mcp-builtin]`.
- **Append-only closed sets.** Prefer an existing reason or token. A new one
  lands as its own commit, and the later merge keeps both entries and fixes
  the counts. Removing or rewording an entry is a parent line for Phase 6.
- **Own function only.** In a file shared by function (`install-outcome.ts`,
  `update-swap.ts`, `soft-dep.ts`, `notify-reasons.ts`) a phase edits only its
  own function or arm.
- **State rows.** A scenario in a Phase 2, 4, or 5 file pins connection,
  naming, grants, or hook runs, never a plugin state, marker, or per-server
  verdict that depends on the active implementation. Those rows live in Phase
  3 files.
- **Behavioral tests.** Every user-visible change ships a cucumber scenario
  that fails without it, under each profile where it applies, with the red
  proof recorded per profile. A scenario whose expectation differs by
  implementation is an `@adapter-only` and `@builtin-only` pair in the same
  file. Scenarios observe what Pi or a companion reports, never the files the
  bridge wrote. Each phase removes the `@adapter-only` tags Phase 1 placed on
  its own files.
- **Gates.** Every wave gate and phase gate runs `npm run check` plus both
  cucumber profiles; the phase gate also runs the whole `npm run test:modules`.
- **Commit titles** carry no milestone, phase, plan, wave, or task identifier.
- **Dubious choices** are logged per phase in
  `.planning/phases/<dir>/DUBIOUS-CHOICES.md` (`P{N}-DC-NN`). Only the parent
  writes the root log.
- **Threat flags.** Every plan SUMMARY.md has a `## Threat Flags` section.
- **Reviewed clone pairs.** The built-in and adapter entry and escape modules
  are likely clone pairs; a reviewed pair carries a
  `fallow-ignore-next-line code-duplication` marker in both copies.
- **Out of scope (v2).** MCPV2-01 (immediate register and unregister),
  MCPV2-02 (deny rules to `toolExposure: "hidden"`), MCPV2-03 (background
  agents calling plugin MCP tools under built-in).

#### Merge procedure

- The parent merges each phase branch into `features/mcp-builtin` with a merge
  commit, never a rebase, and pushes the milestone branch. At each merge it
  applies that phase's parent lines.
- Merge order, lowest conflict first: **Phase 5** (hooks only), **Phase 4**
  (agents), **Phase 2** (built-in materialization), then **Phase 3** (read-time
  verdicts) last. Phase 3 touches the most shared orchestrator files and the
  rows that other phases' scenarios sit next to.
- Post-merge gate after every merge: `npm run check` plus both cucumber
  profiles on the combined tree. Re-verify a phase after any later merge that
  touches its files.
- After Phase 2 merges: rerun `npx fallow dupes` (the built-in and adapter
  entry and escape modules), and re-run the Phase 4 and Phase 5 built-in
  scenarios, since the extension's registration now serves the same tools as
  the stand-in.
- Before its own gate, Phase 3 merges the milestone branch (Phases 5, 4, and
  2) into its branch and re-runs every row it owns under both profiles.
- After the last merge (Phase 3): re-verify the switch scenario
  (`features/mcp-server/implementation-switch.feature`) and Phase 2's `info`
  status scenarios under both profiles, then run Phase 6.

- [x] **Phase 1: Foundation and Pi 1.5.0** - Pi 1.5.0, the active-implementation snapshot, the pure profiles, records that keep every declared server, and the dual-profile cucumber harness, with every shared file and interface frozen and no visible change (completed 2026-11-04)
- [ ] **Phase 2: Built-in Materialization** - Recorded servers connect through Pi's built-in MCP on startup and `/reload` with Claude's values and names, trust gating, status in `info`, and a switch that needs no plugin action
- [ ] **Phase 3: Read-Time Verdicts** - State, per-server verdicts, markers, and `--partial` consent follow the active implementation, computed at read time from neutral records
- [ ] **Phase 4: Agent Grants** - Generated agents carry the active implementation's MCP grant, rewritten at load after a switch and never from a background child
- [ ] **Phase 5: Hook Tool Names** - Plugin hooks fire on built-in MCP tool calls with Claude's server segment, and the adapter proxy rule applies only under the adapter
- [ ] **Phase 6: Release Docs and Combined Tree** - The CHANGELOG and READMEs describe built-in MCP support, closed sets are clean, and the combined tree passes under both profiles

## Phase Details

### Phase 1: Foundation and Pi 1.5.0
**Goal**: Every parallel phase can start from frozen ground: the extension runs on Pi 1.5.0, each run knows its active MCP implementation, install records keep every declared server in its Claude form, both implementation profiles exist as pure code, and every MCP scenario runs under an adapter profile and a built-in profile. No user-visible output changes yet.
**Depends on**: Nothing (first phase)
**Runs**: serially in the parent session on `features/mcp-builtin`; its waves run parallel GSD executors in worktrees
**Requirements**: PI15-01, PI15-02, PI15-03, MSEL-01, MREC-01, DUAL-01, DUAL-02, DUAL-03, MDEC-01
**Discuss step**: IDs for D-MB-01..07 and the parity defaults (hook matchers see Claude's server segment with `-`, trust from Pi alone, registration at `session_start` and after the load reconcile, the OAuth client name as Claude Code sets it, background subagent children never write files); the rendering of the `requires mcp` and `requires builtin mcp` reasons (words fixed by D-MB-07) and the new built-in status tokens (messaging style guide); how `effectiveMcpCompatibility` reads a legacy stored compatibility that carries the adapter verdict; the tag for scenarios that choose their own implementation; how the harness reaches `none` and serves a built-in stand-in server.
**Research flag**: yes. Pi's long tool-name cut and hash rule for `builtinMcpServerName`; whether the 1.5.0 `isProjectTrusted()` fix flips the untrusted-project scenarios; the profile-tag architecture test; CI time with a second profile.
**Success Criteria** (what must be TRUE):
  1. `package.json` declares `@earendil-works/pi-coding-agent` peer `>=1.5.0` and dev `^1.5.0`, `pi-tui` dev `^1.5.0`, and `pi-ai` dev exactly `1.5.0`, with the lock matching; the floor tests prove 1.5.0; README, `README.es.md`, the compatibility docs, `AGENTS.md`, `STACK.md`, and the PROJECT.md Pi API constraint name it; what 1.5.0 breaks (the pi-schema validation move, the `isProjectTrusted()` fix, the `clientRegistration` `"auto"` default) is fixed; and the unit, integration, and cucumber suites pass on 1.5.0 (PI15-01, PI15-02, PI15-03).
  2. Each command run, load, hook run, and tool run reads one active MCP implementation from its run snapshot: the adapter when `/mcp-adapter` is loaded, built-in when `/mcp` comes from `builtin:mcp`, otherwise none; an architecture test rejects a probe that runs before every extension has loaded (MSEL-01).
  3. Install, update, reinstall, enable, and import record every declared, non-malformed MCP server in its Claude form before plugin-variable substitution, including servers the adapter cannot run; `state.json` holds no absolute path; a record written before the field still loads; and list, info, and install output is unchanged (MREC-01).
  4. The cucumber suite has an `adapter` and a `builtin` profile: every MCP feature runs under both with shared step definitions, each profile's Pi proves which implementation is active, an architecture test fails when an MCP scenario runs under only one profile without an implementation tag, a scenario can restart its Pi with the adapter added or removed or with no MCP at all and can use a built-in stand-in server, and CI runs both profiles within the behavioral job timeouts (DUAL-01, DUAL-02, DUAL-03).
  5. Every frozen file and cross-phase interface listed above exists, with the session steps wired as no-op seeds; each feature that fails under built-in carries `@adapter-only` naming its owning phase; each row whose MCP marker or state will change with the active implementation sits in a Phase 3 file; D-MB-01..07 and the defaults carry IDs in PROJECT.md Key Decisions, with the APL-D1 and Current Milestone text updated (MDEC-01); and `npm run check` plus both cucumber profiles pass.

**Parallel structure** (suggested; the planner may split further, and plans in one wave own disjoint files):

| Wave | Plan | Owns |
| --- | --- | --- |
| 1 | Pi 1.5.0 raise | `package.json`, `package-lock.json`, `platform/pi-api.ts` (1.5.0 type fixes), `test/architecture/peer-floor.test.ts`, `test/e2e/pi-peer-floor/**`, `test/e2e/pi-json-output.test.ts`, the version lines in the READMEs, `docs/*-compatibility.md`, `AGENTS.md`, `.planning/codebase/STACK.md`, and `CHANGELOG.md`, and each fix 1.5.0 forces |
| 1 | Decisions and rules | `.planning/PROJECT.md` (Key Decisions, APL-D1, Current Milestone, the Pi API constraint line), `.agents/skills/cucumber/rules/*` (the dual-profile rules and this milestone's ownership table) |
| 1 | Domain seam | `domain/mcp-implementation.ts`, the `domain/mcp-server-features.ts` split with `"sse"`, `domain/mcp-builtin-features.ts`, `builtinMcpServerName` in `domain/name.ts`, their unit pairs |
| 1 | Closed set | one commit: the reason and the built-in status tokens in `shared/notification-types.ts`, `notification-wire.ts`, `notify-reasons.ts`, `notify-closed-set-locks.test.ts`, `docs/json-output.md`, and the catalog counters |
| 2 | Harness | `cucumber.json`, `features/support/**`, the frozen libs and shared step modules, `test/e2e/_rpc.ts` (`--no-mcp`), `scripts/check-features.mjs`, the shard test, `.github/workflows/ci.yml`, the `test:cucumber` script, the profile-tag architecture test, `features/mcp-server/agent-grants.feature`, the `@adapter-only` tags, and the marker-row moves |
| 2 | Snapshot | `platform/pi-api.ts` (`SoftDepStatus.mcpImplementation`, `hasLoadedBuiltinMcp`, `PiMcpRegistry`, the MCP config types), `shared/notification-run.ts`, the `SoftDepStatus` test builders |
| 2 | Record producer | `persistence/state-io.ts` (`mcpServerConfigs?`), `declaredMcpServers` in `domain/{mcp-resolution,plugin-resolver,resolver-types}.ts`, `statePhase` in `install-outcome.ts`, the record write in `update-swap.ts` |
| 3 | Wiring | `orchestrators/mcp/{session-materialize,recorded-servers,builtin-registration-step,agent-grants-step}.ts`, the `platform/mcp-builtin-status.ts` seed, `EdgeDeps.mcpStatus` in `edge/{types,register}.ts` and `edge/handlers/plugin/info.ts`, the status call in `orchestrators/plugin/info.ts`, `index.ts`, the factory-time probe ban |
| 4 | Phase gate | `npm run check`, both cucumber profiles, `npm run test:modules`, the CI timing measurement, the frozen-file record, the parent lines |

**Plans:** 14/14 plans complete in 5 waves (the suggested waves, split at planning so each wave's plans own disjoint files: the snapshot and the session steps move to wave 2, the record producer to wave 3, the status pair and `recorded-servers.ts` to wave 4 after the producer, and the harness splits into four plans across waves 2-4)

Plans:
**Wave 1**
- [x] 01-01-PLAN.md — Wave 1: Pi 1.5.0 raise (pins, locks, floor tests), the version text, and the suites on 1.5.0 (PI15-01..03)
- [x] 01-02-PLAN.md — Wave 1: D-MB-01..13 Key Decisions, the APL-D1 and Current Milestone text, and the dual-profile cucumber contract (MDEC-01, DUAL-01)
- [x] 01-03-PLAN.md — Wave 1: domain seam: Pi MCP types, the `"sse"` feature split, the built-in scanner, `builtinMcpServerName`, the profiles, and `effectiveMcpCompatibility` (MSEL-01, MREC-01)
- [x] 01-04-PLAN.md — Wave 1: closed set in one commit: `requires mcp`, `requires builtin mcp`, the two built-in status tokens, and the companions, none emitted (MDEC-01)

**Wave 2** *(blocked on Wave 1 completion)*
- [x] 01-05-PLAN.md — Wave 2: `SoftDepStatus.mcpImplementation` and `hasLoadedBuiltinMcp` in the run snapshot with unchanged probe counts (MSEL-01)
- [x] 01-06-PLAN.md — Wave 2: no-op session step seeds, `session-materialize.ts`, the `index.ts` wiring, and the factory-time probe ban (MSEL-01)
- [x] 01-07-PLAN.md — Wave 2: cucumber profiles, the implementation probe, the restart steps, and `--no-mcp` (DUAL-01, DUAL-02)

**Wave 3** *(blocked on Wave 2 completion)*
- [x] 01-08-PLAN.md — Wave 3: record producer: `declaredMcpServers`, `mcpServerConfigs`, `mcpBundle`, and `compatibilityBasis` (MREC-01)
- [x] 01-09-PLAN.md — Wave 3: the shared Pi follows the profile, `@adapter-only` tags, the agent-grants split, and the implementation-dependent marker rows (DUAL-01, DUAL-02)
- [x] 01-10-PLAN.md — Wave 3: the MCP implementation step and the built-in stand-in server (DUAL-01)

**Wave 4** *(blocked on Wave 3 completion)*
- [x] 01-11-PLAN.md — Wave 4: the `mcpStatus` reader pair, the built-in status seed, and the frozen status call in `info` (MSEL-01)
- [x] 01-12-PLAN.md — Wave 4: `recordedMcpServers` and the read-only legacy reader (MREC-01)
- [x] 01-13-PLAN.md — Wave 4: the profile-tag rules, the `@mcp` tags, the CI profile axis, and the cucumber skill as built (DUAL-01..03)

**Wave 5** *(blocked on Wave 4 completion)*
- [x] 01-14-PLAN.md — Wave 5: phase gate: `npm run check` with both profiles, `test:modules`, `test:e2e`, the CI timing, the frozen record, and the parent lines (all nine requirements)

### Phase 2: Built-in Materialization
**Goal**: Without pi-mcp-adapter and with Pi's built-in MCP on, every enabled plugin's MCP servers connect through built-in on every startup and `/reload`, with the values and names Claude Code would give them, gated on project trust and visible in `info`; a switch between the adapter and built-in needs no plugin action (turning built-in MCP back on after the adapter turned it off is the user's step, D-MB-01).
**Depends on**: Phase 1
**Runs**: parallel child session, branch `features/mcp-builtin-phase-2`
**Requirements**: MSEL-02, MSEL-03, MSEL-04, MREC-02, BLT-01, BLT-02, BLT-03, BLT-04, BLT-05, BLT-06, MDOC-01
**Discuss step**: how Claude Code sets `cwd` and expands variables for plugin stdio servers (`claude-code-compat-research`); writing `${VAR}` references or resolved values (Pi lists registered configs); the milliseconds-to-seconds rounding; how the switch scenario models removing the adapter, given that adapter 7.0.0 writes `-builtin:mcp` into the user's Pi settings once per version and D-MB-01 forbids removing it (with that entry left, the next start is `none`, whose marker Phase 3 owns); reporting a legacy `mcp.json` entry that overrides a plugin server in the first built-in session.
**Research flag**: yes. Whether built-in lists deferred tools in `getAllTools()` before a `tool_search` (the status reader); the first-session order of legacy `mcp.json` entries against the AMIG-01 move.
**Success Criteria** (what must be TRUE):
  1. Under built-in, after each startup and `/reload`, every enabled plugin's runnable servers are registered and the scripted model calls their tools: a deferred server's tool through `tool_search`, an `alwaysLoad: true` server's tool directly (D-MB-02); after disable or uninstall the next session has no such server, enable restores it, and update replaces it with the new declaration (BLT-01, BLT-06).
  2. A built-in server receives what Claude Code would give it: stdio and streamable HTTP transports, `command`, `args`, `url`, `env`, and `headers` with `${CLAUDE_PLUGIN_ROOT}`, `${CLAUDE_PLUGIN_DATA}`, `${VAR}`, and `${VAR:-default}` expanded as upstream does, `timeout` in seconds, and the OAuth fields; a literal `$` or a leading `!` reaches the server unchanged; and a project-scope plugin's servers register only when Pi trusts the project (BLT-02, BLT-03).
  3. A built-in server is named `plugin_<plugin>_<server>` and its tools `mcp__plugin_<plugin>_<server>__<tool>`, with Pi's `-` to `_` fold recorded as a divergence; a name collision or an `mcp.json` entry that overrides a plugin server is reported, never silent; and `info` shows each built-in server as connected, not connected, disabled, overridden by `mcp.json`, or project not trusted (BLT-04, BLT-05).
  4. While the adapter is active or no implementation is active, the extension registers nothing and Pi reports no extension error; install keeps writing adapter entries under built-in, so a later start with the adapter serves those servers with no rewrite at load; and a plugin installed before this milestone reaches its servers under either implementation with no reinstall (MSEL-03, MSEL-04, MREC-02).
  5. `features/mcp-server/implementation-switch.feature` installs a plugin, reaches its server under the adapter, then under built-in after the adapter is removed and built-in MCP is on, then under the adapter again, with no plugin command in between; and `docs/mcp-compatibility.md` has a built-in column whose statements each cite a scenario or the Pi 1.5.0 source (MSEL-02, MDOC-01).

**Parallel structure** (suggested):

- Wave 1 (tracer): the translation table, the Pi value encoding, the idempotent registration sync, and the registration step (built-in only, enabled records, nothing under the adapter or none); `listing.feature` passes under both profiles (BLT-01, MSEL-03).
- Wave 2, in parallel, one feature file and step module each: configuration and source variants with the `substitute.ts` encoder parameter (BLT-02); project trust (BLT-03); naming, collisions, overrides, and status in `info-mcp-status.ts` and `platform/mcp-builtin-status.ts` (BLT-04, BLT-05); lifecycle (BLT-06); invocation through `tool_search` and direct `alwaysLoad` calls (BLT-01); the switch and legacy records in `implementation-switch.feature` (MSEL-02, MSEL-04, MREC-02; Phase 6 adds the `{requires mcp}` step for DUAL-04).
- Wave 3: the built-in column in `docs/mcp-compatibility.md` (MDOC-01), decision rows, parent lines, and the phase gate.

**Plans**: TBD

### Phase 3: Read-Time Verdicts
**Goal**: A plugin's available or partially available state, each server's verdict, the markers, and `--partial` consent follow the active implementation, computed at read time from neutral records, so a switch never asks the user for anything and a Pi with no MCP support tells the user what to turn on.
**Depends on**: Phase 1
**Runs**: parallel child session, branch `features/mcp-builtin-phase-3`; starts first and merges last (critical path); before its gate it merges the milestone branch, which by then holds the other parallel phases
**Requirements**: MREC-03, MREC-04, MREC-05, MREC-06, MREC-07
**Discuss step**: how each surface computes which `requires` marker applies (D-MB-07 fixes the words and the cases); a load warning row for a plugin that becomes partial after a switch; the AMIG-01 notice under built-in; how `pending` and `apply` show a plugin whose state changed only because the implementation changed.
**Research flag**: no `--research-phase`. D-MB-01, D-MB-05, D-MB-06, D-MB-07, and the frozen `effectiveMcpCompatibility` fix the rules.
**Success Criteria** (what must be TRUE):
  1. `list`, `info`, `install`, `update`, `pending`, and `apply` compute a plugin's state against the active implementation: one installed plugin with an `sse` server is available under the adapter and partially available under built-in, with no reinstall in between, and the stored compatibility no longer depends on the implementation that was active at install (MREC-03).
  2. `info` shows each server's verdict for the active implementation with that implementation's reason tokens, so an `sse` server reads as blocked under built-in and as runnable under the adapter (MREC-04).
  3. With no active implementation, a plugin with MCP servers stays `installed` with `{requires mcp}`, `{requires pi-mcp-adapter}`, or `{requires builtin mcp}`, naming the implementation that would run every server; installing it needs no `--partial`, and Pi's settings are never written (MREC-05).
  4. `--partial` consent is asked only on an install or update the user runs, against the active implementation; after a switch, enable, `apply`, reinstall, import, and cascades complete without asking (MREC-06).
  5. An `sse` server under built-in shows `{unsupported mcp, requires pi-mcp-adapter}` and `info`'s `requires: pi-mcp-adapter (missing)`, a server neither implementation runs shows `{unsupported mcp}` only, every MCP marker and state row in the files this phase owns passes under both profiles, and the two new reasons are drafted as CHANGELOG parent lines (MREC-07).

**Parallel structure** (suggested):

- Wave 1 (tracer): neutral stored compatibility and the effective read in `list` (`list-installed-row.ts`, `plugin-state-classifier.ts`), proven by the `sse` plugin under both profiles (MREC-03).
- Wave 2, in parallel: the server verdicts in `info.ts` (MREC-04); markers, `requires:`, severity, and the marker rows in `features/plugin/*` and `features/marketplace/update.feature` (MREC-05 marker, MREC-07); the consent split and convergence (`install-outcome.ts` gate, `update-preflight.ts`, the `partial` functions, `reconcile/convergence.ts`, `import/execute.ts`), with `mcp-migration.ts` made explicit about the adapter profile (MREC-03 install side, MREC-05 consent, MREC-06).
- Wave 3: merge the milestone branch (Phases 5, 4, and 2), re-run every owned row under both profiles, parent lines, and the phase gate.

**Plans**: TBD

### Phase 4: Agent Grants
**Goal**: A generated pi-subagents agent carries the active implementation's MCP grant, and after a switch the load rewrites only the agent files whose grants changed, never from a background child.
**Depends on**: Phase 1
**Runs**: parallel child session, branch `features/mcp-builtin-phase-4`
**Requirements**: MGRT-01, MGRT-02
**Discuss step**: what pi-subagents reports that shows a grant resolved under each implementation (the D-CF6-10 foreground refusal or a background launch); whether each built-in leg can use the Phase 1 stand-in server or needs Phase 2's registration (then the child merges the milestone branch after Phase 2 merges, and Phase 4 merges after Phase 2).
**Research flag**: yes. How to detect a pi-subagents background child that loads the extension; whether subagent launches re-read agent files or use the session snapshot.
**Success Criteria** (what must be TRUE):
  1. Installing, updating, reinstalling, or enabling a plugin whose agent is granted a plugin MCP tool gives that agent the active implementation's server selector, as pi-subagents reports it, under both profiles (MGRT-01).
  2. After a switch and `/reload`, the load rewrites exactly the agent files whose grants changed, atomically under the scope's state lock, with no user action (D-MB-03); with no active implementation, or in a project Pi does not trust, the files stay as they are (MGRT-01).
  3. A background subagent child that loads the extension rewrites no agent file and no other installation state (MGRT-02).

**Parallel structure** (suggested):

- Wave 1: the grant selector and async warning per profile in `bridges/agents/convert.ts`, the optional per-row implementation in the agents index, and the grant inputs in `agentsPhase` and the update agent staging (MGRT-01 install side).
- Wave 2: `orchestrators/mcp/agent-grants-step.ts` with child detection, and `agent-grants.feature` (MGRT-01 switch side, MGRT-02).
- Wave 3: parent lines and the phase gate.

**Plans**: TBD

### Phase 5: Hook Tool Names
**Goal**: Plugin hooks on plugin MCP tools fire under built-in with Claude's server segment, and the adapter's proxy rule applies only while the adapter is active.
**Depends on**: Phase 1
**Runs**: parallel child session, branch `features/mcp-builtin-phase-5`; small, so it may run in Phase 4's session after Phase 4 (still on its own branch) if the session budget is tight
**Requirements**: MHK-01, MHK-02
**Research flag**: no. One dispatch path with existing hook tests; the built-in scenarios use the Phase 1 stand-in server, so they need no Phase 2 code.
**Success Criteria** (what must be TRUE):
  1. Under built-in, a plugin hook whose matcher names a plugin MCP tool with Claude's server segment (with `-`) fires once on the built-in tool call, and a scenario pins that only the tool segment's `-` to `_` fold differs, recorded as a divergence licensed by a Pi capability gap (MHK-01).
  2. The pi-mcp-adapter `mcp` proxy special case in hook dispatch applies only while the adapter is active; under built-in or with no implementation, no call is treated as a proxy call (MHK-02).
  3. `docs/hooks-compatibility.md` states the built-in tool names and the divergence, and every MCP scenario in `features/hook/` runs under both profiles or carries an implementation tag.

**Plans:** 1/4 plans executed in 3 waves

Plans:
**Wave 1**
- [x] 05-01-PLAN.md — Wave 1: the per-event built-in tool identity end to end: Claude-form matchers, `if` fields, stdin, and labels, with the shared `@mcp` scenario (MHK-01)

**Wave 2** *(blocked on Wave 1 completion)*
- [ ] 05-02-PLAN.md — Wave 2: the proxy rule only under pi-mcp-adapter, one read per bridge generation, the D-P5-11 pair, and the cut-name scenario (MHK-02)
- [ ] 05-03-PLAN.md — Wave 2: the tool-segment fold scenario on a Pi `mcp.json` server, the notice-label scenario, and `docs/hooks-compatibility.md` (MHK-01, MHK-02)

**Wave 3** *(blocked on Wave 2 completion)*
- [ ] 05-04-PLAN.md — Wave 3: phase gate with both profiles, `test:modules`, the red sweep, the ownership check, and the parent lines (MHK-01, MHK-02)

### Phase 6: Release Docs and Combined Tree
**Goal**: The combined milestone tree is ready to ship: the CHANGELOG and READMEs describe built-in MCP support, the three `requires` markers, and the naming divergence; closed sets hold no unused entry; and every MCP feature and the switch scenario pass under both profiles after the last merge.
**Depends on**: Phase 2, Phase 3, Phase 4, Phase 5 (all merged)
**Runs**: serially in the parent session on `features/mcp-builtin`, after the last merge
**Requirements**: MDOC-02, DUAL-04
**Why serial**: children never edit `CHANGELOG.md`, the READMEs, or a closed-set entry they did not add, so no parallel phase can own MDOC-02 or the closed-set cleanup. DUAL-04 needs Phase 2's registration and Phase 3's `{requires mcp}` marker together, so it can pass only on the combined tree. This phase also turns the post-merge checks into verified criteria.
**Success Criteria** (what must be TRUE):
  1. `CHANGELOG.md`, `README.md`, `README.es.md`, and `docs/hooks-compatibility.md` describe built-in MCP support, the three `requires` markers (turn on built-in MCP or install pi-mcp-adapter, and what the adapter adds), and the `-` to `_` naming divergence (MDOC-02).
  2. The switch scenario reaches the server under the adapter; after the adapter is removed it shows `{requires mcp}` while built-in MCP is off (D-MB-01, D-MB-07); after built-in MCP is on it reaches the server under built-in; after the adapter is added again it reaches it under the adapter; no plugin command runs in between (DUAL-04).
  3. On the combined tree, `npm run check`, both cucumber profiles, and `npm run test:modules` pass, `npx fallow dupes` reports no unreviewed clone group, and the CI behavioral jobs finish within their timeouts.
  4. Every child's parent lines are applied (PROJECT.md Key Decisions rows, BACKLOG entries), no closed-set entry remains that the combined tree never emits, and the phase dubious-choice logs are merged into the root log for the user's review.

**Plans**: TBD

## Progress

**Execution order:** Phase 1, then Phases 2, 3, 4, and 5 in parallel (Phase 3 starts first), merged in the order 5, 4, 2, 3, then Phase 6.

| Phase | Plans Complete | Status | Completed |
| --- | --- | --- | --- |
| 1. Foundation and Pi 1.5.0 | 14/14 | Complete    | 2026-11-04 |
| 2. Built-in Materialization | 0/TBD | Not started | - |
| 3. Read-Time Verdicts | 0/TBD | Not started | - |
| 4. Agent Grants | 0/TBD | Not started | - |
| 5. Hook Tool Names | 1/4 | In Progress | - |
| 6. Release Docs and Combined Tree | 0/TBD | Not started | - |

## Carried Forward

- component-features: upstream fixes wait on the user's review on forks `acolomba/pi` (`fix/input-transform-expand-opt-out`) and `acolomba/pi-subagents` (`fix/mcp-direct-tools-adapter-7`); MCPBG-01, PIEXPAND-01, WFLOCAL-01 and MCPCANARY-01 stay in [BACKLOG.md](BACKLOG.md); D-CF7-05 awaits a live probe of Claude Code.
- `DEPADV-01` and `WOUT-01` remain in [BACKLOG.md](BACKLOG.md): Pi's shrinkwrap pins a nested `brace-expansion@5.0.9`, and workflow output is unobserved.
- Open user choice from json-output `09/` (D-03): the LLM tools return `isError: true`, which Pi 0.87.1 ignores; throwing a redacted Error instead would set Pi's error flag.
- `DBLEMIT-01`, `PSRC-01`, `USRCFG-01`, `MIGR-01`, and `NAMEFOLD-01` stay in [BACKLOG.md](BACKLOG.md), out of this milestone's scope.
- `HOSTED-DNS-01` remains accepted under D-PL5-31 until a hostname-resolution policy is designed and implemented.

Earlier carried items remain in [the archived roadmap](milestones/v1.20-ROADMAP.md), and their current dispositions are tracked in [WINDOWS.md](WINDOWS.md).
