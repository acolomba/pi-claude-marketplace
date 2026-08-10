---
phase: 98-lifecycle-regression-and-contract-documentation
plan: 01
subsystem: orchestrators
tags: [notify, soft-dep, reconcile, enable-disable, install-ledger, output-catalog]

# Dependency graph
requires:
  - phase: 97-disabled-state-classification-repair
    provides: the enable-arm degradation signals (ENBL-07 / SURF-05 / WARN-01) whose install-arm counterparts this plan lands
provides:
  - LedgerDegradationSignals — one shared shape both ledger-driven verbs intersect
  - orphanRewake threaded through the install outcome to the reconcile installed row (IN-07)
  - staged-agent / staged-MCP verdicts threaded into both enable row composers (WR-06)
  - two new catalog states with byte-equality fixtures (enable-soft-dep, reconcile-enable-soft-dep)
affects: [COMPAT-01 no-expansion gate, DOC-08 documentation reconciliation, WR-02, WR-04]

actuals:
  tokens: 13300
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "Shared ledger-signal interface in orchestrators/plugin/shared.ts, intersected by every verb that drives runInstallLedger"
    - "Row dependency derivation extracted to one exported seam (enableRowDependencies) shared by the standalone and projected enable rows"

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/orchestrators/plugin/shared.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/install.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts
    - extensions/pi-claude-marketplace/orchestrators/reconcile/apply-outcomes.ts
    - extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts
    - extensions/pi-claude-marketplace/orchestrators/reconcile/notify.ts
    - docs/output-catalog.md
    - tests/architecture/catalog-uat.test.ts
    - tests/orchestrators/plugin/enable-disable.test.ts
    - tests/orchestrators/reconcile/notify.test.ts

key-decisions:
  - "The shared signal shape lives in orchestrators/plugin/shared.ts, not enable-disable.ts: enable-disable.ts imports runInstallLedger from install.ts, so the reverse direction would close a module cycle no lint rule catches. EnableDegradationSignals survives as a type alias so no import site churned."
  - "The staged-count signals are named stagedAgents / stagedMcpServers rather than reusing declaresAgents / declaresMcp, which are REQUIRED booleans on InstallPluginOutcome's installed arm; intersecting the same names would have collapsed an optional signal into a required field."
  - "enableRowDependencies is exported from orchestrators/plugin/shared.ts and imported by reconcile/notify.ts so the standalone and projected enable rows derive from one seam instead of two copies."
  - "The reconcile projection keeps its severity rule (malformed alone). Its enable arm now agrees with its install arm, which has never applied the companion raise either; the standalone verb owns the SEV-01 composition. The marker is the shared fact; the severity stance is per surface."
  - "The two severity raises in freshEnableRow compose rather than replace: malformed wins outright, otherwise the companion probe decides (WARN-01 over SEV-01, neither dropped)."

patterns-established:
  - "Optional-field spread (`...(cond && { field })`) for every new outcome signal — exactOptionalPropertyTypes forbids assigning undefined, and omit-when-empty is what keeps an unaffected row byte-identical (NREG-01)."
  - "A carrier that changes rendered bytes ships its docs/output-catalog.md state and its catalog-uat FIXTURES entry in the SAME commit as the behavior change."

requirements-completed: [IN-07, WR-06]

coverage:
  - id: D1
    description: "A fresh reconcile install of a plugin with an orphan rewake handler renders {orphan rewake} on the installed row, exactly as the re-enable arm already does"
    requirement: "IN-07"
    verification:
      - kind: unit
        ref: "tests/orchestrators/reconcile/notify.test.ts#IN-07: a plugin-installed outcome carrying orphanRewake renders (installed) {orphan rewake} at info severity"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/reconcile/notify.test.ts#IN-07: an installed row carrying BOTH orphanRewake and a malformed kind emits {orphan rewake, malformed skill} in that order at warning severity"
        status: pass
    human_judgment: false
  - id: D2
    description: "A signal-free install row projects unchanged — no reasons brace, info severity, every other field as before (NREG-01)"
    requirement: "IN-07"
    verification:
      - kind: unit
        ref: "tests/orchestrators/reconcile/notify.test.ts#IN-07 / NREG-01: an install outcome carrying no degradation signal projects the row shape unchanged"
        status: pass
    human_judgment: false
  - id: D3
    description: "A standalone re-enable that staged an agent renders {requires pi-subagents} at warning severity when the companion is unloaded, and renders clean when it is loaded"
    requirement: "WR-06"
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/enable-disable.test.ts#WR-06 / SEV-01: enable of a plugin that stages an agent renders {requires pi-subagents} at warning severity when the companion is unloaded"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/enable-disable.test.ts#WR-06 / SEV-01: the same re-enable with pi-subagents loaded renders no marker and stays info"
        status: pass
      - kind: unit
        ref: "tests/architecture/catalog-uat.test.ts#catalog UAT: every <!-- catalog-state: --> annotation pairs byte-equal with notify()"
        status: pass
    human_judgment: false
  - id: D4
    description: "The WARN-01 and SEV-01 raises compose on the enable row — a re-enable that staged an agent AND degraded a skill carries both tokens at warning"
    requirement: "WR-06"
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/enable-disable.test.ts#WR-06 / WARN-01: a re-enable that staged an agent AND degraded a skill composes both raises -- one warning row carrying both tokens"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/enable-disable.test.ts#WR-06 / NREG-01: a re-enable that staged neither agents nor MCP servers renders the catalog enable-fresh row unchanged"
        status: pass
    human_judgment: false
  - id: D5
    description: "The reconcile enable projection derives the same dependency list on both arms, so the soft-dep markers no longer depend on which surface drove the enable"
    requirement: "WR-06"
    verification:
      - kind: unit
        ref: "tests/orchestrators/reconcile/notify.test.ts#WR-06: a reconcile enable that staged an agent projects a row declaring the agents dependency"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/reconcile/notify.test.ts#WR-06: the partially-installed enable arm carries the dependency list alongside the dropped-kind tokens"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/reconcile/notify.test.ts#WR-06 / NREG-01: an enable outcome that staged neither agents nor MCP servers keeps the empty dependency list"
        status: pass
    human_judgment: false
  - id: D6
    description: "No closed set gained a member — REASONS, STATUS_TOKENS, PLUGIN_STATUSES, MARKETPLACE_STATUSES and the glyph exports are unchanged (D-98-05)"
    verification:
      - kind: unit
        ref: "tests/architecture/notify-closed-set-locks.test.ts"
        status: pass
    human_judgment: false

duration: 50min
completed: 2026-08-09
status: complete
---

# Phase 98 Plan 01: Lifecycle regression and contract documentation Summary

**One shared `LedgerDegradationSignals` shape now feeds every row composed off `runInstallLedger`, so a fresh reconcile install names `{orphan rewake}` and both enable rows fire their soft-dep markers instead of hard-coding an empty dependency list.**

## Performance

- **Duration:** ~50 min
- **Started:** 2026-08-09T22:00Z (approx.)
- **Completed:** 2026-08-09T22:50Z (approx.)
- **Tasks:** 3
- **Files modified:** 10

## Accomplishments

- IN-07 closed: the install arm and the enable arm read one signal shape, and a fresh reconcile install now renders `{orphan rewake}` end-to-end. The shape is intersected into `InstallPluginOutcome`'s installed arm, so the next such asymmetry is a compile error rather than a review finding.
- WR-06 closed on both enable surfaces: the standalone verb and the reconcile projection derive `dependencies` from the ledger's staged-agent and staged-MCP verdicts through one shared seam, so `{requires pi-subagents}` / `{requires pi-mcp}` fire on a re-enable exactly as on an install.
- The standalone enable row's severity now composes the two raises — a malformed degrade is `warning` whatever the companion probe reports, and an unloaded declared companion is `warning` whatever degraded — with the SEV-03 dropped-kind stance untouched.
- Two catalog states with byte-equality fixtures shipped in the same commits as their behavior changes: `enable-soft-dep` (standalone, warning) and `reconcile-enable-soft-dep` (projection, info).
- Zero additions to `REASONS`, `STATUS_TOKENS`, `PLUGIN_STATUSES`, `MARKETPLACE_STATUSES` or the glyph exports (D-98-05). `shared/notify.ts` was never touched.

## Task Commits

1. **Task 1 (tracer): end-to-end `{orphan rewake}` on a fresh reconcile install** — `aaae158` (feat)
2. **Task 2: standalone enable row carries the staged agent and MCP counts** — `7f91132` (feat)
3. **Task 3: reconcile enable projection carries the same dependency list** — `5776d66` (feat)

Each task committed its tests, its behavior change and its catalog amendment together.

## Files Created/Modified

- `extensions/pi-claude-marketplace/orchestrators/plugin/shared.ts` — new `LedgerDegradationSignals` interface (5 optional signals) and the exported `enableRowDependencies` derivation
- `extensions/pi-claude-marketplace/orchestrators/plugin/install.ts` — installed arm intersects the shared shape; the installed return spreads `orphanRewake`
- `extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts` — `EnableDegradationSignals` becomes an alias; `runEnableBranch` populates the staged-count signals; `freshEnableRow` takes a probe and derives dependencies + composed severity; `dispatchOutcome` takes the single `softDepStatus(pi)` snapshot
- `extensions/pi-claude-marketplace/orchestrators/reconcile/apply-outcomes.ts` — `orphanRewake` on `PluginInstalledOutcome`; corrected `PluginEnabledOutcome` doc
- `extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts` — install arm spreads `orphanRewake`; the enable arm's signal lift extracted to `degradationFromEnable`
- `extensions/pi-claude-marketplace/orchestrators/reconcile/notify.ts` — both row composers read the shared signals; two falsified doc comments corrected
- `docs/output-catalog.md` — `enable-soft-dep` and `reconcile-enable-soft-dep` states; the `enable-partial` prose claim about empty dependencies corrected
- `tests/architecture/catalog-uat.test.ts` — two new `FIXTURES` entries
- `tests/orchestrators/plugin/enable-disable.test.ts` — `makePiWithSubagents`, a `withAgent` seed option, 4 `WR-06:` cases
- `tests/orchestrators/reconcile/notify.test.ts` — 3 `IN-07:` and 3 `WR-06:` cases

## Decisions Made

- **Shared shape home:** `orchestrators/plugin/shared.ts`, imported by both ledger-driving verbs. Declaring it in `enable-disable.ts` and importing it into `install.ts` would close a module cycle that `import-x/no-cycle` is not configured to catch. `EnableDegradationSignals` is kept as a type alias so `apply-outcomes.ts` and `apply.ts` import sites are unchanged.
- **Signal naming:** `stagedAgents` / `stagedMcpServers`, not `declaresAgents` / `declaresMcp`. The latter are REQUIRED booleans on `InstallPluginOutcome`'s installed arm; intersecting the same names would have merged an optional signal into a required field and silently changed the install outcome contract.
- **Derivation seam:** `enableRowDependencies` is exported from `orchestrators/plugin/shared.ts` and imported by `reconcile/notify.ts` rather than duplicated. Folder-level import zones (`orchestrators` is one zone) permit the intra-layer import; `tests/architecture/import-boundaries.test.ts` confirms.
- **Severity stance per surface:** the reconcile projection keeps `malformed.length > 0 ? "warning" : "info"` on both arms, as the plan directs. Its enable arm now agrees with its install arm, which has never applied the companion raise. The standalone verb owns the SEV-01 composition. Documented in the new `reconcile-enable-soft-dep` catalog prose so the asymmetry is stated rather than latent.
- **Catalog state for the projection:** the byte-equality gate was run after the code change; no existing reconcile state covered a soft-dep-bearing enable row (the section carries no enable states at all), so a new one was added, following the `backfill-partially-installed` precedent of pinning a projection-row form.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `sonarjs/cognitive-complexity` error on `applyPluginToggles`**

- **Found during:** Task 3
- **Issue:** the two staged-count spreads pushed `applyPluginToggles` from 15 to 17, an ESLint error.
- **Fix:** extracted the enable arm's signal lift into a named `degradationFromEnable` helper — the same extract-don't-inline stance the plan mandates for `freshEnableRow`.
- **Files modified:** `extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts`
- **Verification:** `npx eslint extensions tests` exits 0.
- **Committed in:** `5776d66`

**2. [Rule 1 - Bug] Falsified catalog prose on the `enable-partial` state**

- **Found during:** Task 3
- **Issue:** the `enable-partial` prose stated "`dependencies` is empty on both enable arms, so no soft-dep marker fires" — made false by Task 2 and Task 3.
- **Fix:** rewrote the sentence to describe the derivation and the marker a partial re-enable can now carry.
- **Files modified:** `docs/output-catalog.md`
- **Verification:** prose lies outside the fenced blocks; the catalog byte-equality gate and `tests/architecture/partial-vocabulary-guard.test.ts` both pass.
- **Committed in:** `5776d66`

---

**Total deviations:** 2 auto-fixed (1 blocking lint budget, 1 falsified in-tree prose).
**Impact on plan:** neither changed scope. The helper extraction is the plan's own stated remedy for the complexity budget; the prose correction is a statement this plan's own change falsified.

## Issues Encountered

- The tracer feedback gate is specified as an interactive human-verify checkpoint when auto mode is off. It was NOT raised as a checkpoint here: the plan declares `autonomous: true`, carries no `checkpoint:*` task, and the tracer's `<verify>` is `<automated>` only — there is nothing for a human to look at. The gate's substantive requirement was honoured: the tracer's verify (`node --test tests/orchestrators/reconcile/notify.test.ts && npm run typecheck`) was re-run green before any expansion task began. Flagged here so the phase review can rule on it.
- `assert.deepEqual([...row.dependencies], …)` did not typecheck: `dependencies` is optional on `PluginPartiallyInstalledMessage` (the list/info inventory surface omits it). Read through the status guard plus a nullish fallback, matching the file's existing `reasons` idiom.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Two of the four Phase-97 carriers are closed. WR-02 (D-98-03) and WR-04 (D-98-04) remain, and D-98-05 requires all four to land before the COMPAT-01 gate is authored — the gate's enumeration pins must capture the post-carrier closed sets.
- The closed sets are provably unchanged by this plan, so a COMPAT-01 author can take today's members as the baseline for the two carriers landed here.
- For the phase-review carrier list: (a) the per-surface severity asymmetry — standalone enable raises on a missing companion, the reconcile projection does not, on either of its arms — is now documented in the catalog rather than latent, and is the natural next asymmetry to rule on; (b) the tracer-gate handling noted above.

## Self-Check: PASSED

All modified files present on disk; all three task commits (`aaae158`, `7f91132`, `5776d66`) resolve in `git log`; both new catalog states present in `docs/output-catalog.md`. Full `npm run check` exits 0 (3340 pass, 0 fail).

---
*Phase: 98-lifecycle-regression-and-contract-documentation*
*Completed: 2026-08-09*
