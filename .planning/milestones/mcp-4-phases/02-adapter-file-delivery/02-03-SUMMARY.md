---
phase: 02-adapter-file-delivery
plan: 03
subsystem: mcp-bridge
tags: [mcp-bridge, carry-forward, user-overrides, adapter-entry]

requires:
  - phase: 02-adapter-file-delivery
    provides: adapter-doc partitionServers with the overlays bucket (plan 02-02), readMcpConfigDoc and withPluginServers (plan 02-01)
provides:
  - bridges/mcp/adapter-entry.ts stampServers(input) with the closed AFILE-06 carry-forward
  - the 34-key pi-mcp-adapter 5.0.0 ServerEntry pin and its package.json floor tie
  - stub absorption (D-02-10) through the partition's overlays
  - BACKLOG MCPOVR-01 (D-02-15) and the ROADMAP Phase 3 requestTimeoutMs note
affects: [Phase 3 entry translator (requestTimeoutMs is carried), Phase 4 variable expansion (entry content lives in adapter-entry.ts)]

actuals:
  tokens: 9229
  tasks: 2
  commits: 1
plan_head_before: ffe9ad562ed76336f810a15d78584490c6a96f3c
plan_head_after: 3ebe01dc6c58e560393306febc63c571bb797183

tech-stack:
  added: []
  patterns:
    - "Entry content is built in one module: translated entry, then carried fields, then the marker"
    - "An external data contract (the adapter's ServerEntry) is vendored in the test with provenance and tied to the package.json floor"

key-files:
  created:
    - extensions/pi-claude-marketplace/bridges/mcp/adapter-entry.ts
    - tests/bridges/mcp/adapter-entry.test.ts
  modified:
    - extensions/pi-claude-marketplace/bridges/mcp/stage.ts
    - extensions/pi-claude-marketplace/bridges/mcp/safe-set.ts
    - tests/bridges/mcp/stage.test.ts
    - tests/orchestrators/plugin/update-flow.test.ts
    - tests/orchestrators/plugin/reinstall-flow.test.ts
    - scripts/check-unused-type-members.contracts.json
    - .planning/BACKLOG.md
    - .planning/ROADMAP.md

key-decisions:
  - "`previous` is built as `{ ...ours, ...overlays }`: object spread defines own data properties, so a `__proto__` server name stays an own key without a safeSet loop, and an overlay under the selected key wins over the plugin's owned entry"
  - "A carried field the plugin also sets keeps the plugin's key position (spread semantics); a carried field the plugin does not set follows the translated fields in carried-set order; the marker is last"
  - "stage.test.ts keeps the user-scope substitution case, because the MENV-03 project-or-undefined decision lives in stage.ts; the malformed-entry case moved to adapter-entry.test.ts and stage.test.ts keeps one warning pass-through case"

patterns-established:
  - "prepareStageMcpServers -> partitionServers -> stampServers({ servers, substitution, previous }) -> withPluginServers"

requirements-completed: [AFILE-06]

coverage:
  - id: D1
    description: "The nine carried fields keep their previous values over the plugin's; directTools, toolPrefix and the other 23 ServerEntry keys come only from the plugin"
    requirement: AFILE-06
    verification:
      - kind: unit
        ref: "tests/bridges/mcp/adapter-entry.test.ts#AFILE-06: of every ServerEntry key, only the carried keys keep their previous values"
        status: pass
      - kind: unit
        ref: "tests/bridges/mcp/adapter-entry.test.ts#AFILE-06: a previous entry's credentials, env and owned fields never reach a command-only entry"
        status: pass
    human_judgment: false
  - id: D2
    description: "The vendored 34-key list fails when package.json's pi-mcp-adapter floor moves off >=5.0.0"
    requirement: AFILE-06
    verification:
      - kind: unit
        ref: "tests/bridges/mcp/adapter-entry.test.ts#AFILE-06: the vendored ServerEntry keys match the pi-mcp-adapter floor"
        status: pass
    human_judgment: false
  - id: D3
    description: "A disable stub under the plugin's name is absorbed: disabled carries, env, headers and bearerToken do not"
    requirement: AFILE-06
    verification:
      - kind: unit
        ref: "tests/bridges/mcp/stage.test.ts#AFILE-06: absorbs a disable stub's carried fields and none of its credentials"
        status: pass
    human_judgment: false
  - id: D4
    description: "disabled: true survives update and reinstall next to the new command"
    requirement: AFILE-06
    verification:
      - kind: integration
        ref: "tests/orchestrators/plugin/update-flow.test.ts#AFILE-06: a disabled plugin MCP server stays disabled through update"
        status: pass
      - kind: integration
        ref: "tests/orchestrators/plugin/reinstall-flow.test.ts#AFILE-06: a disabled plugin MCP server stays disabled through reinstall"
        status: pass
    human_judgment: false
  - id: D5
    description: "Edges: explicit disabled false carries, inherited fields do not, no previous entry adds nothing, key order is fixed, a second stage writes identical bytes"
    requirement: AFILE-06
    verification:
      - kind: unit
        ref: "tests/bridges/mcp/adapter-entry.test.ts#AFILE-06"
        status: pass
      - kind: unit
        ref: "tests/bridges/mcp/stage.test.ts#AFILE-06: staging the same plugin version twice writes identical bytes"
        status: pass
    human_judgment: false

duration: 67min
completed: 2026-10-03
status: complete
---

# Phase 2 Plan 03: Carry user MCP overrides through update and reinstall Summary

**Entry stamping moved into `bridges/mcp/adapter-entry.ts`, which carries the nine user fields of pi-mcp-adapter's `ServerEntry` (`disabled`, `approveTools`, `includeTools`, `excludeTools`, `lifecycle`, `idleTimeout`, `requestTimeoutMs`, `debug`, `searchKeywords`) from the entry it replaces, so a `/mcp-adapter disable` survives `update` and `reinstall`, and a disable stub in the target file is absorbed without any credential field.**

## Performance

- **Duration:** about 67 min (about 40 of them waiting on the full `npm changed checks` hook run)
- **Completed:** 2026-10-03
- **Tasks:** 2 of 2
- **Files changed:** 10 (2 created, 8 modified)

## Accomplishments

- New `adapter-entry.ts`. `stampServers({ servers, pluginName, marketplaceName, substitution, previous })` builds each entry as `{ ...translated, ...carried, _piClaudeMarketplace }`. `translated` is the substituted entry with the injected env (MENV-01/02), with the same non-object and malformed-env warnings as before. `carried` copies each field of the module-private `CARRIED_FIELDS` that the previous entry holds as an own property, whatever its value. Nothing exports the set.
- `stage.ts` no longer holds `isPlainObject` or `stampServers`. `prepareStageMcpServers` passes `previous: { ...ours, ...overlays }`, so the plugin's previous marked entry (either server key) and a marker-less stub under the selected key both feed carry-forward, with the stub winning. This is the first production reader of `McpServerPartition.overlays`.
- `adapter-entry.test.ts` vendors the 34 `ServerEntry` keys with the provenance line `pi-mcp-adapter@5.0.0 types.ts:438-525 (ServerEntry), dist.shasum 6c20461d658ec7d7b7e303b067e2ff13a7846d00`, writes the carried set as its own literal, and compares whole entries. A third case ties the list to `peerDependencies["pi-mcp-adapter"] === ">=5.0.0"` and tells the reader to refresh the list and revisit the carried set.
- `stage.test.ts`: the stub-absorption case (exact bytes, the stub's `env`, `headers` and `bearerToken` absent, the plugin's own env present) and the idempotency case (two stages, identical bytes, the second carrying from the owned entry). The existing overlay case now expects the absorbed `disabled: true`.
- End to end: `update-flow.test.ts` and `reinstall-flow.test.ts` install the plugin for real, spread `disabled: true` into its entry the way `/mcp-adapter disable` does, change the server command, run `update` (1.0.0 to 1.0.1) or `reinstall`, and compare the whole entry.
- BACKLOG `MCPOVR-01` records D-02-15. ROADMAP Phase 3 **Notes** gains one sentence: ANAME-07 writes `requestTimeoutMs`, AFILE-06 carries it, and Phase 3 must decide how the two interact (02-RESEARCH.md Pitfall 5).

## Task Commits

Both tasks land in ONE code commit, as the plan requires:

1. **Tasks 1-2: carry user overrides through plugin updates** - `3ebe01dc` (feat)

## Verification evidence

- Task 1 verify (`tmp/p2-03-t1-verify.log`, `VERIFY_EXIT=0`): typecheck; adapter-entry + stage 56 pass; `^AFILE-06` update-flow pass 1; direct coverage 100% for `adapter-entry.ts` (branches 19/19, functions 4/4, lines 122/122) and `stage.ts` (63/63, 17/17, 359/359).
- Tracer gate after Task 1: interactive mode (`auto_advance: false`), `end-of-phase` human verify, automated-only verify passed, so expansion continued.
- Task 2 verify (`tmp/p2-03-t2-verify.log`, `VERIFY_EXIT=0`): adapter-entry + stage 58 pass; `^AFILE-06` reinstall-flow pass 1 and update-flow pass 1; direct coverage 100% for `adapter-entry.ts` (19/19, 4/4, 122/122), `stage.ts` (63/63, 17/17, 358/358) and `safe-set.ts` (3/3, 1/1, 24/24); `lint:type-members` exit 0.
- ESLint over every changed `.ts` file exits 0; `format:check` exits 0.
- Pre-commit over the 8 code paths plus this SUMMARY, STATE.md, ROADMAP.md, REQUIREMENTS.md and BACKLOG.md: `PRECOMMIT_EXIT=0` (`tmp/p2-03-precommit.log`). `npm changed checks` selected the full scope (`npm run check` plus `test:coverage:direct:all`), because `scripts/check-unused-type-members.contracts.json` is a tool input, and passed. A first attempt was stopped by the 10-minute background limit before the hook finished; it wrote nothing and was re-run with a longer limit.
- `fallow audit`: verdict `warn`, not `fail`; its two `introduced` clone groups sit in `tests/architecture/catalog-uat/fixtures/plugin-info.ts`, which this plan does not touch.
- focused task verification passed; full phase/PR verification pending.

## TDD (Task 2)

The tracer task implemented the carry-forward, so Task 2's RED is shown with negative controls against the finished tests (`tmp/p2-03-red.log`), each restored afterwards:

- A, no carry-forward (`previous: {}` in stage.ts): the reinstall case and three stage cases fail (`A_REINSTALL_EXIT=1`, `A_STAGE_EXIT=1`). The same control failed the update case (`tmp/p2-03-negctl.log`, `NEGCTL_EXIT=1`).
- B, `directTools` and `env` added to the carried set: both pin cases and the absorption case fail (`B_EXIT=1`).
- C, `requestTimeoutMs` removed from the carried set: both pin cases fail (`C_EXIT=1`).
- D, package.json floor moved to `>=5.1.0`: the floor case fails with the refresh message (`D_EXIT=1`).

GREEN: the verify run above. The plan's single-commit protocol replaces per-gate commits; the plan type is `execute`.

## Re-pinned type-member contracts

`scripts/check-unused-type-members.contracts.json`, line shifts only (columns unchanged):

- `bridges/mcp/stage.ts:334:48` -> `:291:48` (filter `:334:22` -> `:291:22`)
- `bridges/mcp/stage.ts:381:42` -> `:338:42` (filter `:381:16` -> `:338:16`)
- `bridges/mcp/stage.ts:58:29` -> `:59:29` (filter `:58:3` -> `:59:3`)

## Decisions Made

See `key-decisions`.

## Assumptions and carried notes

- `rg "D-02-" extensions tests` counts 11 lines before and after this plan; no new hit.
- "A carried field whose previous value equals the plugin's value yields that value once" holds by construction (object keys are unique); the ordering case covers it with `lifecycle: "eager"` on both sides.
- The prepare-to-commit window (a `/mcp-adapter disable` written between prepare and commit is overwritten) is a backstop truth with no test, as the plan marks it; T-02-12 accepts it.
- Carry-forward cannot tell a user value from a plugin value, so a plugin value in a carried field sticks after a later version drops it (T-02-13, Pitfall 5). Recorded for Phase 3.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Stale comment] safe-set.ts header named stage.ts as a server-name accumulator**

- **Found during:** Task 1
- **Issue:** after the move, stage.ts no longer calls `safeSet`; the header named the wrong module.
- **Fix:** the header now names `adapter-entry.ts` and `adapter-doc.ts`. Comment only.
- **Files modified:** `extensions/pi-claude-marketplace/bridges/mcp/safe-set.ts`

**2. [Simplification] `previous` built by object spread instead of a safeSet loop**

- **Found during:** Task 1
- **Issue:** the plan asked for a per-name loop with `safeSet`. Object spread already defines own data properties (checked: a parsed `__proto__` key stays own and the prototype is untouched), and it has no branches to cover.
- **Fix:** `previous: { ...ours, ...overlays }` with a comment stating the WR-01 property.
- **Files modified:** `extensions/pi-claude-marketplace/bridges/mcp/stage.ts`

**3. [Test shape] Stamping cases split between the two test files**

- The malformed-entry case moved to `adapter-entry.test.ts`; `stage.test.ts` keeps a one-entry warning pass-through case, because stage.ts's own job is to return the warnings. The user-scope case stays in `stage.test.ts` (MENV-03 is decided in stage.ts), and `adapter-entry.test.ts` gains a direct no-project-dir case.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## Cost actuals

`actuals.tokens` = 9229 (chars/4 over the code diff from `ffe9ad56` plus the two new files) against the 95000 estimate (10%). Tasks 2 of 2. Commits: 1 code commit, measured from the ledger base.

## Next Phase Readiness

Plan 02-04 can route the comments-dropped notice. Phase 3 changes entry content in `adapter-entry.ts` and must settle the `requestTimeoutMs` interaction recorded in its Notes.

## Self-Check: PASSED

- Created files exist: `extensions/pi-claude-marketplace/bridges/mcp/adapter-entry.ts`, `tests/bridges/mcp/adapter-entry.test.ts`.
- Code commit `3ebe01dc` exists on `features/mcp-4` and lists all 8 code paths; `git rev-list --count ffe9ad56..3ebe01dc` is 1.
