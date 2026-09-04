# Phase 109: Kind inversion - Context

**Gathered:** 2026-09-04
**Status:** Ready for planning

<domain>
## Phase Boundary

`workflows` stops meaning "detected and dropped" and starts meaning "supported".

Concretely, this phase changes what a workflow-bearing plugin *resolves as*, and
nothing else. It moves the kind across four resolver tuples and two manifest
schema field groups, retires the closed-set reason and classifier arm that PR
#154 wrote to mean the opposite, turns the three architecture-locking tests that
pin the old reading, and corrects `docs/output-catalog.md`.

**Not in this phase:** no bridge, no discovery, no staging, no envelope writing,
no path allocation. `bridges/workflows/` arrives in Phase 111 and the leaf
modules it needs in Phase 110. This phase does not import, reference, or
anticipate either beyond exposing `componentPaths.workflows` for Phase 111 to
read.

</domain>

<decisions>
## Implementation Decisions

### The `{workflows}` reason

- **D-109-01:** Retire the `{workflows}` member of the `REASONS` closed set —
  44 members become 43. It is the tail member, so removal leaves every other
  token's catalog index unmoved. The deletion covers the `REASONS` tuple entry
  in `shared/notify.ts`, the `UnsupportedReason` member in
  `shared/notify-reasons.ts`, and both the `UnsupportedReason` member and the
  `kindToReason` arm in `shared/probe-classifiers.ts`.
  — **Reversibility:** costly — re-adding it means a new tail append plus a
  catalog row, a renderer arm and a fixture in the same change, per the
  append-only discipline `compat-01` enforces.

  Rationale recorded so a later reader does not re-litigate it: no phase in
  this milestone produces a plugin-level workflows reason. Phase 111 reports
  refused scripts through `warnings[]`, not reasons, and the two workflow
  tokens the spike branch carries — `stale workflow command` and
  `requires pi-dynamic-workflows` — are separate closed-set members that land
  in Phases 113 and 114. Keeping the member would leave the catalog documenting
  output that no code path can emit, which is the same defect WINV-05 corrects
  in the prose.

- **D-109-02:** Record the removal by appending, not by rewriting.
  `tests/architecture/notify-closed-set-locks.test.ts` gains a new ledger line
  below the existing `WDET-04 / D-106-04: +1 … (43 -> 44)` line, reading as a
  reversal (`WINV-03: -1 for the retired workflows member (44 -> 43)`). The
  WDET-04 line stays. This matches the project comment policy: decision and
  requirement IDs are traceability and are kept; only planning refs are
  stripped.
  — **Reversibility:** reversible — comment text.

- **D-109-03:** Amend `compat-01-no-expansion.test.ts`'s assertion message
  narrowly. It currently reads "no reason token may be added, removed, or
  renamed". The new message keeps additions append-only at the tail and admits
  a removal **only** when a kind moves from unsupported to supported, and only
  when it arrives with its catalog rows in the same change. Do not replace it
  with a general "additions and removals both arrive with their catalog rows"
  rule — that stops naming the append-only tail discipline, which is the
  property the test's order-sensitive `deepEqual` actually enforces.
  — **Reversibility:** reversible — assertion message text; the enumeration
  above it is the real gate.

### The three catalog states

- **D-109-04:** Turn each of the three `catalog-state` blocks in
  `docs/output-catalog.md` into its post-inversion form rather than deleting
  it, so each fixture goes red against current code and green after.

  1. `workflow-partially-available-inventory` → the clean **not-installed**
     inventory row for a workflow-bearing plugin: no reason brace, no `⊖`.
  2. `workflow-partial-install-success` → the clean **`(installed)`** success
     row: `●`, no brace. This is WINV-02's user-visible inversion, byte-pinned.
  3. `workflow-install-rejection` → has no successor, because nothing rejects a
     workflow-only plugin any more. Repoint it to a plugin carrying `workflows`
     **and** a still-unsupported kind (e.g. `themes`). The rejection still
     renders, and its brace names the other kind — which is what proves
     `workflows` stopped contributing a token.

  `catalog-uat` pairs each annotation with its fixture's `notify()` output
  byte-for-byte and imposes no uniqueness rule across states, so two states
  rendering identical bytes is permitted. Verified by reading the pairing test
  (`tests/architecture/catalog-uat.test.ts`, the `CATALOG_STATE_RE` pairing and
  the "every annotation pairs byte-equal" test) — do not add a uniqueness
  workaround.
  — **Reversibility:** costly — each state is a byte contract paired against a
  fixture; changing one means changing both halves together.

- **D-109-05:** Rename the three `catalog-state` ids to match what the blocks
  now render (e.g. `workflow-installed-inventory`,
  `workflow-install-success`, `workflow-plus-unsupported-rejection`) and retag
  the section headings from `(WDET-04)` to `(WINV-04)`. `catalog-uat` pairs
  purely by id string, so a rename is mechanically free. An id reading
  "partial" above a clean row is the same stale-contract problem WINV-05
  corrects in the prose.
  — **Reversibility:** reversible — id strings, changed in two paired places.

### The 109-111 window

- **D-109-06:** Accept that between this phase and Phase 111 a workflow-bearing
  plugin resolves `installable`, renders `● (installed)` with no brace, and
  materializes zero workflow commands — which is less honest than today's
  `partially-available {workflows}`. Record the intermediate state explicitly in
  this phase's SUMMARY and VERIFICATION, and cut no release from the branch
  before Phase 111 lands.

  Containment evidence: this is `features/workflow`; `ci.yml` deliberately
  carries no `push` trigger on `features/**`; the milestone runs end to end in
  one session. The window has no external surface.

  Two alternatives were considered and rejected. Splitting the tuples (remove
  from `UNSUPPORTED_COMPONENT_KINDS` now, add to the supported tuples at 111)
  leaves `workflows` in neither closed set — precisely the silently-ignored-kind
  failure the T-02-25 security note on `UNSUPPORTED_COMPONENT_KINDS` warns
  about, so it is strictly worse than the window it avoids. A temporary
  install-time note would need its own closed-set reason and catalog state,
  both retired again in Phase 111, in a phase that has already changed the
  reason set once.
  — **Reversibility:** reversible — an accepted intermediate, closed by Phase
  111 landing.

### How far the proof reaches

- **D-109-07:** Prove WINV-02 at two levels.

  1. **Resolver owner test** (`tests/domain/resolver.test.ts`): the
     `{ kind: "workflows", relativePath: "workflows", stat: "dir" }` row at
     line 101 leaves the `unsupportedConventionScenarios` table and becomes a
     supported-convention case asserting the `installable` arm and a populated
     `componentPaths.workflows`. Mandatory regardless under the
     corresponding-test rule, since `domain/resolver.ts` is the module changing.
  2. **Install-level window test**: drive a real install of a workflow-bearing
     plugin and assert **both** halves — it succeeds with no `--partial`, and
     no workflow artifact exists on disk. This turns D-109-06's accepted window
     from an undocumented gap into a pinned fact.

  The `--partial`-free success half survives Phase 111 unchanged. The
  no-artifact half is inverted there deliberately; see the Deferred Ideas
  section for the carry-forward.
  — **Reversibility:** reversible — test-side; the second assertion is expected
  to flip in Phase 111.

### Claude's Discretion

- Comment wording throughout, and which file carries which half of the reason
  deletion.
- The fixture plugin name and shape used by the install-level window test, and
  the choice of second unsupported kind for the repointed rejection state
  (`themes` is a suggestion, not a requirement).
- Whether the resolver exports a `SupportedKind` type alongside
  `SUPPORTED_COMPONENT_KINDS`. The spike branch does
  (`resolver.ts:340` on `features/workflows-spike`); main does not. Export it
  only if something in this phase needs it — do not add an unused export, which
  `fallow dead-code` would flag.
- Whether the manifest schema move (`workflows` from
  `UNSUPPORTED_COMPONENT_FIELDS` to `SUPPORTED_COMPONENT_PATH_FIELDS` in
  `domain/components/plugin.ts`) also gets a positive locking test mirroring the
  `HOOK-01: UNSUPPORTED_COMPONENT_KINDS does NOT contain 'hooks'` precedent in
  `tests/architecture/hooks-foundation.test.ts`. The precedent exists and the
  mirror is cheap; take it if it does not duplicate what the resolver owner
  test already proves.
- Rewording the `notify.ts` doc comments at lines 930 and 1778 that name
  workflows as a `--partial` example. They become false and must change; the
  wording is open.

</decisions>

<amendments>
## Amendments from Research (2026-09-04)

`109-RESEARCH.md` applied the full production change to a scratch tree and ran
every gate, then reverted. Four findings refine the decisions above. None
reverses one; each is now part of the locked set.

- **A-01 — five locking tests go red, not three.** Criterion 4 and D-109-04 name
  `compat-01-no-expansion`, `catalog-uat` and `notify-closed-set-locks`. Two more
  fail and must be turned with them: `tests/architecture/hooks-foundation.test.ts:199`
  pins `SUPPORTED_COMPONENT_KINDS` as an exact 4-tuple, and
  `tests/shared/notify.test.ts:5008` carries a **second** `REASONS.length === 44`
  assertion. Both are measured red. The `hooks-foundation` turn is also the
  natural home for the optional positive mirror
  (`UNSUPPORTED_COMPONENT_KINDS` does NOT contain `workflows`) that the
  Claude's-Discretion list leaves open — take it; the `hooks` precedent sits at
  line 207 of the same file.

- **A-02 — turn the catalog doc blocks BEFORE the production change.**
  `catalog-uat`'s three workflow fixtures pass `reasons: ["workflows"]` as string
  literals and the renderer prints what it is handed, so with only production
  edited the test is red at `tsc` but **green at runtime**. Editing the doc
  blocks first is what makes the failure observable, which is what criterion 4
  actually asks for. Rename each state's id in both homes in the same edit — the
  inverse-walk gate fails on a fixture id with no annotation.

- **A-03 — do not bump `EXTENSION_VERSION` during the 109-111 window.** A second,
  independent reason for D-109-06's "cut no release". `orchestrators/reconcile/backfill.ts:343`
  runs `supportedSetGrew` over records at `installable: false`, which is exactly
  where a pre-inversion `--partial`-installed workflow-bearing record sits. Its
  supported set now grows by `workflows`, so the scan would reinstall it — but
  the scan is gated on `state.lastReconciledExtensionVersion === EXTENSION_VERSION`
  (`backfill.ts:76`), and the version stays `0.18.1` through this phase, so it
  never runs. A version bump inside the window would fire that convergence while
  no bridge exists to materialize anything. Record this in the SUMMARY.

- **A-04 — State 1's id is `workflow-available-inventory`.** D-109-05's example
  `workflow-installed-inventory` sits above a block that renders `(available)`,
  not `(installed)` — the not-installed inventory row. The ids in D-109-05 are
  marked "e.g.", so this settles a naming choice inside the decision rather than
  changing it. Use the id that matches the bytes, which is the whole point of
  D-109-05.

</amendments>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### The requirements and the milestone framing

- `.planning/workstreams/workflows/REQUIREMENTS.md` — WINV-01..05 and the
  seams comment above them, which enumerates every file this phase touches.
- `.planning/workstreams/workflows/ROADMAP.md` §"Phase 109: Kind inversion" —
  goal, dependencies, and the six success criteria.
- `.planning/workstreams/workflows/STATE.md` §"Replay Ground Truth" — why this
  is a replay rather than a merge, and what main changed underneath the spike.
- `.planning/workstreams/workflows/port/README.md` — what
  `features/workflow-port-wip` carries verbatim, what it rewrites, and what it
  deliberately leaves out. Phase 109 ports nothing, but this records why
  `bridges/workflows/stage.ts` cannot compile until `componentPaths.workflows`
  exists.

### The seams this phase edits

- `extensions/pi-claude-marketplace/domain/resolver.ts` — `SUPPORTED_COMPONENT_KINDS`
  (line 351), `SUPPORTED_COMPONENT_PATH_KINDS` (line 360),
  `UNSUPPORTED_COMPONENT_KINDS` (line 380), `UNSUPPORTED_COMPONENT_CONVENTIONS`
  (line 392).
- `extensions/pi-claude-marketplace/domain/components/plugin.ts` §`SUPPORTED_COMPONENT_PATH_FIELDS`
  / `UNSUPPORTED_COMPONENT_FIELDS` (lines 29-46).
- `extensions/pi-claude-marketplace/shared/notify.ts` — the `REASONS` tuple
  tail (the `"workflows"` entry at line 237) and the `--partial` doc
  comments at lines 930 and 1778.
- `extensions/pi-claude-marketplace/shared/notify-reasons.ts` — the
  `UnsupportedReason` group (line 107) and the count narrative in the header
  comment (line 26).
- `extensions/pi-claude-marketplace/shared/probe-classifiers.ts` — the
  `UnsupportedReason` alias (line 76), `kindToReason` (line 207), and the four
  doc comments naming workflows (lines 73, 82, 101, 170, 204).
- `docs/output-catalog.md` — prose at lines 63, 65, 147, 1947, 1949 and the
  three `catalog-state` blocks at lines 431, 565, 618.

### The gates that must be turned

- `tests/architecture/compat-01-no-expansion.test.ts` — the 44-token
  enumeration (`"workflows"` at line 173) and its assertion message.
- `tests/architecture/notify-closed-set-locks.test.ts` — `REASONS.length`
  (line 51) and the ledger comment above it (lines 49-50).
- `tests/architecture/catalog-uat.test.ts` — the three workflow fixtures at
  lines 907, 1211, 1316.
- `tests/domain/resolver.test.ts` — `unsupportedConventionScenarios` line 101.
- `tests/architecture/hooks-foundation.test.ts` — line 207, the precedent for a
  positive tuple-membership gate.

### Project standards that constrain the edits

- `CLAUDE.md` §Constraints — the quality bar (`npm run check` = typecheck +
  ESLint + fallow + Prettier + unit + integration) and the closed-set /
  containment constraints.
- `.planning/codebase/CONVENTIONS.md` §Fallow — the two independent complexity
  gates and the "a gate wants a test that plants the violation, not one that
  reads the config" rule.
- `.claude/rules/typescript-comments.md` — comments cite decision and
  requirement IDs, never planning refs (no `Phase NN`, `Plan NN`, `Wave N`,
  `Pitfall N`).
- `docs/messaging-style-guide.md` — referenced by the install-rejection catalog
  state as the frozen source of the `--partial` hint wording; the repointed
  state must not disturb it.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- **The convention probe needs no new code.** `SUPPORTED_COMPONENT_PATH_KINDS`
  derives each kind's convention directory from the kind name itself
  (`skills` → `<pluginRoot>/skills/`), the same way `UNSUPPORTED_COMPONENT_CONVENTIONS`
  maps `workflows` → `workflows` today. So moving the kind between tuples and
  deleting its `UNSUPPORTED_COMPONENT_CONVENTIONS` entry keeps the identical
  probe. WINV-01's "only which tuple reads it changes" is literally true.
- **`features/workflows-spike` is prior art for the tuple edits.**
  `resolver.ts:333` (five-member `SUPPORTED_COMPONENT_KINDS`), `resolver.ts:355`
  (four-member `SUPPORTED_COMPONENT_PATH_KINDS`), `resolver.ts:373`
  (seven-member `UNSUPPORTED_COMPONENT_KINDS`) and the `plugin.ts` field move
  are exactly the four edits this phase makes. Read them for shape.
  The spike is **silent on the reason** — it predates PR #154, which is what
  added the `{workflows}` member — so it offers no guidance on D-109-01.
- **`hooks-foundation.test.ts:207`** is the in-repo precedent for a positive
  tuple-membership gate (`UNSUPPORTED_COMPONENT_KINDS` does NOT contain
  `hooks`), if a mirror is taken.

### Established Patterns

- **Closed-set amendments are byte-pinned and catalog-paired.** A reason token
  never moves alone: `compat-01` pins membership and order by enumeration,
  `notify-closed-set-locks` pins the length, `catalog-uat` pins the rendered
  bytes, and `docs/output-catalog.md` carries the human contract. All four move
  together or the phase is not done.
- **`notify.ts` is a dumb renderer.** Commands determine state and stamp
  severity and reasons; the renderer must not probe. Nothing in this phase may
  add a state probe to `notify.ts`.
- **The `unsupported` array is typed `string`, not a closed union** (`TD-3`
  comment above `kindToReason`), because it legitimately carries `hooks` — a
  supported kind flagged as dropped — alongside the `UnsupportedKind` literals.
  Deleting the `workflows` arm therefore changes no type, only a branch.

### Integration Points

- **`componentPaths.workflows` is the seam Phase 111 reads.** `PartialResolution.componentPaths`
  is `{ skills: string[]; commands: string[]; agents: string[] }` today
  (`resolver.ts:410`, mirrored in `emptyResolution` at `resolver.ts:438`); adding `workflows` widens both, and
  `bridges/workflows/stage.ts` on `features/workflow-port-wip` fails to
  typecheck until it exists. That single field is this phase's entire forward
  contract.
- **`orchestrators/plugin/install.messaging.ts:416`** carries a comment about a
  `contains ${kind}` note per `UNSUPPORTED_COMPONENT_KINDS` member; check
  whether it names workflows.
- **`shared/errors.ts:526`** comments on `hooks` not being an
  `UNSUPPORTED_COMPONENT_KINDS` member — adjacent prose worth a read, likely
  untouched.

</code_context>

<specifics>
## Specific Ideas

- The retirement is the tail member deliberately: `compat-01` asserts order with
  `deepEqual`, so removing the last element is the only removal that leaves
  every surviving token's index unmoved. Do not reorder anything else while
  making it.
- The repointed rejection state must keep rendering a rejection. If the second
  unsupported kind chosen does not actually produce the `partially-available`
  arm plus the `--partial` hint trailer, pick a different one rather than
  editing the expected bytes to match whatever comes out.
- "Seen to fail against the old code and pass against the new" (criterion 4) is
  a real obligation, not a figure of speech. Each of the three turned gates
  should be observed red before the production change and green after.

</specifics>

<deferred>
## Deferred Ideas

- **Phase 111 must flip the install-level window assertion.** D-109-07's second
  test asserts *no workflow artifact exists on disk* after installing a
  workflow-bearing plugin. That is true only until `bridges/workflows/` lands.
  Phase 111 has to invert it to assert the envelopes **are** written. Carry this
  into Phase 111's CONTEXT.md so it is not left behind — an assertion that
  quietly stays green while meaning the opposite is worse than no assertion.
- **`docs/workflows-compatibility.md` does not exist yet** and is Phase 114's
  deliverable (WDOC-01..03). Nothing in this phase creates or references it.
- **The soft-dependency marker** (`requires pi-dynamic-workflows`) and the
  `stale workflow command` reason are Phase 114 and Phase 113 closed-set
  additions respectively. They are the reason D-109-01 does not try to
  repurpose the retired token — but they are not this phase's work, and this
  phase must not pre-add them.
- **`WNAM-06` needs rewording** — it requires reuse of a shared colon-name
  helper that does not exist on this branch. Recorded in
  `.planning/workstreams/workflows/port/README.md`; belongs to Phase 110.

</deferred>

---

*Phase: 109-Kind inversion*
*Context gathered: 2026-09-04*
