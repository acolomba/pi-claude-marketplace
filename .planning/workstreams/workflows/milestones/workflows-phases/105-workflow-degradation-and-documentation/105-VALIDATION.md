---
phase: 105
slug: workflow-degradation-and-documentation
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
status: validated
nyquist_compliant: false
wave_0_complete: true
created: 2026-08-16
validated: 2026-08-16
---

# Phase 105 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `node:test` (built-in) + `node:assert/strict` |
| **Config file** | none — driven by `package.json` scripts |
| **Quick run command** | `node --test tests/<dir>/<file>.test.ts` (the suite the task touched) |
| **Full suite command** | `npm run check` |
| **Estimated runtime** | ~15 seconds per suite, ~3 minutes full |

`tests/docs/` is in the unit glob but does not exist — a new `tests/docs/*.test.ts` would be
picked up automatically if this phase wants one.

---

## Sampling Rate

- **After every task commit:** the single suite the task touched
- **After every plan wave:** `npm run typecheck && npm run lint && npm test`
- **Before `/gsd-verify-work`:** `npm run check` green, plus one run of
  `PI_WORKFLOW_ENGINE_ROOT=<scratch>/node_modules node tests/live-uat/workflow-storage-canary.mjs`
  recorded as HUMAN-UAT (it is outside `npm run check` by design)
- **Max feedback latency:** 20 seconds

---

## Per-Task Verification Map

| Requirement | Behavior | Test Type | Automated Command | File Exists | Status |
|-------------|----------|-----------|-------------------|-------------|--------|
| WDEP-01 | `workflow_control` present → loaded | unit | `node --test tests/platform/pi-api.test.ts` | ✅ | ✅ green |
| WDEP-01 | **bare `workflow` only → NOT loaded** (the discriminating case) | unit | same | ✅ | ✅ green |
| WDEP-01 | both tools present → loaded (the decoy does not defeat the discriminator) | unit | same | ✅ | ✅ green |
| WDEP-01 | a throwing `getAllTools()` degrades to false | unit | same (`makeThrowingPi` exists) | ✅ | ✅ green |
| WDEP-01 | `softDepStatus` composes three flags | unit | same | ✅ | ✅ green |
| WDEP-02 | install with the engine absent still writes envelopes and succeeds | unit | `node --test tests/orchestrators/plugin/install.test.ts` | ✅ | ✅ green |
| WDEP-02 | the row carries the marker at `warning` severity, asserted on the Pi API argument | unit | same | ✅ | ✅ green |
| WDEP-02 | engine loaded → the row renders byte-identically to today (the negative half asserts the WHOLE block) | unit | same | ✅ | ✅ green |
| WDEP-03 | envelope + record byte-identical across the two probe states, with a non-vacuity check | unit | same | ✅ | ✅ green |
| WDEP-03 | `bridges/workflows/**` references no probe symbol (boundary gate) | architecture | `node --test tests/architecture/*.test.ts` | ✅ | ✅ green |
| WDEP-03 | a real engine's `list()` finds an envelope installed while the engine was absent | live-UAT | the canary | ✅ | 🖐 manual (closed 2026-08-16) |
| WDEP-04 | `DEPENDENCIES` is exactly `["agents","mcp","workflows"]`, in order | unit | closed-set clause | ✅ — **`DEPENDENCIES` is currently unpinned** | ✅ green |
| WDEP-04 | `REASONS.length === 40` and the tail is the new token | architecture | `node --test tests/architecture/notify-closed-set-locks.test.ts` | ✅ | ✅ green |
| WDEP-04 | COMPAT-01 enumeration equality with the new member | architecture | `node --test tests/architecture/compat-01-no-expansion.test.ts` | ✅ | ✅ green |
| WDEP-04 | the token has a topic-group home | typecheck | `npm run typecheck` (`_ReasonsCoverageProof` TS2344) | ✅ | ✅ green |
| WDOC-02 | catalog state ↔ fixture byte equality, both directions | architecture | `node --test tests/architecture/catalog-uat.test.ts` | ✅ | ✅ green |
| WDOC-02 | two-marker brace order pinned | architecture | same (second catalog state) | ✅ | ✅ green |
| WDOC-01 | the doc exists, carries the divergence table, and is linked from both READMEs | manual | reviewer read | — | 🖐 manual (reviewer read) |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] **A `DEPENDENCIES` order-and-length lock.** `grep -rn "DEPENDENCIES" tests` returns
      exactly one hit and it is an unrelated comment — the tuple is currently unpinned. It is
      the only one of the four closed sets without a lock, and this is the phase that grows
      it, which is when a pin is worth the most.
- [x] The probe-independence pair in `tests/orchestrators/plugin/install.test.ts` (WDEP-03
      layer 1), including its non-vacuity check.
- [x] A boundary clause asserting `bridges/workflows/**` never reads the probe symbol
      (WDEP-03 layer 2). `tests/helpers/source-scan.ts` already exists.
- [x] A second catalog state pinning the two-marker brace order.
- [x] Rename the probe helpers in `catalog-uat.test.ts` and `notify-v2.test.ts` — not a new
      test, but Wave-0-shaped, because every later fixture depends on the rename.
- [x] No framework install needed.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| A real engine lists and runs a workflow that was installed while the engine was absent | WDEP-03 | The engine is not a declared dependency; coupling `npm run check` to a 0.x package would import upstream churn into every build | Install into a scratch prefix, then `PI_WORKFLOW_ENGINE_ROOT=<scratch>/node_modules node tests/live-uat/workflow-storage-canary.mjs`. Delete the scratch prefix after. This route is proven — it ran green against engine 3.5.1 during Phase 104's verification, negative control included |
| The compatibility doc states the executable-code contract, the trust grounds, and the admit-versus-run divergence table, and both READMEs link it | WDOC-01 | Prose accuracy and completeness are not machine-checkable | Reviewer read against the requirement text |

---

## Validation Sign-Off

- [x] All tasks have automated verify or a Wave 0 dependency
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 20s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** validated 2026-08-16 — PARTIAL (2 manual-only)

---

## Validation Audit 2026-08-16

| Metric | Count |
|--------|-------|
| Gaps found | 0 |
| Resolved | 0 |
| Escalated | 0 |
| Manual-only (by design) | 2 |

**Evidence.** Every Wave 0 item landed, including the one the plan called out as
the highest-value pin:

- The `DEPENDENCIES` order-and-length lock now exists —
  `tests/architecture/notify-closed-set-locks.test.ts:55` asserts
  `["agents","mcp","workflows"]` and `length === 3`. It was the only one of the four
  closed sets left unpinned before this phase
- `WDEP-03` layer 2 — `tests/architecture/no-probe-in-workflows-bridge.test.ts`
  forbids `bridges/workflows/**` from reaching any probe symbol, enumerated from the
  live directory listing rather than a hardcoded array
- `WDOC-02` — both catalog states landed and are byte-paired between
  `docs/output-catalog.md` and `tests/architecture/catalog-uat.test.ts`:
  `success-with-workflow-engine-absent` and, for the two-marker brace order,
  `success-with-soft-dep-and-workflow-engine-absent`. Note the test comments anchor
  these to `WDEP-02`/`WDEP-04`, so a grep for the literal `WDOC-02` returns nothing —
  the coverage is real, only the ID label is absent
- `WDOC-01` — `docs/workflows-compatibility.md` exists and is linked from both
  `README.md` and `README.es.md`

Gate results at audit time: unit `3698 pass / 0 fail / 1 skipped`, integration
`18 pass / 0 fail`, `npm run typecheck` clean.

**On the two manual rows.** `WDOC-01` (prose accuracy of the divergence table) is not
machine-checkable and is correctly manual. The live-engine canary (W1/W2/W3) is
recorded in `105-VERIFICATION.md` frontmatter as closed on 2026-08-16 via the
scratch-prefix route (`npm install --prefix` + `PI_WORKFLOW_ENGINE_ROOT`), with W3 as
the negative control. The body of that document still carries pre-closure "UNRUN"
wording at its evidence table — the frontmatter and the `Status: passed` line are the
current record.
