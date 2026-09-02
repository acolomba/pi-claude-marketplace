---
phase: 116-edge-surface
plan: "30"
subsystem: testing
tags: [type-only, edge, edge-deps, ts-expect-error, satisfies]
status: complete

requires:
  - phase: 116-edge-surface
    provides: "116-00's pinned tests/helpers/notification-boundary.ts (unused by this pair, which builds no context)"
provides:
  - "tests/edge/types.test.ts — the sole mirrored direct owner for edge/types.ts, closing one of the phase's correspondence-gate violations"
affects: [117]

actuals:
  tokens: 4200
  tasks: 1
  commits: 2

tech-stack:
  added: []
  patterns:
    - "Type-only owner: satisfies bindings plus @ts-expect-error negatives, zero runtime cases, no test-runner import, and no coverage number to chase because a type-only module emits no JavaScript"
    - "Stub member types imported from the same modules the source imports them from, so a seam change is a compile error in the owner rather than a silently stale hand-copy"

key-files:
  created:
    - tests/edge/types.test.ts
  modified: []

key-decisions:
  - "The optional-member proof is positive: `{ gitOps, pluginUpdate } satisfies EdgeDeps` compiles, which is the whole contract EdgeDeps carries; no binding enumerates the member set and nothing is built on Required<EdgeDeps> (D-116-12)"
  - "GitOps and PluginUpdateFn are imported only to type the two stubs; neither is re-pinned, because tests/orchestrators/types.test.ts owns PluginUpdateFn and GitOps has its own pair"
  - "The header comment says `import of the test runner` rather than naming the module literally, because the plan's type-only scan greps the file for that token and a comment mentioning it would have failed the gate"
  - "The importClaudeSettings stub returns a hand-authored empty ClaudeImportExecutionResult literal rather than a `declare const`, because a declared binding erases at runtime and the module-scope object literals that reference it would throw"

patterns-established:
  - "A clean typecheck is itself a global proof that every @ts-expect-error in the file binds: an unattached directive raises TS2578, so all eight markers are load-bearing without eight separate plants"

requirements-completed: [MOD-09]

coverage:
  - id: D1
    description: "tests/edge/types.test.ts owns edge/types.ts as a type-only pair, pinning EdgeDeps's required-versus-optional split positively and negatively"
    requirement: MOD-09
    verification:
      - kind: other
        ref: "npm run typecheck (0 errors; an unbound @ts-expect-error would raise TS2578)"
        status: pass
      - kind: unit
        ref: "tests/edge/types.test.ts (0 runtime cases, node --test exits 0)"
        status: pass
      - kind: other
        ref: "npm run test:coverage:direct -- extensions/pi-claude-marketplace/edge/types.ts (reports type-only, exits 0)"
        status: pass
      - kind: other
        ref: "node scripts/check-corresponding-tests.mjs (13 -> 12 violations)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Every type-level negative sits on the line its diagnostic actually lands on, proven by a moved-marker plant rather than asserted"
    requirement: MOD-09
    verification:
      - kind: other
        ref: "Plant 1 — marker moved above the opening brace produced TS2578 on that line and TS1360 on the closing line"
        status: pass
      - kind: other
        ref: "Plant 2 — deleting pluginUpdate from the positive binding produced TS1360 'Property pluginUpdate is missing'"
        status: pass
    human_judgment: false

duration: "~40 min"
completed: 2026-09-02
---

# Phase 116 Plan 30: Edge Dependency Bundle Type Contract Summary

`edge/types.ts` now has a mirrored type-only owner that pins the one contract `EdgeDeps` carries —
`gitOps` and `pluginUpdate` required, `importClaudeSettings` optional — with every negative proven
to fire on the line its diagnostic actually lands on.

## What was built

`tests/edge/types.test.ts`, 122 lines, no runtime case and no import of the test runner. The file
holds four module-scope stubs, two positive `satisfies` bindings, five type-level negatives, and a
readonly proof function.

**The stubs.** `gitOps` and `pluginUpdate` are typed against `GitOps` and `PluginUpdateFn` imported
from the same two modules `edge/types.ts` imports them from, so replacing either seam breaks this
owner at compile time instead of leaving a stale hand-copy behind. `IMPORT_RESULT` is a
hand-authored empty `ClaudeImportExecutionResult`, and `importClaudeSettings` is the well-typed
optional hook that returns it.

**The positive proof.** `void ({ gitOps, pluginUpdate } satisfies EdgeDeps)` is the whole point of
the owner: the bundle is complete without the import hook, which is what "optional" means here. The
second binding adds the hook and shows the full form still satisfies.

**The negatives.** Five, in both placements D-116-13 names:

| Negative | Placement | What it proves |
| --- | --- | --- |
| `{}` | above a single-line `satisfies` | neither required member can be dropped together |
| omit `gitOps` | after the last property, before `}` | `gitOps` is required |
| omit `pluginUpdate` | after the last property, before `}` | `pluginUpdate` is required |
| hook taking `string` | above the property line | the hook takes the orchestrator options bundle |
| hook returning `Promise<string>` | above the property line | the hook resolves the orchestrator result |

**The readonly proof.** `proveEdgeDepsReadonly(deps: EdgeDeps)` assigns to all three members, each
with its own marker, and is referenced with `void` so `noUnusedLocals` is satisfied without an
export.

## Plants

Both plants the plan names were run. Both went RED.

**Plant 1 — the moved suppression comment.** The `gitOps`-omission negative's marker was moved from
the last property line to the line above the opening brace. `npm run typecheck` reported:

```
tests/edge/types.test.ts(82,1): error TS2578: Unused '@ts-expect-error' directive.
tests/edge/types.test.ts(85,3): error TS1360: Type '{ pluginUpdate: () => Promise<{ declaresAgents: false; declaresMcp: false; fromVersion: string; name: string; partition: "unchanged"; toVersion: string; }>; }' does not satisfy the expected type 'EdgeDeps'.
  Property 'gitOps' is missing in type '{ pluginUpdate: () => Promise<{ declaresAgents: false; declaresMcp: false; fromVersion: string; name: string; partition: "unchanged"; toVersion: string; }>; }' but required in type 'EdgeDeps'.
```

This is the D-116-13 defect caught in the act, with both halves visible in one run: the marker at
line 82 attaches to nothing, and the diagnostic it was meant to suppress lands three lines lower on
the closing `} satisfies EdgeDeps` line. Reverted; typecheck returned to 0.

**Plant 2 — the deleted required member.** `pluginUpdate` was removed from the positive
`{ gitOps, pluginUpdate }` binding. `npm run typecheck` reported:

```
tests/edge/types.test.ts(76,18): error TS1360: Type '{ gitOps: { checkout: () => Promise<void>; clone: () => Promise<void>; currentBranch: () => Promise<string>; fetch: () => Promise<void>; forceUpdateRef: () => Promise<...>; resolveRef: () => Promise<...>; resolveRemoteRef: () => Promise<...>; }; }' does not satisfy the expected type 'EdgeDeps'.
  Property 'pluginUpdate' is missing in type '{ gitOps: { checkout: () => Promise<void>; clone: () => Promise<void>; currentBranch: () => Promise<string>; fetch: () => Promise<void>; forceUpdateRef: () => Promise<...>; resolveRef: () => Promise<...>; resolveRemoteRef: () => Promise<...>; }; }' but required in type 'EdgeDeps'.
```

Reverted; typecheck returned to 0.

**The standing proof the plants sit on top of.** A clean `tsc --noEmit` is itself evidence that all
eight `@ts-expect-error` directives in the file bind to a real diagnostic, because an unattached one
raises TS2578 — exactly what Plant 1 produced. The two plants prove the placement rule is
load-bearing; the green typecheck proves no marker in the shipped file is decorative.

## Findings

**The type-only scan matches comments, not just imports.** The plan's verify chain includes
`! rg -n 'node:test' tests/edge/types.test.ts`. The first draft's header comment explained that the
file holds "no `node:test` import" — and that sentence made the scan match, which would have failed
the gate on a file that imports nothing. The comment now says "no import of the test runner at
all". Worth knowing for any future type-only owner in this milestone: the scan cannot tell an
import from prose about an import.

## Deviations from Plan

None. The plan executed as written. The comment rewording above is a within-task correction caught
by the plan's own verify chain, not a departure from it.

## Boundaries honored

- No member enumeration, nothing built on `Required<EdgeDeps>`, no export-surface assertion
  (D-116-12). The deferred item stays deferred to Phase 117.
- `GitOps` and `PluginUpdateFn` are imported to type two stubs and are not re-pinned.
- No exhaustiveness claim: `types.ts` declares one interface and holds no switch, so a missing-arm
  plant has no target here.
- No coverage exception, no ignore pragma, no production edit. `git diff --quiet` over
  `edge/types.ts`, all three `shared.ts` helpers, `edge/flag-catalog.ts`, and
  `tests/helpers/notification-boundary.ts` exits 0.

## Gates

Run separately, exit codes checked. `npm run check` was not used: its `format:check` link fails on
pre-existing untracked operator files and short-circuits before the tests.

| Gate | Result |
| --- | --- |
| `npm run typecheck` | 0 |
| `npm run lint` | 0 |
| `npm run fallow` | 0 |
| `npm test` | 0 — 4885 tests, 274 suites, 0 fail |
| `npm run test:integration` | 0 |
| `node --test tests/edge/types.test.ts` | 0 — 0 runtime cases |
| `npm run test:coverage:direct -- …/edge/types.ts` | 0 — reports `(type-only)` |
| `npm exec -- prettier --check` | 0 |
| anti-pattern scan | no match |
| type-only scan | no match |
| `git diff --check` | 0 |
| `git diff --quiet` over pinned files | 0 |
| `node scripts/check-corresponding-tests.mjs` | 13 → 12 violations; `tests/edge/types.test.ts` no longer named |
| trufflehog filesystem scan | 0 — 1 chunk, 4764 bytes, 0 verified, 0 unverified |
| `SKIP=trufflehog,npm-format-check pre-commit run --files …` | 0 |

## Issues Encountered

None.

## Next

Ready for the next plan in Phase 116. The correspondence gate now reports 12 violations; three of
Phase 116's remain (`tests/edge/handlers/marketplace/shared.test.ts`,
`tests/edge/handlers/plugin/shared.test.ts`, `tests/edge/handlers/plugin/import.test.ts` with its
paired `unexpected-test` at `tests/edge/handlers/import.test.ts`).

## Self-Check: PASSED

- `tests/edge/types.test.ts` exists on disk.
- Commit `d9a3d996` exists and contains exactly that one file (122 insertions, 1 file changed).
- Every `<acceptance_criteria>` item was re-run after the final edit: typecheck 0, lint 0, prettier
  0, `node --test` 0 cases, direct coverage `(type-only)` and exit 0, both scans no-match, both
  `git diff` guards 0.
