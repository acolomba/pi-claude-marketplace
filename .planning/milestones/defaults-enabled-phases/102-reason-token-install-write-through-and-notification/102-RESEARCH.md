# Phase 102: Reason token, install write-through and notification - Research

**Researched:** 2026-08-14
**Domain:** In-repo TypeScript orchestration — install ledger composition, config
write-back, closed-set notification vocabulary
**Confidence:** HIGH (every claim below is anchored to a file this session opened
with `Read`; no external package research applies — this phase adds zero
dependencies)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Materialization path for an install-disabled plugin

- **D-102-01:** An install that resolves `defaultEnabled: false` runs the full
  six-phase ledger and then the existing disable cascade — materialize, then
  disable. The D-01 literal array
  (`[skills, commands, agents, hooks, mcp, state]`) is untouched, and so are all
  five materialization phase bodies.
  — **Rationale:** the terminal state is byte-identical to `install` followed by
  `disable` *by construction* rather than by careful re-implementation, and
  `toDisabledRecord` remains the sole sanctioned producer of the disabled shape
  (ENBL-02). The rejected alternatives both break one of those: a discover-only
  path gives the disabled shape a second producer, and a state-phase-only path
  leaves `resources` empty, contradicting ENBL-18 (a disabled plugin keeps its
  recorded inventory, shipped deliberately in the v1.18 close).
  — **Cost accepted:** artifacts are written and then removed on this path. It
  is bounded and only affects install-disabled plugins.
  — **Precedent:** the `enable` branch already reuses `runInstallLedger`; this
  is that composition in reverse.

- **D-102-02:** If the ledger succeeds but the disable cascade then fails, the
  behavior is **whatever a failed disable cascade does today** — the existing
  partial-drop reporting through `cascade.dropped` and the existing surfaced
  error, unchanged. No new failure semantics are invented for a path that is
  structurally an install followed by a disable, and no new rollback composition
  is built.

#### Enablement semantics per caller

- **D-102-03:** `import` never applies `defaultEnabled`.
  `extractEnabledPluginRefs` (`orchestrators/import/refs.ts`) skips
  `enabled: false` entries outright, so every plugin reaching `installPlugin`
  through import arrived because the source Claude Code settings said
  `enabled: true`. That is an explicit user setting, and DFEN-05 says an existing
  `enabled` value wins over `defaultEnabled` and is never overwritten. There is
  no absent case to decide on this path.
  — **Do not** treat `import` and `reconcile` as one "orchestrated mode" when
  reasoning about enablement. They skip the config write-back for the same
  reason but have opposite relationships to user intent.

- **D-102-04:** `reconcile` DOES apply `defaultEnabled`, and stamps the key. A
  user who hand-adds `"p@mp": {}` to `claude-plugins.json` has declared *which*
  plugin, not *whether* it is enabled — which is exactly the gap `defaultEnabled`
  exists to fill. So a reconcile-driven install of a `defaultEnabled: false`
  plugin records it disabled AND writes `enabled: false` into that entry.
  — **Narrow scope:** the write happens ONLY when the `enabled` key is absent,
  and writes ONLY that field. A pre-existing `enabled` value — `true` or
  `false` — is never touched.
  — **Why this does not violate the write-back skip:** the WB-01 / WR-09 rule
  exists so reconcile cannot clobber a per-machine override. Adding a key the
  user omitted is not clobbering. Without the stamp, the next `/reload` reads
  absent-as-enabled (`isDeclaredEnabled`), finds the record disabled, and pushes
  `acc.enable` (`orchestrators/reconcile/plan.ts:338`) — the exact silent
  re-enable this milestone exists to close.
  — **The alternative was rejected:** treating the bare entry as "enable it"
  would make `/claude:plugin install p@mp` and a hand-edit + `/reload` produce
  different outcomes for the same plugin and the same manifest, a divergence
  that would then need documenting rather than avoiding.

#### Reason token, notification and write-back mechanics

- **D-102-05:** `installs disabled` is appended at the **tail** of `REASONS`
  (`shared/notify.ts`), at position 39, after `"malformed command"`. No existing
  entry is reordered or reworded. The COMPAT-01 architecture test
  (`tests/architecture/compat-01-no-expansion.test.ts`) pins `REASONS` by exact
  enumeration equality, so it takes exactly one intended delta.

- **D-102-06:** The token gets a **shared** home in the `notify-reasons.ts` topic
  partition, not a command-private one. The read surfaces will emit it in the
  next phase, so a command-private home would only have to move one phase later.
  The partition's compile-time completeness proof (`_UncoveredReason` /
  `_ExtraReason`) fails until it has a home, which is the mechanism that makes
  this non-optional.

- **D-102-07:** The install notification states that the plugin installed
  disabled and how to enable it, at **informational** severity. The desired
  state WAS reached — an install-disabled plugin is the author's declared intent,
  not a shortfall — and severity is the desired-state axis, not a
  something-is-unusual axis.

- **D-102-08:** The install orchestrator determines the state and stamps both the
  reason token and the severity. `notify.ts` stays a dumb renderer and must not
  probe state to decide either.

- **D-102-09:** The write-back seam is
  `persistence/config-write-back.ts::writePluginConfigEntry`, the sole sanctioned
  writer per SPLIT-02, with its existing entry-level patch semantics. This phase
  gives the currently-empty plugin patch its first field.

### Claude's Discretion

- How the disabled-install path is threaded through `installPlugin` /
  `runInstallLedger` — a parameter, a post-ledger branch in the caller, or
  another shape — provided D-102-01's composition and D-102-02's failure
  behavior hold.
- The exact wording of the notification message, subject to D-102-07 and the
  established row grammar.
- Where the reconcile-side stamp is invoked from, provided it satisfies D-102-04's
  absent-key-only scope.

### Deferred Ideas (OUT OF SCOPE)

- Proving reconcile stability at the planner itself — a `/reload` planning no
  action, and the second and third reload being fixed points too — is the next
  phase (DFEN-06), as is `update`/`reinstall` never re-reading `defaultEnabled`
  (DFEN-07).
- `list` and `info` warning that a plugin will install disabled, and the
  network-free constraint on saying so, is a later phase (OUT-02, OUT-03,
  OUT-05).
- The six-surface byte-identical no-op sweep and the output-catalog amendment
  are the closing phase (DFEN-08, DOC-01, DOC-02).
- Honoring Claude's dependency-requirement override stays out of scope for the
  milestone, blocked on plugin dependency declarations being dropped entirely
  today.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| OUT-01 | New closed-set reason token `installs disabled` appended at the tail of `REASONS`, given a home in the `notify-reasons.ts` topic partition; existing tokens byte-stable | §"Closed-set amendment": exact tail entry, exact count (38→39), the two architecture tests that must take the delta, and the compile-time proof that forces the topic home |
| DFEN-04 | Install of a `defaultEnabled: false` plugin records it disabled AND writes `enabled: false` into the scope's `claude-plugins.json` entry; artifacts not materialized (terminal state matches an ordinary disable) | §"Pattern 1: materialize-then-disable" (exact composition against `cascadeUnstagePlugin` + `toDisabledRecord`) and §"Pattern 2: the write-back patch's first field" (exact call site) |
| DFEN-05 | An existing `enabled` value wins over `defaultEnabled` and is never overwritten, in either direction | §"Pattern 3: precedence read" — where the config entry is legible per caller, and the load-order hazard that makes `import` a distinct case |
| OUT-04 | Install notification states the plugin installed disabled and how to enable it, at informational severity | §"Pattern 4: the install-disabled row" — the existing `PluginDisabledMessage` / `ICON_DISABLED` / `DISABLE_RENDER` vocabulary that needs no new glyph or status token |
</phase_requirements>

## Summary

This phase is entirely in-repo composition work. It adds no packages, no schema
fields, and no glyphs. Everything it needs already exists as a named primitive:
`runInstallLedger` (the guard-free ledger body), `cascadeUnstagePlugin` (the
five-kind artifact drop), `toDisabledRecord` (the sole sanctioned producer of the
disabled record shape), `writeBatchedConfigEntries` (the batched entry-level
patch install already calls), `PluginDisabledMessage` + `ICON_DISABLED` (the
`(disabled)` row vocabulary), and the resolver's non-optional `defaultEnabled`
that Phase 101 landed on both materializable arms. The work is wiring them in the
right order under one lock, plus one closed-set amendment.

Three facts dominate the plan's shape. **First**, the disable half must be
composed from primitives, never by calling `setPluginEnabled`: `enable-disable.ts`
already imports `runInstallLedger` from `install.ts`
(`orchestrators/plugin/enable-disable.ts:80`), so an import in the other direction
closes a module cycle that `import-x/no-cycle` rejects inside `orchestrators/`,
and `setPluginEnabled` would in any case self-deadlock on the non-reentrant
per-scope lock. **Second**, the "does the user already have an opinion" read is
not uniform across callers: on the standalone and reconcile paths the config entry
is legible when install runs, but on the `import` path the entry does not exist
yet — `import`'s post-pass writes it *after* every `installPlugin` call returns
(`orchestrators/import/execute.ts:749-765`). A design that infers "no explicit
`enabled`" from an absent entry would therefore install every imported plugin
disabled, contradicting D-102-03. The caller must state its intent explicitly.
**Third**, the reconcile stamp already has its target file identified for free:
`PlannedPluginInstall` carries `configSource: "base" | "local"`
(`orchestrators/reconcile/types.ts:84`), written at `plan.ts:328` and currently
read by nothing. Writing the stamp into the wrong physical file is silently
ineffective, because base+local merge is wholesale per entry (a local entry
discards the base entry for that key), so a base stamp under a local declaration
would leave the merged view still reading absent-as-enabled.

**Primary recommendation:** thread one explicit boolean option through
`InstallPluginOptions` (set by the standalone edge path and by reconcile's apply
loop, left off by `import`), branch *after* `runPhases` inside `installPlugin`'s
existing `withLockedStateTransaction` closure, compose the disable from
`cascadeUnstagePlugin` + `toDisabledRecord` + the hooks-cache drop, extend the
existing single `writeBatchedConfigEntries` patch with `enabled: false`, and emit
a `PluginDisabledMessage` carrying the new `installs disabled` reason at info
severity through `INSTALL_CONTEXT`.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Resolve `defaultEnabled` | domain (`domain/resolver.ts`) | — | Already landed in Phase 101 as a non-optional field on both materializable arms (`resolver.ts:191-196`); this phase only reads it |
| Decide "this install lands disabled" | orchestrators (`orchestrators/plugin/install.ts`) | — | D-102-08: the orchestrator determines state; the resolver has no view of the user's config, the renderer has no view of anything |
| Drop the artifacts | bridges, via `orchestrators/marketplace/shared.ts::cascadeUnstagePlugin` | — | The five-kind cascade is already the single primitive both `uninstall` and `disable` route through |
| Produce the disabled record | persistence (`state-io.ts::toDisabledRecord`) | — | ENBL-02: sole sanctioned producer; its `resources: R` passthrough makes an inventory change a compile error |
| Write `enabled: false` to config | persistence (`config-write-back.ts`) | orchestrators (chooses target path + patch) | SPLIT-02: `saveConfig` is the sole writer; `--local` / base-vs-local target selection lives at the orchestrator boundary by design |
| Decide the reconcile stamp's physical file | orchestrators (`reconcile/apply.ts`) | persistence (`config-merge.ts` provenance) | The merge already records per-entry provenance so write-back need not replay the merge (`config-merge.ts:15-16`) |
| Render the row | shared (`shared/notify.ts` + `install.messaging.ts`) | — | D-102-08 / the notify-is-a-dumb-renderer rule: the renderer receives a stamped row and composes bytes |

## Standard Stack

### Core

No new dependency. This phase is composition over existing in-repo modules.

| Module | Purpose | Why it is the right seam |
|--------|---------|--------------------------|
| `orchestrators/plugin/install.ts::runInstallLedger` | Guard-free six-phase ledger body | Already reused by `enable-disable.ts`'s enable branch; the caller owns the lock and the save |
| `orchestrators/marketplace/shared.ts::cascadeUnstagePlugin` | Unstage skills/commands/agents/hooks/mcp | The single cascade primitive; `uninstall.ts:55` and `enable-disable.ts:72` both import it from here |
| `persistence/state-io.ts::toDisabledRecord` | Produce the disabled record | ENBL-02 sole producer; typed `DisabledPluginRecord<R>` return |
| `persistence/config-write-back.ts::writeBatchedConfigEntries` | Apply the entry-level patch | The call `install.ts` already makes; wraps `saveConfig` (SPLIT-02) |
| `shared/notify.ts::PluginDisabledMessage` + `ICON_DISABLED` | `(disabled)` row vocabulary | Already exists with OPTIONAL `reasons`; no new status token, no eighth glyph |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Composing the disable from primitives inside `install.ts` | Calling `setPluginEnabled(..., { enable: false })` | **Rejected — two hard blocks.** (1) `enable-disable.ts:80` already imports `runInstallLedger` from `install.ts`, so the reverse edge closes a cycle that `import-x/no-cycle` rejects for `orchestrators/**` (`tests/architecture/import-boundaries.test.ts`). (2) `setPluginEnabled` opens its own `withLockedStateTransaction`; `proper-lockfile` is `retries: 0` and not re-entrant, so it would throw `StateLockHeldError` from inside install's lock |
| An explicit caller-set option | Inferring intent from whether the config entry carries `enabled` | **Rejected —** on the `import` path the entry does not exist yet at install time (`import/execute.ts:749-765` writes it in a post-pass), so every imported plugin would read as "no user opinion" and install disabled, contradicting D-102-03 |
| Stamping the reconcile write inside `installPlugin` (it holds the lock and `cfg`) | A separate locked write in `reconcile/apply.ts` after the install returns | Recommended: stamp inside `installPlugin`. `applyPluginInstalls` (`apply.ts:576-641`) runs OUTSIDE any lock — each `installPlugin` self-locks — so a post-hoc write means a second lock acquisition and a second read of a file install already had open |
| Reusing `writeBatchedConfigEntries` | Switching install to `writePluginConfigEntry` per D-102-09 | Both live in `config-write-back.ts` and both are entry-level patches over `saveConfig`. Install's existing call is the **batched** one because it may also declare an adopted marketplace in the same atomic save (CR-02). Splitting into two saves would break that single-write property. See Pitfall 4 |

## Package Legitimacy Audit

Not applicable. This phase installs no external packages. No `npm install` line
appears in the plan; `package.json` is untouched.

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### System Architecture Diagram

```text
  /claude:plugin install p@mp          /reload (resources_discover)        /claude:plugin import
            │                                     │                                 │
            ▼                                     ▼                                 ▼
   edge/handlers/plugin/install.ts        reconcile/plan.ts                import/refs.ts
            │                              (classifyDeclaredPlugin)      (extractEnabledPluginRefs
            │                                     │                        drops enabled:false)
            │                                     ▼                                 │
            │                              reconcile/apply.ts                       │
            │                             applyPluginInstalls                       │
            │                       (carries configSource base|local)               │
            │                                     │                                 │
            └───────────────┬─────────────────────┴─────────────────────────────────┘
                            ▼
              orchestrators/plugin/install.ts :: installPlugin
                            │
                withLockedStateTransaction(locations, tx => {
                            │
                   loadConfig(targetConfigPath)   ── CFG-03 abort arm
                            │
                   runInstallLedger(...)  ──► runPhases([skills, commands,
                            │                  agents, hooks, mcp, state])
                            │                  state phase writes enabled: true
                            ▼
                ┌─── NEW DECISION POINT ────────────────────────────┐
                │ applyDefaultEnabled?  AND  resolved.defaultEnabled│
                │   === false          AND  config `enabled` absent │
                └────────────┬──────────────────────┬───────────────┘
                        yes  │                      │  no
                             ▼                      │
              cascadeUnstagePlugin(...)              │
                 (skills→commands→agents             │
                  →hooks→mcp)                        │
                             │                       │
                 toDisabledRecord(record, now)       │
                 → replace mp.plugins[plugin]        │
                             │                       │
                 removePluginConfigFromCache +       │
                 rebuildRoutingTables                │
                             │                       │
                             └───────┬───────────────┘
                                     ▼
              writeBatchedConfigEntries(... plugins: { "p@mp": {…} })
                 standalone: patch gains `enabled: false`
                 reconcile:  narrow absent-key-only stamp
                 import:     still skipped entirely (WR-09)
                                     │
                                 tx.save()
                                     │
                       hooks cache add — SKIP when disabled
                })                   │
                                     ▼
                    notifyWithContext(ctx, pi, INSTALL_CONTEXT, [...])
                       row: ◍ p [scope] v1.0.0 (disabled) {installs disabled}
                       severity: info
```

### Pattern 1: Materialize-then-disable inside the existing transaction

**What:** After `runInstallLedger` returns `{ kind: "installed", installCtx }`,
branch on the disabled verdict and run the disable half in place, before the
config write-back and before `tx.save()`.

**When to use:** Exactly on the install path when the resolved `defaultEnabled`
is `false` and the caller opted in and no explicit config `enabled` exists.

**The pieces, verbatim from the disable branch** (`enable-disable.ts:329-388`):

```ts
// enable-disable.ts:336 -- the cascade
const cascade = await cascadeUnstagePlugin(opts.plugin, opts.marketplace, locations, installed);
if (!cascade.ok) {
  // enable-disable.ts:343-344 -- fold what DID drop, then bump updatedAt
  applyPartialCascadeFold(installed, cascade.dropped);
  installed.updatedAt = new Date().toISOString();
  if (cascade.dropped.hooks.length > 0) {
    dropCachedHooks(scope, opts.marketplace, opts.plugin, "partial-cascade ", false);
  }
  // ... returns { kind: "disable-failed", cause, recordedVersion }, saveShrunken: true
}

// enable-disable.ts:379 -- the sole sanctioned producer
const disabled = toDisabledRecord(installed, new Date().toISOString());

// enable-disable.ts:385 -- drop the parsed-config cache + rebuild routing
dropCachedHooks(scope, opts.marketplace, opts.plugin, "", true);
```

and the map-slot replacement at `enable-disable.ts:606-608`:

```ts
if (disableResult.disabled !== undefined) {
  mp.plugins[plugin] = disableResult.disabled;
}
```

The replacement (rather than in-place mutation) is load-bearing: `toDisabledRecord`
is typed `<R extends PluginInstallRecord["resources"]>(record, updatedAt) =>
DisabledPluginRecord<R>` (`state-io.ts:168-171`), and the branded return type only
survives to the assignment if the slot is replaced.

**Ordering constraint.** The state phase writes `enabled: true` unconditionally
(`install.ts:1218-1221`, verbatim: `// ENBL-02: always set enabled: true on
install and re-materialization.` … `enabled: true,`). The disable half therefore
runs *after* `runPhases` and overwrites that value. Do not touch the state phase
body — D-102-01 keeps all six phase bodies untouched.

**Rejected shape:** a seventh phase in the literal array. `install.ts:1235-1246`
declares the array with the comment `// D-01 literal-array; order is part of the
contract -- never refactor to a dynamic builder.` and the PRD-fixed sequence
`[skills, commands, agents, hooks, mcp, state]`. Adding a phase changes that
contract.

### Pattern 2: The write-back patch's first field

The install write-back today (`install.ts:1447-1452`, verbatim):

```ts
await writeBatchedConfigEntries(current, targetConfigPath, locations.scopeRoot, {
  ...(adoptedSource !== undefined && {
    marketplaces: { [marketplace]: { source: adoptedSource } },
  }),
  plugins: { [`${plugin}@${marketplace}`]: {} },
});
```

`{}` is the empty patch DFEN-04 calls "the first field the install write-back's
currently-empty plugin patch has ever carried". The comment two lines above it
(`install.ts:1408-1413`) states the current reason for emptiness verbatim:
`// The plugin patch is `{}` because the plugin entry shape today carries no
install-time field beyond the implicit declaration -- D-04 keeps the "enabled"
default at consume time.` That comment becomes false in this phase and must be
amended in the same edit.

The patch semantics are a spread over the existing entry
(`config-write-back.ts:190-192`, verbatim):

```ts
for (const [key, patch] of Object.entries(batch.plugins ?? {})) {
  plugins[key] = { ...plugins[key], ...patch };
}
```

so `{ enabled: false }` merges over an existing entry without disturbing unknown
forward-compat keys (D-09). `PluginConfigEntry` already carries the field:
`PLUGIN_CONFIG_ENTRY_SCHEMA = Type.Object({ enabled: Type.Optional(Type.Boolean()) })`
(`config-io.ts:55-57`) — no schema change, no migration.

The guard around the write is `install.ts:1430`, verbatim:
`if (opts.notifications?.mode !== "orchestrated") {`. `import` and `reconcile`
both come in orchestrated, so the reconcile stamp needs its own narrow path
inside that closure rather than a widening of this condition (see Pattern 5).

### Pattern 3: Precedence read — where the user's explicit `enabled` is legible

`isDeclaredEnabled` is the single home of absent-means-enabled
(`config-io.ts:88-90`, verbatim):

```ts
export function isDeclaredEnabled(entry: PluginConfigEntry): boolean {
  return entry.enabled !== false;
}
```

It answers "is this enabled", **not** "did the user state an opinion". DFEN-05
needs the second question, which is `entry.enabled !== undefined`. The precedent
for reading it directly is the enable/disable idempotency promotion
(`enable-disable.ts:565`, verbatim):

```ts
const configEnabled = current.plugins?.[`${plugin}@${marketplace}`]?.enabled;
```

read off the **target** physical config, not a merged view. `installPlugin`
already has that value in scope: `loadConfig(targetConfigPath)` runs at
`install.ts:1386` inside the lock, and `current` is derived at `install.ts:1431`.

**Per-caller legibility (the crux of DFEN-05 / D-102-03 / D-102-04):**

| Caller | Config entry state when `installPlugin` runs | Correct behavior |
|--------|--------------------------------------------|------------------|
| standalone `/claude:plugin install` | May pre-exist (hand-authored) with `enabled` present or absent, or be absent entirely | Explicit `enabled` wins; otherwise apply `defaultEnabled` and stamp |
| `reconcile` | **Always present** — the entry is why the install was planned. `enabled` is absent or `true`: `classifyDeclaredPlugin` returns early for `enabled: false` + not-recorded, so a declared-disabled plugin is never planned for install (`plan.ts:304-325`) | Absent → apply + stamp (D-102-04). `true` → never touch |
| `import` | **Absent.** The post-pass writes every entry after all installs finish (`import/execute.ts:749-765`, `798-842`) | Never apply `defaultEnabled` (D-102-03) |

This asymmetry is why the decision cannot be inferred from the config alone. Pass
an explicit option.

### Pattern 4: The install-disabled row — no new status token, no new glyph

Everything needed is already in the closed sets:

- `"disabled"` is already in `STATUS_TOKENS` (`notify.ts:263`) and in
  `PLUGIN_STATUSES` (`notify.ts:487`). Both tuples are pinned by exact
  enumeration in `tests/architecture/compat-01-no-expansion.test.ts` and by
  length in `notify-closed-set-locks.test.ts` (`PLUGIN_STATUSES.length, 19`).
  **They must not change.**
- `ICON_DISABLED = "◍"` already exists (`notify.ts:1616`) and is pinned to
  `"◍"` by COMPAT-01. There is a separate COMPAT-01 clause asserting
  `declarations?.length === 7` glyph exports — **do not add an eighth glyph.**
- `PluginDisabledMessage` already carries OPTIONAL `reasons`
  (`notify.ts:791-798`, verbatim):

```ts
export interface PluginDisabledMessage extends TransitionMessageBase {
  readonly status: "disabled";
  readonly name: string;
  readonly version?: string;
  readonly scope?: Scope;
  readonly description?: string;
  readonly reasons?: readonly ContentReason[];
}
```

Its doc comment says the field "admits exactly one member -- `not in manifest`"
but also states the governing rule verbatim: `Which reasons a surface stamps is
an ORCHESTRATOR decision (D-95-01) -- the render path holds no allowlist.`
(`notify.ts:773-775`). Adding `installs disabled` to that row is therefore a
producer decision, not a renderer change — but the prose sentence naming one
member becomes stale and should be amended in the same edit.

What install *does* need is a `disabled` arm in its own command context.
`INSTALL_STATUSES` (`install.messaging.ts:42-48`) is
`["installed", "partially-installed", "failed", "unavailable", "partially-available"]`
— command-private, and **not** pinned by any architecture test (COMPAT-01 pins
`REASONS`, `STATUS_TOKENS`, `PLUGIN_STATUSES`, `MARKETPLACE_STATUSES` and the
glyphs; it does not pin per-command status tuples). Adding `"disabled"` there
requires: adding it to the tuple, adding `PluginDisabledMessage` to `InstallMsg`,
and adding a render arm to `INSTALL_RENDER` — the map is typed
`{ [K in InstallStatus]: RenderFn<...> }`, so omitting the arm is a TS2741
compile error at the `as const satisfies` site.

The arm body should be lifted **verbatim** from `DISABLE_RENDER`
(`enable-disable.messaging.ts:106-114`) so the bytes match the disable verb's row:

```ts
disabled: (p, probe, mpScope) =>
  joinTokens([
    ICON_DISABLED,
    p.name,
    renderScopeBracket(p.scope, mpScope),
    renderVersion(p.version),
    "(disabled)",
    composeReasons(p.reasons, false, false, probe),
  ]),
```

Both soft-dep flags stay hard-coded `false` (ENBL-15 / D-100-06): a disabled row
never emits `{requires pi-subagents}` / `{requires pi-mcp}` whatever inventory the
record retained.

### Pattern 5: The reconcile stamp's physical target is already computed

`MergedConfigEntry` carries provenance for exactly this purpose
(`config-merge.ts:46-49` + the module header at `:15-16`, verbatim:
`Each `MergedConfigEntry` carries `source: "base" | "local"` so write-back can
target the correct physical file without replaying the merge.`).

The planner already propagates it onto the install op
(`reconcile/plan.ts:328`, verbatim):

```ts
acc.install.push({ scope, plugin, marketplace, configSource: declared.source });
```

typed at `reconcile/types.ts:84` as `readonly configSource: "base" | "local";`.
A repo-wide grep finds **no reader** of that field today — it is a pre-built,
unused seam that D-102-04's stamp fits exactly.

Why the target matters: the merge is wholesale per entry
(`config-merge.ts:109-119`) — a local entry replaces the base entry for that key
outright. Stamping `enabled: false` into the base file when the declaration lives
in `claude-plugins.local.json` leaves the merged view still reading `enabled`
absent, `isDeclaredEnabled` still `true`, and the next `/reload` still pushing
`acc.enable` (`plan.ts:338`) — the silent re-enable the milestone exists to close,
un-closed and untested-for.

### Anti-Patterns to Avoid

- **`import` from `enable-disable.ts` inside `install.ts`.** Closes a module
  cycle rejected by `import-x/no-cycle` for `orchestrators/**` (pinned by
  `tests/architecture/import-boundaries.test.ts`), because `enable-disable.ts:80`
  already imports `runInstallLedger` from `install.ts`. This includes
  `import type`.
- **Calling `setPluginEnabled` from the install path.** Self-deadlock:
  `proper-lockfile` is `retries: 0` and not re-entrant; the nested acquisition
  throws `StateLockHeldError`. This is exactly the defect `runInstallLedger` was
  extracted (CR-01) to avoid on the enable side.
- **Teaching `isDeclaredEnabled` the manifest value.** Explicitly rejected at the
  milestone level (STATE.md "Accumulated Context", REQUIREMENTS.md "Out of
  Scope") and must not reappear.
- **Refactoring the six-phase literal array.** `install.ts:1235-1236` forbids it
  in the source comment.
- **Adding a glyph or a status token.** Both are pinned closed sets; the row this
  phase emits is expressible with `ICON_DISABLED` + `"disabled"`.
- **Widening the `!== "orchestrated"` write-back guard at `install.ts:1430`.**
  That would restore the full write-back for `import` and `reconcile`, clobbering
  per-machine overrides (WR-09). The reconcile stamp is a separate, narrower
  write.
- **A source comment citing `Phase 102` / `Plan NN` / `Wave N`.** Forbidden by
  `.claude/rules/typescript-comments.md`. Cite `DFEN-04`, `DFEN-05`, `OUT-01`,
  `OUT-04`, `D-102-01`…`D-102-09`, `ENBL-02`, `ENBL-18`, `WR-09`, `SPLIT-02`
  instead.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Removing the five artifact kinds | A per-kind unstage loop in `install.ts` | `cascadeUnstagePlugin` (`orchestrators/marketplace/shared.ts:334`) | Owns PU-1 order, D-03 fail-fast, the AG-5 foreign-content strictness opt-in, and returns the `dropped` bag D-102-02's failure path needs |
| Building the disabled record | `{ ...record, enabled: false, updatedAt }` inline | `toDisabledRecord` (`state-io.ts:168`) | ENBL-02 sole producer; the `resources: R` passthrough makes an inventory change a compile error at the producer. A second producer is precisely what D-102-01 rejected the discover-only path for |
| Asking "is this record disabled" | `!record.enabled` inline | `isRecordedButDisabled` (`state-io.ts:205`) | A repo-walking gate in `tests/orchestrators/reconcile/plan.test.ts` rejects re-derivations anywhere in the extension source tree |
| Writing the config entry | `atomicWriteJson` / a bespoke merge | `writeBatchedConfigEntries` (`config-write-back.ts:177`) | SPLIT-02: `saveConfig` is the sole writer; it runs `CONFIG_VALIDATOR.Check` then `assertPathInside(scopeRoot, …)` before any bytes hit disk (`config-io.ts:182-195`) |
| Folding a partial cascade back into the record | A bespoke filter | `applyPartialCascadeFold` (`orchestrators/plugin/shared.ts:855`) | Already handles all five kinds including the D-63-04 hooks asymmetry |
| Dropping the hooks cache on disable | Inline `removePluginConfigFromCache` + `rebuildRoutingTables` | The `dropCachedHooks` shape at `enable-disable.ts:406-424` | Wrapped in try/catch so a cache throw cannot escalate a successful disable into a failure |
| Deciding which physical config file to stamp | Re-running the merge, or guessing "base" | `configSource` already on the planned op (`reconcile/types.ts:84`) | The merge computed it; replaying it risks divergence, and guessing wrong is silently ineffective |

**Key insight:** every piece of this phase already has exactly one sanctioned
implementation, and each one is guarded by a test or a type that fires when a
second implementation appears. The plan's job is wiring, not building.

## Closed-Set Amendment (OUT-01) — exact deltas

**Verified tail of `REASONS`** (`shared/notify.ts:90-175`). The tuple holds 38
entries; the final three, verbatim:

```ts
  "malformed mcp",
  "malformed skill",
  "malformed command",
] as const;
```

`installs disabled` appends after `"malformed command"`, becoming entry 39.

**Four sites take the delta:**

1. `extensions/pi-claude-marketplace/shared/notify.ts` — the tuple entry plus its
   explanatory comment, in the house style of the `"malformed skill"` /
   `"malformed command"` entries (`notify.ts:160-174`).
   ⚠️ The doc comment above the tuple still says `its 37-entry membership AND
   order are catalog-stable` (`notify.ts:79-80`) — already stale by one (the real
   count is 38). Fix it to 39 in the same edit.
2. `extensions/pi-claude-marketplace/shared/notify-reasons.ts` — a home in a
   shared topic group (D-102-06). The module doc comment says `the 38-entry
   membership AND order must stay byte-identical` (`notify-reasons.ts:7-8`) and
   `D-90-05 is what moved the count from 37 to 38` (`:16`) — both need the same
   bump. **Which group:** the token names a durable manifest-declared property,
   not a failure and not an idempotent no-op. `UNSUPPORTED_REASONS`
   (`:91-100`) is the closest existing topic ("unsupported-components / soft-dep")
   but is a poor semantic fit — installing disabled is not an unsupported
   feature. See Open Question 1.
3. `tests/architecture/compat-01-no-expansion.test.ts:126-171` — append
   `"installs disabled"` to the hand-written enumeration.
4. `tests/architecture/notify-closed-set-locks.test.ts:29-38` — bump
   `assert.equal(REASONS.length, 38)` to `39` and add the one-line rationale
   comment the file's convention requires (its header says verbatim: `Bump the
   expected count in the SAME change that grows the set.`).

**What forces (2):** the compile-time partition proof
(`notify-reasons.ts:225-228`, verbatim):

```ts
type _AssertNever<T extends never> = T;
type _UncoveredReason = Exclude<Reason, SharedTopicReason | CommandPrivateReason>;
type _ExtraReason = Exclude<SharedTopicReason | CommandPrivateReason, Reason>;
export type _ReasonsCoverageProof = [_AssertNever<_UncoveredReason>, _AssertNever<_ExtraReason>];
```

Adding to `REASONS` without a topic home makes `_UncoveredReason` non-`never`,
which is a TS2344 error at `npm run typecheck`. The phase cannot half-land.

**What does NOT take a delta:** `docs/output-catalog.md`. `catalog-uat.test.ts`
walks the catalog forward (annotation → fixture) and inverse (fixture →
annotation, `:4880-4912`); adding neither an annotation nor a fixture keeps both
walks green. DOC-01 defers the catalog row to Phase 105 by design. Adding a
catalog block in this phase would additionally require a `FIXTURES` entry in
`catalog-uat.test.ts` — do not do it here.

## Common Pitfalls

### Pitfall: the post-save hooks cache add registers a disabled plugin's hooks

**What goes wrong:** `installPlugin` populates the hooks parsed-config cache and
rebuilds the routing table AFTER `tx.save()` (`install.ts:1490-1511`), gated only
on `installCtx.resolved.hooksConfigPath !== undefined`. On the install-disabled
path the disable cascade has just *removed* the on-disk `hooks.json`, so this
block would re-read a deleted file, or worse, register routing entries for a
plugin the user's config says is disabled — live hook dispatch against a disabled
plugin, with no `/reload` able to clear it until the next hydrate.

**Why it happens:** the block predates any notion of an install landing disabled;
its gate asks "does this plugin declare hooks", not "is this plugin live".

**How to avoid:** skip the block entirely on the disabled path, and instead run
the disable-side cache drop (`removePluginConfigFromCache` + `rebuildRoutingTables`,
the `dropCachedHooks` shape at `enable-disable.ts:406-424`) inside the disable
composition.

**Warning signs:** a disabled plugin's hooks firing in the same session as the
install; `hookDebugLog` output naming a path the cascade just deleted.

### Pitfall: `resourcesChanged` / `declaresAgents` / `declaresMcp` over-report

**What goes wrong:** `installPlugin` computes `stagedAny` from the ledger's staged
name arrays (`install.ts:1768-1772`) and returns it as
`InstallPluginOutcome.resourcesChanged` (`:1906`). On the install-disabled path
those arrays are non-empty (the ledger *did* stage) but the artifacts were then
removed, so the net Pi-visible resource delta is zero. `import/execute.ts:730`
does `result.changedResources ||= outcome.resourcesChanged`, and reconcile's
`dependenciesFromInstall` derives soft-dep markers from `declaresAgents` /
`declaresMcp` — both would claim a change that did not survive the command.

**Why it happens:** the outcome fields describe what the ledger staged, and until
now "staged" and "live" were the same thing.

**How to avoid:** on the disabled path return `resourcesChanged: false`. Decide
consciously about `declaresAgents` / `declaresMcp` — they are *declaration*
predicates, and a disabled plugin still declares; but the row must not render
`{requires pi-…}` markers (ENBL-15 / D-100-06 hard-codes both flags `false` in
the disabled render arm, so the row is safe either way).

**Warning signs:** an import cascade emitting a `/reload to pick up changes`
trailer when every installed plugin landed disabled.

### Pitfall: stamping the reconcile write into the wrong physical file

**What goes wrong:** the stamp lands in `claude-plugins.json` while the
declaration lives in `claude-plugins.local.json`. Because the base+local merge
replaces the whole entry (`config-merge.ts:109-119`), the merged view still sees
`enabled` absent → `isDeclaredEnabled` → `true` → `plan.ts:338` pushes
`acc.enable` on every subsequent reload. The silent re-enable persists, and a
test that only asserts "a file got an `enabled: false`" passes.

**Why it happens:** install's default target is `locations.configJsonPath` unless
`opts.local` is set (`selectConfigWriteTarget`), and reconcile does not set it.

**How to avoid:** drive the stamp target from `PlannedPluginInstall.configSource`
(`reconcile/types.ts:84`), which the planner already populates from the merge
provenance. Assert the outcome through the **merged** view, not the physical
file — i.e. the DFEN-06 property one phase early, at least as a smoke assertion.

**Warning signs:** a test that reads `claude-plugins.json` directly and never
constructs the local-declared case.

### Pitfall: reading precedence off a merged view instead of the target file

**What goes wrong:** `installPlugin` deliberately loads only ONE physical file
(`loadConfig(targetConfigPath)`, `install.ts:1386`); the sibling path is read
inside the lock for a **membership test only** and is `never written, never
serialized back` (`install.ts:1364-1366`, verbatim). Reaching for
`loadMergedScopeConfig` to answer "did the user set `enabled`" would pull a
merged view into the write-back module's blast radius — and
`config-write-back.ts:12-19` explicitly forbids that direction (`this file MUST
NOT import `config-merge.ts`… serializing a merged view back to disk would copy
`claude-plugins.local.json` entries into `claude-plugins.json``), gated by
`tests/architecture/config-state-consistency.test.ts`.

**How to avoid:** read the precedence off `current` (the loaded target config),
matching the `enable-disable.ts:565` precedent. For the reconcile path, the
merged entry's value is already known to the planner — pass what is needed on the
op rather than re-reading.

### Pitfall: the disable-cascade failure window invents new semantics

**What goes wrong:** the ledger succeeded (artifacts on disk, record written
`enabled: true`) and `cascadeUnstagePlugin` then throws. A tempting reaction is a
new rollback composition or a new failure reason.

**Why it is wrong:** D-102-02 fixes the behavior as "whatever a failed disable
cascade does today" — `applyPartialCascadeFold` shrinks the record to match what
actually dropped, `updatedAt` bumps, the hooks cache drops if hooks dropped, the
shrunken record is saved, and the existing error surfaces
(`enable-disable.ts:337-361`).

**How to avoid:** reuse `applyPartialCascadeFold` and the existing failure row.
Note the one asymmetry to decide: on the disable verb the record stays `enabled:
true` after a failed cascade (it never reached `toDisabledRecord`). On this path
that means an install that reports failure while leaving a recorded, enabled,
partially-unstaged plugin — which is exactly what an `install` + failed `disable`
produces, so it satisfies D-102-02 by construction. Make it explicit in a test
rather than discovering it in the field.

### Pitfall: the write-back's stale explanatory comment

`install.ts:1408-1413` states the plugin patch is `{}` *because* the entry shape
carries no install-time field, citing D-04. That sentence is exactly what this
phase falsifies. Leaving it turns the file's most load-bearing comment into a
contradiction of the code beneath it. Amend it in the same edit, citing DFEN-04.

### Pitfall: assuming `import` will be unaffected because it skips write-back

The write-back skip and the enablement decision are independent axes (D-102-03
says this in as many words). If the disabled decision is derived inside
`runInstallLedger` from `resolved.defaultEnabled` alone, `import` installs
disabled too — silently, with no config entry to explain it, and the post-pass
then writes a bare `{}` entry whose merged reading is "enabled", producing a
disabled record under an enabled declaration: reconcile's `acc.enable` case on the
very next reload. Gate on an explicit caller-supplied option, and add a test that
drives `import` end-to-end against a `defaultEnabled: false` fixture.

## Code Examples

### Reading the resolved value (no narrowing needed)

`InstallCtx.resolved` is typed `MaterializablePlugin` (`install.ts:380`), and
`defaultEnabled` is non-optional on both materializable arms
(`domain/resolver.ts:191-196`, verbatim):

```ts
  // DFEN-02 / DFEN-03: the resolved install-time enablement. NON-optional,
  // unlike the three fields above -- they are optional because absence is
  // meaningful, whereas this one always has an answer once the entry and the
  // manifest have been read. Keeping it required is what stops every consumer
  // from re-deriving the rule behind a `?? true` fallback.
  defaultEnabled: Type.Boolean(),
```

so the read is simply `installCtx.resolved.defaultEnabled` — a plain boolean, no
`?? true`.

### The precedence gate (shape only)

```ts
// DFEN-05: an explicit `enabled` in the target config wins over the manifest
// value, in either direction, and is never overwritten. Read off the TARGET
// physical config (never a merged view -- SPLIT-02 / the config-write-back
// containment rule), matching the enable/disable idempotency promotion.
const declaredEnabled = current.plugins?.[`${plugin}@${marketplace}`]?.enabled;
const landsDisabled =
  applyDefaultEnabled &&
  declaredEnabled === undefined &&
  installCtx.resolved.defaultEnabled === false;
```

### The install-disabled row (shape only)

```ts
// OUT-04 / D-102-07: the desired state WAS reached -- an install-disabled plugin
// is the author's declared intent, not a shortfall -- so the row stamps `info`.
// ENBL-15 / D-100-06: the `disabled` render arm hard-codes both soft-dep flags
// false, so no `{requires pi-...}` marker can reach this row.
const disabledRow: InstallMsg = {
  status: "disabled",
  name: plugin,
  version: installCtx.version,
  reasons: ["installs disabled"],
  severity: "info",
  needsReload: /* see Open Question 2 */,
};
notifyWithContext(ctx, pi, INSTALL_CONTEXT, [
  { name: marketplace, scope, plugins: [disabledRow] },
]);
```

The "how to enable it" half of OUT-04 has two candidate carriers — see Open
Question 3.

## State of the Art (in-repo)

| Old shape | Current shape | Where |
|-----------|---------------|-------|
| Install write-back patch always `{}` | Gains its first field, `enabled: false` | `install.ts:1451` |
| `REASONS` closed at 38 | 39 | `notify.ts:90-175` |
| `PlannedPluginInstall.configSource` written, never read | First reader (the reconcile stamp target) | `reconcile/types.ts:84` |
| `PluginDisabledMessage.reasons` doc says "admits exactly one member — `not in manifest`" | Admits a second, `installs disabled` | `notify.ts:765-777` |
| `INSTALL_STATUSES` = 5 command-private statuses | 6, gaining `"disabled"` | `install.messaging.ts:42-48` |
| Reconcile never writes config (WR-09 skip is total) | One narrow, absent-key-only stamp | `reconcile/apply.ts` / `install.ts` |

**Not deprecated, but now stale in prose:** the `37-entry` claim at
`notify.ts:79-80`, the `38-entry` claims at `notify-reasons.ts:7-8` and `:16`, and
the `plugin patch is {}` rationale at `install.ts:1408-1413`.

## Runtime State Inventory

Not applicable — this is not a rename / refactor / migration phase and the
milestone forbids any state schema migration. The only persisted surfaces this
phase touches are (a) the existing `enabled: boolean` field on the plugin install
record in `state.json`, written through the existing `toDisabledRecord` producer,
and (b) the existing optional `enabled?: boolean` on the plugin config entry
(`config-io.ts:55-57`). Neither is a new field. The one non-file runtime state in
play is the in-process hooks parsed-config cache + routing table, covered as the
first Pitfall above.

## Environment Availability

Skipped — this phase has no external dependencies. It is code + test changes
inside the repo, verified by `npm run check` (Node `>=20.19.0`, already the
project floor).

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | `node:test` (Node built-in), Node `>=20.19.0` |
| Config file | none — glob-driven from `package.json` scripts |
| Quick run command | `node --test tests/orchestrators/plugin/install.test.ts` |
| Full suite command | `npm run check` (typecheck + lint + format:check + test + test:integration) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| OUT-01 | `REASONS` holds exactly 39 members, `installs disabled` at the tail | unit/architecture | `node --test tests/architecture/compat-01-no-expansion.test.ts tests/architecture/notify-closed-set-locks.test.ts` | ✅ (edit both) |
| OUT-01 | The token has a topic home (partition proof stays `never`) | compile | `npm run typecheck` | ✅ |
| DFEN-04 | Install of a `defaultEnabled: false` plugin records `enabled: false` and leaves no skills/commands/agents/hooks/mcp on disk | unit | `node --test tests/orchestrators/plugin/install.test.ts` | ✅ |
| DFEN-04 | The record keeps its inventory (ENBL-18) — `resources.*` non-empty on the disabled record | unit | same | ✅ |
| DFEN-04 | `claude-plugins.json` entry gains `enabled: false` | unit | same | ✅ |
| DFEN-05 | Config `enabled: true` + manifest `defaultEnabled: false` → installs enabled, config untouched | unit | same | ✅ |
| DFEN-05 | Config `enabled: false` + manifest `defaultEnabled: true` → stays disabled, config untouched | unit | same | ✅ |
| DFEN-05 | `import` of a `defaultEnabled: false` plugin installs ENABLED (D-102-03) | unit | `node --test tests/orchestrators/import/*.test.ts` | ✅ (verify path at plan time) |
| DFEN-04/05 | reconcile install stamps `enabled: false` only when the key is absent, into the declaring physical file (`configSource`) | unit | `node --test tests/orchestrators/reconcile/apply.test.ts` | ✅ |
| OUT-04 | Row renders `◍ <plugin> [scope] v… (disabled) {installs disabled}` at info severity, one emission | unit | `node --test tests/orchestrators/plugin/install.test.ts` | ✅ |
| D-102-02 | Ledger succeeds + cascade throws → today's partial-drop reporting, shrunken record saved | unit | same | ✅ |
| NFR-6 | Whole suite green | integration | `npm run check` | ✅ |

### Sampling Rate

- **Per task commit:** `node --test tests/orchestrators/plugin/install.test.ts`
  plus `npm run typecheck` (the partition proof is a compile-time gate, so
  typecheck is the cheapest signal that OUT-01 landed whole).
- **Per wave merge:** `npm test` (the architecture globs are in the unit set).
- **Phase gate:** `npm run check` green before `/gsd-verify-work`.

### Wave 0 Gaps

None — every target test file already exists
(`tests/orchestrators/plugin/install.test.ts` 5065 lines,
`tests/orchestrators/reconcile/apply.test.ts` 1723 lines,
`tests/architecture/compat-01-no-expansion.test.ts`,
`tests/architecture/notify-closed-set-locks.test.ts`). No framework install, no
new `conftest`-equivalent, no new fixture harness. Confirm at plan time which file
under `tests/orchestrators/import/` owns the cascade path before assigning the
D-102-03 test.

## Security Domain

ASVS Level 1; blocking threshold `high`. This phase adds no network call, no new
external input surface, and no new file path.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard control |
|---------------|---------|------------------|
| V2 Authentication | no | No auth surface touched; the git-credential path is untouched |
| V3 Session Management | no | No sessions |
| V4 Access Control | no | No multi-user model |
| V5 Input Validation | yes | `defaultEnabled` is validated by `PLUGIN_ENTRY_VALIDATOR` / `PLUGIN_MANIFEST_VALIDATOR` before the resolver reads it; the written `enabled` is `Type.Optional(Type.Boolean())` on `PLUGIN_CONFIG_ENTRY_SCHEMA` and re-checked by `CONFIG_VALIDATOR.Check` inside `saveConfig` before any bytes are written (`config-io.ts:187-191`) |
| V6 Cryptography | no | None |
| V12 File/Resource | yes | Every write routes through `saveConfig` → `assertPathInside(scopeRoot, filePath, "saveConfig")` (NFR-10 / SPLIT-02, `config-io.ts:193`), and every artifact removal through `cascadeUnstagePlugin`'s bridge unstage primitives |

### Known Threat Patterns for this change

| Pattern | STRIDE | Mitigation |
|---------|--------|------------|
| A hostile marketplace entry sets `defaultEnabled` to a non-boolean to smuggle truthiness | Tampering | Schema-validated at both declaration sites; the resolver's two `typeof … === "boolean"` narrows are defense-in-depth and degrade to the `true` default with no error path (`resolver.ts:655-662`) |
| A path-escaping config write | Tampering | `assertPathInside` runs before `atomicWriteJson`; `PathContainmentError` propagates loudly (PI-14) |
| Absolute-path leakage in the new notification | Information disclosure | The row carries plugin/marketplace/version tokens only; the CFG-03 abort arm already uses `path.basename(targetConfigPath)` (`install.ts:1368`) — do not add a path to the new row |
| A disabled plugin's hooks still dispatching | Elevation of privilege (executes code the user disabled) | The hooks parsed-config cache MUST be dropped, not populated, on this path — see Pitfall 1. This is the one genuinely security-relevant defect available in this phase |

## Assumptions Log

| # | Claim | Section | Risk if wrong |
|---|-------|---------|---------------|
| A1 | The right topic group for `installs disabled` in `notify-reasons.ts` is not obvious from the existing three shared groups; none is a clean semantic fit | Closed-Set Amendment / Open Q1 | A poorly-placed token muddies the topic partition's meaning for every later reader; recoverable but annoying to move once catalog rows cite it |
| A2 | `needsReload` should be `false` on the install-disabled row (nothing net entered or left Pi's resource view within the command) | Pattern 4 / Open Q2 | A wrong stamp either suppresses a needed `/reload` hint or emits a false one; `tests/architecture/notify-will-reload-agreement.test.ts` and `notify-producer-wire-coverage.test.ts` exist and may pin it either way |
| A3 | `INSTALL_STATUSES` is not pinned by any architecture test, so adding `"disabled"` needs no test edit | Pattern 4 | If a gate does pin it, one extra test edit — cheap, but it would surface as a red run rather than a planned task |
| A4 | The `import` cascade test lives under `tests/orchestrators/import/` | Validation Architecture | Test lands in the wrong file; trivially corrected at plan time |
| A5 | `declaresAgents` / `declaresMcp` should stay truthful (declaration predicates) even on the disabled path, while `resourcesChanged` becomes `false` | Pitfall 2 | Consumers (`import/execute.ts`, `reconcile/apply.ts::dependenciesFromInstall`) may render a soft-dep marker the disabled row is supposed to suppress — though the render arm hard-codes both flags false, so the blast radius is the cascade summary, not the row |

## Open Questions

1. **Which `notify-reasons.ts` topic group houses `installs disabled`?**
   - What we know: the three shared groups are `IDEMPOTENT_REASONS`
     (`:37-44`), `UNSUPPORTED_REASONS` (`:91-100`) and `FAILURE_REASONS`
     (`:107-142`), plus the type-only `CommandPrivateReason` (`:207-214`). D-102-06
     mandates a **shared** home. The token is neither an idempotent no-op, nor a
     failure, nor an unsupported component.
   - What is unclear: whether to stretch `UNSUPPORTED_REASONS`' charter, or add a
     fourth shared group (a "declared-state" / "author-declared" topic).
   - Recommendation: add a fourth shared group with a one-sentence charter and
     fold it into `SharedTopicReason` (`:198`). Precedent for a small group
     exists — `IDEMPOTENT_REASONS` holds six. Stretching `UNSUPPORTED_REASONS`
     would make the group's own doc comment ("the topic group the user named
     explicitly") false. Confirm at plan time; it is a one-line difference either
     way but the comment burden differs.

2. **Does the install-disabled row stamp `needsReload: true` or `false`?**
   - What we know: the disable verb's fresh row stamps `true` because its
     artifacts were unstaged from under a running Pi
     (`enable-disable.ts:1186-1193`, RLD-05 / D-07). The install-disabled path
     stages and unstages within one command, so Pi never saw the artifacts — the
     net delta to `aggregateDiscoveredResources` is zero. Inventory rows
     (`list`'s disabled row) stamp `false`.
   - What is unclear: whether `tests/architecture/notify-will-reload-agreement.test.ts`
     or `notify-producer-wire-coverage.test.ts` constrain a `disabled` row's
     stamp per-status rather than per-producer.
   - Recommendation: `false`. Read both gates during planning and record the
     answer as a decision so the executor does not re-litigate it.

3. **How does OUT-04's "how to enable it" reach the user?**
   - What we know: there is exactly one precedent for a remediation trailer —
     `partialHint?: boolean` on `PluginUnavailableMessage` /
     `PluginPartiallyAvailableMessage` (`notify.ts:845-851`), which the renderer
     turns into a byte-frozen 4-space-indented literal
     (`PARTIAL_INSTALL_HINT_TRAILER`, `notify.ts:2528`). `PluginDisabledMessage`
     has no such field. The alternative is to let the `{installs disabled}` token
     carry the fact and say nothing about the remedy.
   - What is unclear: whether OUT-04's "and how to enable it" requires a rendered
     remedy string, or is satisfied by the token plus the documented command.
   - Recommendation: add a boolean hint field on `PluginDisabledMessage` plus one
     byte-frozen trailer literal, modeled exactly on `partialHint`. It keeps the
     renderer dumb (a boolean in, a fixed literal out — no interpolation, matching
     T-69-01's no-interpolation precedent) and satisfies the requirement's plain
     reading. Get this confirmed before planning: it is the only new *field* in
     the phase and the only place the phase touches the render layer beyond a
     lifted arm.

4. **Does the reconcile cascade need a distinct outcome kind for an
   install-that-landed-disabled?**
   - What we know: `applyPluginInstalls` pushes `kind: "plugin-installed"`
     (`apply.ts:594`) and a sibling `kind: "plugin-disabled"` already exists
     (`apply-outcomes.ts:198`) for the toggle path. The reconcile projection
     (`reconcile/notify.ts`) renders realized-transition rows and is gated by
     `tests/architecture/notify-stamp-coverage.test.ts`.
   - What is unclear: whether this phase must make the reconcile cascade *render*
     the disabled outcome truthfully, or whether that is DFEN-06's business.
   - Recommendation: in scope, minimally. D-102-04 puts a reconcile install on the
     disabled path in this phase, so a cascade row reading `(installed)` over a
     record that is disabled is the same contradiction the codebase repeatedly
     refuses elsewhere (see the `(partially-installed)` reasoning at
     `enable-disable.ts:284-289`). Reuse the existing `plugin-disabled` outcome
     kind if its shape fits.

## Project Constraints (from CLAUDE.md)

- **Never commit to `main`.** Work happens on `features/defaults-enabled` in the
  worktree at `/home/acolomba/pi-claude-marketplace/.worktrees/defaults-enabled`.
- **Run `pre-commit run --all-files` BEFORE `git commit`**, fix, restage, re-run
  until clean. Never `--no-verify`. Never `--amend` to recover from a hook
  failure.
- **Committing from a worktree:** prefix with `SKIP=trufflehog` only after
  confirming a clean filesystem scan by the documented route. Do not extend
  `SKIP=` to other hooks.
- **Conventional Commits**, title 5–72 chars, body lines ≤ 80. **No GSD
  milestone/phase mentions in commit messages or PR titles.**
- **`npm run check` must stay green** (NFR-6) — typecheck + ESLint + Prettier +
  tests + integration tests.
- **All user-visible output through `notify()` / `notifyWithContext()`** from
  `shared/notify.ts` (IL-2). Direct `ctx.ui.notify` outside that module is
  lint-forbidden and grep-gated; `process.stdout` / `process.stderr` writes are
  forbidden in `extensions/**`.
- **Comment policy** (`.claude/rules/typescript-comments.md`): no `Phase NN`,
  `Plan NN`, `Wave N`, `Task N`, `milestone vX.Y`, or bare `Pitfall N` /
  `Pattern N` in source comments or test titles. Decision and requirement IDs
  (`D-102-01`, `DFEN-04`, `ENBL-18`, `NFR-5`, …) are the sanctioned anchors.
  **Note:** the numbered pitfalls in this document are RESEARCH-local; they must
  not be cited by number in source.
- **Lint budget:** `sonarjs/cognitive-complexity` is `["error", 15]`.
  `installPlugin` already carries an
  `// eslint-disable-next-line sonarjs/cognitive-complexity` at `install.ts:1327`
  — adding a branch inside it is allowed but each new suppression needs a stated
  reason.
- **Style:** Prettier `printWidth: 100`; explicit return types on every exported
  function; braces always; blank line after every block-like statement;
  `import-x/order` groups with type-only imports last.
- **Markdown is formatted by `mdformat`, not Prettier** — `npm run format:check`
  covers only js/json/ts. Never run `prettier --write` over `.md`.
- **Project skills:** `simple-english` is the relevant one for the notification
  wording under Claude's Discretion (D-102-07); the
  `spike-findings-pi-claude-marketplace` skill covers unrelated subjects
  (migration removal, dependency declarations, progress UI, workflows bridge).

## Sources

### Primary (HIGH confidence) — files opened with `Read` this session

- `extensions/pi-claude-marketplace/orchestrators/plugin/install.ts` (full,
  2440 lines) — ledger composition, write-back call site, notification arms
- `extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts`
  (full, 1290 lines) — the disable branch being composed
- `extensions/pi-claude-marketplace/orchestrators/plugin/install.messaging.ts`,
  `enable-disable.messaging.ts` — command-private status sets and render maps
- `extensions/pi-claude-marketplace/shared/notify.ts` (lines 30-289, 460-539,
  760-880, plus greps for glyphs/hints) — `REASONS`, `STATUS_TOKENS`,
  `PLUGIN_STATUSES`, `PluginDisabledMessage`, `partialHint`
- `extensions/pi-claude-marketplace/shared/notify-reasons.ts` (full) — topic
  partition and the completeness proof
- `extensions/pi-claude-marketplace/persistence/config-write-back.ts` (full),
  `config-io.ts` (full), `config-merge.ts` (full)
- `extensions/pi-claude-marketplace/persistence/state-io.ts` (lines 120-208) —
  `toDisabledRecord`, `isRecordedButDisabled`, record schema
- `extensions/pi-claude-marketplace/domain/resolver.ts` (lines 160-280, 630-670)
  — `MaterializablePlugin`, `defaultEnabled`, `resolveDefaultEnabled`
- `extensions/pi-claude-marketplace/orchestrators/reconcile/plan.ts` (lines
  250-390), `reconcile/apply.ts` (lines 545-730), `reconcile/types.ts:84`
- `extensions/pi-claude-marketplace/orchestrators/import/refs.ts` (lines 1-80),
  `import/execute.ts` (lines 680-850)
- `extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts`
  (`cascadeUnstagePlugin`, lines 304-360),
  `orchestrators/plugin/shared.ts:855` (`applyPartialCascadeFold`)
- `tests/architecture/compat-01-no-expansion.test.ts` (lines 80-320),
  `notify-closed-set-locks.test.ts` (lines 1-62),
  `import-boundaries.test.ts` (lines 160-240),
  `no-orchestrator-network.test.ts` (lines 53-95),
  `catalog-uat.test.ts` (lines 1-60, 4880-4912),
  `notify-producer-wire-coverage.test.ts` (header),
  `notify-stamp-coverage.test.ts` (header),
  `cross-op-convergence.test.ts` (header)
- `tests/shared/notify-disabled-reasons.test.ts` (header)
- `docs/output-catalog.md` (install section, lines 455-600; catalog-state index)
- `.planning/config.json` (`nyquist_validation: true`), `package.json` scripts
- `CLAUDE.md`, `.claude/rules/typescript-comments.md`,
  `.planning/codebase/{STACK,CONVENTIONS,ARCHITECTURE}.md`

### Secondary (MEDIUM confidence)

- `102-CONTEXT.md` upstream claim, recorded 2026-08-14: the Claude Code
  `defaultEnabled` upstream contract (consulted at install and enable time only;
  an existing `enabledPlugins` setting takes precedence and persists across
  update and reinstall), verified during discuss against
  `code.claude.com/docs/en/plugins-reference`. Carried forward here as recorded;
  not re-fetched this session.

### Tertiary (LOW confidence)

- None. Every claim in this document that is not the upstream-contract note above
  is anchored to a file read in this session.

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — no external packages; every in-repo seam was opened and
  quoted with line ranges
- Architecture: HIGH — the composition, the import-cycle block, the lock
  re-entrancy block, and the write-back call site are all read directly from
  source and from the architecture tests that enforce them
- Closed-set amendment: HIGH — the tuple was counted programmatically (38) and
  cross-checked against `notify-closed-set-locks.test.ts:37`; the two tests that
  take the delta were opened
- Pitfalls: HIGH for the hooks-cache and write-target hazards (both read from
  source); MEDIUM for the `resourcesChanged` over-report (the consumer behavior
  is read from source, the desired value is a judgment)
- Open questions: MEDIUM — three of the four are genuine design choices D-102's
  discretion clauses leave open, not gaps in the investigation

**Research date:** 2026-08-14
**Valid until:** 2026-09-13 (30 days — the target modules are stable; the only
invalidator would be another milestone landing a `REASONS` amendment first)
