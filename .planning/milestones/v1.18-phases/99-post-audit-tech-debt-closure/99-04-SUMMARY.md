---
phase: 99-post-audit-tech-debt-closure
plan: 04
subsystem: notifications
tags: [update, degradation, notify, catalog]
status: complete

requires:
  - "99-01: staged-name arrays renamed on both outcome interfaces (lifts the TS2430 block)"
provides:
  - "PluginUpdateUpdatedOutcome carries the shared degradation signals by inheritance"
  - "updatedRowFromOutcome: the sole composer of the (updated) row"
  - "optional reasons on PluginUpdatedMessage, threaded on all three render surfaces"
  - "update-degraded-component catalog state + byte fixture"
affects:
  - "orchestrators/marketplace/update.ts (autoupdate cascade row composition)"
  - "shared/notify.ts (PluginUpdatedMessage shape, central renderer arm)"

tech-stack:
  added: []
  patterns:
    - "optional-spread on an outcome/message field so an unaffected row keeps the key ABSENT (NREG-01)"
    - "one row composer shared by every surface, with the caller's own severity policy passed in"

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/orchestrators/types.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/update.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/update.messaging.ts
    - extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts
    - extensions/pi-claude-marketplace/orchestrators/marketplace/update.messaging.ts
    - extensions/pi-claude-marketplace/shared/notify.ts
    - docs/output-catalog.md
    - docs/messaging-style-guide.md
    - tests/architecture/catalog-uat.test.ts
    - tests/orchestrators/plugin/update.test.ts
    - tests/orchestrators/marketplace/update.test.ts

decisions:
  - "The updated outcome INHERITS LedgerDegradationSignals directly. No Pick, no Omit -- 99-01's rename removed the collision that once forced one."
  - "The composer takes the caller's base severity rather than deriving it, so the manual cascade's SEV-01 companion raise and the autoupdate cascade's deliberate WR-01 silence both survive unchanged."
  - "The malformed-component raise is applied on BOTH surfaces, as an axis orthogonal to each surface's companion-absence policy."
  - "The trailing tally is untouched: the update count is taken by PARTITION, so a degraded update is still one update."

metrics:
  duration: ~50m
  completed: 2026-08-10

actuals:
  tokens: 21000
  tasks: 3
  commits: 5
---

# Phase 99 Plan 04: Update-Verb Degradation Signals Summary

An update that degrades a component now names the kind on the row that reports the transition, composed once and rendered on every surface, with the state documented and byte-pinned.

## What Was Built

`update` stages through the same skills and commands bridges as install, enable and reinstall. Those bridges return a degraded record when a source component's frontmatter will not parse, and the component is written in synthesized, non-model-invocable form rather than failing the ledger. Nothing in `update` read that record, so the row claimed a clean transition while `list` reported the record's real state one command later.

The signal now travels end to end: collected at the success-outcome site off both bridge handles, carried on the updated outcome, mapped to closed-set tokens by the existing reason helper, and rendered as a `{malformed skill}` / `{malformed command}` brace with the info to warning raise.

## Task Commits

| Task | Name | Commits |
| --- | --- | --- |
| 1 | Tracer: one malformed skill, end to end through the public verb | `2a899b44` (RED), `cb90762a` (GREEN) |
| 2 | Commands kind, cascade surface, falsified helper note | `89de53e5` (RED), `8cefa60b` (GREEN) |
| 3 | Catalog state, byte fixture, style-guide amendment | `e87c3c3d` |

## The Blocking Constraint

`PluginUpdateUpdatedOutcome extends PluginUpdateBase, LedgerDegradationSignals` — direct inheritance, verified at `orchestrators/types.ts:163`. No `Pick` and no `Omit` anywhere in the change. `npm run typecheck` exited 0 on the first run after the edit, confirming plan 99-01's rename of `stagedAgentNames` / `stagedMcpServerNames` had removed the TS2430 collision. The deliberate `Omit` at `install.ts:258` was not touched.

The precondition grep returned 4, not the 1 the checkpoint file predicted, because 99-01 renamed the arrays on BOTH outcome interfaces rather than only reinstall's. Any non-zero count confirms the rename; 4 was treated as a pass.

## Required Findings

### What the two central `case "updated":` arms compute

They belong to different message unions and only one needed the thread.

- `shared/notify.ts:1745` — `renderMpHeader`'s arm. It composes a MARKETPLACE header row (`● <name> [<scope>] (updated)`) from a `MarketplaceNotificationMessage`. It has no plugin, no version arrow and no reasons field to thread. Untouched, correctly.
- `shared/notify.ts:2237` — `renderPluginRow`'s arm. This is the plugin row, and it was passing `undefined` in the reasons position. Threaded.

Two arms under one label is precisely the shape that produced WR-09, so both were read before either was edited.

### The tally decision

Untouched, deliberately. The update verb's trailing tally is an override computed by PARTITION (`outcomes.filter(o => o.outcome.partition === "updated").length`), not by stamped severity, so a degraded update is still counted as one update. This differs from reinstall, whose tally is the default severity-based math and therefore reports a degraded reinstall as `1 warning`. The difference is in the tally mechanism each verb already had, not in anything this plan introduced. If the update tally should count by severity, the lever is the tally override and it is a separate call affecting every update row; it is recorded here rather than acted on.

### Closed sets

No enumeration was edited. `malformedReasonsForKinds` returns existing members of the closed reason set, already emitted by the install, enable, reinstall and backfill rows. `tests/architecture/compat-01-no-expansion.test.ts` passes UNCHANGED. No reason token, status token, glyph, install-record key or schema version was added. Catalog state count: +1.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] A THIRD render surface reached the `(updated)` row**

- **Found during:** Task 2, when the cascade byte assertion still failed after the composer was shared.
- **Issue:** The plan named two render surfaces — the central `renderPluginRow` arm and `orchestrators/plugin/update.messaging.ts`. A third exists: `orchestrators/marketplace/update.messaging.ts:69`, the autoupdate cascade's own render map, which dispatches that cascade's plugin child rows and also discarded the reasons. With it unthreaded the failure mode was exactly the one the plan's prohibition describes — the composer raised the severity (the `needs attention` summary line appeared) while the row still rendered without the brace.
- **Fix:** Threaded `p.reasons` into that map's `updated` arm.
- **Files modified:** `extensions/pi-claude-marketplace/orchestrators/marketplace/update.messaging.ts`
- **Commit:** `8cefa60b`

**2. [Rule 3 - Blocking] The shared composer needed a caller-supplied base severity**

- **Found during:** Task 2, routing the autoupdate cascade through the composer.
- **Issue:** The two surfaces apply different, deliberate success-severity policies. The manual cascade raises on an absent declared companion (SEV-01); the autoupdate cascade deliberately does NOT (WR-01 — a background operation must not warn about a companion the user is not present to install). A composer that derived severity itself would have silently changed one of them.
- **Fix:** `updatedRowFromOutcome(outcome, rowScope, baseSeverity)`. Each caller passes its own policy; the composer applies only the orthogonal malformed raise on top. The marketplace-update suite's existing rows did not move.
- **Files modified:** `extensions/pi-claude-marketplace/orchestrators/plugin/update.ts`, `extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts`
- **Commit:** `8cefa60b`

**3. [Rule 3 - Blocking] Composer placement required a new import edge**

- **Found during:** Task 2.
- **Issue:** The plan places the composer in `orchestrators/plugin/update.ts` and has the cascade import it, but `marketplace/update.ts` deliberately holds the plugin-update LEDGER behind an injected `pluginUpdate` seam and had no static import of that module.
- **Fix:** Imported the composer only, with a comment recording that the ledger stays behind the seam. `eslint` (including `import-x`'s cycle rule) passes, so no cycle was introduced.
- **Files modified:** `extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts`
- **Commit:** `8cefa60b`

### Non-deviations worth recording

- The plan predicted a project-scope fixture would pick up the runner's directory and advised user scope with a hermetic home. It did not: the existing `seedPathMarketplace` + `withHermeticHome` harness threads an explicit `cwd`, and the project-scope single-plugin fixtures render correctly. The established harness was used unchanged.
- Prettier reformatted `orchestrators/plugin/update.ts` during the Task 1 pre-commit run. The rewrite was cosmetic; the suite was re-run green before committing.

## Verification

| Gate | Result |
| --- | --- |
| `npm run typecheck` | exit 0 — the inheritance compiles with no Pick and no Omit |
| `node --test tests/orchestrators/plugin/update.test.ts` | 88/88 — degraded-skill, degraded-command, both-kinds-ordered and clean-row cases green |
| `node --test tests/orchestrators/marketplace/update.test.ts` | green — cascade-equals-standalone added, existing rows unmoved |
| `node --test tests/architecture/catalog-uat.test.ts` | green, both walk directions |
| `node --test tests/architecture/compat-01-no-expansion.test.ts` | green and UNCHANGED |
| `npm run lint` | exit 0 — no complexity finding at the success-outcome function |
| `PI_SUBAGENTS_ROOT=... npm run check` | exit 0 — 3394 unit (0 fail) + 18 integration (0 fail) |

Exit codes were read directly from redirected output files, never through a pipe.

## Known Stubs

None. Every surface that renders an `(updated)` row threads the reasons, and each is covered by a byte assertion.

## Threat Flags

None. No new network endpoint, auth path, file-access pattern or schema change. The reason brace names a component KIND only, never a path or file body (T-99-04-04), and the tokens come solely from the closed-set kind-to-reason helper (T-99-04-02).

## Self-Check: PASSED

- `.planning/phases/99-post-audit-tech-debt-closure/99-04-SUMMARY.md` — FOUND
- Commits `2a899b44`, `cb90762a`, `89de53e5`, `8cefa60b`, `e87c3c3d` — all FOUND in `git log`
- `PluginUpdateUpdatedOutcome extends PluginUpdateBase, LedgerDegradationSignals` — FOUND at `orchestrators/types.ts:163`
- `Pick<` / `Omit<` on that interface — NOT PRESENT
- `.planning/STATE.md` / `.planning/ROADMAP.md` — unmodified by this plan
