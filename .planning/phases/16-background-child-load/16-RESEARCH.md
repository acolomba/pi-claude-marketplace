# Phase 16: Background-Child Load - Research

**Researched:** 2026-11-08
**Domain:** cucumber behavioral coverage of the pi-subagents background-child load (D-MB-12)
**Confidence:** HIGH (every table and red proof below came from a run in this session)

## Summary

The phase is coverage only. The product gates exist and work: four throwaway probe
scenarios that match the planned scenarios passed under the adapter profile on the
unchanged tree (4 scenarios, 67 steps, 29 s wall, 2 workers). Each one also went red
under a temporary mutation in an untracked scratch copy of the tree. No scenario
exposed a bug, so no product change is expected.

Every step the plan needs already exists in a shared or topic module. No new
`plugin/subagent-child.steps.ts` is needed. `npm run check:features` accepted all
planned steps, the `When`/`Then`/`When`/`Then` alternation, the `@own-implementation`
tag on the legacy-move scenario, and no tag on the others. Its one finding was the
probe's own feature title, which the real file does not have.

Three results change what the plan must assert:
(1) In json mode, the one-shot parent records only the payloads of its own command,
never its load's. The parent's applied changes therefore show only in the list rows
and in the installation record.
(2) In the legacy-move scenario, `the session reports no results` is NOT the
load-bearing check. A child that moves the entries does the move at its start load,
before the new session. The `mcp.json` and `mcp-adapter.json` text checks catch it.
(3) The PreToolUse scenario stays green when a child's `resources_discover` does
nothing at all. The hooks route at factory time and at `session_start`. Its red proof
must stop the hooks bridge itself in a child.

**Primary recommendation:** One plan, one wave. Rewrite the seed into the CHILD-01
scenario. Add the legacy-move, skills/commands, and PreToolUse scenarios to
`features/plugin/subagent-child.feature`, using the exact text in "Code Examples".
Re-run the MGRT-02 grant scenario's red proof. Record the five mutations below in
the SUMMARY.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

### Which load steps a child runs (settled by D-MB-12 / P4-DC-08, not reopened)
- A child skips the autoapply apply step, the AMIG-01 legacy `mcp.json` move,
  and the agent grants step. It runs the read-only pass (the MIG-01 first-run
  config migration and `loadState`'s legacy migration stay ungated because they
  are idempotent and the parent's load runs them first), the hooks hydration
  and routing rebuild, the built-in MCP resync (session-only registrations,
  no file), the plugin PATH recompute, and resource discovery.
- The background autoupdate pass needs no child gate: it arms only in `tui`
  mode (D-PL8-02), and pi-subagents 0.84.0 binds every child session with
  `mode: "print"` (`src/runs/shared/child-session.js`). The load's read-only
  pass never touches the completion cache file, which only the apply step
  writes. No scenario pins either fact; both are recorded here so the planner
  does not add a gate.
- The phase pins no MIG-01 or state-migration write in a child: those stay as
  P4-DC-08 left them, and pinning a write would cut against D-MB-12's "writes
  no file" wording without a criterion asking for it.

### What a child reports for a pending change (D-BG-1601)
- **D-BG-1601:** a child's load reports a pending change exactly as a parent
  load with autoapply off does: the `Reconcile pending` cascade with
  `needs apply` true and the `will install` / `will uninstall` /
  `will update` rows. It is not silenced. This is what the read-only pass
  already does, and the Phase 1 seed pins it. Rejected: a silent child load
  (a new branch in the shared load path for no user benefit; a real child's
  notices go nowhere a user sees anyway).

### CHILD-01: autoapply on, and the next parent load (D-BG-1602)
- One scenario covers criterion 1: a project-scope config with
  `{ "autoapply": true }` and, at the child's load, one pending install
  (declared, not recorded), one pending uninstall (recorded, no longer
  declared), and one pending update (recorded at 1.0.0, the dir-source
  marketplace now offers 1.1.0). The child's load reports the three as pending
  and the installation record of the project scope keeps exactly the two
  recorded plugins at 1.0.0.
- The installs that set it up run through the run's shared Pi
  (`the user has run "/claude:plugin install ..."`) before the child Pi
  starts, so the child's start load and its new session are its only loads.
- **D-BG-1602:** "the next parent load still shows the change as pending" is
  proven by a Pi without the child marker whose load, with autoapply still on,
  applies all three changes. A parent load with autoapply on acts on a pending
  change by applying it, so the applied changes are what shows that the child
  left them pending. The parent is a one-shot Pi in json mode
  (`the user runs "/claude:plugin list" in pi's json mode`, D-BG-09): it runs
  in the same sandbox with no `PI_SUBAGENT_CHILD`, and its step names no MCP
  word, so the scenario needs no implementation tag. Its outcome is checked
  through its results (whatever payloads json mode records, the load's
  included) and through `the installation record of the project scope holds
  these plugins:`. Rejected: restarting through the launch-environment child
  step of `mcp-server/agent-grants.steps.ts` (its restart steps name
  pi-mcp-adapter or mcp, which would turn a non-MCP scenario into an MCP one),
  and turning autoapply off between the two loads (a `Given` after a `When`).
- The seed "A background child's load leaves a declared plugin pending while
  autoapply is on" is rewritten into this scenario, which keeps every step it
  used in use (`pi runs with the scripted model as a pi-subagents background
  child` above all). `mcp-server/agent-grants.feature` keeps its own
  install-nothing scenario (MGRT-02); it is unowned and left alone.

### CHILD-02: the legacy move and the agent grants (D-BG-1603, D-BG-1604)
- **D-BG-1603:** one new scenario: a user-scope plugin with an MCP server,
  `mcp.json` rewritten as release 0.19.2 wrote it beside the user's own server
  (the Phase 9 shared step), then the child Pi and a new session. The child
  moves nothing: no `mcp-migration` result, and both `mcp.json` and
  `mcp-adapter.json` hold the text they held before. Then a parent one-shot
  json-mode run moves the entries, as Phase 9's seed shows a parent load does,
  so the scenario proves the child left a move that a parent makes. The child
  runs Pi's built-in MCP under both profiles (its step loads no companion), so
  the scenario chooses its own implementation and carries
  `@own-implementation` (runs once, under the adapter profile).
- **D-BG-1604:** the grant half of criterion 2 is already pinned by the
  unowned scenario "A pi-subagents background child leaves an agent's grant in
  the form it holds (MGRT-02)" in `features/mcp-server/agent-grants.feature`.
  The phase does not duplicate it in its own file; it re-runs that scenario's
  red proof (the child gate removed from `agentGrantsStep` makes it fail) and
  records it in the plan SUMMARY, and the verification cites it for
  criterion 2.

### CHILD-02: the child still loads the components (D-BG-1605)
- Skills and slash commands: one scenario with a project-scope plugin that has
  a skill and a slash command, installed through the shared Pi; the child's
  new session reports no results, offers the skill (`the session offers these
  skills:`), and lists the command (`the user lists the slash commands pi
  offers` / `pi offers these slash commands from prompt templates:`). Two
  `When` steps are acceptable here: the session and the registry listing are
  two reads of one behavior.
- **D-BG-1605:** "its hooks run" is proven with a `PreToolUse` hook on a tool
  call that the child's scripted model makes (`the hooks record these runs:`),
  in a scenario of its own. Upstream evidence (code.claude.com/docs/en/hooks,
  read 2026-11-08): "Hooks from settings files, managed policy settings, and
  plugins also run inside subagents. When a subagent calls a tool, tool events
  such as `PreToolUse` and `PostToolUse` fire the same configured hooks as in
  the main conversation". The docs say nothing about `SessionStart` in a
  subagent (a subagent's start is `SubagentStart`, which Pi cannot fire), so
  no scenario pins a `SessionStart` run in a child.
- The hooks table selects only the columns the tool-use scenarios already
  pin; it does not select `agent_id` or `agent_type`, which upstream adds
  inside a subagent and this extension cannot know (see Deferred).

### Red proofs and gates
- Every new or rewritten scenario fails without the behavior it names, shown
  by a temporary, uncommitted mutation: the autoapply skip (the child branch
  of `createLoadReconcile` falls through to `loadReconcileWithReader`), the
  move skip (`NO_MCP_MOVE` replaced by the default move), the grants skip
  (the `isSubagentChild` return removed), and, for the component scenarios, a
  child load that discovers nothing and routes no hook. Each plan SUMMARY
  records the mutation, the failing run, and the passing run.
- No product change is expected. If a scenario exposes a bug in an owned file,
  the fix lands with a unit test in the paired test file; a bug elsewhere is a
  parent line and a dubious choice.

### Claude's Discretion
- Plan split and wave count. The scenarios share one feature file, so plans
  that edit it cannot share a wave; fewer waves mean fewer full gates on a
  machine shared with fourteen other phases.
- Plugin, skill, command, and hook names, and the exact tables, once observed.
- Whether a new verb step module is needed at all (none is expected).

### Deferred Ideas (OUT OF SCOPE)
- Hook input inside a child lacks upstream's `agent_id` and `agent_type`:
  pi-subagents runs several children in one runner process and gives the
  extension no per-child identity, so this is a Pi capability gap for now.
  It belongs to the hook phases, not here (P16-DC-03).
- Whether `SessionStart` hooks should run in a child: upstream documents no
  `SessionStart` for subagents and Pi has no `SubagentStart`. The extension
  runs them today; left unpinned (P16-DC-03).
- Byte-level proof that a child leaves `state.json` untouched (the record step
  compares id, version, and enabled only).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CHILD-01 | A load in a pi-subagents background child, with `autoapply` on and a pending change, installs, uninstalls, and updates nothing. | Scenario A (rewritten seed), observed green; red under mutation M1 (child falls through to the autoapply load). |
| CHILD-02 | A load in a background child moves no legacy `mcp.json` entry and rewrites no agent grant, yet still loads the installed components. | Scenario B (legacy move, `@own-implementation`), red under M2. Grant: existing `agent-grants.feature:533`, red under M3. Components: scenario C (skill + slash command), red under M4; scenario D (PreToolUse), red under M4+M5 but NOT under M4 alone. |
</phase_requirements>

## Project Constraints (from CLAUDE.md / AGENTS.md)

- Never commit to `main`; commit only to `features/behavioral-gaps-phase-16`; no rebase, no `--amend`, no `--no-verify`, no `git add -A`, no bare `git stash`.
- A user-visible `/claude:plugin` behavior ships with a cucumber scenario that fails without the change (Behavioral tests). Every scenario here needs a recorded red proof.
- `npm run check` is the gate for wave, phase, and handoff. `check:commit` (pre-commit hook) is not a full verdict. Never pipe a gate into `tail`/`head`/`grep`; write output and exit code to files. One Bash call is capped at 10 minutes, so run `npm run check` in the background.
- Every plan `SUMMARY.md` includes `## Threat Flags` (even "None") and `## Dubious Choices`.
- WINDOWS descriptions are prefixed `[behavioral-gaps]`.
- Frozen (child-session rules): `features/support/**`, `features/lib/**`, every existing step module, `cucumber.json`, `scripts/check-features.mjs`, `.agents/skills/cucumber/**`, `platform/pi-api.ts`, build/CI files. Phase 16 owns only `features/plugin/subagent-child.feature`, a new `features/step_definitions/plugin/subagent-child.steps.ts` (not needed), and the child gates plus their unit pairs.
- Never edit `CHANGELOG.md`, `README*.md`, `.planning/PROJECT.md` Key Decisions, `.planning/BACKLOG.md`, or the root `.planning/DUBIOUS-CHOICES.md`; put lines for them under "Parent lines".
- Hermetic home: every cucumber and node test run already gets a temporary Pi home. No run in this session changed the real `~/.pi`. I checked with `find ~/.pi -newer <stamp>`, which found nothing.
- Feature-file rules (`.agents/skills/cucumber/rules/features.md`): `Given`/`When`/`Then` only, no `And`; no `Given` after a `When`; whole tables; whole literals; an MCP scenario carries exactly one implementation tag; a non-MCP scenario carries none.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Child detection (`PI_SUBAGENT_CHILD=1`) | platform (`platform/subagent-child.ts`) | -- | The one reader of the marker. |
| Skip autoapply and AMIG-01 move in a child | orchestrators (`reconcile/load.ts` child branch) | read-pass (`read-pass.ts:443` default move) | The load step chooses which passes run. |
| Skip the grants rewrite in a child | orchestrators (`mcp/agent-grants-step.ts:81`) | -- | Session-start step. |
| Skills/commands discovery in a child | entry (`index.ts` `resources_discover`) | orchestrators (`discover.ts`) | Ungated; must keep running. |
| Hooks in a child | bridges (`hooks/event-router.ts` via `index.ts:153`) | -- | Registered at factory time; ungated. |
| Behavioral proof | `features/plugin/subagent-child.feature` | `features/mcp-server/agent-grants.feature:533` (unowned, re-run only) | Test tier only. |

## Standard Stack

No new packages. The phase uses only the existing harness.

| Tool | Version | Purpose |
|------|---------|---------|
| `@cucumber/cucumber` | repo-pinned (unchanged) | runner, profiles `adapter`/`builtin` [VERIFIED: cucumber.json] |
| Pi | 1.5.0 (child-session rules) | host process for the profile, shared, and one-shot Pis |
| Node | v26.13.0 locally [VERIFIED: `node --version`] | runtime |
| pi-subagents peer | in `node_modules/.cache/optional-peers` | only the MGRT-02 grant scenario loads it |

## Package Legitimacy Audit

No external package is installed by this phase.

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| (none) | -- | -- | -- | -- | -- | -- |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### How a scenario exercises the child

```text
Given steps (run's shared Pi, no marker)
  publish dir marketplace -> add marketplace -> /claude:plugin install ... (records state, stages files)
  [CHILD-01 only: rewrite offered versions, rewrite declared plugins]
  [legacy move only: rewrite mcp.json as release 0.19.2 wrote it]
        |
        v
Given "pi runs with the scripted model as a pi-subagents background child"
  profile Pi spawned with PI_SUBAGENT_CHILD=1, no companion
  -> factory: hooks bridge registers (index.ts:153), user-scope hooks hydrate
  -> start load (resources_discover): child branch = readOnlyPass + NO_MCP_MOVE
  -> session_start: built-in registration step; agent grants step returns early
        |
        v
When "the user starts a new pi session" | "the user prompts ..." | "lists the slash commands"
  second load (child again) -> results / skills / registry snapshot / hook recorder
        |
        v
[CHILD-01, legacy move] When "the user runs \"/claude:plugin list\" in pi's json mode"
  one-shot Pi, same sandbox, NO marker -> its load applies / moves -> list payload only
        |
        v
Then: session results, skills, slash commands, hook runs, model calls,
      installation record, mcp.json / mcp-adapter.json text
```

### Recommended file shape

```
features/plugin/subagent-child.feature    # 4 scenarios: A (CHILD-01), B (legacy move, @own-implementation), C (skill + command), D (PreToolUse)
features/mcp-server/agent-grants.feature  # unowned; NOT edited; its MGRT-02 grant scenario's red proof is re-run
```

No new step module.

### Plan split (Claude's discretion): recommend ONE plan, ONE wave

All four scenarios edit one file, so plans that edit it cannot share a wave. A single
plan with four tasks needs one wave gate (`npm run check`) plus the phase gate. Two
plans (CHILD-01 / CHILD-02) would need two sequential waves and one more full gate
on a loaded machine, with no gain in parallelism. Suggested tasks:
1. Rewrite the seed into scenario A; red proof M1.
2. Add scenario B; red proof M2.
3. Add scenarios C and D; red proofs M4 (C) and M4+M5 (D).
4. Re-run the MGRT-02 grant scenario's red proof (M3); run `check:features`; record everything in SUMMARY.

### Anti-Patterns to Avoid
- **Relying on `the session reports no results` for the move proof.** A child that moves does it at the start load, before the new session. Under M2, that step passed and only the file text failed [VERIFIED: mutant run m2].
- **Asserting the parent's load payloads in json mode.** The one-shot Pi records only the command's payload. `the command reports these results:` shows one `Plugin list` row, and the load's `reconcile-applied` or `mcp-migration` notice is not in it [VERIFIED: probe runs 3 and 4 passed with a single row]. The cause is [ASSUMED]: Pi's json mode likely prints entries only after the load's notifications have gone out.
- **Calling the PreToolUse scenario a proof of the load's hook routing.** It proves "hooks run in a child". The hook routes even when the child's `resources_discover` does nothing (M4 left it green) [VERIFIED: mutant run m4].
- **Adding `@mcp` to scenario B.** The child step loads no companion, so a second profile run would repeat the same built-in child. Keep `@own-implementation` (D-BG-1603); `check:features` accepted it [VERIFIED: check:features run].

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| A child Pi | a new launch step | `pi runs with the scripted model as a pi-subagents background child` (`companion.steps.ts:82`) | sets `PI_SUBAGENT_CHILD=1` in the spawn env, no companion |
| A parent load after the child | a restart step | `the user runs {string} in pi's json mode` (`command.steps.ts:132`) | one-shot Pi, same sandbox, no marker; names no MCP word |
| A release 0.19.2 `mcp.json` | hand-written JSON | `the mcp.json file of the {word} scope holds the servers of the plugin {string} as release 0.19.2 wrote them, beside the user's own server {string}` (`mcp-configuration.steps.ts:119`) | it reads the record's plugin root and empties the plugin's entries in `mcp-adapter.json` |
| A slash command in the plugin | a file writer | `the published plugin {string} of the marketplace {string} has the slash command {string} described as {string} with this body:` (`slash-command/listing.steps.ts:20`) | the default offered plugin has a skill only, no command [VERIFIED: features/lib/path-marketplace.ts:89-110] |
| Mutating the product for red proofs | in-place edits to tracked files | an untracked scratch copy (see Red proofs) | proven this session; never dirties the worktree that pre-commit and other tasks read |

## Runtime State Inventory

Not a rename/refactor phase -- omitted.

## Common Pitfalls

### Pitfall 1: config text written after the marketplace add
**What goes wrong:** `a config in scope project and layer base, with this text:` replaces the whole base config, and that removes the marketplace declaration the add wrote. Every row then comes back `dangling reference`.
**How to avoid:** Write `{ "autoapply": true }` BEFORE `the marketplace "fixtures" is added to the project scope`, as the seed does (orchestrator probe; confirmed in my probe 4).

### Pitfall 2: the second `offers these plugins:` table replaces the whole catalog
**What goes wrong:** If you list only `upd 1.1.0`, demo and old leave the catalog.
**How to avoid:** Restate all three rows: demo 1.0.0, old 1.0.0, upd 1.1.0 (probe 4 passed this way).

### Pitfall 3: install steps after the child step run IN the child
**What goes wrong:** After the child step, `this.pi` is the child. An install there is a command, not a load, so it still works. But the child then has an extra state change, and the scenario's point blurs.
**How to avoid:** Run every `the user has run "/claude:plugin install ..."` before `pi runs ... as a pi-subagents background child`.

### Pitfall 4: in-place mutation left behind
**What goes wrong:** A red-proof edit to `load.ts` or `index.ts` survives into a commit, or the pre-commit stash of a concurrent task picks it up.
**How to avoid:** Mutate a scratch copy (Code Examples, "Red proof runner"). If the executor mutates in place anyway, it runs `git restore <file>` and then `git diff --exit-code -- extensions/` before it moves on.

### Pitfall 5: two `When` steps
`check:features` accepts `When`/`Then`/`When`/`Then` [VERIFIED: check:features run]. features.md says a second `When` "usually hides a second behavior". D-BG-1602/1603/1605 accept it for the parent check and for the registry listing. Keep each second `When` to a read of the same behavior.

## Code Examples

All four scenarios below passed verbatim (apart from the probe titles) under
`npx cucumber-js --profile adapter --parallel 2 --format progress <probe file>` on the
unchanged tree [VERIFIED: probe run, 4 scenarios / 67 steps passed, 0m 28.9 s].
The titles here are suggestions. Rewrite the feature description to cover the
json-mode parent, the scripted model, and the hook recorder (2-3 lines).

### Scenario A -- CHILD-01 (rewrites the seed)

```gherkin
  Scenario: A background child's load with autoapply on leaves a pending install, uninstall, and update for the next parent load
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
      | old  | 1.0.0   |
      | upd  | 1.0.0   |
    Given a config in scope project and layer base, with this text:
      """
      { "autoapply": true }
      """
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install old@fixtures --scope project"
    Given the user has run "/claude:plugin install upd@fixtures --scope project"
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
      | old  | 1.0.0   |
      | upd  | 1.1.0   |
    Given a config in scope project and layer base, with these plugins:
      | marketplace | plugin | enabled |
      | fixtures    | demo   |         |
      | fixtures    | upd    |         |
    Given pi runs with the scripted model as a pi-subagents background child
    When the user starts a new pi session
    Then the session reports these results:
      | kind    | severity | needs reload | needs apply | tally label       | tally failures | tally warnings | tally success count |
      | cascade | info     | false        | true        | Reconcile pending | 0              | 0              | 3                   |
      | cascade | info     | false        | true        | Reconcile pending | 0              | 0              | 3                   |
    Then the results list these marketplaces and plugins:
      | marketplace name | marketplace scope | id            | name | status         | reasons | scope   | version | from  | to    |
      | fixtures         | project           | demo@fixtures | demo | will install   |         | project |         |       |       |
      | fixtures         | project           | old@fixtures  | old  | will uninstall |         | project | 1.0.0   |       |       |
      | fixtures         | project           | upd@fixtures  | upd  | will update    |         | project |         | 1.0.0 | 1.1.0 |
      | fixtures         | project           | demo@fixtures | demo | will install   |         | project |         |       |       |
      | fixtures         | project           | old@fixtures  | old  | will uninstall |         | project | 1.0.0   |       |       |
      | fixtures         | project           | upd@fixtures  | upd  | will update    |         | project |         | 1.0.0 | 1.1.0 |
    Then the installation record of the project scope holds these plugins:
      | id           | version | enabled |
      | old@fixtures | 1.0.0   | true    |
      | upd@fixtures | 1.0.0   | true    |
    When the user runs "/claude:plugin list" in pi's json mode
    Then the command reports these results:
      | kind    | severity | needs reload | tally label | tally failures | tally warnings | tally success count |
      | cascade | info     | false        | Plugin list | 0              | 0              | 3                   |
    Then the results list these marketplaces and plugins:
      | marketplace name | marketplace scope | id            | name | status    | reasons | scope   | version |
      | fixtures         | project           | demo@fixtures | demo | installed |         | project | 1.0.0   |
      | fixtures         | project           | old@fixtures  | old  | available |         |         | 1.0.0   |
      | fixtures         | project           | upd@fixtures  | upd  | installed |         | project | 1.1.0   |
    Then the installation record of the project scope holds these plugins:
      | id            | version | enabled |
      | demo@fixtures | 1.0.0   | true    |
      | upd@fixtures  | 1.1.0   | true    |
```

The rewrite keeps every step the seed used: `the installation record of the project
scope holds no plugins` stays used elsewhere (`install-rollback.feature:82`,
`import.feature`), and `pi runs with the scripted model as a pi-subagents background
child` is used by all four new scenarios [VERIFIED: grep of features/**/*.feature].

### Scenario B -- CHILD-02 legacy move (`@own-implementation`)

```gherkin
  @own-implementation
  Scenario: A background child's load leaves a release 0.19.2 mcp.json for the next parent load to move
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" declares the mcp server "srv"
    Given the marketplace "fixtures" is added to the user scope
    Given the user has run "/claude:plugin install demo@fixtures --scope user", which did not fail
    Given the mcp.json file of the user scope holds the servers of the plugin "demo@fixtures" as release 0.19.2 wrote them, beside the user's own server "mine"
    Given pi runs with the scripted model as a pi-subagents background child
    When the user starts a new pi session
    Then the session reports no results
    Then the mcp configuration file "mcp.json" of the user scope holds this text:
      """
      {
        "mcpServers": {
          "mine": {
            "command": "pi-features-users-own-mcp-server"
          },
          "srv": {
            "command": "pi-features-absent-mcp-server",
            "args": [],
            "env": {
              "CLAUDE_PLUGIN_ROOT": "{home}/marketplaces/fixtures/plugins/demo",
              "CLAUDE_PLUGIN_DATA": "{agent dir}/pi-claude-marketplace/data/fixtures/demo"
            },
            "_piClaudeMarketplace": {
              "plugin": "demo",
              "marketplace": "fixtures"
            }
          }
        }
      }

      """
    Then the mcp configuration file "mcp-adapter.json" of the user scope holds this text:
      """
      {
        "mcpServers": {}
      }

      """
    When the user runs "/claude:plugin list" in pi's json mode
    Then the command reports these results:
      | kind    | severity | needs reload | tally label | tally failures | tally warnings | tally success count |
      | cascade | info     | false        | Plugin list | 0              | 0              | 1                   |
    Then the results list these marketplaces and plugins:
      | marketplace name | marketplace scope | id            | name | status    | reasons | scope | version |
      | fixtures         | user              | demo@fixtures | demo | installed |         | user  | 1.0.0   |
    Then the mcp configuration file "mcp.json" of the user scope holds this text:
      """
      {
        "mcpServers": {
          "mine": {
            "command": "pi-features-users-own-mcp-server"
          }
        }
      }

      """
    Then the mcp configuration file "mcp-adapter.json" of the user scope holds this text:
      """
      {
        "mcpServers": {
          "plugin_demo_srv_": {
            "command": "pi-features-absent-mcp-server",
            "args": [],
            "env": {
              "CLAUDE_PLUGIN_ROOT": "{home}/marketplaces/fixtures/plugins/demo",
              "CLAUDE_PLUGIN_DATA": "{agent dir}/pi-claude-marketplace/data/fixtures/demo"
            },
            "directTools": "search",
            "toolPrefix": "mcp",
            "_piClaudeMarketplace": {
              "plugin": "demo",
              "marketplace": "fixtures"
            }
          }
        }
      }

      """
```

The texts: `mcp.json` before the parent is exactly the legacy writer's output (`mine` first, then `srv` with the injected env and the marker) [VERIFIED: features/lib/mcp-configuration.ts:150-205, `writeJsonFile` = `JSON.stringify(doc, null, 2)` + `"\n"`]. `mcp-adapter.json` before the parent is `{"mcpServers": {}}`, because the legacy writer filtered out the plugin's marked entries. Both texts after the parent are identical to `features/mcp-server/legacy-move.feature`'s post-load texts. The `{agent dir}` and `{home}` tokens project as in that file.

### Scenario C -- CHILD-02 skills and slash commands (no tag)

```gherkin
  Scenario: A background child offers the skill and the slash command of an installed plugin
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the slash command "greet" described as "Greets a person by name." with this body:
      """
      Greet the person named in the arguments.
      """
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given pi runs with the scripted model as a pi-subagents background child
    When the user starts a new pi session
    Then the session reports no results
    Then the session offers these skills:
      | command           | description            |
      | /skill:demo-skill | A skill of demo 1.0.0. |
    When the user lists the slash commands pi offers
    Then pi offers these slash commands from prompt templates:
      | command     | description              |
      | /demo:greet | Greets a person by name. |
```

### Scenario D -- CHILD-02 hooks run (no tag)

```gherkin
  Scenario: A background child runs an installed plugin's PreToolUse hook on a tool call its model makes
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has these hooks, each recording its runs:
      | name       | event      | matcher |
      | bash-guard | PreToolUse | Bash    |
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given pi runs with the scripted model as a pi-subagents background child
    Given the scripted model plays these steps:
      | reply | tool | arguments                      |
      |       | bash | {"command": "echo from-model"} |
      | Done. |      |                                |
    When the user prompts "run the echo"
    Then the hooks record these runs:
      | event      | session | tool name | tool input                    | cwd           | transcript path | arguments  | CLAUDE_PROJECT_DIR | CLAUDE_PLUGIN_ROOT                        | CLAUDE_PLUGIN_DATA                                         | CLAUDE_CODE_SESSION_ID | CLAUDE_SESSION_ID | CLAUDECODE |
      | PreToolUse | first   | Bash      | {"command":"echo from-model"} | {project dir} |                 | bash-guard | {project dir}      | {home}/marketplaces/fixtures/plugins/demo | {project dir}/.pi/pi-claude-marketplace/data/fixtures/demo | first                  | first             | 1          |
    Then the model receives these calls:
      | call | role        | text                                         |
      | 1    | user        | run the echo                                 |
      | 2    | user        | run the echo                                 |
      | 2    | assistant   | tool call bash {"command":"echo from-model"} |
      | 2    | tool result | bash returned: from-model\n                  |
```

What a child's first prompt records: exactly one hook run (`PreToolUse`, session
`first`, the same 13 columns that `hook/tool-use.feature` pins, with no `agent_id` or
`agent_type` column), and two model calls with the bash tool result. No new session
is needed before the prompt: the child's start load already routed the project hook.
`the hooks record these runs:` fails on a column that the table leaves out
(`recordTable` appends unstated columns, `runs.steps.ts:131-137`), so an `agent_id`
the extension started to send would surface there.

### Red proof runner (proven this session)

Copy the tree to an untracked directory, mutate the copy, and run the scenario there.
Use a script file (a one-line compound command with a `|` regex was refused by the
worktree guard):

```bash
# setup (once): copy, then symlink node_modules (the optional-peers cache comes with it)
M=<scratchpad>/phase16/<unique>-mutant
mkdir -p "$M"
cp -r extensions features test scripts package.json cucumber.json tsconfig.json "$M"/
ln -s "$PWD/node_modules" "$M/node_modules"
# per mutation: edit "$M/extensions/...", then from "$M":
npx cucumber-js --profile adapter --parallel 2 --format progress --name "<title regex>" features/plugin/subagent-child.feature > <out file> 2>&1; echo $? > <exit file>
# restore: cp the original file back from the worktree; rm -rf "$M" at the end
```

`test/e2e/_rpc.ts:33-34` derives the extension entry from its own location
(`REPO_ROOT = fileURLToPath(new URL("../..", import.meta.url))`), so the copy runs
the copy's extension [VERIFIED: test/e2e/_rpc.ts:33-34].

### The five mutations and what each run showed

| ID | File:line (worktree) | Replace | With | Scenario | Observed failure |
|----|----|----|----|----|----|
| M1 | `orchestrators/reconcile/load.ts:245` | `await readOnlyPass(reader, SCOPES, { ...opts, migrateMcpEntries: NO_MCP_MOVE });` | `await loadReconcileWithReader(reader, applyReconcile, { ...opts, migrateMcpEntries: NO_MCP_MOVE });` | A | `Then the session reports these results:` actual `[[]]` (no results): the start load applied all three, so the new session's load had nothing pending. Scenario B stayed green. [VERIFIED: run m1, exit 1, 30 s] |
| M2 | `orchestrators/reconcile/load.ts:245` | `{ ...opts, migrateMcpEntries: NO_MCP_MOVE }` | `opts` | B | `the session reports no results` PASSED; the first `mcp.json` text check failed (actual holds `mine` only; `srv` was moved). Scenario A stayed green. [VERIFIED: run m2, exit 1, 28 s] |
| M3 | `orchestrators/mcp/agent-grants-step.ts:81` | `if (isSubagentChild(env) \|\| active === "none") {` | `if (active === "none") {` | `agent-grants.feature:533` (MGRT-02 grant) | `Then the model receives these calls:` tool result shows `tools mcp:plugin_demo_stub/echo` (built-in form) instead of `tools mcp:plugin_demo_stub_/echo`. [VERIFIED: run m3, exit 1, 32 s] |
| M4 | `index.ts:224` (top of the `resources_discover` handler, before `try { await prepareResources(event, ctx);`) | -- | insert `if (process.env.PI_SUBAGENT_CHILD === "1") { return { skillPaths: [], promptPaths: [] }; }` | C | `Then the session offers these skills:` actual header only (no skill); the listing step was skipped. Scenario D stayed GREEN under M4 alone. [VERIFIED: run m4, exit 1, 44 s] |
| M5 | `index.ts:153` | `await hooksHydration.registerHooksBridge(pi, { cwd: homedir() });` | wrap in `if (process.env.PI_SUBAGENT_CHILD !== "1") { ... }` | D (run with M4+M5) | `Then the hooks record these runs:` actual `[[]]` (no run). C still failed as under M4. [VERIFIED: run m46, exit 1, 31 s] |

M4+M5 together is the CONTEXT's "a child load that discovers nothing and routes no
hook". The red proof for D needs M5. M4 alone leaves D green, because the hooks
bridge registers at factory time (`index.ts:153`), and its own `session_start`
wrapper hydrates the project scope (comment at `index.ts:139-148`).

Verbatim sources of the mutated lines (read this session):
- `load.ts:244-247` [VERIFIED]:
  ```ts
      if (isSubagentChild(env)) {
        await readOnlyPass(reader, SCOPES, { ...opts, migrateMcpEntries: NO_MCP_MOVE });
        return;
      }
  ```
- `load.ts:106` [VERIFIED]: `const NO_MCP_MOVE: McpMigrationStep = () => Promise.resolve();`
- `read-pass.ts:443` [VERIFIED]: `await (migrateMcpEntries ?? migrateLegacyMcpEntries)(step);` (why `opts` without the override runs the real move)
- `agent-grants-step.ts:81` [VERIFIED]: `if (isSubagentChild(env) || active === "none") {`
- `index.ts:153` [VERIFIED]: `await hooksHydration.registerHooksBridge(pi, { cwd: homedir() });`
- `index.ts:224-226` [VERIFIED]: `// D-05-01/02: initialization and live mode guards cannot block read-only discovery.` / `try {` / `await prepareResources(event, ctx);`
- `platform/subagent-child.ts` [VERIFIED]: `const SUBAGENT_CHILD_VARIABLE = "PI_SUBAGENT_CHILD";` and `return env[SUBAGENT_CHILD_VARIABLE] === "1";`

## State of the Art

| Old | Current | Impact |
|-----|---------|--------|
| Seed scenario: one pending install, record holds no plugins | Scenario A: install + uninstall + update pending, then a parent applies all three | Covers all three CHILD-01 change kinds and the "next parent load" criterion |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The json-mode one-shot leaves out the load's payloads because Pi prints entries only after the load's notifications went out | Anti-Patterns | None for the plan: the effect (only the command's row) is verified. Only the explanation is assumed. |
| A2 | The per-scenario runtime under full machine load stays in the 10-60 s range | Validation | A gate under heavier load may need the one rerun the child-session rules allow. |

## Open Questions

1. **D-BG-1602's wording "whatever payloads json mode records, the load's included"**
   - What we know: json mode records only the command's payload (one `Plugin list` row).
   - What's unclear: nothing about behavior. The CONTEXT expected the load's payloads might show.
   - Recommendation: Assert the single command row and prove the apply by the list rows and the record, as in scenario A. Record it as a dubious choice only if the planner wants the reader to know the load's cascade is unobserved.
2. **Who did the move in scenario B under the adapter profile?**
   - What we know: the one-shot parent loads no companion, so it runs Pi's built-in MCP. Its load still writes `mcp-adapter.json`, the same text that `legacy-move.feature` (`@mcp`) expects under both profiles.
   - Recommendation: none needed. The scenario is `@own-implementation` and runs once.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node | all | yes | v26.13.0 | -- |
| Pi | profile, shared, one-shot Pis | yes | 1.5.0 | -- |
| optional peers (pi-subagents for the MGRT-02 grant run) | M3 re-run | yes | `node_modules/.cache/optional-peers` | -- |
| `/tmp` inodes | cucumber sandboxes | yes | 5% used (44,924 / 1,048,576) at 09:24 | report ENOSPC per rules |

Machine load at research time: load average 8-12 on 28 cores.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | `@cucumber/cucumber` (behavioral) + `node:test` (existing unit pairs) |
| Config file | `cucumber.json` (frozen); profiles `adapter` (default) and `builtin` |
| Quick run command | `npx cucumber-js --profile adapter --parallel 2 --format progress features/plugin/subagent-child.feature` (4 scenarios ~30-45 s wall on the loaded machine) |
| Grant scenario | `npx cucumber-js --profile adapter --format progress --name "leaves an agent's grant in the form it holds" features/mcp-server/agent-grants.feature` (~30 s) |
| Feature gate | `npm run check:features` (~10 s) |
| Full suite command | `npm run check` (run in the background; write the output and the exit code to files; never pipe) |

Profile coverage: every scenario in `subagent-child.feature` (A, C, and D untagged; B
`@own-implementation`) runs once, under `adapter`. The `builtin` profile selects
none of them (`(@mcp or @builtin-only) and not @adapter-only`) [VERIFIED: cucumber.json].
The MGRT-02 grant scenario is `@own-implementation` too, so it also runs under
`adapter` only.

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CHILD-01 | child load with autoapply on changes nothing; the next parent load applies the three pending changes | behavioral | `npx cucumber-js --profile adapter --name "autoapply on leaves a pending install" features/plugin/subagent-child.feature` | file yes (seed); scenario to be rewritten |
| CHILD-01 | autoapply apply step skipped in a child | unit | `node --import "$PWD/test/platform/isolated-pi-home.ts" --test test/orchestrators/reconcile/load.test.ts` (case at line 915) | yes |
| CHILD-02 | child moves no legacy `mcp.json` entry; the parent then moves it | behavioral | `npx cucumber-js --profile adapter --name "release 0.19.2 mcp.json" features/plugin/subagent-child.feature` | to add |
| CHILD-02 | AMIG-01 move skipped in a child | unit | same `load.test.ts` (case at line 932) | yes |
| CHILD-02 | child rewrites no agent grant | behavioral | grant scenario command above (`agent-grants.feature:533`) | yes (unowned; re-run only) |
| CHILD-02 | grants step returns early in a child | unit | `node --import "$PWD/test/platform/isolated-pi-home.ts" --test test/orchestrators/mcp/agent-grants-step.test.ts` (case at line 100) | yes |
| CHILD-02 | child offers the skill and the slash command | behavioral | `npx cucumber-js --profile adapter --name "offers the skill and the slash command" features/plugin/subagent-child.feature` | to add |
| CHILD-02 | child runs a PreToolUse hook | behavioral | `npx cucumber-js --profile adapter --name "PreToolUse hook" features/plugin/subagent-child.feature` | to add |
| (marker) | `isSubagentChild` reads `"1"` only | unit | `node --import "$PWD/test/platform/isolated-pi-home.ts" --test test/platform/subagent-child.test.ts` | yes |

### Sampling Rate
- **Per task commit:** the quick run on `subagent-child.feature`. Every file under `features/` is a build input (`.pre-commit-config.yaml` npm-check `files:` matches `(extensions|features|rule-packs|test|\.github/workflows)/.*`) [VERIFIED: .pre-commit-config.yaml:112]. So each commit of the feature file runs `npm run check:commit`, which includes `check:features` but no cucumber scenario.
- **Per wave merge:** `npm run check` (one wave if one plan).
- **Phase gate:** `npm run check` green on the phase head before `/gsd-verify-work`. Under load, a timeout gets one rerun, and both runs are recorded.

### Wave 0 Gaps
None. The existing test infrastructure covers every requirement. No new step module, fixture, or support file.

## Security Domain

`security_enforcement` is absent from `.planning/config.json`, so it is enabled. The phase adds only test scenarios. It adds no product code, input surface, network path, or dependency.

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | -- |
| V3 Session Management | no | -- |
| V4 Access Control | no | -- |
| V5 Input Validation | no | -- |
| V6 Cryptography | no | -- |

| Pattern | STRIDE | Mitigation |
|---------|--------|------------|
| A test run writes the developer's real `~/.pi` | Tampering | Hermetic Pi home in every cucumber run (`features/support/isolated-pi-home.ts`). This session's runs left `~/.pi` unchanged. |
| A red-proof mutation is committed | Tampering | Mutate an untracked scratch copy, or `git restore` plus `git diff --exit-code -- extensions/` before the next step. |

Threat Flags for the SUMMARY: "None -- no security-relevant surface outside the plan's `<threat_model>` was introduced."

## Sources

### Primary (HIGH confidence -- read or run this session)
- `features/plugin/subagent-child.feature` (seed), `features/mcp-server/legacy-move.feature`, `features/hook/tool-use.feature:9-34`, `features/slash-command/listing.feature:7-23`, `features/mcp-server/agent-grants.feature:532-555`, `features/plugin/pending.feature:85-103`
- Step modules: `companion.steps.ts:78-93`, `session.steps.ts` (whole), `command.steps.ts:91-150`, `model.steps.ts:51-105`, `hook/runs.steps.ts:1-165`, `mcp-configuration.steps.ts:116-147`
- Harness: `features/support/world.ts:134-160, 677-695, 1068-1115`, `features/lib/pi-json-mode.ts`, `features/lib/mcp-configuration.ts:39-205`, `features/lib/path-marketplace.ts:89-110`, `test/e2e/_rpc.ts:33-34`
- Product: `platform/subagent-child.ts`, `orchestrators/reconcile/load.ts:20-60, 95-250`, `read-pass.ts:443, 596-607`, `orchestrators/mcp/agent-grants-step.ts:28-87`, `index.ts:105-250`
- Rules: `.agents/skills/cucumber/SKILL.md`, `rules/features.md`, `rules/steps.md`, `rules/layout.md` (Behavioral gaps), `.agents/skills/local-verification/SKILL.md` + `rules/commands.md` + `rules/gates.md`
- Runs: probe (4 scenarios green, 28.9 s); mutants m1, m2, m3, m4, m46 (each exit 1 as tabled); `npm run check:features` (one finding: the probe title only). The probe file and the scratch copy were deleted. A copy of the probe file is at `/tmp/claude-1000/-home-acolomba-pi-claude-marketplace/45e74ef7-b24a-4893-854b-b4c04365a440/scratchpad/phase16/researcher-probe.feature.txt`.

### Secondary
- Upstream hooks-in-subagents quote: from CONTEXT.md (orchestrator read code.claude.com/docs/en/hooks on 2026-11-08); not re-fetched here.

## Metadata

**Confidence breakdown:**
- Scenario text and tables: HIGH -- passed verbatim on the unchanged tree.
- Red proofs: HIGH -- each mutation was run and its failure read.
- Runtime numbers: MEDIUM -- one run each on a machine shared with other phases.

**Research date:** 2026-11-08
**Valid until:** 2026-12-08, or until a merge from `features/behavioral-gaps` changes the shared steps or the load path.
