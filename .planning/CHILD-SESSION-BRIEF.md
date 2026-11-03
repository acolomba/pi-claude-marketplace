# Child-session brief for the parallel component phases

Written by the parent session when the user approved running Phases 3-7 in parallel child sessions on `features/component-features-phase-N` branches (2026-11-01). Each child session reads this file; `{N}` and `{NAME}` are its phase number and name, given in its opening message.

You are a child session of the parent session that is running the GSD milestone `component-features` in this repository. The user approved running the component phases in parallel, one child session per phase, each on its own `features/` branch. The parent merges your branch into the milestone branch `claude/quirky-planck-hhm592` when you finish.

YOUR PHASE: Phase {N} ({NAME}). YOUR BRANCH: `features/component-features-phase-{N}` (already created and pushed at the milestone head; check it out if you are not on it).

WHAT TO RUN: invoke the `gsd-autonomous` skill with args `--only {N}` and carry it through discuss, plan, execute, code review and fix, verification, and the phase transition for Phase {N} only. Do NOT run the milestone lifecycle (audit, complete, cleanup); the parent does that. Phase 1 (harness and version raise) is complete; Phase 2 (Skills) is finishing on the milestone branch in parallel; Phases 3-7 run in parallel in sibling sessions. Your phase depends only on Phase 1. Read `.planning/ROADMAP.md` (the milestone sections above the phase list: Parallelism, File ownership incl. "Frozen after Phase 1" and the ownership table, Milestone rules, Merge procedure) and follow it.

THE USER'S STANDING INSTRUCTIONS (verbatim, from the parent run): "make decisions as you see fit, but when in doubt research how claude code upstream operates, and try to maintain compatibility unless we need to deviate for reasons specific to the implementation of this project. have every sub-session report to the parent session any dubious choices, and collect them in a single scratchpad file so that they may be reviewed later. do not interrupt unless there's a truly unresolvable conflict". So: never ask the user questions (take the recommended option, research upstream with `.agents/skills/claude-code-compat-research`; the Claude Code 2.1.316 binary may be at `/opt/claude-code/bin/claude` for offline probes, no credentials). Only if a conflict is truly unresolvable, stop, write it to `.planning/phases/<your phase dir>/BLOCKED.md`, commit, push, and end.

DUBIOUS CHOICES: keep your phase's log in `.planning/phases/<your phase dir>/DUBIOUS-CHOICES.md`, in the same shape as the root `.planning/DUBIOUS-CHOICES.md` (read it for the format and for DC-01..DC-26, which record earlier decisions you must stay consistent with). Number your entries `P{N}-DC-01`, `P{N}-DC-02`, ... Give every subagent you spawn a dubious-choices protocol (end its report with `## Dubious Choices`; it must not edit the log) and append what they report. NEVER edit the root `.planning/DUBIOUS-CHOICES.md`; the parent merges your file into it.

GIT RULES (from AGENTS.md and the parent session):
- Commit and push ONLY to `features/component-features-phase-{N}`: `git push -u origin features/component-features-phase-{N}` (retry up to 4 times with 2/4/8/16 s backoff on network errors). Never push to main, to the milestone branch, or to any other branch. Do not open a pull request.
- Commit titles follow `.agents/skills/committing/SKILL.md` (Conventional Commits, 5-72 chars) and never carry a milestone, phase, plan, wave, or task identifier, in the title or the scope (no `docs(phase-03)`, no `03-01`). If a GSD helper would write such a title, commit with plain `git commit`. End every commit message with exactly:
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01EDUMG5ARYqF6oZYKmj6oB3
- Before each commit: `SKIP=npm-check pre-commit run --files <changed files>`, re-stage fixer output, then commit normally. Never `--no-verify`, `--amend`, rebase, or force-push. Update by merging only.
- Keep the working tree clean and pushed whenever you end a turn.

PROJECT RULES (from the milestone; see ROADMAP and AGENTS.md):
- Never edit `CHANGELOG.md`, `README.md`, `README.es.md`, `.planning/PROJECT.md` Key Decisions, or `.planning/BACKLOG.md`: list those lines in your last plan's SUMMARY under "Parent lines" and the parent applies them. Never edit the "Frozen after Phase 1" files (incl. `features/support/world.ts`, the shared step modules, `features/lib/{pi-process,pi-commands,run-tokens,published-marketplace,companions}.ts`, the scripted model, registry probe, hook recorder, MCP stub, `package.json`, `package-lock.json`, `.github/workflows/ci.yml`, `platform/pi-api.ts`, `.agents/skills/cucumber/**`), `.fallowrc.json`, or the six Phase 1 invocation cores (`domain/{argument-substitution,shell-words,context-injection,description-fallback,invocation-frontmatter}.ts`, `platform/prompt-shell.ts`); if one must change, record it as a parent line. Edit only your phase's owned files (ROADMAP ownership table); a sibling phase owns the others.
- Append-only closed sets (notification reasons, catalog counters): prefer an existing reason; a new one lands as its own commit.
- A user-visible `/claude:plugin` behavior change ships with a cucumber scenario that fails without it (record the red proof). Scenarios observe what Pi or a companion reports, never files the bridge wrote.
- GSD gates run `npm run check` on the combined tree (post-merge gate of each wave, phase gate); also run the WHOLE unit suite (`npm run test:modules`) and `npm run test:cucumber` at the phase gate, not only the changed pairs.

ENVIRONMENT FACTS measured by the parent (pass them on to every executor/agent you spawn):
- The container runs as ROOT, which ignores the `chmod` tricks the permission-injection tests use: ~167 existing unit, cucumber, and integration cases fail as root on any tree. Create a wrapper script `<your scratchpad>/nondac-sh` containing:
    #!/bin/sh
    exec setpriv --bounding-set=-dac_override,-dac_read_search --inh-caps=-dac_override,-dac_read_search /bin/sh "$@"
  (chmod +x it) and run every npm script, and every commit whose hook runs npm scripts, with `npm_config_script_shell=<that path> NODE_OPTIONS=--max-old-space-size=6144`. It skips no check.
- Cold-cache ESLint can run out of memory under parallel load; warm it with a lone `npm run lint` first.
- Inside `.claude/worktrees/...` (GSD executor worktrees) the commit hook may print "(no files to check)" for `npm run check:commit` and prettier (the pre-commit top-level `exclude: \.claude/(?!skills/)` matches worktree paths); executors must run `npm run check:static` and their tests by hand before committing, and the post-merge `npm run check` in the main checkout is the backstop.
- The session `GH_TOKEN` may be invalid for zizmor's online audit (401): run pre-commit/commits with `env -u GH_TOKEN -u GITHUB_TOKEN` if zizmor fails that way (it then runs offline).
- Parallel executors in one session share a scratchpad: give each its own subfolder for temp files (commit-message files collided before).
- A plan that deletes a file must declare it in `files_deleted` frontmatter, or the worktree merge guard blocks it.
- The cucumber peer cache is installed by `node scripts/install-test-peers.mjs` (also by `npm run test:cucumber`).
- The GSD tool `check evaluation-scope` finds a plan's commits by plan ID in commit titles, which project rules forbid, so it reports 0 commits; that is expected.

FINISH: when Phase {N} is verified and transitioned, make sure everything is committed and pushed to `features/component-features-phase-{N}`, then end with a short report: the plans, the gate results (with seeds), the verification status, your "Parent lines", and a pointer to your phase DUBIOUS-CHOICES.md. The parent reads your branch and transcript; it will merge your branch.
