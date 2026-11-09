---
phase: 09-legacy-mcp-entry-move
plan: 01
subsystem: testing
tags: [cucumber, mcp, legacy-move, mcp-json, mcp-adapter-json]

requires:
  - phase: 01-foundation
    provides: "the legacy-move seed, the frozen release 0.19.2 mcp.json step, the whole-text mcp file step, writeScenarioFile, and expandTokens"
provides:
  - "features/step_definitions/mcp-server/legacy-move.steps.ts: one Given that writes the user's own servers into a scope's mcp.json before the legacy move"
  - "features/mcp-server/legacy-move.feature: the seed plus four @mcp scenarios (the user's own servers, the second load, the moved server running, the project-scope move)"
affects: [the parent's merge of behavioral-gaps, the milestone audit]

actuals:
  tokens: 3000
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "A Given that writes a user-owned config file asserts the text is already in the form the product writes, so a whole-text Then after the product's rewrite compares entry by entry"

key-files:
  created:
    - features/step_definitions/mcp-server/legacy-move.steps.ts
  modified:
    - features/mcp-server/legacy-move.feature

key-decisions:
  - "The new Given expands run tokens, so the variable reference takes the ${ALPHA_HOME:-/srv/alpha} form (planner P9-DC 1)"
  - "Every scenario carries @mcp with one expectation; no builtin split was needed (D-BG-903)"

patterns-established:
  - "Pattern: a second-load scenario uses `Given the user has started a new pi session` for the first load, which records nothing, then `When the user starts a new pi session` and `Then the session reports no results`"

requirements-completed: [AMIG-01, AMIG-02]

coverage:
  - id: D1
    description: "The load moves only the plugin's marked servers and leaves each of the user's own mcp.json servers with its content and place"
    requirement: AMIG-02
    verification:
      - kind: e2e
        ref: "features/mcp-server/legacy-move.feature#A load moves only the plugin's marked servers and leaves each of the user's own servers as written"
        status: pass
  - id: D2
    description: "A second load moves and reports nothing and leaves both mcp files as the first load left them"
    requirement: AMIG-01
    verification:
      - kind: e2e
        ref: "features/mcp-server/legacy-move.feature#A second load after the move reports nothing and leaves both mcp files as the first load left them"
        status: pass
  - id: D3
    description: "After the move and a new session, the active MCP implementation offers the moved server's tool under its new name"
    requirement: AMIG-01
    verification:
      - kind: e2e
        ref: "features/mcp-server/legacy-move.feature#After the move, the next session offers the plugin's server tools under its new name"
        status: pass
  - id: D4
    description: "The project scope moves its own legacy mcp.json entries into its mcp-adapter.json, with the project's data directory"
    requirement: AMIG-01
    verification:
      - kind: e2e
        ref: "features/mcp-server/legacy-move.feature#A load moves a plugin's servers out of the project's mcp.json into the project's mcp-adapter.json"
        status: pass

duration: about 45 min
completed: 2026-11-08
---

# Phase 9 Plan 01: Legacy MCP entry move scenarios Summary

**Four new `@mcp` scenarios and one new Given pin the load-time move of a plugin's release 0.19.2 `mcp.json` entries: the user's own servers stay, a second load is a no-op, the moved server runs under its new name, and the project scope moves its own file. No product code changed.**

## Accomplishments

- New verb module `features/step_definitions/mcp-server/legacy-move.steps.ts` with one Given. Final text:
  `the mcp.json file of the {word} scope holds the user's own servers before the legacy move, in this text:`
  It expands the run tokens, asserts the text is two-space JSON with a final newline, asserts `mcpServers` is an object with no `_piClaudeMarketplace`-marked server, and writes the file through `writeScenarioFile` (`wx`, removed at release, read back).
- Final scenario titles in `features/mcp-server/legacy-move.feature` (file order):
  1. (seed, unchanged) `A load moves a plugin's servers out of a release 0.19.2 mcp.json and keeps the user's own server`
  2. `A load moves only the plugin's marked servers and leaves each of the user's own servers as written` (AMIG-02, D-BG-905)
  3. `A second load after the move reports nothing and leaves both mcp files as the first load left them` (D-BG-902)
  4. `After the move, the next session offers the plugin's server tools under its new name` (D-BG-904)
  5. `A load moves a plugin's servers out of the project's mcp.json into the project's mcp-adapter.json` (D-BG-906)
- The feature description now names its three stand-ins: the 0.19.2-shaped `mcp.json`, a local marketplace, and a stdio stub server.

## Task Commits

1. **Task 1: the user's own servers come through the move** - `911fc130` (test)
2. **Task 2: the second load and the project-scope move** - `ca62abea` (test)
3. **Task 3: the moved server runs in the next session** - `d7018360` (test)

## Red Proofs

Probe A: an early `if (input.scope !== ("never" as string)) return;` as the first statement of `migrateLegacyMcpEntries` (the move turned off). Probe B (adapter only): at the end of `migrateLocked`, read `mcp.json`, delete `srv-copy` from `mcpServers`, write it back as two-space JSON (a move that also takes the user's unmarked copy). Each probe was run against the file as it stood after that task, then restored with `git checkout -- extensions/pi-claude-marketplace/orchestrators/reconcile/mcp-migration.ts`; `git diff --exit-code -- extensions/` exited 0 before every commit. No probe was committed. No timeout reruns were needed.

| Scenario | Probe | adapter fails at | builtin fails at |
|----------|-------|------------------|------------------|
| Seed | A | `the session reports these results:` (no payload) | same |
| User's own servers | A | `the session reports these results:` (no payload) | same |
| User's own servers | B | `the mcp configuration file "mcp.json" of the user scope holds this text:` (`srv-copy` missing); the seed passed | not run (plan: adapter only) |
| Second load | A | `the mcp configuration file "mcp.json" of the user scope holds this text:` (marked `srv` still there) | same |
| Project scope | A | `the session reports these results:` (no payload) | same |
| Servers run | A | `pi offers these plugin mcp tools:` (header only) | `the mcp configuration file "mcp.json" of the user scope holds this text:` (marked `stub` still there) |

Probe A runs: after Task 1, 2 scenarios (2 failed) per profile; after Task 2, 4 (4 failed) per profile; after Task 3, 5 (5 failed) per profile, matching the research table. Probe B run: 2 scenarios (1 passed, 1 failed).

## Verification

| Command | After | Exit | Summary line |
|---------|-------|------|--------------|
| `npm run test:cucumber:profile -- --profile adapter --parallel 1 features/mcp-server/legacy-move.feature` | Task 1 | 0 | 2 scenarios (2 passed), 26 steps |
| same, `--profile builtin` | Task 1 | 0 | 2 scenarios (2 passed), 26 steps |
| `npm run check:features` | Task 1 | 0 | no finding |
| adapter | Task 2 | 0 | 4 scenarios (4 passed), 53 steps |
| builtin | Task 2 | 0 | 4 scenarios (4 passed), 53 steps |
| `npm run check:features` | Task 2 | 0 | no finding |
| adapter | Task 3 | 0 | 5 scenarios (5 passed), 68 steps (46 s wall) |
| builtin | Task 3 | 0 | 5 scenarios (5 passed), 68 steps (38 s wall) |
| `npm run check:features` | Task 3 | 0 | no finding |

Each of the three commits ran `SKIP=npm-check pre-commit run --files ...` (exit 0, no fixer change) and then the commit hook, whose `npm run check:commit` passed. The wave gate (`npm run check`) and `npm run test:modules` are the orchestrator's.

Real home check: `find ~/.pi -newer /tmp/claude-1000/-home-acolomba-pi-claude-marketplace/45e74ef7-b24a-4893-854b-b4c04365a440/scratchpad/home-marker` printed nothing (exit 0).

## Deviations from Plan

None - plan executed exactly as written. The research's measured texts held under both profiles, so no scenario needed a split and no product bug surfaced.

## Parent lines

1. CHANGELOG bullet for the parent's aggregate:
   `- Behavioral tests now cover the move of a plugin's MCP servers out of an old mcp.json: your own servers stay as written, a second load changes nothing, moved servers run under their new names, and project files move too.`
2. Key Decisions rows for `.planning/PROJECT.md`:

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| **D-BG-901 (behavioral-gaps, Phase 9, settled with the recommended answer, pending user review): the legacy move's report is pinned as the session's results**. A scenario reads it through `the session reports these results:`: one `mcp-migration` result, severity `info`, needs reload true, no notices, one `moved` row per legacy server from its declared name to its generated key. The rendered notice text is not pinned. | The notification grammar owns the wording and its unit tests cover it; AMIG-03 is not a requirement of this milestone. | -- Pending |
| **D-BG-902 (behavioral-gaps, Phase 9, settled with the recommended answer, pending user review): the move runs on a load, and a second load is a scenario of its own**. The second load moves and reports nothing and leaves both `mcp.json` and `mcp-adapter.json` as the first load left them; the first load is `Given the user has started a new pi session`. | One behavior per scenario; a command never runs the move. | -- Pending |
| **D-BG-903 (behavioral-gaps, Phase 9, settled with the recommended answer, pending user review): every legacy-move scenario carries `@mcp` with one expectation under both profiles**. A scenario whose builtin run differs would become an `@adapter-only`/`@builtin-only` pair under D-MB-21; none did. | The move reads no MCP implementation and writes `mcp-adapter.json` whatever the active one (MSEL-04, D-P3-16). | -- Pending |
| **D-BG-904 (behavioral-gaps, Phase 9, settled with the recommended answer, pending user review): "the servers still run" is the active MCP implementation listing the moved server's tool under its new name after a new session**, plus `mcp.json` holding only the user's server. No model call. | The `mcp.json` check makes the scenario fail without the move under the builtin profile too; a model call needs a script per implementation for no extra signal. | -- Pending |
| **D-BG-905 (behavioral-gaps, Phase 9, settled with the recommended answer, pending user review): "byte for byte" means each unmarked entry keeps its content and its place**. A new Given writes the user's servers in two-space form before the 0.19.2 entries; the whole `mcp.json` text is compared after the load, covering args, env, an unexpanded variable reference, and an unmarked copy of the plugin's entry. | The move rewrites `mcp.json` as two-space JSON, so file bytes can change while the user's entries do not; only the marker makes an entry the plugin's. | -- Pending |
| **D-BG-906 (behavioral-gaps, Phase 9, settled with the recommended answer, pending user review): the user scope, plus one project-scope move**, with project rows and the project's data directory. | Each scope keeps its own legacy file and the move runs per scope. | -- Pending |
| **D-BG-907 (behavioral-gaps, Phase 9, settled with the recommended answer, pending user review): out of scope for scenarios**: AMIG-03's wording, AMIG-04's unowned entries, a disabled plugin's entries, collisions, unparseable files, project stub cleanup, and the write-order fault injection. | The unit tests in `test/orchestrators/reconcile/mcp-migration.test.ts` cover them. | -- Pending |

3. BACKLOG: none.
4. Frozen files: none.
5. Unowned feature files changed: none.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## Dubious Choices

1. **Low. The new Given's text** is `the mcp.json file of the {word} scope holds the user's own servers before the legacy move, in this text:`, the planner's proposed wording plus nothing else; it shares its opening words with the frozen release 0.19.2 step but matches no other step.
2. **Low. The Given's marker check uses `"_piClaudeMarketplace" in entry`** over the parsed `mcpServers` keys rather than the frozen step's `Object.hasOwn` filter, to avoid a `fallow dupes` clone group with the frozen module. A marker inherited through a prototype cannot occur in parsed JSON, so the two checks agree.
3. **Low. The red-probe B mutation ran under the adapter profile only**, as the plan specifies; the builtin profile has the same file behavior (D-BG-903).
4. **Low. Probe A used the research's `input.scope !== ("never" as string)` guard** instead of a bare `return;`, so the rest of the function stays reachable for the type checker; the effect is the same (the move never runs).
