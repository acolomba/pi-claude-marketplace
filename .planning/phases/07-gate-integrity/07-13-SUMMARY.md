---
phase: 07-gate-integrity
plan: 13
subsystem: tests/architecture
tags: [gate, test-only-surface, walking-scan, GGAT-04]
status: complete

requires:
  - "07-02 (ScanReport.visited, assertNoForbiddenSurface opts.root, temp-root-control.ts)"
  - "07-10 (removed ReplaceReinstalledPluginInput.__operations)"
  - "07-12 (removed ReinstallPluginDeps and both __deps members)"
provides:
  - "tests/architecture/no-test-only-production-surface.test.ts — a walking gate over every .ts module under the extension tree that rejects a `__`-prefixed member declaration, a returning `_set…ForTest` seam, and a returning `__test_` re-export"
  - "A live classification assertion for the eleven classified-and-kept typed optional collaborator seams"
affects:
  - "07-15 (unowned-export census — this plan adds and removes ZERO exported symbols; see the export delta below)"
  - "07-16 (registry reconciliation — two registry groups this gate needed and could not add; see Registry gaps below)"

tech-stack:
  added: []
  patterns:
    - "Walked target list rooted at the registry's EXTENSION_ROOT_REL, with a non-zero count assertion and a ScanReport.visited deep-compare (D-07-03)"
    - "Structural carve-out written as a De Morgan alternation, so a conjunction (`declare const` AND `unique symbol`) can be negated by one regular expression"
    - "Registry-membership type annotation on a locally declared path literal, the NETWORK_FREE_CONTROL_TARGET idiom"

key-files:
  created:
    - tests/architecture/no-test-only-production-surface.test.ts
  modified: []

key-decisions:
  - "The gate keys on MEMBER POSITION, not on the `__` character sequence. A naive prefix scan over extensions/ does not return zero — it returns bridges/mcp/safe-set.ts's `key === \"__proto__\"` prototype-pollution defense and the MCP protocol's `mcp__server__tool` naming. Firing on a security control would be worse than shipping no gate."
  - "The brand carve-out is a conjunction (`declare const` AND `: unique symbol`), and a regex negates one condition at a time, so it is written as its De Morgan equivalent. Negating either half alone would be wider than the brand form: `declare const __deps: Bag` and `readonly __brand: unique symbol` must both still fail, and under the alternation they do."
  - "Neither the module that declares the brand nor the brand's identifier is named anywhere in the gate file (both greps return 0), so the carve-out cannot degrade into a file-based or name-based exclusion."
  - "The two retired spellings (`_set…ForTest`, `__test_`) ride in the same pattern list rather than a gate of their own — same class, different door — and each has its own firing control, so neither pattern is a vacuous pass."
  - "Tasks 1 and 2 landed in one commit: both edit the same single file, a sibling executor shares this working tree, and an intermediate state of one test file buys nothing."

requirements-completed: [GGAT-04]

coverage:
  - deliverable: "A walking gate proves no `__`-prefixed member survives under the extension tree"
    human_judgment: false
    verification:
      - kind: test
        ref: "tests/architecture/no-test-only-production-surface.test.ts#MF-DEC-07 + D-05-01: no test-only substitution member survives under the extension tree"
        status: pass
      - kind: command
        ref: "node --test tests/architecture/no-test-only-production-surface.test.ts (10 tests, 0 fail)"
        status: pass
  - deliverable: "The gate fires on an offender derived from a real production module"
    human_judgment: false
    verification:
      - kind: test
        ref: "tests/architecture/no-test-only-production-surface.test.ts#the gate fires on a `__`-prefixed member planted in a copy of a real module"
        status: pass
      - kind: command
        ref: "A `readonly __probeMember?: string` appended to the real orchestrators/plugin/fetch.ts — real-tree case failed, then restored (see Observations)"
        status: pass
  - deliverable: "The gate does not fire on the prototype-pollution defense or on the MCP tool-naming convention"
    human_judgment: false
    verification:
      - kind: command
        ref: "Real-tree scan over 229 walked modules returns 0 offenders while `git grep -c '__' extensions/**/*.ts` reports 38 matching lines across 16 files"
        status: pass
      - kind: test
        ref: "tests/architecture/no-test-only-production-surface.test.ts#a `__`-prefixed member inside a line comment passes, so the gate still strips comments"
        status: pass
  - deliverable: "The nominal-type brand is carved out structurally, and the carve-out is not name-based or file-based"
    human_judgment: false
    verification:
      - kind: test
        ref: "tests/architecture/no-test-only-production-surface.test.ts#a `declare const … : unique symbol` brand passes, so the nominal-type form stays legal"
        status: pass
      - kind: test
        ref: "tests/architecture/no-test-only-production-surface.test.ts#the same brand identifier declared as an interface member fails, so the carve-out is structural"
        status: pass
      - kind: command
        ref: "grep -c 'plugin-root' → 0; grep -c '__absolutePluginRootBrand' → 0"
        status: pass
  - deliverable: "Every classified-and-kept optional seam is a live assertion rather than a silence"
    human_judgment: false
    verification:
      - kind: test
        ref: "tests/architecture/no-test-only-production-surface.test.ts#D-05-01: every classified-and-kept collaborator seam still exists in its module"
        status: pass
      - kind: test
        ref: "tests/architecture/no-test-only-production-surface.test.ts#D-05-01: renaming a classified-and-kept seam drops it from the classification"
        status: pass
  - deliverable: "The gate clears the two complexity ceilings, the formatter, and the whole architecture suite"
    human_judgment: false
    verification:
      - kind: command
        ref: "npx fallow health --fail-on-issues --format human → 0 above threshold, 12773 analyzed"
        status: pass
      - kind: command
        ref: "npm run typecheck (exit 0); npx eslint tests --max-warnings=0 (exit 0); npx prettier --check 'tests/architecture/*.ts'"
        status: pass
      - kind: command
        ref: "node --test 'tests/architecture/*.test.ts' → 393 tests, 0 fail"
        status: pass

metrics:
  duration: "9 min"
  completed: 2026-09-10

actuals:
  tokens: 62000
  tasks: 2
  commits: 1
  plan_head_before: f8c0dad4ad7faf5a31b289f86fc3ac9d2ac64e80
---

# Phase 07 Plan 13: Test-Only Production Surface Gate Summary

A walking scan over all 229 `.ts` modules under `extensions/pi-claude-marketplace/`
rejects a `__`-prefixed member declaration, keyed on member position rather than on
the character sequence, with the nominal-type brand carved out by its
`declare const … : unique symbol` form and no allow-list anywhere.

## Accomplishments

- **The gate walks rather than names.** Its target list comes from a recursive walk
  rooted at the registry's `EXTENSION_ROOT_REL`, so a module nobody thought to
  enumerate is still covered. The walk asserts a non-zero file count and the scan's
  `ScanReport.visited` is deep-compared against the walked list (`D-07-03`), which is
  what separates *visitation* from *firing*.
- **The discriminator is structural.** A naive `__`-prefix scan over `extensions/`
  does **not** return zero. It returns `bridges/mcp/safe-set.ts`'s
  `if (key === "__proto__")` — the prototype-pollution defense — and the MCP
  protocol's `mcp__<server>__<tool>` naming in the hooks payload and if-field family.
  Both are `__`-bearing; neither is a member declaration. The pattern requires a
  `__`-prefixed identifier in **member position** (start of line or a separator, an
  optional `readonly`, then a `?:` or `:` annotation), and the separator set excludes
  `[` and `"`, so a computed property key and a string literal are both outside it.
- **The brand carve-out matches the form, not the file or the name.** The exclusion
  is the conjunction `declare const` **AND** `: unique symbol`. A regular expression
  negates one condition at a time, so it is written as its De Morgan equivalent —
  match when the declaration keyword is absent, **or** when the annotated type is not
  `unique symbol`. Negating either half alone would be wider than the brand form.
  Two cases pin both arms: the brand form passes, and the *same identifier* declared
  as an interface member fails.
- **The two retired spellings are gated by the same file.** `_set…ForTest` and
  `__test_`-prefixed identifiers join the same pattern list over the same walked
  list, on comment-stripped source. Each has its own firing control, so neither is a
  pattern that reports success having matched nothing.
- **The classified-and-kept set is a live assertion.** Eleven optional collaborator
  seams under `extensions/` are deliberately kept and are not matched by the
  patterns. Silence would not distinguish them from surface the pattern happens to
  miss, so a case names each one and asserts it still occurs in its module's
  comment-stripped source. A rename control proves the case actually fires.

## The offenders were both already gone, by design

`D-07-18` sequenced this gate after the two removals so it lands green against a tree
that satisfies it. Measured on the committed tree:

| Check | Result |
|-------|--------|
| `git grep -c '__operations' -- . ':!.planning'` | 0 files |
| `git grep -c '__deps' -- . ':!.planning'` | 0 files |
| `git grep -c '@internal' -- extensions` | 0 files |
| `git grep -c '__' -- 'extensions/**/*.ts'` | 38 matching lines across 16 files |
| Gate's own offender count over those 229 modules | **0** |

The 38 remaining lines are the reason the discriminator exists: 16 in the if-field
MCP matcher, 4 in `safe-set.ts`, 2 in the brand module, and the rest split between
MCP-naming prose and comments recording that the `__test_` re-export pattern was
removed. None is a member declaration.

## Observations (the negative controls, run live)

**1. Planted offender against the REAL tree.** A `readonly __probeMember?: string`
inside an appended `ProbeOptions` interface was written to the real
`extensions/pi-claude-marketplace/orchestrators/plugin/fetch.ts`, the suite re-run,
and the file restored from a byte copy (`git status` clean afterwards, no `git
checkout` used). Observed: **4 of 10 cases failed**, `pass 6 / fail 4`. The real-tree
case failed with

```
AssertionError [ERR_ASSERTION]: MF-DEC-07 / D-05-01 violation: test-only
substitution surface declared on production module(s):
```

and the three temp-root benign controls failed too — expected, and further evidence
the controls are **derived from the real file** rather than hand-authored: mutating
the real module propagates into every copy made from it.

**2. Renamed kept seam.** `replaceOperations` is renamed away in a temp-root copy of
`reinstall-flow.ts` and the classification case reports that entry missing. This
lives in the file as case 10 rather than as a one-off manual observation, so the
proof re-runs on every suite invocation instead of expiring with this summary.

**3. Both retired spellings.** `_setCloneCacheForTest` and `__test_cloneCache` were
each planted into a real module's copy and each made the gate reject.

## Export delta (for the unowned-export census)

**Zero exported symbols added, zero removed.** `grep -cE '^export '` over the new
file returns `0` — every constant, interface, and helper in it is module-private,
including `TEST_ONLY_MEMBER`, `FORBIDDEN_PATTERNS`, `CLASSIFIED_SEAMS`,
`walkExtensionModules`, `presentSeams`, and `renameSeamInCopy`. The census pin needs
no adjustment for this plan.

## fallow-ignore census (unchanged)

Identical listings before and after, 11 markers across 10 files, matching the eleven
the codebase documentation censuses:

```
extensions/pi-claude-marketplace/bridges/hooks/async-rewake/registry.ts:1
extensions/pi-claude-marketplace/domain/components/hook-events.ts:1
extensions/pi-claude-marketplace/domain/resolver-types.ts:3
extensions/pi-claude-marketplace/orchestrators/marketplace/add.messaging.ts:1
extensions/pi-claude-marketplace/orchestrators/marketplace/remove.messaging.ts:1
extensions/pi-claude-marketplace/orchestrators/plugin/reinstall-replace.ts:1
extensions/pi-claude-marketplace/shared/notify-reasons.ts:1
scripts/revalidation.mjs:1
tests/live-uat/manifest-absence-canary.mjs:1
tests/live-uat/stop-canary.mjs:1
```

The new file adds none (`grep -c 'fallow-ignore'` → 0), and carries no `test.only` /
`test.skip` / `test.todo` and no coverage-ignore directive.

## Registry gaps for 07-16

`tests/architecture/gate-targets.ts` was unowned this wave, so two groups this gate
wanted could not be added. Both are recorded here rather than improvised:

1. **`CLASSIFIED_KEPT_SEAM_TARGETS`** — the six modules carrying the classified-kept
   seams. Four (`install-flow.ts`, `fetch.ts`, `info.ts`, `reinstall-flow.ts`) are
   already in `NETWORK_FREE_TARGETS`; two (`marketplace/add.ts`,
   `marketplace/update.ts`) are already in `MARKETPLACE_LEDGER_TARGETS`. The gate
   therefore declares each path as a local literal **annotated with its registry
   group's member type** (`(typeof NETWORK_FREE_TARGETS)[number]`), the same idiom
   `NETWORK_FREE_CONTROL_TARGET` uses. The annotation is a compile-time membership
   check: a path the group does not name stops compiling, so these references cannot
   drift away from the registry even though the literal lives in the gate file.
2. **`TEST_ONLY_SURFACE_CONTROL_TARGETS`** — a dedicated control subset. The gate
   currently derives its control targets from the classified-seam module set, which
   is defensible (they are the production surface this gate is about) but would read
   better as its own registry group.

One member could not be asserted at all: **`ReinstallReplacement.operations`** is
declared in `orchestrators/plugin/reinstall-replace.ts`, and that module is in **no**
registry group. Rather than compose a path outside the registry, the gate asserts
`replaceOperations` on `reinstall-flow.ts` (which consumes it at the production call
site and IS registry-named); a rename of the declaration breaks that consumer, so the
classification still fires. Adding `reinstall-replace.ts` to a registry group would
let the declaration itself be asserted.

## Deviations from Plan

**1. [Minor divergence] The non-zero walk count is asserted in the `assert` phase,
not before the scan**

- **Found during:** Task 1
- **Plan text:** "Assert the walk returned a non-zero file count before scanning."
- **What shipped:** The assertion is the first statement of the `// assert` phase,
  matching `no-orchestrator-network.test.ts`'s house form.
- **Why:** `.claude/rules/typescript-unit-testing.md` requires `// arrange`, `// act`,
  `// assert` in that order with assertions in the assert phase. The outcome is
  identical — an empty walk makes `assert.deepEqual(report.visited, modules)` compare
  `[]` against `[]` and pass, so the count assertion is exactly what saves the case
  either way, whichever side of the scan it sits on.
- **Files modified:** `tests/architecture/no-test-only-production-surface.test.ts`
- **Commit:** `3412d600`

**2. [Rule 3 - Blocker] Tasks 1 and 2 landed in one commit**

- **Found during:** Task 2
- **Issue:** Both tasks edit the same single file and Task 2 has no separable
  intermediate state. Splitting would have meant authoring the gate, committing it,
  then re-opening it — with a sibling executor sharing this working tree and running
  whole-repo `npm-typecheck` / `npm-lint` / `npm-fallow` hooks throughout.
- **Fix:** One commit carrying both tasks' content, with each task's acceptance
  criteria verified independently before it.
- **Files modified:** `tests/architecture/no-test-only-production-surface.test.ts`
- **Commit:** `3412d600`

**Total deviations:** 2 (1 minor divergence from plan wording, 1 commit-granularity
blocker). **Impact:** none on the shipped behaviour — every `must_have` truth,
prohibition, and acceptance criterion is satisfied.

## Shared-tree notes

`SKIP=trufflehog pre-commit run --files tests/architecture/no-test-only-production-surface.test.ts`
was run before the commit. Three runs were needed: the whole-repo hooks
(`pass_filenames: false`) twice flagged files owned by the concurrent sibling
executor — `npm lint` reported "files were modified by this hook" while
`tests/domain/plugin-resolver.test.ts`, `tests/orchestrators/marketplace/update.test.ts`,
`tests/orchestrators/plugin/info.test.ts`, `tests/orchestrators/plugin/reinstall-flow.test.ts`,
and `tests/shared/notification-dispatch.test.ts` were mid-write, and `npm format check`
named `tests/architecture/partial-vocabulary-guard.test.ts`. None is in this plan's
`files_modified`. Verified independently: `npm run lint` exits 0 and
`npx prettier --check` reports the new file clean. No file outside
`files_modified` was edited, and no `.planning/STATE.md`, `.planning/ROADMAP.md`,
`eslint.config.js`, `.fallowrc.json`, or `tests/architecture/gate-targets.ts` change
was made.

## Known Stubs

None.

## Threat Flags

None. This plan creates one test module, modifies no production code, installs no
package, and touches no `package.json` line.

## Issues Encountered

None.

## Next Phase Readiness

Ready. `GGAT-04`'s `__`-prefixed clause is gated. Plan 07-15 should note the zero
export delta above; plan 07-16 should reconcile the two registry groups and the
`reinstall-replace.ts` registry gap.

## Self-Check: PASSED

- `tests/architecture/no-test-only-production-surface.test.ts` exists on disk (479 lines).
- `git log --oneline --all | grep 3412d600` resolves — `test(07-13): gate test-only substitution surface under extensions`.
- Task 1 acceptance criteria: 10 passing cases (≥ the 6 required); `git grep -c '__'` recorded above beside the gate's offender count of 0; planted offender observed failing the real-tree case and restored; `grep -c 'plugin-root'` → 0; `grep -c '__absolutePluginRootBrand'` → 0; `grep -c 'mkdtemp'` → 0; `fallow-ignore` listings identical before and after.
- Task 2 acceptance criteria: the classification case names all eleven kept seams and the rename control fires; both retired spellings asserted over the walked list on comment-stripped source; `node --test "tests/architecture/*.test.ts"` → 393 pass, 0 fail; the zero `__operations` / `__deps` counts are recorded above.
- Plan-level verification: `node --test "tests/architecture/*.test.ts"` exit 0; `npm run typecheck && npx eslint tests --max-warnings=0` exit 0; `npx fallow health --fail-on-issues` → "0 above threshold"; the planted member was observed failing the real-tree case.
