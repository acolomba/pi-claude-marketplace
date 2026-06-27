# Phase 65: Force Install & Update - Research

**Researched:** 2026-06-27
**Domain:** TypeScript CLI orchestrator wiring (Pi extension; `--force` flag onto the Phase 64 resolver gate)
**Confidence:** HIGH (codebase-grounded; every claim cites file:line in this repo)

## Summary

Phase 65 is the behavioral wiring of a per-invocation `--force` flag onto the
Phase 64 `requireForceInstallable` gate, which already exists in
`domain/resolver.ts` but currently has no production caller. The entire phase
reduces to three mechanical changes per command (`install`, `update`):
(1) parse `--force` in the edge handler, (2) thread a `force` boolean into the
orchestrator options object, (3) select the gate by that boolean
(`force ? requireForceInstallable : requireInstallable`). The materialize path
is reused unchanged because the resolver only ever puts *supported* component
kinds into `componentPaths`; the `unsupported` arm carries the same shape as
`installable` and the bridges only read `componentPaths`/`pluginRoot`, so an
unsupported plugin degrades naturally with no force-specific branch (D-65-02,
confirmed `[VERIFIED: codebase]`).

The one genuine type-level obstacle: the `unsupported` arm
(`ResolvedPluginUnsupported`) is NOT assignable to `ResolvedPluginInstallable`
because the `state` literal differs (`"unsupported"` vs `"installable"`), and
`InstallCtx.resolved`, `PluginPreflight.installable`, and every bridge `resolved`
parameter are typed to the narrow `ResolvedPluginInstallable`. The two arm
schemas are otherwise field-identical and none of those consumers read `state`,
so the fix is to widen the relevant local/field types to the union
`ResolvedPluginInstallable | ResolvedPluginUnsupported`. This is the load-bearing
implementation decision and the main source of diff.

FORCE-04 (no `Warning:` summary on any force path) is *already* satisfied
structurally: the standalone install success row and the update "updated" row
both stamp `severity: "info"`, and in standalone mode the only warning-bearing
collections (`bridgeWarnings`, `agentForeignFailures`) are dropped per D-19-01.
The phase obligation is to *verify by test* that nothing on the force path flips
to warning — not to add suppression logic.

**Primary recommendation:** Add a shared `MaterializablePlugin =
ResolvedPluginInstallable | ResolvedPluginUnsupported` type, widen the few
consumers that hold `resolved`/`installable`, select the gate by a threaded
`force` boolean, and extend the existing flag-parse helpers
(`extractLocalFlag` allow-list + `parsePositionalsWithFlags`) to recognize
`--force`. No new dependencies. No new severity logic.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-65-01 (Severity scope):** MINIMAL severity in this phase. Phase 65 ONLY
  guarantees no `Warning:` summary on any force path (FORCE-04); force-degrade
  rows render at info-level to the extent needed to honor that. The full
  severity ladder (SEV-01..05) is DEFERRED to Phase 69. Without `--force`, an
  `unsupported` plugin keeps the existing `requireInstallable` blocking
  behavior; the improved `--force`-citing error message is Phase 69, NOT here.
  **Do NOT research or implement SEV-01..05.**
- **D-65-02 (Materialize path):** Reuse the SINGLE existing supported-components
  materialize path. Both `installable` and `unsupported` arms expose the same
  supported-components list + `pluginRoot`; the existing materialize path only
  ever installs supported components, so the `unsupported` arm naturally skips
  the unsupported ones with NO separate force-degrade branch. The ONLY
  force-specific orchestrator difference is gate selection.
- **D-65-03 (Gate branching):** Select the gate by the force flag:
  `force ? requireForceInstallable(resolved, op) : requireInstallable(resolved, op)`.
  A fully-supported plugin resolves `installable`, so the wider force gate
  admits it unchanged — `--force` on a supported plugin is INERT and installs
  as `(installed)` (FORCE-01 no-op). NO special-casing/short-circuit for the
  no-op. `requireForceInstallable` still rejects `unavailable`/structural
  defects (FORCE-05).
- **D-65-04 (update --force target):** `update --force` degrades against the
  RESOLVED CANDIDATE (target/newer) version's supportability —
  `requireForceInstallable` is applied to the no-network-resolved candidate, NOT
  the currently-installed version's state.
- **D-65-05 (Flag parsing):** Parse `--force` in the install/update edge
  handlers following the EXISTING reinstall pattern — `extractLocalFlag(args,
  ctx, USAGE, [..., "--force"])` plus a boolean threaded into the orchestrator
  options object. Do NOT touch reinstall (its `--force` is removed in Phase 67,
  RINST-01).

### Claude's Discretion
- Exact orchestrator option field name for the force boolean, helper naming,
  and where in the install/update preflight the gate branch sits — provided
  behavior matches D-65-01..05.
- Usage-string and router help-text wording for the new `--force` on
  install/update (byte-exact catalog forms reconciled in Phase 70/DOC).

### Deferred Ideas (OUT OF SCOPE)
- Derived `force-installed`/`force-upgradable` state, `◉` glyph, will-force
  preview tokens, `info` dropped-component detail — Phase 66 (FSTAT-01..07).
- `--unsupported` list filter, `--force` completion sets, reinstall-as-repair
  (drop reinstall `--force`) — Phase 67 (LIST-01/02, RINST-01).
- Load-time backfill of previously-skipped components — Phase 68.
- Full force-path severity ladder SEV-01..05 (incl. the `--force`-citing error
  message for no-force unsupported) — Phase 69.
- Byte-exact token/catalog reconciliation + PRD §11 — Phase 70 (DOC-01/02).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| FORCE-01 | `install --force` on `unsupported` installs supported, skips unsupported; `--force` on fully-supported is a no-op `(installed)` | Gate selection at `install.ts:475`; `componentPaths` only ever holds supported kinds (resolver `decideResolution`/factory helpers); `unsupported` arm shape-identical to `installable` so materialize path is reused unchanged (D-65-02). No-op falls out because supported plugin resolves `installable`. |
| FORCE-02 | `update --force` on a plugin whose newer version became `unsupported` updates by degrading the now-unsupported components | Candidate resolved no-network at `update.ts:709` (`resolveStrict` on the synced clone's current `entry`); switch `requireInstallable`→`requireForceInstallable` at `update.ts:710` under force (D-65-04). |
| FORCE-03 | Without `--force`, install/update of `unsupported` still blocks/fails | Default branch keeps `requireInstallable` (narrows to `installable` only; throws `PluginShapeError{kind:"not-installable"/"no-longer-installable"}`) at `resolver.ts:1076`. |
| FORCE-04 | No `Warning:` summary emitted in any force path | Install success row stamps `severity:"info"` (`install.ts:1369`); update "updated" row stamps `severity:"info"` (`update.ts:1535`); standalone mode drops `bridgeWarnings`/`agentForeignFailures` per D-19-01 (`install.ts:1291-1306`). Summary severity is the MAX over caller-stamped `row.severity` (`notify.ts:cascadeSeverity`/`computeSeverity` ~2062-2104). Obligation is verification, not new logic. |
| FORCE-05 | `--force` never bypasses hard failures (`unavailable`/structural, NFR-10 containment, missing marketplace, unresolvable source) | `requireForceInstallable` narrows to `installable \| unsupported` only and still throws on `unavailable` (`resolver.ts:1102-1115`); structural precedence (D-64-07) means broken plugins resolve `unavailable`; marketplace-absent/config-invalid sentinels short-circuit BEFORE the gate (`install.ts:956-960`, `936-939`). |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| `--force` token parse & residual handling | Edge handler (`edge/handlers/plugin/{install,update}.ts`) | Edge shared helpers (`edge/handlers/shared.ts`, `edge/handlers/plugin/shared.ts`) | Flag parsing is the edge layer's job; PI-3/4/5 entity-shape notifications belong to the orchestrator (established pattern, `install.ts:11-16`). |
| Gate selection (force vs default) | Orchestrator (`orchestrators/plugin/{install,update}.ts`) | Domain resolver gates (`domain/resolver.ts`) | The orchestrator owns the install/update preflight; the resolver provides the two narrowing gates as pure type-assertions. |
| Degrade-not-block (skip unsupported) | Domain resolver (`componentPaths` excludes unsupported kinds) | Bridges (consume `componentPaths`) | The resolver already partitions supported vs unsupported at resolve time; the materialize path is a passive consumer (D-65-02). |
| No-`Warning:` guarantee | Orchestrator severity stamping (`severity:"info"` on success rows) | `shared/notify.ts` summary reducer | Severity is caller-stamped per row; the summary line is a MAX-reduce. Force paths must keep stamping info. |

## Standard Stack

No new libraries. This phase is internal wiring on the existing stack
(TypeScript strict, `node:test`, typebox for the resolver union). Per CLAUDE.md
the carry-forward stack is authoritative; nothing here adds or changes a
dependency. **Package Legitimacy Audit: N/A — zero external packages installed.**

## Key Source Findings (file:line evidence)

### 1. The two resolver gates — signatures, throw shape, consumption

`domain/resolver.ts`:

```ts
// resolver.ts:1076 — default path (FORCE-03)
export function requireInstallable(
  r: ResolvedPlugin,
  op: "install" | "update" = "install",
): asserts r is ResolvedPluginInstallable {
  if (r.state === "installable") return;
  throw new PluginShapeError({
    kind: op === "update" ? "no-longer-installable" : "not-installable",
    plugin: r.name,
    reasons: r.notes,
  });
}

// resolver.ts:1102 — the --force gate (FORCE-01/05); NO production caller yet
export function requireForceInstallable(
  r: ResolvedPlugin,
  op: "install" | "update" = "install",
): asserts r is ResolvedPluginInstallable | ResolvedPluginUnsupported {
  if (r.state === "installable" || r.state === "unsupported") return;
  throw new PluginShapeError({ /* same shape as above */ });
}
```

- Both are `asserts` (narrowing) functions — they mutate nothing, they narrow
  the caller's `resolved` binding in place and throw `PluginShapeError` on the
  rejected arms. `[VERIFIED: codebase resolver.ts:1076-1115]`
- `requireForceInstallable` already rejects `unavailable` and produces the same
  typed throw, so the no-force-blocks-hard-failure contract (FORCE-05) is
  pre-built; Phase 65 only has to *call* it. `[VERIFIED: codebase]`

### 2. The three-way union — arms are field-identical except `state`

`resolver.ts:64-128`. `ResolvedPluginInstallable` (`state:"installable"`) and
`ResolvedPluginUnsupported` (`state:"unsupported"`) carry an **identical field
set**: `name`, `pluginRoot`, `supported[]`, `unsupported[]`, `notes[]`,
`componentPaths`, `mcpServers`, optional `hooksConfigPath`, optional
`orphanRewake` (resolver.ts:64-103). `ResolvedPluginUnavailable`
(`state:"unavailable"`) is minimal: `state`, `name`, `notes` only — NO
`pluginRoot` (resolver.ts:111-116). `[VERIFIED: codebase]`

Consequence: `ResolvedPluginUnsupported` is structurally a superset-equal of
`ResolvedPluginInstallable` EXCEPT the discriminant literal, so TS will NOT
auto-assign one to the other. This is the type-widening crux (see Pitfall 1).

### 3. reinstall's `--force` extraction pattern (the template to mirror, D-65-05)

`edge/handlers/plugin/reinstall.ts`:
- Line 33: `const localFlag = extractLocalFlag(args, ctx, USAGE, ["--force"]);`
  — `--force` is added to the `passThroughLongFlags` allow-list so
  `extractLocalFlag` does not reject it as unknown.
- Lines 46-57: an inline loop over `parsed.positional` flips `force = true` on
  the `--force` token, rejects any other `--`-prefixed token, else pushes to
  `refs`.
- Lines 69-77: `await reinstallPlugins({ ..., ...(force && { force: true }), ... })`
  — conditional spread threads the boolean into the orchestrator options object.
  `[VERIFIED: codebase reinstall.ts:33,46-57,69-77]`

**Important divergence the planner must handle:** `install.ts` and `update.ts`
do NOT use the inline loop — they use `parseMapModelArgs` →
`parsePositionalsWithFlags` (`edge/handlers/plugin/shared.ts:49-112`), which
hardcodes only `--map-model` and rejects every other `--` flag at line 59-61.
So mirroring reinstall here means BOTH:
  (a) add `"--force"` to the `extractLocalFlag` allow-list (install.ts:45,
      update.ts:32), AND
  (b) teach `parsePositionalsWithFlags` (and the `ParsedPositionalsResult` /
      `ParsedMapModelArgs` return shapes) to recognize `--force` and return a
      `force` boolean alongside `mapModel`.
`[VERIFIED: codebase shared.ts:49-112; install.ts:45-87; update.ts:32-79]`

### 4. Orchestrator options objects — where `force` threads in

- `InstallPluginOptions` (`install.ts:242-279`): readonly fields incl.
  `mapModel?`, `local?`. Add `readonly force?: boolean;` here. The handler call
  site is `install.ts:78-88` (`installPlugin({ ... ...(mapModel && {mapModel:true}), ... })`).
- The install gate fires inside `runInstallLedger` at `install.ts:475`
  (`requireInstallable(resolved, "install")`), with `opts.mapModel` already
  threaded via `runInstallLedger`'s `InstallLedgerOptions` (`install.ts:339-346`,
  passed at `install.ts:941-953`). The `force` boolean must travel the same
  `InstallPluginOptions → InstallLedgerOptions` path to reach line 475.
- `UpdatePluginsOptions` (`update.ts:161-184`): readonly `mapModel?`, `local?`.
  Add `readonly force?: boolean;`. Handler call site `update.ts:71-79`. The gate
  fires in `preflightUpdate` at `update.ts:710`; `force` must reach the
  `ThreePhaseArgs`/preflight path (mirror how `mapModel` flows via
  `args.mapModel`, `update.ts:304,791`).
`[VERIFIED: codebase]`

### 5. Materialize path reuses supported-only components (D-65-02 confirmed)

- `InstallCtx.resolved` is typed `ResolvedPluginInstallable` (`install.ts:292`).
- The 5 phases (`skills`/`commands`/`agents`/`hooks`/`mcp`,
  `install.ts:550-735`) pass `c.resolved` to bridge `prepareStage*` functions,
  which read `c.resolved.pluginRoot` + `c.resolved.componentPaths` /
  `c.resolved.mcpServers`. `[VERIFIED: codebase install.ts:550-735]`
- `componentPaths` is populated by the resolver ONLY for supported path-kinds
  (`SUPPORTED_COMPONENT_PATH_KINDS`); unsupported kinds go into `unsupported[]` +
  `notes[]` (`contains <kind>`), never into `componentPaths`
  (`resolver.ts:236,1042-1057`; test `resolver-strict.test.ts:450-466`).
  Therefore the SAME materialize loop, run against the `unsupported` arm,
  installs exactly the supported components and skips the rest — no branch.
  `[VERIFIED: codebase + test]`

### 6. update candidate is resolved no-network (D-65-04 confirmed)

`update.ts:707-744` `preflightUpdate`:
```ts
let installable: ResolvedPluginInstallable;
const resolved = await resolveStrict(entry, { marketplaceRoot: mp.marketplaceRoot }); // line 709
requireInstallable(resolved, "update"); // line 710 — switch to requireForceInstallable under force
installable = resolved;                  // line 711 — widen local type to the union
```
`entry` is the marketplace clone's *current* (candidate) manifest entry; the
sync/clone (network) already happened earlier in `updatePlugins`
(`PUP-2 syncCloneOnce`). `resolveStrict` itself touches no network (architecture
test `no-orchestrator-network.test.ts`). So applying `requireForceInstallable`
at line 710 degrades against the candidate's supportability exactly as D-65-04
requires. `PluginPreflight.installable` is typed `ResolvedPluginInstallable`
(`update.ts:613`) and consumed by `prepareUpdateHandles` (`update.ts:757-800`)
reading `.pluginRoot`/`.mcpServers`/`resolved` — same widening as install.
`[VERIFIED: codebase update.ts:609-800]`

### 7. FORCE-04 — where a `Warning:` summary comes from, and why force paths emit none

- Severity is **caller-stamped per row** (the notification-refactor workstream,
  already shipped). The summary line's severity is the numeric MAX over rows'
  `severity` (`notify.ts:cascadeSeverity` ~2062-2096, `computeSeverity` ~2099).
  A `Warning:` summary appears iff some row stamps `severity:"warning"` (or
  `"error"`). `[VERIFIED: codebase notify.ts:2019-2104]`
- Install success row: `PluginInstalledMessage` stamps `severity:"info"`
  (`install.ts:1362-1371`). In **standalone** mode the warning-bearing
  collections are explicitly DROPPED per D-19-01 —
  `agentForeignFailures` (`install.ts:1286-1295`) and `bridgeWarnings`
  (`install.ts:1302-1307`) only push into `postCommitWarnings` when
  `orchestrated`. `[VERIFIED: codebase]`
- Update "updated" row stamps `severity:"info"` (`update.ts:1525-1537`).
  `[VERIFIED: codebase]`
- **Conclusion:** a direct `install --force` / `update --force` of an
  `unsupported` plugin reuses these info-severity success rows and (standalone)
  emits no warnings. FORCE-04 needs a *guard test*, not new suppression code.
  Phase 65 must NOT add a dropped-component row (that is the Phase 66 `info`
  detail / Phase 69 severity work). `[VERIFIED: codebase + D-65-01]`

## Architecture Patterns

### Pattern 1: Gate-selection by threaded boolean (D-65-03)
**What:** A single ternary at the existing `requireInstallable` call site.
**Where:** `install.ts:475`, `update.ts:710`.
**Example (install):**
```ts
// FORCE-01/03/05: --force widens the gate to admit the force-degradable
// `unsupported` arm; the default gate still blocks it. Both reject
// `unavailable` (FORCE-05).
if (opts.force === true) {
  requireForceInstallable(resolved, "install");
} else {
  requireInstallable(resolved, "install");
}
// `resolved` now narrowed to ResolvedPluginInstallable | ResolvedPluginUnsupported
const installable: MaterializablePlugin = resolved;
```

### Pattern 2: Union widening via a shared type alias (the type crux)
**What:** Introduce `export type MaterializablePlugin = ResolvedPluginInstallable
| ResolvedPluginUnsupported;` in `domain/resolver.ts`, and widen the
`resolved`/`installable` holders that the force path now flows through:
`InstallCtx.resolved` (install.ts:292), the `installable` local (install.ts:478),
`PluginPreflight.installable` (update.ts:613), the `installable` local
(update.ts:707), and the bridge `resolved` params
(`bridges/{skills,commands,agents}/{types,discover}.ts`,
`orchestrators/plugin/shared.ts:491,518`). Bodies need NO change — none read
`state`. `[VERIFIED: codebase shared.ts:489-525]`
**When to use:** Every consumer the force path reaches that is currently typed
to the narrow `ResolvedPluginInstallable`.
**Tradeoff (discretion):** Alternatively keep the narrow types and re-tag the
`unsupported` arm to an `installable`-shaped local in the orchestrator only.
Rejected as a recommendation — it discards the discriminant information and
risks a future reader treating a degraded install as fully supported. Prefer the
explicit union alias.

### Anti-Patterns to Avoid
- **Adding a force-degrade materialize branch.** Violates D-65-02; the existing
  loop already degrades correctly because `componentPaths` excludes unsupported
  kinds.
- **Short-circuiting the supported-plugin no-op.** D-65-03 forbids special-casing
  `--force` on a fully-supported plugin; it must flow through the wider gate and
  install as `(installed)`.
- **Emitting a dropped-component row or any warning on the force path.** Belongs
  to Phase 66/69. Keep success rows at `severity:"info"` (FORCE-04, D-65-01).
- **Touching reinstall.** Its `--force` is a different semantic, removed in
  Phase 67 (D-65-05).
- **Citing GSD phase/plan in comments or test titles.** Use D-65-NN / FORCE-NN /
  NFR-N IDs only (`.claude/rules/typescript-comments.md`).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Force/default gate | A new inline `if (r.state===…) throw` | `requireForceInstallable` / `requireInstallable` (resolver.ts:1076,1102) | Already built, test-covered, NFR-7-correct typed throws. |
| Skip unsupported components | A filter over component lists in the orchestrator | The resolver's `componentPaths` partition | Resolver already excludes unsupported kinds; re-filtering risks divergence. |
| Suppress the `Warning:` summary on force | Post-hoc severity downgrade | Keep stamping `severity:"info"` on the success row | Summary severity is a MAX-reduce; emit no warning row and the summary stays clean. |
| `--force` token scan | A bespoke arg parser | Extend `extractLocalFlag` allow-list + `parsePositionalsWithFlags` | One canonical scanner already exists; reinstall already proves the pattern. |

## Runtime State Inventory

> This phase adds an in-memory per-invocation boolean and a gate branch. It
> persists NO new state, renames nothing, and migrates nothing.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None — `--force` is per-invocation; force-state is DERIVED (FSTAT-01, Phase 66), no persisted `forceInstalled` flag (explicitly out of scope, REQUIREMENTS.md:76). | None |
| Live service config | None — no external service touched. | None |
| OS-registered state | None. | None |
| Secrets/env vars | None. | None |
| Build artifacts | None — pure source change; `npm run check` recompiles. | None |

**Verified by:** REQUIREMENTS.md Out-of-Scope row (persisted force flag), D-65-01
(no state migration), and absence of any `state.json` schema change in the phase
scope.

## Common Pitfalls

### Pitfall 1: `unsupported` arm not assignable to `ResolvedPluginInstallable`
**What goes wrong:** `requireForceInstallable` narrows `resolved` to
`ResolvedPluginInstallable | ResolvedPluginUnsupported`, but the assignment
`const installable: ResolvedPluginInstallable = resolved;` (install.ts:478) and
the `InstallCtx.resolved` / `PluginPreflight.installable` fields will fail to
typecheck because the `unsupported` arm's `state` literal differs.
**Why it happens:** The two schemas are field-identical; TS still blocks the
assignment on the discriminant literal alone.
**How to avoid:** Widen the holding types to a shared union alias
(`MaterializablePlugin`); do NOT cast. Bodies are unchanged because none read
`state`.
**Warning signs:** `npm run typecheck` errors of the form `Type
'ResolvedPluginUnsupported' is not assignable to type 'ResolvedPluginInstallable'`
at install.ts/update.ts and the bridge boundaries.

### Pitfall 2: install/update don't use reinstall's parse loop
**What goes wrong:** Adding `--force` only to the `extractLocalFlag` allow-list
makes `parsePositionalsWithFlags` reject `--force` as an unknown flag
(shared.ts:59-61), failing every `install --force` with a usage error.
**Why it happens:** install/update route through `parseMapModelArgs`, not
reinstall's inline loop; the shared helper hardcodes `--map-model`.
**How to avoid:** Extend both seams: allow-list in `extractLocalFlag`
(install.ts:45 / update.ts:32) AND recognition in `parsePositionalsWithFlags` +
its result types. Or add an inline `--force` scan in each handler before the
shared parse. (Discretion: prefer extending the shared helper so both commands
share one definition.)
**Warning signs:** `Unknown flag: "--force".` usage error in the
`install --force`/`update --force` handler tests.

### Pitfall 3: applying the force gate to the wrong update version
**What goes wrong:** Degrading against the *installed* version's state instead of
the candidate's would violate D-65-04 and could degrade a plugin whose candidate
is actually fully supported (or vice-versa).
**Why it happens:** Two resolutions exist in the update flow; the gate must wrap
the candidate resolve at update.ts:709-710, which already operates on the synced
clone's current entry.
**How to avoid:** Place the `requireForceInstallable` branch at update.ts:710
(the candidate resolve), exactly where `requireInstallable` lives today.
**Warning signs:** A test where the candidate is supported but the installed was
unsupported (or vice-versa) shows the wrong degrade/block decision.

### Pitfall 4: accidentally emitting a warning on the force path
**What goes wrong:** Stamping a force-degrade row at `severity:"warning"` (e.g.
copying SEV ladder ideas from Phase 69) re-introduces the `Warning:` summary that
FORCE-04 forbids.
**Why it happens:** Confusing Phase 65's minimal guarantee with the Phase 69
severity ladder.
**How to avoid:** Keep the success rows at `severity:"info"` (install.ts:1369 /
update.ts:1535) unchanged; add no new warning rows. Add a guard test asserting no
emitted message has `severity:"warning"` on the force path.
**Warning signs:** A rendered summary line beginning `Warning:` in a force test.

## Code Examples

### Resolver gate (existing, to be called)
```ts
// Source: domain/resolver.ts:1102 (VERIFIED)
export function requireForceInstallable(
  r: ResolvedPlugin,
  op: "install" | "update" = "install",
): asserts r is ResolvedPluginInstallable | ResolvedPluginUnsupported {
  if (r.state === "installable" || r.state === "unsupported") return;
  throw new PluginShapeError({
    kind: op === "update" ? "no-longer-installable" : "not-installable",
    plugin: r.name,
    reasons: r.notes,
  });
}
```

### Handler flag-threading (mirror of reinstall, D-65-05)
```ts
// Source pattern: edge/handlers/plugin/reinstall.ts:33,69-77 (VERIFIED)
const localFlag = extractLocalFlag(args, ctx, USAGE, ["--map-model", "--force"]);
// ...after parse, with `force` recovered from the positional scan:
await installPlugin({
  ctx, pi, scope: flagged.scope ?? "user", cwd: ctx.cwd,
  marketplace: ref.marketplace, plugin: ref.plugin,
  ...(mapModel && { mapModel: true }),
  ...(force && { force: true }),
  ...(localFlag.local && { local: true }),
});
```

### Unsupported-plugin resolver fixture (for orchestrator force tests)
```ts
// Source: tests/domain/resolver-strict.test.ts:450-466 (VERIFIED)
// A plugin.json declaring experimental themes/monitors resolves `unsupported`
// (no structural defect). Seed this into a marketplace clone to drive a
// force install/update degrade test.
JSON.stringify({ name: "p1", experimental: { themes: "./themes", monitors: "./monitors.json" } });
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Binary `installable: true \| false` resolver | Three-way `state` union + two gates | Phase 64 (this milestone) | `requireForceInstallable` exists and is the sole new caller target for Phase 65. |
| Content-inferred summary severity | Caller-stamped per-row `severity`, MAX-reduced | notification-refactor workstream (pre-milestone) | FORCE-04 is satisfied by stamping `info`, not by string-suppressing `Warning:`. |

**Deprecated/outdated:** none relevant. The v1.15-era persisted `forceInstalled`
sticky flag was built and removed; do NOT rebuild it (REQUIREMENTS.md:76).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | `node:test` (built-in), Node >= 20.19.0; native TS strip on 22.18+ |
| Config file | none — glob in `package.json` `test` script |
| Quick run command | `node --test "tests/orchestrators/plugin/{install,update}.test.ts"` |
| Quick run (handlers) | `node --test "tests/edge/handlers/plugin/{install,update}.test.ts"` |
| Full suite command | `npm run check` (typecheck + lint + format + test + integration) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| FORCE-01 | `install --force` on `unsupported` installs supported, skips unsupported; assert state record + on-disk artefacts + no `unsupported` kind materialized | integration (orchestrator) | `node --test tests/orchestrators/plugin/install.test.ts` | ✅ exists (add cases) |
| FORCE-01 (no-op) | `install --force` on fully-supported installs as `(installed)`, byte-identical to non-force | integration (orchestrator) | same | ✅ exists (add case) |
| FORCE-01 (parse) | handler threads `force:true` into `installPlugin` options | unit (handler shim) | `node --test tests/edge/handlers/plugin/install.test.ts` | ✅ exists (add case) |
| FORCE-02 | `update --force` where candidate became `unsupported` updates by degrading | integration (orchestrator) | `node --test tests/orchestrators/plugin/update.test.ts` | ✅ exists (add case) |
| FORCE-02 (parse) | handler threads `force:true` into `updatePlugins` options | unit (handler shim) | `node --test tests/edge/handlers/plugin/update.test.ts` | ✅ exists (add case) |
| FORCE-03 | without `--force`, `unsupported` install/update still blocks (`PluginShapeError` → `(unavailable)`/`(skipped) {no longer installable}` surface) | integration (orchestrator) | both orchestrator tests | ✅ exists (assert existing block behavior holds under the new code) |
| FORCE-04 | no emitted message carries `severity:"warning"` and no rendered summary begins `Warning:` on either force path | integration (orchestrator) | both orchestrator tests | ✅ exists (add severity assertion) |
| FORCE-05 | `--force` on `unavailable` (structural defect / NFR-10 escape / non-path source) still blocks; missing marketplace still blocks | integration (orchestrator) + unit (gate) | orchestrator tests + `node --test tests/domain/resolver-strict.test.ts` | ✅ exists (gate negative already covered; add orchestrator force-can't-bypass case) |

### Sampling Rate
- **Per task commit:** `node --test "tests/orchestrators/plugin/{install,update}.test.ts" "tests/edge/handlers/plugin/{install,update}.test.ts"`
- **Per wave merge:** `npm test`
- **Phase gate:** `npm run check` green before `/gsd-verify-work`.

### Wave 0 Gaps
- None — `tests/orchestrators/plugin/install.test.ts`,
  `tests/orchestrators/plugin/update.test.ts`,
  `tests/edge/handlers/plugin/install.test.ts`,
  `tests/edge/handlers/plugin/update.test.ts`, and
  `tests/domain/resolver-strict.test.ts` all exist with the fixture helpers and
  notify-recorder harness needed. New cases are additive. The unsupported-plugin
  fixture recipe is proven (`resolver-strict.test.ts:450-466`).

## Environment Availability

Skipped — pure code/config change. No external tools, services, or runtimes
beyond the already-present Node + `node:test` toolchain.

## Security Domain

`security_enforcement` is not set to `false` in config, so this is noted but the
phase surface is internal CLI orchestration with no new input boundary,
auth, crypto, or network path.

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V5 Input Validation | yes (narrow) | `--force` is a boolean token; existing `extractLocalFlag` / `parsePositionalsWithFlags` reject unknown flags with `notifyUsageError`. No free-form input added. |
| V6 Cryptography | no | none |
| V2/V3/V4 Auth/Session/Access | no | CLI-local, no auth surface |

**NFR-7 (the one security-adjacent invariant in scope):** the union widening
must NOT re-admit reading `pluginRoot` off an `unavailable` plugin. The chosen
`MaterializablePlugin = installable | unsupported` alias EXCLUDES `unavailable`,
preserving the compile-time guarantee. `requireForceInstallable` cannot narrow to
`unavailable`. Add/keep a type-level test (cf. `tests/domain/resolver.types.test.ts`)
asserting the gate's narrowed type excludes `unavailable`.

**NFR-5 (network policy):** `install`/`update --force` add no network access; the
candidate resolve at update.ts:709 runs against the already-synced clone. The
architecture test `tests/architecture/no-orchestrator-network.test.ts` continues
to guard this.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| — | (none) | — | All claims are codebase-verified at cited file:line; no `[ASSUMED]` claims. |

**This table is empty:** every factual claim was verified against the repository
in this session. The only open judgment is a Claude's-Discretion design choice
(shared union-alias widening vs. local re-tag), surfaced in Pattern 2.

## Open Questions (RESOLVED)

1. **Where exactly the `force` boolean enters `parsePositionalsWithFlags`'s
   return shape.**
   - RESOLVED: Plan 65-01 Task 2 extends the shared helper
     (`ParsedPositionalsResult` gains `force`), threading it through
     `parseMapModelArgs` — the recommended lower-divergence option.
   - What we know: install/update use the shared `parseMapModelArgs` path, not
     reinstall's inline loop; the shared helper must learn `--force`.
   - What's unclear: whether to extend the shared helper (one definition, both
     commands) or add a per-handler inline `--force` scan (closer to reinstall's
     literal pattern).
   - Recommendation: extend the shared helper (`ParsedPositionalsResult` gains
     `force: boolean`); it is the lower-divergence option and both commands need
     identical semantics. Left to planning per D-65-05 discretion.

2. **Whether the bridge `resolved` param types are widened or a single
   orchestrator-local re-tag is used.**
   - RESOLVED: Plan 65-01 Task 1 widens to the shared `MaterializablePlugin`
     union alias (excludes `unavailable`, keeping NFR-7 compile-enforced).
   - What we know: bridges read only `pluginRoot`/`componentPaths`/`mcpServers`,
     never `state`.
   - Recommendation: widen to the shared `MaterializablePlugin` union alias
     (Pattern 2); avoids information loss. Planning may choose the local re-tag
     if it prefers a smaller diff, provided NFR-7 (no `unavailable` `pluginRoot`)
     stays compile-enforced.

## Sources

### Primary (HIGH confidence) — all codebase, verified this session
- `extensions/pi-claude-marketplace/domain/resolver.ts:64-128,1076-1115` — union
  arms + both gates.
- `extensions/pi-claude-marketplace/edge/handlers/plugin/reinstall.ts:33,46-57,69-77`
  — `--force` extraction/threading template.
- `extensions/pi-claude-marketplace/edge/handlers/plugin/install.ts:45-88` and
  `update.ts:32-79` — current handler parse paths (`extractLocalFlag` +
  `parseMapModelArgs`).
- `extensions/pi-claude-marketplace/edge/handlers/shared.ts:40-83` and
  `edge/handlers/plugin/shared.ts:49-112` — `extractLocalFlag` +
  `parsePositionalsWithFlags` / `parseMapModelArgs`.
- `extensions/pi-claude-marketplace/orchestrators/plugin/install.ts:242-279,292,469-546,1286-1371`
  — options, `InstallCtx`, gate call, materialize phases, success-row severity.
- `extensions/pi-claude-marketplace/orchestrators/plugin/update.ts:161-184,609-744,757-800,1518-1573`
  — options, preflight + candidate gate, prep handles, updated-row severity.
- `extensions/pi-claude-marketplace/orchestrators/plugin/shared.ts:489-525` —
  `resolvePluginVersion` / `pickAgentsSourceDir` (read no `state`).
- `extensions/pi-claude-marketplace/shared/notify.ts:2019-2104` — caller-stamped
  severity + MAX-reduce summary model.
- `tests/domain/resolver-strict.test.ts:450-466,597+` — unsupported fixture +
  gate tests; `tests/orchestrators/plugin/{install,update}.test.ts` and
  `tests/edge/handlers/plugin/{install,update}.test.ts` — harness patterns.

### Secondary
- `.planning/phases/65-force-install-update/65-CONTEXT.md` (D-65-01..05).
- `.planning/phases/64-resolver-three-way-state/64-CONTEXT.md` (D-64-01..07).
- `.planning/REQUIREMENTS.md` (FORCE-01..05, Out-of-Scope rows).
- `.claude/rules/typescript-comments.md` (comment/test-title ID policy).

## Metadata

**Confidence breakdown:**
- Stack: HIGH — no new deps; existing toolchain confirmed in package.json.
- Architecture/wiring: HIGH — every call site and type read at file:line.
- Pitfalls: HIGH — type-widening and parse-helper divergence both confirmed by
  reading the actual consumer types and the `parseMapModelArgs` hardcode.
- FORCE-04 mechanism: HIGH — success-row severities and D-19-01 drop confirmed.

**Research date:** 2026-06-27
**Valid until:** 2026-07-27 (stable internal codebase; re-verify line numbers if
Phase 64 follow-ups land first).
