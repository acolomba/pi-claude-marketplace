# Competitive landscape: Claude plugins in Pi

- **Analysis date:** 2026-08-10.
- **Baseline:** `pi-claude-marketplace` v0.13.0, MIT.
- **Subjects:** four projects. We analyzed each one separately and pinned it to a named commit.
- **Purpose:** this document summarizes the four reports. It ranks the work that follows from all of them together. It adds no new source review, and every claim here traces to one of the four documents below.
- **Snapshot rule:** each report describes one commit of one project. A later release can differ.
- **Market signals:** the counts come from the GitHub and npm APIs. We queried both on 2026-08-10, for the 30-day window that ends 2026-08-09.
- **Decision this informs:** what to build next, what to leave alone, and how to describe ourselves.

## The four reports

| Report                                               | Subject                  | Version | Commit     | Category              |
| ---------------------------------------------------- | ------------------------ | ------- | ---------- | --------------------- |
| [pi-plugins.md](pi-plugins.md)                       | `@nklisch/pi-plugins`    | 0.3.5   | `175142c7` | Native Pi plugin host |
| [asermax-pi-cc-plugins.md](asermax-pi-cc-plugins.md) | `@asermax/pi-cc-plugins` | 1.6.0   | `98cb6e51` | Declarative loader    |
| [pi-claude-plugins.md](pi-claude-plugins.md)         | `pi-claude-plugins`      | 0.2.0   | `554f19c1` | Read-only mirror      |
| [zmarketplace.md](zmarketplace.md)                   | `zmarketplace`           | 0.7.8   | `3e727e5e` | Cross-agent search    |

If you read only one, read `pi-plugins.md`. It is the only subject that competes with us as a product, and it is four times the length of the others for that reason.

## Executive summary

Only one of the four is a competitor. `@nklisch/pi-plugins` is a full plugin host with a terminal manager, a trust model, and network hardening that is better than ours. The other three are different products that touch our problem at one edge each. `@asermax/pi-cc-plugins` is a declarative loader with no marketplace concept. `pi-claude-plugins` is a 221-line read-only mirror of a Claude Code installation. `zmarketplace` is a search engine that installs nothing and gives a shell command to another program.

That result is itself the finding. Three of the four reports used most of their length to explain why a feature comparison does not apply. A count of the rows where we win tells you nothing when the subject does not do our job.

We translate five Claude component kinds. No competitor translates more than three, and the three they translate are not the same three. Slash commands are the clearest hole in the field, and only we support them properly.

Two findings appeared in two reports each, from unrelated codebases. They carry more weight than anything one report found alone. Two of four competitors built a mode that installs nothing and reads the user's existing Claude files in place. Our architecture assumes installation and has no answer. Two of four reports also concluded, for different reasons, that our package description is the cheapest strategic lever we hold.

We lead the field on every engagement signal. Seventeen stars against one, one, one, and zero. Eight forks against three, one, zero, and zero. Four contributors with two outside humans against one each. We are second on raw downloads, behind a number that a bundled harness confounds.

No project in this field puts plugin execution in a sandbox. No project solves discovery for a user who does not already know a marketplace name.

## The landscape

Each report classified its own subject. Collected here, the four fall into four different boxes.

| Project                  | Class      | What it actually is                                                               | Installs a Claude plugin into Pi? |
| ------------------------ | ---------- | --------------------------------------------------------------------------------- | --------------------------------- |
| `@nklisch/pi-plugins`    | Direct     | A native Pi plugin host that reads Claude and Codex formats as inputs             | Yes                               |
| `@asermax/pi-cc-plugins` | Indirect   | A settings-driven loader that re-materializes a fixed list on every session start | Yes, without a lifecycle          |
| `pi-claude-plugins`      | Substitute | A projection of a Claude Code installation, for one segment of users              | No. It writes nothing             |
| `zmarketplace`           | Complement | Cross-registry search and audit that delegates every install to another program   | No. It cannot                     |

The axis that separates them is not feature count. It is whether the product owns the artifact after acquisition. We own it, `@nklisch/pi-plugins` owns it, and `@asermax/pi-cc-plugins` re-derives it each session. The other two never take custody at all.

`zmarketplace` is the one case where the rational move is a pull request and not a roadmap item. Their Claude adapter indexes 2,575 plugins from the two Anthropic catalogs. Their installed-package detector already reads Pi's `settings.json`. But a user who picks a Claude-sourced result gets no Pi option in the install menu. A Pi user can find 2,575 Claude plugins there and install none of them into Pi. We are the missing path, and it costs them one entry.

## Market signals

Read this table as direction, not as market share. All five projects are small.

| Signal, measured 2026-08-10      | nklisch         | asermax     | ross-jill-ws | zmarketplace | Us            |
| -------------------------------- | --------------- | ----------- | ------------ | ------------ | ------------- |
| First npm publish                | 2026-07-18      | 2026-05-10  | 2026-04-07   | 2026-07-14   | 2026-05-12    |
| Versions published               | 31              | 9           | 6            | 10           | 35            |
| Latest release date              | 2026-08-08      | 2026-08-05  | 2026-08-09   | 2026-07-17   | 2026-08-05    |
| Downloads, 30 days to 2026-08-09 | 5,203           | 299         | 358          | 1,741        | 2,547         |
| Weekly buckets, 3 x 7 days       | 2074, 980, 1001 | 44, 30, 198 | 50, 40, 212  | 79, 62, 77   | 623, 651, 924 |
| GitHub stars                     | 0               | 1           | 1            | 1            | 17            |
| GitHub forks                     | 0               | 1           | 3            | 0            | 8             |
| Contributors                     | 1               | 1           | 1            | 1            | 4, 2 outside  |
| Open issues and pull requests    | 0               | 0           | 1            | 0            | 1             |
| Source size, lines               | 79,579          | 3,489       | 221          | 2,459        | 57,552        |
| Component kinds translated       | 3               | 3           | 2            | 0            | 5             |

Three readings follow.

We are second on downloads and first on everything that measures engagement. The download gap to `@nklisch/pi-plugins` is real. Their `pi-enhanced` harness bundles their plugin host, so the public data cannot separate harness adoption from standalone adoption.

Our download curve is the only one that rises across all three weekly buckets. The `@nklisch/pi-plugins` curve is a launch spike that decays to a floor. The `zmarketplace` curve is a launch spike that stopped, with 1,444 of their 1,741 downloads in their first four days. The last-bucket rises at `@asermax/pi-cc-plugins` and `pi-claude-plugins` both match a publish date to the day. Read those two as release artifacts.

Every competitor is one person. Every competitor has one star or none. That tells you something about reach in this ecosystem and very little about quality.

Treat all of it with care. npm counts include mirrors, continuous integration, and bots, so no figure here is a user count. A 30-day window is short. GitHub reports pull requests inside its open-issue count, so that row mixes two things. Re-measure before you call any of this a trend.

## Component coverage

This is the table that matters most. It is the one axis where we lead the whole field.

| Claude component | nklisch  | asermax  | ross-jill-ws | zmarketplace | Us     |
| ---------------- | -------- | -------- | ------------ | ------------ | ------ |
| Skills           | Strong   | Adequate | Adequate     | Absent       | Strong |
| MCP servers      | Strong   | Adequate | Absent       | Absent       | Strong |
| Hooks            | Adequate | Absent   | Absent       | Absent       | Strong |
| Agents           | Absent   | Weak     | Absent       | Absent       | Strong |
| Slash commands   | Absent   | Absent   | Weak         | Absent       | Strong |

No competitor covers more than three kinds, and the union of all four still leaves gaps. Slash commands are the emptiest column. `@nklisch/pi-plugins` has no `commands/` scan anywhere in its source. `@asermax/pi-cc-plugins` does not mention them. Only `pi-claude-plugins` loads flat command files, and a gate in their code means a common marketplace layout yields none at all.

Agents are almost as empty. `@nklisch/pi-plugins` declares them a non-goal. `@asermax/pi-cc-plugins` converts them but drops `model` and `tools`. Its agent cache key also omits the subpath, so two plugins from one repository overwrite each other's agents.

The caution attached to this table is in the `pi-plugins.md` threat section. Our two largest structural advantages, slash commands and partial installs, are stated non-goals for `@nklisch/pi-plugins` rather than technical barriers. A change of mind removes both.

## What no project does

Four gaps are open across the whole field. Each one is a position available to whoever takes it first.

No project puts plugin execution in a sandbox. All four reports examined this, and all four found the same answer. Trust systems and network policy read like a sandbox and are not one. After a plugin is trusted, its hook commands run as ordinary child processes with full privileges.

No project solves discovery for a user who knows no marketplace name. `zmarketplace` searches across six ecosystems but cannot install into Pi. `@nklisch/pi-plugins` has a `browse` verb that works only over marketplaces the user already added. We have nothing at all. A first-time user must know a marketplace before any product here helps.

No project offers trust revocation. `@nklisch/pi-plugins` built the deepest trust model in the field. It exports a `revokeTrust` primitive that no command calls.

No project resolves plugin dependencies. Cross-marketplace dependencies, the dependency graph, and semver constraints are unsupported everywhere, including here.

## The two convergent findings

An observation in one report is a finding. The same observation in two reports, about unrelated codebases, is a signal. Two findings reached that level.

### A product mode we do not have

Two of four competitors built a mode that installs nothing. `@asermax/pi-cc-plugins` reads the user's own `~/.claude/skills` and `~/.claude/agents` directories, and the project equivalents, behind two boolean settings. `pi-claude-plugins` goes further. It mirrors the whole Claude Code installation, filters by what Claude itself already enabled, then gives Pi paths that stay where they are.

Our architecture assumes installation. We resolve, stage, commit, record, and reconcile. That pipeline is the reason we can offer transactions, rollback, partial installs, and self-healing, and none of it is wasted. But it has no answer for a user who already runs Claude Code and wants that setup visible in Pi with no second copy.

The cost we impose on that user is concrete. They maintain two plugin lists that drift apart. We stage copies that go stale, and the mirror stays current by construction.

The seam exists. Our `import` orchestrator already reads Claude's settings files in both scopes, and it honors `CLAUDE_CONFIG_DIR`, which `pi-claude-plugins` hard-codes past. What it does with the result is an install. A projection is the other half of the same read.

### Our description is the cheapest lever we hold

Two reports reached this from opposite directions.

The `pi-plugins.md` analysis found a category-capture threat. `@nklisch/pi-plugins` claims the category of native plugin management. That frame converts every Claude feature they skip into a deliberate boundary rather than a gap. Inside our category name, every Claude feature we skip reads as an incomplete promise.

The `pi-claude-plugins.md` analysis found a name collision. Their package name differs from ours by one word, in the same registry, for the same host, over an adjacent problem. Theirs is five weeks older. Their description states exactly what their product does. Ours describes a category that their product can claim too without a lie.

Both reports give the same instruction. We already ship the two capabilities that separate us, and we claim neither anywhere a search result shows. We are the only project that reads Claude's installed plugin set, and nobody claims migration as a headline. We are also the only project where an unsupported component kind does not block the rest of the plugin. `@nklisch/pi-plugins` cannot answer that unless it reverses a stated principle.

This costs writing time and no engineering.

## Where each one beats us

Every report had the same instruction: be honest here. Each one found something real.

`@nklisch/pi-plugins` beats us on security engineering, and the gap is large. It also beats us on the interactive manager and the automation grammar behind it. The list continues through machine-readable output, stable exit codes, pagination, update discovery, plugin user configuration, npm sources, and Codex support. Their distribution beats our product too, because their harness bundles the plugin host, and a user who installs it never runs a comparison.

`@asermax/pi-cc-plugins` beats us on two things. It reads the user's own `.claude` directories, and we do not. It also repairs the loose `SKILL.md` frontmatter that Pi's strict YAML parser rejects, where we degrade the skill to a placeholder description. Their instinct there is better than ours. Their build of it is broken. Their own sanitizer turns `tags: [a, b]` into the string `"[a, b]"`, and it turns a valid multi-line plain scalar into YAML that no parser accepts. So we must reach parity, then move past them.

`pi-claude-plugins` beats us on setup cost for one segment, and no feature we ship changes those numbers. A user with Claude Code already configured needs one `pi install`. We need a package install, a marketplace add, an install for each plugin, and a reload. They also beat us on auditability. A reviewer reads their entire product in ten minutes, and ours is 57,552 lines.

`zmarketplace` beats us on discovery, README preview at the point of decision, a pre-install gate by default, reach across six ecosystems, and an interactive selection surface. Their audit is the weak part, and it fails in both directions. They still ask the right question before an install, and we ask no equivalent question at all.

## Threat assessment

One of the four is a strategic threat. The ranking matters more than the list.

`@nklisch/pi-plugins` is the threat, and distribution is the mechanism rather than product merit. Their `pi-enhanced` harness ships the plugin host in a one-install package. We can lose before anyone evaluates us, and no amount of component coverage answers that. Two slower risks follow. The first is category capture. The second is the chance that content-bound trust becomes what users expect, which turns our install-time model into a stated deficiency.

`pi-claude-plugins` is a threat to one segment and not to the product. It cannot grow into a plugin manager. To do that, it must become a different project. It costs us support noise today, routed to us because we are easier to find.

`@asermax/pi-cc-plugins` is not a threat. Ten weeks of silence between v1.5.0 and v1.6.0 reads as a side project that became active again. It is a source of one product idea and one capability gap, and both are small.

`zmarketplace` is not a threat and can be an ally. Their last commit is 2026-07-18 and their last publish is 2026-07-17, so the integration window can be narrow. Registry adapters decay first when upstream APIs move, and three of their seven registries already return nothing.

## Consolidated recommendations

Each report ranked its own items. This table merges all four and re-ranks them against each other. The source column says which report to read for the detail, and every item keeps that report's reasoning.

| #   | Item                                                              | Cost            | Source                | Why this rank                                                                                   |
| --- | ----------------------------------------------------------------- | --------------- | --------------------- | ----------------------------------------------------------------------------------------------- |
| 1   | Package description and README positioning                        | Writing only    | ross-jill-ws, nklisch | Named by two reports. No engineering. Answers category capture and the name collision at once   |
| 2   | Component-coverage comparison page in our docs                    | Writing only    | ross-jill-ws          | Helps users pick correctly, which reduces the confused issues routed to us                      |
| 3   | Uninstall data disposition                                        | Smallest change | nklisch               | Closes a data-loss path where the contents of `${CLAUDE_PLUGIN_DATA}` disappear with no prompt  |
| 4   | Repair single-line frontmatter scalars that fail to parse         | Smallest change | asermax               | Their headline feature without their defect. Improves every skill that degrades today           |
| 5   | Pull request to `zmarketplace` that adds a Pi install path        | Smallest change | zmarketplace          | Aims their index of 2,575 Claude plugins at our installer. It costs one file on their side      |
| 6   | Report their `deepScanned` defect, with a fix in the same request | Smallest change | zmarketplace          | Their audit tells users that unscanned Claude plugins are clean                                 |
| 7   | Adopt standalone `.claude/skills` and `.claude/agents`            | Not stated      | asermax               | The only real capability gap that report found. It strengthens a migration position we hold     |
| 8   | A `search` verb over added marketplaces                           | Not stated      | zmarketplace          | The discovery gap that the whole field shares. It blocks first use today                        |
| 9   | Plugin user configuration, non-sensitive subset first             | Not stated      | nklisch               | Largest install-success gain per unit of work. Their own secret custody is fail-closed          |
| 10  | Update discovery and notices                                      | Not stated      | nklisch               | Maps onto `pending` and the notification catalog. Keep notices independent of the update policy |
| 11  | Machine-readable output and stable exit codes                     | Not stated      | nklisch, zmarketplace | Unblocks scripted use, which nothing we ship supports                                           |
| 12  | A `doctor` verb with a closed remediation vocabulary              | Not stated      | nklisch               | Adopt the registry shape, not the system. It reuses catalogs we already gate                    |
| 13  | npm plugin sources                                                | Self-contained  | nklisch               | Removes our one unsupported plugin-source kind                                                  |
| 14  | Pre-install disclosure of writes, hooks, and MCP servers          | Not stated      | zmarketplace          | Answers the question their audit asks, from resolver facts rather than pattern matches          |
| 15  | Mirror mode, exposing Claude's installed set in place             | Milestone-sized | ross-jill-ws, asermax | The product mode two competitors built and we lack. It converges with item 7                    |
| 16  | An interactive terminal manager                                   | Milestone-sized | nklisch, zmarketplace | Highest visible impact of any item here. Read their v0.1.2 to v0.1.5 changelog first            |
| 17  | Content-bound trust grants                                        | Milestone-sized | nklisch               | Real value, but it must ship with a continuity rule or every update breaks trust                |
| 18  | Codex compatibility                                               | Not stated      | nklisch               | Strategic rather than urgent. It roughly doubles the addressable marketplace population         |

Items 1 through 6 cost almost nothing and close five separate findings. Do those first.

Items 7 and 15 are the same insight at two sizes. Item 7 is the cheap half, and it delivers most of the value.

Three cautions come from the individual reports. Do not adopt the SQLite, lease, and journal machinery from `@nklisch/pi-plugins`. Their own changelog documents three rounds of the same fail-closed anti-pattern, which broke non-Linux platforms each time. On item 4, repair single-line scalars only, and keep the existing degrade arm as the fallback. A synthesized block that parses beats a repair attempt that does not. On item 13, copy their packument and no-lifecycle-scripts approach, and do not copy the SHA-512 absolutism that their own backlog calls harmful.

## What to monitor

Each signal below is specific, and you can measure it. Most come from the `pi-plugins.md` threat analysis, because that is the only subject where a competitive move can change our plan.

Two files in the `@nklisch/pi-plugins` tree hold both of our largest structural advantages. Watch for any commit that adds a `commands/` convention scan. Watch for any edit to the explicit non-goals list in their `docs/COMPATIBILITY.md`. The ratio of `pi-enhanced` downloads to standalone `pi-plugins` measures the distribution threat directly, so track it. Two smaller signals are worth a periodic look: whether they lower the Node floor by removing `node:sqlite`, and whether a trust-revocation verb appears.

Outside that tree, `zmarketplace` must resume commits before it can merge our pull request, so a dead repository ends that plan. A write path in `pi-claude-plugins` moves it from substitute to competitor. And re-measure the download and star counts before you treat anything in the market table as a trend.

## Methodology and limits

Each of the four reports cloned its subject, read the source rather than the README, and cited files and line numbers for non-obvious claims. Each one queried the npm and GitHub APIs for market signals on 2026-08-10. Each one marked claims it could not verify with the token UNVERIFIED and counted them in its header. The counts are three for `@nklisch/pi-plugins`, two for `@asermax/pi-cc-plugins`, two for `pi-claude-plugins`, and three for `zmarketplace`.

Four limits apply to this summary. It reviews no source itself, so an error in a source report propagates here unchanged. It compresses four documents that disagree slightly on market counts measured at different moments of the same day. Where they differ, this table uses the later measurement. It carries none of the subsystem detail that makes the individual reports useful for implementation. And competitive analysis has a short shelf life, so read the snapshot rule in each report again before you act on a claim about a competitor's code.
