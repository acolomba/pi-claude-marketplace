# Stack Research -- mcp-4 (Pi 1.0 baseline, pi-mcp-adapter 5 delivery)

**Domain:** Pi extension; host and companion-extension version floors, devDependency refresh
**Researched:** 2026-10-01
**Confidence:** HIGH. Every version below was read from the npm registry on 2026-10-01. Every compatibility claim was run against the unpacked tarballs or in a scratch copy of HEAD (`8b6ac3bc`) with the new versions installed. Nothing was taken from web prose.

## Bottom Line

- **Pi 1.0.0 is a drop-in for production code.** `extensions/` typechecks clean against `@earendil-works/pi-coding-agent@1.0.0`. The only breaks are 23 type errors in four test files, and the test-file hunks of features/mcp `74162ca6` fix them exactly.
- **Results on Pi 1.0.0 with those hunks applied:** `tsc` exit 0, unit 8529/8529, integration 67/67, e2e 14/14.
- **No new runtime dependency.** The bridge writes adapter JSON with the existing `typebox` + `write-file-atomic` stack. It reads live status through Pi's `pi.events` bus on a string channel. It never imports `pi-mcp-adapter`.
- **Hold TypeScript at `^6.0.3`.** `typescript@7.0.2` is npm `latest`, but it cannot be adopted. See What NOT to Use. "Bump all devDependencies to latest" must carry this one exception.
- **`typescript-eslint` 8.71.0 adds one lint error.** Its new `no-unsafe-enum-assignment` rule, now in `strictTypeChecked`, fires once at `shared/notify-context.ts:345:30`. That is a string-keyed computed access with no enum involved. The message names an empty enum (`expected enum .`), so this looks like a false positive in a brand-new rule. Plan a task for it.
- **The pi-mcp-adapter 5.0 `pi-ai` peer gap does not reach Pi users.** `pi install` passes `--legacy-peer-deps`, and Pi 1.0's shrinkwrap nests `pi-ai`. The gap is a hard `ERESOLVE` (not a warning) only when `@earendil-works/pi-ai@1.x` sits at top level beside the adapter. Record it as an upstream gap, as PROJECT.md says.

## Recommended Stack

### Core Technologies (host and companions)

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| `@earendil-works/pi-coding-agent` | peer `>=1.0.0`, dev `^1.0.0` (lock 1.0.0, published 2026-10-01) | Extension host API | Milestone baseline. Verified: production code compiles and all suites pass on 1.0.0. The API delta from 0.87.1 is additive for every symbol `platform/pi-api.ts` re-exports (see the API Delta section). |
| `@earendil-works/pi-tui` | peer `*` (unchanged), dev `^1.0.0` | `AutocompleteProvider` type | Keep the top-level dev copy in lockstep with the copy Pi's shrinkwrap nests (`pi-tui ^1.0.0`). Today it already drifts (top-level 0.87.0 vs nested 0.87.1). The only import is a type, so drift is harmless, but lockstep removes the question. |
| `pi-subagents` | optional peer `>=0.74.0` (published 2026-09-30) | Agent-artifact soft dependency | 0.74.0 still ships compiled `src/agents/{skills,frontmatter}.js`. Both peer integration tests (with `5b1d8ef6`/`dac3a245`/`69e0870a` applied, floor constant `0.74.0`) **passed 2/2 against 0.74.0**. Its own peers (`pi-coding-agent *`, `pi-ai >=0.86.1`, all optional) accept Pi 1.0. |
| `pi-mcp-adapter` | **add** optional peer `>=5.0.0` (published 2026-10-02T00:12Z) | MCP soft dependency | 5.0 is the first adapter that coexists with Pi >= 0.99. It turns off `builtin:mcp` (writes `"-builtin:mcp"` to user `settings.json`) and owns `/mcp`. It reads both `mcp-adapter.json` and Pi's `mcp.json`. It maps `directTools: "search"` to Pi deferred tools that `tool_search` finds. It publishes `pi-mcp-adapter/status/v1` snapshots. Declaring an optional peer matches the `pi-subagents` precedent and gives tests a machine-readable floor. npm never auto-installs optional peers, and the declaration adds no lockfile package entry, so D-98-10 ("companions never in package.json dependencies or the lock") holds. **Decision for the user:** optional peer plus README, or README only ("documented"). |
| `@quintinshaw/pi-dynamic-workflows` | 3.13.1 (published 2026-09-29), `scripts/pi.sh` pin only | Workflow engine canaries | Peers unchanged (`pi-coding-agent >=0.80.8`, `pi-tui >=0.80.6`). The 3.13.0 -> 3.13.1 diff adds `installHostCreateAgentSession()` ("Use the host Pi SDK to create children so its ModelRuntime protocol matches") and preserves terminal provider errors. That fixes the same class as the documented "children received no tools" mismatch, so it is the right version to re-grade on Pi 1.0. The tarball layout (`extensions/workflow.ts`) is unchanged, so `pi.sh` paths stay valid. |

### Supporting Libraries (runtime, no additions)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `typebox` | `^1.3.34` (already latest) | Schema for the bridge's `mcp-adapter.json` server entry (`directTools`, naming, env fields) | Model the adapter-native entry the same way `domain/components/*.ts` models plugin `.mcp.json`. Pi 1.0 pins typebox 1.3.27 internally; the `typebox: *` peer covers it. |
| `write-file-atomic` | `^8.0.0` (latest) | NFR-1 atomic write of `<scopeRoot>/mcp-adapter.json` | Reuse `shared/atomic-json.ts` unchanged. The migration from `mcp.json` is two atomic writes under the existing scope lock. |
| `proper-lockfile` | `^4.1.2` (latest) | Scope lock around the `mcp.json` -> `mcp-adapter.json` move | Unchanged. |
| Pi `pi.events` (`EventBus.on(channel, handler) => unsubscribe`) | Pi 1.0 API | Live adapter status for `/claude:plugin info` | Subscribe at extension load to the string literal `"pi-mcp-adapter/status/v1"` (snapshot `version: 1`; per-server `status` is `connected`, `cached`, `failed`, `needs-auth`, `not-connected`, `blocked`, or `disabled`). The adapter only *pushes*: an initial snapshot after init, then one per change, then an empty one at shutdown. There is no request channel for status. `pi-mcp-adapter:runtime-snapshot:v1` returns runtime-registered *definitions*, not status. So `info` must read a last-snapshot cell that the extension caches, in the same way `bridges/hooks/routing-state.ts` holds process-lifetime state. |
| Pi `pi.getSettings()` | new in 0.99, present in 1.0 | Adapter-only detection | Returns merged settings, including `extensions`, so `-builtin:mcp` / `builtin:mcp` is readable without parsing `settings.json`. Optional aid. The existing probe (tool named `mcp` OR `sourceInfo.source` contains `pi-mcp-adapter`) already ignores the built-in: Pi 1.0's built-in registers tools `mcp__<server>__<tool>` and the `/mcp` *command*, never a tool named `mcp`. |

Keep `isomorphic-git` (lock 1.42.2, latest 1.42.6), `acorn` (8.18.0), and `semver` (7.8.5) as they are. Lock refreshes inside their caret ranges are fine but are not milestone scope.

### Development Tools (devDependency targets)

| Tool | Current range (locked) | Target | Notes |
|------|------------------------|--------|-------|
| `@earendil-works/pi-coding-agent` | `^0.87.1` (0.87.1) | `^1.0.0` | See Core. |
| `@earendil-works/pi-tui` | `^0.87.0` (0.87.0) | `^1.0.0` | See Core. |
| `typescript-eslint` | `^8.70.1` (8.70.1) | `^8.71.0` | 1 new error from `@typescript-eslint/no-unsafe-enum-assignment` (see Bottom Line). Fix it in code, or turn the rule off in `eslint.config.js` with an inline justification, before the bump lands. Peer `typescript >=4.8.4 <6.1.0`. |
| `eslint-plugin-sonarjs` | `^4.0.3` (4.2.1) | `^4.2.2` | No new findings (19 warnings, all pre-existing unused `no-await-in-loop` disables, same as baseline). |
| `fallow` | `^3.27.0` (3.27.0) | `^3.31.0` | `npm run fallow` exit 0. `test:architecture` 456/456, so the `schema_version` pins (health 9, dead-code 8) did not move; only the review-brief schema changed (10 -> 11, unused here). **Also bump `.github/workflows/lint.yml`** from `bd8fca5a... # v3.28.0` to `71369f80d099e25726ad04382f15aef14a251abc # v3.31.0` (peeled commit of tag v3.31.0, same convention). fallow 3.31 needs Node >= 22; CI uses Node 24. |
| `prettier` | `^3.8.3` (3.9.6) | `^3.9.9` | `format:check` clean, so no reformat churn. |
| `globals` | `^17.6.0` (17.12.0) | `^17.13.0` | No effect. |
| `eslint-plugin-import-x` | `^4.16.2` (4.17.1) | `^4.17.1` | Range floor only; already locked. |
| `@eslint/js` 10.0.1, `@stylistic/eslint-plugin` 5.10.0, `@types/proper-lockfile` 4.1.4, `@types/semver` 7.8.0, `@types/write-file-atomic` 4.0.3, `eslint` 10.11.0, `strong-mock` 9.2.2, `typebox` 1.3.34 | -- | unchanged | Already latest. |
| `typescript` | `^6.0.3` (6.0.3) | **hold `^6.0.3`** | 6.0.3 is the newest 6.x. See What NOT to Use. |

With all of the above applied in scratch: `tsc` exit 0, `test:architecture` 456/456, `test:analyzers` 285/285, `fallow` exit 0, `format:check` clean, `eslint` 1 error (the typescript-eslint rule).

## Installation

```bash
# Host floor (devDependencies), plus manual peerDependencies edits (see below)
npm install -D @earendil-works/pi-coding-agent@^1.0.0 @earendil-works/pi-tui@^1.0.0

# Tooling refresh -- NOT typescript
npm install -D typescript-eslint@^8.71.0 eslint-plugin-sonarjs@^4.2.2 fallow@^3.31.0 \
  prettier@^3.9.9 globals@^17.13.0 eslint-plugin-import-x@^4.17.1
```

Edit by hand in `package.json` (and the mirrored lock root):
`peerDependencies["@earendil-works/pi-coding-agent"] = ">=1.0.0"`, `["pi-subagents"] = ">=0.74.0"`, and (if accepted) `["pi-mcp-adapter"] = ">=5.0.0"` with `peerDependenciesMeta["pi-mcp-adapter"] = { "optional": true }`.
In `scripts/pi.sh` `pi_cm_pins`: `pi-mcp-adapter@5.0.0`, `pi-subagents@0.74.0`, `@quintinshaw/pi-dynamic-workflows@3.13.1` (it already installs with `--legacy-peer-deps`).

## Re-applying features/mcp Work at the 1.0.0 Floor

All five commits `git apply --check` cleanly onto HEAD, applied in order. What has to change:

| Commit | Apply as-is? | Change for the 1.0.0 floor |
|--------|--------------|-----------------------------|
| `74162ca6` build: require Pi 0.99.2 | **Test hunks: yes, verbatim.** These are `exposure: "direct"` on the 3 `ToolInfo` fixtures (`workflows-marker-coverage`, `list-flow`, `reinstall.messaging`) and `ExtensionContext` -> `ExtensionToolContext` in `tests/edge/handlers/tools.test.ts`. Re-measured on 1.0.0: before = 23 errors in exactly those 4 files, after = `tsc` exit 0. **Do NOT reuse the `package.json`/`package-lock.json` hunks.** They were cut against a `^0.86.1`/`^0.85.0` base; HEAD is now `^0.87.1`/`^0.87.0`. | `0.99.2` -> `1.0.0` in `package.json` (peer + both devDeps), `tests/architecture/peer-floor.test.ts` title + assertion (FLOOR-01), `tests/architecture/workflows-doc-pins.test.ts` header comment, `docs/workflows-compatibility.md` (`>=1.0.0`, "Install Pi 1.0.0", engine 3.13.0 -> 3.13.1 once re-graded). pi-subagents floor `>=0.73.1` -> `>=0.74.0`. Regenerate the lock with `npm install`; never hand-merge the old lock hunk. **Contracts pins:** HEAD carries only TWO `types.d.ts` pins (the `reason` pin `74162ca6` edited no longer exists on main). Set `pi-api.ts:100:3 ResourcesDiscoverEvent.type` `406:5 -> 525:5` and `pi-api.ts:108:3 ResourcesDiscoverResult.themePaths` `414:5 -> 533:5`. Verified: 1.0.0 places them on the same lines as 0.99.2, and `lint:type-members` exits 0 with these two edits. |
| `5b1d8ef6` load compiled pi-subagents modules | Yes | None. 0.74.0 keeps `src/agents/skills.js` and `src/agents/frontmatter.js`. |
| `dac3a245` fail on a broken peer | Yes | None. |
| `69e0870a` gate on the D-19 floor | Yes, then edit | `const PI_SUBAGENTS_FLOOR = "0.73.1"` -> `"0.74.0"` in both integration files, and the commit-message/comment wording "0.73.1". Verified 2/2 pass against 0.74.0 via `PI_SUBAGENTS_ROOT=<prefix>/lib/node_modules/pi-subagents`. Locally they **skip** because the global install is 0.47.1, and CI has no global peer. Prove the floor with `PI_SUBAGENTS_ROOT`, not with a green default run. |
| `4f82096f` Stop canary on Pi 0.99.2 | Yes, then edit and re-run | `stop-canary.mjs` precondition and messages `0.99.2` -> `1.0.0`. The README "Observed result (2026-10-01, pi 0.99.2)" is evidence for 0.99.2, not 1.0.0: re-run on 1.0.0 and record that run instead of keeping the 0.99.2 one. The commit adds `.planning/spikes/028-pi-099-builtin-mcp/openai-stub-server.mjs`. That directory does not exist on this branch, and it names the abandoned milestone. Recommend renaming the spike dir (or relocating to `tests/live-uat/`, checking fallow `unused-file`/dupes) and fixing the README paths. The headless cap-loop rewrite ("since Pi 0.87 ...") remains true on 1.0 (no settle/run changes in the 0.99-1.0 changelog). |

Other `0.86.1` floor mentions to update, outside those commits: `README.md:38`, `README.es.md:38`, `AGENTS.md:61` (Pi API constraint), the PROJECT.md Constraints "Pi API" bullet, `tests/live-uat/README.md:211,239`, `tests/live-uat/stop-canary.mjs:226,228`.

## Pi 0.87.1 -> 1.0.0 API Delta (symbols this extension imports)

Imports: `getAgentDir`, `parseFrontmatter`, `DynamicBorder` (runtime), plus types `AgentEndEvent`, `AgentSettledEvent`, `BeforeAgentStartEvent(Result)`, `ExtensionAPI`, `ExtensionCommandContext`, `ExtensionContext`, `InputEvent(Result)`, `Session{BeforeCompact,Compact,Shutdown,Start}Event`, `Theme`, `ToolCall{Event,EventResult}`, `ToolResultEvent` (all from `platform/pi-api.ts`), and `AutocompleteProvider` from pi-tui.

| Change | Breaking for us? | Evidence |
|--------|------------------|----------|
| `ToolInfo` gains **required** `exposure: ToolExposure` (`"direct" \| "model-only" \| "codemode" \| "deferred" \| "hidden"`), optional `namespace`, `annotations` | Tests only (fixtures that build `ToolInfo` literals). Production only *reads* `getAllTools()`. | 6 of the 23 errors |
| Tool `execute(..., ctx)` is typed `ExtensionToolContext` (= `ExtensionContext` + `tools`, `executeTool`) | Tests only (`tools.test.ts` passes a mocked `ExtensionContext`) | 17 of the 23 errors |
| `ExtensionAPI` additions: `getSettings`, `getMcpServers`, `registerMcpServer`, `unregisterMcpServer`, `registerVirtualModel`, `unregisterVirtualModel`; **no removals** | No | Member diff of `types.d.ts` |
| `ExtensionContext`, `ExtensionCommandContext`, `ExtensionUIContext`, all imported event interfaces | No member added or removed | Member diff |
| `resources_discover` event/result shape | Unchanged; only line numbers moved (406 -> 525, 414 -> 533) | `lint:type-members` |
| Built-in extensions renamed `builtin:<name>` (`builtin:mcp`); `--no-extensions` disables built-ins | Relevant to adapter-only detection, not to imports | Pi CHANGELOG 0.99.0 |
| Built-in MCP tool names normalize `-` -> `_` (`mcp__my_server__x`) | Built-in only. The adapter has its own naming. Keep it in mind for `plugin:<plugin>:<server>` normalization research. | Pi CHANGELOG 0.99.2 |
| `engines.node >=22.19.0` | Not new (0.87.1 already declared it) | registry |

## pi-mcp-adapter 5.0 `@earendil-works/pi-ai` Peer Gap (measured, npm 11.19.1)

Adapter 5.0.0 declares optional peer `pi-ai: "^0.84.1 || ^0.85.0 || ^0.86.0 || ^0.87.0 || ^0.99.0"`. That range excludes 1.0.0, which every Pi 1.0 install carries.

| Scenario | Result |
|----------|--------|
| `pi install npm:pi-mcp-adapter` (Pi 1.0 `getNpmInstallArgs`: `npm install <spec> --prefix <root> --legacy-peer-deps`; pnpm/bun get equivalent peer-off flags) | No warning, no error: peers are not evaluated |
| `scripts/pi.sh` (`npm install --prefix ... --legacy-peer-deps`) | No warning |
| Plain project: `pi-coding-agent@1.0.0` + `pi-mcp-adapter@5.0.0` | Clean (`exit 0`). Pi's `npm-shrinkwrap.json` nests `pi-ai@1.0.0` under `pi-coding-agent/node_modules`, so the adapter's optional peer is simply absent. |
| Plain project with top-level `pi-ai@1.0.0` + adapter 5.0.0 | **Hard `ERESOLVE`** (`Conflicting peer dependency: @earendil-works/pi-ai@0.99.2`), exit 1, even without `--strict-peer-deps`; needs `--legacy-peer-deps`/`--force` |

Consequences: (1) record it as an upstream gap in docs; do not work around it. (2) Never add `pi-mcp-adapter` to this repo's devDependencies (it would also pull the MCP SDK, the `@napi-rs/keyring` native module, and quickjs into `npm ci`). (3) An optional *peer* declaration is safe, because npm does not install optional peers.

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| Subscribe to `pi-mcp-adapter/status/v1` with a string literal and a locally typed snapshot (typebox-validated at the boundary) | `import { MCP_STATUS_EVENT, type McpStatusSnapshot } from "pi-mcp-adapter"` | Never in `extensions/`: the adapter is a soft dependency and may be absent, so a static import breaks load (RH-4, "never blocks install"). |
| Hold `typescript@^6.0.3` | `typescript@^7.0.2` | When typescript-eslint publishes a release whose peer admits 7.x, and when `scripts/check-*.mjs` plus the two tests that import `typescript` move to TS 7's `typescript/unstable/*` API or a pinned `@typescript/typescript6` shim. That is a separate milestone. |
| Optional peer `pi-mcp-adapter >=5.0.0` + README | README-only floor | If the user reads D-98-10 as covering peers too. Then add a doc-pin test instead of FLOOR-style lock checks. |
| Pi `pi.getSettings()` for built-in state | Reading `~/.pi/agent/settings.json` directly | Never. `getSettings()` returns the merged, override-applied view. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `typescript@7.0.2` (npm `latest` since 2026-07-08) | `typescript-eslint@8.71.0` peers `typescript <6.1.0`. TS 7's package `exports["."]` is only `./lib/version.cjs`, with no classic compiler API (`ts.createProgram`, AST walkers). `scripts/check-changed.mjs`, `check-corresponding-tests.mjs`, `test-coverage-direct.mjs`, `check-unused-type-members.{contracts,model,operations,flow}.mjs`, `tests/domain/components/hook-events.test.ts`, and `tests/persistence/config-write-back.test.ts` all import `typescript`. | `typescript@^6.0.3` |
| `pi.registerMcpServer()` / Pi built-in MCP | The milestone forbids it. Adapter 5 also treats runtime-registered servers as proxy-only (it ignores `direct`/`deferred`), so `directTools: "search"` would be lost. | Write marked entries into `<scopeRoot>/mcp-adapter.json`. |
| Writing Pi-native `exposure: "deferred"` into `mcp.json` to get search | Adapter 5 does map it to `directTools: "search"`, but `mcp.json` drops every adapter-only field (`settings`, overrides). On Pi 0.84-0.87 adapters it is not read at all. It also leaves entries that a re-enabled built-in would connect. | `mcp-adapter.json` (adapter-native, reaches every adapter field) |
| `pi-mcp-adapter` as a devDependency | `ERESOLVE` risk above, heavy native deps, and it breaks the D-98-10 pin policy | Unpacked tarballs for research, `scripts/pi.sh` for live runs |
| `@earendil-works/pi-mcp` (Pi's MCP package, a 1.0 dependency of pi-coding-agent) | Built-in MCP internals, not an extension contract | Nothing; the adapter owns MCP |

## Stack Patterns by Variant

**If `pi-mcp-adapter` is absent:**
- Install still stages `mcp-adapter.json` entries and emits `{requires pi-mcp}`. Pi 1.0's built-in MCP does not read `mcp-adapter.json`, so nothing connects. That is the correct outcome under "adapter-only detection".

**If the user re-enables `builtin:mcp` while the adapter is installed:**
- Adapter 5 still owns `/mcp`, and Pi leaves the built-in out when another extension registers it. Status still comes only from `pi-mcp-adapter/status/v1`.

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| `pi-claude-marketplace` (this) | `pi-coding-agent@1.0.0`, `pi-tui@1.0.0` | Verified: tsc, unit 8529/8529, integration 67/67, e2e 14/14 (Pi runtime smoke, `resources_discover`, soft-dep install) |
| `pi-subagents@0.74.0` | Pi 1.0 | Peers all optional; `pi-ai >=0.86.1` |
| `pi-mcp-adapter@5.0.0` | Pi 1.0 (runtime) | npm peer metadata stops at `pi-ai ^0.99.0` (gap above). `engines.node >=20`. |
| `@quintinshaw/pi-dynamic-workflows@3.13.1` | Pi `>=0.80.8` per metadata | Pi 1.0 needs a live re-grade (canary) before the docs claim it |
| `typescript-eslint@8.71.0` | `typescript >=4.8.4 <6.1.0`, `eslint ^8.57 \|\| ^9 \|\| ^10` | Blocks TS 7 |
| `fallow@3.31.0` | Node >= 22 | Dev and CI only |
| `write-file-atomic@8.0.0` | Node `^22.22.2 \|\| ^24.15.0 \|\| >=26` | Already true today |

**Open question (NFR-4, user decision, not milestone scope by default):** `engines.node` still says `>=20.19.0`. Pi itself (`>=22.19.0`) and the runtime dependency `write-file-atomic@8` (`^22.22.2 || ^24.15.0 || >=26`) already make that unreachable. Raising the floor touches NFR-4 and needs an explicit decision.

## Sources

- npm registry, `npm view <pkg> version|peerDependencies|engines|time` for every package above (2026-10-01/02). HIGH: primary metadata.
- Unpacked tarballs in the session scratchpad: `pi-coding-agent@1.0.0` (CHANGELOG 0.87.1-1.0.0, `dist/core/extensions/types.d.ts`, `dist/core/package-manager.js` install args, `dist/extensions/mcp/index.js`), `pi-mcp-adapter@{4.0.0,5.0.0}` (CHANGELOG, `docs/configuration.md` file layout/precedence, `docs/extension-api.md` status snapshots, `types.ts`, `index.ts`), `pi-subagents@0.74.0`, `@quintinshaw/pi-dynamic-workflows@{3.13.0,3.13.1}` (diff). HIGH.
- Scratch copies of HEAD `8b6ac3bc` with Pi 1.0.0 (pi1) and all bumps (pi2): `tsc --noEmit`, `npm test`, `test:integration`, `test:e2e`, `test:architecture`, `test:analyzers`, `npm run fallow`, `prettier --check`, `eslint`, `lint:type-members`. HIGH: executed.
- npm 11.19.1 `--package-lock-only` resolution experiments for the `pi-ai` peer gap. HIGH: executed.
- GitHub API: `typescript-eslint` v8.71.0 release notes; `fallow-rs/fallow` tags v3.28.0/v3.31.0 and release notes v3.28-v3.31. HIGH.
- `git show` of features/mcp `74162ca6`, `5b1d8ef6`, `dac3a245`, `69e0870a`, `4f82096f`; `git apply --check` of each onto HEAD. HIGH.
- Not run: the live Stop canary and the live workflow-engine canary on Pi 1.0. They need a live Pi session with the stub provider; that is phase work.

---
*Stack research for: Pi extension, Claude plugin MCP delivery via pi-mcp-adapter 5*
*Researched: 2026-10-01*
