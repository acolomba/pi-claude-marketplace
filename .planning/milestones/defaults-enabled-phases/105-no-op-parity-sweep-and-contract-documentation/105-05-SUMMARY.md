---
phase: 105-no-op-parity-sweep-and-contract-documentation
plan: 05
subsystem: testing
tags: [typescript, node-test, architecture-gate, type-precision, documentation]

# Dependency graph
requires:
  - phase: 104-pre-install-read-surfaces
    provides: the REVIEW findings IN-01..IN-04 this plan closes, and the `installs disabled` pre-install reason path being retyped
provides:
  - the unfalsifiable network-free probe on the list surface removed, leaving one falsifiable probe
  - the surviving probe's cross-reference repaired so no comment points at a deleted block
  - the network-free architectural gate's header replaced by a pointer at its own annotated target array
  - a failure message that describes a non-orchestrator offender correctly, observed by tripping the gate
  - the `reasons` field discipline sentence restored to an enumerable, checkable form
  - `installsDisabledField` typed against `ContentReason` rather than one of its two consumer shapes
affects: [message-shape specification readers, future editors of the network-free gate, any narrowing of the available/remote message shapes]

actuals:
  tokens: 1811
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "An architectural gate's target list is annotated in ONE place — the array — and the header points at it rather than restating it"
    - "A conditional-spread field holder is typed against the DOMAIN type its values are, never by indexing into one consumer"

key-files:
  created: []
  modified:
    - tests/orchestrators/plugin/list.test.ts
    - tests/architecture/no-orchestrator-network.test.ts
    - docs/messaging-style-guide.md
    - extensions/pi-claude-marketplace/orchestrators/plugin/list.ts

key-decisions:
  - "Deleted the hollow probe block rather than repairing it — the repair already exists as a falsifiable sibling in the same file; the enclosing test case and its bare unfetched-row assertion were kept"
  - "Kept the `disabled` variant-count correction in the style guide (verified true against the pre-milestone tree) rather than reverting a true statement to a false one to satisfy a scope rule"
  - "Typed the holder against `ContentReason` rather than a two-consumer intersection — an intersection encodes the current consumer list into a type a third consumer would silently not join"
  - "Moved the five un-annotated target rationales inline beside their array entries rather than letting the header rewrite delete five requirement-ID anchors"

patterns-established:
  - "A probe that reads file CONTENT against a DIRECTORY, or that runs BEFORE the call it constrains, is unfalsifiable — assert path METADATA after the await and assert the caught error CODE"
  - "A gate failure message names the contract class (network-free modules), not one layer, when its target set spans layers"

requirements-completed: [DOC-01]

coverage:
  - id: D1
    description: "The unfalsifiable network-free probe is gone and the surviving falsifiable probe's dangling cross-reference is repaired; the enclosing case and the suite's test count are unchanged"
    requirement: "DOC-01"
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/list.test.ts (83 tests before and after; `# fail 0`)"
        status: pass
      - kind: other
        ref: "grep -c clonesExisted|clonesDir|'near the tail of this file' => 0; 'plugin-clones/ must not exist after the render' => 1; ENOENT => 7 (unchanged)"
        status: pass
    human_judgment: false
  - id: D2
    description: "The network-free gate's header points at its own annotated target array, and its failure message describes a non-orchestrator offender correctly"
    verification:
      - kind: unit
        ref: "tests/architecture/no-orchestrator-network.test.ts + node --test 'tests/architecture/**/*.test.ts' (353 pass, 1 pre-existing skip)"
        status: pass
      - kind: manual_procedural
        ref: "mutation check: appended a gitOps token to domain/resolver.ts, observed the gate FAIL with the corrected message, discarded the edit (message recorded verbatim below)"
        status: pass
    human_judgment: false
  - id: D3
    description: "The message-shape specification states a checkable totality again, with the verified-true variant-count correction kept and flagged"
    verification:
      - kind: other
        ref: "grep -c 'Every remaining variant omits the field entirely' docs/messaging-style-guide.md => 1; git diff shows exactly one changed line, still naming four transition variants including `disabled`"
        status: pass
      - kind: unit
        ref: "node --test 'tests/architecture/**/*.test.ts' (the vocabulary guard reads this document)"
        status: pass
    human_judgment: false
  - id: D4
    description: "`installsDisabledField` is typed against `ContentReason`, so a narrowing of either consumer message shape surfaces at the literal that broke rather than at the holder's declaration"
    verification:
      - kind: unit
        ref: "npx tsc --noEmit (clean); node --test tests/orchestrators/plugin/list.test.ts (83 pass, count unchanged)"
        status: pass
      - kind: manual_procedural
        ref: "mutation check: narrowed PluginAvailableMessage.reasons; NEW typing errors at the `available` literal (list.ts:752), OLD typing errored at the holder declaration (list.ts:678); both shapes restored"
        status: pass
    human_judgment: false

duration: 22min
completed: 2026-08-15
status: complete
---

# Phase 105 Plan 05: Close the previous review's four open findings Summary

**Removed a network-free guard that could never fail, repointed an architectural gate's header and failure message at the eleven targets it actually has, restored an enumerable clause to the message-shape specification, and retyped the pre-install reason holder against `ContentReason` so a narrowing of either consumer reports at the right site.**

## Performance

- **Duration:** 22 min
- **Started:** 2026-08-15T21:34:00Z
- **Completed:** 2026-08-15T21:56:00Z
- **Tasks:** 3
- **Files modified:** 4

## Accomplishments

- **The hollow guard is gone.** The probe asked for file CONTENT against a DIRECTORY path, so its boolean was unconditionally `false` whether or not the directory existed, and it ran BEFORE the `listPlugins` call it meant to constrain — it described the fixture, not the render. It could not fail while reading as coverage. The falsifiable sibling (path metadata, after the await, asserting the caught `ENOENT`) already carries the guarantee properly, so the block was deleted rather than repaired.
- **The two-region nature of that deletion was honored.** The surviving probe's comment closed by directing a reader at "a similar block near the tail of this file". Once the block went, that direction pointed at nothing. It is replaced by the same durable lesson stated without a referent.
- **The gate now describes its own target set.** The header enumerated five targets per file while the array holds eleven, and the failure message named `plugin orchestrator(s)` — which would misdescribe the resolver, the one gated file outside the orchestrator layer. Both corrected, and the corrected message was OBSERVED rather than assumed.
- **The specification regained a checkable claim,** and the `installs disabled` holder is typed against the domain type its values are.

## Task Commits

1. **Task 1: Remove the network-free probe that cannot fail, repair its cross-reference** — `546cd284` (test)
2. **Task 2: Make the gate's header and failure message describe the target set it has** — `e02eada7` (test)
3. **Task 3: Restore the specification's enumerable clause; type the reason holder against `ContentReason`** — `5308a5d2` (refactor)

## Files Created/Modified

- `tests/orchestrators/plugin/list.test.ts` — probe block deleted (13 lines), sibling comment's dangling cross-reference replaced
- `tests/architecture/no-orchestrator-network.test.ts` — header enumeration replaced by a pointer at `FORBIDDEN_TARGETS`; the five entries that lacked inline rationale now carry it; failure message generalized
- `docs/messaging-style-guide.md` — one line: the reason-field discipline sentence's closing clause
- `extensions/pi-claude-marketplace/orchestrators/plugin/list.ts` — type-only `ContentReason` import, holder annotation, and the comment above it

## Mutation check evidence

Both mandated hand mutations were performed and discarded. Neither is committed; `git diff --name-only -- extensions/` was confirmed empty after each restore.

**Task 2 — gate failure message, tripped on the non-orchestrator target** (appended `const __mutationProbe = gitOps;` to `domain/resolver.ts`). The gate FAILED with, verbatim:

```text
NFR-5 / PI-2 / PL-3 / PRL-07 violation: gitOps surface detected in network-free module(s):
  extensions/pi-claude-marketplace/domain/resolver.ts matches forbidden gitOps reference: /\bgitOps\b/
  (every gated target is network-free by contract; among the gated orchestrator candidates, only update.ts is permitted to import gitOps via Pattern S-9.)
```

This is the whole point of the reword: a resolver offender is now described as a network-free module rather than as a plugin orchestrator, which it is not.

**Task 3 — narrowing one consumer shape.** `PluginAvailableMessage.reasons` was narrowed to `readonly "up-to-date"[]` (the shape the OLD annotation indexed into):

| Annotation | Where the error landed |
|---|---|
| NEW (`readonly ContentReason[]`) | `list.ts(752,11)` — the `available` message literal, the site that actually stopped accepting the token |
| OLD (`NonNullable<PluginAvailableMessage["reasons"]>`) | `list.ts(678,9)` — the holder's own DECLARATION |

The old form's derived annotation narrowed along with its consumer, so the typechecker reported the holder as the problem instead of the literal. This is the defect the retype fixes, and it is not observable from a green build.

## Decisions Made

- **Deleted the probe block, kept the case.** The case's remaining assertion is the only place a git-source uninstalled plugin seeded through the plain manifest path renders a bare unfetched row. Thin, but not zero, and not this plan's to remove.
- **KEPT the style guide's `disabled` variant-count correction, deliberately.** It was verified true against the pre-milestone tree (`PluginDisabledMessage` already declared `reasons?`), so the old "exactly three" was a genuine pre-existing documentation error. Reverting a true statement to a false one to satisfy a scope rule is the worse trade. Flagged here rather than folded in silently, which is the disposition the review itself offered.
- **`ContentReason` over a two-consumer intersection.** The intersection tracks a narrowing of either consumer, but it encodes the current consumer list into a type expression that a third consumer would silently not join. The domain type degrades gracefully.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] The header rewrite would have asserted a falsehood and deleted five requirement-ID anchors**

- **Found during:** Task 2
- **Issue:** The plan's action ("every entry carries its own rationale beside it, so the set is not restated here") is true for six of the eleven targets. The first five — `install.ts`, `list.ts`, `reinstall.ts`, `plugin/info.ts`, `marketplace/info.ts` — had NO inline comment; their rationale existed only in the header enumeration being deleted. Replacing the header as written would have made the new pointer sentence false and destroyed the `NFR-5` / `PL-3` / `PRL-07` / `INFO-01` / `INFO-02` anchors, plus the substantive and non-obvious explanation of why `install.ts` is gated at all despite delegating clones to the `clone-cache.ts` seam.
- **Fix:** Moved that rationale inline beside the five entries, matching the pattern the other six already follow. The header's claim is now true and the information lives in exactly one place — which is the drift-proofing the task was after.
- **Files modified:** `tests/architecture/no-orchestrator-network.test.ts`
- **Verification:** All eleven target strings extracted from `HEAD` and from the working tree and diffed — byte-identical and in the same order. Pattern array and assertion call unchanged. Gate green; mutation check still trips it.
- **Committed in:** `e02eada7`

**2. [Rule 1 - Bug] A comment I wrote in Task 3 stated an unverified failure mode**

- **Found during:** Task 3, immediately after the mutation check
- **Issue:** My first draft of the comment above `installsDisabledField` said naming one consumer would surface a narrowing of *the other* at the declaration. The mutation showed the opposite mechanism: narrowing the *named* consumer drags the derived annotation with it and reports at the declaration.
- **Fix:** Rewrote the comment to state the mechanism the mutation actually demonstrated.
- **Files modified:** `extensions/pi-claude-marketplace/orchestrators/plugin/list.ts`
- **Verification:** `npx tsc --noEmit`, `npx eslint`, `npm run format:check` all clean; comment now matches the recorded mutation evidence.
- **Committed in:** `5308a5d2`

---

**Total deviations:** 2 auto-fixed (both Rule 1 — each corrected an inaccuracy the change itself would otherwise have introduced)
**Impact on plan:** No scope creep beyond the four named findings. The only production diff remains a type annotation, a type-only import and one comment, as the plan required.

## Acceptance criteria that did not hold as written

Three criteria were written against mistaken baselines. In each case the substantive invariant behind the criterion was verified by other means; none indicates a problem with the work.

1. **`grep -c 'gplug v1\.0\.0 (remote)'` returns `1`.** It returns `0` — the file spells the string inside a regex literal (`/◌ gplug v1\.0\.0 \(remote\)/`), so the parenthesis is escaped. Counting the real form gives **2 at `HEAD` and 2 now** (a second, unrelated `(remote)` case at what is now `:2855`). The edited case's own assertion is intact at `:2982`; the count is unchanged, which is what the criterion meant to pin.
2. **`grep -c 'FORBIDDEN_TARGETS'` unchanged.** It went from 2 to 3, because the new header pointer NAMES the array it points at — which is what the plan's action asked for. The substantive half of the same criterion (no line inside the target array added, removed or reordered) was verified directly by extracting and diffing all eleven target strings.
3. **`git diff` on the gate shows no line inside the target array changed.** Superseded by deviation 1 above: five rationale comments were added beside entries. No target string changed, in content or in order.

## Issues Encountered

- The `trufflehog` pre-commit hook fails structurally in a linked worktree (git-mode scan cannot read `.git/index`). Handled per `CLAUDE.md`: a filesystem-mode scan over each commit's paths returned `verified_secrets: 0, unverified_secrets: 0` before each `SKIP=trufflehog` commit. All other hooks — `prettier`, `mdformat`, `markdownlint`, `npm lint`, `npm format check`, `npm typecheck` — passed.
- Ran alongside two sibling executors in one worktree. Every commit used the `git commit -F <msg> -- <paths>` pathspec form; the three commits touch only this plan's four files.

## Observations left for a later reader (NOT acted on)

Both are the same class of staleness this plan closes, and both are one line. They were left alone because the plan pinned its diffs explicitly and neither is a correctness defect.

- `tests/orchestrators/plugin/list.test.ts:2966` — the edited case's TITLE still reads "…with no plugin-clones dir on disk (no clone, no network)". The case no longer asserts that half; the claim now lives entirely in the sibling at `:568`. A title that names coverage the body does not carry is the same shape of defect as the probe that was deleted.
- `tests/architecture/no-orchestrator-network.test.ts:80` — the test TITLE still says "network-free orchestrators", the phrasing corrected in the failure message because it misdescribes the resolver target.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All four of the previous review's open Info findings (IN-01 is closed by the sibling plan's catalog edit; IN-02, IN-03, IN-04 are closed here) are resolved.
- No behavior changed. The list suite holds the same 83 tests it did before; the architecture suite holds the same 354.
- `npm test` / `npm run check` at the wave boundary is still owed — siblings were mid-edit, so per the execution brief only the scoped suites, `tsc`, `eslint` and `format:check` were run here.

## Self-Check: PASSED

- `.planning/workstreams/defaults-enabled/phases/105-no-op-parity-sweep-and-contract-documentation/105-05-SUMMARY.md` — FOUND
- Commits `546cd284`, `e02eada7`, `5308a5d2` — all FOUND in `git log`
- All four modified files present and containing their pinned strings (`ENOENT`, `FORBIDDEN_TARGETS`, `Every remaining variant omits the field entirely`, `ContentReason`)

---
*Phase: 105-no-op-parity-sweep-and-contract-documentation*
*Completed: 2026-08-15*
