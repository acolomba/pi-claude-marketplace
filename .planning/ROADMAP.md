# Roadmap: pi-claude-marketplace

## Milestones

- **behavioral-gaps** Behavioral Coverage Gaps — in progress on branch `features/behavioral-gaps`, started 2026-11-07; 16 phases, 34 requirements.
- ✅ **mcp-builtin** MCP Built-in — completed 2026-11-05 on branch `features/mcp-builtin` (PR [#303](https://github.com/acolomba/pi-claude-marketplace/pull/303), version 0.23.0, not yet merged; user review done 2026-11-06, review fixes merged); 6 phases, 55 plans, 31/31 requirements. [Archive](milestones/mcp-builtin-ROADMAP.md), [requirements](milestones/mcp-builtin-REQUIREMENTS.md), [audit](milestones/mcp-builtin-MILESTONE-AUDIT.md).
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
<summary>✅ mcp-builtin — MCP Built-in — SHIPPED 2026-11-05</summary>

- [x] Phase 1: Foundation and Pi 1.5.0 (14/14 plans) — completed 2026-11-04
- [x] Phase 2: Built-in Materialization (9/9 plans) — completed 2026-11-04
- [x] Phase 3: Read-Time Verdicts (9/9 plans) — completed 2026-11-04
- [x] Phase 4: Agent Grants (6/6 plans) — completed 2026-11-04
- [x] Phase 5: Hook Tool Names (4/4 plans) — completed 2026-11-04
- [x] Phase 6: Release Docs and Combined Tree (13/13 plans) — completed 2026-11-05

**Outcome:** 31/31 requirements, 6/6 phases, 9/9 integration seams, and 8/8 end-to-end flows pass; 1603 adapter-profile and 133 builtin-profile cucumber scenarios. The audit reads `tech_debt` with no blockers. Phase 2 closed with a verification override (`human_needed`, 5/7); after the user's review and the review fixes it re-verified `passed` (7/7), with 02-UAT 2/2.

</details>

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

### In progress behavioral-gaps -- Behavioral Coverage Gaps

**Milestone goal:** The cucumber suite covers the user-visible behavior that the
November 2026 coverage audit found untested. Every scenario fails without the
behavior it names, and the whole `npm run test:cucumber` is green under both the
`adapter` and the `builtin` profile. Only a scenario with an MCP surface carries
`@mcp` or an `@adapter-only` and `@builtin-only` pair; any other scenario runs
once, under `adapter` (D-BG-04).

Inputs: `.planning/PROJECT.md` (Current Milestone), `.planning/REQUIREMENTS.md`
(34 requirements), and the "Parallel work" rules in
`.agents/skills/cucumber/rules/layout.md`. The milestone has no research step
of its own; each phase researches its upstream contract with
`claude-code-compat-research`. The milestone adds coverage, not features: a
product change is either a bug fix that a scenario exposes or a stand-in seam
that Phase 1 records with a decision ID.

#### Parallelism

Phase 1 is the only prerequisite. It runs serially in the parent session on the
milestone branch `features/behavioral-gaps`, and inside it the GSD executors
run each wave's plans in parallel worktrees. It builds every shared stand-in,
fixture writer, driver, and step that the streams need, then freezes every
shared file (see File ownership).

When Phase 1 is verified, the parent creates the fifteen branches
`features/behavioral-gaps-phase-2` to `features/behavioral-gaps-phase-16` as
local branches at the verified milestone head, and pushes nothing unless the
user asks (D-BG-16). Phases 2-16 each depend on Phase 1 alone
and on no other stream. They run concurrently: one child session per phase,
each in its own git worktree on its own branch, running `gsd-autonomous --only
N` through discuss, plan, execute, code review and fix, verification, and the
phase transition. Each child session reads
`.planning/milestones/behavioral-gaps-CHILD-SESSION-BRIEF.md`, which Phase 1
writes.

- A child session commits only to its own branch and pushes nothing unless the
  user asks (D-BG-16). It never commits to `main`, the milestone branch, or
  another phase's branch, and it opens no pull request.
- A child never runs the milestone lifecycle (audit, complete, cleanup).
- A child that needs a change the parent made on the milestone branch, such as
  a parent line to a frozen file, merges the local `features/behavioral-gaps` into
  its own branch. It never rebases and never merges a sibling's phase branch.
- The parent merges each finished branch into `features/behavioral-gaps` with a
  merge commit and resolves the planning-file conflicts (see Merge procedure).

```text
W0  Phase 1       Foundation               parent session, features/behavioral-gaps; parallel executors per wave
W1  Phases 2-16   fifteen child sessions   one worktree and branch features/behavioral-gaps-phase-N each; gsd-autonomous --only N
W2  merges        as branches finish       parent session, features/behavioral-gaps; then the milestone audit
```

No closing phase is planned. The parent applies each phase's parent lines at
its merge, and after the last merge it runs the combined-tree gate and the
milestone audit.

**Why fifteen streams.** Each requirement group has its own feature file, its
own verb step module, and its own product code, apart from the shared product
files that the Milestone rules name, so no two streams edit a common file. The
five hook-event phases stay separate because their events, payload modules, and
upstream questions are separate. Their shared risk is the hook dispatch
modules, and the Milestone rules limit those to additive changes.

Inside a phase, plans in one wave own disjoint files, so the executor runs them
in parallel. A step that two plans of one wave both need moves to an earlier
wave. Iterate with `npx cucumber-js <owned feature files>`, and run
`npm run check` only at gates.

#### File ownership

Product paths are relative to `extensions/pi-claude-marketplace/`, step module
paths to `features/step_definitions/`, and feature paths to `features/`. Each
phase owns the unit pair (`test/<same path>.test.ts`) of every product file it
owns. A new test file takes a name that carries its phase's topic, so two
phases never create the same file.

**Frozen after Phase 1** (no stream edits these; a change that a stream needs is
a parent line, which the parent applies on the milestone branch):

- Build and CI: `package.json`, `package-lock.json`,
  `.github/workflows/ci.yml`, `cucumber.json`, `scripts/check-features.mjs`,
  `scripts/install-test-peers.mjs`, `.fallowrc.json`,
  `rule-packs/architecture.json`, and `eslint.config.js`.
- Harness: `test/e2e/_rpc.ts`, `features/support/**`, and `features/lib/**`,
  including every library Phase 1 adds: `features/lib/github-device-flow/**`
  (the Device Flow stand-in, the redirect extension, and its routing rule),
  `features/lib/pi-json-mode.ts`, and `features/lib/plugin-picker.ts`. Also the
  harness tests Phase 1 added or changed:
  `test/architecture/github-device-flow-redirect.test.ts`,
  `test/architecture/pi-tui-screen.test.ts`, and
  `test/architecture/hermetic-git-environment.test.ts`. A stream adds no file
  under `features/support/` or `features/lib/`; a small helper private to one
  of its step modules stays in that module.
- Step modules: the shared modules `command`, `config`, `session`,
  `mcp-configuration`, `mcp-implementation`, `git-host`, `scope-state`,
  `claude-code-settings`, `model`, `completion`, `companion`, and
  `npm-registry`; every topic module, such as `plugin/publishing`,
  `plugin/installation`, `marketplace/publishing`, `marketplace/checkout`,
  `hook/runs`, `hook/session`, and `hook/tool-use`, and the topic module
  `plugin/picker.steps.ts` that Phase 1 adds; and every other step module
  that exists when Phase 1 ends. A stream adds only the verb module the table
  below gives it.
- `.agents/skills/cucumber/**`. Phase 1 gives `rules/layout.md` a "Behavioral
  gaps" section that copies this ownership table and reserves each stream's
  feature file and verb module name.
- Product: `platform/pi-api.ts`. Phase 1 checked that it already re-exports
  every Pi event type the streams read (`AgentEndEvent`, `AgentSettledEvent`,
  `SessionCompactEvent`, `SessionShutdownEvent`, `ToolResultEvent`, and
  `ExtensionAPI`, which carry a turn that ends in error, an automatic
  compaction, and the session shutdown reasons), and changed nothing. Phase 1
  added no product seam for a stand-in: the Device Flow redirect runs inside
  the harness (D-BG-01), so D-BG-02 was not applied.
- Closed sets, frozen except for additions at the end (see Milestone rules).

**Seeded by Phase 1, then handed over.** Phase 1 puts each seed scenario in the
feature file of the stream that will use its stand-in. Once Phase 1 merges, the
file belongs to that stream. A stream may rewrite its seed, but it keeps every
shared step the seed uses in use: `npm run check:features` fails on an unused
step, and the stream cannot remove one from a frozen module.

| Phase | Feature files | Verb step module | Product it may fix |
| --- | --- | --- | --- |
| 1 (serial) | the seeds, in the stream files below | every shared and topic module | everything frozen above |
| 2 Async hooks | NEW `hook/async.feature` | NEW `hook/async.steps.ts` | `bridges/hooks/async-rewake/**`; the `async` and `asyncRewake` branches of the shared hook modules |
| 3 StopFailure hooks | NEW `hook/stop-failure.feature` | NEW `hook/stop-failure.steps.ts` | `bridges/hooks/payloads/stop-failure.ts`; the StopFailure arm of the shared hook modules |
| 4 PostToolUseFailure hooks | NEW `hook/tool-failure.feature` | NEW `hook/tool-failure.steps.ts` | `bridges/hooks/payloads/post-tool-use-failure.ts`; the PostToolUseFailure arm of the shared hook modules |
| 5 PostCompact hooks | NEW `hook/compaction.feature` | NEW `hook/compaction.steps.ts` | `bridges/hooks/payloads/{post-compact,compact-trigger}.ts`; the PostCompact arm of the shared hook modules |
| 6 SessionEnd hooks | NEW `hook/session-end.feature` | NEW `hook/session-end.steps.ts` | `bridges/hooks/payloads/session-end.ts`; the SessionEnd arm of the shared hook modules |
| 7 State schema migration | NEW `plugin/state-migration.feature` | NEW `plugin/state-migration.steps.ts` | `persistence/migrate.ts`; the load and schema-version functions of `persistence/state-io.ts` |
| 8 First-run config migration | NEW `plugin/config-migration.feature` | NEW `plugin/config-migration.steps.ts` | `persistence/migrate-config.ts`; the invalid-config handling in `persistence/config-io.ts`; the MIG-01 step in `orchestrators/reconcile/read-pass.ts` |
| 9 Legacy MCP entry move | NEW `mcp-server/legacy-move.feature` | NEW `mcp-server/legacy-move.steps.ts` | `orchestrators/reconcile/mcp-migration.ts` |
| 10 Model-facing tools | NEW `plugin/model-tools.feature` | NEW `plugin/model-tools.steps.ts` | `edge/handlers/tools.ts` |
| 11 Device Flow sign-in | NEW `marketplace/device-flow.feature` | NEW `marketplace/device-flow.steps.ts` | `domain/{github-auth,auth-registry}.ts`; `orchestrators/auth-host.ts`; `platform/{git-credential,git-auth-callbacks}.ts`; the auth call in `orchestrators/plugin/clone-cache.ts`; the credential choice in `orchestrators/marketplace/background-pass.ts` |
| 12 Browse picker | `plugin/browse.feature` (exists) | NEW `plugin/browse.steps.ts` | `edge/browser/plugin-browser.ts`; `edge/handlers/plugin/browse.ts`; the browse arms of `edge/router.ts` |
| 13 Prune | `plugin/prune.feature` (exists) | NEW `plugin/prune.steps.ts` | `orchestrators/plugin/{prune,prune-rollback}.ts`; `edge/handlers/plugin/prune.ts`; `domain/dependency-orphans.ts` |
| 14 Bootstrap | `plugin/bootstrap.feature` (exists) | NEW `plugin/bootstrap.steps.ts` | `orchestrators/plugin/bootstrap.ts`; `edge/handlers/plugin/bootstrap.ts` |
| 15 Marketplace state lock | `marketplace/state-lock.feature` (exists) | NEW `marketplace/state-lock.steps.ts` | `orchestrators/marketplace/autoupdate.ts`; `edge/handlers/marketplace/autoupdate.ts`; `transaction/with-state-guard.ts` |
| 16 Background-child load | NEW `plugin/subagent-child.feature` | NEW `plugin/subagent-child.steps.ts` | `platform/subagent-child.ts`; the background-child gates in `orchestrators/reconcile/load.ts` and `orchestrators/mcp/agent-grants-step.ts` |

**What exists today** (checked 2026-11-08, at the end of Phase 1). Every
stream feature file exists with its seeds, except `hook/tool-failure.feature`
and `hook/session-end.feature`, which have no seed and which Phases 4 and 6
create. `plugin/prune.feature` has no seed either; it existed before Phase 1.
All the seeds' steps live in shared and topic modules, and the cucumber
skill's layout rules list them per stream. No verb module exists yet, so each
of Phases 2-16 creates its own. Two existing files that no stream owns already pin part of the
hook requirements: `hook/session.feature` (PostCompact after `/compact` with
trigger `manual`, a trigger matcher on a manual compaction, and SessionEnd with
`clear`, `resume`, `other`, and `prompt_input_exit`) and `hook/tool-use.feature`
(one failed Bash call that runs PostToolUseFailure and not PostToolUse). Phases
4, 5, and 6 add only what those do not pin. The libraries that Phase 1 extends
already exist: `hook-recorder.ts`, `hook-files.ts`, `earlier-version-state.ts`,
`state-lock-holder.ts`, `pi-tui.ts`, and `scripted-model/**`.

**Unowned feature files.** A feature file that exists today and is not in the
table belongs to no stream, and a stream adds no scenario to it. When a product
fix changes the expected output of one of its scenarios, the stream changes only
those rows, in a commit of its own, and names the file in its SUMMARY so that
the parent can resolve a conflicting merge.

#### Milestone rules

- **Upstream parity.** Every expected behavior is Claude Code's (its binary and
  the code.claude.com docs) unless a recorded decision ID or a Pi capability gap
  licenses a divergence, and the scenario names that ID or gap. Research the
  upstream contract with `claude-code-compat-research` before a scenario pins
  it. The thin-spot requirements (BROWSE, PRUNE, BOOT, MLOCK) are first drafts
  that this research may refine toward upstream behavior.
- **Bug policy.** A scenario that exposes a product bug fixes it in the same
  phase, with Claude Code as the reference, when the fix is in the phase's own
  files. A fix in a frozen file or in a sibling's file is a parent line and a
  dubious choice, never a direct edit. A phase stops for the user (with a
  `BLOCKED.md` in its phase directory) only when upstream behavior contradicts a
  recorded project principle and no precedent settles it.
- **Shared product files.** Two or more streams may need these, so each has a
  rule:
  - Hook dispatch (Phases 2-6):
    `bridges/hooks/{dispatch,dispatch-exec,event-router,event-adapters,routing-state,runtime,settle,wire-protocol,index}.ts`,
    `domain/components/hook-events.ts`, `domain/components/hooks/**`,
    `docs/hooks-compatibility.md`, and the existing `test/integration/hooks-*`
    tests. A hook-event phase adds only new code paths for its own event: a new
    case, a new function, or a new table row. It never reshapes an existing
    function or reorders a shared table. Phase 2 alone changes the shared
    dispatch, and only inside the `async` and `asyncRewake` branches. In
    `docs/hooks-compatibility.md` each phase edits only the rows of its own
    event or option. A change that needs more is surfaced as a parent line and
    a dubious choice, never made directly.
  - Load path (Phases 7, 8, 9, 16): `orchestrators/reconcile/{load,read-pass}.ts`
    and `index.ts`. Each phase edits only its own step function, and no phase
    reorders the load's steps.
  - Command arguments (Phases 12, 13, 14): `edge/router.ts`, `edge/args.ts`,
    `edge/args-schema.ts`, and `edge/flag-catalog.ts`. Each phase edits only
    its own subcommand's arm.
  - Add and install paths (Phases 11, 12, 14): `orchestrators/marketplace/add.ts`,
    `orchestrators/plugin/install-*.ts`, and `orchestrators/plugin/clone-cache.ts`.
    A fix stays minimal and inside its own function.
  - State lock (Phases 13, 14, 15): only Phase 15 edits
    `transaction/with-state-guard.ts`. Phases 13 and 14 raise a change they
    need as a parent line.
- **Append-only closed sets.** `shared/notification-types.ts` `Reason`,
  `shared/notification-wire.ts` `REASONS`, the reason table in
  `shared/notify-reasons.ts`, `test/architecture/notify-closed-set-locks.test.ts`,
  `docs/json-output.md`, and the catalog counters (`docs/output-catalog.md`,
  `EXPECTED_STATE_COUNT`, `EXPECTED_UTF8_BYTES`). Prefer an existing reason. A
  new one lands as its own commit, and the later merge keeps both entries and
  fixes the counts.
- **Behavioral tests.** Every scenario fails without the behavior it names, with
  the red proof recorded in the plan SUMMARY, and passes `npm run test:cucumber`,
  which is green as a whole under both the `adapter` and the `builtin` profile
  (D-BG-04). Only a scenario with an MCP surface carries `@mcp` and runs under
  each profile; one whose expectation differs by implementation is an
  `@adapter-only` and `@builtin-only` pair (DUAL-02). Any other scenario carries
  no implementation tag and runs once, under `adapter`.
  Expected values are whole literals in the feature file. A scenario observes
  what the user or Pi sees: command results, Pi's registries, the hook
  recorder, the scripted model's call log, a stand-in's request log, the
  terminal screen, and the files the user reads or edits (`claude-plugins.json`,
  `mcp.json`, `mcp-adapter.json`, and the installation record through its
  existing steps). It never reads a generated artifact as proof that a
  component works.
- **Never edited by a stream:** `CHANGELOG.md`, `README.md`, `README.es.md`,
  `.planning/PROJECT.md` Key Decisions, `.planning/BACKLOG.md`, and the frozen
  files. Each phase lists its lines for those files under "Parent lines" in its
  last plan's SUMMARY.md, and the parent applies them at the merge.
  ROADMAP.md, STATE.md, REQUIREMENTS.md, and WINDOWS.md are tool-written; a
  stream changes only its own phase's entries in them, and prefixes every
  WINDOWS description with `[behavioral-gaps]`.
- **Dubious choices.** Each phase keeps a log at
  `.planning/phases/<its dir>/DUBIOUS-CHOICES.md`, with entries numbered
  `P{N}-DC-01`, `P{N}-DC-02`, and so on. It gives every subagent it spawns the
  protocol: end the report with `## Dubious Choices`, and never edit a log.
  Only the parent writes the root log `.planning/DUBIOUS-CHOICES.md`, which
  Phase 1 creates.
- **Commit titles** follow `.agents/skills/committing/SKILL.md` and carry no
  milestone, phase, plan, wave, or task identifier, in the title or in the
  scope.
- **Gates.** Every wave gate and the phase gate run `npm run check`, which
  includes both cucumber profiles. The phase gate also runs the whole
  `npm run test:modules`. Every plan SUMMARY.md has a `## Threat Flags`
  section.
- **Out of scope.** Hook events Pi cannot support (`SubagentStop`,
  `PermissionRequest`, and the like), LSP servers, `userConfig`, channels, and
  product features beyond the bugs a scenario exposes.

#### Merge procedure

- The parent merges each finished phase branch into `features/behavioral-gaps`
  with a merge commit, never a rebase, and pushes nothing unless the user asks
  (D-BG-16). At each
  merge it applies that phase's parent lines.
- Planning-file conflicts: each child changes only its own checklist line, its
  own Phase Details block, its own Progress row, and its own Traceability rows,
  so the parent keeps both sides of a ROADMAP.md or REQUIREMENTS.md conflict.
  In STATE.md the parent keeps the milestone branch's frontmatter and Current
  Position, re-derives the progress counts, and carries over the child's
  decision and blocker lines.
- Merge order when several branches are ready, lowest conflict first: Phases
  10, 12, 11, 14, 13, and 15 (separate edge and orchestrator code); then 8, 7,
  9, and 16 (the load path; Phase 16 last, because it gates the other load
  steps); then 3, 4, 5, 6, and Phase 2 last (the shared hook modules; Phase 2
  changes the dispatch path itself).
- Post-merge gate after every merge: `npm run check` on the combined tree,
  both cucumber profiles included. Re-verify a phase after any later merge that
  touches its files. Rerun `npx fallow dupes` after each merge that touches the
  hook modules or the load path.
- After the last merge: the combined-tree gate, the CI timing check (the parent
  raises the `.github/workflows/ci.yml` timeouts if the combined run needs
  more), the CHANGELOG aggregate, and `/gsd-audit-milestone`.

- [x] **Phase 1: Foundation** - Every stand-in, fixture writer, driver, and shared step the streams need, each proven by a seed, then every shared file frozen and the child-session brief written (completed 2026-11-08)
- [ ] **Phase 2: Async Hooks** - `async` and `asyncRewake` hooks run in the background, wake the model on exit 2, never block their event, and stop on `/reload`
- [x] **Phase 3: StopFailure Hooks** - `StopFailure` hooks run when a turn ends in an error, with Claude Code's payload and error-type matchers (completed 2026-11-08)
- [ ] **Phase 4: PostToolUseFailure Hooks** - `PostToolUseFailure` hooks run on failed tool calls with Claude Code's payload and tool matchers, and `PostToolUse` hooks do not
- [x] **Phase 5: PostCompact Hooks** - `PostCompact` hooks run after manual and automatic compactions with the trigger, and matchers select by trigger (completed 2026-11-08)
- [x] **Phase 6: SessionEnd Hooks** - `SessionEnd` hooks run with every reason Pi produces, matchers select by reason, and a failing hook never keeps a session open (completed 2026-11-08)
- [x] **Phase 7: State Schema Migration** - An older `state.json` upgrades on the first load with every plugin still working; a newer one is refused and left untouched (completed 2026-11-08)
- [x] **Phase 8: First-Run Config Migration** - The first load writes the config from the records, and no later load overwrites the user's config (completed 2026-11-08)
- [x] **Phase 9: Legacy MCP Entry Move** - A plugin's legacy `mcp.json` entries move to `mcp-adapter.json` with its servers still running, and the user's own entries stay (completed 2026-11-08)
- [x] **Phase 10: Model-Facing Tools** - The two marketplace tools give the model the marketplaces and plugins it asks for, an error for bad input, and change nothing (completed 2026-11-08)
- [x] **Phase 11: Device Flow Sign-In** - GitHub Device Flow signs in on a marketplace add and on a git-source install cache miss, fails clean, and never runs in the background pass (completed 2026-11-08)
- [x] **Phase 12: Browse Picker** - In the terminal, `browse` and a bare `/claude:plugin` open a picker that installs the chosen plugin, or nothing when cancelled (completed 2026-11-08)
- [x] **Phase 13: Prune** - `prune` scope handling, `--dry-run`, usage errors, the state lock, and dependencies of disabled plugins behave as upstream (completed 2026-11-08)
- [x] **Phase 14: Bootstrap** - `bootstrap` refuses a scope and arguments, reports the same outcome in every output mode, and respects the state lock (completed 2026-11-08)
- [x] **Phase 15: Marketplace State Lock** - `marketplace autoupdate` and `noautoupdate` respect a held lock, and a lock left by a dead process blocks no marketplace verb (completed 2026-11-08)
- [x] **Phase 16: Background-Child Load** - A load in a pi-subagents background child changes nothing installed, yet still loads the installed components (completed 2026-11-08)

## Phase Details

### Phase 1: Foundation

**Goal**: Every stream phase can write its scenarios by adding only its own feature files and verb step modules. The stand-ins, fixture writers, drivers, and shared steps the streams name exist, each proven by a seed scenario; every shared file is frozen; the child sessions have their brief; and the combined tree passes `npm run check`.
**Depends on**: Nothing (first phase)
**Runs**: serially in the parent session on `features/behavioral-gaps`; its waves run parallel GSD executors in worktrees
**Requirements**: FND-01, FND-02
**Builds** (each with a seed scenario in the stream feature file named, which that stream then owns):

- async-hook support in the hook recorder and the hook fixtures: an async hook's run, its exit, and its rewake recorded, and a hook process that outlives its event (Phase 2, `hook/async.feature`);
- a scripted-model turn that ends in a chosen provider error (Phase 3, `hook/stop-failure.feature`);
- a compaction that Pi starts on its own, with trigger `auto` (Phase 5, `hook/compaction.feature`);
- earlier-release fixture writers: an older-schema and a newer-schema `state.json`, a scope with a `state.json` and no `claude-plugins.json`, and a legacy `mcp.json` that holds a plugin's marked entries beside the user's own entries (Phases 7, 8, and 9, `plugin/state-migration.feature`, `plugin/config-migration.feature`, `mcp-server/legacy-move.feature`);
- a driver that makes the scripted model call `pi_claude_marketplace_list` and `pi_claude_marketplace_plugin_list` with given arguments, and records the tool results it got back (Phase 10, `plugin/model-tools.feature`);
- a loopback GitHub Device Flow endpoint stand-in that issues a user code, answers polls as pending, authorized, denied, or expired, and records every request, with Pi routed to it and no request leaving the machine (Phase 11, `marketplace/device-flow.feature`);
- a browse picker driver over the `pi-tui.ts` pty driver that reads the picker's rows, chooses a plugin, and cancels (Phase 12, `plugin/browse.feature`);
- a run of a command in Pi's json mode and in the terminal, read as outcomes that a scenario can compare with the RPC result, if the harness does not have one yet (Phase 14, `plugin/bootstrap.feature`);
- a state lock left by a process that died, which proper-lockfile reads as stale with no wait (Phase 15, `marketplace/state-lock.feature`);
- a profile Pi launched as a pi-subagents background child (`PI_SUBAGENT_CHILD=1`) (Phase 16, `plugin/subagent-child.feature`).

The error turn, the automatic compaction, the json-mode and terminal run, and the stale lock are derived from STOPF-01, PCOMP-01, BOOT-01, and MLOCK-02. The streams cannot add them, because the scripted model, `features/lib/**`, and the shared step modules are frozen.
**Discuss step**: how Pi reaches the Device Flow stand-in, given that GHB-02 turns Device Flow off while `PI_CLAUDE_MARKETPLACE_GITHUB_BASE_URL` points GitHub sources at the loopback git host (a request redirect inside the Pi process, with no product change, is preferred; a product seam needs a decision ID and an NFR-5 and NFR-10 check); what "passes under both profiles" means for a scenario with no MCP surface, which the `builtin` profile does not select today (`(@mcp or @builtin-only) and not @adapter-only`); how the scripted model ends a turn in error and how Pi starts an automatic compaction; where each seed lives and the stream module names that `layout.md` reserves; IDs for every decision.
**Research flag**: yes. Pi 1.5.0's turn-error and automatic-compaction paths through the faux provider; whether a profile Pi with `PI_SUBAGENT_CHILD=1` alone loads as a real background child does, or needs pi-subagents to launch it; proper-lockfile's stale rule against the product's lock options; the CI time with the added seeds.
**Success Criteria** (what must be TRUE):
  1. Each stand-in, fixture writer, and driver the streams name has a passing seed scenario: the hook recorder shows an async hook's run and its rewake; Pi completes a Device Flow sign-in against the loopback stand-in with no request to github.com; each earlier-release fixture loads in Pi; the scripted model's calls to the two marketplace tools return results that the scenario reads; the picker driver lists, chooses, and cancels in a real terminal; and a profile Pi starts as a background child (FND-01).
  2. The derived stand-ins have passing seeds too: a turn that the scripted model ends in a chosen error, an automatic compaction, a json-mode and a terminal run of one command, and a stale lock beside a live lock holder (FND-01).
  3. Every seed passes `npm run test:cucumber`, which is green as a whole under the `adapter` and the `builtin` profile; only a seed with an MCP surface carries `@mcp`, and any other seed runs once, under `adapter` (D-BG-04); `npm run check:features` is green with every new shared step in use, and the cucumber skill's layout rules carry this milestone's ownership table and reserve each stream's feature file and verb module name (FND-01, FND-02).
  4. The "Frozen after Phase 1" list in this roadmap matches what Phase 1 left, `.planning/milestones/behavioral-gaps-CHILD-SESSION-BRIEF.md` exists and agrees with the Milestone rules, and the root log `.planning/DUBIOUS-CHOICES.md` exists (FND-02).
  5. `npm run check` passes on the combined tree at the Phase 1 head, the CI behavioral timeouts hold the measured run with margin, and the fifteen `features/behavioral-gaps-phase-N` branches exist as local branches at that head (D-BG-16, FND-02).

**Parallel structure** (suggested; the planner may split further, and plans in one wave own disjoint files):

| Wave | Plan | Owns |
| --- | --- | --- |
| 1 | Rules and records | `.agents/skills/cucumber/rules/*` (the Behavioral gaps section, the reserved names, the new stand-ins), `.planning/DUBIOUS-CHOICES.md`, the decision rows Phase 1 adds |
| 1 | Pi types and seams | `platform/pi-api.ts`, and any stand-in seam the discuss step decides |
| 2 | Hook and model stand-ins | `hook-recorder.ts`, `hook-files.ts`, `scripted-model/**`, the hook and model shared steps; seeds in `hook/{async,stop-failure,compaction}.feature` and `plugin/model-tools.feature` |
| 2 | Local fixtures | `earlier-version-state.ts` and the new fixture writers, `state-lock-holder.ts`, the scope-state, config, and MCP configuration steps; seeds in `plugin/{state-migration,config-migration}.feature`, `mcp-server/legacy-move.feature`, and `marketplace/state-lock.feature` |
| 2 | Device Flow stand-in | the new stand-in library and its support module, the git-host steps; seed in `marketplace/device-flow.feature` |
| 2 | Terminal and process | `pi-tui.ts` and the picker driver, the json-mode run, the background-child launch (`features/support/pi-process.ts`, `world.ts`, `test/e2e/_rpc.ts`), the session and command steps; seeds in `plugin/{browse,bootstrap,subagent-child}.feature` |
| 3 | Brief and gate | `.planning/milestones/behavioral-gaps-CHILD-SESSION-BRIEF.md`, the measured CI time and `.github/workflows/ci.yml`, the frozen-file record, `npm run check`, and the phase branches |

**Plans**: 8/8 plans complete

Plans:
**Wave 1**
- [x] 01-01-PLAN.md — Rules and records: the cucumber layout section for the streams, the profile and branch wording, the Key Decisions rows, and the two dubious-choices logs
- [x] 01-02-PLAN.md — Launch seams (child marker, optional GitHub base, crash and restart, one-shot launch, json arguments) with the background-child and stale-lock seeds
- [x] 01-03-PLAN.md — Scripted model: error turns and automatic compaction, and the model-tools seeds with the argument-validation projector
- [x] 01-04-PLAN.md — Earlier-release fixtures: `state.json` of 0.6.0, 0.19.2, 0.4.3 and a newer schema, a deleted config, and a 0.19.2 `mcp.json`, with their seeds

**Wave 2** *(blocked on Wave 1 completion)*
- [x] 01-05-PLAN.md — Async hook stand-ins: lifecycle log, release, summary, rewake, and the stop of hooks a dead Pi left
- [x] 01-06-PLAN.md — GitHub Device Flow stand-in with the in-process redirect, its routing cases, and the sign-in and terminal seeds
- [x] 01-07-PLAN.md — Json-mode and terminal command runs, the terminal screen model, and the browse picker driver, with their seeds

**Wave 3** *(blocked on Wave 2 completion)*
- [x] 01-08-PLAN.md — Frozen record, stand-in docs, child-session brief, combined-tree gate with CI timing, and the fifteen local branches

**Cross-cutting constraints:** <!-- gsd:generated -->
- No seed of this plan carries an MCP implementation tag (D-BG-05).

### Phase 2: Async Hooks

**Goal**: A plugin's async hooks run in the background as Claude Code runs them: they never hold up the event they fired on, an `asyncRewake` hook that exits 2 wakes the model with its message, any other exit reaches only the user, and no hook process outlives a reload.
**Depends on**: Phase 1
**Runs**: child session, branch `features/behavioral-gaps-phase-2`; merges last among the hook phases
**Requirements**: ASYNC-01, ASYNC-02, ASYNC-03, ASYNC-04, ASYNC-05
**Discuss step**: Claude Code's contract for `async`, `asyncRewake`, `rewakeMessage`, and `rewakeSummary` (when a rewake reaches the model, what the user sees, the timeouts); whether plain `async: true` runs as Claude Code runs it or is a licensed divergence (ASYNC-05); what reaping means for a hook process that an earlier Pi process left.
**Research flag**: yes. A check of the async hook paths in the Claude Code binary.
**Success Criteria** (what must be TRUE):
  1. An `asyncRewake` hook that exits 2 puts its `rewakeMessage` and its output into the model's context, and the scripted model's call log shows them on the next turn (ASYNC-01).
  2. An `asyncRewake` hook that exits with any other code adds nothing to the model's context, and the user sees its `rewakeSummary` (ASYNC-02).
  3. A slow async hook on `PreToolUse` or on a prompt does not block or delay its event: the tool result and the reply arrive while the hook is still running (ASYNC-03).
  4. After `/reload`, no async hook process from the earlier load is still running, and the first load after a Pi process died stops the hook processes that process left (ASYNC-04). This holds for a project-scope install too. Today it does not: `index.ts` registers the hooks bridge with `{ cwd: homedir() }`, so `reapOrphans` (`bridges/hooks/event-router.ts`) reads the home directory's project PID table, and the project hydrate (`hydrateProjectScopeForCwdWith`) does not reap. The Phase 1 crash seed in `hook/async.feature` therefore installs in the user scope; this phase fixes the reap, or records a licensed divergence, and adds the project-scope scenario. Releasing a hook that declares no rewake summary, or one a terminal Pi started, needs new steps in `hook/async.steps.ts`.
  5. A hook with plain `async: true` behaves as Claude Code's does, or a scenario pins the divergence and names its license (ASYNC-05).

**Plans**: TBD

### Phase 3: StopFailure Hooks

**Goal**: When a turn ends in an error, the plugin's `StopFailure` hooks run with Claude Code's payload, and matchers select them by error type.
**Depends on**: Phase 1
**Runs**: child session, branch `features/behavioral-gaps-phase-3`
**Requirements**: STOPF-01
**Discuss step**: Claude Code's error types and how Pi's turn errors map onto them; whether `Stop` hooks also run on an error turn; what upstream does with a `StopFailure` hook's output and exit code.
**Research flag**: yes. The StopFailure contract in the Claude Code binary and docs.
**Success Criteria** (what must be TRUE):
  1. A turn that the scripted model ends in a provider error runs the plugin's `StopFailure` hook once, and the hook recorder shows Claude Code's payload for it, the error type included (STOPF-01).
  2. A `StopFailure` matcher selects runs by error type: on one error turn, the hook whose matcher names that type runs, and a hook whose matcher names another type does not (STOPF-01).
  3. A turn that ends normally runs no `StopFailure` hook, and on an error turn `Stop` hooks run or stay silent as Claude Code's do (STOPF-01).
  4. A `StopFailure` hook's output and exit code are handled as Claude Code handles them, and the next prompt in the session gets a normal turn (STOPF-01).

**Plans**: 3/3 plans complete

Plans:
**Wave 1**
- [x] 03-01-PLAN.md — Pin today's StopFailure behavior: payload, error-type matchers, no Stop on an error turn, ignored output, and a normal next turn

**Wave 2** *(blocked on Wave 1 completion)*
- [x] 03-02-PLAN.md — StopFailure matchers take `|` lists and Claude Code's 13 error types (D-BG-301, D-BG-302)

**Wave 3** *(blocked on Wave 2 completion)*
- [x] 03-03-PLAN.md — Leave out an empty `last_assistant_message` (D-BG-303), and the parent lines

### Phase 4: PostToolUseFailure Hooks

**Goal**: A failed tool call runs the plugin's `PostToolUseFailure` hooks with Claude Code's payload, matchers select them by tool, and the plugin's `PostToolUse` hooks do not run on it.
**Depends on**: Phase 1
**Runs**: child session, branch `features/behavioral-gaps-phase-4`
**Requirements**: TFAIL-01
**Existing coverage**: `hook/tool-use.feature` already pins one failed Bash call that runs PostToolUseFailure and not PostToolUse. This phase adds what that scenario does not pin.
**Discuss step**: which Pi tool results Claude Code would report as failures (a non-zero Bash exit, a tool error, an interrupted call); the payload fields, such as `error` and `is_interrupt`; failed plugin MCP tool calls under each MCP implementation.
**Research flag**: yes. The PostToolUseFailure contract in the Claude Code binary and docs.
**Success Criteria** (what must be TRUE):
  1. A failed call of a built-in tool other than Bash, and a failed call of a plugin MCP tool, each run `PostToolUseFailure` hooks with Claude Code's payload, its error fields included, as the hook recorder shows (TFAIL-01).
  2. A `PostToolUseFailure` matcher selects runs by tool name, including an alternation pattern and a plugin MCP tool name (TFAIL-01).
  3. No `PostToolUse` hook runs on a failed call, and a successful call runs no `PostToolUseFailure` hook (TFAIL-01).
  4. What a `PostToolUseFailure` hook returns (additional context, a system message, an exit 2) reaches the model and the user as Claude Code delivers it (TFAIL-01).

**Plans**: 3 plans

Plans:
**Wave 1**
- [ ] 04-01-PLAN.md — A cancelled tool call runs no PostToolUseFailure hook (D-BG-402), and the payload gains `is_interrupt: false` (D-BG-401, D-BG-403)

**Wave 2** *(blocked on Wave 1 completion)*
- [ ] 04-02-PLAN.md — A PostToolUseFailure hook's `updatedToolOutput` is ignored (D-BG-405), and the failed-read payload, matcher, split, and output scenarios

**Wave 3** *(blocked on Wave 2 completion)*
- [ ] 04-03-PLAN.md — A failed pi-mcp-adapter call runs PostToolUseFailure (D-BG-404), the failed plugin MCP call pair, and the phase's parent lines

### Phase 5: PostCompact Hooks

**Goal**: Every compaction, manual or automatic, runs the plugin's `PostCompact` hooks with its trigger, and matchers select them by trigger.
**Depends on**: Phase 1
**Runs**: child session, branch `features/behavioral-gaps-phase-5`
**Requirements**: PCOMP-01
**Existing coverage**: `hook/session.feature` pins PostCompact after `/compact` with trigger `manual`, and a trigger matcher on a manual compaction. This phase adds the automatic compaction and what the payload and output rules leave unpinned.
**Discuss step**: Claude Code's `PostCompact` payload (the trigger and the summary) and its output handling; how Pi's automatic compaction maps to `auto`, including a compaction after a context overflow.
**Research flag**: yes. The PostCompact contract in the Claude Code binary and docs.
**Success Criteria** (what must be TRUE):
  1. A compaction that Pi starts on its own runs `PostCompact` hooks with trigger `auto` and Claude Code's payload, and a `/compact` gives trigger `manual` (PCOMP-01).
  2. A matcher `auto` selects only the automatic run, and a matcher `manual` only the manual run (PCOMP-01).
  3. A `PostCompact` hook's output and exit code are handled as Claude Code handles them, and the session continues after the compaction (PCOMP-01).

**Plans**: 2/2 plans complete

Plans:
**Wave 1**
- [x] 05-01-PLAN.md — Output parity: one notice listing how each PostCompact hook ended after /compact, none after an automatic compaction (D-BG-501 to D-BG-504)

**Wave 2** *(blocked on Wave 1 completion)*
- [x] 05-02-PLAN.md — Coverage: overflow trigger, auto matcher, the session going on, docs, and parent lines

### Phase 6: SessionEnd Hooks

**Goal**: Every way a Pi session ends runs the plugin's `SessionEnd` hooks with Claude Code's reason, matchers select them by reason, and a failing hook never keeps the session from ending.
**Depends on**: Phase 1
**Runs**: child session, branch `features/behavioral-gaps-phase-6`
**Requirements**: SEND-01
**Existing coverage**: `hook/session.feature` pins `clear` (a new session), `resume` (a fork), `other` (an RPC stop), `prompt_input_exit` (a terminal quit), and a `clear` matcher. This phase adds the rest.
**Discuss step**: every way Pi 1.5.0 ends a session (each shutdown reason it emits) and Claude Code's reason for each; the timeout upstream gives a `SessionEnd` hook.
**Research flag**: yes. The SessionEnd reason set in the Claude Code binary and docs.
**Success Criteria** (what must be TRUE):
  1. Each reason Pi can produce has a scenario, including the ones `hook/session.feature` lacks, and the hook recorder shows Claude Code's reason and payload for each (SEND-01).
  2. A matcher for each reason selects only that reason's run (SEND-01).
  3. A `SessionEnd` hook that exits non-zero, exits 2, or runs past its timeout does not keep the session from ending: the next session starts or Pi exits, and the run is recorded (SEND-01).

**Plans**: 3 plans

Plans:
- [x] 06-01-PLAN.md -- the session end verb steps, the resume and json-mode reason scenarios, and the four matcher scenarios (wave 1)
- [x] 06-02-PLAN.md -- cap a plugin SessionEnd hook's timeout at the 1.5 s budget (D-BG-604), with unit cases and the docs clause (wave 1)
- [x] 06-03-PLAN.md -- the failure scenarios on a new session and on a json-mode exit (wave 2)

### Phase 7: State Schema Migration

**Goal**: A user who upgrades keeps every installed plugin: the first load reads an older `state.json`, rewrites it in the current schema, and every recorded plugin still works. A `state.json` from a newer release is refused and left untouched.
**Depends on**: Phase 1
**Runs**: child session, branch `features/behavioral-gaps-phase-7`
**Requirements**: STMIG-01, STMIG-02
**Discuss step**: which older schema versions the migration reads (one scenario each); what the user sees during a migration, if anything; the unreadable report for a newer schema (fail closed on data the release cannot read).
**Research flag**: no. The contract is the project's own (`persistence/migrate.ts`).
**Success Criteria** (what must be TRUE):
  1. After an upgrade from each older schema, the first load lists every recorded plugin as installed, and a component of each works in the new session (STMIG-01).
  2. That load rewrites the installation record in the current schema, and a second load changes nothing (STMIG-01).
  3. A `state.json` from a newer schema is reported as unreadable by the load and by a command, and the file, the config, and every installed component stay as they were (STMIG-02).

**Plans**: 1/1 plans complete

Plans:
**Wave 1**
- [x] 07-01-PLAN.md — Migration coverage: the migrated-record step, first and second loads after 0.6.0 and 0.19.2, a disabled plugin kept disabled, and the load and `disable` refusing a newer record, each with a red proof

### Phase 8: First-Run Config Migration

**Goal**: A user upgrading from a release with no config gets a `claude-plugins.json` written once from their records. From then on the config is theirs: no load rewrites it, and an invalid one is never overwritten.
**Depends on**: Phase 1
**Runs**: child session, branch `features/behavioral-gaps-phase-8`
**Requirements**: CFGMIG-01, CFGMIG-02
**Discuss step**: the declarations MIG-01 writes in each scope, including a `--local` marketplace (FIX-02) and the legacy `autoupdate` field; what the user sees when an existing config is invalid.
**Research flag**: no. The contract is the project's own (MIG-01).
**Success Criteria** (what must be TRUE):
  1. In the user scope and in the project scope, the first load with a `state.json` and no `claude-plugins.json` writes a config that declares every recorded marketplace and plugin with its enabled state and the legacy `autoupdate` field, and `pending` then shows nothing to apply (CFGMIG-01). This includes a disabled plugin: today's rebuild (`buildConfigFromState` in `persistence/migrate-config.ts`) writes every plugin entry as `{}`, so the Phase 1 seed in `features/plugin/config-migration.feature` pins `will enable` for it. This phase fixes the rebuild and rewrites that seed to state `enabled` false.
  2. A user's edit to the written config survives every later load and `/reload` (CFGMIG-02).
  3. An existing config that is not valid is reported and stays byte for byte as it was (CFGMIG-02).

**Plans**: 2/2 plans complete

Plans:
**Wave 1**
- [x] 08-01-PLAN.md — Rebuild a config as the user's commands wrote it (disabled plugin, dependency, dependency-check hold) and cover CFGMIG-01 in both scopes

**Wave 2** *(blocked on Wave 1 completion)*
- [x] 08-02-PLAN.md — Cover CFGMIG-02: the user's edit survives a load and a terminal reload, and invalid base and local configs are reported and kept; the phase's parent lines

### Phase 9: Legacy MCP Entry Move

**Goal**: A user upgrading from a release that wrote plugin MCP servers into `mcp.json` has them moved to `mcp-adapter.json` on load, with the servers still running and the user's own entries left alone.
**Depends on**: Phase 1
**Runs**: child session, branch `features/behavioral-gaps-phase-9`
**Requirements**: AMIG-01, AMIG-02
**Discuss step**: what the move reports, and when; how the move behaves under the `builtin` profile, where MSEL-04 keeps writing `mcp-adapter.json`, and the tags its scenarios need (DUAL-02).
**Research flag**: no. The contract is the project's own (AMIG-01).
**Success Criteria** (what must be TRUE):
  1. On load, the entries a plugin owns in a legacy `mcp.json` move to `mcp-adapter.json`, and the plugin's servers still connect afterwards (AMIG-01).
  2. The user's own, unmarked `mcp.json` entries stay byte for byte as they were (AMIG-02).
  3. A second load moves nothing and reports nothing, and each scenario passes under every MCP implementation it applies to (AMIG-01, AMIG-02).

**Plans**: 1/1 plans complete

Plans:
- [x] 09-01-PLAN.md — Four `@mcp` scenarios beside the seed (the user's own servers, a second load, the moved server running, the project scope), with the new Given in `mcp-server/legacy-move.steps.ts`

### Phase 10: Model-Facing Tools

**Goal**: A model can ask the extension which marketplaces and plugins exist through `pi_claude_marketplace_list` and `pi_claude_marketplace_plugin_list`. It gets what it asked for, or an error it can read, and its calls change nothing.
**Depends on**: Phase 1
**Runs**: child session, branch `features/behavioral-gaps-phase-10`
**Requirements**: TOOL-01, TOOL-02, TOOL-03
**Discuss step**: the carried json-output D-03 choice (the tools return `isError: true`; throwing a redacted Error instead would set Pi's error flag). TOOL-03 pins the result the model receives under Pi 1.5.0. If the choice is still open, the phase takes the recommended option and logs it as a dubious choice for the user.
**Research flag**: no.
**Success Criteria** (what must be TRUE):
  1. A model call to `pi_claude_marketplace_list` with no scope returns the marketplaces of both scopes, and a call with a scope returns only that scope's (TOOL-01).
  2. A model call to `pi_claude_marketplace_plugin_list` returns each plugin's compatibility and install status, and each filter (installed, available, unavailable) returns only its plugins (TOOL-02).
  3. A call that names an unknown marketplace or scope returns an error result, which the model reads on its next request (TOOL-03).
  4. No call changes `state.json`, a config file, or anything installed (TOOL-03).

**Plans**: 2/2 plans complete

Plans:
**Wave 1**
- [x] 10-01-PLAN.md — The list tool's optional scope, the not-found error result, disabled plugins under the `unavailable` filter, and `(no plugins)` for every empty block, each test-first in the unit pair

**Wave 2** *(blocked on Wave 1 completion)*
- [x] 10-02-PLAN.md — The model-tool scenarios through the scripted model (both scopes and each scope, every status and filter, refused and unknown input as failed results, nothing changed on disk), with every red proof and the parent lines

### Phase 11: Device Flow Sign-In

**Goal**: A user with no stored GitHub credential can add a GitHub marketplace, or install from a GitHub git source, by signing in through Device Flow. A failed sign-in leaves nothing behind, and the background pass never starts one.
**Depends on**: Phase 1
**Runs**: child session, branch `features/behavioral-gaps-phase-11`
**Requirements**: DFLOW-01, DFLOW-02, DFLOW-03, DFLOW-04
**Discuss step**: the sign-in contract (the project's own: D-79-04, D-79-05, and GHB-02, with Claude Code as the reference where it applies); where the credential is stored and how the next command finds it; what each failure reports; the stored-credential rule of the background pass (D-PL8-12).
**Research flag**: no. Phase 1 settles how Pi reaches the stand-in.
**Success Criteria** (what must be TRUE):
  1. Adding a GitHub marketplace that needs a credential the user has not stored shows a user code and a verification URL; after the stand-in authorizes, the clone completes, and the next command needs no sign-in (DFLOW-01).
  2. An authorization that the stand-in denies or lets expire fails as authentication required, and no marketplace record, clone, or credential is left (DFLOW-02).
  3. An install from a GitHub git source on a cache miss runs the same flow, and an install whose clone is already cached runs none (DFLOW-03).
  4. The background autoupdate pass with no stored credential starts no Device Flow: the stand-in receives no device-code request, and the pass uses stored credentials only (DFLOW-04).

**Plans**: 2/2 plans complete

Plans:
**Wave 1**
- [x] 11-01-PLAN.md — Marketplace add sign-in: the credential store steps, seed 1 extended, the next command reusing the token, and a denied or expired sign-in that leaves nothing (DFLOW-01, DFLOW-02)

**Wave 2** *(blocked on Wave 1 completion)*
- [x] 11-02-PLAN.md — The background pass with and without a stored GitHub credential, and a git-source install on a cache miss and a cache hit, with the phase's parent lines (DFLOW-03, DFLOW-04)

### Phase 12: Browse Picker

**Goal**: In the terminal, a user can open the plugin picker with `browse` or a bare `/claude:plugin`, see the marketplaces and plugins of both scopes, and install a plugin by choosing it.
**Depends on**: Phase 1
**Runs**: child session, branch `features/behavioral-gaps-phase-12`
**Requirements**: BROWSE-01, BROWSE-02
**Existing coverage**: `plugin/browse.feature` pins only the refusals outside the terminal and an argument to `browse`.
**Discuss step**: Claude Code's `/plugin` picker as the reference for what it lists and where a chosen plugin installs; what the picker shows for a plugin that is already installed or unavailable.
**Research flag**: yes. The upstream `/plugin` picker.
**Success Criteria** (what must be TRUE):
  1. In the terminal, `/claude:plugin browse` and a bare `/claude:plugin` open the picker, and it lists the marketplaces and plugins of both scopes (BROWSE-01). The Phase 1 seed in `plugin/browse.feature` pins a marketplace row of `0 plugin(s)` for a marketplace that offers plugins, because `edge/handlers/plugin/browse.ts` counts the installed plugins (`Object.keys(record.plugins)`); this phase checks the count against Claude Code and fixes the row or records the divergence.
  2. Choosing a plugin installs it in its marketplace's scope, and `list` then shows it installed there (BROWSE-02).
  3. Cancelling the picker installs nothing and leaves both scopes as they were (BROWSE-02).

**Plans**: 2/2 plans complete

Plans:
**Wave 1**
- [x] 12-01-PLAN.md — The D-BG-1201 marketplace row (catalog plugins offered and installed) with its unit cases, and scenario B: the bare-command walk over both scopes' marketplaces, a marketplace's plugins, and an installed plugin's actions

**Wave 2** *(blocked on Wave 1 completion)*
- [x] 12-02-PLAN.md — Installs from the picker in each scope with `list`, cancelling at the scope screen and on the first screen, the empty marketplace list, and the phase's parent lines

### Phase 13: Prune

**Goal**: `prune` removes exactly the dependencies that nothing needs, in the scopes Claude Code would, and removes nothing when it cannot take the state lock.
**Depends on**: Phase 1
**Runs**: child session, branch `features/behavioral-gaps-phase-13`
**Requirements**: PRUNE-01, PRUNE-02
**Existing coverage**: `plugin/prune.feature` pins pruning one scope, a git-source dependency, `--dry-run` in one scope, and the keep rules for a needed plugin and a plugin installed by name.
**Discuss step**: what Claude Code's prune does with no scope; how upstream treats a dependency that only a disabled plugin needs; prune's usage errors.
**Research flag**: yes. The upstream prune contract.
**Success Criteria** (what must be TRUE):
  1. `prune` without `--scope` prunes the scopes that Claude Code would, and `--scope user` and `--scope project` each combine with `--dry-run` to preview that scope alone and remove nothing (PRUNE-01).
  2. Each prune usage error has a scenario that shows its usage text (PRUNE-01).
  3. `prune` while another process holds the state lock fails as lock held and removes nothing (PRUNE-02).
  4. A dependency that only a disabled plugin needs is kept or pruned as upstream does (PRUNE-02).

**Plans**: 1/1 plans complete

Plans:
- [x] 13-01-PLAN.md — the prune scenarios for the user-scope default, one preview per scope, and a disabled plugin's dependencies, with red proofs for them and for the existing usage-error and state-lock coverage

### Phase 14: Bootstrap

**Goal**: `bootstrap` takes no scope and no arguments, reports the same outcome in the terminal, json, and RPC modes, and records nothing when it cannot take the user scope's state lock.
**Depends on**: Phase 1
**Runs**: child session, branch `features/behavioral-gaps-phase-14`
**Requirements**: BOOT-01, BOOT-02
**Existing coverage**: `plugin/bootstrap.feature` pins the official marketplace add, a repeat run, the kept autoupdate setting, a missing dependency install, a missing official marketplace, and an outline of rejected arguments.
**Discuss step**: which refusals the existing outline already pins; the outcome rows each output mode must carry.
**Research flag**: no.
**Success Criteria** (what must be TRUE):
  1. `bootstrap` refuses `--scope` and any argument with its usage, and changes nothing (BOOT-01).
  2. A bootstrap run in json mode and one over RPC carry the same outcome as the same run in the terminal (BOOT-01).
  3. `bootstrap` while another process holds the user scope's state lock fails as lock held, and adds and records nothing (BOOT-02).

**Plans**: 1/1 plans complete

Plans:
- [x] 14-01-PLAN.md — Pin bootstrap's refusals, its outcome in each output mode, and its held-lock failure (BOOT-01, BOOT-02)

### Phase 15: Marketplace State Lock

**Goal**: Every marketplace verb respects a state lock that another live process holds, and no marketplace verb is blocked by a lock that a dead process left.
**Depends on**: Phase 1
**Runs**: child session, branch `features/behavioral-gaps-phase-15`
**Requirements**: MLOCK-01, MLOCK-02
**Existing coverage**: `marketplace/state-lock.feature` pins `remove`, `update`, and `add` under a held lock.
**Discuss step**: proper-lockfile's stale rule against the product's lock options; which verbs take the lock; what a takeover of a stale lock reports, if anything.
**Research flag**: no. Phase 1 measures the stale rule.
**Success Criteria** (what must be TRUE):
  1. `marketplace autoupdate` and `marketplace noautoupdate` while another process holds the scope's state lock fail as lock held, and the config and the records stay unchanged (MLOCK-01).
  2. With a lock left by a process that has died, `marketplace add`, `remove`, `update`, `autoupdate`, and `noautoupdate` each complete as they would with no lock (MLOCK-02).
  3. A lock that a live process still holds keeps blocking the same verbs, so staleness is the only difference (MLOCK-02).

**Plans**: 1/1 plans complete

Plans:
- [x] 15-01-PLAN.md — The held-lock autoupdate and noautoupdate Outline (MLOCK-01), the stale-lock twins of every live-holder scenario with the seed rewritten (MLOCK-02), both red proofs, and the wave gate

### Phase 16: Background-Child Load

**Goal**: A pi-subagents background child loads the installed plugins as its parent does, but its load changes nothing that is installed (D-MB-12).
**Depends on**: Phase 1
**Runs**: child session, branch `features/behavioral-gaps-phase-16`
**Requirements**: CHILD-01, CHILD-02
**Discuss step**: which load steps a child runs and which it skips (under D-MB-12, autoapply and the AMIG-01 move skip, the agent grants step does nothing, and the MIG-01 and state migrations still run); what a child reports for a pending change.
**Research flag**: no.
**Success Criteria** (what must be TRUE):
  1. A load in a background child with `autoapply` on and a pending install, uninstall, and update changes nothing: the installation record is unchanged, and the next parent load still shows the change as pending (CHILD-01).
  2. A load in a background child moves no legacy `mcp.json` entry and rewrites no generated agent's grant (CHILD-02).
  3. The child still loads the installed plugin's components: its skills and commands are listed, and its hooks run (CHILD-02).

**Plans**: 1/1 plans complete

**Wave 1**
- [x] 16-01-PLAN.md — Four background-child scenarios (pending changes left for the parent, no legacy mcp.json move, skills and slash commands, a PreToolUse hook), each proven red, and the MGRT-02 grant red proof re-run

## Progress

| Phase | Plans Complete | Status | Completed |
| --- | --- | --- | --- |
| 1. Foundation | 8/8 | Complete    | 2026-11-08 |
| 2. Async Hooks | 0/TBD | Not started | - |
| 3. StopFailure Hooks | 3/3 | Complete    | 2026-11-08 |
| 4. PostToolUseFailure Hooks | 0/TBD | Not started | - |
| 5. PostCompact Hooks | 2/2 | Complete | 2026-11-08 |
| 6. SessionEnd Hooks | 3/3 | Complete    | 2026-11-08 |
| 7. State Schema Migration | 1/1 | Complete    | 2026-11-08 |
| 8. First-Run Config Migration | 2/2 | Complete    | 2026-11-08 |
| 9. Legacy MCP Entry Move | 1/1 | Complete    | 2026-11-08 |
| 10. Model-Facing Tools | 2/2 | Complete    | 2026-11-08 |
| 11. Device Flow Sign-In | 2/2 | Complete    | 2026-11-08 |
| 12. Browse Picker | 2/2 | Complete    | 2026-11-08 |
| 13. Prune | 1/1 | Complete    | 2026-11-08 |
| 14. Bootstrap | 1/1 | Complete    | 2026-11-08 |
| 15. Marketplace State Lock | 1/1 | Complete    | 2026-11-08 |
| 16. Background-Child Load | 1/1 | Complete    | 2026-11-08 |

## Carried Forward

- mcp-builtin: BACKLOG COMPLIMPL-01, STAMPTYPE-01, GRANTRUNARG-01, STAMPREQ-01, EDGEDEPSCASES-01, PENDAPPLY-01, CONTAINCATCH-01, BLTREPEAT-01, SUBCHILDVAR-01, BLTOWNER-01 (narrowed), DENYPIN-01, and the 17 deferred built-in MCP items in [BACKLOG.md](BACKLOG.md); Phase 2's one open Nyquist gap (a `/reload` implementation switch, MSEL-02); the Pi 1.5.0 RPC double `session_start` fix on `acolomba/pi` branch `fix/rpc-double-session-start`, for the user to report upstream.
- component-features: upstream fixes wait on the user's review on forks `acolomba/pi` (`fix/input-transform-expand-opt-out`) and `acolomba/pi-subagents` (`fix/mcp-direct-tools-adapter-7`); MCPBG-01, PIEXPAND-01, WFLOCAL-01 and MCPCANARY-01 stay in [BACKLOG.md](BACKLOG.md); D-CF7-05 awaits a live probe of Claude Code.
- `DEPADV-01` and `WOUT-01` remain in [BACKLOG.md](BACKLOG.md): Pi's shrinkwrap pins a nested `brace-expansion@5.0.9`, and workflow output is unobserved.
- Closed under D-BG-1001 (behavioral-gaps Phase 10, pending user review, P10-DC-01): the json-output `09/` D-03 choice. The LLM tools return `isError: true`, never throw; Pi 1.5.0 delivers a returned `isError` to the model as a failed tool result.
- `DBLEMIT-01`, `PSRC-01`, `USRCFG-01`, `MIGR-01`, and `NAMEFOLD-01` stay in [BACKLOG.md](BACKLOG.md), out of this milestone's scope.
- `HOSTED-DNS-01` remains accepted under D-PL5-31 until a hostname-resolution policy is designed and implemented.

Earlier carried items remain in [the archived roadmap](milestones/v1.20-ROADMAP.md), and their current dispositions are tracked in [WINDOWS.md](WINDOWS.md).
