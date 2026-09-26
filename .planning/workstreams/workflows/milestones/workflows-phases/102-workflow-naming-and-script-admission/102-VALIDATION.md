---
phase: 102
slug: workflow-naming-and-script-admission
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: validated
nyquist_compliant: true
wave_0_complete: true
created: 2026-08-15
validated: 2026-08-16
---

# Phase 102 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `node:test` (Node built-in, v22.22.2) + `node:assert/strict` |
| **Config file** | none — globs live in `package.json` `scripts` |
| **Quick run command** | `node --test tests/domain/workflow-script.test.ts tests/domain/name.test.ts` |
| **Full suite command** | `npm test` (unit); `npm run check` for the phase gate |
| **Estimated runtime** | ~2 seconds quick, ~90 seconds full |

---

## Sampling Rate

- **After every task commit:** Run `node --test tests/domain/workflow-script.test.ts tests/domain/name.test.ts`
- **After every plan wave:** Run `npm test`
- **Before `/gsd-verify-work`:** `npm run check` must be green (typecheck + lint + format:check + unit + integration)
- **Max feedback latency:** 2 seconds

---

## Per-Task Verification Map

Task IDs are assigned by the planner. Every row below must map onto at least one
task before the plan is executable; a row with no task is a coverage gap.

| Req ID | Behavior | Threat Ref | Test Type | Automated Command | File Exists | Status |
|--------|----------|------------|-----------|-------------------|-------------|--------|
| WNAM-01 | String-literal `meta.name` yields `<plugin>:<meta.name>` — including `meta` at line 26 behind a header, a double-quoted key, and a `<something>.workflow.js` file name | — | unit | `node --test tests/domain/workflow-script.test.ts` | ✅ | ✅ green |
| WNAM-01 | Comment decoy and string decoy do **not** win | T-102-01 | unit | same | ✅ | ✅ green |
| WNAM-02 | `meta` with no `name` → `stem-fallback`, value never read | — | unit | same | ✅ | ✅ green |
| WNAM-02 | `name: someVar` → `stem-fallback`, value never evaluated | T-102-02 | unit | same | ✅ | ✅ green |
| WNAM-03 | No `meta` declaration → `skipped`, not installed | — | unit | same | ✅ | ✅ green |
| WNAM-03 | `meta` present but not an object literal → `skipped` | — | unit | same | ✅ | ✅ green |
| WNAM-04 | acorn `SyntaxError` → `refused`, no scavenged name | T-102-02 | unit | same | ✅ | ✅ green |
| WNAM-04 | Unparseable **and** blocklist-hit → `refused` (decision-order pin) | — | unit | same | ✅ | ✅ green |
| WNAM-05 | Two files, same resolved name → throws; message names both | — | unit | same | ✅ | ✅ green |
| WNAM-05 | Collision detected over the whole set, **before** any dedup | — | unit | same | ✅ | ✅ green |
| WNAM-06 | `<plugin>:<name>` shape with RN-1 `<plugin>-` prefix elision | — | unit | `node --test tests/domain/name.test.ts` | ✅ | ✅ green |
| WNAM-06 / SC 4 | Generated name > 128 chars is rejected | T-102-03 | unit | same | ✅ | ✅ green |
| WNAM-06 / SC 4 | Generated name with leading/trailing whitespace is rejected | T-102-03 | unit | same | ✅ | ✅ green |
| WNAM-06 | A colon-bearing generated name is **accepted** — no sanitizing step | — | unit | same | ✅ | ✅ green |
| WNAM-06 | An individually unsafe `meta.name` is a per-file refusal, never an escaping throw | — | unit | `node --test tests/domain/workflow-script.test.ts` | ✅ | ✅ green |
| WVAL-01 | Blocklist-hit script is not admitted, decided from source alone | — | unit | same | ✅ | ✅ green |
| WVAL-02 | One refused script among several leaves the others admitted | — | unit | same | ✅ | ✅ green |
| WVAL-03 | Code match and comment-only match report **distinct** reasons | T-102-01 | unit | same | ✅ | ✅ green |
| WVAL-03 | String-literal-only match classified as such, not as a code violation | T-102-01 | unit | same | ✅ | ✅ green |
| WVAL-03 | Template-literal match classified correctly (backtick-exclusive range) | — | unit | same | ✅ | ✅ green |
| WDOC-03 | `acorn` in `package.json` `dependencies`; lock entry carries no `"dev": true` | — | unit (reads `package.json`, mirrors `tests/architecture/no-telemetry-deps.test.ts`) | `npm test` | ✅ | ✅ green |
| WDOC-03 | The extension imports acorn and typechecks | — | typecheck | `npm run typecheck` | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

**Note on the WDOC-03 assertion.** A dependency declaration is normally proven by
`npm run check` passing rather than by an assertion. The pin is still cheap and
mirrors `tests/architecture/no-telemetry-deps.test.ts`, which already reads
`package.json` for this class of claim. Assert *membership*, not the exact
version string, so a future caret bump does not fail the gate.

---

## Wave 0 Requirements

- [x] `tests/domain/workflow-script.test.ts` — new file, covers WNAM-01..05 and WVAL-01..03
- [x] `tests/domain/name.test.ts` — new WNAM-06 / SC-4 section; the file exists, the section does not
- [x] Inline fixture corpus inside the test file: the nine spike-013 cases plus the
      divergent-plugin case (`drafter.workflow.js` shape — 20-line header, `meta`
      at line 26, stem `drafter.workflow`, `meta.name` `drafter`)
- [x] Fixtures stay **inline as template strings**, never on-disk `.js` files — an
      on-disk `.js` fixture fails three repo gates (see RESEARCH Pitfall 4)
- [x] No framework install needed — `node:test` is built in

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| — | — | — | — |

*All phase behaviors have automated verification. This phase writes no artifact
and touches no user-visible surface, so there is nothing to observe by hand.*

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 2s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** validated 2026-08-16

---

## Validation Audit 2026-08-16

| Metric | Count |
|--------|-------|
| Gaps found | 0 |
| Resolved | 0 |
| Escalated | 0 |

**Evidence.** Both Wave 0 test files landed and every requirement in the map is
carried by a test that names it:

- `tests/domain/workflow-script.test.ts` — `WNAM-01`..`WNAM-05`, `WVAL-01`..`WVAL-03`.
  The thin-looking rows are real: `WVAL-02` is the single four-script case at `:832`,
  and `WNAM-04` carries three distinct refusal cases (`:467`, `:481`, and the
  decision-order pin at `:819` where a source is both unparseable and blocklist-hit)
- `tests/domain/name.test.ts` — the `WNAM-06` / SC-4 section
- `WDOC-03` — `tests/architecture/runtime-deps.test.ts` asserts `acorn` membership in
  `dependencies` (not the version string), mirroring `no-telemetry-deps.test.ts`;
  the import side is proven by `npm run typecheck`

Gate results at audit time: unit `3698 pass / 0 fail / 1 skipped`, integration
`18 pass / 0 fail`, `npm run typecheck` clean. The Manual-Only table is empty, so
this phase is fully Nyquist-compliant.
