---
phase: 101
slug: manifest-field-and-precedence-resolution
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: validated
nyquist_compliant: true
wave_0_complete: true
created: 2026-08-14
validated: 2026-08-14
---

# Phase 101 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `node:test` (Node built-in), Node `>=20.19.0`, `.ts` run natively via type stripping |
| **Config file** | none — suites are selected by glob in `package.json` scripts |
| **Quick run command** | `node --test "tests/domain/**/*.test.ts" && npm run typecheck` |
| **Full suite command** | `npm run check` |
| **Estimated runtime** | ~60 seconds quick, ~5 min full |

---

## Sampling Rate

- **After every task commit:** `node --test "tests/domain/**/*.test.ts"` **plus**
  `npm run typecheck`. The typecheck is load-bearing, not optional: the
  `MATERIALIZABLE_FIELDS` edit fans out to 17 construction sites, and a task that
  edits the field bag without a typecheck looks green while the tree does not
  compile.
- **After every plan wave:** `npm test` — the full unit glob, which covers
  `tests/bridges/**` and `tests/orchestrators/**` where 16 of the 17 breakages
  live.
- **Before `/gsd-verify-work`:** `npm run check` must be green (NFR-6, a
  milestone-wide constraint at every phase boundary).
- **Max feedback latency:** ~60 seconds.

---

## Per-Task Verification Map

Reconciled against the executed plans. Every task carries at least one
`<automated>` verify command, so sampling continuity holds with no gap — there
is no run of even two consecutive tasks without automated verification, let
alone three.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 101-01-01 | 01 | 1 | DFEN-01, DFEN-02, DFEN-03 | T-101-01 / T-101-03 | Non-boolean rejected by the compiled validator; `typeof` narrow degrades to the `true` default with no error path | tracer | `npm run typecheck` · `node --test "tests/domain/**/*.test.ts"` · `node --test "tests/bridges/**/*.test.ts"` · `npm run lint` | ✅ | ✅ green |
| 101-01-02 | 01 | 1 | DFEN-03 | — | N/A | type-level | `npm run typecheck` · `npm run lint` | ✅ | ✅ green |
| 101-02-01 | 02 | 2 | DFEN-01, DFEN-02 | T-101-02 / T-101-03 | Malformed `plugin.json` resolves `unavailable` with the existing note prefix | unit | `node --test tests/domain/resolver-strict.test.ts` · `npm run typecheck` | ✅ | ✅ green |
| 101-02-02 | 02 | 2 | DFEN-02 | T-101-05 | Loose-mode conflict accumulators stay closed tuples; metadata never becomes conflict material | unit | `node --test tests/domain/resolver-loose.test.ts` · `node --test "tests/domain/**/*.test.ts"` · `npm run typecheck` | ✅ | ✅ green |
| 101-03-01 | 03 | 2 | DFEN-01 | T-101-01 | One malformed entry rejects the whole `marketplace.json`; no partial trust in a failed file | unit | `node --test tests/domain/manifest.test.ts` · `npm run typecheck` | ✅ | ✅ green |
| 101-03-02 | 03 | 2 | Criterion 5 | T-101-04 / T-101-06 | Install stays enabled and materialized; the config write-back patch stays empty; seeder knobs strictly additive | characterization | `node --test tests/orchestrators/plugin/install.test.ts` · `npm run typecheck` · `npm run lint` | ✅ | ✅ green |
| 101-03-03 | 03 | 2 | Criterion 5 | — | N/A | characterization | `node --test tests/orchestrators/plugin/info.test.ts` · `npm run typecheck` | ✅ | ✅ green |

Phase-boundary gate, run in full after the last task and again after code-review
remediation: `npm run check` → exit 0 (typecheck + lint + format:check + unit +
integration; 3471 pass / 0 fail / 1 pre-existing skip).

### Behaviors each row must prove

| Requirement | Behavior |
|-------------|----------|
| DFEN-01 | entry accepts `defaultEnabled: false`; manifest accepts it; non-boolean rejected on both; unrelated unknown key still accepted (D-09 lenient) |
| DFEN-01 | a malformed `defaultEnabled` in one entry invalidates the whole `marketplace.json` via `InvalidMarketplaceManifestError` — unchanged blast radius |
| DFEN-01 | a `plugin.json` with a non-boolean `defaultEnabled` resolves `unavailable` with the existing `malformed plugin.json:` note |
| DFEN-02 | entry `false` + manifest `true` → `false` |
| DFEN-02 | entry `true` + manifest `false` → `true` — the direction a reader guesses wrong, pinned on its own |
| DFEN-02 | absent at both sites → `true`; `null` manifest → entry value, then `true` |
| DFEN-02 | manifest-only `defaultEnabled` with a silent entry does **not** conflict in loose mode — still resolves, never `unavailable` |
| DFEN-02 | `resolveLoose` resolves the same value as `resolveStrict` for identical inputs |
| DFEN-03 | the field is readable off `MaterializablePlugin` with no narrowing, and inaccessible on the `unavailable` arm |
| Criterion 5 | a plugin declaring `defaultEnabled: false` still resolves `installable` and still installs **enabled** at this phase |
| NFR-6 | the architecture suite is unchanged — no closed-set, glyph, record-key or schema-version delta |

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements. Every target test file
already exists and the framework is installed — no new fixture directory, no
`conftest`-equivalent, no framework install.

---

## Manual-Only Verifications

All phase behaviors have automated verification. This is a schema-and-resolution
phase with no user-observable surface, so there is nothing to validate by hand.

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies — 7/7 tasks
- [x] Sampling continuity: no 3 consecutive tasks without automated verify — no gap at all
- [x] Wave 0 covers all MISSING references — none were missing; every target test file pre-existed
- [x] No watch-mode flags — every command is a single-shot `node --test` or `npm run` invocation
- [x] Feedback latency < 60s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-08-14
