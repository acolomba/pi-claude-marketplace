---
phase: 85
slug: mcpservers-string-file-path-references
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-22
---

# Phase 85 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `node:test` + `node:assert/strict` (built-in) |
| **Config file** | none — test scripts in `package.json` |
| **Quick run command** | `node --test tests/domain/resolver-strict.test.ts` |
| **Full suite command** | `npm run check` (typecheck + ESLint + Prettier + full `node --test`) |
| **Estimated runtime** | quick ~5s; full `npm run check` ~60s |

---

## Sampling Rate

- **After every task commit:** Run the single test file the task touches (`node --test <file>`)
- **After every plan wave:** Run `npm run check`
- **Before `/gsd-verify-work`:** `npm run check` must be green
- **Max feedback latency:** ~60 seconds (full suite)

---

## Per-Task Verification Map

*Task IDs are assigned during planning (§8). This map is populated by the
planner/executor as tasks are created; the requirement→test mapping below is the
seed from RESEARCH.md's Validation Architecture.*

| Requirement | Behavior | Test Type | Automated Command | File Exists |
|-------------|----------|-----------|-------------------|-------------|
| MCPR-01 | marketplace-entry string ref installs at inline parity | unit (resolver) | `node --test tests/domain/resolver-strict.test.ts` | ✅ extend |
| MCPR-01 | marketplace.json with a string entry LOADS (no whole-manifest throw) | unit (validator) | `node --test tests/domain/*manifest*.test.ts` | ❌ W0 |
| MCPR-02 | plugin.json string ref installs at parity; `readManifest` accepts it | unit (resolver + validator) | `node --test tests/domain/resolver-strict.test.ts` | ✅ extend |
| MCPR-03 | missing / malformed-JSON / wrapper-less ref → `unavailable` + note; siblings resolve; no throw | unit (resolver) | `node --test tests/domain/resolver-strict.test.ts` | ✅ extend |
| MCPR-03 | `{malformed mcp}` token surfaces; inline `malformed mcpServers` still `{unsupported source}` | unit (narrower) | `node --test tests/shared/probe-classifiers.test.ts` | ✅ extend |
| MCPR-04 | `../` traversal AND symlink ref → `unavailable` + note; no out-of-root read | unit (resolver) | `node --test tests/domain/resolver-strict.test.ts` | ✅ extend |
| Criterion 5 | conventional standalone `.mcp.json` unwrapped tolerance UNCHANGED | unit (regression) | `node --test tests/domain/resolver-strict.test.ts` | ❌ W0 |
| Closed set | `REASONS.length === 35` (34 → 35) | architecture | `node --test tests/architecture/notify-closed-set-locks.test.ts` | ✅ bump |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/domain/resolver-strict.test.ts` — add string-ref cases (parity, missing, malformed-JSON, wrapper-less, `../` escape, symlink escape) covering MCPR-01/02/03/04.
- [ ] Schema-acceptance test — a marketplace.json with a string `mcpServers` entry passes `MARKETPLACE_VALIDATOR.Check` (MCPR-01 no-throw); a plugin.json string passes `PLUGIN_MANIFEST_VALIDATOR.Check` (MCPR-02). Near existing manifest tests in `tests/domain/`.
- [ ] Criterion-5 regression test — undeclared unwrapped conventional `.mcp.json` still resolves installable.
- [ ] `tests/shared/probe-classifiers.test.ts` — `narrowResolverNotes(["malformed mcp reference: …"])` → `["malformed mcp"]`, AND `narrowResolverNotes(["malformed mcpServers: …"])` still → `["unsupported source"]` (note-prefix collision guard).
- [ ] `tests/architecture/notify-closed-set-locks.test.ts` — bump length 34 → 35.

---

## Manual-Only Verifications

All phase behaviors have automated verification. (Optional runtime UAT: install a
plugin declaring `mcpServers: "./x.mcp.json"` in a scratch marketplace and confirm
the servers stage after `/reload`, at parity with the inline-object form.)

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
