# Phase 81: Fetch verb & info --fetch - Research

**Researched:** 2026-07-14
**Domain:** Internal orchestrator/verb wiring for a Pi extension (TypeScript strict, ESM, node:test) — a NEW pi-only `fetch` verb + `info --fetch` flag over existing clone-cache seams
**Confidence:** HIGH (every claim below is grounded in the current codebase read this session; no external packages introduced)

## Summary

Phase 81 adds a NEW orchestrator verb, `fetch`, in three shapes (`fetch <plugin>@<marketplace>`, `fetch @<marketplace>`, bare `fetch`), plus an `info --fetch` flag. The entire phase is composition of shipped seams: `resolvePluginPin` + `materializePluginClone` (pinned) / `materializeOrRefreshPluginMirror` (unpinned) for the git surface, `buildAuthForHost` + once-per-host `authMemo` for auth parity, `probeManifestEntry` / `availableRowMessage` (Phase 80's fs-only warm-tree classifier) for the post-fetch status row, and the `update` verb's bulk cascade grammar (marketplace headers, per-plugin rows, tally + summary, failure-tolerant sweep) for output. No closed set grows (STATUS_TOKENS, REASONS, PLUGIN_STATUSES, ICONs all already carry every member fetch needs — `up-to-date` and `remote` are the load-bearing existing members). No new persisted state; `garbageCollectPluginClones` already sweeps unreferenced clones (FTCH-05 is a verify-don't-build property).

The one genuinely new design surface is the **fetchable-set enumeration**: fetch acts on the marketplace MANIFEST (not-installed `(remote)` + unpinned-warm git plugins), NOT on installed state records the way `update` enumerates. So the bulk enumerator mirrors `edge-deps.ts::loadManifestForMarketplace` (manifest read + `probeManifestEntry` classification), not `update.ts::enumerateTargets` (state-record walk). The fetchability filter and the completion filter both have a subtlety: the completion-cache row `status` distinguishes `remote` but does NOT distinguish pinned-warm from unpinned-warm (both classify to `available`/`partially-available`/`unavailable`). That gap is an OPEN QUESTION the planner must resolve (see below).

**Primary recommendation:** Build `orchestrators/plugin/fetch.ts` on the **install-style seam-injection model** (NOT the update-style gitOps exemption): it must be install-parity because `info.ts` — which `info --fetch` lives in — is a FORBIDDEN_TARGET in the no-orchestrator-network gate and can never name gitOps. Delegate all git to the `clone-cache.ts` seam by name (`materializePluginClone` / `materializeOrRefreshPluginMirror` / `resolvePluginPin`) exactly as `install.ts::makeInstallCloneProbe` does; keep `fetch.ts` OUT of FORBIDDEN_TARGETS is unnecessary — add it TO the list (belt-and-braces) since it will carry zero gitOps surface.

## User Constraints (from CONTEXT.md)

### Locked Decisions

**D-81-01 (shapes + fetchable set):** ALL THREE shapes ship in this phase: `fetch <plugin>@<marketplace>` (single), `fetch @<marketplace>` (marketplace-wide), bare `fetch` (all marketplaces). Bulk sweeps act on the fetchable set — `(remote)` plugins (materialize) and unpinned-warm plugins (mirror refresh); pinned-warm and path sources are no-ops. A per-plugin fetch failure never aborts the sweep.

**D-81-02 (output grammar):** Fetch success renders the plugin's POST-FETCH derived status row — exactly what `list`/`info` show (`(available)` / `(partially-available)` / `(unavailable)` from the three-way resolver on the fresh warm tree). Derive-not-persist: no `fetched` token; closed sets do not grow. No-ops render `(skipped)` + an existing closed-set reason at info severity (`up-to-date` is the natural member; planner picks within existing REASONS). Bulk output at bulk-update grammar parity: marketplace headers, per-plugin rows, summary line prepended to error/warning cascades. No new REASONS members (FTCH-03), no new output machinery.

**D-81-03 (completion):** `fetch <tab>` offers `(remote)` + unpinned-warm git-source plugins; pinned-warm and path sources excluded (pure no-ops — still accepted if typed, rendering the no-op row). `fetch @<tab>` offers marketplace names.

**D-81-04 (info --fetch degrade):** `info --fetch <plugin>@<marketplace>` fetches then resolves and lists components. A fetch failure degrades to the normal info row with `components: not resolved` + an existing closed-set reason (e.g. `network unreachable`) and NEVER fails the info command. Bare `info` stays network-free.

**D-81-05 (network & auth):** Network on cache miss only (FTCH-04; for unpinned sources the mirror refresh IS the consented fetch); auth at install parity — `buildAuthForHost`, once-per-host memo, PROV-02/03/04 semantics (FTCH-06, DECIDED 2026-07-13, do not re-litigate).

### Claude's Discretion

- **Architecture-gate placement:** exempt like `update.ts` (Pattern S-9) OR git-free via `cloneCacheSeam` injection like `install.ts` — pick whichever keeps the gate honest with the smaller exemption surface. *(Research recommends install-style; see Architecture Patterns → "Architecture-gate placement decision".)*
- **Exact `(skipped)` reason member** per no-op case, within existing REASONS.
- **Bulk iteration order and header grouping** — follow the bulk-update precedent exactly.
- **Whether `fetch` gets its own catalog section** in `docs/output-catalog.md` (it MUST — new verb = new catalog rows) and the docs/README note documenting fetch as a pi-only extension (FTCH-01).

### Deferred Ideas (OUT OF SCOPE)

None — the previously deferred bulk shapes (FTCH-07) were promoted INTO this phase by the operator. No persisted fetch registry/refcount; no new REASONS members; no resolver-union change; no upstream-parity claim; no fetch progress UI.

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| FTCH-01 | `fetch <plugin>@<marketplace>` materializes a git-source clone without installing; documented pi-only extension | Verb registration path (router.ts + register.ts + edge handler + `fetch.ts` orchestrator); the fetch operation reuses `install.ts::makeInstallCloneProbe` composition. Docs note lands in output-catalog + messaging-style-guide + README. |
| FTCH-02 | `fetch` idempotent; no-op at info severity for path sources and already-warm caches | `makePresenceProbe` (fs-only) decides no-op BEFORE materializing; `(skipped) {up-to-date}` row via existing REASONS. Pinned-warm short-circuit already lives in `materializePluginClone`. |
| FTCH-03 | `info --fetch` fetches then resolves; failure degrades to `not resolved` + existing reason; never fails info. No new REASONS | info.ts already has the `components: not resolved` degrade arm + `network unreachable` reason; `--fetch` threads a fetch hook before the fs-only resolve. |
| FTCH-04 | Fetch network cache-miss-only (NFR-5 amendment) | Pinned-warm short-circuits offline; unpinned mirror refresh IS the consented cache-miss fetch (D-81-05). Path sources touch no network. |
| FTCH-05 | Fetched-but-uninstalled clones stay GC-sweepable; status self-heals to `(remote)` after sweep | VERIFY-DON'T-BUILD: `garbageCollectPluginClones` derives live keys from installed records ONLY (`resolvedSha` present). A fetched-uninstalled clone has no record → not live → swept. No code change; add a regression test. |
| FTCH-06 | Fetch auth at install parity (`buildAuthForHost`, once-per-host memo, PROV-02/03/04) | `buildProbeAuth` + `buildAuthForHost` (auth-host.ts, gate-clean re-export). A single `authMemo = new Map()` at sweep top threads through every per-plugin fetch. |
| FTCH-07 | `fetch @<marketplace>` + bare `fetch`; per-plugin rows at bulk-update grammar parity; failure never aborts sweep | Bulk enumerator mirrors `edge-deps.ts::loadManifestForMarketplace` (manifest + `probeManifestEntry`); cascade rendering reuses `notifyWithContext` + a `FETCH_CONTEXT`; failure tolerance via per-plugin try/catch into a partitioned outcome (update's `updateSinglePlugin` NEVER-throws pattern). |

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Verb subcommand routing + USAGE | Edge (`router.ts`) | — | Router is the single dispatch + Usage-emission site; `TOP_LEVEL_SUBCOMMANDS`/`TOP_LEVEL_USAGE` are the closed authority the completion provider re-imports. |
| Flag parse (`fetch` positional shapes; `info --fetch` boolean) | Edge handler (`edge/handlers/plugin/*.ts`) | Edge `args.ts` tokenizer | Thin-shim handlers own positional/flag validation; delegate to orchestrator. |
| Fetchable-set enumeration (manifest) | Orchestrator (`fetch.ts`) | `domain/manifest.ts`, `git-source-probe.ts` | Fetch acts on the manifest inventory, not installed state — mirrors `edge-deps.ts::loadManifestForMarketplace`, not `update.ts::enumerateTargets`. |
| Git materialize / mirror refresh | `clone-cache.ts` seam | `platform/git` (only inside the seam) | NFR-5 gate: the orchestrator names the seam by entrypoint, never `gitOps`. |
| Auth (host-keyed, once-per-host memo) | `auth-host.ts` (`buildAuthForHost`) | `domain/auth-registry`, `github-auth` | Gate-clean orchestrator-tier module install/update/reinstall already share. |
| Post-fetch status row derivation | `git-source-probe.ts::probeManifestEntry` / `list.ts::availableRowMessage` | `domain/resolver.ts` (`resolveStrict`) | fs-only three-way classification on the freshly-warm tree — the exact `list`/`info` derivation. |
| Cascade rendering (headers/rows/tally/summary/severity) | `shared/notify.ts` + `shared/notify-context.ts` | `fetch.messaging.ts` (new command-local vocabulary) | Central presentation vocabulary; command supplies a private status set + render map (D-10). |
| Completion buckets (`fetch <tab>` / `fetch @<tab>`) | Edge (`completions/provider.ts` + `data.ts`) | `completion-cache.ts` (`PluginIndexRow.status`), `edge-deps.ts` | New `PluginRefMode` "fetch" with a fetchable status filter + marketplace-only branch. |
| GC self-heal (FTCH-05) | `clone-gc.ts` | — | Already correct; verify only. |

## Standard Stack

No external packages are introduced in this phase. It is 100% internal-code composition over the shipped stack (TypeScript strict, ESM, `typebox` for cache schema, `node:test`). The relevant "libraries" are the internal seams below.

### Core seams to drive

| Seam / module | Purpose | Why standard here |
|---------------|---------|-------------------|
| `orchestrators/plugin/clone-cache.ts` → `materializePluginClone` | Pinned-source clone at exact sha; warm short-circuit stays offline (PURL-02/04) | The fetch of a pinned source IS this call. `[VERIFIED: codebase read]` |
| `clone-cache.ts` → `materializeOrRefreshPluginMirror` | Unpinned-source mirror materialize-or-refresh; ALWAYS refreshes on warm (MIRR-02) | The fetch of an unpinned source IS this call; refresh-on-warm is why unpinned-warm is meaningfully fetchable. `[VERIFIED: codebase read]` |
| `clone-cache.ts` → `resolvePluginPin`, `canonicalCloneUrl` | Canonical URL + pin resolution (sha over ref; unpinned resolves remote HEAD) | Pinned probe arm needs this before materialize. `[VERIFIED: codebase read]` |
| `orchestrators/auth-host.ts` → `buildAuthForHost`, `hostFromCloneUrl`, `DEFAULT_CREDENTIAL_OPS` | Host-keyed `GitAuthBundle` + once-per-host memo; gate-clean re-export | Auth parity for free (FTCH-06). `[VERIFIED: codebase read]` |
| `orchestrators/plugin/git-source-probe.ts` → `probeManifestEntry`, `makePresenceProbe`, `readMirrorHeadSha` | fs-only classification (`remote`/`available`/`partially-available`/`unavailable`) of a manifest entry | Fetchability decision (`remote`+warm split) AND post-fetch row derivation. `[VERIFIED: codebase read]` |
| `orchestrators/plugin/list.ts` → `availableRowMessage` (exported as `__test_availableRowMessage`) | Builds the not-installed status ROW message (`PluginRemote/Available/PartiallyAvailable/Unavailable Message`) | The post-fetch success row = this builder run on the now-warm tree. `[VERIFIED: codebase read]` |
| `shared/notify-context.ts` → `notifyWithContext`, `notifyUpdateWithContext`, `notifyUpdateNoOpWithContext` | Cascade dispatch with `label` + `cardinality` + optional `tally`; the all-warm no-op headline analog | Fetch bulk cascade = `notifyWithContext` with a `FETCH_CONTEXT` label + a fetch tally + a no-op headline. `[VERIFIED: codebase read]` |
| `orchestrators/plugin/clone-gc.ts` → `garbageCollectPluginClones` | Sweeps unreferenced clones/mirrors | FTCH-05 self-heal already works; verify only. `[VERIFIED: codebase read]` |
| `domain/manifest.ts` → `loadMarketplaceManifest` | Read a marketplace manifest (the fetchable inventory source) | Bulk enumeration reads the manifest, not state records. `[VERIFIED: codebase read — used by edge-deps.ts]` |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Enumerating the MANIFEST for fetch bulk | Enumerating installed STATE records (update.ts pattern) | REJECTED: update acts on installed plugins; fetch acts on not-installed `(remote)` + unpinned-warm inventory. State records would miss every `(remote)` plugin (the whole point). Mirror `edge-deps.ts::loadManifestForMarketplace`. |
| install-style seam injection for git surface | update-style Pattern S-9 gitOps exemption | REJECTED (see Architecture Patterns). `info.ts` is a FORBIDDEN_TARGET and hosts `info --fetch`; the fetch surface it calls MUST be gitOps-free at the call site. |

**Installation:** None. No `npm install`. This phase adds `.ts` source + tests only.

## Package Legitimacy Audit

Not applicable — this phase installs **zero external packages**. It composes existing internal modules only. No `npm install`, no `package.json` dependency change. (Confirmed by reading the phase boundary and every reusable-asset reference; all are in-repo modules under `extensions/pi-claude-marketplace/`.)

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### System Architecture Diagram

```
/claude:plugin fetch [<pl>@<mp> | @<mp> | (bare)]        /claude:plugin info --fetch <pl>@<mp>
              │                                                        │
              ▼                                                        ▼
  edge/router.ts (add "fetch" case → handlers.fetch)      edge/handlers/plugin/info.ts
              │                                             (parse --fetch boolean; thread to getPluginInfo)
              ▼                                                        │
  edge/handlers/plugin/fetch.ts (NEW)                                  │
   parse 3 positional shapes → FetchTarget union                       │
              │                                                        │
              ▼                                                        ▼
  orchestrators/plugin/fetch.ts (NEW)  ◄──────────── getPluginInfo(opts.fetch===true)
   1. enumerateFetchTargets(target)                     calls the SAME fetch-one seam
      • plugin  → resolveInstalledMarketplaceTarget/manifest entry
      • @mp/bare → loadMarketplaceManifest + probeManifestEntry (fetchable filter)
   2. authMemo = new Map()  (spans whole sweep)
   3. for each target (failure-tolerant try/catch):
        ┌─ presence probe (makePresenceProbe, fs-only) ──► warm+pinned OR path? → (skipped){up-to-date}
        │                                                   remote OR unpinned?  ▼
        │                                        ┌──────────────────────────────────────┐
        │                                        │ clone-cache.ts SEAM (git surface here)│
        │                                        │  pinned:  resolvePluginPin +          │
        │                                        │           materializePluginClone      │
        │                                        │  unpinned: materializeOrRefreshMirror  │
        │                                        │  auth:    buildProbeAuth→buildAuthForHost(authMemo)│
        │                                        └──────────────────────────────────────┘
        │                                                   ▼ (now warm)
        └──────────────────────────────► availableRowMessage / probeManifestEntry (fs-only)
                                                             ▼ post-fetch status row
   4. notifyWithContext(FETCH_CONTEXT, marketplaces[], cardinality, tally)
        → shared/notify.ts renders headers + rows + summary + severity  (info-fetch: single PluginInfoMessage)
```

The diagram's data flow: a request enters the router, is shaped into a target union by the handler, enumerated against the MANIFEST (not state), then each target flows through a presence-probe gate (no-op vs fetch), the git seam (only place gitOps lives), and back through the fs-only classifier to a status row. Bulk aggregates rows into the cascade; `info --fetch` produces one info block.

### Recommended Project Structure

```
extensions/pi-claude-marketplace/
├── orchestrators/plugin/
│   ├── fetch.ts              # NEW — fetch orchestrator (enumerate + fetch-one + cascade)
│   ├── fetch.messaging.ts    # NEW — FETCH_CONTEXT: private status set + render map (mirrors update.messaging.ts)
│   ├── clone-cache.ts        # UNCHANGED — the git seam fetch drives by name
│   ├── git-source-probe.ts   # UNCHANGED — probeManifestEntry / makePresenceProbe reused
│   ├── list.ts               # reuse availableRowMessage (already exported __test_availableRowMessage)
│   └── info.ts               # EDIT — add --fetch hook (delegates fetch to the seam; FORBIDDEN_TARGET stays clean)
├── edge/
│   ├── router.ts             # EDIT — add "fetch" to TOP_LEVEL_SUBCOMMANDS + USAGE + switch case + SubcommandHandlers
│   ├── register.ts           # EDIT — wire makeFetchHandler into the handlers record
│   ├── handlers/plugin/
│   │   ├── fetch.ts          # NEW — thin-shim handler (3 positional shapes → FetchTarget)
│   │   └── info.ts           # EDIT — accept the --fetch boolean flag; thread to getPluginInfo
│   └── completions/
│       ├── provider.ts       # EDIT — add "fetch" branch (plugin-ref + @marketplace-only)
│       └── data.ts           # EDIT — add "fetch" PluginRefCompletionMode + fetchable status filter
docs/
├── output-catalog.md         # EDIT — NEW `## /claude:plugin fetch` H2 section + catalog-state fixtures
└── messaging-style-guide.md  # EDIT — reference fetch in the grammar summary (no new closed-set frontmatter; v2.0 retired it)
README + docs                 # EDIT — document fetch as a pi-only extension (FTCH-01)
tests/
├── orchestrators/plugin/fetch.test.ts       # NEW — mirror update.test.ts bulk patterns
├── edge/handlers/plugin/fetch.test.ts        # NEW — 3-shape parse + info --fetch
├── edge/completions/*.test.ts                # EDIT — fetch completion buckets
├── architecture/no-orchestrator-network.test.ts  # EDIT — add fetch.ts to FORBIDDEN_TARGETS
├── architecture/catalog-uat.test.ts          # EDIT — add fetch (section, state) fixtures
└── orchestrators/plugin/clone-gc.test.ts     # EDIT — FTCH-05 fetched-uninstalled sweep regression
```

### Pattern 1: Install-style git-surface delegation (the fetch-one core)

**What:** The orchestrator NEVER names `gitOps` / `DEFAULT_GIT_OPS` / `refreshGitHubClone` / `platform/git`. It reaches the git surface only through named `clone-cache.ts` entrypoints, with an optional test-only `cloneCacheSeam` override.
**When to use:** For the fetch-one operation in BOTH `fetch.ts` and the `info --fetch` path.
**Example (lift the shape from `install.ts::makeInstallCloneProbe`):**
```typescript
// Source: extensions/pi-claude-marketplace/orchestrators/plugin/install.ts (505-623), verified this session
// pinned arm:
const { cloneUrl, pin, ref } = await seam.resolvePluginPin({ source: gitSource });
const authBundle = buildProbeAuth(cloneUrl, gitSource.kind, auth); // → buildAuthForHost(authMemo)
const cloneRoot = await seam.materializePluginClone({
  locations, cloneUrl, pin,
  ...(ref !== undefined && { ref }),
  ...(authBundle !== undefined && { auth: authBundle }),
});
// unpinned arm:
const { pluginRoot, resolvedSha } = await seam.materializeOrRefreshPluginMirror({
  locations, cloneUrl,
  ...(gitSource.ref !== undefined && { ref: gitSource.ref }),
  ...(authBundle !== undefined && { auth: authBundle }),
});
```

### Pattern 2: No-op decision BEFORE materialize (idempotency, FTCH-02)

**What:** Before calling any git seam, run the fs-only `makePresenceProbe(locations)`. A path source or a pinned-warm clone (`materialized` from a `sha`-keyed entry) is a no-op → render `(skipped) {up-to-date}` at info severity, skip the network. `remote` (cold) and unpinned entries go to the fetch path.
**Why it matters:** `materializePluginClone`'s warm short-circuit returns silently, so the orchestrator cannot tell after-the-fact whether it fetched. The presence probe is the pre-decision. NOTE the asymmetry — for an UNPINNED source, "fetch always refreshes" (D-81-05): even an unpinned-warm mirror is fetched (the refresh IS the consented fetch); the no-op set is exactly {pinned-warm, path}.
**Example:**
```typescript
// Source: git-source-probe.ts::makePresenceProbe (verified). Pinned warm => materialized; unpinned handled by fetch path.
const presence = await makePresenceProbe(locations)(parsedSource);
const isNoOp =
  parsedSource.kind === "path" ||
  (parsedSource.sha !== undefined && presence.kind === "materialized"); // pinned-warm only
```

### Pattern 3: Command-local messaging vocabulary (`fetch.messaging.ts`)

**What:** Mirror `update.messaging.ts`: declare `FETCH_STATUSES` (fetch's private status set), a `FetchMsg` union (the subset of central plugin message shapes fetch emits — `PluginAvailableMessage | PluginPartiallyAvailableMessage | PluginUnavailableMessage | PluginRemoteMessage | PluginSkippedMessage | PluginFailedMessage`), and a total render map `{ [K in FetchStatus]: RenderFn<...> }` whose arm bodies call the SHARED `notify.ts` row helpers verbatim. `FETCH_CONTEXT = { Messaging: { label: "Plugin fetch" }, render } as const satisfies CommandContext<...>`.
**Why:** D-10 open/closed discipline — a missing arm is a compile error; the shared presentation vocabulary is CALLED, never duplicated. No new icons/tokens.

### Pattern 4: Failure-tolerant sweep (FTCH-07)

**What:** Each per-plugin fetch runs inside try/catch that captures the throw into a `partition: "failed"` outcome (mirror `update.ts::updateSinglePlugin`'s NEVER-throws cascade contract) instead of aborting. Aggregate outcomes into per-(scope, marketplace) `MpUpdated`-style blocks; the cascade renderer stamps severity (error if any failure) and the summary line. A single-target `<plugin>@<mp>` fetch is `cardinality: "single"` (no tally); `@<mp>` and bare are `plural` (tally).
**Reason narrowing on failure:** reuse update's `network unreachable` / `authentication required` mapping (`reasonsFromTypedError` / `classifyGitProbeFailure` in update.ts) — all members already in REASONS.

### Architecture-gate placement decision (Claude's Discretion — RECOMMENDATION)

**Recommend the install-style model. Add `orchestrators/plugin/fetch.ts` TO `FORBIDDEN_TARGETS`** in `tests/architecture/no-orchestrator-network.test.ts`.

Rationale:
- The gate's two models are: (a) update-style = OMIT the file from FORBIDDEN_TARGETS and import gitOps directly (the Pattern S-9 exemption, one exempt file); (b) install-style = INCLUDE the file, name zero git surface, delegate to `clone-cache.ts` by entrypoint. `[VERIFIED: no-orchestrator-network.test.ts read]`
- **`info.ts` is already a FORBIDDEN_TARGET** (INFO-02 / NFR-5). `info --fetch` lives in `info.ts` and MUST trigger a fetch. Therefore the fetch surface `info.ts` calls cannot name gitOps — it must be a gitOps-free entrypoint (the `clone-cache.ts` seam via a shared fetch-one helper). If `fetch.ts` used the update-style exemption, `info.ts` still could not import it if it named gitOps; the cleanest single design is: `fetch.ts` is itself gitOps-free (install-style), and both `fetch.ts` and `info.ts` reach the seam by name. `[VERIFIED: FORBIDDEN_TARGETS includes info.ts]`
- **Smaller exemption surface:** update-style would ADD a second permanently-exempt orchestrator (fetch) to the "gitOps-allowed" list, widening the network surface the gate blesses. Install-style keeps the exempt set at exactly one (`update.ts`, which genuinely needs inline `syncCloneOnce`), and `fetch.ts` joins the guarded set — the gate stays honest. This directly satisfies the CONTEXT phrasing "smaller exemption surface."

### Anti-Patterns to Avoid

- **Naming `gitOps` in `fetch.ts` or `info.ts`.** The gate greps `\bgitOps\b` on comment-stripped source; even a type-only `platform/git` import trips it. Use the `auth-host.ts` re-exports (`DEFAULT_CREDENTIAL_OPS`, auth TYPES) and the `clone-cache.ts` entrypoints. `[VERIFIED: gate patterns]`
- **Enumerating installed state for fetch bulk.** Would silently drop every `(remote)` plugin (they have no state record). Read the manifest.
- **Growing any closed set.** STATUS_TOKENS, REASONS, PLUGIN_STATUSES, ICON constants already carry every member. Adding a `fetched` token would violate D-81-02 and trip the completeness proofs + catalog-UAT.
- **Persisting fetch state.** Derive-not-persist house invariant. `plugin-clones/` contents ARE the state.
- **A second `softDepStatus(pi)` probe.** `notify()` owns the single probe per call (per list.ts / notify-context.ts); the orchestrator passes `pi` through, does not probe.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Git clone / mirror refresh | A `simpleGit`/`gitOps` call in fetch.ts | `materializePluginClone` / `materializeOrRefreshPluginMirror` | NFR-5 gate; staging + atomic rename + append-leak cleanup + concurrent-race handling already correct. |
| Host auth / device flow | A `github.com` + token flow | `buildAuthForHost` + `authMemo` | PROV-02/03/04 semantics + cross-host leak guard + once-per-host memo already audited. |
| Post-fetch status classification | A fresh three-way resolve | `probeManifestEntry` / `availableRowMessage` | Phase 80's fs-only classifier is the single source `list`/`info`/completion all share — parity is mandatory (drift-guard tests). |
| Bulk cascade rendering | New header/row/summary code | `notifyWithContext` + `FETCH_CONTEXT` render map | Central grammar; catalog-UAT byte-locks it. |
| No-op headline (all-warm sweep) | Ad-hoc "nothing to fetch" string | An `emitUpdateNoOpCascade`-style constant analog | `update` already solved the never-silent no-op headline (`Plugin update: nothing to update`); fetch mirrors it. |
| GC of fetched-uninstalled clones | A refcount/registry | `garbageCollectPluginClones` (unchanged) | Live-key derivation from records already excludes uninstalled clones. |
| Marketplace manifest read | A JSON read | `loadMarketplaceManifest` | Schema validation + error contracts already centralized (edge-deps.ts uses it). |

**Key insight:** Every hard problem in this phase (atomic git materialize, auth, classification, grammar, GC) is already solved by a shipped seam. The phase's real work is the NEW enumeration/orchestration glue and the completion/docs/test lockstep — not any new primitive.

## Runtime State Inventory

Not a rename/refactor/migration phase — this is greenfield verb addition. Section omitted per the greenfield rule, with one crossover note relevant to FTCH-05:

- **Stored data / build artifacts:** Fetch writes clone/mirror trees under `<scope>/pi-claude-marketplace/plugin-clones/<key>/` (existing seam paths). These are derive-not-persist: no index, no registry, no migration stamp. GC (`garbageCollectPluginClones`) already treats a fetched-uninstalled clone as unreferenced (no `resolvedSha` record points at it) and sweeps it. **Action required: a regression TEST only** (fetch a plugin, don't install, run GC, assert the clone dir is gone and the next `probeManifestEntry` returns `remote`). No data migration, no code change to GC. `[VERIFIED: clone-gc.ts::deriveLiveCloneKeys]`

## Common Pitfalls

### Pitfall: Completion cannot distinguish unpinned-warm from pinned-warm
**What goes wrong:** D-81-03 says `fetch <tab>` offers `(remote)` + unpinned-warm plugins but NOT pinned-warm. The completion-cache `PluginIndexRow.status` set is `{installed…, available, partially-available, unavailable, remote}` — a WARM unpinned mirror and a WARM pinned clone BOTH classify to `available`/`partially-available`/`unavailable` (via the three-way resolver). The status alone cannot separate them.
**Why it happens:** `probeManifestEntry` returns `remote` only for a COLD clone/mirror; once warm, both pinned and unpinned collapse to the resolved verdict. Pinnedness lives in the manifest `source.sha`, which the cache row does not carry.
**How to avoid (planner decision — see Open Questions):** Either (a) the fetch completion filter offers `{remote, available, partially-available, unavailable}` and accepts that a pinned-warm plugin is offered-but-no-ops if typed (CONTEXT explicitly allows "still accepted if typed, rendering the no-op row"), OR (b) add pinnedness to the enumeration by re-reading the manifest in the completion rebuild (heavier). Recommendation: (a) — it matches "pinned-warm still accepted if typed" and avoids a cache-schema change; the only cost is offering a few plugins that no-op. Document explicitly.
**Warning signs:** a completion test asserting a pinned-warm plugin is EXCLUDED would force option (b).

### Pitfall: Fetch-one re-derives the row from a STALE probe
**What goes wrong:** If the post-fetch row is derived from the presence probe captured BEFORE materialize, an unpinned refresh (which moves HEAD) renders the pre-refresh classification.
**How to avoid:** After the git seam returns, run `availableRowMessage` / `probeManifestEntry` FRESH against the now-warm tree. The classifier is fs-only and cheap; re-run it. (list.ts already re-runs `resolveStrict` on the warm tree — same discipline.)

### Pitfall: `authMemo` scoped per-plugin instead of per-sweep
**What goes wrong:** Creating a new `authMemo` inside the per-plugin loop defeats the once-per-host contract (FTCH-06 / D-79-02) — a bulk sweep of 10 private-host plugins triggers 10 device flows.
**How to avoid:** Create `const authMemo = new Map<string, AuthAttemptResult>()` ONCE at the top of the sweep and thread it into every `buildProbeAuth` call, exactly as `update.ts` threads `opts.authMemo` through its batch loop. `[VERIFIED: update.ts:387, auth-host.ts memo]`

### Pitfall: info --fetch failing the whole command
**What goes wrong:** A network throw during the fetch bubbles out of `getPluginInfo` and fails `info` (violates D-81-04).
**How to avoid:** Wrap the fetch hook in try/catch inside `getPluginInfo`; on failure, fall through to the EXISTING `componentsResolved: false` arm with an existing reason (`network unreachable` / `authentication required`). info.ts already builds `components: not resolved` for external sources — the fetch-failure path reuses that arm.

### Pitfall: NUL byte in info.ts breaks plain grep during implementation
**What goes wrong:** `info.ts` (~line 332) contains a pre-existing NUL byte; plain `grep` treats the file as binary and returns nothing.
**How to avoid:** Use `grep -a` / `rg --text` when searching info.ts. (Do not "fix" the NUL byte as part of this phase — it is pre-existing and out of scope per surgical-change discipline.)

## Code Examples

### Verb registration touch-points (follow `update` exactly)
```typescript
// Source: edge/router.ts (verified). Add "fetch" in FOUR places:
// 1. SubcommandHandlers interface:  fetch: (args, ctx) => Promise<void>;
// 2. TOP_LEVEL_SUBCOMMANDS tuple:   add "fetch"
// 3. TOP_LEVEL_USAGE string:        add "  fetch [<plugin>@<marketplace> | @<marketplace>] [--scope user|project]"
// 4. routeClaudePlugin switch:      case "fetch": return handlers.fetch(rest, ctx);
// Then edge/register.ts handlers record: fetch: makeFetchHandler(pi),
```

### Bulk enumeration (mirror edge-deps, NOT update)
```typescript
// Source: orchestrators/edge-deps.ts::loadManifestForMarketplace (verified) — the manifest+probe pattern.
const parsed = await loadMarketplaceManifest(mp.manifestPath);
for (const entry of parsed.plugins) {
  const status = await probeManifestEntry(entry, mp.marketplaceRoot, locations); // fs-only
  // fetchable = status === "remote"  OR  (git source && source.sha === undefined /* unpinned */)
  // pinned-warm (status !== "remote" && sha set) and non-git → skip / no-op row
}
```

### info --fetch flag parse (info.ts currently rejects ALL flags)
```typescript
// Source: edge/handlers/plugin/info.ts (verified) — today it emits `Unknown flag` for any --flag.
// Change: recognize the single boolean `--fetch`, keep rejecting others.
// Pattern: mirror parsePositionalsWithFlags' allow-list arm (edge/handlers/plugin/shared.ts:50).
//   for (token of parsed.positional) { if (token === "--fetch") fetch = true; else if (startsWith("--")) reject; else positional.push }
// Thread `...(fetch && { fetch: true })` into getPluginInfo({...}). Add `fetch?: boolean` to GetPluginInfoOptions.
```

### fetch.messaging.ts skeleton (mirror update.messaging.ts)
```typescript
// Source shape: orchestrators/plugin/update.messaging.ts (verified).
export const FETCH_STATUSES = ["available","partially-available","unavailable","remote","skipped","failed"] as const;
export type FetchStatus = (typeof FETCH_STATUSES)[number];
export type FetchMsg =
  | PluginAvailableMessage | PluginPartiallyAvailableMessage | PluginUnavailableMessage
  | PluginRemoteMessage | PluginSkippedMessage | PluginFailedMessage;
const FETCH_RENDER: { [K in FetchStatus]: RenderFn<Extract<FetchMsg, { status: K }>> } = { /* call shared row helpers */ };
export const FETCH_CONTEXT = { Messaging: { label: "Plugin fetch" }, render: FETCH_RENDER } as const
  satisfies CommandContext<FetchStatus, FetchMsg>;
```

## State of the Art

Not applicable — no external ecosystem churn. The relevant "state of the art" is the internal milestone lineage:

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Unpinned sources = per-sha prefix scan | Single mutable mirror per canonical URL (`plugin-clones/<urlhash12>/`) | Phase 79.1 (MIRR-01..06) | Fetch of an unpinned source = one mirror refresh; no ambiguity by construction. |
| Not-installed git plugin over-claims `(available)` | `(remote)` for cold clones; three-way resolve for warm | Phase 80 (RSTA-01..07) | Fetch's post-fetch row IS the Phase 80 warm classification; the `remote` token + `◌` glyph already shipped. |

**Deprecated/outdated:** none relevant.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `up-to-date` is the intended `(skipped)` no-op reason for a warm-cache fetch | User Constraints D-81-02 | LOW — CONTEXT names it "the natural member" and leaves final pick to the planner within existing REASONS; nothing breaks if planner selects differently. |
| A2 | The completion filter should adopt option (a) — offer warm plugins and let pinned-warm no-op-if-typed | Pitfalls / Open Questions | MEDIUM — if the operator wants strict exclusion of pinned-warm from completion, a cache-schema field (pinnedness) is needed; that is a larger change. Confirm at plan/discuss. |
| A3 | `info --fetch` reuses `getPluginInfo`'s existing `components: not resolved` arm for the degrade, rather than a new arm | FTCH-03 support | LOW — info.ts already emits that arm for external sources; verified by read. |

*All git-seam, auth, classifier, grammar, and GC claims are `[VERIFIED: codebase read]` this session — not assumed.*

## Open Questions

1. **Completion: exclude pinned-warm, or offer-and-no-op?**
   - What we know: the fetchable SET (D-81-01) is `remote` + unpinned-warm; the completion cache row `status` does not encode pinnedness (warm pinned and warm unpinned both read `available`/`partially-available`/`unavailable`).
   - What's unclear: whether `fetch <tab>` must strictly EXCLUDE pinned-warm (requires enumeration-time manifest re-read / cache field) or may offer warm plugins and rely on "pinned-warm still accepted if typed → no-op row" (CONTEXT allows this).
   - Recommendation: option (a) offer `{remote, available, partially-available, unavailable}` and no-op-if-typed for pinned-warm; document it. Escalate to the planner (and to discuss if the operator wants strict exclusion).

2. **`fetch` USAGE two-shape vs three-shape wording.**
   - What we know: `update`'s USAGE reads `[<plugin>@<marketplace> | @<marketplace>]` (bare is the no-arg case).
   - What's unclear: exact fetch USAGE prose (bare `fetch` = all marketplaces).
   - Recommendation: `fetch [<plugin>@<marketplace> | @<marketplace>] [--scope user|project]` (bare = no positional), byte-parallel to update. Planner locks the string (it is PRD-stable and catalog-UAT-adjacent).

## Environment Availability

Not applicable in the external-tool sense — the phase adds internal code only. Git IS required at RUNTIME for the fetch operation, but it is reached exclusively through the existing `clone-cache.ts` → `platform/git` seam that install/update already depend on; no new external dependency and no availability probe needed. Tests inject `makeMockGitOps` / `makeMockCredentialOps` / `makeMockDeviceFlowHttp` (all present under `tests/helpers/`), so the test suite is network-free. `[VERIFIED: tests/helpers/*.ts]`

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | `node:test` (built-in), TypeScript via native strip |
| Config file | none — `package.json` scripts drive it |
| Quick run command | `node --test "tests/orchestrators/plugin/fetch.test.ts"` (single new file) |
| Full suite command | `npm run check` (typecheck + lint + format:check + test + test:integration) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| FTCH-01 | single `fetch <pl>@<mp>` materializes clone, no install, renders post-fetch row | unit | `node --test tests/orchestrators/plugin/fetch.test.ts` | ❌ Wave 0 |
| FTCH-02 | path source + pinned-warm → `(skipped){up-to-date}` info, zero gitOps calls | unit | same | ❌ Wave 0 |
| FTCH-03 | `info --fetch` resolves warm; fetch failure → `not resolved`+reason, info still succeeds | unit | `node --test tests/orchestrators/plugin/info.test.ts` (extend) + `tests/edge/handlers/plugin/fetch.test.ts` | ❌ Wave 0 |
| FTCH-04 | pinned-warm short-circuits offline; path source zero network | unit | `node --test tests/orchestrators/plugin/fetch.test.ts` | ❌ Wave 0 |
| FTCH-05 | fetch-not-install then GC sweeps clone; next probe → `remote` | unit | `node --test tests/orchestrators/plugin/clone-gc.test.ts` (extend) | ⚠️ extend |
| FTCH-06 | bulk private-host sweep triggers device flow ONCE (authMemo spans sweep) | unit | `node --test tests/orchestrators/plugin/fetch.test.ts` | ❌ Wave 0 |
| FTCH-07 | `@<mp>` + bare enumerate fetchable set; one failure doesn't abort; bulk grammar parity | unit | `node --test tests/orchestrators/plugin/fetch.test.ts` | ❌ Wave 0 |
| (grammar) | catalog byte-equality for fetch rows | architecture | `node --test tests/architecture/catalog-uat.test.ts` | ⚠️ extend |
| (gate) | fetch.ts has zero gitOps surface | architecture | `node --test tests/architecture/no-orchestrator-network.test.ts` | ⚠️ extend |
| (completion) | `fetch <tab>` / `fetch @<tab>` buckets | unit | `node --test "tests/edge/completions/*.test.ts"` | ⚠️ extend |

### Sampling Rate
- **Per task commit:** `node --test "tests/orchestrators/plugin/fetch.test.ts"` (+ the specific edited test file).
- **Per wave merge:** `npm test` (full unit suite).
- **Phase gate:** `npm run check` green before `/gsd-verify-work`.

### Wave 0 Gaps
- [ ] `tests/orchestrators/plugin/fetch.test.ts` — covers FTCH-01/02/04/06/07 (mirror update.test.ts bulk patterns; import `makeMockGitOps`, `fixtureMarketplaceDir`, `makeMockCredentialOps`, `makeMockDeviceFlowHttp`).
- [ ] `tests/edge/handlers/plugin/fetch.test.ts` — 3-shape positional parse + `info --fetch` flag.
- [ ] Extend `tests/architecture/no-orchestrator-network.test.ts` — add `fetch.ts` to FORBIDDEN_TARGETS.
- [ ] Extend `tests/architecture/catalog-uat.test.ts` FIXTURES — one entry per `(fetch section, catalog-state)` tuple.
- [ ] Extend `tests/orchestrators/plugin/clone-gc.test.ts` — FTCH-05 fetched-uninstalled sweep regression.
- [ ] Extend `tests/edge/completions/*.test.ts` — fetch completion buckets.
- [ ] Framework install: none — `node:test` already in use.

## Security Domain

`security_enforcement` is not set in `.planning/config.json` (absent = enabled). This phase adds no new external attack surface: it introduces network traffic ONLY through the existing, audited `clone-cache.ts` + `auth-host.ts` seams at strict install parity.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes (git host auth) | `buildAuthForHost` device-flow, host-keyed; PROV-02/03/04. No new auth code. |
| V3 Session Management | no | — |
| V4 Access Control | yes (path containment) | `assertPathInside` / SC-7 chokepoint inside the clone seam (unchanged); NFR-10 containment to `plugin-clones/`. |
| V5 Input Validation | yes | Manifest read via `loadMarketplaceManifest` (typebox schema); `<plugin>@<marketplace>` ref via `splitPluginMarketplaceRef`. |
| V6 Cryptography | no | — (SHA is content-addressing, not a security control). |

### Known Threat Patterns for the fetch surface

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Credential leak into notify/error text on a failed fetch | Information disclosure | `auth-host.ts` never interpolates credentials (AUTH-09); enforced by `no-credential-leak.test.ts` — fetch's failure narrowing must route through the same reason mapping, never raw error interpolation of the auth bundle. |
| Cross-host credential reuse in a bulk sweep | Elevation / Info disclosure | `buildAuthForHost` returns `undefined` for no-provider hosts (T-79-04 guard); `authMemo` is host-keyed, so a per-host bundle cannot leak to another host even within one sweep. |
| Path escape via git-subdir during materialize | Tampering | `resolveGitSubdirRoot` clone-root-anchored containment (unchanged seam). |
| Malicious manifest triggering unexpected network | Tampering | Fetch touches network only on cache miss for git sources the user explicitly targeted; path/npm/unknown never fetch. |

## Sources

### Primary (HIGH confidence — codebase read this session)
- `extensions/pi-claude-marketplace/orchestrators/plugin/clone-cache.ts` — `materializePluginClone` (pinned warm short-circuit), `materializeOrRefreshPluginMirror` (refresh-on-warm), `resolvePluginPin`, `canonicalCloneUrl`.
- `orchestrators/plugin/install.ts` (505-623, 752-767) — `makeInstallCloneProbe`, `buildProbeAuth`, `InstallCloneCacheSeam`, `authMemo` threading — the install-style template.
- `orchestrators/plugin/update.ts` (120-442, 2663-2793, messaging) — bulk cascade, `enumerateTargets`, `updateSinglePlugin` NEVER-throws, tally/no-op, gitOps-exempt (Pattern S-9).
- `orchestrators/plugin/update.messaging.ts` — command-local `CommandContext` vocabulary pattern.
- `orchestrators/plugin/git-source-probe.ts` — `probeManifestEntry`, `makePresenceProbe`, `readMirrorHeadSha`.
- `orchestrators/plugin/list.ts` (547-676) — `availableRowMessage` post-fetch row derivation.
- `orchestrators/auth-host.ts` — `buildAuthForHost` + once-per-host memo, gate-clean re-exports.
- `orchestrators/plugin/clone-gc.ts` — `garbageCollectPluginClones` / `deriveLiveCloneKeys` (FTCH-05).
- `orchestrators/edge-deps.ts` — `loadManifestForMarketplace` manifest-enumeration + classification pattern.
- `edge/router.ts`, `edge/register.ts`, `edge/handlers/plugin/{update,info}.ts`, `edge/handlers/plugin/shared.ts`, `edge/args.ts` — verb registration + flag parse.
- `edge/completions/{provider,data}.ts`, `shared/completion-cache.ts` (schemaVersion 6, `PluginIndexRow.status`) — completion buckets + status set.
- `shared/notify.ts` (89-256 closed sets, 700-830 row message shapes, 984-1144 cascade shapes, 1475-1522 icons), `shared/notify-context.ts` — grammar + dispatch.
- `tests/architecture/no-orchestrator-network.test.ts` (FORBIDDEN_TARGETS), `tests/architecture/catalog-uat.test.ts` (fixture keying), `tests/orchestrators/plugin/update.test.ts` (bulk test patterns), `tests/helpers/{git,credential,device-flow}-mock.ts`.
- `docs/output-catalog.md` (update H2 section 790-861, remote rows 345-368), `docs/messaging-style-guide.md` (structure).

### Secondary (MEDIUM confidence)
- `.planning/workstreams/url-source/REQUIREMENTS.md`, `81-CONTEXT.md`, `STATE.md` — requirement + decision provenance.

### Tertiary (LOW confidence)
- none — no WebSearch was needed; the phase is entirely internal.

## Metadata

**Confidence breakdown:**
- Standard stack (internal seams): HIGH — every seam read and quoted this session.
- Architecture (gate placement, enumeration model, grammar): HIGH — grounded in the gate test + install/update/list source.
- Pitfalls: HIGH for the git/auth/classifier/GC pitfalls (verified); MEDIUM for the completion pinned-warm gap (a real design fork the planner must resolve).

**Research date:** 2026-07-14
**Valid until:** 2026-08-13 (30 days — stable internal codebase; only risk is concurrent edits to the same seams by another workstream).
