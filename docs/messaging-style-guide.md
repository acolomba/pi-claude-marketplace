# Messaging Style Guide

**Guide version:** 2.0 **Status:** Normative -- describes the structured `notify` type model in `extensions/pi-claude-marketplace/shared/notify.ts` as the binding contract for every user-visible message emitted by `pi-claude-marketplace`. Supersedes guide v1.0 (the YAML-frontmatter enumeration spec). **Audience:** Engineers authoring or reviewing `notify()` / `notifyUsageError()` call sites and the single sanctioned `console.warn` at `persistence/migrate.ts`.

## Overview

This guide describes the user-output contract for `pi-claude-marketplace` as enforced by the type model in `extensions/pi-claude-marketplace/shared/notify.ts`. Guide v1.0 was a self-contained enumeration spec: status tokens, reasons, markers, and pattern classes were listed in YAML frontmatter and the prose body iterated each set with worked examples. Guide v2.0 retires that shape. Closed-set authority moved from frontmatter keys to `as const` tuples in `shared/notify.ts` per ADR-v2-001 / SNM-04 / SNM-05 / SNM-06, the discriminated `PluginNotificationMessage` union locks per-variant grammar at compile time, and the Phase 16 `notify()` renderer's switch is the single site that picks severity, picks the icon glyph, embeds the status-token literal, orders grammar slots, and composes brackets, probes, and trailers.

The practical consequence: engineers no longer compose user-visible strings by hand. They construct typed `NotificationMessage` payloads and pass them to `notify()`. The renderer derives every grammar decision structurally. Severity is computed from contents (per D-16-11). The reload-hint trailer is computed from contents (per D-16-12). Soft-dependency markers (`{requires pi-subagents}` / `{requires pi-mcp}`) are computed at render time via a Pi-host probe (per D-16-15). Top-level free text is not expressible in `NotificationMessage`, which retires v1's `Claude plugin import summary` preamble, the `Fix the underlying issue and retry.` retry anchor, and the `source-mismatch` diagnostic line (per D-17-09).

Two artifacts back this guide. The Type Model Reference section points at the closed-set tuples and the discriminated-union shape. The catalog at `docs/output-catalog.md` is the byte-equal user-contract surface; the test at `tests/architecture/catalog-uat.test.ts` drives `notify()` against catalog fixtures and asserts byte-equality. Read this guide for the type model; read the catalog for the rendered output bytes.

## Type Model Reference

The user-output contract is defined by the types and `as const` tuples in `extensions/pi-claude-marketplace/shared/notify.ts`. This section points at those definitions; it does not duplicate them. Read the source.

The two public entry points and the user-facing types:

```ts
export function notify(ctx: ExtensionContext, pi: ExtensionAPI, message: NotificationMessage): void;
export function notifyUsageError(ctx: ExtensionContext, message: UsageErrorMessage): void;

export type NotificationMessage; // { marketplaces: readonly MarketplaceNotificationMessage[] }
export type MarketplaceNotificationMessage; // { name; scope; status?; details?; plugins }
export type PluginNotificationMessage; // 16-variant discriminated union on `status`
export type PluginStatus; // 16 literal strings, derived from PLUGIN_STATUSES tuple
export type MarketplaceStatus; // 7 literal strings, derived from MARKETPLACE_STATUSES tuple
export type Dependency; // "agents" | "mcp", derived from DEPENDENCIES tuple
export interface MarketplaceDetails; // { autoupdate: boolean; lastUpdatedAt?: string }
export interface UsageErrorMessage; // { message: string; usage: string }
```

The discriminated `PluginNotificationMessage` union pins each variant's `status` to its literal string for TypeScript narrowing (read `extensions/pi-claude-marketplace/shared/notify.ts` for the canonical membership; do not re-enumerate a count in prose):

```ts
type PluginNotificationMessage =
  | PluginInstalledMessage // status: "installed";    dependencies (required)
  | PluginUpdatedMessage // status: "updated";      dependencies (required); from/to (required)
  | PluginReinstalledMessage // status: "reinstalled";  dependencies (required)
  | PluginUninstalledMessage // status: "uninstalled"
  | PluginAvailableMessage // status: "available";    NO scope (SNM-11)
  | PluginRemoteMessage // status: "remote";       NO scope (SNM-11); NO reasons; ◌ (RSTA-01)
  | PluginUnavailableMessage // status: "unavailable";  reasons (required); NO scope (SNM-11)
  | PluginPartiallyAvailableMessage // status: "partially-available";  reasons (required); NO scope (SNM-11); ⊖ (USTAT-01)
  | PluginUpgradableMessage // status: "upgradable";   reasons (required)
  | PluginPresentMessage // status: "present";      dependencies (required); inventory token (G-21-01)
  | PluginFailedMessage // status: "failed";       reasons (required); cause?; rollbackPartial?
  | PluginSkippedMessage // status: "skipped";      reasons (required)
  | PluginManualRecoveryMessage // status: "manual recovery"; reasons (required); cause?
  | PluginWillInstallMessage // status: "will install";   pending-tense (DIFF-02); NO version
  | PluginWillUninstallMessage // status: "will uninstall"; pending-tense (DIFF-02); NO version
  | PluginWillEnableMessage // status: "will enable";    pending-tense (DIFF-02); NO version
  | PluginWillDisableMessage // status: "will disable";   pending-tense (DIFF-02); NO version
  | PluginDisabledMessage; // status: "disabled";       inventory token + disable cascade row (ENBL-04 / D-54-01 / UAT-03); ◍ (D-80-01)
```

The closed sets are encoded as runtime tuples and their literal-union types are derived via indexed access (SNM-04 / SNM-05 / SNM-06 / D-15-11):

- `PLUGIN_STATUSES` -- the closed set of plugin status discriminators. The literal-union type `PluginStatus` is derived as `(typeof PLUGIN_STATUSES)[number]`. Read `extensions/pi-claude-marketplace/shared/notify.ts` for the canonical membership and ordering; do not re-enumerate the values in prose. Fixture iterators (per-variant unit tests, catalog UAT drivers) consume the runtime tuple. The 4 pending-tense `will *` pending statuses are the DIFF-02 read-only pending tokens; `present` (G-21-01) and `disabled` (ENBL-04) are the list-surface inventory tokens -- `disabled` additionally doubles as the `/claude:plugin disable` command's realized cascade-row token (v1.12 UAT-03 decision; the reload-hint distinction is carried by the cascade's `disable-cascade` kind, not by the token).
- `MARKETPLACE_STATUSES` -- the closed set of 7 marketplace status discriminators. `MarketplaceStatus = (typeof MARKETPLACE_STATUSES)[number]`. Same rule. The 3 autoupdate-surface statuses (`autoupdate enabled`, `autoupdate disabled`, `skipped`) were added in Phase 17.1 per D-17.1-01 to support the user-locked surface design in D-18-05. WILL-01 / D-65.1-02 / D-65.1-03: the marketplace level carries no pending-tense `will *` status -- add is immediate, and a remove surfaces its reload-deferred plugin-uninstall cascade as per-plugin `will uninstall` child rows under a bare header.
- `DEPENDENCIES` -- the closed set of 2 soft-dependency probe targets. `Dependency = (typeof DEPENDENCIES)[number]`. Same rule. Drives the render-time probe path; `agents` → `pi-subagents`, `mcp` → `pi-mcp-adapter`.
- `REASONS` (closed-set reason tokens used inside `{<reason>}` braces on the 5 reason-bearing plugin variants) -- defined in `extensions/pi-claude-marketplace/shared/notify.ts::REASONS`. The reason set survives v2.0 unchanged in spirit; the 3 v1.3 reasons structurally absorbed by the type model (`rollback partial`, `requires pi-subagents`, `requires pi-mcp`) no longer appear in any typed `reasons` field -- they are emitted by the renderer from the `rollbackPartial` field and the soft-dep probe, respectively. `authentication required` (D-76-08) is the failure-class token for an HTTP auth challenge (401/403) on a marketplace clone: **error** severity, cause chain carries the HTTP detail. Truthful attribution -- a 401/403 is an auth failure, so it MUST NOT be rendered as `network unreachable` (the auth condition and the network-reachability condition are distinct). Reused by `PROV-04`'s fail-clean provider-auth case.

The discriminated union and the per-variant field carve-outs are the binding compile-time contract. Adding or removing a variant, or shifting a field's required/optional discipline, is enforced by `assertNever(plugin)` in the renderer's switch (SNM-17), by the per-command `satisfies CommandContext` checks in the `*.messaging.ts` modules, and by the `_UncoveredReason` / `_ExtraReason` closed-set membership proof in `extensions/pi-claude-marketplace/shared/notify-reasons.ts`; the closed-set tuple lengths are tripwired by `tests/architecture/notify-closed-set-locks.test.ts`. A drift from one of the tuples or the per-variant discipline becomes a compile error or a failing length lock:

- `reasons: readonly Reason[]` REQUIRED only on `partially-available | unavailable | upgradable | skipped | failed | manual recovery` (D-15-01). The other variants omit the field so `(installed) {up-to-date}` is a compile error.
- `dependencies: readonly Dependency[]` REQUIRED only on `installed | updated | reinstalled | present` (D-15-02 + SNM-06 + G-21-01). The other 12 variants omit the field; only those 4 switch arms reach the per-dependency probe path.
- `version?: string` on every variant EXCEPT `updated`, which carries REQUIRED `from: string; to: string` instead (D-15-04), and the 4 `will *` pending variants, which omit version entirely (DIFF-02: the recorded version is not load-bearing pre-transition). The hash-version contract (PI-7 `hash-<12hex>`) remains a plain string -- no branded type.
- `scope?: Scope` on every variant EXCEPT `available | partially-available | unavailable` (SNM-11 -- MSG-PL-6 carve-out preserved structurally; the list surface does not emit `[<scope>]` brackets for those rows).
- `cause?: Error` on `failed | manual recovery` only (SNM-10).
- `rollbackPartial?: readonly { phase: string; cause?: Error }[]` on `failed` only (SNM-09).

See `docs/adr/v2-001-structured-notify.md` for the design rationale (especially the "Public surface" and "NotificationMessage shape" sections).

## Output Grammar Summary

The Phase 16 renderer enforces these grammar invariants structurally. The list is descriptive (it records what the renderer emits, for reviewers of `notify()` payloads); the binding implementation lives in `shared/notify.ts`'s switch and helpers.

- **Always-marketplace-header form.** Every `notify()` output begins with a marketplace header at column 0; plugin rows are indented two spaces beneath. The v1.3 inline-plugin and bare-cascade emissions are retired (per ADR-v2-001 "Always-marketplace-header spec change" + D-16-04). A single-plugin install renders as a marketplace header at column 0 with one indented plugin row beneath; there is no carve-out for "single-plugin commands skip header."
- **Indentation discipline.** Marketplace header at column 0. Plugin rows at 2-space indent. Per-plugin cause chains and `rollbackPartial` per-phase children at 4-space indent. One blank line between marketplace blocks (per D-16-07).
- **Conditional plugin-row scope bracket.** A plugin row emits `[<scope>]` only when its `scope` differs from the parent marketplace's `scope` (orphan-fold case per D-16-17). Same-scope plugins inherit the marketplace's scope from the header and omit the bracket. The `available | partially-available | unavailable` variants carry no `scope` field at all (SNM-11), so their rows never emit the bracket regardless of context.
- **Computed severity routing.** `notify()` computes severity from contents per the ladder in §"Severity Routing" (D-16-11). Callers do not supply severity.
- **Computed reload-hint trailer.** `notify()` appends `/reload to pick up changes` (with one blank line above) iff any plugin status is in `{installed, updated, reinstalled, uninstalled}`, or -- on a cascade dispatched with the `disable-cascade` kind (the `/claude:plugin disable` command's realized-transition cascade, v1.12 UAT-03) -- any plugin status is `disabled` (D-16-12, narrowed by SNM-33). The trigger is plugin-row-driven ONLY: marketplace records are bookkeeping, not Pi-visible resources, so NO marketplace status triggers the trailer on its own (a clean `marketplace remove` still emits it via the per-unstaged-plugin `uninstalled` rows). The list-surface inventory tokens (`present`, and `disabled` on kind-less / `cascade` payloads) and the pending-tense `will *` pending tokens are structurally excluded. Callers do not supply a flag -- the disable orchestrator supplies the cascade KIND, and the hint stays contents-derived within that kind.
- **Computed soft-dep probe.** Each `dependencies: ["agents"]` triggers a render-time probe for `pi-subagents`; absence emits `{requires pi-subagents}` on the plugin row. `dependencies: ["mcp"]` is the analogous probe for `pi-mcp-adapter` emitting `{requires pi-mcp}` (D-16-15). The probe runs once per `notify()` invocation (D-16-14) and is threaded through every plugin-row render so all rows see a consistent host snapshot.
- **Inline per-plugin cause chains.** A `failed` or `manual recovery` plugin variant carrying `cause?: Error` surfaces the cause chain inline beneath the plugin row (4-space indent), one chain per failed plugin (per D-16-08). The v1.3 top-level cascade-summary cause line is retired (per SNM-10): multi-failure cascades surface each plugin's chain independently rather than collapsing into a single trailer.
- **`rollbackPartial` as a sub-state of `failed`.** A `failed` plugin variant carrying `rollbackPartial` renders per-phase children at 4-space indent beneath the failed row. There is no separate `"rollback failed"` status (per SNM-09) -- rollback-partial is structurally a sub-state of `failed`.
- **No top-level free text.** `NotificationMessage` has no field for free-text preambles, anchors, or diagnostic augmentations. v1's `Claude plugin import summary` preamble, the `Fix the underlying issue and retry.` retry anchor, and the `source-mismatch` diagnostic line are all retired (per D-17-09): they are not expressible in the type model. The `(no marketplaces)` sentinel is the structural representation of an empty top-level `marketplaces: []` (per D-16-17); an empty per-marketplace `plugins: []` renders the bare header alone (per D-15-08).
- **Computed summary line (error / warning only).** For `error` and `warning` severity, `notify()` prepends a one-line summary before the cascade body (Phase 29 / UXG-07 / D-29-02): the emitted string is `{summary}\n\n{cascade body}` (the reload-hint, if any, stays last). The summary counts the operations that drive the severity, by type (plugin vs marketplace), with the verb chosen by severity -- `"N plugin operation(s) [and M marketplace operation(s)] failed."` for error, `"... skipped."` for warning. This is NOT a regression of "No top-level free text": the summary is computed structurally from the `NotificationMessage` traversal `computeSeverity` performs (the same arms that pick severity), not supplied by the caller. Info-severity cascades carry no summary line and are byte-identical to the pre-Phase-29 cascade-only body. See §"Severity Routing -- Summary line" below.

The byte-equal rendering shapes live in `docs/output-catalog.md`. Three illustrative forms (full per-command coverage is in the catalog, not here):

Single-plugin install, marketplace status `added`, plugin status `installed`, info severity, reload-hint trailer:

```text
● demo [user] (added)
  ● commit-commands v1.0.0 (installed)

/reload to pick up changes
```

Orphan-fold case -- plugin row carries its own `[<scope>]` because `plugin.scope !== marketplace.scope`:

```text
● official [user]
  ● helper [project] v1.0.0 (installed)
```

Skipped plugin with the benign `{up-to-date}` reason, **info** severity (per the severity ladder -- `up-to-date` is in the benign closed set, so an all-benign skip cascade computes info, not warning, per UXG-02 / D-28-06), reload-hint suppressed because no plugin status falls in the state-changing set:

```text
● demo [user]
  ⊘ commit-commands v1.0.0 (skipped) {up-to-date}
```

**Bulk `update` grammar (UGRM-01 / UGRM-02, update-scoped).** The `update` operation refines the two rules above for its BULK (`@<marketplace>` / bare) forms:

- **No per-plugin up-to-date row (UGRM-01).** A bulk `update` does NOT render a `(skipped) {up-to-date}` row for each unchanged plugin; only the plugins it actually changed appear. (A single-target `update <plugin>@<marketplace>` the user explicitly named STILL shows its `(skipped) {up-to-date}` row.)
- **Updates-only headline (UGRM-02).** The bulk-`update` trailing tally counts realized transitions only -- `Plugin update: N updated` (the verb `updated` has no plural-s, so `1 updated` / `3 updated`), composing with any failure/warning categories ahead of it (`Plugin update: 1 failure, 1 updated`). This is the ONLY operation that overrides the success category; install / reinstall / marketplace / import keep the at-desired-state count grammar `N success(es)`.
- **Never-silent no-op line.** A bulk `update` that realized ZERO transitions (all targets up-to-date, OR the only surviving rows are benign info skips such as a `(partially-upgradable)` decline) emits a single hard-coded headline `Plugin update: nothing to update` (info severity, no reload-hint) -- never zero output and never a vanished summary line. When a benign info row survives, the cascade body still renders above the headline.

**`fetch` grammar (FTCH-02 / FTCH-03, pi-only extension).** `fetch` warms a git-source plugin's local clone/mirror cache without installing it (upstream `/plugin` has no `fetch` verb). It uses the always-marketplace-header cascade form with a DERIVED post-fetch status row -- exactly the `(available)` / `(partially-available)` / `(unavailable)` tokens `list` and `info` render -- because the fetch is followed by a fresh probe against the now-warm tree, never an install cascade. A no-op fetch (path/non-git source, or a pinned-warm clone) renders `(skipped) {up-to-date}` at info severity. `fetch` introduces no new status token, glyph, or reason. It changes no Pi-visible resource (nothing is installed), so no `fetch` row is a reload-trigger and the `/reload to pick up changes` trailer never fires. The plural (`@<marketplace>` / bare) sweep is failure-tolerant -- a per-plugin throw is a `(failed)` row and the sweep continues -- and carries the DEFAULT trailing tally `Plugin fetch: N success(es)` (no update-style success-category override), composing failure/warning categories ahead of it (`Plugin fetch: 1 failure, 1 success`).

## Severity Routing

`notify()` computes severity from contents via a first-match-wins ladder (D-16-11, refined by UXG-02 / D-28-06):

1. Any plugin or marketplace with `status === "failed"` → **error**.
2. Any plugin with `status === "manual recovery"` → **warning** (always actionable).
3. Any plugin `status === "skipped"` whose reasons are **not** all in the benign closed set (`up-to-date`, `already installed`, `already autoupdate`, `already no autoupdate`, `already enabled`, `already disabled`) → **warning**. An actionable skip such as `{not installed}` (D-28-03) routes here.
4. Any marketplace `status === "skipped"` whose reasons are not all benign -- **including a `skipped` with missing/empty reasons**, which cannot be proven benign (D-28-08 safe default) → **warning**.
5. Otherwise → **info** (success / default). A cascade whose **only** non-success rows are benign idempotent no-op skips (every reason in the benign closed set) lands here: e.g. an all-`{up-to-date}` update cascade, or an idempotent `<autoupdate> {already autoupdate}` flip, computes info and omits the second argument.

A benign skip routes to **info**; an actionable skip routes to **warning**. A mixed cascade (one benign skip plus one actionable skip, or any manual-recovery row) routes the whole notification to **warning** -- first-match poisoning is intentional (D-28-09), matching "only non-success rows are benign skips → info".

Severity is dispatched via the Pi API's magic-string second-argument convention on `ctx.ui.notify`:

- **info** -- omit the second argument: `ctx.ui.notify(text)`.
- **warning** -- pass the literal string `"warning"`: `ctx.ui.notify(text, "warning")`.
- **error** -- pass the literal string `"error"`: `ctx.ui.notify(text, "error")`.

`notifyUsageError()` is structurally error severity (always passes `"error"` as the second argument) -- it is not a field on `UsageErrorMessage`. The on-the-wire string is composed as `${message}\n\n${usage}` mirroring V1's blank-line discipline.

The ladder is first-match-wins by design: a cascade with one `failed` plugin and several `skipped` plugins routes to **error**, not **warning**. The `notify()` switch evaluates the marketplaces and plugins in caller-supplied order (no internal sort per D-16-06), then returns the highest-severity match. Callers that need a different routing decision should adjust the message contents (e.g. drop the `failed` row), not request a severity override -- there is no override.

Alongside the status-derived ladder, `computeSeverity` MAX-reduces any caller-stamped `row.severity` field (SEV-02): a row may carry an explicit `severity: "error"` that elevates the notification even when its status is not itself in the ladder's error set. This is how install-failure rows route to error. A no-`--partial` install failure stamps `severity: "error"` on the row for BOTH arms (D-70-02): the partially-available arm renders the resolver-state-driven `(partially-available)` token (`PluginPartiallyAvailableMessage`, XSURF-01 -- consistent with how `list` / `info` describe the same plugin) and carries the `--partial` hint trailer (`--partial` can degrade-install the supported components), while the structural arm renders `(unavailable)` (`PluginUnavailableMessage`) and carries NO hint (`--partial` cannot degrade-install a structural defect). The SAME `PluginPartiallyAvailableMessage` / `PluginUnavailableMessage` variants on the list / info surfaces omit `severity` (and `partialHint`) and render **info** byte-frozen -- the per-row caller-stamped severity is the discriminator between the install-failure surface and the inventory surface, not the status token. The `--partial` hint trailer byte form is FROZEN (D-70-01): `Re-run with --partial to install the supported components.` -- this exact string is the locked DOC contract; the renderer literal in `shared/notify.ts` (`PARTIAL_INSTALL_HINT_TRAILER`) and the catalog-UAT gate assert against it byte-for-byte. The update-decline surface (XSURF-03) carries the update-worded analog, also FROZEN: `Re-run with --partial to update with the supported components.` (`PARTIAL_UPDATE_HINT_TRAILER`), gated on `PluginPartiallyUpgradableMessage.partialHint` so the list-inventory `partially-upgradable` row stays byte-frozen.

### Summary line (error / warning)

For **error** and **warning** severity, `notify()` prepends a human-readable summary line before the cascade body so the host `Error:` / `Warning:` prefix introduces a meaningful, contextual sentence (Phase 29 / UXG-07 / D-29-02/03/04). The composed on-the-wire body is `{summary}\n\n{cascade body}`; the reload-hint (when emitted) stays last. **Info** severity emits no summary line -- the body is byte-identical to the pre-Phase-29 cascade-only form.

The summary counts the operations that drove the severity, by type, with the verb keyed to severity:

- **error** verb `failed`: plugin rows with `status === "failed"` + marketplace rows with `status === "failed"` (mirrors ladder arm 1).
- **warning** verb `skipped`: plugin `skipped` (non-benign reasons) + plugin `manual recovery` + marketplace `skipped` (non-benign reasons) (mirrors arms 2-4 and the benign predicate).

Wording (D-29-03): singular `"operation"` at count 1, plural `"operations"` otherwise; one type non-zero renders `"N plugin operation(s) <verb>."` or `"N marketplace operation(s) <verb>."`; both non-zero renders `"N plugin operation(s) and M marketplace operation(s) <verb>."` (e.g. `"1 plugin operation failed."`, `"2 plugin operations failed."`, `"1 plugin operation and 1 marketplace operation failed."`, `"1 plugin operation skipped."`). Because the summary is derived from the same `NotificationMessage` traversal that `computeSeverity` runs -- not from caller-supplied text -- it does not violate the "No top-level free text" invariant (D-17-09).

PRD section 6.13 IL-2 (single output channel via `ctx.ui.notify`) and IL-3 (single sanctioned `console.warn` at `persistence/migrate.ts`) are reaffirmed unchanged. Direct `process.stdout` / `process.stderr` writes from command or bridge code remain forbidden.

## ES-5 Supersession Table (PRD section 6.12 ES-5 supersession; MSG-04)

This section formally supersedes PRD section 6.12 ES-5 ("stable user-contract strings"). The PRD section 6.12 ES-5 row REMAINS in the PRD as historical baseline but is NO LONGER the canonical contract for these five user-facing surfaces -- this guide is. Phase 13 will edit `shared/markers.ts` + `tests/architecture/markers-snapshot.test.ts` + PRD section 6.12 in a single atomic three-file commit per 12-RESEARCH.md "Markers Snapshot Test Integration" (the snapshot test's prefix-extraction shape is structurally incompatible with the new tokenised forms, so the deferral is mandatory -- Phase 12 cannot keep the snapshot green while changing the markers). The replacements below are reproduced verbatim from CONTEXT.md D-30; the cross-reference column points at the section of THIS guide where the new wording's full grammar is documented.

| ES-5 marker                              | Replacement                                                                                                   |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `pi-subagents is not loaded; …`          | `{requires pi-subagents}` reason on the affected line (see section 6, MSG-SD-1)                               |
| `pi-mcp-adapter is not loaded; …`        | `{requires pi-mcp}` reason on the affected line (see section 6, MSG-SD-1)                                     |
| `Run /reload to <verb> …`                | `/reload to pick up changes` (single canonical trailer, blank line above) (see section 5, MSG-RH-1)           |
| `MANUAL RECOVERY REQUIRED: …`            | `⊘ <resource> (manual recovery) {<reason>}` as a separate top-level line (see section 7, MSG-MR-1 / MSG-MR-2) |
| `(rollback partial: [<phase>] <msg>; …)` | `{rollback partial}` reason on the failed line + per-phase indented children (see section 8, MSG-RP-1)        |

PRD section 6.13 IL-2 (single output channel via `ctx.ui.notify`) and IL-3 (single sanctioned `console.warn` at `persistence/migrate.ts:178`) are REAFFIRMED unchanged. The compact-line grammar of section 1 and the severity-wrapper rules of section 10 govern every emission via `ctx.ui.notify`; the legacy-migration `console.warn` retains sentence form per section 14. ES-1..ES-4 from PRD section 6.12 are also unchanged -- this supersession is scoped strictly to ES-5's five marker strings.

> Note: The 5 ES-5 legacy markers remain blocked by `tests/architecture/no-legacy-markers.test.ts` and are fully retired alongside V1 wrapper deletion in Phase 21.

## Cross-References

- [`docs/output-catalog.md`](output-catalog.md) -- byte-equal expected outputs per command, paired with `<!-- catalog-state: STATE -->` markers consumed by the catalog UAT. This is the canonical source of rendered output bytes; this guide deliberately does not duplicate per-command examples.
- [`docs/adr/v2-001-structured-notify.md`](adr/v2-001-structured-notify.md) -- the design rationale, the public-surface excerpt, the per-variant field carve-outs, and the phased migration plan (Phases 15-21).
- [`extensions/pi-claude-marketplace/shared/notify.ts`](../extensions/pi-claude-marketplace/shared/notify.ts) `::REASONS` -- the `REASONS` closed-set tuple consumed by the 5 reason-bearing plugin variants (canonicalised here in Phase 21; SNM-29).
- [`extensions/pi-claude-marketplace/shared/notify.ts`](../extensions/pi-claude-marketplace/shared/notify.ts) -- the closed-set tuples (`PLUGIN_STATUSES`, `MARKETPLACE_STATUSES`, `DEPENDENCIES`), the discriminated `PluginNotificationMessage` union, and the `notify()` renderer's switch (the sole grammar site per SNM-17).
- [`extensions/pi-claude-marketplace/shared/notify-reasons.ts`](../extensions/pi-claude-marketplace/shared/notify-reasons.ts) -- the compile-time closed-set membership proof (`_UncoveredReason` / `_ExtraReason`), complemented by the per-command `satisfies CommandContext` checks. A literal added to a tuple without a home, or removed/renamed, is a compile error here plus the renderer's `assertNever`.
- [`tests/architecture/notify-closed-set-locks.test.ts`](../tests/architecture/notify-closed-set-locks.test.ts) -- the closed-set length tripwires (`REASONS` / `STATUS_TOKENS` / `PLUGIN_STATUSES` / `MARKETPLACE_STATUSES`): an additive drift forces a deliberate count bump.
- [`tests/architecture/catalog-uat.test.ts`](../tests/architecture/catalog-uat.test.ts) -- the user-contract gate: drives structured `NotificationMessage` fixtures through `notify()` via mock `ctx` and asserts byte-equality against `docs/output-catalog.md` per-command expected outputs.
- [`docs/prd/pi-claude-marketplace-prd.md`](prd/pi-claude-marketplace-prd.md) §6.12 -- the ES-5 origin (stable user-contract strings); the 5 ES-5 markers superseded by this guide's table above.
