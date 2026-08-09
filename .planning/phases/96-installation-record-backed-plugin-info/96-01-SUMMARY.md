---
phase: 96-installation-record-backed-plugin-info
plan: 01
subsystem: api
tags: [typescript, node-test, orchestrator, notify, output-catalog]

# Dependency graph
requires:
  - phase: 95-manifest-independent-installed-inventory
    provides: "the `{not in manifest}` reason on installed rows, absence judged only after a successful manifest load (D-95-05), and the byte-exact manifest-absent test idioms this plan mirrors"
provides:
  - "`buildStateOnlyInstalledRow` — an installation record whose manifest entry disappeared renders `(installed)` / `(partially-installed)` with `not in manifest` as a reason instead of a `(failed)` verdict"
  - "`composeStateOnlyComponents` — the four name-list component kinds (agents, commands, mcp, skills) reconstructed from `resources.*`, sorted, generated names verbatim"
  - "`derivePersistedInstalledStatus` — the single persisted status derivation now shared by the non-path installed row and the state-only row"
  - "BOUND-01 and BOUND-02 pinned byte-exact so the dispatch reorder cannot move either boundary"
  - "two new byte-gated output-catalog states for the record-backed info rows"
affects: [96-02 hooks-kind reconstruction, 96 INFO-12 fetch skip note, 97 disabled-state classification repair, 98 DOC-08 contract reconciliation]

actuals:
  tokens: 8900
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "State-only row builder: an info arm that takes no `fetchCtx` and no manifest entry, so NFR-5 holds by signature rather than by control flow"
    - "Absence-first reason composition (`[\"not in manifest\", ...narrowUnsupportedKinds(...)]`), matching `list.ts::partiallyInstalledReasons`"

key-files:
  created:
    - tests/orchestrators/plugin/info-manifest-absent.test.ts
  modified:
    - extensions/pi-claude-marketplace/orchestrators/plugin/info.ts
    - tests/orchestrators/plugin/info.test.ts
    - docs/output-catalog.md
    - tests/architecture/catalog-uat.test.ts

key-decisions:
  - "The state-only row builders are SYNCHRONOUS and take no `locations`: `@typescript-eslint/require-await` (via `strictTypeChecked`) rejects an `async` function with no `await`, and `noUnusedParameters: true` rejects the threaded-but-unused parameter. The follow-up hooks read converts both in one mechanical edit at one call site."
  - "`buildNonPathInstalledRow` was routed through the extracted `derivePersistedInstalledStatus` so the persisted status derivation has exactly one copy rather than two that can drift."
  - "The catalog entries follow the info H2 section's actual skeleton (heading, prose, annotation, fenced block), not the list section's annotation-first order."

patterns-established:
  - "Component inventory from `resources.*` is copied and sorted but never de-duplicated — the record states what was materialized, and hiding a duplicate would hide a real state defect"
  - "`componentsResolved: true` with an empty components map is the honest shape for a record with no components; `false` would emit `components: not resolved` and deny known information"

requirements-completed: [INFO-09, INFO-10, BOUND-01, BOUND-02]
# INFO-11 is PARTIAL, not complete: the four name-list kinds ship here, the
# hooks kind is plan 96-02. REQUIREMENTS.md carries it as Partial rather than
# Complete so 96-02's delivery is not pre-claimed.
requirements-partial: [INFO-11]

coverage:
  - id: D1
    description: "A manifest-absent enabled record renders `● <plugin> v<recorded-version> (installed) {not in manifest}` at info severity, version taken from the installation record, with no description and no dependencies line"
    requirement: INFO-09
    verification:
      - kind: integration
        ref: "tests/orchestrators/plugin/info-manifest-absent.test.ts#INFO-09: a manifest-absent enabled record renders `(installed) {not in manifest}` at the recorded version"
        status: pass
    human_judgment: false
  - id: D2
    description: "The same record carrying persisted `compatibility.unsupported` kinds renders `◉ <plugin> v<version> (partially-installed) {not in manifest, lsp}` — absence token first"
    requirement: INFO-10
    verification:
      - kind: integration
        ref: "tests/orchestrators/plugin/info-manifest-absent.test.ts#INFO-10: a manifest-absent record with persisted unsupported kinds renders `(partially-installed) {not in manifest, lsp}`"
        status: pass
    human_judgment: false
  - id: D3
    description: "The four name-list kinds render from `resources.skills` / `prompts` / `agents` / `mcpServers` as Pi-generated installed names, sorted case-insensitively, in the fixed agents/commands/mcp/skills order; an all-empty record renders the bare row with no `components: not resolved` marker"
    requirement: INFO-11
    verification:
      - kind: integration
        ref: "tests/orchestrators/plugin/info-manifest-absent.test.ts#INFO-11: the four name-list kinds render from `resources.*`, sorted, with generated names verbatim"
        status: pass
      - kind: integration
        ref: "tests/orchestrators/plugin/info-manifest-absent.test.ts#INFO-11: a manifest-absent record with all-empty resources renders the bare row, no `components: not resolved`"
        status: pass
    human_judgment: false
  - id: D4
    description: "A manifest READ FAILURE alongside a live installation record still renders the bare `(failed) {source missing}` row at error severity with no component lines — the record never rescues an unverified manifest"
    requirement: BOUND-01
    verification:
      - kind: integration
        ref: "tests/orchestrators/plugin/info.test.ts#BOUND-01: a manifest READ FAILURE with an installed record present still renders the failure row, not the installation record"
        status: pass
    human_judgment: false
  - id: D5
    description: "A name absent from BOTH a successfully loaded manifest and the marketplace's installation records still renders `⊘ <plugin> (failed) {not in manifest}` at error severity with its summary line"
    requirement: BOUND-02
    verification:
      - kind: integration
        ref: "tests/orchestrators/plugin/info.test.ts#UXG-08: missing plugin in known marketplace emits `⊘ <plugin> (failed) {not in manifest}` at 2-space indent + severity error"
        status: pass
      - kind: integration
        ref: "tests/orchestrators/plugin/info.test.ts#GRAM-04: both-scopes missing plugin emits per-scope `error` + summary, NOT a silent info cascade"
        status: pass
    human_judgment: false
  - id: D6
    description: "The disabled carve-out still runs before the state-only arm: a recorded-but-disabled manifest-absent record renders the `(disabled)` inventory cascade"
    verification:
      - kind: integration
        ref: "tests/orchestrators/plugin/info-manifest-absent.test.ts#D-54-01: a manifest-absent DISABLED record still renders the `(disabled)` inventory cascade"
        status: pass
    human_judgment: false
  - id: D7
    description: "Both new info states are published in docs/output-catalog.md and pinned byte-for-byte in both directions by the catalog gate, with the D-96-01 name-fidelity divergence documented"
    verification:
      - kind: integration
        ref: "tests/architecture/catalog-uat.test.ts"
        status: pass
    human_judgment: true
    rationale: "The byte gate proves the rendered rows match; it cannot judge whether the new prose actually communicates the D-96-01 divergence to an operator reading the catalog. That is an editorial call."

# Metrics
duration: 25min
completed: 2026-08-09
status: complete
---

# Phase 96 Plan 01: Installation-record-backed plugin info Summary

**`plugin info` now describes a manifest-absent installation from its own record — `(installed) {not in manifest}` at the recorded version with the component inventory rebuilt from `resources.*` — while the read-failure and unknown-name boundaries stay pinned byte-exact.**

## Performance

- **Duration:** 25 min
- **Started:** 2026-08-09T01:50:05Z
- **Completed:** 2026-08-09T02:15:28Z
- **Tasks:** 3
- **Files modified:** 5 (1 created, 4 modified)

## Accomplishments

- Split `buildBlock`'s not-in-manifest arm: an installation record that outlived its manifest entry is now described from the record instead of reported as a failure. The severity for that input changes from `error` to `info`.
- Reconstructed the four name-list component kinds from `resources.*`, sorted with the same comparator `discoverComponentNames` uses, rendering the Pi-generated installed names verbatim per D-96-01.
- Pinned both boundaries the split must not move: a manifest read failure with a live record still renders `(failed) {source missing}` (BOUND-01), and a name in neither the manifest nor state still renders `(failed) {not in manifest}` (BOUND-02). The BOUND-01 pin was written and proved green against unmodified production code before any reorder.
- Published both new rows as byte-gated output-catalog states, documenting the generated-vs-source name divergence and the MCP raw-key exception.

## Task Commits

Each task was committed atomically:

1. **Task 1: Pin the manifest-read-failure boundary with an installation record present** - `5481c5ae` (test)
2. **Task 2: Split the not-in-manifest arm and render the installation record end to end** - `bd9bb542` (feat, tracer)
3. **Task 3: Publish the two new info states in the byte-gated output catalog** - `4c45ac97` (docs)

## Files Created/Modified

- `tests/orchestrators/plugin/info-manifest-absent.test.ts` (created, 453 lines) - six byte-exact cases: the two new states, the four-kind inventory, the all-empty edge, the declared control, and the disabled carve-out
- `extensions/pi-claude-marketplace/orchestrators/plugin/info.ts` - hoisted the `installed` lookup above the `entry` lookup, added the inner branch, and added `buildStateOnlyInstalledRow`, `composeStateOnlyComponents`, `derivePersistedInstalledStatus`, `sortComponentNames`
- `tests/orchestrators/plugin/info.test.ts` - the BOUND-01 regression pin
- `docs/output-catalog.md` - `state-only-installed-single-scope`, `state-only-partially-installed-single-scope`, and a widened severity-routing paragraph
- `tests/architecture/catalog-uat.test.ts` - two pure-literal fixtures plus the enumerating comment

## Decisions Made

- **The state-only builders are synchronous and take no `locations`.** The plan asked for `async` functions with a threaded-but-unused `locations` so the follow-up hooks read would not be a signature change. Both fail the toolchain: `@typescript-eslint/require-await` (inherited from `strictTypeChecked`, with no override for `extensions/`) errors on an `async` function that never awaits, and `tsconfig.json`'s `noUnusedParameters: true` errors on the unused parameter. NFR-6 requires `npm run check` green, and CLAUDE.md forbids speculative flexibility. The doc comment on `composeStateOnlyComponents` names the hooks read as the single extension point, so the follow-up remains a one-function change at one call site.
- **`buildNonPathInstalledRow` now calls `derivePersistedInstalledStatus`.** The plan made the extraction conditional on `sonarjs/no-identical-functions` firing, which it did not (the derivation is an inline ternary, not a whole function). Leaving two copies would be exactly the info-vs-list drift the requirement warns against, and the helper's doc comment claims to be shared. It is a one-line change to a row builder that takes no `entry`, so it stays inside the plan's do-not-touch carve-out.
- **Catalog entries follow the info section's own skeleton** (heading, prose, annotation, fenced block). The plan described annotation-before-prose, which is the *list* section's order; the info H2 uses the reverse throughout.
- **The tracer feedback gate ran in its autonomous form.** `workflow.auto_advance` and `_auto_chain_active` are both `false`, but the plan declares `autonomous: true`, the project runs `mode: yolo`, and the tracer's `<verify>` is `<automated>`-only with no human-judgment element. The gate was honored by re-running the full verify set end to end before any expansion task rather than by stopping for a checkpoint.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `async` + unused `locations` on the state-only builders would fail typecheck and lint**

- **Found during:** Task 2 (Split the not-in-manifest arm)
- **Issue:** The plan specified `async function buildStateOnlyInstalledRow(pluginName, record, locations)` and `async function composeStateOnlyComponents(record, locations)`. Neither body awaits anything in this plan, and neither uses `locations`. `strictTypeChecked` enables `@typescript-eslint/require-await`, and `tsconfig.json` sets `noUnusedParameters: true`. The plan's own acceptance criteria require `npm run typecheck` and `npm run lint` to exit 0, so the instruction is self-contradictory with the toolchain. The plan anticipated this and offered `_locations` as a fallback; dropping the parameter is the simpler resolution CLAUDE.md's simplicity rule points at.
- **Fix:** Both functions are synchronous and take only the record. `composeStateOnlyComponents`' doc comment marks the hooks read as the single extension point, so adding it later touches one function and one call site.
- **Files modified:** extensions/pi-claude-marketplace/orchestrators/plugin/info.ts
- **Verification:** `npm run typecheck`, `npm run lint`, and `npm run check` all exit 0; all six new tests plus both boundary pins pass.
- **Committed in:** `bd9bb542` (Task 2 commit)

**2. [Rule 2 - Missing critical consistency] Two copies of the persisted-installed-status derivation**

- **Found during:** Task 2 (Split the not-in-manifest arm)
- **Issue:** The plan made the shared-helper extraction conditional on `sonarjs/no-identical-functions` firing. The rule did not fire, so following the letter would have left the `unsupported.length > 0 ? "partially-installed" : "installed"` ternary duplicated in `buildNonPathInstalledRow` and `buildStateOnlyInstalledRow` — the exact info/list derivation drift INFO-10 exists to prevent, and a doc comment describing a "shared" helper with only one caller.
- **Fix:** Extracted `derivePersistedInstalledStatus` and routed both row builders through it.
- **Files modified:** extensions/pi-claude-marketplace/orchestrators/plugin/info.ts
- **Verification:** The full `info.test.ts` suite (68 tests, including every existing non-path installed-row assertion) is green.
- **Committed in:** `bd9bb542` (Task 2 commit)

**3. [Rule 3 - Blocking] Unused knobs on the copied test helper**

- **Found during:** Task 2 (new suite authoring)
- **Issue:** Copying `seedPathMarketplace` verbatim from `info.test.ts` brings an `autoupdate` branch (needing a `saveConfig` import) and a `componentFiles` branch that no test in the new suite uses.
- **Fix:** Copied the helper without those two branches and added the `resources?` per-record override the plan specified. CLAUDE.md's simplicity rule forbids carrying unrequested configurability.
- **Files modified:** tests/orchestrators/plugin/info-manifest-absent.test.ts
- **Verification:** All six tests pass; `npm run lint` clean.
- **Committed in:** `bd9bb542` (Task 2 commit)

---

**Total deviations:** 3 auto-fixed (2 blocking, 1 consistency)
**Impact on plan:** Every behavioral must-have in the plan holds unchanged. The deviations are toolchain and duplication corrections inside the plan's own edit set; no scope creep, no new exported symbol, no new reason/status/glyph.

## Issues Encountered

- The new suite's RED run failed exactly the four state-only cases while the declared control and the disabled carve-out passed, which confirmed both pre-existing arms were correctly untouched before any production edit.
- `grep` cannot read `info.ts` (the NUL byte at the old line 416 makes it look binary). Every inspection used `Read` or `node -e` with `readFile`, as the plan required.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- The `hooks` component kind (INFO-11 / D-96-03) is the one deliberate gap. It lands inside `composeStateOnlyComponents`, which will become `async` and take `locations` at that point — a mechanical change to one function and its single call site in `buildBlock`.
- INFO-12's `--fetch` skip note (D-96-04) is untouched here. The state-only arm is already network-free by signature, which is the structural half of that guarantee; the visible skip report and the zero-call seam assertion remain to be built.
- D-96-02's folded-row catalog note (the "still open under BOUND-01 / BOUND-02" sentence at the list section's manifest-absent entry) was not in this plan's edit set and is still open.
- `shared/notify.ts` and `info.messaging.ts` were not touched, as required; their stale comments remain for the DOC-08 reconciliation.

---
*Phase: 96-installation-record-backed-plugin-info*
*Completed: 2026-08-09*

## Self-Check: PASSED

All 5 source artifacts and the SUMMARY exist on disk; all 4 commits
(`5481c5ae`, `bd9bb542`, `4c45ac97`, `b4813d9`) are present in git history.
No stubs, no skipped tests, no unrun `<verify>` blocks.
