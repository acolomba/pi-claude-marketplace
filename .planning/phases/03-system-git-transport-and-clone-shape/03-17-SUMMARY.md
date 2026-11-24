---
phase: 03-system-git-transport-and-clone-shape
plan: "17"
subsystem: docs
tags: [codebase-map, project-record, system-git, nfr-5]

requires:
  - phase: 03-system-git-transport-and-clone-shape
    provides: "03-01 to 03-16: the system git transport, the clone swap, the removal of isomorphic-git, and the classifier clean-up"
provides:
  - "A codebase map (STACK, INTEGRATIONS, STRUCTURE, ARCHITECTURE, CONVENTIONS, TESTING) that describes system git as the one transport"
  - "The Phase 3 outcomes of D-SG-01 and D-SG-09 to D-SG-16 in PROJECT.md"
  - "An NFR-5 sentence in PROJECT.md that names the release-tag commit fetch"
affects: [ssh-sources, credential-surface, failure-message-parity, submodules-and-pins, close]

actuals:
  tokens: 7900
  tasks: 3
  commits: 3
plan_head_before: cd22ea7d636959c22f790993e0b9e80405988fb1
plan_head_after: 4ea3d89bde7d32eeb52f537a17a58dc0c81c6500

tech-stack:
  added: []
  patterns: []

key-files:
  created: []
  modified:
    - .planning/codebase/STACK.md
    - .planning/codebase/INTEGRATIONS.md
    - .planning/codebase/STRUCTURE.md
    - .planning/codebase/ARCHITECTURE.md
    - .planning/codebase/CONVENTIONS.md
    - .planning/codebase/TESTING.md
    - .planning/PROJECT.md

key-decisions:
  - "The NFR-5 text in PROJECT.md changed: 03-08 added a network fetch (the chosen release tag's commit, `git fetch --depth 1`) that the D-SG-09 sentence did not describe. AGENTS.md is left for the orchestrator (see Orchestrator actions)."
  - "No new closed-set token was found in any SUMMARY of this phase, so no D-SG row was appended after D-SG-16."
  - "The fallow-ignore count in CONVENTIONS.md stays at 54 with the same breakdown, measured on this tree."

patterns-established: []

requirements-completed: ["SG-TRN-01", "SG-TRN-02", "SG-TRN-03", "SG-TRN-04", "SG-TRN-05", "SG-TRN-06", "SG-TRN-07", "SG-MIG-01"]

coverage:
  - id: D1
    description: "The stack, integration, and structure pages name system git as the one transport and list the new modules, the clone swap, its backup directories, and the three variables"
    verification:
      - kind: other
        ref: "node scratchpad/v1.cjs (the Task 1 verify command of 03-17-PLAN.md)"
        status: pass
    human_judgment: false
  - id: D2
    description: "The architecture page counts and lists the 19 NETWORK_SEAMS files of eslint.config.js and names clone-swap.ts beside shared.ts in the BLOCK C sentence; the conventions and testing pages match the rule pack and the GitOps fake"
    verification:
      - kind: other
        ref: "node scratchpad/v2.cjs (the Task 2 verify command of 03-17-PLAN.md)"
        status: pass
    human_judgment: false
  - id: D3
    description: "PROJECT.md records the Phase 3 outcome of D-SG-01 and D-SG-09 to D-SG-16; no outcome reads Pending (Phase 3"
    verification:
      - kind: other
        ref: "test \"$(grep -c 'Pending (Phase 3' .planning/PROJECT.md)\" = 0 && grep -q '| **D-SG-09' && grep -q '| **D-SG-16'"
        status: pass
    human_judgment: true
    rationale: "The outcome wording is a record for the maintainer; whether each outcome reads right is a judgment call, and the D-SG-09 directory-marketplace note, the D-SG-13 precision rule, and the SG-TRN-07 edge-probe assumption are flagged for review"

duration: 9min
completed: 2026-11-24
status: complete
---

# Phase 3 Plan 17: Codebase Map and Decision Outcomes Summary

**The six codebase pages that agents load now describe system git as the one transport (no `isomorphic-git`, the 19 network seams, `clone-swap.ts`, the timeout and one-shot credential modules, the backup directories, and the three variables), and PROJECT.md records what Phase 3 built for D-SG-01 and D-SG-09 to D-SG-16.**

## Performance

- **Duration:** 9 min
- **Started:** 2026-11-24T14:29:17Z
- **Completed:** 2026-11-24T14:38:01Z
- **Tasks:** 3
- **Files modified:** 7

## Accomplishments

- STACK, INTEGRATIONS, and STRUCTURE describe the system git transport, the D-SG-10 update model, and the variables `CLAUDE_CODE_PLUGIN_GIT_TIMEOUT_MS`, `CLAUDE_CODE_PLUGIN_KEEP_MARKETPLACE_ON_FAILURE`, and `PI_CLAUDE_MARKETPLACE_GITHUB_BASE_URL` as an `insteadOf` key.
- ARCHITECTURE counts and lists the 19 `NETWORK_SEAMS` files, names `clone-swap.ts` as marketplace code a plugin ledger may reach, and states the `isomorphic-git` ban with no exemption. CONVENTIONS and TESTING match the rule pack and the `GitOps` fake.
- PROJECT.md has no `Pending (Phase 3` outcome. The five planning decisions are recorded in the outcomes they shaped. The NFR-5 sentence names the tag copy's commit fetch.

## Task Commits

1. **Task 1: The stack, integration, and structure pages describe system git as the one transport** - `051741d` (docs)
2. **Task 2: The architecture and conventions pages match the network gate and the rule pack** - `0655a66` (docs)
3. **Task 3: Record the outcome of each D-SG decision of this phase** - `4ea3d89` (docs)

Tracer gate (Task 1): interactive run, `end-of-phase` mode, automated-only verify. The verify command was re-run, exited 0, and expansion continued.

## Sentences changed, per page

**STACK.md**
- The `isomorphic-git` Key Dependencies entry is replaced by a system git entry: every `GitOps` operation runs the user's `git` through `platform/git-process.ts`, with no fallback (D-SG-01, SG-TRN-01); clones are `--depth 1 --no-recurse-submodules` (C5); `isomorphic-git` is no longer a dependency, and the rule pack bans it in every extension file.
- The `rulePacks` sentence under fallow gains "The `isomorphic-git` ban has no sanctioned file (D-SG-01)".
- The Environment list gains three entries: `CLAUDE_CODE_PLUGIN_GIT_TIMEOUT_MS` (D-SG-13), `CLAUDE_CODE_PLUGIN_KEEP_MARKETPLACE_ON_FAILURE` (D-SG-15), and `PI_CLAUDE_MARKETPLACE_GITHUB_BASE_URL` as an `insteadOf` key (D-SG-16).

**INTEGRATIONS.md**
- The git client line is rewritten for system git: `runRemote`, the network lane, the timeout, the abort signal, the `insteadOf` pair, the D-SG-14 sign-in and one-shot retry, and GAUTH-04.
- A new "Update model (D-SG-10)" line describes the freshness `ls-remote`, the re-clone into `sources-staging/`, the swap through `sources-backup/` or `plugin-clones-backup/`, the `node_modules` carry-over, and the keep variable.
- The Network policy line now counts 19 seam modules (it said 17) and names `refreshCloneBySwap` instead of the deleted `refreshGitHubClone`.
- The File Storage line names `sources/<marketplace>/` for marketplace checkouts beside `plugin-clones/<key>/`, plus the staging and backup directories.
- "clone/fetch/pull" in Outgoing reads "clone, fetch, and `ls-remote`".

**STRUCTURE.md**
- Platform "Contains": `git.ts` is "the `GitOps` verbs on system git"; `git-auth-callbacks.ts` is gone; `git-one-shot-credential.ts` and `git-timeout.ts` are added; `git-credential.ts` is described as holding the auth bundle types.
- Orchestrators "Contains": `marketplace/*.ts` lists `clone-swap.ts`.
- The rule-pack line notes that the `isomorphic-git` ban has no exemption.
- The BLOCK F sentence under "Where to Add New Code" names `refreshCloneBySwap`.

**ARCHITECTURE.md**
- Key Characteristics, BLOCK F bullet: names `refreshCloneBySwap`, and says the PUP-2 sync refreshes through `clone-swap.ts` (it said `syncClone` needs `gitOps`).
- Platform layer Purpose: "the user's system git" and "git process specifics" replace the `isomorphic-git` wording.
- Platform layer Contains: `git.ts` lists the six `GitOps` verbs and the tag listings on system git through `runRemote`; `git-timeout.ts` and `git-one-shot-credential.ts` are added; `git-credential.ts` holds the `GitAuthBundle` types.
- Circular imports, BLOCK C: "only through `orchestrators/marketplace/shared.ts` and `orchestrators/marketplace/clone-swap.ts`".
- Network boundary: "the 19 files in `NETWORK_SEAMS`" (it said 18), with `clone-swap` in the marketplace list, and `refreshCloneBySwap` in the banned names.
- Rule-pack chokepoints: "`isomorphic-git` everywhere, with no exemption (D-SG-01, SG-TRN-01)".

**CONVENTIONS.md**
- The `rulePacks` sentence: `isomorphic-git-chokepoint` (D-SG-01 / SG-TRN-01, no exemption). The `fallow-ignore` count (54) and its breakdown did not change, so they stay.

**TESTING.md**
- The fake-imports bullet no longer says `git-ops-fake.ts` has no production value import: it imports `GitCommandError`.
- The failure-injection bullet drops `fetchError`, which the fake no longer has, and names `absentCommits` and `recordedCalls`.

**PROJECT.md**
- Outcome cells updated: D-SG-01, D-SG-09, D-SG-10, D-SG-11, D-SG-12, D-SG-13, D-SG-14, D-SG-15, D-SG-16. No new row.
- NFR-5: "When a tag is chosen, its copy fetches that one commit from the same remote with `git fetch --depth 1` (D-SG-09)." is added after the tag-read sentence, and the last sentence reads "Apart from that marketplace tag read and tag fetch (D-SG-09)".

## Decisions Made

- The NFR-5 text changed in PROJECT.md, because 03-08 made the tag copy fetch the chosen commit from the marketplace remote, and the old text said a path-source plugin reaches the network only through the tag read and the package install. The rest of NFR-5 matches the tree.
- Planning decisions in the outcomes: (1) in D-SG-01; (2) in D-SG-10; (3) in D-SG-15; (4) in D-SG-10, as the maintainer's upstream-parity choice; (5) in D-SG-14, as the note for the credential phase.
- No D-SG row was appended. No SUMMARY of this phase reports a new closed-set token: the kept outcomes reuse `network unreachable` and `permission denied`, `CapitalLetterCommitRefError` reads `unsupported source`, and `PluginMirrorInUseError` reads `permission denied`.

## Deviations from Plan

None - plan executed exactly as written. The INTEGRATIONS.md seam count (17) and its deleted wrapper name, and the two TESTING.md sentences, were not named in the plan, but the tree contradicted them, which the plan's execution rules cover.

## Issues Encountered

None.

## Orchestrator actions

AGENTS.md restates NFR-5, and this plan does not edit it. To match PROJECT.md, change two sentences in the AGENTS.md "Network policy" constraint:

1. Replace `If that read fails, the install uses the marketplace's current copy (D-SG-09).` with:
   `If that read fails, the install uses the marketplace's current copy. When a tag is chosen, its copy fetches that one commit from the same remote with `git fetch --depth 1` (D-SG-09).`
2. Replace `Apart from that marketplace tag read (D-SG-09)` with `Apart from that marketplace tag read and tag fetch (D-SG-09)`.

No `windows append` was asked for by this plan.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## Flagged for the verifier

- SG-TRN-07's edge probe is unclassified. The D-SG-16 outcome records the assumption that the `insteadOf` rows of `test/shared/github-base-url.test.ts` and `test/platform/git.test.ts`, and the scenarios that reach the GitHub stand-in through the base override, cover it.
- The D-SG-02 outcome still says its production callers "arrive with the transport swap (Phase 3)". That has now happened. The plan names only D-SG-01 and D-SG-09 to D-SG-16, so the row is unchanged.

## Carried notes for later phases

- `docs/output-catalog.md`'s D-76-08 entry still explains the auth reason with the old transport's error. Its byte count is locked, so the failure-message phase (Phase 6) rewrites it.
- The CHANGELOG entry for D-SG-12's CRLF hash-version change waits for the close phase (Phase 8).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Phase 3's plans are all summarized. The phase gate (`npm run check`) is the orchestrator's.

## Verification

- Task 1 verify: exit 0. Acceptance: `git-auth-callbacks` in STRUCTURE.md 0, `CLAUDE_CODE_PLUGIN_GIT_TIMEOUT_MS` in STACK.md 1, `isomorphic-git` in INTEGRATIONS.md 0.
- Task 2 verify: exit 0 (19 seams; the old import-site phrase 0; `clone-swap` 3).
- Task 3 verify: exit 0. Acceptance: `Pending (Phase 3` 0, `The transport swap (Phase 3)` 0, `capital letters` 1, `probe-skip` 2. Each D-SG row still has three cells.
- `npm run check:features`: exit 0. Each commit passed the pre-commit hooks; the markdown hooks skip `.planning/`, and `npm-check` did not run for these docs.

## Self-Check: PASSED

- All seven modified files exist.
- Commits `051741d`, `0655a66`, and `4ea3d89` are ancestors of HEAD.
