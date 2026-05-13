# Feature Research

**Domain:** Pi extension exposing Claude plugin marketplaces (cross-ecosystem bridge) **Researched:** 2026-05-09 **Confidence:** HIGH (PRD-grounded for table stakes; MEDIUM for "what users will demand next" predictions, validated against current Claude Code `/plugin`, VS Code, JetBrains, Homebrew, npm/pnpm patterns)

## Scope of This Document

This is **not a re-listing of the PRD**. The PRD (`docs/prd/pi-claude-marketplace-prd.md`) already enumerates ~100 numbered requirements across 7 vertical features and 13 horizontal concerns. This document instead:

1. Categorizes each PRD-defined feature into table-stakes vs differentiator vs anti-feature, **with rationale**.
2. Surfaces features common in similar marketplace systems (Claude Code `/plugin`, VS Code Marketplace, JetBrains, Homebrew, npm) that the PRD may have under-specified or missed.
3. Identifies behavioral gaps in the PRD that need a feature-level decision before phase planning.
4. Notes 2026 plugin-marketplace UX expectations the successor must respect.

The downstream consumer is a roadmap agent that will turn these categorizations into phase ordering.

______________________________________________________________________

## Feature Landscape

### Table Stakes (Users Expect These -- Missing = Broken)

These are the features without which a Pi user familiar with `npm`, `brew`, `code --install-extension`, or Claude Code's own `/plugin` will conclude that this extension is incomplete.

| PRD ID(s)                            | Feature                                                                                                                | Why Expected                                                                                                                                                                                                                                                                   | Complexity                             | Notes                                                                                                                                                                |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| MA-1, MA-2, MA-3, MA-7, MA-11        | `marketplace add` from `owner/repo`, GitHub URL, local path                                                            | Universal expectation: every package manager (`brew tap`, `code --install-extension`, `npm install`) accepts at least two source types. Refusing GitHub `owner/repo` shorthand would feel hostile.                                                                             | MEDIUM                                 | Already specified. Critical that `git` PATH check is loud (MA-7) -- silent failure here is a top complaint in `brew`, `apt` UX studies.                              |
| MA-5, MA-6, MA-9                     | Atomic clone-then-rename for GitHub sources, with stale-clone refusal                                                  | `npm`/`pnpm` lockfile incidents (Spring 2026 OSS) hardened user expectations: a half-clone must NOT be silently reused.                                                                                                                                                        | MEDIUM                                 | Sources [npm/pnpm 2026 hardening](https://dev.to/trknhr/lessons-from-the-spring-2026-oss-incidents-hardening-npm-pnpm-and-github-actions-against-1jnp).              |
| MR-1, MR-2, MR-3, MR-8               | `marketplace remove` cascade, with per-plugin failure aggregation                                                      | Users who installed `N` plugins under one marketplace expect `remove` to clean up all `N`. JetBrains and `brew untap` both do this. Failing to aggregate would force per-plugin manual cleanup.                                                                                | MEDIUM                                 | The aggregated-warning surface (MR-4) is already best-in-class vs `brew untap` (which silently leaks formulae files in some failure modes).                          |
| ML-1 to ML-4                         | `marketplace list` grouped by scope                                                                                    | Users with `user`+`project` scopes need a way to see "what marketplaces do I have, where". `code --list-extensions`, `brew tap`, `pip list` all do this. Grouping by scope is non-obvious but **required** because Pi has two scopes; flat listing would conflate.             | LOW                                    |                                                                                                                                                                      |
| MU-1, MU-2, MU-3, MU-4, MU-5         | `marketplace update` with manifest refresh + ff-only                                                                   | Direct parity with `brew update`, `apt update`, Claude Code `/plugin marketplace update`. Non-fast-forward refusal (MU-3) is critical -- `git pull` clobbering local work is a known Claude Code bug ([issue #29071](https://github.com/anthropics/claude-code/issues/29071)). | MEDIUM                                 |                                                                                                                                                                      |
| PI-1, PI-3, PI-4, PI-5, PI-6         | `install <plugin>@<marketplace>` core flow with parser, not-found, not-installable, already-installed, conflict errors | Universal. Every marketplace install command must handle these five error paths or users get cryptic stack traces.                                                                                                                                                             | LOW (errors) / MEDIUM (conflict guard) | PI-6 cross-plugin conflict guard is **stronger than Claude Code upstream** -- see Differentiators.                                                                   |
| PI-7                                 | Stable version recording (`version` → entry `version` → `hash-<12hex>`)                                                | Users need to know "what version did I install" for support tickets. Falling back to `hash-…` for un-versioned plugins is essential for the long tail of community plugins that ship without `version:`.                                                                       | MEDIUM                                 | The 12-char hash truncation contract (committed e269f31) is well-justified.                                                                                          |
| PI-8, PI-9, PI-14                    | Atomic staging + rollback ordering + path containment                                                                  | After the npm `event-stream` and 2026 supply-chain incidents, users assume ANY install is either complete or fully reverted. Half-installed plugins are a 2026 dealbreaker.                                                                                                    | HIGH                                   |                                                                                                                                                                      |
| PI-11, PI-12, RH-3, RH-4, RH-5, ES-5 | Soft-dep stable-string warnings + reload hint                                                                          | Without a clear "what do I do next" string, users open issues. Claude Code's "Run /reload" hint is now a baseline expectation across CLIs.                                                                                                                                     | LOW                                    | The marker strings ARE the user contract -- see PRD §6.12 ES-5.                                                                                                      |
| PU-1 to PU-7                         | `uninstall` with state-first commit and data-dir cleanup last                                                          | Users expect uninstall to be the inverse of install. PU-2's "state commit before data-dir cleanup" sequence is the right call -- it matches `apt remove` semantics and prevents EACCES from stranding state.                                                                   | MEDIUM                                 |                                                                                                                                                                      |
| PUP-1 to PUP-9                       | `update` for individual plugins, `@<marketplace>` (all in mp), bare (all installed)                                    | `npm update`, `brew upgrade`, `apt upgrade` all support these three forms. Missing the bare form would be jarring.                                                                                                                                                             | HIGH                                   | Three-phase update is more sophisticated than Claude Code upstream (which has the [stale-cache bug #17361](https://github.com/anthropics/claude-code/issues/17361)). |
| PL-1 to PL-7                         | `list` with `--installed/--available/--unavailable/--scope` filters                                                    | The filter set matches what Claude Code's tabbed `/plugin` UI offers (Installed/Discover tabs). Missing the `--unavailable` bucket would hide why a plugin can't be installed -- a top friction point.                                                                         | MEDIUM                                 | PL-6 (broken-manifest still shows installed) is critical -- installed plugins disappearing from view is a top complaint in `brew`.                                   |
| SK-1 to SK-5                         | Skills bridge -- staged + discoverable via `resources_discover`                                                        | This IS the core value prop. Without skills bridging, the extension does nothing useful.                                                                                                                                                                                       | MEDIUM                                 |                                                                                                                                                                      |
| CM-1 to CM-4                         | Commands bridge -- staged as Pi prompt templates                                                                       | Same as skills: core value prop. Missing this means users can install Claude plugins but lose half their functionality.                                                                                                                                                        | LOW                                    |                                                                                                                                                                      |
| AG-1 to AG-12                        | Agents bridge with soft-dep on pi-subagents                                                                            | High-value feature. Subagents are increasingly central to Claude plugins (per [2026 marketplace inventory](https://buildtolaunch.substack.com/p/best-claude-code-plugins-tested-review)).                                                                                      | HIGH                                   | The frontmatter field-mapping (AG-7) is the load-bearing translation layer.                                                                                          |
| MC-1 to MC-8                         | MCP servers bridge with soft-dep on pi-mcp-adapter                                                                     | MCP is now a baseline assumption for Claude plugins -- many V1 marketplace plugins are MCP-server-only.                                                                                                                                                                        | MEDIUM                                 |                                                                                                                                                                      |
| SP-1 to SP-7                         | Source parsing & validation                                                                                            | Rejecting `git@…`, `tree/<ref>`, `~user/foo` with explanatory hints is what separates a tool that "works" from a tool that "teaches".                                                                                                                                          | LOW                                    |                                                                                                                                                                      |
| SC-1 to SC-7                         | Two-scope model with `ScopedLocations` typed bundle                                                                    | Pi users expect their `~/.pi/agent/` vs `<cwd>/.pi/` distinction to be honored. The typed brand prevents whole classes of bugs.                                                                                                                                                | MEDIUM                                 |                                                                                                                                                                      |
| MM-1 to MM-7                         | Manifest schema + strict mode                                                                                          | Strict mode mirrors the upstream Claude Code behavior. Without it, plugins authored against `strict: true` would surface phantom unsupported-component errors.                                                                                                                 | HIGH                                   |                                                                                                                                                                      |
| PR-1 to PR-6                         | Discriminated `installable: true \| false` resolver                                                                    | Without the discriminated union, downstream code reads `pluginRoot` from non-installable plugins → runtime crashes. This is a **2026 TypeScript correctness baseline**.                                                                                                        | MEDIUM                                 |                                                                                                                                                                      |
| RN-1 to RN-6                         | Deterministic generated names + safe-name + cross-plugin/cross-marketplace conflict guards                             | Name collisions silently overwriting plugin files would be a security incident. Must block at install.                                                                                                                                                                         | MEDIUM                                 |                                                                                                                                                                      |
| TC-1 to TC-9                         | Tab completion for subcommands, `--scope` values, plugin@marketplace tokens                                            | `npm`, `brew`, `git`, `kubectl` all have tab completion. Pi users WILL try `<TAB>` after `/claude:plugin install` and expect candidates. Missing this is a usability cliff.                                                                                                    | HIGH                                   |                                                                                                                                                                      |
| AP-1 to AP-4                         | Argument parsing with quoted args, `--scope` validation, Usage blocks                                                  | Universal CLI baseline.                                                                                                                                                                                                                                                        | LOW                                    |                                                                                                                                                                      |
| ST-1 to ST-9                         | State persistence with `schemaVersion`, atomic save, `withStateGuard`, legacy migration, concurrency detection         | State corruption is the worst failure mode in any package manager -- it strands users with no recovery path. The state-guard pattern is the right design.                                                                                                                      | HIGH                                   |                                                                                                                                                                      |
| PS-1 to PS-5                         | `assertPathInside` on every name-derived path; `PathContainmentError`                                                  | Path traversal in plugin names → arbitrary file write → security CVE. This is non-negotiable post-2026.                                                                                                                                                                        | MEDIUM                                 |                                                                                                                                                                      |
| AS-1 to AS-9                         | Atomic staging on same-FS; phase-ordered rollback; cleanup-leak aggregation                                            | Same rationale as PI-8/PI-9. Missing AS-8/AS-9 (don't materialize empty bridge files) would litter scopes with empty `mcp.json` and `agents/` directories.                                                                                                                     | HIGH                                   |                                                                                                                                                                      |
| ES-1 to ES-5                         | `ctx.ui.notify` single channel, severity ladder, `Error.cause` chains, stable marker strings                           | The marker strings ARE the contract (per PRD §6.12 ES-5). Drift = breakage for any user who scripted around them.                                                                                                                                                              | MEDIUM                                 |                                                                                                                                                                      |
| IL-2, IL-3                           | No direct stdout/stderr; single sanctioned `console.warn` for legacy migration                                         | Required to keep test surface tractable and prevent message-channel drift.                                                                                                                                                                                                     | LOW                                    |                                                                                                                                                                      |

### Differentiators (Competitive Advantage vs Upstream Claude Code `/plugin`)

These are features where this extension can lead -- i.e., where the successor can do something Claude Code's own `/plugin` does NOT do well or at all. Rationale grounded in known upstream issues.

| Feature                                                                                           | Value Proposition                                                                                                                                                                                                                                                                                                                                                                           | Complexity | Notes                                                                                                                                                                                       |
| ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Soft-dependency degradation (PI-11/12, MC-8, RH-5)**                                            | Claude Code's `/plugin install` either works or fails. This extension installs plugins **even when** `pi-subagents` or `pi-mcp-adapter` are unloaded, then emits a stable warning + reload hint. Users keep momentum instead of being blocked on companion-extension setup order.                                                                                                           | MEDIUM     | The stable marker strings (`pi-subagents is not loaded; …`, etc.) make this scriptable. No upstream equivalent.                                                                             |
| **Atomic 3-phase update with state-guard rollback (PUP-6, PUP-7, AS-3)**                          | Upstream Claude Code has known cache/update bugs ([issue #17361](https://github.com/anthropics/claude-code/issues/17361), [#29071](https://github.com/anthropics/claude-code/issues/29071)) where `git fetch` runs but the cache never refreshes. The 3-phase prepare→swap→commit design here is materially safer.                                                                          | HIGH       | Phase-3 failures emit a `plugin-uninstall + plugin-install` recovery hint -- concrete next action vs cryptic state.                                                                         |
| **Cross-plugin AND cross-marketplace conflict guards (PI-6, RN-3, RN-4, AG-9)**                   | Two plugins from different marketplaces declaring the same skill/agent name silently overwriting each other is a top-level data-loss bug. Upstream `/plugin` does not appear to guard cross-marketplace. This blocks at install and lists every conflicting name in one message.                                                                                                            | MEDIUM     | `<plugin>:<command>` and `pi-claude-marketplace-<plugin>-<agent>` namespacing schemes (RN-1) prevent collisions by construction for commands and agents; the guard catches the residual cases. |
| **Asymmetric `install` (no network) vs `update` (network) -- PI-2 + PUP-2**                       | `install` reads cached manifest; `update` syncs the clone first. This contract is explicit and tested. Users who run `install` offline can do so; users who run `update` opt-in to network I/O. Upstream behavior here is muddled.                                                                                                                                                          | LOW        | NFR-5 codifies the network policy.                                                                                                                                                          |
| **Forward-compatible `marketplace.json` parser (NFR-12)**                                         | Treats unknown plugin source kinds as `{ kind: "unknown", reason }` rather than throwing. This means upstream Claude can ship new source kinds (e.g., `git-subdir`) and this extension keeps working -- just surfaces them as `unavailable` until support lands.                                                                                                                            | LOW        | Critical for keeping pace with Anthropic's evolving schema.                                                                                                                                 |
| **Strict-mode union resolver (MM-5/6/7)**                                                         | Faithfully implements the four-source declaration union under `strict: true` and the entry-only resolver under `strict: false`. The `strict: false` conflict detection (MM-6, MM-7) is more rigorous than what `/plugin` appears to enforce.                                                                                                                                                | HIGH       |                                                                                                                                                                                             |
| **Two-scope model with brand-typed `ScopedLocations` (SC-3)**                                     | Hand-crafted scope shapes don't typecheck. This eliminates a whole class of "wrote to user scope when meaning project" bugs that plague VS Code extension dev.                                                                                                                                                                                                                              | MEDIUM     |                                                                                                                                                                                             |
| **Manifest-load failure does not blank the listing (PL-6, TC-8)**                                 | If a marketplace's manifest is malformed, the rest of the marketplaces still show, AND installed plugins from the broken marketplace still render (sourced from state). Upstream `/plugin` and `vscode` Extensions tab both have failure modes where the whole list disappears on one bad source ([vscode #182675](https://github.com/microsoft/vscode/issues/182675)).                     | MEDIUM     |                                                                                                                                                                                             |
| **Generated-marker provenance for foreign-content protection (AG-5, PU-7, MC-5)**                 | Refuses to remove agent files lacking the `pi-claude-marketplace-` prefix AND the `generated by pi-claude-marketplace` HTML-comment marker. Refuses to drop MCP entries lacking `_piClaudeMarketplace`. Users can manually drop a hand-written agent into `<scope>/agents/` and uninstall will not nuke it. Homebrew has similar guards via `brew untap` checks; VS Code and Claude Code do not. | MEDIUM     |                                                                                                                                                                                             |
| **Reload hint emitted ONLY when resources change (RH-1)**                                         | `marketplace add` to an empty marketplace emits no hint; `update` with everything `unchanged` emits no hint. This prevents noise that desensitizes users to the hint when it actually matters.                                                                                                                                                                                              | LOW        |                                                                                                                                                                                             |
| **Listing-only LLM tools (PRD §11 anti-feature: "Mutating LLM tools for install/update/remove")** | Pi exposes `claude:plugin` as a command surface; the LLM gets read-only tools. Prevents the LLM from autonomously installing/removing plugins, which is the right safety posture given prompt injection threat models in 2026.                                                                                                                                                              | LOW        | Differentiator vs Claude Code's own UI which is human-only anyway.                                                                                                                          |

### Anti-Features (Deliberately NOT Built -- With Rationale)

These are features that seem reasonable but are explicitly excluded. PRD §11 enumerates several; this section adds the **rationale** and **alternative**.

| Feature                                                                                                                                           | Why Requested                                                                                                                                                                                                                            | Why NOT Built                                                                                                                                                                                              | Alternative                                                                                                                                                                            |
| ------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Claude `local` scope**                                                                                                                          | Parity with Claude Code's three-scope model.                                                                                                                                                                                             | Pi has no `local` equivalent. Adding a third scope without a Pi-side implementation creates an orphan abstraction.                                                                                         | If/when Pi adds a `local` scope, revisit. Until then: `project` scope with `.gitignore` exclusion approximates it.                                                                     |
| **Mutating LLM tools (`install`, `update`, `remove`)**                                                                                            | LLM autonomy: "let Claude install what it needs".                                                                                                                                                                                        | 2026 prompt-injection threat models make autonomous install actions a privilege-escalation surface. A malicious skill could prompt-inject "install evil-plugin@evil-marketplace".                          | Listing tools only; install/update/remove require explicit human `/claude:plugin` invocation.                                                                                          |
| **Automatic dependency resolution**                                                                                                               | npm/pnpm parity ("when I install A, install dependencies B and C automatically").                                                                                                                                                        | Claude plugin `dependencies` field is opaque (no schema, no semver). Auto-resolving against an unknown registry creates supply-chain risk.                                                                 | Manual-install warning (PI-13). Reconsider if/when Anthropic standardizes the `dependencies` schema with a registry.                                                                   |
| **Managed/allowlist/blocklist policies**                                                                                                          | Enterprise expectation ([Workbrew taps allowlist](https://workbrew.com/docs/allow-installation-of-packages-from-third-party-taps), [VS Code enterprise extension management](https://code.visualstudio.com/docs/enterprise/extensions)). | Pi has no equivalent policy mechanism. Building one inside this extension creates a lopsided permission model.                                                                                             | If Pi adds organization-scoped policy, this extension wires into it. Not a V1 concern.                                                                                                 |
| **SSH URLs, arbitrary HTTPS git URLs, sparse checkouts, browser-paste tree URLs**                                                                 | Convenience: "I copied a URL from GitHub".                                                                                                                                                                                               | Each source kind is a separate test surface and security-review burden. Browser tree URLs (`/tree/<ref>`) are particularly tempting but ambiguous (branch name vs commit SHA collision).                   | Reject with explanatory hint pointing to `#<ref>` form (MA-10, SP-3).                                                                                                                  |
| **Plugin source kinds beyond local paths**                                                                                                        | npm/git-subdir/git URLs in plugin entries (vs marketplace source).                                                                                                                                                                       | Each source kind needs its own clone/cache/version surface. V1 ships path source which covers all in-marketplace plugins; remote-source plugins surface as `unavailable` with clear reason.                | Surface as `unavailable: unsupported source kind: <kind>`. Add kinds incrementally based on demand evidence.                                                                           |
| **Components beyond skills/commands/agents/mcpServers** (hooks, lspServers, monitors, themes, output styles, channels, userConfig, bin, settings) | Full Claude Code feature parity.                                                                                                                                                                                                         | Each component type needs a Pi equivalent. Pi may not have one (e.g., `outputStyles`, `themes`). Forcing translation creates lossy bridges.                                                                | Detect and surface as `unavailable: contains <component>`. Build dedicated Pi extensions for components that warrant them (e.g., `pi-claude-hooks`).                                   |
| **Performance: manifest caching with mtime invalidation**                                                                                         | "Listing is slow when I have N marketplaces".                                                                                                                                                                                            | Premature optimization. With a typical user holding ≤10 marketplaces, manifest reads are sub-second on warm FS. Cache invalidation is a known footgun source.                                              | Backlog. Add only when a real user reports >2s listing latency with profiling data.                                                                                                    |
| **Rich interactive selectors (TUI menu)**                                                                                                         | "Let me arrow-key through a list of plugins".                                                                                                                                                                                            | Pi's command surface is text-in/text-out via `ctx.ui.notify`. A TUI overlay would require a Pi UI primitive that does not exist.                                                                           | List + tab completion provides discovery; install command does the action. Reconsider if Pi adds a TUI primitive.                                                                      |
| **JSON output / dry-run modes for install/update/uninstall**                                                                                      | Scripting (`pi claude:plugin list --json`); safety (`pi claude:plugin install --dry-run`).                                                                                                                                               | Both are valid future requests but not V1. JSON output requires designing a stable schema (contract debt). Dry-run requires factoring every operation into "plan" + "execute" phases -- material refactor. | Backlog. Dry-run is the higher-value of the two -- see Behavioral Gaps for prioritization.                                                                                             |
| **Session-start autoupdate run**                                                                                                                  | Claude Code parity ([upstream behavior](https://workingbruno.com/notes/keeping-claude-code-plugins-date)).                                                                                                                               | Performance hazard (delays session start by network I/O); also intersects with the buggy upstream cache behavior.                                                                                          | `marketplace autoupdate` flag exists; users invoke `marketplace update` explicitly. Reconsider after Anthropic fixes [#17361](https://github.com/anthropics/claude-code/issues/17361). |
| **`info` subcommand**                                                                                                                             | Parity with `npm view`, `brew info`, `apt show`.                                                                                                                                                                                         | Genuine table-stakes feature in mature ecosystems but deferred from V1 to keep surface manageable.                                                                                                         | **Deferred but high-priority** -- see Behavioral Gaps below; this should be the first post-V1 addition.                                                                                |
| **`--force` install with `incomplete` state**                                                                                                     | "Let me install partially-supported plugins" (skills work, but skip the unsupported component).                                                                                                                                          | Creates a class of "installed but broken" state records. Recovery path is unclear.                                                                                                                         | Reject as `unavailable` with clear reason. Reconsider if a frequently-requested plugin pattern emerges.                                                                                |
| **Telemetry, message catalogs, structured event channels**                                                                                        | Ops visibility; i18n.                                                                                                                                                                                                                    | V1 is English-only with no metrics endpoint (IL-1, IL-4). The successor SHOULD design these as pluggable surfaces (IL-5) but not ship them in V1.                                                          | Successor architecture concern. Add a structured event channel before adding telemetry.                                                                                                |
| **Custom component-path arrays as supplemental**                                                                                                  | Spec says custom paths should ADD to defaults, not REPLACE.                                                                                                                                                                              | Current V1 replaces. This is a correctness gap, not a design choice -- flag it.                                                                                                                            | **See Behavioral Gaps** -- needs explicit decision before phase planning.                                                                                                              |

### Features Common in Plugin Marketplaces That the PRD Under-Specifies or Misses

These are features that appear in similar marketplaces (Claude Code `/plugin`, VS Code, JetBrains, Homebrew, npm/pnpm) and that the PRD does NOT clearly address. Some may be intentional omissions (consistent with the V1 anti-feature posture); others may be genuine gaps.

| Feature                                                                | Common In                                                                                                                             | PRD Status                                                                                                                           | Recommendation                                                                                                                                                                                                                 |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **`info <plugin>@<marketplace>` subcommand**                           | npm view, brew info, apt show, [Claude Code `/plugin` (via tab UI)](https://code.claude.com/docs/en/discover-plugins)                 | Deferred (PRD §11)                                                                                                                   | **Promote to early post-V1.** Currently users have to install a plugin to see its description, version, components. `list` shows truncated description but not full metadata. Expected baseline.                               |
| **Search / filter by tag/category**                                    | [Claude Code marketplace categories](https://code.claude.com/docs/en/plugin-marketplaces), VS Code Extensions tab                     | Not addressed                                                                                                                        | **Defer with reason.** Marketplace JSON supports `category` and `tags` (per Claude docs); the extension currently ignores them. Add when marketplace count grows.                                                              |
| **Lockfile (versions pinned across reinstalls)**                       | npm, pnpm, Cargo, Pipfile.lock                                                                                                        | Not addressed                                                                                                                        | **Anti-feature for V1.** State.json IS effectively the lockfile (records exact installed `version` per `(marketplace, plugin, scope)`). Don't add a separate lockfile concept; document state.json as the lockfile equivalent. |
| **Semver-aware update resolution (`^1.0.0`, `~2.3.0`)**                | npm, pnpm, Cargo                                                                                                                      | Not addressed                                                                                                                        | **Defer (anti-feature for now).** Claude plugins don't use semver ranges -- they use single `version` strings or no version. Adding semver resolution ahead of upstream support is over-engineering.                           |
| **`min-release-age` / `minimumReleaseAge` (anti-supply-chain)**        | [npm 2026, pnpm](https://dev.to/trknhr/lessons-from-the-spring-2026-oss-incidents-hardening-npm-pnpm-and-github-actions-against-1jnp) | Not addressed                                                                                                                        | **Flag for successor.** Post-Spring-2026 OSS incidents, this is becoming table stakes for package managers. Not V1 but should be considered for successor.                                                                     |
| **`--dry-run` (preview install/update/uninstall changes)**             | apt, pip, pacman, [pnpm](https://github.com/pnpm/pnpm/issues/7340), Claude Code (no)                                                  | Deferred (PRD §11)                                                                                                                   | **Promote to early post-V1.** Higher value than JSON output. With multi-component plugins (skills + agents + MCP), users want to know "what will change" before pulling the trigger.                                           |
| **Plugin signature/build provenance verification**                     | [Homebrew sigstore proposal](https://repos.openssf.org/proposals/build-provenance-and-code-signing-for-homebrew), npm provenance      | Not addressed                                                                                                                        | **Defer (no Claude ecosystem standard yet).** When Anthropic publishes a signing standard for marketplaces, revisit.                                                                                                           |
| **Disable / enable plugin without uninstall**                          | VS Code, JetBrains                                                                                                                    | Not addressed                                                                                                                        | **Defer.** No clear use case for Pi: skills/prompts/agents/MCP are either staged or not. "Disabled but installed" would be a new state requiring UI. Use uninstall+reinstall.                                                  |
| **Plugin author / maintainer attribution in listing**                  | All major marketplaces                                                                                                                | Partially addressed (`owner.name` in marketplace.json per MM-1)                                                                      | **Add to `info` subcommand.** Listing shows name + version + description; `owner.name` is parsed but not surfaced. Surface in `info` when added.                                                                               |
| **Conflict detection between marketplaces declaring same plugin name** | npm scopes, brew taps                                                                                                                 | Cross-marketplace agent ownership IS guarded (RN-4, AG-9), but cross-marketplace plugin name collisions are NOT explicitly addressed | **Behavioral gap -- see below.**                                                                                                                                                                                               |
| **Update notification on session start (without performing update)**   | VS Code extension auto-update notifications                                                                                           | Not addressed                                                                                                                        | **Defer.** Adjacent to "session-start autoupdate run" anti-feature. A non-intrusive "N plugin updates available" notification could be valuable but requires session-start hooks not currently used.                           |
| **Bulk operations: `install plugin1 plugin2 plugin3`**                 | apt, brew, npm                                                                                                                        | Not addressed (subcommand grammar takes single token)                                                                                | **Behavioral gap -- see below.**                                                                                                                                                                                               |

______________________________________________________________________

## Behavioral Gaps Requiring Decision Before Planning

These are places where the PRD spec leaves room for interpretation. Phase planning should resolve each before the corresponding requirement enters a phase.

### Gap 1: Cross-marketplace plugin name handling

**Spec status:** RN-4 and AG-9 explicitly guard cross-marketplace AGENT collisions. But what about the same plugin NAME in two marketplaces?

**Scenario:** User adds marketplace `official` (with plugin `code-review`) and marketplace `community` (also with plugin `code-review`). User runs `install code-review@official` then `install code-review@community`. Both install? One blocks the other?

**Decision needed:**

- **Option A:** Both install (different `(marketplace, plugin, scope)` keys in state). Skill names will be `code-review-<skill>` for both → cross-plugin conflict guard (PI-6) catches it. Outcome: install of second one fails on first conflicting skill.
- **Option B:** Block at the `<plugin>@<marketplace>` parser level -- "plugin name `code-review` already installed from marketplace `official`".
- **Option C:** Allow both, namespace generated names by marketplace too (`code-review-<mp>-<skill>`).

**Recommendation:** Option A (matches PRD §6.5 RN-3 behavior; minimal change). Document the failure mode in user-facing error.

### Gap 2: `marketplace update` cascade ordering when one plugin's update fails

**Spec status:** MU-7 says cascade partitions plugins into `updated/unchanged/skipped/failed` and renders in that order. But does `failed` for plugin A abort the cascade for B, C, D?

**Decision needed:**

- **Option A:** Cascade continues; failures are collected and reported (consistent with MR-3 marketplace remove cascade).
- **Option B:** First failure aborts cascade.

**Recommendation:** Option A. Matches the marketplace-remove cascade model (MR-3) and matches user expectations from `apt upgrade` and `brew upgrade`.

### Gap 3: Custom component-path arrays -- supplement vs replace

**Spec status:** PRD §11 explicitly notes: *"Custom component-path arrays as supplemental -- currently the explicit declaration replaces the default rather than supplementing it. Spec says it should supplement."*

**This is a known correctness gap.** It's documented as out-of-scope but it's actually a **bug** vs the upstream Claude spec.

**Decision needed:**

- **Option A:** Stay with current behavior (replace). Rationalize: V1 contract; users who hit this can declare both.
- **Option B:** Fix to supplement (matches upstream). Behavior change → migration concern for any user who relied on the replace semantics.

**Recommendation:** Option B (fix it). Mark as a phase-1 successor task. Users who notice the V1 behavior have likely worked around it; users who didn't will get correct behavior. Document as "behavior corrected vs V1" in changelog.

### Gap 4: `update` with no installed plugins -- message vs error

**Spec status:** PUP-1 says "When the resolved target set is empty … the command MUST succeed silently with the message `No plugins installed.`". Same pattern in MU-1.

**Question:** Is "succeed silently" with a message actually silent? Other CLIs differ -- `apt upgrade` exits 0 with "0 upgraded, 0 newly installed"; `brew upgrade` says nothing.

**Decision needed:** Confirm `default` severity (success channel) for this message, NOT `warning` or `error`. The PRD wording is consistent with default severity but worth explicit confirmation.

**Recommendation:** Default severity. Document in ES-2 mapping.

### Gap 5: `install` of a plugin that's installable in both scopes simultaneously

**Spec status:** SC-4 covers name-targeted commands needing disambiguation. PI-1 to PI-15 don't explicitly address: can the same `plugin@marketplace` be installed in both `user` AND `project` scopes simultaneously?

**Decision needed:**

- **Option A:** Yes, independently. State is keyed by `(marketplace, plugin, scope)` → no conflict in state. But generated skill name `<plugin>-<skill>` is the same → `resources_discover` would surface duplicates.
- **Option B:** No, mutually exclusive. Block install if installed in the other scope.

**Recommendation:** Option A but with a note in `install` output: "Note: `<plugin>` is also installed in `user` scope; `project` scope shadows it." Matches Claude Code's project-shadows-user precedence ([per docs](https://code.claude.com/docs/en/plugins-reference)). Requires `resources_discover` deduplication strategy.

### Gap 6: `marketplace update` when GitHub remote rebased history

**Spec status:** MU-3 covers non-fast-forward "divergence" requiring remove + re-add. But what about the specific case where upstream did `git rebase` and the local detached HEAD ref is gone?

**Decision needed:** Treat as same as MU-3 (recovery via remove + re-add)? Or attempt automatic re-checkout to the ref's new SHA?

**Recommendation:** Treat as MU-3. Automatic re-checkout silently changes what users have installed.

### Gap 7: Reload hint emission when ONLY agents change but `pi-subagents` is unloaded

**Spec status:** RH-1 says hint emitted only when "generated resources changed". RH-5 says soft-dep warning + reload hint when resources of that kind exist and dep is unloaded.

**Question:** If only agents changed and `pi-subagents` is unloaded, does the user actually need to `/reload`? Or do they need to load `pi-subagents` first AND THEN `/reload`?

**Recommendation:** Emit BOTH the soft-dep warning AND the reload hint. The reload hint after loading `pi-subagents` is what makes the agents discoverable. Stable-string contract preserves this dual emission. Explicit phase-planning callout.

### Gap 8: Tab completion for `marketplace add` source argument

**Spec status:** TC-1 to TC-9 cover completion for marketplace names, plugin tokens, flags. Not addressed: completion for the `<source>` arg of `marketplace add`.

**Decision needed:** Should `marketplace add <TAB>` offer anything? Local path completion (filesystem)? `owner/repo` history? Nothing?

**Recommendation:** Nothing in V1 (consistent with current scope). Pi may not expose path completion primitives. Document the absence.

### Gap 9: Concurrent invocations across scopes

**Spec status:** ST-7 to ST-9 and PI-15 cover concurrent operations on the same scope (state-guard pattern). What about `install foo@mp --scope user` running concurrently with `install foo@mp --scope project`?

**Decision needed:** Different scope = different state file = no conflict. But if they share the same agent name in `<scope>/agents/`? Different agent paths, no conflict. MCP servers? Different `mcp.json`. Sources clone? Different `<scope>/pi-claude-marketplace/sources/`.

**Recommendation:** No additional coordination needed. Two scopes are independent. Verify with a test case.

### Gap 10: What does "incomplete" mean and what would `--force` do?

**Spec status:** PRD §11 defers `--force install` with "incomplete state" but doesn't define `incomplete`.

**Decision needed:** Before reconsidering this for post-V1, define: incomplete = "all components staged but a soft-dep failed to resolve at install time"? Or "some components were skippable (unsupported) but supported components still installed"?

**Recommendation:** Park this until concrete user demand. Define `incomplete` only when scoping the feature.

______________________________________________________________________

## 2026 Plugin Marketplace UX Expectations

The successor must land on the right side of these expectations, even if the PRD doesn't enumerate them.

| Expectation                                                                      | Source/Evidence                                                                                                                                           | PRD Coverage                                                                         |
| -------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| **Install must be atomic; no partial state on failure**                          | npm/pnpm hardening post-2026 incidents; user assumption since 2024                                                                                        | ✅ PI-8/9, AS-1/4                                                                    |
| **Clear "what version did I install" answer**                                    | All package managers since `apt 2.0`                                                                                                                      | ✅ PI-7 (with hash fallback)                                                         |
| **`/reload` or restart hint must be explicit, not implied**                      | VS Code 1.31 "no reload install" was explicitly the most-requested feature                                                                                | ✅ RH-1/2/5 with stable strings                                                      |
| **Cross-source name collisions must be detected, not silently overwritten**      | Homebrew duplicate-formula errors; npm scoped packages; lessons from VS Code Extensions overwrites                                                        | ✅ PI-6, RN-3/4, AG-9, MC-4                                                          |
| **Supply-chain-aware** (don't auto-execute newly-published versions immediately) | npm `min-release-age`, pnpm `minimumReleaseAge`                                                                                                           | ⚠️ Not addressed; defer to successor                                                 |
| **Failure surfaces include a recovery path**                                     | Mature CLIs always tell you what to do next; immature ones print stack traces                                                                             | ✅ MU-5, PUP-6, AS-7 (`MANUAL RECOVERY REQUIRED:`)                                   |
| **Listing must work even when one source is broken**                             | VS Code marketplace [#182675](https://github.com/microsoft/vscode/issues/182675) showed how badly users react when broken extensions blank the whole list | ✅ PL-6, TC-8                                                                        |
| **Soft-dependency degradation, not hard-fail**                                   | 2026 trend (containers, K8s operators); users expect graceful degradation                                                                                 | ✅ PI-11/12, MC-8 (a clear differentiator)                                           |
| **Tab completion is non-negotiable**                                             | `git`, `kubectl`, `npm`, `brew`, `gh` all have it                                                                                                         | ✅ TC-1 to TC-9                                                                      |
| **Network-free operations must be network-free**                                 | Air-gapped dev environments; offline coding sessions                                                                                                      | ✅ NFR-5 (`install`, `list`, `uninstall`, path-source `marketplace add` all offline) |
| **Default scope must be predictable**                                            | All major CLIs document default scope clearly                                                                                                             | ✅ MA-2 (`marketplace add` defaults to user); SC-4 search rules                      |
| **Uninstall must not damage user-authored content**                              | Users hand-edit configs; tools that nuke them lose trust                                                                                                  | ✅ AG-5/PU-7 foreign-content guard, MC-5 marker check                                |

______________________________________________________________________

## Feature Dependencies

Critical for phase ordering. PRD requirements have implicit dependencies; surfacing them here.

```text
Source parsing & validation (SP-*)
    └──required by──> Manifest schema (MM-*)
                          └──required by──> Plugin compatibility resolver (PR-*)
                                                └──required by──> install / update / uninstall

State persistence (ST-*) + ScopedLocations (SC-3)
    └──required by──> marketplace add (which writes state)
                          └──required by──> install (which reads marketplace from state)

Path safety (PS-*)
    └──required by──> Resource naming (RN-*)
                          └──required by──> Atomic staging (AS-*)
                                                └──required by──> all bridges (SK/CM/AG/MC)

Soft-dep probing (RH-3/4)
    └──required by──> Reload hint emission (RH-5)
                          └──required by──> install/update/uninstall message rendering

Argument parsing (AP-*) + Tab completion (TC-*)
    └──enhance──> All vertical commands (independent infrastructure)

Error surfaces (ES-*) + ctx.ui.notify (IL-2)
    └──required by──> Every user-visible code path
```

### Dependency Notes

- **Source parsing → manifest → resolver:** Linear chain. Cannot install without resolving; cannot resolve without parsing the manifest; cannot read the manifest without a valid source.
- **State → marketplace add → install:** Marketplace lifecycle is a prerequisite for plugin lifecycle. `install <plugin>@<marketplace>` requires the marketplace already in state.
- **Path safety → resource naming → atomic staging:** All three are infrastructure for the bridges. Bridges should be implemented after all three are tested.
- **Soft-dep probing parallel to bridges:** Agents bridge requires `pi-subagents` probing for the soft-dep warning; MCP bridge requires `pi-mcp-adapter` probing. These can be developed in parallel with the bridges themselves but must integrate before message rendering.
- **Argument parsing + tab completion → all commands:** Don't ship any vertical command without both. Tab completion lag → users won't discover the command surface.
- **Error surfaces → everything:** ES-1/2/3/4/5 are pervasive. Establish the `ctx.ui.notify` pattern in phase 1 and enforce in every subsequent phase.

______________________________________________________________________

## MVP / Phase Definition

This is a SUCCESSOR architecture project. V1 already exists. "MVP" here means: what's the minimum the successor must deliver to be considered a credible replacement of V1?

### Successor v1.0 (Must Match V1 Behavior)

Everything in PRD §5 and §6. The successor is not allowed to drop any V1 capability without explicit decision logged in PROJECT.md Key Decisions.

### Successor v1.1 (First Post-V1 Additions)

Highest-value features deferred from V1, in priority order:

- [ ] **`info` subcommand** -- Highest user value; mature ecosystems all have it; no architectural risk.
- [ ] **Custom component-path arrays as supplemental** (Gap 3 above) -- Correctness fix vs upstream spec.
- [ ] **`--dry-run` for install/update/uninstall** -- High value for multi-component plugins; requires plan/execute split refactor.
- [ ] **JSON output mode** -- Lower priority than dry-run; useful for scripting but contract-debt risk.

### Successor v2+ (Successor Architecture Concerns)

Per IL-5 and PRD §11:

- [ ] **Pluggable message catalog** -- i18n. Trigger: non-English user demand.
- [ ] **Structured event channel** -- `success`/`warning`/`error`/`cleanup-leak`/`rollback`. Required before telemetry.
- [ ] **Telemetry / metrics** -- Only after structured event channel exists.
- [ ] **Severity-aware log levels** -- Separate from user-facing notify channel.
- [ ] **Min-release-age / supply-chain hardening** -- Once Anthropic ecosystem matures around publish timestamps.

### Future / Indefinite Defer

- [ ] **Mutating LLM tools** -- Reconsider only with a strong sandboxing story.
- [ ] **Automatic dependency resolution** -- Reconsider only with Anthropic-standardized dependency schema.
- [ ] **Managed/allowlist/blocklist policies** -- Reconsider only with Pi-side org policy primitive.
- [ ] **Claude `local` scope** -- Reconsider only when Pi adds a `local` scope.
- [ ] **Components beyond skills/commands/agents/mcpServers** -- Reconsider per-component, not as a class.

______________________________________________________________________

## Feature Prioritization Matrix

For features specifically called out as Behavioral Gaps or Anti-Features under reconsideration:

| Feature                                                 | User Value                        | Implementation Cost | Priority                      | Rationale                                                      |
| ------------------------------------------------------- | --------------------------------- | ------------------- | ----------------------------- | -------------------------------------------------------------- |
| `info` subcommand                                       | HIGH                              | LOW                 | P1 (post-V1)                  | All ecosystems have it; no architectural risk; ~1 week of work |
| Fix custom component-path supplement (Gap 3)            | MEDIUM                            | LOW                 | P1 (post-V1)                  | Correctness vs spec; users currently surprised                 |
| `--dry-run` mode                                        | HIGH                              | HIGH                | P2 (post-V1)                  | High value but requires plan/execute split; budget 2-3 weeks   |
| JSON output mode                                        | MEDIUM                            | MEDIUM              | P2 (post-V1)                  | Useful for scripting; contract-debt risk needs design          |
| Cross-marketplace plugin name handling decision (Gap 1) | LOW                               | LOW                 | P1 (decide in phase planning) | Low value, low cost, must be decided                           |
| Cascade ordering decision (Gap 2)                       | LOW                               | LOW                 | P1 (decide in phase planning) | Confirms current behavior; document explicitly                 |
| Structured event channel                                | LOW (now) / HIGH (with telemetry) | HIGH                | P3                            | Successor architecture concern; build before telemetry         |
| Min-release-age                                         | MEDIUM                            | MEDIUM              | P3                            | Wait for Anthropic ecosystem signals                           |
| Plugin signature verification                           | MEDIUM                            | HIGH                | P3                            | Wait for Anthropic signing standard                            |
| Disable/enable without uninstall                        | LOW                               | MEDIUM              | P3                            | No clear use case yet                                          |
| Bulk install (`install p1 p2 p3`)                       | MEDIUM                            | LOW                 | P2 (post-V1)                  | Common request pattern in adjacent ecosystems                  |

**Priority key:**

- P1: Decide or implement in early successor phases
- P2: Implement after V1 parity is verified
- P3: Defer until ecosystem signal or successor-architecture phase

______________________________________________________________________

## Competitor Feature Analysis

| Feature                         | Claude Code `/plugin` (upstream)       | VS Code Marketplace                                                      | Homebrew                       | npm/pnpm                                                                               | This extension's approach                                      |
| ------------------------------- | -------------------------------------- | ------------------------------------------------------------------------ | ------------------------------ | -------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| Install lifecycle               | Tabbed UI + CLI                        | Extensions tab + CLI                                                     | `brew install`                 | `npm install`                                                                          | `/claude:plugin install <plugin>@<marketplace>`                |
| Atomic install                  | Partial (known cache bugs)             | Mostly atomic                                                            | Atomic                         | Atomic (via lockfile)                                                                  | **Atomic with phase-ordered rollback**                         |
| Soft-dep handling               | Hard fail                              | N/A (extensions self-bundle)                                             | Hard fail (deps required)      | Hard fail                                                                              | **Soft-degrade with stable-string warning** (differentiator)   |
| Cross-source conflict           | Unclear                                | Last-install-wins (overwrites)                                           | Strict (errors)                | Scoped packages prevent                                                                | **Strict block with `assertSafeName` + ownership marker**      |
| Update model                    | Auto on session start (buggy) + manual | Auto + manual                                                            | Manual `brew upgrade`          | Manual `npm update`                                                                    | **Manual; per-marketplace `autoupdate` flag for cascade only** |
| Reload required                 | Yes (`/reload-plugins`)                | Often no (since 1.31)                                                    | N/A                            | N/A                                                                                    | **Yes, with stable hint string** (mirrors Claude Code)         |
| Listing scope grouping          | Per-marketplace                        | Flat                                                                     | Flat (all taps)                | Flat                                                                                   | **Grouped by scope (user/project)** (Pi-specific)              |
| Foreign content protection      | Unknown                                | N/A                                                                      | Tap-formula ownership check    | N/A                                                                                    | **`pi-claude-marketplace-` prefix + HTML-comment marker**         |
| Failure surfaces broken sources | Whole list can blank                   | Can blank ([#182675](https://github.com/microsoft/vscode/issues/182675)) | Tap-level only                 | Per-package error                                                                      | **Per-marketplace soft-fail; installed plugins still listed**  |
| `info` / details                | Tab UI shows it                        | Tab UI shows it                                                          | `brew info`                    | `npm view`                                                                             | **❌ Not in V1; should be P1 post-V1**                         |
| `--dry-run`                     | No                                     | No                                                                       | No                             | [pnpm RFC open](https://github.com/pnpm/pnpm/issues/7340); `npm install --dry-run` yes | **❌ Not in V1; P2 post-V1**                                   |
| Lockfile                        | No                                     | No                                                                       | No (Brewfile is approximation) | Yes (`package-lock.json`)                                                              | **`state.json` is effective lockfile**                         |
| LLM autonomous install          | N/A (no LLM)                           | N/A                                                                      | N/A                            | N/A                                                                                    | **❌ Anti-feature (security)**                                 |
| Two-scope model                 | Three scopes                           | One scope                                                                | One scope                      | Per-project + global                                                                   | **Two scopes (matches Pi)**                                    |

______________________________________________________________________

## Sources

### Claude Code Plugin Ecosystem (primary, since the V1 source contract)

- [Claude Code: Discover and install prebuilt plugins through marketplaces](https://code.claude.com/docs/en/discover-plugins) -- `/plugin` UI structure, tab model, marketplace add sources
- [Claude Code: Plugins reference](https://code.claude.com/docs/en/plugins-reference) -- three-scope model, precedence, version pinning
- [Claude Code: Create and distribute a plugin marketplace](https://code.claude.com/docs/en/plugin-marketplaces) -- `marketplace.json` schema, plugin entry fields, `category`/`tags`
- [anthropics/claude-plugins-official](https://github.com/anthropics/claude-plugins-official) -- reference marketplace; 101 plugins as of March 2026
- [anthropics/claude-code: plugins/README.md](https://github.com/anthropics/claude-code/blob/main/plugins/README.md) -- plugin schema reference
- [Issue #17361: Plugin cache never refreshes -- autoUpdate doesn't update what Claude reads](https://github.com/anthropics/claude-code/issues/17361) -- known upstream bug; differentiator opportunity
- [Issue #29071: claude plugin update doesn't fast-forward local marketplace clone](https://github.com/anthropics/claude-code/issues/29071) -- known upstream bug; addressed by MU-2/3
- [Issue #31462: Plugin update detection and upgrade workflow](https://github.com/anthropics/claude-code/issues/31462) -- upstream lifecycle gap
- [Issue #11240: Plugin Lifecycle Hooks: Install and Uninstall](https://github.com/anthropics/claude-code/issues/11240) -- proposed PreInstall/PostInstall hooks (not in this extension's scope)
- [Issue #14815: Plugins show as "(installed)" in marketplace but don't appear in Installed tab](https://github.com/anthropics/claude-code/issues/14815) -- listing-state-drift bug
- [Issue #26513: Plugin UI shows local-scoped plugin as 'installed' in unrelated projects](https://github.com/anthropics/claude-code/issues/26513) -- scope-leakage bug
- [Keeping Claude Code plugins up to date -- workingbruno.com](https://workingbruno.com/notes/keeping-claude-code-plugins-date) -- auto-update behavior reference

### Adjacent Marketplace Systems

- [VS Code Extension Marketplace docs](https://code.visualstudio.com/docs/configure/extensions/extension-marketplace) -- install/update/uninstall lifecycle, reload requirements
- [VS Code Issue #182675: Extension with an old version is not removed by reloading](https://github.com/microsoft/vscode/issues/182675) -- listing failure mode reference
- [VSCode No Reload Extension Install in v1.31](https://dev.to/vscode/vscode-no-reload-extension-install-in-version-131-59fe) -- "no reload" was the most-requested feature
- [VS Code Enterprise Extension Management](https://code.visualstudio.com/docs/enterprise/extensions) -- allowlist/blocklist patterns
- [Homebrew Taps documentation](https://docs.brew.sh/Taps) -- third-party repository model
- [Homebrew Workbrew: Allow installation from third-party Taps](https://workbrew.com/docs/allow-installation-of-packages-from-third-party-taps) -- enterprise allowlist
- [Build Provenance and Code-signing for Homebrew](https://repos.openssf.org/proposals/build-provenance-and-code-signing-for-homebrew) -- emerging signing standard
- [JetBrains: Install plugins (IntelliJ IDEA)](https://www.jetbrains.com/help/idea/managing-plugins.html) -- Marketplace + Installed tab model
- [JetBrains Marketplace: Common errors and warnings](https://plugins.jetbrains.com/docs/marketplace/list-of-common-errors-and-warnings.html) -- dependency conflict patterns

### 2026 Supply-Chain & Versioning Context

- [Lessons from the Spring 2026 OSS Incidents: Hardening npm, pnpm, and GitHub Actions](https://dev.to/trknhr/lessons-from-the-spring-2026-oss-incidents-hardening-npm-pnpm-and-github-actions-against-1jnp) -- `min-release-age`, supply-chain hardening
- [Best JavaScript Package Managers in 2026](https://www.pkgpulse.com/guides/best-javascript-package-managers-2026) -- npm/pnpm/yarn lockfile maturity
- [Renovate: Should you Pin your JavaScript Dependencies?](https://docs.renovatebot.com/dependency-pinning/) -- pin vs range guidance
- [pnpm Issue #7340: dry-run option for install](https://github.com/pnpm/pnpm/issues/7340) -- dry-run as emerging table-stakes
- [Semantic Versioning 2.0.0](https://semver.org/) -- baseline for any future semver-aware update path

### PRD Itself

- `/Users/acolomba/src/pi-claude-marketplace/docs/prd/pi-claude-marketplace-prd.md` v1.0 -- authoritative spec for V1; sections §1, §5, §6, §11 directly informed table-stakes vs deferred classifications
- `/Users/acolomba/src/pi-claude-marketplace/.planning/PROJECT.md` -- successor scope, key decisions, constraints

______________________________________________________________________

*Feature research for: pi-claude-marketplace successor architecture* *Researched: 2026-05-09*
