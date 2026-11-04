# Phase 3: Read-Time Verdicts - Research

**Researched:** 2026-11-04
**Domain:** in-repo TypeScript refactor of the plugin resolver, record read, soft-dependency markers, and `--partial` consent (no new packages)
**Confidence:** HIGH for the code map and the cycle constraints (measured with `fallow trace`); MEDIUM for the recommended API shapes (judgment, logged under Dubious Choices)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

### A. Neutral records and the effective read (MREC-03)

- **D-P3-01:** **Neutral verdict = the `none` view.** The stored compatibility is the
  verdict that holds under every implementation: a server counts as blocked
  only when both profiles block it (`ws`, host-only types, a leading `~`,
  `headersHelper`, truthy `oauth.xaa`), and a `.mcpb`/`.dxt` bundle blocks.
  `sse` (built-in only) and `bareElicitationCapability` (adapter only) never
  enter the stored verdict. `installable` and `unsupported` are computed from
  that view plus the non-MCP kinds. (P3-DC-01)
- **D-P3-02:** **Every writer of a new or replaced compatibility writes the neutral verdict
  and sets `compatibilityBasis: "neutral"`**: install (`statePhase` writes the
  basis on the new record), the update swap's final write, the update intent
  mark, the disabled pin refresh (`refreshDisabledRecord`), and the AMIG-01
  dropped-server write. A replacing writer calls `replaceCompatibility`
  first (it clears the basis), then sets the basis. Phase 1 owns the record
  write itself (`statePhase`, the update-swap record write); Phase 3 changes
  only what verdict they write and the basis, in the narrowest diff, and logs
  the edit to a Phase 1-owned function as a dubious choice if it must touch
  it. A legacy record (no basis) keeps the adapter reading, as P1-DC-02
  froze. (P3-DC-02)
- **D-P3-03:** **The resolver computes per-implementation verdicts.** Phase 3 owns
  `domain/{mcp-resolution,plugin-resolver,resolver-types}.ts` state and
  verdicts. The resolver classifies each merged server under both profiles
  once, and exposes the resolution's `state`, `unsupported`, and
  `droppedMcpServers` for an implementation the caller names (`adapter`,
  `builtin`, or `none`), plus the neutral view that `statePhase` stores.
  `declaredMcpServers`, `mcpBundle`, and the entry points
  `recorded-servers.ts` calls stay as Phase 1 left them, and `mcpServers`
  stays the adapter-supported subset the mcp phase stages under every
  implementation (frozen interface 4, MSEL-04). The planner picks the shape
  (an option argument, or both views on the result); every caller passes the
  run's active implementation explicitly, never a default, so no surface
  silently keeps the adapter table. (P3-DC-03)
- **D-P3-04:** **One effective-read helper.** A new orchestrator module (Phase 3 prefix,
  for example `orchestrators/plugin/mcp-verdict-read.ts`) joins a record with
  `recordedMcpServers(record, createLegacyServersReader(source))` and
  `effectiveMcpCompatibility(record, recorded, active)`. It is offline (the
  legacy reader re-resolves read-only from the cached clone) and is the only
  way a surface reads a record's MCP verdict. `list`, `info`, completions
  (`edge-deps.ts`), `pending`, `apply`'s convergence, the update preflight,
  and the promotion and re-enable gates read through it. When the read is
  `unreadable`, the stored verdict stands (frozen rule 1). (P3-DC-04)
- **D-P3-05:** `classifyInstalledRecord` and `derivePersistedInstalledStatus` take the
  effective `unsupported` instead of `record.compatibility.unsupported`, so
  one installed `sse` plugin is `installed` under the adapter and
  `partially-installed` under built-in with no reinstall.

### B. Markers, `requires:`, and severity (MREC-05, MREC-07)

- **D-P3-06:** **Which marker.** For a plugin's MCP servers, let R be the servers at least
  one profile runs (non-malformed and not blocked by both), and I the
  implementations that run every server in R:
  - R empty (no MCP server, or every server blocked by both): no MCP
    `requires` marker and no MCP `requires:` entry; a blocked server still
    shows `{unsupported mcp}` only.
  - I = {adapter, builtin}: `requires mcp`; I = {adapter}:
    `requires pi-mcp-adapter`; I = {builtin}: `requires builtin mcp`.
  - I empty (servers split: one only the adapter runs, one only built-in
    runs): with no active implementation, `requires mcp`; with an active one,
    the other implementation's name. (P3-DC-05)
- **D-P3-07:** **When it shows.** With no active implementation and R not empty, every
  plugin row with markers shows the marker (installed rows stay `installed`,
  D-MB-01). With an active implementation in I, no marker. With an active
  implementation not in I, the marker sits beside `{unsupported mcp}` after
  the content reasons: `{unsupported mcp, requires pi-mcp-adapter}` for `sse`
  under built-in, `{unsupported mcp, requires builtin mcp}` for a server with
  a bare elicitation capability under the adapter. At most one MCP marker per
  row, in the MCP slot of the soft-dependency order (agents, mcp, workflows).
  This includes `partially-installed` list rows, which today carry no
  dependencies. (D-MB-07, P3-DC-06)
- **D-P3-08:** **`info`'s `requires:` line** names the marker of I with `(missing)` when
  the active implementation is not in I (or none is active), and without it
  when the active implementation runs every server. So a stdio plugin reads
  `requires: mcp` under the adapter and under built-in, and
  `requires: mcp (missing)` with none; JSON
  `{"companion":"mcp","missing":false}`. Today's adapter output
  `{"companion":"pi-mcp-adapter","missing":false}` changes. (P3-DC-07)
- **D-P3-09:** **Severity.** `companionSeverity` raises warning exactly when an MCP marker
  shows, which is today's `requires pi-mcp-adapter` rule (D-MB-07); reconcile
  rows keep applying no companion severity. Phase 3 edits only the MCP arm of
  `shared/concerns/soft-dep.ts` and of `companionSeverity`, and the MCP
  wording in `notify-reasons.ts`; the closed sets already hold every token.
- **D-P3-10:** **Inputs.** The `Dependency` passed to the markers carries the two
  per-profile verdict lists (or R and I) instead of today's bare
  `declaresMcp`; each emit site (the ~30 sites the survey found: install,
  cascade, update, reinstall, enable, import, apply, dependency moves, list,
  install-flow-results) gets it from its resolution or from the effective
  read. Hard-coded `false` sites stay `false`. (P3-DC-08)

### C. `--partial` consent (MREC-05, MREC-06)

- **D-P3-11:** **User-run install and update ask against the active implementation**:
  the preflight gate uses the resolution's view for
  `run.softDeps.mcpImplementation`. With no active implementation, the view
  is `none`, so only servers both profiles block (and non-MCP drops) need
  `--partial` (D-MB-05); an `sse` plugin installs without consent and shows
  `{requires pi-mcp-adapter}`. (P3-DC-09)
- **D-P3-12:** **A user-run update asks only for a new degrade**: the candidate's view is
  compared with the installed record's effective view under the same active
  implementation; the classifier's `partially-upgradable` split reads the
  effective record. A record that is already partial because of a switch is
  `partially-installed`(-upgradable), which keeps today's rules.
- **D-P3-13:** **Enable, apply, reinstall, import, autoupdate, promotion, and cascades
  never ask because of a switch**: their gates read the neutral stored
  `installable` (or pass `partial: true`, as reinstall and autoupdate do
  today), which no implementation changes. Apply's convergence move needs
  consent only when the candidate drops something the installed record,
  read under the active implementation, does not drop; a switch alone never
  holds a move. (P3-DC-10)

### D. Load, pending, apply, and AMIG-01 after a switch

- **D-P3-14:** **No load warning row for a switch.** A switch changes no record, and
  APL-D1 keeps the load to `pending`'s block; `list` and `info` show the new
  state. (P3-DC-11)
- **D-P3-15:** **`pending` and `apply` show nothing for a state that changed only because
  the implementation changed** (there is nothing to apply). Their forced-
  install preview (`(will partially install)`) and their rows read the active
  implementation like every other surface.
- **D-P3-16:** **AMIG-01 stays explicit about the adapter**: it moves legacy `mcp.json`
  entries into `mcp-adapter.json`, an adapter file, under every
  implementation (MSEL-04), so its staging uses the adapter view by name and
  its notice keeps "pi-mcp-adapter cannot run it". Its dropped-server record
  write writes the neutral verdict with the basis, so a migration never puts
  an adapter verdict back into a neutral record. (P3-DC-12)

### E. Behavioral tests and red proof

- **D-P3-17:** `features/mcp-server/verdict-markers.feature`: each tag pair whose twins
  now agree (a stdio server runs under both, so no marker) folds into one
  `@mcp` scenario; new pairs pin the implementation-specific rows: an `sse`
  plugin (`installed` under the adapter, `partially-installed` with
  `{unsupported mcp, requires pi-mcp-adapter}` under built-in, with no
  reinstall between, MREC-03/07), a bare-elicitation server
  (`{unsupported mcp, requires builtin mcp}` under the adapter), `info`'s
  per-server verdict lines (MREC-04), and a `ws` server (`{unsupported mcp}`
  only under both). New Phase 3 files may be named
  `features/mcp-server/verdict-*.feature` with `mcp-server/verdict-*` steps
  and `features/lib/mcp-verdict-*.ts` helpers. (P3-DC-13)
- **D-P3-18:** **No active implementation** is reached with the frozen steps
  (`the user's pi settings turn off pi's built-in mcp`,
  `the user restarts pi with no mcp`), in `@own-implementation` scenarios:
  `{requires mcp}`, `{requires pi-mcp-adapter}` (sse), and
  `{requires builtin mcp}` rows, `requires: mcp (missing)` in `info`, an
  install with no `--partial`, and Pi's settings file unchanged (MREC-05).
  `companion-missing.feature` is rewritten on this model and loses its
  `@builtin-only` tag; `invalid-configs.feature` loses `@adapter-only` and
  runs `@mcp`.
- **D-P3-19:** **Consent scenarios** (MREC-06): a user-run install and update ask under
  the implementation that blocks; enable and `apply` after a switch do not.
- **D-P3-20:** Each changed behavior records its red proof per profile (the scenario
  fails on the Phase 1 tree under that profile). The e2e marker tests
  (`adapter-detection-rpc`, `install-soft-deps`) and the marker/state
  assertions in `test/integration/mcp-*` follow the new rules; new
  integration cases go in `test/integration/mcp-verdict-*`.

### F. Parent lines and process

- **D-P3-21:** CHANGELOG parent lines: the two new reasons (`requires mcp`,
  `requires builtin mcp`), the state that follows the active implementation,
  and the `requires:` change. `docs/json-output.md` already lists the reasons
  (closed set, Phase 1); any wording change there is a parent line.
- **D-P3-22:** `docs/messaging-style-guide.md` marker text is Phase 3's and is updated.
- **D-P3-23:** Wave 3 merges `origin/features/mcp-builtin` (Phases 5, 4, 2) before the
  phase gate and re-runs every owned row under both profiles.

### Claude's Discretion

- The resolver's API shape for the per-implementation view, the effective
  read module's name and signature, and how the marker inputs travel through
  `Dependency`, as long as every caller passes the active implementation
  explicitly.
- Wave split inside the ROADMAP's suggested structure (tracer: neutral
  record plus effective `list`; then info verdicts, markers, consent in
  parallel; then merge and gate).

### Deferred Ideas (OUT OF SCOPE)

- A load notice that names a plugin whose state changed because of a switch
  (rejected for this phase by APL-D1; could be a v2 idea).
- Removing `requires pi-mcp-adapter` wording variants or any closed-set entry
  that ends up unused: Phase 6.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| MREC-03 | `list`, `info`, `install`, `update`, `pending`, and `apply` compute available / partially available state against the active implementation | Resolver views (Pattern 1), effective record read (Pattern 2), per-surface table, consent split (Pattern 4), writers (Pattern 5) |
| MREC-04 | `info` shows each server's verdict for the active implementation with that implementation's reason tokens | Pattern 6 (info per-server lines from `declaredMcpServers` / recorded servers + view `blocked`) |
| MREC-05 | With no active implementation, MCP plugin stays `installed` with `{requires mcp|pi-mcp-adapter|builtin mcp}`; install needs no `--partial` | Pattern 3 (marker shape and rule), Pattern 4 (`none` view gate), behavioral tests via `@own-implementation` + frozen restart steps |
| MREC-06 | `--partial` asked only on user-run install/update against the active implementation; enable/apply/reinstall/import/cascades never ask because of a switch | Pattern 4 (gate view: active for user-run, `none` for record-driven re-materializations; convergence consent rule) |
| MREC-07 | `{unsupported mcp, requires <other>}` when the active implementation cannot run a server the other can; `requires: <name> (missing)`; neither-runs shows `{unsupported mcp}` only; reasons drafted for CHANGELOG / json-output | Pattern 3, Pattern 6, Parent lines section |
</phase_requirements>

## Summary

Phase 3 is a pure in-repo refactor with no new dependency. Every rule it needs already exists as frozen, unconsumed code: the two classifiers (`profileFor("adapter"|"builtin").classify`), the record reader (`recordedMcpServers` + `createLegacyServersReader`), and the effective read (`effectiveMcpCompatibility`), plus the closed-set tokens (`requires mcp`, `requires builtin mcp`, companions `mcp` and `builtin mcp`). The work is to (1) make the resolver's top-level verdict neutral, (2) derive every per-implementation view from that neutral verdict with the frozen `effectiveMcpCompatibility`, so a fresh resolution and a stored record give byte-identical rows, (3) thread `run.softDeps.mcpImplementation` to every surface, (4) replace the boolean `declaresMcp` / literal `"mcp"` dependency with a structured MCP dependency that carries "which implementations run every server", and (5) split consent into "user-run: active view" and "record-driven: neutral view".

The largest planning risk is not the logic but the module graph. `orchestrators/mcp/recorded-servers.ts` (frozen) imports `orchestrators/plugin/install-outcome.ts`, and `install-outcome.ts` reaches `plugin/shared.ts`, `plugin-state-classifier.ts`, `git-source-probe.ts`, `update-swap.ts`, `update-preflight.ts`, `update-row.ts`, and `update-cascade.ts` (measured with `fallow trace`). Any of those importing the record-read helper closes an import cycle that `npm run fallow` rejects. So the record read must live in a module that only cycle-safe consumers import, and the reachable modules take verdicts as data or through an injected port.

The second risk is scope creep through compile errors: changing `Dependency` and `declaresMcp` touches roughly 30 emit sites, `orchestrators/types.ts`, the catalog fixtures, and many large unit test files (`install-flow-ledger.test.ts` is 19,243 lines). Changing the types on purpose, so the compiler lists every site, is the safest way to honor "every caller passes the active implementation explicitly", but the plans must budget for the test churn and the 100% direct-coverage rule.

**Primary recommendation:** Keep `resolveStrict(entry, ctx)` returning the neutral verdict at the top level, add a pure `resolutionFor(resolved, active)` in `domain/plugin-resolver.ts` that returns a full `ResolvedPlugin` computed by `effectiveMcpCompatibility` over the resolution's own neutral verdict and `declaredMcpServers`, and route every surface through it (resolutions) or through one cycle-safe record-read module (records).

## Project Constraints (from AGENTS.md)

- Read a file before editing; trace callers before modifying a function.
- Never commit to `main`; merge, never rebase; commit per `.agents/skills/committing/SKILL.md`; no `--no-verify`. Commit titles carry no milestone, phase, plan, wave, or task identifier (CHILD-SESSION-BRIEF).
- Upstream parity is the default; a divergence needs a recorded decision ID or a Pi capability gap. Claude Code runs every transport itself, so the per-implementation verdicts are a Pi capability gap (D-MB-07), not an upstream behavior to research.
- TypeScript strict; resolver keeps the discriminated `installable` contract (NFR-7): no consumer may read `pluginRoot` off `unavailable`.
- All disk mutations atomic (NFR-1); recovery through `/claude:plugin apply` then `/reload` (NFR-2); operations idempotent or fail-clean (NFR-3).
- NFR-5: `list`, `info`, `uninstall`, `marketplace remove`, and a load without autoapply touch no network. ESLint BLOCK F denies any `platform/git` import in `orchestrators/` and `domain/` outside `NETWORK_SEAMS`; a new Phase 3 module is gated from its first commit.
- NFR-10 containment; IL-2 single output chokepoint (`shared/notification-dispatch.ts`); no telemetry; English only.
- Quality bar: `npm run check` (typecheck, ESLint `--max-warnings 0`, fallow dead-code + cycles + health + dupes, Prettier, pairing, unit, integration, cucumber both profiles, 100% direct coverage per pair). Two independent cognitive-complexity gates (sonarjs 15, fallow `maxCognitive` 15, `maxCyclomatic` 20); zero `thresholdOverrides`.
- Every user-visible `/claude:plugin` change ships a cucumber scenario that fails without it, under each profile where it applies, red proof recorded per profile.
- Every plan SUMMARY.md has `## Threat Flags`; WINDOWS descriptions are prefixed `[mcp-builtin]`.
- Frozen files (01-FROZEN.md) are never edited; a needed change is a parent line in the last plan's SUMMARY.md. Closed sets are append-only.
- In the shared-by-function files (`install-outcome.ts`, `update-swap.ts`, `shared/concerns/soft-dep.ts`, `shared/notify-reasons.ts`), edit only Phase 3's function or arm.
- Environment: container runs as root; run npm scripts with `npm_config_script_shell=/tmp/claude-0/-home-user-pi-claude-marketplace/6e2a5cdb-dbbb-5644-af8a-1c0a0b42c0fd/scratchpad/nondac-sh NODE_OPTIONS=--max-old-space-size=6144`; Bash calls cap at 10 minutes; warm ESLint with a lone `npm run lint` first; executor worktrees need `npm ci --no-audit --no-fund`; TDD commits test and implementation together and record RED in the SUMMARY.

## Architectural Responsibility Map

The extension has no browser, SSR, or CDN tier. The tiers here are the extension's own layers.

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Per-server classification under each profile | domain (`mcp-implementation.ts`, frozen) | — | Pure; frozen profiles already own it |
| Neutral verdict of a fresh resolution | domain (`mcp-resolution.ts`, `plugin-resolver.ts`) | — | The resolver owns `unsupported`/`state` |
| Per-implementation view of a resolution | domain (`plugin-resolver.ts`) | — | Pure function of the resolution and an `ActiveMcpImplementation`; callers pass the implementation |
| Effective verdict of a stored record | orchestrators (new read module) | orchestrators/mcp (frozen reader) | Needs the record, the marketplace record, and I/O for legacy records |
| Active implementation | platform (`softDepStatus`, frozen) | shared (`NotificationRun.softDeps`) | One probe per run (D-05) |
| Marker / `requires:` / severity rule | shared (`concerns/soft-dep.ts`, `notify-reasons.ts`) | — | Pure given the run snapshot and the MCP dependency data |
| MCP dependency facts per row | orchestrators (each emit site) | domain helper | Built from the resolution or the record read |
| Consent gate | orchestrators (install preflight, update preflight, convergence) | domain gates (`requireInstallable`) | Gates stay type-narrowing; the orchestrator picks the view |
| Record writes (neutral + basis) | orchestrators (statePhase, swap, preflight refresh, migration) | persistence (`replaceCompatibility`, frozen) | Writers own the write; persistence owns the basis-clearing rule |

## Standard Stack

No new library. Everything is in-repo and already installed.

### Core (in-repo, frozen, consumed for the first time)

| Module | Export | Purpose |
|--------|--------|---------|
| `domain/mcp-implementation.ts` | `profileFor`, `effectiveMcpCompatibility`, `ActiveMcpImplementation`, `McpImplementationId`, `RecordedMcpServers`, `StoredMcpCompatibility`, `EffectiveMcpCompatibility` | Classifiers and the effective read |
| `orchestrators/mcp/recorded-servers.ts` | `recordedMcpServers`, `createLegacyServersReader`, `LegacyServersSource`, `LegacyServersReader` | The only reader of `mcpServerConfigs` (frozen interface 3) |
| `persistence/state-io.ts` | `replaceCompatibility`, `mcpServerConfigsOf` | Basis-clearing compatibility write |
| `platform/pi-api.ts` | `SoftDepStatus.mcpImplementation` | Run snapshot's active implementation |

### Verified signatures

- `effectiveMcpCompatibility(stored: StoredMcpCompatibility, recorded: RecordedMcpServers, active: ActiveMcpImplementation): EffectiveMcpCompatibility` returning `{ installable, unsupported, blocked }` [VERIFIED: extensions/pi-claude-marketplace/domain/mcp-implementation.ts:304-321]. Verbatim rule from the doc comment: "A stored compatibility without `compatibilityBasis` carries the adapter's verdict, so under the adapter it stands exactly", and "A bundle, or a neutral stored `mcpServers`, blocks under every implementation and is never lost. The `unsupported` kind list keeps the stored order, with `mcpServers` kept, appended, or removed." [VERIFIED: mcp-implementation.ts:285-303]
- With `active === "none"` "a server is blocked only when both profiles block it, and it reports the adapter profile's feature" [VERIFIED: mcp-implementation.ts:195-212].
- `const PROFILES = { adapter: ADAPTER_PROFILE, builtin: BUILTIN_PROFILE }` and `profileFor(id: McpImplementationId)` [VERIFIED: mcp-implementation.ts:134-142].
- `recordedMcpServers(record, reader)` answers `recorded` when `record.mcpServerConfigs !== undefined`, else calls the reader and answers `re-resolved`, or `unreadable` on any throw [VERIFIED: orchestrators/mcp/recorded-servers.ts:46-67].
- `LegacyServersSource { marketplaceName; marketplace: Pick<…, "manifestPath" | "marketplaceRoot" | "source">; pluginName }` [VERIFIED: recorded-servers.ts:70-78].
- The legacy reader calls `resolveStrict(lookup.entry, recordedRootContext(source, record))` with two arguments and reads `resolved.state === "unavailable"`, `resolved.pluginRoot`, `resolved.declaredMcpServers`, `resolved.mcpBundle`, and passes `resolved` as `installable` to `deriveInstallVersion` [VERIFIED: recorded-servers.ts:149-187]. **Consequence:** `resolveStrict`'s two-argument signature and its top-level discriminant must stay; a required third parameter breaks a frozen file.

**Installation:** none.

## Package Legitimacy Audit

No external package is installed by this phase. Nothing to audit.

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### System Architecture Diagram

```text
 /claude:plugin <verb>  or  resources_discover / tools / browse
          │
          ▼
  NotificationRun.softDeps.mcpImplementation  (one probe per run, D-05)
          │  active ∈ {adapter, builtin, none}
          ├──────────────────────────────────────────────────────────────┐
          ▼                                                              ▼
  FRESH RESOLUTION path                                     STORED RECORD path
  resolveStrict(entry, ctx) ──► neutral verdict             state.json record
     (top level = "none" view: blocked iff both block,        │
      bundle blocks; mcpServers = adapter subset;             ▼
      declaredMcpServers = all non-malformed)          recordedMcpServers(record,
          │                                              createLegacyServersReader(src))
          ▼                                                   │ recorded | re-resolved | unreadable
  resolutionFor(resolved, active) ──┐                         ▼
     = effectiveMcpCompatibility(    │                effectiveMcpCompatibility(record, recorded, active)
        {neutral, basis:"neutral"},  │                         │
        declared servers, active)    │                         │
          │                          │                         │
          ├─► consent gate           │                         ├─► classifyInstalledRecord / info status
          │   (user-run: active;     │                         │   (effective unsupported)
          │    record-driven: none)  │                         │
          ├─► install/update rows ◄──┘                         ├─► list/info/pending/apply rows
          │                                                    │
          └─► statePhase / swap write: NEUTRAL + basis         └─► convergence consent (record vs candidate, both active)
                                   │
          MCP dependency facts ────┴──► shared/concerns/soft-dep.ts (R, I, active)
          (which implementations run every server)        ──► {requires mcp | pi-mcp-adapter | builtin mcp}
                                                          ──► info `requires:` + companionSeverity
```

### Recommended new files (Phase 3 prefix)

```text
extensions/pi-claude-marketplace/
├── domain/plugin-resolver.ts            # + resolutionFor(resolved, active)  (owned)
├── domain/mcp-resolution.ts             # neutral classification in mergeServers/recordMergedServers (owned)
├── orchestrators/plugin/mcp-verdict.ts       # NEW, pure: mcpDependencyOf(servers), no recorded-servers import
└── orchestrators/plugin/mcp-verdict-read.ts  # NEW, I/O: readRecordMcpVerdict(record, source, active)
test/... mirrored pairs for each new module (100% direct coverage)
features/mcp-server/verdict-*.feature, features/step_definitions/mcp-server/verdict-*.steps.ts,
features/lib/mcp-verdict-*.ts
test/integration/mcp-verdict-*.test.ts
```

### Pattern 1: Neutral resolution plus a derived per-implementation view

**What:** The resolver's top-level `state`, `unsupported`, and `droppedMcpServers` become the neutral (`none`) view. A pure function derives any view from it.

**Resolver change (owned files):**

- `mergeServers` (`mcp-resolution.ts:93-109`) today calls `classifyMcpServer` (the adapter classifier) and stores `blockedBy` [VERIFIED: mcp-resolution.ts:93-109, quoted: `const verdict = classifyMcpServer(config);` and `verdict.kind === "blocked" ? { config, blockedBy: verdict.feature } : { config }`]. Keep the adapter verdict for `mcpServers` (MSEL-04) and add the neutral verdict: blocked only when the built-in classifier also blocks, reporting the adapter's feature (the same rule as `blockingFeature(config, "none")`). Malformed is one shared shape check for both classifiers, so `onMalformed` handling is unchanged.
- `recordMergedServers` (`mcp-resolution.ts:346-374`): `mcpServers` = adapter-supported subset (unchanged); `declaredMcpServers` unchanged; push `"mcpServers"` into `unsupported` when a server is neutral-blocked or a bundle exists; `droppedMcpServers` = the neutral-blocked servers. `mcpBundle` unchanged.
- `decideResolution` (`plugin-resolver.ts:792-808`) is untouched; it now decides on the neutral `unsupported`.
- `recorded-servers.ts`'s use (`state === "unavailable"`, `pluginRoot`, `declaredMcpServers`, `mcpBundle`) is view-independent, so the frozen caller keeps working.

**View function (new export in `plugin-resolver.ts`):**

```typescript
// Source: composed from domain/mcp-implementation.ts:304-321 (frozen) and plugin-resolver.ts:792-808
import { effectiveMcpCompatibility, type ActiveMcpImplementation } from "./mcp-implementation.ts";

export function resolutionFor(resolved: ResolvedPlugin, active: ActiveMcpImplementation): ResolvedPlugin {
  if (resolved.state === "unavailable") {
    return resolved; // structural defects do not depend on the implementation
  }

  const effective = effectiveMcpCompatibility(
    {
      compatibility: { installable: resolved.state === "installable", notes: resolved.notes, unsupported: resolved.unsupported },
      compatibilityBasis: "neutral",
    },
    {
      kind: "recorded",
      servers: Object.entries(resolved.declaredMcpServers).map(([name, config]) => ({ name, config })),
      bundle: resolved.mcpBundle === true,
    },
    active,
  );
  const { droppedMcpServers: _neutralDropped, ...rest } = resolved;
  return {
    ...rest,
    state: effective.unsupported.length > 0 ? "partially-available" : "installable",
    unsupported: [...effective.unsupported],
    ...(effective.blocked.length > 0 && { droppedMcpServers: [...effective.blocked] }),
  };
}
```

Why this shape:

- Install rows (fresh resolution) and later `list`/`info` rows (stored neutral record through `effectiveMcpCompatibility`) run the same function on the same inputs, so they agree byte for byte, including the position of the `mcpServers` kind.
- `requireInstallable(view, op)` and `requirePartialInstallable(view, op)` work unchanged on the view, so the NFR-7 narrowing stays intact.
- `resolutionFor(view, "none")` is not needed: callers keep the neutral `resolved` beside the `view`. Do not chain views: a view's `unsupported` is no longer neutral.
- `classifyManifestEntry(resolutionFor(resolved, active))` gives `available`/`partially-available` per implementation for not-installed rows.

**Every caller passes the implementation explicitly.** Top-level neutral is the stored verdict, not an adapter default, but a forgotten call site would silently read `none`. Mitigation: grep each `resolveStrict` / `resolveListCandidate` / `probeManifestEntry` consumer (table below) and name the view at each; give each consumer that today takes `ResolvedPlugin` an explicit `active` parameter so the compiler finds its callers.

### Pattern 2: One record-read module, imported only by cycle-safe consumers

**Measured constraint** (`npx fallow trace --path install-outcome.ts <target>`):

| Target | Reachable from `install-outcome.ts`? | Path (abridged) |
|--------|-----|------|
| `plugin/shared.ts` | yes (value) | `install-outcome.ts:169 -> shared.ts` |
| `plugin/plugin-state-classifier.ts` | yes (value) | `shared.ts:64 -> dependency-index.ts -> dependency-declaration-read.ts -> git-source-probe.ts:33 -> plugin-state-classifier.ts` |
| `plugin/git-source-probe.ts` | yes (value) | as above |
| `plugin/update-swap.ts` | yes (type-only hop) | `install-outcome.ts:164 -> package-install.ts:66 -> update-swap.ts [type-only]` |
| `plugin/update-preflight.ts` | yes (type-only hops) | `... update-swap.ts:147 -> update-preflight.ts [type-only]` |
| `plugin/update-row.ts`, `update-cascade.ts` | yes (type-only then value) | `update-swap.ts:145 -> update-cascade.ts [type-only] -> update-row.ts` |
| `list-installed-row.ts`, `list-flow.ts`, `info.ts`, `edge-deps.ts`, `reconcile/{convergence,notify,pending,read-pass,apply,mcp-migration}.ts`, `import/execute.ts`, `enable-disable.ts`, `install-cascade.ts`, `install-cascade.messaging.ts`, `install-flow-results.ts`, `install-flow-ledger.ts`, `dependency-move.ts`, `reinstall.messaging.ts`, `materialize-latest.ts`, `update-flow.ts`, `operations.ts`, `reinstall-flow.ts`, `marketplace/update.ts`, `list-candidate-version.ts` | no | — |

[VERIFIED: fallow 3.35.0 `trace --path` run this session]

`recorded-servers.ts` imports `install-outcome.ts` (`deriveInstallVersion`) [VERIFIED: recorded-servers.ts:22]. So any module that `install-outcome.ts` reaches and that imports the record-read module closes a cycle: `X -> mcp-verdict-read -> recorded-servers -> install-outcome ->* X`. Whether fallow counts type-only hops in its cycle check was not measured; treat them as cycle-forming [ASSUMED].

**Rule for the plans:**

- `orchestrators/plugin/mcp-verdict-read.ts` (I/O): `readRecordMcpVerdict(record, source: LegacyServersSource, active)` returns `{ effective: EffectiveMcpCompatibility; mcp: McpDependency | undefined }`. Only the "no" rows above import it.
- `orchestrators/plugin/mcp-verdict.ts` (pure, no `recorded-servers` import): `mcpDependencyOf(servers)` and any shared projection. Any module may import it.
- `plugin-state-classifier.ts` stays pure: it takes the effective `unsupported` and the candidate view as data (it is already documented as I/O-free, "the caller owns the no-network `resolveStrict` probe").
- `update-swap.ts` / `update-preflight.ts` / `update-row.ts` / `update-cascade.ts` / `shared.ts` get their record verdict as data or through a port that the composition roots `materialize-latest.ts` and `update-flow.ts` (both unreachable from `install-outcome.ts`) wire.
- Verify each wave with `npx fallow dead-code --no-production --circular-deps --re-export-cycles --fail-on-issues` and `npx fallow trace --path`.

**Legacy-read cost.** A record written before Phase 1 has no `mcpServerConfigs`; each read re-loads the cached manifest (memoized by `manifest-cache.ts`) and re-runs `resolveStrict` on the recorded root, and `deriveInstallVersion` may fall back to `computeHashVersion` (a content hash of the plugin root) for an unversioned plugin [VERIFIED: orchestrators/plugin/shared.ts:1332-1356]. On a real upgrade every installed plugin is legacy until its next install/update/reinstall/enable, so `list` would re-resolve each one. Recommended mitigation inside the Phase 3 module: wrap the legacy reader so a legacy record with no MCP trace (`record.resources.mcpServers` empty and `"mcpServers"` not in `compatibility.unsupported`) answers `{ servers: [], bundle: false }` without I/O. Logged as a dubious choice.

**Offline:** the legacy reader uses `recordedRootContext` (both root callbacks return `record.resolvedSource`, so nothing clones or fetches) [VERIFIED: recorded-servers.ts:101-128]. `recorded-servers.ts` and the new modules are outside `NETWORK_SEAMS` and import no git surface, so ESLint BLOCK F holds.

### Pattern 3: The MCP dependency and the marker rule

Today:

- `export type Dependency = "agents" | "mcp" | "workflows";` [VERIFIED: shared/concerns/soft-dep.ts:30]
- `export type Companion = "pi-dynamic-workflows" | "pi-mcp-adapter" | "pi-subagents" | "mcp" | "builtin mcp";` [VERIFIED: soft-dep.ts:42-43]
- `softDepMarkers` appends `requires pi-mcp-adapter` "iff `declaresMcp && !probe.piMcpAdapterLoaded`" [VERIFIED: soft-dep.ts:108-131]; `companionRequirements` pushes `{ companion: COMPANION_MCP, missing: !probe.piMcpAdapterLoaded }` with `COMPANION_MCP = "pi-mcp-adapter"` [VERIFIED: soft-dep.ts:58, 139-162].
- `companionSeverity({ declaresAgents, declaresMcp, declaresWorkflows }, probe)` returns warning when `(declaresMcp && !probe.piMcpAdapterLoaded)` among others [VERIFIED: shared/notify-reasons.ts:89-102].
- `composeRowReasons` calls `softDepMarkers(dependencies.includes("agents"), dependencies.includes("mcp"), dependencies.includes("workflows"), snapshot)` [VERIFIED by shell read: shared/notification-resolve.ts:436-450].
- The row message types in the frozen `notification-types.ts` declare `dependencies: readonly Dependency[]` and import `Dependency` type-only from `soft-dep.ts` (`notification-types.ts:2`, `:414`, `:440`, `:469`, `:597`, read by shell). **So changing `Dependency` in `soft-dep.ts` changes the row types without editing the frozen file.** The JSON wire does not serialize transition-row `dependencies` (`resolveRow` folds them into `reasons`; only the info row's plugin-address `dependencies` reach the wire, `notification-json.ts:561`).
- `shared/` may import `platform/` (fallow boundary rule `{"from": "shared", "allow": ["platform"]}`, read from `.fallowrc.json`), so `soft-dep.ts` can import the type `McpImplementationId` from `platform/pi-api.ts` as it already imports `SoftDepStatus`.

Recommended shape (compact, enough for D-P3-06..09):

```typescript
// shared/concerns/soft-dep.ts (MCP arm only)
import type { McpImplementationId, SoftDepStatus } from "../../platform/pi-api.ts";

/** D-MB-07: a plugin's MCP servers that at least one implementation runs (R not empty),
 *  and the implementations that run every one of them (I). */
export interface McpDependency {
  readonly kind: "mcp";
  readonly runEvery: readonly McpImplementationId[];
}
export type Dependency = "agents" | McpDependency | "workflows";
```

- An emit site includes the MCP dependency only when R is not empty. `mcpDependencyOf(servers)` (pure helper) classifies each non-malformed server with `profileFor("adapter").classify` and `profileFor("builtin").classify`, drops servers both block, returns `undefined` when none remain, and intersects the rest.
- Marker for active `a`: `a !== "none" && runEvery.includes(a)` gives no marker; `a !== "none"` and `a ∉ I` gives the other implementation's name; `a === "none"` gives `name(I)` where `{adapter, builtin}` maps to `requires mcp`, `{adapter}` to `requires pi-mcp-adapter`, `{builtin}` to `requires builtin mcp`, and `{}` to `requires mcp`.
- `companionRequirements`: same name as a companion (`mcp`, `pi-mcp-adapter`, `builtin mcp`), `missing = a === "none" || !runEvery.includes(a)`. **Sort by companion name**, not by kind: `"builtin mcp" < "mcp" < "pi-dynamic-workflows" < "pi-mcp-adapter" < "pi-subagents"`. Today's push order (workflows, adapter, agents) is only sorted because the MCP companion was `pi-mcp-adapter`.
- `companionSeverity`: warning for MCP exactly when the marker shows.
- Changing `Dependency` and replacing `declaresMcp: boolean` (in `orchestrators/types.ts`, eight occurrences, plus outcome literals) with `mcp?: McpDependency` makes the compiler list every emit site. Hard-coded `declaresMcp: false` sites (`update-preflight.ts` ×9, `update-swap.ts:1421`, `update-flow.ts:915`, `apply.ts:1758,1773`, `materialize-latest.ts:127,252`, `background-pass.ts:271,287`, `marketplace/update.ts:778`, from the survey) become "no MCP dependency".
- `list` partially-installed rows: `LIST_CONTEXT.rowPolicies["partially-installed"]` is `{ markers: false, contentReasons: true }` [VERIFIED: orchestrators/plugin/list.messaging.ts:64]. D-P3-07 needs `markers: true` and an MCP-only `dependencies` on that row. With `markers: true` the agents and workflows markers would also appear unless the row carries only the MCP dependency, so carry only it.

Unreadable record read (legacy reader refused): recommend the stored adapter reading for markers too, so `R` = the staged adapter servers with `runEvery: ["adapter"]` (today's behavior). Logged as a dubious choice.

### Pattern 4: Consent split

| Path | Today | Phase 3 gate view | Source |
|------|-------|------|------|
| User-run `install` (and its dependency members) | `requireInstallable` / `requirePartialInstallable` on `resolved` at `install-outcome.ts:839-848` [read by shell] | `resolutionFor(resolved, opts.run.softDeps.mcpImplementation)` | D-P3-11, D-MB-05 (`none` view under no implementation) |
| User-run `update` | `update-preflight.ts:518-522`, `partial: options.partial === true \|\| widensPartialGate(record)` (:1200) | strict gate on the candidate's active view; `widensPartialGate` keeps reading the stored (neutral) `installable` [VERIFIED: update-preflight.ts:726-728] | D-P3-12 |
| Enable re-materialization | `partial = !installed.compatibility.installable` (`enable-disable.ts:428`, `:1004`) | gate view `none` | D-P3-13 |
| Re-enable cascade member | `install-cascade.ts:1463` same | gate view `none` | D-P3-13 |
| Promotion | `install-flow-results.ts:409-414`, `:514` same | gate view `none` | D-P3-13 |
| Import promoting | `import/execute.ts:1160` `partial: true` when stored `!installable` | gate view `none` | D-P3-13 |
| Reinstall, autoupdate | `partial: true` (`reinstall-flow.ts:421`, `update-flow.ts:809`) | unchanged; `requirePartialInstallable` rejects only `unavailable`, which no view changes | D-P3-13 |
| Apply convergence move | `convergence.ts:451` `partial: !record.compatibility.installable`; consent when `record.compatibility.installable && resolved?.state === "partially-available"` (:453-456) | consent when the candidate's active view drops a kind that the record's effective active view does not; a move that is not held runs its gate on the active view (or with `partial: true`) | D-P3-13 |

Recommended mechanism: an explicit field on `InstallLedgerOptions` (which already requires `run: NotificationRun` [VERIFIED by shell: install-outcome.ts:222]), for example `consent: { readonly view: ActiveMcpImplementation }`, required at every construction site, so no site defaults. The user-run sites pass `run.softDeps.mcpImplementation`; the record-driven sites pass `"none"`. The same field on the update preflight options where `partial` is false.

Why `none` for record-driven gates is safe for legacy records: a legacy record stores the adapter verdict, so `installable: false` exactly when the adapter blocked something; the `none` view blocks a subset of what the adapter blocks, so a re-materialization never newly fails because of the view.

Open question (see below): a **fresh** `import` or `apply` install (no record) is not "a switch". Recommend gating it on the active implementation like a user-run install, because the current product already gates those installs strictly and pending previews `(will partially install)` against the active view (D-P3-15).

### Pattern 5: Writers of the neutral verdict

| Writer | File:line | Change |
|--------|-----------|--------|
| `statePhase` (install, enable, promotion, import, cascades) | `install-outcome.ts:1555-1630` | With a neutral top-level resolution, the existing `compatibility` literal already writes the neutral verdict; add `compatibilityBasis: "neutral"`. Phase 1-owned function: one-line diff, logged (P3-DC-02). Keep `installCtx.resolved` neutral; carry the view separately for rows. |
| Update swap final write | `update-swap.ts:879-898` `applyAllSuccessRecordFields` | `preflight.installable` must stay the neutral resolution; after `replaceCompatibility`, set `sRecord.compatibilityBasis = "neutral"`. Phase 1-owned; one-line diff. |
| Update intent mark | `update-swap.ts:685-735` `markUpdateInProgress` | It carries the old record's arrays forward. Recommend preserving the old record's basis (neutral stays neutral, legacy stays legacy) rather than forcing `"neutral"`, because forcing it on legacy arrays would read an adapter-only `mcpServers` kind as an independent block. Dubious choice. |
| Disabled pin refresh | `update-preflight.ts:809-870` `refreshDisabledRecord` + `nextDisabledPin` | Set basis `"neutral"` after `replaceCompatibility`; **also add `compatibilityBasis: "neutral"` to the projection in `nextDisabledPin`**, otherwise `disabledPinProjection` (which includes `pin.compatibilityBasis ?? null`) never matches and every refresh writes [VERIFIED: update-preflight.ts:737-746 field list]. |
| AMIG-01 dropped-server write | `mcp-migration.ts:515-535` `applyDroppedServers` | Stage with `resolutionFor(resolved, "adapter")` (adapter by name, D-P3-16); write the record's MCP kind from the neutral view, then set basis `"neutral"`. Converting a legacy record: `effectiveMcpCompatibility(record, recorded, "none")` over the re-resolved servers gives exactly the neutral compatibility. |
| `apply` pin restore | `reconcile/apply.ts:1935-1957` | Already restores `compatibilityBasis` via `DISABLED_PIN_FIELDS`; no change. |

### Pattern 6: `info` per-server verdicts (MREC-04)

- Resolved arms (`composeResolvedComponents`, `info.ts:1009-1104`) build entries from `resolved.mcpServers` keys (the adapter subset) plus `resolved.droppedMcpServers` [read by shell]. Under built-in, a bare-elicitation server is not in `mcpServers` but does run, so build the written list from `declaredMcpServers` minus the view's `droppedMcpServers`, and the left-out list from the view's `droppedMcpServers` (which carries the active implementation's feature token, for example `sse`). Variable scans read the declared configs.
- State-only arm (`composeStateOnlyComponents`, `info.ts:1771-1818`) uses `record.resources.mcpServers` and "passes no dropped servers". With the record read, show recorded servers with the effective `blocked` list.
- Status rows: `derivePersistedInstalledStatus` (`info.ts:1736-1740`) and the live path arm (`info.ts:2439`, `resolved.state === "partially-available" ? "partially-installed" : "installed"`) read the effective / view state.
- `withCompanionRequirements` (`info.ts:3119-3135`) today infers MCP from components; feed it the `McpDependency` from the row builder instead.
- Do not touch `withServerStatus` (`info.ts:3146-3160`, frozen status call) or `info-mcp-status.ts` (Phase 2). Phase 2's status skips entries with `unsupportedFeature`, so a view-blocked server gets no status.
- Non-path installed rows are `componentsResolved: false` and show no per-server lines; a MREC-04 scenario needs a path-source (dir marketplace) plugin.

### Per-surface wiring table

| Surface | Module(s) | How it learns `active` | Data it needs | Cycle-safe for the record read? |
|---------|-----------|------------------------|---------------|---------------------------------|
| list installed rows | `list-installed-row.ts`, `list-flow.ts` | new required `mcpImplementation` on `PluginListPayloadOptions` (the payload builder has no run today) | `ComposeInstalledListRowOptions` lacks `manifestPath`; add the marketplace record or `manifestPath` for `LegacyServersSource` | yes |
| list not-installed rows / `--partial` filter | `list-candidate-row.ts`, `list-flow.ts:254` | same option | `resolutionFor(candidate.resolved, active)` | n/a (resolution) |
| LLM list tool | `edge/handlers/tools.ts:337-360, 501-517` | open `openNotificationSnapshot(pi)` before `loadToolPluginPayload` and pass `run.softDeps.mcpImplementation` | — | edge file, not owned by any phase; small edit (dubious) |
| browse loader | `edge/handlers/plugin/browse.ts:82-89` | thread the browse command's run into `makePluginLoader` | — | same |
| info | `orchestrators/plugin/info.ts` | `opts.run.softDeps.mcpImplementation` | `found` marketplace records | yes |
| completions | `orchestrators/edge-deps.ts`, `git-source-probe.ts` | **none available**: `edge/register.ts` (frozen) builds `makeLocationsResolver(process.cwd())` per lookup, and the plugin-index cache persists on disk with a 10-minute TTL keyed by scope and marketplace only | — | see Open Question 1 |
| install rows | `install-flow-ledger.ts:441-500`, `install-outcome.ts:1737-1760`, `install-cascade.ts:1249-1270`, `install-cascade.messaging.ts:221-276` | `installCtx` options' `run` | view + `mcpDependencyOf(resolved.declaredMcpServers)` | no record read needed |
| update / reinstall rows | `update-swap.ts:1640-1700`, `update-row.ts:278-290`, `update-cascade.ts:96-110`, `reinstall.messaging.ts:181-235` | thread `mcpImplementation` into `ThreePhaseArgs` from `materialize-latest.ts` (`args.run`) | view for `partialDegrade`; `newlyDegraded` compares with the record's effective view, which `materialize-latest.ts` computes after preflight and passes in | swap/row modules are **not** cycle-safe; compute in `materialize-latest.ts` |
| enable rows | `enable-disable.ts:3137-3166`, `plugin/shared.ts:194-210` | `run` | view + dependency | `shared.ts` not cycle-safe: pass data in |
| import / apply / dependency moves | `import/execute.ts:713-734, 1216, 1328`; `reconcile/apply.ts:783, 868, 2282`; `dependency-move.ts:306-315` | `opts.run` | outcome's `mcp` | yes |
| pending force-install preview | `reconcile/notify.ts:646-686` | thread `run` / implementation into `resolvePendingForceInstalls` | `resolutionFor(resolved, active)` | yes |
| convergence | `reconcile/convergence.ts:407-456` | new required field on `ConvergenceInput`; callers `pending.ts:508`, `apply.ts:1366`, `read-pass.ts` (`settleMoveCascade`) | record effective view + candidate view | yes |
| AMIG-01 | `reconcile/mcp-migration.ts:319-349, 435-447, 515-535` | not needed (adapter by name) | — | yes |
| fetch rows | `orchestrators/plugin/fetch.ts:530-560` | has a run | `resolutionFor` | not in the ownership table; see Open Question 3 |

### Anti-Patterns to Avoid

- **Reading `resolved.state` / `.unsupported` / `.droppedMcpServers` without naming a view.** Top level is neutral; a row built from it silently shows the `none` view.
- **Importing the record-read module from a module `install-outcome.ts` reaches.** It closes a cycle through the frozen `recorded-servers.ts`.
- **Reading `record.mcpServerConfigs` directly.** Frozen interface 3: read only through `recordedMcpServers`.
- **Forcing `compatibilityBasis: "neutral"` onto carried-forward legacy arrays.** It turns an adapter-only `mcpServers` kind into an independent block.
- **Adding a required parameter to `resolveStrict`.** It breaks the frozen `recorded-servers.ts` call.
- **Defaulting the implementation anywhere** (`?? "adapter"`, an optional parameter). D-P3-03 forbids it.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Per-implementation verdict of a resolution | a second classification table or ad-hoc `unsupported` edits | `effectiveMcpCompatibility` over the resolution's neutral verdict | One rule for fresh and stored verdicts; kind order and bundle handling already right |
| Reading a record's servers | `record.mcpServerConfigs ?? reresolve()` | `recordedMcpServers(record, createLegacyServersReader(source))` | Frozen single reader; handles legacy, version mismatch, unreadable |
| Classifying a server | inline transport checks | `profileFor(id).classify(config)` | Shared Claude-shape check keeps malformed identical |
| Clearing the basis on a compatibility write | `record.compatibility = …` | `replaceCompatibility(record, …)` then set the basis | WR-02 rule |
| Active implementation | probing `pi` again | `run.softDeps.mcpImplementation` | D-05 one probe per run |
| Unsupported tokens | string mapping | `narrowUnsupportedKinds` | Byte parity across surfaces |

**Key insight:** every hard part of this phase was frozen in Phase 1 precisely so Phase 3 composes it. New logic should be limited to view selection, the R/I marker rule, and wiring.

## Common Pitfalls

### Pitfall 1: Import cycle through `recorded-servers.ts`
**What goes wrong:** `npm run fallow` fails on a circular dependency.
**Why:** `recorded-servers.ts -> install-outcome.ts ->* {shared, plugin-state-classifier, git-source-probe, update-swap, update-preflight, update-row, update-cascade}`.
**How to avoid:** split pure and I/O helpers; compute record verdicts in cycle-safe callers and pass data in.
**Warning signs:** a planned import of the read module from any of those files; check with `npx fallow trace --path`.

### Pitfall 2: Order of the `mcpServers` kind
**What goes wrong:** an install row prints `{unsupported mcp, unsupported hooks}` and the next `list` prints `{unsupported hooks, unsupported mcp}`.
**Why:** the resolver pushes `mcpServers` at the MCP stage (before hooks and unsupported component kinds), while `effectiveMcpCompatibility` appends it when the stored verdict lacks it.
**How to avoid:** derive every view with `effectiveMcpCompatibility` (Pattern 1). Accept that a plugin with an adapter-only block (bare elicitation) plus another unsupported kind now lists `unsupported mcp` last under the adapter; check the resolver tests that pin order.

### Pitfall 3: `disabledPinProjection` never matches
**What goes wrong:** every update of a disabled plugin reports a refresh and rewrites the record.
**Why:** the projection includes `compatibilityBasis ?? null`; `nextDisabledPin` builds no basis.
**How to avoid:** include `compatibilityBasis: "neutral"` in `nextDisabledPin`'s projection input.

### Pitfall 4: Catalog bytes and frozen counters
**What goes wrong:** `catalog-contract.test.ts` fails (`EXPECTED_STATE_COUNT = 324`, `EXPECTED_UTF8_BYTES = 54_652` [VERIFIED: test/architecture/catalog-uat/catalog-contract.test.ts:21-22]).
**Why:** catalog fixtures pass `dependencies: ["agents", "mcp"]` (`fixtures/plugin-install.ts:56` and others) rendered under `piWithNothingLoaded()` (active `none`); the docs pin `{requires pi-subagents, requires pi-mcp-adapter}` (`docs/output-catalog.md:259, 589, 1724, 2558`).
**How to avoid:** the new `Dependency` type forces the fixtures to change; write the MCP dependency as `{ kind: "mcp", runEvery: ["adapter"] }`, which renders `requires pi-mcp-adapter` under `none` and `builtin` and nothing under `adapter`, so every catalog example keeps its bytes. Add no new catalog example in Phase 3; new `requires mcp` / `requires builtin mcp` examples and the prose at `docs/output-catalog.md:69, 3041, 3161` are parent lines. The info fixtures stamp `requires` themselves and are unaffected.

### Pitfall 5: A Phase 2 file pins `requires`
**What goes wrong:** after the Wave 3 merge, `features/mcp-server/project-scope.feature:133` (`[{"companion":"pi-mcp-adapter","missing":false}]` for a stdio stub under the adapter) fails, because D-P3-08 makes it `mcp`.
**How to avoid:** at Wave 3, re-grep the merged Phase 2 files (and any new `builtin-*.feature`) for `plugin requires`, `requires pi-mcp-adapter`, `unsupported mcp`, and plugin state rows; per the milestone "State rows" rule those rows are Phase 3's to fix after the merge, or a parent line. `features/mcp-server/sources.feature:192` (bundle `partially-available`) also stays correct under both implementations after Phase 3 and could lose its `@adapter-only` tag, but the file is Phase 2's.

### Pitfall 6: Complexity gates
**What goes wrong:** `sonarjs/cognitive-complexity` 15 or fallow `maxCognitive` 15 / `maxCyclomatic` 20 fails in `softDepMarkers`, `companionRequirements`, `recordMove`, `composeInstalledListRow`, or info row builders after adding branches.
**How to avoid:** put the R/I-to-marker mapping in small lookup helpers (a `Record<"both"|"adapter"|"builtin"|"split", Reason>` style table); keep each emit-site change to one helper call; run `npx fallow health` per task. No `thresholdOverrides` exist and none may be added (`.fallowrc.json` is frozen).

### Pitfall 7: fallow dupes
**What goes wrong:** the same "build MCP dependency from outcome" block appears at many emit sites and fallow dupes fails (every clone group fails since fallow 3.32).
**How to avoid:** one helper (`mcpDependencyOf`) and one projection per outcome type; do not copy the R/I loop.

### Pitfall 8: Closed-set lock tests
**What goes wrong:** a new reason or companion breaks `test/architecture/notify-closed-set-locks.test.ts`.
**How to avoid:** none is needed; `requires mcp`, `requires builtin mcp`, `mcp`, `builtin mcp` already exist (lock counts: Reason 80). Do not add or reword an entry.

### Pitfall 9: Completion cache is stale across a switch
**What goes wrong:** completions offer `update --partial` for a set computed under the previous implementation for up to 10 minutes, even across a restart (file tier).
**How to avoid:** see Open Question 1; needs a frozen-file parent line to fix fully.

### Pitfall 10: Under built-in, the user-run install of an `sse` plugin is refused
**What goes wrong:** a `@builtin-only` twin that installs an `sse` plugin without `--partial` fails before it can show `partially-installed`.
**How to avoid:** the built-in twin installs with `--partial`, or the scenario installs under the adapter and restarts without the adapter (`@own-implementation`), which is also the SC-1 "no reinstall" proof.

### Pitfall 11: Network in scenarios
**What goes wrong:** an `sse` or `ws` server URL reaches a real host.
**How to avoid:** use loopback URLs (for example `http://127.0.0.1:9/sse`); list/info/install never connect, and under built-in a blocked server is never registered. pi-mcp-adapter connects lazily ("cached, connects on first use" in existing rows) [ASSUMED for sse].

## Code Examples

### Marker selection (shared, pure)

```typescript
// shared/concerns/soft-dep.ts -- MCP arm only (sketch)
const MARKER_BY_SET = {
  both: "requires mcp",
  adapter: "requires pi-mcp-adapter",
  builtin: "requires builtin mcp",
} as const satisfies Record<string, Reason>;

function mcpMarker(dep: McpDependency, active: SoftDepStatus["mcpImplementation"]): Reason | undefined {
  if (active !== "none") {
    if (dep.runEvery.includes(active)) {
      return undefined;
    }

    return active === "adapter" ? MARKER_BY_SET.builtin : MARKER_BY_SET.adapter; // D-P3-06 split rule too
  }

  if (dep.runEvery.length === 1) {
    return dep.runEvery[0] === "adapter" ? MARKER_BY_SET.adapter : MARKER_BY_SET.builtin;
  }

  return MARKER_BY_SET.both; // both, or split with none active
}
```

### MCP dependency from declared or recorded servers (pure, cycle-safe)

```typescript
// orchestrators/plugin/mcp-verdict.ts (or a domain helper)
import { profileFor, type McpImplementationId } from "../../domain/mcp-implementation.ts";
import type { McpDependency } from "../../shared/concerns/soft-dep.ts";

const IDS: readonly McpImplementationId[] = ["adapter", "builtin"];

export function mcpDependencyOf(configs: readonly unknown[]): McpDependency | undefined {
  const runs = configs
    .map((config) => IDS.filter((id) => profileFor(id).classify(config).kind === "supported"))
    .filter((ids) => ids.length > 0);
  if (runs.length === 0) {
    return undefined;
  }

  return { kind: "mcp", runEvery: IDS.filter((id) => runs.every((ids) => ids.includes(id))) };
}
```

### Record read (I/O, imported only by cycle-safe modules)

```typescript
// orchestrators/plugin/mcp-verdict-read.ts
export async function readRecordMcpVerdict(
  record: PluginInstallRecord,
  source: LegacyServersSource,
  active: ActiveMcpImplementation,
): Promise<{ readonly effective: EffectiveMcpCompatibility; readonly recorded: RecordedMcpServers }> {
  const recorded = await recordedMcpServers(record, createLegacyServersReader(source));
  return { effective: effectiveMcpCompatibility(record, recorded, active), recorded };
}
```

## State of the Art

| Old approach | Current approach | When changed | Impact |
|--------------|------------------|--------------|--------|
| Stored compatibility = adapter verdict | Neutral verdict + `compatibilityBasis: "neutral"`; legacy records read as adapter (P1-DC-02) | This phase | Every record write gains the basis |
| `declaresMcp: boolean` -> `requires pi-mcp-adapter` iff adapter not loaded | MCP dependency with the implementations that run every server -> three markers | This phase | ~30 emit sites, `orchestrators/types.ts`, catalog fixtures |
| `info` `requires: pi-mcp-adapter` | `requires: mcp` (or the specific implementation) | This phase | Breaks `project-scope.feature:133` after merge |

**Deprecated/outdated:** the `piMcpAdapterLoaded` reads in `softDepMarkers` / `companionRequirements` / `companionSeverity` (the flag stays in the frozen snapshot).

## Behavioral Tests

### Harness facts

- Profiles: `adapter` (and `default`) run `"not @builtin-only"` with `mcpImplementation: "adapter"`; `builtin` runs `"(@mcp or @builtin-only) and not @adapter-only"` with `mcpImplementation: "builtin"` [VERIFIED: cucumber.json:2-25]. `@own-implementation` scenarios run once, under the adapter profile.
- Commands go to `world.pi`: the scenario's profile Pi once a step started one, else the run's shared Pi, which follows the profile (adapter companion under `adapter`, none under `builtin`) (`features/support/world.ts:208-216`, read by shell). A `Given the user has run "..."` before any profile Pi step therefore runs on the shared Pi.
- Reaching `none`: `Given the user's pi settings turn off pi's built-in mcp` then `Given pi runs with the scripted model` (no companion), or start a Pi and `When the user restarts pi with no mcp` (removes the adapter and starts with `--no-mcp`) (`world.ts:918-930`, `mcp-implementation.steps.ts:71-111`, frozen).
- A switch with no reinstall: install on the shared adapter Pi, `Given pi runs with the scripted model and these companions:` with `pi-mcp-adapter`, then `When the user restarts pi without pi-mcp-adapter` (built-in loads by default), then `When the user runs "/claude:plugin list"`. The restart is a frozen `When`, so such a scenario has two `When` steps; `implementation-profiles.feature` already follows this form.
- Run one profile: `npm run test:cucumber:profile -- --profile <adapter|builtin> <paths>` (installs the peer cache first; `node_modules/.cache/optional-peers` is empty in this checkout). One scenario: `npx cucumber-js --profile <p> --name '<title>'`.
- Tag rules (`npm run check:features`): an MCP scenario carries exactly one implementation tag; `@mcp` never names `pi-mcp-adapter` (so every row showing `requires pi-mcp-adapter` is `@adapter-only`/`@builtin-only`/`@own-implementation`); `@adapter-only`/`@builtin-only` name an ID (MREC-03..07, D-MB-07) in the title or feature description.

### Declaring the servers with existing steps

- Any server shape: `Given the published plugin "demo" of the marketplace "fixtures" has the file ".mcp.json" with this text:` plus a doc string [VERIFIED by shell: features/step_definitions/plugin/publishing.steps.ts:328-337, frozen shared module]. The doc string naming `mcpServers` makes the scenario an MCP scenario.
  - `sse`: `{"mcpServers": {"events": {"type": "sse", "url": "http://127.0.0.1:9/sse"}}}`
  - bare elicitation: `{"mcpServers": {"asker": {"command": "node", "args": ["server.mjs"], "bareElicitationCapability": true}}}` (the adapter classifier blocks when `bareElicitationCapability === true` on stdio or remote; built-in never blocks it) [VERIFIED by shell: domain/mcp-server-features.ts:330-334, mcp-builtin-features.ts:19-34]
  - `ws`: `{"mcpServers": {"socket": {"type": "ws", "url": "ws://127.0.0.1:9/"}}}`
- A stdio stub: `Given the published plugin "demo" of the marketplace "fixtures" has the stub mcp server "stub"` (`mcp-server/listing.steps.ts:76`, frozen).
- Plain declared server: `Given the published plugin {string} of the marketplace {string} declares the mcp server {string}` (used in `verdict-markers.feature`).
- Missing and new Phase 3 steps (`features/step_definitions/mcp-server/verdict-*.steps.ts`, helpers in `features/lib/mcp-verdict-*.ts`): a `Then` that the user's Pi settings still hold `-builtin:mcp` / are unchanged (for "Pi's settings are never written", MREC-05). `features/lib/mcp-implementation.ts` (frozen) exports `readBuiltinTurnedOff(agentDir, projectDir)` that a Phase 3 step can call.

### Scenario plan (per D-P3-17..19)

| Scenario | Tag | Proves |
|----------|-----|--------|
| Each existing `verdict-markers.feature` pair whose stdio twins now agree | `@mcp` (fold pair) | No marker under either implementation (MREC-05/07) |
| `sse` plugin: list shows `installed` | `@adapter-only` | MREC-03 |
| `sse` plugin installed with `--partial`: list shows `partially-installed` `{unsupported mcp, requires pi-mcp-adapter}` | `@builtin-only` | MREC-03, MREC-07, D-MB-07 bytes |
| `sse` plugin installed under adapter, restart without adapter, list shows partially-installed, no reinstall | `@own-implementation` | SC-1 "no reinstall" |
| bare-elicitation server: `{unsupported mcp, requires builtin mcp}` / `installed` | `@adapter-only` / `@builtin-only` pair | MREC-07 |
| `ws` server: `{unsupported mcp}` only | `@mcp` | MREC-07 neither-runs |
| `info` per-server lines: `sse` `(unsupported sse)` under built-in, runnable under the adapter; `requires: pi-mcp-adapter (missing)` | pair | MREC-04, MREC-07 |
| No implementation: install with no `--partial` shows `{requires mcp}` (stdio), `{requires pi-mcp-adapter}` (sse), `{requires builtin mcp}` (bare elicitation); `info` `requires: mcp (missing)`; settings unchanged | `@own-implementation` | MREC-05, D-MB-01, D-MB-05 |
| User-run install/update asks under the blocking implementation | pair | MREC-06 |
| Enable and `apply` after a switch complete without consent | `@own-implementation` | MREC-06 |
| `companion-missing.feature` rewritten on the no-implementation model, `@builtin-only` removed | `@own-implementation` / `@mcp` | MREC-05 |
| `invalid-configs.feature` `@adapter-only` -> `@mcp` | `@mcp` | MREC-04 (malformed is shared) |

Red proof: write each scenario first, run it on the Phase 1 code under each profile where it applies, and record the failing output in the plan SUMMARY (TDD commit rule: test and implementation in one commit, P1-DC-28).

## Unit, Integration, and E2E Impact

- **Unit pairs (owned or touched; 100% direct coverage each):** `test/domain/{mcp-resolution,plugin-resolver,resolver-types}.test.ts`; `test/shared/concerns/soft-dep.test.ts`; `test/shared/notify-reasons.test.ts` (only `companionSeverity` cases); `test/shared/notification-resolve.test.ts` (dependency shape); `test/orchestrators/plugin/{plugin-state-classifier,list-installed-row,list-flow,list.messaging,list-candidate-row,info,install-outcome,install-flow-ledger,install-cascade,install-cascade.messaging,install-flow-results,update-preflight,update-swap,update-row,update-cascade,shared,enable-disable,reinstall.messaging,dependency-move,materialize-latest,git-source-probe,fetch?}.test.ts`; `test/orchestrators/{edge-deps,types}.test.ts`; `test/orchestrators/reconcile/{convergence,mcp-migration,notify,apply,pending,read-pass}.test.ts`; `test/orchestrators/import/execute.test.ts`; `test/edge/handlers/{tools,plugin/browse}.test.ts`; new pairs for each new module. Files that literally use the `"mcp"` dependency (grep this session): `test/shared/{notification-dispatch,notification-json,notification-present,notification-resolve,notification-run}.test.ts`, `test/orchestrators/plugin/{install-outcome,install-flow-planning,install-flow-results,install-flow-ledger,install-cascade.messaging,list-installed-row,list.messaging,update-row,update-flow,update-swap,update.messaging,reinstall-flow,reinstall-record,reinstall.messaging,shared}.test.ts`, `test/orchestrators/marketplace/update.messaging.test.ts`, `test/orchestrators/reconcile/{apply-outcomes,notify,mcp-migration}.test.ts`, `test/orchestrators/types.test.ts`.
- **Catalog fixtures:** `test/architecture/catalog-uat/fixtures/{plugin-install,plugin-list,plugin-import,plugin-reinstall}.ts` (`"mcp"` dependencies) change shape, not bytes (Pitfall 4).
- **Integration (Phase 3 changes only marker/state assertions):** `mcp-server-records.test.ts:168-214` (`hasCompatibilityBasis: false` -> `true`; `unsupported: ["mcpServers"]` may change if the blocked server is adapter-only), `mcp-home-path-partial.test.ts:61,111,121`, `mcp-migration.test.ts:366,541-546,556`, `mcp-variable-expansion.test.ts:269,307,340`, `mcp-override-lifecycle.test.ts:209,239,246,503`, `mcp-tool-rules.test.ts:57-61` (survey line numbers). New cases in `test/integration/mcp-verdict-*.test.ts` (for example: neutral write + basis on install/update/disabled refresh/migration; effective list under each implementation for one record; legacy record read).
- **E2E (not in `npm run check`; CI runs them):** `test/e2e/install-soft-deps.test.ts` `MCP_STATES` (the "built-in MCP alone keeps `{requires pi-mcp-adapter}`" and "foreign `mcp` tool" rows change for a stdio server) and `test/e2e/adapter-detection-rpc.test.ts` `PI_MCP_STATES` (`expectedRow`, `expectedAdapterMissing`, and the info `requires` companion). `test/e2e/_rpc.ts` is frozen.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node | everything | yes | v24.22.1 | — |
| npm | scripts | yes | 10.9.9 | — |
| fallow | gates, cycle tracing | yes | 3.35.0 | — |
| Optional peer cache (`node_modules/.cache/optional-peers`) | cucumber, integration | not installed yet | — | `node scripts/install-test-peers.mjs` (run by `test:cucumber*`, `test:integration`); needs registry access through the proxy |
| `nondac-sh` wrapper | running as root | yes | — | — |
| Claude Code binary | upstream probes (not needed) | yes (`/opt/claude-code/bin/claude`) | — | — |

**Missing dependencies with no fallback:** none.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | `node:test` + `node:assert/strict` + `strong-mock` (unit, integration); `@cucumber/cucumber` (behavioral, two profiles) |
| Config file | `cucumber.json` (frozen), `scripts/test-coverage-direct.mjs` |
| Quick run command | `node --test test/<path>.test.ts`; `npm run test:coverage:direct -- <source-or-test>`; `npx cucumber-js --profile <adapter\|builtin> features/mcp-server/verdict-*.feature` |
| Full suite command | `npm run check` (in parts: `check:static`, `test:unpaired`, `test:integration`, `test:cucumber:profile` per profile, `test:coverage:direct:all`) plus `npm run test:modules` at the phase gate |

All npm commands run with `npm_config_script_shell=/tmp/claude-0/-home-user-pi-claude-marketplace/6e2a5cdb-dbbb-5644-af8a-1c0a0b42c0fd/scratchpad/nondac-sh NODE_OPTIONS=--max-old-space-size=6144`.

### Phase Requirements -> Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| MREC-03 | Resolver neutral verdict; `resolutionFor` per implementation | unit | `node --test test/domain/plugin-resolver.test.ts test/domain/mcp-resolution.test.ts` | yes (extend) |
| MREC-03 | Classifier and list row read the effective record | unit | `node --test test/orchestrators/plugin/list-installed-row.test.ts test/orchestrators/plugin/plugin-state-classifier.test.ts` | yes (extend) |
| MREC-03 | Writers store neutral + basis | integration | `node --test test/integration/mcp-verdict-*.test.ts test/integration/mcp-server-records.test.ts` | Wave 0 (new file) |
| MREC-03 | `sse` plugin `installed` vs `partially-installed`, no reinstall | cucumber | `npm run test:cucumber:profile -- --profile adapter features/mcp-server/verdict-*.feature` and `--profile builtin` | Wave 0 (new feature) |
| MREC-04 | `info` per-server verdict lines per implementation | unit + cucumber | `node --test test/orchestrators/plugin/info.test.ts`; cucumber pair | yes / Wave 0 |
| MREC-05 | Markers and `requires:` under `none`; install without `--partial`; settings unchanged | unit + cucumber | `node --test test/shared/concerns/soft-dep.test.ts`; `npx cucumber-js --profile adapter features/mcp-server/companion-missing.feature features/mcp-server/verdict-*.feature` | yes / Wave 0 |
| MREC-06 | Consent split (user-run active; record-driven neutral; convergence rule) | unit + cucumber | `node --test test/orchestrators/plugin/install-outcome.test.ts test/orchestrators/plugin/update-preflight.test.ts test/orchestrators/reconcile/convergence.test.ts test/orchestrators/plugin/enable-disable.test.ts` | yes (extend) |
| MREC-07 | `{unsupported mcp, requires pi-mcp-adapter}` bytes; `{unsupported mcp}` only for `ws`; severity | unit + cucumber + e2e | `node --test test/shared/notify-reasons.test.ts test/shared/notification-resolve.test.ts`; cucumber pair; `npm run test:e2e` (CI) | yes / Wave 0 |
| all | No cycle, complexity, dupes | static | `npm run check:static`; `npx fallow dead-code --no-production --circular-deps --re-export-cycles --fail-on-issues` | yes |
| all | Catalog bytes unchanged | unit (architecture) | `node --test test/architecture/catalog-uat/catalog-contract.test.ts` | yes |

### Sampling Rate

- **Per task commit:** the touched pairs' `node --test` plus `npm run test:coverage:direct -- <pair>`; `npm run check:static` by hand inside executor worktrees (the hook may skip there); the touched feature files under each profile they run in.
- **Per wave merge:** `npm run check` on the combined tree plus both cucumber profiles.
- **Phase gate:** after merging `origin/features/mcp-builtin` (D-P3-23): `npm run check`, both cucumber profiles, `npm run test:modules`, and a grep of merged Phase 2/4/5 feature files for MCP state/marker rows.

### Wave 0 Gaps

- [ ] `test/integration/mcp-verdict-*.test.ts` -- MREC-03 writers and effective reads
- [ ] `features/mcp-server/verdict-*.feature` + `features/step_definitions/mcp-server/verdict-*.steps.ts` (+ `features/lib/mcp-verdict-*.ts` if a helper is shared) -- MREC-03..07
- [ ] Test pairs for each new product module (`test/orchestrators/plugin/mcp-verdict.test.ts`, `mcp-verdict-read.test.ts`)
- [ ] Peer cache install: `node scripts/install-test-peers.mjs`

## Security Domain

`security_enforcement` is absent from `.planning/config.json`, so it is enabled.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | — (no new credential path; the legacy reader and views are offline) |
| V3 Session Management | no | — |
| V4 Access Control | no | — |
| V5 Input Validation | yes | Server configs go through the frozen Claude-shape check (`checkClaudeShape`, typebox); a malformed recorded config makes the stored verdict stand (effective rule 1) |
| V6 Cryptography | no | — |
| V12 Files and Resources | yes | Legacy reader reads only the cached manifest and the recorded root under the resolver's containment (`locateManifestCandidate`, `assertPathInside`); all writes through `replaceCompatibility` + atomic `state.json` save |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Hand-edited `state.json` sets `compatibilityBasis: "neutral"` on an adapter verdict to hide a block | Tampering | Low impact: the effective read recomputes blocks from the recorded configs under every implementation; a neutral stored `mcpServers` only adds a block |
| A read surface silently reaches the network through the legacy reader | Information disclosure / NFR-5 | Reader pins both root callbacks to `record.resolvedSource`; new modules stay outside `NETWORK_SEAMS`; BLOCK F lints them |
| Path leakage in new rows | Information disclosure | Rows carry tokens only; no new free text; reuse `narrowUnsupportedKinds` |
| Feature URLs in scenarios reach the internet | — | Loopback URLs only |

## Anticipated Parent Lines

- **CHANGELOG.md:** the two new reasons (`requires mcp`, `requires builtin mcp`); state, markers, and `--partial` consent follow the active MCP implementation; `info`'s `requires:` names `mcp` / `builtin mcp`; `partially-installed` list rows can carry the MCP marker.
- **docs/output-catalog.md (frozen counters):** prose at `:69` (soft-dep marker list and "the list / info inventory rows omit it"), `:3041` and `:3161` ("MCP servers need pi-mcp-adapter"), plus new examples for `requires mcp` / `requires builtin mcp` if wanted (changes the counters).
- **docs/json-output.md (frozen):** only if the `requires` wording or the `Companion` description changes.
- **edge/register.ts (frozen):** pass the active implementation to the completion resolver (Open Question 1).
- **README / README.es.md:** user-facing description of `{requires mcp}` and switching.
- **Phase 2 files after merge:** `features/mcp-server/project-scope.feature:133` `plugin requires` row (or a Phase 3 fix after the merge, per the "State rows" rule).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | fallow's circular-dependency check counts type-only import hops | Pattern 2 | If it does not, update-preflight/swap/row could import the read module directly; the DI recommendation only costs some wiring |
| A2 | pi-mcp-adapter does not connect an `sse` server during list/info/install scenarios | Pitfall 11 | A scenario could hang or log a connection error; use loopback URLs either way |
| A3 | The load run (`resources_discover`) snapshot already sees built-in MCP's `mcp` command | Per-surface table | Load-time pending rows would read `none` under built-in; verify with an existing load scenario |
| A4 | A fresh import / apply install (no record) should gate on the active implementation | Pattern 4 | If the user wants "never ask" for import/apply, those installs need `none` (or `partial: true`) instead |
| A5 | A legacy record with no MCP trace (no staged servers, no `mcpServers` kind) declares no MCP server | Pattern 2 | A legacy plugin whose servers were all filtered silently would read as serverless; low likelihood |

## Open Questions

1. **Completions cannot follow the active implementation without a frozen-file change.**
   - What we know: `edge/register.ts` (frozen) calls `makeLocationsResolver(process.cwd())`; completion has no run; the plugin-index cache is persisted per scope and marketplace with a 10-minute TTL.
   - What's unclear: whether to probe at completion time and whether to key the cache by implementation.
   - Recommendation: leave `edge-deps.ts` classification on the stored verdict in Phase 3, and write a parent line: register.ts passes `() => softDepStatus(pi).mcpImplementation`, and `shared/completion-cache.ts` adds the implementation to the cache key (schema bump). Log as dubious (Medium).
2. **Fresh import/apply installs** -- see A4.
3. **`fetch` rows and the browse picker** show `available` / `partially-available`; MREC-03 does not list them. Recommendation: switch `fetch.ts`'s `resolvedRow` to the active view for consistency (it has a run); log the edit as outside the ownership table.
4. **Intent mark basis** -- preserve vs force `"neutral"` (Pattern 5). Recommendation: preserve.
5. **Marker inputs when the record read is `unreadable`** -- recommendation: fall back to the stored adapter reading (`runEvery: ["adapter"]` over the staged servers).

## Sources

### Primary (HIGH confidence)

- In-repo files read this session: `domain/mcp-implementation.ts`, `orchestrators/mcp/recorded-servers.ts`, `domain/mcp-resolution.ts`, `domain/resolver-types.ts`, `orchestrators/plugin/plugin-state-classifier.ts`, `orchestrators/plugin/list-installed-row.ts`, `shared/concerns/soft-dep.ts`, `shared/notify-reasons.ts:89-102`, `orchestrators/plugin/list.messaging.ts:56-69`, `orchestrators/plugin/update-preflight.ts:726-745`, `cucumber.json`, `test/architecture/catalog-uat/catalog-contract.test.ts:18-22`.
- Shell reads (same session): `plugin-resolver.ts`, `install-outcome.ts`, `update-swap.ts`, `update-preflight.ts`, `info.ts`, `edge-deps.ts`, `convergence.ts`, `mcp-migration.ts`, `notification-resolve.ts`, `notification-types.ts`, `list-flow.ts`, `tools.ts`, `browse.ts`, `register.ts`, feature files, step modules, `world.ts`.
- `npx fallow trace --path` (fallow 3.35.0) for every candidate importer.
- `.planning/phases/01-foundation-and-pi-1-5-0/01-FROZEN.md`, ROADMAP mcp-builtin sections, REQUIREMENTS D-MB-01..07, CHILD-SESSION-BRIEF, the Phase 3 survey.

### Secondary (MEDIUM confidence)

- Skills: `cucumber` (layout, features), `local-verification` (commands), `typescript-unit-tests` (pairing).

### Tertiary (LOW confidence)

- A1-A5 above.

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH -- no new package; every frozen export read.
- Architecture: MEDIUM-HIGH -- the code map and cycle constraints are measured; the API shapes are recommendations.
- Pitfalls: HIGH -- each is traced to a file and line.

**Research date:** 2026-11-04
**Valid until:** the Wave 3 merge of `origin/features/mcp-builtin` (Phases 2, 4, 5 may move line numbers and add rows).

## Dubious Choices

- Top-level resolver verdict becomes neutral, and views are derived with `effectiveMcpCompatibility`; alternatives: an option argument on `resolveStrict` (breaks the frozen 2-argument caller unless optional, which D-P3-03 forbids) or both views stored on the result. Dubious because a forgotten call site reads `none` silently. Medium.
- The `mcpServers` kind is appended at the end when only one implementation blocks (from `effectiveMcpCompatibility`), which reorders `{unsupported mcp, ...}` after other kinds for adapter-only blocks; alternative: keep resolver order and accept install/list drift. Low.
- Record reads live in one I/O module imported only by cycle-safe consumers; update swap/rows get the record verdict as data from `materialize-latest.ts`; alternative: import directly and accept a cycle, or move `deriveInstallVersion` (frozen import). Medium.
- A wrapped legacy reader skips I/O for legacy records with no MCP trace; alternative: always re-resolve (cost on `list` after upgrade). Medium.
- `McpDependency { kind: "mcp"; runEvery }` replaces the `"mcp"` literal, touching the frozen `notification-types.ts` row types through a type import (no file edit) and every emit site; alternative: keep `"mcp"` meaning `{adapter}` and add a new arm (silent defaults). Medium.
- Record-driven consent gates (enable, re-enable, promotion, import promoting) evaluate the `none` view; fresh import/apply installs evaluate the active view. Medium.
- The update intent mark preserves the old record's basis instead of forcing `"neutral"`, diverging from the literal D-P3-02 list. Medium.
- Catalog fixtures switch to `runEvery: ["adapter"]` so catalog bytes stay; new `requires mcp` examples become parent lines. Low.
- Completions stay on the stored verdict in Phase 3 with a frozen-file parent line for `edge/register.ts` and a completion-cache key change. Medium.
- `edge/handlers/tools.ts`, `edge/handlers/plugin/browse.ts`, `orchestrators/types.ts`, `orchestrators/plugin/fetch.ts`, `reconcile/{pending,read-pass,apply,notify}.ts` are edited although the ownership table does not name them (no sibling owns them). Low.
- Unreadable record reads fall back to the stored adapter reading for markers (`runEvery: ["adapter"]` over staged servers). Low.
