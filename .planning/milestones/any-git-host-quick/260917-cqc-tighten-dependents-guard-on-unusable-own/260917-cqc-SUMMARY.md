---
quick_id: 260917-cqc
phase: quick-260917-cqc
plan: 01
subsystem: orchestrators/plugin (dependents guard)
tags: [uninstall, prune, dependency-index, D-05-07, IN-05, IN-06]
status: complete
requirements: [PRUNE-05]
dependency_graph:
  requires: [D-05-06, D-05-07, D-01-07, T-05-04]
  provides: [refuseUnusableOwnManifest option, OwnManifestRead readable|absent|unusable]
  affects: [uninstall.ts::assertNoDependents, --prune sweep, reconcile uninstall refusal (D-05-16)]
tech_stack:
  added: []
  patterns: [discriminated three-arm read result, opt-in caller rule via `?: true` option]
key_files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/orchestrators/plugin/dependency-declaration-read.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/dependency-index.ts
    - tests/orchestrators/plugin/dependency-declaration-read.test.ts
    - tests/orchestrators/plugin/dependency-index.test.ts
    - tests/orchestrators/plugin/uninstall.test.ts
    - docs/dependency-resolution.md
    - docs/output-catalog.md
    - .planning/phases/05-prune-on-uninstall/05-REVIEW-FIX.md
decisions:
  - "IN-05 = tighten (D-05-07): the dependents index refuses on a present-but-unusable own manifest; the cascade keeps the D-01-07 entry fallback"
  - "IN-06 = accept: `unreadable` stays the refusal token; no closed-set amendment"
metrics:
  duration: ~35 min
  completed: 2026-09-17
actuals:
  tokens: 7100
  tasks: 3
  commits: 2
plan_head_before: 84d36daced61728c569d33051a6e1e31bbb40b89
---

# Quick 260917-cqc: Tighten the dependents guard on an unusable own manifest — Summary

The dependents guard now fails closed on a declarer whose own `plugin.json` is present but cannot be parsed or stat'd, instead of letting a silent marketplace entry answer "declares nothing" for it; the install cascade's read is unchanged.

## Commits

| SHA | Title | Files |
| --- | --- | --- |
| `8a17e159` | `fix(uninstall): refuse when a declarer's own manifest cannot be read` | the 2 production, 3 test, 2 docs paths |
| `fda3bc8e` | `docs(review): settle IN-05 as fixed and IN-06 as accepted` | `.planning/phases/05-prune-on-uninstall/05-REVIEW-FIX.md` only |

`git diff 84d36dac HEAD --name-only` lists exactly the eight `files_modified` paths. `install-flow.ts` has no diff. The operator's uncommitted edits (`.claude/settings.json`, `.codex/config.toml`, `.planning/config.json`, `.planning/state.json`) and untracked files were not staged or touched.

## What changed

**`dependency-declaration-read.ts`** — `OwnManifestRead` is `readable | absent | unusable` (module-scope frozen `ABSENT` / `UNUSABLE` constants). `parseOwnManifest` returns `UNUSABLE` on a parse throw or non-object payload; `readManifestCandidate` returns `UNUSABLE` for every errno other than ENOENT/ENOTDIR and still uses `undefined` as the only continue-the-walk answer; `readOwnManifest` returns `ABSENT` when the walk ends with nothing; a `pluginRoot === undefined` (containment refusal, syscall refusal, cold clone, npm/unknown source) is `ABSENT`. New option `refuseUnusableOwnManifest?: true`; when set and the own read is `unusable`, the function returns `{ kind: "unusable", detail: "its own manifest is present but cannot be read" }` — a fixed phrase, no path, no manifest text, no chained cause (T-05-04). Without the option the fallback line is unchanged, so option-off behavior is byte-for-byte the same. Header paragraph (D-01-06 / D-01-07) and the `OwnManifestRead` / `parseOwnManifest` / `readDependencyDeclaration` doc comments state the three arms and the two caller rules in present tense.

**`dependency-index.ts`** — `readRecordDeclarations` passes `refuseUnusableOwnManifest: true`; the existing `unusable` arm maps it to `unreadableDeclarer(key, read.detail)`, so the rendered cause line is `cannot read the dependencies of <key>: its own manifest is present but cannot be read`. Header rewritten to the tightened rule (absent → entry answers, D-05-06; present-but-unusable → fail closed, D-05-07; cascade keeps D-01-07). `ScopeDeclarationIndexResult` doc lists the fourth reason.

**Docs** — `docs/dependency-resolution.md`: the "The check reads the declarations" paragraph now lists four unreadable conditions, distinguishes a plugin with no manifest file (entry answers; silent entry = declares nothing) from one whose manifest file exists but cannot be read (never counts as declaring nothing), and adds "repair its manifest file" to the remedy. `docs/output-catalog.md` (`refused-declarer-unreadable` prose): trigger list, cause-trailer list and remedy extended; the fenced example block is byte-identical (catalog byte lock 28_543 / 212 states unchanged — `npm run check` green).

**`05-REVIEW-FIX.md`** — new section `## Operator decisions settled (2026-09-17)` with IN-05 fixed (commit `8a17e159`, files, applied change, three test titles, two docs paragraphs, accepted cost) and IN-06 accepted (four-part rationale with the actual grep findings, re-open trigger). Iteration-1 frontmatter and summary untouched.

## TDD Gate Compliance

### RED (Task 1, against HEAD `84d36dac`, raw TAP via `node --test --test-reporter=tap`)

Exactly five `not ok` lines, all top-level `test()` cases (no `describe`):

```text
not ok 9 - D-05-07: a corrupt own manifest beside a silent entry ends the walk naming the record
# pass 13
# fail 1
not ok 14 - D-05-07: with refuseUnusableOwnManifest, an unparseable first candidate is the unusable arm, not the entry
not ok 15 - D-05-07: with refuseUnusableOwnManifest, an EACCES stat on the first candidate is the unusable arm, not the entry
not ok 16 - D-05-07: with refuseUnusableOwnManifest, a JSON-array payload is the unusable arm, not the entry
# pass 25
# fail 3
not ok 73 - D-05-07: a record whose own manifest is present but unreadable refuses the uninstall
# pass 86
# fail 1
```

Failure shapes matched the plan's expected RED state: the index case failed at `assert.equal(walk.ok, false)` with `true !== false`; the three read rows failed with a deepStrictEqual diff showing the actual `{ kind: 'found', dependencies: [{ marketplace: 'mp', name: 'from-entry' }] }` (the entry fallback); the uninstall row failed with the actual success block (`○ helper v0.0.1 (uninstalled)` + `/reload to pick up changes`) instead of the refusal. The two `D-05-06: with refuseUnusableOwnManifest, ... still falls back to the entry` negative-control rows were `ok 17` / `ok 18` before and after the change, as intended. Raw TAP files: scratchpad `red-index.tap`, `red-read.tap`, `red-uninstall.tap`. Task 1 was not committed on its own (the option was not yet on the type, so `tsc` would have been red).

### GREEN (Task 2)

`node --test` over the three suites plus `tests/architecture/manifest-read-agreement.test.ts`: 138/138 pass.

### REFACTOR

None needed beyond the doc-comment reflow in `dependency-index.ts`.

## Gate results

| Gate | Result |
| --- | --- |
| `npm run test:coverage:direct:commit` | `dependency-declaration-read.ts` 100% (branches 52/52, functions 9/9, lines 289/289); `dependency-index.ts` 100% (branches 24/24, functions 4/4, lines 196/196); `uninstall.ts` 100% (branches 123/123, functions 26/26, lines 1263/1263). The three recorded shortfalls (`convert.ts`, `commands/discover.ts`, `install-outcome.ts`) are the pre-existing pinned ones and matched the pin exactly. |
| `scripts/test-coverage-direct.pin.json` | **Not touched.** No shortfall was introduced on any changed pair. |
| `npm run check` (before commit 1) | exit 0 — typecheck, lint, fallow, format, corresponding, coverage-direct negative, unit 6526/6526, integration 32/32 |
| `SKIP=trufflehog pre-commit run --files <7 paths>` (before commit 1) | exit 0, no rewrites |
| `SKIP=trufflehog pre-commit run --all-files` (before commit 1) | exit 0, 0 Failed, no rewrites |
| `SKIP=trufflehog pre-commit run --files 05-REVIEW-FIX.md` (before commit 2) | exit 0 |
| `SKIP=trufflehog pre-commit run --all-files` (before commit 2) | exit 0, 0 Failed, no rewrites |
| `git diff --quiet HEAD -- .../install-flow.ts` | exit 0 (cascade untouched) |
| Post-commit deletion check | no deletions in either commit |

## Deviations from Plan

**1. [Rule 1 - accuracy] IN-06 rationale part (3) records the actual grep, not the plan's summary of it.** The plan said `grep -rn '"unreadable"' extensions/` would show "the two stamp sites in `uninstall.ts` plus the closed-set catalog". The grep returns 30 hits. In `uninstall.ts` there are three (the D-05-07 throw at line 255, the `narrowCascadeFailure` pass-through at 288, the ATTR-09 fallback at 318); the rest are the two closed-set files and other verbs' own stamps or a different discriminant (`selection.kind === "unreadable"` is a config-probe kind). `reconcile/apply.ts::isRefusedUninstall` narrows on `instanceof UninstallRefusedError`, not on the reason. The conclusion the plan drew — nothing branches on the bare reason value — holds and is what the record states, with the real hit list. No code change.

**2. Variable naming in the new test cases.** The existing cases in both suites use `result`; the new cases use `declaration` / `walk` per `skills/typescript-unit-testing` ("Do not use `result`"). Existing cases were not renamed (surgical-change rule).

No other deviations. No auth gates. No package installs.

## Known Stubs

None.

## Threat Flags

None. No new network endpoint, auth path, path construction, or schema change. T-05-04 is proven by the index case asserting the exact message and `cause.cause === undefined`; T-05-05 holds (roots still come from `path.resolve` + `assertPathInside` or the warm-cache probe; a refused root is the `absent` arm; `dependency-index.ts` still contains no `join(`).

## Self-Check: PASSED

- `[ -f ]` on all eight modified paths: FOUND
- `git log --oneline --all | grep 8a17e159`: FOUND
- `git log --oneline --all | grep fda3bc8e`: FOUND
- `commits: 2` measured as `git rev-list --count 84d36dac..HEAD` = 2
