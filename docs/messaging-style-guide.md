# Messaging Style Guide

**Guide version:** 2.0 **Status:** Normative -- describes the structured notification contracts in `extensions/pi-claude-marketplace/shared/notification-types.ts`, `notification-grammar.ts`, `notification-summary.ts`, and `notification-dispatch.ts` as the binding contract for every user-visible message emitted by `pi-claude-marketplace`. Supersedes guide v1.0 (the YAML-frontmatter enumeration spec). **Audience:** Engineers authoring or reviewing `notify()` / `notifyUsageError()` call sites and the single sanctioned `console.warn` at `persistence/migrate.ts`.

## Overview

This guide describes the user-output contract for `pi-claude-marketplace` as enforced by six named owners: closed tuples and unions in `shared/notification-types.ts`; icons, rows, and info rendering in `shared/notification-grammar.ts`; severity, tally, reload, and cascade folding in `shared/notification-summary.ts`; dispatch entrypoints in `shared/notification-dispatch.ts`; redaction in `shared/redact-absolute-paths.ts`; and stable name/scope ordering in `shared/compare-name-scope.ts`. Guide v1.0 was a self-contained enumeration spec: status tokens, reasons, markers, and pattern classes were listed in YAML frontmatter and the prose body iterated each set with worked examples. Guide v2.0 retires that shape. Closed-set authority moved from frontmatter keys to `as const` tuples in `shared/notification-types.ts` per ADR-v2-001 / SNM-04 / SNM-05 / SNM-06, the discriminated `PluginNotificationMessage` union locks per-variant grammar at compile time, `notification-grammar.ts` selects glyphs and composes grammar slots, and `notification-summary.ts` folds severity and trailers before `notification-dispatch.ts` emits the result.

The practical consequence: engineers no longer compose user-visible strings by hand. They construct typed `NotificationMessage` payloads and pass them to `notify()`. The renderer derives every grammar decision structurally. Severity is computed from contents (per D-16-11). The reload-hint trailer is computed from contents (per D-16-12). Soft-dependency markers (`{requires pi-subagents}` / `{requires pi-mcp}` / `{requires pi-dynamic-workflows}`) are computed at render time via a Pi-host probe (per D-16-15). Top-level free text is not expressible in `NotificationMessage`, which retires v1's `Claude plugin import summary` preamble, the `Fix the underlying issue and retry.` retry anchor, and the `source-mismatch` diagnostic line (per D-17-09).

Two artifacts back this guide. The Type Model Reference section points at the closed-set tuples and the discriminated-union shape. The catalog at `docs/output-catalog.md` is the byte-equal user-contract surface; the test at `tests/architecture/catalog-uat/catalog-contract.test.ts` drives `notify()` against catalog fixtures and asserts byte-equality. Read this guide for the type model; read the catalog for the rendered output bytes.

## Type Model Reference

The user-output contract is defined by the types and `as const` tuples in `extensions/pi-claude-marketplace/shared/notification-types.ts`. This section points at those definitions; it does not duplicate them. Read the source.

The two public entry points and the user-facing types:

```ts
export function notify(ctx: ExtensionContext, pi: ExtensionAPI, message: NotificationMessage): void;
export function notifyUsageError(ctx: ExtensionContext, message: UsageErrorMessage): void;

export type NotificationMessage; // { marketplaces: readonly MarketplaceNotificationMessage[] }
export type MarketplaceNotificationMessage; // { name; scope; status?; details?; plugins }
export type PluginNotificationMessage; // discriminated union on `status`, one arm per PluginStatus member
export type PluginStatus; // literal union; the declaration order is the catalog order
export type MarketplaceStatus; // literal union; the declaration order is the catalog order
export type Dependency; // "agents" | "mcp" | "workflows"
export interface MarketplaceDetails; // { autoupdate: boolean; lastUpdatedAt?: string }
export interface UsageErrorMessage; // { message: string; usage: string }
```

The discriminated `PluginNotificationMessage` union pins each variant's `status` to its literal string for TypeScript narrowing. Each arm is one interface named after its status, declared and joined in `extensions/pi-claude-marketplace/shared/notification-types.ts`. Read that declaration for the membership and the order; the per-arm field discipline is tabulated below.

Every closed set below is written as a literal union: nothing reads the members at runtime, and a tuple that only ever feeds `(typeof X)[number]` is an unreferenced runtime value (SNM-04 / SNM-05 / SNM-06 / D-15-11). The declaration order is the catalog's order, and the gates that need it read the declaration as data:

- `PluginStatus` -- the closed set of plugin status discriminators. Read `extensions/pi-claude-marketplace/shared/notification-types.ts` for the canonical membership and ordering; do not re-enumerate the values in prose. The 4 pending-tense `will *` pending statuses are the DIFF-02 read-only pending tokens. The list-only inventory row uses `installed` with `needsReload: false` (RLD-04). `disabled` (ENBL-04) is the list-surface inventory token, and it additionally doubles as the `/claude:plugin disable` command's realized cascade-row token (v1.12 UAT-03 decision; the reload-hint distinction is carried by the cascade's `disable-cascade` kind, not by the token).
- `MarketplaceStatus` -- the closed set of marketplace status discriminators. Same rule. The 3 autoupdate-surface statuses (`autoupdate enabled`, `autoupdate disabled`, `skipped`) were added in Phase 17.1 per D-17.1-01 to support the user-locked surface design in D-18-05. WILL-01 / D-65.1-02 / D-65.1-03: the marketplace level carries no pending-tense `will *` status -- add is immediate, and a remove surfaces its reload-deferred plugin-uninstall cascade as per-plugin `will uninstall` child rows under a bare header.
- `Dependency` -- the closed set of 3 soft-dependency probe targets, declared in `extensions/pi-claude-marketplace/shared/concerns/soft-dep.ts`. Drives the render-time probe path; `agents` → `pi-subagents`, `mcp` → `pi-mcp-adapter`, `workflows` → `pi-dynamic-workflows`. The third marker keeps the scope abbreviated as `pi-dynamic-workflows` rather than shortened further: the short form is the npm name of `@nicknisi/pi-workflows`, a different engine, so it would point the operator at the wrong package to install.
- `Reason` (closed-set reason tokens used inside `{<reason>}` braces on the 15 reason-bearing plugin variants) -- defined in `extensions/pi-claude-marketplace/shared/notification-types.ts`. The reason set survives v2.0 unchanged in spirit; the 3 v1.3 reasons structurally absorbed by the type model (`rollback partial`, `requires pi-subagents`, `requires pi-mcp`) no longer appear in any typed `reasons` field -- they are emitted by the renderer from the `rollbackPartial` field and the soft-dep probe, respectively. `authentication required` (D-76-08) is the failure-class token for an HTTP auth challenge (401/403) on a marketplace clone: **error** severity, cause chain carries the HTTP detail. Truthful attribution -- a 401/403 is an auth failure, so it MUST NOT be rendered as `network unreachable` (the auth condition and the network-reachability condition are distinct). Reused by `PROV-04`'s fail-clean provider-auth case.

The discriminated union and the per-variant field carve-outs are the binding compile-time contract. Adding or removing a variant, or shifting a field's required/optional discipline, is enforced by the renderer's exhaustive `switch` with no `default` arm (SNM-17; `@typescript-eslint/switch-exhaustiveness-check` rejects a missing arm and a redundant `default`), by the per-command `satisfies CommandContext` checks in the `*.messaging.ts` modules, and by the `_UncoveredReason` / `_ExtraReason` closed-set membership proof in `extensions/pi-claude-marketplace/shared/notify-reasons.ts`; the closed-set lengths are tripwired by `tests/architecture/notify-closed-set-locks.test.ts`. A drift from one of the unions or the per-variant discipline becomes a compile error or a failing length lock.

**Field discipline per status.** This table is the single site that states the four cascade fields per arm. It carries one row per `PluginStatus` member, in declaration order. A cell reads `required` when the arm's interface declares the field without `?`, `optional` when it declares the field with `?`, and `absent` when it declares no such field at all. An `absent` row cannot acquire the field, so writing one is a compile error: `(uninstalled)` may carry a brace, `(will install) {up-to-date}` cannot. `tests/architecture/messaging-guide-doc-pins.test.ts` (MSGDOC-01) compares every cell below against the interface it describes.

| Status                 | `reasons` | `dependencies` | `version` | `scope`  |
| ---------------------- | --------- | -------------- | --------- | -------- |
| `installed`            | optional  | required       | optional  | optional |
| `updated`              | optional  | required       | absent    | optional |
| `reinstalled`          | optional  | required       | optional  | optional |
| `uninstalled`          | optional  | absent         | optional  | optional |
| `available`            | optional  | absent         | optional  | absent   |
| `unavailable`          | required  | absent         | optional  | absent   |
| `upgradable`           | required  | absent         | optional  | optional |
| `failed`               | required  | absent         | optional  | optional |
| `skipped`              | required  | absent         | optional  | optional |
| `manual recovery`      | required  | absent         | optional  | optional |
| `will install`         | absent    | absent         | absent    | optional |
| `will uninstall`       | absent    | absent         | absent    | optional |
| `will enable`          | absent    | absent         | absent    | optional |
| `will disable`         | absent    | absent         | absent    | optional |
| `disabled`             | optional  | absent         | optional  | optional |
| `partially-installed`  | required  | optional       | optional  | optional |
| `partially-upgradable` | required  | absent         | optional  | optional |
| `partially-available`  | required  | absent         | optional  | absent   |
| `remote`               | optional  | absent         | optional  | absent   |

Two fields are narrower than a column and stay as bullets:

- `cause?: Error` on `failed | manual recovery` only (SNM-10).
- `rollbackPartial?: readonly { phase: string; cause?: Error }[]` on `failed` only (SNM-09).

Why the cells fall where they do:

- **`reasons`.** A `required` cell means the row cannot render without stating why the plugin is in that state; the failure, skip and degradation arms are the ones that owe the reader a reason (D-15-01), and the two derived partial-state tokens are modeled on the `upgradable` arm and carry the degradation detail (FSTAT-02 / FSTAT-04 / D-66-02 / D-66-03). An `optional` cell means the arm carries a brace only when its ledger produced a fact worth naming, and renders byte-identically to a reasons-less row when it did not (`installed` SURF-05 / D-63-08, `updated` WARN-01 / WR-12, `reinstalled` WARN-01 / WR-09, `disabled` ENBL-16 / D-100-07); on a not-installed candidate the brace states what an install WOULD do rather than what one did (`available` OUT-02, `remote` OUT-05 / RSTA-01). The `absent` cells are the DIFF-02 pending-tense arms, which have no realized state to explain. 8 `required` plus 7 `optional` plus 4 `absent` is every member of the union: the table is exhaustive, not illustrative.
- **`dependencies`.** Only an arm that materializes components can emit a soft-dep marker, so only those arms reach the per-dependency probe path (D-15-02 + SNM-06). `partially-installed` carries the field on its install / update / enable success rows and omits it on the list / info inventory rows, so an inventory row emits no marker (WR-03). An `absent` cell is a row that cannot emit a marker at all.
- **`version`.** `updated` carries a REQUIRED `from: string; to: string` pair instead of a single version (D-15-04). The `will *` arms omit it because the recorded version is not load-bearing before the transition (DIFF-02). The hash-version contract (PI-7 `hash-<12hex>`) remains a plain string -- no branded type.
- **`scope`.** The `absent` cells are the SNM-11 carve-out family, `available | unavailable | partially-available | remote` (the MSG-PL-6 carve-out preserved structurally, joined by the two not-installed members USTAT-01 and RSTA-01 add). The list surface emits no `[<scope>]` bracket on those rows: each describes a candidate rather than an installation.

See `docs/adr/v2-001-structured-notify.md` for the design rationale (especially the "Public surface" and "NotificationMessage shape" sections).

## Output Grammar Summary

The renderer enforces these grammar invariants structurally. The list is descriptive (it records what the renderer emits, for reviewers of `notify()` payloads); the binding implementation lives in `shared/notification-grammar.ts`'s switch and helpers.

- **Always-marketplace-header form.** Every `notify()` output begins with a marketplace header at column 0; plugin rows are indented two spaces beneath. The v1.3 inline-plugin and bare-cascade emissions are retired (per ADR-v2-001 "Always-marketplace-header spec change" + D-16-04). A single-plugin install renders as a marketplace header at column 0 with one indented plugin row beneath; there is no carve-out for "single-plugin commands skip header."
- **Indentation discipline.** Marketplace header at column 0. Plugin rows at 2-space indent. Per-plugin cause chains and `rollbackPartial` per-phase children at 4-space indent. One blank line between marketplace blocks (per D-16-07).
- **Conditional plugin-row scope bracket.** A plugin row emits `[<scope>]` only when its `scope` differs from the parent marketplace's `scope` (orphan-fold case per D-16-17). Same-scope plugins inherit the marketplace's scope from the header and omit the bracket. The `available | unavailable | partially-available | remote` variants carry no `scope` field at all (SNM-11), so their rows never emit the bracket regardless of context.
- **Computed severity routing.** `notify()` computes severity from contents per the ladder in §"Severity Routing" (D-16-11). Callers do not supply severity.
- **Computed reload-hint trailer.** `notify()` appends `/reload to pick up changes` (with one blank line above) iff any plugin status is in `{installed, updated, reinstalled, uninstalled}`, or -- on a cascade dispatched with the `disable-cascade` kind (the `/claude:plugin disable` command's realized-transition cascade, v1.12 UAT-03) -- any plugin status is `disabled` (D-16-12, narrowed by SNM-33). The trigger is plugin-row-driven ONLY: marketplace records are bookkeeping, not Pi-visible resources, so NO marketplace status triggers the trailer on its own (a clean `marketplace remove` still emits it via the per-unstaged-plugin `uninstalled` rows). The `disabled` token on kind-less / `cascade` payloads and the pending-tense `will *` pending tokens are structurally excluded. Callers do not supply a flag -- the disable orchestrator supplies the cascade KIND, and the hint stays contents-derived within that kind.
- **Computed soft-dep probe.** Each `dependencies: ["agents"]` triggers a render-time probe for `pi-subagents`; absence emits `{requires pi-subagents}` on the plugin row. `dependencies: ["mcp"]` is the analogous probe for `pi-mcp-adapter` emitting `{requires pi-mcp}`, and `dependencies: ["workflows"]` the analogous probe for the host workflow engine emitting `{requires pi-dynamic-workflows}` (D-16-15). The engine probe reads the `workflow_control` tool name, which only that engine registers (WDEP-01). The probe runs once per `notify()` invocation (D-16-14) and is threaded through every plugin-row render so all rows see a consistent host snapshot.
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
3. Any plugin `status === "skipped"` whose reasons are **not** all in the benign closed set (`up-to-date`, `already installed`, `already autoupdate`, `already no autoupdate`, `already enabled`, `already disabled`) → **warning**. An actionable skip such as `{not in manifest}` routes here (D-28-03). Note that a producer may still stamp a higher severity on the row itself: every producer of the absent-target `{not installed}` skip stamps `error` (D-01 -- nothing was carried out), and the SEV-02 MAX-reduce below wins over this arm.
4. Any marketplace `status === "skipped"` whose reasons are not all benign -- **including a `skipped` with missing/empty reasons**, which cannot be proven benign (D-28-08 safe default) → **warning**.
5. Otherwise → **info** (success / default). A cascade whose **only** non-success rows are benign idempotent no-op skips (every reason in the benign closed set) lands here: e.g. an all-`{up-to-date}` update cascade, or an idempotent `<autoupdate> {already autoupdate}` flip, computes info and omits the second argument.

A benign skip routes to **info**; an actionable skip routes to **warning**. A mixed cascade (one benign skip plus one actionable skip, or any manual-recovery row) routes the whole notification to **warning** -- first-match poisoning is intentional (D-28-09), matching "only non-success rows are benign skips → info".

Severity is dispatched via the Pi API's magic-string second-argument convention on `ctx.ui.notify`:

- **info** -- omit the second argument: `ctx.ui.notify(text)`.
- **warning** -- pass the literal string `"warning"`: `ctx.ui.notify(text, "warning")`.
- **error** -- pass the literal string `"error"`: `ctx.ui.notify(text, "error")`.

`notifyUsageError()` is structurally error severity (always passes `"error"` as the second argument) -- it is not a field on `UsageErrorMessage`. The on-the-wire string is composed as `${message}\n\n${usage}` mirroring V1's blank-line discipline.

The ladder is first-match-wins by design: a cascade with one `failed` plugin and several `skipped` plugins routes to **error**, not **warning**. The `notify()` switch evaluates the marketplaces and plugins in caller-supplied order (no internal sort per D-16-06), then returns the highest-severity match. Callers that need a different routing decision should adjust the message contents (e.g. drop the `failed` row), not request a severity override -- there is no override.

Alongside the status-derived ladder, `computeSeverity` MAX-reduces any caller-stamped `row.severity` field (SEV-02): a row may carry an explicit `severity: "error"` that elevates the notification even when its status is not itself in the ladder's error set. This is how install-failure rows route to error. A no-`--partial` install failure stamps `severity: "error"` on the row for BOTH arms (D-70-02): the partially-available arm renders the resolver-state-driven `(partially-available)` token (`PluginPartiallyAvailableMessage`, XSURF-01 -- consistent with how `list` / `info` describe the same plugin) and carries the `--partial` hint trailer (`--partial` can degrade-install the supported components), while the structural arm renders `(unavailable)` (`PluginUnavailableMessage`) and carries NO hint (`--partial` cannot degrade-install a structural defect). The SAME `PluginPartiallyAvailableMessage` / `PluginUnavailableMessage` variants on the list / info surfaces omit `severity` (and `partialHint`) and render **info** byte-frozen -- the per-row caller-stamped severity is the discriminator between the install-failure surface and the inventory surface, not the status token. The `--partial` hint trailer byte form is FROZEN (D-70-01): `Re-run with --partial to install the supported components.` -- this exact string is the locked DOC contract; the renderer literal in `shared/notification-grammar.ts` (`PARTIAL_INSTALL_HINT_TRAILER`) and the catalog-UAT gate assert against it byte-for-byte. The update-decline surface (XSURF-03) carries the update-worded analog, also FROZEN: `Re-run with --partial to update with the supported components.` (`PARTIAL_UPDATE_HINT_TRAILER`), gated on `PluginPartiallyUpgradableMessage.partialHint` so the list-inventory `partially-upgradable` row stays byte-frozen. The stale-gate enable failure carries a THIRD frozen trailer, `Run update --partial on this plugin, then enable it again.` (`STALE_GATE_UPDATE_HINT_TRAILER`), gated on `PluginFailedMessage.partialHint`: its remedy is `update --partial` as well, but the command that failed is `enable`, which rejects `--partial`, so a "re-run" wording would name the wrong command (CR-01). The standalone `marketplace-not-added` row carries NO trailer. Where the marketplace container is registered in the scope the command did not target (CMP-4 / SCOPE-01), the row states it through a structural REASON TOKEN in its own brace -- `{marketplace not added to user scope}` or its project-target sibling `{marketplace not added to project scope}`, each REPLACING `{marketplace not added}` rather than joining it -- gated on `MarketplaceNotAddedMessage.presentInOtherScope`. The caller supplies a BOOLEAN and `shared/notification-grammar.ts` selects the token, so the "engineers no longer compose user-visible strings by hand" rule above holds. A trailer was considered and rejected: trailer prose would have had to name a command (`marketplace add`, `the install`), which binds it to one verb, while ten construction sites across eight files render this same row -- a state token is verb-neutral. The token names the scope that MISSED, matching the `[scope]` bracket beside it, and carries no remedy. A qualified token requires that bracket: an absent bracket means both scopes were consulted and both missed (D-03), so no other scope remains to be present in. `--local` is absent from this surface entirely -- it selects the physical config file WITHIN a scope, so it cannot resolve a scope miss. The lifecycle verbs (`uninstall` / `update` / `reinstall` / `enable` / `disable`) do NOT render that marketplace-subject row for this condition: they act on an INSTALL RECORD, so a container one scope over means nothing of it is installed where the operator asked, and the PLUGIN becomes the row's subject. That row carries the CONTENT pair `marketplace in user scope` / `marketplace in project scope` (SCOPE-01), which JOINS `not installed` in the same brace instead of replacing it -- `{not installed, marketplace in user scope}`. The pair stays inside `ContentReason` precisely because its subject is the plugin row it rides: it explains why THIS plugin has no record here, and makes no claim that the marketplace is absent. The scope word names where the container IS, so it is always the OPPOSITE of the `[scope]` bracket beside it -- the inverse of the structural token above, which names the scope that missed. A miss whose container IS in the targeted scope keeps the bare `{not installed}`: there the remedy is to install the plugin, not to change scope.

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

> Note: The 5 ES-5 legacy markers are fully retired -- they went with the V1 wrappers, and no renderer arm emits one. They are also deliberately ungated, by decision rather than by omission: the suite that pinned the literals was retired alongside the wrappers it policed, and a ban on strings no producer emits was judged not worth reinstating. The residual is accepted -- only the byte-equality of `tests/architecture/catalog-uat/catalog-contract.test.ts` would catch a reintroduction, and only where the catalog records that row.

## Cross-References

- [`docs/output-catalog.md`](output-catalog.md) -- byte-equal expected outputs per command, paired with `<!-- catalog-state: STATE -->` markers consumed by the catalog UAT. This is the canonical source of rendered output bytes; this guide deliberately does not duplicate per-command examples.
- [`docs/adr/v2-001-structured-notify.md`](adr/v2-001-structured-notify.md) -- the design rationale, the public-surface excerpt, the per-variant field carve-outs, and the phased migration plan (Phases 15-21).
- [`extensions/pi-claude-marketplace/shared/notification-types.ts`](../extensions/pi-claude-marketplace/shared/notification-types.ts) -- the closed-set unions and discriminated notification unions, including `Reason` (consumed by the 15 reason-bearing plugin variants), `PluginStatus`, and `MarketplaceStatus`.
- [`extensions/pi-claude-marketplace/shared/notification-grammar.ts`](../extensions/pi-claude-marketplace/shared/notification-grammar.ts) -- icon, row, header, trailer, and information-body rendering; the `notify()` renderer's switch (the sole grammar site per SNM-17).
- [`extensions/pi-claude-marketplace/shared/notification-summary.ts`](../extensions/pi-claude-marketplace/shared/notification-summary.ts) -- severity, tally, reload, and cascade-summary folding.
- [`extensions/pi-claude-marketplace/shared/notification-dispatch.ts`](../extensions/pi-claude-marketplace/shared/notification-dispatch.ts) -- `notify()`, `notifyUsageError()`, diagnostic, hook, and raw entrypoints; the sole direct Pi output owner.
- [`extensions/pi-claude-marketplace/shared/redact-absolute-paths.ts`](../extensions/pi-claude-marketplace/shared/redact-absolute-paths.ts) -- notification diagnostic path redaction.
- [`extensions/pi-claude-marketplace/shared/compare-name-scope.ts`](../extensions/pi-claude-marketplace/shared/compare-name-scope.ts) -- stable name-first, project-before-user ordering.
- [`extensions/pi-claude-marketplace/shared/concerns/soft-dep.ts`](../extensions/pi-claude-marketplace/shared/concerns/soft-dep.ts) -- the `Dependency` closed-set union of soft-dependency probe targets.
- [`extensions/pi-claude-marketplace/shared/notify-reasons.ts`](../extensions/pi-claude-marketplace/shared/notify-reasons.ts) -- the compile-time closed-set membership proof (`_UncoveredReason` / `_ExtraReason`), complemented by the per-command `satisfies CommandContext` checks. A literal added to a tuple without a home, or removed/renamed, is a compile error here plus a lint error at the renderer's exhaustive `switch`.
- [`tests/architecture/notify-closed-set-locks.test.ts`](../tests/architecture/notify-closed-set-locks.test.ts) -- the closed-set length tripwires (`Reason` / `StatusToken` / `PluginStatus` / `MarketplaceStatus`): an additive drift forces a deliberate count bump.
- [`tests/architecture/catalog-uat/catalog-contract.test.ts`](../tests/architecture/catalog-uat/catalog-contract.test.ts) -- the user-contract gate: drives structured `NotificationMessage` fixtures through `notify()` via mock `ctx` and asserts byte-equality against `docs/output-catalog.md` per-command expected outputs.
- [`docs/prd/pi-claude-marketplace-prd.md`](prd/pi-claude-marketplace-prd.md) §6.12 -- the ES-5 origin (stable user-contract strings); the 5 ES-5 markers superseded by this guide's table above.
