---
phase: 03-dependency-resolution
plan: 03
subsystem: documentation
tags: [dependency-resolution, constraints, nfr-5, version-constraint-grammar, user-facing-docs]

requires:
  - phase: 03-dependency-resolution
    plan: 01
    provides: "the cascade this document describes, and the runPhases second consumer the architecture entry now names"
  - phase: 03-dependency-resolution
    plan: 02
    provides: "domain/dependency-range.ts -- the intersection, the two caps and the three failure reasons the documented grammar must match"
provides:
  - "the amended NFR-5 network policy, byte-identical in .planning/PROJECT.md and CLAUDE.md, declaring the constrained-dependency tag query as an exception rather than leaving it to be discovered"
  - "docs/dependency-resolution.md: RESV-03's written grammar, the two project-owned caps stated as project-owned, and the nine-cause failure list"
  - "the user-facing statement that no marketplace is added or cloned to satisfy a dependency (the D-03-08 trust boundary)"
  - "a transaction-layer architecture entry that names both runPhases consumers"
affects:
  [
    the network leaf the tag probe lands in,
    the closed REASONS vocabulary,
    per-member outcome reporting,
  ]

actuals:
  tokens: 4661
  tasks: 2
  commits: 2
plan_head_before: fcea871147fca4e56ea8e9ae25732ae9c0d58049

tech-stack:
  added: []
  patterns:
    - "A constraint carried in two files is kept byte-identical by normalizing the character a per-path-excluded formatting hook would otherwise keep apart"
    - "A written grammar lands before the code that must agree with it, so the later reason tokens have a stated contract to match"

key-files:
  created:
    - docs/dependency-resolution.md
  modified:
    - .planning/PROJECT.md
    - CLAUDE.md
    - .planning/codebase/ARCHITECTURE.md
    - README.md
    - README.es.md

key-decisions:
  - "The amended network-policy bullet is now byte-identical in both files. PROJECT.md's em dash is normalized to the double hyphen CLAUDE.md already carried, because pre-commit's fix-unicode-dashes hook excludes .planning/ and would otherwise re-open the gap on every future edit of either file."
  - "The document states the string element shape carries a CARET range only, because `@^` is the marker that splits the range from the address. Any other constraint form needs the object shape. This is a real limit of the parser that a reader cannot infer from a list of accepted range forms."
  - "The prerelease rule is stated with a worked pair (`^1.0.0` accepts `1.4.2` and rejects `1.4.2-rc.1`) because `satisfies` runs at the semver default and this is the surprise a reader is most likely to hit."
  - "The unadded-marketplace failure carries the trust rule in prose, not only as a row: nothing is added or cloned to satisfy a dependency, so a plugin cannot introduce a new source of code by declaring one."
  - "The two size caps are stated as this project's own values, not values read from Claude Code, matching how plan 03-02 documented them in the module."

patterns-established:
  - "A byte-identity requirement across two files must account for which formatting hooks each path is excluded from; identical intent is not identical bytes."
  - "A stale claim can survive the commit that was supposed to correct it when the correction is targeted by prose location rather than by a grep over the whole file."

requirements-completed: []

coverage:
  - id: D1
    description: "The project's stated network policy declares the constrained-dependency tag query, in byte-identical wording in both files that carry the policy"
    requirement: RESV-03
    verification:
      - kind: command
        ref: "grep -c 'D-03-03' .planning/PROJECT.md CLAUDE.md reports a non-zero count for both"
        status: pass
      - kind: command
        ref: "diff <(grep -F '**Network policy' .planning/PROJECT.md) <(grep -F '**Network policy' CLAUDE.md) reports no difference"
        status: pass
      - kind: command
        ref: "the D-03-03 bullet sits between PROJECT.md's '## Constraints' (line 568) and '## Key Decisions' (line 583) headings"
        status: pass
    human_judgment: false
  - id: D2
    description: "ARCHITECTURE.md no longer claims runPhases has exactly one production consumer anywhere in the file"
    requirement: RESV-03
    verification:
      - kind: command
        ref: "grep -n 'sole `runPhases`|exactly ONE production consumer|ONE production consumer' .planning/codebase/ARCHITECTURE.md returns nothing"
        status: pass
      - kind: architecture
        ref: "node --test tests/architecture/import-boundaries.test.ts (10 pass, 0 fail)"
        status: pass
    human_judgment: false
  - id: D3
    description: "docs/dependency-resolution.md states the accepted version-constraint forms, how several declarations combine, and both size caps as project-owned"
    requirement: RESV-03
    verification:
      - kind: command
        ref: "grep '^## What a version constraint can say$' docs/dependency-resolution.md matches"
        status: pass
      - kind: source-check
        ref: "every listed form (caret, tilde, comparison, union, x-range, wildcard) is one semver validRange accepts, and the caps 4096 and 1024 match MAX_RANGE_INPUT_CHARS and MAX_RANGE_CONJUNCTS in domain/dependency-range.ts"
        status: pass
      - kind: source-check
        ref: "the field character rules match TOKEN_PATTERN, VERSION_PATTERN and SHA_PATTERN in domain/dependencies.ts"
        status: pass
    human_judgment: true
    rationale: "The prose-to-source correspondence is checked by reading, not by a runner. No gate binds this document to the modules it describes, and the phase deliberately adds none (T-03-12 is dispositioned accept)."
  - id: D4
    description: "The failure list enumerates all nine causes, including the unadded marketplace with its no-auto-add trust rule"
    requirement: RESV-03
    verification:
      - kind: command
        ref: "the '## Why a dependency can fail' table carries 9 data rows excluding the header"
        status: pass
      - kind: command
        ref: "grep '^## Why a dependency can fail$' docs/dependency-resolution.md matches"
        status: pass
    human_judgment: false
  - id: D5
    description: "The documented tag convention is named as plugin-release tooling rather than a git standard, and a source that does not follow it is stated to report no matching tag"
    requirement: RESV-03
    verification:
      - kind: source-check
        ref: "matches the 03-CONTEXT.md <specifics> note and D-03-02.2's `<pluginName>--v<semver>` form"
        status: pass
    human_judgment: true
    rationale: "A parity claim about Anthropic's release tooling cannot be asserted by a local test. It is transcribed from the phase context's own binary-verified note."
  - id: D6
    description: "Both READMEs link the new document in the form the two existing documentation links use"
    requirement: RESV-03
    verification:
      - kind: command
        ref: "grep -c 'docs/dependency-resolution.md' README.md README.es.md reports 1 for each"
        status: pass
      - kind: command
        ref: "SKIP=trufflehog pre-commit run --files docs/dependency-resolution.md README.md README.es.md passes every hook"
        status: pass
    human_judgment: false

duration: 4min
completed: 2026-09-15
status: complete
---

# Phase 3 Plan 3: Constraint amendment and written grammar Summary

**The project's stated network policy now declares the constrained-dependency tag query in byte-identical wording in both files that carry it, and `docs/dependency-resolution.md` is RESV-03's written grammar: the accepted constraint forms, how several declarations intersect, both project-owned caps, the tag convention that is not a git standard, and the nine ways a dependency can fail.**

## Performance

- **Duration:** ~4 min from the start marker, which was set after the context-loading pass. The reading of the plan, both sibling summaries, the two source modules and the two existing user-facing documents ran before the marker and is not in this figure.
- **Started:** 2026-09-15T02:07Z
- **Completed:** 2026-09-15T02:11Z
- **Tasks:** 2
- **Files modified:** 6 (1 created, 5 modified)

## Accomplishments

- **The NFR-5 amendment lands as a stated constraint, in both files, in the same bytes.** Resolving a dependency that carries a version constraint may read that dependency's source repository tag list over the network, even when a cached or otherwise resolvable copy already exists, because the constraint can demand a different tag than the cached one. Every read-only guarantee is intact and unqualified: `list`, `info`, `uninstall`, `marketplace remove` and every path-source operation still must not touch the network. This is what makes the network leaf plan 03-04 builds a declared exception a reviewer can check against, rather than a behavior a future reader meets through a failing architecture test.
- **`docs/dependency-resolution.md`** answers, in order, what a plugin declares, which marketplace a dependency comes from, what a constraint can say, how several declarations combine, how a constrained dependency is resolved, what happens to one already installed, where a dependency lands, the nine ways it can fail, and what a failure does to the install. Every statement is checkable against `domain/dependencies.ts`, `domain/dependency-range.ts`, or a decision recorded in `03-CONTEXT.md`.
- **The string element's caret-only limit is stated plainly.** A reader given a list of accepted range forms would reasonably assume all of them work in `"formatter@..."`. They do not: `@^` is the marker that splits the range from the address, so the string shape carries a caret range only and every other form needs the object shape. A four-row table shows each string form and what it parses to.
- **The tag convention is named for what it is.** `<plugin-name>--v<version>` comes from Anthropic's own plugin-release tooling. Git does not define it, and a repository that does not follow it reports no matching tag. The document says outright that this is today's expected answer for most third-party sources and is not a defect.
- **The unadded-marketplace rule carries its trust statement in prose.** Nothing is added and nothing is cloned to satisfy a dependency, so a plugin cannot introduce a new source of code by declaring a dependency against one. This is the user-facing form of the D-03-08 boundary plan 03-01 enforces in code (T-03-11).
- **The transaction-layer architecture entry names both `runPhases` consumers**, the inner per-plugin ledger with its literal six-phase array and the outer per-closure-member cascade whose array derives from the closure walk's post-order.
- Both READMEs carry the link. `SKIP=trufflehog pre-commit run --files` is clean over all six files.

## Task Commits

1. **Task 1: Amend the network policy and correct the ledger-consumer claim** - `a7912014` (docs)
2. **Task 2: State the version-constraint grammar in writing** - `0c41e1e7` (docs)

**Plan metadata:** the `docs(03-03): complete the constraint amendment and grammar plan` commit, which carries this file (a commit cannot record its own hash).

## Files Created/Modified

- `docs/dependency-resolution.md` - the new user-facing grammar document, 130 lines.
- `.planning/PROJECT.md` - the amended network-policy constraint bullet.
- `CLAUDE.md` - the same bullet, byte-identical.
- `.planning/codebase/ARCHITECTURE.md` - the transaction layer's `Used by` entry names both ledger consumers.
- `README.md`, `README.es.md` - one linking paragraph each, in the plugin install section.

## Decisions Made

- **Byte-identity required normalizing a dash, not only appending a clause.** The two bullets were already out of sync before this plan: `PROJECT.md` carried an em dash where `CLAUDE.md` carried a double hyphen, because pre-commit's `fix-unicode-dashes` hook excludes `^\.planning/`. Appending the new clause to both would have left the acceptance criterion unmet and the drift in place. Normalizing `PROJECT.md`'s em dash to the double hyphen closes it and keeps it closed: the hook cannot re-open a gap in text it would not rewrite either way.
- **The caret-only limit of the string shape is documented as a first-class fact.** It is a parser limit (`RANGE_MARKER = "@^"` in `domain/dependencies.ts`) with no signal in the range vocabulary itself, so a reader who only saw the accepted-forms table would write `"formatter@>=1.2.0"` and get a name that fails the token allowlist.
- **The prerelease rule ships with a worked pair.** `recordedVersionSatisfies` calls `satisfies` with no options, so the semver default applies and a range naming no prerelease rejects a prerelease version. Stating the rule alone invites the wrong reading, so the document gives `^1.0.0` accepting `1.4.2` and rejecting `1.4.2-rc.1`.
- **The `sha` field is listed but not given resolution semantics.** `domain/dependencies.ts` parses and allowlists it, and the document says it holds a git object name. How a `sha` participates in resolution is not settled by any decision in `03-CONTEXT.md`, so the document does not claim one.
- **The recorded-version coercion risk is stated in user-facing prose.** D-03-04 accepts that `coerce` on a `hash-<12hex>` or `sha-<12hex>` value can yield a misleading version. That is a surprise a user can hit directly, and it is checkable against `recordedVersionSatisfies`, so it belongs in the document rather than only in the decision log.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] The stale `runPhases` claim was in a third location, not the two the plan named**

- **Found during:** Task 1
- **Issue:** The plan directed the correction at "the Pattern Overview bullet and the `Phase<C> ledger` key-abstraction entry". Plan 03-01 had already corrected both in its own metadata commit, and recorded that it did so. A third assertion survived, in the `transaction/` layer section's `Used by` line: "`orchestrators/plugin/install-outcome.ts` (sole `runPhases` consumer)". Editing only where the plan pointed would have left the file still claiming a single consumer and the `must_haves` truth still false.
- **Fix:** The correction was targeted by a grep for `runPhases` over the whole file rather than by the two prose locations the plan named. The surviving line now reads "the two `runPhases` consumers", names each with its tier, and notes that the cascade's array derives from `domain/dependency-closure.ts`'s post-order. The derived-array counter-rationale the plan asked for is already carried at the Pattern Overview bullet, so it is not restated.
- **Files modified:** `.planning/codebase/ARCHITECTURE.md`
- **Verification:** `grep -n 'sole \`runPhases\`|exactly ONE production consumer|ONE production consumer' .planning/codebase/ARCHITECTURE.md` returns nothing; `node --test tests/architecture/import-boundaries.test.ts` passes 10/10.
- **Commit:** `a7912014`

**2. [Rule 2 - Missing critical] `README.es.md` must change in the same commit as `README.md`**

- **Found during:** Task 2
- **Issue:** The plan's file list and its acceptance criteria name `README.md` only. `.claude/rules/readme.md` states that every `README.*.md` is a translation of `README.md` and that the two must never drift: a change to one applies to every localized README in the same commit. This repository ships `README.es.md`. Landing the link in `README.md` alone would have introduced exactly the drift that rule exists to prevent.
- **Fix:** The same linking paragraph was added to `README.es.md`, translated, at the same position in the plugin install section. The link target, the command examples around it and the file path are unchanged between the two, per the rule's instruction to translate prose and keep link targets identical.
- **Files modified:** `README.es.md`
- **Verification:** `grep -c 'docs/dependency-resolution.md' README.md README.es.md` reports 1 for each; `pre-commit run --files` passes `mdformat` and `markdownlint-cli2` on both.
- **Commit:** `0c41e1e7`

**Total deviations:** 2 auto-fixed (1 Rule 1 bug, 1 Rule 2 missing critical).
**Impact:** Deviation 1 is the substantive one. It is the failure mode the plan's own read_first instruction was meant to catch and did not, because the instruction named prose locations that a sibling plan had already fixed while a third location went unnamed. The general shape is worth recording: when a plan directs a correction at named prose, grep the whole file for the claim instead, because a concurrent plan may have moved the remaining instance. Deviation 2 is a project rule the plan did not carry; it costs one extra file in the same commit and nothing else.

## Issues Encountered

- **TruffleHog cannot scan this checkout.** `/home/acolomba/src/pi-claude-marketplace-manifest` is a linked git worktree, so `.git` is a file and TruffleHog cannot read the index. Both commits ran `SKIP=trufflehog`, per the repository's own worktree guidance and the precedent of plans 03-01 and 03-02. Every other pre-commit hook passed on every file.
- **`mdformat` rewrote the new document's table alignment.** This is the hook working as intended and it reported `Passed`. The rewrite happened during the pre-commit run that preceded staging, so the realigned bytes are what the commit carries. No follow-up commit was needed.
- **`state.advance-plan` left a stale narrative.** The verb moved the plan counter to "4 of 7" but left "Status: Plan 03-01 complete" and a Current Position paragraph that predates plan 03-02. `state.update-progress` also reported no `Progress:` line in the body to update, and read `completed_plans: 8` because it ran before this file existed. All three were corrected by hand: the Status line, the narrative for plans 03-02 and 03-03, and `completed_plans: 9`. `percent` tracks phases (2 of 5) and stays 40.
- **`requirements.ready-ids` reports RESV-03 as not ready.** A sibling plan in this phase also declares it and has no summary yet, so the shared-ID gate correctly withholds it. `requirements.mark-complete` was not run and `REQUIREMENTS.md` is unchanged.

## Known Stubs

None. This plan adds no code. The document describes behavior that either ships today (the cascade, the intersection, the scope and file rules) or is the stated contract the remaining plans in this phase must meet (the tag probe in 03-04, the reason tokens in 03-06). The plan's own `key_links` names that second category as this document's purpose: it is the grammar the later work agrees with, not a report of finished work.

## Threat Flags

None. This plan introduces no network endpoint, no auth path, no file access pattern and no schema change. Two of the three threats its register names are mitigated here as specified: T-03-10 (the carve-out lands as an explicit amended constraint in both files) and T-03-11 (the document states that no marketplace is added or cloned to satisfy a dependency). T-03-12 is dispositioned `accept` and no gate was added for it, which is why the D2 and D3 coverage entries name reading rather than a runner.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- **The network leaf has a declared constraint to land under.** Plan 03-04's tag probe is now covered by the stated NFR-5 amendment in both files. It still needs a home outside `tests/architecture/gate-targets.ts`'s `NETWORK_FREE_TARGETS`, which the research names `install-clone-probe.ts` as the precedent for.
- **The reason tokens have a failure list to agree with.** The nine causes in this document are the vocabulary plan 03-06 must cover. Three of them map onto `dependency-range.ts`'s existing discriminants (`invalid`, `disjoint`, `too-complex`), and the remaining six come from the closure walk and the tag probe.
- **The tag form is documented as `<plugin-name>--v<version>`.** Plan 03-04's probe must look for exactly that prefix, and its no-match arm must hard-fail both of D-03-09's cases rather than falling through to a HEAD copy.
- **One claim in the document is not yet true in code.** The tag read described under "How a constrained dependency is resolved" is the contract, not shipped behavior; plan 03-04 makes it true. Nothing else in the document describes unbuilt behavior.

---

_Phase: 03-dependency-resolution_
_Completed: 2026-09-15_

## Self-Check: PASSED

`docs/dependency-resolution.md` exists on disk and both task commits (`a7912014`, `0c41e1e7`) are present in the repository. `git rev-list --count fcea8711..HEAD` measured 2 commits against the ledger base recorded in `plan_head_before`.
