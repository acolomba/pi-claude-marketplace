---
phase: 03-slash-commands
plan: 09
subsystem: phase-gate
tags: [commands, phase-gate, cucumber, fallow, decision-records, pi-gap-report]

requires:
  - phase: 03-slash-commands
    provides: plans 03-01 through 03-08 (the commands bridge, the invocation handler, the project ledger, the object map) and their SUMMARYs
  - phase: 02-skills
    provides: the D-CF2-10 Pi gap report draft and the decision-row and parent-line formats (02-07-SUMMARY)
provides:
  - the phase gate record on the combined Phase 3 tree
  - thirteen ready-to-paste PROJECT.md Key Decisions rows, D-CF3-01 through D-CF3-13
  - three Pi gap report sections to append to the D-CF2-10 draft
  - the parent lines for every file the phase may not edit, grouped by target
affects: [phase verification of CMD-01..05, the parent merge of the slash command branch, Phases 4 and 7 (entry-declaration re-probe)]

actuals:
  tokens: 14384
  tasks: 3
  commits: 3

plan_head_before: 52806eafaaa8baca4817e55154d4cbd69b242e4d
plan_head_after: 35f7c5f (before the Task 3 commit, which adds this frontmatter)

tech-stack:
  added: []
  patterns:
    - "A gate reuses a passing npm run check when the build inputs are byte-identical, and still runs the unit suite, two random-order cucumber runs, and fallow dupes itself"

key-files:
  created:
    - .planning/phases/03-slash-commands/03-09-SUMMARY.md
  modified: []

key-decisions:
  - "npm run check is reused from d164a80, whose build inputs equal this plan's base; the other gate commands ran on 52806ea"
  - "D-CF3-07 is Pending (user review) with D-CF2-13, D-CF3-13 is Good, the other eleven rows are Locked"
  - "The commands-bridge clone marker at bridges/commands/stage.ts:123 stays: dup:23c99c81 still spans the line below it"

patterns-established:
  - "Decision rows start with the plain ID so a row count can grep them; the parent re-bolds on paste"

requirements-completed: [CMD-01, CMD-02, CMD-03, CMD-04, CMD-05]

coverage:
  - id: D1
    description: "The combined Phase 3 tree passes the whole check, the whole unit suite, two random-order cucumber runs, and fallow dupes"
    verification:
      - kind: other
        ref: "npm run check (reused, d164a80, seed 412895, 1451 scenarios)"
        status: pass
      - kind: unit
        ref: "npm run test:modules"
        status: pass
      - kind: e2e
        ref: "npm run test:cucumber (seed 643615, 1451 passed)"
        status: pass
      - kind: e2e
        ref: "npm run test:cucumber (seed 436335, 1451 passed)"
        status: pass
      - kind: other
        ref: "npx fallow dupes --fail-on-issues --format human --quiet"
        status: pass
    human_judgment: false
  - id: D2
    description: "Thirteen D-CF3 decision rows and three Pi gap report additions, ready for the parent"
    verification: []
    human_judgment: true
    rationale: "The rows and the gap report are prose for the parent and the user; whether they are accurate and ready to file is a reviewer's judgment"
  - id: D3
    description: "Every parent line the plans handed over, in nine target groups, with no parent-owned or frozen file edited"
    verification:
      - kind: other
        ref: "diff --stat 52806ea..HEAD over CHANGELOG.md, both READMEs, BACKLOG.md, PROJECT.md, docs, and .planning/codebase (empty)"
        status: pass
    human_judgment: true
    rationale: "Completeness of the collected lines against the eight plan SUMMARYs needs a reviewer"

duration: 50min
completed: 2026-11-01
status: complete
---

# Phase 3 Plan 09: Slash command phase gate Summary

**The combined Phase 3 tree passes the gate: `npm run check` (reused from `d164a80`, same build inputs), the whole unit suite, two random-order cucumber runs (1451 of 1451 scenarios each, seeds 643615 and 436335), and `fallow dupes`. The six slash-command features hold 76 scenarios.**

## Gate record (Task 1)

Tree: commit `52806eafaaa8baca4817e55154d4cbd69b242e4d` (this plan's base, `BASE`), working tree clean. Its build inputs equal those of `d164a80`: `git diff --stat d164a80 52806ea` lists only `.planning/phases/03-slash-commands/DUBIOUS-CHOICES.md`. Node `v24.22.1`. Every npm script ran under the session's `nondac-sh` wrapper with `NODE_OPTIONS=--max-old-space-size=6144`, after `node scripts/install-test-peers.mjs` filled the peer cache (pi-mcp-adapter 7.0.0, pi-subagents 0.84.0, `@quintinshaw/pi-dynamic-workflows` 3.15.0).

| Command | Ran (UTC) | Exit | Result |
| --- | --- | --- | --- |
| `npm run check` | reused | 0 | The orchestrator's run on `d164a80`, the same build inputs (AGENTS.md: a gate can reuse a passing result for the same inputs). Static checks, unpaired tests, integration tests, cucumber seed **412895** with 1451 scenarios (1451 passed), and direct coverage of all pairs (`coverage/direct.lcov`, 324 records). This plan changes no build input, so it did not run it again. |
| `npm run test:modules` | 21:06-21:22 | 0 | The whole unit suite passed. The quiet reporter prints no counts. The only stray output is the two IL-3 `Legacy marketplace migration could not be persisted ...` lines that persistence unit cases provoke on purpose. |
| `npm run test:cucumber` (run 1) | 21:23:15-21:28:20 | 0 | Random order, seed **643615**: 16 hooks, 1451 scenarios (1451 passed), 15496 steps (15496 passed), 5m 02s |
| `npm run test:cucumber` (run 2) | 21:28:45-21:33:27 | 0 | Random order, seed **436335**: 16 hooks, 1451 scenarios (1451 passed), 15496 steps (15496 passed), 4m 40s |
| `npx fallow dupes --fail-on-issues --format human --quiet` | 21:31 | 0 | no clone group |
| `npx cucumber-js features/slash-command --dry-run` | 21:2x | 0 | 76 scenarios in the six features: `manifest-forms` 27, `invocation` 14, `listing` 11, `project-provenance` 11, `frontmatter` 7, `lifecycle` 6 (counts from `--format json`, one per scenario or Outline row) |

No command failed, so the plan made no gate fix.

Tracer gate (Task 1): auto mode off, `human_verify_mode` end-of-phase, automated-only `<verify>`. Every command of the verify chain ran green on `52806ea` (with `npm run check` reused as above), so the plan continued with Tasks 2 and 3.

### Clone markers in `bridges/commands/**`

Measured as 03-01 did. Each temporary edit was restored with `git checkout -- <file>`, and `git status --short` was empty afterwards.

| Marker | Measurement | Fate |
| --- | --- | --- |
| `bridges/commands/stage.ts:123` (above `discoverPluginCommands`) | Deleting it alone: `No code duplication found`, because the skills-side marker hides the same group. Deleting it and `bridges/skills/stage.ts:437` together: one group, `dup:23c99c81`, 28 lines, `bridges/commands/stage.ts:123-149` and `bridges/skills/stage.ts:437-464`. | kept: the group still spans the line below it |

That is the only marker in `bridges/commands/**`. One more group has a commands half: deleting the agents-side marker `bridges/agents/stage.ts:462` (Phase 4's file) shows `dup:3a2416f3`, 38 lines, `bridges/agents/stage.ts:462-499` and `bridges/commands/stage.ts:318-340`. That marker is live too. Repo-wide: 42 `fallow-ignore` markers, 24 of them `code-duplication`.

### Other measurements

- **`.fallowrc.json` (DC-13 item 6):** with the `dynamicallyLoaded` and `ignoreExports` keys deleted (each lists only the six Phase 1 cores), `npm run fallow` exits 0. The file was restored with `git checkout -- .fallowrc.json` (Parent lines, group 4).
- **`platform/pi-api.ts` types:** no production module imports `ThinkingLevel` or `InputSource`. Only `test/platform/pi-api.test.ts` uses them (Parent lines, group 5).
- **Frozen and parent-owned paths:** with `PHASE_BASE=735b9c2` (03-01's `BASE`), `git diff --stat "$PHASE_BASE"..HEAD -- CHANGELOG.md README.md README.es.md .planning/BACKLOG.md .fallowrc.json extensions/pi-claude-marketplace/index.ts extensions/pi-claude-marketplace/platform/pi-api.ts extensions/pi-claude-marketplace/bridges/skills features/skill features/support cucumber.json package.json` lists seven files: `.planning/BACKLOG.md`, `CHANGELOG.md`, `README.md`, `README.es.md`, `bridges/skills/stage.ts`, `bridges/skills/unstage.ts`, and `features/skill/project-provenance.feature`. All seven came from the milestone merge `bf0b58f`: `git log --first-parent --no-merges 735b9c2..HEAD` over those paths prints nothing, and `git log --first-parent --merges` over them prints only `bf0b58f`. Not a finding.

## Decision records (Task 2)

Ready to paste into the `.planning/PROJECT.md` Key Decisions table, after the D-CF2-14 row. Each row carries the residuals that the plans measured. Each row starts with its plain ID so that the plan's row count (`grep -cE '^\| D-CF3-(0[1-9]|1[0-3]) '`) can see it. To match the table's style, move the opening `**` in front of the ID when you paste.

| Decision | Rationale | Outcome |
| --- | --- | --- |
| D-CF3-01 (component-features, Phase 3, settled autonomously, DUBIOUS-CHOICES P3-DC-03): **a bridged command stays a Pi prompt template that only the user invokes (FG-11)**. The model's system prompt does not list it. `disable-model-invocation` on a command changes nothing in Pi and is not reported as a dropped field. | Pi capability gap. Pi 1.4.0 gives the model no way to see or run a prompt template. Staging each command again as a Pi skill would add a `/skill:<plugin>-<name>` menu entry that Claude Code does not have and that Pi cannot hide (D-CF1-09). Upstream (E1, Claude Code 2.1.316): a command with a `description` or `when_to_use` is in the model's skill list, and the model runs it through the Skill tool. Proven by "The model's system prompt lists no bridged command" (`frontmatter.feature`), whose negative edit loads the prompts directory as skills. RM-02 stays the real-model proof. Gap 1 of the Pi gap report additions below. | -- Locked |
| D-CF3-02 (component-features, Phase 3, settled autonomously, extends D-CF1-09, DUBIOUS-CHOICES P3-DC-04): **a command with `user-invocable: false` stays listed and runnable from `/` (FG-12)**. | Upstream (E2) hides and refuses the typed command but lets the model run it. In Pi the model cannot run any command (D-CF3-01), so hiding it would leave the command unreachable. Proven by two scenarios, listed and runnable, each failing under a negative edit that skips the command at staging. Residual: the user sees a command that its author hid. | -- Locked |
| D-CF3-03 (component-features, Phase 3, settled autonomously, DUBIOUS-CHOICES P3-DC-05, P3-DC-19): **a `commands` object map in `plugin.json` installs each entry as `/<plugin>:<key>` (FG-13)**. A map is an object whose first value is an object with `source` or `content` (upstream's `IKn`). The key goes through `generatedCommandName`: CM-2 elision applies, a `/` becomes a `:` segment, and case is kept. A key that ends in `:`, holds `<`, `>`, whitespace, or a `\p{Cc}` or `\p{Cf}` character, or fails RN-2 is skipped with an install warning. A `source` names a contained `.md` file that stages under the key. A directory `source` is walked, and its key and overrides are ignored. A missing, non-regular, symlinked, dot, or non-`.md` source, a second key on a file already loaded, and a generated-name collision skip the entry with `command map entry "<key>" <reason>; skipping entry.` A `content` value is an inline command whose own frontmatter is parsed. The manifest's `description` and `argumentHint` replace the file's in the staged frontmatter, a manifest `model` counts for the dropped-fields note, and `allowedTools` is ignored. Both or neither of `source` and `content`, a field of the wrong type, or an absolute, escaping, or linked `source` makes the plugin unavailable. A `plugin.json` map replaces `commands/`, with D-CF1-06's folder note. | Upstream parity (E3): validate and install accept the map, keys become `<plugin>:<key>`, the manifest fields override the file, and a malformed entry fails the install. Pi capability gap: a template's name is its file name, so a key's `/` must become `:` (gap 2 below). Residuals measured: names differ from upstream for elided keys and for `/` keys; the skip warnings are this project's, where upstream is silent or says "failed to load" in `plugin list`; `"allowedTools": "Read"` installs here, where upstream's schema needs an array of strings; a map source inside `commands/` suppresses the folder note (not probed); the install row of an unavailable map plugin shows the reason `unsupported source`, and the per-entry note stays in the resolver notes; discovery order is declared paths, then `plugin.json` map entries, then entry map entries; an inline command records the `sourcePath` `<plugin root>#commands.<key>`; a key with an inner `:` stages a file name that NTFS refuses, so that install fails on Windows (T-03-27, accepted); map warnings leave out the plugin root, because path redaction cuts a line short after a quoted absolute path; `/claude:plugin info` does not list map entries (BACKLOG CMDINFO-01). | -- Locked |
| D-CF3-04 (component-features, Phase 3, settled autonomously, corrects D-CF1-06 for commands, DUBIOUS-CHOICES P3-DC-06): **a marketplace entry's `commands` adds to the `commands/` folder**. The folder is read unless `plugin.json` declares `commands` (any truthy value, `[]` included). An entry's paths never cause the folder note. An entry map's `source` entries load, and its `content` entries are skipped with `command map entry "<key>" sets "content", which a marketplace entry cannot declare; skipping entry.` This supersedes the marketplace-entry half of D-CF1-06 for commands only. | Upstream parity (E4): the 2.1.316 binary reads the folder unless `plugin.json` declares `commands` (`let Et=!Se.commands&&Me`), no entry path clears it, and an entry map's inline content is dropped (`registerInlineContent:!1`). The docs say that a plugin with no `plugin.json` treats the entry as its manifest. The binary was followed. Residuals measured: first-wins order is `commands/`, then the `plugin.json` paths, then the entry paths (inferred from upstream's listing order); an entry's `"commands": []` still reads the folder (inferred from E4, not probed); upstream drops entry content with no message, and this project warns (the D-CF2-03 diagnostic precedent); `info` of an unavailable plugin always lists `commands/` beside the entry paths, because the lenient mirror cannot see `plugin.json`; agents and workflows keep D-CF1-06 until their own probes. | -- Locked |
| D-CF3-05 (component-features, Phase 3, settled autonomously, bug policy, DUBIOUS-CHOICES P3-DC-15): **a declared `commands` path that names a `.md` file is one command named from its basename**. `cmds/sub/x.md` lists as `/<plugin>:x`. A declared directory keeps the recursive walk. A declared symlink, non-regular file, dotfile, or non-`.md` file is skipped with `declared command path "<path>" in "<plugin>" <reason>; skipping path.`, checked in that order. FG-14's replace rule for `plugin.json` (D-CF1-06) is pinned in `manifest-forms.feature`. | Upstream parity (E5): `"commands": "./cmds/a.md"` and `["./cmds/a.md", "./more"]` load the file as `<plugin>:a` and walk the directory. Before this decision the walk found nothing in a declared file. Residuals measured: CM-2 elision applies to a declared file (`demo-a.md` lists as `demo:a`, where upstream lists `demo:demo-a`, D-141-01); a non-`.md` file warns, where upstream is silent; `/claude:plugin info` does not list a declared command file (BACKLOG CMDINFO-01); Phase 2's `commandUpstreamNames` reads each commands path as a directory, so a declared command file adds no name to the D-CF2-03 clash check (Phase 2 parent line). | -- Locked |
| D-CF3-06 (component-features, Phase 3, settled autonomously, pins D-CF1-01, D-CF1-02, D-CF1-03, DUBIOUS-CHOICES P3-DC-08, P3-DC-09, P3-DC-14): **a typed bridged command goes through `orchestrators/command-invocation.ts` (`invokeStagedCommand`)**. `edge/command-invocation.ts` handles `interactive` and `rpc` input. `extension` input, text that does not start with `/`, and a token that Pi does not list as a `prompt` command pass through. For a template that this extension staged in either scope, the handler refuses an untrusted project's command before it reads anything, then reads and parses the staged file once. It fills the body with `substituteArguments`: the arguments are the trimmed rest of the line (`""` when none), with `parseArgumentNames(frontmatter.arguments)` and the variables `CLAUDE_SESSION_ID`, `CLAUDE_EFFORT`, `CLAUDE_PROJECT_DIR` at project scope, and `CLAUDE_PLUGIN_ROOT` and `CLAUDE_PLUGIN_DATA` from the install-time record. Then `expandContextInjections` runs with the shell from `selectPromptShell`. The body is the `transform` text, with images kept. A failed `!` command, an oversized invocation, a missing Bash, or a staged file that cannot be read or parsed aborts as a `usage-error` whose origin is `{kind: "command", commandId: "<plugin>:<command>"}`, and nothing reaches the model. | Upstream parity (E6): `/probe-plugin:deploy one two` sends the substituted body `Deploy one two now`, and with no arguments `$ARGUMENTS` is empty. Pi's own expansion is 1-based and appends nothing. A command the user wrote keeps Pi's expansion. Residuals measured: Claude Code's `<command-message>`, `<command-name>`, and `<command-args>` tag block is not added (D-CF1-01 residual, BACKLOG CMDTAG-01); E8: a body that starts with `/<template>` is expanded again by Pi, where upstream sends it literally, and two unit cases pin this side (gap 3 below); the body is Pi's `parseFrontmatter` body, which Pi trims, and every staged command has frontmatter because the record is added last; an argument `` !`x` `` reaches the model as `` \! `x` ``; a missing Bash refuses even a body with no `!` command, as skills do (upstream not verified); the invocation also fills the three path variables in the body from the record, so a skipped install-time substitution does not show on its own; the abort's `commandId` is an open string, so no closed-set edit was needed (`docs/json-output.md` parent line). | -- Locked |
| D-CF3-07 (component-features, Phase 3, settled autonomously, follows D-CF2-13, DUBIOUS-CHOICES P3-DC-09, P3-DC-10, P3-DC-17, P3-DC-18): **a project-scope bridged command runs only when Pi trusts the project and the user-scope ledger lists its generated name with the SHA-256 of the staged file as it is now**. The ledger is Phase 2's `<agentDir>/pi-claude-marketplace/project-installs/<sha256(project path)>/skills.json`, with the same schema. `commandFileDigest` hashes the file's UTF-8 text from the same read that the fill uses. Otherwise the command aborts with `The command <typed> was not installed into the project <cwd> on this machine, or its file changed after the install. Reinstall its plugin into this project with <command>, then run /reload to use it.` The `<command>` is `/claude:plugin reinstall <plugin>@<marketplace> --scope project` for the plugin whose project record lists the command, or `/claude:plugin reinstall --scope project` when no record lists it or the state cannot be read. A project-scope commit records the committed names and digests, and uninstall, disable, and `marketplace remove` forget them. A ledger that this version cannot update fails a commands-only install and stays unchanged (WR-02). A removal finishes and warns `could not remove the commands from the project skill ledger: <error>` (WR-04). | Follows D-CF2-13: Claude Code records installs in the user-owned `installed_plugins.json` and skips another path's project plugin as `not_installed_here`, and a cloned repository can ship its own staged prompts and `state.json`. The abort follows D-CF2-13's current reinstall shape, not the CONTEXT literal ("Install its plugin into this project with --scope project"), because `install` refuses a plugin that the project state already records. The commands bridge takes the ledger writer from its orchestrator callers and imports nothing from `bridges/skills/`. Residuals measured: the digest covers only the staged command file, not a plugin-root script that a `!` command runs, where the skills digest covers the whole staged directory (T-03-23, BACKLOG CMDDIGEST-01); an update whose later phase fails keeps the new digests, as for skills (T-03-18); a `prune` rollback restores staged command files but not their ledger entries (BACKLOG LEDGERPRUNE-01); the shared file and its names say "skill" (Phase 2 rename line); a command name never equals a skill name, because it holds `:` on POSIX and `.` on Windows, and a skill name is `a-z0-9-`; the check order is find, trust, read and parse, ledger, fill, so a file that cannot be parsed refuses with `Cannot read the command ...` before the ledger is read; the state is read only to word the refusal, with `persistMigration: false`; an install undo after a failed ledger write drops its own forget warning; a project command installed before this release aborts until its plugin is reinstalled (CHANGELOG line). | -- Pending (user review, with D-CF2-13) |
| D-CF3-08 (component-features, Phase 3, settled autonomously, pins FG-06 and D-CF1-04, DUBIOUS-CHOICES P3-DC-09, P3-DC-12): **when a command has no non-empty string `description` and no map override, install writes `descriptionFallback(body, "Plugin command")` into the staged frontmatter**, so Pi's 60-character rule never applies. A degraded command (CMD-01) gets the fallback too. The staged frontmatter is rebuilt as one `"<key>": <JSON>` line per key, ends with the `pi-claude-marketplace` record (`pluginRoot`, `pluginData`), and is read back with Pi's parser before it is written. | Upstream parity: Claude Code's `A2e` takes the first body line, cuts it at 100 characters, and falls back to `Plugin command`. Proven through Pi's `get_commands` listing (the first line, the heading text, the 100 and 101-character rows, the empty body, and the degraded command). Residuals measured: the fallback reads the body after CM-3 substitution and the reference rewrite, where upstream reads the raw body, which differs only when the first line names `${CLAUDE_PLUGIN_ROOT}` or a sibling reference; a frontmatter that parses to a list or a scalar is dropped with no warning; a frontmatter key over 1024 characters (an explicit `? key`) fails the install with `BridgeStagingError`, because the rebuild makes it an implicit key; a non-finite YAML number stages as `null`; a second byte-order mark is stripped, as Pi does; every staged command's bytes change; a command staged before this release keeps Pi's 60-character cut, and a typed argument that names `${CLAUDE_PLUGIN_ROOT}` stays literal, until the plugin is updated or reinstalled (CHANGELOG line). | -- Locked |
| D-CF3-09 (component-features, Phase 3, settled autonomously, pins D-CF1-05, DUBIOUS-CHOICES P3-DC-13): **the commands bridge adds `[<source>] dropped fields: <fields>` to its discovery warnings, one line per command, in frontmatter key order**. It reads the frontmatter that the PARSE-01 gate parsed, before substitution. A command whose frontmatter does not parse gets the CMD-01 warning instead. A map `model` counts. `allowed-tools`, `arguments`, `shell`, `argument-hint`, `user-invocable`, `disable-model-invocation`, and `description` are never reported. | Pins D-CF1-05: `model`, `effort`, `agent`, `context`, `background`, `hooks`, `paths`, and `disallowed-tools` have no Pi equal. Proven by the tracer, the eight-field order scenario, and the honored-fields scenario, with negative edits that reverse the order and that also report `allowed-tools`. Residuals measured: only `install` is scenario-proven, although the line rides every staging verb's discovery channel; the line names keys only, never a value (T-03-05). | -- Locked |
| D-CF3-10 (component-features, Phase 3, settled autonomously, DUBIOUS-CHOICES P3-DC-13): **`argument-hint` passes through to Pi, which shows it only in its terminal slash menu as the hint, an em dash, and the description (`<environment> -- [t] Deploys the branch.` in the scenario)**. A map `argumentHint` replaces the file's. `${CLAUDE_PLUGIN_ROOT}`, `${CLAUDE_PLUGIN_DATA}`, and `${CLAUDE_PROJECT_DIR}` keep their install-time substitution (CM-3, SUB-02). `${CLAUDE_SESSION_ID}` and `${CLAUDE_EFFORT}` are filled at invocation. | Upstream parity (E7): the hint is not in the stream or the model request, only in the SDK `initialize` list and the menu. Pi's `get_commands` does not carry it, so the scenario reads the TUI autocomplete. Residuals measured: the scenario writes Pi's em dash as `--`, because the repository's `fix-unicode-dashes` hook rewrites an em dash in a feature file, so a description that holds `--` cannot be told apart from the join; the menu table lists Phase 2's `demo:demo-skill` alias row; the parser slices 120-column rows (the PTY width of `pi-tui-pty.py`); `[t]` is Pi's source tag for an extension-discovered template; `${CLAUDE_EFFORT}` reads `low` in the profile Pi with the faux model. | -- Locked |
| D-CF3-11 (component-features, Phase 3, settled autonomously, DUBIOUS-CHOICES P3-DC-16): **disable, uninstall, update, and enable of a plugin take effect for its commands in a new session**. Disable and uninstall remove the command from Pi's listing, a disabled `/demo:greet` reaches the model as the typed text, enable lists it again, and update lists the new description and sends the new body. A project command stays runnable after reinstall, update, and disable followed by enable. | They take effect at `/reload`, not upstream's `/reload-plugins` (NFR-2 as amended by APL-D2). No product change was needed. Each scenario failed under a temporary negative edit: skipping the command unstage in `cascadeUnstagePlugin`, skipping the commands phase on enable, keeping the old staged file on update, and a no-op ledger in the shared update commit. | -- Locked |
| D-CF3-12 (component-features, Phase 3, settled autonomously): **the listing pins**: CM-2 elision (`demo-lint.md` in plugin `demo` lists as `/demo:lint`, D-141-01 and D-141-02) and the CM-4 dotfile skip stay recorded divergences, and a nested `build/web.md` lists as `/demo:build:web` (C1, a match). | Each pin failed under a negative edit (a `-` join, no elision, dotfiles kept). Residual measured: two checks skip a dotfile, the walk in `bridges/commands/discover.ts` and `shared/fs-utils.ts::isPlainMarkdownFile`, so the dotfile proof had to disable both. | -- Locked |
| D-CF3-13 (component-features, Phase 3, settled autonomously, DUBIOUS-CHOICES P3-DC-10, P3-DC-20): **Phase 3 also owned `orchestrators/command-invocation.ts` and the new commands-bridge modules `staged-command.ts`, `command-record.ts`, and `project-ledger.ts`, with their tests**. It edited only the commands arms of `domain/component-paths.ts` and `orchestrators/plugin/info.ts`, added the optional `commandMap` member to `ComponentPathsSchema` in `domain/resolver-types.ts`, and passed the ledger writer through three call sites (`orchestrators/plugin/install-outcome.ts`, `orchestrators/plugin/update-swap.ts`, `orchestrators/marketplace/shared.ts`). It did not edit `features/lib/pi-tui.ts`, `domain/name.ts`, `index.ts`, the frozen Phase 1 cores, or Phase 2's files. | The ROADMAP keeps the resolver change inside the commands arm. The commands bridge may not import `bridges/skills/` (fallow zones), so the orchestrator call sites pass Phase 2's `NODE_PROJECT_SKILL_LEDGER`, which satisfies the bridge's own structural `ProjectCommandLedger`. Residuals measured: the `resolver-types.ts` edit (03-08) is outside the ownership this row first listed; non-owned test edits are `test/index.test.ts` (03-03), `test/architecture/declared-component-path-overlap.test.ts` (03-08), and the plan-listed `test/orchestrators/marketplace/shared.test.ts` (03-06); the orchestrator's combined-tree fix `d164a80` restructured `bridges/commands/unstage.ts` (`unlinkIfPresent`) to end a clone group with Phase 2's `bridges/skills/unstage.ts`. | ✓ Good |

## Pi gap report additions (append to D-CF2-10's draft, not filed)

This phase did not post these additions. It holds no credential for Pi's tracker, and a public post on the user's behalf is the user's call (D-CF2-10). Append the text below to the D-CF2-10 draft in `.planning/phases/02-skills/02-07-SUMMARY.md` ("Pi gap report"), after its section 3, so that one issue at https://github.com/earendil-works/pi/issues covers skills and commands. Then widen the draft's title, for example: "Skills and prompt templates: no per-skill hide, no display names or aliases, no hook when the model loads a skill, no model access to templates, and a second expansion after an input transform".

---

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

## Parent lines (Task 3)

Each line is ready to apply when the parent merges this branch. This phase edited none of these files: `git diff --stat 52806ea..HEAD -- CHANGELOG.md README.md README.es.md .planning/BACKLOG.md .planning/PROJECT.md docs .planning/codebase` prints nothing.

### 1. `CHANGELOG.md`

Add these sub-bullets under the milestone's top line in `## [Unreleased]` (the line that starts "The extension now needs Pi 1.4.0 or newer"), after the skill lines. They follow `.agents/skills/changelog/rules/entries.md`: one sentence each, a second only where the reader must act.

```markdown
  - A command with no `description` is now listed with Claude Code's text: the first line of its body, or `Plugin command` for an empty body.
  - Install now warns about the command frontmatter fields that Pi cannot honor, such as `model` or `effort`, with one line for each command.
  - Typed commands now fill in arguments, `${CLAUDE_*}` variables, and `` !`command` `` output as Claude Code does, in the terminal UI and over RPC.
  - A failing `` !`command` `` now stops its command with Claude Code's message, and the model gets nothing.
  - A plugin's `commands` can now name single command files, and an object map of commands from files or inline text, as in Claude Code.
  - A marketplace entry's `commands` now adds to the `commands/` folder instead of replacing it, as in Claude Code.
  - A project-scope command now runs only when you installed its plugin into the project on this machine. For a project command installed earlier, run `/claude:plugin reinstall <plugin>@<marketplace> --scope project` once.
  - Commands installed earlier keep their old description, and typed arguments keep `${CLAUDE_PLUGIN_ROOT}` literal, until you update or reinstall their plugin. Then run `/reload`.
```

The existing sub-bullet "A declared `commands`, `agents`, or `workflows` path now replaces the conventional folder, as in Claude Code, and install and update warn when that folder exists." stays. It is still true for `plugin.json` and for agents and workflows. The marketplace-entry line above, placed right after it, narrows it for commands (D-CF3-04). Run `pre-commit run --files CHANGELOG.md` after applying.

### 2. `README.md` and `README.es.md`

None. No passage about bridged commands became wrong. Evidence: `grep -n -i 'command' README.md` and `grep -n -i 'comando' README.es.md`, leaving out `/claude:plugin` lines, find only the component list ("Commands." / "Comandos."), the name-mapping lead and table (lines 103-111 and 101-109), and the skill-alias paragraph. The table rows (`/foo:bar`, the elided `foo-bar` row, and the Windows `.` form) still hold (D-CF3-12). Neither README describes descriptions, arguments, declared paths, or the project check, so nothing there is out of date. A future README pass could add a short "Commands" note, but no line is required by this phase.

### 3. `.planning/BACKLOG.md`

Append after the last entry:

```markdown
## CMDNAME-01: command frontmatter `name` aliases

Deferred by component-features Phase 3 (03-CONTEXT E9, DUBIOUS-CHOICES P3-DC-07). Claude Code gives a plugin command with a frontmatter `name` the aliases `/<plugin>:<name>` and, for a name with no `:`, the bare `/<name>`, as it does for skills. The commands bridge stages only `/<plugin>:<file name>`. Resolving the aliases in `edge/command-invocation.ts`, as D-CF2-02 does for skills, would close the gap.

## CMDTAG-01: Claude Code's command tag block

Deferred by component-features Phase 3 (D-CF3-06, D-CF1-01 residual, P3-DC-08). Claude Code sends a typed command as a `<command-message>`, `<command-name>`, and `<command-args>` tag block followed by the substituted body. Pi sends only the body. Adding the block in the command invocation would match upstream's framing for the model.

## CMDMODEL-01: commands for the model

Deferred by component-features Phase 3 (D-CF3-01, P3-DC-03). Claude Code lists a plugin command with a description in the model's skill list and lets the model run it through the Skill tool. Pi gives the model no access to prompt templates. Trigger: Pi adds model access to templates (gap 4 of the Pi gap report, appended to D-CF2-10).

## CMDINFO-01: `info` lists declared command files and map entries

Deferred by component-features Phase 3 (D-CF3-03, D-CF3-05 residuals). `discoverComponentNames` in `orchestrators/plugin/info.ts` reads declared command directories only, so a declared `.md` file and an object-map entry install but are not listed by `/claude:plugin info` of a plugin read from its source. The state-only view reads the recorded names and is not affected.

## LEDGERPRUNE-01: restore ledger entries on a `prune` rollback

Deferred by component-features Phase 3 (D-CF3-07 residual, P3-DC-17 item 5). When a `prune` rolls back, `orchestrators/plugin/prune-rollback.ts` restores the staged skill and command files but not their entries in the user's project ledger, so a restored project skill or command aborts until its plugin is reinstalled.

## CMDDIGEST-01: plugin-root scripts in the command digest

Deferred by component-features Phase 3 (D-CF3-07 residual, T-03-23). The project-command digest covers only the staged command file. A script under the plugin root that a `!` command runs is not covered, so a changed script still runs. The skills digest covers the whole staged skill directory but not the plugin root either (D-CF2-13 residual AR-02-05).

## CMDSKILLMD-01: a `SKILL.md` inside `commands/`

Deferred by component-features Phase 3 (03-CONTEXT E9). Claude Code loads a `SKILL.md` found inside `commands/` as a skill named after its folder. The commands walk has no `SKILL.md` rule, so `commands/x/SKILL.md` stages as the command `<plugin>:x:SKILL`.
```

The last entry goes beyond the plan's list of six. It records the second E9 item that 03-CONTEXT's Deferred Ideas name. Drop it if the parent prefers.

### 4. Docs and conventions

**`docs/json-output.md`**, "Origin" section, after the paragraph that starts "A bridged plugin skill that stops when you invoke it":

```markdown
A bridged plugin command that stops when you invoke it reports a `usage-error` whose `origin.commandId` is the command's name without its slash, such as `demo:greet`. This happens when a `` !`command` `` fails, the invocation is too large, Bash is missing, or the command file cannot be read. A project command also stops when Pi does not trust the project, when this machine has no record of its install, or when its file changed after the install. Nothing reaches the model (D-CF3-06, D-CF3-07).
```

**`docs/env-vars.md`**, "Commands content":

- Add this lead sentence after "Command content does not resolve `${CLAUDE_SKILL_DIR}` (skill-scoped).": "When the user invokes a command, a typed argument that names `${CLAUDE_PLUGIN_ROOT}`, `${CLAUDE_PLUGIN_DATA}`, or, at project scope, `${CLAUDE_PROJECT_DIR}` is filled in from the values that install recorded (D-CF3-06). Commands installed before this release have no record, so such an argument stays literal until the plugin is updated or reinstalled."
- Add two rows to the table:
  - `` `${CLAUDE_SESSION_ID}` `` | ✓ | ✓ | Replaced with the Pi session id when the user invokes the command (D-CF1-01, D-CF3-06). The model cannot run a command (D-CF3-01).
  - `` `${CLAUDE_EFFORT}` `` | ✓ | ✓ | Replaced at invocation with the thinking level of the Pi session: `low`, `medium`, `high`, `xhigh`, and `max` as themselves, `off` and `minimal` as `low`, and an unknown level as `high` (D-CF1-01, D-CF3-06).
- "Not delivered (out of scope)": the `CLAUDE_EFFORT` bullet ("deferred (EFRT-01)") is now out of date for skill and command content, which fill `${CLAUDE_EFFORT}` at invocation. Narrow it to the environment variable, which is still not set.
- The Phase 2 note about the overview matrix (no legend letter for "filled at invocation") applies to the Commands column too.

**`docs/prd/pi-claude-marketplace-prd.md`**, section 5.6 (Commands Bridge):

- CM-3, replace with: "Variable substitution (`${CLAUDE_PLUGIN_ROOT}`, `${CLAUDE_PLUGIN_DATA}`, and, at project scope, `${CLAUDE_PROJECT_DIR}`) MUST apply to command bodies at install. A typed command MUST fill its arguments with Claude Code's rules and `${CLAUDE_SESSION_ID}` and `${CLAUDE_EFFORT}` at invocation, then run its `` !`command` `` lines; a failure aborts with nothing sent to the model (D-CF3-06)."
- CM-4, append: "A declared `commands` path that names a `.md` file is one command named from its basename (D-CF3-05). A marketplace entry's `commands` adds to `commands/`; only a `plugin.json` declaration replaces it (D-CF3-04)."
- Add **CM-5**: "A command without a non-empty `description` MUST be staged with Claude Code's fallback, `descriptionFallback(body, "Plugin command")`, and install MUST report the frontmatter fields Pi cannot honor as `[<source>] dropped fields: <fields>` (D-CF3-08, D-CF3-09)."
- Add **CM-6**: "A `commands` object map in `plugin.json` MUST install each entry as `<plugin>:<key>` from its `source` file or inline `content`, with the manifest's `description`, `argumentHint`, and `model` applied; a malformed entry makes the plugin unavailable (D-CF3-03)."
- Add **CM-7**: "A project-scope command MUST run only when Pi trusts the project and the user-scope ledger lists its name with the digest of its staged file (D-CF3-07)."
- Section "Custom component-path arrays as supplemental" (line 1069, open items): append "For commands, a marketplace entry's declaration now supplements the folder (D-CF3-04); a `plugin.json` declaration still replaces it, as in Claude Code."

**`.planning/codebase/CONVENTIONS.md`**, "Suppressions": no change. Measured on this tree: `grep -rn fallow-ignore extensions test scripts | wc -l` = 42, of which 24 are `fallow-ignore-next-line code-duplication`. The doc says 42 and 24. It lists "the commands and skills bridge pair in `stage.ts`" and "the agents and commands commit-and-rollback shape", and both groups are still live (Gate record, marker table). The doc's sentence about the `ThinkingLevel` and `InputSource` exports "which no module imports yet" changes if the parent applies group 5.

**`.fallowrc.json`** (DC-13 item 6): remove the `dynamicallyLoaded` key and the `ignoreExports` key. Each lists only the six Phase 1 cores. Measured on `52806ea`: with both keys deleted, `npm run fallow` exits 0 (rule-pack test, both dead-code runs, health, dupes). The cores are now reachable from `index.ts` through both invocation handlers. The file was restored with `git checkout -- .fallowrc.json`.

### 5. `extensions/pi-claude-marketplace/platform/pi-api.ts`

The two `fallow-ignore-next-line unused-type` markers (above `ThinkingLevel` and `InputSource`) say that the invocation handlers are the types' consumers. Neither handler imports them: `edge/command-invocation.ts` calls `pi.getThinkingLevel()` and compares `event.source` with literals, and only `test/platform/pi-api.test.ts` uses the two types. The parent picks one:

- Wire the types: import `InputSource` in `edge/command-invocation.ts` and `edge/skill-aliases.ts` for the source filter, and `ThinkingLevel` where the effort is mapped, then delete both markers (fallow would report them as stale otherwise).
- Drop the types: delete the two exports, their markers, and the four type checks in `test/platform/pi-api.test.ts`.

The first keeps NFR-11's rule that Pi types come through the boundary.

### 6. Phase 2 (its files)

- **Rename the shared ledger names**, now that commands share them: the file `skills.json` (under `<agentDir>/pi-claude-marketplace/project-installs/<sha256>/`), `ProjectSkillLedgerError` and its wording "The project skill ledger ...", `NODE_PROJECT_SKILL_LEDGER`, `provenProjectSkills`, the WR-04 outcome member `skillWarnings` (`orchestrators/marketplace/shared.ts`, which now also carries the commands warnings), the commands warning `could not remove the commands from the project skill ledger: ...` (in `bridges/commands/unstage.ts`, Phase 3), and the step texts "the user's record of project skill installs ...". A neutral form: `project-installs.json`, `ProjectInstallLedgerError`, `NODE_PROJECT_INSTALL_LEDGER`, `provenProjectInstalls`, `ledgerWarnings`, "the user's record of project installs". A file rename needs a reader for both names. The commands side's structural `ProjectCommandLedger` needs no change.
- **D-CF2-03 clash check**: `bridges/skills/skill-names.ts::commandUpstreamNames` reads each `componentPaths.commands` entry as a directory and does not read `componentPaths.commandMap`. So neither a declared command file (D-CF3-05) nor an object-map key (D-CF3-03) adds a name to the skill-command clash set. A skill with the same name as such a command is staged, and both names reach Pi.
- **State read difference**: `orchestrators/skill-invocation.ts` loads the state with a persisted migration to word its reinstall line, while `orchestrators/command-invocation.ts` reads a snapshot (`persistMigration: false`). Make the skills side read-only too, or record why it saves.
- **Clone markers**: no stale marker remains on either side. The milestone's marker cleanup (merge `bf0b58f`) removed the stale `bridges/skills/stage.ts` and `bridges/skills/unstage.ts` markers that 03-01 reported. The live `bridges/skills/stage.ts:437` marker still spans `dup:23c99c81`.

### 7. Phases 4 and 7

- Re-probe marketplace-entry declarations for agents and workflows on Claude Code 2.1.316. D-CF3-04 found that the binary reads `commands/` unless `plugin.json` declares `commands`, and that an entry's declaration adds to the folder. That corrected the entry half of D-CF1-06 for commands only. If `agents` and `workflows` behave the same, D-CF1-06's entry half is wrong for them too, and so is the CHANGELOG line "A declared `commands`, `agents`, or `workflows` path now replaces the conventional folder".

Also handed over by the plans, to other owners:

- **Hooks (the hooks bridge owner)**: `features/hook/tool-use.feature:26` expects `CLAUDE_PLUGIN_DATA={project dir}/.pi/pi-claude-marketplace/data/demo`. Commands and skills record `pluginDataDir(mp, plugin)`, which is `data/<marketplace>/<plugin>` (`data/fixtures/demo`). Check whether the hooks bridge uses a different data root, and which one is right (03-03).
- **`shared/redact-absolute-paths.ts` (its owner)**: when quoted text follows a quoted absolute path on one line, the redaction replaces the rest of the line with `[redacted path]`. That cuts the commands walk's duplicate and subdirectory warnings short (03-08). The map warnings avoid it by leaving out the plugin root.
- **REQUIREMENTS.md and ROADMAP.md (the orchestrator)**: CMD-01..05 are each declared by more than one plan (CMD-02 by 03-03, 03-06, and 03-07; CMD-05 by 03-05 and 03-06). Mark them after this plan's SUMMARY lands.
- **Commit trailers (the parent)**: 03-02's commits end with `Claude-Session: https://claude.ai/code/session_01EDUMG8nFuockQFTkJixpie` instead of `session_01EDUMG5ARYqF6oZYKmj6oB3` (P3-DC-13 item 6). History is not rewritten.
- **`.planning/DUBIOUS-CHOICES.md` (the parent)**: fold `.planning/phases/03-slash-commands/DUBIOUS-CHOICES.md` (P3-DC-01..20) into the root file, plus this plan's own choices (below, as a P3-DC-21 entry) and the plan choices that the phase log does not hold yet (the last list of group 9).
- **`.planning/PROJECT.md` (the parent)**: the thirteen D-CF3 rows above, after D-CF2-14. Add a "Validated" line: "✓ Bridged slash commands have behavioral tests: Pi lists each command as `/<plugin>:<name>` with Claude Code's description fallback, a typed command fills its arguments, `${CLAUDE_*}` variables, and `!` commands as Claude Code does and reports the fields Pi cannot honor, declared files, marketplace-entry paths, and object maps install, a project command runs only when this machine recorded its install, and disable, uninstall, update, and enable change what a new session offers; the divergences are D-CF3-01..13 -- component-features Phase 3, 2026-11-01 (CMD-01..05)." Add a "Last updated" footer for Phase 3, and append the three gap sections to the D-CF2-10 draft (Decision records, gap report additions above). D-CF2-10's outcome stays "Pending (user files)".

### 8. `.agents/skills/claude-code-compat-research`

In `SKILL.md`, "Sandboxed probes", add after the paragraph that starts "Scrub the ambient environment":

```markdown
Run every probe inside a network namespace that has only loopback, for example `unshare -rn`, and point the binary at a local HTTP stub with a dummy key. A scrubbed environment and a throwaway `HOME` do not stop the binary from calling its built-in API address: Claude Code 2.1.316 fetched `https://api.anthropic.com/api/claude_code/policy_limits` under `env -i` and ignored `ANTHROPIC_BASE_URL` for that call. Start inside the namespace, not after the first networked run.
```

Source: P3-DC-02 and `03-UPSTREAM-EVIDENCE.md` ("Isolation gap"). The Phase 3 research re-ran its core probes in `unshare -rn` with identical results.

### 9. Non-owned test edits and the plans' dubious choices

Non-owned test edits made by this phase (each limited by its plan's `git diff` criterion):

| Plan | File | Scope (`git diff <plan base>..<plan head> -- <file>`) |
| --- | --- | --- |
| 03-03 | `test/index.test.ts` | `CommandInvocationListener` may return a Promise; `LoadedExtension` and the `loadExtension` return object expose `pi`; the D-CF1-01 case stubs `pi.getCommands()` to `[]` once and keeps its `{ action: "continue" }` assertion. Base `0ab69e5`. `index.ts` unchanged. |
| 03-06 | `test/orchestrators/marketplace/shared.test.ts` (plan-listed) | the WR-04 case's ledger setup moved into `seedUnknownProjectLedger(cwd)`; its expected value adds `dropped.commands` (`["sample-command"]`) and the commands warning; one new case for a commands-only record. Base `1c40e4f`. |
| 03-08 | `test/architecture/declared-component-path-overlap.test.ts` (unpaired) | one expected discovered command gains `kind: "file"`, because `DiscoveredCommand` is a union. Base `f7fcf84`. |

The phase's other test edits are in the pairs of the files it owns or edits in their commands arms (`test/bridges/commands/**`, `test/orchestrators/command-invocation.test.ts`, `test/edge/command-invocation.test.ts`, `test/domain/component-paths.test.ts`, `test/domain/resolver-types.test.ts`, `test/orchestrators/plugin/info.test.ts`). Measured with the phase-files script over the eight executor merges and the first-parent commits since `735b9c2`, leaving out the milestone merge `bf0b58f`.

Each plan's dubious choices are logged in the phase file `DUBIOUS-CHOICES.md`: 03-01 as P3-DC-12, 03-02 as P3-DC-13, 03-03 as P3-DC-14, 03-04 as P3-DC-15, 03-05 as P3-DC-16, 03-06 as P3-DC-17, 03-07 as P3-DC-18, 03-08 as P3-DC-19, and the orchestrator's milestone merge and clone fix as P3-DC-20. These plan choices are in the plan SUMMARYs but not yet in the phase log, so the parent folds them in too:

- 03-04 item 5: the duplicate warning for a declared file names the file as the place where the losing source lives (`command source "a" in "<root>/other/a.md" ...`).
- 03-08 item 8: the argument-hint scenario's file sets its own `argument-hint` (`<file hint>`), so the scenario proves the override.
- 03-08 item 9: the outline row "neither source nor content" also failed before 03-08 (as a not-a-string refusal), so its proof is the negative edit, not a red run.
- 03-08 item 10: the unavailable outline shows the reason `unsupported source` for all three rows; the unit cases tell the notes apart.

## Performance

- **Duration:** about 50 min
- **Started:** 2026-11-01T21:05Z (base commit `52806ea`)
- **Completed:** 2026-11-01T21:55Z
- **Tasks:** 3 of 3
- **Files modified:** 1 (this SUMMARY, created)
- **Baseline:** `BASE=52806eafaaa8baca4817e55154d4cbd69b242e4d`. The phase base (03-01's `BASE`) is `735b9c2d088b9c77fc1472bc0965dbf2d68a61fc`.

## Task Commits

1. **Task 1: Pass the phase gate on the combined tree** - `7421e17` (docs)
2. **Task 2: Write the D-CF3 decision rows and the Pi gap report additions** - `35f7c5f` (docs)
3. **Task 3: Collect the parent lines** - the commit that adds this text and completes the frontmatter (docs)

## Files Created/Modified

- `.planning/phases/03-slash-commands/03-09-SUMMARY.md` - the gate record, the thirteen D-CF3 decision rows, the three Pi gap report additions, and the parent lines

## Decisions Made

- **Gate reuse.** `npm run check` is the orchestrator's passing run on `d164a80`. This plan's base adds only a planning document, and this plan adds only this SUMMARY, so no build input differs.
- **Outcomes.** D-CF3-07 is "Pending (user review, with D-CF2-13)", because it follows D-CF2-13, which waits for user review. D-CF3-13 is "✓ Good", as D-CF2-12 is for Phase 2. The other eleven rows are "-- Locked".
- **Abort shape.** D-CF3-07's row states that the abort follows D-CF2-13's current reinstall shape, as 03-07 built it.

## Deviations from Plan

### Format adjustment

**1. [Plan criterion versus table style] Decision rows start with the plain ID**
- **Found during:** Task 2
- **Issue:** The acceptance grep `^\| D-CF3-(0[1-9]|1[0-3]) ` needs the ID right after the pipe, but PROJECT.md's rows open with `**D-CF...`.
- **Fix:** Each row starts `| D-CF3-NN (component-features, ...): **<decision>**.` The table's lead sentence tells the parent to move the opening `**` in front of the ID when it pastes.
- **Committed in:** `35f7c5f`

No product, test, or frozen file changed. No gate fix was needed.

**Total deviations:** 1 (format). **Impact:** none on content.

## Issues Encountered

- The worktree guard refuses shell commands that compute values at runtime or chain `git` in compound forms. Every npm and npx run went through a scratch wrapper (`exec-03-09/run.sh`), and the phase-files listing through `exec-03-09/phase-files.sh`, which uses `git -C <worktree>` only.
- Inside the worktree the commit hook prints "(no files to check)" for `.planning/` files, as expected. This plan commits no build input.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

T-03-28 is mitigated: the gap report additions are drafted here only and were not posted. T-03-29 holds: no gate fix was made, so no test was weakened, skipped, or loosened.

## Dubious Choices

This plan's own choices (a P3-DC-21 entry for the parent):

1. **Rows start with the plain ID**, to satisfy the plan's row count, so a paste needs one small style edit (Deviations).
2. **`npm run check` was reused, not run again.** AGENTS.md allows it for the same inputs, and the orchestrator's brief asked for it. A reviewer who wants a fresh full run on this exact commit must run it.
3. **Temporary measurement edits in files this phase may not edit.** The DC-13 measurement deleted two keys from `.fallowrc.json`, and the marker measurement deleted the markers in `bridges/skills/stage.ts` (Phase 2) and `bridges/agents/stage.ts` (Phase 4). Each was restored with `git checkout -- <file>` right after the run and never staged.
4. **The gap report proposals are this plan's suggestions** (a `model-invocable` opt-in, a frontmatter `name` for templates, an `expand: false` member on `transform`), and so is the widened issue title.
5. **D-CF3-07 is marked Pending** because D-CF2-13 is. The parent might lock it with D-CF2-13 or on its own.
6. **An extra BACKLOG entry, CMDSKILLMD-01**, beyond the six the plan lists.
7. **The CHANGELOG lines add a marketplace-entry line beside the Phase 1 "declared path replaces" line** instead of rewriting that line, because the Phase 1 line stays true for `plugin.json`, agents, and workflows.
8. **`npm run test:modules` reports no counts**, because the project's quiet reporter prints only failures. The exit status is the evidence.

The plans' dubious choices are in the phase log as P3-DC-12 through P3-DC-19, and the orchestrator's as P3-DC-01, P3-DC-02, P3-DC-09 through P3-DC-11, and P3-DC-20. The plan choices that the log does not hold yet are listed at the end of Parent lines, group 9.

## Next Phase Readiness

- Phase complete. The parent applies the decision rows, the gap report additions, and the parent lines at merge, and the user decides whether to file the Pi gap report.
- Phase verification can read CMD-01..05's evidence from the eight plan SUMMARYs and the gate record above.

## Self-Check: PASSED

- FOUND: `.planning/phases/03-slash-commands/03-09-SUMMARY.md`
- FOUND commits on this branch: `7421e17`, `35f7c5f` (ancestors of HEAD)
- Task 1: every command exits 0, and the dry run lists `listing`, `frontmatter`, `invocation`, `manifest-forms`, `lifecycle`, and `project-provenance`
- Task 2: `grep -cE '^\| D-CF3-(0[1-9]|1[0-3]) '` prints 13, and the gap section has three subsections (4, 5, 6)
- Task 3: Parent lines has the nine groups, and `git diff --stat 52806ea..HEAD -- CHANGELOG.md README.md README.es.md .planning/BACKLOG.md .planning/PROJECT.md docs .planning/codebase` prints nothing

---
*Phase: 03-slash-commands*
*Completed: 2026-11-01*
