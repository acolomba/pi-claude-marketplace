# Phase 104: Workflow lifecycle completion - Context

**Gathered:** 2026-08-15
**Status:** Ready for planning
**Mode:** Smart discuss (autonomous) — recommendations recorded as accepted

<domain>
## Phase Boundary

Every remaining lifecycle verb keeps workflow artifacts in step with the plugin, so
nothing executable is ever left outside the scope root with no record tracking it.

**In scope:** `update` re-stages (adds, removes, replaces); `uninstall` removes every
artifact its install wrote, in both scopes; `reinstall` replaces them; `disable` removes
them and `enable` re-materializes them; and the lingering-command reload remedy is stated
to the user. Also in scope: the five findings the Phase 103 code review carried forward
onto these requirements (CR-02, CR-03, WR-01, WR-06, WR-10) — they are not separate work,
they ARE this phase's work, already scoped and diagnosed.

**Out of scope:** the `workflow_control` soft-dependency probe, the third `DEPENDENCIES`
member, write-anyway degradation, and the executable-code documentation contract — all
Phase 105 (WDEP-01..04, WDOC-01, WDOC-02).

**Why this phase is load-bearing rather than tidy-up.** Phase 103 shipped an install that
writes executable code OUTSIDE every scope root. Today `uninstall` orphans those files
permanently — `removePluginRecord` deletes the only inventory naming them — and `disable`
does not disable: the one component kind that executes code stays registered and runnable.
Until this phase lands, the milestone's install is a one-way door.

</domain>

<decisions>
## Implementation Decisions

### Removal wiring

- The sixth unstage lands in **`cascadeUnstagePlugin`** (`orchestrators/marketplace/
  shared.ts`), not per-verb. It is the single removal primitive behind `uninstall`,
  `disable` and `marketplace remove`, so one change gives all three the fix and makes it
  impossible for a future verb to inherit five-of-six. Its doc comment and its
  `UnstageOutcome` doc ("all FIVE bridges") both become false on that change and must be
  corrected in the same commit — a stale count is how the next reader re-introduces the
  gap.

- **`reinstall` does NOT inherit and must be wired separately.** It composes its own
  `prepareStage*` handle set (`skills`/`commands`/`agents`/`mcp`) and never routes staging
  through the cascade. Phase 103 taught it to carry `oldRecord.resources.workflows` forward
  through `resourcesFromHandles`, which preserves the RECORD while the artifacts on disk
  are never refreshed — a record that is honest about a stale disk. WLIF-05's own wording
  ("must each be checked individually rather than assumed covered by the `runPhases`
  change") is the rule; apply it to reinstall specifically.

- A workflow unstage failure is **reported through a structured error, never swallowed** —
  mirror the `AgentsUnstageFailureError` precedent, which carries its failures as readonly
  typed fields. The leftover file here is executable code; a silent failure is the worst
  available outcome.

- Unstaging an already-absent envelope is a **no-op, not an error**. The cascade's own
  contract states bridges are idempotent, and `uninstall` must stay safe to retry (NFR-3).

### Re-stage wiring

- The previous-name list is **`record.resources.workflows`** — the recorded inventory —
  for `update`, `reinstall` and `enable` alike. It is the only thing that names what the
  previous install actually wrote; deriving it from the new plugin version would miss
  exactly the removed and renamed cases criterion 1 exists to catch.

- **WR-01 and WR-06 land in the SAME change.** Wiring the recorded inventory (WR-01) and
  refusing a pre-existing unowned target (WR-06) are one unit: with `_previousNames` always
  empty, the refusal would reject every `enable` re-materialization of a plugin's own
  envelopes. Splitting them trades a silent overwrite for a broken `enable`. The commit
  path was already made safe for their arrival in Phase 103 — previous targets are
  displaced into staging and restored on failure rather than unlinked — so this is a wiring
  change, not a redesign.

- `update` materializes workflows **in the same position install uses — after `mcp`.**

  > **Corrected by research (2026-08-15).** This decision was originally written as "the
  > sixth phase of update's `runPhases` array". That array does not exist: `update.ts`'s
  > own header records that it deliberately does NOT use `runPhases` (the
  > heterogeneous-undo flow, D-02 precedent), and `install.ts` is the only production
  > `runPhases` call site. The DECISION stands — same relative position, structural
  > symmetry with install — but the mechanism is four insertion sites in `update.ts`,
  > plus `"workflows"` joining the closed `Phase3Failure["phase"]` union in
  > `shared/errors.ts` and the `PHASE3_FAILURE_PHASES` tuple in `update.ts`. See
  > `104-RESEARCH.md` for the verbatim line ranges. Do not plan against the array.

- A record predating Phase 103 carries `workflows: []` from the migration fill. That is
  literally correct — no previous artifacts — so re-staging behaves as a fresh install.
  **No special-case branch for the empty list.**

### The lingering-command remedy (WLIF-06)

- The remedy is carried by a **new closed-set reason token**, not by the existing
  `/reload to pick up changes` trailer. The trailer is about picking up NEW things; the
  fact here is that a REMOVED command is still live and runnable for the rest of the
  session. Understating an executable-code fact to save a token is the wrong trade.

- Severity is **warning**: the operation WAS carried out, but the desired state is not
  reached until reload. That is the middle arm of the tri-state model (info =
  desired-reached, warning = carried-out-but-short, error = not-carried-out).

- It is stamped **only when the removed set actually contained workflows.** A plugin that
  ships none must not be told about a lingering command it never had.

- The new token needs its `docs/output-catalog.md` entry under the existing byte-equality
  gate. **Coordinate with Phase 105's WDEP-04 amendment** — that phase adds its own reason
  token to the same closed set and the same catalog. Two separate amendments are fine; two
  conflicting rewrites of the same catalog region are not.

- The message states the host limitation as a limitation, not as a defect: Pi has no
  `unregisterCommand`, so registration converges on `/reload` (NFR-2 satisfied) while
  deregistration cannot happen mid-session at all.

### Proving it

- **The live canary asserts BETWEEN the uninstall and the teardown.** Today its
  `rm -rf` of the sandbox HOME runs immediately after `uninstall`, deleting any envelope
  the uninstall failed to remove — so it passes regardless (WR-10). It is the only
  automated surface that exercises the real engine's storage layout, and it is currently
  blind to precisely the half of the lifecycle this phase adds.

- **Criterion 2 is proven in BOTH scopes.** The project scope is where the derived key
  makes the path non-obvious, and it is the scope whose `extensionRoot` can sit on a
  different filesystem from the artifacts.

- The update triad — a version that **adds one workflow, removes another, and changes a
  third's `meta.name`** — is ONE test over one fixture pair, not three. The interaction is
  the risk: a rename is an add plus a remove that must not be mistaken for a replace.

### Settled after research (orchestrator decisions, do not re-open)

- **Only the four user-typed verbs stamp the WLIF-06 token** — `uninstall`, `disable`,
  `update`, `reinstall`. The load-time reconcile projection runs the same cascade but does
  NOT stamp it. Rationale: backlog item UAT-02 already records that the reconcile cascade
  is invisible on `/reload` (a host TUI limitation), so a token stamped there is a message
  nobody sees. Criterion 4 is worded without a surface qualifier; this records the reading
  taken rather than leaving it implicit.

- **A renamed workflow stamps the token too.** The gate is `previousNames \ stagedNames`
  non-empty — a rename removes the old command exactly as a deletion does, and the old
  command lingers identically.

- **A workflows unstage failure takes the partial-fold path**, not the
  `AgentsUnstageFailureError` abort-save carve-out. An untracked executable file left on
  disk is the worse outcome, so the removal must continue and report rather than abort.

- **`resourcesFromHandles` LOSES its `previousWorkflows` parameter** rather than gaining a
  branch — dropping it makes the compiler flag both call sites, which is the closure proof.
  Its current doc comment becomes actively false and must change with it.

- **The WR-10 canary assertion goes in `main`'s `try`, in its own removal section — NOT in
  `teardown`.** `fail()` throws `UatExit` and `teardown` runs from a `finally`; a throw
  there would mask a real primary failure.

- **WR-06's ownership check is a single `pathExists` refusal**, not the commands bridge's
  three-arm owned/orphan/foreign policy. `commitPreparedWorkflows` already displaces every
  `_previousNames` target aside before the rename loop, so anything still sitting at a
  target path is foreign by construction.

### Claude's Discretion

- The new reason token's exact spelling, the structured unstage-failure error's class name
  and field shape, plan/task decomposition and wave assignment, and whether the update and
  reinstall re-stage paths share a helper or stay separate.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets

- `bridges/workflows/index.ts` exports the full triplet already:
  `discoverPluginWorkflows`, `prepareStageWorkflows` / `commitPreparedWorkflows` /
  `abortPreparedWorkflows`, and `unstagePluginWorkflows`. This phase wires existing
  functions into existing verbs; it does not build a new bridge.
- `prepareStageWorkflows` already accepts `previousWorkflowNames` — accepted, documented,
  and supplied by no production caller. Wiring it is the WR-01 fix.
- `AgentsUnstageFailureError` (`orchestrators/marketplace/shared.ts`) is the precedent for
  a structured, non-swallowed bridge-unstage failure.
- `resourcesFromHandles` (`orchestrators/plugin/reinstall.ts`) already threads the previous
  workflow inventory through as a parameter.
- The `runPhases` / `Phase<C>` ledger primitive is unchanged — `update` gains an array
  element, not a new mechanism.

### Established Patterns

- `cascadeUnstagePlugin` is the single removal primitive; `uninstall` exposes it behind an
  injectable `opts.cascade` seam that tests already use.
- `enable` calls the guard-FREE `runInstallLedger` because it already holds the state lock;
  `proper-lockfile` is configured `retries: 0` and is NOT re-entrant, so nesting a second
  `withLockedStateTransaction` self-deadlocks.
- All user-visible output goes through `shared/notify.ts`; commands determine state and
  stamp severity and reasons, and the renderer must not probe state itself.
- `REASONS`, `STATUS_TOKENS` and `MARKERS` are closed sets with a `docs/output-catalog.md`
  byte-equality gate.

### Integration Points

- `orchestrators/marketplace/shared.ts` — `cascadeUnstagePlugin` and `UnstageOutcome`
  (both carry a literal "five bridges" claim that this phase falsifies).
- `orchestrators/plugin/update.ts` — the second and only other `runPhases` consumer.
- `orchestrators/plugin/reinstall.ts` — its own `prepareStage*` handle set plus
  `resourcesFromHandles`.
- `orchestrators/plugin/enable-disable.ts` — disable calls the cascade; enable calls
  `runInstallLedger`.
- `shared/notify.ts` `REASONS` and `docs/output-catalog.md` — for WLIF-06's token.
- `tests/live-uat/workflow-storage-canary.mjs` — the WR-10 assertion window.

</code_context>

<specifics>
## Specific Ideas

- Criterion 2 is called out in the ROADMAP as "the load-bearing case" because these
  artifacts live outside `<scopeRoot>`: a gap leaks executable files with nothing tracking
  them. Treat it as the phase's primary must-have, not one of four.
- The five carried findings are recorded in `REQUIREMENTS.md` under
  `#### Carried forward from the Phase 103 code review`, each mapped to the requirement
  that owns it. Read that section — it names the specific call sites and the ordering
  constraint between WR-01 and WR-06.
- Evidence base: `spike-findings-pi-claude-marketplace` project skill,
  `references/workflows-bridge.md`, section 8 ("Ledger") and the Constraints section's
  "Registration and reload" paragraph, which measured the asymmetry WLIF-06 reports.

</specifics>

<deferred>
## Deferred Ideas

- The `workflow_control` soft-dependency probe, the third `DEPENDENCIES` member, its reason
  token, and write-anyway degradation → Phase 105 (WDEP-01..04).
- The executable-code contract and the admit-versus-run divergence table → Phase 105
  (WDOC-01, WDOC-02).
- Broadening `assertSafeName`'s engine-parity gate beyond workflows → out of milestone
  scope; the wrap is deliberate (Phase 102 decision).

</deferred>
