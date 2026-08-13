# Backlog

Ideas surfaced during planning that are deferred from active scope but worth retaining for future milestones.

## UAT-02: reconcile cascade invisible on `/reload` (host TUI limitation)

Surfaced by v1.12 milestone runtime UAT (2026-06-11). The load-time reconcile
cascade (RECON-04) is emitted correctly via `ctx.ui.notify`, and IS visible at
Pi startup -- but on `/reload`, pi's `handleReloadCommand` calls
`rebuildChatFromMessages()` after `session.reload()`, reconstructing the chat
from the LLM transcript only. Extension notifications (any severity) emitted
during the reload pipeline are erased. `@earendil-works/pi-coding-agent` is not
our fork; operator decided (2026-06-11) NOT to file an upstream issue for now.

Candidate directions for later brainstorming:
- queue-and-flush: stash the cascade when `reason === "reload"`, emit on the
  next extension event with a live UI (deterministic but late-arriving)
- persistent `ui.setWidget` badge summarizing the last reconcile
- upstream change: re-append extension notifications after the chat rebuild
- do nothing: results remain verifiable via `/claude:plugin pending` / `list`

Workaround today: run `/claude:plugin pending` before reloading, or `list` after.

## REASON-01: unify malformed-input failures under a "malformed X" reason family

Surfaced during v1.14 Phase 85 discuss (2026-07-22). The `UNSUPPORTED_REASONS`
tokens (`unsupported hooks`, `lsp`, `unsupported source`) semantically mean a
*well-formed but unsupported component KIND* -- lsp / monitors / themes / etc.,
whose content the resolver never parses. Malformed input to a *supported*
feature is a different axis (a parse / structural defect) and belongs with the
failure family, parallel to `{invalid manifest}` and `{unparseable}`.

Two existing cases mislabel that axis:
- inline malformed `mcpServers` -> `{unsupported source}` (the `narrowResolverNotes` catch-all)
- malformed `hooks.json` (invalid JSON / schema) -> `{unsupported hooks}`

Phase 85 introduces the correct token `{malformed mcp}` for a broken/malformed
mcpServers *string reference*, but deliberately leaves the two cases above
unchanged (existing behavior, out of scope for this milestone).

Direction for later: introduce a consistent `{malformed <feature>}` failure-class
family and reroute the mislabeled supported-feature parse failures to it. Requires
re-auditing `narrowResolverNotes`, which currently forces every resolver note into
the unsupported family -- parse / structural notes need to reach failure-class
tokens (the `narrowProbeError` path already does this for I/O errors).

## COV-01: coverage exclusion policy, and the two out-of-bound orchestrators

Promoted from the 2026-08-10 todo at the v1.18 close (2026-08-12). Both parts sit
outside the D-99-05b bound (update / reinstall / install only), which is why the
bounded sweep could not carry them.

**The premise has already narrowed.** A fresh unit-coverage run on 2026-08-10
measured `orchestrators/edge-deps.ts` at **100%** line coverage, against the
49.7% capture from 2026-06-12 that raised the question. Whatever landed between
the two captures answered it by measurement: no exclusion is needed there, and
adding one now would exclude a module that already carries real tests.

**1. The exclusion policy itself.** Record the reasoning, not only the verdict,
because the next low-coverage wiring module raises the same question. A
`sonar.coverage.exclusions` entry raises the reported percentage without
executing one additional line -- the excluded file's uncovered arms stay
uncovered, they merely stop being counted. That trades a true statement about the
tree for a flattering one, and it does it silently: a later reader sees a high
number and infers safety the tests do not provide. An exclusion is defensible
only for code that cannot regress in a way tests would catch (generated files,
type-only declarations). Wiring glue does not qualify -- a mis-wired dependency
is exactly the defect an integration test catches. So the default answer is
tests, and any exclusion must carry its justification in
`sonar-project.properties` next to the entry.

**2. The two remaining orchestrators.** `import/execute.ts` (59 uncovered lines,
94.53%) and `marketplace/update.ts` (50 uncovered, 95.49%) were named by the
original carrier. Their uncovered remainder is the same shape the bounded sweep
worked -- rare-failure and cascade-diagnostic arms. Decide whether they get a
follow-on bounded sweep or are accepted as-is. Do not decide it by exclusion.

## MRO-01: mode-aware structured output via `ctx.mode` and `pi.appendEntry`

Surfaced during the 2026-08-10 competitive analysis of `@nklisch/pi-plugins`
(`docs/competitive-analysis/pi-plugins.md`, recommendation #11). Verified
2026-08-13 directly against our own pinned `@earendil-works/pi-coding-agent`:
every `ExtensionContext` carries a real `mode: "tui" | "rpc" | "json" |
"print"` field, set by how the user invoked Pi (`pi` interactive, `pi -p`,
`pi --mode json`, or the RPC stdin/stdout protocol). We never read it. Our
sole output primitive, `ctx.ui.notify(message: string, type?)`, takes a plain
formatted string and a severity -- no structured-payload slot.

A user driving `/claude:plugin` through `pi --mode json` or RPC gets the same
human-formatted string wrapped in a JSON envelope today, not real
machine-readable data. `@nklisch/pi-plugins` solved this on the low-level
`pi.appendEntry<T>(customType, data)` primitive -- confirmed present in our
own pinned Pi version too, under "Append a custom entry to the session for
state persistence (not sent to LLM)". Their `pi-control-channel.ts` keys
output by mode: rpc/json modes emit `appendEntry` frames, print mode writes
stdout lines, tui is a no-op. A versioned grammar, closed exit-code
vocabulary, and pagination sit on top of that channel, none of which are
scoped here.

Direction for later: design a structured shape for the existing
`NotificationMessage` / `PluginInfoRow` discriminated types in
`shared/notify.ts` (most of the shape work already exists), and emit it via
`pi.appendEntry` when `ctx.mode` is `"json"` or `"rpc"`, alongside (not
instead of) the existing human `notify()` line.

Code seams: `shared/notify.ts` (message shapes), `platform/pi-api.ts`
(re-exports `ExtensionContext`), `edge/router.ts` (the `/claude:plugin`
command entry point every handler's `ctx` flows through).

## WFLW-01: `workflows` component kind is unrecognized (silent gap)

Surfaced 2026-08-13 auditing Claude Code's official plugin-marketplace and
plugins-reference docs (`code.claude.com/docs/en/plugins-reference`) against
our own resolver. Claude Code's manifest schema has shipped a `workflows`
field (`string|array`, "Custom workflow script files or directories,
replaces default `workflows/`") as a first-class component kind alongside
skills/commands/agents/hooks -- confirmed via direct fetch of the live docs,
not inferred.

`domain/resolver.ts` carries two closed component-kind lists:
`SUPPORTED_COMPONENT_KINDS = ["skills", "commands", "agents", "hooks"]` and
`UNSUPPORTED_COMPONENT_KINDS = ["lspServers", "monitors", "themes",
"outputStyles", "channels", "userConfig", "settings"]`. `workflows` is in
neither. The code carries its own warning directly above the unsupported
list (T-02-25): "The list is closed. A new kind upstream that's neither in
SUPPORTED_COMPONENT_KINDS nor in this list would be silently ignored.
Re-audit when Claude Code adds new component kinds." That is exactly what
happened -- a plugin declaring `workflows` today gets no degradation, no
reason token, and no signal at all, unlike `monitors`/`themes`/etc., which
are all correctly tracked and correctly demote the plugin to
`partially-available`.

Direction for later: add `workflows` to `UNSUPPORTED_COMPONENT_KINDS` (the
mechanical fix that restores the closed-set guarantee and produces a
`{unsupported workflows}` reason) as the immediate fix; a real bridge that
translates a Claude workflow script into a Pi-native equivalent is a
separate, larger question with no known Pi analog yet.

Code seams: `domain/resolver.ts` (`SUPPORTED_COMPONENT_KINDS`,
`UNSUPPORTED_COMPONENT_KINDS`, `UNSUPPORTED_COMPONENT_CONVENTIONS`),
`domain/components/plugin.ts` (`UNSUPPORTED_COMPONENT_FIELDS` schema),
`shared/notify.ts` / `docs/output-catalog.md` (the closed REASONS set).

## PSRC-01: two real Claude Code plugin-source kinds unresolved (`npm`, `archive`)

Surfaced 2026-08-13 auditing Claude Code's official plugin-marketplace docs
against `domain/source.ts` and `domain/resolver.ts`.

**`npm`**: Claude Code's documented shape --
`{source: "npm", package, version?, registry?}`, installed via `npm install`
-- matches our own `NpmSource` interface field-for-field. We parse and list
it, but the resolver hard-rejects it: `unsupported source kind: npm`. This is
the same gap recommendation #5 in `docs/competitive-analysis/pi-plugins.md`
names ("npm plugin sources... removes our one unsupported plugin-source
kind") -- confirmed here as real Claude Code parity, not a competitor-only
convenience.

**`archive`**: a second, genuinely distinct Claude Code source kind --
`{source: "archive", url, sha256?}`, a zip archive downloaded over HTTPS,
"works without git or npm on the user's machine," requires Claude Code
v2.1.224+. `domain/source.ts`'s `ParsedSource` union (`PathSource |
GitHubSource | UrlSource | GitSubdirSource | NpmSource | UnknownSource`) has
no representation for it at all -- not even a recognized-but-unsupported case
in `parseKindObjectSource`'s switch, so an `archive`-sourced entry falls
through to `unknown` today. Neither `@nklisch/pi-plugins` nor this project
implements it; their own TAR-reader hardening is npm-tarball-specific and
does not cover Claude's zip-based `archive` format either.

Direction for later: `npm` needs resolver-side materialization (packument
fetch, tarball fetch, verify, extract -- the acquisition mechanics
`@nklisch/pi-plugins` already built, minus the SHA-512 absolutism their own
backlog flags as harmful -- see the cautions in `pi-plugins.md`). `archive`
needs a new `ArchiveSource` variant in `ParsedSource` plus a
zip-download-and-extract materialization path, likely sharing
containment/hardening concerns with whatever npm-tarball work lands first
(path traversal, symlink escapes, decompression bombs -- the same class of
hazard `@nklisch/pi-plugins`' `tar-reader.ts` defends against, for a
different archive format).

Code seams: `domain/source.ts` (`ParsedSource` union, `parsePluginSource`),
`domain/resolver.ts` (source-kind dispatch), `orchestrators/plugin/clone-cache.ts`
(the only existing acquisition seam, currently git-only).

## PKGDEP-01: no auto-install of a plugin's own Node.js/Bun dependencies

Surfaced 2026-08-13 auditing Claude Code's plugins-reference docs
(`code.claude.com/docs/en/plugins-reference`, "Node.js package
dependencies"). When a plugin's own root ships a `package.json` plus a
supported lockfile (`bun.lock`, `bun.lockb`, `npm-shrinkwrap.json`, or
`package-lock.json`), Claude Code runs a frozen-resolution, `--ignore-scripts`,
60-second-bounded install (`npm ci --ignore-scripts` or `bun install
--frozen-lockfile --ignore-scripts`) into the cached copy at install time,
update time, and at session start on a fresh machine, so the plugin's own
hooks and MCP servers can load their dependencies. A failed or skipped
install never blocks the plugin; a `package.json` with no recognized
lockfile is skipped silently.

We have no equivalent anywhere in the codebase (confirmed by grep -- zero
hits for lockfile names or `--ignore-scripts`/`--frozen-lockfile`). A plugin
that bundles its own npm dependencies installs today with hooks or MCP
servers that fail at runtime on an unresolved `node_modules`, with no
diagnostic pointing at the real cause.

Direction for later: a new phase in the install/update ledger (or a step
inside the existing skills/commands/agents/hooks/mcp five-phase sequence)
that detects `<pluginRoot>/package.json` + a recognized lockfile and runs the
matching frozen, no-lifecycle-scripts install into the staged copy, mirroring
Claude Code's exact lockfile-priority order and timeout. Failure should
degrade (warning-level note), never block the install.

Code seams: `transaction/phase-ledger.ts` (the 5-phase ledger pattern),
`orchestrators/plugin/install.ts` / `update.ts` (ledger composition),
`shared/notify.ts` (a new closed-set reason for a skipped/failed dependency
install).

## DFEN-01: `defaultEnabled` manifest field unsupported

Surfaced 2026-08-13 auditing Claude Code's plugins-reference docs. A
`plugin.json` (or marketplace entry, which takes precedence) can set
`defaultEnabled: false` (requires Claude Code v2.1.154+) so a plugin installs
in a disabled state until the user explicitly turns it on -- intended for
plugins that add cost or scope a user should opt into. Two things override it
when present: an existing `enabledPlugins` setting for the plugin, and a
dependency requirement from another active plugin.

We have no representation of this field anywhere (confirmed by grep). Every
plugin we install is enabled by default with no way for a plugin author to
request otherwise, and no field carries the marketplace-entry override
precedence rule either.

Direction for later: read `defaultEnabled` from the manifest
(marketplace entry wins per Claude's precedence rule) at install time, and
thread it into the same state-write the install ledger already performs for
the `enabled` flag -- this is a small, self-contained resolver + install-ledger
change with no new component-kind or bridge involved.

Code seams: `domain/components/plugin.ts` (schema field), `domain/resolver.ts`
(read + surface the value), `orchestrators/plugin/install.ts` (state write),
`persistence/state-io.ts` (the `enabled` flag this would set the initial
value of).

## AUTOUP-01: autoupdate is a manual-trigger flag, not a background update

Surfaced 2026-08-13 comparing our `marketplace autoupdate`/`noautoupdate`
against Claude Code's own autoupdate model (`code.claude.com/docs/en/
discover-plugins#configure-auto-updates`) and the parallel design pattern
already named in `docs/competitive-analysis/pi-plugins.md` ("Update
discovery, notices, and staged updates" -- `@nklisch/pi-plugins` built a
lease-based background coordinator toward the same end).

Claude Code's real behavior: after a session starts, with a random delay of
up to ten minutes (so the running session keeps using what it loaded at
launch), Claude Code refreshes the marketplace catalog AND updates installed
plugins to their latest versions on disk, unattended -- no command, no
prompt. If anything updated, the user sees a passive notification offering
`/reload-plugins`; otherwise the new versions are just there on next launch.
The default is kind-aware: official Anthropic marketplaces have autoupdate
on by default, third-party and local-dev marketplaces have it off by
default. `DISABLE_AUTOUPDATER` / `FORCE_AUTOUPDATE_PLUGINS=1` let an
operator decouple "update the Claude Code binary" from "update plugins."

Ours is a different mechanism wearing the same name. `marketplace
autoupdate` / `noautoupdate` (`orchestrators/marketplace/autoupdate.ts`)
only flips a per-marketplace boolean in `claude-plugins.json`. That flag is
read in exactly one place (`orchestrators/marketplace/update.ts:508,542,978`)
to decide whether an explicitly user-run `marketplace update <name>` also
cascades into updating that marketplace's installed plugins, or only
refreshes the manifest. Nothing runs on a timer, nothing runs unattended,
and neither `session_start` nor `resources_discover` in `index.ts` triggers
any refresh-and-update sweep -- confirmed by grep, and by reading both
lifecycle handlers directly. The flag governs cascade SCOPE of a manual
command, not automaticity.

Direction for later: a real background sweep is a genuinely new capability,
not a rename of the existing flag. Open design questions before scoping a
plan: (1) a bare `setTimeout` from `session_start` is enough to get
"jittered delay after startup" -- Pi extensions are long-lived JS in the
host process, no special API needed -- but the sweep would then contend for
the SAME `withLockedStateTransaction` lock (`retries: 0`, not re-entrant)
that a concurrently-typed `/claude:plugin` command holds, which Claude
Code's single-process model doesn't have to reason about; (2) NFR-2's
"never propagate past resources_discover/session_start" boundary discipline
would need to extend to whatever fires the background sweep; (3) our
architecture has no "official marketplace" concept to hang a kind-aware
default off of -- the on-by-default / off-by-default split may not port
directly and needs its own decision; (4) the passive
"updated -- run /reload-plugins" notification is close to what `pending`
already renders network-free, but this would be the first NOTIFICATION
that fires with no user-issued command behind it at all.

Code seams: `orchestrators/marketplace/autoupdate.ts` (the existing flag,
kept as the per-marketplace opt-in surface), `orchestrators/marketplace/update.ts`
(the cascade logic to reuse, currently manual-trigger only), `index.ts`
(`session_start` / `resources_discover` -- candidate trigger sites),
`transaction/with-state-guard.ts` (the lock a background sweep would need to
coordinate with foreground commands around), `shared/notify.ts` (a new
notification shape for an update that fired with no command behind it).

<!--
Pruned 2026-06-08: both prior items shipped in v1.10 Error Attribution.
- "Install error misattribution when marketplace is missing" -> closed by ATTR-01..10
  (every op converges on the marketplace-subject `{not added}` model; see
  tests/orchestrators/plugin/install.test.ts "ATTR-01").
- "Structural `{not added}` variant for `PluginInfoMessage`" -> closed by TYPE-01..04
  (dedicated `marketplace-not-added` kind in shared/notify.ts; placeholder/sole-reason
  renderer carve-out removed).
-->
