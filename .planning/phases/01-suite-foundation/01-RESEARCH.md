# Phase 1: Suite Foundation - Research

**Researched:** 2026-10-22
**Domain:** Cucumber behavioral-test harness (drivers, fixtures, stand-ins, shared steps) for the `/claude:plugin` lifecycle commands
**Confidence:** HIGH. Every answer below comes from reading the source in this tree and from runs of the real extension in a sandboxed Pi (temporary HOME and agent directory under `/tmp`; the real `~/.pi/agent` and `~/.claude` were never touched). The scratch scripts that produced the observations are in the session scratchpad, not in the repository.

## Summary

The harness already has most of what phases 2-15 need. These pieces work today: one headless Pi per worker in RPC mode, the loopback HTTPS git host with arming and a request log, the dir/file/url/github marketplace fixtures, the "offers these plugins with dependencies" step (version constraints such as `lib@^1.0.0` already work through it), the hand-edited config steps, and the run tokens. Phase 1 has to close nine specific gaps. Four of them are mechanical facts that a plan built on guesses would get wrong:

1. **A new session's own payloads are not streamed today.** In RPC mode, Pi binds the extension and runs `resources_discover` (the event that runs reconcile) before it subscribes to the new session's events. So the reconcile report of a `new_session` never reaches the `entry_appended` stream when the reconcile succeeds. Pi's RPC `new_session` also binds the extension **twice**, so reconcile runs twice: a failure that the first pass cannot fix is reported twice. The payloads are in the session, and the RPC request `get_entries` returns them. The driver must read them there.
2. **The long-lived Pi cannot start a session in another directory.** `new_session` always uses the runtime's fixed `cwd`. A second, short-lived `PiProcess` started with the same HOME and agent directory and a fresh cwd works: it starts in about 1.3 s and offers only the user-scope skills.
3. **Results carry absolute paths outside `{home}`.** Lock-held and EISDIR cause chains name `<sandbox>/project/.pi/...` and `<sandbox>/agent/...`. Git-source plugin versions are `sha-<12 hex>` of a commit whose hash changes on every run, and `plugin-clones/` keys hash a URL that contains the random git-host port. Scenarios cannot state any of these without new run tokens or projections.
4. **Six existing scenarios already get a reconcile report from their new session that nothing compares.** Enforcing "a scenario that leaves session rows uncompared fails" (success criterion 2) means that Phase 1 must add a comparison to each of them. Two of them are in files the ROADMAP lists as untouched.

The two failure-injection questions have measured answers. A child process that runs `proper-lockfile` with the product's exact options holds the lock past the 10 s stale window, and closing its stdin releases the lock and removes the lock directory. For rollback, the measured obstruction is **a directory in place of `<scopeRoot>/mcp-adapter.json`**. It makes a skills-only install fail in the mcp phase, which is phase 5 of 7, after the skills phase has committed. Rollback then removes the staged skill, and a retry succeeds once the directory is gone. The same obstruction makes an update fail in its prepare phase while the old version, its skills, and its record stay unchanged. EISDIR does not depend on the file mode, so root cannot bypass it.

**Primary recommendation:** Build Phase 1 in this order: (1) move `plugin.steps.ts` into topic modules; (2) extend the driver (session payloads through `get_entries`, row steps for `reconcile-applied-cascade` and `plugin-info-cascade`, a multi-payload setup `Given`, and path and revision tokens) and update the six existing scenarios; (3) generalize the git host (any owner, disarm) and add git-source plugin and official-marketplace fixtures; (4) add the state-lock child process; (5) add the fixture and observation steps, each with its seed scenario in the later phase's feature file.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Step module layout and file ownership
- Move `features/step_definitions/plugin.steps.ts` into
  `features/step_definitions/plugin/` as topic modules, in a commit of its own
  (layout rule D-08). Topic modules never take a verb name. Reserved verb
  names, which later phases own: `install`, `uninstall`, `enable`, `disable`,
  `update`, `reinstall`, `list`, `info`, `pending`, `reconcile`, `fetch`,
  `prune`, `import`, `bootstrap`, `browse`, `help`, `git-source`, `rollback`,
  `state-lock`, and `marketplace/remove`.
- A step that names a plugin's installation (record, data directory, clones,
  staged skills) goes in a plugin topic module. A step about publishing a
  plugin stays with the existing publishing steps
  (`marketplace/publishing.steps.ts`) or moves to a plugin publishing topic
  module if the plugin steps outgrow it. Any such move is its own commit.
- The git-host steps serve plugin repositories as well as marketplaces. Arming
  (401, 404, connection drop, required credential) and the request log take a
  repository named as a marketplace or a plugin. Keep the existing marketplace
  step text working, and do not add a second module with the same text.
- The state-lock setup step belongs to the function of the thing it names, the
  scope's state, not to a verb. The planner chooses the module name under the
  layout rules (no `common`, `shared`, `utils`, `helpers`, `support`, or
  `misc`).
- Amend the cucumber skill (`.agents/skills/cucumber/rules/layout.md`, or a
  short milestone note that it links to) with this milestone's ownership rule:
  phases 2-15 add only their own feature files and step modules, and a step a
  second phase needs goes back to a Phase 1 topic module in a follow-up commit,
  not into another phase's file.

#### Seed scenarios
- Each **Provides** capability has exactly one seed scenario. The seed is a
  real behavioral scenario that meets the cucumber rules (whole-result
  comparison, setup `Given`s that assert their effect), not a placeholder. It
  lives in the feature file of the later phase that needs it, and that phase
  extends the file.
- Seed feature files follow the layout rule
  `features/<function>/<capability>.feature`, with the names the ROADMAP file
  ownership table gives (for example `features/plugin/list.feature` and
  `features/plugin/git-source.feature`).
- A seed must fail under a plausible wrong implementation of the capability it
  proves. When one scenario can prove two capabilities without becoming
  unclear, it may cover both.

#### Failure injection and helper processes
- **State lock:** a helper child process under `features/lib/` takes the
  scope's lock with `proper-lockfile`, the same library the product uses
  (`transaction/with-state-guard.ts`: lockfile `locations.stateLockFile`,
  `realpath: false`, `stale: 10_000`, `update: 2_000`). It prints a ready line,
  keeps the lock fresh until it is killed, and the world's release kills it
  and asserts that the lock is gone. The `Given` asserts that the lock is held
  before it returns. Do not fake the lock by creating the lock directory,
  because a stale mtime makes the lock look free after 10 s.
- **Unwritable install-phase target:** prefer an obstruction of the wrong file
  type (a regular file where the phase writes a directory, or a directory
  where it writes a file), because that also stops root. Use a mode-bit change
  only if the obstruction is reported as a collision before staging instead of
  as a phase failure. In that case, the `Given` must confirm that a write
  really fails, so a run as root fails loudly instead of passing. Choose the
  target that install rollback (INS-07) and update rollback (UPD-04) each need,
  and record the choice in the plan.
- **Git host arming per plugin repository:** reuse the existing arming in
  `features/lib/https-git-host/` (401, 404, 5xx, connection drop, credential),
  generalized from a marketplace name to a repository name, with a disarm
  ("can stop doing so") that the release also runs.
- Every armed failure, the held lock, and the unwritable target are freed by
  the world's release, which runs the most recent release first.

#### Driver, payload kinds, and source kinds
- The result steps learn every payload kind a plugin lifecycle command or a
  new session emits, from `shared/notification-wire.ts` and the
  `*.messaging.ts` files: at least `cascade`, `plugin-info`,
  `plugin-info-cascade`, `reconcile-applied-cascade`,
  `reconcile-pending-empty`, `reconcile-aborted`, `prune-empty`,
  `prune-committed-warning`, `usage-error`, and `usage-info`. The planner's
  research confirms the full list. A scenario that leaves the rows of any
  emitted payload uncompared fails, the same as the existing DRV-01 driver
  contract.
- "Git, github, url" plugin sources map to the three git-clonable source kinds
  in `domain/source.ts`: `github` (served through
  `PI_CLAUDE_MARKETPLACE_GITHUB_BASE_URL`), `url` (an https git URL on the
  loopback host), and `git-subdir` (a url plus a path). Each fixture can
  publish a new revision.
- The official marketplace (`anthropics/claude-plugins-official`) is served
  by the git host through the GitHub base override, for `bootstrap` and
  `import`.
- A "new session in another project directory" and a new session's own
  payloads (its reconcile report) are read through the existing session and
  process harness (`features/lib/pi-process.ts`, `features/support/pi-process.ts`).
  If the long-lived Pi process cannot change its working directory, the
  planner chooses between a second Pi process for that scenario and a
  different seed. Starting a slow process per scenario is allowed only under
  the slow-process rule in `rules/world-and-stand-ins.md`.

### Claude's Discretion
- Exact step text, module names (within the rules above), and how the fixture
  builders are split inside `features/lib/`.
- Which existing step a new step should generalize, rather than adding a
  near-duplicate.

### Deferred Ideas (OUT OF SCOPE)
- Component-kind scenarios (commands, agents with `--map-model`, MCP, hooks,
  workflows) and missing optional peers: the later component milestone.

### Specifics carried from CONTEXT.md (binding)
- **Bug policy:** if a seed scenario exposes a product bug, fix it in this phase, with Claude Code's `/plugin` behavior as the reference (`claude-code-compat-research`).
- Run executors in this worktree with worktree isolation off; commit with `git commit -F <plan-scoped-msgfile> -- <paths>`; never run `gsd-tools config-set`; every test that touches Pi state uses the sandbox.
- The gate is `npm run check` (includes `test:cucumber` and `check:features`), run once on the combined tree at the phase gate.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| FND-01 | Step definitions and driver support that more than one later phase needs (plugin fixtures with dependencies, unsupported components, git-source plugins, hand-edited configs, an occupied state lock, a planted plugin data file) exist before the phases that use them, so each later phase adds only its own feature file and steps local to it | §Gap inventory, §Pattern 1-7, §Seed map. The lock design was validated end to end (§Pattern 4). The rollback target was measured over 15 candidate obstructions (§Pattern 5). The git-source kinds were measured against the git host (§Pattern 3). Session payloads were measured through `get_entries` (§Pattern 2). |
| FND-02 | The usage gate (`cucumber-js --dry-run --format usage`) stays green: no unused, undefined, or ambiguous step | §check:features rules. Every new step needs a seed scenario in the same phase, and every new `features/lib` export needs a user, because `fallow dead-code` reports unused files and exports under `features/` (verified with a probe file). |
</phase_requirements>

## Project Constraints (from AGENTS.md / CLAUDE.md)

- Never commit to `main`; merge (never rebase); commit messages follow `.agents/skills/committing/SKILL.md`; never `--no-verify`.
- Read a file before editing it; trace a function's callers before modifying it.
- Build verification: `npm run check` at GSD gates (static checks + unpaired + integration + **cucumber** + direct coverage). The pre-commit hook runs `check:commit` only when a staged file is a build input (`features/**/*.{js,json,ts}`, `cucumber.json`, ...). A `.feature` file alone is not a build input [VERIFIED: .pre-commit-config.yaml:106 `files: '^((extensions|features|rule-packs|test)/.*\.(js|json|ts)|cucumber\.json|...`].
- Upstream parity: Claude Code behavior is the default for every user-visible decision (applies to any bug fix a seed forces).
- NFR-10 containment, NFR-5 network policy, IL-2 output channel: production fixes must respect them; the harness itself is test code.
- Fallow is part of the gate: `fallow dead-code` (also over `features/`), `fallow dupes` (every clone group fails), `fallow health` (cognitive ≤ 15, cyclomatic ≤ 20) [CITED: .planning/codebase/CONVENTIONS.md].
- Comments cite durable IDs, never phase/plan numbers; no comments on trivial code (MEMORY).
- Tests never touch the real `~/.pi/agent` (MEMORY: subagent tests must use hermetic home).
- Markdown is formatted by mdformat, not Prettier (MEMORY).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Run commands and new sessions, validate payloads | `features/lib/pi-commands.ts` (driver) | `features/lib/pi-process.ts` | DRV-01: the driver validates every payload against `NOTIFICATION_PAYLOAD_SCHEMA` before any step reads it |
| Per-worker Pi + git host lifecycle, reset | `features/support/pi-process.ts` | `features/support/world.ts` | Slow-process exception: the only module-level state |
| Per-scenario resources (lock holder, second Pi, obstructions, arms) | `features/support/world.ts` `onRelease()` | the step that creates them | World owns lifetime; release runs most recent first |
| Git repositories (marketplace and plugin), arming, request log | `features/lib/https-git-host/server.ts` | `features/lib/git-marketplace.ts`, `hermetic-git.ts` | The one loopback stand-in for url/github/git-subdir sources |
| Plugin/marketplace fixtures | `features/lib/path-marketplace.ts`, `published-marketplace.ts` (+ new git-plugin lib) | `marketplace/publishing.steps.ts` | Fixtures register nothing; steps record publications on the world |
| Projection of run-specific values | `features/lib/run-tokens.ts`, `field-rows.ts` | world `tokens` getter | D-03 tokens |
| Gherkin/layout/usage gate | `scripts/check-features.mjs` | ESLint blocks for `features/**` | FND-02 |
| Product behavior under test | `extensions/pi-claude-marketplace/**` | — | Only touched when a seed exposes a bug (bug policy) |

## Standard Stack

### Core (all already installed; no new packages)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@cucumber/cucumber` | `^13.3.0` (devDependency) | Runner, world, hooks, parameter types | The suite's runner [VERIFIED: package.json:18] |
| `proper-lockfile` | `4.1.2` installed (`^4.1.2` dependency) | The state-lock helper child takes the real lock | Same library the product uses (locked decision) [VERIFIED: package.json:11, node_modules/proper-lockfile/package.json] |
| `@types/proper-lockfile` | `^4.1.4` (devDependency) | Types for the helper | [VERIFIED: package.json:23] |
| `typebox` | `^1.3.34` | Payload schema validation in the driver | Already used by `pi-commands.ts` [VERIFIED: package.json:33] |
| Node built-ins (`child_process`, `readline`, `fs/promises`) | Node 24 CI / 26.12.1 local | Child processes, second Pi, file fixtures | — |

### Supporting (system tools already required by the suite)

| Tool | Version found | Purpose |
|------|---------------|---------|
| `git` | 2.56.0 | `git http-backend` CGI for the host, fixture commits |
| `openssl` | 4.0.3 | Git host certificate |

**Installation:** none.

## Package Legitimacy Audit

No external package is added by this phase. `proper-lockfile`, `@cucumber/cucumber`, `typebox`, and `@types/proper-lockfile` are existing, pinned, lockfile-recorded dependencies of the repository [VERIFIED: package.json]. **Packages removed:** none. **Packages flagged:** none.

## Gap Inventory (what exists vs. what Phase 1 must add)

| Provides item | Exists today | Gap |
|---|---|---|
| Plugins with dependencies + version constraints | `Given the marketplace {string} offers these plugins with dependencies:` (publishing.steps.ts:78), cell `lib@^1.0.0` works (verified: install reported `lib@tools` with reasons `dependency current copy`; `lib@^2.0.0` against installed 1.2.0 reported `already installed, version conflict`) | Seed only |
| Partially available plugin (skills + unsupported component) | none | New Given: write `output-styles/<file>` into the published plugin (convention dir, `domain/unsupported-components.ts` `outputStyles: [{ relativePath: "output-styles", kind: "dir" }]`) |
| Publish a new version | `offers these plugins:` republishes (used by plugin/update.feature) | none for path kinds; new for git plugins |
| Git-source plugins (github/url/git-subdir) + new revision | none (marketplace manifest entries are always `./plugins/<name>`, path-marketplace.ts:79-89) | New lib + steps; manifest entries with object sources |
| Arm a plugin repository / disarm | arm by marketplace name only; no disarm (server.ts:336-350; arms cleared only by `reset()`) | Generalize to repository identity; add `disarm()`; release runs it |
| Request-log steps for plugin clone/fetch | `the git host receives these requests:` / `... no request` (git-host.steps.ts:77-91) | Text is source-agnostic already; works for plugin repos as-is (verified paths like `/acme/ghp.git/info/refs?service=git-upload-pack`) |
| Official marketplace via base override | host serves only owner `acme` via `repositoryPath()` (server.ts:32 `const OWNER = "acme";`, :313-315) | Allow owner `anthropics`; fixture that publishes `claude-plugins-official` |
| Hand-edit base/local configs: plugins with enabled state | `a config in scope {word} and layer {word}, with these plugins:` (config.steps.ts:120-133) | none |
| Hand-edit configs: marketplaces | none (steps.md: "No other config step writes") | New writer step for the `marketplaces` member + skill text amendment |
| Hold the scope's state lock | none | New lib child + Given (§Pattern 4) |
| Plant a file in plugin data dir / list its files | none | New steps in a plugin topic module |
| Delete an installed plugin's skill files | none | New Given |
| Write Claude Code settings file | none | New Given (`{home}/.claude/settings.json`, `<project>/.claude/settings.json`) |
| Make install-phase target unwritable / writable again | none | New Givens (§Pattern 5) |
| Observe installation record plugins | `the {word} scope has no installed plugins` (plugin.steps.ts:48) | Table form ("holds these plugins") |
| Observe `plugin-clones/` and marketplace clone dirs | none | New Then with projection (§Pitfall 4) |
| New session in another project directory | none; impossible with the long-lived Pi | Second short-lived `PiProcess` (§Pattern 2) |
| New session's own payloads | dropped by `startSession()` (pi-commands.ts:103-117) | `get_entries` after `new_session` (§Pattern 2) |
| Row steps for every payload kind | rows of `cascade` and `marketplace-info-cascade` only | `reconcile-applied-cascade` marketplaces, `plugin-info-cascade` blocks (§Payload kinds) |

## Architecture Patterns

### System Architecture Diagram

```text
 feature file (Given/When/Then)
        │
        ▼
 step modules ──(this: ScenarioWorld)──► world.ts ── onRelease() stack ──► After(): release in reverse,
   │  │  │                                │                                  then fail on uncompared rows/notices
   │  │  │                                ▼
   │  │  │                       currentRun() (support/pi-process.ts, one per worker)
   │  │  │                         ├── PiProcess (RPC, cwd=<root>/project, HOME=<root>/home,
   │  │  │                         │    PI_CODING_AGENT_DIR=<root>/agent)
   │  │  │                         └── HttpsGitHost 127.0.0.1:<port> (repositories/<owner>/<name>.git,
   │  │  │                              arms, request log, CGI children)
   │  │  ▼
   │  │ lib/pi-commands.ts: prompt ──► Pi ──► extension ──► appendEntry("claude-plugin", payload)
   │  │      ◄── entry_appended stream (commands)          ◄── get_entries (new sessions)
   │  │      validate each payload (NOTIFICATION_PAYLOAD_SCHEMA) ──► world.results / uncomparedRows
   │  ▼
   │ fixtures: lib/path-marketplace.ts, published-marketplace.ts, git-marketplace.ts (+ git plugin repos)
   │      ──► files under {home}/marketplaces, bare repos on the git host
   ▼
 per-scenario helpers (new): state-lock child (proper-lockfile), second PiProcess in <root>/other-*,
   obstructions in the scope root ──► each registers its release on the world
```

### Recommended Project Structure (deltas only; names are suggestions within the rules)

```text
features/
  plugin/                     # seed scenarios land in the later phases' files (see Seed map)
  marketplace/                # remove.feature + state-lock.feature + failed-add.feature are Phase 15's
  step_definitions/
    command.steps.ts          # + session results? (see Pattern 2), multi-payload Given
    session.steps.ts          # new-session payloads, other-project session
    config.steps.ts           # + marketplaces writer step
    git-host.steps.ts         # MOVED from marketplace/git-host.steps.ts (own commit), plugin repos too
    plugin/
      installation.steps.ts   # record, data dir, staged skills, clones, obstruction (replaces plugin.steps.ts)
      publishing.steps.ts     # (optional) git-source plugin + partial publishing steps
    <scope-state module>.steps.ts  # lock step, e.g. "scope.steps.ts" (not "state-lock")
    claude-settings.steps.ts  # (or a topic name) settings file writer
  support/
    plugin-source-kind.ts     # {plugin source kind} parameter type: github|url|git-subdir
  lib/
    state-lock.ts             # self-spawning lock holder (see Pattern 4)
    git-plugin.ts             # plugin repositories on the git host
    official-marketplace.ts   # (or inside published-marketplace.ts)
    result-rows.ts            # rowArrays/record projections shared by command + session steps
    claude-settings.ts        # settings file writer
```

### Pattern 1: Module move first (layout rule D-08)

`check-features.mjs` fails on "module beside its own directory" [VERIFIED: scripts/check-features.mjs:265-271 `if (!entry.directory && directories.has(sibling)) { ... "module beside its own directory features/${sibling}/" }`]. So creating `step_definitions/plugin/` and deleting `step_definitions/plugin.steps.ts` must land in **one commit**, and that commit must be the move only (CONTEXT). The step text stays `the {word} scope has no installed plugins` (used by plugin/install.feature and uninstall.feature), so no feature file changes in that commit.

### Pattern 2: New-session payloads and a session in another directory

**Facts (verified):**
- Pi's RPC `new_session` runs `runtimeHost.newSession()`, which calls `finishSessionReplacement()` → `rebindSession()`. Then the RPC handler calls `rebindSession()` **again** [VERIFIED: node_modules/@earendil-works/pi-coding-agent/dist/modes/rpc/rpc-mode.js:334-340 `const result = await runtimeHost.newSession(options); if (!result.cancelled) { await rebindSession(); }`; dist/core/agent-session-runtime.js:120-123 `finishSessionReplacement ... await this.rebindSession(this.session);`].
- `rebindSession` calls `session.bindExtensions(...)` (which emits `session_start`, then `resources_discover`) **before** `session.subscribe(...)` [VERIFIED: rpc-mode.js:248-270; dist/core/agent-session.js:2562-2585].
- Result: the first reconcile pass's entries are never streamed. The second pass's entries are streamed, because the first rebind already subscribed. Observed: a successful hand-edit reconcile streamed **nothing**, and a persistent failure was reported in **two identical** entries.
- `get_entries` returns every entry of the current session [VERIFIED: rpc-mode.js:503-513]. Observed after a hand edit:
  `{"kind":"reconcile-applied-cascade","origin":{"kind":"load"},"severity":"info","needsReload":false,"tally":{"label":"Reconcile","failures":0,"warnings":0,"success":{"count":2}},"marketplaces":[{"name":"fixtures","scope":"project","plugins":[{"status":"installed","name":"app",...},{"status":"disabled","name":"demo",...}]}]}`.
- `new_session` maps to `resources_discover` reason `"startup"`, not `"reload"` [VERIFIED: agent-session.js:2584 `this._sessionStartEvent.reason === "reload" ? "reload" : "startup"`]. So the reload-only missing-dependency install (`apply.ts:774 if (opts.reason !== "reload") { return false; }`) never runs in a harness new session. Phase 11 must not expect it.
- `newSession` uses the runtime's fixed `cwd` [VERIFIED: agent-session-runtime.js:147-171 `SessionManager.inMemory(this.cwd)` / `cwd: this.cwd`], so the long-lived Pi cannot open a session in another project.
- A second `PiProcess.start({ home, agentDir, cwd: <root>/other-xxxx }, run.piEnvironment)` started in about 1.3 s, offered only the user-scope skill (`skill:demo-skill`, not the project-scope one), and coexisted with the worker's main Pi (verified).

**Recommendation:**
- `startSession()` sends `new_session`, then `get_commands`, then `get_entries`. It returns `{ skills, payloads }`, where `payloads` holds every custom `claude-plugin` entry of the new session, in order, each validated against the schema (DRV-01). It returns all of them, unfiltered: the double pass is real Pi behavior and must not be hidden. A comment cites rpc-mode.js:334-340.
- `When the user starts a new pi session` puts those payloads on the world as the last results (`this.results`, `uncomparedRows`, `uncomparedNotices`). The existing uncompared-rows contract then covers sessions too, which success criterion 2 requires. `lastResult()` / `allResults()` currently say "no command has run"; reword them for sessions or keep a separate `sessionResults` with its own marker. Planner's choice; the important part is that the After hook fails on uncompared session rows.
- `Given the user has started a new pi session` asserts that every session payload has severity `info`, the same rule `Given the user has run` applies.
- The `Before()` reset asserts `payloads: []` for its reset session (cleanliness), next to the existing `skills: []`.
- "A new session started in another project directory": a step starts a second `PiProcess` in a per-scenario directory under `currentRun().root` (it must be under the OS temp directory and outside the repository, `test/e2e/_rpc.ts:156-180`). The step reads `get_commands` and `get_entries`, stops the process, and registers `onRelease` both to stop it if a later step fails and to remove the directory. This is a per-scenario resource owned by the world, not module state, so the slow-process rule is not violated. The cost is about 1.3 s for each scenario that uses it.

**Existing scenarios that would start failing (measured with an instrumented copy of the suite; all 433 scenarios passed):**

| Scenario | File | Session payload |
|---|---|---|
| A new session does not install a plugin whose local layer lacks its marketplace | features/plugin/configuration.feature | 2× `reconcile-applied-cascade`/error, row `claude-plugins.local.json` failed |
| An invalid refreshed manifest leaves installed plugins unchanged | features/marketplace/update.feature | 2× reconcile/error, `tools[demo:failed]` |
| Autoupdate keeps a plugin removed from the catalog | features/marketplace/update.feature | 2× reconcile/error, `tools[demo:failed]` |
| Removing a marketplace whose dependency declarations cannot be read fails and changes nothing | features/marketplace/remove.feature | 2× reconcile/error, `tools[lib:failed]` |
| Uninstalling a plugin whose dependency's declarations cannot be read fails and changes nothing | features/plugin/uninstall.feature | 2× reconcile/error, `tools[lib:failed]` |
| Updating every plugin with --local fails and updates nothing when the dependencies of a local plugin cannot be read | features/plugin/update.feature | 2× reconcile/error, `tools[lib:failed]` |

None of the 11 `Given the user has started a new pi session` uses produced a payload.

### Pattern 3: Git-source plugins on the loopback host

**Source kinds** [VERIFIED: extensions/pi-claude-marketplace/domain/source.ts:30-54, 267-330]. A marketplace entry's `source` object takes these forms, keyed by `source`:
- `github`: `{ "source": "github", "repo": "acme/ghp" }`. The canonical clone identity is `https://github.com/acme/ghp` (`domain/clone-key.ts canonicalCloneUrl`). The wire URL goes to the base override, so the host sees `/acme/ghp.git/...`.
- `url`: `{ "source": "url", "url": "https://127.0.0.1:<port>/acme/urlp.git" }`.
- `git-subdir`: `{ "source": "git-subdir", "url": "https://127.0.0.1:<port>/acme/mono.git", "path": "plugins/subp" }`.
- Each form also accepts optional `ref` and `sha` (`withOptionalSourceFields`, source.ts:140-147; a `sha` must be 40 hex).

**Measured traffic (git host request log):**

| Action | Requests |
|---|---|
| install pinned url (`sha` set) | `GET /acme/urlp.git/info/refs?service=git-upload-pack 200`, `POST /acme/urlp.git/git-upload-pack 200`; clone dir `<urlhash12>-<sha12>` |
| install unpinned github / git-subdir | the same pair **twice** (clone + mirror refresh); clone dir `<urlhash12>` |
| list / info (no flag) | none |
| `info --fetch` | the pair twice |
| `fetch ghp@gits` | the pair once |
| `update` (new revision) / `update` again | the pair once each |
| uninstall | none; the clone dir is removed when no record references it |
| re-install pinned after uninstall | the pair again (cold: uninstall's GC removed the clone) |
| install with repo armed 404 | `GET ... 404` only; row `failed`, reasons `[]`, cause `HTTP Error: 404 Not Found`, `fetched https://127.0.0.1:<port>/acme/ghp.git` |

Pinned versus mirror behavior comes from `clone-cache.ts:193-232` (`materializePluginClone`: a present key directory is a warm cache with no network) and `:278-330` (`materializeOrRefreshPluginMirror`: always refreshes). Clone directories are per scope (`<extensionRoot>/plugin-clones/`, locations.ts:231). So "a second install of the same pinned source reuses the clone" (INS-05) needs a second plugin in the **same scope** with the **same url+sha**. Two `git-subdir` entries of one repository pinned to one commit share a key. The fixture must support several plugins in one repository and a `sha` pin.

**Fixture recommendation:**
- A lib module (for example `features/lib/git-plugin.ts`) writes a plugin (`.claude-plugin/plugin.json` + `skills/<name>-skill/SKILL.md`, the same content as `path-marketplace.ts writePlugin`) at a repository root or a subpath. It publishes the plugin with `publishGitRepository` (git-marketplace.ts:22-35), and a new revision uses `pushGitRepository` (git-marketplace.ts:45-49).
- `OfferedPlugin` gains an optional git source, so `manifestText` (path-marketplace.ts:79-89) writes the object `source` (plus an optional `sha` of the current revision) instead of `./plugins/<name>`. Any marketplace kind can then offer git plugins.
- The world records plugin repositories by plugin name (next to `recordPublished`), so the arm and log steps can name "the plugin {string}".
- A `{plugin source kind}` parameter type (`github|url|git-subdir`) goes in a support module named after it, like `support/source-kind.ts`.

**Official marketplace:** publishing a work tree at `<host>/repositories/anthropics/claude-plugins-official.git` with manifest `name` `claude-plugins-official` made `bootstrap` succeed. Traffic was `GET /anthropics/claude-plugins-official.git/info/refs?service=git-upload-pack 200`, then `POST ... 200`. It emitted two cascades: `added` and `autoupdate enabled`. A second run emitted one cascade, `skipped` with reasons `already autoupdate`, and no request. `import` with `hello@claude-plugins-official` enabled installed from it (verified). The host already serves any owner through the CGI (`cgi.ts:48 GIT_PROJECT_ROOT`); only `repositoryPath/Url/Shorthand` and `armFor` hard-code `acme` [VERIFIED: server.ts:32 `const OWNER = "acme";`, :181-190, :312-329]. The code that names the official repository is `orchestrators/plugin/bootstrap.ts:56 const BOOTSTRAP_SOURCE = "anthropics/claude-plugins-official";` and `orchestrators/import/marketplaces.ts:16-17`.

**Git host generalization:** key repositories and arms by `owner/name`. Keep `acme` as the default owner, so `GitPublication.repository` and the existing request rows (`/acme/tools.git`) stay as they are. Add `disarm(repository)`. The arm steps register `onRelease(() => gitHost.disarm(...))`, and a "serves ... again" Given disarms early for retry scenarios. `snapshot().arms` stays the reset check.

### Pattern 4: State lock held by another process (validated end to end)

**Facts:**
- Lock file: `<scopeRoot>/pi-claude-marketplace/.state-lock` [VERIFIED: persistence/locations.ts:205-207 `const extensionRoot = path.join(scopeRoot, "pi-claude-marketplace"); ... const stateLockFile = path.join(extensionRoot, ".state-lock");`]. `scopeRoot` is the agent directory (user) or `<cwd>/.pi` (project) (locations.ts:203).
- Product options [VERIFIED: transaction/with-state-guard.ts:175-183 `lockfile.lock(locations.extensionRoot, { lockfilePath: locations.stateLockFile, realpath: false, retries: 0, stale: 10_000, update: 2_000 })`]. The product creates `extensionRoot` first (with-state-guard.ts:114-117). An `ELOCKED` error becomes `StateLockHeldError(scope, lockPath)` (:133-136) with the message `Another pi-claude-marketplace operation is in progress for ${scope} scope (${lockPath}). Retry after it completes.` (shared/errors.ts:852-864).
- `proper-lockfile` un-refs its update timer [VERIFIED: node_modules/proper-lockfile/lib/lockfile.js:176-182], so the helper must keep itself alive, for example with an open stdin. On process exit it removes held locks through `signal-exit` (lockfile.js:6, :331).
- **Prototype result:** a child `node <helper>.ts <extensionRoot> <lockFile>` printed `locked`. `lockfile.check(...)` then returned `true`. **12 s later** (past `stale`), Pi's `uninstall` still failed with reasons `["lock held"]`. Ending stdin made the child exit with code `0`, the lock directory was gone (`ENOENT`), and the next `uninstall` succeeded.

**Design:**
- `features/lib/<lock module>.ts` exports a function that spawns `process.execPath` on **its own file**, waits for the ready line with a timeout, and returns a handle (`release()`: end stdin, await exit code 0, assert `stat(lockFile)` rejects with `ENOENT`; fall back to SIGKILL plus a failure if the child hangs). When run as a script (`process.argv[1] === fileURLToPath(import.meta.url)`), the same file runs `mkdir(extensionRoot, { recursive: true })`, then `lockfile.lock(...)` with the product's exact options, then prints `locked`, then releases on stdin `end`. One file that is both imported and executed avoids an unused file. `fallow dead-code` reports an unimported `features/lib` file: a probe file was reported (`probe reported: true`).
- The `Given` (`another process holds the state lock of the {word} scope`) creates the child, registers `onRelease(handle.release)`, and asserts `await lockfile.check(extensionRoot, { lockfilePath, realpath: false, stale: 10_000 }) === true`.
- Do not take the lock inside the cucumber worker. It would also work, but the CONTEXT locks a child process, and a worker-held lock would share the event loop with the git host.

**Which verbs take the lock (measured with the lock held in project or user scope):**

| Command | Result with the lock held |
|---|---|
| `install` | cascade/error, row `failed`, reasons **`[]`**, cause chain = [StateLockHeldError message with **absolute** lock path, `Lock file is already being held`] |
| `uninstall`, `reinstall` | row `failed`, reasons `["lock held"]` (uninstall cause chain has the absolute path; reinstall has no cause) |
| `enable`, `disable` | row `failed`, reasons **`[]`**, absolute-path cause chain |
| `update <p>` when an update is due | row `failed`, reasons **`["unreadable manifest"]`** (wrong), absolute-path cause chain |
| `update <p>` up to date / bare `update` | `skipped up-to-date` / no-op (the lock is never taken) |
| `prune` | marketplace `(prune)`, row `(prune)@(prune)` failed, reasons `["lock held"]`, cause `... project scope (.state-lock)...` (redacted to the basename) |
| `marketplace update`, `autoupdate`, `noautoupdate` | marketplace row failed, plugin row `<mp>@<mp>` reasons `["lock held"]`, absolute path |
| `marketplace add`, `marketplace remove` | **`internal-error`**, summary `Command failed unexpectedly.`, cause `... project scope ([path]` (truncated, redacted) |
| new session (reconcile) | `reconcile-applied-cascade`/error, marketplace `state.json` failed `["lock held"]`, cause `(.state-lock)` |
| `list`, `info`, `pending`, `fetch` (no lock: `fetch.ts` has 0 guard calls), `import` with nothing to import, `help`, `browse` | unaffected |

Phase 15 (FLR-01/02) owns the inconsistent rows in bold above under the bug policy. **Choose the Phase 1 seed so that it does not need one of those fixes**: `uninstall` already reports `lock held`. The seed's cause chain still holds an absolute sandbox path, so it needs a path token (Pitfall 3).

### Pattern 5: Unwritable install-phase target (measured over 15 obstructions)

A skills-only plugin was installed with each obstruction in place, then the obstruction was removed and the install retried:

| Obstruction | Effect on `install demo` |
|---|---|
| regular file at `commands-staging`, `resources/prompts`, `agents-staging`, `<scopeRoot>/agents`, `hooks`, `<agentDir>/workflows`, `.../.pi-claude-marketplace-staging`, `cache`, `data/<mp>/<plugin>` | **No effect.** These phases skip for a skills-only plugin; a data-dir mkdir failure is swallowed post-commit (install-flow.ts:1072-1078) |
| file at `skills-staging` / file at `resources/skills/<plugin>-skill` | fails **in the skills phase** (ENOTDIR): no earlier phase to roll back |
| `state.json` as a directory | fails before the ledger (state load EISDIR) |
| `claude-plugins.json` as a directory | fails before the ledger (`invalid manifest`, config schema) |
| **`<extRoot>/agents-index.json` as a directory** | fails in the **agents phase (3/7)** after skills committed; skill removed, no record, no declaration, `rollbackPartial: []`; retry after removal → `installed` |
| **`<scopeRoot>/mcp-adapter.json` as a directory** | fails in the **mcp phase (5/7)** after skills committed; skill removed, no record, no declaration, `rollbackPartial: []`; retry → `installed` |

**Recommendation for INS-07: a directory at `<scopeRoot>/mcp-adapter.json`.** It is a user-owned file that a step already names ("the mcp-adapter.json file of the {word} scope holds a comment", mcp-configuration.steps.ts:24), so the step text can name it. It fails a phase two phases after skills. EISDIR does not depend on permissions. The `Given` asserts `readFile(target)` rejects with `{ code: "EISDIR" }`; the "writable again" `Given` removes the directory and asserts `ENOENT`, and the world release removes it too. Observed row: `status: failed`, `reasons: []`, cause chain `EISDIR: illegal operation on a directory, read '<cwd>/.pi/mcp-adapter.json'`. That cell needs a project path token.

**Recommendation for UPD-04: the same obstruction.** Updating `demo` from 1.0.0 to 2.0.0 with `mcp-adapter.json` as a directory failed in the update's **prepare** phase, after the skills bridge had staged 2.0.0 (update-swap.ts:12-15 "(prepare): sequential bridge prepare* ... skills -> commands -> agents -> mcp -> workflows. Any throw triggers abort"). The record stayed byte-identical (`version 1.0.0`, same `updatedAt`), the skill kept `A skill of demo 1.0.0.`, and `list` showed `upgradable 1.0.0`. The retry after removal moved `1.0.0 → 2.0.0`. Observed row: reasons **`["unreadable manifest"]`**, which is wrong because the manifest is fine. The same misleading reason (`source missing`) appeared for a `skills-staging` obstruction. These are bug-policy candidates for Phase 5, not for the Phase 1 seed.

**Risk:** both phases read their file even when the plugin has no MCP servers or agents. A later "skip mcp when there are no servers" refactor would silently make this obstruction a no-op, and the seed's whole-result comparison would then fail loudly, which is acceptable. `agents-index.json` is the fallback target, with the same risk.

### Pattern 6: Plugin data dir, skill files, settings file

- Data dir: `<scopeRoot>/pi-claude-marketplace/data/<marketplace>/<plugin>/` [VERIFIED: locations.ts:225 `const dataRoot = path.join(extensionRoot, "data");`, :310-322 `pluginDataDir(mp, plugin)` → `path.join(dataRoot, mp, plugin)`]. Install creates it after the state commit, for every plugin, skills-only included [VERIFIED: orchestrators/plugin/install-flow.ts:1072-1074 `// AS-6 / D-08: eager per-plugin data dir mkdir. try { await mkdir(installCtx.pluginDataDir, { recursive: true });`; observed `data/fixtures/seed/` after install]. Uninstall removes it unless `--keep-data` [VERIFIED: orchestrators/plugin/uninstall.ts:1126-1143 `if (!keepData) { const dataDir = await locations.pluginDataDir(marketplace, plugin); ... await rm(dataDir, { recursive: true, force: true });`]. `--keep-data` reports reasons `["data kept"]` (observed). Marketplace remove also removes data dirs (remove.ts:1167). The "plant a file" Given should assert that the directory exists first, so it also proves the install created it.
- Skill files: `<scopeRoot>/pi-claude-marketplace/resources/skills/<generated name>/` (locations.ts:223); the record's `resources.skills` lists the generated names (observed `"resources":{"skills":["demo-skill"],...}`). The delete step should read the names from the record, delete each directory, and assert `ENOENT`.
- Claude Code settings read by `import` [VERIFIED: orchestrators/import/settings.ts:31-49]: user scope `path.join(claudeRoot, "settings.json")` and `settings.local.json`, where `claudeRoot = options.claudeConfigDir ?? envDirValid ?? path.join(os.homedir(), ".claude")`; project scope `path.join(cwd, ".claude", "settings.json")` / `settings.local.json`. Pi's environment is an allowlist: `HOME: sandbox.home`, `PI_CODING_AGENT_DIR`, `PI_OFFLINE`, `PATH`, plus the git variables, and no `CLAUDE_CONFIG_DIR` [VERIFIED: test/e2e/_rpc.ts:183-201]. Pi is spawned with `cwd: sandbox.cwd` (_rpc.ts:381-388). So the files are `{home}/.claude/settings.json` and `<sandbox cwd>/.claude/settings.json`, both emptied by the `Before()` reset. The accepted marketplace shapes are nested `{ "source": { "source": "directory"|"github"|"url", ... } }` and the legacy flat forms (import/marketplaces.ts:36-80). Observed: `import --scope user` with `enabledPlugins` `{demo@fixtures: true, hello@claude-plugins-official: true, nope@fixtures: true}` → one cascade/warning with a `fixtures` block (`added`; demo installed, nope `unavailable` `no longer installable`) and a `claude-plugins-official` block.

### Pattern 7: Hand-edited configs including marketplaces

`writeLayerPlugins` keeps the other members of the file (layer-config.ts:285-296). Add a sibling writer for the `marketplaces` member, with a table such as `| name | source |`, that keeps `plugins`. The config shape is `{ schemaVersion: 1, marketplaces: {...}, plugins: {...} }`; the existing writer creates `{ schemaVersion: 1 }` when the file is absent (layer-config.ts:266-269). steps.md says "No other config step writes" [VERIFIED: .agents/skills/cucumber/rules/steps.md], so the skill text must be amended in the same plan.

### Anti-Patterns to Avoid

- **Faking the lock with `mkdir .state-lock`:** a stale mtime makes the lock look free after 10 s (locked decision).
- **Mode-bit obstructions:** root bypasses them; the existing `publishUnreadableSkillFile` (EACCES) is only safe because its `Given` asserts the read fails.
- **Stating raw clone keys or `sha-...` versions:** they change every run (Pitfall 4).
- **Picking one payload out of several:** DRV-01; `lastResult()` must keep failing on more than one.
- **A second module with the same step text:** move `marketplace/git-host.steps.ts` instead of copying it.
- **Naming a Phase 1 module after a reserved verb** (`state-lock`, `git-source`, `rollback`, ...).

## Payload Kinds (Q3)

The union [VERIFIED: shared/notification-wire.ts:813-845]: `cascade`, `reconcile-applied-cascade`, `marketplace-info`, `plugin-info`, `marketplace-info-cascade`, `plugin-info-cascade`, `marketplace-not-added`, `reconcile-pending-empty`, `prune-empty`, `prune-committed-warning`, `usage-error`, `usage-info`, `diagnostic`, `device-flow-prompt`, `async-rewake-summary`, `stop-override-cap`, `reconcile-aborted`, `plugin-path-skipped`, `mcp-config-notices`, `mcp-migration`, `internal-error`.

**Observed per command (this tree, sandbox runs):**

| Command | Payload kinds observed |
|---|---|
| install | `cascade` (one row per closure member; a dependency row's `name` is `lib@tools`, reasons `dependency current copy`); failed install of a partial plugin: row `partially-available` + `hint: partial-install`; `marketplace-not-added` when the scope lacks the marketplace; `diagnostic` possible for discovery warnings (install-flow.ts collectPostCommitWarnings; not triggered by skills-only fixtures) |
| uninstall, enable, disable, reinstall, update, fetch | `cascade` (update no-op: `noOp: true`, empty marketplaces) |
| list | `cascade` with `tally` (`label: "Plugin list"`); statuses seen: `installed`, `available`, `disabled`, `unavailable` (`unsupported source`), `partially-available` / `partially-installed` (`unsupported component`), `upgradable`, `remote` (git plugin not yet cloned) |
| info | `plugin-info` (one scope), `plugin-info-cascade` (`blocks`, plugin in both scopes), `plugin-info` ×2 (not-in-manifest in two scopes), `marketplace-not-added` |
| pending | `reconcile-pending-empty`, or `cascade` with rows `will install` / `will disable` / ...; `cascade`/error on a broken config |
| prune | `prune-empty`; `cascade` (`--dry-run`: `will uninstall`, `dependency pruned`; real: `uninstalled`) |
| import | `cascade` (tally `Import`), empty `marketplaces: []` when nothing to import |
| bootstrap | 2× `cascade` (`added`, `autoupdate enabled`); 1× `cascade` (`skipped`, `already autoupdate`) on re-run; `usage-error` for an argument or `--scope` |
| browse (RPC) | `usage-error`, message `Browse is unavailable in rpc mode. Use /claude:plugin list instead.` |
| help | `usage-info`; `help foo` → `usage-error` `Unknown help topic: "foo".` |
| unknown flag | `usage-error` `Unknown flag: "--bogus".` |
| marketplace add/remove under lock | `internal-error` |
| new session | `reconcile-applied-cascade` (0, 1, or 2 per session; see Pattern 2); `mcp-migration`, `plugin-path-skipped`, `reconcile-aborted` are possible load surfaces (index.ts:110-152) |

**How the driver handles them today:**
- `runCommandPayloads` validates each payload and returns all of them in order (pi-commands.ts:66-81). `runCommand` (used by `Given the user has run`) requires **exactly one `cascade`** (:87-95), so a `Given` running `bootstrap` (two cascades) or any non-cascade setup fails. Generalize the `Given` to accept any number of payloads, each with severity `info`, following `the user has updated every marketplace` (marketplace/update.steps.ts:31).
- Row arrays are `marketplaces` and `blocks` [VERIFIED: features/step_definitions/command.steps.ts:33 `const ROW_FIELDS: ReadonlySet<string> = new Set(["marketplaces", "blocks"]);`]. Every other field is an envelope field, which `the result has these fields:` and `the command reports these results:` compare (flattened: `plugin.components.skills` → `plugin components skills`).
- Row steps accept `cascade` (plugins), `cascade` + `marketplace-info-cascade` (marketplaces), and `cascade` + `mcp-config-notices` (`the results list these marketplaces and plugins:`) (command.steps.ts:131-198).
- **Not handled:** `reconcile-applied-cascade` rows (its `marketplaces` would be flagged as uncompared, and no row step accepts the kind) and `plugin-info-cascade` `blocks` (flagged, unreadable). Also not handled: any new-session payload (never captured). `reconcile-aborted` and `prune-committed-warning` have no row arrays, so the generic field steps already compare them. No reliable trigger for either was found in the sandbox (`reconcile-aborted` needs `applyReconcile` to throw; `prune-committed-warning` needs a post-commit prune failure). Treat them as covered by the generic field steps and do not seed them [ASSUMED: acceptable reading of success criterion 2].

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Holding the state lock | `mkdir .state-lock` + `utimes` loop | `proper-lockfile.lock()` with the product's options in a child | Exact compat with `retries: 0` / `stale` semantics; exit cleanup via `signal-exit` |
| Checking the lock is held | `stat` mtime math | `lockfile.check(file, { lockfilePath, realpath: false, stale: 10_000 })` | Same staleness rule as the product |
| Git server | a fake HTTP handler | existing `HttpsGitHost` (`git http-backend`) | Real smart-HTTP protocol, already validated for clone/fetch/auth |
| Reading a new session's report | parsing `entry_appended` around `new_session` | RPC `get_entries` | Streaming misses the first bind pass (Pattern 2) |
| Session in another dir | `switch_session` with a crafted session file | a second `PiProcess` | `--no-session` runs in memory; `switch_session` reads a session file's cwd and is fragile |
| Payload validation | ad-hoc shape checks | `NOTIFICATION_PAYLOAD_SCHEMA` via `Compile` | DRV-01 |
| Commit / push fixtures | shelling git in steps | `publishGitRepository` / `pushGitRepository` / `runGit` | Hermetic environment (DRV-03) |

## Common Pitfalls

### Pitfall 1: Six existing scenarios break when session rows become mandatory
**What goes wrong:** the new-session `When` starts recording reconcile payloads, and the six scenarios in the Pattern 2 table fail with "no step compared these rows".
**How to avoid:** in the same plan that changes the driver, add a session-results comparison to each of the six. Two of them sit in files the ROADMAP marks "untouched" (`plugin/configuration.feature`, `marketplace/update.feature`). The alternative, an opt-in step, leaves criterion 2 unmet for the old step. See Open Question 1.
**Warning sign:** `npm run test:cucumber` red only on those titles.

### Pitfall 2: Reconcile runs twice per `new_session` in RPC
**What goes wrong:** a persistent reconcile failure appears as two identical payloads, so a scenario expecting one fails, or a "dedupe" hides a real double report.
**How to avoid:** return all entries; state both rows in the scenario. A comment at the driver cites rpc-mode.js:334-340. Re-measure if the Pi peer is upgraded.

### Pitfall 3: Absolute sandbox paths in results
**What goes wrong:** lock-held and EISDIR cause chains contain `<root>/project/.pi/...` or `<root>/agent/...`, which no token covers. `{home}` is `<root>/home` [VERIFIED: features/support/pi-process.ts:306-310 `home: path.join(root, "home"), agentDir: path.join(root, "agent"), cwd: path.join(root, "project")`].
**How to avoid:** add run tokens for the sandbox project directory and the Pi agent directory (names are the planner's choice, for example `{project}` and `{agent dir}`). Wire them through `RunTokens`, `expandTokens`, and `projectTokens` (run-tokens.ts:319-361), and document them in features.md "Run tokens". No existing scenario states these paths (they are random), so adding the projection cannot break one.
**Warning sign:** a seed table that needs a literal `/tmp/pi-cm-features-...`.

### Pitfall 4: Run-specific git identities
**What goes wrong:** git-source plugin versions are `sha-<12 hex>` (observed `sha-29f96df1866e`; `deriveInstallVersion`, install-outcome.ts:905-916). Commit hashes change per run because the hermetic git environment fixes names and emails but not dates [VERIFIED: features/lib/hermetic-git.ts:23-26 sets only `GIT_AUTHOR_NAME`, `GIT_AUTHOR_EMAIL`, `GIT_COMMITTER_NAME`, `GIT_COMMITTER_EMAIL`]. `plugin-clones/` keys hash the canonical URL, which for url/git-subdir contains the random port.
**How to avoid:** (a) the git plugin fixture records each published revision, and `projectTokens` maps `sha-<first 12 hex>` of a recorded revision to a readable token, for example `{revision 2 of "demo"}` [ASSUMED: token design is discretionary]. Or (b) fix `GIT_AUTHOR_DATE` / `GIT_COMMITTER_DATE` in `hermeticGitEnvironment` so hashes are deterministic, and state literal `sha-...` values (opaque, and every one changes when fixture text changes). Recommend (a). The clone-observation step must project each `plugin-clones/<key>` entry to its origin URL (read `<entry>/.git/config` `[remote "origin"] url`, tokenized to `{git host}`) and a pinned/mirror flag, never to the key.

### Pitfall 5: `fallow` sees `features/`
**What goes wrong:** an exported lib function that no step uses, a lib file that is only spawned, or two near-identical step bodies (marketplace and plugin arm steps) fail `npm run fallow`.
**How to avoid:** every new export gets a seed user in this phase. Make the lock helper self-spawning (Pattern 4). Share arm code through one helper. Run `npx fallow dupes` and `npx fallow dead-code` before committing.

### Pitfall 6: The "module beside its own directory" check
**What goes wrong:** adding `step_definitions/plugin/x.steps.ts` while `plugin.steps.ts` still exists fails `check:features`.
**How to avoid:** the move commit creates the directory and removes the file together.

### Pitfall 7: The source-kind Examples rule bites plugin outlines
**What goes wrong:** `check-features.mjs` treats any column named exactly `source kind` as a marketplace kind. An untagged block must then hold only `dir`/`file`, and the only tags are `@url`/`@github` [VERIFIED: scripts/check-features.mjs:35-36 `const sourceTags = new Set(["@url", "@github"]); const localKinds = new Set(["dir", "file"]);`, :357-386]. A plugin Outline with `| source kind | github |` fails.
**How to avoid:** name the plugin column differently (for example `plugin source kind`), leave its Examples untagged, and note this in the skill amendment.

### Pitfall 8: `Given the user has run` only accepts one info cascade
**What goes wrong:** setup that runs `bootstrap`, `info`, `pending`, or a failing command cannot be a `Given`.
**How to avoid:** generalize it (all payloads info). Retry scenarios (INS-07, FLR-03, INS-06) need a setup step that runs a command expected to fail. Consider one shared `Given` that asserts a failure severity, rather than a copy per phase.

### Pitfall 9: Parallel workers and per-scenario resources
**What goes wrong:** `parallel: 8` with random order [VERIFIED: cucumber.json `"order": "random", "parallel": 8`]. A lock child, a second Pi, an obstruction, or an `other-project` directory leaks into the next scenario.
**How to avoid:** every one of them registers `onRelease` in the step that creates it. The `Before()` reset empties only `home`, `agent`, and `project` (support/pi-process.ts:357-364), so directories elsewhere under `root` need their own release.

## Code Examples

### Lock holder (self-spawning lib module; prototype verified)
```typescript
// Source: verified prototype (scratchpad e9-helper.ts / lock-holder.ts); options from transaction/with-state-guard.ts:175-183
// Child mode (when run as a script):
await mkdir(extensionRoot, { recursive: true });
const release = await lockfile.lock(extensionRoot, {
  lockfilePath: lockFile, realpath: false, retries: 0, stale: 10_000, update: 2_000,
});
process.stdin.on("end", () => { void release().then(() => process.exit(0)); });
process.stdin.resume(); // the update timer is unref'd (lockfile.js:176-182)
process.stdout.write("locked\n");

// Parent side (in the Given): spawn(process.execPath, [thisFile, extensionRoot, lockFile], { stdio: ["pipe", "pipe", "inherit"] }),
// await the "locked" line, world.onRelease(release), then assert lockfile.check(...) === true.
```

### Reading a new session's payloads
```typescript
// Source: rpc-mode.js:503-513 (get_entries); verified output in Pattern 2
const started = await pi.request({ type: "new_session" });
const listed = await pi.request({ type: "get_commands" });
const entries = await pi.request({ type: "get_entries" });
// entries.response.data.entries: custom entries with customType "claude-plugin", origin { kind: "load" }
```

### Git-source manifest entries (verified installs)
```json
{ "name": "ghp",  "source": { "source": "github", "repo": "acme/ghp" } }
{ "name": "urlp", "source": { "source": "url", "url": "https://127.0.0.1:<port>/acme/urlp.git", "sha": "<40 hex>" } }
{ "name": "subp", "source": { "source": "git-subdir", "url": "https://127.0.0.1:<port>/acme/mono.git", "path": "plugins/subp" } }
```

## Seed Map (one real scenario per Provides capability)

| Capability | Seed lands in (owner phase) | Seed behavior (title is the writer's) | Fails under |
|---|---|---|---|
| Constraint dependencies | `features/plugin/install-dependencies.feature` (3) | Install `app` (`lib@^1.0.0`) installs `lib` too, both rows reported | a closure that ignores constraints |
| Partially available plugin | `features/plugin/partial-install.feature` (3) | Install without `--partial` fails with row `partially-available`, `unsupported component`, hint `partial-install` | a fixture that writes no `output-styles/` |
| New session in another project | `features/plugin/install.feature` (3) | User-scope install; a session in another project offers its skill | a project-scope install |
| Git-source plugins (3 kinds) + request log | `features/plugin/git-source.feature` (4) | Outline: install from github/url/git-subdir, rows + `the git host receives these requests:` | host or base-override misrouting |
| Arm/disarm a plugin repository | `features/plugin/git-source.feature` (4) | Host answers 404 → install fails, no record, no clone | arming keyed by marketplace only |
| New plugin revision / clones observation | `features/plugin/git-source-update.feature` (4) | Update fetches the new revision; clone entries projected | stale fixture push |
| Unwritable target / writable again | `features/plugin/install-rollback.feature` (5) | Install fails in the mcp phase, no skill, no record, no declaration | no rollback of skills |
| Plant + list data dir files | `features/plugin/uninstall.feature` (6) | `--keep-data` keeps the planted file | data dir removed anyway |
| Delete installed skill files | `features/plugin/reinstall.feature` (8) | Reinstall restores deleted skills | no restore |
| `plugin-info-cascade` rows | `features/plugin/info.feature` (10) | Info on a plugin installed in both scopes lists both blocks | block rows unread |
| Hand-edited configs incl. marketplaces + pending | `features/plugin/pending.feature` (11) | A hand-added plugin is pending as `will install` | config writer ignores a member |
| Session payloads (`reconcile-applied-cascade`) | `features/plugin/reconcile.feature` (11) | The next session installs a hand-added plugin and reports it | report dropped |
| `prune-empty` | `features/plugin/prune.feature` (12) | Prune with nothing to prune reports the empty result | — |
| Claude Code settings file | `features/plugin/import.feature` (13) | Import installs an enabled plugin from `{home}/.claude/settings.json` | wrong path |
| Official marketplace | `features/plugin/bootstrap.feature` (14) | Bootstrap adds `claude-plugins-official` (two cascades + request log) | owner hard-coded to acme |
| `usage-info` | `features/plugin/help.feature` (14) | `help` shows the plugin usage | — |
| State lock held | `features/plugin/state-lock.feature` (15) | Uninstall while another process holds the lock fails `lock held`, changes nothing | lock faked or released early |
| Installation record table | e.g. `features/plugin/enable.feature` (2) or the rollback seed | Record holds exactly these plugins | — |

Observed bug candidates that the seeds above deliberately avoid (each is the owning phase's work under the bug policy): lock-held rows without `lock held` (install/enable/disable), `unreadable manifest` for lock-held update and for EISDIR during update, `internal-error` for marketplace add/remove under lock, empty reasons for a git 404 install (fetch says `source missing`), reconcile and import `installed` rows without `version`, `list --remote` returning an empty marketplace block for git plugins, `info --fetch` not reporting the new revision, inconsistent path redaction in cause chains. Bug-ness is [ASSUMED] until each owning phase checks Claude Code parity.

## check:features Rules New Files Must Satisfy (Q8)

[VERIFIED: scripts/check-features.mjs]
- Catch-all names rejected for files **and directories** under `step_definitions/`, `support/`, `lib/`: `"common", "shared", "utils", "helpers", "support", "misc", "hooks", "parameter-types"` (:25-34).
- `step_definitions/**`: depth ≤ 3, name ends `.steps.ts`; `support/**`, `lib/**`: depth ≤ 3, `.ts` but not `.steps.ts`; a feature is exactly `features/<fn>/<cap>.feature` (:238-251).
- No module beside a directory of the same name (:257-274).
- Feature title must equal the kebab-case path (`Plugin git source` for `plugin/git-source.feature`) (:312-326), and must have a description (:478-488).
- Tags only on Examples, only `@url`/`@github`; `source kind` column rules (:328-386).
- Steps: Given/When/Then only (no And/But), lower case outside quotes, no "should", no Given after When/Then, Background holds Givens only, scenario titles start upper case (:388-458).
- Every definition used, every step matches exactly one definition, every pattern a Cucumber expression (:121-198), over **all** rows (tag expression cleared, :104-119).
- Reserved verb module names are a convention, not checked by the script (no reserved list in check-features.mjs) [VERIFIED: no such list in the file].
- ESLint for `features/**` [VERIFIED: eslint.config.js:258-370]: step modules export nothing, step text is a string literal Cucumber expression, `Given/When/Then` imported by name, no hooks or parameter types in step modules; support modules register no steps; lib modules register nothing.

## Runtime State Inventory

Not a rename or refactor phase in the product sense; the only move is `plugin.steps.ts` → `plugin/*.steps.ts` inside `features/`.
- Stored data: none. Step text, not module paths, is what feature files reference (verified by reading the step registry).
- Live service config: none.
- OS-registered state: none.
- Secrets/env vars: none.
- Build artifacts: ESLint cache `node_modules/.cache/eslint/` keys by content; a moved file is re-linted. Nothing to migrate.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node | everything | ✓ | v26.12.1 local (CI Node 24) | — |
| git (with `http-backend`) | git host CGI, fixtures | ✓ | 2.56.0 | — |
| openssl | git host certificate | ✓ | 4.0.3 | — |
| `@earendil-works/pi-coding-agent` (dev) | headless Pi | ✓ | 1.0.0 | — |
| proper-lockfile | lock helper | ✓ | 4.1.2 | — |
| non-root user | none required (obstructions use EISDIR) | runs as uid 1000 | — | — |

The whole cucumber suite ran in ~15 s locally (433 scenarios, `parallel: 8`).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | `@cucumber/cucumber` 13 (behavioral), `node:test` for the rest |
| Config file | `cucumber.json` (`import` support + step globs, `order: random`, `parallel: 8`) |
| Quick run command | `npx cucumber-js features/plugin/<file>.feature` or `npx cucumber-js --name '<scenario title>'` |
| Usage/layout gate | `npm run check:features` |
| Full suite command | `npm run test:cucumber` (~15 s), then `npm run check` at the phase gate |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| FND-01 | Each Provides capability has a passing seed (Seed Map rows) | behavioral | `npx cucumber-js features/plugin/<seed file>.feature` per row | ❌ Wave 0: most seed files are new (`git-source`, `git-source-update`, `install-rollback`, `install-dependencies`, `partial-install`, `info`, `pending`, `reconcile`, `prune`, `import`, `bootstrap`, `help`, `plugin/state-lock`) |
| FND-01 | Session rows and info-cascade blocks must be compared | behavioral | `npm run test:cucumber` (the six existing scenarios + seeds) | ✅ existing files |
| FND-01 | Releases free the lock, arms, obstruction, second Pi | behavioral (After-hook assertions + `Before()` reset snapshot) | `npm run test:cucumber` (random order catches leaks) | ✅ |
| FND-02 | No unused/undefined/ambiguous steps, layout rules | static | `npm run check:features` | ✅ |
| FND-02 | Lint, types, dead code, dupes over `features/` | static | `npm run check:static` | ✅ |

### Sampling Rate
- **Per task commit:** `npx cucumber-js <touched feature files>` + `npm run check:features`; the hook runs `check:commit` for staged `.ts` under `features/`.
- **Per wave merge:** `npm run test:cucumber` + `npm run check:static`.
- **Phase gate:** `npm run check` green on the combined tree before `/gsd-verify-work`.

### Wave 0 Gaps
- [ ] New seed feature files listed above, each with a two-to-three-line description and the title rule.
- [ ] `features/lib` modules: lock holder, git plugin repositories, official marketplace, settings writer, shared result-row helpers (moved out of `command.steps.ts`, because session steps need `rowArrays` too).
- [ ] Run tokens for the project directory, the agent directory, and git revisions, documented in `.agents/skills/cucumber/rules/features.md`.

## Security Domain

Test-harness phase; no production attack surface is added. Applicable controls:

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no (stored-credential path already covered; Device Flow out of scope) | — |
| V5 Input Validation | yes (driver) | typebox `NOTIFICATION_PAYLOAD_SCHEMA` on every payload |
| V12 Files/Resources | yes | sandbox under the OS temp dir, outside the repository (`_rpc.ts:156-180`); the second Pi reuses the same check |
| V14 Config | yes | Pi child environment is an allowlist (`_rpc.ts:183-201`); no inherited provider credentials |

| Threat | STRIDE | Mitigation |
|--------|--------|-----------|
| A scenario touches the real HOME / `~/.pi/agent` / `~/.claude` | Tampering | Sandbox HOME + `PI_CODING_AGENT_DIR`; the settings-file step writes under `{home}` only |
| Network egress from a scenario | Information disclosure | Git host binds 127.0.0.1; GitHub base override points at it; `PI_OFFLINE=1` |
| Leaked lock child / Pi process after a failure | Denial of service (next scenario) | `onRelease` + exit-code assertion; Pi children run in their own process group (`killProcessGroup`) |

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| `startSession` returns skills only | read the session's entries with `get_entries` | reconcile reports become comparable |
| Git host serves `acme/*` only | any `owner/name` | official marketplace and plugin repositories |
| Arms live until `reset()` | `disarm()` + release | retry scenarios inside one scenario |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `reconcile-aborted` and `prune-committed-warning` need no seed because they carry no row arrays and the generic field steps compare them | Payload Kinds | The verifier reads criterion 2 as requiring a seed per kind, and a trigger must then be engineered |
| A2 | A revision token (for example `{revision N of "demo"}`) is preferred over deterministic commit dates | Pitfall 4 | The planner picks the other option; either works |
| A3 | The listed product inconsistencies are bugs rather than intended upstream-parity behavior | Seed Map note | Each owning phase must check Claude Code before fixing |
| A4 | The cucumber skill may be ported to an upstream blueprint (pending todo §3), so a milestone note linked from layout.md is less disruptive than editing rules inline | Skill amendment | Low; either satisfies CONTEXT |
| A5 | Editing the six existing scenarios (two in "untouched" files) is acceptable for Phase 1 | Pitfall 1 | If not, criterion 2 cannot be fully met for the existing session step |

## Open Questions

1. **The six existing scenarios with uncompared session reports**
   - Known: enforcing criterion 2 breaks them; two are in files the ROADMAP marks untouched.
   - Unclear: whether "untouched" was meant to stop Phase 1's own shared-support edits.
   - Recommendation: update them in the driver plan (one added comparison each) and note the deviation in the plan's SUMMARY. The "untouched" rule guards against parallel later phases, and Phase 1 runs alone.
2. **One `When` or two for sessions**
   - Recommendation: one step (`the user starts a new pi session`) that records payloads. A second step text with the same action would be a near-duplicate.
3. **Token names** (`{project}`, `{agent dir}`, revisions): discretionary; document them in features.md.

## Sources

### Primary (HIGH confidence)
- This tree: `features/**`, `scripts/check-features.mjs`, `cucumber.json`, `eslint.config.js`, `.fallowrc.json`, `package.json`, `extensions/pi-claude-marketplace/{transaction/with-state-guard.ts, persistence/locations.ts, shared/notification-wire.ts, shared/notification-json.ts, shared/notification-dispatch.ts, domain/source.ts, domain/clone-key.ts, domain/unsupported-components.ts, domain/dependencies.ts, orchestrators/plugin/{clone-cache,install-flow,install-outcome,uninstall,update-swap,bootstrap}.ts, orchestrators/import/{settings,marketplaces}.ts, orchestrators/reconcile/apply.ts, index.ts}`, `test/e2e/_rpc.ts`.
- Installed Pi 1.0.0: `dist/modes/rpc/rpc-mode.js`, `dist/core/agent-session.js`, `dist/core/agent-session-runtime.js`.
- Installed proper-lockfile 4.1.2: `index.js`, `lib/lockfile.js`.
- Sandbox runs of the real extension (e1-e10 scratch scripts) and an instrumented copy of the full suite (433/433 passing).

### Secondary / Tertiary
- None. No web sources were needed; the phase depends only on this repository and its installed dependencies.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH. No new packages; versions read from package.json and node_modules.
- Architecture: HIGH. Each mechanism was prototyped (lock child, `get_entries`, second Pi, git kinds, official marketplace, obstructions).
- Pitfalls: HIGH for the measured ones (session double pass, paths, hashes, fallow); MEDIUM for how later phases choose to resolve the product inconsistencies.

**Research date:** 2026-10-22
**Valid until:** 2026-11-21, or until the `@earendil-works/pi-coding-agent` dev dependency changes: the session double-bind and subscription order are Pi internals.
