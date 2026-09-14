---
quick_id: 260907-qar
description: mark backlog entries WFLW-01 and DFEN-01 closed
date: 2026-09-07
branch: features/backlog-close-shipped
---

# Quick Task 260907-qar: close two shipped backlog entries

## Problem

`.planning/BACKLOG.md` still lists WFLW-01 and DFEN-01 as open. Both shipped
weeks ago. A backlog triage sweep on 2026-09-07 read them as open work and
sized them for future milestones, which is the cost of the staleness.

The file was edited after both landed -- `9abdf9e4` ("docs: file upstream
review findings to backlog", #160, 2026-09-01) -- without closing either.

## Evidence

Verified by source read, not by changelog prose:

| Entry | Shipped by | Date | Proof in tree |
|---|---|---|---|
| WFLW-01 | `872b2d34` (#154) | 2026-08-29 | `domain/resolver.ts:388`, `:403`; `shared/notify.ts:237`; `shared/probe-classifiers.ts:216`; `domain/components/plugin.ts:45` |
| DFEN-01 | `8992d850` (#130) | 2026-08-19 | `domain/resolver.ts:201`, `:692`, `:751`; `orchestrators/plugin/install.ts:1503`; plus 7 more files |

Both fixes went past what their entries proposed. WFLW-01 also got a
conventional-path probe and a dedicated reason token. DFEN-01 also got the
full precedence rule and a shared read-surface prediction.

## Tasks

1. Mark WFLW-01 closed in `.planning/BACKLOG.md`.
   - files: `.planning/BACKLOG.md`
   - action: strikethrough heading + `-- CLOSED` suffix; closure paragraph
     naming the commit, the date, and the four parts that landed; note what
     stays out of scope; `Original report follows.` then the retained original.
   - verify: `grep -c 'WFLW-01' .planning/BACKLOG.md` still finds the entry;
     heading matches the file's `~~...~~ -- CLOSED` convention.
   - done: entry reads closed, original text intact.

2. Mark DFEN-01 closed in `.planning/BACKLOG.md`.
   - files: `.planning/BACKLOG.md`
   - action: same convention; name the ten files, the precedence rule, and the
     non-optional resolved field.
   - verify: same.
   - done: entry reads closed, original text intact.

3. Commit.
   - verify: `pre-commit run --files .planning/BACKLOG.md` clean; only
     `.planning/BACKLOG.md` staged.
   - done: one atomic commit on `features/backlog-close-shipped`.

## Constraints

- Only `.planning/BACKLOG.md` changes. No source changes.
- Do not renumber or reorder entries. Do not touch any other entry.
- Three unrelated files are modified in the working tree
  (`.claude/settings.json`, `.mdformat.toml`, `.pre-commit-config.yaml`).
  They stay unstaged.
- Never commit to `main`.
