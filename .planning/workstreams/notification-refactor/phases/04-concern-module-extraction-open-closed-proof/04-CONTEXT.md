# Phase 4: Concern-module extraction & open-closed proof - Context

**Gathered:** 2026-06-24
**Status:** Ready for planning

<domain>
## Phase Boundary

The milestone-closing phase. Two cross-cutting concerns leave the `notify.ts`
monolith, `notify.ts` slims to its essential spine, and the open-closed target is
**measured and proven** against the audit baseline.

1. **MOD-04** — extract into concern-modules (direct-function-call style, D-01):
   - the **hooks summary** (`appendHooksBlock`, `COMPONENT_KINDS`, the
     `HookSummaryEntry` rendering)
   - the **soft-dep marker injection** (`DEPENDENCIES`, `SOFT_DEP_MARKER_AGENTS`/
     `SOFT_DEP_MARKER_MCP`, the probe-to-marker mapping, the soft-dep branch of
     `composeReasons`).
   `shared/notify.ts` slims to: the **envelope** (`NotificationMessage`, the
   `notify()` dispatcher), the **reducer spine** (max-severity / OR-needsReload /
   tally / summary-line), and the **shared presentation vocabulary** (`ICON_*`,
   `renderScopeBracket`, `renderVersion`, `composeVersionArrow`, the core
   `composeReasons`, `pluginRow`, `joinTokens`).
2. **MOD-05** — prove (documented measurement, D-02) that adding a command touches
   **≤3 central files** (router registration, `register.ts` wiring, one catalog
   section) and **0 `notify.ts` edits**, vs the research baseline of 5 (no new
   grammar) / 9–11 (new grammar).
3. **MOD-06** — document the catalog floor (one central catalog section per new
   rendered state; no generation/aggregation seam; deliberately deferred).
4. **GATE-03** — `npm run check` (typecheck + ESLint + Prettier + tests) green and
   `catalog-uat` byte-equality holds at the milestone close.

**Output-neutral:** extraction is a pure refactor — `catalog-uat` stays
byte-identical; no rendered output changes.

</domain>

<decisions>
## Implementation Decisions

### D-01: Concern wiring — direct function calls (no concern-registry)
Each concern is a standalone module under `shared/concerns/` (e.g.
`shared/concerns/soft-dep.ts`, `shared/concerns/hooks.ts`) that **owns its data and
logic** and **exports plain functions** the central composer imports and calls
directly. **No `Concern` interface, no concern-registry, no iterated contribution
list** — mirrors the Phase 1 "forget the registry" choice. Static, traceable
imports.
- **Soft-dep concern** owns `DEPENDENCIES`, `SOFT_DEP_MARKER_AGENTS`/`_MCP`, and the
  probe-to-marker mapping; the central `composeReasons` calls into it for the
  soft-dep marker branch. The `softDepStatus(pi)` **probe stays threaded by the
  renderer** (environment is the renderer's job per the milestone through-line —
  "renderer owns presentation + environment"); the concern module is pure given the
  probe result.
- **Hooks concern** owns `appendHooksBlock`, `COMPONENT_KINDS`, and the
  `HookSummaryEntry` rendering; the info renderer calls into it.

### D-02: Open-closed proof — documented measurement only (no architecture test)
The ≤3-files / 0-`notify.ts`-edits target is proven by a **written measurement /
walkthrough**, NOT by a new architecture test. The proof enumerates exactly which
files a new command touches today (after this milestone):
- `edge/router.ts` registration (interface field + tuple + switch + usage)
- `edge/register.ts` one wiring line
- one `docs/output-catalog.md` section
= **3 central files, 0 `notify.ts` edits**, measured against the
`research/MESSAGING-COUPLING.md` baseline (5 no-grammar / 9–11 new-grammar; 6 of
those inside `notify.ts`).
- **No** architecture test asserting `notify.ts` purity is added (the user chose the
  lighter documented-measurement path over an enforceable gate). GATE-03
  (`npm run check` green) remains the only automated gate at close.

### D-03: MOD-06 catalog floor — documented
The catalog floor is documented as the deliberate milestone boundary: the catalog
stays hand-authored, one central section per new rendered state, with no
generation/aggregation seam (deferred to a future milestone). Captured alongside
the D-02 proof (same doc) so the "3rd central file" is explicitly the accepted floor.

### Claude's Discretion
- Exact module paths/names under `shared/concerns/` and the precise function
  signatures the composer/info-renderer call.
- Where the D-02 proof + D-03 floor note live (a new `docs/` note, an ADR-style doc,
  or a section appended to an existing doc) — provided it's a durable, discoverable
  artifact, not just a code comment.
- How much additional vocabulary stays vs moves, provided `notify.ts` ends as
  envelope + reducer + shared vocabulary and the two named concerns are fully
  extracted.
- Import-fence handling (the `HookSummaryEntry` types lived in `notify.ts` for a
  `shared/`→`domain/` fence reason per the research; preserve the fence when
  relocating).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & roadmap
- `.planning/workstreams/notification-refactor/REQUIREMENTS.md` — MOD-04, MOD-05,
  MOD-06, GATE-03.
- `.planning/workstreams/notification-refactor/ROADMAP.md` §"Phase 4" — success
  criteria 1–4.

### Coupling audit (the extraction targets + the proof baseline)
- `.planning/workstreams/notification-refactor/research/MESSAGING-COUPLING.md`:
  - §Part B.5 — the cross-cutting concern inventory (hooks summary
    `notify.ts:2702`-ish, soft-dep markers `notify.ts:1582`/`composeReasons`
    branch); what STAYS vs becomes a concern-module.
  - §Part A (A.2/A.3) — the file-touch matrix and the 5 / 9–11 baseline counts the
    D-02 measurement compares against.
  - §Part C.4 — what genuinely must stay central in `notify.ts` (envelope,
    `isInfoKind`, the shared vocabulary, the reducer spine).

### Prior phases (the model this closes over)
- `.../phases/01-...-CONTEXT.md` — the command-local `CommandContext` model and the
  "forget the registry" stance that D-01 mirrors.
- `.../phases/02-...-CONTEXT.md`, `.../phases/03-...-CONTEXT.md` — the reducer spine
  and summary surface that now STAY central in the slimmed `notify.ts`.

### Code (the concerns to extract + the spine that stays)
- `extensions/pi-claude-marketplace/shared/notify.ts` (currently ~3431 lines):
  - EXTRACT: `appendHooksBlock` + `COMPONENT_KINDS` + `HookSummaryEntry` rendering
    (hooks concern); `DEPENDENCIES` (~:476), `SOFT_DEP_MARKER_AGENTS`/`_MCP`
    (~:1620), the soft-dep branch of `composeReasons`, the probe-to-marker mapping
    (soft-dep concern).
  - STAYS: envelope + `notify()` dispatcher, `isInfoKind`, reducer spine
    (`computeSeverity`/`cascadeSeverity`/tally/summary), shared vocabulary (`ICON_*`,
    `renderScopeBracket`, `renderVersion`, `composeVersionArrow`, core
    `composeReasons`, `pluginRow`, `joinTokens`), `RELOAD_HINT_TRAILER`.
- `extensions/pi-claude-marketplace/platform/pi-api.ts` — `softDepStatus` probe
  (stays threaded by the renderer; the concern module consumes its result).
- `edge/router.ts`, `edge/register.ts`, `docs/output-catalog.md` — the 3 central
  files the D-02 proof enumerates.

### Gates
- `tests/architecture/catalog-uat.test.ts` + `docs/output-catalog.md` — GATE-02
  byte-equality; **must stay byte-identical** (extraction is output-neutral).
- `npm run check` — GATE-03 milestone-close gate.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- The concern code already exists as cohesive blocks in `notify.ts` (`appendHooksBlock`,
  the soft-dep marker constants + `composeReasons` branch) — extraction is a move +
  import-rewire, not a rewrite.
- `composeReasons` already has a clean soft-dep branch boundary (the `probe` +
  `declaresAgents`/`declaresMcp` flags) — the seam where the soft-dep concern plugs in.

### Established Patterns
- `shared/` modules are the home for cross-cutting helpers; a `shared/concerns/`
  subdir is the natural fit. Respect the `shared/`→`domain/` import fence (the
  `HookSummaryEntry` types were placed in `notify.ts` for this reason).
- Output-neutral refactor discipline (Phases 1): `catalog-uat` + `git diff
  docs/output-catalog.md` empty after every commit.

### Integration Points
- Central `composeReasons` calls the soft-dep concern function; the info renderer
  calls the hooks concern function. `notify()` envelope/reducer unchanged in behavior.

</code_context>

<specifics>
## Specific Ideas

- User chose **direct function calls** for concern wiring (no concern interface/
  registry), consistent with the Phase 1 "forget the registry" decision.
- User chose **documented measurement only** for the open-closed proof (explicitly
  over an enforceable architecture test) — lighter, accepts that nothing
  structurally prevents future grammar creeping back into `notify.ts`.

</specifics>

<deferred>
## Deferred Ideas

- **Catalog generation/aggregation seam** — explicitly OUT OF SCOPE (MOD-06 floor;
  documented as the deliberate boundary, deferred to a future milestone).
- **Architecture test enforcing `notify.ts` purity** — considered and declined this
  phase (D-02); a future hardening if grammar-creep becomes a problem.

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 4-concern-module-extraction-open-closed-proof*
*Context gathered: 2026-06-24*
