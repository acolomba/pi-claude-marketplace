# Phase 1: Companion Floors and MCP Defaults - Research

**Researched:** 2026-11-11
**Domain:** companion-extension floors (pi-subagents, pi-mcp-adapter), adapter tool naming, MCP timeout defaults
**Confidence:** MEDIUM -- the code and the companion sources were read; no Pi session and no suite ran against the new versions.

How to read the tags: `[VERIFIED: path:lines]` means I opened that file this session and the quoted values come from it. `[DERIVED]` means I worked the result out from source I read, and nothing ran. `[UNMEASURED]` means only a run can settle it, and the plan must make that run. `[ASSUMED]` means training knowledge or a judgment call.

`PS88/` = pi-subagents 0.88.0, `PS84/` = pi-subagents 0.84.0, `AD701/` = pi-mcp-adapter 7.0.1, `AD700/` = pi-mcp-adapter 7.0.0, all unpacked from `npm pack` tarballs outside the repository. `EXT/` = `extensions/pi-claude-marketplace/`.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Companion floors (D-PG1-01 to D-PG1-03)

- **D-PG1-01 -- peer ranges.** `pi-subagents` is `>=0.87.0` with no upper bound, as today. `pi-mcp-adapter` is `>=7.0.1 <8`. These are decisions 2 and 3 of the PRD's section 5.1 in today's range form.
- **D-PG1-02 -- the suites run pi-subagents 0.88.0, not the declared floor (the user's change).** The declared floor stays 0.87.0, and `scripts/install-test-peers.mjs` installs pi-subagents 0.88.0, the milestone baseline. This amends PIFL-02 for pi-subagents only: pi-mcp-adapter (7.0.1) and pi-dynamic-workflows (3.15.0) still install the lowest version their range admits. It also amends the wording of the roadmap's success criterion 1 for this phase: the suites install and run pi-subagents 0.88.0 and pi-mcp-adapter 7.0.1. The planner records the amendment in `PROJECT.md` with its consequence: no suite proves that 0.87.0 works, so the 0.87.0 floor rests on the pi-subagents changelog and source (decision 2's premise). The script's header comment and `--before` cap follow the new rule.
- **D-PG1-03 -- the foreground-refusal scenarios stay.** Both scenarios in `features/mcp-server/agent-grants.feature` ("A foreground run of an agent granted a plugin MCP tool is refused before the child runs", for each implementation) are kept and pinned to the text that the installed pi-subagents (0.88.0) prints, measured in this phase. If that version no longer refuses the run, the scenario pins what it does instead, and the D-CF6-10 text in `docs/mcp-compatibility.md` is corrected to match. A call of the tool by a real background child stays a live check (BACKLOG AGTASYNC-01), and the phase says how it was checked.

#### Mapped model IDs (D-PG1-04 to D-PG1-06)

- **D-PG1-04 -- `--map-model` writes a bare ID.** Every alias of `MODEL_MAP` and a `claude-*` passthrough ID are written with no provider prefix, such as `model: claude-sonnet-5-5`.
- **D-PG1-05 -- installed agents change at the next `update --map-model`.** An agent file that holds `anthropic/claude-...` keeps it until then; `reinstall` has no `--map-model` flag. Nothing rewrites the file at load (APL-D1). The CHANGELOG entry says so.
- **D-PG1-06 -- the alias table is unchanged.** `fable` and `best` stay `claude-fable-5-1`. Bringing the table to 2.1.322 is AGENT-06 (P2, not scheduled).

#### Long tool names under the adapter (D-PG1-07 to D-PG1-10)

- **D-PG1-07 -- one rule, in the adapter profile.** The 64-character rule of pi-mcp-adapter 7.0.1 (the first 55 characters, `_`, and the first 8 hexadecimal digits of the SHA-256 of the full joined name) lives in one function of the adapter profile in `domain/mcp-implementation.ts`. The listing, the hooks bridge, and the agents bridge call it.
- **D-PG1-08 -- a hook receives the full Claude Code name whenever the bridge can recover it.** A matcher written with the full Claude Code name matches the shortened tool, and the hook receives the full name. For a matcher that is not the full name (`*`, a server prefix), the research measures what adapter 7.0.1 exposes about a shortened tool (for example the original tool name in Pi's tool list or in the tool result), and the bridge sends the full name when it can build it. Where it cannot, the hook gets the shortened name, and `docs/mcp-compatibility.md` records that as a pi-mcp-adapter capability gap.
- **D-PG1-09 -- a test holds the rule against the installed adapter.** A test calls the installed adapter's own naming function at the floor and compares it with the project's function, over names of 64, 65, and 84 characters and a name with a `.`. An adapter release that changes the rule then fails the suite.
- **D-PG1-10 -- every adapter tool name the agents bridge writes uses the rule.** That covers `excludeTools` and a granted tool name.

#### Default MCP timeouts (D-PG1-11 to D-PG1-14)

- **D-PG1-11 -- precedence under the adapter.** The plugin's declared `timeout` wins, then a `requestTimeoutMs` the user wrote on the entry, then the default: 1,800,000 ms for a stdio server and 300,000 ms for a remote server. ANAME-07 is amended only by the default; a carried field the plugin sets is still the plugin's.
- **D-PG1-12 -- installed plugins.** Under the adapter, the entry in `mcp-adapter.json` gets the default at the next `update` or `reinstall`. Under Pi's built-in MCP, the registration gets it at the next session start, because the registration is built from the record each time. The built-in is not held back to match the adapter.
- **D-PG1-13 -- a default the project wrote stays the project's.** A later restage recomputes it, so a server that changes from stdio to remote gets 5 minutes. A value the user changed on the entry is kept. The entry's marker has to tell the two apart; how is the planner's choice.
- **D-PG1-14 -- no slow scenario in the suite.** Scenarios pin the registered configuration under both profiles: 30 minutes for a stdio server with no declared `timeout`, 5 minutes for a remote server, and under the adapter a user-written timeout that is still there after an update. The phase runs a call that stays silent for more than 60 seconds once under each implementation and records the result in the verification report.

### Claude's Discretion

- How the marker of an adapter entry records a default the project wrote (D-PG1-13).
- How the hooks bridge recovers the full name of a shortened tool, within D-PG1-08.
- The fixture plugin and stub server for the long-name scenarios, and whether the adapter twin of the long-name scenario in `features/mcp-server/listing.feature` reuses the existing fixture.
- The wording of the corrected documentation lines and of the CHANGELOG entry (the `changelog` and `readme` skills apply; `README.es.md` changes with `README.md`).
- Whether the remote default mentions Claude Code's 60-second first-byte timer in `docs/mcp-compatibility.md` (it has no Pi equivalent; the PRD names it as the reason for Medium confidence).

### Deferred Ideas (OUT OF SCOPE)

- AGENT-06: bring the `--map-model` alias table to Claude Code 2.1.322 (P2).
- Reading `MCP_TOOL_TIMEOUT` and `CLAUDE_CODE_MCP_TOOL_IDLE_TIMEOUT` (out of scope in REQUIREMENTS.md).
- A session-start rewrite of the `anthropic/` prefix in installed agent files (rejected for this phase, D-PG1-05).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PG-AGENT-02 | The declared pi-subagents floor is 0.87.0 in `package.json`, the README, and `scripts/install-test-peers.mjs`, and the documentation no longer describes the two fixed pi-subagents bugs as open. Lands with PG-AGENT-07b. | "Floor inventory", "What moves when the suites run 0.88.0 and 7.0.1", "Refusal text under 0.88.0", "Documentation and records" |
| PG-AGENT-07b | A model ID that `--map-model` writes has no provider prefix. | "Mapped model IDs", pitfalls 3 and 4 |
| PG-MCP-02 | The declared pi-mcp-adapter floor is 7.0.1. Under the adapter, a plugin tool whose Claude Code name is longer than 64 characters works everywhere the project names it. | "The adapter 7.0.1 naming rule", "What the adapter exposes about a shortened tool", "Agents bridge", pitfalls 5 to 8 |
| PG-MCP-01 | A plugin MCP server with no `timeout` gets 30 minutes (stdio) or 5 minutes (remote) under both implementations; under the adapter a user-written timeout still wins. | "Default timeouts", "Marker design", pitfalls 9 to 11 |
</phase_requirements>

## Summary

The phase has four parts, and the first one gates the rest. Raising the floors is a small edit in six files, but three places compute "the version the suites must run" as `semver.minVersion` of the declared range, and each one refuses any other version. D-PG1-02 breaks that identity for pi-subagents, so the three places need one shared source for the suite version. After the cache holds pi-subagents 0.88.0 and pi-mcp-adapter 7.0.1, the suites will show breaks that only a run can list in full. From source I expect three: the adapter foreground-refusal scenario (pi-subagents 0.87.0 fixed the bug whose error text it pins), the agent list projection (0.85.0 added an "unavailable" marker to a model pin, and the harness has no such model), and the adapter drift guards (three of the adapter modules they pin changed in 7.0.1).

The adapter's naming rule is three small functions in `AD701/types.ts:963-1003`, and `formatToolName` is a public export of `dist/types.js`, which the integration tests already load. A standalone copy of the rule reproduced the name that spike S3 recorded. The hard part of PG-MCP-02 is the hooks bridge: Pi's tool list does not carry the original tool name of an adapter tool, and the adapter's tool result carries it only on success. So the bridge can always match a full-name matcher (it shortens the matcher and compares), can rebuild the full name for `PostToolUse` from the result details, and cannot rebuild it for `PreToolUse` or `PostToolUseFailure` unless a matcher or `if` literal of the same event spells it. One finding goes beyond the PRD: pi-subagents 0.88.0 has its own copy of the adapter's naming code, and that copy has no 64-character cut. By source, an agent whose grant covers a tool with a name over 64 characters fails to launch. That is a pi-subagents gap that this phase can measure and record, not close.

The timeout default is best split: the domain layer names the default for a server type, the built-in translation applies it directly, and the adapter entry builder applies it last, after the plugin's value and the user's carried value. The marker needs the value of the default it wrote, not only the field name, because D-PG1-13 asks that a value the user changed on the entry survives. The change touches the text of every staged adapter entry and every registered built-in config that has no declared timeout, so many unit tests and a few scenarios change their expected text.

**Primary recommendation:** Plan the floor move as the first wave, and make its last task a full `npm run check` whose failures are the measured list of breaks. Do not write the expected text of the refusal scenario, the agent list rows, or the drift guards before that run.

## Project Constraints (from CLAUDE.md)

Directives from `AGENTS.md` and its linked files that bind this phase:

- **Upstream parity** with Claude Code 2.1.322 is the default. A divergence needs a recorded decision ID or a Pi capability gap, and the scenario names it. Re-check the upstream contract with `.agents/skills/claude-code-compat-research` before a scenario pins it.
- **Behavioral tests:** a change a user can see ships with a cucumber scenario under `features/` that fails without it. Unit tests and direct coverage do not replace it.
- **Quality bar:** `npm run check` stays green: typecheck, ESLint (`--max-warnings 0`), fallow, Prettier, source/test pairing, `check:features`, unit, integration, cucumber under both profiles, and 100% direct coverage for every source-test pair.
- **Two complexity gates:** ESLint `sonarjs/cognitive-complexity` 15 and fallow `maxCognitive` 15 / `maxCyclomatic` 20. Both must pass. `dispatch.ts` and `adapter-entry.ts` already hold dense functions; add small functions, not branches.
- **Atomic writes (NFR-1), no restart (NFR-2), idempotent (NFR-3):** the marker change must restage to the same bytes on a second run.
- **APL-D1:** a load changes no installation state. The default timeout must not be written to `mcp-adapter.json` at load, with one existing exception path noted in pitfall 10 (the AMIG-01 legacy move restages).
- **PIFL-03:** the three companions are never a `dependencies` or `devDependencies` entry and never a lockfile package. `test/architecture/peer-floor.test.ts:150-166` enforces it.
- **Output channel, no telemetry, English only:** unchanged by this phase.
- **Git:** never commit to `main`; branch is `features/gaps`. No `--no-verify`. No rebase.
- **GSD records:** every plan `SUMMARY.md` has a `## Threat Flags` section. Prefix `windows append --description` with `[parity-gaps]`.
- **Versioning:** offer a version bump before the PR; record changes in `CHANGELOG.md` with the `changelog` skill. `README.es.md` changes with `README.md` (`readme` skill).
- **Comments:** cite decision and requirement IDs (D-PG1-07, PG-MCP-02), never phase or plan numbers. Default to no comment on trivial code.
- **Tests:** `node:test`, `node:assert/strict`, `strong-mock`; hermetic home through `test/platform/isolated-pi-home.ts`; no test may touch the real `~/.pi`.
- **Gates carry no planted-violation tests.** A gate's run over the real tree is its only committed proof.
- **Dependency injection over test-only seams.**

## Architectural Responsibility Map

This is a Pi extension, not a web application. The tiers below are the project's own layers.

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Declared floors | `package.json`, `package-lock.json` root | README, docs | The range is the contract; every other place quotes it |
| Suite companion versions | `scripts/install-test-peers.mjs` | `test/integration/optional-peer.ts`, `features/lib/companions.ts` | One installs, two verify what the cache holds |
| Mapped model ID | `EXT/bridges/agents/convert.ts` (`MODEL_MAP`, `fullModelId`) | -- | The bridge writes the agent file; pi-subagents resolves the ID |
| Adapter tool naming rule | `EXT/domain/mcp-implementation.ts` (adapter profile) | -- | D-PG1-07 locks it there |
| Hook matching and the name a hook receives | `EXT/domain/components/hooks/builtin-mcp-tool-names.ts`, `EXT/bridges/hooks/mcp-tool-view.ts`, `EXT/bridges/hooks/dispatch.ts` | `EXT/bridges/hooks/if-field/index.ts` | Matching is a domain function; the view and the dispatcher read Pi's event |
| Agent `excludeTools` name | `EXT/bridges/agents/convert.ts` (`excludeNameFor`) | -- | Calls the profile's `toolName` |
| Default timeout value per server type | `EXT/domain/mcp-server-features.ts` | -- | The closed table owns Claude's server types |
| Default under Pi's built-in MCP | `EXT/domain/mcp-builtin-translation.ts` | `EXT/bridges/mcp/builtin-entry.ts` | Translation is pure; the registration is rebuilt each session |
| Default under the adapter, and its precedence | `EXT/bridges/mcp/adapter-entry.ts` (`stampServers`, `carriedFields`) | `EXT/bridges/mcp/marker.ts` | Only the entry builder sees the plugin value, the user's carried value, and the marker together |

## Standard Stack

No new library. The phase changes the versions of two existing optional peers in the test cache.

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `pi-subagents` | declared `>=0.87.0`; suites run 0.88.0 (published 2026-11-10T21:14:14Z) | serves bridged agents | D-PG1-01, D-PG1-02 |
| `pi-mcp-adapter` | declared `>=7.0.1 <8`; suites run 7.0.1 (published 2026-11-04T05:43:33Z) | serves plugin MCP servers | D-PG1-01 |
| `@quintinshaw/pi-dynamic-workflows` | `>=3.15.0 <4`; suites run 3.15.0 | unchanged | not in this phase |
| `semver` | `^7.8.5` (already a dependency) | `minVersion`, and `satisfies` for the suite-version check | already used by all three floor readers |
| `node:crypto` `createHash` | Node built-in | the 8-hex SHA-256 | `EXT/domain/mcp-implementation.ts` already imports it |

Publish times are from `npm view <pkg> time --json`, run this session. [VERIFIED: npm registry]

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| A shared JSON for the suite version | A constant repeated in the three readers | Three copies can drift; nothing ties them together |
| Value in the marker (`defaultFields`) | The field name in `pluginSetFields` | The name alone cannot tell a default from a value the user changed on the entry (D-PG1-13) |
| Reading the adapter's `mcp-cache.json` to recover a tool's original name | Matcher literals plus result details | The cache file has no published contract, misses session-only listings, and adds a file read to the `tool_call` path |

**Installation:** none in `package.json`. `scripts/install-test-peers.mjs` fills `node_modules/.cache/optional-peers` on the next `npm run test:integration` or `npm run test:cucumber`.

## Package Legitimacy Audit

`node .claude/gsd-core/bin/gsd-tools.cjs query package-legitimacy check --ecosystem npm pi-subagents pi-mcp-adapter` ran this session.

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| `pi-subagents` | npm | newest release 1 day old (0.88.0) | 199,510/wk | github.com/nicobailon/pi-subagents | `[SUS]` reason `too-new` | Flagged. Already a declared optional peer of this project; the version is the user's locked choice (D-PG1-02) |
| `pi-mcp-adapter` | npm | newest release 7 days old (7.0.1) | 529,150/wk | github.com/nicobailon/pi-mcp-adapter | `[SUS]` reason `too-new` | Flagged. Already a declared optional peer; the version is the user's locked choice (D-PG1-01) |

**Packages removed due to [SLOP] verdict:** none.
**Packages flagged as suspicious [SUS]:** `pi-subagents` [WARNING: flagged as suspicious -- verify before using.], `pi-mcp-adapter` [WARNING: flagged as suspicious -- verify before using.]. The only reason is the age of the newest release. The protocol asks the planner for a `checkpoint:human-verify` before the install. The user named both versions in D-PG1-01 and D-PG1-02; whether that record satisfies the checkpoint is the planner's call, not mine.

Neither package has a `postinstall` script (`npm view <pkg>@<version> scripts.postinstall` printed nothing, and neither unpacked `package.json` has an install or prepare script). The install script passes `--ignore-scripts` and checks the registry `integrity` hash of every package (`scripts/install-test-peers.mjs:129`, `:112-122`). `dist.shasum`: pi-mcp-adapter 7.0.1 `f4805933bce4c6d2bd732b146a320780e91ed9b8`, pi-subagents 0.88.0 `0b44d0f35a9f8da8033451a5677b4cfff3a53194`. [VERIFIED: npm registry]

## Findings by Question

### 1. Floor inventory (D-PG1-01, D-PG1-02)

**Files that declare or quote a floor and must change:**

| File | Line | Today | Change |
|------|------|-------|--------|
| `package.json` | 66-67 | `"pi-mcp-adapter": ">=7.0.0 <8"`, `"pi-subagents": ">=0.84.0"` [VERIFIED: package.json:62-69] | `>=7.0.1 <8`, `>=0.87.0` |
| `package-lock.json` | root `packages[""].peerDependencies` | mirrors the two ranges | regenerate; `peer-floor.test.ts:105` and `:132` compare it with `package.json` |
| `test/architecture/peer-floor.test.ts` | 94, 104, 109, 118, 131 | test titles and `assert.equal(pkgRange, ">=0.84.0")`, `">=7.0.0 <8"` | new ranges in titles and assertions |
| `test/bridges/mcp/adapter-entry.test.ts` | 1358 | `">=7.0.0 <8"` (AFILE-06 guard), comments at 14, 57, 1332 cite `pi-mcp-adapter@7.0.0 ... dist.shasum d5b65ef...` | new range; refresh the cited version and shasum. `ServerEntry` and `OAuthConfig` are byte-identical in 7.0.0 and 7.0.1, at the same lines (`types.ts:397`, `:438`) [VERIFIED: diff of AD700 and AD701] so `SERVER_ENTRY_KEYS` and `OAUTH_CONFIG_KEYS` need no change |
| `README.md`, `README.es.md` | 39-40 | "0.84.0 or newer", "7.0.0 or a later 7.x release" | 0.87.0, 7.0.1 in both languages |
| `scripts/install-test-peers.mjs` | 1-16, 36-52 | header says "Each peer is the lowest version that its ... range admits (PIFL-02)" | see "The install script" below |
| `scripts/pi.sh` | 117-118 | pins `pi-mcp-adapter@7.0.0`, `pi-subagents@0.84.0`; the comment at 108-110 says "Each pin is the floor that package.json declares" (PIFL-07) | 7.0.1; for pi-subagents the planner chooses 0.88.0 (what the suites prove) or 0.87.0 (the floor). I recommend 0.88.0 and a reworded comment [ASSUMED] |
| `CONTRIBUTING.md` | 71 | "installs the optional peers ... at the lowest versions that `package.json` allows" | reword for pi-subagents |
| `.github/workflows/ci.yml` | 112-115, 163-164 | comments: "at the floors that package.json declares", "at their declared floors" | reword |
| `.planning/codebase/STACK.md` | 35-36 | `>=0.84.0`, `>=7.0.0 <8`, "install its declared floor" | new ranges; reword for pi-subagents |
| `docs/mcp-compatibility.md` | 9, 15, 381, 387, 592, 647 and 25 more lines that say "pi-mcp-adapter 7.0.0" or "pi-subagents 0.84.0" | measured-on statements | see "Documentation and records" |
| `test/live-uat/mcp-adapter-canary.mjs` | 15, 57, 59, 120 (`const ADAPTER_VERSION = "7.0.0"`) | the operator-run canary refuses any other adapter version | 7.0.1, with `test/live-uat/README.md:11, 487-519` |
| `features/mcp-server/agent-grants.feature` | 7 | "pi-subagents 0.84.0 refuses a foreground agent its MCP tools" | feature description; reword after the measurement |
| `.agents/skills/cucumber/rules/world-and-stand-ins.md` | 52, 62 | "checks its version against the declared floor"; "pi-subagents 0.84.0 lists the agents of an untrusted project" | reword; re-check the second claim on 0.88.0 [UNMEASURED] |
| Source comments | `EXT/domain/mcp-implementation.ts:68`, `EXT/bridges/agents/convert.ts:1077`, `EXT/bridges/agents/grant-forms.ts:19`, `EXT/platform/subagent-child.ts:14`, `EXT/platform/mcp-status.ts:45`, `EXT/bridges/mcp/adapter-doc.ts:4,19`, `EXT/bridges/mcp/adapter-escape.ts:5`, `features/step_definitions/mcp-server/agent-grants.steps.ts:16,103`, `test/domain/mcp-implementation.test.ts:56`, `test/integration/mcp-override-lifecycle.test.ts:333,466,852` | version in a "checked against" comment | change only the comments whose statement this phase re-checks (`mcp-implementation.ts:68` for certain). Do not sweep the rest: AGENTS.md asks for surgical changes |

Not a floor: `CHANGELOG.md:65-66` (history of 0.22.0), `test/orchestrators/**` lines with `"7.0.0"` (plugin fixture versions), `docs/env-vars.md:173` (a dated re-read).

**The install script** [VERIFIED: scripts/install-test-peers.mjs:1-198]:

- `readFloors()` (36-52) maps each of `peerNames` to `semver.minVersion(range).version`.
- `readCutoff()` (104-107) takes the newest registry publish time of those versions, and `installInto()` passes it as `--before=<cutoff>` (136), with `--ignore-scripts --omit=peer --no-save --no-package-lock`.
- `holdsFloors()` (58-75) decides whether the cache is current: each cached `package.json` must have exactly the computed version.

**Three places hold the identity "cached version == minVersion(range)":**

1. `scripts/install-test-peers.mjs:45-50`.
2. `test/integration/optional-peer.ts:86-95` and `:102-121`: `findCachedPeer` throws "holds ... not the declared floor" when `peer.version !== floor`.
3. `features/lib/companions.ts:87-98` and `:124-129`: `resolveCompanion` throws "not the floor". Its header says `features/` may not import `test/integration/optional-peer.ts`, which is why the check is repeated.

**Smallest change that satisfies D-PG1-02:** one data file that names the suite version of a peer when it is not the floor, read by all three. For example `{ "pi-subagents": "0.88.0" }`. Each reader uses the file's version when the peer has an entry, and `minVersion(range)` otherwise. Rules the file must meet:

- It must be a build input. The `npm-check` hook's `files` pattern in `.pre-commit-config.yaml:112` matches `(extensions|features|rule-packs|test|\.github/workflows)/.*` and `scripts/.*\.mjs`. The `prettier` hook's pattern at `:106` matches `(extensions|features|rule-packs|test)/.*\.(js|json|ts)` and `scripts/.*\.mjs`. A `.json` under `scripts/` matches neither, so put the file under `test/` or change the hook patterns and the `paths` list in `ci.yml` together (`.agents/skills/local-verification/SKILL.md`).
- A gate test should hold it: the named version satisfies the declared range (`semver.satisfies`), and no entry exists for the two peers that keep PIFL-02. `test/architecture/peer-floor.test.ts` is the home. Architecture tests read paths through `test/architecture/gate-targets.ts` (`PACKAGE_JSON_REL`), so register the new path there.
- `--before`: the cutoff becomes the publish time of pi-subagents 0.88.0, `2026-11-10T21:14:14.787Z`, which is later than today's cutoff (0.84.0, `2026-10-29T05:33:28.731Z`). The specs are exact versions, so only the peers' own dependency ranges resolve later. `@quintinshaw/pi-dynamic-workflows` 3.15.1 was published at `2026-11-10T15:15:54.944Z`, before the new cutoff, but the spec is the exact `@3.15.0`, so it cannot enter. The header comment's "the newest floor's registry publish time" becomes "the newest installed peer's".

### 2. What moves when the suites run pi-subagents 0.88.0 and pi-mcp-adapter 7.0.1

Nothing ran. Each row is from the changelog or the source, and the first full run after the floor move is the measurement.

| Area | Evidence | Expected effect |
|------|----------|-----------------|
| Adapter foreground refusal (`agent-grants.feature:280`) | PS88 CHANGELOG 0.87.0: "`mcp:` selectors now resolve for pi-mcp-adapter servers that set `directTools: \"search\"`" | The pinned row changes. See question 3 |
| Agent list with capabilities (`features/agent/frontmatter.feature:109-143`) | PS88 CHANGELOG 0.85.0: "`list` with `capabilities: true` and the `models` action now mark an agent's model pin that the session's model registry can't resolve with \"(unavailable in the active model registry)\""; `PS88/src/agents/agent-management.js:770` `UNAVAILABLE_MODEL_MARKER` | The harness has only the `faux` provider, so every mapped model is unresolvable and gets the marker. `features/lib/upstream/subagents.ts` must drop the marker (it is pi-subagents' own wording), or the row will read `model claude-sonnet-5-5 (unavailable in the active model registry)` [DERIVED] |
| List cap | PS88 CHANGELOG 0.88.0: "`{ action: \"list\" }` now shows at most 30 agents and points to `options.search` for the rest"; `agent-management.js:1056-1058` | No scenario lists more than about 10 agents, so no cap is hit. The list text may gain a hint line only when agents are omitted [DERIVED] |
| Mapped model run (`frontmatter.feature:171-199`) | PS88 `model-resolution.js`: a bare ID that the registry cannot resolve throws `Unknown subagent model '<id>' in the active Pi model registry.` | Still a failed run, but the error names a bare ID. `OWNED_ERROR_VALUE_PATTERN` in `features/lib/upstream/subagents.ts:63` matches only `<provider>/claude-...`, so it must also match a bare `claude-...` ID [DERIVED] |
| Strict `provider/id` | PS88 CHANGELOG 0.87.0: "A subagent model written as `provider/id` now always runs on that provider" | The reason for PG-AGENT-07b |
| `pi -p` waiting | PS88 CHANGELOG 0.88.0: a non-interactive session waits for background work for `timeoutMs`, else 30 minutes | Only a json-mode Pi that loads pi-subagents and starts a background child is affected. I found no such scenario [ASSUMED] |
| `subagent_launch` nested call | PS88 CHANGELOG 0.85.0: before a pi-subagents workflow starts a child it makes a nested `subagent_launch` tool call | Affects pi-subagents workflows only, not pi-dynamic-workflows. A hook scenario with a `*` matcher over such a run would see one more tool. I found none [ASSUMED] |
| pi-subagents frontmatter and skills modules | `PS88/src/agents/frontmatter.js` and `skills.js` both differ from 0.84.0 | `test/integration/provenance-invisibility.test.ts` and `skill-path-resolution.test.ts` load them; outcome [UNMEASURED] |
| Adapter drift guards | `utils.ts`, `mcp-auth-flow.ts`, and `server-manager.ts` differ between 7.0.0 and 7.0.1; `config.ts` does not [VERIFIED: diff -q] | `test/integration/adapter-expansion-conformance.test.ts` pins text of `dist/server-manager.js`, `utils.js`, `mcp-auth-flow.js`, `types.d.ts` through `readPiMcpAdapterDist`. A pin may fail; outcome [UNMEASURED] |
| Adapter `mcp` action errors | AD701 CHANGELOG: "An `mcp` call with an `action` the adapter doesn't know ... now returns an error" | A scenario that sends a mistyped action would change. I found none [ASSUMED] |
| Adapter long names | AD701 CHANGELOG, quoted under question 5 | New behavior this phase models |

### 3. Refusal text under pi-subagents 0.88.0 (D-PG1-03)

What the scenarios pin today is a projection, not the text: `features/lib/upstream/subagents.ts:247-250` reduces a failed result to `error` or `error naming <values>`, and the feature rows are `subagent failed: error naming plugin_demo_stub_/echo` (`agent-grants.feature:304`) and `subagent failed: error naming plugin_demo_stub` (`:334`). The verbatim texts live in `docs/mcp-compatibility.md:384` and `:390`.

**Adapter scenario (`:280`).** [DERIVED]

- 0.84.0 threw `Unresolved MCP direct-tool selectors: plugin_demo_stub_/echo. Direct MCP tools require a matching configured server and fresh metadata cache; runtime-registered servers require a host/pi-mcp-adapter handoff before child launch.` because it dropped a `directTools: "search"` server from the config.
- 0.88.0 accepts `"search"` (`PS88/src/runs/shared/mcp-config-sources.js:36`). The scenario waits for the adapter's listing, so the metadata cache should be valid and the selector should resolve. The same message text still exists at `PS88/src/runs/shared/mcp-direct-tool-grant.js:89` for a selector that does not resolve.
- When it resolves, `PS88/src/runs/shared/child-tool-plan.js:265-273` puts the tool in the child's required tools, and the child's `agent_start` handler (`subagent-prompt-runtime.js:689-695`) throws when a required tool is missing. A foreground child loads no ambient extension, so the adapter's tool is missing. The text comes from `PS88/src/runs/shared/tool-availability.js:9-18`:

```text
Agent 'demo:runner' ran as a foreground child, which never loads the parent's ambient extensions, and these child tools were unavailable: mcp__plugin_demo_stub__echo.
The `tools` field is a strict allowlist; it does not load extension code.
MCP direct tools missing from the child registry: mcp__plugin_demo_stub__echo.
MCP tools require background children (`async: true`) because only they load ambient extensions.
For extension tools a foreground child can load, add the provider path to `subagentOnlyExtensions` (child-only), `extensions`, or as a path-like entry in `tools`, while keeping each registered tool name in `tools`.
```

- Two consequences if that is what runs. The run is no longer "refused before the child runs": the child session starts and fails at its first agent start, so the scenario title changes. And the projection finds no owned value, because the text names `mcp__plugin_demo_stub__echo` and the pattern needs `plugin_..._/tool` after a space, `(`, `:`, or `,`. The row would read `subagent failed: error`. The planner should extend the projection so the row still names the tool; a row that reads only `error` lets a wrong implementation pass.
- Which of the two texts appears depends on the cache hash that pi-subagents computes for the entry matching the adapter's. Only the run settles it. [UNMEASURED]

**Built-in scenario (`:312`).** `PS88/src/runs/shared/child-launch.js:109-114` still throws before the child is built:

```text
Agent '<agent>' selects MCP tools from servers that extensions registered (<servers>). Only background children (async: true) load those extensions; run the agent in the background or add the server to the global mcp.json or a trusted project's .pi/mcp.json.
```

That matches `docs/mcp-compatibility.md:390` word for word, so I expect no change to that scenario or that doc line. [DERIVED]

**The live check.** A real background child that calls the tool cannot run in the harness (BACKLOG AGTASYNC-01: the detached runner's `JITI_ALIAS` breaks the scripted model's import). The phase states how it was checked: by hand with `scripts/pi.sh` and a real model, or not at all, recorded as such.

### 4. Mapped model IDs (PG-AGENT-07b, D-PG1-04 to D-PG1-06)

**Writers** [VERIFIED: EXT/bridges/agents/convert.ts:60-67]:

```ts
const MODEL_MAP: ReadonlyMap<string, string> = new Map([
  ["sonnet", "anthropic/claude-sonnet-5-5"],
  ["opusplan", "anthropic/claude-sonnet-5-5"],
  ["opus", "anthropic/claude-opus-5-5"],
  ["haiku", "anthropic/claude-haiku-5-5"],
  ["fable", "anthropic/claude-fable-5-1"],
  ["best", "anthropic/claude-fable-5-1"],
]);
```

and the passthrough at `convert.ts:345-347`: ``return value.startsWith("claude-") && !/[\s:]/.test(value) ? `anthropic/${value}` : undefined;``. Both lose the `anthropic/` prefix. D-PG1-06 keeps the six IDs as they are.

**Places that assert the prefix:**

| File | Lines | What |
|------|-------|------|
| `test/bridges/agents/convert.test.ts` | 17 occurrences | mapping cases |
| `test/bridges/agents/stage.test.ts` | 520, 1490 | staged file text |
| `test/edge/handlers/plugin/install.test.ts` | 348 | `const MAPPED_MODEL = "anthropic/claude-sonnet-5-5"` |
| `test/edge/handlers/plugin/update.test.ts` | 472 | the same constant |
| `features/agent/frontmatter.feature` | 143 | the list row, one `model anthropic/claude-...` per agent |
| `features/agent/frontmatter.feature` | 171, 199 | scenario "A run of an agent whose model --map-model mapped reports the model pi does not know" and its row `subagent failed: error naming anthropic/claude-sonnet-5-5` |
| `features/lib/upstream/subagents.ts` | 63-64 | `OWNED_ERROR_VALUE_PATTERN` needs a provider prefix |
| `README.md`, `README.es.md` | 378 | "for example `anthropic/claude-sonnet-5-5`" |

Not affected: `test/bridges/agents/frontmatter.test.ts:737-807` and `test/integration/provenance-invisibility.test.ts:49,128` pass `anthropic/claude-sonnet-4-6` as an opaque frontmatter value; they do not go through `mapModel`.

**How pi-subagents 0.88.0 resolves a bare ID** (`PS88/src/runs/shared/model-resolution.js`):

- `splitQualifiedModelQuery` treats the text before a `/` as a provider only when it is a registered provider. A bare ID has no provider part.
- `resolveExactIdMatches(baseModel, availableModels, preferredProvider)`: among models whose `id` equals the text, the one on `preferredProvider` wins; otherwise a single match wins.
- `fuzzyResolveModel` then compares after turning `.` and `_` into `-`, lower-casing, and dropping a trailing date stamp, again preferring `preferredProvider`. So `claude-sonnet-5-5` matches a registry `claude-sonnet-5.5`.
- A `provider/id` whose provider is known matches only inside that provider: "this never silently switches providers".
- An agent's configured model that resolves to nothing throws `Unknown subagent model '<model>' in the active Pi model registry.` with optional "Did you mean" and "Closest registry models" parts (`resolveRequiredSubagentModelCandidate`).

Whether `preferredProvider` is the session's provider at every call site was not traced through the callers. The PRD's subagents report states it ("bare IDs prefer the session provider", `docs/research/parity-gaps/subagents.md` P10). [CITED: docs/research/parity-gaps/subagents.md]

**A stronger scenario is possible.** Success criterion 2 needs only the list row `model claude-sonnet-5-5`. To prove "runs on the session's provider when that provider has the model", the scripted model extension (`features/lib/scripted-model/extension.ts:287-293`, `pi.registerProvider(faux.provider, { models: ... })`) would need a second model whose `id` is a mapped ID. That is a harness change; the planner decides if the proof is worth it. [ASSUMED]

### 5. Long tool names under the adapter (PG-MCP-02, D-PG1-07 to D-PG1-10)

#### The adapter 7.0.1 naming rule

[VERIFIED: AD701/types.ts:963-1003], quoted:

```ts
export const MAX_TOOL_NAME_LENGTH = 64;

export function hashedToolName(name: string, hashInput: string): string {
  const hash = createHash("sha256").update(hashInput).digest("hex").slice(0, 8);
  return `${name.slice(0, MAX_TOOL_NAME_LENGTH - hash.length - 1)}_${hash}`;
}

export function joinToolName(toolName: string, serverName: string, prefix: ToolPrefix): string {
  const p = getServerPrefix(serverName, prefix);
  const sanitized = toolName.replace(/\./g, "_");
  if (p && sanitized.startsWith(`${p}_`) && sanitized.length > p.length + 1) {
    return sanitized;
  }
  return p ? `${p}_${sanitized}` : sanitized;
}

// The hash covers the whole joined name, so two tools get the same shortened name only when their
// full names were already equal, which the collision checks already handle.
function fitToolName(name: string): string {
  return name.length <= MAX_TOOL_NAME_LENGTH ? name : hashedToolName(name, name);
}

export function formatToolName(toolName: string, serverName: string, prefix: ToolPrefix): string {
  return fitToolName(joinToolName(toolName, serverName, prefix));
}
```

Answers to the four sub-questions:

- **Hash input:** the whole joined name, after each `.` of the tool name became `_`. It is the same text that is cut. Not the raw server and tool names.
- **The cut:** the first 55 characters (`64 - 8 - 1`), then `_`, then 8 hex digits. A joined name of 64 characters or fewer is unchanged.
- **`.`:** replaced before the join, so before the hash. With `toolPrefix: "mcp"`, `getServerPrefix` gives `mcp__<server>` where any server character outside `[A-Za-z0-9_-]` becomes `_<hex code point>_` (`types.ts:937-955`). The project's server key holds only those characters, so the prefix is `mcp__<key>`.
- **Collision:** it does not change the name. The comment says two tools share a shortened name only when their full names were equal. `resolveUniqueNameOwnership` (`types.ts:1013-1030`) then skips both tools, as it did for equal full names before.

The project's `adapterToolName` matches `joinToolName` today [VERIFIED: EXT/domain/mcp-implementation.ts:72-80]. It lacks only `fitToolName`. `MAX_TOOL_NAME_LENGTH`, `hashedToolName`, and `joinToolName` are marked `@internal`; `formatToolName` is public.

A standalone copy of the rule (only `node:crypto`, no package file loaded) gives these values. They are [DERIVED], not a run of the adapter's function. The first one equals the name spike S3 recorded from a real run of the adapter's code.

| Tool | Server key | Joined length | Result |
|------|-----------|---------------|--------|
| `take_screenshot_of_the_current_page` | `plugin_chrome-devtools-mcp_chrome-devtools_` | 84 | `mcp__plugin_chrome-devtools-mcp_chrome-devtools__take_s_d9a1c2f1` |
| `echo` | `plugin_demo_a-server-whose-name-runs-well-past-the-limit_` | 67 | `mcp__plugin_demo_a-server-whose-name-runs-well-past-the_a4df039c` |
| `echo` | `plugin_demo_stub_` | 27 | unchanged |
| `get.the.thing.with.dots.and.a.very.long.tool.name.indeed` | `plugin_demo_stub_` | 79 | `mcp__plugin_demo_stub__get_the_thing_with_dots_and_a_ve_210dc4f4` |
| 41 times `x` | `plugin_demo_stub_` | 64 | unchanged |
| 42 times `x` | `plugin_demo_stub_` | 65 | `mcp__plugin_demo_stub__xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx_d4fc4a25` |

I tried to run the adapter's own `formatToolName` from the unpacked tarball, and the session's permission system denied it. So the D-PG1-09 test is the first run of the adapter's function against the project's.

**A second naming rule exists and does not apply.** `AD701/deferred-tool-surface.ts:37-41` names a deferred tool `mcp__<namespace>__<tool>` and hashes `server\0tool`. It covers only tools "that [have] no direct or search-mode registration". This project writes `directTools: "search"` or `true` on every entry, so plugin tools take `formatToolName`. Inside a pi-subagents child the adapter runs with `MCP_DIRECT_TOOLS` set by pi-subagents, which replaces `directTools`; names there are outside this phase.

#### Where the project builds or compares an adapter tool name

| Site | Today | Change |
|------|-------|--------|
| `EXT/domain/mcp-implementation.ts:72-80` `adapterToolName` | full joined name | apply the cut; export the fit function (D-PG1-07) |
| `EXT/domain/mcp-implementation.ts:63-65` `adapterToolNamePrefix`, and `AdapterMcpProfile` at `:53-56` whose `toolNamePrefix` returns `string` | "the adapter always returns one" | A prefix longer than 55 characters is not a prefix of a cut name. Return `undefined` then, as `builtinToolNamePrefix` does at `:104-107`, and drop the narrowed return type |
| `EXT/bridges/agents/convert.ts:118-129` `excludeNameFor` | `if (id === "adapter") { return (token) => token; }` | return `profile.toolName(pluginName, server, tool)` for both implementations (D-PG1-10) |
| `EXT/domain/components/hooks/builtin-mcp-tool-names.ts:81-92` `toolLiteralNames` | for a tool with no built-in server: `literal === tool.piName` | also true when the fitted literal equals `tool.piName` |
| `EXT/domain/components/hooks/builtin-mcp-tool-names.ts:100-104` `serverPrefixNames` | `tool.piName.startsWith(prefix)` | fails for a cut name when the prefix is longer than 55 characters; see the matrix |
| `EXT/domain/components/hooks/builtin-mcp-tool-names.ts:114-124` `claudeFormToolName` | returns `piName` for a non-built-in tool | return the recovered full name when the identity carries one |
| `EXT/bridges/hooks/mcp-tool-view.ts:41-43`, `:138-151` `identify` | `asPiNames(piName)` for an adapter tool | carry the recovered full name on the identity |
| `EXT/bridges/hooks/dispatch.ts:1049-1060` `toolEventView`, `:154-168` `matcherFiresOnToolEvent` | one identity per event | the recovery pre-pass goes here |
| `EXT/bridges/hooks/if-field/index.ts:550, 553` | `toolLiteralNames`, `serverPrefixNames` | follows the domain functions |
| `features/lib/mcp-implementation.ts:466-477` `isStubTool` | `name.startsWith(prefix)` when the profile promises a prefix | follows the profile once `toolNamePrefix` can return `undefined` |
| `features/lib/hook-mcp-calls.ts:42` | `profileFor(profile).toolName(...)` | follows the profile |

"The listing" in success criterion 3 is `When the user lists the mcp tools pi offers` / `Then pi offers these plugin mcp tools:` (`features/mcp-server/listing.feature:204-221` is the built-in scenario). `EXT/orchestrators/plugin/info-mcp-status.ts` names servers, not tools; I found no production code that lists adapter tool names.

Callers of the profile's naming in production code are only `convert.ts:128` (`toolName`) and `convert.ts:364` (`grantSelector`). No production code calls `toolNamePrefix`. [VERIFIED: grep over `extensions/`, then read of the hits]

#### What the adapter exposes about a shortened tool (D-PG1-08)

| Source the hooks bridge can read | What it holds for a shortened tool | Evidence |
|----------------------------------|-------------------------------------|----------|
| `pi.getAllTools()` entry | `name` (shortened), `description`, `parameters`, `promptGuidelines`, `reachesTools`, `exposure`, `namespace`, `annotations`, `sourceInfo`. No `label`. | `node_modules/@earendil-works/pi-coding-agent/dist/core/extensions/types.d.ts:1600-1605` (Pi 1.5.0) |
| The tool's `label` | `MCP: <original tool name>`, but `ToolInfo` does not include `label` | `AD701/index.ts:572` |
| The tool's `namespace` | for a search-mode tool on a Pi with built-in MCP: `{ name: "mcp__<server namespace>" }`. The server, folded; never the tool | `AD701/index.ts:526-545`, `mcp-references.ts:39-41` |
| `tool_call` event | Pi's tool name and the input | no original name |
| `tool_result` event `details`, success | `{ server: <server key>, tool: <original tool name>, ... }` | `AD701/direct-tools.ts:420` |
| `tool_result` event `details`, tool error | `{ error: "tool_error", server, ... }` -- no `tool` | `AD701/direct-tools.ts:395` |
| `tool_result` event `details`, call failure | `{ error: "call_failed" \| "aborted", server, ... }` -- no `tool` | `AD701/direct-tools.ts:465` |
| `<agent dir>/mcp-cache.json` | `{ version: 1, servers: { <key>: { tools: [{ name }], configHash, cachedAt } } }`. Private and zero-TTL listings are not persisted | `AD701/metadata-cache.ts:42-58` |

So the bridge can rebuild the full Claude Code name in these cases:

| Event | Matcher is the full name | Matcher is `*` or a server prefix |
|-------|--------------------------|-----------------------------------|
| `PreToolUse` | Yes. Fit the literal; when it equals Pi's name, the literal is the full name | Only when another matcher or `if` literal of the same event, from any hook, spells the full name. Otherwise the shortened name |
| `PostToolUse` | Yes, by the literal or by details | Yes. `mcp__<details.server>_<details.tool with . as _>`, accepted only when fitting it gives Pi's name |
| `PostToolUseFailure` | Yes, by the literal | The server is known from `details.server`, the tool is not. Shortened name, unless a literal spells it |

**Recommendation (Claude's discretion):** recover from matcher and `if` literals of the event's routing entries, and from result details. Do not read `mcp-cache.json`. Record the two cells that stay shortened in `docs/mcp-compatibility.md` as a pi-mcp-adapter capability gap, as D-PG1-08 says. The payload must be one name for all hooks of an event, so the recovery is a pass over the event's entries before any hook runs, not a per-hook step.

**Server prefix on a cut name.** For a `toolPrefixes` matcher `mcp__plugin_<p>_<s>__`:

- Prefix of 55 characters or fewer: the cut name still starts with it. No change.
- Longer prefix: the cut name is a 55-character fragment of the prefix plus a hash. On `PostToolUse` and `PostToolUseFailure`, `details.server` settles it: the matcher names the server when the prefix equals `mcp__<server>_`. On `PreToolUse` nothing settles it. The adapter's own `resolveServerFromToolName` (`types.ts:1047-1076`) accepts the fragment only when exactly one configured server could own it and no other candidate matches. The bridge does not know the configured servers. Planner's choice: treat it as no match (safe, a hook may not run) or as a match when the name has the cut shape and its first 55 characters start the prefix (a hook may run for a sibling server that shares 55 characters). Record the choice.

#### Agents bridge (D-PG1-10)

- The only adapter tool name the bridge writes is the per-tool `excludeTools` entry on the path where the source agent has no `tools:` field (`convert.ts:569-610` `omittedToolMapping`, through `perToolMcpName`). pi-subagents passes `excludeTools` to the child session when there is no explicit allowlist (`PS88/src/runs/shared/child-launch.js:224`, `child-session.js:580`), where it removes tools by registered name. So the shortened name is the right one there. [DERIVED]
- A grant is a selector, `mcp:<key>` or `mcp:<key>/<raw tool>` (`agent-grants.feature:397`: `tools: mcp:plugin_demo_stub_/echo`). It holds no adapter tool name. The adapter resolves the raw name ("The full name still works anywhere you write it for the adapter: `includeTools`, `excludeTools`, approval rules, `mcp:` references, and `mcp` calls", AD701 CHANGELOG 7.0.1). So "a granted tool name" in D-PG1-10 needs no code change.
- On the explicit `tools:` path, a per-tool disallow beside a whole-server grant only warns (`convert.ts:534-544`); nothing is written to `excludeTools`. That is PG-AGENT-09, a later phase.
- `EXT/bridges/agents/legacy-grant-form.ts:18-20` translates "each per-tool MCP exclude name of this plugin (the Claude-form token `mcp__plugin_<plugin>_...`)" of a file an earlier release wrote. Such files hold full names, so the translation stays right. A file this phase writes stores both forms in the agents index and is never translated from text.

**pi-subagents 0.88.0 does not model the cut (new finding).** `PS88/src/runs/shared/mcp-direct-tool-grant.js:104-113` is pi-subagents' own copy of the adapter's naming:

```js
function formatToolName(toolName, serverName, prefix) {
    const serverPrefix = getServerPrefix(serverName, prefix);
    const sanitized = toolName.replace(/\./g, "_");
    if (serverPrefix && sanitized.startsWith(`${serverPrefix}_`) && sanitized.length > serverPrefix.length + 1) {
        return sanitized;
    }
    return serverPrefix ? `${serverPrefix}_${sanitized}` : sanitized;
}
```

It has no length limit. `planMcpDirectToolGrant` gives each granted tool that name, `child-tool-plan.js:245` puts the names in the child's `--tools` allowlist, and `:265-273` makes them required. The child's `agent_start` check then fails when a required name is not in `pi.getAllTools()`. Under adapter 7.0.1 the registered name is the shortened one. So, by source: **an agent whose `mcp:` grant covers a tool with an adapter name over 64 characters does not launch**, and the error is "requested unavailable child tools: <full name>". A whole-server grant covers every tool of the server, so one long tool name breaks the agent. [DERIVED, UNMEASURED]

This is outside what the project can fix, and it does not touch success criterion 3 (which is about `disallowedTools` on an agent, the no-`tools:` path). The phase should measure it with a conformance test and record it:

- `test/integration/agents-builtin-grant-conformance.test.ts:117-127` already imports `PS/src/runs/shared/mcp-direct-tool-allowlist.js` and calls pi-subagents' own resolver. An adapter twin can call `resolveMcpDirectToolResolution(selectors, cwd, host, configOverride)` with a fixture `mcp-cache.json` in a temporary agent directory and compare `selections[].name` with `profileFor("adapter").toolName(...)`.
- If the gap is real, add a row to "Gaps that need a change outside this project" (PRD section 8.3), a BACKLOG entry, and a line in `docs/mcp-compatibility.md`.

#### How a test calls the installed adapter's naming function (D-PG1-09)

- The cached adapter's `package.json` exports `./types` as `./dist/types.js`. `formatToolName` is exported there (`AD701/dist/types.js:168`). The file imports only `node:crypto`.
- `test/integration/pi-mcp-adapter-peer.ts:88-93` already loads it: `loadPiMcpAdapterModule(peer, "types")` imports `dist/types.js` by file URL. It is compiled JavaScript, so Node's type stripping is not involved. `test/integration/mcp-status-conformance.test.ts` uses that loader for `MCP_STATUS_EVENT`.
- Add `formatToolName` to the `PiMcpAdapterTypes` interface (`pi-mcp-adapter-peer.ts:74-78`) and write a new file under `test/integration/`. That root is exempt from source-test pairing (`scripts/check-corresponding-tests.mjs:10`).
- `findCachedPeer("pi-mcp-adapter")` fails the test when the cache holds any version but the declared floor, which is what D-PG1-09 wants.
- Existing tests that import from the cache: `adapter-expansion-conformance.test.ts`, `mcp-adapter-entry-conformance.test.ts`, `mcp-status-conformance.test.ts`, `agents-builtin-grant-conformance.test.ts`, `provenance-invisibility.test.ts`, `skill-path-resolution.test.ts`.

### 6. Default timeouts (PG-MCP-01, D-PG1-11 to D-PG1-14)

#### Upstream contract, re-checked today

From `https://code.claude.com/docs/en/mcp`, fetched 2026-11-11 through WebFetch, which returns a model's rendering of the page. [CITED: code.claude.com/docs/en/mcp]

- "The idle window defaults to five minutes for HTTP, SSE, WebSocket, and claude.ai connector servers, and to 30 minutes for stdio servers."
- "A tool call to an MCP server that sends no response and no progress notification for the idle window aborts with an error".
- "The per-server `timeout` is a hard wall-clock limit per tool call, and progress notifications from the server don't extend it. Values below 1000 are ignored and fall through to `MCP_TOOL_TIMEOUT`, or to its default of about 28 hours".
- "A per-server `timeout` of at least 1000 also acts as a floor on the idle timeout".
- Remote servers also have "a second, per-request timer that covers each request through to the server's first response byte", set to the greatest of 60 seconds, the server's tool timeout, and `MCP_TIMEOUT`.

Two points for the plan:

1. A declared `timeout` below 1000 is ignored by Claude Code, and then the idle window still applies. So "no usable declared timeout" must get the default, not "no `timeout` key". `timeoutField` already returns nothing for such a value [VERIFIED: EXT/domain/mcp-server-features.ts:139-143].
2. The installed Claude Code is 2.1.322 (`claude --version`). I did not grep its binary for the idle constants; the PRD's report did (`docs/research/parity-gaps/mcp.md`, MCP-01).

#### Where the timeout is translated

[VERIFIED: EXT/domain/mcp-server-features.ts:56-61, 139-161, 188-200]

```ts
const MIN_TIMEOUT_MS = 1000;
const MAX_TIMEOUT_MS = 2_147_483_647;
const MAX_REQUEST_TIMEOUT_MS = 300_000;
```

- `timeoutField(timeout)` writes `requestTimeoutMs` when `timeout` is an integer of at least 1000, capped at `MAX_TIMEOUT_MS`.
- `remoteTimeoutField(server)`: a present `timeout` decides alone; else an integer `request_timeout_ms`, capped at 300,000, stands in.
- `serverFields` switches on `server.type`: `undefined` and `"stdio"` are stdio; `"sse"`, `"http"`, and `"streamable-http"` are remote; any other type maps no field.
- `EXT/domain/mcp-builtin-translation.ts:63-65, 75-88`: `translateBuiltinMcpServer` calls `translateMcpServer` and turns `requestTimeoutMs` into `timeout: requestTimeoutMs / 1000`. Key order is fixed: `type`, transport fields, `oauth`, `timeout`, `exposure`, `description`.

So the server types that get a default are stdio (`undefined`, `"stdio"`): 1,800,000 ms; remote (`"sse"`, `"http"`, `"streamable-http"`): 300,000 ms. Pi's built-in MCP rejects `sse`, so only `http` and `streamable-http` reach it. In seconds for Pi: 1800 and 300.

#### Why the default cannot simply go into the closed table

`pluginSetFieldsIn(translated)` (`adapter-entry.ts:198-200`) lists every carried field the translated entry holds, and `carriedFields` skips those fields when it carries the user's values. If `translateMcpServer` returned a default `requestTimeoutMs`, the entry builder would read it as the plugin's value and drop the user's. That breaks D-PG1-11.

**Recommended shape:**

- `domain/mcp-server-features.ts` exports a function that names the default for a server object, for example `defaultRequestTimeoutMs(server): number | undefined` (`undefined` for a type the table does not know). `translateMcpServer` is unchanged.
- `domain/mcp-builtin-translation.ts` uses `adapter.requestTimeoutMs ?? defaultRequestTimeoutMs(server)`.
- `bridges/mcp/adapter-entry.ts` `stampServers` writes the default after the translated entry and the carried fields, only when neither holds `requestTimeoutMs`, and records it in the marker.

#### How `adapter-entry.ts` tells plugin-set from user-carried today

[VERIFIED: EXT/bridges/mcp/adapter-entry.ts:48-62, 198-229, 312-344; EXT/bridges/mcp/marker.ts:21-39, 96-111]

```ts
const CARRIED_FIELDS = [
  "disabled", "approveTools", "includeTools", "excludeTools", "lifecycle", "idleTimeout",
  "requestTimeoutMs", "debug", "searchKeywords", "openUi", "trace", "appendStructuredContent", "roots",
] as const;
```

- The marker `_piClaudeMarketplace` holds `plugin`, `marketplace`, optional `pluginSetFields` (names only, "never their values"), and optional `keptOverride` (the user's override the entry replaced, verbatim).
- `carriedFields(previous, pluginSet)`: for each carried field, the source is the kept override when the previous marker lists the field as plugin-set, else the previous entry. The field is carried when the new plugin entry does not set it and the source holds it.
- `stampServers` builds `{ ...translated, ...carriedFields(...), _piClaudeMarketplace: buildMarker(...) }`.
- Three consumers read "the user's carried fields": the restage (`stampServers`), the choice store that keeps a leaving entry's choices across disable and uninstall (`adapter-doc.ts:510-520` `leavingChoice` through `userCarriedFields`), and the override write-back (`restoredOverride`).

#### Marker design (D-PG1-13, Claude's discretion)

Add one optional marker member that holds the value of each default this extension wrote, for example `defaultFields: { requestTimeoutMs: 1800000 }`. Rules:

| Case | Previous entry | Result |
|------|---------------|--------|
| Fresh install, no declared timeout | none | write the default; marker records its value |
| Restage, value equals the marker's recorded default | ours | recompute from the server type (stdio to remote gives 300,000) |
| Restage, value differs from the recorded default | the user changed it | carry the user's value; marker records no default |
| Restage, field absent though the marker records a default | the user removed it | write the default again. A user who wants 60 seconds writes `requestTimeoutMs: 60000` |
| Entry an earlier release wrote: no `defaultFields`, holds `requestTimeoutMs` outside `pluginSetFields` | the user's | carry it. Earlier releases never wrote a default |
| Entry an earlier release wrote: no `requestTimeoutMs` | -- | write the default |
| Plugin starts to declare `timeout` | any | the plugin's value, listed in `pluginSetFields`; no `defaultFields` |
| Plugin stops declaring `timeout` | marker lists it in `pluginSetFields` | today's rule already takes the kept override's value if any; else the default |
| Kept override holds `requestTimeoutMs` | -- | carried as today; no default |

Why the value and not only the name: with a name alone, a value the user edits on the entry looks the same as the default the extension wrote, and the next restage would overwrite it. D-PG1-13 forbids that.

Put the "is this value ours" test inside `carriedFields`, so that `userCarriedFields` inherits it. Otherwise the choice store would save a default as the user's choice on disable, and after an enable it would never be recomputed.

One case cannot be told apart: a user who writes exactly the recorded default by hand. The next restage treats it as ours. Record it in the decision row.

`buildMarker` writes `pluginSetFields` only when non-empty and `keptOverride` last "so a restage of the same entry writes the same bytes" (`marker.ts:96-111`). Give the new member a fixed place and the same only-when-present rule.

#### Effects on hashes, records, and comparisons

- **Adapter metadata cache:** `computeServerHash` leaves `requestTimeoutMs` out. The comment says "Exclude lifecycle, idleTimeout, requestTimeoutMs, debug" (`AD701/metadata-cache.ts:143-178`; the function is identical in 7.0.0). pi-subagents' copy (`PS88/.../mcp-direct-tool-allowlist.js` `computeMcpServerHash`) leaves it out too. So a new default does not invalidate a cached tool list and does not unresolve an agent's grant.
- **Adapter project-server approval:** `hashProjectServerDefinition` hashes the whole entry, marker included (`AD701/project-server-trust.ts:92-103`). A project-scope plugin server that the user approved gets a new hash when its entry gains `requestTimeoutMs` and the marker member. Whether the adapter then asks for approval again was not traced; `test/bridges/mcp/adapter-entry.test.ts:1345-1346` calls that hash "an identity read only". The scenarios in `features/mcp-server/project-scope.feature` will show it after an update. [UNMEASURED]
- **State records:** `mcpServerConfigs` holds the plugin's Claude config, not the entry. A default changes no record, no compatibility verdict, and no `effectiveMcpCompatibility` result.
- **Pi's registry:** "Pi compares a registration by `JSON.stringify(config)` and reconnects a server whose JSON changed" (`EXT/domain/mcp-builtin-translation.ts:7-8`). A new session is a fresh registry, so the default arrives there with no reconnect.

#### The built-in registration is rebuilt each session

`EXT/orchestrators/mcp/builtin-registration-step.ts:1-10`: `session-materialize.ts` runs `builtinRegistrationStep` at every `session_start`, and the extension runs `resyncBuiltinRegistrations` after each load reconcile. "A server's values are resolved here from the session environment (BLT-02); nothing is written to a file (D-MB-04)." `EXT/bridges/mcp/builtin-entry.ts:54-69` builds each config from the recorded server through `translateBuiltinMcpServer`. So the default applies at the next session start with no `update`, as D-PG1-12 says.

#### Both timeouts restart on progress

- Adapter 7.0.1: "For a tool call, the timeout restarts whenever the tool reports progress" (`AD701/docs/servers.md:51`); `elicitation-handler.ts:94` calls `client.callTool(params, { ...options, onprogress, resetTimeoutOnProgress: true })`; the server manager passes `requestTimeoutMs` as the request `timeout` (`server-manager.ts:521-545`), and a value of 0 or less falls back to the SDK default (`:2274-2278`).
- Pi: "`timeout`: per-request timeout in seconds (default 60). Progress notifications reset it." (`node_modules/@earendil-works/pi-coding-agent/docs/mcp.md:68`). That file is Pi 1.5.0, the installed version. The milestone baseline is Pi 1.5.2, which I did not read. [VERIFIED for 1.5.0; ASSUMED for 1.5.2]

### 7. The one slow run, and the steps that read the registered configuration (D-PG1-14)

**Reading the registered configuration:**

| Profile | Step | Where |
|---------|------|-------|
| built-in | `Given pi runs with the scripted model and a probe of the mcp servers registered with pi's built-in mcp`, `When the user asks pi for the configs of the mcp servers registered with it`, `Then pi holds these mcp server configs, apart from each stdio server's command and arguments:` | `features/step_definitions/mcp-server/builtin-values.steps.ts:33, 70, 91`; used by `features/mcp-server/builtin-values.feature` (five scenarios, feature tag `@builtin-only`) |
| adapter | `Then the mcp configuration file "mcp-adapter.json" of the {word} scope holds this text:` | `features/step_definitions/mcp-configuration.steps.ts:140`; used by `features/mcp-server/legacy-move.feature:32, 153, 230` and `features/plugin/subagent-child.feature:98, 123` |
| adapter, user edit | `Given the user has disabled the mcp server {string} in the mcp-adapter.json file of the {word} scope` | `features/step_definitions/mcp-server/lifecycle.steps.ts:21`; `features/mcp-server/lifecycle.feature:301` "A user's disabled choice for a plugin server survives an update" is the model for the user-timeout scenario |

A remote server fixture exists: `features/lib/mcp-server-http.ts`, and `builtin-values.feature:26-58` declares a `streamable-http` server at `http://127.0.0.1:9/mcp`.

The new scenarios are a pair, one `@adapter-only` and one `@builtin-only`, each naming a decision ID (`check:features` fails otherwise, DUAL-02). The expectations differ by implementation (`requestTimeoutMs` in a file, `timeout` in Pi's registry), so they cannot be one `@mcp` scenario.

**The slow run.** Nothing in the harness delays a tool: `features/lib/mcp-stub-server.ts` answers `tools/call` at once, and a step times out after 30 seconds (`features/support/world.ts:89`, `STEP_TIMEOUT_MS = 30_000`). Two routes:

1. A temporary scenario under each profile, not committed, as spike S2 did: a throwaway copy of the stub whose tool waits about 65 seconds, and a step with its own timeout (cucumber takes `{ timeout: ... }` per step, as `PROFILE_PI_START_TIMEOUT_MS = 90_000` shows). Run it with `npx cucumber-js --profile adapter --name '<title>'` and `--profile builtin`. This covers both implementations with the existing sandbox, and it never touches the real `~/.pi`.
2. `test/live-uat/mcp-adapter-canary.mjs`, a real Pi over RPC with an adapter in a scratch prefix. It covers the adapter only and needs its version constant moved to 7.0.1.

I recommend route 1. The verification report records the scenario text, the commands, and the result for each profile, and the temporary files are removed.

### 8. Documentation and records

Line numbers verified today against the working tree.

| File | Line | Statement today | Correction |
|------|------|-----------------|------------|
| `docs/mcp-compatibility.md` | 126 | "Its source builds the name of a direct or search-mode tool with no length limit, so the names of plugin tools are not shortened." | 7.0.1 shortens a name over 64 characters; state the rule and the hook gap (PG-MCP-02) |
| `docs/mcp-compatibility.md` | 277 | "or a default of about 28 hours ... This extension does not write a default. So a plugin tool that runs for more than 60 seconds with no progress messages fails under Pi" | add the idle window and the default this extension writes; the first-byte timer is discretion (PG-MCP-01) |
| `docs/mcp-compatibility.md` | 381 | "On pi-subagents 0.84.0 a background child can still miss the plugin's tools ... Both are pi-subagents bugs, and fixes are drafted for upstream." | fixed in 0.87.0 (PG-AGENT-02) |
| `docs/mcp-compatibility.md` | 384 | the verbatim `Unresolved MCP direct-tool selectors` text | the measured 0.88.0 text (D-PG1-03) |
| `docs/mcp-compatibility.md` | 387, 390 | "pi-subagents 0.84.0 refuses a foreground launch ... because an extension registered the server" and its text | version; the text is unchanged by source |
| `docs/mcp-compatibility.md` | 588 | "its default is 60 seconds instead of about 28 hours. Reason: a Pi capability gap. This extension writes only the values that the plugin declares (ANAME-07), so it writes no default." | the default; what stays different (restart on progress for a declared timeout) |
| `docs/mcp-compatibility.md` | 592 | "in pi-subagents 0.84.0 two bugs can keep a background child from getting them too" | fixed in 0.87.0. Leave "Claude Code runs such a subagent in the foreground" for PG-AGENT-01 in Phase 3 |
| `docs/mcp-compatibility.md` | 9, 15, 647 | "reflects pi-mcp-adapter 7.0.0", "needs pi-mcp-adapter 7.0.0 or a later 7.x release", canary version | 7.0.1 |
| `README.md`, `README.es.md` | 39-40, 378 | floors; `anthropic/claude-sonnet-5-5` | new floors; a bare ID |
| `.planning/BACKLOG.md` | 4584-4586 (MCPBG-01) | "Trigger: a pi-subagents release with both fixes ... When that release ships: raise the `pi-subagents` optional-peer floor" | the trigger is met and the floor is raised; what remains is the harness change (AGTASYNC-01) |
| `.planning/BACKLOG.md` | 4896-4898 (MCPV2-03) | "the registration runs in the parent only" | out of date by the code: `builtin-registration-step.ts:15` says "A background child runs the same steps for its own session (D-MB-12)", and the file has no `isSubagentChild` check [VERIFIED: grep of the file]. Still not run in a real child |
| `.planning/upstream/pi-subagents-mcp-direct-tools.md` | 1-164 | "`main` still has both bugs" | both shipped in 0.87.0 (credited as #3201 in the pi-subagents changelog) |
| `CHANGELOG.md` | under `## [Unreleased]` (line 3) | -- | one entry; it says installed agents keep `anthropic/` until the next `update --map-model` (D-PG1-05), and that an installed plugin's adapter entry gets the timeout at its next restage |
| `.planning/codebase/STACK.md` | 35-36 | floors | new floors |
| `.planning/PROJECT.md` | Key Decisions table (starts at line 1789) | -- | rows D-PG1-01 to D-PG1-14; D-PG1-02 as a PIFL-02 amendment with its consequence; D-PG1-11 as an ANAME-07 amendment; the decisions 2, 3, 4 premises with the versions checked |

Wording note for D-PG1-12: under the adapter the entry is rebuilt by every path that calls `stampServers` -- install, update, reinstall, enable, apply, import, and the AMIG-01 legacy move at load. "At the next `update` or `reinstall`" is true but not complete.

### 9. Test surface

| Change | Unit tests (source pair) | Integration | Cucumber | Gates |
|--------|-------------------------|-------------|----------|-------|
| Floors | `test/architecture/peer-floor.test.ts`; `test/bridges/mcp/adapter-entry.test.ts:1346-1365` | every conformance test through `findCachedPeer` | every scenario that loads a companion through `resolveCompanion` | `test:unpaired`, `test:integration`, `test:cucumber` |
| Bare model IDs | `test/bridges/agents/convert.test.ts`, `stage.test.ts`, `test/edge/handlers/plugin/install.test.ts`, `update.test.ts` | -- | `features/agent/frontmatter.feature:109-199`, `features/lib/upstream/subagents.ts` | direct coverage of `convert.ts` |
| Adapter naming | `test/domain/mcp-implementation.test.ts` | new adapter naming conformance test; new pi-subagents grant conformance twin | adapter twin in `features/mcp-server/listing.feature` | direct coverage of `mcp-implementation.ts` |
| Hooks | `test/domain/components/hooks/builtin-mcp-tool-names.test.ts`, `test/bridges/hooks/mcp-tool-view.test.ts`, `test/bridges/hooks/dispatch.test.ts`, the `if-field` test | -- | a new `@adapter-only` scenario in `features/hook/tool-use.feature`, modeled on the scenario at `:325-351` | both complexity gates on `dispatch.ts` |
| Agents `excludeTools` | `test/bridges/agents/convert.test.ts` | -- | a scenario that pins the staged `excludeTools` name (`subagent get`, or the staged file text) | -- |
| Default timeouts | `test/domain/mcp-server-features.test.ts`, `test/domain/mcp-builtin-translation.test.ts`, `test/bridges/mcp/adapter-entry.test.ts`, `marker.test.ts`, `stage.test.ts` (35 entry literals), `builtin-entry.test.ts`, `adapter-doc.test.ts`, `legacy.test.ts`, `test/orchestrators/mcp/builtin-registration-step.test.ts`, `test/orchestrators/plugin/install-flow-ledger.test.ts`, `update-flow.test.ts`, `reinstall-flow.test.ts` | `mcp-override-lifecycle`, `mcp-legacy-sweep`, `mcp-adapter-entry-conformance`, `mcp-migration`, `mcp-variable-expansion`, `mcp-tool-rules`, `mcp-home-path-partial` | new pair for the default; a new adapter scenario for the user's timeout; changed text in `builtin-values.feature` (four of five scenarios have no `timeout`), `legacy-move.feature` (three texts), `plugin/subagent-child.feature` | direct coverage of each touched source |

Commands (`.agents/skills/local-verification/rules/commands.md`):

- One test module: `node --import "$PWD/test/platform/isolated-pi-home.ts" --test <test-path>`
- One pair's direct coverage: `npm run test:coverage:direct -- <source or test path>`
- One scenario: `npx cucumber-js --profile <adapter|builtin> --name '<scenario title>'`
- One profile on chosen paths: `npm run test:cucumber:profile -- --profile <profile> <paths>`
- Static: `npm run check:static` (includes `check:features`, which checks the MCP tags and unused steps)
- Gate: `npm run check`

Direct coverage needs 100% line, function, and branch coverage of each source by its one paired test. Every new branch (the fit, the recovery arms, the default arms, the marker arms) needs a case in that source's paired test file, not in an integration test.

## Architecture Patterns

### System Architecture Diagram

```text
plugin .mcp.json (Claude server object)
        |
        v
domain/mcp-server-features.ts
  translateMcpServer()  ---------------------> requestTimeoutMs only when the plugin declares one
  defaultRequestTimeoutMs()  [new]  --------> 1,800,000 (stdio) | 300,000 (remote) | none
        |                                              |
        |  adapter                                     |  built-in
        v                                              v
bridges/mcp/adapter-entry.ts stampServers()   domain/mcp-builtin-translation.ts
  1 translated entry (plugin value)             timeout = (declared ?? default) / 1000
  2 carried fields (user value, unless ours)            |
  3 default, when 1 and 2 hold none                     v
  4 marker: pluginSetFields, defaultFields      builtin-registration-step (every session_start)
        |                                               |
        v                                               v
<scope>/mcp-adapter.json  --> pi-mcp-adapter    pi.registerMcpServer(name, config)
        |
        v
adapter registers the tool as  fit(join(tool, key, "mcp"))    <-- 64-character rule
        |
        +--> Pi tool_call   { toolName: shortened, input }
        |         |
        |         v
        |    hooks bridge: literal of a matcher or `if` fits to the name?  -> full name
        |                  else                                            -> shortened name (gap)
        |
        +--> Pi tool_result { toolName: shortened, details }
                  |
                  v
             hooks bridge: details {server, tool}  -> full name   (success only)
                           details {error, server} -> literal, else shortened name (gap)

domain/mcp-implementation.ts adapter profile: toolName() = fit(join())   <-- the one rule (D-PG1-07)
        ^                 ^                        ^
        |                 |                        |
 agents convert.ts   hooks domain functions   features/lib (listing, scripted calls)
 excludeNameFor()    toolLiteralNames()
```

### Pattern 1: The fit rule as one exported domain function

**What:** `fit(name)` takes a joined name and returns it, or its 64-character form. The profile's `toolName` composes it with the existing join.
**When to use:** every place that compares a text with an adapter tool name.
**Example:**

```ts
// Shape to follow: builtinToolName in EXT/domain/mcp-implementation.ts:118-132,
// with the adapter's hash input (the joined name itself, AD701/types.ts:989-991).
// The constants MAX_TOOL_NAME_LENGTH, TOOL_NAME_HASH_LENGTH and KEPT_TOOL_NAME_LENGTH
// already exist at EXT/domain/mcp-implementation.ts:93-96.
function fittedAdapterToolName(name: string): string {
  if (name.length <= MAX_TOOL_NAME_LENGTH) {
    return name;
  }

  const hash = createHash("sha256").update(name).digest("hex").slice(0, TOOL_NAME_HASH_LENGTH);
  return `${name.slice(0, KEPT_TOOL_NAME_LENGTH)}_${hash}`;
}
```

The function name is the planner's choice.

### Pattern 2: A conformance test against the cached peer

**What:** load the peer's compiled module by file URL through `test/integration/optional-peer.ts`, call its own function, compare with the project's.
**Example:**

```ts
// Source: test/integration/pi-mcp-adapter-peer.ts:83-93 and mcp-status-conformance.test.ts
const peer = await findPiMcpAdapterPackage();
const types = await loadPiMcpAdapterModule<PiMcpAdapterTypes>(peer, "types");
// types.formatToolName(tool, serverKey, "mcp") against profileFor("adapter").toolName(plugin, server, tool)
```

### Pattern 3: An `@adapter-only` and `@builtin-only` pair

**What:** when the expectation differs by implementation, two scenarios in one file, each with a decision or requirement ID in its title (`.agents/skills/cucumber/rules/features.md:121-122`).
**When to use:** the default-timeout scenarios, and the long-name listing twin (the built-in scenario is `listing.feature:204`, tagged BLT-04, D-MB-13).

### Anti-Patterns to Avoid

- **A default inside `translateMcpServer`:** the entry builder reads it as the plugin's value and drops the user's.
- **A second copy of the fit rule in the hooks module:** `builtin-mcp-tool-names.ts` keeps its own copy of Pi's rule for a stated reason (a user's `mcp.json` server has no plugin). The adapter fit takes only the joined name, so it needs no copy.
- **Expected text written before the run:** the refusal row, the list rows, and the drift-guard pins depend on what 0.88.0 and 7.0.1 print.
- **A per-hook payload name:** all hooks of one event receive one `tool_name`.
- **A style sweep of version comments:** change the comments whose statement this phase re-checks.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| The lowest version of a range | a range parser | `semver.minVersion` | already used by all three readers |
| "Does the suite version fit the declared range" | string compare | `semver.satisfies` | ranges with an upper bound |
| Loading a peer's module | a new loader | `findCachedPeer`, `importPeerModule`, `loadPiMcpAdapterModule` | version check and repair message are built in |
| Reading the adapter file in a scenario | a new step | `the mcp configuration file {string} of the {word} scope holds this text:` | exists and compares the whole text |
| Reading Pi's registry in a scenario | a new probe | `features/lib/mcp-builtin-config-probe/` and the three steps in `builtin-values.steps.ts` | exists |
| A user edit of an entry | hand-written JSON | the pattern of `the user has disabled the mcp server ...` in `lifecycle.steps.ts:21` | same shape for a timeout |
| Pi's projection of a pi-subagents error | a regex in a step | `features/lib/upstream/subagents.ts` `projectSubagentResult` | one place owns pi-subagents' wording |
| SHA-256 | anything | `node:crypto` `createHash` | already imported |

**Key insight:** every reader, loader, and step this phase needs exists. The new code is one fit function, one default function, one marker member, and the recovery pass in the hooks dispatcher.

## Runtime State Inventory

This phase changes artifacts of installed plugins and the test cache, so the inventory applies.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | `<scope>/mcp-adapter.json` entries of installed plugins hold no default `requestTimeoutMs` and no `defaultFields` marker member. | None at load (APL-D1). Each entry is rebuilt at its next restage (D-PG1-12). The marker rules above cover an entry with no such member |
| Stored data | Installed agent files written with `--map-model` hold `model: anthropic/claude-...`. | None. They change at the next `update --map-model` (D-PG1-05). The CHANGELOG says so |
| Stored data | Agents index rows (`agents-index.json`, `mcpForms`) of an installed agent whose `excludeTools` names a plugin tool over 64 characters hold the full name in the adapter form. | None at load. A restage writes the shortened name. Until then the disallowed tool stays available under adapter 7.0.1 -- state this in the docs |
| Stored data | `state.json` records (`mcpServerConfigs`) | None. Records hold the plugin's Claude config |
| Live service config | pi-mcp-adapter's `<agent dir>/mcp-cache.json` and `mcp-project-approvals.json` | The cache hash ignores `requestTimeoutMs`. The project approval hash covers the whole entry; effect unmeasured (pitfall 11) |
| OS-registered state | None -- verified: the extension registers nothing with the OS | None |
| Secrets/env vars | None. `MCP_TOOL_TIMEOUT` and `CLAUDE_CODE_MCP_TOOL_IDLE_TIMEOUT` are out of scope and are not read | None |
| Build artifacts | `node_modules/.cache/optional-peers` holds pi-mcp-adapter 7.0.0 and pi-subagents 0.84.0 [VERIFIED: the cached package.json files]. `holdsFloors` sees the mismatch and reinstalls on the next test script | None by hand. The first install needs the npm registry |
| Build artifacts | The private prefix of `scripts/pi.sh` (`${XDG_CACHE_HOME:-$HOME/.cache}/pi-claude-marketplace/pi-runtime`) holds the old pins | The script reinstalls when a pin is not satisfied (`pi.sh:179-198`) |
| Build artifacts | A scratch adapter install for the live canary (`/var/tmp/mcp-adapter-700` in `test/live-uat/README.md:494`) | Operator-run; the README text changes with the canary's version constant |

## Common Pitfalls

### Pitfall 1: The cache refuses the new pi-subagents version
**What goes wrong:** the install script puts 0.88.0 in the cache, and every integration test and every scenario with pi-subagents fails with "not the declared floor".
**Why it happens:** `optional-peer.ts:116` and `companions.ts:124` each compare the cached version with `minVersion(range)`.
**How to avoid:** change the three readers in one commit, from one shared source.
**Warning signs:** an error that names `node scripts/install-test-peers.mjs` right after a successful install.

### Pitfall 2: The lockfile root is not updated
**What goes wrong:** `peer-floor.test.ts` fails on `assert.equal(lockRange, pkgRange)`.
**How to avoid:** regenerate `package-lock.json` after the `package.json` edit, and check the diff holds only the two ranges (the project's notes record that `npm install` once rewrote an unrelated path).

### Pitfall 3: The list row carries pi-subagents' "unavailable" marker
**What goes wrong:** the scenario for success criterion 2 reads `model claude-sonnet-5-5 (unavailable in the active model registry)`.
**Why it happens:** pi-subagents 0.85.0 added the marker; the harness registry has only `faux/faux-1`.
**How to avoid:** strip the marker in `features/lib/upstream/subagents.ts`, which owns pi-subagents' wording. Do not put the marker in a feature file.

### Pitfall 4: The error projection does not see a bare model ID
**What goes wrong:** `frontmatter.feature:199` reads `subagent failed: error`, which a wrong implementation also produces.
**How to avoid:** extend `OWNED_ERROR_VALUE_PATTERN` to a bare `claude-...` ID, with a unit of care for the pattern's other alternatives (it must not start matching path pieces).

### Pitfall 5: `toolNamePrefix` still promises a prefix under the adapter
**What goes wrong:** the adapter twin of the long-name listing scenario finds no tool. `isStubTool` tests `name.startsWith(prefix)`, and the prefix `mcp__plugin_demo_a-server-whose-name-runs-well-past-the-limit__` is 63 characters while the cut name keeps 55.
**How to avoid:** return `undefined` from `adapterToolNamePrefix` when the prefix is longer than 55 characters, and remove the `AdapterMcpProfile` narrowing.

### Pitfall 6: A cut name has the shape of the adapter's proxy
**What goes wrong:** no hook runs for a real tool call.
**Why it happens:** `isMcpProxyCall` (`dispatch.ts:700-713`) treats `mcp__<x>` with no further `__` as a namespace proxy when the input has a string `tool` and no `action`. A name cut inside the server segment, such as `mcp__plugin_demo_a-server-whose-name-runs-well-past-the_a4df039c`, has no `__` after `mcp__`. A tool whose own input has a string `tool` field would match.
**How to avoid:** decide and test it. A name of exactly 64 characters that ends in `_` and 8 hex digits is a cut name. The comment at `dispatch.ts:696-698` already notes the same shape under Pi's built-in MCP.

### Pitfall 7: The full name is rebuilt wrongly from result details
**What goes wrong:** a hook receives a name that is not the tool's.
**How to avoid:** accept a rebuilt name only when fitting it gives exactly Pi's tool name. That check costs one hash and makes a wrong rebuild impossible to pass on.

### Pitfall 8: pi-subagents' own name for a granted long tool
**What goes wrong:** an agent with an `mcp:` grant over a server that has a tool name over 64 characters fails at launch.
**Why it happens:** pi-subagents 0.88.0 computes the full name and requires it in the child.
**How to avoid:** not in this project. Measure it in a conformance test, record it as a companion gap, and do not let the long-name agent scenario use an agent with an `mcp:` grant over the long tool.

### Pitfall 9: A default saved as the user's choice
**What goes wrong:** after a disable and an enable, the default is no longer recomputed.
**Why it happens:** `leavingChoice` stores `userCarriedFields(entry)`; a default that `carriedFields` does not recognize as ours is stored as a choice.
**How to avoid:** the "ours" test lives in `carriedFields`. Add a case that disables and enables, in the unit test and as a scenario if cheap.

### Pitfall 10: Expected text in many tests
**What goes wrong:** the timeout change turns dozens of unit and integration assertions red, and three scenario texts.
**Why it happens:** every staged entry and every registered config with no declared timeout gains a field. The AMIG-01 legacy move restages through `stampServers` too (`EXT/bridges/mcp/stage.ts:538` is its only caller), so `features/mcp-server/legacy-move.feature` texts change although that path runs at load.
**How to avoid:** make the domain and entry change in one plan and update the expectations in the same plan. Count the files in the test-surface table first.

### Pitfall 11: A project-scope server may need approval again
**What goes wrong:** after an update, a project-scope plugin server shows `pending approval`.
**Why it happens:** the adapter's approval hash covers the whole entry, and the entry gains a field and a marker member.
**How to avoid:** run `features/mcp-server/project-scope.feature` after the change and read what an update does. If approval is lost, it is a one-time effect of the release; say so in the CHANGELOG entry.

### Pitfall 12: Node 26 locally, Node 24 in CI
**What goes wrong:** a text that Node words differently passes locally and fails in CI.
**How to avoid:** this machine runs Node v26.13.0. Do not pin a Node error text in a new test.

## Code Examples

### The default per server type

```ts
// Follows the switch at EXT/domain/mcp-server-features.ts:188-200.
// Values: D-PG1-11 (1,800,000 ms stdio, 300,000 ms remote).
const STDIO_IDLE_TIMEOUT_MS = 1_800_000;
const REMOTE_IDLE_TIMEOUT_MS = 300_000;

export function defaultRequestTimeoutMs(
  server: Readonly<Record<string, unknown>>,
): number | undefined {
  switch (server.type) {
    case undefined:
    case "stdio":
      return STDIO_IDLE_TIMEOUT_MS;
    case "sse":
    case "http":
    case "streamable-http":
      return REMOTE_IDLE_TIMEOUT_MS;
    default:
      return undefined;
  }
}
```

The five `type` values are the ones `serverFields` handles [VERIFIED: EXT/domain/mcp-server-features.ts:188-200]. The constant and function names are suggestions.

### The built-in side

```ts
// EXT/domain/mcp-builtin-translation.ts:84 today: ...timeoutField(adapter.requestTimeoutMs),
...timeoutField(adapter.requestTimeoutMs ?? defaultRequestTimeoutMs(server)),
```

### The registered configs the scenarios would pin

```text
built-in, stdio, no timeout:   {"env":{...},"timeout":1800,"exposure":"deferred"}
built-in, remote, no timeout:  {"type":"http","url":"...","timeout":300,"exposure":"deferred"}
adapter, stdio, no timeout:    "requestTimeoutMs": 1800000   in the entry, and the marker member
adapter, remote, no timeout:   "requestTimeoutMs": 300000
```

The built-in key order comes from `mcp-builtin-translation.ts:79-87`. The place of `requestTimeoutMs` in the adapter entry depends on where `stampServers` writes it; the scenario pins the whole file text, so decide the place once.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| pi-subagents dropped a `directTools: "search"` server | selectors resolve | pi-subagents 0.87.0, 2026-11-07 | background children can get plugin MCP tools; the adapter refusal text changes |
| `provider/id` could fall back to another provider | always runs on that provider | pi-subagents 0.87.0 | the reason for bare model IDs |
| adapter sent a long tool name whole | cut to 64 with a hash | pi-mcp-adapter 7.0.1, 2026-11-03 | the project must model it |
| `list` printed every agent | at most 30, with `options.search` | pi-subagents 0.88.0 | none for the suites |
| `list` showed an unresolvable model pin as usable | marks it "(unavailable in the active model registry)" | pi-subagents 0.85.0 | the list projection |

**Deprecated/outdated:**

- `docs/mcp-compatibility.md:126`, `:381`, `:592`, BACKLOG MCPBG-01's trigger, BACKLOG MCPV2-03's reason, and `.planning/upstream/pi-subagents-mcp-direct-tools.md`'s "still has both bugs".

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `scripts/pi.sh` should pin pi-subagents 0.88.0, the version the suites prove | Floor inventory | A hand-run Pi differs from the suites; low |
| A2 | No scenario lists more than 30 agents, starts a background child in json mode, runs a pi-subagents workflow under a `*` hook, or sends a mistyped `mcp` action | Question 2 | A scenario fails at the first run; the run finds it |
| A3 | `preferredProvider` is the session's provider at the call sites that resolve an agent's model | Question 4 | The docs would overstate what a bare ID does; the claim is the PRD's |
| A4 | Pi 1.5.2's `timeout` restarts on progress as 1.5.0's does | Question 6 | The premise of decision 4 for the built-in; the PRD checked 1.5.2 |
| A5 | The upstream quotes from code.claude.com are exact; WebFetch returns a model's rendering | Question 6 | A wording detail in the docs correction |
| A6 | Treating a hand-written value equal to the recorded default as ours is acceptable | Marker design | A user's value is recomputed on a server type change; rare |
| A7 | The conformance twin against pi-subagents' resolver can run with a fixture cache and a `configOverride` argument | Agents bridge | The gap stays unmeasured and is recorded from source only |
| A8 | D-PG1-01 and D-PG1-02 count as the human check the legitimacy protocol asks for | Package Legitimacy Audit | The planner adds a checkpoint task |

## Open Questions

1. **What does pi-subagents 0.88.0 print for the adapter foreground run?**
   - What we know: the old text needs an unresolved selector, and 0.87.0 fixed the cause. The new candidate text is quoted under question 3.
   - What's unclear: whether the selector resolves in the scenario, and whether the run is refused before or after the child starts.
   - Recommendation: the first plan ends with the run; the plan that edits the scenario comes after it.

2. **Does an agent with an `mcp:` grant over a long tool name launch?**
   - What we know: by source it does not.
   - What's unclear: nothing ran.
   - Recommendation: the conformance twin, then a companion-gap record. Ask the user whether to draft an upstream report under `.planning/upstream/`.

3. **`PreToolUse` with a server-prefix matcher longer than 55 characters on a cut name: match or not?**
   - What we know: the name alone cannot prove the server.
   - Recommendation: the planner picks one and records it; I lean to no match, because a hook that runs for the wrong server is worse than one that does not run.

4. **Does a restage make the adapter ask for project-server approval again?**
   - Recommendation: read it from `features/mcp-server/project-scope.feature` after the change.

5. **Should `scripts/pi.sh` and the live canary follow the suite versions?**
   - Recommendation: yes for both; they are small edits in the floor plan.

6. **Does "untrusted project" behavior in `world-and-stand-ins.md:62` still hold on 0.88.0?**
   - Recommendation: the agent trust scenarios answer it at the first run.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node | everything | yes | v26.13.0 (CI runs Node 24) | -- |
| npm | install script, lockfile | yes | 11.20.0 | -- |
| npm registry | first install of the new peers | yes (`npm pack` and `npm view` worked this session) | -- | none; the cache cannot be filled offline |
| Pi | cucumber, integration | yes | `@earendil-works/pi-coding-agent` 1.5.0 in `node_modules` | -- |
| Claude Code | upstream checks | yes | 2.1.322 | docs |
| pi-subagents 0.88.0, pi-mcp-adapter 7.0.1 | suites | not in the cache yet (it holds 0.84.0 and 7.0.0) | -- | the install script fetches them |
| CodeGraph | exploration | yes (`.codegraph/` exists) | -- | grep |

**Missing dependencies with no fallback:** none.

**Missing dependencies with fallback:** none.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | `node:test` with `node:assert/strict` and `strong-mock`; `@cucumber/cucumber` for `features/` |
| Config file | `cucumber.json` (profiles `adapter`, `builtin`); `package.json` scripts |
| Quick run command | `node --import "$PWD/test/platform/isolated-pi-home.ts" --test <test-path>` |
| Full suite command | `npm run check` |

### Phase Requirements -> Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PG-AGENT-02 | `package.json` declares `>=0.87.0` and the lock root mirrors it | architecture | `node --import "$PWD/test/platform/isolated-pi-home.ts" --test test/architecture/peer-floor.test.ts` | yes; assertions change |
| PG-AGENT-02 | the suite version of pi-subagents satisfies the declared range, and only pi-subagents has one | architecture | same file | no -- new case |
| PG-AGENT-02 | the cache holds 0.88.0 and every reader accepts it | integration | `npm run test:integration` | yes; readers change |
| PG-AGENT-02 | a foreground run of an agent granted a plugin MCP tool does what 0.88.0 does, under each implementation | cucumber | `npx cucumber-js --profile adapter --name 'A foreground run of an agent granted a plugin MCP tool'` and `--profile builtin` | yes; rows change after measurement |
| PG-AGENT-02 | a real background child calls the tool | manual | none (AGTASYNC-01) | manual only; the phase says how |
| PG-AGENT-07b | each alias and a `claude-` ID map to a bare ID | unit | `npm run test:coverage:direct -- extensions/pi-claude-marketplace/bridges/agents/convert.ts` | yes; cases change |
| PG-AGENT-07b | the agent list shows `model claude-sonnet-5-5` | cucumber | `npx cucumber-js --profile adapter --name "With --map-model Claude Code's model names are listed as the models they select"` | yes; row and projection change |
| PG-MCP-02 | `package.json` declares `>=7.0.1 <8` | architecture | `test/architecture/peer-floor.test.ts`, `test/bridges/mcp/adapter-entry.test.ts` | yes; assertions change |
| PG-MCP-02 | the project's rule equals the installed adapter's `formatToolName` for 64, 65, 84 characters and a `.` name | integration | `node --import "$PWD/test/platform/isolated-pi-home.ts" --test test/integration/<new file>` | no -- Wave 0 |
| PG-MCP-02 | the adapter profile cuts a long name and returns no prefix past 55 characters | unit | `npm run test:coverage:direct -- extensions/pi-claude-marketplace/domain/mcp-implementation.ts` | yes; new cases |
| PG-MCP-02 | Pi offers the plugin's long tool under the shortened name | cucumber | `npm run test:cucumber:profile -- --profile adapter features/mcp-server/listing.feature` | no -- new `@adapter-only` scenario |
| PG-MCP-02 | a hook whose matcher is the full Claude Code name runs and receives that name | cucumber | `npm run test:cucumber:profile -- --profile adapter features/hook/tool-use.feature` | no -- new `@adapter-only` scenario |
| PG-MCP-02 | literal match, prefix match, and name recovery for a cut name | unit | direct coverage of `builtin-mcp-tool-names.ts`, `mcp-tool-view.ts`, `dispatch.ts` | yes; new cases |
| PG-MCP-02 | an agent whose `disallowedTools` names the long tool stages the shortened name in `excludeTools` | unit and cucumber | direct coverage of `convert.ts`; a scenario in `features/agent/` or `features/mcp-server/agent-grants.feature` | no -- new |
| PG-MCP-02 | pi-subagents' name for a granted long tool against the adapter's | integration | new twin of `agents-builtin-grant-conformance.test.ts` | no -- Wave 0; it may record a gap, not a pass |
| PG-MCP-01 | the default per server type; a declared timeout still wins; an ignored one gets the default | unit | direct coverage of `mcp-server-features.ts`, `mcp-builtin-translation.ts` | yes; new cases |
| PG-MCP-01 | plugin value, then user value, then default; the marker rules; recompute on a type change; an earlier release's entry | unit | `npm run test:coverage:direct -- extensions/pi-claude-marketplace/bridges/mcp/adapter-entry.ts` and `marker.ts` | yes; new cases |
| PG-MCP-01 | built-in: stdio shows `"timeout":1800`, remote shows `"timeout":300` | cucumber | `npm run test:cucumber:profile -- --profile builtin features/mcp-server/builtin-values.feature` | file yes; new scenarios, changed rows |
| PG-MCP-01 | adapter: stdio shows `1800000`, remote shows `300000` | cucumber | `npm run test:cucumber:profile -- --profile adapter features/mcp-server/<file>` | no -- new `@adapter-only` scenarios |
| PG-MCP-01 | adapter: a user-written `requestTimeoutMs` is still there after an update | cucumber | `npm run test:cucumber:profile -- --profile adapter features/mcp-server/lifecycle.feature` | no -- new scenario and one new `Given` step |
| PG-MCP-01 | a call silent for more than 60 seconds succeeds under each implementation | one-off run | a temporary scenario, `npx cucumber-js --profile <p> --name '<title>'` | not committed (D-PG1-14); the result goes in the verification report |

### Sampling Rate

- **Per task commit:** the owner test of each changed source, and `npm run test:coverage:direct -- <path>` for its pair. The commit hook then runs `npm run check:commit`.
- **Per wave merge:** `npm run check` on the combined tree.
- **Phase gate:** `npm run check` green before `/gsd-verify-work`, plus the two one-off slow runs recorded.

### Wave 0 Gaps

- [ ] The shared suite-version file, and the change of the three readers -- every later test needs the cache to load.
- [ ] `test/integration/<adapter naming conformance>.test.ts` -- covers D-PG1-09; extend `PiMcpAdapterTypes` in `test/integration/pi-mcp-adapter-peer.ts`.
- [ ] `test/integration/<adapter grant conformance>.test.ts` -- measures the pi-subagents long-name gap.
- [ ] `features/lib/upstream/subagents.ts` -- the model marker, the bare model ID, and the new refusal text, after the first run.
- [ ] One `Given` step for a user-written `requestTimeoutMs` on an entry, beside `lifecycle.steps.ts:21`.
- [ ] Fixture decision for the long name: the existing server `a-server-whose-name-runs-well-past-the-limit` cuts inside the server segment (63-character prefix). A cut inside the tool segment needs a stub whose tool name can be set; `features/lib/mcp-stub-server.ts` offers only `echo`, and `features/lib/hook-mcp-tool-server.ts` takes a tool name but serves a user's `mcp.json`, not a plugin.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | -- |
| V3 Session Management | no | -- |
| V4 Access Control | yes | An agent's `disallowedTools` entry must remove the tool. The shortened name in `excludeTools` is the control; a mismatch leaves a disallowed tool available |
| V5 Input Validation | yes | The marker member is read from a user-editable file: validate its shape as `readMarker` does for `pluginSetFields` (`marker.ts:57-85`), and never throw |
| V6 Cryptography | no | SHA-256 here names a tool; it protects nothing |

### Known Threat Patterns for this phase

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| A disallowed tool stays available because the written name does not match the registered name | Elevation of privilege | One naming rule (D-PG1-07), the conformance test against the installed adapter (D-PG1-09), and a scenario on the staged name |
| An installed agent keeps the full name in `excludeTools` until its next restage, while adapter 7.0.1 registers the shortened name | Elevation of privilege | Document it; the user runs `update` or `reinstall`. The same gap exists today for any user who already runs adapter 7.0.1 |
| A hook that guards a tool by its full name does not run for the shortened tool | Elevation of privilege | Literal matching through the fit rule; this is the P0 reason for PG-MCP-02 |
| A hook with a `*` matcher receives a shortened name on `PreToolUse` and decides by name | Tampering | Recorded capability gap; the docs say which events carry the full name |
| A forged marker member makes the extension overwrite or keep a timeout | Tampering | The member only chooses between the user's value and the default; it grants nothing. Validate its type |
| A hung stdio server now blocks a call for 30 minutes | Denial of service | Claude Code's behavior; the user can set `requestTimeoutMs` on the entry |
| A companion release changes the naming rule | Tampering | The conformance test fails the suite |

## Sources

### Primary (HIGH confidence)

- The repository at `features/gaps`, commit `cda1f1a9`: the files cited with line numbers above.
- `pi-subagents@0.88.0`, `@0.87.0`, `@0.84.0` and `pi-mcp-adapter@7.0.1`, `@7.0.0` from `npm pack`, unpacked outside the repository: changelogs and the source files cited.
- `npm view` for publish times, `dist.shasum`, and `scripts.postinstall`.
- `node_modules/@earendil-works/pi-coding-agent` 1.5.0: `dist/core/extensions/types.d.ts:1600-1605`, `docs/mcp.md:68`.

### Secondary (MEDIUM confidence)

- `https://code.claude.com/docs/en/mcp`, fetched 2026-11-11 through WebFetch: the timeout and idle-window paragraphs.
- `docs/prd/parity-gaps-prd.md` sections 5.1, 7.3, 7.5, 9, 10, and `docs/research/parity-gaps/mcp.md`, `subagents.md`.

### Tertiary (LOW confidence)

- None used as a basis for a recommendation.

Note on method: the research-plan seam and its cache were not used. Every question here was answered from the repository and from the package tarballs, which are the authoritative sources for them.

## Metadata

**Confidence breakdown:**

- Floor inventory and the install script: HIGH -- every file was read.
- The adapter naming rule: HIGH for the rule (source read, and a standalone copy reproduced spike S3's recorded name); the adapter's own function did not run in this session.
- What the adapter exposes to a hook: HIGH from source; no session ran.
- Behavior of the suites on 0.88.0 and 7.0.1: LOW to MEDIUM -- derived from changelogs and source.
- The pi-subagents long-name gap: MEDIUM -- one code path read end to end, not run.
- Timeout translation, the marker, and the built-in rebuild: HIGH -- the project's own code.
- Upstream timeout contract: MEDIUM -- official page through a rendering tool.

**Research date:** 2026-11-11
**Valid until:** 2026-11-18. Both companions release often: pi-subagents shipped five releases in two weeks.
