# Competitive analysis: pi-claude-plugins

- **Analysis date:** 2026-08-10.
- **Subject:** repository `ross-jill-ws/pi-claude-plugins`, commit `554f19c1ad25a8219bc470f683824a9346530c8c`, package `pi-claude-plugins` v0.2.0, MIT, author Ross Zhu.
- **Baseline:** `pi-claude-marketplace` v0.13.0, MIT.
- **Path convention:** competitor paths are relative to their repository root. Our paths are relative to this repository's root.
- **Snapshot rule:** every claim about `pi-claude-plugins` describes that one commit. A later release can differ.
- **Tarball check:** the published 0.2.0 tarball holds three files. Its `extensions/index.ts` is byte-identical to the git HEAD above, so a read of the git tree is equivalent to a read of what users install.
- **Market signals:** the counts in the competitor overview come from the GitHub and npm APIs. We queried both on 2026-08-10, for the 30-day window that ends 2026-08-09.
- **UNVERIFIED items:** two claims in this document carry the mark UNVERIFIED. Nobody verified them against source. Do not rely on them.
- **Decision this informs:** whether a passthrough mode belongs in our product, and what to do about a package name that is nearly ours.

## Executive summary

The verdict comes first, because it changes how you read everything below.

`pi-claude-plugins` is not a plugin manager. It is a read-only mirror of a Claude Code installation. It installs nothing, downloads nothing, and writes nothing to disk. The whole product is 221 lines in one TypeScript file. On each `resources_discover` event it walks `~/.claude/plugins/marketplaces` and filters the tree by what Claude Code already enabled. It then hands Pi a list of file paths that stay where they are. If you remove the extension, no trace remains, because it wrote none.

That makes it a competitor to a job, not to a product. The job is "get my Claude skills into Pi." One segment of users already runs Claude Code, already installed plugins there, and wants only skills and slash commands. For that segment their answer is one `pi install` and nothing else. Ours is one `pi install`, then a marketplace add, then an install per plugin, then a reload. On that segment they win, and no feature we ship changes the arithmetic.

Everywhere else they deliver nothing. They translate two component kinds of five: skills and commands. Agents, MCP servers, and hooks are declared non-goals in their own README. They need Claude Code on the machine, so a machine without it gets no value. They hard-code `~/.claude` and never read `CLAUDE_CONFIG_DIR`, which Claude Code itself reads. They parse no `plugin.json`, so a plugin that declares custom component paths is invisible to them.

Their `resources_discover` handler has no error containment. A malformed `~/.claude/settings.json` throws a `SyntaxError` out of the handler on every Pi load. Our equivalent path catches the same failure and Pi continues to load. That is the guarantee we call NFR-2.

The engineering signals are thin. No tests, no CI, no lint, no `tsconfig.json`, and no `engines` field. Seven commits over four months. One star, three forks, and one open pull request from an outside contributor. That contributor reports that the extension prints to stdout on every session start, and the report is correct.

The name is the real problem. `pi-claude-plugins` sits against `pi-claude-marketplace` in the same npm registry, for the same host, over an adjacent problem. Both are MIT and both are TypeScript. Theirs is five weeks older. A user who searches npm gets both results and cannot tell them apart by name. This costs us nothing today only because they took 358 downloads in the 30 days to 2026-08-09, against our 2,547.

One thing from their product is worth taking: a product mode we do not have. Our architecture assumes installation, through resolve, stage, commit, record, and reconcile. Theirs assumes projection. A user who runs both hosts today must maintain two plugin lists that drift apart. A mirror mode on our side closes that gap and removes their only advantage. Our `import` orchestrator already reads Claude's settings files in both scopes.

The full ranking is in the prioritized recommendations section.

## Competitor overview

### The project

`pi-claude-plugins` is a single-file Pi extension in a repository of four files: `extensions/index.ts`, `package.json`, `README.md`, and `.gitignore`. The GitHub repository carries no description, no topics, and no LICENSE file. Both `package.json` and the README declare MIT.

Development is one person. The GitHub API reports one contributor who holds all seven commits.

The commit history is short, and it is also the complete product history. The initial commit landed on 2026-04-08. Three small commits followed the same day. The first excluded disabled plugins, the second edited `package.json`, and the third bumped a keyword and the version. One bug fix landed on 2026-05-08, to load marketplace-level top-level skills. The migration to the `@earendil-works` Pi packages landed on 2026-08-09 as v0.2.0.

Four months, seven commits, 221 lines. This is a weekend tool that its author keeps alive, not a product under development.

### Recent momentum

Both projects are small. Read this table as direction, not as market share.

| Signal, measured 2026-08-10                         | pi-claude-plugins    | pi-claude-marketplace            |
| --------------------------------------------------- | -------------------- | -------------------------------- |
| First npm publish                                   | 2026-04-07           | 2026-05-12                       |
| Versions published                                  | 6                    | 35                               |
| Latest version                                      | 0.2.0, on 2026-08-09 | 0.13.0, on 2026-08-05            |
| npm downloads, 30 days to 2026-08-09                | 358                  | 2,547                            |
| Weekly downloads, 3 buckets of 7 days to 2026-08-09 | 50 -> 40 -> 212      | 623 -> 651 -> 924                |
| Peak download day                                   | 2026-08-09, with 167 | 2026-08-09, with 376             |
| GitHub stars                                        | 1                    | 17                               |
| GitHub forks                                        | 3                    | 8                                |
| Contributors                                        | 1                    | 4, of whom 2 are external humans |
| Merged pull requests                                | 0                    | 108 in total, 2 from outsiders   |
| Open issues and pull requests                       | 1                    | 1                                |
| Commits                                             | 7                    | Not comparable, see below        |
| Repository size, from the GitHub API                | 10 KB                | 13,644 KB                        |

Three readings follow.

First, we lead on downloads by roughly seven to one, and they reached npm five weeks earlier. Over four months they collected less reach than we collected in three. That is the clearest signal in the table.

Second, their week-three jump from 40 to 212 is a release artifact. They published 0.2.0 on 2026-08-09 at 06:18 UTC, and 167 of those 212 downloads fall on that day. Read it as publication activity, not as adoption. Our own peak also falls on 2026-08-09, which points to registry or mirror activity common to both.

Third, their fork-to-star ratio is unusual, and it carries information. Three forks against one star says that the people who find it modify it instead of endorse it. That is what a 221-line single file invites. One fork, `ebbe-brandstrup/pi-claude-plugins`, pushed on 2026-08-09, the same day as their own latest commit.

The one open pull request is the most informative item in the overview. An outside contributor, `yg-codes`, filed a detailed fix. The `session_start` handler prints its summary through both `console.log` and `ctx.ui.notify` on every session, which defeats Pi's own `quietStartup` setting. The complaint is accurate against their source at lines 209 and 215. Somebody read the code and wrote a proper problem statement. The pull request is still open.

Our commit count is not comparable, because our history holds planning artifacts that theirs does not carry. The merged pull request figure is asymmetric in the same way. Of our 108, most are our own and 58 come from Dependabot, against 2 from outside humans.

### How much to trust these numbers

npm counts include mirrors, continuous integration, and bots. Neither figure is a user count. A 30-day window is short, and at 358 downloads one automated job moves their number by a visible fraction. One star is weak evidence about quality and stronger evidence about reach. Their npm publish on 2026-04-07 precedes their first public commit on 2026-04-08 by less than a day, so their public history does cover the package.

Re-measure before you treat any of this as a trend.

## The name collision

The two package names differ by one word. `pi-claude-plugins` and `pi-claude-marketplace` share a registry, a host, a license, a language, and a problem domain. Their npm keywords are `pi-package`, `claude`, `plugins`, `skills`, `commands`, and `extension`. A user who searches npm or pi.dev for "pi claude plugins" gets both results. The names give that user no way to tell that one installs plugins and the other mirrors an existing installation.

Theirs is the older name. They published on 2026-04-07 and we published on 2026-05-12. We cannot claim priority, and there is no dispute to raise. Two MIT projects picked adjacent descriptive names for adjacent problems, which is what happens when a domain has an obvious vocabulary.

Three consequences follow, and only the third needs action.

The first is support noise. A user who runs their extension and expects ours will report that `/claude:plugin` does not exist. A user who runs ours and expects theirs will report that installed Claude plugins do not appear on their own. Both reports land in whichever repository is easier to find, and ours is easier to find.

The second is a defect in their acquisition path that sends the confusion back to us. Their README install command reads `pi install npm:pi-claude-plugin`, singular, at lines 38 and 44. The package is `pi-claude-plugins`, plural. A user who follows their README installs nothing. This is their bug and not our advantage to press. It does mean that the confused traffic returns to a search results page where both packages appear.

The third consequence matters most. In a small ecosystem, the project that describes the category most clearly claims the category name, not the project that ships the most code. Their package description reads: "Pi extension that exposes Claude marketplace plugin skills from `~/.claude/plugins/marketplaces` into the current pi session." That sentence states exactly what the product does. Ours reads: "Access Claude plugin marketplaces from Pi Coding Agent." That describes a category instead of a behavior, and their product can claim it too without a lie.

The fix costs writing time. Our description must say that we install plugins from Claude marketplaces without a Claude Code installation, and that we translate five component kinds. Both statements are true today. Both separate us from them in one line. Neither appears anywhere a search result shows.

## Positioning analysis

### Positioning statements

Their README tagline reads: "A pi extension that imports enabled Claude marketplace plugin skills and commands into the current pi session."

Cast into the standard template, that is:

> For **Pi users who already run Claude Code**, `pi-claude-plugins` is a **read-only bridge** that **makes their already-enabled Claude skills and commands appear in Pi**. Unlike a plugin manager, it **installs nothing and keeps Claude Code as the single source of truth**.

Ours, cast the same way:

> For **Pi users who want Claude plugins**, `pi-claude-marketplace` is a **Claude plugin marketplace client for Pi** that **makes every supported Claude component work as a Pi-native artifact**. Unlike a mirror, it **acquires and installs plugins itself, and needs no Claude Code installation**.

### Message architecture

| Level             | pi-claude-plugins                                       | pi-claude-marketplace                                                   |
| ----------------- | ------------------------------------------------------- | ----------------------------------------------------------------------- |
| Category          | Claude Code passthrough                                 | Claude marketplace client for Pi                                        |
| Differentiator    | No ceremony, no state, one source of truth              | Fidelity of translation, and independence from Claude Code              |
| Value proposition | Your Claude skills appear in Pi, with nothing to manage | Install a Claude plugin and have every supported component work         |
| Proof points      | 221 lines, three files, no writes, no dependencies      | Five component kinds, enforced offline guarantees, a byte-exact catalog |
| Requires          | A Claude Code installation with plugins enabled         | Nothing beyond Pi                                                       |

### Why the framing difference matters

Their frame gives them something no feature comparison can take away. Claude Code owns installation, enablement, updates, and scope. Each of those is therefore out of their scope by construction rather than by omission. They cannot have an update bug, because they never update. They cannot corrupt state, because they hold none. They cannot fail a rollback, because they never write.

Our frame carries the opposite load. We own acquisition, translation, staging, commit, rollback, reconcile, and enablement. Each is a surface where we can be wrong. That is the price of a product that works without Claude Code. It is the right price, and it is a trade rather than a win.

The frame also decides who each product serves. Theirs serves the dual-host user who keeps Claude Code as the primary tool and wants Pi to see the same skills. Ours serves the user who leaves Claude Code, or who never had it. These populations overlap today, because most early Pi adopters came from Claude Code. They will overlap less as Pi grows.

## What it actually does

This section is the source walk. Every claim below cites `extensions/index.ts` at the pinned commit.

The module computes three absolute paths once at load time (lines 6 to 8). They are the marketplace root at `~/.claude/plugins/marketplaces`, the installed-plugin record at `~/.claude/plugins/installed_plugins.json`, and Claude's settings at `~/.claude/settings.json`. All three use `os.homedir()`. The code never reads the `CLAUDE_CONFIG_DIR` environment variable, and it never reads a project-local `.claude/` directory.

Enablement is a two-stage filter. `loadPluginEnabledStates` reads `settings.json` and returns its `enabledPlugins` map (lines 76 to 88). `loadEnabledPluginKeys` then reads `installed_plugins.json`, drops any plugin whose key maps to `false` in that map (lines 107 to 109), and tests scope (lines 113 to 120). A `user`-scope entry always passes. A `project`-scope entry passes when the current working directory is the same as, or below, the recorded `projectPath`. Any other entry shape also passes, because the predicate ends in `return true` at line 119. That last branch is permissive. A malformed entry loads rather than drops out.

Discovery then walks each marketplace directory (lines 141 to 180) and looks in exactly four places.

Top-level skills at `<marketplace>/skills/<skill>/SKILL.md` load when either `<marketplace>@<marketplace>` or `<skill>@<marketplace>` is enabled (lines 145 to 157). The second key is a heuristic. It treats a skill directory name as a plugin name. It supports marketplaces that publish each skill as its own plugin, and it was the fix in their 2026-05-08 commit. It can also mis-key. Take a marketplace that holds both a plugin named `x` and an unrelated top-level skill directory named `x`. That skill appears whenever the plugin is enabled.

Top-level commands at `<marketplace>/commands/*.md` load only when `<marketplace>@<marketplace>` is enabled (lines 159 to 161). A marketplace that publishes top-level commands and separately keyed plugins never exposes those commands.

Plugin skills at `<marketplace>/plugins/<plugin>/skills/<skill>/SKILL.md` and plugin commands at `<marketplace>/plugins/<plugin>/commands/*.md` both load when `<plugin>@<marketplace>` is enabled (lines 163 to 179).

Three filters apply throughout. The code skips dot-prefixed names, and it skips the directory names `node_modules`, `build`, `dist`, and `out` (lines 9 and 24 to 28). It refuses symbolic links instead of a follow, for directories at line 44 and for files at line 52. The command scan is flat: it reads only `*.md` files directly inside a `commands/` directory (lines 48 to 54), so a namespaced subdirectory stays invisible.

The code never reads `plugin.json`. There is no manifest parse of any kind. The scan is purely conventional over a fixed directory layout, so a plugin that declares custom component paths in its manifest contributes nothing.

The extension factory registers two handlers (lines 185 to 221). `resources_discover` sorts the two path lists and returns them (lines 194 to 197). `session_start` runs the same discovery again and prints a count summary (lines 199 to 219).

Two properties of those handlers matter more than anything else in the file.

The `resources_discover` handler has no try/catch, so every failure underneath it propagates. `JSON.parse` throws on a malformed `settings.json` at line 86, and on a malformed `installed_plugins.json` at line 100. Any `readdir` failure other than `ENOENT`, such as `EACCES`, rethrows at line 36. One unreadable directory, or one stray comma in a settings file, therefore throws out of the handler on every Pi load. Our equivalent path wraps `applyReconcile` in a try/catch and surfaces one notification, and resource aggregation continues (`extensions/pi-claude-marketplace/index.ts:79-91`). That is the guarantee we record as NFR-2.

The `session_start` handler writes to stdout with `console.log` at lines 209 and 215, in addition to `ctx.ui.notify`. This is the subject of their one open pull request. Our own discipline forbids direct `process.stdout` writes in extension code and routes all user-visible output through a single notify seam.

The package declares no runtime dependencies, no `engines` field, and a peer range of `*` on `@earendil-works/pi-coding-agent`. There are no tests, no `tsconfig.json`, no lint configuration, and no CI workflow.

## Capability ratings

The matrices that follow state what each project does. This section rates how well.

The scale has four values:

- **Strong** -- market-leading. Deep, and well executed.
- **Adequate** -- functional. It does the job without differentiation.
- **Weak** -- present but limited, with significant gaps.
- **Absent** -- not available.

A rating judges the capability as a user meets it, not the elegance of the code behind it.

| Capability                         | pi-claude-plugins | pi-claude-marketplace |
| ---------------------------------- | ----------------- | --------------------- |
| Skills                             | Adequate          | Strong                |
| Slash commands                     | Weak              | Strong                |
| Agents                             | Absent            | Strong                |
| MCP servers                        | Absent            | Strong                |
| Hooks                              | Absent            | Strong                |
| Plugin acquisition                 | Absent            | Strong                |
| Works without Claude Code          | Absent            | Strong                |
| Setup cost for a Claude Code user  | Strong            | Weak                  |
| Live sync with Claude Code state   | Strong            | Absent                |
| Enablement without duplicate state | Strong            | Absent                |
| Scopes                             | Weak              | Strong                |
| Command surface                    | Absent            | Strong                |
| Declarative configuration          | Absent            | Strong                |
| Transactional install and rollback | Not applicable    | Strong                |
| Load-time failure containment      | Weak              | Strong                |
| Output discipline                  | Weak              | Strong                |
| Manifest fidelity                  | Absent            | Strong                |
| Path containment on writes         | Not applicable    | Strong                |
| Symlink refusal on reads           | Adequate          | Strong                |
| Auditability of the whole product  | Strong            | Weak                  |
| Tests and continuous integration   | Absent            | Strong                |
| Execution sandboxing               | Absent            | Absent                |

Six rows need a word of explanation.

**Skills** rates Adequate rather than Strong because the discovery works and stops there. It generates no names and handles no collisions, and the README hands both problems to Pi's loader.

**Slash commands** rates Weak rather than Adequate. Flat `*.md` files do load. The top-level gate at line 160 needs the `<marketplace>@<marketplace>` key, so a common marketplace layout yields no commands at all.

**Scopes** rates Weak rather than Absent because they do read Claude's scope field and match the project path (lines 113 to 120). They own no scope of their own. There is no way to expose a plugin in Pi that Claude Code has not already enabled.

**Setup cost** is the one row where they rate Strong and we rate Weak, and it is the most important row in the table. A user with Claude Code already configured needs one `pi install` for theirs. Ours needs a package install, plus a marketplace add, plus an install for each plugin.

**Auditability** rates Strong for them and Weak for us on the same evidence. A security reviewer can read their entire product in ten minutes. Ours is 57,552 lines across 202 files. That is a real advantage, and this document does not dismiss it.

**Transactional install** and **path containment** read Not applicable rather than Absent. They write nothing, so there is nothing to make atomic and nothing to contain.

## Capability matrix: component kinds

| Claude component | pi-claude-plugins                                                                 | pi-claude-marketplace                                                                            |
| ---------------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Skills           | Referenced in place -> `skillPaths` points at `~/.claude/...` (lines 153 and 173) | Copied whole -> `<extensionRoot>/resources/skills/<gen>/`, by `cp` and then an atomic `rename`   |
| Commands (slash) | Referenced in place -> flat `*.md` as `promptPaths` (lines 160 and 178)           | Translated -> Pi prompt template at `resources/prompts/<plugin>:<command>.md`                    |
| Agents           | **Not supported.** A declared non-goal in their README                            | Supported -> `<scopeRoot>/agents/...` and `agents-index.json`, with a tool map and `--map-model` |
| MCP servers      | **Not supported.** A declared non-goal in their README                            | Supported -> merged into `<scopeRoot>/mcp.json`, names kept verbatim                             |
| Hooks            | **Not supported.** A declared non-goal in their README                            | Supported -> staged `hooks/<plugin>/hooks.json` and in-memory routing, over 10 events            |
| Everything else  | Never examined. The code parses no `plugin.json`                                  | Surfaced as unsupported -> `partially-available`, installable with `--partial`                   |

One qualification applies. The in-place reference in their skills and commands rows is the design, not a shortcoming, and it buys them a property we lack. An edit to a skill in Claude's marketplace tree is live in Pi after `/reload`. Our staged copy needs an update or a reinstall before it refreshes. For the same reason, a `hooks.json` edit on our side needs a reinstall before `/reload` sees it.

## Capability matrix: command surface

This section is short because there is nothing to compare. They register no command, so there are no verbs, no flags, no aliases, no exit codes, and no completions. Their entire user interface is the package install, plus a `/reload` after any change in Claude Code.

Our surface is the `/claude:plugin` command with sixteen subcommands and a global `--scope` flag. The full table is in `docs/competitive-analysis/pi-plugins.md`. A repeat here adds length and no information.

## Capability matrix: source kinds

Cut, for the same reason. They acquire nothing, so they have no source kinds. Their only input is a directory tree that Claude Code populated.

## What they have that we do not

### No setup for a user who already runs Claude Code

Their install is one command and no configuration. Every plugin the user already enabled in Claude Code appears. Ours asks the user to add each marketplace and install each plugin again, even when the same plugins already sit on disk. Our `import` verb narrows this gap and does not close it, because import still performs real installs into our own tree.

### One source of truth for enablement

They hold no state. Claude Code's `installed_plugins.json` and `settings.json` decide what is enabled, and Pi follows on the next reload. A user who runs both hosts maintains one list.

We hold `state.json` for each scope. That same user maintains two lists, and the lists drift as soon as they enable a plugin in one host and forget the other. This is a real usability cost of our design, and no feature we ship today pays it back.

### Content that is always current

Their skill paths point into Claude's own tree, so an edit to a skill file is live after `/reload` and needs no other action. Our staged copies need an explicit update or reinstall. For a plugin author who iterates on a skill, theirs is the better loop.

### Auditability

The whole product is 221 lines of straightforward TypeScript with no runtime dependencies. A reviewer at a company with a supply-chain policy can read all of it in one sitting. Nobody can review ours that way at any price, and reviewers will notice.

### Nothing to recover

They have no transactions, because they have no writes. There is no partial install, no orphaned artifact, no lock contention, and no rollback that can itself fail. Our five-phase ledger, state lock, and reconcile pass exist to solve problems they do not have.

## What we have that they do not

### Three of the five component kinds

They translate skills and commands. Agents, MCP servers, and hooks are absent, and their README states all three as limitations. We translate all five. Take a user whose plugin ships an agent or an MCP server. Their extension appears to work and quietly delivers a fraction of the plugin.

### Independence from Claude Code

Everything they do needs a populated `~/.claude/plugins/marketplaces` tree, which only Claude Code creates. On a machine that never ran Claude Code their extension finds nothing and reports nothing found. We acquire marketplaces ourselves over git or a URL and install from them. Pi is therefore a complete host rather than a second view of another host.

### Acquisition, installation, and lifecycle

We have `install`, `uninstall`, `update`, `reinstall`, `fetch`, `enable`, `disable`, `list`, `info`, `pending`, `import`, and a `marketplace` verb family. They have none of these, by design.

### Declarative, portable configuration

Our `claude-plugins.json` and `claude-plugins.local.json` pair lets a user commit a plugin set to a repository. It then materializes on a teammate's machine. Their equivalent is to ask that teammate to install Claude Code and enable the same plugins by hand.

### Manifest fidelity

We parse `plugin.json` and read declared component paths. They parse no manifest at all. A plugin that does not follow the exact conventional layout therefore contributes nothing, and no diagnostic explains why.

### Load-time failure containment

Our `resources_discover` wraps reconcile and surfaces failures as one notification without a block on Pi load. We wrap the notify call itself, so a UI failure cannot propagate either (`extensions/pi-claude-marketplace/index.ts:79-91`). Theirs propagates a `SyntaxError` from a malformed settings file straight out of the handler.

### Configuration-directory parity

We read `CLAUDE_CONFIG_DIR` when it is absolute, fall back to `~/.claude`, and warn when the variable holds a relative path (`extensions/pi-claude-marketplace/orchestrators/import/settings.ts:32-48`). We also read project-scope Claude settings from `<cwd>/.claude/`. They read the user home directory only.

### Tests and gates

We ship 223 test files and enforce architecture boundaries as tests. One grep gate fails the build if an offline-guaranteed orchestrator gains a git import. They ship no tests, no lint configuration, and no CI.

## Their declared limitations

These are their own words in their README at the pinned commit, not our findings. They do not execute Claude plugin hooks or plugin runtime logic. They import only skills and flat command markdown. They do not import arbitrary plugin code, agents, hooks, or non-markdown command formats. They do not bridge Claude plugin MCP integrations or MCP servers. They also hand skill name uniqueness and collision behavior to Pi rather than own it. A warning about a name that does not match its parent directory comes from Pi's loader, and their README says so.

That list is accurate and complete, which is worth saying plainly. Their README describes their product honestly, and larger projects often do not.

## Where we are behind on our own terms

Against this competitor, only three of our self-recorded limitations are relevant, so this section is short. The full list is in `docs/competitive-analysis/pi-plugins.md`.

We have no passthrough or mirror mode. Every path into our product performs an install. A user who wants to see Claude's existing plugins without a copy on disk has no option.

We keep our own enablement state, so a user who runs both hosts maintains two lists that drift.

Our staged copies go stale against edits in the source tree until an update or a reinstall runs.

Everything else on our self-reported list is irrelevant here, because they have no counterpart to compare against. That includes the absent trust model, the missing automation surface, and the unconditional data-directory deletion on uninstall.

## Strengths and weaknesses

### Their strengths

The design is the strength, and it is a real one. Their choice of projection over installation does not solve whole categories of failure. It removes the ground those failures stand on. No state means no drift, no lock, no migration, and no reconcile. No writes means no rollback, no containment check, and no partial install. Their recovery procedure is to uninstall the package, and it is complete.

The setup cost is the strength a user feels. One command, and then every Claude plugin they already enabled shows up. They enable another in Claude Code, reload Pi, and it appears. There is nothing to learn, nothing to configure, and nothing to keep in sync.

Their README is honest. It lists what does not work and explains the plugin key mapping in detail with worked examples. It also tells the reader that collision warnings come from Pi rather than from the extension. Products of this size usually oversell.

### Their weaknesses

Three of five component kinds are missing, and the failure is quiet. A plugin whose value sits in an agent or an MCP server appears to install and delivers a fraction of itself, with no diagnostic.

The product cannot work alone. It is a view onto Claude Code, so it inherits Claude Code as a hard requirement and delivers nothing without it.

The reliability gap is narrow but real. A malformed settings file, or one unreadable directory, throws out of `resources_discover` on every load, because that handler has no try/catch. With no tests and no CI, nothing catches a regression of this kind before a user does.

The conventions are brittle at the edges. The code parses no manifest, so custom component paths stay invisible. The command scan is flat, so namespaced commands stay invisible. The `<skill>@<marketplace>` heuristic can mis-key, and the top-level command gate misses a common layout. The permissive `return true` at line 119 lets malformed entries through.

Finally, the maintenance signals are weak. Seven commits over four months, one open pull request from an outside contributor with an accurate bug report, and no response to it.

### Our strengths

We translate five component kinds to their two. The three they miss are the ones that make a plugin do work rather than supply text. We work without Claude Code, which makes Pi a host rather than a mirror. We acquire, install, update, and roll back under a transaction, and our load path catches its own failures rather than passes them up to Pi.

Our reach is larger on every measure. We took seven times the downloads over a shorter life. We hold seventeen stars to one, and two merged pull requests from outside humans against none.

### Our weaknesses

We are heavy where they are light, and for one segment of users that is the only thing that matters. A Claude Code user who wants their skills in Pi must repeat work they already did. Nobody can audit our 57,552 lines the way they can audit their 221.

We also hold duplicate enablement state with no reconciliation against Claude Code's own, and that is a defect rather than a trade. A user who enables a plugin in Claude Code has no way to tell us about it short of a full import.

## Opportunities

The clearest opening is the product mode they invented and we lack. A mirror or link mode exposes Claude's installed plugins in place, with no staged copies and no recorded state. It serves the dual-host user we currently force to choose. Our `import` orchestrator already reads Claude's settings files in both scopes, with `CLAUDE_CONFIG_DIR` support. The discovery half therefore exists, and only the projection half is missing. This work removes their advantage and keeps ours.

The second opening is positioning, and it costs writing time. Our package description names a category that their product can also claim. Two facts separate us in one line: we install without Claude Code, and we translate five component kinds. That line belongs at the exact point where a user compares two similar names in a search result.

The third is smaller and worth the effort anyway. Their weakest real behavior, quiet delivery of two component kinds of five, is invisible to the user. A short comparison page in our documentation states which components each approach carries. Users who choose correctly do not file confused issues against us.

## Threats

The distribution threat is mild. They took 358 downloads against our 2,547, and their own README install command does not work. They are not taking users from us in numbers we need to model.

The name threat is the real one, and it is durable. Two adjacent names in one registry generate confusion. Neither project can fix that with features, and the confusion costs the larger project more, because more traffic lands on it. This does not get better on its own, and it gets worse if either project grows.

The simplicity threat deserves attention, because it is structural rather than competitive. Their product proves that a large fraction of the perceived value, which is Claude skills visible in Pi, costs 221 lines. Any user who learns that will ask what our other 57,000 lines buy them. The answer is good, but we have to give it, and today we give it nowhere a prospective user reads.

The last threat is the mildest and the easiest for them. MCP and hook passthrough are not hard to add to a projection design, because both are file-based and they already walk the tree. If they ever do add them, the criticism about quiet partial delivery weakens a lot. Nothing in their commit history points that way.

## Strategic implications

### Build

A mirror mode, which exposes Claude's installed plugin set in place, with no staged copies and no state. This is the single item that answers this competitor completely.

A reconciliation report between Claude Code's enabled plugin set and ours. The dual-host user then sees the drift, even before we can fix it for them.

### Accelerate

The package description and README positioning change. It costs writing time, and it works on the exact search-result surface where the name collision does its damage.

### Deprioritize

Everything else about this competitor. There is no trust model to match, no automation surface to reach, and no security engineering to study. One read of their file, as this document did, is the correct total investment.

### Differentiate or reach parity

| Area                              | Stance        | Reason                                                    |
| --------------------------------- | ------------- | --------------------------------------------------------- |
| Component coverage                | Differentiate | They carry two kinds of five and say so                   |
| Independence from Claude Code     | Differentiate | Their product cannot exist without it                     |
| Declarative portable config       | Differentiate | They have no equivalent and cannot grow one without state |
| Setup cost for a Claude Code user | Parity        | A mirror mode closes it, and nothing else will            |
| Single enablement source          | Parity        | Duplicate state is our defect, not our trade              |
| Freshness of staged content       | Parity, later | A mirror mode solves it for the mirrored case             |
| Auditability                      | Do not chase  | We cannot win it, and tests are the answer to it          |

### Monitor

Whether MCP or hook passthrough ever appears in their tree. Whether the open pull request is merged, which is the cheapest signal of whether the project is maintained at all. Whether their download counts break out of the low hundreds. And whether name confusion starts to appear as issues filed against our repository, which is the first measurable cost of the collision.

## Prioritized recommendations

| #   | Recommendation                                        | Why this rank                                                                                                                 | Size            | Reuses on our side                                                 |
| --- | ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | --------------- | ------------------------------------------------------------------ |
| 1   | Package description and README positioning            | Costs writing time, answers the name collision where it does damage, and states two true differentiators that nobody sees now | Smallest change | The existing README and `package.json`                             |
| 2   | Mirror mode, exposing Claude's installed set in place | The only item that answers this competitor completely, and it removes a real cost we impose on dual-host users                | Milestone-sized | `orchestrators/import/settings.ts` and `orchestrators/discover.ts` |
| 3   | Claude-versus-Pi enablement drift report              | Makes the duplicate-state defect visible before we can remove it, and it extends `pending` naturally                          | Not stated      | The `pending` verb and the notification catalog                    |
| 4   | A component-coverage comparison page in our docs      | Helps users pick correctly, which reduces the confused issues that the name collision otherwise routes to us                  | Smallest change | `docs/` and the component tables in this document                  |

There is no fifth item. Nothing else in their product is worth taking, and a longer table only flatters the analysis.

## Appendix: methodology and verification status

This analysis comes from a read of both source trees. Nobody ran either project. The competitor side is `ross-jill-ws/pi-claude-plugins` at commit `554f19c1ad25a8219bc470f683824a9346530c8c`, which publishes `pi-claude-plugins` v0.2.0. Their whole product is one file, `extensions/index.ts`, at 221 lines, and this analysis read all of it rather than a sample. We also downloaded the published 0.2.0 tarball and compared it. It holds `package.json`, `README.md`, and `extensions/index.ts`, and that last file is byte-identical to the git HEAD. The tarball ships no LICENSE file, although `package.json` declares MIT.

Our side is `pi-claude-marketplace` at v0.13.0, at 57,552 lines across 202 TypeScript files, with 223 test files. We checked every claim about our own behavior against source at the paths cited inline.

The market signals come from a different method and carry a different confidence. Repository counts come from the GitHub REST API. Download counts come from the npm registry download API, for the 30-day window that ends 2026-08-09, plus three 7-day buckets that cover 2026-07-20 to 2026-08-09. We queried all of them on 2026-08-10. Positioning quotations come from published README files rather than from source. Treat every number in that section as a measurement with a shelf life of about a week.

Two claims in this document are UNVERIFIED. Nobody verified them against source, so do not rely on them:

1. The schema of Claude Code's `~/.claude/plugins/installed_plugins.json`. Their enablement gate assumes a `plugins` map of key to an array of entries that carry `scope` and `projectPath` (lines 11 to 18). We do not read that file, and nobody consulted Claude Code's own source. If the real schema differs, their scope filter is wrong in ways this document does not describe.
2. The behavior of Pi's `quietStartup` setting, and the `interactive-mode.js` line numbers cited in the external pull request against their repository. Nobody read Pi's own source. The underlying fact holds: their `session_start` handler writes to stdout unconditionally at lines 209 and 215.

If `pi-claude-plugins` publishes a new minor version or merges its open pull request, re-cut this document. At seven commits over four months, that can take a while.
