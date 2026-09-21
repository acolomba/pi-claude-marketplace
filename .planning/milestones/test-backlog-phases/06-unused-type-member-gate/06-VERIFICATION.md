---
phase: 06-unused-type-member-gate
verified: 2026-09-17T02:40:00Z
status: passed
score: 2/2 must-haves verified
behavior_unverified: 0
overrides_applied: 0
covered_files:
  - ".github/workflows/ci.yml"
  - ".planning/phases/06-unused-type-member-gate/06-01-PLAN.md"
  - ".planning/phases/06-unused-type-member-gate/06-01-SUMMARY.md"
  - ".planning/phases/06-unused-type-member-gate/06-02-PLAN.md"
  - ".planning/phases/06-unused-type-member-gate/06-02-SUMMARY.md"
  - ".planning/phases/06-unused-type-member-gate/06-03-PLAN.md"
  - ".planning/phases/06-unused-type-member-gate/06-03-SUMMARY.md"
  - ".planning/phases/06-unused-type-member-gate/06-04-PLAN.md"
  - ".planning/phases/06-unused-type-member-gate/06-04-SUMMARY.md"
  - ".planning/phases/06-unused-type-member-gate/06-05-PLAN.md"
  - ".planning/phases/06-unused-type-member-gate/06-05-SUMMARY.md"
  - ".planning/phases/06-unused-type-member-gate/06-06-PLAN.md"
  - ".planning/phases/06-unused-type-member-gate/06-06-SUMMARY.md"
  - ".planning/phases/06-unused-type-member-gate/06-07-PLAN.md"
  - ".planning/phases/06-unused-type-member-gate/06-07-SUMMARY.md"
  - ".planning/phases/06-unused-type-member-gate/06-08-PLAN.md"
  - ".planning/phases/06-unused-type-member-gate/06-08-SUMMARY.md"
  - ".planning/phases/06-unused-type-member-gate/06-09-PLAN.md"
  - ".planning/phases/06-unused-type-member-gate/06-09-SUMMARY.md"
  - ".planning/phases/06-unused-type-member-gate/06-10-PLAN.md"
  - ".planning/phases/06-unused-type-member-gate/06-10-SUMMARY.md"
  - ".planning/phases/06-unused-type-member-gate/06-11-PLAN.md"
  - ".planning/phases/06-unused-type-member-gate/06-11-SUMMARY.md"
  - ".planning/phases/06-unused-type-member-gate/06-12-PLAN.md"
  - ".planning/phases/06-unused-type-member-gate/06-12-SUMMARY.md"
  - ".planning/phases/06-unused-type-member-gate/06-13-PLAN.md"
  - ".planning/phases/06-unused-type-member-gate/06-13-SUMMARY.md"
  - ".planning/phases/06-unused-type-member-gate/06-14-PLAN.md"
  - ".planning/phases/06-unused-type-member-gate/06-14-SUMMARY.md"
  - ".planning/phases/06-unused-type-member-gate/06-15-PLAN.md"
  - ".planning/phases/06-unused-type-member-gate/06-15-SUMMARY.md"
  - ".planning/phases/06-unused-type-member-gate/06-16-PLAN.md"
  - ".planning/phases/06-unused-type-member-gate/06-16-SUMMARY.md"
  - ".planning/phases/06-unused-type-member-gate/06-17-PLAN.md"
  - ".planning/phases/06-unused-type-member-gate/06-17-SUMMARY.md"
  - ".planning/phases/06-unused-type-member-gate/06-LIVE-TRIAGE.md"
  - ".planning/phases/06-unused-type-member-gate/deferred-items.md"
  - ".pre-commit-config.yaml"
  - "docs/unused-type-member-gate.md"
  - "extensions/pi-claude-marketplace/edge/types.ts"
  - "extensions/pi-claude-marketplace/orchestrators/plugin/info.messaging.ts"
  - "extensions/pi-claude-marketplace/orchestrators/plugin/shared.ts"
  - "extensions/pi-claude-marketplace/orchestrators/types.ts"
  - "extensions/pi-claude-marketplace/platform/git-auth-callbacks.ts"
  - "package.json"
  - "scripts/check-unused-type-members.analysis.mjs"
  - "scripts/check-unused-type-members.audit.mjs"
  - "scripts/check-unused-type-members.contracts.json"
  - "scripts/check-unused-type-members.contracts.mjs"
  - "scripts/check-unused-type-members.exceptions.json"
  - "scripts/check-unused-type-members.exceptions.mjs"
  - "scripts/check-unused-type-members.flow.mjs"
  - "scripts/check-unused-type-members.mjs"
  - "scripts/check-unused-type-members.model.mjs"
  - "scripts/check-unused-type-members.negative.mjs"
  - "scripts/check-unused-type-members.operations.mjs"
  - "scripts/test-coverage-direct.pin.json"
  - "tests/architecture/unused-type-member-gate.test.ts"
  - "tests/scripts/check-unused-type-members.contracts.test.ts"
  - "tests/scripts/check-unused-type-members.model.test.ts"
  - "tests/scripts/check-unused-type-members.negative.test.ts"
  - "tests/scripts/check-unused-type-members.operations.test.ts"
  - "tests/scripts/check-unused-type-members.test.ts"
covered_digest: "v1:sha256:a76d3f5a926fcd183dcc45cab60d649ba67d29572a7b4135a15b88a2738053ea"
---

# Phase 6: Unused Type Member Gate Verification Report

**Phase Goal:** An unread optional EdgeDeps member fails an automated static-analysis gate.
**Verified:** 2026-09-17T02:40:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | An unread optional `EdgeDeps` member fails an automated static-analysis gate | ✓ VERIFIED | Ran `scripts/check-unused-type-members.negative.mjs` live against the real repo: `baseline: ok`, `offender-plant: ok`, `benign-receiver-read: ok`, `unrelated-same-spelling-read: ok`, `plant-removed: ok`, `compiler-failure: ok`, `option-failure: ok`, exit 0, `"Unused type member negative controls passed (7 of 7)."`. Also ran `tests/architecture/unused-type-member-gate.test.ts#a new unread member outside the recorded decisions fails the real gate` directly (real gate, real repo, compiler read overlay, no disk write) — PASS. |
| 2 | Read, write-only, structural, external-contract, type-only, alias and computed-access controls establish scope and limitations | ✓ VERIFIED | `tests/scripts/check-unused-type-members.model.test.ts` covers reads (destructuring, compound/update), write-only ("a simple write and a delete are not reads", "an object initializer writes its destination and reads nothing of it"), type-only ("indexed-access types, keyof and type queries read nothing", satisfies type-operand), computed-access ("literal and finite-union element access", "an unbounded computed key is an analysis gap"), structural discrimination ("a same-spelling member on an unrelated type earns no witness"). `tests/scripts/check-unused-type-members.operations.test.ts` covers structural whole-object operations (serialize/spread/rest/Object.assign/values/entries/deep-compare). `tests/scripts/check-unused-type-members.contracts.test.ts` covers external-contract categories (`external-input`, `external-output`, `external-mirror`) and alias/pin mechanics (`schema-pin` via `pinHolds`). `docs/unused-type-member-gate.md` documents all nine contract categories and the may-observe boundary explicitly. |

**Score:** 2/2 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
| --- | --- | --- | --- |
| `scripts/check-unused-type-members.mjs` | Mandatory CLI gate with 3-way exit contract | ✓ VERIFIED | Read in full. `main()` computes `analyzed.findings`, applies `applyExceptions`, narrows only `report.findings`; exit 0/1/2 confirmed live (`node scripts/check-unused-type-members.mjs` → exit 0 with 5 excepted; unknown option/bad tsconfig → 2). |
| `scripts/check-unused-type-members.negative.mjs` | 7 sensitivity controls against the real `EdgeDeps` declaration via compiler read overlay | ✓ VERIFIED | Read in full; ran live — 7/7 pass. `offender-plant` asserts exact declaration identity by string arithmetic over the overlay text, not echoed from the analyzer. |
| `scripts/check-unused-type-members.exceptions.mjs` / `.json` | Per-row recorded-decision layer, CLI-only | ✓ VERIFIED | Read in full. Identity regex `/^[^\s:*?[\]{}]+:[1-9][0-9]*:[1-9][0-9]*$/` rejects glob chars; `allowedFields` rejects any field beyond the five named; `requireMatch` throws (exit 2) when an entry matches no finding or matches a non-`unread` status. |
| `scripts/check-unused-type-members.audit.mjs` | `--inventory`/`--check` count the raw population, exceptions-blind | ✓ VERIFIED | Read in full — no import of `exceptions.mjs`; `analyse()` calls `analyzeProject` directly. Ran `node scripts/check-unused-type-members.audit.mjs --check` live: reports all 5 excepted members as `unread` problems (exit 1 as designed) — confirms exceptions never reach `--check`. |
| `.planning/phases/06-unused-type-member-gate/06-LIVE-TRIAGE.md` | Regenerated ledger matching the live 5-row residual | ✓ VERIFIED | Ledger JSON block: `"unread": 5, "unsupportedAnalysis": 0`, `"candidates": 3344`; all 5 unresolved rows carry full disposition prose matching `exceptions.json` verbatim. |
| `docs/unused-type-member-gate.md` | Scope, exit contract, contract categories, recorded-decision rules, sensitivity-control procedure | ✓ VERIFIED | Read in full (204 lines); matches implementation exactly, no placeholder/TODO markers. |

### Key Link Verification

| From | To | Via | Status | Details |
| --- | --- | --- | --- | --- |
| `scripts/check-unused-type-members.negative.mjs` | Real `extensions/pi-claude-marketplace/edge/types.ts` `EdgeDeps` declaration | Compiler read overlay via `--overlay`, resolved through the TS parser | ✓ WIRED | Confirmed by source read and live execution; `fingerprint()` proves no disk mutation occurred across the run. |
| `package.json` `check` script | `lint:type-members`, `lint:type-members:negative` | `npm run check` tail | ✓ WIRED | `package.json:76` — both scripts present at the end of the `&&` chain, confirmed by direct grep and by `tests/architecture/unused-type-member-gate.test.ts#the mandatory check chain runs the gate and its negative controls` (PASS, live run). |
| `.github/workflows/ci.yml` | `npm run check` | `run: npm run check` | ✓ WIRED | Grep-confirmed at line 80; test `#continuous integration runs the same chain the local path runs` PASS. |
| `.pre-commit-config.yaml` | `npm-type-members`, `npm-type-members-negative` hooks | `entry: npm run lint:type-members[...]`, `pass_filenames: false`, distinct `files:` triggers | ✓ WIRED | Read in full; hook regexes independently verified by test `#the gate hook triggers on every input...` and `#the negative hook triggers on the gate's own machinery...` — both PASS live. Gate hook trigger covers any `extensions/`/`tests/` `.ts` file (so removing a reader anywhere fires it); negative hook trigger is deliberately narrower (gate machinery + `edge/types.ts` + its owner test only). |
| `scripts/check-unused-type-members.mjs` exit status | `scripts/check-unused-type-members.exceptions.json` | `readExceptions` + `applyExceptions`, CLI-only, never inside `analyzeProject` | ✓ WIRED, exception mechanism cannot be fooled | Directly proved by the single most load-bearing test in the phase: `tests/architecture/unused-type-member-gate.test.ts#a new unread member outside the recorded decisions fails the real gate` — plants a brand-new unread member (`RecordedDecisionControl.controlNeverExcepted` or equivalent) into the real `EdgeDeps.ts` via overlay, runs the real gate, and requires exit 1 with exactly that one finding while all 5 recorded decisions remain excused. Ran this test directly: **PASS** (78s). |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| --- | --- | --- | --- |
| Mandatory gate passes today with 5 recorded exceptions | `node scripts/check-unused-type-members.mjs` | exit 0, `"Unused type member gate passed with 5 recorded exception(s)."`, each exception line-printed with its decision | ✓ PASS |
| `--check` is exceptions-blind (proves the exception list cannot mute the audit) | `node scripts/check-unused-type-members.audit.mjs --check` | exit 1 (via pipe), 5× `unread: ...` problem lines naming the same 5 members the CLI gate excuses | ✓ PASS |
| Full CLI unit suite for the gate | `node --test tests/scripts/check-unused-type-members.test.ts` | 29/29 pass, including `"a member outside the recorded decisions still fails the gate"` and every exceptions-abuse control (pattern id, unknown field, short mechanism, duplicate id, drifted coordinate, wrong owner, wrong status) | ✓ PASS |
| Real-gate, real-repo exception-mute-button control | `node --test --test-name-pattern="a new unread member outside the recorded decisions fails the real gate" tests/architecture/unused-type-member-gate.test.ts` | 1/1 pass (78s) | ✓ PASS |
| Wiring assertions (check-chain, CI, both hook triggers) | `node --test --test-name-pattern="mandatory check chain\|continuous integration runs the same chain\|both member hooks analyse\|gate hook triggers\|negative hook triggers" tests/architecture/unused-type-member-gate.test.ts` | 5/5 pass | ✓ PASS |
| Full 7-control negative-control runner, live | `node scripts/check-unused-type-members.negative.mjs` | 7/7 pass, exit 0 (ran to completion, ~7 min) | ✓ PASS |
| Aggregate production unit coverage claim | `awk` over `coverage/unit.lcov`, filtered to `extensions/pi-claude-marketplace/` | 227 modules, 1833/1833 functions, 9049/9049 branches, 62971/62971 lines, 0 modules with any shortfall | ✓ PASS — independently recomputed from the on-disk lcov artifact, matches 06-08-SUMMARY.md's claim exactly |
| Coverage-direct pin not weakened | `git log`/`git show` on `scripts/test-coverage-direct.pin.json` | Only 2 phase-06 commits touch the file (`6606607c`, `108ab8f7`); both diffs are pure line-number re-anchoring after code deletion — the `branches 109/111` denominator is byte-identical across both commits | ✓ PASS — no threshold loosened |

### Requirements Coverage

| Requirement | Description | Status | Evidence |
| --- | --- | --- | --- |
| MEMBER-01 | Add a static gate that detects unused interface/type members, including an unread optional EdgeDeps member | ✓ SATISFIED | `.planning/REQUIREMENTS.md` marks complete; independently confirmed via live gate run + live negative-control run + `npm run check` wiring. |
| MEMBER-02 | Validate read-site analysis with offender and benign controls and document justified external/structural contracts | ✓ SATISFIED | 7/7 negative controls live-verified; `docs/unused-type-member-gate.md` documents all 9 contract categories and the 5 recorded exceptions each carry a measured, source-grounded mechanism (spot-checked 3 of 5 against the actual declarations). |

### Anti-Patterns Found

None. Grepped every file this phase created or modified under `scripts/check-unused-type-members*.mjs` and `docs/unused-type-member-gate.md` for `TBD`/`FIXME`/`XXX`/`TODO`/`HACK`/`PLACEHOLDER`/"not yet implemented" — zero hits (one grep hit on the word "placeholder" in `contracts.mjs:1170` is TypeScript `infer` terminology in a doc comment, not a debt marker).

### The exception mechanism — adversarial check (most important finding)

Verified directly, not accepted from SUMMARY:

1. **Lives in the CLI, not the analyzer.** `scripts/check-unused-type-members.audit.mjs` never imports `exceptions.mjs`; `--inventory`/`--check` call `analyzeProject` directly. Live run of `--check` reports all 5 excepted members as `unread` problems — the audit is genuinely exceptions-blind.
2. **Unwritable, not merely discouraged.** `identityPattern` rejects any glob metacharacter; `allowedFields` is a closed 5-field set (`id`, `owner`, `key`, `decision`, `mechanism`) — an added `maximumUnread` field is refused by name (unit-test confirmed live).
3. **Self-expiring.** `requireMatch` throws when an entry matches no finding (repaired member) or when coordinates drifted onto a different declaration — confirmed by 3 separate live-passing unit tests.
4. **`unsupported-analysis` can never be excused.** `matched.status !== "unread"` refuses — confirmed live.
5. **The decisive control exists and passes.** `tests/architecture/unused-type-member-gate.test.ts#a new unread member outside the recorded decisions fails the real gate` plants a brand-new unread member into the real `EdgeDeps` declaration via a compiler read overlay (no disk write, verified by re-reading the file after the run), runs the real CLI gate against the real repository, and asserts exit 1 with exactly that one finding while all 5 recorded decisions stay excused. Ran it directly: **PASS**. This is the test the whole exception mechanism's integrity depends on, and it is not a mock — it is the production gate against the production tree.

No gap found in the exception mechanism. It cannot currently be used as a mute button for anything other than the 5 named coordinates.

### Human Verification Required

None.

### Gaps Summary

No gaps. Both roadmap success criteria are independently verified against live command output, not SUMMARY.md narration:

- Criterion 1 (unread optional EdgeDeps member fails the gate): proved by a full live run of the 7-control negative-control suite (7/7 pass) and by direct execution of the architecture-level "outside the recorded decisions" control against the real gate and real repository.
- Criterion 2 (scope/limitation controls): proved by reading and cross-referencing the model/operations/contracts test suites, which name and test read, write-only, structural (whole-object), external-contract, type-only, computed-access and alias/pin categories explicitly.

One minor pre-existing observation, not a phase defect (already flagged in the phase's own `deferred-items.md` and in the known-context list): six `test-only-observed` disposition notes in `06-LIVE-TRIAGE.md` cite witness line numbers that drifted by a few lines after later test-file edits (`--check` does not compare note text against the fresh report, only that a note exists). This does not affect gate enforcement or exit status in any way — it is a documentation-freshness nit in a planning artifact.

---

_Verified: 2026-09-17T02:40:00Z_
_Verifier: Claude (gsd-verifier)_
