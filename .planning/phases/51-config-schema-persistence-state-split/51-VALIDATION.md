---
phase: 51
slug: config-schema-persistence-state-split
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-09
---

# Phase 51 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `node:test` (built-in, Node `>=20.19.0`) |
| **Config file** | none — invoked via npm scripts; tests are `tests/**/*.test.ts` |
| **Quick run command** | `npm test -- "tests/persistence/config-io.test.ts" "tests/persistence/config-merge.test.ts" "tests/architecture/config-state-write-seams.test.ts"` |
| **Full suite command** | `npm run check` (typecheck + lint + format + test + integration) |
| **Estimated runtime** | ~10 seconds (quick) / ~60 seconds (full) |

---

## Sampling Rate

- **After every task commit:** Run `npm test -- "tests/persistence/**/*.test.ts" "tests/architecture/config-state-write-seams.test.ts"` (~10s)
- **After every plan wave:** Run `npm test` (full unit suite, ~30s)
- **Before `/gsd-verify-work`:** `npm run check` must be green
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD | TBD | TBD | CFG-01 | — | typebox-validated load/save round-trip | unit | `npm test -- "tests/persistence/config-io.test.ts"` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | CFG-01 | — | defaults (autoupdate=false, enabled=true) applied at consume time | unit | `npm test -- "tests/persistence/config-merge.test.ts"` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | CFG-02 | — | entry-level base+local merge matrix (base-only / local-only / both / disjoint) | unit | `npm test -- "tests/persistence/config-merge.test.ts"` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | CFG-03 | T-malformed-config | `ConfigLoadResult` trichotomy: absent / invalid / valid; 0-byte ≠ valid-empty | unit | `npm test -- "tests/persistence/config-io.test.ts"` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | CFG-03 | T-malformed-config | invalid file aborts with structured error detail | unit | `npm test -- "tests/persistence/config-io.test.ts"` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | SPLIT-01 | — | old `state.json` with `autoupdate` still loads (lenient) | unit | `npm test -- "tests/persistence/state-io.test.ts"` | ✅ extend | ⬜ pending |
| TBD | TBD | TBD | SPLIT-01 | — | `autoupdate` scrubbed at load when config file exists (D-13) | unit | `npm test -- "tests/persistence/migrate.test.ts"` | ✅ extend | ⬜ pending |
| TBD | TBD | TBD | SPLIT-01 | — | `STATE_SCHEMA.schemaVersion` stays `1` (D-12) | unit | `npm test -- "tests/persistence/state-io.test.ts"` | ✅ extend | ⬜ pending |
| TBD | TBD | TBD | SPLIT-02 | T-write-seam-bypass | only `saveConfig` writes config files; only `saveState`/`persistMigratedState` write state file | architecture | `npm test -- "tests/architecture/config-state-write-seams.test.ts"` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | SPLIT-02 | T-containment-escape | NFR-10 containment: `assertPathInside(scopeRoot, ...)` enforced on config writes | unit | `npm test -- "tests/persistence/config-io.test.ts"` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | (locations) | — | `configJsonPath` / `configLocalJsonPath` resolve under `scopeRoot` | unit | `npm test -- "tests/persistence/locations.test.ts"` | ✅ extend | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/persistence/config-io.test.ts` — covers CFG-01 / CFG-03 / NFR-10 enforcement
- [ ] `tests/persistence/config-merge.test.ts` — covers CFG-02 (matrix: base-only, local-only, both with overlap, disjoint)
- [ ] `tests/architecture/config-state-write-seams.test.ts` — covers SPLIT-02
- [ ] `tests/persistence/fixtures/legacy/` — v1.12-pre-migration fixture (state with `autoupdate`)
- [ ] `tests/persistence/state-io.test.ts` — extend with SPLIT-01 cases
- [ ] `tests/persistence/migrate.test.ts` — extend with D-13 ordering rail case
- [ ] `tests/persistence/locations.test.ts` — extend with config path assertions

Framework install: none — `node:test` is built-in.

---

## Manual-Only Verifications

All phase behaviors have automated verification.

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
