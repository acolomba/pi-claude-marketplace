# component-features: Dubious Choices Log

Review queue for the choices made without the user during the
component-features milestone (`/gsd-autonomous`, started 2026-10-31). The user
asked that every sub-session report its dubious choices to the parent session,
that the parent collect them in one file for later review, and that nobody
interrupt the user unless a conflict is truly unresolvable. When in doubt, the
run follows Claude Code upstream and diverges only for a reason specific to
this project.

## How this file works

- Only the parent session writes this file. Each subagent and sub-session ends
  its report with a `## Dubious Choices` section (or says "None"), and the
  parent copies every item here, so parallel work never conflicts on it.
- One entry per choice: what was chosen, the alternatives, why it is dubious,
  the upstream evidence, and where the choice is recorded (decision ID, file).
- **Severity.** High: changes what a user sees or diverges from upstream.
  Medium: a judgment call that a reviewer may reverse at low cost. Low:
  process, naming, or tooling.
- **Status.** `open` until the user reviews it; the user marks it `accepted`,
  `reversed`, or `follow-up`.

## Entries

### DC-01: Pre-fan-out decisions settled without the user

- **Phase / source:** milestone-wide; parent session.
- **Severity:** Medium. **Status:** open.
- **Choice:** The decisions that ROADMAP.md and DEC-01 say Phase 1's discuss
  step settles "with the user" (FG-01..FG-06, FG-10, FG-14, FG-29, FG-33, the
  six function directory names) are settled by the parent session from
  upstream research, per the user's instruction for this run.
- **Alternatives:** Stop and ask the user, as the roadmap text says.
- **Why dubious:** The roadmap made these decisions a user gate because six
  parallel phases depend on them. Each decision has its own entry below so
  that the user can reverse any one of them.
- **Recorded in:** `.planning/phases/01-harness-and-version-raise/01-CONTEXT.md`.

### DC-02: Phase discovery read from STATE.md, not `init.manager`

- **Phase / source:** milestone-wide; parent session.
- **Severity:** Low. **Status:** open.
- **Choice:** `gsd-tools query init.manager` reported all seven phases as
  executed with stale verification, because `.planning/phases/` does not exist
  yet and the tool matched the phase numbers against archived milestone phase
  directories (`01-manifest-read-fidelity`, `04-install-provenance`, ...). The
  run ignored its "re-run `/gsd-execute-phase N`" actions and treated STATE.md
  (Phase 1 of 7, not started) and `init.phase-op` (no context, no plans) as the
  truth.
- **Alternatives:** Follow the manager's actions, which would have run
  execute-phase against archived plans of an earlier milestone.
- **Why dubious:** It overrides a tool verdict. It is a GSD tooling defect
  worth reporting upstream: phase numbers repeat across milestones here.
- **Recorded in:** this file only.

### DC-03: Upstream argument substitution, done at invocation time

- **Phase / source:** Phase 1 discuss (D-CF1-01; FG-01..FG-04).
- **Severity:** High. **Status:** open.
- **Choice:** Bridged commands and skills get Claude Code's exact argument
  rules: `$0` is the first argument (0-based), a missing index stays literal,
  `ARGUMENTS: <args>` is appended when no placeholder is used, named
  `$name` arguments and the `\$` escape work, Pi-only forms (`${1:-x}`, `$@`)
  stay literal. One port of upstream `T2e` runs in Pi's `input` event; Phase 2
  wires skills, Phase 3 wires commands.
- **Alternatives:** (a) Record a Pi-gap divergence and keep Pi's 1-based rules.
  (b) Rewrite placeholders at install time into Pi syntax (cannot do
  `${CLAUDE_SESSION_ID}`, the conditional append, or injection).
- **Why dubious:** It is product work inside a test milestone, and it changes
  what a command receives: a plugin written for the old docs, where `$1` was
  the first argument, now gets the second one, exactly as in Claude Code
  2.1.316. Commands now bypass Pi's own template expansion.
- **Upstream evidence:** 2.1.316 binary, `T2e` and `G=(i)=>(L??=c$o(n))[i]`
  (0-based), grepped 2026-10-31. High confidence.
- **Recorded in:** `01-CONTEXT.md` D-CF1-01.

### DC-04: Run `` !`cmd` `` injection, with no permission gate

- **Phase / source:** Phase 1 discuss (D-CF1-02; FG-05).
- **Severity:** High (security). **Status:** open.
- **Choice:** In user-invoked bridged commands and skills, run each
  `` !`cmd` `` and ```` ```! ```` block before the content reaches the model, as
  upstream does. Pi has no permission modes, so the bridge acts like Claude
  Code's `bypassPermissions` mode: every command runs, and `allowed-tools`
  does not gate it. A failing command aborts the invocation.
- **Alternatives:** (a) Record a Pi gap and send the literal text (safest, but
  breaks common plugins such as commit helpers that use `` !`git status` ``).
  (b) Gate commands with the frontmatter `allowed-tools` patterns, which means
  porting Claude's Bash permission matching.
- **Why dubious:** Upstream refuses a command its permission check does not
  allow; this runs it. The risk is bounded: the command comes from a plugin
  the user installed, whose hooks can already run any command without being
  invoked, and Pi's model can already run any shell command.
- **Upstream evidence:** 2.1.316 binary, `HRe`, `MRr`, `Ahe`, grepped
  2026-10-31. High confidence.
- **Recorded in:** `01-CONTEXT.md` D-CF1-02.

### DC-05: Skill description fallback changes (D-86-06 superseded)

- **Phase / source:** Phase 1 discuss (D-CF1-04; FG-06).
- **Severity:** Medium. **Status:** open.
- **Choice:** A skill or command without `description` gets upstream `A2e`:
  the first non-blank line, heading hashes removed, cut to 97 chars plus
  `...`. This replaces the skills' "first prose paragraph" rule (D-86-06), and
  commands get the description written at install instead of Pi's 60-char cut.
- **Alternatives:** Keep D-86-06, a recorded decision that licenses the
  current behavior.
- **Why dubious:** It reverses a recorded decision and changes the listing a
  user sees. D-86-06 followed older upstream docs, so the change follows its
  intent.
- **Upstream evidence:** 2.1.316 binary, `A2e`, grepped 2026-10-31. High.
- **Recorded in:** `01-CONTEXT.md` D-CF1-04.

### DC-06: Which unhonored frontmatter fields install reports

- **Phase / source:** Phase 1 discuss (D-CF1-05; FG-10).
- **Severity:** Medium. **Status:** open.
- **Choice:** Skills and commands report `disallowed-tools`, `model`,
  `effort`, `agent`, `context`, `background`, `hooks`, and `paths` with one
  `[<source>] dropped fields:` warning, as agents do. They do not report
  `allowed-tools` (it only grants tools, and Pi asks for none) or
  `user-invocable` (the user kept its behavior on 2026-10-31).
- **Alternatives:** Stay silent (today), or report every field, including
  `allowed-tools`, which appears in many commands.
- **Why dubious:** It adds install warnings that existing plugins never
  showed, and the `allowed-tools` and `user-invocable` exclusions are
  judgment calls.
- **Recorded in:** `01-CONTEXT.md` D-CF1-05.

### DC-07: Declared command, agent, and workflow paths replace the folder

- **Phase / source:** Phase 1 discuss (D-CF1-06; FG-14).
- **Severity:** High. **Status:** open.
- **Choice:** A declared `commands`, `agents`, or `workflows` path now
  replaces the conventional folder, with a warning when an existing folder is
  shadowed; `skills` still adds. This supersedes the locked decisions D-07
  (COMP-01) and D-24 for those three kinds.
- **Alternatives:** Keep the union. D-07 is a recorded decision, so the
  project rules allow keeping it (the research recommended keeping it).
- **Why dubious:** A plugin that declares a custom `commands` path and also
  ships `commands/` loses the folder's commands on its next install or
  update. Upstream does the same today. D-24 itself says it adopted the union
  to match upstream as documented in 2026-05.
- **Upstream evidence:** 2.1.316 binary, `Et=!Se.commands&&Me` and
  `folder-shadowed-by-manifest`, grepped 2026-10-31. High confidence.
- **Recorded in:** `01-CONTEXT.md` D-CF1-06.

### DC-08: Harness trust through the trust store; MCP approval opt-in

- **Phase / source:** Phase 1 discuss (D-CF1-07).
- **Severity:** Low. **Status:** open.
- **Choice:** The profile Pi trusts its project through a persisted trust
  entry (not `--approve`), and project MCP server approval is a separate
  `Given`, not a default.
- **Alternatives:** `--approve`; `defaultProjectTrust: "always"`; approve
  project MCP servers by default.
- **Why dubious:** HAR-06 reads as if the default profile also approves
  project MCP servers. Keeping approval opt-in lets Phase 6 settle FG-29
  either way.
- **Recorded in:** `01-CONTEXT.md` D-CF1-07.

### DC-09: `${NAME:-default}` left to the adapter at connect time

- **Phase / source:** Phase 1 discuss (D-CF1-13; VER-05).
- **Severity:** Medium. **Status:** open.
- **Choice:** Under pi-mcp-adapter 7.x, write `${NAME:-default}` for the
  adapter to expand when it starts the server, as Claude Code does, unless
  the conformance proof finds the adapter's `:-` rule differs from Claude's.
- **Alternatives:** Keep resolving defaults at install (today).
- **Why dubious:** A variable set after install now takes effect without a
  reinstall, which is upstream behavior but a change for existing installs.
- **Recorded in:** `01-CONTEXT.md` D-CF1-13.

### DC-10: Shared cores added to Phase 1

- **Phase / source:** Phase 1 discuss.
- **Severity:** Medium. **Status:** open.
- **Choice:** The argument, injection, description, and dropped-field cores
  and the component-directory change are built in Phase 1, frozen, and only
  wired by Phases 2-7. A component phase that needs a core change reports it
  to the parent, which applies it on the milestone branch.
- **Alternatives:** Let Phases 2 and 3 implement them separately.
- **Why dubious:** Phase 1 grows by about two plans and delays the fan-out,
  in exchange for one implementation instead of two that could drift.
- **Recorded in:** `01-CONTEXT.md` `<specifics>`.

### DC-11: UI design-contract step skipped on a false frontend match

- **Phase / source:** Phase 1, autonomous step 3a.5; parent session.
- **Severity:** Low. **Status:** open.
- **Choice:** `gsd-tools check ui-plan-gate 1` answered `frontend: true`
  only because the goal contains the word "component" (plugin components);
  it found no frontend evidence, and `workflow.ui_phase` is false. The only
  `plan:pre` step hook with a skill is `ai-integration-phase`, not a UI hook.
  The run skipped the step, as the workflow does for `ui_phase=false`.
- **Alternatives:** Run `gsd-ai-integration-phase 1`, which the literal rule
  would have dispatched.
- **Why dubious:** It departs from the literal workflow text. A GSD tooling
  issue: the gate's keyword match and the "any step hook means ui_phase is on"
  assumption both misfire here.
- **Recorded in:** this file only.

### DC-12: Planning without reversibility checkpoints

- **Phase / source:** all planning; parent session.
- **Severity:** Medium. **Status:** open.
- **Choice:** Plans are made as with `--no-reversibility-gates`: a one-way-door
  decision is still rated and recorded on its task, but it does not become a
  human `checkpoint:decision` that stops execution. Workflow prompts that
  offer a recommended option (for example "research first?") take it.
- **Alternatives:** Keep the default gates, which would stop the run for the
  user at each one-way-door decision.
- **Why dubious:** It removes a safety stop the workflow has by default. The
  user asked not to be interrupted, and the flag exists for unattended runs.
- **Recorded in:** this file; the planner prompt says
  `REVERSIBILITY_GATES: false`.

### DC-13: Phase 1 research choices (accepted by the parent)

- **Phase / source:** Phase 1 researcher (`01-RESEARCH.md`); the parent
  accepted each item below for planning.
- **Severity:** Medium overall. **Status:** open.
- **Items:**
  1. **`:-` as a hybrid (D-CF1-13).** pi-mcp-adapter 7.0 runs its `$env:` and
     `{env:}` passes over a filled-in default, which Claude never re-reads, so
     `${A:-$env:HOME}` would leak. The adapter gets `${NAME:-default}` only
     when the default holds no `$env:`/`{env:` text; otherwise the bridge
     keeps install-time resolution. Alternative: all-or-nothing.
  2. **`shell: powershell` on Linux and macOS** runs Bash unless
     `CLAUDE_CODE_USE_POWERSHELL_TOOL` is set, as upstream (`Vv()`, `jd()`).
     This refines D-CF1-02's wording.
  3. **`${CLAUDE_EFFORT}`** comes from Pi's thinking level: `off` and
     `minimal` become `low`; a frontmatter `effort` is ignored (D-CF1-05).
     Upstream default is `high`.
  4. **The component-directory plan runs in wave 3**, not wave 1: its scenario
     needs 01-03's generic file step.
  5. **The argument tokenizer port** treats tree-sitter-bash 0.25.1 output as
     upstream's expected values; Claude's bundled grammar version is unknown,
     and some rows are error-recovery quirks (`--flag=1 -v` gives `["-v"]`).
  6. **Unwired cores and fallow.** Cores built now but wired by Phases 2 and 3
     are listed in `.fallowrc.json` `dynamicallyLoaded` and `ignoreExports`.
     The parent removes those entries after Phases 2 and 3 merge.
  7. **Package legitimacy.** The audit marked all six new package versions
     "suspicious" only because they are new releases. The recorded evidence
     (same source repositories, no postinstall scripts) replaces the human
     checkpoint the protocol asks for.
  8. **HAR-06 observation.** The trusted and untrusted pair observes a
     project-scope agent through pi-subagents (seed in `features/agent/`).
     The untrusted `Given` must also write a trust-requiring file such as
     `.pi/settings.json`, because Pi trusts a project without one.
- **Recorded in:** `01-RESEARCH.md` (Q1-Q5, Pitfall A, Open Questions).

### DC-14: Pattern-map open points left to the planner

- **Phase / source:** Phase 1 pattern mapper (`01-PATTERNS.md`).
- **Severity:** Low. **Status:** open.
- **Items:** the spike 028 prototypes are named as "exact" analogs for the
  scripted model, probe, and stub although they are prototypes; the hook
  recorder and MCP stub are spawned by path and may need fallow handling
  (unmeasured); the folder-shadowed warning (D-CF1-06) is suggested through
  the resolver's `notes` without tracing whether that reaches the install
  notification; an optional ESLint zone for `platform/prompt-shell.ts` that
  CONTEXT does not ask for.
- **Recorded in:** `01-PATTERNS.md`.

### DC-15: Phase 1 planning choices

- **Phase / source:** Phase 1 planner (`01-01-PLAN.md` … `01-15-PLAN.md`).
- **Severity:** Medium. **Status:** open (plan check pending).
- **Items:**
  1. **15 plans instead of 9 + 2.** 01-01 is split: 01-15 takes the Pi
     1.4.0 e2e floor fixture, Pi types, and version docs. The invocation core
     is split across 01-10, 01-12, and 01-13. Reason: `.fallowrc.json` can
     have one editor per wave, and fallow accepts a `dynamicallyLoaded` path
     whose file does not exist yet (measured), so 01-10 registers all six core
     paths in wave 1. An inline `fallow-ignore-file` marker would turn stale
     once Phase 2 or 3 imports the file (measured), so the config route is
     required.
  2. **D-CF1-13 split:** 01-01 keeps install-time `:-` resolution and widens
     the adapter TRIGGER in wave 1 (keeps the 7.0 drift guard green); 01-14
     adds the delegation in wave 2.
  3. **Component-directory plan 01-11 moved to wave 2** (reverses DC-13 item
     4): it now defines its own generic plugin-file step.
  4. **Shadowed-folder warning** shows on install, enable, import, apply,
     update, and reinstall; travels as a typed optional resolver field plus a
     discovery warning; text is upstream's `Default <kind>/ folder is ignored
     because the manifest sets "<kind>"`.
  5. **Ownership inside Phase 1:** 01-03 does not edit `ci.yml` (01-01 makes
     `test:cucumber` install peers first); the generic file step lives in
     01-11; 01-04 alone edits `world.ts`/`session.steps.ts`, 01-07 alone edits
     `model.steps.ts`/`companion.steps.ts` in wave 3.
  6. **Project-server approval Given** lands in Phase 1 and a seed uses it.
     It writes `settings.projectServers: "allow"` to `<agentDir>/mcp-adapter.json`
     (adapter 7.0 `config.ts:218`), not `~/.config/mcp/mcp.json`. FG-29 stays
     open.
  7. **Workflow seed runs with no arguments**, so FG-32's argument shape is
     left to Phase 7.
  8. **The model-turn When fails** on any extension error or dialog during the
     turn; a phase that needs to observe one adds its own When.
  9. **`!` spawn residuals (D-CF1-02):** PowerShell is `pwsh -NoProfile
     -Command` on Linux/macOS and `powershell.exe` on Windows; 120 s timeout
     uses the "interrupted" message; output is not truncated; core error
     classes live in their own modules rather than `shared/errors.ts`; no
     ESLint zone restricts importers of `prompt-shell.ts`.
  10. **Smaller:** CHANGELOG entry has no PR number yet (parent appends it);
      an undefined thinking level maps `${CLAUDE_EFFORT}` to `high`; the
      profile Given turns Pi auto-retry off (settles research A6); core plans
      list DEC-01 as their requirement; automated `npm view` legitimacy checks
      replace human checkpoints (DC-13 item 7).
- **Probe note:** `check verify-command-paths 1` flagged one warning
  (01-09 Task 3, `script_missing`), a misread: the `npm run test:e2e` half
  runs at the repo root, not in the `--prefix` directory.
- **Recorded in:** the plans' "Flagged assumptions" sections and `COVERAGE.md`.

### DC-16: Plan-check revisions made by the parent

- **Phase / source:** Phase 1 plan checker (0 blockers, 2 warnings, 1 info).
- **Severity:** Low. **Status:** open.
- **Items:**
  1. **Cucumber scenario for connect-time `:-` (warning 1).** The parent,
     not a re-spawned planner, added Task 3 to `01-06-PLAN.md`: a plugin
     server's `env` holds `${PI_CM_STUB_TAG:-install-default}`, the variable is
     set after install, and the model sees `late:echo:ping`. 01-06 now depends
     on 01-14 and lists VER-05. The stub prefixes its echo with `STUB_TAG` when
     set, so Task 1's expectations do not change. The task may need a new
     `Given` that sets a variable in the profile Pi's process environment.
  2. **Three plans over 15 files (warning 2) not split further:** 01-01 (19),
     01-15 (18), 01-11 (16). Most files are source-test pairs and docs; each
     plan has 3 tasks; the planner already split once.
- **Recorded in:** `01-06-PLAN.md`, `01-14-PLAN.md` objective.

### DC-17: Executor prompts read the GSD execution files by path

- **Phase / source:** parent, Phase 1 execution (`execute-phase.md` step 3).
- **Severity:** Low. **Status:** open.
- **Items:**
  1. The workflow asks the orchestrator to paste `execute-plan.md`,
     `templates/summary.md`, `references/checkpoints.md`, `references/tdd.md`
     (TDD plans), `references/worktree-path-safety.md`, and
     `references/executor-examples.md` verbatim into every executor prompt
     (about 2,400 lines each, 15 executors). The parent instead tells each
     executor to Read those files in full, by absolute path, before any work.
     The executor sees the same text; the parent keeps its context budget.
  2. Executor prompts add a `<project_rules>` block: commit titles carry no
     milestone, phase, plan, wave, or task ID (AGENTS.md); the two attribution
     trailers; never push; the `pre-commit run --files` step. The workflow
     forbids extra gate-override text, and the block contains none.
  3. The repo has no `CLAUDE.md`; prompts point executors at `AGENTS.md`.
- **Recorded in:** this log only.

### DC-18: Phase 1 wave 1 executor choices

- **Phase / source:** executors for plans 01-01, 01-02, 01-10, 01-15.
- **Severity:** Medium (the root-permission workaround and the mislabeled commit); the rest Low. **Status:** open.
- **Cross-cutting:**
  - **Root sandbox.** This session runs as root, which ignores the `chmod` tricks the permission-injection tests use: 128 unit cases, 38 cucumber scenarios, and 1 integration case fail on any tree. Executors and the parent run npm scripts with `npm_config_script_shell` pointing at a `setpriv` wrapper that drops `dac_override` and `dac_read_search`. No hook or check is skipped. A repository-level fix (for example, skipping those cases when `process.getuid() === 0`) is not made.
  - **ESLint heap.** Cold-cache ESLint runs ran out of the default heap under parallel load; commits and gates use `NODE_OPTIONS=--max-old-space-size=6144`.
  - **Shared scratchpad collision.** Commit `8b191cb` holds the Pi 1.4.0 e2e fixture files but carries the dependency-raise commit message. It was not amended (no history rewrites). Later executor prompts get a per-agent scratch folder.

#### 01-02 (cucumber rules and decision records)
1. D-CF1-14..17 rows cite DC-01, which lists only pre-fan-out items; a Phase 1 decisions entry may be wanted and those labels updated.
2. The layout rule section in `.agents/skills/cucumber/rules/layout.md` uses "Phase 1" and phase numbers (milestone-scoped, copies ROADMAP; key link greps "Frozen after Phase 1"), although process names are kept out of durable files.
3. Seed feature and step names written before the harness exists; 01-09 must correct the table if the built names differ.
4. New PROJECT.md Key Decisions rows padded to the table's column widths (~7,700 chars per row).
5. D-CF1-03 rationale (upstream applies T2e/HRe when its Skill tool loads a plugin skill) inferred from research, not re-grepped in the binary.
6. HAR-08 prohibition (pin a divergence only with a decision ID or Pi gap) placed in `layout.md`, not `features.md` (not in the file list).
7. Cross-kind wording follows ROADMAP ("frozen fixture writers such as published-marketplace.ts").
8. Flagged assumptions stay open: one Key Decisions row per decision (DEC-01); the contradicting bullet is "Custom component-path arrays as supplemental" (DEC-02).
#### 01-10 (command-invocation seed, frontmatter cores, fallow registration)
1. The pass-through `input` handler in `edge/command-invocation.ts` is not recorded as a stub in the WINDOWS ledger (it is specified behavior until the D-CF1-01/02 transforms land).
2. One-line comments on the D-CF1-05 dropped-field table describe upstream fields from Claude Code docs, not from the binary.
3. Environment: a commit hook failed when ESLint ran out of memory under parallel load; the agent re-ran it with `NODE_OPTIONS=--max-old-space-size=6144` (no `--no-verify`). A heap flag in the `lint` script may be worth considering.
4. Ran `SKIP=npm-check pre-commit ...` (the worktree guard refused `${SKIP:+,$SKIP}`; SKIP was empty).
5. Extra test row (heading over 100 chars) and a D-CF1-01/02 comment at the registration call site explaining ordering.
- Parent follow-up: remove the six `.fallowrc.json` `dynamicallyLoaded`/`ignoreExports` entries after Phases 2 and 3 merge.
#### 01-15 (Pi 1.4.0 floor fixture, Pi types, version docs)
1. Running as root, two chmod-based tests (`test/bridges/agents/stage.test.ts`, `test/bridges/agents/discover.test.ts`) fail in the full-pairs commit hook regardless of the change; the agent committed through an `npm_config_script_shell` wrapper that turns off root's permission override for npm scripts (hook still ran in full, no `--no-verify`). A repository-level fix may be preferable.
2. Commit 8b191cb holds 01-15 Task 1 files but carries 01-01's message (`build(deps): raise Pi to 1.4.0 and the companion floors`) after a shared-scratchpad file collision; not amended (history rewrites forbidden).
3. Added `fallow-ignore-next-line unused-type` markers on `ThinkingLevel` and `InputSource` in `platform/pi-api.ts` (unused until Phase 2); CONVENTIONS.md marker count (41) is now stale (43).
4. `docs/env-vars.md` line 164 keeps its 5.2.0 measurement plus a note that the `resolveEnv` call site was re-read in 7.0.0 (only that path re-checked).
5. `docs/env-vars.md` line 3 names 7.0.0 relying on 01-01's conformance test, which ran in parallel.
6. Unrequested rename of the canary scratch folder `/var/tmp/mcp-adapter-520` → `/var/tmp/mcp-adapter-700`.
7. `workflow-home.ts` line 15 left unchanged (still true).
8. Canary's refusal of a Pi below 1.0.0 left as is (not raised to 1.4.0).
9. `InputSource` comment cites D-CF1-01, not D-CF1-02.
10. TDD red step not committed separately (red state is a typecheck error the hook rejects); failure output is in the SUMMARY.
- Parent follow-ups: CHANGELOG `[Unreleased]` line needs ` (#NNN)` when the PR opens; CONVENTIONS.md fallow-ignore count.
#### 01-01 (Pi and companion version raise, adapter 7.x escape)
1. Running as root, 128 unit cases, 38 cucumber scenarios and 1 integration case (AMIG-02) fail on any tree (permission-injection tests); commits ran npm test scripts through an `npm_config_script_shell` wrapper using `setpriv` to drop `dac_override`/`dac_read_search` (no hook skipped).
2. Commits ran with `NODE_OPTIONS=--max-old-space-size=6144` (ESLint out of memory on a cold cache).
3. Conformance alphabet raised to 5 tokens (nested `${B:-${A:-x}}` needs 5); ~5 s.
4. In the literal-path check every alphabet name is set so any leaked reference shows as a mismatch.
5. Stale-cache case tested by editing the cached adapter version to 5.2.0 rather than installing 5.2.0.
6. Only `TRIGGER` changed in `adapter-escape.ts` (zero mismatches remained).
7. `test/live-uat/mcp-adapter-canary.mjs` still pins pi-mcp-adapter 5.2.0 (outside the file list; no gate runs it).
8. VER-01 "lockfile matches" read as: the lock root mirrors manifest peer ranges and dev dependencies, e2e fixture lock excluded (flagged for the verifier).
9. GSD commit tool not used, so commit titles carry no plan IDs (project rule).

### DC-19: Phase 1 wave 2 executor choices

- **Phase / source:** executors for plans 01-03, 01-11, 01-12, 01-13, 01-14.
- **Severity:** Medium for the upstream-over-plan deviations (01-11 item 1, 01-12 items 3-4, 01-13 item 1) and the Pi workaround (01-03 item 2); the rest Low. **Status:** open.
- **Parent note:** executor prompts now point at a shared brief file (`executor-brief.md` in the session scratchpad) instead of repeating the common blocks, extending DC-17.

#### 01-12 (argument substitution core)
1. Parity oracle is tree-sitter-bash 0.25.1 via the research re-implementation; that Claude Code bundles an equivalent grammar is assumed, not verified. 9 known differences ($-lexing quirks, error recovery after unclosed quote/bracket) are kept in a residual table.
2. Error-recovery heuristics inferred from harness probes, not grammar source (e.g. "doesn't" gives `doesn`, as upstream does).
3. Deviation: `parseArgumentNames` keeps declared order; the cut to 64 and longest-first sort happen inside substitution with original indices, as in the binary. Phases 2 and 3 must pass its result to `substituteArguments` unchanged.
4. Deviation: the size cap (4,000,000) applies only when a value is filled, as upstream; the plan's "oversized body with empty args throws" case was changed.
5. Deviation: the nesting scan uses an explicit stack (recursion overflowed on `"$(` x3000, a DoS, T-01-20).
6. `variables` typed `Readonly<Record<string,string>>`; unknown keys ignored.
7. No separate RED commits (hook rejects them; tdd_mode false); RED counts in SUMMARY.
8. With `args` undefined, variables are still filled (plan must-have and binary), contrary to CONTEXT E1's "returned unchanged".
#### 01-13 (context injection core, prompt-shell spawn site)
1. Spawn-failure text follows upstream `MRr` (bare `[Error]\n<msg>`), not the plan's `Shell command failed for pattern ...` form.
2. Fenced ```! blocks found by an indexOf scan instead of upstream's regex (ESLint `sonarjs/super-linear-regex` rejects it); same output.
3. Windows timeout kills only the shell process (`child.kill`), no `taskkill /T` tree kill.
4. Windows Git Bash lookup scans absolute PATH entries for `git.exe` instead of `where.exe`; PowerShell executables (`powershell.exe` / `pwsh`) from the plan, unverified against upstream; PowerShell tool treated as off when the variable is unset (upstream reads a default-false flag).
5. A stopped run always waits the full kill grace (2,000 ms default, own choice) before resolving `interrupted`.
6. The runner request takes an already selected shell; the edge must call `selectPromptShell` itself.
7. `timeoutMs` and `killGraceMs` optional with defaults (plan listed them as required).
8. RED not committed separately (hook); evidence in `scratchpad/agent-01-13/red-task*.tap`.
9. Gate fits: extra non-zero-exit case in the tracer for branch coverage; no-shell-out docstring no longer repeats "exactly five files".
#### 01-14 (`:-` delegation to pi-mcp-adapter 7.x)
1. Task boundaries moved: the marker check, shared-row updates, stage/integration assertion fixes, and all serializer guards landed in Task 1 (else Task 1 is red with 344 mismatches).
2. Two unrequested serializer guards (a default that could complete a marker started by the preceding reference's value; a reference after a default ending in a partial trigger).
3. Base-URL names (e.g. `ANTHROPIC_BASE_URL`) in `url`/`headers` stay install-time, reading "deny-listed" as covering the value-dependent deny list.
4. OAuth clean rule keeps every old decision rather than the plan's literal per-reference wording (`team ${TEAM:-}` keeps `auth`).
5. No separate RED commits.
6. The unset-at-connect conformance variant also leaves plain references unset, modeled as `""` (existing residual).
7. Retitled the shared row `${PI_CM_A:-{}env:PI_CM_SECRET}` to test the delegated form; a new `{env:`-default row keeps the merged-run case.
8. `${CLAUDE_PROJECT_DIR:-x}` is now delegated; at user scope it reads Pi's exported `CLAUDE_PROJECT_DIR` at connect.
9. One file outside files_modified changed: a one-line assertion in `test/bridges/mcp/stage.test.ts`.
- Parent follow-up (01-09): CHANGELOG line "A plugin MCP setting `${NAME:-default}` now takes a variable you set after install, as in Claude Code, without a reinstall."
#### 01-11 (declared component paths replace their folder, D-CF1-06)
1. A declared `.` still triggers the shadowed-folder warning (upstream `lKn` checks `(S+sep).startsWith(folder+sep)`), against the plan's Task 2 behavior bullet. With `commands: "."` Pi's recursive commands walk still reads `commands/`, so the warning claims more than Pi does (matches what upstream prints).
2. `""` now declares nothing (strict resolver and lenient map), following upstream's truthy check; before it resolved to the plugin root.
3. The warning names the bare kind; upstream's `experimental.<kind>` variants and its "Remove ... from plugin.json" hint not ported.
4. Update adds the warning only to its `updated` outcome; a failed update does not carry it.
5. The second lenient seed in `info.ts` (warm tree of a non-path source, reads no declarations) left alone: it still lists every conventional folder of an unavailable non-path plugin.
6. No separate red-only commits; red runs in SUMMARY.
- Edited outside files_modified: four tests relying on the old union (`install-flow-ledger`, `reinstall-flow`, `update-flow` PDEF-01 fixtures; `declared-component-path-overlap` architecture test).
- Parent follow-up (01-09): CHANGELOG sub-bullet as given in 01-11 SUMMARY.
#### 01-03 (harness tracer: profile Pi, scripted model, companions, skill seed)
1. jiti cache link: `{home}/tmp/jiti` links to `<run root>/jiti-cache` (outside the sandbox home, inside the run's temp root; compiled sources only) to cut profile Pi start from 13-20 s to ~1.4 s. Threat Flag.
2. Rule 1 fix: the scripted model registers via `pi.registerProvider("faux", { apiKey: "scripted-model", ... })` because Pi's `findInitialModel` keeps a saved model only for an already-configured provider (1-in-6 "No API key" flake after a new session). Works around Pi behavior; may need revisiting.
3. `PiProcess` now cancels every dialog, including one outside a request (shared Pi changes slightly).
4. `companions.ts` created in Task 1 (needed earlier); `model.steps.ts` edited in Task 2.
5. Unused-step message wording: "no model call used these steps of the model script".
6. Self-chosen formats: script table columns, call-row formats (`tool call <name> <json>`, `<tool> returned|failed: <text>`), derived `systemPrompt`.
7. Proven only by design, no scenario: "no script armed", HAR-03 `handled` path, live-pid stand-in check, companion reordering.
8. Companion load check uses commands, not tools (tools wait for the 01-04 registry probe).
- Parent follow-up (01-09): the cucumber world rule should mention the jiti cache link and the literal-key registration.
