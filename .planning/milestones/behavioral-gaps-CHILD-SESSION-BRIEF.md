# Child-session brief for the parallel behavioral-gaps phases

Written at the end of the behavioral-gaps Phase 1 (2026-11-08). The parent session gives this file to one child session per stream phase, Phases 2 to 16. `{N}` and `{NAME}` are the child's phase number and name, which the child's opening message gives. The briefs of earlier milestones (`component-features-CHILD-SESSION-BRIEF.md` and `mcp-builtin-CHILD-SESSION-BRIEF.md`) do not apply: this milestone pushes nothing and runs as a normal user, not as root.

## 1. Who you are

You are a child session of the parent session that runs the GSD milestone `behavioral-gaps` (Behavioral Coverage Gaps) in this repository. The milestone runs one child session per stream phase, Phases 2 to 16, and each child works in its own git worktree on its own branch.

YOUR PHASE: Phase {N} ({NAME}). YOUR BRANCH: `features/behavioral-gaps-phase-{N}`. The parent created it as a local branch at the verified Phase 1 head (D-BG-16). When you finish, the parent merges your branch into the milestone branch `features/behavioral-gaps` with a merge commit. Never check out or commit to a sibling's branch.

## 2. Workspace

1. Create your worktree from a checkout of this repository, such as the milestone checkout `/home/acolomba/src/pi-claude-marketplace-behavioral-gaps`, with one plain command:

   ```text
   git worktree add /home/acolomba/src/pi-claude-marketplace-behavioral-gaps-phase-{N} features/behavioral-gaps-phase-{N}
   ```

   The branch exists already, so the command takes no `-b`.

2. In the new worktree, run `scripts/init.sh`. It installs the git LFS and pre-commit hooks, runs `npm install`, adds the writing skills, installs the latest GSD tooling (gitignored, so a new worktree has none of it), and sets up CodeGraph and fallow. It needs the network.

3. Before you start, confirm that `node_modules/.init-done`, `node_modules/@earendil-works/pi-coding-agent/package.json`, and `.claude/gsd-core/bin/gsd-tools.cjs` exist, and that `git status --short` prints nothing. If `scripts/init.sh` changed a tracked file, such as `AGENTS.md` or `package-lock.json`, restore that one file with `git checkout -- <file>` and name it in your final report. Never symlink the `node_modules` of another checkout.

4. Merge the local milestone branch into your branch once, before you run anything, so your branch holds the parent's Phase 1 close-out commits (code review fixes, verification, and phase completion): `git merge features/behavioral-gaps`. Merge it again whenever you need a later change of the parent, such as a parent line that the parent applied to a frozen file.

## 3. What to run

Invoke the `gsd-autonomous` skill with the args `--only {N}`. Carry it through discuss, plan, execute, code review and fix, verification, and the phase transition, for Phase {N} only. Never run the milestone lifecycle (audit, complete, cleanup); the parent runs it after the last merge.

Read `.planning/ROADMAP.md` first, in particular the behavioral-gaps sections above the phase list: Parallelism, File ownership (with "Frozen after Phase 1", the ownership table, "What exists today", and "Unowned feature files"), Milestone rules, and Merge procedure. Then read your own phase's details. Follow them. Phase 1 (Foundation) is complete, and your phase depends on it alone.

## 4. The user's standing instructions

- Make every decision yourself, with the recommended option. Never ask the user a question.
- When in doubt, research how Claude Code behaves with `.agents/skills/claude-code-compat-research`. A Claude Code binary is on this machine at `/home/linuxbrew/.linuxbrew/bin/claude` (version 2.1.319), for offline reading and probes.
- Keep upstream parity unless a recorded decision ID or a Pi capability gap licenses a divergence.
- Log every dubious choice (section 5).
- Only a truly unresolvable conflict stops the phase: write it to `.planning/phases/<your phase dir>/BLOCKED.md`, commit it on your branch, and end with a report. The Bug policy of the Milestone rules says when a conflict counts: upstream behavior contradicts a recorded project principle, and no precedent settles it.

## 5. Dubious choices (D-BG-15)

- Keep your phase's log in `.planning/phases/<your phase dir>/DUBIOUS-CHOICES.md`, in the shape of the root log `.planning/DUBIOUS-CHOICES.md`. Read the root log and `.planning/phases/01-foundation/DUBIOUS-CHOICES.md` for the format and for the Phase 1 choices you must stay consistent with.
- Number your entries `P{N}-DC-01`, `P{N}-DC-02`, and so on.
- Give every subagent you spawn the protocol: it ends its report with `## Dubious Choices`, and it never edits a log. You append what it reports.
- Never edit the root log. The parent merges your log into it at your merge.
- Repeat every entry in your final report under `## Dubious Choices`.

## 6. Decision IDs (D-BG-15)

Phase 1 recorded D-BG-01 to D-BG-16. The children run in parallel, so one shared sequence would collide. Each phase therefore numbers its decisions in its own block: Phase N uses D-BG-N01 to D-BG-N99. Phase 2 starts at D-BG-201, Phase 10 at D-BG-1001, and Phase 16 at D-BG-1601. The Key Decisions table of `.planning/PROJECT.md` is parent-owned: list each decision row you need as a parent line (section 8).

## 7. Git rules

- Commit only to `features/behavioral-gaps-phase-{N}`. Push nothing unless the user asks (D-BG-16). Never commit to `main`, to the milestone branch `features/behavioral-gaps`, or to another phase's branch. Open no pull request.
- Commit titles follow `.agents/skills/committing/SKILL.md` (Conventional Commits, 5 to 72 characters) and carry no milestone, phase, plan, wave, or task identifier, in the title or in the scope. If a GSD helper would write such a title, commit with plain `git commit`.
- End every commit message with the attribution lines of your own session.
- Before each commit, run `SKIP=npm-check pre-commit run --files <changed files>`, restage what the fixers changed, and commit normally, so the commit hook still runs.
- Never use `--no-verify`, `--amend`, a rebase, or a force push. Update your branch only by merging the local `features/behavioral-gaps`, and never merge a sibling's phase branch.

## 8. Project rules

Each rule points at the section of `.planning/ROADMAP.md` (behavioral-gaps) that holds it in full.

- **Frozen files** (File ownership, "Frozen after Phase 1"): never edit one. They include the build and CI files, `test/e2e/_rpc.ts`, `features/support/**`, `features/lib/**`, the Phase 1 harness tests under `test/architecture/`, every step module that exists now, `.agents/skills/cucumber/**`, and `platform/pi-api.ts`. A change you need in one is a parent line and a dubious choice.
- **Ownership** (File ownership, the ownership table, and "Unowned feature files"): edit only your phase's feature files, its one verb step module, and the product files of its row, with their unit pairs. A new test file takes a name that carries your topic. The "Behavioral gaps" section of `.agents/skills/cucumber/rules/layout.md` copies the table, reserves each stream's feature file and verb module name, and lists, under "Seeds", your seed scenarios and the steps only they use. You may rewrite a seed, but keep each of those steps in use, because `npm run check:features` fails on an unused step and you cannot remove one from a frozen module.
- **Product gaps that Phase 1 found** (your phase's Success Criteria): Phase 2 (ASYNC-04, the reap of a dead Pi's project-scope hook processes), Phase 8 (CFGMIG-01, a rebuilt config drops a disabled plugin's `enabled: false`), and Phase 12 (BROWSE-01, the picker's `0 plugin(s)` counts installed plugins, not offered ones) each have a criterion that names the gap and its seed.
- **Shared product files** (Milestone rules, "Shared product files"): hook dispatch (Phases 2-6), the load path (Phases 7, 8, 9, 16), command arguments (Phases 12, 13, 14), the add and install paths (Phases 11, 12, 14), and the state lock (only Phase 15 edits `transaction/with-state-guard.ts`). Change only your own case, function, arm, or row, and never reshape or reorder a shared one.
- **Append-only closed sets** (Milestone rules): prefer an existing reason or counter entry. A new one lands as its own commit, at the end of its set.
- **Behavioral tests** (Milestone rules, "Behavioral tests", and AGENTS.md): every scenario fails without the behavior it names, and your plan SUMMARY records the red proof. The whole `npm run test:cucumber` is green under both the `adapter` and the `builtin` profile (D-BG-04). Only a scenario with an MCP surface carries `@mcp` (it runs under both profiles), or an `@adapter-only` and `@builtin-only` pair when its expectation differs by implementation. Any other scenario carries no implementation tag and runs once, under `adapter`. Read the `cucumber` skill before you write a scenario.
- **Upstream parity and the bug policy** (Milestone rules): Claude Code's behavior is the expected behavior, and a scenario that exposes a product bug fixes it in your own files. A fix in a frozen file or a sibling's file is a parent line and a dubious choice, never a direct edit.
- **Never edited by a stream** (Milestone rules): `CHANGELOG.md`, `README.md`, `README.es.md`, the Key Decisions table of `.planning/PROJECT.md`, `.planning/BACKLOG.md`, the root dubious-choices log, and the frozen files. List your lines for them under "Parent lines" in your last plan's SUMMARY.md. In ROADMAP.md, STATE.md, REQUIREMENTS.md, and WINDOWS.md, which GSD tools write, change only your own phase's entries.
- **GSD records** (AGENTS.md): prefix every `gsd-tools windows append --description` with `[behavioral-gaps]`, and every plan SUMMARY.md has a `## Threat Flags` section, even when it says "None".
- **Gates** (Milestone rules, "Gates", and `.agents/skills/local-verification/SKILL.md`): every wave gate and the phase gate run `npm run check` on the combined tree, which runs both cucumber profiles. The phase gate also runs the whole `npm run test:modules`. A passing commit hook does not satisfy a gate.
- **Out of scope** (Milestone rules): hook events that Pi cannot support, LSP servers, `userConfig`, channels, and features beyond the bugs a scenario exposes.
- **Hermetic home**: a test or command that could touch `~/.pi/agent` runs with a hermetic HOME. Never write to the real `~/.pi`, and say so in every subagent's brief.

## 9. Environment facts measured by the parent

Pass these on to every executor and agent you spawn.

- This machine runs as user id 1000 (`id -u`), not as root. The permission tests run as written, so no `setpriv` wrapper is needed, and the root wrapper of the earlier briefs does not apply.
- Pi is 1.5.0 (`node_modules/@earendil-works/pi-coding-agent/package.json`).
- The cucumber companions come from the optional peer cache, which `node scripts/install-test-peers.mjs` installs into `node_modules/.cache/optional-peers`. `npm run test:cucumber` and `npm run test:cucumber:profile` run it first.
- One Bash call is capped at 10 minutes. Run `npm run check` as one background call that writes its exit code to a file, or as its parts in order: `check:static`, `test:unpaired`, `test:integration`, the three CI behavioral legs (below), and `test:coverage:direct:all`. Never pipe a gate command into `tail`, `head`, or `grep`, because the pipe hides its exit status. Rerun a failing cucumber or integration case once before you call a gate red, and record both runs.
- A terminal (TUI) Pi compiles the extension into `/tmp/jiti`, because its environment has no `TMPDIR`, and the shared cucumber Pi warms that cache (`features/support/pi-process.ts`). A profile Pi compiles into `{home}/tmp/jiti`, which links to the worker's own cache (`features/support/world.ts`). This machine's `TMPDIR` is unset, and `/tmp` is a tmpfs.
- The Phase 1 stand-ins, drivers, and fixture writers are documented in `.agents/skills/cucumber/rules/world-and-stand-ins.md`, and each stream's seeds in the "Behavioral gaps" section of `.agents/skills/cucumber/rules/layout.md`.
- During the Phase 1 gate, at 05:39:05Z, while the builtin leg ran, some process wrote the completion cache file `~/.pi/agent/pi-claude-marketplace/cache/plugins/valid-marketplace.json` in the real home (`mcpImplementation` `builtin`, the plugin `hello` of the unit-test fixture `test/orchestrators/marketplace/_fixtures/valid-marketplace`). No feature file names that marketplace, and the source was not found. If you see that file change during your own runs, record which command ran then.
- The Phase 1 plan SUMMARYs recorded no flaky scenario, and every part of the Phase 1 gate passed on its first run.
- The three CI behavioral legs, timed locally at the Phase 1 head (28 cores, Node 26.13.0): adapter lifecycle (`npm run test:cucumber:profile -- --profile adapter features/marketplace features/plugin`) 1 min 50 s for 1186 scenarios; adapter components (`... --profile adapter features/skill features/slash-command features/agent features/hook features/mcp-server features/workflow`) 3 min 08 s for 454 scenarios; builtin all (`... --profile builtin features`) 56 s for 148 scenarios. CI run 42421611502 on `main` took 4 min 07 s, 5 min 14 s, and 3 min 03 s. Each leg's CI timeout is 15 minutes (D-CF1-16), so a leg's run may grow to 10 minutes. The rest of `npm run check` took about 2 min 05 s here (`check:static` 13 s, `test:unpaired` 16 s, `test:integration` 27 s, `test:coverage:direct:all` 69 s), and `npm run test:modules` 55 s.
- Never run `gsd-tools query config-set`. An earlier milestone saw it rewrite `.planning/config.json` with its arrays expanded, which then failed `npm run format:check`. Today neither `format:check` nor the prettier hook reads `.planning/config.json` (checked in `package.json` and `.pre-commit-config.yaml`), but the rewrite still leaves an unrelated diff. If it happens, restore the file with `git checkout -- .planning/config.json`.

## 10. Finish

When Phase {N} is verified and transitioned, make sure that everything is committed on `features/behavioral-gaps-phase-{N}` and that nothing is pushed. End with a short final report:

- the plans and their commits;
- the gate results for each cucumber profile, with your seeds and your new scenarios;
- the verification status;
- your parent lines (frozen files, CHANGELOG, README, PROJECT.md Key Decisions, BACKLOG), and any unowned feature file whose rows you changed;
- a pointer to your phase's DUBIOUS-CHOICES.md, with every entry repeated under `## Dubious Choices`.

The parent reads your branch and your report, and merges your branch.
