# Architecture — catalog UAT gate (parser + driver half) — adversarial re-review

**Scope:** `tests/architecture/catalog-uat.test.ts` lines 1–313 (catalog parser,
RECON-04 command-less section handling, `FIXTURES` table plumbing) and lines
5103–5442 (driver, four behavioural cases), plus the catalog and production
sources the parser and driver read: `docs/output-catalog.md`,
`extensions/pi-claude-marketplace/shared/notify.ts`,
`shared/notify-context.ts`, `shared/probe-classifiers.ts`,
`orchestrators/plugin/list.messaging.ts`,
`orchestrators/plugin/update.messaging.ts`.
Sub-agent B owns the fixture corpus (313–5103); I read into it only to settle
parser/driver questions and I attribute those lines to B where relevant.
**First-pass file:** `unit-test-findings/architecture-catalog-uat.md`
**Clean files attacked:** 4 (`probe-classifiers.ts`, `list.messaging.ts`,
`update.messaging.ts`, plus the test file's own "no findings beyond the above"
clean paragraph); `docs/output-catalog.md` was attacked as the gate's expected-value
source even though the first pass never listed it.
**Existing findings graded:** 9

## Verdict summary

| Metric | Count |
| --- | --- |
| New BLOCKER (missed by first pass) | 2 |
| New WARNING (missed by first pass) | 10 |
| Existing CONFIRMED | 7 |
| Existing UNDERSTATED | 1 |
| Existing OVERSTATED | 1 |
| Existing REFUTED | 0 |
| Existing DUPLICATE-OF | 0 |

Method note: I reconstructed `loadCatalogExamples` faithfully in a throwaway
script and ran it, plus five targeted mutations of it, against the real
`docs/output-catalog.md`. Every count in this file below is a measured number,
not an estimate. No repo file was modified and no repo command was run.

## New findings — from the clean lists

### `tests/architecture/catalog-uat.test.ts` (driver half, lines 5103–5442)

- **[BLOCKER] The gate byte-pins the user contract against a renderer path
  production no longer takes for cascade rows** — `line 5174`
  (`notify(ctx as never, fixture.pi as never, fixture.message)`).
  `notify()` (`shared/notify.ts:3813`) composes per-plugin rows through the
  file-private central `renderPluginRow` switch (`notify.ts:2581`, threaded at
  `notify.ts:3348`). Production does not: every orchestrator that emits a
  `marketplaces[].plugins[]` cascade row now calls
  `notifyWithContext` / `notifyUpdateWithContext` / `notifyUpdateNoOpWithContext` /
  `notifyReconcileAppliedWithContext`, which dispatch each row through the
  command's OWN render map via `notify-context.ts:311 dispatchRow` →
  `context.render[status]`. Grep-confirmed call sites: `plugin/list.ts:1518,1562`,
  `plugin/install.ts:1812,1879,2362,2397`, `plugin/update.ts:2213,2774,2796,2861,2965`,
  `plugin/uninstall.ts:230,261,480,765`, `plugin/reinstall.ts:353,412,424,500,647`,
  `plugin/fetch.ts:194`, `plugin/enable-disable.ts:949,951,1121,1129`,
  `plugin/info.ts:2236`, `import/execute.ts:1204`, `reconcile/pending.ts:267`,
  `reconcile/apply.ts:819`, `marketplace/{add,remove,update,list,autoupdate}.ts`.
  The plain-`notify()` sites that remain (`plugin/shared.ts:1272,1342`,
  `install.ts:2337`, `update.ts:374`, `reinstall.ts:535`, `pending.ts:215`,
  `marketplace/shared.ts:528,548`, `marketplace/info.ts:168,191,193,201`,
  `plugin/info.ts:2285,2312,2355,2357,2372`, `autoupdate.ts:523`) all carry
  standalone non-cascade kinds (`marketplace-not-added`, `plugin-info`,
  `plugin-info-cascade`, `marketplace-info-cascade`, `reconcile-pending-empty`,
  the `{ marketplaces: [] }` sentinel) — none of them reaches `renderPluginRow`
  with a plugin row.
  Measured split of the 182 parsed examples by section: 152 belong to sections
  whose production emitter is a `*_CONTEXT` render map (list 24, install 16,
  update 16, reinstall 13, enable 12, marketplace update 12, marketplace add 9,
  reconcile-applied 9, pending 8, uninstall 6, marketplace autoupdate 6,
  fetch 4, import 4, disable 4, marketplace remove 4, marketplace list 2,
  bootstrap 2, manual-recovery-anchors 1); only 30 (plugin info 20, marketplace
  info 10) are legitimately `notify()`-routed. **Exactly 4 of the 182 examples
  reach the production seam**, via the `emit` overrides at lines 826, 899, 2124,
  2451. So roughly 140 catalog examples pin bytes emitted by code production
  does not run.
  The two paths are asserted equal only by prose — `notify-context.ts:37`
  ("reproduces the EXACT bytes of the central switch arm it lifts"),
  `update.messaging.ts:50` ("Arm bodies are byte-identical to the central
  `renderPluginRow` switch"), `list.messaging.ts:83`. Six lines below its own
  byte-identity claim, `update.messaging.ts:56-59` records that the divergence
  already happened: *"This map -- not the central `renderPluginRow` arm -- is
  what actually renders this verb's rows, so a fix applied only centrally would
  raise the severity while still dropping the brace."* The file's header
  (`lines 30-34`) calls itself "the BINDING USER-CONTRACT GATE … Every byte
  change in either side must agree, structurally enforcing the user contract";
  for ~140 of 182 examples that is not what it does.
  **Fix:** promote `emit` from an optional per-fixture override to a required
  per-section emitter. Add a section→emitter table keyed by the existing
  `FIXTURES` outer keys, mapping each command section to the seam its
  orchestrator actually calls — e.g. `"/claude:plugin list"` →
  `(ctx, pi, msg) => notifyWithContext(ctx, pi, LIST_CONTEXT, msg.marketplaces,
  msg.kind, msg.cardinality)`, `"/claude:plugin update"` → the
  `notifyUpdateWithContext` / `notifyUpdateNoOpWithContext` pair keyed on whether
  the fixture carries `tally`, `"reconcile-applied-cascade"` →
  `notifyReconcileAppliedWithContext`. Keep plain `notify()` only for
  `"/claude:plugin info …"`, `"/claude:plugin marketplace info …"` and the
  standalone-kind fixtures. Existing per-fixture `emit` entries then collapse
  into the table.

- **[BLOCKER] The gate's own driver has no planted-failure case; mutating it to
  report nothing leaves every test green** — `lines 5109–5226`
  (`Failure`, `checkSeverityArg`, `checkCatalogExample`, `formatCatalogFailure`).
  Mutating `checkCatalogExample` to `return []` (line 5161) makes the 182-example
  walk pass vacuously: the count pin at 5236 still holds, the inverse walk at 5374
  still holds, and nothing else in the suite calls these four units. The same is
  true of narrower mutations — flipping `if (actual !== example.expected)` at
  5186 to `===`, or making `checkSeverityArg` always `return undefined`. In a
  green run **not one line of `formatCatalogFailure` and not one failure arm of
  `checkSeverityArg` or `checkCatalogExample` ever executes**, so all three
  `Failure` kinds are unexercised. This is the exact shape the repo's own
  convention forbids (CONVENTIONS.md: *"A gate wants a test that plants the
  violation, not one that reads the config"*), and the shape META-FINDINGS
  §"Gates that do not gate" already catalogues four times elsewhere.
  **Fix:** add three sibling cases next to the two `loadCatalogExamples` cases,
  calling the driver units directly with planted inputs — (a)
  `checkCatalogExample({section:"/claude:plugin list", state:"empty",
  expected:"WRONG"})` returns exactly one `Failure` with
  `kind:"byte-mismatch"`, compared with `assert.deepStrictEqual` against a
  hand-written literal; (b) a `(section,state)` absent from `FIXTURES` returns
  exactly one `kind:"missing-fixture"`; (c) `checkSeverityArg` returns a
  `severity-mismatch` for both directions (fixture declares `"warning"` but the
  call carried one arg; fixture declares none but the call carried two). This
  requires no production change — the units are already module-local pure
  functions taking plain data.

- **[WARNING] The 182 pin's comment misstates the invariant, and hides three
  catalog annotations the gate never reaches** — `lines 5232–5239`, and
  `docs/output-catalog.md:2837`.
  The comment says *"182 is the number of annotated examples in
  docs/output-catalog.md"*. Measured: the catalog contains **185 anchored
  `<!-- catalog-state: … -->` annotations** (187 raw occurrences, 2 of which are
  prose mentions at lines 2853 and 2889). 182 is the number the parser *reaches*;
  three annotations sit under non-command H2s and are dropped by the
  `st.currentSection !== null` guard at line 112: `device-flow-prompt` (2857) and
  `stop-override-cap` (2871) — both explicitly documented as intentional at
  `docs/output-catalog.md:2853` and byte-locked elsewhere
  (`tests/shared/device-flow-prompt.test.ts`,
  `tests/architecture/hooks-cap-notify.test.ts`) — and **`usage-error` (2837),
  which carries no such note**. `notifyUsageError`'s byte form happens to be
  covered by `tests/shared/notify.test.ts:2450`, so this is a documentation and
  gate-scope gap, not an uncovered surface, but the catalog block at 2839–2843
  advertises a contract the catalog-uat gate silently does not enforce.
  **Fix:** reword the comment to state the real invariant — "185 anchored
  annotations exist; 3 sit under non-command H2 sections and are deliberately out
  of this gate's scope; 182 reach the driver" — and add a one-line note under
  `## Usage errors` in the catalog matching the one already at line 2853, naming
  `tests/shared/notify.test.ts` as the lock. Better still, assert both numbers:
  pin the raw anchored-annotation count at 185 alongside the parsed count at 182,
  so a newly-added annotation that lands outside a command section is a failure
  rather than an invisible skip.

- **[WARNING] Three parser state-machine resets/guards survive mutation against
  both unit cases and the whole 182-example corpus** — `lines 112, 120, 134`.
  Measured by running the mutated parser over the real catalog:
  | Mutation | Parsed count | Caught? |
  | --- | --- | --- |
  | drop `st.pendingState = null` after emitting (line 120) | 182 | **no** |
  | drop `st.pendingState = null` on a recognised section heading (line 134) | 182 | **no** |
  | drop the `st.pendingState !== null` guard (line 112) | 182 | **no** |
  | drop the `st.currentSection !== null` guard (line 112) | 185 | yes, by the count pin only |
  | drop the whole non-command-H2 disarm (lines 138–142) | 185 | yes, by the count pin only |
  The two `loadCatalogExamples` cases catch none of the five: the case at 5419
  puts its unannotated fence under `## Conventions`, where `currentSection` is
  already `null`, so the section guard does the blocking and the state guard is
  never the discriminator. Consequences of the three survivors are real: without
  line 120 a marker arms every following fence in its section; without line 134 a
  dangling marker at the end of one command section leaks into the next section's
  first fence; without the line-112 state guard an unannotated fence inside an
  armed section is emitted with a null state.
  **Fix:** add three sibling `loadCatalogExamples` cases beside the existing two,
  each asserting the whole returned array with `assert.deepStrictEqual`:
  (a) one section, one marker, **two** fences → exactly one example, from the
  first fence; (b) section A + marker, then section B + fence → zero examples;
  (c) one armed section with an unannotated fence → zero examples.

- **[WARNING] `loadCatalogExamples`'s docstring makes a claim about the corpus
  that the corpus disproves** — `lines 164–168`. It states non-command H2
  sections' fences "are skipped **because no `catalog-state:` discriminator can
  appear under a null section**". Three do appear under a null section
  (`docs/output-catalog.md:2837, 2857, 2871`); what actually skips them is the
  `st.currentSection !== null` guard at line 112. A reader trusting the comment
  would take that guard for redundant and delete it. This is the "doc comments
  that lie" class META-FINDINGS §2 already records in `routing-state.ts`.
  **Fix:** replace the causal clause with the mechanism — "a marker parsed while
  `currentSection` is `null` arms `pendingState` but the fence-close guard in
  `scanInsideFence` refuses to emit it; three such markers exist in the catalog
  today and are deliberately out of scope."

- **[WARNING] The two `loadCatalogExamples` cases assert field-by-field where the
  whole array is the promise** — `lines 5416` and `5438–5441`. Four separate
  `assert.equal` calls on `examples.length`, `examples[0]?.section`,
  `examples[0]?.state`, `examples[0]?.expected`, and a bare length check in the
  other case. The skill names this exactly: *"asserting existence, length, or one
  property at a time when the whole value is the promise is a finding"*. Adding a
  fourth field to `CatalogExample` with a wrong value survives both cases.
  **Fix:** `assert.deepStrictEqual(examples, [])` at 5416, and at 5438–5441
  `assert.deepStrictEqual(examples, [{ section: "/claude:plugin list", state:
  "empty", expected: "(no plugins)" }])`. Drop the optional chaining — it is only
  there because the assertions index before proving the length.

- **[WARNING] `UGRM-02` asserts two regex fragments where the full body is short
  and computable** — `lines 5362–5371`. The case renders one deterministic
  three-row reinstall cascade and then checks only
  `assert.match(body, /Plugin reinstall: 3 successes/)` plus a standalone
  `assert.doesNotMatch(body, /\bupdated\b/)`. Surviving mutations: change the
  marketplace header's scope bracket from `[user]`, drop the `{up-to-date}` brace
  from the `beta` row, reorder `alpha` and `gamma`, or drop either `reinstalled`
  row's version — all leave both assertions green. The standalone negative is the
  form the skill calls out as passing for any value. The first pass's clean
  paragraph excuses this as "an explicitly-scoped substring/regex where the
  test's own stated purpose is narrower than full byte parity"; the whole body
  here is four lines long and fully determined by the arranged input, so there is
  no scope argument for it.
  **Fix:** replace both with one `assert.equal(body, <hand-written full
  string>)`, in the style of `tests/orchestrators/plugin/update.test.ts:2496` and
  `tests/shared/notify.test.ts:502`, which already hand-write whole multi-line
  cascade bodies. Keep the `doesNotMatch` only if a full-body equality cannot
  express the leak claim — it can.

- **[WARNING] Two header comments describe parser code that no longer exists and
  state a wrong section count** — `lines 23–28` and `lines 255–257`. Both cite
  `currentSection = sectionMatch[2] ?? "manual-recovery-anchors"` as the parser's
  fallback. That expression is gone: `resolveSectionName` (lines 75–82) is a
  three-way resolution — group 2 when present, kebab-cased
  `manual-recovery-anchors` for the `Manual recovery anchors` heading, and the
  heading text verbatim otherwise (which is how `reconcile-applied-cascade`
  resolves). Under the described code `## reconcile-applied-cascade` would
  resolve to `"manual-recovery-anchors"`, which would break 9 fixtures. Line 255
  additionally says the outer map holds "the 12 per-command H2 strings plus the
  `manual-recovery-anchors` fallback key"; `FIXTURES` has **20** top-level keys —
  18 command sections plus `manual-recovery-anchors` (line 4646) and
  `reconcile-applied-cascade` (line 4810). Also, `lines 23–28` is a sentence
  fragment with no verb. `.claude/rules/typescript-comments.md` bans narration of
  code that no longer exists.
  **Fix:** rewrite both to describe `resolveSectionName`'s three arms as they
  stand, and correct the count to "18 per-command H2 strings plus the
  `manual-recovery-anchors` and `reconcile-applied-cascade` keys".

- **[WARNING] A planning-artifact reference in a comment** — `line 5381`
  (`// … When Plans 49-01 / 49-02 added new states + fixtures, this confirms they
  stay paired`). `.claude/rules/typescript-comments.md` forbids `Plan NN-NN`
  references. This also refutes the first-pass clean claim "no Plan/Phase/Wave
  references anywhere in 5442 lines" (first-pass file, line 114) — this is the
  only hit in the file, and it is in the half the first pass declared clean.
  **Fix:** delete the sentence; the SC#3 rationale in the two lines above already
  carries the anchor.

- **[WARNING] `CatalogFixture.message` is dead data whenever `emit` is present,
  and one such fixture duplicates its payload by hand** — type at `lines
  236–249`, driver branch at `lines 5171–5175`, worst instance at `lines
  2430–2468` (sub-agent B's half). When `emit` is set the driver never reads
  `fixture.message`, yet `message` is declared required, so all four `emit`
  fixtures must carry a payload nothing validates. `skip-partially-upgradable-bulk`
  writes the same marketplace row twice — once in `message.marketplaces`
  (2433–2449, dead) and once inside `emit` (2453–2467, live). The two can drift
  silently. The file's own header at `lines 314–319` says the shared
  `AVAILABLE_INSTALLS_DISABLED_ROWS` / `REMOTE_INSTALLS_DISABLED_ROWS` constants
  exist precisely "so the fixture's `message` payload and its `emit` override
  cannot drift apart" — that discipline is applied to two of the four emit
  fixtures and not to this one.
  **Fix:** if BLOCKER #1 is taken, this dissolves — every fixture becomes
  `message`-only and the section table owns the emitter. If it is deferred,
  narrow `CatalogFixture` to a discriminated union
  (`{ message: NotificationMessage; emit?: never } | { emit: (ctx, pi) => void;
  message?: never }`) so a fixture cannot carry an unvalidated payload, and hoist
  the 2453–2467 rows into a shared `const` the way the two list rows already are.

### `extensions/pi-claude-marketplace/orchestrators/plugin/update.messaging.ts` (first-pass clean list)

- **[WARNING] `mpScope` threading is unexercised in the paired test; the sibling
  `list.messaging.test.ts` already varies it** — `lines 60–82` (all five
  `UPDATE_RENDER` arms). `tests/orchestrators/plugin/update.messaging.test.ts`
  calls the render map six times (lines 80, 116, 154, 190, 224, 261) and passes
  `"user"` as `mpScope` **every time**. Hard-coding `"user"` in place of the
  threaded `mpScope` in all five arms leaves that file's seven cases green, and
  the catalog-uat gate cannot see it at all (BLOCKER #1: it renders update
  through `renderPluginRow`, not `UPDATE_RENDER`). The mutation is caught only
  incidentally, by an end-to-end case in another file
  (`tests/orchestrators/plugin/update.test.ts:2496`, whose project-scoped
  marketplace makes the fold observable). The in-repo reference is the sibling:
  `tests/orchestrators/plugin/list.messaging.test.ts` passes `"project"` at lines
  69, 208, 304 and `"user"` elsewhere, so the scope-fold is directly
  discriminated there.
  **Fix (in `tests/orchestrators/plugin/update.messaging.test.ts`, which owns the
  pairing):** change at least two of the six calls to pass `mpScope: "project"`
  against a row whose own `scope` is `"project"` (fold, no bracket) and one whose
  `scope` is `"user"` (bracket shown), and pin both whole row strings.

- **[WARNING] "byte-identical to the central switch" is asserted in prose with no
  gate, and the next comment records a divergence** — `lines 21` and `50`, versus
  `lines 56–59`. Same claim at `list.messaging.ts:83` and
  `notify-context.ts:37`. `.claude/rules/typescript-comments.md` is explicit:
  *"A claim of the form 'this is byte-identical to what came before' is not a
  fact about the current code at all -- the gate that pins the bytes is, so name
  the gate or say nothing."* No gate pins it today (that is BLOCKER #1), and the
  WR-12 note six lines below documents a real case where the central arm and this
  map diverged.
  **Fix:** either name the gate once BLOCKER #1 lands (the catalog UAT, once it
  routes update through `UPDATE_CONTEXT`), or replace the claim with the fact —
  "each arm delegates to the same shared row helper the central switch calls",
  which is what `list.messaging.ts` arms actually do and is verifiable by reading.

### `extensions/pi-claude-marketplace/orchestrators/plugin/list.messaging.ts` and `update.messaging.ts` (both first-pass clean)

- **[WARNING] File-level overview JSDoc sits after the imports** —
  `list.messaging.ts:27–39`, `update.messaging.ts:17–24`. The style rule is
  "copyright JSDoc, `@fileoverview` JSDoc, imports, implementation", each
  separated by one blank line. Both files put the module overview between the
  imports and the first declaration, where it reads as documentation for
  `UpdateStatus`/`ListStatus` rather than for the module. Grouped: one rule, two
  files. **Fix:** move each block above the import group. Consistent between the
  two siblings, so this is a convention correction, not drift — check the other
  `*.messaging.ts` modules for the same shape while fixing.

## Export ownership census

`tests/architecture/catalog-uat.test.ts` exports nothing (verified: zero
`^export` lines), so the census below covers its module-local units in my half
and the production symbols it imports.

| Module | Unit / export | Owning case | Status |
| --- | --- | --- | --- |
| `catalog-uat.test.ts` | `resolveSectionName` | — (only via the 182-walk) | incidental only |
| `catalog-uat.test.ts` | `scanInsideFence` | `line 5419` (partly) | incidental + 3 untested guards |
| `catalog-uat.test.ts` | `scanOutsideFence` | `line 5419` (partly) | incidental + 1 untested reset |
| `catalog-uat.test.ts` | `loadCatalogExamples` | `lines 5412, 5419` | owned (weak assertions — see finding) |
| `catalog-uat.test.ts` | `makeCtx` | every case | owned |
| `catalog-uat.test.ts` | `piWithBothLoaded` (178 uses) | 182-walk | owned |
| `catalog-uat.test.ts` | `piWithMcpLoaded` (4 uses) | 182-walk | owned |
| `catalog-uat.test.ts` | `piWithNothingLoaded` (8 uses) | 182-walk | owned |
| `catalog-uat.test.ts` | `checkSeverityArg` | — | **NO CASE** (green-run success arm only) |
| `catalog-uat.test.ts` | `checkCatalogExample` | — | **NO CASE** (green-run success arm only) |
| `catalog-uat.test.ts` | `formatCatalogFailure` | — | **NO CASE** (never executes in a green run) |
| `catalog-uat.test.ts` | `MockTool.sourceInfo` field | — | **NO CASE** — dead, sole occurrence is `line 204` |
| `shared/probe-classifiers.ts` | `narrowProbeError` | `tests/shared/probe-classifiers.test.ts` (`describe` at ~346+) | owned |
| `shared/probe-classifiers.ts` | `narrowResolverNotes` | same, cases 14–240 | owned, incl. prefix near-misses and ordering |
| `shared/probe-classifiers.ts` | `narrowUnsupportedKinds` | same, cases 243–343 | owned |
| `shared/probe-classifiers.ts` | `UnsupportedReason` (type) | same, `satisfies` at 257, 269 | owned |
| `shared/probe-classifiers.ts` | `ResolverNoteReason` (type) | same, `satisfies` at 17 | owned |
| `plugin/list.messaging.ts` | `LIST_CONTEXT` (10 render arms) | `list.messaging.test.ts` — all 10 arms called | owned |
| `plugin/list.messaging.ts` | `ListMsg` (type) | used by `plugin/list.ts:85` | owned |
| `plugin/update.messaging.ts` | `UPDATE_CONTEXT` (5 render arms) | `update.messaging.test.ts` — all 5 called, all with `mpScope:"user"` | owned, one axis untested |
| `plugin/update.messaging.ts` | `UpdateMsg` (type) | used by `plugin/update.ts:156` | owned |
| `shared/notify-context.ts` | `notifyWithContext` | `tests/shared/notify-context.test.ts` | owned (other area) |
| `shared/notify-context.ts` | `notifyUpdateWithContext` | same | owned (other area) |
| `shared/notify-context.ts` | `notifyUpdateNoOpWithContext` | same | owned (other area) |
| `shared/notify-context.ts` | `notifyReconcileAppliedWithContext` | same | owned (other area) |

## Branch census

Reachable and untested (findings above):

- `scanInsideFence:112` `st.pendingState !== null` — reachable, no case
  discriminates it; mutation survives all cases and the whole corpus.
- `scanInsideFence:120` `st.pendingState = null` after emit — reachable, mutation
  survives.
- `scanOutsideFence:134` `st.pendingState = null` on a recognised heading —
  reachable, mutation survives.
- `checkSeverityArg:5133-5139` and `5146-5152` — both failure arms reachable
  (a wrong fixture or a renderer change reaches them), zero cases.
- `checkCatalogExample:5163-5165` missing-fixture arm and `5187-5193`
  byte-mismatch push — reachable, zero cases.
- `formatCatalogFailure:5206-5225` — all three arms reachable, zero cases.

Reachable, covered only by the 182-example integration walk (no unit case):

- `resolveSectionName:81` both non-backtick arms — the `Manual recovery anchors`
  kebab-case arm (corpus line 2798) and the `reconcile-applied-cascade` verbatim
  arm (corpus line 2145). Swapping them produces missing-fixture failures, so the
  gate catches it; the parser's own two cases do not.
- `scanInsideFence:112` `st.currentSection !== null` and
  `scanOutsideFence:138-142` non-command-H2 disarm — both measured as caught by
  the exact-count pin (185 ≠ 182) and by nothing else.

Compiler-forced, not removable (D-116-01a category — do not file as dead code):

- `scanOutsideFence:146` `stateMatch[1] ?? null` — group 1 is always present when
  the regex matches; `noUncheckedIndexedAccess` forces the coalesce.
- `checkSeverityArg:5138,5151` and `formatCatalogFailure:5213-5214,5221-5223`
  `?? ""` / `?? "?"` — the optional `expected`/`actual` fields are always set for
  the kinds that read them; the optionality is what forces the fallbacks.
- inverse walk `5394` `if (states === undefined) continue` — `Object.keys(FIXTURES)`
  guarantees presence; `noUncheckedIndexedAccess` forces the guard.

Unreachable by real input: none found in my half.

## Grading of first-pass findings

### `tests/architecture/catalog-uat.test.ts`

- **UNDERSTATED** — *`as never` casts hide the mock ctx/pi doubles from the type
  checker* — real, but the recorded WARNING misses the concrete harm. There are
  16 casts across 8 call sites (lines 828/829, 900, 2125, 2452, 5174, 5268, 5280,
  5325; the first pass counted 9 call sites). Because `MockCtx.ui.notify` is a
  bare `mock.fn()` with no signature, and the driver then re-casts the recorded
  `arguments` to `[string, string?]` at line 5183, the *shape of the call this
  entire gate exists to pin* — exactly one string, or a string plus a severity
  string — is checked only by hand-written runtime asserts with the compiler
  disabled at both ends. The skill classifies a cast "hiding an invalid double"
  as BLOCKER; this qualifies. **Proposed severity: BLOCKER**, resolved by the
  narrow-port production change the first pass already names.
- **CONFIRMED** — *Process-wide `mock` imported from `node:test`* — `line 39`
  imports it, `line 199` uses it, and none of the six `test()` bodies takes a
  `t` parameter (verified).
- **CONFIRMED** — *Bare `actual` local* — `line 5185`, exactly as recorded.
- **CONFIRMED** — *All six cases omit AAA phase comments* — verified across
  5228, 5261, 5318, 5374, 5412, 5419.
- **CONFIRMED** — *The 182-example walk is one `test()` looping over all rows* —
  real, and the recorded mitigations are accurate. Lowest-value item in the file:
  do it only as part of BLOCKER #1's restructuring, since the fixture data and
  the emitter table move together.
- **CONFIRMED** — *`FIXTURES` scope-gate comment violated by two entries
  synthesising `reasons` from `narrowUnsupportedKinds`* — verified at lines 4301
  and 4509 (the only two non-comment uses inside the table). Sub-agent B's half;
  the analysis holds.
- **CONFIRMED** — *Dead `sourceInfo` field on `MockTool`* — `line 204` is the
  file's only occurrence of the token (verified by grep), and
  `platform/pi-api.ts:150` reads `sourceInfo?.source` in the OR-branch no fixture
  reaches. Deleting the field is right; that branch belongs to `pi-api.ts`'s own
  pairing.

### `extensions/pi-claude-marketplace/shared/notify.ts`

- **CONFIRMED** — *`notify()` takes the full external SDK types instead of a
  narrow consumer-declared port* — verified at `notify.ts:3813-3817`, and the
  same shape at `notify-context.ts:144-150, 197-203, 234-238, 266-270`, so the
  fix must cover all five entry points, not just `notify()`. This is
  META-FINDINGS §"Ranked by leverage" item 1; ownership belongs to the
  `tests/shared/notify.test.ts` area file (178 `as never` there vs 16 here), and
  fixing it there deletes these 16 for free.

### `extensions/pi-claude-marketplace/shared/notify-context.ts`

- **OVERSTATED** — *Single-letter parameter `p` used across multi-line functions*
  — technically true (`dispatchRow` spans lines 311–338), but this is the
  declared callback-parameter name of the `RenderFn<M>` signature
  (`notify-context.ts:39`, whose own type already names the role `row`) and it is
  the identical convention in every one of the ~15 `*_RENDER` maps repo-wide.
  The first-pass entry itself says it is "flagging for awareness, not requesting
  a drive-by rename", i.e. a non-actionable note occupying a finding slot.
  **Correct handling: drop it, or raise one repo-wide convention ticket** to
  rename `p` → `row` across `notify-context.ts` and every `*.messaging.ts` in one
  change. Renaming this file alone makes the subsystem less consistent.

## Still clean after attack

- **`docs/output-catalog.md` ↔ `FIXTURES` key integrity.** Measured: 182 parsed
  examples produce **182 unique `(section, state)` keys** — no duplicate
  annotation is silently double-booked against one fixture, and the forward walk
  (missing fixture) plus the inverse walk (orphan fixture) genuinely gate both
  directions. Both are real gates, not config reads.
- **The exact-count pin does real work.** Two mutations I expected to survive did
  not: dropping the non-command-H2 disarm (lines 138–142) and dropping the
  `currentSection` guard (line 112) each raise the parsed count from 182 to 185
  and fail the pin. The first pass's praise for pinning an exact count rather
  than a floor is correct and measured.
- **`checkSeverityArg` discriminates in both directions.** The
  `expectedSeverity === undefined` arm requires `callArgs.length === 1`, so a
  fixture that omits the field while the renderer emits `"warning"` fails, and a
  fixture that declares one the renderer does not emit fails too. Not a
  one-sided check.
- **`makeCtx()` per example is load-bearing and asserted.** A fresh
  `mock.fn()` per example plus `assert.equal(calls.length, 1)` at 5177 catches
  both a double-emit and a silent no-emit; the comment at 5156–5159 correctly
  states why.
- **`assert.equal` here is `strictEqual`.** The file imports
  `node:assert/strict` (line 36), so the many `assert.equal` calls are not the
  loose-comparison finding they look like. Do not "fix" them.
- **`XSURF-03` catches a one-sided change.** Mutating the list arm or the
  update-decline arm alone changes one brace and fails; only a mutation to the
  shared `narrowUnsupportedKinds` seam moves both together, which is precisely
  the coupling the case documents at 5254–5260 and which
  `tests/shared/probe-classifiers.test.ts` owns independently (32+ cases,
  including one-character prefix near-misses at 175, 186, 322 and first-seen
  ordering at 219, 333). Noted for honesty: `{lsp, unsupported component}` — the
  brace this case actually produces — appears nowhere in `docs/output-catalog.md`,
  so the *absolute* bytes are unpinned here; the case does not claim otherwise.
- **`shared/probe-classifiers.ts` survives attack.** Every export is owned with
  strong, whole-value cases; the arm-ordering hazards its comments name (WR-01
  `malformed mcp reference` before the `lspServers` substring; hooks prefixes
  before both) each have a dedicated case. The one uncommented assertion,
  `(err as NodeJS.ErrnoException).code` at line 55, has an obvious reason and
  matches the house idiom at `platform/pi-api.ts:145` — **not a finding**.
- **`list.messaging.ts` arm coverage is complete.** All 10 `LIST_RENDER` arms
  have a direct case in `list.messaging.test.ts` (lines 69, 101, 135, 173, 208,
  239, 274, 304, 333, 366), each pinning a whole row string, and `mpScope` varies
  across cases. Contrast `update.messaging.test.ts` above — this is the sibling
  the update fix should copy.
- **No structural test-shape defects.** Verified by grep across all 5442 lines:
  zero `describe()`, zero `it()`, zero committed `only`/`skip`/`todo`, zero
  exports, six top-level `test()` cases, no `Date.now()`/`Math.random()`/
  `process.env`, no network, and the single filesystem read is the behaviour
  under test.

## Not covered

- **The fixture corpus, lines 313–5103** — sub-agent B's half. I read four
  regions of it (795–920, 2085–2155, 2410–2485, 4805–4845) only to settle driver
  questions, and I counted `emit:` and `narrowUnsupportedKinds` occurrences
  file-wide. Findings I raise that touch those lines (the dead `message` on emit
  fixtures) name B's lines but should be reconciled with B's file before fixing.
- **`shared/notify.ts` (4217 lines)** — I read the `notify()` entry point, its
  dispatch region, and `emitCascadeWith`/`emitContextCascade`, enough to
  establish BLOCKER #1's mechanism. I did not review the ~3700 lines of renderer
  arms; that belongs to the `tests/shared/notify.test.ts` pairing.
- **`tests/shared/notify-context.test.ts`, `tests/orchestrators/plugin/{list,update}.messaging.test.ts`,
  `tests/shared/probe-classifiers.test.ts`** — read only far enough to census
  ownership and settle the `mpScope` and arm-coverage questions. Their own
  assertion quality is another area's call.
- **Direct per-pair coverage was not measured** — the brief forbids running the
  suite. Every coverage statement here is from reading and from an offline
  replica of the parser, not from `--experimental-test-coverage`.

## Meta-findings impact

### New cross-cutting evidence

**A sixth "gate that does not gate", and it is the largest one.** META-FINDINGS
§"Gates that do not gate" lists five instances. This is a sixth, and it is bigger
than the other five combined: the catalog UAT, the repo's binding user-contract
gate, drives ~140 of its 182 examples through `renderPluginRow` — a
**file-private function with no production call site that carries a plugin row**
— while production renders those same rows through the per-command `*_RENDER`
maps. The evidence is in the production source itself
(`update.messaging.ts:56-59`, which states outright that the central arm is not
what renders that verb's rows). This is not a mis-scoped grep like the HOOK-03
case; the gate runs, passes, and pins bytes nobody sees.

**The class to check elsewhere: a legacy seam kept alive only by its tests.**
`notify.ts`'s central `renderPluginRow` switch (line 2581) and everything it
reaches is now, for the cascade-row family, exercised almost exclusively by
`tests/architecture/catalog-uat.test.ts` and `tests/shared/notify.test.ts`. Areas
that should be checked for the same shape: **`shared/notify.md`** (does
`notify.test.ts` also drive the legacy switch rather than the context seam? if
so, the two largest test assets in the repo are both pointed at retired code),
**`orchestrators/reconcile`** (`apply.ts:819` uses the context seam;
`reconcile/notify.test.ts` should be checked for which side it drives), and any
area whose module comment says a path "keeps serving not-yet-migrated call sites"
(`notify-context.ts:24-29`) — that sentence is now false and is the kind of
stale-status doc comment META-FINDINGS §2 already flags in two other modules.
Recommend adding to the §"audit every architectural gate" workstream: **for each
gate, name the production entry point it invokes and confirm production still
invokes it**, not merely that the gate's target file exists.

**A measurable technique worth propagating.** Reconstructing a test's parser
offline and running it plus five targeted mutations against the real corpus
turned three "looks fine" guards into measured survivors and disproved two
suspicions in about ten minutes. Any area with a hand-written parser, scanner, or
source-walker over a real repo artifact (`tests/architecture/source-scan.ts` and
the five files META-FINDINGS says hand-roll their own walkers are the obvious
candidates) can be attacked this way. It also produced a hard number the reading
pass could not: 185 anchored annotations vs 182 gated.

### Corrections to META-FINDINGS.md

- **§"Patterns to propagate" / §"Ranked by leverage" do not yet contain the
  strongest single finding in this area.** Add the catalog-UAT wrong-path
  BLOCKER to §"Gates that do not gate" as item 6, and note it is a *production
  path* mismatch rather than a *scan-target* mismatch — a distinct sub-class the
  five existing items do not cover.
- **§"Decisions the fixing pass cannot make" item 2 (module splits) lists
  `tests/architecture/catalog-uat.test.ts` (5,442 lines → parser + ~18 fixture
  modules + driver).** That sequencing is right but the stated shape is
  incomplete: the split must also introduce a **section→emitter table**, because
  the fixture modules are what carry the per-command context. Splitting first and
  fixing the render path second means writing 18 fixture modules against the
  wrong seam and then rewriting them. Correction: **the render-path fix and the
  split are one change, and the render-path fix defines the split's interface.**
- **Master tally.** This area's first-pass file contributes 0 BLOCKER + 9
  WARNING to the 429; after this pass it is 2 BLOCKER (new) + 1 promoted from
  WARNING + 19 WARNING. The consolidation should not treat the area's original
  "0 BLOCKER" as evidence of health — it was the largest single test file in the
  sweep and drew the fewest blockers.

### Confirmations

- **§"Confidence: clean verdicts are not reliable" — confirmed hard.** This
  area's clean paragraph made four specific claims; three are false: "no
  Plan/Phase/Wave references anywhere in 5442 lines" (refuted at line 5381),
  "all six real test cases use whole-rendered-string comparisons" (refuted for
  `UGRM-02` and both parser cases), and the implicit claim that the three
  clean-listed production modules had nothing to find (three WARNINGs above).
  The recorded findings, by contrast, all held.
- **§"Ranked by leverage" item 1 (over-wide context parameters) — confirmed from
  a second angle.** All five `notify-context.ts` entry points take
  `ExtensionContext`/`ExtensionAPI` (lines 144, 197, 234, 266, plus `notify.ts:3813`),
  and this file's 16 `as never` casts trace directly to them. One production
  change per entry point deletes all 16 here, on top of the 178 in
  `notify.test.ts`. The cluster is real and the fix is one-directional.
- **§"The dominant shape: sibling drift" — confirmed with a new instance.**
  `update.messaging.test.ts` passes `mpScope: "user"` in all six render calls
  while `list.messaging.test.ts` varies it across three cases. Same subsystem,
  same file shape, one axis silently untested in one of the pair. The fix is
  propagation from a named sibling, exactly as the section predicts.
- **§"Known gaps: direct per-pair coverage was never measured" — confirmed as
  still outstanding**, and this area shows why it matters: `formatCatalogFailure`
  and both failure arms of `checkSeverityArg` would show as 0% line coverage in a
  direct run, which is the cheapest possible detector for BLOCKER #2.
