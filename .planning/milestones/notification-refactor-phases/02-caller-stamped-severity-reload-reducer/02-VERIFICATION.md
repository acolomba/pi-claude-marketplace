---
phase: 02-caller-stamped-severity-reload-reducer
verified: 2026-06-24T22:30:00Z
status: passed
score: 5/5 must-haves verified
overrides_applied: 0
---

# Phase 2: Caller-Stamped Severity & Reload Reducer — Verification Report

**Phase Goal:** Correctness relocates from one audited reducer to the producers — every outcome row carries caller-stamped `severity` and `needsReload`, `notify()` reduces them with no content inference, and an architecture test gates the relocation.
**Verified:** 2026-06-24T22:30:00Z
**Status:** passed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Every outcome row carries caller-stamped `severity` + `needsReload`; `notify()` emits severity as numeric MAX and `/reload` trailer as OR-reduce of `needsReload` — no reason/status inference | VERIFIED | `cascadeSeverity()` reads only `mp.severity`/`p.severity` via `Math.max(rank, SEVERITY_RANK[...])`. `shouldEmitReloadHint()` reads only `mp.needsReload`/`p.needsReload` via `.some`-style loop. All ~20 producer files stamp both fields on every transition and non-success row. |
| 2 | `BENIGN_REASONS`, `allBenign`, the `cascadeSeverity` content ladder, and `shouldEmitReloadHint` status-token→reload mapping are removed; severity no longer reads `reasons` | VERIFIED | `grep -n "BENIGN_REASONS\|allBenign\|reconcileAppliedSeverity"` returns zero live code lines in `shared/notify.ts`. `cascadeSeverity` exists but is the rewritten MAX-over-`row.severity` reducer (not the old first-match ladder). `shouldEmitReloadHint` reads `row.needsReload`, not status tokens. `countRowsBySeverity` tallies by `row.severity`. No path reads `.reasons` for severity/reload decisions. |
| 3 | Two commands can stamp different severity for an identical `(status, reasons)` pair (SEV-05 structural capability); the tri-state desired-state contract (SEV-03) holds | VERIFIED | Structural capability established: every producer stamps `severity` independently per-row; the reducer reads only the stamped field. The actual divergent desired-state outputs (install-already→error, update-up-to-date→info) are correctly deferred to Phase 3 per D-02. SEV-03 tri-state contract documented at line 2091 in `shared/notify.ts`. |
| 4 | `present` plugin status collapsed into `installed` (reload via `needsReload:false`); `disable-cascade` cascade kind removed (disable stamps `needsReload:true` directly) | VERIFIED | `PLUGIN_STATUSES` has no `"present"` entry. `PluginPresentMessage` is deleted from the union. `list.ts` `installedRowMessage` stamps `status:"installed", severity:"info", needsReload:false`. `notifyWithContext` `kind?` param is `"cascade"` only. No `"disable-cascade"` in unions, switch arms, or call sites. `grep -rn` of both deleted symbols returns zero live code/fixture lines. |
| 5 | An architecture test asserts every cascade-producing orchestrator stamps both fields on state-change rows; `npm run check` and `catalog-uat` stay green | VERIFIED | `tests/architecture/notify-stamp-coverage.test.ts` exists, drives both `buildReconcileAppliedCascade` and `buildReconcilePendingNotification`, asserts `severity !== undefined` and `typeof needsReload === "boolean"` on every transition row, and asserts D-06 reload semantics. All 3 arch-test cases pass. `npm run check` exits 0 (typecheck + lint + format + 2327 unit tests + 16 integration tests, 0 failures). `docs/output-catalog.md` blob OID is `8f9724c31307e759277b69534918d28a860c54a4` — byte-identical, `git diff` empty. |

**Score:** 5/5 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `extensions/pi-claude-marketplace/shared/notify.ts` | `TransitionMessageBase` narrowing + dumb-reducer (MAX severity / OR needsReload / tally by stamped facts) | VERIFIED | `interface TransitionMessageBase extends MessageBase` at line 590 with `readonly severity` required and `readonly needsReload: boolean` required. `cascadeSeverity` is the MAX-over-`row.severity` reducer. `shouldEmitReloadHint` is the OR-reduce over `row.needsReload`. `countRowsBySeverity` tallies by stamped severity. |
| `extensions/pi-claude-marketplace/orchestrators/plugin/install.ts` | Install rows stamp `severity` + `needsReload` | VERIFIED | Success rows: `severity:"info", needsReload:true`. Failed rows: `severity:"error", needsReload:false`. Confirmed at lines 1366–1367, 1452–1453. |
| `extensions/pi-claude-marketplace/orchestrators/plugin/list.ts` | `installedRowMessage` returns `status:"installed"` with `needsReload:false` | VERIFIED | Lines 295, 302: `status:"installed"`, `needsReload:false`, `severity:"info"`, no `reasons` field (Pitfall-2 orphan-rewake suppression). |
| `tests/architecture/notify-stamp-coverage.test.ts` | D-05 runtime backstop driving both reconcile projections | VERIFIED | File exists, imports both `buildReconcileAppliedCascade` and `buildReconcilePendingNotification` (8 references, ≥2 required). 3 test cases. All pass. No `Phase 2`/`Wave ` references (count = 0). |
| `extensions/pi-claude-marketplace/shared/notify-context.ts` | `notifyWithContext` `kind?` narrowed to `"cascade"` only | VERIFIED | Line 142: `kind?: "cascade"` — `"disable-cascade"` is removed from the union. |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| Transition producer literals (install/uninstall/update/reinstall/enable-disable/reconcile) | `TransitionMessageBase` required fields | `MarketplaceRows<Msg>` call-site type check | VERIFIED | All 5 plugin transition arms extend `TransitionMessageBase`. `grep -n "extends TransitionMessageBase"` returns exactly 5 arms: `PluginInstalledMessage`, `PluginUpdatedMessage`, `PluginReinstalledMessage`, `PluginUninstalledMessage`, `PluginDisabledMessage`. A deliberate TS2741 probe was run during execution and confirmed. |
| `notify()` reducer | `row.severity` / `row.needsReload` | `Math.max`-based rank reduce + `.some`/loop over flattened mp+plugin rows | VERIFIED | `cascadeSeverity()`: `Math.max(rank, SEVERITY_RANK[mp.severity ?? "info"])` and `Math.max(rank, SEVERITY_RANK[p.severity ?? "info"])`. `shouldEmitReloadHint()`: `if (mp.needsReload === true) return true` / `if (p.needsReload === true) return true`. |
| `tests/architecture/notify-stamp-coverage.test.ts` | `buildReconcileAppliedCascade` / `buildReconcilePendingNotification` | Import + drive + walk rows | VERIFIED | Both projections imported and driven with representative `PerEntryOutcome[]` and `ReconcilePlan`. Assertion walks `msg.marketplaces[].plugins[]` for transition statuses. Passes on stamped projection; a deliberate strip of `needsReload` produced the expected row-level diagnostic. |

---

### Data-Flow Trace (Level 4)

Not applicable — this phase produces no dynamic-data-rendering UI components. The verification subject is the notification reducer and its producer pipeline, gated end-to-end by `catalog-uat` byte-equality.

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| `catalog-uat` byte-equality (D-01 invariant) | `node --test tests/architecture/catalog-uat.test.ts` | 4 pass, 0 fail | PASS |
| D-05 arch-test (GATE-01 dynamic backstop) | `node --test tests/architecture/notify-stamp-coverage.test.ts` | 3 pass, 0 fail | PASS |
| `notify-v2` full suite (134 tests) | `node --test tests/shared/notify-v2.test.ts` | 134 pass, 0 fail | PASS |
| `notify-inert-fields` (now asserting fields are LIVE) | `node --test tests/shared/notify-inert-fields.test.ts` | 2 pass, 0 fail | PASS |
| Full `npm run check` (typecheck + lint + format + tests) | `npm run check` | 0 failures across unit + integration suites | PASS |
| `docs/output-catalog.md` blob OID unchanged | `git hash-object docs/output-catalog.md` | `8f9724c31307e759277b69534918d28a860c54a4` | PASS |

---

### Probe Execution

No phase-declared probes. The `catalog-uat` byte-equality test serves as the functional probe and is run above.

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| SEV-01 | 02-01 | Every outcome row carries caller-stamped `severity` (absent defaults to `info`) | SATISFIED | All transition/non-success rows stamped per D-03 map. Non-transition rows keep `severity?` optional (defaults to `info` via `?? "info"` in reducer). |
| SEV-02 | 02-01 | `notify()` derives emission severity as numeric MAX over rows, no content/reason inference | SATISFIED | `cascadeSeverity()` uses `SEVERITY_RANK` + `Math.max`. No `.reasons` or `.status` reads in severity path. |
| SEV-03 | 02-01 | Desired-state tri-state contract documented: info=at-desired, warning=fell-short, error=could-not-carry-out | SATISFIED | Doc comment at `shared/notify.ts` line 2091–2098 anchored `SEV-03`. |
| SEV-04 | 02-01 | `BENIGN_REASONS`, `allBenign`, content-derived `cascadeSeverity` ladder removed; severity no longer reads `reasons` | SATISFIED | Zero live code references to `BENIGN_REASONS` or `allBenign`. `cascadeSeverity` rewritten as MAX reducer. `reconcileAppliedSeverity` deleted. |
| SEV-05 | 02-01 | Each command stamps severity from its own desired-vs-actual judgment, free to disagree with another command | SATISFIED | Structural capability established (no central inference). Divergent desired-state outputs deferred to Phase 3 per D-02 (not a gap). |
| RLD-01 | 02-01 | Every outcome row carries caller-stamped `needsReload` boolean | SATISFIED | All transition and non-success rows stamped per D-06 map. Non-transition rows keep `needsReload?` optional (defaults to `false`). |
| RLD-02 | 02-01 | `notify()` emits `/reload` trailer iff OR-reduce of `needsReload` is true | SATISFIED | `shouldEmitReloadHint()` uses loop with `if (p.needsReload === true) return true`. |
| RLD-03 | 02-01 | `shouldEmitReloadHint` status-token→reload mapping removed; reload not inferred from status tokens | SATISFIED | Old trigger loop deleted. `shouldEmitReloadHint` reads only `row.needsReload`. |
| RLD-04 | 02-02 | `present` plugin status collapsed into `installed`; reload suppression via `needsReload:false` | SATISFIED | `"present"` absent from `PLUGIN_STATUSES`. `PluginPresentMessage` deleted. `list.ts` emits `status:"installed", needsReload:false`. |
| RLD-05 | 02-02 | `disable-cascade` cascade kind removed; disable stamps `needsReload:true` on realized rows | SATISFIED | `"disable-cascade"` absent from unions, switch arms, `notifyWithContext` param, and all call sites. `enable-disable.ts` fresh-disable row stamps `needsReload:true`. |
| GATE-01 | 02-01, 02-03 | Architecture test asserts every cascade-producing orchestrator stamps both fields on state-change rows | SATISFIED | Type-level: `TransitionMessageBase` makes omission a TS2741 compile error. Runtime: `tests/architecture/notify-stamp-coverage.test.ts` drives both reconcile projections, 3/3 tests pass, negative proof confirmed. |

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `tests/shared/notify-v2.test.ts` | 2483 | Test title references `allBenign` as a historical comment explaining old behavior | Info | Not a live code call. The test body stamps `severity:"warning"` directly on the row fixture. Test passes. No implementation concern. |

No TBD, FIXME, XXX, or unresolved debt markers found in Phase 2 modified files.

---

### Human Verification Required

None. All must-haves are verifiable programmatically. The catalog-uat byte gate, the type-system TS2741 gate, and the runtime arch-test backstop together provide full mechanical coverage.

---

## Gaps Summary

None. All 5 observable truths are VERIFIED, all 11 requirements are SATISFIED, all behavioral spot-checks pass, and the output-catalog blob OID is byte-identical to the Phase 2 entry state.

**Note on SC#3 / SEV-05 output divergence:** The ROADMAP Phase 2 SC#3 names specific divergent desired-state severities (`install` of already-installed → `error`; `update` of up-to-date → `info`) as examples of what two commands *can* stamp differently. Per D-02 (documented in 02-CONTEXT.md), the *exercise* of these divergent output judgments is explicitly deferred to Phase 3 (landing atomically with the catalog supersession). Phase 2 establishes the *structural capability*: per-row caller-stamped severity with no central inference. The absence of the divergent output values is not a gap — it is the correct Phase 2 scope boundary.

---

_Verified: 2026-06-24T22:30:00Z_
_Verifier: Claude (gsd-verifier)_
