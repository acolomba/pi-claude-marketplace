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

### Claude's Discretion

- Plan and task decomposition; the exact spelling of the gate names in the closed
  union; the wording of each warning phrase in both tenses; the precise shape of
  the totality construct.

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
