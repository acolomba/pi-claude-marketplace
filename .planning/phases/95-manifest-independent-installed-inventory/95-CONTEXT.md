# Phase 95: Manifest-independent installed inventory - Context

**Gathered:** 2026-08-08
**Status:** Ready for planning

<domain>
## Phase Boundary

The `/claude:plugin list` inventory path only. This phase decides how an
installed plugin record is classified and rendered when its name is absent from
a marketplace manifest that **loaded successfully**, without flattening the
partial or disabled states that already survive manifest absence.

Covers INV-01 (new `{not in manifest}` brace on installed rows), INV-02/03/04
(characterization of existing partial, `--installed`, and canonical-disabled
behavior), and BOUND-03 (the cross-scope orphan-fold path must distinguish a
failed manifest read from a successful read with no entry).

Does NOT cover `plugin info` (Phase 96), the disabled-state predicate repair
(Phase 97), or lifecycle and documentation reconciliation (Phase 98).

</domain>

<decisions>
## Implementation Decisions

### Reason braces on installed inventory rows

- **D-95-01:** Reverse the blanket omission of `reasons` on installed inventory
  rows using a **general rule**, not an allowlist: the row builder supplies
  whatever typed reasons apply and `shared/notify.ts` renders them, exactly as
  every other status arm already works. No gate in the render path restricting
  which reasons an installed row may carry. — **Reversibility:** reversible —
  the change is a single object field at `orchestrators/plugin/list.ts:485-499`;
  the renderer and the type already support it.

  Rationale for choosing the general rule over an allowlist: the house invariant
  is that orchestrators determine state and stamp reasons while `notify.ts`
  stays a dumb renderer. An allowlist living in the render path would invert
  that ownership.

- **D-95-02:** Record the durable-vs-transient principle as the editorial
  guidance governing which reasons belong on steady-state inventory rows.
  `{not in manifest}` is a **durable** property of the record's relationship to
  its marketplace — it stays true across reloads until either the manifest or
  the installation changes. The condition the original omission excluded was
  **transient**, tied to a pending action. Steady-state inventory rows may state
  durable facts; they should not carry pending ones.

  Under D-95-01 this is documented convention for future authors, not a
  code-enforced gate.

- **D-95-03:** The original rationale is not fully recoverable and must not be
  cited as though it were. The comments at `list.ts:323` and `list.ts:489`
  attribute the omission to keeping "the orphan-rewake brace" off inventory
  rows, citing `RLD-04 / D-08`. Neither ID is defined in any surviving artifact
  — a search across `extensions/`, `tests/`, `docs/`, and all of `.planning/`
  including the milestone archives finds them only in source comments
  (`list.ts` ×6, `tools.ts` ×3), and the term "orphan-rewake" appears nowhere
  but those two `list.ts` comments. When rewriting these comments, state the new
  durable-vs-transient rule directly rather than referencing the retired one.

### Fold-path manifest-absence signal (BOUND-03)

- **D-95-04:** Thread the manifest-load outcome by replacing
  `enumerateMarketplacePlugins`' `manifest: MarketplaceManifest | undefined`
  parameter (`list.ts:729`) with the **existing `ScopedManifest` bundle type**
  already declared at `list.ts:789-792`. Both call sites pass the whole
  destructure result rather than picking one field. — **Reversibility:** costly
  — the signature change touches both call sites plus the row builders
  downstream of it, though all are within one file.

  Rejected: adding a parallel `manifestLoaded: boolean` alongside the existing
  param. Two fields that must be kept consistent is the exact drift shape that
  allowed this defect, since a caller can pass a manifest and the wrong flag.

- **D-95-05:** The `{not in manifest}` brace is gated on
  `loadError === undefined && manifestEntry === undefined`. A folded row whose
  manifest was never successfully read renders its existing bare `(installed)`
  form with no brace — the row is preserved, only the false claim is suppressed.

  Rejected: mirroring the primary path's early return and skipping the fold
  entirely on load error. BOUND-03 forbids the false brace, not the row; dropping
  folded rows would hide installed plugins, cutting against the milestone thesis.

### LLM tool-surface projection

- **D-95-06:** Widen `pluginReasons` (`edge/handlers/tools.ts:370-382`) to
  forward reasons for **both** `installed` and `partially-installed`, joining the
  existing `unavailable` / `partially-available` / `upgradable` set. This lands
  in **Phase 95 alongside INV-01** so the slash-command and tool surfaces are
  verified together and cannot diverge across a phase boundary. —
  **Reversibility:** costly — widening an LLM-facing payload is easy to add and
  awkward to withdraw once agents rely on the field.

  This reverses the "Extending the LLM tool surface to carry the new reason" row
  currently in REQUIREMENTS.md § Out of Scope. See D-95-10 for how the amendment
  lands.

  Two findings drove the reversal:
  1. `projectRowStatus` (`tools.ts:159-172`) already **flattens** `installed`,
     `upgradable`, `partially-installed`, and `partially-upgradable` into a
     single tool status `"installed"`. Combined with `pluginReasons` dropping
     `partially-installed`, a degraded install is today **indistinguishable from
     a clean one** in the tool payload, and its unsupported-kind reasons are
     discarded. That information loss predates v1.18; accepting the asymmetry
     would inherit and extend it.
  2. `upgradable` already forwards reasons *and* already projects to
     `"installed"`, so "reasons do not belong on rows that read as installed" is
     not a principle the current code holds — it is an accident of which arms
     were listed.

  Implementation note: `PluginPartiallyInstalledMessage.reasons` is required
  (`notify.ts:871`) and drops in cleanly; `PluginInstalledMessage.reasons` is
  optional (`notify.ts:682`) and needs an undefined guard before the
  `.length > 0` check.

- **D-95-07:** COMPAT-01 still holds after the widening — it adds no status
  token, reason token, glyph, state field, migration, or network path.

### Characterization test strategy

- **D-95-08:** Characterization tests go in a **new dedicated file**,
  `tests/orchestrators/plugin/list-manifest-absent.test.ts`. `list.test.ts` is
  already 2481 lines, and this set has a distinct lifecycle: written before any
  production edit, with some cases deliberately widened by Phase 97. A separate
  file makes "what was pinned before anything changed" legible to the Phase 97
  executor. Matches existing subject splits (`git-source-probe` /
  `git-source-probe-upgrade`, `clone-gc` / `clone-gc-errors`).

- **D-95-09:** Assertions are **byte-exact rendered rows**, matching the
  project's existing byte-frozen output culture where `docs/output-catalog.md`
  is a contract and the catalog UAT gates compare byte-for-byte. This catches
  token, glyph, spacing, and ordering drift — the regression class INV-02 and
  INV-03 exist to prevent.

  Per INV-04, the characterization set covers the **canonical disabled shape
  only** (`enabled: false` with `compatibility.installable: true`). It must NOT
  pin the current partial-disabled rendering, which ENBL-06 deliberately changes
  in Phase 97.

### Scope and process

- **D-95-10 [informational]:** Executed before planning: the amendment landed
  as quick task `260808-dhm` (2026-08-08); INV-05 now exists in REQUIREMENTS.md,
  is mapped to Phase 95, and is covered by plan 95-02. Original decision text:
  The requirement amendment for D-95-06 lands as a **quick task
  after this discuss session**, matching the precedent already set twice on this
  branch (quick tasks `260807-q0v` and `260807-ur3`, both of which amended v1.18
  planning docs mid-milestone). The amendment must: remove the "Extending the
  LLM tool surface to carry the new reason" row from REQUIREMENTS.md § Out of
  Scope; add a requirement ID covering the widening and map it to Phase 95 in
  the traceability table; add it to Phase 95's requirement list in ROADMAP.md;
  and add a Phase 95 success criterion for the tool payload. **Planning must not
  start until this lands** — otherwise the planner works from a REQUIREMENTS.md
  that still lists the widening out of scope.

- **D-95-11 [informational]:** A deferral, not Phase 95 plan content: recorded
  in STATE.md's open-decisions section as deferred to Phase 96 discuss. Original
  decision text: Open decision 2 (component name fidelity on the state-only info
  arm) is **deferred to Phase 96 discuss**. It governs no Phase 95 code — list
  rows carry plugin names, not component names — and Phase 96's discuss will
  have the `info.ts` reconstruction in front of it. STATE.md's recorded gate
  should be re-pointed from "before Phase 95 planning" to "before Phase 96
  planning" so the gate stays honest.

### Claude's Discretion

- Exact naming of the new requirement ID for the tool widening (`INV-05`,
  `TOOL-01`, or similar) — settle it in the amendment quick task.
- Internal structure and fixture reuse within
  `list-manifest-absent.test.ts`.
- Whether the `ScopedManifest` param is threaded positionally or the signature
  is reshaped, provided both call sites pass the bundle.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Milestone specification
- `.planning/REQUIREMENTS.md` — v1.18 requirement set; INV-01..04 and BOUND-03
  are Phase 95's. Note the § Out of Scope row on the LLM tool surface is
  superseded by D-95-06 pending the D-95-10 amendment.
- `.planning/ROADMAP.md` §"Phase 95: Manifest-independent installed inventory" —
  goal and four success criteria. Its criterion 2 phrase "lifting the render
  map's suppression" is imprecise; see the code-context note below.
- `.planning/ROADMAP.md` §"Open decisions — resolve before Phase 95 planning" —
  decisions 1 and 3 are resolved here (D-95-01/02, D-95-06); decision 2 is
  deferred per D-95-11.

### Output contracts
- `docs/output-catalog.md` — byte-frozen rendering contract for every plugin row
  form. The authority for existing manifest-read-failure output per BOUND-01.
- `docs/messaging-style-guide.md` — reason composition and ordering rules,
  including the MSG-GR-4 rule that soft-dep markers append after typed reasons.
- `docs/prd/pi-claude-marketplace-prd.md` — note its PL-6 row describes the
  retired v1 renderer and is NOT authoritative; DOC-08 corrects it in Phase 98.

### Project conventions
- `.claude/rules/typescript-comments.md` — comment policy. Directly relevant
  when rewriting the `list.ts:323` / `list.ts:489` comments per D-95-03: keep
  requirement and decision IDs, drop planning-artifact references.
- `.planning/PROJECT.md` — house invariants, including the derive-not-persist
  rule and the resolver/notify ownership split.

</canonical_refs>

<code_context>
## Existing Code Insights

### INV-01 is a TWO-FILE edit — corrected 2026-08-08 after research

> **This section previously claimed there was no render-map suppression and that
> INV-01 was a single added field. That was WRONG and is corrected below.** The
> error came from reading the central `renderPluginRow` switch and assuming the
> list surface uses it. It does not.

The list surface does **not** render through `shared/notify.ts::renderPluginRow`.
It dispatches per-row through `context.render[row.status]` —
`shared/notify-context.ts:110-113` states this verbatim ("NOT the central
renderPluginRow switch"), and `list.ts:1210` routes through `LIST_CONTEXT`.

`LIST_RENDER.installed` (`orchestrators/plugin/list.messaging.ts:96-107`) passes
a hardcoded `undefined` as the `reasons` argument to `installedLikeRow`
(parameter at `shared/notify.ts:2147`). Its comment at `list.messaging.ts:90-92`
carries the same RLD-04 / D-08 orphan-rewake rationale as the `list.ts` one, and
adds the useful detail that the excluded brace was "an install-cascade surface"
— which supports the durable-vs-transient framing in D-95-02.

**INV-01 therefore requires both:**

1. `orchestrators/plugin/list.ts:485-499` — stamp `reasons` on the returned
   `PluginInstalledMessage` (the type already permits it, `notify.ts:682`).
2. `orchestrators/plugin/list.messaging.ts:96-107` — pass `p.reasons` instead of
   the hardcoded `undefined`.

Changing only (1) produces **zero visible output change**. The ROADMAP's original
criterion-2 wording was correct.

### INV-02 is not pure characterization

REQUIREMENTS.md INV-02 requires `not in manifest` **prepended** to the partial
row's existing unsupported-kind reasons. That is a second orchestrator edit on
the `partially-installed` construction path in `list.ts`, not merely a
characterization test. The `partially-installed` arm of `LIST_RENDER` routes
through `pluginRow`, which does forward `p.reasons`, so no render-map change is
needed for this arm — only the orchestrator-side reason composition.

### INV-04 is structurally guaranteed

`PluginDisabledMessage` has no `reasons` field, and `LIST_RENDER.disabled`
(`list.messaging.ts`) hardcodes `composeReasons(undefined, ...)`. A disabled row
cannot carry `{not in manifest}` by construction. INV-04's deliverable is
genuinely characterization only.

### Success criterion 3 is testable on the `installed` arm ONLY

`composeReasons` (`notify.ts:1990-2004`) pushes soft-dep markers **after** the
typed reasons, so ordering is existing behavior needing a regression test rather
than new implementation work.

But the criterion cites both INV-01 and INV-02, and the INV-02 half is not
testable: `pluginRow` (`notify.ts:2053-2073`), which renders the
`partially-installed` arm, hardcodes **both** soft-dep flags to `false` at
`notify.ts:2071`. Markers can never fire on a partial row. Only
`installedLikeRow` threads real `p.dependencies` values through.

Plan criterion 3 against the `installed` arm and record the partial-arm
limitation rather than writing a test that can only ever pass vacuously.

### The brace and the reload trailer are independent axes

The comment at `list.ts:486-490` bundles `needsReload: false` with the omitted
`reasons`, implying a shared rationale. They are unrelated:
`shouldEmitReloadHint` (`notify.ts:2889`) reduces over `needsReload` only —
explicitly "NOT status-token / cascade-kind inference" — and never reads
`reasons`. Adding `reasons` cannot re-trigger the reload trailer.

### BOUND-03 defect is at an exact line

- `list.ts:977` (fold path) — `const { manifest } = await
  loadMarketplaceManifestSoftly(projectMp);` discards `loadError`.
- `list.ts:853` (primary path) — `const { manifest, loadError } = ...` takes both.

The two paths are also asymmetric in a second way: the primary path
early-returns at `list.ts:862-874` when `loadError !== undefined`, so
enumeration never runs with an undefined manifest there. The fold path has no
such guard and proceeds to emit installed rows. That asymmetry is why only the
fold path can produce a false `{not in manifest}`.

### Reusable assets
- `ScopedManifest` interface (`list.ts:789-792`) — already exists; D-95-04
  reuses it rather than introducing a parallel signal.
- `"not in manifest"` is already a closed-set reason member
  (`shared/notify-reasons.ts:125`). No token growth; COMPAT-01 holds.
- `isRecordedButDisabled` (used at `list.ts:367`) — the canonical disabled
  predicate the INV-04 characterization pins. Phase 97 replaces its definition.

### Integration points
- `orchestrators/plugin/list.ts` — `installedRowMessage` (INV-01),
  `enumerateMarketplacePlugins` signature (BOUND-03), fold call site at 977.
- `edge/handlers/tools.ts` — `pluginReasons` at 370-382 (D-95-06).
- `tests/orchestrators/plugin/list.test.ts` — 2481 lines, ~40 existing
  disabled/partial assertions; the new characterization file sits beside it.

</code_context>

<specifics>
## Specific Ideas

- When rewriting the `list.ts` comments, do not carry `RLD-04 / D-08` forward as
  though they were resolvable anchors (D-95-03). Those IDs also appear at
  `tools.ts:161`, `tools.ts:327`, `tools.ts:392`, `list.ts:29`, `list.ts:100`,
  `list.ts:320`, `list.ts:994`, and `list.ts:1095`; this phase should only touch
  the ones in code it is already editing, not embark on a sweep.

</specifics>

<deferred>
## Deferred Ideas

- **Installed plugins hidden under a failed-manifest marketplace.** When a
  marketplace's `marketplace.json` fails to parse, the primary path
  (`list.ts:862-874`) emits a bare `(failed)` header with `plugins: []`, so
  every installed plugin under it disappears from the inventory even though
  `state.json` records them and their artifacts are on disk. BOUND-01
  deliberately retains this, and `docs/output-catalog.md:251` documents it as
  intended byte form. Out of scope for v1.18 — surfacing those records would
  need a new render form for a failed header carrying child rows. **Log to
  `.planning/BACKLOG.md`.**

- **Open decision 2 — component name fidelity** (`resources.*` holds
  Pi-generated installed names while `info` renders raw source names). Deferred
  to Phase 96 discuss per D-95-11.

### Reviewed Todos (not folded)

- **"Coverage sweep: test rare failure arms in update/reinstall/install"**
  (`.planning/todos/pending/2026-06-12-coverage-sweep-test-rare-failure-arms-in-update-reinstall-in.md`,
  matched at score 0.6 on generic keywords "marketplace, plugin"). Not folded:
  its subject is update/reinstall/install failure arms — mutation paths Phase 95
  does not touch. Phase 98's LIFE-04/05/06 regression sweep is the closer home
  if it belongs in v1.18 at all.

</deferred>

---

*Phase: 95-manifest-independent-installed-inventory*
*Context gathered: 2026-08-08*
