# Phase 6: Release Docs and Combined Tree - Pattern Map

**Mapped:** 2026-11-04
**Files analyzed:** 24 (grouped by the RESEARCH plan split A-L)
**Analogs found:** 22 / 24

All analog paths below are git-tracked source. Line numbers are on the combined tree (merge `a25cd35`).

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `features/mcp-server/implementation-switch.feature` (DUAL-04 rows) | test (cucumber) | request-response | `features/workflow/companion-missing.feature:46-58` (list row with `requires ...`) | exact |
| `features/mcp-server/agent-grants.feature` (new `@builtin-only` apply scenario) | test (cucumber) | event-driven | `agent-grants.feature:89-116` + `features/plugin/staging-warnings.feature:208-221` | exact |
| `orchestrators/plugin/update-swap.ts` (`updateAgentImplementation`) | service | transform | itself, lines 457-473 | exact |
| `test/orchestrators/plugin/update-swap.test.ts` | test | transform | itself, :2579-2622 | exact |
| `edge/register.ts` (completion resolver) | route/edge | request-response | itself, :177-185 | exact |
| `shared/completion-cache.ts` (key + file by implementation) | store | file-I/O | itself, `pluginIndexKey` :153, file write :287-302 | exact |
| `orchestrators/edge-deps.ts` (classify per implementation) | service | transform | `orchestrators/plugin/list-candidate-row.ts:154` (`resolutionFor(..., mcpImplementation)`) | role-match |
| `features/lib/plugin-completions.ts`, `features/step_definitions/completion.steps.ts` | test support | request-response | themselves (:20-28, :11-16) | exact |
| `features/mcp-server/verdict-list.feature` (completion pair) | test (cucumber) | request-response | `verdict-list.feature:9-55` (adapter/builtin pair) + `features/plugin/list.feature:46-49` (completion assertion) | exact |
| `orchestrators/mcp/recorded-servers.ts` (UF-1, UF-4) | service | file-I/O | `orchestrators/mcp/builtin-registration-step.ts:106-188` | exact |
| `orchestrators/mcp/builtin-registration-step.ts` (helpers move out) | service | file-I/O | itself | exact |
| `test/orchestrators/mcp/recorded-servers.test.ts` | test | file-I/O | `test/orchestrators/mcp/builtin-registration-step.test.ts:486-631`; own :170-197 for debug capture | exact |
| 9 `LegacyServersSource` call sites (info.ts, list-installed-row.ts, install-flow-results.ts x2, update-swap.ts, dependency-move.ts, reconcile/convergence.ts, mcp-verdict-read.ts) | service | transform | threading of `locations` already present at each site | role-match |
| `docs/output-catalog.md`, `docs/json-output.md` + `test/architecture/catalog-uat/fixtures/plugin-info.ts` + `catalog-contract.test.ts` | docs + test fixture | transform | commit `c48a1dd` (catalog fixtures changed together, counter stated in message) | role-match |
| `CHANGELOG.md` | docs | - | `CHANGELOG.md:7-40` (0.22.0 entry) | exact |
| `README.md`, `README.es.md` | docs | - | `README.md:29,40,126,144` and the same lines in `README.es.md` | exact |
| `docs/hooks-compatibility.md`, `docs/mcp-compatibility.md` | docs | - | themselves | exact |
| `.planning/BACKLOG.md` | record | - | `.planning/BACKLOG.md:5-26` (UAT-02) | exact |
| `.planning/PROJECT.md` (Key Decisions rows, D-CF1-16 amend) | record | - | `PROJECT.md:1893` (D-CF1-16), `:1983` (D-MB-01) | exact |
| `.fallowrc.json` | config | - | itself (entry + ignoreExports) | exact |
| `platform/pi-api.ts` (`piMcpAdapterLoaded` removal) + 34 test files | model | transform | none needed, mechanical | n/a |
| `features/lib/turn-records.ts` (`assertStandInsStopped` poll) | test support | event-driven | `features/lib/mcp-implementation.ts:399-416` (`waitUntilProcessesExit`) | role-match |
| `features/lib/mcp-builtin-tool-search.ts` -> `features/lib/upstream/` | test support | transform | `features/lib/upstream/index.ts` | partial |
| `.planning/DUBIOUS-CHOICES.md` (+ `git mv`) | record | - | none (new root log built from parent's working log) | no analog |

## Pattern Assignments

### `features/mcp-server/implementation-switch.feature` (DUAL-04)

**Analog:** `features/workflow/companion-missing.feature:46-58`. Copy the `list` read verbatim, swap the reason:

```gherkin
    When the user runs "/claude:plugin list"
    Then the result has these fields:
      | kind                | cascade     |
      | severity            | info        |
      | needs reload        | false       |
      | tally label         | Plugin list |
      | tally failures      | 0           |
      | tally warnings      | 0           |
      | tally success count | 1           |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id            | name | status    | reasons                       | scope | version |
      | fixtures         | user              | demo@fixtures | demo | installed | requires pi-dynamic-workflows | user  | 1.0.0   |
```

Insertion point: after `Then pi reports no extension error` (line 81), which follows `When the user restarts pi without pi-mcp-adapter` (line 79). Reasons cell becomes `requires mcp`. Add the D-P6-18 comment line above `When the user runs`. Keep the scope `@own-implementation` tag (line 50). No `call` numbers change, because `list` is not a model turn.

---

### `features/mcp-server/agent-grants.feature` (P4-DC-60 scenario)

**Analog A (whole scenario):** `agent-grants.feature:89-116`, `@builtin-only` "Updating a plugin ... built-in mcp grant (MGRT-01)". Copy it; replace only

```gherkin
    Given the user has run "/claude:plugin update demo@fixtures --scope user", which did not fail
```

with the apply step. Expected tool result keeps `tools mcp:plugin_demo_stub/echo` (built-in form; the adapter form is `mcp:plugin_demo_stub_/echo`, line 87).

**Analog B (apply converging a dir-source plugin):** `features/plugin/staging-warnings.feature:208-221` - catalog bumped with `Given the marketplace "fixtures" offers these plugins: | demo | 1.1.0 |`, then `/claude:plugin apply --scope <scope>`, result kind `reconcile-applied-cascade`, row status `updated` from `1.0.0` to `1.1.0`. As a Given: `Given the user has run "/claude:plugin apply --scope user", which did not fail`.

---

### `orchestrators/plugin/update-swap.ts` (P4-DC-60)

**Current** (lines 457-473):
```ts
/**
 * MGRT-01 / P4-DC-13: ... When the update arguments carry the active implementation
 * themselves, a parent line repoints this function at that field.
 */
function updateAgentImplementation(args: ThreePhaseArgs): ActiveMcpImplementation {
  if (!args.cascade) {
    return args.run.softDeps.mcpImplementation;
  }

  return args.preflightNotification?.run.softDeps.mcpImplementation ?? "none";
}
```
Target body: `return args.mcpImplementation;` (field is required on `ThreePhaseArgsBase`, :222-228). Rewrite the doc comment to cite MGRT-01 / D-MB-03 and drop the "parent line" sentence (comments cite durable IDs only). Tests: update the three cases at `update-swap.test.ts:2579-2622` (they set `run: builtinRun()` but `mcpImplementation: "none"`, :166/:1235), add the red case "cascade, `mcpImplementation: "builtin"`, no notification -> built-in form".

---

### `edge/register.ts` + `shared/completion-cache.ts` + `orchestrators/edge-deps.ts` (P3-DC-22)

**register.ts current** (:177-185):
```ts
    // This `process.cwd()` is the single sanctioned site.
    // ... Pinned by `test/edge/register.test.ts`, test "resolves argument
    // completions against the working directory the callback runs in".
    getArgumentCompletions: (prefix) =>
      getArgumentCompletions(prefix, makeLocationsResolver(process.cwd()), deps.completionCache),
```
Follow the same per-lookup read: read the implementation inside the arrow (per lookup), not at registration.

**completion-cache.ts key** (:153) and **file write** (:287-302):
```ts
function pluginIndexKey(scope: Scope, marketplace: string): string {
  return `${scope}::${marketplace}`;
}
...
  await atomicWriteJson(pluginCachePath, {
    schemaVersion: 6 as const,
    lastRefreshedAt: new Date().toISOString(),
    plugins: rows.map((r) => { ... }),
  });
  memPluginIndex.set(key, { rows, loadedAt: now() });
```
Extend the key with the implementation, and key `pluginCacheFile(...)` too (D-P6-22, Pitfall 6). If the on-disk shape changes, bump `schemaVersion`. Writes stay through `atomicWriteJson` (NFR-1).

**edge-deps.ts classification analog:** `orchestrators/plugin/list-candidate-row.ts:154` uses `resolutionFor(outcome.resolved, mcpImplementation)`; completions must use the same call so `list` and Tab agree.

**Harness** `features/lib/plugin-completions.ts:20-28`:
```ts
export async function pluginCompletions(
  prefix: string,
  cwd: string,
): Promise<readonly PluginCompletion[]> {
  return (
    (await getArgumentCompletions(prefix, makeLocationsResolver(cwd), createCompletionCache())) ??
    []
  );
}
```
Add an implementation parameter; `completion.steps.ts:11-16` passes `this.mcpProfile` (getter at `features/support/world.ts:223`).

**Scenario pair analog:** `features/mcp-server/verdict-list.feature:9-55` (`@adapter-only` sse plugin `installed` / `@builtin-only` `partially-available`, same Givens). Completion assertion shape from `features/plugin/list.feature:46-49`:
```gherkin
    When the user requests plugin completions for "update --partial --scope project "
    Then the plugin completion set for "update --partial --scope project " contains these suggestions:
      | label        | value                                            | description |
      | alpha@extras | "update --partial --scope project alpha@extras " |             |
```

---

### `orchestrators/mcp/recorded-servers.ts` (UF-4, UF-1)

**UF-4 analog** `builtin-registration-step.ts:106-108`:
```ts
function debugLog(detail: string): void {
  hookDebugLog(redactAbsolutePaths(detail), "mcp");
}
```
Target, `recorded-servers.ts:64`:
```ts
    hookDebugLog(`recorded MCP servers unreadable: ${errorMessage(err)}`, "mcp");
```
Wrap in `redactAbsolutePaths` (`shared/redact-absolute-paths.ts`). Test pattern (`test/orchestrators/mcp/recorded-servers.test.ts:170-181`), with `captureDebugLog` from `test/platform/debug-log-capture.ts`:
```ts
    const logged = captureDebugLog(t);
    ...
    when(() => reader(installRecord())).thenReject(new Error("manifest gone"));
    const recorded = await recordedMcpServers(record, reader);
    assert.deepStrictEqual(recorded, { kind: "unreadable" });
    assert.deepStrictEqual(logged, ["[mcp] recorded MCP servers unreadable: manifest gone"]);
```
New case: reject with an error naming an absolute path, expect `[redacted path]` in `logged`.

**UF-1 analog (move, do not copy -- fallow dupes):** `builtin-registration-step.ts:121-188`: `CLONE_KEY`, `cloneKeyOf`, `isPathMarketplace`, `owningRoot`, `isContained`:
```ts
async function owningRoot(source: RecordSource, locations: ScopedLocations): Promise<string> {
  const cloneKey = cloneKeyOf(source.record, locations.pluginClonesDir);
  if (cloneKey !== undefined) {
    if (!CLONE_KEY.test(cloneKey)) {
      throw new Error(`plugin root is not inside a plugin clone: ${cloneKey}`);
    }
    return locations.pluginCloneDir(cloneKey);
  }
  const { marketplace } = source;
  if (!isPathMarketplace(marketplace.source)) {
    const checkout = await locations.sourceCloneDir(source.marketplaceName);
    await assertPathInside(checkout, marketplace.marketplaceRoot, "marketplace root");
  }
  return marketplace.marketplaceRoot;
}

async function isContained(source: RecordSource, locations: ScopedLocations): Promise<boolean> {
  try {
    const root = await owningRoot(source, locations);
    await assertPathInside(root, source.record.resolvedSource, "plugin root");
    return true;
  } catch {
    return false;
  }
}
```
Add `locations: ScopedLocations` to `LegacyServersSource` (:70-78) and refuse before `recordedRootContext` (:110-128) with a new reason in `LegacyServersUnreadableReason` (:81-82, `"uncontained"`), using the existing `LegacyServersUnreadableError` shape (:88-100). Per D-P6-21 that error and reason become unexported; tests assert through `recordedMcpServers` / the public reader. The registration step keeps its own debug line ("its plugin root is outside its sources") by importing the moved function. `recorded-servers.ts` must stay outside NETWORK_SEAMS (header :12-13): `path-safety` and `persistence/locations` imports are fine.

**Containment test analog:** `test/orchestrators/mcp/builtin-registration-step.test.ts:609-631`:
```ts
  test("UF-1: a record whose plugin root runs through a symlink registers nothing and is logged", async (t) => {
    const fixture = await session(t);
    const logged = captureDebugLog(t);
    const outside = path.join(fixture.environment.root, "outside");
    await mkdir(outside, { recursive: true });
    await symlink(outside, path.join(fixture.marketplaceRoot, "linked"));
    await writeState(fixture, "user", {
      demo: installRecord(path.join(fixture.marketplaceRoot, "linked", "demo")),
    });
    ...
```
Reuse the four cases at :486-631 (symlink, `..`, wrong clone key, outside) against the reader.

---

### Catalog docs + fixture (D-P6-04, D-P6-19)

**Analog commit:** `c48a1dd` "refactor(mcp): put the McpDependency in each row's dependency list" changed `test/architecture/catalog-uat/fixtures/plugin-{import,install,list,reinstall}.ts` together and stated the counter in the message ("the catalog keeps 324 states and 54652 bytes"). For a byte-changing edit, change in one commit: `docs/output-catalog.md` block, `docs/json-output.md` line, the fixture literal (`fixtures/plugin-info.ts`, e.g. `requires: [{ companion: "pi-mcp-adapter", missing: true }]` at :86, and :115, :533-711), and the counter:
```ts
// test/architecture/catalog-uat/catalog-contract.test.ts:22
const EXPECTED_UTF8_BYTES = 54_652;
```
Assertions at :296-300 (`EXPECTED_MODULE_COUNT`, `EXPECTED_SECTION_COUNT`, `EXPECTED_STATE_COUNT` unchanged per D-P6-26). State the new byte count in the commit body. Gate: `npm run test:unpaired`.

---

### `CHANGELOG.md`

**Analog** `CHANGELOG.md:7-12`:
```markdown
## [0.22.0] - 2026-11-03

- Plugin skills, commands, agents, hooks, MCP servers, and workflows now work more like Claude Code, project plugins follow Pi's trust, and Pi 1.4.0 is required. (#295)

  - The extension now needs Pi 1.4.0 or newer, and each companion extension now needs its latest release.
  - Plugin MCP servers now need pi-mcp-adapter 7.0.0 or a later 7.x release, ...
```
Replace `[Unreleased]`'s single bullet (`- The extension now needs Pi 1.5.0 or newer.`, line 5) with one lead bullet, no PR number yet, and fold the Pi 1.5.0 line in as the first sub-bullet. Sub-bullets: two-space indent, blank line after the lead, present tense "now", <=40 words, "as in Claude Code" where parity applies.

### `README.md` / `README.es.md`

Synced passages to edit, same line numbers in both files:
- `:29` `- MCP servers. Requires [pi-mcp-adapter](...)` / `- Servidores MCP. Requiere [pi-mcp-adapter](...)`
- `:40` the companion requirement line
- `:126` naming paragraph (add the built-in `-`->`_` fold and the 55-char cut, D-MB-13)
- `:144` "a feature pi-mcp-adapter cannot run" (now implementation-dependent)

Each English edit gets the Spanish edit in the same commit (`readme` skill).

### `.planning/BACKLOG.md`

**Analog** `BACKLOG.md:5-26` (UAT-02): `## <ID>: <title>` heading, a "Surfaced by" paragraph naming the source, "Candidate directions" bullets, and a "Workaround today" line. Closed items use `## ~~ID: title~~ -- CLOSED`. One entry per D-P6-12 item with its source ID (MCPV2-01, P2-DC-22, P5-DC-15, ...). The P2-DC-77 entry, if needed, carries the drafted upstream report as a fenced block, filed by no one.

### `.planning/PROJECT.md`

**Row analogs:** `PROJECT.md:1983` (D-MB-01): `| **D-MB-NN (mcp-builtin, <who/when>): <decision>**. <detail> | <rationale> | -- Locked |`. Use `-- Pending` for D-MB-08..13. D-CF1-16 at `:1893` appends a sentence per measurement: "Measured <date> on a hosted runner (CI run <id>, head <sha>): <leg> <m min s s> (cucumber step ..., N scenarios) ..., so `timeout-minutes` stays at 15." Apply the 1.5x rule (D-P6-25).

### `features/lib/turn-records.ts` (P2-DC-77)

**Analog:** `features/lib/mcp-implementation.ts:399-416` `waitUntilProcessesExit(pids, timeoutMs)`, POLL_MS 50, used with `STUB_EXIT_TIMEOUT_MS = 10_000` (`features/support/pi-process.ts:92, :244`). Implement the poll inside `turn-records.ts`; do not import from `mcp-implementation.ts`, which imports `isRunning` from `turn-records.ts` (:47) -- a cycle fails `fallow dead-code --no-production --circular-deps`.

## Shared Patterns

### Debug logging with redaction
**Source:** `orchestrators/mcp/builtin-registration-step.ts:106-108`. **Apply to:** every new `hookDebugLog` line that may carry a path.

### Path containment (NFR-10)
**Source:** `shared/path-safety.ts` `assertPathInside(root, candidate, label)`, used as in `builtin-registration-step.ts:154-183`. **Apply to:** UF-1. Never a `startsWith` check.

### Debug-channel test capture
**Source:** `test/platform/debug-log-capture.ts` `captureDebugLog(t)` -> `string[]` of `[<category>] <message>`. **Apply to:** recorded-servers and registration-step tests.

### Profile pairs
`@adapter-only` / `@builtin-only` siblings with identical Givens and differing Then rows (`verdict-list.feature:9-55`, `agent-grants.feature`). `@own-implementation` runs only under the adapter profile.

### Commit discipline
Catalog byte changes, fixture, and counter in one commit (c48a1dd). Commit titles carry no phase/plan ID. Each SUMMARY has `## Threat Flags`.

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| `.planning/DUBIOUS-CHOICES.md` (new root log) | record | - | Built from the parent's working log; only analog is the previous milestone's file being moved by `git mv` |
| `piMcpAdapterLoaded` removal across 34 files | refactor | - | Mechanical; repoint readers to `mcpImplementation` (D-P6-09) |

## Metadata

**Analog search scope:** `features/**`, `extensions/pi-claude-marketplace/{edge,shared,orchestrators}/**`, `test/orchestrators/mcp/**`, `test/architecture/catalog-uat/**`, CHANGELOG/README/BACKLOG/PROJECT, `git log`.
**Files scanned:** ~20
**Pattern extraction date:** 2026-11-04
