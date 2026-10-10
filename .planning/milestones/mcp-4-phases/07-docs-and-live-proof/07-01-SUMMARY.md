---
phase: 07-docs-and-live-proof
plan: 01
subsystem: dependencies
tags: [mcp, pi-mcp-adapter, peer-floor, security, pi-sh]

requires:
  - phase: 04-variable-expansion
    provides: the AVAR-03 adapter expansion conformance suite and the D-04-12/D-04-17 range
  - phase: 06-live-mcp-status
    provides: the ASTAT status conformance suite
provides:
  - "Optional peer pi-mcp-adapter >=5.2.0 <6 in package.json and the npm-written lock root"
  - "PIFL-03 and AFILE-06 gates pinned to >=5.2.0 <6; vendored citations name 5.2.0 / shasum 9950f0b4"
  - "CI integration job installs pi-mcp-adapter@5.2.0"
  - "scripts/pi.sh pins 5.2.0 and loads -e builtin:tool-search"
  - "Planning records (PIFL-03, ROADMAP decision 5 and Phase 1 criterion 3, PROJECT.md, STACK.md) cite D-07-07"
affects: [07-02, 07-03, 07-04, 07-05]

actuals:
  tokens: 5612
  tasks: 3
  commits: 3
plan_head_before: e261652623a0c1ac9e208a0760336bba3ba9a390
plan_head_after: b769a234eec5ec41bf4ce560be7cbacc6ac9c3ee

tech-stack:
  added: []
  patterns:
    - "A peer floor move is gated by a read-only cmp/diff re-check of the cited adapter files before any pin moves"

key-files:
  created: []
  modified:
    - package.json
    - package-lock.json
    - tests/architecture/peer-floor.test.ts
    - tests/bridges/mcp/adapter-entry.test.ts
    - .github/workflows/ci.yml
    - scripts/pi.sh
    - extensions/pi-claude-marketplace/bridges/mcp/adapter-doc.ts
    - extensions/pi-claude-marketplace/platform/mcp-status.ts
    - tests/integration/mcp-override-lifecycle.test.ts
    - docs/output-catalog.md
    - .planning/REQUIREMENTS.md
    - .planning/ROADMAP.md
    - .planning/PROJECT.md
    - .planning/codebase/STACK.md

key-decisions:
  - "D-07-07 applied: the pi-mcp-adapter optional peer is >=5.2.0 <6, because 5.2.0's MCP SDK 2.3.1 fixes GHSA-6qxp-vccf-f47h"
  - "Vendored adapter citations keep their file:line references; only version and shasum change, since every cited file is byte-identical between 5.1.0 and 5.2.0"
  - "D-07-05 applied: pi.sh passes -e builtin:tool-search after --no-extensions; builtin:mcp stays off"

patterns-established:
  - "PI_MCP_ADAPTER_ROOT must name a 5.2.0 install from now on; the peer loader refuses 5.1.0 as outside the declared range"

requirements-completed: [ADOC-02, ADOC-01]

coverage:
  - id: D1
    description: "Optional peer pi-mcp-adapter >=5.2.0 <6 in package.json and lock root, pinned by the PIFL-03 and AFILE-06 gates, with CI installing 5.2.0"
    requirement: "ADOC-02"
    verification:
      - kind: unit
        ref: "tests/architecture/peer-floor.test.ts"
        status: pass
      - kind: unit
        ref: "tests/bridges/mcp/adapter-entry.test.ts#AFILE-06: the vendored ServerEntry keys match the pi-mcp-adapter floor"
        status: pass
    human_judgment: false
  - id: D2
    description: "Both adapter conformance suites (AVAR-03 expansion, ASTAT status) pass against the real 5.2.0 with zero skips and no code change"
    requirement: "ADOC-02"
    verification:
      - kind: integration
        ref: "PI_MCP_ADAPTER_ROOT=/var/tmp/mcp4-p7-research/a520/node_modules/pi-mcp-adapter node --test tests/integration/adapter-expansion-conformance.test.ts tests/integration/mcp-status-conformance.test.ts"
        status: pass
    human_judgment: false
  - id: D3
    description: "scripts/pi.sh pins pi-mcp-adapter@5.2.0 and passes -e builtin:tool-search so tool_search works in pi.sh sessions while builtin:mcp stays off"
    requirement: "ADOC-02"
    verification:
      - kind: other
        ref: "bash -n scripts/pi.sh && bash scripts/pi.sh --help | grep -iE 'tool[ _-]search'"
        status: pass
    human_judgment: true
    rationale: "No pi.sh session was launched (plan forbids a real run); a live Pi session must confirm tool_search loads, which the 07-02/07-04 live canary covers"
  - id: D4
    description: "Version comments in adapter-doc.ts, mcp-status.ts, mcp-override-lifecycle.test.ts and the output-catalog session-start sentence name 5.2.0 with no code or catalog-block change"
    requirement: "ADOC-01"
    verification:
      - kind: unit
        ref: "node --test tests/bridges/mcp/adapter-doc.test.ts tests/platform/mcp-status.test.ts tests/architecture/catalog-uat/catalog-contract.test.ts"
        status: pass
    human_judgment: false
  - id: D5
    description: "Planning records (PIFL-03, ROADMAP settled decision 5 and Phase 1 criterion 3, PROJECT.md, STACK.md) state >=5.2.0 <6 and cite D-07-07"
    requirement: "ADOC-01"
    verification:
      - kind: other
        ref: "Task 3 <verify> grep chain"
        status: pass
    human_judgment: false

duration: 7min
completed: 2026-10-09
status: complete
---

# Phase 7 Plan 01: Raise the pi-mcp-adapter floor to 5.2.0 Summary

**The optional pi-mcp-adapter peer is now `>=5.2.0 <6` (MCP SDK 2.3.1, fixing GHSA-6qxp-vccf-f47h) in the manifest, the npm-written lock, both gates, CI and pi.sh, which also keeps Pi's `tool_search` via `-e builtin:tool-search`. Both conformance suites pass against the real 5.2.0 with no code change.**

## Performance

- **Duration:** about 7 min
- **Started:** 2026-10-09T21:50:00Z
- **Completed:** 2026-10-09T21:57:00Z
- **Tasks:** 3
- **Files modified:** 14

## Adapter 5.2.0 re-check

From `tmp/p7-01-recheck.txt` (read-only; scratch copies read with `cmp`/`diff` only):

- `npm view pi-mcp-adapter@5.2.0`: dist.integrity `sha512-I1J8jEtInPYlwxoOk0WyVzHsBnP2ahYwSNKOKPEsDgwL+8dvUaGCcD220lSxwbMhaLIgnar6DCbufjoU6caHpw==`, dist.shasum `9950f0b4423371c7a7839d67d7e20cade3debc69`, `_npmUser.name` `nicopreme`. The 5.2.0 scratch lock holds the same integrity. The 5.1.0 scratch lock integrity also matches the registry.
- `cmp` was silent (exit 0) for all seventeen files: `types.ts`, `config.ts`, `utils.ts`, `server-manager.ts`, `mcp-auth-flow.ts`, `mcp-status.ts`, `metadata-cache.ts`, `project-server-trust.ts`, `agent-plugin-provenance.ts`, `commands.ts`, `pi-builtin-mcp.ts`, `direct-tool-surface.ts`, `dist/types.d.ts`, `dist/types.js`, `dist/utils.js`, `dist/mcp-auth-flow.js`, `dist/server-manager.js`.
- `diff -rq 5.1.0 5.2.0 -x '*.map' -x node_modules` listed exactly the ten expected files: `CHANGELOG.md`, `cli.js`, `dist/jev-key-store.js`, `docs/configuration.md`, `docs/scripting.md`, `docs/tools.md`, `index.ts`, `jev-key-store.ts`, `package.json`, `proxy-modes.ts`.

No conformance fact changed.

## Conformance

`PI_MCP_ADAPTER_ROOT=/var/tmp/mcp4-p7-research/a520/node_modules/pi-mcp-adapter`, AVAR-03 expansion plus ASTAT status suites: `# tests 55`, `# pass 55`, `# fail 0`, `# skipped 0`, `CONFORMANCE_EXIT=0`.

A check run with the old 5.1.0 scratch as `PI_MCP_ADAPTER_ROOT` fails as designed: "holds pi-mcp-adapter 5.1.0, outside the declared peer range >=5.2.0 <6". **From now on any `PI_MCP_ADAPTER_ROOT` (including the orchestrator's `npm run check` gate) must name a 5.2.0 install.**

## Accomplishments

- Peer range `>=5.2.0 <6` in package.json; `npm install --package-lock-only --ignore-scripts` changed one lock line (numstat `1 1 package-lock.json`); no version, resolved or integrity value moved.
- PIFL-03 gate (3 literals) and AFILE-06 floor assertion moved; the three vendored citations name `pi-mcp-adapter@5.2.0` and shasum `9950f0b4...`, line references unchanged. `adapter-entry.ts` untouched.
- CI integration job installs `pi-mcp-adapter@5.2.0`.
- `scripts/pi.sh` pins 5.2.0, adds `-e builtin:tool-search` (confirmed: Pi 1.0.0 ships `dist/extensions/tool-search/` and `resolveExtensionSources` loads `builtin:<name>`), with a comment and a usage-text mention. No `-e builtin:mcp`.
- Four version comments and the catalog snapshot sentence name 5.2.0; no code line, catalog block or catalog-state marker changed.
- Planning records state the new floor and cite D-07-07 with GHSA-6qxp-vccf-f47h.

## Task Commits

1. **Task 1 (tracer): the 5.2.0 floor end to end** - `2534109a` `build(deps): raise the pi-mcp-adapter peer floor to 5.2.0`
   - Files: package.json, package-lock.json, tests/architecture/peer-floor.test.ts, tests/bridges/mcp/adapter-entry.test.ts, .github/workflows/ci.yml
   - Hook: `npm run check:commit` ran and passed (package.json staged, so all source-test pairs). `fallow audit --base e2616526`: no issues.
2. **Task 2: pi.sh pin, tool_search, version comments** - `58c5a007` `chore(scripts): pin pi-mcp-adapter 5.2.0 and keep tool_search in pi.sh`
   - Files: scripts/pi.sh, bridges/mcp/adapter-doc.ts, platform/mcp-status.ts, tests/integration/mcp-override-lifecycle.test.ts, docs/output-catalog.md
   - Hook: `npm run check:commit` ran and passed (staged pairs adapter-doc and mcp-status, plus static checks and catalog gates). `fallow audit`: no issues.
3. **Task 3: planning records** - `b769a234` `docs(planning): record the pi-mcp-adapter 5.2.0 floor`
   - Files: .planning/REQUIREMENTS.md, .planning/ROADMAP.md, .planning/PROJECT.md, .planning/codebase/STACK.md
   - Hook: npm-check skipped (no build input staged); the other pre-commit hooks passed.

The tracer gate was re-run after Task 1 (end-of-phase mode, automated verify only): it passed, so expansion continued.

## Files Created/Modified

- `package.json`, `package-lock.json` - optional peer range
- `tests/architecture/peer-floor.test.ts` - PIFL-03 literals
- `tests/bridges/mcp/adapter-entry.test.ts` - 5.2.0 citations and AFILE-06 floor literal
- `.github/workflows/ci.yml` - CI peer pin
- `scripts/pi.sh` - pin, `-e builtin:tool-search`, comment, usage text
- `extensions/pi-claude-marketplace/bridges/mcp/adapter-doc.ts`, `extensions/pi-claude-marketplace/platform/mcp-status.ts` - comments only
- `tests/integration/mcp-override-lifecycle.test.ts` - two comments
- `docs/output-catalog.md` - one version word
- `.planning/REQUIREMENTS.md`, `.planning/ROADMAP.md`, `.planning/PROJECT.md`, `.planning/codebase/STACK.md` - records

## Decisions Made

None beyond the plan: D-07-07 and D-07-05 applied as written.

## Deviations from Plan

None - plan executed exactly as written.

Two notes:
- The PROJECT.md Dependency floor bullet was rewrapped over four lines to stay under 100 columns after the range grew by ` <6`.
- The `rg -n 'ADOC-0[123]' .planning/REQUIREMENTS.md` output keeps the same six lines with the same content; their line numbers moved down by one because the PIFL-03 amendment added a line. Status is untouched.

## Issues Encountered

None.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- 07-02/07-04 (live canary) can run against 5.2.0 only; 07-03/07-05 (docs) can name 5.2.0. The README, README.es and `docs/mcp-compatibility.md` version lines remain for 07-05.
- Verification status: focused task verification passed; full phase/PR verification pending (`npm run check` on the merged tree is the orchestrator's gate, and it must set `PI_MCP_ADAPTER_ROOT` to a 5.2.0 install or leave it unset).

---
*Phase: 07-docs-and-live-proof*
*Completed: 2026-10-09*

## Self-Check: PASSED
