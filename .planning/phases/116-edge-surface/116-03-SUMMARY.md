---
phase: 116-edge-surface
plan: "03"
subsystem: testing
tags: [node-test, edge, completions, resolver-seam, offline, mod-09]
status: complete

requires:
  - phase: 116-edge-surface
    provides: "116-00's hermetic-scope shape in tests/orchestrators/edge-deps.test.ts — two mkdtemp roots, own-property environment restore registered before the act, and a context-owned fail-fast transport asserted by call count"
  - phase: 116-edge-surface
    provides: "116-04's G1/G6 case shape for edge/completions — hand-authored whole-value literals, lowercase arrange/act/assert phases"
provides:
  - "tests/edge/completions/data.test.ts — the sole mirrored direct owner for edge/completions/data.ts, at 100 percent direct functions and lines and 109/110 branches"
  - "a typed-fake LocationsResolver seeded per case (state records, manifest rows, and per-scope read failures), reusable verbatim by 116-05's completion-provider owner"
  - "the measured correction that the partial option is NOT an install/update-only narrowing: it SHIFTS the install set (drops remote, admits partially-available) and narrows uninstall, reinstall, enable, and disable identically to update"
  - "the measured correction that tests/architecture/scope-order-drift.test.ts walks extensions/ only, so a hand-authored scope literal in a test file is not gated"
  - "a fifth D-116-01a-class unreachable branch, outside the phase's four-claimant list: the coalesce fallback at data.ts:188"
affects: []

actuals:
  tokens: 47000
  tasks: 1
  commits: 1

tech-stack:
  added: []
  patterns:
    - "Typed fake over an injected resolver interface: one plain object with arrow properties checked by `satisfies LocationsResolver`, seeded from a per-case `ResolverSeed` that carries marketplace records, manifest rows, and per-scope read failures. Arrow properties, not methods, so a case can destructure without tripping unbound-method"
    - "A counter exposed on an interface must be declared `readonly f: () => number`, not `f(): number` — a method signature makes every destructuring site an unbound-method error even though the value is a closure"
    - "Map results compared as `Array.from(map)` against a hand-authored array of entry pairs: whole-value AND order-sensitive, where `deepStrictEqual` on the Map itself would not pin the iteration order the completion UI depends on"
    - "Order and stability proved by seeding non-alphabetical names and a repeated equal name, then asserting the exact output order — a sort or a dedupe anywhere in the chain fails it"
    - "Every case, including the pure-helper cases, installs the fail-fast transport and asserts a zero call count; the pure cases skip the temporary roots because the helper reaches no filesystem"

key-files:
  created: []
  modified:
    - tests/edge/completions/data.test.ts

key-decisions:
  - "DEVIATION — the plan's `must_haves` claim that the partial option 'narrows the install and update sets rather than widening any other mode' is FALSE against the module, in two separate ways. First, install: INSTALL_STATUSES is {available, remote} and PARTIAL_INSTALL_STATUSES is {available, partially-available}, so the option DROPS the not-yet-fetched row and ADMITS the degraded one — neither a narrowing nor a widening but a shift, and the production comment at data.ts:361 still says 'widens' (stale since `remote` joined the base set). Second, `options.partial` is passed through to getInstalledPluginToMarketplacesMap for uninstall, reinstall, enable, and disable exactly as for update (data.ts:509), so it narrows all five. A case asserting 'every other mode's set unchanged' could only have been made green by asserting something untrue. Written instead: one case proving the install shift by name, and a five-row matrix proving the identical narrowing for all five installed-inventory modes"
  - "DEVIATION — the plan's stated reason for reading the accepted scope values off the shared declaration does not hold. tests/architecture/scope-order-drift.test.ts walks `extensions/` only (its `walkTsFiles` root is `path.join(repoRoot, 'extensions')`), so a hand-authored scope literal in a test file is not gated; four existing test files already carry one. Reading SCOPES to drive extractScope's rows would also have made the row set collapse to zero cases if the constant were ever emptied, and extractScope hard-codes its own `=== \"user\" || === \"project\"` check independently of SCOPES. The accepted values are therefore two hand-authored named rows"
  - "DEVIATION — 'all twelve exports have their own top-level group' is not satisfiable. data.ts exports eight runtime values and four types (PluginRefCompletionMode, LocationsResolver, MarketplaceStateRecord, PluginMapOptions); a describe() with no runtime case is not a group. All eight runtime exports have a top-level describe. The four types ride real usage — LocationsResolver as the `satisfies` target of the fake, MarketplaceStateRecord in the seed type, PluginMapOptions on two options literals, PluginRefCompletionMode on the mode row list — rather than being restated, which the 'usage is not a property of a type' rule forbids anyway"
  - "DEVIATION — the plan's stability proof ('two candidates compare equal on the field the module orders by') has no target: the module performs no ordering by any field. It preserves caller order in getMarketplaceCompletions and Map insertion order everywhere else. Reframed to the equivalent falsifiable claim: a name list seeded non-alphabetically WITH a repeated equal element comes back in exactly that order, repeat in place. Plant C confirms a `.sort()` breaks it"
  - "DEVIATION — the plan's 'seed the failure in the first scope in one case and the second in another, so a short-circuit is visible' overstates what getMarketplaceNamesAcrossScopes does. It uses Promise.all over SCOPES.map, so both scope reads are always started; there is no short-circuit to observe. Both cases were kept because they prove a genuinely different thing — the rejection from EITHER scope reaches the caller by identity rather than degrading to a partial union"
  - "The direct-coverage gate reports 109/110 branches. The single uncovered branch is the right-hand side of `allTokens.at(-1) ?? \"\"` at data.ts:188, which is unreachable through the exports: `splitCompletionInput` has already returned for `input === \"\"` and for any input ending in whitespace, and any other non-empty input has a non-whitespace final character, so `split(/\\s+/).filter(t => t !== \"\")` is never empty. Confirmed three ways — by construction, by a brute-force probe over all 65,536 BMP code points in five shapes (0 hits), and by Plant F, which changed the fallback and left all 66 cases GREEN. 116-03 is not a D-116-01a claimant, so this is reported rather than pinned, and no coverage exception was added"
  - "No production file was touched. Six plants were applied to extensions/pi-claude-marketplace/edge/completions/data.ts and reverted individually with `git checkout --`; `git status --short` on that path was empty after each. The pinned-path check (`git diff --quiet` over data.ts, the three handler shared.ts files, flag-catalog.ts, and tests/helpers/notification-boundary.ts) exited 0 before staging, and `git log -1 --stat` shows one file changed"
  - "resetCompletionCache() is called on entry to every resolver-backed case and again in the registered teardown. The plugin-index memory map is process-global and keyed by scope plus marketplace name, and several cases reuse the name `official`, so a case that skipped the reset would read a sibling case's rows"

patterns-established:
  - "When a plan promises 'option X leaves mode Y unchanged', read the dispatch: an option threaded into a shared private helper reaches every mode that helper serves, whatever the caller-discipline comment says. Here `partial` is documented 'Only ever true for install/update' and is honoured by five more modes"
  - "A test file is not covered by an architecture guard that walks the production tree. Check the guard's own root before accepting 'the guard forbids it' as a reason to shape a test a particular way"
  - "An anti-pattern scan matches substrings inside prose. A case title reading 'the only scope that has any' contains `as any` and tripped the plan's own verify block; titles need the same read-through as code"

requirements-completed: [MOD-09]

coverage:
  - deliverable: "tests/edge/completions/data.test.ts owns all eight runtime exports of edge/completions/data.ts"
    human_judgment: false
    verification:
      - kind: test
        ref: "tests/edge/completions/data.test.ts — 66 runtime cases from 44 marked case bodies, 8 top-level describes, pass 66 fail 0"
        status: pass
      - kind: command
        ref: "npm run test:coverage:direct -- extensions/pi-claude-marketplace/edge/completions/data.ts → lines 610/610, functions 31/31, branches 109/110 (was 493/610, 25/31, 54/64)"
        status: pass
  - deliverable: "Candidate output is compared unsorted and whole, in the order the module produced it, with equal elements kept in place"
    human_judgment: false
    verification:
      - kind: test
        ref: "tests/edge/completions/data.test.ts — 'preserves the caller's order and repeats an equal name in place', 'an installed-inventory mode without an explicit scope reads project before user', 'info spans both scopes with no status filter and ignores the target scope'"
        status: pass
      - kind: other
        ref: "Plant C added .sort() to getMarketplaceCompletions → 1 case RED; Plant D flipped the sweep scope order → 1 case RED. Both reverted"
        status: pass
  - deliverable: "Prefix matching is case-sensitive with no case folding and no Unicode normalization"
    human_judgment: false
    verification:
      - kind: test
        ref: "tests/edge/completions/data.test.ts — 'matches the partial token case-sensitively, with no case folding' (marketplace names) and 'the plugin half matches the partial token case-sensitively, with no case folding'"
        status: pass
  - deliverable: "A state read failure in either scope propagates by identity rather than yielding a partial candidate list"
    human_judgment: false
    verification:
      - kind: test
        ref: "tests/edge/completions/data.test.ts — 'propagates a user state read failure instead of a partial union', 'propagates a project state read failure instead of a partial union', 'a state read failure during the candidate sweep propagates (TC-9)'"
        status: pass
  - deliverable: "The surface never reaches the network"
    human_judgment: false
    verification:
      - kind: test
        ref: "tests/edge/completions/data.test.ts — all 66 cases assert the fail-fast transport call count is 0"
        status: pass
  - deliverable: "Six D-116-04 plants applied, measured, and reverted"
    human_judgment: false
    verification:
      - kind: other
        ref: "Plants A/B/C/D/E went RED (1, 4, 1, 1, 1 case respectively); Plant F stayed GREEN by design and is the unreachability finding. git status --short on the production path empty after each revert"
        status: pass
  - deliverable: "No production file and no shared test helper changed"
    human_judgment: false
    verification:
      - kind: command
        ref: "git diff --quiet -- data.ts, edge/handlers/shared.ts, edge/handlers/marketplace/shared.ts, edge/handlers/plugin/shared.ts, edge/flag-catalog.ts, tests/helpers/notification-boundary.ts → exit 0"
        status: pass
  - deliverable: "The paired source reaches 100 percent direct branches"
    human_judgment: true
    rationale: "NOT achieved. 109/110. The remaining branch is provably unreachable through the module exports and closing it needs a production edit this plan may not make (both production licences are spent). The operator must decide whether data.ts:188 joins the D-116-01a claimant list, is rewritten in a later phase, or is accepted as a standing 109/110"
---

# Phase 116 Plan 03: Completion Data Owner Summary

The completion data layer is now owned through a typed fake of its own `LocationsResolver` seam: every
candidate map is seeded with all nine derived plugin-index statuses, compared as an ordered array of
entry pairs against a hand-authored literal, and proven offline by call count. The paired source moved
from 493/610 lines, 25/31 functions, and 54/64 branches to **610/610 lines, 31/31 functions, and
109/110 branches**.

## Accomplishments

- **Rewrote `tests/edge/completions/data.test.ts`** — 66 runtime cases from 44 marked case bodies in 8
  top-level `describe()` groups, replacing 13 flat cases that asserted `map.has(...)` one key at a
  time, sorted candidate lists before comparing them, and left six exported functions unreached.
- **Reached all eight runtime exports.** `extractScope`, `getMarketplaceCompletions`, and the whole of
  `getPluginRefCompletions` had no case at all; `getPluginToMarketplacesMap` reached only three of its
  four dispatch arms.
- **Built one typed fake resolver per case** — a plain object with arrow properties checked by
  `satisfies LocationsResolver`, seeded from a `ResolverSeed` carrying marketplace state records,
  manifest rows, and per-scope read failures. No hand-rolled filesystem simulation; the only real disk
  the module touches is the completion cache, which writes under a temporary root the case owns.
- **Seeded every derived status in one manifest** (`everyStatusManifest()`, nine rows) and asserted the
  exact candidate set per mode, so each map discriminates instead of merely returning rows. Install,
  fetch, info, and the five installed-inventory modes each get their own expected list.
- **Compared every candidate list unsorted and whole** as `Array.from(map)` against a hand-authored
  array of entry pairs — order-sensitive, unlike `deepStrictEqual` on a `Map`.
- **Proved the two scope-sweep orders differ**: `info` walks `SCOPES` (user then project) while the
  status-filtered sweep walks `["project", "user"]`. Both are asserted by output order.
- **Proved case-sensitive prefix matching** on both the marketplace-name filter and the plugin half,
  each by a pair of inputs differing only in letter case.
- **Proved the manifest soft-fail and the state hard-fail separately** — an unreadable manifest
  contributes no candidates and does not fail the completion (TC-8); a state read failure in either
  scope reaches the caller by object identity (TC-9).
- **Asserted a zero network call count in all 66 cases**, by count, never by message.

## Task Commits

| Task | Name | Commit | Files |
| ---- | ---- | ------ | ----- |
| 1 | Rewrite the completion data owner with a typed fake resolver and full per-export coverage | `a3b00c88` | `tests/edge/completions/data.test.ts` |

## Plants (D-116-04)

Six plants were applied to `extensions/pi-claude-marketplace/edge/completions/data.ts`, measured, and
reverted one at a time with `git checkout --`. `git status --short` on that path was empty after each.

### Plant A — remove the cross-scope name deduplication (mandated)

Mutation at `data.ts:298`: `return Array.from(new Set(perScope.flat()));` → `return perScope.flat();`

Result: **RED**, `pass 65 fail 1`.

```text
  ✖ unions both scopes in first-seen order and records a shared name once (38.518013ms)
ℹ tests 66
ℹ pass 65
ℹ fail 1
✖ failing tests:
✖ unions both scopes in first-seen order and records a shared name once (38.518013ms)
  + actual - expected
    actual: [ 'zeta', 'shared', 'shared', 'beta' ],
    expected: [ 'zeta', 'shared', 'beta' ],
```

### Plant B — drop the trailing space on the unique-plugin branch (mandated)

Mutation at `data.ts:532`: `buildItem(argumentTextPrefix, \`${name}@${mps[0]}\`, true)` → `..., false)`

Result: **RED**, `pass 62 fail 4`.

```text
✖ the plugin half offers a fully qualified value for a plugin unique to one marketplace (21.724937ms)
  AssertionError [ERR_ASSERTION]: Expected values to be strictly deep-equal:
        label: 'solo@mp-a',
  +     value: 'update solo@mp-a'
  -     value: 'update solo@mp-a '
    actual: [ { label: 'solo@mp-a', value: 'update solo@mp-a' } ],
    expected: [ { label: 'solo@mp-a', value: 'update solo@mp-a ' } ],
✖ the plugin half keeps every candidate in map order when the partial token is empty (8.542264ms)
✖ the plugin half matches the partial token case-sensitively, with no case folding (11.201985ms)
✖ the plugin half honours the target scope and the partial option it is given (6.666705ms)
```

### Plant C — sort one candidate list before returning it (mandated)

Mutation at `data.ts:247`: a `.sort()` inserted between the filter and the map in
`getMarketplaceCompletions`.

Result: **RED**, `pass 65 fail 1`. This is the stability proof: the repeated equal element stays in
place, but the seed order does not survive a sort.

```text
✖ preserves the caller's order and repeats an equal name in place (2.78762ms)
    actual: [ { label: 'alpha', value: 'alpha ' }, { label: 'zeta', value: 'zeta ' }, { label: 'zeta', value: 'zeta ' } ],
    expected: [ { label: 'zeta', value: 'zeta ' }, { label: 'alpha', value: 'alpha ' }, { label: 'zeta', value: 'zeta ' } ],
```

### Plant D — flip the status-filtered sweep's scope order

Mutation at `data.ts:417`: `["project", "user"]` → `["user", "project"]`.

Result: **RED**, `pass 65 fail 1`.

```text
✖ an installed-inventory mode without an explicit scope reads project before user (10.219551ms)
    actual: [ [ 'user-side', [Array] ], [ 'project-side', [Array] ] ],
    expected: [ [ 'project-side', [Array] ], [ 'user-side', [Array] ] ],
```

### Plant E — remove the marketplace deduplication in `addMapping`

Mutation at `data.ts:313`: the `if (!existing.includes(marketplace))` guard removed, leaving a bare
`existing.push(marketplace)`.

Result: **RED**, `pass 65 fail 1`. The reported `[Array]` elision hides the diff, but the case that
fails is the one whose whole promise is the single entry.

```text
✖ a marketplace named in both scopes is recorded once for the same plugin (17.479695ms)
    actual: [ [ 'held', [Array] ] ],
    expected: [ [ 'held', [Array] ] ],
```

### Plant F — mutate the coalesce fallback at `data.ts:188` (GREEN by design; this is the finding)

Mutation: `const current = allTokens.at(-1) ?? "";` → `... ?? "@@unreached@@";`

Result: **GREEN**, `pass 66 fail 0`. No case reaches the fallback because no input can. See the
finding below.

## Finding: one unreachable branch, outside the D-116-01a claimant list

`npm run test:coverage:direct` reports `branches 109/110`. The single uncovered branch is
`BRDA:188,11` — the right-hand side of `allTokens.at(-1) ?? ""` in `splitCompletionInput`.

It cannot be reached through the module's exports:

1. `input === ""` returns before line 188.
2. Any input whose last character matches `\s` returns at the `trailingSpace` branch.
3. Any other non-empty input therefore ends in a non-whitespace character, so
   `input.split(/\s+/).filter(t => t !== "")` has at least one element and `at(-1)` is a string.
   The two regexes use the same `\s` class, so no character can satisfy one and not the other.

Confirmed empirically as well: a brute-force probe over all 65,536 BMP code points in five shapes
(`c`, `cc`, `" "+c`, `c+" "`, `" "+c+" "`) found **0** inputs satisfying
`input !== "" && !/\s$/.test(input) && split/filter is empty`. Plant F confirms it from the other
direction — changing the fallback leaves every case green.

This is the same compiler-forced shape D-116-01a covers: `at(-1)` is typed `string | undefined`, and
neither `!` nor `as` is available in `extensions/`, so removing the coalesce means a rewrite. **116-03
is not a D-116-01a claimant and both production licences are spent**, so no coverage exception was
added, no pin was written, and no production edit was made. The operator decides whether `data.ts:188`
joins the claimant list, is rewritten later, or stands at 109/110.

## Deviations from Plan

### 1. [Rule 1 - False plan claim] `partial` does not narrow only install and update

- **Found during:** Task 1, writing the mode matrix
- **Issue:** The plan's `must_haves` truth and its action both require asserting that the partial
  option "narrows the install and update sets" and "leaves every other mode's set unchanged". Both
  halves are false. `PARTIAL_INSTALL_STATUSES` is `{available, partially-available}` against a base
  `INSTALL_STATUSES` of `{available, remote}`, so install SHIFTS — it loses the not-yet-fetched row
  and gains the degraded one. And `data.ts:509` threads `options.partial` into
  `getInstalledPluginToMarketplacesMap` for uninstall, reinstall, enable, and disable exactly as for
  update, so the narrowing applies to all five. The production comment at `data.ts:361` still reads
  "widens the install candidate set", stale since `remote` joined the base set.
- **Fix:** Wrote the true behavior — one install case naming the shift by plugin name, and a five-row
  matrix proving the identical narrowing for every installed-inventory mode. Added a `fetch` case that
  calls with and without `partial` and asserts the two results are equal, which is the real
  "ignores partial" claim.
- **Files modified:** `tests/edge/completions/data.test.ts`
- **Verification:** 66/66 pass; the five partial rows and the install shift case are all discriminating
- **Commit:** `a3b00c88`

### 2. [Rule 1 - False plan premise] the scope-order guard does not scan test files

- **Found during:** Task 1, `extractScope`
- **Issue:** The plan directs taking the accepted scope values from the shared declaration "because
  `tests/architecture/scope-order-drift.test.ts` forbids a hand-rolled scope-order literal". That guard
  walks `path.join(repoRoot, "extensions")` only. Four existing test files carry the literal.
- **Fix:** Two hand-authored named rows instead. Reading `SCOPES` would also have made the row set
  collapse to zero cases if the constant were emptied, and `extractScope` hard-codes its own
  `=== "user" || === "project"` check independently of `SCOPES`.
- **Files modified:** `tests/edge/completions/data.test.ts`
- **Verification:** `npm test` green (5037/5037, 291 suites), including `scope-order-drift`
- **Commit:** `a3b00c88`

### 3. [Rule 1 - Unsatisfiable plan claim] twelve exports, eight of which are runtime

- **Found during:** Task 1, planning the group layout
- **Issue:** "All twelve exports have their own top-level group" cannot hold: four of the twelve are
  types (`PluginRefCompletionMode`, `LocationsResolver`, `MarketplaceStateRecord`, `PluginMapOptions`),
  and a `describe()` with no runtime case is not a group. Restating their shape would also violate the
  "usage is not a property of a type" rule.
- **Fix:** Eight `describe()` groups, one per runtime export. The four types carry real load —
  `LocationsResolver` is the `satisfies` target of the fake, `MarketplaceStateRecord` types the seed,
  `PluginMapOptions` types two options literals, `PluginRefCompletionMode` types the mode row list.
- **Files modified:** `tests/edge/completions/data.test.ts`
- **Verification:** `npm run typecheck` exit 0
- **Commit:** `a3b00c88`

### 4. [Rule 1 - Plan claim with no target] the stability proof was reframed

- **Found during:** Task 1
- **Issue:** The plan asks for "one case where two candidates compare equal on the field the module
  orders by". The module orders by no field — it preserves caller order and Map insertion order.
- **Fix:** Reframed to the equivalent falsifiable claim: a name list seeded non-alphabetically with a
  repeated equal element comes back in exactly that order, repeat in place. Plant C confirms.
- **Files modified:** `tests/edge/completions/data.test.ts`
- **Verification:** Plant C RED
- **Commit:** `a3b00c88`

### 5. [Rule 1 - Overstated plan framing] no short-circuit exists in the cross-scope union

- **Found during:** Task 1
- **Issue:** The plan says seeding a failure in the first scope versus the second makes "a short-circuit
  visible". `getMarketplaceNamesAcrossScopes` uses `Promise.all(SCOPES.map(...))`, so both reads always
  start; there is nothing to short-circuit.
- **Fix:** Kept both cases, retitled to the claim that actually holds — the rejection from EITHER scope
  reaches the caller by object identity rather than degrading to a partial union.
- **Files modified:** `tests/edge/completions/data.test.ts`
- **Verification:** both cases assert `error === stateFailure`
- **Commit:** `a3b00c88`

### 6. [Rule 3 - Blocker] a case title tripped the plan's own anti-pattern scan

- **Found during:** Task 1 verification
- **Issue:** The title `"returns the names of the only scope that has any"` contains the substring
  `as any` (inside "h**as any**"), which the plan's `! rg -n` link forbids. The scan exited 0 and the
  negated link would have failed the verify block.
- **Fix:** Retitled to `"returns the names when only one scope holds a marketplace"`.
- **Files modified:** `tests/edge/completions/data.test.ts`
- **Verification:** the scan now exits 1 (no match), so the negated link passes
- **Commit:** `a3b00c88`

### 7. [Rule 3 - Blocker] the offline counter had to be declared as a property

- **Found during:** Task 1 verification
- **Issue:** Declaring `networkCallCount(): number` as a method on the returned interface made every
  destructuring site an `@typescript-eslint/unbound-method` error — 30 of them.
- **Fix:** Declared `readonly networkCallCount: () => number`. No rule suppression.
- **Files modified:** `tests/edge/completions/data.test.ts`
- **Verification:** `npm exec -- eslint tests/edge/completions/data.test.ts` exit 0, zero problems
- **Commit:** `a3b00c88`

### 8. [Narrowing] pure-helper cases skip the temporary roots

- **Found during:** Task 1
- **Issue:** The plan asks for two `mkdtemp` roots per case. `buildItem`, `splitCompletionInput`,
  `extractPositionals`, `extractScope`, and `getMarketplaceCompletions` reach no filesystem and read no
  environment variable, so the roots would be created and removed unused in 24 cases.
- **Fix:** Those cases install the fail-fast transport only. Every resolver-backed case gets both roots,
  both environment restores registered before the act with the agent-directory variable deleted, and the
  cache reset — exactly as the plan specifies.
- **Files modified:** `tests/edge/completions/data.test.ts`
- **Verification:** all 66 cases assert a zero network call count
- **Commit:** `a3b00c88`

**Total deviations:** 8 (5 false or unsatisfiable plan claims corrected, 2 blockers auto-fixed, 1
deliberate narrowing). **Impact:** the suite proves what the module does rather than what the plan
assumed; three of the corrections (the `partial` shift, the five-mode narrowing, and the unreachable
coalesce) are findings the phase did not previously hold.

## Observations for later phases

- `data.ts:1-12` — the module header lists `getScopeCompletions` among its pure helpers. No such export
  exists. Stale comment; not edited (no production licence).
- `data.ts:361-364` — the comment says `--partial` "widens the install candidate set". It does not; it
  shifts it. Stale since `remote` joined `INSTALL_STATUSES` under RSTA-01 / D-80-05.
- `data.ts:307` — `PluginMapOptions.partial` is documented "Only ever true for install/update". Nothing
  enforces this; the module honours it for uninstall, reinstall, enable, and disable as well. If the
  comment states the intended contract, the completion provider (116-05) is where the discipline lives.

## Known Stubs

None.

## Verification Results

Each gate was run separately and its exit code checked. `npm run check` was NOT used — its
`format:check` link fails on pre-existing untracked operator files and short-circuits before the tests.

| Gate | Result |
| ---- | ------ |
| `node --test tests/edge/completions/data.test.ts` | pass 66, fail 0, 8 suites |
| `npm run test:coverage:direct -- .../edge/completions/data.ts` | lines 610/610, functions 31/31, branches **109/110** |
| `npm run typecheck` | exit 0 |
| `npm exec -- eslint tests/edge/completions/data.test.ts` | exit 0, 0 problems |
| `npm exec -- prettier --check tests/edge/completions/data.test.ts` | exit 0 |
| `npm run fallow` | exit 0 |
| `npm test` | exit 0 — 5037/5037 across 291 suites |
| `npm run test:integration` | exit 0 — 31/31 |
| anti-pattern scan (`! rg -n '…'`) | exit 1 (no match) — negated link passes |
| `rg -c '^\s+// arrange$'` | 44, equal to the 44 case bodies |
| `git diff --check` | exit 0 |
| `git diff --quiet` on the six pinned paths | exit 0 |
| trufflehog filesystem scan | chunks 4, bytes 45342, verified 0, unverified 0, exit 0 |
| `SKIP=trufflehog,npm-format-check pre-commit run --files …` | exit 0, all hooks Passed or Skipped |

## Next Phase Readiness

Ready for 116-10. **116-05 (the completion provider) depends on this plan** and can lift the
`ResolverSeed` / `seedResolver` shape verbatim — the fake, the per-scope failure seam, and the offline
counter are all reusable as written. It should not re-prove the candidate-map behavior owned here; its
own pair owns `pluginRefBranchConfig` and the argument-position dispatch.

One open item for the operator: `data.ts:188` is a fifth D-116-01a-class unreachable branch and this
plan could not close it. It stands at 109/110.

## Self-Check: PASSED

- `tests/edge/completions/data.test.ts` exists on disk (1030 lines).
- `git log --oneline --all | grep a3b00c88` → found.
- `git log -1 --stat` shows exactly one file changed.
