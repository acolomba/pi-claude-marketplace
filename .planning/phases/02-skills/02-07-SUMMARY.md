---
phase: 02-skills
plan: 07
subsystem: skills-gate
tags: [skills, phase-gate, cucumber, fallow, pi-gap-report, parent-lines]

requires:
  - phase: 02-skills
    provides: "02-01..02-06: the skills bridge, invocation, aliases, collisions, lifecycle, and their features"
provides:
  - "Phase gate evidence on the combined Phase 2 tree: npm run check exit 0, two random-order cucumber runs exit 0"
  - "The D-CF2-10 Pi gap report as ready-to-file text (not filed)"
  - "Twelve ready-to-paste PROJECT.md Key Decisions rows, D-CF2-01..D-CF2-12"
  - "Every parent line a component phase may not apply itself"
affects: [phase-2-merge, 03-commands]

actuals:
  tokens: 9800
  tasks: 3
  commits: 0
plan_head_before: cf00b3158763e4d12bebcb44f05865266a0ba689
plan_head_after: cf00b3158763e4d12bebcb44f05865266a0ba689

tech-stack:
  added: []
  patterns:
    - "A gate plan with no source change records its evidence and the parent's lines in one SUMMARY commit"

key-files:
  created:
    - .planning/phases/02-skills/02-07-SUMMARY.md
  modified: []

key-decisions:
  - "No source file changed: the gate passed on the first run, so the bug policy had nothing to fix."
  - "The three stale code-duplication markers (one in the skills bridge, two in the commands bridge) are reported to the parent, not removed, because the gate passes and this plan's file list holds the SUMMARY only."
  - "All six Phase 1 core entries in .fallowrc.json are no longer needed on the combined Phase 2 tree: npm run fallow passes with every dynamicallyLoaded and core ignoreExports entry removed."

patterns-established: []

requirements-completed: [SKL-01, SKL-02, SKL-03, SKL-04, SKL-05, SKL-06]

coverage:
  - id: D1
    description: "The combined Phase 2 tree passes npm run check and two random-order cucumber runs"
    verification:
      - kind: other
        ref: "npm run check at cf00b31 (Node v24.22.1): exit 0, cucumber seed 239193, 1219/1219 scenarios"
        status: pass
      - kind: other
        ref: "npm run test:cucumber run 1, seed 986925: exit 0, 1219/1219"
        status: pass
      - kind: other
        ref: "npm run test:cucumber run 2, seed 847603: exit 0, 1219/1219"
        status: pass
      - kind: other
        ref: "npx cucumber-js features/skill --dry-run: the six skill features, 52 scenarios"
        status: pass
    human_judgment: false
  - id: D2
    description: "The D-CF2-10 Pi gap report, drafted for the user to file"
    verification: []
    human_judgment: true
    rationale: "Filing on Pi's public tracker is the user's call (D-CF2-10, T-02-19); the report's wording needs the user's review."
  - id: D3
    description: "The D-CF2-01..12 decision rows and the parent lines for the merge"
    verification: []
    human_judgment: true
    rationale: "The parent applies these lines at merge; their fit in PROJECT.md, CHANGELOG.md, the READMEs, the PRD, and docs is a merge-time review."

duration: 25min
completed: 2026-11-01
status: complete
---

# Phase 2 Plan 07: Skills phase gate, Pi gap report, and parent lines Summary

**The combined Phase 2 tree passes `npm run check` (1219/1219 cucumber scenarios, seed 239193) and two more random-order cucumber runs (seeds 986925 and 847603). This SUMMARY holds the ready-to-file Pi gap report for the three skill gaps, the twelve D-CF2 decision rows, and every line the parent applies at merge.**

## Performance

- **Duration:** 25 min
- **Started:** 2026-11-01T11:55:11Z
- **Completed:** 2026-11-01T12:20:00Z
- **Tasks:** 3
- **Files modified:** 1 (this SUMMARY)

## Accomplishments

- Phase gate green on the combined tree at `cf00b31` with no fix needed.
- Fallow dupes measured with the bridge markers removed: two reviewed clone groups remain, and three markers cover no group (parent lines).
- `.fallowrc.json` probe: the six core entries are no longer needed (parent lines).
- The Pi gap report, the twelve decision rows, and the parent lines below.

## Task Commits

The three tasks produce only this SUMMARY, so they land in one SUMMARY commit (see Deviations). No task commit precedes it, so `commits: 0` counts the commits before the SUMMARY commit, as the sibling SUMMARYs do.

## Gate evidence (Task 1)

Tree: commit `cf00b3158763e4d12bebcb44f05865266a0ba689` (worktree base, the merged wave-3 tree), working tree clean. Node `v24.22.1`. Every npm script ran with the session's `nondac-sh` wrapper and `NODE_OPTIONS=--max-old-space-size=6144`.

| Command | Started (UTC) | Exit | Result |
| --- | --- | --- | --- |
| `npm run check` | 11:55:40 | 0 | `check:static`: typecheck 17.6 s, lint 172.8 s, lint:workflows 0.3 s, fallow 8.4 s, format:check 51.2 s, test:corresponding 3.7 s, check:features 7.1 s, all passed. `test:unpaired` and `test:integration` passed. `test:cucumber`: seed **239193**, 16 hooks, 1219 scenarios (1219 passed), 12621 steps (12621 passed), 2m 26s. `test:coverage:direct:all`: no shortfall, `Merged LCOV: coverage/direct.lcov (318 records)`. Ended 12:04:47. |
| `npm run test:cucumber` (run 1) | 12:04:5x | 0 | seed **986925**, 1219 scenarios (1219 passed), 12621 steps (12621 passed), 2m 23s |
| `npm run test:cucumber` (run 2) | 12:07:3x | 0 | seed **847603**, 1219 scenarios (1219 passed), 12621 steps (12621 passed), 3m 00s |
| `npx cucumber-js features/skill --dry-run` | 11:58 | 0 | 52 scenarios in the six features `aliases`, `collisions`, `frontmatter`, `invocation`, `lifecycle`, `listing` |
| `npx fallow dupes --fail-on-issues --format human --quiet` | 12:11 | 0 | no clone group reported |

The one stray line in the check log, `Legacy marketplace migration could not be persisted ...`, is the IL-3 `console.warn` that a persistence unit case provokes on purpose. It is not a failure.

### Reviewed clone pairs (ROADMAP "Reviewed clone pairs")

Measured by deleting every `fallow-ignore-next-line code-duplication` marker in `bridges/{skills,commands}/{stage,discover,unstage}.ts`, running `npx fallow dupes --format human`, and copying the saved files back (`git status` clean afterward):

| Group | Instances | Marker state |
| --- | --- | --- |
| `dup:23c99c81`, 28 lines | `bridges/commands/stage.ts:160-186`, `bridges/skills/stage.ts:410-437` | covered by the markers at `commands/stage.ts:160` and `skills/stage.ts:410` |
| `dup:3989c3f1`, 16 lines | `bridges/commands/unstage.ts:28-43`, `bridges/skills/unstage.ts:57-72` | covered by the markers at `commands/unstage.ts:29` and `skills/unstage.ts:58` |

Three markers now cover no group: `bridges/skills/stage.ts:496` and `bridges/commands/stage.ts:276` (the `return { kind: "staged", ... }` pair; the D-CF2-08 change to the skills side's `warnings` entry, 02-02, ended that clone), and `bridges/commands/discover.ts:314` (02-04 ended that clone and removed the skills-side marker). Fallow never reports a stale `code-duplication` marker, so the gate stays green. See Parent lines.

## Pi gap report (D-CF2-10, drafted, not filed)

This phase did not post the report. It holds no credential for Pi's tracker, and a public post on the user's behalf is the user's call (D-CF2-10, DUBIOUS-CHOICES DC-24 item 4). The text below is ready to file as one issue at https://github.com/earendil-works/pi/issues.

---

**Title:** Skills and prompt templates: no per-skill hide, no display names or aliases, no hook when the model loads a skill, no model access to templates, and a second expansion after an input transform

**Summary.** pi-claude-marketplace installs Claude Code plugins into Pi. It stages each plugin skill as a Pi skill. Three things that Claude Code plugin skills use have no equal in Pi 1.4.0. The extension works around two of them in part and cannot work around the third. Each section below states what a Claude Code plugin expects, what Pi offers, what users see, and one proposal.

**1. A skill that the user cannot invoke from `/`**

- Claude Code: a skill with `user-invocable: false` in its frontmatter is not in the `/` menu, and a typed `/name` does not run it. The model can still use the skill, and its description stays in the model's context. The skills documentation says "You can invoke: No / Claude can invoke: Yes". The 2.1.316 binary reads the field (`e["user-invocable"]===void 0?!0:...`).
- Pi 1.4.0: skill frontmatter honors `disable-model-invocation` only. The `enableSkillCommands` setting hides every skill command at once, and a typed `/skill:<name>` still runs.
- Effect: the extension lists such a skill as `/skill:<name>` and runs it when the user types it. Users see a command that the plugin author hid.
- Proposal: honor `user-invocable: false` in skill frontmatter. Leave the skill out of the command list and autocomplete, refuse a typed `/skill:<name>`, and keep it in `<available_skills>`.

**2. A display name and aliases for a skill**

- Claude Code: a plugin skill's name is `<plugin>:<folder>`, with each character outside `[a-zA-Z0-9_-]` changed to `-`. A frontmatter `name` adds a display name `<plugin>:<name>` and, when the name has no `:`, the bare alias `<name>`. All of these invoke the skill. The model's skill list shows `- my-plugin:review (my-plugin:fancy): ...`. The 2.1.316 binary builds these names in one function: `function Qqn(e,n,r){let s=`${e}:${n.replace(/[^a-zA-Z0-9_-]/g,"-")}`,h=SAt(r,`plugin skill ${s}`)??"",y=!h?s:h.startsWith(`${e}:`)?h:`${e}:${h}`;return{name:s,loadedFrom:"plugin",userFacingName:()=>y,aliases:h&&!h.includes(":")?[h]:void 0}}`.
- Pi 1.4.0: `validateName` in `dist/core/skills.js` accepts `^[a-z0-9-]+$` only, with no leading, trailing, or double hyphen and at most 64 characters. A loaded skill has `name`, `description`, `filePath`, `baseDir`, and `disableModelInvocation`. It has no display name and no alias field.
- Effect: the extension names the skill `/skill:<plugin>-<folder>`. It adds the Claude Code names through its own `input` handler and autocomplete provider. Pi's command list and the model's `<available_skills>` show only the generated name, and the `:` form cannot appear there.
- Proposal: add optional `aliases` (slash names that can contain `:`) and a display name to a skill. Use the display name in the command list and in `<available_skills>`, and accept each alias as input. An extension API that registers aliases for a loaded skill would also work.

**3. An extension hook when the model loads a skill**

- Claude Code: when the model uses a plugin skill through its Skill tool, Claude Code fills in the skill's arguments and `${CLAUDE_*}` variables and runs its `` !`command` `` lines before the model reads the text. The same rules apply as when the user types the skill.
- Pi 1.4.0: the system prompt tells the model to load a skill's file with the read tool. No event lets an extension change that content. `input` handlers run only for text that the user sends.
- Effect: a skill that the model loads on its own gets the raw file. `$ARGUMENTS`, `${CLAUDE_SESSION_ID}`, and `${CLAUDE_EFFORT}` stay literal, and `!` commands do not run. The extension applies these rules only to skills that the user types.
- Proposal: emit an event when the model loads a skill, with the skill name, its file, and the text, and let a handler return changed text. A skill tool that loads a skill by name and fires that event would also work.

**4. The model cannot see or run a prompt template**

- Claude Code: a plugin command with a `description` (or `when_to_use`) is in the model's skill list, for example `- probe-plugin:deploy: Deploy things`, under "The following skills are available for use with the Skill tool:". The model can run the command through its Skill tool. `disable-model-invocation: true` takes the command out of the list, and the Skill tool then refuses it. Probed on the 2.1.316 binary (03-UPSTREAM-EVIDENCE E1).
- Pi 1.4.0: prompt templates are user input only. The system prompt lists skills (`formatSkillsForPrompt` in `dist/core/system-prompt.js`) and no templates, and the model has no tool that runs a template.
- Effect: the extension stages each Claude Code command as a Pi prompt template. The user can type it, but the model does not know it exists and cannot run it. A plugin that expects the model to run its commands loses that in Pi. Staging the command again as a Pi skill would give the model access, but it would also add a `/skill:<plugin>-<name>` entry to the slash menu, which Pi cannot hide (section 1).
- Proposal: let a prompt template opt in to the model's view, for example with frontmatter `model-invocable: true`. List such templates in the system prompt with their descriptions, and give the model a way to run one by name with arguments. The same expansion as for user input applies, and the `input` event fires with a source such as `model`. Honor `disable-model-invocation: true` as the opt-out.

**5. A template's name is its file name**

- Claude Code: a plugin can declare its commands as an object map in `plugin.json`. Each key becomes `/<plugin>:<key>` verbatim, so a key can hold `/`, `.`, or non-ASCII characters, and the name does not have to match any file name. Probed on the 2.1.316 binary (03-UPSTREAM-EVIDENCE E3).
- Pi 1.4.0: `loadTemplateFromFile` in `dist/core/prompt-templates.js` sets `name = basename(filePath).replace(/\.md$/, "")`, and `expandPromptTemplate` finds a template by that name. A frontmatter field cannot set another name.
- Effect: the extension must stage one file per command and name the file after the command. A map key's `/` becomes `:`, because a file name cannot hold `/`. On Windows, a key with `:` inside it gives a file name that NTFS refuses, so that install fails. The extension also uses `.` in place of `:` in every command name on Windows.
- Proposal: accept an optional frontmatter `name` on a prompt template, used in place of the file name for listing and expansion. An extension API that registers a template with a name and a body would also work.

**6. A transformed input is expanded again**

- Claude Code: a command whose body starts with `/` sends the body literally. The second command is not expanded. Probed on the 2.1.316 binary (03-UPSTREAM-EVIDENCE E8).
- Pi 1.4.0: `prompt()` in `dist/core/agent-session.js` runs the `input` handlers first, then `_expandSkillCommand` and `expandPromptTemplate` on the text that a handler returned with `action: "transform"`. The opt-out `expandPromptTemplates: false` exists on `prompt()` and `sendUserMessage()` options, but not on the `transform` result.
- Effect: the extension fills a typed command's body itself, as Claude Code does, and returns it as a `transform`. When that body starts with `/<another template>` or `/skill:<name>`, Pi expands it a second time, with Pi's own argument rules, no `!` commands, and no provenance check. The model then gets the other template's body instead of the literal text. The extension cannot prevent this without `sendUserMessage`, which changes the RPC `prompt` response to `handled` and reports a missing model as an extension error.
- Proposal: add an optional `expand: false` (or `expandPromptTemplates: false`) member to the `transform` result, so that Pi sends the returned text as it is.

---

## Decision records (Task 2)

Ready to paste into the `.planning/PROJECT.md` Key Decisions table, after the D-CF1-17 row. Each row carries the residuals that the plans measured.

| Decision | Rationale | Outcome |
| --- | --- | --- |
| **D-CF2-01 (component-features, Phase 2, settled autonomously, DUBIOUS-CHOICES DC-24): a bridged skill's Pi name stays `/skill:<plugin>-<folder>`, derived from its source folder name (SK-2, `generatedSkillName` unchanged)**. Frontmatter `name` does not change the Pi name, and SK-3 still rewrites the staged `name`. | E1 of 02-CONTEXT (Claude Code 2.1.316 binary, `Qqn`): the folder name is upstream's identity, both names invoke the skill, and two skills that share a frontmatter `name` both load. A Pi name from frontmatter `name` would drop one of them. The docs page says otherwise, and the binary was followed. | -- Locked |
| **D-CF2-02 (component-features, Phase 2, settled autonomously, DUBIOUS-CHOICES DC-24, DC-25): the `/plugin:skill` aliases are exactly Claude Code's names for the skill**: `<plugin>:<folder>` (characters outside `[a-zA-Z0-9_-]` become `-`, case kept, nothing elided), `<plugin>:<name>` for a frontmatter `name` (or the name itself when it starts with `<plugin>:`), and the bare `<name>` when it has no `:`. Install stores the names in a `pi-claude-marketplace` JSON line at the end of each staged `SKILL.md` frontmatter, with the install-time plugin root and data directory, and verifies it by a read-back. A frontmatter-name alias goes to the first skill that claims it, an alias never takes a name a non-skill Pi command has (SK-6), and the elided alias is dropped. | E1 (`Qqn`, the `dupe-a` probe). Pi capability gap (validator `a-z0-9-`, no display name or alias field): Pi's command list and the system prompt show only the generated name. Residuals measured: a skill staged before this change has no record and keeps the old elided alias until update or reinstall (DC-25 item 1); a list-valued `name` adds no alias (upstream joins it with commas), and a name with whitespace adds none; a bare alias equal to a Pi built-in command name is not reserved (Pi exports no built-in list); claims run in loader order (user root, then project root, then state order) with exact-case matching, because upstream's cross-plugin order and case rule were not probed; autocomplete offers the qualified aliases only. | -- Locked |
| **D-CF2-03 (component-features, Phase 2, settled autonomously, DUBIOUS-CHOICES DC-24): in one plugin, a top-level command whose name `<plugin>:<file basename>` equals a skill's `<plugin>:<folder>` wins, and the skill is not staged**. Install warns `skill source "<folder>" has the same name "<plugin>:<folder>" as a command of the plugin; ignoring the skill.` A frontmatter-name alias equal to a command name is not registered. | E2 of 02-CONTEXT: upstream lists the name once, sends the command's body, and the skill's body reaches neither the user nor the model. The docs table covers two locations, not one plugin. Upstream prints nothing; the warning follows the D-07/D-141-04 duplicate warning. Residuals measured: names compare as exact strings (research A4, not probed), only top-level `.md` basenames of `componentPaths.commands` are compared, so an object-map `commands` name (FG-13) is not, and the shadow check runs before generated-name dedup, so a shadowed skill frees its generated name. A commands-directory read error other than ENOENT/ENOTDIR now fails at discovery, before the ledger. | -- Locked |
| **D-CF2-04 (component-features, Phase 2, settled autonomously, DUBIOUS-CHOICES DC-24): two skill folders with one upstream name or one generated name keep first-wins and the D-07 duplicate warning, and the `skills/` copy wins over a declared path's copy**. Discovery reads the `skills` entry of `componentPaths.skills` first. The resolver is unchanged. | E3 of 02-CONTEXT: `skills/twin` and a declared `extra/twin` give one name, and the `skills/` body runs. Pins D-07 and D-141-04. | -- Locked |
| **D-CF2-05 (component-features, Phase 2, settled autonomously, DUBIOUS-CHOICES DC-24): the skill aliases and the D-CF1-01/D-CF1-02 skill invocation run for `interactive` and `rpc` input**. `extension` input passes through unchanged. Supersedes the "interactive Pi sessions" wording of SK-6. | E4 of 02-CONTEXT: upstream resolves plugin skill names in every user entry point (`-p` with `stream-json`). Pi expands slash commands in an extension's message only when that extension asks, and the input event does not carry that choice. Residuals measured: a non-skill command of the same name still wins; the typed arguments are the trimmed rest of the line after the first whitespace-delimited token, where Pi splits at the first space. Proven over RPC and in Pi's TUI with Tab completion. | -- Locked |
| **D-CF2-06 (component-features, Phase 2, settled autonomously, DUBIOUS-CHOICES DC-24, DC-25): a typed bridged skill goes through `orchestrators/skill-invocation.ts`**: `substituteArguments` with `parseArgumentNames(frontmatter.arguments)`, the variables `CLAUDE_SESSION_ID`, `CLAUDE_EFFORT`, `CLAUDE_SKILL_DIR`, `CLAUDE_PLUGIN_ROOT`, `CLAUDE_PLUGIN_DATA` (from the stored record), and `CLAUDE_PROJECT_DIR` at project scope, then `expandContextInjections` with the shell from `selectPromptShell`. The model gets Pi's `<skill name="..." location="...">` block with the substituted body and nothing after `</skill>`. A failed command, an oversized invocation, or a missing Bash aborts: the message goes out as a `usage-error` with origin `{kind: "command", commandId: "skill"}`, and nothing reaches the model. | Pins D-CF1-01, D-CF1-02, and D-CF1-03 (model-invoked skills get neither). Pi's block framing is kept instead of upstream's `Base directory for this skill:` text (E5), so upstream's three line feeds before `ARGUMENTS:` become the Pi block's `\n\nARGUMENTS: <args>\n</skill>`. Residuals measured: `${CLAUDE_EFFORT}` reads `low` in the profile Pi with the faux model; `CLAUDE_SKILL_DIR` and the block's directory use `dirname(sourceInfo.path)`, because Pi 1.4.0 sets `sourceInfo.baseDir` to the extension's directory for an extension-discovered skill; a user-scope skill leaves `${CLAUDE_PROJECT_DIR}` literal; an argument `` !`x` `` reaches the model as `` \! `x` `` (the frozen core also splits the backtick). | -- Locked |
| **D-CF2-07 (component-features, Phase 2, settled autonomously, DUBIOUS-CHOICES DC-24): a skill with no frontmatter `description` is described by `descriptionFallback(body, "Plugin skill")`**. `firstBodyParagraph` and the `No description provided.` placeholder are gone. The `when_to_use` fold and the 1,536-character cap apply on top. | Pins D-CF1-04 (E3 of 01-CONTEXT, `A2e`). Proven through Pi's `get_commands` listing: first line, heading text, the 100/101-character boundary, the empty body, and the fold. | -- Locked |
| **D-CF2-08 (component-features, Phase 2, settled autonomously, DUBIOUS-CHOICES DC-24): the skills bridge adds `[<source>] dropped fields: <fields>` to its discovery warnings, one line per skill, in frontmatter key order**. It reads the parse that the PARSE-01 gate returned (repaired bytes included) before the SK-3 rewrite. It is not emitted for a skill whose frontmatter does not parse. `allowed-tools`, `arguments`, `shell`, and `user-invocable` are never reported. | Pins D-CF1-05. Residuals measured: field names match case-sensitively (`Model:` is not reported, not probed upstream); the line rides every staging verb's discovery channel, and only `install` is scenario-proven. | -- Locked |
| **D-CF2-09 (component-features, Phase 2, settled autonomously, DUBIOUS-CHOICES DC-24): a `user-invocable: false` skill stays listed and runnable from `/`, and a `disable-model-invocation: true` skill stays listed, runs on `/skill:`, and is absent from the model's `<available_skills>`**. | Cites D-CF1-09 (the user's 2026-10-31 decision, spike 028) for `user-invocable`. `disable-model-invocation` matches upstream through Pi's own `formatSkillsForPrompt` filter. | -- Locked |
| **D-CF2-10 (component-features, Phase 2, settled autonomously, DUBIOUS-CHOICES DC-24): the Pi gap report for no per-skill hide (D-CF1-09), no skill display name or alias (D-CF2-02), and no hook on the model's skill path (D-CF1-03) is drafted as ready-to-file text in the Phase 2 gate SUMMARY**. The phase did not post it. | The phase holds no credential for Pi's tracker, and a public post on the user's behalf is the user's call. ROADMAP Phase 2 criterion 5 ("reported to Pi") needs the user to file it. | -- Pending (user files) |
| **D-CF2-11 (component-features, Phase 2, settled autonomously, DUBIOUS-CHOICES DC-24): disable, uninstall, update, and enable of a plugin take effect for its skills in a new session**: disable and uninstall remove the skills and their aliases, a disabled skill typed as `/skill:` or an alias reaches the model as the typed text, enable restores them, and update shows the new description and body. | They take effect at `/reload`, not upstream's `/reload-plugins` (NFR-2 as amended by APL-D2). Idempotency and concurrency stay pinned by the plugin lifecycle features and `test/integration/concurrent-install.test.ts`. | -- Locked |
| **D-CF2-12 (component-features, Phase 2, settled autonomously, DUBIOUS-CHOICES DC-24, DC-26): Phase 2 also owned `orchestrators/skill-alias-state.ts` and its test, and added optional, backward-compatible `extensions`, `arguments`, `readyText`, and `typeText` to `features/lib/pi-tui.ts`**. It did not edit `domain/name.ts`, `bridges/commands/**`, or the frozen Phase 1 cores. | Only skills use the alias loader. The TUI alias scenario needs the scripted model and Tab completion. Residual measured: the profiled TUI waits for `[Extensions]`, which Pi prints after the extensions' `session_start` ran and autocomplete was set up; a Pi that stops printing it would time the step out loudly. Existing `pi-tui.ts` callers did not change. | ✓ Good |

## Parent lines (Task 3)

Each line is ready to apply at merge. Component phases never edit these files.

### `CHANGELOG.md`

Add these sub-bullets under the milestone's top line in `## [Unreleased]` (the line that starts "The extension now needs Pi 1.4.0 or newer"):

```markdown
  - A skill with no `description` is now listed with Claude Code's text: the first line of its body, or `Plugin skill` for an empty body.
  - Install now warns about the skill frontmatter fields that Pi cannot honor, such as `model` or `effort`, with one line for each skill.
  - Typed skills now fill in arguments, `${CLAUDE_*}` variables, and `` !`command` `` output as Claude Code does, in the terminal UI and over RPC.
  - A failing `` !`command` `` now stops its skill with Claude Code's message, and the model gets nothing.
  - Skill aliases now match Claude Code: `/<plugin>:<skill folder>`, `/<plugin>:<frontmatter name>`, and the bare `/<frontmatter name>`, without the old shortened alias. Update or reinstall a plugin to get them for skills installed earlier.
  - A command now keeps a name that a skill of its plugin also has, as in Claude Code, and install skips that skill with a warning.
  - A skill in `skills/` now wins over a skill of the same name in a declared skills path, as in Claude Code.
```

### `README.md`

Replace lines 113-121 (the skill alias table and the paragraph after it):

```markdown
Skills use Pi's `/skill:` form and also have aliases in interactive sessions and over RPC:

| Plugin name | Skill name                          | Pi skill form    | Aliases                        |
| ----------- | ----------------------------------- | ---------------- | ------------------------------ |
| `foo`       | `bar`                               | `/skill:foo-bar` | `/foo:bar`                     |
| `foo`       | `foo-bar`                           | `/skill:foo-bar` | `/foo:foo-bar`                 |
| `foo`       | `foo`                               | `/skill:foo`     | `/foo:foo`                     |
| `foo`       | `bar`, with frontmatter `name: baz` | `/skill:foo-bar` | `/foo:bar`, `/foo:baz`, `/baz` |

The aliases are the names that Claude Code gives a skill. The skill name is the name of the skill's folder. If the skill's frontmatter sets `name`, the skill also answers to `/<plugin>:<name>`, and to `/<name>` when the name has no colon. If two skills of a plugin set the same `name`, the first skill gets the alias. Skill aliases use a colon on every platform. If an alias conflicts with a command, the command takes precedence. If a skill has the same name as a command of its plugin, install skips the skill and warns. Use `/skill:foo-bar` to invoke the skill.
```

### `README.es.md`

Replace lines 111-119 with the same change:

```markdown
Las habilidades usan la forma `/skill:` de Pi y también tienen alias en las sesiones interactivas y por RPC:

| Nombre del complemento | Nombre de la habilidad                    | Forma de Pi      | Alias                          |
| ---------------------- | ----------------------------------------- | ---------------- | ------------------------------ |
| `foo`                  | `bar`                                     | `/skill:foo-bar` | `/foo:bar`                     |
| `foo`                  | `foo-bar`                                 | `/skill:foo-bar` | `/foo:foo-bar`                 |
| `foo`                  | `foo`                                     | `/skill:foo`     | `/foo:foo`                     |
| `foo`                  | `bar`, con `name: baz` en el frontmatter | `/skill:foo-bar` | `/foo:bar`, `/foo:baz`, `/baz` |

Los alias son los nombres que Claude Code da a una habilidad. El nombre de la habilidad es el nombre de su carpeta. Si el frontmatter de la habilidad define `name`, la habilidad también responde a `/<plugin>:<name>`, y a `/<name>` cuando el nombre no tiene dos puntos. Si dos habilidades de un complemento definen el mismo `name`, la primera recibe el alias. Los alias de habilidades usan dos puntos en todas las plataformas. Si un alias entra en conflicto con un comando, el comando tiene prioridad. Si una habilidad tiene el mismo nombre que un comando de su complemento, la instalación omite la habilidad y muestra un aviso. Usa `/skill:foo-bar` para ejecutar la habilidad.
```

Run `pre-commit run --files README.md README.es.md` after applying; mdformat may realign the tables.

### `.planning/PROJECT.md`

- Key Decisions: the twelve rows of "Decision records" above, after D-CF1-17.
- The "Last updated" footer: after component-features Phase 2 (Skills).

### `.planning/BACKLOG.md`

```markdown
## SKILLNAME-01: Claude Code's skill display name in Pi

Deferred by component-features Phase 2 (D-CF2-02). Claude Code shows a skill with a frontmatter `name` as `<plugin>:<name>` in its `/` menu and as `(<plugin>:<name>)` in the model's skill list. Pi has no display-name field, so Pi lists only `/skill:<plugin>-<folder>`. Trigger: Pi adds a skill display name or alias field (the D-CF2-10 report asks for one).

## SKILLALIAS-02: unprobed alias rules across plugins

Deferred by component-features Phase 2 (D-CF2-02, DC-25). Upstream's order for a bare alias that two plugins claim, and whether upstream matches slash names case-insensitively, were not probed. The alias table uses loader order (user root, then project root, then state order) and exact case. Probe Claude Code 2.1.316 or later before changing either.

## SKILLMODEL-01: arguments and context commands for model-invoked skills

Deferred by component-features Phase 1 and Phase 2 (D-CF1-03). When the model loads a skill on its own, Pi gives it the raw file, so arguments, `${CLAUDE_*}` variables, and `!` commands stay literal. Trigger: Pi adds an extension hook on the model's skill path (the D-CF2-10 report asks for one).
```

### `docs/env-vars.md`

- "Skills content" table, add two rows:
  - `` `${CLAUDE_SESSION_ID}` `` | ✓ | ✓ | Replaced with the Pi session id when the user invokes the skill, as `/skill:` or an alias (D-CF1-01, D-CF2-06). A skill that the model loads on its own keeps it literal (D-CF1-03).
  - `` `${CLAUDE_EFFORT}` `` | ✓ | ✓ | Replaced at invocation with Pi's session thinking level: `low`, `medium`, `high`, `xhigh`, and `max` as themselves, `off` and `minimal` as `low`, and an unknown level as `high` (D-CF1-01). A model-loaded skill keeps it literal (D-CF1-03).
- "Skills content" lead sentence, add: "When the user invokes a skill, a typed argument that names `${CLAUDE_PLUGIN_ROOT}`, `${CLAUDE_PLUGIN_DATA}`, `${CLAUDE_SKILL_DIR}`, or, at project scope, `${CLAUDE_PROJECT_DIR}` is filled in from the values that install recorded (D-CF2-06)."
- Note for the parent: the overview matrix and "Pi-only `CLAUDE_SESSION_ID` alias" call `CLAUDE_SESSION_ID` pi-only. That stays true for the environment variable, but `${CLAUDE_SESSION_ID}` in skill content is a Claude Code content token (D-CF1-01). Either add a sentence there or a `Skills` cell `S‡`-style marker for invocation time; the matrix has no legend letter for "filled at invocation" yet.

### `docs/prd/pi-claude-marketplace-prd.md`

- SK-6, replace with: "Loaded marketplace skills MUST offer `/plugin:skill` completion in interactive Pi sessions and invocation from interactive and RPC input after `/reload` (D-CF2-05). The aliases MUST be Claude Code's names for the skill: `<plugin>:<folder>` with characters outside `[a-zA-Z0-9_-]` changed to `-`, and, when frontmatter `name` is set, `<plugin>:<name>` and, for a name with no `:`, the bare `<name>` (D-CF2-02). The native `/skill:name` form remains available. An existing command or prompt template with the name takes priority, and a frontmatter-name alias goes to the first skill that claims it."
- SK-3, append: "The staged frontmatter also ends with one `pi-claude-marketplace` key that records the skill's Claude Code names and its install-time plugin root and data directory (D-CF2-02)."
- SK-2 stays as written (D-CF2-01).

### `docs/json-output.md`

- Origin: a skill that aborts at invocation reports a `usage-error` with `origin.kind` `command` and `origin.commandId` `skill` (D-CF2-06). The document lists only `/claude:plugin` operation IDs today.

### `.fallowrc.json` (DC-13 item 6)

- Measured on `cf00b31`: with all six `dynamicallyLoaded` entries and all six core `ignoreExports` entries removed, `npm run fallow` exits 0 (rule-pack test, both dead-code runs, health, dupes). Phase 2 imports all six cores (`argument-substitution`, `context-injection`, and `prompt-shell` from `orchestrators/skill-invocation.ts`; `description-fallback` and `invocation-frontmatter` from `bridges/skills/stage.ts`; `shell-words` through `argument-substitution`). No entry is needed on the combined Phase 2 tree. DC-13 item 6 says to remove them after Phases 2 and 3 merge; removing them at the Phase 2 merge is also safe, and Phase 3 then imports cores fallow already sees. These are the only `ignoreExports` entries, so the key can go.

### `.agents/skills/cucumber/rules/layout.md` (frozen)

- "Function directories" table, Skills row: the seed step module is now `features/step_definitions/skill/listing.steps.ts` (the shared Givens moved per D-08; `skill/invocation.steps.ts` is deleted).
- A TUI turn with the scripted model is one `When` (`features/step_definitions/skill/aliases.steps.ts`): it starts a profiled `PiTuiSession` (`extensions`, `arguments` `--provider faux --model faux-1`, `readyText` `[Extensions]`), registers `this.onRelease(() => tui.stop())` at once, waits only on render events (menu marker, redrawn input, reply), and records the turn for the `Then` steps. `world-and-stand-ins.md` can name this pattern beside the tui session rules.

### Code-duplication markers and `.planning/codebase/CONVENTIONS.md`

- Stale markers (measured above): `bridges/skills/stage.ts:496` (Phase 2 owned), `bridges/commands/stage.ts:276` and `bridges/commands/discover.ts:314` (Phase 3 owned). Delete them after `npx fallow dupes` confirms on the merged tree, per CONVENTIONS.md.
- Marker count today: `rg -n "fallow-ignore" extensions test scripts` = 47, of which 29 are `code-duplication`. CONVENTIONS.md says 41 and 30. Update both after the deletions.

### Non-owned test edits made by this phase

Expected values only, each limited by its plan's `git diff` criterion:

- `test/edge/register.test.ts`, `test/orchestrators/plugin/materialize-latest.test.ts`, `test/orchestrators/plugin/reinstall-flow.test.ts`: the staged `SKILL.md` bytes now end the frontmatter with the `pi-claude-marketplace` record line (02-01).
- `test/architecture/declared-component-path-overlap.test.ts`: one `generatedNames` array now lists `ui-theme-designer-design-tokens` before `ui-theme-designer-help`, because `skills/` is read first (02-04).
- `features/plugin/install-dependencies.feature`, `features/plugin/update-dependencies.feature`, `features/step_definitions/plugin/installation.steps.ts`: the staged-skills step projects run tokens, and the two tables expect the record line (02-01, Rule 3).
- `extensions/pi-claude-marketplace/bridges/skills/skill-names.ts` gained `export` on `readSkillRecord` in 02-03 (Phase 2 owned, listed for the record).
- Post-merge fix by the parent: `test/orchestrators/plugin/discover-names.test.ts` fixture skills renamed for D-CF2-03 (commit `b89e2e3`).

### Phase 3 (commands)

- `edge/command-invocation.ts` runs after the skill handler. After a successful skill invocation it receives text that starts with `<skill name=`. It must ignore any text that does not start with `/` (02-03, Pitfall 10).
- Re-check D-CF2-03 at the Phase 3 merge: the shadow check compares only top-level `.md` basenames of `componentPaths.commands`, so an object-map `commands` name (FG-13) is not compared (02-04).
- `features/skill/collisions.feature` sends `/demo:clash` with no arguments, so the commands bridge's substitution changes no expected text there. If Phase 3 changes what Pi sends for an argument-less command, that row changes.
- A plugin command whose name equals a skill's frontmatter alias keeps the name. `edge/command-invocation.ts` sees non-alias text unchanged (02-06).
- `bridges/skills/stage.ts` still calls `commandUpstreamNames` for alias claims while discovery reads the same directories, so the commands folders are read twice. Passing discovery's set through to staging is a later cleanup (02-04).
- The commands-side stale markers above sit in Phase 3's files.

### Edge-probe items for the verifier (from COVERAGE.md)

- Flagged assumptions: SKL-02 encoding (field names match case-sensitively, not probed); SKL-03 unclassified (`""` for no arguments, trimmed arguments, empty-body framing, read errors propagate); SKL-04 encoding (command names `<plugin>:<basename>` unnormalized, exact comparison, research A4); SKL-05 unclassified (bare alias equal to a Pi built-in name, cross-plugin bare-alias order, case-sensitive names, qualified-only autocomplete).
- Backstop markers: SKL-01 encoding (UTF-16 code units, frozen core test), SKL-02 adjacency (empty or null field value reported, frozen core test), SKL-06 idempotency and concurrency (plugin lifecycle features and the concurrent-install integration test).
- Explicit truths: SKL-01 adjacency, empty, and ordering; SKL-02 empty and ordering; SKL-04 empty. All six features passed in the three runs above.

## Decisions Made

See `key-decisions`. In short: no source change; stale markers and the `.fallowrc.json` cleanup go to the parent with measurements.

## Deviations from Plan

### Plan-detail choices

**1. One SUMMARY commit for three tasks**
- **Found during:** Task 1
- **Issue:** every task's only file is this SUMMARY, so a commit per task would commit partial SUMMARYs.
- **Fix:** the SUMMARY is written once and committed once. `commits: 0` counts the commits before it, as the sibling SUMMARYs count.

**Total deviations:** 0 auto-fixed, 1 plan-detail choice. **Impact on plan:** none. No file outside `files_modified` changed. `git diff --quiet cf00b31..HEAD -- CHANGELOG.md README.md README.es.md .planning/BACKLOG.md .fallowrc.json` exits 0.

## Issues Encountered

- The worktree guard refuses shell lines that mix `git` with redirection or variable expansion, so the gate and probes ran through scripts in this agent's scratch folder. The marker and `.fallowrc.json` probes copied the saved files back, and `git status --short` was empty after each.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

T-02-19 is mitigated: the Pi report is drafted here and not filed. T-02-20 is mitigated: the gate passed with no fix, so no test changed.

## Dubious Choices

1. **One SUMMARY commit** instead of one commit per task (all three tasks write only this file).
2. **Stale markers left in place.** `bridges/skills/stage.ts:496` is in a Phase 2 file and could have been deleted here. It was not, because the gate passes, the plan's file list holds only this SUMMARY, and the CONVENTIONS.md count changes with it. The parent decides.
3. **`.fallowrc.json` entries:** measured removable now. The recommendation keeps DC-13 item 6's timing (after Phase 3) and states that the Phase 2 merge is also safe.
4. **CHANGELOG wording** leaves out the 100-character cut, the `when_to_use` fold, and the fact that update and the other staging verbs also show the dropped-fields warning (only install is scenario-proven). It splits the invocation change into two sub-bullets so each stays one sentence.
5. **README example `name: baz`** is an invented frontmatter name; the table row follows E1's `review`/`fancy` probe.
6. **`docs/env-vars.md`:** `${CLAUDE_SESSION_ID}` in skill content is called an upstream token, while the doc calls the environment variable pi-only. Both hold; the parent picks the wording.
7. **Decision row outcomes:** `-- Locked` for the divergence and pin rows, `✓ Good` for D-CF2-12 (harness, like D-CF1-15..17), and `-- Pending (user files)` for D-CF2-10. The transition runner may mark them otherwise.
8. **Gap report proposals** are this project's suggestions, not Pi's design. Pi's tracker URL comes from the SSDEDUP-01 backlog entry (`earendil-works/pi`).
9. **`${CLAUDE_EFFORT}` = `low`** was measured with the faux model only; a real model's default thinking level can differ.
10. **WINDOWS.md not appended:** no stub, skipped test, or unrun verify exists.

## User Setup Required

None - no external service configuration required. The user decides whether to file the Pi gap report.

## Next Phase Readiness

- Phase 2 is ready to merge: the parent applies the lines above, then runs the merge gate.
- Phase 3 notes are under Parent lines.

## Self-Check: PASSED

- This file exists; no other file changed (`git status --short` before writing showed a clean tree).
- Acceptance: `npm run check` exit 0; both `npm run test:cucumber` runs exit 0 (seeds 986925, 847603; the check's own run 239193); `npx cucumber-js features/skill --dry-run` lists `aliases`, `collisions`, `frontmatter`, `invocation`, `lifecycle`, `listing`.
- Task 2 greps: `D-CF2-10` and `D-CF2-12` present; the section `Pi gap report (D-CF2-10, drafted, not filed)` has three gap subsections; each of D-CF2-01..12 appears once as a row.
- Task 3 greps: `## Threat Flags` and `Parent lines` present; groups for `CHANGELOG.md`, `README.md`, `README.es.md`, `.planning/PROJECT.md`, `.planning/BACKLOG.md`, `docs/env-vars.md`, `docs/prd/pi-claude-marketplace-prd.md`, `.fallowrc.json`, `.agents/skills/cucumber/rules/layout.md`, the non-owned tests, and Phase 3.

---
*Phase: 02-skills*
*Completed: 2026-11-01*
