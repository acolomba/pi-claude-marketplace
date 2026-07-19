# Phase 65: Force Install & Update - Context

**Gathered:** 2026-06-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Wire a per-invocation `--force` flag into the `install` and `update` commands so
that on an `unsupported` plugin they DEGRADE (install the supported components,
skip the unsupported ones) instead of blocking. `--force` is the only opt-in to
degradation; without it, an `unsupported` plugin still blocks/fails. Hard
failures (`unavailable`/structural defects, NFR-10 path containment, missing
marketplace, unresolvable source) block regardless of `--force`. No force path
emits a `Warning:` summary.

Builds directly on Phase 64: the `requireForceInstallable` gate (currently
test-only) and the `unsupported` arm carrying `pluginRoot` + supported/unsupported
component lists.

Requirements FORCE-01..05 and the five success criteria are locked by the
ROADMAP — discussion below is HOW, not WHAT.

</domain>

<decisions>
## Implementation Decisions

### Severity scope (FORCE-04 boundary)
- **D-65-01:** MINIMAL severity in this phase — Phase 65 only guarantees that
  no `Warning:` summary is emitted on any force path (FORCE-04); force-degrade
  rows render at info-level to the extent needed to honor that. The full
  severity ladder (SEV-01..05) is DEFERRED to Phase 69, because SEV-03/04/05
  reference `force-upgradable` and the derived `force-installed` state, which
  are born in Phase 66 and stamped in Phase 69. Without `--force`, an
  `unsupported` plugin keeps the existing blocking behavior (the
  `requireInstallable` throw); the improved error message that points the user
  at `--force` is Phase 69 (SEV-02), not here.

### Materialize path (FORCE-01)
- **D-65-02:** Reuse the SINGLE existing supported-components materialize path.
  Both the `installable` and `unsupported` arms expose the same
  supported-components list + `pluginRoot`, and the existing materialize path
  only ever installs supported components — so the `unsupported` arm naturally
  skips the unsupported ones with no separate force-degrade branch. The ONLY
  force-specific difference in the orchestrator is gate selection.

### Gate branching (FORCE-01, FORCE-05)
- **D-65-03:** Select the gate by the force flag:
  `force ? requireForceInstallable(resolved, op) : requireInstallable(resolved, op)`.
  A fully-supported plugin resolves `installable`, so the wider force gate
  admits it unchanged — `--force` on a supported plugin is INERT and installs
  as `(installed)` (FORCE-01 no-op). No special-casing/short-circuit for the
  no-op. `requireForceInstallable` still rejects `unavailable`/structural
  defects (FORCE-05), so force never bypasses hard failures.

### update --force target (FORCE-02)
- **D-65-04:** `update --force` degrades against the RESOLVED CANDIDATE (target,
  newer) version's supportability — `requireForceInstallable` is applied to the
  no-network-resolved candidate. If the newer version became `unsupported`,
  force degrades its now-unsupported components; an `unavailable`/structural
  candidate still blocks. Not the currently-installed version's state.

### Flag parsing
- **D-65-05:** Parse `--force` in the install/update edge handlers following the
  EXISTING reinstall pattern — `extractLocalFlag(args, ctx, USAGE, [...,
  "--force"])` plus a boolean threaded into the orchestrator options object
  (mirrors `edge/handlers/plugin/reinstall.ts`). Note: reinstall's own
  `--force` (overwrite collisions/foreign content) is a DIFFERENT semantic and
  is removed in Phase 67 (RINST-01) — Phase 65 does not touch reinstall.

### Claude's Discretion
- Exact orchestrator option field name for the force boolean, helper naming,
  and where in the install/update preflight the gate branch sits — left to
  planning, provided behavior matches D-65-01..05.
- Usage-string and router help-text wording for the new `--force` on
  install/update (the byte-exact catalog forms are reconciled in Phase 70/DOC).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 64 foundation (the gate + arm this phase consumes)
- `extensions/pi-claude-marketplace/domain/resolver.ts` — `requireForceInstallable`
  / `requireInstallable` gates, the three-way `state` union, the `unsupported`
  arm payload (supported/unsupported lists + `pluginRoot`).
- `.planning/phases/64-resolver-three-way-state/64-CONTEXT.md` — D-64-01..07
  (string `state` discriminant, structural precedence, minimal `unavailable`).

### Command + orchestrator surfaces being changed
- `extensions/pi-claude-marketplace/edge/handlers/plugin/install.ts` — flag
  parsing via `extractLocalFlag`; orchestrator call site.
- `extensions/pi-claude-marketplace/edge/handlers/plugin/update.ts`
- `extensions/pi-claude-marketplace/edge/handlers/plugin/reinstall.ts` — the
  `--force` extraction/threading pattern to mirror (D-65-05).
- `extensions/pi-claude-marketplace/orchestrators/plugin/install.ts` — the
  `requireInstallable(resolved, "install")` call (~line 475) + materialize path.
- `extensions/pi-claude-marketplace/orchestrators/plugin/update.ts` — the
  `requireInstallable(resolved, "update")` call (~line 710) + candidate resolve.

### Requirements & specs
- `.planning/REQUIREMENTS.md` — FORCE-01..05 (and the SEV-/FSTAT-/LIST-/RINST-
  rows that are explicitly OUT of scope for this phase).
- `.planning/ROADMAP.md` — Phase 65 goal + success criteria.
- `docs/output-catalog.md` — current install/update row byte forms (the
  reconciled `--force` token set is finalized in Phase 70/DOC, not here).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `requireForceInstallable` (resolver.ts) — added in Phase 64, test-only so
  far; this phase makes it live on the orchestrator force path.
- `extractLocalFlag` + the reinstall `--force` token loop
  (edge/handlers/plugin/reinstall.ts:33,46-50,75) — the flag-extraction +
  options-threading template.
- The existing install/update materialize path that iterates supported
  components only — reused unchanged for the degrade case (D-65-02).

### Established Patterns
- Edge handler parses flags, splits the ref, calls the orchestrator; PI-3/4/5
  user-contract notifications are emitted by the orchestrator, not the handler.
- Comment/test-title policy (`.claude/rules/typescript-comments.md`): use
  D-65-NN / FORCE-NN / NFR-N IDs, never GSD phase/plan references.
- All user-visible messages go through `ctx.ui.notify` (IL-2).

### Integration Points
- `edge/completions/provider.ts` already has a `--force` completion entry and
  reinstall positional handling — completion BEHAVIOR for `--force` install/
  update (LIST-02) is Phase 67, not this phase.

</code_context>

<specifics>
## Specific Ideas

The phase is intentionally narrow: it is the behavioral wiring of `--force`
onto the Phase 64 gate, with the no-`Warning:` guarantee (FORCE-04) as the only
severity-adjacent obligation. Everything about how the resulting force state is
DISPLAYED (glyphs, `force-installed` token, `info` dropped-component detail,
will-force preview, list filters, completion, severities) belongs to later
phases (66/67/69).

</specifics>

<deferred>
## Deferred Ideas

- Derived `force-installed`/`force-upgradable` state, `◉` glyph, will-force
  preview tokens, `info` dropped-component detail — Phase 66 (FSTAT-01..07).
- `--unsupported` list filter, `--force` completion sets, reinstall-as-repair
  (drop reinstall `--force`) — Phase 67 (LIST-01/02, RINST-01).
- Load-time backfill of previously-skipped components — Phase 68.
- Full force-path severity ladder SEV-01..05 (incl. the `--force`-citing error
  message for no-force unsupported, and force-upgradable severities) — Phase 69.
- Byte-exact token/catalog reconciliation + PRD §11 — Phase 70 (DOC-01/02).

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 65-force-install-update*
*Context gathered: 2026-06-27*
