# Feature Research

**Domain:** Behavioral (cucumber) test suite for the `/claude:plugin marketplace` command family, run through a real headless Pi in RPC mode against local stand-ins
**Milestone:** `marketplace-features`
**Researched:** 2026-10-15
**Confidence:** HIGH for code-derived behavior (every row below was read from the source, not the docs); MEDIUM for the flagged doc and upstream conflicts, which need an operator decision; LOW only where marked.

> **How to read this file.** A "feature" here is a *user-visible marketplace behavior the suite must prove*. Each row gives the behavior, the observable JSON result, the source kinds it applies to, and the requirement IDs it covers. The rows are candidate requirements. The proposed IDs use the prefix `MF-<cmd>-NN` so they do not collide with existing IDs such as `INFO-01`.
>
> **Source kinds:** `dir` = local directory, `file` = direct `marketplace.json` path, `url` = https git URL served by the loopback `git http-backend` stand-in, `gh` = GitHub (`owner/repo`, `https://github.com/o/r`) routed to the stand-in through `GITHUB_BASE_URL`. `any` = all four.
>
> **Observable vocabulary:** `kind` is the payload kind. `status` and `reasons` are the marketplace-block values, or the plugin-row values when marked "row". `sev` is severity. `reload` is `needsReload`. All values are native wire tokens from `shared/notification-wire.ts` and `docs/json-output.md`.
>
> **Source-of-truth rule applied:** where code and docs disagree, the row states what the code does, and the conflict is listed under "Doc and code conflicts" so the roadmap can decide whether a scenario should pin current behavior or wait for a fix.

## Feature Landscape

### Table Stakes (each must have a scenario)

Missing any of these means a regression in core marketplace behavior can ship without a red scenario.

#### `marketplace add`

| ID | Behavior | Observable result | Sources | Governing IDs | Complexity |
|----|----------|-------------------|---------|---------------|------------|
| MF-ADD-01 | Adding a marketplace records it in the chosen scope under the name its manifest declares | `cascade`; block `{name:<manifest name>, scope, status:"added", plugins:[]}`; sev `info`; reload `false`; no tally (single-target) | any | MA-1, MA-3, MA-5, MA-11, MURL-01, SNM-33 | LOW for dir/file; MEDIUM for url/gh (stand-in) |
| MF-ADD-02 | `--scope` omitted adds to the user scope | block `scope:"user"` | dir (one kind suffices) | MA-2, SC-5 | LOW |
| MF-ADD-03 | An added marketplace appears in `marketplace list` and survives a new session (config write-back plus load-time reconcile stay a no-op) | `marketplace list` after `new_session` shows the row | dir, url | MA-1, WB-01, NFR-2 | LOW |
| MF-ADD-04 | Adding a name the scope already holds fails as a duplicate, on the manifest-derived name | block `{name:<derived>, status:"failed", reasons:["duplicate name"]}`; sev `error`; `summary:"A marketplace operation has failed."` | dir, url | MA-8, ATTR-07 | LOW |
| MF-ADD-05 | The same marketplace can be added to both scopes independently | two adds succeed; list shows two rows, project first | dir | CMP-1..8, D-29, SC-6 | LOW |
| MF-ADD-06 | A path that does not exist fails as source missing, with the typed source as the subject | `{name:<raw source>, status:"failed", reasons:["source missing"]}`; sev `error` | dir | ATTR-07, NFR-5 | LOW (needs a path placeholder, see Dependencies) |
| MF-ADD-07 | A malformed or schema-invalid manifest fails as invalid manifest, with the typed source as the subject | `reasons:["invalid manifest"]`, name = raw source | dir, url | ATTR-07, D-48-B, MA-9 | LOW for dir; MEDIUM for url |
| MF-ADD-08 | Refused source forms fail at parse level as unsupported source, and the git host receives no request | `{name:<raw>, status:"failed", reasons:["unsupported source"]}`; stand-in records zero requests | parse level, Scenario Outline: `http://…`, `ssh://…`, `git@host:o/r.git`, `https://github.com/o/r/tree/main`, `https://github.com/o` (no repo), `foo` (bare word), `a/b/c`, `~other/mp` | MA-10 (as amended by D-76-01..04), SP-1, SP-3, SP-4, SP-5, MM-4 | LOW |
| MF-ADD-09 | A url clone the host answers 404 fails as source missing | `reasons:["source missing"]`, name = raw URL | url | D-76-09, MURL-09 | MEDIUM (armable stand-in) |
| MF-ADD-10 | A url clone the host answers 5xx, or drops the connection on, fails as network unreachable | `reasons:["network unreachable"]` | url | D-76-09, GAUTH-02 | MEDIUM; the drop must happen before any response bytes, see Pitfalls |
| MF-ADD-11 | A url clone the host answers 401, with no stored credential, fails as authentication required | header `reasons:["authentication required"]`, `plugins:[]` (code; the catalog shows a synthetic child, see conflicts) | url only (never gh, see Anti-Features) | D-76-08, GAUTH-03, GAUTH-04, PROV-02 | HIGH (credential-helper isolation) |
| MF-ADD-12 | A GitHub source clones from `GITHUB_BASE_URL` at `<base>/<owner>/<repo>.git`, and the record keeps the GitHub identity | add succeeds; a later `marketplace info` shows `source:{sourceKind:"github", owner, repo}`; the stand-in records a request under `/<owner>/<repo>.git` | gh (`owner/repo`, `https://github.com/o/r`) | MA-1, D-76-02, MURL-09, new `GITHUB_BASE_URL` requirement | MEDIUM (new production env var) |

#### `marketplace remove` / `rm`

| ID | Behavior | Observable result | Sources | Governing IDs | Complexity |
|----|----------|-------------------|---------|---------------|------------|
| MF-RM-01 | Removing a marketplace with no installed plugins drops it | `{status:"removed", plugins:[]}`; sev `info`; reload `false` | dir, url | MR-1, MR-2, MR-8, MURL-04 | LOW |
| MF-RM-02 | Removing a marketplace uninstalls every plugin installed from it (cascade) | block `status:"removed"`; one row per plugin `{status:"uninstalled", name, id:"<p>@<mp>", reasons:[]}`, no `version`; reload `true` | dir (path fixture already supports install) | MR-2, MR-3, MR-8, D-22-02 | LOW |
| MF-RM-03 | After the cascade, a new session no longer offers the plugin's skills, and `plugin list` no longer lists the plugin | `the session offers no skills`; `plugin list` shows `marketplaces: []` | dir | MR-2, MR-5, NFR-2 | LOW (reuses session steps) |
| MF-RM-04 | A removed marketplace stays removed in a new session (config entry deleted, so reconcile does not re-add it) | `marketplace list` after `new_session` shows none | dir | WB-01, MR-2 | LOW |
| MF-RM-05 | Removing a name the requested scope does not hold fails as not added, with the scope bracket | `kind:"marketplace-not-added"`, `{name, scope, reasons:["marketplace not added"]}` (or `marketplace not added to <scope> scope` when the other scope holds it); sev `error` | parse-free | ATTR-06, SCOPE-01, CMP-4 | LOW |
| MF-RM-06 | Removing a name neither scope holds, with no `--scope`, fails as not added with no scope | `marketplace-not-added`, `scope` absent, `reasons:["marketplace not added"]` | — | ATTR-06, SC-4 | LOW |
| MF-RM-07 | `rm` is an alias of `remove` | identical result to MF-RM-01 | dir | AP-3 (router aliases) | LOW (one scenario, or an Outline row) |
| MF-RM-08 | A removed git marketplace can be added again from the same source (its clone was deleted, so there is no stale clone) | second add `status:"added"` | url, gh | MR-5, MURL-04, MA-6 | MEDIUM |

#### `marketplace list` / `ls`

| ID | Behavior | Observable result | Sources | Governing IDs | Complexity |
|----|----------|-------------------|---------|---------------|------------|
| MF-LS-01 | With nothing added, the list is empty | `cascade`, `marketplaces:[]`; sev `info` (tally shape to be read off a real run) | — | ML-4 (as amended), CMC-10, D-16-17 | LOW |
| MF-LS-02 | The list shows every marketplace of both scopes, project scope first, each with its autoupdate state | one block per record, `{name, scope, plugins:[], details:{autoupdate, lastUpdatedAt}}`; tally `label:"Marketplace list"` | dir plus url | ML-1..3, SC-6, MSG-GR-3 | MEDIUM (`lastUpdatedAt` is a run-time timestamp, see Dependencies) |
| MF-LS-03 | `--scope` narrows the list to one scope | only that scope's rows | dir | SC-6, AP-2 | LOW |
| MF-LS-04 | `ls` is an alias of `list` | same as MF-LS-02 | dir | AP-3 | LOW |
| MF-LS-05 | Listing never touches the network | stand-in records zero requests after `marketplace list` over git-sourced records | url, gh | NFR-5, ML-3 | LOW once the stand-in records requests |

#### `marketplace info`

| ID | Behavior | Observable result | Sources | Governing IDs | Complexity |
|----|----------|-------------------|---------|---------------|------------|
| MF-INFO-01 | Info on a directory marketplace shows its absolute path, autoupdate state and description | `kind:"marketplace-info"`, `{name, scope, details:{autoupdate:false, lastUpdatedAt}, source:{sourceKind:"path", absPath}, description?}` | dir, file | INFO-01, INFO-07, MA-3 | MEDIUM (absPath and timestamp placeholders) |
| MF-INFO-02 | Info on a url marketplace shows the identity URL (`.git` and trailing slash stripped) and the ref | `source:{sourceKind:"url", url, ref?}` | url (with and without `#ref`) | MURL-05, D-76-09, D-76-10, D-2-05 | MEDIUM |
| MF-INFO-03 | Info on a GitHub marketplace shows owner, repo and ref | `source:{sourceKind:"github", owner, repo, ref?}` | gh (`owner/repo#ref`, `owner/repo@ref`) | INFO-01, D-76-04 | MEDIUM |
| MF-INFO-04 | A name held by both scopes, with no `--scope`, fans out into one block per scope, project first | `kind:"marketplace-info-cascade"`, `blocks:[project, user]` | dir | INFO-03, MSG-GR-3 | MEDIUM (new driver kind) |
| MF-INFO-05 | A name neither scope holds fails as not added, with no scope | `marketplace-not-added`, no `scope`, `reasons:["marketplace not added"]`, sev `error` | — | INFO-04, ATTR-06 | LOW |
| MF-INFO-06 | `--scope` naming the scope that misses, while the other scope holds the name, says which scope missed | `marketplace-not-added`, `scope:"user"`, `reasons:["marketplace not added to user scope"]` (code; the catalog shows plain `marketplace not added`) | dir | SCOPE-01, CMP-4 | LOW |
| MF-INFO-07 | Info never touches the network | stand-in records zero requests | url, gh | NFR-5 | LOW |

#### `marketplace update`

| ID | Behavior | Observable result | Sources | Governing IDs | Complexity |
|----|----------|-------------------|---------|---------------|------------|
| MF-UPD-01 | Updating a marketplace whose manifest did not change skips it as up to date | `{status:"skipped", reasons:["up-to-date"], plugins:[]}`; sev `info`; reload `false` | dir, url, gh | UXG-05, MU-1, MURL-03 | LOW for dir; MEDIUM for git |
| MF-UPD-02 | Updating a marketplace whose manifest changed reports it updated, with no plugin rows when autoupdate is off | `{status:"updated", plugins:[]}`; reload `false` | dir, url (new commit served), gh | UXG-05, MU-4, MU-6, MURL-03 | MEDIUM (publish a new commit to the stand-in repo) |
| MF-UPD-03 | With autoupdate off, installed plugins keep their version after a manifest update | `plugin list` still shows the old version | dir | MU-6 | LOW |
| MF-UPD-04 | With autoupdate on, a marketplace update updates the installed plugins whose offered version moved | block `status:"updated"`; rows `{status:"updated", from, to, scope}`; reload `true`; a new session offers the new skill version | dir (one git kind optional) | MU-4, MU-6, MU-7, MU-9 | MEDIUM |
| MF-UPD-05 | With autoupdate on and nothing changed, the marketplace collapses to up to date | `{status:"skipped", reasons:["up-to-date"], plugins:[]}` | dir | UXG-05 | LOW |
| MF-UPD-06 | A refreshed manifest that offers a new plugin does not install it | `plugin list` shows the new plugin `available`, not installed | dir | MU-8 | LOW |
| MF-UPD-07 | A bare `update` refreshes every marketplace of both scopes and emits one result per marketplace, each with the plural tally | N `cascade` payloads, project first, each tally `label:"Marketplace update"` | dir | MU-1, SC-6 | MEDIUM (driver must accept N payloads) |
| MF-UPD-08 | A bare `update` with nothing added reports no marketplaces | one `cascade`, `marketplaces:[]` | — | MU-1, CMC-10 | LOW |
| MF-UPD-09 | Updating a name the scope does not hold fails as not added (explicit-scope and bare forms) | `marketplace-not-added` with and without `scope` | — | ATTR-06, SC#1, SC-4 | LOW |
| MF-UPD-10 | A path marketplace whose manifest became invalid fails with an invalid-manifest child row | block `status:"failed"`; one row `{name:<mp>, status:"failed", reasons:["invalid manifest"], cause}`; sev `error` | dir | ATTR-10, D-48-B, NFR-5 | LOW |
| MF-UPD-11 | A git marketplace whose host fails (5xx, dropped connection, or 404) fails as network unreachable | block `failed`; child row `reasons:["network unreachable"]`, `cause.causeChain[0]:"Failed to update marketplace \"<mp>\"."` | url | MU-5, MURL-03 | MEDIUM |
| MF-UPD-12 | A url marketplace whose host now answers 401 fails as authentication required, with the cause line that names `git credential approve` for that host | child row `reasons:["authentication required"]`; cause chain ends with `no credential was obtained for 127.0.0.1:<port>; store one with: …` | url only | GAUTH-04, D-1-02 | HIGH (port placeholder plus credential isolation) |

#### `marketplace autoupdate` / `noautoupdate`

| ID | Behavior | Observable result | Sources | Governing IDs | Complexity |
|----|----------|-------------------|---------|---------------|------------|
| MF-AU-01 | Turning autoupdate on for a marketplace records it | `{status:"autoupdate enabled", plugins:[]}`; sev `info`; reload `false`; no tally | dir | MAU-1, UXG-04, SNM-33 | LOW |
| MF-AU-02 | Turning autoupdate on twice reports it already on | `{status:"skipped", reasons:["already autoupdate"]}`; sev `info` | dir | MAU-3, UXG-02 | LOW |
| MF-AU-03 | A freshly added marketplace already has autoupdate off, so `noautoupdate` reports it already off | `{status:"skipped", reasons:["already no autoupdate"]}` | dir (also url and gh: add never enables it) | MAU-1, MAU-4, catalog "github-source" note | LOW |
| MF-AU-04 | `noautoupdate` after `autoupdate` turns it off | `status:"autoupdate disabled"` | dir | MAU-1 | LOW |
| MF-AU-05 | The setting shows in `marketplace list` and `marketplace info`, and survives a new session | list `details.autoupdate:true`; info `details.autoupdate:true` after `new_session` | dir | MAU-4 (as amended by SPLIT-01: config, not state) | LOW |
| MF-AU-06 | With no name, the flip applies to every marketplace of both scopes, with the plural tally | one block per record; tally `label:"Marketplace autoupdate"` | dir | MAU-2, SC-6 | LOW |
| MF-AU-07 | With no name and nothing added, the result is empty | `marketplaces:[]` | — | MAU-2, CMC-10 | LOW |
| MF-AU-08 | A name neither scope holds fails as not added; the bare form reports the project scope | `marketplace-not-added`, `scope:"project"`, `reasons:["marketplace not added"]` | — | ATTR-05 | LOW |

#### Help and usage errors (parse level, network-free)

| ID | Behavior | Observable result | Governing IDs | Complexity |
|----|----------|-------------------|---------------|------------|
| MF-USE-01 | `marketplace help` and `help marketplace` print the marketplace usage | `kind:"usage-info"`, `usage:` = `MARKETPLACE_USAGE`; sev `info` | AP-3, RAWS-01 | LOW (driver must accept `usage-info`, which the milestone list omits) |
| MF-USE-02 | `marketplace` with no subcommand, and an unknown subcommand, print the usage with a reason | `usage-error`, `message:"marketplace requires a subcommand."` / `Unknown marketplace subcommand: "<x>".`, `usage:` = `MARKETPLACE_USAGE`; sev `error` | AP-3 | LOW |
| MF-USE-03 | A missing required argument names itself (`add`, `remove`, `info`) | `message:"Missing required argument."`, `usage:` = that verb's usage line | MSG-NC-2, AP-5 | LOW |
| MF-USE-04 | Surplus positionals are rejected | `message:"Too many arguments."` | AP-5 | LOW |
| MF-USE-05 | Unknown flags are rejected, including `--local` on verbs that do not write config (`list`, `info`, `update`) | `message:"Unknown flag: \"--x\"."` | AP-5 | LOW |
| MF-USE-06 | A bad or missing `--scope` value is rejected, in any position | `Invalid --scope value: "global". Must be "user" or "project".` / `--scope requires a value: "user" or "project".` | AP-2, AP-4 | LOW |
| MF-USE-07 | An explicitly empty optional argument is rejected, not treated as omitted (`update ""`, `autoupdate ""`) | `message:"Argument must not be empty."` | AP-6 | LOW |
| MF-USE-08 | `marketplace help` with an argument is rejected | `message:"marketplace help takes no arguments."`, `usage:"Usage: /claude:plugin marketplace help"` | router | LOW |

Usage scenarios suit a few `Scenario Outline`s, one per message family, with columns `command | message | usage`.

### Differentiators (valuable, not required for the milestone)

| ID | Behavior | Value | Complexity | Notes |
|----|----------|-------|------------|-------|
| MF-HOST-01 | A url source is cloned at exactly the URL typed, `.git` is not appended, and one request is made per operation | Pins MURL-08/09 end to end: the stand-in serves only the verbatim path and returns 404 for `…/repo.git` | MEDIUM | Needs the request log on the stand-in; asserts paths, not counts of pack exchanges |
| MF-HOST-02 | GitHub spellings fold to one source: `https://GitHub.com/o/r`, `https://www.github.com/o/r`, `https://github.com/o/r.git`, `https://github.com/o/r/` | Guards D-76-02 | LOW once MF-ADD-12 exists | Scenario Outline |
| MF-HOST-03 | `owner/repo@ref` and `owner/repo#ref` clone that ref | Guards D-76-04; the PRD (MA-10, SP-2) still says to refuse `@ref` | MEDIUM | Stand-in repo needs a tag or branch |
| MF-ADD-13 | `add --local` writes the declaration to `claude-plugins.local.json`, and `remove --local` clears it | WB-01 per-machine layer | MEDIUM | Observable only through a user-owned file in the scope root, which steps may name |
| MF-ADD-14 | `add ~/…` keeps the `~` form and resolves against HOME | MA-4, SP-7 | LOW | HOME is the sandbox, so it is hermetic |
| MF-RM-09 | A name held by both scopes, removed with no `--scope`, removes only the project record | SC-4 / MR-1 precedence | LOW | Contrast with MF-INFO-04 (fan-out) and MF-AU-06 (flips both) |
| MF-AU-09 | `autoupdate <name>` with no `--scope`, for a name in both scopes, flips both records in one single-cardinality result | Documents an asymmetry with `update` and `remove` (project only) | LOW | Pin it, or ask whether it is intended |
| MF-UPD-13 | Autoupdate-on update of a plugin the refreshed manifest dropped: row `skipped {not in manifest}`, sev `warning`, summary `A plugin operation needs attention.` | LIFE-06 | MEDIUM | |
| MF-UPD-14 | Update of a path marketplace whose directory vanished fails as source missing (not network unreachable) | ATTR-10 / NFR-5 truthfulness | LOW | |
| MF-INFO-08 | Info on a marketplace whose manifest became invalid reports a `plugin-info` failure row `{status:"failed", reasons:["invalid manifest"]}` (`unparseable` for malformed JSON) | D-48-B / IN-02 | MEDIUM | Driver must accept the `plugin-info` kind; with both scopes the success and the failure come as two payloads |
| MF-INFO-09 | Info shows `allowedMarketplaces` from `allowCrossMarketplaceDependenciesOn` | D-11-06 | LOW | Needs a manifest-field knob on the fixture |
| MF-UPD-15 | Update of a `file`-kind marketplace whose manifest sits outside `.claude-plugin/` | Likely exposes a bug, see conflict C-10 | LOW | Write it after the operator rules on C-10 |

### Anti-Features (do not test)

| Anti-feature | Why tempting | Why not | Alternative |
|--------------|--------------|---------|-------------|
| Any scenario that reaches live `github.com` or another public host | "Real GitHub" feels realistic | The cucumber rules forbid the network as a BLOCKER, and the run becomes flaky | `GITHUB_BASE_URL` plus the loopback stand-in |
| A 401 scenario on a GitHub (`gh`) source | Symmetry with MF-ADD-11 | `hostFromCloneUrl` returns the literal `github.com` for the GitHub kind, so a 401 runs `git credential fill` for `github.com` (it can read the operator's real keychain and send that token to the stand-in), then runs the GitHub Device Flow against real `github.com` (`domain/github-auth.ts` `fetch`), because RPC mode is not `print` | Cover 401 on `url` only. Unit tests cover the Device Flow. |
| Asserting the clone directory, `sources/<name>/`, the ownership marker or `state.json` contents | Directly "proves" MR-5 or MA-5 | Implementation detail; the cucumber rules say steps name only user-visible things | Prove cleanup through a re-add (MF-RM-08) and a new-session list |
| Stale-clone and leftover-recognition scenarios (MA-6, MA-12..14) | Real user-visible error tokens | You can reach them only by planting a tree inside the extension's private storage, which is an implementation detail. Unit tests in `tests/orchestrators/marketplace/add.test.ts` already cover them. | Keep them in unit tests |
| Lock-held (`{lock held}`) and permission-denied (`EACCES`) cascades | Real failure tokens | They need a concurrent process or chmod games, which flake on CI (memory: CI race-test flake cluster) | Unit and integration tests |
| Device-flow prompt (`device-flow-prompt` kind) | It is a marketplace-add surface | It needs GitHub Device Flow endpoints, which means the network | Unit tests with `deviceFlowHttp` |
| `bootstrap` (adds `anthropics/claude-plugins-official`) | It is a marketplace add | Plugin command, out of milestone scope. It could run through `GITHUB_BASE_URL` later. | A later milestone |
| Text-renderer byte forms (`● alpha [project] <autoupdate>`) | `docs/output-catalog.md` is detailed | The suite reads JSON, and the catalog tests already lock the text | Compare JSON payloads |
| Pinning `lastUpdatedAt` values, absolute temp paths or loopback ports literally | Whole-result tables want every field | They change every run | Placeholder substitution in steps (see Dependencies) |
| Plugin install, uninstall or update flows beyond the cascade | Fixtures exist | Out of milestone scope | `features/plugin/*` |

## Doc and code conflicts (trust code; each needs a scenario decision)

| # | Where | Docs say | Code does | Recommendation |
|---|-------|----------|-----------|----------------|
| C-1 | catalog `add-authentication-required` | Synthetic child failed row carrying `{authentication required}` and the HTTP cause; summary `Some operations have failed.` | `handleAddFailure` puts `reasons:["authentication required"]` on the marketplace header with `plugins:[]` and no cause; the summary is the marketplace form | Pin the code; fix the catalog |
| C-2 | catalog `scope-mismatch-not-added` (info) and the explicit-scope not-added states of remove, update and autoupdate | `{marketplace not added}` with `[user]` | `crossScopeFlag` / `resolveScopeOrNotifyNotAdded` add `presentInOtherScope`, so the reason becomes `marketplace not added to user scope` when the other scope holds the name | Pin the code; scenario MF-INFO-06 |
| C-3 | catalog `failure-unreachable` (add) | Bare `(failed)` header, no reason | Never emitted in standalone mode: an unclassified error is re-thrown, and the command run turns it into `kind:"internal-error"`, `summary:"Command failed unexpectedly."` | Stale catalog state. An unclassified TLS error (for example a missing `NODE_EXTRA_CA_CERTS`) surfaces as `internal-error`. |
| C-4 | catalog "unsupported source" note | Lists `url` as unimplemented | `url` is admitted (MURL-01); only `git-subdir`, `npm` and `unknown` are refused | Doc fix |
| C-5 | PRD MA-10, SP-2, SP-3 | Refuse `owner/repo@<ref>` and every other `://` host | `owner/repo@ref` → github plus ref (D-76-04); any `https://` host → `url` (MURL-01); `http://`, `ssh://` and `git@` are still refused (D-76-01) | Scenarios follow the code; the PRD needs an amendment |
| C-6 | PRD MA-7 | Fail with "git not found on PATH" | Git operations use isomorphic-git, so no git binary is needed for clone. The `git` binary is used only by `git credential fill`. | Obsolete requirement; do not test |
| C-7 | PRD MR-4, MR-8, ML-1..4, MU-1, MAU-3, MA-11 | Text messages, `warning` for a partial remove, `verb: drop` reload | JSON wire: partial remove is `error`; reload is `needsReload`; empty is `marketplaces:[]` | Test the wire; PRD wording is v1-era |
| C-8 | PRD MAU-4 | Flag round-trips through `state.json` | Flag lives in `claude-plugins.json` (SPLIT-01); a flip never writes state | Test through `list`/`info` and a new session only |
| C-9 | PRD MU-2 | `git pull --ff-only` | fetch, then `forceUpdateRef` and checkout (D-14); upstream is followed blindly | Not observable; do not test |
| C-10 | MA-3 (file path) vs `update` | Direct `marketplace.json` path accepted | `addPathInGuard` sets `marketplaceRoot = dirname(dirname(file))`; `update` reads `<marketplaceRoot>/.claude-plugin/marketplace.json`. A manifest outside `.claude-plugin/` therefore updates as `source missing`, and info shows the grandparent as `absPath`. | LIKELY BUG (MEDIUM confidence). Table-stakes scenarios use `<root>/.claude-plugin/marketplace.json`. Raise the other layout with the operator before writing MF-UPD-15. |
| C-11 | router `MARKETPLACE_USAGE` | `add <source> [--scope user|project]` (no `--local`) | `add`, `remove`, `autoupdate` and `noautoupdate` accept `--local`, and their own usage lines say so | Doc inconsistency inside the code; MF-USE-01 pins it, so decide first whether to fix |
| C-12 | GAUTH-04 for `add` | "fails with a cause line naming `git credential approve`" | Only the `update` path attaches `NO_STORED_CREDENTIAL_CAUSE`; the add header carries no cause, so `add` shows no cause line | Ask: gap or accepted? MF-ADD-11 pins today's form |
| C-13 | `update` vs `add` 404 classification | — | `add` maps HTTP 404 → `source missing` (`classifyGitSourceAccessFailure`); `update` uses `classifyGitTransportFailure`, which has no 404 arm, so it falls back to `network unreachable` | Inconsistent truthfulness; pin or fix (MF-UPD-11) |

## Upstream Claude Code parity points

Checked against code.claude.com docs (`discover-plugins`, `plugin-marketplaces`), fetched 2026-10-15. Confidence is HIGH for what the docs state. The binary was not grepped.

| Point | Upstream | Here | Scenario? |
|-------|----------|------|-----------|
| Remove uninstalls the marketplace's plugins and clears their settings entries | Yes ("uninstalls every plugin you installed from it and removes their `enabledPlugins` entries") | Yes (cascade plus config write-back) | Yes: MF-RM-02..04 |
| Bare `name/name` read as GitHub; local paths need `./` or `../` | Yes | Yes (`parseShorthandSourceForm`) | Yes: an MF-ADD-08 row (`a/b/c`) and MF-ADD-12 |
| `owner/repo#ref` pins a ref | Yes | Yes, plus `@ref` | Differentiator MF-HOST-03 |
| Third-party marketplaces have auto-update off by default | Yes | Yes, for every kind | Yes: MF-AU-03 |
| `git@host:path` SSH accepted | Yes | Refused (recorded D-76-01) | Pin the refusal (MF-ADD-08); recorded divergence |
| Hosted `https://…/marketplace.json` URL | Accepted | Parsed as a `url` git source, so the clone fails | Unrecorded divergence: ask the operator, do not write a scenario yet |
| Reserved official names (`claude-plugins-official` and others) refused unless from the official source | Yes (`The name '<name>' is reserved…`) | Not enforced | Unrecorded parity gap: ask, do not pin |
| `/plugin market` short alias | Yes | `Unknown subcommand: "market".` | Gap: ask, do not pin |
| Bare `marketplace update` leaves plugins at current versions (shell CLI); the panel's "Update marketplace" updates plugins | Mixed | Updates plugins only when autoupdate is on (MU-6) | Pin the current behavior (MF-UPD-03/04); flag the parity question |
| Private HTTPS uses the git credential helpers and never prompts | Yes | Yes (stored-credential bundle, `GIT_TERMINAL_PROMPT=0`) | MF-ADD-11 / MF-UPD-12 on `url` |

## Feature Dependencies

```
Driver: accept every marketplace payload kind (cascade, marketplace-info,
        marketplace-info-cascade, marketplace-not-added, usage-error,
        usage-info, plugin-info) + N payloads per command
    └──required by──> MF-INFO-*, MF-USE-*, MF-UPD-07, MF-*-not-added rows

Placeholder substitution in result tables (sandbox paths, stand-in
URL/port, run timestamps)
    └──required by──> MF-ADD-06/07/09/10/11, MF-INFO-01/02, MF-LS-02, MF-UPD-12

Loopback HTTPS git stand-in (BeforeAll, before Pi starts; per-scenario
reset of repos, arming, request log)
    ├──required by──> every url/gh row, MF-LS-05, MF-INFO-07, MF-ADD-08 "no request"
    └──requires──> NODE_EXTRA_CA_CERTS + GITHUB_BASE_URL in the Pi child env
                   (tests/e2e/_rpc.ts childEnvironment is fixed today)

GITHUB_BASE_URL production env var
    └──required by──> MF-ADD-12, MF-HOST-02/03, every gh row
        (must cover canonicalCloneUrl + networkCloneUrl + update.ts:399;
         leftover recognition compares canonicalCloneUrl identities)

Credential isolation (no system/global git credential helper reachable:
GIT_CONFIG_NOSYSTEM=1, sandbox HOME/XDG_CONFIG_HOME)
    └──required by──> MF-ADD-11, MF-UPD-12

Existing path-marketplace fixture + plugin install Given
    └──required by──> MF-RM-02/03, MF-UPD-03..06
Fixture knobs: description, invalid manifest, manifest-at-file-path,
new commit on a served repo, tag/branch
    └──required by──> MF-INFO-01, MF-ADD-07, MF-UPD-02/10, MF-HOST-03
```

### Dependency Notes

- **The driver comes first.** `features/lib/pi-commands.ts::runCommand` validates only `CASCADE_PAYLOAD_SCHEMA` and asserts exactly one payload. `marketplace help` emits `usage-info`, info with a broken manifest emits `plugin-info`, and a bare `update` emits one payload per marketplace, so the milestone's list of four kinds is short by at least two. `PluginWorld.result` is typed `CascadePayload` and needs to widen too.
- **Stand-in before Pi.** Pi lives for the whole run (`features/support/pi-process.ts`), and its environment is fixed at spawn by `tests/e2e/_rpc.ts::childEnvironment` (`HOME`, `PI_CODING_AGENT_DIR`, `PI_OFFLINE`, `PATH` only). The CA certificate path and `GITHUB_BASE_URL` must therefore exist before `PiProcess.start`, and the stand-in's port is fixed for the run. The per-scenario `Before()` must also reset the stand-in's repos, arming and request log, and assert that they are empty.
- **Dynamic values.** Every path add stamps `lastUpdatedAt` (`addPathInGuard`), so `marketplace list` and `info` always carry `details.lastUpdatedAt`. `info` carries `absPath` (a temp path). Failure subjects for `dir`, `file` and `url` carry the typed source, which is a temp path or `https://127.0.0.1:<port>/…`. The house rule is "a table lists every field", and steps must not name temp paths, so tables need named placeholders (for example `<marketplaces>/demo`, `<git host>/team/mp.git`, `<a timestamp>`). Running relative `./…` paths from the project cwd is an alternative for subjects only. `stat` resolves relative paths against the process cwd, which equals `ctx.cwd` in this harness.

## MVP Definition

### Launch with (this milestone)

- [ ] Driver widening: all marketplace kinds, N payloads, placeholders. Every other row depends on it.
- [ ] `add` over dir and file: MF-ADD-01..07, MF-ADD-08 (parse-level Outline).
- [ ] `remove`, `list`, `info` and `autoupdate` over dir: MF-RM-01..07, MF-LS-01..04, MF-INFO-01, 04..06, MF-AU-01..08.
- [ ] `update` over dir, including the cascade: MF-UPD-01..10.
- [ ] Usage and help: MF-USE-01..08.
- [ ] HTTPS stand-in plus `url` kind: MF-ADD-01/04/07/09/10, MF-RM-08, MF-LS-05, MF-INFO-02/07, MF-UPD-01/02/11.
- [ ] `GITHUB_BASE_URL` plus `gh` kind: MF-ADD-12, MF-INFO-03, MF-UPD-01/02 over gh.

### Add after validation (same milestone if time allows)

- [ ] 401 rows (MF-ADD-11, MF-UPD-12), once credential isolation is proven not to reach the operator's keychain.
- [ ] MF-HOST-01..03 (verbatim URL, GitHub spelling fold, refs).
- [ ] MF-RM-09, MF-AU-09, MF-UPD-13/14, MF-INFO-08/09, MF-ADD-13/14.

### Future consideration

- [ ] MF-UPD-15 / C-10 (manifest outside `.claude-plugin/`): after an operator ruling.
- [ ] Upstream gaps (reserved names, hosted `marketplace.json`, `/plugin market`): after an operator ruling under the Upstream parity constraint.

## Feature Prioritization Matrix

| Feature group | User value | Implementation cost | Priority |
|---------------|------------|---------------------|----------|
| Driver kinds plus placeholders | HIGH (enables everything) | MEDIUM | P1 |
| add/remove/list/info/autoupdate over dir and file | HIGH | LOW | P1 |
| update plus autoupdate cascade over dir | HIGH | LOW to MEDIUM | P1 |
| Usage errors and help | MEDIUM | LOW | P1 |
| url kind via the HTTPS stand-in, including 404/5xx/drop | HIGH | MEDIUM | P1 |
| gh kind via `GITHUB_BASE_URL` | HIGH | MEDIUM (production change) | P1 |
| 401 on url (add/update) | MEDIUM | HIGH (credential isolation) | P2 |
| Request-path assertions (MURL-08/09, `.git` append) | MEDIUM | LOW once the log exists | P2 |
| Scope asymmetries, LIFE-06, plugin-info failure | MEDIUM | LOW to MEDIUM | P2 |
| Parity gaps, C-10 | depends on ruling | — | P3 |

## Competitor Feature Analysis

| Feature | Claude Code `/plugin marketplace` | nklisch/pi-plugins (memory: skills/hooks/MCP only, has TUI) | This suite's approach |
|---------|-----------------------------------|-----------------------------------------------------|------------------------|
| Source forms | GitHub shorthand, any git URL, SSH, local dir or file, hosted JSON | not researched | Every accepted form plus parse-level refusals |
| Remove cascades to plugins | Yes | not researched | MF-RM-02..04 |
| Auto-update default off for third-party marketplaces | Yes | not researched | MF-AU-03 |
| Private repos through credential helpers | Yes, never prompts | not researched | MF-ADD-11 / MF-UPD-12 on url |

## Sources

- Code (HIGH): `extensions/pi-claude-marketplace/edge/router.ts`, `edge/args.ts`, `edge/args-schema.ts`, `edge/handlers/shared.ts`, `edge/handlers/marketplace/*.ts`, `edge/handlers/plugin/help.ts`, `orchestrators/marketplace/{add,remove,list,info,update,autoupdate,shared}.ts` and `*.messaging.ts`, `orchestrators/auth-host.ts`, `domain/source.ts`, `domain/clone-key.ts`, `shared/git-failure-classifiers.ts`, `shared/notification-wire.ts`, `shared/notification-resolve.ts`, `shared/notification-command-error.ts`.
- Harness (HIGH): `features/lib/{pi-commands,pi-process,path-marketplace}.ts`, `features/support/{world,pi-process}.ts`, `features/step_definitions/*.ts`, `tests/e2e/_rpc.ts`, `features/plugin/*.feature`, `.agents/skills/cucumber/**`.
- Docs (MEDIUM where they conflict with code): `docs/output-catalog.md` (marketplace sections), `docs/json-output.md`, `docs/prd/pi-claude-marketplace-prd.md` (MA, MR, ML, MU, MAU, SP, SC, AP), `.planning/milestones/url-source-REQUIREMENTS.md` (MURL, PROV), `.planning/milestones/ws-git-hosts-2026-10-01/milestones/any-git-host-REQUIREMENTS.md` (GAUTH-03..06, MURL-08/09, MA-12..14).
- Upstream (HIGH for stated behavior): https://code.claude.com/docs/en/discover-plugins and https://code.claude.com/docs/en/plugin-marketplaces, fetched 2026-10-15.

---
*Feature research for: marketplace behavioral test suite (`marketplace-features`)*
*Researched: 2026-10-15*
