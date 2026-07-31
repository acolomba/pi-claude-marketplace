# Phase 89: Documentation reconcile - Context

**Gathered:** 2026-07-31
**Status:** Ready for planning

<domain>
## Phase Boundary

Bring the hooks documentation into line with the shipped v1.16 Stop/StopFailure
behavior. `docs/hooks-compatibility.md` flips the `Stop`/`StopFailure` rows to
supported, documents the turn-boundary timing-shift caveat, gains the
StopFailure error-type matcher row, and has its stale hard-trip "Install-time
disposition" section rewritten for the force-install partial-partition model
(DOC-04). `docs/research/claude-hooks-vs-pi-events.md` retires the naive-table
"`agent_end` is observation-only" claim, adds `agent_settled` to the Pi event
inventory, and supersedes StopFailure's `after_provider_response` synthesis
with the `stopReason` protocol contract, with pointers to the issue-103
authority doc (DOC-05). Two small carried-in riders land here as well:
the issue-103 doc's `0.80.4` → `0.80.5` correction (D-87-05) and the
`docs/output-catalog.md` Stop-as-unsupported example re-point (D-87-06).

Docs-only phase: no production source changes. Runs sequentially
(non-worktree) per project convention for docs phases.

Requirements: DOC-04, DOC-05.

</domain>

<decisions>
## Implementation Decisions

### Version framing (user decision)
- **D-89-01:** **Remove milestone-version framing from
  `docs/hooks-compatibility.md`.** The title/intro prose drops "in v1.13";
  the `Pi v1.13` column headers become version-neutral (`Pi bridge` or
  `Pi`); body prose stops narrating which milestone introduced what. The
  doc describes the current bridge; git history carries lineage. Do NOT
  replace v1.13 with v1.16 — no milestone version anywhere in the doc.
  (Same spirit as the house source-comment policy: no version-history
  narration; requirement/decision IDs remain acceptable anchors.)

### Stop/StopFailure presentation (Claude's discretion, resolved)
- **D-89-02:** Both event rows flip to **✓** (not ⚠). Rationale: ⚠ in this
  doc marks contract restrictions a hook author must code around (e.g.
  PreCompact's match-all-only matcher); the timing shift is not
  hook-observable, so Stop meets the full hook-observable contract. The
  Stop row note references the timing shift; a short dedicated subsection
  (near the events table) documents the one irreducible divergence —
  upstream folds a blocked stop into the same turn, Pi re-enters as a new
  turn; same payload, flag cadence, and 8-block cap; transcript shows an
  extra turn boundary — with a pointer to
  `docs/research/issue-103-stop-stopfailure-promotion.md`. The matcher
  table gains the StopFailure error-type row (closed 10-value set,
  exact-match charset: letters, digits, `_`, `|`) and notes Stop's
  no-matcher disposition (non-empty matcher = reported `no-matcher-support`
  drop, UserPromptSubmit precedent).
- **D-89-03:** **No peer-floor mentions in user-facing docs** (resolves the
  D-87-02 rider). The `>=0.80.5` floor is extension-wide and declared in
  `package.json`; a per-event ">= 0.80.5" note would misrepresent a
  package-level constraint as per-event. README's hooks line ("Partial
  support" + link) stays as is.

### Reconcile breadth (user: "you decide, but full doc would be fine")
- **D-89-04:** **Full-doc audit of `docs/hooks-compatibility.md` against
  current code.** Every table row is verified against shipped v1.16
  behavior, not just the DOC-04-named edits. Known-stale items to correct:
  - `Stop`/`StopFailure` event rows + the "Event status classification"
    bucket lists (both leave "Deferred for engineering reasons").
  - "Install-time disposition" section: rewrite the "Hard install-time
    trip" model to the force-install partial-partition model —
    unsupportable hook events/matcher groups produce per-entry drops and
    `(partially-available)` with the single aggregate `{unsupported hooks}`
    brace (D-71-04), per-handler breakdown on the `info` surface (D-71-05);
    structural/malformed `hooks.json` remains a distinct `unavailable` arm.
    Authority: `docs/output-catalog.md` partial-hook entry (~line 390) and
    the resolver/`probe-classifiers.ts` behavior.
  - Inline `(unavailable) {unsupported hooks}` mentions elsewhere in the
    doc (matcher-syntax table note, tool-name mapping prose, handler-types
    row) reconciled to the same partial-partition model.
  - stdin/stdout table: `additionalContext` rows reflect that Stop now
    supports it (STOP-05); add/adjust rows for `stop_hook_active` and
    `last_assistant_message` payload fields and Stop's decision-control
    arms (block, exit-2, `continue: false` precedence) as the table shape
    warrants.
  - Verify remaining rows (env vars, handler fields, config surfaces,
    async/lifecycle) still match code; correct anything found stale.

### Research-doc editorial style (user decision)
- **D-89-05:** **Amend `docs/research/claude-hooks-vs-pi-events.md` by
  correcting in place.** No strikethrough, no preserved-history
  "superseded" relics — history lives in git. Edit so the doc is
  internally consistent after the corrections:
  - Cross-mapping `Stop` row: retire "`agent_end` is observation-only /
    cannot honor block" — now `agent_settled`-dispatched with full
    decision control; point to the issue-103 doc.
  - Cross-mapping `StopFailure` row: replace the `after_provider_response`
    synthesis with the `stopReason` protocol contract (`error`/`length`
    endings; `errorMessage`-based classification).
  - Pi event inventory: add `agent_settled` (inventory becomes 31; update
    the count prose where it becomes false).
  - Bucket tables/counts (naive summary, bucket-D synthesis table,
    feasibility totals, path-forward): correct every claim the v1.16
    shipping falsifies; the rest of the historical feasibility analysis
    stays intact where still accurate.
  - `after_provider_response` "no Claude analog" row note touched up
    (StopFailure no longer synthesizes from it).
  - Update the doc's date/status line to reflect the amendment.
  - Add pointers to `docs/research/issue-103-stop-stopfailure-promotion.md`
    where the superseded analysis now lives (DOC-05 requires the pointers).

### Carried-in riders (decided in Phase 87, land here)
- **D-89-06:** Correct the issue-103 doc's `agent_settled` version
  attribution `0.80.4` → `0.80.5` (D-87-05), noting the nuance: the
  upstream CHANGELOG attributes it to 0.80.4 but npm has no 0.80.4 release
  (0.80.3 → 0.80.5); the typings first ship in 0.80.5 (verified by tarball
  type-def diff). Touch every 0.80.4 mention in that doc (executive
  summary, cost line, sources table, Pi API surface section).
- **D-89-07:** Re-point `docs/output-catalog.md`'s partial-hook example
  prose "a non-bucket-A event such as `Stop`" (~line 390) to a
  still-unsupported event (e.g. `Notification`), matching the D-87-06 test
  re-point. Check whether any catalog example *bytes* containing Stop are
  pinned by catalog-UAT before editing; keep edits minimal and byte-safe.

### Claude's Discretion
- Exact wording/placement of the timing-shift subsection and row notes.
- Whether the Stop no-matcher disposition gets its own matcher-table row
  or a note on the events row (match the doc's existing shape).
- Which still-unsupported event replaces Stop in the output-catalog example.
- How the research doc's amended date/status line is phrased.
- Row-level judgment calls during the full-doc audit (add vs annotate),
  keeping tables consistent with their existing column shapes.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Authority analysis (issue #103)
- `docs/research/issue-103-stop-stopfailure-promotion.md` — THE design
  authority: § Dispatcher design (stopReason gate, decision control, Stop
  payload, StopFailure arm), § The one irreducible divergence (timing
  shift), § Stale-doc inventory (the exact reconcile list this phase
  executes). Also itself a target: D-89-06's 0.80.4 → 0.80.5 correction.
- `.planning/REQUIREMENTS.md` — DOC-04, DOC-05 rows; STOP/SFAIL/ADMIT/FLOOR
  requirement texts describe the shipped behavior the docs must state.

### Shipped-behavior ground truth
- `.planning/phases/88-agent-settled-dispatcher-stop-contract-stopfailure/88-CONTEXT.md`
  — locked dispatcher decisions incl. D-88-08 (cap counts ALL bridge
  re-entries — block AND additionalContext; supersedes the naive
  blocks-only reading; docs describing the cap must match).
- `docs/output-catalog.md` — partial-hook entry (~line 390): the precise
  current install-time disposition model (D-71-04 aggregate brace,
  D-71-05 info breakdown); also the D-89-07 edit target and the
  "Stop hook override cap reached" entry (STOP-07/D-88-01) describing
  shipped cap behavior.
- `extensions/pi-claude-marketplace/domain/components/hook-events.ts` —
  BUCKET_A_EVENTS (10), NON_TOOL_EVENT_FIELDS dispositions,
  NON_TOOL_EVENT_CLOSED_SETS.StopFailure (the 10-value vocabulary).
- `extensions/pi-claude-marketplace/bridges/hooks/settle.ts` +
  `bridges/hooks/wire-protocol.ts` — shipped dispatcher/decision-control
  behavior the compatibility tables must reflect.

### Upstream contract
- <https://code.claude.com/docs/en/hooks> — Stop/StopFailure contract
  (verified 2026-07-28): stop_hook_active, 8-block cap, exit-2,
  continue:false precedence, observation-only StopFailure, matcher
  vocabularies.

### Edit targets
- `docs/hooks-compatibility.md` — DOC-04 (full-doc audit per D-89-04).
- `docs/research/claude-hooks-vs-pi-events.md` — DOC-05 (correct-in-place
  per D-89-05).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `docs/output-catalog.md` partial-hook + cap-warning entries — canonical
  prose for the disposition model and cap semantics; reuse phrasing rather
  than re-deriving.
- `docs/research/claude-hook-config-syntax.md` — v1.13 field reference;
  cross-check only, not an edit target unless the audit finds a falsified
  claim.

### Established Patterns
- House doc/comment policy: no phase/milestone-version narration; decision
  IDs (D-71-04, D-88-08) and requirement IDs (DOC-04, STOP-07) are
  acceptable anchors; git carries history.
- Catalog byte-equality: `docs/output-catalog.md` literal example blocks
  are byte-locked by catalog-UAT (`tests/uat/catalog-uat.test.ts`) and
  `tests/architecture/hooks-cap-notify.test.ts` — D-89-07 edits must not
  break byte pins (prose is safe; literal blocks need matching test
  updates if touched).
- `npm run check` must stay green (NFR-6) — docs phases still run the full
  gate because catalog/architecture tests read doc bytes.

### Integration Points
- README.md links to `docs/hooks-compatibility.md` ("Hooks. Partial
  support.") — remains accurate; no edit (D-89-03).
- The issue-103 doc's § Stale-doc inventory enumerates exactly the two
  DOC-04/DOC-05 targets — after this phase that section should read as
  "reconciled", not leave dangling future-tense claims (small consistency
  touch within D-89-06's edit pass).

</code_context>

<specifics>
## Specific Ideas

- The timing-shift caveat wording exists nearly final in the issue-103 doc
  § "The one irreducible divergence" — adapt, don't re-derive.
- Disposition rewrite target model: unsupportable hook events/matcher
  groups → per-entry drops, plugin resolves `(partially-available)` with
  ONE aggregate `{unsupported hooks}` marker; per-handler
  `event(matcher) (unsupported)` breakdown on `plugin info`; malformed
  `hooks.json` (structural) stays `unavailable` — three distinct arms, do
  not conflate.
- StopFailure matcher row values: `rate_limit`, `overloaded`,
  `authentication_failed`, `oauth_org_not_allowed`, `billing_error`,
  `invalid_request`, `model_not_found`, `server_error`,
  `max_output_tokens`, `unknown`; `length` → `max_output_tokens`
  deterministic; `unknown` is the documented classifier fallback.

</specifics>

<deferred>
## Deferred Ideas

- Full re-basing of the research doc's feasibility projections onto v1.16
  (recounting every bucket total against today's 10 shipped events beyond
  what consistency requires) — only claims falsified by the shipping are
  corrected; the doc remains a dated research note.
- `docs/research/claude-hook-config-syntax.md` refresh — cross-check only
  this phase; a full refresh is future work if the audit reveals drift.
- UPSTREAM-SETTLE (erasing the timing shift) — v2, tracked in
  REQUIREMENTS.md.

### Reviewed Todos (not folded)
- "Coverage sweep: test rare failure arms in update/reinstall/install"
  (`.planning/todos/pending/2026-06-12-coverage-sweep-test-rare-failure-arms-in-update-reinstall-in.md`)
  — keyword-only match (score 0.6), already reviewed and left pending in
  Phase 87; install/update failure-arm test coverage is unrelated to a
  docs-reconcile phase.

</deferred>

---

*Phase: 89-documentation-reconcile*
*Context gathered: 2026-07-31*
