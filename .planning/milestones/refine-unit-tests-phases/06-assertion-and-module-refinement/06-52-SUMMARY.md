---
phase: 06-assertion-and-module-refinement
plan: "52"
subsystem: testing
tags: [typescript, node-test, architecture-gates, structural-census, phase-closure]

requires:
  - phase: 06-51
    provides: the sealed seven-retired-hub closure census and the final plugin list owner pairs
provides:
  - implementation-backed structural closure evidence for 30 owner pairs, 20 catalog fixtures, seven retired hubs, and the exact residual patch census
  - a verbatim red record of the full repository gate with three separated findings
  - a withheld validation seal, so Phase 6 cannot read as closed while the gate is red
affects: [06-verification, TREF-07, TREF-08, TREF-09, phase-06-closure]

plan_head_before: 4ca3bba837b8e7aedf3bbf78fb010eb7158db6fb
actuals:
  tokens: 2879
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - separate a red closure gate into in-boundary regressions and out-of-boundary drift before proposing any repair
    - a literal stale-path token scan cannot see a gate that composes its target path from segments

key-files:
  created: []
  modified:
    - .planning/phases/06-assertion-and-module-refinement/06-VALIDATION.md

key-decisions:
  - "Withhold the validation seal: npm run check exits 1, so status stays draft and nyquist_compliant stays false."
  - "Report the three gate failures rather than repair them; this plan may modify 06-VALIDATION.md only."
  - "Run every chain member after the first red one individually, so the report states the complete gate state instead of only its first failure."

patterns-established:
  - "Closure evidence records exit codes as observed, including a red gate, rather than narrating a green result."
  - "A four-part repoint is unproven until path-composing gates are checked, not just literal-token scans."

requirements-completed: []

coverage:
  - id: D1
    description: Structural ownership, stale-path, catalog inverse-completeness, and authorized residual patch censuses hold at Phase 6 closure.
    requirement: TREF-09
    verification:
      - kind: other
        ref: npm run test:corresponding
        status: pass
      - kind: other
        ref: npm run fallow
        status: pass
      - kind: other
        ref: node scripts/check-phase-06-hub-ledger.mjs closure --owner-count 30 --catalog-fixture-count 20 --sync-files 2 --sync-calls 18 --require-files 2 --require-calls 2
        status: pass
      - kind: other
        ref: git grep -F -c -- "<retired path>" -- extensions tests scripts docs eslint.config.js (13 tokens, zero matching files)
        status: pass
    human_judgment: false
  - id: D2
    description: The full repository gate proves Phase 6 integrated without behavior, ownership, or gate loss.
    requirement: TREF-07
    verification:
      - kind: integration
        ref: npm run check
        status: fail
    human_judgment: true
    rationale: "The gate is red from three separated causes, only one of which is Phase 6 work left incomplete. Which findings block phase closure and who repairs them is a scope decision outside this plan's single-file authorization."

duration: 33min
completed: 2026-09-09
status: halted
---

# Phase 06 Plan 52: Phase Closure Validation Summary

**Structural closure is proven — 30/30 owner pairs, 20 catalog fixtures, seven retired hubs absent, residual patches exactly 2/18 and 2/2 — but `npm run check` exits 1 from three separated causes, so the validation seal is withheld.**

## Performance

- **Duration:** 33 min
- **Started:** 2026-09-09T21:25:40Z
- **Completed:** 2026-09-09T21:58:35Z
- **Tasks:** 2 (task 1 green, task 2 halted at its gate)
- **Files changed:** 1

## Accomplishments

- Proved the Phase 6 structural contract with real runs: the corresponding-test gate, `fallow`, and the hub-ledger closure gate all exit 0, covering 30 production owners, their 30 mirrored owner tests, 20 catalog fixture modules, the seven retired hubs, and the exact residual patch census.
- Ran 13 stale-path token scans across `extensions`, `tests`, `scripts`, `docs`, and `eslint.config.js`; every retired production and test path returns zero matching files.
- Ran the full repository gate and every chain member after its first red one, so the record states the complete gate state rather than stopping at the first failure.
- Separated the red gate into three findings with distinct owners and blast radii, and recorded each verbatim in `06-VALIDATION.md`.
- Kept the seal honest: `status: draft` and `nyquist_compliant: false` are unchanged, and no verification-map row was promoted to green.

## Task Commits

1. **Task 06-52-01: Prove ownership, stale-path, catalog, and patch censuses** — `50969a49` (docs)
2. **Task 06-52-02: Run final integration gate and seal validation evidence** — `be4eb122` (docs, halted at the gate)

## Files Created/Modified

- `.planning/phases/06-assertion-and-module-refinement/06-VALIDATION.md` — gained an `## Implementation Evidence` section carrying the 06-52-01 green censuses and the 06-52-02 red gate record with all three findings.

## Gate Results

| Chain member | Exit | Result |
| --- | --- | --- |
| `npm run typecheck` | 0 | clean |
| `npm run lint` | 0 | clean |
| `npm run fallow` | 0 | dead-code, health, and dupes within their gates |
| `npm run format:check` | 1 | RED — F1 |
| `npm run test:corresponding` | 0 | passed |
| `npm run test:corresponding:negative` | 0 | passed |
| `npm run test:coverage:direct:negative` | 0 | passed |
| `npm test` | 1 | RED — 5881 tests, 5837 pass, 44 fail (F2, F3) |
| `npm run test:integration` | 0 | 32 tests, 32 pass |
| `npm run check` | 1 | RED — halts at `format:check` |

## Findings

### F1 — `format:check` fails on an untracked, unrelated file

`prettier --check "**/*.{js,json,ts}"` resolves its glob from the filesystem, not the git index, so
the untracked `.mcp.json` enters the gate and is the only file reported. No tracked source or test
file is unformatted. Outside the Phase 6 boundary.

### F2 — Two architecture gates still read deleted Phase 6 hubs (2 failing tests)

Both fail with `ENOENT` at read time, not on an assertion:

- `tests/architecture/hooks-lifecycle.test.ts:55` — `REINSTALL_PATH = path.join(ORCH_DIR, "reinstall.ts")`, read at line 186. The reinstall hub was retired in Plan 06-48 and this gate was not repointed to `reinstall-flow.ts`.
- `tests/architecture/import-boundaries.test.ts:211` — `PLUGIN_LEDGERS = ["install", "update", "uninstall", "reinstall", "enable-disable"]`, each read as `${ORCHESTRATORS_REL}/plugin/${name}.ts` at line 254. `install.ts`, `update.ts`, and `reinstall.ts` were retired in Plans 06-38, 06-43, and 06-48.

The gate's own comment states the intent — "A renamed or deleted ledger must fail loudly rather than
silently uncovering this direction of the gate" — so this red is the gate working as designed. Both
gates escaped the 06-52-01 stale-path scan because each composes its target path from segments, so
the literals `orchestrators/plugin/install.ts` and `orchestrators/plugin/reinstall.ts` never appear
in either file. This is Phase 6 work left incomplete: the `Four-Part Repointing Gate`
source-scanning category was proven only against literal tokens.

### F3 — Sealed requirement-route contract disagrees with REQUIREMENTS.md (42 failing tests)

`scripts/revalidation.mjs` lines 126-131 seal `TREF-04` through `TREF-09` as `status: "Pending"`,
while the `.planning/REQUIREMENTS.md` traceability table lines 170-175 read `Complete`. One test
asserts the live contract directly; the other 41 are planted-offender cases that now receive six
extra `requirement-route-contract` lines alongside their own planted error.

`git log -S` places the first `TREF-04 | Phase 5 | Complete` row at `5c47f436 docs(phase-05): close
verified ownership phase`, so `npm test` has been red since Phase 5 closed. Phase 6 extended the
same drift to `TREF-07`, `TREF-08`, and `TREF-09` through its own requirement marking. Outside the
Phase 6 code boundary, but it means 51 Phase 6 plans reported green while the full suite was red —
no plan ran `npm test`, and the per-wave sampling rate in this validation contract does not require
it.

## Decisions Made

- The seal is withheld. `npm run check` exiting zero is the stated acceptance criterion for Task 06-52-02, and it does not.
- No production, test, or script file was modified. This plan's `files_modified` authorizes `06-VALIDATION.md` only, and a green gate produced by editing the thing under test would prove nothing.
- Chain members after the first red one were run individually rather than left unknown, so the scope decision can be made against the complete gate state.

## Deviations from Plan

None — the plan was executed exactly as written. Task 06-52-02's action ends with "After all mapped
commands are green, update VALIDATION status and nyquist evidence"; the commands are not all green,
so the conditional seal correctly did not fire.

## Issues Encountered

- `gsd-tools windows append` refused to record these findings: `.planning/WINDOWS.md` has a rendered table that disagrees with its fenced JSON source for rows 9 and 30. This is the same pre-existing condition Plan 06-51 reported. Ledger population is best-effort, so it was skipped rather than repaired; the findings live in `06-VALIDATION.md` and in this summary.
- `.claude/settings.json` and `.codex/config.toml` were already modified in the working tree at plan start and were left untouched.

## Known Stubs

None.

## Threat Flags

None. No production code, network endpoint, authentication path, schema, persistence contract, or
file-access boundary changed. Note that F2 leaves two architecture gates non-executing, so the
T-06-05 stale-compatibility-path mitigation and the D-11 boundary mitigation are currently unproven
by those two gates until they are repointed.

## User Setup Required

None.

## Next Phase Readiness

Phase 6 is not closed. Three decisions are needed before it can be:

1. **F2 must be fixed inside Phase 6.** Repoint `hooks-lifecycle.test.ts`'s `REINSTALL_PATH` to `reinstall-flow.ts` and `import-boundaries.test.ts`'s `PLUGIN_LEDGERS` to the surviving flow owners, then re-run the closure gate. Consider extending the stale-path proof to catch path-composing gates, since the current scan cannot.
2. **F3 needs a scope owner.** Either `scripts/revalidation.mjs` reseals `TREF-04` through `TREF-09` as `Complete`, or the traceability table returns to `Pending` until the milestone closes. Whichever is chosen, the drift predates Phase 6 and should not be absorbed silently by it.
3. **F1 is environmental.** `.mcp.json` is untracked; formatting it, ignoring it, or tracking it in formatted form all clear the gate, and none is Phase 6 work.

Once `npm run check` exits zero, `06-VALIDATION.md` can be sealed by setting `status: sealed`,
`nyquist_compliant: true`, `wave_0_complete: true`, and promoting the verification-map rows.

## Self-Check: PASSED

- `.planning/phases/06-assertion-and-module-refinement/06-VALIDATION.md` exists and carries both evidence sections.
- Commits `50969a49` and `be4eb122` exist in repository history.
- `git rev-list --count 4ca3bba8..HEAD` before this summary commit is 2, matching `actuals.commits`.
- No production, test, or script file appears in either commit; `git diff --name-only` for the plan range lists exactly one file.
- `06-VALIDATION.md` frontmatter still reads `status: draft` and `nyquist_compliant: false`.
- `.planning/STATE.md` and `.planning/ROADMAP.md` are untouched.

---

_Phase: 06-assertion-and-module-refinement_
_Completed: 2026-09-09_
