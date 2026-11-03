# Phase 1: Harness and Version Raise - Research

**Researched:** 2026-11-01 (session started 2026-10-31)
**Domain:** Pi 1.4.0 and companion raise; pi-mcp-adapter 7.x escape; cucumber harness on Pi's faux provider; ports of Claude Code 2.1.316's argument substitution (`T2e`), dynamic context injection (`HRe`), description fallback (`A2e`), and component-directory rule
**Confidence:** HIGH for versions, adapter 7.0 behavior, Pi trust, and the upstream code read from the binary. MEDIUM for the tokenizer golden vectors (the grammar version Claude bundles is unknown), the Bash-tool failure text, and background-child extension loading (source-read, not run).

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

### Pre-fan-out: invocation content of skills and commands (DEC-01)

- **D-CF1-01 (argument substitution; FG-01, FG-02, FG-03, FG-04):** When a
  user invokes a bridged command (`/<plugin>:<cmd> <args>`) or a bridged skill
  (`/skill:<name> <args>`, or its `/<plugin>:<skill>` alias), the content the
  model receives follows E1 exactly: 0-based `$N` and `$ARGUMENTS[N]` with a
  missing index left literal, `$ARGUMENTS` as the raw text, named `$name` from
  frontmatter `arguments`, the `\$` escape, the `ARGUMENTS:` append, no
  re-substitution of values, Pi-only forms left literal, the size cap, and
  `${CLAUDE_SESSION_ID}` (the Pi session id) and `${CLAUDE_EFFORT}` replaced
  at invocation. **Mechanism:** one pure port of `T2e`, built and unit-tested
  in Phase 1, called from Pi's `input` event at invocation time. No
  install-time placeholder rewriting. Phase 2 wires it for skills in
  `edge/skill-aliases.ts`, producing Pi's own `<skill>` block with the
  substituted body and no raw arguments after the block. Phase 3 wires it for
  commands in a command input handler that Phase 1 creates as a pass-through
  seed, producing the substituted body as Pi's template expansion would.
  Residual difference licensed by the Pi gap and recorded under this ID:
  whatever the port's tokenizer cannot reproduce of upstream's shell parser
  (it must match quoting and backslash escapes).
- **D-CF1-02 (dynamic context injection; FG-05):** Implement it. In
  user-invoked bridged commands and skills, each `` !`cmd` `` and ```` ```! ````
  block runs after argument substitution, before the content reaches the
  model, and its output replaces the pattern (E2). A failing command aborts
  the invocation with upstream's message shape, reported through the notify
  chokepoint, and nothing reaches the model. `shell: bash` (default) and
  `shell: powershell` select the shell. Pi has no permission modes, so the
  bridge behaves like Claude Code's `bypassPermissions` mode for these
  commands: each runs, and `allowed-tools` does not gate it (Pi-gap license,
  recorded under this ID). **Mechanism:** the parser and splicer are part of
  the Phase 1 invocation core; the process spawn lives in one new `platform/`
  module added to the `child-process-chokepoint` exemptions in
  `rule-packs/architecture.json`. The plan carries a threat model: the
  commands come from the installed plugin, the same trust as its hooks, and
  arguments flow into them as upstream.
- **D-CF1-03 (model-invoked skills; Pi gap):** When the model uses a skill on
  its own, Pi lists it in the system prompt and the model reads `SKILL.md`
  itself; no extension hook sits on that path. D-CF1-01 and D-CF1-02 therefore
  apply only to user-invoked skills and commands. Licensed by the Pi
  capability gap.
- **D-CF1-04 (description fallback; FG-06):** A skill or command with no
  frontmatter `description` gets E3 (`A2e`). Skills: replaces the
  first-paragraph fallback; supersedes D-86-06 (SKILL-02), which followed older
  upstream docs. Commands: the bridge writes the computed `description` into
  the staged frontmatter at install, so Pi's 60-character fallback never
  applies. One pure port in Phase 1; Phases 2 and 3 wire it.
- **D-CF1-05 (unhonored frontmatter fields; FG-10):** One divergence ID,
  licensed by the Pi gap (Pi reads only `name`, `description`,
  `argument-hint`, and `disable-model-invocation`): `disallowed-tools`,
  `model`, `effort`, `agent`, `context`, `background`, `hooks`, and `paths`
  have no effect on bridged skills and commands. Install reports them as the
  agents bridge does, with one `[<source>] dropped fields: <fields>` warning
  per component in the bridge's discovery warnings. Not reported:
  `allowed-tools` (it only grants tools, and Pi runs every tool without
  asking), `arguments` and `shell` (honored by D-CF1-01 and D-CF1-02), and
  `user-invocable` (its own divergence, D-CF1-09, kept as it is by the user).
  The field table lives in the Phase 1 core, so both phases report the same
  fields.

### Pre-fan-out: plugin layout and harness trust (DEC-01)

- **D-CF1-06 (component directories; FG-14):** Follow E4. A declared
  `commands`, `agents`, or `workflows` path (marketplace entry or plugin
  manifest) replaces the conventional folder; a declared `skills` path adds to
  `skills/`. When a declaration leaves an existing conventional folder unread,
  install warns, as upstream records `folder-shadowed-by-manifest`. Supersedes
  D-07 (COMP-01) and D-24 for commands, agents, and workflows; skills keep the
  union. D-24 adopted the union "vs upstream Claude Code behavior" as
  documented in 2026-05, and upstream has since changed, so this keeps D-24's
  intent. The PROJECT.md Out of Scope bullet ("Custom component-path arrays as
  supplemental -- explicit declaration replaces the default") is rewritten to
  state the per-kind rule (DEC-02). Implemented once in Phase 1
  (`domain/component-paths.ts` strict arm and the lenient mirror
  `deriveLenientComponentPaths` in `orchestrators/plugin/info.ts`), with a
  scenario that fails without it, and with every existing test and scenario
  that pins the union for those three kinds updated. Phases 3, 4, and 7 pin
  their own kind.
- **D-CF1-07 (project trust in the harness; FG-29 setup, Pitfall 7):** The
  profile Pi trusts its sandbox project by default through a persisted
  trust-store entry: the record Pi saves when a user answers its trust prompt.
  Not `--approve`, not `defaultProjectTrust`. A `Given` starts a profile Pi on
  an untrusted project (no entry), and Phase 1 seeds one untrusted scenario
  beside a trusted one (HAR-06). Project MCP server approval is not part of
  the default: a separate `Given` sets pi-mcp-adapter's user-global
  `projectServers: "allow"`, so Phase 6 can settle FG-29 either way.
- **D-CF1-08 (function directory names):** `features/skill/`,
  `features/slash-command/` (`command` already names `command.steps.ts`),
  `features/agent/`, `features/hook/`, `features/mcp-server/` (not `mcp`),
  `features/workflow/`. A parameter type a phase adds is prefixed with its
  kind.

### The 2026-10-31 decisions (DEC-02, FG-33)

These are the user's decisions from spike 028; this discussion only assigns
IDs.

- **D-CF1-09 (`user-invocable: false`):** Keep today's behavior (listed and
  runnable) as a divergence licensed by the Pi gap: Pi has no per-skill way to
  hide a slash command. Report the gap to Pi. Phase 3 extends the ID to
  commands (FG-12).
- **D-CF1-10 (`new` sent as `clear`):** SessionStart `source` and SessionEnd
  `reason` send `clear` for Pi `new`, and `clear` matchers are admitted.
  Supersedes those parts of D-58-06 and D-60-04.
- **D-CF1-11 (`compact` on compaction):** SessionStart fires with
  `source: "compact"` on Pi's `session_compact`, and `compact` matchers are
  admitted. Supersedes that part of D-58-06.
- **D-CF1-12 (`fork` matchers):** `fork` matchers are admitted; Pi sends the
  same value.

Phase 5 implements D-CF1-10..12. Phase 1 widens the Pi event and API types
they need in `platform/pi-api.ts`.

### Phase 1's own decisions

- **D-CF1-13 (`${NAME:-default}` under pi-mcp-adapter 7.x; VER-05):** Leave
  `${NAME:-default}` in `command`, `args`, `env`, `url`, and `headers` to the
  adapter, which expands it at connect time, as Claude Code does (E7).
  Deny-listed names keep their install-time decision (AVAR-05). Literal text,
  including a literal `${NAME:-x}` the bridge writes (such as an `oauth`
  value), is escaped so it reaches the server unchanged (VER-04). Precondition:
  the conformance property shows that adapter 7.x expands `:-` as Claude's rule
  (`domain/claude-mcp-variables.ts`) does for unset, empty, and set values. If
  any case differs, keep today's install-time resolution of `:-` and record the
  difference under this ID.
- **D-CF1-14 (new adapter entry keys; VER-05):** `appendStructuredContent` and
  `roots` join `CARRIED_FIELDS`. They are user choices with no Claude field, so
  a user's value survives update and reinstall, as AFILE-06 does for the other
  user keys.
- **D-CF1-15 (profile Pi shape):** One profile Pi per scenario that asks for
  one (measured 1.6-1.7 s warm), stopped with its process group in the
  scenario's reset. No pooling unless the CI measurement in the phase gate
  requires it.
- **D-CF1-16 (CI shape; CI-01):** The `behavioral` job installs the companions
  (`scripts/install-test-peers.mjs`) and runs as a path-sharded matrix:
  lifecycle (`features/{marketplace,plugin}/**`) and components (the six
  function directories). Each shard's timeout is at least 1.5 times its
  measured run and never below 15 minutes. Companion scenarios are not
  serialized unless the measurement shows interference.
- **D-CF1-17 (harness mechanics):** The hook recorder and the MCP stub are
  `.ts` files under `features/lib/` (never `features/support/`, which cucumber
  imports into every worker). The scripted model reads its script from a file
  in the scenario sandbox and derives its step index from its own call log,
  so a child agent's Pi reads the same script, and the script, counter, and
  log reset with the sandbox. There is no fallback reply: a turn past the
  script fails, and steps left unused fail the scenario.

### Claude's Discretion

- Module names and layer placement of the cores (pure logic in `domain/` or
  `shared/`, the spawn in `platform/`), the plan split, and wave placement,
  within the file-ownership rules below.
- Warning wording for D-CF1-05 and D-CF1-06, in the style of the existing
  staging warnings.
- The `${CLAUDE_EFFORT}` value for each Pi thinking level, once research pins
  upstream's values; a level with no counterpart is recorded under D-CF1-01.

### Deferred Ideas (OUT OF SCOPE)

- A Pi-side switch equivalent to `disableSkillShellExecution` for D-CF1-02.
- Refusing a typed `/skill:name` for a `user-invocable: false` skill in the
  invocation handler: cheap once D-CF1-01 is wired, but the user chose to keep
  today's behavior on 2026-10-31 (D-CF1-09).
- Arguments and injection for model-invoked skills (D-CF1-03): needs a Pi
  hook on the model's skill path; report it to Pi with the user-invocable gap.
- Gating `!` commands with `allowed-tools`, if Pi gains a permission system.
- Pooling profile Pis per worker, only if CI time requires it (D-CF1-15).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| VER-01 | Pi peer `>=1.4.0`, dev `^1.4.0`, pi-tui dev `^1.4.0`, pi-ai dev exactly `1.4.0`; lock matches; check passes | Standard Stack; Q10 pin table; Pitfall "fallow and features/lib"; peer-floor test rows |
| VER-02 | Optional peers `pi-mcp-adapter >=7.0.0 <8`, `pi-subagents >=0.84.0`, new `@quintinshaw/pi-dynamic-workflows >=3.15.0 <4`; none a dep/devDep/lock package | Standard Stack; Package Legitimacy Audit; peer-floor test changes |
| VER-03 | install-test-peers installs all three floors; floor tests prove them | Q10 (install-test-peers `peerNames`, `--before` 2026-10-29T05:33:28.731Z, e2e pi-peer-floor fixture) |
| VER-04 | Literal MCP values stay literal under 7.x incl. `${NAME:-default}`; conformance re-proved | Q5 (TRIGGER widening, needle, alphabet, delegation hazards) |
| VER-05 | `:-` and new-key decisions recorded with an ID | Q5 (D-CF1-13 precondition result), D-CF1-14 `CARRIED_FIELDS` |
| VER-06 | README, README.es, compat docs, AGENTS.md, STACK.md name new versions | Q10 doc rows |
| HAR-01 | Profile Pi via `Given`; shared Pi unchanged | Pattern "Profile Pi"; Q8; companions resolver |
| HAR-02 | Scripted model plays a per-scenario script, records calls, refuses overflow, fails on unused steps | Pattern "Scripted model"; faux API facts |
| HAR-03 | Model-turn `When` waits for `agent_settled` and keeps every record | Pattern "Always-on record log"; Pi 1.4.0 RPC facts |
| HAR-04 | Registry probe, hook recorder, MCP stub | Patterns; Q7 assertion rule |
| HAR-05 | Hermetic profile Pis, clean-baseline reset | Pitfalls 5/6 refresh; TMPDIR; process-group facts |
| HAR-06 | Trusted default + untrusted scenario | Q6 (trust store file, the trust-requiring-resource trap) |
| HAR-07 | Six function directories, one fixture writer and step module per kind, seeds | Recommended Project Structure; unused-step gate |
| HAR-08 | Cucumber skill rules describe profile Pi, scripted model, stand-ins, ownership | Plan 01-02 scope |
| DEC-01 | Pre-fan-out decisions recorded with IDs | PROJECT.md Key Decisions table at line 1389; Q1-Q4 refinements |
| DEC-02 | 2026-10-31 decisions carry IDs; PROJECT.md bullet fixed | PROJECT.md line 1336 bullet |
| CI-01 | CI behavioral job installs companions, path shards, measured timeouts | Q9 |
</phase_requirements>

## Summary

Phase 1 does four kinds of work, and research found one load-bearing surprise in each.

**Version raise.** Pi 1.4.0 is a drop-in for the extension (extension API types are byte-identical to 1.3.0, checked by `diff` this session). pi-mcp-adapter 7.0.0 expands `${NAME:-default}` itself, so `bridges/mcp/adapter-escape.ts` must widen its `TRIGGER`. The surprise is in D-CF1-13: adapter 7.0 and Claude agree for set, empty, and unset values, but the adapter runs two more passes (`$env:NAME`, `{env:NAME}`) over the **inserted default text**, which Claude never re-reads. A default such as `${A:-$env:HOME}` therefore leaks under pure delegation, and the split-token escape cannot go inside a default (the token contains `}`). Delegation is safe only for defaults that carry no `$env:` or `{env:` text; the rest must keep today's install-time resolution.

**Harness.** The spike's patterns hold, with three corrections. (1) Pi trusts any project that has no "trust-requiring" resource (`.pi/settings.json`, `.pi/mcp.json`, `.pi/extensions`, `skills`, `prompts`, `themes`, `SYSTEM.md`, `APPEND_SYSTEM.md`, or `.agents/skills`), whatever `trust.json` says. This extension's project-scope writes (`mcp-adapter.json`, `agents/`, `pi-claude-marketplace/`) are not in that list. So an "untrusted project" scenario must also write a trust-requiring resource, or Pi still trusts it. (2) A pi-subagents background child does not load extensions passed to the parent with `--extension`. The scripted model reaches a background child only through `registerRequiredChildExtensions` (`pi-subagents/required-child-extensions`), the agent's `extensions`, or `subagents.defaultSubagentOnlyExtensions`. (3) Any Pi-loaded extension under `features/lib/` has a default export that fallow reports as unused, so it needs the same `fallow-ignore-next-line unused-export` marker `index.ts` uses (measured in a scratch copy).

**Shared cores.** The binary gives the full grammar of the ports. `T2e`'s tokenizer is tree-sitter-bash (`S_().parse`), reduced to the first simple command. It drops `$VAR` words, stops at the first `;`/`&&`/`|`/redirect/comment/command substitution, and skips leading `NAME=value` words. The plugin value transform runs `FZt` over **argument values** too, so a typed `${CLAUDE_PLUGIN_ROOT}` expands. It also applies `xM`, which inserts a backslash before a word-initial `!` in every argument. `${CLAUDE_EFFORT}` is one of `low|medium|high|xhigh|max`, default `high`. Typing `/cmd` with no arguments passes `""` (not `undefined`) to `T2e`. On Linux and macOS, `shell: powershell` still runs Bash unless `CLAUDE_CODE_USE_POWERSHELL_TOOL` is set. The surprise for planning is that fallow fails `npm run check` on any core file the entry graph cannot reach, so cores built now and wired in Phases 2-3 need `.fallowrc.json` `dynamicallyLoaded` plus `ignoreExports` entries. Measured: both together pass, and they are not flagged as stale after wiring.

**CI.** No measurement exists for the new scenarios yet. In Phase 1 the components shard has about 7 scenarios, so both shards sit at the 15-minute floor. 01-09 records the baseline, and the parent re-measures after each component merge.

**Primary recommendation:** Run the roadmap's nine plans plus two more. Add an invocation-core plan in wave 1. Put the component-directory plan in wave 3, because its scenario needs 01-03's generic file step and because `docs/workflows-compatibility.md` belongs to 01-01 in wave 1. Implement D-CF1-13 as the hybrid: delegate `:-` only when the default is marker-free, and keep install-time resolution otherwise. Record that under D-CF1-13.

## Project Constraints (from AGENTS.md)

There is no CLAUDE.md; AGENTS.md is the project instruction file. Directives the planner must honor:

- Read a file before editing it; trace callers before modifying a function.
- Never commit to `main`; never rebase or rewrite history; commit per `.agents/skills/committing/SKILL.md`; never `--no-verify`.
- Every plan SUMMARY.md has `## Threat Flags` (even "None").
- WINDOWS.md entries via `gsd-tools windows append --description "[component-features] ..."`.
- Build verification per `.agents/skills/local-verification/SKILL.md`: the commit hook runs `npm run check:commit`; GSD gates run `npm run check` on the combined tree (post-merge wave gate, phase gate, merge gate, handoff).
- **Behavioral tests:** a user-visible `/claude:plugin` change ships with a cucumber scenario that fails without it (applies to D-CF1-06's warning and its directory rule).
- **Upstream parity:** Claude Code is the default; a divergence needs a recorded decision ID or a Pi capability gap.
- **NFR-1** atomic disk writes; **NFR-5** network policy (the new `!` spawn is not a network seam; it runs plugin commands); **NFR-10** containment; **NFR-6** `npm run check` green with 100% direct coverage per source-test pair; **IL-2** output only through `shared/notification-dispatch.ts` (an injection failure must go through notify, never stdout).
- TypeScript strict, `exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`; explicit return types on exports; typed `Error` subclasses with `this.name`, narrowed by `instanceof`.
- Two complexity gates (ESLint `sonarjs/cognitive-complexity: 15` and fallow `maxCognitive: 15`/`maxCyclomatic: 20`): the tokenizer and `T2e` port must be split into small functions.
- Comments cite durable IDs (`D-CF1-01`), never "Phase 1"/"Plan 03".
- Versioning: offer a version bump before the PR; record changes in `CHANGELOG.md`.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Argument substitution (`T2e` port), tokenizer, `xM` neutralizer, effort mapping | `domain/` (pure) | -- | Pure string logic; consumed by `edge/` handlers (Phase 2/3); domain depends on `shared/` only |
| `!` pattern parser, output formatter, failure messages | `domain/` (pure) | -- | Same; no I/O |
| `!` process spawn (bash/powershell) | `platform/` (new module, chokepoint exemption) | -- | The only layer allowed `node:child_process`, besides the four existing sites |
| Description fallback (`A2e`), dropped-field table | `domain/` | `bridges/skills`, `bridges/commands` wire it (Phases 2/3) | Both bridges need byte-identical results |
| Component-directory rule (replace vs. union) and folder-shadowed warning | `domain/component-paths.ts` | `orchestrators/plugin/info.ts` (lenient mirror), install notification (discovery warning) | Resolver owns component paths; info re-derives for the unavailable arm |
| Command invocation input handler (pass-through seed) | `edge/command-invocation.ts` | `index.ts` registration | Edge parses user input; index wires |
| Pi type widening (thinking level, input source) | `platform/pi-api.ts` | -- | NFR-11 Pi import chokepoint; frozen after Phase 1 |
| MCP literal escape for adapter 7.x | `bridges/mcp/adapter-escape.ts` | `domain/claude-mcp-variables.ts` (segment model if delegating `:-`) | Existing ownership |
| Profile Pi, scripted model, probe, recorder, stub | `features/support/world.ts`, `features/lib/**` | `test/e2e/_rpc.ts` | Cucumber harness; Pi-loaded code under `lib/` only |

## Standard Stack

### Core

| Package | Version (publish UTC) | Purpose | Why |
|---------|----------------------|---------|-----|
| `@earendil-works/pi-coding-agent` | 1.4.0 (2026-10-21T22:48Z); dev `^1.4.0`, peer `>=1.4.0` | Host Pi | Latest; extension types identical to 1.3.0 [VERIFIED: `diff` of `dist/core/extensions/types.d.ts` 1.3.0 vs 1.4.0 tarball, this session] |
| `@earendil-works/pi-tui` | 1.4.0; dev `^1.4.0` (peer stays `*`) | TUI primitives | Pi pins it exactly [VERIFIED: npm registry `npm view`] |
| `@earendil-works/pi-ai` | 1.4.0, **exact** devDependency (new) | `fauxProvider`, `fauxAssistantMessage`, `fauxToolCall`, `fauxText` from `@earendil-works/pi-ai/providers/faux` | Provider "faux", model "faux-1", no streaming delay by default (`tokensPerSecond` undefined) [VERIFIED: pi-ai 1.4.0 `dist/providers/faux.js` lines 4-7, 224-229] |
| `@cucumber/cucumber` | 13.3.0 (already installed) | Runner | Latest [VERIFIED: npm registry] |

### Optional peers (never `dependencies`, `devDependencies`, or lockfile packages; PIFL-02/03)

| Peer | Now | Declare | Manifest entry (`pi.extensions`) |
|------|-----|---------|----------------------------------|
| `pi-mcp-adapter` | `>=5.2.0 <6` | `>=7.0.0 <8` | `./index.ts` [VERIFIED: 7.0.0 tarball `package.json`] |
| `pi-subagents` | `>=0.74.0` | `>=0.84.0` | `./bundle/index.js` [VERIFIED: 0.84.0 tarball] |
| `@quintinshaw/pi-dynamic-workflows` | (none) | `>=3.15.0 <4`, `peerDependenciesMeta.optional: true` | `extensions/workflow.ts` [VERIFIED: 3.15.0 tarball] |

Latest versions on npm were re-checked on 2026-10-31: none newer than the above [VERIFIED: npm registry `npm view <pkg> time`].

Current values, quoted verbatim from `package.json:60-74` [VERIFIED: Read package.json:60-74]:

```json
"peerDependencies": {
  "@earendil-works/pi-coding-agent": ">=1.0.0",
  "@earendil-works/pi-tui": "*",
  "pi-mcp-adapter": ">=5.2.0 <6",
  "pi-subagents": ">=0.74.0",
  "typebox": "*"
},
"peerDependenciesMeta": {
  "pi-mcp-adapter": { "optional": true },
  "pi-subagents": { "optional": true }
},
```

devDependencies today: `"@earendil-works/pi-coding-agent": "^1.0.0"`, `"@earendil-works/pi-tui": "^1.0.0"` [VERIFIED: Read package.json:19-20].

**Installation:**

```bash
npm install -D @earendil-works/pi-coding-agent@^1.4.0 @earendil-works/pi-tui@^1.4.0
npm install -D --save-exact @earendil-works/pi-ai@1.4.0
# hand-edit peerDependencies / peerDependenciesMeta, then `npm install` to sync the lock root
node scripts/install-test-peers.mjs
```

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Hand-written tokenizer port (D-CF1-01) | `web-tree-sitter` + `tree-sitter-bash` WASM in production | Exact grammar parity, including reserved words. Adds a runtime dependency (~1.5 MB WASM) and a package-legitimacy gate. CONTEXT anticipates a port with a licensed residual, so not recommended |
| Pure delegation of `:-` to the adapter | Hybrid (delegate only marker-free defaults) | Pure delegation leaks `$env:`/`{env:}` text inside defaults (Q5). The hybrid is recommended |
| `.fallowrc.json` `dynamicallyLoaded` + `ignoreExports` for unwired cores | Wire the cores into `edge/command-invocation.ts`'s production deps now | The config route is measured and silent after wiring. The deps route gives artificial use. Both work |

## Package Legitimacy Audit

Ran `gsd-tools query package-legitimacy check --ecosystem npm` and `npm view <pkg> scripts.postinstall` this session.

| Package | Registry | Age (at check) | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|----------------|-----------|-------------|---------|-------------|
| `@earendil-works/pi-coding-agent@1.4.0` | npm | 10 days | unknown | github.com/earendil-works/pi | SUS (too-new, unknown-downloads) | Flagged; same repo and lineage as the installed 1.3.0; no postinstall |
| `@earendil-works/pi-ai@1.4.0` | npm | 10 days | unknown | github.com/earendil-works/pi | SUS (too-new) | Flagged; Pi's own pinned dependency; no postinstall |
| `@earendil-works/pi-tui@1.4.0` | npm | 10 days | unknown | github.com/earendil-works/pi | SUS (too-new) | Flagged; no postinstall |
| `pi-mcp-adapter@7.0.0` | npm | 6 days | unknown | github.com/nicobailon/pi-mcp-adapter | SUS (too-new) | Flagged; never installed into the lock (test cache only); no postinstall |
| `pi-subagents@0.84.0` | npm | 3 days | unknown | github.com/nicobailon/pi-subagents | SUS (too-new) | Flagged; test cache only; no postinstall |
| `@quintinshaw/pi-dynamic-workflows@3.15.0` | npm | 4 days | unknown | github.com/QuintinShaw/pi-dynamic-workflows | SUS (too-new) | Flagged; test cache only; no postinstall |

**Packages removed due to [SLOP] verdict:** none.
**Packages flagged as suspicious [SUS]:** all six, only because they are new releases. Each continues a package line this repository already pins and declares the same source repository. Per protocol, the planner adds a `checkpoint:human-verify` before the install in 01-01. See Dubious Choices: the run is autonomous, so the checkpoint can be satisfied by recording this evidence.

## Research Question Answers

### Q1. Upstream argument tokenizer (`c$o` -> `Ck` -> `S_().parse`)

Binary code (Claude Code 2.1.316, `/opt/claude-code/bin/claude`, read 2026-10-31) [VERIFIED: binary grep]:

```js
function c$o(e){if(!e||!e.trim())return[];let n=Ck(e);return n.length>0?n:e.split(/\s+/).filter(Boolean)}
function Ck(e){if(!e||e.length>YC)return[];let t=S_().parse(e);if(!t)return[];let r=Twe(t,null);if(!r)return[];return Vst(r)}   // YC=1e4
function Twe(e,t){... if(ve.has(r))return e; if(r==="variable_assignment"&&t)return t.children.find(o=>ve.has(o.type)&&o.startIndex>e.startIndex)??null;
  if(r==="pipeline"){for(let o of s){let n=Twe(o,e);if(n)return n}return null}
  if(r==="redirected_statement")return s.find(o=>ve.has(o.type))??null; for(let o of s){...}return null}
function Vst(e){if(e.type==="declaration_command"){let s=e.children[0];return s&&nn.has(s.text)?[s.text]:[]}
  let t=[],r=!1;for(let s of e.children){if(s.type==="variable_assignment")continue;
  if(s.type==="command_name"||!r&&s.type==="word"){r=!0;let o=s.children[0]??s;
    if(o.type==="concatenation")t.push(o.children.some(n=>Ne.has(n.type))?o.text:o.children.map(pe).join(""));else t.push(pe(o));continue}
  if(rn.has(s.type))t.push(pe(s));else if(s.type==="concatenation"){if(s.children.some(o=>Ne.has(o.type)))break;t.push(s.children.map(pe).join(""))}
  else if(Ne.has(s.type))break}return t}
function pe(e){if(e.type==="word")return e.text.replace(/\\(.)/g,"$1");return an(e.text)}
function an(e){return e.length>=2&&(e[0]==='"'&&e.at(-1)==='"'||e[0]==="'"&&e.at(-1)==="'")?e.slice(1,-1):e}
// rn = word,string,raw_string,number   Ne = command_substitution,process_substitution
// ve = command,declaration_command     nn = export,declare,typeset,readonly,local,unset,unsetenv
```

The parser is tree-sitter (the binary carries a "tree-sitter mis-parse" diagnostic, and the node type names are tree-sitter-bash's). The bundled grammar version is not stated in the binary.

**Grammar the port must reproduce (D-CF1-01 requires quoting and backslash escapes; the rest is best effort under the licensed residual):**

1. Empty or whitespace-only text gives `[]`. Text longer than 10,000 characters takes the whitespace-split fallback.
2. Only the **first simple command** counts. An unquoted `;`, `&`, `&&`, `|`, `||`, `|&`, or newline ends it. A redirection (`>`, `>>`, `<`, `2>`, `&>`, `<<<`, ...) ends the token list, and later words are dropped.
3. A leading `NAME=value` word is skipped. If only assignments remain, `Ck` finds no command and the whitespace-split fallback runs.
4. Unquoted word: `\x` becomes `x`, and glob characters stay literal. Single-quoted: the content verbatim. Double-quoted: only the outer quotes are removed, and the content is **not** unescaped (`"a \"b\""` gives `a \"b\"`). Adjacent pieces concatenate, each piece processed by its own rule.
5. A non-first word that is a bare parameter expansion (`$X`, `${X}`) or an ANSI-C/translated string (`$'..'`, `$".."`) is **dropped**. Inside a concatenation (`pre$X`) it is kept verbatim.
6. A non-first command or process substitution (`$(..)`, backticks, `<(..)`), alone or inside a concatenation, **stops** the list. As the first word it is kept raw.
7. `#` starting a non-first word begins a comment, and the rest is dropped. Input that is only a comment takes the fallback.
8. Index base: `G=(i)=>(L??=c$o(n))[i]`, 0-based; `$0` is the first token.

**Golden vectors.** I re-ran `Twe`/`Vst`/`pe`/`an` over `tree-sitter-bash@0.25.1` with `web-tree-sitter@0.25` in the scratchpad (`scripts/ck.mjs`). These form the test table the port should match. [VERIFIED as tree-sitter-bash 0.25.1 behavior; ASSUMED that Claude bundles an equivalent grammar.]

| Arguments typed | Upstream tokens |
|----|----|
| `Ada Lovelace` | `["Ada","Lovelace"]` |
| `"Ada Lovelace" engineer` | `["Ada Lovelace","engineer"]` |
| `'a b' c` | `["a b","c"]` |
| `a\ b c` | `["a b","c"]` |
| `"a \"b\"" c` | `["a \\\"b\\\"","c"]` (backslashes kept) |
| `a"b c"d` | `["ab cd"]` |
| `fix the bug; then deploy` | `["fix","the","bug"]` |
| `one && two` / `one \| two` / `a & b` / `one;two` | `["one"]` / `["one"]` / `["a"]` / `["one"]` |
| `a > out.txt b` | `["a"]` |
| `hello $USER world` | `["hello","world"]` |
| `$HOME is home` | `["$HOME","is","home"]` |
| `x $(date) y` / ``x `date` y`` / `foo <(bar) baz` | `["x"]` / `["x"]` / `["foo"]` |
| `KEY=v other` | `["other"]` |
| `a=1 b=2` | `["a=1","b=2"]` (fallback) |
| `foo key=value` | `["foo","key=value"]` |
| `--flag=1 -v` | `["-v"]` (tree-sitter error recovery reads `--flag=1` as an assignment) |
| `# comment` | `["#","comment"]` (fallback) |
| `foo # comment` | `["foo"]` |
| `*.ts src/**` / `~/x ~` / `42 7` | kept literally |
| `pre$X post` / `a ${X} b` | `["pre$X","post"]` / `["a","b"]` |
| `$'a\nb' c` | `["$'a\\nb'","c"]` |
| `\$1 x` / `foo\\bar` | `["$1","x"]` / `["foo\\bar"]` |
| `a` newline `b` | `["a"]` |
| `if it works` / `for x in y` / `{ a b }` / `(a b)` / `[ a ]` / `!` / `export FOO=1` | `["it","works"]` / `["for","x","in","y"]` / `["a","b","}"]` / `["a","b"]` / `["[","a","]"]` / `["!"]` / `["export"]` |

The last row is compound-statement parsing. It is the natural residual to record under D-CF1-01 if the port does not reproduce it.

### Q2. `valueTransform` and `bodyTransform` that plugin commands and skills pass to `T2e`

Plugin loader `getPromptForCommand` (handles plugin commands and plugin skills, `w.isSkillMode`) [VERIFIED: binary grep at the `T2e(rr,yo,!0,ze,...)` call site]:

```js
let rr = w.isSkillMode ? `Base directory for this skill: ${zR(n.filePath)}\n\n${q}` : q, ...
let Fr = OH(BIe(Zt) ?? Ho.options.mainLoopModel, Mh(Ho), pn ?? w_(Ho.permissionLayers)),   // effort: frontmatter effort ?? session effort
    cs = {pluginPath: h, sourceName: r, pluginDataDir: L, userConfig: s.userConfig, options: Hr, skillDir: w.isSkillMode ? ke : void 0, effortLevel: Fr};
if (rr = T2e(rr, yo, !0, ze, (_r) => xM(FZt(_r, cs)), (_r, Cr) => FZt(_r, cs, Cr)), Ahe()) rr = Y0(rr);
else rr = await HRe(rr, {...Ho, getAppState: ...}, `/${e}`, Xn /*shell*/, r /*plugin*/);
```

- **`FZt(text, cs, wrap = identity)`**: `spe` replaces `${CLAUDE_PLUGIN_ROOT}`, then `${CLAUDE_PROJECT_DIR}`, then `${CLAUDE_PLUGIN_DATA}`. It then replaces `${CLAUDE_SKILL_DIR}` (skills only), `${CLAUDE_SESSION_ID}` (the session id), `${CLAUDE_EFFORT}` (`effortLevel`), and `${user_config.X}`. A sensitive option becomes `[sensitive option 'X' not available in skill content]`, and other values pass through `xM` and the wrapper. Every substituted value passes through `wrap`.
- **Body transform** = `FZt(body, cs, m1t)`. Each inserted value is wrapped, so the later `$` passes never read it. `m1t(v) = "￾" + v.replaceAll("￿","�").replaceAll("￾","�").replaceAll("$","￿") + "￾"`, and at the end `T2e` returns `e.replaceAll("￿","$").replaceAll("￾","")`.
- **Value transform** = `xM(FZt(value, cs))`, applied to every argument value and to the raw `$ARGUMENTS`. **A `${CLAUDE_PLUGIN_ROOT}` or `${CLAUDE_SESSION_ID}` the user types inside the arguments is expanded.**
- **`xM(v)`** = `v.replace(/`!/g,"` !").replace(/!`/g,"! `").replace(/(^|\s)!/gm,"$1\\!")`. Argument values cannot create `!` patterns. As a visible side effect, every `!` at the start of a word in an argument gains a backslash.
- **With no args (`undefined`/`null`)**, `T2e` returns `bodyTransform(body, identity)`. Variables are still substituted, but the U+FFFF/U+FFFE cleanup and the `$` passes are skipped.
- **With args**, U+FFFF and U+FFFE in the body first become U+FFFD.
- Size: `S` starts at the body length and adds `max(raw.length, transformed.length)` per substitution. Over `UUr=4000000` it throws: `This skill, command or hook and the arguments filled into it add up to more than 4,000,000 characters. Use shorter arguments or fewer placeholders such as $ARGUMENTS.`
- `${N:-x}`, `$@`, and `${@:N}` match no `T2e` regex, so they stay literal [VERIFIED].

`T2e` passes in order: `\$` before (digit | `ARGUMENTS` | declared name) becomes the U+FFFF placeholder. The `(?<!\\)` lookbehind means `\\$1` is **not** escaped and `$1` still substitutes. Next, named `$name(?![\[\w])` (names longest first). Then `$ARGUMENTS[N]`: a missing index becomes placeholder + `ARGUMENTS[N]`, so it stays literal and is protected from the next pass. Then `$N` matching `/\$(\d+)(?!\w)/`: a missing index stays literal. Then `$ARGUMENTS`, raw. Last, if nothing was substituted and `append` and args are non-empty, `\n\nARGUMENTS: ${w(n)}` is appended [VERIFIED: binary].

`Rhe(arguments)`: an array is filtered, a string is whitespace-split, and empty or all-digit entries are dropped. Then up to 64 names of at most 64 characters each are kept, sorted longest first [VERIFIED].

What Pi's port must take as input: Pi substitutes `${CLAUDE_PLUGIN_ROOT}`/`DATA`/`SKILL_DIR` (and `PROJECT_DIR` at project scope, SUB-02) **at install**. At invocation the body transform needs only `${CLAUDE_SESSION_ID}` and `${CLAUDE_EFFORT}`. The **value** transform needs the whole variable map (root, data, project dir, skill dir, session id, effort), because values are typed at invocation. Recommended core API: a `variables` map applied to the body (wrapped) and to values (unwrapped, then `xM`).

### Q3. `${CLAUDE_EFFORT}` values and Pi thinking levels

`OH(model, ..., effort) = ZYe(...) ?? "high"`. The effort describer `Ge` enumerates `low | medium | high | xhigh | max` [VERIFIED: binary `function OH`, `function Ge`]. The precedence is frontmatter `effort`, then the session effort for the model, then `high`.

Pi `ThinkingLevel` is `"off" | "minimal" | "low" | "medium" | "high" | "xhigh" | "max"` [VERIFIED: pi-agent-core 1.4.0 `dist/types.d.ts:300`]. `pi.getThinkingLevel()` exists on `ExtensionAPI` [VERIFIED: pi-coding-agent 1.4.0 `types.d.ts:1300`].

Recommended mapping (Claude's discretion): `low|medium|high|xhigh|max` map to themselves. `off` and `minimal` have no counterpart and map to `low`, recorded under D-CF1-01. D-CF1-05 makes frontmatter `effort` "no effect", so the port uses the session level only. Upstream would let a command's own `effort` drive `${CLAUDE_EFFORT}`, and that divergence is also recorded. See Dubious Choices.

Note: the agents bridge's `THINKING_VALUES` lacks `"max"` [VERIFIED: Read bridges/agents/convert.ts:102-109, values `"off", "minimal", "low", "medium", "high", "xhigh"`]. That is Phase 4's concern; it is listed here so the planner can pass it on.

### Q4. `!` injection: parser, output, errors, empty args

[VERIFIED: binary `FUr`, `TGe`, `oPo`, `rPo`, `d$o`, `HRe`, `PRr`, `qTn`, `MRr`, `Ahe`, `Vv`, `jd`]

```js
var oPo=/```!\s*\n?([\s\S]*?)\n?```/g, rPo=/(?<=^|\s)!`([^`]+)`/gm;
function d$o(e){return e.trim().replaceAll(`\r\n`,`\n`)}
function TGe(e){return e.replace(/`[^`\n]+`/g,(n,r)=>{let s=e[r-1];return s==="!"||s==="`"?n:"`"+" ".repeat(n.length-2)+"`"})}   // masks inline code spans
function FUr(e){let n=e.matchAll(oPo),r=e.includes("!`")?TGe(e).matchAll(rPo):[],s=[];
  for(let h of[...n,...r]){let y=d$o(h[1]??"");if(y)s.push({raw:h[0],command:y,at:h.index})}return s}
function qTn(e,n,r=!1){let s=[];if(e.trim())s.push(e.trim());if(n.trim())if(r)s.push(`[stderr: ${n.trim()}]`);else s.push(`[stderr]\n${n.trim()}`);return s.join(r?" ":`\n`)}
```

- Order: fenced matches first, then inline matches (on the masked text). Empty commands are skipped. Each pattern's output replaces the **first** remaining occurrence of its `raw` text (`y.replace(we, () => out)`). Upstream runs all commands concurrently (`Promise.all`).
- Success replacement: the Bash tool's result content, `[stdout with leading blank lines removed and trimEnd, stderr.trim(), ...].filter(Boolean).join("\n")`. An empty result is replaced by `(Bash completed with no output)` (the generic `V()` wrapper uses the tool name) [VERIFIED: binary `mapToolResultToToolResultBlockParam` and `async function V`]. The Bash tool merges stderr into its stdout stream [MEDIUM: inferred from `Je.stdout` handling].
- Errors (each thrown as `vC`, which aborts the command):
  - `Shell command failed for pattern "<raw>": <qTn(stdout, stderr)>`. The Bash tool throws `ShellError` with `stdout:""` and `stderr` = merged output plus notes. Whether an `Exit code N` line is part of it is [ASSUMED].
  - `Shell command interrupted for pattern "<raw>": [Command interrupted]`
  - Spawn failure: `[Error]\n<message>`
  - Permission failure (not reachable in Pi, which runs as bypass under D-CF1-02): `Shell command permission check failed for pattern "<raw>": <message||"Permission denied">`
  - Invalid command: `No shell command in /<name> was run, because the <Tool> tool does not accept one of them: <reason>. ...`
  - `shell: bash` without bash (Windows only): `Skill /<name> requires bash (\`shell: bash\` in frontmatter) but Git Bash was not found. <hint>, or change the skill's frontmatter to \`shell: powershell\`.`
- **Shell selection:** `S = s==="powershell" && Vv() ? PowerShell : jd() ? Bash : PowerShell`. `Vv()` is `CLAUDE_CODE_USE_POWERSHELL_TOOL === true` on non-Windows, and `jd()` is always true there. **So on Linux and macOS `shell: powershell` still runs Bash unless that env variable is set.** On Windows, PowerShell runs when there is no Git Bash or when the flag allows it.
- `Ahe()` (Cowork, or `disableSkillShellExecution` in policy or user settings) neutralizes the patterns instead. That is deferred.
- **Empty arguments:** the slash parser `BX` returns `args: ""` for `/cmd` with nothing after it (`if(r===-1)return{name:n,args:""}`, otherwise `n.slice(r+1).trim()`) [VERIFIED]. So `T2e` gets `""`: escapes are processed, `$ARGUMENTS` becomes `""`, missing `$N` stays literal, and nothing is appended. `undefined` arrives only on paths such as a Skill-tool call without args.

### Q5. pi-mcp-adapter 7.x `${NAME:-default}` against Claude's rule

Adapter 7.0.0 [VERIFIED: Read `dist/utils.js:122-128`]:

```js
export function interpolateEnvVars(value, environment = process.env) {
    return value
        // `${NAME:-default}` uses the default only when NAME is unset, as Claude Code does.
        .replace(/\$\{(\w+)(?::-([^}]*))?\}/g, (_, name, fallback) => environment[name] ?? fallback ?? "")
        .replace(/\$env:(\w+)/g, (_, name) => environment[name] ?? "")
        .replace(/\{env:(\w+)\}/g, (_, name) => environment[name] ?? "");
}
```

Claude's grammar in the repo [VERIFIED: Read `domain/claude-mcp-variables.ts:78`]: `const CLAUDE_VARIABLE = /\$\{([A-Za-z_][A-Za-z0-9_]*(?::-[^}]*)?)\}/g;`. In Claude 2.1.316's expander, a set value (empty included) is used, an unset value takes the default, and an unset value without a default keeps the literal `${NAME}` and is reported missing [VERIFIED: binary MCP expander `S.push(Ie),we`].

| Case | Claude (connect time) | Adapter 7.0 | Same? |
|---|---|---|---|
| set, non-empty | value | value | yes |
| set, empty | `""` | `""` (`??` keeps `""`) | yes |
| unset, with default | default | default | yes |
| unset, no default | literal `${NAME}` | `""` | no, but this is **existing** behavior: today's bridge already writes a reference that the adapter expands to `""` |
| name starting with a digit (`${1A:-x}`) | literal (grammar) | expanded (`\w+`) | no; the bridge must escape it as literal text, which the widened `TRIGGER` does |
| default containing `$env:X` or `{env:X}` (`${A:-$env:HOME}`) | literal default text | the default is inserted by pass 1, then **expanded by pass 2 or 3** | **no: a leak under pure delegation** |
| default + following literal completing a marker (`${A:-{env:X}` + `}`) | literal `{env:X}` | pass 3 expands it | no, unless the existing `MARKER_COMPLETION` guard puts the split token before the following `}` (it does when the segment counts as "after a reference") |

**D-CF1-13 precondition result:** the three named cases (unset, empty, set) match. Defaults with adapter marker text do not, and the split token (`{env:PI_CLAUDE_MARKETPLACE_EMPTY}`) cannot be placed inside a default because it contains `}`. **Recommendation:** delegate `${NAME:-default}` (write it as a reference with a default) only when the default contains neither `$env:` nor `{env:`, and the name is not deny-listed. Otherwise keep today's install-time resolution. Record the residual under D-CF1-13. The alternative strict reading, never delegating, is the conservative fallback the decision names.

**Required edits:**

- `bridges/mcp/adapter-escape.ts:21`, today `const TRIGGER = /\$env:|\{env:|\$(?=\{\w+\})/g;` [VERIFIED: Read adapter-escape.ts:21], becomes `/\$env:|\{env:|\$(?=\{\w+(?:\}|:-))/g`. Re-derive `PARTIAL_TRIGGER_TAIL = /[${](?:e(?:nv?)?)?$/` and `MARKER_COMPLETION = /^(?:[\w}]|:\w)/` [VERIFIED: Read lines 25, 31] against the `:-` pass.
- If delegating: add a reference-with-default segment (for example `{ kind: "ref"; name; fallback? }`) in `domain/claude-mcp-variables.ts`, serialized as `${NAME:-<default>}` with the existing guards before and after it.
- Conformance test (`test/integration/adapter-expansion-conformance.test.ts`):
  - Needle `INTERPOLATION_PASSES[0]`, today ``String.raw`.replace(/\$\{(\w+)\}/g,` `` [VERIFIED: Read lines 584-588], becomes ``String.raw`.replace(/\$\{(\w+)(?::-([^}]*))?\}/g,` ``.
  - The other drift needles still match 7.0: all four `SERVER_MANAGER_CALL_SITES`, both `OAUTH_INTERPOLATIONS`, and `if (value.startsWith("!!"))` [VERIFIED: grep -c on 7.0 `dist/server-manager.js`, `dist/mcp-auth-flow.js`, `dist/utils.js:150,203`].
  - The current alphabets cannot form a **literal** `${NAME:-x}`. Claude expands `${A:-}` and `${A:-{env}` at install, and alphabet 1 needs six tokens for `${K:-}`. So the property passes on 7.0 while the real leak (literal oauth or env values, nested `${B:-${A:-x}}`) is untested. Add an alphabet that forms literal `:-` text through nesting, for example tokens `"${B:-"`, `"${A:-"`, `"x"`, `"}"`, `"$"`, `"{"`, `":-"`, `"K"`, `"${R}"`, `"{env"`, `"$env:"`. Also run the alphabets through `serializeLiteral` (literal fields), not only `expandClaudeValue`.
  - If delegating, add an "unset at connect" runtime variant (`RUNTIME_VARIANTS` today `["", "x"]` [VERIFIED: Read line 224]) and model Claude's side as `runtime ?? default`.
  - Recompute `EXPECTED_CHECKED_VALUES` (today `462_790`, defined as `(11 + ... + 11^5 + 15 + ... + 15^4) values, two variants each` [VERIFIED: Read lines 226-228]) as Σ over alphabets of (Σ_{i=1..maxLength} k^i) × variants.
- `test/bridges/mcp/adapter-entry.test.ts`: add `appendStructuredContent` and `roots` after `openUi` in `SERVER_ENTRY_KEYS`, re-cite the 7.0 line numbers, move the range assertion to `>=7.0.0 <8`.
- `bridges/mcp/adapter-entry.ts` `CARRIED_FIELDS`, today [VERIFIED: Read adapter-entry.ts:45-57]: `"disabled", "approveTools", "includeTools", "excludeTools", "lifecycle", "idleTimeout", "requestTimeoutMs", "debug", "searchKeywords", "openUi", "trace"`. Add `"appendStructuredContent", "roots"` (D-CF1-14). Both exist in 7.0 `types.ts:499,501` [VERIFIED: grep].

### Q6. Pi 1.4.0 project trust; companions; profile Pi trust

[VERIFIED: Read pi-coding-agent 1.4.0 `dist/core/trust-manager.js`, `dist/core/project-trust.js`, `dist/main.js:579-622`; byte-identical to 1.3.0]

- **File:** `<agentDir>/trust.json` (`new ProjectTrustStore(agentDir)`, so `join(resolvePath(agentDir), "trust.json")`). **Shape:** a JSON object mapping `canonicalizePath(resolvePath(cwd))` (realpath) to `true | false | null`, sorted keys, written with `JSON.stringify(sorted, null, 2) + "\n"`. Lookup walks from cwd up through its parents to the nearest `true`/`false`. Writes take a `proper-lockfile` lock at `trust.json.lock`. For the harness: write `{"<realpath of sandbox cwd>": true}` to `<agentDir>/trust.json` before the profile Pi starts.
- **Resolution order:** CLI override, then "no trust-requiring project resources" (which trusts), then the extension `project_trust` event, then the trust store, then `defaultProjectTrust` (`always`/`never`/`ask`), then untrusted when there is no UI (RPC). The result is cached per cwd only when it was resolved through the store/prompt path.
- **The trap:** `hasTrustRequiringProjectResources(cwd)` is true only when `<cwd>/.pi/` holds one of `TRUST_REQUIRING_PROJECT_CONFIG_RESOURCES` [VERIFIED: Read trust-manager.js:8-17]: `"settings.json", "mcp.json", "extensions", "skills", "prompts", "themes", "SYSTEM.md", "APPEND_SYSTEM.md"`, or when `.agents/skills` exists in cwd or an ancestor. Otherwise `projectTrusted = true`. This extension's project-scope writes (`.pi/mcp-adapter.json`, `.pi/agents/`, `.pi/pi-claude-marketplace/`, `.pi/claude-plugins.json`) are **not** in that list. So:
  - The default trust entry (D-CF1-07) changes nothing unless the project has a trust-requiring resource.
  - **The untrusted `Given` must write a trust-requiring resource (recommended: `<cwd>/.pi/settings.json` holding `{}`) and no entry (or a `false` entry) before the profile Pi starts.** Otherwise Pi trusts the project.
  - To make the pair discriminating, the trusted scenario beside it should hold the same resource, so it is trusted only because of the entry.
- **Companions read Pi's decision** through `ctx.isProjectTrusted()` (settings-manager backed): pi-mcp-adapter 7.0 `project-server-trust.ts:219-330` and `index.ts:2435,2628`; pi-subagents 0.84 `src/extension/index.js:378` and `src/runs/foreground/subagent-executor.js:289` [VERIFIED: grep of the tarballs]. pi-dynamic-workflows has no trust read.
- Adapter project servers: a project server connects only if the project is trusted **and** (the server is approved **or** non-interactive with `projectServerPolicy === "allow"`). RPC is non-interactive (`ctx.hasUI && ctx.mode === "tui"` is false). `settings.projectServers` is honored only from a non-project config file and is ignored, with a warning, in a project file [VERIFIED: 7.0 `config.ts:651-661`]. Candidate user files: `<agentDir>/mcp-adapter.json`, `<agentDir>/mcp.json`, `~/.config/mcp/mcp.json`. The planner (Phase 6 seed) should prefer one this extension never writes. [ASSUMED: that `~/.config/mcp/mcp.json` under the sandbox HOME is read as a user source; verify in `config.ts` source discovery.]

### Q7. The nested `mcp` proxy double fire

Since 6.0.0, on Pi 0.99 and later, `mcp({tool,args})` runs the real tool "as a nested Pi tool call of the registered tool, so Pi's `tool_call` and `tool_result` hooks ... see the real name" [CITED: pi-mcp-adapter 7.0.0 `docs/tools.md:206,260`; CHANGELOG 6.0.0 #861]. A match-all PreToolUse hook therefore sees two events per proxy call: `mcp`, then `mcp__plugin_<p>_<s>__<tool>`.

**Harness rule:** the recorder, the turn's tool events, and the probe never filter or deduplicate. A step that states hook runs or tool events lists every record in order, both rows included. A seed avoids the question: the hook seed uses a `bash` tool call with a `Bash` matcher, and the MCP seed has no hooks. The decision about the outer `mcp` event belongs to Phase 5 (HOOK-08). Whether the nested call also emits separate RPC `tool_execution_*` records is [ASSUMED] and must be confirmed in 01-06's red run.

### Q8. Does a pi-subagents 0.84 background child load the parent's `--extension`?

**No, by source reading; not run.**

A background child runs in a detached runner. Its `DefaultResourceLoader` gets `noExtensions: !launch.ambientExtensions` and `additionalExtensionPaths: launch.extensionPaths` [VERIFIED: 0.84.0 `src/runs/shared/child-session.js:436-446`]. `extensionPaths` come from `toolPlan.extensionArgs` = runtime extensions + agent `extensions`/`subagentOnlyExtensions` + host-required extensions [VERIFIED: `child-tool-plan.js:290-317`]. "Ambient" means Pi's own discovery (agent dir `extensions/`, settings `packages`, a trusted project's `.pi/extensions`). The parent's CLI `--extension` paths live only in the parent's `main.js` `additionalExtensionPaths` and are never forwarded.

Foreground children share the parent's registered providers, which the spike observed. The docs warn that a provider relying on its own session hooks can fail [CITED: 0.84.0 `docs/agents.md:553`]. The scripted model's factory records inside the provider call, not in a session hook, so foreground works.

**Routes for AGT-04** (Phase 4 picks):

1. A harness extension loaded after pi-subagents calls `registerRequiredChildExtensions({ sessionId, extensions: [{ id: "scripted-model", path: <abs extension.ts> }] })` from `pi-subagents/required-child-extensions` (an exported subpath) on `session_start`, and disposes it on `session_shutdown` [CITED: `docs/agents.md:481-485`; VERIFIED: `package.json` exports].
2. `subagents.defaultSubagentOnlyExtensions` in the sandbox user settings [CITED: `docs/agents.md:595`].

Both also load the extension into foreground children. That is harmless only because D-CF1-17's design is file-backed and stateless across instances. Phase 1 should make the world's profile API accept extra extension paths, so Phase 4 can add its own lib extension without editing frozen files. pi-subagents' runner also inherits Pi's env (`runnerEnv = {...process.env, ...}`), so `HOME` and `TMPDIR` carry over [VERIFIED: `async-execution.js:516-525`].

### Q9. CI timing approach (D-CF1-16)

- No baseline exists for the new scenarios. Known numbers: today's full suite takes 2 min 0 s at `--parallel 4` on 4 cores. A scripted Pi starts in 0.64-0.68 s, a companion Pi in 1.6-1.7 s warm and 3.8 s cold [CITED: `.planning/research/ARCHITECTURE.md` "Scaling Considerations", measured 2026-10-31].
- **01-09 procedure:**
  1. Locally, after every Phase 1 seed lands: `node scripts/install-test-peers.mjs`, then `/usr/bin/time -v npx cucumber-js features/marketplace features/plugin` and `/usr/bin/time -v npx cucumber-js features/skill features/slash-command features/agent features/hook features/mcp-server features/workflow`, each run twice (random order). Record wall time and maximum RSS.
  2. In CI: `ci.yml` has no push trigger on non-main branches, so trigger `gh workflow run ci.yml --ref <branch>` (the workflow has `workflow_dispatch`). Then read `gh run view <id> --json jobs --jq '.jobs[] | {name, startedAt, completedAt}'`. If dispatch is not possible (auth or push not allowed), use the local numbers scaled ×2 for a 4-vCPU runner and mark them estimated.
  3. Set each shard's `timeout-minutes = max(15, ceil(1.5 × measured CI minutes))`. With about 7 component scenarios in Phase 1, both shards land at 15. Record the numbers in the plan SUMMARY and in a `ci.yml` comment, and add a SUMMARY line asking the parent to re-measure after each component merge.
- Shape: `behavioral` becomes `strategy.matrix.include` with `shard: lifecycle` and `shard: components`, the paths passed through `env:` (not `${{ }}` inside `run:`, which zizmor flags as template injection), and `fail-fast: false`. Both shards run `node scripts/install-test-peers.mjs`, or `test:cucumber` runs it as the first command. Make `test:cucumber` = `node scripts/install-test-peers.mjs && cucumber-js` so `npm run check` works locally. The `package` job's `needs: [..., behavioral, ...]` still works with a matrix.
- `check:features` dry-runs every scenario regardless of shards, so sharding cannot hide an unused step.

### Q10. Every place that pins old floors or versions, and every pin of the union

**Version pins** [VERIFIED: Read or grep this session; line numbers as found]:

| File | Line(s) | Today | Change |
|---|---|---|---|
| `package.json` | 19-20, 60-74 | dev `^1.0.0` ×2; peers `>=1.0.0`, `>=5.2.0 <6`, `>=0.74.0` | dev `^1.4.0` ×2, add `"@earendil-works/pi-ai": "1.4.0"`; peers `>=1.4.0`, `>=7.0.0 <8`, `>=0.84.0`, add engine `>=3.15.0 <4` with optional meta; `test:cucumber` installs peers first |
| `package-lock.json` | root `packages[""]` | mirrors | `npm install` |
| `scripts/install-test-peers.mjs` | 28 (`const peerNames = ["pi-mcp-adapter", "pi-subagents"];`), header 1-15 | two peers | add `"@quintinshaw/pi-dynamic-workflows"`; the cutoff becomes 2026-10-29T05:33:28.731Z automatically (newest floor) |
| `test/integration/optional-peer.ts` | header 1-5 | names two peers | text only (logic is generic) |
| `test/architecture/peer-floor.test.ts` | 34-43, 70-83, 85-96, 114-125 | `">=1.0.0"`, `">=0.74.0"`, `">=5.2.0 <6"` | new ranges; add engine PIFL cases (range, optional meta, not dep/devDep/lock package, lock root mirrors) and a pi-ai exact-devDep case |
| `test/e2e/pi-peer-floor/package.json` + lock | 6 (`"@earendil-works/pi-coding-agent": "1.0.0"`) | 1.0.0 | 1.4.0; regenerate the lock |
| `test/e2e/pi-json-output.test.ts` | 39, 41 | `"1.0.0"` | `"1.4.0"` |
| `test/integration/adapter-expansion-conformance.test.ts` | 199-234, 584-588 | 5.2.0 needle and alphabets | Q5 |
| `test/bridges/mcp/adapter-entry.test.ts` | 14, 55, 1227-1253 | 5.2.0 keys, shasum, range | 7.0 keys, shasum, `>=7.0.0 <8` |
| `test/integration/mcp-override-lifecycle.test.ts` | 334, 467, 853 | comments "5.2.0" | comments |
| `bridges/mcp/adapter-doc.ts` | 4, 19 | "5.2.0" | "7.0.0" (comment) |
| `platform/mcp-status.ts` | 40 | "5.2.0" | "7.0.0" (comment; union unchanged) |
| `platform/workflow-home.ts` | 6, 15 | "3.14.0" | "3.15.0" provenance (rule unchanged) |
| `scripts/pi.sh` | 107-120 | `pi-mcp-adapter@5.2.0`, `pi-subagents@0.74.0`, `@quintinshaw/pi-dynamic-workflows@3.14.0` | 7.0.0, 0.84.0, 3.15.0; update the comment |
| `test/live-uat/mcp-adapter-canary.mjs` | 15, 57-59, 120 (`ADAPTER_VERSION = "5.2.0"`) | 5.2.0 | 7.0.0 (operator-run, not gated) |
| `test/live-uat/workflow-storage-canary.mjs`, `test/live-uat/README.md` | 17-29; 11, 171 | 3.14.0 / 5.2.0 | update the run commands; keep the dated observed results as history |
| `README.md` / `README.es.md` | 37-40 | Pi 1.0.0, 0.74.0, 5.2.0 / 5.x, engine unversioned | Pi 1.4.0, 0.84.0, 7.0.0 / 7.x, engine 3.15.0; keep the two files in sync (readme skill) |
| `docs/mcp-compatibility.md` | 7, 11, 306, 435 | 5.2.0 | 7.0.0 (re-measure statements stay with Phase 6, FG-30) |
| `docs/workflows-compatibility.md` | 12, 192, 200, 222-238 | 3.14.0 | 3.15.0 where it names the floor; dated history stays |
| `docs/env-vars.md` | 3, 164 | 5.2.0 | 7.0.0 |
| `AGENTS.md` | 55 | `>=1.0.0` (dev `^1.0.0`) | `>=1.4.0` (dev `^1.4.0`) |
| `.planning/codebase/STACK.md` | 34-35 | `>=0.74.0`, `>=5.2.0 <6` | new ranges, engine row |
| `.planning/PROJECT.md` | 235-236 "Dependency floor" | old floors | new floors (Phase 1 owns PROJECT.md) |
| `docs/output-catalog.md` | 3056 | "pi-mcp-adapter 5.2.0 sends an empty snapshot..." | **Leave it** unless re-measured. Editing the catalog moves `EXPECTED_UTF8_BYTES` in `catalog-contract.test.ts`, and VER-06 does not require it |

**Union pins for commands, agents, workflows (D-CF1-06):**

- `domain/component-paths.ts:138-151` [VERIFIED: Read]: the conventional folder is added whenever it is a directory and not already seen. That is the union for every kind.
- `orchestrators/plugin/info.ts:1943-1964` `deriveLenientComponentPaths` seeds `skills`, `commands`, `agents`, `workflows` with the conventional folder, then appends declared paths. Change it to the per-kind rule.
- `test/orchestrators/plugin/info.test.ts:10000` "WFLW-04: the lenient component map carries the conventional workflows directory beside a declared one" pins the union for workflows. Rewrite it. Also re-check `info.test.ts:967` (D-64-05 array normalize; uses `skills`, so it stays).
- `test/domain/plugin-resolver.test.ts:2184-2400` (PR-4/D-07 block) and `:3230-3300` (COMP-01 a/b/c): every union case uses `skills`, so they stay valid. Retitle the comment block that claims D-07 for all kinds, and add replace-semantics cases for commands, agents, and workflows.
- `test/domain/component-paths.test.ts:30-63`: uses `skills` only, so it stays. Add cases for the replace rule and for the shadowed folder.
- `test/orchestrators/plugin/discover-names.test.ts:195-210` feeds `agents: ["declared-agents", "agents"]` straight to discovery (not the resolver). Unaffected.
- `docs/workflows-compatibility.md:38-39, 50` state that Pi unions and "nothing is shadowed". Rewrite them; the same file also has the 01-01 version lines, so one plan per wave.
- No feature file declares a `commands`, `agents`, or `workflows` path today [VERIFIED: grep of `features/` for `"(commands|agents|workflows)"\s*:`, no match].
- Upstream details to port [VERIFIED: binary loader near `folder-shadowed-by-manifest`]. The default folder is read only when `!manifest.commands`, so a declared `[]` (truthy) also suppresses it, while `""`/`null`/absent keep it. The warning is suppressed when a declared path resolves inside (or equals) the default folder (`lKn`). Upstream log text: `Plugin <name>: <folder>/ folder exists but is not auto-loaded because the manifest sets "commands"`. User-facing text: `Default commands/ folder is ignored because the manifest sets <fields>`, with the fix hint `Remove <fields> from .claude-plugin/plugin.json (or SKILL.md frontmatter) to auto-load the folder, or add the folder's files to the <fields> list if you want both`.

### Q11. `index.ts` registrations Phases 2-7 need

| Phase | Needs an `index.ts` change? | Why |
|---|---|---|
| 2 Skills | No | `registerSkillAliases(pi)` is already registered; its `input` handler (today interactive-only) is where Phase 2 wires D-CF1-01/02. Production deps (spawn module, session id from `ctx.sessionManager`, `pi.getThinkingLevel()`) can be bound inside `edge/skill-aliases.ts`, as its `loadAliases` default already is |
| 3 Commands | **Yes, done in Phase 1** | `registerCommandInvocation(pi)` from the new `edge/command-invocation.ts`, registered **after** `registerSkillAliases(pi)`, so the hooks bridge's UserPromptSubmit handler (registered first) sees the raw prompt, as upstream does |
| 4 Agents | No | Staging-only |
| 5 Hooks | No | `session_compact` is already subscribed inside `bridges/hooks/event-router.ts` (`pi.on("session_compact", ...)` for PostCompact) [VERIFIED: Read event-router.ts:971-975]; SessionStart `compact` goes there too. `SessionCompactEvent` and `SessionStartEvent` are already exported from `platform/pi-api.ts` [VERIFIED] |
| 6 MCP | No | Status tracker exists |
| 7 Workflows | No | -- |

`platform/pi-api.ts` additions for the cores (frozen after Phase 1): `ThinkingLevel` (derive it as `ReturnType<ExtensionAPI["getThinkingLevel"]>`, so no new peer import) and `InputSource` (`InputEvent["source"]`, which is `"interactive" | "rpc" | "extension"` [VERIFIED: 1.4.0 `types.d.ts:908`]). `test/index.test.ts` uses strict `strong-mock` expectations for every `pi.on` in order (`input` at lines 376, 410, 429, 473), so the new registration must update it.

Pi input chaining [VERIFIED: 1.4.0 `runner.js` `emitInput`]: handlers run in registration order, and each sees the previous transform's text. `{action:"handled"}` stops the prompt, which is how an injection failure prevents anything reaching the model. A thrown handler is reported as `extension_error` and the chain continues. Pi expands `/skill:` and prompt templates **after** the input handlers, on the transformed text.

## Architecture Patterns

### System Architecture Diagram

```text
 feature step (Given pi runs with the scripted model / companions)
        |
        v
 world.usePiWithProfile({companions, extraExtensions, untrusted?})
        |  writes: <agentDir>/trust.json {cwd:true} (default) | <cwd>/.pi/settings.json + no entry (untrusted)
        |  env: allowlist + TMPDIR=<per-scenario dir> (+ typed extras)
        v
 test/e2e/_rpc.ts startRpcPi(sandbox, env, extraExtensions)  ---> Pi 1.4.0 --mode rpc
                                                                  |-- real extension (index.ts)
                                                                  |     input chain: hooks(UserPromptSubmit) -> background-update -> skill-aliases -> command-invocation
                                                                  |-- features/lib/scripted-model/extension.ts  (faux provider; reads $HOME script, appends call log)
                                                                  |-- features/lib/pi-registry-probe/extension.ts (probe command -> custom entry)
                                                                  `-- [companions from peer cache pi.extensions]
        ^                                                         |
        | JSONL records (always-on log in PiProcess)              |-- spawns hook commands -> node features/lib/hook-recorder.ts -> $HOME log
        |                                                         |-- adapter spawns node features/lib/mcp-stub-server.ts -> $HOME log + pid
 When the user prompts "..."  -> prompt; read disposition; wait agent_settled(aborted:false)
        |  world.lastTurn = {entries, toolEvents, notifies, errors, modelCalls slice, hookRuns slice, mcpRequests slice}
        v
 Then <kind projection of lastTurn>  (whole-value table compare; marks turn compared)
 After: release (stop profile Pi group), assert script fully used, uncompared-turn check
```

### Recommended Project Structure

```text
extensions/pi-claude-marketplace/
  domain/argument-substitution.ts     # T2e port, Rhe (argument names), xM neutralizer, size-cap error, effort mapping
  domain/shell-words.ts               # c$o/Ck tokenizer port (first simple command)
  domain/context-injection.ts         # FUr parser (fenced + masked inline), qTn formatter, failure messages, splice
  domain/description-fallback.ts      # A2e port ("Plugin skill" / "Plugin command" labels)
  domain/invocation-frontmatter.ts    # D-CF1-05 unhonored-field table + droppedInvocationFields()
  platform/prompt-shell.ts            # spawn bash / powershell for `!` commands (5th child_process site)
  edge/command-invocation.ts          # pass-through input handler + registerCommandInvocation (Phase 3 owns afterwards)
test/domain/*.test.ts, test/platform/prompt-shell.test.ts, test/edge/command-invocation.test.ts
features/
  skill/ slash-command/ agent/ hook/ mcp-server/ workflow/      # one seed .feature each
  step_definitions/{model,companion}.steps.ts                  # new shared (frozen)
  step_definitions/<kind>/<topic>.steps.ts                      # one per kind (handed over)
  lib/scripted-model/{extension,script,calls}.ts
  lib/pi-registry-probe/{extension,snapshot}.ts
  lib/hook-recorder.ts  lib/mcp-stub-server.ts  lib/companions.ts  lib/turn-records.ts (JSONL slicing, table projection)
  lib/{skill,slash-command,agent,hook,mcp-server,workflow}-files.ts
  plugin/component-directories.feature                          # D-CF1-06 scenario (title "Plugin component directories")
```

Module names avoid catch-all words (layout rule). `features/lib/*` holds at most three path parts (`isAllowedFile`: depth ≤ 3, `.ts` only) [VERIFIED: Read check-features.mjs:238-255].

### Pattern 1: Scripted model (D-CF1-17)

**What:** register `fauxProvider()`. Queue one self-replenishing "player" factory. On each call the player:

1. calls `handle.appendResponses([player])` so the faux queue never runs dry;
2. reads `$HOME/<dir>/script.json` and counts the lines of `$HOME/<dir>/calls.jsonl` to get the index;
3. appends one whole record (every message, tool names and schemas, system prompt, index, `overflow` flag);
4. returns the step (`fauxAssistantMessage([fauxText(t)])`, or `fauxAssistantMessage([fauxToolCall(name, args)], {stopReason: "toolUse"})`), or **throws** past the script.

A thrown factory becomes an error assistant message (`stopReason: "error"`) [VERIFIED: pi-ai 1.4.0 `faux.js:389-394`]. Pi's retry runs only for `isRetryableAssistantError` [VERIFIED: agent-session.js:3040-3045], so a plain message such as `scripted model: the script has no step 4` is not retried [ASSUMED: classifier patterns not read]. Stateless across processes, so a foreground child (same provider object) and a background child (its own instance via Q8 routes) read one ordered script.

**When:** every `Given pi runs with the scripted model`. The step that arms the script (`Given the model answers each request in turn:`) writes `script.json` **after** the profile Pi starts. The `When` asserts no overflow record. An `After` check in `world.ts` fails a passed scenario whose call log is shorter than the script.

### Pattern 2: Always-on record log and the model-turn `When`

`features/lib/pi-process.ts` today drops every record outside a pending request (`if (record === undefined || pending === undefined) return;`) [VERIFIED: Read pi-process.ts `handleLine`]. Add an append-only log and keep `request()` windowing on it. The prompt `When`:

1. records the log length;
2. sends `prompt`;
3. reads `data.disposition` (`"handled"` means no run) [VERIFIED: 1.4.0 `docs/rpc.md:67`];
4. otherwise waits for `{type:"agent_settled", aborted:false}` with a named deadline;
5. builds `lastTurn`.

`idle` becomes false from `agent_start` to `agent_settled`. Pi 1.4.0 RPC forwards every session event (`output(toJsonEvent(event))`) [VERIFIED: rpc-mode.js:265-270]. No fixed sleeps.

### Pattern 3: Profile Pi (D-CF1-15)

`world.usePiWithProfile({ companions, extraExtensions?, untrusted?, environment? })` follows `usePiWith()`.

1. Write trust state.
2. Start the Pi through `startRpcPi(sandbox, git, extraExtensions, extraEnvironment)` (the `_rpc.ts` signature grows; `test/architecture/hermetic-git-environment.test.ts` pins `rpcChildEnvironment`).
3. Set the model (`set_model` provider `faux`, model `faux-1`).
4. Assert the expected tools are loaded (`subagent`, `mcp`, `workflow_control` per companion, through the probe) in the `Given`.
5. Register the stop with `onRelease`.

Companion entries are resolved from `node_modules/.cache/optional-peers/node_modules/<name>/package.json` `pi.extensions[0]`, with the version checked against the declared floor. `features/` may not import `test/integration/optional-peer.ts` (layout rule), so `lib/companions.ts` re-implements this in a few lines.

### Pattern 4: Pi-loaded extension modules under `features/lib/`

A default export is required by Pi's loader and is reported by fallow as `unused-export` [VERIFIED: scratch-copy fallow run this session]. Put `// fallow-ignore-next-line unused-export -- Pi's --extension loader reads this default.` above it, the precedent in `index.ts`. The recorder and stub are executed as `node <abs>.ts` (Node type stripping; local Node 22.23.4, CI Node 24). They export nothing, or export only a path the step side imports, which is the `state-lock-holder.ts` precedent.

### Pattern 5: Unwired cores and fallow reachability

`fallow dead-code` (production, entry `index.ts`) reports an unreachable core file as `unused-file` [VERIFIED: scratch probe]. `.fallowrc.json` `dynamicallyLoaded: [<file>]` alone turns that into `unused-export`. Adding `ignoreExports: [{ file: <file>, exports: ["*"] }]` passes, and the entries are **not** flagged as stale once the file is later imported from `edge/` [VERIFIED: scratch probe, exit 0]. Add both for every core that Phases 2-3 wire, and a SUMMARY line for the parent to remove them after Phases 2 and 3 merge. `edge/command-invocation.ts` itself is reachable (registered in `index.ts`).

### Anti-Patterns to Avoid

- **Untrusted Given without a trust-requiring resource:** Pi trusts the project anyway (Q6).
- **Faux fallback reply or `setResponses(N copies)` at load:** hides short scripts (Pitfall 3); use the self-replenishing player plus an overflow throw.
- **Hard-coding companion entry paths** (`pi-subagents/index.js`, the engine's `dist/pi-extension.js`): use `pi.extensions`.
- **`${{ matrix.* }}` inside `run:`:** zizmor template-injection finding; pass shard paths through `env:`.
- **Reading the script back in a `Then`** (tautology, Pitfall 4): read the call log, recorder, stub log, or probe.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Model stand-in | A custom provider or HTTP stub | `fauxProvider()` from `@earendil-works/pi-ai/providers/faux` | Pi's own; exact provider plumbing |
| MCP server | `@modelcontextprotocol/sdk` server | ~25-line stdio JSON-RPC stub (`initialize`, `tools/list`, `tools/call`) | Dependency-free; exits on stdin end |
| Atomic writes in product code | `fs.writeFile` | `shared/atomic-json.ts` | NFR-1, rule pack |
| Project trust in the harness | `--approve`, `defaultProjectTrust` | `<agentDir>/trust.json` entry (D-CF1-07) | Locked decision |
| Notification of an injection failure | `console`/stdout | `shared/notification-dispatch.ts` helpers | IL-2 rule pack |
| Peer resolution | Hard-coded paths | `pi.extensions` from the peer manifest | Entries changed across releases |
| Tokenizer edge cases | Ad-hoc regex split | A table-driven port tested against the Q1 golden vectors | Parity is checkable only against vectors |

## Runtime State Inventory

The version raise is a dependency migration. State that a source edit alone does not update:

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None. The extension's `state.json`/`mcp-adapter.json` formats do not change with the raise. | None |
| Live service config | None (no external services) | None |
| OS-registered state | None | None |
| Secrets/env vars | `PI_CLAUDE_MARKETPLACE_EMPTY` (the split-token env) stays; no rename | None |
| Build artifacts / installed packages | (1) `node_modules` holds Pi 1.3.0 and pi-ai 1.3.0 [VERIFIED: `require(...).version`]; (2) the peer cache `node_modules/.cache/optional-peers` holds pi-mcp-adapter 5.2.0 and pi-subagents 0.74.0 and **no engine** [VERIFIED]; (3) `test/e2e/pi-peer-floor` lock pins Pi 1.0.0 | (1) `npm install` after the manifest edit; (2) `install-test-peers.mjs` replaces the cache on a floor mismatch (`holdsFloors`), no manual step; (3) regenerate the fixture lock |

## Common Pitfalls

### Pitfall A: fallow fails on unwired cores
**What goes wrong:** `npm run check` fails with `unused-file` for every core built now and wired later.
**How to avoid:** Pattern 5 config entries in the core plan, plus a parent cleanup line.
**Warning signs:** "Files not reachable from any entry point".

### Pitfall B: Untrusted scenario passes as trusted
**What goes wrong:** pi-subagents lists the project agent, or the adapter connects the project server, in the "untrusted" scenario.
**Why:** No trust-requiring resource, so Pi trusts (Q6).
**How to avoid:** the untrusted Given writes `<cwd>/.pi/settings.json` before the profile Pi starts.

### Pitfall C: Pure `:-` delegation leaks marker text
**What goes wrong:** `${A:-{env:SECRET}}`- or `${A:-$env:HOME}`-style defaults expand under 7.0.
**How to avoid:** the hybrid rule plus property alphabets that include marker text inside defaults (Q5).

### Pitfall D: The conformance property passes but proves nothing about literals
**What goes wrong:** current alphabets never form a literal `${X:-y}`, so a missing `TRIGGER` widening still passes.
**How to avoid:** add a nesting alphabet and run the alphabets through `serializeLiteral` too.

### Pitfall E: Install-time substituted paths are re-read by `$` passes
**What goes wrong:** upstream wraps substituted variable values (`m1t`). Pi substitutes `${CLAUDE_PLUGIN_ROOT}` at install, so a path containing `$1` or `$ARGUMENTS` would be substituted again at invocation.
**How to avoid:** note it as a residual under D-CF1-01 (paths with `$` are rare), or let Phase 2/3 move root/data substitution to invocation through the `variables` map.

### Pitfall F: `xM` changes argument text
**What goes wrong:** `/cmd !important` reaches the model as `\!important`. That is upstream parity, and a scenario author may think it a bug.
**How to avoid:** a unit test with the upstream reason, and the cucumber skill rules mention it.

### Pitfall G: Background subagent runners outlive the scenario
**What goes wrong:** the async runner is detached in its own process group, so killing the profile Pi's group does not stop it.
**How to avoid:** with `TMPDIR` in the sandbox, the reset can find run status under `<TMPDIR>/pi-subagents-*` and assert that no runner pid is alive. Async runs stay out of Phase 1 seeds (foreground only).

### Pitfall H: MCP stub orphaned after a hard kill
**What goes wrong:** the adapter starts stdio servers in their own process group [VERIFIED: `_rpc.ts` `killProcessGroup` comment], so a SIGKILL of Pi's group skips the adapter's shutdown.
**How to avoid:** the stub exits on stdin `close`, writes a pid file, and the reset asserts the pid is dead (`process.kill(pid, 0)` throws `ESRCH`). `PiProcess.stop()` closes stdin first and waits up to 5 s.

### Pitfall I: Same-wave file collisions inside Phase 1
`docs/workflows-compatibility.md` (01-01 version lines vs D-CF1-06 rows), `CHANGELOG.md`, `package.json` (01-01 vs 01-09 scripts), and `.github/workflows/ci.yml` (01-03 and 01-09, different waves, fine) each need one owner per wave. `index.ts` plus `test/index.test.ts` belong to the core plan alone.

### Pitfall J: New spawn site touches four gates
`rule-packs/architecture.json` `child-process-chokepoint.exclude` [VERIFIED: Read lines 110-122, currently four files]; `test/architecture/gate-targets.ts` `SHELL_OUT_EXEMPT_TARGETS` [VERIFIED: Read lines 218-223]; `test/architecture/no-shell-out.test.ts` "exactly four files" (line 197); and optionally an `eslint.config.js` BLOCK restricting importers to the two `edge/*` invocation modules (the `package-manager.ts` precedent at eslint.config.js:31, 542). Also update the rule-pack message text ("four sanctioned spawn sites").

### Pitfall K: Faux turns and Pi's queueing
A prompt sent mid-turn is queued as a follow-up (spike). Always wait for `agent_settled` before the next prompt or a reset.

## Code Examples

### `T2e` port skeleton (behavior from the binary; names are the planner's)

```ts
// Source: Claude Code 2.1.316 T2e / m1t / c$o / Rhe (binary grep 2026-10-31)
const PLACEHOLDER = "￿"; // stands for a literal "$" until the end
const WRAP = "￾";        // brackets an inserted value
const MAX_CHARACTERS = 4_000_000;

function wrapValue(value: string): string {
  return WRAP + value.replaceAll(PLACEHOLDER, "�").replaceAll(WRAP, "�").replaceAll("$", PLACEHOLDER) + WRAP;
}
// substituteArguments({ body, args, argumentNames, variables, append = true }):
//  args === undefined -> return applyVariables(body, variables, identity)
//  body = body.replaceAll(PLACEHOLDER, "�").replaceAll(WRAP, "�"); body = applyVariables(body, variables, wrapValue)
//  escape: body.replace(new RegExp(`(?<!\\\\)\\\\\\$(?=${["\\d","ARGUMENTS",...names.map(n => `${escapeRegExp(n)}(?![\\[\\w])`)].join("|")})`, "g"), PLACEHOLDER)
//  named -> $ARGUMENTS[N] (missing: PLACEHOLDER + "ARGUMENTS[N]") -> $N (missing: unchanged) -> $ARGUMENTS
//  value(v) = wrapValue(neutralize(applyVariables(v, variables, identity))); size += max(v.length, transformed.length)
//  if (!substituted && append && args) body += `\n\nARGUMENTS: ${value(args)}`
//  return body.replaceAll(PLACEHOLDER, "$").replaceAll(WRAP, "")
```

### `xM`, `A2e`, `qTn` (verbatim behavior)

```ts
// Source: Claude Code 2.1.316 xM, A2e, qTn
export function neutralizeInjection(value: string): string {
  return value.replace(/`!/g, "` !").replace(/!`/g, "! `").replace(/(^|\s)!/gm, "$1\\!");
}
export function descriptionFallback(body: string, label: "Plugin skill" | "Plugin command"): string {
  for (const line of body.split("\n")) {
    const trimmed = line.trim();
    if (trimmed !== "") {
      const text = /^#+\s+(\S.*)$/.exec(trimmed)?.[1] ?? trimmed;
      return text.length > 100 ? `${text.substring(0, 97)}...` : text;
    }
  }
  return label;
}
export function formatShellStreams(stdout: string, stderr: string): string {
  const parts: string[] = [];
  if (stdout.trim()) parts.push(stdout.trim());
  if (stderr.trim()) parts.push(`[stderr]\n${stderr.trim()}`);
  return parts.join("\n");
}
```

### Pass-through command invocation seed

```ts
// Source: Pi 1.4.0 InputEventResult; repo pattern edge/skill-aliases.ts
export function registerCommandInvocation(pi: ExtensionAPI): void {
  pi.on("input", () => ({ action: "continue" }) as const);
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Adapter leaves `${A:-x}` literal (5.2.0) | Adapter expands `:-` (7.0.0) | 2026-10-26 | `TRIGGER` widening; conformance re-proof |
| Proxy `mcp` call is one Pi tool call | Nested Pi tool call under the real name (6.0.0+) | 2026-10-22 | Hooks see two events |
| pi-subagents background needs chord and `pi-agent-core/node` (0.74) | Optional (0.78+); needs Pi ≥ 1.2 (0.80+) | 2026-10 | AGT-04 feasible on Pi 1.4.0 |
| Skill description = first paragraph (D-86-06) | `A2e` first non-blank line, `#` stripped, 100-char cut | upstream (binary 2.1.316) | D-CF1-04 |
| Component paths union (D-07) | Replace for commands/agents/workflows, add for skills, `folder-shadowed-by-manifest` | upstream (binary 2.1.316) | D-CF1-06 |

**Deprecated/outdated:** the adapter's `mcpScript`, `settings.scriptMode`, `jev.*` (6.0/7.0); the extension writes none of them [CITED: STACK.md].

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Claude bundles a tree-sitter-bash grammar equivalent to 0.25.1, so the golden vectors match upstream | Q1 | Some vectors (error-recovery rows like `--flag=1`, keyword rows) may differ; record as residual |
| A2 | Bash-tool failure text includes the merged output (and maybe an `Exit code N` line) after `[stderr]\n` | Q4 | The failure message differs in its tail; scenario literal must be re-measured |
| A3 | Bash tool merges stderr into stdout, so success output is one stream | Q4 | Port output order differs for commands writing both streams |
| A4 | `off`/`minimal` map to `low` for `${CLAUDE_EFFORT}` | Q3 | Different value for Pi users with thinking off; recorded under D-CF1-01 |
| A5 | `~/.config/mcp/mcp.json` in the sandbox HOME is a user-scope source the adapter reads for `settings.projectServers` | Q6 | Phase 6's seed would set the policy in a file the adapter ignores |
| A6 | A custom scripted-model overflow message is not retried by Pi | Pattern 1 | Overflow turns take backoff time; set `retry.enabled: false` in sandbox settings if so |
| A7 | Nested proxy calls emit their own RPC `tool_execution_*` records | Q7 | The turn record's tool events list differs; 01-06 confirms |
| A8 | Bash tool default timeout (2 min) applies to `!` commands | D-CF1-02 spawn | Long-running `!` commands time out differently |
| A9 | A background child given the scripted model through `registerRequiredChildExtensions` resolves `faux/faux-1` | Q8 | AGT-04 needs another route or a recorded gap |

## Open Questions

1. **D-CF1-13: hybrid or strict fallback?**
   - Known: set, empty, and unset match. Marker-bearing defaults leak.
   - Unclear: whether the hybrid fits the decision's "if any case differs" clause.
   - Recommendation: the hybrid (most upstream-compatible), recorded under D-CF1-13 with the residual. Listed in Dubious Choices.
2. **`shell: powershell` on POSIX.**
   - Known: upstream runs Bash unless `CLAUDE_CODE_USE_POWERSHELL_TOOL` is set (Q4).
   - Recommendation: port the selection as upstream, honoring the same env variable name. Record under D-CF1-02.
3. **Where the folder-shadowed warning travels.**
   - Options: a new resolver field converted to a discovery warning in `install-outcome.ts`, or `notes`. Notes on the installable arm are persisted into `compatibility.notes` and shown by `info` as advisory fields [VERIFIED: install-outcome.ts:1585, info.ts:1920].
   - Recommendation: a typed resolver field and a discovery warning (D-PL1-02 channel), so `info` and install both show it. The planner checks the catalog and closed-set impact (no new `Reason` if a free-text discovery warning suffices).
4. **The Phase 1 observable for HAR-06.**
   - Recommendation: a project-scope agent listed by `subagent {action:"list"}` when trusted and absent when untrusted (01-07), with the trust Givens in `companion.steps.ts`. A fallback is the probe reporting `ctx.isProjectTrusted()`.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node | everything | ✓ | 22.23.4 local (CI 24) | -- |
| npm + registry access | raise, peer cache | ✓ | 10.9.9 | -- |
| bash | `!` spawn tests, hook recorder | ✓ | /usr/bin/bash | -- |
| pwsh | `shell: powershell` path | ✗ | -- | Inject the spawner in unit tests; no live pwsh test |
| python3 | `features/lib/pi-tui-pty.py` | ✓ | 3.13.18 | -- |
| gh CLI | CI timing (Q9) | ✓ | 2.89.0 | Local measurement ×2 |
| codegraph CLI | research aid | ✓ | -- | -- |
| Pi 1.4.0 in node_modules | harness | ✗ (1.3.0 installed) | -- | 01-01 installs |
| Workflow engine in peer cache | companion profile | ✗ | -- | 01-01 adds it to `peerNames` |
| CPU cores | timing | 4 | -- | -- |

**Missing dependencies with no fallback:** none. **With fallback:** pwsh (inject), Pi 1.4.0 and engine (installed by 01-01).

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | `node:test` (unit, integration, e2e) + `@cucumber/cucumber` 13.3.0 (behavioral) |
| Config file | `cucumber.json` (`parallel: 8`, `order: random`); `package.json` scripts |
| Quick run command | `node --test <test-path>`; `npm run test:coverage:direct -- <source-or-test>`; `npx cucumber-js features/<kind>`; `npx cucumber-js --name '<title>'` |
| Full suite command | `npm run check` (static + unpaired + integration + cucumber + direct coverage) |

### Phase Requirements -> Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| VER-01 | Pi peer `>=1.4.0`, lock root mirrors; pi-ai exact `1.4.0` dev | architecture | `node --test test/architecture/peer-floor.test.ts` | ✅ (update + new case) |
| VER-02 | Three optional peers at new ranges, optional meta, never dep/devDep/lock | architecture | same | ✅ (update + engine cases) |
| VER-03 | Peer cache holds all three floors; integration proves them; e2e floor | integration + e2e | `npm run test:integration`; once: `npm --prefix test/e2e/pi-peer-floor ci --ignore-scripts && npm run test:e2e` | ✅ (update fixture) |
| VER-04 | Literal `${X:-y}` stays literal; 7.0 property zero mismatches | integration + unit | `node --test test/integration/adapter-expansion-conformance.test.ts`; `npm run test:coverage:direct -- extensions/pi-claude-marketplace/bridges/mcp/adapter-escape.ts` | ✅ (extend) |
| VER-05 | `appendStructuredContent`/`roots` survive update; D-CF1-13/14 recorded | unit + doc | `node --test test/bridges/mcp/adapter-entry.test.ts`; `rg -n 'D-CF1-1[34]' .planning/PROJECT.md` | ✅ |
| VER-06 | Docs name new versions | manual/grep | `rg -n '5\.2\.0\|0\.74\.0\|3\.14\.0\|>=1\.0\.0' README.md README.es.md docs/*-compatibility.md docs/env-vars.md AGENTS.md .planning/codebase/STACK.md` returns only dated history | manual |
| HAR-01 | Profile Pi with scripted model/probe/companions; shared Pi unchanged | cucumber | `npx cucumber-js features/skill` + full `npm run test:cucumber` | ❌ Wave 2 (01-03) |
| HAR-02 | Script played, calls recorded whole, overflow and unused steps fail | cucumber seed + one-off red proof recorded in SUMMARY (not committed: CONVENTIONS forbids committed negative gate tests) | `npx cucumber-js --name '<seed title>'` | ❌ 01-03 |
| HAR-03 | `When` waits `agent_settled`, keeps records | cucumber | seed in `features/skill/invocation.feature` | ❌ 01-03 |
| HAR-04 | Probe, recorder, stub report | cucumber | `npx cucumber-js features/slash-command features/hook features/mcp-server` | ❌ 01-04..06 |
| HAR-05 | TMPDIR and writes inside sandbox; clean reset | architecture + cucumber | `node --test test/architecture/hermetic-git-environment.test.ts`; full suite twice (random order) | ✅ (update) / ❌ |
| HAR-06 | Trusted + untrusted pair | cucumber | `npx cucumber-js features/agent` | ❌ 01-07 |
| HAR-07 | Six dirs, seeds, gate green | static | `npm run check:features` | ❌ |
| HAR-08 | Skill rules updated | manual review + static | `npm run check:features` (layout) | ❌ 01-02 |
| DEC-01 | Cores implement E1-E4; decisions recorded | unit (100% direct) + doc | `npm run test:coverage:direct -- extensions/pi-claude-marketplace/domain/<core>.ts` per core; `npm run test:coverage:direct -- extensions/pi-claude-marketplace/platform/prompt-shell.ts`; `node --test test/architecture/no-shell-out.test.ts`; `rg -n 'D-CF1-0[1-8]' .planning/PROJECT.md` | ❌ core plan |
| DEC-01 (D-CF1-06) | Declared commands path replaces folder; warning shown | cucumber + unit | `npx cucumber-js features/plugin/component-directories.feature`; `node --test test/domain/component-paths.test.ts test/domain/plugin-resolver.test.ts test/orchestrators/plugin/info.test.ts` | ❌ component-dir plan |
| DEC-02 | IDs D-CF1-09..12 recorded; Out of Scope bullet rewritten | doc/grep | `rg -n 'D-CF1-(09\|1[0-2])' .planning/PROJECT.md`; `rg -n 'component-path arrays' .planning/PROJECT.md` | manual |
| CI-01 | Peer install + shards + measured timeouts | CI | `gh workflow run ci.yml --ref <branch>` then `gh run view <id> --json jobs`; `npm run lint:workflows` + pre-commit `zizmor`/`yamllint` | ❌ 01-09 |

### Sampling Rate

- **Per task commit:** the commit hook (`npm run check:commit`) plus the task's owner test or `npx cucumber-js features/<kind>`.
- **Per wave merge:** `npm run check` on the combined tree.
- **Phase gate:** `npm run check` green, the e2e floor test once, and the full cucumber suite twice (random order).

### Wave 0 Gaps

- [ ] `test/domain/argument-substitution.test.ts`, `shell-words.test.ts` (golden table from Q1), `context-injection.test.ts`, `description-fallback.test.ts`, `invocation-frontmatter.test.ts`
- [ ] `test/platform/prompt-shell.test.ts` (injected spawner; bash and powershell selection; timeout and interrupt; spawn error)
- [ ] `test/edge/command-invocation.test.ts`; `test/index.test.ts` expectation for the new `input` registration
- [ ] peer-floor engine cases; conformance alphabet extension
- [ ] Framework install: none (all present)

## Security Domain

`security_enforcement` is absent from `.planning/config.json`, so it is enabled.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | -- |
| V3 Session Management | no | -- |
| V4 Access Control | partial | Pi project trust (harness only); D-CF1-02 runs plugin commands with the plugin's trust (same as hooks) |
| V5 Input Validation | yes | `xM` neutralizer on argument values; typed parse of frontmatter (`parseFrontmatter` from `platform/pi-api.ts`); the size cap |
| V6 Cryptography | no | -- |
| V12 Files and Resources | yes | Containment unchanged; the spawn `cwd` is the session cwd |
| V14 Configuration | yes | MCP literal escape (VER-04); allowlist env in `_rpc.ts`; TMPDIR in the sandbox |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Arguments injected into `!` command text (`` !`echo $ARGUMENTS` ``) | Tampering / Elevation | Upstream parity: the user's own input at the user's privilege. Values cannot create new patterns (`xM`). Document it in the plan threat model |
| Plugin `!` commands run without a prompt | Elevation | Same trust as hooks (D-CF1-02 license); the commands come from the installed plugin |
| Environment secret reaching an MCP server through a literal `${X:-y}` | Information disclosure | Widened `TRIGGER`; hybrid delegation; property test |
| Harness Pi inheriting developer credentials | Information disclosure | `rpcChildEnvironment` allowlist; only typed extras |
| Test runs writing `/tmp/pi-subagents-*` shared with the developer | Information disclosure / Tampering | `TMPDIR` inside the run root |
| Orphaned stub or runner processes | DoS | Pid files and reset assertions; stub exits on stdin close |

## Sources

### Primary (HIGH confidence)

- Claude Code 2.1.316 binary `/opt/claude-code/bin/claude` (Python byte search, 2026-10-31): `T2e`, `m1t`, `c$o`, `Rhe`, `Ck`, `Twe`, `Vst`, `pe`, `an`, the `ve`/`rn`/`Ne`/`nn` sets, `xM`, `oPo`, `rPo`, `TGe`, `FUr`, `HRe`, `PRr`, `qTn`, `MRr`, `Ahe`, `Y0`, `Vv`, `jd`, `FZt`, `spe`, `bZe`, `OH`, `Ge`, `A2e`, `BX`, the plugin loader `vfe` (folder-shadowed), the Bash tool result mapping, and the MCP `${}` expander.
- npm tarballs (scratchpad `pkgs/`): pi-coding-agent 1.4.0 (`trust-manager.js`, `project-trust.js`, `main.js`, `runner.js`, `agent-session.js`, `rpc-mode.js`, `types.d.ts`); pi-ai 1.4.0 (`faux.d.ts`, `faux.js`); pi-agent-core 1.4.0 (`types.d.ts`); pi-mcp-adapter 7.0.0 (`dist/utils.js`, `project-server-trust.ts`, `config.ts`, `types.ts`, `docs/tools.md`, `CHANGELOG.md`); pi-subagents 0.84.0 (`package.json`, `docs/agents.md`, `src/runs/**`, `src/agents/agents.js`, `CHANGELOG.md`); pi-dynamic-workflows 3.15.0 (`package.json`).
- Repository files read this session: `package.json`, `scripts/install-test-peers.mjs`, `test/e2e/_rpc.ts`, `features/lib/pi-process.ts`, `features/support/{world,pi-process}.ts`, `features/step_definitions/{session,plugin/session-start-hooks}.steps.ts`, `features/lib/pi-commands.ts`, `scripts/check-features.mjs`, `eslint.config.js` (features blocks), `.fallowrc.json`, `rule-packs/architecture.json`, `test/architecture/{gate-targets,peer-floor,no-shell-out}.ts`, `test/integration/adapter-expansion-conformance.test.ts`, `bridges/mcp/{adapter-escape,adapter-entry}.ts`, `domain/{claude-mcp-variables,component-paths}.ts`, `orchestrators/plugin/info.ts`, `edge/skill-aliases.ts`, `platform/pi-api.ts`, `index.ts`, `bridges/hooks/event-router.ts`, `shared/staging-warnings.ts`, `.github/workflows/ci.yml`, `.planning/PROJECT.md`.
- Measurements this session: fallow scratch-copy probes (unused-file, `dynamicallyLoaded` + `ignoreExports`, staleness, features/lib default export); tree-sitter-bash 0.25.1 golden vectors; `package-legitimacy check`.

### Secondary (MEDIUM confidence)

- `.planning/research/{STACK,ARCHITECTURE,PITFALLS,FEATURES,SUMMARY}.md` (2026-10-31), building on them.
- Spike 028 README and prototypes.

### Tertiary (LOW confidence)

- None relied on.

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH (registry and tarball verified).
- Upstream ports: HIGH for code paths; MEDIUM for tokenizer vectors (grammar version) and the Bash failure tail.
- Harness architecture: HIGH (repository and Pi source); MEDIUM for background-child routes (source-read).
- Pitfalls: HIGH (several measured: fallow, trust).

**Research date:** 2026-11-01
**Valid until:** 2026-11-15 (fast-moving companions; re-check `npm view` before 01-01)
