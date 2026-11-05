---
phase: 01-foundation-and-pi-1-5-0
plan: "14"
subsystem: testing
tags: [phase-gate, cucumber, dual-profile, ci, fallow, frozen-record]

requires:
  - phase: 01-foundation-and-pi-1-5-0
    provides: "plans 01-01..01-13 merged: Pi 1.5.0, the run snapshot, the profiles, the record producer, the dual-profile harness, the session seeds, the status readers, the CI profile axis"
provides:
  - "The Phase 1 gate on the combined tree at f3ab832: npm run check (both cucumber profiles), test:modules, and test:e2e all exit 0"
  - "01-CI-HANDOFF.md: the CI measurement checklist the parent runs for DUAL-03 (D-CF1-16)"
  - "01-FROZEN.md: the frozen files, the ten frozen interfaces as built, the fallow entries to remove, the unemitted closed-set entries, and an empty CI timings section"
  - "A PROJECT RULES pointer to 01-FROZEN.md and a completed frozen list in CHILD-SESSION-BRIEF.md"
  - "The fallow entry list and the ignoreExports mechanism in CONVENTIONS.md, STACK.md, and ARCHITECTURE.md"
affects: [phase-2-builtin-materialization, phase-3-read-time-verdicts, phase-4-agent-grants, phase-5-hook-tool-names, phase-6-release-docs]

actuals:
  tokens: 9200
  tasks: 3
  commits: 2
plan_head_before: f3ab832f52a3c98c43b56c5e3def436aba24f556
plan_head_after: 90b2963
# commits counts the two task commits; the SUMMARY commit follows it.

tech-stack:
  added: []
  patterns:
    - "A frozen module or export that only a later phase consumes is a fallow entry plus a per-file ignoreExports entry, never a source marker in a frozen file"

key-files:
  created:
    - .planning/phases/01-foundation-and-pi-1-5-0/01-CI-HANDOFF.md
    - .planning/phases/01-foundation-and-pi-1-5-0/01-FROZEN.md
  modified:
    - .planning/CHILD-SESSION-BRIEF.md
    - .planning/codebase/CONVENTIONS.md
    - .planning/codebase/STACK.md
    - .planning/codebase/ARCHITECTURE.md

key-decisions:
  - "The gate ran in parts on f3ab832, with the cucumber step split into the three CI legs (adapter lifecycle, adapter components, builtin all); every part exited 0"
  - "01-FROZEN.md is authoritative where it differs from the ROADMAP text, and every difference names its P1-DC entry"
  - "test/architecture/behavioral-shard-coverage.test.ts is listed as frozen beside ci.yml, which it reads"
  - "The CONVENTIONS.md marker count now includes features/ (44), with the four harness extension defaults named"
  - "DUAL-03 stays unverified until the parent records a successful CI run at the merged gate commit"

patterns-established:
  - "Frozen-export exemption: fallow entry plus per-file ignoreExports, removed by the phase that lands the consumers"

requirements-completed: [PI15-01, PI15-02, PI15-03, MSEL-01, MREC-01, DUAL-01, DUAL-02, DUAL-03, MDEC-01]

coverage:
  - id: D1
    description: "The combined Phase 1 tree passes npm run check with both cucumber profiles, the whole test:modules, and test:e2e on one commit, with no user-visible output change"
    requirement: "PI15-03"
    verification:
      - kind: other
        ref: "npm run check:static, test:unpaired, test:integration, test:coverage:direct:all at f3ab832"
        status: pass
      - kind: automated_ui
        ref: "npm run test:cucumber:profile -- --profile adapter features/marketplace features/plugin (1168 scenarios) at f3ab832"
        status: pass
      - kind: automated_ui
        ref: "npm run test:cucumber:profile -- --profile adapter features/skill features/slash-command features/agent features/hook features/mcp-server features/workflow (390 scenarios) at f3ab832"
        status: pass
      - kind: automated_ui
        ref: "npm run test:cucumber:profile -- --profile builtin (39 scenarios) at f3ab832"
        status: pass
      - kind: unit
        ref: "npm run test:modules at f3ab832"
        status: pass
      - kind: e2e
        ref: "npm --prefix test/e2e/pi-peer-floor ci --ignore-scripts && npm run test:e2e at f3ab832"
        status: pass
      - kind: unit
        ref: "test/architecture/catalog-uat/catalog-contract.test.ts (324 states, 54652 bytes) and git diff --stat 2799bd1..HEAD -- docs/output-catalog.md test/architecture/catalog-uat (empty)"
        status: pass
    human_judgment: false
  - id: D2
    description: "The parent session measures the three behavioral legs on hosted CI and records DUAL-03"
    requirement: "DUAL-03"
    verification:
      - kind: other
        ref: "grep D-CF1-16, timeout-minutes, builtin in 01-CI-HANDOFF.md"
        status: pass
    human_judgment: true
    rationale: "The executor has no GitHub tools; DUAL-03 is verified only when the parent pushes, dispatches ci.yml, and records a successful run at the merged gate commit"
  - id: D3
    description: "01-FROZEN.md lists every frozen path and the ten frozen interfaces as built, and the child brief points to it"
    requirement: "MDEC-01"
    verification:
      - kind: other
        ref: "git ls-files check of every listed path and glob (58 entries, all tracked); grep -c 01-FROZEN.md .planning/CHILD-SESSION-BRIEF.md = 1"
        status: pass
    human_judgment: true
    rationale: "Whether the record is complete against the ROADMAP text and the code is a reading judgment; no test asserts it"
  - id: D4
    description: "The codebase docs state the fallow entry list and the ignoreExports mechanism"
    verification:
      - kind: other
        ref: "grep -c ignoreExports .planning/codebase/CONVENTIONS.md = 2; rg -n fallow-ignore extensions features test scripts | wc -l = 44"
        status: pass
    human_judgment: false

duration: 28min
completed: 2026-11-04
status: complete
---

# Phase 1 Plan 14: Phase Gate, CI Handoff, and Frozen Record Summary

**The combined Phase 1 tree at f3ab832 passes `npm run check` with both cucumber profiles (1558 adapter and 39 builtin scenarios), the whole `test:modules`, and the pinned e2e suite, with the catalog unchanged; the parent gets a DUAL-03 CI checklist, and the child sessions get 01-FROZEN.md with every frozen path and the ten interfaces as built.**

## Performance

- **Duration:** 28 min
- **Started:** 2026-11-04T08:29:17Z
- **Completed:** 2026-11-04T08:57:30Z
- **Tasks:** 3 (Task 1 changed no file and has no commit)
- **Files modified:** 6

## Gate results (Task 1)

All commands ran on commit `f3ab832f52a3c98c43b56c5e3def436aba24f556`, Node
v24.22.1, 4 CPUs, each through
`npm_config_script_shell=<scratchpad>/nondac-sh NODE_OPTIONS=--max-old-space-size=6144`,
after `npm ci`, `node scripts/install-test-peers.mjs`, and a lone
`npm run lint` to warm ESLint (exit 0, 167 s). `npm run check` ran as its
parts in the script's order, with `test:cucumber` split into the three CI legs.

| Command | Exit | Duration | Result |
| --- | --- | --- | --- |
| `npm run check:static` | 0 | 50 s | typecheck, lint, lint:workflows, fallow, format:check, test:corresponding, check:features all passed |
| `npm run test:unpaired` | 0 | 19 s | |
| `npm run test:integration` | 0 | 32 s | |
| `npm run test:cucumber:profile -- --profile adapter features/marketplace features/plugin` | 0 | 168 s | 1168 scenarios, 12026 steps passed; cucumber 2m 45.8s; seed 807146 |
| `npm run test:cucumber:profile -- --profile adapter features/skill features/slash-command features/agent features/hook features/mcp-server features/workflow` | 0 | 268 s | 390 scenarios, 4792 steps passed; cucumber 4m 25.4s; seed 816480 |
| `npm run test:cucumber:profile -- --profile builtin` | 0 | 27 s | 39 scenarios, 529 steps passed; cucumber 0m 23.7s; seed 261084 |
| `npm run test:coverage:direct:all` | 0 | 170 s | 335 LCOV records; every pair at 100% |
| `npm run test:modules` | 0 | 161 s | |
| `npm --prefix test/e2e/pi-peer-floor ci --ignore-scripts` | 0 | 5 s | |
| `npm run test:e2e` | 0 | 14 s | installed Pi 1.5.0 and peer floor Pi 1.5.0, json and rpc modes |
| `node --test test/architecture/catalog-uat/catalog-contract.test.ts` | 0 | 1.3 s | 5 tests pass; `EXPECTED_STATE_COUNT = 324`, `EXPECTED_UTF8_BYTES = 54_652` |
| `git diff --stat 2799bd1..HEAD -- docs/output-catalog.md test/architecture/catalog-uat` | 0 | | prints nothing |

- The adapter profile ran 1558 scenarios in two calls (1168 + 390), the same
  count the orchestrator's wave-4 gate saw. No step was failed, undefined, or
  ambiguous under either profile. No flake showed, so nothing was rerun.
- The phase base is `2799bd10427bfccda20bf00997a87d422e3975f5`, the commit
  that added the phase plans.
- The two later commits of this plan change only `.planning/**/*.md`:
  `git diff f3ab832 -- . ':(exclude,glob).planning/**/*.md'` prints nothing,
  so the gate result holds for the merged head (local-verification gates
  rule).
- The tracer feedback gate: `<verify>` carries only automated commands, and
  the run is unattended, so the gate re-ran nothing beyond the commands above,
  which all passed, and the plan went on.

## DUAL-03 status

**DUAL-03 is unverified until the parent records a successful CI run at the
merged gate commit.** The executor has no GitHub tools, so it did not push or
dispatch CI. `01-CI-HANDOFF.md` gives the parent the gate commit, the three
leg names (`behavioral tests, adapter lifecycle (Node 24)`,
`behavioral tests, adapter components (Node 24)`,
`behavioral tests, builtin all (Node 24)`), the current
`timeout-minutes: 15`, the D-CF1-16 rule, the PROJECT.md row text to amend,
and the `## CI timings` section of `01-FROZEN.md` to fill.

## Accomplishments

- Proved ROADMAP Phase 1 success criteria 1-5 locally on one commit of the
  combined tree, under both cucumber profiles, with no output change.
- Wrote the CI handoff for DUAL-03 (D-CF1-16).
- Wrote `01-FROZEN.md`: 58 path entries, all tracked; the ten interfaces with
  signatures copied from the source; each difference from the ROADMAP text
  with its P1-DC entry; the fallow entries; the six unemitted closed-set
  entries; an empty `## CI timings` section.
- Pointed the child-session brief at `01-FROZEN.md`, and added to its frozen
  list the frozen paths Phase 1 created and `edge/handlers/plugin/info.ts`,
  which the list missed.
- Replaced the single-entry fallow statements in CONVENTIONS.md (line 61),
  STACK.md (line 49), and ARCHITECTURE.md (line 225) with the three-entry list,
  and described the frozen-export mechanism once in CONVENTIONS.md.

## Task Commits

1. **Task 1: Run the full gate on the combined tree** - no commit (no file changed; the gate passed on the first run)
2. **Task 2: Hand the CI measurement to the parent session** - `aec06cc` (docs)
3. **Task 3: Write the frozen record, the codebase-doc corrections, and the parent lines** - `90b2963` (docs)

**Plan metadata:** the SUMMARY commit that follows `90b2963`.

## Files Created/Modified

- `.planning/phases/01-foundation-and-pi-1-5-0/01-CI-HANDOFF.md` - the CI measurement checklist and the D-CF1-16 row text
- `.planning/phases/01-foundation-and-pi-1-5-0/01-FROZEN.md` - the frozen record
- `.planning/CHILD-SESSION-BRIEF.md` - the PROJECT RULES pointer line and the completed frozen list
- `.planning/codebase/CONVENTIONS.md` - the entry list, the frozen-export bullet, the marker count 44 with the four harness extension defaults
- `.planning/codebase/STACK.md` - the entry list in the `fallow dead-code` bullet
- `.planning/codebase/ARCHITECTURE.md` - the entry list in the circular-imports bullet

## Decisions Made

See `key-decisions` above and `## Dubious Choices` below.

## Deviations from Plan

None - plan executed exactly as written. Task 1 needed no combined-tree fix,
so it made no commit. The gate ran in parts, as the plan's executor
environment allows; the cucumber part ran as the three CI legs rather than the
chained `test:cucumber` script (P1-14-DC-02).

## Issues Encountered

None. The known flakes (the http MCP scenario in `configuration.feature` and
the 30 s marketplace-add step in `apply.feature`) did not show.

## Known Stubs

None added by this plan. The Phase 1 seeds (`builtinRegistrationStep`,
`resyncBuiltinRegistrations`, `agentGrantsStep`, `createBuiltinMcpStatusReader`)
and the six unemitted closed-set entries are intentional and listed in
`01-FROZEN.md`; Phases 2-4 fill the seeds, and Phase 6 removes unemitted
entries.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- The parent merges this worktree, runs the build-input check in
  `01-CI-HANDOFF.md`, pushes `features/mcp-builtin`, dispatches `ci.yml`, and
  records DUAL-03. Then the child sessions for Phases 2-5 can start from the
  merged head with `01-FROZEN.md` as their ground truth.
- Before the PR merges, check branch protection for the renamed behavioral
  check names (P1-DC-36).

## Parent lines

Lines for files a child phase may not edit, for the parent to apply at merge
or in Phase 6:

- **Frozen files.** The gate needed no frozen-file change. One optional
  cleanup: the `.fallowrc.json` `ignoreExports` entry for
  `features/lib/mcp-implementation.ts` (`stubPidsIn`,
  `waitUntilProcessesExit`, `writeAdapterOnboardingSeed`) is already
  redundant, since `features/support/pi-process.ts` uses all three
  (P1-DC-33). Remove it at any merge, or in Phase 6.
- **Phase 6, fallow.** Remove the `entry` lines for
  `domain/mcp-implementation.ts` and `orchestrators/mcp/recorded-servers.ts`
  and every `ignoreExports` entry listed in `01-FROZEN.md` section 3 once the
  combined tree consumes those exports. Then update the entry list in
  CONVENTIONS.md, STACK.md, and ARCHITECTURE.md.
- **Phase 6, closed sets.** Remove any of the six entries (`requires mcp`,
  `requires builtin mcp`, `overridden by mcp.json`, `project not trusted`,
  companions `mcp` and `builtin mcp`) that no phase emits on the combined
  tree, and fix the lock counts, `docs/json-output.md`, and the schema.
- **Phase 6, snapshot.** `SoftDepStatus.piMcpAdapterLoaded` is a derived view
  of `mcpImplementation`; remove it once nothing reads it (01-05 SUMMARY).
- **CHANGELOG.md.** At PR time, consolidate the Phase 1 "Pi 1.5.0" bullet
  under Unreleased with the milestone's built-in MCP bullet, and add the PR
  number (P1-DC-27).
- **README.md and README.es.md.** The built-in MCP text for MDOC-02 (Phase 6):
  Pi's built-in MCP serves plugin MCP servers without pi-mcp-adapter, and the
  adapter still wins when both are loaded.
- **PROJECT.md.** Resolve the D-MB-08..D-MB-13 rows marked `-- Pending` with
  the user (P1-DC-25). Amend the D-CF1-16 row after the CI run, with the text
  in `01-CI-HANDOFF.md`.
- **BACKLOG.md** (from CONTEXT's Deferred Ideas):
  - MCPV2-01: register and unregister built-in servers at once on install,
    uninstall, enable, and disable, not only at `session_start` and after the
    load reconcile.
  - MCPV2-02: map Claude deny rules to Pi's `toolExposure: "hidden"`.
  - MCPV2-03: let background pi-subagents children call plugin MCP tools
    under built-in MCP.
  - If Phase 3 does not settle them: what `info`'s `requires:` line shows
    while an implementation runs every server, and the load warning row for a
    plugin that becomes partial after a switch.
  - If Phase 2 does not settle them: whether a built-in server's status can
    tell `not loaded` from `not connected`, and how the first built-in session
    reports a legacy `mcp.json` entry.
- **ARCHITECTURE.md and STRUCTURE.md.** Refresh for the new
  `orchestrators/mcp/` directory (`session-materialize.ts`,
  `recorded-servers.ts`, `builtin-registration-step.ts`,
  `agent-grants-step.ts`), the new domain modules (`mcp-implementation.ts`,
  `mcp-builtin-features.ts`), and `platform/mcp-builtin-status.ts` (Phase 6,
  or `/gsd-map-codebase`).
- **CI.** Phase 6 re-measures the behavioral legs on the combined tree,
  because Phases 2-5 add 60-100 MCP scenarios.
- **Root DUBIOUS-CHOICES.md.** Phase 6 merges P1-DC-01..P1-DC-37 and the
  P1-14-DC entries below into the root log.

## Dubious Choices

### Phase entries, by reference (the orchestrator's log, `DUBIOUS-CHOICES.md`)

- P1-DC-01 (Medium): discuss decisions settled without the user.
- P1-DC-02 (Medium): stored compatibility stays the adapter's verdict; a neutral mark is frozen now.
- P1-DC-03 (Medium): the shared Pi loads pi-mcp-adapter under the adapter profile.
- P1-DC-04 (Low): profile layout and the `@own-implementation` tag.
- P1-DC-05 (Medium): the built-in stand-in registers through Pi's API and defers to an existing name.
- P1-DC-06 (Medium): built-in OAuth client named "Claude Code (plugin:<plugin>:<server>)"; superseded by P1-DC-12.
- P1-DC-07 (Medium): `mcp` and `builtin mcp` join the `requires:` companion names.
- P1-DC-08 (Low): a restart step turns built-in MCP on by editing the sandbox settings.
- P1-DC-09 (Low): a third extension that replaces `/mcp` reads as `none`.
- P1-DC-10 (Low): the registered built-in name keeps `-`; only tool names fold and get cut.
- P1-DC-11 (Low): a Pi's implementation is proven by a harness probe, not product output.
- P1-DC-12 (High): D-MB-11 reversed in part; no `clientName`, so Pi keeps CIMD.
- P1-DC-13 (Medium): the adapter-profile shared Pi gets seeded onboarding state.
- P1-DC-14 (Medium): each Pi is checked against its own launch configuration.
- P1-DC-15 (Medium): `companion-missing.feature` runs `@builtin-only` in Phase 1.
- P1-DC-16 (Medium): the 9 `{requires pi-mcp-adapter}` rows move to one Phase 3 file as tag pairs.
- P1-DC-17 (Medium): Phase 1 edits `update-preflight.ts`, a Phase 3 file.
- P1-DC-18 (Medium): new fields `compatibilityBasis?: "neutral"` and `mcpBundle?: true`.
- P1-DC-19 (Low): smaller research choices (ignoreExports, tag rules in check-features, the status call shape).
- P1-DC-20 (Low to Medium): pattern-map choices (stand-in source marker, reader under `none`, id types in platform).
- P1-DC-21 (High): package legitimacy check runs unattended.
- P1-DC-22 (Medium): plan shape and frozen-interface width.
- P1-DC-23 (Medium): plan-check revisions; CI measurement moved to the parent.
- P1-DC-24 (Low): executor prompts list the GSD contract files instead of inlining them.
- P1-DC-25 (Low): plan 01-02 choices (D-MB-08..13 Pending, cucumber contract).
- P1-DC-26 (Low): plan 01-04 choices (closed-set entries).
- P1-DC-27 (Medium): plan 01-01 choices (Pi 1.5.0 raise).
- P1-DC-28 (Medium): plan 01-03 choices (no RED-only commits, adapter `toolName` fix).
- P1-DC-29 (Low to Medium): plan 01-05 choices (snapshot field).
- P1-DC-30 (Medium): plan 01-06 choices (session steps, materializer in index.ts).
- P1-DC-31 (Medium): plan 01-07 choices (cucumber profiles).
- P1-DC-32 (Low): plan 01-10 choices (stand-in and remaining steps).
- P1-DC-33 (Medium): plan 01-09 choices (profile-following shared Pi, tags, moves).
- P1-DC-34 (Low to Medium): plan 01-08 choices (record producer).
- P1-DC-35 (Low to Medium): plan 01-12 choices (recorded servers).
- P1-DC-36 (Medium): plan 01-13 choices (tag rules, CI profile axis, renamed checks).
- P1-DC-37 (Medium): plan 01-11 choices (status readers).

### New entries from this plan

- **P1-14-DC-01: Task 1 has no commit.** I chose to record the gate on the
  base commit `f3ab832` and to commit nothing for Task 1, because the gate
  needed no fix. Alternatives: an empty commit, or a commit of a gate log
  file. Why: the plan lists no planned file for Task 1, and the two later
  commits change only planning Markdown, so the result carries to the merged
  head. Severity: Low.
- **P1-14-DC-02: The cucumber part of `npm run check` ran as the three CI
  legs.** I chose `test:cucumber:profile` with each leg's profile and paths
  (three calls), not the chained `test:cucumber` (adapter on all features,
  then builtin), because one Bash call is capped at 10 minutes. Alternatives:
  one call of `npm run test:cucumber` with the full timeout. Why: the shard
  test proves that the two adapter shards cover every feature file exactly
  once, and the adapter total (1558) matches the orchestrator's wave-4 run.
  The cucumber summary therefore shows three runs, not two. Severity: Low.
- **P1-14-DC-03: `behavioral-shard-coverage.test.ts` is listed as frozen.**
  I chose to list it in `01-FROZEN.md` and in the brief, although the ROADMAP
  list does not name it. Alternatives: leave it unlisted. Why: Phase 1
  extended it for the profile axis, and it reads the frozen `ci.yml`, so no
  child has a reason to edit it, and an edit would only weaken the shard
  check. Severity: Low.
- **P1-14-DC-04: The CONVENTIONS.md marker count now covers `features/`.** I
  chose 44 markers with `rg -n "fallow-ignore" extensions features test
  scripts`, and named the four harness extension defaults. Alternatives: keep
  40 with the plan's narrower command, which still prints 40 and does not see
  the stand-in marker Phase 1 added (P1-DC-20). Why: the paragraph says
  "repo-wide", and the narrower command missed four markers. Severity: Low.
- **P1-14-DC-05: The brief's frozen list gains `edge/handlers/plugin/info.ts`.**
  The ROADMAP freezes it, but the brief's line omitted it. I also named the
  Phase 1 harness files explicitly. Alternatives: add only the pointer line.
  Why: the plan asks to add any frozen path the line does not name.
  Severity: Low.
- **P1-14-DC-06: `01-FROZEN.md` wins over the ROADMAP text where they
  differ.** I chose to say so in the record and in the brief's pointer line.
  Alternatives: say that the ROADMAP wins and list the differences as errata.
  Why: the code is what the children import, and every difference already has
  a P1-DC entry. A reviewer who wants the ROADMAP to win must change code.
  Severity: Medium.
- **P1-14-DC-07: The handoff proposes the full amended D-CF1-16 text.** I
  chose to write the replacement decision text (three legs,
  `test:cucumber:profile`, the profile axis) and a sentence change about
  re-measuring after each phase merge. Alternatives: give only the
  measurement sentence. Why: the row's current text says each shard runs
  `npm run test:cucumber`, which is no longer true. Severity: Low.
- **P1-14-DC-08: If the timeout must rise, the parent edits the frozen
  `ci.yml`.** The handoff tells the parent to change `timeout-minutes` on the
  milestone branch before the child sessions start, and to measure again.
  Alternatives: leave the change to Phase 6, which owns CI timeouts. Why: a
  timeout that is too short would fail the child phases' CI runs now.
  Severity: Low.
- **P1-14-DC-09: No WINDOWS.md entry and no requirements marking.** I did not
  run `gsd-tools windows append --kind unrun-verify` for the CI dispatch, and
  did not run `requirements mark-complete`. Alternatives: append the open
  item (it would block ship until the parent closes it), and mark the nine
  IDs complete. Why: the orchestrator owns the shared tracking files after
  the wave, and DUAL-03 must not read complete before the parent's CI run.
  `requirements-completed` copies the plan's list as the template requires,
  and the DUAL-03 status section says it is unverified. Severity: Low.

## Self-Check: PASSED

- FOUND: `.planning/phases/01-foundation-and-pi-1-5-0/01-CI-HANDOFF.md`
- FOUND: `.planning/phases/01-foundation-and-pi-1-5-0/01-FROZEN.md`
- FOUND: commit `aec06cc` (ancestor of HEAD)
- FOUND: commit `90b2963` (ancestor of HEAD)
- PASS: Task 2 verify (`D-CF1-16`, `timeout-minutes`, `builtin` in the handoff)
- PASS: Task 3 verify (`01-FROZEN.md` exists, brief count 1, CONVENTIONS `ignoreExports` count 2, pre-commit on the five files: no hook failed)
- PASS: every path in `01-FROZEN.md` section 1 is tracked (58 entries)

---
*Phase: 01-foundation-and-pi-1-5-0*
*Completed: 2026-11-04*
