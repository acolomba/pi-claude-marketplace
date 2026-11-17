---
phase: 06-hook-inputs-and-events
plan: "01"
subsystem: hooks
tags: [spike, session-start, resume, fork, pi-launch]
status: partial
requires: []
provides:
  - "Spike S7 record with the measured resume and fork rule for SessionStart"
affects:
  - "06-03 (resume and fork detection, saved-session fixture)"
  - "06-06 (ctx.model and getSessionName at session_start)"
tech-stack:
  added: []
  patterns: []
key-files:
  created:
    - .planning/phases/06-hook-inputs-and-events/06-S7-SPIKE.md
  modified: []
decisions:
  - "S7: every launch reports reason startup on Pi 1.5.0 and 1.5.2; a saved session holds message entries at session_start, a new one holds none"
  - "S7: fork = startup + header.parentSession + header.timestamp >= performance.timeOrigin, checked before resume; a continued fork fails the time test and is resume"
  - "S7: a hand-written session file (header + user and assistant message entries) opens with --session and is found by --continue by newest mtime"
metrics:
  duration: "about 12 min"
  completed: 2026-11-14
actuals:
  tokens: 8200
  tasks: 1
  commits: 0
plan_head_before: a1f5461408e1e96445efecb5975bce6b3bed5b1b
plan_head_after: a1f5461408e1e96445efecb5975bce6b3bed5b1b
---

# Phase 6 Plan 01: Spike S7 Summary

Spike S7 ran on Pi 1.5.0 and Pi 1.5.2 in a temporary home. On both versions, `--continue`, `--session <file>`, and `--fork <file>` all report `session_start` reason `startup` with the saved `message` entries already loaded. A new session holds no `message` entry. A fork made in the launch is the only case where the header has `parentSession` and its `timestamp` is not earlier than `performance.timeOrigin`. F7 and F8 hold as predicted.

## Status: partial, by the dispatch's concurrency rule

The dispatch allowed this executor to write only two new untracked files: `06-S7-SPIKE.md` and this summary. It ran no commit and no `pre-commit`, and it edited no tracked file. So:

- **Task 06-01-01 is done**, but its commit is not made. The orchestrator commits `06-S7-SPIKE.md` (type `docs`, scope `hooks`).
- **Task 06-01-02 is partly done.** The Pi 1.5.2 section and `## Result` are in the record. The PRD edit is **not made**, because `docs/prd/parity-gaps-prd.md` is a tracked file. The orchestrator applies it (text below) and commits it with the record, or in a second commit.
- `commits: 0` is the measured count (HEAD did not move: `a1f54614`). The work sits uncommitted on purpose, as the dispatch ordered. It is not a lost commit.

### The PRD edit to apply

In `docs/prd/parity-gaps-prd.md`, section 9, row `S7` (line 956 at `a1f54614`), fill only the Result cell with:

> **Run 2026-11-14 on Pi 1.5.0 and Pi 1.5.2, print mode, with a stand-in model, in a temporary home.** Yes: `--continue` and `--session <file>` report reason `startup` with the saved `message` entries already loaded, and a new session holds only `model_change` and `thinking_level_change`; a `--fork` header has `parentSession` and a timestamp after the process start, and a continued fork keeps `parentSession` with an older timestamp. Record: `.planning/phases/06-hook-inputs-and-events/06-S7-SPIKE.md`.

## Versions and safety

- Pi 1.5.0: the repository copy (`node_modules/@earendil-works/pi-coding-agent/dist/cli.js`). Pi 1.5.2: the Homebrew copy (`.../Cellar/pi-coding-agent/1.5.2/libexec/lib/node_modules/@earendil-works/pi-coding-agent/dist/bundle/cli.js`). Node v26.13.1.
- Each version ran in its own `mktemp -d` folder under the session scratch directory `/tmp/claude-1000/-home-acolomba-src-pi-claude-marketplace-gaps/46275468-1855-49b4-a234-f937cd40117e/scratchpad/`. `HOME`, `PI_CODING_AGENT_DIR`, and `TMPDIR` pointed into that folder, and the runner checked `HOME` and `PI_CODING_AGENT_DIR` before every launch. All three folders (one failed first attempt and the two real runs) were removed.
- No command read, listed, stat-ed, or wrote the real `~/.pi/agent` or the real home configuration. Every launch used `PI_OFFLINE=1` and `--offline`, set no provider key, and made no network request.
- One file landed outside the temporary folders: the failed first attempt ran before the runner set `TMPDIR`, so jiti wrote `/tmp/jiti/p0601-tmp150-bzfOsv-probe.00503f20.mjs`. It was removed.

## Result (short form)

The same on 1.5.0 and 1.5.2:

| Fact | Measured |
| --- | --- |
| Reason of `--continue`, `--session`, `--fork`, and a new session | `startup` on all of them; `previousSessionFile` absent |
| `message` entries at `session_start` | continued or opened: 2 to 9; new: 0 |
| New-session entry types | `model_change`, `thinking_level_change`; `session_info` first under `--name` |
| Fork (launch 4) | `parentSession` set; header `timestamp` 1792 ms (1.5.0) and 442 ms (1.5.2) after `timeOrigin` |
| Continued fork (launch 5) | `parentSession` still set; header `timestamp` 324 ms and 277 ms before `timeOrigin` |
| New session header `timestamp` | also after `timeOrigin`, so `parentSession` is required for fork |
| `--continue` in an empty folder | a new session, exit 0 |
| Saved file | `<agent>/sessions/--<cwd, leading / dropped, / to ->--/<ISO timestamp with : and . to ->_<id>.jsonl` |
| Hand-written file | opened with `--session`; found by `--continue` by newest mtime, not by name or header time |
| `ctx.model?.id` | `faux-1`, with the model flags and with no flag in RPC mode |
| `getSessionName()` on a continued named session | `spike-named` |

Pi writes the system prompt as a `message` entry with role `system` together with the first prompt, so the `message` count includes it. It is never the only `message` entry of a session with a saved turn.

## Predictions of 06-RESEARCH.md

- **F7: held.** A new session is not empty at `session_start` (two or three entries), and only `message` entries separate a saved session from a new one.
- **F8: held.** `parentSession` stays on a continued fork. The time test separates the new fork (launch 4) from the old one (launch 5) on both versions.
- **A1: held.** Run-time behavior matches the source reading: reason `startup`, entries loaded, header readable.
- **A2: held.** The header `timestamp` against `performance.timeOrigin` separates the forks. This needs `parentSession` as well, because a new session's header is also after the process start.
- **A8: held.** Pi accepts a hand-written file with a header and one user and one assistant `message` entry.
- No launch contradicted a prediction.

## Deviations from Plan

**1. [Rule 3 - Blocking] Stand-in model instead of the repository's scripted model**

- **Found during:** task 06-01-01, launch 1.
- **Issue:** Pi 1.5.0 loaded with `--extension features/lib/scripted-model/extension.ts` failed with `Cannot find module '.../pi-ai-extension-view.js/providers/faux'`. Pi's loader aliases `@earendil-works/pi-ai` to its extension view and has no alias for the `providers/faux` subpath. The same error came back with `env -i` and a private `TMPDIR`.
- **Fix:** a stand-in model in the temporary folder that imports the faux provider from the pi-ai root, which re-exports it. It loads in both versions and answers `stub reply`. The error text is in the record. The spike did not find out how the cucumber harness avoids the error; that is outside S7.

**2. [Scope] Extra launches.** Launches 8 to 10 ran on 1.5.2 too (the plan asked for 1 to 7 there). Launch 11 (RPC mode, no model flag) ran on both versions, to read `ctx.model` without a command-line model, because the harness selects the model over RPC.

**3. [Dispatch rule] No commits, no PRD edit, and no `pre-commit run`.** See "Status" above. The `.planning/` path is excluded from mdformat and markdownlint in `.pre-commit-config.yaml`. The executor checked the record by hand instead: no trailing whitespace, a final newline, and no smart quotes or dashes.

**4. [Verify note]** The plan's check `test -z "$(git status --porcelain -- extensions test features)"` does not pass in this checkout. The changed files under `extensions/`, `test/`, and `features/` belong to plan 06-02's executor, which works in the same checkout. This spike wrote no file there. Its probe, stand-in model, runner, and session files lived in the scratch directory and in the removed temporary folders.

## Flagged assumptions (from the plan)

- A1, A2, A8: checked by this spike, and all held (see above).
- `--resume` was not run, because it opens a picker. `--session <file>` stands for it (D-PG6-16).
- Pi 1.5.2 may not load the scripted model: this did not matter, because the scripted model did not load on 1.5.0 either. Both versions used the same stand-in.
- The tracer is task 06-02-01, not part of this plan.
- Linux only.

## Records for the orchestrator

- ROADMAP.md, Phase 6 "Spike first": the spike ran; the record is `.planning/phases/06-hook-inputs-and-events/06-S7-SPIKE.md`.
- STATE.md: spike S7 ran on 2026-11-14 on Pi 1.5.0 and Pi 1.5.2.
- The result confirms F7 and F8, so the detection rules of D-PG6-14 and D-PG6-15 stand as research refined them. Plan 06-03 keeps them: fork first, then `resume` on a `message` entry.
- The PRD S7 Result cell: apply the text above.
- Possible follow-up outside S7: the repository's scripted model fails to load when Pi is started from the command line on this machine (Node 26). The cause may be the `providers/faux` subpath alias.

## Known Stubs

None. The spike changed no product file.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## Self-Check: PASSED

- FOUND: `.planning/phases/06-hook-inputs-and-events/06-S7-SPIKE.md`, with `## Environment`, `## Commands`, `## Output: Pi 1.5.0`, `## Output: Pi 1.5.2`, `## Result`, and 24 `### Launch` subsections.
- Commits: none expected (dispatch rule). HEAD is unchanged at `a1f54614`.
- The record names no path under the real home directory. Temporary paths read `<tmp>`.
