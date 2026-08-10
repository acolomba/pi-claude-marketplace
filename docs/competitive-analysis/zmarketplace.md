# Competitive analysis: zmarketplace

- **Analysis date:** 2026-08-10.
- **Subject:** repository `zico20047/zmarketplace`, commit `3e727e5eb2f6ec4db74c4243e23093950181d02c`, package `zmarketplace` v0.7.8, MIT, author zico20047.
- **Baseline:** `pi-claude-marketplace` v0.13.0, MIT.
- **Path convention:** competitor paths are relative to their repository root. Our paths are relative to the root of this repository.
- **Snapshot rule:** every claim about `zmarketplace` describes that one commit. A later release can differ.
- **Market signals:** the counts in the competitor overview come from the GitHub and npm APIs, queried on 2026-08-10 for the 30-day window that ends 2026-08-09.
- **UNVERIFIED items:** three claims in this document carry the mark UNVERIFIED. Nobody verified them against source. Do not rely on them.
- **Decision this informs:** whether to compete, to ignore, or to integrate.

## Executive summary

zmarketplace is not a plugin host. It is a search engine with an install button. It finds packages across six agent ecosystems and runs a heuristic security scan. It then gives a shell command to another installer.

It never reads a Claude plugin manifest and never translates a component. It writes exactly one file to disk: `~/.zmarketplace/history.json` (`src/core/history.ts:16-17`).

The correct classification is **complement**, not competitor. They own discovery and evaluation. We own installation and translation. The two products sit at different stages of one funnel, and neither does the job of the other at this commit.

The most interesting finding here is a broken seam rather than a competitive threat. Their Claude adapter already indexes 2,575 plugins from the two Anthropic catalogs (`src/registries/claude.ts:8-11`). Their installed-package detector already reads the `settings.json` file of Pi (`src/core/installed.ts:42-51`). But a user who selects a plugin from the Claude marketplace gets an install menu with `claude plugin install npm:<name>` and no Pi option (`src/index.ts:229`). A Pi user can find 2,575 Claude plugins in that tool and install none of them into Pi. We are the missing path. One entry in their ecosystem loop connects the two products.

Their engineering has real quality in small places. The product has zero runtime dependencies across 2,459 lines of source. Every `fetch` call carries a timeout. `Promise.allSettled` isolates a dead registry, so one failure never breaks a search. Their tar reader guards against gzip bombs before decompression. Their source scanner precomputes line offsets, after a naive version blocked their CI for 46 minutes (`src/core/audit.ts:64-79`).

Their audit is the weak part, and it fails in both directions at once. An audit of a Claude marketplace plugin gives a green verdict with no scan behind it, because the plugin name is not an npm package and the code still reports `deepScanned: true` (`src/core/audit.ts:218`, `src/core/audit.ts:301`). An audit of an ordinary package gives the opposite error. Our own tree matches `rm -rf`, `fs.rm(`, `eval(`, and `spawn(`. The weights push that verdict to critical, and their CLI refuses the install (`src/cli.ts:122-126`).

Three of their seven registries return nothing today. The Smithery endpoint answers 404. The official MCP registry moved its response shape, so every result parses as `"unknown"`. The pi-dev adapter is a declared stub.

The project is quiet. The last commit is 2026-07-18 and the last npm publish is 2026-07-17. That is more than three weeks with no activity. Registry adapters are the code that decays first when upstream APIs move.

The action here is integration rather than a build plan. We must build one thing for ourselves: a discovery surface. We have none today, and this competitor is the evidence that the gap matters.

## Classification: complement

The brief asked for an honest classification. The evidence supports **complement**, with a narrow adjacency at one surface.

**Not a direct competitor.** A direct competitor installs a Claude plugin into Pi. Their product does not. Their install path builds a command string and gives it to another program (`src/core/install.ts:29-38`, `src/index.ts:223-241`). The targets are `pi install npm:<name>`, `claude plugin install npm:<name>`, `opencode plugin <name>`, `gemini extension install <url>`, and `codex plugin add npm:<name>`, plus npm, bun, pnpm, and bunx. For Pi that command installs an npm package as a Pi extension. That is the package installer of Pi, not a plugin host, and it cannot install a Claude plugin at all.

**Not a substitute.** A substitute lets a user skip us. Nothing in their tree reads `.claude-plugin/plugin.json` from a plugin. Nothing enumerates `skills/`, `commands/`, `agents/`, or `hooks/`. Nothing writes an artifact into a Pi scope. Their Claude adapter reads two `marketplace.json` catalogs and copies out the `name`, `description`, `version`, `author`, `homepage`, `repository`, and `license` fields (`src/registries/claude.ts:60-72`). It never follows the `source` field to the plugin itself.

**Adjacent at exactly one surface.** Both projects read the Claude marketplace catalog. We read it to resolve and materialize a plugin. They read it to list a name. That is one input for two different purposes, which is adjacency rather than overlap.

**Complement, on the funnel argument.** The user journey has four stages: find, evaluate, install, and run. They cover find and evaluate across six ecosystems. We cover install and run for one. The handoff between the two halves exists in their code already, but it targets the wrong host. That is a defect rather than a strategy.

One caveat keeps this from a pure complement. They read the installed-package list of Pi (`src/core/installed.ts:42-51`) and offer an update check against npm. If that surface grows to read Claude plugin state, the classification moves toward adjacent. Nothing at this commit shows that intent.

The rational move is integration. The section "The integration case" states it concretely.

## Competitor overview

### The project

zmarketplace ships from one repository with three entry points into one shared core. `src/index.ts` registers a `/zmarketplace` slash command for Pi and for omp. `src/cli.ts` is a standalone command that runs as `bunx zmarketplace`. `src/opencode.ts` is an OpenCode tool that adds no logic and calls the CLI (`src/opencode.ts:24`).

The source is 2,459 lines across 19 TypeScript files. Tests add 358 lines across 5 files, with about 75 `ok()` assertion sites and a hand-written runner instead of a test framework. There are no runtime dependencies. The development dependencies are `typescript` and `@types/bun`.

Development is one person. The GitHub API reports a single contributor with all 45 commits, no forks, and no pull requests of any kind.

### The Bun requirement

The package declares `engines.bun >= 1.1.0` and no `engines.node` at all. The CLI carries a `#!/usr/bin/env bun` shebang. The file `tsconfig.json` sets `types: ["@types/bun"]`, and the OpenCode tool runs `bunx zmarketplace`.

For a Pi user on Node the picture is mixed. The Pi extension path imports only `node:child_process`, `node:fs`, `node:os`, `node:path`, and `node:zlib`, plus the global `fetch` and `AbortSignal.timeout`. Their `AGENTS.md` states the rule directly: no `Bun.*` APIs, so the same sources run under Bun and under Node. A read of the source found no Bun global anywhere. Whether the extension path loads and runs correctly under Node in a live Pi session is UNVERIFIED, because nobody ran it.

The CLI and OpenCode paths need Bun on `PATH`. A Pi user without Bun therefore keeps the slash command and loses `bunx zmarketplace`.

One consequence follows directly. Their `package.json` declares no dependency, peer or otherwise, on `@earendil-works/pi-coding-agent`. They type against hand-written interfaces in `src/index.ts:21-29`. There is no compatibility signal of any kind, and the API drift described later in this document is what that costs them.

### Recent momentum

Both projects are small. This table shows direction, not market share.

| Signal, measured 2026-08-10                         | zmarketplace              | pi-claude-marketplace           |
| --------------------------------------------------- | ------------------------- | ------------------------------- |
| First npm publish                                   | 2026-07-14                | 2026-05-12                      |
| Versions published                                  | 10                        | 35                              |
| Latest version                                      | 0.7.8, on 2026-07-17      | 0.13.0, on 2026-08-05           |
| Days since last publish                             | 24                        | 5                               |
| Last commit                                         | 2026-07-18                | 2026-08-09                      |
| npm downloads, 30 days to 2026-08-09                | 1,741                     | 2,547                           |
| Weekly downloads, 3 buckets of 7 days to 2026-08-09 | 79 -> 62 -> 77            | 623 -> 651 -> 924               |
| Peak download day                                   | 2026-07-14, on launch day | 2026-08-09, the most recent day |
| GitHub stars                                        | 1                         | 17                              |
| GitHub forks                                        | 0                         | 8                               |
| Contributors                                        | 1                         | 4, of whom 2 are external       |
| Pull requests, all states                           | 0                         | 2 merged from outside           |
| Open issues                                         | 0                         | 0                               |

Two readings follow.

First, the download totals hide the shape. Their 30-day total of 1,741 is 1,444 downloads in the first four days and 297 across the other 26 days. Their peak day is launch day. Our numbers rise across all three weekly buckets, and our peak is the most recent day measured. Their curve is a launch spike that fell to about 10 downloads a day. Our curve is a baseline that grows.

Second, the repository has no description, no topics, no homepage, one star, and no issues. Ten versions all shipped inside four days in mid-July, and nothing has shipped since. This project launched, published quickly, and then stopped.

### How much to trust these numbers

npm counts include mirrors, continuous integration, and bots. Neither figure is a user count. A four-week window is short, and one of the two projects was dormant for three of those four weeks. The comparison of trend direction is therefore more reliable than the comparison of totals. The GitHub field `open_issues_count` combines issues and pull requests. Our value reads 1 because of an open dependency-bump pull request, and the true open-issue count is 0 on both sides. Absence of stars is weak evidence about quality and stronger evidence about reach.

## Positioning analysis

### Positioning statements

Their npm description reads: "Cross-agent marketplace search: find, audit, and install plugins/skills/themes/prompts across pi, omp, claude code, opencode, gemini cli, and codex."

Cast into the standard template:

> For **users of any agent CLI who do not know what is available**, `zmarketplace` is a **cross-ecosystem package search and audit tool** that **finds a package once and gives the correct install command to the target agent**. Unlike a plugin host, it **owns no state and installs nothing itself**.

Our repository description reads: "Access Claude plugin marketplaces from Pi Coding Agent."

Cast into the same template:

> For **Pi users who already own Claude Code plugins**, `pi-claude-marketplace` is a **Claude plugin marketplace client for Pi** that **makes every supported Claude component work as a Pi-native artifact**. Unlike a search tool, it **resolves, materializes, and maintains the plugin**.

### Message architecture

| Level             | zmarketplace                                             | pi-claude-marketplace                                                           |
| ----------------- | -------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Category          | Cross-agent package discovery                            | Claude marketplace access for Pi                                                |
| Differentiator    | Breadth of index, and a pre-install audit gate           | Fidelity of translation, and alignment with upstream                            |
| Value proposition | Search once, see everything, get the correct command     | Install a Claude plugin and have every supported component work after `/reload` |
| Proof points      | Six live sources, zero dependencies, a three-layer audit | Component coverage, gate-enforced offline guarantees, a byte-exact catalog      |
| Owns state        | No, apart from search history                            | Yes, `state.json` per scope under a cross-process lock                          |

### Why the two positions do not collide

Our category name implies a plugin lifecycle. Their category name implies a catalog. A user who wants to install a Claude plugin into Pi never chooses a search tool. A user who wants to know what exists never chooses an installer. The two claims do not contest the same words.

The one word both projects use is "marketplace", and it has two meanings. For them a marketplace is a source of search results. For us a marketplace is a named, added, versioned record with a clone, a manifest cache, and a set of installable plugins. A user who meets both products feels the collision in the vocabulary before the products.

That vocabulary collision is the only positioning risk here, and it is small.

## What the code does

### Discovery

`src/core/search.ts:73-126` fans out to seven registry adapters with `Promise.allSettled`. It then filters by type and ecosystem, deduplicates by lowercase name, scores by match quality, and cuts to the limit. A rejected adapter drops silently, so a dead source gives fewer results rather than an error.

The npm adapter sends one search request per ecosystem keyword in parallel (`src/registries/npm.ts:119-133`), because npm search does not handle OR queries well. Ecosystem and type then come from keywords and from substrings of the package name (`src/registries/npm.ts:47-83`).

The Claude adapter fetches two catalogs from GitHub raw: `anthropics/claude-plugins-official` and `anthropics/claude-plugins-community` (`src/registries/claude.ts:8-11`). Measured on 2026-08-10, these hold 284 and 2,291 plugins. The adapter filters by substring against name and description, then stops at the limit. It walks the official catalog first. There is no rank inside a catalog and no pagination, so a default search never reaches the community catalog unless the official one gives fewer matches than the limit.

The other adapters cover the Gemini CLI extensions registry at `geminicli.com/extensions.json` (1,437 entries measured, cached 5 minutes), the official MCP registry, Smithery, GitHub topic search across six agent topics, and a pi-dev stub that returns an empty array by design (`src/registries/pi-dev.ts:11-13`).

### Evaluation

`getDetail` fetches npm metadata and the README from the packument (`src/core/detail.ts:9-43`). The Pi command shows the README inline, 14 lines per page, with images and links rewritten into openable URLs (`src/index.ts:116-152`).

The audit has three layers (`src/core/audit.ts`). Layer 1 reads npm metadata. It flags more than 20 dependencies, more than 10 MB unpacked, more than 500 files, a missing license, and any of seven lifecycle scripts. Layer 2 downloads the tarball, guards the compressed size at 50 MB, gunzips, and guards again. It then parses the tar with a hand-written POSIX and GNU reader. It matches four tiers of regular expressions against `.ts`, `.js`, `.mjs`, `.cjs`, `.tsx`, and `.jsx` files only. Layer 3 fetches a Socket.dev supply-chain score when `SOCKET_API_KEY` is set.

Risk is a weighted sum: critical 100, high 25, medium 5, low 1, with thresholds at 100, 50, 15, and 5 (`src/core/audit.ts:49-120`). Findings deduplicate by matched text per severity, first per file and then per package.

### Installation

There is no installation. `doInstall` validates the package name against `/^[a-z0-9._@/\-]+$/i`, runs an audit, and builds a menu of per-ecosystem command strings. It asks for confirmation twice when risk is high. It then runs the selected string through `spawn(command, { shell: true })` (`src/index.ts:198-274`). The CLI does less: it prints the command and exits (`src/core/install.ts:98-111`).

Nothing is translated, staged, committed, or recorded. There is no scope model, no lock, no transaction, and no reconcile. The only durable write in the product is search history at `~/.zmarketplace/history.json`. That file is written with a temporary file and `renameSync`, and it is capped at 100 entries (`src/core/history.ts:30-47`).

## Capability ratings

The scale has four values. **Strong** is market-leading, deep and well made. **Adequate** is functional without a differentiator. **Weak** is present but limited. **Absent** is not available.

A rating judges the capability as a user meets it, not the elegance of the code behind it. Most rows below read Absent on one side or the other. That result is itself the finding: these are two different products.

| Capability                           | zmarketplace   | pi-claude-marketplace |
| ------------------------------------ | -------------- | --------------------- |
| Cross-ecosystem package search       | Adequate       | Absent                |
| Ranked results and relevance scoring | Adequate       | Absent                |
| Browse and popular listings          | Adequate       | Absent                |
| README preview in the terminal       | Strong         | Absent                |
| Pre-install security audit           | Weak           | Absent                |
| Machine-readable output              | Adequate       | Absent                |
| Search history                       | Adequate       | Absent                |
| Installed-package detection          | Weak           | Strong                |
| Update availability check            | Weak           | Adequate              |
| Claude plugin resolution             | Absent         | Strong                |
| Claude component translation         | Absent         | Strong                |
| Partial install and soft degradation | Absent         | Strong                |
| Transactional install with rollback  | Absent         | Strong                |
| Scope model                          | Absent         | Strong                |
| Cross-process locking                | Absent         | Strong                |
| Self-healing reconcile               | Absent         | Strong                |
| Offline guarantees                   | Absent         | Strong                |
| Path containment on writes           | Not applicable | Strong                |
| Desired-state configuration          | Absent         | Strong                |
| Multi-agent reach                    | Strong         | Absent                |
| Interactive selection UI             | Adequate       | Weak                  |
| Execution sandboxing                 | Absent         | Absent                |

Four rows need an explanation.

**Pre-install security audit** rates Weak rather than Adequate because the mechanism fails in both directions, as the defects section shows. The instinct is correct and the implementation is not yet reliable.

**Installed-package detection** rates Weak against Strong. Their detector reads two hard-coded paths and does not honor `PI_CODING_AGENT_DIR`. Ours is the authoritative per-scope state that the product maintains.

**Path containment** reads Not applicable for them because they write one file to a fixed path under the home directory. There is no attack surface to contain.

**Interactive selection UI** rates Adequate against Weak. Their surface is real: paged selection lists, a detail view, a README pager, and confirmation dialogs, all through `ctx.ui`. Ours is a tab-completion provider and nothing else.

## Capability matrix: the Claude plugin lifecycle

This table makes the classification concrete.

| Claude plugin operation                   | zmarketplace                                                      | pi-claude-marketplace                               |
| ----------------------------------------- | ----------------------------------------------------------------- | --------------------------------------------------- |
| Read a marketplace catalog                | Yes, two hard-coded Anthropic URLs (`src/registries/claude.ts:8`) | Yes, any added marketplace, git or path source      |
| Add or remove a marketplace               | No                                                                | Yes, per scope, with a clone and a manifest cache   |
| Resolve a plugin from a catalog entry     | No                                                                | Yes, discriminated `installable` union              |
| Read `plugin.json`                        | No                                                                | Yes                                                 |
| Translate skills                          | No                                                                | Yes, into `resources/skills/`                       |
| Translate slash commands                  | No                                                                | Yes, into `resources/prompts/`                      |
| Translate agents                          | No                                                                | Yes, into `<scopeRoot>/agents/` plus an index       |
| Translate MCP servers                     | No                                                                | Yes, merged into `<scopeRoot>/mcp.json`             |
| Translate hooks                           | No                                                                | Yes, 10 events, with an `if:` compiler              |
| Install into Pi                           | No, it offers `claude plugin install npm:<name>` instead          | Yes, transactional, with rollback                   |
| Enable, disable, update, reinstall        | No                                                                | Yes                                                 |
| Import the installed plugin set of Claude | No                                                                | Yes, from `settings.json` and `settings.local.json` |
| Recover after a partial failure           | Not applicable                                                    | Yes, `applyReconcile` on `resources_discover`       |

Twelve of thirteen rows read No. A scorecard is the wrong frame for that. It is what two different products look like when you put them side by side.

## What they have that we do not

### A discovery surface

This is their whole advantage, and it is genuine. A user who does not already know a marketplace URL cannot start with us. Our `bootstrap` verb adds one known marketplace, and that is our entire onboarding path. After that, `list --remote` shows the plugins declared by marketplaces the user already added, and `info` describes one plugin by name. There is no search, no rank, no browse, no popularity signal, and no way to ask which Claude plugins do code review.

Their answer to that question takes one command and returns ranked results from every source that still works.

### README preview at the point of decision

Their detail view pages a rendered README inside the terminal. It rewrites markdown images and links into openable URLs, and it marks packages the user already has (`src/index.ts:116-152`). Our `info` verb shows a resolved source, components enumerated from disk, and a resolver verdict. Our surface is more accurate about what happens next. Their surface is more useful for a decision about whether to care.

### A pre-install gate by default

Their install flow audits first and asks for an extra confirmation at high or critical risk. The CLI refuses outright and exits 1 (`src/cli.ts:122-126`). The implementation is faulty, but the product instinct is correct, and no other product in this market offers anything here. We trust plugin code on install, with no signature, no checksum against a trusted digest, and no disclosure of what the plugin does.

### Reach across six agent ecosystems

They index and dispatch for pi, omp, Claude Code, OpenCode, Gemini CLI, and Codex, from three entry points. We serve one host. The reach is shallow, because dispatch is a command string, but it is reach we do not have.

### Search history

Their history is persistent, atomic, capped at 100 entries, and replayable from the interactive list (`src/core/history.ts`). We keep no user-facing history of any kind.

## What we have that they do not

We have everything below the discovery layer.

We resolve a Claude plugin, read its manifest, and translate five component kinds into Pi-native artifacts. We install under a five-phase transactional ledger with symmetric undo, so a failure in the MCP phase unwinds the skills, commands, agents, and hooks already committed. We hold a cross-process advisory lock over the `state.json` file of each scope while we do it. We support two scopes, `user` and `project`, with independent records. We contain every write inside a branded `ScopedLocations` bundle and refuse any path outside it.

We degrade rather than refuse. An unsupported component kind marks the plugin `partially-available`, and `--partial` installs the rest. An absent companion extension degrades in presentation instead of a failure.

We recover without a restart. `applyReconcile` on `resources_discover` diffs desired state against disk and re-materializes what is absent, so `/reload` alone is the whole recovery story.

We enforce our offline promise with a build gate rather than a convention. `tests/architecture/no-orchestrator-network.test.ts` greps the orchestrators for git surfaces and fails the build.

We carry a desired-state configuration in `claude-plugins.json` and `claude-plugins.local.json` that a user can commit and share. We also import the installed plugin set of Claude Code from `settings.json` and `settings.local.json`.

None of this exists on their side, and none of it is a gap on their side, because they do not try to do it.

## Defects and limitations found in their source

These are our findings against their code at this commit, not their self-documented limitations. They publish no limitations document.

### The audit reports a clean scan that never ran

`auditPackage` looks the package up on npm first (`src/core/audit.ts:162`). A Claude marketplace entry name is not an npm package name, so `getNpmPackageMeta` returns null and `latestVersion` is undefined. The guard `if (meta && latestVersion)` at line 168 then skips Layer 1. The guard `if (deepScan && latestVersion)` at line 218 skips Layer 2. With no findings, `computeRisk([])` returns `"safe"` (line 120). The report still sets `deepScanned: deepScan`, which is `true` (line 301).

The Pi command shows that as `✅ Risk: SAFE` on one line and `Deep scan: yes` on the next (`src/index.ts:178-179`).

So the user audits a Claude plugin, learns that a deep scan found nothing, and no scan ran. This is the most serious defect in the tree, and it falls on the exact ecosystem we care about. A silent no-op is the better failure here, because a silent no-op never tells the user that the plugin is clean.

### The audit calls ordinary packages critical

The critical tier is `rm -rf`, `rimraf`, `fs.unlink`, `fs.rmdir`, and `fs.rm`, each weighted 100 (`src/core/audit.ts:12-18`, `src/core/audit.ts:49-55`). One match anywhere in a package reaches the critical threshold alone. The high tier adds `eval`, `new Function`, `execSync`, `execFile`, and `spawn` at 25 each. The medium tier flags `process.env` and `child_process` at 5.

Measured against our own published tree, `rm -rf` matches, `fs.rm(` matches, `eval(` matches twice, and `spawn(` matches six times. That is before any medium or low tier counts. Our score passes 100 several times over. Their CLI therefore prints "HIGH RISK" and exits 1 rather than an install (`src/cli.ts:122-126`).

A scanner that reports safe for the packages it cannot read, and critical for the packages it can, is worse than no scanner. It inverts the signal at the exact point where a user depends on it.

### Three of seven registries return nothing

Probed on 2026-08-10:

- `https://api.smithery.ai/v1/servers` answers 404. The live endpoints are `api.smithery.ai/servers` and `registry.smithery.ai/servers`. The adapter catches the failure and returns an empty array (`src/registries/smithery.ts:48-50`).
- The official MCP registry now nests each entry under a `server` key and returns `metadata` rather than `next_cursor`. Their adapter reads `srv.name` and `srv.description` at the top level (`src/registries/mcp.ts:44-45`). Every entry therefore parses as `"unknown"` with an empty description. Pagination also stops after the first page, because `data.next_cursor` is undefined (line 69). A real query filters these results out. An empty query collapses them to one row named "unknown" during deduplication.
- The pi-dev adapter is a declared stub that returns an empty array (`src/registries/pi-dev.ts:11-13`).

The `Promise.allSettled` design that makes their search fault-tolerant also hides all three faults. The user sees fewer results and never an error.

### An unvalidated remote field reaches a shell

`doInstall` validates the package name against a character class before anything else (`src/index.ts:198`). The Gemini install command then interpolates `pkg.repository`, which is unvalidated data from a remote registry, into the command string (`src/index.ts:231`). The selected string runs through `spawn(command, { shell: true })` (`src/index.ts:268`).

The exposure is bounded, because the user must select the Gemini option and confirm. But the guard that exists for the name does not extend to the repository URL, and nothing in the source suggests the difference is deliberate.

### The Pi status API is called with the wrong arity

Pi declares `setStatus(key: string, text: string | undefined): void`. Their local interface declares `setStatus?(message: string): void` (`src/index.ts:26`), and every call site passes one argument. Under the signature of Pi, that call sets a status keyed by the message text, with an undefined value. Whether the status line therefore never appears in a live session is UNVERIFIED. The signature mismatch is certain, and it is the exact failure mode that a missing peer dependency invites.

### Documentation drifts from code in six places

The README shows a demo at `assets/demo.gif`. No `assets` directory exists at this commit. The README and `AGENTS.md` both describe 50 results per page, while `PAGE_SIZE` is 15 (`src/index.ts:70`). The README claims about 800 Claude plugins and about 993 Gemini extensions, against 2,575 and 1,437 measured. The file `package.json` says version 0.7.8, while `.claude-plugin/plugin.json`, `.codex-plugin/plugin.json`, and `gemini-extension.json` all say 0.3.0. The header comment on `installPackage` reads "Never auto-installs" (`src/core/install.ts:69`), while the shipped slash command does auto-install through `spawn`. Their code is the reliable source, not their documentation.

### Ecosystem detection is a substring guess

`detectEcosystems` tags any package whose name contains `pi-` as both pi and omp. It tags any package whose name contains `claude` as Claude (`src/registries/npm.ts:52-56`). A package named `api-client` therefore appears to the user as a Pi package. That precision cost falls on the exact ecosystem filter a Pi user selects first.

## Where we are behind on our own terms

This section is narrow, because the comparison is narrow. Against a discovery tool, our discovery gaps are the only ones that count.

We have no search of any kind. A user must know a marketplace before we can help, and `bootstrap` is our whole answer to the question of how to start. We have no rank, no popularity signal, no browse, and no cross-marketplace query. Our `info` verb is network-free by design, so a plugin with a cold clone shows `(remote)` and `components: not resolved` unless the user passes `--fetch`. That behavior is correct and it makes a poor evaluation experience.

We disclose nothing about what a plugin does before it does it. We have no audit, no signature check, no checksum against a trusted digest, and no summary of the hooks a plugin registers or the MCP servers it launches. We trust plugin code on install.

We are Claude-only and single-host. We show no README. We keep no history. Our interactive surface is a tab-completion provider and nothing more.

The fuller self-reported list covers hook events, source kinds, and accepted residual risks. It sits in the analysis of `@nklisch/pi-plugins` and is not repeated here.

## Strengths and weaknesses

### Their strengths

The idea is good, and no other product in this comparison has it. One query across npm keywords, two Anthropic catalogs, the Gemini registry, the MCP registry, Smithery, and GitHub topics answers a question that no plugin host answers.

The restraint is real: zero runtime dependencies across 2,459 lines, a hand-written tar reader instead of a dependency, and a buildless `.ts` distribution. Every `fetch` call carries an explicit timeout, and `Promise.allSettled` isolates every adapter.

Some of the small engineering is careful. The gzip-bomb guard runs before decompression and again after it (`src/core/audit.ts:225-255`). The source scanner precomputes line offsets and binary-searches them, with a comment that records how the naive version blocked their CI for 46 minutes (`src/core/audit.ts:64-79`). Findings deduplicate per file and again per package to stop count inflation. History writes atomically and copies a corrupt file before it overwrites it. The audit cache is an LRU with promote-on-get, proven by a unit test.

The pre-install audit gate, whatever its accuracy today, is a product instinct that the rest of this market does not have.

### Their weaknesses

The audit inverts its own signal. It reports green where it scanned nothing and critical where it scanned normally. That is the headline.

Almost half the index is dead. Smithery answers 404, the MCP registry parses as "unknown", and pi-dev is a stub. The fault-isolation design hides all three from the user.

The project has stopped, and the kind of code it contains is the kind that decays fastest without attention. Twenty-four days have passed since the last publish. Two of the three broken adapters broke because an upstream API moved under them.

There is no compatibility contract with any host: no peer dependency on Pi, only hand-written interface copies, and one arity mismatch already visible in the tree. There is no state, no test suite beyond 75 assertions, and no CI gate except a typecheck and one smoke run. The repository has one star.

### Our strengths

We do the part that is hard to do correctly, and we do it under guarantees. We translate five component kinds. We run a transactional ledger with symmetric undo, a cross-process lock, two scopes, path containment on every write, and recovery through `/reload` alone. Our offline promise fails the build when it breaks. Our output vocabulary is a closed set, gated byte-for-byte against `docs/output-catalog.md`.

We are also the only product in this comparison that a user can adopt without a break from Claude Code, because we import the plugin set they already have.

### Our weaknesses

We have no answer to the question of what exists. This competitor makes that gap visible, and it is real. A user who arrives without a marketplace URL cannot use us at all.

We disclose nothing before we install, which is the other half of the same problem. A user asked to trust a plugin gets no aid with the decision.

We show no README, keep no history, have no interactive selection, and serve one host. Every one of those is a discovery-side gap. Together they describe a product with an excellent engine and no shop window.

## The integration case

The seam already exists in their code, and it targets the wrong host.

Their Claude adapter gives results with `ecosystems: ["claude"]` (`src/registries/claude.ts:65`). Their install menu maps that ecosystem to `claude plugin install npm:${pkg.name}` (`src/index.ts:229`). Two things are wrong with that line. It targets Claude Code rather than the host that the user runs. It also treats a marketplace plugin name as an npm package name, which it is not. Their own adapter computes a more plausible command at `src/registries/claude.ts:71`, and the interactive path discards it.

The fix on their side is one entry in the ecosystem loop. If the result came from `claude-marketplace` and the host is Pi, offer `/claude:plugin install <plugin>@<marketplace>` instead. They already know the source catalog of every entry, because `source` is on every result.

What each side gains is asymmetric but real. They gain a working Pi install path for 2,575 catalog entries that have no destination today, which repairs the largest hole in their product. We gain a discovery front end that we did not build, aimed at our install path, for the cost of a pull request.

Two risks come with this. Their project is dormant, so a pull request can sit unmerged for a long time. Their audit also runs against the plugin before the handoff, and a green verdict on an unscanned Claude plugin attaches our name to a false assurance. Both facts shape how we approach them rather than whether we do. A fix for the `deepScanned` flag is a two-line change that we can offer in the same pull request.

Competition instead of integration is the weaker option. A cross-ecosystem search means maintenance of six registry adapters, against APIs that already broke three of theirs in less than a month, to serve five ecosystems that we do not support.

## Opportunities and threats

The opportunity is asymmetric and cheap. Two pull requests against a dormant repository connect their index to our installer and correct the audit flag that misreports Claude plugins. Neither is our code to maintain afterward.

The second opportunity is ours alone to build: a discovery surface for the Claude marketplaces that we already read. We hold the parsed manifests in `domain/manifest-cache.ts` and a completion cache already. A `search` verb over added marketplaces, and optionally over the two Anthropic catalogs, is a small feature against machinery that we own. Their existence is the evidence that the gap matters.

The third is pre-install disclosure, which means a statement rather than a scanner. State what the plugin writes, which hooks it registers on which events, and which MCP servers it launches, all derived from resolver output that we already compute. That answers the question their audit tries to answer, and it answers from facts rather than from pattern matches.

The threats section is short because there is little to put in it. This project does not install Claude plugins, holds no state, has one star, and last shipped 24 days ago. It cannot displace us, and it shows no sign of an attempt.

Two second-order risks still need tracking. If discovery becomes the entry point for agent packages, the owner of discovery steers the install choice, and that surface offers Pi users no Claude path today. Their audit also renders a verdict on our package whenever a user asks. On current weights that verdict is critical, and their CLI refuses the install. Neither risk is about their product beating ours. Both are about their product describing ours to a user.

## Strategic implications

### Build

Build a `search` verb over added marketplaces, ranked and filterable, that reuses the manifest cache. Then build pre-install disclosure from the resolver: writes, hooks, and MCP servers, stated before the install runs.

### Accelerate

Nothing on their account. The discovery gap was worth a fix before this competitor existed. They are evidence, not a deadline.

### Deprioritize

Deprioritize a cross-ecosystem index. Maintenance of six registry adapters, to serve five hosts we do not support, is the wrong trade, and three of their seven adapters are already broken. Deprioritize a source scanner built on regular expressions, for the reasons in the defects section.

### Differentiate or reach parity

| Area                      | Stance        | Reason                                                           |
| ------------------------- | ------------- | ---------------------------------------------------------------- |
| Claude plugin translation | Differentiate | They do none of it and do not try                                |
| Transactional install     | Differentiate | No comparable machinery exists on their side                     |
| Claude migration          | Differentiate | Still unclaimed by anyone in this market                         |
| Discovery and search      | Parity        | We have nothing, and the gap blocks first use                    |
| Pre-install disclosure    | Differentiate | Answer their question from facts rather than regular expressions |
| Cross-ecosystem reach     | Do not chase  | Five of six hosts are outside our scope                          |
| Heuristic source scanning | Do not chase  | Their own weights invert the signal                              |
| Interactive selection UI  | Parity, later | Milestone-sized, and tracked in the pi-plugins analysis          |

### Monitor

Monitor whether they publish again. Twenty-four days of silence in a tree of registry adapters is the signal that matters most. Monitor whether a Pi install option appears for `claude`-sourced results, and whether the `deepScanned` flag is corrected. Monitor whether their installed-package detector grows to read Claude plugin state, which moves the classification from complement toward adjacent. Monitor whether any Pi-facing discovery surface, theirs or another, gains real adoption.

## Prioritized recommendations

| #   | Recommendation                                                     | Why this rank                                                                                                                                  | Size            | Reuses on our side                                                   |
| --- | ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- | --------------- | -------------------------------------------------------------------- |
| 1   | Open a pull request that adds a Pi install path for Claude results | Highest return per unit of work here. It repairs their largest hole and aims their index at our installer. It costs one file on their side     | Smallest change | Our existing `/claude:plugin install <plugin>@<marketplace>` grammar |
| 2   | Report the `deepScanned` defect, with a fix in the same request    | Their audit tells users that unscanned Claude plugins are clean. That false information falls on our ecosystem                                 | Smallest change | Nothing. It is their two-line fix                                    |
| 3   | Add a `search` verb over added marketplaces                        | It closes the one real capability gap this analysis found on our side, and that gap blocks first use today                                     | Not stated      | `domain/manifest-cache.ts` and the completion cache                  |
| 4   | Add pre-install disclosure of writes, hooks, and MCP servers       | It answers the question their audit asks, from resolver facts rather than pattern matches                                                      | Not stated      | The resolver verdict and the `info` rendering path                   |
| 5   | Extend `search` to the two Anthropic catalogs without an add       | It removes the barrier that a user must know a marketplace first                                                                               | Not stated      | The marketplace manifest reader                                      |
| 6   | Verify that our own npm keywords surface us in their index         | A cheap check. Our keywords include `pi-package` and `claude-code`, so their detector must tag us, but nobody verified it against a live query | Smallest change | `package.json` keywords                                              |

One recommendation sits outside the table, because it is not a build item. If a partnership does not happen, the discovery gap still needs a fix on its own merits, and items 3 and 5 are still valid alone.

## Appendix A: headline metrics

| Metric               | Them                                                    | Us                                                          |
| -------------------- | ------------------------------------------------------- | ----------------------------------------------------------- |
| Source size          | 2,459 LOC over 19 `.ts` files                           | 57,552 LOC over 202 `.ts` files                             |
| Tests                | About 75 `ok()` assertions over 5 files, custom runner  | 3,051 test sites over 223 files, `node:test`                |
| Runtime floor        | `engines.bun >= 1.1.0`, no `engines.node` declared      | `engines.node >= 20.19.0`                                   |
| Distribution         | Buildless `.ts`, `tsc --noEmit` only                    | Buildless `.ts`, Node strips TypeScript natively            |
| Host API contract    | None. No peer dependency, hand-written interface copies | peer `>=0.80.5`, dev `^0.83.0`, floor enforced by a test    |
| Runtime dependencies | 0                                                       | 3: `isomorphic-git`, `proper-lockfile`, `write-file-atomic` |
| Network              | 7 registry adapters over `fetch`, all with timeouts     | `isomorphic-git`, pure JavaScript, no binary needed         |
| Durable writes       | 1 file, `~/.zmarketplace/history.json`                  | Per-scope `state.json`, agents, `mcp.json`, resources       |
| CI gates             | Typecheck, live-network tests, one CLI smoke run        | Typecheck, lint, format, unit, integration, e2e, Sonar      |
| Release span         | v0.4.2 to v0.7.8, 2026-07-14 to 2026-07-17              | v0.1.0-alpha.0 to v0.13.0, 2026-05-12 to 2026-08-05         |

## Appendix B: methodology and verification status

This analysis comes from a read of both source trees. Nobody ran either project. The competitor side is the tree at `zico20047/zmarketplace` commit `3e727e5eb2f6ec4db74c4243e23093950181d02c`, which publishes `zmarketplace` v0.7.8. Our side is `pi-claude-marketplace` at v0.13.0. Where their documentation and their code disagree, this document reports the code and names the drift.

Six claims here rest on live network probes run on 2026-08-10 rather than on source: the Smithery 404, the MCP registry response shape, the Gemini registry count of 1,437 entries, and the Anthropic catalog counts of 284 official and 2,291 community. Those are measurements of third-party services, and they change. Their adapters are correct or broken against those services on that date only.

The Pi API claims come from the type declarations in `@earendil-works/pi-coding-agent`, at the version this repository develops against, which is `^0.83.0`. A user on an older Pi can see different behavior.

The market signals come from a different method and carry a different confidence. Repository counts come from the GitHub REST API. Download counts come from the npm registry download API, for the 30-day window that ends 2026-08-09. Both were queried on 2026-08-10. Every number in that section has a shelf life of about one week.

Three claims in this document are UNVERIFIED. Nobody verified them against source or by a run, so do not rely on them:

1. Whether their Pi extension path loads and runs correctly under Node without Bun. A read of the source found no Bun-specific API, which supports their claim, but nobody ran it in a live Pi session.
2. Whether the `setStatus` arity mismatch suppresses their status line at runtime. The signature mismatch is verified against the Pi type declarations. The runtime effect is not.
3. Whether `omp` is a shipping agent, and whether `~/.omp/plugins/omp-plugins.lock.json` is its real lock-file path. Their installed-package detector depends on both, and nobody verified either one from this side.

If `zmarketplace` publishes again, re-cut this document. Its last release is 2026-07-17 and its last commit is 2026-07-18, so the tree analyzed here can stay current for some time. The third-party registries it depends on will not.
