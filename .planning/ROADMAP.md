# Roadmap: pi-claude-marketplace

## Milestones

- **component-features** Component Behavioral Tests — in progress on branch `claude/quirky-planck-hhm592`, started 2026-10-31; 7 phases, 58 requirements.
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

### In progress component-features -- Component Behavioral Tests

**Milestone goal:** The cucumber suite checks every bridged component kind --
skills, commands, agents, hooks, MCP servers, workflows -- as Pi and its
companion extensions see it after a real `/claude:plugin install`, with Claude
Code's component behavior as the reference and no authenticated LLM.

#### Parallelism

Phase 1 is the only prerequisite. Its discuss step settles the pre-fan-out
decisions (DEC-01) with the user before any component phase starts, so the
parallel sessions cannot diverge on argument syntax, injection, the description
fallback, dropped frontmatter fields, custom directories, or project trust.

Phases 2-7 each depend on Phase 1 alone and on no other component phase. Once
Phase 1 merges to the milestone branch, each of them runs in its own session
and git worktree, branched from the milestone branch, in parallel with the
other five. A cross-kind scenario belongs to exactly one phase and is built
from Phase 1 stand-ins, never from another component phase's lib file: XK-01
(an agent preloading a skill) belongs to Agents, MCP-07 (an agent granted an
MCP tool) to MCP Servers, and HOOK-08 (a hook on an MCP tool) to Hooks.

```text
W0  Phase 1 (Harness and Version Raise; its discuss step settles the pre-fan-out decisions)
W1  Phases 2 3 4 5 6 7   (each needs Phase 1 only; six sessions and worktrees in parallel)
```

No suite-close phase is planned. The parent session applies each phase's
collected lines at merge (see Merge procedure).

Inside a phase, plans in one wave own disjoint files, so the executor runs them
in parallel. Each component phase follows one wave template:

- **Wave 1, tracer:** listing and naming (`features/<kind>/listing.feature`).
  The kind's shared steps are defined here and nowhere else.
- **Wave 2, in parallel:** frontmatter and field variants; invocation through
  the scripted model; companion-missing (agents, MCP servers, workflows) or
  collisions (skills); removal and replacement (`lifecycle.feature`). Each plan
  owns its own feature file and step module.
- **Wave 3:** decisions with IDs, docs, the SUMMARY lines the parent applies,
  and the phase gate (`npm run check` on the phase branch).

A step that two wave-2 plans both need moves to wave 1. A plan never edits a
sibling plan's step module. If a fix needs a product file that a same-wave plan
owns, the second fix moves to the next wave. Iterate with
`npx cucumber-js features/<kind>` and run `npm run check` only at gates.

Each phase opens with a discuss step that settles its own open decisions (the
FG items listed under each phase). Upstream evidence for each FG item is in
`.planning/research/FEATURES.md`.

#### File ownership

**Frozen after Phase 1** (no component phase edits these):

- `features/support/world.ts` (profile Pi, `lastTurn`, the uncompared-turn
  marker) and `features/support/pi-process.ts`.
- `features/lib/{pi-process,pi-commands,run-tokens,published-marketplace,companions}.ts`,
  `features/lib/scripted-model/*`, `features/lib/pi-registry-probe/*`,
  `features/lib/hook-recorder.ts`, `features/lib/mcp-stub-server.ts`, and the
  generic readers (JSONL log slicing, table projection).
- `test/e2e/_rpc.ts`, `cucumber.json`, `scripts/check-features.mjs`, and
  `.agents/skills/cucumber/**`.
- The shared step modules: `command`, `session`, `config`, `git-host`,
  `mcp-configuration`, `model`, `companion`, `plugin/publishing`,
  `marketplace/publishing`.
- `package.json`, `package-lock.json`, `scripts/install-test-peers.mjs`,
  `.github/workflows/ci.yml`, and `platform/pi-api.ts` (Phase 1 widens every Pi
  event and API type any kind needs, such as `session_compact` and the
  `new`/`fork` reasons).

**Created by Phase 1 with a seed, then handed over:** the six function
directories `features/{skill,slash-command,agent,hook,mcp-server,workflow}/`,
one `features/lib/<kind>-files.ts` fixture writer and one
`features/step_definitions/<kind>/<topic>.steps.ts` module per kind. A phase
that adds a parameter type prefixes its name with its kind.

| Phase | Feature files | Step modules | Lib | Product |
| --- | --- | --- | --- | --- |
| 1 | the six seeds | shared modules + first topic module per kind | harness libs | version-raise fixes, `platform/pi-api.ts` |
| 2 | `features/skill/**` | `skill/**` | `skill-files.ts` | `bridges/skills/**`, `edge/skill-aliases.ts` |
| 3 | `features/slash-command/**` | `slash-command/**` | `slash-command-files.ts` | `bridges/commands/**` |
| 4 | `features/agent/**` | `agent/**` | `agent-files.ts` | `bridges/agents/**`, `persistence/agents-index-*` |
| 5 | `features/hook/**`, `features/plugin/session-start-hooks.feature` | `hook/**`, `plugin/session-start-hooks.steps.ts` | `hook-files.ts` | `bridges/hooks/**`, `domain/components/hook*`, `test/architecture/hooks-*.test.ts`, `docs/hooks-compatibility.md` |
| 6 | `features/mcp-server/**` | `mcp-server/**` | `mcp-server-files.ts` | `bridges/mcp/**`, `platform/mcp-status.ts`, `domain/mcp-resolution.ts`, `domain/components/mcp.ts`, `docs/mcp-compatibility.md` |
| 7 | `features/workflow/**` | `workflow/**` | `workflow-files.ts` | `bridges/workflows/**`, `platform/workflow-home.ts`, `domain/workflow-script.ts`, `docs/workflows-compatibility.md` |

Step module paths are relative to `features/step_definitions/`, lib paths to
`features/lib/`, and product paths to `extensions/pi-claude-marketplace/`
(except `docs/` and `test/`). Each component phase also owns its kind's unit
tests (`test/bridges/<kind>/**`) and integration tests
(`test/integration/<kind>-*`).

#### Milestone rules

- **Upstream parity.** Every expected behavior is Claude Code's (binary
  2.1.316 and the code.claude.com docs) unless a recorded decision with an ID
  or a Pi capability gap licenses a divergence. A gap, contradiction, or edge
  case with no license goes to the user before any scenario pins it. Research
  the upstream contract with `claude-code-compat-research`.
- **Bug policy.** A scenario that exposes a product bug fixes it in the same
  phase, with Claude Code as the reference. A phase stops for the user only
  when upstream behavior contradicts a recorded project principle and no
  precedent settles it.
- **Observation.** Every scenario observes what Pi or a companion reports --
  RPC `get_commands`, the registry probe, the hook recorder, the MCP stub
  server's log, the scripted model's call log, a child agent's system prompt, a
  workflow run's events -- and never the files the bridge wrote. Expected values
  are whole values written as literals in the feature file. Each kind has at
  least one negative control, and a red proof is recorded before each product
  fix.
- **Shared Pi.** The run's shared Pi keeps no model and no companions. A
  scenario that needs either starts a profile Pi through a `Given`.
- **Never edited by a component phase:** `CHANGELOG.md`, `README.md`,
  `README.es.md`, `.planning/PROJECT.md` Key Decisions, and
  `.planning/BACKLOG.md`. Each phase lists its lines for those files in its
  SUMMARY.md, and the parent applies them at merge. ROADMAP.md, STATE.md,
  REQUIREMENTS.md, and WINDOWS.md are tool-written; prefix every WINDOWS
  description with `[component-features]`.
- **Append-only closed sets.** `shared/notification-types.ts` `Reason`,
  `notification-wire.ts` `REASONS`, `notify-reasons.ts`,
  `schema/claude-plugin.schema.json`, `notify-closed-set-locks.test.ts`,
  `compat-01-no-expansion.test.ts`, `docs/json-output.md`, and the catalog
  counters (`docs/output-catalog.md`, `EXPECTED_STATE_COUNT`,
  `EXPECTED_UTF8_BYTES`). Prefer an existing reason. A new one lands as its own
  commit, and the later merge keeps both entries and fixes the counts.
- **Own arm only.** In `shared/concerns/soft-dep.ts` each phase edits only its
  own companion's arm; in `domain/name.ts` only its kind's function. A fix in
  an orchestrator (`uninstall.ts`, `enable-disable.ts`, `update-flow.ts`,
  `install-outcome.ts`, `*.messaging.ts`) stays minimal and inside its own
  function.
- **Reviewed clone pairs.** `bridges/{skills,commands,agents}/stage.ts` and
  their siblings carry `fallow-ignore-next-line code-duplication` markers in
  both copies. Changing one side can break the other's marker, and that shows
  only in the combined tree.
- **Out of scope (v2, RM-01..RM-05).** Behavior that needs a real model: a model
  choosing a skill or agent on its own, a command through the Skill tool,
  workflows whose scripts call `agent()`, remote MCP OAuth end to end, and
  StopFailure if the faux provider cannot end a turn in error.

#### Merge procedure

- Each component branch joins the milestone branch by a merge, never a rebase,
  and the merge gate runs `npm run check` on the combined tree.
- At each merge, the parent applies that phase's collected `CHANGELOG.md`,
  `README.md`, `README.es.md`, PROJECT.md Key Decisions, and `BACKLOG.md` lines.
- Suggested merge order, lowest conflict first: Phase 7 Workflows, Phase 6 MCP
  Servers, Phase 4 Agents, Phase 2 Skills, Phase 3 Slash Commands, Phase 5
  Hooks. Hooks goes last because it rewrites an existing plugin feature file
  and touches the event router.
- Rerun `npx fallow dupes` after the second merge and after every merge that
  touches a reviewed clone pair. Re-verify a phase after any later merge that
  touches its files.

- [x] **Phase 1: Harness and Version Raise** - Pi and the three companions at their latest releases, a profile Pi with a scripted model and stand-ins, and a seed scenario per kind, with the pre-fan-out decisions settled (completed 2026-11-01)
- [ ] **Phase 2: Skills** - Bridged skills list, carry their frontmatter, reach the model, resolve name clashes, and follow the plugin lifecycle as upstream
- [ ] **Phase 3: Slash Commands** - Bridged commands list as prompt templates, expand their arguments as decided, and follow the plugin lifecycle
- [ ] **Phase 4: Agents** - pi-subagents lists and runs bridged agents with converted fields, preloaded skills, and companion-missing recovery
- [ ] **Phase 5: Hooks** - Hooks fire on Pi's session, tool, prompt, and stop events with Claude's stdin and environment, including the `clear`, `compact`, and `fork` parity fixes
- [ ] **Phase 6: MCP Servers** - pi-mcp-adapter 7.x connects bridged servers under Claude's tool names, with configuration variants, project scope, and companion-missing recovery
- [ ] **Phase 7: Workflows** - The workflow engine registers and runs bridged workflows, reports refused scripts, and recovers when the engine is loaded later

## Phase Details

### Phase 1: Harness and Version Raise

**Goal:** A component phase can write its scenarios by adding only its own files: Pi and its three companions run at their latest releases with the declared floors raised, a scenario can start a profile Pi with a scripted model and the stand-ins that observe each kind, every kind has a seed scenario, and the decisions that span more than one component phase are recorded.
**Depends on:** Nothing (first phase)
**Requirements:** VER-01, VER-02, VER-03, VER-04, VER-05, VER-06, HAR-01, HAR-02, HAR-03, HAR-04, HAR-05, HAR-06, HAR-07, HAR-08, DEC-01, DEC-02, CI-01
**Discuss step (pre-fan-out gate, before any component phase starts):** FG-01 (positional argument numbering), FG-02 (`ARGUMENTS:` append), FG-03 (other substitution forms), FG-04 (skill arguments), FG-05 (`` !`cmd` `` injection), FG-06 (description fallback), FG-10 (dropped skill and command frontmatter fields), FG-14 (custom component directories and the PROJECT.md bullet that contradicts D-07), the project trust setup (FG-29 with Pitfall 7), the six function directory names, and FG-33 (IDs for the four 2026-10-31 decisions: `user-invocable: false`, `new` sent as `clear`, `compact` on compaction, `fork` matchers). Phase 1's own items: the adapter 7.x `${NAME:-default}` design and the `appendStructuredContent`/`roots` keys (VER-05), the profile Pi shape (per scenario, recommended, versus a long-lived Pi per worker), the CI shard shape, and the harness mechanics (recorder and stub as `.ts` under `features/lib/`, the script file versus `setResponses()` arming, no fallback reply).
**Research flag:** yes. The adapter 7.x `:-` design (resolve at install versus leave to the adapter at connect time); the nested `mcp` proxy double fire; whether a pi-subagents background child loads an extension passed by `--extension`; the CI timing measurement.
**Success Criteria** (what must be TRUE):

1. `package.json` declares Pi `>=1.4.0` (dev `^1.4.0`), `pi-tui` dev `^1.4.0`, `pi-ai` dev exactly `1.4.0`, `pi-mcp-adapter >=7.0.0 <8`, `pi-subagents >=0.84.0`, and `@quintinshaw/pi-dynamic-workflows >=3.15.0 <4` as a new optional peer, none of the companions in the lockfile; `install-test-peers.mjs` installs all three at their floors, the floor-pinning tests prove the new floors, and README, `README.es.md`, the compatibility docs, `AGENTS.md`, and `STACK.md` name the new versions (VER-01, VER-02, VER-03, VER-06).
2. Under pi-mcp-adapter 7.x, a value the MCP bridge writes as a literal, including the `${NAME:-default}` form, reaches the server unexpanded, so no environment secret leaks through a literal; the adapter-expansion conformance property is re-proved on 7.x, and the `:-` and new-key decision carries an ID (VER-04, VER-05).
3. A seed scenario starts a profile Pi with the real extension, the scripted model, the registry probe, and the three companions; its model-turn `When` waits for the settled turn and keeps every record the turn produced; the scripted model fails a scenario that runs past its script or leaves steps unused; the probe, hook recorder, and MCP stub report what Pi and the bridges did; the run's shared Pi keeps no model and no companions, and every existing scenario still passes (HAR-01, HAR-02, HAR-03, HAR-04).
4. Profile Pis keep `TMPDIR` and every companion write inside the scenario sandbox and reset to an asserted clean baseline; a trusted-project scenario and an untrusted-project scenario both pass; each of the six function directories holds a seed scenario that uses its kind's fixture writer and step module, `npm run check:features` is green, and the cucumber skill describes the profile Pi, the scripted model, the stand-ins, and the file-ownership table (HAR-05, HAR-06, HAR-07, HAR-08).
5. Before Phase 1 merges, the pre-fan-out decisions and the four 2026-10-31 decisions carry IDs and the PROJECT.md bullet that contradicts D-07 is corrected; the CI behavioral job installs the companions and runs lifecycle and component path shards whose timeouts hold the measured combined run with margin, and `npm run check` passes (DEC-01, DEC-02, CI-01).

**Parallel structure:** 9 plans in 4 waves. Plans in one wave own disjoint files.

| Wave | Plan | Owns | Seed |
| --- | --- | --- | --- |
| 1 | 01-01 Version raise | `package.json`, `package-lock.json`, `scripts/install-test-peers.mjs`, `scripts/pi.sh`, `test/e2e/pi-peer-floor/**`, the pinned `test/integration/**` tests, `test/architecture/peer-floor.test.ts`, `bridges/mcp/adapter-escape.ts` and `adapter-entry.ts` (with comment anchors in `adapter-doc.ts`, `platform/mcp-status.ts`, `platform/workflow-home.ts`), `platform/pi-api.ts`, the README and `README.es.md` version lines, the `*-compatibility.md` version lines, `AGENTS.md`, `.planning/codebase/STACK.md`, `CHANGELOG.md` | none |
| 1 | 01-02 Ownership rules | `.agents/skills/cucumber/rules/layout.md` (this milestone's table and reserved module names), `world-and-stand-ins.md` (profile Pi, scripted model, recorder, and stub rules) | none |
| 2 | 01-03 Tracer | `test/e2e/_rpc.ts` (extra extensions, typed extra env, `TMPDIR`), `test/architecture/hermetic-git-environment.test.ts`, `features/lib/pi-process.ts` (always-on record log, `agent_settled`, `idle`), `features/lib/scripted-model/*`, `features/lib/companions.ts`, `features/lib/run-tokens.ts`, `features/support/world.ts`, `step_definitions/{model,companion}.steps.ts`, `plugin/publishing.steps.ts` (generic file step), `session.steps.ts` (prompt `When`), `.github/workflows/ci.yml` (peer install, timeout), the skill fixture writer and first skill step module | `features/skill/invocation.feature` |
| 3 | 01-04 Probe | `lib/pi-registry-probe/*`, `lib/slash-command-files.ts`, `slash-command/listing.steps.ts` | `features/slash-command/listing.feature` |
| 3 | 01-05 Hook recorder | `lib/hook-recorder.ts`, `lib/hook-files.ts`, `hook/runs.steps.ts` | `features/hook/tool-use.feature` |
| 3 | 01-06 MCP stub | `lib/mcp-stub-server.ts`, `lib/mcp-server-files.ts`, `mcp-server/calls.steps.ts` | `features/mcp-server/invocation.feature` |
| 3 | 01-07 Agents | `lib/agent-files.ts`, `agent/runs.steps.ts` | `features/agent/invocation.feature` |
| 3 | 01-08 Workflows | `lib/workflow-files.ts`, `workflow/runs.steps.ts` | `features/workflow/run.feature` |
| 4 | 01-09 Phase gate | measure the combined cucumber time, set the CI shards and timeouts, run `npm run check` and the e2e floor test once | none |

01-01 finishes before 01-03: the faux import needs `pi-ai` in `package.json`, and the companion profile needs the engine in the peer cache. Wave 3 works only because wave 2 put every shared registration in place. If 01-01 grows because adapter 7.x needs larger `bridges/mcp` work, split it into a wave-1 raise plus file-disjoint per-companion fix plans. Once Phase 1 merges, each seed feature file belongs to its kind's phase.

**Plans:** 15/15 plans complete in 4 waves (the nine above, split and extended at planning: 01-15 carries the file-disjoint half of the version raise, 01-10/12/13 build the invocation cores, 01-11 the component-directory rule in wave 2, 01-14 the `:-` delegation)

Plans:
**Wave 1**
- [x] 01-01-PLAN.md — Wave 1: raise the declared floors and keep MCP literals literal under pi-mcp-adapter 7.x (VER-01..05, D-CF1-14)
- [x] 01-02-PLAN.md — Wave 1: cucumber ownership rules and the D-CF1 decision records (HAR-08, DEC-01, DEC-02)
- [x] 01-10-PLAN.md — Wave 1: command invocation seed in index.ts, fallow registration of the cores, description fallback and dropped-field cores (D-CF1-01/02/04/05)
- [x] 01-15-PLAN.md — Wave 1: Pi 1.4.0 e2e floor fixture, Pi API types, and the version docs (VER-01, VER-03, VER-06)

**Wave 2** *(blocked on Wave 1 completion)*
- [x] 01-03-PLAN.md — Wave 2: tracer, profile Pi with the scripted model and companions, skill seed (HAR-01/02/03/05/07)
- [x] 01-11-PLAN.md — Wave 2: declared component paths replace the folder for commands, agents, workflows, with the shadowed-folder warning (D-CF1-06)
- [x] 01-12-PLAN.md — Wave 2: argument substitution core, the T2e and tokenizer ports (D-CF1-01)
- [x] 01-13-PLAN.md — Wave 2: context injection core and the prompt shell spawn site (D-CF1-02)
- [x] 01-14-PLAN.md — Wave 2: `${NAME:-default}` left to the adapter where safe (D-CF1-13, VER-05)

**Wave 3** *(blocked on Wave 2 completion)*
- [x] 01-04-PLAN.md — Wave 3: registry probe in every profile, slash-command seed (HAR-04, HAR-07)
- [x] 01-05-PLAN.md — Wave 3: hook recorder, hook seed (HAR-04, HAR-07)
- [x] 01-06-PLAN.md — Wave 3: MCP stub, MCP seed, project-server approval Given (HAR-04, HAR-06, HAR-07)
- [x] 01-07-PLAN.md — Wave 3: agent seed and the trusted and untrusted pair (HAR-06, HAR-07)
- [x] 01-08-PLAN.md — Wave 3: workflow seed (HAR-07)

**Wave 4** *(blocked on Wave 3 completion)*
- [x] 01-09-PLAN.md — Wave 4: CI shards with measured timeouts, handed-over records, phase gate (CI-01)

### Phase 2: Skills

**Goal:** A bridged skill looks to Pi the way Claude Code defines it: listed under its qualified name with its description, its frontmatter honored or licensed as a divergence, its body sent to the model on invocation, name clashes resolved as decided, and the plugin lifecycle reflected in a new session.
**Depends on:** Phase 1
**Requirements:** SKL-01, SKL-02, SKL-03, SKL-04, SKL-05, SKL-06
**Discuss step:** FG-07 (generated name from frontmatter `name`), FG-08 (a skill and a command on one qualified name), FG-09 (the `/plugin:skill` alias in interactive input only, or also RPC). Phase 2 cites the `user-invocable: false` divergence ID that Phase 1 assigned and reports the gap to Pi. FG-04, FG-06, FG-10, and the FG-01..FG-03 pattern were settled before fan-out; this phase pins them.
**Research flag:** no `--research-phase`. FG-07 (`claude plugin details`) and FG-08 (one plugin with both a skill and a command) each need a live upstream probe with `claude-code-compat-research` before the decision.
**Success Criteria** (what must be TRUE):

1. A new session lists each bridged skill as `/skill:<plugin>-<name>` with its description, including the description fallback as decided, and `disable-model-invocation`, `user-invocable: false` (under its Pi-gap divergence ID), frontmatter `name` (FG-07), and each FG-10 field behave as upstream or as a recorded divergence (SKL-01, SKL-02).
2. Invoking a skill through the scripted model sends the model the skill body in a `<skill>` block, with path variables expanded and arguments handled as decided, and the model call log shows the whole message (SKL-03).
3. A skill and a command, or two skills, with one qualified name resolve as FG-08 decides, and the interactive `/plugin:skill` alias works as FG-09 decides, proven through the TUI driver (SKL-04, SKL-05).
4. After disable, uninstall, or update, a new session no longer offers the skill or offers the new version, and after enable it offers the skill again (SKL-06).
5. The `user-invocable: false` gap is reported to Pi, and `npm run check` passes on the phase branch.

**Parallel structure:**

- Wave 1 (tracer): listing and naming, `features/skill/listing.feature` and `skill/listing.steps.ts`, which holds the shared skill steps (SKL-01).
- Wave 2, in parallel: frontmatter variants, `frontmatter.feature` (SKL-02); invocation and the alias, `invocation.feature` (Phase 1 seed) plus the TUI alias scenarios, owning `edge/skill-aliases.ts` because FG-04 arguments and FG-09 both live there (SKL-03, SKL-05); collisions, `collisions.feature` (SKL-04); removal and replacement, `lifecycle.feature` (SKL-06).
- Wave 3: decision IDs, the Pi report, SUMMARY lines for the parent, and the phase gate.
- Owns: `features/skill/**`, `features/step_definitions/skill/**`, `features/lib/skill-files.ts`, `bridges/skills/**`, `edge/skill-aliases.ts`, `test/bridges/skills/**`, `test/integration/skills-*`.

**Plans:** 6/7 plans executed in 4 waves (the template's wave 1 also stores the upstream names the alias loader reads, so the staged bytes change once; the alias plan moves to wave 3 because it builds on the invocation plan's input handler; the phase gate is wave 4)

Plans:
**Wave 1**
- [x] 02-01-PLAN.md — Wave 1 tracer: listing with Claude Code's description fallback, the shared skill steps, and the stored upstream names record (SKL-01; D-CF2-07, D-CF2-02 install half)

**Wave 2** *(blocked on Wave 1 completion)*
- [x] 02-02-PLAN.md — Wave 2: frontmatter fields, the dropped-fields warning and the pass-through pins (SKL-02; D-CF2-08, D-CF2-09, D-CF2-01)
- [x] 02-03-PLAN.md — Wave 2: skill invocation with argument substitution and context injection, interactive and RPC (SKL-03; D-CF2-06, D-CF2-05)
- [x] 02-04-PLAN.md — Wave 2: name clashes, a command shadows its plugin's skill and `skills/` wins (SKL-04; D-CF2-03, D-CF2-04)
- [x] 02-05-PLAN.md — Wave 2: disable, uninstall, update, and enable in a new session (SKL-06; D-CF2-11)

**Wave 3** *(blocked on Wave 2 completion)*
- [x] 02-06-PLAN.md — Wave 3: Claude Code's alias names over RPC and the TUI driver (SKL-05; D-CF2-02, D-CF2-05, D-CF2-12)

**Wave 4** *(blocked on Wave 3 completion)*
- [ ] 02-07-PLAN.md — Wave 4: phase gate, the drafted Pi gap report, and the parent lines (D-CF2-10)

### Phase 3: Slash Commands

**Goal:** A bridged command looks to Pi the way Claude Code defines it: listed as a prompt template under its qualified name, its arguments expanded as decided, its frontmatter and manifest forms honored or licensed as a divergence, and the plugin lifecycle reflected in a new session.
**Depends on:** Phase 1
**Requirements:** CMD-01, CMD-02, CMD-03, CMD-04, CMD-05
**Discuss step:** FG-11 (commands are model-invocable upstream; record a Pi gap or also stage them as skills), FG-12 (extend the `user-invocable: false` divergence ID to commands), FG-13 (the object-map `commands` manifest form). FG-01..FG-06, FG-10, and FG-14 were settled before fan-out; this phase pins them.
**Research flag:** no. FEATURES.md covers the contract; the decisions are the work.
**Success Criteria** (what must be TRUE):

1. A new session lists each bridged command as a prompt template `/<plugin>:<name>`, nested directories colon-joined, with its description (CMD-01).
2. Invoking a command through the scripted model sends the model its body with `$ARGUMENTS`, positional arguments, and the appended-arguments rule applied as decided under FG-01..FG-03, and the model call log shows the whole message (CMD-02).
3. `argument-hint`, `description`, path variables, `` !`cmd` `` injection (FG-05), model invocation (FG-11), and `user-invocable` (FG-12) each behave as upstream or carry a recorded divergence ID (CMD-03).
4. A plugin with the object-map `commands` form and a plugin with a custom command directory install and list as FG-13 and FG-14 decide (CMD-04).
5. After disable, uninstall, or update, a new session drops or replaces the command, and after enable it offers the command again (CMD-05).

**Parallel structure:**

- Wave 1 (tracer): listing and naming, `features/slash-command/listing.feature` (Phase 1 seed) and `slash-command/listing.steps.ts`, which holds the shared command steps (CMD-01).
- Wave 2, in parallel: frontmatter and content variants, `frontmatter.feature` (CMD-03); invocation and argument expansion, `invocation.feature` (CMD-02); manifest forms and custom directories, `manifest-forms.feature` (CMD-04), in the slot other kinds use for collisions, because the skill-command clash is SKL-04 and belongs to Skills; removal and replacement, `lifecycle.feature` (CMD-05).
- Wave 3: decision IDs, SUMMARY lines for the parent, and the phase gate.
- Owns: `features/slash-command/**`, `features/step_definitions/slash-command/**`, `features/lib/slash-command-files.ts`, `bridges/commands/**`, `test/bridges/commands/**`, `test/integration/commands-*`. If FG-13 adds the object-map form, the resolver change stays inside the commands arm.

**Plans:** TBD

### Phase 4: Agents

**Goal:** With pi-subagents loaded, a bridged agent is listed, runs a child with the converted system prompt, tools, model, and preloaded skills, recovers when the companion is loaded later, and follows the plugin lifecycle.
**Depends on:** Phase 1
**Requirements:** AGT-01, AGT-02, AGT-03, AGT-04, AGT-05, AGT-06, AGT-07, XK-01
**Discuss step:** FG-15 (nested `agents/x/y.md` named `plugin:x:y`), FG-16 (preloading a `disable-model-invocation` skill), FG-17 (`background` to `async`, `memory`, and the recorded rest), FG-18 (the `--map-model` table), whether any `async: true` scenario ships, and cross-plugin and user-agent same-name priority (A15 EDGE). FG-14 was settled before fan-out; this phase pins the union.
**Research flag:** yes. The pi-subagents 0.84 parser against the bridge's emitted frontmatter, project-agent trust, and any `async: true` proof.
**Success Criteria** (what must be TRUE):

1. With pi-subagents loaded, its agent list shows each bridged agent as `<plugin>:<name>` with its alias and description, nested agent files as FG-15 decides (AGT-01).
2. A foreground run starts a child whose recorded system prompt is the agent body and whose tools and model follow the conversion rules, with and without `--map-model`; `tools`, `disallowedTools`, `model`, `effort`, skill preloads, and the FG-17 fields behave as upstream or carry an ID; and an agent that preloads a plugin skill gets that skill's content in its child session (AGT-02, AGT-03, XK-01).
3. A background (`async: true`) run completes on pi-subagents 0.84 with the scripted model, or the gap carries a recorded ID (AGT-04).
4. Without pi-subagents, the install shows `{requires pi-subagents}`, and loading the companion then `/reload` makes the agents available with no reinstall; project-scope agents behave as upstream in a trusted project, and a scenario pins the untrusted behavior (AGT-05, AGT-06).
5. Disable, uninstall, and update remove or replace the agent in pi-subagents' list, and enable restores it (AGT-07).

**Parallel structure:**

- Wave 1 (tracer): listing and naming, `features/agent/listing.feature` and `agent/listing.steps.ts`, which holds the shared agent steps (AGT-01).
- Wave 2, in parallel: frontmatter conversion, `frontmatter.feature` (AGT-03); runs, `invocation.feature` (Phase 1 seed) with foreground runs, `--map-model`, the async decision, and the skill preload (AGT-02, AGT-04, XK-01); companion-missing and project trust, `companion-missing.feature` and `project-trust.feature`, editing only the pi-subagents arm of `shared/concerns/soft-dep.ts` (AGT-05, AGT-06); removal and replacement, `lifecycle.feature` (AGT-07).
- Wave 3: decision IDs, SUMMARY lines for the parent, and the phase gate.
- Owns: `features/agent/**`, `features/step_definitions/agent/**`, `features/lib/agent-files.ts`, `bridges/agents/**`, `persistence/agents-index-*`, `test/bridges/agents/**`, `test/integration/agents-*`. XK-01 uses Phase 1's skill fixture writer and stand-ins, never a Phase 2 file.

**Plans:** 4/6 plans executed in 4 waves (the template's wave 2 runs one `convert.ts` owner beside the two plans that change no product code, and invocation moves to wave 3 because it edits `convert.ts` after the frontmatter plan; the phase gate is wave 4)

Plans:
**Wave 1**
- [x] 04-01-PLAN.md — Wave 1 tracer: listing and naming, the shared agent steps, the description fallback, nested and declared agent files, and `advertise` (AGT-01; D-CF4-01, -02, -03, -13, -14)

**Wave 2** *(blocked on Wave 1 completion)*
- [x] 04-02-PLAN.md — Wave 2: frontmatter conversion, the foreground default, effort, the 5.x `--map-model` table, tool splitting, and guided fields (AGT-03, AGT-02 `--map-model`; D-CF4-05, -06, -07, -08)
- [x] 04-03-PLAN.md — Wave 2: companion missing and project trust (AGT-05, AGT-06; D-CF4-11, -09)
- [x] 04-04-PLAN.md — Wave 2: disable, enable, uninstall, and update in pi-subagents' list (AGT-07; D-CF4-12)

**Wave 3** *(blocked on Wave 2 completion)*
- [ ] 04-05-PLAN.md — Wave 3: skill preload content, foreground run tools, the same-name run, and the AGT-04 recorded gap (XK-01, AGT-02, AGT-04; D-CF4-04, -02, -10)

**Wave 4** *(blocked on Wave 3 completion)*
- [ ] 04-06-PLAN.md — Wave 4: phase gate, the drafted pi-subagents report, the decision records, and the parent lines (all; D-CF4-01..14 records)

### Phase 5: Hooks

**Goal:** Plugin hooks fire on Pi's session, tool, prompt, and stop events with Claude's event names, stdin, and environment, the session parity fixes for `new`, `compact`, and `fork` are in place, and every hook option either works as upstream or is reported, never silently dropped.
**Depends on:** Phase 1
**Requirements:** HOOK-01, HOOK-02, HOOK-03, HOOK-04, HOOK-05, HOOK-06, HOOK-07, HOOK-08, HOOK-09
**Discuss step:** FG-20 (SessionEnd reasons beyond `new` to `clear`, and which SessionEnd matchers to admit), FG-21 (SessionStart on Pi `reload`), FG-22 (`once` and `onFailure`), FG-23 (`DirectoryAdded`, and correcting PROJECT.md or the code), FG-24 (the manifest `hooks` field), FG-26 (hook `systemMessage`), the PostCompact versus SessionStart `compact` order, the SSDEDUP-01 dedupe key, the install outcome for plugins that needed `--partial` for a `clear`, `compact`, or `fork` matcher, and the outer `mcp` proxy event. Fixes with no question: FG-19 (exec-form `${CLAUDE_PLUGIN_ROOT}` substitution), FG-25 (docs drift in `docs/hooks-compatibility.md` and the `hook-events.ts` header), and an ID for H7 (`additionalContext` on every event).
**Research flag:** yes. A binary check of the PostCompact versus SessionStart `compact` order and the SessionEnd reason set, then the user's answers to FG-20 and FG-21 as one batch.
**Success Criteria** (what must be TRUE):

1. A SessionStart hook receives `source: "clear"` after Pi `new` and `source: "compact"` after each compaction, two compactions in one session give two runs while Pi's duplicate session bind (pi#10470) still gives one, `clear`, `compact`, and `fork` matchers select their runs, and the migrated `features/plugin/session-start-hooks.feature` passes (HOOK-01, HOOK-03).
2. A SessionEnd hook receives `reason: "clear"` after Pi `new`, and its other reasons, its matchers, and SessionStart on Pi `reload` behave as FG-20 and FG-21 decide (HOOK-02).
3. PreToolUse, PostToolUse, and PostToolUseFailure hooks fire on scripted tool calls with Claude's tool names and stdin, matchers select them, and exit codes and JSON decisions block or allow as upstream; a hook on a plugin MCP tool fires once per call under the real tool name, with the outer `mcp` proxy event handled as decided (HOOK-04, HOOK-08).
4. UserPromptSubmit, Stop, and the other admitted events fire with Claude's stdin and their outputs behave as upstream or a recorded divergence; exec-form hooks substitute `${CLAUDE_PLUGIN_ROOT}` and `${CLAUDE_PLUGIN_DATA}` in `command` and in each `args` element with upstream's environment; `if`, `once`, `onFailure`, the manifest `hooks` field, and unsupported events behave as FG-22..FG-24 decide and are never silent (HOOK-05, HOOK-06, HOOK-07).
5. Disable, uninstall, and update stop or replace the hooks, as the hook recorder shows, and `docs/hooks-compatibility.md` matches the tested behavior (HOOK-09).

**Parallel structure:** Only one plan per wave edits `bridges/hooks/event-router.ts`; a second plan that needs it moves to the next wave.

- Wave 1 (tracer): the session parity fixes, `features/hook/session.feature` plus the migrated `features/plugin/session-start-hooks.feature` and its step module, owning `event-router.ts` for this wave (HOOK-01, HOOK-02, HOOK-03). This is the hooks analog of the listing tracer: which session hooks fire, and with what source.
- Wave 2, in parallel: tool-use, `tool-use.feature` (Phase 1 seed) with the MCP tool hook, owning `event-router.ts` for this wave (HOOK-04, HOOK-08); prompt and stop events, `prompt-and-stop.feature` (HOOK-05); process and environment, `process.feature`, with the FG-19 fix (HOOK-06); configuration, `configuration.feature` (HOOK-07); removal and replacement, `lifecycle.feature` (HOOK-09).
- Wave 3: decision IDs, `docs/hooks-compatibility.md` and the `hook-events.ts` header (FG-25), the CHANGELOG line about stale `clear`/`compact`/`fork` hooks in existing installs, SUMMARY lines for the parent, and the phase gate.
- Owns: `features/hook/**`, `features/plugin/session-start-hooks.feature`, `features/step_definitions/hook/**`, `features/step_definitions/plugin/session-start-hooks.steps.ts`, `features/lib/hook-files.ts`, `bridges/hooks/**`, `domain/components/hook-*.ts` and `hooks*`, `test/architecture/hooks-*.test.ts`, `docs/hooks-compatibility.md`, `test/bridges/hooks/**`, `test/integration/hooks-*`. HOOK-08 uses Phase 1's MCP stub and hook recorder, never a Phase 6 file.

**Plans:** TBD

### Phase 6: MCP Servers

**Goal:** With pi-mcp-adapter 7.x loaded, a bridged MCP server connects under Claude's tool names, receives its configuration as upstream, answers calls from the model and from agents, starts in a project as decided, recovers when the adapter is loaded later, and follows the plugin lifecycle.
**Depends on:** Phase 1
**Requirements:** MCP-01, MCP-02, MCP-03, MCP-04, MCP-05, MCP-06, MCP-07, MCP-08
**Discuss step:** FG-27 (first source wins versus upstream's merge), FG-28 (one malformed server makes the plugin unavailable versus upstream skipping that server), FG-29 (project-scope plugin servers as unapproved project servers: a licensed divergence or a product fix), FG-30 (re-measure every MCP doc row on adapter 7.x and fix any break in-phase). Fixtures avoid `protocolVersion: "auto"`, `npx`, and `http` without a loopback stand-in.
**Research flag:** yes. `claude-code-compat-research` on plugin MCP servers versus project approval and on `${VAR:-default}`, and a re-measure of every MCP doc row on adapter 7.x.
**Success Criteria** (what must be TRUE):

1. With pi-mcp-adapter 7.x loaded, a bridged stdio server connects (the stub logs `initialize` and `tools/list`) and its tools register as `mcp__plugin_<plugin>_<server>__<tool>`; a scripted call through the adapter's `mcp` proxy reaches the stub with the given arguments and returns its result to the model (MCP-01, MCP-02).
2. Args, env, `${VAR}` and `${VAR:-default}`, `${CLAUDE_PLUGIN_ROOT}` and `${CLAUDE_PLUGIN_DATA}`, and loopback remote servers with headers reach the server as upstream, the documented rows hold on 7.x, and multiple server sources and a malformed server behave as FG-27 and FG-28 decide (MCP-03, MCP-04).
3. In a trusted project, project-scope plugin servers start as FG-29 decides and a scenario pins the untrusted behavior; without pi-mcp-adapter the install shows `{requires pi-mcp-adapter}`, and loading the adapter then `/reload` makes the servers available with no reinstall (MCP-05, MCP-06).
4. An agent granted a plugin MCP tool calls it in a foreground run, and the stub logs the call (MCP-07).
5. Disable, uninstall, and update remove or replace the server entries the adapter sees (MCP-08).

**Parallel structure:**

- Wave 1 (tracer): connection and naming, `features/mcp-server/listing.feature` and `mcp-server/listing.steps.ts`, which holds the shared MCP steps (MCP-01).
- Wave 2, in parallel: configuration variants and sources, `configuration.feature` (MCP-03, MCP-04); calls from the model and from an agent, `invocation.feature` (Phase 1 seed) (MCP-02, MCP-07); companion-missing and project scope, `companion-missing.feature` and `project-scope.feature`, editing only the pi-mcp-adapter arm of `shared/concerns/soft-dep.ts` (MCP-05, MCP-06); removal and replacement, `lifecycle.feature` (MCP-08).
- Wave 3: decision IDs, the re-measured `docs/mcp-compatibility.md` rows (FG-30), SUMMARY lines for the parent, and the phase gate.
- Owns: `features/mcp-server/**`, `features/step_definitions/mcp-server/**`, `features/lib/mcp-server-files.ts`, `bridges/mcp/**` (including Phase 1's escape fix once merged), `platform/mcp-status.ts`, `domain/mcp-resolution.ts`, `domain/components/mcp.ts`, `docs/mcp-compatibility.md`, `test/bridges/mcp/**`, `test/integration/mcp-*`. MCP-07 uses Phase 1's agent fixture writer and stand-ins, never a Phase 4 file.

**Plans:** TBD

### Phase 7: Workflows

**Goal:** With the workflow engine loaded, a bridged workflow is a command that runs and records its arguments and result, a script the engine refuses is reported, the workflows appear when the engine is loaded later, and the plugin lifecycle removes or replaces them.
**Depends on:** Phase 1
**Requirements:** WFL-01, WFL-02, WFL-03, WFL-04, WFL-05
**Discuss step:** FG-31 (record "no run approval" as a Pi-gap divergence with an ID), FG-32 (accept and pin the engine's `{_, _raw, key=value}` argument shape). FG-14 was settled before fan-out. Fixture workflows are never named after Pi reserved commands (`new`, `compact`, ...), and scripts use a statement body ending in `return`.
**Research flag:** no. Confirm the progress-entry shape against the engine 3.15 source.
**Success Criteria** (what must be TRUE):

1. With the workflow engine loaded, each bridged workflow is the command `/<plugin>:<meta.name>` with its description (WFL-01).
2. Running the command completes, and the run's events record the arguments in the engine's shape and the script's result (WFL-02).
3. Scripts the engine refuses (meta shape, determinism, reserved names) are reported as upstream or as a recorded divergence, and the missing run approval carries an ID (WFL-03).
4. Without the engine, the install shows `{requires pi-dynamic-workflows}` at the decided severity, and loading the engine then `/reload` makes the workflows available with no reinstall (WFL-04).
5. Disable, uninstall, and update remove or replace the workflow, including the lingering-command notice (WLIF-06) (WFL-05).

**Parallel structure:**

- Wave 1 (tracer): registration and naming, `features/workflow/listing.feature` and `workflow/listing.steps.ts`, which holds the shared workflow steps (WFL-01).
- Wave 2, in parallel: refused scripts, `refusals.feature`, in the slot other kinds use for frontmatter (WFL-03); runs, `run.feature` (Phase 1 seed) (WFL-02); companion-missing, `companion-missing.feature`, editing only the engine arm of `shared/concerns/soft-dep.ts` (WFL-04); removal and replacement, `lifecycle.feature` (WFL-05).
- Wave 3: decision IDs, `docs/workflows-compatibility.md`, SUMMARY lines for the parent, and the phase gate.
- Owns: `features/workflow/**`, `features/step_definitions/workflow/**`, `features/lib/workflow-files.ts`, `bridges/workflows/**`, `platform/workflow-home.ts`, `domain/workflow-script.ts`, `docs/workflows-compatibility.md`, `test/bridges/workflows/**`, `test/integration/workflows-*`.

**Plans:** TBD

## Progress

| Phase | Plans Complete | Status | Completed |
| --- | --- | --- | --- |
| 1. Harness and Version Raise | 15/15 | Complete    | 2026-11-01 |
| 2. Skills | 6/7 | In Progress | - |
| 3. Slash Commands | 0/TBD | Not started | - |
| 4. Agents | 4/6 | In Progress | - |
| 5. Hooks | 0/TBD | Not started | - |
| 6. MCP Servers | 0/TBD | Not started | - |
| 7. Workflows | 0/TBD | Not started | - |

## Carried Forward

- `DEPADV-01` and `WOUT-01` remain in [BACKLOG.md](BACKLOG.md): Pi's shrinkwrap pins a nested `brace-expansion@5.0.9`, and workflow output is unobserved.
- Open user choice from json-output `09/` (D-03): the LLM tools return `isError: true`, which Pi 0.87.1 ignores; throwing a redacted Error instead would set Pi's error flag.
- `DBLEMIT-01`, `PSRC-01`, `USRCFG-01`, `MIGR-01`, and `NAMEFOLD-01` stay in [BACKLOG.md](BACKLOG.md), out of this milestone's scope.
- `HOSTED-DNS-01` remains accepted under D-PL5-31 until a hostname-resolution policy is designed and implemented.

Earlier carried items remain in [the archived roadmap](milestones/v1.20-ROADMAP.md), and their current dispositions are tracked in [WINDOWS.md](WINDOWS.md).
