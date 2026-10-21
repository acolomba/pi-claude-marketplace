---
milestone: marketplace-features
audited: 2026-10-21T18:30:00Z
status: tech_debt
scores:
  requirements: 97/97
  phases: 14/14
  integration: 9/9
  flows: 5/6
gaps:
  requirements: []
  integration: []
  flows: []
tech_debt:
  - phase: 01-suite-foundation
    items:
      - "12 review info findings open in 01-REVIEW-DISPOSITION.md (IN-01..IN-12)"
  - phase: 06-marketplace-update-and-c-10-fix
    items:
      - "4 review info findings open in 06-REVIEW-DISPOSITION.md (IN-01..IN-04); WR-02 skipped (legacy path record with a stale manifestPath is not repaired)"
  - phase: 03.1-local-declaration-leak-fix
    items:
      - "WINDOWS #93: README.es.md drifted from README.md (GitLab marketplace paragraph)"
      - "WINDOWS #94: FIX-02 D-04 truth on reload after a local plugin install"
  - phase: 09-url-source-kind-and-https-git-stand-in
    items:
      - "WINDOWS #100: the add-authentication-required catalog state shape"
      - "CI portability of the loopback git host (OpenSSL 3.0.13, Node 24, git http-backend on ubuntu-latest) is proven only when the PR's behavioral job runs (D-08)"
  - phase: 10-github-source-kind-and-suite-close
    items:
      - "WINDOWS #101: plugin update's github marketplace sync under the override lacks the git credential approve line"
      - "WINDOWS #102-#109: cucumber review warnings outside phase 10 files (add, autoupdate, list, url-source-update, enable, disable)"
      - "BACKLOG SHORTREF-01: the owner/repo@ref shorthand splits at the last @ (D-76-04), Claude Code at the first"
      - "BACKLOG ROWID-01: marketplace-level failure rows carry a plugin-shaped <mp>@<mp> JSON id"
      - "403-after-credential gap: a host that answers 403 after the credential is sent still gets the no-credential-obtained remedy line (pre-existing on url)"
      - "macOS credential-helper isolation unverified (Linux only)"
      - "list.feature runs dir sources only; url and github list rows live in git-source.feature (LS-05) and file sources reach list only through add/info scenarios"
nyquist:
  compliant_phases: 14
  partial_phases: 0
  not_validated_phases: 0
  missing_phases: 0
  overall: compliant
---

# Milestone Audit: marketplace-features (Marketplace Behavioral Tests)

**Verdict: tech debt, no blockers.** Every requirement is satisfied and every
phase is verified; the debt below is recorded and carried.

## Definition of done

A cucumber suite drives every `/claude:plugin marketplace` lifecycle command
through a real headless Pi, against local stand-ins for every source kind
(dir, file, url, github), so a regression in marketplace behavior fails a
scenario named after it. Met: 433 scenarios, 4050 steps, no tag excluded,
`npm run check` green at 0110a355 (only planning docs changed since), whole
suite green on Node 24.21.0 and Node 26.11.1.

## Phases

| Phase | Verification | Nyquist | Threats open | Review open |
|-------|--------------|---------|--------------|-------------|
| 01 Suite Foundation | passed 5/5 | compliant | 0 | 12 info |
| 02 GitHub Clone-Base Override | passed 5/5 | compliant | 0 | 0 |
| 03 Marketplace Add | passed 8/8 | compliant | 0 | 0 |
| 03.1 Local Declaration Leak Fix | passed 4/4 | compliant | 0 | — |
| 03.2 Marketplace Layer Partition | passed 4/4 | compliant | 0 | — |
| 03.3 Plugin Layer Partition | passed 5/5 | compliant | 0 | — |
| 03.4 Scope and Layer Terminology | passed 4/4 | compliant | 0 | — |
| 04 Marketplace Remove and List | passed 17/17 | compliant | 0 | 0 |
| 05 Marketplace Info | passed 11/11 | compliant | 0 | 0 |
| 06 Marketplace Update and C-10 Fix | passed 5/5 | compliant | 0 | 4 info |
| 07 Marketplace Autoupdate | passed 4/4 | compliant | 0 | 0 |
| 08 Marketplace Help and Usage Errors | passed 12/12 | compliant | 0 | 0 |
| 09 URL Source Kind and HTTPS Git Stand-In | passed 6/6 | compliant | 0 | 0 |
| 10 GitHub Source Kind and Suite Close | passed 5/5 | compliant | 0 | 0 |

Phases 1-7 and 9 were re-verified at HEAD on 2026-10-21 after later phases
made their reports stale; all passed with no gaps.

## Requirements (3-source cross-reference)

97 REQ-IDs in the REQUIREMENTS.md traceability table, all `[x]` and Complete.
Every ID is claimed by a phase PLAN and verified as SATISFIED in that phase's
VERIFICATION.md. No orphans, no unsatisfied or partial requirements.

## Integration (gsd-integration-checker)

9/9 connections wired: the override seam reaches Pi only from the run (an
operator value never leaks, pinned by `hermetic-git-environment.test.ts`); the
`<source kind>` parameter feeds every verb's Outline through shared fixtures;
layer partition (3.1-3.3) is exercised by the later verb scenarios; no tag is
excluded; the step usage report is clean.

Flows 5/6: dir, file, url, and github each run add, info, update, autoupdate,
and remove; help and usage errors form the fifth flow. Partial: `list` has no
file-kind row (url and github list rows are in `git-source.feature`, LS-05).
Recorded as tech debt, not a gap: LS-01..04 name dir and url sources.

## Tech debt

See frontmatter. Ledgers: WINDOWS 12 open (#93, #94, #100-#109), BACKLOG
ROWID-01 and SHORTREF-01, 16 open review info items in phases 01 and 06.

## Process notes

- Commit `ca1ec217` (phase 10 review disposition) was made by the GSD
  disposition script through `gsd-tools commit`, which passes `--no-verify`;
  history is not rewritten. Every other commit ran the hooks.
