# Shared — notify (slice A: `tests/shared/notify.test.ts` 1–2200) — adversarial re-review

**Scope:** `tests/shared/notify.test.ts` lines 1–2200 (67 `test()` cases, lines 106–2183) and
the slice of `extensions/pi-claude-marketplace/shared/notify.ts` those cases reach:
`notify()` → `dispatchInfoMessage` bypass → `composeMarketplaceBlock` → `renderMpHeader`,
`composePluginLines`/`composePluginLinesWith` → `renderPluginRow` and every row helper
(`pluginRow`, `partiallyInstalledRow`, `installedLikeRow`, `render*Row`, `renderPendingRow`,
`joinTokens`, `renderVersion`, `renderScopeBracket`, `composeVersionArrow`, `composeReasons`),
plus `truncateDescription`, `isDescriptionBearingRow`, `partialHintTrailerFor`,
`composeRollbackPartialLines`, `renderIndentedCauseChain`, `cascadeSeverity`, `computeSeverity`,
`countRowsBySeverity`, `summaryPhrase`, `buildSummaryLine`, `shouldEmitReloadHint`,
`foldTallyAndHint`, `emitWithSummary`.
**First-pass file:** `unit-test-findings/shared-notify.md`
**Clean files attacked:** 0 listed — see below
**Existing findings graded:** 9 of 10 (one is outside this slice)

> **The first pass published no clean list for this area.** Its `### Clean files` sections say
> "No other test files were in scope" and "None to list separately". So the unfalsified negative
> here is not a *file* but the 46 of 67 cases in lines 1–2200 that its findings never name. Those
> 46 cases, and the production branches they are the only witnesses for, are what I attacked.
>
> **One cross-check reframes this whole area and is not in the first-pass file:**
> `tests/architecture/catalog-uat.test.ts` (in the `npm test` glob) drives `notify()` directly
> for ~180 catalog states and compares the full emitted string byte-for-byte against
> `docs/output-catalog.md`, asserting `ctx.ui.notify.mock.calls.length === 1` each time
> (`catalog-uat.test.ts:5174-5181`). Most of the weak assertions the first pass logged here are
> byte-backstopped by that gate. They are still ownership defects (the pair must own its module,
> run alone), but the *escape risk* is far lower than the recorded severities imply — except for
> the specific shapes the catalog does not carry, which I name individually below.

## Verdict summary

| Metric | Count |
| --- | --- |
| New BLOCKER (missed by first pass) | 2 |
| New WARNING (missed by first pass) | 9 |
| Existing CONFIRMED | 7 |
| Existing UNDERSTATED | 1 |
| Existing OVERSTATED | 1 |
| Existing REFUTED | 0 |
| Existing DUPLICATE-OF | 0 |

## New findings — from the unlisted (implicitly clean) cases

### `tests/shared/notify.test.ts`

- **[BLOCKER] The `ctx`/`pi` doubles are hand-rolled where the sibling module's test uses
  `strong-mock` — forfeiting the two interaction proofs `notify()` actually promises** —
  `lines 50-89` (`createContext`, `piWithBothLoaded`/`piWithSubagentsLoaded`/`piWithMcpLoaded`/
  `piWithNothingLoaded`), consumed at every call site (e.g. `line 131`).
  `tests/shared/notify-context.test.ts:110-129` — the test of the module that wraps this exact
  output surface — builds the same two third-party interfaces as
  `mock<ExtensionContext>({ exactParams: true, name: "extension context" })`,
  `mock<ExtensionAPI>({ exactParams: true, name: "extension API" })`,
  `mock<ExtensionContext["ui"]>(…)`, states `when(() => pi.getAllTools()).thenReturn([]).twice()`,
  and `verify()`s all three at the end of every case — **with zero casts**.
  Two mutations survive every case in lines 1–2200 because this file cannot express either
  expectation: (a) moving `softDepStatus(pi)` out of `notify()` (`notify.ts:3822`) and re-probing
  per row — the documented SNM-16 "single probe per invocation, no per-row re-probing" discipline
  (`notify.ts:2737-2739`) is unobservable against a plain `getAllTools: () => [...]` arrow;
  (b) emitting the body twice for the 12 cases listed in the next finding.
  Fix: replace `createContext` + the four `piWith*` factories with a `createHarness(...)` modelled
  on `notify-context.test.ts:110-129`, one per case, keeping the probe expectation
  `.twice()` (`softDepStatus` calls `getAllTools()` once for each companion — `pi-api.ts:158-163`)
  and `verify(ctx)`, `verify(pi)`, `verify(ui)` after the result assertions. This also deletes the
  casts (see the grading of the first pass's `as never` finding).

- **[BLOCKER] The PL-4 description line has no case for `partially-installed` or
  `partially-upgradable` anywhere in the repo** — the PL-4 block is `lines 1302-1594`; it covers
  6 of the 9 description-bearing statuses (`installed` 1302, `upgradable` 1337, `available` 1370,
  `unavailable` 1402, `partially-available` 1434, `disabled` 1466).
  Mutating `DESCRIPTION_BEARING_STATUS["partially-installed"]` or `["partially-upgradable"]`
  (`notify.ts:4036-4037`) from `true` to `false` silently deletes the description line for those
  rows and the whole suite stays green: `catalog-uat.test.ts` backstops only the other two
  uncovered statuses (states `remote-inventory-with-description`,
  `disabled-inventory-with-description`), and no catalog state carries a degraded-inventory row
  with a description. The rows are reachable — `orchestrators/plugin/list.ts:559` and `:574`
  spread `descriptionField` into both — and `docs/output-catalog.md:342` names all nine variants
  as the binding contract. Fix: add two cases beside `line 1466`, copied from the
  `PL-4: disabled inventory row with description` case, with
  `status: "partially-installed", reasons: ["lsp"]` and
  `status: "partially-upgradable", reasons: ["lsp"]`, each asserting the whole body with
  `assert.equal(body, "● official [user]\n  ◉ alpha v1.0.0 (partially-installed) {lsp}\n    <desc>")`
  (and `●` for the partially-upgradable glyph).

- **[WARNING] 12 cases assert neither the notify call count nor the severity argument** —
  `lines 644, 734, 1302, 1337, 1370, 1402, 1434, 1466, 1500, 1522, 1548, 1574`. Each reads
  `ctx.ui.notify.mock.calls[0]!.arguments[0]` directly, so a second `ctx.ui.notify` call (IL-2
  violation) and a spurious `"warning"` second argument both survive. 54 of the other 55 cases in
  range do assert `calls.length`. Fix: the strong-mock harness above makes both structural (an
  unexpected second call fails `verify(ui)`, and the expectation states the exact argument list);
  until then add `assert.equal(ctx.ui.notify.mock.calls.length, 1)` and use
  `assert.deepStrictEqual(ctx.ui.notify.mock.calls[0]!.arguments, [body])`.

- **[WARNING] Duplicate cases, and titles that claim distinctions the arranged payload cannot
  express** — three groups, one rule:
  - `line 826` and `line 1212` arrange the byte-identical payload
    (`{ name: "demo", scope: "user", status: "added", plugins: [] }`) and assert the identical
    string; `line 1596` arranges it a third time to assert only that the trailer is absent — which
    the exact string at 826 already proves. Delete 1212, fold 1596 into 826.
  - `lines 902, 933, 964` ("D-48-A") differ only in `name`/`scope` and all three exercise the same
    `reasonsBrace === ""` branch of `renderMpHeader` (`notify.ts:1927`), while their titles claim
    three distinct failure forms (`failure-unreachable`, `mp-failure-network`, "the third bare
    form") that the payloads do not carry. Collapse into one `for` loop over
    `[{ name, scope }]` rows, and add the missing sibling for the *other* branch —
    `(failed) {…}` with `reasons` present — which no case in lines 1–2200 covers.
  - `line 1081` and `line 1114` differ only in the marketplace name; the second's title claims the
    autoupdate-ON payload "renders byte-identically to the OFF no-op", but `MpSkipped`
    (`notify.ts:1298-1301`) carries no autoupdate field, so the two payloads are the same shape and
    nothing is compared between them. Keep one.

- **[WARNING] Repeated-character description fixtures cannot localize a slice mutation** —
  `line 1526` (`"A".repeat(66)`) and `line 1552` (`"B".repeat(67)`). Because every character is
  identical, `truncateDescription`'s window can shift without any observable difference:
  `notify.ts:1798` `s.slice(0, DESCRIPTION_MAX_COLS - 3)` → `s.slice(1, DESCRIPTION_MAX_COLS - 2)`
  passes both cases. (The *boundary* — 66 verbatim vs 67 truncated — is genuinely pinned by the
  pair, and is pinned nowhere else in the repo, so these two cases matter; only the fixture is
  wrong.) Fix: use `"0123456789".repeat(6) + "123456"` (66) and `… + "1234567"` (67) so the kept
  window is identifiable, and assert the whole body. The same repeated-character style recurs at
  `lines 3283, 3294-3295, 3339-3340` (slice B's `wrapDescription` cases) — same rule applies there.

- **[WARNING] Three assertion idioms for the same job inside one file** — `assert.deepEqual`
  (34 sites before line 2200, e.g. `135, 169, 204`), `assert.deepStrictEqual` (39 sites, all after
  line ~2400), and `assert.equal` on the extracted body. Under `node:assert/strict` `deepEqual`
  *is* `deepStrictEqual`, so nothing is loose today, but a reader cannot tell that from the call.
  Standardize on `assert.deepStrictEqual` for whole-argument-list comparisons. Same era-drift root
  as the first pass's `satisfies` finding — fix both in one sweep.

- **[WARNING] `messageWithKindSequence` is undocumented and defeats the discriminant it tests** —
  `lines 91-104`. It installs a stateful `kind` getter via `Object.defineProperty` so a message
  reports a different `kind` on each read, purely to reach the `assertNever` arms in `notify()`,
  `computeSeverity`, `buildSummaryLine`, and `shouldEmitReloadHint`. Its cases live at
  `lines 6154-6240` (slice C), but the helper is declared here with no comment saying what it
  proves. The branches it reaches are **compiler-forced** (D-116-01a): no typed message can produce
  them. Fix: add a comment naming the class of branch it reaches and cite D-116-01a; do not
  propagate the technique. This belongs with META-FINDINGS' "unreachable branches" operator
  decision, not with the ordinary coverage work.

### `extensions/pi-claude-marketplace/shared/notify.ts`

- **[WARNING] `PluginUnavailableMessage.partialHint` and the `unavailable` disjunct that reads it
  are dead** — field at `line 923`, read at `line 4083`
  (`if (p.status === "unavailable" || p.status === "partially-available")`). All three producers
  that stamp `partialHint` stamp it on another status:
  `orchestrators/plugin/install.messaging.ts:175` (`partially-available`; its sibling `return` at
  `:180-186` deliberately omits it on the `unavailable` arm), `update.ts:2533`
  (`partially-upgradable`), `enable-disable.ts:1242` (`failed`). The field's own doc comment
  (`notify.ts:919-922`) states the same. Classification: unreachable by real input, not a test gap.
  Fix: delete the field and the `p.status === "unavailable" ||` disjunct, or name the producer that
  is supposed to set it.

- **[WARNING] `renderPendingRow` is the one switch in this file with no `default` arm** —
  `lines 2522-2536`. Its five siblings all carry `default: { assertNever(…); return ""; }`
  (`renderMpHeader` 1994, `renderPluginRow` 2689, `computeSeverity` 2895, `buildSummaryLine` 3090,
  `shouldEmitReloadHint` 3264). TS7030 does catch a new union member here (the function returns
  `string`), so this is consistency and defense-in-depth rather than a live defect — but it is a
  fifth instance for META-FINDINGS item 5, in a file that item does not list. Fix: add the
  `default: { assertNever(p); return ""; }` arm.

- **[WARNING] The comment above `renderPluginRow` states something false about production** —
  `lines 2013-2022` claim the central switch "survives only as a STATICALLY-REFERENCED seam", with
  "the legacy `notify(ctx, pi, message)` cascade arm (reached today only by the
  `{ marketplaces: [] }` empty sentinel, which short-circuits to `(no marketplaces)` before the
  plugin loop runs)". `edge/handlers/plugin/enable-disable.ts:68-82` calls
  `notify(ctx, pi, { marketplaces: [{ …, plugins: [{ status: "failed", … }] }] })` on its C1
  defense-in-depth path, which renders through this switch's `failed` arm. A maintainer trusting
  the comment could delete arms that a live error path renders. Fix: restate the comment as what is
  true — the switch is the legacy envelope's row renderer and is still reached by the
  edge-handler catch paths (`bootstrap.ts:75`, `enable-disable.ts:68`) as well as by
  `composeReconcileAppliedBody`.

- **[WARNING] The bare `● <name> [<scope>] (skipped)` marketplace-header form is unreachable** —
  `notify.ts:1967-1969`, the `reasonsBrace === ""` true branch. Every mp-level `skipped` producer
  stamps `reasons` (`marketplace/autoupdate.ts:568-569`, `marketplace/update.ts:773` and `:809`),
  and no test or catalog state pins the bare form — the only case that arranges it
  (`tests/shared/notify.test.ts:2825`, slice B) asserts `args.length` and `args[1]` and never reads
  the body. Classification: unreachable by real input. Fix: make `MpSkipped.reasons` required
  (`notify.ts:1300`), which deletes the branch and the "missing reason set routes to the warning
  safe default" language at `lines 1294-1296`; if the safe default must stay, slice B's case at
  2825 owes the byte assertion.

## Export ownership census

`notify.ts` has 37 runtime exports; `notify.test.ts` imports all 37 (`lines 5-48`) — no export is
unimported. Slice A owns exactly one of them directly (`notify`); the 20 grammar/row exports are
exercised transitively here and owned by direct-call cases in slice C (`lines 5011-5460`), so I do
not re-census them. What follows is the census that matters for this slice: the production units
`notify()` reaches, and the case that owns each.

| Unit (`notify.ts`) | Owning case in 1–2200 | Status |
| --- | --- | --- |
| `notify` cascade arm | `106` and 66 others | owned |
| `renderMpHeader` `"added"` | `826` (+ duplicates `1212`, `1596`) | owned (over-covered) |
| `renderMpHeader` `"removed"` | `842` | owned |
| `renderMpHeader` `"updated"` | `858` | owned |
| `renderMpHeader` `"failed"` (no brace) | `874`, `902`, `933`, `964` | owned (4 cases, 1 branch) |
| `renderMpHeader` `"failed"` (+ brace) | — | outside slice (`4793`, `5953`) |
| `renderMpHeader` `"autoupdate enabled"` | `995` | owned |
| `renderMpHeader` `"autoupdate disabled"` | `1011` | owned |
| `renderMpHeader` skipped → `<autoupdate>` | `1027` | owned |
| `renderMpHeader` skipped → `<no autoupdate>` | `1055` | **arranged, never asserted** |
| `renderMpHeader` skipped → `(skipped) {…}` | `1081`, `1114` | owned (duplicate pair) |
| `renderMpHeader` skipped → bare `(skipped)` | — | **NO CASE** (unreachable; see finding) |
| `renderMpHeader` `undefined` SUB-BRANCH A | `1749` | owned |
| `renderMpHeader` `undefined` SUB-BRANCH B (`autoupdate: true`) | `1189` | owned |
| `renderMpHeader` SUB-BRANCH B (`autoupdate: false`) | — | outside slice (`6269`) |
| `renderPluginRow` `installed` | `106`, `140` | owned |
| `renderPluginRow` `updated` | `174` | owned |
| `renderPluginRow` `reinstalled` | `209` | owned |
| `renderPluginRow` `uninstalled` | `243` | owned |
| `renderPluginRow` `available` | `276` | owned |
| `renderPluginRow` `unavailable` | `306` | owned |
| `renderPluginRow` `partially-available` | `336`, `368` | owned |
| `renderPluginRow` `upgradable` | `541` | owned |
| `renderPluginRow` `partially-installed` | `572`, `608`, `644` | owned |
| `renderPluginRow` `partially-upgradable` | `470`, `506`, `676` | owned |
| `renderPluginRow` `skipped` | `756` | owned |
| `renderPluginRow` `failed` | `790` | owned |
| `renderPluginRow` `disabled` | `1466` | owned |
| `renderPluginRow` `remote` / `manual recovery` / 3 pending arms | — | outside slice (`2469`, `4230`, `4254`, `5271`) |
| `renderPendingRow` `will install` (± `partial`) | `710`, `734` | owned |
| `truncateDescription` (≤66 / >66) | `1522`, `1548` | owned, weak fixture |
| `isDescriptionBearingRow` — 6 of 9 `true` arms | `1302`–`1498` | owned |
| `isDescriptionBearingRow` — `partially-installed`, `partially-upgradable` | — | **NO CASE** |
| `isDescriptionBearingRow` — `remote` | — | outside (catalog-uat only) |
| `partialHintTrailerFor` install wording | `399` / `435` | owned (both polarities) |
| `partialHintTrailerFor` update wording | `470` / `506` | owned (both polarities) |
| `partialHintTrailerFor` stale-gate wording | — | outside slice (`6487`) |
| `partialHintTrailerFor` `unavailable` disjunct | — | unreachable (see finding) |
| `composeRollbackPartialLines` (no phase cause) | `2183` | owned |
| `cascadeSeverity` mp-row contribution | `874` | owned |
| `cascadeSeverity` plugin-row contribution + rank→arg map | `790`, `470` | owned |
| `buildSummaryLine` marketplace-only / mixed / plugin-only | `874`, `790`, `2136` | owned |
| `shouldEmitReloadHint` plugin OR-reduce (both polarities) | `1228`, `1267` | owned (fragment asserts) |
| `shouldEmitReloadHint` marketplace-level stamp | — | outside slice (`5753`, exact) |
| `emitWithSummary` info arm / error+warning arm | `106` / `790`, `470` | owned |
| `foldTallyAndHint` (body + hint, no tally) | `106` | owned |
| `redactAbsolutePaths`, `compareByNameThenScope`, `makeRawNotifyFn`, `notifyUsageError`, `notifyDiagnostic`, `notifyAsyncRewakeSummary`, `notifyStopHookOverrideCap`, `emit*Cascade`, `isScopeBearingListRow`, the 4 closed-set tuples, 7 icons | — | outside slice (B/C) |

## Branch census

Reachable and untested (findings above):

- `DESCRIPTION_BEARING_STATUS["partially-installed"]` / `["partially-upgradable"]`
  (`notify.ts:4036-4037`) — produced by `list.ts:559,574`; no case anywhere.
- `renderMpHeader`'s `already no autoupdate` arm (`notify.ts:1963-1965`) — arranged only at
  `notify.test.ts:1055`, which asserts no content. **Not an escape**: the byte form is pinned by
  `tests/architecture/catalog-uat.test.ts` (state `disable-idempotent`) and by
  `tests/orchestrators/marketplace/autoupdate.test.ts:317`. Ownership defect, not a shipping risk.
- The plugin loop in `composeMarketplaceBlock` under a *skipped* marketplace header
  (`notify.ts:3699-3701`) — the only case pairing an mp-level `skipped` header with a plugin child
  row is `notify.test.ts:1147`, which `.includes()`-checks the header and never asserts the row. No
  catalog state has this shape (`enable-idempotent`, `disable-idempotent`,
  `update-autoupdate-noop-skipped` all carry `plugins: []`). **This is the one genuinely unguarded
  fragment assertion in the slice.**

Unreachable by real input (production dead code, not test gaps):

- `partialHintTrailerFor`'s `p.status === "unavailable"` disjunct (`notify.ts:4083`) and
  `PluginUnavailableMessage.partialHint` (`:923`) — no producer stamps it.
- `renderMpHeader`'s bare `(skipped)` branch (`notify.ts:1968`) — every producer stamps `reasons`.
- A row carrying both a `description` and a `partialHint` (ordering of the two pushes at
  `notify.ts:4116` and `:4121`) — `composeNotInstallableMessage`
  (`install.messaging.ts:163-186`) sets no `description`, so the order is unobservable today.

Compiler-forced, not removable (D-116-01a):

- The `assertNever` `default` arms in `notify()` (`3851`), `computeSeverity` (`2895`),
  `buildSummaryLine` (`3090`), `shouldEmitReloadHint` (`3264`), `renderMpHeader` (`1994`),
  `renderPluginRow` (`2689`). Slice C reaches four of them only via the mutating-getter helper at
  `notify.test.ts:91-104`.
- `DESCRIPTION_BEARING_STATUS`'s nine `false` entries (`notify.ts:4038-4047`): flipping one to
  `true` is unobservable because the corresponding message interfaces declare no `description`, so
  no type-checked test input can carry one. Correct as compile-time-total map entries; not a gap.

## Grading of first-pass findings

### `tests/shared/notify.test.ts`

- **CONFIRMED** — *Substring/prefix/suffix assertion as the sole content check (~19 cases)* — real
  for all 10 entries that fall in my range, but the severity needs per-entry calibration the
  recorded version does not give. Only `line 1147` has a mutation that escapes the repo (drop the
  plugin rows under a skipped marketplace header — no other case and no catalog state has that
  shape). `1228`, `1267`, `1596`, `1616`, `1636`, `1671`, `1698`, `1522`, `1548` are byte-backstopped
  by `catalog-uat.test.ts` states (`single-mp-mixed`, `fresh`, `clean`, `update-no-op-skipped`,
  `description-lines`), so they are ownership defects. **Fix all of them; do 1147 first.**
- **CONFIRMED** — *Zero content assertion at `line 1055`* — the case asserts only
  `calls.length === 1` and `arguments.length === 1` (`1077-1078`); any string passes. Note for the
  fixer: the expected literal is `"● foo [user] <no autoupdate> {already no autoupdate}"`, and it
  already exists as prior art at `tests/orchestrators/marketplace/autoupdate.test.ts:317`.
- **CONFIRMED (WARNING)** — *Redundant substring assertions after an exact whole-value assertion* —
  correct at `336/364-365`, `399/467`, `470/538`, `572/604-605`. One qualifier: the negative
  `.includes()` calls at `1939`, `1989`, `2039`, `2085`, `2136` encode the BLOCKER-1 / D-17.2-07
  intent in their failure messages; delete the assertion but keep the intent as a comment on the
  exact-match line.
- **UNDERSTATED** — *Hand-rolled `ctx`/`pi` doubles cast through `as never` (recorded: 178
  occurrences)* — the file contains **382** `as never` tokens; 178 is the count of *lines* carrying
  both casts (132 tokens are in lines 1–2200 alone). Worse, the finding's stated cause — "no
  lightweight object literal can satisfy them structurally, which is exactly why every test call
  site resorts to `as never`" — is wrong: `tests/shared/notify-context.test.ts:111-113` constructs
  both `ExtensionContext` and `ExtensionAPI` with `mock<T>({ exactParams: true })` and no cast at
  all, against the same third-party types. The casts are a doubles-choice defect, not a
  production-signature defect, and the fix is the sibling's harness (see my first new BLOCKER),
  which additionally buys the exactly-once probe and exactly-once notify proofs this file cannot
  currently make.
- **CONFIRMED (WARNING)** — *`const msg: NotificationMessage` vs `satisfies` drift* — real and
  cosmetic; extend the same sweep to the `deepEqual`/`deepStrictEqual` split (my WARNING above),
  which has the identical era-drift signature.
- *Not graded* — *`String.prototype.lastIndexOf` patch at `line 6248`* — outside this slice; slice C
  owns it.

### `extensions/pi-claude-marketplace/shared/notify.ts`

- **OVERSTATED (BLOCKER → WARNING)** — *All entry points type `ctx`/`pi` against the full
  `ExtensionContext`/`ExtensionAPI`* — narrowing to consumer-declared ports is a legitimate style
  improvement, but the finding's justification (that the wide types force the test casts) is
  disproved by `tests/shared/notify-context.test.ts:111-113`, and nothing incorrect can result from
  the wide type: a real host object satisfies it, and every read is `ctx.ui.notify` /
  `softDepStatus(pi)`. Severity should be WARNING, and this should **not** be sequenced as the
  sweep's highest-leverage item (see Meta-findings impact).
- **CONFIRMED (WARNING)** — *`softDepStatus(pi)` is a render-time probe* — accurate, no behavior
  defect, and the SNM-16 rationale in the file header holds. Add: the probe's *cardinality* is the
  part that is untested here and proven next door (`notify-context.test.ts:115-117` `.twice()` +
  `verify(pi)`).
- **CONFIRMED (WARNING)** — *`computeSeverity`'s `plugin-info` arm derives from `status`* —
  accurate as a description of `notify.ts:2886`; it is a closed two-state kind lookup, not reason
  inference, and the arm's own comment (`2862-2873`) locks it. No change needed.
- **CONFIRMED (WARNING)** — *The module mixes five concerns and is the largest file in the
  extension* — with one correction: it is **4,217** lines, not 4,039 (META-FINDINGS uses the older
  number when sequencing the module split). My slice adds two pieces of evidence that the size is
  already costing accuracy: the false claim about the central switch's reachability
  (`2013-2022`) and the one switch that drifted off the file's own `assertNever` idiom (`2522`).

## Still clean after attack

These mutations were tried against lines 1–2200 and **are caught**:

- **Glyph substitution on any of the 13 statuses covered here** — swapping `●`/`○`/`⊘`/`⊖`/`◉`/`◍`
  fails the exact-body assertions at `106`, `243`, `276`, `306`, `336`, `572`, `676`, `1466`.
- **Grammar reordering** — moving the `[scope]` bracket after the version, or the version after the
  `(status)` token, fails `1904`, `2039` and `174` (`v1.0.0 → v1.1.0` arrow position).
- **`joinTokens` empty-slot filtering** — removing `.filter((p) => p !== "")` (`notify.ts:2044`)
  produces a double space on every row with an absent bracket or version and fails `306`, `731`.
- **Soft-dep marker polarity, placement and brace-sharing** — inverting the `!probe.*Loaded` gate,
  or appending markers *before* the caller's reasons, fails `140`, `174`, `209`, `608`
  (`{lsp, requires pi-subagents}` proves the order), `644`.
- **Caller order and block separation** — sorting the plugin rows fails `1805`; joining marketplace
  blocks with one `\n` instead of `\n\n` fails `1855`.
- **Severity reduce** — dropping the marketplace row from the `Math.max` fails `874`; mapping rank
  1 to `"error"` fails `470`; defaulting an absent `severity` to anything but `info` fails `1147`
  (`arguments.length === 1`) and `276`.
- **Summary-line subject selection and plurality** — dropping the mixed-subject sum fails `790`
  ("Some operations have failed." with one mp + one plugin row); using the plugin noun for a
  marketplace-only cascade fails `874`.
- **Summary placement** — appending the summary after the body, or joining it with one `\n`, fails
  `790`, `874`, `399`, `2136`.
- **Orphan-fold bracket** — inverting `pluginScope !== mpScope`, or emitting the marketplace scope
  instead of the plugin scope, fails `1904`, `1989`, `2039`, `2085`, `2136`.
- **Description emission guards** — dropping `p.description.length > 0` emits a bare 4-space line
  and fails `1574`; changing the 4-space indent fails `1302`; the 66/67 truncation boundary itself
  fails `1522`/`1548` (only the *window* inside the truncation is unpinned — see my WARNING).
- **`(will partially install)` vs `(will install)`** — inverting `p.partial === true`
  (`notify.ts:2528`) fails `710`/`734`.
- **`--partial` hint trailers** — swapping the install and update wordings, or emitting a trailer
  without `partialHint`, fails `399`/`435`/`470`/`506`.
- **Rollback child rows** — changing the 4-space prefix or the `[<phase>] (rollback failed)` form
  fails `2183`.
- **Test-double fidelity** — the `piWith*Loaded` factories match the production predicates exactly
  (`pi-api.ts:131` `tool.name === "subagent"`, `:146` `candidate.name === "mcp"`); no drift.
- **Hermeticity and structure** — no `describe`, no `only`/`skip`/`todo`, no `before`/`beforeEach`,
  no module-scope mutable state, no filesystem or network, fresh `createContext(t)` per case, and
  `// arrange` / `// act` / `// assert` present and ordered on all 67 cases in range.

## Not covered

- I did not run any test, coverage, lint, or typecheck command (diagnostic pass; concurrent
  agents). Every coverage and mutation claim above is from reading `notify.ts`, the test file,
  `catalog-uat.test.ts`'s driver and fixtures, and `docs/output-catalog.md`.
- Lines 2200–6659 of `notify.test.ts` are slices B and C. I read outside my range only to settle
  whether a sibling kills a mutation, and I have cited every such sibling by line.
- I did not audit `catalog-uat.test.ts` itself (5,442 lines). I verified its driver
  (`5160-5200`) and the specific fixtures/states I relied on; I did not verify that every
  `<!-- catalog-state: … -->` block in the docs has a matching fixture, though the driver's
  `missing-fixture` failure path suggests it is gated.
- Two first-pass items touching lines outside my range (the `String.prototype` patch at 6248; the
  `plugin-info` severity cases at 3900+) are graded on code reading only or left to their slice.

## Meta-findings impact

### New cross-cutting evidence

1. **`strong-mock` can and does mock the full third-party SDK interfaces — the premise of
   META-FINDINGS' number 1 item is false.** `tests/shared/notify-context.test.ts:111-113` builds
   `mock<ExtensionContext>({ exactParams: true })` and `mock<ExtensionAPI>({ exactParams: true })`
   with no cast, in the same directory, against the same two types the "over-wide context
   parameter" cluster is built on. Wherever another area recorded "no test can construct a full SDK
   object, so every caller fakes one and forces it past the compiler", that reasoning needs
   re-checking: the casts are a doubles-choice defect first, and a production-signature question
   second. **Check every file in audit rows 2 and 2b for the same misattribution**, especially the
   `bridges/hooks/if-field` `Pick<ExtensionContext, "cwd">` case, which may still be a genuine
   narrowing win but should not be justified by "unmockable".
2. **A second, independent byte-level gate over `notify()` output exists and no area file accounts
   for it.** `tests/architecture/catalog-uat.test.ts` drives `notify()` for ~180 states, compares
   the full string against `docs/output-catalog.md`, and asserts exactly one `ctx.ui.notify` call
   per state (`5174-5181`). Any "fragment assertion lets a garbled message ship" claim about a
   *rendering* test in this repo must be checked against the catalog state list before it is rated
   BLOCKER. This cuts both ways: it lowers escape risk broadly, and it means several rendering
   pairs are having their coverage duty discharged by an architecture test — which the guidelines
   forbid ("no source module tested from another module's test"; pairs must reach coverage run
   alone). **Areas to re-check: `orchestrators/plugin/list.test.ts` (~130 fragment sites),
   `info.test.ts`, `marketplace/update.test.ts`** — the ones META ranks third by leverage.
3. **The "interaction proof by expectation cardinality" technique deserves the propagation list.**
   `when(() => pi.getAllTools()).thenReturn([]).twice()` + `verify(pi)`
   (`notify-context.test.ts:115-117`) is what proves the SNM-16 "one probe per invocation"
   discipline. Any module documenting a call-cardinality discipline (single probe, single notify,
   single lock acquisition) can be proven the same way, and today most such disciplines in this
   repo are documented in comments and asserted nowhere.
4. **A fifth `switch`-without-`default` instance for META item 5:** `notify.ts:2522`
   (`renderPendingRow`), in a file item 5 does not list, and drifting from five `assertNever`
   siblings in the same file.
5. **Repeated-character fixtures are a distinct weak-assertion class** (`"A".repeat(66)`), separate
   from fragment assertions: the assertion can be an exact whole-value compare and still fail to
   localize an off-by-one, because every position of the fixture is interchangeable. Seen at
   `notify.test.ts:1526, 1552, 3283, 3294-3295, 3339-3340`. Worth grepping `\.repeat\(` across the
   suite.

### Corrections to META-FINDINGS.md

- **"178 `as never` casts in `tests/shared/notify.test.ts` alone"** — the file contains **382**
  `as never` tokens; 178 is the number of *lines* carrying both a `ctx` and a `pi` cast. If the
  operator sizes the ticket by cast count, the number is 382.
- **"Because no test can construct a full SDK object, every caller fakes one and forces it past the
  compiler"** and the conclusion that **"One production change per function dissolves the whole
  cluster… the single highest-value item in the sweep"** — falsified for this area by
  `tests/shared/notify-context.test.ts:111-113`. Narrowing the parameters remains a reasonable
  style change, but it is not what unblocks the casts, and it does not unblock strict mocking
  (already possible today). **This item should drop below "add the handler injection seams" in the
  sequencing**, and its severity in `shared-notify.md` should fall from BLOCKER to WARNING.
- **"`shared/notify.ts` (4,039 lines)"** in the module-split decision item — the file is
  **4,217** lines (`wc -l`).
- **Item 3's `shared/notify.test.ts | ~19 cases` row** — accurate as a count, but the risk is
  overstated: 9 of the 10 entries in lines 1–2200 are byte-backstopped by `catalog-uat`. The row
  should be re-labelled as an ownership defect, with `line 1147` broken out as the one genuine
  escape.

### Confirmations

- **"Clean verdicts are not reliable"** — confirmed from the other direction here: this area
  published *no* clean list, and attacking its unlisted cases still produced 2 BLOCKERs and 9
  WARNINGs, including a production behavior (`PL-4` description on the two degraded-inventory
  variants) with no test anywhere in the repo.
- **"Sibling drift is the dominant shape"** — confirmed twice, both times with the correct form
  sitting in the same directory or the same file: `notify.test.ts` vs `notify-context.test.ts` for
  the doubles, and `renderPendingRow` vs five `assertNever` siblings inside `notify.ts`.
- **"Doc comments cut both ways and cannot be trusted without checking the call graph"** —
  confirmed with a new instance: `notify.ts:2013-2022` claims the central `renderPluginRow` switch
  is reached only by an empty-marketplaces sentinel, while `edge/handlers/plugin/enable-disable.ts:68`
  renders a real `failed` row through it.
- **The `notify()` dumb-renderer contract holds** (`notify-is-a-dumb-renderer` in the operator's
  notes): `computeSeverity`, `countRowsBySeverity`, and `shouldEmitReloadHint` reduce only stamped
  fields; the single `softDepStatus(pi)` probe is the sole live-state read, and it can only append
  a marker into an already-caller-supplied brace.
