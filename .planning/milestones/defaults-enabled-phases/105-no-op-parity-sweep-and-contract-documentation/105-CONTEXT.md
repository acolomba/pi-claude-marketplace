# Phase 105: No-op parity sweep and contract documentation - Context

**Gathered:** 2026-08-15
**Status:** Ready for planning

<domain>
## Phase Boundary

The closing phase of the milestone. It does two things and no third:

1. **Proves the no-op.** A plugin whose manifest says `defaultEnabled: true`, or
   says nothing at all, behaves and renders exactly as it did before this
   milestone — across all six surfaces (install, update, reinstall, list, info,
   reconcile). This is the guarantee that the overwhelming majority of plugins
   were untouched by the four behavior phases.

2. **Writes the contract down**, reconciled against what actually SHIPPED rather
   than what was planned — including the divergences this milestone deliberately
   does not close, so a later reader can tell a stated limit from an oversight.

**No new behavior.** No production behavior change is in scope except the
deletions and doc corrections named explicitly below. If the sweep uncovers a
real parity break, that is a finding to surface, not a feature to build.

**Out of scope:** DFEN-V2-01 (honoring the dependency-requirement override) stays
blocked on PDEP-01. DOC-02 exists precisely to make that visible.

</domain>

<decisions>
## Implementation Decisions

### Scope of the DFEN-08 Parity Sweep

- **Three surfaces need new coverage: `update`, `reinstall`, `reconcile`.** The
  other three are already covered and are not re-proven: `list` and `info` were
  proven at the notify layer in the previous phase
  (`tests/shared/notify-not-installed-reasons.test.ts` asserts absent-vs-empty
  byte-identity on both candidate arms), and `install` carries the D-103-01 case
  (`tests/orchestrators/plugin/install.test.ts:1231`).

- **Where the guarantee is STRUCTURALLY true, gate it with a source-level grep,
  not only a behavioral test.** This carries forward the Phase 103 decision
  verbatim: `update` and `reinstall` never read `defaultEnabled` today, so the
  gate should fail at the TOKEN, before a behavior exists to test. Pair the grep
  gate with a behavioral test rather than choosing between them — the grep proves
  the field is unreachable, the behavior proves the output is unchanged.

- **"Byte-identical to pre-milestone" is asserted as a self-contained triple, not
  against a recorded baseline.** One fixture carries three plugins — one
  declaring `defaultEnabled: false`, one declaring `true`, one silent — and the
  `true` and silent rows are asserted equal to each other and to the
  pre-milestone form in the same run. A snapshot file captured from the old tree
  would rot and would not survive the milestone archive.

- **Both the `true` case and the absent case are covered explicitly.** Phase 102
  recorded why: a precedence test over a three-valued key that only covers two
  values passes while the gate asks the wrong question. `entry.defaultEnabled !==
  undefined` and `entryDeclaresInstallDisabled(entry)` agree on `false` and
  disagree elsewhere.

### Contradictions Carried Out of the Previous Phase

These are inputs, not optional polish. All four were surfaced by the previous
phase's code review or by its verification, and each is a place where the
repository currently contradicts itself.

- **Amend `OUT-02` in `REQUIREMENTS.md`.** It currently says the token renders
  when the **resolved** `defaultEnabled` is `false`. The rule that shipped is
  narrower and has THREE inputs: the marketplace entry answers on the manifest
  side (`plugin.json` is deliberately never read on a read path), and the user's
  own `enabled` value in `claude-plugins.json` outranks it in EITHER direction.
  A requirement its own implementation violates is exactly what a phase scoped
  "reconciled against what shipped" must fix.

- **Give the entry-only divergence a requirement-level anchor.** Source comments
  currently cite `D-104-01`, a phase decision ID that archives with its phase.
  The DOC-02 write-up becomes its durable home; re-point the comments at it.
  (They previously cited `DOC-02` by mistake, which is the unrelated
  dependency-requirement override — that error is already fixed.)

- **Write the three-input precedence rule into the contract.** The catalog prose
  at `docs/output-catalog.md:380` already states it correctly; the contract
  document must agree rather than restate a two-input version. Include the
  deliberate consequence: a config-chosen `enabled: false` also renders the row
  BARE, because the token names the AUTHOR-declared cause only.

- **DELETE the hollow NFR-5 guard** in `tests/orchestrators/plugin/list.test.ts`
  (~`:2593`). It calls `readFile` on a directory, so its boolean is
  unconditionally `false`, and it runs BEFORE the call it means to constrain — it
  can never fail. Its correct sibling now exists beside it, so a guard that
  cannot fail is strictly worse than no guard: it reads as coverage. Deleting is
  preferred over repairing, because the repair already exists.

### Contract Documentation: Home and Closure

- **DOC-02 lands in a NEW `docs/plugin-enablement.md`** that owns the enablement
  contract end to end, carrying a `## Divergences and documented absences`
  section. This copies the established house pattern at `docs/env-vars.md:129`
  verbatim in spirit: that section is "the single citable home for a caveat …
  the caveat text is not duplicated elsewhere." Both divergences live there —
  the dependency-requirement override (PDEP-01) and the entry-only read rule.

- **DOC-01 has exactly two gaps left.** The token blocks themselves landed in the
  previous phase. What remains:
  1. `reinstall`'s `(skipped) {already disabled}` row has no catalog block
     (carried from Phase 103's backlog).
  2. The `(available)` token-table row was not updated alongside `(remote)`
     (previous phase's review finding IN-01).
  Do not re-audit the whole catalog; it was reconciled one phase ago.

- **Close all four open Info findings** from `104-REVIEW.md` (IN-01..IN-04). They
  are documentation and type-precision items, this is the documentation phase,
  and IN-01 is already DOC-01 scope. IN-04 is the one with a type dimension:
  `installsDisabledField` is typed off `PluginAvailableMessage` while also being
  spread into a `PluginRemoteMessage` literal.

- **Criterion 4 rides the EXISTING
  `tests/architecture/compat-01-no-expansion.test.ts` unchanged.** It already
  pins all four closed sets by enumeration equality, every glyph code point with
  an eighth-glyph tripwire, the install record's key set, the state schema
  version union, and the network clause. The criterion is that test continuing to
  pass with exactly one intended `REASONS` delta (`installs disabled`, appended
  at the tail). Assert that fact; do not build a second no-expansion test beside
  it.

### Claude's Discretion

- Plan/wave decomposition and how the doc work is split from the test work.
- The internal section structure of `docs/plugin-enablement.md`, beyond the
  required `## Divergences and documented absences` section.
- Whether the three new parity tests live in their existing per-surface test
  files or in one new parity suite — provided each surface's assertion is
  individually legible in failure output.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets

- `tests/architecture/compat-01-no-expansion.test.ts` — 14 tests already holding
  every structural clause of criterion 4. Consumed as-is.
- `tests/shared/notify-not-installed-reasons.test.ts` — the previous phase's
  absent-vs-empty byte-identity proof for `list`/`info`; the model for the three
  new surfaces' parity assertions.
- `docs/env-vars.md:129` (`## Divergences and documented absences`) — the house
  pattern for divergence documentation, including its no-duplication rule.
- `docs/output-catalog.md` + `tests/architecture/catalog-uat.test.ts` — the
  byte-equality runner; a new catalog block must arrive with its fixture.
- `tests/orchestrators/plugin/install.test.ts:1231` — the existing DFEN-08 case,
  showing the assertion shape for "not rewritten by a defaultEnabled-true
  manifest".

### Established Patterns

- Closed sets are `as const` tuples with `(typeof X)[number]` unions; a new member
  must arrive with its catalog row, renderer arm and fixture in the same change.
- Source-level grep gates are a legitimate, precedented test form here for
  guarantees that hold structurally rather than behaviorally.
- Divergences get ONE citable home; other surfaces footnote it rather than
  restating it.

### Integration Points

- `.planning/workstreams/defaults-enabled/REQUIREMENTS.md` — the OUT-02 amendment.
- `docs/plugin-enablement.md` — new file.
- `docs/output-catalog.md` — two remaining gaps.
- `tests/orchestrators/plugin/{update,reinstall}.test.ts`,
  `tests/orchestrators/reconcile/apply.test.ts` — the three new parity tests.
- `tests/orchestrators/plugin/list.test.ts` (~`:2593`) — the hollow-guard deletion.

</code_context>

<specifics>
## Specific Ideas

- The milestone's own history is the argument for the grep gate: a phase scoped as
  characterization twice found live defects that reading had declared absent. A
  parity sweep that only READS the three uncovered surfaces would repeat that
  mistake. Run the surfaces; do not reason about them.

- House precedent for this phase's shape: v1.18 Phase 98 and v1.17 Phase 94 both
  landed the regression sweep and the contract reconcile LAST, after the behavior
  phases, so the docs describe shipped behavior instead of intent.

</specifics>

<deferred>
## Deferred Ideas

- **DFEN-V2-01 — honoring the dependency-requirement override.** Blocked on
  PDEP-01 (plugin `dependencies` are opaque and dropped entirely today). DOC-02
  documents the gap rather than half-building it.

- **The fourth flag-aimed config write** in `maybeWritePluginConfigBack`
  (`orchestrators/plugin/shared.ts`). Benign and pinned — its patch carries no
  field and runs only when the key is absent. Carried in the backlog, not this
  phase.

- **Re-auditing the whole output catalog.** It was reconciled one phase ago; only
  the two named gaps are in scope.

</deferred>
