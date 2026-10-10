---
phase: 07-docs-and-live-proof
reviewed: 2026-10-09T00:00:00Z
depth: standard
files_reviewed: 21
files_reviewed_list:
  - .github/workflows/ci.yml
  - CHANGELOG.md
  - README.es.md
  - README.md
  - docs/env-vars.md
  - docs/hooks-compatibility.md
  - docs/mcp-compatibility.md
  - docs/output-catalog.md
  - docs/prd/pi-claude-marketplace-prd.md
  - extensions/pi-claude-marketplace/bridges/mcp/adapter-doc.ts
  - extensions/pi-claude-marketplace/platform/mcp-status.ts
  - package-lock.json
  - package.json
  - scripts/pi.sh
  - tests/architecture/peer-floor.test.ts
  - tests/bridges/mcp/adapter-entry.test.ts
  - tests/integration/mcp-override-lifecycle.test.ts
  - tests/live-uat/README.md
  - tests/live-uat/fixtures/mcp-adapter-canary/legacy-v0.19.2.json
  - tests/live-uat/mcp-adapter-canary.mjs
  - tests/live-uat/openai-stub-server.mjs
findings:
  critical: 0
  warning: 2
  info: 6
  total: 8
status: issues_found
---

# Phase 7: Code Review Report

**Reviewed:** 2026-10-09
**Depth:** standard
**Files Reviewed:** 21
**Status:** issues_found

## Structural Findings (fallow)

`fallow audit --changed-since ecc022bc`: verdict pass. Dead-code issues 0, complexity findings 0, duplication clone groups 0.

## Narrative Findings (AI reviewer)

## Summary

I reviewed the changes since `ecc022bc`: the move of the adapter peer floor to `>=5.2.0 <6`, the docs, the live canary, and the stub extension.

The floor move is complete. No adapter `5.1.0` pin remains in `extensions/`, `tests/`, `docs/`, `scripts/`, or CI. The four remaining `5.1.0` strings are plugin versions in update-row tests. The conformance harness (`tests/integration/pi-mcp-adapter-peer.ts`) reads the range from `package.json`, so it needs no literal pin. I checked every line citation in `adapter-entry.test.ts` against the 5.2.0 sources in `/var/tmp/mcp4-p7-research/a520`: `types.ts:397/438`, `config.ts:913/1346/1726/1972`, `metadata-cache.ts:109`, `project-server-trust.ts:68-79`, and `agent-plugin-provenance.ts:27-35`. All of them match. `npm view` confirms the `dist.shasum` `9950f0b4…`.

I checked these doc claims against the source, and they hold: the server-key rule (`domain/name.ts:248-252`), the stdio env injection with plugin keys winning (`bridges/mcp/substitute.ts:156-174`), `applyMcpAdapterEnv`, the migration causes and the removal arms (`orchestrators/reconcile/mcp-migration.ts`), and `PI_MCP_CONFIG_MODE` and `MCP_DIRECT_TOOLS` in the adapter.

The canary is well contained. Pi children get an environment built from scratch with `PI_OFFLINE`. The fixture paths are checked to stay inside the agent directory. The sandbox root is limited to safe characters before the JSON substitution. The stub logs no headers. The negative control is recorded.

The main problems: one doc section misstates the adapter's project-trust behavior, and the canary's cleanup promise fails on a signal.

## Warnings

### WR-01: "Project-scope servers" misstates when a headless session runs an unapproved server, and when the prompt repeats

**File:** `docs/mcp-compatibility.md:86-88`
**Issue:** The doc states two things that do not match pi-mcp-adapter 5.2.0 (`project-server-trust.ts:198-221`):

1. "A headless session ... skips a server that is not approved." This is not always true. The adapter skips the approval when the project is trusted, `!ctx.hasUI`, and `loaded.projectServerPolicy === "allow"` (line 204). In that case a headless print, JSON, or RPC session **runs** an unapproved project server. The text is security guidance about third-party plugin servers that run local commands. Readers will take it to mean that headless sessions never run an unapproved plugin server, and an adapter setting makes that false.
2. "...asks whether to allow the server the first time that the adapter loads it." `Don't allow` saves nothing. Only `approveProjectServer` writes a record (line 213). So the prompt comes back at every load until the user allows the server, not only "the first time" and "again after an update".

**Fix:** Describe both behaviors and keep the link to the adapter docs:

```markdown
- In a trusted project, an interactive session asks whether to allow the server each time the adapter loads it, until you allow it. `Don't allow` is the default, and the adapter does not remember it.
- A headless session, such as a print, JSON or RPC session, skips a server that is not approved, unless the pi-mcp-adapter setting `projectServerPolicy` is `allow`. With that setting, a headless session in a trusted project runs it.
```

### WR-02: The canary leaves its sandbox, and can leave Pi process groups, after Ctrl-C or SIGTERM, but it promises cleanup "on every exit"

**File:** `tests/live-uat/mcp-adapter-canary.mjs:683-686, 702-706, 1349-1393` (claim at lines 88-89; `tests/live-uat/README.md:495`)
**Issue:** Each Pi child starts with `detached: true`, so it gets its own process group. A terminal Ctrl-C reaches only the canary and the stub. The canary installs no `SIGINT`/`SIGTERM` handler, so Node exits at once. The `finally { await teardown(root) }` block never runs. The `hardStop` timers die with the parent.

As a result:

- The `mkdtemp` sandbox stays under `TMPDIR`. It holds the agent directory, `models.json`, the stub HTTP log, and the plugin servers.
- Each Pi child and any MCP server the adapter spawned keep running until Pi notices stdin EOF. Nothing guarantees that Pi notices it.
- On a `SIGTERM` sent only to the canary's PID, the stub (not detached) is orphaned too, still listening on loopback.

The header ("The sandbox is removed on every exit") and the README Prerequisites ("removes it on every exit") overstate the guarantee. The operator runs this canary by hand, so Ctrl-C during a 120 s model step is a normal way to stop it.

**Fix:** Route both signals through the same teardown:

```js
let sandboxRoot;
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.once(signal, () => {
    const done = sandboxRoot === undefined ? Promise.resolve() : teardown(sandboxRoot);
    done.finally(() => process.exit(EXIT_HUMAN_NEEDED));
  });
}
// in main(), right after mkdtemp:  sandboxRoot = root;
```

`closeSession` waits up to 15 s per session. In the signal path, call `killGroup` directly on each `liveSessions` member before the `rm`. Otherwise change the docs to say "on every normal exit".

## Info

### IN-01: A teardown failure replaces the verdict

**File:** `tests/live-uat/mcp-adapter-canary.mjs:1353-1373, 1386-1391`
**Issue:** `teardown(root)` runs in `finally`. If it throws (for example, `rm` fails on a busy file), that error replaces the in-flight `CanaryExit`. `exitCodeOf` then reports "unexpected harness error" with exit 1. An `ADOC-02 REGRESSION` (exit 2) would be downgraded to `human_needed`, which goes against the honesty contract the canary states.
**Fix:** Wrap the teardown so that it cannot replace the verdict. Report a teardown failure on stderr instead: `finally { await teardown(root).catch((error) => printErr(\`teardown: ${error?.message}\`)); }`.

### IN-02: "Every update ... changes the entry" holds only for stdio servers on a new commit

**File:** `docs/mcp-compatibility.md:87`
**Issue:** The clone key is `<urlhash>-<sha12>` (`domain/clone-key.ts:34-37`). The plugin root reaches an entry only through the injected stdio `env` (`substitute.ts:156-174`) or a `${CLAUDE_PLUGIN_ROOT}` reference. A remote (`url`) server entry with no root reference does not change on update. An update that resolves the same sha does not change any entry either. The re-approval claim is stronger than the behavior.
**Fix:** Write "An update of a plugin from its own git source changes the entry of each stdio server when the commit changes, because the plugin moves to a new clone directory."

### IN-03: Two different Claude Code versions are cited as evidence on one page

**File:** `docs/mcp-compatibility.md:7, 44`
**Issue:** Line 7 says the Claude Code column reflects the 2.1.291 binary. Line 44 cites 2.1.294 for the per-tool `alwaysLoad` behavior. A reader cannot tell which binary the table describes.
**Fix:** Say that the alwaysLoad row was checked on 2.1.294, or align line 7 with it.

### IN-04: The "Entries that stay in mcp.json" table leaves out an unreadable `mcp.json`

**File:** `docs/mcp-compatibility.md:279-288`
**Issue:** `mcp-migration.ts:704` emits a `file-unreadable` row for `mcp.json` as well as for `mcp-adapter.json` (line 722). The table lists only the `mcp-adapter.json` case. When the scope's `mcp.json` itself is not a valid configuration, nothing moves, and the doc gives no remedy.
**Fix:** Add a row: "The `mcp.json` file of the scope is not a valid MCP configuration. | Fix the file, then run `/reload`."

### IN-05: A recaptured fixture fails `format:check`, and the README does not say so

**File:** `tests/live-uat/mcp-adapter-canary.mjs:880`; `tests/live-uat/README.md:563-575`
**Issue:** `fixtureText` writes `JSON.stringify(fixture, null, 2)`, which puts each array element on its own line. The committed fixture is in Prettier's layout (`"args": ["@@SANDBOX@@/..."]`, `"mcpServers": ["echo"]`), and `.prettierignore` does not exclude it. After a `--capture-legacy` run, the commit fails `npm run check` (format:check) until someone runs Prettier.
**Fix:** In "Capturing the legacy fixture", add a step that runs `npx prettier --write tests/live-uat/fixtures/mcp-adapter-canary/legacy-v0.19.2.json` after the capture.

### IN-06: The stub's stderr is piped and never read, so its failure reason is lost

**File:** `tests/live-uat/mcp-adapter-canary.mjs:1150-1162`
**Issue:** The stub starts with `stdio: ["ignore", "pipe", "pipe"]`, and nothing reads its stderr. When `STUB_SCRIPT` is unusable, the stub's only diagnostic (`openai-stub: STUB_SCRIPT ... is unusable: ...`) is thrown away. The operator sees only "printed no port within 5000 ms". The verbatim Observed result in the README also commits the operator's absolute checkout path (`/home/acolomba/src/...`, README lines 583 and 610). The capture path refuses to write that path into the fixture, but this printed output is not masked. This is not a secret, but it is inconsistent.
**Fix:** Collect the stub's stderr the way `openSession` collects Pi's stderr, and pass it as the `detail` of the `humanNeeded` call. Optionally mask `REPO_ROOT` in `mask()`, as `<repo>`.

---

_Reviewed: 2026-10-09_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
