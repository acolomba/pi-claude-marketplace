---
phase: 102
plan: 02
subsystem: install-orchestration
tags: [defaults-enabled, precedence, config-write-back, import-cascade, failure-window]
status: complete

requires:
  - "orchestrators/plugin/install.ts::InstallPluginOptions.applyDefaultEnabled"
  - "orchestrators/plugin/install.ts::disableFreshlyInstalledPlugin"
  - "orchestrators/import/execute.ts::ImportDeps.installPlugin (the injected seam)"
  - "persistence/config-io.ts::saveConfig / loadConfig"
provides:
  - "tests/orchestrators/plugin/install.test.ts::the DFEN-05 three-valued precedence matrix"
  - "tests/orchestrators/plugin/install.test.ts::the D-102-03 non-opting default case"
  - "tests/orchestrators/plugin/install.test.ts::the D-102-02 cascade-failure characterization"
  - "tests/orchestrators/import/execute.test.ts::the D-102-03 seam assertion"
affects:
  - "orchestrators/reconcile/* (102-03 must keep the absent-key-only scope these cases pin)"

tech-stack:
  added: []
  patterns:
    - "table-driven precedence matrix over one shared body, so 'the cases behave identically apart from the named delta' is enforced by construction"
    - "fault injection by exploiting a producer/consumer asymmetry (failed[] tolerated on the way in, thrown on the way out) rather than by a filesystem trick both paths hit"

key-files:
  created: []
  modified:
    - tests/orchestrators/plugin/install.test.ts
    - tests/orchestrators/import/execute.test.ts
    - .planning/workstreams/defaults-enabled/phases/102-reason-token-install-write-through-and-notification/102-VALIDATION.md

decisions:
  - "The D-102-02 fault is injected through AG-5 foreign content, not the agents-index-as-directory route the plan proposed: the ledger's own agents phase loads the index BEFORE its noop short-circuit, so a seeded directory trips the ledger and the failure becomes an install rollback"
  - "The `enabled: false` + `defaultEnabled: true` case asserts the CONFIG contract DFEN-05 states, and records rather than changes what the install verb does with the record on that path"
  - "The import proof is asserted at the injected seam as `applyDefaultEnabled === undefined` across a two-plugin fixture, so it covers the cascade loop rather than one call"

metrics:
  duration: ~40min
  completed: 2026-08-14

actuals:
  tokens: 26000
  tasks: 3
  commits: 3
---

# Phase 102 Plan 02: Reason token, install write-through and notification Summary

Six behavioral cases pin the two halves of the install-disabled behavior that
fail quietly: the three-valued precedence read that decides WHEN a plugin
author's declaration may act at all, and the window where the ledger has already
succeeded and the disable cascade then throws. No production file changed.

## What Was Built

**The DFEN-05 precedence matrix (four cases, one shared body).** All three
values of the config entry's `enabled` key — `true`, `false`, ABSENT — against
both manifest values, table-driven over `DFEN_PRECEDENCE_CASES` so the fixtures
differ only in the seeded key and the expected outcome. The entry is pre-seeded
through `saveConfig` before the install, exactly as the WB-01 write-back cases
do, and re-read afterwards.

The absent case is the one that carries the weight: `entry.enabled !== undefined`
and `isDeclaredEnabled(entry)` agree on `true` and on `false` and disagree only
on absent, so a gate written with the wrong predicate passes the two present
values and fails only there. Every case asserts the config entry as a WHOLE
OBJECT (`assert.deepEqual` against the expected entry), so a write that added,
changed or removed any other key in the user's own file goes red.

**The D-102-03 proof, at both ends.** The orchestrator default: `installPlugin`
called WITHOUT `applyDefaultEnabled` on the same `defaultEnabled: false` fixture
the opting-in cases install disabled from records `enabled: true`, leaves both
artifacts on disk, and emits the ordinary `(installed)` row carrying neither the
`installs disabled` token nor the enable-hint trailer. The cascade: a two-plugin
import fixture captures `opts.applyDefaultEnabled` at the injected `installPlugin`
seam and asserts `[undefined, undefined]` — the loop, not one call.

**The D-102-02 failure window.** The ledger succeeds, the disable cascade throws
at the agents bridge (third of five), and the case pins the terminal state: one
`error`-severity notification carrying a `(failed)` row and the cascade's own
cause (`Failed to remove 1 agent(s)`), no `rollback partial` token, the record
still present and still `enabled: true`, `resources.skills` and
`resources.prompts` folded empty with their artifacts gone from disk, and
`resources.mcpServers` retained with `server1` still present in `mcp.json`.
`updatedAt` moved.

That last pair is the NFR-3 assertion doing real work: the record claims
exactly the artifacts that are still there, on both sides of the throw.

## Key Implementation Details

**The fault injection had to move, and why.** The plan proposed seeding
`agents-index.json` as a DIRECTORY so `loadAgentsIndex` throws EISDIR inside
`unstagePluginAgents`, and flagged the portability of that trick as an untested
assumption. It does not carry to the install path. `prepareStagePluginAgents`
(`bridges/agents/stage.ts:154`) calls `loadAgentsIndex` at step 4,
UNCONDITIONALLY and BEFORE the step-6 noop short-circuit — so a seeded directory
throws inside the ledger's own agents phase, the install rolls back, and no
record survives at all. Run as written, the case failed on
`the install itself succeeded, so the record must exist`.

The replacement exploits a genuine producer/consumer asymmetry instead: AG-5
foreign content. An agents-index row owned by `(mp, hello)` pointing at a real
file with no generated-agent marker is routed to `failed[]` and TOLERATED by the
install ledger (AS-7, `install.ts` folds it into `agentForeignFailures`), while
`cascadeUnstagePlugin` turns a non-empty `failed[]` into a thrown
`AgentsUnstageFailureError` (`orchestrators/marketplace/shared.ts:368-383`).
That is precisely the shape the case needs — succeed on the way in, throw on the
way out — and it needs no filesystem trick both paths would hit.

One further constraint fell out of it: the fixture must declare NO agents. With
`agents: [{ sourceName: "bot" }]` the ledger writes its own marked agent over
the foreign file at the same generated name, defusing the fault; the install
then landed disabled cleanly and the case failed on the severity assertion. The
test comment records that, so a later reader does not "helpfully" add an agent to
the fixture.

**Case 2's record outcome is recorded, not changed.** With a config entry saying
`enabled: false` and a manifest saying `defaultEnabled: true`, the gate's
`declaredEnabled === undefined` clause is false, so nothing disables the install:
the record lands `enabled: true` while the entry keeps `enabled: false`. That is
a record/declaration divergence the next reconcile closes, and it is what the
standalone install verb has always done — running `install` IS the user asking
for the install. DFEN-05's stated contract is the CONFIG one (the entry is not
rewritten), and that is what the case asserts. Per the plan, the observation is
reported here rather than implemented against.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] The plan's D-102-02 fault injection does not reach the disable cascade**

- **Found during:** Task 3, first run
- **Issue:** Seeding `agents-index.json` as a directory trips the install
  ledger's own agents phase, not the disable cascade —
  `prepareStagePluginAgents` loads the index before its noop short-circuit, so
  the plugin never gets installed and the failure is an install rollback. The
  plan flagged this as an untested assumption and named the fallback.
- **Fix:** Injected through AG-5 foreign content instead (see Key Implementation
  Details). The assertion set is unchanged; only the fault moved.
- **Files modified:** `tests/orchestrators/plugin/install.test.ts`
- **Commit:** df227c08

No other deviation. No production file was touched:
`git diff --name-only HEAD~3 -- extensions/` is empty.

## Verification Results

| Gate | Result |
|---|---|
| `node --test tests/orchestrators/plugin/install.test.ts` | 113/113 pass (was 107 before this plan; +6) |
| `node --test "tests/orchestrators/import/**/*.test.ts"` | 59/59 pass |
| `npm run typecheck` | exit 0 |
| `npm run lint` | exit 0 |
| `npm run format:check` | exit 0 |
| `npm run check` | exit 0 — typecheck + lint + format:check + test + test:integration (NFR-6) |
| `git diff --name-only HEAD~3 -- extensions/` | empty — the implementation needed no correction |

## Threat Mitigations Verified

| Threat | Severity | Verified how |
|---|---|---|
| T-102-02 — a config write disturbing something other than the sanctioned field | medium | Every precedence case asserts the entry as a whole object via `assert.deepEqual`, in all four combinations, so an added / changed / removed key fails. |
| T-102-05 — a hostile manifest flipping a value the user recorded | medium | The two present values are asserted in BOTH directions: `enabled: true` survives a manifest declaring `false`, and `enabled: false` survives a manifest declaring `true`. |
| T-102-06 — the ledger-succeeds / cascade-fails window | low | Accepted by D-102-02 and now characterized: failure is reported at `error` severity, the record survives enabled, and its inventory matches disk on both sides of the throw (folded where the bridge ran, retained where it did not). |
| T-102-SC — package installs | low | No package installed; `package.json` untouched. |

## Known Stubs

None. No stub, TODO, FIXME, skipped test or unrun `<verify>` was introduced.

## Deferred to Later Plans

- **102-03** — the reconcile absent-key stamp driven by
  `PlannedPluginInstall.configSource`, and the projection that reads
  `landedDisabled`. The precedence cases here are what constrain that stamp's
  scope: it may only ever answer the absent case.

## Self-Check: PASSED

Files claimed modified — all present on disk and in the three commits:
`tests/orchestrators/plugin/install.test.ts`,
`tests/orchestrators/import/execute.test.ts`,
`.planning/workstreams/defaults-enabled/phases/102-reason-token-install-write-through-and-notification/102-VALIDATION.md`.

Commits claimed — all three present in `git log`:
`0d4410ac` (1 file, +138), `a4fb27f8` (2 files, +128), `df227c08` (1 file, +137).
