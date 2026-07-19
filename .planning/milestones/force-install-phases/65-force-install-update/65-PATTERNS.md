# Phase 65: Force Install & Update - Pattern Map

**Mapped:** 2026-06-27
**Files analyzed:** 13 (8 source modified, 1 source widened-as-needed, 4 test)
**Analogs found:** 13 / 13 (all in-repo; this is a wiring phase — every analog is an existing sibling or the file itself)

> Comment / test-title policy (`.claude/rules/typescript-comments.md`): anchor
> with `D-65-NN`, `FORCE-NN`, `NFR-N`, `D-64-NN`, `D-19-01` IDs only. NEVER cite
> GSD phase/plan/wave/task in code comments or `test(...)` titles.

## File Classification

| File (modified) | Role | Data Flow | Closest Analog | Match Quality |
|-----------------|------|-----------|----------------|---------------|
| `domain/resolver.ts` | model (typebox union) | transform | self — existing `ResolvedPlugin*` type-alias exports (resolver.ts:125-128) | exact (same file) |
| `edge/handlers/plugin/install.ts` | route/edge handler | request-response | `edge/handlers/plugin/reinstall.ts` (`--force` token) + own `mapModel` thread | exact |
| `edge/handlers/plugin/update.ts` | route/edge handler | request-response | `reinstall.ts` + own `mapModel` thread | exact |
| `edge/handlers/plugin/shared.ts` | utility (edge parse helper) | transform | self — existing `--map-model` recognition (shared.ts:54-67, 87-112) | exact (same file) |
| `orchestrators/plugin/install.ts` | orchestrator/service | CRUD (materialize) | self — `requireInstallable` site (install.ts:475) + `mapModel` thread (242→345→949) | exact (same file) |
| `orchestrators/plugin/update.ts` | orchestrator/service | CRUD (materialize) | self — `requireInstallable` preflight site (update.ts:710) + `mapModel` thread (177→304/591→791) | exact (same file) |
| `orchestrators/plugin/shared.ts` | utility (resolver adapters) | transform | self — `resolvePluginVersion` / `pickAgentsSourceDir` params (shared.ts:489,518) | exact (same file) |
| `bridges/{skills,commands,agents}/{types,discover}.ts` | bridge/adapter | transform | self — 5 `resolved: ResolvedPluginInstallable` param sites | exact (same file) |
| `tests/edge/handlers/plugin/install.test.ts` | test (handler shim) | request-response | self — notify-recorder `makeCtx` + existing shim cases | exact (same file) |
| `tests/edge/handlers/plugin/update.test.ts` | test (handler shim) | request-response | self / sibling install handler test | exact |
| `tests/orchestrators/plugin/install.test.ts` | test (integration) | CRUD | self — `seedPathMarketplaceWithPlugin` + `makeCtx` + `installPlugin` cases | exact (same file) |
| `tests/orchestrators/plugin/update.test.ts` | test (integration) | CRUD | self / sibling install orchestrator test | exact |

This is a wiring phase: there is no NEW file. Every change widens, branches, or
adds a case to existing code. The analogs are therefore the in-place patterns the
new lines must copy, plus the one cross-file template (`reinstall.ts` `--force`).

## Pattern Assignments

### `domain/resolver.ts` (model, transform) — add the union alias

**Analog:** the existing per-arm type-alias exports.

**Existing arm types** (resolver.ts:125-128) — the `unsupported` arm is
field-identical to `installable` except the `state` literal (schemas at
resolver.ts:64-103), and the `unavailable` arm has NO `pluginRoot` (resolver.ts:111-116):
```ts
export type ResolvedPluginInstallable = Type.Static<typeof ResolvedPluginInstallableSchema>;
export type ResolvedPluginUnsupported = Type.Static<typeof ResolvedPluginUnsupportedSchema>;
export type ResolvedPluginUnavailable = Type.Static<typeof ResolvedPluginUnavailableSchema>;
export type ResolvedPlugin = Type.Static<typeof ResolvedPluginSchema>;
```

**Add (Pattern 2 / type crux):** a shared alias EXCLUDING `unavailable` so NFR-7
(no `pluginRoot` off a structurally-broken plugin) stays compile-enforced:
```ts
// NFR-7: the force-materializable arms. EXCLUDES `unavailable` (no pluginRoot),
// so no consumer can read a filesystem root off a structurally-broken plugin.
export type MaterializablePlugin = ResolvedPluginInstallable | ResolvedPluginUnsupported;
```

**Existing gates to CALL (do not modify)** — `requireForceInstallable` already
exists and already rejects `unavailable` (resolver.ts:1102; FORCE-05 pre-built):
```ts
export function requireForceInstallable(
  r: ResolvedPlugin,
  op: "install" | "update" = "install",
): asserts r is ResolvedPluginInstallable | ResolvedPluginUnsupported {
  if (r.state === "installable" || r.state === "unsupported") return;
  throw new PluginShapeError({ /* kind: op==="update" ? "no-longer-installable" : "not-installable" */ });
}
```

---

### `edge/handlers/plugin/install.ts` (edge handler, request-response)

**Analog:** `reinstall.ts` (`--force` token) + the file's own `mapModel` threading.

**Allow-list extension** — add `"--force"` to the `extractLocalFlag` pass-through
list (currently install.ts:45):
```ts
// current:  const localFlag = extractLocalFlag(args, ctx, USAGE, ["--map-model"]);
// becomes:  const localFlag = extractLocalFlag(args, ctx, USAGE, ["--map-model", "--force"]);
```
Mirror of `reinstall.ts:33`: `extractLocalFlag(args, ctx, USAGE, ["--force"])`.

**Conditional-spread threading** (install.ts:78-87) — copy the existing `mapModel`
spread exactly, adding a `force` sibling (the `force` boolean comes from the shared
parse, see `shared.ts` below):
```ts
await installPlugin({
  ctx, pi, scope: flagged.scope ?? "user", cwd: ctx.cwd,
  marketplace: ref.marketplace, plugin: ref.plugin,
  ...(mapModel && { mapModel: true }),
  ...(force && { force: true }),          // NEW (D-65-05) — same shape as mapModel
  ...(localFlag.local && { local: true }),
});
```
This is byte-for-byte the conditional-spread template proven at
`reinstall.ts:69-77` (`...(force && { force: true })`).

**Also bump USAGE** (install.ts:31-32) to add the `[--force]` token (wording is
Claude's discretion; byte-exact catalog form reconciled in Phase 70/DOC).

---

### `edge/handlers/plugin/update.ts` (edge handler, request-response)

**Analog:** identical to install handler. Same two edits:
- allow-list at update.ts:32 → `["--map-model", "--force"]`.
- conditional-spread at update.ts:71-79 → add `...(force && { force: true })`
  next to the existing `...(mapModel && { mapModel: true })`.
- USAGE at update.ts:23-24 → add `[--force]`.

`force` is recovered from the shared `parseMapModelArgs` return (below).

---

### `edge/handlers/plugin/shared.ts` (edge parse helper, transform) — the load-bearing parse seam

**Analog:** the file's own `--map-model` recognition. install/update do NOT use
reinstall's inline loop; they route through `parseMapModelArgs` →
`parsePositionalsWithFlags`, which hardcodes ONLY `--map-model` and REJECTS every
other `--` token (shared.ts:59-61). So `--force` must be taught HERE too, or
`install --force` fails with `Unknown flag: "--force".` (Pitfall 2).

**Result-shape extension** (shared.ts:38-41, 70-74) — add `force`:
```ts
export interface ParsedPositionalsResult {
  readonly nonFlagPositionals: readonly string[];
  readonly mapModel: boolean;
  readonly force: boolean;          // NEW
}
export interface ParsedMapModelArgs {
  readonly scope?: Scope;
  readonly nonFlagPositionals: readonly string[];
  readonly mapModel: boolean;
  readonly force: boolean;          // NEW
}
```

**Scanner extension** (shared.ts:54-67) — add a `--force` arm BEFORE the
unknown-flag rejection, mirroring the `--map-model` arm exactly:
```ts
let mapModel = false;
let force = false;                              // NEW
const nonFlagPositionals: string[] = [];
for (const token of tokens) {
  if (token === "--map-model") {
    mapModel = true;
  } else if (token === "--force") {             // NEW arm
    force = true;
  } else if (token.startsWith("--")) {
    notifyUsageError(ctx, { message: `Unknown flag: "${token}".`, usage });
    return undefined;
  } else {
    nonFlagPositionals.push(token);
  }
}
return { nonFlagPositionals, mapModel, force };  // thread force out
```

**Aggregator** (shared.ts:107-111) — pass `force` through:
```ts
return {
  nonFlagPositionals: flagged.nonFlagPositionals,
  mapModel: flagged.mapModel,
  force: flagged.force,             // NEW
  ...(parsed.scope !== undefined && { scope: parsed.scope }),
};
```
Handlers then destructure `const { nonFlagPositionals, mapModel, force } = flagged;`.

---

### `orchestrators/plugin/install.ts` (orchestrator, CRUD) — gate branch + type widening + force threading

**Analog:** the existing `requireInstallable` site and the `mapModel`
`Options → LedgerOptions` threading path in the same file.

**1. Options field** (install.ts:242-279, mirror `mapModel` at :257):
```ts
export interface InstallPluginOptions {
  // ...
  readonly mapModel?: boolean;
  readonly force?: boolean;   // NEW (D-65-03) — --force widens the install gate
  // ...
}
```

**2. Ledger options + thread-through** — `mapModel` already travels
`InstallPluginOptions`(:257) → `InstallLedgerOptions`(:345) → call site
`runInstallLedger({ ..., ...(opts.mapModel !== undefined && { mapModel: opts.mapModel }) })`
(install.ts:949). Add a `readonly force?: boolean;` to `InstallLedgerOptions`
(install.ts:339-347) and the same conditional spread at the :941-953 call site.

**3. Gate branch** — replace the unconditional gate at install.ts:475-478
(Pattern 1, D-65-03/FORCE-01/03/05):
```ts
const resolved = await resolveStrict(entry, { marketplaceRoot: sourceMp.marketplaceRoot });
// FORCE-01/03/05: --force widens the gate to admit the `unsupported` arm; the
// default gate still blocks it. Both reject `unavailable` (FORCE-05).
if (opts.force === true) {
  requireForceInstallable(resolved, "install");
} else {
  requireInstallable(resolved, "install");
}
const installable: MaterializablePlugin = resolved;   // widened from ResolvedPluginInstallable
```
Add `requireForceInstallable` and `MaterializablePlugin` to the existing
`../../domain/resolver.ts` import (install.ts:103).

**4. Type widening (Pitfall 1)** — change `InstallCtx.resolved` (install.ts:292)
from `ResolvedPluginInstallable` to `MaterializablePlugin`. Bodies unchanged: the
5 materialize phases (install.ts:550-735) read only `.pluginRoot` /
`.componentPaths` / `.mcpServers`, never `.state`. Because `componentPaths` only
ever holds SUPPORTED kinds (resolver partitions at resolve time), the SAME
materialize loop run against the `unsupported` arm installs the supported
components and skips the rest — NO force-degrade branch (D-65-02).

**5. FORCE-04 (no new code)** — leave the success row at `severity: "info"`
(install.ts:1369) untouched; standalone mode already drops `bridgeWarnings` /
`agentForeignFailures` per D-19-01. Do NOT add a dropped-component or warning row.

---

### `orchestrators/plugin/update.ts` (orchestrator, CRUD) — candidate-gate branch + widening + threading

**Analog:** the file's own `requireInstallable` preflight site and `mapModel`
`Options → ThreePhaseArgs` threading.

**1. Options field** (update.ts:161-184, mirror `mapModel` at :177):
```ts
readonly force?: boolean;   // NEW (D-65-04) — degrade against the resolved candidate
```

**2. Thread to preflight** — `mapModel` flows `UpdatePluginsOptions`(:177) →
`ThreePhaseArgs.mapModel`(:591) → consumed as `args.mapModel ?? false`
(update.ts:304, 791). Add `readonly force?: boolean;` to `ThreePhaseArgs`
(update.ts:552-591, near :591) and set it from `opts.force` where `args` is built,
and from the handler call site (update.ts:71-79).

**3. Gate branch at the CANDIDATE resolve** (D-65-04) — replace update.ts:708-711
INSIDE `preflightUpdate`. The candidate `entry` is the synced clone's CURRENT
manifest entry; `resolveStrict` touches no network (NFR-5):
```ts
const entry: PluginEntry = entryRaw;
let installable: MaterializablePlugin;          // widened from ResolvedPluginInstallable
try {
  const resolved = await resolveStrict(entry, { marketplaceRoot: mp.marketplaceRoot });
  // FORCE-02/05: degrade against the candidate's supportability under --force;
  // default path still blocks `no-longer-installable`. Both reject `unavailable`.
  if (args.force === true) {
    requireForceInstallable(resolved, "update");
  } else {
    requireInstallable(resolved, "update");
  }
  installable = resolved;
} catch (err) {
  // unchanged: PluginShapeError -> (skipped) {no longer installable}
}
```
KEEP the existing catch arm (update.ts:712-728) verbatim — without `--force` an
`unsupported` candidate still throws and renders `(skipped) {no longer installable}`
(FORCE-03).

**4. Type widening (Pitfall 1)** — change `PluginPreflight.installable`
(update.ts:613) and the `let installable` local (update.ts:707) to
`MaterializablePlugin`. `prepareUpdateHandles` (update.ts:757-800) reads only
`.pluginRoot` / `.mcpServers` / `.componentPaths` — bodies unchanged.

**5. FORCE-04** — leave the "updated" row at `severity: "info"` (update.ts:1535)
untouched. No new warning row.

---

### `orchestrators/plugin/shared.ts` + bridge param sites (utility/adapter, transform) — type widening only

**Analog:** the sites themselves. Widen `ResolvedPluginInstallable` →
`MaterializablePlugin` (none read `.state`):
- `resolvePluginVersion(entry, installable: ...)` (shared.ts:489-492) — reads
  `installable.pluginRoot` only.
- `pickAgentsSourceDir(installable: ...)` (shared.ts:518) — reads
  `installable.componentPaths.agents` + `.pluginRoot` only.
- bridge `resolved` params: `bridges/agents/types.ts:72`,
  `bridges/commands/discover.ts:69`, `bridges/commands/types.ts:39`,
  `bridges/skills/types.ts:33`, `bridges/skills/discover.ts:91`.

Discretion (Open Question 2): planner MAY instead keep narrow bridge types and
re-tag locally in the orchestrator. Research RECOMMENDS the union widen (no info
loss). Either is acceptable provided NFR-7 stays compile-enforced (the alias
excludes `unavailable`).

---

### `tests/edge/handlers/plugin/{install,update}.test.ts` (handler shim tests, request-response)

**Analog:** the file's own notify-recorder harness + existing shim cases.

**Recorder harness** (install.test.ts:31-48) — `makeCtx` captures
`{ message, severity? }` per `ctx.ui.notify(m, s)`; `makePi()` stubs
`getAllTools`. Reuse verbatim.

**New case (FORCE-01/02 parse):** assert the handler threads `force:true` into the
orchestrator options. Existing shim cases prove control reaches the orchestrator
indirectly via its "not found in marketplace" notify (no marketplace seeded). To
assert threading, either spy the orchestrator boundary or seed a minimal
marketplace and assert the force-path behavior. Title with the requirement ID, e.g.
`test("shim :: --force threads force:true into installPlugin", ...)` — NOT a phase
reference.

**Also add** an `Unknown flag` negative-guard case is NOT needed for `--force`
(now recognized); keep existing unknown-flag cases for other tokens.

---

### `tests/orchestrators/plugin/{install,update}.test.ts` (integration, CRUD)

**Analog:** `seedPathMarketplaceWithPlugin` (install.test.ts:117-206) + `makeCtx`
recorder + the existing `installPlugin(...)` / `updatePlugins(...)` cases.

**Fixture gap:** the current `seedPathMarketplaceWithPlugin` writes a plain
`plugin.json` (`{ name, version }`) — it does NOT yet emit an `unsupported`
plugin. To drive a force-degrade test, seed a plugin.json with an experimental
declaration so the resolver returns `state:"unsupported"` (no structural defect),
per the proven recipe at `tests/domain/resolver-strict.test.ts:450-466`:
```ts
JSON.stringify({ name: "p1", experimental: { themes: "./themes", monitors: "./monitors.json" } });
```
The planner adds a fixture knob (e.g. `experimental?: object`) on
`seedPathMarketplaceWithPlugin` OR seeds the unsupported plugin.json inline.

**New cases to add:**
- FORCE-01: `install --force` on `unsupported` — assert supported components
  materialize, the unsupported kind is NOT materialized, and the state record is
  written.
- FORCE-01 no-op: `install --force` on a fully-supported plugin installs as
  `(installed)`, byte-identical to non-force.
- FORCE-03: `install` (no `--force`) on `unsupported` still blocks (existing
  block behavior holds under the new branch).
- FORCE-04: assert NO recorded notification has `severity === "warning"` and no
  rendered summary line begins `Warning:` on the force path. (Use the
  `notifications.filter((n) => n.severity === "warning")` shape already used for
  the error-severity assertions, e.g. install.test.ts:634.)
- FORCE-05: `install --force` on an `unavailable` (structural-defect / non-path
  source) plugin still blocks; missing marketplace still blocks.
- update mirror: FORCE-02 candidate-degrade + FORCE-03/04/05 equivalents.

## Shared Patterns

### Flag parse + thread (`--force`)
**Source template:** `edge/handlers/plugin/reinstall.ts:33,69-77`
(`extractLocalFlag(..., ["--force"])` + `...(force && { force: true })`).
**Local template:** the `--map-model` recognition in
`edge/handlers/plugin/shared.ts:54-67,87-112`.
**Apply to:** install/update handlers + `shared.ts` parse helper.
**Note:** reinstall's own `--force` is a DIFFERENT semantic (collision overwrite,
removed in Phase 67). Do NOT touch reinstall in this phase (D-65-05).

### Gate selection (force vs default)
**Source:** `domain/resolver.ts:1076` (`requireInstallable`) / `:1102`
(`requireForceInstallable`).
**Apply to:** `orchestrators/plugin/install.ts:475`, `update.ts:710`.
**Shape:** `if (opts.force === true) requireForceInstallable(r, op); else requireInstallable(r, op);`
followed by `const installable: MaterializablePlugin = resolved;`.

### Type widening (NFR-7-safe union)
**Source:** new `MaterializablePlugin = ResolvedPluginInstallable | ResolvedPluginUnsupported`
alias in `domain/resolver.ts`.
**Apply to:** `InstallCtx.resolved`, `PluginPreflight.installable`, the two
`installable` locals, `resolvePluginVersion`/`pickAgentsSourceDir` params, and the
5 bridge `resolved` params. Bodies UNCHANGED — none read `.state`.

### No-`Warning:` guarantee (FORCE-04)
**Source:** caller-stamped per-row severity + MAX-reduce summary
(`shared/notify.ts:2019-2104`); success rows stamp `severity:"info"`
(`install.ts:1369`, `update.ts:1535`); D-19-01 drops warning collections in
standalone mode.
**Apply to:** NOTHING new — this is a VERIFY-BY-TEST obligation. Keep success rows
at `info`; add no warning/dropped-component row (that is Phase 66/69).

### notify-recorder test harness
**Source:** `makeCtx` in `tests/edge/handlers/plugin/install.test.ts:31-48` and
`tests/orchestrators/plugin/install.test.ts:63+`; `seedPathMarketplaceWithPlugin`
at install.test.ts:117-206.
**Apply to:** all four test files; reuse the `{ message, severity? }` capture and
`notifications.filter((n) => n.severity === ...)` assertion idiom.

## No Analog Found

None. Every change is in-place on an existing file with an existing sibling or
self pattern. The single missing fixture capability (an `unsupported`-plugin
seed in `seedPathMarketplaceWithPlugin`) has a proven recipe at
`tests/domain/resolver-strict.test.ts:450-466` — planner adds it as a fixture knob.

## Metadata

**Analog search scope:** `extensions/pi-claude-marketplace/{domain,edge,orchestrators,bridges}`, `tests/{edge,orchestrators,domain}`.
**Files read:** resolver.ts (64-188), reinstall.ts (full), install/update handlers (full top), edge shared.ts (full), install orchestrator (242-352, 460-549), update orchestrator (161-190, 552-580, 600-728), orchestrators/shared.ts (485-529), bridge grep, install handler test (1-90), install orchestrator test (117-206 + grep).
**Pattern extraction date:** 2026-06-27
