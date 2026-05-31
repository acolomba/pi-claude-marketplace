---
phase: 17-spec-rewrite-catalog-uat-migration
reviewed: 2026-05-26T12:52:04Z
depth: standard
files_reviewed: 5
files_reviewed_list:
  - docs/adr/v2-001-structured-notify.md
  - docs/messaging-style-guide.md
  - docs/output-catalog.md
  - tests/architecture/catalog-uat.test.ts
  - tests/architecture/msg-rule-registry.test.ts
findings:
  critical: 1
  warning: 6
  info: 3
  total: 10
status: issues_found
---

# Phase 17: Code Review Report

**Reviewed:** 2026-05-26T12:52:04Z
**Depth:** standard
**Files Reviewed:** 5
**Status:** issues_found

## Summary

Phase 17 rewrites three user-facing specs (ADR-v2-001, messaging-style-guide,
output-catalog) and migrates the catalog UAT to drive `notify()` against
structured `NotificationMessage` fixtures while gating two assertions in the
soon-to-be-deleted msg-rule-registry test.

The catalog UAT test scaffolding is generally sound -- the parser is preserved
verbatim from v1, the FIXTURES map exhaustively covers all 48 in-scope catalog
states, the per-iteration mock-ctx isolation is correct, and severity-arg
assertion lines up with the SNM-31 byte-equality + Pitfall-6 severity-shape
gate. Bytes-equality invariants traced through several representative cases
(`partial`, `failure-rollback-partial`, `unparseable-mp`, `enable-mixed`,
`failure-unsupported-features`, `(no marketplaces)`) match the
`extensions/pi-claude-marketplace/shared/notify.ts` v2 renderer exactly.

The msg-rule-registry test correctly gates only the assertions that the v2.0
guide breaks (Tests 2 and 4) via `t.todo()`; Test 1 remains active and still
passes against the 6 surviving MSG-* IDs.

The most significant defect is a doc/code divergence: both the catalog and the
style guide assert that the renderer emits `[<scope>]` "only in the orphan-fold
case" -- but the renderer (`renderScopeBracket`) emits the bracket whenever
`p.scope` is set, with no comparison against `mp.scope`. The
`project-orphan-folded` test fixture's own inline comment acknowledges this
divergence and works around it by setting `scope` on both rows. Reviewers and
future call-site authors will be misled by the spec text. Secondary defects:
stale "see section N" cross-references from the v1.0 style guide that were not
updated for v2.0, a parser-test sample that mixes v1 wording (`(no plugins)`)
into v2 territory, and a `loadCatalogExamples: returns no examples` test that
exercises the `## /claude:plugin list` path but never exercises the
`Manual recovery anchors` fallback branch.

Performance / O(n^2) concerns are out of v1 scope and not flagged.

## Critical Issues

### CR-01: Doc/code divergence on per-row scope bracket -- "orphan-fold only" claim is false

**Files:**
- `docs/output-catalog.md:39-40, 44-46`
- `docs/messaging-style-guide.md:73`

**Issue:** The catalog and style guide both bind the user contract for the
per-plugin-row `[<scope>]` bracket emission. Three places state:

- `output-catalog.md:39` -- "`[<scope>]` -- emitted ONLY in the orphan-fold case
  (plugin's `scope` field is explicitly set AND differs from the marketplace's
  scope). Same-scope rows omit the bracket because the header carries it."
- `output-catalog.md:44-46` -- "The plugin-row `[<scope>]` bracket is emitted
  ONLY when the plugin's `scope` field is set and differs from the parent
  marketplace's scope (the orphan-fold case per D-16-17). Same-scope rows
  inherit the marketplace's scope from the header and omit the bracket."
- `messaging-style-guide.md:73` -- "A plugin row emits `[<scope>]` only when its
  `scope` differs from the parent marketplace's `scope` (orphan-fold case per
  D-16-17). Same-scope plugins inherit the marketplace's scope from the header
  and omit the bracket."

The renderer at `extensions/pi-claude-marketplace/shared/notify.ts:624-626`
(`renderScopeBracket`) does NOT implement this comparison:

```ts
function renderScopeBracket(scope: Scope | undefined): string {
  return scope === undefined ? "" : `[${scope}]`;
}
```

The renderer emits the bracket whenever `p.scope` is set, regardless of whether
it equals `mp.scope`. The catalog-uat test fixture `project-orphan-folded`
(catalog-uat.test.ts:282-314) explicitly works around this by setting
`scope: "user"` on the same-scope row (and notes inline: "Without the explicit
scope, the user-scoped alpha row would emit no bracket -- catalog renders both
with brackets.") -- this is the smoking gun that the doc-claimed semantics are
not the renderer's actual behavior.

Concrete consequences:
1. The spec misrepresents the binding contract. Phase 18-20 call-site authors
   reading the style guide will assume the renderer compares `p.scope` to
   `mp.scope` and may always set `p.scope` (thinking the renderer will
   filter), producing extra brackets in user output.
2. The orphan-fold behavior is actually an orchestrator responsibility, not a
   renderer responsibility, but the doc does not say so.
3. The "binding contract" framing in messaging-style-guide.md is undermined --
   a future regression where the renderer drifts to match the docs would pass
   the UAT (because the catalog never asserts a state where the discrepancy
   would surface; the `project-orphan-folded` state has explicit `scope` on
   both rows) yet still break call sites that relied on the documented
   "renderer filters same-scope" behavior.

**Fix:** Choose one and apply consistently:

Option A (recommended) -- align docs with renderer behavior and surface the
orphan-fold detection as an orchestrator obligation:

```markdown
### Conditional plugin-row scope bracket

The plugin-row `[<scope>]` bracket is emitted by the renderer iff the plugin's
`scope` field is set; the renderer does not compare against the parent
marketplace's scope.

Orchestrator obligation (D-16-17 contract surface): orchestrators MUST omit
`p.scope` on plugin rows whose scope equals the parent `mp.scope`, and MUST
set `p.scope` on plugin rows whose scope differs (the orphan-fold case). The
`available` and `unavailable` variants have no `scope` field by construction
(SNM-11) and structurally cannot carry the bracket regardless of orchestrator
choice.
```

Option B -- move the comparison into the renderer (`renderScopeBracket` would
take both `p.scope` and `mp.scope`, or the per-arm `renderPluginRow` switch
would pass `p.scope === mp.scope ? undefined : p.scope`). This breaks the
`project-orphan-folded` fixture's same-scope row that currently relies on the
"renderer always emits when set" behavior; the fixture's explicit comment
would need to be deleted and the fixture would need to drop the explicit
`scope: "user"` on the same-scope row.

Option A is lower-risk and matches the renderer that already shipped Phase 16.

---

## Warnings

### WR-01: Stale v1.0 section cross-references in messaging-style-guide.md ES-5 table

**File:** `docs/messaging-style-guide.md:130-138`

**Issue:** The ES-5 supersession table was carried forward from the v1.0 guide
verbatim, but its cross-references point at v1.0 sections that no longer exist
in the v2.0 guide. Concretely:

- Line 132: "see section 6, MSG-SD-1" -- v2.0 has no "section 6".
- Line 133: "see section 6, MSG-SD-1" -- same.
- Line 134: "see section 5, MSG-RH-1" -- v2.0 has no "section 5".
- Line 135: "see section 7, MSG-MR-1 / MSG-MR-2" -- v2.0 has no "section 7".
- Line 136: "see section 8, MSG-RP-1" -- v2.0 has no "section 8".
- Line 138: "The compact-line grammar of section 1 and the severity-wrapper
  rules of section 10 govern every emission via `ctx.ui.notify`; the
  legacy-migration `console.warn` retains sentence form per section 14." --
  v2.0 has no sections 1, 10, or 14.

The v2.0 guide is sectioned as Overview / Type Model Reference / Output Grammar
Summary / Severity Routing / ES-5 Supersession Table / Cross-References. None
of the referenced "section N" anchors exist.

**Fix:** Either delete the broken cross-references (the MSG-* IDs alone are
sufficient anchors against `shared/notify.ts`) or rewrite them to point at the
v2.0 section names. Example:

```markdown
| `pi-subagents is not loaded; …` | `{requires pi-subagents}` reason on the affected line (rendered by `composeReasons` at `shared/notify.ts:683`; see "Output Grammar Summary" above) |
```

Also rewrite line 138's "compact-line grammar of section 1 and the
severity-wrapper rules of section 10" to reference the v2 type model and the
Severity Routing section above.

### WR-02: Parser sanity-test sample uses v1-only body text under a v2 catalog-state section

**File:** `tests/architecture/catalog-uat.test.ts:1437, 1463`

**Issue:** The `loadCatalogExamples: returns no examples when the catalog has
no annotations` and `loadCatalogExamples: pairs each discriminator with its
next fenced block` tests use the body text `(no plugins)` inside a
`## /claude:plugin list` section. The v2 catalog never emits `(no plugins)` --
that string is one of the v1.0 dropped surfaces (documented at
`output-catalog.md:86`, "The v1 `(no plugins)` body line under a per-marketplace
block is dropped"). The v2 sentinel is `(no marketplaces)`.

Future maintainers reading these parser-tests may believe `(no plugins)` is
still a valid v2 catalog body. The tests don't assert on the FIXTURES map (so
they don't break), but the choice of test data muddies the v1-vs-v2 boundary.

**Fix:** Replace `(no plugins)` with `(no marketplaces)` in the parser
sanity-test samples, or use a clearly synthetic placeholder like `<expected>`
to signal that the parser doesn't care about body content.

### WR-03: Parser fallback `manual-recovery-anchors` branch has no unit-test coverage

**File:** `tests/architecture/catalog-uat.test.ts:113-114, 1442-1465`

**Issue:** The catalog parser handles two H2 section shapes:

```ts
const sectionRe = /^## (`(\/claude:plugin [^`]+)`|Manual recovery anchors)\s*$/;
...
currentSection = sectionMatch[2] ?? "manual-recovery-anchors";
```

When the H2 is `## Manual recovery anchors`, `sectionMatch[2]` is undefined
(the inner capture group is only populated for the backtick-wrapped alternative),
and the code falls back to the literal string `"manual-recovery-anchors"`. The
parser-sanity test at line 1442 only exercises the backtick-wrapped path. A
regex tweak that breaks the fallback (e.g. accidentally swapping the
alternation to capture inside both arms) would not be caught by the unit tests
-- it would only surface as a missing-fixture failure in the driver loop.

**Fix:** Add a third parser-sanity test that constructs a sample with
`## Manual recovery anchors` + a catalog-state annotation + a fence body,
and asserts `example.section === "manual-recovery-anchors"`.

### WR-04: Catalog states under `## Usage errors` are silently dropped by the parser

**File:** `docs/output-catalog.md:919-933` / `tests/architecture/catalog-uat.test.ts:113-118`

**Issue:** The catalog declares a `<!-- catalog-state: usage-error -->`
annotation under `## Usage errors`, but the section regex does not match that
H2. The parser's catch-all `line.startsWith("## ")` branch sets
`currentSection = null`, so the annotation + fence body pair is silently
dropped from the extracted examples list. The FIXTURES map has no
`usage-error` key by design.

This is not a test failure (the example is never returned, no missing-fixture
fault triggers), but it is a silent disagreement between the catalog (which
annotates the state, implying it is covered) and the test (which does not
cover it). The state-change motivation -- `notifyUsageError` has different
shape and severity from `notify`, and Phase 17 deliberately scoped the
catalog UAT to `notify()` only -- is undocumented in the test file.

**Fix:** Either:
(a) Add a comment in the parser explaining that `## Usage errors` is
    intentionally excluded because `notifyUsageError` has a different mock-ctx
    invocation shape and the test driver only handles `notify`'s 1-or-2 arg
    `ctx.ui.notify` calls, OR
(b) Delete the `<!-- catalog-state: usage-error -->` annotation from
    `output-catalog.md:923` to remove the false-positive coverage signal, OR
(c) Extend the parser to recognize `## Usage errors` and add a
    `usage-error` fixture that invokes `notifyUsageError` (full coverage --
    higher cost).

Option (a) is the minimum viable change to remove the implicit coverage claim.

### WR-05: Test driver casts away type-safety with `as never` on both ctx and pi

**File:** `tests/architecture/catalog-uat.test.ts:1363`

**Issue:** The driver calls:

```ts
notify(ctx as never, fixture.pi as never, fixture.message);
```

Both `ctx` and `fixture.pi` are mocked with structurally-incomplete shapes
(`{ ui: { notify: mock.fn() } }` and `{ getAllTools: () => MockTool[] }`),
neither of which assigns to the real `ExtensionContext` / `ExtensionAPI`
interfaces. The `as never` casts silence the type checker but lose the
type-safety the v1.4 surface is supposed to enforce. A future regression where
`notify()` starts calling a new `ctx.*` field (e.g. `ctx.session`) would not be
caught by this test -- the mock would be missing that field and the test would
crash at runtime with a confusing TypeError rather than a clear compile-time
miss.

**Fix:** Either type-narrow the mocks via interface intersection
(`MockCtx & Pick<ExtensionContext, "session">` etc., extending the mock as
the API surface grows), or extract a shared mock factory at
`tests/shared/notify-v2-mocks.ts` that returns the right structural shape and
use that helper here. The catalog UAT comment block at lines 140-141 already
acknowledges the "inline duplication of `tests/shared/notify-v2.test.ts`
lines 136-179 per RESEARCH.md Q1 Option 1 recommendation" so promoting the
mocks to a shared module is a documented future refactor.

### WR-06: `examples.length >= 30` lower-bound is brittle relative to actual coverage

**File:** `tests/architecture/catalog-uat.test.ts:1324-1327`

**Issue:** The catalog currently emits 48 in-scope examples after parsing (49
annotations minus the 1 dropped under `## Usage errors`). The driver asserts
only `examples.length >= 30`, allowing 18 examples to silently disappear
without the test reporting a coverage regression. Given that the failure mode
in mind ("the discriminator comments in docs/output-catalog.md were not lost")
is exactly the kind of mistake an exact-count check would catch immediately,
the `>= 30` lower bound is too loose.

**Fix:** Tighten to `examples.length === 48` (or whatever the current count
is) so any drop in catalog coverage fails the test loudly with a specific
diff. If the count is expected to grow as Phases 18-20 land, document the
expected current value inline:

```ts
assert.equal(
  examples.length,
  48,
  `Expected exactly 48 annotated catalog examples (12 commands + 1 manual-recovery section). Got ${examples.length}. If you added or removed a catalog-state annotation, update this value.`,
);
```

---

## Info

### IN-01: `piWithSubagentsLoaded` is dead code preserved via `void` discard

**File:** `tests/architecture/catalog-uat.test.ts:170-174, 1308-1312`

**Issue:** The helper `piWithSubagentsLoaded` is defined but unused; line 1312
holds a `void piWithSubagentsLoaded;` discard expression to suppress the
unused-symbol warning, with the comment "remains available as a composition
primitive for future states." This is dead code with a forward-looking
justification.

**Fix:** Either delete the helper now (re-add when a future fixture needs it
-- net cost is one inline function recreated later) or convert the comment
into a JSDoc `@deprecated` / `@unused` marker so the dead-code intent is
machine-readable. Keeping the `void` discard is acceptable; flagging it here
for visibility only.

### IN-02: First msg-rule-registry parity test lacks `(t)` parameter consistent with the other three

**File:** `tests/architecture/msg-rule-registry.test.ts:91-109`

**Issue:** Tests 2, 3, and 4 use the `(t)` callback signature so they can call
`t.todo()` for the v2-gated branches. Test 1 uses the bare `()` signature.
This is stylistically inconsistent and means Test 1 cannot be gated via
`t.todo()` if a future v2 change reduces the surviving MSG-* set further
(e.g. by removing all 6 IDs). Today Test 1 passes against the 6 v2 IDs, so
no behavior change is needed, but the inconsistency is a minor maintenance
hazard.

**Fix:** Change line 91's signature to `async (t) =>` for consistency with
the other three tests, even if `t` is not used today. Zero behavior change,
forward-compatible.

### IN-03: ADR section 14 reference (line 14) cites a removed v1.0 anchor

**File:** `docs/adr/v2-001-structured-notify.md:14`

**Issue:** The ADR's "Context" section says "the lint rules themselves require
RuleTester suites -- the linter has become a parallel codebase" and earlier
the same paragraph references "34 custom ESLint rules under `tests/lint-rules/`
... MSG-SR-1..7 ... MSG-IC-1..3 ... [etc.]". The MSG-* family enumeration is
historically accurate but the cross-reference to "PRD section 6.13 IL-2 (single
output channel via `ctx.ui.notify`) and IL-3 (single sanctioned `console.warn`
the load-time legacy migration save failure)" (line 14) implies the PRD
sections are still the canonical anchors. They are -- but the ADR's prose
mixes historical and current claims without flagging which is which. A reader
new to the project will not be able to distinguish "this MSG-* rule still
exists" from "this MSG-* rule is being deleted in Phase 21".

**Fix:** Add a one-line bracketed annotation to the MSG-* enumeration in line
14 noting that these IDs are slated for deletion in Phase 21 via SNM-24, e.g.:

```
... plus the 4-way registry parity test plus the byte-equality catalog UAT
runner. (Historical: all 34 MSG-* rules are slated for deletion in Phase 21
per SNM-24; the post-Phase-21 surface uses stock `no-restricted-syntax` per
the "Custom ESLint plugin deleted entirely" section below.)
```

Minor clarity improvement.

---

_Reviewed: 2026-05-26T12:52:04Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
