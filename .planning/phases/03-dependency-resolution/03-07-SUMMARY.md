---
phase: 03-dependency-resolution
plan: 07
subsystem: api
tags: [dependency-resolution, manifest-read, plugin-manifest, offline-read, nfr-5]

# Dependency graph
requires:
  - phase: 03-dependency-resolution
    provides: "The install cascade and its injected ClosureLookup seam (plan 03-01)"
  - phase: 01-manifest-read-fidelity
    provides: "The shared manifest candidate ordering, D-01-07's absence-only fall-through, and D-01-32's plugin-manifest-first read order for `dependencies`"
provides:
  - "`orchestrators/plugin/dependency-declaration-read.ts` — the offline, plugin-manifest-first read of what one plugin declares, mapped onto `ClosureLookupResult`"
  - "`readDependencyDeclaration`, `DependencyDeclarationReader`, `DependencyDeclarationReadOptions`"
  - "install-flow's cascade lookup now reads the plugin's own manifest first and the marketplace entry as the fallback"
  - "A fourth half in the manifest-read-agreement gate, so the cascade read and info's render cannot drift"
affects: [install provenance, prune on uninstall, dependency version constraints]

actuals:
  tokens: 10932
  tasks: 2
  commits: 2
  plan_head_before: 257f8827

tech-stack:
  added: []
  patterns:
    - "A read that must stay offline injects the fs-only presence probe as a seam member, so it has no materializing operation to reach even by mistake"
    - "A candidate walk returns `undefined` for ABSENCE and a value for every other outcome, which makes the absence-only fall-through a property of the return type"

key-files:
  created:
    - extensions/pi-claude-marketplace/orchestrators/plugin/dependency-declaration-read.ts
    - tests/orchestrators/plugin/dependency-declaration-read.test.ts
  modified:
    - extensions/pi-claude-marketplace/orchestrators/plugin/install-flow.ts
    - tests/orchestrators/plugin/install-flow.test.ts
    - tests/architecture/manifest-read-agreement.test.ts
    - extensions/pi-claude-marketplace/domain/manifest-path.ts

key-decisions:
  - "D-03-18: the read takes the marketplace ENTRY and parses `entry.source` itself, rather than taking a pre-parsed source beside the entry. Two inputs describing the same thing can disagree; one cannot."
  - "D-03-19: `entry` is required, so the module carries no no-entry arm. Without an entry there is no source, therefore no plugin root, therefore nothing the arm could decide — and install-flow already returns `absent` for a plugin its marketplace does not declare. The arm would have been unreachable from production, which the direct-coverage gate does not admit."
  - "D-03-20: the options bag omits the plugin key's name and marketplace. Nothing in the read consumes them; the entry already answers which plugin this is."
  - "D-03-21: `declareDependencies: true` in the install-flow seed now writes the same declaration on BOTH the marketplace entry and the plugin's own manifest. Under D-01-32 an entry-only fixture has its own manifest suppress the declaration, which silently turned three cascade cases vacuous."

patterns-established:
  - "Seam-as-boundary-proof: the injected reader exposes only fs-only operations, so 'this read cannot fetch' is a property of the type rather than a comment"
  - "Plant discipline for a read-order swap: revert the lookup to the shape it replaced and confirm the new case goes red while its sibling stays green"

requirements-completed: [RESV-01, RESV-02]

coverage:
  - id: D1
    description: "A plugin's own manifest answers what it declares wherever it is readable offline; the marketplace entry is the fallback"
    requirement: RESV-01
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/dependency-declaration-read.test.ts#D-01-32: the plugin's own manifest answers where the entry declares nothing"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/dependency-declaration-read.test.ts#D-01-32: the production reader reads a bare manifest off real disk"
        status: pass
      - kind: integration
        ref: "tests/architecture/manifest-read-agreement.test.ts#all four readers locate one bare manifest, and two let it outrank the entry"
        status: pass
    human_judgment: false
  - id: D2
    description: "A readable manifest is authoritative even when it declares an empty list or no list at all — the entry's list does not reappear behind it"
    requirement: RESV-01
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/dependency-declaration-read.test.ts#D-01-32: a manifest declaring an empty array suppresses the entry's list"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/dependency-declaration-read.test.ts#D-01-32: a manifest with no dependencies key means the plugin declares nothing"
        status: pass
    human_judgment: false
  - id: D3
    description: "The candidate walk falls through on absence only; a present-but-unusable manifest ends the walk and falls back to the entry, never to its sibling and never to 'declares nothing'"
    requirement: RESV-01
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/dependency-declaration-read.test.ts#D-01-07: an unparseable first candidate falls back to the entry, not to the second"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/dependency-declaration-read.test.ts#D-01-06: an absent first candidate falls through to the bare manifest"
        status: pass
      - kind: integration
        ref: "tests/architecture/manifest-read-agreement.test.ts#all four readers stop at malformed JSON instead of using the bare sibling"
        status: pass
    human_judgment: false
  - id: D4
    description: "Nothing in the read path can cause a network fetch: a git source yields a root only from the fs-only presence probe's materialized arm"
    requirement: RESV-01
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/dependency-declaration-read.test.ts#NFR-5: a git source with no materialized clone materializes nothing"
        status: pass
      - kind: integration
        ref: "tests/architecture/no-orchestrator-network.test.ts#NFR-5 + PI-2 + PL-3 + PRL-07: network-free orchestrators have zero gitOps surface"
        status: pass
    human_judgment: false
  - id: D5
    description: "A path containment refusal or a syscall-layer refusal while deriving a plugin root is caught and read as no root, never propagated out of the cascade"
    requirement: RESV-01
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/dependency-declaration-read.test.ts#NFR-10: a containment refusal while deriving a plugin root reads as no root"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/dependency-declaration-read.test.ts#NFR-10: a syscall-layer refusal while deriving a plugin root reads as no root"
        status: pass
    human_judgment: false
  - id: D6
    description: "Installing a plugin whose dependency is declared ONLY in its own manifest installs that dependency and declares both keys in the parent's config file"
    requirement: RESV-02
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/install-flow.test.ts#RESV-01 / D-01-32: a dependency declared only in the plugin's own manifest installs"
        status: pass
      - kind: other
        ref: "plant control: lookup reverted to an entry-only read turns the case red (recorded 'hello' only) while the entry-declared sibling case stays green"
        status: pass
    human_judgment: false

duration: 43min
completed: 2026-09-15
status: complete
---

# Phase 3 Plan 07: Plugin-manifest-first dependency read Summary

**The cascade now asks the plugin what it depends on, reading its own manifest first and the marketplace entry only as a fallback, with no path through the read that can fetch anything.**

## Performance

- **Duration:** 43 min
- **Started:** 2026-09-15T02:16:00Z
- **Completed:** 2026-09-15T02:59:00Z
- **Tasks:** 2
- **Files modified:** 6 (2 created, 4 modified)

## Accomplishments

- `orchestrators/plugin/dependency-declaration-read.ts` answers one question — what does this plugin declare — in the D-01-32 order, and maps the answer straight onto the closure walk's `ClosureLookupResult` contract. A readable manifest wins outright, including when it declares an empty list or no list at all.
- The read is offline by construction, not by convention. Its injected seam exposes exactly three filesystem operations: a stat, a text read, and the fs-only clone presence probe. There is no materializing operation in the module to reach, from any flag, so a git-source dependency with no materialized clone falls back to its entry rather than triggering a fetch. That consequence is stated in the module header rather than left to be discovered.
- `install-flow.ts`'s cascade lookup is now a call into that module. It still locates the marketplace entry, and hands it over as the fallback. The swap names no git surface, so `install-flow.ts` stays in the network-free target list unchanged.
- A new install-flow case installs a plugin whose dependency is declared ONLY in its own manifest, and compares the whole install-record set and the whole config file. Reverting the lookup to an entry-only read was planted and turned exactly that case red while the entry-declared sibling stayed green.
- The `manifest-read-agreement` gate gained a fourth reader, as its own header invites. The cascade read and `info`'s render now answer the same question against the same planted tree, so a fallback added to one and not the other is a gate failure.
- The module's own pair reaches complete direct coverage: branches 49/49, functions 9/9, lines 269/269.

## Task Commits

1. **Task 1: Read a plugin's own dependency declaration, filesystem only** — `4abf194d` (feat)
2. **Task 2: Make the cascade ask the plugin, not just the entry** — `75b9f8a8` (feat)

## Files Created/Modified

- `extensions/pi-claude-marketplace/orchestrators/plugin/dependency-declaration-read.ts` — the offline plugin-manifest-first read, its injected filesystem seam, and the module-scope frozen real implementation
- `tests/orchestrators/plugin/dependency-declaration-read.test.ts` — 23 cases against a faulted seam plus two real-disk cases that exercise the production reader
- `extensions/pi-claude-marketplace/orchestrators/plugin/install-flow.ts` — the cascade lookup now delegates the read order and threads the target scope's locations in
- `tests/orchestrators/plugin/install-flow.test.ts` — the manifest-only dependency case, and the seed change that keeps both declaration sides in agreement
- `tests/architecture/manifest-read-agreement.test.ts` — the fourth reader, driven against the same planted trees as the other three
- `extensions/pi-claude-marketplace/domain/manifest-path.ts` — header now names the fourth reader of the shared candidate ordering

## Decisions Made

- **D-03-18 — the read parses the entry's source itself.** The plan's option bag carried a pre-parsed source beside the entry. Two inputs describing the same thing can disagree, and the module already needs the entry; it now derives the source from `entry.source` and there is no desync to guard against. It also keeps `parsePluginSource` out of `install-flow.ts`.
- **D-03-19 — `entry` is required, so there is no no-entry arm.** The plan described an absent arm for "no entry and no readable manifest". Without an entry there is no source, so there is no plugin root and no manifest either; the arm would have been unreachable from production while still needing coverage. `install-flow.ts` already returns `absent` for a marketplace it cannot resolve and for a plugin the manifest does not declare, so the behavior is unchanged and lives where a real caller can reach it.
- **D-03-20 — the options bag omits the subject's name and marketplace.** Nothing in the read consumes them.
- **D-03-21 — a seeded declaration now lands on both sides.** See the deviation below.
- The reader seam carries the presence probe as a member (`makePresenceProbe: typeof makePresenceProbe`) rather than importing it directly. That is what lets a test drive the `materialized`, non-materialized and probe-throw arms without a real clone, and it puts every clone-facing operation the module can reach in one visible list.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Three cascade fixtures went vacuous under the new read order**

- **Found during:** Task 2
- **Issue:** `seedPathMarketplaceWithPlugin`'s `declareDependencies: true` wrote the declaration onto the marketplace ENTRY only, while the seeded plugin's own `.claude-plugin/plugin.json` declared nothing. Under D-01-32 that manifest is authoritative, so it suppressed the entry's declaration and the cascade reduced to N=1. Two cases failed outright (`RESV-01 / D-03-06`, `RESV-01 / RESV-06`) and a third (`RESV-06 / NFR-3`) kept passing while proving strictly less than its comment claims — its "the dependency materialized and was unwound" assertion had nothing left to unwind.
- **Fix:** `buildSeededPluginManifest` now writes the same declaration the entry carries, so both sides agree. That is the shape a real plugin ships, and it keeps those fixtures about the cascade rather than about which file the reader prefers — the read order has its own cases, where the two sides deliberately disagree.
- **Files modified:** `tests/orchestrators/plugin/install-flow.test.ts`
- **Verification:** `node --test tests/orchestrators/plugin/install-flow.test.ts tests/orchestrators/plugin/install-cascade.test.ts` — 152/152 pass.
- **Committed in:** `75b9f8a8`

**2. [Rule 2 - Missing critical] The new manifest reader was not in the cross-reader agreement gate**

- **Found during:** Task 1
- **Issue:** `tests/architecture/manifest-read-agreement.test.ts` exists because each manifest reader locates `plugin.json` with its own I/O, so a fallback added to one and not to another makes them disagree. Its header states the list is deliberately open and that a reader added later is added there too. A fourth reader shipping outside that gate is exactly the drift the gate exists to catch.
- **Fix:** Added the fourth half. `readDependencyDeclaration` is now driven against the same planted trees as the other three, including the malformed-JSON, symlink-loop, non-directory-wrapper, directory-candidate and device-candidate cases. `domain/manifest-path.ts`'s header also names it, so its list of readers stays true.
- **Files modified:** `tests/architecture/manifest-read-agreement.test.ts`, `extensions/pi-claude-marketplace/domain/manifest-path.ts`
- **Verification:** `node --test tests/architecture/manifest-read-agreement.test.ts` — 9/9 pass.
- **Committed in:** `4abf194d`

### Scoped changes to the plan's stated interface

Three small departures from the plan's literal option shape, each recorded above as D-03-18, D-03-19 and D-03-20. None changes observable behavior; each removes an input or an arm that no caller can supply or reach.

---

**Total deviations:** 2 auto-fixed (1 Rule 1, 1 Rule 2), plus 3 interface simplifications recorded as decisions.
**Impact on plan:** No scope creep. The Rule 1 fix was forced by the behavior this plan ships. The Rule 2 fix satisfies an obligation the touched gate's own header states.

## Issues Encountered

- The `npm run check` chain does not include the per-pair direct-coverage gate over all pairs, so the module's complete-coverage claim was measured separately with `npm run test:coverage:direct -- <module>` and by the `npm direct coverage (changed pairs)` pre-commit hook.
- The first draft of the syscall-refusal case wrote a literal NUL byte into the test source. It was rewritten as a `\u0000` escape before the file was ever staged.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- RESV-01 and RESV-02 are now exercised end-to-end from both declaration sides. They stay Pending in `REQUIREMENTS.md` where a later plan in this phase also declares them.
- `ClosureMember.ranges` still carries every declared range in encounter order, so plan 03-04's constraint work reads the same accumulator regardless of which file declared the range.
- The offline contract is the thing later plans must not quietly widen: the constrained-dependency tag query D-03-02 introduces is a separate, declared NFR-5 exception and belongs in its own leaf outside the network-free target list, never inside this read.

---
*Phase: 03-dependency-resolution*
*Completed: 2026-09-15*

## Self-Check: PASSED

All created files exist on disk and both task commits resolve.
