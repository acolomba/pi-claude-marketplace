---
phase: 109-shared-contracts
plan: 14
subsystem: shared-notifications
tags: [typescript, node-test, exact-bytes, coverage, consolidation]
dependency_graph:
  requires: [109-03, 109-04, 109-12, 109-13]
  provides: [canonical-notify-owner, phase-109-coverage-gate]
  affects: [shared-notification-contracts]
tech_stack:
  added: []
  patterns: [paired-source-owner, literal-byte-contracts, case-owned-node-mocks]
key_files:
  created:
    - tests/shared/notify.test.ts
  modified: []
  deleted:
    - tests/shared/notify-context-dispatch-guard.test.ts
    - tests/shared/notify-disabled-reasons.test.ts
    - tests/shared/notify-inert-fields.test.ts
    - tests/shared/notify-not-installed-reasons.test.ts
    - tests/shared/notify-v2.test.ts
    - tests/shared/snm37-behavioral-smoke.test.ts
    - tests/shared/snm38-indent-ladder.test.ts
decisions:
  - "Keep extensions/pi-claude-marketplace/shared/notify.ts byte-identical; close defensive runtime branches through public inputs."
  - "Assign dispatch-only evidence to P109-12 and hook type evidence to P109-03 while retaining central rendered-byte contracts in P109-14."
  - "Preserve all three unrelated shared legacy suites unchanged."
metrics:
  duration: 40m
  completed: 2026-08-29
  tasks: 3
  files: 9
status: complete
actuals:
  tokens: 71309
  tasks: 3
  commits: 4
---

# Phase 109 Plan 14: Canonical Notification Contract Summary

A canonical exact-byte owner now covers the complete public notification grammar and effects at 100% direct line, branch, and function coverage, with all 174 legacy cases reconciled before exactly seven suites were removed.

## Performance

- Duration: 40 minutes
- Started: 2026-08-29T21:13:09Z
- Completed: 2026-08-29T21:52:56Z
- Realized diff: 285,234 characters / 4 = 71,309 estimate-scale tokens
- Tasks: 3
- Plan commits: 4 including this summary commit

## Accomplishments

- Added `tests/shared/notify.test.ts` as the paired canonical owner for `shared/notify.ts`.
- Preserved closed constants, glyphs, token helpers, row helpers, entry points, severity, tally, reload, ordering, wrapping, indentation, cause, redaction, info, cascade, and reconciliation bytes through independent literal expectations.
- Normalized all 207 source-level runtime cases to exact lowercase phases: 207 `// arrange`, 197 `// act` plus 10 `// act & assert`, and 197 `// assert`.
- Reconciled exactly 174 legacy cases into P109-03, P109-12, and P109-14 with no unclassified row.
- Deleted exactly the seven authorized suites while preserving `device-flow-prompt.test.ts`, `index-smoke.test.ts`, and `plugin-path.test.ts` unchanged.
- Kept `extensions/pi-claude-marketplace/shared/notify.ts` byte-identical at SHA-256 `5f5f932bea5f652a0a2d2bd8ac68d2ff61a0a758d7fa9f04ea401c3e3f90162a`.

## Caller Trace and Contract

| Caller family | Entry point | Pinned caller-facing contract |
| --- | --- | --- |
| Edge router and marketplace/plugin handlers | `notifyUsageError` | Exactly `message + "\n\n" + usage`, one callback, `error` severity. |
| Marketplace and plugin orchestrators | `notify` | One structured notification; exact marketplace/plugin rows, summaries, tallies, cause/rollback indentation, and reload trailer placement. |
| Command-scoped messaging adapters | `emitContextCascade`, `emitUpdateNoOpCascade`, `emitReconcileAppliedContextCascade` | Caller render-map row bytes fold into the same header, summary, tally, hint, and single-callback seam. |
| Marketplace/plugin list and info orchestrators | `notify` standalone and cascade discriminants | Read-only info variants suppress reload, preserve source/component fields, and join blocks with exact blank-line structure. |
| Reconcile pending/apply and diagnostic paths | `notify`, `notifyDiagnostic` | Exact zero-action advisory, applied-cascade grammar, basename-only disclosure boundary, and warning blocks. |
| Hook async-rewake and settle paths | `notifyAsyncRewakeSummary`, `notifyStopHookOverrideCap` | Empty summaries are silent; non-empty summaries and fixed cap warnings retain exact severity and text. |
| Index and auth-host raw callback consumers | `makeRawNotifyFn` | Omitted severity produces a one-argument callback; explicit severity is forwarded as the second argument. |

## Task Commits

| Task | Commit | Result |
| --- | --- | --- |
| 1. Establish canonical direct owner | `a05c151b` | Created the paired owner and closed the full direct surface. |
| 2. Complete exact-byte matrix and ledger | `76227607` | Added the remaining distinct disabled, candidate-reason, info-reason, and inert-label contracts. |
| 3. Delete absorbed suites and run Phase 109 gate | `dbec3199` | Deleted exactly seven reconciled suites after destination evidence passed. |
| Summary and execution record | committed separately | This file. |

## Legacy Case Ledger

Verified row count: **174**. Dispositions follow the plan vocabulary: `move`, `split`, or `duplicate`.

| # | Legacy file | Exact test title | Destination owner | Disposition |
| ---: | --- | --- | --- | --- |
| 1 | notify-context-dispatch-guard.test.ts | WR-02: dispatchRow renders a conspicuous fallback row (not a throw) when the render map has no arm for the row status | P109-12 | duplicate |
| 2 | notify-context-dispatch-guard.test.ts | WR-02: a FROZEN unknown-status row still emits gracefully (no throw escapes the seam) even though the severity floor write is rejected | P109-12 | duplicate |
| 3 | notify-context-dispatch-guard.test.ts | OUT-04/D-04: the optional kind + cardinality threads onto the envelope and renders the plural tally | P109-12 | duplicate |
| 4 | notify-disabled-reasons.test.ts | ENBL-16: the CENTRAL notify arm renders a stamped reason on the disabled row | P109-14 | move |
| 5 | notify-disabled-reasons.test.ts | ENBL-16: the LIST render map renders a stamped reason on the disabled row | P109-12 | split |
| 6 | notify-disabled-reasons.test.ts | ENBL-16: the DISABLE render map renders a stamped reason on the disabled row | P109-12 | split |
| 7 | notify-disabled-reasons.test.ts | ENBL-16: the RECONCILE-APPLIED render map renders a stamped reason on the disabled row | P109-12 | split |
| 8 | notify-inert-fields.test.ts | SEV-02: a stamped severity:"error" plugin row drives the emission to error severity (MAX reduce) | P109-14 | move |
| 9 | notify-inert-fields.test.ts | OUT-04 / D-04: a single-target (no cardinality) cascade carrying a label renders no tally (label inert without plural) | P109-14 | move |
| 10 | notify-inert-fields.test.ts | OUT-03 / D-04: a plural cascade renders the trailing tally under the operation label | P109-14 | move |
| 11 | notify-inert-fields.test.ts | OUT-03 / D-04: a plural all-success cascade still renders the success tally | P109-14 | move |
| 12 | notify-inert-fields.test.ts | SEV-02: status is INERT as a severity source -- the reducer reads only the stamped severity | P109-14 | move |
| 13 | notify-inert-fields.test.ts | RLD-02: a stamped needsReload:true row adds the /reload trailer via the OR-reduce | P109-14 | move |
| 14 | notify-not-installed-reasons.test.ts | OUT-02: the LIST render map renders a stamped reason on the `(available)` candidate row | P109-12 | split |
| 15 | notify-not-installed-reasons.test.ts | OUT-02 / OUT-05 / RSTA-01: the LIST render map renders a stamped reason on the unfetched `(remote)` row | P109-12 | split |
| 16 | notify-not-installed-reasons.test.ts | OUT-02: the CENTRAL row renderer drops a stamped reason on the `(available)` row | P109-14 | move |
| 17 | notify-not-installed-reasons.test.ts | OUT-05 / RSTA-01: the CENTRAL row renderer drops a stamped reason on the `(remote)` row | P109-14 | move |
| 18 | notify-not-installed-reasons.test.ts | DFEN-08: on the LIST map an absent reasons field and an empty reasons array render byte-identically on BOTH candidate arms | P109-12 | split |
| 19 | notify-not-installed-reasons.test.ts | OUT-03 / DFEN-08: the INFO plugin row renders a stamped reason, and an absent field and an empty array render byte-identically there too | P109-14 | split |
| 20 | notify-v2.test.ts | notify renders single installed plugin with empty deps under added marketplace (info severity + reload-hint) | P109-14 | move |
| 21 | notify-v2.test.ts | notify renders installed plugin with agents dep + probe unloaded (soft-dep marker emitted inside brace) | P109-14 | move |
| 22 | notify-v2.test.ts | notify renders updated plugin with version arrow + mcp dep marker | P109-14 | move |
| 23 | notify-v2.test.ts | notify renders reinstalled plugin with both deps loaded (no soft-dep marker, empty brace suppressed) | P109-14 | move |
| 24 | notify-v2.test.ts | notify renders uninstalled plugin (no dependencies field, ICON_AVAILABLE) | P109-14 | move |
| 25 | notify-v2.test.ts | notify renders available plugin (MSG-PL-6 carve-out: NO scope bracket ever, list-surface header) | P109-14 | move |
| 26 | notify-v2.test.ts | notify renders unavailable plugin with reasons (MSG-PL-6 carve-out: NO scope bracket) | P109-14 | move |
| 27 | notify-v2.test.ts | USTAT-01 / D-64-01: notify renders unsupported plugin with the ⊖ glyph (MSG-PL-6 carve-out: NO scope bracket) | P109-14 | move |
| 28 | notify-v2.test.ts | USTAT-01 / D-64-01: notify renders unsupported plugin with version and {lsp} brace | P109-14 | move |
| 29 | notify-v2.test.ts | XSURF-01: unsupported install-failure row with partialHint emits the --force install trailer | P109-14 | move |
| 30 | notify-v2.test.ts | XSURF-01: unsupported row WITHOUT partialHint stays byte-frozen (no trailer) | P109-14 | move |
| 31 | notify-v2.test.ts | XSURF-03: force-upgradable update-decline row with partialHint emits the --force update trailer | P109-14 | move |
| 32 | notify-v2.test.ts | XSURF-03: list-inventory force-upgradable row WITHOUT partialHint stays byte-frozen (no trailer) | P109-14 | move |
| 33 | notify-v2.test.ts | notify renders upgradable plugin with version and reasons brace | P109-14 | move |
| 34 | notify-v2.test.ts | FSTAT-02 / D-66-03: force-installed renders the ◉ glyph distinct from ● installed | P109-14 | move |
| 35 | notify-v2.test.ts | WR-03: force-installed success row threads dependencies -> soft-dep marker fires in the SAME brace as the dropped-component reason | P109-14 | move |
| 36 | notify-v2.test.ts | WR-03: force-installed INVENTORY row (no dependencies) renders no soft-dep marker even when a companion is unloaded | P109-14 | move |
| 37 | notify-v2.test.ts | FSTAT-04 / D-66-03: force-upgradable reuses the ● glyph like the upgradable arm | P109-14 | move |
| 38 | notify-v2.test.ts | FSTAT-06 / D-66-04: will-install force modifier renders (will partially install) | P109-14 | move |
| 39 | notify-v2.test.ts | FSTAT-06 / D-66-04: will-install WITHOUT the force modifier renders (will install) | P109-14 | move |
| 40 | notify-v2.test.ts | notify renders benign skipped plugin with up-to-date reason (info severity, UXG-02 / D-28-06) | P109-14 | move |
| 41 | notify-v2.test.ts | notify renders failed plugin with reasons only -- no cause, no rollback (error severity, NO reload-hint when mp.status=failed) | P109-14 | move |
| 42 | notify-v2.test.ts | notify renders added marketplace header alone (empty plugins -> header-only body, NO reload-hint per SNM-33/D-22-01) | P109-14 | move |
| 43 | notify-v2.test.ts | notify renders removed marketplace header alone (empty plugins -> header-only, NO reload-hint per SNM-33/D-22-01, G-MIL-02) | P109-14 | move |
| 44 | notify-v2.test.ts | notify renders updated marketplace header alone (empty plugins -> header-only, NO reload-hint per SNM-33/D-22-01, G-MIL-06) | P109-14 | move |
| 45 | notify-v2.test.ts | notify renders failed marketplace header alone (empty plugins -> NO reload-hint per D-16-12; no severity because no failed plugin) | P109-14 | move |
| 46 | notify-v2.test.ts | D-48-A: bare-(failed) add `failure-unreachable` form is byte-unchanged (reasons omitted -> brace collapses) | P109-14 | move |
| 47 | notify-v2.test.ts | D-48-A: bare-(failed) update `mp-failure-network` header is byte-unchanged (reasons omitted -> brace collapses) | P109-14 | move |
| 48 | notify-v2.test.ts | D-48-A: a reasons-omitted failed marketplace arm renders bare `(failed)` (the third bare form; arm byte-stable) | P109-14 | move |
| 49 | notify-v2.test.ts | notify renders autoupdate enabled marketplace header alone (UXG-04 <autoupdate> marker, info severity, NO reload-hint per SNM-33/D-22-01/D-22-03) | P109-14 | move |
| 50 | notify-v2.test.ts | notify renders autoupdate disabled marketplace header alone (UXG-04 <no autoupdate> off-marker, info severity, NO reload-hint per SNM-33/D-22-01/D-22-03) | P109-14 | move |
| 51 | notify-v2.test.ts | notify renders idempotent-enable marketplace header with <autoupdate> marker + reasons brace (UXG-04, info severity per UXG-02 / D-28-07, NO reload-hint per D-17.1-05) | P109-14 | move |
| 52 | notify-v2.test.ts | notify severity tier mp-skipped: idempotent-disable marketplace renders <no autoupdate> + brace, computes info (benign per UXG-02 / D-28-07) | P109-14 | move |
| 53 | notify-v2.test.ts | UXG-05: marketplace update no-op (mp.skipped + reasons:["up-to-date"], plugins:[]) renders `● <mp> [<scope>] (skipped) {up-to-date}`, computes info (benign per UXG-02 / D-28-07), emits NO /reload trailer | P109-14 | move |
| 54 | notify-v2.test.ts | UXG-05 (UAT Test-3 gap): autoupdate-ON no-op payload (mp.skipped + reasons:["up-to-date"], plugins:[]) renders byte-identically to the OFF no-op `● <mp> [<scope>] (skipped) {up-to-date}`, computes info (benign per UXG-02 / D-28-07), emits NO /reload trailer | P109-14 | move |
| 55 | notify-v2.test.ts | notify benign-only cascade: benign mp.skipped coexists with healthy plugin row -> computes info (UXG-02 / D-28-06/07) | P109-14 | move |
| 56 | notify-v2.test.ts | notify renders SUB-BRANCH B list-surface marketplace header with autoupdate token; lastUpdatedAt field persists but is not rendered (UXG-01) | P109-14 | move |
| 57 | notify-v2.test.ts | notify renders header-only block on empty plugins under added marketplace (NO reload-hint per SNM-33/D-22-01) | P109-14 | move |
| 58 | notify-v2.test.ts | RLD-04: list-shaped message with an installed inventory row (needsReload:false) emits NO /reload trailer (RLD-02 OR-reduce) | P109-14 | move |
| 59 | notify-v2.test.ts | RLD-02: cascade-shaped message with an installed transition row (needsReload:true) emits the /reload trailer | P109-14 | move |
| 60 | notify-v2.test.ts | PL-4: installed inventory row with description emits a 4-space-indented second line | P109-14 | move |
| 61 | notify-v2.test.ts | PL-4: upgradable row with description emits description line | P109-14 | move |
| 62 | notify-v2.test.ts | PL-4: available row with description emits description line | P109-14 | move |
| 63 | notify-v2.test.ts | PL-4: unavailable row with description emits description line | P109-14 | move |
| 64 | notify-v2.test.ts | PL-4 / CR-01: unsupported row with description emits description line | P109-14 | move |
| 65 | notify-v2.test.ts | PL-4: disabled inventory row with description emits description line | P109-14 | move |
| 66 | notify-v2.test.ts | PL-4: description absent -- no second line emitted | P109-14 | move |
| 67 | notify-v2.test.ts | PL-4: description exactly 66 chars -- emitted verbatim (no truncation) | P109-14 | move |
| 68 | notify-v2.test.ts | PL-4: description 67 chars -- truncated to 63 + '...' (column 66) | P109-14 | move |
| 69 | notify-v2.test.ts | PL-4: empty string description -- no second line emitted | P109-14 | move |
| 70 | notify-v2.test.ts | D-22-04 NEGATIVE: empty `marketplace add` ({status:'added', plugins:[]}) emits NO /reload trailer (SNM-33 / G-MIL-01) | P109-14 | move |
| 71 | notify-v2.test.ts | D-22-04 NEGATIVE: empty `marketplace remove` ({status:'removed', plugins:[]}) emits NO /reload trailer (SNM-33 / G-MIL-02) | P109-14 | move |
| 72 | notify-v2.test.ts | D-22-04 NEGATIVE: no-op `marketplace update` (all plugin rows skipped) emits NO /reload trailer (SNM-33 / G-MIL-06) | P109-14 | move |
| 73 | notify-v2.test.ts | D-22-04 POSITIVE: `marketplace remove` that uninstalled >=1 plugin emits the /reload trailer (SC#4) | P109-14 | move |
| 74 | notify-v2.test.ts | D-22-04 POSITIVE: `marketplace update` with >=1 changed plugin emits the /reload trailer (SC#4) | P109-14 | move |
| 75 | notify-v2.test.ts | notify renders (no marketplaces) sentinel for empty marketplaces array (no reload-hint, no severity) | P109-14 | move |
| 76 | notify-v2.test.ts | notify renders bare marketplace header when mp.status and mp.details are both undefined (no-crash, BLOCKER-3 coverage) | P109-14 | move |
| 77 | notify-v2.test.ts | notify renders single-plugin payload as 2-line body (header + 2-space indented row) | P109-14 | move |
| 78 | notify-v2.test.ts | notify preserves caller-supplied plugin order across multi-plugin payload (D-16-06: no internal sort) | P109-14 | move |
| 79 | notify-v2.test.ts | notify joins multi-marketplace blocks with single blank line and appends reload-hint at end (D-16-07) | P109-14 | move |
| 80 | notify-v2.test.ts | notify emits inline [scope] bracket on plugin row when p.scope set (orphan-fold PRESENT) | P109-14 | move |
| 81 | notify-v2.test.ts | notify omits scope bracket on plugin row when p.scope is undefined (non-orphan-fold, BLOCKER-1 coverage) | P109-14 | move |
| 82 | notify-v2.test.ts | notify omits scope bracket on installed plugin row when p.scope === mp.scope (D-17.2-07a) | P109-14 | move |
| 83 | notify-v2.test.ts | notify emits [project] bracket on installed plugin row when p.scope !== mp.scope (D-17.2-07b) | P109-14 | move |
| 84 | notify-v2.test.ts | notify omits scope bracket on updated plugin row when p.scope === mp.scope (D-17.2-07c) | P109-14 | move |
| 85 | notify-v2.test.ts | notify emits [project] bracket on failed plugin row when p.scope !== mp.scope (D-17.2-07d) | P109-14 | move |
| 86 | notify-v2.test.ts | notify renders rollbackPartial child rows at 4-space indent for failed plugin (no causes) | P109-14 | move |
| 87 | notify-v2.test.ts | notify renders nested cause chains: per-plugin at 4-space indent, per-phase rollback cause at 6-space indent (D-16-08) | P109-14 | move |
| 88 | notify-v2.test.ts | notify emits per-plugin cause-chain inline below each failed row (multi-cause cascade, D-16-08) | P109-14 | move |
| 89 | notify-v2.test.ts | notify severity tier info: installed plugin in added marketplace -> arguments length 1 (no severity arg) | P109-14 | move |
| 90 | notify-v2.test.ts | notify severity tier warning: single actionable skipped plugin -> arguments = [..., "warning"] | P109-14 | move |
| 91 | notify-v2.test.ts | notify severity tier error first-match: failed + skipped in same payload -> "error" (failed beats warning) | P109-14 | move |
| 92 | notify-v2.test.ts | notify suppresses reload-hint when payload contains only failed statuses (D-16-12 negative case) | P109-14 | move |
| 93 | notify-v2.test.ts | notifyUsageError emits ${msg.message}\n\n${msg.usage} with 'error' severity (SNM-13) | P109-14 | move |
| 94 | notify-v2.test.ts | notify renders manual recovery plugin with cause-chain trailer (warning severity, status literal includes the space) | P109-14 | move |
| 95 | notify-v2.test.ts | AS-7: manual recovery row names the leaked paths from ManualRecoveryError.leaks | P109-14 | move |
| 96 | notify-v2.test.ts | AS-7: manual recovery row with no leaks emits no leaked-paths child row | P109-14 | move |
| 97 | notify-v2.test.ts | notify renders single-version hash row as v#<7hex> via renderVersion chokepoint (SNM-35) | P109-14 | move |
| 98 | notify-v2.test.ts | D-77-01 / PURL-09 notify renders single-version sha row as v#<7hex> via renderVersion chokepoint | P109-14 | move |
| 99 | notify-v2.test.ts | notify renders update arrow with hash on both sides as v#<7hex> → v#<7hex> via composeVersionArrow (SNM-35) | P109-14 | move |
| 100 | notify-v2.test.ts | notify passes a SemVer version through unchanged -> v1.0.0 (non-hash pass-through guard, SNM-35) | P109-14 | move |
| 101 | notify-v2.test.ts | UXG-02 (D-28-03/06): actionable plugin skip ("not installed") computes warning | P109-14 | move |
| 102 | notify-v2.test.ts | UXG-02 (D-28-09): mixed cascade (benign skip + actionable skip) computes warning -- first-match poisoning | P109-14 | move |
| 103 | notify-v2.test.ts | UXG-02 (D-28-06): plugin skip with empty reasons:[] computes warning (allBenign guard on length) | P109-14 | move |
| 104 | notify-v2.test.ts | UXG-02 (D-28-08): mp-level skip with reasons OMITTED computes warning -- safe default | P109-14 | move |
| 105 | notify-v2.test.ts | UXG-07 (D-29-02/03): error -- single failed plugin under failed mp -> 'Some operations have failed.' summary prepended | P109-14 | move |
| 106 | notify-v2.test.ts | UXG-07 (D-29-03): error -- single failed plugin, non-failed mp -> 'A plugin operation has failed.' (single-type singular) | P109-14 | move |
| 107 | notify-v2.test.ts | UXG-07 (D-29-03): error -- two failed plugins, non-failed mp -> 'Some plugin operations have failed.' (single-type plural) | P109-14 | move |
| 108 | notify-v2.test.ts | UXG-07 (D-29-03): error -- failed mp only, no plugin rows -> 'A marketplace operation has failed.' (single-type marketplace) | P109-14 | move |
| 109 | notify-v2.test.ts | UXG-07 (D-29-03/04): warning -- single actionable-skip plugin -> 'A plugin operation needs attention.' | P109-14 | move |
| 110 | notify-v2.test.ts | UXG-07 (D-29-04): warning -- manual-recovery plugin counts as an actionable skip -> 'A plugin operation needs attention.' | P109-14 | move |
| 111 | notify-v2.test.ts | UXG-07 (D-29-03/04): warning -- two actionable-skip plugins + one actionable-skip mp -> mixed plural summary | P109-14 | move |
| 112 | notify-v2.test.ts | UXG-07 (D-29-02): info severity -- NO summary line prepended (byte-identical to prior info-severity behavior) | P109-14 | move |
| 113 | notify-v2.test.ts | UXG-07 (D-29-02): error -- summary prepended BEFORE cascade body AND reload-hint stays last | P109-14 | move |
| 114 | notify-v2.test.ts | UXG-07 (D-29-02): warning -- benign-only cascade routes to INFO so NO summary line is prepended | P109-14 | move |
| 115 | notify-v2.test.ts | wrapDescription: empty description omits the wrap block entirely | P109-14 | move |
| 116 | notify-v2.test.ts | wrapDescription: short description renders as a single 4-space-indented line | P109-14 | move |
| 117 | notify-v2.test.ts | wrapDescription: text fitting exactly 66 chars on a word boundary stays on one line | P109-14 | move |
| 118 | notify-v2.test.ts | wrapDescription: long description wraps at word boundary at 66-char text width | P109-14 | move |
| 119 | notify-v2.test.ts | wrapDescription: an over-length single word emits on its own line at indent with no ellipsis | P109-14 | move |
| 120 | notify-v2.test.ts | wrapDescription: whitespace collapsed (tabs, newlines, double spaces) into single-space-separated words | P109-14 | move |
| 121 | notify-v2.test.ts | WR-05 / wrapDescription: whitespace-only description reaches wrapDescription and returns no body lines | P109-14 | move |
| 122 | notify-v2.test.ts | WR-05 / wrapDescription: two words whose `current.length + 1 + word.length === wrapCol` stay on one line (boundary-equality) | P109-14 | move |
| 123 | notify-v2.test.ts | GRAM-01 / GRAM-02: standalone {not added} row renders the two-block summary + separate detail block (marketplace subject, error severity) | P109-14 | move |
| 124 | notify-v2.test.ts | GRAM-02: standalone failed plugin-info renders `A plugin operation has failed.` + separate multi-line detail block | P109-14 | move |
| 125 | notify-v2.test.ts | INFO-04: {not added} row never carries a reload-hint (read-only surface) | P109-14 | move |
| 126 | notify-v2.test.ts | INFO-01: renderMarketplaceInfo (github source + ref + lastUpdated + description) | P109-14 | move |
| 127 | notify-v2.test.ts | INFO-01: renderMarketplaceInfo (path source, no lastUpdated, no description) | P109-14 | move |
| 128 | notify-v2.test.ts | INFO-02 / INFO-05: renderPluginInfo (componentsResolved:true with sorted components + dependencies + wrapping description) | P109-14 | move |
| 129 | notify-v2.test.ts | INFO-05: renderPluginInfo (componentsResolved:false emits the `components: not resolved` marker) | P109-14 | move |
| 130 | notify-v2.test.ts | SURF-02 / D-63-06: HookSummaryEntry discriminator REQUIRES matcher for the untagged tool-event arm | P109-03 | duplicate |
| 131 | notify-v2.test.ts | SURF-02 / D-63-04: renderer emits multi-line `hooks:` block at 4-space header + 6-space per-entry indent (mixed tool/non-tool entries) | P109-14 | move |
| 132 | notify-v2.test.ts | SURF-02 / D-63-04: empty hooks ([]) emits NO `hooks:` header; non-hooks kinds still render their single-line comma-join | P109-14 | move |
| 133 | notify-v2.test.ts | SURF-02 / D-63-04: undefined hooks (field omitted) emits NO `hooks:` header; legacy 4-kind comma-join output is byte-stable | P109-14 | move |
| 134 | notify-v2.test.ts | SURF-02: lenient `HookSummaryEntry` arm renders `<event> (unsupported)` when supported=false, bare `<event>` when supported=true | P109-14 | move |
| 135 | notify-v2.test.ts | INFO-03: marketplace-info-cascade with a single block byte-equals the bare marketplace-info render | P109-14 | move |
| 136 | notify-v2.test.ts | INFO-03: marketplace-info-cascade with two blocks renders project-first then user, joined by one blank line | P109-14 | move |
| 137 | notify-v2.test.ts | INFO-03: marketplace-info-cascade severity is always info (no second arg) and no reload-hint | P109-14 | move |
| 138 | notify-v2.test.ts | INFO-03 + INFO-01: single-block fan-out (github source, all optional fields) byte form | P109-14 | move |
| 139 | notify-v2.test.ts | INFO-03 + INFO-01: single-block fan-out (path source, minimal) byte form omits last_updated and description | P109-14 | move |
| 140 | notify-v2.test.ts | INFO-02: plugin-info-cascade with a single block byte-equals the bare plugin-info render | P109-14 | move |
| 141 | notify-v2.test.ts | INFO-02 + INFO-03: plugin-info-cascade with two blocks renders project-first then user, joined by one blank line | P109-14 | move |
| 142 | notify-v2.test.ts | INFO-02: plugin-info-cascade severity is always info (no second arg) and no reload-hint | P109-14 | move |
| 143 | notify-v2.test.ts | INFO-02: plugin-info-cascade single block installed with resolved components + dependencies renders full INFO-02 happy path | P109-14 | move |
| 144 | notify-v2.test.ts | INFO-05: plugin-info-cascade single block components-not-resolved emits the marker line at col 4 | P109-14 | move |
| 145 | notify-v2.test.ts | Migration Strategy #2: cascade payload WITHOUT `kind` field byte-equals payload WITH `kind: "cascade"` | P109-14 | move |
| 146 | notify-v2.test.ts | WILL-01: marketplace add renders a bare header + will-install plugin child (orphan-fold suppresses [scope]) | P109-14 | move |
| 147 | notify-v2.test.ts | DIFF-02: will-uninstall plugin under existing (no-status) marketplace block | P109-14 | move |
| 148 | notify-v2.test.ts | DIFF-02: will-enable + will-disable rows under same marketplace | P109-14 | move |
| 149 | notify-v2.test.ts | DIFF-02: cross-scope orphan-fold -- plugin scope differs from marketplace scope -> [scope] bracket renders | P109-14 | move |
| 150 | notify-v2.test.ts | DIFF-02: will-* cascade emits NO /reload to pick up changes trailer (pending rows are pre-transition) | P109-14 | move |
| 151 | notify-v2.test.ts | DIFF-02: will-* cascade computes info severity (no second arg to ctx.ui.notify) | P109-14 | move |
| 152 | notify-v2.test.ts | D-54-01: (disabled) inventory row renders subject-first with version under list-arm marketplace (info severity, no /reload) | P109-14 | move |
| 153 | notify-v2.test.ts | D-54-01: (disabled) inventory row without version omits the v<version> slot cleanly | P109-14 | move |
| 154 | notify-v2.test.ts | D-54-01: (disabled) inventory row with orphan-fold scope bracket -- explicit p.scope differs from mp.scope | P109-14 | move |
| 155 | notify-v2.test.ts | D-54-01: (disabled) inventory row WITHOUT orphan-fold -- p.scope matches mp.scope -> no row bracket | P109-14 | move |
| 156 | notify-v2.test.ts | UAT-03 / RLD-05: a fresh (disabled) row stamping needsReload:true DOES emit the /reload trailer (realized transition; byte-identical row form) | P109-14 | move |
| 157 | notify-v2.test.ts | UAT-03 / RLD-05: a (disabled) inventory row stamping needsReload:false stays trailer-free (stamp drives the hint, not the row status) | P109-14 | move |
| 158 | notify-v2.test.ts | D-54-01 / ENBL idempotency: (skipped) {already enabled} row routes to info severity (benign reason) | P109-14 | move |
| 159 | notify-v2.test.ts | D-54-01 / ENBL idempotency: (skipped) {already disabled} row routes to info severity (benign reason) | P109-14 | move |
| 160 | notify-v2.test.ts | D-54-01: enable cascade (installed plugin row under added mp header) emits /reload trailer | P109-14 | move |
| 161 | notify-v2.test.ts | D-54-01: disable cascade (uninstalled plugin row under list-arm mp) emits /reload trailer | P109-14 | move |
| 162 | notify-v2.test.ts | RECON-04: success cascade -- mixed marketplace add + plugin install across both scopes, project-first ordering | P109-14 | move |
| 163 | notify-v2.test.ts | RECON-04: success cascade NEVER emits `/reload to pick up changes` trailer | P109-14 | move |
| 164 | notify-v2.test.ts | RECON-04: soft-fail per-entry -- failed mp row mixed with successful install row routes to error + summary prepended | P109-14 | move |
| 165 | notify-v2.test.ts | RECON-04: CFG-03 invalid-config row carries BASENAME only (T-55-02-01 information-disclosure mitigation) | P109-14 | move |
| 166 | notify-v2.test.ts | SURF-05 / D-63-08: REASONS tuple includes the literal 'orphan rewake' member | P109-14 | move |
| 167 | notify-v2.test.ts | SURF-05 / D-63-08: installed row renders `(installed) {orphan rewake}` via the existing reasons brace | P109-14 | move |
| 168 | notify-v2.test.ts | CLASS-01 / D-86-01: REASONS tuple carries 'malformed skill' and 'malformed command' immediately after 'malformed mcp' | P109-14 | move |
| 169 | notify-v2.test.ts | CLASS-01 / D-86-01: installed row renders `(installed) {malformed skill}` at warning severity | P109-14 | move |
| 170 | snm37-behavioral-smoke.test.ts | SNM-37 behavioral smoke :: list renders v1.4 byte forms at the pre-tui notify boundary | P109-14 | duplicate |
| 171 | snm38-indent-ladder.test.ts | SNM-38 :: marketplace header lines are at column 0 (0 leading spaces) | P109-14 | duplicate |
| 172 | snm38-indent-ladder.test.ts | SNM-38 :: plugin rows are at 2 leading spaces (D-16-04 / D-16-08) | P109-14 | duplicate |
| 173 | snm38-indent-ladder.test.ts | SNM-38 :: per-plugin cause-chain trailer is at 4 leading spaces (D-16-08) | P109-14 | duplicate |
| 174 | snm38-indent-ladder.test.ts | SNM-38 :: full ladder snapshot matches the catalog 0/2(/4) ladder (D-25-09 byte evidence) | P109-14 | duplicate |

## Exact Deletion Proof

The deletion commit contains these seven paths and no other deletion:

1. `tests/shared/notify-context-dispatch-guard.test.ts`
2. `tests/shared/notify-disabled-reasons.test.ts`
3. `tests/shared/notify-inert-fields.test.ts`
4. `tests/shared/notify-not-installed-reasons.test.ts`
5. `tests/shared/notify-v2.test.ts`
6. `tests/shared/snm37-behavioral-smoke.test.ts`
7. `tests/shared/snm38-indent-ladder.test.ts`

Protected unrelated suites were verified present and unchanged from the accepted base:

- `tests/shared/device-flow-prompt.test.ts`
- `tests/shared/index-smoke.test.ts`
- `tests/shared/plugin-path.test.ts`

## Phase 109 Direct Coverage Gate

All nineteen commands ran as separate `npm run test:coverage:direct -- <source>` processes in the required order.

| # | Source | Branches | Functions | Lines | Result |
| ---: | --- | ---: | ---: | ---: | --- |
| 1 | atomic-json.ts | 2/2 | 1/1 | 31/31 | 100% |
| 2 | completion-cache.ts | 55/55 | 13/13 | 439/439 | 100% |
| 3 | concerns/hooks.ts | 15/15 | 1/1 | 128/128 | 100% |
| 4 | concerns/soft-dep.ts | 6/6 | 1/1 | 60/60 | 100% |
| 5 | debug-log.ts | 3/3 | 1/1 | 26/26 | 100% |
| 6 | errors-bridges.ts | 11/11 | 10/10 | 122/122 | 100% |
| 7 | errors.ts | 98/98 | 42/42 | 618/618 | 100% |
| 8 | extension-version.ts | 1/1 | 0/0 | 16/16 | 100% |
| 9 | fs-utils.ts | 49/49 | 7/7 | 313/313 | 100% |
| 10 | git-failure-classifiers.ts | 19/19 | 1/1 | 62/62 | 100% |
| 11 | markers.ts | 1/1 | 0/0 | 24/24 | 100% |
| 12 | notify-context.ts | 18/18 | 9/9 | 338/338 | 100% |
| 13 | notify-reasons.ts | 18/18 | 6/6 | 257/257 | 100% |
| 14 | notify.ts | 382/382 | 83/83 | 4135/4135 | 100% |
| 15 | path-safety.ts | 28/28 | 8/8 | 147/147 | 100% |
| 16 | probe-classifiers.ts | 35/35 | 5/5 | 217/217 | 100% |
| 17 | session-env.ts | 9/9 | 5/5 | 127/127 | 100% |
| 18 | types.ts | 1/1 | 0/0 | 19/19 | 100% |
| 19 | vars.ts | 5/5 | 3/3 | 73/73 | 100% |

## Verification

| Check | Result |
| --- | --- |
| `node --test tests/shared/notify.test.ts` | Passed |
| notify direct coverage | Passed: 382/382 branches, 83/83 functions, 4135/4135 lines |
| `npm run typecheck` | Passed |
| Pair-local ESLint | Passed |
| Pair-local Prettier | Passed |
| `git diff --check` | Passed with the repository's LFS filter disabled for the read-only worktree metadata path |
| Production notify diff | Empty; SHA-256 unchanged |
| Nineteen focused coverage commands | Passed at 100% / 100% / 100% |
| Format check | Passed repository-wide |
| Unit tests | 222/224 passed in sandbox; the two Unix-socket suites then passed outside sandbox (42/42 and 147/147) |
| Integration tests | Passed: 10/10 files |
| `npm run check` | Stopped on pre-existing out-of-scope lint errors; details below |

## ASVS L1 and Threat Review

- Absolute POSIX, Windows-drive, and extended UNC inputs are redacted to basenames.
- Single-segment JSON pointers remain intact.
- Diagnostic, cause-chain, rollback, and manual-recovery output bytes are pinned.
- Reconcile invalid-config output remains basename-only.
- No endpoint, authentication path, file-access behavior, schema, dependency, production symbol, or coverage exemption changed.
- T-109-14 high-severity information-disclosure mitigation is covered and green.

## Deviations from Plan

### Scope-bound aggregate check blockers

The plan-owned pair is green, but `npm run check` cannot report success on the accepted base:

1. Repository ESLint reports ten pre-existing errors in `tests/domain/name.test.ts`, `tests/domain/source.test.ts`, and `tests/shared/path-safety.test.ts`. All three paths are unchanged from base `071793c5`; their latest commits are `c4ac4b32` and `b81f9393`.
2. The independently run fallow gate reports one pre-existing stale suppression in `extensions/pi-claude-marketplace/shared/notify-reasons.ts:256`, outside this plan's declared ownership.
3. Two unit suites initially failed with sandbox `listen EPERM` on local Unix sockets. They were rerun with appropriate permission and passed completely; no test was changed.

Per the execution scope boundary and the parent assignment, these unrelated files were not modified.

## Known Stubs

None. The intentional empty-description input is an asserted boundary case, not a production or UI stub.

## Decisions Made

- No architectural or public-surface decision was introduced.
- Defensive exhaustiveness arms were covered through runtime-invalid inputs and case-owned mutable discriminants instead of production coverage exemptions.
- The one `ManualRecoveryError` fixture import is input construction for the paired renderer's public cause/leak byte contract; all rendering behavior under test comes from `notify.ts`.

## Self-Check: PASSED

- Canonical owner exists.
- All seven expected legacy suites are absent.
- All three protected legacy suites exist and are unchanged.
- Production `notify.ts` hash matches before and after.
- Commits `a05c151b`, `76227607`, and `dbec3199` exist.
- Ledger contains exactly 174 rows.
- No generated or untracked project file remains.
