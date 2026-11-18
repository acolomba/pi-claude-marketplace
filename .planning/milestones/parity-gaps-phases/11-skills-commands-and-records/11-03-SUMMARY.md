---
phase: 11-skills-commands-and-records
plan: "03"
subsystem: mentions
status: complete
tags: [mentions, skills, commands, PG-SKILL-01, D-PG11-02, D-PG11-03, D-PG11-04, D-PG11-05, D-PG11-06]
requires:
  - 11-02 (wave order only; no code dependency)
provides:
  - findFileMentions, FileMention (the pure mention parser with its code mask)
  - MENTION_FILE_BYTE_LIMIT, renderMentionBlock, appendFileBlocks (the block text)
affects:
  - plans 11-04 and 11-05, which import the module and remove the two .fallowrc.json lines
tech-stack:
  added: []
  patterns:
    - offset-keeping code mask (fences blanked whole, code-span content blanked, delimiters kept)
    - forward-only backtick-run pairing with a next-run-of-the-same-length map (linear)
    - non-ASCII characters written as escapes
key-files:
  created:
    - extensions/pi-claude-marketplace/domain/file-mentions.ts
    - test/domain/file-mentions.test.ts
  modified:
    - .fallowrc.json
decisions:
  - "A code span keeps its backtick delimiters in the mask and blanks only its content, so the text right after a span stays in the span's token. `x`@a.md` therefore gives no mention, as in Claude Code, where the `@` follows other text."
  - "A backtick run followed by another backtick on its line does not open a fence (CommonMark's info-string rule). Without this rule, an inline `x` span with three backticks at the start of a line would mask the rest of the body."
  - "The `@agent-` filter applies to the merged list of quoted and unquoted mentions, because the Claude Code caller that holds it sees both lists."
requirements-completed: []
metrics:
  duration: ~45m
  completed: 2026-11-15
actuals:
  tokens: 6300
  tasks: 2
  commits: 3
plan_head_before: 351e967b75e0f93b9f290562aef1c4192005cf5b
plan_head_after: 440e4e0d7fac0361772b220fb9c16f9fcc97fd69
---

# Phase 11 Plan 03: File mention parser and file block Summary

A pure `domain/file-mentions.ts` reads `@path` and `@"path"` mentions as Claude Code 2.1.323
does (`z_s`, `R3n`, `DNt`, `sls`), with fenced code and code spans masked first, and turns
the bytes of a mentioned file into Pi's `<file name="...">` block, with the byte limit, the NUL
test, the line range, and the 2,000-line cut.

## Commits

| Task | Commit | Title |
| --- | --- | --- |
| 1 | 37af499c | feat(mentions): find the file mentions of a skill or command body |
| 2 | 66c42b35 | feat(mentions): render a mentioned file as Pi's file block |
| fix | 440e4e0d | style(mentions): write the non-ASCII characters as escapes |

## Red runs (before the change)

- Task 1: `node --import "$PWD/test/platform/isolated-pi-home.ts" --test test/domain/file-mentions.test.ts`
  exited 1 with `Error [ERR_MODULE_NOT_FOUND]: Cannot find module '.../domain/file-mentions.ts'`.
- Task 2: the same command exited 1 with `SyntaxError: The requested module
  '../../extensions/pi-claude-marketplace/domain/file-mentions.ts' does not provide an export
  named 'appendFileBlocks'`.

## Green runs (after the change)

- Owner test: 73 tests, 73 pass, 0 fail (52 after Task 1).
- `CI=1 npm run test:coverage:direct -- extensions/pi-claude-marketplace/domain/file-mentions.ts`:
  `Direct coverage passed: ... (branches 74/74, functions 22/22, lines 325/325)`, exit 0.
- `npm run typecheck && npm run lint && npm run fallow`: exit 0 after each task and after the fix.
- `git diff --quiet "$PLAN_BASE" -- extensions/pi-claude-marketplace/{orchestrators,edge,bridges} features`: exit 0.
- Each commit passed its hook (npm-check ran `check:commit`).

## Lines for later plans

Exports landed with the contract names. None was renamed.

| Export | Signature |
| --- | --- |
| `FileMention` | `{ readonly text: string; readonly path: string; readonly lines: { readonly start: number; readonly end: number } \| undefined }` (`lines` is a required member) |
| `findFileMentions` | `(body: string) => readonly FileMention[]` |
| `MENTION_FILE_BYTE_LIMIT` | `262_144` |
| `renderMentionBlock` | `(absolutePath: string, bytes: Uint8Array, mention: FileMention) => string \| undefined` |
| `appendFileBlocks` | `(rendered: string, blocks: readonly string[]) => string` |

The temporary `.fallowrc.json` lines, as added. Plan 11-04 removes both: it restores `entry` to
`["extensions/pi-claude-marketplace/index.ts"]` and deletes the `ignoreExports` key.

```json
  "entry": [
    "extensions/pi-claude-marketplace/index.ts",
    "extensions/pi-claude-marketplace/domain/file-mentions.ts"
  ],
  "ignoreExports": [
    {
      "file": "extensions/pi-claude-marketplace/domain/file-mentions.ts",
      "exports": [
        "FileMention",
        "findFileMentions",
        "MENTION_FILE_BYTE_LIMIT",
        "renderMentionBlock",
        "appendFileBlocks"
      ]
    }
  ],
```

Truncation note as it landed (one line after `</file>`; `<path>` is the block's absolute path):

```text
Note: The file <path> was too large and has been truncated to the first 2000 lines. No need to mention the truncation. Use the read tool to read more of the file if you need.
```

Block form: `<file name="<abs>">` + newline + content + newline + `</file>`, with no trailing
newline. A whole file under the line limit keeps its content as decoded, final newline included,
the same as Pi's `file-processor.js`. A range, or a cut, joins the selected lines with `\n`.

## Mask rules as implemented (D-PG11-03)

- Fences: a pass over the lines. A line opens a fence when it starts with at most three spaces
  and then three or more backticks or tildes. A backtick run that is followed by another
  backtick on the same line does not open a fence. The fence closes on a later line whose run
  uses the same character, is at least as long, has at most three spaces before it, and has only
  whitespace after it (a CR counts as whitespace). A fence that never closes runs to the end. Each
  character of each fence line, the marker lines included, becomes a space.
- Code spans: on the fence-masked text, split at each blank line (`\n`, then optional whitespace
  without a newline, then `\n`). In each paragraph, a run of N backticks pairs with the next run
  of exactly N. A run with no such run masks nothing. The scan goes on after the closing run.
  The content between the two runs becomes spaces, and newlines stay. The backtick delimiters
  stay. This covers the inline `!` command and the fence that opens with three backticks and `!`
  (finding F2). The `!` exception of `context-injection.ts` is not copied.
- A block indented by four spaces is not masked.
- The masked text has the length and the lines of the body. It is only scanned.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Non-ASCII characters landed as literals**
- **Found during:** the acceptance check after Task 2
- **Issue:** the four marks, the byte-order marks, and the other non-ASCII test characters
  were written into both files as literal characters, which the plan forbids.
- **Fix:** each non-ASCII character is now an escape. `LC_ALL=C grep -c '[^ -~]'` gives 0 for both files.
  The tests, coverage, typecheck, lint, fallow, and the hook were run again and stayed green.
- **Files modified:** `domain/file-mentions.ts`, `test/domain/file-mentions.test.ts`
- **Commit:** 440e4e0d

**2. [Rule 2 - Correctness] Two mask details the plan text left open** (see `decisions`):
the code-span delimiters stay in the mask, and the CommonMark info-string rule applies to
backtick fences. Owner cases pin both: "reads no mention from an @ right after a code span" and
"reads a backtick run with a backtick after it as a code span, not a fence". A fence closing line
with a carriage return is also pinned.

## Maintainer review items

- D-PG11-02, D-PG11-03 (pending maintainer review) are named in the module header as
  differences from Claude Code. The header also names D-PG11-05 (Pi's block, where Claude Code
  sends Read messages), D-PG11-06 (no directory listing), and the text order of mentions
  (assumption A3) as differences. No comment or title uses the word parity.
- The `@agent-` filter covers the quoted form too (`@"agent-x"` gives no mention). The Claude
  Code caller that holds the filter was not traced.
- A range whose end is before its start, such as `#L20-10`, gives a block with no content.

## Known Stubs

None. Nothing imports the module yet; plans 11-04 and 11-05 wire it.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.
T-11-06 (owner cases for the inline `!` span, the `!` fence, both fence kinds, and spans of
one to three backticks), T-11-07 (linear passes, lint's slow-regex rule green), and T-11-09
(the 262,144 and 262,145 byte cases and the NUL cases) are mitigated as planned. T-11-08 is
pinned by the closing-tag case.

## Self-Check: PASSED

- FOUND: extensions/pi-claude-marketplace/domain/file-mentions.ts
- FOUND: test/domain/file-mentions.test.ts
- FOUND: 37af499c, 66c42b35, 440e4e0d (ancestors of HEAD)
