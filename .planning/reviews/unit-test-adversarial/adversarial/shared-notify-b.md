# Shared — notify (the single UI output surface) — adversarial re-review

**Scope:** `tests/shared/notify.test.ts` lines 2200–4450 (62 `test()` cases), plus the
slice of `extensions/pi-claude-marketplace/shared/notify.ts` those cases reach:
`renderMpHeader`, `renderPluginRow` and every row composer it dispatches to,
`renderPendingRow`, `computeSeverity`/`cascadeSeverity`, `countRowsBySeverity`,
`summaryPhrase`/`buildSummaryLine`/`buildSummaryLineForCascade`, `foldTallyAndHint`,
`shouldEmitReloadHint`, `renderIndentedCauseChain`, `composeRollbackPartialLines`,
`composePluginLinesWith`, `wrapDescription`, `composeMpInfoHeader`,
`renderMarketplaceInfo(Cascade)`, `renderPluginInfo(Cascade)`, `pluginInfoStatusGlyph`,
`appendResolvedComponentLines`, `renderMarketplaceNotAdded`/`notAddedReasonFor`,
`dispatchInfoMessage`, `emitWithSummary`, `notify`, `notifyUsageError`.
**First-pass file:** `unit-test-findings/shared-notify.md`
**Clean files attacked:** 0 test files listed clean (the first pass's `### Clean files`
list is empty — it says "No other test files were in scope"). Primary effort therefore
went into the mutation test, the export census, and the branch census over the
production slice, per Step 2 of the brief.
**Existing findings graded:** 16 (8 individual sites of the grouped fragment-assertion
BLOCKER, 4 other test findings, 4 production findings)

## Verdict summary

| Metric | Count |
| --- | --- |
| New BLOCKER (missed by first pass) | 4 |
| New WARNING (missed by first pass) | 12 |
| Existing CONFIRMED | 8 |
| Existing UNDERSTATED | 1 |
| Existing OVERSTATED | 7 |
| Existing REFUTED | 0 |
| Existing DUPLICATE-OF | 0 |

## New findings — from the mutation test

### `tests/shared/notify.test.ts`

- **[BLOCKER] The no-reasons `(skipped)` marketplace header byte form is asserted
  nowhere in the repo** — `test('UXG-02 (D-28-08): mp-level skip with reasons OMITTED
  computes warning -- safe default')` at `line 2825`
  Its whole assert block is `assert.equal(ctx.ui.notify.mock.calls.length, 1)`,
  `assert.equal(args.length, 2)`, `assert.equal(args[1], "warning")` (`lines 2846–2849`) —
  it never reads `args[0]`. It is the only case in the file whose payload reaches the
  `reasonsBrace === ""` sub-branch of `renderMpHeader`'s `"skipped"` arm
  (`notify.ts:1967–1969`). Every other `status: "skipped"` marketplace fixture in the
  file carries reasons (`lines 768, 1036, 1064, 1090, 1123, 1156, 3098, 4543, 4577, 6292`),
  and each of those is asserted with a brace. **Mutating `notify.ts:1968` to return
  `` `${ICON_INSTALLED} ${mp.name} [${mp.scope}] {}` `` or to drop the `(skipped)` token
  entirely leaves the whole suite green.** `MpSkipped.reasons` is optional and its own
  doc comment (`notify.ts:1295-1296`) states that a missing reason set is a real producer
  shape routed to the warning default, so this is reachable-untested, not dead code.
  Fix: replace `lines 2846–2849` with
  `assert.deepStrictEqual(ctx.ui.notify.mock.calls[0]!.arguments, ["A marketplace operation needs attention.\n\n● demo [user] (skipped)", "warning"])`.

- **[BLOCKER] The D-76-10 "`last_updated:` never renders for a `path` source" guard has
  no case anywhere in `tests/`** — `notify.ts:3417`
  `renderMarketplaceInfo` gates the `last_updated:` line on
  `message.source.sourceKind !== "path" && message.details.lastUpdatedAt !== undefined`.
  All four `path`-source cases (`lines 3459, 3764, 3806, 3882`) omit `lastUpdatedAt`, and
  all `lastUpdatedAt` cases (`lines 1189, 3429, 3723, 3842, 5779`) use `github`/`url`.
  Verified repo-wide: `grep -B6 -A6 'sourceKind: "path"' tests/ | grep lastUpdatedAt`
  returns zero hits, including `tests/architecture/catalog-uat.test.ts`. **Deleting the
  `sourceKind !== "path"` half of the condition fails no test.** Fix: add one case
  beside `line 3459` with `details: { autoupdate: false, lastUpdatedAt: "2026-05-01T12:34:56Z" }`
  and `source: { sourceKind: "path", absPath: "/home/user/projects/local-mp" }`, asserting
  `assert.deepStrictEqual(args, ["● local-mp [project] <no autoupdate>\npath: /home/user/projects/local-mp"])`.

- **[BLOCKER] The two AS-7 leaked-paths cases use unanchored regex and a standalone
  negative instead of the whole rendered string** — `lines 2504` and `2547`
  At `line 2541-2544` the case asserts `assert.match(rendered, /cause: agent index rewrite failed -> EACCES/)`
  and then, in a loop, `assert.match(rendered, new RegExp('    leaked: ' + escapedPath))`
  once per leak. Every one of these regexes is unanchored, so: changing the leaked-row
  indent from 4 to 6 spaces passes (`"      leaked: …"` still contains `"    leaked: …"`);
  reversing the order of the two `leaked:` rows passes; emitting an extra spurious row
  passes; changing the `(manual recovery)` token or dropping the `● demo [user]` header
  passes. At `line 2578` the sibling case's *only* assertion is
  `assert.doesNotMatch(rendered, /leaked:/)` — a standalone negative that passes for any
  value including the empty string, and it never checks `calls.length`. Both payloads are
  fully determined; `composePluginLinesWith` (`notify.ts:4139-4141`) applies no redaction,
  so the bytes are mechanical. Fix: replace both assert blocks with
  `assert.deepStrictEqual(ctx.ui.notify.mock.calls[0]!.arguments, ["A plugin operation needs attention.\n\n● demo [user]\n  ⊘ commit-commands v1.0.0 (manual recovery) {rollback partial}\n    cause: agent index rewrite failed -> EACCES\n    leaked: /home/u/.pi/pi-claude-marketplace/agents-staging/foo.md\n    leaked: /home/u/.pi/pi-claude-marketplace/agents-index.json", "warning"])`
  and the equivalent no-leaks literal for `line 2547`.

- **[BLOCKER] The cascade-kind equivalence case compares two production outputs against
  each other** — `test('an omitted cascade kind renders byte-identically to an explicit
  cascade kind')` at `line 4140`, assertion at `lines 4190–4194`
  `assert.deepEqual(noKindArgs, withKindArgs)` — both sides come from `notify()`. The rule
  is "Expected values are built independently: no calling the production formatter"; here
  a renderer that emits the wrong bytes for *both* kinds passes. It is the only case in
  the file that constructs two contexts (`lines 4142-4143`). Fix: keep both `notify()`
  calls and assert each against the same hand-written literal —
  `const expected = ["● official [user]\n  ● alpha v1.0.0 (installed)\n\n/reload to pick up changes"];`
  then `assert.deepStrictEqual(noKindArgs, expected)` and
  `assert.deepStrictEqual(withKindArgs, expected)`.

- **[WARNING] Seven further cases assert only `arguments.length` and/or `arguments[1]`
  with no content assertion at all** — `lines 2304, 2336, 2368, 2718, 2751, 2792, 4321`
  (plus `line 2825`, filed as the BLOCKER above, and `line 1055` in slice A, which the
  first pass filed as a lone BLOCKER). Each is individually undiscriminating — any
  rendered body, including `""`, passes — but for these seven a sibling case with the
  identical or near-identical payload does pin the bytes: `2304`↔`3119`, `2336`/`2718`↔`5716`,
  `2368`↔`2259`, `2751`↔`786`, `2792`↔`2610`, `4321`↔`4221`. Fix as one rule: for each,
  add the full `assert.deepStrictEqual(ctx.ui.notify.mock.calls[0]!.arguments, [...])`
  the sibling already uses, or delete the case as a duplicate of that sibling. Do not
  leave a case whose only promise is an argument count.

- **[WARNING] `wrapDescription`'s wrap threshold is tested only on the permissive side of
  the boundary** — `lines 3337` (66 chars, stays on one line) and `3292` (121 chars, wraps)
  There is no case at 67. Mutating `notify.ts:1843` from `<= wrapCol` to `<= wrapCol + 1`
  leaves both cases green. The sibling helper in the same file gets this right:
  `truncateDescription`'s boundary is pinned on *both* sides at `lines 1522` (exactly 66)
  and `1548` (67). Fix: add a sibling to `line 3337` with `"a".repeat(32) + " " + "b".repeat(34)`
  (width 67) asserting `[\`    ${a}\`, \`    ${b}\`, "    components: not resolved"]`.

- **[WARNING] The `componentsResolved: true` + empty `components: {}` shape has no case in
  the paired test module** — all 11 `componentsResolved: true` fixtures in the file sit in
  this slice (`lines 3497, 3573, 3618, 3653, 3695, 3927, 3963, 3976, 4019, 4032, 4068`) and
  every one supplies at least one non-empty kind. `orchestrators/plugin/info.ts:794` and
  `:830` both emit `{ componentsResolved: true, components: {} }` for the manifest-read
  failure and not-in-manifest rows, and the comment there is explicit that this shape must
  emit *neither* per-kind lines *nor* the `components: not resolved` marker. Only
  `tests/architecture/catalog-uat.test.ts:3772` exercises it, and that file does not own
  `notify.ts`'s contract. Fix: add a case beside `line 3373` with
  `plugin: { status: "failed", name: "bad-mp", reasons: ["invalid manifest"], componentsResolved: true, components: {} }`
  asserting the two-line body with no third line.

- **[WARNING] Two SURF-02 cases re-test `appendHooksBlock`, which `tests/shared/concerns/hooks.test.ts`
  already owns** — `lines 3560` and `3682`
  `appendHooksBlock` lives in `shared/concerns/hooks.ts` and its paired module already
  covers tool-event-with-matcher, non-tool-event, supported/unsupported lenient arms,
  mixed order, and exact indentation (`hooks.test.ts:75, 88, 101, 116, 131, 159, 175`).
  `notify.test.ts:3560` (matcher rendering) and `:3682` (the lenient `(unsupported)`
  suffix) assert the same bytes through a longer path. `notify.ts`'s own contract is only
  that `appendResolvedComponentLines` routes the `hooks` kind to that helper and that an
  empty/absent `hooks` suppresses the header while sibling kinds still render — which is
  exactly what `line 3605` proves. Fix: keep `3605`; collapse `3560` and `3682` into one
  case that renders `hooks` interleaved with a non-hooks kind, and delete the arm-by-arm
  duplication.

- **[WARNING] The `pluginInfoDescriptionBlock` harness performs the arrange and act, and
  slices the production result before the assertion** — helper at `line 3237`, consumed by
  the 8 cases at `lines 3259, 3270, 3281, 3292, 3304, 3315, 3326, 3337`
  It builds the context, builds the message, calls `notify()`, and returns
  `body.split("\n").slice(2)`. Two consequences: every one of those cases labels the helper
  call `// act` while the arrange happens inside it, and the marketplace header and plugin
  row are dropped before any case can see them. Fix: move the message construction into
  each case's `// arrange` block (the only varying input is `description`), have the helper
  return the whole body, and assert the complete string with the two known leading lines
  included.

- **[WARNING] A fixture precondition is asserted in the `// assert` block** — `line 3337`,
  assertion at `line 3348`
  `assert.equal(width, expectedWidth, "fixture precondition: joined width must be exactly 66")`
  checks the test's own arithmetic, not production behavior, and `const width = ...` is
  computed under `// act`. Fix: drop the arithmetic and write the two literals directly, or
  move the precondition check to the end of `// arrange`.

- **[WARNING] Nothing asserts the single-soft-dep-probe-per-invocation discipline** —
  `notify.ts:3818-3822` documents "Single soft-dep probe per invocation … No per-row
  re-probing" (SNM-16), and `emitCascadeWith`/`emitUpdateNoOpCascade` repeat the same
  promise. The `pi` doubles in this file are plain objects
  (`piWithBothLoaded` etc., `lines 67–89`) that record nothing, and
  `grep -rn getAllTools tests/` shows no call-count assertion outside
  `tests/architecture/notify-producer-wire-coverage.test.ts:57-59`. **Moving
  `softDepStatus(pi)` inside the per-row loop leaves every case in this file green.** The
  in-repo template is that same wire-coverage file, which writes
  `when(() => pi.getAllTools()).thenReturn([]).twice()` on a `strong-mock`. Fix: in one
  representative multi-row cascade case, build `pi` as
  `mock<ExtensionAPI>({ exactParams: true, name: "extension api" })`, state
  `when(() => pi.getAllTools()).thenReturn([]).once()`, and `verify(pi)` after the result
  assertions.

### `extensions/pi-claude-marketplace/shared/notify.ts`

- **[WARNING] `summaryPhrase`'s `"An"` article branch is unreachable, and the comment
  justifying it states the opposite of what the call sites allow** — `lines 3006–3010`
  The comment reads "CR-01: mixed-subject (subject === null) drops the noun, so the
  count-1 form would read 'A operation' — vowel-initial, grammatically 'An'." But
  `subject === null` is passed at exactly two call sites (`lines 3032` and `3101`), both
  guarded by `counts.plugins > 0 && counts.marketplaces > 0`, so the count is always ≥ 2
  and `singular` is always `false` there. Every other call site passes `"plugin"` or
  `"marketplace"`, both consonant-initial. `/^[aeiou]/i.test(noun)` can therefore never be
  true, and `singularArticle` is always `"A"`. Independently corroborated by
  `tests/architecture/notify-grammar-invariant.test.ts:71` whose binding
  `SUMMARY_GRAMMAR` regex is `/^(A|Some) (plugin |marketplace )?operations? …/` — it has no
  `An` alternative, so an `An …` summary would *fail* that gate. Fix: replace `lines
  3009–3010` with `const article = singular ? "A" : "Some";` and delete the CR-01
  rationale, or — if a vowel-initial subject is genuinely planned — keep the branch and add
  the producing call site. Do not leave a branch whose only documentation is a
  counterfactual.

- **[WARNING] Doc comment cites a test file that does not exist** — `line 374`
  `notifyUsageError`'s JSDoc says "`tests/shared/notify-v2.test.ts` asserts it
  byte-for-byte." No such file exists (`ls tests/shared/`); the assertion actually lives at
  `tests/shared/notify.test.ts:2450`. `grep -rn notify-v2` finds hits only under
  `.planning/`. Fix: re-point the citation at `tests/shared/notify.test.ts`, or drop the
  file reference and name the contract instead.

- **[WARNING] Doc comment cites a stale line number in a doc file** — `line 2135`
  `renderScopeBracket`'s JSDoc calls `docs/messaging-style-guide.md:73` "the binding
  contract"; line 73 of that file is about `cause?: Error` / `rollbackPartial?`. The
  orphan-fold contract is at line 81. Fix: cite the section heading
  ("Conditional plugin-row scope bracket") rather than a line number — line-number
  citations into prose rot on every edit.

- **[WARNING] The `renderPluginRow` header comment misstates which call sites reach the
  legacy cascade arm** — `lines 2013–2022`
  It claims the arm is "reached today only by the `{ marketplaces: [] }` empty sentinel,
  which short-circuits to `(no marketplaces)` before the plugin loop runs."
  `edge/handlers/plugin/enable-disable.ts:68` calls `notify(ctx, pi, { marketplaces: [{ …,
  plugins: [{ status: "failed", … }] }] })`, which does reach `composePluginLines` and the
  `failed` arm. Enumerating every production `notify()` statement
  (`grep -rn '^\s*notify(' extensions/`) gives 20 call sites: 15 standalone info kinds,
  2 empty sentinels (`reinstall.ts:535`, `update.ts:374`), 1 marketplace-only row
  (`bootstrap.ts:75`, `plugins: []`), and exactly 1 that renders a plugin row. Fix the
  comment to say "one production caller reaches the plugin loop
  (`edge/handlers/plugin/enable-disable.ts:68`, the `failed` arm); every other arm is
  reached only through `emitContextCascade`." See the note in **Branch census** on what
  this implies for where these cases belong.

- **[WARNING] `renderPendingRow`'s switch has no `default` group** — `lines 2522–2536`
  The Google-style rule is "Every `switch` has a `default` group, last, even if empty," and
  every other switch in this file ends with `default: { assertNever(…); return ""; }`.
  This one is compile-safe as written — `noImplicitReturns: true` (`tsconfig.json:11`)
  makes a fifth pending status a TS7030 error — so this is a consistency finding, not the
  silent-omission class. Fix: add `default: { assertNever(p); return ""; }` to match the
  eight sibling switches in the file.

## Export ownership census

`notify.ts` has 37 runtime exports. All 37 are imported by `tests/shared/notify.test.ts`
(`lines 5–48`) and all 37 have at least one owning case — **no export is uncovered**. The
slice column records which third of the file owns each, so the three concurrent reviews
merge without gaps.

| Module | Export | Owning case | Status |
| --- | --- | --- | --- |
| `notify.ts` | `notify` | `notify.test.ts` ~150 cases, incl. all of `2200–4450` | owned (slice B primary) |
| `notify.ts` | `notifyUsageError` | `notify.test.ts:2450` | owned (slice B) |
| `notify.ts` | `notifyDiagnostic` | `notify.test.ts:5380` | owned (slice C) |
| `notify.ts` | `notifyAsyncRewakeSummary` | `notify.test.ts:5405` | owned (slice C) |
| `notify.ts` | `notifyStopHookOverrideCap` | `notify.test.ts:5430` | owned (slice C) |
| `notify.ts` | `redactAbsolutePaths` | `notify.test.ts:5038`, `6253` | owned (slice C) |
| `notify.ts` | `joinTokens` | `notify.test.ts:5055` | owned (slice C) |
| `notify.ts` | `renderVersion` | `notify.test.ts:5099` | owned (slice C) |
| `notify.ts` | `renderScopeBracket` | `notify.test.ts:5131` | owned (slice C) |
| `notify.ts` | `composeVersionArrow` | `notify.test.ts:5143` | owned (slice C) |
| `notify.ts` | `composeReasons` | `notify.test.ts:5180` | owned (slice C) |
| `notify.ts` | `partiallyInstalledRow` | `notify.test.ts:5204` | owned (slice C) |
| `notify.ts` | `installedLikeRow` | `notify.test.ts:5219` | owned (slice C) |
| `notify.ts` | `renderUninstalledRow` | `notify.test.ts:5240` | owned (slice C) |
| `notify.ts` | `renderAvailableRow` | `notify.test.ts:5257` | owned (slice C) |
| `notify.ts` | `renderRemoteRow` | `notify.test.ts:5268` | owned (slice C) |
| `notify.ts` | `renderUnavailableRow` | `notify.test.ts:5279` | owned (slice C) |
| `notify.ts` | `renderPartiallyAvailableRow` | `notify.test.ts:5289` | owned (slice C) |
| `notify.ts` | `renderDisabledRow` | `notify.test.ts:5299` | owned (slice C) |
| `notify.ts` | `pluginRow` | `notify.test.ts:5204`-block | owned (slice C) |
| `notify.ts` | `isScopeBearingListRow` | `notify.test.ts:5373` | owned (slice C) |
| `notify.ts` | `compareByNameThenScope` | `notify.test.ts:5475` | owned (slice C) |
| `notify.ts` | `makeRawNotifyFn` | `notify.test.ts:5484` | owned (slice C) |
| `notify.ts` | `emitContextCascade` | `notify.test.ts:5507` | owned (slice C) |
| `notify.ts` | `emitUpdateNoOpCascade` | `notify.test.ts:5569` | owned (slice C) |
| `notify.ts` | `emitReconcileAppliedContextCascade` | `notify.test.ts:5624` | owned (slice C) |
| `notify.ts` | `REASONS` | `notify.test.ts:4829` | owned (slice C) |
| `notify.ts` | `STATUS_TOKENS` | `notify.test.ts:4982` | owned (slice C) |
| `notify.ts` | `PLUGIN_STATUSES` | `notify.test.ts:4981` | owned (slice C) |
| `notify.ts` | `MARKETPLACE_STATUSES` | `notify.test.ts:4980` | owned (slice C) |
| `notify.ts` | `ICON_INSTALLED` … `ICON_PARTIALLY_AVAILABLE` (7) | `notify.test.ts:4969–4975` | owned (slice C) |

Incidental-only coverage inside slice B: none — every case in `2200–4450` drives `notify()`
or `notifyUsageError()` deliberately. The observation worth carrying forward is the
inverse of a census gap: **slice B contains no direct exercise of any composer export**, so
all ~62 of its cases route through the one dispatcher whose production reachability is
one arm out of nineteen (see Branch census).

## Branch census

Classified per the brief's three categories, over the production slice slice B reaches.

**(a) Reachable and untested**

| Branch | Location | Evidence |
| --- | --- | --- |
| `renderMpHeader` `"skipped"` arm, `reasonsBrace === ""` | `notify.ts:1967-1969` | Only `test:2825` reaches it and it asserts no bytes. `MpSkipped.reasons` is optional by design (`notify.ts:1300`). New BLOCKER 1. |
| `renderMarketplaceInfo` `sourceKind !== "path"` gate on `last_updated` | `notify.ts:3417` | Zero path+`lastUpdatedAt` fixtures repo-wide. New BLOCKER 2. |
| `wrapDescription` `current.length + 1 + word.length <= wrapCol` (false side at width 67) | `notify.ts:1843` | Only the `=== 66` true side and a far-over-width false side exist. New WARNING. |
| `appendResolvedComponentLines` with every kind `undefined` and `dependencies` absent (`components: {}`) | `notify.ts:3551-3565` | Real producer shape (`orchestrators/plugin/info.ts:794`, `:830`); no case in the pair. New WARNING. |

**(b) Unreachable by real input**

| Branch | Location | Evidence |
| --- | --- | --- |
| `summaryPhrase` `singularArticle === "An"` | `notify.ts:3009` | `subject === null` implies `count >= 2` at both call sites (`3032`, `3101`); all other call sites pass consonant-initial nouns. Corroborated by `notify-grammar-invariant.test.ts:71`'s regex, which has no `An` alternative. This is production dead code with a counterfactual comment. |
| `buildSummaryLine` / `buildSummaryLineForCascade` 0/0 degrade-to-plugin-plural | `notify.ts:3109`, `3039` | `computeSeverity` returns `error`/`warning` only when a matching stamped row exists, so `counts` for that severity is ≥ 1. The code already documents this as an unreachable degrade; leave it. |
| `composeReconcileAppliedBody` `(no marketplaces)` fallback | `notify.ts:3720` | Its own comment states callers must short-circuit first; kept for parity. |

**(c) Compiler-forced, not removable**

`renderMpHeader`'s `default: assertNever(mp)` (`notify.ts:1994`), `renderPluginRow`'s
`default: assertNever(p)` (`2689`), `pluginInfoStatusGlyph`'s `default` (`3512`),
`renderMarketplaceInfo`'s `default: assertNever(message.source)` (`3408`),
`renderPluginInfo`'s `default: assertNever(plugin)` (`3681`), and the `default` arms in
`computeSeverity` (`2895`), `buildSummaryLine` (`3090`), `shouldEmitReloadHint` (`3264`),
`dispatchInfoMessage` (`3800`), `notify` (`3851`). These are the D-116-01a category. Note
that slice C reaches several of them at runtime via `messageWithKindSequence`
(`notify.test.ts:91`), an `Object.defineProperty` getter that returns a different `kind`
on successive reads — object surgery rather than global-prototype surgery, so materially
safer than the four cases META-FINDINGS flags under "Decisions", but the same shape.
Ownership of that judgement sits with slice C.

**Reachability note that changes where these cases belong.** Enumerating every production
`notify()` statement shows only `edge/handlers/plugin/enable-disable.ts:68` reaches the
plugin-row loop, and only through the `failed` arm. Every other production row is composed
by a command's own `context.render[status]` map via `notifyWithContext` /
`emitContextCascade`. The eighteen other `renderPluginRow` arms slice B exercises are
therefore reachable in production only through a different entry point. This is *not* an
argument for deleting the cases — the arms delegate to the same exported composers the
render maps call, so the byte assertions still bind — but it does mean the bulk of slice B
is testing a legacy dispatcher. If the module split in the first pass's production finding
goes ahead, re-point these cases at `emitContextCascade` (the live seam) or at the
composers directly, and keep on `notify()` only what production actually drives.

## Grading of first-pass findings

### `tests/shared/notify.test.ts`

**Finding U1 — "Substring/prefix/suffix assertion used as the sole content check, ~19
cases".** Eight of its cited sites fall in my range; graded individually because they do
not share a verdict.

- **CONFIRMED** — `line 3067` (two actionable-skip plugins + one actionable-skip mp) — no
  sibling pins a two-marketplace warning cascade, and its second block is precisely the
  never-asserted `● other [user] (skipped)` byte form of new BLOCKER 1.
- **CONFIRMED** — `line 3153` (summary before body, trailer last) — the two middle rows are
  unasserted and no other case pins a single marketplace block holding both an
  info-severity plugin row and an error-severity one; `4793`'s info row sits in a separate
  clean marketplace, so dropping info rows from a mixed block survives.
- **OVERSTATED → WARNING** — `line 2923` (two failed plugins) — `line 2259` asserts the
  full string for the same two-failed-plugin error cascade, including the identical
  `Some plugin operations have failed.` summary; the case adds nothing but a weaker check.
- **OVERSTATED → WARNING** — `line 2996` (single actionable-skip) — `line 3032` pins the
  one-row warning summary byte-for-byte and `line 5716` pins `(skipped) {not installed}`.
- **OVERSTATED → WARNING** — `line 3200` (benign-only cascade routes to info) — every byte
  of its expected output is pinned by `line 786` (`⊘ … v1.0.0 (skipped) {up-to-date}`) plus
  `lines 3032`/`2469` (the bare `● demo [user]` header).
- **OVERSTATED → WARNING** — `line 3806` (marketplace-info-cascade no trailer) —
  `line 3764` asserts the whole string for a **byte-identical `blocks` payload**.
- **OVERSTATED → WARNING** — `line 4003` (plugin-info-cascade no trailer) — `line 3947`
  asserts the whole string for a byte-identical `blocks` payload.
- **OVERSTATED → WARNING** — `line 4293` (will-\* emits no trailer) — `lines 4197`, `4221`,
  and `4244` pin all four pending statuses byte-exactly, so appending a trailer to any of
  them already fails.

  Fix rule for the six OVERSTATED sites: fold the one extra fact each carries (usually
  `args.length`) into its byte-form sibling and delete the fragment case. They cost
  maintenance and buy nothing.

- **UNDERSTATED** — Finding U2, "Zero content assertion despite a title claiming to verify
  the rendered row" (`line 1055`) — recorded as a single case; it is a class of **nine**.
  Slice B alone holds eight more (`2304, 2336, 2368, 2718, 2751, 2792, 2825, 4321`), and
  one of them (`2825`) is the only reader of an otherwise-unasserted production byte form,
  which makes it a genuine BLOCKER rather than a redundancy. The recorded version misses
  that this is the file's second systemic assertion defect, not an isolated slip.

- **CONFIRMED** — Finding U3, "Redundant substring assertions layered after an exact
  assertion" — its one in-range site (`line 2408`, redundant `!body.includes("/reload…")`
  at `2440` ahead of the `deepEqual` at `2444`) reads exactly as described, and the
  severity (WARNING) is right.

- **CONFIRMED, with two factual corrections** — Finding U4, "Hand-rolled `ctx`/`pi` doubles
  cast through `as never` at every call site (178 occurrences)". The defect is real and the
  BLOCKER severity holds. Two corrections: (1) the count is **382 occurrences across 187
  lines** (`grep -o " as never" | wc -l`), not 178; (2) the stated *cause* — "no
  lightweight object literal can satisfy them structurally — which is exactly why every
  test call site resorts to `as never`" — is wrong, and the counter-example is in this
  repo. `tests/architecture/notify-producer-wire-coverage.test.ts:53-59` builds
  `mock<ExtensionContext>({ exactParams: true, name: … })` and
  `mock<ExtensionAPI>({ exactParams: true, name: … })` with **zero casts** in the whole
  file. Narrowing the parameters is still worth doing on its own merits, but it is not a
  prerequisite for deleting these casts, and the finding should not be written as though
  it were. See "Meta-findings impact".

- **CONFIRMED, location wrong** — Finding U5, "`const msg: NotificationMessage` vs
  `satisfies` idiom drift". The drift is real but it starts at **`line 5675`**, not
  "roughly line 2585": `grep -n "satisfies NotificationMessage"` returns 5675 as its first
  hit, and the cited `line 2615` test (`D-77-01 / PURL-09`) uses the annotation form at
  `2619`. Every message literal in `2200–4450` uses the annotation form, so slice B is
  internally consistent and the drift is a slice-C boundary.

- Finding U6 (`String.prototype.lastIndexOf` patch at `line 6248`) is outside my range and
  is not graded here.

### `extensions/pi-claude-marketplace/shared/notify.ts`

- **OVERSTATED → WARNING** — Finding P1, "all context parameters typed against the full
  `ExtensionContext`/`ExtensionAPI`" filed as BLOCKER. The narrowing is a real and
  worthwhile design improvement, but it produces no incorrect behavior and — per the U4
  correction above — is not what forces the casts, so it does not meet either skill's
  BLOCKER bar ("the violation can produce incorrect behavior or hide a defect"). The
  test-side cast finding stays BLOCKER; this production-side entry should read WARNING so
  the sequencing in META-FINDINGS is not driven by an inflated severity.
- **CONFIRMED** — Finding P2, `softDepStatus(pi)` as the module's one render-time probe
  (`lines 3822`, `3915`, `3979`). Accurate, correctly scoped as SNM-16-sanctioned, and the
  proposed owner-side fix is the right one. Add: nothing currently asserts the
  once-per-invocation part of that contract (new WARNING above).
- **CONFIRMED** — Finding P3, `computeSeverity`'s `plugin-info` arm inferring severity from
  `message.plugin.status` (`line 2886`, mirrored at `3077`). Verified; the file's own
  Q1-LOCKED comment at `2862-2873` sanctions it and it is a closed two-state lookup.
- **CONFIRMED, strengthened** — Finding P4, the five-concern module split. The seam
  analysis holds. One argument the first pass did not have: the dispatch concern it
  proposes to keep in `notify.ts` has exactly one production caller that reaches the row
  loop, which makes "dispatcher" a thinner and cleaner residual module than the finding
  assumes, and makes the grammar/severity/info layers the ones that actually carry the
  live contracts.

## Still clean after attack

These are mutations I ran against slice B that the cases **do** catch. The fixing pass
should not spend time here.

- `tests/shared/notify.test.ts:2183, 2220, 2259` — the cause-chain / rollback indent
  ladder. Changing the rollback child-row prefix from 4 to 2 spaces, the nested phase-cause
  prefix from 6 to 4, dropping the `(rollback failed)` token, dropping the `->` chain
  separator, or emitting the phase cause before its `[phase]` row all fail on the
  `deepEqual` whole-string literals. `2220` is the only case pinning the 4-vs-6 nesting and
  it does so exactly.
- `tests/shared/notify.test.ts:2581, 2615, 2649, 2684` — the SNM-35 / D-77-01 version
  rendering. Truncating to 6 or 8 hex instead of 7, dropping the `#`, dropping the `v`
  prefix, letting `sha-` fall through unformatted, or rewriting a SemVer all fail.
  `2649` additionally pins the `→` arrow glyph and its surrounding single spaces.
- `tests/shared/notify.test.ts:3429, 3459, 3483, 3527` — `renderMarketplaceInfo` /
  `renderPluginInfo` line order. Reordering `github:`/`last_updated:`/`description:`,
  swapping the `<autoupdate>` and `<no autoupdate>` markers, moving the description below
  the component lines, or changing the 2-space row indent or the 4-space attribute indent
  all fail on `assert.equal(args[0], [...].join("\n"))`.
- `tests/shared/notify.test.ts:3640` — `COMPONENT_KINDS` ordering. Reordering the tuple
  (`agents, commands, hooks, mcp, skills`) fails; this is the only case with four
  non-hooks kinds present simultaneously and it is doing real work.
- `tests/shared/notify.test.ts:3764, 3947` — the `\n\n` inter-block join and the
  caller-supplied (unsorted) block order in both info cascades. Sorting the blocks,
  joining with a single `\n`, or joining with three fail.
- `tests/shared/notify.test.ts:4197, 4221, 4244, 4270` — `renderPendingRow` glyphs and the
  orphan-fold bracket. Swapping `●`/`○`/`◍` between the four pending statuses, emitting a
  version slot on a pending row, or emitting the `[scope]` bracket when plugin and
  marketplace scopes match all fail. `4270` and `4430` are a genuine positive/negative pair
  on `renderScopeBracket`.
- `tests/shared/notify.test.ts:4343, 4375, 4398, 4430` — the D-54-01 `(disabled)` inventory
  row across the four combinations of version-present/absent and bracket-emitted/suppressed.
  This is the best-covered production behavior in the slice.
- `tests/shared/notify.test.ts:3352, 3373` — `renderMarketplaceNotAdded` and the failed
  `plugin-info` summary. Changing the hard-count-1 subject from `marketplace` to `plugin`
  (or the reverse), dropping the `\n\n` between summary and body, or emitting `info`
  instead of `"error"` all fail.
- The whole slice catches severity mutations robustly: `emitWithSummary`'s
  one-arg-at-info / two-args-at-error split is asserted by ~40 cases, so inverting it,
  or passing `"info"` explicitly as a second argument, fails immediately.
- AAA discipline, `test()` (never `it()`), no `only`/`skip`/`todo`, no `describe()`, no
  `before`/`beforeEach`, fresh context per case, no placeholder names (`result`, `sut`,
  `data`), and one `test()` per data-driven row are all clean across the slice. The
  `assert.equal`/`assert.deepEqual` spellings are the strict aliases (the file imports
  `node:assert/strict`), so they are not a correctness finding.

## Not covered

- Ran no commands that mutate or execute the tree — no `node --test`, no
  `npm run test:coverage`, no lint. Every "mutation survives" claim above is derived by
  reading the production branch and grepping the whole `tests/` tree for a case that would
  fail; each is stated with the grep or the file:line that settles it. Direct per-pair
  coverage is still unmeasured, as META-FINDINGS records.
- Slices A (`1–2200`) and C (`4450–6659`) were read only where a sibling case had to be
  checked to settle whether a mutation dies. I did not grade first-pass findings whose only
  sites lie in those slices (the `line 1055` zero-assertion case is graded as a *class*,
  not as a site; the `String.prototype` patch at `6248` is not graded).
- `tests/shared/notify-context.test.ts` and `notify-reasons.test.ts` and their production
  modules remain out of scope, as in the first pass.
- I did not audit `shared/errors.ts`'s `causeChainTrailer` / `manualRecoveryLeaks` or
  `shared/concerns/hooks.ts`'s `appendHooksBlock` themselves — only where slice B's cases
  duplicate or depend on them. `tests/shared/errors.test.ts` and
  `tests/shared/concerns/hooks.test.ts` own those.

## Meta-findings impact

### New cross-cutting evidence

**1. The stated cause of the sweep's #1-ranked item is wrong, and the correct-form
reference implementation already exists.** META-FINDINGS "Ranked by leverage" item 1 says:
"Because no test can construct a full SDK object, every caller fakes one and forces it past
the compiler." `tests/architecture/notify-producer-wire-coverage.test.ts` constructs
`mock<ExtensionContext>({ exactParams: true })` and `mock<ExtensionAPI>({ exactParams: true })`
with `strong-mock` and contains **zero** `as never` / `as unknown as` casts in the whole
file (verified by grep). `strong-mock`'s proxy satisfies an arbitrarily wide third-party
interface without any structural literal. So the cast clusters across the repo are a
*choice of hand-rolled doubles over the sanctioned tool*, not a consequence of the wide
parameter types. Two consequences for planning: (a) the cast removal in `notify.test.ts`,
`if-field`, and the dozen-plus other files does **not** block on the production narrowing,
so items 1 and 7 in the suggested sequencing can run in parallel; (b) every other area that
filed "wide parameter forces a cast" should be re-checked against this file before its
finding is written up as blocked-on-production. **Add
`tests/architecture/notify-producer-wire-coverage.test.ts` to the "Patterns to propagate"
table as the reference for mocking a wide third-party host interface.**

**2. A fifth "gate that does not gate" candidate, of a new shape.** The `SUMMARY_GRAMMAR`
regex in `tests/architecture/notify-grammar-invariant.test.ts:71` is
`/^(A|Some) (plugin |marketplace )?operations? …/`. `notify.ts:3009` contains an `"An"`
branch the gate would reject outright. Either the branch is dead (my analysis says it is —
`subject === null` implies `count >= 2` at both call sites) or the gate is wrong. This is
the inverse of the usual failure mode: not a gate that cannot fire, but a gate that
contradicts a live-looking branch, with neither side noticing. Worth a sweep of the other
architecture gates for regexes that are narrower than the production code they nominally
describe.

**3. "Fragment assertion" needs splitting into two classes with different fixes.** Of the
eight fragment-assertion sites the first pass filed in this slice, six are pinned
byte-for-byte by a sibling with an identical payload and two are not. The fix differs:
the covered ones should be **deleted or folded into the sibling** (they cost maintenance
and buy nothing), the uncovered ones need a new whole-string literal. Applying "replace
every `.includes()` with a full assertion" uniformly across the ~100+ sites in item 3 of
"Ranked by leverage" would roughly double the assertion surface of `list.test.ts` and
`info.test.ts` while adding no protection for the covered majority. **Recommend the fixing
pass check each site for a same-payload sibling first.** That check is cheap and it
changes the size of the largest cluster in the sweep.

**4. Argument-count-only cases are a distinct systemic class the sweep has not named.**
`assert.equal(calls[0].arguments.length, 1|2)` with no read of `arguments[0]` appears nine
times in `notify.test.ts` and is structurally invisible to a grep for `.includes(` /
`.startsWith(`. Areas whose modules emit through `ctx.ui.notify` — `orchestrators/**`,
`edge/handlers/**`, `index.ts` — should be swept for the same shape.

### Corrections to META-FINDINGS.md

- **"Ranked by leverage" item 1, the causal claim** — quoted and refuted above. The
  numbers also need a correction: "178 `as never` casts in `tests/shared/notify.test.ts`
  alone" undercounts by more than half; `grep -o " as never"` gives **382 occurrences on
  187 lines**. The item should stay ranked highly as a design improvement, but its
  justification ("unblocks strict mocking everywhere") is not accurate — strict mocking is
  already possible today.
- **"Ranked by leverage" item 5, exhaustiveness on closed-union switches** — a fifth
  instance exists that the list does not name: `renderPendingRow`
  (`shared/notify.ts:2522-2536`) has no `default` group. It is, however, compile-safe:
  `tsconfig.json` sets `noImplicitReturns: true`, so a new union member makes the function
  fall through and TS7030 fires. Before the four listed modules are treated as one ticket,
  each should be checked for whether its switch is value-returning — the ones that are may
  already be protected, and the severity of item 5 turns on that distinction.
- **"Ranked by leverage" item 3, scale table** — the `shared/notify.test.ts` row reads
  "~19 cases". In slice B alone there are 8 fragment sites plus 9 argument-count-only
  sites plus 2 regex/negative-only sites (the AS-7 pair, new BLOCKER 3), so the file-wide
  figure is materially higher than 19 once the two adjacent classes are folded in.

### Confirmations

- **"Clean verdicts are not reliable" (Provenance)** — confirmed from a different angle
  than intended. This area's `### Clean files` list was *empty*, and the file was still
  hiding four BLOCKER-class defects (an unasserted production byte form, an untested
  contract guard, two regex-only assertions, and a production-computed expected value). An
  empty clean list is no safer than a populated one; the unfalsified negative is the
  reviewer's *attention*, not the list.
- **"The dominant shape: sibling drift"** — confirmed twice inside a single file.
  `truncateDescription`'s boundary is pinned on both sides (`1522`/`1548`) while its
  sibling `wrapDescription`'s is pinned on one (`3337` only). And `notify.test.ts:3560`,
  `3682` duplicate `tests/shared/concerns/hooks.test.ts:75-131` byte-for-byte. Drift shows
  up *within* files, not only between them, which a per-file partition can miss.
- **"Doc comments cut both ways… neither can be trusted as evidence without checking the
  call graph"** — confirmed with three fresh instances in `notify.ts`: a citation to a
  test file that no longer exists (`:374`), a line-number citation into a doc that has
  since moved (`:2135` → the contract is at `messaging-style-guide.md:81`), and a
  reachability claim contradicted by a live call site (`:2013-2022` vs
  `edge/handlers/plugin/enable-disable.ts:68`). Recommend a repo-wide grep for
  `tests/.*\.test\.ts` and `docs/.*\.md:[0-9]+` citations inside `extensions/` — both
  forms rot silently and both were wrong here.
- **"Patterns to propagate: proving a module does not touch a port"** — the same technique
  is what this area needs for SNM-16's once-per-invocation probe promise, and
  `notify-producer-wire-coverage.test.ts:57-59`'s `.thenReturn([]).twice()` is the exact
  in-repo form.
