---
phase: 01-manifest-read-fidelity
plan: 02
subsystem: domain
tags: [plugin-manifest, dependencies, info, notify, output-catalog, typescript]

# Dependency graph
requires: []
provides:
  - "DeclaredDependency and parseDeclaredDependencies — the pure element parser over the untrusted dependencies field, in domain/dependencies.ts"
  - "renderDependencyList — the info-side fill-in, collapse, sort and render, replacing normalizeDependencies"
  - "installed-single-scope-with-dependency-constraints — the catalogued byte form of the constraint parenthetical"
affects: [01-04, dependency-resolution, install-provenance]

actuals:
  tokens: 7960
  tasks: 3
  commits: 5
plan_head_before: 4c261338db53016a857a7cad22688cf3a7b96f83

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Positive-allowlist validation of every field that renders verbatim into a line-oriented notification row; an element failing any allowlist is dropped whole, never half-rendered"
    - "Pure domain parser over an untrusted Type.Unknown() field, with the caller-side resolution rules (marketplace fill-in, collapse, ordering, byte form) kept out of it"
    - "A new output byte form lands as a catalog state and its fixture in one commit, because the catalog walk is gated in each direction"

key-files:
  created:
    - extensions/pi-claude-marketplace/domain/dependencies.ts
    - tests/domain/dependencies.test.ts
  modified:
    - extensions/pi-claude-marketplace/orchestrators/plugin/info.ts
    - extensions/pi-claude-marketplace/shared/notify.ts
    - tests/orchestrators/plugin/info.test.ts
    - docs/output-catalog.md
    - tests/architecture/catalog-uat.test.ts

key-decisions:
  - "The parser validates all four rendered fields against positive allowlists, not just name and marketplace: version and sha render verbatim into the same row, so a newline or an escape in either forges a row (D-01-33, threat T-01-03)."
  - "A present-but-unrenderable field drops the WHOLE element rather than the field, which is what keeps the plan's prohibition intact — a declared constraint is never silently removed while the rest of the element renders."
  - "Optional-field validation runs as one loop over a (key, pattern) table rather than three repeated blocks, which keeps both cognitive-complexity ceilings satisfied without a threshold override."
  - "withDeclaringMarketplace returns a local AddressedDependency (marketplace required), so the collapse key and the rendered address read the field directly instead of carrying a `?? \"\"` fallback that could never fire."
  - "The collapse uses a Map keyed on name@marketplace: set() overwrites the value (last-wins, D-01-31) while KEEPING the first insertion position, which is exactly what makes the D-01-04 name-tie ordering the post-collapse declaration order."
  - "The exact-count assertion was read out of the failing test (183), not derived from grep -c over the catalog, which returns 187 because the scanner does not promote every annotation to an example."

patterns-established:
  - "Parse-then-resolve split: the domain parser answers only 'is this element usable and what did it declare'; every question whose answer depends on WHO is reading (fill-in, dedup, ordering, display) belongs to the caller."
  - "Sort on the identity field, not the rendered string, so display-form changes cannot reorder a list."
  - "notify.ts stays a dumb renderer: a change to what a line can contain is a doc-comment change there and a construction change in the orchestrator."

requirements-completed: [DEPS-01, DEPS-02]

coverage:
  - id: D1
    description: "An object-shaped {name, version, marketplace} dependency reaches the rendered info line carrying its version constraint."
    requirement: DEPS-01
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/info.test.ts#DEPS-01: an object dependency renders its own marketplace, not the declaring one"
        status: pass
      - kind: unit
        ref: "tests/domain/dependencies.test.ts#an object element yields its name, version and marketplace"
        status: pass
    human_judgment: false
  - id: D2
    description: "A dependencies array mixing bare strings and objects lists every usable element; nothing is filtered out."
    requirement: DEPS-02
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/info.test.ts#DEPS-02: a mixed array of strings and objects lists every usable element"
        status: pass
      - kind: unit
        ref: "tests/domain/dependencies.test.ts#a mixed array yields one entry per usable element in declaration order"
        status: pass
    human_judgment: false
  - id: D3
    description: "A bare string's trailing @^range renders as a constraint instead of being discarded with the rest of the element."
    requirement: DEPS-02
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/info.test.ts#D-01-27: a bare string's trailing range renders as a constraint"
        status: pass
      - kind: unit
        ref: "tests/domain/dependencies.test.ts#a bare string carrying a trailing range keeps the range as a version"
        status: pass
      - kind: unit
        ref: "tests/domain/dependencies.test.ts#a bare string carrying both an address and a range splits into all three fields"
        status: pass
    human_judgment: false
  - id: D4
    description: "An element declaring no marketplace renders with the declaring plugin's filled in; one already carrying an address keeps it, so the existing catalogued helper@utils-mp line stays byte-valid."
    requirement: DEPS-01
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/info.test.ts#D-01-02: an element declaring no marketplace takes the declaring plugin's"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/info.test.ts#INFO-02: manifest entry's `dependencies: string[]` field surfaces as `    dependencies: ...` line LAST after components"
        status: pass
      - kind: unit
        ref: "tests/architecture/catalog-uat.test.ts#catalog UAT: every <!-- catalog-state: --> annotation pairs byte-equal with notify()"
        status: pass
    human_judgment: false
  - id: D5
    description: "The constraint parenthetical renders per D-01-30: a version bare, a sha labelled and short-formed to 7, both in one parenthetical with the version first, neither as the bare address."
    requirement: DEPS-01
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/info.test.ts#D-01-30: a sha alone renders labelled and short-formed to seven characters"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/info.test.ts#D-01-30: a version and a sha share one parenthetical, version first"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/info.test.ts#D-01-30: an element declaring no constraint renders the bare address"
        status: pass
    human_judgment: false
  - id: D6
    description: "Two elements resolving to one name@marketplace collapse to a single row, the last declaration winning, and the discarded one is not surfaced."
    requirement: DEPS-02
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/info.test.ts#D-01-31: two elements resolving to one address collapse, the last winning"
        status: pass
    human_judgment: false
  - id: D7
    description: "The list is ordered by dependency name, not by the rendered display string; a name tie keeps post-collapse declaration order."
    requirement: DEPS-02
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/info.test.ts#D-01-04: the list orders by dependency name, not by the rendered string"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/info.test.ts#D-01-04: two entries sharing a name keep their declaration order"
        status: pass
    human_judgment: false
  - id: D8
    description: "Every rendered field is matched against a positive ASCII allowlist, so no manifest text can inject a newline, an ANSI escape, a bidi mark or a quote into a notification row (threat T-01-03)."
    requirement: DEPS-02
    verification:
      - kind: unit
        ref: "tests/domain/dependencies.test.ts#an element whose name or marketplace fails the allowlist is dropped"
        status: pass
      - kind: unit
        ref: "tests/domain/dependencies.test.ts#an element whose present version or sha is unrenderable is dropped whole"
        status: pass
    human_judgment: false
  - id: D9
    description: "An empty dependencies array, or one whose every element is unusable, omits the dependencies: line entirely."
    requirement: DEPS-02
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/info.test.ts#D-01-05: an array whose every element is unusable omits the line"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/info.test.ts#normalizeDependencies: empty `dependencies: []` array omits the line"
        status: pass
    human_judgment: false
  - id: D10
    description: "The new byte form is a catalogued output state with a matching catalog-uat FIXTURES entry, landed in the same change."
    requirement: DEPS-01
    verification:
      - kind: unit
        ref: "tests/architecture/catalog-uat.test.ts#catalog UAT: every <!-- catalog-state: --> annotation pairs byte-equal with notify()"
        status: pass
      - kind: other
        ref: "grep -c installed-single-scope-with-dependency-constraints docs/output-catalog.md -> 1; same over tests/architecture/catalog-uat.test.ts -> 2"
        status: pass
    human_judgment: false

# Metrics
duration: 56 min
completed: 2026-09-13
status: complete
---

# Phase 1 Plan 2: Dependency display fidelity Summary

**`info` now lists every usable element of a plugin's `dependencies` array — object-shaped and bare-string alike — carrying whichever constraint it declared, parsed by a pure `domain/dependencies.ts` that allowlists all four rendered fields before any of them reaches a notification row.**

## Performance

- **Duration:** 56 min
- **Started:** 2026-09-13T16:47:00Z
- **Completed:** 2026-09-13T17:43:00Z
- **Tasks:** 3
- **Files modified:** 7 (2 created, 5 modified)

## Accomplishments

- `normalizeDependencies` is gone. It filtered the array to `typeof d === "string"`, which dropped every object entry outright and threw away a bare string's trailing `@^range` along with the rest of the element. Both now reach the line.
- `domain/dependencies.ts` is a pure, marketplace-agnostic parser returning `readonly DeclaredDependency[]`. It handles both upstream element shapes, splits a bare string in upstream's own precedence order, and reads `version` and `sha` off the object arm even though upstream declares neither in its schema.
- All four rendered fields go through a positive allowlist before they leave the parser (`name`/`marketplace` on upstream's verbatim token rule, `version` and `sha` on D-01-33's). An element failing any of them is dropped whole, so no constraint is ever quietly removed while the rest of its element renders.
- `renderDependencyList` owns the four caller-side rules: the declaring-marketplace fill-in, the last-wins collapse on the resolved address, the sort on dependency name, and the D-01-30 constraint parenthetical.
- The byte form is a user contract: `installed-single-scope-with-dependency-constraints` in `docs/output-catalog.md`, byte-equal with a `FIXTURES` entry driven through the real `notify()`, with the section index and the exact-count assertion moved in the same commit.
- `notify.ts` stayed a dumb renderer — its diff is nine comment lines and no executable change.

## Task Commits

1. **Task 1: The dependency element parser** — `e1b70e8e` (test, RED), `72121f93` (feat, GREEN)
2. **Task 2: info renders every declared dependency with its constraint** — `35104877` (test, RED), `e61660b6` (feat, GREEN)
3. **Task 3: Record the new byte form as a catalogued output state** — `6849fc49` (docs)

No REFACTOR commit on either TDD task: both implementations were already decomposed into small named helpers and passed both complexity gates on their first green run, so there was nothing to clean up without inventing churn.

## Files Created/Modified

- `extensions/pi-claude-marketplace/domain/dependencies.ts` — the element parser: `DeclaredDependency`, `parseDeclaredDependencies`, and the three allowlists.
- `tests/domain/dependencies.test.ts` — the mandatory pair; 14 cases, one per behavior row, plus the type-level prelude.
- `extensions/pi-claude-marketplace/orchestrators/plugin/info.ts` — `renderDependencyList` and its three helpers replace `normalizeDependencies`; the `buildBlock` call site passes the already-in-scope `marketplace`.
- `extensions/pi-claude-marketplace/shared/notify.ts` — doc comment on `PluginInfoComponentsResolved.dependencies` only.
- `tests/orchestrators/plugin/info.test.ts` — 11 new cases (insertions only).
- `docs/output-catalog.md` — the new catalog state (insertions only).
- `tests/architecture/catalog-uat.test.ts` — the matching fixture, the section index entry, and the count at 183.

## Decisions Made

- **All four fields get the allowlist, not two.** D-01-25 claimed the output-forgery vector closed as a side effect of validating `name` and `marketplace`; it does not, because `version` and `sha` render verbatim into the same line-oriented row. The plan's `<planner_derived_extension>` and the ratified D-01-33 agree, and the implementation follows both.
- **A bad field drops the element, not the field.** This is what makes the plan's single prohibition enforceable: there is no code path that renders an element while removing a constraint it declared.
- **Collapse via `Map.set`, deliberately.** `set()` overwrites the value while keeping the key's first insertion position. That single property gives last-wins (D-01-31) and post-collapse declaration order for a name tie (D-01-04) at once, with no second bookkeeping structure.
- **`AddressedDependency` rather than `?? ""`.** Once the fill-in has run, `marketplace` is always present, but `DeclaredDependency` cannot say so. A local interface with the field required removes a fallback branch that could never fire and would have been untestable.
- **The count came from the failing assertion.** `grep -c 'catalog-state:' docs/output-catalog.md` returns 187; the scanner promotes 183 of those to examples. Reading the number out of the test's own message is the only method that cannot be off by four.

## Deviations from Plan

None — plan executed as written. Two implementation details differ from the plan's prose without changing its behavior, and both are recorded above rather than as deviations: the optional-field validation is one table-driven loop instead of three per-field checks, and the fill-in returns a narrowed local type.

## Issues Encountered

- **Three lint findings on the first parser draft**, all mechanical and fixed before the GREEN commit: `consistent-indexed-object-style` on a mapped type (replaced with a plain interface), `dot-notation` on four `record["key"]` reads, and a then-orphaned `OptionalField` type alias.
- **`toSorted` was not available.** `tsconfig.json` sets `target: ES2022` with no `lib` override, so the ES2023 array method does not typecheck. Switched to `[...arr].sort(...)`, which is also what the neighbouring comparators in `info.ts` use.
- **TruffleHog cannot run in this linked worktree.** Its pre-commit entry is a git-mode scan and `.git` here is a file, so it aborts structurally on every run. Confirmed clean by the documented filesystem route before each commit, then skipped with `SKIP=trufflehog`. `pre-commit run --all-files` is green apart from this one hook.

## Verification Run

- `npm run check` — exit 0. All nine links: typecheck, lint, fallow, format:check, test:corresponding, test:corresponding:negative, test:coverage:direct:negative, test (5334 unit tests), test:integration (31 tests).
- `npm run fallow` — exit 0; no `health` finding against any new function, and no new `duplicates` clone group. `.fallowrc.json` still carries zero `thresholdOverrides`.
- `node --test tests/domain/dependencies.test.ts` — 14/14.
- `node --test tests/orchestrators/plugin/info.test.ts` — 140/140.
- `node --test tests/architecture/catalog-uat.test.ts` — 6/6, no `ORPHAN FIXTURE`, no byte mismatch.
- `pre-commit run --all-files` — every hook Passed except the structural TruffleHog worktree abort.
- RED evidence for both TDD tasks verified `RED_EVIDENCE_OK` via `gsd-tools check tdd-red-evidence`: 11 of 14 target cases failing on assertions in Task 1, 10 of 11 new cases in Task 2 (the eleventh pins pre-existing behavior and correctly stayed green).

## Known Stubs

None.

## Threat Flags

None. The plan's `<threat_model>` assigns `mitigate` to T-01-03 and T-01-05; both are implemented in `domain/dependencies.ts` and covered by D8 above. No new network endpoint, auth path, file access pattern or schema change at a trust boundary was introduced — this plan reads an already-parsed manifest field and writes nothing to disk.

## Next Phase Readiness

- Plan 01-04 changes only WHERE the raw `dependencies` value is read from (D-01-32, `plugin.json` preferred over the marketplace entry when readable without network). Everything this plan built sits downstream of that expression and needs no change: `renderDependencyList` takes `unknown`.
- Dependency-resolution work reuses `parseDeclaredDependencies` as-is. Two rules implemented here are display-only and must NOT be copied across manifests: the last-wins collapse (upstream accumulates and intersects ranges instead) and the declaring-marketplace fill-in. Both carry that warning in their doc comments.
- No blockers.

## Self-Check: PASSED

Every file this summary claims was created exists on disk, and all five task commits resolve in `git log`. `git diff` on `shared/notify.ts` is comment lines only.

---

*Phase: 01-manifest-read-fidelity*
*Completed: 2026-09-13*
