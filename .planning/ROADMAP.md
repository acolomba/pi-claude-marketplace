# Roadmap: pi-claude-marketplace

## Milestones

- **integration-rescope** Integration Test Rescope — in progress on branch `claude/stoic-shannon-la9q7o` (started 2026-11-20); 8 phases, 19 requirements.
- ✅ **parity-gaps** Claude Code Parity Gaps and Defects — completed 2026-11-17 on branch `features/gaps` (not yet pushed, no PR or npm release; version stays 0.23.0); 11 phases, 102 plans, 42/42 requirements. [Archive](milestones/parity-gaps-ROADMAP.md), [requirements](milestones/parity-gaps-REQUIREMENTS.md), [audit](milestones/parity-gaps-MILESTONE-AUDIT.md).
- ✅ **behavioral-gaps** Behavioral Coverage Gaps — completed 2026-11-08 on branch `features/behavioral-gaps` (not yet pushed, no PR or npm release yet); 16 phases, 36 plans, 34/34 requirements. [Archive](milestones/behavioral-gaps-ROADMAP.md), [requirements](milestones/behavioral-gaps-REQUIREMENTS.md), [audit](milestones/behavioral-gaps-MILESTONE-AUDIT.md).
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

### In progress integration-rescope -- Integration Test Rescope

**Milestone goal:** Every file in `test/integration/` either guards something
that the cucumber suite and the unit tests cannot reach, or is deleted. Its
user-visible cases live in cucumber scenarios that pass under both MCP
profiles.

Inputs: `.planning/PROJECT.md` (Current Milestone), `.planning/REQUIREMENTS.md`
(19 requirements and the four rules that every ITMIG requirement must meet),
and [research/INTEGRATION-OVERLAP.md](research/INTEGRATION-OVERLAP.md), the
audit of the 45 integration test files against the 149 feature files. The
audit read code and ran nothing, so its verdicts are leads, not proof.

Feature paths below are relative to `features/`. Integration files are named
without the `.test.ts` suffix and live in `test/integration/`.

#### Order and parallel work

Phase 1 is small and goes first, but it blocks no other phase. Phases 1 to 6
depend on no other phase. Each owns its own feature files and its own
integration files, so they can run in parallel. Phase 7 starts after Phase 3
merges, because both change the marketplace publishing harness. Phase 8 runs
alone, after the last migration phase merges.

| Phase | Requirements | Feature files it adds to or changes | Integration files it trims or deletes | Depends on |
| --- | --- | --- | --- | --- |
| 1 | ITDUP-01, ITDUP-02 | `plugin/subagent-child.feature`, `plugin/session-start-hooks.feature`, `agent/frontmatter.feature` | `hooks-spawn-end-to-end`, `pi-subagents-child-identity` | nothing |
| 2 | ITMIG-01..04 | `plugin/{install,uninstall,enable,disable,update,reinstall,configuration,config-migration,pending,list,info,import}.feature`, and one NEW file under `plugin/` for the `constructor` and `__proto__` names | `plugin-layer-verbs`, `plugin-layer-consistency`, `reserved-record-keys`, `fold-adoption` | nothing |
| 3 | ITMIG-05, ITMIG-06 | `marketplace/{add,autoupdate,remove,url-source}.feature`, `plugin/cross-scope-install.feature` | `marketplace-layer-autoupdate`, `marketplace-layer-redeclare`, `marketplace-layer-remove`, `marketplace-add-seed-mirrors`, `project-install-adds-user-marketplace` | nothing |
| 4 | ITMIG-08 | `plugin/prune.feature` | `standalone-prune` | nothing |
| 5 | ITMIG-09..11 | `mcp-server/**` | `mcp-home-path-partial`, `mcp-tool-rules`, `mcp-variable-expansion`, `mcp-legacy-sweep`, `mcp-migration`, `mcp-verdict-migration`, `mcp-override-lifecycle` | nothing |
| 6 | ITMIG-12, ITMIG-13 | `hook/**`, `marketplace/{device-flow,git-source}.feature` | `hooks-cross-scope-reconcile`, `hooks-additionalcontext-end-to-end`, `hooks-dispatch-end-to-end`, `auth-e2e` | nothing |
| 7 | ITMIG-07 | `plugin/{install-dependencies,update-dependencies}.feature` | `path-source-tag-install` | Phase 3 |
| 8 | ITSCOPE-01..04 | any file that a case moved under ITSCOPE-01 needs | the 21 files no migration phase touches, and every file the earlier phases left | Phases 1 to 7 |

**Shared files.** `features/support/**`, `features/lib/**`, the shared and
topic step modules that the cucumber skill's layout rules name (`command`,
`config`, `session`, `scope-state`, `git-host`, `mcp-configuration`,
`plugin/publishing`, `plugin/installation`, `marketplace/publishing`,
`marketplace/checkout`, `hook/runs`, and the rest), `cucumber.json`, and
`scripts/check-features.mjs` belong to no phase. A phase puts a new step in
its own verb module, with text that names its verb (D-08), whenever it can. A
phase that must change a shared file names that file in its plan. When two
parallel phases change the same shared file, the phase that merges second
resolves the overlap and runs `npm run check` again. Two shared additions are
known now: Phase 6's print-mode driver and Phase 7's marketplace tag step.

**Parent lines.** When phases run in parallel sessions, no phase edits
`CHANGELOG.md`, `.planning/BACKLOG.md`, or the Key Decisions table of
`.planning/PROJECT.md`. Each phase lists its lines for those files under
"Parent lines" in its last plan's `SUMMARY.md`, and the parent session applies
them at the merge.

#### Milestone rules

- **Check again, then delete.** Before a phase deletes an integration case, it
  breaks the behavior on purpose and sees a scenario fail (rule 2 of
  REQUIREMENTS.md). The plan's `SUMMARY.md` records how it broke the behavior
  and which scenario failed. The phase reverts the break and never commits it.
- **Both profiles (D-BG-04).** "Passes under both profiles" means that
  `npm run test:cucumber` is green under the `adapter` profile and under the
  `builtin` profile. A scenario with an MCP surface carries `@mcp`, or an
  `@adapter-only` and `@builtin-only` pair that names its licensing ID, so it
  runs under both. A scenario with no MCP surface runs once, under `adapter`
  (DUAL-02).
- **Upstream parity.** A scenario expects Claude Code's behavior, or it names
  the decision ID or the Pi gap that licenses a divergence (`AGENTS.md`). Many
  moved cases pin project decisions, such as LAYER-04, D-09, D-MF-04, and
  AMIG-02, and their scenarios name those IDs. A case that would pin an
  unlicensed divergence goes to the user as a question, and its integration
  case stays until the user answers.
- **What a phase deletes.** A phase deletes the cases that its new scenarios
  replace, and a file that is left with no case (rule 3). It may also delete a
  case that the audit marks as already covered, after the same deliberate
  break; otherwise Phase 8 deletes it. A helper file that no remaining test
  imports goes with the last test that used it.
- **Bugs.** A product bug that a new scenario exposes is fixed in the phase
  when the fix is small. Otherwise it gets a BACKLOG entry, and the
  integration case that guards it stays (rule 4). Such a kept case is the one
  case that ITSCOPE-01's three classes allow beside them; its file comment
  names the BACKLOG ID (ITSCOPE-02).
- **User-visible cases the audit found partly covered.** At the user's
  request (2026-11-20), the requirement of the phase that owns each file
  names them, so they become scenarios like the rest: ITMIG-02, ITMIG-05,
  ITMIG-06, ITMIG-08, ITMIG-09, ITMIG-10 (which also takes the legacy-record
  `list` row from `mcp-verdict-list`), and ITMIG-11.
- **Gates.** The local-verification skill schedules the checks. Each phase
  gate runs `npm run check`. ITSCOPE-04 is the milestone's last gate, on the
  combined tree.

- [x] **Phase 1: Duplicate Integration Files** - The two integration files that only repeat cucumber scenarios are gone, after their scenarios are proven to fail when the behavior breaks (completed 2026-11-21)
- [x] **Phase 2: Plugin Layers, Names, and List Fold** - Scenarios prove the LAYER-04 refusals, the plugin-layer reports, plugin names that are `Object.prototype` members, and the unfiltered `list` fold (completed 2026-11-21)
- [x] **Phase 3: Marketplace Layers and Cross-Scope Install** - Scenarios prove the marketplace layer rules and a project install that adds a user marketplace to the project (completed 2026-11-21)
- [x] **Phase 4: Prune** - Scenarios prove the `prune` cases a user can see that the suite left out (completed 2026-11-22)
- [x] **Phase 5: MCP Install, Legacy Move, and Overrides** - Scenarios prove the MCP install refusals and warnings, the legacy `mcp.json` move, and the pi-mcp-adapter override cases (completed 2026-11-22)
- [ ] **Phase 6: Hooks and Auth** - Scenarios prove hooks in both scopes after `apply`, a reload that clears buffered context, no `.pi` directory from a hook dispatch, and the print-mode and credential-eviction sign-in cases
- [ ] **Phase 7: Path-Source Dependency Tags** - A step publishes a marketplace repository with a tag, and scenarios prove that a constrained path-source dependency installs from that tag, with the TAGS-02 fallback
- [ ] **Phase 8: Integration Suite Rescope** - Every case left in `test/integration/` is conformance, a race, or internal, each file says what it guards, the charter is written down, and `npm run check` passes on the combined tree

<details>
<summary>✅ parity-gaps — Claude Code Parity Gaps and Defects — SHIPPED 2026-11-17</summary>

11 phases, 102 plans. The phase list is in the [archive](milestones/parity-gaps-ROADMAP.md).

**Outcome:** 42/42 requirements, 11/11 phases, 9/9 integration seams, and 6/6 flows pass; 2100 adapter-profile and 204 builtin-profile cucumber scenarios. The audit reads `tech_debt` with no blockers. Phase 5 closed with a verification override (`human_needed` on A9 alone: the start-failure notice has not run on Node 24, and the PR's CI closes it). The runtime UAT was skipped by the user's choice; the cucumber suite, with a real Pi and real companion extensions, stands in for it.

</details>

<details>
<summary>✅ behavioral-gaps — Behavioral Coverage Gaps — SHIPPED 2026-11-08</summary>

16 phases, 36 plans. The phase list is in the [archive](milestones/behavioral-gaps-ROADMAP.md).

**Outcome:** 34/34 requirements, 16/16 phases, 11/11 integration checks, and 16/16 phase flows pass; 1779 adapter-profile and 153 builtin-profile cucumber scenarios. The audit reads `tech_debt` with no blockers. Phases 1, 4, and 6 closed with a stale-verification override: later merges changed files they verified, and the combined tree passes `npm run check`. The adapter-profile order flakes were fixed by `d04a5106`.

</details>

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

## Phase Details

### Phase 1: Duplicate Integration Files

**Goal**: The two integration files that only repeat cucumber scenarios are gone. Before each one goes, a deliberate break proves that the scenarios which replace it fail when its behavior breaks.
**Depends on**: Nothing (first phase; it blocks no other phase)
**Requirements**: ITDUP-01, ITDUP-02
**Evidence**: Audit rows `hooks-spawn-end-to-end` (DUPLICATED) and `pi-subagents-child-identity` (DUPLICATED, near).
**Notes**: `plugin/session-start-hooks.feature` covers the SessionStart side effect, and the dir-source hook scenarios cover a `CLAUDE_PLUGIN_ROOT` outside the extension directory (HOOK-E2E-05). If a break shows a gap, the phase adds the missing scenario to `plugin/session-start-hooks.feature` before it deletes the file. The gaps of `pi-subagents-child-identity` are a child of an agent whose body is empty, and the `Read` that fails in that child: its `PostToolUseFailure` hook carries the child's identity. The real-child steps of `plugin/subagent-child.feature` and `agent/frontmatter.feature` already start real pi-subagents children. This file and `subagent-hook-ownership` are the only integration files that import from `features/lib`.
**Success Criteria** (what must be TRUE):
  1. Breaking the SessionStart hook's side effect fails a scenario, and so does breaking hook spawning for a plugin whose `CLAUDE_PLUGIN_ROOT` lies outside the extension directory. With the breaks reverted, these scenarios pass under both profiles, and `test/integration/hooks-spawn-end-to-end.test.ts` no longer exists (ITDUP-01).
  2. A scenario starts a real pi-subagents child of an agent whose body is empty. The child runs detached; its `Bash` and `Read` hooks, including the `PostToolUseFailure` hook of the `Read` that fails, carry the child's agent type and session id; and no main-session hook carries a child identity (ITDUP-02).
  3. The scenarios of criterion 2 pass under both profiles and fail when the child's hook identity is broken on purpose, and `test/integration/pi-subagents-child-identity.test.ts` no longer exists (ITDUP-02).
**Plans**: 2/2 plans complete

Plans:
- [x] 01-01-PLAN.md -- Wave 1: record breaks E1 to E5 against the hook scenarios, then delete `hooks-spawn-end-to-end` (ITDUP-01)
- [x] 01-02-PLAN.md -- Wave 1: add the empty-body real-child scenario, record breaks E6 to E11, point the docs at the scenarios, then delete `pi-subagents-child-identity` (ITDUP-02)

**Cross-cutting constraints:** <!-- gsd:generated -->
- When the plan ends, `git diff <plan base> HEAD -- extensions/` and `git status --porcelain -- extensions/` both print nothing: no break stays in the tree or reaches a commit.

### Phase 2: Plugin Layers, Names, and List Fold

**Goal**: Cucumber scenarios, not integration cases, prove that plugin commands refuse when the other layer's config cannot be read, that layer inconsistencies are reported, that plugin and marketplace names which are `Object.prototype` members work as ordinary names, and that the unfiltered `list` folds a project install under its user marketplace.
**Depends on**: Nothing (it runs beside Phases 1 and 3 to 6)
**Requirements**: ITMIG-01, ITMIG-02, ITMIG-03, ITMIG-04
**Evidence**: Audit rows `plugin-layer-verbs`, `plugin-layer-consistency`, `reserved-record-keys`, and `fold-adoption`. "Cheapest moves" in the audit says that steps already exist for LAYER-04, the consistency cases, and both names.
**Notes**: The LAYER-08 cases of `plugin-layer-verbs` are already covered (`plugin/reinstall.feature`, `plugin/update.feature`). Its two LAYER-06 cases tamper `state.json` to a future source kind; they are internal and stay for Phase 8. `marketplace/reserved-name.feature` refuses `constructor` only on `marketplace add`, so the reload that declares `hello@constructor` is new. Every `constructor` and `__proto__` scenario goes in one new feature file under `plugin/`, so this phase edits no `marketplace/` file. ITMIG-04 sits here, not with Phase 3, because its scenarios land in `plugin/list.feature`, which this phase owns.
**Success Criteria** (what must be TRUE):
  1. With the other layer's config unreadable, each of `install`, `uninstall`, `enable`, `disable`, `update`, and `reinstall` refuses, for a target in the base layer and for one in the local layer, and changes no config, record, or staged artifact. These 12 scenarios pass under both profiles, each fails when its refusal is removed on purpose, and the 12 LAYER-04 cases are gone from `plugin-layer-verbs` (ITMIG-01).
  2. Scenarios show the user-scope local gap, a legacy local layer from an earlier `--local` install kept byte for byte, `pending` before the first-run migration, and a malformed key such as `demo@` reported as a source mismatch. They pass under both profiles, fail under a deliberate break, and the cases they replace are gone from `plugin-layer-consistency` (ITMIG-02).
  3. A plugin named `constructor` installs, lists, shows in `info`, disables, enables, updates, uninstalls, imports, and goes when its marketplace is removed; a plugin named `__proto__` lists as unavailable; and a reload that declares `hello@constructor` records nothing. The scenarios pass under both profiles, fail under a deliberate break, and `reserved-record-keys` keeps no case they replace (ITMIG-03).
  4. The unfiltered `list` shows a project install from a user marketplace as a `[project]` row under that user marketplace, and shows an independently added project marketplace on its own, with no duplicate row. The scenarios pass under both profiles, fail under a deliberate break, and `fold-adoption` no longer exists (ITMIG-04).
**Plans**: 4/4 plans complete

Plans:
- [x] 02-01-PLAN.md -- Wave 1: twelve LAYER-04 scenarios in the six verb files, breaks B1, B2, and B12, then trim `plugin-layer-verbs` to its two LAYER-06 cases (ITMIG-01)
- [x] 02-02-PLAN.md -- Wave 1: the plugin-layer consistency scenarios in `configuration.feature` and `config-migration.feature`, breaks B8, B9, B14, B10, and B11, then delete `plugin-layer-consistency` (ITMIG-02)
- [x] 02-03-PLAN.md -- Wave 1: the new `plugin/reserved-names.feature` for `constructor`, `__proto__`, and `hello@constructor`, breaks B3, B4, B5, and B13, then delete `reserved-record-keys` (ITMIG-03)
- [x] 02-04-PLAN.md -- Wave 1: the two unfiltered `list` fold scenarios, breaks B6, B6b, and B7, the comments that cited the file, then delete `fold-adoption` (ITMIG-04)

**Cross-cutting constraints:** <!-- gsd:generated -->
- When the plan ends, `git diff <plan base> HEAD -- extensions/` and `git status --porcelain -- extensions/` both print nothing.

### Phase 3: Marketplace Layers and Cross-Scope Install

**Goal**: Cucumber scenarios prove the marketplace layer rules (D-09, CFG-03, LAYER-02, a re-declaration with no git request, and the named remove of an undeclared marketplace) and a project install that adds a user marketplace to the project (WR-07, MA-12, MA-13, D-MF-04).
**Depends on**: Nothing (it runs beside Phases 1, 2, and 4 to 6)
**Requirements**: ITMIG-05, ITMIG-06
**Evidence**: Audit rows `marketplace-layer-autoupdate`, `marketplace-layer-redeclare`, `marketplace-layer-remove`, `marketplace-add-seed-mirrors`, and `project-install-adds-user-marketplace`. "Cheapest moves" in the audit names the steps: `a config in scope ... with this text` for a marketplace that state records and no layer declares, and `the git host receives no request` for the no-request checks.
**Notes**: These cases are internal and stay for Phase 8: the EACCES unstage cases of `marketplace-layer-remove` (partial remove, failure-only, and PRUNE-03), which need fault injection that the harness lacks (Out of Scope), and the mirror seeding, mirror remote, unseeded pin, mirror GC, and no-call checks of `marketplace-add-seed-mirrors`. LAYER-02 and D-07 of `marketplace-layer-autoupdate`, and the blockers, D-05-07, and held-lock cases of `marketplace-layer-remove`, are already covered. MA-12 and MA-13 need a leftover clone of this extension, or a foreign tree, at the project's clone path before the install. D-MF-04 needs a user clone that is older than the marketplace, so that the fresh project clone holds a different dependency list.
**Success Criteria** (what must be TRUE):
  1. A named `marketplace autoupdate` flip adds a marketplace that the scope records and no layer declares to no layer, and an unnamed flip gives it no row while a declared marketplace flips (D-09). A named flip whose target layer is silent while the other layer's config is invalid changes no file (CFG-03). The scenarios pass under both profiles, fail under a deliberate break, and the cases they replace are gone from `marketplace-layer-autoupdate` (ITMIG-05).
  2. Declaring a url marketplace again, in the local layer or after the scope records it with no layer declaring it, makes no second clone and no git request, and so does installing a url plugin from the same repository after the add. A named remove fully removes a recorded url marketplace that no layer declares, and a remove refused because the other layer's config cannot be read changes nothing (LAYER-02). The scenarios pass under both profiles, fail under a deliberate break, and the cases they replace are gone from `marketplace-layer-redeclare`, `marketplace-layer-remove`, and `marketplace-add-seed-mirrors` (ITMIG-05).
  3. A project install from a marketplace that only the user scope records fails before the project clones when the manifest does not list the plugin (WR-07), replaces the extension's own leftover clone (MA-12), refuses a foreign tree at the clone path and keeps it (MA-13), and reads the plugin's dependencies from the fresh project clone, not from the stale user clone (D-MF-04). The scenarios pass under both profiles, fail under a deliberate break, and the cases they replace are gone from `project-install-adds-user-marketplace` (ITMIG-06).
**Plans**: 4/4 plans complete

Plans:
- [x] 03-01-PLAN.md -- Wave 1: the D-09 named and unnamed flips and the CFG-03 flip in `marketplace/autoupdate.feature`, breaks A1 to A5b, then delete `marketplace-layer-autoupdate` (ITMIG-05)
- [x] 03-02-PLAN.md -- Wave 1: eight url remove scenarios in `marketplace/remove.feature` with two new steps in `plugin/installation.steps.ts`, breaks R1 to R10, then trim `marketplace-layer-remove` to its three EACCES cases (ITMIG-05)
- [x] 03-03-PLAN.md -- Wave 1: the re-declaration and own-repository scenarios in `marketplace/url-source.feature` with the own-repository offer step, breaks D1 and D2, the D-SEED-01 `.git` seeding fix test first, then delete `marketplace-layer-redeclare` (ITMIG-05)
- [x] 03-04-PLAN.md -- Wave 1: the WR-07, MA-12, MA-13, D-MF-04, and dependency-marketplace scenarios in `plugin/cross-scope-install.feature` with three new steps in `marketplace/checkout.steps.ts`, breaks C1 to C8, then delete `project-install-adds-user-marketplace` (ITMIG-06)

**Cross-cutting constraints:** <!-- gsd:generated -->
- When the plan ends, `git diff <plan base> HEAD -- extensions/` and `git status --porcelain -- extensions/` both print nothing.

### Phase 4: Prune

**Goal**: Cucumber scenarios prove every `prune` behavior a user can see that the suite left out, and `standalone-prune` keeps only its internal cases.
**Depends on**: Nothing (it runs beside Phases 1 to 3, 5, and 6)
**Requirements**: ITMIG-08
**Evidence**: Audit row `standalone-prune` (PARTIAL, 25 tests).
**Notes**: Already covered: the held lock, the orphan removal, the dry-run preview, and the usage errors. The internal cases stay for Phase 8: prune never calls `applyReconcile` or `installMissingDependencies` and makes no git call. The integration case makes a member fail through a tampered record (a skill path of `../invalid`); the scenario needs a failure that a user could meet, or the case stays as fault injection (Out of Scope). The verb module is `plugin/prune.steps.ts`, the name that behavioral-gaps reserved for prune and never created.
**Success Criteria** (what must be TRUE):
  1. Each remaining empty-scope variant of `prune` and `prune --dry-run`, with and without `--scope`, reports the empty scope and changes nothing, and both forms report a malformed state file without showing its path. The scenarios pass under both profiles, fail under a deliberate break, and the cases they replace are gone from `standalone-prune` (ITMIG-08).
  2. A prune keeps held neighbours across marketplaces, selects again when a stale preview has changed on disk, keeps a failed member's dependency until a later retry removes both, previews with no project state and leaves both scopes as they were, and refuses without changing either scope when a declarer's manifest cannot be read. The scenarios pass under both profiles, fail under a deliberate break, and the cases they replace are gone from `standalone-prune` (ITMIG-08).
  3. `prune -y`, `prune --keep-data`, and `prune --prune` are refused with the prune usage line before any orphan is selected, and both scopes stay unchanged. The scenarios pass under both profiles, fail under a deliberate break, and the cases they replace are gone from `standalone-prune` (ITMIG-08).
**Plans**: 2/2 plans complete

Plans:
**Wave 1**
- [x] 04-01-PLAN.md -- Wave 1: twelve prune scenarios (E01, M01, FL01, S01, C01, A01, P01, N02, U01, F01, F02, L01) in `plugin/prune.feature` with three Givens in the new `plugin/prune.steps.ts`, breaks K1 to K29 (K2 the accepted survivor), then trim `standalone-prune` to its two call-absence carriers (ITMIG-08)

**Wave 2** *(blocked on Wave 1 completion)*
- [x] 04-02-PLAN.md -- Wave 2: the backup-leak fix in `orchestrators/plugin/prune-rollback.ts` test first, with four unit cases, the no-backup scenario F03 and its `Then`, and break B1 on the fixed tree (ITMIG-08, rule 4)

### Phase 5: MCP Install, Legacy Move, and Overrides

**Goal**: Cucumber scenarios prove the MCP install refusals, warnings, and variable handling, the move of a legacy `mcp.json` with its notices, and the pi-mcp-adapter override cases, and the integration cases they replace are gone.
**Depends on**: Nothing (it runs beside Phases 1 to 4 and 6)
**Requirements**: ITMIG-09, ITMIG-10, ITMIG-11
**Evidence**: Audit rows `mcp-home-path-partial`, `mcp-tool-rules`, `mcp-variable-expansion`, `mcp-legacy-sweep`, `mcp-migration`, `mcp-verdict-migration`, and `mcp-override-lifecycle`. The Group B note in the audit: no step reads `compatibilityBasis`, `mcpServerConfigs`, `resources.mcpServers`, `keptOverride`, or `serverChoices`.
**Notes**: The override cases (ITMIG-11) and the move of a legacy `mcp.json` (ITMIG-10) are pi-mcp-adapter behavior, so their scenarios carry `@adapter-only` with the ID that licenses each (AFILE-06, D-08-01, D-08-02, AMIG-01, AMIG-02, AMIG-04). The install refusals and the variable cases (ITMIG-09) carry `@mcp` or a licensed pair. These cases are internal and stay for Phase 8: the `keptOverride` and `serverChoices` field checks, the recovery after a refused write between the two writes of the move (fault injection, Out of Scope), and the released-build record cases of `mcp-verdict-migration` other than the partly-installed list row. Earlier-release records come from `features/lib/mcp-builtin-earlier-record.ts` and `features/lib/earlier-version-state.ts`.
**Success Criteria** (what must be TRUE):
  1. A normal install of a plugin whose stdio args hold a literal `~/` refuses with `{unsupported mcp}` and the `--partial` hint, `--partial` installs the plugin without that server, and an install of a server with tool permission rules warns that the rules are not enforced. The scenarios pass under both profiles, fail under a deliberate break, and `mcp-home-path-partial` and `mcp-tool-rules` no longer exist (ITMIG-09).
  2. AVAR-04 notices follow the result rows on `update`, `reinstall`, and `enable`; a deny-listed credential is withheld with a notice (AVAR-05); `${CLAUDE_PROJECT_DIR}` reaches the server expanded; `!` is written as `!!`; and a secret value never appears in `mcp-adapter.json`. The scenarios pass under both profiles, fail under a deliberate break, and the cases they replace are gone from `mcp-variable-expansion` (ITMIG-09).
  3. An install removes a plugin's marked entries, old-name stubs, and direct-tools copies from a legacy `mcp.json` and keeps the user's own servers (AMIG-02). A load that moves both scopes shows one notice, with the project rows first, warns about unowned entries (AMIG-04), reports undeclared, unsupported, and malformed entries, and leaves a plugin that lists as partly installed. The scenarios pass under both profiles, fail under a deliberate break, and the cases they replace are gone from `mcp-legacy-sweep`, `mcp-migration`, and `mcp-verdict-migration` (ITMIG-10).
  4. Under pi-mcp-adapter, a project install keeps a user stub and writes it back on uninstall, a user plugin disabled in the project stays disabled through install, update, reinstall, and uninstall, an `/mcp-adapter enable` survives, an update that drops a server keeps its choice and a later version that restores the server restores the choice, and `openUi` and `trace` survive a reinstall. The scenarios pass under both profiles, fail under a deliberate break, and the cases they replace are gone from `mcp-override-lifecycle` (ITMIG-11).
**Plans**: 3/3 plans complete

Plans:
- [x] 05-01-PLAN.md -- Wave 1: eight AVAR and ANAME-07 scenarios and three Outline rows in `mcp-server/configuration.feature`, the D-PG10-11 scenario in `mcp-server/options.feature`, the environment-variable profile Pi Given, breaks M1 to M10 under both profiles, then delete `mcp-home-path-partial`, `mcp-tool-rules`, and `mcp-variable-expansion` (ITMIG-09)
- [x] 05-02-PLAN.md -- Wave 1: sixteen sweep and move scenarios in `mcp-server/legacy-move.feature` and three list scenarios in `mcp-server/verdict-list.feature`, two new Givens, breaks L1b to L15, M2, and V1 to V3b under both profiles, then delete `mcp-legacy-sweep` and trim `mcp-migration`, `mcp-verdict-migration`, and `mcp-verdict-list` (ITMIG-10)
- [x] 05-03-PLAN.md -- Wave 1: twenty-five override and choice scenarios in `mcp-server/lifecycle.feature`, two new Givens, breaks O1 to O10 under both profiles, then delete `mcp-override-lifecycle` (ITMIG-11)

**Cross-cutting constraints:** <!-- gsd:generated -->
- When the plan ends, its commits change only the files of `files_modified` and `files_deleted`, no file under `extensions/` changed, and `git status --porcelain -- extensions/ features/ test/` prints nothing.

### Phase 6: Hooks and Auth

**Goal**: Cucumber scenarios prove that hooks in both scopes still run after `apply` and after a load, that a reload before the first prompt clears buffered SessionStart context, that a hook dispatch creates no `.pi` directory, and that a print-mode sign-in refuses cleanly and a rejected credential is replaced; the integration cases they replace are gone.
**Depends on**: Nothing (it runs beside Phases 1 to 5)
**Requirements**: ITMIG-12, ITMIG-13
**Evidence**: Audit rows `hooks-cross-scope-reconcile`, `hooks-additionalcontext-end-to-end`, `hooks-dispatch-end-to-end`, and `auth-e2e`.
**Notes**: No feature runs Pi in print mode, and no print driver exists (D-BG-601), so this phase adds one as a new `features/lib/` module. `marketplace/git-source.feature` stops at the rejected credential. The eviction and the new Device Flow sign-in use the stand-ins of `marketplace/device-flow.feature`, and these scenarios start Pi with GitHub's requests routed to the stand-ins (D-BG-1101). These cases are internal and stay for Phase 8: a throwing project hydrate that must not block dispatch (`hooks-dispatch-end-to-end`), and a staging cleanup failure that keeps the print refusal as the primary cause (`auth-e2e`, fault injection). Already covered: HOOK-E2E-03 (`hook/additional-context.feature`), AUTH-01 and AUTH-02/08 (`marketplace/device-flow.feature`), and five of the seven cases of `hooks-dispatch-end-to-end`.
**Success Criteria** (what must be TRUE):
  1. With hook plugins installed in both scopes, their hooks still run after `/claude:plugin apply` and after a load. The scenarios pass under both profiles, fail under a deliberate break, and `hooks-cross-scope-reconcile` no longer exists (ITMIG-12).
  2. A `/reload` before the first prompt drops the SessionStart context buffered before it, and a hook dispatch in a project that had no `.pi` directory leaves none behind (WR-05). The scenarios pass under both profiles, fail under a deliberate break, and the cases they replace are gone from `hooks-additionalcontext-end-to-end` and `hooks-dispatch-end-to-end` (ITMIG-12).
  3. In print mode, a `marketplace add` that needs a sign-in refuses with its remedy and leaves no staged clone behind. When the git host rejects the stored credential, the credential is evicted and the next clone signs in through Device Flow again (AUTH-07). The scenarios pass under both profiles, fail under a deliberate break, and the cases they replace are gone from `auth-e2e` (ITMIG-13).
**Plans**: 2/2 plans executed

Plans:
- [x] 06-01-PLAN.md -- Wave 1: the ESRCH and partial-line harness race fixes as the first two commits, the WR-05, load, apply, and reload scenarios in `hook/{session,lifecycle,additional-context}.feature` with the new `project.steps.ts` step, breaks X1 to CH2 (H4a the control), then delete `hooks-cross-scope-reconcile` and `hooks-additionalcontext-end-to-end`, trim `hooks-dispatch-end-to-end` to its throwing-hydrate case, and run the full adapter suite twice (ITMIG-12)
- [x] 06-02-PLAN.md -- Wave 1: the NEW one-shot print-mode driver `features/lib/pi-one-shot.ts` that the json driver delegates to, the routed one-shot launch in `world.ts`, three print-mode steps in `command.steps.ts`, the AUTH-07 and print-mode scenarios in `marketplace/device-flow.feature`, breaks E1 to R3, then trim `auth-e2e` to its fault-injection case (ITMIG-13)

### Phase 7: Path-Source Dependency Tags

**Goal**: A cucumber step publishes a marketplace repository with a tag, and scenarios prove that a constrained path-source dependency installs from the tag its constraint selects, with the TAGS-02 fallback to the current checkout; the integration cases they replace are gone.
**Depends on**: Phase 3 (both change the marketplace publishing harness: `marketplace/publishing.steps.ts` and the marketplace libraries under `features/lib/`)
**Requirements**: ITMIG-07
**Evidence**: Audit row `path-source-tag-install` (UNIQUE, 4 tests).
**Notes**: Tag steps exist only for plugin repositories today (`features/lib/git-plugin.ts`). The new step is a shared harness addition (see Shared files). CR-01, an untracked file in the marketplace root kept out of the materialized tag clone, is borderline: the phase gives it a scenario if a user can see the file, and otherwise it stays as an internal case. The check that two cascade members leave the marketplace clone's `.git/index` and `.git/HEAD` unchanged is internal and stays for Phase 8.
**Success Criteria** (what must be TRUE):
  1. A plugin whose path-source dependency carries a version constraint installs that dependency from the marketplace tag that the constraint selects, such as `formatter--v1.0.0`, while the marketplace HEAD has moved past the tag; the installed dependency shows the tag's version and content (TAGS-01, TAGS-03). The scenarios pass under both profiles, fail under a deliberate break, and the cases they replace are gone from `path-source-tag-install` (ITMIG-07).
  2. When no marketplace tag satisfies the constraint, both plugins still install, from the current checkout (TAGS-02). The scenario passes under both profiles, fails under a deliberate break, and the case it replaces is gone from `path-source-tag-install` (ITMIG-07).
**Plans**: TBD

### Phase 8: Integration Suite Rescope

**Goal**: Every case left in `test/integration/` guards something that cucumber and the unit tests cannot reach, each remaining file says what it guards, the suite's charter is written down, and the combined tree passes `npm run check`.
**Depends on**: Phases 1 to 7 (it runs alone, after the last merge)
**Requirements**: ITSCOPE-01, ITSCOPE-02, ITSCOPE-03, ITSCOPE-04
**Evidence**: The audit's Group A table (peer conformance and multi-process tests) and the internal rows of Groups B and C.
**Notes**: No migration phase touches these 21 files: `adapter-expansion-conformance`, `adapter-tool-name-conformance`, `agents-adapter-grant-conformance`, `agents-builtin-grant-conformance`, `mcp-adapter-entry-conformance`, `mcp-builtin-encoding-conformance`, `mcp-status-conformance`, `provenance-invisibility`, `skill-path-resolution`, `workflow-engine-agent-registry`, `pi-subagents-child-launch-conformance`, `hooks-result-boundary`, `concurrent-install`, `load-reconcile-race`, `subagent-hook-ownership`, `mcp-server-records`, `mcp-verdict-list`, `mcp-verdict-update`, `transaction-lifecycle-cascade`, `workflow-kind-inversion`, and `reconcile-plan-convergence`. Known moves: scenarios already cover the single-process D-13 case of `load-reconcile-race` and test 1 of `subagent-hook-ownership`, so those cases go. The pure in-memory fixed points of `reconcile-plan-convergence` fit none of ITSCOPE-01's classes, so they move to unit tests beside their source pair, under `test:corresponding` and 100% direct coverage. `test/bridges/mcp/expansion-cases.ts` serves only the conformance tests and stays with them. The legacy-record `list` row of `mcp-verdict-list` moves to cucumber in Phase 5 (ITMIG-10). The `integration` CI job and `test:integration` stay (Out of Scope).
**Success Criteria** (what must be TRUE):
  1. Every case in `test/integration/` is peer conformance against a peer's own code, a multi-process race, or an internal case (stored record fields, state that only older releases wrote, fault injection, or calls that must not happen), apart from a case kept under rule 4. Every other case runs as a unit test beside its source pair, or is gone because a scenario or a unit test covers it, and no helper module in `test/integration/` is left without an importer (ITSCOPE-01).
  2. The opening comment of each remaining integration file names its class and the behavior that cucumber does not cover (ITSCOPE-02).
  3. The `typescript-unit-tests` skill, the `cucumber` skill, and `.planning/codebase/TESTING.md` each state the suite's charter: what belongs in an integration test, and what goes to cucumber or to a unit test (ITSCOPE-03).
  4. `npm run check` exits 0 on the combined tree at the end of the milestone, with both cucumber profiles green and 100% direct coverage for every source-test pair (ITSCOPE-04).
**Plans**: TBD

## Progress

| Phase | Plans Complete | Status | Completed |
| --- | --- | --- | --- |
| 1. Duplicate Integration Files | 2/2 | Complete    | 2026-11-21 |
| 2. Plugin Layers, Names, and List Fold | 4/4 | Complete    | 2026-11-21 |
| 3. Marketplace Layers and Cross-Scope Install | 4/4 | Complete    | 2026-11-21 |
| 4. Prune | 2/2 | Complete    | 2026-11-22 |
| 5. MCP Install, Legacy Move, and Overrides | 3/3 | Complete    | 2026-11-22 |
| 6. Hooks and Auth | 2/2 | In Progress | - |
| 7. Path-Source Dependency Tags | 0/TBD | Not started | - |
| 8. Integration Suite Rescope | 0/TBD | Not started | - |

## Carried Forward

- parity-gaps: AGTLONGNAME-01 and PG1-TIMING-01 stay open; Phase 5 A9 closes with the PR's CI `behavioral` job on Node 24; SEED-261107-kax stays dormant pending upstream open-gsd/gsd-core#4649; the BACKLOG entries the milestone added (among them HOOKRESULT-01, MCPSAMPLING-01, MCPOPENUI-01, PITRUSTPATHS-01, STOPMODECHECK-01, and SIBLINGPREFIX-01) in [BACKLOG.md](BACKLOG.md).
- behavioral-gaps: the 25 BACKLOG entries the milestone added (among them ASYNCNEWSESSION-01, AMIGTRUST-01, WORKERHOMEDIR-01, SESSIONENDENV-01, PRUNECFG-01) in [BACKLOG.md](BACKLOG.md); the unknown writer to the real `~/.pi` during `npm run check` (P1-DC-53); Nyquist validation for phases 2, 3, 4, 8, 9, 10, 11, 12, 14, and 16.
- mcp-builtin: BACKLOG COMPLIMPL-01, STAMPTYPE-01, GRANTRUNARG-01, STAMPREQ-01, EDGEDEPSCASES-01, PENDAPPLY-01, CONTAINCATCH-01, BLTREPEAT-01, SUBCHILDVAR-01, BLTOWNER-01 (narrowed), DENYPIN-01, and the 17 deferred built-in MCP items in [BACKLOG.md](BACKLOG.md); Phase 2's one open Nyquist gap (a `/reload` implementation switch, MSEL-02); the Pi 1.5.0 RPC double `session_start` fix on `acolomba/pi` branch `fix/rpc-double-session-start`, for the user to report upstream.
- component-features: upstream fixes wait on the user's review on forks `acolomba/pi` (`fix/input-transform-expand-opt-out`) and `acolomba/pi-subagents` (`fix/mcp-direct-tools-adapter-7`); MCPBG-01, PIEXPAND-01, WFLOCAL-01 and MCPCANARY-01 stay in [BACKLOG.md](BACKLOG.md); D-CF7-05 awaits a live probe of Claude Code.
- `DEPADV-01` and `WOUT-01` remain in [BACKLOG.md](BACKLOG.md): Pi's shrinkwrap pins a nested `brace-expansion@5.0.9`, and workflow output is unobserved.
- Closed under D-BG-1001 (behavioral-gaps Phase 10, pending user review, P10-DC-01): the json-output `09/` D-03 choice. The LLM tools return `isError: true`, never throw; Pi 1.5.0 delivers a returned `isError` to the model as a failed tool result.
- `DBLEMIT-01`, `PSRC-01`, `USRCFG-01`, `MIGR-01`, and `NAMEFOLD-01` stay in [BACKLOG.md](BACKLOG.md), out of this milestone's scope.
- `HOSTED-DNS-01` remains accepted under D-PL5-31 until a hostname-resolution policy is designed and implemented.

Earlier carried items remain in [the archived roadmap](milestones/v1.20-ROADMAP.md), and their current dispositions are tracked in [WINDOWS.md](WINDOWS.md).
