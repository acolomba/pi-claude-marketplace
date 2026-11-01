---
phase: 06-mcp-servers
plan: 05
subsystem: testing
tags: [cucumber, pi-mcp-adapter, mcp, project-trust, soft-dependency]

requires:
  - phase: 06-mcp-servers
    provides: "06-01: the shared MCP steps in listing.steps.ts, the stub-server writers, and the moved allowed project-scope scenario"
provides:
  - "features/mcp-server/companion-missing.feature: four MCP-06 scenarios (install reason, later call, info without and with the adapter)"
  - "features/mcp-server/project-scope.feature: the allowed, unapproved, untrusted, and info scenarios of MCP-05"
  - "features/step_definitions/mcp-server/status.steps.ts: the adapter-report wait and the em-dash-aware mcp calls step"
affects: [06-09]

actuals:
  tokens: 6965
  tasks: 3
  commits: 4
plan_head_before: 38f3900e2eae43d2ac45a3fef8cb3aee95395a16
plan_head_after: 50377ce3fce7d4324997332a6d458350707e18ca

tech-stack:
  added: []
  patterns:
    - "A Then that compares the model calls whole and reads each U+2014 as {em dash}, for adapter text that a committed feature file cannot hold"
    - "A Given that polls /claude:plugin info until no server reads `status unknown`, before a scenario compares a server status"

key-files:
  created:
    - features/mcp-server/companion-missing.feature
    - features/step_definitions/mcp-server/status.steps.ts
  modified:
    - features/mcp-server/project-scope.feature

key-decisions:
  - "The blocked mcp({}) reasons are pinned whole through a new step, `the model receives these mcp calls:`, which reads each em dash as `{em dash}`, because the fix-unicode-dashes hook rewrites U+2014 in feature files and the frozen calls step compares tool results whole"
  - "The polling Given exists: an info status read right after the adapter's first listing was `status unknown` once in ten runs under parallel load"
  - "No product file changed: every measured value matches D-CF6-03 and D-CF6-08"

patterns-established:
  - "An em dash in a pinned adapter text is written {em dash}; only `the model receives these mcp calls:` projects it"

requirements-completed: [MCP-05, MCP-06]

coverage:
  - id: D1
    description: "Without pi-mcp-adapter, installing a plugin with an MCP server reports the plugin installed with the reason `requires pi-mcp-adapter`, compared whole"
    requirement: MCP-06
    verification:
      - kind: e2e
        ref: "features/mcp-server/companion-missing.feature#Installing a plugin with an MCP server without pi-mcp-adapter reports the missing companion"
        status: pass
    human_judgment: false
  - id: D2
    description: "A server installed while pi-mcp-adapter was missing answers a scripted call in a Pi started with the adapter afterwards, with no reinstall"
    requirement: MCP-06
    verification:
      - kind: e2e
        ref: "features/mcp-server/companion-missing.feature#A server installed without pi-mcp-adapter answers once pi starts with the adapter, with no reinstall"
        status: pass
    human_judgment: false
  - id: D3
    description: "`/claude:plugin info` names pi-mcp-adapter as missing (status unknown) without it and as present (cached, connects on first use) with it, both compared whole"
    requirement: MCP-06
    verification:
      - kind: e2e
        ref: "features/mcp-server/companion-missing.feature#Plugin info names pi-mcp-adapter as a missing companion"
        status: pass
      - kind: e2e
        ref: "features/mcp-server/companion-missing.feature#Plugin info names no missing companion once pi loads pi-mcp-adapter"
        status: pass
    human_judgment: false
  - id: D4
    description: "Project-scope plugin servers: allowed in a trusted project with projectServers allow; blocked without it (approval required) and in an untrusted project (project trust), with an empty stub log; info shows pending approval"
    requirement: MCP-05
    verification:
      - kind: e2e
        ref: "features/mcp-server/project-scope.feature (4 scenarios)"
        status: pass
    human_judgment: false
  - id: D5
    description: "A Pi started after the change stands in for /reload (D-CF6-11)"
    requirement: MCP-06
    verification: []
    human_judgment: true
    rationale: "The harness has no RPC /reload step, so no test drives /reload itself; the equivalence is research assumption A1"

duration: 47min
completed: 2026-11-01
status: complete
---

# Phase 6 Plan 05: MCP companion-missing recovery and project-scope trust Summary

**Without pi-mcp-adapter, an install reports `requires pi-mcp-adapter` and info lists the adapter as missing. A Pi started later with the adapter reaches the server with no reinstall. Project-scope plugin servers start only as the adapter's project trust admits them: both blocked cases are pinned whole through `mcp({})` and `info`, with an empty stub log.**

## Performance

- **Duration:** about 47 min
- **Started:** 2026-11-01T15:26:40Z
- **Completed:** 2026-11-01T16:13:13Z
- **Tasks:** 3
- **Files modified:** 3 (2 created, 1 modified)

## Accomplishments

- `features/mcp-server/companion-missing.feature` (`Feature: MCP server companion missing`, four scenarios) pins the MCP-06 path end to end. The install result is compared whole. A later Pi with the adapter answers a scripted call. Info is compared whole in a Pi without the adapter and in one with it, and only the adapter differs between the two.
- `features/mcp-server/project-scope.feature` now has four scenarios. The moved allowed scenario gained `the project holds a pi settings file`, so it differs from the untrusted scenario only in the trust entry. New scenarios cover trusted with no allow, untrusted with allow, and info `pending approval`.
- `features/step_definitions/mcp-server/status.steps.ts` adds two steps. One Given waits for the adapter's status report. One Then compares the model calls whole and reads each em dash as `{em dash}`.
- No product file changed. A mutation check showed that the scenarios catch a broken pi-mcp-adapter arm (see Red proof).

## Task Commits

1. **Task 1: install without the adapter, then a call in a Pi with it (tracer)**: `af37139`
2. **Task 2: info before and after the adapter loads**: `14aefca`, plus `3d846ae` (the polling Given, after a flip that Task 3's runs exposed)
3. **Task 3: project-scope servers under the adapter's project trust**: `50377ce`

Tracer gate: the run was interactive, the mode was `end-of-phase`, and the verify was automated only. The tracer verify passed three times in a row (seeds 403014, 763312, 713023), and `npm run check:features` passed, before the expansion started.

## Step texts added

- Given `pi-mcp-adapter has reported the mcp servers of the plugin {string} of the {word} scope`: it runs `/claude:plugin info <plugin> --scope <scope>` every 50 ms until every server shows a status other than `status unknown`. It fails after 15 s with the last payloads.
- Then `the model receives these mcp calls:` (`| call | role | text |`): every message of every call of the last turn, with the run tokens projected and each U+2014 read as `{em dash}`. It marks the turn compared.

## Measured literals (adapter 7.0.0, Pi 1.4.0)

- Install without the adapter: `kind cascade`, `severity warning`, `needs reload true`, `summary A plugin operation needs attention.`. The plugin row is `fixtures | user | demo@fixtures | demo | installed | requires pi-mcp-adapter | user | 1.0.0`.
- Info without the adapter: `plugin components mcp` `[{"name":"plugin:demo:stub","status":"status unknown"}]` and `plugin requires` `[{"companion":"pi-mcp-adapter","missing":true}]`, plus `plugin components skills demo-skill`, `plugin status installed`, `severity info`, and `needs reload false`.
- Info with the adapter, after the listing and the report: `[{"name":"plugin:demo:stub","status":"cached, connects on first use"}]` and `[{"companion":"pi-mcp-adapter","missing":false}]`.
- A later Pi with the adapter makes two startup or reconnect rounds and then `tools/call`, and the call returns `mcp returned: echo:ping`, the same log as the seed.
- Trusted project, no allow: both proxy calls return `mcp returned: Tool "mcp__plugin_demo_stub__echo" not found. Use mcp({ search: "..." }) to search.` Then `mcp({})` returns `MCP: 0/0 servers, 0 tools (1 blocked)\n\n⊘ plugin_demo_stub_ (blocked: project server approval required — approve it in a trusted interactive session or set user-global settings.projectServers to "allow")\n\nmcp({ server: "name" }) to list tools, mcp({ search: "..." }) to search`. The stub log is empty.
- Untrusted project with allow: the same proxy text. The reason is `blocked by project trust — trust the project to review and approve this server`. The stub log is empty.
- Info for the blocked project server (trusted, no allow): `[{"name":"plugin:demo:stub","status":"pending approval"}]`, `[{"companion":"pi-mcp-adapter","missing":false}]`, and `marketplace scope project`.

The feature files write each `—` above as `{em dash}`. Each value matches research probes P2 and P3.

## Red proof

No behavior changed, so no red proof was required. As a mutation check, I inverted the two pi-mcp-adapter conditions in `shared/concerns/soft-dep.ts` (lines 114 and 148), ran the feature, and restored the file with `git checkout`. Result: 3 of 4 scenarios failed (seed 628511). The install scenario failed on the `reasons` cell (`''` in place of `requires pi-mcp-adapter`), and both info scenarios failed on `plugin requires`. The call scenario passed, because it proves only that the server answers. With the marker gone, the install keeps severity `warning`, so `which warned` does not catch a missing marker. The install scenario's plugin row does.

## Files Created/Modified

- `features/mcp-server/companion-missing.feature`: the four MCP-06 scenarios.
- `features/mcp-server/project-scope.feature`: new description (D-CF6-03 and the `{em dash}` note), the pi settings file in the allowed scenario, and three new scenarios.
- `features/step_definitions/mcp-server/status.steps.ts`: the report wait and the mcp calls step.

## Decisions Made

- The install-report scenario runs in the run's shared Pi, which has no companions. That Pi is what shows the missing companion (research Pattern 1).
- The polling Given takes a scope (`of the {word} scope`). The plan's text did not name one, and info needs `--scope` to address one install.
- The info scenario for the blocked server uses the polling Given too, as the plan asked. A blocked server reports `pending approval`, not `status unknown`, so the wait ends at the adapter's first report.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] The blocked reasons cannot be stated through the frozen calls step**
- **Found during:** Task 3
- **Issue:** Each prompt scenario must compare its turn (`world.ts` asserts it). The frozen `the model receives these calls:` compares each tool result whole. Both blocked `mcp({})` reasons contain U+2014, which the `fix-unicode-dashes` hook rewrites in every committed feature file. Gherkin has no escape for it, and a step definition's text may not hold a token.
- **Fix:** `status.steps.ts` adds `the model receives these mcp calls:`. It works like the frozen step, except that it reads each em dash as `{em dash}`. The feature description says what the token means. The source builds the character with `String.fromCodePoint(0x2014)`, because the hook also rewrote a literal U+2014 in the `.ts` file on the first try.
- **Files modified:** `features/step_definitions/mcp-server/status.steps.ts`, `features/mcp-server/project-scope.feature`
- **Commit:** `50377ce`

**2. [Rule 1 - Bug] The info status after the adapter's first listing was timing-dependent**
- **Found during:** Task 3 runs (Task 2's scenario). Task 2's five runs had passed.
- **Issue:** In run 4 of 5 (seed 892665, four workers, beside four other executors), "Plugin info names no missing companion once pi loads pi-mcp-adapter" read `status unknown` in place of `cached, connects on first use`. The listing wait ends when the stub exits, and the adapter's status report can come later.
- **Fix:** The plan's Task 2 step 2 polling Given, with a scope parameter, used in both adapter-loaded info scenarios.
- **Verification:** 5 runs of both features, 8 of 8 each time (seeds 172563, 851663, 211146, 489326, 291396), then the whole `features/mcp-server` directory, 16 of 16 (seed 30788).
- **Commit:** `3d846ae`

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 bug).
**Impact on plan:** `status.steps.ts` exists and holds the planned Given plus one calls step. No product or frozen file changed.

## Issues Encountered

- The first ESLint warm-up was killed (exit 137) while about 4 GB was free under the other executors. A second run passed.
- The table-alignment script narrowed the extra padding in the seed tables. I restored `companion-missing.feature` from HEAD and the two seed lines of `project-scope.feature`, so the moved scenario keeps its original text.

## Verification

- `npx cucumber-js features/mcp-server/companion-missing.feature features/mcp-server/project-scope.feature`: 5 runs in a row, 8 of 8 each time, in the committed state (seeds above). Each new scenario passed at least three runs, and each info scenario five.
- `npx cucumber-js features/mcp-server`: 16 of 16 (seed 30788).
- `npm run check:static` (with `check:features`, fallow, and lint) passed before each commit.
- `git diff --stat 38f3900..HEAD -- extensions` prints nothing.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced. T-06-12 is mitigated as planned: the unapproved and untrusted scenarios pin the blocked state with an empty stub log, and nothing writes `mcp-project-approvals.json`.

## Parent lines

- `.agents/skills/cucumber/rules/features.md`, "Run tokens": add `{em dash}`. It stands for U+2014, which the `fix-unicode-dashes` pre-commit hook rewrites in feature files. Only `the model receives these mcp calls:` (`features/step_definitions/mcp-server/status.steps.ts`) projects it, and a command never expands it.
- After the merge, the parent may decide whether the frozen `the model receives these calls:` should project `{em dash}` itself. The Phase 6 step could then go (see Dubious Choices 1).
- For the docs plan (`docs/mcp-compatibility.md`, "Server status in info"): a session whose adapter has just listed a server's tools for the first time can show `status unknown` for a moment, until the adapter sends its report. Measured: once in ten runs under load.
- Phase 6 log: the two dubious choices below.

## Self-Check: PASSED

- FOUND: features/mcp-server/companion-missing.feature, features/mcp-server/project-scope.feature, features/step_definitions/mcp-server/status.steps.ts
- FOUND commits: af37139, 14aefca, 3d846ae, 50377ce (4, measured with `git rev-list --count 38f3900..HEAD`)
- Acceptance criteria re-run: Task 1 (`1`, `1`), Task 2 (`1`, `1`), Task 3 (`2`, `2`, `2`, `4`, empty extensions diff): all PASS

## Dubious Choices

1. **A Phase 6 copy of the calls step that reads `{em dash}`.** Alternatives: compare only the `mcp({ search })` result, which does not tell blocked apart from absent (Pitfall 3); compare part of the `mcp({})` text, which the cucumber skill forbids; or ask the parent to exempt `features/` from `fix-unicode-dashes` or to edit the frozen step. Dubious because two steps now compare model calls, and they differ only in the dash projection. A reader must learn a token that the frozen skill does not list yet.
2. **The polling Given reads info in a loop.** Alternatives: wait on the adapter's `pi-mcp-adapter/status/v1` event, which a step cannot see, or on a file the adapter writes, which scenarios must not read. Dubious because it runs the command under test as a wait, so a scenario whose info never leaves `status unknown` fails in the Given, not in the Then. The deadline message shows the last payloads.
