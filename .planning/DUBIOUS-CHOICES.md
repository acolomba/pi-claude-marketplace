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

### DC-20: Phase 1 wave 3 executor choices

- **Phase / source:** executors for plans 01-04, 01-05, 01-06, 01-07, 01-08.
- **Severity:** Medium for 01-07 item 1 (trust observed through a run because pi-subagents lists untrusted agents) and 01-06 item 4 (new launch-environment extension outside the file list); the rest Low. **Status:** open.
- **Cross-cutting:** profile Pi starts timed out at 30 s under heavy parallel load; 01-04 added `PROFILE_PI_START_TIMEOUT_MS = 90_000` and 01-07 a 60 s untrusted start. Hook and workflow agents saw unexplained one-off timeouts before that fix.

#### 01-08 (workflow seed)
1. Deviation: the fixture workflow returns text, not a small object (the engine's progress entry shows any object only as `Structured result`, so it could not be compared whole).
2. The result Then also compares `error` (expected absent) and checks one run id.
3. The run When fails on any scripted-model call (stricter than the model-turn When); Phase 7 may need to relax it for workflows that call agents.
4. Statements reordered in the run When to clear a fallow clone match with `session.steps.ts` rather than adding a marker.
5. Whole-suite runs ended 1160/1161 twice: a 30 s step timeout in `Given pi runs with the scripted model and these companions:` while a profile Pi started, in a different scenario each time, under load average 20-26 on 4 cores. Attributed to load, unconfirmed. Suggested fix if it repeats: a named profile-Pi start timeout above 30 s.
6. Step texts are the agent's own wording (kind-prefixed per D-08).
#### 01-04 (registry probe, slash-command seed)
1. Rule 3 fix outside files_modified: `PROFILE_PI_START_TIMEOUT_MS = 90_000` exported from `world.ts` and applied to the two profile-start steps in `model.steps.ts` and `companion.steps.ts` (owned by 01-07 this wave). Cause: per-worker cold TypeScript compile took 27-30+ s under load average 20-31. Not confirmed on the base tree.
2. Probe records also carry `path` (where Pi says a tool/command came from), beyond the plan's "name and source", for later phases.
3. The listing Then compares only prompt-template commands (whole set), not every command.
4. A missing description shows as an empty cell (indistinguishable from empty).
5. Two field shapes never seen live (`null` description, empty `activeTools`); schema covers both.
6. The probe's own command `pi-registry-probe` appears in every profile Pi's command list; later whole-list comparisons must expect it.
7. Feature description names "a registry probe" as the stand-in.
- Parent follow-up (01-09): add `PROFILE_PI_START_TIMEOUT_MS` and the probe steps to `.agents/skills/cucumber/rules/world-and-stand-ins.md`.
#### 01-05 (hook recorder, hook seed)
1. `CLAUDECODE` recorded too (plan says `CLAUDE_*` only); the bridge sets `CLAUDECODE=1` for every hook (SENV-01).
2. Environment-variable names used as table headers (not lower-case words as the feature rules ask).
3. Run row is 13 columns wide (one row per run, per plan).
4. Seed expects an empty `transcript_path` (current bridge behavior; upstream always sends a path).
5. Two of the first three two-hook runs failed unexplained (output not captured); next 18 passed; guessed load/startup timeout.
6. The hooks Given takes a table (name/event/matcher) instead of one event and matcher.
7. Hook names limited to `[a-z0-9-]+` (inserted unquoted into the shell command).
8. Task 2 has no commit (checks passed).
- Findings for the Hooks phase (not decided): empty `transcript_path` on the first turn (upstream always sends one); the bridge runs matching hooks sequentially in declared order (upstream: parallel); the bridge does not dedupe duplicate hook commands (upstream does).
#### 01-07 (agent seed, trusted/untrusted pair)
1. Deviation: HAR-06 trust pair observes a project-scope agent RUN, not the `subagent {action:"list"}` listing, because pi-subagents 0.84 lists an untrusted project's agents (`discoverAgentsAll` with no trust option, `src/extension/index.js:511`) while runs follow Pi's trust. Looks like a pi-subagents defect; Claude Code's behavior for agents in an untrusted project still needs research before the agents phase. Coverage D2 marked `human_judgment: true`.
2. Both scenarios use `agentScope: "project"`, so the pair proves pi-subagents' explicit trust check, not its default discovery filter (an unscoped run's error lists built-in agents with node_modules paths and em dashes).
3. New `{uuid}` token in model-call steps (pi-subagents mission id varies); accepts any UUID, no same-id check. 01-09 should add it to `features.md`.
4. `UNTRUSTED_START_TIMEOUT_MS = 60 s` on the untrusted Given (timed out at 30 s under load; Pi loads extensions twice when a trust decision is needed; 12.9 s alone).
5. The child system-prompt comparison pins pi-subagents 0.84.0's instruction text; a peer upgrade that rewords it breaks the seed.
6. The trusted companions Given passes `trust: "trusted"` explicitly via a shared helper.
7. HAR-06 flagged assumption carried: 01-06's approval Given covers MCP approval.
8. No WINDOWS ledger entry (shared file across worktrees).
#### 01-06 (MCP stub, MCP seed, project-server approval, connect-time `:-` scenario)
1. Step order differs from the plan: install runs in the shared Pi before the profile Pi starts, with no new-session step (with the plan's order `new_session` binds the extension twice and the adapter's startup listing ran 2-3 times, so whole-log comparison was unstable).
2. New Given waits for the adapter's startup tool listing (50 ms poll, 15 s deadline).
3. `{tool call <n>}` projection local to the stub-log Then (Pi invents a tool call id per call); not in the cucumber skill's run-token list; 01-09 should reconcile.
4. New file outside files_modified: `features/lib/pi-launch-environment.ts`, a Pi extension loaded via `PiProfile.extraExtensions` that copies `<home>/pi-launch-environment.json` into the profile Pi's `process.env` (world.ts passes only TMPDIR). A world-level `environment` field on `PiProfile` would be cleaner.
5. Expected stub log includes the adapter's startup listing (two connections per call scenario); changes if a later adapter caches differently.
6. Task 3 Given text holds `"${PI_CM_STUB_TAG:-install-default}"` literally (escaped brace) so the acceptance grep finds it.
7. The stub logs its plugin and server names from its arguments (unrequested).
8. FG-29 not decided.
- Measured: A7 yes (nested call emits its own tool_execution records, id = outer id + `/1`); A5 adapter 7.0.0 reads `getAgentPath("mcp-adapter.json")` under `PI_CODING_AGENT_DIR`.

### DC-21: Phase 1 wave 4 executor choices

- **Phase / source:** executor for plan 01-09 (CI shards, phase gate).
- **Severity:** Low. **Status:** open.
- **Phase gate (on 80f1764, root wrapper):** `npm run check` exit 0 (cucumber 1169/1169); `test:e2e` 33 tests, first run 1 flake (ADET-01), next two full runs pass; `test:cucumber` twice 1169/1169 (seeds 641302, 717293).

#### 01-09 (CI shards, handed-over lines, phase gate)
1. CI shard timeouts (15 min each, the floor) rest on local runs doubled, not a CI measurement (CI-01 flagged assumption); re-measure on the first CI run and after each component merge.
2. The session `GH_TOKEN` is invalid, so zizmor's online audits could not run locally; commits ran zizmor offline (no findings). CI's Lint workflow runs the online audits.
3. CONVENTIONS.md (fallow-ignore count: 41 stated, 48 counted under extensions/test/scripts plus 3 in features/) and STACK.md (CI paragraph lacks the `behavioral` job) not edited (outside file list).
4. The D-CF1-06 CHANGELOG line drops the handed-over sentence about `skills` (one-sentence rule).
5. `layout.md` frozen list: every `features/lib/` file except the six fixture writers.
6. `staging-warnings.feature` named a lifecycle file.
7. PROJECT.md rows use semicolons as separators, matching existing rows.
8. e2e verdict counts the third full run; the first full run had one flake (`ADET-01` sentinel still alive after the 2 s wait, `test/e2e/adapter-detection-rpc.test.ts:452`), passing 3/3 alone and in the next two full runs.
9. Existing `uses: $/.github/workflows/sonarcloud.yml` line in ci.yml left as on origin/main.
- Parent follow-ups: phase-specific findings listed in 01-09-SUMMARY (Phase 4: `convert.ts` `THINKING_VALUES` lacks `max`; pi-subagents `list` ignores trust. Phase 5: three hook findings. Phase 6: FG-29, startup listing in the seed log. Phase 7: the run When fails on any model call).

### DC-22: Phase 1 verification, review, and human-item resolution

- **Phase / source:** parent, Phase 1 verify:post hooks, code review, verifier.
- **Severity:** Medium (items A and B below); the rest Low. **Status:** open.
- **A. Human items resolved without the user.** The verifier returned `human_needed` with two items. (1) CI shard timing: the parent dispatched `ci.yml` on the branch (`workflow_dispatch`, run 41283935457, all 8 jobs green); lifecycle job 3 min 21 s, components 1 min 34 s, so the 15-minute timeouts hold with more than 4.5x margin; `ci.yml` and the D-CF1-16 row now carry the measured figures. (2) HAR-06 observation change (trust pair observes a project-scope agent run, not the list): accepted by the parent under the standing "decide, do not interrupt" instruction; it is a choice of test observation, not an upstream divergence. VERIFICATION.md was set to `passed` with a resolution section and a recomputed fingerprint.
- **B. Code review scope and loop.** One reviewer at standard depth over 56 of 113 changed files (source, harness, CI, scripts; tests, feature files, docs left to the gates). Three fix rounds (the cap); no fourth review after round 3.
- **C. Skill runners.** `validate-phase` and `secure-phase` ran as general-purpose subagents (no Agent tool, so the security auditor ran inline); `code-review` ran in the parent.

#### validate-phase (Nyquist audit, phase 1) — compliant, 0 gaps
1. "Feedback latency < 60s" sign-off box left unchecked (the wave gate is ~10 min by design) while `nyquist_compliant: true` is set; each task command is under 60 s.
2. The 4 Manual-Only rows (CI shard wall time, real PowerShell, live adapter 7.0.0 canary, package legitimacy) accepted, not treated as gaps.
3. Reused the merged-tree check/e2e/cucumber results instead of re-running.
#### secure-phase (threat audit, phase 1) — 43 threats, 0 open (34 mitigated, 9 accepted as AR-01-01..10)
1. The runner had no Agent tool, so it did the gsd-security-auditor's work inline (allowed at ASVS L1 with zero open threats).
2. T-01-22 and T-01-24 closed for what Phase 1 built; the edge wiring (substitution before injection, errors via notification-dispatch, user-invoked only per D-CF1-03) carries forward to Phases 2 and 3.
3. T-01-41 (CI timeout) closed on an estimate; re-measure on the first CI run.
4. T-01-SC written as one row (high/mitigated for 01-01 and 01-15, low/accepted elsewhere).
5. Plain `git commit` instead of the helper (would title `docs(phase-01)`).
#### code review (phase 1): 0 blocker, 5 warning, 4 info; fixer fixed WR-01..05
- Review scope limited to 56 source/harness/CI files of 113 changed (tests, features, docs excluded; gates cover them). The upstream oracle for the tokenizer is the research's tree-sitter-bash 0.25.1 re-implementation (assumed equivalent to Claude's grammar). Info items IN-01..IN-04 not fixed (out of fix scope): residual table omits common differences such as `100% coverage`; blanket fallow export suppressions on the six cores have nothing forcing removal; exact `pi-ai` 1.4.0 dev pin may drift from the `pi-coding-agent` pin; a `!` command whose background child holds stdout blocks until the 120 s timeout (upstream behavior unchecked).
- Fixer: worked in the main checkout (no node_modules in a fresh worktree); zizmor run offline (invalid session GH_TOKEN); two `\$` error-recovery cases kept as residuals; untrusted start budget 180 s (2x trusted); upstream's "Skill /<name> requires bash..." text kept even for commands; new oracle rows in `UPSTREAM_ROWS`.
- Review round 2: WR-02..05 resolved; WR-01 fix regressed `x="a"\$ b c` (pre-command assignment); IN-05 new (`x $\$5 y`).
- Fix round 3 (cap): guard added (0 regressions on 53,248-input grid); IN-05 ported via `[\p{Alphabetic}\p{Nd}]` found by probing 120 characters (scanner source not read); one punctuation input traded (`$\$ b; c'`, error recovery after an unclosed quote) recorded as a residual; 11 unbalanced-bracket/quote `$\$` cases left under the best-effort clause. Parent did not run a fourth review pass after the third fix (iteration cap reached); the tokenizer has no production caller yet, and the full gate re-ran on the result.

### DC-23: Phases 2-7 run sequentially in this session, not as six parallel sessions

- **Phase / source:** parent, after Phase 1.
- **Severity:** Medium. **Status:** open.
- **Decision:** ROADMAP plans Phases 2-7 as six parallel sessions and worktrees, each on its own branch, merged by the parent in the order 7, 6, 4, 2, 3, 5. This session may push only to `claude/quirky-planck-hhm592`, and its background subagents have no Agent tool, so they cannot run the GSD phase pipelines (researcher, planner, checker, executors, verifier). The parent instead runs Phases 2-7 one after another in numeric order on the milestone branch, each through discuss, plan, and execute, with the plans of one wave still running in parallel worktrees. The merge-order rationale (conflict avoidance between parallel branches) no longer applies; each phase starts from the previous phase's merged tree, so a later phase sees an earlier one's files. File-ownership rules still hold, so phases stay out of each other's files.
- **Also:** the Phase 1 transition runner marked D-CF1-06/07/08/13/14/15/16/17 `✓ Good` and kept the rest `-- Locked`; STATE.md frontmatter was hand-corrected after `phase.complete`.

### DC-24: Phase 2 (Skills) discuss decisions settled without the user

- **Phase / source:** Phase 2 smart discuss (`02-CONTEXT.md`, D-CF2-01..12).
- **Severity:** Medium (items 1-4); the rest Low. **Status:** open.
- **Upstream probes:** live, offline, against Claude Code 2.1.316 (local marketplace, throwaway HOME/CLAUDE_CONFIG_DIR, `env -i`, and a local HTTP stub with a dummy key to capture the model request; no credential, no LLM). The binary contradicts the docs on FG-07 and FG-08.
- **Items:**
  1. **D-CF2-01/02 (FG-07):** the Pi name stays `/skill:<plugin>-<dir>` (the binary keeps the directory name and adds frontmatter `name` as aliases, `Qqn` at byte 287674833). Aliases become exactly upstream's: `<plugin>:<dir>` (non-`[a-zA-Z0-9_-]` to `-`), `<plugin>:<fm name>`, and the bare `<fm name>`. The elided alias reverse-derived from the Pi name (e.g. `acme:foo` for directory `acme-foo`) is DROPPED, which a user may rely on today. Bare-name collisions across plugins were not probed.
  2. **D-CF2-03 (FG-08):** inside one plugin a command wins over a same-named skill (binary; the docs table suggests the opposite). The skill is not staged and install WARNS, a warning upstream does not print; before, the skill stayed reachable as `/skill:`.
  3. **D-CF2-05 (FG-09):** the alias and skill invocation also run for `rpc` input (upstream `-p` mode resolves the names), superseding SK-6's "interactive" wording; `extension` input passes through.
  4. **D-CF2-10:** the Pi gap report (no hide-from-`/`, no skill display name/alias, no hook on the model's own skill path) is drafted as ready-to-file text in the phase SUMMARY, not filed; the ROADMAP's "reported to Pi" criterion needs the user to file it.
  5. **D-CF2-06:** the Phase 1 cores are wired into `edge/skill-aliases.ts`; Pi's `<skill>` block framing is kept instead of upstream's `Base directory for this skill:` text.
  6. **D-CF2-12:** Phase 2 ownership widened to `orchestrators/skill-alias-state.ts` (+ test) and an optional, backward-compatible profile in `features/lib/pi-tui.ts` (a frozen-list file? `pi-tui.ts` is not in the frozen list).
  7. **D-CF2-04, 07, 08, 09, 11** pin earlier decisions (first-wins with `skills/` copy winning, upstream `A2e` description fallback, dropped-field warnings, `user-invocable: false` stays listed under D-CF1-09, lifecycle in a new session after `/reload`).

### DC-25: Phase 2 research open questions and pattern-map choices

- **Phase / source:** Phase 2 researcher (`02-RESEARCH.md`) and pattern mapper (`02-PATTERNS.md`); parent answered the open questions with the recommended option.
- **Severity:** Low-Medium. **Status:** open.
- **Open questions answered by the parent (planner told to follow these):**
  1. Skills staged by older installs carry no names key: they keep today's elided-suffix alias as a fallback until re-staged (a non-upstream alias kept for compatibility).
  2. Within one plugin, a skill's identity alias (`<plugin>:<dir>`) wins over another skill's frontmatter alias with the same text (not probed upstream).
  3. A bare alias that equals a Pi built-in command name is recorded as a residual (Pi exports no built-in list).
  4. Autocomplete keeps offering qualified aliases only, not bare ones.
- **Research choices:** stored alias names live in a JSON-valued frontmatter key of the staged `SKILL.md`, written after `rewriteMarkdownReferences` (not a sidecar file); this changes expected values in three tests outside Phase 2 ownership (`test/edge/register.test.ts`, `test/orchestrators/plugin/materialize-latest.test.ts`, `test/orchestrators/plugin/reinstall-flow.test.ts`). The D-CF2-04 `skills/`-first fix goes in `bridges/skills/discover.ts`, not the resolver. Aborted invocations report as `usage-error` with origin `{kind:"command", commandId:"skill"}` (stretching an existing kind to avoid closed-set edits). The TUI scenario holds its session inside one `When` step and edits `features/lib/pi-tui.ts` (not on the ROADMAP frozen list; D-CF2-12). `[ASSUMED]`: `${CLAUDE_EFFORT}` reads `low` in the profile Pi; upstream does not normalize command names; upstream trims typed arguments.
- **Pattern-map suggestions:** `skill-invocation.ts` returns a discriminated `{ok|abort}` result instead of throwing; `loadQualifiedSkillAliases` widens its return type to carry `pluginRoot`/`pluginData`.

### DC-26: Phase 2 planning choices

- **Phase / source:** Phase 2 planner (`02-01..07-PLAN.md`) and plan checker (0 blockers, 1 warning, 2 info).
- **Severity:** Medium (items 1-3); the rest Low. **Status:** open.
- **Items:**
  1. **Four waves, not the template's three:** the alias plan (02-06, SKL-05) needs 02-03's RPC-capable input handler and shares `edge/skill-aliases.ts`, so it moved to wave 3 and the gate to wave 4.
  2. **Out-of-ownership edits:** expected-value edits to four tests outside Phase 2 (`test/edge/register.test.ts`, `test/orchestrators/plugin/materialize-latest.test.ts`, `test/orchestrators/plugin/reinstall-flow.test.ts`, `test/architecture/declared-component-path-overlap.test.ts`), each limited by a `git diff` criterion.
  3. **`features/lib/pi-tui.ts`:** 02-06 adds optional profile fields, extra CLI args, a ready text, and a raw `typeText` method (Tab completion needs it), beyond D-CF2-12's wording; `world.startTuiSession()` stays unchanged. The TUI step rebuilds the run's git environment from public world getters.
  4. **Names record in wave 1:** a `pi-claude-marketplace` JSON frontmatter key (names, pluginRoot, pluginData) is written by 02-01 before its consumers; the supporting-Markdown pass now skips the skill's own top-level `SKILL.md`. Absolute plugin paths in it are an accepted disclosure (T-02-03; the staged body already holds them after SUB-01 substitution).
  5. **Seed module moved:** `features/step_definitions/skill/invocation.steps.ts` (Phase 1 seed) is deleted and its Given moves to `skill/listing.steps.ts`; the frozen cucumber layout rule still names the old module (parent line).
  6. **02-01 is large** (15 files, 3 tasks); checker warning accepted as in Phase 1 (mostly source-test pairs and expected-bytes edits).
  7. **Smaller:** whitespace-containing frontmatter `name` stores no alias (D-CF2-02 residual); a `/skill:<name>` counts as bridged when its file is under this extension's staged-skills dirs (orphans count too); a new setup Given in 02-04 (`... which skipped a skill of the plugin`); typed `${CLAUDE_*}` arguments proven by unit tests only (frozen run-token expansion rejects `{...}`); 02-05 pins existing lifecycle behavior with negative-edit proofs instead of red proofs; `docs/env-vars.md` and the PRD's SK-6 wording are parent lines.
  8. **Gate tooling:** the plan:post gap-analysis check reported all 58 milestone requirements uncovered (including completed Phase 1 ones), so it was treated as a tool misread; requirement and decision coverage were confirmed by the checker and `check.decision-coverage-plan` (12/12).

### DC-27: Phases 3-7 fan out to parallel child sessions (supersedes DC-23)

- **Phase / source:** parent, after the user approved parallel sessions on `features/` branches and pushing to origin (2026-11-01).
- **Severity:** Low. **Status:** open.
- **Decision:** Phases 3-7 each run in their own Claude Code cloud session on `features/component-features-phase-{3..7}`, branched from the milestone head `cf00b31` (Phase 1 complete, Phase 2 waves 1-3 merged; Phase 2's last plan finishes on the milestone branch in parallel). Each child runs `gsd-autonomous --only N`, follows `.planning/CHILD-SESSION-BRIEF.md`, keeps its own `P{N}-DC-NN` log in its phase directory, and lists CHANGELOG/README/PROJECT lines as parent lines. The parent merges the branches in the ROADMAP order (7, 6, 4, 3, 5, after Phase 2), runs `npm run check` on each combined tree, applies the parent lines, and folds each phase log into this file. Branch names follow AGENTS.md (`features/*`), not the ROADMAP's unnamed per-phase branches.

### DC-28: Phase 2 executor choices

- **Phase / source:** executors for plans 02-01..02-07 and the parent's post-merge fix.
- **Severity:** Medium for out-of-ownership edits (02-01, 02-03, 02-04) and the worktree hook finding; the rest Low. **Status:** open.

#### 02-01 (listing, description fallback, stored names record)
1. Edited three files outside Phase 2 ownership: `features/plugin/install-dependencies.feature` and `features/plugin/update-dependencies.feature` (expected staged SKILL.md text now includes the record line, with `{home}`/`{project dir}` tokens), and the step "the staged skills directory of the {word} scope holds these files:" in `features/step_definitions/plugin/installation.steps.ts` (now converts sandbox paths to run tokens before comparing).
2. `readSkillRecord` left unexported (fallow fails an unused export); 02-03 and 02-06 add `export` when they import it.
3. A list-valued frontmatter `name` stores no alias (upstream would comma-join it; avoids ESLint `no-base-to-string`); a mapping gives none either way. Upstream list behavior unchecked.
4. Whitespace-containing name stores no alias (planned D-CF2-02 residual).
5. `commandUpstreamNames` treats an un-`lstat`-able command file as no command; a directory error other than missing/not-a-directory now fails during the skills step instead of the commands step.
6. No separate red commit for Task 3 unit tests (hook); the Task 1 cucumber run is the recorded red proof.
7. Listing tables assume Pi's alphabetical order (`/skill:demo-<dir>` before `/skill:demo-skill`).
8. A stage-test input changed to `pluginRoot: "/plugin"` so the expected YAML error excerpt does not depend on the temp path.
- Parent lines: `.agents/skills/cucumber/rules/layout.md` still names `skill/invocation.steps.ts` (now `skill/listing.steps.ts`).
#### 02-05 (skill lifecycle, SKL-06) — pins existing behavior, no product change
1. Idempotency and concurrency not re-proved (left to existing plugin features and the concurrent-install integration test).
2. Uninstall checked through the listing only, no model-side scenario.
3. Update scenarios re-offer the whole plugin at 1.1.0, so both listing rows change and are compared.
4. Tracer gate auto-continued (unattended, no `gate` attribute).
5. The alias half of D-CF2-11 is left to 02-06.
#### 02-02 (frontmatter variants, D-CF2-08 dropped-fields warning)
1. The RED commit guessed a `warning` cascade row; the real row is `info`. The GREEN commit corrected it and the red proof was re-run with the corrected table.
2. No TAP red for unit cases (hook); shown by reverting `stage.ts` locally.
3. D-CF1-09 named in scenario titles by meaning ("because pi cannot hide a skill's slash command"), not by ID.
4. Dropped-field names match case-sensitively (`Model:` is not reported); upstream unchecked.
5. The new system-prompt skill-list step fails when Pi writes no `<available_skills>` block.
6. Only `install` has a scenario for the dropped-fields line, though update/reinstall/enable/apply/cascades also show it (discovery channel).
7. Unit cases use `{kind:"discovery", message}` literals rather than calling `discoveryWarning(...)`.
8. Arbitrary fixture values in the all-eight-fields scenario (keys only are read).
- Environment: a commit attempt was OOM-killed during the hook's parallel lint under load; warming the ESLint cache with a lone `npm run lint` fixed it.
#### 02-04 (name clashes, D-CF2-03/04)
1. Scenario title reworded ("Prompting /demo:clash ...") because the feature gate rejects titles starting with `/`.
2. Expected value edited in out-of-ownership `test/architecture/declared-component-path-overlap.test.ts` (planned, DC-26 item 2).
3. Removed the skills-side `fallow-ignore-next-line code-duplication` marker (its clone group vanished), leaving the commands-side marker at `bridges/commands/discover.ts:314` orphaned in a Phase 3 file; CONVENTIONS.md marker count drifts further.
4. The command check runs before generated-name dedup, so a skipped skill frees its generated name (`clash/` skipped lets `demo-clash/` install); not checked upstream.
5. Names compare exactly, no case folding (research A4, unchecked upstream).
6. Expected model text for `/demo:clash` with no args measured from Pi (`COMMAND CLASH BODY`).
7. MANF-03 trailing-separator unit case: expected `skillDir` lost its trailing separator (skills folder now reached first).
8. No TAP red for unit cases (hook); cucumber red proofs recorded.
- Parent lines: delete the orphaned commands-side clone marker after `npx fallow dupes` passes (Phase 3 or parent); object-map `commands` (FG-13) not clash-checked, re-check at Phase 3; `stage.ts` still calls `commandUpstreamNames` so commands folders are read twice; a commands-dir read error other than ENOENT/ENOTDIR now fails `discoverGeneratedNames` before the ledger opens.
#### 02-03 (skill invocation: substitution, injection, abort; T-01-22/24 closed)
1. Missing peer cache in the worktree filled with `node scripts/install-test-peers.mjs` instead of halting on the precondition.
2. Rule 1 fix: skill directory from `dirname(sourceInfo.path)`, not `sourceInfo.baseDir` (Pi sets `baseDir` to the extension's dir for extension-contributed skills, so "References are relative to" was wrong).
3. Abort origin `commandId: "skill"` is new to JSON consumers; `docs/json-output.md` does not list it yet (parent line).
4. Every non-extension slash token reads `pi.getCommands()`; a bare token loads the alias table for its cwd; a bare alias equal to a Pi built-in is not reserved (DC-25 item 3 residual).
5. `CLAUDE_PROJECT_DIR` set only for project-scope skills; user-scope keeps the literal.
6. Arguments are the trimmed rest of the line after `/^\/(\S+)(?=\s|$)/`; Pi's native expansion splits at the first space only, so a tab/newline after the token behaves differently.
7. The frozen core escapes `` !`cmd` `` in an argument as `` \! `cmd` `` (with a space), not the plan's spelling; tests state the observed text.
8. An acceptance grep (`ThinkingLevel|InputSource` count 0) prints 1 because of the required `pi.getThinkingLevel()` call; no type imported.
9. Exported `readSkillRecord` and rewrote its doc sentence in `skill-names.ts` (outside files_modified).
10. Some Task 2 scenarios passed before the product change (Task 1 shipped substitution); only injection/abort failed first.
11. No WINDOWS.md entry.
- Measured: `${CLAUDE_EFFORT}` is `low` in the profile Pi; the abort payload arrives over RPC immediately; importing the cores did not make any `.fallowrc.json` entry stale.
- **Tooling finding:** inside `.claude/worktrees/...` the commit hook printed "(no files to check)" for `npm run check:commit` and prettier, probably because `.pre-commit-config.yaml`'s top-level `exclude: \.claude/(?!skills/)` matches worktree paths. Executor commits in worktrees may therefore skip the npm-check hook; the post-merge `npm run check` on the main checkout is the backstop.
- Parent lines: Phase 3's `edge/command-invocation.ts` handler now receives text starting with `<skill name=` after a successful skill invocation and must ignore text not starting with `/` (Pitfall 10).
- **Post-merge gate fix (parent, wave 2):** `test/orchestrators/plugin/discover-names.test.ts` (outside Phase 2) failed after merge because its fixture gave a plugin same-named commands and skills, which D-CF2-03 now shadows; the parent renamed the fixture skills (`alpha-guide`, `zeta-guide`) in commit b89e2e3. Plan 02-04 had not run the full unit suite.
#### 02-06 (skill aliases from stored names, TUI Tab completion)
1. `loadQualifiedSkillAliases` takes `Partial<SkillAliasDependencies>` merged over defaults.
2. TUI readiness text is `[Extensions]` (Pi prints it after binding extensions and installing autocomplete); breaks if a future Pi stops printing its loaded-resource list.
3. The step relies on the trailing space Pi's completion adds before typing `Ada`.
4. The step waits for the `→ ` menu marker then the redrawn prefix.
5. TUI scenario omits the "new RPC session" Given (fresh Pi process).
6. Shared-name rule split into two scenarios (bare, qualified) with a Background.
7. Command-clash, unclaimed, disable and enable scenarios pass on the old loader too (guards).
8. The legacy shortened-alias fallback also covers a malformed or hand-removed record.
9. Bare-alias claims across two plugins and case sensitivity not checked upstream (loader order, exact match).
10. Hook skipped in the worktree; agent ran check:static, test:modules and full `npm run check` (1219 scenarios).
- Parent lines: CHANGELOG "Skill aliases now match Claude Code: `/<plugin>:<skill dir>`, `/<plugin>:<frontmatter name>`, and the bare `/<frontmatter name>`. The shortened alias with the plugin prefix cut from the directory name (such as `/acme:foo` for `acme-foo`) is gone; skills installed before this release keep it until you update or reinstall their plugin."; PRD SK-6 wording update.
#### 02-07 (phase gate, Pi gap report, parent lines)
1. One SUMMARY commit for three SUMMARY-only tasks.
2. Stale code-duplication markers left in place (cover no clone group): `bridges/skills/stage.ts:496`, `bridges/commands/stage.ts:276`, `bridges/commands/discover.ts:314`; CONVENTIONS.md counts stale (says 41 total / 30 code-duplication; real 47 / 29). Parent decides.
3. All six `.fallowrc.json` `dynamicallyLoaded` and core `ignoreExports` entries can be removed now (measured: `npm run fallow` exits 0 without them); SUMMARY keeps "after Phase 3" as main advice.
4. CHANGELOG lines omit the 100-char cut, the `when_to_use` fold, and non-install verbs showing the dropped-fields warning; invocation change split into two sub-bullets.
5. Invented README example `name: baz`.
6. `docs/env-vars.md` calls `CLAUDE_SESSION_ID` pi-only, but `${CLAUDE_SESSION_ID}` in skill content is a Claude Code token; flagged for the parent's wording.
7. Decision-row outcomes: D-CF2-10 "Pending (user files)", D-CF2-12 "Good", the rest "Locked".
8. Pi gap report proposals are the agent's own; tracker URL from the SSDEDUP-01 backlog entry. Drafted, not filed.
9. `${CLAUDE_EFFORT}` = `low` measured with the faux model only.
- Gate (cf00b31, wrapper): `npm run check` exit 0 (cucumber seed 239193, 1219/1219); `test:cucumber` twice 1219/1219 (seeds 986925, 847603); `fallow dupes` exit 0.

### DC-29: Phase 2 security, validation, and code review

**Decision for the user to review: D-CF2-13, taken by the parent without asking.** Review round 2 found that a cloned repository can ship its own staged skills under `.pi/pi-claude-marketplace/` and get `!` commands run when the user types one of those skill names. Pi 1.4.0 trusts such a project on its own (no trust-requiring files), and `state.json` sits in the same repository-controlled folder. The parent ported Claude Code's model: a user-scope record of project installs (`<agentDir>/pi-claude-marketplace/project-installs.json`, keyed by the real project path, with the SHA-256 of each staged `SKILL.md`). A project-scope skill with no matching entry gets no alias and aborts before any `!` command runs. This mirrors upstream `installed_plugins.json` and its `not_installed_here` skip.

#### secure-phase: 21 threats, 0 open (17 mitigated, 4 accepted AR-02-01..04)
1. The runner had no Agent tool, so the auditor work ran inline (allowed at ASVS L1).
2. Plain `git commit` instead of the GSD helper, whose `docs(phase-02)` title the commit rules forbid.
- T-01-22/T-01-24 are closed for skills; commands stay open until the Commands phase wires `edge/command-invocation.ts`.

#### validate-phase: compliant, 0 gaps
1. Reused the 02-07 gate plus targeted reruns; no full re-run.
- Manual-only: filing the Pi gap report (user); `shell: powershell` and the Windows "requires bash" path (unit-tested only); typed `${CLAUDE_PLUGIN_ROOT}` argument (unit-tested only).

#### Code review round 1 (1 blocker, 3 warnings, all fixed with scenarios and red proofs)
Indented `---` fence; record-key spellings; stale staged file falling through to Pi's expansion; untrusted project running `!`.

#### Code review round 2 fixes (CR-01, WR-01..03)
1. **The provenance ledger is written without a lock.** (Superseded: DC-30 item 4 moved it to one file per project, written under the project's state lock.) The skills bridge cannot import `transaction/`. Two concurrent project installs in different projects can lose one update; the failure is closed (that project's skills abort and ask for a reinstall).
2. **Discovery still lists a project skill with no ledger entry** in a project Pi trusts, so the abort message can name it. The model can still read its description and body, which upstream `not_installed_here` would hide. Same prompt-injection exposure as `AGENTS.md`.
3. **Existing project installs lose their skills until reinstalled.** A project-scope skill staged before this change has no ledger entry. Plain `apply` does not re-stage it; the user runs `/claude:plugin reinstall <plugin>@<marketplace> --scope project`. The CHANGELOG records this.
4. The provenance scenario models a clone by deleting the user ledger rather than forging `state.json`.
5. After WR-01 (discovery gated on `ctx.isProjectTrusted()`), the "Pi does not trust" abort is reachable only after a trust change within a session; unit tests cover it, no scenario. `features/skill/project-trust.feature` was rewritten because the behavior changed.
6. `topLevelNodeIndex` falls back to the plain `<key>:` spelling for a node that does not parse alone; as a side effect a record key written as a YAML alias is now replaced instead of failing the install.
7. `test/index.test.ts` answers `isProjectTrusted()` with `anyTimes()` in the shared helper.
8. Files outside Phase 2 touched: `index.ts`, `orchestrators/discover.ts`, and their tests; `install-flow-ledger.test.ts`.
- Parent line: the hooks bridge has the same pre-existing exposure; the Hooks phase should adopt the same provenance check.

### DC-30: Phase 2 code review round 3

**Decision for the user to review: D-CF2-14, taken by the parent without asking.** Round 3 showed that project-scope autoapply (AAP-01) let a load install a repository-declared plugin and write the D-CF2-13 ledger itself, so the skill's `!` commands ran on the next session. A load with autoapply on now applies the user scope only, whichever file turned the setting on, and shows the project scope's pending block. An explicit `/claude:plugin apply` still applies both scopes. Pi 1.4.0 gives the extension only `isProjectTrusted()`, which is also true for an auto-trusted project, so a load cannot tell explicit trust apart and never changes the project scope. Upstream parity: Claude Code needs the trust dialog and an install prompt. This changes AAP-01 behavior.

#### Fixer choices (10 findings fixed, each with a red/green proof; IN-04 and IN-05 left to the parent)
1. **D-CF2-14 scope:** reading Pi's `trust.json` directly was judged not an allowed route. A repository's project config can still turn on load-time apply for the user scope; how AAP-01 resolves the setting is unchanged. Users who explicitly trusted a project also lose load-time project apply. Re-exporting Pi's `ProjectTrustStore` through `platform/pi-api.ts` would restore it (parent line).
2. **D-CF2-14 ordering:** the user-scope apply now runs before the project's read-only pass, so the output is the apply cascade, then the project pending block. This departs from project-first ordering (MSG-GR-3), to keep one pending block when the apply step throws.
3. **IN-01:** `? name` followed by `: x` is read as `name` and rewritten, not refused, because Claude Code reads it that way.
4. **IN-06:** the ledger is now one file per project, `<agentDir>/pi-claude-marketplace/project-installs/<sha256(realpath)>/skills.json`, written under that project's state lock. This replaces DC-29 item 1 (the unlocked writer). It relies on every writer holding the lock (install-outcome, update-swap, `cascadeUnstagePlugin` checked). No migration: the D-CF2-13 layout was never released.
5. **WR-02:** an unreadable or unknown ledger now fails the write with `ProjectSkillLedgerError`. An `update` or `reinstall` against it reports "failed during physical replace"; the new files stay unrecorded and fail closed. No scenario.
6. **WR-03:** the digest covers every file and symlink in the staged skill directory, checked again at use time. Plugin-root files outside the skill directory and link targets stay unhashed (accepted risk; needs a threat-register ID). The provenance Background's skill now runs `sh ${CLAUDE_SKILL_DIR}/status.sh`, which assumes `sh`.
7. **WR-04:** uninstall, disable, and `marketplace remove` show the skills ledger warning as one `diagnostic` per plugin, header "N cleanup warning(s)" (wording invented). The install undo, cascade undo, orchestrated, and partial-failure arms still drop it.
8. **WR-05:** a frontmatter node holding the key with other keys (flow mapping) fails the install again, naming the skill, line, and keys. A writer called outside staging gives a generic message.
9. No scenario for IN-01, IN-02, or IN-06 (no user-visible change). The IN-06 FIFO unit test uses `mkfifo` (Linux/macOS only).
10. All findings marked "fixed"; the logic changes in WR-05, IN-01, and CR-01 may still deserve a human read.
- Parent lines: D-CF2-13/14 into CONTEXT and PROJECT; CHANGELOG lines (AAP change; existing project installs need a reinstall); the hooks phase adopts the per-project ledger; IN-04 update and enable scenarios; maybe a `docs/output-catalog.md` entry for the new diagnostic header.

#### verify-phase: human_needed, 4/5 (criterion 5 needs the user to file the Pi gap report)
1. `human_needed`, not `passed`: criterion 5 says the gap "is reported to Pi"; D-CF2-10 makes the filing the user's. `phase.complete` refuses until `/gsd-verify-work 02`; the parent recorded `verification_deferred_human` in STATE.md and continued rather than stop autonomous mode.
2. Path variables in a skill body (other than `${CLAUDE_SKILL_DIR}` inside a `!` command) are proven only by the verifier's throwaway probe, not a committed scenario.
3. Reused the parent's gate log (3bfaab5, exit 0) by timestamp.
4. Edits outside Phase 2's ownership list (`load.ts`, `uninstall.ts`, `enable-disable.ts`, `marketplace/{remove,shared}.ts`, `features/plugin/autoapply.feature`, `index.ts`) rated Info; re-verify after the Phase 3 and 5 merges. `index.ts` also withholds project prompt paths in an untrusted project, which affects Phase 3 (told).
5. `02-SECURITY.md` predates the review rounds: no entry for the ledger, D-CF2-14, or the WR-03 residual.

#### Parent lines (docs, decisions, scenarios)
1. Stale clone markers removed in the commands bridge too (Phase 3 files), since the merged tree confirms them; expect small conflicts when Phase 3 merges.
2. CHANGELOG adds a line no parent line asked for (untrusted-project discovery also leaves out prompt templates); the autoapply and reinstall lines are reworded.
3. PROJECT.md rows for D-CF2-01..14 are shortened; measured residuals stay in 02-07-SUMMARY and 02-CONTEXT. D-CF2-13/14 use a new outcome value, "Pending (user review)".
4. Threat IDs T-02-21..23 continue the register; T-02-23 is accepted as AR-02-05. T-02-17's row was not widened to match the code's use.
5. `docs/json-output.md` lists all three skill abort causes (untrusted project, unreadable file, missing install record).
6. README tables applied with the invented `name: baz` example from 02-07. No `docs/output-catalog.md` entry: the catalog lists no staging diagnostic headers.
7. CONVENTIONS marker listing corrected for pre-existing markers too (42 total, 24 `code-duplication`).
- Gate after these commits (7e5240e): `npm run check` exit 0, cucumber 1254/1254 (seed 311675).

### DC-31: Phase 7 (Workflows), merged at a28489b

Full entries: `.planning/phases/07-workflows/DUBIOUS-CHOICES.md`, P7-DC-01..17 (one High, eight Medium, eight Low). The child session ran discuss, plan, execute, three review rounds, and verification (passed 5/5) on `features/component-features-phase-7`. No production code changed.

**For the user to review first:**
1. **P7-DC-03 (High), D-CF7-01:** Pi runs a plugin workflow with no approval prompt. Claude Code asks first in manual mode. Neither the engine nor Pi gives the bridge a hook, so this is recorded as a Pi gap and the bridge adds nothing.
2. **P7-DC-02, D-CF7-02:** the engine passes typed arguments as an object `{_, _raw, key=value}`; Claude Code passes one string. Pinned as is.
3. **P7-DC-04, D-CF7-03 / D-CF7-04:** the bridge refuses nondeterministic or unparseable scripts at install (upstream registers them and fails at run), and installs a script with a bad `meta` with a warning (upstream skips it at load).
4. **P7-DC-06/13/16, WFL-04:** "engine loaded later, then `/reload`" is proven by adding the engine to Pi's settings and starting a new session, because over RPC `/reload` goes to the model. The verifier accepted it.
5. **P7-DC-15:** engine 3.15.0 never posts a run's result back over RPC and warns once per session; six run scenarios pin that warning.
6. **P7-DC-05:** commit trailers name the child session's link, not the parent's.
7. **P7-DC-17:** the child skipped the transition's PROJECT.md step; the parent adds D-CF7-01..04 and moves WFL-01..05 to Validated.
- Merge: clean auto-merge; the parent restored STATE.md's position block, which the child's copy had overwritten.

#### Phase 7 parent lines (applied by the parent at 12227bb..0b23370; `npm run check` exit 0, 1290/1290, seed 632189)
1. D-CF7-01..04 rows shortened like the D-CF2 rows, outcome kept `-- Locked`; WFL-01..05 moved to Validated.
2. The wrong install note ("the engine will refuse to load it", `bridges/workflows/discover.ts`) is user-visible but recorded as WFLNOTE-01, not fixed, because rewording it touches tests, the output catalog, and `refusals.feature`.
3. IN-08 (`field-rows.ts` join, 44 uses) and the world-side half of IN-06 went to BACKLOG (WFLHARNESS-01). IN-02 was applied: `DIALOG_METHODS` exported once from `features/lib/pi-process.ts`, which touches files frozen during the component phases; later sibling merges may conflict there.
4. IN-10 wording: "a `Then` that compares the whole of what a turn reports marks it compared"; the notices step still marks a run turn compared, which is arguable.
5. `layout.md` now lags ROADMAP's ownership paragraph by the extra Phase 7 test files.
6. Advisory review items IN-01/03/04/07/09 are not in BACKLOG (no parent line).

### DC-32: Phase 6 (MCP Servers), merged at e3a003d

Full entries: `.planning/phases/06-mcp-servers/DUBIOUS-CHOICES.md`, P6-DC-01..22. The child session ran discuss, plan (9 plans, 4 waves), execute, security (22/22 closed), validation, one review round (8 warnings, 7 fixed) and verification: **human_needed, 4/5**. The parent merged it without closing the phase and recorded `verification_deferred_human` in STATE.md.

**For the user to decide (blocks `/gsd-verify-work 06`):**
1. **D-CF6-10, SC4 / MCP-07:** no scenario shows an agent calling a plugin's MCP tool. pi-subagents 0.84.0 refuses it in a foreground run (`Unresolved MCP direct-tool selectors: ...`), and background children in the harness load neither the companions nor the scripted model (BACKLOG MCPBG-01). The refusal is pinned as a recorded gap. Accept the pin (override with your name) or reject it (needs a pi-subagents change and harness work).
2. **Symlinks in referenced MCP files (WR-01, WR-02):** a referenced `mcpServers` file refuses any symlink, even one inside the plugin root (MCPR-04, NFR-10). Claude Code follows it. The root `.mcp.json` follows symlinks anywhere, as upstream does. The refusal note says "escapes plugin root" for an in-root link, which is wrong either way.

**Behavior changes made for upstream parity (review these too):**
3. **P6-DC-01, D-CF6-01:** servers from `.mcp.json` and declared `mcpServers` now merge, later same-name wins. This replaces PRD MC-1 ("first match wins, no merge").
4. **P6-DC-02/07/18, D-CF6-02:** a malformed server in a file, or a missing, unparseable, or unreadable file source, is now skipped silently (debug log only); the plugin installs with the rest. Inline malformed servers and escaping references stay fatal. A permission-denied file is skipped instead of reported `{permission denied}`, and a transient read error (EMFILE, EIO) skips servers that a later update, apply or reload then removes (WR-03).
5. **P6-DC-03, D-CF6-03:** project-scope plugin servers keep pi-mcp-adapter's project approval; Claude Code never asks.
6. **P6-DC-07 item 5:** a reference without `./` stays installable; upstream refuses the manifest.
- Also unfiled: a drafted pi-subagents gap report (user's call). Parent lines pending: CHANGELOG, PRD MC-1..4, PROJECT D-CF6-01..11, four BACKLOG items, output-catalog and hooks-compatibility docs, the canary re-run on 7.0.0, cucumber skill notes, the migration message rewording.
- Merge: ROADMAP and STATE conflicts in the tracking tables only; the parent kept the milestone view.
