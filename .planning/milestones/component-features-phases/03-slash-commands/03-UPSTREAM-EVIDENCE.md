# Upstream evidence: plugin slash commands (Claude Code 2.1.316)

Probed and grepped 2026-11-01. Binary `/opt/claude-code/bin/claude`, `claude --version`:
`2.1.316 (Claude Code)` (the binary's version object: `BUILD_TIME:"2026-10-30T23:28:13Z"`,
`GIT_SHA:"cd7ceb459c6864567b16a11f60101b24421475c1"`).

Probe tree, kept as evidence:
`/tmp/claude-0/-home-user-pi-claude-marketplace/573eac57-8096-527f-94a8-f7aea09fcdeb/scratchpad/probe-p3/tree`
(below: `<tree>`). Earlier facts from 01-CONTEXT and 02-CONTEXT (T2e, A2e, E1-E6) were not
re-probed.

**Read the isolation gap section before reusing this probe recipe.**

## Method

One tree per variant, `<tree>/v-<name>/`, each with:

- `mp/`: marketplace `probe-mp` with one path-source plugin `probe-plugin` at `./plugins/probe-plugin`;
- `home/`, `config/`: fresh `HOME` and `CLAUDE_CONFIG_DIR`;
- `project/`: the working directory;
- `out/`: every output (`<label>.cmd/.stdout/.stderr/.exit` for CLI calls,
  `<label>.jsonl/.stderr/.exit` for sessions, `<label>-reqs/NNN-*.json` for captured API requests).

Helper scripts are in `<tree>/bin/`. Every `claude` call ran as:

```sh
cd <V>/project && env -i PATH=/usr/bin:/bin HOME=<V>/home CLAUDE_CONFIG_DIR=<V>/config \
  CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1 CLAUDE_CODE_DISABLE_OFFICIAL_MARKETPLACE_AUTOINSTALL=1 \
  [ANTHROPIC_BASE_URL=http://127.0.0.1:<port> ANTHROPIC_API_KEY=stub-not-a-credential] \
  timeout 60 /opt/claude-code/bin/claude <args>
```

- **CLI facts** (`bin/cli.sh`, no API variables): `plugin validate <plugin dir>` and
  `plugin validate <V>/mp`, `plugin marketplace add <V>/mp`, `plugin install probe-plugin@probe-mp`,
  `plugin details probe-plugin@probe-mp`, `plugin list [--json]`. `marketplace add` and `install`
  exited 0 in every variant except where noted.
- **Session facts** (`bin/run.sh`): `claude -p "<prompt>" --output-format stream-json --verbose`.
  The `system/init` record gives `slash_commands`, `skills`, `plugin_errors`, `plugin_warnings`.
- **Model input** (`bin/stub.mjs`): a Node HTTP stub on 127.0.0.1 (random free port) saves every
  request and answers HTTP 400. In its optional scripted mode, the first `/v1/messages` request that
  offers a tool named `Skill` gets one streamed assistant turn with a `Skill` tool call. Later
  requests get 400. This mode shows what a model-invoked command sends back. No model and no
  credential is involved.
- **SDK command list** (`bin/ctl.sh`): `claude -p --input-format stream-json --output-format
  stream-json --verbose` gets one stdin line,
  `{"type":"control_request","request_id":"probe-init-1","request":{"subtype":"initialize"}}`. The
  `control_response` lists `commands[]` with `name`, `description`, `argumentHint`, and `aliases`.
  There is no user message, so no model turn happens.
- **Loader log**: `--debug-file <V>/out/<label>.debug.log`.
- Each session made six identical `/v1/messages` POSTs (the client retries after a 400). The user
  blocks are byte-identical across all six (md5 checked), so the quotes below use request `001`.
- Sessions that reach the stub exit 1 (the stub's 400). The refused `hidden` run and the
  `initialize` runs exit 0.

### Isolation gap

`env -i` removed every parent variable. The probe never had the session's
`ANTHROPIC_BASE_URL`, `CLAUDE_CODE_REMOTE*`, or `CLAUDE_CODE_MESSAGING_TOKEN`, and no file
descriptor was inherited beyond stdin, stdout, and stderr. Even so, in the first 16 trees the binary
fetched `https://api.anthropic.com/api/claude_code/policy_limits` directly, during the first
`claude plugin` command in each tree.

- The fetch uses the built-in `BASE_API_URL`, not `ANTHROPIC_BASE_URL`: `function dCi(){return
  _e()??nn().BASE_API_URL}` and `var COe="/api/claude_code/policy_limits"` (byte 275501106).
  Remote settings use `${nn().BASE_API_URL}/api/claude_code/settings` (byte 290527224).
- `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC` does not stop this fetch.
- This container sends `api.anthropic.com` direct, not through the agent proxy (the proxy status
  `noProxy` list includes it).
- Evidence: `<tree>/v-*/config/policy-limits.json` with `.signature.json` (JWS `typ:
  cc-signed-cache+jws`; payload `typ: policy-limits`, `plan: "consumer"`, `iat` equal to each tree's
  first CLI call) and `.stamp.json` (`kind: "token"`, one confirmation per tree, no later refresh).
  `remote-settings.json` is `{}`.
- The payload's `sub`, `ws`, and `aud` are identical across trees, while `iat` differs. So each tree
  got a fresh server answer bound to one stable identity. The probe sent no credential, and I cannot
  tell what that identity is: the account, or something about the container.
- This was unintended network use beyond localhost. After I found it, I made no more networked runs.
- **Re-verification with no network at all**: `bin/netns.sh` runs a command in a fresh user and
  network namespace (`unshare -rn`, with `lo` brought up by `bin/lo-up.py`; the route table is
  empty). Fresh copies of `v-base`, `v-map`, and `v-arr` were re-run inside it (`v-ns-base`,
  `v-ns-map`, `v-ns-arr`): marketplace add, install, details, init, model listing, SDK
  `initialize`, the deploy, nested, chain, hidden, alpha, beta, and other invocations, and the
  scripted Skill calls for deploy, nomodel, and hidden. Every output matched the networked runs, and
  no `policy-limits.json` or `remote-settings.json` was written. The other variants were run only
  in networked mode. Their results are pure loader logic, and the same code reads them, so I expect
  no difference. **For future probes, use `bin/netns.sh`.**

## Q1 (FG-11): model invocation of plugin commands

**Observed.**

- A plugin command with a frontmatter `description` is in the model's skill list. A command with
  `disable-model-invocation: true` is not.
- The list is a section of the `role: "system"` message in `messages[1]`, not part of the Skill
  tool description. The Skill tool description names no skills.
- Init `slash_commands` holds both commands. Init `skills` holds only the
  `disable-model-invocation` command. That is counterintuitive, so do not use init `skills` as
  "what the model sees".

**Fixture** (`v-base`): `commands/deploy.md` (`description: Deploy things`, `argument-hint: <env>
<region>`, body `Deploy $ARGUMENTS now`) and `commands/nomodel.md` (`description: No model command`,
`disable-model-invocation: true`). Beside them: `hidden.md` (`user-invocable: false`),
`build/web.md`, `chain.md`, and `other.md`, all with descriptions; `nodesc.md` (no frontmatter);
and `whenonly.md` (only `when_to_use`).

**Command:** `bin/run.sh v-base hello2 "hello" ""`.

**Deciding output.**

- `<tree>/v-base/out/hello2-reqs/001-POST_v1_messages_beta_true.json`, in
  `body.messages[1].content[0].text`:

  ```text
  The following skills are available for use with the Skill tool:

  - probe-plugin:build:web: Build web
  - probe-plugin:chain: Chain command
  - probe-plugin:deploy: Deploy things
  - probe-plugin:hidden: Hidden command
  - probe-plugin:other: Other command
  - probe-plugin:whenonly: WHENONLY BODY $ARGUMENTS - Use when only when_to_use is set
  ```

  `probe-plugin:nomodel` and `probe-plugin:nodesc` are absent.
- `<tree>/v-base/out/hello2.jsonl` init: `slash_commands` includes `probe-plugin:build:web`,
  `probe-plugin:chain`, `probe-plugin:deploy`, `probe-plugin:nodesc`, `probe-plugin:nomodel`,
  `probe-plugin:other`, and `probe-plugin:whenonly`. `skills` includes, of the plugin's entries,
  only `probe-plugin:nomodel`.

**Model invocation (scripted stub, supplementary).** `bin/run.sh v-base mdeploy "please deploy"
'{"skill":"probe-plugin:deploy","args":"one two"}'`. The stream shows the tool result `Launching
skill: probe-plugin:deploy` (`permission_decision: accept, source: config`), then a synthetic user
message. The follow-up request (`mdeploy-reqs/002-*.json`) carries:

```json
{"type":"tool_result","tool_use_id":"toolu_stub_1","content":"Launching skill: probe-plugin:deploy"}
{"type":"text","text":"Deploy one two now\n","cache_control":{"type":"ephemeral"}}
```

There are no `<command-*>` tags on a model-invoked command. Other results:

- `probe-plugin:nomodel` gives `is_error: true` with: `<tool_use_error>Skill probe-plugin:nomodel
  cannot be used with Skill tool due to disable-model-invocation. Ask the user to run
  /probe-plugin:nomodel themselves — it cannot be invoked via the Skill tool. Do not replicate this
  skill's workflow by other means — it is reserved for explicit user invocation.</tool_use_error>`.
- `probe-plugin:hidden` runs (`HIDDEN BODY zz\n`).
- `probe-plugin:nodesc` also runs (`NODESC BODY zz\n`), although it is not listed.

**Binary.**

- Byte 284135673, the predicate behind the listing:

  ```js
  function Y_e(e){return e.type==="prompt"&&!e.disableModelInvocation&&!Q5(e)&&(e.source==="builtin"||e.loadedFrom==="bundled"||e.loadedFrom==="skills"||e.loadedFrom==="syncedSkills"||e.loadedFrom==="attachedFolder"||e.loadedFrom==="commands_DEPRECATED"||e.hasUserSpecifiedDescription||!!e.whenToUse)}
  ```

  `Q5` only reflects `skillOverrides` settings.
- Byte 284853141, the plugin command object built in `XK`: `source:"plugin",loadedFrom:S||w.isSkillMode?"plugin":void 0`,
  with `hasUserSpecifiedDescription:Z!==null` and `disableModelInvocation:no,userInvocable:ho`. A
  plugin `.md` command therefore has `loadedFrom` undefined. It is listed only with a description or
  `when_to_use`.
- Byte 288155242: `skill_listing:(e)=>{if(!e.content)return[];return ud([De({content:`The following skills are available for use with the Skill tool:\n\n${e.content}`,isMeta:!0})])}`.
- Byte 285253458, init `skills` (`lsr`):

  ```js
  (y)=>y.type==="prompt"&&y.source!=="builtin"&&!_k(y)&&(y.hasUserSpecifiedDescription||y.whenToUse)&&(y.loadedFrom==="skills"||...||y.loadedFrom==="plugin"||y.loadedFrom==="bundled"||y.disableModelInvocation)
  ```

  So a plugin `.md` command enters init `skills` only through `disableModelInvocation`.
- Byte ~286438932, the Skill tool check (`jKe`): `if(e.disableModelInvocation&&!s)return{reason:"disable_model_invocation",...errorCode:4}`,
  where `s` is `userTypedThisTurn`. Once the user has typed the command in this turn, the model may
  call it too (not probed).

**Docs** (https://code.claude.com/docs/en/skills, retrieved 2026-11-01): "**Custom commands have
been merged into skills.** A file at `.claude/commands/deploy.md` and a skill at
`.claude/skills/deploy/SKILL.md` both create `/deploy` and work the same way." The invocation table
says: default, you and Claude both invoke; `disable-model-invocation: true` = "Not on its own" and
"Description not in context"; `user-invocable: false` = you "No", Claude "Yes". The page does not
mention plugin commands, and it states the "first non-empty line" description fallback without the
listing gate seen above.

**Confidence:** high (probe, re-run in the network-free namespace, plus code). The description gate
is high for plugin `.md` commands. It was not probed for `.claude/commands/` files
(`commands_DEPRECATED` passes regardless, by code).

## Q2 (FG-12): `user-invocable: false` on a command

**Observed.**

- `probe-plugin:hidden` is absent from init `slash_commands`, absent from init `skills`, and absent
  from the SDK `initialize` command list.
- It is present in the model's list: `- probe-plugin:hidden: Hidden command`.
- Typing `/probe-plugin:hidden hello` is refused locally. No request reaches the API, the body is not
  sent, and nothing reaches the model. The model may still invoke it (Q1).

**Command:** `bin/run.sh v-base hidden "/probe-plugin:hidden hello" ""`, which exits 0.

**Deciding output.**

- `<tree>/v-base/out/hidden-reqs/` is empty: the stub captured zero requests.
- `hidden.jsonl` holds only `system/init` and
  `{"type":"result","subtype":"success","is_error":false,"num_turns":0,"result":"","local_command":"custom",...}`.
  The refusal text is not in the stream.
- The session transcript
  `<tree>/v-base/config/projects/-tmp-claude-0--home-user-pi-claude-marketplace-573eac57-8096-527f-94a8-f7aea09fcdeb-scratchpad-probe-p3-tree-v-base-project/8be8242b-0c81-41a9-857e-b640a55ccf4d.jsonl`
  records three user entries:
  1. `<local-command-caveat>The command below was run directly in Claude Code, not sent to you as a request, and its output goes straight to the user. ...</local-command-caveat>`
  2. `/probe-plugin:hidden` (the arguments are dropped)
  3. `This skill can only be invoked by Claude, not directly by users. Ask Claude to use the "probe-plugin:hidden" skill for you.`

**Binary.**

- Byte 304942148:

  ```js
  if(r.userInvocable===!1)return m(L,"cmd_not_user_invocable"),{messages:[De({content:Iq({inputString:`/${Qt(e)}`,precedingInputBlocks:u}),uuid:h}),De({content:`This skill can only be invoked by Claude, not directly by users. Ask Claude to use the "${Qt(e)}" skill for you.`})],shouldQuery:!1,command:r};
  ```

- Byte 291878564: `slash_commands:e.commands.filter((t)=>t.userInvocable!==!1).map((t)=>t.name)`.
  The init `skills` field applies the same filter (byte 291879290).
- `XK` sets `isHidden:!ho` from `G["user-invocable"]`.

**Docs** (skills page): "Claude Code hides it from the `/` menu and doesn't run it when you type
`/name`."

**Confidence:** high (probe, namespace re-run, code, docs).

## Q3 (FG-13): object-map `commands`

**Fixture** (`v-map`), exactly as specified, with `cmds/a.md` (frontmatter `description: Alpha from
file`, body `ALPHA FILE BODY $ARGUMENTS`) and `commands/other.md` (`description: Other in commands
folder`):

```json
"commands": { "alpha": { "source": "./cmds/a.md", "description": "Alpha from manifest" },
              "beta": { "content": "Beta inline body $ARGUMENTS", "description": "Beta inline", "argumentHint": "<x>" } }
```

**Observed.**

1. **Validate and install.** `plugin validate` on the plugin dir and on the marketplace:
   `✔ Validation passed with warnings` (the only warning is the missing author), exit 0. Install:
   `✔ Successfully installed plugin: probe-plugin@probe-mp (scope: user)`, exit 0.
   `plugin details` shows `Skills (0)`: its inventory does not count mapped commands.
2. **Names.** Init `slash_commands` lists `probe-plugin:alpha` and `probe-plugin:beta`. There is no
   `probe-plugin:a` and no `probe-plugin:other`.
3. **`commands/other.md` is shadowed.** `/probe-plugin:other x` and `/probe-plugin:a x` both reach
   the model as literal text, preceded by a system-reminder: "The user's message starts with the
   slash command /probe-plugin:other, but no command with that name is available in this session,
   so it did not run. ...". `plugin list` shows `Note: Default commands/ folder is ignored because
   the manifest sets "commands"`, and `--json` gives `noteDetails[0].type:
   "folder-shadowed-by-manifest"`. The debug log reads `Plugin probe-plugin: commands/ folder exists
   but is not auto-loaded because the manifest sets "commands"`. Init carries no `plugin_warnings`.
4. **What the model receives.**
   - Listing: `- probe-plugin:alpha: Alpha from manifest` and `- probe-plugin:beta: Beta inline`.
   - `/probe-plugin:alpha x` sends
     `"<command-message>probe-plugin:alpha</command-message>\n<command-name>/probe-plugin:alpha</command-name>\n<command-args>x</command-args>\n"`
     and then `"ALPHA FILE BODY x\n"`.
   - `/probe-plugin:beta x` sends the same tag block for `beta`, and then `"Beta inline body x"`
     (no trailing line feed, because the inline content has none).
   - The debug log reads `Loaded command from plugin probe-plugin custom file: .../cmds/a.md (with
     metadata override)` and `Loaded inline content command from plugin probe-plugin:
     probe-plugin:beta`.
5. **The manifest overrides the file.** `description` beats the frontmatter `description` ("Alpha
   from manifest" wins). In `v-map2`, the manifest's `argumentHint: "<manifest-hint>"` beats the
   file's `argument-hint: <file-hint>`. The manifest's `model: "haiku"` beats the file's `model:
   sonnet`: `/probe-plugin:gamma x` requests went out with `"model": "claude-haiku-5-5"`, against the
   session default `claude-opus-5-5`. A field the manifest leaves out keeps the file's value
   (`gamma` has no manifest description, and lists as `G from file`). `allowedTools` merges the same
   way by code; its effect was not observed.
6. **`argumentHint` is observable** only in the SDK `initialize` response:
   `{"name":"probe-plugin:beta","description":"(probe-plugin) Beta inline","argumentHint":"<x>"}`.
   It is not in init and not in the model request. Plugin command descriptions there carry a
   `(probe-plugin)` prefix.
7. **`source` names a directory** (`v-mapdir`, `"gamma": {"source": "./cmds", "description":
   "Gamma dir from manifest"}`). The key and its metadata are ignored. The directory loads under
   file-based names, walking subfolders: `probe-plugin:a` (`A in dir`) and `probe-plugin:sub:y`.
   There is no `probe-plugin:gamma`.
8. **`source` names a missing file** (`v-mapmissing`, `delta` points to `./cmds/missing.md`, `eps`
   to an existing file).
   - `plugin validate` fails, exit 1: `commands.delta.source: Path not found: ./cmds/missing.md. The
     runtime loader will report this as a load failure.`
   - Install still exits 0.
   - The session loads `probe-plugin:eps`, and `delta` is absent. Init has no `plugin_errors`.
   - `plugin list` shows `Status: ✘ failed to load` and `Error: Path not found:
     <abs>/cmds/missing.md (commands)`, even though `eps` works.
9. **`source` and `content` together** (`v-mapboth`). `plugin validate` fails: `commands.both:
   Command must have either "source" (file path) or "content" (inline markdown), but not both`.
   Install fails, exit 1: `Plugin ... has an invalid manifest file ... Validation errors:
   commands.both: ...`. The valid sibling entry is lost with it. Neither field set: the same refine
   fails, by code and by the docs (not probed).
10. **Forms** (see Q7). A string (a file or a directory), an array of strings, and an object map are
    all accepted. An array that holds an object (`v-arrmix`) fails validation (`commands: Invalid
    input`), and install exits 1.
11. **Map keys are used verbatim, with no normalization** (`v-mapkeys`, all inline `content` with a
    description).
    - Registered, in init and the model list: `probe-plugin:Upper`, `probe-plugin:ns:sub`,
      `probe-plugin:dir/name`, `probe-plugin:has space`, `probe-plugin:dot.name`, and
      `probe-plugin:ünï`.
    - Refused at load, with nothing else visible: `trail:` and `<angle>`. The debug log reads
      `[WARN] [names] probe-plugin:trail: is not offered: a name may not hold hidden,
      direction-changing or blank-like characters, < or >, or be over 256 characters`.
    - Typed, these run: `/probe-plugin:Upper x`, `/probe-plugin:ns:sub x`, `/probe-plugin:dir/name x`,
      `/probe-plugin:dot.name x`, and `/probe-plugin:ünï x`.
    - Matching is **case-sensitive**. `/probe-plugin:upper x` is unknown, and its reminder says "The
      closest available command is /probe-plugin:Upper. Ask the user before running it."
    - `/probe-plugin:has space x` parses as `/probe-plugin:has`, which is unknown. A key with a space
      is listed but cannot be typed.
12. **More map edges** (`v-map2`).
    - Two keys on one file (`delta`, `delta2` → `./cmds/d.md`): only the first key loads (the
      loader skips a file it has already loaded), and `/probe-plugin:delta2` is unknown.
    - A non-`.md` source (`./cmds/t.txt`, which exists) is checked and silently not loaded.
    - Inline `content` without a description (`nodesc`) is a slash command but is not in the model
      list. Its SDK description is the A2e fallback `INLINE NODESC BODY $ARGUMENTS`.
    - Frontmatter inside inline `content` is parsed. `fm` with
      `"---\ndescription: FM in content\nargument-hint: <c>\n---\nFM BODY $ARGUMENTS"` lists as
      `FM in content`, with `argumentHint` `<c>`.
13. **Map in a marketplace entry** (`v-mapmkt` has a `plugin.json` without `commands`;
    `v-mapmkt-nomanifest` has no `plugin.json`). The same `alpha`/`beta` map sits in the entry.
    - Both load `probe-plugin:other` from `commands/`, plus `probe-plugin:alpha` (listed `Alpha
      from entry`).
    - The inline `content` entry `beta` is **silently dropped**: no log line, no error, and
      `/probe-plugin:beta` is unknown.
    - The default `commands/` folder is **not** shadowed: the debug log reads `Loaded 1 commands
      from plugin probe-plugin default directory`, and there is no note.

**Binary.**

- Byte 274106966, the entry schema:

  ```js
  vps=p(()=>u({source:Sr().optional().describe("Path to command markdown file, relative to plugin root"),content:o().optional().describe("Inline markdown content for the command"),description:o().optional().describe("Command description override"),argumentHint:o().optional().describe('Hint for command arguments (e.g., "[file]")'),model:o().optional().describe("Default model for this command"),allowedTools:A(o()).optional().describe("Tools allowed when command runs")}).refine((e)=>e.source&&!e.content||!e.source&&e.content,{message:'Command must have either "source" (file path) or "content" (inline markdown), but not both'}))
  ```

- Byte 274107597, the union:

  ```js
  Ml=p(()=>u({commands:Ue([Sr().describe("Path to a command file or skill directory, relative to the plugin root. When set, the commands/ directory is not auto-loaded — list its files here if you want both."),A(Sr().describe(...)).describe("List of command file or skill directory paths. When set, the commands/ directory is not auto-loaded."),pe(o(),vps()).describe('Object mapping of command names to their metadata and source files. Command name becomes the slash command name (e.g., "about" → "/plugin:about")')])}))
  ```

- Byte 287726232, `IKn`. A map is detected only by its **first** value:
  `Ee=Object.values(n)[0];if(typeof n==="object"&&!Array.isArray(n)&&Ee&&typeof Ee==="object"&&(("source"in Ee)||("content"in Ee))){...`.
  A `source` that exists is pushed to `commandsPaths` and recorded in `commandsMetadata`. A missing
  one pushes `{type:"path-not-found",...,component:"commands"}`. `content` counts only when
  `registerInlineContent` is set: `if(pt.content&&Z)return{...kind:"content"};return{...kind:"skip"}`.
  Otherwise the value is wrapped as `Ae=Array.isArray(n)?n:[n]`, and a non-string element is
  `kind:"invalid"`, logged as `Unexpected command format in ${we} for ${y}`.
- Callers.
  - `plugin.json`: `let Et=!Se.commands&&Me` (byte 287733319), then
    `if(Et)Ee.commandsPath=Zt;if(Se.commands)await IKn(Ee,Se.commands,{...mode:"assign",origin:"manifest",...,registerInlineContent:!0,...})`
    (bytes 287733479 and 287733647).
  - Marketplace entry: `fKn` (byte 287777491) calls `IKn(...,{...origin:"marketplace-entry",...,registerInlineContent:!1,...})`
    (byte 287777722). It runs with `mode:"assign"` when there is no `plugin.json`, and
    `mode:"append"` when there is one (byte 287776619). Neither path clears `commandsPath`, so the
    default folder survives an entry declaration.
- Byte 284856384, the session loader (`dbe`), file branch:

  ```js
  else if(ke.isFile()&&Z.endsWith(".md")){if(Vhe(Se,Z,L))return[]; ... if(w.commandsMetadata){for(let[nt,pt]of Object.entries(w.commandsMetadata))if(pt.source){let Et=rwe(w.path,pt.source);if(Z===Et){We=`${w.name}:${nt}`,ze=pt;break}}}if(!We)We=`${w.name}:${jL(Z).replace(/\.md$/,"")}`;let lt={filePath:Z,baseDir:zR(Z),frontmatter:s5e(Ee,ze),...}
  ```

  A directory path goes to `DZt` instead, without the metadata.
- Byte 284857472, the inline branch:
  `if(Z.content&&!Z.source)try{let{frontmatter:Se,...,content:Ee}=sd(Z.content,`<inline:${w.name}:${q}>`,{normalizeKeys:!0}),Ae=`${w.name}:${q}`,...frontmatter:s5e(Se,Z)...`.
- Byte 284847373, the override order:
  `function s5e(e,n){if(n===void 0)return e;return{...e,...n.description&&{description:n.description},...n.argumentHint&&{"argument-hint":n.argumentHint},...n.model&&{model:n.model},...n.allowedTools&&{"allowed-tools":n.allowedTools.join(",")}}}`.
- Byte 284163120, the name rule:
  `var ePo=/(?:^|:) | (?::|$)|^:|:$/;function tPo(e){return sbs(e)&&!ePo.test(e)}function $z(e){return tPo(e)||hV(e)&&!p1t()}`.
  `XK` applies it with `if(!$z(e))return fL(e,"is not offered"),null;`. `sbs` rejects hidden or
  bidi characters, `<`, `>`, and double spaces.
- Byte 287732690, the shadow note:
  `t(`Plugin ${Se.name}: ${Ho}/ folder exists but is not auto-loaded because the manifest sets ...`),q.push({type:"folder-shadowed-by-manifest",...})`.

**Docs** (https://code.claude.com/docs/en/plugins-reference, served as "Plugin manifest reference",
retrieved 2026-11-01).

- Fields table: "`commands` | Path, array of paths, or object | Flat `.md` command files,
  directories of them, or an object map of command name to `source` or `content`. Replaces the
  default `commands/` scan".
- `commands` section: "In the object map, each key becomes the command name after the plugin
  prefix. For example, `"about"` in plugin `deploy-tools` runs as `/deploy-tools:about`. Each value
  sets exactly one of `source` or `content`, and an entry that sets both or neither fails
  validation." Its table lists `source`, `content`, `description`, `argumentHint` ("Argument hint
  shown after the command name"), `model`, and `allowedTools`.
- "How each key combines with its default location": "When you set `commands`, the default
  `commands/` directory isn't scanned. To keep the default and add more, list it explicitly". Also:
  "`claude plugin list` and the `/plugin` interface then show the warning `Default <folder>/ folder
  is ignored because the manifest sets "<key>"`."
- "How entry fields combine with `plugin.json`": "**No `plugin.json`**: the entry is the manifest,
  regardless of `strict`", and "**`plugin.json` present, `strict` unset or `true`**: Claude Code
  loads the manifest and appends the entry's `commands`, ...".

**Confidence:** high for every observed item. Medium only where the docs and binary seem to differ
by inference (see below).

## Q4: command message shape

**Observed** for `/probe-plugin:deploy one two` (`bin/run.sh v-base deploy ...`, request
`deploy-reqs/001`). The user message is `messages[0]` with three text blocks. Block 0 is the
binary's standard attribution `<system-reminder>`, which has nothing to do with the command. Then:

```json
{"type":"text","text":"<command-message>probe-plugin:deploy</command-message>\n<command-name>/probe-plugin:deploy</command-name>\n<command-args>one two</command-args>\n"}
{"type":"text","text":"Deploy one two now\n"}
```

- There is no `Base directory for this skill:` line. That line is skill-only:
  `let rr=w.isSkillMode?`Base directory for this skill: ${zR(n.filePath)}\n\n${q}`:q`, followed by
  `T2e(rr,yo,!0,...)` and `return[{type:"text",text:rr}]` (near byte 284853500).
- With no arguments (`/probe-plugin:deploy`), the `<command-args>` line is **omitted**, and
  `$ARGUMENTS` becomes the empty string (`"Deploy  now\n"`, two spaces). The arguments are `""`,
  not undefined.
- Quoted arguments (`/probe-plugin:deploy "a b" c`) arrive raw in both places:
  `<command-args>"a b" c</command-args>` and `"Deploy \"a b\" c now\n"`.
- **Nested command:** `commands/build/web.md` is `probe-plugin:build:web` in init, in the model
  list, and in the SDK list. `/probe-plugin:build:web x` sends
  `<command-message>probe-plugin:build:web</command-message>\n<command-name>/probe-plugin:build:web</command-name>\n<command-args>x</command-args>\n`
  and then `"BUILD WEB BODY x\n"`. `plugin details` omits nested commands (`Skills (5) chain,
  deploy, hidden, nomodel, other`).
- Model-invoked commands carry no tags (Q1).

**Confidence:** high (namespace re-run included).

## Q5: `argument-hint`

**Observed.** `argument-hint: <env> <region>` does not appear in the stream-json output (init or
otherwise) or in any captured API request. `grep -rlF '<env> <region>' <tree>/v-base/out/` finds
nothing. It is observable through the SDK `initialize` control response (`bin/ctl.sh v-base
ctlinit`):

```json
{"name":"probe-plugin:deploy","description":"(probe-plugin) Deploy things","argumentHint":"<env> <region>"}
```

Commands with no hint get `"argumentHint":""`. A map's `argumentHint` appears there too (Q3). The
TUI was not probed. **Docs** (skills page): "Hint shown during autocomplete to indicate expected
arguments." **Confidence:** high.

## Q6: a command whose body begins with a slash

**Observed.** There is no re-expansion: the body is sent literally. `commands/chain.md` has the body
`/probe-plugin:other run`.

- `/probe-plugin:chain` sends `<command-message>probe-plugin:chain</command-message>\n<command-name>/probe-plugin:chain</command-name>\n`
  and then `"/probe-plugin:other run\n"`.
- `/probe-plugin:chain extra` sends `"/probe-plugin:other run\n\n\nARGUMENTS: extra"`.
- `OTHER BODY` appears in none of the captured requests (`grep -l "OTHER BODY"` exits 1).

This was observed in print mode, and re-run in the network-free namespace. The TUI was not probed.
The skills docs describe stacking typed skills (`/a /b args`) at the terminal prompt, and say
"Through the Agent SDK or `claude -p`, Claude Code loads only the first skill". That concerns typed
input, not bodies. **Confidence:** high for print mode.

## Q7: path forms in `plugin.json`

**Fixtures:** `cmds/a.md`, `cmds/sub/y.md`, `more/b.md`, `more/sub/x.md`, and `commands/other.md`,
all with descriptions.

| Variant | `commands` | Init `slash_commands` (plugin entries) | `commands/other.md` |
| :- | :- | :- | :- |
| `v-arr` | `["./cmds/a.md", "./more"]` | `probe-plugin:a`, `probe-plugin:b`, `probe-plugin:sub:x` | ignored, with note |
| `v-strfile` | `"./cmds/a.md"` | `probe-plugin:a` | ignored, with note |
| `v-strdir` | `"./cmds"` | `probe-plugin:a`, `probe-plugin:sub:y` | ignored, with note |
| `v-arrmix` | `["./cmds/a.md", {"alpha": {"source": "./cmds/a.md"}}]` | none: validate `commands: Invalid input`, install exit 1 | n/a |
| `v-arrmkt` (in the **marketplace entry**, `plugin.json` without `commands`) | `["./cmds/a.md", "./more"]` | `probe-plugin:other`, `probe-plugin:a`, `probe-plugin:b`, `probe-plugin:sub:x` | **loaded**, no note |
| `v-arrmkt-nomanifest` (entry, no `plugin.json`) | `["./cmds/a.md"]` | `probe-plugin:other`, `probe-plugin:a` | **loaded**, no note |

- A single file loads under its basename without `.md` (`probe-plugin:a`).
- A declared directory is walked recursively. Names are relative to **that** directory and
  colon-joined: `./more/sub/x.md` becomes `probe-plugin:sub:x`, not `probe-plugin:more:sub:x`.
- The model list and the SDK list match init. `v-arr` was re-run in the namespace with identical
  results.

**Binary.** Byte 284847848, the naming in `DZt`:

```js
function fXo(e,n,r){if(i5e(e)){let h=zR(e),y=zR(h),S=jL(h),w=y.startsWith(n)?y.slice(n.length).replace(/^[/\\]/,""):"",L=w?w.split(/[/\\]/).join(":"):"";return L?`${r}:${L}:${S}`:`${r}:${S}`}else{let h=zR(e),y=jL(e).replace(/\.md$/,""),S=h.startsWith(n)?h.slice(n.length).replace(/^[/\\]/,""):"",w=S?S.split(/[/\\]/).join(":"):"";return w?`${r}:${w}:${y}`:`${r}:${y}`}}
```

Here `i5e(e)` is `/^skill\.md$/i`, and `DZt` calls `pXo(e,e,w)`, so the base is the declared
directory. `pXo` walks with `{stopAtSkillDir:!0,logLabel:"commands"}`. File names are not normalized
(contrast skills, `Qqn`).

**Confidence:** high.

## Supplementary observations (not asked; `v-extra`, `v-base`)

- **Frontmatter `name` on a command works as for skills (02-CONTEXT E1).** `commands/named.md` has
  `name: fancycmd`.
  - Init and the transcript name it `probe-plugin:named`.
  - The model list reads `- probe-plugin:named (probe-plugin:fancycmd): Named command`.
  - The SDK list has `{"name":"probe-plugin:fancycmd",...,"aliases":["fancycmd","probe-plugin:named"]}`.
  - `/probe-plugin:named x`, `/probe-plugin:fancycmd x`, and `/fancycmd x` all send
    `<command-name>/probe-plugin:named</command-name>` and `NAMED BODY x\n`.
- **A `SKILL.md` inside `commands/`.** `commands/tool/SKILL.md` becomes `probe-plugin:tool`, which
  is skill-typed: it appears in init `skills`. Its body is sent without the base-directory line.
  `commands/tool/extra.md` beside it is dropped silently (`mXo` keeps only the `SKILL.md` of a
  folder).
- **No normalization of `.md` command names.** `commands/foo.bar.md` becomes `probe-plugin:foo.bar`.
- **The listing gate** (Q1): `when_to_use` alone is listed as `<A2e fallback> - <when_to_use>`.
- **Unknown slash input.** `/probe-plugin:<unknown>` reaches the model as literal text together with
  an `unknown_command_fallback` system-reminder (byte 288154629). The reminder names the closest
  command when one exists. 02-CONTEXT E1 ("reaches the model as the literal text") holds, but the
  text is not alone.

## Docs and binary differ

1. **Marketplace entry with no `plugin.json`.** The docs say "the entry is the manifest, regardless
   of `strict`" and that `commands` "Replaces the default `commands/` scan". Read together, that
   implies `commands/` is not scanned. The binary scans it and adds the entry's paths
   (`v-mapmkt-nomanifest`, `v-arrmkt-nomanifest`). The docs do not state this case explicitly, so
   the difference is an inference. Medium confidence.
2. **Marketplace-entry map `content`.** The docs say an entry "accepts ... every field on this
   page". The binary drops inline `content` map entries from marketplace entries silently
   (`registerInlineContent:!1`).
3. **Map `source` naming a directory.** The docs describe "Path to the command's Markdown file". The
   binary accepts a directory, ignores the key and the metadata, and uses file-based names.
4. **Plugin commands without a description.** The skills docs give the "first non-empty line"
   fallback for descriptions. A plugin `.md` command with neither `description` nor `when_to_use`
   is left out of the model's list (`Y_e`). Its menu and SDK description uses the fallback, and the
   Skill tool still runs it by name.
5. **Nesting.** The standard layout says `commands/` holds "Flat Markdown command files". The binary
   walks subfolders and turns a subfolder that holds a `SKILL.md` into a skill-typed command.
6. **Upstream CLI quirks, not docs.** `plugin details` omits nested and mapped commands. `plugin
   list` reports `✘ failed to load` for a plugin with one missing map source, while the session
   loads its other commands.

## Bearing on recorded project decisions (facts only)

- **D-CF1-06** (01-CONTEXT) says: "A declared `commands`, `agents`, or `workflows` path
  (marketplace entry or plugin manifest) replaces the conventional folder." For **commands** in
  2.1.316, only a `plugin.json` declaration replaces the folder, with the note. A marketplace-entry
  declaration **adds** to `commands/`, with or without `plugin.json`, and gives no note. The binary's
  `Et=!Se.commands&&Me` reads only the plugin manifest `Se`. The marketplace-entry case was not
  probed for agents and workflows.
- **02-CONTEXT, deferred "case-insensitive slash names".** Plugin command names match
  case-sensitively. A near miss only gets the "closest available command" hint.
- **02-CONTEXT, deferred FG-13 clash re-check.** A mapped command's name is `<plugin>:<key>`
  verbatim. It can contain `:`, `/`, `.`, uppercase, non-ASCII, or a space (a space makes it
  untypeable).
- **FG-11.** Plugin commands are model-invocable through the Skill tool. They are listed only with a
  `description` or `when_to_use` and without `disable-model-invocation`. The Skill tool also runs an
  unlisted command by name.
- **FG-12.** A typed `/name` is refused locally with the refusal text above. The command is hidden
  from `slash_commands` and from the SDK list, stays in the model list, and remains model-invocable.

## Dubious Choices

1. I added `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1` and
   `CLAUDE_CODE_DISABLE_OFFICIAL_MARKETPLACE_AUTOINSTALL=1` to the 02-CONTEXT recipe, to suppress
   telemetry and the first-run GCS or git fetch of the official marketplace (byte ~310619000). By
   code they gate only network features. Every run, the namespace runs included, used them, so I
   have no A/B comparison without them.
2. **Isolation gap.** In the first 16 trees, the `claude plugin` commands reached
   `api.anthropic.com/api/claude_code/policy_limits` directly, and probably
   `/api/claude_code/settings` too. They received a signed policy bound to a stable identity, without
   any credential from the probe. That breaks "no network other than localhost". I found it after
   the fact, stopped networked runs, and re-verified the core results in a loopback-only namespace.
   The other variants (`v-map2`, `v-mapdir`, `v-mapmissing`, `v-mapboth`, `v-mapkeys`, `v-mapmkt*`,
   `v-str*`, `v-arrmix`, `v-arrmkt*`, `v-extra`) rest on networked runs only.
3. I extended the stub with a scripted `Skill` tool call, beyond the 400-only recipe, to observe a
   model-invoked command. It is a local fake. No model and no credential is involved.
4. I used an SDK `initialize` control request, not in the recipe, to observe `argumentHint`.
5. I used one tree per variant, each with plugin `probe-plugin`, instead of one marketplace with
   many plugins.
6. I added fixtures beyond the brief (`nodesc`, `whenonly`, the `v-map2` extras, `v-extra`) to
   explain the listing gate, the override order, and naming edges. `nodesc.md` and `whenonly.md`
   were added to `v-base` after the first `hello` run (`hello` vs `hello2`).
7. I kept the probe tree, as the caller asked. The compat-research skill says to remove it.
8. Minified helper names collide across bundle chunks (`fXo`, `hV`, `$z`, `_k`, and `i5e` each occur
   more than once). I quoted the definitions at the cited offsets next to the loader, and the probes
   agree with them.
9. Q6 and every invocation were observed in print mode only. The TUI was not probed.
10. Docs quotes come through the WebFetch tool. The plugins-reference text was returned as the page
    markdown. The skills page quotes passed through its summarizer, so the wording may differ
    slightly.
