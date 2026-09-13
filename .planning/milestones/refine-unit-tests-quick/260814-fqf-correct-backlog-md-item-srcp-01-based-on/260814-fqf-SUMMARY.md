---
phase: quick-260814-fqf
plan: 01
subsystem: planning-docs
tags: [backlog, gitlab-parity, source-parsing, correction]
status: complete

requires: []
provides:
  - "BACKLOG.md SRCP-01 withdrawal record with live-CLI counter-evidence"
affects:
  - .planning/BACKLOG.md

tech-stack:
  added: []
  patterns:
    - "COV-01 in-place correction shape: keep the item in the body, open the correction with a bolded lead-in, carry the dated measurement"

key-files:
  created:
    - .planning/quick/260814-fqf-correct-backlog-md-item-srcp-01-based-on/260814-fqf-SUMMARY.md
  modified:
    - .planning/BACKLOG.md

decisions:
  - "SRCP-01 is withdrawn, not deferred: upstream's shipped claude CLI v2.1.232 rejects the scheme-less host-prefixed source form, so our `{kind: \"unknown\"}` classification is agreement with upstream rather than a gap behind it."
  - "The correction stays in the body of the entry rather than moving to the pruned-items HTML comment, because the comment is reserved for shipped items and moving it would delete the evidence that stops the item being re-filed."
  - "The `Direction for later` paragraph was restated rather than snipped, because its SRCP-02 sentence borrowed its antecedent from the SRCP-01 sentence being removed."

metrics:
  duration: ~10m
  completed: 2026-08-14

actuals:
  tokens: 12200
  tasks: 1
  commits: 1
---

# Quick Task 260814-fqf: Correct BACKLOG.md item SRCP-01 Summary

SRCP-01 is recorded as withdrawn inside its existing `SRCP-01/02` entry, with the four live `claude` CLI v2.1.232 probes attached, so the same upstream changelog line cannot re-file it from prose a second time.

## What Was Built

One amended entry in `.planning/BACKLOG.md`. Five edits, all inside the `SRCP-01/02` entry plus one adjacent blank line:

1. **Blank line before the heading.** The `## SRCP-01/02:` heading butted directly against the closing paragraph of the ENVLIT-01 entry above; every other heading in the file has one. Added.
2. **Heading tail amended** to `## SRCP-01/02: git-subdir url expansion (SRCP-01 withdrawn)`. The literal `SRCP-01/02` token survives at the start, because the frozen spike 008 README cross-references it and cannot be edited.
3. **SRCP-01 bullet marked** `SRCP-01 (WITHDRAWN 2026-08-14 -- see the correction below):`. The bullet body is unchanged; only a line break was introduced so the marker sits on its own line.
4. **Correction paragraph inserted** between the two-bullet list and the direction paragraph, so a reader meets the withdrawal before any recommendation. It carries the probed CLI version, the date, all four probe results, the verbatim upstream rejection string, the corrected reading of the changelog line, the parity-regression conclusion, the pointer to the auth-hint half, and the note that spike 008's full-scheme finding stands confirmed.
5. **`Direction for later` rewritten** to cover SRCP-02 alone, stating positively that no scheme-less host-prefixed branch should be added and why, and singular in its closing scope sentence.

## Restatement of SRCP-02's direction (called out per the plan)

The `Direction for later` paragraph was **restated, not left byte-identical**. This is the one edit that reached beyond SRCP-01, and it was unavoidable: the paragraph was a single coupled unit. Its SRCP-02 sentence read "Reuse the SAME owner/repo shorthand expansion for `gitSubdirObjectSource`'s `url` field" -- whose antecedent was the SRCP-01 sentence being removed -- and its closing sentence read "BOTH are `domain/source.ts`-only changes". Deleting the SRCP-01 half alone would have orphaned SRCP-02's direction and left a dangling plural.

The rewrite restates SRCP-02's direction self-containedly (expand a host-less `owner/repo` value in the `git-subdir` object source's `url` field to its full GitHub clone URL, the same already-assumed-GitHub rule D-76-04 applies to string sources) and makes the scope sentence singular.

**The SRCP-02 bullet itself is byte-identical**, including the official-docs URL it cites (`plugin-marketplaces.md#git-subdirectories`). Its disposition does not change; SRCP-02 remains actionable.

## Deviations from Plan

### 1. [Rule 3 - Blocking] Two of the plan's own instructions contradicted each other; both intents satisfied

- **Found during:** Task 1, drafting the correction paragraph.
- **Issue:** The plan's suggested wording for the correction includes the phrase `that half is [GAUTH-01]'s territory`. Its own gate asserts `git diff -U0 -- .planning/BACKLOG.md | grep '^[+-]' | grep -c 'GAUTH'` equals `0`. Writing the literal token `GAUTH-01` on an added line would have failed the gate; omitting the pointer entirely would have failed the `<done>` criterion that requires it.
- **Fix:** The pointer is written without the literal token: "that half belongs to the git-host auth-failure hint item immediately below (spike 009) and is unaffected here." The GAUTH-01 entry is the very next heading in the file, so the reference resolves unambiguously. Both the gate's intent (GAUTH-01 untouched) and the criterion's intent (a pointer to the auth-hint half) are met.
- **Files modified:** `.planning/BACKLOG.md`
- **Commit:** `7bbefc4a`

### 2. [Rule 3 - Blocking] Line wrapping split a gated literal string

- **Found during:** Task 1, first gate run.
- **Issue:** The initial wrap broke the upstream rejection message across two lines (`not a` / `valid GitHub owner/repo shorthand...`), so the line-oriented gate `grep -q 'not a valid GitHub owner/repo shorthand'` returned no match.
- **Fix:** Rewrapped so the gated phrase stays on one line. Re-ran the gate: matches once.
- **Files modified:** `.planning/BACKLOG.md`
- **Commit:** `7bbefc4a`

## Verification

All gates from the plan's `<automated>` block, run in the worktree before committing:

| Gate | Result |
|------|--------|
| Only `.planning/` changed; `.planning/BACKLOG.md` among them | PASS -- `git diff --name-only` = `.planning/BACKLOG.md` alone |
| `.planning/spikes/` untouched | PASS -- `git diff --quiet` clean |
| `v2.1.232` present | PASS (1) |
| `not a valid GitHub owner/repo shorthand` present | PASS (1) |
| `WITHDRAWN` present | PASS (1) |
| `slashCount` absent | PASS (0) |
| `^## SRCP-01/02:` exactly once | PASS (1) |
| `plugin-marketplaces.md#git-subdirectories` exactly once | PASS (1) |
| That citation not on a removed diff line | PASS (0) |
| No `GAUTH` on any diff line | PASS (0) |
| No em dash glyph on any added line | PASS (0 of 40 added lines) |

The em-dash and GAUTH diff checks were run through Node reading the diff as UTF-8, rather than through BSD `grep`, which treats the glyph-bearing file as binary and would have skipped it silently.

`pre-commit run --files .planning/BACKLOG.md`: every applicable hook passed. TruffleHog failed with the documented structural worktree error (`failed to read index file: open <worktree>/.git/index: not a directory`) -- git-mode scan cannot run inside a linked worktree. Per the project's CLAUDE.md, a filesystem scan was run instead over the committed path:

```
verified_secrets: 0, unverified_secrets: 0
```

Exit 0, so the commit used the sanctioned `SKIP=trufflehog` prefix and no other skip.

No `npm run check` was run: zero source or test files are touched, and `.planning/` is excluded from both the `mdformat` and `markdownlint-cli2` hooks.

## Human Check Outstanding

The plan's `<human-check>` asks for a top-to-bottom read of the amended entry: the reader must hit the withdrawal before any recommendation, must not be able to reconstruct the withdrawn recommendation from what remains, and the direction paragraph must read as a complete thought about SRCP-02 alone. The structure was written to that shape and the mechanical gates confirm the removals, but the prose judgement is the operator's.

## Commits

- `7bbefc4a` -- docs(quick-260814-fqf): withdraw SRCP-01, upstream rejects it too

## Self-Check: PASSED

- `.planning/BACKLOG.md` -- FOUND, modified, committed
- `.planning/quick/260814-fqf-correct-backlog-md-item-srcp-01-based-on/260814-fqf-SUMMARY.md` -- FOUND
- Commit `7bbefc4a` -- FOUND in `git log`
- No file deletions in the commit (`git diff --diff-filter=D HEAD~1 HEAD` empty)
- No untracked files left behind except the quick-task docs directory, which the orchestrator commits
