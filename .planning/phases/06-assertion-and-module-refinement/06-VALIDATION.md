---
phase: "06"
slug: "assertion-and-module-refinement"
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-09-08"
---

# Phase 6 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node.js built-in `node:test` with `node:assert/strict` |
| **Config file** | None — `package.json` scripts define test globs and concurrency |
| **Quick run command** | `node --test <affected-owner-tests-and-command-flow-proof>` |
| **Direct-pair command** | `npm run test:coverage:direct -- <new-source-or-owner-test>` |
| **Structural command** | `npm run test:corresponding && npm run test:coverage:direct:negative` |
| **Full suite command** | `npm run check` |
| **Estimated runtime** | Focused runs should remain under 30 seconds; use the full suite only at the phase gate |

---

## Sampling Rate

- **After every task commit:** Run the affected owner test and, for each new production source, its direct-pair coverage command.
- **After every plan wave:** Run all changed command-flow proofs, `npm run test:corresponding`, affected architecture gates, `npm run typecheck`, `npm run lint`, and `npm run fallow`.
- **Before `$gsd-verify-work`:** Run `npm run check`, the exact residual global-patch census, every deleted-hub stale-path scan, and exclusion checks.
- **Max feedback latency:** 30 seconds for the per-task focused sample.

---

## Per-Task Verification Map

The planner must replace the provisional plan/wave labels below with the final task IDs while preserving every listed check.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 06-01-01, 06-01-02 | 06-01 | 1 | TREF-07 | T-06-03, T-06-04 | Strengthen observable assertions before any ownership move | focused/direct/structural | `node --test tests/orchestrators/marketplace/autoupdate.test.ts tests/orchestrators/marketplace/list.test.ts tests/orchestrators/plugin/list.test.ts tests/orchestrators/plugin/install.test.ts tests/orchestrators/plugin/update.test.ts tests/orchestrators/plugin/reinstall.test.ts && npm run typecheck && npx eslint tests/orchestrators/marketplace/autoupdate.test.ts tests/orchestrators/marketplace/list.test.ts tests/orchestrators/plugin/list.test.ts tests/orchestrators/plugin/install.test.ts tests/orchestrators/plugin/update.test.ts tests/orchestrators/plugin/reinstall.test.ts --max-warnings=0` | ✅ existing | ⬜ pending |
| 06-02-01, 06-02-02, 06-02-03 | 06-02 | 2 | TREF-08 | T-06-01, T-06-02 | Remove the authorized bridge/reconcile/path builtin patches while preserving public outcomes | focused/direct/structural | `node --test tests/bridges/commands/discover.test.ts tests/bridges/hooks/event-router.test.ts tests/bridges/skills/unstage.test.ts tests/orchestrators/reconcile/apply.test.ts tests/shared/path-safety.test.ts && npm run typecheck && npx eslint tests/bridges/commands/discover.test.ts tests/bridges/hooks/event-router.test.ts tests/bridges/skills/unstage.test.ts tests/orchestrators/reconcile/apply.test.ts tests/shared/path-safety.test.ts --max-warnings=0` | ❌ Wave 0: 3 planned | ⬜ pending |
| 06-03-01, 06-03-02 | 06-03 | 2 | TREF-08 | T-06-02, T-06-04 | Remove authorized shared-process patches from plugin owner tests after their assertions are strengthened | focused/direct/structural | `node --test tests/orchestrators/plugin/enable-disable.test.ts tests/orchestrators/plugin/fetch.test.ts tests/orchestrators/plugin/info.test.ts tests/orchestrators/plugin/install.test.ts tests/orchestrators/plugin/reinstall.test.ts && npm run typecheck && npx eslint tests/orchestrators/plugin/enable-disable.test.ts tests/orchestrators/plugin/fetch.test.ts tests/orchestrators/plugin/info.test.ts tests/orchestrators/plugin/install.test.ts tests/orchestrators/plugin/reinstall.test.ts --max-warnings=0` | ✅ existing | ⬜ pending |
| 06-04-01, 06-04-02 | 06-04 | 2 | TREF-08 | T-06-02, T-06-05 | Close authorized global-patch removal with the exact residual census | focused/direct/structural | `node --test tests/index.test.ts tests/orchestrators/import/execute.test.ts && npm run typecheck && npm run fallow` | ✅ existing | ⬜ pending |
| 06-05-01, 06-05-02 | 06-05 | 3 | TREF-09 | T-06-01, T-06-05 | Begin leaf-first resolver extraction with type and closed-policy owners | focused/direct/structural | `node --test tests/domain/resolver-types.test.ts tests/domain/unsupported-components.test.ts tests/domain/resolver.test.ts && npm run test:corresponding && npm run typecheck && npx eslint extensions/pi-claude-marketplace/domain/resolver.ts extensions/pi-claude-marketplace/domain/resolver-types.ts extensions/pi-claude-marketplace/domain/unsupported-components.ts tests/domain/resolver.test.ts tests/domain/resolver-types.test.ts tests/domain/unsupported-components.test.ts --max-warnings=0` | ❌ Wave 0: 4 planned | ⬜ pending |
| 06-06-01, 06-06-02 | 06-06 | 4 | TREF-09 | T-06-01, T-06-04 | Extract resolver filesystem/path and MCP responsibilities into direct-tested leaves | focused/direct/structural | `node --test tests/domain/component-paths.test.ts tests/domain/mcp-resolution.test.ts tests/domain/resolver.test.ts && npm run test:corresponding && npm run typecheck && npx eslint extensions/pi-claude-marketplace/domain/component-paths.ts extensions/pi-claude-marketplace/domain/mcp-resolution.ts tests/domain/component-paths.test.ts tests/domain/mcp-resolution.test.ts --max-warnings=0` | ❌ Wave 0: 4 planned | ⬜ pending |
| 06-07-01, 06-07-02 | 06-07 | 5 | TREF-09 | T-06-01, T-06-02 | Complete resolver behavior extraction before bulk caller migration | focused/direct/structural | `node --test tests/domain/hooks-resolution.test.ts tests/domain/plugin-resolver.test.ts tests/domain/resolver.test.ts && npm run test:corresponding && npm run typecheck && npm run fallow` | ❌ Wave 0: 4 planned | ⬜ pending |
| 06-08-01, 06-08-02 | 06-08 | 6 | TREF-09 | T-06-01, T-06-05 | Migrate all remaining production resolver callers in bounded groups | focused/direct/structural | `npm run typecheck && npm run fallow` | ✅ existing | ⬜ pending |
| 06-09-01, 06-09-02 | 06-09 | 7 | TREF-09 | T-06-01, T-06-05 | Migrate all remaining production resolver callers in bounded groups | focused/direct/structural | `npm run typecheck && npm run fallow` | ✅ existing | ⬜ pending |
| 06-10-01, 06-10-02 | 06-10 | 8 | TREF-09 | T-06-01, T-06-05 | Finish resolver ownership, including the authorized import-only stage exception, and delete the legacy hub/test | focused/direct/structural | `npm run typecheck && npm run test:corresponding && npm run fallow` | ✅ existing | ⬜ pending |
| 06-11-01, 06-11-02, 06-11-03 | 06-11 | 9 | TREF-09 | T-06-01, T-06-05 | Finish resolver ownership, including the authorized import-only stage exception, and delete the legacy hub/test | focused/direct/structural | `npm run typecheck && npm run test:corresponding && npm run fallow` | ❌ Wave 0: 1 planned | ⬜ pending |
| 06-12-01, 06-12-02 | 06-12 | 10 | TREF-07, TREF-09 | T-06-03, T-06-04 | Start notification extraction with type and security leaves | focused/direct/structural | `node --test tests/shared/notification-types.test.ts tests/shared/redact-absolute-paths.test.ts tests/shared/notify.test.ts && npm run test:corresponding && npm run typecheck` | ❌ Wave 0: 4 planned | ⬜ pending |
| 06-13-01, 06-13-02 | 06-13 | 11 | TREF-07, TREF-09 | T-06-03, T-06-04 | Extract deterministic notification grammar and sorting leaves | focused/direct/structural | `node --test tests/shared/notification-grammar.test.ts tests/shared/compare-name-scope.test.ts tests/shared/notify.test.ts && npm run test:corresponding && npm run typecheck` | ❌ Wave 0: 4 planned | ⬜ pending |
| 06-14-01, 06-14-02 | 06-14 | 12 | TREF-07, TREF-09 | T-06-03, T-06-04 | Extract summary folding and notification dispatch after grammar stabilizes | focused/direct/structural | `node --test tests/shared/notification-summary.test.ts tests/shared/notification-dispatch.test.ts tests/shared/notify.test.ts tests/edge/notification-boundary.ts && npm run test:corresponding && npm run typecheck && npm run fallow` | ❌ Wave 0: 4 planned | ⬜ pending |
| 06-15-01, 06-15-02 | 06-15 | 13 | TREF-07, TREF-09 | T-06-03, T-06-04 | Repoint a bounded notification caller group to the six named owners | focused/direct/structural | `npm run typecheck && npm run fallow` | ✅ existing | ⬜ pending |
| 06-16-01, 06-16-02 | 06-16 | 14 | TREF-07, TREF-09 | T-06-03, T-06-04 | Repoint a bounded notification caller group to the six named owners | focused/direct/structural | `npm run typecheck && npm run fallow` | ✅ existing | ⬜ pending |
| 06-17-01, 06-17-02 | 06-17 | 13 | TREF-07, TREF-09 | T-06-03, T-06-04 | Repoint a bounded notification caller group to the six named owners | focused/direct/structural | `npm run typecheck && npm run fallow` | ✅ existing | ⬜ pending |
| 06-18-01, 06-18-02 | 06-18 | 14 | TREF-07, TREF-09 | T-06-03, T-06-04 | Repoint a bounded notification caller group to the six named owners | focused/direct/structural | `npm run typecheck && npm run fallow` | ✅ existing | ⬜ pending |
| 06-19-01, 06-19-02 | 06-19 | 13 | TREF-07, TREF-09 | T-06-03, T-06-04 | Continue bounded notification caller migration | focused/direct/structural | `npm run typecheck && npm run fallow` | ✅ existing | ⬜ pending |
| 06-20-01, 06-20-02 | 06-20 | 14 | TREF-07, TREF-09 | T-06-03, T-06-04 | Continue bounded notification caller migration | focused/direct/structural | `npm run typecheck && npm run fallow` | ✅ existing | ⬜ pending |
| 06-21-01, 06-21-02 | 06-21 | 13 | TREF-07, TREF-09 | T-06-03, T-06-04 | Continue bounded notification caller migration | focused/direct/structural | `npm run typecheck && npm run fallow` | ✅ existing | ⬜ pending |
| 06-22-01, 06-22-02 | 06-22 | 14 | TREF-07, TREF-09 | T-06-03, T-06-04 | Continue bounded notification caller migration | focused/direct/structural | `npm run typecheck && npm run fallow` | ✅ existing | ⬜ pending |
| 06-23-01, 06-23-02 | 06-23 | 15 | TREF-07, TREF-09 | T-06-03, T-06-04 | Continue bounded notification caller migration | focused/direct/structural | `npm run typecheck && npm run fallow` | ✅ existing | ⬜ pending |
| 06-24-01, 06-24-02 | 06-24 | 16 | TREF-07, TREF-09 | T-06-03, T-06-04 | Continue bounded notification caller migration | focused/direct/structural | `npm run typecheck && npm run fallow` | ✅ existing | ⬜ pending |
| 06-25-01, 06-25-02 | 06-25 | 17 | TREF-07, TREF-09 | T-06-03, T-06-04 | Continue bounded notification caller migration | focused/direct/structural | `npm run typecheck && npm run fallow` | ✅ existing | ⬜ pending |
| 06-26-01, 06-26-02 | 06-26 | 18 | TREF-07, TREF-09 | T-06-03, T-06-04 | Continue bounded notification caller migration | focused/direct/structural | `npm run typecheck && npm run fallow` | ✅ existing | ⬜ pending |
| 06-27-01, 06-27-02, 06-27-03 | 06-27 | 19 | TREF-07, TREF-09 | T-06-03, T-06-04, T-06-05 | Finalize notification ownership and delete the legacy hub/test | focused/direct/structural | `npm run typecheck && npm run test:corresponding && npm run fallow` | ❌ Wave 0: 1 planned | ⬜ pending |
| 06-28-01, 06-28-02 | 06-28 | 20 | TREF-07, TREF-09 | T-06-03, T-06-04 | Extract catalog test infrastructure only after notification stability | focused/direct/structural | `node --test tests/architecture/catalog-uat/catalog-parser.test.ts tests/architecture/catalog-uat.test.ts && npm run typecheck` | ❌ Wave 0: 4 planned | ⬜ pending |
| 06-29-01, 06-29-02 | 06-29 | 21 | TREF-07, TREF-09 | T-06-03, T-06-04 | Split five disjoint command-surface fixture slices | focused/direct/structural | `node --test tests/architecture/catalog-uat.test.ts tests/architecture/catalog-uat/catalog-parser.test.ts && npm run typecheck` | ❌ Wave 0: 5 planned | ⬜ pending |
| 06-30-01, 06-30-02 | 06-30 | 21 | TREF-07, TREF-09 | T-06-03, T-06-04 | Split five disjoint command-surface fixture slices | focused/direct/structural | `node --test tests/architecture/catalog-uat.test.ts tests/architecture/catalog-uat/catalog-parser.test.ts && npm run typecheck` | ❌ Wave 0: 5 planned | ⬜ pending |
| 06-31-01, 06-31-02 | 06-31 | 21 | TREF-07, TREF-09 | T-06-03, T-06-04 | Split five disjoint command-surface fixture slices | focused/direct/structural | `node --test tests/architecture/catalog-uat.test.ts tests/architecture/catalog-uat/catalog-parser.test.ts && npm run typecheck` | ❌ Wave 0: 5 planned | ⬜ pending |
| 06-32-01, 06-32-02 | 06-32 | 21 | TREF-07, TREF-09 | T-06-03, T-06-04 | Split five disjoint command-surface fixture slices | focused/direct/structural | `node --test tests/architecture/catalog-uat.test.ts tests/architecture/catalog-uat/catalog-parser.test.ts && npm run typecheck` | ❌ Wave 0: 5 planned | ⬜ pending |
| 06-33-01, 06-33-02, 06-33-03 | 06-33 | 22 | TREF-07, TREF-09 | T-06-03, T-06-04 | Assemble the final catalog contract and delete the legacy catalog hub | focused/direct/structural | `node --test tests/architecture/catalog-uat/catalog-parser.test.ts tests/architecture/catalog-uat/catalog-contract.test.ts && npm run typecheck && npm run fallow` | ❌ Wave 0: 2 planned | ⬜ pending |
| 06-34-01, 06-34-02 | 06-34 | 23 | TREF-07, TREF-09 | T-06-01, T-06-03, T-06-04 | Advance the install-family ownership move in locked command order | focused/direct/structural | `npm run typecheck && npm run test:corresponding && npm run fallow` | ❌ Wave 0: 4 planned | ⬜ pending |
| 06-35-01, 06-35-02 | 06-35 | 24 | TREF-07, TREF-09 | T-06-01, T-06-03, T-06-04 | Advance the install-family ownership move in locked command order | focused/direct/structural | `npm run typecheck && npm run test:corresponding && npm run fallow` | ❌ Wave 0: 4 planned | ⬜ pending |
| 06-36-01, 06-36-02 | 06-36 | 25 | TREF-07, TREF-09 | T-06-01, T-06-03, T-06-04 | Advance the install-family ownership move in locked command order | focused/direct/structural | `npm run typecheck && npm run test:corresponding && npm run fallow` | ❌ Wave 0: 2 planned | ⬜ pending |
| 06-37-01, 06-37-02 | 06-37 | 26 | TREF-07, TREF-09 | T-06-01, T-06-03, T-06-04 | Advance the install-family ownership move in locked command order | focused/direct/structural | `npm run typecheck && npm run test:corresponding && npm run fallow` | ✅ existing | ⬜ pending |
| 06-38-01, 06-38-02, 06-38-03 | 06-38 | 27 | TREF-07, TREF-09 | T-06-01, T-06-03, T-06-04 | Advance the install-family ownership move in locked command order | focused/direct/structural | `npm run typecheck && npm run test:corresponding && npm run fallow` | ❌ Wave 0: 1 planned | ⬜ pending |
| 06-39-01, 06-39-02 | 06-39 | 28 | TREF-07, TREF-09 | T-06-01, T-06-03, T-06-04 | Advance the update family in the locked command sequence | focused/direct/structural | `npm run typecheck && npm run test:corresponding && npm run fallow` | ❌ Wave 0: 4 planned | ⬜ pending |
| 06-40-01, 06-40-02 | 06-40 | 29 | TREF-07, TREF-09 | T-06-01, T-06-03, T-06-04 | Advance the update family in the locked command sequence | focused/direct/structural | `npm run typecheck && npm run test:corresponding && npm run fallow` | ❌ Wave 0: 4 planned | ⬜ pending |
| 06-41-01, 06-41-02 | 06-41 | 30 | TREF-07, TREF-09 | T-06-01, T-06-03, T-06-04 | Advance the update family in the locked command sequence | focused/direct/structural | `npm run typecheck && npm run test:corresponding && npm run fallow` | ✅ existing | ⬜ pending |
| 06-42-01, 06-42-02 | 06-42 | 31 | TREF-07, TREF-09 | T-06-01, T-06-03, T-06-04 | Advance the update family in the locked command sequence | focused/direct/structural | `npm run typecheck && npm run test:corresponding && npm run fallow` | ✅ existing | ⬜ pending |
| 06-43-01, 06-43-02, 06-43-03 | 06-43 | 32 | TREF-07, TREF-09 | T-06-01, T-06-03, T-06-04 | Advance the update family in the locked command sequence | focused/direct/structural | `npm run typecheck && npm run test:corresponding && npm run fallow` | ❌ Wave 0: 2 planned | ⬜ pending |
| 06-44-01, 06-44-02 | 06-44 | 33 | TREF-07, TREF-09 | T-06-01, T-06-03, T-06-04 | Advance reinstall in the locked command sequence | focused/direct/structural | `npm run typecheck && npm run test:corresponding && npm run fallow` | ❌ Wave 0: 5 planned | ⬜ pending |
| 06-45-01, 06-45-02 | 06-45 | 34 | TREF-07, TREF-09 | T-06-01, T-06-03, T-06-04 | Advance reinstall in the locked command sequence | focused/direct/structural | `npm run typecheck && npm run test:corresponding && npm run fallow` | ❌ Wave 0: 4 planned | ⬜ pending |
| 06-46-01, 06-46-02 | 06-46 | 35 | TREF-07, TREF-09 | T-06-01, T-06-03, T-06-04 | Advance reinstall in the locked command sequence | focused/direct/structural | `npm run typecheck && npm run test:corresponding && npm run fallow` | ❌ Wave 0: 3 planned | ⬜ pending |
| 06-47-01, 06-47-02 | 06-47 | 36 | TREF-07, TREF-09 | T-06-01, T-06-03, T-06-04 | Advance reinstall in the locked command sequence | focused/direct/structural | `npm run typecheck && npm run test:corresponding && npm run fallow` | ✅ existing | ⬜ pending |
| 06-48-01, 06-48-02, 06-48-03 | 06-48 | 37 | TREF-07, TREF-09 | T-06-01, T-06-03, T-06-04 | Advance reinstall in the locked command sequence | focused/direct/structural | `npm run typecheck && npm run test:corresponding && npm run fallow` | ❌ Wave 0: 2 planned | ⬜ pending |
| 06-49-01, 06-49-02 | 06-49 | 38 | TREF-07, TREF-09 | T-06-01, T-06-03, T-06-04 | Advance plugin list last in the locked command sequence | focused/direct/structural | `npm run typecheck && npm run test:corresponding && npm run fallow` | ❌ Wave 0: 4 planned | ⬜ pending |
| 06-50-01, 06-50-02 | 06-50 | 39 | TREF-07, TREF-09 | T-06-01, T-06-03, T-06-04 | Advance plugin list last in the locked command sequence | focused/direct/structural | `npm run typecheck && npm run test:corresponding && npm run fallow` | ❌ Wave 0: 4 planned | ⬜ pending |
| 06-51-01, 06-51-02, 06-51-03 | 06-51 | 40 | TREF-07, TREF-09 | T-06-01, T-06-03, T-06-04 | Advance plugin list last in the locked command sequence | focused/direct/structural | `npm run typecheck && npm run test:corresponding && npm run fallow` | ❌ Wave 0: 1 planned | ⬜ pending |
| 06-52-01, 06-52-02 | 06-52 | 41 | TREF-07, TREF-08, TREF-09 | T-06-01, T-06-02, T-06-03, T-06-04, T-06-05 | Close Phase 6 with cross-family structural and full-suite proof | focused/direct/structural | `npm run check` | ✅ existing | ⬜ pending |

The deterministic external-API detector returned `detected: true` only for internal MCP/domain-API vocabulary. `COVERAGE.md` records the reasoned no-external-integration decision; no capability matrix or schema task applies.

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Create each prescribed mirrored owner test in the same atomic task as its new production source; no orphan production file may exist between commits.
- [ ] Create `tests/architecture/catalog-uat/catalog-parser.test.ts` and `tests/architecture/catalog-uat/catalog-contract.test.ts` with the parser/driver split.
- [ ] Before moving tests, map every legacy test block to exactly one new owner or retained command-flow proof.
- [ ] Define reproducible commands for the exact end-state patch census: 2 excluded files / 18 `syncBuiltinESMExports(` calls and 2 excluded files / 2 `createRequire(` calls.
- [ ] Add a zero-reference stale-path scan to every final hub-deletion task.
- [ ] No framework installation or test-runner configuration is needed.

---

## Manual-Only Verifications

All Phase 6 behaviors have automated verification. Human review may inspect the ownership and four-part repointing ledgers, but those ledgers must also have reproducible stale-path, correspondence, direct-coverage, and completeness checks.

---

## Threat References

| Ref | Threat | Required mitigation |
|-----|--------|---------------------|
| T-06-01 | Resolver extraction weakens path traversal or symlink-escape handling | Preserve lexical containment, `lstat`/`readlink` inspection, exact error classes, and real-filesystem proofs |
| T-06-02 | Test prototype or builtin mutation masks race and ordering defects | Use case-owned state or the exact Phase 5 production ports; preserve public state/tree/output proof |
| T-06-03 | Notification extraction weakens closed-set input validation | Preserve TypeBox schemas, closed status/reason sets, and direct owner tests |
| T-06-04 | Notification extraction leaks absolute paths or permits direct-output bypass | Preserve the redaction leaf and repoint the single sanctioned dispatch exemption |
| T-06-05 | Compatibility seams or stale paths bypass the new ownership graph | Atomically migrate callers and delete old hubs; require zero stale references |

---

## Implementation Evidence

Every command below was run from the repository root on branch `features/refine-unit-tests` at
Phase 6 closure. Exit codes are recorded as observed, not narrated.

### 06-52-01 — Ownership, stale-path, catalog, and patch censuses

```console
$ npm run test:corresponding
Corresponding-test gate passed.
EXIT=0

$ npm run fallow
dead-code: No issues found (0.63s)
health:    Health score 78 B; 278,116 LOC; dead files 0.0%; dead exports 0.0%;
           avg cyclomatic 1.7; p90 cyclomatic 3; maintainability 92.0 (good)
dupes:     873 lines (1.1%) duplicated across 38 files, within the configured gate
EXIT=0

$ node scripts/check-phase-06-hub-ledger.mjs closure --owner-count 30 --catalog-fixture-count 20 --legacy-hubs extensions/pi-claude-marketplace/domain/resolver.ts,extensions/pi-claude-marketplace/shared/notify.ts,tests/architecture/catalog-uat.test.ts,extensions/pi-claude-marketplace/orchestrators/plugin/install.ts,extensions/pi-claude-marketplace/orchestrators/plugin/update.ts,extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts,extensions/pi-claude-marketplace/orchestrators/plugin/list.ts --sync-files 2 --sync-calls 18 --require-files 2 --require-calls 2 --roots extensions tests scripts docs eslint.config.js
Phase 6 closure: owner, fixture, legacy-hub, and residual censuses verified
EXIT=0
```

**Production owner pairs — 30/30.** `validateClosure` compares the tracked file set from
`git ls-files` against `OWNER_PAIRS` twice: once for the 30 production sources and once for the
30 mirrored owner tests at `tests/<production-relative-path>.test.ts`. A count other than 30, a
missing source, or a missing owner test is a hard error. `npm run test:corresponding` independently
proves each production module's owner test imports it directly rather than through a proxy.

**Seven retired hubs and their paired tests are absent.** `validateLegacyInventory` requires the
`--legacy-hubs` argument set to equal `LEGACY_HUBS` exactly and fails if any of the seven paths is
still tracked. All seven are gone: `domain/resolver.ts`, `shared/notify.ts`,
`tests/architecture/catalog-uat.test.ts`, and the `orchestrators/plugin/` `install.ts`, `update.ts`,
`reinstall.ts`, and `list.ts` hubs.

**Zero stale paths.** `git grep -F -c -- "<token>" -- extensions tests scripts docs eslint.config.js`
returns no matching file for any retired production or test path:

| Retired path token | Matching tracked files |
| --- | --- |
| `domain/resolver.ts` | 0 |
| `shared/notify.ts` | 0 |
| `orchestrators/plugin/install.ts` | 0 |
| `orchestrators/plugin/update.ts` | 0 |
| `orchestrators/plugin/reinstall.ts` | 0 |
| `orchestrators/plugin/list.ts` | 0 |
| `tests/architecture/catalog-uat.test.ts` | 0 |
| `tests/domain/resolver.test.ts` | 0 |
| `tests/shared/notify.test.ts` | 0 |
| `tests/orchestrators/plugin/install.test.ts` | 0 |
| `tests/orchestrators/plugin/update.test.ts` | 0 |
| `tests/orchestrators/plugin/reinstall.test.ts` | 0 |
| `tests/orchestrators/plugin/list.test.ts` | 0 |

**Catalog inverse completeness.** `tests/architecture/catalog-uat/` holds the parser
(`catalog-parser.ts`), its own owner test (`catalog-parser.test.ts`), the fixture model
(`fixture-types.ts`), the mock Pi surface (`mock-pi.ts`), the contract driver
(`catalog-contract.test.ts`), and exactly 20 fixture modules under `fixtures/`. The closure gate
asserts the fixture count is 20 and that each named fixture is tracked; the contract driver
inverse-walks both directions, so every catalog `(section, state)` block has exactly one fixture
and every fixture key has exactly one catalog block.

**Residual authorized patch census — exactly 2/18 and 2/2.** After removing the
`MF-DEC-01`-authorized patches, the only tracked files still using the shared-process tokens are
the two excluded residuals, `tests/bridges/skills/stage.test.ts` and
`tests/orchestrators/plugin/uninstall.test.ts`:

| Token | Files | Calls | Location breakdown |
| --- | --- | --- | --- |
| `syncBuiltinESMExports(` | 2 | 18 | `tests/bridges/skills/stage.test.ts` 16, `tests/orchestrators/plugin/uninstall.test.ts` 2 |
| `createRequire(` | 2 | 2 | `tests/bridges/skills/stage.test.ts` 1, `tests/orchestrators/plugin/uninstall.test.ts` 1 |

The census ignores `scripts/check-phase-06-hub-ledger.mjs`, which names both tokens only as the
literals it counts. `ER-F19` stays reserved for Phase 8 and is untouched here.

### 06-52-02 — Final integration gate (RED — seal withheld)

`npm run check` is the phase closure gate. It exits **1**. The seal is therefore withheld:
frontmatter stays `status: draft` and `nyquist_compliant: false`, and no row below is promoted to
green. The chain is `typecheck && lint && fallow && format:check && test:corresponding &&
test:corresponding:negative && test:coverage:direct:negative && test && test:integration`, so it
halts at the first red member; the members after `format:check` were run individually to establish
the complete state.

```console
$ npm run check
EXIT=1
```

| Chain member | Exit | Result |
| --- | --- | --- |
| `npm run typecheck` | 0 | clean, no diagnostics |
| `npm run lint` | 0 | clean, no warnings |
| `npm run fallow` | 0 | dead-code, health, and dupes all within their gates |
| `npm run format:check` | 1 | **RED** — halts the chain (finding F1) |
| `npm run test:corresponding` | 0 | `Corresponding-test gate passed.` |
| `npm run test:corresponding:negative` | 0 | `Corresponding-test negative controls passed.` |
| `npm run test:coverage:direct:negative` | 0 | `Direct-coverage negative controls passed.` |
| `npm test` | 1 | **RED** — 5881 tests, 5837 pass, 44 fail (findings F2, F3, F4) |
| `npm run test:integration` | 0 | 32 tests, 32 pass, 0 fail |

#### F1 — `format:check` fails on an untracked, unrelated file

```console
$ npm run format:check
Checking formatting...
[warn] .mcp.json
[warn] Code style issues found in the above file. Run Prettier with --write to fix.
EXIT=1
```

`format:check` globs `**/*.{js,json,ts}`, which prettier resolves from the filesystem rather than
from the git index, so an untracked working-tree file enters the gate. `.mcp.json` is untracked, is
not part of any Phase 6 deliverable, and is the only file reported. No tracked source or test file
is unformatted.

#### F2 — Two architecture gates still read deleted Phase 6 hubs

Both failures are `ENOENT` at read time, not assertion failures. Each gate resolves its target from
composed path segments, so the token-level stale-path scan in 06-52-01 could not see them: the
literals `orchestrators/plugin/install.ts` and `orchestrators/plugin/reinstall.ts` never appear in
either file.

```console
test at tests/architecture/hooks-lifecycle.test.ts:185:1
✖ WR-03 Block C: reinstall.ts wires remove + add + rebuildRoutingTables in its per-plugin lock
  [Error: ENOENT: no such file or directory, open
  '<repo>/extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts']

test at tests/architecture/import-boundaries.test.ts:251:1
✖ D-11: no orchestrators/plugin LEDGER imports a marketplace ledger module
  [Error: ENOENT: no such file or directory, open
  '<repo>/extensions/pi-claude-marketplace/orchestrators/plugin/install.ts']
```

- `tests/architecture/hooks-lifecycle.test.ts:55` — `REINSTALL_PATH = path.join(ORCH_DIR, "reinstall.ts")`, read at line 186. The reinstall hub was retired in Plan 06-48; the gate was not repointed to `reinstall-flow.ts`.
- `tests/architecture/import-boundaries.test.ts:211` — `PLUGIN_LEDGERS = ["install", "update", "uninstall", "reinstall", "enable-disable"]`, each read as `${ORCHESTRATORS_REL}/plugin/${name}.ts` at line 254. `install.ts`, `update.ts`, and `reinstall.ts` were retired in Plans 06-38, 06-43, and 06-48; only `uninstall.ts` and `enable-disable.ts` still exist. The gate's own comment states the intent — "A renamed or deleted ledger must fail loudly rather than silently uncovering this direction of the gate" — so this red is the gate working as designed and reporting an incomplete four-part repoint, not a false alarm.

This is a real gap in the `Four-Part Repointing Gate` evidence for the install, update, and reinstall families: the *source-scanning gate* category was satisfied by a literal-token scan, and a gate that composes its path escapes that scan.

#### F3 — Sealed requirement-route contract disagrees with REQUIREMENTS.md

42 of the 44 failures come from `tests/architecture/revalidation.test.ts`, all with the same root
cause. `scripts/revalidation.mjs` seals `TREF-04` through `TREF-09` as
`{ route: "Phase N", status: "Pending" }` (lines 126-131), while the `.planning/REQUIREMENTS.md`
traceability table (lines 170-175) now reads `Complete` for all six.

```console
$ node --test tests/architecture/revalidation.test.ts
✖ RVAL-04 scope-impact checks all live planning-contract records
  actual:   status 1, stderr:
    requirement-route-contract: TREF-04: traceability route/status differs from sealed requirement contract
    requirement-route-contract: TREF-05: traceability route/status differs from sealed requirement contract
    requirement-route-contract: TREF-06: traceability route/status differs from sealed requirement contract
    requirement-route-contract: TREF-07: traceability route/status differs from sealed requirement contract
    requirement-route-contract: TREF-08: traceability route/status differs from sealed requirement contract
    requirement-route-contract: TREF-09: traceability route/status differs from sealed requirement contract
  expected: status 0, stdout: 'Scope impact valid: 40 records.\n'
```

The remaining 41 revalidation failures are the planted-offender cases: each expects only its own
planted error on stderr and now also receives these six contract lines.

**This drift predates Phase 6.** `git log -S` places the first `TREF-04 | Phase 5 | Complete` row at
`5c47f436 docs(phase-05): close verified ownership phase`, so `npm test` has been red since Phase 5
closed. Phase 6 extended the same drift to `TREF-07`, `TREF-08`, and `TREF-09` when its own plans
marked those requirements complete. No Phase 6 plan ran the full suite, so the pre-existing red went
unobserved for 51 plans — a sampling gap this validation contract's per-wave rate did not close.

#### Closure status

`npm run check` does not exit zero, so the Plan 06-52 acceptance criterion is unmet and the
sign-off below stays unchecked. F2 is Phase 6 work left incomplete. F1 and F3 are outside the Phase 6
boundary: F1 is an untracked working-tree file, and F3 is a planning-artifact contract sealed before
this phase. All three are reported for a separately-scoped decision rather than repaired inside this
validation plan, which is authorized to modify this file only.

## Validation Sign-Off

- [ ] Every final task has an `<automated>` command or creates its paired test in the same task.
- [ ] Every runnable `<automated>` command has an adjacent observable `<fails_when>` condition.
- [ ] Sampling continuity: no three consecutive tasks lack an automated verification command.
- [ ] Wave 0 creates every missing owner pair and catalog test before it is used as evidence.
- [ ] No watch-mode flags are present.
- [ ] Focused feedback latency remains below 30 seconds.
- [ ] Every new production source passes direct-pair coverage.
- [ ] Every final hub deletion passes its zero-stale-path and four-part repointing checks.
- [ ] `npm run check` and the exact residual patch census pass at closure.
- [ ] `nyquist_compliant: true` is set only after all rows map to final task IDs and pass.

**Approval:** pending
