---
quick_id: 260917-bh3
slug: condense-the-181-unreleased-changelog-en
date: 2026-09-17
status: complete
commit: 399dea49
---

# Quick Task 260917-bh3 Summary

Condensed the ten `[Unreleased]` CHANGELOG.md bullets that #181 added into five that follow
`.claude/rules/changelog.md`.

## What changed

`CHANGELOG.md` only: 10 deletions, 5 insertions, nothing else in the file touched. Word counts
per bullet: 27, 39, 32, 26, 33 -- all at or under the 40-word target.

- Kept as their own bullet, trimmed: agents in more than one directory; `PreCompact`/`PostCompact`
  `trigger`; notification plugin count and bulk-zero report.
- Folded into one bullet: the four fail-clean fixes (ambiguous marketplace alias, malformed
  `mcpServers` entry, cleanup after a failed update, discovery failure in one scope).
- Folded into one bullet: the two hardening fixes (path escape via normalization or symlink,
  hook `if` inherited keys).
- Dropped: "classified by type rather than by matching words" -- an internal refactor (PDEF-05)
  with no user-visible symptom.

## Verification

`pre-commit run --files CHANGELOG.md` passed (mdformat, markdownlint). Committed as 399dea49 with
the explicit path only; the unrelated uncommitted files in the working tree were left alone.
