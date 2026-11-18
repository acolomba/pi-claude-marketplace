---
phase: 11-skills-commands-and-records
plan: "04"
subsystem: mentions
status: complete
tags: [mentions, commands, PG-SKILL-01, D-PG11-02, D-PG11-03, D-PG11-04, D-PG11-05, D-PG11-06, D-PG11-07, D-PG11-08]
requires:
  - 11-03 (domain/file-mentions.ts)
provides:
  - MentionFileReader, NODE_MENTION_FILE_READER, appendMentionedFiles (orchestrators/mention-attachments.ts)
  - CommandInvocationDependencies.mentions (required member) and the attachment in renderCommand
affects:
  - plan 11-05, which calls appendMentionedFiles from the skill invocation
tech-stack:
  added: []
  patterns:
    - injected reader with a Node default constant (no test-only seam)
    - per-mention silent degrade with one debug line, reads in parallel through Promise.all
    - bounded read by recursion over FileHandle.read (no await in a loop)
key-files:
  created:
    - extensions/pi-claude-marketplace/orchestrators/mention-attachments.ts
    - test/orchestrators/mention-attachments.test.ts
  modified:
    - extensions/pi-claude-marketplace/orchestrators/command-invocation.ts
    - test/orchestrators/command-invocation.test.ts
    - features/slash-command/invocation.feature
    - .fallowrc.json
decisions:
  - "The bounded read uses `open` and repeated `FileHandle.read` calls until the buffer is full or the file ends, so it stays inside the planned imports (`node:fs/promises`, `node:os`, `node:path`) and needs no `no-await-in-loop` disable."
  - "A skipped mention logs under the debug tag `mentions`: `a file mention skips <resolved path>: <cause>`. A file that fails `renderMentionBlock` (NUL byte, or grown past the limit after its `stat`) logs one combined cause."
requirements-completed: []
metrics:
  duration: ~50m
  completed: 2026-11-15
actuals:
  tokens: 9700
  tasks: 2
  commits: 2
plan_head_before: b0c18f2983826f839514e312d7bee0edc8bf4fc5
plan_head_after: 25cd9d80
---

# Phase 11 Plan 04: Attach the files a typed command's body mentions Summary

A typed command now sends its rendered body and then, in Pi's `<file name="...">` block, each
regular text file of at most 262,144 bytes that the author's body mentions. The mentions come
from the body with only its variables filled (`substituteArguments` with `args: undefined`), and
the files are read behind the injected `MentionFileReader` after the `!` commands ran.

## Commits

| Task | Commit | Title |
| --- | --- | --- |
| 11-04-01 | faf1ce6d | feat(commands): attach the files a command body mentions |
| 11-04-02 | 25cd9d80 | test(commands): guard file mentions from arguments and code |

## Lines for later plans

Exports landed with the contract names. None was renamed.

| Export | Signature |
| --- | --- |
| `MentionFileReader` | `{ stat: (file: string) => Promise<{ readonly isFile: boolean; readonly size: number }>; read: (file: string, maxBytes: number) => Promise<Uint8Array>; homeDir: () => string }` (readonly members) |
| `NODE_MENTION_FILE_READER` | `MentionFileReader` over `node:fs/promises` `stat`/`open` and `node:os` `homedir` |
| `appendMentionedFiles` | `(input: { readonly authored: string; readonly rendered: string; readonly cwd: string }, reader: MentionFileReader) => Promise<string>` |
| `CommandInvocationDependencies.mentions` | `MentionFileReader`, required; `nodeDependencies()` sets `NODE_MENTION_FILE_READER` |

Path rules as implemented: `~` alone and a leading `~/` resolve against `reader.homeDir()`;
anything else is `path.resolve(cwd, path)`. A bare `@~` gives no mention at all (the 11-03 tail
cut leaves it empty), so only the quoted `@"~"` reaches the `~` branch. `~other/x` is resolved
relative to `cwd`.

The `.fallowrc.json` `entry` is back to `["extensions/pi-claude-marketplace/index.ts"]` and the
`ignoreExports` key is gone; every `domain/file-mentions.ts` export now has a consumer, so no
`export` keyword was removed.

## New scenarios (`features/slash-command/invocation.feature`)

| Line | Title |
| --- | --- |
| 336 | A command attaches the file that its body mentions (PG-SKILL-01) |
| 365 | A file that a typed argument mentions is not attached (PG-SKILL-01) |
| 390 | Scenario Outline: A mention `<mention place>` is not attached (PG-SKILL-01), rows `in fenced code` (421), `in a code span` (422), `in a context command and its output` (423) |

## Red run (Task 1, before the change)

`npx cucumber-js --profile adapter --name "(PG-SKILL-01)" features/slash-command/invocation.feature`
on the new scenario before `mention-attachments.ts` existed: `1 scenario (1 failed)`, exit 1, at
`Then the model receives these calls:`. Actual `Review @{home}/marketplaces/fixtures/plugins/demo/templates/x.md`;
expected the same, then `\n\n<file name="{home}/marketplaces/fixtures/plugins/demo/templates/x.md">\nCheck the spelling.\n</file>`.
After the change: `1 scenario (1 passed)`.

## Guard proofs (Task 2)

All five PG-SKILL-01 scenarios passed on the Task 1 code (`5 scenarios (5 passed)`).

1. Temporary edit in `orchestrators/command-invocation.ts`: the `appendMentionedFiles` call took
   `{ authored: rendered, rendered, cwd: request.cwd }` (the rendered text as the scan input).
   Result `5 scenarios (3 passed, 2 failed)`, exit 1. Failed at `Then the model receives these
   calls:` with a file block appended: "A file that a typed argument mentions is not attached"
   (line 365) and "A mention in a context command and its output is not attached" (row 423).
   Restored with `git checkout -- extensions/pi-claude-marketplace/orchestrators/command-invocation.ts`.
2. Temporary edit in `domain/file-mentions.ts`: `maskCode` returned `body` unchanged. Result
   `5 scenarios (2 passed, 3 failed)`, exit 1. Failed at `Then the model receives these calls:`
   with a file block appended: "A mention in fenced code" (row 421), "A mention in a code span"
   (row 422), and also "A mention in a context command and its output" (row 423), because that
   body's `` !`echo @...` `` text holds the mention inside a code span. Restored with
   `git checkout -- extensions/pi-claude-marketplace/domain/file-mentions.ts`.
3. Green after both restores: `5 scenarios (5 passed)`; `git diff --quiet HEAD -- extensions` exit 0.

## Verification

- `node --import "$PWD/test/platform/isolated-pi-home.ts" --test test/orchestrators/mention-attachments.test.ts test/orchestrators/command-invocation.test.ts test/domain/file-mentions.test.ts`: 144 tests, 144 pass.
- `npm run test:coverage:direct --` for `orchestrators/mention-attachments.ts`, `orchestrators/command-invocation.ts`, `domain/file-mentions.ts`: exit 0 each (100%).
- `npm run test:cucumber:profile -- --profile adapter features/slash-command/invocation.feature features/slash-command/model-runs.feature` (after Task 1): 25 scenarios (25 passed).
- `npm run test:cucumber:profile -- --profile adapter features/slash-command/invocation.feature` (after Task 2): 24 scenarios (24 passed).
- `npm run typecheck && npm run lint && npm run fallow && npm run check:features`: exit 0.
- The `.fallowrc.json` check (one `entry`, no `ignoreExports`): exit 0.
- `git diff --quiet b0c18f29 -- edge bridges index.ts domain/argument-substitution.ts`: exit 0.
- Callers outside the plan's files: `test/edge/command-tool.test.ts` and `test/edge/command-invocation.test.ts`, 24 tests, 24 pass.
- Both commits passed the hook (`npm run check:commit`). `npm run check` was not run; the wave gate runs it.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] The `~` case could not use a bare `@~`**
- **Found during:** Task 1, the owner test run
- **Issue:** the 11-03 parser cuts trailing non-word characters, so `@~` yields no mention and
  the planned `~` case asked the reader for nothing.
- **Fix:** the case uses the quoted `@"~"`, which reaches the `~` branch. No source change.
- **Files modified:** `test/orchestrators/mention-attachments.test.ts`
- **Commit:** faf1ce6d

**2. [Rule 3 - Blocking] Lint `no-confusing-void-expression` on a logging helper that returned `undefined`**
- **Found during:** Task 1, `npm run lint`
- **Fix:** the qualification check returns `{ block } | { cause }` and one place logs the cause.
- **Files modified:** `extensions/pi-claude-marketplace/orchestrators/mention-attachments.ts`
- **Commit:** faf1ce6d

## Maintainer review items

- D-PG11-02 and D-PG11-03 stay pending maintainer review; no comment or title calls them parity.
- A bare `@~` is not a mention; only `@"~"` names the home directory. `~\` on Windows is not expanded.
- The context-command guard row fails under both wrong edits, so it also guards the code-span mask.
- A file with a NUL byte and a file that grew past the limit after its `stat` log the same cause.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.
T-11-10 (the `@$ARGUMENTS` owner case, the argument scenario, and the recorded reader paths),
T-11-11 (the context-command scenario red under a rendered-text scan), T-11-12 (stat first,
regular files only, a read of at most 262,145 bytes, the directory, size, and growth cases),
T-11-13 (the untrusted-project case asks the reader for nothing), T-11-15 (the module shows no
notice; the NUL case asserts the whole log line holds no content), and T-11-16 (both wrong
edits recorded above) are mitigated as planned.

## Self-Check: PASSED

- FOUND: extensions/pi-claude-marketplace/orchestrators/mention-attachments.ts
- FOUND: test/orchestrators/mention-attachments.test.ts
- FOUND: faf1ce6d, 25cd9d80 (ancestors of HEAD)
