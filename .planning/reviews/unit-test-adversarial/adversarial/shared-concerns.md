# Shared — soft dependencies and hooks concern — adversarial re-review

**Scope:** `extensions/pi-claude-marketplace/shared/concerns/{soft-dep,hooks}.ts`
and `tests/shared/concerns/{soft-dep,hooks}.test.ts`, plus the cross-module
surfaces they couple to (`shared/notify-reasons.ts`, `shared/notify.ts`,
`domain/components/{hooks,hook-events}.ts`, the seven orchestrator
`Dependency[]` derivation sites, `tests/architecture/`).
**First-pass file:** `unit-test-findings/shared-concerns.md`
**Clean files attacked:** 3 (`soft-dep.test.ts`, `hooks.test.ts`, `soft-dep.ts`)
**Existing findings graded:** 2

## Verdict summary

| Metric | Count |
| --- | --- |
| New BLOCKER (missed by first pass) | 2 |
| New WARNING (missed by first pass) | 5 |
| Existing CONFIRMED | 1 |
| Existing UNDERSTATED | 0 |
| Existing OVERSTATED | 1 |
| Existing REFUTED | 0 |
| Existing DUPLICATE-OF | 0 |

The first pass's runtime-behaviour reading held up well — I ran 21 mutations
against `appendHooksBlock` and 6 against `softDepMarkers` and only one survived.
Its *type-level* reading did not. Both modules declare closed sets in their own
doc comments and both paired tests pin those sets in one direction only, which is
precisely the silent-omission class this repo has shipped repeatedly. The first
pass also could not see the two cross-module duplications, because both live
outside its slice.

Type-level claims below were verified by compiling throwaway probe files with the
repo's own `tsc` (`--ignoreConfig --strict --exactOptionalPropertyTypes`) in the
scratchpad. No repo file was read-modified, and no repo test or gate was run.

## New findings — from the clean lists

### `tests/shared/concerns/soft-dep.test.ts`

- **[BLOCKER] A third `Dependency` member compiles clean everywhere and silently
  emits no marker** — `lines 9-12`

  Mutation: `soft-dep.ts:30` → `export type Dependency = "agents" | "mcp" | "workflows"`.

  Survives the whole file. The `satisfies` checks at lines 9-10 are *subset*
  assertions — they prove `"agents"` and `"mcp"` are members, never that there
  are no others. The `@ts-expect-error` at 11-12 pins only that `"hooks"` is
  excluded, and `"workflows"` is not `"hooks"`, so the directive still fires and
  the file still compiles. All 16 runtime rows still pass, because
  `softDepMarkers` (`soft-dep.ts:44-60`) hand-codes two booleans and carries no
  exhaustiveness arm over `Dependency` at all. Downstream,
  `notify.ts:2279-2280` reads the set with `.includes("agents")` /
  `.includes("mcp")` and would never set the new flag.

  Verified with tsc: with the third member present,
  `["agents","mcp"] as const satisfies readonly Dependency[]` compiles clean;
  `void (null as unknown as Dependency satisfies (typeof ALL_DEPENDENCIES)[number])`
  fails with TS1360 `Type '"workflows"' is not assignable to type '"agents" | "mcp"'`.

  This is not a hypothetical. `soft-dep.ts:22` calls itself "Closed set of
  dependency probe targets (SNM-06). 2 members", and the repo has a mature
  closed-set discipline that `Dependency` is simply not enrolled in:
  `_ReasonsCoverageProof` (`shared/notify-reasons.ts:266-270`) proves the `Reason`
  partition is total at compile time, and
  `tests/architecture/{compat-01-no-expansion,notify-closed-set-locks}.test.ts`
  pin `REASONS` / `STATUS_TOKENS` / `PLUGIN_STATUSES` / `MARKETPLACE_STATUSES` by
  enumeration, order and length. `grep -rn "Dependency" tests/architecture/`
  returns **zero hits**.

  Fix — add the bidirectional pin beside the existing checks at line 12:

  ```ts
  const ALL_DEPENDENCIES = ["agents", "mcp"] as const satisfies readonly Dependency[];
  void (null as unknown as Dependency satisfies (typeof ALL_DEPENDENCIES)[number]);
  ```

  Then drive the 16-row table off `ALL_DEPENDENCIES` so a new member has nowhere
  to hide. `_ReasonsCoverageProof` is the in-repo template — this is propagation,
  not invention.

### `tests/shared/concerns/hooks.test.ts`

- **[BLOCKER] A strict tool event with an empty matcher — the shape production
  actually produces — is never rendered** — `lines 75-86`, `131-157`, `175-197`

  Mutation: `hooks.ts:123` →
  `lines.push(entry.matcher === "" ? \`      ${entry.event}\` : \`      ${entry.event}(${entry.matcher})\`)`.

  Survives all 9 runtime cases. Every strict tool entry in the file carries a
  non-empty matcher: `"Bash"` (line 78), `"Edit|Write"` (135),
  `"Write"`/`"Bash"`/`"Edit"` (179-182).

  `matcher: ""` is the *default* production value, not an edge case. Both
  producers of the tool arm default it explicitly, citing MATCH-01 match-all:
  `domain/components/hooks.ts:378` (`matcher: group.matcher ?? ""` in
  `projectHookSummaryEntries`) and `:416` (`entry.matcher ?? ""` in
  `hookSummaryEntriesFromPersisted`). A `hooks.json` group written without a
  `matcher` key — the ordinary shape — renders as `PreToolUse()`, which is
  user-visible row grammar.

  Coverage for it exists, but in another module's file:
  `tests/orchestrators/plugin/info.test.ts:4138-4139` asserts
  `"      PreToolUse()"` / `"      PostToolUse()"`. Under the pairing rule the
  paired module owns this behavior, so the mutation is caught by accident and by
  the wrong owner.

  This is sibling drift *inside one file*: the lenient arm gets a dedicated
  empty-vs-absent matcher case at 159-173 (which the first pass rightly praised),
  and the strict tool arm — the arm production defaults to `""` on — gets none.

  Fix — add one case mirroring line 159:

  ```ts
  test("appends a strict tool event whose matcher is the empty match-all string", () => {
    // arrange
    const lines: string[] = [];
    const entries = [{ event: "PreToolUse", matcher: "" }] satisfies HookSummaryEntry[];
    const expectedLines = ["    hooks:", "      PreToolUse()"];

    // act
    appendHooksBlock(lines, entries);

    // assert
    assert.deepStrictEqual(lines, expectedLines);
  });
  ```

- **[WARNING] The union's central discrimination claim is false, and the
  `@ts-expect-error` block never attempts it** — `lines 36-49`, against
  `hooks.ts:27`

  `hooks.ts:27` states the contract: "non-tool event (untagged): statically
  cannot carry a matcher." tsc says otherwise. All three of these **compile** as
  `HookSummaryEntry`:

  - `{ event: "SessionStart", matcher: "Bash" }`
  - `{ event: "SessionStart", supported: false }`
  - `{ kind: "lenient", event: "PreToolUse", supported: true }` (this one is intended)

  Only a wholly unknown key errors — `{ event: "SessionStart", bogus: 1 }` gives
  TS2353. The union's excess-property check admits `matcher` and `supported`
  because they exist on *other* constituents.

  Runtime consequence: `appendHooksBlock`'s `else if ("matcher" in entry)` arm
  (`hooks.ts:122`) takes the TOOL branch for such an entry and renders
  `SessionStart(Bash)` — a non-tool event with a matcher. A `supported: false`
  on the untagged arm is silently dropped (no ` (unsupported)` suffix), because
  `"kind" in entry` is false.

  The test's negative block pins the four claims that *do* fire (lines 36-49) and
  never attempts the one the doc calls load-bearing — because it would not fire,
  and an unused `@ts-expect-error` is itself an error.

  Fix, production first: add `never`-typed refusals so the discrimination the doc
  claims is real, then prove it.

  ```ts
  export type HookSummaryEntry =
    | { readonly event: ToolEvent; readonly matcher: string;
        readonly kind?: never; readonly supported?: never }
    | { readonly event: Exclude<ClaudeHookEvent, ToolEvent>;
        readonly kind?: never; readonly matcher?: never; readonly supported?: never }
    | { readonly kind: "lenient"; readonly event: string;
        readonly supported: boolean; readonly matcher?: string };
  ```

  Both existing producers already emit bare `{ event }` for the non-tool arm
  (`domain/components/hooks.ts:386-388` and `:419`), so nothing breaks. Then add
  `// @ts-expect-error a non-tool event cannot carry a matcher` above
  `void ({ event: "SessionStart", matcher: "Bash" } satisfies HookSummaryEntry);`
  in `hooks.test.ts`.

  This is the same shape META-FINDINGS records as "The `ScopedLocations` brand is
  never proven" — a compile-time guarantee asserted in prose that nothing
  verifies. Here it is worse: the guarantee does not hold.

- **[WARNING] `ClaudeHookEvent` and `ToolEvent` are subset-pinned only, and two
  doc comments claim bidirectional protection they do not provide** — `lines 11-23`

  `as const satisfies readonly ClaudeHookEvent[]` proves the ten listed members
  are valid. It does not prove the union has no eleventh.
  `domain/components/hook-events.ts:59-62` claims "adding/removing a value from
  `BUCKET_A_EVENTS` here without the matching `ClaudeHookEvent` edit (**or vice
  versa**) breaks the typecheck at that assertion site", and
  `shared/concerns/hooks.ts:19-23` restates it as "one drifts, the typecheck
  breaks at the source-of-truth assertion site". Of the four drift directions,
  only two error:

  | Drift | Errors? |
  | --- | --- |
  | value added to the tuple that is not in the union | yes |
  | member removed from the union that is in the tuple | yes |
  | value removed from the tuple | **no** |
  | member added to the union (the "vice versa" the comment names) | **no** |

  Same construct, same proof as the `Dependency` finding above.

  One accidental mitigation: adding literally `"Notification"` turns
  `hooks.test.ts:30`'s `@ts-expect-error` into an unused directive, which is an
  error. Any other new member (`"PreCompactFailure"`, say) is silent.

  Fix: apply the same bidirectional pin to `ClaudeHookEvent` and `ToolEvent` in
  `hooks.test.ts`, and correct both doc comments to say what the `satisfies`
  actually proves. Runtime impact is low — `appendHooksBlock` renders any new
  non-tool member as a bare `${entry.event}` — which is why this is WARNING and
  the `Dependency` one is BLOCKER.

### `extensions/pi-claude-marketplace/shared/concerns/soft-dep.ts`

- **[WARNING] The boolean → `Dependency[]` derivation is spelled seven times,
  none of them in the module that owns `Dependency`** — `line 30`

  Seven independent implementations of "declaresAgents/declaresMcp booleans →
  `readonly Dependency[]`, agents before mcp":

  | Site | Form | Freezes? |
  | --- | --- | --- |
  | `orchestrators/plugin/list.ts:306` `dependenciesFromDeclares` | push | no |
  | `orchestrators/plugin/shared.ts:126` `enableRowDependencies` | push (off staged signals) | no |
  | `orchestrators/plugin/update-row.ts:142` `outcomeDependencies` | spread | no |
  | `orchestrators/plugin/reinstall.messaging.ts:356` `dependenciesFromOutcome` | push | yes |
  | `orchestrators/reconcile/apply-outcomes.ts:436` `dependenciesFromInstall` | push | no |
  | `orchestrators/import/execute.ts:361` `dependenciesFromInstalled` | push | yes |
  | `orchestrators/plugin/install.ts:1684` (inline in `composeInstalledRow`) | push | no |

  `import/execute.ts:372` comments its freeze as "codebase convention" — it is
  the minority, 3 of 7. That comment is a second doc-comment-that-lies in this
  blast radius.

  Deliberately **not** rated higher: every read site is order-insensitive
  `.includes()` (`notify.ts:2279-2280, 2338-2339, 2605-2606, 2623-2624,
  2641-2642`), so no ordering drift among the seven can change a rendered byte.
  This is maintenance debt, not a live defect.

  Fix: export one `dependenciesFrom(declaresAgents, declaresMcp): readonly Dependency[]`
  from `shared/concerns/soft-dep.ts`, beside `Dependency` and `softDepMarkers`,
  and have all seven call it. Note that neither gate catches this today:
  `fallow dupes` (`threshold: 3`) does not report them, and
  `sonar.cpd.exclusions` already exempts `orchestrators/plugin/shared.ts` plus
  three `*.messaging.ts` files.

- **[WARNING] `companionSeverity` re-implements `softDepMarkers`' predicate in a
  sibling `shared/` module, and the two paired tests duplicate a 16-row table
  byte-for-byte** — `lines 51-57` vs `shared/notify-reasons.ts:85-92`

  `companionSeverity({declaresAgents, declaresMcp}, probe) === "warning"` is
  exactly `softDepMarkers(declaresAgents, declaresMcp, probe).length > 0` — two
  independent spellings of one rule, in two `shared/` modules that already share
  vocabulary.

  The test-side duplication is the sharper half.
  `tests/shared/concerns/soft-dep.test.ts:14-128` and
  `tests/shared/notify-reasons.test.ts:141-250` carry the **same 16 input rows in
  the same order** — identical `declaresAgents` / `declaresMcp` / `probe` values
  — differing only in the expected column. I checked the correspondence row by
  row: markers-non-empty and severity-`"warning"` agree on all 16. That is 32
  cases where 16 rows with two expected columns would do, and the maintenance
  trap compounds the `Dependency` BLOCKER above: a third member needs coordinated
  edits at 7 derivation sites, 2 predicates and 2 truth tables, and nothing makes
  any of it a compile error or a red test.

  Deliberately **not** rated BLOCKER: each table is complete, so drift in either
  implementation alone goes red in its own suite. Nothing lies today. The
  exposure is a coordinated edit to one pair leaving the other inconsistent,
  which yields `{requires pi-subagents}` rendered at `info` severity — the
  tri-state severity axis this project treats as load-bearing.

  Fix, production first: make `companionSeverity` delegate —
  `return softDepMarkers(declaresAgents, declaresMcp, probe).length > 0 ? "warning" : "info";`
  — deleting the second predicate outright. Then collapse the two tables into one
  row set carrying both `expectedMarkers` and `expectedSeverity`, placed beside
  the concern.

### `extensions/pi-claude-marketplace/shared/concerns/hooks.ts`

- **[WARNING] `ToolEvent`'s only importer is its own test, and its doc comment
  justifies the export with a consumer that does not exist** — `lines 69-81`

  The comment says "a caller that spells out an entry needs to be able to name it
  too." No caller does. Every other `ToolEvent` reference in the repo resolves to
  `domain/components/hook-events.ts:84`'s own `ToolEvent`, derived from the
  `TOOL_EVENTS` tuple: `domain/components/hooks.ts:48`,
  `domain/components/hooks/partition.ts:7`,
  `tests/architecture/hooks-translators.test.ts:9`,
  `tests/domain/components/hook-events.test.ts:13`. The sole importer of *this*
  `ToolEvent` is `tests/shared/concerns/hooks.test.ts:8`. Every production
  importer of this module takes only `ClaudeHookEvent` and/or `HookSummaryEntry`.

  `fallow dead-code` structurally cannot see this: `.fallowrc.json` sets
  `production: false`, so a test import counts as a live consumer.

  Fix: either restate the real justification (it names an arm of the exported
  `HookSummaryEntry`, so a consumer narrowing that union must be able to spell
  it — which is legitimate), or drop the `export` and have the test derive it as
  `Extract<HookSummaryEntry, { matcher: string }>["event"]`. Pick one; do not
  leave a justification naming a caller that is not there.

## Export ownership census

| Module | Export | Owning case | Status |
| --- | --- | --- | --- |
| `soft-dep.ts` | `Dependency` (type) | `soft-dep.test.ts:9-12` | owned — **subset-pinned only** (BLOCKER above) |
| `soft-dep.ts` | `softDepMarkers` | `soft-dep.test.ts:130-141`, 16 rows | owned, exhaustive |
| `soft-dep.ts` | `SOFT_DEP_MARKER_AGENTS` / `_MCP` | not exported; covered through `softDepMarkers` | fine |
| `hooks.ts` | `ClaudeHookEvent` (type) | `hooks.test.ts:11-22`, `30-31` | owned — subset-pinned only (WARNING) |
| `hooks.ts` | `ToolEvent` (type) | `hooks.test.ts:23`, `33-34` | owned — **no production importer** (WARNING) |
| `hooks.ts` | `HookSummaryEntry` (type) | `hooks.test.ts:24-28`, `36-49` | owned — negatives incomplete; the doc's central claim is false (WARNING) |
| `hooks.ts` | `appendHooksBlock` | `hooks.test.ts`, 9 cases | owned — one surviving mutation (BLOCKER) |

No export is unowned, and no export's coverage is merely incidental. The census's
finding is not a missing owner but three type exports whose owning cases assert a
weaker property than the module's doc comments claim.

## Branch census

`softDepMarkers` (`soft-dep.ts:44-60`) — two independent `if`s, four combinations,
driven by all 16 rows of the input truth table. **Every branch reachable and
tested. No unreachable code, no compiler-forced branch, no defensive fallback.**

`appendHooksBlock` (`hooks.ts:109-128`) — seven branch outcomes, all reachable and
all tested:

| Branch | Owning case | Class |
| --- | --- | --- |
| `entries === undefined` | `hooks.test.ts:51` | reachable, tested |
| `entries.length === 0` | `:63` | reachable, tested |
| `"kind" in entry`, `matcher === undefined` | `:101`, `:159` | reachable, tested |
| `"kind" in entry`, matcher present | `:131`, `:159` | reachable, tested |
| `supported === true` / `false` | `:101` / `:116` | reachable, tested |
| `"matcher" in entry` (tool arm) | `:75`, `:131`, `:175` | reachable, tested — but only with non-empty matchers (BLOCKER above) |
| `else` (non-tool arm) | `:88`, `:131` | reachable, tested |

Neither module contains a `catch`, an optional-parameter default, an
`assertNever`, or a defensive fallback. Nothing in this area belongs to the
D-116-01a compiler-forced-unreachable category, and nothing is production dead
code. The gap here is a missing *value*, not a missing branch — which is exactly
why a branch-coverage reading (and the first pass) found nothing.

## Grading of first-pass findings

### `extensions/pi-claude-marketplace/shared/concerns/hooks.ts`

- **OVERSTATED** — *`| undefined` parameter instead of an optional parameter*
  (`line 111`). Real per the style skill ("optionals (`name?: string`) over
  `| undefined`"), and the first pass's compile claim is correct —
  `exactOptionalPropertyTypes` does not reach parameters. But it is one of 53+
  instances of the same form under `extensions/` (that count excludes
  `readonly`-prefixed lines, so the true figure is higher), and the "sibling that
  already does it right" it cites is the wrong comparand: `PluginInfoComponentsResolved.hooks?`
  is an object *property*, where `?` means something different. The true
  same-shape sibling is this function's own caller —
  `appendResolvedComponentLines(lines, components, dependencies: readonly string[] | undefined)`
  at `notify.ts:3549-3552` — which uses the flagged form. Correct severity stays
  WARNING, but the correct *disposition* is one repo-wide convention ticket, not a
  local fix here; fixing this file alone makes it the outlier.

- **CONFIRMED** — *Public-type documentation written as an implementation-note
  block instead of JSDoc* (`lines 12-55`). WARNING is right. Two citations the
  first pass missed, both widening the finding without changing its severity:
  the style skill also says "no boxes around comments" (the `// ---------`
  delimiters at lines 12 and 55 are a box), and it requires every top-level
  export to be documented — `ClaudeHookEvent` (line 57) and `HookSummaryEntry`
  (line 83) currently have no adjacent doc comment at all, which is the real
  defect the block's placement hides. Note the box form recurs in 20+ extension
  files, so if that half is fixed it should be fixed repo-wide.

### First-pass "Not covered" note

Not a finding, but worth closing: the first pass listed
`platform/pi-api.ts` (`softDepStatus`, `hasLoadedPiSubagents`,
`hasLoadedPiMcpAdapter`) as unreviewed. It **is** paired and covered —
`tests/platform/pi-api.test.ts:197-390` holds a `describe()` per probe function.
Ownership belongs to `unit-test-findings/platform.md`; nothing is orphaned.

## Still clean after attack

- `tests/shared/concerns/hooks.test.ts` — I ran 21 mutations against
  `appendHooksBlock`; 20 go red. Notably caught: **branch reordering** (checking
  `"matcher" in entry` before `"kind" in entry` renders `PermissionRequest(Bash)`
  without the suffix — line 149 fires); **de-duplication** (`new Set(entries)`
  collapses the repeated `PreToolUse(Bash)` — line 175 fires, and that case exists
  for exactly this); **sorting or reversing entries** (line 131 fires); **header
  emitted per-entry instead of once** (131/175); **falsy matcher check**
  (`!entry.matcher` instead of `=== undefined` — line 159 fires, and this is a
  genuinely sharp case); **`unshift` instead of `push`**, **returning a new array
  instead of mutating in place**, **any indentation change at 4 or 6 spaces**, and
  **inverting or moving the ` (unsupported)` suffix**. Only the empty-string
  strict matcher survives.

- `tests/shared/concerns/soft-dep.test.ts` — the 16-row table is a genuinely
  exhaustive truth table. I re-derived every row against the implementation by
  hand and all 16 are distinct and correct, and every title matches its row. It
  catches: **swapping the two markers**, **reordering the returned list** (row at
  line 38 is the ordering proof), **inverting either `declares` or either
  `Loaded` flag**, **dropping either clause**, **substituting a different
  `Reason` literal**, and **hoisting the accumulator to module scope** (16 cases
  in one process would accumulate). The expected values are hand-written literals
  compared whole with `deepStrictEqual` — no production formatter on either side.

- `extensions/pi-claude-marketplace/shared/concerns/soft-dep.ts` (runtime half) —
  `softDepMarkers` is a pure function over three explicit parameters. The
  `SoftDepStatus` probe is genuinely an injected plain-data port, so the
  hermeticity risk the assignment brief suspected really is absent here: the test
  constructs literal objects and never touches `node_modules` resolution. The
  first pass got that right. Its findings are the *type-level* pin and the two
  cross-module duplications, not the function body.

Two structural non-findings, recorded so a fixing pass does not "correct" them:
the unit-test skill lists `test/shared/` as a support-dumping-ground finding, but
`tests/shared/concerns/` here is the mirrored pairing path for
`extensions/pi-claude-marketplace/shared/concerns/` and is correct. And
`soft-dep.test.ts`'s hand-written per-row titles, rather than titles interpolated
from the row, read better than the interpolated form and match the sibling
`notify-reasons.test.ts` — leave them.

## Not covered

- I did not measure direct per-pair coverage (`npm run test:coverage:direct`).
  The brief forbids running the suite while other agents work. My branch census
  is derived by reading, and it says both pairs reach 100% branch coverage run
  alone — which is exactly why coverage measurement would not have found either
  BLOCKER.
- `shared/notify-reasons.ts` and `tests/shared/notify-reasons.test.ts` are owned
  by another area file. I read them only far enough to establish the
  `companionSeverity` / `softDepMarkers` duplication and the identical 16-row
  table; I did not review them.
- The seven `Dependency[]` derivation sites were read only at their derivation
  functions, not reviewed as modules.

## Meta-findings impact

### New cross-cutting evidence

**1. Subset-only `satisfies` is the repo's dominant closed-set pin, and it is
half a gate.** This is the mechanism behind the recorded "adding a member to a
closed set compiles clean at every derivation site" class. The pattern
`TUPLE as const satisfies readonly Union[]` appears throughout the codebase
(`soft-dep.ts` / `hooks.ts` / `hook-events.ts:57-62, 78-82` at minimum) and in
paired tests as `void ([...] as const satisfies readonly Union[])`. It errors in
two of four drift directions and — critically — **not** in the direction the
comments at `hook-events.ts:59-62` and `shared/concerns/hooks.ts:19-23` both
explicitly claim ("or vice versa", "one drifts, the typecheck breaks"). Verified
with tsc.

Four closed sets are properly protected (`REASONS`, `STATUS_TOKENS`,
`PLUGIN_STATUSES`, `MARKETPLACE_STATUSES` — enumeration + order + length +
`_ReasonsCoverageProof`). Every *other* closed set in the repo appears to rely on
subset `satisfies` alone. **Other areas should be checked for this: every
`satisfies readonly X[]` pin and every test file whose only closed-set proof is a
`void ([...] satisfies ...)` line.** Candidates visible from here:
`domain/components/hook-events.ts` (`BUCKET_A_EVENTS`, `TOOL_EVENTS`,
`DISPATCHABLE_EVENTS`), `shared/types.ts` (`Scope`), `orchestrators/types.ts`,
and every `ComponentKind` derivation. The fix is one two-line idiom, and
`_ReasonsCoverageProof` (`shared/notify-reasons.ts:266-270`) is the in-repo
template — this belongs in the "Patterns to propagate" table.

**2. `fallow` with `production: false` cannot detect an export kept alive solely
by its own test.** `ToolEvent` in `shared/concerns/hooks.ts` is imported by
exactly one file in the repo — its paired test — and the dead-code gate reports
nothing, by design. This is the structural reason META-FINDINGS' item 2 ("four
modules export a reset function whose only callers are tests") had to be found by
reading. `production: false` is a deliberate, operator-owned setting and should
not be flipped; the actionable consequence is that **test-only exports are
invisible to the gate and need either a periodic `fallow --production` probe or a
reading pass.** Any area that reported "no unused exports" reported it on a gate
that cannot see this class.

**3. A second instance of the byte-for-byte duplicated test fixture.**
META-FINDINGS names one (`backfill.test.ts` / `pending.test.ts`). Here is a
second, in a different area and of a different kind: the identical 16-row input
table in `tests/shared/concerns/soft-dep.test.ts:14-128` and
`tests/shared/notify-reasons.test.ts:141-250`, same rows, same order, driving two
production functions that compute the same predicate. Two instances in two
unrelated areas makes this a class, not an incident, and it points at a
production cause each time (two functions that should be one). Worth a sweep for
data-driven tables sharing an input shape across files.

**4. Doc comments in this area lie in three places, all in the same direction:
they assert a compile-time guarantee stronger than the code provides.**
`shared/concerns/hooks.ts:27` ("statically cannot carry a matcher" — false, tsc
verified), `hooks.ts:19-23` and `domain/components/hook-events.ts:59-62` ("one
drifts, the typecheck breaks" — false in the vice-versa direction),
`hooks.ts:69-81` (justifies an export by a caller that does not exist), and
`orchestrators/import/execute.ts:372` ("codebase convention" for a freeze the
minority of siblings perform). META-FINDINGS already records that doc comments
"cut both ways" for test-only exports; this generalizes it — **a doc comment
asserting a type-level guarantee is unverified prose unless a `@ts-expect-error`
negative or a `never`-pinned proof type stands next to it.** Same shape as the
unproven `ScopedLocations` brand.

### Corrections to META-FINDINGS.md

- **"Confidence: findings are reliable; clean verdicts are not."** Confirmed
  emphatically for this area, and with a specific mechanism worth recording: this
  area's first pass was neither lazy nor wrong about what it examined — it
  mutation-tested runtime behavior well. It missed everything because it examined
  the *runtime* contract and both real defects are *type-level*. A clean verdict
  on a module whose exports are mostly types should be treated as unproven until
  someone has actually compiled a mutated union.

- **"Ranked by leverage" item 5, "Restore exhaustiveness on closed-union
  switches"** names four modules with missing `default`/`assertNever` arms. That
  scoping is too narrow. The same silent-omission class also reaches every closed
  set pinned by a subset-only `satisfies`, including two —
  `Dependency` (SNM-06) and `ClaudeHookEvent` (SURF-02) — that no architecture
  test touches at all. Item 5 should be widened from "switch statements without a
  default arm" to "closed sets without a bidirectional pin", and
  `_ReasonsCoverageProof` named as its reference implementation.

- **"Gates that do not gate" (five instances).** Add a sixth of a different kind:
  not a gate that scans the wrong file, but the *absence* of enrolment. `Dependency`
  and `ClaudeHookEvent` are self-declared closed sets (`soft-dep.ts:22`,
  `hooks.ts:13-23`) that appear in zero files under `tests/architecture/`, while
  four peer closed sets get three layers of protection each. The recommendation
  "audit every architectural gate against what it actually scans" should be paired
  with "audit every closed set against whether any gate scans it."

- No claim in META-FINDINGS.md is contradicted by this area.

### Confirmations

- **"The dominant shape: sibling drift."** Confirmed twice, and once in a form
  the list does not yet contain — drift *within a single file*. `hooks.test.ts`
  gives the lenient arm a dedicated empty-vs-absent matcher case (line 159) and
  gives the strict tool arm none, though the strict arm is the one production
  defaults `matcher` to `""` on. Worth adding to the list, because
  intra-file drift is invisible to a "compare against the sibling file" fix
  strategy.

- **"In almost every case the correct form already exists in-repo."** Confirmed
  for all four of my new type-level findings: `_ReasonsCoverageProof`
  (`shared/notify-reasons.ts:266-270`) is a working bidirectional closed-set
  proof, and `tests/architecture/compat-01-no-expansion.test.ts` is a working
  enumeration-and-order lock. Both fixes are propagation.

- **"Reviewing production alongside tests was worth it."** Confirmed. Both of my
  BLOCKERs were only visible by reading production: the empty-matcher gap needed
  `domain/components/hooks.ts:378,416` to show `?? ""` is the default, and the
  `Dependency` gap needed `notify.ts:2279-2280` to show the read side is a
  string-membership test with no exhaustiveness.

- **`tests/domain/device-flow-contract.ts` as the shared-contract reference.**
  Independently useful here: the `softDepMarkers` / `companionSeverity`
  equivalence is exactly a shared-contract case, and folding the two duplicated
  16-row tables into one contract invoked from both test modules is the named
  pattern applied to a new pair.
