---
phase: 18-update-and-reinstall-unification
plan: 03
subsystem: features/plugin (behavioral scenarios)
tags: [reinstall, update, cucumber, git-source, nfr-5]
requires:
  - phase: 18-update-and-reinstall-unification
    provides: "reinstall on the shared runner with REINSTALL_MATERIALIZATION { refreshSource: false, skipSameRevision: false, overwrite: true } (18-02)"
provides:
  - "Five REI-04 scenarios in reinstall.feature: reinstall at the newer offered version on the row, record, list, info, and a new session, plus the update/reinstall equivalence (D-18-13)"
  - "One git-source scenario in git-source-update.feature: reinstall after fetch installs the fetched revision with no git-host request (D-18-14, D-18-04)"
affects: [18-04..18-07 (these scenarios now gate the deletion and test re-adds through npm run check)]
actuals:
  tokens: 4000
  tasks: 2
  commits: 2
plan_head_before: 471d5ab9937b34e3342ba7b3f4a6639490a760ac
plan_head_after: self # the task 2 commit, which also adds this file; a file cannot name its own hash
tech-stack:
  added: []
  patterns: []
key-files:
  created: []
  modified:
    - features/plugin/reinstall.feature
    - features/plugin/git-source-update.feature
key-decisions:
  - "The no-request assertion uses the existing `the git host receives no request` step, whose window opens at each When step (BeforeStep in features/support/https-git-host.ts), so the Given fetch's requests are outside it; no fallback to the record-only form was needed"
requirements-completed: [REI-04, UPR-01]
duration: 15min
completed: 2026-10-23
status: complete
---

# Phase 18 Plan 03: Reinstall and update scenarios Summary

**Six cucumber scenarios pin REI-04 and the D-18-04 git policy end to end: after
a marketplace update, `reinstall` reports, records, lists, shows, and serves
demo 1.1.0, `update` records the same version, and a git-source reinstall after
`fetch` installs revision 2 from the mirror with no git-host request.**

## What changed

- **Task 1 (`features/plugin/reinstall.feature`).** Five scenarios, each
  starting from the Background's demo 1.0.0 install plus two Givens: the
  marketplace "fixtures" offers demo 1.1.0, and the user has run
  `marketplace update fixtures --scope project`.
  1. "Reinstalling a plugin the marketplace now offers at a newer version
     installs and records that version": row `reinstalled` at 1.1.0, record
     demo@fixtures 1.1.0 enabled.
  2. "The plugin list shows a plugin reinstalled at a newer version at that
     version": `installed` at 1.1.0, full tally fields.
  3. "Info on a plugin reinstalled at a newer version shows that version": the
     full plugin-info field set, plugin version 1.1.0.
  4. "A new session offers the skills of the version a reinstall installed":
     `/skill:demo-skill` with description `A skill of demo 1.1.0.`.
  5. "Updating after the same marketplace update records the version a
     reinstall records": `updated` 1.0.0 -> 1.1.0, record at 1.1.0.
  The Feature description's first sentence now reads "Reinstalling a plugin
  builds it again in place at the version its marketplace offers now."
- **Task 2 (`features/plugin/git-source-update.feature`).** "Reinstalling a
  git-source plugin after a fetch installs the fetched revision with no
  request": a dir-source marketplace "gits" offers unpinned github `ghp`; after
  install at 1.0.0, the repository moves to 2.0.0 and `fetch` (a Given) brings
  it into the mirror. The reinstall reports `reinstalled` at 2.0.0, the git host
  receives no request during the When step, the installed plugin runs revision
  2, and the project scope holds exactly the plugin mirror (no revision) and
  the `{ghp revision 2}` copy. The description gained one sentence: "A
  reinstall installs the revision the cached repository already holds, without
  a request."

No step definition changed; every step already existed.

## Verification

- `npx cucumber-js features/plugin/reinstall.feature`: 18/18 scenarios pass
  (13 existing, unedited, plus 5 new).
- `npx cucumber-js features/plugin/git-source-update.feature`: 4/4 pass
  (3 existing, unedited, plus 1 new).
- `npm run check:features` exit 0.
- Acceptance counts: `grep -c "^  Scenario:"` is 18 and 4;
  `git diff --numstat 9f126315` prints `88 1` for reinstall.feature (only the
  description line removed) and `30 0` for git-source-update.feature.
- The no-request step reads only the When step's requests: the `BeforeStep`
  hook in `features/support/https-git-host.ts` opens a new request window on
  every Action step, and `the git host receives no request` compares
  `requestsOfLastCommand()` to `{ requests: [], connections: 0 }`.
- Discrimination: scenario 1 fails on the old reinstall (it recorded 1.0.0);
  the git scenario fails if reinstall refreshes the mirror (requests appear) or
  re-pins to the recorded sha (version 1.0.0, revision 1).
- Plan gate: `npm run check` exit 0 on the final tree (Node v26), with exactly
  the files the task 2 commit stages: static checks, unpaired tests,
  integration, 718/718 cucumber scenarios, direct coverage for all pairs (280
  records merged). The task 1 commit hook ran `check:commit` and passed.

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## Self-Check: PASSED

- FOUND: features/plugin/reinstall.feature (contains "Reinstalling a plugin the marketplace now offers at a newer version installs and records that version")
- FOUND: features/plugin/git-source-update.feature (contains "Reinstalling a git-source plugin after a fetch installs the fetched revision with no request")
- FOUND: c2d30715 (task 1); task 2 is the commit that adds this file
