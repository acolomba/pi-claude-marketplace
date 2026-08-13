# Competitive analysis: @nklisch/pi-plugins

- **Analysis date:** 2026-08-10.
- **Subject:** repository `nklisch/pi-extensions`, commit `175142c7f6029f8676e5d9fcea3037520ff90b86`, package `@nklisch/pi-plugins` v0.3.5, MIT, author Nathan Klisch.
- **Baseline:** `pi-claude-marketplace` v0.13.0, MIT.
- **Path convention:** competitor paths are relative to `packages/pi-plugins/`. Our paths are relative to the repository root.
- **Snapshot rule:** every claim about `@nklisch/pi-plugins` describes that one commit. A later release can differ.
- **Market signals:** the counts in the competitor overview come from the GitHub and npm APIs, queried on 2026-08-10 for the 30-day window that ends 2026-08-09.
- **UNVERIFIED items:** three claims in this document carry the mark UNVERIFIED. Nobody verified them against source. Do not rely on them.
- **Decision this informs:** where to build, where to reach parity, and where to differentiate.

## Executive summary

- Both projects install Claude Code plugins into Pi, and each makes the opposite trade. They support three component kinds and install a plugin whole. We support five kinds, allow partial installs, and degrade when a soft dependency is absent.
- Their depth is in trust, network hardening, plugin user configuration, and an interactive terminal manager. We have none of these.
- Our depth is in component coverage, enforced offline guarantees, and migration away from Claude Code. They attempt all three and stop short of each: three component kinds against our five, an offline promise that no gate enforces, and adoption that reads marketplace declarations but never the installed plugin set.
- Hooks are the one axis where neither side leads outright. We activate ten Claude events and run an async-rewake lane they leave dormant. They intercept subagent lifecycle events we do not support, and they run eight handlers at once where we run one.
- They translate no slash commands and no Claude agents. Both are explicit non-goals for them. Both work for us.
- They are the larger tree: 79,579 lines over 417 TypeScript files against our 57,552 lines over 202 files. Their Node floor is `>=24` because they use `node:sqlite`. Ours is `>=20.19.0`.
- The two positions differ more than the two feature sets do. They sell a native Pi plugin system that also reads Claude and Codex formats. We sell access to the Claude plugin ecosystem from Pi. Their frame lets them call a missing Claude feature a foreign non-goal rather than a gap.
- Their strongest advantage is distribution, not product. The `@nklisch/pi-enhanced` harness bundles their plugin host in a one-install package. A user who installs that harness never compares plugin hosts.
- Market signals are small and mixed on both sides. They lead on raw downloads. We lead on every engagement signal and on trend direction. The download gap is confounded by the harness bundle.
- Neither project sandboxes plugin execution. Their containment sits at the supply-chain and consent layer. Ours sits at the write-target layer.
- The highest-value borrowable item is plugin user configuration (`userConfig`). It raises install success for the least work and reuses substitution machinery we already own.
- The full ranking is in the prioritized recommendations section. The reasons not to copy their state machinery are in the cautions section.

## Competitor overview

### The project

`@nklisch/pi-plugins` ships from `nklisch/pi-extensions`, a monorepo of eleven Pi extension packages published under the `@nklisch` npm namespace. The repository description calls it a monorepo "including the pi-enhanced one-install harness." The plugin host is one package inside a wider product, and that fact drives the distribution finding below.

The eleven packages are `pi-background-tasks`, `pi-clearance`, `pi-conveniences`, `pi-enhanced`, `pi-fff-compat`, `pi-legible`, `pi-mcp-adapter`, `pi-model-modes`, `pi-plugins`, `pi-subagents`, and `pi-zai-research`.

Development is one person. The GitHub API reports a single contributor holding all 68 commits, no forks, and no external pull requests.

### Recent momentum

Both projects are young and small. Read this table as direction, not as market share.

| Signal, measured 2026-08-10                         | @nklisch/pi-plugins        | pi-claude-marketplace            |
| --------------------------------------------------- | -------------------------- | -------------------------------- |
| First npm publish                                   | 2026-07-18                 | 2026-05-12                       |
| Versions published                                  | 31                         | 35                               |
| Latest version                                      | 0.3.5, on 2026-08-08       | 0.13.0                           |
| npm downloads, 30 days to 2026-08-09                | 5,203                      | 2,547                            |
| Weekly downloads, 3 buckets of 7 days to 2026-08-09 | 2,074 -> 980 -> 1,001      | 623 -> 651 -> 924                |
| Peak download day                                   | 2026-07-18, in launch week | 2026-08-09, the most recent day  |
| GitHub stars                                        | 0                          | 17                               |
| GitHub forks                                        | 0                          | 8                                |
| Contributors                                        | 1                          | 4, of whom 2 are external humans |
| Merged external pull requests                       | 0                          | 2                                |
| Open issues                                         | 0                          | 0                                |

Three readings follow, and the third matters most.

First, they lead on raw downloads by about two to one. That is real, and this document does not dismiss it.

Second, the download comparison is not like for like. Their `@nklisch/pi-enhanced` package declares `@nklisch/pi-plugins` both as a `^0` dependency and inside `bundledDependencies`. Every install of that harness pulls the plugin host. Their count therefore measures harness adoption and standalone adoption together, and the public data cannot separate the two.

Third, the trends point in opposite directions. Their weekly downloads fall sharply after the first bucket and then flatten, and their peak day sits in launch week. Ours rise across all three buckets, and our peak day is the most recent day measured. Their curve has the shape of a launch spike that decays to a floor. Ours has the shape of a baseline that grows.

The engagement signals separate the two projects more sharply than the download counts do. Zero stars, zero forks, zero issues, and zero outside contributors describe a project that users have not yet found, or have not yet adopted on its own merits. Seventeen stars, eight forks, and two merged external pull requests describe a small but real community.

### How much to trust these numbers

- npm counts include mirrors, continuous integration, and bots. Neither figure is a user count.
- They published 31 versions in three weeks. Frequent automated publishing inflates early download counts further.
- A four-week window is short. Re-measure before treating any of this as a trend.
- Absence of stars is weak evidence about quality. It is stronger evidence about reach.
- Their first npm publish, on 2026-07-18, comes before the first commit in their public repository, on 2026-07-24. The public history does not cover the full life of the package.

## Positioning analysis

### Positioning statements

Their README tagline reads: "Native plugin management for Pi, with compatibility for supported Claude Code and Codex marketplaces."

Cast into the standard template, that is:

> For **Pi users who want a plugin system**, `@nklisch/pi-plugins` is a **native Pi plugin manager** that **gives them transactional lifecycle, explicit trust, and an interactive manager**. Unlike a compatibility bridge, it **treats Claude and Codex formats as inputs to a Pi-native system**.

Our repository description reads: "Access Claude plugin marketplaces from Pi Coding Agent."

Cast into the same template:

> For **Pi users who already own Claude Code plugins**, `pi-claude-marketplace` is a **Claude plugin marketplace client for Pi** that **makes every supported Claude component work as a Pi-native artifact**. Unlike a native plugin system, it **follows Claude Code's own `/plugin` command surface and migrates the plugins the user already has**.

### Message architecture

| Level             | @nklisch/pi-plugins                                                           | pi-claude-marketplace                                                                 |
| ----------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Category          | Native Pi plugin management                                                   | Claude marketplace access for Pi                                                      |
| Differentiator    | Native-first, multi-host, explicit trust                                      | Fidelity of translation, and alignment with upstream                                  |
| Value proposition | Transactional lifecycle, offline-safe startup, and a compromised plugin stops | Install a Claude plugin and have every supported component work after `/reload`       |
| Proof points      | No metrics and no badges. They pin sibling versions and cite security review  | Component coverage, gate-enforced offline guarantees, and a byte-exact output catalog |

Their README lists four differentiator phrases: "marketplace discovery, inspection, and read-only foreign-state adoption"; "transactional install, enable, disable, update, recovery, and uninstall"; "deterministic `/plugins` commands and a Pi-native interactive manager"; and "offline-safe startup, update policy, diagnostics, and multiprocess coordination."

### Why the framing difference matters

This is the most strategically important finding in this document, and it is not a feature.

They claim the category of native plugin management. Claude and Codex are inputs to that system. The frame converts every unsupported Claude feature into a deliberate boundary. Their `docs/COMPATIBILITY.md` lists Claude agents, partial installation, LSP, themes, monitors, and foreign permission systems as explicit non-goals. Inside their own frame, a reader sees discipline.

We claim the category of Claude marketplace access. Inside that frame, every Claude feature we do not translate reads as an incomplete promise, because our category name implies the whole ecosystem.

The frames also decide who each product wins. Their frame wins a Pi user with no Claude history who wants a plugin system. Our frame wins a Claude Code user who already owns plugins and wants them to keep working. That second user is the one who benefits from our slash commands, our agent translation, and our import of Claude's installed plugin set.

### Positioning gaps

Two positions sit unclaimed and within reach. We are the only project that reads Claude's installed plugin set, and nobody claims migration as a headline. That is writing work, not engineering work. Graceful degradation is the same story: partial installs and soft-dependency degradation are ours alone, and neither our description nor our README leads with them.

One position is too crowded to be worth anything. Both projects claim "native," as does much of the Pi extension ecosystem, and the word no longer separates one thing from another.

Two of their positions are vulnerable. Their trust system is deep and genuine, but it ships with no revocation command and never live-probes remote MCP servers at consent time, and both gaps sit in their own code at this commit. Their offline-safe startup claim is one we can make more strongly than they can, because ours fails the build when it breaks and theirs is only a property of the code.

## Scope and philosophy

Their `docs/VISION.md` fixes the shared supported surface at exactly three component kinds: Agent Skills, command lifecycle hooks, and MCP servers. Everything else is retained metadata. Their stated principles are a whole-plugin lifecycle, honest compatibility, atomic change, and explicit trust. A whole-plugin lifecycle means the user never selects components independently. Honest compatibility means an approximation is never presented as an equivalence.

Their `docs/COMPATIBILITY.md` carries an "Explicit non-goals" list. It names:

- Foreign model-provider behavior
- Foreign permission systems
- Enterprise policy
- Hosted Codex apps
- Claude agents and agent teams
- LSP, themes, output styles, and background monitors
- Bidirectional foreign-state sync
- Partial plugin installation

Ours is the opposite trade. We support five component kinds and we allow partial installs. We degrade when a companion extension is absent. We enforce offline-first guarantees structurally rather than by convention.

## Capability ratings

The three matrices that follow this section state what each project does. This section rates how well, so that a reader can weigh the gaps instead of counting them. The detail behind every row is in those matrices and in Appendix B.

The scale has four values:

- **Strong** -- market-leading. Deep, and well executed.
- **Adequate** -- functional. It does the job without differentiating.
- **Weak** -- present but limited, with significant gaps.
- **Absent** -- not available.

A rating judges the capability as a user meets it, not the elegance of the code behind it.

| Capability                              | @nklisch/pi-plugins | pi-claude-marketplace |
| --------------------------------------- | ------------------- | --------------------- |
| Skills                                  | Strong              | Strong                |
| Slash commands                          | Absent              | Strong                |
| Agents                                  | Absent              | Strong                |
| MCP servers                             | Strong              | Strong                |
| Hooks                                   | Adequate            | Strong                |
| Plugin user configuration               | Adequate            | Absent                |
| Partial install of an unsupported kind  | Absent              | Strong                |
| Soft-dependency degradation             | Absent              | Strong                |
| `npm` plugin sources                    | Strong              | Absent                |
| Archive or file over `url`              | Absent              | Strong                |
| Interactive terminal manager            | Strong              | Absent                |
| Machine-readable output                 | Strong              | Absent                |
| Stable exit-code vocabulary             | Strong              | Absent                |
| Pagination                              | Strong              | Absent                |
| Per-operation dry run                   | Strong              | Adequate              |
| Removal data disposition                | Strong              | Absent                |
| Tab completion                          | Adequate            | Strong                |
| Content-bound trust grants              | Strong              | Absent                |
| Trust revocation                        | Absent              | Absent                |
| Network egress policy                   | Strong              | Absent                |
| Credential isolation                    | Adequate            | Strong                |
| Path containment on writes              | Adequate            | Strong                |
| Execution sandboxing                    | Absent              | Absent                |
| Background update discovery and notices | Strong              | Absent                |
| Staged updates                          | Strong              | Absent                |
| Manual rollback                         | Absent              | Absent                |
| Diagnostic registry                     | Strong              | Absent                |
| Read-only inspection surfaces           | Strong              | Strong                |
| Closed output vocabulary                | Strong              | Strong                |
| Offline guarantees                      | Adequate            | Strong                |
| Adoption of Claude marketplaces         | Strong              | Strong                |
| Adoption of the installed plugin set    | Absent              | Strong                |
| Portable project declaration            | Strong              | Adequate              |
| Codex compatibility                     | Strong              | Absent                |

Four rows need a word of explanation, because a single token hides the reason.

**Hooks** rates Adequate against Strong on a split decision. We activate 10 events to their 9, we map `StopFailure` where they retain it, and our async-rewake lane runs where theirs is retained and not activated. They hold two advantages we lack: `SubagentStart` and `SubagentStop` interception, and 8 concurrent handler processes against our one at a time.

**Offline guarantees** rates Adequate against Strong even though both projects deliver the behavior. Ours is enforced by a grep gate that fails the build. Theirs is a property of the code, which a future edit can remove in silence.

**Plugin user configuration** rates Adequate rather than Strong because their secret store returns unavailable on every platform at this commit. A plugin that declares a sensitive value cannot activate. The feature is real, and it stops at the first plugin that needs a secret.

**Execution sandboxing** rates Absent on both sides. The trust and network rows above can read as a sandbox. Neither project has one.

## Capability matrix: component kinds

| Claude component                                                                         | @nklisch/pi-plugins                                                                                                                                              | pi-claude-marketplace                                                                                                                                                              |
| ---------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Skills                                                                                   | Supported -> `resources_discover` returns `skillPaths` into their content-addressed store                                                                        | Supported -> `<extensionRoot>/resources/skills/<gen>/`, copied as a whole directory                                                                                                |
| Commands (slash)                                                                         | **Not supported.** No `commands/` convention scan exists anywhere in `src/`; a declared `commands` field is inert metadata (`src/domain/foreign-identity.ts:11`) | Supported -> Pi prompt template at `resources/prompts/<plugin>:<command>.md`                                                                                                       |
| Agents                                                                                   | **Not supported.** Declared a foreign non-goal                                                                                                                   | Supported -> `<scopeRoot>/agents/pi-claude-marketplace-<plugin>-<agent>.md` plus `agents-index.json`, with a 7-entry tool map, `Skill` -> `inheritSkills: true`, and `--map-model` |
| MCP servers                                                                              | Supported -> programmatic registration into their forked adapter with `fileDiscovery: "disabled"`; no `.mcp.json` is written                                     | Supported -> merged into `<scopeRoot>/mcp.json`, names kept verbatim, collisions refuse rather than rename                                                                         |
| Hooks                                                                                    | Supported, `type: "command"` only                                                                                                                                | Supported -> staged `hooks/<plugin>/hooks.json` plus in-memory routing                                                                                                             |
| `lspServers`, `monitors`, `themes`, `outputStyles`, `settings`, `channels`, `userConfig` | Retained metadata; `userConfig` is a special case, described below                                                                                               | Surfaced as unsupported -> `partially-available`; installable with `--partial`                                                                                                     |

Two qualifications apply to this table.

Their `docs/` claims that Claude flat command markdown is representable as a Pi skill. No distinct code path implements this beyond the ordinary root `SKILL.md` fallback. Treat it as a documentation claim without a verified implementation at this commit.

They refuse to fabricate Claude-style `mcp__plugin_x_y__tool` aliases and report `RUNTIME_ALIAS_UNAVAILABLE` instead. This is a deliberate honesty position, not a gap. Whether we synthesize such aliases is UNVERIFIED.

## Capability matrix: source kinds

Their source model is two disjoint strict zod unions (`src/domain/source.ts:176-265`): three marketplace sources and four plugin sources. Ours is one union (`extensions/pi-claude-marketplace/domain/source.ts`) with a forward-compatible `unknown` arm.

| Source kind                                        | @nklisch/pi-plugins                                                 | pi-claude-marketplace                                                      |
| -------------------------------------------------- | ------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| `github` (`owner/repo`)                            | Marketplace source, and the default                                 | Supported                                                                  |
| `git` over HTTPS                                   | Marketplace source and plugin source                                | Supported                                                                  |
| `git` over `ssh://` or SCP form (`git@host:`)      | Accepted as a `git` source                                          | Rejected by design                                                         |
| `local-git`                                        | Marketplace source; rejected at project scope with `NOT_PORTABLE`   | No such kind; a local tree is the `path` kind                              |
| `marketplace-path` (`./relative`)                  | Plugin source                                                       | Supported as `path`                                                        |
| `git-subdir`                                       | Plugin source                                                       | Supported for plugins; not supported at marketplace level                  |
| `npm`                                              | Plugin source, fully implemented                                    | Parsed and listed, but the resolver returns `unsupported source kind: npm` |
| `archive` (zip over HTTPS, Claude Code's own kind) | No such plugin source; TAR and HTTP are acquisition mechanisms only | No `ArchiveSource` variant at all; falls through to `unknown`              |
| Remote `marketplace.json` URL                      | Rejected as a marketplace source                                    | Rejected                                                                   |
| `http://`, `~user/...`, browser `/tree/<ref>` URLs | Not applicable                                                      | Rejected by design                                                         |

Their npm acquisition is pure HTTPS. It does a packument GET, a zod parse, and a version select by exact version, tag, or semver range. It then does a tarball GET, a SHA-512 verify, and a gunzip with TAR extract. The verify hashes on write, rehashes from disk, and compares with `timingSafeEqual`. They never run `npm install` and never run lifecycle scripts.

Their cache model keeps no persistent clone. Every install and every update re-fetches into fresh scratch under the staging slot's `.work/`. Content is then cached content-addressed under `stores/{marketplaces,plugins}/v1/`. Our clone cache is source-addressed at `plugin-clones/<key>/`, and garbage collection derives the live key set from surviving `resolvedSha` records.

Their hard rejections at this commit are wider than ours in two places. Git submodules fail materialization outright. An unqualified branch or tag name is rejected as ambiguous even when both currently peel to the same commit. On our side a `sha` must be a full 40-hex string. A shorter value is dropped in silence, so the source degrades to unpinned rather than mis-keying the cache.

## Capability matrix: command surface

Their single command is `/plugins`, with a versioned grammar named `plugin-control/v1`. The registry lives at `src/application/native-control-registry.ts`, and `test/documentation/native-control-spec.test.ts` verifies it against `docs/SPEC.md` mechanically.

Global controls precede the command path: `--grammar-version`, `--output human|json`, `--timeout-ms <1..86400000>`, `--non-interactive`, and exactly one of `--input-stdin`, `--input-file <path>`, or `--input-env-prefix <PREFIX>`.

Their primary verbs are:

- `add`, with the aliases `install` and `install run`
- `remove`, with the alias `uninstall`
- `update`, `enable`, `disable`, and `trust`
- `list`, `show` (alias `inspect`), and `status`
- `doctor`, with the alias `diagnose`
- `browse`, `help`, and `grammar`
- `marketplace add|remove|list|refresh`, where `update` aliases `refresh`
- `marketplace adopt preview|import`, with the aliases `adopt preview` and `adopt import`
- `project sync`, with the alias `project-sync`
- `updates status`, `updates policy preview|apply|set`, and `updates automatic run`
- `updates notices list|acknowledge`, with the alias `ack`
- `config host-precedence` and `config hook-visibility`

Two verb families are protocol-visible only and hidden from help and completion: `install open|apply|recover`, a three-step token-based install, and `operation status|cancel`, which polls or cancels by opaque token.

Notable flags at this commit:

- `--preview-only` on `enable`, `disable`, `update`, `remove`, and `project sync` gives a per-operation dry run.
- `--keep-data` and `--delete-data` on `remove`, where exactly one is required. Neither raises `CONTROL_RETENTION_REQUIRED`, and both raise `CONTROL_OPTION_CONFLICT`.
- `--yes` is required on `marketplace remove`, `adopt import`, and `trust`.
- `--scope user|project` selects the scope, as ours does.
- `--snapshot-id` and `--detail-id` are an all-or-nothing pair.
- `--cursor` and `--limit` paginate. Marketplace list takes 1 to 200 with a default of 50. The verbs `browse` and `list` take 1 to 100 with a default of 50. Notices take 1 to 200 with a default of 50. The verb `automatic run` takes 1 to 100 with a default of 20.
- `--condition ready|attention|blocked|unavailable` filters `list`.
- `--source-kind github|git|local-git` and `--ref` qualify `marketplace add`.

Their aliases are exact alternate paths, never fuzzy, and each carries `deprecatedSince`, `replacement`, and `removeInMajor` metadata.

Their exit codes live in `src/application/native-control-contract.ts:19-31`. The first five are `0` success, `2` usage, `3` input-required, `4` not-found, and `5` conflict-or-stale. The rest are `6` unavailable, `7` rejected-or-blocked, `8` partial-or-recovery-required, `9` cancelled-or-timeout, `10` internal, and `74` output-delivery-failed.

Their output channel is keyed by mode (`src/pi/pi-control-channel.ts`). The `rpc` and `json` modes emit `pi.appendEntry` frames, `print` emits stdout lines, and `tui` is a no-op because the manager consumes frames directly. Progress framing is a zod discriminated union of `accepted`, `progress`, and `result`, with strict ordering.

Our single command is `/claude:plugin`. The router is `edge/router.ts`, the flag catalog is `edge/flag-catalog.ts`, and `tests/architecture/flag-catalog-drift.test.ts` guards the two against drift. The flag `--scope user|project` is global and position-independent.

| Subcommand                                | Aliases | Flags                                                                             |
| ----------------------------------------- | ------- | --------------------------------------------------------------------------------- |
| `bootstrap`                               | --      | none (rejects `--scope`)                                                          |
| `install`                                 | --      | `--scope`, `--map-model`, `--partial`, `--local`                                  |
| `uninstall`                               | --      | `--scope`, `--local`                                                              |
| `update`                                  | --      | `--scope`, `--map-model`, `--partial`, `--local`                                  |
| `fetch`                                   | --      | `--scope`                                                                         |
| `reinstall`                               | --      | `--scope`, `--local`                                                              |
| `list`                                    | `ls`    | `--scope`, `--installed`, `--available`, `--unavailable`, `--partial`, `--remote` |
| `info`                                    | --      | `--scope`, `--fetch`                                                              |
| `pending`                                 | --      | `--scope`                                                                         |
| `enable` / `disable`                      | --      | `--scope`, `--local`                                                              |
| `import`                                  | --      | `--scope`                                                                         |
| `marketplace add`                         | --      | `--scope`, `--local`                                                              |
| `marketplace remove`                      | `rm`    | `--scope`, `--local`                                                              |
| `marketplace list`                        | `ls`    | `--scope`                                                                         |
| `marketplace info`                        | --      | `--scope`                                                                         |
| `marketplace update`                      | --      | `--scope`                                                                         |
| `marketplace autoupdate` / `noautoupdate` | --      | `--scope`, `--local`                                                              |

The deltas are explicit in both directions. They have machine-readable output, an exit-code vocabulary, pagination, and operation tokens. We have none of those four. We have `fetch`, a Pi-only verb with no upstream `/plugin` equivalent.

## What they have that we do not

### Plugin user configuration

`src/formats/claude/user-config-reader.ts` reads Claude `userConfig` descriptors. It recognizes the descriptor fields `type`, `title`, `label`, `description`, `required`, `sensitive`, `default`, `min`, `max`, `minItems`, `maxItems`, `pattern`, `multiple`, and `mustExist`. The value types are string, number, boolean, directory, file, and string arrays where `multiple` is declared. The reader enforces required fields, defaults, numeric bounds, and path rules. It also rejects the prototype-pollution keys `__proto__`, `prototype`, and `constructor`. Configured values reach components as `${user_config.KEY}` and `CLAUDE_PLUGIN_OPTION_<KEY>`. They classify this as compatibility infrastructure, not a separate component kind.

Their custody of sensitive values is fail-closed on every platform at this commit. `src/infrastructure/secrets/create-platform-secret-store.ts:20-37` returns `createUnavailableSecretStore()` unconditionally. The tree holds no macOS Keychain code, no libsecret or `secret-tool` code, and no Windows Credential Manager code. A plugin that requires a sensitive value cannot activate, and the diagnostic is `SECRET_CUSTODY_UNAVAILABLE`. Their stated reason is that the Secret Service call `CreateItem(replace=false)` cannot prove atomic no-replace ownership.

We treat `userConfig` as an unsupported component kind, so a plugin that declares it downgrades to `partially-available`. The seam to reuse on our side is the substitution machinery in `shared/vars.ts`.

### Content-bound trust grants and trust continuity

Their trust subject is `sha256("trust-subject-v1\0" + injective-encode({plugin, scope, marketplaceSource, pluginSource, immutableRevision, executableSurfaceDigest}))`. The `immutableRevision` is a Merkle-style SHA-256 root digest over every file, directory, and symlink in the installed bundle. The `executableSurfaceDigest` is a separate SHA-256 over a curated normalized projection. That projection covers the skill id, name, and root, and the hook id, event, matcher, and handler. It also covers the MCP id, key, and declaration, and the shape of each configuration option. Any byte change to the tree, or any change to the executable surface, yields a different subject. The old grant then no longer matches, and hooks and MCP servers stop until the user grants trust again. They use SHA-256 throughout and no other algorithm.

Trust continuity (`automatic-trust-continuity.ts`) is what lets exact-content trust survive an update. A new revision's subject is auto-granted only when all four conditions hold. The effective policy is `automatic` with `sourceGuard: "none"`. No exact record exists yet. A granted baseline exists for another revision of the same plugin with matching source identities. The exact subject is not revoked. Continuity grants are ordinary records that the user can revoke one by one. An explicit revocation always wins. When no granted lineage exists, interactive consent is still required.

Two gaps exist in their own implementation at this commit. The domain exports `revokeTrust`, but no application service or command calls it, and the registry carries no `untrust` verb. Trust review also always discloses `remote MCP discovery: "not-performed"`, so remote MCP servers are never live-probed at consent time.

Their "receipts" are shape gates, not content hashes. `src/runtime/published-package-receipt.ts` verifies a sibling package against a hard-coded receipt before it imports that package with `jiti`. The receipt covers the name, version, license, engines, peer dependencies, exports, and `pi.extensions` field. Its own doc comment says that byte integrity is npm's job and that the load-time gate verifies shape. The `sha512-` constants in that source are descriptive metadata and are not re-verified at load.

Our position is simpler and weaker. Plugin code is trusted on install. We have no signatures, no checksums against a trusted digest, and no allowlist. Our `resolvedSha` is a reinstall pin and a garbage-collection liveness key, not a verified value. Adopting content-bound trust would reuse our deterministic content-hash version derivation, which already walks the tree.

### Network hardening

They pin DNS (`src/infrastructure/network/network-egress-policy.ts` and `http/bounded-fetch.ts`). They resolve once with `dns.lookup({all:true})`, classify every address, reject forbidden and unlisted-private addresses, select one deterministically, then force that address into the connection. For git over HTTPS they pass `-c http.curloptResolve=host:port:addr`. For git over SSH they pass `-o HostName=<addr> -o HostKeyAlias=<host>`. For HTTP they install a custom Node `lookup` that preserves the TLS SNI `servername`. Every redirect hop is re-authorized, and ambient proxy environment variables are stripped because they would bypass the pinning.

They authorize origins by exact-string allowlist, read from `PI_PLUGIN_HOST_PRIVATE_ORIGINS`, `PI_PLUGIN_HOST_CREDENTIAL_ORIGINS`, and `PI_PLUGIN_HOST_REDIRECT_ORIGINS`. Credentials attach only to origins in `credentialOrigins`.

Their MCP endpoint policy is `"tls" | "consent-bound-loopback-plaintext"`. Plaintext HTTP is allowed only for a literal loopback IP address, which means `127.0.0.0/8` or `::1` and not the name `localhost`. The endpoint must also carry no template tokens and no sensitive query names. They reject the endpoint outright if any header or bearer token is present.

Their TAR reader (`src/infrastructure/archive/tar-reader.ts`) is hardened. It rejects `..`, absolute paths, UNC paths, backslashes, NUL bytes, control characters, Windows device names, trailing dots or spaces, and any `.git` segment. It resolves symlink targets against the virtual root. It rejects PAX and GNU path-indirection metadata (`x`, `X`, `L`, `K`) rather than honoring it. It rejects special file types, setuid and setgid bits, and sparse forms. It detects case and Unicode-normalization collisions and creates files with `O_EXCL|O_NOFOLLOW`. It then sweeps the output with a post-write realpath containment pass. It also guards against decompression bombs with a default ratio of 100 to 1.

Their redaction has four layers:

- A shared sensitive-field-name regular expression (`src/domain/sensitive-fields.ts`)
- Text, command, and environment redaction that covers URL userinfo, Bearer and Basic credentials, and sensitive query parameters
- A `SensitiveValue` wrapper whose `toString`, `toJSON`, and `util.inspect.custom` all return `[REDACTED]`
- A control-output projection

The projection hard-omits `cause`, `stack`, `message`, `plaintext`, `headers`, and `environmentValues`. It throws if a raw `SensitiveValue` reaches output, and it strips C0, C1, and Unicode bidi-override scalars.

Our surface here is narrow but real. `redactAbsolutePaths` collapses absolute paths to basenames. `causeChainTrailer` surfaces only `Error.message`, never `.stack`, bounded at depth 5 with cycle detection. `platform/git-credential.ts` spawns `git credential fill`, `approve`, and `reject` with `GIT_TERMINAL_PROMPT=0` and `GCM_INTERACTIVE=never`, rejects `[\r\n\0]` in attribute values, and never emits `path=`. `domain/github-auth.ts` implements the RFC-8628 device flow. Tokens are never written to any file we own, because git's helper chain puts them in the OS keychain. Only `github.com` is registered, and `auth-host.ts` returns `undefined` for unclaimed hosts so credentials cannot leak across hosts. We have no egress-policy layer at all, so this gap has no seam on our side to reuse.

### The interactive manager

Their manager is built on `@earendil-works/pi-tui` primitives plus Pi's `Theme` and `KeybindingsManager`, and it mounts through `context.ui.custom()`. Nested surfaces (confirm, text input, masked input, install flow) mount inline through a hand-rolled `presentInline<T>()` slot, because Pi's custom-UI container cannot stack.

Their README and ARCHITECTURE describe five sections named My Plugins, Discover, Sources, Updates, and Health. The implementation at this commit (`src/pi/manager/plugin-manager-model.ts:8-10`) has two views, `installed` ("Plugins") and `marketplaces` ("Marketplaces"), plus a four-way filter lens of `all`, `installed`, `available`, and `updates`. Health is a status clause in the heading and Updates is a filter. Their documentation is stale against their code.

Their keybindings are:

- Arrows navigate, and left and right cycle the filter lens
- PgUp and PgDn page, and auto-load the next page
- Enter opens detail or runs the focused action
- Esc cancels the operation, then dismisses the result, then goes back one level, then closes
- `/` focuses search, and `m` toggles views
- `a` adds or installs, `d` disables or enables, `x` removes, and `u` updates
- `Ctrl+U` updates all, `p` opens update policy, `r` refreshes, and `?` opens help

A confirmation takes `y` or `n`, and Space expands the exact disclosure.

Actions are derived live from authoritative inspection detail and are never shown unconditionally. Install is a three-step flow: review, then configure and trust, then activation result. Destructive and consent actions require fresh confirmation on each run. Sensitive configuration always routes through a `MaskedInputSurface` backed by `SensitiveValue` with no plaintext getter. The manager opens only when `context.mode === "tui"`.

We import `@earendil-works/pi-tui` for the `AutocompleteItem` type only, at three sites. We have no selectors, no prompts, and no dialogs. We do have a tab-completion provider (`edge/completions/provider.ts`) with five branches: top-level keywords, `--scope` values, per-verb flag names, nested marketplace subcommands, and status-aware `<plugin>@<marketplace>` references. It returns `null` rather than `[]` when no completion applies, as the pi-tui contract requires. The exact contents of their completion provider are UNVERIFIED. A manager on our side is the item with the highest visible impact in this document. It would reuse the `@earendil-works/pi-tui` dependency we already carry.

### Update discovery, notices, and staged updates

A background coordinator starts unawaited at host start and runs a lease-based single-owner-per-scope loop. It polls scope inventory every 30 seconds. The per-marketplace cadence is `paused` (0) or `conservative` (24 hours plus or minus 2 hours). The other two values are `balanced` (6 hours plus or minus 30 minutes) and `frequent` (1 hour plus or minus 5 minutes). Each cadence has exponential failure backoff and deterministic SHA-256-derived jitter. Comparison uses the immutable revision and content digest, not semver. Semver only resolves npm ranges.

They raise one `UpdateNotice` per discovered revision. Each notice carries the plugin identity, the installed and available version and revision, and an automatic-or-manual disposition. Notices have unread tracking, bounded retention (64 resolved per plugin, 4096 per scope, 100 per dispatch), and auto-resolution as `installed`, `superseded`, or `plugin-removed`. Notification is independent of the automatic-update policy, which is the design point worth copying.

Automatic updates and update-all commit the new revision in the background and deliberately leave the transition pending. The new revision activates on the next start or reload. This means an update run never needs a reload-capable command context, and one pass can stage every eligible plugin. The user sees "update staged -- live next start", or "recovery required" if the startup sweep could not settle it. A foreground single-plugin update activates immediately.

Our counterpart is `pending`, which previews the reconcile plan without network and writes nothing. We have no discovery loop, no notices, and no staged activation. Adding discovery and notices reuses `pending` and the notification catalog.

### The doctor diagnostic registry

Their `/plugins doctor [plugin] [--scope] [--include-adoption]` has safety class `local-read`. All findings come from one frozen registry, `NativeDiagnosticRegistry` (`src/application/native-diagnostic-registry.ts:8-60`), with about 48 stable codes across 12 categories. Each entry carries `code`, `category`, `severity`, `rank`, `blocks`, `unavailable`, `action`, and `summary`. Findings are deduplicated and given deterministic ids of the form `native-diagnostic-v1:sha256:...`. They are then sorted by rank and severity, and rolled into a host condition of `ready`, `degraded`, `unavailable`, or `blocked`.

The part worth copying is that remediation is not free text. It is a closed nine-token `action` vocabulary: `run-recovery`, `review-trust`, `provide-configuration`, `reload-runtime`, `refresh-marketplace`, `inspect-source`, `retry-read`, `review-update`, and `trust-project`. Human rendering is one line per finding, in the form `SEVERITY CODE - action`.

We have no `doctor` or `health` command. We have three read-only surfaces instead: `pending`, `list`, and `info`. A registry on our side would reuse the closed status and reason sets that `shared/notify.ts` and `docs/output-catalog.md` already define.

### The portable project declaration and sync

Their `<projectRoot>/.pi/plugins.json` is the committed, portable half of project state. It carries the schema version, marketplace sources restricted to `github` and `git`, the requested plugin identities, constraints, and enabled intent. It explicitly carries no absolute paths, no caches, no timestamps, no credentials, and no trust. They write it with a temporary file, an fsync, and a hard link, and never by overwrite, so an editor save cannot be clobbered.

The machine-local half is the `projectLocal` SQLite document. It carries a `declarationDigest` that pins the last portable declaration this machine reconciled against, with the sentinel `portable-project-intent-unsynchronized-v1` when fresh. The command `project sync --mode apply-intent|publish-intent|merge` reconciles the two halves.

Our `claude-plugins.json` and `claude-plugins.local.json` pair is the closest thing we have, and it overlaps this partly. We have no reconcile command and no digest that records what a machine last synchronized against. Closing the gap reuses the existing configuration pair rather than adding a new file.

### Codex compatibility

They carry a parallel reader set under `src/formats/codex/` for manifest, marketplace, hooks, MCP, and state, alongside `src/formats/claude/`. Catalog paths are `.claude-plugin/marketplace.json` and the Codex-native `.agents/plugins/marketplace.json`. Manifest paths are `.claude-plugin/plugin.json` and `.codex-plugin/plugin.json`. A Claude manifest additionally carries `strict`, which decides manifest-against-catalog authority. A Codex manifest additionally recognizes `apps` and `connectors`, both unsupported.

Host precedence is `DEFAULT_HOST_PRECEDENCE = ["claude","codex"]`, and the user sets it with `/plugins config host-precedence claude-first|codex-first`. Precedence applies at catalog merge and at bundle reconciliation. A conflicting runtime component declaration between the two manifests raises a `CLAIM_CONFLICT` diagnostic and drops only that entry, so valid siblings survive. Conflicting presentational metadata resolves by precedence: marketplace entry, then Claude, then Codex. A dual-root name disagreement is fatal to registration. They keep committed fixtures for both the equivalent and the conflicting dual-host cases. Codex skill presentation is a separate `agents/openai.yaml` file, metadata-only except for recognized invocation-policy keys.

We are Claude-only. The payoff is roughly double the addressable marketplace population. The research names no seam on our side to reuse for it.

### Neither project sandboxes execution

This is worth stating plainly, because the trust and network work above can read as a sandbox. It is not one. Once a plugin is trusted, their hook commands run as ordinary child processes with full OS privileges. Their `hook-executable-resolver.ts` resolves whatever command string the plugin declares, with no allowlist. Their guarded execution is resource bounds only: 8 concurrent processes, 256 KB of stdin, and 64 KB of stdout and stderr. The timeout is 10 seconds by default, with a 600-second maximum and a SIGTERM then SIGKILL process-group teardown. Their containment sits at the supply-chain and consent layer. Ours sits at the write-target layer, through path containment and atomic writes. Neither is at the execution layer.

Our own execution surface is looser. Hook commands spawn with `shell: true` when `args` is absent. Each enabled plugin's `bin/` directory is appended to `PATH`, never prepended, to avoid CWE-426. MCP stdio servers launch with the plugin-declared `env` overriding our injected defaults.

## What we have that they do not

### Slash commands and Claude agents

They translate neither. No `commands/` convention scan exists anywhere in their `src/`, and a declared `commands` field is inert metadata (`src/domain/foreign-identity.ts:11`). Claude agents and agent teams are on their explicit non-goals list. We translate a slash command into a Pi prompt template at `resources/prompts/<plugin>:<command>.md`. We translate a Claude agent into `<scopeRoot>/agents/pi-claude-marketplace-<plugin>-<agent>.md` with an `agents-index.json` entry, a 7-entry tool map, a `Skill` to `inheritSkills: true` rule, and a `--map-model` flag.

### Partial installs and soft-dependency degradation

They install a plugin whole. Partial plugin installation is on their explicit non-goals list, and a component kind they do not support makes the plugin all-or-nothing. We surface an unsupported component kind as `partially-available` and install it with `--partial`. We also soft-depend on the upstream `pi-subagents` and `pi-mcp-adapter` packages and degrade presentationally when they are absent, rather than forking them.

### Structurally enforced offline guarantees

Our offline promise is enforced by a test, not by convention. `tests/architecture/no-orchestrator-network.test.ts` greps `install.ts`, `list.ts`, `reinstall.ts`, `info.ts`, `fetch.ts`, `enable-disable.ts`, `marketplace/info.ts`, and all three reconcile files for `platform/git`, `DEFAULT_GIT_OPS`, `gitOps`, and `refreshGitHubClone`. Only `update.ts` is exempt. All git access flows through the `clone-cache.ts` seam by entrypoint name. Their equivalent guarantee is a property of the code, not a gate that fails the build.

### Hook coverage depth

We support 10 Claude hook events, and the two supported sets differ in kind rather than only in size. We map `StopFailure` to `agent_settled` for the `error` and `length` endings, over a closed 10-value error-type set. They retain `StopFailure` without activating it. Our `if:` compiler (`bridges/hooks/if-field/`) has five arms: `match-all`, `bash`, `path-tool`, `mcp-literal`, and `mcp-server-prefix`. Their `if` is field-based over `tool_name`, `tool_input`, `tool_response`, and `hook_event_name`. Ours is tool-pattern and path-pattern based. These are different designs, and neither is a superset of the other.

We activate an async-rewake lane that they retain without activating. Our `asyncRewake: true` spawns detached in the registry and returns `noop` at once, then injects on exit 2 through `pi.sendMessage({customType:"claude-hook-rewake"})`. Our wire protocol caps stdin at 256 KiB of UTF-8 and assigns `_truncated: true` last, so a payload key cannot win. Exit 2 blocks with stderr as the reason, and any other non-zero exit is a no-op with a debug log. An exit-0 JSON body has the precedence `continue:false`, then `decision:"block"`, then `permissionDecision:"deny"`, then accumulate. We run one child at a time, where they cap at 8 concurrent processes.

### Adoption of the installed plugin set

They adopt marketplace declarations. We adopt marketplace declarations and the installed plugin set. We read `enabledPlugins` from Claude's `settings.json` and `settings.local.json` in both scopes. For a user migrating off Claude Code, that is the difference between one command and rebuilding the plugin list by hand.

### The Node floor and zero-build distribution

Our Node floor is `>=20.19.0` and theirs is `>=24`, because they use `node:sqlite`. We ship no build step, because Node strips TypeScript natively, and they compile to `dist/` with `tsc`. Our peer floor of `>=0.80.5` on the Pi API is enforced by a test. Theirs is a peer range of `*` with a dev pin at `0.82.0` and internal ranges of `>=0.80.0 <1.0.0-0`.

### Read-only LLM-facing tools

We register exactly two tools (`edge/handlers/tools.ts`), and mutating tools are explicitly out of scope. `pi_claude_marketplace_list` takes no parameters and returns one line per marketplace in the form `[<scope>] <name> -- <N> plugin(s) -- <source.logical>`, plus a structured `details.marketplaces` field. `pi_claude_marketplace_plugin_list` takes optional `marketplace`, `scope`, `installed`, `available`, and `unavailable` parameters, and returns rendered lines plus `details.plugins[]`. It flattens our rich status set into three buckets. The values `upgradable`, `partially-installed`, and `partially-upgradable` become `installed`. The value `remote` becomes `available`. The values `partially-available` and `disabled` become `unavailable`. Tools never call `ctx.ui.notify` and return an `AgentToolResult`. Whether they expose equivalent LLM-callable tools is UNVERIFIED.

## Their declared limitations

These are their own self-documented limitations at this commit, not our findings:

- Slash commands are not translated at all, and Claude `agents/` files are not activated.
- LSP servers, monitors, themes, output styles, settings, channels, plugin dependencies, and Codex apps and connectors are retained and never activated.
- Cross-marketplace plugin dependencies, the dependency graph, and semver constraints are incompatible.
- About 17 Claude hook events are retained and not activated, and `async` and `asyncRewake` are retained and not activated.
- MCP tool aliases are unavailable, and legacy SSE, WebSocket, and `headersHelper` are retained and not activated.
- Git submodules fail materialization outright.
- There is no partial installation. A plugin is all-or-nothing.
- Secret custody is unconditionally unavailable on every platform.
- Trust review never live-probes remote MCP servers.
- The `path-only` project identity is explicitly tagged unstable.
- Staged-update finalization assumes that a Pi reload is a full host restart. A warm-reload Pi would need a new finalization hook, which they acknowledge as a design gap.
- There is no trust-revocation command, although the domain primitive exists and is exported.
- There is no manual rollback command.
- Their backlog item `backlog-npm-sha1-integrity-fallback.md` records that npm packuments without a SHA-512 integrity hash hard-fail source resolution with no override. This breaks packages published before 2015 and many private registries. Their own audit calls the strict stance "ceremony" that "defends against nothing real."

## Where we are behind on our own terms

This section is the counterweight to the previous one. These limitations are recorded in `CLAUDE.md`, `docs/`, and `CHANGELOG.md`.

Scope limits:

- Claude's `local` scope has no Pi equivalent, so we ship exactly two scopes.
- `npm` is the one unsupported plugin-source kind.
- We support no SSH, no remote `marketplace.json` URLs, no sparse checkout, no browser `/tree/` URLs, and no marketplace-level `git-subdir`.
- Components beyond skills, commands, agents, `mcpServers`, and hooks are surfaced and never installed.

Feature limits:

- We do not support 20 Claude hook events, nor the `http`, `mcp_tool`, `prompt`, and `agent` handler types.
- We do not support full regular-expression matchers, MCP wildcards, or `${tool_input.*}` and `${user_config.*}` interpolation.
- We do not support `statusMessage`, `systemMessage`, `terminalSequence`, hook dedupe, `settings.json` hook surfaces, or `disableAllHooks`.
- `asyncRewake` is inert on `Stop` and `StopFailure` by design.
- `CLAUDE_ENV_FILE` is exposed but not sourced back.
- A user-scope `${CLAUDE_PROJECT_DIR}` stays literal, because it is unknowable at install time.
- We resolve no dependencies automatically. A declared `dependencies` field produces a manual-install warning only.
- Custom component-path arrays replace the defaults rather than supplement them. This is an acknowledged deviation from the upstream specification.
- We have no mutating LLM tools, no interactive selectors, and no JSON output. We also have no dry-run modes, no session-start autoupdate run, and no managed, allowlist, or blocklist policies.
- We have no telemetry and no message catalog, and we are English only, which a test enforces.
- Uninstall removes the plugin data directory unconditionally after commit (`orchestrators/plugin/uninstall.ts:633`). We have no `--keep-data` equivalent.
- The reconcile cascade is visible at Pi startup but not after `/reload`, because the host rebuilds the chat from the transcript and drops extension notifications. The workaround is to run `pending` before the reload, or `list` after it.

Accepted residual risks:

- A TOCTOU window exists between `assertPathInside` and the write.
- `retries: 0` on the state lock makes two concurrent Pi sessions in one project noisy.
- `stale: 10_000` means a process suspended for more than 10 seconds can have its lock stolen. The blast radius is limited to last-writer-wins by `write-file-atomic`.

## Strengths and weaknesses

The sections above state the evidence. This section states the judgement that follows from it.

### Their strengths

Their security engineering is the best work in this comparison, and it is not close. DNS pinning, exact-string origin allowlists, a hardened TAR reader, four layers of redaction. Trust gets the same care. Content-bound grants ship with a continuity rule that lets exact-content trust survive an update, so the design holds together rather than looking bolted on afterwards.

The interactive manager is the single most visible capability either project has. Behind it sits an automation grammar we cannot match: machine-readable output, stable exit codes, pagination, operation tokens, and a versioned grammar that one of their own tests checks against their specification. Codex support roughly doubles the marketplaces they can reach.

Two of their advantages are not code at all. Bundling into a one-install harness reaches users who never compare plugin hosts. And their changelog records their own failures in unusual detail while their backlog criticizes their own strictness. That is a healthy engineering culture, and it is the reason several claims in this document can cite them against themselves.

### Their weaknesses

Two of the five component kinds are missing by design. No slash commands, no Claude agents. For someone migrating from Claude Code that is a large hole, and it stays quiet until the plugin they wanted stops doing what it used to do. Installs are all or nothing, so a single unsupported component kind blocks the whole plugin.

Plugin user configuration stops at the first secret. Their secret store returns unavailable on every platform, and the tree holds no Keychain, libsecret, or Windows Credential Manager code. Trust cannot be revoked through the product either. The primitive is exported, and nothing calls it.

The problem most likely to bite a user is the reliability one. Four consecutive releases walked back over-aggressive fail-closed platform guards, and their own author calls the third of them "the third round of the same anti-pattern in this adapter." The Node `>=24` floor follows from `node:sqlite` and shuts out a large installed base. Their documentation disagrees with their code in four places, including a terminal manager described with five sections that the code no longer has. And nobody has yet starred, forked, or filed an issue against the repository.

The section "Their declared limitations" above carries the fuller list, in their own words rather than ours.

### Our strengths

We translate five component kinds to their three, including the two they refuse. An unsupported kind never blocks the rest, and an absent companion extension degrades presentationally instead of failing outright. We adopt marketplace declarations and the installed plugin set, which for someone leaving Claude Code is the difference between one command and rebuilding a plugin list by hand.

Some of our guarantees are enforced rather than promised. A test greps the orchestrators for git surfaces and fails the build, so the offline guarantee cannot rot quietly. Our hooks go deeper where it counts: ten events, `StopFailure` mapped over a closed error-type set, and a live async-rewake lane that they retain without activating.

We are also cheaper to run. The Node floor is `>=20.19.0`, there is no build step because Node strips our TypeScript natively, and we carry three runtime dependencies against their seven, two of which are forks they have to maintain themselves. Seventeen stars, eight forks, and two merged external pull requests make a small community, but a real one.

### Our weaknesses

We have no trust model. Plugin code is trusted on install, with no signatures, no checksums against a trusted digest, and no allowlist. We have no egress policy either, and no DNS pinning or origin allowlist, and that is the one gap on this list with no seam on our side to reuse.

The interface and automation gaps are broad. No interactive manager, because we import pi-tui for a single type at three sites. No machine-readable output, no exit codes, no pagination, and no dry run beyond `pending`. No plugin user configuration, so a plugin that declares it downgrades to `partially-available`. No npm plugin sources. No update discovery of any kind: no timer, no notices, no session-start run. No Codex support.

Two smaller items do real damage in use. Uninstall deletes the plugin data directory unconditionally, so the contents of `${CLAUDE_PLUGIN_DATA}` disappear with no prompt. And the reconcile cascade is invisible after `/reload`, because the host rebuilds the chat from the transcript and drops extension notifications on the way.

The section "Where we are behind on our own terms" above carries the full self-reported list, including accepted residual risks.

## Opportunities

The cheapest wins here are positioning, not engineering. We are the only project that reads Claude's installed plugin set, and nobody claims migration as a headline, so that one costs the time it takes to write it down. Graceful degradation is the same kind of opening. Partial installs answer a real fear, that installing a plugin will fail wholesale, and their explicit non-goal means they cannot answer it without reversing a stated principle. Both projects promise offline safety, and only ours fails the build when the promise breaks, so the stronger version of their own claim is ours to make.

On the build side, plugin user configuration is the standout. Their implementation cannot complete when a value is sensitive, so shipping the non-sensitive subset reuses `shared/vars.ts` and puts us ahead of them on an axis they built. Machine-readable output and stable exit codes unblock scripted use, which nothing we ship today supports. Their `>=24` Node floor shuts out the Node 20 and 22 installed base, and they cannot lower it without removing `node:sqlite`. The diagnostic registry is worth copying at the level of shape rather than system: stable codes with a closed remediation vocabulary slot into the closed status and reason sets we already maintain and gate.

## Threats

The serious one is distribution. Their `pi-enhanced` package ships the plugin host inside a one-install harness that promises the whole setup with no versions to coordinate. A user who adopts that harness gets a plugin host by default, runs no comparison, and never weighs product merit at all. We can lose without ever being evaluated, and no amount of component coverage answers that.

Category capture is the slower version of the same problem. If "native plugin management for Pi" becomes the accepted name for this category, our position reads as a narrower compatibility shim rather than a peer. A related risk sits in security. If content-bound trust becomes what users expect from a plugin host, our install-time model turns into a stated deficiency rather than a simpler design, and their work there is genuine enough that we could not answer it quickly.

Three more are worth tracking rather than acting on. Codex support compounds for them and not for us if those marketplaces grow. A solo maintainer with no review overhead ships fast, and thirty-one releases in three weeks is faster than a feature comparison suggests. And they maintain forks of the MCP adapter and subagents that we soft-depend on upstream, so if their forks lead and upstream lags, our degradation path gets worse through no action of ours.

The last threat is the one that should keep us honest, because it is the easiest for them. Slash commands and partial installs are our two largest structural advantages, and both are stated non-goals rather than technical barriers. A change of mind removes both. Their `foreign-identity` module already retains the metadata that a commands implementation would need.

### The nightmare scenario

They add slash commands and partial installs, keep their trust and manager work, and the `pi-enhanced` harness becomes the default way Pi users acquire extensions. Our differentiation narrows to Claude installed-set import and a lower Node floor, and neither is visible at the moment a user picks a harness.

The early warning signs are specific: any commit that adds a `commands/` convention scan, any edit to the explicit non-goals list in their `docs/COMPATIBILITY.md`, and any growth in `pi-enhanced` adoption relative to standalone `pi-plugins`.

## Strategic implications

### Build

- Uninstall data disposition. It closes a data-loss path, and it is the smallest change here.
- Plugin user configuration, non-sensitive subset first.
- Update discovery and notices, with notification decoupled from automatic-update policy.
- Machine-readable output and a stable exit-code vocabulary.

### Accelerate

- Positioning that names migration and graceful degradation. It costs writing time and answers the category-capture threat directly.
- The doctor registry shape, because it reuses catalogs we already maintain and gate.

### Deprioritize

- Their SQLite, lease, and journal state machinery. The cautions section gives the evidence.
- Codex compatibility, until the Codex marketplace population justifies it.
- Execution sandboxing. Neither project has it, and no user is choosing on it today.

### Differentiate or reach parity

| Area                             | Stance            | Reason                                                |
| -------------------------------- | ----------------- | ----------------------------------------------------- |
| Component coverage               | Differentiate     | Their non-goals make this hard for them to answer     |
| Partial installs and degradation | Differentiate     | Reversing it contradicts a stated principle of theirs |
| Claude migration                 | Differentiate     | We have the capability already and do not claim it    |
| Offline guarantees               | Differentiate     | Ours is enforced, theirs is conventional              |
| Plugin user configuration        | Parity, then pass | Their sensitive-value path cannot complete            |
| Automation surface               | Parity            | Table stakes for scripted use                         |
| Diagnostics                      | Parity            | Adopt the shape, not the system                       |
| Interactive manager              | Parity, later     | Highest visible impact, and milestone-sized           |
| Trust model                      | Parity, later     | Real value, but it must ship with a continuity rule   |
| Network hardening                | Do not chase      | No seam on our side, and no user is choosing on it    |
| Codex support                    | Monitor           | Revisit when the marketplace population moves         |

### Monitor

- Any commit that adds a `commands/` convention scan to their tree.
- Any change to the explicit non-goals list in their `docs/COMPATIBILITY.md`.
- Growth of `pi-enhanced` downloads compared with standalone `pi-plugins`.
- Whether they lower the Node floor by removing `node:sqlite`.
- Whether a trust-revocation verb appears.
- Their star and issue counts, as a reach signal independent of the bundle.

## Design patterns worth borrowing

Each item below is a pattern rather than a feature, and each names the seam it would attach to on our side.

- **Notification is independent of automatic-update policy.** A user who never enables automatic updates still learns that an update exists. Seam: the `pending` verb and the notification catalog in `shared/notify.ts`.
- **Preview, then apply, for every policy change and every destructive change.** Their `--preview-only` flag is one code path with two dispositions, not a separate dry-run implementation. Seam: `pending`, which already produces a network-free plan that writes nothing.
- **A closed remediation-action vocabulary attached to stable diagnostic codes.** The reader gets a code to search for. The reader also gets one of nine actions to take, never free text. Seam: our closed status and reason sets, gated against `docs/output-catalog.md`.
- **Aliases are exact alternate paths that carry deprecation metadata.** Each alias records `deprecatedSince`, `replacement`, and `removeInMajor`, so removal is scheduled rather than sudden. Seam: `edge/flag-catalog.ts` and the router alias table, which already have a drift test.
- **Removal requires an explicit data disposition.** Their `remove` verb refuses to run until the user picks `--keep-data` or `--delete-data`. Seam: `orchestrators/plugin/uninstall.ts`, which today deletes the data directory unconditionally.
- **Project state splits into a portable half and a machine-local half.** The committed half carries intent and no absolute paths. The local half carries a digest of what this machine last reconciled against. Seam: the `claude-plugins.json` and `claude-plugins.local.json` pair.
- **Foreign-state adoption is read-only by construction, not by discipline.** Their port exposes only `readAll`, and the Node implementation calls only `lstat`, `open(O_RDONLY|O_NOFOLLOW)`, `read`, `realpath`, and `close`. Seam: `orchestrators/import/`, which is read-only against Claude's files today but does not prove it in the type.

## Cautions

Do not adopt their SQLite, lease, and journal state machinery. Copy the outcomes, such as data-disposition choices and crash-recovery reporting, and not the mechanism. Their own changelog documents three rounds of the same fail-closed-guard anti-pattern breaking non-Linux platforms.

Their Node `>=24` floor is a direct consequence of `node:sqlite`. Our `>=20.19.0` floor is worth more than the state machinery that raising it would buy.

Their dependency on the `git` binary buys submodule fidelity and credential-helper fidelity, at the cost of portability. Our `isomorphic-git` choice is a deliberate trade and not an oversight.

The evidence for the first caution is their own release history, which is unusually candid:

| Release | Guard removed or fixed                                                                                                                                                                                           | Failure mode                                                                                                                                                                                                                                                                                                     |
| ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| v0.2.3  | `st_dev` treated as a stable file identity                                                                                                                                                                       | btrfs and overlayfs assign anonymous device numbers per mount, so every reboot changed the device while files and inodes were unchanged. The host hard-failed startup with "SQLite database identity marker does not match its path", and project keys rotated each mount epoch, orphaning project-scoped state. |
| v0.2.4  | The entire SQLite file-identity machinery: `.identity` markers, `.initializing` claims, root identity markers, device and inode verification, hard-link handle aliases, and per-transaction root re-verification | In their words, it "false-positive-broke normal operation after every routine reboot ... while never catching a real replacement."                                                                                                                                                                               |
| v0.3.4  | A `statfs.f_type` magic-number filesystem-capability gate                                                                                                                                                        | The author calls it "the third round of the same anti-pattern in this adapter." It "fails closed on every real macOS APFS/HFS+ volume" and had been failing closed on Windows and FreeBSD the entire time, in silence.                                                                                           |
| v0.3.5  | Linux `/proc` process-start evidence required during staging                                                                                                                                                     | Marketplace registration failed on macOS.                                                                                                                                                                                                                                                                        |

This is evidence about a mechanism, not a judgement about the project. The same tree also holds the most careful network and archive hardening in this comparison.

One more caution about their documentation. Four drifts between their documentation and their code exist at this commit. Their README and ARCHITECTURE describe a five-section terminal manager that no longer exists, against two views and four filters in the code. Their README states a pin of `@nklisch/pi-mcp-adapter@2.11.0-nklisch.0` while `package.json` and the runtime constant say `2.20.1-nklisch.0`. Their SPEC acceptance criteria reference `@nklisch/pi-subagents@18.0.4-nklisch.1` while `package.json` depends on `18.1.0-nklisch.0`. Their SPEC still reads "incompatible blocks the plugin". The newer rule in their COMPATIBILITY.md is that "incompatible is reserved for security gates; everything else degrades to metadata-only." Read their code, not their documentation.

## Prioritized recommendations

The size column carries the estimate made during the source review. Where that review reached no estimate, the cell reads "Not stated."

| #   | Recommendation                                                 | Why this rank                                                                                                                                                                                | Size            | Reuses on our side                                                                           |
| --- | -------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------- | -------------------------------------------------------------------------------------------- |
| 1   | Uninstall data disposition (`--keep-data` and `--delete-data`) | Smallest change, and it closes a real data-loss path where the contents of `${CLAUDE_PLUGIN_DATA}` vanish in silence                                                                         | Smallest change | `orchestrators/plugin/uninstall.ts`, which already deletes the directory unconditionally     |
| 2   | `userConfig` support                                           | Largest install-success gain per unit of work. Skip sensitive-value custody at first, because their own custody is fail-closed everywhere, so the non-sensitive subset is the shippable part | Not stated      | The `${...}` substitution machinery in `shared/vars.ts`                                      |
| 3   | Update discovery and notices                                   | Maps onto machinery we already have, and it brings the two design points worth copying: notification decoupled from automatic-update policy, and preview-then-apply for policy changes       | Not stated      | The `pending` verb and the notification catalog                                              |
| 4   | A `doctor` verb                                                | The registry shape, with stable codes and a closed remediation-action vocabulary, slots into our existing catalog rather than fighting it                                                    | Not stated      | Our closed status and reason sets                                                            |
| 5   | npm plugin sources                                             | Self-contained, and it removes our one unsupported plugin-source kind                                                                                                                        | Self-contained  | The `npm` arm already parsed in `domain/source.ts`, which the resolver rejects today         |
| 6   | Machine-readable output and a stable exit-code vocabulary      | Unblocks scripted use, which nothing we ship today supports                                                                                                                                  | Not stated      | The `list`, `info`, and `pending` verbs                                                      |
| 7   | Content-bound trust grants                                     | Real security value, but it must ship together with a trust-continuity rule or every update breaks trust. Add the revoke verb that theirs lacks                                              | Milestone-sized | Our deterministic content-hash version derivation                                            |
| 8   | An interactive terminal manager                                | Highest visible impact of any item here. Read their v0.1.2 to v0.1.5 changelog first: they rebuilt it three times                                                                            | Milestone-sized | The `@earendil-works/pi-tui` dependency we already carry, and `edge/completions/provider.ts` |
| 9   | Portable project declaration and sync                          | A team-onboarding story that our configuration pair partly covers today but does not complete                                                                                                | Not stated      | `claude-plugins.json` and `claude-plugins.local.json`                                        |
| 10  | Codex compatibility                                            | Strategic rather than urgent, and it roughly doubles the addressable marketplace population                                                                                                  | Not stated      | Not stated                                                                                   |

Two rows carry a caution. On item 5, copy their packument, tarball, and no-lifecycle-scripts approach, and do not copy the SHA-512 absolutism that their own backlog flags as harmful. On item 8, read their v0.1.2 to v0.1.5 changelog before any design work, because they rebuilt the manager three times inside four minor releases.

One recommendation sits outside the table, because it is not a build item and it carries no engineering cost: state the migration and degradation positions in our README and our package description. Both capabilities ship today. Neither is claimed. The positioning analysis explains why that omission helps a competitor whose frame turns missing Claude features into deliberate boundaries.

## Appendix A: headline metrics

| Metric               | Them                                                               | Us                                                          |
| -------------------- | ------------------------------------------------------------------ | ----------------------------------------------------------- |
| Source size          | 79,579 LOC over 417 `.ts` files                                    | 57,552 LOC over 202 `.ts` files                             |
| Tests                | 1,558 `it()` and `test()` sites, 365 files, Vitest 4               | 3,254 tests, 223 files, `node:test`                         |
| Node floor           | `>=24`, hard, because it uses `node:sqlite`                        | `>=20.19.0`                                                 |
| Distribution         | Compiled to `dist/` with `tsc`                                     | No build step; Node strips TypeScript natively              |
| Pi API               | peer `*`, dev-pinned `0.82.0`, internal ranges `>=0.80.0 <1.0.0-0` | peer `>=0.80.5`, dev `^0.83.0`, floor enforced by a test    |
| Runtime dependencies | 7, including bundled forks of the MCP adapter and subagents        | 3: `isomorphic-git`, `proper-lockfile`, `write-file-atomic` |
| Git transport        | Spawns the `git` binary (`options.gitExecutable ?? "git"`)         | `isomorphic-git`, pure JavaScript, no binary needed         |
| Boundary gates       | About 25 `dependency-cruiser` rules inside `npm test`              | Architecture tests as grep gates inside the suite           |
| Release span         | v0.1.0 to v0.3.5, 2026-07-24 to 2026-08-08                         | Ongoing since earlier                                       |

Their two runtime siblings are maintained MIT forks that the author publishes himself. `@nklisch/pi-subagents` forks `@gotgenes/pi-subagents@18.0.3`, and `@nklisch/pi-mcp-adapter` forks `nicobailon/pi-mcp-adapter@2.11.0`. Both were forked because the upstream packages lacked a programmatic contract. We soft-depend on the upstream packages instead, and we degrade presentationally when they are absent.

## Appendix B: subsystem detail

This appendix is the reference layer. It is dense and factual, and it carries no recommendations.

### Update and pinning model

Their background coordinator starts unawaited at host start. It runs a lease-based single-owner-per-scope loop and polls scope inventory every 30 seconds. The per-marketplace cadence is `paused` (0) or `conservative` (24 hours plus or minus 2 hours). The other two values are `balanced` (6 hours plus or minus 30 minutes) and `frequent` (1 hour plus or minus 5 minutes). Each cadence carries exponential failure backoff and deterministic SHA-256-derived jitter. Comparison uses the immutable revision and content digest rather than semver, and semver only resolves npm ranges.

Their policy precedence runs from plugin override, to marketplace override, to scope or project, to global. Four hard guards force `manual` regardless of policy: a `local-git` source, a `legacy-unavailable` identity, marketplace-source drift, and plugin-source drift. Automatic updates are disabled by default for third-party sources.

Their denial codes are `POLICY_MANUAL`, `LOCAL_SOURCE`, `MARKETPLACE_SOURCE_CHANGED`, `PLUGIN_SOURCE_CHANGED`, `LEGACY_SOURCE_IDENTITY`, `BASELINE_TRUST_ABSENT`, `BASELINE_TRUST_REVOKED`, `PROJECT_UNTRUSTED`, and `STATE_STALE`. Their eligibility reasons are `eligible`, `manual`, `approval-required`, `stale`, `project-untrusted`, `recovery-required`, `configuration-required`, `secret-unavailable`, `capability-unavailable`, and `retryable`.

Their pinning is a property of the source declaration. A full 40-hex `sha` is authoritative over a `ref` and becomes the resolved trust identity. There is no dedicated pin subsystem.

Their rollback is automatic on activation failure only. Prior revisions are retained as `revisions[]` with a `selectedRevision`, with a 24-hour unreferenced grace before mark-and-sweep garbage collection. Their `restoreAndVerify()` writes back the previous revision, reloads, and then verifies that the rollback itself activated. A failure at that point degrades to `recovery-required`. There is no manual rollback or revert command. The only levers are `update` with an explicit candidate id, or an edit to the source `ref` or `sha`.

Our behavior is per verb:

| Verb                             | Network                            | Behavior                                                                                                                               |
| -------------------------------- | ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `install`                        | On cache miss only                 | Uses the cached manifest and does no sync                                                                                              |
| `update`                         | Yes                                | Re-resolves the pin, refreshes the mirror, and short-circuits when `toVersion === fromVersion`                                         |
| `fetch`                          | Yes, because that is the operation | Writes no state. A pinned and materialized plugin renders `(skipped) {up-to-date}` with no network                                     |
| `reinstall`                      | Almost never                       | Never resolves a pin. Repairs the filesystem only, from the warm mirror, using the recorded sha                                        |
| `uninstall`, `enable`, `disable` | Never, and a gate enforces it      | Disable zeroes resources but keeps the record. Enable replays the ledger with `pinVersionOverride`, so a cycle cannot bump the version |

Our version strings are `hash-<12hex>`, a SHA-256 over a deterministic walk with symlinks skipped and BOM and CRLF normalized, or `sha-<12hex>` for a git source. The ladder runs from `pinVersionOverride`, to the git `resolvedSha`, to `plugin.json.version`, to the manifest entry version, to the content hash.

Our autoupdate is opt-in and off by default, and it lives in `claude-plugins.json` rather than in state. There is no timer, no interval, and no session-start update run. The flag is consumed only by `marketplace update`. When autoupdate is off, change detection is a conservative manifest content compare with `JSON.stringify` before and after.

Our offline guarantee is a grep gate. `tests/architecture/no-orchestrator-network.test.ts` scans `install.ts`, `list.ts`, `reinstall.ts`, `info.ts`, `fetch.ts`, `enable-disable.ts`, `marketplace/info.ts`, and all three reconcile files for `platform/git`, `DEFAULT_GIT_OPS`, `gitOps`, and `refreshGitHubClone`. Only `update.ts` is exempt, and git access flows through the `clone-cache.ts` seam by entrypoint name.

Our git surface lives in `platform/git.ts`, the only file that imports `isomorphic-git`. It exposes `clone`, `fetch`, `checkout`, `resolveRef`, `resolveRemoteRef` (through `listServerRefs`, with no clone), `forceUpdateRef`, `currentBranch`, `listBranches`, and `listRemotes`. It does not expose sparse checkout, shallow or `depth` clones, or submodules. A marketplace refresh is `fetch`, then `forceUpdateRef`, then `checkout`, and never `pull`.

### Diagnostics and user-facing output

Their doctor findings come from one frozen registry with about 48 stable codes across 12 categories:

- integrity: `STATE_CORRUPT`, `RECORD_CORRUPT`, `CATALOG_CORRUPT`, `SOURCE_INVALID`, `SOURCE_DOCUMENT_INVALID`, `SOURCE_DECLARATION_CONFLICT`, `SOURCE_CONTENT_UNSAFE`
- recovery: `RECOVERY_REQUIRED`, `TRANSITION_PENDING`, `RECOVERY_DEFERRED`, `RECOVERY_BLOCKED`, `HOST_STARTUP_BLOCKED`
- trust: `PROJECT_UNTRUSTED`, `TRUST_REQUIRED`, `TRUST_REVOKED`, `TRUST_EVIDENCE_INVALID`
- compatibility: `COMPATIBILITY_INCOMPATIBLE`
- capability: `RUNTIME_REQUIREMENT_UNAVAILABLE`, `CAPABILITY_EVIDENCE_UNAVAILABLE`
- configuration: `CONFIGURATION_REQUIRED`, `CONFIGURATION_INVALID`, `SECRET_CUSTODY_UNAVAILABLE`
- activation: `REVISION_UNAVAILABLE`, `PROJECTION_UNAVAILABLE`, `ACTIVATION_EVIDENCE_MISMATCH`, `RUNTIME_EVIDENCE_MISSING`, `MCP_REGISTRATION_MISMATCH`, `MCP_REGISTRATION_MISSING`, `RUNTIME_EVIDENCE_UNAVAILABLE`
- live-health: `MCP_REMOTE_AUTH_REQUIRED`, `MCP_REMOTE_HEALTH_FAILED`
- update: `UPDATE_STAGED`, `UPDATE_AVAILABLE`, `UPDATE_APPROVAL_REQUIRED`, `UPDATE_MANUAL_REQUIRED`, `UPDATE_AUTOMATIC_PENDING`, `UPDATE_CONFIGURATION_BLOCKED`, `UPDATE_CAPABILITY_BLOCKED`, `UPDATE_CLOCK_REGRESSED`, `UPDATE_RECOVERY_REQUIRED`, `UPDATE_FAILED`
- freshness: `CATALOG_STALE`, `CATALOG_UNAVAILABLE`, `CANDIDATE_MISSING`
- evidence: `SOURCE_UNAVAILABLE`, `EVIDENCE_UNAVAILABLE`
- adoption: `ADOPTION_DOCUMENT_UNREADABLE`, `ADOPTION_DOCUMENT_CHANGED`

Their remediation is a closed nine-token `action` vocabulary: `run-recovery`, `review-trust`, `provide-configuration`, `reload-runtime`, `refresh-marketplace`, `inspect-source`, `retry-read`, `review-update`, and `trust-project`. Their `inspection-failure-projection.ts` translates raw domain diagnostics into a fixed eight-token reason vocabulary of `invalid-json`, `wrong-shape`, `missing-target`, `path-escape`, `field-conflict`, `source-unreachable`, `content-mismatch`, and `unreadable`, plus scrubbed provenance. Native error text and causes therefore never reach the public inspection surface.

They ship no logger, no telemetry, and no analytics. Their one durable log is `<agentDir>/plugin-host/logs/hooks.jsonl`, written fire-and-forget, rotated at 512 KB, one JSON object per line, with fields clipped to 256 characters.

We have no `doctor` or `health` command. We have three read-only surfaces. The verb `pending` is a network-free reconcile preview that writes nothing and is byte-identical on repeated runs. It renders `will install`, `will uninstall`, `will enable`, and `will disable` rows, plus `(failed)` rows. Marketplace additions are deliberately absent from it, because they are immediate. The verb `list` shows inventory across both scopes with the filter family, and renders a hash version git-style as `v#<7hex>`. The verb `info` shows the resolved source, the components enumerated from disk, the per-handler `event(matcher) (unsupported)` breakdown for dropped hooks, and the resolver verdict. It is network-free, so a cold clone renders `(remote)` and `components: not resolved` unless the user passes `--fetch`.

Our notification model (`shared/notify.ts`) is the single sanctioned output surface. A direct `ctx.ui.notify` call is forbidden by an ESLint rule and by a grep gate. The grammar is fixed:

```text
<glyph> <marketplace> [<scope>] (<status>) <marker>?
  <glyph> <name> [<scope>]? v<version>? (<status>) {<reasons>}?
```

The glyphs are `*` for installed or positive, `o` for not-installed with no error, and `(/)` for blocked or error. The rest are `(-)` for partially available, `(.)` for remote, and `(x)` for disabled. The exact characters are in `docs/output-catalog.md`. There are 26 status tokens and about 40 reasons, and both are closed sets. Severity is first-match-wins over the contents: any `failed` gives error, any `manual recovery` gives warning, any non-benign `skipped` gives warning, and otherwise info. The reload trailer fires only on realized plugin transitions and is structurally suppressed on the load-time reconcile cascade. The indent ladder is byte-exact at 0, 2, 4, and 6 columns, gated by `tests/architecture/catalog-uat.test.ts` against `docs/output-catalog.md`.

The symmetry is worth naming. Both projects enforce a closed diagnostic vocabulary. Theirs is shaped as a doctor registry. Ours is shaped as a notification catalog.

### State, storage, and concurrency

Their state is SQLite through Node 24's built-in `node:sqlite`, so there is no native module and there are no JSON state files. Five database families live under `<agentDir>/plugin-host/`: `state/v1/user.sqlite` and `state/v1/project-<sha256>.sqlite` (with `journal_mode=DELETE`, `synchronous=FULL`, `busy_timeout=0`), `locks/v1/*.sqlite`, `recovery/journal/v1/*.sqlite`, `recovery/leases/v1/leases.sqlite`, and `recovery/retention/v1/retention.sqlite`. Content lives on the filesystem, content-addressed under `staging/v1/`, `stores/v1/`, `data/v1/`, and `generated/v1/`.

They version six schema families independently: `hostConfig` at 4, `installedUser` at 2, `trust` at 1, `projectLocal` at 4, `portableProject` at 1, and `pointers` at 1. State documents are never migrated. An unknown or stale version raises `StateVersionCutoverError` and reinitializes the scope to generation-0 defaults, which they explicitly never report as corruption. Only the recovery journal does real `ALTER TABLE` migration.

Their cross-process lock is a held SQLite `BEGIN IMMEDIATE` transaction on a per-scope lock database. There are no lockfiles and no flock. The OS releases the lock when a holder is killed. They retry on `SQLITE_BUSY` with jittered backoff between 5 and 100 milliseconds, with a zero native busy timeout, cancellable through an `AbortSignal`. There is no lock expiry, no PID takeover, no heartbeat, and no fairness. Nested inside it is an in-process keyed mutation scheduler: FIFO, keyed by `scope:plugin`, with sorted multi-key acquisition and a `RecursiveMutationAcquisitionError` guard through `AsyncLocalStorage`. Their revision leases are garbage-collection pins rather than locks. Each lease records a PID and a start token, so content that a possibly live session is reading is never collected.

Their atomicity model is a generation compare-and-swap. A commit carries an `expectedGeneration` and writes generation plus one, in one transaction that also re-verifies the write. An independent post-hoc `provesMutationResult` step then rejects any commit result the coordinator cannot re-derive. Content promotion is stage, fsync, seal read-only at modes 555 and 444, write `READY.tmp`, rename, then publish visibility with `link(2)`, then fsync the store directory. They chose `link(2)` because it is atomic and fails with `EEXIST` instead of clobbering, and because Node lacks `renameat2(RENAME_NOREPLACE)` for directories.

They have exactly two scopes, `user` and `project`, as we do. Their "global" is a placement inside the user-scope `hostConfig` document, not a third scope. Project identity is either `repository`, built from the canonical root and an inode-based Git fingerprint, or a `path-only` fallback tagged `limitation: "identity-changes-with-canonical-root"`. The repository fingerprint is deliberately at v2, because `st_dev` broke on btrfs.

Their crash recovery (`src/application/recovery-service.ts`) is bounded per run at a 2-second budget, 128 transitions, and a 24-hour abandon grace. It classifies pending transitions by PID plus an OS start-time token, so a recycled PID cannot be mistaken for a live owner. The token is read from procfs on Linux and through native queries on macOS, BSD, and Windows. Live and unknown owners are always deferred and never touched. Dead owners get finalize-or-compensate, and ambiguous cases persist as `recovery-required`. Their startup order is load-bearing: runtime reconstruction runs before the recovery sweep, so a crash after a successful activation finalizes as completed rather than rolling back.

Our scope roots are `$PI_CODING_AGENT_DIR` or `~/.pi/agent` for user scope, and `<cwd>/.pi` for project scope. The extension root is `<scopeRoot>/pi-claude-marketplace`, branded and frozen in `persistence/locations.ts`. The files are `state.json` (authoritative), `.state-lock`, and the declarative desired state in `claude-plugins.json` and `claude-plugins.local.json`. The rest are `<scopeRoot>/agents/`, `<scopeRoot>/mcp.json`, `agents-index.json`, `resources/skills/`, `resources/prompts/`, the `*-staging/` directories, `sources/<mp>/`, `plugin-clones/<key>/`, `hooks/<plugin>/hooks.json`, and `data/<mp>/<plugin>/`. There is also `cache/`, which is optimization-only and safe to delete.

Our `state.json` accepts `schemaVersion: 1` or `2`, always writes 2, and carries real migrations. Our `claude-plugins.json` pins `schemaVersion: 1` as a literal, and a future version goes to a successor file rather than a bump. Our `loadConfig` never throws and returns `absent`, `invalid`, or `valid`. A zero-byte file lands in `invalid`, because coercing it to an empty desired state would render as a mass-uninstall plan. The `.local.json` file overrides at entry level and wholesale, never by deep merge. Our `config-write-back.ts` is structurally forbidden from importing the merge module, so a merged view can never be serialized back over the base file.

Our lock is `proper-lockfile` on the extension root, with `lockfilePath: .state-lock`, `retries: 0` (fail-fast into `StateLockHeldError`), `stale: 10_000`, and `update: 2_000`. It is not re-entrant, so guard-free ledger bodies exist for callers that already hold the lock.

Our ledger primitive is the generic `runPhases<C>`, and an install runs six phases: skills, commands, agents, hooks, mcp, and state. On a failure the failing phase's own `undo` runs first, then the reverse walk. Failures surface as `RollbackPartial[]` carrying the original `Error`. Recovery is `applyReconcile` on `resources_discover`. It diffs desired against actual into seven buckets, then applies them as uninstall, remove, add, install, enable, and disable. Four layers of per-scope and per-plugin isolation contain a failure. A pristine scope creates nothing, and `/reload` alone suffices for every recovery.

### Hooks

Their event mapping is in `src/domain/hook-runtime-contract.ts:20-51`:

- `SessionStart` to `session_start` and `session_compact`
- `SessionEnd` to `session_shutdown`
- `UserPromptSubmit` to `input`
- `PreToolUse` to `tool_call`
- `PostToolUse` and `PostToolUseFailure` to `tool_result`
- `PreCompact` to `session_before_compact`
- `PostCompact` to `session_compact`
- `Stop` to `agent_settled`
- `SubagentStart` and `SubagentStop` to subagent interception, which is capability-gated

About 17 other Claude events are retained and not activated. Among them are `PermissionRequest`, `PermissionDenied`, `Setup`, `UserPromptExpansion`, `PostToolBatch`, `Notification`, and `MessageDisplay`. The rest include `TaskCreated`, `TaskCompleted`, `StopFailure`, `TeammateIdle`, `InstructionsLoaded`, `ConfigChange`, `CwdChanged`, `FileChanged`, `WorktreeCreate`, `WorktreeRemove`, and the `Elicitation` family.

Their hook features are shell-form and exec-form commands, `timeout`, `statusMessage`, and `shell: bash|powershell`. They map tool-name aliases. `Bash` becomes `bash`, `Read` becomes `read`, `Write` becomes `write` or `apply_patch`, and `Edit` becomes `edit` or `apply_patch`. `Glob` becomes `find`, `Grep` becomes `grep`, and `Ls` becomes `ls`. They support regular-expression and exact-set matchers. Their `if` predicates use `equals`, `contains`, `matches`, `regex`, or `in`, over `tool_name`, `tool_input`, `tool_response`, and `hook_event_name`.

Their outputs are exit-2 blocking, `additionalContext`, `systemMessage`, `decision:block`, and a `permissionDecision` of allow, deny, or ask. The rest are `updatedInput`, `updatedToolOutput`, `continue:false`, `stopReason`, and a session-title update. Their `async` and `asyncRewake` are retained and not activated. They declare `permissionDecision:defer`, `terminalSequence`, `watchPaths`, and `CLAUDE_ENV_FILE` mutations incompatible.

Their `src/runtime/subagents/` machinery is not Claude-agent emulation, and Claude `agents/*.md` files remain inert metadata. It is lifecycle interception of Pi's own subagents. The `SubagentStart` and `SubagentStop` hook events therefore fire before the child prompt and before final completion. The interception can inject context, deny a turn, replace a result, or request bounded same-session continuation. The capability id is `pi.subagents.lifecycle-interception`.

Our canonical matrix is `docs/hooks-compatibility.md`. We support 10 events:

- `SessionStart` to `session_start`, with a `source` matcher restricted to `startup` and `resume`
- `UserPromptSubmit` to `input`
- `PreToolUse` to `tool_call`
- `PostToolUse` to `tool_result` when `!isError`
- `PostToolUseFailure` to `tool_result` when `isError`
- `PreCompact` and `PostCompact` to `session_before_compact` and `session_compact`, match-all only
- `SessionEnd` to `session_shutdown`, match-all only
- `Stop` to `agent_settled` for `stopReason: stop`
- `StopFailure` to `agent_settled` for `error` and `length`, over a closed 10-value error-type set

We classify 20 unsupported events as deferred, blocked on Pi, or permanently inapplicable.

Our `if:` compiler (`bridges/hooks/if-field/`) has five arms: `match-all`, `bash`, `path-tool`, `mcp-literal`, and `mcp-server-prefix`. The supported prefixes are `Bash(...)`, `Read(...)` (cross-tool, covering `read`, `grep`, `find`, and `ls`), `Edit(...)` (covering `edit` and `write`), `Write(...)`, `mcp__server__tool`, and `mcp__server[__*]`. Everything else falls open to match-all with a debug log, which matches the upstream best-effort contract. That includes `Grep(`, `Glob(`, `LS(`, `MultiEdit(`, parameter matching, wildcards, malformed syntax, and an `if` on a non-tool event. Our bash parser does quote-aware compound splitting on `&&`, `||`, `;`, `|`, `|&`, `&`, and newline. It strips a closed wrapper set of `timeout`, `time`, `nice`, `nohup`, `stdbuf`, and `xargs`. It recurses into `$(...)` and backticks to a depth cap of 8, and it fires open on interpolation. The glob engine is hand-written with zero dependencies, and no `RegExp` is ever compiled from user input.

Our wire protocol puts JSON on stdin, capped at 256 KiB of UTF-8, with `_truncated: true` assigned last so a payload key cannot win. Exit 2 blocks with stderr as the reason. Any other non-zero exit is a no-op with a debug log. An exit-0 JSON body has the precedence `continue:false` to stop, then `decision:"block"` to block, then `permissionDecision:"deny"` to block, and otherwise accumulate. The timeout is 600 seconds by default, with SIGTERM then SIGKILL after 5 seconds. Timers are `unref`'d, stdout is capped at 1 MiB, and stderr is capped at 64 KiB. We have no concurrency cap, because the fan-out is sequential and awaited, one child at a time. They cap at 8. The reducer treats block and stop as terminal, with first-block-wins. It also whitelists mutations, so `tool_result` accepts only `content` and `isError`, and a hook cannot rewrite routing fields.

Our async-rewake lane (`bridges/hooks/async-rewake/`) spawns detached in the registry when `asyncRewake: true` and returns `noop` at once. Ring buffers of 64 KiB for stderr and 1 MiB for stdout drop the oldest bytes. This preserves the tail, because the exit-2 trigger lives at the end. On exit 2 it injects through `pi.sendMessage({customType:"claude-hook-rewake"})`. A PID table at `data/_shared/async-rewake-pids.json` survives restarts. Orphan reaping does `kill(pid,0)` plus, on Linux only, a `/proc/<pid>/environ` marker read. On other platforms a live orphan is soft-skipped and never killed. The lane is inert on `Stop` and `StopFailure` by design. A `Stop` block re-entry starts a new turn under Pi, where upstream folds it into the same turn. Loop protection caps consecutive re-entries at 8 with a one-shot notification, and `stop_hook_active` clears only on a genuine `input` event. Every handler closure captures an epoch and short-circuits after `/reload`.

Our only hook configuration surface is a plugin's `hooks/hooks.json`. We support no `settings.json` hooks, no `/hooks` command, and no `disableAllHooks`.

### Foreign-state adoption

They read a fixed file set (`src/infrastructure/adoption/node-foreign-state-files.ts:7-26`):

- `~/.claude/plugins/known_marketplaces.json`, taking every alias entry
- `~/.claude/settings.json`, taking only `extraKnownMarketplaces`
- `$CODEX_HOME` or `~/.codex/config.toml`, taking only `[marketplaces.<alias>]` tables

They parse the TOML file with `smol-toml` and restrict it to the keys `source_type`, `source`, `ref`, `sparse_paths`, `last_updated`, and `last_revision`.

Their adoption is provably read-only. The port exposes only `readAll`, and the Node implementation calls only `lstat`, `open(O_RDONLY|O_NOFOLLOW)`, `read`, `realpath`, and `close`. No adoption or format module contains a write syscall. They explicitly do not read the Claude and Codex installed-plugin caches for activation, and they never import foreign trust or credentials. The flow is two steps: `adopt preview`, then `adopt import <candidate-id>... --yes`.

We read four files (`orchestrators/import/`), a base file plus a `.local` overlay per scope: `<CLAUDE_CONFIG_DIR or ~/.claude>/settings.json` and `settings.local.json` for user scope, and `<cwd>/.claude/settings.json` and `settings.local.json` for project scope. A relative or empty `CLAUDE_CONFIG_DIR` is ignored with a warning. We are strictly read-only against Claude's files. We extract two sections and nothing else, `enabledPlugins` and `extraKnownMarketplaces`. In `enabledPlugins`, only `value === true` is imported, `false` is skipped in silence, and a non-boolean warns. We import no permissions, no environment, no hooks, and no MCP servers.

Our marketplace source mapping accepts the flat legacy `{directory}` form and the flat legacy `{github:{repo}}` form. It also accepts the upstream nested `{source:{...}}` form for `url`, `github`, and `directory`. The `file` discriminator, a remote `marketplace.json` URL, is unmappable. We special-case `claude-plugins-official` to `anthropics/claude-plugins-official`.

Our cascade order per scope is marketplaces first, then plugins. A source mismatch therefore blocks the marketplace and its dependent plugins. We catch unexpected throws so the loop continues. Write-back touches only our own files, as a single batched `claude-plugins.json` patch per scope. That patch includes a repair pass which re-declares entries that a previously failed write left undeclared. There is one `notify()` call per invocation, and the default scope set is both scopes.

The delta is the installed plugin set. They adopt marketplace declarations. We adopt marketplace declarations and the installed plugin set.

### Their process model

There is no separate plugin-host child process. Their "packaged plugin host" is an in-process composition root (`src/composition/create-packaged-plugin-host.ts:132-877`) that owns every service inside Pi's own Node process. It starts on `session_start` and is disposed on `session_shutdown`. An in-process registry keyed by `Symbol.for("@nklisch/pi-plugins/composition-v1")` prevents two compositions from claiming the same runtime. A Pi `reload()` re-evaluates the module in the same process, and predecessor-to-successor handoff uses a second `Symbol.for` reload broker.

"Packaged" means the npm package bundles and shape-verifies its own runtime siblings, through `bundledDependencies: ["@nklisch/pi-subagents"]`. One `pi install` therefore activates MCP and subagents through verified wrappers. It reuses Pi's already-loaded coding-agent, AI, and TUI module identities rather than loading a second Pi runtime tree.

Their only real child processes are transient: one `spawn()` per hook handler per event, capped at 8 concurrent, and `git` invocations during acquisition. MCP servers are spawned by their forked adapter inside the same Pi process.

Their "control channel" is two in-process facades rather than IPC. `PiControlChannel` delivers frames through Pi's `appendEntry` in `rpc` and `json` modes, stdout lines in `print` mode, and nothing in `tui` mode. A JSON-lines headless runner, `runNodeNativeControlHeadless`, reads an input document from stdin or from a locked file. The headless runner is exported but has no `bin` entry, so no standalone CLI ships.

## Appendix C: methodology and verification status

This analysis was produced by reading both source trees, not by running either project. The competitor side is the tree at `nklisch/pi-extensions` commit `175142c7f6029f8676e5d9fcea3037520ff90b86`, which publishes `@nklisch/pi-plugins` v0.3.5. Our side is `pi-claude-marketplace` at v0.13.0. Where their documentation and their code disagree, this document reports the code and names the drift.

Path conventions: a competitor path such as `src/domain/source.ts` is relative to `packages/pi-plugins/` inside their repository. Our paths, such as `extensions/pi-claude-marketplace/domain/source.ts`, are relative to this repository's root.

The market signals in the competitor overview come from a different method, and they carry a different confidence. Repository counts come from the GitHub REST API. Download counts come from the npm registry download API, for the 30-day window that ends 2026-08-09. Both were queried on 2026-08-10. The positioning quotations come from their published README files rather than from source. Treat every number in that section as a measurement with the shelf life of a week, and re-run the queries before citing it.

Every figure in that section was then re-measured independently on 2026-08-10 before this document was committed. The 30-day download totals, the version counts, the first-publish dates, the peak days, the star and fork counts, the commit and contributor counts, and the `bundledDependencies` claim about `@nklisch/pi-enhanced` all reproduced exactly. Two figures did not, and this document carries the corrected values: our open-issue count is 0, not 1, and the weekly download buckets are stated with their bucket boundaries because the first set of weekly figures could not be reproduced.

Three claims in this document are UNVERIFIED. Nobody verified them against source, so do not rely on them:

1. Whether we synthesize Claude-style `mcp__plugin_x_y__tool` aliases, where they deliberately refuse and report `RUNTIME_ALIAS_UNAVAILABLE`. Reading our MCP bridge would settle it.
2. The exact contents of their tab-completion provider. Reading their completion provider source at the pinned commit would settle it.
3. Whether they expose LLM-callable tools equivalent to our two read-only tools. Reading their tool registration at the pinned commit would settle it.

Re-cut this document when `@nklisch/pi-plugins` publishes a new minor version. Their release span at the time of writing is v0.1.0 to v0.3.5, from 2026-07-24 to 2026-08-08, so every claim here has a short shelf life.

## Appendix D: automation-surface scope decisions (2026-08-13)

The "machine-readable output, stable exit codes, pagination" cluster in `## Where each one beats us` and recommendation #6/#11 in the two ranked tables above was followed up with a direct inspection of our own pinned `@earendil-works/pi-coding-agent`, to separate what is a genuine Pi convention from what `@nklisch/pi-plugins` built themselves with no more platform support than we have. The operator's decision: adopt only what Pi itself defines, and build no bespoke automation grammar. Recorded here so the reasoning survives past the conversation that produced it.

**Adopted: structured output keyed by `ctx.mode`.** `ExtensionContext.mode: "tui" | "rpc" | "json" | "print"` (`dist/core/extensions/types.d.ts:208-213`) and `pi.appendEntry<T>(customType, data)` (`types.d.ts:923`) are both genuine, documented Pi conventions, confirmed present in our own pinned package. Tracked as backlog `MRO-01`.

**Not adopted: `--cursor`/`--limit` pagination.** Confirmed by direct search of the pinned package's type declarations: zero occurrences of `cursor`, `pagination`, `hasMore`, `nextPage`, or `pageToken` anywhere in the extension-facing API surface. The only `cursor` hits in the whole package are terminal text-cursor handling (`interactive-mode.d.ts`, `keybindings.d.ts`'s `tui.editor.cursorUp/Down/Left/Right`), unrelated to output pagination. `--cursor`/`--limit` is `@nklisch/pi-plugins`' own invention in their `native-control-registry.ts`, not a platform convention. Building it would mean designing a bespoke pagination grammar with no Pi contract to anchor it.

**Not adopted: process exit codes.** Traced the actual exit-code logic in `dist/modes/print-mode.js`. In text mode (`pi -p`), `exitCode = 1` fires only when the final assistant message's `stopReason` is `"error"` or `"aborted"` (lines 105-108) -- a model-transport failure, never a tool or command outcome. In json mode (`pi --mode json`), `exitCode` is never set from content at all; it stays 0 unless an uncaught exception escapes the whole harness (lines 118-123). RPC mode (`dist/modes/rpc/rpc-mode.js`) is a long-running server with no OS exit-code concept -- each command gets a `{success: true|false}` field in its JSON reply instead. `RegisteredCommand.handler` is `(args, ctx) => Promise<void>` -- no return channel exists for a command to influence any of this. There is no Pi seam to build against. `@nklisch/pi-plugins`' documented exit-code vocabulary is almost certainly a field inside their own JSON payload, interpreted by an external wrapper script, rather than a literal `process.exit(n)` call, since they are bound by the same handler contract we are.

**Not adopted: a dedicated command/tool status field.** `AgentToolResult<T>` (`@earendil-works/pi-agent-core`, `dist/types.d.ts:310-324`) carries no `isError` or `success` field -- only `content`, `details`, `usage`, `addedToolNames`, `terminate`. Status is conventionally encoded in `content` text alone. A thrown command-handler error is caught by the runtime (`agent-session.js::_tryExecuteExtensionCommand`) and routed to `emitError()`, a generic uncaught-extension-error channel the host itself consumes (console output in headless modes) -- not a caller-facing result. We already never throw out of a command handler (NFR-2), so this channel is correctly unused, not neglected. Any structured status beyond `content` text is something we would have to invent, which folds into `MRO-01` rather than standing as a separate item.

The operating principle going forward: respect what Pi's own conventions provide (`ctx.mode`, `pi.appendEntry`), and do not invent automation grammar -- pagination tokens, exit-code vocabularies, bespoke status fields -- where Pi defines none. All three "not adopted" items were `@nklisch/pi-plugins` building their own convention inside their own extension, not tapping into something the platform gave them and we have not.
