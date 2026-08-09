# Phase 96: Installation-record-backed plugin info - Context

**Gathered:** 2026-08-08
**Status:** Ready for planning

<domain>
## Phase Boundary

`plugin info` on a manifest-absent installation renders truth from the local
installation record: status/version from the record (INFO-09/10), the component
inventory reconstructed from `resources.*` plus the materialized hooks config
(INFO-11), network-free even under `--fetch` with a zero-call assertion
(INFO-12), while the read-failure versus unknown-name boundaries stay locked
(BOUND-01/02). The existing disabled carve-out runs before this path and keeps
doing so. No persistence changes, no update-semantics changes, no new scope.

</domain>

<decisions>
## Implementation Decisions

### Component name fidelity (resolves D-95-11)
- **D-96-01:** The state-only info arm renders the **Pi-generated installed
  names exactly as `resources.*` holds them** (`<plugin>-<skill>`,
  `<plugin>:<command>`, `pi-claude-marketplace-<plugin>-<agent>`), with MCP
  servers rendering their raw source keys (the sole exception, by data shape).
  The divergence from the manifest-backed arm's source names is **documented,
  not engineered away** — no reverse-mapping, no prefix stripping. Rationale:
  truthful-to-disk (these are the names the user sees in Pi after `/reload`),
  zero inference risk, and INFO-11's own "documented rather than engineered
  away" posture. Where to document: the output-catalog entry for the state-only
  info block (Phase 96) and the PRD/design-doc reconciliation (Phase 98
  DOC-08).

### Folded-row manifest authority (closes the Phase 95 carrier todo)
- **D-96-02:** A cross-scope folded row describes **its own record's
  manifest** for all three facts — absence claim, upgradable derivation, and
  description — ratifying the Phase 95 fix-loop semantics (`ManifestLookup`,
  commit 06875fa4) as the settled contract. Phase 96 pins it with regression
  coverage and closes the `docs/output-catalog.md` "still open under
  BOUND-01/02" note. BOUND-01 retains the bare `(failed)` header with no child
  rows when an owning manifest fails to load — the wholesale non-render under a
  failed user-scope manifest is the pinned contract, not a defect.
  — **Reversibility:** costly — reopening the choice re-splits the single
  `ManifestLookup` value into per-fact manifest sources across the fold path
  and invalidates the catalog paragraph and the regression pins this phase
  adds.

### Hooks-config degradation rendering (INFO-11)
- **D-96-03:** **Truthful split.** Record has no hooks → the hooks line is
  omitted (a true negative). Record HAS hooks (`resources.hooks` non-empty)
  but the materialized config is missing, unreadable, or malformed → the hooks
  line renders with an **explicit degradation marker** so the operator sees
  entries exist but could not be listed. The exact token/wording is chosen at
  planning through the closed-set catalog process — reuse existing reason
  vocabulary if one fits; a new token is a deliberate catalog amendment. The
  read passes `assertPathInside` (state-supplied slug), and no failure shape
  ever fails the whole info block.

### `--fetch` on state-only records (INFO-12)
- **D-96-04:** `info --fetch` on a manifest-absent record renders the info
  block from local truth and **visibly reports the fetch as skipped**, reusing
  the `(skipped) {not in manifest}` vocabulary precedent from update. The
  user's flag is never silently swallowed. The network guard is asserted with
  a zero-call check against injected clone/auth seams — not inferred from
  control flow — because the reorder makes fetch-capable builders reachable
  for the state-only arm.

### Claude's Discretion
- Exact placement of the state-only arm within `info.ts`'s dispatch (where the
  reorder slots relative to the fetch-capable builders), provided the early
  disabled carve-out stays first and INFO-12's guard is structural.
- The degradation marker's exact token/wording (D-96-03) within the closed-set
  process.
- Test file organization for the new info characterization/regression suites.
- Where the D-96-01 divergence note lands inside the catalog entry's prose.

### Folded Todos
- `2026-08-08-folded-row-manifest-choice-for-upgradable-description.md`
  (resolves_phase: 96) — folded: D-96-02 settles the question it carried; the
  phase pins the semantics and closes the catalog's open note.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements and contracts
- `.planning/REQUIREMENTS.md` §INFO-09..12, §BOUND-01/02 — the six phase
  requirements with their carve-outs (path-source arm derivation NOT unified;
  PRD PL-6 row not authoritative)
- `docs/output-catalog.md` — the binding user contract; carries the two Phase
  95 manifest-absent states and the "still open" folded-row note D-96-02
  closes; new info states land here under the byte-equality gate
- `.planning/phases/95-manifest-independent-installed-inventory/95-CONTEXT.md`
  — Phase 95 decisions (D-95-01..11) that this phase's semantics extend

### Phase 95 delivered state (the baseline this phase builds on)
- `extensions/pi-claude-marketplace/orchestrators/plugin/list.ts` — the
  `ManifestLookup` discriminated value (`declared`/`absent`/`unverified`),
  `manifestLookupFor`, the discriminated `ScopedManifest` union, and the fold
  path whose semantics D-96-02 ratifies
- `extensions/pi-claude-marketplace/orchestrators/plugin/info.ts` — the 1945-
  line orchestrator this phase reorders; the early `not in manifest` return
  currently precedes every fetch-capable row builder (INFO-12's by-construction
  guarantee that the reorder dissolves)
- `tests/orchestrators/plugin/list-manifest-absent.test.ts` — the Phase 95
  characterization suite whose fixture idioms (hermetic HOME, seedMarketplace,
  byte-exact join("\n") assertions) the new info suites should mirror

### Cross-phase carriers
- `.planning/todos/pending/2026-08-08-notify-stale-comments-doc08-reconciliation.md`
  — Phase 98 DOC-08 carrier; D-96-01's divergence documentation adds to what
  Phase 98 reconciles (do NOT edit shared/notify.ts comments in Phase 96)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `ManifestLookup` + `manifestLookupFor` (`list.ts`): the settled absence-
  authority seam; info's state-only arm should judge absence the same way
  rather than reimplementing the gate.
- `loadMarketplaceManifestSoftly` / manifest-cache: memoized offline manifest
  reads — the info path reuses them; no new load machinery.
- Phase 95 test fixtures (`list-manifest-absent.test.ts`): hermetic-HOME
  seeding and byte-exact assertion idioms to copy (helpers are file-private by
  house convention — copy, don't import).
- `(skipped) {not in manifest}` vocabulary (update path): the D-96-04 skip
  note's precedent.

### Established Patterns
- Orchestrator stamps reasons; `notify.ts` renders them (D-95-01..03) — no
  allowlist in the render path.
- All disk reads through containment (`assertPathInside`, NFR-10); the
  materialized hooks.json read is state-supplied-slug data.
- NFR-5: info is offline; the INFO-12 zero-call assertion joins the existing
  architecture-gate style (injected seams, not control-flow inference).
- Characterize before change: pin the current manifest-backed info output
  byte-exact before the reorder (the operator's standing instruction).

### Integration Points
- `info.ts` dispatch order: disabled carve-out → (reordered) state-only arm →
  fetch-capable builders; the reorder is the phase's structural move.
- `info.messaging.ts` (76 lines): the render map that will need the state-only
  arm's message shapes.
- `edge/handlers/plugin/info.ts`: flag surface for `--fetch` (D-96-04's skip
  note lane).

</code_context>

<specifics>
## Specific Ideas

- The absence claim on the info arm must be judged against the record's own
  manifest — same authority rule as list (D-96-02); a divergent-path info
  target renders its truthful state, never a suppressed or borrowed claim.
- BOUND-02 regression: a name absent from both a valid manifest and
  installation state stays `(failed) {not in manifest}` — pin it byte-exact.
- INFO-10's partial arm derives from the persisted record on the state-only
  arm (the path-source live-resolver arm is explicitly NOT unified in v1.18).

</specifics>

<deferred>
## Deferred Ideas

### Reviewed Todos (not folded)
- `2026-06-12-coverage-sweep-test-rare-failure-arms-in-update-reinstall-in.md`
  — update/reinstall/install failure-arm coverage; out of this phase's info
  scope, stays pending.
- `2026-08-08-notify-stale-comments-doc08-reconciliation.md` — Phase 98 DOC-08
  carrier (resolves_phase: 98); referenced here only so D-96-01's new
  divergence documentation is added to its reconciliation list.

</deferred>

---

*Phase: 96-installation-record-backed-plugin-info*
*Context gathered: 2026-08-08*
