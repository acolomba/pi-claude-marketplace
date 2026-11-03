# Upstream evidence record: Claude Code plugin agents (subagents)

Research date: 2026-11-01. Researcher: subagent for pi-claude-marketplace (FG-15..FG-18, A15, AGT-06).
Method: `.agents/skills/claude-code-compat-research/SKILL.md` (binary first, docs second, sandboxed probe last).

## Sources and conventions

- **Binary:** `/opt/claude-code/bin/claude`, `claude --version` = `2.1.316 (Claude Code)`, build
  metadata `BUILD_TIME:"2026-10-30T23:28:13Z"`, `GIT_SHA:"cd7ceb459c6864567b16a11f60101b24421475c1"`
  (binary offset 273262204). A Bun bundle. The minified JS is split into `/$bunfs/root/chunk-*.js`
  modules, and each starts with `// @bun @bytecode`. The function names below (`Van`, `xz`, ...) are
  minified names in this build. Every offset is an **absolute byte offset into the binary**. To
  re-check one, read a window there (`dd if=/opt/claude-code/bin/claude bs=1 skip=<off-2000> count=6000 | strings`).
  The full offset index is in `ev/00-offset-index.txt`, and the raw code windows are in `ev/*.txt`
  (both next to this file). The helper scripts `w.py` and `modfind.py` read a source extract that
  was deleted at cleanup. To recreate it, run
  `dd if=/opt/claude-code/bin/claude of=src.bin bs=1M skip=260` (extract offset + 272629760 =
  binary offset).
- **Docs** (fetched 2026-11-01): <https://code.claude.com/docs/en/sub-agents>,
  <https://code.claude.com/docs/en/plugins-reference> (now titled "Plugin manifest reference"),
  <https://code.claude.com/docs/en/plugins/components>, <https://code.claude.com/docs/en/permissions>,
  <https://code.claude.com/docs/en/settings>.
- **Probes** (2026-11-01, 2.1.316): `claude plugin validate`. Also `claude -p` against a local stub
  Anthropic API that records requests (`probe-evidence/stub.py`), plus one interactive run in a
  PTY. Fixtures come from `probe-evidence/mkfx.py`. The condensed outputs are in `probe-evidence/*.txt`.
  Env: `env -i PATH HOME=<scratch>/fx/home CLAUDE_CONFIG_DIR=<scratch>/fx/home/.claude-config
  ANTHROPIC_BASE_URL=http://127.0.0.1:<port> ANTHROPIC_API_KEY=<dummy>
  CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1` (`TMPDIR=<scratch>/tmp` from the fourth probe on),
  timeout 90 s. The cwd is a fixture project. See the **Isolation caveat** before trusting probe
  hygiene.

## Summary

| # | Question | Claude Code 2.1.316 behavior | Confidence |
| - | - | - | - |
| 1 | Nested plugin agent files (FG-15) | Recursive scan of `agents/` (depth cap 32, 4096-dir cap). Each subfolder becomes a name segment: `agents/review/security.md` -> `<plugin>:review:security`. Manifest `agents` must list `./...​.md` files. A directory entry fails schema validation and **the whole plugin fails to load**. A listed file loads without subfolder segments. Dotfiles and dot-dirs load. Non-`.md` is ignored (the extension test is case-insensitive). **Symlinks inside the scanned dir are skipped**, while a manifest-listed symlinked file is followed | High |
| 2 | Naming | `<plugin>:<subdirs...>:<name>`, where `name` = frontmatter `name` (<= 256 chars, no sanitizing) or the file basename minus `.md`. Frontmatter `name` replaces only the last segment. Two files with the same name in one plugin: one wins, by load order, with a debug-log duplicate report | High |
| 3 | Priority (A15) | Override order: built-in < plugin < user < project < `--agents` < managed. Plugin agents never collide with user/project/built-in agents, because non-plugin names may not contain `:`. Two plugins with the same agent name do not collide (different prefixes) | High |
| 4 | `skills` preload (FG-16) | Up to 32 distinct names. Resolution: exact name/alias/userFacingName/dir name, then `<agent-plugin>:<entry>`, then any skill whose name ends in `:<entry>`. The pool is the Skill-tool set, so `disable-model-invocation: true` skills **and plugin skills without a description** count as "not found" (debug-log warning, skipped). Injected into the **first user message, after the task prompt**: a `<command-message>/<command-name>/<skill-format>true</skill-format>` block, then `Base directory for this skill: <dir>\n\n<body without frontmatter>` with variables substituted | High |
| 5 | Frontmatter schema (FG-17) | Keys: `name, description, model, tools, disallowedTools, color, effort, permissionMode, mcpServers, hooks, maxTurns, autoCompactWindow, skills, initialPrompt, memory, background, omitClaudeMd, isolation, observer, observerMessage, observeSubagents, experimental.cacheTtl`, plus `when_to_use`/`when-to-use` for plugin agents. Ignored for plugin agents (warned): `permissionMode, hooks, mcpServers, initialPrompt, observer, observerMessage, observeSubagents` | High |
| 6 | `model` (FG-18) | Aliases (case-insensitive) `sonnet, opus, haiku, fable, best, opusplan, sonnet[1m], opus[1m], fable[1m]`; `inherit`; any other string passes through as a model ID. Omitted -> `CLAUDE_CODE_SUBAGENT_MODEL`, else the parent model. First-party: opus->`claude-opus-5-5`, sonnet->`claude-sonnet-5-5`, haiku->`claude-haiku-5-5`, fable->`claude-fable-5-1`, best->fable | High (aliases medium: provider/env dependent) |
| 7 | `tools`/`disallowedTools` | String or list; split on commas and spaces outside `(...)`. `*` or omitted = all. `disallowedTools` is applied first. Declared entries that all fail to resolve -> spawn **refused** with an exact error. An explicitly empty `tools` gives a zero-tool agent (no refusal) | High |
| 8 | Trust (AGT-06) | Project agents load and run untrusted (`-p`, and in interactive mode they load before the trust dialog). Their frontmatter `hooks` and inline `mcpServers` are skipped unless the exact folder has a persisted trust record, and `-p` does not count. Plugin agents count as a trusted origin. A project-scope plugin the user already installed loads untrusted. Repo `extraKnownMarketplaces` wait for trust | High (`-p`), medium (interactive inference for project agents) |
| 9 | Missing `description` | Plugin agent: defaults to `Agent from <plugin> plugin` (after `when_to_use`/`when-to-use`). User/project agent: skipped, reason in the debug log | High |
| 10 | Body | The body (trimmed, plus a memory section if `memory`) is the subagent's system-prompt core. Claude Code prepends a billing header and identity line and appends fixed harness notes; the main Claude Code system prompt is not used. Plugin bodies get `${CLAUDE_PLUGIN_ROOT}`, `${CLAUDE_PLUGIN_DATA}`, `${CLAUDE_PROJECT_DIR}`, and non-sensitive `${user_config.KEY}` substituted at load; `$ARGUMENTS` is not | High |

---

## Q1 (FG-15): nested agent files, manifest paths, dotfiles, non-.md files, symlinks

**Behavior.**

- Default `agents/` folder: walked recursively by `xz` (binary 283986718). Each directory entry
  recurses with the namespace extended by the directory name. A file is loaded when
  `isFile() && name.toLowerCase().endsWith(".md")`. Limits: namespace depth >= 32 logs
  `Skipping agents directory beyond depth 32: <dir>` (error), and more than 4096 directories logs
  `Stopping agents scan after 4096 directories (root=...)`. The callback receives the namespace
  array, and `Van` builds the name `[pluginName, ...namespace, name].join(":")` (285501295).
  - Result: `agents/review/security.md` (no `name`) -> `agentprobe:review:security`, and
    `agents/review/deep/nested.md` with `name: nested-x` -> `agentprobe:review:deep:nested-x`
    (probe p1).
- **Dotfiles are not filtered.** `agents/.hidden.md` loaded (`agentprobe:hidden-agent`).
  `agents/.hiddendir/inside.md` loaded as `agentprobe:.hiddendir:inside-hidden-dir` (probe p1).
- **Non-`.md` files are silently ignored** (`notes.txt` absent from the listing). The extension
  test is case-insensitive, but the name strip `replace(/\.md$/,"")` is case-sensitive, so
  `agents/UPPER.MD` loads as `agentprobe:UPPER.MD` (probe p1).
- **Symlinks inside the walked tree are skipped silently.** `le().readdir` is
  `fs.readdir(dir,{withFileTypes:true})` (273523646). A symlink Dirent is neither `isFile()` nor
  `isDirectory()`, so `agents/link.md -> ../extra/linked.md` and `agents/linkdir -> ../extra/linkdir`
  were both absent: the debug log says 24 agents loaded, which is exactly the 24 regular `.md`
  entries (probe p1).
  - The scan root itself is followed. The default-folder existence check uses `stat` (`stat as Lx`,
    283786923), and `readdir(root)` follows a symlinked root. This is static evidence only; a
    symlinked `agents/` root was not probed.
  - This differs from user/project `.claude/agents/`, whose walker `jEo`/`B0` (283980114) follows
    symlinks (its JS walker resolves `isSymbolicLink()` through `stat`, and its ripgrep form runs
    `rg --files --hidden --follow --no-ignore --glob *.md`) and detects cycles.
- Manifest `agents` (plugin.json):
  - Schema: `agents: string | string[]` of `yr = He().endsWith(".md")`, where
    `He = string().startsWith("./")` (274100396, 274108294). The schema descriptions read "When set,
    the agents/ directory is not auto-loaded — list its files here if you want both."
  - A directory value such as `"./custom/"` fails: `claude plugin validate` reports
    `agents: Invalid string: must end with ".md"` and `Validation failed` (exit 1). At runtime
    **the whole plugin fails to load** (`Plugin manifestdir has an invalid manifest file ...`,
    `Failed to load session plugin`), and none of its components appear (probe p1,
    `probe-evidence/validate-manifestdir.txt`, `p1-debug-excerpt.txt`).
  - The runtime loader `$St` (285504248) still has a directory branch for `agentsPaths`
    (`stat().isDirectory()` -> walk). Schema validation makes it unreachable from plugin.json; it
    was not traced for marketplace entries.
  - A listed file loads with **no subfolder segments**: `"./custom/review/security.md"` ->
    `manifestfile:security` (probe p1). The docs say the same.
  - Setting `agents` **replaces** the default folder: `yt=!Se.agents&&We` (287733339). The debug
    log reports `Plugin manifestfile: agents/ folder exists but is not auto-loaded because the
    manifest sets "agents"` (287732672), and `agents/default.md` was not loaded (probe p1). When a
    listed path lies inside `agents/`, only the warning is suppressed (`lKn`); the folder is still
    not scanned and only the listed files load.
  - Each listed path goes through `Dx` (287724986). One that escapes the plugin root logs
    `Agent path X specified in manifest but escapes plugin directory for P` (error). One that does
    not exist logs `... not found at <path> for P`. In both cases the path is skipped and the
    plugin still loads.
  - A manifest-listed **symlinked file is followed**: `custom/link.md -> ../real/target.md` loaded
    as `manifestlink:link-target` (probe p1). `stat` and `ek` follow links. The containment check
    resolves the real path; a link that points outside the plugin was not probed.
  - The single-file branch requires `path.endsWith(".md")` (case-sensitive).
- Per-file read is `ek(...,1048576)`. A non-regular or >1 MiB file logs
  `Skipping plugin agent <path>: not a regular file or exceeds 1048576 byte limit` (warn). A
  throw during parse logs `Failed to load agent from <path>: <err>` (error) and skips that file.

**Evidence.** Binary: `c7e` 285500221, `Kan` 285500401, `Van` 285500915, `$St` 285504248,
`xz` 283986718, readdir 273523646, plugin loader 287733339, `Dx` 287724986, schema 274108294 and
274100396. Docs: plugins/components "Organize agents in subfolders"; sub-agents "Plugin `agents/`
directories are also scanned recursively ... `agents/review/security.md` in plugin `my-plugin`
registers as `my-plugin:review:security`"; plugins-reference Fields table "`agents` ... Agent `.md`
files. Directories aren't accepted. Replaces the default `agents/` scan". Probes p1 and validate.

**Confidence.** High. Binary and probe agree, and the docs agree on naming, replacement, and
`.md`-only manifest entries. The docs say nothing about symlinks or dotfiles; those findings rest on
the binary and the probe.

**Unresolved.** A symlinked `agents/` root, and a manifest symlink that points outside the plugin
(both static only). Directory entries in marketplace-entry `agents` were not traced.

## Q2: plugin agent naming and duplicates

**Behavior.**

- The name segment is `SAt(frontmatter.name)` or `basename(file).replace(/\.md$/,"")` (285500915).
  `SAt` stringifies the value, and a value over `RI=256` chars (273491950) is ignored with
  `Frontmatter "name" of plugin agent <path> is over 256 characters - ignoring it` (warn), so the
  filename is used (probe: `bigname.md` -> `agentprobe:bigname`).
- Plugin agent names are **not validated**: `name: -dash` -> `agentprobe:-dash`, and `name: a:b` ->
  `agentprobe:a:b` (probe p1). User/project agents reject a leading `-`, more than 256 chars, and
  any `:` (`fWt` 285549112, error `names must not contain ':' (reserved for plugin namespacing)`,
  seen in the probe for a user agent named `agentprobe:top-agent`).
- The qualified name is `<pluginName>:<subfolders...>:<name>`. `pluginName` is the manifest `name`.
  Per the docs, without a manifest it comes from the marketplace entry or the directory name, and
  "when the entry lists the plugin under a different `name` than the manifest, `enabledPlugins` uses
  the entry name, and components are namespaced under the manifest name".
- Frontmatter `name` different from the file name: frontmatter wins and replaces only the last
  segment (the docs give `name: audit` in `agents/review/security.md` -> `my-plugin:review:audit`,
  and the probe gave `review/deep/nested.md` + `name: nested-x` -> `agentprobe:review:deep:nested-x`).
- Unparseable frontmatter: `sd` (279652208) returns `{}` frontmatter (and logs
  `Failed to parse YAML frontmatter in <path>`), so the agent loads under its filename with the
  default description. The parser first retries leniently: `Nm` (279650678) wraps unquoted
  special-char values in quotes, so `name: [unclosed` was salvaged as the name `[unclosed`
  (`agentprobe:[unclosed`, probe p1). The docs say "Frontmatter that doesn't parse: the agent still
  loads with every field ignored".
- Two files with the same resulting name in one plugin: both enter `allAgents`. `a6` keeps the last
  one in load order. Loads are async, so the order is completion order rather than a documented
  precedence. The debug log reports
  `[agents] Duplicate agent name 'agentprobe:dupe' (plugin): <dup2.md>, <dup1.md> — active: <dup2.md>`
  (`Bcr` 285542838; probe p1, where dup2 won). There is no user-visible error.

**Confidence.** High (binary, docs, probe). The winner between duplicates is undefined: one
observation.

## Q3 (A15): priority and collisions

**Behavior.**

- `a6` (285542038) buckets the agents as `[built-in, plugin, userSettings, projectSettings
  (--add-dir dirs first, then the project dirs sorted so the nearest .claude/agents is last),
  flagSettings (--agents), policySettings (managed)]` and fills a `Map` by `agentType` in that
  order, so **later wins**. Effective priority, highest first: managed > `--agents` > project >
  user > plugin > built-in. The docs table (sub-agents "Choose the subagent scope") lists managed 1,
  `--agents` 2, `.claude/agents/` 3, `~/.claude/agents/` 4, plugin 5 (lowest), and does not show
  built-ins.
- Because non-plugin names may not contain `:` and every plugin agentType contains `:`, **a plugin
  agent never collides with a user, project, managed, `--agents`, or built-in agent**. Probe p1 had
  user `top-agent`, project `top-agent`, and plugin `agentprobe:top-agent`: all three were distinct,
  and project `top-agent` replaced user `top-agent` in the listing.
- Two plugins shipping the same agent name: different prefixes, so no collision. Probe p1 listed
  both `agentprobe:top-agent` and `agentprobe2:top-agent`.
- A real collision needs the same full agentType. That means two enabled plugins with the same
  plugin `name` (not probed; same plugin bucket, last loaded wins, debug-log duplicate report), or
  two files in one plugin (Q2).
- Invocation by name:
  - Agent tool `subagent_type` (291521725): exact match first. Otherwise a unique match after `mxe`
    normalization (282513141: NFKC, lowercase, whitespace/dash/underscore removed) over the **whole**
    type. If several match: `Agent type 'X' is ambiguous — matches ...`. If none:
    `Agent type 'X' not found. Available agents: ...`. A bare `top-agent` does **not** reach
    `agentprobe:top-agent`. An omitted `subagent_type` means `general-purpose`.
  - `--agent` / `agent` setting (`wr`, 293305275): exact match, else the **first** active agent
    whose type ends with `:<name>` (the active list is sorted by name). Otherwise
    `Warning: agent "<x>" not found ... Using default behavior.`. The docs say to pass the scoped
    name to disambiguate.

**Confidence.** High (binary, docs, probe).

## Q4 (FG-16): `skills` preload

**Behavior** (runner `pP`, around 291326040..291338000).

- Parsing: `mv` (283978343). A string or list; each string goes through `qu` (comma/space split);
  `*` collapses to `["*"]`; null or omitted gives `[]`.
- Then: deduplicated, capped at `ds=32` (`... only the first 32 are preloaded`, warn), and skills
  already carried from a resumed transcript are skipped.
- Resolution pool: `YI` = the Skill-tool command set filtered by `Y_e` (284135673): `type=prompt`,
  **not `disableModelInvocation`**, not `Q5`, and (bundled/skills/synced/attached/legacy command,
  or `hasUserSpecifiedDescription`, or `whenToUse`). Plugin skills carry `loadedFrom:"plugin"`, so
  they qualify only through a `description` or `when_to_use`.
- Lookup `tu(entry, pool, agent)` (291353616), in order:
  1. `Zs` (281738371): exact `name`, userFacingName, alias, or a unique `directoryListingName`.
  2. `<first segment of agentType>:<entry>`, via `Ze` = text before the first `:` (273313183).
     For `agentprobe:review:security` the prefix is `agentprobe`. Only eligible skills count
     (`e_n`: not MCP, not memoryStore, not full-name-only).
  3. The **first** eligible skill whose name ends with `:<entry>`.
- Probe results:
  - Bare `s1` in `agentprobe:preload` resolved to `agentprobe:s1`.
  - Bare `s1` in **another plugin's** agent `agentprobe2:xref` also resolved to `agentprobe:s1`,
    through step 3 (probe p4-xref).
  - The qualified `agentprobe:s2` resolved.
  - The skill dir name `PROBE-BYDIR`, whose frontmatter says `name: renamed-skill`, resolved. A
    plugin skill's internal name is `<plugin>:<dir>`, with the frontmatter name as userFacingName
    and alias.
- Skipped entries are logged at warn level in the debug log and the spawn continues:
  - Missing: `[Agent: <type>] Warning: Skill '<x>' specified in frontmatter was not found`.
  - `disable-model-invocation: true` gives the **same "not found" message**, because the skill is
    outside the pool (probes p2 and p3, `dmi-skill`).
  - A plugin skill **with no `description`/`when_to_use`** is also "not found" (probe,
    `nodesc-skill`). This is not documented.
  - Other reasons: `is not a prompt-based skill`, `is disabled by policy`,
    `is turned off by the organization's Skills setting`, account-synced skills while sync is off.
  - The docs agree: "You can't preload skills that set `disable-model-invocation: true` ...
    preloading draws from the same set of skills Claude can invoke"; "If a listed skill is missing
    or disabled ... Claude Code skips it and logs a warning to the debug log"; "up to the first 32
    distinct names".
- Content: `skill.getPromptForCommand("", ...)` with `isSkillPreload:true`. For a plugin skill,
  `XK` (284853965) produces `Base directory for this skill: <skill dir>\n\n<SKILL.md body without
  frontmatter>`, then substitutes args/vars (`$ARGUMENTS` becomes empty, and
  `${CLAUDE_PLUGIN_ROOT}` was substituted in the probe) and runs inline `!` shell commands unless
  skill shell execution is disabled (static reading).
- Placement: each skill becomes one `isMeta` user message whose content is
  `[{text: FUs(name)}, ...skillContentBlocks]` (`FUs` 304953522), where
  `FUs(name)` = `<command-message>NAME</command-message>\n<command-name>NAME</command-name>\n<skill-format>true</skill-format>`
  and NAME is the entry **as written** (`s1` or `agentprobe:s2`). These messages are appended after
  the prompt messages (the task prompt), so on the wire they are later text blocks of the **first
  user message**, not part of the system prompt (probe p2: block0 = task prompt, block1/2 = s1,
  block3/4 = s2). The debug log shows `[Agent: X] Preloaded skill 's1'`.

**Confidence.** High (binary, docs, probe). Step 3 of resolution can cross plugins: one probe plus
the code.

## Q5 (FG-17): full frontmatter schema and plugin-agent field handling

**Recognized keys** (`AWe`, 283974060, which feeds the unknown-key warning):

- `name` and `description`, both described as required for non-plugin agents.
- `model`, `tools`, `disallowedTools`, `color` (@internal), `effort`, `permissionMode`,
  `mcpServers`, `hooks`, `maxTurns`, `autoCompactWindow`, `skills`.
- `initialPrompt`, `memory`, `background`, `omitClaudeMd`, `isolation`, `observer`,
  `observerMessage`, `observeSubagents`, and `experimental` (`cacheTtl`).
- Plugin agents also accept `when_to_use` and `when-to-use` (`dcr`).
- Unknown keys produce `Plugin agent file <path> has a frontmatter key Claude Code does not
  recognize or apply: "unknownKey"` (warn, with did-you-mean hints; probe p1).
- `normalizeKeys` is an identity function (`Bm`), so keys are case-sensitive.

**Plugin-agent handling** (`Van`, 285500915). Lists `Gan`/`zan` are at 285500797.

- Ignored with a warning: `permissionMode`, `hooks`, `mcpServers` (`... sets X, which is ignored
  for plugin agents. Use .claude/agents/ for this level of control.`) and `initialPrompt`,
  `observer`, `observerMessage`, `observeSubagents` (`... Define the agent in .claude/agents/ to use
  X.`). Probe p1 logged all five that the fixture set. The docs list permissionMode, hooks,
  mcpServers, and initialPrompt as ignored; the observer keys are not in the docs.
- `background`: `true` or `"true"` -> true; anything else -> unset, with no warning. **Forces a
  background (async) launch even when the call passes `run_in_background:false`** (probe p3:
  requested foreground, started_in_background 1, `Async agent launched successfully`).
- `memory`: exactly `user`, `project`, or `local`; anything else warns
  `has invalid memory value`. Directories (`R9r`, 279720770): user
  `<configDir>/agent-memory/<name>/`; project `<cwd>/.claude/agent-memory/<name>/`; local
  `<cwd>/.claude/agent-memory-local/<name>/`. Name sanitizing: `agentprobe:fields` ->
  `agentprobe-fields`, as observed.
  - When the memory feature is on, a `# Persistent Agent Memory` section is appended to the system
    prompt, and Write/Edit/Read are added to an explicit `tools` list (probe p3).
- `maxTurns`: a positive integer, as a number or numeric string (`Gir`, 279655530); invalid ->
  `Must be a positive integer.`, ignored.
- `autoCompactWindow`: an integer from 100000 to 1000000 (`Kx`/`d0`, 273964461); invalid warns.
- `isolation`: plugin agents accept only `"worktree"`; any other value, including `"remote"`, is
  **silently dropped** (probe p3). Non-plugin agents accept `worktree` or `remote` and warn on
  anything else.
- `effort`: `rK` (278280289). Lowercased; alias `med`->`medium`; levels
  `Ei=["low","medium","high","xhigh","max"]` (274207364); **or any integer**. Invalid ->
  `Valid options: low, medium, high, xhigh, max or an integer`. `xhigh` and `max` are included.
  Probe p3: `effort: xhigh` -> `output_config.effort:"xhigh"`. With no effort set, the per-model
  default from the catalog applied (sonnet-5-5 `medium`, opus-4-7 `xhigh`).
- `initialPrompt`: ignored for plugin agents (above). For non-plugin agents it is read only when the
  agent runs as the main session.
- `color`: passed through with **no validation** for plugin agents (`notacolor` was accepted
  silently). Non-plugin agents keep only listed colors.
- `omitClaudeMd`: `true` or `"true"`.
- `experimental.cacheTtl`: `"5m"` or `"1h"` (`oft`, 273686284; key matched case-insensitively).
- `tools`, `disallowedTools`, `skills`, `model`: see Q4, Q6, Q7.

**Confidence.** High (binary, docs, probe).

## Q6 (FG-18): `model`

**Behavior.**

- Frontmatter is trimmed; `inherit` is matched case-insensitively; any other string is kept as is.
- Resolution `Xz` (284606809). Precedence, confirmed by the `uYs` telemetry labels (284607766) and
  the docs:
  1. The Agent-tool `model` parameter (enum `sonnet|opus|haiku|fable`; `inherit` maps to the parent).
  2. Frontmatter `model` (`inherit` = the parent model).
  3. `CLAUDE_CODE_SUBAGENT_MODEL` (`que`, 284606723), used only when frontmatter is **omitted** and
     the variable is not `inherit`.
  4. The parent's model.

  `CLAUDE_CODE_SUBAGENT_MODEL_FORCE` (`i9t`, 284608673) makes the env value beat frontmatter and the
  tool parameter (docs: v2.1.257+). In a workflow run, the workflow env model applies. The built-in
  Explore agent has an inherit cap of `opus` (`TCe`, 283363264).
- **Default when omitted:** env `CLAUDE_CODE_SUBAGENT_MODEL` if set, else inherit (probe p4-nomodel:
  `claude-opus-5-5`, the parent's model).
- Aliases `E8 = sonnet, opus, haiku, fable, best, sonnet[1m], opus[1m], fable[1m], opusplan`; the
  families are `v8 = sonnet, opus, haiku, fable` (273704200). The alias match lowercases the value
  (probe: `HAIKU` -> `claude-haiku-5-5`).
- `Ut`/`fG` (276972243) maps each alias:
  - `fable` -> `ANTHROPIC_DEFAULT_FABLE_MODEL` or the catalog value.
  - `sonnet` and `opusplan` -> the sonnet model. A frontmatter `opusplan` therefore runs the
    subagent on sonnet. The opusplan plan-mode upgrade to opus happens only on the `inherit` path
    (`by()`), when the parent session itself uses opusplan in plan mode (static reading, medium
    confidence).
  - `haiku`, `opus` -> the haiku and opus models.
  - `best` -> `NK()`; the catalog sets `best:"fable"`.
  - Legacy opus-4/4.1 IDs remap to current opus unless `CLAUDE_CODE_DISABLE_LEGACY_MODEL_REMAP` is set.
  - **Any other value passes through as a model ID** (probe: `claude-opus-4-7` was sent as is).
- If the alias's family matches the parent's model, the subagent uses the **parent's exact model**
  (`P1r`). A model outside the `availableModels` allowlist falls back to the newest allowed model
  in its family, or to inherit, with a warning.
- Baked catalog (273833361), resolved through `nhe` (273839017) as `per_provider[provider] ?? default`:

  | Alias | first-party default | per-provider exceptions |
  | - | - | - |
  | opus | `claude-opus-5-5` | foundry `claude-opus-4-6`, gateway `claude-opus-4-7` (bedrock/vertex/mantle/anthropic_aws `claude-opus-5-5`) |
  | sonnet | `claude-sonnet-5-5` | bedrock/vertex/foundry/mantle `claude-sonnet-4-5`, anthropic_aws/gateway `claude-sonnet-4-6` |
  | haiku | `claude-haiku-5-5` | every listed provider `claude-haiku-4-5` |
  | fable | `claude-fable-5-1` | gateway `claude-fable-5` |

  `latest_per_family` matches the defaults. Overrides: `ANTHROPIC_DEFAULT_{OPUS,SONNET,HAIKU,FABLE}_MODEL`
  and settings `modelOverrides`.
- Probe observations (first-party, parent `claude-opus-5-5`): sonnet -> `claude-sonnet-5-5`
  (p2); opus -> `claude-opus-5-5` (p3; alias table and parent rule agree); haiku ->
  `claude-haiku-5-5`; tool parameter `haiku` beat frontmatter `opus` (p4-fieldsmodel).

**Confidence.** High for precedence, the alias set, and pass-through. Medium for "what each alias
resolves to", because it depends on provider, env overrides, org allowlists, and future catalog
changes. `CLAUDE_CODE_SUBAGENT_MODEL` was not probed (static plus docs).

## Q7: `tools` / `disallowedTools`

**Behavior.**

- `F0t`/`C2e` (283978343):
  - undefined -> all tools (inherit the subagent pool).
  - null (`tools:` with no value) or `""` -> **`[]`**.
  - A string or list goes through `qu` (273585549), which splits on `,` **and spaces** outside
    parentheses, so `Bash(git log *)` stays one entry. Non-string list items are dropped.
  - Any `*` -> wildcard (all tools).
- Legacy names map through `td` (273582304): `Task->Agent`, `KillShell/KillBash->TaskStop`,
  `ListPeers->ListAgents`, `Brief->SendUserMessage`, and the MCP resource tool renames.
- `mP` (291373942) first removes `disallowedTools` from the pool, then resolves `tools` against what
  remains. So `disallowedTools` **applies even when `tools` is set**: probe p3 had
  `tools: Read Grep, Bash(git log *)` plus memory (adds Write/Edit/Read) and `disallowedTools: Write`,
  and got `[Read, Bash, Edit]`. That matches the docs ("disallowedTools is applied first ... A tool
  listed in both is removed"). The `AWe` description string "Ignored if `tools` is set" is stale.
- Other entry forms:
  - `Tool(spec)` resolves to the tool (Bash was included). The spec's runtime restriction semantics
    were not verified.
  - `Agent(a, b)` collects spawnable types; per the docs this is honored only for main-thread
    (`--agent`) agents.
  - `mcp__server`, `mcp__server__*`, and `mcp__*` server-level forms are handled in `mP` and
    `r7e`/`Gxo` (docs table in sub-agents "Restrict which tools a subagent can use").
  - Names unknown to this build are dropped silently (`Grep` does not exist in this build's pool and
    was dropped in p3).
- **Zero tools** (291335186): when the resolved set is empty, *and* some declared entry was
  unrecognized, unavailable to subagents, or matched nothing, *and* there is no wildcard, *and* the
  parent pool is non-empty, *and* this is not a continuation, the spawn is refused. The parent gets
  this tool_result (probe p4-badtools, `tools: NoSuchTool, AlsoMissing`):
  `Agent 'agentprobe:bad-tools' would be spawned with zero tools — refusing. Its tools list resolved
  to nothing: unrecognized [NoSuchTool, AlsoMissing]. Fix the agent's tools frontmatter or pass a
  different subagent_type.` The other reason labels are `not available to subagents [..]` and
  `recognized but matched no tools in this session [..]`.
- An **explicitly empty** `tools: ""` is not refused: the subagent runs with zero tools (the request
  had `tools: []`, probe p4-empty). The agent listing still showed `(Tools: All tools)` for it,
  which is a display quirk.

**Confidence.** High (binary, docs, probe).

## Q8 (AGT-06): project trust

**Behavior.**

- **Project agents** (`.claude/agents/`) are loaded with no trust check (`jEo` 283980114 reads the
  policy, user, and project dirs). In `-p` in a never-trusted folder they were listed and ran
  (probe p4-proj).
  - Their **frontmatter `hooks` and inline `mcpServers` are skipped** unless the folder that holds
    the agent file has a persisted record `projects["<path>"].hasTrustDialogAccepted: true` in
    `<config>/.claude.json`. The check is `BCe` (285497257) -> `o3e` (276587900), which reads only
    the persisted record. Session trust and `-p` do not count.
  - The skip is logged at error level by `m0e` (285498251):
    `Skipping frontmatter hooks for agent 'proj-agent': the folder its definition file came from is
    not trusted (source: projectSettings). Run Claude Code in that folder once and accept the trust
    dialog, or set projects["<path>"].hasTrustDialogAccepted: true in <config>/.claude.json.`
    The same message appears for MCP servers (probe p4-proj).
  - The gates sit at `Kd` (agent MCP, 291321172), `ZJe` (main-thread agent hooks, 292302916), and
    the subagent hook registration. In `claude mcp serve`, untrusted agent definitions are dropped
    entirely (322330138).
  - Server **names** that reference already-configured MCP servers are still allowed (docs).
- **Plugin agents** count as a trusted origin: `c3` = {plugin, policySettings, built-in, builtin,
  bundled} (278666839). They cannot carry hooks or MCP servers anyway.
- **`-p`/SDK**: `_e()` = `!isInteractive()` (273436203), and `Wk()` = `_e() || Ts()` (276587518).
  So **settings-file hooks/env/helpers and plugin hook modules count as trusted in `-p`**, but agent
  hooks and inline MCP do not, because they use `o3e`. The docs table in permissions "What runs
  before you trust a folder" says the same and adds:
  - `permissions.allow` and `additionalDirectories` are not used.
  - Repo `extraKnownMarketplaces` entries are not used.
  - `.mcp.json` servers connect without asking.
- **Project-scope plugins**: in `-p` in a never-trusted folder, a plugin the user had installed with
  `claude plugin install ... --scope project` loaded and its agent was listed
  (`projplug:pp-agent`, probe p5). The project `.claude/settings.json` held `enabledPlugins` and
  `extraKnownMarketplaces`; the marketplace was also recorded in user-level `known_marketplaces.json`.
  - The docs ("A committed key doesn't reach teammates") say `extraKnownMarketplaces` waits for
    trust, so a teammate cloning the repo "don't get plugins from a marketplace the file declares"
    until trust. `enabledPlugins` itself is not listed as trust-gated.
  - Project-settings `pluginConfigs` are never read ("project settings are not read", debug log).
- **Interactive, untrusted** (probe p6, PTY): the debug log shows `[STARTUP] Loading commands and
  agents...`, `Found 4 plugins (4 enabled ...)`, and `Loaded 1 agents from plugin projplug` **before**
  `[STARTUP] Running showSetupScreens()...`, which renders the trust dialog ("Quick safety check: Is
  this a project you created or one you trust? ... ❯ No, exit / Yes, I trust this folder").
  - Plugin **hook modules** wait: `hooks modules not loaded until workspace trust is accepted: ...`
    (287353427).
  - So agent definitions, plugin agents included, are read before trust. The session cannot proceed
    past the dialog without accepting it, and "No, exit" ends it.
  - Project `.claude/agents` were not present in that interactive run. That they load before the
    dialog is an inference from the shared loader.

**Confidence.** High for `-p` (binary, docs, probe). Medium for interactive project agents
(inference) and for teammate-clone plugin behavior (docs plus code reading, not probed).

**Unresolved.** Whether an untrusted interactive session ever exposes project agents before the
dialog completes; it looks impossible because the dialog blocks. Nested-repo and `--add-dir` trust
edge cases were not probed.

## Q9: missing `description`

**Behavior.**

- Plugin agent: `zie(description) ?? zie(when_to_use) ?? zie(when-to-use) ?? "Agent from <plugin> plugin"`
  (285501395). `zie` trims, turns an empty string into a miss, stringifies numbers and booleans, and
  warns `Description invalid for X - omitting` for other types.
  - Probe: `no-desc.md` -> `agentprobe:no-desc: Agent from agentprobe plugin`; the frontmatter-less
    `noname.md` gave the same. Docs: components "description reads `Agent from my-plugin plugin`".
  - `claude plugin validate` only warns: `No description in frontmatter`.
- User/project/managed agent: `fWt` returns null and the file is skipped. The log reads
  `Agent file <path> is missing required 'description' in frontmatter` (the docs say "writes the
  reason to the debug log"). A file with no `name` is skipped **silently** (the docs call it
  "documentation kept beside your agents").
  - Non-plugin descriptions get literal `\n` sequences converted to newlines; plugin descriptions
    do not.

**Confidence.** High.

## Q10: agent body

**Behavior.**

- `getSystemPrompt()` returns the body (`content.trim()`), substituted, plus the memory section when
  `memory` is set.
- The runner wraps it with `omn` (285473470): `[body, "Messages from the agent that launched you —
  ...", "Notes:\n- Agent threads always have their cwd reset ...", optional token-budget line]`.
- The request layer prepends a billing/attribution header block and an identity line (281375393):
  `You are a Claude agent, built on Anthropic's Claude Agent SDK.` in this `-p` run, or
  `You are Claude Code, Anthropic's official CLI for Claude.` interactively.
- Environment details (`# Environment` ...) arrived as a separate `system`-role entry in `messages`
  after the first user message. CLAUDE.md user context is included unless `omitClaudeMd`.
- **The main Claude Code system prompt is not used** (probe p2 system blocks:
  `[billing header][identity][body + notes]`). Docs: "The body becomes the system prompt ...
  Subagents receive only this system prompt plus basic environment details like the working
  directory, not the Claude Code system prompt."
- Substitution in plugin agent bodies, at load (`spe` 278784703, then `yYr` 278786103):
  - `${CLAUDE_PLUGIN_ROOT}` -> the plugin root.
  - `${CLAUDE_PROJECT_DIR}` -> the project dir; throws when there is none.
  - `${CLAUDE_PLUGIN_DATA}` -> `<config>/plugins/data/<id>/`, with `-inline` as the id for
    `--plugin-dir`; throws `PluginDataDirUnknownError` when unknown. A throw makes the agent fail to
    load ("Failed to load agent from ...").
  - `${user_config.KEY}` -> the saved non-sensitive value. A sensitive key becomes
    `[sensitive option 'KEY' not available in skill content]`. A missing key is **left literal**.
  - `$ARGUMENTS` is **not** substituted (probe p4-vars: ROOT/DATA/PROJ replaced,
    `UC=${user_config.missing}` and `ARGS=$ARGUMENTS` literal).
  - Docs (plugins-reference "Where each variable resolves"): "Skill, command, and agent content |
    Anywhere in the Markdown body".
  - Non-plugin agent bodies get no substitution (`fWt`).

**Confidence.** High.

---

## Conflicts between sources

- `AWe` describes `disallowedTools` as "Ignored if `tools` is set". The docs and the probe show it
  is applied first even when `tools` is set. The runtime (`mP`) wins; the string is stale.
- The docs say manifest `agents` "Directories aren't accepted". The runtime loader has a directory
  branch, but schema validation fails the whole plugin first. Net effect: a directory in plugin.json
  `agents` kills the plugin.
- The docs list `initialPrompt` among plugin-ignored fields. The binary also ignores and warns on
  `observer`, `observerMessage`, `observeSubagents`, which the docs omit.
- Undocumented, found here: symlinks skipped inside plugin `agents/`; dotfiles loaded; no
  validation of plugin agent names or colors; `isolation: remote` silently dropped for plugin
  agents; `background: true` forcing async; plugin skills without a description being unpreloadable;
  cross-plugin bare-name skill resolution; the empty `tools` listing quirk.

## Probe log (all on 2.1.316, exit 0 unless noted)

| Label | Command (cwd `fx/project` unless noted) | What it decided |
| - | - | - |
| validate | `claude plugin validate ../plugins/<p>` for agentprobe, agentprobe2, manifestfile, manifestdir (exit 1), manifestlink | manifest `agents` must end with `.md`; the validator only warns on no-frontmatter and no-description files |
| p1 | `claude -p ... --plugin-dir` x5 (agentprobe, agentprobe2, manifestfile, manifestdir, manifestlink), stub replies with text | full merged agent listing (`probe-evidence/p1-agent-listing.txt`) and loader debug lines |
| p2 | same, stub calls `Agent{subagent_type:"agentprobe:preload", run_in_background:false}` | preload placement and content, sonnet alias, tools [Read], skipped skills |
| p3 | `agentprobe:fields` | opus/xhigh, tool resolution with memory and disallowedTools, background forcing async |
| p4-* | vars, empty-tools, bad-tools, HAIKU, full-id, no-model, agentprobe2:xref, proj-agent, fields with tool `model:"haiku"` | substitution, zero-tools refusal and empty-tools run, model precedence, cross-plugin skill, trust skips |
| p5 | cwd `fx/project2` (project-scope `projplug` installed by CLI, no trust record), `-p` | project-scope plugin loads untrusted in `-p` |
| p6 | cwd `fx/project2`, interactive in a PTY (`script`), 25 s, no input (exit 124 from timeout, expected) | plugins and agents load before the trust dialog; hook modules wait |

## Isolation caveat

- Every probe run of this binary on this host logged `Read OAuth token from well-known file
  /home/claude/.claude/remote/.oauth_token` and `Read session ingress token from well-known file
  /home/claude/.claude/remote/.session_ingress_token` (14 and 13 reads,
  `probe-evidence/isolation-caveat-token-reads.txt`).
  - The paths are hard-coded (`var y="/home/claude/.claude/remote"`, plus `.api_key`, at
    275350054). They are read on Linux whatever `HOME`, `CLAUDE_CONFIG_DIR`, or `env -i` say, and
    this cloud container has them for its own session.
  - What the record shows: all 52 captured requests were `POST /v1/messages?beta=true` to the local
    stub on 127.0.0.1. No request carried the `oauth-2025-04-20` beta, which suggests the dummy API
    key authenticated. The debug logs name no external host. The stub dropped `authorization` and
    `x-api-key` before writing captures. No credential file was written into the probe tree.
  - I found this only after the last probe (p6) and ran no probe after it.
- The first three probe sessions (p1-p3) ran without `TMPDIR`, so Claude Code wrote task-output and
  `fswatch-probe-*` dirs under `/tmp/claude-0/`. I moved them into the scratch tree and set `TMPDIR`
  for later probes.
- The interactive probe used the hard-coded UDS socket dir `/tmp/cc-socks-0/`, which is now empty.
  I left it in place because the host's own Claude Code may share it.
- `~/.claude` and the real project `.claude/` were never touched.

## Dubious Choices

- **Probing despite the token read.** I ran stub-backed `-p` probes and one interactive PTY probe
  although the binary reads the host's remote-session token files. I could not suppress that read
  and found it only after the last probe. The captured traffic stayed local, but isolation was not
  fully established in the skill's sense.
- **Extra env vars beyond PATH/HOME/CLAUDE_CONFIG_DIR.** I added
  `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1` (to stay offline) and later `TMPDIR` (to keep
  artifacts in scratch), on top of the sanctioned `ANTHROPIC_BASE_URL` and a dummy
  `ANTHROPIC_API_KEY`.
- **Probe config edits.** For the PTY probe I set `hasCompletedOnboarding`, `theme`, and the dummy
  key's approval in the probe config's `.claude.json`, to reach the trust dialog. The real config was
  not touched.
- **Minified names vary.** Some symbols occur more than once (a second bundle). I cite the copy in
  the main CLI chunk (`10.5M..15.6M` source region, binary 283175860..288250443) or the one on the
  executed path I read. Minified names are build-specific.
- **Single observations.** Duplicate-name winners and cross-plugin skill fallback are each one
  observation. The code shows the order is load-completion order, not a guarantee.
- **Interactive project agents.** "Project agents load before the trust dialog in interactive mode"
  is inferred from the shared loader; the PTY probe folder had no project agents.
- **Alias table scope.** The alias table is the baked catalog for first-party with no env overrides.
  A logged-in account, an org allowlist, or a server catalog could resolve differently. This
  sandbox had none of those.
- **Cleanup.** I deleted the bulky raw probe tree (fixtures, full request captures, and the 55 MB
  source extract) per the skill's cleanup rule, keeping `ev/` (binary excerpts), `probe-evidence/`
  (condensed outputs plus scripts that recreate the fixtures), and this record.
- **No Pi assessment.** I did not assess Pi or pi-subagents constraints or propose divergences. This
  record is upstream-only, and those fields are left for the discussion.
