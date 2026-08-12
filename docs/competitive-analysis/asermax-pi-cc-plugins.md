# Competitive analysis: @asermax/pi-cc-plugins

- **Analysis date:** 2026-08-10.
- **Subject:** repository `asermax/pi-cc-plugins`, commit `98cb6e51c9f4f8a93220584884a9ec3aee5771d3`, package `@asermax/pi-cc-plugins` v1.6.0, MIT, author asermax.
- **Baseline:** `pi-claude-marketplace` v0.13.0, MIT.
- **Path convention:** competitor paths are relative to their repository root. Our paths are relative to this repository's root.
- **Snapshot rule:** every claim about `@asermax/pi-cc-plugins` describes that one commit. A later release can differ.
- **Market signals:** the counts in the competitor overview come from the GitHub and npm APIs, queried on 2026-08-10 for the 30-day window that ends 2026-08-09.
- **UNVERIFIED items:** two claims in this document carry the mark UNVERIFIED. Nobody verified them against source. Do not rely on them.
- **Length:** this document is much shorter than the `@nklisch/pi-plugins` analysis, because the subject is much smaller. Their tree is 3,489 lines over 18 TypeScript files, against 79,579 for `@nklisch/pi-plugins` and 57,552 for us. Four sections that the house format carries are empty here, and each one says why.
- **Decision this informs:** where to build, where to reach parity, and where to differentiate.

## Executive summary

- They are not a plugin manager. They are a declarative loader. The user writes an array of repository references into Pi's `settings.json`. Every session start then clones, converts, and re-materializes the lot. There is no install verb, no uninstall verb, no state file, and no slash command.
- They read no marketplace. The token `marketplace` appears nowhere in their source, their README, or their agent guide. A Claude marketplace repository that ships forty plugins under `plugins/<name>/` reaches them only as forty hand-written `#subpath=` entries.
- They translate three component kinds to our five. Skills, agents, and MCP servers work. Slash commands and hooks are absent. Unlike our other competitor, they never declare either one a non-goal. The two are just missing.
- Their one original idea is skill frontmatter repair. Claude Code accepts loose YAML that Pi's strict parser rejects, so they rewrite the copied `SKILL.md` before Pi reads it. We degrade such a skill to a placeholder description instead. Their instinct is better than ours.
- Their build of that idea is broken. Their own `sanitizeSkillMarkdown` at this commit turns `tags: [a, b]` into the string `"[a, b]"`. It also turns a valid multi-line plain scalar into YAML that no parser accepts. The feature they lead with damages the documents it must rescue.
- Four more correctness defects sit in the same tree. An agent cache key omits the subpath, so one plugin can overwrite another plugin's agent. Two manifest-declared paths escape the plugin root. A reference count has no lock and no crash recovery. And the documentation describes a soft-dependency gate that the code does not have.
- One capability gap merits our attention. It is small and cheap. They read the user's own `~/.claude/skills` and `~/.claude/agents`, and the project equivalents, behind two boolean settings. We read Claude's `settings.json` for plugin declarations and never open those directories. For a user who leaves Claude Code, that is a real hole in a migration story we already claim.
- Market signals favor us on every axis. They opened on npm two days before us and have published 9 versions to our 35. Over the 30 days to 2026-08-09 they took 299 downloads to our 2,547. They hold 1 star, 1 fork, 0 issues, and 0 pull requests ever opened.
- Their release history has a ten-week gap between v1.5.0 on 2026-05-26 and v1.6.0 on 2026-08-05. Read that as a side project that woke up, not as a competitor that builds momentum.
- The strategic reading is short. This is not a threat to plan against. It is one product idea worth taking and one capability gap worth closing, and both are small.

## Competitor overview

### The project

`@asermax/pi-cc-plugins` is a single-purpose Pi extension in one repository. The npm description reads "Use Claude Code plugins (skills & agents) directly in Pi". There is no monorepo, no sibling packages, and no harness.

The whole product is 3,489 lines of TypeScript over 18 files. Of that, 1,731 lines are tests. Runtime source is `index.ts` at 322 lines, plus seven modules under `src/`. The package declares no runtime dependencies and one peer dependency of `@earendil-works/pi-coding-agent` at `*`. It declares no `engines` field, so it states no Node floor at all.

The repository carries no `tsconfig.json`, no ESLint configuration, and no Prettier configuration. The only script is `vitest run`. Nothing type-checks this tree.

Development is one person. The GitHub API reports 21 human commits by `asermax` and 10 by `semantic-release-bot`. It also reports one star, one fork, no issues, and no pull requests of any kind.

### Recent momentum

Both projects are young and small. Read this table as direction, not as market share.

| Signal, measured 2026-08-10                         | @asermax/pi-cc-plugins | pi-claude-marketplace            |
| --------------------------------------------------- | ---------------------- | -------------------------------- |
| First npm publish                                   | 2026-05-10             | 2026-05-12                       |
| Versions published                                  | 9                      | 35                               |
| Latest version                                      | 1.6.0, on 2026-08-05   | 0.13.0, on 2026-08-05            |
| npm downloads, 30 days to 2026-08-09                | 299                    | 2,547                            |
| Weekly downloads, 3 buckets of 7 days to 2026-08-09 | 44 -> 30 -> 198        | 623 -> 651 -> 924                |
| GitHub stars                                        | 1                      | 17                               |
| GitHub forks                                        | 1                      | 8                                |
| Contributors                                        | 1 human, 1 release bot | 4, of whom 2 are external humans |
| Pull requests ever opened                           | 0                      | 100                              |
| Merged external pull requests                       | 0                      | 2                                |
| Open issues                                         | 0                      | 1                                |

Two readings follow.

The first is the ten-week silence. Versions v1.0.0 through v1.5.0 all shipped between 2026-05-10 and 2026-05-26. Then nothing arrived until v1.6.0 on 2026-08-05. Their last-bucket rise from 30 to 198 downloads matches that release date. It is a release artifact, not a trend.

The second is that they reached npm first and are still eight times behind on downloads. Priority did not convert into reach.

### How much to trust these numbers

npm counts include mirrors, continuous integration, and bots, so neither figure is a user count. A four-week window is short. At 299 downloads, one continuous-integration job can move the total by a wide margin. Absence of stars is weak evidence about quality and stronger evidence about reach. Their npm package and their public repository were both created on 2026-05-10. Unlike our other competitor, their public history covers the full life of the package.

## Positioning analysis

### Positioning statements

Their README tagline reads: "Use Claude Code plugins (skills, agents, and MCP servers) directly in Pi."

Cast into the standard template, that is:

> For **Pi users who already own Claude Code plugin repositories**, `@asermax/pi-cc-plugins` is a **declarative loader**. It **loads the skills, agents, and MCP servers inside those repositories at session start**. Unlike a plugin manager, it **keeps configuration in one settings array and installs nothing**.

Our repository description reads: "Access Claude plugin marketplaces from Pi Coding Agent."

Cast into the same template:

> For **Pi users who already own Claude Code plugins**, `pi-claude-marketplace` is a **Claude plugin marketplace client for Pi**. It **makes every supported Claude component work as a Pi-native artifact**. Unlike a native plugin system, it **follows Claude Code's own `/plugin` command surface and migrates the plugins the user already has**.

### Message architecture

| Level             | @asermax/pi-cc-plugins                                  | pi-claude-marketplace                                                       |
| ----------------- | ------------------------------------------------------- | --------------------------------------------------------------------------- |
| Category          | Claude resource loader for Pi                           | Claude marketplace access for Pi                                            |
| Differentiator    | Zero ceremony, and it repairs skills that Pi rejects    | Fidelity of translation, and alignment with upstream                        |
| Value proposition | Add a line to the settings and the skills appear        | Install a Claude plugin and have every supported component work             |
| Proof points      | A frontmatter-sanitization section, and a fixture suite | Component coverage, gate-enforced offline guarantees, and an output catalog |

### Why the framing difference matters

The two products answer different questions. The difference is worth naming, because it decides who each one wins.

They answer this question: "I have Claude repositories on disk or on GitHub, and I want their contents in Pi." That user edits a JSON array once and never thinks about it again. There is nothing to install, nothing to update except a flag, and nothing to uninstall.

We answer a different one: "I use the Claude plugin ecosystem, and I want it in Pi." That user names a plugin inside a marketplace. That user expects install, update, enable, disable, and uninstall to mean what they mean in Claude Code.

The frame is also their ceiling. A loader has no place to put a marketplace, a version, a transaction, or a lifecycle verb. Each one of those is an addition to their product, not a completion of it.

### Positioning gaps

One position sits unclaimed and within reach. It is the same one the `@nklisch/pi-plugins` analysis found: migration. They read a Claude user's own `.claude` directories. We read a Claude user's installed plugin set. Nobody claims the whole story, and we are closer to it than either competitor.

Their position has one soft spot we can press without building anything. "Zero ceremony" holds only while nothing goes wrong. There is no way to ask their extension what it loaded, why a plugin failed, or what changes on the next start. Our `list`, `info`, and `pending` verbs answer all three.

## Scope and philosophy

They publish no vision document and no compatibility document. Their `AGENTS.md` states the supported surface as three kinds: skills, agents, and MCP servers. Nothing in the tree declares a non-goal. Nothing explains why commands and hooks are absent. The honest reading is that the project covers what its author needed.

Their operating model is re-derivation. Every `session_start` re-reads the settings and re-resolves every source. It then re-copies every skill directory into the cache, re-converts every agent, and rewrites the project MCP file. Almost no state persists, so almost no state can drift. A reference-count file and an MCP ownership sidecar are the whole of it.

Ours is the opposite trade. We hold an authoritative `state.json` per scope and mutate it under a cross-process lock. Materialization runs through a six-phase transactional ledger that unwinds on failure. Re-derivation is cheap and simple. It also means their session start does synchronous network work. It means a defect in conversion recurs on every start, rather than once at install.

## Capability ratings

The matrices below state what each project does. This section rates how well, so that a reader can weigh the gaps instead of counting them.

The scale has four values. **Strong** means market-leading, deep, and well executed. **Adequate** means functional, and it does the job without differentiating. **Weak** means present but limited, with significant gaps. **Absent** means not available.

A rating judges the capability as a user meets it, not the elegance of the code behind it.

| Capability                           | @asermax/pi-cc-plugins | pi-claude-marketplace |
| ------------------------------------ | ---------------------- | --------------------- |
| Skills                               | Adequate               | Strong                |
| Skill frontmatter repair             | Weak                   | Adequate              |
| Agents                               | Weak                   | Strong                |
| MCP servers                          | Adequate               | Strong                |
| Slash commands                       | Absent                 | Strong                |
| Hooks                                | Absent                 | Strong                |
| Marketplace model                    | Absent                 | Strong                |
| Standalone `.claude` directories     | Adequate               | Absent                |
| Adoption of the installed plugin set | Absent                 | Strong                |
| Lifecycle verbs                      | Absent                 | Strong                |
| Read-only inspection surfaces        | Absent                 | Strong                |
| Version derivation and pinning       | Absent                 | Strong                |
| Transactional materialization        | Absent                 | Strong                |
| Cross-process concurrency safety     | Weak                   | Strong                |
| Path containment on writes           | Weak                   | Strong                |
| Offline guarantees                   | Absent                 | Strong                |
| Scope model                          | Weak                   | Strong                |
| Soft-dependency degradation          | Weak                   | Strong                |
| Partial install                      | Absent                 | Strong                |
| Tab completion                       | Absent                 | Strong                |
| Interactive terminal manager         | Absent                 | Absent                |
| Trust model                          | Absent                 | Absent                |
| Execution sandboxing                 | Absent                 | Absent                |

Five rows need a word of explanation.

**Skill frontmatter repair** rates Weak against our Adequate, even though they built the feature and we did not. Their repair corrupts flow collections and multi-line plain scalars. The correctness section below proves it by running their code. Ours does not repair, and it does not corrupt either. An unparseable skill degrades to a synthesized block with a fixed placeholder description (`bridges/skills/frontmatter-degrade.ts:27`). A parseable one keeps its bytes.

**Agents** rates Weak for two reasons. The conversion drops `model` and `tools` outright (`src/agents.ts:107-109`). And the cache key omits the subpath, so two plugins from one repository can overwrite each other's agents.

**Scope model** rates Weak because their agents and MCP servers land in the project only. Skills reach Pi through `resources_discover` and are effectively global. There are no user-scope and project-scope halves that a user can reason about.

**Soft-dependency degradation** rates Weak because only one of the two paths has a probe. Their MCP path does test for `pi-mcp-adapter` and warns (`index.ts:205-212`). Their agent path tests for nothing. The function `isSubagentsInstalled` is exported and never called from the runtime path.

**Interactive terminal manager**, **trust model**, and **execution sandboxing** rate Absent on both sides. Neither project has any of the three.

## Capability matrix: component kinds

| Claude component | @asermax/pi-cc-plugins                                                                                                                 | pi-claude-marketplace                                                                                                                 |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Skills           | Supported. Copied into `~/.cache/pi-cc-plugins/skills/` with rewritten frontmatter, then returned as `skillPaths` (`index.ts:308-313`) | Supported. `<extensionRoot>/resources/skills/<gen>/`, copied as a whole directory                                                     |
| Agents           | Supported. Converted to pi-subagents format, cached, then symlinked into `<project>/.pi/agents/cc-plugins/` (`src/agents.ts:292-315`)  | Supported. `<scopeRoot>/agents/pi-claude-marketplace-<plugin>-<agent>.md` plus `agents-index.json`, a 7-entry tool map, `--map-model` |
| MCP servers      | Supported. Merged into `<project>/.pi/mcp.json` as `<plugin>__<server>`, with an ownership sidecar at `.pi/mcp.cc-plugins.json`        | Supported. Merged into `<scopeRoot>/mcp.json`, names kept verbatim, collisions refuse rather than rename                              |
| Commands (slash) | **Absent.** No `commands/` scan exists anywhere in the tree                                                                            | Supported. Pi prompt template at `resources/prompts/<plugin>:<command>.md`                                                            |
| Hooks            | **Absent.** The token `hooks` appears nowhere in `index.ts` or `src/`                                                                  | Supported. Staged `hooks/<plugin>/hooks.json` plus in-memory routing over 10 Claude events                                            |
| Everything else  | Not read                                                                                                                               | Surfaced as unsupported, so the plugin becomes `partially-available` and installs with `--partial`                                    |

Three qualifications apply.

Their agent conversion drops `model` and `tools`. A source comment states the reason: Claude names do not reliably match Pi identifiers. That is a defensible call. It is also strictly less than our `TOOL_MAP`, our `Skill` to `inheritSkills: true` rule, and our opt-in `--map-model`.

Their manifest reader accepts only string values for the `skills`, `agents`, and `mcp` fields (`src/plugin.ts:107`, `:140`, `:177`). Claude Code declares the first two as arrays. An array-valued declaration is therefore ignored in silence, and the default directory is used instead.

Their MCP namespacing renames every server to `<plugin>__<server>`. Ours keeps the declared name verbatim and refuses on collision. Theirs avoids the collision. The cost is that it breaks any prompt, skill, or agent that names the server as the plugin author wrote it.

## Capability matrix: source and distribution model

Their source grammar is one string with an optional fragment, parsed in 48 lines (`src/source.ts`). Three prefixes exist. There is no ref, no tag, and no commit.

| Source kind                  | @asermax/pi-cc-plugins                                                    | pi-claude-marketplace                                     |
| ---------------------------- | ------------------------------------------------------------------------- | --------------------------------------------------------- |
| `github:owner/repo`          | Supported, cloned from `https://github.com/<ref>.git`                     | Supported                                                 |
| `git:<url>`                  | Supported, including `git@`, `ssh://`, and `file://` (`src/cache.ts:115`) | Supported over HTTPS. SSH rejected by design              |
| `local:<path>`               | Supported, with `~` and `./` expansion                                    | Supported as `path`                                       |
| `#subpath=<dir>`             | Supported, and the only route to one plugin inside a multi-plugin repo    | Supported as `git-subdir`                                 |
| Marketplace catalog          | **Absent.** No `marketplace.json` parsing exists                          | Supported, with `marketplace add/remove/list/info/update` |
| `npm`                        | Absent                                                                    | Parsed and listed, and the resolver rejects it            |
| Archive or file over `url`   | Absent                                                                    | Supported                                                 |
| Pin to a ref, tag, or commit | **Absent.** Always `git clone --depth 1` of the default branch            | Supported, with a full 40-hex `sha` authoritative         |

The pinning row is the widest gap in this table. Their clone is `git clone --depth 1` with no ref (`src/cache.ts:61`). Their update is `git fetch origin` followed by `git reset --hard origin/HEAD` (`src/cache.ts:95-102`). A user cannot hold a plugin at a known revision. A user cannot see which revision is live, and cannot return to a previous one. Our version ladder derives `sha-<12hex>` for a git source, and `hash-<12hex>` from a deterministic content walk otherwise. Our `reinstall` repairs from the recorded sha and never touches the network.

Their git access shells out through `execSync` with an interpolated command string. The interpolation is single-quote escaped (`src/cache.ts:122-124`), so this is not an injection finding. It is a portability finding. Cleanup after a failed clone runs `rm -rf` (`src/cache.ts:69`), which has no meaning on Windows. We use `isomorphic-git` and need no `git` binary at all.

Their cache is never collected. If the user removes an entry from `ccPlugins`, the clone stays under `~/.cache/pi-cc-plugins/` forever. Our clone cache derives its live key set from surviving `resolvedSha` records and sweeps the rest.

## Control surface

This section is short, because there is almost nothing to describe.

They register no command. The complete user-facing surface is one CLI flag and three settings keys. The flag is `--cc-plugins-update`. It switches every remote source from reuse to fetch-and-reset for that run (`index.ts:99-102`). The keys are the `ccPlugins` array and the booleans `ccClaudeGlobal` and `ccClaudeProject`. Settings merge global under project at the top level, with no deep merge (`src/settings.ts:24`).

Their output is four `ctx.ui.notify` calls in `index.ts`. One reports a count of what loaded. One reports the missing MCP adapter. One reports warnings, and one reports errors. The error call passes severity `"warning"` (`index.ts:300-304`), so a failed clone and a skipped MCP entry read the same.

Our surface is `/claude:plugin` with sixteen subcommands. A flag catalog is guarded against router drift by `tests/architecture/flag-catalog-drift.test.ts`. A tab-completion provider carries five branches. A closed output vocabulary of 26 status tokens and about 40 reasons is held byte-exact against `docs/output-catalog.md` by `tests/architecture/catalog-uat.test.ts`.

## What they have that we do not

### Standalone `.claude` directory adoption

This is the only capability gap in this document that changes our roadmap.

The setting `ccClaudeGlobal: true` loads `~/.claude/skills/` and `~/.claude/agents/`. The setting `ccClaudeProject: true` loads the same two directories under the project root. Both default to false (`src/settings.ts:52-62`, `index.ts:159-180`). Skills materialize through the same cache and sanitization path as plugin skills. Agents convert and symlink under the namespaces `claude-global` and `claude-project`.

We read Claude's `settings.json` and `settings.local.json` for `enabledPlugins` and `extraKnownMarketplaces` (`orchestrators/import/settings.ts`). We never open `~/.claude/skills/` or `~/.claude/agents/`. A Claude Code user who wrote skills and agents outside any plugin gets nothing from our import. That user is exactly the migration case we claim.

Their README also makes an argument we must answer. It tells the reader to prefer `ccClaudeGlobal` over Pi's own native `skills` setting. The reason is that the native setting loads files as-is, and a loose Claude `SKILL.md` then fails to parse. That is a correct observation about Pi. It is also a reason to use their extension over no extension at all.

### Skill frontmatter repair, as an idea

Claude Code parses `SKILL.md` frontmatter leniently. Pi parses it strictly. A description that contains an unquoted colon is the common case, and it is fatal under a strict parser.

They copy each skill directory to cache and rewrite the copy. The source stays untouched (`src/skills.ts:56-70`). The rewrite normalizes the `name` to Pi's lowercase pattern. It drops `tools`, `allowed-tools`, `allowed_tools`, and `allowedTools`. It quotes every remaining inline scalar, and it synthesizes a `name` when none exists.

We do less. Our `bridges/skills/rewrite-frontmatter.ts` rewrites only the `name` node. Every sibling key stays byte-identical, deliberately, so that nested maps and block scalars survive. If the source frontmatter does not parse, `synthesizeUnparseableSkill` replaces the whole block. It writes a generated name, the fixed string `Source frontmatter could not be parsed.`, and `disable-model-invocation: true`.

The skill still installs either way. Under their design, a repairable skill keeps its real description. Under ours, it does not. Repairing the common single-line cases is the borrowable idea. The correctness section explains what not to copy.

### Two smaller items

They accept `git@`, `ssh://`, and `file://` git URLs. We reject SSH by design.

Their agent symlinks are reference-counted across concurrent sessions in one project. A second session therefore does not remove the first session's agents on shutdown. We have no equivalent, because our agents are installed artifacts rather than session-scoped links, so the problem does not arise for us. The mechanism is theirs alone. The section below explains why it does not work.

## What we have that they do not

The list is long, so this section groups it rather than naming every item.

The marketplace model is the widest of them. They have no catalog concept at all. We add, remove, list, inspect, and update marketplaces, resolve a plugin by `<plugin>@<marketplace>`, and read the manifest without touching the network. To install one plugin out of a forty-plugin marketplace repository, their user writes forty `#subpath=` lines by hand. Each one clones the same repository over again.

Two component kinds follow. Slash commands become Pi prompt templates. Hooks activate across 10 Claude events, with an `if:` predicate compiler, a bounded wire protocol, and an async-rewake lane. They translate neither, and unlike `@nklisch/pi-plugins` they never call either one a non-goal. A user therefore has no way to learn that the installed plugin lost half its behavior.

Then the whole lifecycle. Install, uninstall, update, fetch, reinstall, enable, disable, import, and pending exist for us and have no counterpart for them. Neither does the ability to ask what is installed, what is available, what failed, and what the next start changes.

The safety machinery is the part a user meets only on a bad day. Our six-phase ledger unwinds every committed phase when a later one throws, and reports rollback failures rather than swallowing them. Load-time reconcile diffs desired state against disk and re-materializes what is missing, so `/reload` alone recovers. They have no transaction and no rollback. A failure part-way through their session-start loop leaves whatever it wrote behind, and the next start simply tries again.

Underneath that sit a `proper-lockfile` advisory lock per scope, atomic writes on every JSON file, and one containment chokepoint that every name-derived path routes through. Their only concurrency control is an unlocked integer in a file, and two of their three manifest-declared paths are unchecked.

Our offline guarantee is enforced rather than promised. The test `tests/architecture/no-orchestrator-network.test.ts` greps our orchestrators for git surfaces and fails the build. Their session start clones synchronously over the network whenever the cache is cold, on the same code path that starts the session.

We also read `enabledPlugins` from Claude's settings in both scopes and cascade the installs. They read no Claude settings file at all.

Last, and least glamorous, is the quality bar. We run `tsc --noEmit`, ESLint with architecture-boundary gates, Prettier, and 223 test files inside `npm run check`. Their repository has no TypeScript configuration and no linter, so `err: any` and unchecked shapes go unexamined.

## Their declared limitations

They declare almost none, and that is itself a finding.

Their README states two soft dependencies. Agents require `pi-subagents`, and MCP requires `pi-mcp-adapter`. It says that loading is skipped with a warning when either one is missing. It also records three smaller limits. Standalone `.claude` directories are not scanned for MCP configuration. Entries in `.pi/mcp.json` survive session shutdown by design. And a newly added MCP configuration can need a reload before the adapter reads it.

Nothing in their documentation admits the absence of commands, hooks, marketplaces, pinning, or any lifecycle verb. A reader who compares their README against Claude Code's plugin documentation has no way to learn what is missing.

The first of those two declared soft dependencies is not true of the code. The section below covers it.

## Correctness findings

Every item here was verified against source at commit `98cb6e51c9f4f8a93220584884a9ec3aee5771d3`. The first item was verified by running their code.

### The frontmatter sanitizer corrupts valid documents

The function `sanitizeFrontmatterLines` (`src/skills.ts:136-181`) walks the block line by line. Any line that matches `^([A-Za-z0-9_-]+):(.*)$` has its value passed through `formatYamlScalar`. That function returns the value unchanged when it looks like a boolean, a null, or a number. Otherwise it wraps the value with `JSON.stringify`.

That rule is right for a bare string and wrong for everything else on one line. Their own exported `sanitizeSkillMarkdown` produces this:

| Input line                                       | Output line                                              | Effect                        |
| ------------------------------------------------ | -------------------------------------------------------- | ----------------------------- |
| `description: Use this: when reviewing`          | `description: "Use this: when reviewing"`                | Repaired, as intended         |
| `tags: [a, b]`                                   | `tags: "[a, b]"`                                         | A sequence becomes a string   |
| `meta: {x: 1}`                                   | `meta: "{x: 1}"`                                         | A mapping becomes a string    |
| `description: line one` + an indented `line two` | `description: "line one"` + the same indented `line two` | The document no longer parses |

The last row is the serious one. The input parses cleanly as `{name, description: "line one line two"}`. The output raises `All mapping items must start at the same column at line 3`. A skill that Pi accepted becomes a skill it cannot load. The feature that causes this has the reverse purpose.

Block-style sequences survive, because their indented child lines never match the column-zero key pattern.

### The agent cache key omits the subpath

The cache slug for a plugin's agents is `plugin.source.ref` with separators replaced (`index.ts:228`). The `ref` field holds only the repository portion. The `#subpath=` fragment lives in `source.subpath` (`src/types.ts:15-24`).

So `github:foo/bar#subpath=plugins/a` and `github:foo/bar#subpath=plugins/b` both produce the slug `foo--bar`. Then `writeCachedAgent` writes both to `~/.cache/pi-cc-plugins/agents/foo--bar/<agent>.md` (`src/agents.ts:145-155`). If the two plugins each ship an agent of the same name, the second write wins. Then `linkAgents` creates two differently named symlinks that both point at the surviving file.

Their skill cache does not have this defect. It keys on a hash of `${source.raw}\n${rootDir}` (`src/skills.ts:23`), and `raw` includes the fragment. One of the two paths got it right.

### Two manifest-declared paths escape the plugin root

The function `discoverMcpConfigPaths` resolves a manifest `mcp` value. It rejects the value when the result leaves the plugin root (`src/plugin.ts:185-192`). That guard is correct, and it is not applied to the other two fields.

The function `discoverSkillPaths` strips a leading `./` from `manifest.skills` and joins the remainder (`src/plugin.ts:109-110`). The function `discoverAgentPaths` strips one leading `../` from `manifest.agents` and joins the remainder (`src/plugin.ts:142-143`). So `../../x` becomes `../x` and still escapes.

The input is a third-party plugin manifest, not the user's own settings. A plugin that declares `"agents": "../../../.ssh"` has its target directory walked for `.md` files. Any file that parses becomes an agent the model can invoke. The reachable damage is reading files the user did not intend to expose, then feeding them into the session. It is not a write outside the root.

Our equivalent is a single chokepoint. Every name-derived path in `persistence/locations.ts` routes through `assertPathInside`. Containment is requirement NFR-10, not a per-call-site choice.

### The reference count has no lock and no crash recovery

The function `incrementRefcount` reads an integer from a file and writes back the value plus one. There is no lock and no atomic write (`src/agents.ts:177-205`). The function `decrementRefcount` does the reverse, and at zero it deletes the whole symlink directory (`src/agents.ts:211-244`).

Two consequences follow. Two sessions that start at once can both read zero and both write one. The first shutdown then drops the count to zero and removes the agents from under the session that still runs. And a session that crashes never decrements, so the count climbs and the symlinks stay forever. That is the exact failure the mechanism exists to prevent.

The zero branch also deletes `.pi/agents/` and then `.pi/` itself, when each one is empty. Removal of a directory that the extension did not create is a surprising act for a loader.

Our comparable path holds a `proper-lockfile` advisory lock with `retries: 0`. A second writer fails fast into a typed `StateLockHeldError` rather than corrupting a counter.

### The documentation describes a gate the code does not have

Their README says that agent loading is skipped with a warning when `pi-subagents` is absent. Their `AGENTS.md` repeats it as step one of the agent flow.

The code does not do this. Lines `index.ts:239-277` convert and symlink agents whenever any are found. The comment above them explains the deliberate change. Any consumer that scans `.pi/agents/` recursively picks them up, so no probe is needed. The function `isSubagentsInstalled` stays exported from `src/agents.ts:333` and from both barrel files, and only tests call it.

The MCP probe is real (`index.ts:205-212`). The agent probe is documentation only. As with our other competitor, the rule is to read their code rather than their documentation.

## Where we are behind on our own terms

Only the items that matter against this competitor appear here. The `@nklisch/pi-plugins` analysis carries the full self-reported list.

We do not read standalone `.claude/skills` or `.claude/agents` directories, so a Claude user's non-plugin resources do not migrate.

We do not repair loose skill frontmatter. A skill whose frontmatter fails to parse installs with a placeholder description instead of its real one. The actionable detail rides the install-time warning channel.

We support no `npm` plugin source, no SSH, no remote `marketplace.json` URLs, and no marketplace-level `git-subdir`.

Uninstall removes the plugin data directory unconditionally after commit, and we have no `--keep-data` equivalent.

The reconcile cascade is visible at Pi startup but not after `/reload`. The host rebuilds the chat from the transcript and drops extension notifications.

## Strengths and weaknesses

### Their strengths

They found a real problem before we did, and that is the honest headline of this section. Pi's strict YAML parser rejects Claude `SKILL.md` files that Claude Code accepts. Of the three projects in this comparison, they are the only one that tries to fix that rather than route around it. Their README even explains to the reader why Pi's own `skills` setting is the wrong tool for the job, which is both accurate and useful.

The `.claude` directory support follows from the same instinct. A Claude Code user's skills and agents often sit outside any plugin, and they load them anyway.

Their configuration model is light. One array in a file the user already has, no install step, no state to reconcile, and a straightforward mental model. For one local plugin under active development, `local:~/my-plugins/dev-plugin` is less friction than anything we offer.

The reference-count idea is sound even though the implementation is not. Concurrent Pi sessions in one project are a real case, and it is worth remembering when we touch anything session-scoped.

### Their weaknesses

The feature they lead with damages the files it processes. Flow collections become strings, and multi-line plain scalars stop parsing. Both failures are demonstrable by running their own exported function.

Two of the five component kinds are missing, and no statement anywhere admits it. There is no marketplace, so the ordinary shape of the Claude ecosystem reaches them only through hand-written subpaths. That shape is one repository that holds many plugins. There is no pinning, so every start follows the default branch wherever it went.

There is no way to see what happened. No list, no info, no plan preview, and no per-plugin status. When a source fails, the user gets one aggregated notification at severity `warning` and nothing else.

The engineering hygiene is thin. No TypeScript configuration, no linter, no declared Node floor, an unpinned peer range, and a `rm -rf` shell-out that cannot work on Windows. Ten weeks of silence, one star, one fork, and no issue or pull request ever filed complete the picture.

### Our strengths

Against this competitor our advantage is breadth and safety, not any single feature. Five component kinds to their three. A marketplace model where they have none. Versions and pins where they follow a branch. A transactional ledger with load-time reconcile where they re-derive and hope.

The safety properties are the ones a user notices only when something goes wrong. A cross-process lock, atomic writes, one containment chokepoint, and an offline guarantee that fails the build rather than the user.

We are also the more alive project by every public signal: 35 versions to 9, 2,547 downloads to 299, 17 stars to 1, and two merged external pull requests to none.

### Our weaknesses

We do not read the user's own `.claude` directories. Against a competitor that does, on a migration story we claim as ours, that is the gap that matters.

We do not repair loose frontmatter either, and the placeholder we substitute costs the user the skill's real description. Both gaps have the same uncomfortable shape: a 3,489-line side project noticed a user problem in our own category before we did. Neither gap is hard to close. That is the part worth sitting with.

Everything else on our weakness list is real but is not a gap against this competitor. No trust model, no interactive manager, no machine-readable output, no update discovery. They have none of it either.

## Opportunities

Two, and both are small.

Adopting standalone `.claude/skills` and `.claude/agents` closes the one real capability gap. It also strengthens the migration position we already own. The seam is `orchestrators/import/`, which already reads Claude's configuration directory and already resolves both scopes. The work is a new source of components, not a new subsystem.

Repairing single-line frontmatter values gives us their headline feature without their defect. Our `rewrite-frontmatter.ts` already replaces exactly one node span and leaves siblings byte-identical. That is the correct shape. Extend it to quote an inline scalar that fails to parse, and nothing else. That is a bounded change to a module built for it.

## Threats

This section is nearly empty. The reason is worth stating rather than padding.

`@asermax/pi-cc-plugins` does not threaten our position. It is a solo side project with one star, no issues, and no external contributions. It has no marketplace model, no lifecycle, and a ten-week publication gap. It reaches a different and smaller user than we do. Its architecture sets its ceiling, not its author's pace.

Two things are worth watching rather than acting on. If Pi's own skill loader relaxes its frontmatter strictness, their strongest reason to exist disappears, and so does the value of our copying it. And `.claude` directory support is a small, obvious feature. Any Pi extension author can add it in an afternoon, so the risk is not that they beat us to it. The risk is that a third project does, and the migration position we have not yet claimed gets claimed by someone else.

## Strategic implications

### Build

Standalone `.claude/skills` and `.claude/agents` adoption, at user and project scope, behind an explicit opt-in. This is the only item in this document that changes what a user can do.

Inline frontmatter repair for values that fail to parse. Scope it to single-line scalars and apply it through the existing single-node rewrite path.

### Accelerate

Nothing. No item in this analysis justifies reordering existing work.

### Deprioritize

Their re-derivation model. Recomputing everything at session start is simple, and it is why they need no state. It also puts network work on the session-start path and repeats every conversion defect on every start. Our transactional install with load-time reconcile is the better trade, and their evidence does not overturn it.

Their reference-count mechanism. The problem it addresses is real: concurrent sessions in one project. The implementation is a lockless read-modify-write with no crash recovery. We already hold a cross-process lock that solves the same class of problem correctly.

### Differentiate or reach parity

| Area                             | Stance            | Reason                                                               |
| -------------------------------- | ----------------- | -------------------------------------------------------------------- |
| Marketplace model                | Differentiate     | They have none, and a loader has nowhere to put one                  |
| Component coverage               | Differentiate     | Five kinds to three, and they declare no non-goals to hide behind    |
| Lifecycle and inspection         | Differentiate     | Nothing on their side answers what is installed or what failed       |
| Versions, pins, and reinstall    | Differentiate     | They follow a branch tip with no way back                            |
| Transactional safety             | Differentiate     | No transaction, no rollback, and no lock on their side               |
| Standalone `.claude` directories | Parity            | The one capability they have and we do not                           |
| Frontmatter repair               | Parity, then pass | Their implementation corrupts documents. A correct one wins outright |
| Zero-ceremony configuration      | Do not chase      | It is the same design choice that costs them everything else         |

### Monitor

Whether a `commands/` or `hooks/` scan appears in their tree. That signals a change of ambition rather than a bug fix.

Whether the frontmatter sanitizer gets rewritten around a real YAML parser.

Whether the ten-week publication gap resumes after v1.6.0.

Whether Pi's own skill loader relaxes its frontmatter strictness. That removes the reason to build our own repair.

## Prioritized recommendations

| #   | Recommendation                                         | Why this rank                                                                                                          | Size            | Reuses on our side                                                                                               |
| --- | ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- | --------------- | ---------------------------------------------------------------------------------------------------------------- |
| 1   | Adopt standalone `.claude/skills` and `.claude/agents` | The only real capability gap here. It also strengthens the migration position we already hold and do not claim         | Not stated      | `orchestrators/import/`, which already reads Claude's config directory and resolves both scopes                  |
| 2   | Repair inline frontmatter scalars that fail to parse   | Gives us their headline feature without their defect, and it improves every skill that today degrades to a placeholder | Smallest change | `bridges/skills/rewrite-frontmatter.ts`, which already replaces one node span and leaves siblings byte-identical |

Two cautions attach to item 2. Repair only single-line scalars. Their line-by-line rule is what turns `[a, b]` into a string and breaks multi-line plain scalars, and both failures reproduce from their exported function. And keep the existing degrade arm as the fallback. A synthesized block that parses beats a repair attempt that does not.

No third recommendation follows from this competitor. Everything else worth building came out of the `@nklisch/pi-plugins` analysis and is already ranked there.

## Sections deliberately left empty

Four sections that the house format carries have nothing real in them for this subject. Padding them misrepresents the comparison.

There is no **design-patterns-worth-borrowing** section beyond the two recommendations above. A 3,489-line loader has no subsystem worth modelling ours on.

There is no **nightmare scenario**. The plausible worst case is that they add `.claude` directory support first. That is recommendation 1 arriving from the other direction, and it changes nothing about our position.

There is no **cautions about adopting their machinery** section, because we adopt none of it. The two items we take are a product idea and a text transformation, not a mechanism.

There is no **subsystem detail appendix**. The body of this document already cites nearly every non-trivial line in their runtime source.

## Appendix: methodology and verification status

This analysis was produced by reading their whole source tree, not by running the extension inside Pi. Every runtime file was read in full: `index.ts` and the seven modules under `src/`. The competitor side is `asermax/pi-cc-plugins` at commit `98cb6e51c9f4f8a93220584884a9ec3aee5771d3`, which publishes `@asermax/pi-cc-plugins` v1.6.0. Our side is `pi-claude-marketplace` at v0.13.0.

One claim was verified by execution rather than by reading. Their `sanitizeSkillMarkdown` was imported from `src/skills.ts` at the pinned commit and run over seven inputs. The resulting documents were then parsed with the `yaml` package. The corruption table in the correctness section reports that output directly.

Market signals come from a different method and carry a different confidence. Repository counts come from the GitHub REST API. Download counts come from the npm registry download API, for the 30-day window that ends 2026-08-09. Three 7-day buckets cover 2026-07-20 to 2026-08-09. Both were queried on 2026-08-10. Treat every number there as a measurement with the shelf life of a week.

Two claims in this document are UNVERIFIED. Nobody verified them against source, so do not rely on them:

1. That Pi's module loader resolves their `./x.js` import specifiers to the `./x.ts` files they actually ship. Their package has no build step, and `pi.extensions` points at `./index.ts`. Yet every internal import names a `.js` file that does not exist in the published tree. Plain `node --experimental-strip-types` fails to resolve them, which was observed. Whether Pi's loader rewrites the extension is not established here. Loading the extension in Pi settles it.
2. That `pi-subagents` follows symlinks during its recursive `.pi/agents/` scan. That mechanism carries their whole agent path. Their README asserts it. Reading `pi-subagents` at its current version settles it.

Re-cut this document if `@asermax/pi-cc-plugins` publishes a new minor version, and in particular if the frontmatter sanitizer changes. Their release history is v1.0.0 to v1.6.0, between 2026-05-10 and 2026-08-05, with a ten-week gap before the last release. The shelf life here is therefore longer than for a faster-moving competitor.
