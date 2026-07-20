---
phase: 84-emit-an-agent-local-skillpath-field-on-every-generated-agent
plan: 02
subsystem: infra
tags: [package.json, peer-dependencies, pi-subagents, requirements-doc]

requires:
  - phase: 84-01
    provides: "emitGeneratedAgentFile emits skillPath whenever frontmatter.skills is non-empty (the mechanism this floor bump targets)"
provides:
  - "package.json declares pi-subagents >=0.35.0 as an OPTIONAL peerDependency (peerDependenciesMeta.optional: true), never installed, never imported"
  - "README prerequisites bullet states the pi-subagents >=0.35.0 floor"
  - "REQUIREMENTS.md AGSK-06 + re-amended AGSK-04 confirmed already correct from Plan 84-01 (no duplicate edits made)"
affects: [84-03, 84-04-live-verification]

tech-stack:
  added: []
  patterns:
    - "Soft/presence-probed runtime peers are declared as an OPTIONAL peerDependencies entry (peerDependenciesMeta.optional: true), never as a dependencies/devDependencies entry, since npm must neither install nor error on the absent package"

key-files:
  created: []
  modified:
    - package.json
    - package-lock.json
    - README.md

key-decisions:
  - "D-84-03: pi-subagents is an ADDITION (not a bump) to peerDependencies since package.json had zero prior representation of it; marked optional via peerDependenciesMeta so npm never installs or errors on its absence"

patterns-established: []

requirements-completed: [AGSK-06, AGSK-04]

coverage:
  - id: D1
    description: "package.json declares pi-subagents >=0.35.0 as an optional peer (peerDependencies + peerDependenciesMeta.optional: true), not a dependency; no node_modules/pi-subagents tree is installed"
    requirement: AGSK-06
    verification:
      - kind: unit
        ref: "node -e assertion on package.json peerDependencies/peerDependenciesMeta shape"
        status: pass
      - kind: unit
        ref: "tests/architecture/no-telemetry-deps.test.ts#no telemetry / analytics dependencies in package.json (IL-4)"
        status: pass
      - kind: other
        ref: "test -d node_modules/pi-subagents (absence check after npm install)"
        status: pass
    human_judgment: false
  - id: D2
    description: "README prerequisites bullet for pi-subagents states the >=0.35.0 floor"
    requirement: AGSK-06
    verification:
      - kind: other
        ref: "grep -n \">=0.35.0\" README.md"
        status: pass
    human_judgment: false
  - id: D3
    description: "REQUIREMENTS.md carries AGSK-06 (four-part acceptance mirroring the ROADMAP SCs) and the re-amended AGSK-04 (single-state legend, D-84-01), with updated traceability and coverage counts"
    requirement: AGSK-04
    verification:
      - kind: other
        ref: "grep -c AGSK-06 REQUIREMENTS.md (4 occurrences) and grep -q 'available on demand' REQUIREMENTS.md"
        status: pass
    human_judgment: false
  - id: D4
    description: "npm run check stays green after the peer-dependency addition (SC-3 wave-merge requirement)"
    verification:
      - kind: other
        ref: "npm run check (typecheck, lint, format:check, unit 2978 tests, integration 16 tests)"
        status: pass
    human_judgment: false

duration: 10min
completed: 2026-07-20
status: complete
---

# Phase 84 Plan 02: pi-subagents optional peer floor + REQUIREMENTS.md reconciliation Summary

**package.json now declares `pi-subagents >=0.35.0` as an optional peerDependency (never installed, never imported), the README floor note matches it, and REQUIREMENTS.md's AGSK-06/AGSK-04 entries were confirmed already correct from Plan 84-01 with no duplicate edits.**

## Performance

- **Duration:** ~10 min
- **Completed:** 2026-07-20
- **Tasks:** 2 (1 code change committed, 1 verification-only reconciliation with no commit needed)
- **Files modified:** 3 (package.json, package-lock.json, README.md)

## Accomplishments
- `package.json` gains `"pi-subagents": ">=0.35.0"` in `peerDependencies` plus a new top-level `peerDependenciesMeta` block marking it `optional: true` -- an addition, not a bump, since pi-subagents had zero prior representation in the manifest.
- `pi-subagents` is confirmed absent from `dependencies`/`devDependencies` (it is presence-probed via the Pi tool registry, never imported as code) and absent from `node_modules/` after `npm install`.
- `README.md`'s pi-subagents prerequisites bullet now states the `>=0.35.0` floor, matching the manifest.
- `tests/architecture/no-telemetry-deps.test.ts` (IL-4 guard) stays green -- `pi-subagents` matches no forbidden telemetry pattern.
- `npm run check` (typecheck, lint, format:check, 2978 unit tests, 16 integration tests) is fully green.
- REQUIREMENTS.md's AGSK-06 definition, re-amended AGSK-04 (single-state `(available on demand)` legend citing D-84-01), traceability row, and coverage counts (6 v1 requirements, 6 mapped, 0 unmapped) were all already correct from Plan 84-01 -- verified via the plan's own acceptance criteria rather than re-edited, avoiding duplicate entries.

## Task Commits

1. **Task 1: Add pi-subagents as an optional peer dependency** - `148024ba` (feat)
2. **Task 2: Record AGSK-06 and re-amend AGSK-04 in REQUIREMENTS.md** - no commit (file already correct from Plan 84-01; see Deviations)

**Plan metadata:** pending (this commit)

## Files Created/Modified
- `package.json` - adds `pi-subagents: >=0.35.0` to `peerDependencies` and a new `peerDependenciesMeta.pi-subagents.optional: true` block
- `package-lock.json` - refreshed via `npm install` to reflect the new peer declaration (no new installed tree; minor unrelated metadata normalization from the installed npm version, e.g. `bin` path and prebuilt-optional `libc` fields)
- `README.md` - pi-subagents prerequisites bullet now states the `>=0.35.0` floor

## Decisions Made
- No new decisions beyond D-84-03 (already locked in CONTEXT.md): pi-subagents is added as an OPTIONAL peer, never a `dependencies` entry, matching its presence-probed runtime nature.

## Deviations from Plan

### Auto-fixed Issues

None - both tasks executed exactly as written; no bugs, missing functionality, or blocking issues were found.

**Note on Task 2 (not a deviation, a plan-anticipated reconciliation):** The plan's own `<important_reconciliation_note>` anticipated that Plan 84-01 (same wave) may have already landed REQUIREMENTS.md's AGSK-06/AGSK-04 work. On inspection, AGSK-06 was already defined with its four-part acceptance text, AGSK-04 already used the single-state `(available on demand)` legend citing D-84-01, the traceability table already had an AGSK-06 row mapped to Phase 84, and the coverage counts already read 6 total / 6 mapped / 0 unmapped. All of Task 2's acceptance criteria (`grep -c "AGSK-06"` >= 2, single-state AGSK-04 wording, traceability row present, coverage counts correct) passed against the file as-is. No edit was made and no commit was created for Task 2, per the plan's explicit instruction not to duplicate work already done.

---

**Total deviations:** 0 auto-fixed
**Impact on plan:** None. Task 2 required no changes; verified in place per the plan's reconciliation guidance.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Plan 84-03 and 84-04 (live end-to-end A/B verification) can proceed: the optional peer floor is declared, `npm run check` is green, and REQUIREMENTS.md fully reflects AGSK-06/AGSK-04.
- No blockers.

---
*Phase: 84-emit-an-agent-local-skillpath-field-on-every-generated-agent*
*Completed: 2026-07-20*

## Self-Check: PASSED

package.json, README.md, and this SUMMARY.md were verified present on disk; commit `148024ba` was verified present in git history.
