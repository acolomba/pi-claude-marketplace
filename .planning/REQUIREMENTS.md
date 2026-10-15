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

- [ ] **DRV-01**: The driver returns every payload a command emits, validates each against the published notification schema, and asserts the expected kinds and count (`cascade`, `marketplace-info`, `marketplace-info-cascade`, `marketplace-not-added`, `usage-error`, `usage-info`, `plugin-info`; one payload per marketplace from a bare `update`)
- [ ] **DRV-02**: Run-specific values (sandbox paths, the stand-in origin) are written in scenarios as exact tokens substituted in both directions, and `lastUpdatedAt` is checked within a time window, never hidden
- [ ] **DRV-03**: Pi, the stand-in, and every fixture `git` run with a hermetic git environment (`GIT_CONFIG_NOSYSTEM=1`, a sandbox global config, no inherited `GIT_*`), so no scenario reads the developer's credential helpers or git config
- [ ] **DRV-04**: A gate fails when a step definition is unused, undefined, or ambiguous (`cucumber-js --dry-run --format usage`)

### HTTPS git stand-in

- [ ] **HOST-01**: A loopback HTTPS git server (a `node:https` CGI wrapper around `git http-backend`, run-time openssl certificate trusted through `NODE_EXTRA_CA_CERTS`) serves bare marketplace repositories that isomorphic-git inside Pi can clone and fetch
- [ ] **HOST-02**: The stand-in lives for the worker's run alongside Pi and is reset before every scenario (repositories, arming, request log, CGI children), with the reset asserted empty; the cucumber skill rule is amended to allow it
- [ ] **HOST-03**: A scenario can arm a repository to answer 401, 404, or 5xx, or to drop the connection
- [ ] **HOST-04**: The stand-in records every request, and scenarios can assert the exact request log, including that it is empty

### GitHub clone-base override (D-MF-01)

- [ ] **GHB-01**: With `PI_CLAUDE_MARKETPLACE_GITHUB_BASE_URL` set, GitHub sources (`owner/repo`, `https://github.com/o/r[.git][#ref]`) clone from `<base>/<owner>/<repo>.git`
- [ ] **GHB-02**: The override reaches every GitHub site through one seam: origin matching for leftover clones, marketplace update, and the auth host (bound to the override host, so Device Flow never runs against it); a source-walk gate fails on a new hard-coded `github.com` URL outside the seam
- [ ] **GHB-03**: A set but invalid override (not `https:`, carries userinfo, a query, or a fragment) fails with a typed error that names the variable
- [ ] **GHB-04**: With the override unset, behavior is byte-identical to today, and `list`, `info`, and `claude-plugins.json` show GitHub sources in github.com terms either way
- [ ] **GHB-05**: The override is documented (README and CHANGELOG) as a divergence from Claude Code

### Defect fix

- [ ] **FIX-01**: `marketplace update` of a marketplace added from a `marketplace.json` outside `.claude-plugin/` re-reads the manifest the user added instead of failing as `source missing`, and `info` shows the right path (C-10)

### marketplace add

- [ ] **ADD-01**: Adding a marketplace records it in the chosen scope under its manifest name (dir, file, url, gh)
- [ ] **ADD-02**: Without `--scope`, add uses the user scope
- [ ] **ADD-03**: An added marketplace appears in `marketplace list` and is still there in a new session (dir, url)
- [ ] **ADD-04**: Adding a name the scope already holds fails as `duplicate name` (dir, url)
- [ ] **ADD-05**: The same marketplace can be added to both scopes independently
- [ ] **ADD-06**: A path that does not exist fails as `source missing`, named by the source as typed
- [ ] **ADD-07**: A malformed or schema-invalid manifest fails as `invalid manifest` (dir, url)
- [ ] **ADD-08**: Refused source forms (`http://`, `ssh://`, `git@host:...`, GitHub `/tree/` URLs, `https://github.com/o`, a bare word, `a/b/c`, `~other/...`) fail as `unsupported source`, and the stand-in receives no request
- [ ] **ADD-09**: A url clone answered with 404 fails as `source missing`
- [ ] **ADD-10**: A url clone answered with 5xx, or whose connection drops, fails as `network unreachable`
- [ ] **ADD-11**: A clone answered with 401 and no stored credential fails as `authentication required`; with a stored credential in the sandbox, it succeeds (url, gh)
- [ ] **ADD-12**: A removed git marketplace can be added again from the same source (url, gh)
- [ ] **ADD-13**: `add --local` writes the declaration to `claude-plugins.local.json`, and `remove --local` clears it
- [ ] **ADD-14**: `add ~/...` keeps the `~` form and resolves it against HOME

### marketplace remove / rm

- [ ] **RM-01**: Removing a marketplace with no installed plugins drops it, with no reload needed (dir, url)
- [ ] **RM-02**: Removing a marketplace uninstalls every plugin installed from it, one `uninstalled` row each, and needs a reload
- [ ] **RM-03**: After that cascade, a new session offers none of the plugin's skills and `plugin list` no longer lists it
- [ ] **RM-04**: A removed marketplace stays removed in a new session
- [ ] **RM-05**: Removing a name the requested scope lacks fails as `marketplace not added`, or `marketplace not added to <scope> scope` when the other scope holds it
- [ ] **RM-06**: Removing a name neither scope holds, without `--scope`, fails as `marketplace not added` with no scope
- [ ] **RM-07**: `rm` behaves as `remove`
- [ ] **RM-08**: Without `--scope`, a name held by both scopes is removed from the project scope only
- [ ] **RM-09**: Remove of a git marketplace makes no request to the stand-in

### marketplace list / ls

- [ ] **LS-01**: With nothing added, the list is empty
- [ ] **LS-02**: The list shows every marketplace of both scopes, project first, each with its autoupdate state and last-updated time
- [ ] **LS-03**: `--scope` narrows the list to one scope
- [ ] **LS-04**: `ls` behaves as `list`
- [ ] **LS-05**: Listing git marketplaces makes no request to the stand-in

### marketplace info

- [ ] **INFO-01**: Info on a dir or file marketplace shows its absolute path, autoupdate state, and description
- [ ] **INFO-02**: Info on a url marketplace shows the identity URL and ref
- [ ] **INFO-03**: Info on a GitHub marketplace shows owner, repo, and ref
- [ ] **INFO-04**: A name both scopes hold, without `--scope`, shows one block per scope, project first
- [ ] **INFO-05**: A name neither scope holds fails as `marketplace not added` with no scope
- [ ] **INFO-06**: `--scope` naming the scope that misses, while the other holds the name, says which scope missed
- [ ] **INFO-07**: Info on git marketplaces makes no request to the stand-in
- [ ] **INFO-08**: Info on a marketplace whose manifest became invalid reports a failed `invalid manifest` row
- [ ] **INFO-09**: Info shows the marketplaces a manifest allows cross-marketplace dependencies on

### marketplace update

- [ ] **UPD-01**: Updating a marketplace whose manifest did not change skips it as `up-to-date` (dir, url, gh)
- [ ] **UPD-02**: Updating a marketplace whose manifest changed reports it `updated`, with no plugin rows when autoupdate is off (dir, url, gh)
- [ ] **UPD-03**: With autoupdate off, installed plugins keep their version after a marketplace update
- [ ] **UPD-04**: With autoupdate on, the update moves installed plugins to the offered version, and a new session offers the new version
- [ ] **UPD-05**: With autoupdate on and nothing changed, the marketplace is skipped as `up-to-date`
- [ ] **UPD-06**: A plugin newly offered by the refreshed manifest is not installed
- [ ] **UPD-07**: A bare `update` refreshes every marketplace of both scopes, one result per marketplace, project first
- [ ] **UPD-08**: A bare `update` with nothing added reports no marketplaces
- [ ] **UPD-09**: Updating a name the scope lacks fails as `marketplace not added`, with and without `--scope`
- [ ] **UPD-10**: A path marketplace whose manifest became invalid fails with an `invalid manifest` row
- [ ] **UPD-11**: A git marketplace whose host answers 5xx, 404, or drops the connection fails as `network unreachable`
- [ ] **UPD-12**: A git marketplace whose host now answers 401 fails as `authentication required`, with the cause line naming `git credential approve` for that host (url, gh)
- [ ] **UPD-13**: With autoupdate on, an installed plugin the refreshed manifest dropped is skipped as `not in manifest`, with warning severity
- [ ] **UPD-14**: A path marketplace whose directory vanished fails as `source missing`

### marketplace autoupdate / noautoupdate

- [ ] **AU-01**: `autoupdate` turns autoupdate on for a marketplace
- [ ] **AU-02**: `autoupdate` on a marketplace already on is skipped as `already autoupdate`
- [ ] **AU-03**: A newly added marketplace has autoupdate off, so `noautoupdate` is skipped as `already no autoupdate` (dir, url, gh)
- [ ] **AU-04**: `noautoupdate` turns autoupdate off
- [ ] **AU-05**: The setting shows in `list` and `info` and survives a new session
- [ ] **AU-06**: Without a name, the change applies to every marketplace of both scopes
- [ ] **AU-07**: Without a name and with nothing added, the result is empty
- [ ] **AU-08**: A name neither scope holds fails as `marketplace not added`
- [ ] **AU-09**: Without `--scope`, `autoupdate <name>` for a name both scopes hold changes both (pins today's behavior)

### Help and usage errors

- [ ] **USE-01**: `marketplace help` and `help marketplace` show the marketplace usage
- [ ] **USE-02**: `marketplace` with no subcommand, or an unknown one, shows the usage with a reason
- [ ] **USE-03**: `add`, `remove`, and `info` without their argument fail as `Missing required argument.`
- [ ] **USE-04**: Surplus arguments are rejected
- [ ] **USE-05**: Unknown flags are rejected, including `--local` on `list`, `info`, and `update`
- [ ] **USE-06**: A bad or missing `--scope` value is rejected in any position
- [ ] **USE-07**: An explicitly empty optional argument (`update ""`, `autoupdate ""`) is rejected
- [ ] **USE-08**: `marketplace help` with an argument is rejected

### Source forms

- [ ] **SRC-01**: A url source is cloned at exactly the URL typed; `.git` is not appended
- [ ] **SRC-02**: GitHub spellings (`GitHub.com`, `www.github.com`, a `.git` suffix, a trailing slash) resolve to one source
- [ ] **SRC-03**: `owner/repo@ref` and `owner/repo#ref` clone that ref

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
| DRV-01 | Phase 1 | Pending |
| DRV-02 | Phase 1 | Pending |
| DRV-03 | Phase 9 | Pending |
| DRV-04 | Phase 1 | Pending |
| HOST-01 | Phase 9 | Pending |
| HOST-02 | Phase 9 | Pending |
| HOST-03 | Phase 9 | Pending |
| HOST-04 | Phase 9 | Pending |
| GHB-01 | Phase 2 | Pending |
| GHB-02 | Phase 2 | Pending |
| GHB-03 | Phase 2 | Pending |
| GHB-04 | Phase 2 | Pending |
| GHB-05 | Phase 2 | Pending |
| FIX-01 | Phase 6 | Pending |
| ADD-01 | Phase 3 | Pending |
| ADD-02 | Phase 3 | Pending |
| ADD-03 | Phase 3 | Pending |
| ADD-04 | Phase 3 | Pending |
| ADD-05 | Phase 3 | Pending |
| ADD-06 | Phase 3 | Pending |
| ADD-07 | Phase 3 | Pending |
| ADD-08 | Phase 9 | Pending |
| ADD-09 | Phase 9 | Pending |
| ADD-10 | Phase 9 | Pending |
| ADD-11 | Phase 10 | Pending |
| ADD-12 | Phase 9 | Pending |
| ADD-13 | Phase 3 | Pending |
| ADD-14 | Phase 3 | Pending |
| RM-01 | Phase 4 | Pending |
| RM-02 | Phase 4 | Pending |
| RM-03 | Phase 4 | Pending |
| RM-04 | Phase 4 | Pending |
| RM-05 | Phase 4 | Pending |
| RM-06 | Phase 4 | Pending |
| RM-07 | Phase 4 | Pending |
| RM-08 | Phase 4 | Pending |
| RM-09 | Phase 9 | Pending |
| LS-01 | Phase 4 | Pending |
| LS-02 | Phase 4 | Pending |
| LS-03 | Phase 4 | Pending |
| LS-04 | Phase 4 | Pending |
| LS-05 | Phase 9 | Pending |
| INFO-01 | Phase 5 | Pending |
| INFO-02 | Phase 5 | Pending |
| INFO-03 | Phase 5 | Pending |
| INFO-04 | Phase 5 | Pending |
| INFO-05 | Phase 5 | Pending |
| INFO-06 | Phase 5 | Pending |
| INFO-07 | Phase 9 | Pending |
| INFO-08 | Phase 5 | Pending |
| INFO-09 | Phase 5 | Pending |
| UPD-01 | Phase 6 | Pending |
| UPD-02 | Phase 6 | Pending |
| UPD-03 | Phase 6 | Pending |
| UPD-04 | Phase 6 | Pending |
| UPD-05 | Phase 6 | Pending |
| UPD-06 | Phase 6 | Pending |
| UPD-07 | Phase 6 | Pending |
| UPD-08 | Phase 6 | Pending |
| UPD-09 | Phase 6 | Pending |
| UPD-10 | Phase 6 | Pending |
| UPD-11 | Phase 9 | Pending |
| UPD-12 | Phase 10 | Pending |
| UPD-13 | Phase 6 | Pending |
| UPD-14 | Phase 6 | Pending |
| AU-01 | Phase 7 | Pending |
| AU-02 | Phase 7 | Pending |
| AU-03 | Phase 7 | Pending |
| AU-04 | Phase 7 | Pending |
| AU-05 | Phase 7 | Pending |
| AU-06 | Phase 7 | Pending |
| AU-07 | Phase 7 | Pending |
| AU-08 | Phase 7 | Pending |
| AU-09 | Phase 7 | Pending |
| USE-01 | Phase 8 | Pending |
| USE-02 | Phase 8 | Pending |
| USE-03 | Phase 8 | Pending |
| USE-04 | Phase 8 | Pending |
| USE-05 | Phase 8 | Pending |
| USE-06 | Phase 8 | Pending |
| USE-07 | Phase 8 | Pending |
| USE-08 | Phase 8 | Pending |
| SRC-01 | Phase 9 | Pending |
| SRC-02 | Phase 10 | Pending |
| SRC-03 | Phase 10 | Pending |

**Coverage:**
- v1 requirements: 85 total
- Mapped to phases: 85
- Unmapped: 0

---
*Requirements defined: 2026-10-15*
*Last updated: 2026-10-15 after roadmap revision for parallel waves (10 phases)*
