# Phase 6: Load-time dependency check and allowed uninstall - Context

**Gathered:** 2026-09-18
**Status:** Ready for planning

<domain>
## Phase Boundary

Reconcile gains a load-time check: an installed, enabled plugin whose declared
dependency is missing, disabled, or outside its declared range is disabled at
`/reload`, reported on its own row with the upstream remedy shape, and never
silently kept as if nothing were wrong. The disable is a consequence the
config does not express, so reconcile must neither re-enable it while the
dependency stays unsatisfied nor flip it back and forth — only a satisfied
dependency lifts it. With that check in place, `uninstall <plugin>` stops
refusing to remove a plugin other installed plugins still declare: it
proceeds, names the dependents on its own row, and each dependent is reported
unsatisfied at the next load. PRUNE-05's refusal (D-05-14..16) and the
reload-path refusal are retired.

Requirements: LOAD-01, LOAD-02, LOAD-03.

Not in this phase: tag resolution for path-source dependencies (Phase 7),
enable/disable command changes — `enable X` cascading its dependencies,
`disable` refusing on an enabled dependent (Phase 8; `enable-disable.ts` is
untouched here), reload installing a MISSING declared dependency (Phase 9),
constraint-aware update (Phase 10), cross-marketplace allowlist (Phase 11),
standalone `prune` (Phase 12).

</domain>

<decisions>
## Implementation Decisions

The user deferred this phase's design point to Claude's judgment (declined
the discuss session; "everything is already decided — skip to context"). The
decisions below are Claude's calls, made against the single design point
ROADMAP.md's Phase 6 notes already named, then verified against the actual
shape of `orchestrators/reconcile/plan.ts` and its purity gate before being
written down — not assumptions.

### The consequence-disable marker

- **D-06-01: Add `dependencyDisabled?: boolean` to `PLUGIN_INSTALL_RECORD_SCHEMA`
  — optional, additive, no schemaVersion bump.** Follows the `resolvedSha` /
  `hookEntries` precedent (D-100-01): a legacy record without it loads
  unchanged, absence needs no migrate fill, and it is orthogonal to the
  required `enabled` boolean it modifies the meaning of, not replaces. A
  literal-union "reason" field was considered and rejected: LOAD-01's remedy
  sentence is re-derived LIVE from a fresh check every time reconcile runs
  (dependency state can change between passes — that is the whole point of
  LOAD-02), so the marker only needs to answer "is this record CURRENTLY held
  down by the check", never "why", and a boolean says exactly that with
  nothing to keep in sync.
  — **Reversibility:** reversible — an additive optional field with no
  migrate fill costs nothing to drop or rename later; no persisted value
  depends on the field surviving.

- **D-06-02: The check sets `dependencyDisabled: true` ONLY at the instant it
  performs the enabled→disabled transition itself.** If a record is already
  disabled for any other reason (the user's own `disable` command, or a
  config-declared `enabled: false`), the check leaves it disabled and does
  NOT stamp the marker. This is what keeps a user's own choice distinguishable
  from the check's consequence, per the HANDOFF's own framing ("the disable is
  recorded as a consequence, not a user choice") — without it, LOAD-02's
  "lifts the disable once satisfied" would silently overturn a disable the
  user asked for.
  — **Reversibility:** reversible — a planning-time predicate, not a stored
  shape.

- **D-06-03: The check's OWN plan.ts branch reads `dependencyDisabled` and
  refuses to bucket the record as `enable`, even when config still declares
  it enabled.** Traced in `classifyDeclaredPlugin`
  (`orchestrators/reconcile/plan.ts:414-504`): today, a recorded-but-disabled
  plugin with a config that still declares it enabled is unconditionally
  pushed to `acc.enable` (line 499, `isRecordedButDisabled(record)` alone
  gates it). Left unchanged, this is the exact oscillation LOAD-02 forbids —
  a consequence-disable would never survive a second `/reload`, because
  nothing about it looks different from an ordinary "declared enabled but
  disabled" divergence. D-06-03 adds `!record.dependencyDisabled` (or the
  satisfied-dependency check re-run inline) to that branch's gate. The LIFT
  path — when the dependency situation has since resolved — is the SAME
  branch: once satisfied, the ordinary enable-bucket logic already fires
  (config says enabled, record is recorded-but-disabled), and whoever applies
  the enable bucket clears `dependencyDisabled` as part of performing it.
  — **Reversibility:** reversible — a local branch condition; no persisted
  contract depends on its exact shape.

### Where the check itself runs (purity boundary)

- **D-06-04: The dependency-satisfaction check CANNOT run inside `planReconcile`
  itself, and must be precomputed and passed in as data.** Verified directly
  against `tests/architecture/reconcile-planner-purity.test.ts`: `plan.ts` is
  grepped for forbidden patterns including `node:fs` / `node:fs/promises`
  imports, and `buildScopeDeclarationIndex`
  (`orchestrators/plugin/dependency-index.ts`, Phase 5's declaration index) is
  `async` and does exactly those fs reads — it is called today only from
  `uninstall.ts`, never from `plan.ts`. The planner must design this as an
  async pre-step (in the `resources_discover` → `applyReconcile` caller, or a
  new async wrapper ahead of `planReconcile`) that builds a per-scope
  satisfaction verdict for every recorded, declared dependency and hands it to
  `planReconcile` as an added, already-computed input — the same shape
  `MarketplaceDiff` and `DeclaredPluginInputs` already take precomputed
  values rather than deriving them inline. This is a structural fact for the
  planner to design around, not a design choice with alternatives: violating
  it fails `reconcile-planner-purity.test.ts` outright.
  — **Reversibility:** one-way in the sense that the purity gate is a fixed
  constraint, not a decision this phase can trade off; the planner's actual
  wiring choice (which async function computes the verdict, where it lives)
  is ordinary implementation discretion within that constraint.

### Chain propagation

- **D-06-05: The check runs to a FIXPOINT within one apply pass, mirroring
  Phase 5's prune sweep (D-05-02).** LOAD-01 counts "dependency ... disabled"
  as itself an unsatisfied condition, so disabling B (because C is gone) can
  make A (which declares B) newly unsatisfied in the same reconcile run. A
  single non-repeating pass would take N reloads to fully propagate a broken
  dependency down a chain of depth N — user-visibly wrong ("why is A still
  loading, its dependency B is disabled"). Repeat the check-and-disable step
  until no new record is disabled in a pass, the same repeat-until-stable
  shape D-05-02 already established for the orphan sweep.
  — **Reversibility:** reversible — an iteration-count implementation detail
  with no persisted shape.

### Allowed uninstall (LOAD-03)

- **D-06-06: `uninstall.ts` keeps computing the dependent set via
  `buildScopeDeclarationIndex` (already wired for D-05-14..16's guard) but
  reports it on the SUCCESS row instead of refusing.** The guard call site
  moves from a refusal (`assertNoDependents` throwing / blocking removal) to
  an informational reason attached to the ordinary uninstalled row, naming
  the dependents that will be reported unsatisfied at the next load — the
  same declaration-read machinery (D-05-06's offline manifest read, D-05-07's
  fail-closed-on-unreadable posture) still applies; only the OUTCOME on a
  found dependent set changes from "refuse" to "proceed and report". This
  keeps D-05-05 (same-scope only) and D-05-04 (a disabled declarer still
  holds its dependencies) unchanged — they were never about whether to
  refuse, only about who counts as a declarer.
  — **Reversibility:** one-way — a published catalog row; exact wording is
  Claude's Discretion below, following the closed-set-amendment mechanism
  D-04-07 and D-05-11 already established.

- **D-06-07: PRUNE-05's refusal and its `dependents remain` row are RETIRED,
  not left dead in place.** `orchestrators/plugin/uninstall.ts`'s current
  refusal branch (D-05-14..16) and the `docs/dependency-resolution.md` §138
  "documents this for `disable`; this extension applies it to `uninstall`"
  sentence are removed as part of this phase, per REQUIREMENTS LOAD-03's own
  text ("Supersedes PRUNE-05 and the reload-path refusal"). A decision record
  superseding D-05-14 belongs in this phase's own artifacts (REVIEW or
  SUMMARY), not left implicit.

### Claude's Discretion

- Exact reason-token wording for the three upstream remedy shapes (`Install
  "X" or uninstall "Y"`, `Enable "X" or uninstall "Y"`, `Update "X" to
  satisfy R, or uninstall "Y"`) and for LOAD-03's "will be unsatisfied" row —
  follow `docs/messaging-style-guide.md` and the closed-set `REASONS`
  amendment mechanism (D-04-07, D-05-11) rather than inventing prose ad hoc.
  The upstream WORDING itself is pinned verbatim in HANDOFF-upstream-
  dependency-parity.md and REQUIREMENTS LOAD-01 — only the token
  name/placement in `notify-reasons.ts` and the catalog is open.
- Whether `dependencyDisabled` is cleared by `apply.ts`'s enable-application
  step or by a small helper it calls — as long as plan.ts stays a pure
  consumer of a precomputed verdict (D-06-04) and the clear happens exactly
  when the enable is actually applied, not speculatively.
- Whether the async pre-step (D-06-04) computes the dependency-satisfaction
  verdict via `buildScopeDeclarationIndex` directly or via a new sibling
  function in `dependency-index.ts` purpose-built for "is every recorded
  dependent's declaration currently satisfied" (name/shape open) — either is
  acceptable so long as it stays offline (fs + warm clone cache only, NFR-5)
  and lands outside `plan.ts`.
- Whether `enabled X` reported by a manual `enable` command clearing a stale
  `dependencyDisabled` flag needs any change in THIS phase. Traced: since
  `enable-disable.ts` is untouched here and already sets `enabled: true`
  unconditionally, a manual enable on a still-unsatisfied record leaves
  `dependencyDisabled: true` stale alongside `enabled: true` — but the next
  reconcile pass self-corrects either way (clears the flag if now satisfied,
  or re-disables and re-stamps it if not), so no defensive code is needed in
  Phase 6. Phase 8 (Enablement parity) is where `enable-disable.ts` itself
  learns about dependencies; this note is a boundary marker, not a deferred
  bug.
- Interaction between the new async dependency-satisfaction pre-step and
  `resources_discover`'s existing error-wrapping discipline (ARCHITECTURE.md:
  a throw must never propagate past `resources_discover`/`session_start`) —
  ordinary defensive wiring, no new decision needed.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Upstream parity contract
- `.planning/HANDOFF-upstream-dependency-parity.md` — decisions #7 and #8 (the
  two this phase implements), the upstream error codes and remedy text
  verbatim (`dependency-unsatisfied`, `dependency-version-unsatisfied`, the
  disable-refusal sentence upstream uses for the ADJACENT `disable` command),
  and the phase-grouping note explaining why #8 (load-time check) leads #7
  (allowed uninstall) rather than the other order.
- `https://code.claude.com/docs/en/plugin-dependencies` — the upstream
  `dependency-unsatisfied` / `dependency-version-unsatisfied` behavior and the
  enable/disable dependency paragraph this phase's uninstall change departs
  from (upstream applies the refusal to `disable`, not `uninstall`; this
  extension currently applies it to `uninstall`, and this phase retires that
  application — see D-06-07).

### This milestone's contracts
- `.planning/REQUIREMENTS.md` LOAD-01..03 (§ "Load-time dependency check
  (LOAD)") and the now-superseded PRUNE-05 entry (marked "Superseded by
  LOAD-03 on 2026-09-18").
- `.planning/ROADMAP.md` § "Phase 6: Load-time dependency check and allowed
  uninstall" — goal, success criteria 1-4, and the Notes paragraph naming the
  design point this CONTEXT.md resolves (D-06-01..03).
- `.planning/STATE.md` § Current Position — the two operator decisions that
  shaped the roadmap reorder (extend v1.20 rather than open v1.21; lead with
  Phase 6 over the handoff's tag-resolution-first order) and BACKLOG
  `PRUNE-GUARD-MR-01`'s re-triage note (affected by this phase's retirement of
  the refusal; re-triage, do not resolve, here).

### Prior phase decisions this phase builds on
- `.planning/phases/05-prune-on-uninstall/05-CONTEXT.md` — D-05-01/02 (the
  fixpoint sweep shape D-06-05 mirrors), D-05-04/05/06/07 (who counts as a
  declarer; unchanged by this phase), D-05-14..15..16 (the guard this phase
  retires; D-06-07 supersedes it explicitly).
- `.planning/phases/04-install-provenance/04-CONTEXT.md` — D-04-02 (the
  config carries only what the user explicitly asked for — why the
  consequence-disable cannot be config-carried), D-04-07 (the closed-set
  amendment mechanism D-06-06's new row follows).
- `.planning/phases/03-dependency-resolution/03-CONTEXT.md` — D-03-07
  (all-or-nothing cascade rollback — unaffected by this phase, cited only
  because `dependency-index.ts` and the range machinery this phase reuses
  were both introduced downstream of Phase 3's parser).

### Architecture constraints
- `.planning/codebase/ARCHITECTURE.md` § "Boundary zones" and the
  `reconcile-planner-purity.test.ts` citation — `plan.ts` forbids
  `node:fs`/`node:fs/promises` imports; D-06-04 is a direct consequence,
  verified against `tests/architecture/reconcile-planner-purity.test.ts`
  itself, not inferred.
- `.planning/codebase/CONVENTIONS.md` — the dual cognitive-complexity
  ceilings (ESLint `sonarjs/cognitive-complexity: 15`, fallow
  `health.maxCognitive: 15`); `classifyDeclaredPlugin` and
  `buildUninstallBucket` are both already extracted helpers for exactly this
  reason and are candidates for further extraction, not for inlining new
  branches into.

### Output contract
- `docs/output-catalog.md` § `/claude:plugin uninstall` and the reconcile
  rows section — the new LOAD-01/LOAD-03 rows extend this; `notify-
  reasons.ts` header count and `tests/architecture/notify-closed-set-
  locks.test.ts` gate every new token.
- `docs/dependency-resolution.md` §138 and `docs/plugin-enablement.md` — the
  "Claude Code documents this for `disable`; this extension applies it to
  `uninstall`" sentence D-06-07 retires; both docs need the rewrite as part
  of this phase's own scope (not deferred to Phase 6's "Docs" grouping item 8
  in the HANDOFF, which is actually DIVG-01, a Phase 7 requirement — verify
  at planning time which prose lands here vs. Phase 7).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `orchestrators/plugin/dependency-index.ts::buildScopeDeclarationIndex` —
  the offline declaration index Phase 5 built for the dependents guard; this
  phase's uninstall change (D-06-06) reuses it as-is, and the new load-time
  check (D-06-04) either reuses it or adds a sibling for the "is this
  recorded dependent's declaration satisfied" question — both need the same
  offline manifest-read machinery.
- `domain/dependency-range.ts::recordedVersionSatisfies` — already answers
  the range-outside-declared-range half of LOAD-01 (missing/disabled/
  out-of-range); ROADMAP's own Phase 6 notes name it directly.
- `persistence/state-io.ts::isRecordedButDisabled` and
  `persistence/config-io.ts::isDeclaredEnabled` — the two predicates
  `classifyDeclaredPlugin` already composes; D-06-03's new gate condition
  joins them, not replaces them.
- `orchestrators/plugin/uninstall.ts` — already imports
  `buildScopeDeclarationIndex` and calls it at line 252 for the D-05-14..16
  guard; D-06-06/07 change what happens with the result, not how it's
  obtained.

### Established Patterns
- `orchestrators/reconcile/plan.ts::classifyDeclaredPlugin` (lines 414-504)
  and `buildUninstallBucket` (line 515) are both already extracted
  specifically to keep `diffPlugins`'s cognitive complexity down — the
  established pattern for adding a bucket or a branch here is another small
  extracted function, not a bigger `if`.
- The fixpoint-sweep shape (D-05-02: repeat until nothing new qualifies, then
  save once) is precedented and should be copied, not redesigned.
- `notify.ts` is a dumb renderer; the orchestrator (here, whatever drives the
  new load-time check) stamps status/reasons/severity, never notify itself.
- Two independently-computed complexity gates apply to any new plan.ts/
  apply.ts code exactly as they did in Phase 4/5.

### Integration Points
- `orchestrators/reconcile/apply.ts::applyPluginToggles` (line 667) — the
  existing apply-side function for the enable/disable buckets `plan.ts`
  produces; the clear-on-lift half of D-06-03 likely belongs here, but the
  planner should trace this function's current body before assuming its
  shape.
- `resources_discover` → `applyReconcile` (`index.ts`) — where the new async
  pre-step (D-06-04) most naturally slots in, ahead of the `planReconcile`
  call; ARCHITECTURE.md's "a throw must never propagate past
  resources_discover" discipline applies to it like everything else there.
- `tests/architecture/no-orchestrator-network.test.ts` `FORBIDDEN_TARGETS` —
  the reconcile `pending.ts`/`plan.ts`/`notify.ts` family is already listed;
  verify whether the new async pre-step's home file needs adding (it should
  stay offline regardless, per NFR-5, but the gate's list is exhaustive and
  file-named).

</code_context>

<specifics>
## Specific Ideas

- The user deferred every open question in this phase to Claude's discretion.
  No user-specific "I want it like X" moments were captured; all specifics
  above are Claude's own technical derivations, each traced against the
  actual current source rather than assumed.

</specifics>

<deferred>
## Deferred Ideas

- **`enable-disable.ts` learning about `dependencyDisabled`** (clearing it on
  a manual enable, or refusing a manual disable differently when the record
  is already consequence-disabled) — belongs to Phase 8 (Enablement parity),
  not this phase; see the Claude's Discretion note above for why no defensive
  code is needed here in the meantime.
- **A `list`/`info` marker distinguishing a consequence-disabled plugin from
  a user-disabled one** — not requested by LOAD-01..03; would be a new
  closed-set token and inventory concept, out of scope here.

### Reviewed Todos (not folded)
None — no pending todos matched this phase's scope.

</deferred>

---

*Phase: 06-Load-time dependency check and allowed uninstall*
*Context gathered: 2026-09-18*
