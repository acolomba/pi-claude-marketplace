# Roadmap: pi-claude-marketplace

## Milestones

- **mcp-4 (MCP 4)** — in progress, started 2026-10-01 on `features/mcp-4`; Phases 1-7. Pi 1.0 becomes the floor, and plugin MCP servers move into pi-mcp-adapter 5's own `mcp-adapter.json` with Claude Code tool names, tool search, variable expansion and live status.
- **any-git-host** — completed 2026-09-30, merged to main 2026-09-30 (PR #221); [archive](milestones/ws-git-hosts-2026-10-01/milestones/any-git-host-ROADMAP.md).
- **v1.20 transitive-dependencies** — completed 2026-09-24, merged to main 2026-10-01 (PR #198); 12 phases, 55 plans, 45/45 requirements. [Archive](milestones/v1.20-ROADMAP.md), [requirements](milestones/v1.20-REQUIREMENTS.md), [audit](milestones/v1.20-MILESTONE-AUDIT.md). The private-repository credential challenge deferred at closeout passed on 2026-09-30.
- **workflows-replay** — completed 2026-09-21, merged to main 2026-09-24 (PR #205); [archive](milestones/ws-workflows-2026-09-27/milestones/workflows-replay-ROADMAP.md).
- **test-backlog** — shipped 2026-09-18; [archive](milestones/test-backlog-ROADMAP.md).
- **refine-unit-tests** — shipped 2026-09-13; [archive](milestones/refine-unit-tests-ROADMAP.md).
- **v1.19 Unit Test Refactor** — shipped 2026-09-04; [archive](milestones/v1.19-ROADMAP.md).

Earlier milestones remain in [MILESTONES.md](MILESTONES.md).

## Phases

### In progress mcp-4 — MCP 4

**Milestone goal:** Make Pi 1.0 the baseline and deliver plugin MCP servers through
pi-mcp-adapter 5's own `mcp-adapter.json`, with Claude Code tool names, tool search, variable
expansion and live status, without adopting Pi's built-in MCP.

**Phase numbering:** this milestone restarts the counter at 1. Phases of earlier milestones live
under `.planning/milestones/`; inside this section a bare phase number means an mcp-4 phase.
Decimal phases (2.1, 3.1) are urgent insertions only, marked INSERTED.

- [x] **Phase 1: Pi 1.0 floor and adapter-only detection** - Pi 1.0, pi-subagents 0.74.0 and pi-mcp-adapter 5.0.0 become the floors, every devDependency except TypeScript moves to its latest release, the features/mcp Pi 0.99 fixes are re-implemented at 1.0, both live canaries pass on Pi 1.0, and only pi-mcp-adapter itself (never Pi's built-in MCP) satisfies the MCP soft dependency. (completed 2026-10-02)
- [x] **Phase 2: Adapter-file delivery** - install, update, reinstall and uninstall keep plugin MCP servers as marked entries in `<scopeRoot>/mcp-adapter.json`: read as JSONC the way the adapter reads it, refused rather than replaced when unparseable, written under the legacy `mcp-servers` key when the user's file uses it, checked for collisions in adapter 5's nine-source order, and carrying user overrides through updates. Entry content keeps today's shape in this phase. (completed 2026-10-06)
- [ ] **Phase 3: Claude Code tool names and tool search** - plugin MCP tools reach the model as `mcp__plugin_<plugin>_<server>__<tool>` through the key `plugin_<plugin>_<server>_` and a pinned `toolPrefix: "mcp"`, load on demand through Pi's tool search, and carry the manifest description and translated transport options. Starts with a measurement of the tool-name length Pi 1.0 accepts.
- [ ] **Phase 4: Variable expansion at Claude Code parity** - plugin and project path variables and `${VAR:-default}` expand at install time by Claude's rules, plain `${VAR}` is left for the adapter at runtime, the adapter's second expansion is escaped or warned about, and Claude's credential deny-list holds for `url` and `headers`. Needs a threat model.
- [ ] **Phase 5: Automatic migration on /reload** - `/reload` moves each installed plugin's marked entries from `mcp.json` into `mcp-adapter.json` in their final shape, adding before removing, idempotently, with one notice that lists the renames and what they cost the user.
- [ ] **Phase 6: Live MCP status in info** - `/claude:plugin info` shows each plugin MCP server's state from the adapter's status events, and an explicit unknown state when there is nothing to show.
- [ ] **Phase 7: Docs and live proof** - README and docs describe the new delivery and its divergences, a live UAT against a real adapter 5 proves the whole path, and the CHANGELOG records the milestone.

**Release rule.** Phases 2 to 5 go out in one release. Every change to the entry shape (name,
`directTools`, escaping) invalidates the adapter's per-server state: OAuth sign-ins, project
approvals, `/mcp-adapter disable` overrides and pi-subagents `mcp:<server>` overrides are keyed by
server name or definition hash. So the migration (Phase 5) comes after every entry-shape
requirement (Phases 3 and 4), and no release may sit between the first write to
`mcp-adapter.json` and the migration that moves users' existing entries.

**Settled going in.** Operator decisions; planning should not reopen them.

1. **Delivery target.** Entries go into `<scopeRoot>/mcp-adapter.json`. No writes in Pi's
   `mcp.json` format, no dual writes, no `pi.registerMcpServer()`. Pi's built-in MCP is out of
   scope, including as a soft-dependency fallback.
2. **Naming.** The server key is `plugin_<plugin>_<server>_` (trailing underscore) with
   `toolPrefix: "mcp"` pinned on the entry, which yields Claude Code's exact tool names with no
   translation layer. The cost is a trailing `_` on every adapter surface and reliance on the
   adapter's tool-name joining rule. An upstream `__` separator mode is a future request.
3. **Lifecycle.** Entries leave `lifecycle` unset, so the adapter's `lazy` default applies. No
   `keep-alive`.
4. **Variables.** `${VAR:-default}` resolves at install time; plain `${VAR}` stays for the
   adapter at runtime. Resolving every variable at install time is rejected because it writes
   secrets to disk.
5. **Dependencies.** pi-mcp-adapter is an optional peer `>=5.0.0`, never a devDependency; its
   `pi-ai` peer gap at Pi 1.0 is recorded as an upstream issue, not worked around.
   `engines.node` rises to the real floor. TypeScript stays at `^6.0.3`.
6. **JSONC comments.** Warn once when a rewrite drops them. No comment-preserving editor, so no
   new runtime dependency.
7. **Migration.** One notice announces it. A marked legacy entry with no owning install record
   stays where it is, with a warning.
8. **Containment.** The adapter's cache, keyring and approval files are never touched; they are
   outside the NFR-10 write set.

**Open decisions.** Each names the discuss session that must settle it.

1. **Phase 1 discuss:** which features/mcp review findings to port (IN-03, IN-04, IN-05 and the
   open Stop-canary findings), and where the features/mcp spike directory goes when `4f82096f` is
   re-run.
2. **Phase 2 discuss (settled):** the closed carry-forward field set (D-02-06); no sibling
   `.bak` (D-02-05); a symlinked config file keeps write-through, with no real-path
   containment check (D-02-16).
3. **Phase 3 discuss:** warn or refuse for a name past the measured length limit.
4. **Phase 4 discuss:** how user-scope `${CLAUDE_PROJECT_DIR}` is handled, since the adapter
   expands a leftover literal to an empty string.
5. **Phase 5 discuss:** whether the move re-stages from the cached plugin source (offline,
   NFR-5-safe) or transforms entries in place, with a verbatim move only when the clone is gone.
6. **Phase 7 discuss:** whether per-tool `_meta["anthropic/alwaysLoad"]` and project-trust
   re-prompts are documented only.

## Phase Details

### Phase 1: Pi 1.0 floor and adapter-only detection

**Goal**: A user on Pi 1.0 can install the extension and every existing feature still works there. A plugin's MCP component reports pi-mcp-adapter as missing unless the adapter itself is loaded, even when Pi's built-in MCP is active.

**Depends on**: Nothing (first phase)

**Requirements**: PIFL-01, PIFL-02, PIFL-03, PIFL-04, PIFL-05, PIFL-06, PIFL-07, ADET-01, ADET-02

**Success Criteria** (what must be TRUE):

1. A user on Pi 1.0 can install the extension: the peer floor is `>=1.0.0`, dev dependencies are `^1.0.0` for pi-coding-agent and pi-tui, and the FLOOR-01 gate pins the new literal. `npm run check` passes with the features/mcp typing and peer-test fixes (`74162ca6`, `5b1d8ef6`, `dac3a245`, `69e0870a`) re-implemented at 1.0 and the `types.d.ts` contract pins re-derived from the installed Pi 1.0 types. (PIFL-01, PIFL-04)
2. Every devDependency is at its latest release except TypeScript, held at `^6.0.3`. The new `no-unsafe-enum-assignment` finding is fixed in code, not disabled, and the fallow action SHA in `lint.yml` matches the bumped fallow. `engines.node` names the floor that Pi 1.0 and `write-file-atomic@8` actually require, and NFR-4 says the same in AGENTS.md and PROJECT.md. (PIFL-05, PIFL-06)
3. `package.json` declares pi-subagents `>=0.74.0` and pi-mcp-adapter `>=5.0.0` as optional peers, and the adapter is not a devDependency. Both pi-subagents peer integration tests run with zero skips against 0.74.0 through `PI_SUBAGENTS_ROOT`. The README states the adapter floor and names the adapter's `pi-ai` peer gap at Pi 1.0 as an upstream issue. (PIFL-02, PIFL-03)
4. The Stop canary (re-run from `4f82096f`, not cherry-picked) and the workflow-engine canary pass live on Pi 1.0 with `@quintinshaw/pi-dynamic-workflows` 3.13.1, and `scripts/pi.sh` pins adapter 5.0.0, pi-subagents 0.74.0 and engine 3.13.1. (PIFL-07)
5. With only Pi's built-in MCP active, install, list and info mark the plugin's MCP component as needing pi-mcp-adapter, and a built-in-only negative test proves it. An adapter that runs with `disableProxyTool`, or that was installed from a fork, is still detected as present through its `mcp-adapter` command. (ADET-01, ADET-02)

**Plans**: 9/9 plans complete in 6 waves

**Wave 1**
- [x] 01-01-PLAN.md

**Wave 2** *(blocked on Wave 1 completion)*
- [x] 01-02-PLAN.md
- [x] 01-03-PLAN.md

**Wave 3** *(blocked on Wave 2 completion)*
- [x] 01-04-PLAN.md

**Wave 4** *(blocked on Wave 3 completion)*
- [x] 01-05-PLAN.md

**Wave 5** *(blocked on Wave 4 completion)*
- [x] 01-06-PLAN.md
- [x] 01-07-PLAN.md

**Wave 6** *(blocked on Wave 5 completion)*
- [x] 01-08-PLAN.md
- [x] 01-09-PLAN.md

**Notes.** Mechanical work: research `STACK.md` carries the measured commands and a per-commit change table. Re-implement the features/mcp fixes rather than cherry-picking them, because the contract pins are line:col and break across merges, and the pi-subagents tests skip silently without `PI_SUBAGENTS_ROOT`. Detection lives in `platform/pi-api.ts` beside the pins this phase moves, so the pins move once.

### Phase 2: Adapter-file delivery

**Goal**: Install, update, reinstall and uninstall keep a plugin's MCP servers as marked entries in `<scopeRoot>/mcp-adapter.json`, and never lose or corrupt anything the user or the adapter wrote in that file.

**Depends on**: Phase 1

**Requirements**: AFILE-01, AFILE-02, AFILE-03, AFILE-04, AFILE-05, AFILE-06

**Success Criteria** (what must be TRUE):

1. Installing a plugin with MCP servers writes marked entries into `<Pi agent dir>/mcp-adapter.json` (user scope) or `<cwd>/.pi/mcp-adapter.json` (project scope), and uninstalling removes exactly those entries and nothing else. The NFR-10 write set, `persistence/locations.ts` and the containment gates name the new file. (AFILE-01)
2. Installing into a user's `mcp-adapter.json` that has comments, trailing commas or a BOM succeeds, and `settings`, `imports`, `claudePlugins` and the user's own servers are all still there afterwards. A file that cannot be parsed refuses the install with a typed error and keeps its exact bytes. When a rewrite drops the user's comments, the user is warned once. (AFILE-02, AFILE-04)
3. When the user's file keeps its servers under the legacy `mcp-servers` key, our entries go under that key and the user's servers keep loading. (AFILE-03)
4. A server name that another source defines in full (`command`, `url` or `socket`) is reported as a collision, naming the source that wins under adapter 5's nine-source, later-wins precedence. A partial entry, such as a `/mcp-adapter disable` stub, is an override and blocks neither install nor update. This closes MCPSRC-01. (AFILE-05)
5. A user override written into our entry (for example `disabled: true` from `/mcp-adapter disable`) is still there after `update` and `reinstall`. The carried-forward field set is closed, recorded under a decision ID, and pinned against the adapter's `ServerEntry`. (AFILE-06)

**Plans**: 12/12 plans complete in 12 waves (02-09 to 02-12 close the two verification gaps)

**Wave 1**
- [x] 02-01-PLAN.md — plugin MCP servers move to `mcp-adapter.json`, read as JSONC, refused when unparseable, `mcp-servers` honored (AFILE-01, AFILE-02, AFILE-03)

**Wave 2** *(blocked on Wave 1 completion)*
- [x] 02-02-PLAN.md — nine-source later-wins collision walk, same-plugin exemptions, legacy `mcp.json` sweep (AFILE-05)

**Wave 3** *(blocked on Wave 2 completion)*
- [x] 02-03-PLAN.md — user overrides carried through update and reinstall, stubs absorbed (AFILE-06)

**Wave 4** *(blocked on Wave 3 completion)*
- [x] 02-04-PLAN.md — comment and unreadable-file notices: seam, catalog, install routing, byte restore on failed install (AFILE-04)

**Wave 5** *(blocked on Wave 4 completion)*
- [x] 02-05-PLAN.md — notices on update and reinstall (AFILE-04)

**Wave 6** *(blocked on Wave 5 completion)*
- [x] 02-06-PLAN.md — notices on uninstall, prune and marketplace remove (AFILE-04)

**Wave 7** *(blocked on Wave 6 completion)*
- [x] 02-07-PLAN.md — notices on enable, disable and the cascade undos (AFILE-04)

**Wave 8** *(blocked on Wave 7 completion)*
- [x] 02-08-PLAN.md — notices through the reload, import and marketplace update cascades (AFILE-04)

**Wave 9** *(gap closure; blocked on Wave 8 completion)*
- [x] 02-09-PLAN.md — source comments and test titles cite NFR-3 and AFILE-04 instead of D-02-19 / D-02-20

**Wave 10** *(blocked on Wave 9 completion)*
- [x] 02-10-PLAN.md — a user's override under a plugin server name is kept in the entry's marker and written back on every unstage; proof that pi-mcp-adapter 5.0.0 ignores the marker (AFILE-06, AFILE-01, D-02-21)

**Wave 11** *(blocked on Wave 10 completion)*
- [x] 02-11-PLAN.md — install warns once, naming the override fields that stop applying; a write-back in the same command cancels the warning (AFILE-06, D-02-21)

**Wave 12** *(blocked on Wave 11 completion)*
- [x] 02-12-PLAN.md — the cross-scope lifecycle, prune rollback, the cascade primitive, disable/enable and the commented uninstall keep the override (AFILE-01, AFILE-05, AFILE-06)

**Notes.** This is the highest-risk core, and it lands before entry content changes so a failure points at file handling, not at translation. Entries keep today's content shape here; Phases 3 and 4 change it. Extract the JSONC document reader and the entry translator into their own modules up front: `bridges/mcp/stage.ts` already sits near the fallow `maxUnitSize` and cognitive-complexity ceilings. Research flags: the carry-forward field list and the comment-handling details.

### Phase 3: Claude Code tool names and tool search

**Goal**: A plugin's MCP tools reach the model under the exact names Claude Code gives them, load on demand through Pi's tool search, and carry the manifest's description and transport options into the adapter entry.

**Depends on**: Phase 2

**Requirements**: ANAME-01, ANAME-02, ANAME-03, ANAME-04, ANAME-05, ANAME-06, ANAME-07

**Success Criteria** (what must be TRUE):

1. After install and `/reload`, the model sees a plugin server's tools as `mcp__plugin_<plugin>_<server>__<tool>`. The entry key is `plugin_<plugin>_<server>_`, with every character outside `[A-Za-z0-9_-]` replaced by `_`, and the entry pins `toolPrefix: "mcp"`, so a user's global `toolPrefix` setting cannot change the names. One name builder in `domain/` produces every generated server name. (ANAME-01)
2. A plugin's hook matcher, `if:` predicate or agent `tools:` entry that names the plugin's own MCP tools in Claude form matches the delivered tools. (ANAME-02)
3. The tool-name length Pi 1.0 accepts is measured with a long fixture before this phase is planned. Install refuses, with a clear reason and before any write, when two servers' normalized keys collide (including `-`/`_` folding). The measurement found no Pi limit (providers cap names at 64 or 128 characters), so no length check exists. (ANAME-03; amended by D-03-12, D-03-13, D-03-17)
4. Plugin MCP tools load on demand: entries carry `directTools: "search"` and the tools are found through Pi's tool search, while a server marked `alwaysLoad` gets `directTools: true`. Entries leave `lifecycle` unset, so the adapter's `lazy` default applies, and the divergence from Claude Code's session-long connection is documented. (ANAME-04, ANAME-05)
5. Each entry carries the server `description` from the plugin manifest. `sse` becomes `httpTransport`, and the request timeout and OAuth callback port are translated. A server that uses a Claude feature the adapter cannot honor (`ws`, `headersHelper`, ...) makes the plugin partially available with `{unsupported mcp}`: a normal install refuses with the `--partial` hint, `--partial` installs it without the affected servers, and `info` names each server and feature. (ANAME-06, ANAME-07; amended by D-03-10)

**Plans**: 1/9 plans executed in 5 waves

**Wave 1**
- [x] 03-01-PLAN.md — entries under the Claude Code key `plugin_<plugin>_<server>_` with `toolPrefix: "mcp"` and `directTools`; records keep declared names (ANAME-01, ANAME-04)
- [ ] 03-02-PLAN.md — hook matchers `mcp__<server>__.*` match delivered tools; literal and `if:` forms proven (ANAME-02)

**Wave 2** *(blocked on Wave 1 completion)*
- [ ] 03-03-PLAN.md — closed Claude-to-adapter translation table, OAuth and timeout rules, manifest `description` (ANAME-04, ANAME-05, ANAME-06, ANAME-07)

**Wave 3** *(blocked on Wave 2 completion)*
- [ ] 03-04-PLAN.md — unhonored MCP features give `{unsupported mcp}` and a partial install; invalid configs give `{malformed mcp}`; no length check (ANAME-03, ANAME-07)
- [ ] 03-05-PLAN.md — same-plugin and `-`/`_`-folded key collisions refused before any write (ANAME-03)

**Wave 4** *(blocked on Wave 3 completion)*
- [ ] 03-06-PLAN.md — `info` shows `plugin:<plugin>:<server>` and names each left-out server with its feature (ANAME-01, ANAME-07)
- [ ] 03-07-PLAN.md — agent `tools:` / `disallowedTools:` map Claude MCP names to pi-subagents `mcp:` entries, with the `async: true` warning (ANAME-02)

**Wave 5** *(blocked on Wave 4 completion)*
- [ ] 03-08-PLAN.md — a plugin-set timeout belongs to the plugin; write-back restores the user's own stub value (ANAME-07)
- [ ] 03-09-PLAN.md — `docs/mcp-compatibility.md` and README: naming, tool search, length measurement, lifecycle and other divergences (ANAME-03, ANAME-04, ANAME-05)

**Notes.** Measure first: the length limit is unknown on Pi 1.0, because the features/mcp spike measured only Pi's built-in MCP, which hashes names at 64 characters. Confirm the Claude plugin tool form with `skills/claude-code-compat-research` before the name builder is written. Every requirement here changes the entry shape, so the shape must be final before Phase 5; a second rename costs users a second round of sign-ins and approvals. ANAME-07 writes `requestTimeoutMs` from the manifest, but AFILE-06 carries that field forward from the previous entry, so this phase must decide how a translated value and a carried user value interact; without that decision a plugin's later timeout change never takes effect (02-RESEARCH.md Pitfall 5).

**Carried from Phase 2 (D-02-22).** A kept user override is written back with the live entry's carried fields (`disabled`, `approveTools`, `includeTools`, `excludeTools`, `lifecycle`, `idleTimeout`, ...) overlaid, on the premise that those fields hold user choices. If this phase's translation makes the plugin write any carried field (for example a translated timeout or a lifecycle), decide in discuss how write-back tells a plugin-written value from a user one.

### Phase 4: Variable expansion at Claude Code parity

**Goal**: Plugin MCP entries expand variables by Claude Code's rules, write no environment value to disk, and cannot be turned into an unintended shell command or a credential leak by the adapter's own second expansion.

**Depends on**: Phase 3 (the entry translator it creates)

**Requirements**: AVAR-01, AVAR-02, AVAR-03, AVAR-04, AVAR-05

**Success Criteria** (what must be TRUE):

1. `${CLAUDE_PLUGIN_ROOT}`, `${CLAUDE_PLUGIN_DATA}` and, in project scope, `${CLAUDE_PROJECT_DIR}` are expanded at install time in Claude's fields only: stdio `command`, `args` and `env` values, and remote `url` and `headers`. (AVAR-01)
2. `${VAR:-default}` is resolved at install time with Claude's rule (an empty value counts as set), and plain `${VAR}` stays in the file for the adapter to expand at runtime. No written entry, fixture or test output contains a resolved environment value. (AVAR-02)
3. A leading `!` in a value the adapter would run as a shell command is written as `!!`, and a field the adapter re-expands with no escape produces an install warning instead of a parity claim. A conformance test runs every case through the pinned adapter's real functions. This closes MENVX-01 and ENVLIT-01. (AVAR-03)
4. A referenced variable that is unset and has no default produces a missing-variable warning at install, as Claude Code warns. (AVAR-04)
5. A `url` or `headers` value that references `ANTHROPIC_API_KEY` or another variable on Claude's credential deny-list does not receive that credential, and a security test proves it. (AVAR-05)

**Plans**: TBD

**Notes.** Needs a threat model before planning: secrets on disk, the credential deny-list, and shell execution through a leading `!`. The security gate should flag this phase. Build the per-field escape matrix from the pinned adapter's real expansion functions, not from a re-typed copy.

### Phase 5: Automatic migration on /reload

**Goal**: A user who upgrades gets every installed plugin's MCP servers moved from `mcp.json` into `mcp-adapter.json`, in their final shape, by `/reload` alone, with no server lost, none duplicated, and a clear account of what the rename costs them.

**Depends on**: Phase 2, Phase 3, Phase 4

**Requirements**: AMIG-01, AMIG-02, AMIG-03, AMIG-04

**Success Criteria** (what must be TRUE):

1. After upgrading, `/reload` moves each installed plugin's marked entries from `<scopeRoot>/mcp.json` into `mcp-adapter.json` in their final translated shape, with no reinstall. A second `/reload` changes no bytes in either file or in `state.json`. (AMIG-01)
2. A failure between adding to `mcp-adapter.json` and removing from `mcp.json` never loses a server, and the next `/reload` finishes the move with no duplicate left. A fault-injection test proves both and asserts the write order, not only the end state. (AMIG-01, AMIG-02)
3. The user sees one migration notice that lists each `old -> new` server name, says that the rename requires signing in again and re-approving project servers, and carries the reload hint, because the adapter picks up the move one `/reload` later. (AMIG-03)
4. A marked legacy entry with no owning install record stays in `mcp.json`, and the user is warned about it. (AMIG-04)

**Plans**: TBD

**Notes.** The migration is its own reconcile step with its own state lock, run per scope before the reconcile plan is applied. It must not hang on the backfill gate, which stamps unconditionally and so would never retry after a partial failure. The file an entry sits in tells whether it is translated, so no migration flag is persisted (COMPAT-01). Research flags: the one-reload lag, adapter panel copies of our entries, and the fault-injection design.

**Carried from Phase 2 review (IN-02).** Update and reinstall rewrite only `mcp-adapter.json`, so a server the plugin dropped or renamed keeps its marked entry in the legacy `mcp.json`. The migration meets marked entries whose plugin IS installed but whose name the record no longer lists. Decide in discuss whether to delete those or handle them like AMIG-04's unowned entries.

### Phase 6: Live MCP status in info

**Goal**: `/claude:plugin info` tells the user what state each plugin MCP server is in, as the adapter reports it, and says plainly when it does not know.

**Depends on**: Phase 1, Phase 3; can run in parallel with Phases 4 and 5

**Requirements**: ASTAT-01, ASTAT-02

**Success Criteria** (what must be TRUE):

1. `/claude:plugin info` shows each plugin MCP server's adapter state (for example connected, cached, needs-auth, failed), taken from the adapter's `pi-mcp-adapter/status/v1` events, without importing the adapter and without connecting any server. (ASTAT-01)
2. A lazy server that has not connected yet shows its resting state, not a failure. (ASTAT-01)
3. Before the first status snapshot, after the adapter's empty shutdown snapshot, and when the adapter is absent, info shows an explicit unknown state instead of a guess. (ASTAT-02)
4. Every new status token is a closed-catalog amendment in `docs/output-catalog.md`, and the catalog gates pass with the code. (ASTAT-02)

**Plans**: TBD

**Notes.** The status tracker is created in the extension factory and injected through `EdgeDeps`, the way `completionCache` is, never held as a module global. It needs only the final names from Phase 3.

### Phase 7: Docs and live proof

**Goal**: The documentation describes what this milestone delivers and where it diverges from Claude Code, and a real pi-mcp-adapter 5 proves it accepts what we write.

**Depends on**: Phases 1-6

**Requirements**: ADOC-01, ADOC-02, ADOC-03

**Success Criteria** (what must be TRUE):

1. README, `docs/env-vars.md` (ENVDOC-01), `docs/hooks-compatibility.md` and the PRD/NFR-10 text describe adapter-file delivery, naming, tool search, the variable rules and every documented divergence. (ADOC-01)
2. A live UAT in a sandboxed agent directory shows adapter 5 loading our entries, migrating a seeded legacy entry with the reloads counted, finding plugin tools through tool search, and `info` showing their status. (ADOC-02)
3. CHANGELOG records the milestone, and a version bump is offered before the PR. (ADOC-03)

**Plans**: TBD

**Notes.** Unit tests prove we wrote the file; only a live adapter proves it reads it. The live-canary scratch-engine route is known. The UAT also confirms whether `scripts/pi.sh`'s `--no-extensions` still leaves `builtin:tool-search` loaded on Pi 1.0.

## Progress

**Execution order:** 1 → 2 → 3 → 4 → 5 → 7. Phase 6 can start once Phase 3 is complete and run
alongside Phases 4 and 5. Phases 2 to 5 go out in one release (see the release rule above).

**Gate for every phase:** the full `npm run check` stays green at each phase gate, as
`skills/local-verification` schedules it: typecheck, ESLint, `fallow` (dead code, health,
duplication), Prettier, unit tests and integration tests (NFR-6). Disk mutations stay atomic
(NFR-1); `/reload` must suffice, with no Pi restart (NFR-2); every operation is idempotent or
fail-clean (NFR-3); containment holds (NFR-10); all user-visible output goes through the
notification dispatch (IL-2).

**Planning note:** no phase here is a frontend phase. The UI keyword gate false-positives on
words this milestone uses in their ordinary sense ("component", "info", the adapter "panel"), so
plan these phases with the UI gate skipped.

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Pi 1.0 floor and adapter-only detection | mcp-4 | 9/9 | Complete    | 2026-10-02 |
| 2. Adapter-file delivery | mcp-4 | 12/12 | Complete    | 2026-10-06 |
| 3. Claude Code tool names and tool search | mcp-4 | 1/9 | In Progress | - |
| 4. Variable expansion at Claude Code parity | mcp-4 | 0/TBD | Not started | - |
| 5. Automatic migration on /reload | mcp-4 | 0/TBD | Not started | - |
| 6. Live MCP status in info | mcp-4 | 0/TBD | Not started | - |
| 7. Docs and live proof | mcp-4 | 0/TBD | Not started | - |

## Carried Forward

- `PRUNE-GUARD-MR-01` remains in [BACKLOG.md](BACKLOG.md). Marketplace removal
  can leave a dependent unsatisfied; the load-time check reports that state.

Earlier carried items remain in [the archived roadmap](milestones/v1.20-ROADMAP.md)
and their current dispositions are tracked in [WINDOWS.md](WINDOWS.md).
