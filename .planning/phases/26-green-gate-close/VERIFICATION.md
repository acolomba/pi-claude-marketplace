# Phase 26 Verification: GREEN Gate Close (SNM-40)

**Verified:** 2026-05-30
**Phase:** 26-green-gate-close
**Plan:** 26-01
**Requirement:** SNM-40 (v1.4.1 milestone-close GREEN gate)

This is the verification + documentation evidence for the v1.4.1 (Post-ship UAT
Patches) milestone close. It records the clean-tree GREEN-gate result and locates
each SNM-33/34/35/36 regression test as a `file:case`, confirming each is GREEN.
No source, dependency, test, config, or version changes were made in this phase
(`package.json` stays at `0.2.0`, D-26-01).

## GREEN Gate Result (SC#1, SNM-40)

The working tree was confirmed clean (`git status --porcelain` printed nothing,
0 lines) immediately before the gate run, so the GREEN result is not an artifact
of local uncommitted state (D-26-03 step 1, clean checkout).

`npm run check` (typecheck + ESLint + Prettier + `npm test`) was run on the clean
tree:

| Stage | Command | Result |
| ----- | ------- | ------ |
| typecheck | `tsc --noEmit` | PASS |
| lint | `eslint .` | PASS |
| format | `prettier --check "**/*.{js,json,ts}"` (all matched files use Prettier code style) | PASS |
| test | `node --test "tests/{architecture,bridges,domain,edge,helpers,orchestrators,persistence,shared,transaction}/**/*.test.ts"` | PASS |

**`npm run check` exit code: `0`.**

`npm test` summary line (the unit/architecture track, NOT `test:integration`):

```
# tests 1137
# suites 3
# pass 1137
# fail 0
# cancelled 0
# skipped 0
# todo 0
```

**Recorded count: 1137 tests passing / 0 fail / 0 skipped / 0 todo.** This mirrors
the v1.4-close exit-0 + recorded-count format from
`.planning/phases/21-final-teardown-green-gate/21-04-SUMMARY.md` (which recorded
`npm run check` exit 0 at 1122 tests). The count grew from 1122 (v1.4 close) to
1137 here through the v1.4.1 regression-test additions landed in Phases 22-24
(SNM-33/34/35/36) plus the Phase 25 SNM-37/38/39 smoke/lock tests.

`package.json` `version` field verified unchanged at `0.2.0` (D-26-01): no version
bump, no `chore(release)` commit, no tag.

## SC#3 Out-of-Scope Note: fold-adoption integration test

`tests/integration/fold-adoption.test.ts` (phase-1 failure) is **explicitly out of
scope** for this gate (SC#3). It lives on the separate `npm run test:integration`
track (`node --test "tests/integration/**/*.test.ts"`), NOT on the `npm test`
glob that `npm run check` runs. The failure is pre-existing on the v1.4 baseline,
predates the v1.4.1 milestone, and is documented in
`.planning/phases/21-final-teardown-green-gate/21-04-REVIEW-FIX.md`; it is tracked
for a separate `/gsd-debug` session (STATE.md Deferrals). It does NOT block the
v1.4.1 close gate, and `npm run test:integration` was deliberately NOT run here.

## SNM → Regression-Test Inventory (SC#2, D-26-06)

Each SC#2-named regression test was located at execution time and re-confirmed
GREEN by re-running the three named test files directly:

```
node --test "tests/shared/notify-v2.test.ts" \
             "tests/orchestrators/plugin/install.test.ts" \
             "tests/architecture/catalog-uat.test.ts"
# tests 95 / # pass 95 / # fail 0 / # skipped 0 / # todo 0  --  exit 0
```

| SNM | Gap | Regression test `file:case` | Status |
| --- | --- | --------------------------- | ------ |
| SNM-33 | G-MIL-01/02/06 (reload-hint discipline: no trailer when no Pi-visible state change) | `tests/shared/notify-v2.test.ts` -- `"D-22-04 NEGATIVE: empty \`marketplace add\` ({status:'added', plugins:[]}) emits NO /reload trailer (SNM-33 / G-MIL-01)"` (line 793); `"D-22-04 NEGATIVE: empty \`marketplace remove\` ({status:'removed', plugins:[]}) emits NO /reload trailer (SNM-33 / G-MIL-02)"` (line 808); `"D-22-04 NEGATIVE: no-op \`marketplace update\` (all plugin rows skipped) emits NO /reload trailer (SNM-33 / G-MIL-06)"` (line 823). The three byte-equality no-trailer negative cases (one per empty `marketplace add` / `remove` / no-op `update`). | GREEN |
| SNM-34 | G-MIL-05 (resolver tier-1 plugin.json-version fallback) | `tests/orchestrators/plugin/install.test.ts` -- `"SNM-34: plugin.json version present, entry.version absent -> recorded state.version equals the plugin.json version verbatim (not a hash)"` (line 627). Marketplace entry.version omitted (tier 2 absent); the plugin's own plugin.json declares a version (tier 1) → the plugin.json tier fires, recorded verbatim, not a PI-7 hash. | GREEN |
| SNM-35 | G-MIL-08 (`v#<7hex>` git-style hash-version display) | `tests/shared/notify-v2.test.ts` -- `"notify renders single-version hash row as v#<7hex> via renderVersion chokepoint (SNM-35)"` (line 1677, persisted `hash-2ea95f85703d` → `v#2ea95f8`); `"notify renders update arrow with hash on both sides as #<7hex> → v#<7hex> via composeVersionArrow (SNM-35)"` (line 1706, `#2ea95f8 → v#1c3d9a0`); `"notify passes a SemVer version through unchanged -> v1.0.0 (non-hash pass-through guard, SNM-35)"` (line 1736). Plus the catalog byte-form fixtures in `tests/architecture/catalog-uat.test.ts` -- `"hash-version-list"` (line 421, list-surface inventory row `hash-2ea95f85703d` → `v#2ea95f8`) and `"hash-version-arrow"` (line 946, update arrow `#2ea95f8 → v#1c3d9a0`), both fed through `notify()` by the byte-equality catalog UAT runner (test 1, line ~30). | GREEN |
| SNM-36 | G-MIL-04 (`lsp` REASONS grammar -- camelCase `lspServers` → `lsp` in the emitted reason) | `tests/architecture/catalog-uat.test.ts` -- the `lsp` byte form appears in the `"single-mp-mixed"` fixture (line 226; `epsilon` plugin row `reasons: ["hooks", "lsp"]` at line 246) and the `"failure-unsupported-features"` fixture (line 479; `helper` plugin row `reasons: ["hooks", "lsp"]` at line 490), both asserted byte-equal against `docs/output-catalog.md` through `notify()` by the catalog UAT runner (test 1, line ~30). The emitted Reason renders `lsp`, not `lspServers`; the manifest-side JSON key `lspServers` is unchanged (D-24-09). | GREEN |

All four SNM regression surfaces are present in the suite and GREEN, satisfying
SC#2's "all present and GREEN" wording.

## Verdict

- SC#1 -- clean-tree `npm run check` exits 0 (typecheck + ESLint + Prettier + full `npm test`, 1137 passing): **MET**.
- SC#2 -- SNM-33/34/35/36 regression tests located as `file:case` and re-confirmed GREEN: **MET**.
- SC#3 -- `tests/integration/fold-adoption.test.ts` remains out of scope on the separate `npm run test:integration` track; the close gate is not blocked by it: **MET**.
- SNM-40 -- milestone-close GREEN gate proven on a clean checkout: **MET**.

The v1.4.1 milestone is ready for `/gsd-complete-milestone` (operator-initiated
archival is a separate step; not run in this phase, D-26-04).
