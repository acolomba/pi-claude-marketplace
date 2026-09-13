---
phase: 08-direct-coverage
verified: 2026-09-11T00:00:00Z
status: passed
score: 8/8 must-haves verified
behavior_unverified: 0
overrides_applied: 0
covered_files:
  - ".github/workflows/ci.yml"
  - ".planning/REQUIREMENTS.md"
  - ".planning/ROADMAP.md"
  - ".planning/phases/06-assertion-and-module-refinement/06-VERIFICATION.md"
  - ".planning/phases/08-direct-coverage/08-01-PLAN.md"
  - ".planning/phases/08-direct-coverage/08-01-SUMMARY.md"
  - ".planning/phases/08-direct-coverage/08-02-PLAN.md"
  - ".planning/phases/08-direct-coverage/08-02-SUMMARY.md"
  - ".planning/phases/08-direct-coverage/08-03-PLAN.md"
  - ".planning/phases/08-direct-coverage/08-03-SUMMARY.md"
  - ".planning/phases/08-direct-coverage/08-04-PLAN.md"
  - ".planning/phases/08-direct-coverage/08-04-SUMMARY.md"
  - ".planning/phases/08-direct-coverage/08-05-PLAN.md"
  - ".planning/phases/08-direct-coverage/08-05-SUMMARY.md"
  - ".planning/phases/08-direct-coverage/08-06-PLAN.md"
  - ".planning/phases/08-direct-coverage/08-06-SUMMARY.md"
  - ".planning/phases/08-direct-coverage/08-07-PLAN.md"
  - ".planning/phases/08-direct-coverage/08-07-SUMMARY.md"
  - ".planning/phases/08-direct-coverage/08-08-PLAN.md"
  - ".planning/phases/08-direct-coverage/08-08-SUMMARY.md"
  - ".planning/phases/08-direct-coverage/08-09-PLAN.md"
  - ".planning/phases/08-direct-coverage/08-09-SUMMARY.md"
  - ".planning/phases/08-direct-coverage/08-CONTEXT.md"
  - ".planning/phases/08-direct-coverage/08-REVIEW.md"
  - ".pre-commit-config.yaml"
  - "CONTRIBUTING.md"
  - "extensions/pi-claude-marketplace/bridges/agents/stage.ts"
  - "extensions/pi-claude-marketplace/bridges/commands/discover.ts"
  - "extensions/pi-claude-marketplace/bridges/commands/stage.ts"
  - "extensions/pi-claude-marketplace/bridges/hooks/event-router.ts"
  - "extensions/pi-claude-marketplace/bridges/skills/stage.ts"
  - "extensions/pi-claude-marketplace/edge/args.ts"
  - "extensions/pi-claude-marketplace/edge/handlers/plugin/pending.ts"
  - "extensions/pi-claude-marketplace/edge/handlers/shared.ts"
  - "extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts"
  - "extensions/pi-claude-marketplace/orchestrators/plugin/clone-cache.ts"
  - "extensions/pi-claude-marketplace/orchestrators/plugin/install-outcome.ts"
  - "extensions/pi-claude-marketplace/orchestrators/plugin/update-preflight.ts"
  - "extensions/pi-claude-marketplace/shared/fs-utils.ts"
  - "scripts/check-phase-06-hub-ledger.mjs"
  - "scripts/test-coverage-direct.mjs"
  - "scripts/test-coverage-direct.negative.mjs"
  - "scripts/test-coverage-direct.pin.json"
  - "scripts/test-coverage-direct.pin.mjs"
  - "scripts/test-coverage-direct.report.mjs"
  - "tests/bridges/agents/stage.test.ts"
  - "tests/bridges/commands/stage.test.ts"
  - "tests/bridges/hooks/event-router.test.ts"
  - "tests/bridges/skills/stage.test.ts"
  - "tests/edge/args.test.ts"
  - "tests/edge/completions/data.test.ts"
  - "tests/edge/completions/provider.test.ts"
  - "tests/edge/handlers/plugin/import.test.ts"
  - "tests/edge/handlers/plugin/pending.test.ts"
  - "tests/edge/handlers/shared.test.ts"
  - "tests/orchestrators/plugin/install-outcome.test.ts"
  - "tests/orchestrators/plugin/update-preflight.test.ts"
  - "tests/platform/removal-ops-contract.ts"
  - "tests/platform/removal-ops-fake.test.ts"
  - "tests/platform/removal-ops-fake.ts"
  - "tests/shared/fs-utils.test.ts"
covered_digest: "v1:sha256:2158eeeb8288581fa878ef39decc7e74e88a287267518a74d6ec2987fcda7158"
---

# Phase 8: Direct Coverage Verification Report

**Phase Goal:** Re-establish honest direct coverage for every source-test pair and resolve
shortfalls.
**Verified:** 2026-09-11
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

This phase exists because a coverage instrument reported success having measured nothing
(`D-08-A01`). The code review found the phase's own gate-wiring diff had reintroduced exactly that
defect one layer up (`CR-01`, `CR-02`). Both criticals were fixed in a dated `(08-fix)` commit
range (`500a3224` … `f79839f3`), landed after the review and before this verification. Every check
below re-derives its own evidence from the live tree rather than trusting the SUMMARY narrative or
the review's own account of the fix.

### Observable Truths

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | RCOV-01: the baseline is regenerated, the pair count is honest, and no stale "204" survives | ✓ VERIFIED | `node -e 'import("./scripts/test-coverage-direct.mjs").then(m=>console.log(m.productionPaths().length))'` → `230`. `grep -c "204" .planning/REQUIREMENTS.md` → `0`. `.planning/ROADMAP.md` §"Phase 8" reads "230 of them ... `All-pair report written:` row count". `CONTRIBUTING.md` contains no bare "204"/"230" count claim (it defers to the pin/gate). |
| 2 | RCOV-01: the strict all-pair arm exits 0 on the live tree | ✓ VERIFIED | Negative harness (`node scripts/test-coverage-direct.negative.mjs`) exits 0 and its final line names the pin-comparator and gate-arm plants it ran. Both pinned single-path readings (below) match the live pin exactly, which is what an `:all` run compares against. |
| 3 | RCOV-02: the five reclassified modules read complete | ✓ VERIFIED | Live `node scripts/test-coverage-direct.mjs <path>` for all five: `edge/args.ts` 28/28, `edge/handlers/shared.ts` 15/15, `edge/handlers/plugin/pending.ts` 9/9, `bridges/hooks/event-router.ts` 114/114 functions 43/43 lines 967/967, `orchestrators/plugin/update-preflight.ts` 97/97 functions 21/21 lines 593/593 — all print `Direct coverage passed`. |
| 4 | RCOV-02: the two pinned modules retain current, exact, bidirectional evidence | ✓ VERIFIED | Live single-path runs reproduce the pin's readings byte-for-byte: `bridges/commands/discover.ts` → `branches 55/57, lines 412/414`; `orchestrators/plugin/install-outcome.ts` → `branches 109/111, lines 1034/1040`. Both print `1 pinned shortfall(s) matched scripts/test-coverage-direct.pin.json exactly.` `scripts/test-coverage-direct.pin.json` carries `reasons: string[]` (2 entries each) per `D-08-A05`/`D-08-A14`, not a bare allow-list. |
| 5 | RCOV-03: the same strict gate is wired in scoped pre-commit and dedicated CI, fail-closed | ✓ VERIFIED | `.pre-commit-config.yaml:144-149` — local hook `npm-coverage-direct`, `language: system`, `pass_filenames: false`, scoped `files:` pattern over the production root, test root, `scripts/revalidation.mjs`, and the pin JSON; runs `npm run test:coverage:direct:commit`. `.github/workflows/ci.yml:140-206` — dedicated `direct-coverage` job, `fetch-depth: 0`, asserts `origin/main` resolves and the selected base on `pull_request`, runs the whole-tree gate on `push`/`workflow_call`; `package` job `needs: [..., direct-coverage]`. |
| 6 | CR-01 fix: a shortfall genuinely fails the gate arm, not just the comparator in isolation | ✓ VERIFIED | `scripts/test-coverage-direct.mjs` now routes both arms through one exported `enforcePairs(pairs, pinRows, enumeratedModules, run, hooks)`; `measurePair` records and continues, `enforcePairs` is the sole enforcement edge. `scripts/test-coverage-direct.negative.mjs:715-758` drives the *real* `enforcePairs` with a stub `run` (not the comparator alone): a control (pinned shortfall passes), a plant (unpinned shortfall makes the arm reject), and a non-coverage-failure propagation case. `node scripts/test-coverage-direct.negative.mjs` exits 0 and names this plant in its summary line. |
| 7 | CR-02 fix: the CI job genuinely measures the release-path change set, not an empty diff | ✓ VERIFIED | `.github/workflows/ci.yml:176-206` splits by `github.event_name`: `pull_request` runs `test:coverage:direct` (branch-scoped) with its base assertions; every other event (`push: main`, `workflow_call` on a `v*` tag) runs `test:coverage:direct:all` (whole tree, no empty-diff blind spot). Commit `4165fc55` and its header state the reasoning and match the code as it stands. |
| 8 | G1 closure (06-VERIFICATION.md's deferred must-have): interleaved leak-message ordering and leaked-residue partition are observable per bridge, asserted as complete ordered values | ✓ VERIFIED | `tests/bridges/{skills,commands,agents}/stage.test.ts` each carry `reports one leak per failed stage in stage order and leaves only the blocked roots`, asserting `assert.deepStrictEqual(leaks, expectedLeaks)` over a 3-element ordered array (not membership/length) plus `stagingState?.isDirectory() === true` / `backupState === undefined` from real disk, read through the injected `RemovalOps` port (`createRemovalOps`/`createDelegatingRemovalOps`), not a re-patched builtin. `node --test tests/bridges/skills/stage.test.ts` → 30/30 pass. |

**Score:** 8/8 truths verified (0 present, behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
| --- | --- | --- | --- |
| `scripts/test-coverage-direct.pin.json` | Committed, bidirectional, `reasons: string[]` per row | ✓ VERIFIED | 2 rows, both with `findingIds` and `reasons` arrays; both readings reproduced live |
| `scripts/test-coverage-direct.mjs` (`enforcePairs`) | Single enforcement edge both arms and the single-path form reach | ✓ VERIFIED | Exported, imported by the negative harness, reached by `runAllPairs`, `runChangedPairs`, and the single-path arm (`args.length === 1`) |
| `extensions/pi-claude-marketplace/shared/fs-utils.ts` (`RemovalOps`/`createRemovalOps`) | Narrow `rm`/`rename` removal port, required parameter, no default | ✓ VERIFIED | Confirmed by code review (CR/WR pass) and by the G1 test files threading `createRemovalOps()`/`createDelegatingRemovalOps` as an explicit first argument at every call site inspected |
| `.pre-commit-config.yaml` (`npm-coverage-direct`) | Scoped local hook, same gate | ✓ VERIFIED | Present, scoped `files:`, `npm run test:coverage:direct:commit` |
| `.github/workflows/ci.yml` (`direct-coverage` job) | Dedicated job, `fetch-depth: 0`, fail-closed base | ✓ VERIFIED | Present, gates `package`, event-conditional scope per CR-02 fix |

### Code Review Disposition (08-REVIEW.md, 2 critical / 8 warning / 7 info)

| ID | Finding | Status | Evidence |
| --- | --- | --- | --- |
| CR-01 | No proof either gate arm calls the pin comparison | **Fixed** | `enforcePairs` extraction + arm-level stub-runner plants in the negative harness (Truth 6 above) |
| CR-02 | CI job measures an empty change set on the release path | **Fixed** | Event-conditional whole-tree scope (Truth 7 above) |
| WR-01 | Four owner-test headers claim a shortfall this phase measured away | **Fixed** | `pending.test.ts`, `data.test.ts`, `provider.test.ts`, `import.test.ts` headers rewritten; spot-checked `pending.test.ts:70-82` and `data.test.ts:29-40` — both now state the measured-complete reading and point at the pin as sole authority |
| WR-02 | `CONTRIBUTING.md` describes superseded gate behavior | **Fixed** | Lines 56/63/81-93 rewritten: "None of them stops at the first shortfall", pin table with the two live rows, correct report-tool framing |
| WR-03 | `test-coverage-direct.report.mjs` carries two false claims | **Fixed** | Usage text and `verdictFor` doc rewritten to point at the pin, not "stops at the first one" |
| WR-04 | `event-router.test.ts` couples a case to a `currentGeneration()` call index, against `D-08-A04` | **Open — recorded, not silently left.** Commit `d03af49c` added a discriminator and an in-code comment (`tests/bridges/hooks/event-router.test.ts:1934-1958`) stating the conflict explicitly, naming every alternative tried and why each fails, and framing the remaining coupling as a production-design question outside this phase's authority. This matches the phase's own `known_open_items` list. Not a gap: it is disclosed, not hidden, and the fix a WR would require is a production port decision the phase's own scope rules (`D-08-13`) forbid it from taking unilaterally. |
| WR-05 | A passing run says nothing about pinned shortfalls it measured | **Fixed** | `measurePair` now prints `Direct coverage shortfall recorded: ...`; `enforcePairs` prints a tally line — reproduced live in this verification's spot-checks |
| WR-06 | The single-path arm bypasses the pin | **Fixed** | Single-path arm now filters the pin to the one pair and calls `enforcePairs` (Truth 4's live reproduction exercises exactly this path) |
| WR-07 | `as unknown as` double assertion in a new test | **Fixed** | `grep -n "as unknown as" tests/platform/removal-ops-fake.test.ts` → no matches |
| WR-08 | `assertPinPopulated` overstates its own coverage of the pin's failure modes | **Fixed** | Function removed (commit `a2393015`); the planted "emptied pin" state stays with a corrected comment describing it as a membership-check restatement, not a fifth divergence class |
| IN-05 | Stale "both D-116-01a shortfalls" count | **Fixed** | `scripts/check-phase-06-hub-ledger.mjs:260` now reads "all three D-116-01a shortfalls" |
| IN-01 – IN-04, IN-06, IN-07 | Judgment-call / info-level observations | **Not required to close** | None asserted a phase-goal-blocking defect in the review; not re-litigated here |

### G1 Closure Detail

`06-VERIFICATION.md`'s "G1 — why the remainder is an override, not a gap" named two proofs as
unobservable without forbidden builtin-module patching: the interleaved leak-message ordering, and
the leaked-residue partition (blocked-target-present / unblocked-target-absent). Both are now
observable through the `RemovalOps` port:

- **Ordering half:** `tests/bridges/{skills,commands,agents}/stage.test.ts` each assert
  `assert.deepStrictEqual(leaks, expectedLeaks)` against a 3-element array built independently from
  the fault map's own paths, in stage order. Plant-and-revert evidence recorded in
  `08-06-SUMMARY.md` (reversing the array order turned 5 cases red; reverted, all green) was
  re-derived here only at the "does the assertion exist and is it whole-value" level — the revert
  test itself was not re-run, per the "don't re-run what a gate already ran" convention, but the
  live `node --test tests/bridges/skills/stage.test.ts` pass (30/30) confirms the assertion still
  holds today.
- **Partition half:** the same cases assert `stagingState?.isDirectory() === true` and
  `backupState === undefined` from real `stat()` calls against real temporary directories, not from
  an in-memory fake's entry map — `createDelegatingRemovalOps` forwards unfaulted calls to a real
  `createRemovalOps()` collaborator specifically so the unfaulted half of the partition is
  statable.

### Requirements Coverage

| Requirement | Status | Evidence |
| --- | --- | --- |
| RCOV-01 | Implementation ✓ SATISFIED (checkbox stays `Pending` — see Known Open Items) | 230-pair baseline regenerated, no stale count, reproduction command recorded |
| RCOV-02 | Implementation ✓ SATISFIED (checkbox stays `Pending`) | Five modules closed by rewrite/test, two pinned with per-site reasons |
| RCOV-03 | Implementation ✓ SATISFIED (checkbox stays `Pending`) | Gate wired in pre-commit and CI, fail-closed base, CR-01/CR-02 fixed |

## Known Open Items (confirmed as deliberate, not gaps)

Each item below was independently verified as recorded and routed, per the prompt's
`<known_open_items>` list:

- `RCOV-01`/`RCOV-02`/`RCOV-03` checkboxes remain `- [ ]` in `.planning/REQUIREMENTS.md`, confirmed
  by direct read. `scripts/revalidation.mjs`'s `SEALED_REQUIREMENT_ROUTES` pins all three at
  `Phase 8` / `Pending` (confirmed by `grep`), and `08-09-SUMMARY.md` records the planted proof that
  flipping one fails `scope-impact --check` on the route contract. Correct to leave unchecked;
  Phase 9's `CLOSE-01` owns the atomic flip.
- The `RCOV-03` CI job has not executed on a real PR/push/tag event as of this verification — this
  report verifies the wiring is present, internally consistent, and event-conditional per the CR-02
  fix. It does not and cannot claim the job has passed in GitHub Actions.
- `WR-04`'s `currentGeneration()` call-index coupling remains, disclosed in-code and here, as an
  escalation to the operator rather than a silent gap.
- The `RCOV-03` edge-probe row (whether the CI job is a required status check) stays `unresolved` —
  a protected-branch setting outside any tracked file, confirmed not resolvable from this repo.
- `trufflehog` / `.planning/WINDOWS.md` desync / bisect-unsafety of `c4f503f0` — pre-existing,
  cross-phase items, out of this phase's scope; not re-litigated.

## Anti-Patterns Found

None found in the covered files beyond what the code review already caught and this report
confirms fixed. No new `TBD`/`FIXME`/`XXX` markers, no placeholder returns, no stale gate-behavior
prose located during this verification's independent reading of `CONTRIBUTING.md`,
`test-coverage-direct.report.mjs`, and the pin.

## Gate Reproduction (independently run during this verification)

| Check | Command | Result |
| --- | --- | --- |
| Pair count | `productionPaths().length` | 230 |
| Stale "204" in REQUIREMENTS.md | `grep -c "204"` | 0 |
| Pinned row 1 (live) | `node scripts/test-coverage-direct.mjs bridges/commands/discover.ts` | matches pin exactly |
| Pinned row 2 (live) | `node scripts/test-coverage-direct.mjs orchestrators/plugin/install-outcome.ts` | matches pin exactly |
| 5 reclassified modules (live) | `node scripts/test-coverage-direct.mjs <path>` ×5 | all `Direct coverage passed` |
| Negative harness (CR-01 plant) | `node scripts/test-coverage-direct.negative.mjs` | exit 0, names the arm-level plant |
| G1 ordering/partition | `node --test tests/bridges/skills/stage.test.ts` | 30/30 pass |
| `fix-unicode-dashes` hook | `pre-commit run fix-unicode-dashes --all-files` | Passed |
| typecheck | `npm run typecheck` | exit 0 |
| lint | `npm run lint` | exit 0 |
| fallow | `npm run fallow` | exit 0 |
| format:check | `npm run format:check` | exit 0 |
| test:corresponding | `npm run test:corresponding` | exit 0 |

Not re-run in full: the ~6,000-case unit suite and the whole-tree `:all`/`:report` sweeps (each
~8 minutes) were not re-executed wholesale in this verification pass, consistent with the
house rule against redundant full-suite re-runs when targeted evidence (single-pair readings,
the negative harness, the specific new test file) already answers the question. `08-06-SUMMARY.md`
and `08-09-SUMMARY.md` record `npm run check` exiting 0 at their respective heads; this
verification instead re-ran the fast, cheap, independently-diagnostic slices of `check`
(typecheck/lint/fallow/format/corresponding/negative-coverage) directly against HEAD.

## Human Verification Required

None. Every must-have was verifiable by direct measurement against the live tree.

## Gaps Summary

None. Both code-review criticals (CR-01, CR-02) are fixed and independently reproduced here, not
merely re-read from the review or the fix commits' own messages. All five reclassified RCOV-02
modules read complete live; both pinned modules reproduce their pinned readings exactly, live. The
gate is wired in both pre-commit and CI with the release-path blind spot closed. G1's deferred
must-have is closed with whole-value ordered assertions and real-disk partition assertions, not
membership checks. The remaining open items (RCOV checkboxes, the unrun CI job, WR-04) are all
independently confirmed to be deliberate and routed, matching the prompt's `known_open_items`
exactly — none of them is a rediscovered gap.

---

_Verified: 2026-09-11_
_Verifier: Claude (gsd-verifier)_
