# Phase 103: Reconcile stability and lifecycle non-reapplication - Context

**Gathered:** 2026-08-15
**Status:** Ready for planning

<domain>
## Phase Boundary

Once a plugin is installed disabled, nothing re-enables it behind the user's
back — not the next `/reload`, not an `update`, not a `reinstall`. Phase 102
made the disabled state land where the reconcile planner already looks for it;
this phase proves the planner then does nothing with it, reload after reload,
and that the two re-materializing lifecycle verbs never re-consult the manifest
field.

The phase is **mostly characterization and regression-pinning, plus two
production fixes** the research turned up. A scout before planning found three
of the four success criteria already structurally true (see `<code_context>`),
and the roadmap anticipated exactly that: "If it is already true, pin it as a
regression rather than inventing a mechanism." Research then probed the criteria
against the real orchestrators instead of only reading them, and found two live
defects — `reinstall` re-enabling a disabled plugin, and `enable` writing to the
wrong physical config file under a local declaration. Both are recorded as
D-103-12 and D-103-13 and both are in scope, because the goal sentence names
`reinstall` and criterion 4 names the surviving `enable`.

So planning should expect: a tests-and-gates phase, plus two narrow, separately
reviewable production changes. Any OTHER proposed mechanism is a signal that
something in the scout was wrong and should be re-checked before it is built.

**Out of scope:** DFEN-08's byte-identical parity sweep (Phase 105) and the
pre-install read surfaces (Phase 104). This phase asserts stability for the
`defaultEnabled: false` case it was given; it does not re-audit the `true` and
absent cases.

</domain>

<decisions>
## Implementation Decisions

### The install verb (carried forward from Phase 102)

- **D-103-01: the install-disabled verdict is NOT widened.** It keeps firing
  only on `declaredEnabled === undefined`. The alternative — also firing on
  `declaredEnabled === false`, so an explicit config value wins in both
  directions at the install boundary — is rejected because it breaks DFEN-08.
  DFEN-08 requires that `defaultEnabled: true` and an absent `defaultEnabled`
  produce byte-identical behavior and output to today across install, update,
  reinstall, list, info and reconcile. Widening changes `install` for plugins
  whose manifest never mentions the field at all (config `enabled: false` plus
  no `defaultEnabled` would begin installing disabled), and gating the widening
  on the manifest declaring the field does not help — `defaultEnabled: true`
  plus config `enabled: false` would change too. There is no form of the
  widening that leaves DFEN-08 intact.

- **D-103-02: Phase 102's success-criterion 3 gloss is amended, not left
  standing.** Its illustrative clause — "a user who wrote `enabled: false` for a
  `defaultEnabled: true` plugin stays disabled" — is reworded in `ROADMAP.md` to
  match DFEN-05's normative text, which is that an existing `enabled` value wins
  over `defaultEnabled` and is never overwritten. That normative requirement
  holds today in both directions and across both physical config files. The
  override recorded in `102-VERIFICATION.md` stays as the audit trail for why
  the wording changed.

- **D-103-03: today's behavior is pinned by a regression test**, so the decision
  above cannot drift into an accident. Installing over a config entry that
  already says `enabled: false` materializes the plugin, leaves the entry
  byte-identical, and the next reconcile pass converges the record to disabled.
  The test's own comment must say that this is a DFEN-08-driven choice, so a
  later reader does not "fix" it toward symmetry.

### Proving the DFEN-06 fixed point

- **D-103-04: both seams are asserted, planner-level AND end-to-end.** The
  roadmap mandates the planner assertion — "verified against the reconcile
  planner's own output (`orchestrators/reconcile/plan.ts`), not merely asserted
  at the install boundary" — and the fixed point itself needs real passes,
  because a plan that is empty while the apply path still mutates something
  would satisfy the planner assertion and still oscillate.

- **D-103-05: three reload passes.** Criterion 2 names the second and the third
  explicitly. Two passes prove only that the first pass was not special.

- **D-103-06: every bucket is asserted empty for the plugin, not just
  `acc.enable`.** `acc.enable.push(...)` is the specific hazard the milestone
  names, but a stray `uninstall`, `disable`, or re-`install` for the same plugin
  would be just as wrong and just as silent. Assert the plugin's absence from
  all seven action buckets.

- **D-103-07: the local-declared case is covered alongside the base-declared
  one.** Phase 102's stamp is targeted at the physical file the declaration
  lives in, so a mis-target does not show up as a bad write — it shows up here,
  as a non-fixed point, because the merged view still reads the key as absent
  and the planner keeps planning. This is the assertion that can distinguish a
  correct stamp from a silently ineffective one at this seam.

### Pinning DFEN-07, which is already true

- **D-103-08: both a behavioral test and an architectural grep gate.** The
  behavioral test proves the guarantee a user cares about; the gate catches the
  regression at its source, before it can reach a behavior. This mirrors the
  house pattern already in the tree — `tests/architecture/no-orchestrator-network.test.ts`
  greps orchestrator sources for forbidden tokens rather than waiting for a
  network call to appear in a test.

- **D-103-09: the gate names the two tokens.** `orchestrators/plugin/update.ts`
  and `orchestrators/plugin/reinstall.ts` must not reference `defaultEnabled` or
  `applyDefaultEnabled`. A looser rule about "enablement reads in the lifecycle
  verbs" was considered and rejected: it is harder to express as a grep and
  prone to false positives on unrelated identifiers. Both files legitimately
  call `resolveStrict`, which RETURNS the field — the gate is about reading it,
  so it must not forbid the resolver call itself.

- **D-103-10: the manifest is flipped between install and update.** Installing
  and updating against the same manifest cannot distinguish "never re-read the
  field" from "re-read it and got the same answer". Install with
  `defaultEnabled: false`, rewrite the marketplace entry to
  `defaultEnabled: true`, then `update` — the record must not move. Run the
  converse too: a user who ran `enable` on a `defaultEnabled: false` plugin
  stays enabled across reload, update and reinstall.

- **D-103-11: criterion 4's converse is proven end to end, config included.**
  Assert that `enable` writes `enabled: true` into the declaring config file,
  not merely that the record flipped. Without that write the next `/reload`
  would read the `enabled: false` the install stamped, plan a disable, and undo
  the user's explicit choice — which is the same class of silent reversal this
  milestone exists to close, pointed the other way.

### Two defects the research found — the phase is no longer characterization-only

Research probed the four criteria against the real orchestrators rather than
only reading them, and found two live defects. Both were re-verified against the
source before being folded in. Both are mandated by the phase's own goal
sentence and criterion 4, so neither is a deferral candidate.

- **D-103-12: `reinstall` must gain the disabled-record short-circuit that
  `update` already has.** `updateStateRecord` writes `enabled: true`
  unconditionally (`orchestrators/plugin/reinstall.ts:1733`) with no
  `isRecordedButDisabled` branch, where `update` returns
  `runDisabledRecordRefresh` at `orchestrators/plugin/update.ts:1871`. So
  `reinstall` on a disabled plugin re-materializes its artifacts, flips the
  record enabled, and renders `(reinstalled)` over a config that still says
  `enabled: false`; the next reload converges it back. This does not breach
  criterion 3 — nothing reads `defaultEnabled` — but it directly breaches the
  goal sentence's "not a `reinstall`". Mirror `update`'s branch rather than
  inventing a second shape; `update.ts:1860-1872` is the model, including the
  ENBL-09 / ENBL-18 split about which fields a disabled refresh may touch.

- **D-103-13: `enable` and `disable` must select their config write target from
  where the declaration lives, not from the user's `--local` flag.**
  `setPluginEnabled` calls `selectConfigWriteTarget(locations, opts.local)`
  (`orchestrators/plugin/enable-disable.ts:520` →
  `orchestrators/plugin/shared.ts:401-416`), so for a plugin declared only in
  `claude-plugins.local.json`, an `enable` without `--local` writes
  `enabled: true` into the BASE file while CFG-02 keeps the local `enabled:
  false` effective. The next `/reload` plans a disable and silently undoes the
  user's explicit choice. This is the same defect Phase 102 fixed on the install
  path; it was never fixed here. Criterion 4 is false for locally-declared
  plugins until it is.

  **Blast radius, stated deliberately:** this changes the `enable`/`disable`
  verbs for ALL locally-declared plugins, not only `defaultEnabled` ones. That
  is a bug fix to a shipped verb, and it is what makes install and enable agree
  about which file a declaration lives in. It does not threaten DFEN-08, which
  governs the effect of the manifest field rather than the correctness of
  write-target selection. Plan it as its own task with its own regression test
  so it can be reviewed and reverted independently of the rest of the phase.

- **D-103-16: `install`'s standalone write-back must use the same declaring-file
  selection as D-103-13.** Planning found a THIRD instance of the write-target
  defect, and this one falsifies criterion 1 outright. Phase 102's review fixed
  the cross-file READ (`readDeclaredEnabled`,
  `orchestrators/plugin/install.ts:1442`), but the WRITE half of the same
  asymmetry survived: the standalone batched patch at `:1699` goes to
  `targetConfigPath`, still derived from `opts.local` alone at `:1553`.

  The consequence is not a cosmetic mis-file. A user who hand-writes
  `"foo@mp": {}` into `claude-plugins.local.json` and runs
  `/claude:plugin install foo@mp` with no flag gets: the read correct (the
  merged view says `enabled` absent, so the plugin lands disabled), the stamp
  written into the BASE file, CFG-02 shadowing that stamp wholesale, the merged
  entry still reading `enabled` absent, `isDeclaredEnabled` answering true, and
  `orchestrators/reconcile/plan.ts:338` pushing an enable on EVERY reload —
  forever. That is the milestone's central hazard, live, through the standalone
  install door, and it is success criterion 1 of this phase being false.

  It is in scope for the same reason D-103-12 and D-103-13 are: the phase's own
  criteria name it. The fix is one call site once D-103-13's declaring-file
  helper exists, so it belongs in a wave-2 plan that depends on D-103-13 rather
  than in a new production seam of its own.

### Resolving the research's remaining open questions

- **D-103-14: D-103-03 amends the existing matrix row, it does not add a new
  one.** The precedence case already exists at
  `tests/orchestrators/plugin/install.test.ts:1185-1193`. What is missing is the
  DFEN-08 rationale in its comment and the convergence half — that the next
  reconcile pass drives the record to disabled. Extend that row; a parallel new
  case would leave two tests asserting the same thing with only one explaining
  why.

- **D-103-15: the D-103-02 `ROADMAP.md` reword is a task inside this phase's
  plans**, not a standalone docs commit. It is the documentary half of D-103-01
  and belongs in the same reviewable unit as the regression test that pins the
  behavior.

### Claude's Discretion

- Test file placement, fixture naming, and whether the planner-level assertions
  live beside the existing `tests/orchestrators/reconcile/plan.test.ts` cases or
  in a new file.
- Whether the three reload passes are one test with three `applyReconcile` calls
  or three named assertions inside one fixture.
- The exact grep-gate file: extending an existing architecture test versus a new
  one, following whichever the existing gates make more natural.

</decisions>

<code_context>
## Existing Code Insights

Scouted before planning; these facts shape the phase and should be re-verified
rather than assumed if planning finds them stale.

### The three criteria that are already structurally true

- **`resolved.defaultEnabled` has exactly ONE reader outside the resolver** —
  the landed-disabled verdict at `extensions/pi-claude-marketplace/orchestrators/plugin/install.ts:1606-1616`.
  A repo-wide grep for `defaultEnabled` outside `domain/components/` returns the
  resolver's own plumbing, that verdict, and comments.
- **`update.ts` and `reinstall.ts` never read the field.** Both call
  `resolveStrict` (`update.ts:902`, `reinstall.ts:1510`), so the field is
  present on the object they hold, but neither destructures or reads it, neither
  passes `applyDefaultEnabled`, and neither writes to `claude-plugins.json` at
  all. DFEN-07 is therefore a characterization, not a build.
- **`enable-disable.ts` DOES write back to config** —
  `writeBatchedConfigEntries` at `:583` and `:657`. This is what makes criterion
  4's converse survive a reload, and it is the specific behavior D-103-11 pins.
- **The reconcile planner never sees a manifest.** `orchestrators/reconcile/plan.ts`
  contains no resolver call and no manifest read; desired enablement comes only
  from `isDeclaredEnabled` over the merged config. This is the design anchor
  holding, and it is why the Phase 102 write-through was necessary in the first
  place.

### Established patterns to reuse

- **Architectural grep gates as tests**, not lint rules —
  `tests/architecture/no-orchestrator-network.test.ts` is the model for D-103-08
  and D-103-09.
- **The planner's classification arms** live in `classifyDeclaredPlugin`
  (`orchestrators/reconcile/plan.ts:295-345`). The steady-state arm this phase
  proves is the comment at `:339-343`: "Declared-enabled, recorded, not
  disabled: steady state, no action." The hazard arm is `acc.enable.push` at
  `:338`.
- **Reconcile end-to-end fixtures** already exist in
  `tests/orchestrators/reconcile/apply.test.ts` — `seedRealPathMarketplace` (now
  carrying the `entryDefaultEnabled` knob Phase 102 added) plus the WR-09
  local-file isolation fixture shape for the D-103-07 local-declared case.

### Integration points

- Nothing new is wired. The phase reads existing seams and, at most, adds one
  architecture test file.

</code_context>

<specifics>
## Specific Ideas

The DFEN-08 argument in D-103-01 is the load-bearing one and should survive into
the plan verbatim. It is what converts an apparently balanced product-semantics
question — should `install` honor a config-disabled entry — into a decided one.
A plan that re-opens the question without engaging DFEN-08 has lost the thread.

</specifics>

<deferred>
## Deferred Ideas

- **Standalone retry after a failed disable cascade.** When the install ledger
  succeeds and the disable cascade fails, the record is saved, so an immediate
  re-run of `install` hits the PI-15 `already-installed` gate and the only
  escape named to the user is `uninstall`. A `/reload` does converge, because
  the config now declares `enabled: false`
  (`orchestrators/plugin/install.ts:1638-1653`). Outside every success criterion
  of this phase; backlog-grade.
- **Criterion 2 of Phase 102 rests on composition for agents and MCP.** The
  tests assert skills, commands and hooks are gone from disk; agents and MCP
  rest on `cascadeUnstagePlugin` covering all five kinds. One `stat` on
  `locations.agentsDir` and one read of `mcpJsonPath` in the existing
  `install-out04-row-` fixture would make it direct. A Phase 105 parity-sweep
  candidate.

</deferred>
