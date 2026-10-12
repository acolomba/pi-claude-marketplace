---
phase: "8"
slug: "address-tech-debt-ledger-dispositions-and-advisory"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: validated
nyquist_compliant: true
wave_0_complete: true
created: "2026-10-10"
---

# Phase 8 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `node:test` (built-in), Node v26.11.1 locally, Node 24 in CI |
| **Config file** | none; scripts in `package.json` |
| **Quick run command** | `node --test --test-reporter=tap tests/integration/skill-path-resolution.test.ts tests/integration/provenance-invisibility.test.ts` |
| **Full suite command** | `npm run check` (unpiped) |
| **Estimated runtime** | ~75 seconds locally for `npm run check`; seconds for the quick command |

---

## Sampling Rate

- **After every task commit:** Run the task's quick command from 08-RESEARCH.md §Validation Architecture, then `SKIP=npm-check pre-commit run --files <literal paths>` before `git commit` (the hook runs `check:commit`; staging `package-lock.json` escalates it to every direct-coverage pair)
- **After every plan wave:** Run `npm run check` (sequential execution in this checkout; run it after the last task of each plan)
- **Before `/gsd-verify-work`:** Full suite must be green, plus every SC row in 08-RESEARCH.md §Phase Requirements → Test Map, plus `npx fallow audit --base <BASE>`
- **Max feedback latency:** 180 seconds target for the per-task commands; `npm run check` is the gate, not the feedback loop

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 08-01-01 | 01 | 1 | SC-3 (D-07, D-08) | T-08-01, T-08-SC | Rehearsed lock change is exactly 3 lines, carries the registry integrity, leaves the checkout untouched | lock rehearsal | Rehearsal in `${TMPDIR:-/tmp}/gsd-08-01-lock-rehearsal`, `git diff --no-index --numstat` read by awk, node lock/audit check, integrity vs `npm view brace-expansion@5.0.12 dist.integrity`, `git diff --exit-code -- package.json package-lock.json` | ✅ | ✅ green |
| 08-01-02 | 01 | 1 | SC-3 (D-07) | T-08-SC | A human approves the artifact before the real lock changes | checkpoint (blocking-human) | none: the human compares the 08-01-01 evidence block with the expected facts | n/a | ✅ green |
| 08-01-03 | 01 | 1 | SC-3 (D-07, D-08, D-10, D-12) | T-08-01, T-08-02 | Root 5.0.12 with registry integrity; the Pi-nested 5.0.9 copy is the only audit path; fixture and workflows untouched | lock + audit + gate | `git diff --numstat a876e321 -- package-lock.json` read by awk (3/3), `git diff --exit-code a876e321 -- package.json tests/e2e/pi-peer-floor/ .github/workflows/`, `npm audit --package-lock-only --json` node check, lock-only commit check, `npm run check` | ✅ | ✅ green |
| 08-02-01 | 02 | 2 | SC-2 (D-06) | T-08-04 | Peer lookup runs before the HOME swap; every write stays hermetic | integration | `node --test --test-reporter=tap tests/integration/skill-path-resolution.test.ts` with exact `# pass 1` and `# skipped 0`, node source-order check against a876e321 | ✅ | ✅ green |
| 08-02-02 | 02 | 2 | SC-2 (D-06) | T-08-04, T-08-05 | Peer present: both cases run; peer absent (CI path): both skip | integration + gate | Both files: `# pass 2` and `# skipped 0`; with `PI_SUBAGENTS_ROOT=/nonexistent`: `# skipped 2` and `# fail 0`; node source-order check; `git diff --exit-code a876e321 -- .github/workflows/`; `npm run check` | ✅ | ✅ green |
| 08-03-01 | 03 | 3 | SC-4 (D-03, D-09) | T-08-06 | Records state the residual and never claim npm audit passes | record content | Node section check over BACKLOG.md (headings once, last two, required facts), node check over deferred-items.md, BACKLOG.md numstat 0 deleted lines, `git diff --exit-code a876e321 -- .planning/WINDOWS.md` | ✅ | ✅ green |
| 08-03-02 | 03 | 3 | SC-5 (D-11, D-12) | T-08-07 | 01 stays false with its box unticked; 03 reads true | record content | Node line check (01 line 7 false, 03 line 7 true, 01 line 124 unticked), numstat 1/1 per file, planning-only reuse proof against the 08-02-02 commit | ✅ | ✅ green |
| 08-04-01 | 04 | 4 | SC-1 (D-01 to D-06) | T-08-08 | Full batch proven on a ledger copy; reasons stored verbatim; retry is a no-op | ledger dry run | Script on a copy twice (`applied=0 skipped=25` on the second run), SC-1 node check via `--cwd`, `git diff --exit-code -- .planning/WINDOWS.md`, D-02 and D-05 evidence checks | ✅ | ✅ green |
| 08-04-02 | 04 | 4 | SC-1 (D-03, D-04, D-06) | T-08-08, T-08-09, T-08-10 | Real ledger reads 0 open with complete reasons | ledger | SC-1 node check on the real ledger, `windows status --pick ledger.open_count` equals 0, WINDOWS.md-only commit check, `node --test tests/orchestrators/marketplace/update.test.ts` | ✅ | ✅ green |
| 08-04-03 | 04 | 4 | SC-1 to SC-5 (D-12) | T-08-11 | Phase gate on the final tree | gate | `npm run check`, `npx fallow audit --base a876e321 --format json --quiet` verdict pass, no added suppression marker outside `.planning/`, unchanged-path diff (production, catalog, corpus, package.json, fixture, workflows, 01-06 verification reports), SC-2/SC-3/SC-4/SC-5 re-checks, open count 0 | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements. No new test file, fixture, or framework install is needed (08-RESEARCH.md §Wave 0 Gaps).

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| The waiver reasons name the right retiring commit or carrier for each entry | SC-1 | Reason content is prose; the automated row checks prefix, status, and the commit/carrier tokens, not the sentence | Read `gsd-tools windows status` output for 32-34, 41-58, 84, 88 against 08-CONTEXT.md D-01, D-03, D-05 |
| `brace-expansion@5.0.12` is the legitimate registry artifact | SC-3 | The package-legitimacy check rates the version `SUS` only for being 26 days old; a human confirms the integrity hash matches `npm view brace-expansion@5.0.12 dist.integrity` (08-RESEARCH.md §Package Legitimacy Audit) | Checkpoint 08-01-02 (blocking-human) shows the evidence block from 08-01-01; compare the lock's `integrity` for `node_modules/brace-expansion` with the registry value before the real lock changes |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 180s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-10-10 (validate-phase audit: 0 gaps; every automated row passed in its plan's SUMMARY coverage block, 21/21 `status: pass`; the 08-01-02 checkpoint was approved by the user)

## Validation Audit 2026-10-10

| Metric | Count |
|---|---|
| Gaps found | 0 |
| Resolved | 0 |
| Escalated | 0 |
