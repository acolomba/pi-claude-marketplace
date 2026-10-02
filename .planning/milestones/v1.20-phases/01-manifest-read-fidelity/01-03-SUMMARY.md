---
phase: 01-manifest-read-fidelity
plan: 03
subsystem: domain
tags: [plugin-manifest, resolver, skills-bridge, path-normalization, typescript]

# Dependency graph
requires:
  - phase: 01-01
    provides: "domain/resolver.ts::readManifest walking MANIFEST_CANDIDATES, which is what makes a bare manifest's declared skills paths reach componentPaths at all"
provides:
  - "domain/resolver.ts::validateComponentPath returning the canonical path.relative(pluginRoot, candidate), with '.' for the plugin root itself"
  - "bridges/skills/discover.ts::seenByDir - a resolved-directory identity map consulted before the generated-name dedup at both emission points"
  - "bridges/skills/discover.ts::collectSkillSubdirs - the subdir enumeration extracted into its own function"
  - "tests/architecture/declared-component-path-overlap.test.ts - the criterion-3 witness gate, proven to fail against the pre-fix tree"
affects: [01-04, dependency-resolution, install-provenance, commands-bridge-symmetry]

actuals:
  tokens: 66605
  tasks: 3
  commits: 5
plan_head_before: a456086e8a4fe2db234afd74e6d5402b02f5b827

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Canonicalize a third-party relative path immediately after the containment check, on the same resolved candidate the check accepted, so the stored value is contained by construction"
    - "Physical-identity dedup in the bridge (keyed on path.resolve of the directory) sitting BEFORE the generated-name dedup, because the resolver cannot see that two legitimately distinct relative paths reach one directory"
    - "A gate proven by negative control: the new architecture test was run against the pre-fix sources and failed on all three cases before being committed"

key-files:
  created:
    - tests/architecture/declared-component-path-overlap.test.ts
  modified:
    - extensions/pi-claude-marketplace/domain/resolver.ts
    - extensions/pi-claude-marketplace/bridges/skills/discover.ts
    - tests/domain/resolver.test.ts
    - tests/bridges/skills/discover.test.ts

key-decisions:
  - "The seenByDir key is path.resolve(...) of the skill directory, computed independently of the resolver change, because the skills bridge builds skillsDir with path.join (which preserves a trailing separator) where the commands bridge uses path.resolve (which strips one). Keying on the raw value would have made the fix depend on landing order."
  - "seenByDir records on BOTH branches - the accepted skill AND the one that lost the generated-name race and warned. The map answers 'has this physical directory been processed', which is true either way; recording only winners would let one directory warn twice when reached from a third component path."
  - "The subdir enumeration was extracted into collectSkillSubdirs. Adding the seenByDir lookup pushed discoverPluginSkills from cognitive 15 to 16, breaching both the ESLint sonarjs and the fallow health ceilings; extraction was the minimal fix and preserves the plan's stated five-parameter signatures."
  - "The rejected alternative stays rejected: suppressing the convention path when a declared path lives under it silences the same warning and drops undeclared sibling skill directories. The third witness case is what keeps it rejected."

patterns-established:
  - "Physical-identity dedup before name-collision dedup: same resolved directory means one artifact reached twice (skip silently); different directories that merely elide to the same generated name keep the D-141-04 warning"
  - "Negative control on a new gate: run the new test against the pre-fix sources and confirm it fails before committing it"

requirements-completed: [MANF-03]

coverage:
  - id: D1
    description: "The stored component path is canonical - path.relative(pluginRoot, path.resolve(pluginRoot, raw)) - with '.' for the plugin root, case-sensitive keys, and a containment refusal that still echoes the author's raw spelling"
    requirement: "MANF-03"
    verification:
      - kind: unit
        ref: "tests/domain/resolver.test.ts#MANF-03 a declared ./skills/ collapses onto the conventional skills dir"
        status: pass
      - kind: unit
        ref: "tests/domain/resolver.test.ts#MANF-03 a declaration of the plugin root itself stores a dot, never an empty string"
        status: pass
      - kind: unit
        ref: "tests/domain/resolver.test.ts#MANF-03 keeps Skills and skills as two distinct stored paths"
        status: pass
      - kind: unit
        ref: "tests/domain/resolver.test.ts#MANF-03 an escaping component path is refused naming the raw declared spelling"
        status: pass
    human_judgment: false
  - id: D2
    description: "One physical skill directory reached through two component paths yields one skill and no warning, while two distinct directories colliding on a generated name still warn exactly as before and no skill directory is lost"
    requirement: "MANF-03"
    verification:
      - kind: unit
        ref: "tests/bridges/skills/discover.test.ts#MANF-03 a declared skill subdir and its conventional parent yield one skill"
        status: pass
      - kind: unit
        ref: "tests/bridges/skills/discover.test.ts#MANF-03 keeps an undeclared sibling skill when a subdir is also declared"
        status: pass
      - kind: unit
        ref: "tests/bridges/skills/discover.test.ts#MANF-03 a trailing separator keys the same directory as one already seen"
        status: pass
      - kind: unit
        ref: "tests/bridges/skills/discover.test.ts (the four pre-existing collision cases, unmodified and still passing)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Both declared shapes the ROADMAP names by warning count - ui5's ./skills/ over eight skill directories and ui-theme-designer's two ./skills/<name> declarations over a tree that also ships skills/ - reach zero duplicate-skill warnings end to end"
    requirement: "MANF-03"
    verification:
      - kind: integration
        ref: "tests/architecture/declared-component-path-overlap.test.ts (real resolver into real bridge over a planted tree; negative control against pre-fix sources failed all three cases)"
        status: pass
    human_judgment: true
    rationale: "The gate plants the two witnesses' declared shapes verbatim, but ROADMAP criterion 3 is worded against the real ui5 and ui-theme-designer plugins. Confirming the criterion as written needs an actual install of those two plugins from their marketplace, which is a network operation the offline gate cannot perform."

# Metrics
duration: 54min
completed: 2026-09-13
status: complete
---

# Phase 1 Plan 03: Declared component-path overlap Summary

**One directory on disk now yields one component path and one enumeration: the resolver stores `path.relative(pluginRoot, candidate)` and the skills bridge keys a `seenByDir` map on the resolved skill directory, taking both named witnesses to zero duplicate-skill warnings.**

## Performance

- **Duration:** 54 min
- **Started:** 2026-09-13T17:49:44Z
- **Completed:** 2026-09-13T18:44:37Z
- **Tasks:** 3
- **Files modified:** 5 (1 created, 4 modified)

## Accomplishments

- Closed the regression window plan 01-01 opened. Making a bare `plugin.json` readable put `ui-theme-designer`'s two declared `"./skills/<name>"` paths into `componentPaths` for the first time, and the additive convention probe then re-enumerated the same directories. Both witnesses now reach zero warnings.
- `validateComponentPath` returns the canonical form (D-01-14), computed on the very candidate `assertPathInside` accepted, so the stored path is contained by construction and cannot begin with `..`. `addComponentPath` was not touched: the normalized value arrives as its `relative` parameter and becomes the dedup key and the stored value in one step (D-01-15).
- `discoverPluginSkills` gained a `seenByDir` map keyed on `path.resolve` of the skill directory, consulted before `seenByGenerated` at both emission points (D-01-21). A same-directory hit skips silently; a different directory eliding to the same generated name keeps its existing D-141-04 warning verbatim.
- The witness gate was proven by negative control, not asserted: running `tests/architecture/declared-component-path-overlap.test.ts` against the pre-fix sources at `a456086e` failed all three cases; the sources were restored byte-identical before committing.
- `npm run check` is green end to end: 5347 unit + 31 integration tests, all nine links.

## Task Commits

Each task was committed atomically. Tasks 1 and 2 were TDD, so each carries a
`test` (RED) commit and a `fix` (GREEN) commit.

1. **Task 1: Normalize the component path** - `29c4f3f5` (test, RED) then `47531d76` (fix, GREEN)
2. **Task 2: The skills bridge recognizes one directory reached twice** - `1966fe78` (test, RED) then `2f3a6946` (fix, GREEN)
3. **Task 3: The witness gate** - `10d26575` (test)

No separate REFACTOR commit: the Task 2 extraction of `collectSkillSubdirs`
was required to pass the complexity gates and therefore landed inside its
GREEN commit.

## RED evidence

Both TDD tasks recorded and verified their RED phase with
`gsd-tools check tdd-red-evidence`, verdict `RED_EVIDENCE_OK` in each case:

- Task 1 target: `MANF-03 a declared ./skills/ collapses onto the conventional skills dir` — 169 tests, 164 pass, 5 fail, all five failing on the planned canonical-path assertion.
- Task 2 target: `MANF-03 a declared skill subdir and its conventional parent yield one skill` — 13 tests, 10 pass, 3 fail; the target failed with exactly the two spurious warnings for `help` and `tokens`.

## Files Created/Modified

- `extensions/pi-claude-marketplace/domain/resolver.ts` — `validateComponentPath` returns `path.relative(pluginRoot, candidate)`, storing `"."` for the empty string (D-01-16); the doc comment names both `collectStrictComponentKind` and `collectLooseComponentKind` as inheriting callers.
- `extensions/pi-claude-marketplace/bridges/skills/discover.ts` — `seenByDir` map, its lookup and record in `collectSelfSkillDir` and in the new `collectSkillSubdirs`.
- `tests/domain/resolver.test.ts` — 7 cases covering the canonical form, the root-relative `"."`, case sensitivity, both witness shapes, loose-mode inheritance, and the raw-spelling containment refusal.
- `tests/bridges/skills/discover.test.ts` — 3 cases plus a `writeSkill` helper; the four pre-existing collision cases are byte-unchanged.
- `tests/architecture/declared-component-path-overlap.test.ts` — the criterion-3 witness gate.

## Decisions Made

- **`seenByDir` keys on `path.resolve`, independently of the resolver change.** The skills bridge builds `skillsDir` with `path.join`, which preserves a trailing separator, where the sibling commands bridge uses `path.resolve`, which strips one. `DiscoveredSkill.skillDir` is therefore not canonical by construction, so keying on the raw value would have made the self-skill-dir key and the subdir key compare on different footings and made the fix depend on Task 1 having landed first.
- **`seenByDir` records on both branches.** The accepted skill and the one that lost the generated-name race are both recorded, because the map answers "has this physical directory been processed", which is true either way. `seenByGenerated`'s own membership rule is untouched.
- **Extract rather than suppress the complexity breach.** See the deviation below.
- **Scope fence honored (D-01-24).** `bridges/commands/discover.ts` has the identical overlap shape and was left alone. The two bridges remain a fallow-reported mirrored clone pair; if the commands side is ever fixed, fixing both symmetrically is the lower-duplication move.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Extracted `collectSkillSubdirs` to clear both cognitive-complexity ceilings**

- **Found during:** Task 2 (GREEN phase)
- **Issue:** Adding the `seenByDir` lookup to the subdir loop pushed `discoverPluginSkills` from cognitive complexity 15 to 16. Both independently-computed gates broke together: ESLint `sonarjs/cognitive-complexity` reported "from 16 to the 15 allowed", and `fallow health` reported `16 ! cognitive` against `maxCognitive: 15`. `npm run lint` and `npm run fallow` are links 2 and 3 of `npm run check`, so the task could not complete.
- **Fix:** Moved the subdir enumeration body out of `discoverPluginSkills` into a new module-private `collectSkillSubdirs`, with the same five positional parameters the plan specified for `collectSelfSkillDir`. No behavior change; the loop body is unchanged apart from one indentation level.
- **Considered and rejected:** adding a `health.thresholdOverrides` entry to `.fallowrc.json`. The repo currently has zero such entries and CONVENTIONS.md records that as deliberate; an override would also not have satisfied the ESLint half.
- **Files modified:** `extensions/pi-claude-marketplace/bridges/skills/discover.ts`
- **Verification:** `npm run lint` exit 0; `npm run fallow` exit 0 with `0 above threshold`; all 13 skills-bridge tests pass.
- **Committed in:** `2f3a6946` (part of the Task 2 GREEN commit)

**2. [Rule 3 - Blocking] Renamed five new resolver test cases to drop apostrophes**

- **Found during:** Task 1 (RED phase)
- **Issue:** `gsd-tools check tdd-red-evidence` normalizes the `targetTest` field it is given but not the TAP names it parses, so a title containing `'` could never match and the gate returned `INVALID_RED (no_target_test_failure)` on a genuinely intentional RED.
- **Fix:** Retitled the affected cases without apostrophes (`MANF-03 a declared ./skills/ collapses onto the conventional skills dir` rather than `MANF-03 a declared './skills/' collapses ...`). The titles still state public behavior, as the project test rules require.
- **Files modified:** `tests/domain/resolver.test.ts`
- **Verification:** `gsd-tools check tdd-red-evidence` returned `RED_EVIDENCE_OK`.
- **Committed in:** `29c4f3f5` (part of the Task 1 RED commit)

---

**Total deviations:** 2 auto-fixed (both Rule 3, blocking)
**Impact on plan:** Neither changes behavior or scope. The extraction is a
structural rearrangement forced by a quality gate; the rename is a test-title
change forced by a tooling gate. No scope creep.

## Issues Encountered

- The `fix-unicode-dashes` and `prettier` pre-commit hooks rewrote three of the touched files mid-run (em dashes to `--`, and formatting). Each was re-run to green before staging, per CLAUDE.md — no `--amend` recovery was needed because no commit had happened.
- TruffleHog's pre-commit entry is a git-mode scan and cannot run in this linked worktree (`.git` is a file, so `.git/index` is "not a directory"). Every commit was preceded by the filesystem-mode scan CLAUDE.md documents — `verified_secrets: 0, unverified_secrets: 0` each time — and then made with `SKIP=trufflehog` and nothing else.

## Verification

| Command | Result |
|---|---|
| `node --test tests/domain/resolver.test.ts` | 169 tests, 169 pass, 0 fail |
| `node --test tests/bridges/skills/discover.test.ts` | 13 tests, 13 pass, 0 fail |
| `node --test tests/architecture/declared-component-path-overlap.test.ts` | 3 tests, 3 pass, 0 fail |
| the plan's three-suite baseline plus the new gate | 265 tests, 265 pass, 0 fail (no regression against the recorded 244) |
| `npm run typecheck` | exit 0, no `error TS` |
| `npm run lint` | exit 0 |
| `npm run fallow` | exit 0, `0 above threshold`, no new clone group |
| `npm run format:check` | exit 0 |
| `npm run test:corresponding` | `Corresponding-test gate passed.` |
| `npm run check` (all nine links) | exit 0 — 5347 unit + 31 integration |
| `pre-commit run --all-files` | clean except the structural TruffleHog worktree failure; no files modified |
| negative control: the new gate against the sources at `a456086e` | 3 tests, 0 pass, 3 fail (the gate fires) |

## Known Stubs

None. No stub value, placeholder string, skipped test, or unrun `<verify>` was
left behind by this plan.

## Threat Flags

None. No new network endpoint, auth path, file-access pattern, or trust-boundary
schema change. T-01-01's mitigation is strengthened rather than merely preserved:
the value the three bridges re-join is now the output of
`path.relative(root, contained)`, which cannot begin with `..` once the
string-level containment check has passed, instead of an arbitrary author
spelling.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- MANF-03 is closed at the code level and gated. Plan 01-04 is unblocked; it touches `orchestrators/plugin/info.ts` and shares no file with this plan.
- **Carried to phase verification:** ROADMAP criterion 3 is worded against the real `ui5` and `ui-theme-designer` plugins. The gate proves their declared shapes offline; an actual install of the two from their marketplace is the remaining confirmation and needs network.
- **For the backlog (D-01-24):** `bridges/commands/discover.ts` carries the identical declared-versus-convention overlap and would warn identically under the same conditions. It is out of scope because the four known bare-manifest plugins declare no commands. The two bridges are a mirrored clone pair, so fixing both symmetrically is the lower-duplication move whenever the commands side is taken up.

---
*Phase: 01-manifest-read-fidelity*
*Completed: 2026-09-13*

## Self-Check: PASSED

All five listed files exist on disk and all five task commits resolve in
`git log`.
