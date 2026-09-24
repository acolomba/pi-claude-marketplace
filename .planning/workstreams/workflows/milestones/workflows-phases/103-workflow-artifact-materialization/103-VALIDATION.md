---
phase: 103
slug: workflow-artifact-materialization
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
status: validated
nyquist_compliant: false
wave_0_complete: true
created: 2026-08-15
validated: 2026-08-16
---

# Phase 103 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `node:test` (built-in) + `node:assert/strict` |
| **Config file** | none — the glob lives in `package.json` scripts |
| **Quick run command** | `node --test "tests/{domain,persistence,bridges}/**/*.test.ts"` |
| **Full suite command** | `npm run check` |
| **Estimated runtime** | ~30 seconds quick, ~3 minutes full |

A new `tests/bridges/workflows/` directory is picked up by the existing unit glob
automatically; so is a new `tests/platform/workflow-home.test.ts`. No framework
install is needed.

---

## Sampling Rate

- **After every task commit:** Run `node --test "tests/{domain,persistence,bridges}/**/*.test.ts"`
- **After every plan wave:** Run `npm test`
- **Before `/gsd-verify-work`:** `npm run check` must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Requirement | Behavior | Test Type | Automated Command | File Exists | Status |
|-------------|----------|-----------|-------------------|-------------|--------|
| WPTH-03 | 13 hard-coded project keys, plus the split assertion for the relative case | unit | `node --test "tests/domain/workflow-project-key.test.ts"` | ✅ | ✅ green |
| WPTH-01 | user vs project saved dir; the project key appears in the project path | unit | `node --test "tests/persistence/locations.test.ts"` | ✅ | ✅ green |
| WPTH-02 | `<cwd>/.pi/workflows/saved/` appears in no composed path and is empty after an install | unit + integration | `node --test "tests/persistence/locations.test.ts"` + bridge absence assert | ✅ | ✅ green |
| WPTH-04 | the artifact path getter refuses `../escape`, `a/b`, `.`, `..`, empty, control chars | unit | `node --test "tests/persistence/locations.test.ts"` | ✅ | ✅ green |
| WPTH-05 | staging root is under the workflows home, NOT under `extensionRoot`, for both scopes | unit | `node --test "tests/persistence/locations.test.ts"` | ✅ | ✅ green |
| WBRG-02 | flat scan; `.mjs`/`.cjs` admitted; nested dir ignored; symlink refused (D-14); dotfile ignored; first-wins dedup | unit | `node --test "tests/bridges/workflows/discover.test.ts"` | ✅ | ✅ green |
| WBRG-01 | committed bytes parse to `{name, description?, script}`; `script` byte-identical to source; `description` key absent when undefined; filename stem === envelope `name` | unit | `node --test "tests/bridges/workflows/stage.test.ts"` | ✅ | ✅ green |
| WBRG-03 | unreadable script → `warnings[]`, plugin still installs; refused and skipped verdicts likewise | unit | `node --test "tests/bridges/workflows/stage.test.ts"` | ✅ | ✅ green |
| WBRG-04 | a committed envelope satisfies the engine's read predicate, sits in a scan-visible directory, and the staging dir is invisible to that scan | unit | `node --test "tests/bridges/workflows/stage.test.ts"` | ✅ | ✅ green |
| WLIF-01 | six materialize phases in order; a later-phase throw unstages workflows; the workflows home is empty after rollback | integration | `node --test "tests/orchestrators/plugin/**/*.test.ts"` | ✅ | ✅ green |
| Criterion 7 | `info` renders `meta.name` for a `<name>.workflow.js` fixture; falls back to stem for a malformed script; never throws | unit | `node --test "tests/orchestrators/plugin/**/*.test.ts"` | ✅ | ✅ green |
| WNAM-05 (regression) | two scripts with the same `meta.name` fail the install as a whole | unit | `node --test "tests/bridges/workflows/stage.test.ts"` | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] `tests/domain/workflow-project-key.test.ts` — WPTH-03
- [x] `tests/bridges/workflows/discover.test.ts` — WBRG-02, WBRG-03
- [x] `tests/bridges/workflows/stage.test.ts` — WBRG-01, WBRG-04, WNAM-05
- [x] `tests/bridges/workflows/unstage.test.ts` — WLIF-01 removal half
- [x] A workflow-bearing plugin fixture carrying, at minimum: a `<meta.name>.js`
      where stem equals name; a `<other>.workflow.js` where stem differs from
      name (the divergence criterion 7 exists to prove); a `.mjs`; a helper
      module with no `meta` (silent skip); an unparseable file; and a file whose
      header comment mentions `Date.now` (the WVAL-03 refusal). Reuse Phase
      102's fixture sources where they exist as files rather than inline strings.
- [x] `tests/platform/workflow-home.test.ts` — the relocation seam's set/restore
      behavior
- [x] No framework install needed.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| A real `@quintinshaw/pi-dynamic-workflows` instance discovers an installed envelope and registers the command after `/reload` | WBRG-04 | The engine is a 0.x package with no exported contract; adding it as a `devDependency` would couple `npm run check` to upstream churn | Drive it from `tests/live-uat/` as a standalone `.mjs` driver, following the existing live-UAT pattern |

---

## Validation Sign-Off

- [x] All tasks have automated verify or a Wave 0 dependency
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 30s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** validated 2026-08-16 — PARTIAL (1 manual-only)

---

## Validation Audit 2026-08-16

| Metric | Count |
|--------|-------|
| Gaps found | 0 |
| Resolved | 0 |
| Escalated | 0 |
| Manual-only (by design) | 1 |

**Evidence.** All six Wave 0 files landed. `tests/bridges/workflows/` now holds
`discover.test.ts`, `stage.test.ts`, `unstage.test.ts` and `paths.test.ts`;
`tests/domain/workflow-project-key.test.ts` and `tests/platform/workflow-home.test.ts`
both exist. Spot-checked rows:

- `WPTH-02` is asserted from two directions — `tests/bridges/workflows/paths.test.ts:150`
  (the directory inside the project's own `.pi` stays absent after an install) and
  `tests/persistence/locations.test.ts:313` (no composed member is inside it)
- `WPTH-03` — `tests/domain/workflow-project-key.test.ts` drives the table of hard-coded
  keys plus the relative-path case at `:73`
- `WBRG-02` — `tests/bridges/workflows/stage.test.ts:189` covers the flat scan with
  dotfile, nested-dir and symlink refusals in one case

Gate results at audit time: unit `3698 pass / 0 fail / 1 skipped`, integration
`18 pass / 0 fail`, `npm run typecheck` clean.

**Why PARTIAL, not compliant.** The single Manual-Only row (a real
`@quintinshaw/pi-dynamic-workflows` instance discovering a committed envelope) is
manual by design, not by omission: the engine is a 0.x package deliberately in no
dependency manifest, so binding `npm run check` to it would import upstream churn
into every build. `tests/live-uat/workflow-storage-canary.mjs` is the standing driver.
