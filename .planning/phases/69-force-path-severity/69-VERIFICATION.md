---
phase: 69-force-path-severity
verified: 2026-06-28T00:00:00Z
status: passed
score: 5/5 must-haves verified (WR-01 decision resolved)
overrides_applied: 0
resolution:
  - item: "WR-01 SEV-01 companion warning on autoupdate cascade"
    decision: "Option B (document intentional omission)"
    rationale: "SEV-01 was scoped to the install + manual-update success arms; the autoupdate cascade was never a plan must-have. The autoupdate surface is a background operation whose actionable signal is a NEW degradation, already covered by the newlyDegraded warning. Any reconsideration is owned by the severity/output reconcile, not the producer-stamp wiring."
    evidence: "Auditable comment added in marketplace/update.ts outcomeToCascadePluginMessage (commit 65e03249). No output bytes change; closed-set 22/17/7 and catalog-uat remain green."
deferred:
  - truth: "Installing an `unavailable` (structural) plugin renders at error severity (SC#2 / SEV-02 second clause)"
    addressed_in: "Phase 70"
    evidence: "Per D-69-03 and locked CONTEXT.md decision: unavailable arm deliberately kept byte-frozen at info severity (no --force suggestion) for this phase; final severity reconcile against the catalog is owned by Phase 70 (Spec and Documentation Reconcile). The placeholder hint wording (FORCE_INSTALL_HINT_TRAILER) is also deferred to Phase 70 DOC-01..03."
human_verification:
  - test: "Decide whether SEV-01 missing-companion warning should apply to the marketplace autoupdate cascade force-installed path"
    expected: "One of: (a) thread softDepStatus(pi) probe and companionSeverity into outcomeToCascadePluginMessage in marketplace/update.ts so autoupdate-taken installs raise to warning when a companion is absent, OR (b) add an explicit comment in marketplace/update.ts recording that SEV-01 is deliberately not applied on the autoupdate surface (background operation; newlyDegraded warning already signals new degradation)"
    why_human: "Code review WR-01 identified this as 'looks like an omission rather than a deliberate suppression.' The PLAN scoped SEV-01 to install+update success (assumption A1) and did not include the autoupdate cascade path added in Plan 03. ROADMAP SC#1 wording ('an otherwise-successful install') is broad enough to include autoupdate-driven installs, so a human must decide whether the omission is intentional or a gap."
---

# Phase 69: Force-Path Severity Verification Report

**Phase Goal:** Force-path notifications carry the correct desired-state severities, wired onto the caller-stamped notification model delivered by the notification-refactor workstream.
**Verified:** 2026-06-28T00:00:00Z
**Status:** passed (WR-01 decision resolved post-verification)
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth (ROADMAP Success Criterion) | Status | Evidence |
|---|-----------------------------------|--------|----------|
| 1 | SC#1 (SEV-01): direct force degrade -> info; reinstall manual-recovery -> warning; missing companion on otherwise-successful install/update -> warning | VERIFIED (install + manual update surfaces); UNCERTAIN on autoupdate cascade | `install.ts:1420-1444` companionSeverity probe; `update.ts:1615-1659` same probe; `reinstall.ts:389` warning stamp; FORCE-04 and SEV-01 tests pass. Autoupdate cascade (`marketplace/update.ts` outcomeToCascadePluginMessage) does NOT call companionSeverity — see WR-01. |
| 2 | SC#2 (SEV-02): unsupported no-force install -> error + --force hint; unavailable structural install -> error, no hint | VERIFIED (unsupported arm); DEFERRED to Phase 70 (unavailable arm severity) | `errors.ts:411,416` forceable field; `resolver.ts:1099` `forceable: r.state === "unsupported"`; `install.ts:1525` `{ forceHint: true, severity: "error" }` iff forceable. Unavailable arm: no severity stamp -> defaults to info (byte-frozen per D-69-03, reconciled Phase 70). Catalog-uat passes: `failure-unsupported-features` expectedSeverity "error"; `failure-structural-unavailable` no expectedSeverity (info). |
| 3 | SC#3 (SEV-03): autoupdate cascade takes force path automatically; warning when newly degrades clean plugin; info when already degraded | VERIFIED | `update.ts:494-503` updateSinglePlugin sets `force: true`; `update.ts:1525-1534` newlyDegraded from prior `compatibility.unsupported`; `marketplace/update.ts:671` `severity: outcome.newlyDegraded === true ? "warning" : "info"`. FORCE-05 preserved: unavailable still skips. 46/46 marketplace/update tests pass; two catalog-uat autoupdate fixtures (info / warning). |
| 4 | SC#4 (SEV-04): targeted update declining force-upgradable -> warning; bulk/untargeted skip -> info | VERIFIED | `update.ts:273` cardinality; `update.ts:1578-1587` cascadeSkipSeverity; `update.ts:1692-1695` severity from cascadeSkipSeverity. SEV-04 test passes (bulk info; targeted warning). Catalog-uat fixtures set accordingly. |
| 5 | SC#5 (SEV-05): any row carries factual {reasons} brace whenever present, including installed / force-installed / force-upgradable | VERIFIED | Backfill: `apply-outcomes.ts:121` unsupported field (required); `apply.ts:1045` set from re-resolved state; `reconcile/notify.ts:526` `narrowUnsupportedKinds(outcome.unsupported)`. Install force-installed: `install.ts:1432` same seam. List force-upgradable: `list.ts:400,416` same seam. No new per-state mechanism (D-69-04). 27/27 reconcile/notify tests pass; two catalog-uat backfill fixtures. |

**Score:** 4.5/5 truths verified (SC#1 partially UNCERTAIN on autoupdate surface; SC#2 unavailable arm deferred; SC#3, SC#4, SC#5 fully VERIFIED)

### Deferred Items

Items not yet met but explicitly addressed in later milestone phases.

| # | Item | Addressed In | Evidence |
|---|------|-------------|----------|
| 1 | Unavailable arm renders at error severity (SC#2 second clause) | Phase 70 | Phase 70 goal: "Spec & Documentation Reconcile — PRD §11, output-catalog, messaging-style-guide reconciled to the final token set." D-69-03 / CONTEXT.md locked decision: structural arm byte-frozen for Phase 69; severity reconcile is the DOC pass. |
| 2 | Exact byte wording of the --force hint trailer (FORCE_INSTALL_HINT_TRAILER placeholder) | Phase 70 | `notify.ts:2164` doc comment: "Placeholder wording; the byte-exact form is frozen in the DOC reconcile (DOC-01..03)." |

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `extensions/pi-claude-marketplace/shared/errors.ts` | `forceable: boolean` on not-installable / no-longer-installable variants | VERIFIED | Lines 411, 416-423: both variants declare `readonly forceable: boolean` with SEV-02/D-69-03 anchor |
| `extensions/pi-claude-marketplace/domain/resolver.ts` | requireInstallable stamps forceable from r.state === "unsupported"; requireForceInstallable stamps false | VERIFIED | Lines 1096-1099, 1127-1130: correct stamps with comments |
| `extensions/pi-claude-marketplace/orchestrators/plugin/install.ts` | composeUnavailableMessage threads forceable; appends forceHint on unsupported arm; companionSeverity probe on success arms | VERIFIED | `composeUnavailableMessage` line 1515-1526; companionSeverity at 1420-1423; narrowUnsupportedKinds at 1432 |
| `extensions/pi-claude-marketplace/shared/notify-reasons.ts` | companionSeverity helper (SEV-01 classifier) | VERIFIED | Lines 61-79: `companionSeverity(declaresAgents, declaresMcp, probe)` exported |
| `extensions/pi-claude-marketplace/orchestrators/plugin/update.ts` | cascadeSkipSeverity with cardinality (SEV-04); companionSeverity on success arms (SEV-01); force: true in updateSinglePlugin (SEV-03); newlyDegraded in runThreePhaseUpdate | VERIFIED | Lines 273, 494-503, 1525-1534, 1568-1695 |
| `extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts` | outcomeToCascadePluginMessage: force-installed arm with newlyDegraded severity (SEV-03) | VERIFIED (SEV-03 only) | Lines 663-673: force-installed arm stamping warning/info from newlyDegraded. No SEV-01 companion probe — see WR-01 human verification item. |
| `extensions/pi-claude-marketplace/orchestrators/reconcile/apply-outcomes.ts` | PluginBackfilledOutcome.unsupported required field | VERIFIED | Lines 114-121: `readonly unsupported: readonly string[]` with SEV-05/D-69-04 comment |
| `extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts` | maybeBackfillPlugin sets unsupported from re-resolved state | VERIFIED | Line 1045: `resolved.state === "unsupported" ? resolved.unsupported : []` |
| `extensions/pi-claude-marketplace/orchestrators/reconcile/notify.ts` | plugin-backfilled force-installed arm uses narrowUnsupportedKinds(outcome.unsupported) | VERIFIED | Lines 43, 521-526: import + usage with SEV-05/D-69-04 anchor and SEV-03/A3 severity rationale comment |
| `extensions/pi-claude-marketplace/orchestrators/marketplace/update.messaging.ts` | force-installed arm in UPDATE_CONTEXT calling forceInstalledRow | VERIFIED | Added in Plan 03 (unplanned but required for autoupdate render pipeline) |
| `docs/output-catalog.md` | Lockstep catalog states for all byte-visible changes | VERIFIED | failure-unsupported-features (error+hint), failure-structural-unavailable (info, no hint), autoupdate-force-installed-already-degraded (info), autoupdate-force-installed-newly-degraded (warning), backfill-force-installed (brace), backfill-force-installed-no-reasons (brace-less) |
| `tests/architecture/catalog-uat.test.ts` | Matching fixtures for all catalog states | VERIFIED | Catalog-uat test 4/4 pass; byte-equality gate green |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `resolver.ts requireInstallable` | `errors.ts PluginShapeErrorShape.forceable` | throw carries three-way distinction | VERIFIED | `forceable: r.state === "unsupported"` at line 1099 |
| `install.ts classifyEntityShapeError` | composeUnavailableMessage (unsupported arm) | `entityErrorRow.forceable -> { forceHint: true, severity: "error" }` | VERIFIED | Line 1525: conditional spread on `forceable === true` |
| `install.ts success arm` | `notify-reasons.ts companionSeverity` | softDepStatus probe vs declared deps | VERIFIED | Lines 1420-1423: companionSeverity(staged agents/mcp, probe) |
| `update.ts cardinality` | `cascadeSkipSeverity` force-upgradable decline | "single" -> warning, "plural" -> info | VERIFIED | Lines 1578-1695: cascadeSkipSeverity(reasons, cardinality) |
| `update.ts updateSinglePlugin` | `requireForceInstallable` candidate gate | `force: true` in cascade entrypoint | VERIFIED | Line 503: `force: true` inside updateSinglePlugin |
| `update.ts runThreePhaseUpdate` | `PluginUpdateUpdatedOutcome.newlyDegraded` | prior `compatibility.unsupported` length | VERIFIED | Line 1534: `preflight.record.compatibility.unsupported.length === 0` |
| `marketplace/update.ts outcomeToCascadePluginMessage` | `marketplace/update.messaging.ts force-installed arm` | `forceInstalledRow` composition site | VERIFIED | UPDATE_CONTEXT force-installed arm calls forceInstalledRow |
| `reconcile/apply.ts maybeBackfillPlugin` | `PluginBackfilledOutcome.unsupported` | re-resolved unsupported kinds | VERIFIED | Line 1045: threaded onto outcome |
| `reconcile/notify.ts plugin-backfilled` | `probe-classifiers.ts narrowUnsupportedKinds` | `reasons: narrowUnsupportedKinds(outcome.unsupported)` | VERIFIED | Line 526: replaces prior `reasons: []` |
| `marketplace/update.ts outcomeToCascadePluginMessage` | `notify-reasons.ts companionSeverity` | SEV-01 companion probe | NOT WIRED (WR-01) | Function signature has no `pi`/`SoftDepStatus` param; `updated` arm hardcodes `severity: "info"`; `force-installed` arm only conditions on `newlyDegraded` |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Closed-set token counts 22/17/7 unchanged | `node --test tests/architecture/notify-closed-set-locks.test.ts` | 4/4 pass | PASS |
| Catalog byte-equality gate | `node --test tests/architecture/catalog-uat.test.ts` | 4/4 pass | PASS |
| Install tests (SEV-01, SEV-02, FORCE-04) | `node --test tests/orchestrators/plugin/install.test.ts` | 75/75 pass | PASS |
| Update tests (SEV-04, SEV-03, FORCE-04) | `node --test tests/orchestrators/plugin/update.test.ts` | 56/56 pass | PASS |
| Marketplace update tests (SEV-03 autoupdate) | `node --test tests/orchestrators/marketplace/update.test.ts` | 46/46 pass | PASS |
| Reconcile notify tests (SEV-05 backfill) | `node --test tests/orchestrators/reconcile/notify.test.ts` | 27/27 pass | PASS |

### Invariants Verified

| Invariant | Status | Evidence |
|-----------|--------|---------|
| `cascadeSeverity` / `computeSeverity` MAX-reduce model is READ-ONLY | VERIFIED | `notify.ts:2200-2268`: reduce logic unmodified. Only additions: `forceHint?: boolean` field on `PluginUnavailableMessage` (line 680); `FORCE_INSTALL_HINT_TRAILER` constant (line 2167); trailer render in `composePluginLinesWith` (render path only). The reduce arithmetic and the `SEVERITY_RANK` lookup are byte-identical to pre-Phase-69 form. |
| Closed-set token counts 22 / 17 / 7 (STATUS/PLUGIN/MARKETPLACE) | VERIFIED | Test `notify-closed-set-locks.test.ts` passes 4/4. Hint is a trailer line, not a new REASONS or STATUS token. |
| FORCE-05: unavailable / structural candidates blocked even on force path | VERIFIED | `requireForceInstallable` still rejects `unavailable` state; autoupdate cascade catch in `marketplace/update.ts` captures into `partition: "failed"`. Confirmed by FORCE-05 tests in `install.test.ts` and `update.test.ts`. |

### Requirements Coverage

| Requirement | Source Plans | Description | Status | Evidence |
|------------|-------------|-------------|--------|----------|
| SEV-01 | 69-02 | Force degrade -> info; reinstall -> warning; missing companion -> warning | VERIFIED (install+update surfaces) / UNCERTAIN (autoupdate) | companionSeverity in install.ts + update.ts; reinstall.ts warning stamp |
| SEV-02 | 69-01 | Unsupported -> error + --force hint; unavailable -> error, no hint | VERIFIED (unsupported arm); DEFERRED Phase 70 (unavailable severity) | forceable discriminant + composeUnavailableMessage |
| SEV-03 | 69-03, 69-04 | Autoupdate takes force; warning if newly degrades; info if already degraded | VERIFIED | updateSinglePlugin force:true; newlyDegraded; autoupdate renderer |
| SEV-04 | 69-02 | Targeted decline -> warning; bulk skip -> info | VERIFIED | cardinality + cascadeSkipSeverity |
| SEV-05 | 69-04 | Factual {reasons} brace on installed/force-installed/force-upgradable rows | VERIFIED | narrowUnsupportedKinds via shared seam on all three surfaces |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `shared/notify.ts` | 2164-2167 | Placeholder user-contract string (`FORCE_INSTALL_HINT_TRAILER`) ships now with a doc-comment marking it as placeholder | Info (IN-01) | Acceptable as staged work; the placeholder is functional, non-misleading, and Phase 70 reconciles the byte-exact wording. No TBD/FIXME/XXX markers present — the doc comment is a tracked deferral. |

No TBD, FIXME, or XXX markers found in Phase 69 modified files.

### Human Verification Required

#### 1. SEV-01 Companion Warning Coverage on Autoupdate Cascade (WR-01)

**Test:** Review `outcomeToCascadePluginMessage` in `extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts` (lines 632-730). Neither the `updated` arm nor the `force-installed` arm calls `companionSeverity` or `softDepStatus(pi)`. Decide whether this is intentional or an omission.

**Expected (option A — fix):** Thread the `softDepStatus(pi)` probe into `outcomeToCascadePluginMessage` as a third parameter and call `companionSeverity(outcome.declaresAgents, outcome.declaresMcp, probe)` on the success arms:
```ts
// updated arm:
severity: companionSeverity(outcome.declaresAgents, outcome.declaresMcp, probe),
// force-installed arm:
severity: maxSeverity(companionSeverity(outcome.declaresAgents, outcome.declaresMcp, probe),
                     outcome.newlyDegraded === true ? "warning" : "info"),
```

**Expected (option B — document intentional omission):** Add a comment in `outcomeToCascadePluginMessage` stating that SEV-01 is intentionally not applied on the autoupdate surface (rationale: autoupdate is a background operation; `newlyDegraded` already covers the actionable case; companion warning would be noise at this surface).

**Why human:** Code review WR-01 stated "this looks like an omission rather than a deliberate suppression." The PLAN scoped SEV-01 to install+update success arms (assumption A1) and did not name the autoupdate cascade. ROADMAP SC#1 ("an otherwise-successful install") is ambiguous enough to include autoupdate-driven installs. A human must decide whether the asymmetry is acceptable and, if so, add a comment so the asymmetry is auditable.

### Gaps Summary

No hard blocking gaps. The phase delivers all five SEV requirements with correct stamping, passing tests, and a green closed-set tripwire.

Two deferred items (SC#2 unavailable arm severity, placeholder hint wording) are explicitly owned by Phase 70 per the locked D-69-03 decision.

One human decision point (WR-01): the autoupdate cascade's `outcomeToCascadePluginMessage` does not apply the SEV-01 companion probe. The code reviewer flagged this as a Warning finding. The plan's scope (assumption A1) did not include the autoupdate surface, so it was not a plan must-have — but the ROADMAP SC#1 wording is broad enough that a human should confirm the omission is intentional or fix it.

**Resolution (post-verification):** Decided Option B — intentional omission, documented. SEV-01 deliberately targets the interactive install + manual-update success arms; the autoupdate surface's actionable signal is a new degradation, already covered by the `newlyDegraded` warning. An auditable comment was added at `outcomeToCascadePluginMessage` (commit `65e03249`). No output bytes change; the closed-set tripwire (22/17/7) and catalog-uat byte gate remain green. Any future change to this asymmetry is owned by the severity/output reconcile.

---

_Verified: 2026-06-28T00:00:00Z_
_Verifier: Claude (gsd-verifier)_
