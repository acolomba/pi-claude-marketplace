---
phase: 07-workflows
plan: 06
subsystem: docs
tags: [workflows, compatibility, claude-code-2.1.316, phase-gate, parent-lines]
status: complete

requires:
  - phase: 07-workflows
    provides: "the five feature files under features/workflow/ (plans 07-01..07-05), which the doc records cite"
provides:
  - "docs/workflows-compatibility.md: D-CF7-01..04 with the Claude Code 2.1.316 side, an evidence grade on each claim, and the feature file that pins each one"
  - "the phase gate evidence on the combined Phase 7 tree"
  - "four ready-to-paste PROJECT.md Key Decisions rows and the parent lines for the merge"
affects: [parent-merge]

actuals:
  tokens: 17000
  tasks: 3
  commits: 2
plan_head_before: af6799c5aa76c7d607b16bc10ce39c0930b17acf
plan_head_after: 3042c06bf4aafb8e177492d47f155fa9969caa15

tech-stack:
  added: []
  patterns:
    - "A compatibility-doc claim measured by a cucumber scenario carries the grade `scenario-measured at 3.15.0` and names its feature file"

key-files:
  created:
    - .planning/phases/07-workflows/07-06-SUMMARY.md
  modified:
    - docs/workflows-compatibility.md

key-decisions:
  - "D-CF7-01: no run approval before a plugin workflow runs, a Pi gap (run.feature)"
  - "D-CF7-02: the engine's argument object, where Claude Code passes one string; a divergence licensed by a Pi-side gap (run.feature)"
  - "D-CF7-03: nondeterministic and unparseable scripts refused at install, where Claude Code registers them and fails them at run; a project decision (refusals.feature)"
  - "D-CF7-04: scripts Claude Code skips at load install here with a note and the engine refuses them at run; licensed by WGATE-03 (refusals.feature)"
  - "The `export let`/`export var` and second-declarator rows were read from the 2.1.316 binary in this plan: Claude Code skips both at load"

requirements-completed: [WFL-01, WFL-02, WFL-03, WFL-04, WFL-05]

duration: 28min
completed: 2026-11-01
---

# Phase 7 Plan 06: Workflow decisions, parent lines, and the phase gate Summary

The workflows compatibility doc now records D-CF7-01 (no run approval, a Pi gap), D-CF7-02 (the engine's argument object against Claude Code's one string), D-CF7-03 (refused at install, where Claude Code fails at run), and D-CF7-04 (installed with a note, where Claude Code skips at load), each with the Claude Code 2.1.316 side, its evidence grade, and the feature file that pins it; the combined Phase 7 tree passes the phase gate.

## Performance

- Duration: about 28 min (from about 14:45Z to 15:13Z on 2026-11-01; the gate took 17 min of it)
- Tasks: 3 of 3
- Files: 1 modified, 1 created

## Accomplishments

`docs/workflows-compatibility.md`:

- Evidence: the opening paragraph names the 2.1.316 binary (the workflow command module and the plugin-workflow loader, read 2026-11-01); the grade list adds `read from the 2.1.316 binary` and a new grade, `scenario-measured at 3.15.0`, for what a `features/workflow/` scenario measures against engine 3.15.0 and Pi 1.4.0.
- D-CF7-01: a new subsection "Approval before a run" under "Naming", with a one-row table and the record (documented upstream; read from the 2.1.316 binary; pinned by `features/workflow/run.feature`).
- D-CF7-02: the `args on a slash invocation` row now says `one string` for Claude Code (was `structured`) and `⚠` for Pi (was `--`), quotes the typed-text instruction (read from the 2.1.316 binary; MEDIUM for what the script receives), and gives the two measured objects (`features/workflow/run.feature`).
- D-CF7-03: a record under "Per-file refusal" in "Install-time disposition" (read from the 2.1.316 binary; documented upstream; `features/workflow/refusals.feature`).
- D-CF7-04: the "Admit-versus-run divergence" table gains a `Claude Code 2.1.316` column and a reserved-key row; a paragraph states how the 2.1.316 loader's `meta` parser decides each row, and the D-CF7-04 record names WGATE-03, the engine's fallback description, the engine's run-time notice, and the inaccurate `will refuse to load it` wording (`features/workflow/refusals.feature`). The "Installed with a caveat" bullet points to it.
- Pins of existing records: WNAM-06 and meta-name naming cite `features/workflow/listing.feature`; the lingering command cites `features/workflow/lifecycle.feature` (uninstall, disable, and a renaming update report `stale workflow command`; the engine's notice answers the command); "When the host engine is absent" cites `features/workflow/companion-missing.feature`, with the settings `packages` entry and a new session standing in for `pi install` and `/reload`.

Acceptance greps after the commit: `D-CF7-01` 2, `D-CF7-02` 1, `D-CF7-03` 1, `D-CF7-04` 2, `2.1.316` 7, `features/workflow/` 9, `| structured |` 0, U+2014 0. `pre-commit run --files docs/workflows-compatibility.md`: mdformat reflowed the tables on the first pass, and the second pass changed nothing (all hooks passed).

### Upstream read made in this plan

The plan asked for the `export let` / `export var` and second-declarator rows to be read or marked `not read`. Both were read offline from `/opt/claude-code/bin/claude` (2.1.316, never run), function `hk` at byte offset 296951858, and the loader's skip at offset 296965280 (`Plugin workflow ${o} has invalid meta: ${n.error} — skipping`). With `validateBody: false`, `hk` tries the regex `^<space or comments>export\s+const\s+meta\s*=\s*(?=\{)`; a literal object that ends in `,` (a second declarator) fails the follow-up check, and `let`/`var` fail the regex. The fallback parses the whole script with acorn and requires `body[0]` to be an `ExportNamedDeclaration` whose declaration is `kind === "const"` with `declarations.length === 1`, an `Identifier` named `meta`, and an `ObjectExpression` initializer; otherwise it returns the "must be the FIRST statement" error. So Claude Code skips both shapes at load. Grade: read from the 2.1.316 binary.

## Gate evidence

Run on the combined Phase 7 tree at commit `76edb52` (Task 1's commit; Task 2's commit `3042c06` added only this SUMMARY under `.planning/`, which no gate reads), in the executor worktree, as root through the `nondac-sh` wrapper with `NODE_OPTIONS=--max-old-space-size=6144`. `node --version`: `v24.22.1`. ESLint was warmed first with a lone `npm run lint` (exit 0). Each command ran alone, in this order; logs are in the executor scratch folder `exec-07-06/gate-*.log`.

| Command | Exit | Time | Result |
| --- | --- | --- | --- |
| `npm run lint` (warm-up) | 0 | -- | clean |
| `npm run check` | 0 | 510 s | `check:static` passed (typecheck, lint, lint:workflows, fallow, format:check, test:corresponding, check:features); `test:unpaired` and `test:integration` passed; `test:cucumber`: `Random order using seed: 486945`, 1250 scenarios (1250 passed), 12996 steps (12996 passed), 16 hooks passed; `test:coverage:direct:all` passed and merged `coverage/direct.lcov` (318 records) |
| `npm run test:modules` | 0 | 177 s | the whole unit suite; the quiet reporter prints only failures, and it printed none |
| `npm run test:cucumber` | 0 | 172 s | `Random order using seed: 38213`, 1250 scenarios (1250 passed), 12996 steps (12996 passed) |
| `npx cucumber-js features/workflow` (run 1) | 0 | 50 s | `Random order using seed: 245657`, 32 scenarios (32 passed), 386 steps (386 passed) |
| `npx cucumber-js features/workflow` (run 2) | 0 | 49 s | `Random order using seed: 674263`, 32 scenarios (32 passed), 386 steps (386 passed) |
| `npx cucumber-js features/workflow` (run 3) | 0 | 49 s | `Random order using seed: 117957`, 32 scenarios (32 passed), 386 steps (386 passed) |
| `npx fallow dupes --fail-on-issues --format human --quiet` | 0 | 1 s | no clone group |
| `npx cucumber-js features/workflow --dry-run` | 0 | 6 s | `Random order using seed: 347564`, 32 scenarios (32 skipped); five features: `lifecycle` 11, `refusals` 8, `companion-missing` 4, `listing` 4, `run` 5 |

The test output also holds the sanctioned IL-3 `Legacy marketplace migration could not be persisted ...` lines, which unit tests provoke on purpose; they are not failures. No test failed in any run, so no fix and no pre-existing-failure analysis was needed. No test was skipped or disabled.

## Decision records

Ready-to-paste PROJECT.md Key Decisions rows (the D-CF1 format: decision and detail, rationale with the upstream evidence and its grade, outcome):

| **D-CF7-01 (component-features, Phase 7, settled autonomously, DUBIOUS-CHOICES P7-DC-03, P7-DC-08): Pi asks no approval before a bridged plugin workflow runs**. The workflow engine registers each saved workflow as a Pi command whose handler starts the run when the command is typed, and Pi gives this extension no hook before that handler; the bridge writes envelopes and does not own the command. No product change. Pinned by `features/workflow/run.feature`, whose run step fails on any dialog during a run. | Claude Code asks before it runs a bundled, saved, or plugin workflow by name in manual and accept-edits permission modes, unless the user chose "don't ask again", and `claude -p` and the Agent SDK apply the permission rules `Workflow` and `Workflow(<name>)` (documented upstream, code.claude.com/docs/en/workflows "Approve the plan before it runs", fetched 2026-11-01). In the 2.1.316 binary a workflow command is a `type:"prompt"` command that asks the model to call the Workflow tool, so the approval sits on the tool's permission path (read from the 2.1.316 binary). HIGH: docs and binary agree. Licensed by a Pi capability gap. A pre-run approval hook is an engine request (BACKLOG). | -- Locked |
| **D-CF7-02 (component-features, Phase 7, settled autonomously, DUBIOUS-CHOICES P7-DC-02, P7-DC-06): text typed after a bridged workflow command reaches the script as the engine's argument object**. The engine's slash path splits the typed text on whitespace: each `key=value` token becomes a key, the other tokens joined by one space become `_`, and the trimmed text becomes `_raw` (`/demo:echo first second who=Ada` gives `{"who":"Ada","_":"first second","_raw":"first second who=Ada"}`, and `/demo:echo` gives `{"_":"","_raw":""}`). A divergence licensed by a Pi-side gap. Pinned by `features/workflow/run.feature`. | Revised after research: in the 2.1.316 binary a plugin workflow command tells the model `Invoke: Workflow({ name, args: "<typed text>" })`, so Claude Code's `args` is the trimmed text as one string, or absent when nothing is typed (read from the 2.1.316 binary, HIGH for the instruction text; MEDIUM for what the script finally receives, because the model makes the call). The engine owns the command and its argument parsing, and the bridge copies script bytes verbatim, so this extension can change neither. A raw-string `args` mode is an engine request (BACKLOG). | -- Locked |
| **D-CF7-03 (component-features, Phase 7, settled autonomously, DUBIOUS-CHOICES P7-DC-04): a nondeterministic or unparseable workflow script is refused at install**. The bridge refuses a script that its vendored determinism blocklist matches (`Date.now()`, `Math.random()`, `new Date()`) or that acorn cannot parse, names the file in a warning, and installs the rest of the plugin. Pinned by `features/workflow/refusals.feature`. | Claude Code's plugin loader reads only `meta` at load (`validateBody: false`), so it registers these scripts and they fail when they run (read from the 2.1.316 binary; documented upstream: `Date.now()` throws inside the script, and a body syntax error is reported when the workflow runs). HIGH. Licensed as a project decision: the bridge writes executable code into another extension's storage, a refused file costs its author nothing to fix, and the engine refuses both scripts at its checks 1 and 2 before any run, so only the timing differs. Admitting them for a run-time refusal is the parity option (BACKLOG). | -- Locked |
| **D-CF7-04 (component-features, Phase 7, settled autonomously, DUBIOUS-CHOICES P7-DC-06): a workflow script that Claude Code skips at load installs with a note, and the engine refuses it at run**. The six engine checks the bridge warns about (`meta-not-first-export`, `meta-not-const-export`, `meta-not-sole-declarator`, `meta-not-named-meta`, `meta-not-pure-literal`, `meta-fields-invalid`) install the script with a warning; the engine registers the command (with `Saved workflow: <plugin>:<name>` as its description when `meta.description` is missing) and, when the command runs, shows `/<plugin>:<name> failed: <message>` and starts no run. Pinned by `features/workflow/refusals.feature`. | Revised after research: Claude Code 2.1.316's loader skips these scripts at load with `Plugin workflow <file> has invalid meta: <error> -- skipping` and registers no command, for a `meta` that is not first, `export let`/`export var`, a second declarator, a reserved key, and a missing description (read from the 2.1.316 binary; documented upstream: such a script drops out of `/` autocomplete). HIGH. Licensed by WGATE-03 (a gate warning never refuses a script, so an engine that relaxes a rule costs one spurious line, not a blocked install). Skipping these scripts at install for parity is a BACKLOG option. | -- Locked |

## Parent lines

Each line is ready to apply at the merge. Phase 7 changed none of these files.

### `CHANGELOG.md`

A sub-bullet under the component-features entry at the top of `## [Unreleased]` (no Phase 7 plan reports a product fix, so there is no reader-facing behavior line):

```markdown
  - Internal: behavioral tests now cover plugin workflows, from the command list and runs to refused scripts, a missing engine, and uninstall.
```

### `README.md`

None. The README's workflow lines (line 30, which links `docs/workflows-compatibility.md`, and line 41, the engine floor 3.15.0) stay accurate, and the linked compatibility doc carries D-CF7-01 to D-CF7-04.

### `README.es.md`

None, for the same reason: lines 30 and 41 match the English lines, and the linked doc carries the records.

### `.planning/PROJECT.md`

The four Key Decisions rows under "Decision records" above, appended after the last component-features row.

### `.planning/BACKLOG.md`

- The workflow install note `workflow script "<file>" in "workflows" was installed but the engine will refuse to load it: ...` is inaccurate: the engine registers (loads) the command and refuses the script only when it runs. The text lives in `extensions/pi-claude-marketplace/bridges/workflows/discover.ts`; rewording it also touches `test/orchestrators/plugin/{install-flow-ledger,reinstall-flow,info}.test.ts`, `docs/output-catalog.md` (and its closed-set counters), and `features/workflow/refusals.feature` (the scenario "Installing a plugin installs a script the engine will refuse with a note, where Claude Code skips it at load"). Reported by 07-02 (P7-DC-10).
- Parity option for D-CF7-04: skip the scripts the six warned checks name at install, as Claude Code 2.1.316 skips them at load, instead of installing them with a note. A product change in `domain/workflow-script.ts` and `bridges/workflows/discover.ts`, with fallout in non-Phase-7 orchestrator tests and `docs/output-catalog.md`; it would revisit WGATE-03.
- Parity option for D-CF7-03: admit nondeterministic or unparseable scripts and let the engine refuse them when they run, as Claude Code registers them and fails them at run.
- Engine request for D-CF7-01: a pre-run hook (or approval option) in `@quintinshaw/pi-dynamic-workflows` so a host can ask before a saved workflow runs.
- Engine request for D-CF7-02: a raw-string `args` mode for the slash path, so a script written for Claude Code receives the typed text as one string, or `undefined` when nothing is typed.
- The workflow listing step in `features/step_definitions/workflow/listing.steps.ts` assumes no engine built-in command name holds a colon (RESEARCH assumption A3, verified for the eleven built-ins of engine 3.15.0); a later engine that adds one breaks the whole-table comparison loudly.

### `.agents/skills/cucumber/rules/world-and-stand-ins.md` (frozen)

Replace the workflow run bullet (line 68) with:

```markdown
- A workflow run does not use the model-turn `When`. `the user runs the workflow command {string}` waits for the terminal `pi-dynamic-workflows:progress` entry in Pi's session, because workflow results do not come back over RPC. It fails when the scripted model is called during the run. A command the engine refuses before a run writes no progress entry: `the user runs the workflow command {string}, which starts no run` reads Pi's records up to its answer and fails on any progress entry, and `the workflow engine shows these notices:` compares the engine's notices, with U+2014 read as `--`.
```

### `.agents/skills/cucumber/rules/layout.md` (frozen)

Keep the Workflows row of the seed table (line 76) as it is, with `runs.steps.ts` as the seed step module, and add below the table:

```markdown
For workflows, `runs.steps.ts` stays the seed module and `features/step_definitions/workflow/listing.steps.ts` is the shared topic module (the listing `Then` steps, the no-run `When`, and the notices `Then`). The shared record helpers `progressOf`, `WorkflowCommandTurn`, and `sendWorkflowCommand` live in `features/lib/workflow-files.ts` beside the fixture writer.
```
### `.planning/ROADMAP.md`

In the "File ownership" paragraph after the table: Phase 7 also owns `test/integration/workflow-kind-inversion.test.ts`, which the `test/integration/<kind>-*` rule (`workflows-*`) does not match, and the unit pairs `test/domain/workflow-script.test.ts`, `test/domain/workflow-project-key.test.ts`, and `test/platform/workflow-home.test.ts`. Phase 7 edited none of them.

### Non-owned test edits made by this phase

None. `git diff --stat 3a7a707..HEAD -- . ':!.planning'` lists only `features/workflow/*.feature`, `features/step_definitions/workflow/*.steps.ts`, `features/lib/workflow-files.ts`, and (this plan) `docs/workflows-compatibility.md`.

### Notes for Phases 4 and 6

Pi's RPC mode cannot run the `/reload` builtin: a prompted `/reload` goes to the model. To load a companion after an install, add its package root to `<agentDir>/settings.json` `packages` and start a new session, as `features/step_definitions/workflow/companion-missing.steps.ts` does. Merge into the existing file: every profile Pi already has `{"retry":{"enabled":false}}` there (the frozen `usePiWithProfile` sends `set_auto_retry`), so a `wx` write fails; restore the exact text at release (P7-DC-13).

### Dubious choices

The phase log is `.planning/phases/07-workflows/DUBIOUS-CHOICES.md` (P7-DC-01..P7-DC-13). The plan SUMMARYs reported: 07-01 (P7-DC-09), 07-02 (P7-DC-10), 07-03 (P7-DC-12), 07-04 (P7-DC-13), 07-05 (P7-DC-11); all are already in the log. This plan's entries are in the report to the orchestrator under "Dubious Choices", for the orchestrator to append as P7-DC-14.

## Task Commits

1. Task 1 (tracer), the compatibility doc: `76edb52` docs(workflows): record the workflow divergences from Claude Code
2. Task 2, decision rows and parent lines: `3042c06` docs: hand over the workflow decision rows and parent lines
3. Task 3, the phase gate: the commit that adds the gate evidence to this SUMMARY (`docs: record the workflow phase gate results`)

`commits: 2` is measured with `git rev-list --count af6799c..3042c06` before the Task 3 commit, which carries this SUMMARY's final text.

Tracer gate (Task 1): auto mode off and `human_verify_mode` at its `end-of-phase` default with an automated-only `<verify>`, so the gate re-ran the verify (the four IDs present; `pre-commit run --files docs/workflows-compatibility.md` passed with no fixer change) and continued.

## Decisions Made

- Every Claude Code 2.1.316 cell in the admit-versus-run table is graded "read from the 2.1.316 binary", including the `export let`/`export var` and second-declarator rows read in this plan; no row says `not read`.
- A new evidence grade, `scenario-measured at 3.15.0`, names claims that a `features/workflow/` scenario measures, so the doc keeps a source read, a canary run, and a scenario apart.
- The args row's Pi cell becomes `⚠` (the args arrive, in another shape); the old advice to invoke "structured" scripts through the engine's tool was removed, because its premise (Claude Code's `args` is structured) was wrong.
- A reserved-key row joins the admit-versus-run table, since D-CF7-04 names it and the table had none.

## Deviations from Plan

None - plan executed exactly as written. Two notes, not deviations:

- The plan's scratch folder name was `07-06/`; the orchestrator's prompt named `exec-07-06/`, which this plan used.
- The doc's quotes of the engine's stale-command notice and Claude Code's skip warning write `--` where the real text holds U+2014, because the commit hook rewrites that character outside `.planning/`; the doc already quoted the skip warning that way.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## Next Phase Readiness

Phase 7 is ready for verification and the merge: the parent applies the lines above. ROADMAP Phase 7 criteria 1-5 are each proven by a feature file under `features/workflow/` (listing, run, refusals, companion-missing, lifecycle).

## Self-Check: PASSED

- FOUND: docs/workflows-compatibility.md, .planning/phases/07-workflows/07-06-SUMMARY.md
- FOUND commits: 76edb52, 3042c06 (ancestors of HEAD)
- `git diff --name-only af6799c..3042c06` lists only the two plan files; `git diff --quiet af6799c..HEAD -- CHANGELOG.md README.md README.es.md .planning/BACKLOG.md .fallowrc.json` exits 0
