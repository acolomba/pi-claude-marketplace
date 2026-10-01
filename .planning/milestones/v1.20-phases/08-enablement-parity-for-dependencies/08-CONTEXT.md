# Phase 8: Enablement parity for dependencies - Context

**Gathered:** 2026-09-19
**Status:** Ready for planning

<domain>
## Phase Boundary

`enable` and `disable` learn about plugin dependencies the way `install` and
`uninstall` now do: `enable <plugin>` also enables the plugin's declared
dependencies, transitively, in the same scope, and lists each one on its own
row (EDEP-01). `disable <plugin>` is refused while an enabled installed
plugin in the scope still declares it, naming the dependents and giving a
way to disable everything together (EDEP-02). Installing or enabling a
plugin whose already-installed dependency is disabled enables that
dependency through its record — the config never names it (D-04-02) — and
reports it on the row; the `{already installed, dependency disabled}` skip
(RESV-05) is retired (EDEP-03). Closes BACKLOG `ENBL-DEP-01`.

Not in this phase: reload installing a MISSING declared dependency (Phase
9), constraint-aware update (Phase 10), cross-marketplace allowlist (Phase
11), standalone `prune` (Phase 12). `BACKLOG DEPS-STATUS-01` (a plugin whose
dependency is partially installed is itself partial) stays open — not
upstream parity, not pulled in here.

</domain>

<decisions>
## Implementation Decisions

### Disable refusal — chained command form (EDEP-02)
- **D-08-01:** Upstream's refusal text is a template — `X is still required
  by A, B. Disable those plugins first, or disable everything together:
  <chained command>` — but the `disable` command only ever takes one
  `<plugin>@<marketplace>` target; no multi-target syntax exists
  (`edge/handlers/plugin/enable-disable.ts::parseRequiredPluginMarketplaceRef`).
  The operator chose a **plain-English instruction** over inventing
  shell-chaining syntax that implies a CLI capability that doesn't exist:
  name the dependents and the order, e.g. "Disable A, B first, then X" —
  not `disable A@mp && disable B@mp && disable X@mp`. — **Reversibility:**
  one-way — a published catalog row; wording is Claude's Discretion below
  within this constraint.

### EDEP-03 reporting — new closed-set token (EDEP-03)
- **D-08-02:** When install/enable turns on an already-installed, disabled
  dependency through its record, the row carries a **new closed-set reason
  token, `{dependency enabled}`** — parallel to the existing register
  (`dependency promoted`, `dependency disabled`, `dependency pruned`), not a
  plain `enabled` status with no reason. This retires the
  `{already installed, dependency disabled}` skip row (RESV-05) per ROADMAP
  success criterion 3. Needs the full closed-set amendment mechanism
  (fixture, both contract constants, length lock, both enumeration pins,
  `notify-reasons.ts` header count) exactly as D-04-07 and D-05-11 did. —
  **Reversibility:** one-way — a published catalog row.

### EDEP-01 cascade reporting — full closure, not just state changes
- **D-08-03:** `enable <plugin>` reports **every** dependency in the
  transitive closure on its own row, including ones that were already
  enabled — not only the ones actually flipped from disabled to enabled.
  This matches the install cascade's established per-member reporting
  convention (every closure member gets a row, e.g. `{already installed}`)
  rather than a quieter changes-only report. The exact per-row token for an
  already-enabled member (e.g. an `{already enabled}` parallel, or reuse of
  an existing idempotent-state token) is Claude's Discretion below,
  following the same register D-08-02 extends. — **Reversibility:**
  one-way — a published catalog row; exact per-row wording is Claude's
  Discretion within this constraint.

### Claude's Discretion
- Exact prose for D-08-01's plain-English instruction (dependent ordering,
  punctuation) — follow `docs/messaging-style-guide.md`.
- Exact per-row token for an already-enabled dependency under D-08-03's full
  closure (new token vs. reuse of an existing idempotent-state token) —
  whichever is truthful and avoids inventing a redundant closed-set member.
- Disambiguating the `enable-disable.ts` naming collision: its existing
  in-code "dependencies" concept is the soft-dep companion extensions
  (pi-subagents, pi-mcp-adapter), unrelated to plugin dependencies — name
  the new code so the two don't read as the same thing (ROADMAP Notes flags
  this explicitly).
- Whether the async dependency-satisfaction read for EDEP-01/EDEP-03 reuses
  `buildScopeDeclarationIndex` directly or a purpose-built sibling — same
  discretion Phase 6 (D-06-04's note) left open for its own call site; this
  phase's cascade enable is a new caller, not a new offline-read mechanism.
- Whether a manual `enable <plugin>` on a record still carrying Phase 6's
  `dependencyDisabled` consequence-marker clears the marker as part of the
  same write, or leaves it for the next reconcile pass to self-correct —
  Phase 6's own Discretion note already established that either is
  behaviorally safe (reconcile re-derives the marker every pass); this
  phase should clear it at write time if convenient, but must not add
  defensive code beyond that.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements and roadmap
- `.planning/REQUIREMENTS.md` §"Enablement parity for dependencies (EDEP)" —
  EDEP-01, EDEP-02, EDEP-03 (lines 159-173).
- `.planning/ROADMAP.md` § "Phase 8: Enablement parity for dependencies" —
  goal, success criteria 1-4, and the Notes paragraph naming the
  `enable-disable.ts` naming-collision disambiguation, the `runInstallLedger`
  reuse, and the upstream disable-refusal template text.
- `.planning/HANDOFF-upstream-dependency-parity.md` rows 5 and 6 — upstream
  behavior for the enable cascade / disable refusal and for enabling a
  disabled dependency on install/enable; § "Facts a planner needs" for the
  pinned upstream error text and the closed-set-amendment surface list.
- `.planning/BACKLOG.md` § "ENBL-DEP-01" — the operator rule this phase
  closes ("a plugin that is asked for — by name, or by another plugin's
  dependency declaration — becomes enabled").

### Prior-phase decisions this phase builds on
- `.planning/phases/06-load-time-dependency-check-and-allowed-uninstall/06-CONTEXT.md`
  — D-06-01..03 (the `dependencyDisabled` consequence marker and its LIFT
  path — this phase's manual-enable interaction, see Claude's Discretion
  above); its own Deferred Ideas section names this exact phase as the
  owner of "`enable-disable.ts` learning about `dependencyDisabled`".
- `.planning/phases/05-prune-on-uninstall/05-CONTEXT.md` — D-05-04 (a
  disabled installed plugin still holds its declared dependencies — the
  declarer set for EDEP-02's guard), D-05-05 (same-scope-only declarers),
  D-05-11 (the closed-set-amendment mechanism D-08-02 follows).
- `.planning/phases/04-install-provenance/04-CONTEXT.md` — D-04-02 (the
  config carries only what the user explicitly asked for — why EDEP-03
  writes through the record, not the config), D-04-07 ("a plugin asked for
  by name is enabled" — the promotion precedent this phase generalizes).

### Docs to update
- `docs/plugin-enablement.md` §"A plugin required by another active plugin
  is not enabled on its behalf" (lines 40-46) — this is the divergence
  EDEP-03 reverses; REWRITE this subsection, don't append (it currently
  argues FOR the divergence being retired).
- `docs/output-catalog.md` § `/claude:plugin enable` / `disable` — the new
  EDEP-01/EDEP-03 rows; `notify-reasons.ts` header count and
  `tests/architecture/notify-closed-set-locks.test.ts` gate every new token.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `orchestrators/plugin/enable-disable.ts::createNodeSetPluginEnabled` /
  `resolveIdempotentOutcome` / `writeEnabledFlagBack` — the existing
  single-plugin enable/disable write path; has NO dependency awareness
  today (confirmed by reading the current source — no `dependency-index`
  import, no closure walk).
- `orchestrators/plugin/dependency-index.ts::buildScopeDeclarationIndex` —
  the offline declaration index Phase 5 built and Phase 6 reused; EDEP-02's
  guard is the same shape as D-05-14..16's retired uninstall guard (same
  declarer rules: disabled-but-installed still holds, same scope only,
  offline read, fail-closed on unreadable).
- `domain/dependency-closure.ts` — the post-order transitive-closure walk
  already used by the install cascade; EDEP-01's enable cascade reuses this
  ordering (ROADMAP Notes confirms this directly).
- `orchestrators/plugin/install-outcome.ts::runInstallLedger` — the enable
  branch already reuses this for materialization (ROADMAP Notes); EDEP-03's
  record-level enable write is a smaller operation than a full ledger run
  and should be traced against what the enable path currently calls, not
  assumed to need a new ledger phase.
- `docs/plugin-enablement.md` §40-46 — the exact prose being reversed,
  including the citation of the RESV-05 skip row this phase retires.

### Established Patterns
- Closed-set amendment lands in FULL in one commit (D-04-07; ten surfaces
  enumerated in `04-06-SUMMARY.md`): fixture, both contract constants,
  length lock, both enumeration pins, `notify-reasons.ts` count,
  `docs/output-catalog.md` state + byte counts, `catalog-parser.test.ts`
  tuple count.
- `notify.ts` is a dumb renderer; the orchestrator stamps status/reasons/
  severity, never notify itself.
- Both cognitive-complexity ceilings (ESLint sonarjs, fallow) are 15;
  `enable-disable.ts` and `dependency-index.ts` both already have several
  near-ceiling extracted helpers — extend with helpers, not branches.

### Integration Points
- `edge/handlers/plugin/enable-disable.ts::makeEnableDisableHandler` — the
  thin-shim edge handler for both `enable` and `disable`; EDEP-01's cascade
  and EDEP-02's guard both hang off `orchestrators/plugin/enable-disable.ts`
  underneath it, not the edge layer.
- `orchestrators/reconcile/plan.ts::classifyDeclaredPlugin` — D-06-03's LIFT
  path (clearing `dependencyDisabled` once satisfied) lives here for the
  reconcile path; this phase's MANUAL enable path is a separate call site
  (see Claude's Discretion above on whether it also clears the marker).
- `tests/architecture/no-orchestrator-network.test.ts` — verify whether
  `enable-disable.ts` needs adding to `FORBIDDEN_TARGETS` now that it reads
  the declaration index (should stay offline regardless, per NFR-5).

</code_context>

<specifics>
## Specific Ideas

- Row bytes the operator chose: the disable refusal renders as a
  plain-English instruction naming the dependents in disable order, not a
  shell-chainable command (D-08-01).
- The new EDEP-03 token is `{dependency enabled}` (D-08-02), read alongside
  the existing `dependency promoted` / `dependency disabled` / `dependency
  pruned` register.
- EDEP-01's enable cascade reports the full transitive closure, one row per
  dependency, including already-enabled ones (D-08-03) — matching the
  install cascade's verbosity, not a quieter diff-only report.

</specifics>

<deferred>
## Deferred Ideas

- **`BACKLOG DEPS-STATUS-01`** (a plugin whose dependency is partially
  installed is itself partial) — explicitly named in ROADMAP success
  criterion 4 as staying open; not upstream parity, not pulled into this
  phase.
- **A `list`/`info` marker distinguishing a consequence-disabled plugin
  from a user-disabled one** — named as out of scope back in Phase 6's
  CONTEXT.md; still not requested here.

### Reviewed Todos (not folded)
None — no pending todos matched this phase's scope (`todo.match-phase 8`
returned zero matches).

</deferred>

---

*Phase: 08-Enablement parity for dependencies*
*Context gathered: 2026-09-19*
