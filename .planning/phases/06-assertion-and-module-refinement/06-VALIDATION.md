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
| planner-assigned | assertions | 1 | TREF-07 | T-06-04 | Final output preserves redaction and the producer-selected cardinality/tally contract | owner unit + command proof | `node --test tests/orchestrators/marketplace/autoupdate.test.ts tests/orchestrators/marketplace/list.test.ts tests/orchestrators/plugin/list.test.ts tests/orchestrators/plugin/install.test.ts tests/orchestrators/plugin/update.test.ts tests/orchestrators/plugin/reinstall.test.ts` | ✅ current owners | ⬜ pending |
| planner-assigned | patch-removal | 2 | TREF-08 | T-06-02, T-06-05 | Tests use case-owned state or an authorized narrow production port and retain public outcome proof | owner unit + static census | `npm run typecheck && npm run lint && npm run fallow` plus the plan's exact residual-patch census | ✅ current owners; census command is plan-owned | ⬜ pending |
| planner-assigned | resolver/notify leaves | 3–4 | TREF-09 | T-06-01, T-06-03, T-06-04 | Input validation, path safety, closed vocabularies, redaction, and sanctioned dispatch remain owned and directly tested | direct owner pair + architecture | `npm run test:corresponding && npm run test:coverage:direct -- <each-new-source>` | ❌ Wave 0 owner pairs | ⬜ pending |
| planner-assigned | catalog | 5 | TREF-07, TREF-09 | The catalog independently verifies exact documented bytes and never supplies owner-test expectations | parser + fixture + driver architecture tests | `node --test tests/architecture/catalog-uat/catalog-parser.test.ts tests/architecture/catalog-uat/catalog-contract.test.ts` | ❌ Wave 0 | ⬜ pending |
| planner-assigned | command flows | 6–9 | TREF-07, TREF-09 | Install, update, reinstall, and list preserve transaction, state, path, and notification contracts after ownership moves | direct owner pair + end-to-end command proof | `npm run test:corresponding && npm run test:coverage:direct -- <each-new-source> && node --test <affected-command-flow-proof>` | ❌ Wave 0 leaf owners; ✅ current flow proofs | ⬜ pending |
| planner-assigned | closure | final | TREF-07, TREF-08, TREF-09 | No bypass, stale old path, shared-process surgery outside exclusions, or unowned production module remains | full integration + static manifests | `npm run check` plus exact patch and stale-path scans from the plans | ✅ suite; manifests are plan-owned | ⬜ pending |

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
