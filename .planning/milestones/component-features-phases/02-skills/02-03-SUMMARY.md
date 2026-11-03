---
phase: 02-skills
plan: 03
subsystem: skills-invocation
tags: [skills, invocation, arguments, context-injection, rpc, aliases, cucumber]

requires:
  - phase: 01-harness-and-version-raise
    provides: the frozen cores substituteArguments/parseArgumentNames/claudeEffort, expandContextInjections, selectPromptShell/bashMissingMessage/createPromptShellRunner
  - phase: 02-skills
    provides: "02-01: the pi-claude-marketplace record (names, pluginRoot, pluginData) on every staged SKILL.md, read by readSkillRecord"
provides:
  - "orchestrators/skill-invocation.ts: invokeBridgedSkill (find the staged skill, read, substitute, inject, frame, or abort)"
  - "edge/skill-aliases.ts: one input path for /skill: tokens and every alias token, interactive and RPC; aborts reported through notifyUsageError and handled"
  - "features/skill/invocation.feature: the SKL-03 scenarios (11 + 1 alias scenario)"
affects: [02-06, 02-07, 03-commands]

actuals:
  tokens: 15200
  tasks: 3
  commits: 6
plan_head_before: bdf71986c61d5d8b26aa9ef9505595fecc4f6677
plan_head_after: adbb974b96e181be42a139ae25f8a45fcd47f1e0

tech-stack:
  added: []
  patterns:
    - "An orchestrator returns a discriminated not-bridged | ok | abort outcome; the edge maps it onto Pi's input result and reports an abort through the notify chokepoint"
    - "Production dependencies object with defaults (getAgentDir, readFile, prompt-shell host and runner), passed as the last optional parameter"

key-files:
  created:
    - extensions/pi-claude-marketplace/orchestrators/skill-invocation.ts
    - test/orchestrators/skill-invocation.test.ts
  modified:
    - extensions/pi-claude-marketplace/edge/skill-aliases.ts
    - test/edge/skill-aliases.test.ts
    - features/skill/invocation.feature
    - extensions/pi-claude-marketplace/bridges/skills/skill-names.ts

key-decisions:
  - "CLAUDE_SKILL_DIR and the block's 'References are relative to' use path.dirname(sourceInfo.path), not sourceInfo.baseDir: for an extension-discovered skill Pi sets sourceInfo.baseDir to the extension's directory (measured), while its own block uses dirname(filePath)."
  - "An aborted invocation reports as usage-error with origin {kind: command, commandId: skill, invocationId: randomUUID()}; RPC clients receive it as a claude-plugin entry at once (A7 measured), so no runCommand fallback was needed."
  - "Every slash token (bare included) other than extension input reads pi.getCommands() and, when not a /skill: token, the per-cwd alias table; a non-skill command of that name still wins (SK-6)."

patterns-established:
  - "A skill invocation scenario states the whole message the model received; an abort scenario observes the usage-error fields through When the user runs"

requirements-completed: [SKL-03]

coverage:
  - id: D1
    description: "A typed bridged skill (interactive or RPC) reaches the model in Pi's <skill> block with its arguments substituted as Claude Code's T2e substitutes them, nothing after </skill>"
    requirement: SKL-03
    verification:
      - kind: e2e
        ref: "features/skill/invocation.feature#Invoking a skill sends the model its body in a skill block"
        status: pass
      - kind: e2e
        ref: "features/skill/invocation.feature#Invoking a skill with the companions loaded sends the model the same skill block"
        status: pass
      - kind: e2e
        ref: "features/skill/invocation.feature#Arguments fill a skill's placeholders as Claude Code fills them (5 rows)"
        status: pass
      - kind: unit
        ref: "test/orchestrators/skill-invocation.test.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "${CLAUDE_SESSION_ID} and ${CLAUDE_EFFORT} are filled at invocation; CLAUDE_SKILL_DIR, CLAUDE_PROJECT_DIR (project scope only), CLAUDE_PLUGIN_ROOT and CLAUDE_PLUGIN_DATA (from the stored record) are passed"
    requirement: SKL-03
    verification:
      - kind: e2e
        ref: "features/skill/invocation.feature#A skill's session id and effort are filled in when it runs"
        status: pass
      - kind: unit
        ref: "test/orchestrators/skill-invocation.test.ts#D-CF2-06: fills the session, effort, skill, project, and plugin variables of a project skill"
        status: pass
      - kind: unit
        ref: "test/orchestrators/skill-invocation.test.ts#D-CF2-06: expands a variable that a typed argument names"
        status: pass
    human_judgment: false
  - id: D3
    description: "Context commands run after substitution with the chosen shell in the session directory; a failed command, an oversized invocation, or a missing Bash aborts, the user sees Claude Code's message, and nothing reaches the model; a !-argument is escaped and runs nothing"
    requirement: SKL-03
    verification:
      - kind: e2e
        ref: "features/skill/invocation.feature#A context command in a skill runs before the model sees the skill"
        status: pass
      - kind: e2e
        ref: "features/skill/invocation.feature#A failing context command stops the skill and reports Claude Code's message"
        status: pass
      - kind: e2e
        ref: "features/skill/invocation.feature#An argument that starts with an exclamation mark reaches the model escaped and runs nothing"
        status: pass
      - kind: unit
        ref: "test/edge/skill-aliases.test.ts#T-01-24: reports an aborted skill as a usage error entry over RPC and handles the prompt"
        status: pass
    human_judgment: false
  - id: D4
    description: "Every alias token the table resolves (qualified or bare) goes through the same invocation for interactive and RPC input; extension input and non-bridged skills pass through; autocomplete offers qualified aliases only"
    requirement: SKL-03
    verification:
      - kind: e2e
        ref: "features/skill/invocation.feature#Invoking a skill through its plugin-qualified name over RPC sends the same skill block"
        status: pass
      - kind: unit
        ref: "test/edge/skill-aliases.test.ts#D-CF2-05: sends the alias /<token> from <source> input through the invocation (4 cases)"
        status: pass
      - kind: unit
        ref: "test/edge/skill-aliases.test.ts#DC-25: offers only plugin-qualified aliases in completion"
        status: pass
      - kind: other
        ref: "npm run check (full gate on this worktree: 1186 scenarios, integration, direct coverage of all pairs)"
        status: pass
    human_judgment: false

duration: 47min
completed: 2026-11-01
status: complete
---

# Phase 2 Plan 03: Skill invocation with Claude Code's arguments and context commands Summary

**A typed bridged skill now reaches the model in Pi's own `<skill>` block with its arguments filled by the frozen `T2e` port, its `${CLAUDE_*}` variables set, and its `!` commands run after substitution; a failing command aborts through `notifyUsageError` with Claude Code's message, for `/skill:` and alias tokens alike, from interactive and RPC input.**

## Performance

- **Duration:** 47 min
- **Started:** 2026-11-01T10:06:52Z
- **Completed:** 2026-11-01T10:53:23Z
- **Tasks:** 3
- **Files modified:** 6 (2 created)

## Accomplishments

- `orchestrators/skill-invocation.ts` (new): `invokeBridgedSkill(request, dependencies?)` finds the `skill:<gen>` command whose loaded file is `<root>/pi-claude-marketplace/resources/skills/<gen>/SKILL.md` under the agent directory or `<cwd>/.pi`, reads and parses it, calls `substituteArguments` with `parseArgumentNames(frontmatter.arguments)` and the invocation variables, then `selectPromptShell(frontmatter.shell)` and `expandContextInjections`, and frames Pi's block. It returns `not-bridged`, `ok`, or `abort` (for `ContextInjectionError`, `InvocationTooLargeError`, and `bash-missing`); any other error propagates.
- `edge/skill-aliases.ts`: the `input` listener passes `extension` input through (D-CF2-05), keeps the non-skill-command check (SK-6), and sends `/skill:<gen>` and every alias the table resolves (qualified or bare) through one `invoke` path; `ok` transforms (keeping images), `not-bridged` continues, `abort` reports through `notifyUsageError` with `usage: ""` on a `{ kind: "command", commandId: "skill" }` run and returns `handled`. `registerSkillAliases(pi)` still registers one `session_start` and one `input` listener; the invocation and the invocation-id factory are optional parameters 3 and 4.
- `features/skill/invocation.feature`: the two seeds now expect `\n\nARGUMENTS: Ada\n</skill>`, plus 6 scenarios and one 5-row Outline (context command, abort, escaped `!` argument, placeholders, session id and effort, RPC qualified alias).
- Full `npm run check` on this worktree: exit 0 (static, unpaired, integration, 1186/1186 cucumber scenarios, direct coverage of every pair).

## Task Commits

1. **Task 1: Send a typed bridged skill with Claude Code's argument substitution (tracer)**
   - `a06b466` test(skills): expect substituted arguments inside the skill block (RED)
   - `ca5b28f` feat(skills): fill a typed skill's arguments as Claude Code does (GREEN)
2. **Task 2: Run context commands after substitution and abort through the notify chokepoint**
   - `02da854` test(skills): pin context commands and argument rules of a typed skill (RED)
   - `a01c318` feat(skills): run a typed skill's context commands after substitution (GREEN)
3. **Task 3: Route every alias token through the same invocation**
   - `4755c82` test(skills): expect an RPC alias to send the substituted skill block (RED)
   - `adbb974` feat(skills): invoke a skill alias through the same skill invocation (GREEN)

Tracer gate (Task 1): the `<verify>` chain (unit tests incl. `test/index.test.ts`, direct coverage of both sources, the seed scenarios, `npm run fallow`) was re-run end to end after the GREEN change and passed before Task 2 started.

## Red proofs

**Task 1** — `npx cucumber-js features/skill/invocation.feature` after `a06b466`, before the product change, exit 1:

```text
  2) Invoking a skill with the companions loaded sends the model the same skill block # features/skill/invocation.feature:29
       Then the model receives these calls: # features/step_definitions/model.steps.ts:68
           AssertionError [ERR_ASSERTION]: Expected values to be strictly deep-equal:
                   'Greet the person named in the arguments.\n' +
           +       '</skill>\n' +
                   '\n' +
           +       'Ada'
           -       'ARGUMENTS: Ada\n' +
           -       '</skill>'
2 scenarios (2 failed)
24 steps (22 passed, 2 failed)
```

Semantic assessment: both seeds ran every Given and the prompt; each failed only on the planned whole-message assertion (Pi's native expansion appended the raw `Ada` after `</skill>`).

**Task 2** — the six new scenarios (one Outline of 5 rows) run after `02da854`, before the product change: 11 scenarios, 9 passed, 2 failed.

```text
  1) A failing context command stops the skill and reports Claude Code's message # features/skill/invocation.feature:75
       When the user runs "/skill:demo-check" # features/step_definitions/command.steps.ts:77
           AssertionError [ERR_ASSERTION]: /skill:demo-check
           +   disposition: 'started'
           -   disposition: 'handled'
  2) A context command in a skill runs before the model sees the skill # features/skill/invocation.feature:54
           +       'Status: !`printf ok`\n' +
           -       'Status: ok\n' +
```

Semantic assessment: the two product rules of this task (injection and abort) failed on their planned assertions (the command did not run; the abort reached the model as a started turn). The escaped-argument scenario, the 5 Outline rows, and the session-id/effort scenario passed at once, because Task 1 already shipped substitution; they pin T-01-22's ordering and D-CF1-01's rules rather than prove a new change.

**Task 3** — `npx cucumber-js features/skill/invocation.feature --name "plugin-qualified name over RPC"` after `4755c82`, exit 1: the model received `...Greet the person named in the arguments.\n</skill>\n\nAda` (Task 1's handler already ran for RPC, but the alias was still rewritten to `/skill:` for Pi's native expansion) instead of the substituted block. Passes after `adbb974`.

The RED evidence classifier (`check tdd-red-evidence`) has no cucumber adapter, so it was not run; the cucumber runs above are the plan's named red proofs. Unit cases were written with each GREEN change.

## Observed values

- `${CLAUDE_EFFORT}` in the profile Pi (faux model): **`low`** (A1 holds).
- The abort result's fields: `kind usage-error`, `severity error`, `needs reload false`, `message Shell command failed for pattern "!`printf partial; exit 3`": partial`, `usage` empty.
- An argument `` !`printf pwned` `` reaches the model as `` \! `printf pwned` `` (the frozen `guardBangs` also splits the `!` from the backtick), not `` \!`printf pwned` `` as the plan's behavior row wrote it; the scenario and unit case state the observed literal.
- A missing index (`Third: $2` with `Ada Grace`) stays literal and, because nothing was substituted, `\n\nARGUMENTS: Ada Grace` is appended.

## Files Created/Modified

- `extensions/pi-claude-marketplace/orchestrators/skill-invocation.ts` - the invocation orchestrator.
- `test/orchestrators/skill-invocation.test.ts` - 21 cases (fake dependencies; one temp-dir case for the production `readFile`).
- `extensions/pi-claude-marketplace/edge/skill-aliases.ts` - the rewritten input listener and abort report.
- `test/edge/skill-aliases.test.ts` - 20 cases (strong-mock, `exactParams: true`).
- `features/skill/invocation.feature` - edited seeds plus the SKL-03 scenarios.
- `extensions/pi-claude-marketplace/bridges/skills/skill-names.ts` - `readSkillRecord` exported (deviation 1).

## Decisions Made

- See `key-decisions`. In short: frame with `dirname(sourceInfo.path)`; abort origin `commandId: "skill"`; every non-extension slash token is resolved against the commands and the alias table.
- `.fallowrc.json`: importing `argument-substitution`, `context-injection`, and `prompt-shell` did **not** make any `dynamicallyLoaded`/`ignoreExports` entry stale — `npm run fallow` passed after each task. `.fallowrc.json` was not edited (parent-owned).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `readSkillRecord` exported from `bridges/skills/skill-names.ts` (outside `files_modified`)**
- **Found during:** Task 1
- **Issue:** the invocation needs the stored record; 02-01 left the reader module-private.
- **Fix:** `export` added; its doc sentence "The writer's read-back is its only caller until a session-time reader imports it" became "The writer's read-back and the skill invocation (D-CF2-06) read it." (two lines).
- **Files modified:** `extensions/pi-claude-marketplace/bridges/skills/skill-names.ts`
- **Committed in:** `ca5b28f`

**2. [Rule 1 - Bug] The plan's `CLAUDE_SKILL_DIR = sourceInfo.baseDir ?? dirname(path)` framed the wrong directory**
- **Found during:** Task 1 (GREEN run of the seeds)
- **Issue:** for a skill that this extension contributes through `resources_discover`, Pi 1.4.0 reports `sourceInfo.baseDir` as the extension's own directory (`.../extensions/pi-claude-marketplace`), so the block read `References are relative to <extension dir>.`, while Pi's native block uses `skill.baseDir = dirname(filePath)`.
- **Fix:** always `path.dirname(sourceInfo.path)`; a unit case pins it.
- **Files modified:** `orchestrators/skill-invocation.ts`, its test
- **Committed in:** `ca5b28f`

**3. [Rule 3 - Blocking] Precondition peer cache absent in the worktree**
- **Found during:** Task 1 precondition check
- **Issue:** `node_modules/.cache/optional-peers/node_modules/pi-subagents/package.json` did not exist in this fresh worktree.
- **Fix:** ran the project's own `node scripts/install-test-peers.mjs` (the script the precondition names, which `npm run test:cucumber` also runs; it installs the `peerDependencies` floors `pi-mcp-adapter@7.0.0`, `pi-subagents@0.84.0`, `@quintinshaw/pi-dynamic-workflows@3.15.0`, the same set the main checkout already holds). No tracked file changed.

**4. [Acceptance criterion conflict] `grep -cE 'ThinkingLevel|InputSource' edge/skill-aliases.ts` prints 1, not 0**
- **Issue:** the only match is `pi.getThinkingLevel()`, which the plan's own action requires. No `ThinkingLevel`/`InputSource` type is imported, so the criterion's intent (Pitfall 1: no stale `unused-type` marker in `pi-api.ts`) holds and `npm run fallow` passes. The orchestrator prints 0.

---

**Total deviations:** 3 auto-fixed (2 blocking, 1 bug) plus 1 criterion conflict. **Impact on plan:** all needed for correctness or to run the plan's checks; one one-word export plus a doc sentence outside `files_modified`.

## Issues Encountered

- **The commit hook skipped `npm run check:commit` (and prettier) for every commit in this worktree:** pre-commit printed `(no files to check)` during `git commit`, though `pre-commit run --files <file>` matches the same files. The top-level `exclude: ^(...|\.claude/(?!skills/)|...)` in `.pre-commit-config.yaml` appears to match the staged paths as seen from a worktree under `.claude/worktrees/`. To compensate, `npm run check:static` and `npm run test:unpaired` ran after Task 1, the owner tests, direct coverage, fallow, and `check:features` after each task, and the full `npm run check` (exit 0) after Task 3.
- Root sandbox: npm scripts ran through the session's `nondac-sh` wrapper, as the brief directs.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

Threat-register mitigations applied: T-02-07 (extension input returns `continue` before any parse; unit case per source), T-02-08 (substitution before injection; escaped-argument scenario and unit case), T-02-09 (abort returns `handled`; message only through `notifyUsageError`), T-02-11 (frozen runner timeout; `InvocationTooLargeError` abort unit case), T-02-12 (staged-path check; `not-bridged` unit cases). T-01-22 and T-01-24 are now complete end to end for skills.

## Parent lines

- **Phase 3 (Pitfall 10):** `edge/command-invocation.ts` runs after the skill handler and now receives a successful skill invocation as text starting with `<skill name=`; Phase 3's handler must ignore text that does not start with `/`.
- **Plan 02-06:** `readSkillRecord` is already exported; aliases now route through `invokeBridgedSkill`, and bare tokens already consult the alias table, so once 02-06's loader returns bare aliases they resolve without an edge change.
- **Orchestrator / tooling:** in this worktree the pre-commit `exclude` pattern skipped the `npm-check` hook on commit (see Issues); worktrees under `.claude/worktrees/` get no commit-time `check:commit`.
- **JSON consumers (A7):** a skill abort is a `usage-error` payload with `origin.commandId: "skill"`, a command id `docs/json-output.md` does not list yet.

## Dubious Choices

1. **Precondition satisfied by running `install-test-peers.mjs`** instead of halting with a blocking-human checkpoint; the script is the one the precondition names and installs only the declared peer floors.
2. **`CLAUDE_SKILL_DIR`/frame directory from `dirname(sourceInfo.path)`**, overriding the plan's `sourceInfo.baseDir ?? ...` after measuring that Pi sets `baseDir` to the extension directory for extension-discovered skills.
3. **Abort origin `{ kind: "command", commandId: "skill" }`** (A7 as planned; measured to arrive as a `claude-plugin` entry in RPC).
4. **Every non-extension slash token now reads `pi.getCommands()`, and a bare token loads the per-cwd alias table** (plan Task 3); a bare alias equal to a Pi built-in command name is not reserved (DC-25 item 3 residual).
5. **`CLAUDE_PROJECT_DIR` passed only for a project-scope skill**, as planned; a user-scope skill leaves `${CLAUDE_PROJECT_DIR}` literal although upstream always knows a project directory.
6. **Typed args are the trimmed rest of the line after the first whitespace-delimited token** (`/^\/(\S+)(?=\s|$)/`), where Pi's native expansion splits at the first space only; tabs/newlines directly after the token differ.
7. **A missing `!`-escape spelling difference**: the plan wrote `` \!`printf pwned` ``; the frozen core gives `` \! `printf pwned` `` and the scenario states that.
8. **`readSkillRecord` doc sentence edited** alongside the export (two lines, not one word).
9. **WINDOWS.md not appended:** no stub, skipped test, or unrun verify exists; the deviations above are recorded here only, to avoid a shared-file merge conflict with the parallel plans.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- 02-06 (aliases) can extend the loader; the edge already routes bare and qualified tokens through the invocation.
- 02-07 (phase gate) should run `npm run check` on the merged tree; this worktree's run passed.

## Self-Check: PASSED

- Files: `orchestrators/skill-invocation.ts`, `test/orchestrators/skill-invocation.test.ts` exist; the four modified files carry the changes.
- Commits `a06b466`, `ca5b28f`, `02da854`, `a01c318`, `4755c82`, `adbb974` are ancestors of HEAD; `git rev-list --count bdf7198..HEAD` = 6 before this SUMMARY.
- Acceptance greps: `ARGUMENTS: Ada` 2; `</skill>\n\nAda` 0; `source !== "interactive"` 0; `source === "extension"` 1; `ThinkingLevel|InputSource` 1 (edge, `getThinkingLevel`) / 0 (orchestrator); `index.ts` and `test/index.test.ts` unchanged since `bdf7198`; `expandContextInjections(` 1, after `substituteArguments(` (lines 190 vs 175); `notifyUsageError(` 1; `usage-error` 1; `Status: ok` 1; `demo:greet Ada` 1; `includes(":")` 1.
- `npx cucumber-js features/skill`: 19/19; `npm run check`: exit 0.

---
*Phase: 02-skills*
*Completed: 2026-11-01*
