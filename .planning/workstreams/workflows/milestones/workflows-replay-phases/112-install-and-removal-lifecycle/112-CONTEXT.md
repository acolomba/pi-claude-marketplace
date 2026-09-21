# Phase 112: Install and removal lifecycle - Context

**Gathered:** 2026-09-05
**Status:** Ready for planning
**Mode:** Auto-generated (lifecycle wiring; the one open design choice is settled below against an existing house precedent)

<domain>
## Phase Boundary

Installing a workflow-bearing plugin writes its envelopes as a sixth ledger
phase that unwinds with the rest, and every removal path takes them away again.

**This phase is NOT a port.** Phases 110 and 111 checked their production code
out of `features/workflow-port-wip` verbatim. Nothing is ported here:
`orchestrators/plugin/update-row.ts` and the `"workflows"` widening of the
ledger `phase` union were deliberately left out of that branch, because main
rewrote the orchestrators they touch (`install.ts` 1243+/1222-, `reinstall.ts`
244+/715-). The spike branch is **reference for intent, not a source to copy**:
`git show features/workflows-spike:extensions/pi-claude-marketplace/orchestrators/plugin/install.ts`
reads it, but the wiring must be written against the current files.

**Out of scope:** update / enable-disable / reconcile and the `info` and `list`
read surfaces (Phase 113); the soft-dependency marker and
`docs/workflows-compatibility.md` (Phase 114); the admission-gate warnings
(Phase 115).

</domain>

<decisions>
## Implementation Decisions

### Criterion 6 — sweep, not report, and follow the existing GC

The ROADMAP says "swept **or** reported", leaving the choice open. Settle it as
**swept**, modeled on the existing house machinery rather than a new design:
`orchestrators/plugin/clone-gc.ts` already exports
`garbageCollectPluginClones(locations): Promise<string[]>` for exactly this
shape of problem — an accumulating cache directory the normal lifecycle does not
reach. Mirror its structure and its call-site placement.

**CORRECTION (from 112-RESEARCH.md, measured):** this paragraph originally said
to mirror "its return contract (the names it removed)". That is wrong.
`garbageCollectPluginClones` returns per-directory **rm-failure leak strings**
(`return leaks;`, line 109), and every call site discards the value. Mirror the
actual contract, not the one asserted here.

Research also found the precedent transfers only **halfway**: `clone-gc`'s
liveness signal derives from persisted `resolvedSha`/`resolvedSource`, and a
staging root has no analogue — it is a `randomUUID()` that is never persisted,
and `workflowsStagingDir` is scope-independent so the state lock does not
serialize access to it. The age bound is therefore **the entire liveness
mechanism**, not a refinement of the precedent, and no age/TTL constant exists
anywhere in `extensions/`. Treat it as new design with a borrowed shape.

Two constraints the ROADMAP states and the sweep must honor:
- **Age-bounded.** A concurrent install's fresh staging root must never be
  removed. The bridge has no view of which trees belong to a live transaction;
  this phase owns the ledger and is where that view exists.
- The tree holds **verbatim third-party executable JavaScript** under `$HOME`,
  outside every scope root. That is why it matters, and also why the age bound
  is load-bearing rather than a nicety.

If research shows the `clone-gc.ts` precedent does not transfer — different
liveness signal, different call site — say so with evidence and propose the
nearest alternative. Do not invent a bespoke sweeper while an analogous one
exists unexamined.

### Everything else

At Claude's discretion. Use the ROADMAP's seven success criteria, the Phase 111
artifacts, and the codebase conventions.

</decisions>

<code_context>
## Existing Code Insights

### The three wiring points, located

- **`runPhases` sole production call site** is `orchestrators/plugin/install.ts:1252`,
  building the literal array at `:1244-1248` (`skillsPhase`, `commandsPhase`,
  `agentsPhase`, `hooksPhase`, `mcpPhase`). `skillsPhase` is defined at `:921`,
  `mcpPhase` at `:1115` — those two bracket the shape a sixth phase must match.
- **The ledger `phase` union** is `shared/errors.ts:360`, currently
  `"skills" | "commands" | "agents" | "hooks" | "mcp"`, on `Phase3Failure`
  (consumed by `PluginUpdatePhase3Error`). Criterion 2 widens it.
- **`enable-disable.ts` reaches the same materialization** indirectly, through
  `runInstallLedger` exported from `install.ts` (its enable branch), not through
  `runPhases` directly. `update.ts` deliberately does NOT use `runPhases` — its
  header documents a heterogeneous-undo flow. `uninstall.ts` and `reinstall.ts`
  carry no ledger at all. Criterion 3 and 4 therefore each need checking
  individually; none is covered by the ledger change.

### The fallow allow-list edge Phase 111 deliberately left open

`.fallowrc.json` omits `"bridges-workflows"` from the `orchestrators` zone's
`allow` array. Phase 111 left it out on purpose — nothing imported the bridge
yet, so the edge was unverifiable. **The first orchestrator import in this phase
must add that one string in the same commit**, or `fallow dead-code`'s boundary
sub-gate fails on the new edge.

### What Phase 111 shipped that this phase consumes

`bridges/workflows/index.ts` exports the triplet:
`discoverPluginWorkflows`, `prepareStageWorkflows` / `commitPreparedWorkflows` /
`abortPreparedWorkflows`, and `unstagePluginWorkflows`.

Two contracts to respect, both established by Phase 111's review loop:
- `unstagePluginWorkflows` **accumulates ordinary I/O failures into `failed[]`
  but RAISES `PathContainmentError`**. That split is deliberate:
  `shared/path-safety.ts` says the class must never be folded into
  "rollback partial" lines, and `transaction/phase-ledger.ts:89,125` re-throws it
  by name — which is the exact slot this phase puts the function in. Do not
  re-fold it.
- `workflowArtifactPath` is **async**. A forgotten `await` yields a path leaf
  literally named `[object Promise]` rather than throwing.

### The version bump already landed, and its effect is this phase's

`EXTENSION_VERSION` is `0.19.0` (Phase 111, six sites). That opened the
`backfill.ts:76` early-return gate. But `backfill.ts:343` re-materializes
through `reinstallPlugin`, which gains no workflows phase until **this** phase.
Until criterion 4 lands, a user who `--partial`-installed a workflow-bearing
plugin on the released 0.18.1 still renders
`◉ helper (partially-installed) {unsupported component}`. This phase is what
makes that repair actually run.

### The gate chain and commit ritual are unchanged

`npm run check` runs `test:corresponding` **before** `npm test`, so a production
file landing without its 1:1 mirrored owner test fails there. `.git` is a file in
this worktree, so the trufflehog hook aborts structurally — run
`pre-commit run --files <paths>`, confirm with a **filesystem** trufflehog scan
(`--results=verified,unknown --fail`), then commit with `SKIP=trufflehog`, that
hook only. Never `--no-verify`, never `--amend`. The `prettier` hook rewrites
files mid-run and the commit still succeeds; check `git status` after each commit.

</code_context>

<specifics>
## Specific Ideas

**Criterion 1 is the one that matters most.** A later phase failing must leave
nothing behind — and that matters more here than for any other bridge, because
the envelopes live outside every scope root and no scope-root cleanup will ever
find them. Phase 111's review found two data-loss bugs in exactly this rollback
territory, both invisible under 100% coverage because the failing branches
executed and nothing asserted on the state they left. Write the undo tests to
assert on **disk state after the failure**, not merely that a rejection occurred.

**Criterion 5 is a process instruction, not a behavior.** "Written against the
current files, not transplanted from the spike branch" — the spike predates a
rewrite of `install.ts` and `reinstall.ts`. A plan that copies the spike's
version and adapts it is the failure mode this criterion names.

</specifics>

<deferred>
## Deferred Ideas

- Update, enable/disable, reconcile and the `info` / `list` read surfaces are
  Phase 113 (WLIF-04..06, WFLW-04). Phase 113 criterion 5 already carries the
  Phase 111 review's WR-09 (the warning channel is install-tense but documented
  as the source for the read-only `info` surface).
- The soft-dependency marker and `docs/workflows-compatibility.md` are Phase 114.
- `IN-06` from the Phase 111 review — a throwing `onPlaced` callback destroys the
  original error and every rollback leak. Adjudicated there as a non-blocking
  Info carry-forward with no carrier owed. If this phase's ledger wiring makes
  `onPlaced` throwable in practice, revisit it here rather than leaving it.
- `NAMEFOLD-01` (`.planning/BACKLOG.md`) — repo-wide generated-name case-folding
  exposure. Not this phase's.

</deferred>
