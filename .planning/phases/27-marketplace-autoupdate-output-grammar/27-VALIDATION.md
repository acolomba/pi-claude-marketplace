---
phase: 27
slug: marketplace-autoupdate-output-grammar
status: complete
nyquist_compliant: true
wave_0_complete: true
created: 2026-05-30
---

# Phase 27 -- Validation Strategy

> Per-phase validation contract for feedback sampling during execution. Derived from `27-RESEARCH.md` § Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `node:test` (built-in, Node ≥22) |
| **Config file** | none -- run via `npm run check` (typecheck + ESLint + Prettier + `node --test`) |
| **Quick run command** | `node --test tests/shared/notify-v2.test.ts tests/architecture/catalog-uat.test.ts tests/architecture/notify-types.test.ts` |
| **Full suite command** | `npm run check` |
| **Estimated runtime** | quick ~5s; full `npm run check` ~70s |

---

## Sampling Rate

- **After every task commit:** quick run command above.
- **After every plan wave:** `npm run check`.
- **Before `/gsd-verify-work`:** full suite green (`npm run check` exit 0) + `npm run test:integration` + `PI_CM_E2E_REF=pinned npm run test:e2e`.
- **Max feedback latency:** ~5s (quick) / ~70s (full).

---

## Per-Requirement Verification Map

> Task IDs (`27-NN-NN`) are assigned by the planner; this maps each requirement to the observable signal + the binding test. The catalog-uat byte-equality runner reads `docs/output-catalog.md` at test time, so every grammar change moves renderer + catalog fixture + `notify-v2` byte test in lockstep (no intermediate RED).

| Req | Observable signal | Test Type | Automated Command | File Exists |
|-----|-------------------|-----------|-------------------|-------------|
| UXG-01 | `marketplace list` header has NO `<last-updated …>` token | byte-equality | `node --test tests/shared/notify-v2.test.ts` (edit list-header assertion) | ✅ edit |
| UXG-01 | catalog `mixed-scopes` block byte-equal without `<last-updated>` | catalog-uat | `node --test tests/architecture/catalog-uat.test.ts` | ✅ edit |
| UXG-01 | orchestrator list render omits `<last-updated>` | orchestrator | `node --test tests/orchestrators/marketplace/list.test.ts` | ✅ edit |
| UXG-04 | fresh enable → `● foo [user] <autoupdate>` | byte-equality | `notify-v2.test.ts` + catalog-uat `enable-fresh` fixture | ✅ edit |
| UXG-04 | fresh disable → `● foo [user] <no autoupdate>` | byte-equality | `notify-v2.test.ts` + catalog-uat `disable-fresh` | ✅ edit |
| UXG-04 | idempotent enable → `● foo [user] <autoupdate> {already autoupdate}` (warning) | byte + severity | `notify-v2.test.ts` + catalog-uat `enable-idempotent` | ✅ edit |
| UXG-04 | idempotent disable → `● foo [user] <no autoupdate> {already no autoupdate}` (warning) | byte + severity | catalog-uat `disable-idempotent` | ✅ edit |
| UXG-04 | `autoupdate.ts` constructs the new marker/reason payload | orchestrator | `node --test tests/orchestrators/marketplace/autoupdate*.test.ts` | ⚠️ W0 verify |
| UXG-05 | no-op update → `(skipped) {up-to-date}`, NO `/reload`, warning | byte + severity + trailer-absent | new `notify-v2.test.ts` case + new catalog-uat fixture | ✅ existing files / new cases |
| UXG-05 | changed update still → `(updated)` | orchestrator | `node --test tests/orchestrators/marketplace/update*.test.ts` (change-detector unit) | ⚠️ W0 verify |
| UXG-06 | catalog prose + heading corrected; catalog-uat `FIXTURES` key matches the renamed heading byte-for-byte | catalog-uat (missing-fixture guard) | `node --test tests/architecture/catalog-uat.test.ts` | ✅ edit |

*Status legend: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Confirm an orchestrator-level test file exists for `autoupdate.ts` and `update.ts` (`tests/orchestrators/marketplace/autoupdate*.test.ts`, `update*.test.ts`). If absent, add minimal payload-shape / change-detector tests so UXG-04's payload and UXG-05's change detector are locked at the orchestrator boundary.
- [ ] No framework install needed (`node:test` bundled).

*The renderer-level byte locks (`notify-v2.test.ts`) and the catalog-uat gate already exist and only need edits.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Live operator confirmation of the new marketplace/autoupdate output | UXG-01/04/05 | The original findings came from hands-on UAT; a follow-up `scripts/pi.sh` sweep confirms the rendered bytes match in a real Pi runtime | Re-run the relevant Batch-3 commands from `.planning/v1.4-MILESTONE-UAT.md` against `scripts/pi.sh` after the phase lands |

*Automated byte-equality (catalog-uat + notify-v2) is the binding gate; the manual sweep is confirmatory, not blocking.*

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers the autoupdate/update orchestrator-test gap
- [x] No watch-mode flags
- [x] Feedback latency < ~70s (full) / ~5s (quick)
- [x] `nyquist_compliant: true` set in frontmatter (after the planner aligns task verify fields)

**Approval:** approved -- Phase 27 GREEN gate met at Plan 27-04 (last plan). `npm run check` GREEN (1146/1146), `npm run test:integration` GREEN (4/4), `PI_CM_E2E_REF=pinned npm run test:e2e` GREEN (14/14). The pre-existing `fold-adoption.test.ts` phase-1 deferral did NOT recur. Every Phase 27 requirement (UXG-01/04/05/06) carries an `<automated>` verify mapped to its per-requirement test; no 3 consecutive tasks lack automated verify.
