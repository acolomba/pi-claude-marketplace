---
phase: 102-reason-token-install-write-through-and-notification
reviewed: 2026-08-14T00:00:00Z
depth: standard
files_reviewed: 12
files_reviewed_list:
  - extensions/pi-claude-marketplace/edge/handlers/plugin/install.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install.messaging.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts
  - extensions/pi-claude-marketplace/shared/notify-reasons.ts
  - extensions/pi-claude-marketplace/shared/notify.ts
  - tests/architecture/compat-01-no-expansion.test.ts
  - tests/architecture/notify-closed-set-locks.test.ts
  - tests/orchestrators/import/execute.test.ts
  - tests/orchestrators/plugin/install.test.ts
  - tests/orchestrators/reconcile/apply.test.ts
  - tests/shared/notify-v2.test.ts
findings:
  critical: 2
  warning: 4
  info: 2
  total: 8
status: fixed
fixed:
  - id: CR-01
    commit: f7b25a11
    note: >-
      precedence read now spans both physical config files; the merged ENTRY is
      selected before its `enabled` field is read, because CFG-02 replaces the
      entry wholesale
  - id: CR-02
    commit: 9549f43e
    note: >-
      the early `tx.save(); return;` was removed so the failure path falls
      through to the existing per-mode write arms; no fourth writer added
  - id: WR-01
    commit: f1555f05
  - id: WR-04
    commit: f1555f05
  - id: WR-02
    commit: 0ad20290
  - id: WR-03
    commit: ee536f1e
skipped:
  - id: IN-01
    note: resolved by WR-02 — the row composition is now shared, not dead
  - id: IN-02
    note: existing house style; four render arms left as they are
---

# Phase 102: Code Review Report

**Reviewed:** 2026-08-14T00:00:00Z
**Depth:** standard
**Files Reviewed:** 12
**Status:** issues_found

## Summary

Reviewed the phase-102 diff only (`git diff ec7d2e71^..HEAD`), tracing the new
install-disabled path through `runInstallLedger` -> `disableFreshlyInstalledPlugin`
-> `cascadeUnstagePlugin` / `toDisabledRecord` / `applyPartialCascadeFold`, the two
config write targets (`writeBatchedConfigEntries` vs `writePluginConfigEntry`), the
reconcile projection in `orchestrators/reconcile/notify.ts`, and the renderer arm in
`shared/notify.ts`.

The parts the phase set out to prove hold up. The `DECLARED_STATE_REASONS` partition
carries a genuine compile-time completeness proof (`_ReasonsCoverageProof`), the
`INSTALL_RENDER` map is total over `InstallStatus` by mapped type, the disable half
composes the same primitives the `disable` verb composes rather than re-implementing
them, `toDisabledRecord`'s `resources: R` passthrough is preserved so the record keeps
its inventory, and the hooks parsed-config cache is dropped (never populated) on the
install-disabled path — `T-102-01` proves the routing bucket stays empty and the staged
`hooks.json` is gone, with a genuine enabled-contrast case beside it.

Two defects are load-bearing. First, the DFEN-05 precedence gate reads only the ONE
physical config file the caller happened to target, so on the standalone path the exact
cross-file failure the code's own doc comment describes as "silent in both directions"
is live and unguarded. Second, the D-102-02 failure window saves a record without ever
writing the matching config entry; on the reconcile path that combination is a permanent
unconverged state, and on the standalone path it blocks the retry NFR-3 requires.

Four warnings follow, three of them about what the user actually reads: the reconcile
cascade never emits the reason token this phase introduced, the standalone disabled row
silently swallows degradation facts the governing rule says must be rendered, and
`docs/output-catalog.md` — a binding byte-equality contract in this repo — gained no row
for any of the new bytes.

## Narrative Findings (AI reviewer)

### Critical Issues

#### CR-01: The standalone precedence gate reads one physical config file, so an explicit `enabled: true` in the sibling file is overridden and contradicted

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/install.ts:1511,1541,1566`
**Severity:** BLOCKER

**Issue:**
`targetConfigPath` is selected from `opts.local` alone
(`selectConfigWriteTarget(locations, opts.local)`, line 1511), `current` is loaded from
that one file (line 1541), and the precedence read at line 1566 is:

```ts
const declaredEnabled = current.plugins?.[`${plugin}@${marketplace}`]?.enabled;
```

The reconcile caller was given `configSource` provenance precisely so it addresses the
physical file the declaration lives in. The standalone edge handler was not: it passes
only the user's `--local` flag, which says which file to WRITE, not which file the
declaration is IN.

Concrete failure. `claude-plugins.local.json` declares `"p@mp": { "enabled": true }`
(hand-authored, or written by a previous `--local` install) and no state record exists
yet. The user runs `/claude:plugin install p@mp` with no `--local`. The read targets the
BASE file, finds no key, reports `declaredEnabled === undefined`, and — for a plugin
declaring `defaultEnabled: false` — installs it DISABLED against the user's explicit
word, then stamps `enabled: false` into `claude-plugins.json`.

Both halves are wrong, and the second is worse than the first. Per CFG-02 a local entry
replaces the base entry for that key wholesale, so the merged view still reads
`enabled: true`; the next reconcile pass therefore plans an enable and the record
self-heals, but the spurious `enabled: false` the user never typed stays in the base
config file permanently. `InstallPluginOptions.local`'s own doc comment (lines 358-369)
names this exact failure — "reading the base file for a locally-declared plugin reports
`enabled` absent even when the local entry says `enabled: true`, installing the plugin
disabled against the user's explicit word" — and the fix landed on the reconcile caller
only.

No test covers it: every `DFEN_PRECEDENCE_CASES` fixture seeds the entry into
`locations.configJsonPath` and installs without `--local`, so base-only and merged agree
by construction.

**Fix:** Read the `enabled` key from the MERGED per-scope view (base ∪ local, local
wins), not from `current`. `siblingConfigPath` is already computed and already read fresh
inside the lock for the UAT-05 marketplace-membership test, so the input is in hand:

```ts
// DFEN-05: the effective declaration is the MERGED one -- a local entry replaces
// the base entry for that key wholesale (CFG-02), so the target file alone cannot
// answer "did the user state an opinion".
const key = `${plugin}@${marketplace}`;
const sibling = await loadConfig(siblingConfigPath);
const siblingPlugins = sibling.status === "valid" ? sibling.config.plugins : undefined;
const declaredEnabled = opts.local === true
  ? (current.plugins?.[key]?.enabled ?? siblingPlugins?.[key]?.enabled)
  : (siblingPlugins?.[key]?.enabled ?? current.plugins?.[key]?.enabled);
```

(the `local`-wins ordering must match `config-merge.ts`, not the target-file choice).
Add a regression case to `DFEN_PRECEDENCE_CASES` that seeds `{ enabled: true }` into
`configLocalJsonPath` and installs WITHOUT `--local`.

---

#### CR-02: The D-102-02 failure window saves a state record with no config declaration — retry is blocked standalone, and reconcile never converges

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/install.ts:1584-1592`
**Severity:** BLOCKER

**Issue:**
When `disableFreshlyInstalledPlugin` reports `ok: false` the closure saves the shrunken
record and returns:

```ts
disabledInstall.cascadeError = disableResult.cause;
await tx.save();
return;
```

The `return` happens BEFORE both config write arms (lines 1622-1681). So the record is
persisted while the config entry is never written. The record is `enabled: true` with a
partially-folded inventory, and the user sees a `(failed)` row. Two distinct bad end
states follow, neither characterized by `D-102-02 / NFR-3: a disable cascade that
throws...` (which asserts state and disk but never inspects `claude-plugins.json`):

1. **Standalone: the retry NFR-3 mandates is rejected.** No config entry exists, but a
   state record does. The user reads `(failed)` and re-runs `install`; `runInstallLedger`'s
   PI-15 early-sanity check (line 811) sees `targetMp.plugins[plugin] !== undefined` and
   throws `already-installed`. The only escape is `uninstall` first — a remedy nothing in
   the failure row names. Before this phase a failed install threw, the snapshot was
   discarded, and the retry was clean.

2. **Reconcile (orchestrated): a permanent unconverged state.** The declaration is a bare
   `"p@mp": {}` (that is how the op reached the install bucket) and the record is now
   recorded-and-enabled. `plan.ts` classifies that as steady state — not
   `enabledExplicitFalse`, `recorded === true`, `!isRecordedButDisabled(record)` — so no
   action is planned on any subsequent pass. The plugin's `defaultEnabled: false` is never
   honored, its skills and commands are gone from disk while the record and config both
   claim it is installed and enabled, and after the single `plugin-install-failed` row on
   the first reload the cascade is silent forever. Reconcile is config-to-record and does
   not deep-diff artifacts, so nothing else repairs it either.

The reachability is not exotic: the phase's own test reaches it with one AG-5 foreign
agent file plus a matching `agents-index.json` row.

**Fix:** Write the config entry on this path too, so record and declaration stay in
agreement and the two convergence paths still have something to act on. Since the cascade
did NOT complete, the truthful declaration is the one that lets a later pass retry the
disable:

```ts
if (!disableResult.ok) {
  disabledInstall.cascadeError = disableResult.cause;
  // The record is enabled with a partial inventory. Declare `enabled: false`
  // anyway: the record and the declaration then disagree, which is exactly the
  // divergence reconcile's disable bucket exists to close on the next pass,
  // instead of the steady state a bare entry produces.
  await writePluginConfigEntry(
    current, targetConfigPath, locations.scopeRoot, plugin, marketplace, { enabled: false },
  );
  await tx.save();
  return;
}
```

and extend the characterization test to assert the resulting `claude-plugins.json` entry
plus a second `applyReconcile` pass that plans (and completes) the disable. If instead the
intent is that a failed cascade must leave nothing behind, remove the record rather than
saving it — but "save a record, write no declaration" is not a state either convergence
path can act on.

### Warnings

#### WR-01: The reconcile cascade row for an install-disabled plugin carries no reason token, no enable hint, and no version

**File:** `extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts:621-626`
**Severity:** WARNING

**Issue:**
The push is bare:

```ts
outcomes.push({ kind: "plugin-disabled", scope, marketplace, plugin });
```

`PluginDisabledOutcome` supports `version?`, and the projection arm
(`orchestrators/reconcile/notify.ts:711-719`) forwards `reasons` when present and stamps
`severity: "info"`. Because nothing is supplied, the rendered row is
`◍ foo (disabled)` — no `{installs disabled}`, no `Run enable on this plugin...` trailer,
and no `v<version>` that every other reconcile `(disabled)` row carries (the toggle path
at line 887-897 forwards it via `...info`).

That is the wrong surface to be silent on. The reconcile install-disabled case is the
COMMON one — a user hand-adds a bare entry, reloads, and a plugin silently arrives inert.
The standalone row explains itself in full; the unattended one renders identically to a
user-requested disable, so the closed-set token this phase introduced, and the completeness
proof and catalog-stability machinery built around it, never reach the user who needs it.
`tests/orchestrators/reconcile/apply.test.ts` asserts only `args[0].includes("(disabled)")`,
which passes over the whole gap.

**Fix:** Stamp the cause on the outcome and thread it through the projection:

```ts
outcomes.push({
  kind: "plugin-disabled",
  scope: op.scope,
  marketplace: op.marketplace,
  plugin: op.plugin,
  // DFEN-04: name the author-declared cause, exactly as the standalone row does.
  reasons: ["installs disabled"],
});
```

adding `readonly reasons?: readonly ContentReason[]` to `PluginDisabledOutcome` and
forwarding it in the `plugin-disabled` arm. Exposing `version` on
`InstallPluginOutcome`'s `installed` arm would also close the version-slot asymmetry.
Assert the token and the trailer in the reconcile test rather than the bare
`(disabled)` substring.

---

#### WR-02: The standalone disabled row discards `partially-installed` state and every frontmatter-degradation fact, including their warning severity

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/install.ts:2164-2172`
**Severity:** WARNING

**Issue:**
`disabledRow` is a flat literal: `reasons: ["installs disabled"]`, `severity: "info"`,
and no dropped-kind or degraded-kind threading. The `installedRow` built directly above
it (lines 2132-2153) does all of that work — `narrowUnsupportedKinds(...unsupported)` for
the `partially-available` arm, `malformedReasonsForKinds(...)` for degraded skills and
commands, and `successSeverity` raising to `"warning"` when
`frontmatterDegradations.length > 0` — and then it is thrown away by the ternary at line
2182.

So `/claude:plugin install --partial p@mp` on a plugin declaring `defaultEnabled: false`
renders `◍ p v1.0.0 (disabled) {installs disabled}` at info severity, and the user is
never told that hooks or an LSP server were dropped, or that a skill's frontmatter was
unparseable and got a synthesized block. In standalone mode `postCommitWarnings` are
dropped by D-19-01, so this row is the only surface those facts had.

That contradicts the governing rule quoted in `PluginDisabledMessage`'s own doc comment
(`shared/notify.ts:773-780`): "render durable facts that constrain what the user can do
next; suppress facts about runtime behavior that is currently suspended." A dropped
component kind and a malformed skill are durable and DO constrain the next action — the
enable this very row advertises will produce a degraded install. Only the soft-dep
markers belong in the suppressed half.

**Fix:** Compose the disabled row's reasons from the same inputs, keeping
`installs disabled` first:

```ts
const disabledRow: InstallMsg = {
  status: "disabled",
  name: plugin,
  version: installCtx.version,
  reasons: [
    "installs disabled",
    ...malformedReasonsForKinds(installCtx.frontmatterDegradations.map((d) => d.kind)),
    ...(installCtx.resolved.state === "partially-available"
      ? narrowUnsupportedKinds(installCtx.resolved.unsupported)
      : []),
  ],
  severity: installCtx.frontmatterDegradations.length > 0 ? "warning" : "info",
  needsReload: false,
  enableHint: true,
};
```

and add a case pairing `entryDefaultEnabled: false` with a malformed-frontmatter skill.

---

#### WR-03: `docs/output-catalog.md` gained no row for the new status, token, or trailer, and the existing `(disabled)` row is now stale

**File:** `docs/output-catalog.md:154,453-608` (not in the phase diff)
**Severity:** WARNING

**Issue:**
`grep -n "installs disabled\|Run enable on this plugin" docs/` returns nothing. The
`/claude:plugin install` section (lines 453-608) has no `<!-- catalog-state: ... -->`
block for the install-disabled row, and the status-token reference row at line 154 still
reads:

> `(disabled)` — Plugin row -- list / info inventory surfaces and the
> `/claude:plugin disable` fresh-cascade row when the state record carries the explicit
> `enabled: false` marker.

which no longer enumerates the install surface.

This matters more than an ordinary docs lag, for two reasons. The catalog is a binding
byte-equality contract in this repo (`tests/architecture/catalog-uat.test.ts`: "byte
equality between `notify()`'s output and the catalog ... is the closed-loop SNM-31
gate"), and that runner WALKS the catalog and pairs each block it finds with a fixture —
so an absent section produces no failure. The gap is silent by construction. And
`compat-01-no-expansion.test.ts`'s own assertion message states the convention this change
did not follow: "a new token appends at the tail and arrives with its catalog row,
renderer arm, and fixture in the same change."

**Fix:** Add an `<!-- catalog-state: install-disabled -->` block under
`## /claude:plugin install <plugin>@<marketplace>` holding the exact bytes the tests
already pin:

```text
● mp [project]
  ◍ hello v0.0.1 (disabled) {installs disabled}
    Run enable on this plugin to use its components.
```

pair it with a `FIXTURES` entry in `catalog-uat.test.ts`, amend the line-154 token row to
name the install surface, and (after WR-01) add the reconcile-cascade variant too.

---

#### WR-04: The reconcile install-disabled arm drops the `postCommitWarnings` the install returned

**File:** `extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts:621-626`
**Severity:** WARNING

**Issue:**
`installPlugin` populates `postCommitWarnings` in orchestrated mode on the disabled path
exactly as on any other: the `pluginDataDir` mkdir failure (line 1962), the completion-cache
refresh failure (line 1981), preserved AG-5 agent files (line 2000), and per-component
frontmatter parse errors (line 2014) are all collected after the guard, and none of that
code is gated on `disabledInstall.landed`. The `plugin-installed` arm forwards them
(lines 637-640) into the `surfacePostCommitWarnings` channel; the new `plugin-disabled`
arm does not, so they are collected and discarded.

A permission error on `pluginDataDir` or a preserved foreign agent file is not made moot
by the plugin landing disabled — the data dir and the foreign file are both still there.

**Fix:** Forward the field, matching the sibling arm:

```ts
outcomes.push({
  kind: "plugin-disabled",
  scope: op.scope,
  marketplace: op.marketplace,
  plugin: op.plugin,
  ...(result.postCommitWarnings !== undefined &&
    result.postCommitWarnings.length > 0 && {
      postCommitWarnings: result.postCommitWarnings,
    }),
});
```

adding the optional field to `PluginDisabledOutcome` alongside the `reasons` field WR-01
calls for.

### Info

#### IN-01: `installedRow` is computed unconditionally even when the disabled row is emitted

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/install.ts:2057-2153`
**Severity:** INFO

**Issue:** On the install-disabled path the whole success-row composition still runs —
the `dependencies` array, the `reasons` array, `malformedReasonsForKinds`,
`narrowUnsupportedKinds`, and a `softDepStatus(pi)` probe inside `companionSeverity` —
and the result is discarded by the ternary at line 2182. Harmless today, but it reads as
though both rows are live and invites a future edit to assume `installedRow`'s inputs are
meaningful here.

**Fix:** If WR-02 is taken the computation becomes shared and this resolves itself.
Otherwise hoist the disabled branch to an early `if (disabledInstall.landed) { ...notify;
} else { ...existing }` so the dead composition is not reached.

---

#### IN-02: The `disabled` render arm is now the fourth byte-identical copy

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/install.messaging.ts:136-144`
**Severity:** INFO

**Issue:** The same six-element `joinTokens([ICON_DISABLED, p.name,
renderScopeBracket(...), renderVersion(...), "(disabled)", composeReasons(p.reasons,
false, false, probe)])` body now exists in `install.messaging.ts:136`,
`enable-disable.messaging.ts:106`, `reconcile.messaging.ts:219`, and
`list.messaging.ts`. `sonarjs/no-identical-functions` does not fire across files, so the
copies drift independently; Sonar's copy-paste detector may. The "lifted verbatim"
comment is the only thing holding them in sync.

**Fix:** Optional, and consistent with existing house style if left alone. If it is
touched again, extract a shared `disabledRow(p, mpScope, probe)` composer next to
`partiallyInstalledRow` (which already exists as the sole composition site for its own
glyph) and have all four contexts call it.

---

_Reviewed: 2026-08-14T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
