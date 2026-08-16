---
phase: 105-no-op-parity-sweep-and-contract-documentation
plan: 02
subsystem: tests/orchestrators
tags: [dfen-08, parity, characterization, reinstall, reconcile, fixture-helper]
status: complete

requires:
  - "tests/orchestrators/plugin/reinstall.test.ts::seedMarketplace (entryDefaultEnabled + applyDefaultEnabled knobs, unchanged)"
  - "tests/orchestrators/plugin/reinstall.test.ts::mergeManifestEntry (merges rather than overwrites, unchanged)"
  - "tests/orchestrators/plugin/update.test.ts::seedPathMarketplace (the already-widened sibling whose signature was copied)"
  - "105-01-SUMMARY.md (the tracer assertion shape this plan clones)"
provides:
  - "DFEN-08 three-plugin parity case for the bulk reinstall cascade (declared-false / declared-true / silent)"
  - "DFEN-08 three-plugin parity case for the load-time reconcile, including per-entry configuration results and a three-pass silent steady state"
  - "tests/orchestrators/reconcile/apply.test.ts::seedRealPathMarketplace in plugin-map form, matching its update-suite sibling, with all three callers converted"
affects:
  - "any future reconcile test needing a multi-plugin real path-source marketplace (the helper now takes a map)"

tech-stack:
  added: []
  patterns:
    - "whole-body `assert.equal` against a `+`-concatenated literal, one row per line"
    - "row-to-row equality with the plugin name normalized out, stated apart from the literals"
    - "per-ENTRY configuration assertions where a whole-file comparison is polluted by the declaring sibling"
    - "three-pass silence + byte-stable declaring config as the fixed-point expression"

key-files:
  created: []
  modified:
    - "tests/orchestrators/plugin/reinstall.test.ts (+154 lines, one new test)"
    - "tests/orchestrators/reconcile/apply.test.ts (+229/-36 lines: helper widening + three converted callers + one new test)"

decisions:
  - "The reinstall triple stages NO declaration flip. The flip discipline separates `never re-read the field` from `re-read it and got the same answer`, which the file's own DFEN-07 / D-103-10 case already pins for this verb; duplicating it would not widen DFEN-08's claim."
  - "The reinstall tally counting the informational skip as a success is commented in place, citing OUT-03 / D-04 / D-01 and the catalog's identical arithmetic for a different idempotent skip, so a later reader does not `fix` it."
  - "The reconcile parity case asserts configuration PER ENTRY, never whole-file: the declaring plugin's write-back rewrites the entire file, so a whole-file comparison reads as a parity break that is not one."
  - "The reconcile fixture helper was widened, not wrapped: no scalar signature survives beside the map, and all three callers were converted in the same commit with the suite green at an unchanged test count."
  - "The reconcile header and tally lines are fixture-shape lines rather than parity claims, and are commented as such: this fixture records the marketplace, so no `(added)` row is rendered and the tally counts three plugin rows."

metrics:
  duration: ~35 min
  completed: 2026-08-15
  tasks: 3
  commits: 3 (plus this docs commit)

actuals:
  tokens: 5800
  tasks: 3
  commits: 3
---

# Phase 105 Plan 02: No-op parity sweep (reinstall and reconcile surfaces) Summary

The two remaining DFEN-08 surfaces now carry the tracer's parity shape: on both `reinstall` and `reconcile`, an entry declaring the install-time default TRUE and an entry declaring nothing render byte-identical rows, asserted against each other and against the pre-milestone form, with reconcile additionally pinned per configuration entry and silent across three passes.

## What Was Built

**Task 1 — the reinstall triple (commit `06990ef5`).** One new test in `tests/orchestrators/plugin/reinstall.test.ts`, placed immediately after the existing bulk-cascade case.

- **Fixture:** one project-scope marketplace `mp` on a shared root, built by three `seedMarketplace` calls in name order (the file's own repeat-call idiom — `mergeManifestEntry` reads the existing manifest and merges, so the entries accumulate). `alpha` declares the default FALSE, `beta` declares it TRUE, `gamma` carries no declaration key. All three at `1.0.0`, all three with a single skill, all three installed through the production path with `applyDefaultEnabled: true`. The seeder needed no widening.
- **Precondition:** the three records landed disabled / enabled / enabled, asserted before the cascade runs.
- **Act:** one `reinstallPlugins` over `{ kind: "marketplace", marketplace: "mp" }`.
- **Assert:** outcome partitions in row order (`alpha:skipped`, `beta:reinstalled`, `gamma:reinstalled`); one notification with `severity === undefined` (taken from the run); the whole body equal to the literal recorded in the research probe; the parity claim stated separately (each row equal to its pre-milestone literal AND the two rows equal to each other with the plugin name normalized out); then the records unchanged in enablement.
- **The tally comment** states that `3 successes` over two reinstalled rows and one skip is correct — OUT-03 / D-04 count operation rows uniformly by stamped severity and the `already disabled` reason is idempotent and therefore info (D-01) — and points at the catalog's `Plugin reinstall: 1 failure, 2 successes` block where `(skipped) {up-to-date}` is one of the two successes.

**Task 2 — the fixture-helper widening (commit `7a2c0388`).** `seedRealPathMarketplace` in `tests/orchestrators/reconcile/apply.test.ts` changed from scalar `pluginName` + `version` to a `manifestPlugins` map keyed by plugin name, mirroring `seedPathMarketplace` in the update suite key for key. The body loops the map to write one plugin tree per entry, then emits ONE marketplace manifest holding every entry. The conditional-spread entry emission survives unchanged in spirit, so a map value omitting the knob writes NO `defaultEnabled` key — which is exactly the silent third arm. The declaration knob's doc comment was carried across and restated for the map form. All three call sites (`:1416`, `:1560`, `:1854` pre-change) were converted in the same commit; no scalar parameters remain.

**Task 3 — the reconcile triple (commit `3cb47c35`).** One new test in `tests/orchestrators/reconcile/apply.test.ts`, placed immediately after the fixed-point family and before the `DFEN-05 / D-102-04` case.

- **Fixture, four invariants held constant and commented:** all three plugins declared in config and absent from recorded state (fresh-install bucket); no `enabled` key on any of the three entries; all three declared in the same physical `claude-plugins.json`; one scope and one marketplace. The marketplace IS recorded, pointing at a real on-disk path clone outside the scope dir, so the installs materialize from cache with no network (NFR-5).
- **Pass 1:** exactly one notification (the anchor); the whole rendered body asserted as one equality; then the parity claim stated separately over the two extracted `(installed)` rows; then configuration asserted PER ENTRY — `alpha@mp` gained `{ enabled: false }` and nothing else, `beta@mp` and `gamma@mp` are still exactly `{}`; then the records (disabled / enabled / enabled).
- **Passes 2 and 3:** zero notifications and byte-identical declaring configuration each time, with the comment stating that the silence covers all three arms because a steady state quiet for one arm is not a fixed point.

No production file was touched, and no existing test was changed except the three converted call sites in Task 2.

## Recorded byte forms

Reconcile pass 1, whole body (this fixture, marketplace already recorded):

```text
● mp [project]
  ◍ alpha v1.2.3 (disabled) {installs disabled}
    Run enable on this plugin to use its components.
  ● beta (installed)
  ● gamma (installed)

Reconcile: 3 successes
```

The header and tally differ from the research probe's `● mp [project] (added)` / `Reconcile: 4 successes` for one fixture-shape reason only: the probe's marketplace was NOT yet recorded, so its cascade carried an extra `(added)` row and counted it. The three ROW lines — the parity claim — are identical to the probe's, including the `(installed)` rows carrying no version slot.

## Mutation checks (performed by hand, NOT committed)

**Task 1 — reinstall, both outcomes as required.**

- **(a) One-character break in a reinstalled row literal — MUST fail.** Changed `"  ● beta v1.0.0 (reinstalled)\n"` to `v1.0.1`. Result: `not ok 87`, `# fail 1`, and the assertion diff named the row directly (`+ '  ● beta v1.0.0 (reinstalled)\n'` / `- '  ● beta v1.0.1 (reinstalled)\n'`). Reverted.
- **(b) Silent plugin's seeded declaration changed from absent to `true` — MUST still pass.** Added `entryDefaultEnabled: true` to `gamma`'s seeder call. Result: `ok 87`, `# pass 90`, `# fail 0`. That is the parity claim being TRUE rather than the assertion being blind. Reverted.

**Task 3 — reconcile, all three outcomes as required.**

- **(a) One-character break in an installed row literal — MUST fail.** Changed `"  ● beta (installed)\n"` to `(installedd)`. Result: `not ok 32`, `# fail 1`, diff naming the row. Reverted.
- **(b) An enablement key added to the silent plugin's config entry — MUST fail, proving the invariant is load-bearing rather than decorative.** Changed `"gamma@mp": {}` to `"gamma@mp": { enabled: true }`. Result: `not ok 32`, failing at `DFEN-08: a silent entry gains no configuration key` with `+ { enabled: true }` against `- {}`. Reverted.
- **(c) Silent plugin's seeded declaration changed from absent to `true` — MUST still pass.** Added `entryDefaultEnabled: true` to `gamma`'s map value. Result: `ok 32`, `# pass 34`, `# fail 0`. Reverted.

Neither file carries any mutation in the committed tree; both were re-run green after the reverts.

## Verification

| Check | Result |
|-------|--------|
| `node --test tests/orchestrators/plugin/reinstall.test.ts tests/orchestrators/reconcile/apply.test.ts` | 124 tests, 124 pass, **0 fail** |
| `node --test tests/orchestrators/plugin/reinstall.test.ts` | 90 pass, 0 fail (89 pre-existing + 1 new) |
| `node --test tests/orchestrators/reconcile/apply.test.ts` — before Task 2 | 33 tests, 33 pass, 0 fail |
| `node --test tests/orchestrators/reconcile/apply.test.ts` — after Task 2 (conversion alone) | 33 tests, 33 pass, 0 fail — **unchanged count**, so the conversion is shown behavior-preserving |
| `node --test tests/orchestrators/reconcile/apply.test.ts` — after Task 3 | 34 tests, 34 pass, 0 fail |
| `npx tsc --noEmit` | clean after every task — the strict compiler is what proves every caller was converted |
| `npx eslint` on both files | clean |
| `npx prettier --check` on both files | passes |
| `grep -c 'DFEN-08'` | `reinstall.test.ts` 6, `apply.test.ts` 5 |
| `grep -c 'manifestPlugins' tests/orchestrators/reconcile/apply.test.ts` | 6 (parameter + 2 body uses + 3 converted call sites) |
| Remaining `pluginName` in a parameter list or call site | none — the only occurrences are the helper's own loop variables |
| `git diff --name-only -- extensions/` | empty — no production file touched |
| Added lines matching `\b(Phase\|Plan\|Wave\|Pitfall\|Milestone) [0-9]` | none |
| `pre-commit run --files <each file>` | all applicable hooks Passed (TruffleHog skipped per the worktree rule) |
| TruffleHog filesystem scan, both files | exit 0, `verified_secrets: 0`, `unverified_secrets: 0` |

The full `npm test` / `npm run check` phase gate is deliberately NOT run here — a sibling plan is mid-edit in this shared worktree (`docs/output-catalog.md`, `tests/architecture/catalog-uat.test.ts` are modified and not mine) and the orchestrator owns the wave boundary.

## Deviations from Plan

None. The plan executed as written and the sweep uncovered no parity break, so the prohibition against changing production behavior was never in tension with anything.

Three points where a criterion was satisfied in a way worth naming precisely:

- **The reconcile header and tally lines.** The plan asked for these to be derived from the actual first-pass render rather than hand-guessed. They were obtained by running the fixture; the resulting literal was correct on the first execution, and the test's own whole-body equality is what confirms it. They are commented in place as fixture-shape lines rather than parity claims, so a later reader does not mistake them for part of the contract.
- **The `.includes(` prohibition inside the body-comparison region.** The row extractor uses `String.prototype.startsWith` on the full row prefix (`"  ● beta "`), not substring containment, in both new tests.
- **The row-to-row equality operands** are both derived from the rendered body (`rows.find(...)` over `body.split("\n")`), not from the literals, so the comparison is a genuine coincidence claim rather than a restatement.

## Known Stubs

None.

## Threat Flags

None. No file under `extensions/` was modified, no network endpoint, auth path, file-access pattern or schema changed, and the asserted byte forms hold only frozen closed-set literals and fixture-authored plugin names.

The register's `T-105-01` (a release flipping the declaration to re-enable a disabled plugin) and `T-105-05` (a reconcile assertion passing over a fixture that never reached the path under test) are both addressed as planned: the three-pass silence is the reconcile half of the first, and the mutation check that adds an enablement key and goes red is what proves the second's invariants are load-bearing.

## Self-Check: PASSED

- `tests/orchestrators/plugin/reinstall.test.ts` — FOUND, contains `DFEN-08`
- `tests/orchestrators/reconcile/apply.test.ts` — FOUND, contains `DFEN-08` and `manifestPlugins`
- Commits `06990ef5`, `7a2c0388`, `3cb47c35` — all FOUND in `git log`
- `git diff --name-only -- extensions/` — empty, as claimed
