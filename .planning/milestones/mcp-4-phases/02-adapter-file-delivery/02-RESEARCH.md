# Phase 2: Adapter-file delivery - Research

**Researched:** 2026-10-02
**Domain:** Pi extension MCP bridge retarget: JSONC-safe read-merge-write of a shared, user- and adapter-edited config file (`<scopeRoot>/mcp-adapter.json`), adapter 5 collision precedence, override carry-forward
**Confidence:** HIGH for the code seams and the adapter 5.0.0 contract (read this session from the repo and from the unpacked `pi-mcp-adapter@5.0.0` tarball). MEDIUM for the warning-surface design (a planner/user scope call).

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

Decision IDs are milestone-scoped and collide with v1.20 IDs already cited in
source; source comments cite requirement IDs (AFILE-0N), never `D-02-NN`.

#### Locked by requirements (recorded, not re-discussed)
- **D-02-01:** Read `mcp-adapter.json` with the adapter's own grammar (BOM
  strip, comments, trailing commas). A file that cannot be parsed refuses the
  operation with a typed error naming the file and keeps its exact bytes; it is
  never treated as empty (AFILE-02). Every foreign key (`settings`, `imports`,
  `claudePlugins`, user servers) survives a write.
- **D-02-02:** When the existing file keeps servers under the legacy
  `mcp-servers` key, our entries go under that key; the ours/theirs partition
  enumerates both keys (AFILE-03).
- **D-02-03:** Collision detection follows adapter 5's nine-source, later-wins
  precedence and names the winning source; an entry with no `command`, `url` or
  `socket` is an override, not a collision (AFILE-05, closes MCPSRC-01).
  Whether a collision refuses or warns keeps today's bridge semantics.
- **D-02-04:** The NFR-10 write set, `persistence/locations.ts` and the
  containment gates name the new file; `mcp.json` stays in the write set for
  the Phase 5 sweep (AFILE-01).

#### Comment handling (AFILE-04)
- **D-02-05:** Warn when the bytes we read contained JSONC comments and we
  rewrite the file (our writer drops them). In practice this fires once per
  file, because the rewrite removes the comments. No new persisted state, no
  `.bak` copy, no comment-preserving editor (out of scope per REQUIREMENTS).

#### User overrides (AFILE-06)
- **D-02-06:** The carried-forward field set is closed: `disabled`,
  `approveTools`, `includeTools`, `excludeTools`, `lifecycle`, `idleTimeout`,
  `requestTimeoutMs`, `debug`, `searchKeywords`. On update or reinstall, each of
  these that the previous marked entry carries is copied into the new entry.
  `directTools` and `toolPrefix` are owned by this extension and always
  rewritten (Phase 3 stamps them), so an adapter-panel direct-tools toggle
  resets on update. The list is pinned against the adapter 5.0.0 `ServerEntry`
  type by a test, so a field the adapter adds later is a visible decision, not
  a silent omission. — **Reversibility:** costly — changing the set later
  changes which user choices survive updates.

#### Uninstall and overlays
- **D-02-07:** Uninstall removes only marked entries. A marker-less override
  stub keyed by one of our server names (for example `{ "disabled": true }`
  written by `/mcp-adapter disable` into the project file) is left in place; it
  is user-authored and inert without a full definition.

### Claude's Discretion
- Module split: extract the JSONC document reader and the entry handling out of
  `bridges/mcp/stage.ts` up front (it sits near fallow's `maxUnitSize` and
  cognitive-complexity ceilings); names are the planner's.
- The exact warning wording, as a closed-catalog amendment in
  `docs/output-catalog.md`.
- How the JSONC parse is implemented (no new runtime dependency unless the
  planner justifies one; the adapter uses `strip-json-comments`).

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.

### Specific Ideas (from CONTEXT.md, carried as test requirements)
- Test fixtures must include comments, trailing commas, a BOM, the `mcp-servers`
  key, and a `{ "disabled": true }` stub (the research's warning signs).
- Feed the same fixture to our parser and the adapter's grammar in one test.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| AFILE-01 | Install writes marked entries into `<scopeRoot>/mcp-adapter.json`; uninstall removes exactly those; NFR-10 write set includes the new file | §Architecture Pattern 1 (`mcpAdapterJsonPath`), §Caller Inventory (every touch point is inside the bridge except `prune-rollback.ts`), §NFR-10 text sites |
| AFILE-02 | JSONC (comments, trailing commas, BOM) read like the adapter; unparseable file refused with a typed error, never replaced; foreign keys survive | §Standard Stack (`strip-json-comments@^5.0.3`, the adapter's own dependency), §Pattern 2 (adapter-doc reader), §Pitfall 1, 2, 7 |
| AFILE-03 | Legacy `mcp-servers` key: our entries go under it | §Pattern 2 server-key rule (copied from the adapter's own `writeProjectServerDisabledOverride`), §Pitfall 3 |
| AFILE-04 | Warn once when a rewrite drops comments | §Pattern 5 (detection is one `stripJsonComments(text) !== text` compare), §Pitfall 4 (MCP bridge warnings are swallowed in standalone mode today), §Warning-surface inventory |
| AFILE-05 | Nine-source later-wins collision walk; partial entry = override (closes MCPSRC-01) | §Pattern 3 (source list verbatim from adapter 5.0.0 `getConfigSources`), full-definition rule from `mergeServerMaps` |
| AFILE-06 | User overrides survive update/reinstall; closed set recorded and pinned | §Pattern 4 (carry-forward in prepare), §ServerEntry 35-field verbatim list for the pin test, §Pitfall 5 (plugin-sourced values become sticky) |
</phase_requirements>

## Project Constraints (from CLAUDE.md / AGENTS.md)

These carry the same authority as locked decisions.

- **NFR-1:** every disk mutation is atomic (tmp + rename / `atomicWriteJson`).
- **NFR-2 / NFR-3:** no fix may need a Pi restart; every operation is idempotent or fail-clean. A parse refusal must leave the file byte-identical.
- **NFR-5:** `install`/`uninstall`/`list`/`info` paths stay network-free. Nothing in this phase touches the network.
- **NFR-10 (AGENTS.md:65):** "Refuse to write outside `<scopeRoot>/pi-claude-marketplace/`, `<scopeRoot>/agents/`, or `<scopeRoot>/mcp.json`". This phase extends the set with `<scopeRoot>/mcp-adapter.json` and keeps `mcp.json` (D-02-04).
- **IL-2:** all user-visible output goes through `shared/notification-dispatch.ts` (`notify`, `notifyDiagnostic`, ...). Bridges have no `ctx` and must not notify.
- **Upstream parity:** Claude Code behavior is the default. CONTEXT records that keeping a user's `/mcp` disable across plugin updates is the parity behavior; the file format is the adapter's contract (Pi capability gap).
- **TypeScript strict**, `exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`; no `!` / `as` escapes in `extensions/` (memory: compiler-forced unreachable branches).
- **Two independent complexity gates:** ESLint `sonarjs/cognitive-complexity: 15` and fallow `maxCognitive: 15`, `maxCyclomatic: 20`, `maxUnitSize: 60`. Both must pass.
- **Test rules (`skills/typescript-unit-testing`):** one mirrored `.test.ts` per production module (including type-only and barrels); 100% direct function/line/branch coverage per pair; whole-value `deepStrictEqual`; errors asserted by class and fields; no export added for a test; real temp dirs for filesystem behavior; expected values built independently of production code.
- **Comments (`skills/typescript-comments`):** cite `AFILE-0N` / `NFR-N` / `MC-N` IDs, never `D-02-NN` (CONTEXT), never phase/plan numbers; present tense, no "former X" narration.
- **Architecture gate files (D-07-05/D-07-06):** any `tests/architecture/**` file that names a production path must register it in `tests/architecture/gate-targets.ts` as a full literal path, and must not assemble a `.ts` name from `path.join` segments.
- **Git:** never commit to `main`; Conventional Commits; run `pre-commit run --files ...` before committing; `SKIP=trufflehog` inside worktrees; never `--no-verify`.
- **Verification policy (`skills/local-verification`):** focused owner tests + pre-commit per task; full `npm run check` at the phase/merge gate.

## Summary

Every lifecycle verb reaches the MCP file through exactly two bridge entry points: `prepareStageMcpServers` (+ `commitPreparedMcp` / `replacePreparedMcp` / `rollbackMcpReplacement`) in `bridges/mcp/stage.ts`, and `unstageMcpServers` in `bridges/mcp/unstage.ts`. Install, update, reinstall, enable (through `runInstallLedger`), uninstall, disable, marketplace remove, prune and every reconcile/import cascade call those and name no path of their own. The single exception is `orchestrators/plugin/prune-rollback.ts`, which snapshots `locations.mcpJsonPath` directly. So the retarget is: add `mcpAdapterJsonPath` to `ScopedLocations`, point the bridge at it, add the snapshot, and update the NFR-10 text. [VERIFIED: grep of `extensions/` for `mcpJsonPath` and for every bridge export; Read of the call sites]

The hard parts are inside the bridge. Today `readScopedDoc` uses `JSON.parse` and, on failure, returns `{ doc: {}, malformed: true }`, after which the commit **replaces the file** (`stage.ts:62-90`, warning text at `stage.ts:300`). That is exactly the AFILE-02 failure. The adapter reads with `JSON.parse(stripJsonComments(stripUtf8Bom(raw), { trailingCommas: true }))` (adapter `utils.ts:9-15`) and reads the server map as `raw.mcpServers ?? raw["mcp-servers"]` (`config.ts:1289`). The cheapest way to match that grammar exactly is to depend on the same library at the same major (`strip-json-comments@^5.0.3`, zero dependencies, 113-line `index.js`, no postinstall, legitimacy verdict OK). The collision walk is the other large change: today it reads four files with first-declarer-wins (`collision-slots.ts:135-142, 181-182`); adapter 5 reads nine sources with later-wins and merges per field.

Two findings the milestone research did not have. **(1)** MCP bridge warnings are a *hygiene* channel: `splitStagingWarnings` puts `mcp` in the `bridge` half (`orchestrators/plugin/shared.ts:1551-1561`), and install's `push()` only forwards those in orchestrated mode (`install-flow.ts:725-730`). A comment-dropped warning added to `result.warnings` would never reach a user who runs a standalone `/claude:plugin install`. Uninstall, disable, marketplace remove and prune have no diagnostic channel at all, and `cascadeUnstagePlugin` drops `UnstageMcpResult.warnings`. AFILE-04 needs its own routing. **(2)** V8's `JSON.parse` error text can echo file content (`Unexpected token 's', "{"a": sk-secret-abc}" is not valid JSON`), so the AFILE-02 typed error must not carry the raw parse message into the user-visible cause chain.

**Primary recommendation:** Add `strip-json-comments@^5.0.3` as a runtime dependency. Split the bridge into `adapter-doc.ts` (read/parse/key-select/write-shape), `adapter-entry.ts` (stamp + carry-forward), a rewritten `collision-slots.ts` (nine sources), and a slim `stage.ts`/`unstage.ts`. Give the bridge results a structured comment notice that the orchestrators route to a user-visible channel.

## Architectural Responsibility Map

The browser/SSR/API tiers do not apply. This is a Pi extension with layered zones. The map uses the project's fallow zones.

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Path of `mcp-adapter.json` per scope | `persistence/locations.ts` | — | Single source of every writable path (SC-2/SC-3); NFR-10 by construction |
| JSONC read, server-key selection, refuse-not-replace | `bridges-mcp` (`adapter-doc.ts`) | `shared/errors-bridges.ts` (typed error) | Only the bridge knows the doc shape; errors are shared typed classes |
| Ours/theirs/overlay partition, carry-forward, stamping | `bridges-mcp` (`adapter-entry.ts`, `stage.ts`) | `bridges-mcp/marker.ts` (MC-5, unchanged) | Marker-keyed ownership is a bridge contract |
| Nine-source collision walk | `bridges-mcp` (`collision-slots.ts`) | `platform/pi-api.ts` (`getAgentDir`) | Already a bridge-local module; `bridges-mcp -> platform` is an allowed edge |
| Comment-dropped warning, user-visible | orchestrators (`orchestrators/plugin/*`, reconcile/import cascades) | `shared/notification-dispatch.ts` (`notifyDiagnostic`) | IL-2: bridges return structured facts, orchestrators notify |
| Prune rollback snapshot of the new file | `orchestrators/plugin/prune-rollback.ts` | — | Only direct path consumer outside the bridge |
| Collision refusal rendering | orchestrators (failed row + `cause:` trailer) | — | Existing Branch 4 of `composeInstallFailureMessage` renders any typed throw |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `strip-json-comments` | `^5.0.3` (5.0.3, published 2025-08-08) | Strip `//` and `/* */` comments and trailing commas before `JSON.parse` | It is the exact library and options pi-mcp-adapter 5.0.0 uses (`"strip-json-comments": "^5.0.3"` in the adapter's `package.json`; `parseJsonWithComments` in `utils.ts:13-15`). Same library, same major means grammar parity by construction. Zero dependencies, ESM default export with bundled `index.d.ts`, `engines.node >=14.16`, MIT. [VERIFIED: npm registry `npm view` + adapter 5.0.0 `package.json` + `gsd-tools package-legitimacy` verdict OK] |
| `write-file-atomic` | `^8.0.0` (already a dependency) | NFR-1 atomic write via `shared/atomic-json.ts` | Unchanged. Writes `JSON.stringify(value, null, 2) + "\n"`. The adapter's own writer writes `` `${JSON.stringify(raw, null, 2)}\n` `` (`config.ts:1648-1650`), so both writers produce the same layout. [VERIFIED: Read `shared/atomic-json.ts`; adapter `config.ts`] |
| `typebox` | `^1.3.34` (already) | Not needed in this phase | Entries keep today's shape (`Record<string, unknown>`); no schema is introduced. |

### Supporting
None. `proper-lockfile` and `typebox` are unchanged.

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `strip-json-comments` runtime dep | Hand-rolled scanner in `adapter-doc.ts` + `strip-json-comments` as a **devDependency** for a differential test | No runtime dependency, but ~60-100 lines of state machine we own. It has to fit the cognitive-15 ceilings in both gates (a char-loop state machine usually needs splitting). It also has to reproduce quirks exactly: an unterminated `/*` is left in place and fails `JSON.parse`; a comment between a comma and `}` still strips the comma; `"http://x/*y*/"` inside a string is untouched; `\r\n` ends a line comment (all verified this session against 5.0.3). The differential test then needs a fixture corpus to mean anything. Choose this only if the user rejects a new runtime dependency. |
| `strip-json-comments` | `jsonc-parser` (Microsoft, legitimacy OK) | Comment-*preserving* edits are possible with `modify`/`applyEdits`, but REQUIREMENTS puts a comment-preserving editor out of scope (D-02-05). Its grammar is also not the adapter's, so AFILE-02 parity would be by test, not by construction. |
| Our own collision walk | Import the adapter's `./config` `getServerProvenance()` | Rejected in milestone research (FEATURES "Anti-features"): it turns the optional peer into a runtime dependency, and STACK.md forbids `pi-mcp-adapter` in `dependencies`/`devDependencies` (ERESOLVE, native deps, D-98-10). |

**Installation:**
```bash
npm install strip-json-comments@^5.0.3
```
Record the justification beside the decision: AFILE-02 requires "read the way the adapter reads it", and the adapter reads with this library. STACK.md's "No new runtime dependency" line was written about the *write* side, before the JSONC read requirement existed.

**Version verification (this session):** `npm view strip-json-comments version` → `5.0.3`; `time.modified` 2025-08-08; `scripts.postinstall` absent; `dist.unpackedSize` 8200. `npm ls strip-json-comments` → empty, so it is not already in the tree transitively.

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| `strip-json-comments` | npm | v5.0.3 published 2025-08-08 (package ~10 yrs) | 259,494,685/wk | github.com/sindresorhus/strip-json-comments | OK | Approved (discovered from pi-mcp-adapter 5.0.0's own `package.json`, the authoritative "what the adapter uses" source) |
| `jsonc-parser` | npm | v3.3.1 published 2024-06-24 | 85,194,487/wk | github.com/microsoft/node-jsonc-parser | OK | Not recommended (alternative only) |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none
**Postinstall check:** `strip-json-comments` has no `postinstall` script (`npm view ... scripts.postinstall` empty; the `gsd-tools` signal also reports `postinstall: null`).

## Architecture Patterns

### System Architecture Diagram

```text
 lifecycle verb (install / update / reinstall / enable)        (uninstall / disable / mp remove / prune / reconcile)
        │                                                                   │
        ▼                                                                   ▼
 prepareStageMcpServers(input)                                   unstageMcpServers(input)
        │                                                                   │
        ├─► adapter-doc.readAdapterDoc(locations.mcpAdapterJsonPath) ◄──────┤
        │      absent ──────────────► empty doc, key = "mcpServers"         │
        │      unparseable / top-level non-object ──► throw typed error ────┼─► verb fails, file bytes untouched
        │      present ──► { doc, serverKey, servers, hadComments }         │
        │                                                                   │
        ├─► partition(servers across BOTH keys) → ours | overlays | theirs  ├─► drop every entry marked (plugin, mp)
        │                                                                   │    in BOTH keys; keep marker-less stubs
        ├─► collision-slots: nine sources, later-wins, full-def only        │    nothing removed → no write, no notice
        │      other full declarer ──► throw McpServerCollisionError        │
        │                                                                   │
        ├─► adapter-entry: stamp (substitute + inject + marker)             │
        │      + carry forward the closed field set from ours[name]         │
        │                                                                   │
        ├─► next doc = doc with servers written under serverKey only        │
        │    (no new servers and no ours → AS-8 noop, no write)             │
        ▼                                                                   ▼
 commit: atomicWriteJson(mcpAdapterJsonPath)                    atomicWriteJson(mcpAdapterJsonPath)
        │  result.recorded → state.json (unchanged plumbing)                │
        │  result notice: commentsDropped(path, scope) if hadComments       │  same notice
        ▼                                                                   ▼
 orchestrator routes the notice to a user-visible channel (notifyDiagnostic / postCommitWarnings)
```

### Recommended Module Layout (delta)

```text
extensions/pi-claude-marketplace/
├── bridges/mcp/
│   ├── adapter-doc.ts        # + JSONC read (strip-json-comments), BOM strip, empty/comment-only = empty doc,
│   │                         #   refuse on unparseable or non-object top level, server-key selection,
│   │                         #   both-key classification (moves classifyMcpServers here), write-shape helper
│   ├── adapter-entry.ts      # + stampServers (moved from stage.ts) + closed carry-forward (AFILE-06);
│   │                         #   Phase 3 adds name/directTools/translation here (ARCHITECTURE.md name)
│   ├── collision-slots.ts    # ~ nine sources, later-wins, full-definition rule, JSONC, both keys
│   ├── collision-ancestors.ts# + (optional split) settings.ancestorConfigRoots discovery, if collision-slots
│   │                         #   would exceed the complexity ceilings
│   ├── stage.ts              # ~ orchestrates read → partition → collide → stamp → merge; commit/replace/rollback
│   ├── unstage.ts            # ~ uses adapter-doc reader; removes ours from both keys
│   ├── types.ts              # ~ notice field on StageMcpCommitResult / UnstageMcpResult
│   ├── marker.ts, safe-set.ts, substitute.ts, index.ts   # = unchanged (index only if new exports)
├── persistence/locations.ts  # ~ + mcpAdapterJsonPath; mcpJsonPath doc marks it legacy
├── shared/errors-bridges.ts  # ~ + typed parse/shape error for the adapter file; McpServerCollisionError gains winner info
└── orchestrators/plugin/prune-rollback.ts  # ~ snapshot mcpAdapterJsonPath too
tests/bridges/mcp/adapter-doc.test.ts, adapter-entry.test.ts (+ collision-ancestors.test.ts if split)   # new pairs
```

### Caller Inventory (every touch point)

| Caller | Bridge entry used | What changes in Phase 2 |
|--------|-------------------|-------------------------|
| `orchestrators/plugin/install-outcome.ts:947-979` `mcpPhase` | `prepareStageMcpServers` + `commitPreparedMcp`; undo = `unstageMcpServers` | Nothing structural. Pushes `result.warnings` into `c.bridgeWarnings` (hygiene). The notice needs a new route (see Pattern 5). See Pitfall 6 about the undo dropping comments. |
| `orchestrators/plugin/update-swap.ts:319-328, 1142` | prepare + `commitPreparedMcp`; `abortPreparedMcp` | Carry-forward happens inside prepare (ours are still in the file). `collectUpdateWarnings` (`:350-372`) puts mcp warnings in the cascade-only half. |
| `orchestrators/plugin/reinstall-replace.ts:435-489, 676-709` | prepare + `replacePreparedMcp` / `rollbackMcpReplacement` / `finalizeMcpReplacement` | Replacement handle snapshots the adapter file bytes (`readOptionalText` on the new path). `splitHandleWarnings` (`:578-596`) puts mcp in the bridge half. |
| `orchestrators/marketplace/shared.ts:413-418` `cascadeUnstagePlugin` (used by uninstall, disable, install-cascade undo, marketplace remove, `operations.ts`) | `unstageMcpServers` | Reads only `mcpResult.removedNames`; **drops `mcpResult.warnings`**. A notice needs a field on `UnstageOutcome`. |
| `orchestrators/plugin/enable-disable.ts:800, 1492` | disable → `cascadeUnstagePlugin`; enable → `runInstallLedger` (`mcpPhase`) | Disable removes our entries, so a user override is lost across disable→enable (not covered by D-02-06; see Open Questions). Enable surfaces neither discovery nor bridge warnings today. |
| `orchestrators/plugin/prune-rollback.ts:315-321, 354` | none (direct `locations.mcpJsonPath` snapshot) | **Add** a `locations.mcpAdapterJsonPath` snapshot; keep `mcp.json` (D-02-04). Restore loop `for (const saved of [agentsIndex, mcp])` grows by one. |
| Reconcile (`orchestrators/reconcile/*`) and import (`orchestrators/import/*`) | indirectly through install ledger / `cascadeUnstagePlugin` | No direct bridge call (grep: no reconcile file imports `bridges/mcp`). Orchestrated install outcomes already forward bridge warnings through `postCommitWarnings` → `notifyDiagnostic`. |
| `info.ts`, `list-*` | none | Unaffected in Phase 2. |

[VERIFIED: grep for `prepareStageMcpServers|unstageMcpServers|replacePreparedMcp|commitPreparedMcp|rollbackMcpReplacement|finalizeMcpReplacement|classifyMcpServers|loadEffectiveServerNames|mcpJsonPath` across `extensions/`, plus Read of each site]

### Pattern 1: `mcpAdapterJsonPath` in `ScopedLocations` (AFILE-01)

**What:** Add a member next to `mcpJsonPath`, built the same way.
**Source today** [VERIFIED: `persistence/locations.ts:57-58, 195, 203, 282`]:
```typescript
  /** `<scopeRoot>/mcp.json` -- MCP server registry (SC-2). */
  readonly mcpJsonPath: string;
...
  const scopeRoot = scope === "user" ? getAgentDir() : path.join(cwd, ".pi");
...
  const mcpJsonPath = path.join(scopeRoot, "mcp.json");
```
**Add:** `readonly mcpAdapterJsonPath: string;` with `path.join(scopeRoot, "mcp-adapter.json")`, and put it in the frozen bundle. It is a hard-coded suffix on `scopeRoot`, so the existing "T-03-04 disposition" comment (`locations.ts:250-258`, suffix-only construction, no `assertPathInside` needed at this layer) covers it. Mark `mcpJsonPath`'s doc comment as legacy (read and sweep only from Phase 5 on). The adapter's own paths agree: `const ADAPTER_CONFIG_NAME = "mcp-adapter.json";` (`config.ts:23`), `getPiGlobalConfigPath` → `getAgentPath(ADAPTER_CONFIG_NAME)`, `getProjectPiConfigPath` → `resolve(cwd, getConfigDirName(), ADAPTER_CONFIG_NAME)` (`config.ts:201-224`). [VERIFIED: adapter tarball]

**Line-pin note:** the brand pin `persistence/locations.ts:41:3` in `scripts/check-unused-type-members.contracts.json` sits *above* the insertion point (line 58), so it does not move if the member is inserted after line 58. The bridge pins (`bridges/mcp/stage.ts:49:29`, `:371:48`, `:416:42`; `bridges/mcp/types.ts:94:52`) **will** move with any edit above them. Run Prettier first, then repin by shifting the line only (project memory: "Prettier invalidates type-member pins"). [VERIFIED: Read contracts.json lines 101-130, 685-690]

### Pattern 2: The adapter-doc reader (AFILE-02, AFILE-03)

**Grammar to match** [VERIFIED: adapter 5.0.0 `utils.ts:9-15`, quoted verbatim]:
```typescript
export function stripUtf8Bom(raw: string): string {
  return raw.charCodeAt(0) === 0xfeff ? raw.slice(1) : raw;
}

export function parseJsonWithComments(raw: string): unknown {
  return JSON.parse(stripJsonComments(stripUtf8Bom(raw), { trailingCommas: true }));
}
```
**Empty file rule** [VERIFIED: `config.ts:1122`]: `if (stripJsonComments(text, { trailingCommas: true }).trim() === "") return null;`. A whitespace-only or comment-only file is "no config", not an error. Treat it as an empty doc. Note that the adapter's *writer* helper (`readRawConfigObject`, `config.ts:1610-1622`) treats only `text.trim() === ""` as empty and throws on a comment-only file. Our reader should follow the *loader* (more permissive, and the file is then rewritten with a comment notice).

**Refusals (typed, fail-clean, no write):**
- JSONC parse failure (for example an unterminated `/*`, which `strip-json-comments` leaves in place so `JSON.parse` throws).
- Parseable but top-level not an object (array, primitive, `null`). The adapter's loader would read it as `{ mcpServers: {} }`, but its writers refuse (`"top-level value must be an object"`, `config.ts:1617`). Writing an object over it would destroy user data, so refuse.
- `mcpServers` or `mcp-servers` present and not an object. The adapter's writer checks **both** keys (`getServersObject`, `config.ts:1683-1690`): `if (Object.hasOwn(raw, key) && !isRecord(raw[key])) throw ...`. Today's `MalformedMcpServersError` (`stage.ts:93-103`) covers only `mcpServers`; extend it to both keys.

**Server-key selection (AFILE-03)**, copied from the adapter's own in-place writer [VERIFIED: `config.ts:1724`, verbatim]:
```typescript
const serverKey = raw.mcpServers !== undefined ? "mcpServers" : raw["mcp-servers"] !== undefined ? "mcp-servers" : "mcpServers";
```
The loader reads `raw.mcpServers ?? raw["mcp-servers"]` (`config.ts:1289`), so this key is the one the adapter will load. Write our entries under it and leave the other key's bytes alone. Do **not** copy `setServersObject` (`config.ts:1700-1703`: `delete raw["mcp-servers"]; raw.mcpServers = servers;`). That writer (used by the panel's direct-tools toggle) silently drops `mcp-servers` content when both keys exist. D-02-02 says "our entries go under that key", which is the disable-writer rule.

**Partition across both keys:** our marked entries can sit under the non-selected key, for example written while only `mcp-servers` existed, before the user added `mcpServers`. The partition and unstage must find and remove marked entries under **both** keys. New entries go only under `serverKey`. "Theirs" for the own-file collision check comes from `serverKey` only, because that is the key the adapter loads.

**Shape of the next doc:** `{ ...doc, [serverKey]: { ...theirsUnderKey, ...nextOurs } }` keeps every foreign top-level key (`settings`, `imports`, `claudePlugins`, anything unknown) and its position. An existing key keeps its insertion position under object spread. When marked entries were removed from the *other* key, that key is rewritten without them. Keep `safeSet` for every server-name copy (WR-01, `__proto__`).

### Pattern 3: Nine-source collision walk (AFILE-05, closes MCPSRC-01)

**Precedence** [CITED: adapter 5.0.0 `docs/configuration.md` §Precedence, "later entries win"; VERIFIED against `getConfigSources`, `config.ts:668-813`]:

| # | Source (adapter id) | Path | Server key read | Present when |
|---|---------------------|------|-----------------|--------------|
| 1 | `shared-global` | `~/.config/mcp/mcp.json` | `mcpServers ?? mcp-servers` | always (unless it equals the user path) |
| 2 | `agents-global` | `~/.agents/mcp.json` | `mcpServers ?? mcp-servers` | always |
| 3 | `agents-nested-global` | `~/.agents/mcp/mcp.json` | `mcpServers ?? mcp-servers` | always |
| 4 | `pi-mcp-global` | `<agentDir>/mcp.json` | `mcpServers` only (`readPiMcpConfig`) | `piMcpConfigEnabled` (Pi ≥ 0.99, so always under this project's 1.0 floor) |
| 5 | `pi-global` | `<agentDir>/mcp-adapter.json` | `mcpServers ?? mcp-servers` | always (**our user-scope target**) |
| 6 | `shared-project-ancestor` / `pi-project-ancestor` | `<dir>/.mcp.json`, `<dir>/.pi/mcp-adapter.json` for each dir from the configured root down to parent(cwd), farthest first | `mcpServers ?? mcp-servers` | only when `settings.ancestorConfigRoots` is set in a user-global source (1, 2, 3 or 5); deepest matching root under `$HOME` |
| 7 | `shared-project` | `<cwd>/.mcp.json` | `mcpServers ?? mcp-servers` | always |
| 8 | `pi-mcp-project` | `<cwd>/.pi/mcp.json` | `mcpServers` only | `piMcpConfigEnabled` |
| 9 | `pi-project` | `<cwd>/.pi/mcp-adapter.json` | `mcpServers ?? mcp-servers` | always (**our project-scope target**) |

Constants [VERIFIED: `config.ts:16-23`]: `GENERIC_GLOBAL_CONFIG_PATH = join(homedir(), ".config", "mcp", "mcp.json")`; `AGENTS_GLOBAL_CONFIG_PATHS = [join(homedir(), ".agents", "mcp.json"), join(homedir(), ".agents", "mcp", "mcp.json")]`; `PROJECT_CONFIG_NAME = ".mcp.json"`; `PI_MCP_CONFIG_NAME = "mcp.json"`; `ADAPTER_CONFIG_NAME = "mcp-adapter.json"`.

**Full definition vs. override.** Use the adapter's own transport test from `mergeServerMaps` [VERIFIED: `config.ts:920, 928, 935`]: `typeof definition.command === "string"`, `typeof definition.url === "string"`, `typeof definition.socket === "string"`. An entry with none of the three is an overlay. The adapter merges it per field into a lower definition, or ignores it when no base exists. Overlays never count as declarers.

**Collision rule (keeps today's refuse semantics, D-02-03):** for each name we are staging, collect the full declarers in the other sources, excluding:
- our own marked entries in the target file (the `ours` set, as today);
- marker-matching entries for the same `(plugin, marketplace)` in the **same scope's legacy `mcp.json`** (recommended; see Open Question 3, otherwise an update before the Phase 5 migration refuses itself).

If any full declarer remains, throw `McpServerCollisionError`. **Winner attribution:** the adapter's own conflict reporter names `sources[sources.length - 1]` as the winner (`config.ts:664`). Compute the winner over (the other full declarers ∪ our target position) by precedence index. Today the error carries only `owningPath` (`errors-bridges.ts:56-65`, message `Refusing to stage MCP server "${serverName}": already exists in ${owningPath}.`). Recommendation: keep `owningPath` as the highest-precedence *other* declarer and add a readonly `winningPath` (which may be our own target). Phrase the message so the winner is named, for example `... already exists in <owningPath>; <winningPath> takes precedence.` Exact wording is the planner's call. It reaches the user only as the `cause:` trailer of a failed row (Branch 4 of `composeInstallFailureMessage`, `install.messaging.ts:296-313`), so no `Reason` amendment is needed.

**Read rules for foreign sources:** parse with the same JSONC function. A foreign file that is unparseable or not an object contributes nothing, silently (today's behavior, and the adapter also skips such files with a warning). Do **not** keep today's "unwrapped form" tolerance (`collision-slots.ts:195-212`): adapter 5 reads only `mcpServers`/`mcp-servers` (`validateConfig`, `config.ts:1287-1296`), so a bare `{ "name": {...} }` file defines nothing.

**Out of contract (document in the module header, as ARCHITECTURE.md recommends):** `imports` host configs, `pi.mcp` package entries, `settings.agentPluginPaths`, `claudePlugins`, runtime `registerMcpServer`, host-config discovery, `--mcp-config`/`configPath` overrides, and `PI_MCP_CONFIG_MODE=exclusive` (`config.ts:879-881`, which collapses to source 5 only). Reading `process.env` inside the walk would be a hidden dependency under the test rules. If exclusive mode is ever honored, inject the env as a parameter.

**Hermeticity:** sources 1-3 use `os.homedir()`. The existing `createHermeticEnvironment` (`tests/platform/hermetic-environment.ts`) sets `HOME` and `PI_CODING_AGENT_DIR`, so the two new `~/.agents` paths stay inside the temp tree. [VERIFIED: Read]

### Pattern 4: Carry-forward of user overrides (AFILE-06)

**Where:** inside `prepareStageMcpServers`, after the partition, while stamping. Update and reinstall both call prepare while the old marked entries are still in the file. `update-swap.ts` prepares then commits; `reinstall-replace.ts` prepares then `replacePreparedMcp`. So `ours` already holds the previous entry for each name. No new state is needed.

**Rule:** for each new server name that has a previous marked entry (under either key), copy every field of the closed set that the previous entry has as an own property (`Object.hasOwn`), whatever its value, so `disabled: false` written by `/mcp-adapter enable` also survives. The carried value overrides the plugin-supplied value. Order the spread so the result is deterministic: `{ ...translated, ...carried, [CLAUDE_MARKETPLACE_MARKER_KEY]: marker }`.

**The closed set is a module-private constant** in `adapter-entry.ts`. Do not export it for the test ("Do not export a symbol for a test"). The test drives the public prepare/stage behavior and writes the expected set independently.

**Pin source: adapter 5.0.0 `ServerEntry`** [VERIFIED: tarball `types.ts:438-525`; key names extracted verbatim, in declaration order]:
```text
description command args socket env inheritEnv cwd url caFile headers requestHeadersCommand auth
bearerToken bearerTokenEnv bearerTokenStore oauth lifecycle idleTimeout requestTimeoutMs
exposeResources directTools toolPrefix includeTools excludeTools searchKeywords approveTools debug
trace httpTransport pluginDataDir literalEnv protocolVersion tasks disabled
```
(35 keys.) D-02-06 classifies 9 as carried (`disabled`, `approveTools`, `includeTools`, `excludeTools`, `lifecycle`, `idleTimeout`, `requestTimeoutMs`, `debug`, `searchKeywords`) and 2 as extension-owned (`directTools`, `toolPrefix`). The other 24 come from the plugin's own entry. **Pin-test design:** vendor the 35-key list as a literal in the test with a provenance comment (`pi-mcp-adapter@5.0.0 types.ts:438-525`). Seed a previous marked entry with all 35 keys at distinct values, stage a new plugin entry, and assert the whole resulting entry. The carried 9 keep their old values; `directTools`/`toolPrefix` and the other 24 come only from the new plugin entry. That makes adding or removing a carried field a failing test, and keeps the vendored list as the visible contract. A *new* adapter field shows up only when someone refreshes the vendored list. The planner should make that refresh part of the floor-bump procedure, or add an operator-run check against an installed adapter (Phase 7 live UAT). The adapter must **not** become a devDependency (STACK.md: ERESOLVE, native deps, D-98-10), and the global install on this machine is 2.6.1, which is stale and unusable as a pin source. [VERIFIED: `/home/acolomba/.npm-global/lib/node_modules/pi-mcp-adapter/package.json` version 2.6.1]

**This is not the forbidden "enumerate a type's members" test.** The skill bans enumerating *our* type's members to detect an unused one. Here the list is an external data contract, and the test asserts behavior: which values survive a re-stage.

**Overlay (marker-less partial) under our name in the *target* file:** this happens when a user-scope plugin was disabled with `/mcp-adapter disable` in project P (stub written to `P/.pi/mcp-adapter.json`), and the plugin is then installed at project scope in P. D-02-03 says it blocks neither install nor update. A file cannot hold two values under one key. Recommendation: absorb it. Treat the stub like a previous entry for carry-forward purposes, copying only the closed set, so a stub's `disabled: true` survives and nothing credential-bearing (`env`, `headers`, `bearerToken`) is ever copied in. See Open Question 1.

**Cross-file stubs need no special handling.** The user-scope entry and the project-file stub live in different files. The adapter merges them per field, the user's disable applies, and D-02-07 leaves the stub alone on uninstall.

### Pattern 5: Comment-dropped notice (AFILE-04)

**Detection is one comparison** [VERIFIED: probe this session against `strip-json-comments@5.0.3`]: `stripJsonComments(textWithoutBom) !== textWithoutBom`. With the default options (`whitespace: true`, `trailingCommas: false`), only comments change the text. A trailing comma alone does not count, which is right, because a dropped trailing comma loses no user content. Probe results:

| Input | `hasComments` | Parsed |
|-------|---------------|--------|
| BOM + `// c` + trailing commas | true | `{"mcpServers":{"a":{"command":"x"}}}` |
| `// nothing\n` (comment only) | true | strip result is blank → empty doc |
| `{ "a": 1 /* oops` | false | parse error → refuse |
| `{"u":"http://x/*y*/"}` | false | string untouched |
| `{"a":1, // c\n}` | true | `{"a":1}` |

**Emit only on an actual write** (staged commit, replacement, or unstage that removed something), never on the AS-8 noop or an unstage that removed nothing. Those paths do not rewrite, so the comments survive. A rolled-back reinstall restores the exact old bytes (`rollbackMcpReplacement` rewrites `oldText`), so it must not report the notice either.

**Shape:** a structured field on `StageMcpCommitResult` and `UnstageMcpResult` (for example `commentsDropped?: { path: string }`, or a small notice union), **not** a string in `warnings`. Reason: `warnings` from the MCP bridge are hygiene-only (Pitfall 4). With a structured field, every orchestrator can route the notice to its user-visible channel, and the closed-catalog byte form is composed once, in one orchestrator-side helper.

**Wording:** the planner's discretion, recorded as a catalog amendment. `surfaceDiscoveryWarnings` and `notifyDiagnostic` lines go through `redactAbsolutePaths`, which collapses a path to its basename (`shared/redact-absolute-paths.ts:18-24`). So the line should name the **scope** (`user`/`project`) as well as `mcp-adapter.json`, or the user cannot tell which file lost its comments. A dedicated header is more truthful than reusing `surfaceDiscoveryWarnings`' "N declared component(s) has a note" (WGATE-01 wording describes declared components, not a config file).

### Warning-surface inventory (AFILE-04 routing)

| Rewrite path | Bridge call | Where the notice can surface today | Work needed |
|--------------|-------------|------------------------------------|-------------|
| Standalone install | `mcpPhase` commit | `collectPostCommitWarnings` swallows bridge warnings unless `orchestrated` (`install-flow.ts:725-730`); discovery warnings surface via `surfaceDiscoveryWarnings` (`install-flow.ts:2077`) | Route the notice to a both-modes channel |
| Cascade install (reconcile, import, dependency cascade) | same | `postCommitWarnings` → `notifyDiagnostic` (`reconcile/apply.ts:1474-1482`, `import/execute.ts:1440`) | Already visible if carried in the warnings array |
| Update (direct / cascade) | `commitPreparedMcp` | `collectUpdateWarnings` keeps mcp warnings only when `cascade` (`update-swap.ts:350-372`) | Route to the discovery-equivalent half |
| Reinstall | `replacePreparedMcp` | `splitHandleWarnings` → bridge half (`reinstall-replace.ts:578-596`) | Same |
| Enable | `runInstallLedger` | enable surfaces neither discovery nor bridge warnings (no reference in `enable-disable.ts`) | New surfacing |
| Uninstall / disable / marketplace remove / prune | `cascadeUnstagePlugin` → `unstageMcpServers` | `cascadeUnstagePlugin` keeps only `removedNames` (`marketplace/shared.ts:413-418`); no verb has a diagnostic channel | Add a carrier field to `UnstageOutcome` + surfacing per verb |
| Install ledger undo after a later phase fails | `unstageMcpServers` | failure row only | See Pitfall 6 (prefer restoring bytes over unstage) |

This is the largest scope question in the phase (Open Question 2). "Warned once" in AFILE-04 reads as "on any rewrite", which means every row above.

### Anti-Patterns to Avoid

- **Keeping `readScopedDoc`'s "malformed → `{}` → overwrite" tolerance** for the adapter file. It deletes `settings`, `imports`, `claudePlugins` and every hand-written server (PITFALLS.md Pitfall 1).
- **Writing `mcpServers` next to an existing `mcp-servers`.** `??` then hides every user server under the legacy key (PITFALLS.md Pitfall 2).
- **Name-keyed unstage.** Stay marker-keyed (MC-5). Phase 3 renames would orphan name-keyed entries.
- **Carrying `directTools`/`toolPrefix`** (D-02-06 forbids it) or any credential-bearing field (`env`, `headers`, `bearerToken*`, `oauth`) when absorbing a stub.
- **Exporting the carry-forward constant or a reader internal "for the test".** That is forbidden by `skills/typescript-unit-testing`, and `no-test-only-production-surface.test.ts` / `unowned-exports-census.test.ts` gate it.
- **Putting the comment notice in `result.warnings`.** It disappears in standalone mode (Pitfall 4).
- **Embedding the raw `SyntaxError.message` in the user-visible error.** It can echo file content (Pitfall 7).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| JSONC comment / trailing-comma stripping | A character scanner | `strip-json-comments@^5.0.3` with `{ trailingCommas: true }` | It is the adapter's own grammar. A hand-rolled scanner must match its quirks (unterminated comments, escaped quotes, CRLF, a comma before a comment) and pass two cognitive-15 gates |
| Atomic write | tmp + rename by hand | `shared/atomic-json.ts::atomicWriteJson` | NFR-1; fsyncs; same JSON layout as the adapter's writer |
| `__proto__`-safe key copy | `out[key] = value` | `bridges/mcp/safe-set.ts::safeSet` | WR-01; `JSON.parse` materializes a literal `__proto__` own key |
| Ownership test | name lists | `bridges/mcp/marker.ts::isOwnedBy` (MC-5, byte-stable key `_piClaudeMarketplace`) | User contract; survives the adapter's `{ ...existing, disabled: true }` spread |
| Byte-exact restore on rollback | re-serialize | the existing replacement-handle pattern (`replacePreparedMcp` keeps `oldText` in a `WeakMap`) | Restores comments and formatting exactly |

**Key insight:** the adapter is a concurrent co-writer of this file. It edits our entries in place (`{ ...existing, disabled: true }`), drops the BOM and comments on its own writes, and takes no lock we share. Every rule in this phase (refuse instead of replace, the key-selection rule, overlay-aware partition, carry-forward) exists so that our read-merge-write treats the file as shared, not owned.

## Runtime State Inventory

This phase retargets where new writes land. It is not a rename, but it moves the write target of an existing artifact, so the checklist applies.

| Category | Items Found | Action Required |
|----------|-------------|-----------------|
| Stored data | Existing installs hold marked entries in `<scopeRoot>/mcp.json`; `state.json` `resources.mcpServers` holds names (unchanged shape and values in Phase 2, because names do not change until Phase 3) | None in Phase 2. The move is Phase 5 (AMIG-01). Phase 2 must not refuse its own legacy entries (Open Question 3). |
| Live service config | pi-mcp-adapter's in-memory config is read at factory/`session_start`; it picks up our writes on the next `/reload` | None (NFR-2 `/reload` suffices) |
| OS-registered state | None — verified: the bridge registers nothing outside files | None |
| Secrets/env vars | None renamed. Entry `env`/`headers` values are copied as today; carry-forward copies no credential field | None |
| Build artifacts | `node_modules` gains `strip-json-comments` after `npm install`; `package-lock.json` gains one entry | Commit the lockfile change (memory: commit npm-normalized lock forms) |

## Common Pitfalls

### Pitfall 1: A commented file is wiped on the next install
**What goes wrong:** `JSON.parse` fails on `//`, then `readScopedDoc` returns `{}` and commit overwrites the file (`stage.ts:75-87, 298-306`).
**How to avoid:** the adapter-doc reader (Pattern 2); delete the "will be replaced" branch and its warning string (`stage.ts:300`).
**Warning signs:** the string `it will be replaced (non-plugin entries in it are lost)` survives; no fixture has a comment, BOM or trailing comma.

### Pitfall 2: The AS-8 noop path and unrelated plugins
**What goes wrong:** with a refuse-on-parse-failure reader, a plugin with **no** MCP servers fails to install, because prepare still reads the file. Today's noop branch reads, reports "malformed ... left untouched", and proceeds (`stage.ts:266-276`). Unstage today throws on malformed JSON, so uninstalling *any* plugin fails while the file is broken (`unstage.ts:57-64`).
**How to avoid:** keep the noop semantics. When the staged set is empty, a parse failure yields a noop plus a notice that names the file, not a refusal (we write nothing, so D-02-01's "keeps its exact bytes" holds). For unstage, keep today's refusal (it cannot know whether ours exist), now as the typed error. Note in the plan that this blocks uninstall of MCP-less plugins while the file is unparseable. That is pre-existing behavior.
**Warning signs:** a test that installs a no-MCP plugin over an unparseable adapter file and expects a refusal.

### Pitfall 3: `mcp-servers` alias and the panel's key-folding writer
**What goes wrong:** copying `setServersObject` (delete `mcp-servers`, write `mcpServers`) drops user servers when both keys exist. Writing `mcpServers` when only `mcp-servers` exists hides the user's servers.
**How to avoid:** the `writeProjectServerDisabledOverride` key rule (Pattern 2), and partition both keys.
**Warning signs:** `classifyMcpServers` still checks only `Object.hasOwn(doc, "mcpServers")`.

### Pitfall 4: MCP bridge warnings never reach a standalone user
**What goes wrong:** `splitStagingWarnings` returns `bridge: Object.freeze([...warnings.agents, ...warnings.mcp])` (`orchestrators/plugin/shared.ts:1559`), and install's `push` adds to the returned array only `if (orchestrated)` (`install-flow.ts:727-729`). AFILE-04 implemented as a `result.warnings` string passes unit tests at the bridge and is invisible in `/claude:plugin install`.
**How to avoid:** structured notice + explicit routing (Pattern 5 inventory); an orchestrator-level test per surfaced verb that asserts the exact `ctx.ui.notify` text and severity.
**Warning signs:** only bridge tests assert the warning; no orchestrator test mocks `ctx.ui.notify` for it.

### Pitfall 5: Carry-forward makes plugin-sourced values sticky
**What goes wrong:** carry-forward cannot tell a user-set value from a plugin-set one. Today entries keep the plugin's fields verbatim (after substitution), so a plugin v1 that ships `lifecycle: "eager"` and a v2 that drops it leaves `lifecycle: "eager"` forever. Phase 3's ANAME-07 will translate the manifest's request timeout into `requestTimeoutMs`, a carried field, so a plugin's own timeout change would never take effect after the first install.
**How to avoid:** D-02-06 is locked, so do not change the set here. Record the consequence in the plan and in the Phase 3 hand-off. Phase 3 has to decide how a translated `requestTimeoutMs` interacts with the carried value (for example, carry only when the old value differs from the *previous* translation, which needs the old plugin source or a recorded value). The MC-5 marker is a byte-stable contract, so it cannot hold that record.
**Warning signs:** a Phase 3 plan that writes `requestTimeoutMs` with no reference to AFILE-06.

### Pitfall 6: A failed install drops comments silently
**What goes wrong:** the install ledger's `mcpPhase.undo` calls `unstageMcpServers` (`install-outcome.ts:968-978`). If `workflows` or `state` fails after the mcp commit, undo re-reads the already rewritten (comment-free) file and removes our entries. The user's comments are gone, the install failed, and no notice is shown.
**How to avoid (recommended):** make `mcpPhase` use the replacement handle (`replacePreparedMcp` in `do`, `rollbackMcpReplacement` in `undo`), as reinstall already does, so a failed install restores the exact prior bytes. Tradeoff: a concurrent adapter write between commit and undo is overwritten (the same window reinstall already accepts). Existing install-outcome tests that assert an unstage call on undo change.
**Warning signs:** no test injects a later-phase failure with a commented adapter file and compares the final bytes to the original.

### Pitfall 7: The parse error leaks file content
**What goes wrong:** Node's `JSON.parse` messages can quote source text. Verified on Node v26.10.0: `JSON.parse('{"a": sk-secret-abc}')` throws `Unexpected token 's', "{"a": sk-secret-abc}" is not valid JSON`. MCP configs hold bearer tokens and header values. The failed row's `cause:` trailer renders the cause chain.
**How to avoid:** the typed error's message names the file and states that it is not valid JSONC. Do not put the raw `SyntaxError` on the user-visible chain (or reduce it to a position). Test that a fixture holding a secret-looking value never appears in the rendered failure.
**Warning signs:** `new XError(..., { cause: err })` where `err` is the raw `SyntaxError`.

### Pitfall 8: Lost update against the adapter
**What goes wrong:** prepare builds `_nextDoc` from the bytes it read, and commit writes it later. In update and reinstall, other bridges commit in between. A `/mcp-adapter disable` from another Pi process in that window is overwritten. The adapter's writers take no lock we share (FEATURES A10).
**How to avoid (discretion):** keep the prepared read text. At commit, re-read: if the bytes differ, recompute the merge from the fresh doc. The merge is a pure function of (doc, staged entries, owner), so this is cheap if the module split makes it one function. Collision checks are not re-run. At minimum, document the window.
**Warning signs:** the merge logic is inlined in `prepareStageMcpServers`, so it cannot be re-run at commit.

### Pitfall 9: Legacy and panel copies of our servers
**What goes wrong:** (a) Before Phase 5, a plugin's marked entry still sits in the same scope's `mcp.json`. The new walk sees a full definition from source 4 and refuses the plugin's own update. (b) The adapter panel's direct-tools toggle on an *imported* server (from `<agentDir>/mcp.json`) writes `{ ...fullDef, directTools }` into `mcp-adapter.json` (`config.ts:1986-1991`), and Pi `mcp.json` translation drops our marker. That leaves a marker-less full definition under our name in our target file, which is a collision.
**How to avoid:** (a) the same-scope legacy self-exemption (Pattern 3). (b) Leave it to Phase 5 (its research flag "adapter panel copies of our entries"); in Phase 2 it surfaces as a clear collision naming the file.

### Pitfall 10: Gates that pin `mcp.json` strings
**What goes wrong:** about 180 test references to `locations.mcpJsonPath` (stage 49, unstage 36, prune-rollback 28, install-flow 13, reinstall-flow 9, prune 9, update-flow 8, uninstall 5, locations 4, marketplace/shared 4, plugin/shared 2, enable-disable 2, architecture 3, install-outcome 1, e2e 1) and catalog states with `occupied metadata path at mcp.json` (`docs/output-catalog.md:1442-1485`, fixture `tests/architecture/catalog-uat/fixtures/plugin-prune.ts:376, 413`).
**How to avoid:** budget a mechanical retarget task. Decide whether prune's catalog example names `mcp-adapter.json`. Prune now writes it, and the catalog text says "independent writers of `mcp.json`".

## Code Examples

### Adapter-doc reader core (shape, not final code)
```typescript
// Source: grammar from pi-mcp-adapter@5.0.0 utils.ts:9-15 and config.ts:1122, 1289, 1683-1690, 1724
import stripJsonComments from "strip-json-comments";

type ServerKey = "mcpServers" | "mcp-servers";

function withoutBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

/** AFILE-02: the adapter's loader grammar; blank-after-stripping is an empty document. */
function parseAdapterText(text: string): { doc: unknown; hadComments: boolean } | { blank: true; hadComments: boolean } {
  const body = withoutBom(text);
  const hadComments = stripJsonComments(body) !== body;          // AFILE-04 detection
  const stripped = stripJsonComments(body, { trailingCommas: true });
  if (stripped.trim() === "") {
    return { blank: true, hadComments };
  }
  return { doc: JSON.parse(stripped) as unknown, hadComments };  // caller wraps a throw in the typed error
}

/** AFILE-03: the key the adapter loads; never introduce `mcpServers` beside `mcp-servers`. */
function selectServerKey(doc: Record<string, unknown>): ServerKey {
  if (doc.mcpServers !== undefined) return "mcpServers";
  if (doc["mcp-servers"] !== undefined) return "mcp-servers";
  return "mcpServers";
}
```
(Under `curly: ["error", "all"]` the one-line `if` returns need braces. `as unknown` is only the parse boundary; narrow with an `isRecord` guard as `stage.ts:105-107` does.)

### Full-definition test (collision walk)
```typescript
// Source: pi-mcp-adapter@5.0.0 config.ts:920/928/935 (mergeServerMaps transport switches)
function isFullDefinition(entry: unknown): boolean {
  if (typeof entry !== "object" || entry === null || Array.isArray(entry)) {
    return false;
  }
  const e = entry as Record<string, unknown>;
  return typeof e.command === "string" || typeof e.url === "string" || typeof e.socket === "string";
}
```

### Diagnostic surface (existing seam to reuse)
```typescript
// Source: extensions/pi-claude-marketplace/shared/notification-dispatch.ts:144-154 (verbatim body)
export function notifyDiagnostic(ctx: NotificationContext, header: string, lines: readonly string[]): void {
  if (lines.length === 0) {
    return;
  }

  ctx.ui.notify(`${header}\n\n${lines.join("\n")}`, "warning");
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Write plugin servers into Pi's `mcp.json` | Write into adapter-native `mcp-adapter.json` | pi-mcp-adapter 5.0.0 (2026-10-02) + Pi ≥ 0.99 | `mcp.json` translation drops adapter fields and warns about our marker at every start (FEATURES A4) |
| Four collision slots, first-declarer-wins | Nine sources, later-wins, per-field merge | Adapter 2.13.0 (`.agents`) through 5.0.0 (`mcp-adapter.json` split) | MCPSRC-01 closes |
| `JSON.parse` for MCP configs | JSONC (BOM, comments, trailing commas) | Adapter reads JSONC for `mcp-adapter.json`; Pi's `mcp.json` is also read as JSONC by the adapter (`readPiMcpConfig`) | AFILE-02 |

**Deprecated/outdated in this codebase after the phase:**
- `collision-slots.ts` header "four pi-mcp-adapter configuration paths ... FIRST-DECLARER-WINS" and the MC-4/RN-5 four-slot contract text (also in the PRD). Rewrite the contract wording with the snapshot test; MCPSRC-01 says do not widen the list silently.
- `stage.ts` header ("Reads the scoped `mcp.json`", "four-slot"). Rewrite in present tense (comment policy: no "former" narration).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Absorbing a marker-less partial stub in the *target* file through the closed carry-forward set is what the user wants (D-02-03 says only "blocks neither install nor update") | Pattern 4 | A stub with non-set fields (for example a user-added `env`) loses those fields on absorption; uninstall then removes the absorbed `disabled` with our entry |
| A2 | Treating the same plugin's marked entry in the *other* scope's file as a collision stays correct (today's behavior; FEATURES TS-8 recommended the opposite) | Pattern 3 | Dual-scope installs of MCP plugins keep refusing, unlike upstream's "one effective server" |
| A3 | Documenting `imports`, ancestor-discovery edge rules and `PI_MCP_CONFIG_MODE=exclusive` as outside the collision contract is acceptable for "nine-source" | Pattern 3 | A name defined only through a host import is not reported |
| A4 | The noop branch should tolerate an unparseable file (noop + notice) rather than refuse | Pitfall 2 | If the user wants strict refusal, every install is blocked while the adapter file is broken |
| A5 | Switching install's `mcpPhase` undo to a byte-restore is in scope as part of "never lose anything the user wrote" | Pitfall 6 | Scope creep into install-outcome tests; if rejected, a failed install can drop comments silently |
| A6 | `write-file-atomic` resolves symlinks before writing (`lib/index.js:93, 189` call `realpath`), so a symlinked `mcp-adapter.json` (for example from a dotfile manager) is written through, as today for `mcp.json` | Security | NFR-10 reads "refuse to write outside ..."; writing through a symlink that points elsewhere is pre-existing behavior, not new |

## Open Questions

1. **Marker-less partial stub in our own target file.**
   - Known: D-02-03 says it does not block; a key cannot hold two entries.
   - Unclear: absorb only the closed set (recommended), absorb all non-transport fields, or keep it and skip writing ours (which breaks the install).
   - Recommendation: absorb the closed set; record it as a decision beside D-02-06.
2. **AFILE-04 coverage: every rewrite path, or stage paths only?**
   - Known: the requirement says "a rewrite"; uninstall, disable, marketplace remove and prune have no warning channel; enable surfaces nothing.
   - Recommendation: full coverage. Add one notice carrier on the bridge results and on `UnstageOutcome`, and one orchestrator helper that composes the catalog byte form. If the planner cuts it, record the uncovered verbs explicitly in the plan (not silently).
3. **Pre-migration legacy entries.**
   - Known: Phase 5 moves entries; D-02-04 keeps `mcp.json` in the write set "for the Phase 5 sweep"; ARCHITECTURE.md's Phase 2 row also listed a legacy sweep in stage/unstage.
   - Recommendation: in Phase 2, (a) exempt same-scope legacy self-entries from the collision walk (required, or updates refuse themselves), and (b) optionally have unstage also remove the plugin's own marked entries from the same-scope `mcp.json` (cheap and marker-keyed; it prevents an orphaned server if uninstall runs before migration). No stage-side move, which stays Phase 5.
4. **Own entries in the other scope's adapter file.** Today they count as a collision (verified: the walk compares `owningPath !== target`, and the marker is not consulted). FEATURES TS-8 argued for parity ("one effective server"). D-02-03 locks only refuse-vs-warn. Needs a user call. Default: keep today's behavior.
5. **Disable → enable loses overrides.** Disable unstages the marked entry, so `/mcp-adapter disable` state does not survive a plugin disable/enable cycle. D-02-06 names only update and reinstall. Claude Code keeps `/mcp` state independently of plugin enablement [ASSUMED]. Flag for the user. Out of scope unless they extend D-02-06.
6. **`McpServerCollisionError` shape.** Adding `winningPath` changes the class used by `tests/shared/errors-bridges.test.ts`, `stage.test.ts`, `update-flow.test.ts` and `reinstall-flow.test.ts`. A constructor options bag (CONVENTIONS: "opts bag for errors with more than 2 optional fields") keeps it tidy.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | runtime/tests | ✓ | v26.10.0 (engines `^22.22.2 \|\| ^24.15.0 \|\| >=26.0.0`; CI uses 24) | — |
| npm | install dep | ✓ | 11.19.1 | — |
| fallow | `npm run fallow` | ✓ | 3.31.0 (signed) | — |
| `strip-json-comments` | adapter-doc reader | ✗ (not installed) | registry 5.0.3 | `npm install strip-json-comments@^5.0.3` (Wave 0) |
| pi-mcp-adapter 5.0.0 | pin source for `ServerEntry` (reference only) | ✗ in repo; global 2.6.1 is stale | tarball unpacked in the research scratchpad | Vendor the 35-key list into the test; never add as a dependency |
| pre-commit | commit gate | assumed present (project policy) | — | — |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** `strip-json-comments` (install it).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | `node:test` + `node:assert/strict` + `strong-mock` 9.2.2 (built into Node v26.10.0) |
| Config file | none. Scripts live in `package.json` (`test`, `test:modules`, `test:architecture`, `test:integration`, `test:coverage:direct`) |
| Quick run command | `node --test tests/bridges/mcp/*.test.ts tests/persistence/locations.test.ts tests/orchestrators/plugin/prune-rollback.test.ts` (baseline this session: 176 pass, 0 fail, ~3.8 s) |
| Direct coverage | `npm run test:coverage:direct -- tests/bridges/mcp/adapter-doc.test.ts` (100% function/line/branch per pair) |
| Full suite command | `npm run check` (typecheck, lint, fallow, format, corresponding tests, coverage, unit, integration, type-member gate) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AFILE-01 | `locationsFor("user")` / `("project")` expose `<agentDir>/mcp-adapter.json` and `<cwd>/.pi/mcp-adapter.json`; key list includes the member | unit | `node --test tests/persistence/locations.test.ts` | ✅ (extend) |
| AFILE-01 | Stage commit writes exact bytes to `mcpAdapterJsonPath`; `mcp.json` is not created | unit (real fs) | `node --test tests/bridges/mcp/stage.test.ts` | ✅ (retarget) |
| AFILE-01 | Unstage removes exactly the `(plugin, mp)`-marked entries under both keys; keeps other plugins' entries, user servers and a marker-less `{ "disabled": true }` stub (D-02-07); no rewrite when nothing matched (mtime/bytes unchanged) | unit | `node --test tests/bridges/mcp/unstage.test.ts` | ✅ (retarget + new cases) |
| AFILE-01 | Prune snapshot and rollback cover `mcp-adapter.json` | unit | `node --test tests/orchestrators/plugin/prune-rollback.test.ts` | ✅ (extend) |
| AFILE-01 | Install → uninstall round trip through orchestrators lands in and leaves `mcp-adapter.json` | orchestrator | `node --test tests/orchestrators/plugin/install-flow.test.ts tests/orchestrators/plugin/uninstall.test.ts` | ✅ (retarget) |
| AFILE-01 | Materialization gate reads `mcpAdapterJsonPath` | architecture | `npm run test:architecture` | ✅ (`integration-materialization-gate.test.ts`, `config-state-write-seams.test.ts` benign example) |
| AFILE-02 | Fixture corpus parses to hand-written expected docs: BOM; `//` and `/* */`; trailing commas in objects and arrays; CRLF line comment; `//` and `/*` inside strings; escaped quotes | unit | `node --test tests/bridges/mcp/adapter-doc.test.ts` | ❌ Wave 0 |
| AFILE-02 | "Same fixture to our parser and the adapter's grammar": each fixture's expected value is written by hand AND the test asserts `JSON.parse(stripJsonComments(withoutBom(f), { trailingCommas: true }))` yields the same value, so a drift between our reader and the pinned library major fails | unit | same | ❌ Wave 0 |
| AFILE-02 | Blank / whitespace / comment-only file → empty doc (no refusal) | unit | same | ❌ Wave 0 |
| AFILE-02 | Unterminated comment, invalid JSON, top-level array, non-object `mcpServers` or `mcp-servers` → typed error asserted by class and fields (`filePath`); file bytes identical after `prepare` and after `unstage`; secret-looking fixture text absent from the message chain | unit | `node --test tests/bridges/mcp/adapter-doc.test.ts tests/bridges/mcp/stage.test.ts tests/bridges/mcp/unstage.test.ts` | ❌ / ✅ |
| AFILE-02 | Foreign `settings`, `imports`, `claudePlugins`, unknown keys and user servers survive a stage write (whole-bytes compare against an independently written expected file) | unit | `node --test tests/bridges/mcp/stage.test.ts` | ✅ (new case) |
| AFILE-02 | Typed error class shape | unit | `node --test tests/shared/errors-bridges.test.ts` | ✅ (extend) |
| AFILE-03 | `mcp-servers`-only file: our entries written under `mcp-servers`, no `mcpServers` key added, user servers byte-preserved; both keys present: write under `mcpServers`, remove our stale marked entries from `mcp-servers` | unit | `node --test tests/bridges/mcp/stage.test.ts tests/bridges/mcp/unstage.test.ts` | ✅ (new cases) |
| AFILE-04 | Commit result carries the comment notice when the read bytes had comments and a write happened; none on noop, none when no comments, none for trailing-comma-only; unstage notice only when something was removed; second install over the rewritten file has no notice ("once") | unit | `node --test tests/bridges/mcp/stage.test.ts tests/bridges/mcp/unstage.test.ts` | ✅ (new cases) |
| AFILE-04 | Standalone install (and each other routed verb) calls `ctx.ui.notify` with the exact catalog text at `"warning"` severity | orchestrator | `node --test tests/orchestrators/plugin/install-flow.test.ts` (+ per routed verb) | ✅ (new cases) |
| AFILE-04 | Catalog byte form locked | architecture | dedicated byte-lock test in the style of `tests/architecture/hooks-cap-notify.test.ts` (the catalog-contract driver only knows structured `notify()`) | ❌ Wave 0 |
| AFILE-05 | Nine sources in adapter order; later-wins attribution; overlay entries never declare; shared sources read `mcpServers ?? mcp-servers`; Pi `mcp.json` sources read `mcpServers` only; JSONC foreign files parse; unparseable foreign files skipped; unwrapped form ignored; ancestor sources only with `settings.ancestorConfigRoots` in a user-global source | unit (hermetic HOME) | `node --test tests/bridges/mcp/collision-slots.test.ts` | ✅ (rewrite; frozen order snapshot deliberately changes) |
| AFILE-05 | `{ "disabled": true }` stub in the project file does not block a user-scope install or update; a full definition in `~/.agents/mcp.json` refuses with an error naming the winning source; a marker-less full definition in the target file refuses | unit | `node --test tests/bridges/mcp/stage.test.ts` | ✅ (new cases) |
| AFILE-06 | Previous marked entry with all 35 adapter-5 `ServerEntry` keys (vendored literal) → new entry carries exactly the 9 D-02-06 fields with old values, `directTools`/`toolPrefix` from the new plugin entry (absent if it has none), marker present (whole-entry compare) | unit | `node --test tests/bridges/mcp/adapter-entry.test.ts` | ❌ Wave 0 |
| AFILE-06 | `disabled: true` written into our entry survives `update` and `reinstall` end to end | orchestrator | `node --test tests/orchestrators/plugin/update-flow.test.ts tests/orchestrators/plugin/reinstall-flow.test.ts` | ✅ (new cases) |

**What fails when the code is wrong:** a `JSON.parse` reader fails the comment/BOM/trailing-comma fixtures. A "treat as empty" path fails the bytes-unchanged assertion. Writing `mcpServers` beside `mcp-servers` fails the whole-bytes compare. First-declarer-wins fails the winner-attribution cases. A partial-as-declarer walk fails the stub case. A missing carried field (or an extra one, like `directTools`) fails the 35-key whole-entry compare. A notice in `warnings` only fails the standalone `ctx.ui.notify` assertion.

### Sampling Rate
- **Per task commit:** the owner test files above with `node --test`, plus pre-commit (which runs `check:changed` and selected direct coverage).
- **Per wave merge:** `npm run test:modules && npm run test:architecture`.
- **Phase gate:** `npm run check` green before `/gsd-verify-work`; `npm run test:e2e` once (it reads `mcpJsonPath` in `tests/e2e/install-soft-deps.test.ts:145`).

### Wave 0 Gaps
- [ ] `npm install strip-json-comments@^5.0.3` (lockfile committed)
- [ ] `tests/bridges/mcp/adapter-doc.test.ts`: covers AFILE-02/03 parsing and key selection
- [ ] `tests/bridges/mcp/adapter-entry.test.ts`: covers AFILE-06 (vendored 35-key list, provenance comment)
- [ ] `tests/bridges/mcp/collision-ancestors.test.ts` if the ancestor logic is split out
- [ ] Byte-lock test for the AFILE-04 catalog line (register any production path it names in `tests/architecture/gate-targets.ts` as a full literal, D-07-05/D-07-06)

## Security Domain

`security_enforcement` is not disabled in `.planning/config.json`, so it is treated as enabled.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | — |
| V3 Session Management | no | — |
| V4 Access Control | yes (file containment) | NFR-10 write set via `ScopedLocations` (suffix-only paths); `assertPathInside` for name-derived leaves (none new here) |
| V5 Input Validation | yes | Untrusted JSONC from user and adapter files: the `strip-json-comments` + `JSON.parse` grammar, a top-level object check, server-map object checks on both keys, `safeSet` for `__proto__`, refuse instead of coerce |
| V6 Cryptography | no | — |
| V7 Error handling / logging | yes | Typed errors without raw parse text (Pitfall 7); notices redacted by `redactAbsolutePaths` |
| V12 Files and resources | yes | Atomic writes (NFR-1); existing symlink-follow behavior of `write-file-atomic` unchanged (A6) |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Data destruction by overwriting an unparseable shared config | Tampering / DoS | Refuse with a typed error; bytes untouched (AFILE-02) |
| Hiding the user's servers by adding a precedence-winning key | Tampering | Server-key selection rule (AFILE-03) |
| Credential copying into our entry from a stub or another source | Information disclosure | Closed carry-forward set has no credential fields; never spread a foreign entry into ours |
| Secret echo through `SyntaxError` text in notifications | Information disclosure | Typed message without source snippet; test with a secret-shaped fixture |
| Prototype pollution through a `__proto__` server name | Tampering | `safeSet` (WR-01) on every key copy, including the new both-key partition |
| Lost update against a concurrent adapter write | Tampering (integrity) | Short read-write window; optional re-read-and-remerge at commit (Pitfall 8) |
| Shadowing a user's own server through per-field merge | Spoofing | Collision refusal on any other full definition, winner named (AFILE-05) |

## Sources

### Primary (HIGH confidence)
- Repo at `ebc971de` (features/mcp-4), Read this session: `bridges/mcp/{stage,unstage,collision-slots,marker,types,index,safe-set}.ts`, `persistence/locations.ts`, `shared/{atomic-json,errors-bridges,notification-dispatch,redact-absolute-paths}.ts`, `orchestrators/plugin/{install-outcome,install-flow,update-swap,reinstall-replace,prune-rollback,shared,install.messaging}.ts` (relevant ranges), `orchestrators/marketplace/shared.ts:340-470`, `scripts/check-unused-type-members.contracts.json`, `tests/bridges/mcp/{stage,collision-slots}.test.ts` (ranges), `tests/architecture/{gate-targets,config-state-write-seams,integration-materialization-gate,no-telemetry-deps,compat-01-no-expansion}.test.ts` (headers/ranges), `package.json`, `skills/{local-verification,typescript-unit-testing,typescript-comments}/SKILL.md`, `.planning/BACKLOG.md` MCPSRC-01
- `pi-mcp-adapter@5.0.0` tarball (`npm pack`, unpacked in the research scratchpad): `package.json` (dependencies), `utils.ts:9-15`, `types.ts:438-560, 723-728`, `config.ts:16-23, 150-175, 201-238, 442-530, 621-813, 879-1000, 1117-1180, 1287-1296, 1610-1764, 1961-2000`, `docs/configuration.md:14-92`
- `strip-json-comments@5.0.3` tarball: `index.js` (113 lines), `index.d.ts`, `package.json`; behavior probes run this session
- npm registry: `npm view` for `strip-json-comments`, `pi-mcp-adapter` versions/dist-tags; `gsd-tools query package-legitimacy check`
- Local probes: Node v26.10.0 `JSON.parse` error text; `fallow health --format json` (zero findings; `prepareStageMcpServers` is the largest bridge function at 94 physical lines including comments; `stage.ts` totals cyclomatic 60 / cognitive 51 over 18 functions); baseline test run (176/176)

### Secondary (MEDIUM confidence)
- Milestone research `.planning/research/{ARCHITECTURE,PITFALLS,FEATURES,STACK}.md` (cited, not redone)

### Tertiary (LOW confidence)
- None used for decisions.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH. The dependency is the adapter's own, verified in its `package.json` and on the registry.
- Architecture: HIGH. Every caller was enumerated by grep and read. The adapter contract was read from the 5.0.0 source.
- Pitfalls: HIGH for 1-4 and 7-10 (read or probed); MEDIUM for 5-6 (consequence analysis, which needs planner/user decisions).

**Research date:** 2026-10-02
**Valid until:** 2026-11-01 (adapter 5.x is days old; re-check `ServerEntry` and `getConfigSources` if a 5.x minor ships before execution)
