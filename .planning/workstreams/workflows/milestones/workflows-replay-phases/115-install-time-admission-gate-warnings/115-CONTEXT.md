# Phase 115: Install-time admission-gate warnings - Context

**Gathered:** 2026-09-08
**Status:** Ready for planning
**Mode:** Smart discuss (autonomous) — all four grey areas accepted as recommended

<domain>
## Phase Boundary

A plugin author who ships a workflow script the host engine will refuse learns it
at install time, with the refusing gate named — and the install still succeeds,
every sibling script is unaffected, and no gate reading can ever block anything.

**In scope:** reading the unreplicated engine gates off the acorn AST
`admitWorkflowScript` already produces; a per-script warning naming the file and
the gate; the `replicate / warn / neither` restatement of the admit-versus-run
table in `docs/workflows-compatibility.md`; retracting that document's claim that
install-time warnings are deliberately not implemented; and pruning `WFLW-01`
from `.planning/BACKLOG.md`.

**Out of scope:** the supported-set-growth backfill (Phase 116, WCONV-01..03);
the live-UAT `agent()` measurement (Phase 117, WEVID-01..02); any change to the
two existing refusal paths; the version bump and CHANGELOG entry, which are
milestone-close work.

**This is the first of the three hardening phases.** The replay (109-114) is
complete and `docs/workflows-compatibility.md` is published. This phase changes
what that document says about itself, so the document and the behavior move
together or not at all.

</domain>

<decisions>
## Implementation Decisions

### Where the gate reading lives

- **The gate checks read the acorn AST `admitWorkflowScript` already produces.**
  WGATE-02 forbids a second parse, and `parseScript` already returns the AST,
  the comment ranges and the tokens from one `parse()` call. Anything a gate
  needs is already in hand; if a gate appears to need something that is not,
  that is a finding to report, not a licence to parse again.

- **The result rides on the ADMITTED verdict.** A warned script is admitted —
  it installs, its envelope is written, its command registers. So the warnings
  attach to `NamedWorkflow` / `StemFallbackWorkflow`, never to `SkippedWorkflow`
  or `RefusedWorkflow`. Putting them on a refusal arm would encode the opposite
  of WGATE-03.

- **The gate name is a closed set** — a literal union of the warnable gates,
  bound by a totality construct to the rows of the doc's admit-versus-run table,
  so a gate added to one and not the other fails to compile. **Run the negative
  control**: add a gate to one side only, confirm the tree goes red, restore,
  and paste the transcript into the SUMMARY. This milestone has shipped two
  guards that were green because they checked nothing, and one of them was a
  forcing construct that was unconditionally `never`.

- **A gate reading NEVER changes the verdict** (WGATE-03). It cannot refuse a
  script, cannot fail a plugin, cannot alter a status token, a glyph or a
  disposition. This is the whole reason the warn direction was chosen over the
  refuse direction: if a later engine relaxes a gate, the cost is one spurious
  warning that a reader can ignore, rather than a blocked install that only an
  extension release can clear. The strict direction does not self-correct.

### How the warning surfaces

- **Reuse the existing `warnings[]` accumulator.** `discoverPluginWorkflows`
  already returns one, `bridges/workflows/stage.ts` already threads it into both
  the staged and the failure arms, and `install` already renders it. No new
  plumbing, no second channel to keep in sync.

- **No new `REASONS` member, and certainly not seven.** Criterion 2 says no
  plugin-level status, glyph or disposition changes, and a token in the row's
  reasons brace IS a plugin-level rendering change — it moves the row's bytes
  and would drag the catalog byte gate with it. Per-script gate warnings ride
  the existing per-script line channel instead. Seven tokens would also blow a
  closed set that just reached 45 members.

- **Follow the `tense: "install" | "preview"` discriminant** Phase 113 added to
  `discover.ts`. Gate warnings need both tenses, and the phrase tables are
  already module constants there.

- **`info` shows gate warnings, in preview tense.** That is precisely where a
  plugin author looks before installing, and the phase's goal is that they learn
  it at install time or earlier. An install-only warning would tell them after
  the decision they wanted help with.

### Which gates, and how many

- **Re-derive the gate list from the 3.10.1 source AND the table Phase 114
  published. Trust neither the ROADMAP nor this document.** The ROADMAP's
  criterion 1 names six shapes in a sentence that says "seven". Phase 114
  measured nine checks total with two replicated, which does make seven
  unreplicated — but the six-item list is not the seven, and the discrepancy has
  to be resolved by reading, not by arithmetic.

  **This milestone's enumerations have been short five times running:** seven
  engine gates were nine; five `composeReasons` translation sites were six; two
  `piWithBothLoaded` definitions were four; seven closed-set amendment sites were
  eight; and the marker-coverage gate's seven-entry literal was bound to nothing.
  Every one was found by removing something and watching what went red. Assume
  this phase's enumeration is short until measured.

- **Not every unreplicated gate becomes a warning.** Criterion 4's `neither`
  column exists because some shapes cannot be detected without evaluating the
  script — a substituted template-literal `meta.name` is the clear case: the
  engine refuses it at its own check 8, and the bridge cannot resolve it without
  running the script. Warn on the structurally detectable shapes; record
  `neither` for the rest, with the reason stated in the table.

- **The two existing refusal paths are unchanged, and pinned.** A script acorn
  cannot parse is still refused whole with NO gate warnings attached — there is
  no tree to read the gates off, and attaching them would be inventing findings.
  A determinism-blocklist match is still refused by file with its existing
  four-way reason. The decision order in `admitWorkflowScript` is documented as
  load-bearing (determinism screens before the parse, and unparseable settles
  first because acorn partially fills its comment and token arrays before
  throwing); do not reorder it to make gate reading more convenient.

### Documentation and backlog

- **The admit-versus-run table's `Replicated by this bridge?` column becomes
  `replicate / warn / neither`,** one row per gate, and every row must agree with
  what the bridge actually does. A table that describes intent rather than
  behavior is the failure WGATE-05 exists to prevent.

- **`docs/workflows-compatibility.md` currently claims the opposite of this
  phase and must be corrected in the same change.** The sentence reading
  "Install-time warnings for these shapes are deliberately not implemented;
  replicating the engine's structural rules would make this extension refuse
  scripts for reasons a future engine release may drop" is now half wrong: the
  warnings ARE implemented, and the refusal concern is exactly why they are
  warnings rather than refusals. Rewrite the paragraph to say what is warned,
  what is not, and why the warn direction was chosen. Do not leave the old
  sentence standing with a note appended.

- **WDOCS-01 — prune `WFLW-01` from `.planning/BACKLOG.md`** under the file's
  existing pruned-footer convention, naming the milestone that closed it, so the
  backlog stops advertising shipped work as open. Follow the convention already
  in the file; do not delete the entry outright and do not invent a new footer
  format.

### Settled after research (orchestrator decisions, do not re-open)

Research measured the engine at 3.10.1 and ran the real `admitWorkflowScript`
beside the real `parseWorkflowScript` across 35 script shapes. It falsified two
claims written above. **Where these conflict with anything earlier in this file,
these win.**

- **D-115-01 — the warnable set is SIX gates, not seven, and the ROADMAP's list
  is wrong three ways.** Nine engine checks, two replicated, seven unreplicated.
  Six of those seven are warnable: checks 3, 4, 5, 6, 8 and 9. The ROADMAP's
  criterion-1 sentence names check 3 twice, names check 7, and omits check 6
  entirely. Build the gate list from the measurement, not from the criterion.

- **D-115-02 — check 7 is `neither` because it is UNREACHABLE, not because it is
  undetectable.** The engine's "declarator has an initializer" check is dead code:
  `export const meta;` is a `SyntaxError` acorn rejects at check 2 (measured
  output `Unexpected token (1:17)`), and every non-`const` form fails check 4
  first. So no reachable script can arrive there. Say that in the doc's Notes
  cell; `neither` earns its own reason and should not be confused with the
  "cannot detect without evaluating" case.

- **D-115-03 — the "needs evaluation" `neither` example written above is WRONG
  and must not reach the doc.** A substituted template-literal `meta.name` is a
  one-property AST test (`TemplateLiteral` with `expressions.length > 0`), and
  the engine's own `evaluateLiteral` decides it the same way. The bridge cannot
  *resolve* such a name, but it can name the gate perfectly. **Nothing in the
  seven needs evaluation.** The doc must not claim otherwise.

- **D-115-04 — the gate reader is first-failure-wins, in the engine's own check
  order.** A top-level `const meta` is unique in any parseable module (measured:
  a second binding is `Identifier 'meta' has already been declared`), which is
  what makes it safe for checks 8 and 9 to read `findMetaObject`'s object. But a
  reader that reports every failing gate would name gates the engine never
  reaches, because the engine stops at its first. Report the gate the engine
  would actually refuse at.

- **D-115-05 — standalone `install` drops workflow discovery warnings today, and
  this phase fixes it on BOTH `install` and `reinstall`.** `install.ts:1229`
  pushes to `bridgeWarnings`, which `collectPostCommitWarnings` gates behind
  `orchestrated` (D-19-01); `reinstall.ts:1062` drops the same array; only
  `update` reads it standalone. Adding a gate warning to that channel alone would
  satisfy WGATE-01's letter and fail on the verb the phase is named after.
  **Operator decision: reclassify both drop sites together**, so the four verbs
  behave uniformly and no three-way split is left behind. This widens the phase
  beyond gate warnings — it also surfaces the pre-existing discovery warnings on
  those two verbs — so pin the newly-visible output rather than letting it appear
  untested.

- **D-115-06 — criterion 2 is pinnable as a byte assertion, and must be pinned
  that way.** The install warning channel is a SECOND `ctx.ui.notify` call
  (`notifyDiagnostic`, severity `warning`), not a row mutation, and it carries no
  catalog state — so `catalog-uat` cannot redden from it. Assert the row bytes of
  a warned plugin are identical to those of an unwarned one, rather than assuming
  a separate notify call leaves them alone.

- **D-115-07 — `workflows-doc-pins.test.ts` will trip on the obvious rewrite.**
  Its lines 119-123 bar `/seven gates/i`, so the natural phrasing "the seven
  gates the bridge does not replicate" turns the tree red. Its count regexes are
  document-wide, so a second numbered table anywhere in the doc breaks the
  `[1..9]` deepEqual. Update the gate deliberately and state what changed and
  why; do not weaken an assertion to get green.

- **D-115-08 — the pruned footer cites `workflows-replay`.** Three artifacts
  disagree on which milestone closed `WFLW-01`. Name the milestone that actually
  re-landed the bridge on this branch — the work a reader can find in this
  repository's own history.

- **D-115-09 — one `neither` value per row, nuance in the Notes cell.** Do not
  split the column into "unreachable" versus "pre-empted by an existing
  skip/refusal". Three sub-arms of checks 6 and 9 are pre-empted; check 7 is
  unreachable. The column stays three-valued and the distinction is prose.

### Claude's Discretion

- Plan and task decomposition; the exact spelling of the gate names in the closed
  union; the wording of each warning phrase in both tenses; the precise shape of
  the totality construct; whether the check-8/9 gate line enriches the existing
  `unrunnableWarning` or adds a second line for the same file.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets

- `extensions/pi-claude-marketplace/domain/workflow-script.ts` — `admitWorkflowScript`
  and its `parseScript` (one `parse()` call yielding AST, comments and tokens),
  `findMetaObject`, and the verdict union `AdmittedWorkflow` / `SkippedWorkflow`
  / `RefusedWorkflow` with `SkippedCause` and `RefusedCause`. The header already
  documents the decision order as load-bearing.
- `extensions/pi-claude-marketplace/bridges/workflows/discover.ts` — the
  `tense: "install" | "preview"` discriminant and the two phrase tables Phase 113
  added, plus the `warnings[]` production site.
- `extensions/pi-claude-marketplace/bridges/workflows/stage.ts` — threads
  `discoverWarnings` into both the staged and the failure arms.
- `docs/workflows-compatibility.md` — the nine-check table Phase 114 published,
  already carrying a `replicates` column and per-row evidence grades.
- `tests/architecture/workflows-doc-pins.test.ts` — the gate Phase 114's nyquist
  audit added; it pins the nine-row table and the six-bullet list against the
  prose figures introducing them, and bars the retired `seven gates` phrase.
  **A change to the table will interact with this gate — read it before editing
  the doc.**

### Established Patterns

- Closed sets are pinned by order-and-length lock tests plus, where rendered, the
  catalog byte gate.
- Architecture gates verify by *planting* a violation, never by re-reading the
  rule's own configuration.
- No test-only seams: a dependency that is hard to test wants to be an explicit
  collaborator.
- Commands determine state and stamp severity and reasons; `shared/notify.ts` is
  a dumb renderer.

### Integration Points

- `domain/workflow-script.ts` — the gate reads and the closed union.
- `bridges/workflows/discover.ts` — the warning phrases in both tenses.
- `bridges/workflows/stage.ts` — the accumulator that carries them out.
- `orchestrators/plugin/info.ts` — the preview-tense surface.
- `docs/workflows-compatibility.md` and `tests/architecture/workflows-doc-pins.test.ts`.
- `.planning/BACKLOG.md` — the WFLW-01 prune.

</code_context>

<specifics>
## Specific Ideas

- The `meta.description` gap is described in the published doc as "the widest of
  the eight rows, because it is invisible to the author: a script that declares a
  perfectly good `meta.name` and no description installs, registers a command,
  and dies at first invocation." That is the single most valuable warning this
  phase can emit.
- Evidence base: Spike 027 (`.planning/spikes/027-workflow-engine-3-10-1-recheck/`)
  and the engine source at 3.10.1, `src/workflow.ts:1504-1564` for
  `parseWorkflowScript` and `:1611-1626` for `validateMeta`.

</specifics>

<deferred>
## Deferred Ideas

- Replicating the unreplicated gates as install-time REFUSALS — deliberately not
  done, and recorded in REQUIREMENTS.md's "Out of Scope" table: it only makes the
  bridge stricter than the engine, and the strict direction does not self-correct
  across engine upgrades.
- `WPIN-01`, a machine-checkable re-read of the vendored `DETERMINISM_BLOCKLIST`
  and the envelope internals against a newer engine — a future requirement, and
  the named subject of Broken Windows #34.
- The uncapped double read of every candidate script body on the `info` surface
  (code-review IN-02, deferred from Phase 113) — logged in `.planning/BACKLOG.md`.

</deferred>
