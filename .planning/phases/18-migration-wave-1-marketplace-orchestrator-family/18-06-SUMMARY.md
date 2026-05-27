---
phase: 18-migration-wave-1-marketplace-orchestrator-family
plan: 6
subsystem: lint-narrowing
tags: [eslint, msg-plugin, v2-grammar, snm-22, lint-config, phase-gate]

# Dependency graph
requires:
  - phase: 18-migration-wave-1-marketplace-orchestrator-family/18-02
    provides: marketplaceAdd migrated to V2 notify chokepoint
  - phase: 18-migration-wave-1-marketplace-orchestrator-family/18-03
    provides: marketplaceRemove migrated to V2 notify chokepoint
  - phase: 18-migration-wave-1-marketplace-orchestrator-family/18-04
    provides: marketplaceUpdate migrated to V2 notify chokepoint
  - phase: 18-migration-wave-1-marketplace-orchestrator-family/18-05
    provides: marketplaceAutoupdate + marketplaceList migrated to V2 notify chokepoint
provides:
  - eslint.config.js MSG-Block 1 (severity routing) narrowed via additive `ignores`
    entry exempting `orchestrators/marketplace/**`
  - eslint.config.js MSG-Block 1b (per-scope rendering MSG-GR-3) narrowed via the
    same additive `ignores` entry
  - End-to-end proof that all 4 Phase 18 Success Criteria are GREEN
  - Refreshed cause-chain documentation comment in
    `orchestrators/marketplace/shared.ts` (V2 notify path, not V1 `notifyError`)
affects:
  - phase-19 (plugin-family migration; extends the same `ignores` entry with
    `orchestrators/plugin/**`)
  - phase-20 (edge-family migration; extends `ignores` again with
    `orchestrators/edge/**`, removes MSG-Block 1b's `edge/handlers/**` entry)
  - phase-21 (V1 wrapper deletion; deletes the entire MSG-* plugin wiring)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Bounded MSG-* lint narrowing: keep `files:` glob stable, ADD an `ignores`
       entry per migrated family. Additive contract preserved through Phase 21."

key-files:
  created:
    - .planning/phases/18-migration-wave-1-marketplace-orchestrator-family/18-06-SUMMARY.md
  modified:
    - eslint.config.js
    - extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts

key-decisions:
  - "Followed D-18-07 literally: only MSG-Block 1 and MSG-Block 1b touched;
     all other MSG-Blocks (2, 3, 4a, 4b, 5, 6) untouched."
  - "Applied the optional Claude's Discretion comment refresh in
     `orchestrators/marketplace/shared.ts` (the V1 `notifyError` references in
     the Phase 13 / D-CMC-12 block comment are stale post-Wave 2; refreshed to
     describe the V2 `notify(ctx, severity, ...)` chokepoint and cross-link
     `shared/notify.ts` + 18-01-SUMMARY.md). Cosmetic change; zero behavior
     impact; zero callsite changes."

patterns-established:
  - "Phase 18 lint narrowing exit pattern: insert one
     `ignores: [\"extensions/pi-claude-marketplace/orchestrators/<family>/**\"],`
     line per MSG-Block that the migrated family now legitimately bypasses. The
     entry is additive; subsequent phases extend the same array. The MSG-Block
     1b `files:` array remains `[orchestrators/**, edge/handlers/**]` until
     Phase 20."

requirements-completed: []

# Metrics
duration: 5min
completed: 2026-05-27
---

# Phase 18 Plan 6: Marketplace Family Lint Narrowing + Phase-18 Verification Summary

**Additive `ignores` exempts `orchestrators/marketplace/**` from MSG-Block 1
(severity routing) and MSG-Block 1b (per-scope rendering); all 4 Phase-18
Success Criteria proven GREEN end-to-end.**

## Performance

- **Duration:** 5min (355s wall)
- **Started:** 2026-05-27T03:43:56Z
- **Completed:** 2026-05-27T03:49:51Z
- **Tasks:** 2
- **Files modified:** 2 (1 lint config, 1 comment-only refresh)

## Accomplishments

- Inserted the exact 2-line additive `ignores` entry per D-18-07 into
  `eslint.config.js` (MSG-Block 1 line 160; MSG-Block 1b line 185).
- Verified all 4 Phase-18 Success Criteria GREEN end-to-end (see Verification
  Matrix below).
- Refreshed the stale `notifyError`-era block comment in
  `orchestrators/marketplace/shared.ts` to describe the V2 `notify(ctx, ...)`
  chokepoint (Claude's Discretion option from CONTEXT D-18-07).

## Task Commits

Each task was committed atomically:

1. **Task 1: Add `ignores` to MSG-Block 1 + 1b; refresh marketplace/shared.ts
   comment** -- committed alongside Task 2 (single atomic commit -- the lint
   narrowing is meaningless without the SC verification proof that nothing else
   regressed).
2. **Task 2: End-to-end Phase 18 SC #1..#4 verification (read-only).** -- no new
   file changes; verification evidence captured in this SUMMARY.

**Plan metadata:** all four Phase-18 SC checks recorded inline below.

## Files Created/Modified

- `eslint.config.js` -- Added 2 lines (`ignores: ["extensions/pi-claude-marketplace/orchestrators/marketplace/**"],`)
  to MSG-Block 1 (line 160) and MSG-Block 1b (line 185). Zero deletions; other
  MSG-Blocks (2/3/4a/4b/5/6) untouched. Verified by `git diff --stat`:
  `1 file changed, 2 insertions(+)`.
- `extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts` --
  Comment-only refresh in the Phase 13 / D-CMC-12 block (lines 478-485). Old
  text referenced V1 `notifyError` callers; refreshed text references the V2
  `notify(ctx, "error", ...)` chokepoint and cross-links `shared/notify.ts` +
  18-01-SUMMARY.md. Zero code (non-comment) changes. `git diff --stat`:
  `7 insertions(+), 6 deletions(-)`.

## Verification Matrix -- Phase 18 Success Criteria

All 4 Phase-18 Success Criteria proven GREEN end-to-end at completion of
plan 18-06.

### SC #1: Zero V1 callers (`notifySuccess|notifyWarning|notifyError`) in marketplace family

**Command:**

```bash
grep -rE "notify(Success|Warning|Error)\(" extensions/pi-claude-marketplace/orchestrators/marketplace/ \
  | grep -vE ":\s*//"
```

**Result:** **0 callsite matches.** The strict callsite-only grep returns
nothing; the permissive grep (`notify(Success|Warning|Error)\(` without
comment exclusion) returns a single line at `remove.ts:254` which is a
prose comment (`// only the user-facing V1 \`notifyWarning("...")\``)
historicizing the V1 surface. The four broader `notifySuccess|notifyWarning|notifyError`
matches in `remove.ts` and `shared.ts` are all comments referencing V1 names
in prose form (none are CallExpressions).

**Status:** GREEN.

### SC #2: MSG-Block 1 + 1b `files:` globs narrowed via additive `ignores` entry

**Command:**

```bash
grep -c "extensions/pi-claude-marketplace/orchestrators/marketplace/\*\*" eslint.config.js
```

**Result:** **2** (lines 160 and 185 of `eslint.config.js`):

```
160:    ignores: ["extensions/pi-claude-marketplace/orchestrators/marketplace/**"],
185:    ignores: ["extensions/pi-claude-marketplace/orchestrators/marketplace/**"],
```

Numeric diff stat: `1 file changed, 2 insertions(+)` -- exactly the 2 lines
D-18-07 specified, zero deletions, no other MSG-Block touched. Config loads
cleanly under Node 22.22.2 (26 flat-config blocks, identical count to
pre-plan baseline).

**Status:** GREEN.

### SC #3: Catalog UAT byte-equality GREEN for every marketplace-family `(section, state)` fixture

**Command:**

```bash
node --test tests/architecture/catalog-uat.test.ts
```

**Result:** **exit code 0.** `tests 3 / pass 3 / fail 0 / cancelled 0 /
skipped 0 / todo 0`. The 30+ marketplace-family fixtures (list 1081-1108;
add 1113-1149; remove 1154-1184; update 1189-1233; autoupdate 1238-1292)
all produce byte-equal output through the real `notify()` chokepoint.

**Note on the plan's recipe:** the plan recommended
`node --test --import tsx tests/architecture/catalog-uat.test.ts`, but `tsx`
is no longer installed (and not in `package.json`) -- the project runs on
Node 22.22.2 which strips TypeScript types natively (the tech-stack table
already calls this out as a "reconsider" from V1). `npm run check` and the
manual rerun both use plain `node --test` with no `--import tsx` flag, and
both pass. The plan recipe is stale; the underlying SC contract is GREEN.

**Status:** GREEN.

### SC #4: `npm run check` GREEN; no out-of-scope orchestrator changes

**Command (a):**

```bash
npm run check
```

**Result (a):** **exit code 0.** Aggregates typecheck + ESLint + Prettier
+ `npm test`. Final tap report: `tests 1365 / pass 1363 / fail 0 /
cancelled 0 / skipped 0 / todo 2` (1293 test atoms across 90 suites).
Wall ~22.7s.

**Command (b):**

```bash
git diff --name-only f2e496a..HEAD -- \
  extensions/pi-claude-marketplace/orchestrators/plugin/ \
  extensions/pi-claude-marketplace/orchestrators/edge/ \
  extensions/pi-claude-marketplace/edge/handlers/plugin/ \
  extensions/pi-claude-marketplace/edge/handlers/edge/
```

(`f2e496a` is the Phase 18 base commit -- the worktree's spawn-time HEAD.)

**Result (b):** **empty output.** No plugin/edge orchestrator (or
corresponding edge-handler) files have changed in Phase 18 -- only the
marketplace family + the 2 lint-config lines + the 1 marketplace
shared.ts comment block.

Aggregated Phase 18 file delta (`git diff --name-only f2e496a..HEAD`):

- `eslint.config.js` (this plan + earlier wave 2 narrowing) -- verified
  +2 lines this plan, no deletions.
- `extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts`
  -- comment-only refresh this plan; Wave-2 plans rewrote behavior.
- Plus the Wave-1/Wave-2 marketplace orchestrator files
  (`list.ts`, `add.ts`, `remove.ts`, `update.ts`, `autoupdate.ts`)
  migrated by plans 18-01..05.

**Status:** GREEN.

## Decisions Made

- **D-18-07 followed literally**: only MSG-Block 1 and MSG-Block 1b touched.
  Other MSG-Blocks (2 = usage-error routing, 3 = console.warn discipline,
  4a/4b = composer chokepoints, 5 = renderer chokepoints, 6 = structural
  meta-assertions) all remain `files: ["extensions/pi-claude-marketplace/**/*.ts"]`
  (global) and were not modified. Marketplace orchestrators continue to be
  linted by Blocks 2..6 -- Phase 18 only exempts them from severity routing
  (Block 1) and per-scope rendering (Block 1b) since the V2 `notify()`
  chokepoint now owns both concerns.
- **Optional comment refresh applied** (Claude's Discretion option from CONTEXT
  D-18-07): the Phase 13 / D-CMC-12 block comment in
  `orchestrators/marketplace/shared.ts` lines 478-484 referenced V1 patterns
  (callers wrapping errors before passing to `notifyError`; `notifyError`
  appending the trailer "automatically") that no longer match reality after
  Wave 2. The refresh keeps the prose anchored to the V2 chokepoint at
  `shared/notify.ts` and cross-links 18-01-SUMMARY.md so the historical record
  is correct. Zero callsite changes; the file's exported helpers are unchanged.

## Deviations from Plan

**None -- plan executed exactly as written.**

The single point worth noting (kept here for completeness, not as a deviation):
the plan's SC #3 recipe (`node --test --import tsx tests/architecture/catalog-uat.test.ts`)
no longer matches the project's tooling. `tsx` was retired when Node 22.18+
landed (the Technology Stack table flags this as a "reconsider" already), and
`package.json`'s `test` script uses plain `node --test`. The SC contract
itself is GREEN; the recipe phrasing is the only stale element. Recorded
here so Phase-19's analogous "narrowing + verification" plan can drop the
`--import tsx` from its recipe without re-discovering this.

## Contribution to SNM-22

Phase 18 closes the **marketplace-family slice** of SNM-22 (catalog-aware
notify migration). Of the three V1-wrapper families:

| Family            | Migrated by | Status              |
|-------------------|-------------|---------------------|
| `marketplace/`    | Phase 18    | ✓ COMPLETE (this phase) |
| `plugin/`         | Phase 19    | Pending             |
| `edge/handlers/`  | Phase 20    | Pending             |

SNM-22 itself **fully closes in Phase 21**, when the V1 wrappers
(`notifySuccess` / `notifyWarning` / `notifyError`) are deleted alongside the
`presentation/*` composers they wrapped. Phase 18 is the first of the three
family migrations and proves the additive-`ignores` lint-narrowing pattern
that Phases 19 and 20 will replicate.

## Handoff to Phase 19

Phase 19 (plugin-family migration) inherits the **additive `ignores:` contract**
established here. The expected delta in Phase 19's analogous final-narrowing
plan:

**Today (post-18-06):**

```js
{
  files: ["extensions/pi-claude-marketplace/orchestrators/**/*.ts"],
  ignores: ["extensions/pi-claude-marketplace/orchestrators/marketplace/**"],
  plugins: { msg: msgPlugin },
  rules: { /* msg-sr-1..6 */ },
}
```

**After Phase 19's narrowing:**

```js
{
  files: ["extensions/pi-claude-marketplace/orchestrators/**/*.ts"],
  ignores: [
    "extensions/pi-claude-marketplace/orchestrators/marketplace/**",
    "extensions/pi-claude-marketplace/orchestrators/plugin/**",
  ],
  plugins: { msg: msgPlugin },
  rules: { /* msg-sr-1..6 */ },
}
```

The MSG-Block 1b `files:` array (currently `[orchestrators/**, edge/handlers/**]`)
remains untouched through Phase 19 -- Phase 20 owns the removal of the
`edge/handlers/**` entry (plus the third `ignores:` extension covering
`orchestrators/edge/**`).

## Tests Not Requiring Migration

Per the Phase-18 RESEARCH "Cascade + Shared Test Landmines" section, the
following tests required **NO** migration during the entire phase (their
assertions speak to wrapper *interfaces*, not V1 vs V2 internals, and the
real `notify()` chokepoint surfaces the same shape):

- `tests/orchestrators/marketplace/cascade.test.ts` -- cascade ordering tests
  on the V1 wrappers; the chokepoint produces identical TAP shape under V2.
- `tests/shared/notify.test.ts` (and adjacent shared/* tests) -- exercise the
  chokepoint contract itself; needed no changes when the marketplace
  orchestrators flipped their callsite from `notifyWarning(...)` to
  `notify(ctx, "warning", ...)`.

Confirmation: `npm run check` (SC #4 above) includes all of these and remains
GREEN with the lint narrowing applied.

## Issues Encountered

**None.** The 2-line lint edit applied cleanly. The catalog UAT TAP run
initially failed with `ERR_MODULE_NOT_FOUND: tsx` -- that was a stale plan
recipe (the project runs Node 22.22.2 native TS strip and no longer ships
`tsx`); re-running with `node --test` (no `--import tsx`) returned exit 0
on the first attempt.

## Next Phase Readiness

- Phase 18 deliverables complete.
- Phase 19 (plugin-family migration) can begin: extends the additive
  `ignores:` entry in MSG-Block 1 + 1b with `orchestrators/plugin/**`.
- The `presentation/*` composers V1 wrappers depend on remain in place
  (still consumed by plugin/ and edge/handlers/); Phase 21 deletes them
  together.

---
*Phase: 18-migration-wave-1-marketplace-orchestrator-family*
*Plan: 06*
*Completed: 2026-05-27*

## Self-Check: PASSED

- File `eslint.config.js` exists and has both `ignores` lines (160, 185): FOUND
- File `extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts`
  refresh persisted: FOUND
- This SUMMARY (`18-06-SUMMARY.md`) exists at the expected phase directory:
  FOUND (will be confirmed by the atomic commit below)
- All 4 SC commands re-runnable from this SUMMARY: each command + exit code
  + output snippet captured inline above.
