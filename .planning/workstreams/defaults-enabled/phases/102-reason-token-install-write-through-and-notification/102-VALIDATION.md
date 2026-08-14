---
phase: 102
slug: reason-token-install-write-through-and-notification
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-08-14
---

# Phase 102 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `node:test` (Node built-in), Node `>=20.19.0` |
| **Config file** | none — glob-driven from `package.json` scripts |
| **Quick run command** | `node --test tests/orchestrators/plugin/install.test.ts` |
| **Full suite command** | `npm run check` (typecheck + lint + format:check + test + test:integration) |
| **Estimated runtime** | unmeasured — measure the quick command on the first task commit and record the real figure here |

---

## Sampling Rate

- **After every task commit:** Run `node --test tests/orchestrators/plugin/install.test.ts` plus `npm run typecheck` — the `notify-reasons.ts` partition proof is a compile-time gate, so typecheck is the cheapest signal that OUT-01 landed whole.
- **After every plan wave:** Run `npm test` (the architecture globs are in the unit set).
- **Before `/gsd-verify-work`:** `npm run check` must be green (NFR-6).
- **Max feedback latency:** to be recorded on the first task commit; if the quick command exceeds ~60s, narrow it with a `--test-name-pattern`.

---

## Per-Task Verification Map

Task IDs are assigned by the planner. Each row below is a required behavior; the planner MUST attach every row to at least one task and fill the Task ID / Plan / Wave columns.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 102-01-T1 | 102-01 | 1 | OUT-01 | — | `REASONS` holds exactly 39 members, `installs disabled` at the tail, nothing reordered | unit/architecture | `node --test tests/architecture/compat-01-no-expansion.test.ts tests/architecture/notify-closed-set-locks.test.ts` | ✅ | ⬜ pending |
| 102-01-T1 | 102-01 | 1 | OUT-01 | — | Token has a topic home (`DECLARED_STATE_REASONS`, folded into `SharedTopicReason`); partition completeness proof stays `never` | compile | `npm run typecheck` | ✅ | ⬜ pending |
| 102-01-T1 | 102-01 | 1 | DFEN-04 | T-102-04 | Install of a `defaultEnabled: false` plugin records `enabled: false` and leaves no skills/commands/agents/hooks/mcp on disk | unit | `node --test tests/orchestrators/plugin/install.test.ts` | ✅ | ⬜ pending |
| 102-01-T1 | 102-01 | 1 | DFEN-04 | — | Record keeps its inventory (ENBL-18) — `resources.*` non-empty on the disabled record | unit | same | ✅ | ⬜ pending |
| 102-01-T1 / 102-03-T1 | 102-01 / 102-03 | 1 / 2 | DFEN-04 | T-102-02 | The config entry gains `enabled: false` through a `config-write-back.ts` entry-level patch (D-102-09). Standalone keeps the BATCHED call so CR-02's single atomic save survives (settled as DS-4 in 102-01); the reconcile stamp is the `writePluginConfigEntry` call | unit | `node --test tests/orchestrators/plugin/install.test.ts` / `node --test tests/orchestrators/reconcile/apply.test.ts` | ✅ | ⬜ pending |
| 102-02-T1 | 102-02 | 2 | DFEN-05 | — | Config `enabled: true` + manifest `defaultEnabled: false` → installs enabled, config untouched | unit | `node --test tests/orchestrators/plugin/install.test.ts` | ✅ | ⬜ pending |
| 102-02-T1 | 102-02 | 2 | DFEN-05 | — | Config `enabled: false` + manifest `defaultEnabled: true` → the entry is never rewritten | unit | same | ✅ | ⬜ pending |
| 102-02-T2 | 102-02 | 2 | DFEN-05 | — | `import` of a `defaultEnabled: false` plugin installs ENABLED (D-102-03): the cascade's injected `installPlugin` seam never receives `applyDefaultEnabled` | unit | `node --test tests/orchestrators/import/execute.test.ts` | ✅ (owning file confirmed: `execute.test.ts` injects the seam) | ⬜ pending |
| 102-03-T2 | 102-03 | 2 | DFEN-04/05 | T-102-03, T-102-07 | reconcile install stamps `enabled: false` only when the key is absent, into the declaring physical file (`configSource`), asserted through the MERGED view for the local-declared case | unit | `node --test tests/orchestrators/reconcile/apply.test.ts` | ✅ | ⬜ pending |
| 102-01-T2 | 102-01 | 1 | OUT-04 | T-102-04 | Row renders `(disabled) {installs disabled}` at info severity, one emission, no absolute path in the row | unit | `node --test tests/orchestrators/plugin/install.test.ts` | ✅ | ⬜ pending |
| 102-01-T2 | 102-01 | 1 | OUT-04 | — | D-102-10 enable-hint trailer renders as a byte-frozen literal, no interpolation, and is absent from an ordinary install | unit | same | ✅ | ⬜ pending |
| 102-02-T3 | 102-02 | 2 | D-102-02 | T-102-06 | Ledger succeeds + disable cascade throws → today's partial-drop reporting, shrunken record saved, failure surfaced | unit | same | ✅ | ⬜ pending |
| 102-01-T2 | 102-01 | 1 | DFEN-04 | T-102-01 | Hooks parsed-config cache is DROPPED, not populated, on the install-disabled path (with the contrasting enabled-install case so it cannot pass vacuously) | unit | same | ✅ | ⬜ pending |
| 102-02-T3 / 102-03-T2 | 102-02 / 102-03 | 2 | NFR-6 | — | Whole suite green at the phase boundary | integration | `npm run check` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements. Every target test file already exists — `tests/orchestrators/plugin/install.test.ts`, `tests/orchestrators/reconcile/apply.test.ts`, `tests/architecture/compat-01-no-expansion.test.ts`, `tests/architecture/notify-closed-set-locks.test.ts`. No framework install, no new fixture harness.

The one open lookup is now closed: `tests/orchestrators/import/execute.test.ts` owns the cascade path and already INJECTS `installPlugin` as a seam, so the D-102-03 assertion reads the `opts` the cascade passes rather than needing an end-to-end fixture.

---

## Manual-Only Verifications

All phase behaviors have automated verification. The rendered notification row is asserted in-process against the message builder; no live Pi session is required.

---

## Security Sign-Off (ASVS L1, block on `high`)

| Threat Ref | Pattern | STRIDE | Mitigation to verify |
|------------|---------|--------|----------------------|
| T-102-01 | A disabled plugin's hooks still dispatching | Elevation of privilege | Hooks parsed-config cache dropped, not populated, on the install-disabled path — the one genuinely security-relevant defect available in this phase |
| T-102-02 | A path-escaping config write | Tampering | `assertPathInside` runs before `atomicWriteJson`; `PathContainmentError` propagates loudly (PI-14) |
| T-102-03 | Hostile marketplace entry sets `defaultEnabled` to a non-boolean to smuggle truthiness | Tampering | Schema-validated at both declaration sites; resolver's `typeof … === "boolean"` narrows degrade to the `true` default |
| T-102-04 | Absolute-path leakage in the new notification | Information disclosure | Row carries plugin/marketplace/version tokens only — do not add a path to the new row |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (none — see above)
- [x] No watch-mode flags
- [ ] Feedback latency recorded and under budget — open: the quick command is still unmeasured, record it on the first task commit
- [x] Every Per-Task Verification Map row has a real Task ID
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-08-14 by the plan-checker gate (Dimension 8 behaviorally compliant; no blockers). `status` stays `draft` until `/gsd-validate-phase` sets `validated`.
