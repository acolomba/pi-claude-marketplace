# Phase 1: Presentation Model - Context

**Gathered:** 2026-09-28
**Status:** Ready for planning

<domain>
## Phase Boundary

Every presentation decision for structured notifications is computed once, in a
resolve step upstream of rendering. That includes severity, `needsReload`,
tally, summary line, hints, and the final reasons list with the
`{requires ...}` markers. The resolve step also serializes failure detail. The
text renderer then formats the result. It no longer calls `softDepStatus`, no
longer takes a probe, and no longer walks `Error` objects. Its bytes do not
change.

Requirements: PMOD-01, PMOD-03. The redaction half of PMOD-03 ("redacted cause
chain") lands in Phase 4 under PMOD-04. Phase 1's cause-chain text is
byte-identical to the baseline.

Out of this phase:

- The full row-policy map and the deletion of the render callbacks (Phase 2).
- Typed raw surfaces (Phase 3).
- The wire schema and the JSON strategy (Phase 4).
- `ctx.mode` and `appendEntry` (Phase 5).
- `invocationId` and the command id (Phase 6).

**Upstream contract:** none applies. This phase is internal presentation
plumbing with byte-identical text, so no Claude Code position exists and
recommendations come from Pi and project constraints (per
`skills/claude-code-compat-research`).

</domain>

<decisions>
## Implementation Decisions

### Wire-corpus baseline (first plan of the phase)

- **D-01:** Capture with a **committed loader-hook tool**. A `scripts/` tool
  runs the unit and integration suites under a Node `--import` loader hook. The
  hook rewrites every `X.ui.notify(` call in `extensions/**` into a recorder at
  load time. IL-2's single-site ban (only `shared/notification-dispatch.ts`
  calls `ctx.ui.notify`) makes the match exact, and it survives file splits and
  renames in Phases 1–3. No production seam is added
  (`no-test-only-production-surface.test.ts` stays satisfied). The tool must be
  re-runnable with one command at every phase end through Phase 7, and it is
  removed at milestone close. — **Reversibility:** reversible — tooling only,
  deleted at close.
- **D-02:** **Diff rule is a per-file multiset, baseline ⊆ now.** Each test
  file maps to a multiset of `(message, severity, argc)` entries, where `argc`
  is the `ctx.ui.notify` argument count. Every baseline entry must still appear,
  with its multiplicity, in the same file's re-capture. Entries that exist only
  in the new capture are allowed but listed for review. A changed byte therefore
  shows up as a missing baseline entry, and the diff fails. Test insertions and
  reordering inside a file do not cause false alarms.
- **D-03:** **The baseline is a committed planning artifact** under
  `.planning/phases/01-presentation-model/`. The re-diff is a named
  verification step at each phase end (in the phase's plans and in the
  verifier's must-haves). It is **not** added to `npm run check`. The durable
  byte lock stays `docs/output-catalog.md`. Phase 4's PMOD-04 redaction is the
  only sanctioned difference, and that phase states it explicitly.
- **D-04:** **Non-vacuity has two guards.** A companion `*.negative` script,
  following the house `scripts/*.negative.mjs` pattern, plants a one-byte drift
  in a scratch copy. It asserts that the diff exits non-zero and names the
  file. The diff also refuses a capture whose total emission count is below
  the baseline's. Both run in Phase 1 and again whenever the tool changes.

### Probe snapshot plumbing

- **D-05:** **The command takes the snapshot and passes it.** Each command run
  calls `softDepStatus(pi)` exactly once. The same snapshot feeds
  `companionSeverity` (severity stamping stays with the producers, per the
  recorded "notify is a dumb renderer" preference) and the notify family. The
  snapshot replaces today's `pi` argument in the notify-family signatures,
  about 80 calls in 40 files: `notify`, `notifyWithContext`,
  `emitContextCascade`, `emitUpdateNoOpCascade`,
  `emitReconcileAppliedContextCascade`, and the update-cascade emitter.
  Multi-emission commands (the info failure loops, import cascade plus
  diagnostics, reconcile cascade plus post-install warnings) probe once for the
  whole run. The strict `getAllTools()` pins in the 31 suites that use
  `tests/edge/notification-boundary.ts`, and in `catalog-uat/mock-pi.ts`, move
  from per-emission to per-command. — **Reversibility:** costly — reverting
  re-threads `pi` through ~80 call sites and their tests.
- **D-06:** **What replaces `pi` is a per-invocation object, not a bare
  `SoftDepStatus`.** In Phase 1 its only member is the soft-dep snapshot, which
  resolve reads. Phase 5 adds the entry sink, and Phase 6 adds `invocationId`
  and the machine command id. Each member lands with its first reader, so the
  unused-type-member gate holds, and the ~80 call sites are touched once. Later
  phases change only the construction sites. The name must not be `mode` or
  sit under `notifications`, because `opts.notifications?.mode ===
  "orchestrated"` already exists for another concept (`autoupdate.ts:419`,
  `add.ts:549`). — **Reversibility:** costly — the same ~80 call sites.
- **D-07:** **The object is built at the edge and lifecycle roots**, once per
  run: the `/claude:plugin` command handler, the `resources_discover` load
  pass, and the hook callbacks that emit. Orchestrators receive it. Nested runs
  share the parent's object: import with its N installs, and reconcile with its
  installs and uninstalls. That boundary is also Phase 6's `invocationId`
  boundary, so construction never has to move.
- **D-08:** SC-3's proof: a test whose `pi` probe answers differently on a
  second call shows that one snapshot drives both the severity stamp and the
  marker composition.

### Model shape

- **D-09:** **The model is internal readonly TS interfaces in `shared/`** (for
  example `shared/notification-model.ts` and `shared/notification-resolve.ts`;
  exact names at the planner's discretion). It is **not** typebox, and it is
  **not** the wire schema. Phase 4 authors the typebox wire schema and an
  explicit, total-map converter from the model to a DTO. As a result, internal
  refactors never become wire changes, and PITFALLS #10 holds by construction:
  JSON serializes a built DTO, never the model, and never with a replacer. —
  **Reversibility:** costly — merging model and wire later means rewriting both
  strategies' inputs.
- **D-10:** **The model carries the facts and the composed summary line.**
  Resolve computes count, subject, and severity, and it composes the English
  line with today's `summaryPhrase` / `buildSummaryLine` logic, moved out of
  text composition. The line is model data that the text strategy reads
  verbatim, and Phase 4's JSON will read it too (WIRE-05) without re-deriving
  English. The tally is numeric counts. Hints are ids, such as partial-install,
  partial-update, stale-gate-update, and enable. `needsReload` is a boolean.
  The text strategy composes the tally sentence, the hint trailers, and the
  `/reload to pick up changes` trailer.
- **D-11:** **Failure detail is serialized in resolve.** Producers keep putting
  the live `Error` in `NotificationMessage`, so the producer vocabulary does not
  change. Resolve walks it once, reusing today's `causeChainTrailer` /
  `manualRecoveryLeaks` semantics (`CAUSE_CHAIN_MAX_DEPTH = 5` in
  `shared/errors.ts`, including `CleanupContextError` link messages). It
  produces `causeChain: string[]` with a `truncated` flag, per-phase
  rollback-partial entries with serialized causes, and manual-recovery leaks as
  strings. No live `Error` reaches the renderer. Phase 4 adds PMOD-04 redaction
  at this single site.
- Text-only formatting stays in the text strategy: 66-column description
  truncation and wrapping, glyphs, scope-bracket elision, version display
  (`#sha7`, `v` prefix, arrows), the 4- and 6-space cause-chain indents, block
  separators, and the `(no marketplaces)` sentinel. The model keeps the full
  description, the real scope, and the raw versions (research ARCHITECTURE §2).

### Phase 1/2 seam

- **D-12:** **The per-verb marker suppression table is a marker-only policy on
  each `CommandContext`.** It is a total per-status `markers` switch, keeping
  the `as const satisfies CommandContext<...>` exhaustiveness anchor, and
  resolve reads it. The legacy central `notify()` path gets the equivalent
  default table. Phase 2 extends this same map with content-reason switches and
  the other divergences, so the data lands once, in its final home. The
  probe-to-marker derivation has its own owner test that states the table as
  data (SC-5). `tests/architecture/workflows-marker-coverage.test.ts` is
  re-pointed at the new derivation site, not deleted.
- **D-13:** **Render arms take resolved rows in Phase 1.** `RenderFn` becomes
  `(resolvedRow, mpScope) => string`. Arms receive final reasons from resolve
  and never see a probe, which meets SC-2 literally. The 70 direct render-arm
  test calls in 12 test files are updated now to pass resolved rows. Phase 2
  migrates them again, to policy and formatter asserts, when the arms are
  deleted. No probe-shaped adapter carries into Phase 2.

### Claude's Discretion

- Module names and the split between model, resolve, and text within
  `shared/` (no new top-level folder or zone).
- The capture tool's file layout and output format, how it identifies the test
  file per process, and newline normalization.
- The plan breakdown and migration order inside Phase 1, subject to these
  rules: the corpus baseline is the first plan; no intermediate commit leaves
  an export without a reader; `npm run check` is green after every plan.
- Where the SC-3 proof test lives.

### Research questions resolved by the orchestrator (2026-09-28)

These follow from the milestone invariants and the decisions above. They are
not new user decisions.

- **Frozen missing-arm row (RESEARCH Pitfall A):** preserve today's behavior.
  The guarded `severity = "error"` write in `dispatchRow` leaves a frozen row at
  info severity, and a test pins those bytes. Flooring every fallback row to
  error would change the corpus, and the milestone invariant forbids that.
- **Run-object root (D-07):** Option A. There is a single construction in the
  `/claude:plugin` command closure in `edge/register.ts`, plus the
  `index.ts` `resources_discover` pass.
- **Hooks (D-07 refinement):** hook callbacks get no run object in Phase 1.
  Their only emissions are raw surfaces that read no snapshot, so the object
  reaches them when its first reader there lands (Phase 5 sink or Phase 6
  `origin`/`invocationId`). This follows the rule that a type member lands with
  its first reader.
- **Node version:** the baseline meta records the Node version. The re-diff runs
  locally on the same major version. A CI-vs-local message difference is not
  part of this phase's gate.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Milestone scope and locked decisions

- `.planning/ROADMAP.md` — Phase 1 goal, success criteria 1–5, the research
  flag, and the milestone invariants.
- `.planning/REQUIREMENTS.md` — PMOD-01, PMOD-03 (and PMOD-02, PMOD-04, WIRE-05
  for the seams this phase must leave room for).
- `.planning/PROJECT.md` — Current Milestone section (goal and verified Pi
  facts); Constraints (IL-2 as amended by D8, NFR-2, NFR-6).
- `.planning/research/SUMMARY.md` — locked decisions D1–D8 as recorded, and the
  reconciled build order.

### Research this phase depends on

- `.planning/research/PITFALLS.md` — Pitfall 2 (byte drift, per-verb
  non-uniform arms, marker position in the brace, whitespace folds; its partial
  suppression list), Pitfall 9 (named-file gates to re-point), Pitfall 10
  (type-member pins, JSON serialization reads, declared-before-read),
  Pitfall 11 (complexity, dead-code, dupes, zones, 100% coverage).
- `.planning/research/ARCHITECTURE.md` — §2 per-verb renderers and the
  derivation table, §3 render-time probes, §4 gates and tests that must change.

### Byte-lock and gate contracts

- `docs/output-catalog.md` — the text byte lock; must diff empty.
- `tests/architecture/catalog-uat/catalog-contract.test.ts` — the pins
  `EXPECTED_STATE_COUNT = 205` and `EXPECTED_UTF8_BYTES = 26_619` must not move.
- `docs/messaging-style-guide.md` — closed sets and marker order (MSG-GR-4).
- `docs/unused-type-member-gate.md` — what counts as a read; how pins behave.
- `tests/architecture/workflows-marker-coverage.test.ts` — re-point, never
  delete.
- `tests/architecture/no-probe-in-workflows-bridge.test.ts` — the model
  builder must live above `bridges/`.
- `tests/architecture/no-test-only-production-surface.test.ts` — why the corpus
  hook is external tooling.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- `softDepMarkers` (`shared/concerns/soft-dep.ts:54`) is already pure given a
  probe, with the canonical order agents, mcp, workflows. Resolve calls it with
  the command's snapshot.
- `companionSeverity` (`shared/notify-reasons.ts:84`) is pure given a probe.
  It is fed the same snapshot (D-05).
- `summaryPhrase` and `buildSummaryLine` (`shared/notification-summary.ts`
  ~:302, ~:370) hold the summary-line logic that moves into resolve (D-10).
- `composeTally`, `shouldEmitReloadHint`, and `foldTallyAndHint`
  (`notification-summary.ts`) split into facts (resolve) and joins (text).
- `causeChainTrailer` and `manualRecoveryLeaks` (`shared/errors.ts:149`,
  `:598`) are the serialization semantics resolve reuses (D-11).
- `scripts/*.mjs` with `*.negative.mjs` companions is the house pattern for
  gate tooling (D-04).

### Established Patterns

- **Probes today:** render-time `softDepStatus(pi)` in
  `notification-dispatch.ts` at `:280` (`notify`), `:387` (`emitCascadeWith`),
  and `:433` (`emitUpdateNoOpCascade`). Severity-time probes are at
  `install-flow.ts:406`, `update-cascade.ts:190`, and `enable-disable.ts:1347`.
- **`CommandContext`** (`shared/notify-context.ts`) is data plus an
  `as const satisfies` pin: 19 consts across 16 `*.messaging.ts` files, 64
  status arms. D-12 adds the marker policy alongside `render`.
- Severity is caller-stamped per row, and the envelope takes the MAX (SEV-02).
  This is unchanged; resolve computes the envelope values.
- `emitWithSummary` is the one seam that performs `ctx.ui.notify` for
  structured kinds. It sends one argument at info severity and two otherwise
  (why D-02 records `argc`).

### Integration Points

- `tests/edge/notification-boundary.ts` (31 suites) and
  `tests/architecture/catalog-uat/mock-pi.ts` pin `getAllTools()` reads per
  emission. They change under D-05.
- Named-file gates to re-point (Pitfall 9): `NO_CONSOLE_EXEMPT_TARGETS`,
  `COMPAT_NO_EXPANSION_TARGETS`, `SCOPE_FENCE_TARGETS`, the ESLint per-file
  override for the dispatch module, `sonar.cpd.exclusions`, and direct imports
  in `hooks-cap-notify`, `notify-grammar-invariant`,
  `notify-will-reload-agreement`, `cross-surface-reason-parity`, and
  `workflows-marker-coverage`. The research flag asks for a full inventory
  before the first extraction plan.
- `scripts/check-unused-type-members.contracts.json` has line:col pins in
  `notification-*.ts`, `notify-context.ts`, `*.messaging.ts`, and
  `platform/pi-api.ts`. Re-pin after Prettier by shifting the line only.

</code_context>

<specifics>
## Specific Ideas

- Research flag (ROADMAP): before the first extraction plan, enumerate the
  per-verb soft-dep suppression table arm by arm, meaning which arms pass
  hard-coded `false` flags into `composeReasons`. PITFALLS Pitfall 2 has only a
  partial list (ENBL-15/ENBL-18 on `disabled`, MSG-SD-3 on `uninstalled`, the
  marketplace headers, `list`'s `partially-installed`). This enumeration is the
  source data for D-12's policy tables and SC-5's owner test.
- Marker position is part of the bytes: content reasons first, then markers.
  Never sort or dedupe the merged list (catalog state
  `success-with-orphan-rewake-and-soft-dep`).
- A catalog fixture changing in the same commit as the renderer is a warning
  sign (Pitfall 2). Fixtures that start carrying resolved data must be
  reviewed against the corpus diff, not just against the catalog.

</specifics>

<deferred>
## Deferred Ideas

None. The discussion stayed within the phase scope. The later-phase seams
(entry sink, `invocationId`, command id, row-policy extension, redaction) are
already scheduled in Phases 2–6 and are recorded above only as constraints on
Phase 1's shapes.

</deferred>

---

*Phase: 01-presentation-model*
*Context gathered: 2026-09-28*
