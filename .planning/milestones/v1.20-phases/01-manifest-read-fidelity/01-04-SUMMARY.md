---
phase: 01-manifest-read-fidelity
plan: 04
subsystem: orchestrators
tags: [plugin-manifest, dependencies, info, filesystem, network-free, typescript]

# Dependency graph
requires:
  - phase: 01-01
    provides: "MANIFEST_CANDIDATES — the ordered, frozen manifest candidate list, and the two readers already walking it"
  - phase: 01-02
    provides: "renderDependencyList — the fill-in, collapse, sort and render this plan re-points at a different source"
provides:
  - "readOwnManifestDependencies — the THIRD reader of MANIFEST_CANDIDATES, an fs-only tolerant read of the plugin's own manifest in orchestrators/plugin/info.ts"
  - "resolveInfoPluginRootFsOnly — the network-free plugin-root derivation that feeds it, path sources through the containment re-check and git sources through the presence probe's materialized arm only"
  - "The cross-reader agreement gate extended to all three readers over one planted tree, with the info half proving precedence rather than mere location"
affects: [dependency-resolution, install-provenance, prune]

actuals:
  tokens: 6695
  tasks: 2
  commits: 5
plan_head_before: 792b3c0dad0bd9fccd9d5b275a1d1f28c0d41e47

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Authoritative-source-with-fallback: the surface reads what the artifact itself declares whenever it can do so within its own I/O budget, and falls back to the catalogued mirror when it cannot — silently, with no disagreement warning"
    - "Block-level reads of throwing helpers carry a total catch, because the row-level catches that classify the failure sit BELOW them"
    - "A reader whose fall-through set is chosen to match its siblings' rather than its own convenience, so a shared-ordering gate can actually hold"

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/orchestrators/plugin/info.ts
    - tests/orchestrators/plugin/info.test.ts
    - tests/architecture/manifest-read-agreement.test.ts

key-decisions:
  - "readOwnManifestDependencies treats EISDIR as ABSENT alongside ENOENT and ENOTDIR, which the plan's literal errno list omitted. The two stat-gated readers reject a directory-at-candidate with isFile() and walk on; an errno gate that stopped there instead would have baked a three-way reader disagreement into the very gate D-01-12 exists to catch."
  - "resolveInfoPluginRootFsOnly's path arm catches EVERY throw, not PathContainmentError alone. assertPathInside lstats each component, so an OS-rejected source string (interior NUL) throws a bare TypeError from the syscall layer; at block level neither may escape, and neither is this function's to classify."
  - "A presence-probe throw on the git arm folds to no-root rather than propagating, mirroring probeManifestEntry's degrade for the same corrupt-mirror failure."
  - "The read stays module-private and the resolver result is NOT widened with a manifest field: D-23-02 / NFR-7 stand, which is exactly why there are now three readers rather than one carried value."
  - "No disagreement warning when the entry and the manifest differ. Upstream logs one; the authoritative source renders and the surface stays silent (D-01-32)."

patterns-established:
  - "When a new reader joins a shared-ordering family, its fall-through set is chosen to MATCH the incumbents' — the cheapest gate that agrees, not the cheapest gate."
  - "Hoisting a throwing derivation above the catches that classify it converts a classified row into an uncaught rejection; the hoisted copy absorbs, the original still classifies."
  - "A behavioral gate half is worth writing only where the two candidate sources can produce different bytes; where the surface collapses both to the same output, say so in the test rather than asserting something vacuous."

requirements-completed: [DEPS-01, DEPS-02]

coverage:
  - id: D1
    description: "info sources the dependency list from the plugin's own plugin.json when that manifest is readable without network — bare candidate, wrapped candidate ahead of a bare sibling, and a warm git clone all supply their own list over the marketplace entry's"
    requirement: "DEPS-01"
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/info.test.ts#D-01-32: a bare plugin.json outranks the marketplace entry's dependency list"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/info.test.ts#D-01-32: the wrapped manifest outranks a bare sibling, matching the shared ordering"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/info.test.ts#D-01-32: a WARM git clone's plugin.json supplies the dependency list, not the entry"
        status: pass
    human_judgment: false
  - id: D2
    description: "A readable manifest is authoritative even when it declares nothing — the entry's list does not reappear behind it — while a plugin with no manifest at either candidate still renders the entry's"
    requirement: "DEPS-02"
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/info.test.ts#D-01-32: a readable manifest declaring nothing omits the line; the entry does not reappear"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/info.test.ts#D-01-32: a plugin with no manifest at either candidate falls back to the entry"
        status: pass
    human_judgment: false
  - id: D3
    description: "The read is absence-only fall-through and network-free: an unusable first candidate is never rescued by its sibling, a refused containment check does not throw past the block, and a cold git source creates no clone directory even though it could have made a manifest readable"
    requirement: "DEPS-01"
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/info.test.ts#D-01-07: an unparseable first candidate ends the walk; the bare sibling never rescues it"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/info.test.ts#D-01-32: a path source whose root fails containment falls back to the entry without throwing"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/info.test.ts#D-01-32 / NFR-5: a COLD git source renders the entry's list and creates no clone directory"
        status: pass
      - kind: unit
        ref: "tests/architecture/no-orchestrator-network.test.ts (the NFR-5 gate that pins info.ts by name, unchanged and green)"
        status: pass
    human_judgment: false
  - id: D4
    description: "One planted bare manifest is proved to be the file all three readers open, and the info half proves the manifest outranks the marketplace entry rather than merely being read"
    requirement: "DEPS-01"
    verification:
      - kind: integration
        ref: "tests/architecture/manifest-read-agreement.test.ts#all three readers locate one bare manifest, and info lets it outrank the entry"
        status: pass
    human_judgment: false

# Metrics
duration: 38min
completed: 2026-09-13
status: complete
---

# Phase 1 Plan 4: info reads the authoritative dependency source Summary

**`info` now renders the dependency list the plugin's own `plugin.json` declares whenever it can open that file without a network call, falling back to the marketplace entry when it cannot — making `info` the third reader of the shared `MANIFEST_CANDIDATES` ordering, and the cross-reader gate a three-way one.**

## Performance

- **Duration:** 38 min
- **Started:** 2026-09-13T18:49:00Z
- **Completed:** 2026-09-13T19:27:00Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- `readOwnManifestDependencies` walks `MANIFEST_CANDIDATES` with the same absence-only fall-through the resolver and the version reader use, under this file's tolerant fs-only read contract. Nothing it touches can throw out of `buildBlock`.
- `resolveInfoPluginRootFsOnly` supplies the root: a path source through the existing `derivePluginRootForInfo` containment re-check, a git source through `makePresenceProbe`'s `materialized` arm alone. The materializing probe is unreachable from here, so a cold source falls back to the entry rather than cloning — even under `--fetch`.
- The cross-reader gate now drives all three readers against ONE planted bare manifest in one case, and the `info` half asserts precedence, not location: the entry and the manifest declare different dependencies, and the rendered line names the manifest's.
- The warm/cold render-symmetry exception stays scoped to `dependencies`. `defaultEnabled` and `entryDeclaresInstallDisabled`'s one-parameter containment argument are untouched.

## Task Commits

1. **Task 1: info reads the plugin's own manifest, fs-only, with the entry as fallback** — `5b684093` (test, RED) → `419dffeb` (feat, GREEN)
2. **Task 2: the cross-reader gate covers all three readers** — `3c77490c` (test)

RED evidence: at `5b684093` the four new precedence cases failed (`ℹ pass 144 / fail 4`) while the four characterization guards committed alongside them passed. At `419dffeb` all 149 passed.

Negative control on Task 2: with the manifest branch forced off, the new gate case failed (`pass 3 / fail 1`) while the two incumbent halves stayed green — the third half is load-bearing, not decorative.

## Files Created/Modified

- `extensions/pi-claude-marketplace/orchestrators/plugin/info.ts` — the two new module-private helpers, their two supporting readers (`readManifestCandidate`, `parseOwnManifest`), and the `buildBlock` call site, which now computes `parsedSource` before the dependency value because the read is source-kind-dependent.
- `tests/orchestrators/plugin/info.test.ts` — eight cases over the behavior matrix, plus the `plantOwnManifest` / `renderOwnManifestCase` fixtures they share. No pre-existing case was edited.
- `tests/architecture/manifest-read-agreement.test.ts` — the third-reader half, a local hermetic-HOME swap, and a header naming all three readers.

## Decisions Made

See `key-decisions` in the frontmatter. The load-bearing one is `EISDIR`: an errno gate that treated a directory-at-candidate as present-but-unusable would have disagreed with both stat-gated readers, and the gate this plan extends would have been asserting agreement while the readers diverged on exactly the case it was written to catch.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] The path arm's catch had to be total, not `PathContainmentError`-only**

- **Found during:** Task 1 (GREEN step)
- **Issue:** The plan directed catching `PathContainmentError` from `derivePluginRootForInfo`. That is not the only throw it produces: `assertPathInside` lstats every component from the marketplace root down, so a source string the OS rejects (an interior NUL byte) raises a plain `TypeError` from the syscall layer instead. Hoisting the derivation to block level therefore introduced a second uncaught path, and the pre-existing case `a path source containing a NUL byte folds the resolver failure exactly` went red — `getPluginInfo` rejected without notifying at all.
- **Fix:** The path arm catches every throw and returns no root. Classification is not lost: the row builders reach the same derivation behind their own catch a moment later and still render the closed-set `{unreadable}` brace, so the row bytes are unchanged.
- **Files modified:** `extensions/pi-claude-marketplace/orchestrators/plugin/info.ts`
- **Verification:** `node --test tests/orchestrators/plugin/info.test.ts` — 149/149, including the NUL-byte case restored to its exact prior bytes.
- **Committed in:** `419dffeb`

**2. [Rule 2 - Missing critical] A presence-probe throw folds instead of propagating**

- **Found during:** Task 1
- **Issue:** The plan's git arm reads `makePresenceProbe`'s result without guarding the call. The probe reads a warm mirror's `.git/HEAD` and throws on a corrupt or concurrently-rewritten one, which would have failed a whole read-only block over one broken mirror.
- **Fix:** The git arm folds a probe throw to no-root, the same degrade `probeManifestEntry` applies to the identical failure.
- **Files modified:** `extensions/pi-claude-marketplace/orchestrators/plugin/info.ts`
- **Verification:** covered by the unchanged warm/cold git cases; no behavior change on the healthy paths.
- **Committed in:** `419dffeb`

**3. [Rule 2 - Missing critical] `EISDIR` joins the absent set**

- **Found during:** Task 1
- **Issue:** The plan named `ENOENT` and `ENOTDIR` as the fall-through errnos. The two incumbent readers gate on `isFile()`, which ALSO walks past a directory sitting at a candidate path. An errno gate stopping there would have made the third reader disagree with the other two on precisely the class the D-01-12 gate exists to catch — while that gate reported agreement, because no case plants a directory.
- **Fix:** `EISDIR` reads as absent, with the reasoning stated at the read site.
- **Files modified:** `extensions/pi-claude-marketplace/orchestrators/plugin/info.ts`
- **Verification:** `node --test tests/architecture/manifest-read-agreement.test.ts` plus the full suite.
- **Committed in:** `419dffeb`

---

**Total deviations:** 3 auto-fixed (1 × Rule 1, 2 × Rule 2)
**Impact on plan:** all three are corrections to the read's failure contract, inside the two helpers the plan asked for. No scope creep; no file outside `files_modified` was touched.

## Issues Encountered

**Two behavior rows are not observable at the rendered surface.** Both were written as tests anyway, asserting what IS observable, and each test says so in place.

1. *A cold git source renders the entry's list.* It does not — not before this plan and not after. `PluginInfoComponentsUnresolved` carries no `dependencies` field and the `(remote)` variant documents "NO `dependencies`", so no not-installed git row renders a dependency line at all. `buildRemoteNotInstalledRow` nonetheless accepts and spreads one, which is dead. The internal fallback is correct; the byte evidence for it cannot exist without a new catalogued output state, which is an amendment rather than a free choice. Logged to `deferred-items.md` and to `.planning/WINDOWS.md`. The plan's PROHIBITION half — no clone created — is asserted directly.
2. *A present-but-unusable first candidate falls back to the entry.* This reader is strictly more permissive than the resolver (it wants a JSON object; the resolver wants a schema-valid one), so every file it rejects the resolver rejects too, driving the row to `(unavailable)` — an arm that receives no `dependencies` at all. The test pins the half that does discriminate: the bare sibling never rescues the walk. The containment case is the same shape and is pinned as byte-unchanged.

**Two pre-existing warm-mirror cases changed behavior as intended.** `RSTA-05` (uninstalled warm) and `RSTA-04` (installed warm) each declare `dependencies` on the ENTRY while their mirror's `plugin.json` declares none. Under D-01-32 the readable manifest is authoritative, so those rows now correctly omit the line. Both assert by regex and stayed green; no assertion was edited.

## Verification

- `npm run check` — green end to end, all nine links (typecheck, lint, fallow, format:check, test:corresponding, test:corresponding:negative, test:coverage:direct:negative, test 5355/5355, test:integration 31/31).
- `node --test tests/architecture/no-orchestrator-network.test.ts` — green, no exemption added; `info.ts` gained no git or network surface.
- `npm run fallow` — exit 0. Duplication unchanged at 887 lines across 40 files: the third candidate walk produced no new clone group, and no `ignoredClones` entry was added.
- Task 1 acceptance criteria: `MANIFEST_CANDIDATES` grep returns the import and the loop; both helper definitions and both call sites present; no `makeFetchProbe` occurrence inside either helper; `no network` present in the `readOwnManifestDependencies` doc comment; the cold-git case asserts clone-directory absence.
- Task 2 acceptance criteria: `getPluginInfo` appears 4 times; the three production paths are imported with explicit `.ts` extensions; entry and manifest declare different dependency values and the assertion names the manifest's; the header names all three readers.

## Next Phase Readiness

Phase 1 is complete — all four plans landed. `info` and Phase 3's resolution now read the same source, so D-01-19's display-vs-resolution split is moot and Phase 3 inherits no constraint from this surface. The parser (`domain/dependencies.ts`) and the ordering constant (`domain/manifest-path.ts`) are both reusable as-is; the note in D-01-31 about last-wins being a within-manifest rule only still needs honoring when Phase 3 intersects ranges across manifests.

## Self-Check: PASSED

- Every file named in `key-files.modified` exists on disk.
- All four commits resolve: `5b684093`, `419dffeb`, `3c77490c`, `d5203e39`.
- `npm run check` re-run green end to end; `pre-commit run --all-files` clean with no hook rewrites.
- `commits: 5` is measured as `git rev-list --count 792b3c0d..HEAD` at rest, which includes this self-check commit.
