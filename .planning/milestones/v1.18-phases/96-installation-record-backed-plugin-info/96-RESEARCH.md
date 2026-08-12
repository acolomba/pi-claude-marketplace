# Phase 96: Installation-record-backed plugin info - Research

**Researched:** 2026-08-08
**Domain:** Read-only orchestrator dispatch reordering in a TypeScript-strict Pi
extension; local-state-backed component reconstruction; closed-set output
vocabulary under a byte-equality documentation gate
**Confidence:** HIGH (every finding below is read from source in this worktree;
no external package research applies)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Component name fidelity (resolves D-95-11)**

- **D-96-01:** The state-only info arm renders the **Pi-generated installed
  names exactly as `resources.*` holds them** (`<plugin>-<skill>`,
  `<plugin>:<command>`, `pi-claude-marketplace-<plugin>-<agent>`), with MCP
  servers rendering their raw source keys (the sole exception, by data shape).
  The divergence from the manifest-backed arm's source names is **documented,
  not engineered away** — no reverse-mapping, no prefix stripping. Rationale:
  truthful-to-disk (these are the names the user sees in Pi after `/reload`),
  zero inference risk, and INFO-11's own "documented rather than engineered
  away" posture. Where to document: the output-catalog entry for the state-only
  info block (Phase 96) and the PRD/design-doc reconciliation (Phase 98
  DOC-08).

**Folded-row manifest authority (closes the Phase 95 carrier todo)**

- **D-96-02:** A cross-scope folded row describes **its own record's
  manifest** for all three facts — absence claim, upgradable derivation, and
  description — ratifying the Phase 95 fix-loop semantics (`ManifestLookup`,
  commit 06875fa4) as the settled contract. Phase 96 pins it with regression
  coverage and closes the `docs/output-catalog.md` "still open under
  BOUND-01/02" note. BOUND-01 retains the bare `(failed)` header with no child
  rows when an owning manifest fails to load — the wholesale non-render under a
  failed user-scope manifest is the pinned contract, not a defect.
  — **Reversibility:** costly — reopening the choice re-splits the single
  `ManifestLookup` value into per-fact manifest sources across the fold path
  and invalidates the catalog paragraph and the regression pins this phase
  adds.

**Hooks-config degradation rendering (INFO-11)**

- **D-96-03:** **Truthful split.** Record has no hooks → the hooks line is
  omitted (a true negative). Record HAS hooks (`resources.hooks` non-empty)
  but the materialized config is missing, unreadable, or malformed → the hooks
  line renders with an **explicit degradation marker** so the operator sees
  entries exist but could not be listed. The exact token/wording is chosen at
  planning through the closed-set catalog process — reuse existing reason
  vocabulary if one fits; a new token is a deliberate catalog amendment. The
  read passes `assertPathInside` (state-supplied slug), and no failure shape
  ever fails the whole info block.

**`--fetch` on state-only records (INFO-12)**

- **D-96-04:** `info --fetch` on a manifest-absent record renders the info
  block from local truth and **visibly reports the fetch as skipped**, reusing
  the `(skipped) {not in manifest}` vocabulary precedent from update. The
  user's flag is never silently swallowed. The network guard is asserted with
  a zero-call check against injected clone/auth seams — not inferred from
  control flow — because the reorder makes fetch-capable builders reachable
  for the state-only arm.

### Claude's Discretion

- Exact placement of the state-only arm within `info.ts`'s dispatch (where the
  reorder slots relative to the fetch-capable builders), provided the early
  disabled carve-out stays first and INFO-12's guard is structural.
- The degradation marker's exact token/wording (D-96-03) within the closed-set
  process.
- Test file organization for the new info characterization/regression suites.
- Where the D-96-01 divergence note lands inside the catalog entry's prose.

### Deferred Ideas (OUT OF SCOPE)

**Reviewed Todos (not folded)**

- `2026-06-12-coverage-sweep-test-rare-failure-arms-in-update-reinstall-in.md`
  — update/reinstall/install failure-arm coverage; out of this phase's info
  scope, stays pending.
- `2026-08-08-notify-stale-comments-doc08-reconciliation.md` — Phase 98 DOC-08
  carrier (resolves_phase: 98); referenced here only so D-96-01's new
  divergence documentation is added to its reconciliation list.

**Additionally out of scope (REQUIREMENTS.md § Out of Scope):** any new
`orphaned` status, any persisted orphan flag or manifest snapshot, exact
dropped-component detail that was never persisted, description or dependency
reconstruction without a manifest entry, update/autoupdate fallback, manifest-
read recovery, full-fidelity hook reconstruction, an `info` LLM tool.

</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| INFO-09 | Enabled fully supported manifest-absent record reports `(installed) {not in manifest}` with the recorded version | § Pattern 1 (arm-(b) split), § Pattern 2 (row shape); version source verified at `state-io.ts:55` |
| INFO-10 | Preserve `(partially-installed)` + `compatibility.unsupported` reasons with `not in manifest` FIRST; installation-record-backed arm only (path-source live-resolver arm NOT unified) | § Pattern 2; the persisted derivation already exists at `info.ts:964-973` (`buildNonPathInstalledRow`) and `list.ts:321-327` (`partiallyInstalledReasons`) — reuse, do not re-invent |
| INFO-11 | Reconstruct inventory from `resources.skills/prompts/agents/mcpServers` + materialized hooks config; 4 kinds sorted, hooks in declaration order; `assertPathInside` on the state-supplied slug | § Pattern 3, § Code Examples 1-2; schema verified at `state-io.ts:70-76`, hooks path at `bridges/hooks/stage.ts:34-36`, read+containment precedent at `bridges/hooks/event-router.ts:604,635` |
| INFO-12 | Network-free including under `--fetch`; guard written and asserted against an injected clone/auth seam | § Pattern 4, § Code Examples 4; the zero-call idiom already exists at `tests/orchestrators/plugin/info.test.ts:2915-2950` |
| BOUND-01 | Manifest read failure keeps the existing failure output; `{not in manifest}` only after a successful load | § Pattern 1 (arm (a) stays FIRST); existing arm at `info.ts:698-715`; existing test covers only the zero-record case — see Pitfall 1 |
| BOUND-02 | Name absent from BOTH a loaded manifest and the installation records stays `(failed) {not in manifest}` | § Pattern 1 (else-arm unchanged); existing pin at `tests/orchestrators/plugin/info.test.ts:718-744` |

</phase_requirements>

## Summary

This phase is a **surgical dispatch split in one function plus one new row
builder**, not a rewrite. `buildBlock` in
`extensions/pi-claude-marketplace/orchestrators/plugin/info.ts` currently reads
the manifest (arm a), then returns `(failed) {not in manifest}` unconditionally
when the entry is missing (arm b, lines 717-735), and only THEN reads
`mpRecord.plugins[pluginName]` (line 737). The whole "reorder" is: hoist the
installed-record read above the entry lookup, and split arm (b) on whether a
record exists. Arm (a) stays first, so BOUND-01 holds structurally; the else
branch of the split is byte-unchanged, so BOUND-02 holds structurally.

The new arm **cannot** reuse any existing row builder: every one of them
(`buildInstalledRow`, `buildInstalledGitRow`, `buildNotInstalledRow`,
`buildAvailableRow`) takes `entry: MarketplaceManifest["plugins"][number]` and
feeds it to `resolveStrict`. There is no entry on this path. That is a gift for
INFO-12: the state-only builder never constructs a probe, never receives
`fetchCtx`, and therefore reaches no git surface by construction — the required
guard is a *signature* guard (do not thread `fetchCtx` into it) backed by the
zero-call assertion, not a runtime `if`.

The two genuinely open design points are the D-96-03 degradation marker and the
D-96-04 skip note. Both land in the closed-set output vocabulary, which is
locked by two gates: `tests/architecture/notify-closed-set-locks.test.ts` (which
hard-asserts `REASONS.length === 38`) and `tests/architecture/catalog-uat.test.ts`
(a bidirectional byte-equality walk between `docs/output-catalog.md` and
`notify()`). Adding a reason token is therefore a three-file amendment plus a
DOC-08 ripple; reusing one is free. Recommendations are in § Open Questions.

**Primary recommendation:** Split `buildBlock` arm (b) on
`mpRecord.plugins[pluginName]`, add one file-private
`buildStateOnlyInstalledRow(pluginName, record, locations)` that takes no
`fetchCtx` and no `entry`, reconstruct components from `record.resources.*`
(four kinds `localeCompare`-sorted, hooks read from
`<hooksDir>/<slug>/hooks.json` through `assertPathInside` + `parseHooksConfig` +
the existing `projectHookSummaryEntries`), reuse `narrowUnsupportedKinds` and
the existing closed-set reason tokens, and pin every new byte form as an
output-catalog state before touching the failed-block separation at
`info.ts:1910-1911`.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Decide "manifest loaded but omits this record, and a record exists" | Orchestrator (`orchestrators/plugin/info.ts`) | — | `buildBlock` already owns both the manifest read and the record read; the decision is a two-value branch on data it already holds |
| Reconstruct the component inventory from `resources.*` | Orchestrator (`info.ts`) | Persistence (`state-io.ts` shape), Shared (`path-safety.ts`) | The record is already in hand; no bridge exposes a "read back what I staged" API, and inventing one would be new machinery for one caller |
| Parse the materialized hooks config | Domain (`domain/components/hooks.ts::parseHooksConfig`) | Orchestrator (projection via `projectHookSummaryEntries`) | Domain owns the schema; `info.ts` already re-opens and re-parses hooks files on two other arms (`readHookSummaryEntries`, `readLenientHookSummary`) |
| Containment on the state-supplied hooks slug | Shared (`shared/path-safety.ts::assertPathInside`) | — | NFR-10 single chokepoint; the identical read-site guard already exists in `bridges/hooks/event-router.ts:635` |
| Row-status and reason derivation from the persisted record | Orchestrator (`info.ts`), reusing Shared `narrowUnsupportedKinds` | — | INFO-10 pins the persisted-record derivation; `narrowUnsupportedKinds` is the sole sanctioned producer of kind tokens |
| Rendering the row bytes | Shared (`shared/notify.ts::renderPluginInfo`) | — | D-95-01..03: orchestrator stamps, notify renders; no allowlist in the render path |
| `--fetch` skip note | Orchestrator stamps, Shared/command-local renders | `orchestrators/plugin/info.messaging.ts` if the cascade-row option is chosen | The disabled carve-out already shows info emitting a command-local cascade row beside a standalone block |
| Network abstinence proof | Test tier (`tests/orchestrators/plugin/info.test.ts`) + architecture gate | — | INFO-12 explicitly demotes "by construction" to "asserted against injected seams" |

## Standard Stack

### Core

No new libraries. Every capability this phase needs already exists in the
repository.

| Module | Location | Purpose | Why Standard |
|--------|----------|---------|--------------|
| `parseHooksConfig` | `domain/components/hooks.ts:386` | Parse a hooks config to `{ok:true, value, dropped}` | Sole sanctioned hooks parser; accepts BOTH the wrapper `{description?, hooks:{…}}` and the bare event map, so it reads the materialized file unchanged [VERIFIED: domain/components/hooks.ts:401-413] |
| `projectHookSummaryEntries` | `orchestrators/plugin/info.ts:376` | `HooksConfig` → `HookSummaryEntry[]` in declaration order | Already the projector for the strict arm; declaration order is its documented contract [VERIFIED: info.ts:356-398] |
| `assertPathInside` | `shared/path-safety.ts` | NFR-10 containment chokepoint | Required by INFO-11 for the state-supplied slug |
| `narrowUnsupportedKinds` | `shared/probe-classifiers.ts:183` | `compatibility.unsupported[]` → closed-set reason tokens | Sole producer of `{lsp}` / `{unsupported hooks}` / `{unsupported component}` |
| `narrowProbeError` | `shared/probe-classifiers.ts` (re-exported `info.ts:1945`) | Throw → closed-set failure reason | The ladder every other disk read in `info.ts` already uses |
| `locationsFor` | `persistence/locations.ts:144` | Scoped path bundle carrying `hooksDir` | Already built once per block at `info.ts:685` |

### Supporting

| Module | Location | Purpose | When to Use |
|--------|----------|---------|-------------|
| `makeMockGitOps` | `tests/helpers/git-mock.ts:93` | Records `cloneCalls` / `fetchCalls` | INFO-12 zero-call assertion |
| `makeMockCredentialOps` | `tests/helpers/credential-mock.ts:57` | Records `fillCalls` / `approveCalls` | INFO-12 auth-seam zero-call assertion |
| `InfoCloneCacheSeam` | `orchestrators/plugin/info.ts:149` | Injected clone-cache seam (exported) | Passed as `cloneCacheSeam` in the zero-call test |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| A new file-private state-only row builder in `info.ts` | Export `ManifestLookup` / `manifestLookupFor` from `list.ts` and import into `info.ts` | Adds a `plugin/info.ts → plugin/list.ts` edge for zero behavioral gain. `info.ts` already expresses the same authority rule structurally: arm (a) IS `unverified` and arm (b) IS `absent`, both judged against `mpRecord.manifestPath` — the record's own manifest. Recommend documenting the parity in a comment + tests, not importing. |
| Reading `<hooksDir>/<slug>/hooks.json` in `info.ts` | Add a `readHookConfig` export to `bridges/hooks/stage.ts` beside `hookConfigPathFor` | `hookConfigPathFor` is already exported and is the sanctioned path composer — importing it (rather than re-joining `locations.hooksDir`) is the cheaper half of this. A full read helper in the bridge would be new machinery for one caller. **Recommend: import `hookConfigPathFor`, keep the read in `info.ts`.** |
| A dedicated builder | Widening `buildInstalledRow` with an optional `entry` | Would make `entry` optional across a 100-line function whose every branch feeds `resolveStrict(entry, …)`; the discriminated-arm house style (NFR-7) argues the opposite direction |

**Installation:** none — no `npm install` in this phase.

## Package Legitimacy Audit

**Not applicable.** This phase installs no external packages. Every module it
touches is in-repo. `package.json` is not modified.

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### System Architecture Diagram

```text
/claude:plugin info <plugin>@<mp> [--fetch] [--scope …]
        │
        ▼
edge/handlers/plugin/info.ts        parses --fetch + <plugin>@<marketplace>
        │                            (no change this phase)
        ▼
getPluginInfo (info.ts:1799)
        │
        ├─ buildInfoFetchContext(opts)  ── fetch !== true ─▶ undefined
        │                               ── fetch === true ─▶ { seam, credentialOps, authMemo }
        ├─ per scope: loadState + loadMergedScopeConfig ─▶ found[]
        ├─ found.length === 0 ─────────────────────────────▶ marketplace-not-added (standalone, error)
        │
        ├─ partitionDisabledScopes (info.ts:1770)     ◀── DISABLED CARVE-OUT RUNS FIRST
        │       isRecordedButDisabled(record) ─▶ (disabled) cascade block
        │       else ─▶ infoFound[]
        │
        └─ buildBlock(mp, plugin, scope, mpRecord, autoupdate, cwd, fetchCtx?)
                │
                ├─(a) loadMarketplaceManifest(mpRecord.manifestPath)
                │        throw ─▶ (failed) {narrowProbeError(err)}        [BOUND-01 — STAYS FIRST]
                │
                ├─(b) entry = manifest.plugins.find(p => p.name === plugin)
                │        entry === undefined:
                │           ┌── record exists ─▶ ★ buildStateOnlyInstalledRow  [NEW: INFO-09/10/11/12]
                │           └── no record ─────▶ (failed) {not in manifest}    [BOUND-02 — UNCHANGED]
                │
                ├─(c) record exists + entry exists ─▶ buildInstalledRow
                │        ├─ git source ─▶ buildInstalledGitRow ──▶ probe = fetchCtx ? makeFetchProbe : makePresenceProbe
                │        ├─ npm/unknown ─▶ buildNonPathInstalledRow (componentsResolved:false)
                │        └─ path ───────▶ resolveStrict ─▶ composeResolvedComponents
                │
                └─(d/e) no record + entry exists ─▶ buildNotInstalledRow
                         ├─ git ─▶ buildGitNotInstalledRow ──▶ probe = fetchCtx ? makeFetchProbe : makePresenceProbe
                         └─ path/npm ─▶ resolveStrict ─▶ buildAvailableRow / buildNotInstalledPathRow

        ▼
notify(ctx, pi, PluginInfoMessage)          ── single-scope arm
notify(ctx, pi, {kind:"plugin-info-cascade"}) ── two-scope arm, AFTER splitting
                                                 status==="failed" blocks out (info.ts:1910-1911)
        ▼
shared/notify.ts::renderPluginInfo (3295)
    header · row (glyph name [scope] v… (status) {reasons}) · description · components|not resolved
```

★ = the only new node. The two `makeFetchProbe` sites are the "fetch-capable
row builders" INFO-12 names; the state-only arm reaches neither.

### Recommended Project Structure

No new production files. Modified/added:

```text
extensions/pi-claude-marketplace/
├── orchestrators/plugin/
│   ├── info.ts               # arm-(b) split + buildStateOnlyInstalledRow + hooks reader
│   └── info.messaging.ts     # ONLY if D-96-04 lands as a cascade `(skipped)` row
docs/
└── output-catalog.md         # new info state(s) + close the BOUND-01/02 "still open" note (line 412)
tests/
├── architecture/catalog-uat.test.ts          # one fixture per new catalog state (bidirectional gate)
└── orchestrators/plugin/
    ├── info-manifest-absent.test.ts          # NEW suite (mirrors list-manifest-absent.test.ts)
    └── list-manifest-absent.test.ts          # D-96-02 fold regression pins
```

### Pattern 1: Split arm (b), do not move arm (a)

**What:** Hoist the record read above the entry lookup and branch. The "reorder"
is three lines.

**When to use:** This is the phase's whole structural move.

**Current code** [VERIFIED: `orchestrators/plugin/info.ts:717-741`, quoted
verbatim]:

```typescript
  // (b) Plugin name not in manifest -> `(failed) {not in manifest}`.
  // Same `componentsResolved: true` + empty components rationale as
  // (a) above.
  const entry = manifest.plugins.find((p) => p.name === pluginName);
  if (entry === undefined) {
    return {
      kind: "plugin-info",
      marketplaceName: marketplace,
      marketplaceScope: scope,
      marketplaceDetails,
      plugin: {
        status: "failed",
        name: pluginName,
        reasons: ["not in manifest"],
        componentsResolved: true,
        components: {},
      },
    };
  }

  const installed = mpRecord.plugins[pluginName];
```

**Shape after the split** (the `installed` binding moves above `entry`; the
`entry === undefined` block gains an inner branch whose else-arm is
byte-identical to today's body).

**Why arm (a) must not move:** BOUND-01. `loadMarketplaceManifest` throwing
means nothing is known about membership; the `{not in manifest}` claim is only
licensed by a successful load. This is the same rule `list.ts` encodes as
`ManifestLookup.unverified` [VERIFIED: `list.ts:880-887`]:

```typescript
function manifestLookupFor(scopedManifest: ScopedManifest, pluginName: string): ManifestLookup {
  if (!scopedManifest.ok) {
    return { kind: "unverified" };
  }

  const entry = scopedManifest.manifest.plugins.find((p) => p.name === pluginName);
  return entry === undefined ? { kind: "absent" } : { kind: "declared", entry };
}
```

`info.ts` and `list.ts` already load through the same memoized seam — `list.ts`'s
`loadManifestSoftly` is a one-line pass-through to `loadMarketplaceManifest`
[VERIFIED: `list.ts:267-269`]:

```typescript
async function loadManifestSoftly(manifestPath: string): Promise<MarketplaceManifest> {
  return loadMarketplaceManifest(manifestPath);
}
```

So no new load machinery, and no manifest-cache change.

### Pattern 2: Status and reasons from the persisted record (INFO-09 / INFO-10)

**What:** Derive the token from `compatibility.unsupported.length` and prepend
`not in manifest` to the kind tokens.

**Two existing implementations to copy, not re-derive.** `info.ts`'s own
non-path installed row [VERIFIED: `info.ts:964-973`]:

```typescript
  const status =
    installedRecord.compatibility.unsupported.length > 0 ? "partially-installed" : "installed";
  return {
    status,
    name: pluginName,
    ...(version !== undefined && { version }),
    ...(description !== undefined && { description }),
    ...(status === "partially-installed" && {
      reasons: narrowUnsupportedKinds(installedRecord.compatibility.unsupported),
    }),
    componentsResolved: false,
  };
```

and `list.ts`'s absence-first composition [VERIFIED: `list.ts:321-327`]:

```typescript
function partiallyInstalledReasons(
  record: ExtensionState["marketplaces"][string]["plugins"][string],
  notInManifest: boolean,
): PluginPartiallyInstalledMessage["reasons"] {
  const kinds = narrowUnsupportedKinds(record.compatibility.unsupported);
  return notInManifest ? ["not in manifest", ...kinds] : kinds;
}
```

The state-only info row is the intersection: status from the first, reason order
from the second, always with `notInManifest === true`.

**Version:** `record.version` — `PLUGIN_INSTALL_RECORD_SCHEMA` declares
`version: Type.String()` (required) [VERIFIED: `state-io.ts:55`], so INFO-09's
"version from the installation record" is always available.

**Description and dependencies:** OMITTED. Both are manifest-only metadata and
REQUIREMENTS.md § Out of Scope forbids reconstructing them. `PluginInfoRowBase`
makes both optional [VERIFIED: `notify.ts:1311-1315`], and the renderer skips
the description block when it is absent [VERIFIED: `notify.ts:3318-3320`].

**Severity is automatic.** `buildSummaryLine` routes `plugin-info` by row status
[VERIFIED: `notify.ts:2728-2729`]:

```typescript
      case "plugin-info":
        return message.plugin.status === "failed" ? summaryPhrase(1, "error", "plugin") : "";
```

So an `(installed)` / `(partially-installed)` state-only block silently becomes
`info` severity with no summary line — the correct outcome, no plumbing needed.
This IS a user-visible severity change for the affected case (`error` → `info`),
which the catalog entry must state.

**Status membership is already legal.** `PluginInfoRowBase.status` admits
`installed` and `partially-installed` [VERIFIED: `notify.ts:1300-1310`]:

```typescript
  readonly status: Extract<
    PluginStatus,
    | "installed"
    | "available"
    // RSTA-01: the info surface renders `(remote)` for an unfetched git source.
    | "remote"
    | "unavailable"
    | "partially-available"
    | "failed"
    | "partially-installed"
  >;
```

No status-set amendment for INFO-09/10 — `PLUGIN_STATUSES.length === 19` and
`STATUS_TOKENS.length === 24` stay put.

### Pattern 3: Component reconstruction (INFO-11)

**The record shape is exactly five string arrays** [VERIFIED:
`persistence/state-io.ts:70-76`, quoted verbatim]:

```typescript
  resources: Type.Object({
    skills: Type.Array(Type.String()),
    prompts: Type.Array(Type.String()),
    agents: Type.Array(Type.String()),
    mcpServers: Type.Array(Type.String()),
    hooks: Type.Array(Type.String()),
  }),
```

**What each array holds** [VERIFIED: `orchestrators/plugin/install.ts:1156-1171`,
quoted verbatim]:

```typescript
        resources: {
          skills: [...c.stagedSkillNames],
          prompts: [...c.stagedCommandNames],
          agents: [...c.stagedAgentNames],
          mcpServers: [...c.stagedMcpServerNames],
          // HOOK-02 / D-57-01: additive required field. When the resolver
          // advertises a hooks config (i.e. `<pluginRoot>/hooks/hooks.json`
          // exists and parses), record the plugin's id as the per-plugin
          // hooks-container-dir slug. This is the inventory marker for
          // `list` UI, the `uninstall` hooks-subtree cleanup gate, and the
          // factory-time hydrate predicate that decides whether to re-read
          // the on-disk config back into `parsedConfigCache` on `/reload`.
          // When the resolver did not surface a hooks config, the
          // inventory stays empty.
          hooks: c.resolved.hooksConfigPath === undefined ? [] : [c.plugin],
        },
```

**The three generated-name shapes D-96-01 pins are confirmed at their source**
[VERIFIED: `domain/name.ts:74`, `:98`, `:119`, quoted verbatim]:

```typescript
  const generated = `${plugin}-${elided}`;        // generatedSkillName  (name.ts:74)
  const generated = `${plugin}:${elided}`;        // generatedColonName  (name.ts:98)
  const generated = `pi-claude-marketplace-${plugin}-${elided}`;  // generatedAgentName (name.ts:119)
```

**The MCP exception is confirmed too** — the staged names are the raw manifest
keys, not a generated form [VERIFIED: `bridges/mcp/stage.ts:220` and `:278-283`]:

```typescript
  const newNames = Object.keys(servers);
  …
  const recorded: readonly StagedMcpRecord[] = Object.freeze(
    newNames.map((generatedName) => ({
      generatedName,
      sourcePath,
      targetPath: locations.mcpJsonPath,
    })),
  );
```

and `install.ts:1084` assigns `c.stagedMcpServerNames = result.recorded.map((r) => r.generatedName);`.
So `resources.mcpServers` is `Object.keys(entry.mcpServers)` — raw source keys,
exactly INFO-11's stated exception.

**Sorting:** the renderer requires pre-sorted input and does not sort defensively
[VERIFIED: `notify.ts:3324-3327` / `3213-3216`]. Use the same comparator
`composeResolvedComponents` uses [VERIFIED: `info.ts:330`]:

```typescript
  return [...names].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
```

**Hooks are the only kind that requires a disk read.** The materialized file is
`<extensionRoot>/hooks/<slug>/hooks.json` [VERIFIED: `persistence/locations.ts:177`
`const hooksDir = path.join(extensionRoot, "hooks");` and
`bridges/hooks/stage.ts:34-36`]:

```typescript
export function hookConfigPathFor(locations: ScopedLocations, plugin: string): string {
  return path.join(locations.hooksDir, plugin, "hooks.json");
}
```

**Its content is the FILTERED supported subset, written bare (not wrapped).**
The install hooks phase writes `parsed.value` [VERIFIED: `install.ts:1052-1057`],
and `parseHooksConfig` returns `value: partition.supported` [VERIFIED:
`domain/components/hooks.ts:452-457`]. Because `parseHooksConfig` accepts both
the wrapper and the bare map [VERIFIED: `hooks.ts:401-406`], re-parsing the
materialized file works unchanged and yields `dropped: []` (the drops already
happened at install). That is why the state-only arm should call
`projectHookSummaryEntries(parsed.value)` only, and NOT
`projectDroppedHookEntries` — there is nothing dropped to enumerate, matching
the § Out of Scope "full-fidelity hook reconstruction" exclusion.

**The read-site containment guard already exists verbatim** in the hooks bridge's
own hydrate path [VERIFIED: `bridges/hooks/event-router.ts:600-613` and `:628-641`]:

```typescript
      // D-57-03: `resources.hooks` carries the per-plugin hooks-container-dir
      // generatedName; the on-disk file is `<hooksDir>/<generatedName>/hooks.json`.
      // Zero or one entry today; iterate defensively for forward-compat.
      for (const slug of hookSlugs) {
        const hooksJsonPath = path.join(loc.hooksDir, slug, "hooks.json");
```

```typescript
  // Defense-in-depth (NFR-10): state.json is normally written only by this
  // extension, but the slug component (`pluginRecord.resources.hooks[i]`) is
  // state-supplied data. A corrupted state record (third-party tampering or
  // future schema mismatch) carrying a traversal slug like `"../../etc"` must
  // not let `readFile` escape `loc.hooksDir`. Mirror the WRITE-site guard at
  // this READ site.
  try {
    await assertPathInside(hooksDir, hooksJsonPath, "hooks.json hydrate path");
```

Copy this shape (including the "iterate defensively for forward-compat" loop).

**Hooks order:** `projectHookSummaryEntries` preserves declaration order by
construction [VERIFIED: `info.ts:356-362`], satisfying INFO-11's "hook entries
preserve materialized declaration order".

### Pattern 4: The INFO-12 guard is structural, then asserted

**Structural half:** the new builder's signature takes
`(pluginName, record, locations)` and no `fetchCtx`. It constructs no
`GitProbe`. Both `makeFetchProbe` call sites live inside
`buildInstalledGitRow` (`info.ts:1147-1148`) and `buildGitNotInstalledRow`
(`info.ts:1417-1418`), neither of which the state-only arm calls. Add a short
comment citing INFO-12 and NFR-5 next to the builder.

**Asserted half:** copy the existing zero-call test [VERIFIED:
`tests/orchestrators/plugin/info.test.ts:2915-2950`] and flip `fetch` on:

```typescript
    // The seam is provided but `fetch` is omitted: the hook must NOT run.
    const { gitOps, state: gitState } = makeMockGitOps({});
    const { credOps: credentialOps } = makeMockCredentialOps();
    …
    assert.equal(gitState.cloneCalls.length, 0, "bare info must not clone (network-free)");
    assert.equal(gitState.fetchCalls.length, 0, "bare info must not fetch (network-free)");
```

The INFO-12 test is the same body with `fetch: true` against a manifest-absent
installed record, plus `credentialOps` call-count assertions (the credential
mock records `fillCalls` / `approveCalls` / `rejectCalls`
[VERIFIED: `tests/helpers/credential-mock.ts:60-68`]).

The `fetchSeamWith(gitOps)` helper is already defined at
`tests/orchestrators/plugin/info.test.ts:2799-2806`; if the new suite is a
separate file, copy it (house convention: test helpers are file-private, copy
rather than import — see 95-PATTERNS.md).

### Anti-Patterns to Avoid

- **Routing the state-only record through `buildInstalledRow`.** Every branch of
  it calls `resolveStrict(entry, …)`; there is no entry. Making `entry` optional
  would ripple through five builders.
- **Exporting `ManifestLookup` from `list.ts` into `info.ts`.** New import edge,
  no behavior gain; `info.ts`'s arms (a)/(b) already encode the same rule.
- **Calling `projectDroppedHookEntries` on the materialized config.** It is
  already the filtered subset; `dropped` is empty and the phase must not invent
  detail that was never persisted.
- **Using `grep` for any new source-scanning gate over `info.ts`.** The file
  contains one literal NUL byte at line 416 [VERIFIED: `info.ts:416`,
  ``const key = `${drop.event} ${matcher ?? ""}`;``], so `grep` classifies
  it binary and silently skips it. `tests/architecture/no-orchestrator-network.test.ts`
  already reads with `readFile` [VERIFIED: `no-orchestrator-network.test.ts:100`]
  — copy that, per COMPAT-01.
- **Setting `componentsResolved: false` on the state-only row.** That emits
  `    components: not resolved` [VERIFIED: `notify.ts:3328-3330`], which is the
  external-source marker and would be untruthful — the components ARE known.
- **Sorting inside the renderer.** The renderer's documented precondition is
  pre-sorted input [VERIFIED: `notify.ts:3324-3327`].

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Parsing the materialized hooks config | A bespoke `JSON.parse` + shape check | `parseHooksConfig(raw, ifCtx, noop, { skipIfMap: true })` | Handles both wire shapes, negative-caches nothing, never throws on structural defects, and returns the same `HooksConfig` the projector expects |
| Projecting hooks to display lines | A per-event string builder | `projectHookSummaryEntries` | Owns the tool-event/matcher discrimination and the declaration-order contract |
| Containment on the slug | `slug.includes("..")` | `assertPathInside` | NFR-10 single chokepoint; symlink-aware |
| Composing the hooks path | `path.join(locations.hooksDir, slug, "hooks.json")` inline | `hookConfigPathFor(locations, slug)` (exported) | Its doc comment names itself the "single source of truth for the hooks bridge write path … and (later) by any hydrate-side reader" [VERIFIED: `bridges/hooks/stage.ts:29-33`] |
| Mapping `compatibility.unsupported` to braces | A local kind→token switch | `narrowUnsupportedKinds` | Sole sanctioned producer; `kindToReason`'s D-90-05 fallback lives there |
| Classifying a read throw | Hardcoding `"unreadable"` | `narrowProbeError(err)` | Keeps info in lockstep with list for the same errno (the WR-01 lesson recorded at `info.test.ts:806-821`) |
| Byte-checking new output | Hand-written expected strings only in a unit test | An output-catalog state + a `catalog-uat` fixture | The catalog is the binding user contract and the gate is bidirectional |

**Key insight:** `info.ts` is 1945 lines precisely because every one of these
problems has already been solved once on an adjacent arm. The correct pattern
source for this phase is a sibling arm inside the same file, not a fresh design
— the same "self-analog" finding Phase 95 recorded for `list.ts`.

## Runtime State Inventory

This phase writes nothing to disk and changes no persisted shape. Included
because the phase touches a dispatch path, and because COMPAT-01 (Phase 98) will
assert exactly this.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None — the phase only READS `state.json` (`loadState` at `info.ts:1821`) and `<hooksDir>/<slug>/hooks.json`. No `saveState`, no `atomicWriteJson`, no schema change. | none |
| Live service config | None — verified: `info.ts` imports no git surface (`no-orchestrator-network` FORBIDDEN_TARGET at `no-orchestrator-network.test.ts:61`) and no external service client. | none |
| OS-registered state | None. | none |
| Secrets / env vars | None new. `credentialOps` / `deviceFlowHttp` are existing injected seams; the phase adds zero-call assertions against them, never reads a secret. | none |
| Build artifacts | None — no `package.json`, no version bump, no generated file. | none |

**The canonical question:** after the change lands, no runtime system holds a
stale value, because nothing is written.

## Common Pitfalls

### Pitfall 1: BOUND-01's existing pin does not cover the case the reorder can break

**What goes wrong:** The only manifest-read-failure test for `info` seeds
`plugins: {}` — no installed record [VERIFIED:
`tests/orchestrators/plugin/info.test.ts:1093-1129`, `plugins: {}` at line 1115].
If a future refactor hoists the record read above the manifest read, or short-
circuits on "record exists" before arm (a), a manifest-read failure with an
installed record would silently render the state-only block instead of
`(failed) {source missing}` — and no test would catch it.

**Why it happens:** the reorder moves exactly one read (`installed`) across one
boundary; it is one line further from also crossing arm (a).

**How to avoid:** add the missing BOUND-01 regression FIRST: marketplace record
with an installed plugin + `manifestPath` pointing at a nonexistent file →
assert byte-exact `(failed) {source missing}` at `error` severity and NO
component lines. Characterize before change.

**Warning signs:** the new block renders under a marketplace whose
`marketplace.json` is absent or malformed.

### Pitfall 2: The two-scope fan-out changes shape silently

**What goes wrong:** `getPluginInfo` splits blocks by status [VERIFIED:
`info.ts:1910-1911`]:

```typescript
  const infoBlocks = blocks.filter((b) => b.plugin.status !== "failed");
  const failedBlocks = blocks.filter((b) => b.plugin.status === "failed");
```

Today, a manifest-absent installed record in BOTH scopes yields two `failed`
blocks → two separate `error` notifications with summaries (the GRAM-04 carve-out,
pinned at `info.test.ts:754-805`). After the split those become two `installed`
blocks → ONE `plugin-info-cascade` at `info` severity, joined by a blank line.
That is a correct and intended consequence, but it is an unpinned byte change on
a path whose current shape has a dedicated test.

**How to avoid:** add a both-scopes state-only fan-out catalog state + test
alongside the single-scope one. Do not modify the GRAM-04 test (its fixture uses
a name in neither state nor manifest, so it still exercises the failed path —
verify this rather than assuming).

**Warning signs:** notification count changes from 2 to 1 in an existing suite.

### Pitfall 3: The cognitive-complexity ceiling is 15 and `buildBlock` is close

**What goes wrong:** `sonarjs/cognitive-complexity` is `["error", 15]`
[VERIFIED: `eslint.config.js:78`] and a red lint blocks `npm run check`. Phase 95
hit exactly this: `installedRowMessage` went 15 → 16 on a one-line ternary and
the fix was extracting a helper. Adding a nested `if` inside `buildBlock`'s arm
(b) plus a reasons ternary is the same shape.

**How to avoid:** put the whole state-only arm in a module-level
`buildStateOnlyInstalledRow(...)`; `buildBlock` gains only
`if (installed !== undefined) { return wrapBlock(..., await buildStateOnly...); }`.
Put the hooks read in its own helper too. Note `sonarjs/no-identical-functions`
is also `error` — the status derivation duplicating `buildNonPathInstalledRow`
may trip it; extract the shared `status`/`reasons` computation if so.

**Warning signs:** `eslint` reports `Refactor this function to reduce its
Cognitive Complexity from 16 to the 15 allowed`.

### Pitfall 4: `exactOptionalPropertyTypes` rejects indexed access on optional fields

**What goes wrong:** TS2375. Phase 95 hit it writing
`PluginInstalledMessage["reasons"]` as an annotation: the indexed access yields
`… | undefined`, which an `exactOptionalPropertyTypes: true` target rejects.

**How to avoid:** wrap in `NonNullable<…>`, and add optional fields ONLY by
conditional spread (`...(cond && { field })`), never by
`field: cond ? x : undefined`. Both idioms are already all over `info.ts`
(e.g. `info.ts:969-973`).

**Warning signs:** `npm run typecheck` TS2375 on a `reasons` / `version` /
`description` assignment.

### Pitfall 5: A new reason token is a four-place amendment

**What goes wrong:** `tests/architecture/notify-closed-set-locks.test.ts` hard-
asserts `REASONS.length === 38` [VERIFIED: `notify-closed-set-locks.test.ts:37`],
and `shared/notify-reasons.ts` carries a `_ReasonsCoverageProof` that pins the
union of the topic groups to exactly the closed set — a literal added to
`REASONS` without a home in a group is a compile error [VERIFIED:
`notify-reasons.ts:16-22`].

**How to avoid:** prefer reuse. Any new token requires: `REASONS` in
`notify.ts`, the right topic group in `notify-reasons.ts`, the count assertion,
the catalog's status/reason reference table, and a DOC-08 ripple (the header
comment already says 37 for a 38-entry set — a known DOC-08 defect).

**Warning signs:** the closed-set lock test fails with an off-by-one.

### Pitfall 6: `catalog-uat` is bidirectional

**What goes wrong:** the driver fails on BOTH a catalog state with no fixture
(`[MISSING FIXTURE]`) and a fixture with no catalog state
(`[ORPHAN FIXTURE]`), and asserts byte AND severity equality. Editing the
catalog prose is safe; editing a fenced block is not.

**How to avoid:** every new fenced block gets an `<!-- catalog-state: … -->`
annotation under the `` ## `/claude:plugin info <plugin>@<marketplace>` `` H2 and
a matching `FIXTURES["/claude:plugin info <plugin>@<marketplace>"]["…"]` entry
built from a pure `NotificationMessage` literal (the fixture map is data, never
synthesized from domain helpers — the SNM-31 scope gate).

**Warning signs:** `catalog UAT failures (n)` with a byte diff.

### Pitfall 7: An empty `components: {}` renders as nothing at all

**What goes wrong:** `componentsResolved: true` with an empty components object
emits no per-kind lines AND no marker — that is deliberately how the `(failed)`
arms stay quiet [VERIFIED: `info.ts:687-697` comment]. A record whose five
`resources` arrays are all empty would therefore render a bare row. For an
ENABLED record that shape does not occur in production (the empty-resources
shape is the disabled marker, and the disabled carve-out runs first), but a
legacy or hand-edited record could produce it.

**How to avoid:** decide explicitly and document it in the catalog entry —
recommend "bare row, no marker" (truthful: the record owns no resources) and
state that the disabled carve-out at `info.ts:1770-1797` has already claimed the
canonical empty shape.

### Pitfall 8: The comment policy bans planning references

**What goes wrong:** `.claude/rules/typescript-comments.md` forbids `Phase NN`,
`Plan NN`, `Wave N`, `Pitfall N`, `milestone vX.Y` in comments and test titles.

**How to avoid:** cite `INFO-09` … `INFO-12`, `BOUND-01/02`, `D-96-01` …
`D-96-04`, `NFR-5`, `NFR-10`, `D-57-03`, `HOOK-02` instead. These are encouraged.

## Code Examples

### Example 1: The state-only row builder (skeleton)

Every literal below is quoted from a verified source location; the composition
is new.

```typescript
/**
 * INFO-09 / INFO-10 / INFO-11 / INFO-12: build the info row for an installed
 * record whose marketplace manifest LOADED but does not declare it. There is no
 * manifest entry, so no resolver runs, no description or dependencies are
 * claimed (they are manifest-only metadata), and NO git probe is constructed --
 * this arm is network-free by signature (NFR-5). D-96-01: the component names
 * are the Pi-generated INSTALLED names exactly as `resources.*` holds them.
 */
async function buildStateOnlyInstalledRow(
  pluginName: string,
  record: MarketplaceRecord["plugins"][string],
  locations: ScopedLocations,
): Promise<PluginInfoRow> {
  const status =
    record.compatibility.unsupported.length > 0 ? "partially-installed" : "installed";

  // INFO-10: the absence reason comes FIRST; `narrowUnsupportedKinds` stays the
  // sole producer of the kind tokens.
  const reasons: readonly ContentReason[] = [
    "not in manifest",
    ...narrowUnsupportedKinds(record.compatibility.unsupported),
  ];

  const { components, degraded } = await composeStateOnlyComponents(record, locations);

  return {
    status,
    name: pluginName,
    version: record.version,
    reasons: degraded === undefined ? reasons : [...reasons, degraded],
    componentsResolved: true,
    components,
  };
}
```

### Example 2: Component reconstruction + the hooks read

```typescript
// Same comparator the manifest-backed arm uses (info.ts:330) so the two
// surfaces sort identically.
const byName = (a: string, b: string): number =>
  a.localeCompare(b, undefined, { sensitivity: "base" });

async function composeStateOnlyComponents(
  record: MarketplaceRecord["plugins"][string],
  locations: ScopedLocations,
): Promise<{
  components: Awaited<ReturnType<typeof composeResolvedComponents>>;
  degraded?: ContentReason;
}> {
  const agents = [...record.resources.agents].sort(byName);
  const commands = [...record.resources.prompts].sort(byName);
  const mcp = [...record.resources.mcpServers].sort(byName);
  const skills = [...record.resources.skills].sort(byName);

  // D-96-03 truthful split: no recorded hooks -> omit the line (true negative).
  // Recorded hooks that cannot be read/parsed -> omit the line AND stamp the
  // degradation marker so the operator is not told the plugin has no hooks.
  const hooksResult = await readStateOnlyHookEntries(record.resources.hooks, locations);

  return {
    components: {
      ...(agents.length > 0 && { agents }),
      ...(commands.length > 0 && { commands }),
      ...(hooksResult.entries !== undefined &&
        hooksResult.entries.length > 0 && { hooks: hooksResult.entries }),
      ...(mcp.length > 0 && { mcp }),
      ...(skills.length > 0 && { skills }),
    },
    ...(hooksResult.degraded !== undefined && { degraded: hooksResult.degraded }),
  };
}

/**
 * INFO-11 / NFR-10: read `<hooksDir>/<slug>/hooks.json` for every recorded
 * hooks slug. The slug is state-supplied data, so the path goes through
 * `assertPathInside` at the READ site -- the same defense the hooks-bridge
 * hydrate applies (bridges/hooks/event-router.ts). D-96-03: no failure shape
 * fails the info block; each collapses to the degradation marker.
 */
async function readStateOnlyHookEntries(
  slugs: readonly string[],
  locations: ScopedLocations,
): Promise<{ entries?: readonly HookSummaryEntry[]; degraded?: ContentReason }> {
  if (slugs.length === 0) {
    return {};
  }

  const entries: HookSummaryEntry[] = [];
  for (const slug of slugs) {
    const hooksJsonPath = hookConfigPathFor(locations, slug);
    try {
      await assertPathInside(locations.hooksDir, hooksJsonPath, "hooks.json info read");
      const raw = await readFile(hooksJsonPath, "utf8");
      // MATCH-03 / A1 projectRoot fallback: mirrors readHookSummaryEntries.
      const ifCtx = { homedir: homedir(), cwd: process.cwd(), projectRoot: process.cwd() };
      const parsed = parseHooksConfig(raw, ifCtx, (): null => null, { skipIfMap: true });
      if (!parsed.ok) {
        return { degraded: "unparseable" };
      }

      // The materialized file IS the filtered supported subset, so `dropped` is
      // empty and only the supported projection renders (declaration order).
      entries.push(...projectHookSummaryEntries(parsed.value));
    } catch (err) {
      return { degraded: narrowProbeError(err) };
    }
  }

  return { entries };
}
```

### Example 3: Test seeding a manifest-absent installed record

Copy the Phase 95 fixture idioms (hermetic HOME, `withHermeticHome`,
`makeCtx`, byte-exact `join("\n")` assertions) from
`tests/orchestrators/plugin/list-manifest-absent.test.ts:27-120`. Manifest
absence is seeded by a manifest that PARSES with the name omitted — omitting the
file instead produces a load error, which is the BOUND-01 state:

```typescript
// Source: tests/orchestrators/plugin/list-manifest-absent.test.ts:250-252
      // A manifest that parses with an EMPTY `plugins` array is a successful
      // load, so every installed record under it is genuinely absent.
      manifest: { name: "mp1", plugins: [] },
      installed: { alpha: { version: "1.0.0" } },
```

For the hooks fixtures, seed `resources.hooks: [pluginName]` and write
`<userRoot>/pi-claude-marketplace/hooks/<pluginName>/hooks.json` containing a
bare event map (the materialized shape), e.g.
`{"Stop":[{"hooks":[{"type":"command","command":"echo hi"}]}]}`.

### Example 4: The INFO-12 zero-call assertion

```typescript
// Source: adapted from tests/orchestrators/plugin/info.test.ts:2915-2950
test("INFO-12: info --fetch on a manifest-absent record makes ZERO clone/auth seam calls", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    // …seed a marketplace whose manifest parses but omits `alpha`,
    //   with `alpha` present in state.marketplaces.mp.plugins…
    const { gitOps, state: gitState } = makeMockGitOps({});
    const { credOps: credentialOps, state: credState } = makeMockCredentialOps();
    const { ctx, pi, notifications } = makeCtx();

    await getPluginInfo({
      ctx, pi, marketplace: "mp", plugin: "alpha", scope: "user", cwd,
      fetch: true,
      cloneCacheSeam: fetchSeamWith(gitOps),
      credentialOps,
    });

    assert.equal(gitState.cloneCalls.length, 0);
    assert.equal(gitState.fetchCalls.length, 0);
    assert.equal(credState.fillCalls.length, 0);
    // …plus the byte-exact block assertion and the D-96-04 skip note…
  });
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manifest membership as `manifest + boolean flag` | One `ManifestLookup` discriminated value judged against the record's OWN manifest | Phase 95 fix loop (commit `06875fa4`, WR-05/06/07) | "entry present + absence claimed" is unrepresentable; D-96-02 ratifies it |
| `{not in manifest}` as a failure-only reason | Also a durable inventory reason on `(installed)` / `(partially-installed)` rows | Phase 95 (INV-01/INV-02, D-95-01..03) | The info surface can now carry it on a non-failed row without any render-map change |
| Reasons filtered by a render-path allowlist | Orchestrator stamps, `notify.ts` renders, no allowlist | D-95-01 (the premise was found to be imprecise — no suppression existed) | No render-map edit is needed to put `not in manifest` on the state-only info row |

**Deprecated / outdated:**

- The PRD's PL-6 row and its §5.3.1 flowchart describe the retired v1 manifest-
  failure renderer and are NOT authoritative (BOUND-01 says so explicitly);
  DOC-08 corrects them in Phase 98. Do not use them as a spec here.
- `docs/output-catalog.md:412`'s closing sentence "Which manifest a folded row
  SHOULD describe at all is still open (BOUND-01 / BOUND-02)" is the note
  D-96-02 closes in this phase.
- `shared/notify-reasons.ts:6-7` says "37-entry" for a 38-entry set — a known
  DOC-08 defect; do NOT fix it here (Phase 98 owns it, and the CONTEXT.md
  canonical refs forbid editing `shared/notify.ts` comments in this phase).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `narrowProbeError` is the right ladder for a hooks-read throw on the state-only arm (giving `source missing` / `permission denied` / `unreadable`) rather than a single fixed token | Pattern 3, Open Q1 | Wrong-flavored brace; cheap to change, but it is a catalog state so it must be settled before the byte pin |
| A2 | `"unparseable"` is the right token for a `parseHooksConfig` `{ok:false}` on the materialized file | Example 2, Open Q1 | Same as A1; `list.ts`'s `ListReason` union already includes `unparseable` for the probe-error path, so the precedent is close but not identical |
| A3 | The GRAM-04 both-scopes test at `info.test.ts:754-805` still exercises the failed path after the split (its `ghost` name is in neither state nor manifest) | Pitfall 2 | If its fixture DOES seed a record, the test breaks and the plan needs an extra task; verify by reading the fixture before planning the task list |
| A4 | Emitting the D-96-04 skip note as a second notification is acceptable (precedented by the disabled+info mixed path at `info.ts:1926-1934`) | Open Q2 | If the operator wants strict IL-2 on this path, the skip note must become a body line or a row reason instead |
| A5 | A state-only record with all five `resources` arrays empty is not reachable for an ENABLED record in production | Pitfall 7 | A bare row with no component lines and no marker; harmless but should be a documented catalog note either way |

## Open Questions

### 1. D-96-03: which closed-set token carries the hooks degradation, and where does it render?

- **What we know:** the closed reason set has 38 members and adding one is a
  four-place amendment (Pitfall 5). Candidates that already exist and are
  truthful: `source missing` (ENOENT), `permission denied` (EACCES),
  `unreadable` (other I/O), `unparseable` (bad JSON / schema). `unsupported
  hooks` exists but means "the declaration is unsupportable", which would be
  untruthful for an unreadable file. The renderer has no "degraded kind line"
  concept: `appendHooksBlock` emits `    hooks:` plus one line per entry and
  returns early on an empty array [VERIFIED: `shared/concerns/hooks.ts`,
  `appendHooksBlock`].
- **What's unclear:** whether the marker must be attributable to hooks
  specifically. A row-level brace reads
  `● alpha v1.0.0 (installed) {not in manifest, unreadable}` — truthful, but it
  does not say "hooks".
- **Recommendation:** **stamp a row-level reason via the existing ladder**
  (`narrowProbeError(err)` for throws, `"unparseable"` for a parse failure) and
  omit the hooks line. Zero new tokens, exact parity with every other component-
  read failure in `info.ts`, and attribution is unambiguous in practice because
  the hooks config is the ONLY disk read the state-only arm performs — state
  that fact in the catalog entry's prose. Two alternatives to record and reject
  explicitly in the plan: (i) a synthetic lenient hook entry (the lenient arm
  takes an arbitrary `event: string`, so `hooks:` / `      (unreadable)` is
  representable without a type change — but it abuses the `event` field);
  (ii) a brand-new `malformed hooks` token (truthful and per-kind consistent
  with `malformed skill` / `malformed command`, but a full closed-set
  amendment plus a DOC-08 ripple).

### 2. D-96-04: what shape is the "visible skip note"?

- **What we know:** the `(skipped) {not in manifest}` byte form exists on
  `update` — `⊘ hello v1.0.0 (skipped) {not in manifest}` under
  `A plugin operation needs attention.` [VERIFIED:
  `tests/orchestrators/plugin/update.test.ts:437`] — and a `(skipped)` cascade
  row also exists on `fetch` at info severity
  (`⊘ gp (skipped) {up-to-date}`, catalog `single-noop-skipped`).
  `PluginInfoRow.status` does NOT admit `skipped` [VERIFIED:
  `notify.ts:1300-1310`], so the standalone info row cannot carry it.
  `PLUGIN_INFO_STATUSES` is `["disabled"] as const` [VERIFIED:
  `info.messaging.ts:44`] and the info surface already emits a command-local
  cascade row beside a standalone block for the disabled case, deliberately
  breaking IL-2 [VERIFIED: `info.ts:1926-1934`].
- **What's unclear:** severity, and whether a second notification is acceptable
  here. The house rule that forces SOME visible difference is the D-81-04
  rationale already in the file: "otherwise a failed `--fetch` would render
  byte-identical to bare info" [VERIFIED: `info.ts:1169-1176`].
- **Recommendation:** widen `PLUGIN_INFO_STATUSES` to
  `["disabled", "skipped"]`, add the `skipped` arm to `PLUGIN_INFO_RENDER`
  (reusing `ICON_UNINSTALLABLE` + `composeReasons`), and emit
  `⊘ <plugin> [scope?] (skipped) {not in manifest}` as a cascade block beside
  the info block when `opts.fetch === true` AND the state-only arm fired. This
  reuses the vocabulary D-96-04 names, adds no reason token and no plugin-status
  member, and follows the disabled precedent for the second notify. Severity is
  a genuine choice: `info` matches `fetch`'s no-op row; `warning` matches
  `update`'s form and the operator's tri-state model (carried-out-but-short).
  **Recommend `warning`**, and pin both the row bytes and the summary line
  (`A plugin operation needs attention.`) as a catalog state. Alternative to
  record: a body line inside the info block (e.g. `    fetch: skipped`), which
  keeps IL-2 but invents new renderer vocabulary.

### 3. Should the D-96-02 regression pins live in the list suite or a new one?

- **What we know:** info has no cross-scope orphan fold — `getPluginInfo`
  emits one block per scope that holds the marketplace record and never folds
  [VERIFIED: `info.ts:1818-1828`, `1897-1924`]. The fold lives only in `list.ts`
  (`isCloneOfUserMarketplace`, `list.ts:927-939`).
- **Recommendation:** D-96-02's pins belong in
  `tests/orchestrators/plugin/list-manifest-absent.test.ts` (extending the
  existing BOUND-03 fold fixtures to also assert the description and the
  upgradable derivation come from the folded record's own manifest), plus the
  one-paragraph catalog edit at `docs/output-catalog.md:412`. No `info.ts`
  change is needed for D-96-02.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | all tests + typecheck | ✓ | project engine `>=20.19.0` | — |
| npm | `npm run check` | ✓ | — | — |
| `node:test` | every suite | ✓ | built-in | — |
| `pi-subagents` (global peer) | 2 integration tests only | ✗ locally (stale 0.24.3 vs `>=0.35.0`) | — | Point `PI_SUBAGENTS_ROOT` at Pi's managed 0.42.1, per STATE.md; CI skips both |
| Network | nothing in this phase | n/a | — | INFO-12 asserts abstinence |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** the `pi-subagents` global peer — a
known, documented environment issue (Phase 95 `deferred-items.md`), unrelated to
this phase. `npm run check` is green when `PI_SUBAGENTS_ROOT` points at the
managed 0.42.1.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | `node:test` (Node built-in), TypeScript run natively (no build step) |
| Config file | none — driven by `package.json` scripts + `tsconfig.json` |
| Quick run command | `node --test "tests/orchestrators/plugin/info*.test.ts"` |
| Full suite command | `npm run check` (typecheck + lint + format:check + test + test:integration) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| INFO-09 | `(installed) {not in manifest}` byte-exact, recorded version, `info` severity | integration (orchestrator) | `node --test tests/orchestrators/plugin/info-manifest-absent.test.ts` | ❌ Wave 0 |
| INFO-09 | Same bytes reachable through `notify()` from a pure message literal | architecture (catalog gate) | `node --test tests/architecture/catalog-uat.test.ts` | ✅ (add fixtures) |
| INFO-10 | `(partially-installed) {not in manifest, lsp}` — absence token FIRST | integration | `node --test tests/orchestrators/plugin/info-manifest-absent.test.ts` | ❌ Wave 0 |
| INFO-11 | 4 kinds sorted, generated names verbatim, MCP raw keys | integration | same | ❌ Wave 0 |
| INFO-11 | hooks read from `<hooksDir>/<slug>/hooks.json`, declaration order | integration | same | ❌ Wave 0 |
| INFO-11 | D-96-03 truthful split (no hooks → omit; unreadable/malformed → marker) | integration (3 arms: ENOENT, EACCES POSIX-only, bad JSON) | same | ❌ Wave 0 |
| INFO-11 | traversal slug is refused by `assertPathInside`, block still renders | integration | same | ❌ Wave 0 |
| INFO-12 | zero clone/fetch/credential seam calls under `--fetch` | integration | same | ❌ Wave 0 |
| INFO-12 | D-96-04 skip note bytes | integration + catalog gate | same + `catalog-uat` | ❌ Wave 0 |
| BOUND-01 | manifest read failure WITH an installed record still `(failed) {source missing}` | integration | `node --test tests/orchestrators/plugin/info.test.ts` | ⚠️ partial — existing test has no record (Pitfall 1) |
| BOUND-02 | name in neither manifest nor state stays `(failed) {not in manifest}` | integration | `node --test tests/orchestrators/plugin/info.test.ts` | ✅ (`info.test.ts:718`) |
| D-96-02 | folded row's absence / upgradable / description come from its own manifest | integration | `node --test tests/orchestrators/plugin/list-manifest-absent.test.ts` | ✅ (extend) |
| NFR-5 | `info.ts` names no git surface | architecture | `node --test tests/architecture/no-orchestrator-network.test.ts` | ✅ |
| closed sets | no accidental token/status growth | architecture | `node --test tests/architecture/notify-closed-set-locks.test.ts` | ✅ |

### Sampling Rate

- **Per task commit:** `node --test "tests/orchestrators/plugin/info*.test.ts" "tests/architecture/catalog-uat.test.ts" "tests/architecture/notify-closed-set-locks.test.ts" "tests/architecture/no-orchestrator-network.test.ts"`
- **Per wave merge:** `npm run typecheck && npm run lint && npm test`
- **Phase gate:** `npm run check` green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `tests/orchestrators/plugin/info-manifest-absent.test.ts` — new suite;
      covers INFO-09/10/11/12 (helpers copied, not imported, per house
      convention)
- [ ] BOUND-01 regression with an INSTALLED record added to
      `tests/orchestrators/plugin/info.test.ts` — **write this before the
      production change** (characterize before change)
- [ ] `catalog-uat` fixtures for each new `<!-- catalog-state: … -->` block
- [ ] No framework install needed.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | The phase asserts the auth seam is NOT called; it never authenticates |
| V3 Session Management | no | No sessions |
| V4 Access Control | no | No multi-user model; scope separation is a path concern, covered under V12 |
| V5 Input Validation | yes | `state.json` is validated by `STATE_VALIDATOR` at load; the materialized hooks config is re-validated by `HOOKS_VALIDATOR` inside `parseHooksConfig` — do not hand-roll either |
| V6 Cryptography | no | None involved |
| V12 File & Resource (path traversal) | **yes — primary** | `assertPathInside(locations.hooksDir, …)` at the READ site for the state-supplied slug (INFO-11, NFR-10) |
| V14 Configuration | yes | No new config surface; no new network path (COMPAT-01) |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Traversal slug in `resources.hooks` (`"../../etc"`) escaping `hooksDir` on a `readFile` | Information disclosure | `assertPathInside` at the read site — the exact defense `bridges/hooks/event-router.ts:628-641` already documents for the identical input |
| Symlinked `<hooksDir>/<slug>/hooks.json` pointing outside the extension root | Information disclosure | `assertPathInside` resolves via realpath; the write-side subtree walk (`assertNoSymlinkEscapeInHooksSubtree`) already refused escaping links at install time |
| Malformed/hostile hooks JSON causing a throw that fails the whole info block | Denial of service (local) | D-96-03: every failure shape collapses to a reason marker; the block always renders |
| Reason-brace injection via a plugin-controlled string | Tampering / spoofing of output | Reasons are a closed `ContentReason` union; no free-form string reaches the brace. Component NAMES are free-form but come from `assertSafeName`-validated generated names (no path separators, no ASCII control chars — `domain/name.ts:23-50`) |
| An unintended network call under `--fetch` leaking a repo URL or credential | Information disclosure | INFO-12 zero-call assertion against injected `cloneCacheSeam` + `credentialOps`; `no-orchestrator-network` gate keeps the git surface out of `info.ts` |

No new attack surface: the phase adds one read of a file the extension itself
wrote, inside the extension's own root, behind the existing containment
chokepoint.

## Sources

### Primary (HIGH confidence)

All read directly in the worktree
`/home/acolomba/pi-claude-marketplace/.worktrees/manifest-independent-plugin-info`
on 2026-08-08:

- `extensions/pi-claude-marketplace/orchestrators/plugin/info.ts` (full file,
  1945 lines) — dispatch structure, arms (a)-(e), fetch probes, disabled
  partition, failed-block separation, NUL byte at line 416
- `extensions/pi-claude-marketplace/orchestrators/plugin/info.messaging.ts` —
  `PLUGIN_INFO_STATUSES` / `PLUGIN_INFO_RENDER` / `PLUGIN_INFO_CONTEXT`
- `extensions/pi-claude-marketplace/orchestrators/plugin/list.ts:245-330`,
  `:780-940` — `ManifestLookup`, `manifestLookupFor`, `ScopedManifest`,
  `loadManifestSoftly`, `partiallyInstalledReasons`, the fold rule
- `extensions/pi-claude-marketplace/persistence/state-io.ts:38-180` — the
  `resources` schema, `PluginInstallRecord`, the disabled branded types
- `extensions/pi-claude-marketplace/persistence/locations.ts` — `hooksDir` and
  the containment chokepoints
- `extensions/pi-claude-marketplace/bridges/hooks/stage.ts` —
  `hookConfigPathFor`, `writeHookConfig`
- `extensions/pi-claude-marketplace/bridges/hooks/event-router.ts:525-655` —
  the read-site containment + hydrate loop
- `extensions/pi-claude-marketplace/bridges/mcp/stage.ts:200-290` — raw-key
  staging
- `extensions/pi-claude-marketplace/domain/components/hooks.ts:296-458` —
  `parseHooksConfig`, wrapper detection, partition
- `extensions/pi-claude-marketplace/domain/name.ts:23-123` — the three
  generated-name shapes
- `extensions/pi-claude-marketplace/domain/manifest.ts:40-100` — the memoized
  loader
- `extensions/pi-claude-marketplace/shared/notify.ts:85-180`, `:490-560`,
  `:1240-1340`, `:2700-2762`, `:3160-3340` — `REASONS`, statuses,
  `PluginInfoRow`, severity, `renderPluginInfo`
- `extensions/pi-claude-marketplace/shared/notify-reasons.ts:1-200` — topic
  groups + coverage proof
- `extensions/pi-claude-marketplace/shared/concerns/hooks.ts` —
  `HookSummaryEntry`, `appendHooksBlock`
- `extensions/pi-claude-marketplace/shared/probe-classifiers.ts:183-210` —
  `narrowUnsupportedKinds`
- `extensions/pi-claude-marketplace/orchestrators/plugin/install.ts:1024-1190` —
  hooks phase + state record population
- `extensions/pi-claude-marketplace/orchestrators/reconcile/plan.ts:252-276` —
  `isRecordedButDisabled`
- `extensions/pi-claude-marketplace/edge/handlers/plugin/info.ts` — the
  `--fetch` flag surface
- `tests/architecture/catalog-uat.test.ts` — the bidirectional byte gate
- `tests/architecture/no-orchestrator-network.test.ts` — the NFR-5 gate
- `tests/architecture/notify-closed-set-locks.test.ts` — 38 reasons / 19
  statuses / 24 tokens
- `tests/orchestrators/plugin/info.test.ts` (outline + lines 714-810,
  1085-1130, 2750-2960) — existing pins and the zero-call idiom
- `tests/orchestrators/plugin/list-manifest-absent.test.ts:1-300` — Phase 95
  fixture idioms
- `tests/helpers/git-mock.ts`, `tests/helpers/credential-mock.ts` — seam mocks
- `docs/output-catalog.md:400-425`, `:987-1040`, `:1441-1590` — the info
  section, the manifest-absent list states, the fetch `(skipped)` precedent
- `eslint.config.js:70-90`, `:300-325` — complexity ceiling and test overrides
- `.planning/REQUIREMENTS.md`, `.planning/STATE.md`,
  `.planning/phases/96-…/96-CONTEXT.md`,
  `.planning/phases/95-…/95-PATTERNS.md`, `95-01-SUMMARY.md`,
  `deferred-items.md`
- `CLAUDE.md`, `.claude/rules/typescript-comments.md`

### Secondary (MEDIUM confidence)

- `tests/orchestrators/plugin/update.test.ts:432-437` — the
  `(skipped) {not in manifest}` byte form (read via grep context, not the whole
  test body)

### Tertiary (LOW confidence)

- None. No web search was performed: the phase touches no external API, no
  package, and no upstream Claude Code surface. `WebSearch` would add nothing a
  file read does not already settle.

## Project Constraints (from CLAUDE.md)

Directives the plan must honor:

- **Git:** never commit to `main`; work stays on
  `features/manifest-independent-plugin-info` in the worktree. Conventional
  Commits, title 5-72 chars, body lines ≤ 80. Run
  `pre-commit run --files <changed>` BEFORE `git commit`, never `--no-verify`,
  never rebase. From this worktree, prefix commits with `SKIP=trufflehog` after
  confirming a clean `trufflehog filesystem` scan over the changed paths (the
  git-mode hook cannot read a linked worktree's `.git` file).
- **PR titles:** Conventional Commits, no milestone/phase mentions.
- **Comments and test titles:** no `Phase NN` / `Plan NN` / `Wave N` /
  `Pitfall N` / `milestone vX.Y`. Cite `INFO-NN`, `BOUND-NN`, `D-96-NN`,
  `NFR-N` instead (`.claude/rules/typescript-comments.md`).
- **Output channel (IL-2):** all user-visible messages through
  `notify` / `notifyWithContext`; direct `ctx.ui.notify` outside
  `shared/notify.ts` is forbidden by ESLint and a grep gate. Deliberate IL-2
  breaks (the mixed disabled/info path) must be justified in a comment.
- **Network (NFR-5):** `info` MUST NOT touch the network. `info.ts` is a
  `FORBIDDEN_TARGET` of the architecture gate.
- **Containment (NFR-10):** refuse to read/write outside the scope roots;
  `assertPathInside` is the single chokepoint.
- **Quality bar (NFR-6):** `npm run check` must stay green.
- **No telemetry, English-only, two scopes** — unchanged by this phase.
- **Versioning:** before opening a PR, offer to bump `package.json`,
  `sonar-project.properties`, `EXTENSION_VERSION`, `package-lock.json`, and add
  a `CHANGELOG.md` entry.
- **Docs prose:** the `simple-english` project skill
  (`.claude/skills/simple-english/SKILL.md`) applies to the new
  `docs/output-catalog.md` prose.

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — no external packages; every internal module was opened
  and quoted with line ranges.
- Architecture: HIGH — the full 1945-line `info.ts` was read; the dispatch map
  and the two `makeFetchProbe` sites are exact.
- Pitfalls: HIGH for 1-6 and 8 (each traced to a gate, a lint rule, or a Phase
  95 auto-fix record); MEDIUM for 7 (reachability of the all-empty resources
  shape is reasoned, not observed).
- Open questions: MEDIUM — both are deliberate operator-facing choices left open
  by D-96-03/04, with recommendations grounded in existing precedent.

**Research date:** 2026-08-08
**Valid until:** 2026-09-07 (30 days — the subject is in-repo code on a frozen
feature branch; only a merge to `main` would invalidate line numbers)
