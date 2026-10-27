# Phase 5: Marketplace Command Parity - Context

**Gathered:** 2026-10-26
**Status:** Ready for planning
**Mode:** autonomous smart discuss (wave 1 of `plugin-lifecycle`; no user prompts, choices recorded below)

<domain>
## Phase Boundary

The `/claude:plugin marketplace` commands match Claude Code's `/plugin marketplace` on six points:

1. `marketplace add` refuses Claude Code's reserved official marketplace names, and `bootstrap` still adds `claude-plugins-official` (MKT-01).
2. `marketplace add` accepts an https URL to a hosted `marketplace.json`, and `marketplace update` (and autoupdate) refresh it (MKT-02).
3. `/claude:plugin market` is an alias of `marketplace` (MKT-03).
4. Marketplace-level failure rows carry the bare marketplace as their JSON id, not `<mp>@<mp>` (MKT-04).
5. The `owner/repo@ref` shorthand splits as Claude Code splits it (MKT-05).
6. `marketplace remove` reporting of stranded dependents is settled (MKT-06), and its partial-cascade fold is the shared exhaustive fold, hooks axis included (MKT-08).

Plus the `marketplace add` classification gaps (MKT-07): a malformed manifest told apart from a crash, a recorded marketplace whose clone is gone, EISDIR, and the no-op status.

Backlog entries closed or decided here: MKTPAR-01 (b1, b2, b3), ROWID-01, SHORTREF-01, PRUNE-GUARD-MR-01, LCORCH-01 b1, LCCODE-01 b6, CASCADEAX-01.

Out of scope: import's mapping of Claude Code `url` marketplace declarations (Phase 6), git-host error classification and clone-cleanup locking in `marketplace/{shared,update,remove}.ts` (Phase 7), the dependency step of `marketplace add` (Phase 2).

</domain>

<upstream_evidence>
## Claude Code Evidence Records

Binary: Claude Code **2.1.310** (`/home/linuxbrew/.linuxbrew/Caskroom/claude-code@latest/2.1.310/claude`), strings grepped 2026-10-26. Docs: `code.claude.com/docs/en/plugins/marketplace-reference.md`, `.../plugins/host-marketplace.md`, `.../plugin-marketplaces.md`, retrieved 2026-10-26.

### E-1 Reserved marketplace names (MKT-01) — confidence high

- The reserved set `PZ` is 19 names: official `claude-code-marketplace`, `claude-code-plugins`, `claude-plugins-official`, `anthropic-marketplace`, `anthropic-plugins`, `agent-skills`, `anthropic-agent-skills`, `life-sciences`, `knowledge-work-plugins`, `claude-for-legal`, `claude-for-financial-services`, `financial-services-plugins`, `first-party-plugins`, `claude-tag-plugins`; community `claude-community`, `claude-plugins-community`, `healthcare`; directory `anthropic-plugin-directory`, `claude-plugin-directory`. Matched lowercased.
- `GTt(name, source)` (binary) runs on the name **read from the fetched `marketplace.json`** in every add path (url, git, github, file, directory) and in the refresh path. It returns `null` when the name is not reserved, or when the source is `github` whose repo is `anthropics/<x>` (owner compared lowercased), or `git` whose URL is on a GitHub host under `anthropics/`. Otherwise it refuses:
  - `github` or `git` source: ``The name '<name>' is reserved for official Anthropic marketplaces. Only repositories from 'github.com/anthropics/' can use this name.``
  - any other source (file, directory, url): ``The name '<name>' is reserved for official Anthropic marketplaces and can only be used with GitHub sources from the 'anthropics' organization.``
- The docs also reserve look-alike names (`Marketplace name impersonates an official Anthropic/Claude marketplace`), other spellings of a reserved name (2.1.280+), `npm`/`pip`/`uv`/`cargo`/`github`/`gh` (2.1.275+), JS object member names (2.1.296+), the `claudeai-` prefix, and the `<owner>-<repo>` download folder of a registered GitHub marketplace (2.1.290+). A registered marketplace whose name is reserved from an untrusted source stops loading (`Reserved marketplace name registered from untrusted source`).
- `bootstrap` adds `anthropics/claude-plugins-official` from a `github` source, so it passes the exemption with no special case.

### E-2 Hosted `marketplace.json` URL (MKT-02) — confidence high

- Source classification (`qbe`, binary): an `http(s)://` input has its `#fragment` split off; a URL ending `.git` or containing `/_git/` is `git`; a github.com `/<owner>/<repo>` URL is `git` (`.git` appended); a gitlab.com project path is `git`; **every other http(s) URL is `{source: "url", url}`**, the hosted catalog. The fragment is dropped for a `url` source.
- Fetch (`$ut`): one GET, 10 s timeout, `maxContentLength` (docs: 5 MiB), a `User-Agent`, optional `headers`/`headersHelper` from a settings declaration only (the CLI add has none). Errors: `Could not connect to <url>...` (ECONNREFUSED/ENOTFOUND), `Request timed out while downloading marketplace from <url>...` (ETIMEDOUT), `HTTP <status> error while downloading marketplace from <url>. The marketplace file may not exist at this URL.`, `Invalid marketplace schema from URL: ...`. Docs: a redirect to a different origin must stay `https://` and may not target a loopback, link-local, or cloud-metadata host.
- The catalog is cached as one file; `marketplace update` re-downloads it (refresh path re-runs `GTt`). Docs: a relative-path plugin entry in a URL-hosted marketplace fails at install (`its marketplace entry path does not stay inside the marketplace directory`); entries must use fetchable sources (github, git URL, archive).
- Docs host table: users add it with `/plugin marketplace add https://plugins.example.com/marketplace.json` and need only HTTPS access.

### E-3 `market` alias (MKT-03) — confidence high

- The `/plugin` argument parser has `case "marketplace": case "market":` with subcommands `add`, `remove|rm`, `update`, `list`; completion treats `market` exactly as `marketplace` for its subcommand and marketplace-name positions.

### E-4 Shorthand split (MKT-05) — confidence high

- `owner/repo` shorthand: `n.match(/^([^#@]+)(?:[#@](.+))?$/)`, so the split is at the **first** `@` or `#`; `acme/tools@a@b` is repo `acme/tools`, ref `a@b`. The left half must match `^[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?\/[A-Za-z0-9._-]+$`.

### E-5 `marketplace remove` output (MKT-06) — confidence medium-high

- Output strings: `Successfully removed marketplace: <name>`, `Also uninstalled <n> plugin(s) from this marketplace:` with the ids, a data-deletion note, and `To use a plugin again, add the marketplace back and reinstall the plugin.` No string names plugins in other marketplaces that depend on the removed ones. Upstream does not report the dependents it strands.

### E-6 Missing marketplace cache (MKT-07) — confidence medium

- Load path: `Cache corrupted or missing for marketplace <name>, re-fetching from source` — Claude Code re-materializes a registered marketplace whose cache is gone. `marketplace add` always fetches (clone into staging, then rename over the old directory), so re-adding a registered marketplace repairs it.

</upstream_evidence>

<decisions>
## Implementation Decisions

### Reserved names (MKT-01)

- **D-PL5-01:** `marketplace add` refuses a manifest name in Claude Code's 19-name reserved set (E-1), compared lowercased, unless the source is `github` with owner `anthropics` (compared lowercased). Our `url` kind never names github.com (D-76-02 normalizes github.com URLs to `github`), so a `url`, `path`, or hosted source is never exempt. The check runs where the add already reads the manifest name (`newMarketplaceName` in `orchestrators/marketplace/add.ts`), before any state mutation, and covers every add caller: standalone, `bootstrap`, `apply`, `import`, and the D-MF-04 install-time add. The pure predicate lives in `domain/name.ts` beside `isReservedRecordKey` and returns the refusal sentence or `undefined`.
- **D-PL5-02:** Wording is Claude Code's, verbatim per source kind (E-1): the `github.com/anthropics/` sentence for `github` and `url` (git) sources, the `'anthropics' organization` sentence for `path` and hosted sources. The row is the failed-add row with one failed child row carrying the sentence as its cause (the shape `failedAddRow` already uses for a fetched-URL failure, `marketplaceSubject: true`), reason token `invalid manifest`, reusing the D-08-07 precedent that a reserved `__proto__` name is `invalid manifest`. No new reason token.
- **D-PL5-03:** Scope is the exact reserved set only. Look-alike/impersonation names, other spellings, `npm`/`pip`/`uv`/`cargo`/`github`/`gh`, the `claudeai-` prefix, the `<owner>-<repo>` folder rule, a refresh that renames a marketplace to a reserved name, and the load-time refusal of an already-registered reserved name from an untrusted source are deferred to a new backlog entry (proposed `MKTNAME-01`, see SUMMARY).
- `bootstrap` needs no change; `features/plugin/bootstrap.feature` stays green and proves it.

### Hosted marketplace.json (MKT-02)

- **D-PL5-04 (classification):** In the shared string funnel `parsePluginSource`, an `https://` input whose URL path (before `?` and `#`) ends in `.json` is a hosted manifest source. The arm runs after the github.com arm (D-76-02 stays first, so a github.com URL is never fetched as a catalog) and before the generic https `url` arm. The `#fragment` is dropped, as Claude Code drops it; the query string is kept. The object-field gate `gatedUrlField` (a manifest's `{source: "url", url}` plugin entry) does NOT classify `.json`, so plugin git URL objects keep their meaning. `http://` stays refused (D-76-01). This is narrower than Claude Code, which treats every non-`.git`, non-forge https URL as a hosted catalog (E-2): a suffix-less URL keeps cloning as git, which keeps MURL-01, D-76-01, and D-2-01/D-2-02 (recorded decisions, the divergence license).
- **D-PL5-05 (source kind):** `ParsedSource` gains `HostedManifestSource { kind: "hosted"; raw; url }` (`url` = `raw` without the fragment). It is reachable from the string arm above and from the persisted object form `{kind: "hosted", raw}` (state records re-parse through the same funnel, ST-6). Every exhaustive `kind` switch gets an explicit arm: marketplace-side consumers handle it; plugin-side consumers (`domain/plugin-resolver.ts`, `domain/version.ts`, `orchestrators/plugin/dependency-declaration-read.ts`, `orchestrators/plugin/info.ts`) treat it like `npm`, an unsupported plugin source. `samePlannedSource` compares hosted by `url`; `sourceLogical` renders the url. `persistence/state-io.ts` revalidates a stored hosted record. Every non-exhaustive `kind === ...` site that reads a marketplace record's source (mirror seeding, clone GC, `remove` footprint, `update` refresh, `info`/`list` labels) is audited so a hosted record takes the right branch, not a git branch by default.
- **D-PL5-06 (storage):** A hosted marketplace is stored like a clone so every existing reader works unchanged: `sources/<name>/.claude-plugin/marketplace.json` holds the downloaded bytes, `marketplaceRoot` is `sources/<name>/`, `manifestPath` points at the file. The add writes into a staging directory and renames it into place (NFR-1, MA-9 cleanup discipline), with an ownership marker of its own (there is no `.git/`) that records the source URL, so a leftover `sources/<name>/` is recognized and replaced when it is ours for the same URL and refused `{stale clone}` otherwise (MA-6, MA-12, MA-13 parity). `marketplace remove` deletes `sources/<name>/` for a hosted record as it does for a clone (MR-7).
- **D-PL5-07 (fetch seam):** A new platform module (proposed `platform/hosted-manifest-fetch.ts`) is the only new `fetch` caller: one GET with a 10 s timeout, a 5 MiB body cap, at most 5 redirects, every redirect `https://`, and a cross-origin redirect to a loopback, link-local, or metadata host refused (E-2). The orchestrators receive it as an injected port with a production default (the `GitOps` pattern), so tests inject a double and never touch the network. `rule-packs/architecture.json` `fetch-chokepoint` admits the module as a second sanctioned caller; `eslint.config.js` BLOCK F bans importing it from every `orchestrators/` and `domain/` module outside `NETWORK_SEAMS` (the default can live in `marketplace/shared.ts`, already a seam). No credentials or headers are sent (Claude Code's CLI add sends none).
- **D-PL5-08 (NFR-5 amendment):** Network is also required for `marketplace add` and `marketplace update` (and the autoupdate cascade, and an `apply` that adds or refreshes one) of a hosted-manifest marketplace, which download its `marketplace.json` over https. Installing from a hosted marketplace reads the stored copy (plugins still clone on cache miss only). `list`, `info`, `uninstall`, and `marketplace remove` stay network-free. Proposed wording for the NFR-5 line in AGENTS.md and PROJECT.md is in the SUMMARY decision rows.
- **D-PL5-09 (refresh):** `marketplace update` re-downloads a hosted manifest, validates it as a git refresh validates its checkout, and swaps the stored file atomically only after validation; the content-key comparison and the plugin cascade run unchanged. Autoupdate refreshes it through the same update path.
- **D-PL5-10 (failure vocabulary):** A hosted fetch failure reuses the add's source-access tokens: connection refused, DNS, or timeout -> `network unreachable`; HTTP 404/410 -> `source missing`; 401/403 -> `authentication required`; any other status -> `network error` with the `{status} on {url}` cause frame `marketplace add` and `update` already render; a body over the cap or a refused redirect -> `unreadable`; malformed JSON -> `unparseable`; schema-invalid -> `invalid manifest`.
- A relative-path plugin entry in a hosted marketplace gets no special case: its directory does not exist under `sources/<name>/`, and the resolver's existing missing-directory behavior applies (Claude Code also fails it at install, E-2).

### `market` alias (MKT-03)

- **D-PL5-11:** `edge/router.ts` dispatches `market` exactly as `marketplace` (every subcommand, `help`, the missing-subcommand usage error), and `edge/completions/*` completes after `market` exactly as after `marketplace`. The plugin help names it the way it names `ls`: `marketplace <...> ...   (alias: market)`. First-token completion treats `market` the way it treats the top-level `ls` alias.

### Row ids (MKT-04)

- **D-PL5-12:** Every marketplace-level failure row sets `marketplaceSubject: true` on its synthetic child, so `rowId` emits the bare marketplace name: `marketplaceFailureRows` in `marketplace/shared.ts` and the own-built rows in `marketplace/update.ts` and `marketplace/info.ts` (and `surfaceLockHeldAdd`, which can then drop its own spread). The pinned `<mp>@<mp>` cells in the feature files and unit tests change to the bare id; `docs/json-output.md` says so. This changes the published JSON payload, so it gets a CHANGELOG line.

### Shorthand (MKT-05)

- **D-PL5-13:** Parity. `owner/repo` shorthand splits at the FIRST `@` or `#` (E-4), so `acme/tools@a@b` is `acme/tools` at ref `a@b`. This retires D-76-04's last-`@` rule; the D-MF-07 empty-`#` divergence stays. The owner/repo character-class check upstream applies is not adopted here (out of SHORTREF-01's scope). Test-first in `test/domain/source.test.ts`, plus a scenario.

### Remove reporting and fold (MKT-06, MKT-08)

- **D-PL5-14:** `marketplace remove` does not name the dependents it strands in other marketplaces. Claude Code reports only the plugins it uninstalled (E-5), and LOAD-03 / D-06-07 already report each unmet dependent at the next load, `pending`, and `apply`. Refusing stays off the table (D-05-07). PRUNE-GUARD-MR-01 closes as decided; no code change.
- **D-PL5-15:** `applyPartialCascadeFold` in `orchestrators/plugin/shared.ts` becomes exhaustive: an axis table typed over `keyof UnstageOutcome["dropped"]` maps each dropped axis to its resource field (`commands -> prompts`), so a new axis fails `npm run typecheck` until it is mapped. `marketplace/remove.ts` deletes its hand-rolled copy and calls the shared fold, which adds the hooks axis it omitted. Only that function changes in `plugin/shared.ts` (Phase 1 edits the warning functions).

### `marketplace add` classification (MKT-07)

- **D-PL5-16 (crash vs malformed):** In orchestrated mode the non-enumerated catch-all no longer collapses to `unparseable`. It narrows through `narrowProbeError` (the fallback `classifyOrchestratorThrow` already uses for every other apply operation), so `unparseable` means a malformed-JSON manifest only and an unforeseen throw reads `unreadable` (or its errno token). The typed `error` stays on the outcome for callers that narrow. Standalone mode still rethrows an unforeseen error.
- **D-PL5-17 (missing clone):** A standalone add whose typed source matches a recorded `github`, `url`, or hosted marketplace whose `sources/<name>/` directory is gone repairs it, as Claude Code re-fetches (E-6): it re-materializes the clone or download into `sources/<name>/` through the normal staging path, refreshes the record's manifest metadata, keeps its `plugins` map, writes the config declaration if the target layer lacks it, and reports `(added)`. If the re-materialized manifest declares a different name, the add fails `{source mismatch}` and keeps the record untouched. A recorded `path` marketplace whose manifest is gone fails `{source missing}` instead of reading as `already added`.
- **D-PL5-18 (EISDIR):** The add's errno mapping matches `list` and `info`: `EISDIR`, `EIO`, and `EBADF` read `unreadable` (one shared mapping with `narrowCascadeFailure`, not a third copy), so a manifest path that is a directory renders a failed row instead of a raw exception.
- **D-PL5-19 (no-op status):** The `already added` arm stops returning `status: "added"`. It returns a distinct no-op status. That arm is standalone-only (WR-09), so the orchestrated overload's return type excludes it and `apply`/`import` need no change.

### Post-research amendments (2026-10-26)

- **D-PL5-20:** D-PL5-08 also covers the D-MF-04 path: a project-scope install that adds a marketplace only the user scope records downloads a hosted catalog once, as it clones a git one.
- **D-PL5-21:** D-PL5-10 applies to `marketplace add`. `marketplace update` and autoupdate keep their existing per-verb rule (UPD-11: a 404 on refresh reads `network error`), so each verb classifies a hosted failure the way it classifies a git one.
- **D-PL5-22:** `plugin update`'s marketplace sync does not refresh a hosted catalog (that code is Phase 7's file); recorded as a known gap for the deferred list, not changed here.
- **D-PL5-23:** Test fixtures that add a reserved name from a non-`anthropics` source are fixed test-side: scenarios publish them under the git host's `anthropics` owner; the e2e helper renames the manifest name in its temp checkout (keeps the pinned SHA).
- **D-PL5-24:** `help market` shows the marketplace help, as `help marketplace` does.
- **D-PL5-25:** `docs/json-output.md` is edited here. The AGENTS.md / PROJECT.md NFR-5 wording, the CHANGELOG line, and the decision rows go to the SUMMARY for the parent. Import's own `<mp>@<mp>` failure row (Phase 6's file) is left to Phase 6 and reported.
- **D-PL5-26:** If a marketplace-level row type lacks the `marketplaceSubject` marker (e.g. `marketplace info`'s rows), add the minimal field to `shared/notification-types.ts` / `shared/notification-json.ts`; record the touch as outside the Files line.

### Post-phase amendments (2026-10-27)

- **D-PL5-27 (refresh, MKTNAME-01 refresh part):** `marketplace update`, and so the autoupdate cascade that runs after it, checks the refreshed manifest's `name` against the reserved set. It narrows the D-PL5-03 deferral: the refresh rename is no longer deferred; the rest of MKTNAME-01 still is.
  - **Scope:** every source kind. The name goes through `reservedMarketplaceNameRefusal(name, recordedSource)`, as the add does (D-PL5-01). Only a github source owned by `anthropics` is exempt; hosted, path, and url sources are never exempt.
  - **Row shape:** the update keeps its failed marketplace block with one failed child row: `marketplaceSubject: true` (bare JSON id), reason `invalid manifest`, and a cause chain that starts with the update's own frame and ends with Claude Code's sentence (D-PL5-02). The frame is `Failed to update marketplace "<name>".` for path and hosted sources and `Marketplace "<name>" clone advanced but manifest could not be persisted.` for github and url sources. Upstream reports the same failure as `Failed to refresh marketplace '<name>': <sentence>`. No reason token is added and the frame is not stripped.
  - **Hosted:** refused inside `refreshHostedCatalog`, after the staged download validates and before the rename. The stored catalog, `state.json`, and the record stay byte-identical, and the staging directory is removed. Upstream also discards its temp download. `refreshHostedCatalog` takes the `HostedManifestSource` so the refusal knows the source kind.
  - **Path:** the manifest is read in place; the refusal runs after the read and before the record is stamped, so the record keeps its `lastSuccessfulManifest` and `lastUpdatedAt`.
  - **Git (github, url):** the record stays untouched (no stamp, no state save, no autoupdate cascade, no completion-cache drop) and the checkout is NOT restored; it stays at the fetched commit. Reasons: (1) upstream refreshes a registered github clone in place (`<owner>-<repo>`) and neither deletes nor restores it on this refusal; (2) the in-place D-14 refresh already leaves the checkout advanced when a refreshed manifest is invalid (the MU-5 `clone advanced` path), and the refusal takes that path unchanged; (3) a restore would need a HEAD read before every git refresh plus a failed-restore path, and `plugin update`'s PUP-2 sync advances the same checkout with no name check, so a restore could not keep the refused commit out anyway. Known divergence: upstream refreshes a `git` source into a `temp_git_*` clone and discards it on this refusal, so its old cache stays; our `url` kind keeps the advanced checkout.
  - **Error class:** `ReservedMarketplaceNameError` lives in `shared/errors.ts` as a subclass of `InvalidMarketplaceManifestError`, thrown by the add, the hosted refresh, and the update.
  - **Evidence (Claude Code 2.1.310 binary, grepped 2026-10-27):** the load/refresh function runs `let lt=GTt(rt.name,e);if(lt)throw Error(lt);` after it reads the refreshed manifest, for every source kind, before the cache swap and the registration write. A github cache is `<owner>-<repo>`, refreshed in place and kept on failure; a git or url cache is `temp_git_<ms>_<rand>`, removed on failure. Refresh errors surface as `Failed to refresh marketplace '<name>': <message>`.
  - **Out of scope:** `plugin update`'s PUP-2 marketplace sync (`orchestrators/plugin/update-flow.ts`) is Phase 7's; it still re-reads a refreshed github or url catalog without the check. The look-alike, other-spelling, package-manager, `claudeai-`, folder, and load-time rules stay deferred to MKTNAME-01.
- **D-PL5-29 (redirect ranges, user decision 2026-10-27):** the hosted fetch refuses a cross-origin redirect to `0.0.0.0/8` and `fc00::/7` (and the IPv4-embedded IPv6 forms of every refused range) beyond Claude Code's `Ase` list. Deliberate, stricter divergence for security: both ranges reach local or private hosts.
- **D-PL5-30 (redirect cap, user decision 2026-10-27):** the hosted fetch follows at most 5 redirects. Claude Code's hosted `marketplace.json` download sets no limit of its own (its docs cap only archive downloads at five). Deliberate divergence: the cap stops redirect loops.
- **D-PL5-31 (textual host check, user decision 2026-10-27):** the redirect host check reads the URL's host text only; a DNS name that resolves to a loopback, link-local, or metadata address passes. This matches Claude Code, whose `Ase` check is also textual. Recorded as a known limit: closing it needs a pinned-address lookup, which the `no-network-modules` rule (IL-4 / NFR-5) bans. Backlog entry proposed: HOSTED-DNS-01.

### Claude's Discretion

- Exact module and type names (`HostedManifestSource`, the fetch module, the marker file), the hosted marker's location inside `sources/<name>/`, and how the redirect host-class check is written.
- How the plans split into waves, as long as each wave's plans own disjoint files.
- Scenario file names under `features/marketplace/` and the stand-in that serves a hosted `marketplace.json` from the existing loopback https host.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets

- `domain/source.ts::parsePluginSource` — the single string/object source funnel (paths, github URL, generic https `url`, shorthands); `samePlannedSource` and `sourceLogical` are the marketplace identity and label helpers.
- `orchestrators/marketplace/add.ts` — `parseAddableSource`, `newMarketplaceName` (where the manifest name is read and `isReservedRecordKey` already refuses `__proto__`), `addGitClonedInGuard` (staging, ownership marker, leftover recognition, atomic rename, MA-9 cleanup), `failedAddRow` (the child-row-with-cause shape), `handleAddFailure`, `redeclareRecordedSource` (LAYER-01 / MPA-01 `already added`).
- `orchestrators/marketplace/shared.ts` — `marketplaceFailureRows`, `narrowCascadeFailure` (EISDIR/EIO/EBADF -> `unreadable`), `DEFAULT_GIT_OPS`, `refreshUrlClone`.
- `orchestrators/marketplace/update.ts::refreshRecord` — per-kind refresh dispatch (`github`, `url`, `path`), `manifestContentKey`, `snapshotAfterRefresh`, the cascade.
- `orchestrators/marketplace/remove.ts::removeMarketplaceFootprint` — `RecordedSourceKind`, clone removal for `github`/`url`.
- `orchestrators/plugin/shared.ts::applyPartialCascadeFold` and `orchestrators/marketplace/remove.ts::cascadePluginsInPlace` (the four-axis copy).
- `shared/git-failure-classifiers.ts` — `classifyGitSourceAccessFailure`, `hostHttpStatus`, `hostHttpFailureFrame` (status-to-token rules to mirror for the hosted fetch).
- `features/lib/https-git-host` — the loopback https stand-in the url-source scenarios use; `features/lib/published-marketplace.ts` — the official-marketplace stand-in bootstrap uses.

### Established Patterns

- Injected ports with production defaults (`gitOps`, `credentialOps`) for every network or process boundary; tests pass doubles.
- A user-visible change ships with a cucumber scenario that fails without it; unit tests pair one-to-one with source files at 100% direct coverage.
- Closed-set reason tokens; a new token is avoided when an existing one fits (D-08-07 precedent).
- Rule-pack chokepoints and ESLint BLOCK F `NETWORK_SEAMS` gate every network caller.

### Integration Points

- Reconcile (`orchestrators/reconcile/plan.ts`) and import compare marketplace sources through `samePlannedSource`; config stores the raw typed string, so the hosted classification must live in the shared funnel for `apply` to plan a declared hosted marketplace as already recorded.
- `persistence/state-io.ts::normalizeStoredSource` revalidates every stored marketplace source kind; a new kind needs an arm there or state load fails.
- Files outside the ROADMAP `Files` line this phase will likely touch: `persistence/state-io.ts` (hosted revalidation), `domain/plugin-resolver.ts`, `domain/version.ts`, `orchestrators/plugin/dependency-declaration-read.ts`, `orchestrators/plugin/info.ts` (one `hosted` arm each, beside `npm`), `orchestrators/marketplace/list.ts` (label), possibly `orchestrators/plugin/clone-cache.ts` (mirror seeding skips hosted), plus `features/**` and `test/**`. Each touch is one arm or one branch, to keep merges with Phases 2, 3, and 7 small.

</code_context>

<specifics>
## Specific Ideas

- Scenarios: a reserved name refused from a path marketplace with Claude Code's sentence; a hosted `marketplace.json` added, a plugin installed from it (git-sourced entry on the stand-in host), and the marketplace updated after the stand-in serves a new catalog; `market add`/`market list` working; `tools@tools` ids becoming `tools`; `acme/tools@a@b` cloning `acme/tools` at `a@b`; re-adding a marketplace whose clone was deleted restores it; a path marketplace whose `marketplace.json` is a directory fails `{unreadable}`.

</specifics>

<deferred>
## Deferred Ideas

- `MKTNAME-01` (new): the rest of Claude Code's reserved-name rules (look-alike, other spelling, package-manager names, `claudeai-` prefix, `<owner>-<repo>` folder), the refresh-time check, and the load-time refusal of a reserved name registered from an untrusted source.
- Upstream's broader hosted-catalog classification (every non-`.git` non-forge https URL) — would reverse MURL-01 / D-2-01 / D-2-02; a user decision.
- `headers` / `headersHelper` for hosted catalogs (only reachable from a settings declaration upstream; Pi has no such declaration surface yet).
- The owner/repo character-class validation Claude Code applies to the shorthand.
- Import (Phase 6) mapping a Claude Code `{source: "url"}` declaration onto the hosted kind.

</deferred>

## Uncertain choices (for user review)

1. **Hosted classification is `.json`-suffix only (D-PL5-04).** Alternative: Claude Code's rule (any https URL not ending `.git` and not a forge path is a catalog). Chose the narrow rule because the broad one reverses recorded decisions MURL-01 / D-2-01 / D-2-02 (suffix-less git URLs clone verbatim) and would break existing `url-source.feature` scenarios.
2. **Reserved-name scope is the exact 19-name set (D-PL5-03).** Alternative: also the look-alike, other-spelling, package-manager, `claudeai-`, and folder rules, plus refusing to load an already-registered reserved name. Chose the exact set because MKT-01 names "reserved official marketplace names" and the rest is a larger, separate surface.
3. **Reserved-name reason token `invalid manifest` (D-PL5-02).** Alternative: a new `reserved name` token. Chose reuse per the D-08-07 precedent and to avoid editing `shared/notification-types.ts`, which Phase 3 also edits.
4. **Hosted source as a new `ParsedSource` kind in the shared funnel (D-PL5-05).** Alternative: a marketplace-only type and parser. Chose the shared funnel because config sources, state records, reconcile, and import all re-parse through `parsePluginSource`; a separate parser would need every one of them rerouted. Cost: one `npm`-like arm in four plugin-side files outside the Files line.
5. **Orchestrated crash narrows to `unreadable` (D-PL5-16).** Alternative: a new reason token or a separate outcome status. Chose the existing `classifyOrchestratorThrow` fallback for consistency with every other `apply` operation; `outcome.error` still carries the real error.
6. **Missing clone is repaired, not refused (D-PL5-17).** Alternative: refuse with a remedy. Chose repair because Claude Code re-fetches and the only refuse-remedy (`remove` then `add`) uninstalls the marketplace's plugins.
7. **`market` shown in the help as `(alias: market)` (D-PL5-11).** Alternative: undocumented alias. Chose to document it the way `ls` is documented.
8. **No stranded-dependents report on `marketplace remove` (D-PL5-14).** Alternative: name them on the remove row. Chose parity (E-5) and the LOAD-03 trade already settled for reconcile-driven uninstalls.
9. **Repair resets the update baseline (D-PL5-17, review IN-07).** Alternative: keep the old `lastSuccessfulManifest` so the next `marketplace update` runs the plugin cascade. Kept the reset because a repair is a fresh add of the same source; the load-time check and `pending` still report drift.
10. **Orchestrated EACCES/EPERM now reads `permission denied` (D-PL5-16 literal).** Alternative: keep MPA-02's rule that a write's EACCES never reads `permission denied`. Chose the shared `narrowProbeError` fallback that every other `apply` step uses.
11. **Hosted redirect host check is textual (review WR-03 residual).** A DNS name that resolves to loopback/metadata passes; closing it needs `node:dns`, which the `no-network-modules` rule bans. Extra ranges `0.0.0.0/8`, `fc00::/7`, and IPv4-embedded IPv6 forms are refused beyond Claude Code's list.
12. **Hosted relative entry `./` resolves to the stored tree (review IN-06).** Claude Code refuses it. Proposed backlog entry `HOSTED-REL-01`.
