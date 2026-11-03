# Upstream fixes for pi-subagents: MCP direct tools with pi-mcp-adapter 7

Patch: `pi-subagents-mcp-direct-tools.patch` (two commits, made with `git format-patch`).
Repository: https://github.com/nicobailon/pi-subagents
Base commit: `e9a31b3` (`main` on 2026-11-02, package version 0.84.0). Local branch:
`fix/mcp-direct-tools-adapter-7` in `/home/user/nicobailon/pi-subagents`.

`main` still has both bugs. The code is the same as in the published 0.84.0 (which ships
compiled `.js`; the repository has the `.ts` source).

## Problem 1: `directTools: "search"` drops the server

pi-mcp-adapter 7.0.0 accepts `directTools: "search"` on a server and in `settings`
(`types.ts`: `directTools?: boolean | string[] | "search"`). The pi-subagents config
validator `isMcpServerDefinition` (`src/runs/shared/mcp-config-sources.ts`) accepts only a
boolean or a string array. So it drops a server with `"search"` from the loaded config.
Every `mcp:<server>/<tool>` selector for that server is then reported as
"Unresolved MCP direct-tool selectors", also in a background child. The same check
rejects a runtime snapshot of such a server ("Invalid MCP runtime snapshot").
`parseSettings` also dropped a global `settings.directTools: "search"`.

### What "search" means in the adapter

In the adapter, `"search"` registers the same tools as `true`, but inactive. A tool
becomes active when `mcp({ search })` matches it or `mcp({ tool })` calls it
(`direct-tool-surface.ts`, `mcp-references.ts`: "search registers the same tool set as
`true`; only activation differs"). It does not change the tool names or the server's
cache hash (`computeServerHash` does not hash `directTools`; checked: same hash with and
without it).

### Where pi-subagents reads `directTools`

Nowhere else. Selector resolution (`planMcpDirectToolGrant`) does not read the server's
`directTools`, and `docs/agents.md` says children get MCP tools only from `mcp:` entries.
In the child, pi-subagents sets `MCP_DIRECT_TOOLS` to the selected tools, and the adapter
lets that environment selection override `directTools`, so a `"search"` server's selected
tools register in the child as normal direct tools. So the fix only needs the validator
and types to accept `"search"`; no other code has to treat it like `true`.

### Change (commit 1)

- `mcp-config-sources.ts`: `McpServerDefinition.directTools` type adds `"search"`;
  `isMcpServerDefinition` accepts it.
- `mcp-direct-tool-allowlist.ts`: `McpConfig.settings.directTools` type adds `"search"`;
  `parseSettings` keeps it.

### Test

`test/unit/mcp-direct-tool-resolution.test.ts`: "resolves direct tools from a server whose
directTools is "search"". It writes `mcp-adapter.json` with that server and a matching
metadata cache, and checks that all three selectors resolve. It fails without the change
(selectors unresolved).

## Problem 2: `${NAME:-default}` hashes differently from the adapter

The adapter caches tool metadata per server under a hash of the server config
(`computeServerHash`, `metadata-cache.ts`). pi-subagents recomputes that hash
(`computeMcpServerHash`) to find the server's cached tools. The adapter's
`interpolateEnvVars` (`utils.ts`) expands `${NAME:-default}` (the default is used only
when NAME is unset, as in Claude Code), `${NAME}`, `$env:NAME` and `{env:NAME}`.
pi-subagents expanded only `${NAME}`, `$env:NAME` and `{env:NAME}`. So for a server with a
default in `env`, `headers`, `command`/`cwd`/`socket`, `requestHeadersCommand` or
`bearerToken`, the hashes differ, the cache entry is treated as invalid, and the server's
selectors stay unresolved.

A `url` with a default is worse: pi-subagents left `${NAME:-...}` in the text, the URL did
not parse, and `validateSelectedServerDefinitions` threw "Invalid MCP server URL after
environment interpolation", which fails the launch. The adapter also does not count a
variable that has a default as missing (`getMissingEnvVars`).

### Change (commit 2)

`mcp-direct-tool-allowlist.ts`:

- `interpolateEnvVars` uses the adapter's pattern `\$\{(\w+)(?::-([^}]*))?\}` and the
  same `env[name] ?? fallback ?? ""` rule. An empty but set variable stays empty, as in
  the adapter.
- `getMissingEnvVars` uses the adapter's pattern and skips a variable that has a default.

Both are now the same as the adapter 7.0.0 code, except that they read `process.env`
directly (pi-subagents has no `environment` parameter).

### Test

Same test file: "expands ${NAME:-default} like pi-mcp-adapter 7.0.0 when hashing". It sets
`PI_SUBAGENTS_TEST_SET=set-value`, `PI_SUBAGENTS_TEST_EMPTY=""`, unsets
`PI_SUBAGENTS_TEST_UNSET`, restores them afterwards, and pins five hashes computed by
pi-mcp-adapter 7.0.0's own `computeServerHash` in the same environment: env default
unset / set / set-but-empty, header default unset, and url default unset. It follows the
existing test that pins 3.1.0 hashes as literals. All five fail without the change;
plain `${NAME}` already matched. The comparison was run with the adapter's
`dist/metadata-cache.js` against the patched source.

## Checks run

- `npm run typecheck`: passes.
- `test/unit/mcp-direct-tool-resolution.test.ts`: 6/6 pass; each new test fails on `main`.
- `npm run test:unit`: 4305 pass, 1 fail. The failure is
  `test/unit/settings-atomic-save.test.ts` (EACCES on cleanup of a read-only fixture);
  it fails the same way on `main` in this sandbox (runs as root).
- `test/integration/in-process-child.test.ts` and `claude-code-dispatch.test.ts`: 52/52.
- Full `npm run test:integration`: not completed. It hit the 10-minute limit, with
  timing failures in async-runner suites (`async execution utilities`, deadline
  checkpoint) that do not touch MCP config. Not run on `main` for comparison.
- `oxlint` on the three touched files: same findings before and after (the repository
  has many existing findings and CI does not run oxlint).
- Not run: smoke tests, native-host and clean-install CI jobs, Windows/macOS.
- `git am` of the patch on a clean checkout of `e9a31b3` gives the same tree as the branch.

## Changelog

Not in the commits. The repository credits outside contributors in `CHANGELOG.md` with the
PR number ("Thanks to @login for #NNNN."), and the number is not known before the PR is
opened. After opening the PR, add under `## [Unreleased]` / `### Fixed`:

```markdown
- A direct MCP tool (`mcp:` entry) from a server whose pi-mcp-adapter config sets `directTools: "search"` now resolves. Before, the server was dropped from the config and its selectors were reported as unresolved. Thanks to [@acolomba](https://github.com/acolomba) for #NNNN.
- A direct MCP tool from a server whose config uses `${NAME:-default}` now resolves. pi-subagents now expands the default as pi-mcp-adapter does, so its cache key matches the adapter's. Before, the selectors stayed unresolved, and a server `url` with a default failed the launch. Thanks to [@acolomba](https://github.com/acolomba) for #NNNN.
```

## Draft PR

The repository has no PR template. One PR with both commits; split it if the maintainer
prefers.

**Title:** `fix: resolve mcp: selectors for pi-mcp-adapter 7 "search" and ${NAME:-default} configs`

**Body:**

```markdown
Two pi-mcp-adapter 7 config forms make pi-subagents report a child's `mcp:` selectors as unresolved, even though the adapter loads the server and caches its tools.

**1. `directTools: "search"`.** The adapter accepts it on a server and in `settings`. `isMcpServerDefinition` accepts only a boolean or a string array, so it drops the server from the config (and rejects a runtime snapshot of it). This change accepts `"search"` in both types. Nothing else needs to change: selector resolution does not read `directTools`, the adapter does not hash it, and in the child the `MCP_DIRECT_TOOLS` selection overrides it.

**2. `${NAME:-default}`.** The adapter expands it (default only when NAME is unset) before it hashes a server for its metadata cache. `computeMcpServerHash` expanded only `${NAME}`, so the hashes differ and the cache entry is skipped. A `url` with a default did not parse, which failed the launch. `interpolateEnvVars` and `getMissingEnvVars` now use the adapter's pattern.

Tests in `test/unit/mcp-direct-tool-resolution.test.ts`:
- a server with `directTools: "search"` resolves its selectors;
- five hashes with defaults (env unset/set/empty, header, url) equal values from pi-mcp-adapter 7.0.0's `computeServerHash`.

Both fail on `main`. `npm run typecheck` and `npm run test:unit` pass, except `settings-atomic-save.test.ts`, which fails the same way on `main` in my environment (root user).
```

## Applying the patch

```sh
git clone https://github.com/nicobailon/pi-subagents
cd pi-subagents
git checkout -b fix/mcp-direct-tools-adapter-7 e9a31b3   # or current main
git am /path/to/pi-subagents-mcp-direct-tools.patch
npm ci --ignore-scripts
npm run typecheck
node --experimental-strip-types --import ./test/support/isolated-temp-root.mjs --test test/unit/mcp-direct-tool-resolution.test.ts
```

If `main` has moved and `git am` stops, use `git am -3` and resolve, or apply the two small
hunks by hand.

## Not fixed here

The adapter's `computeServerHash` has two more inputs that pi-subagents does not mirror:
`openUi: false` is hashed, and built-in agent-plugin servers keep `env`, `headers` and
`cwd` literal (`isBuiltInAgentPlugin`). A server using either still gets a different hash.
Left out to keep the PR to the two reported bugs.
