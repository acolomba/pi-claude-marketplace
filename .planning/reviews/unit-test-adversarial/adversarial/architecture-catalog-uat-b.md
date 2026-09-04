# Architecture — catalog UAT gate (fixture corpus) — adversarial re-review

**Scope:** the per-command fixture corpus of `tests/architecture/catalog-uat.test.ts`,
lines 313–5103 (`AVAILABLE_INSTALLS_DISABLED_ROWS` / `REMOTE_INSTALLS_DISABLED_ROWS`
and the whole `FIXTURES` literal, 356–5101), plus `docs/output-catalog.md` as the
corpus it mirrors. Sub-agent A owns the parser (1–313) and driver (5103–5442);
I read both to settle corpus questions but did not grade them.
**First-pass file:** `unit-test-findings/architecture-catalog-uat.md`
**Clean files attacked:** 1 (the first pass listed no `### Clean files` bullets for
this area — it declared the *unread 8 of 18 fixture sections* clean by inference
under "Not covered". Those 8 sections, ~2,200 lines, are what I attacked.)
**Existing findings graded:** 9

## Verdict summary

| Metric | Count |
| --- | --- |
| New BLOCKER (missed by first pass) | 0 |
| New WARNING (missed by first pass) | 8 |
| Existing CONFIRMED | 6 |
| Existing UNDERSTATED | 0 |
| Existing OVERSTATED | 1 |
| Existing REFUTED | 0 |
| Existing DUPLICATE-OF | 2 |

Plus one **first-pass clean *claim* refuted** (see "Grading", last entry) — the
claim that no Plan/Phase/Wave reference exists anywhere in the 5,442 lines.

**Headline: corpus completeness is real and total.** I re-implemented the parser
independently and diffed both directions. 182 parsed catalog keys, 182 `FIXTURES`
keys, **zero** in-catalog-not-in-fixtures, **zero** orphan fixtures, **zero**
duplicate `(section, state)` keys, and all 20 catalog command sections carry at
least one fixture. Every one of the 19 `/claude:plugin` router verbs
(`edge/router.ts:149–174`) has a catalog H2 section. The first pass's structural
read of this file held up; nothing I found makes the gate lie.

## New findings — from the unread fixture sections

### `tests/architecture/catalog-uat.test.ts`

- **[WARNING] `skip-partially-upgradable-bulk` duplicates its row payload between
  `message` and `emit`; the `message` copy is dead data that can drift silently** —
  `lines 2428–2470`
  The driver takes the `emit` branch (`checkCatalogExample`, line 5171), so the
  `message` object at 2430–2450 is **never rendered**. Mutating it — `name: "hello"`
  → `"goodbye"`, `reasons: ["lsp"]` → `["themes"]`, `severity: "info"` →
  `"warning"` — leaves the suite green, because `emit` re-declares the same
  marketplace array inline at 2452–2468. This is exactly the drift the file's own
  header says it prevented: lines 314–319 explain that the two list-surface `emit`
  states were extracted into shared `as const` rows "so the fixture's `message`
  payload and its `emit` override cannot drift apart — a second copy of the rows
  would let the documented payload and the emitted one diverge silently."
  **In-file sibling fix:** hoist the marketplace array to a module-level
  `const SKIP_PARTIALLY_UPGRADABLE_BULK_ROWS = [...] as const;` beside
  `AVAILABLE_INSTALLS_DISABLED_ROWS` (line 320) and reference it from **both**
  `message: { label: "Plugin update", cardinality: "plural", marketplaces:
  SKIP_PARTIALLY_UPGRADABLE_BULK_ROWS }` and the `notifyUpdateNoOpWithContext`
  call. `all-up-to-date-noop` (2117–2127) needs no change — both sides are `[]`.

- **[WARNING] Two `Phase-73` planning references in fixture comments** —
  `lines 2420, 2426`
  `.claude/rules/typescript-comments.md` bans `Phase NN` in comments and test
  titles; these are the phase-qualified form the rule names explicitly. Delete the
  token and keep the surrounding rationale, which already carries the durable
  anchors (`UGRM-01`/`UGRM-02`): "the `(partially-upgradable) {lsp}` body row" and
  "keeping the `(partially-upgradable) {lsp}` row as the body". A third instance
  lives in the driver at `line 5381` ("Plans 49-01 / 49-02") — sub-agent A's half.
  Borderline, left alone: `T-53-02-02` / `T-55-02-01` (lines 4785, 4884) are
  threat-model IDs, not planning-step references.

- **[WARNING] The SNM-31 scope-gate header makes two blanket claims the corpus
  violates in six places** — `lines 12–14`
  The header states "this test drives `notify()` exclusively. Fixtures are pure
  `NotificationMessage` data -- they are not synthesized from domain helpers."
  Both halves are false: four fixtures bypass `notify()` through the `emit`
  override (`lines 826, 899, 2124, 2451` — driving `notifyWithContext` /
  `notifyUpdateNoOpWithContext` instead), and two synthesize `reasons` from the
  production `narrowUnsupportedKinds` helper (`4301, 4509`). The `emit` escape is
  documented 230 lines later on `CatalogFixture` (`lines 240–249`), so the file
  contradicts itself rather than hiding anything. **Fix:** rewrite lines 12–14 to
  state the real contract — "drives `notify()`, or the orchestrator no-op /
  list-context seams for the states `notify()` cannot produce alone (see
  `CatalogFixture.emit`); fixture payloads are literal `NotificationMessage` data
  except for two `narrowUnsupportedKinds` uses that deliberately pin the
  cross-surface seam." Do **not** repair the claim by changing the code (see the
  grading of the first pass's `narrowUnsupportedKinds` finding).

- **[WARNING] 11 of the 44 closed-set `Reason` members appear in no gated catalog
  block, and nothing detects the omission** — corpus-wide; representative fixtures
  `lines 3957` (`not in manifest`, covered) vs. the absent tokens below
  Census over the 182 parsed `expected` bodies: `not found`, `already installed`,
  `no longer installable`, `unreadable manifest`, `plugins remain`, `concurrently
  uninstalled`, `concurrently updated`, `lock held`, `dangling reference`,
  `malformed mcp`, `malformed command` — zero occurrences. All 11 are live,
  reachable production stamps (e.g. `orchestrators/marketplace/update.messaging.ts:245`
  returns `"unreadable manifest"` as the `narrowSkipReason` fallback that feeds the
  very cascade row `update-autoupdate-cascade-not-in-manifest` documents;
  `orchestrators/reconcile/notify.ts:198` stamps `["dangling reference"]`). The
  182-count pin (`line 5238`) does not help: it pins the *parser*, not the corpus.
  **Calibrated residual risk is low, and I want that on the record:** membership
  and spelling are pinned by `notify-reasons.ts`'s `_ReasonsCoverageProof` (a
  compile error on a typo) and by `tests/architecture/compat-01-no-expansion.test.ts:149–150`
  at runtime, and `composeReasons` (`shared/notify.ts:2189–2203`) is token-agnostic,
  so rendering is uniform across the 33 tokens that *are* covered. What is missing
  is documentation of the user-facing byte form for a quarter of the closed set.
  **Fix (one line, converts an unfalsifiable gap into a gate):** add to the driver
  `test("every ContentReason appears in at least one catalog example")` importing
  `REASONS` from `shared/notify.ts`, asserting each non-structural member occurs in
  some `example.expected`, with an explicit, commented allow-list for members
  deliberately left undocumented. That is the "plant the violation" shape this
  repo's own convention doc asks for.

- **[WARNING] 41 redundant `satisfies NotificationMessage` annotations, applied
  inconsistently** — `lines 1431, 1447, 1461, … 4617` (41 sites)
  `CatalogFixture.message` is already declared `NotificationMessage` (`line 237`),
  so the annotation narrows nothing. Worse, it is applied to 18 of the 20
  `marketplace-not-added` fixtures and omitted on two (`4146–4163`), which reads
  as if those two were checked differently. **Fix:** delete all 41; the field's
  declared type does the work.

- **[WARNING] `invalid-config-row-with-cause` omits `needsReload` where its three
  sibling `failed` marketplace blocks set it explicitly** — `line 4910` (block at
  4917–4923) vs. siblings at `4860–4862`, `4894–4897`, `4956–4958`
  `MpFailed extends MpCommon` makes `needsReload` optional, and an omitted value
  renders identically to `false`, so the inconsistency is byte-invisible and no
  assertion can catch it. **Fix:** add `needsReload: false` to the block at 4917 so
  all four `reconcile-applied-cascade` mp-failure blocks are modeled identically.

### `docs/output-catalog.md` (the corpus this file mirrors)

- **[WARNING] The `usage-error` catalog block is parser-excluded, gated by nothing,
  and demonstrably stale** — `docs/output-catalog.md:2837–2845`
  Three annotations are excluded from the 182 by design (their H2 is not a command
  header): `usage-error` (2837), `device-flow-prompt` (2857), `stop-override-cap`
  (2871). Two are honestly re-gated elsewhere —
  `tests/architecture/hooks-cap-notify.test.ts` reads the `stop-override-cap` block
  from the catalog and byte-compares it, and `tests/domain/github-auth.test.ts:216`
  asserts the `device-flow-prompt` string verbatim. `usage-error` has **no lock at
  all**: the strings "Usage: /claude:plugin <subcommand> [args]" and "Subcommands:
  install, uninstall, update, reinstall, list, bootstrap, import, marketplace"
  occur nowhere in `extensions/` or `tests/`. Production emits
  `"Usage error.\n\n" + TOP_LEVEL_USAGE` (`edge/router.ts:144`, `91–105`) — a
  15-line block whose verb list also includes `fetch`, `info`, `pending`, `enable`,
  and `disable`, none of which the catalog block names. **Fix:** replace the fenced
  block with the real `TOP_LEVEL_USAGE` bytes and add a `readCatalogBlock`-style
  byte lock next to the existing `notifyUsageError` case
  (`tests/shared/notify.test.ts:2450`), or delete the `<!-- catalog-state: -->`
  annotation and say plainly that this surface is illustrative.

- **[WARNING] Two doc comments name byte-lock tests that do not exist** —
  `docs/output-catalog.md:2865` and `extensions/pi-claude-marketplace/shared/notify.ts:374`
  The catalog says the Device Flow prompt "byte form is locked by
  `tests/shared/device-flow-prompt.test.ts`" — no such file; the real lock is
  `tests/domain/github-auth.test.ts:216`. `notify.ts:374` says the usage-error blank
  line is asserted "byte-for-byte" by `tests/shared/notify-v2.test.ts` — no such
  file; the real case is `tests/shared/notify.test.ts:2450`. Both gates exist, so
  nothing is unguarded; the pointers are wrong, and a wrong pointer is how the
  `usage-error` gap above stayed invisible. **Fix:** retarget both strings.

## Export ownership census

The assigned section is fixture **data** and exports nothing, so an export census
is vacuous. The meaningful analogue — and the one my mission asks for — is which
closed-set members of the paired renderer the corpus owns. Counts are occurrences
of `status: "<token>"` inside lines 313–5101 (statuses/kinds) and occurrences
inside the 182 parsed `expected` bodies (reasons).

| Closed set | Members | Owned by ≥1 fixture | NO FIXTURE |
| --- | --- | --- | --- |
| `PluginNotificationMessage` statuses | 19 | 19 | — |
| `MarketplaceNotificationMessage` statuses | 8 (7 distinct tokens + `MpList` status-omitted) | 8 | — |
| `NotificationMessage` top-level kinds | 8 | 8 (`cascade` via the `kind`-less arm, 100+ fixtures) | — |
| `Reason` / `ContentReason` | 44 | 33 | **11** (finding above) |
| Soft-dep marker combinations | 4 | 4 (`both`, `pi-mcp` alone at `list::soft-dep-on-installed`, `pi-subagents` alone ×7, neither ×172) | — |
| Severity arg values | 3 | 3 (`error` ×64, `warning` ×17, absent/info ×101) | — |

Thinnest owners, for the record — each of these tokens rests on exactly one
fixture, so deleting that one fixture silently retires the token's documentation:
`manual recovery` (`4647`), `will enable` / `will disable` (`4758–4759`),
`removed` (`3807`), `autoupdate enabled` (`4173`), `autoupdate disabled` (`4180`),
`reconcile-pending-empty` (`4680`), `marketplace-info-cascade` (1 fixture).

## Branch census

Renderer branches reachable from this corpus, classified:

- **Covered:** every status arm, every top-level kind arm, both `expectedSeverity`
  directions of `checkSeverityArg`, the reload-hint trailer on and off
  (`needsReload: true` ×63 / `false` ×93), the summary-line prefix on and off
  (81 severity-bearing vs. 101 info fixtures), the cause-chain trailer (13
  fixtures), `rollbackPartial` (2), `partialHint` (8), and the brace-collapse path
  (`reasons: []` at `line 5031`, which pins the "empty list renders brace-less"
  contract that `composeReasons`'s `length === 0` early return implements).
- **Reachable and not exercised by this corpus, but owned elsewhere — not a
  finding here:** `hasLoadedPiMcpAdapter`'s `sourceInfo.source` OR-branch
  (`platform/pi-api.ts:150–151`). No fixture sets `sourceInfo` (0 occurrences), so
  deleting that branch survives all 182 examples — but
  `tests/platform/pi-api.test.ts:273–283` plants exactly that input, and its
  `softDepStatus` table (`346–379`) covers all four probe states including the
  asymmetric ones this corpus lacks. The first pass's "drop the dead `MockTool`
  field" direction is therefore correct.
- **Unreachable from this corpus by construction:** `notifyUsageError`,
  `notifyStopHookOverrideCap`, and the Device Flow prompt are not
  `NotificationMessage` payloads. Two are gated elsewhere; the third is the
  `usage-error` finding above.
- **Compiler-forced, not removable (D-116-01a):** none found in this section.

## Grading of first-pass findings

### `tests/architecture/catalog-uat.test.ts`

- **CONFIRMED** — *`as never` casts hide the mock ctx/pi doubles* — 5 of the 9
  cited call sites are in my half (`828–829`, `900`, `2125`, `2452`); the cast is
  real and the severity band fits. Root cause is the production wide-parameter
  finding, which is META-FINDINGS item #1.
- **CONFIRMED** — *`FIXTURES` scope-gate comment violated by two
  `narrowUnsupportedKinds` entries* — exactly 2 call sites inside `FIXTURES`
  (`4301`, `4509`); the count is right. **Correction to the remediation:** the
  first pass's preferred fix ("hardcode the literal `reasons: ["lsp"]`") would
  *reduce* coverage. Because the expected side is the independently authored
  catalog text, mutating `narrowUnsupportedKinds` to map `lspServers` to anything
  but `"lsp"` currently produces a byte mismatch at both fixtures; hardcoding
  removes that. Take the finding's second option — amend the header comment (my
  "SNM-31 scope-gate header" finding above folds this in).
- **CONFIRMED** — *Dead `sourceInfo` field on `MockTool`* (`line 204`) — zero
  `sourceInfo` occurrences in lines 313–5101, so no fixture reaches the OR-branch,
  and `tests/platform/pi-api.test.ts:273–283` owns it. Dropping the field is right.
- **CONFIRMED** — *The 182-example walk is one `test()` looping over all rows*
  (`5228–5252`) — driver half, but it directly shapes the corpus: 182 documented
  behaviors report as one pass/fail. The mitigation the first pass credits
  (failures collected, not fail-fast) is real; the finding stands.
- **CONFIRMED** — *Process-wide `mock` imported from `node:test`* (`39`, `199`) and
  **CONFIRMED** — *bare `actual`* (`5185`) and *missing AAA phase comments*
  (`5228, 5261, 5318, 5374, 5412, 5419`) — all verified present; all in sub-agent
  A's half, listed here only so the tally is complete.
- **DUPLICATE-OF** `unit-test-findings/shared-notify*.md` — *`notify()` takes the
  full external SDK types* — real and correctly diagnosed, but it is META-FINDINGS
  ranked item #1 and belongs to the `shared/notify.ts` pairing file, which rates it
  higher. Fixing it there deletes the casts here for free.
- **DUPLICATE-OF** the file-split decision (META-FINDINGS "Decisions" item 2) —
  *Does the file need to split?* The assessment is sound and my census supports it:
  the 20 fixture sections are cleanly separable (I extracted all 182 keys from the
  literal with a 6-line regex, which is the practical proof they are structurally
  uniform). It is an operator sequencing decision, not an area finding.
- **OVERSTATED** — *Single-letter parameter `p` in `notify-context.ts`* — the first
  pass itself calls it low-priority and notes it is the consistent convention
  across the whole `notify`/`notify-context`/`*.messaging.ts` subsystem. Per the
  adversarial brief's "do not add style noise", this should be a note, not a
  finding.

### First-pass clean claims

- **REFUTED** — *"no Plan/Phase/Wave references anywhere in 5442 lines"* (first-pass
  "Clean files" paragraph). `grep -n "Phase" tests/architecture/catalog-uat.test.ts`
  returns `2420` and `2426` (`Phase-73`), and `grep -n "Plan"` returns `5381`
  ("Plans 49-01 / 49-02"). Three violations of `.claude/rules/typescript-comments.md`.
- **Held up under attack** — *"no duplicate fixtures, no shared mutable module
  state, no `Date.now()`/`Math.random()`/`process.env`, no `only`/`skip`/`todo`"* —
  I verified duplicates programmatically (0 duplicate `(section,state)` keys across
  both the catalog and the object literal) and by grep for the rest. The 182
  module-scope `MockPi` objects and the `new Error(...)` causes are stateless and
  never mutated by the driver, so the module-scope placement is sound.
- **Partially superseded** — the "Not covered" note admitting ~8 of 18 fixture
  sections were unread. I read all of them (uninstall `1468`, reinstall `1604`,
  fetch `2538`, import `2647`, bootstrap `2881`, marketplace list `2914`, remove
  `3806`, marketplace update `3879`, autoupdate `4169`, disable `4560`,
  manual-recovery `4646`, pending `4675`, reconcile `4810`). The first pass's
  "moderate-to-high confidence they follow the same pattern" was correct: the six
  new findings above are the whole yield from those 2,200 lines, and none of them
  is a correctness defect.

## Still clean after attack

`tests/architecture/catalog-uat.test.ts` lines 313–5103 — the fixture corpus
genuinely catches every one of these production mutations, which is why my new
BLOCKER count is zero:

- **Drop one line from a rendered multi-line message** — caught. `checkCatalogExample`
  compares the whole `ctx.ui.notify` first argument against the catalog body
  (`5186`); 60+ fixtures render 3-or-more-line bodies (e.g.
  `reconcile-applied-cascade::partial-marketplace-remove`, 4 rows under one header).
- **Change one word, glyph, or status token** — caught for all 27 status tokens and
  all 8 message kinds; every one has ≥1 fixture (census above).
- **Reorder `<glyph> <name> [scope] (status) {reason}` into a wrong grammar** —
  caught by byte equality on every row.
- **Change or drop the severity arg** — caught in both directions.
  `checkSeverityArg` (`5123–5153`) fails a missing second argument on the 81
  severity-bearing fixtures *and* fails an unexpected second argument on the 101
  info fixtures. Flipping the benign-softening ladder (`up-to-date` /
  `already installed` / `already autoupdate` / `already no autoupdate` →
  `warning`) is caught by `enable-idempotent` (`4184`), `disable-idempotent`
  (`4203`), `update-no-op-skipped` (`3884`) and `fetch::single-noop-skipped` (`2587`).
- **Call the collaborator twice instead of once** — caught by
  `assert.equal(ctx.ui.notify.mock.calls.length, 1)` (`5177`) on every example.
- **Drop the summary-line prefix on an error/warning cascade** — caught: all 81
  severity-bearing fixtures carry the prefixed body in the catalog.
- **Drop the `/reload` trailer** — caught by the 63 `needsReload: true` fixtures;
  **add** it spuriously — caught by the 93 `needsReload: false` fixtures.
- **Swap the two soft-dep probe fields, or drop a soft-dep marker** — caught. All
  four marker combinations are rendered, including `{requires pi-mcp}` alone
  (`list::soft-dep-on-installed`, the sole `dependencies: ["mcp"]` row) and
  `{requires pi-subagents}` alone (7 rows).
- **Break the empty-brace collapse** — caught by `backfill-partially-installed-no-reasons`
  (`5015`, `reasons: []`) paired against a brace-less catalog block.
- **Silently under-scan the catalog** — caught by the exact-182 pin (`5236`), which
  I independently reproduced: my re-implementation of the parser returns exactly
  182 examples from the current `docs/output-catalog.md`.
- **Leave a stale fixture behind after retiring a catalog state** — caught by the
  inverse walk (`5374`); I confirmed 0 orphans by set difference.

One fidelity limit worth stating rather than filing: the gate proves
*renderer* fidelity, never *payload* fidelity. Nothing ties a fixture's
`NotificationMessage` to what an orchestrator actually constructs, so a fixture
modeling an impossible payload would document a state the product never emits.
The file admits this exactly once, honestly, at `lines 4747–4750`
(`pending::enable-disable-transitions`: "the catalog fixture is hand-constructed
(not routed through `planReconcile`)"). I spot-checked the highest-risk claim in
the other direction and it holds: `update-autoupdate-cascade-not-in-manifest`
(`3957`) documents a *version-less* cascade skip row, and
`orchestrators/marketplace/update.messaging.ts:184–195` does forward
`{status, name, scope, reasons, severity, needsReload}` and no `version`.

## Not covered

- I did not grade the parser (1–313) or the driver (5103–5442); sub-agent A owns
  them. Where I cite them (the `emit` dispatch at `5171`, the 182 pin at `5236`,
  the `Plans 49-01` comment at `5381`) it is as evidence for a corpus claim.
- I read every fixture section but did not line-by-line verify all 182 catalog
  blocks against their fixtures — the driver does that on every run, and its
  correctness is A's assignment. My verification is structural (key-set parity,
  closed-set census) plus in-depth reading of the 13 sections the first pass left
  unread and spot-checks of 3 sections it had sampled.
- Fixture-to-orchestrator payload fidelity was spot-checked at one high-risk site
  (above), not audited across all 182. A full audit means reading ~20 orchestrator
  messaging modules and is a distinct task.

## Meta-findings impact

### New cross-cutting evidence

**1. Doc comments that name a byte-lock test by path are unreliable, and two of the
four I checked were wrong.** META-FINDINGS already records this shape once
(`orchestrators/marketplace/info.ts`'s header "misattributes where its gate lives",
under "Gates that do not gate" item 3). I found two more, in different layers:
`docs/output-catalog.md:2865` names `tests/shared/device-flow-prompt.test.ts` and
`extensions/pi-claude-marketplace/shared/notify.ts:374` names
`tests/shared/notify-v2.test.ts` — **neither file exists**. Both gates do exist
under different names, so nothing is unguarded, but the pointers are how a
genuinely ungated state (`usage-error`) stayed invisible next door. This is cheap
to sweep repo-wide and nobody has: `grep -rnoE 'tests/[a-z0-9/-]+\.test\.ts'
extensions/ docs/ | ` check each path exists. **Recommend adding that sweep to the
"audit every architectural gate" workstream** — it is a one-command check with a
known non-zero hit rate.

**2. The catalog-fence parser is duplicated across two test files.**
`tests/architecture/hooks-cap-notify.test.ts:39–65` hand-rolls `readCatalogBlock`,
a second implementation of the same `<!-- catalog-state: -->` fence walk that
`loadCatalogExamples` performs, and its own header says so ("Mirrors the
catalog-uat parser's fence-walk"). This is the same shape as META-FINDINGS'
"`tests/architecture/source-scan.ts` — 5 architecture files hand-roll their own
`.ts` walker": when the catalog parser is extracted during the recommended file
split, `hooks-cap-notify.test.ts` should import it rather than keep its copy.
**Add a row to the "Patterns to propagate" table: shared catalog-block reader,
reference implementation `loadCatalogExamples`, 1 known duplicate.**

**3. A closed-set census is a cheap, mechanical technique this sweep should reuse.**
Extracting a production closed set (`REASONS`, a status union, a `kind`
discriminator) and counting its members against the test corpus took ~15 minutes
and produced the only real gap in a 4,800-line file that reads as uniformly
excellent. It found 11 of 44 `Reason` members undocumented where reading found
nothing. **Other areas with closed sets worth the same treatment:**
`domain/resolver.ts` (the `installable | partially-available | unavailable` union
and its note kinds), `shared/errors.ts` + `errors-bridges.ts` (is every typed error
class constructed by at least one case?), `shared/notify-reasons.ts`'s topic
groups, and `edge/flag-catalog.ts`. The generalisable rule: **an enumerable
production set plus a corpus is a diffable pair, and the diff is a finding the
reviewer cannot see by reading.**

### Corrections to META-FINDINGS.md

- **"Ranked by leverage" item 3, "Replace fragment assertions on rendered messages"**
  lists `shared/notify.test.ts` at "~19 cases" and the orchestrator render tests as
  the fragment offenders, with `*.messaging.test.ts` as the reference
  implementation. `tests/architecture/catalog-uat.test.ts` deserves a place in that
  table's *right-hand* column, not its left: it compares whole rendered strings
  against an independently authored document for 182 states, and additionally
  gates the reverse direction. It is a stronger reference implementation than
  `*.messaging.test.ts` (which compares against hand-written strings in the same
  file) because its expected bytes live in a document maintained for humans.
  **Suggested edit: add "Whole-message assertion against an independently
  maintained document, gated in both directions" to the "Patterns to propagate"
  table, reference `tests/architecture/catalog-uat.test.ts:5228` + `:5374`.**
- **"Decisions the fixing pass cannot make" item 2** lists this file's split as
  "5,442 lines → parser + ~18 fixture modules + driver". The section count is
  **20**, not 18 (`/claude:plugin` ×18, plus `manual-recovery-anchors` and
  `reconcile-applied-cascade`). Minor, but the split plan should size for 20.

### Confirmations

- **Confirms** META-FINDINGS' "clean verdicts are not reliable" premise, from a
  second angle: the first pass's clean paragraph for this file asserted "no
  Plan/Phase/Wave references anywhere in 5442 lines", and two `Phase-73` tokens sit
  at lines 2420 and 2426 inside the region it recorded as unread. The
  false-negative landed precisely where the reviewer's attention ran out, which is
  the failure mode the adversarial brief predicted.
- **Confirms** "Gates that do not gate" as a live class, with a new instance
  (`usage-error`: a documented byte form, no lock, and stale against
  `edge/router.ts:91–105`). It also **qualifies** the class: two of the three
  parser-excluded states in this catalog *are* honestly re-gated
  (`hooks-cap-notify.test.ts` reads the catalog block itself), so the exclusion
  mechanism is sound and only one instance leaked. The class is real; the base rate
  in this area is 1 in 3, not 3 in 3.
- **Confirms** the repo's own "a gate wants a test that plants the violation"
  convention is *well* applied here. The forward walk plants a missing fixture, the
  inverse walk plants an orphan fixture, and the 182 pin plants a parser
  regression. My independent re-implementation reproduced all three results
  exactly. This file belongs on the good side of that ledger.
