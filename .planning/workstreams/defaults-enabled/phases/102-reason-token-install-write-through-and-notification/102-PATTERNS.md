# Phase 102: Reason token, install write-through and notification - Pattern Map

**Mapped:** 2026-08-14
**Files analyzed:** 9 modified (0 created)
**Analogs found:** 9 / 9

Every file in this phase is a MODIFICATION of an existing file. There are no new
files, so every "analog" is either the file's own established in-file precedent
(the shape the new code must copy) or a sibling file that already implements the
same shape. All line numbers below were verified against source on 2026-08-14.

## File Classification

| Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---------------|------|-----------|----------------|---------------|
| `extensions/pi-claude-marketplace/shared/notify.ts` | shared / render vocabulary | transform (message → bytes) | in-file: `"unsupported component"` REASONS entry (`:99-105`) + `partialHint` (`:845-851`) + `PARTIAL_INSTALL_HINT_TRAILER` (`:2528`) | exact |
| `extensions/pi-claude-marketplace/shared/notify-reasons.ts` | shared / typed topic partition | transform | in-file: `UNSUPPORTED_REASONS` group (`:86-101`) + `SharedTopicReason` (`:198`) | exact |
| `extensions/pi-claude-marketplace/orchestrators/plugin/install.ts` | orchestrator (ledger) | transactional request-response | in-file post-ledger composition + `orchestrators/plugin/enable-disable.ts::runDisableBranch` (`:329-388`) | exact |
| `extensions/pi-claude-marketplace/orchestrators/plugin/install.messaging.ts` | messaging (command-private render map) | transform | `orchestrators/plugin/enable-disable.messaging.ts` `DISABLE_STATUSES` (`:58`) + `DISABLE_RENDER.disabled` (`:106-114`) | exact |
| `extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts` | orchestrator (cascade) | batch | in-file `applyPluginInstalls` (`:576-641`); the `configSource` seam at `reconcile/types.ts:84` | role-match |
| `tests/architecture/compat-01-no-expansion.test.ts` | test (closed-set pin) | enumeration equality | in-file tail entry `"malformed command"` (`:167`) | exact |
| `tests/architecture/notify-closed-set-locks.test.ts` | test (length pin) | assertion | in-file `assert.equal(REASONS.length, 38)` (`:37`) | exact |
| `tests/orchestrators/plugin/install.test.ts` | test (unit) | transactional | existing install-success / cascade-failure cases in the same file | exact |
| `tests/orchestrators/reconcile/apply.test.ts` | test (unit) | batch | existing `applyPluginInstalls` cases in the same file | exact |

Not modified but consumed as-is (read-only seams): `persistence/config-write-back.ts`
(`writePluginConfigEntry` / `writeBatchedConfigEntries`), `persistence/state-io.ts`
(`toDisabledRecord`), `orchestrators/marketplace/shared.ts` (`cascadeUnstagePlugin`),
`orchestrators/plugin/shared.ts` (`applyPartialCascadeFold`), `domain/resolver.ts`
(`defaultEnabled`).

## Pattern Assignments

### `shared/notify.ts` (shared, transform) — the `REASONS` tail amendment

**Analog:** its own most recent amendment, `"unsupported component"` (D-90-05).

**Tail of the tuple** (`shared/notify.ts:169-175`) — `installs disabled` appends
after `"malformed command"`, becoming entry 39. Nothing above it moves:

```ts
  // CLASS-01 / D-86-01: a COMMAND whose source frontmatter could not be parsed
  // by Pi's own `parseFrontmatter`. The command-kind sibling of `malformed
  // skill` -- same failure-class classification and `(installed)`-row / one-per-
  // plugin surfacing; a dedicated token rather than a shared bucket so the reason
  // row names the malformed component kind truthfully.
  "malformed command",
] as const;
```

**Comment style to copy for the new entry** (`shared/notify.ts:99-105`) — the
D-90-05 precedent: cite the decision/requirement ID, say what the token means,
and say what it is NOT (which sibling token it must not be confused with):

```ts
  // D-90-05: a dropped non-carve-out unsupported COMPONENT kind
  // (`monitors` / `themes` / `outputStyles` / `channels` / `userConfig` /
  // `settings`). Distinct from `unsupported source` (the source/note axis)
  // and from the `unsupported hooks` / `lsp` carve-outs. `kindToReason`'s
  // per-kind fallback emits this so a component-kind drop is named truthfully
  // rather than mislabeled as a source problem.
  "unsupported component",
```

**Stale prose to fix in the same edit** (`shared/notify.ts:79-80`) — currently
claims 37; the real count today is 38 and becomes 39:

```ts
 * D-09 / OUT-08: this tuple is the byte-source of the closed set -- its
 * 37-entry membership AND order are catalog-stable and MUST NOT change (new
 * tokens append at the tail; existing entries never reorder).
```

---

### `shared/notify.ts` (shared, transform) — D-102-10's enable-hint field + trailer

**Analog:** `partialHint` on `PluginUnavailableMessage` / `PluginPartiallyAvailableMessage`,
its byte-frozen trailer literal, and its render gate. This is the exact three-part
shape D-102-10 mandates: boolean field in, fixed literal out.

**Part 1 — the optional boolean field** (`shared/notify.ts:845-851`, on
`PluginUnavailableMessage`; the twin at `:873-877` on `PluginPartiallyAvailableMessage`):

```ts
  // SEV-02 / D-69-03: set on the install-failure surface when the resolver
  // verdict is `partially-available`. The renderer appends a
  // 4-space-indented `--partial` hint trailer below the row pointing the user
  // at the flag that can degrade-install the plugin. Absent on the
  // structural `unavailable` arm (`--partial` cannot help) and on every list /
  // inventory surface, which render byte-frozen.
  readonly partialHint?: boolean;
```

The new field goes on `PluginDisabledMessage` (`shared/notify.ts:791-798`), which
today is:

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

Its doc comment (`shared/notify.ts:765-777`) states `reasons` "admits exactly one
member -- `not in manifest`" — that sentence becomes stale when `installs disabled`
joins, and must be amended in the same edit. The governing rule in the same comment
stays and is the license for adding the token without a render change:

```
 * Which reasons a surface stamps is an ORCHESTRATOR decision (D-95-01) -- the
 * render path holds no allowlist.
```

**Part 2 — the byte-frozen trailer literal** (`shared/notify.ts:2520-2528`):

```ts
/**
 * SEV-02 / D-69-03 `--partial` hint trailer literal, rendered below a
 * partially-available install-failure row. References the user's
 * own `--partial` flag only -- no plugin / marketplace interpolation (T-69-01).
 * D-70-01: this byte form is FROZEN as the reconciled DOC contract and is
 * locked byte-for-byte in docs/output-catalog.md and
 * docs/messaging-style-guide.md. Do not change the wording.
 */
const PARTIAL_INSTALL_HINT_TRAILER = "Re-run with --partial to install the supported components.";
```

Note the sibling `PARTIAL_UPDATE_HINT_TRAILER` (`:2539-2540`) and
`STALE_GATE_UPDATE_HINT_TRAILER` (`:2542+`) — the established practice is one
literal per remedy wording, never a parameterized template.

**Part 3 — the render gate** (`shared/notify.ts:3816-3829`) — a status narrowing
AND `=== true` on the boolean, appended as a 4-space-indented line:

```ts
  if (
    (p.status === "unavailable" || p.status === "partially-available") &&
    p.partialHint === true
  ) {
    lines.push(`    ${PARTIAL_INSTALL_HINT_TRAILER}`);
  }
```

Copy this shape verbatim for the `disabled` status. The two sibling gates
immediately below (`:3834`, `:3844`) show the single-status form.

---

### `shared/notify-reasons.ts` (shared, transform) — the topic home (D-102-06)

**Analog:** `UNSUPPORTED_REASONS`, the group D-90-05's token joined.

**Group shape** (`shared/notify-reasons.ts:86-101`) — doc comment naming the
group's charter, `as const` tuple, per-entry decision-ID comment, then the
`(typeof X)[number]` literal-union alias:

```ts
/**
 * D-09: unsupported-components / soft-dep reasons -- the topic group the user
 * named explicitly (hooks / LSP / companion-extension soft deps / unsupported
 * source / no-longer-installable).
 */
export const UNSUPPORTED_REASONS = [
  "unsupported hooks",
  "lsp",
  "requires pi-subagents",
  "requires pi-mcp",
  "unsupported source",
  // D-90-05: the truthful marker for a dropped non-carve-out component kind.
  "unsupported component",
  "no longer installable",
] as const;
export type UnsupportedReason = (typeof UNSUPPORTED_REASONS)[number];
```

**Fold into the shared union** (`shared/notify-reasons.ts:198`) — a fourth group
(RESEARCH Open Question 1's recommendation) must be added here or the proof fails:

```ts
export type SharedTopicReason = IdempotentReason | UnsupportedReason | FailureReason;
```

**The mechanism that makes the home non-optional** (`shared/notify-reasons.ts:225-228`):

```ts
type _AssertNever<T extends never> = T;
type _UncoveredReason = Exclude<Reason, SharedTopicReason | CommandPrivateReason>;
type _ExtraReason = Exclude<SharedTopicReason | CommandPrivateReason, Reason>;
export type _ReasonsCoverageProof = [_AssertNever<_UncoveredReason>, _AssertNever<_ExtraReason>];
```

**Stale prose to fix in the same edit** — the module header states the count twice
(`:7`, `:14`) and narrates the last amendment (`:16-20`); both need the 38→39 bump
and the narration should gain the new token exactly as it names D-90-05:

```ts
 * D-90-05 is what moved the count from 37 to 38: `"unsupported component"`
 * joined the set as the truthful marker for a dropped component kind that has
 * no carve-out of its own. `COMPAT-01` pins the membership by enumeration and
 * `notify-closed-set-locks.test.ts` pins the length, so the two sentences above
 * cannot drift from the tuple again without a red test.
```

---

### `orchestrators/plugin/install.ts` (orchestrator, transactional) — the disable composition (D-102-01)

**Analog:** `orchestrators/plugin/enable-disable.ts::runDisableBranch` (`:329-388`).
Build FROM these primitives; do NOT call the enable/disable verb — `enable-disable.ts`
already imports `runInstallLedger` from `install.ts`, so the reverse edge closes a
cycle `import-x/no-cycle` rejects for `orchestrators/**`, and `setPluginEnabled`
would self-deadlock on the non-reentrant per-scope lock.

**The cascade + partial-fold failure arm** (`enable-disable.ts:336-362`) — this is
also, verbatim, D-102-02's "whatever a failed disable cascade does today":

```ts
  const cascade = await cascadeUnstagePlugin(opts.plugin, opts.marketplace, locations, installed);
  if (!cascade.ok) {
    // I3: cascade.dropped lists artifacts already unstaged before the throw.
    // Fold them into the record so state.json never claims artifacts gone
    // from disk (NFR-3 fail-clean). Uses the shared applyPartialCascadeFold
    // helper (TR-03 path); the caller saves the shrunken record before
    // surfacing the failure.
    applyPartialCascadeFold(installed, cascade.dropped);
    installed.updatedAt = new Date().toISOString();
    if (cascade.dropped.hooks.length > 0) {
      dropCachedHooks(scope, opts.marketplace, opts.plugin, "partial-cascade ", false);
    }

    return {
      outcome: { kind: "disable-failed", cause: cascade.cause ?? new Error(...), recordedVersion },
      saveShrunken: true,
    };
  }
```

**The sole sanctioned disabled-record producer** (`enable-disable.ts:374-385`) —
the comment block explains why the map slot is REPLACED rather than mutated:

```ts
  // ENBL-02: `toDisabledRecord` is the sole sanctioned producer of the disabled
  // shape -- its `resources: R` passthrough makes changing the inventory a
  // compile error there. The caller replaces the map slot with the returned
  // record (rather than mutating in place) so the type survives to the
  // assignment.
  const disabled = toDisabledRecord(installed, new Date().toISOString());

  dropCachedHooks(scope, opts.marketplace, opts.plugin, "", true);
```

**The hooks-cache drop helper** (`enable-disable.ts:406-424`) — copy this
try/catch-wrapped shape; a cache throw must never escalate a successful disable
into a failure:

```ts
function dropCachedHooks(
  scope: Scope, marketplace: string, plugin: string, logPrefix: string, unexpected: boolean,
): void {
  try {
    removePluginConfigFromCache(scope, marketplace, plugin);
    rebuildRoutingTables();
  } catch (cacheErr) {
    hookDebugLog(`disable: ${logPrefix}cache/routing mutation failed for ...`);
  }
}
```

**Where it slots in** — inside the existing `withLockedStateTransaction` closure,
AFTER `runInstallLedger` returns and BEFORE the write-back / `tx.save()`
(`install.ts:1392-1459`). The block this path must SKIP is the post-save hooks
cache add at `install.ts:1490-1511`, gated today only on
`installCtx.resolved.hooksConfigPath !== undefined` — on the disabled path the
cascade has just deleted that file.

**Option threading precedent** (`install.ts:297-357`) — `InstallPluginOptions` is a
flat readonly interface where every optional flag carries a doc comment naming the
requirement and the caller that sets it. Copy `partial` (`:313-320`) or `local`
(`:335-341`) as the model for the new caller-supplied boolean:

```ts
  /**
   * WB-01 / WB-02: when true, target `claude-plugins.local.json` instead
   * of `claude-plugins.json`. The base file is NEVER touched on the
   * --local path; ...
   */
  readonly local?: boolean;
```

---

### `orchestrators/plugin/install.ts` (orchestrator) — the write-back patch's first field (D-102-09)

**Analog:** the file's own existing write-back call (`install.ts:1447-1452`):

```ts
        await writeBatchedConfigEntries(current, targetConfigPath, locations.scopeRoot, {
          ...(adoptedSource !== undefined && {
            marketplaces: { [marketplace]: { source: adoptedSource } },
          }),
          plugins: { [`${plugin}@${marketplace}`]: {} },
        });
```

Guarded by `if (opts.notifications?.mode !== "orchestrated") {` (`install.ts:1430`)
— do NOT widen this condition; the reconcile stamp is a separate, narrower write.

**Patch merge semantics** (`persistence/config-write-back.ts:189-192`) — spread over
the existing entry, so `{ enabled: false }` preserves D-09 forward-compat keys:

```ts
  const plugins = { ...current.plugins };
  for (const [key, patch] of Object.entries(batch.plugins ?? {})) {
    plugins[key] = { ...plugins[key], ...patch };
  }
```

The single-entry sibling D-102-09 names, same semantics
(`persistence/config-write-back.ts:113-130`):

```ts
export async function writePluginConfigEntry(
  current: ScopeConfig, targetConfigPath: string, scopeRoot: string,
  plugin: string, marketplace: string, patch: Partial<PluginConfigEntry>,
): Promise<void> {
  const key = `${plugin}@${marketplace}`;
  const existing = current.plugins?.[key] ?? {};
  const merged: PluginConfigEntry = { ...existing, ...patch };
  ...
  await saveConfig(targetConfigPath, patched, scopeRoot);
}
```

**Stale comment to amend in the same edit** (`install.ts:1408-1413`) — this
sentence is exactly what the phase falsifies:

```ts
      // WB-01 / WR-09: write-back the plugin entry to the user-authored
      // config. SKIPPED in orchestrated mode ... The plugin patch is `{}`
      // because the plugin entry shape today carries no install-time field
      // beyond the implicit declaration -- D-04 keeps the "enabled" default
      // at consume time.
```

---

### `orchestrators/plugin/install.ts` (orchestrator) — the install-disabled row (OUT-04 / D-102-07)

**Analog:** the file's own success-row composition (`install.ts:1813-1896`). Copy
its three-step shape: build `reasons`, compute `severity` in a named const, then
build the row as a typed `InstallMsg` and emit ONE `notifyWithContext` call.

Reason accumulation (`install.ts:1813-1816`):

```ts
    const reasons: ContentReason[] = [];
    if (installCtx.resolved.orphanRewake === true) {
      reasons.push("orphan rewake");
    }
```

Severity stamped by the ORCHESTRATOR, never probed by the renderer
(`install.ts:1854-1863`) — this is the D-102-08 discipline in code:

```ts
    const successSeverity =
      installCtx.frontmatterDegradations.length > 0
        ? "warning"
        : companionSeverity(
            { declaresAgents: ..., declaresMcp: ... },
            softDepStatus(pi),
          );
```

Row build + single emission (`install.ts:1864-1896`), with the conditional-spread
`...(reasons.length > 0 && { reasons })` NREG-01 idiom and row-level `scope`
deliberately OMITTED (the marketplace block carries it):

```ts
    const installedRow: InstallMsg = {
      status: "installed",
      name: plugin,
      dependencies,
      version: installCtx.version,
      ...(reasons.length > 0 && { reasons }),
      severity: successSeverity,
      needsReload: true,
    };
    notifyWithContext(ctx, pi, INSTALL_CONTEXT, [
      { name: marketplace, scope, plugins: [installedRow] },
    ]);
```

**Outcome shape** (`install.ts:1904-1924`) — `resourcesChanged: stagedAny` derived
from `stagedAny` (`:1768-1772`); on the disabled path the staged arrays are
non-empty but nothing survived, so this is the field to reconsider.

---

### `orchestrators/plugin/install.messaging.ts` (messaging, transform)

**Analog:** `enable-disable.messaging.ts` — the sibling that already owns a
`disabled` status and its render arm.

**Status tuple to extend** (`install.messaging.ts:42-49`) — command-private, not
pinned by COMPAT-01:

```ts
export const INSTALL_STATUSES = [
  "installed",
  "partially-installed",
  "failed",
  "unavailable",
  "partially-available",
] as const;
export type InstallStatus = (typeof INSTALL_STATUSES)[number];
```

**Message union to extend** (`install.messaging.ts:57-62`) — add
`PluginDisabledMessage`:

```ts
export type InstallMsg =
  | PluginInstalledMessage
  | PluginPartiallyInstalledMessage
  | PluginFailedMessage
  | PluginUnavailableMessage
  | PluginPartiallyAvailableMessage;
```

**Render arm to lift VERBATIM** (`enable-disable.messaging.ts:106-114`) — the
`INSTALL_RENDER` map is typed `{ [K in InstallStatus]: RenderFn<...> }`, so
omitting the arm is a TS2741 error at the `as const satisfies` site
(`install.messaging.ts:79`, `:126-129`):

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

Both soft-dep flags stay hard-coded `false` (ENBL-15 / D-100-06) — the rationale is
recorded at `enable-disable.messaging.ts:92-104`. `ICON_DISABLED = "◍"` already
exists (`notify.ts:1616`) and is COMPAT-01-pinned; do NOT add an eighth glyph.

---

### `orchestrators/reconcile/apply.ts` (orchestrator, batch) — the absent-key stamp (D-102-04)

**Analog:** the file's own `applyPluginInstalls` loop (`apply.ts:576-641`) — a
per-op `try`/`catch` calling `installPlugin` with
`notifications: { mode: "orchestrated" }`, then pushing a typed outcome with
conditional-spread optional fields:

```ts
  for (const op of plan.pluginsToInstall) {
    try {
      const result = await installPlugin({
        ctx: opts.ctx, pi: opts.pi, scope: op.scope, cwd: opts.cwd,
        marketplace: op.marketplace, plugin: op.plugin,
        notifications: { mode: "orchestrated" },
      });

      if (result.status === "installed") {
        outcomes.push({
          kind: "plugin-installed",
          scope: op.scope, marketplace: op.marketplace, plugin: op.plugin,
          dependencies: dependenciesFromInstall(result),
          ...(result.orphanRewake === true && { orphanRewake: true }),
          ...(result.degradedKinds !== undefined && result.degradedKinds.length > 0 && {
            degradedKinds: result.degradedKinds,
          }),
        });
      } else { /* plugin-install-failed */ }
    } catch (err) { /* plugin-install-failed */ }
  }
```

`op` here is a `PlannedPluginInstall`, which already carries the write target
(`orchestrators/reconcile/types.ts:79-85`) — a pre-built seam with no reader today:

```ts
/** Planned install of a plugin declared+enabled in config but not recorded. */
export interface PlannedPluginInstall {
  readonly scope: Scope;
  readonly plugin: string;
  readonly marketplace: string;
  readonly configSource: "base" | "local";
}
```

The identical field on `PlannedMarketplaceAdd` (`types.ts:60`) shows the same
provenance convention. Stamping the wrong physical file is silently ineffective
(base+local merge is wholesale per entry), so the stamp target MUST be driven from
`configSource`.

---

### `tests/architecture/*.test.ts` (test, enumeration/length pins)

**compat-01-no-expansion.test.ts** — append `"installs disabled"` after the tail
entry at `:167` (`"malformed command"`) in the hand-written enumeration.

**notify-closed-set-locks.test.ts:37** — bump in the SAME change that grows the
set (the file header states this rule verbatim):

```ts
  assert.equal(REASONS.length, 38);
```

**docs/output-catalog.md takes NO delta this phase** — `catalog-uat.test.ts` walks
annotation→fixture and fixture→annotation; adding neither keeps both walks green.

## Shared Patterns

### Closed-set amendment (append-only, four sites)

**Source:** the D-90-05 `"unsupported component"` amendment.
**Apply to:** `shared/notify.ts`, `shared/notify-reasons.ts`, and the two
architecture tests — as ONE atomic edit. The compile-time partition proof
(`notify-reasons.ts:225-228`) makes a half-landed amendment a TS2344 error, so
these four sites cannot be split across tasks.

### Comment discipline

**Source:** `.claude/rules/typescript-comments.md` + every quoted comment above.
**Apply to:** every touched file.
Cite `DFEN-04`, `DFEN-05`, `OUT-01`, `OUT-04`, `D-102-01`…`D-102-10`, `ENBL-02`,
`ENBL-15`, `ENBL-18`, `WR-09`, `SPLIT-02`, `NFR-3`. NEVER `Phase 102`, `Plan NN`,
`Wave N`, or a bare `Pitfall N` / `Pattern N` — the numbered hazards in
`102-RESEARCH.md` are research-local and must not be cited by number in source or
test titles.

### Conditional-spread optional fields (NREG-01)

**Source:** `install.ts:1880` (`...(reasons.length > 0 && { reasons })`),
`install.ts:1916-1923`, `apply.ts:603-620`.
**Apply to:** every new optional field on a message, an outcome, or a config patch.
`exactOptionalPropertyTypes` is on, so an explicit `undefined` is a type error.

### Orchestrator stamps, renderer renders (D-102-08)

**Source:** `install.ts:1854-1863` (severity computed at the emit site);
`notify.ts:773-775` ("the render path holds no allowlist").
**Apply to:** the new hint boolean, the new reason token, and the severity stamp.
A boolean goes in; a frozen literal comes out. No interpolation (T-69-01), no
state probing inside `notify.ts`.

### Guard-free ledger body + single lock

**Source:** `install.ts:1381` (`withLockedStateTransaction`), `install.ts:1392`
(`runInstallLedger`), `install.ts:1459` (`await tx.save()`).
**Apply to:** the whole disable composition — it runs INSIDE the existing closure,
after the ledger, before the write-back and the save. `proper-lockfile` is
`retries: 0` and not re-entrant.

## No Analog Found

None. Every change in this phase has an in-repo precedent with a verified line
range.

## Metadata

**Analog search scope:** `extensions/pi-claude-marketplace/{shared,orchestrators,persistence,domain}/`,
`tests/architecture/`
**Files opened this session:** `shared/notify.ts` (4 targeted ranges),
`shared/notify-reasons.ts` (full), `orchestrators/plugin/install.ts` (4 ranges),
`orchestrators/plugin/install.messaging.ts` (full),
`orchestrators/plugin/enable-disable.ts` (1 range),
`orchestrators/plugin/enable-disable.messaging.ts` (1 range),
`persistence/config-write-back.ts` (1 range),
`orchestrators/reconcile/apply.ts` (1 range), `orchestrators/reconcile/types.ts` (1 range)
**Pattern extraction date:** 2026-08-14
