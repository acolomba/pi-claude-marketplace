---
phase: 101
slug: manifest-field-and-precedence-resolution
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-14
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

Task IDs are assigned by the planner; rows below are the requirement-to-test
contract the plans must satisfy. `validate-phase` reconciles task IDs into this
table after planning.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD | TBD | TBD | DFEN-01 | — | N/A | unit | `node --test "tests/domain/manifest.test.ts"` | ✅ | ⬜ pending |
| TBD | TBD | TBD | DFEN-01 | — | N/A | unit | `node --test "tests/domain/resolver-strict.test.ts"` | ✅ | ⬜ pending |
| TBD | TBD | TBD | DFEN-02 | — | N/A | unit | `node --test "tests/domain/resolver-strict.test.ts"` | ✅ | ⬜ pending |
| TBD | TBD | TBD | DFEN-02 | — | N/A | unit | `node --test "tests/domain/resolver-loose.test.ts"` | ✅ | ⬜ pending |
| TBD | TBD | TBD | DFEN-03 | — | N/A | type-level | `npm run typecheck` | ✅ | ⬜ pending |
| TBD | TBD | TBD | Criterion 5 | — | N/A | characterization | `node --test "tests/orchestrators/plugin/install.test.ts"` | ✅ | ⬜ pending |
| TBD | TBD | TBD | NFR-6 no-regression | — | N/A | regression | `node --test "tests/architecture/**/*.test.ts"` | ✅ | ⬜ pending |

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

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
