---
phase: 04-variable-expansion-at-claude-code-parity
plan: 04
subsystem: mcp-resolver
tags: [mcp, resolver, partial-install, closed-catalog]

requires:
  - phase: 04-03
    provides: "the deny-list arm of expandClaudeValue; this plan touches none of it"
  - phase: 03-04
    provides: "the {unsupported mcp} machinery: classifyMcpServer verdicts, droppedMcpServers, the --partial hint and the info breakdown"
provides:
  - "McpUnsupportedFeature members \"command ~\" and \"args ~\" and the private homeFeature(server) check in classifyMcpServer's stdio arm"
  - "DroppedMcpServerSchema literals \"command ~\" and \"args ~\""
  - "tests/integration/mcp-home-path-partial.test.ts: refusal and --partial through the real install operation"
  - "The failure-unsupported-mcp catalog prose for the home-marker arm"
affects: [04-05, 04-08, 04-09]

actuals:
  tokens: 4497
  tasks: 2
  commits: 1
plan_head_before: 7ab90a447df132f8ff7d36f0ed63e3820f5bbef5
plan_head_after: 00000855c665b44d058be2662441f15697847064

tech-stack:
  added: []
  patterns:
    - "A static, conservative classifier check for a value the adapter rewrites after interpolation: block the server instead of writing a changed value"

key-files:
  created:
    - tests/integration/mcp-home-path-partial.test.ts
  modified:
    - extensions/pi-claude-marketplace/domain/mcp-server-features.ts
    - extensions/pi-claude-marketplace/domain/resolver-types.ts
    - tests/domain/mcp-server-features.test.ts
    - tests/domain/plugin-resolver.test.ts
    - tests/orchestrators/plugin/info.test.ts
    - docs/output-catalog.md

key-decisions:
  - "A home marker is exactly ~, a ~/ or ~\\ prefix, or a leading complete ${NAME:-default} reference whose default is ~ or starts with ~/ or ~\\; two anchored regexes, the second requiring the closing brace as Claude's grammar does"
  - "homeFeature runs before elicitationFeature and checks command before args, so a server with several blockers reports command ~, then args ~, then bareElicitationCapability"

patterns-established: []

requirements-completed: [AVAR-03]

coverage:
  - id: D1
    description: "classifyMcpServer blocks command ~ and args ~ for every home-marker form and leaves ~user, a non-leading ~, an empty default, a plain reference, a ~user default and remote url/headers supported"
    requirement: AVAR-03
    verification:
      - kind: unit
        ref: "tests/domain/mcp-server-features.test.ts (15 AVAR-03 verdict rows)"
        status: pass
      - kind: other
        ref: "npm run test:coverage:direct -- extensions/pi-claude-marketplace/domain/mcp-server-features.ts extensions/pi-claude-marketplace/domain/resolver-types.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "resolveStrict gives partially-available with unsupported [mcpServers] and droppedMcpServers [{ server: home, feature: args ~ }]"
    requirement: AVAR-03
    verification:
      - kind: unit
        ref: "tests/domain/plugin-resolver.test.ts#AVAR-03: a stdio server whose args start with ~/ makes the plugin partially available with the server left out"
        status: pass
    human_judgment: false
  - id: D3
    description: "A real normal install refuses with (partially-available) {unsupported mcp} and the --partial hint and writes no mcp-adapter.json; --partial writes only plugin_hello_local_ and records local alone with compatibility.unsupported [mcpServers]"
    requirement: AVAR-03
    verification:
      - kind: integration
        ref: "tests/integration/mcp-home-path-partial.test.ts#AVAR-03: a normal install of a plugin whose stdio args start with ~/ refuses with {unsupported mcp} and the --partial hint"
        status: pass
      - kind: integration
        ref: "tests/integration/mcp-home-path-partial.test.ts#AVAR-03: --partial installs the plugin without the server whose args start with ~/"
        status: pass
    human_judgment: false
  - id: D4
    description: "info names the left-out server as plugin:<plugin>:home (unsupported args ~)"
    requirement: AVAR-03
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/info.test.ts#AVAR-03: info names a server left out for a leading ~ with its field"
        status: pass
    human_judgment: false
  - id: D5
    description: "The failure-unsupported-mcp catalog prose names the home-marker features and why the adapter forces them"
    requirement: AVAR-03
    verification: []
    human_judgment: true
    rationale: "Closed-catalog prose; tests pin the rendered bytes, not the clarity of the explanation"

duration: 10min
completed: 2026-10-07
status: complete
---

# Phase 4 Plan 04: Leading home marker in MCP command or args Summary

**A stdio MCP server whose `command` or an `args` element starts with `~`, `~/`, `~\`, or a `${NAME:-~…}` default is now blocked as `command ~` or `args ~`: a normal install refuses with `(partially-available) {unsupported mcp}` and the `--partial` hint, `--partial` installs the plugin without that server, and `info` shows `(unsupported args ~)`.**

## Performance

- **Duration:** about 10 min
- **Started:** 2026-10-07T17:44:09Z
- **Completed:** 2026-10-07T17:53:39Z
- **Tasks:** 2 (one commit, as the plan directs)
- **Files modified:** 7 (1 created, 6 modified)

## Accomplishments

- `domain/mcp-server-features.ts`: `McpUnsupportedFeature` gains `"command ~"` and `"args ~"`. The private `homeFeature(server)` uses `startsWithHomeMarker`, which has two anchored regexes. `LEADING_HOME` matches `~` alone or a `~/` or `~\` prefix. `LEADING_HOME_DEFAULT` matches a complete leading `${NAME:-default}` reference whose default is `~`, or starts with `~/` or `~\`. `classifyStdio` now takes `homeFeature(server) ?? elicitationFeature(server)`. The `classifyMcpServer` JSDoc lists the new table order and says that remote `url` and `headers` never block.
- `domain/resolver-types.ts`: `DroppedMcpServerSchema` carries the two literals, so the two-way drift check still compiles.
- Tests: 15 classifier rows, one resolver case, one info case, and two integration cases through `createInstallOperation`.
- `docs/output-catalog.md`: the `failure-unsupported-mcp` prose lists the new features and explains why. No new catalog state.

## Task Commits

1. **Task 1 (tracer): a plugin whose stdio args start with ~/ refuses a normal install** - `00000855`
2. **Task 2: per-form pins, --partial, info, catalog, the commit** - `00000855` (feat)

Tracer gate: `workflow.auto_advance` is false, `workflow.human_verify_mode` is the default `end-of-phase`, and the tracer `<verify>` is automated-only. The tracer `<verify>` was run again (exit 0), so execution went on to Task 2 with no checkpoint.

## Verification

Node v26.10.0. All commands ran from the repo root.

| Command | Exit | Notes |
|---|---|---|
| Task 1: `mkdir -p /var/tmp/mcp4-p4-04 && npm run typecheck && node --test tests/architecture/partial-vocabulary-guard.test.ts && TMPDIR=/var/tmp/mcp4-p4-04 node --test tests/integration/mcp-home-path-partial.test.ts` | 0 | 45 pass; 1 pass; no `error TS` |
| Task 2 verify 1: `npm run typecheck && node --test tests/domain/mcp-server-features.test.ts tests/domain/plugin-resolver.test.ts && TMPDIR=... node --test --test-name-pattern="^AVAR-03" tests/orchestrators/plugin/info.test.ts && TMPDIR=... npm run test:coverage:direct -- <2 sources>` | 0 | run on the working tree before the commit: 267 pass; 1 pass (info); 100% direct coverage for both sources |
| Task 2 verify 2: `TMPDIR=... npm run test:modules && npm run test:architecture && TMPDIR=... npm run test:integration && test "$(tail -n 1 tmp/p4-04-precommit.log)" = PRECOMMIT_EXIT=0 && git log -1 --format=%s` | 0 | run on `00000855`; printed `feat(mcp): treat a leading home marker in MCP command or args as partial` |
| `npx fallow audit --base 7ab90a44` | 0 | No issues in 7 changed files |
| `npx fallow dead-code` | 0 | No issues |
| D-04 ID check on `git diff 7ab90a44..HEAD -- extensions tests` | 0 | no `D-04-NN` added |

- Pre-commit log `tmp/p4-04-precommit.log` ends with `PRECOMMIT_EXIT=0`. The first run was clean, and no fixer rewrote a file.
- Commit `00000855` hook: `npm run check:commit....Passed`, gitlint Passed.
- Other suites: none needed a fix. `test:modules`, `test:architecture` and `test:integration` all exit 0.

Focused task verification passed; full phase/PR verification pending.

## Decisions Made

- `LEADING_HOME_DEFAULT` requires the closing `}`, like Claude's `${NAME:-[^}]*}` grammar, so an unclosed `${X:-~/a` is plain text and not a reference. That text starts with `$`, so neither Claude nor the adapter treats it as a home path.
- The name part uses `[A-Za-z_]\w*`, which equals Claude's `[A-Za-z_][A-Za-z0-9_]*` and passes `sonarjs/concise-regex` with no directive.

## Deviations from Plan

**1. [Test fidelity] The `--partial` integration row carries `requires pi-mcp-adapter`**
- **Found during:** Task 2 step 4
- **Issue:** the plan said the row should match the ANAME-07 `--partial` case in `install-flow.test.ts`. That case adds an adapter command to the session. The shared integration `makeCtx()` has no adapter, so the real row is `◉ hello v1.0.0 (partially-installed) {unsupported mcp, requires pi-mcp-adapter}`, at `warning` severity, with the `A plugin operation needs attention.` summary. The other MCP integration tests (`mcp-override-lifecycle.test.ts`) show the same thing.
- **Fix:** the case asserts the real notification. The `{unsupported mcp}` token, the `(partially-installed)` state and the reload trailer are all in it.
- **Files modified:** tests/integration/mcp-home-path-partial.test.ts

**2. [Test fidelity] The `--partial` case compares the whole adapter document**
- The plan asked only that the document hold `plugin_hello_local_`. The case compares the whole parsed document, because the testing skill wants whole values compared. To support this, `seedHomeArgsPlugin` returns the plugin root.

**3. [Reuse] `pathExists` from `shared/fs-utils.ts`**
- The refusal case imports the production `pathExists`, as `marketplace-add-seed-mirrors.test.ts` does, so the test file has no local copy.

**4. [Test seam] The info case uses the existing `seedAlphaWithPluginJson`**
- The plugin is `alpha`, not a new `db-tools` seed. This keeps the case from copying the ANAME-07 seed block. The asserted line is `    mcp: plugin:alpha:db, plugin:alpha:home (unsupported args ~)`.

**5. [Process] TDD order for Task 2**
- Task 1 (the tracer) wrote the production check before the Task 2 rows existed, so no RED run was recorded. `workflow.tdd_mode` is false, and the plan ships one commit. Each blocked row fails if `homeFeature` returns `undefined`, and each supported row fails if the check matches too much.

---

**Total deviations:** 5 recorded test and process notes. No auto-fix rule applied. **Impact:** no scope change; the behavior matches the plan.

## Issues Encountered

- `requirements.mark-complete AVAR-03` checked off AVAR-03 in REQUIREMENTS.md. AVAR-03 still has open work in plan 04-05, so the change was reverted and AVAR-03 stays Pending, as after 04-01. `gsd-tools query state.*` rewrote `.planning/state.json`, which was restored with `git checkout`. The `Last activity:` lines that named 04-03 were corrected by hand.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced. T-04-12 is mitigated: the classifier rows and both integration cases pin it. T-04-13 (`${X:-}~/a`, and a kept reference whose runtime value starts with `~/`) stays accepted, as the plan records. The `${X:-}~/a` row pins it as supported, and plan 04-09 documents it.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

04-05 can start. 04-09 documents T-04-13 and the `~\` choice: the check blocks it on every platform, but the adapter expands it only on Windows.

## Self-Check: PASSED

- FOUND: tests/integration/mcp-home-path-partial.test.ts
- FOUND: commit 00000855 on HEAD
