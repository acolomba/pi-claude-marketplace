---
phase: 04-variable-expansion-at-claude-code-parity
plan: 09
subsystem: mcp
tags: [mcp, notices, docs, backlog, pi-mcp-adapter]

requires:
  - phase: 04-variable-expansion-at-claude-code-parity
    provides: "04-02/04-03 install warnings, 04-04 home-marker partial, 04-05 Pi process variables, 04-07 info lines, 04-08 adapter conformance proof"
provides:
  - "Proof that update, reinstall, enable, import and the reconcile cascade each report the unset variable and the withheld credential after their rows"
  - "docs/mcp-compatibility.md section Variables and ten new divergence entries"
  - "MENVX-01 and ENVLIT-01 closed in BACKLOG.md; ENVDOC-01 points at the new section"
affects: [phase-05-migration, phase-07-docs, ENVDOC-01]

actuals:
  tokens: 10300
  tasks: 2
  commits: 1
plan_head_before: 8b447852f6307fe27b9f5aa9a0fe6af3dcdfb956
plan_head_after: c0a51935bb4a6757db43c97232e0c866d8fd0d9e

tech-stack:
  added: []
  patterns:
    - "Each staging verb's notice proof asserts the whole notification list: its rows, then the two warnings, plus a sentinel-absence filter"

key-files:
  created: []
  modified:
    - tests/integration/mcp-variable-expansion.test.ts
    - tests/orchestrators/import/execute.test.ts
    - tests/orchestrators/reconcile/apply.test.ts
    - docs/mcp-compatibility.md
    - .planning/BACKLOG.md

key-decisions:
  - "The import case runs the real install path (no `deps` stubs), so the warnings come from a real staged entry, as the reconcile case does"
  - "The reconcile case reuses seedCommentedAdapterScope, so its expected list also pins the comments-removed notice before the two variable warnings on the same route"
  - "The five expansion rows of the Translated fields table now say the variables are rewritten and link to the Variables section"

patterns-established:
  - "AVAR-04 staging proofs: unset PI_CM_AVAR_SITE, set ANTHROPIC_API_KEY to a sentinel, restore both, assert rows + both warnings + no sentinel"

requirements-completed: [AVAR-04, AVAR-03]

coverage:
  - id: D1
    description: "update, reinstall and enable each show the unset-variable and withheld-credential warnings after their rows, with no credential value"
    requirement: AVAR-04
    verification:
      - kind: integration
        ref: "tests/integration/mcp-variable-expansion.test.ts#AVAR-04: an update reports the unset variable and the withheld credential after its rows"
        status: pass
      - kind: integration
        ref: "tests/integration/mcp-variable-expansion.test.ts#AVAR-04: a reinstall reports the unset variable and the withheld credential after its rows"
        status: pass
      - kind: integration
        ref: "tests/integration/mcp-variable-expansion.test.ts#AVAR-04: enabling a disabled plugin reports the unset variable and the withheld credential after its rows"
        status: pass
    human_judgment: false
  - id: D2
    description: "import and the reconcile cascade show the same two warnings"
    requirement: AVAR-04
    verification:
      - kind: unit
        ref: "tests/orchestrators/import/execute.test.ts#AVAR-04: an import reports the unset variable and the withheld credential after its cascade"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/reconcile/apply.test.ts#AVAR-04: the reconcile cascade reports the unset variable and the withheld credential"
        status: pass
    human_judgment: false
  - id: D3
    description: "docs/mcp-compatibility.md states the variable rules, the escape, the deny-list, the warnings, the info lines and every divergence in plain English"
    requirement: AVAR-03
    verification:
      - kind: other
        ref: "rg -n '^## Variables|PI_CLAUDE_MARKETPLACE_EMPTY|GITHUB_TOKEN|literalEnv|debug log' docs/mcp-compatibility.md"
        status: pass
    human_judgment: true
    rationale: "Prose accuracy and readability need a human read; the greps only prove the terms are present"
  - id: D4
    description: "MENVX-01 and ENVLIT-01 closed with dispositions; ENVDOC-01 stays open"
    requirement: AVAR-03
    verification:
      - kind: other
        ref: "rg -n '^## ~~MENVX-01|^## ~~ENVLIT-01|^## ENVDOC-01' .planning/BACKLOG.md"
        status: pass
    human_judgment: false

duration: 11min
completed: 2026-10-07
status: complete
---

# Phase 4 Plan 09: Staging-verb variable warnings and the Variables doc Summary

**Update, reinstall, enable, import and the `/reload` reconcile cascade now each have a case that proves the `MCP server variables not set.` and `MCP server credentials withheld.` warnings follow their rows with no credential value, `docs/mcp-compatibility.md` gains a "Variables" section and ten divergence entries, and MENVX-01 (escape `!` as `!!`) and ENVLIT-01 (`literalEnv` not used) are closed.**

## Performance

- **Duration:** about 11 min
- **Started:** 2026-10-07T19:48:33Z
- **Completed:** 2026-10-07T19:59:08Z
- **Tasks:** 2 (one commit, as the plan directs)
- **Files modified:** 5

## Accomplishments

- `tests/integration/mcp-variable-expansion.test.ts`: module-private `seedVariablePlugin` (servers `local`, stdio with `${PI_CM_AVAR_SITE}`, and `api`, http with `Bearer ${ANTHROPIC_API_KEY}`), `withUnsetSiteAndSetCredential` (deletes the site variable, sets the key to `avar-sentinel-04-09`, restores both in `finally`), and `assertVariableWarningsAfter` (whole notification list = rows + both warnings, and no notification holds the sentinel). Three cases through `createPluginUpdateOperations(...).updatePlugins`, `createReinstallOperation` and `createEnableOperation` (disable, then enable), each asserting only the later operation's notifications.
- `tests/orchestrators/import/execute.test.ts`: an import case over a real path marketplace `fixture-mp` and the real install path; it asserts the cascade row, then the two warnings, and no sentinel. Boundary sized `createNotificationBoundary(3, 1)`.
- `tests/orchestrators/reconcile/apply.test.ts`: a reload case (`seedCommentedAdapterScope` plus a two-server `.mcp.json`); it asserts the reconcile row, the comments-removed notice, the two warnings, and no sentinel. Boundary sized `createNotificationBoundary(4, 1)`. Env restored through `t.after`.
- `docs/mcp-compatibility.md`: new `## Variables` (where variables expand, other variables, adapter-only syntax and `PI_CLAUDE_MARKETPLACE_EMPTY`, the project directory at user scope, withheld credentials, warnings and info, proof against pi-mcp-adapter); ten new divergence entries; the home-marker row and info form in "Partially available plugins"; the five expansion rows of "Translated fields" link to the new section. No D-04 decision IDs.
- `.planning/BACKLOG.md`: `## ~~MENVX-01 ...~~ -- CLOSED` and `## ~~ENVLIT-01 ...~~ -- CLOSED` with dated dispositions; ENVDOC-01 stays open with a pointer to the new section.

## Task Commits

1. **Task 1: update, reinstall and enable report both warnings (tracer)** - `c0a51935`
2. **Task 2: import and reconcile cases, the doc, the backlog, the commit** - `c0a51935` (docs)

Tracer gate (Task 1): `workflow.auto_advance` is false, `workflow.human_verify_mode` is the default `end-of-phase`, the tracer has no `gate` attribute, and its `<verify>` is automated-only. The verify was re-run (exit 0, 5 pass), and execution expanded with no checkpoint.

## Verification

Node v26.10.0. All commands from the repo root.

| Command | Exit | Notes |
|---|---|---|
| Task 1: `mkdir -p /var/tmp/mcp4-p4-09 && npm run typecheck && TMPDIR=/var/tmp/mcp4-p4-09 node --test tests/integration/mcp-variable-expansion.test.ts` | 0 | 5 tests, 5 pass, 0 fail, 0 skipped; no `error TS`; re-run on the committed content |
| Task 2 verify 1: `mkdir -p /var/tmp/mcp4-p4-09 && TMPDIR=/var/tmp/mcp4-p4-09 node --test --test-name-pattern="^AVAR-04" tests/orchestrators/import/execute.test.ts tests/orchestrators/reconcile/apply.test.ts` | 0 | 2 tests, 2 pass, 0 fail |
| Task 2 verify 2, part 1: `TMPDIR=/var/tmp/mcp4-p4-09 npm run test:modules` | 0 | no `not ok`; run on the final working tree, which the commit holds unchanged |
| Task 2 verify 2, part 2: `TMPDIR=/var/tmp/mcp4-p4-09 npm run test:integration` | 0 | no failure lines |
| Task 2 verify 2, part 3: `test "$(tail -n 1 tmp/p4-09-precommit.log)" = PRECOMMIT_EXIT=0 && git log -1 --format=%s` | 0 | printed `docs(mcp): document plugin MCP variable expansion and its divergences` |
| `BASE=$(cat tmp/p4-09-base) && npx fallow audit --base "$BASE"` | 0 | `No issues in 5 changed files` |
| `git diff "$BASE"..HEAD -- tests docs > tmp/p4-09-added.diff && ! rg -q '^\+.*D-04-[0-9]{2}' tmp/p4-09-added.diff` | 0 | no D-04 IDs added |

- Acceptance greps: the three Task 1 titles and each operation name print; `^## Variables` prints one line; each of `PI_CLAUDE_MARKETPLACE_EMPTY`, `GITHUB_TOKEN`, `literalEnv`, `debug log` is in the doc; `^## ~~MENVX-01` and `^## ~~ENVLIT-01` print, `^## ENVDOC-01` prints one line; both Task 2 titles print once.
- `tmp/p4-09-precommit.log` ends with `PRECOMMIT_EXIT=0`. The first run reformatted the doc (mdformat realigned the two tables), and the second run was clean.
- Commit `c0a51935` hook: `npm run check:commit....Passed` (pre-commit pass), mdformat and markdownlint-cli2 Passed, gitlint Passed. First attempt succeeded.

Focused task verification passed; full phase/PR verification pending.

## Files Created/Modified

- `tests/integration/mcp-variable-expansion.test.ts` - update, reinstall and enable notice cases and their helpers
- `tests/orchestrators/import/execute.test.ts` - import notice case through the real install path
- `tests/orchestrators/reconcile/apply.test.ts` - reconcile-cascade notice case
- `docs/mcp-compatibility.md` - Variables section, divergences, home-marker row
- `.planning/BACKLOG.md` - MENVX-01 and ENVLIT-01 closed, ENVDOC-01 pointer

## Decisions Made

- The enable case expects the row `● hello v1.0.0 (installed) {requires pi-mcp-adapter}` at warning severity, because that is what the enable branch renders today; the case pins it as found.
- The import cascade row renders at info severity with no summary line, unlike the standalone install row; the case pins it as found.
- The doc's divergence entries cite requirement IDs (AVAR-01..05) as the reason anchors, in the existing "Reason: a project decision (ID)" form.

## Deviations from Plan

### Auto-fixed Issues

**1. [Test realism] The import case runs the real install path**
- **Found during:** Task 2
- **Issue:** the comments-dropped case the plan names stubs `installPlugin` with canned notices, so setting the environment would prove nothing.
- **Fix:** the case follows the suite's real-install cases (`gitOps`, no `deps`), with a path marketplace holding the two servers, so the warnings come from a real staged entry.
- **Files modified:** tests/orchestrators/import/execute.test.ts
- **Committed in:** c0a51935

**2. [Doc accuracy] Translated-fields rows**
- **Found during:** Task 2
- **Issue:** the table said `command`, `args`, `env`, `url` and `headers` are "Copied.", which the variable rewrite makes untrue.
- **Fix:** each row says "Copied, with its variables rewritten. See [Variables](#variables)."
- **Files modified:** docs/mcp-compatibility.md
- **Committed in:** c0a51935

---

**Total deviations:** 2 (1 test realism, 1 doc accuracy)
**Impact on plan:** none on scope; both keep the proofs and the doc truthful.

## Issues Encountered

None.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 4 is complete pending the phase gate (`npm run check` on the combined tree, plus the zero-skip conformance run with `PI_MCP_ADAPTER_ROOT=/var/tmp/mcp4-p4-08/adapter/node_modules/pi-mcp-adapter`).
- Phase 5's migration stages through `prepareStageMcpServers` and owns its own warning proof.
- The doc intro still names pi-mcp-adapter 5.0.0 for the Pi column; the docs phase (ADOC-01, ENVDOC-01) owns that pass.

## Self-Check: PASSED

- FOUND: all five modified files
- FOUND: commit c0a51935 is an ancestor of HEAD

---
*Phase: 04-variable-expansion-at-claude-code-parity*
*Completed: 2026-10-07*
