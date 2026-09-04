# Shared — notify (the single UI output surface) — adversarial re-review

**Scope:** `tests/shared/notify.test.ts` lines 4450–6659 (the tail: ~90 `test()` sites
including 9 data-driven `for` loops), plus every production symbol in
`extensions/pi-claude-marketplace/shared/notify.ts` those cases reach, plus the
**whole-file export census** of `notify.ts` (37 runtime exports, 50 type exports).
Reachability of `notify.ts`'s entry points was traced across the whole
`extensions/` tree.
**First-pass file:** `unit-test-findings/shared-notify.md`
**Clean files attacked:** 0 declared — see note below
**Existing findings graded:** 10

> **Note on the clean lists.** This area's first-pass file lists **no** clean
> files: its unit-test `### Clean files` section says "No other test files were
> in scope", and its production `### Clean files` section says "None to list
> separately". So the primary target of this brief does not exist here. I spent
> the mutation budget instead on the two in-scope files' **un-flagged cases and
> exports** — the same unfalsified-negative problem one level down: the first
> pass flagged ~19 weak cases out of ~194 and said nothing about the other ~175.

## Verdict summary

| Metric | Count |
| --- | --- |
| New BLOCKER (missed by first pass) | 5 |
| New WARNING (missed by first pass) | 18 |
| Existing CONFIRMED | 6 |
| Existing UNDERSTATED | 3 |
| Existing OVERSTATED | 1 |
| Existing REFUTED | 0 |
| Existing DUPLICATE-OF | 0 |

## New findings — mutation testing of the un-flagged cases

### `extensions/pi-claude-marketplace/shared/notify.ts` (reachability)

- **[BLOCKER] `notify()`'s cascade arm is production-dead for 18 of the 19 plugin
  statuses, and the module comment that admits this is itself wrong** — `notify.ts:2007–2022`,
  `notify.ts:3843–3878`
  I grepped every `notify(` call site in `extensions/` (20 sites). Every one is
  either a standalone `kind:` envelope (`marketplace-not-added`, `marketplace-info`,
  `marketplace-info-cascade`, `plugin-info`, `plugin-info-cascade`,
  `reconcile-pending-empty`), or the `{ marketplaces: [] }` empty sentinel
  (`orchestrators/plugin/reinstall.ts:535`, `update.ts:374`), or one of exactly
  two cascade sites: `edge/handlers/plugin/bootstrap.ts:75` (marketplace
  `status: "failed"`, `plugins: []`) and `edge/handlers/plugin/enable-disable.ts:68`
  (one `failed` plugin row, a defence-in-depth catch). Every real cascade in the
  product goes through `notifyWithContext` → `emitContextCascade` →
  `composePluginLinesWith(..., context.render[status])` — the command's own render
  map, never the central `renderPluginRow` switch.
  Consequence: the ~60 cases in my range (and the great majority of slices A and
  B) that call `notify(ctx, pi, { marketplaces: [...] })` with a populated
  `plugins[]` are asserting the bytes of a dispatcher that production reaches for
  exactly one status. What users actually see comes from each command's render
  map, byte-asserted in that command's `*.messaging.test.ts`.
  The module's own comment at `notify.ts:2014–2016` states the cascade arm is
  "reached today only by the `{ marketplaces: [] }` empty sentinel" — that is
  false (`enable-disable.ts:68` disproves it) and understates the one arm that
  *is* live.
  Fix (operator decision, not a mechanical edit): either delete the central
  `renderPluginRow` switch and the `reconcile-applied-cascade` arm of
  `dispatchInfoMessage` (see the next finding) and relocate the ~60 cases onto
  the exported row composers they actually exercise (`pluginRow`,
  `installedLikeRow`, `partiallyInstalledRow`, `render*Row`), or keep the switch
  and correct its comment to name `enable-disable.ts:68` as the live caller. Do
  not rewrite these cases in place before that decision — the rewrite would be
  redone.

- **[WARNING] `dispatchInfoMessage`'s `reconcile-applied-cascade` arm has zero
  production callers** — `notify.ts:3784–3799`, and `composeReconcileAppliedBody`
  at `notify.ts:3715`
  The only construction site for that message shape is
  `orchestrators/reconcile/notify.ts:971` (`buildReconcileAppliedCascade`), whose
  sole consumer is `orchestrators/reconcile/apply.ts:819` →
  `notifyReconcileAppliedWithContext` → `emitReconcileAppliedContextCascade`. No
  code path feeds it to `notify()`. Seven cases in my range assert this dead arm
  (`4670`, `4721`, `4751`, `4797`, `5921`, `6282`, `6462`); only `5624`
  (`emitReconcileAppliedContextCascade`) tests the live path. Fold the seven into
  the `emitReconcileAppliedContextCascade` form at `5624`, or delete the arm.

- **[WARNING] `shouldEmitReloadHint`'s entire `isInfoKind` branch is unreachable
  from every type-legal caller** — `notify.ts:3245–3268`
  Two callers. `notify()` calls it at `3870`, i.e. *after* its own `isInfoKind`
  early-return at `3833`, so `message` is already narrowed to a cascade.
  `emitContextCascade` declares `message: CascadeNotificationMessage`, whose
  `kind?: "cascade"` (`notify.ts:1362`) cannot be an info kind. The branch exists
  only because the parameter is typed `NotificationMessage` (compiler-forced
  under the current signature — category (c)); narrowing the parameter to
  `CascadeNotificationMessage` deletes 24 lines of production code **and** the 8
  cases that exist only to reach it (the 7-row loop at `5958–6012` and the case
  at `6229`), all of which have to launder a type-illegal message through
  `message as never` to get there. This is the same "narrow the over-wide
  parameter" fix as META item 1, applied to an internal parameter.

- **[WARNING] `summaryPhrase`'s vowel-aware `"An"` article can never be produced**
  — `notify.ts:3009–3010`
  `singularArticle` is only consulted when `count === 1`. The only call sites that
  pass `subject === null` are `buildSummaryLine:3101` and
  `buildSummaryLineForCascade:3032`, both guarded by
  `counts.plugins > 0 && counts.marketplaces > 0` and both passing
  `counts.plugins + counts.marketplaces` — necessarily ≥ 2. Every other call site
  passes `"plugin"` or `"marketplace"`, whose nouns start with consonants. So
  `/^[aeiou]/i.test(noun)` is `false` on every reachable path and `"An"` is a dead
  value; the comment at `3006–3008` describes a shape ("the count-1 form would
  read 'A operation'") that cannot occur. Grep confirms no test and no catalog row
  contains `An … operation`. Delete the ternary and hard-code `"A"`, or state in
  the comment why the guard is retained.

### `tests/shared/notify.test.ts`

- **[BLOCKER] The D-76-10 "`last_updated:` never renders for a `path` source"
  contract is unasserted; deleting the guard leaves the whole file green** —
  production `notify.ts:3417`, test coverage `line 5779` / `line 6376`
  `renderMarketplaceInfo` gates the line on
  `message.source.sourceKind !== "path" && message.details.lastUpdatedAt !== undefined`.
  Mutating it to drop the `!== "path"` conjunct survives **every** case in
  `notify.test.ts`: the three `path`-source fixtures (`3468`, `3776`/`3818`,
  `3894`) all carry `details` with no `lastUpdatedAt`, and the two fixtures that
  *do* set `lastUpdatedAt` on the info surface (`5787`, and `3437`) are `url` and
  `github`. D-76-10 is a named, documented contract with no discriminating case.
  Fix: add one row to the marketplace-info group next to `line 5779`:
  `source: { sourceKind: "path", absPath: "/repo/local-mp" }`,
  `details: { autoupdate: false, lastUpdatedAt: "2026-08-29T12:00:00Z" }`,
  expecting exactly
  `"● local-mp [user] <no autoupdate>\npath: /repo/local-mp"` — no `last_updated`
  line.

- **[BLOCKER] `installedLikeRow`'s owning case is vacuous on the one parameter the
  function exists for** — `line 5219` (`test("installedLikeRow composes an exact
  transition row")`)
  The case passes `dependencies: []` and `bothLoadedProbe()`. `installedLikeRow`'s
  own doc (`notify.ts:2287–2299`) says the whole reason it exists is that it owns
  "the `dependencies.includes(...)` soft-dep gate + `composeReasons`
  composition". Mutating `notify.ts:2338–2339` to swap the two arguments
  (`p.dependencies.includes("mcp")`, `p.dependencies.includes("agents")`), or to
  hard-code both to `false`, leaves this case green — and leaves *every* case in
  `notify.test.ts` green, because `renderPluginRow`'s `installed`/`updated`/
  `reinstalled` arms do **not** call `installedLikeRow` (they inline the same
  body, see the production finding below), so no `notify()`-driven case reaches
  it either. The only coverage is incidental, in consumers'
  `*.messaging.test.ts` files. Fix: replace the single case with three sibling
  rows over `{ dependencies, probe, expected }`:
  `["agents"]` + `neitherLoadedProbe()` → `… {orphan rewake, requires pi-subagents}`;
  `["mcp"]` + `neitherLoadedProbe()` → `… {orphan rewake, requires pi-mcp}`;
  `["agents","mcp"]` + `bothLoadedProbe()` → the current bare expectation.

- **[BLOCKER] Nine `assertNever` cases share one byte-identical, information-free
  error assertion** — `lines 6014, 6034, 6060, 6108, 6132, 6150, 6168, 6208, 6229`
  Each asserts `{ name: "Error", message: "Unexpected value: [object Object]" }`.
  `assertNever` (`shared/errors.ts:26`) throws a bare `Error` whose message is
  `String(x)`, and `String(anyObject)` is `"[object Object]"` — so this assertion
  is satisfied by *any* `assertNever` call anywhere in the chain, on any object.
  Concretely: move validation earlier (e.g. make `notify()` reject an unknown
  `kind` in its own `default:` before dispatching) and all nine keep passing while
  none of the nine named arms executes. Their titles ("severity computation
  rejects…", "summary computation rejects…", "the standalone dispatcher
  rejects…") would then be lies. Note `line 6084` is the counter-example that
  works: `pluginInfoStatusGlyph` passes a *string*, so its message is
  `"Unexpected value: corrupted"` and it self-discriminates.
  Fix (production, shared): give `assertNever` a typed error carrying the
  offending value and a site tag — e.g. `class UnexpectedValueError extends Error
  { readonly value: unknown; readonly site: string }` — matching this repo's own
  `shared/errors.ts` convention of "typed, readonly public fields for structured
  data callers need". Then assert `instanceof UnexpectedValueError` plus
  `error.site` in each of the nine cases. This is cross-cutting; see
  "Meta-findings impact".

- **[BLOCKER] `compareByNameThenScope` never sees an unequal-name pair in the
  greater-than direction** — `lines 5444–5480` (4 data rows)
  Row 1 is the only unequal-name row and expects `-1`. Rows 2–4 all have
  case-insensitively equal names, so they exercise the scope tie-breaker, not the
  name branch. Mutating `notify.ts:5187–5189` to
  `if (byName !== 0) { return -1; }` survives all four rows — a comparator that
  returns a constant for every unequal pair, corrupting every list-rendering
  surface that consumes this single sort policy (9 production files). Fix: add a
  fifth row `{ name: "sorts unequal names in the greater-than direction", left: { name: "Beta", scope: "user" }, right: { name: "alpha", scope: "project" }, expected: 1 }`.

- **[WARNING] `renderVersion`'s sha arm is missing the uppercase negative its hash
  sibling has** — `lines 5062–5104`
  The table carries three negatives for `hash-` (11 digits, 13 digits, **uppercase**)
  but only two for `sha-` (11 digits, 13 digits). Mutating
  `SHA_VERSION_DISPLAY_RE` (`notify.ts:2084`) to `/^sha-[0-9a-fA-F]{12}$/` survives
  every row — yet `looksLikeShaVersion`'s doc explicitly says it "mirrors
  `looksLikeHashVersion`", whose own doc (`notify.ts:2051`) names uppercase-hex
  rejection as the point. Fix: add
  `{ name: "preserves uppercase sha digits", version: "sha-abcdef0123AB", expected: "vsha-abcdef0123AB" }`.

- **[WARNING] `messageWithKindSequence`'s `11` and `17` are undocumented white-box
  read-counts** — `lines 6168–6175`, `6189–6196`, `6208–6215`
  `Array<string>(11).fill(...)` / `Array<string>(17).fill(...)` encode the exact
  number of times `message.kind` is read before the arm under test. I traced it:
  5 reads in `notify()`'s `isInfoKind` `||` chain (the position of
  `"marketplace-not-added"` in the chain at `notify.ts:1711–1717`) + 1 for
  `dispatchInfoMessage`'s switch + 5 for `computeSeverity`'s `isInfoKind` = 11,
  so read #12 lands on `computeSeverity`'s switch; +5 for `buildSummaryLine`'s
  `isInfoKind` + 1 = 17, so read #18 lands on `buildSummaryLine`'s switch.
  **Reordering the `||` chain in `isInfoKind` — a pure refactor — silently
  redirects every one of these cases to a different arm.** Two of them
  (`6168`, `6208`) would still throw the same message from a different
  `assertNever` and keep passing. Fix: add a comment above each call stating the
  read sequence it depends on, and prefer a single named constant
  (`const KIND_READS_BEFORE_SEVERITY_SWITCH = 11;`) over a bare literal.

- **[WARNING] The `renderPluginRowBody` callback is a hand-rolled `t.mock.fn` with
  call-count assertions where the repo's endorsed tool is `strong-mock`** —
  `lines 5507, 5552, 5569, 5588, 5624, 5885, 6229`, plus the 7-row loop at
  `5958–6012` (≈13 cases)
  The callback *is* `emitContextCascade`'s promised interaction (the whole point
  of the D-02 seam), so the skill's mock row applies. `assert.equal(renderRow.mock.callCount(), 0)`
  (`5566`, `5585`, `6010`) is the hand-rolled form of the "silence proof" pattern
  META names, whose reference implementation is a `strong-mock` with no
  expectations plus `verify()` (`tests/orchestrators/reconcile/notify.test.ts`).
  Fix: `const renderPluginRowBody = mock<Parameters<typeof emitContextCascade>[3]>({ exactParams: true, name: "renderPluginRowBody" });`
  with `when(() => renderPluginRowBody(row, probe, "user")).thenReturn("…")` and a
  trailing `verify(renderPluginRowBody)`; the zero-call cases declare no
  expectation. The `renderCalls` shared-log form at `5511–5549` is the one that
  should *stay* — it is the sanctioned order/argument proof.

- **[WARNING] Four closed-set cases duplicate a strictly stronger architecture
  gate** — `lines 4829, 4874, 4933` (and the `assert.equal(REASONS.length, 44)` at
  `5008`)
  `tests/architecture/compat-01-no-expansion.test.ts:127` locks the **whole**
  `REASONS` array in order, `:184` does the same for `STATUS_TOKENS`, and
  `:290–296` locks all seven glyphs **by `\u` codepoint escape** — strictly
  stronger than `notify.test.ts:4935`, which compares literal glyph characters
  (confusable across codepoints and rewritten by the `texthooks` pre-commit
  hooks). `tests/architecture/notify-closed-set-locks.test.ts:29` owns
  `REASONS.length === 44` with a documented bump log. Meanwhile `4829` is a bare
  `.includes()` membership check and `4874` asserts a 3-element slice guarded by a
  standalone `assert.notEqual(at, -1)`. Fix: delete all four from
  `notify.test.ts` and leave a one-line comment naming
  `tests/architecture/compat-01-no-expansion.test.ts` as the owner.

- **[WARNING] `isScopeBearingListRow` covers 4 of 19 statuses** — `lines 5329–5378`
  `SCOPE_BEARING_LIST_STATUS` (`notify.ts:1192–1212`) is a total 19-key record.
  The table exercises `installed` (true), `disabled` (true), `available` (false),
  `failed` (false). Flipping any of the other 15 entries survives — and both
  production consumers (`orchestrators/plugin/list.ts:1458`,
  `edge/handlers/tools.ts:371`) use the result to decide whether a row's own
  `scope` or the marketplace's scope is reported, so a flipped entry mislabels
  rows on the list surface. Fix: make the loop total — one row per member of
  `PLUGIN_STATUSES`, with the expected boolean spelled out per row.

- **[WARNING] 15 `as never` casts sit in the MESSAGE position, and the flagship
  case at `5507` uses one to launder a GATE-01 violation** — `lines 5537, 6006,
  6025, 6051, 6075, 6099, 6123, 6141, 6159, 6180, 6199, 6220, 6239, 6334, 6367`
  The fixture at `5516–5534` gives its `installed` row no `severity`.
  `PluginInstalledMessage extends TransitionMessageBase` (`notify.ts:719`, `684`),
  which redeclares `severity` as **required** precisely so a producer that omits it
  is a TS2741 error. So the case proves a `severity ?? "info"` default
  (`countRowsBySeverity:2971`) that GATE-01 makes unreachable at every production
  construction site — and needs `message as never` to do it. The sibling 20 lines
  later (`5557`) shows the correct form: `satisfies Parameters<typeof emitContextCascade>[2]`,
  no cast. Fix for `5537`: stamp `severity: "info"` on the row and add
  `satisfies Parameters<typeof emitContextCascade>[2]`; the expected bytes
  (`"… Plugin install: 1 success …"`) do not change. The other 14 launder
  deliberately-illegal fixtures and survive the ctx/pi narrowing — see the
  UNDERSTATED grade below.

- **[WARNING] Single-element boundary untested on both early-return guards** —
  `lines 5380`/`5391` (`notifyDiagnostic`) and `5405`/`5416` (`notifyAsyncRewakeSummary`)
  The tables carry 0 and 2 (`[]` / `["first","second"]`) and `""` / a long string.
  Mutating `notify.ts:404` to `if (lines.length <= 1) { return; }` or
  `notify.ts:425` to `if (summary.length <= 1)` survives both pairs. Fix: add a
  one-element row to each — `notifyDiagnostic(ctx, "1 warning", ["only"])` →
  `["1 warning\n\nonly", "warning"]`.

- **[WARNING] `composeTally`'s `label === undefined` disjunct is unexercised** —
  `notify.ts:3141`, no covering case
  `6628` covers `label` present + `cardinality` absent, which the
  `cardinality !== "plural"` half already short-circuits. No case supplies
  `cardinality: "plural"` with no `label`; mutating the guard to drop the second
  disjunct would emit `"undefined: 1 failure"`. Reachable (both fields are
  independently optional on `CascadeNotificationMessage`) and untested. Fix: one
  row on the `5721` table with `label` omitted, expecting `"(no marketplaces)"`.

- **[WARNING] Sibling drift in the assertion idiom inside one file** — ~20 sites,
  representative `lines 4455–4459`, `4486–4490`, `4713–4718` vs `4868–4871`,
  `5540`, `6279`
  Two forms coexist: `const args = …arguments; assert.equal(args.length, 1); assert.equal(args[0], "…")`
  and `assert.deepStrictEqual(…arguments, ["…"])`. Both are strict (the file
  imports `node:assert/strict`, so `equal`/`deepEqual` are the strict variants —
  no looseness finding here), but the second is the file's dominant form and
  compares the whole argument tuple in one assertion. Fix: standardize on
  `assert.deepStrictEqual(ctx.ui.notify.mock.calls[0]!.arguments, [ … ])`.

- **[WARNING] `const expected<Thing> = expected;` arrange-phase alias in 8
  data-driven loops** — `lines 5035, 5052, 5096, 5128, 5177, 5319, 5370, 5472`
  The `// arrange` block only re-binds the row's own `expected` field under a
  different name. The arrange phase should construct the *input*; the expectation
  is already named. Fix: drop the alias and assert against `expected` directly.

- **[WARNING] `Probe` is derived from a production signature instead of imported**
  — `line 4923` (`type Probe = Parameters<typeof composeReasons>[3];`)
  `SoftDepStatus` is an exported type of `platform/pi-api.ts` and is what
  `composeReasons` actually declares. Fix:
  `import type { SoftDepStatus } from "../../extensions/pi-claude-marketplace/platform/pi-api.ts";`
  and delete the alias.

### `extensions/pi-claude-marketplace/shared/notify.ts` (composition and docs)

- **[WARNING] Three arms of `renderPluginRow` inline the exact body of
  `installedLikeRow`, contradicting that helper's own "SOLE composition site"
  doc** — `notify.ts:2596–2609` (`installed`), `2614–2627` (`updated`),
  `2632–2645` (`reinstalled`)
  Each is byte-for-byte
  `installedLikeRow(ICON_INSTALLED, p, mpScope, <versionToken>, "<label>", p.reasons, probe)`.
  `installedLikeRow`'s doc (`notify.ts:2287–2299`) claims it folded "the 7
  command-arm copies" and is the sole site; the three copies inside the very file
  that declares D-11 "call, never duplicate" (`notify.ts:2038–2042`) are still
  there. This is also the direct cause of the BLOCKER above (no `notify()`-driven
  case reaches `installedLikeRow`). Fix: replace the three arms with
  `installedLikeRow` calls; the version token stays caller-supplied
  (`renderVersion(p.version)` / `composeVersionArrow(p.from, p.to)`).

- **[WARNING] `renderPluginInfo` declares a local `const pluginRow` that shadows
  the exported `pluginRow` function and duplicates it exactly** —
  `notify.ts:3657–3664`
  The local `joinTokens([...])` is token-for-token
  `pluginRow(pluginInfoStatusGlyph(plugin.status), plugin, message.marketplaceScope, `(${plugin.status})`, probe)`.
  `PluginInfoRowBase` (`notify.ts:1473`) structurally satisfies `pluginRow`'s `p`
  parameter (`name`, `scope?`, `version?`, `reasons?: readonly ContentReason[]`),
  so the substitution is type-clean. Fix: call `pluginRow` and delete the local;
  the shadowing name goes away with it.

- **[WARNING] `emitUpdateNoOpCascade` duplicates `emitCascadeWith`'s block loop** —
  `notify.ts:3981–3991` vs `3917–3925`
  Identical except for the empty-body sentinel (`""` vs `"(no marketplaces)"`).
  Fix: extract
  `function composeCascadeBlocks(message, probe, renderPluginRowBody): string[]`
  and have both callers apply their own empty-case rule to its result.

- **[WARNING] Four doc comments state facts that are no longer true** —
  - `notify.ts:374` cites `tests/shared/notify-v2.test.ts` as the byte-lock for
    `notifyUsageError`. That file does not exist (`ls tests/shared/`); the case
    lives at `tests/shared/notify.test.ts:2450`. Sole surviving `notify-v2`
    reference in `extensions/`.
  - `notify.ts:3479–3484` (`pluginInfoStatusGlyph`) documents a 3-way mapping and
    "a 5th status member in `PluginInfoRowBase`" as the compile-time tripwire; the
    set has **8** members (`notify.ts:1485–1496`) and the switch has 8 arms.
  - `notify.ts:1460–1461` (`PluginInfoRowBase`) says
    `status: "installed" | "available" | "unavailable" | "failed"` "is the
    4-member closed set used on the info surface" — 12 lines above the 8-member
    declaration.
  - `notify.ts:1506–1507` (`PluginInfoComponentsResolved`) lists the alphabetical
    kind order as `agents, commands, mcp, skills`, omitting `hooks`, which
    `COMPONENT_KINDS` (`notify.ts:3532`) includes.

- **[WARNING] 12 exported types have no consumer outside `notify.ts`** —
  `MessageBase`, `TransitionMessageBase`, `ScopeBearingListStatus`, `MpCommon`,
  `MpAdded`, `MpRemoved`, `MpUpdated`, `MpAutoupdateEnabled`,
  `MpAutoupdateDisabled`, `PluginInfoComponentsUnresolved`,
  `MarketplaceInfoCascadeMessage`, `PluginInfoCascadeMessage`
  (verified by grepping the whole `extensions/` and `tests/` trees). Each is used
  *inside* the file, so `fallow dead-code` does not fire; the `export` keyword is
  pure surface widening. Fix: drop `export` from the ones that are genuinely
  file-private structure, keeping it only where a consumer names the type.

## Export ownership census

All 37 runtime exports of `notify.ts` are imported by `tests/shared/notify.test.ts`
and none is orphaned. The interesting column is **how** they are owned.

| Module | Export | Owning case | Status |
| --- | --- | --- | --- |
| `notify.ts` | `REASONS` | `4829`, `4874`, `5008` | partial — whole-array lock lives in `compat-01-no-expansion.test.ts:127` |
| `notify.ts` | `STATUS_TOKENS` | `4982` | duplicate of `compat-01-no-expansion.test.ts:184` |
| `notify.ts` | `PLUGIN_STATUSES` | `4981` | duplicate of `compat-01` |
| `notify.ts` | `MARKETPLACE_STATUSES` | `4980` | duplicate of `compat-01` |
| `notify.ts` | `ICON_*` (7 constants) | `4968–4979` | duplicate of `compat-01:290–296`, and weaker (literal glyphs, not codepoints) |
| `notify.ts` | `redactAbsolutePaths` | `5011–5043` (4 rows) + `6248` | owned; `6248` reaches an unreachable branch (see Branch census) |
| `notify.ts` | `notifyUsageError` | `2450` (slice A) | owned |
| `notify.ts` | `notifyDiagnostic` | `5380`, `5391` | owned; single-line boundary untested |
| `notify.ts` | `notifyAsyncRewakeSummary` | `5405`, `5416` | owned; single-char boundary untested |
| `notify.ts` | `notifyStopHookOverrideCap` | `5430` | owned — exact bytes |
| `notify.ts` | `isScopeBearingListRow` | `5329–5378` (4 rows) | owned; 4 of 19 statuses |
| `notify.ts` | `joinTokens` | `5045–5060` (3 rows) | owned |
| `notify.ts` | `renderVersion` | `5062–5104` (10 rows) | owned; uppercase-sha negative missing |
| `notify.ts` | `renderScopeBracket` | `5106–5136` (3 rows) | owned — all three branches |
| `notify.ts` | `composeVersionArrow` | `5138` | owned (1 case, asymmetric fixture) |
| `notify.ts` | `composeReasons` | `5149–5185` (3 rows) | owned; declares-flag *swap* killed only by siblings at `157`/`192` |
| `notify.ts` | `pluginRow` | `5187` | owned; hard-coded `false,false` killed only by siblings (`2923` + `piWithNothingLoaded`) |
| `notify.ts` | `partiallyInstalledRow` | `5204` | owned — kills the arg swap |
| `notify.ts` | `installedLikeRow` | `5219` | **VACUOUS** on `dependencies` — see BLOCKER |
| `notify.ts` | `renderUninstalledRow` | `5240` | owned (1 row) |
| `notify.ts` | `renderAvailableRow` | `5257` | owned (1 row) |
| `notify.ts` | `renderRemoteRow` | `5268` | owned (1 row) |
| `notify.ts` | `renderUnavailableRow` | `5279` | owned (1 row) |
| `notify.ts` | `renderPartiallyAvailableRow` | `5289` | owned (1 row) |
| `notify.ts` | `renderDisabledRow` | `5299` | owned (1 row) |
| `notify.ts` | `notify` | ~150 cases file-wide | owned, but 18/19 cascade arms are production-dead (see BLOCKER) |
| `notify.ts` | `emitContextCascade` | `5507`, `5552`, `5885`, `5958`-loop, `6229` | owned; 8 of those reach a dead branch |
| `notify.ts` | `emitUpdateNoOpCascade` | `5569`, `5588` | owned — both arms |
| `notify.ts` | `emitReconcileAppliedContextCascade` | `5624` | owned (1 case) — kills the hint mutation |
| `notify.ts` | `compareByNameThenScope` | `5444–5480` (4 rows) | owned; greater-than direction missing |
| `notify.ts` | `makeRawNotifyFn` | `5482–5505` (2 rows) | owned — both arms |
| `notify.ts` | `Sortable` (type) | `5444` rows (implicit) | no `satisfies` pin |
| `notify.ts` | 12 types listed above | — | **NO EXTERNAL CONSUMER** (used only inside `notify.ts`) |

## Branch census

Reachable and untested (findings above):
- `notify.ts:3417` — `sourceKind === "path"` suppression of `last_updated:` (BLOCKER).
- `notify.ts:3141` — the `message.label === undefined` half of `composeTally`'s guard.
- `notify.ts:404` / `425` — the 0-vs-1 boundary of both early-return guards.
- `SCOPE_BEARING_LIST_STATUS` — 15 of 19 keys.
- `notify.ts:2084` — `SHA_VERSION_DISPLAY_RE` case sensitivity.

Unreachable by real input (production dead code, not compiler-forced):
- `notify.ts:297` — `lastSep < 0 ? match : …` inside `redactAbsolutePaths`. The
  regex at `291` requires at least one internal `[\\/]`, so `Math.max` of the two
  `lastIndexOf` calls is always ≥ 0. The only case that reaches it (`6248`)
  monkeypatches `String.prototype.lastIndexOf`. Same class as META decision item 1.
- `notify.ts:3009–3010` — the `"An"` article (see finding above).
- `notify.ts:3784–3799` — `dispatchInfoMessage`'s `reconcile-applied-cascade` arm
  (no production caller).
- `notify.ts:2596–2688` — 18 of the 19 `renderPluginRow` arms, from production.

Compiler-forced and not removable as written (D-116-01a), but removable by
narrowing a parameter:
- `notify.ts:3245–3268` — `shouldEmitReloadHint`'s `isInfoKind` branch. Forced by
  `message: NotificationMessage`; narrowing to `CascadeNotificationMessage`
  deletes it.
- Every `default: { assertNever(x); return …; }` tail. Reached in tests only by
  `messageWithKindSequence` (a `kind` getter that returns a different value on
  each read) and by the `status` getter at `6317–6324` — objects whose
  discriminator mutates mid-render, which no real message can do.

## Grading of first-pass findings

### `tests/shared/notify.test.ts`

- **CONFIRMED** — *Substring/prefix/suffix as sole content check (~19 cases)* — In
  my range there is exactly one (`4721`, `assert.ok(!emitted.includes("/reload to pick up changes"))`
  at `4745–4748`) and it is genuinely weak: the full body
  `"● new-mp [user] (added)\n  ● a (installed)\n  ○ b (uninstalled)"` is fully
  determined by the fixture. The other 18 sit in slices A/B; grep confirms my
  2,209-line range contains only 4 fragment-assertion sites in total, so the
  weakness is concentrated at the front of the file, not spread through it.
- **CONFIRMED** — *Zero content assertion at `line 1055`* — Verified by reading
  `1055–1079`: the assert block is `calls.length` and `arguments.length` only,
  and the sibling at `1027` shows the correct `assert.deepEqual` form 25 lines
  above it.
- **CONFIRMED** — *Redundant substring assertions after an exact match (~10 cases)*
  — Verified at `336`: `assert.equal(args[0], "…")` at `363` followed by
  `assert.ok(args[0].includes("⊖ hookify"))` and a negated twin at `364–365`. Pure
  noise once `363` stands.
- **UNDERSTATED** — *"178 `as never` occurrences, all removable once the ports
  land"* — The real count is **382** (`grep -o "as never" | wc -l`): 185 `ctx`,
  180 `pi`, **15 `message`**, 2 other ctx-shaped. Two corrections follow. (a) The
  ctx/pi narrowing is worth *more* than recorded — 367 casts, not 178. (b) The
  claim that "every `as never` in this file can be deleted" once the ports land is
  **false**: the 15 message-position casts (`5537`, `6006`, `6025`, `6051`, `6075`,
  `6099`, `6123`, `6141`, `6159`, `6180`, `6199`, `6220`, `6239`, `6334`, `6367`)
  launder type-illegal *fixtures*, not host objects. They need the separate fixes
  named above. Severity stays BLOCKER; the fix list grows.
- **UNDERSTATED** — *"Inconsistent `const msg: NotificationMessage` vs `satisfies`
  … not a defect"* — It is a defect at `5516–5537`: the un-annotated literal is
  what allows an `installed` row with no `severity`, which GATE-01
  (`TransitionMessageBase`, `notify.ts:684`) exists to make a compile error, and
  the resulting `message as never` at `5537` is the cast that hides it. The
  sibling at `5557` uses `satisfies` and needs no cast. Raise from
  "consistency nit" to WARNING with a concrete fix.
- **UNDERSTATED** — *`String.prototype.lastIndexOf` patch at `6248`* — The first
  pass framed it as "very unlikely to leak" plus a redundant `restoreAll()`. The
  larger fact is that the branch it reaches (`notify.ts:297`) is **unreachable by
  real input**: the regex at `291` guarantees an internal separator. So this is a
  fifth instance of META decision item 1 ("prototype surgery to reach branches
  tracing shows are unreachable"), and `tests/shared/notify.test.ts` is **not** on
  META's list of the four files carrying that pattern. Same operator decision:
  delete the defensive branch, or keep it and drop the test.

### `extensions/pi-claude-marketplace/shared/notify.ts`

- **CONFIRMED** — *`ctx: ExtensionContext` / `pi: ExtensionAPI` are over-wide* —
  Verified: `ctx.ui.notify` is the only `ctx` access in 4,217 lines, and `pi` is
  only forwarded to `softDepStatus`. The proposed `NotifyCtx` / `SoftDepProbePi`
  ports are correct and dissolve 367 of the 382 casts.
- **CONFIRMED** — *`softDepStatus(pi)` is a render-time probe* — Accurate, and
  correctly rated WARNING: it is documented (SNM-16), bounded to one call per
  invocation, and touches only the reasons brace.
- **OVERSTATED** — *`computeSeverity`'s `plugin-info` arm derives severity from
  `status`* — This is a two-state kind lookup on a variant that structurally
  carries no per-row `severity` array, explicitly locked at `notify.ts:2862–2873`,
  and the first pass itself concedes "it does not appear to create an incorrect
  result today". Downgrade to a note. One real observation to attach: the same
  `plugin.status === "failed"` predicate is evaluated *twice* — `computeSeverity:2886`
  and `buildSummaryLine:3077` — which is exactly what the getter fixture at
  `6311–6341` exploits. Threading one computed value would remove the divergence.
- **CONFIRMED** — *The 4,217-line module mixes five separable concerns* — And my
  pass adds concrete evidence the split is warranted rather than aesthetic: the
  file contains **three** in-file duplications of its own "SOLE composition site"
  helpers (`installedLikeRow` ×3 at `2596`/`2614`/`2632`, `pluginRow` ×1 at
  `3657`), plus a duplicated cascade-block loop (`3981` vs `3917`). Those are the
  drift the seams exist to prevent, and they appeared *inside* the file that
  declares D-11.

## Still clean after attack

These survived the mutations named beside them. Do not spend fixing-pass time here.

- **`renderVersion`** (`lines 5062–5104`) — kills: off-by-one on the 7-char short
  SHA (`slice(5, 12)` → `slice(5, 11)`); dropping either prefix strip; unanchoring
  either regex (the 11- and 13-digit rows); collapsing `undefined` and `""` into
  different results; swapping `v` for `#`. Only the uppercase-sha row is missing.
- **`renderScopeBracket`** (`5106–5136`) — kills: rendering `[mpScope]` instead of
  `[pluginScope]`; dropping the same-scope suppression; dropping the `undefined`
  guard. All three branches covered by three rows.
- **`joinTokens`** (`5045–5060`) — kills: removing the empty-slot filter (double
  space); changing the separator; mishandling the empty list.
- **`partiallyInstalledRow`** (`5204`) — kills: swapping the
  `includes("agents")` / `includes("mcp")` arguments (the fixture declares only
  `agents`); emitting companion markers *before* the dropped-kind reasons; the
  glyph and token.
- **`notifyStopHookOverrideCap`** (`5430`) — kills: changing the cap `8`; dropping
  the backticks; changing the severity; collapsing the `\n\n` separator.
- **`makeRawNotifyFn`** (`5482–5505`) — kills both directions: always forwarding a
  severity (row 1 asserts a 1-element argument array) and never forwarding it
  (row 2).
- **`emitUpdateNoOpCascade`** (`5569`, `5588`) — kills: substituting
  `"(no marketplaces)"` for the empty body; dropping the fixed headline; placing
  the headline above the body instead of below.
- **`emitReconcileAppliedContextCascade`** (`5624`) — kills: computing the hint via
  `shouldEmitReloadHint` instead of passing `""` (the fixture stamps
  `needsReload: true` precisely so the mutation shows).
- **`composeTally`'s bare-header subtraction** (`notify.ts:3173–3176`) — killed
  twice: `5686` (bare header + 1 warning row → `"1 warning"`, not
  `"1 warning, 1 success"`) and `5507` (bare header + 1 info row → `"1 success"`,
  not `"2 successes"`).
- **`renderMpHeader`'s list-surface sub-branch B** (`6260`) — kills emitting
  `<no autoupdate>` on the list surface (the absence-conveys-off rule).
- **`notAddedReasonFor`'s three arms** (`6397`, the `6416` two-row loop, `6442`) —
  kills: naming the wrong scope in the qualified token; emitting the qualified
  token with no `scope`; joining the plain and qualified tokens instead of
  replacing.
- **`foldTallyAndHint` segment order** (`5507`) — the one fixture with body +
  tally + hint all non-empty kills any reordering or separator change.
- **`pluginInfoStatusGlyph`** (`5801` 4-row loop) — kills a wrong glyph on
  `partially-installed`, `disabled`, `remote`, `partially-available`.
- **`partialHintTrailerFor`'s `failed` arm** (`6478`) and
  **`composePluginLinesWith`'s enable-hint trailer** (`5885`) — kill the trailer
  bytes, the 4-space indent, and the trailer-after-row ordering.
- **`renderIndentedCauseChain`'s empty-trailer guard** (`6343`, `cause: null`) —
  kills pushing an empty indented line.
- **`emitWithSummary`'s two arms** — killed throughout: every error/warning case
  asserts the `"<summary>\n\n<body>"` shape *and* the second `ctx.ui.notify`
  argument; every info case asserts a 1-element argument array.

Structural properties I checked and found sound across the whole range: no
`describe()`, no `it()`, no committed `only`/`skip`/`todo`; `// arrange` /
`// act` / `// assert` present and ordered on every case (`// act & assert` on the
`assert.throws` cases); every double comes from the case's own `t.mock`; no
`before`/`beforeEach`, no module-scope mutable state (`bothLoadedProbe` /
`neitherLoadedProbe` / `createContext` / `piWith*` are all fresh-per-call
factories); no filesystem, network, timers, or `process.env`; data-driven groups
use one sibling `test()` per row with no conditionals in the loop body; and the
file imports `node:assert/strict`, so `assert.equal` / `assert.deepEqual` are the
strict variants — the loose-comparison finding one would expect here does not
apply.

## Not covered

- I did not run `node --test`, `npm run check`, or any coverage command, per the
  diagnostic restriction. Every mutation verdict above is from reading the
  production source against the fixtures, not from executing a mutant.
- Lines 106–4450 (slices A and B) are graded only where the first pass named a
  line and I could settle it by reading that line (`336`, `1027`, `1055`). I did
  read outside my range to settle whether siblings kill mutations — the results
  are stated in the census.
- `tests/shared/notify-context.test.ts` and `tests/shared/notify-reasons.test.ts`
  and their production modules remain out of scope, as in the first pass. Note
  that `shared/notify-context.ts` is where the *live* cascade path lives, so the
  reachability BLOCKER above cannot be fully resolved without reviewing it.
- I did not verify that each command's `*.messaging.ts` render map is byte-equal
  to the `renderPluginRow` arm it lifts. That equivalence is asserted only by
  prose (`notify-context.ts:34–37`) and by both sides independently matching
  `docs/output-catalog.md` through `tests/architecture/catalog-uat.test.ts`; no
  test compares the two renderers directly.

## Meta-findings impact

### New cross-cutting evidence

1. **`assertNever`'s error carries no structured field, so every test that asserts
   it is non-discriminating.** `shared/errors.ts:26` throws
   `new Error(\`Unexpected value: ${String(x)}\`)`. For any object argument that
   message is the constant `"Unexpected value: [object Object]"`. Nine cases in my
   range alone assert exactly that string and are therefore satisfied by *any*
   `assertNever` anywhere in the call chain. This repo has `assertNever` tails on
   closed-union switches throughout `domain/`, `orchestrators/`, `bridges/`, and
   `persistence/` — **every area with an exhaustiveness test is likely to carry
   the same non-discriminating assertion.** Recommend a repo-wide grep for
   `"Unexpected value: \[object Object\]"` and a single production fix: a typed
   `UnexpectedValueError` carrying `readonly value: unknown` and a site tag,
   matching `shared/errors.ts`'s own stated convention. This connects directly to
   META's "Restore exhaustiveness on closed-union switches" item — adding
   `assertNever` arms is only half the value if the tests that prove they fire
   cannot tell which one fired.

2. **A fifth instance of the "prototype surgery to reach unreachable branches"
   class, in a file META does not list.** `tests/shared/notify.test.ts:6248`
   patches `String.prototype.lastIndexOf` to reach `notify.ts:297`, a branch the
   regex at `notify.ts:291` makes unreachable. META decision item 1 names
   `bridges/commands/{stage,discover}.test.ts`,
   `bridges/hooks/if-field/{bash,glob}.test.ts`, and
   `orchestrators/marketplace/remove.test.ts`. Add this one.

3. **A related but distinct technique worth its own operator decision:
   getter-based discriminator mutation.** `tests/shared/notify.test.ts:91–104`
   defines `messageWithKindSequence`, which builds an object whose `kind` getter
   returns a *different* value on each read, so a message can be one variant when
   `notify()` narrows it and another when `computeSeverity` re-reads it. The same
   trick is applied to `plugin.status` at `6317–6324`. Six cases depend on it, two
   of them on undocumented read-counts (`11`, `17`) derived from the comparison
   order inside `isInfoKind`. This is coverage-driven construction of an
   impossible input, like the prototype patches, but it leaves no global side
   effect — so it will not be found by grepping for `prototype`. **Other areas
   with `assertNever` coverage should be grepped for `Object.defineProperty(` in
   test files.**

4. **The "grep the call graph before trusting a module comment" rule cuts a third
   way.** META records comments that lie in both directions (a false
   production-lifecycle claim, an honest test-only admission). `notify.ts:2007–2022`
   is a third shape: a comment that *correctly* identifies its code as nearly-dead
   but gets the surviving live caller wrong, which is what let ~60 test cases
   accumulate on a path with one production arm. Recommend the audit of
   architectural gates META already proposes be widened to **reachability claims
   in module headers**, verified by grepping call sites, not by reading the header.

### Corrections to META-FINDINGS.md

- **"178 `as never` casts in `tests/shared/notify.test.ts` alone."** (Ranked by
  leverage, item 1.) The real figure is **382** occurrences
  (`grep -o "as never" tests/shared/notify.test.ts | wc -l`), of which 185 are
  `ctx as never`, 180 are `pi as never`, 15 are `message as never`, and 2 are
  other ctx-shaped locals. The 178 figure appears to be a count of *lines*
  containing the token in one part of the file. Correction: raise the number to
  382, and split it — 367 are dissolved by the ctx/pi narrowing, 15 are not.

- **"One production change per function dissolves the whole cluster."** (Same
  item.) Not the whole cluster, in this file. The 15 message-position casts
  (`tests/shared/notify.test.ts:5537, 6006, 6025, 6051, 6075, 6099, 6123, 6141,
  6159, 6180, 6199, 6220, 6239, 6334, 6367`) launder type-illegal *message
  fixtures* past the compiler and survive the port change untouched. One of them
  (`5537`) hides a GATE-01 violation — an `installed` row with no `severity`,
  which `TransitionMessageBase` (`notify.ts:684`) exists to reject — and is fixed
  by copying the `satisfies` form its own sibling at `5557` already uses. The
  other 14 are the assertNever/getter fixtures. Correction: keep the item ranked
  first (it is worth more than recorded) but add a second, smaller ticket for the
  message-position casts so they are not assumed gone.

- **"Roughly 100+ cases use `.includes()` … `shared/notify.test.ts` | ~19 cases."**
  (Ranked by leverage, item 3.) Accurate in count but misleading in distribution:
  the fragment assertions are concentrated in lines 1147–4315. My 2,209-line range
  (4450–6659) contains exactly **one** (`4721`), plus two `.includes()` uses that
  are closed-set membership checks rather than message assertions (`4834`,
  `4884`). Correction: the file is not uniformly weak — a fixing pass targeting
  this file should be scoped to its first two thirds.

### Confirmations

- **"Clean verdicts are not reliable."** (Provenance.) Confirmed from a different
  angle than intended: this area's first-pass file declared **no** clean files at
  all, and the unfalsified negatives were the ~175 un-flagged *cases* inside the
  one file it did review. Four of the five new BLOCKERs above come from cases the
  first pass neither flagged nor mentioned. The clean-list attack should be
  extended to "cases the reviewer did not name" wherever an area is a single
  large file.

- **"The dominant shape: sibling drift."** Confirmed three times inside a single
  file, which is the tightest possible radius: `renderVersion`'s sha rows lack the
  uppercase negative its hash rows have (`5062–5104`); `emitContextCascade`'s
  fixture at `5516` omits the `satisfies` its twin at `5557` uses; `installedLikeRow`'s
  case at `5219` omits the dependency coverage its neighbour
  `partiallyInstalledRow` (`5204`) gets right. And in production:
  `renderPluginRow` inlines three copies of `installedLikeRow` while calling
  `pluginRow`, `renderDisabledRow`, and the other composers correctly.

- **"Patterns to propagate — whole-message assertion against hand-written
  strings."** Independently confirmed: the tail of `notify.test.ts` (4450–6659)
  already *is* a reference implementation of this pattern, with ~88 of ~90 cases
  comparing complete rendered strings. When the fixing pass rewrites the ~19
  fragment assertions in the front of the file, the target form is 2,000 lines
  further down in the same file — no cross-file lookup needed.

- **"`assertNever` default arms are the fix for the silent-omission class."**
  (Ranked by leverage, item 5.) Confirmed in effect but qualified: `notify.ts`
  applies the idiom thoroughly (six `assertNever` tails), and the closed-set
  length tripwires in `tests/architecture/notify-closed-set-locks.test.ts` plus
  the whole-array locks in `compat-01-no-expansion.test.ts` are the strongest
  example of the pattern I found. The gap is not the arms — it is that the tests
  proving they fire cannot distinguish them (cross-cutting item 1).
