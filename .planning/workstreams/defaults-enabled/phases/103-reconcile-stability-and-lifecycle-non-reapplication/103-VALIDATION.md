---
phase: 103
slug: reconcile-stability-and-lifecycle-non-reapplication
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
status: validated
nyquist_compliant: true
wave_0_complete: true
created: 2026-08-15
---

# Phase 103 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `node:test` (Node built-in), Node `>=20.19.0` |
| **Config file** | none — glob-driven from `package.json` scripts |
| **Quick run command** | `node --test "tests/orchestrators/reconcile/**/*.test.ts"` |
| **Full suite command** | `npm run check` (typecheck + lint + format:check + test + test:integration) |
| **Estimated runtime** | quick command ≈ 4.8s (154 tests), measured on this tree at HEAD; `npm run check` ≈ 6min |

---

## Sampling Rate

- **After every task commit:** the quick command above, plus `npm run typecheck`.
- **After every plan wave:** `npm test` (the architecture globs are in the unit set, and this phase adds an architecture gate).
- **Before verification:** `npm run check` must be green (NFR-6).
- **Max feedback latency:** ~4.8s for the quick command — well under the ~60s budget, so no `--test-name-pattern` narrowing is needed.

---

## Per-Task Verification Map

Task IDs are assigned by the planner. Each row below is a required behavior; the planner MUST attach every row to at least one task and fill the Task ID / Plan / Wave columns.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 103-01-T1 | 103-01 | 1 | DFEN-06 | T-103-01 | The planner classifies an install-disabled plugin into NO action bucket — asserted against `plan.ts`'s own output, with the fixture proven to have reached the classifier at all (D-103-04, D-103-06) | unit | `node --test tests/orchestrators/reconcile/plan.test.ts tests/orchestrators/reconcile/plan-convergence.test.ts` | ✅ | ✅ green |
| 103-01-T2 | 103-01 | 1 | DFEN-06 | T-103-01 | Three successive `applyReconcile` passes are a fixed point: config entry, state record and rendered cascade all unchanged after passes 2 and 3 (D-103-05) | unit | `node --test tests/orchestrators/reconcile/apply.test.ts` | ✅ | ✅ green |
| 103-01-T2 | 103-01 | 1 | DFEN-06 | T-103-01 | The planner half of D-103-04 is taken over the bytes the install actually wrote — `loadState` + `loadMergedScopeConfig` re-read from disk AFTER the last pass, never a hand-built twin | unit | same | ✅ | ✅ green |
| 103-01-T3 | 103-01 | 1 | DFEN-06 | T-103-02 | The fixed point holds for a plugin declared ONLY in `claude-plugins.local.json` — the case where a mis-targeted stamp surfaces as continued planning rather than as a bad write (D-103-07) | unit | same | ✅ | ✅ green |
| 103-02-T2 | 103-02 | 1 | DFEN-07 | T-103-03 | `update` does not move an install-disabled record when the marketplace entry's `defaultEnabled` is flipped between the two calls, with the flip proven seen — the same rewrite bumps the version and the refreshed record's version is asserted to have moved (D-103-10) | unit | `node --test tests/orchestrators/plugin/update.test.ts` | ✅ | ✅ green |
| 103-03-T3 | 103-03 | 1 | DFEN-07 | T-103-03 | `reinstall` likewise does not move it across the same flip. Control differs by necessity: a short-circuiting verb moves no version, so a direct `loadMarketplaceManifest` read stands in | unit | `node --test tests/orchestrators/plugin/reinstall.test.ts` | ✅ | ✅ green |
| 103-02-T1 | 103-02 | 1 | DFEN-07 | T-103-04 | Architecture gate: `orchestrators/plugin/{update,reinstall}.ts` reference neither `defaultEnabled` nor `applyDefaultEnabled`, while their legitimate `resolveStrict` calls stay allowed (D-103-08, D-103-09). Delegates to `tests/helpers/source-scan.ts::assertNoForbiddenSurface`; no `allowMissing` | architecture | `node --test "tests/architecture/**/*.test.ts"` | ✅ | ✅ green |
| 103-03-T1 | 103-03 | 1 | DFEN-07 | T-103-07 | D-103-12: `reinstall` on a disabled record re-materializes nothing, writes no state and no config, and leaves the record byte-identical — the goal sentence's "not a `reinstall`" | unit | `node --test tests/orchestrators/plugin/reinstall.test.ts` | ✅ | ✅ green |
| 103-03-T2 | 103-03 | 1 | DFEN-07 | T-103-11 | Both reinstall surfaces render the truthful `(skipped) {already disabled}` row at info severity — the standalone verb and the bulk cascade, which compose rows through different paths | unit | same | ✅ | ✅ green |
| 103-04-T1 | 103-04 | 1 | DFEN-07 | T-103-08 | D-103-13: with no `--local` typed, `enable`/`disable` write into the file the declaration lives in, and the MERGED view moves — the only assertion that separates a real write from one CFG-02 shadows | unit | `node --test tests/orchestrators/plugin/enable-disable.test.ts` | ✅ | ✅ green |
| 103-04-T2 | 103-04 | 1 | DFEN-07 | T-103-13 | The rule is bounded: the base default is unchanged, a typed `--local` still wins, and BOTH write sites (ordinary write-back and config-truth promotion) select from one decision | unit | same | ✅ | ✅ green |
| 103-04-T3 | 103-04 | 1 | DFEN-07 | T-103-05 | Criterion 4's converse: after `enable`, the declaring config file reads `enabled: true` and the record stays enabled across reload, update and reinstall (D-103-11) — run for a base declaration and for a local one | unit | `node --test tests/orchestrators/plugin/enable-disable.test.ts tests/orchestrators/reconcile/apply.test.ts` | ✅ | ✅ green |
| 103-06-T1 | 103-06 | 2 | DFEN-06 | T-103-16 | D-103-16: the standalone install's stamp lands in the file the declaration lives in, asserted through the MERGED view — the only read that separates a correct stamp from one CFG-02 shadows | unit | `node --test tests/orchestrators/plugin/install.test.ts` | ✅ | ✅ green |
| 103-06-T1 | 103-06 | 2 | DFEN-06 | T-103-16 | The loop is CLOSED, not relocated: one `applyReconcile` pass after that install emits zero notifications and `planReconcile` over the re-read state and merged config is the empty plan — criterion 1 through the standalone-install door | unit | same | ✅ | ✅ green |
| 103-06-T2 | 103-06 | 2 | DFEN-05 | T-103-17 | The precedence READ survives the WRITE fix: `readDeclaredEnabled`'s `targetIsLocal` is derived from the selected file's identity, proven by a base-`{}` + local-`{enabled:true}` case that installs disabled and overwrites the user's value if the label comes from the flag | unit | same | ✅ | ✅ green |
| 103-06-T3 | 103-06 | 2 | DFEN-08 | T-103-16 | The unchanged arms: a key declared in neither file still targets base, a typed `--local` still targets local, and the orchestrated reconcile caller writes the same file for both `configSource` values | unit | `node --test tests/orchestrators/plugin/install.test.ts tests/orchestrators/reconcile/apply.test.ts` | ✅ | ✅ green |
| 103-05-T1 | 103-05 | 3 | DFEN-05 / DFEN-08 | T-103-06 | The D-103-01 decision is pinned: installing over a config entry that already says `enabled: false` materializes the plugin and leaves the entry byte-identical — the behavior that widening would have changed (D-103-03), with the DFEN-08 argument in the comment (D-103-14) | unit | `node --test tests/orchestrators/plugin/install.test.ts` | ✅ | ✅ green |
| 103-05-T1 | 103-05 | 3 | DFEN-06 | T-103-06 | The convergence half that decision rests on: one reconcile pass after that install drives the record disabled and leaves the user's entry byte-identical | unit | same | ✅ | ✅ green |
| 103-05-T2 | 103-05 | 3 | NFR-6 | — | Whole suite green at the phase boundary | integration | `npm run check` | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers every phase requirement. Every target test file already exists:

- `tests/orchestrators/reconcile/plan.test.ts`, `plan-convergence.test.ts`, `apply.test.ts`
- `tests/orchestrators/plugin/update.test.ts`, `reinstall.test.ts`, `enable-disable.test.ts`, `install.test.ts`
- `tests/architecture/` — including three existing convergence/purity gates the new gate was sited against rather than duplicating: `reconcile-planner-purity.test.ts`, `cross-op-convergence.test.ts`, `no-orchestrator-network.test.ts`

No framework install, no new fixture harness. The one genuinely new artifact this phase adds is a single architecture gate, `tests/architecture/no-lifecycle-default-enabled-read.test.ts` (plan `103-02`, task 1).

**Placement decided:** a NEW file rather than a clause inside an existing gate. `no-orchestrator-network.test.ts` is the structural model but the wrong host — its subject is NFR-5 / gitOps, `update.ts` is explicitly EXEMPT there (`:34-38`), and its failure message names four requirement IDs unrelated to DFEN-07. `reconcile-planner-purity.test.ts` predates the shared `assertNoForbiddenSurface` helper and still carries its own read/strip loop, so it is a survivor of the older shape rather than a template (D-98-09).

Several plans extend existing test fixtures with additive, defaulted knobs (a `defaultEnabled` flag on the marketplace ENTRY in `update.test.ts`, `reinstall.test.ts` and `enable-disable.test.ts`; a resources override on `plan.test.ts`'s disabled-record builder; an opt-in convergence flag on `install.test.ts`'s precedence case table). None is a new harness and none moves an existing caller.

---

## Manual-Only Verifications

None. Every behavior in this phase is a planner output, a state/config comparison, or a source-level gate — all assertable in process.

---

## Security Sign-Off (ASVS L1, block on `high`)

| Threat Ref | Pattern | STRIDE | Mitigation to verify |
|------------|---------|--------|----------------------|
| T-103-01 | An unattended reload silently re-enabling a plugin its author declared off — the milestone's central hazard | Elevation of privilege | The planner plans no action; a re-enabled plugin's hooks would dispatch again |
| T-103-02 | A mis-targeted config stamp leaving the merged view unchanged, so the re-enable returns undetected | Tampering | The local-declared fixed-point case is the only assertion that distinguishes this from a correct stamp |
| T-103-03 | A plugin release flipping `defaultEnabled` to flip an existing user's enablement | Tampering | `update`/`reinstall` never read the field; the manifest flip proves it rather than assuming it |
| T-103-04 | A future edit reintroducing the read into a lifecycle verb | Tampering | Source-level gate fails at the token, before any behavior exists to test |
| T-103-05 | A user's explicit `enable` being reverted by the next reload | Tampering | `enable` writes `enabled: true` to the declaring file, making the reload a fixed point in that direction too |
| T-103-06 | Widening the install verdict and silently breaking the DFEN-08 parity guarantee | Tampering | The pinned regression test makes the current behavior explicit and attributed |
| T-103-07 | A repair verb re-enabling a plugin the user disabled — `reinstall` re-materializes artifacts and flips the record, making the plugin live in the session that ran the command (D-103-12) | Elevation of privilege | The verb refuses a disabled record before the resolve: nothing staged, nothing written, `state.json` byte-identical |
| T-103-08 | An `enable`/`disable` write landing in a file the merge shadows, so the verb reports success while the merged view never moves and the next reload plans the opposite (D-103-13) | Tampering | The write target is selected from where the declaration lives; asserted through the MERGED view, not through "did some file gain the key" |
| T-103-11 | A row claiming `(reinstalled)` over a record the config contradicts | Repudiation | Both reinstall surfaces render the truthful `(skipped)` row, byte-exact, at info severity |
| T-103-13 | Fixing only the ordinary write-back and leaving the config-truth promotion arm aimed at the shadowed file | Tampering | Both write sites read one selection made at the top of the locked closure; the promotion arm has its own case |
| T-103-16 | The same write-target defect on the standalone `install` (D-103-16). Unlike the others this one is PERMANENT: the stamp is shadowed, the merged view never moves, and every reload pushes an enable — success criterion 1, false, through the standalone door | Elevation of privilege | The stamp follows the declaration through the shared helper; asserted through the merged view AND by a reload that must plan nothing |
| T-103-17 | The write fix re-breaking the cross-file precedence READ — labelling the selected file with the caller's flag inverts which physical entry answers the question, and the failure mode is overwriting a value the user typed | Tampering | `targetIsLocal` is derived from the selected path's identity; a base-`{}` + local-`{enabled:true}` case fails if it is not |
| T-103-18 | The CR-02 adopted-marketplace declaration following the plugin entry into the local file when the target flips | Tampering | Accepted: the arm fires only when the marketplace is declared in NEITHER file, so nothing is contradicted, and splitting the write would break CR-02's single atomic save |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (none — every target file exists)
- [x] No watch-mode flags
- [x] Feedback latency recorded and under budget — 4.8s measured, not estimated
- [x] Every Per-Task Verification Map row has a real Task ID
- [x] `nyquist_compliant: true` set in frontmatter

**Plan/wave layout:** six plans, three waves.

- **Wave 1 (parallel, disjoint `files_modified`):** `103-01` (DFEN-06 fixed point), `103-02` (DFEN-07 gate + `update` flip), `103-03` (D-103-12 production fix), `103-04` (D-103-13 production fix).
- **Wave 2:** `103-06` (D-103-16 production fix), which consumes the `selectDeclaringConfigWriteTarget` helper `103-04` creates.
- **Wave 3:** `103-05` (the DFEN-08 pin, the ROADMAP reword, the NFR-6 boundary gate). It is last both because the boundary gate must cover every plan and because it shares `tests/orchestrators/plugin/install.test.ts` with `103-06`.

The three production fixes — D-103-12 (`reinstall`), D-103-13 (`enable`/`disable`) and D-103-16 (`install`) — are one defect at three FIXED call sites: the three verbs that author an enablement declaration on the user's behalf all aimed their write with the caller's flag rather than with the declaration's location. Each lands in its own plan so it stays revertible alone; after the phase they share one selection helper.

**The sweep is not exhaustive, by decision.** `maybeWritePluginConfigBack` (`orchestrators/plugin/shared.ts:815-822`), on the `update` and `reinstall` post-success paths, still aims by the flag and adds a bare `{}` entry to the flag-selected file. Under a local-only declaration a flagless `update` therefore pollutes the base config with a shadowed entry. It breaks no success criterion — the patch carries no field, so the merged view is unchanged and no enable is ever planned — and it is recorded as a backlog candidate in plan `103-05`'s SUMMARY rather than folded into this phase.

**Approval:** pending — Task IDs bound by the planner; the plan-checker gate signs off next. `status` stays `draft` until `/gsd-validate-phase` sets `validated`.

## Validation Audit 2026-08-15

Reconciled at milestone close. The per-task map was already complete — every row
carries a real Task ID and a green automated command — but the file had never been
promoted out of `draft`, so its `nyquist_compliant` flag was not authoritative.

| Metric | Count |
|--------|-------|
| Gaps found | 0 |
| Resolved | 0 |
| Escalated | 0 |

Evidence: full suite green at the close (3553 tests, 3552 pass, 0 fail, 1
pre-existing skip); `npm run check` exits 0.
