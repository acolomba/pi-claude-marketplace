---
phase: 102
plan: 01
subsystem: install-orchestration
tags: [defaults-enabled, notify-closed-set, install-ledger, config-write-back, hooks-cache]
status: complete

requires:
  - "domain/resolver.ts::defaultEnabled (non-optional on both materializable arms)"
  - "orchestrators/marketplace/shared.ts::cascadeUnstagePlugin"
  - "persistence/state-io.ts::toDisabledRecord"
  - "orchestrators/plugin/shared.ts::applyPartialCascadeFold"
  - "persistence/config-write-back.ts::writeBatchedConfigEntries"
provides:
  - "REASONS member `installs disabled` (index 38 of 39)"
  - "shared/notify-reasons.ts::DECLARED_STATE_REASONS / DeclaredStateReason"
  - "shared/notify.ts::PluginDisabledMessage.enableHint + ENABLE_HINT_TRAILER"
  - "install.messaging.ts::INSTALL_STATUSES `disabled` arm"
  - "InstallPluginOptions.applyDefaultEnabled"
  - "InstallPluginOutcome.landedDisabled"
affects:
  - "orchestrators/reconcile/* (102-03 reads landedDisabled and stamps the config key)"
  - "orchestrators/import/execute.ts (consumes resourcesChanged; deliberately not edited)"

tech-stack:
  added: []
  patterns:
    - "materialize-then-disable: the ledger runs whole, then the disable primitives run inside the same lock"
    - "closed-set tail append with a compile-time partition proof as the completeness gate"
    - "boolean hint field in, byte-frozen trailer literal out (no interpolation)"

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/shared/notify.ts
    - extensions/pi-claude-marketplace/shared/notify-reasons.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/install.messaging.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/install.ts
    - extensions/pi-claude-marketplace/edge/handlers/plugin/install.ts
    - tests/architecture/compat-01-no-expansion.test.ts
    - tests/architecture/notify-closed-set-locks.test.ts
    - tests/orchestrators/plugin/install.test.ts
    - tests/shared/notify-v2.test.ts

decisions:
  - "DS-1: the token's topic home is a FOURTH shared group (DECLARED_STATE_REASONS), not a stretched UNSUPPORTED_REASONS"
  - "DS-2: the install-disabled row stamps needsReload: false — nothing net entered or left Pi's resource view inside the command"
  - "DS-4: the standalone write-back keeps writeBatchedConfigEntries so CR-02's single atomic save survives"
  - "The disable half is composed from primitives; install.ts gains no edge to enable-disable.ts and never calls setPluginEnabled"
  - "The disable-cascade failure arm RETURNS its cause and saves the shrunken record rather than throwing, because a closure throw discards the mutated snapshot"

metrics:
  duration: ~55min
  completed: 2026-08-14

actuals:
  tokens: 14000
  tasks: 2
  commits: 2
---

# Phase 102 Plan 01: Reason token, install write-through and notification Summary

A plugin whose resolved `defaultEnabled` is `false` now installs, immediately
disables itself through the same primitives the `disable` verb uses, writes
`enabled: false` through to `claude-plugins.json`, and reports
`◍ <plugin> v<version> (disabled) {installs disabled}` at informational severity
with a frozen trailer naming the `enable` remedy.

## What Was Built

**The closed-set amendment (OUT-01).** `installs disabled` appended at the tail
of `REASONS` as index 38 of a 39-member tuple; every prior member keeps its byte
form and index. Its topic home is a new fourth shared group,
`DECLARED_STATE_REASONS`, folded into `SharedTopicReason` — without that fold
`_UncoveredReason` stops resolving to `never` and `npm run typecheck` fails
TS2344, which is what made the four-site amendment indivisible. Three stale
prose counts (one `37-entry` in `notify.ts`, two `38-entry` in
`notify-reasons.ts`) were corrected in the same edit.

**The render-layer hint pair (OUT-04 / D-102-10).** `enableHint?: boolean` on
`PluginDisabledMessage`, the module-private `ENABLE_HINT_TRAILER`
(`Run enable on this plugin to use its components.`), and a render gate in
`composePluginLinesWith` that pushes it as a 4-space-indented line. Modeled
exactly on the `partialHint` / `PARTIAL_INSTALL_HINT_TRAILER` precedent: a
boolean goes in, a frozen literal comes out, nothing is interpolated. The
`PluginDisabledMessage` doc sentence claiming `reasons` admits exactly one
member was amended in the same edit.

**Install's `disabled` arm.** `"disabled"` joins the command-private
`INSTALL_STATUSES`, `PluginDisabledMessage` joins `InstallMsg`, and the render
arm is lifted verbatim from `DISABLE_RENDER.disabled` — same token sequence,
same `ICON_DISABLED`, both soft-dep flags hard-coded `false` (ENBL-15 /
D-100-06). No eighth glyph, no new status token.

**The materialize-then-disable composition (D-102-01).** Two new module-private
helpers in `install.ts`. `disableFreshlyInstalledPlugin` runs inside the
existing `withLockedStateTransaction` closure, after `runInstallLedger` and
before the write-back: `cascadeUnstagePlugin`, then `toDisabledRecord` with the
map slot REPLACED rather than mutated, then a hooks-cache drop.
`dropInstallDisabledHooks` is the install-local cache-drop helper — written
distinctly rather than copied from `enable-disable.ts`, since
`sonarjs/no-identical-functions` is an error here. The six-phase literal array
and all six phase bodies, including the state phase's unconditional
`enabled: true`, are untouched; the disable half overwrites that value
afterwards.

**The precedence gate (DFEN-05, partial).** The install lands disabled only when
all three hold: the caller passed `applyDefaultEnabled`, the TARGET physical
config carries no explicit `enabled` for the key, and the resolved
`defaultEnabled` is false. `current` was hoisted out of the write-back block so
the precedence read and the write share one view of one physical file — never a
merged view, which `config-write-back.ts` is forbidden from reaching.

**The write-back's first field (DFEN-04 / D-102-09).** The plugin patch in the
existing batched `writeBatchedConfigEntries` call carries `enabled: false` via a
conditional spread when the install landed disabled, and stays `{}` otherwise.
The `!== "orchestrated"` guard was NOT widened.

**The hooks-dispatch gap (T-102-01).** The post-`tx.save()`
`readAndCachePluginHooks` + `rebuildRoutingTables` block is now gated off on the
install-disabled path. Left ungated it would have registered routing entries for
a plugin whose on-disk `hooks.json` the cascade had just deleted — live hook
dispatch against code the user's configuration says is disabled, uncleared until
the next hydrate.

**The caller opt-in.** `applyDefaultEnabled?: boolean` on
`InstallPluginOptions`, set unconditionally by the standalone edge handler.
`import` is untouched (D-102-03): on that path the config entry does not exist
yet when `installPlugin` runs, so an absent-entry inference would have installed
every imported plugin disabled.

**The outcome signals.** `resourcesChanged: false` on the disabled path (the
ledger staged, but nothing survived the command), plus a new optional
`landedDisabled?: true` for 102-03's reconcile projection to read.
`declaresAgents` / `declaresMcp` stay truthful — they are declaration
predicates, and a disabled plugin still declares.

## Key Implementation Details

**The disable-cascade failure arm returns rather than throws.** A throw from
inside the guard closure discards the mutated snapshot (ST-7), which would leave
`state.json` claiming artifacts the cascade had already removed from disk
(NFR-3). Instead the helper folds `cascade.dropped` out of the record via
`applyPartialCascadeFold`, bumps `updatedAt`, drops the hooks cache when hooks
dropped, and hands the cause back; the caller saves the shrunken record and the
post-guard path emits the EXISTING install `(failed)` row carrying that cause.
No new failure semantics, no new rollback composition, no new reason token
(D-102-02). The record stays `enabled: true` with a shrunken inventory, which is
exactly what an `install` followed by a failed `disable` produces.

**The verdict travels on an object, not a bare `let`.** `disabledInstall` holds
both `landed` and the optional `cascadeError`, so the guard closure's writes
stay legible to the post-guard reads without an
`@typescript-eslint/no-unnecessary-condition` override at each of the four read
sites — the pattern the file's own `capture` bag already uses.

**No import edge to `enable-disable.ts`.** That module already imports
`runInstallLedger` from `install.ts`, so the reverse edge — including
`import type` — closes a cycle `import-x/no-cycle` rejects for
`orchestrators/**`. `cascadeUnstagePlugin` is imported directly from
`../marketplace/shared.ts`, the sanctioned seam both `uninstall.ts` and
`enable-disable.ts` already use, which also keeps `no-orchestrator-network`
green (it introduces no gitOps surface token).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] A third closed-set gate the plan did not name**

- **Found during:** Task 1 verification (`node --test "tests/shared/**/*.test.ts"`)
- **Issue:** `tests/shared/notify-v2.test.ts:5019` asserts
  `REASONS.slice(-3)` equals
  `["malformed mcp", "malformed skill", "malformed command"]`. The plan named
  only two gate files (`compat-01-no-expansion.test.ts`,
  `notify-closed-set-locks.test.ts`); this third one is end-anchored, so it
  goes red on ANY tail append — including the one OUT-08 explicitly sanctions.
- **Fix:** Re-anchored the assertion on `malformed mcp`'s own index rather than
  on the tuple's end. The test's stated intent ("the two per-kind tokens sit
  immediately after `malformed mcp`, and `malformed mcp` keeps its position")
  is preserved exactly; only the anchor moved, with a comment recording why an
  end-anchored slice reads every sanctioned append as a reorder.
- **Files modified:** `tests/shared/notify-v2.test.ts`
- **Commit:** e2c04e88

**2. [Rule 3 - Blocking] `defaultEnabled === false` is a lint error**

- **Found during:** Task 1 lint
- **Issue:** `@typescript-eslint/no-unnecessary-boolean-literal-compare` — the
  resolver's `defaultEnabled` is a plain non-optional boolean, so comparing it
  to a literal is redundant. The plan's step (6) prescribed
  `installCtx.resolved.defaultEnabled === false` verbatim.
- **Fix:** `!result.installCtx.resolved.defaultEnabled`. Semantics identical;
  the non-optional typing is precisely why no `?? true` fallback is needed.
- **Files modified:** `extensions/pi-claude-marketplace/orchestrators/plugin/install.ts`
- **Commit:** e2c04e88

**3. [Rule 1 - Bug] A two-letter marketplace name defeated its own assertion**

- **Found during:** Task 2 (the D-102-10 non-interpolation case)
- **Issue:** The trailer-interpolation test asserted the trailer does not
  contain the marketplace name. With the file's conventional fixture name
  `mp`, the assertion fails on `co-mp-onents` inside the trailer's own prose —
  a false positive that says nothing about interpolation.
- **Fix:** That fixture uses `acme-registry` / `widget`, with a comment stating
  why the names are deliberately distinctive.
- **Files modified:** `tests/orchestrators/plugin/install.test.ts`
- **Commit:** cdf953e0

### Plan-directed rewrite (not a deviation)

The `DFEN-01` characterization block at `install.test.ts:780-868` asserted the
OPPOSITE of DFEN-04 for exactly the fixtures this plan changes. Rewriting it was
Task 1 step (14), and it was done there: retitled to `DFEN-04 / OUT-04`, its
two-declaration-site loop and `DFEN_DECLARATION_SITES` table kept, and every
iteration's assertions inverted. The header prose explaining that the value is
"read, not acted on" was removed as false.

## Verification Results

| Gate | Result |
|---|---|
| `npm run typecheck` | exit 0 — the `_ReasonsCoverageProof` partition proof and the total `INSTALL_RENDER` map both resolve |
| `npm run lint` | exit 0 — including `import-x/no-cycle` over `orchestrators/**` and `sonarjs/no-identical-functions` |
| `npm run format:check` | exit 0 |
| `node --test tests/orchestrators/plugin/install.test.ts` | 107/107 pass |
| `node --test "tests/architecture/**/*.test.ts" "tests/shared/**/*.test.ts"` | 690 pass, 0 fail, 1 skipped |
| `npm run check` | exit 0 (typecheck + lint + format:check + test + test:integration) |

Plan acceptance greps, all satisfied:

| Check | Expected | Actual |
|---|---|---|
| `installs disabled` in `notify-reasons.ts` (comments stripped) | 1 | 1 |
| `DeclaredStateReason` in `notify-reasons.ts` (comments stripped) | 2 | 2 |
| `from "./enable-disable.ts"` in `install.ts` | 0 | 0 |
| `setPluginEnabled` in `install.ts` | 0 | 0 |
| `cascadeUnstagePlugin\|toDisabledRecord\|applyPartialCascadeFold` in `install.ts` | ≥4 | 6 |
| `\b(Phase\|Plan\|Wave\|Task) [0-9]` in the four source files | 0 | 0 |

Behavioral proof, from `tests/orchestrators/plugin/install.test.ts`:

```
● mp [project]
  ◍ hello v0.0.1 (disabled) {installs disabled}
    Run enable on this plugin to use its components.
```

One emission, no severity arg (informational), with `state.json` carrying
`enabled: false` and a populated `resources.skills` / `resources.prompts`, no
staged skill directory or command file on disk, and
`claude-plugins.json` holding exactly `{ "hello@mp": { "enabled": false } }`.

## Threat Mitigations Verified

| Threat | Severity | Verified how |
|---|---|---|
| T-102-01 — a disabled plugin's hooks still dispatching | high | The post-save cache block is gated off on the disabled path and the disable composition drops the cache instead. Asserted by `T-102-01: an install-disabled plugin gets no hooks routing entry and no on-disk hooks config`, with the contrasting enabled-install case proving the assertion cannot pass vacuously. |
| T-102-02 — a path-escaping config write | medium | The new `enabled: false` rides the EXISTING batched patch; no new write path. `saveConfig`'s `CONFIG_VALIDATOR.Check` + `assertPathInside` are unchanged. |
| T-102-03 — non-boolean `defaultEnabled` smuggling truthiness | low | This plan only READS the already-resolved boolean; no coercion added. |
| T-102-04 — absolute-path leakage in the new row | medium | Asserted twice: the end-to-end case checks the message contains no `cwd`, and the OUT-04 row case repeats it. The trailer interpolates nothing and is separately asserted to name neither plugin, marketplace nor version. |
| T-102-SC — package installs | low | No package installed; `package.json` untouched. |

## Known Stubs

None. No stub, TODO, FIXME, skipped test or unrun `<verify>` was introduced.

## Deferred to Later Plans

Named here only because this plan's outputs are their inputs — none is an
unfinished part of this plan:

- **102-02** — DFEN-05 in both directions (explicit `enabled: true` / `false`
  wins and is never rewritten), the D-102-03 `import` proof, and the D-102-02
  cascade-failure case. The failure BEHAVIOR ships here; its test is 102-02-T3.
- **102-03** — the reconcile-side absent-key stamp driven by
  `PlannedPluginInstall.configSource`, and the reconcile projection that reads
  `landedDisabled`.
- **DOC-01** — `docs/output-catalog.md` takes no delta this phase by design;
  adding a catalog block here would additionally require a `FIXTURES` entry in
  `catalog-uat.test.ts`.

## Self-Check: PASSED

Files claimed modified — all present on disk and in the two commits:
`shared/notify.ts`, `shared/notify-reasons.ts`,
`orchestrators/plugin/install.messaging.ts`, `orchestrators/plugin/install.ts`,
`edge/handlers/plugin/install.ts`, `tests/architecture/compat-01-no-expansion.test.ts`,
`tests/architecture/notify-closed-set-locks.test.ts`,
`tests/orchestrators/plugin/install.test.ts`, `tests/shared/notify-v2.test.ts`.

Commits claimed — both present in `git log`:
`e2c04e88` (9 files, +428/-52), `cdf953e0` (1 file, +279).
