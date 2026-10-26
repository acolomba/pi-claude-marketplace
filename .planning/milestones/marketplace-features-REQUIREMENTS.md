# Requirements Archive: marketplace-features Marketplace Behavioral Tests

**Archived:** 2026-10-21
**Status:** SHIPPED

For current requirements, see `.planning/REQUIREMENTS.md`.

---

# Requirements: pi-claude-marketplace — marketplace-features

**Defined:** 2026-10-15
**Core Value:** A Pi user can run `/claude:plugin install <plugin>@<marketplace>` and, after `/reload`, have every supported Claude plugin component appear as a working Pi-native artifact -- atomically, recoverably, and with soft-dependency degradation that never blocks the install.
**Milestone goal:** A cucumber suite drives every `/claude:plugin marketplace` lifecycle command through a real headless Pi, against local stand-ins for every source kind, so a regression in marketplace behavior fails a scenario named after it.

Each behavior requirement is met by at least one scenario under
`features/marketplace/` that compares the whole command result (payload kind,
status, reasons, severity, needs-reload) and fails under a plausible wrong
implementation. Source kinds: **dir** (local directory), **file** (direct
`marketplace.json` path), **url** (https git URL on the loopback stand-in),
**gh** (`owner/repo` or `https://github.com/...` through the override).
Research detail per requirement is in `.planning/research/FEATURES.md`
(`MF-*` IDs).

## v1 Requirements

### Suite infrastructure

- [x] **DRV-01**: The driver returns every payload a command emits, validates each against the published notification schema, and asserts the expected kinds and count (`cascade`, `marketplace-info`, `marketplace-info-cascade`, `marketplace-not-added`, `usage-error`, `usage-info`, `plugin-info`; one payload per marketplace from a bare `update`)
- [x] **DRV-02**: Run-specific values (sandbox paths, the stand-in origin) are written in scenarios as exact tokens substituted in both directions, and `lastUpdatedAt` is checked within a time window, never hidden
- [x] **DRV-03**: Pi, the stand-in, and every fixture `git` run with a hermetic git environment (`GIT_CONFIG_NOSYSTEM=1`, a sandbox global config, no inherited `GIT_*`), so no scenario reads the developer's credential helpers or git config
- [x] **DRV-04**: A gate fails when a step definition is unused, undefined, or ambiguous (`cucumber-js --dry-run --format usage`)

### HTTPS git stand-in

- [x] **HOST-01**: A loopback HTTPS git server (a `node:https` CGI wrapper around `git http-backend`, run-time openssl certificate trusted through `NODE_EXTRA_CA_CERTS`) serves bare marketplace repositories that isomorphic-git inside Pi can clone and fetch
- [x] **HOST-02**: The stand-in lives for the worker's run alongside Pi and is reset before every scenario (repositories, arming, request log, CGI children), with the reset asserted empty; the cucumber skill rule is amended to allow it
- [x] **HOST-03**: A scenario can arm a repository to answer 401, 404, or 5xx, or to drop the connection
- [x] **HOST-04**: The stand-in records every request, and scenarios can assert the exact request log, including that it is empty

### GitHub clone-base override (D-MF-01)

- [x] **GHB-01**: With `PI_CLAUDE_MARKETPLACE_GITHUB_BASE_URL` set, GitHub sources (`owner/repo`, `https://github.com/o/r[.git][#ref]`) clone from `<base>/<owner>/<repo>.git`
- [x] **GHB-02**: The override reaches every GitHub site through one seam: origin matching for leftover clones, marketplace update, and the auth host (bound to the override host, so Device Flow never runs against it); a source-walk gate fails on a new hard-coded `github.com` URL outside the seam
- [x] **GHB-03**: A set but invalid override (not `https:`, carries userinfo, a query, or a fragment) fails with a typed error that names the variable
- [x] **GHB-04**: With the override unset, behavior is byte-identical to today, and `list`, `info`, and `claude-plugins.json` show GitHub sources in github.com terms either way
- [x] **GHB-05**: The override is documented (README and CHANGELOG) as a divergence from Claude Code

### Defect fix

- [x] **FIX-01**: `marketplace update` of a marketplace added from a `marketplace.json` outside `.claude-plugin/` re-reads the manifest the user added instead of failing as `source missing`, and `info` shows the right path (C-10)
- [x] **FIX-02**: A marketplace added with `--local` is never written into the scope's `claude-plugins.json`: after `add --local` and a reload, only `claude-plugins.local.json` declares it, and after `remove --local` and a reload it stays removed (the first-run migration leak found in Phase 3 discussion)
- [x] **FIX-03**: A command that would write a plugin declaration into a scope's `claude-plugins.json` is refused when that plugin's marketplace is declared only in the scope's `claude-plugins.local.json`; the failed row suggests `--local` (D-MF-02)

### Config layers (D-MF-03)

A scope (user or project) has two layers: shared (`claude-plugins.json`) and local (`claude-plugins.local.json`); see PROJECT.md "Terminology: Scope and Layer". Mutations that name a marketplace or plugin are partitioned by layer: shared by default, local with `--local`.

- [x] **LAYER-01**: The same marketplace may be declared in both layers of a scope; adding it to one layer while the other declares it succeeds
- [x] **LAYER-02**: `marketplace remove`, `autoupdate`, and `noautoupdate` naming a marketplace change only the target layer and fail when that layer does not declare it
- [x] **LAYER-03**: Removing a marketplace from a layer uninstalls only the plugins that layer declares from it
- [x] **LAYER-04**: Plugin verbs naming a plugin (install, uninstall, enable, disable, update, reinstall) act on the target layer (shared by default, local with `--local`); uninstall, enable, disable, update, and reinstall fail with `plugin declared locally` or `plugin declared in shared config` when only the other layer declares the plugin; a verb naming no plugin covers both layers
- [x] **LAYER-05**: The same plugin may be declared in both layers of a scope and is installed once; installing it into a layer while the other layer declares it adds the declaration, installs nothing, and reports `{already installed in [shared|local] layer}` naming the other layer; uninstalling it from a layer while the other layer declares it drops only that declaration, uninstalls nothing, and reports `{still installed in [shared|local] layer}` with the hint to repeat [with|without] `--local`
- [x] **LAYER-06**: A plugin's marketplace is declared in the same layer as the plugin; on load a violation is a configuration error for that layer (as CFG-03); `install --local` under a marketplace only the shared layer declares also declares the marketplace in the local layer, and a flagless install under a local-only marketplace stays refused (FIX-03)
- [x] **LAYER-07**: A project-scope install that uses a user-scope marketplace declares it in the project config and gives the project its own record and clone; a user-scope remove leaves the project scope working (D-MF-04)
- [x] **LAYER-08**: An installed plugin that no layer declares is a dependency; a named uninstall of it is refused listing the plugins in the target layer that need it, uninstalls nothing when only plugins of the other layer need it, and uninstalls it only when nothing needs it
- [x] **LAYER-09**: Plugin entries merge field by field across the two layers, local winning on conflicts (for example `enabled`)

### Terminology (TERM)

- [x] **TERM-01**: User-visible text (reason tokens, messages, catalog, docs, README) and code identifiers use the PROJECT.md terms consistently: scope (user/project), layer (base/local), and config (the file holding a layer); code says `base`, never `shared`

### marketplace add

- [x] **ADD-01**: Adding a marketplace records it in the chosen scope under its manifest name (dir, file, url, gh)
- [x] **ADD-02**: Without `--scope`, add uses the user scope
- [x] **ADD-03**: An added marketplace appears in `marketplace list` and is still there in a new session (dir, url)
- [x] **ADD-04**: Adding a name the scope already holds fails as `duplicate name` (dir, url)
- [x] **ADD-05**: The same marketplace can be added to both scopes independently
- [x] **ADD-06**: A path that does not exist fails as `source missing`, named by the source as typed
- [x] **ADD-07**: A malformed or schema-invalid manifest fails as `invalid manifest` (dir, url)
- [x] **ADD-08**: Refused source forms (`http://`, `ssh://`, `git@host:...`, GitHub `/tree/` URLs, `https://github.com/o`, a bare word, `a/b/c`, `~other/...`) fail as `unsupported source`, and the stand-in receives no request
- [x] **ADD-09**: A url clone answered with 404 fails as `source missing`
- [x] **ADD-10**: A url clone answered with 5xx fails as `network error`, with a cause line that names the HTTP status and the fetched URL; one whose connection drops fails as `network unreachable`
- [x] **ADD-11**: A clone answered with 401 and no stored credential fails as `authentication required`; with a stored credential in the sandbox, it succeeds (url, gh)
- [x] **ADD-12**: A removed git marketplace can be added again from the same source (url, gh)
- [x] **ADD-13**: `add --local` writes the declaration to `claude-plugins.local.json`, and `remove --local` clears it
- [x] **ADD-14**: `add ~/...` keeps the `~` form and resolves it against HOME

### marketplace remove / rm

- [x] **RM-01**: Removing a marketplace with no installed plugins drops it, with no reload needed (dir, url)
- [x] **RM-02**: Removing a marketplace uninstalls every plugin installed from it, one `uninstalled` row each, and needs a reload
- [x] **RM-03**: After that cascade, a new session offers none of the plugin's skills and `plugin list` no longer lists it
- [x] **RM-04**: A removed marketplace stays removed in a new session
- [x] **RM-05**: Removing a name the requested scope lacks fails as `marketplace not added`, or `marketplace not added to <scope> scope` when the other scope holds it
- [x] **RM-06**: Removing a name neither scope holds, without `--scope`, fails as `marketplace not added` with no scope
- [x] **RM-07**: `rm` behaves as `remove`
- [x] **RM-08**: Without `--scope`, a name held by both scopes is removed from the project scope only
- [x] **RM-09**: Remove of a git marketplace makes no request to the stand-in

### marketplace list / ls

- [x] **LS-01**: With nothing added, the list is empty
- [x] **LS-02**: The list shows every marketplace of both scopes, project first, each with its autoupdate state and last-updated time
- [x] **LS-03**: `--scope` narrows the list to one scope
- [x] **LS-04**: `ls` behaves as `list`
- [x] **LS-05**: Listing git marketplaces makes no request to the stand-in

### marketplace info

- [x] **INFO-01**: Info on a dir or file marketplace shows its absolute path, autoupdate state, and description
- [x] **INFO-02**: Info on a url marketplace shows the identity URL and ref
- [x] **INFO-03**: Info on a GitHub marketplace shows owner, repo, and ref
- [x] **INFO-04**: A name both scopes hold, without `--scope`, shows one block per scope, project first
- [x] **INFO-05**: A name neither scope holds fails as `marketplace not added` with no scope
- [x] **INFO-06**: `--scope` naming the scope that misses, while the other holds the name, says which scope missed
- [x] **INFO-07**: Info on git marketplaces makes no request to the stand-in
- [x] **INFO-08**: Info on a marketplace whose manifest became invalid reports a failed `invalid manifest` row
- [x] **INFO-09**: Info shows the marketplaces a manifest allows cross-marketplace dependencies on

### marketplace update

- [x] **UPD-01**: Updating a marketplace whose manifest did not change skips it as `up-to-date` (dir, url, gh)
- [x] **UPD-02**: Updating a marketplace whose manifest changed reports it `updated`, with no plugin rows when autoupdate is off (dir, url, gh)
- [x] **UPD-03**: With autoupdate off, installed plugins keep their version after a marketplace update
- [x] **UPD-04**: With autoupdate on, the update moves installed plugins to the offered version, and a new session offers the new version
- [x] **UPD-05**: With autoupdate on and nothing changed, the marketplace is skipped as `up-to-date`
- [x] **UPD-06**: A plugin newly offered by the refreshed manifest is not installed
- [x] **UPD-07**: A bare `update` refreshes every marketplace of both scopes, one result per marketplace, project first
- [x] **UPD-08**: A bare `update` with nothing added reports no marketplaces
- [x] **UPD-09**: Updating a name the scope lacks fails as `marketplace not added`, with and without `--scope`
- [x] **UPD-10**: A path marketplace whose manifest became invalid fails with an `invalid manifest` row
- [x] **UPD-11**: A git marketplace whose host answers 5xx or 404 fails as `network error`, with a cause line that names the HTTP status and the fetched URL; one whose connection drops fails as `network unreachable`
- [x] **UPD-12**: A git marketplace whose host now answers 401 fails as `authentication required`, with the cause line naming `git credential approve` for that host (url, gh)
- [x] **UPD-13**: With autoupdate on, an installed plugin the refreshed manifest dropped is skipped as `not in manifest`, with warning severity
- [x] **UPD-14**: A path marketplace whose directory vanished fails as `source missing`

### marketplace autoupdate / noautoupdate

- [x] **AU-01**: `autoupdate` turns autoupdate on for a marketplace
- [x] **AU-02**: `autoupdate` on a marketplace already on is skipped as `already autoupdate`
- [x] **AU-03**: A newly added marketplace has autoupdate off, so `noautoupdate` is skipped as `already no autoupdate` (dir, url, gh)
- [x] **AU-04**: `noautoupdate` turns autoupdate off
- [x] **AU-05**: The setting shows in `list` and `info` and survives a new session
- [x] **AU-06**: Without a name, the change applies to every marketplace of both scopes
- [x] **AU-07**: Without a name and with nothing added, the result is empty
- [x] **AU-08**: A name neither scope holds fails as `marketplace not added`
- [x] **AU-09**: Without `--scope`, `autoupdate <name>` for a name both scopes hold changes both (pins today's behavior)

### Help and usage errors

- [x] **USE-01**: `marketplace help` and `help marketplace` show the marketplace usage
- [x] **USE-02**: `marketplace` with no subcommand, or an unknown one, shows the usage with a reason
- [x] **USE-03**: `add`, `remove`, and `info` without their argument fail as `Missing required argument.`
- [x] **USE-04**: Surplus arguments are rejected
- [x] **USE-05**: Unknown flags are rejected, including `--local` on `list`, `info`, and `update`
- [x] **USE-06**: A bad or missing `--scope` value is rejected in any position
- [x] **USE-07**: An explicitly empty optional argument (`update ""`, `autoupdate ""`) is rejected
- [x] **USE-08**: `marketplace help` with an argument is rejected

### Source forms

- [x] **SRC-01**: A url source is cloned at exactly the URL typed; `.git` is not appended
- [x] **SRC-02**: GitHub spellings (`GitHub.com`, `www.github.com`, a `.git` suffix, a trailing slash) resolve to one source
- [x] **SRC-03**: `owner/repo@ref` and `owner/repo#ref` clone that ref

## Future Requirements

- **MKTPAR-01** (BACKLOG): reserved official marketplace names, hosted `marketplace.json` URLs, and the `/plugin market` alias, for parity with Claude Code.
- A credential hint (`git credential approve`) on `add` after a 401, as `update` already shows (GAUTH-04).
- The doc-versus-code conflicts C-1 to C-13 in `.planning/research/FEATURES.md`: the suite pins the code; the docs get fixed separately.

## Out of Scope

| Feature | Reason |
|---------|--------|
| Plugin install, uninstall, update, reinstall flows | Covered by `features/plugin/`; used here only where marketplace remove and update cascade onto installed plugins |
| Live network, real github.com, Device Flow | Every external service has a loopback stand-in; scenarios never reach the network |
| Assertions on `state.json` or clone directories | Internal state; scenarios observe results, `list`/`info`, user-owned config files, and the request log |
| Lock-held and permission-denied paths | Not reproducible without platform tricks; covered by unit tests |
| Text-renderer bytes | The suite reads JSON payloads; text output is locked by `docs/output-catalog.md` tests |
| `/claude:plugin bootstrap` | Adds the real official marketplace from github.com |
| Changing `autoupdate <name>` scope behavior | AU-09 pins it; whether it is intended is an open question |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| DRV-01 | Phase 1 | Complete |
| DRV-02 | Phase 1 | Complete |
| DRV-03 | Phase 9 | Complete |
| DRV-04 | Phase 1 | Complete |
| HOST-01 | Phase 9 | Complete |
| HOST-02 | Phase 9 | Complete |
| HOST-03 | Phase 9 | Complete |
| HOST-04 | Phase 9 | Complete |
| GHB-01 | Phase 2 | Complete |
| GHB-02 | Phase 2 | Complete |
| GHB-03 | Phase 2 | Complete |
| GHB-04 | Phase 2 | Complete |
| GHB-05 | Phase 2 | Complete |
| FIX-01 | Phase 6 | Complete |
| FIX-02 | Phase 3.1 | Complete |
| FIX-03 | Phase 3.1 | Complete |
| LAYER-01 | Phase 3.2 | Complete |
| LAYER-02 | Phase 3.2 | Complete |
| LAYER-03 | Phase 3.2 | Complete |
| LAYER-04 | Phase 3.3 | Complete |
| LAYER-05 | Phase 3.3 | Complete |
| LAYER-06 | Phase 3.3 | Complete |
| LAYER-07 | Phase 3.2 | Complete |
| LAYER-08 | Phase 3.3 | Complete |
| LAYER-09 | Phase 3.3 | Complete |
| TERM-01 | Phase 3.4 | Complete |
| ADD-01 | Phase 3 | Complete |
| ADD-02 | Phase 3 | Complete |
| ADD-03 | Phase 3 | Complete |
| ADD-04 | Phase 3 | Complete |
| ADD-05 | Phase 3 | Complete |
| ADD-06 | Phase 3 | Complete |
| ADD-07 | Phase 3 | Complete |
| ADD-08 | Phase 9 | Complete |
| ADD-09 | Phase 9 | Complete |
| ADD-10 | Phase 9 | Complete |
| ADD-11 | Phase 10 | Complete |
| ADD-12 | Phase 9 | Complete |
| ADD-13 | Phase 3 | Complete |
| ADD-14 | Phase 3 | Complete |
| RM-01 | Phase 4 | Complete |
| RM-02 | Phase 4 | Complete |
| RM-03 | Phase 4 | Complete |
| RM-04 | Phase 4 | Complete |
| RM-05 | Phase 4 | Complete |
| RM-06 | Phase 4 | Complete |
| RM-07 | Phase 4 | Complete |
| RM-08 | Phase 4 | Complete |
| RM-09 | Phase 9 | Complete |
| LS-01 | Phase 4 | Complete |
| LS-02 | Phase 4 | Complete |
| LS-03 | Phase 4 | Complete |
| LS-04 | Phase 4 | Complete |
| LS-05 | Phase 9 | Complete |
| INFO-01 | Phase 5 | Complete |
| INFO-02 | Phase 5 | Complete |
| INFO-03 | Phase 5 | Complete |
| INFO-04 | Phase 5 | Complete |
| INFO-05 | Phase 5 | Complete |
| INFO-06 | Phase 5 | Complete |
| INFO-07 | Phase 9 | Complete |
| INFO-08 | Phase 5 | Complete |
| INFO-09 | Phase 5 | Complete |
| UPD-01 | Phase 6 | Complete |
| UPD-02 | Phase 6 | Complete |
| UPD-03 | Phase 6 | Complete |
| UPD-04 | Phase 6 | Complete |
| UPD-05 | Phase 6 | Complete |
| UPD-06 | Phase 6 | Complete |
| UPD-07 | Phase 6 | Complete |
| UPD-08 | Phase 6 | Complete |
| UPD-09 | Phase 6 | Complete |
| UPD-10 | Phase 6 | Complete |
| UPD-11 | Phase 9 | Complete |
| UPD-12 | Phase 10 | Complete |
| UPD-13 | Phase 6 | Complete |
| UPD-14 | Phase 6 | Complete |
| AU-01 | Phase 7 | Complete |
| AU-02 | Phase 7 | Complete |
| AU-03 | Phase 7 | Complete |
| AU-04 | Phase 7 | Complete |
| AU-05 | Phase 7 | Complete |
| AU-06 | Phase 7 | Complete |
| AU-07 | Phase 7 | Complete |
| AU-08 | Phase 7 | Complete |
| AU-09 | Phase 7 | Complete |
| USE-01 | Phase 8 | Complete |
| USE-02 | Phase 8 | Complete |
| USE-03 | Phase 8 | Complete |
| USE-04 | Phase 8 | Complete |
| USE-05 | Phase 8 | Complete |
| USE-06 | Phase 8 | Complete |
| USE-07 | Phase 8 | Complete |
| USE-08 | Phase 8 | Complete |
| SRC-01 | Phase 9 | Complete |
| SRC-02 | Phase 10 | Complete |
| SRC-03 | Phase 10 | Complete |

**Coverage:**
- v1 requirements: 97 total
- Mapped to phases: 97
- Unmapped: 0

---
*Requirements defined: 2026-10-15*
*Last updated: 2026-10-16 after inserting Phase 3.1 (FIX-02)*
