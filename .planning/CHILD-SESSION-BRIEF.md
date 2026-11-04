# Child-session brief for the parallel mcp-builtin phases

Written with the mcp-builtin roadmap (2026-11-04). The parent session gives this file to one child session per parallel phase (Phases 2, 3, 4, and 5) after Phase 1 is verified and pushed. `{N}` and `{NAME}` are the child's phase number and name, given in its opening message. The component-features version of this brief is in git history.

You are a child session of the parent session that runs the GSD milestone `mcp-builtin` (MCP Built-in) in this repository. The user asked for maximum session parallelism: one child session per parallel phase, each in its own git worktree on its own `features/` branch. The parent merges your branch into the milestone branch `features/mcp-builtin` when you finish.

YOUR PHASE: Phase {N} ({NAME}). YOUR BRANCH: `features/mcp-builtin-phase-{N}`. The parent created and pushed it at the milestone head after Phase 1. Work in your own git worktree (or your own session checkout) on that branch, and check it out if you are not on it. Never check out or commit to a sibling's branch.

WHAT TO RUN: invoke the `gsd-autonomous` skill with args `--only {N}` and carry it through discuss, plan, execute, code review and fix, verification, and the phase transition for Phase {N} only. Do NOT run the milestone lifecycle (audit, complete, cleanup), and do not run Phase 6; the parent does both. Phase 1 (Foundation and Pi 1.5.0) is complete. Phases 2-5 run in parallel in sibling sessions, and each depends only on Phase 1. Read `.planning/ROADMAP.md`, in particular the milestone sections above the phase list: Parallelism, File ownership (with "Frozen after Phase 1" and the ownership table), Frozen cross-phase interfaces, Milestone rules, and Merge procedure. Follow them.

PUSH AUTHORIZATION: you are authorized to push your own branch to GitHub: `git push -u origin features/mcp-builtin-phase-{N}`. On a network error, retry up to 4 times with 2/4/8/16 s backoff. Never push `main`, the milestone branch `features/mcp-builtin`, or any other phase's branch. Do not open a pull request.

SIBLING WORK: when you need work that a sibling phase has merged, merge the milestone branch into yours: `git fetch origin features/mcp-builtin`, then `git merge origin/features/mcp-builtin`. Never rebase, and never merge a sibling's phase branch directly. Phase 3 merges the milestone branch after Phases 5, 4, and 2 have merged and before its own gate.

THE USER'S STANDING INSTRUCTIONS for every child session: make decisions as needed. When in doubt, research how Claude Code upstream behaves with `.agents/skills/claude-code-compat-research` (the reference is Claude Code 2.1.318; a binary may be at `/opt/claude-code/bin/claude` for offline probes, with no credentials). Keep compatibility with upstream unless reasons specific to this project's implementation force a deviation. Log every dubious choice. Do not interrupt the user unless a conflict is truly unresolvable. So never ask the user a question: take the recommended option, record it, and go on. Only if a conflict is truly unresolvable: stop, write it to `.planning/phases/<your phase dir>/BLOCKED.md`, commit, push your branch, and end.

DUBIOUS CHOICES: keep your phase's log in `.planning/phases/<your phase dir>/DUBIOUS-CHOICES.md`, in the same shape as the root `.planning/DUBIOUS-CHOICES.md` (read it for the format and for DC-01..DC-45, the earlier decisions you must stay consistent with). Number your entries `P{N}-DC-01`, `P{N}-DC-02`, and so on. Give every subagent you spawn a dubious-choices protocol: it ends its report with `## Dubious Choices` and never edits the log; you append what it reports. NEVER edit the root `.planning/DUBIOUS-CHOICES.md`; the parent merges your file into it in Phase 6.

GIT RULES (from AGENTS.md and the parent session):
- Commit only on `features/mcp-builtin-phase-{N}`, and push it as above.
- Commit titles follow `.agents/skills/committing/SKILL.md` (Conventional Commits, 5-72 chars) and never carry a milestone, phase, plan, wave, or task identifier, in the title or the scope (no `docs(phase-02)`, no `02-01`, no `mcp-builtin`). If a GSD helper would write such a title, commit with plain `git commit`.
- End every commit message with exactly these two lines:
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01EDUMG7S9uXh4o5dikBwum8
- Before each commit: `SKIP=npm-check${SKIP:+,$SKIP} pre-commit run --files <changed files>`, re-stage what the fixers changed, then commit normally, so the commit hook still runs.
- Never `--no-verify`, `--amend`, rebase, or force-push. Update by merging only.
- Keep the working tree clean and pushed whenever you end a turn.

PROJECT RULES (from the milestone; see ROADMAP and AGENTS.md):
- Never edit `CHANGELOG.md`, `README.md`, `README.es.md`, `.planning/PROJECT.md` Key Decisions, `.planning/BACKLOG.md`, or a "Frozen after Phase 1" file. The frozen files include `package.json`, `package-lock.json`, `.github/workflows/ci.yml`, `cucumber.json`, `scripts/check-features.mjs`, `scripts/install-test-peers.mjs`, `.fallowrc.json`, `rule-packs/architecture.json`, `eslint.config.js`, `test/e2e/_rpc.ts`, `features/support/**`, the shared `features/lib/*` and step modules, `.agents/skills/cucumber/**`, `platform/pi-api.ts`, `domain/mcp-implementation.ts`, `domain/mcp-server-features.ts`, `domain/mcp-builtin-features.ts`, the MCP functions in `domain/name.ts`, `persistence/state-io.ts`, `orchestrators/mcp/{session-materialize,recorded-servers}.ts`, `index.ts`, and `edge/{register,types}.ts`. If one of them must change, list the change under "Parent lines" in your last plan's SUMMARY.md, together with your CHANGELOG, README, PROJECT.md, and BACKLOG lines. The parent applies them at merge or in Phase 6.
- Edit only the files your phase owns in the ownership table; a sibling phase owns the others. In a file shared by function (`install-outcome.ts`, `update-swap.ts`, `shared/concerns/soft-dep.ts`, `shared/notify-reasons.ts`), edit only your own function or arm, and in a shared test file only your own cases. Code against the frozen cross-phase interfaces and never change one.
- Closed sets are append-only (notification reasons, status tokens, catalog counters): prefer an existing entry, and land a new one as its own commit. Removing or rewording an entry is a parent line.
- State rows: unless you are Phase 3, your scenarios pin connection, naming, grants, or hook runs, never a plugin state, a marker, or a per-server verdict that depends on the active MCP implementation. Those rows are Phase 3's.
- Built-in servers (Phases 4 and 5): a built-in-profile scenario that needs a plugin MCP tool uses the Phase 1 stand-in server, so it does not wait for Phase 2. If a scenario truly needs the extension's own registration, finish it after Phase 2 merges by merging the milestone branch, and say so in your final report.
- A user-visible `/claude:plugin` behavior change ships with a cucumber scenario that fails without it, under each profile where it applies; record the red proof per profile. A scenario whose expectation differs by implementation is an `@adapter-only` and `@builtin-only` pair in the same file. Scenarios observe what Pi or a companion reports, never the files the bridge wrote. Remove the `@adapter-only` tags Phase 1 placed on your own files.
- GSD gates run `npm run check` on the combined tree plus both cucumber profiles (the post-merge gate of each wave and the phase gate); the phase gate also runs the WHOLE unit suite (`npm run test:modules`), not only the changed pairs.
- Every plan SUMMARY.md has a `## Threat Flags` section, even when it says "None". Prefix every `gsd-tools windows append --description` with `[mcp-builtin]`.

ENVIRONMENT FACTS measured by the parent (pass them on to every executor and agent you spawn):
- Pi is now 1.5.0: dev `^1.5.0`, peer `>=1.5.0`, and `@earendil-works/pi-ai` exactly `1.5.0`. The cucumber profile Pi runs 1.5.0 with built-in MCP loaded unless a scenario turns it off. Phase 1 documents how to run each cucumber profile in `.agents/skills/cucumber/`.
- The container runs as ROOT, which ignores the `chmod` tricks the permission-injection tests use: about 167 existing unit, cucumber, and integration cases fail as root on any tree. Create a wrapper script `<your scratchpad>/nondac-sh` containing:
    #!/bin/sh
    exec setpriv --bounding-set=-dac_override,-dac_read_search --inh-caps=-dac_override,-dac_read_search /bin/sh "$@"
  (chmod +x it) and run every npm script, and every commit whose hook runs npm scripts, with `npm_config_script_shell=<that path> NODE_OPTIONS=--max-old-space-size=6144`. It skips no check.
- Cold-cache ESLint can run out of memory under parallel load; warm it with a lone `npm run lint` first.
- Inside `.claude/worktrees/...` (GSD executor worktrees) the commit hook may print "(no files to check)" for `npm run check:commit` and prettier, because the pre-commit top-level `exclude: \.claude/(?!skills/)` matches worktree paths. Executors must run `npm run check:static` and their tests by hand before committing; the post-merge `npm run check` in the main checkout is the backstop.
- The session `GH_TOKEN` may be invalid for zizmor's online audit (401). If zizmor fails that way, run pre-commit and commits with `env -u GH_TOKEN -u GITHUB_TOKEN` (zizmor then runs offline).
- Parallel executors in one session share a scratchpad: give each its own subfolder for temp files (commit-message files collided before).
- A plan that deletes a file must declare it in `files_deleted` frontmatter, or the worktree merge guard blocks it.
- The cucumber peer cache is installed by `node scripts/install-test-peers.mjs` (also by `npm run test:cucumber`).
- The GSD tool `check evaluation-scope` finds a plan's commits by plan ID in commit titles, which project rules forbid, so it reports 0 commits; that is expected.

FINISH: when Phase {N} is verified and transitioned, make sure everything is committed and pushed to `features/mcp-builtin-phase-{N}`. Then end with a short report: the plans, the gate results with seeds for each cucumber profile, the verification status, your "Parent lines", whether any scenario waits on a sibling's merge, and a pointer to your phase DUBIOUS-CHOICES.md. The parent reads your branch and transcript and merges your branch.
