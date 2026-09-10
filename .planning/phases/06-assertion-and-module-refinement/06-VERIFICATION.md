---
phase: 06-assertion-and-module-refinement
verified: 2026-09-09T22:45:00Z
status: gaps_found
score: 4/5 must-haves verified
re_verification:
  previous_status: "passed"
  previous_score: 5/5
  downgrade_reason: "An independent contract-weakening review of the seven-family split surfaced 12 findings the original sampling missed: 1 critical, 2 high, 9 important. The Contracts-Not-Weakened must-have is therefore not met."
covered_files: [".planning/REQUIREMENTS.md",".planning/phases/06-assertion-and-module-refinement/06-01-PLAN.md",".planning/phases/06-assertion-and-module-refinement/06-01-SUMMARY.md",".planning/phases/06-assertion-and-module-refinement/06-02-PLAN.md",".planning/phases/06-assertion-and-module-refinement/06-02-SUMMARY.md",".planning/phases/06-assertion-and-module-refinement/06-03-PLAN.md",".planning/phases/06-assertion-and-module-refinement/06-03-SUMMARY.md",".planning/phases/06-assertion-and-module-refinement/06-04-PLAN.md",".planning/phases/06-assertion-and-module-refinement/06-04-SUMMARY.md",".planning/phases/06-assertion-and-module-refinement/06-05-PLAN.md",".planning/phases/06-assertion-and-module-refinement/06-05-SUMMARY.md",".planning/phases/06-assertion-and-module-refinement/06-06-PLAN.md",".planning/phases/06-assertion-and-module-refinement/06-06-SUMMARY.md",".planning/phases/06-assertion-and-module-refinement/06-07-PLAN.md",".planning/phases/06-assertion-and-module-refinement/06-07-SUMMARY.md",".planning/phases/06-assertion-and-module-refinement/06-08-PLAN.md",".planning/phases/06-assertion-and-module-refinement/06-08-SUMMARY.md",".planning/phases/06-assertion-and-module-refinement/06-09-PLAN.md",".planning/phases/06-assertion-and-module-refinement/06-09-SUMMARY.md",".planning/phases/06-assertion-and-module-refinement/06-10-PLAN.md",".planning/phases/06-assertion-and-module-refinement/06-10-SUMMARY.md",".planning/phases/06-assertion-and-module-refinement/06-11-PLAN.md",".planning/phases/06-assertion-and-module-refinement/06-11-SUMMARY.md",".planning/phases/06-assertion-and-module-refinement/06-12-PLAN.md",".planning/phases/06-assertion-and-module-refinement/06-12-SUMMARY.md",".planning/phases/06-assertion-and-module-refinement/06-13-PLAN.md",".planning/phases/06-assertion-and-module-refinement/06-13-SUMMARY.md",".planning/phases/06-assertion-and-module-refinement/06-14-PLAN.md",".planning/phases/06-assertion-and-module-refinement/06-14-SUMMARY.md",".planning/phases/06-assertion-and-module-refinement/06-15-PLAN.md",".planning/phases/06-assertion-and-module-refinement/06-15-SUMMARY.md",".planning/phases/06-assertion-and-module-refinement/06-16-PLAN.md",".planning/phases/06-assertion-and-module-refinement/06-16-SUMMARY.md",".planning/phases/06-assertion-and-module-refinement/06-17-PLAN.md",".planning/phases/06-assertion-and-module-refinement/06-17-SUMMARY.md",".planning/phases/06-assertion-and-module-refinement/06-18-PLAN.md",".planning/phases/06-assertion-and-module-refinement/06-18-SUMMARY.md",".planning/phases/06-assertion-and-module-refinement/06-19-PLAN.md",".planning/phases/06-assertion-and-module-refinement/06-19-SUMMARY.md",".planning/phases/06-assertion-and-module-refinement/06-20-PLAN.md",".planning/phases/06-assertion-and-module-refinement/06-20-SUMMARY.md",".planning/phases/06-assertion-and-module-refinement/06-21-PLAN.md",".planning/phases/06-assertion-and-module-refinement/06-21-SUMMARY.md",".planning/phases/06-assertion-and-module-refinement/06-22-PLAN.md",".planning/phases/06-assertion-and-module-refinement/06-22-SUMMARY.md",".planning/phases/06-assertion-and-module-refinement/06-23-PLAN.md",".planning/phases/06-assertion-and-module-refinement/06-23-SUMMARY.md",".planning/phases/06-assertion-and-module-refinement/06-24-PLAN.md",".planning/phases/06-assertion-and-module-refinement/06-24-SUMMARY.md",".planning/phases/06-assertion-and-module-refinement/06-25-PLAN.md",".planning/phases/06-assertion-and-module-refinement/06-25-SUMMARY.md",".planning/phases/06-assertion-and-module-refinement/06-26-PLAN.md",".planning/phases/06-assertion-and-module-refinement/06-26-SUMMARY.md",".planning/phases/06-assertion-and-module-refinement/06-27-PLAN.md",".planning/phases/06-assertion-and-module-refinement/06-27-SUMMARY.md",".planning/phases/06-assertion-and-module-refinement/06-28-PLAN.md",".planning/phases/06-assertion-and-module-refinement/06-28-SUMMARY.md",".planning/phases/06-assertion-and-module-refinement/06-29-PLAN.md",".planning/phases/06-assertion-and-module-refinement/06-29-SUMMARY.md",".planning/phases/06-assertion-and-module-refinement/06-30-PLAN.md",".planning/phases/06-assertion-and-module-refinement/06-30-SUMMARY.md",".planning/phases/06-assertion-and-module-refinement/06-31-PLAN.md",".planning/phases/06-assertion-and-module-refinement/06-31-SUMMARY.md",".planning/phases/06-assertion-and-module-refinement/06-32-PLAN.md",".planning/phases/06-assertion-and-module-refinement/06-32-SUMMARY.md",".planning/phases/06-assertion-and-module-refinement/06-33-PLAN.md",".planning/phases/06-assertion-and-module-refinement/06-33-SUMMARY.md",".planning/phases/06-assertion-and-module-refinement/06-34-PLAN.md",".planning/phases/06-assertion-and-module-refinement/06-34-SUMMARY.md",".planning/phases/06-assertion-and-module-refinement/06-35-PLAN.md",".planning/phases/06-assertion-and-module-refinement/06-35-SUMMARY.md",".planning/phases/06-assertion-and-module-refinement/06-36-PLAN.md",".planning/phases/06-assertion-and-module-refinement/06-36-SUMMARY.md",".planning/phases/06-assertion-and-module-refinement/06-37-PLAN.md",".planning/phases/06-assertion-and-module-refinement/06-37-SUMMARY.md",".planning/phases/06-assertion-and-module-refinement/06-38-PLAN.md",".planning/phases/06-assertion-and-module-refinement/06-38-SUMMARY.md",".planning/phases/06-assertion-and-module-refinement/06-39-PLAN.md",".planning/phases/06-assertion-and-module-refinement/06-39-SUMMARY.md",".planning/phases/06-assertion-and-module-refinement/06-40-PLAN.md",".planning/phases/06-assertion-and-module-refinement/06-40-SUMMARY.md",".planning/phases/06-assertion-and-module-refinement/06-41-PLAN.md",".planning/phases/06-assertion-and-module-refinement/06-41-SUMMARY.md",".planning/phases/06-assertion-and-module-refinement/06-42-PLAN.md",".planning/phases/06-assertion-and-module-refinement/06-42-SUMMARY.md",".planning/phases/06-assertion-and-module-refinement/06-43-PLAN.md",".planning/phases/06-assertion-and-module-refinement/06-43-SUMMARY.md",".planning/phases/06-assertion-and-module-refinement/06-44-PLAN.md",".planning/phases/06-assertion-and-module-refinement/06-44-SUMMARY.md",".planning/phases/06-assertion-and-module-refinement/06-45-PLAN.md",".planning/phases/06-assertion-and-module-refinement/06-45-SUMMARY.md",".planning/phases/06-assertion-and-module-refinement/06-46-PLAN.md",".planning/phases/06-assertion-and-module-refinement/06-46-SUMMARY.md",".planning/phases/06-assertion-and-module-refinement/06-47-PLAN.md",".planning/phases/06-assertion-and-module-refinement/06-47-SUMMARY.md",".planning/phases/06-assertion-and-module-refinement/06-48-PLAN.md",".planning/phases/06-assertion-and-module-refinement/06-48-SUMMARY.md",".planning/phases/06-assertion-and-module-refinement/06-49-PLAN.md",".planning/phases/06-assertion-and-module-refinement/06-49-SUMMARY.md",".planning/phases/06-assertion-and-module-refinement/06-50-PLAN.md",".planning/phases/06-assertion-and-module-refinement/06-50-SUMMARY.md",".planning/phases/06-assertion-and-module-refinement/06-51-PLAN.md",".planning/phases/06-assertion-and-module-refinement/06-51-SUMMARY.md",".planning/phases/06-assertion-and-module-refinement/06-52-PLAN.md",".planning/phases/06-assertion-and-module-refinement/06-52-SUMMARY.md",".planning/phases/06-assertion-and-module-refinement/06-CONTEXT.md",".planning/phases/06-assertion-and-module-refinement/06-VALIDATION.md"]
covered_digest: "v1:sha256:48cf17cc45d03930e5974177af9e05d0befd735ac73c1b8deead9d1693fbef18"
behavior_unverified: 0
overrides_applied: 0
---

# Phase 6: Assertion and Module Refinement Verification Report

**Phase Goal:** Strengthen assertions and simplify confirmed problem modules without weakening contracts.
**Verified:** 2026-09-09T22:45:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Exact output/cardinality, shared-process isolation, 30 production owner pairs, catalog completeness, and seven hub deletions hold together under the full repository gate | ✓ VERIFIED | Re-ran `node scripts/check-phase-06-hub-ledger.mjs closure ...` directly — exit 0. Independently confirmed all 7 legacy hubs absent from disk/git-index. Independently re-ran the two architecture gates that were previously red (F2) and the revalidation suite (F3) — all pass. `npm run check` recorded green at commit `eacfe55c` (HEAD); this commit is confirmed to be the actual current HEAD via `git log -1`. |
| 2 | The authorized patch census remains exactly 2 files/18 `syncBuiltinESMExports` calls and 2 files/2 `createRequire` calls | ✓ VERIFIED | Independently ran `git grep -F -c "syncBuiltinESMExports(" -- extensions tests scripts docs eslint.config.js` and the `createRequire(` equivalent — results match exactly: `tests/bridges/skills/stage.test.ts` (16/1) and `tests/orchestrators/plugin/uninstall.test.ts` (2/1), both explicitly excluded per D-06 carried-forward constraints. |
| 3 (ROADMAP SC1) | Observable assertions use complete exact outcomes, including structural single/plural cardinality and visible plural tallies, while documented caveats remain protected | ✓ VERIFIED | Sampled 06-01-SUMMARY.md (the assertion-strengthening plan): owner-local exact-byte constants, strict notification doubles, zero/one/many cardinality cases. Spot-checked `.includes()` usage across touched test files — used only for negative/absence assertions or export-name checks, never as a substitute for a prior exact/byte comparison. |
| 4 (ROADMAP SC2) | Global prototype and builtin-module patches and dishonest dense-index cases are removed through real case-owned state or narrow production-owned ports, with no ignore pragma or test-only export | ✓ VERIFIED | Patch census (Truth 2) confirms only the two D-06-authorized residual files remain; `ER-F19`/stage.test.ts exclusion is honored per CONTEXT.md D-06 constraints, correctly deferred to Phase 8. |
| 5 (ROADMAP SC3) | The approved resolver, notify, install, update, reinstall, list, and catalog splits land at named seams with paired tests, one end-to-end proof per flow, and gate/documentation/ownership/completeness repointing; uninstall and the deferred info split remain out | ✓ VERIFIED | All 7 legacy hubs confirmed absent from disk and git index. 30/30 owner pairs and 20/20 catalog fixtures confirmed via the hub-ledger script and direct `ls`. Grepped for stale imports of deleted `domain/resolver`/`shared/notify` paths — zero matches. Grepped for forwarding/re-export facades in new split modules — none found; `orchestrators/reconcile/notify.ts` (a hit on "notify") predates Phase 6 (git log shows it existing since PR #70/#60/#51) and is unrelated to the `shared/notify.ts` split. `uninstall.ts` and `info.ts` untouched, confirming exclusion boundary honored. |

**Score:** 4/5 truths verified — see the downgrade note below.

### Contracts-Not-Weakened Check (phase's central risk) — NOT MET

> **Downgraded after this report was first written.** The sampling below was sound as far as it
> went, but it asked whether hubs were absent and whether corpora moved. Both were true. It did not
> compare pre- and post-split assertions case by case. A dedicated six-reviewer audit of the
> contract-weakening surface then found 12 places where contracts WERE weakened — 1 critical, 2
> high, 9 important — enumerated under Gaps Summary. This must-have is therefore not met, and the
> phase status is `gaps_found`.
>
> The systematic cause is worth stating once: **sequence and invocation-count assertions did not
> survive the moves; end-state assertions did.** End-state assertions are order-insensitive, so a
> rollback that unwinds forward instead of in reverse leaves every byte identical and the suite
> green. That is why `npm run check` passes at 5881/5881 with these holes open, and why sampling
> hub-absence and corpus-size could not see them.

Original sampling, retained for the record — the five plans that retired a legacy hub (06-38
install, 06-43 update, 06-48 reinstall, 06-50/06-51 list) plus 06-01 (assertion strengthening):

- Every hub retirement explicitly states "no forwarding facade" / "vacated without a compatibility re-export" in its key-decisions, and this was independently confirmed by grep (no stale imports, no re-export shims).
- Where legacy test corpora were large (06-50: 90 branches in list), the full corpus was moved intact rather than reduced to a single flow proof — the summary explicitly calls out this as an authorized scope expansion to avoid weakening coverage.
- 06-51 caught and fixed its own gap: the generic hub-ledger checker fixture was left pointing at a rotating live pair instead of enforcing the final exact seven-hub set — self-corrected before phase closure, not left as a latent hole.
- No `TBD`/`FIXME`/`XXX` debt markers found in the new split modules (domain, shared, orchestrators/plugin). One `TODO`/`PLACEHOLDER`-pattern hit in `update-flow.ts` is a legitimate constant name (`SYNTHETIC_UPDATE_PLACEHOLDER_NAME`), not a debt marker.

No evidence of weakened contracts was found.

### D-06-01..D-06-14 Decision Compliance

| Decision | Honored | Evidence |
|---|---|---|
| D-06-11/D-06-12/D-06-13 (no forwarding seams, atomic migration, delete original) | Yes | All 7 hubs deleted atomically with their callers migrated; zero re-export/facade files found. |
| D-06-14 (stale-path scan must return zero before deletion) | Yes | Confirmed 0 matches for all 13 retired-path tokens (both via VALIDATION.md's recorded evidence and this verification's independent re-run of the ledger script). |
| D-06-03..D-06-06 (exact-byte, strict-double assertions) | Yes | Confirmed in 06-01-SUMMARY.md and spot-checked test files. |
| Carried-forward constraint (stage.test.ts / uninstall.test.ts excluded, ER-F19 deferred) | Yes | Patch census matches exactly; both files untouched by this phase. |

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `.planning/phases/06-assertion-and-module-refinement/06-VALIDATION.md` | Sealed validation evidence | ✓ VERIFIED | `status: validated`, `nyquist_compliant: true`; contains both the red run (F1/F2/F3) and the green re-run, with two carried-forward conditions named. |
| Seven legacy hubs (resolver.ts, notify.ts, catalog-uat.test.ts, install.ts, update.ts, reinstall.ts, list.ts) | Absent from disk and git index | ✓ VERIFIED | Confirmed via direct filesystem check and `git ls-files` grep — zero hits. |
| 30 production owner pairs | Present, 1:1 mirrored | ✓ VERIFIED | `check-phase-06-hub-ledger.mjs closure --owner-count 30` exits 0; spot-checked install/update/reinstall/list families by directory listing. |
| 20 catalog fixture modules | Present under `tests/architecture/catalog-uat/fixtures/` | ✓ VERIFIED | `ls` confirms exactly 20 files. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| All family ledgers | Structural gates | `npm run check` | ✓ WIRED | `test:corresponding`, `fallow`, `check-phase-06-hub-ledger.mjs closure`, `hooks-lifecycle.test.ts`, `import-boundaries.test.ts`, `revalidation.test.ts` all independently re-run and green at HEAD (`eacfe55c`). |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Hub-ledger closure census | `node scripts/check-phase-06-hub-ledger.mjs closure --owner-count 30 --catalog-fixture-count 20 --sync-files 2 --sync-calls 18 --require-files 2 --require-calls 2 ...` | `Phase 6 closure: owner, fixture, legacy-hub, and residual censuses verified`, exit 0 | ✓ PASS |
| Corresponding-test gate | `npm run test:corresponding` | `Corresponding-test gate passed.`, exit 0 | ✓ PASS |
| Fallow (dead-code/health/dupes) | `npm run fallow` | health 78 B, dupes within gate, exit 0 | ✓ PASS |
| F2 repair — hooks-lifecycle | `node --test tests/architecture/hooks-lifecycle.test.ts` | 7/7 pass, `reinstall-flow.ts` correctly referenced | ✓ PASS |
| F2 repair — import-boundaries D-11 | `node --test tests/architecture/import-boundaries.test.ts` | 6/6 pass, `PLUGIN_LEDGERS` uses `install-flow`/`update-flow`/`reinstall-flow` | ✓ PASS |
| F3 repair — revalidation contract | `node --test tests/architecture/revalidation.test.ts` | 136/136 pass | ✓ PASS |
| Residual patch census | `git grep -F -c "syncBuiltinESMExports("` / `"createRequire("` | matches VALIDATION.md's 2/18 and 2/2 exactly | ✓ PASS |

`npm run check` itself was not re-run in full per the task's explicit instruction (already recorded green at HEAD `eacfe55c`, ~15 min runtime); every gate that was previously red (F1/F2/F3) was individually re-verified instead, which is the only actionable regression risk.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| TREF-07 | 06-01, 06-12–06-52 (multiple) | Exact-outcome observable assertions | ✓ SATISFIED (evidence supports flip to Complete) | Truth 3 above |
| TREF-08 | 06-02–06-04, 06-52 | Global-patch removal | ✓ SATISFIED (evidence supports flip to Complete) | Truth 4 above; census matches exactly |
| TREF-09 | 06-05–06-52 (multiple) | Seven-family split with named seams | ✓ SATISFIED (evidence supports flip to Complete) | Truth 5 above |

No orphaned requirements: `.planning/REQUIREMENTS.md`'s traceability table maps exactly TREF-07/08/09 to Phase 6, and all three appear in plan frontmatter `requirements:` fields.

**On the Pending status in REQUIREMENTS.md / scripts/revalidation.mjs:** this is intentional and correct as found — `RVAL-04` enforces that the sealed requirement-route contract and the traceability table agree, and both currently read `Pending` for TREF-07/08/09 pending this verification. This verification's PASS result is the authorization to flip both to `Complete`. See recommendation below.

### Anti-Patterns Found

None found in the phase-touched production modules (domain/, shared/notification-*, shared/notify-*, shared/redact-absolute-paths.ts, orchestrators/plugin/*). No `TBD`/`FIXME`/`XXX`; the one `PLACEHOLDER`-pattern grep hit is a legitimate constant name, not a stub.

### Human Verification Required

None. All must-haves resolved to VERIFIED via direct, independently re-run evidence (not SUMMARY.md narrative alone).

### Gaps Summary — 12 findings

Each was independently confirmed by grep or by reading both the pre-split and post-split bodies;
none is a relayed claim. Severity is the reviewing agent's, retained.

| # | Sev | Location | Contract lost |
|---|---|---|---|
| G1 | **critical** | `tests/orchestrators/plugin/install-flow.test.ts:7529` | Test renamed "cleanup **leaks**" -> "cleanup **warnings**"; the `rm` fault injection, the `[0,1,2]` skills->commands->agents ordering proof, the 4-element interleaved warning array, and the leaked-residue partition were all deleted. Body is now a plain happy-path double install still carrying the `retry proof:` prefix. `leakedTargets`, `cleanupRoots` = 0 hits repo-wide; the warning string is asserted in no test; sole producer is `shared/fs-utils.ts:50`. |
| G2 | **high** | `tests/orchestrators/plugin/reinstall-flow.test.ts:6613` | A 20-entry LIFO schedule collapsed to `deepStrictEqual(firstSchedule, ["save:state"])` while the title still reads "unwinds them all in reverse". `observeReinstallSchedule` = 0 occurrences; `replace:*`, `backup-rm:*`, `staging-rm:*`, `rollback:*`, `remove:hooks` all 0. A forward unwind now passes green. |
| G3 | **high** | `reinstall-flow.test.ts` / `tests/architecture/hooks-lifecycle.test.ts:192` | `remove:hooks` positional pin (16 sites, always before `save:state`) survives only as a source grep. A crash between `saveState` and the hooks-cache removal leaves state recording the new resources while the routing cache serves the pre-reinstall handler, and nothing fails. |
| G4 | important | `tests/architecture/no-orchestrator-network.test.ts:82` | NFR-5 gate covers 1 of 4 list owners; `list-candidate-row.ts`, `list-installed-row.ts`, `list-orphan-fold.ts` ungated. The install split three lines above added both halves with the rule written down: "Keep both targets so splitting composition from the ledger cannot weaken the original gate." |
| G5 | important | `tests/architecture/no-orchestrator-network.test.ts:67-118` | Same gate, update family: 1 of 6 owners named. **The gate's stated invariant is already false** — `update-preflight.ts:35,62` imports `GitOps` and declares `gitOps?: GitOps`, while the failure message asserts "only update-flow.ts is permitted to import gitOps". |
| G6 | important | `extensions/.../update-flow.ts:964` | `return preflight as UpdateRunOutcome` launders four `?: never` proofs. The typed `isOutcome` guard became a bare `in` check narrowing to the wide union, so a preflight failure carrying `cause`/`toVersion`/`phaseFailures` now compiles where it was previously a compile error. NFR-7 discipline in reverse. |
| G7 | important | `extensions/.../update-preflight.ts:272-288` | `staticPreflightRow`'s `failed` arm can now carry `fromVersion`; the `fromVersion?: never` guard and the comment recording why are both gone. No behavior change today (all four call sites checked) — the guard is what was lost. Same optional-field silent-omission class this project has shipped before. |
| G8 | important | `tests/architecture/catalog-uat/fixtures/plugin-enable.ts`, `reconcile-applied.ts` | Three fixtures replaced the live `narrowUnsupportedKinds(["lspServers"])` seam call with hardcoded `["lsp"]`; 0 code call sites remain across all 20 fixtures, while two comments still claim the seam is in play. Re-mapping `lspServers` would no longer fail these cases. |
| G9 | important | (no successor file) | XSURF-03 cross-surface brace parity deleted with no replacement — it rendered both surfaces from one `narrowUnsupportedKinds` result and compared the braces byte-for-byte. `extractBrace` = 0 hits. The two surviving XSURF-03 tests pre-date the split and hardcode different reasons per surface, so they never cross-check. |
| G10 | important | `tests/shared/notification-dispatch.test.ts:5935` | `emitReconcileAppliedContextCascade`: both named guarantees now vacuous. Fixture no longer requests a reload or an error severity, so "omits reload" is trivially satisfied and severity stamping is unpinned on the path production actually uses (`notify-context.ts:288`). |
| G11 | important | `tests/shared/notification-dispatch.test.ts:5833` | `emitContextCascade`: the renderRow callback contract is unasserted. `renderOwnedRow` became a plain two-parameter function, so the `(row, probe, mpScope)` forwarding order, the truthful probe derivation, and the marketplace-level scope are no longer pinned — though all four production call sites pass three arguments. |
| G12 | important | `tests/shared/notification-dispatch.test.ts:5877,5899` | "Empty cascade must not invoke the row renderer" dropped from all three emitters. Because `renderOwnedRow` is no longer a `t.mock.fn`, a call-count assertion is not even expressible in the new file — the mechanism by which G11 and G12 both leaked. |

| G13 | important | `.planning/codebase/{ARCHITECTURE,CONVENTIONS,STACK}.md` | TREF-09 requires "documentation ... repointing" as part of the split; it was not done. ~18 references to the seven retired hubs remain, with stale line numbers beside them, and `ARCHITECTURE.md:78,151` claim a "5-phase ledger (skills, commands, agents, hooks, mcp)" where `install-outcome.ts:963-968` holds six — `statePhase` follows `mcpPhase`. These documents are `@`-imported into the project CLAUDE.md, so the stale text is served to every session as ground truth. |

Minor, recorded but not counted: the reinstall happy path dropped its `PRL-08`/`PRL-11` title anchors,
which now have zero occurrences under `tests/` — CONVENTIONS.md requires durable spec IDs in titles.

### G1 disposition — partially closed, remainder blocked

G1 cannot be closed as written, and the reason is a requirement conflict rather than an oversight.
The deleted fault injection patched `node:fs/promises` through `createRequire` +
`syncBuiltinESMExports`. **TREF-08 — a requirement this same phase closes — forbids exactly that**:
"Global prototype and builtin-module patching ... are removed through real case-owned state or
narrow production-owned ports without ignore pragmas." So the deletion was correct in mechanism and
wrong only in leaving the coverage unreplaced. The closure gate's residual patch census (2 files/2
`createRequire`, 2 files/18 `syncBuiltinESMExports`) independently pins that removal.

Closed: the skills -> commands -> agents ordering proof, reshaped as a per-phase staging census taken
through the existing `transactionControl.runPhases` seam. It proves what the leak order was a proxy
for — each bridge creates AND reclaims its staging root inside its own phase, in that order. Verified
to fire by two production mutations: swapping the skills/commands phases, and making
`commitPreparedSkills` skip its cleanup.

The test's `retry proof:` prefix was also dropped. With no injected fault it was a false claim; the
other twelve `retry proof:` titles in that file each name a real fault.

Still open, blocked: the interleaved leak-message array and the leaked-residue count. Both require
observing a `cleanupStaging` FAILURE, and `shared/fs-utils.ts:40` calls `fs.rm` directly with no
injectable port. A real-permission route (`chmod 0o500`) cannot reach it either — the staging root's
parent must be writable when the bridge creates the per-call directory and read-only when it removes
it, and both happen inside one phase closure with no seam between them. Adding the port means
threading it through ~40 call sites across three bridges and two orchestrators, which is a production
refactor, not a narrow port.

**Routing:** the port belongs to `RCOV` in the Direct Coverage phase, whose remit is resolving
coverage shortfalls. Recorded there rather than forced here — the alternative was reintroducing the
exact builtin patching TREF-08 exists to remove.

### What the audit confirmed CLEAN (auditable negatives)

Most of the phase held. Recording this so the gaps above are not read as a blanket indictment:

- **Resolver:** 141 old titles -> 176 new; 137 of 138 matched bodies byte-identical; all 7
  table-driven input cases preserved; NFR-7 compile-time proofs split correctly.
- **Catalog corpus:** provably identical, not merely same-sized — 190 vs 190 examples and 23,732
  bytes, cross-checked in a 4-way parser/catalog matrix. The new parser is strictly STRICTER
  (throws on five malformed inputs the old one silently skipped). All 20 fixture modules proven
  reached; completeness asserted in both directions.
- **List:** 89 -> 113 cases, zero deleted, 82 byte-identical, 3 strengthened, none loosened. No
  list module acquired git surface.
- **Install:** reverse-unwind ORDER proofs intact and structurally identical; MCP-phase
  compensation and both state-commit race proofs intact.
- **Reinstall:** heterogeneous remove->add->rebuild invariant DOES have behavioral coverage
  (`reinstall-flow.test.ts:2501`, driving a live hooks runtime); happy path strengthened from 4
  `assert.equal` to a 10-field `deepStrictEqual` plus exact file bytes.
- **Update:** the heterogeneous-undo flow — the highest-risk item — is intact; all 20 implementing
  functions byte-identical. No test deleted, no assertion loosened, atomicity preserved.
- **No forwarding facades anywhere**, in any of the seven families.
- **notify remains a dumb renderer**; state reading moved out into the orchestrator, the direction
  the project wants. Closed-set locks got stronger (full literal `deepStrictEqual` of all 44
  REASONS, 24 STATUS_TOKENS, 19 PLUGIN_STATUSES, 7 MARKETPLACE_STATUSES).

### Superseded recommendation

The original report recommended flipping TREF-07/08/09 to `Complete`. That flip was made and has
now been **reverted** — the authorization rested on a `passed` verdict that no longer stands. The
three requirements return to `Pending` in both `.planning/REQUIREMENTS.md` and
`scripts/revalidation.mjs` (coordinated, per `RVAL-04`) until gap closure re-verifies.

### Original basis for the passed verdict, retained

All must-haves were verified against the live codebase at HEAD (`eacfe55c`), independent of the
SUMMARY.md/VALIDATION.md narrative:

- The three defects found and repaired after the initial 51 plans (F1 formatting, F2 composed-path architecture gates, F3 requirement-route contract drift) were each independently re-executed and confirmed green, not merely trusted from the record.
- The seven legacy hubs, 30 owner pairs, and 20 catalog fixtures were independently counted from the filesystem and git index, not taken from VALIDATION.md's own count.
- The residual patch census was independently re-derived via `git grep`, matching VALIDATION.md exactly.
- No forwarding facades or weakened assertions were found in a targeted sample of the highest-risk hub-retirement plans.
- The known composed-path coverage limitation (item 4 in the task brief) is correctly carried forward as ROADMAP.md Phase 7 success criterion 4 — not silently dropped, not treated as a Phase 6 gap.

**Recommendation:** TREF-07, TREF-08, and TREF-09 may be flipped from `Pending` to `Complete` in both `.planning/REQUIREMENTS.md` and `scripts/revalidation.mjs`, now that this phase verification has passed. This should be done as a coordinated edit to both files together (per `RVAL-04`'s contract) — leaving either one stale will re-redden the `revalidation.test.ts` suite, exactly as it did for F3.

---

_Verified: 2026-09-09T22:45:00Z_
_Verifier: Claude (gsd-verifier)_
