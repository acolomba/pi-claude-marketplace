# Command Output Catalog

Per-command rendered output for each user-visible state. Catalog v2.0 supersedes the v1.0 grammar (single-plugin one-line carve-out, V1 wrapper-name severity routing, frontmatter-driven closed sets) with the structured-`NotificationMessage` grammar emitted by the Phase 16 `notify(ctx, pi, message)` renderer at `extensions/pi-claude-marketplace/shared/notify.ts`. Every fenced output block in this catalog is byte-equal to what `notify()` emits given a corresponding structured fixture; `tests/architecture/catalog-uat.test.ts` drives that byte-equality as the user-contract gate.

## Conventions

### Glyphs

- `●` -- filled circle. On plugin rows: plugin is installed or pending a positive transition (covers `(installed)`, `(updated)`, `(reinstalled)`, `(upgradable)`, and the preview pending-tense `(will install)` / `(will enable)`). On marketplace headers: success / OK / state-changing outcome (`(added)`, `(removed)`, `(updated)`, the preview `(will add)`, and the list-surface label form).
- `○` -- empty circle. On plugin rows: plugin is not installed and there is no error -- `(available)` (declared but never installed), `(uninstalled)` (explicitly removed), or the preview pending-tense `(will uninstall)`. Never used on marketplace headers EXCEPT the preview `(will remove)` arm (the marketplace-level analog of an uninstall).
- `⊘` -- prohibited symbol. On plugin rows: error / blocked state -- `(unavailable)`, `(skipped)`, `(failed)`, `(manual recovery)`, or the preview pending-tense `(will disable)`. On marketplace headers: `(failed)` only.

### Always-marketplace-header form

Every `notify()` output begins with a marketplace header at column 0; plugin rows are indented two spaces beneath. The v1.0 carve-outs ("single-plugin commands skip the header form", "marketplace-only commands skip the header form", "conditional header-form commands") are retired. A single-plugin install renders as a marketplace header + one indented plugin row; a header-only command (`marketplace add`, `marketplace autoupdate`, `bootstrap`, an _empty_ `marketplace remove`, `marketplace update` with no plugin children) renders the header alone with `plugins: []`. A non-empty `marketplace remove` renders the header plus one indented `(uninstalled)` row per unstaged plugin (D-22-02). The grammar is uniform across every command surface.

### Marketplace header shape

| Marketplace status                         | Header byte form (where `M` = name, `S` = scope) |
| ------------------------------------------ | ------------------------------------------------ |
| `added`                                    | `● M [S] (added)`                                |
| `removed`                                  | `● M [S] (removed)`                              |
| `updated`                                  | `● M [S] (updated)`                              |
| `failed`                                   | `⊘ M [S] (failed)`                               |
| `undefined`, no `details`                  | `● M [S]` (bare label header)                    |
| `undefined`, `details.autoupdate === true` | `● M [S] <autoupdate>`                           |

On THIS list surface (mp.status === undefined) the marker token `<autoupdate>` appears via the `MarketplaceDetails` field. The state-change arms (`added` / `removed` / `updated` / `failed`) carry the status token in `(...)` and never carry the marker token. On the list surface `<no autoupdate>` is not emitted -- the absence of the `<autoupdate>` marker conveys autoupdate-off. (The explicit `<no autoupdate>` off-marker IS emitted on the separate `marketplace autoupdate` / `noautoupdate` flip surface per UXG-04; see [`## /claude:plugin marketplace autoupdate|noautoupdate <name>`](#claudeplugin-marketplace-autoupdatenoautoupdate-name).) The `details.lastUpdatedAt` field is retained in state/type but is NOT rendered on the list surface (UXG-01 -- the raw ISO timestamp is noise and meaningless for path-source marketplaces).

### Plugin row shape

```text
<icon> <name> [<scope>]? <version-token>? (<status>) {<reasons>}?
```

- `<icon>` -- one of `●` / `○` / `⊘` per the effective-state rule above.
- `<name>` -- the plugin name from `p.name`. The `@<marketplace>` suffix is NEVER emitted on a plugin row in v2; the marketplace is already in the header above.
- `[<scope>]` -- emitted ONLY in the orphan-fold case (plugin's `scope` field is explicitly set AND differs from the marketplace's scope). Same-scope rows omit the bracket because the header carries it. The `available` and `unavailable` variants have no `scope` field at all (SNM-11 carve-out) and never emit the bracket.
- `<version-token>` -- `v<version>` on most variants when `version` is set; `v<from> → v<to>` on the `updated` variant (required from-/to-fields per D-15-04). A persisted PI-7 hash-version (`hash-<12hex>`) renders as a git-style short SHA `v#<7hex>` -- the `hash-` prefix is stripped and only the first 7 of the 12 hex chars are shown (matching git `--short=7`); e.g. `hash-2ea95f85703d` renders `v#2ea95f8`. Persistence is unchanged (`state.json` keeps the full `hash-<12hex>`, PI-7 intact, no migration); the short form exists only at render time (SNM-35, D-23-04 / D-23-05).
- `(<status>)` -- the discriminator literal. `(manual recovery)` includes the space verbatim.
- `{<reasons>}` -- single brace block, comma-space separated, emitted only on the 5 reason-bearing variants (`unavailable | upgradable | skipped | failed | manual recovery`) and only when the composed reasons list is non-empty.

### Conditional plugin-row scope bracket

The plugin-row `[<scope>]` bracket is emitted ONLY when the plugin's `scope` field is set and differs from the parent marketplace's scope (the orphan-fold case per D-16-17). Same-scope rows inherit the marketplace's scope from the header and omit the bracket. The `available` and `unavailable` variants have no `scope` field by construction (SNM-11) and never carry the bracket regardless of context.

### Indentation discipline

- Marketplace header at column 0.
- Plugin rows at 2-space indent.
- Per-plugin cause-chain trailer (`failed | manual recovery` variants carrying `cause?: Error`) at 4-space indent below the plugin row.
- `rollbackPartial` child rows on `failed` variants at 4-space indent (each phase: `[<phase>] (rollback failed)`); each phase's optional `cause?: Error` renders a 6-space-indent cause-chain trailer below it.
- One blank line between marketplace blocks.

This 0 / 2 / 4 / 6 ladder is the byte-exact contract `notify()` emits at the `ctx.ui.notify` boundary, captured **before** any markdown/tui display layer. The interactive pi-tui markdown renderer can add a single leading space when it displays the message, so a header may **appear** at one space and plugin rows at three (a "1/3" visual). That appearance is a display-layer artifact, not a renderer deviation: the binding contract is the pre-tui byte ladder above, which `tests/architecture/catalog-uat.test.ts` (byte-equality) and `tests/shared/snm38-indent-ladder.test.ts` (explicit leading-whitespace) both lock at 0 / 2 / 4 / 6 (SNM-38 / G-MIL-03, D-25-09 -- refuted: not a renderer bug).

### Reasons rendering

Reasons render inside a single `{}` block, comma-space separated. Each reason is 1-3 words lowercase, hyphenated where natural (`{up-to-date}`, `{rollback partial}`, `{not in manifest}`). Manifest field names render verbatim as the sole carve-out (`{hooks}`, `{lsp}`). The closed-set membership is defined by `extensions/pi-claude-marketplace/shared/notify.ts::REASONS`.

The soft-dep markers `requires pi-subagents` and `requires pi-mcp` live INSIDE the same brace block as the variant's typed reasons (D-16-15 injection). They are emitted by the renderer at render time from the plugin's `dependencies` field and the Pi-host probe; callers do not place them in `reasons` directly. The 3 dep-bearing variants (`installed | updated | reinstalled`) carry the `dependencies` field per D-15-02; the other 7 variants cannot emit soft-dep markers structurally.

### Reload-hint trailer

`notify()` appends `/reload to pick up changes` (with one blank line above the trailer) iff (SNM-33 / D-22-01):

- A plugin status is in `{installed, updated, reinstalled, uninstalled}`, or
- a plugin status is `disabled` AND the cascade is dispatched with the `disable-cascade` kind -- the `/claude:plugin disable` command's realized-transition cascade (v1.12 milestone UAT-03 decision, 2026-06-11).

The principle: marketplace records are bookkeeping, not Pi-visible resources; only plugin rows (skill / agent / command / MCP entry) are. A marketplace status alone (`added`, `removed`, `updated`, `autoupdate enabled`, `autoupdate disabled`) never warrants a `/reload` -- the trailer fires only when a plugin row carries a state-change token. A `failed` marketplace does NOT trigger the trailer (rolled-back state has nothing to reload). A failed-only cascade (no successful or state-changing rows) also suppresses the trailer.

The list-only inventory token `present` (emitted by `/claude:plugin list` for already-installed plugins as a steady-state row -- distinct from the cascade-context `installed` transition token) is deliberately ABSENT from the plugin-status trigger set. This keeps `shouldEmitReloadHint`'s contents-derived decision unambiguous per SNM-15: within a given cascade kind, every status discriminator either always triggers or never triggers. The `disabled` token resolves its inventory-vs-transition straddle structurally at the KIND level (UAT-03): hint-free on kind-less / `cascade` payloads (the list / info inventory surfaces), trigger on `disable-cascade` payloads (the disable command's fresh cascade) -- mirroring the `reconcile-applied-cascade` kind's structural trailer exclusion. See UAT gap G-21-01 in `.planning/phases/21-final-teardown-green-gate/21-HUMAN-UAT.md` for the failure mode the original split closes.

### Severity routing

Computed by `notify()` from contents via a first-match-wins ladder (D-16-11). See "Severity routing" below.

For `error` and `warning` severity, `notify()` PREPENDS a one-line summary that counts the failed (error) or actionable-skip + manual-recovery (warning) operations before the cascade body (Phase 29 / UXG-07 / D-29-02). The composed body is `{summary}\n\n{cascade body}` -- the summary gives the host `Error:` / `Warning:` prefix a meaningful sentence to introduce. Info-severity cascades carry no summary line. See "Summary line" under "Severity routing" below.

### Autoupdate marker

The `<autoupdate>` marker appears on two surfaces: (1) the list-surface marketplace-header form (`mp.status === undefined`, `mp.details.autoupdate === true`) -- see "Marketplace header shape" above; and (2) the `marketplace autoupdate` / `noautoupdate` flip surface, where UXG-04 renders the marker as the flip outcome. The non-autoupdate state-change marketplace-header arms (`added` / `removed` / `updated` / `failed`) do not carry the marker. The two autoupdate surfaces differ in how they convey autoupdate-off: on the **list** surface `<no autoupdate>` is not emitted -- the absence of the `<autoupdate>` marker conveys autoupdate-off; on the **flip** surface the explicit `<no autoupdate>` off-marker IS emitted (UXG-04).

### v1.0 → v2.0 dropped surfaces

The v2 grammar retires several v1-only free-text augmentations that are not expressible in `NotificationMessage`. Reviewers should expect these surfaces to be absent from v2 catalog states (the v1 verbatim strings are deliberately not reproduced here so the catalog UAT's negative greps never match against the catalog itself):

- The v1 `import` preamble line (a leading free-text summary header above the marketplace blocks) is dropped per D-17-09 -- `notify()` does not emit top-level free-text headers; the marketplace-header structure IS the body.
- The v1 `marketplace remove` partial-failure retry-anchor trailer (a free-text "fix and retry" sentence above the reload-hint) is dropped per D-17-09 -- `notify()` does not emit free-text recovery trailers; the per-plugin cause-chain trailer and the cascade severity surface the recovery context structurally.
- The v1 `import` source-mismatch diagnostic line (a free-text "existing source does not match Claude settings source" sentence under a failed marketplace header) is dropped per D-17-09 -- the v2 type model has no per-row free-text augmentation slot. The `import` cascade simply omits the offending marketplace from the payload or renders it as a `(failed)` header with a per-plugin failed/manual-recovery row carrying the diagnostic as `cause?: Error` text.
- The v1 `(no plugins)` body line under a per-marketplace block is dropped -- the empty `plugins: []` array IS the structural representation per D-15-08; the renderer emits the bare marketplace header alone.
- The v1 `install-failure-with-anchor` system-level recovery state (a top-level `(manual recovery)` line decoupled from the failed install row) is dropped per D-17-10 -- `PluginManualRecoveryMessage` is a per-plugin variant inside a marketplace block; the v2 type model has no system-level free-form recovery anchor.

The `(no marketplaces)` body sentinel (D-15-09 / D-16-17) IS retained -- it is the structural representation of an empty top-level `marketplaces: []`, emitted by the renderer for the empty list-surface case.

______________________________________________________________________

## Severity routing

`notify()` computes severity from contents via a first-match-wins ladder. The severity arg is dispatched via the Pi-API's magic-string second-argument convention on `ctx.ui.notify`.

| Match (first-wins)                                                    | Severity arg   | Trigger                                                                                                                                                                                                             |
| --------------------------------------------------------------------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Any plugin or marketplace with `status === "failed"`                  | `"error"`      | Failure-class payload (single or cascade).                                                                                                                                                                          |
| Any plugin with `status === "manual recovery"`                        | `"warning"`    | Manual-recovery anchor (always actionable) without an outright failure.                                                                                                                                             |
| Any `skipped` row (plugin or mp) whose reasons are **not** all benign | `"warning"`    | An actionable skip (e.g. `{not installed}`, D-28-03), OR an mp-level `skipped` with missing/empty reasons (D-28-08 safe default).                                                                                   |
| Otherwise (incl. an **all-benign** skip cascade)                      | (omit 2nd arg) | Success / info path. A cascade whose only non-success rows are benign idempotent no-op skips (`up-to-date`, `already installed`, `already autoupdate`, `already no autoupdate`) computes info per UXG-02 / D-28-06. |

`notifyUsageError(ctx, UsageErrorMessage)` is structurally `"error"` severity (always). The on-the-wire string is `${message}\n\n${usage}` (mirrors V1's blank-line discipline).

### Summary line (error / warning)

For `error` and `warning` severity, `notify()` prepends a human-readable summary line before the cascade body (Phase 29 / UXG-07 / D-29-02/03/04). The composed on-the-wire body is `{summary}\n\n{cascade body}` (the reload-hint, if any, stays last). Info severity emits no summary line -- the cascade body is byte-identical to the pre-Phase-29 form.

The summary counts the operations that drive the severity, by type (plugin vs marketplace), with the verb chosen by severity:

| Severity  | Counts (D-29-04)                                                                                              | Verb        |
| --------- | ------------------------------------------------------------------------------------------------------------- | ----------- |
| `error`   | plugin rows with `status === "failed"` + marketplace rows with `status === "failed"`                          | `"failed"`  |
| `warning` | plugin `skipped` (non-benign reasons) + plugin `manual recovery` + marketplace `skipped` (non-benign reasons) | `"skipped"` |

Wording (D-29-03): singular `"operation"` for a count of 1, plural `"operations"` otherwise. When only one type is non-zero the line is `"N plugin operation(s) <verb>."` or `"N marketplace operation(s) <verb>."`; when both are non-zero it is `"N plugin operation(s) and M marketplace operation(s) <verb>."`. Examples: `"1 plugin operation failed."`, `"2 plugin operations failed."`, `"1 marketplace operation failed."`, `"1 plugin operation and 1 marketplace operation failed."`, `"1 plugin operation skipped."`. The summary is computed structurally from the `NotificationMessage` traversal `computeSeverity` performs -- it is not caller-supplied free text, so it does not violate the "no top-level free text" principle (D-17-09).

______________________________________________________________________

## Status token reference

| Token                                       | Icon | Where it appears                                                                                                                                                            |
| ------------------------------------------- | ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `(installed)`                               | ●    | Plugin row -- `list` (steady-state inventory via `present` discriminator), install, import cascade, reinstall (rare), update (rare).                                        |
| `(installed)` (via `present` discriminator) | ●    | Plugin row -- list surface (steady-state inventory). Byte-identical render to the transition `(installed)` token but does not trigger the reload-hint per SNM-15 / G-21-01. |
| `(updated)`                                 | ●    | Plugin row -- update cascade; carries `v<from> → v<to>` version arrow.                                                                                                      |
| `(reinstalled)`                             | ●    | Plugin row -- reinstall cascade.                                                                                                                                            |
| `(uninstalled)`                             | ○    | Plugin row -- uninstall single-plugin, marketplace-remove partial success rows.                                                                                             |
| `(available)`                               | ○    | Plugin row -- `marketplace list` / plugin-list surface (no scope bracket per MSG-PL-6 / SNM-11).                                                                            |
| `(unavailable)`                             | ⊘    | Plugin row -- install / reinstall / import / list surfaces when a manifest declares unsupported Claude features; carries `{hooks}` / `{lsp}` etc.                           |
| `(upgradable)`                              | ●    | Plugin row -- plugin-list surface only (advisory).                                                                                                                          |
| `(failed)`                                  | ⊘    | Plugin row -- any failure variant; carries `reasons`, optional `cause:` trailer, optional `rollbackPartial` children.                                                       |
| `(skipped)`                                 | ⊘    | Plugin row -- per-plugin skip inside cascades; carries `reasons` (e.g. `{up-to-date}`, `{already installed}`).                                                              |
| `(manual recovery)`                         | ⊘    | Plugin row -- per-plugin manual-recovery anchor inside a marketplace block; status discriminator includes the space literally.                                              |
| `(will install)`                            | ●    | Plugin row -- `/claude:plugin preview` pending-tense install (DIFF-02).                                                                                                     |
| `(will uninstall)`                          | ○    | Plugin row -- `/claude:plugin preview` pending-tense uninstall; the pre-transition analog of the realized `(uninstalled)` row.                                              |
| `(will enable)`                             | ●    | Plugin row -- `/claude:plugin preview` pending-tense enable (structurally empty in Phase 53 per Pitfall 53-4; Phase 54 wires the bucket).                                   |
| `(will disable)`                            | ⊘    | Plugin row -- `/claude:plugin preview` pending-tense disable.                                                                                                               |

Marketplace status tokens (drawn from the 9-member `MARKETPLACE_STATUSES` tuple; the `autoupdate enabled` / `autoupdate disabled` statuses render the marker-as-outcome forms `<autoupdate>` / `<no autoupdate>` per UXG-04 rather than parenthesised tokens):

| Token           | Icon | Where it appears                                                                                                                               |
| --------------- | ---- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `(added)`       | ●    | Marketplace header -- `marketplace add`, `bootstrap`, import cascade.                                                                          |
| `(removed)`     | ●    | Marketplace header -- `marketplace remove` clean.                                                                                              |
| `(updated)`     | ●    | Marketplace header -- `marketplace update`.                                                                                                    |
| `(failed)`      | ⊘    | Marketplace header -- `marketplace add` failure, `marketplace remove` partial, `marketplace update` failure, `marketplace autoupdate` failure. |
| `(skipped)`     | ●    | Marketplace header -- mp-level skip (e.g. `{up-to-date}`); the autoupdate-idempotent reasons render the marker-as-outcome form instead.        |
| `(will add)`    | ●    | Marketplace header -- `/claude:plugin preview` pending-tense marketplace add (DIFF-02).                                                        |
| `(will remove)` | ○    | Marketplace header -- `/claude:plugin preview` pending-tense marketplace remove; the only `○` marketplace header.                              |

______________________________________________________________________

## `/claude:plugin list`

Plugin-list surface. Marketplaces render as list-surface headers (`mp.status === undefined`); `mp.details.autoupdate` drives the `<autoupdate>` marker; plugin rows indent two spaces beneath.

### Empty -- no marketplaces configured

<!-- catalog-state: empty -->

```text
(no marketplaces)
```

The renderer emits the literal `(no marketplaces)` body for an empty top-level `marketplaces: []` (per D-16-17). No reload-hint, no severity arg (info).

### Single marketplace, mixed plugin statuses (user scope)

<!-- catalog-state: single-mp-mixed -->

```text
● official [user] <autoupdate>
  ● alpha v1.0.0 (installed)
  ● beta v1.0.0 (upgradable) {stale clone}
  ⊘ delta (unavailable) {hooks}
  ⊘ epsilon (unavailable) {hooks, lsp}
  ○ gamma v2.0.0 (available)
```

Notes:

- Marketplace header is SUB-BRANCH B (list-surface with `details.autoupdate: true`); `<autoupdate>` follows the scope bracket.
- Plugin rows carry no scope bracket -- the variants either have no `scope` field (`available` / `unavailable`) or `p.scope === mp.scope`.
- Caller-supplied order is preserved (D-16-06); the catalog uses an alphabetic ordering for readability but `notify()` does not sort internally.

### Same plugin installed in BOTH scopes -- per-scope marketplace headers, per-scope plugin rows

<!-- catalog-state: same-plugin-both-scopes -->

```text
● official [project] <autoupdate>
  ● alpha v0.9.0 (installed)

● official [user] <autoupdate>
  ● alpha v1.0.0 (installed)
```

Two marketplace blocks; one per scope. Joined by one blank line (D-16-07). Plugin rows omit the scope bracket because `p.scope === mp.scope`.

### Project-scope plugins folded under user-scope marketplace (orphan-fold)

<!-- catalog-state: project-orphan-folded -->

```text
● official [user] <autoupdate>
  ● alpha [project] v0.9.0 (installed)
  ● alpha v1.0.0 (installed)
```

`official [project]` does not exist; the project-scoped `alpha` is folded under the user-scope marketplace header. Its row carries the explicit `[project]` bracket because `plugin.scope !== marketplace.scope` (Phase 16 D-16-17). The user-scoped `alpha` row omits the bracket because `plugin.scope === marketplace.scope` -- the orphan-fold rule applies symmetrically.

### Soft-dep markers on installed rows when companion extensions are unloaded

<!-- catalog-state: soft-dep-on-installed -->

```text
● official [user] <autoupdate>
  ● dual v0.5.0 (installed) {requires pi-subagents, requires pi-mcp}
  ● helper v1.0.0 (installed) {requires pi-subagents}
  ● mcp-tool v2.0.0 (installed) {requires pi-mcp}
```

Each `(installed)` row's `dependencies` field drives the soft-dep probe; the probe runs once per `notify()` invocation (D-16-14). Markers appear inside the same brace block as any typed reasons (D-16-15).

### Marketplace whose manifest is UNPARSEABLE

<!-- catalog-state: unparseable-mp -->

```text
1 marketplace operation failed.

● other-mp [user] <autoupdate>
  ● helper v1.0.0 (installed)

⊘ unparseable-mp [user] (failed)
```

When a marketplace's manifest fails to parse, the marketplace renders as a bare `(failed)` header at column 0; the other parseable marketplaces in the list render normally. `notify()` does not emit a marketplace-level `cause:` trailer for failed marketplaces with empty `plugins: []` -- the v2 type model places `cause?: Error` on plugin variants only. Orchestrators wanting to surface the parse error must construct the payload as a per-plugin failed/manual-recovery row carrying the diagnostic as `cause?: Error`, or include a per-plugin error row inside the failed marketplace block. Severity: `error` (any failed → error). No reload-hint trailer fires on the list surface: the failed marketplace header is not in the marketplace-status trigger set (per D-16-12 + the SNM-15 ladder), and the other marketplace's `present` plugin row is the list-only inventory token deliberately excluded from the trigger set (UAT gap G-21-01).

### Marketplace whose manifest declares ZERO plugins

<!-- catalog-state: zero-plugin-mp-block -->

```text
● empty-mp [project]

● official [user] <autoupdate>
  ● alpha v1.0.0 (installed)
```

An empty `plugins: []` renders as the bare marketplace header alone (D-15-08); the renderer does NOT emit a `(no plugins)` body line under it. The two marketplace blocks are joined by one blank line (D-16-07).

### Multiple marketplaces

<!-- catalog-state: multiple-mps -->

```text
● official [project] <autoupdate>
  ● alpha v0.9.0 (installed)

● official [user] <autoupdate>
  ● alpha v1.0.0 (installed)
  ○ beta v2.0.0 (available)

● zeta-mp [user]
  ● tool v1.0.0 (installed) {requires pi-subagents}
```

Three marketplace blocks; each joined by one blank line (D-16-07). `zeta-mp` is path-source (no `<autoupdate>` marker). `beta` omits the scope bracket per MSG-PL-6 (the `available` variant has no `scope` field). `tool` declares an agents dependency; the probe reports `pi-subagents` unloaded so the row fires `{requires pi-subagents}`.

### Hash-version inventory row (PI-7 short-SHA display)

<!-- catalog-state: hash-version-list -->

```text
● official [user]
  ● hashed-plugin v#2ea95f8 (installed)
```

The plugin's persisted version is the PI-7 content hash `hash-2ea95f85703d`; the list row renders it as the git-style short SHA `v#2ea95f8` (first 7 of the 12 hex chars). Persistence is unchanged -- `state.json` retains the full `hash-2ea95f85703d` (PI-7 intact, no migration); the short form is renderer-only (SNM-35, D-23-04). The `present` inventory discriminator carries no `/reload` trailer.

### Description lines (PL-4)

<!-- catalog-state: description-lines -->

```text
● official [user] <autoupdate>
  ● alpha v1.0.0 (installed)
    A short description of the alpha plugin.
  ● beta v1.0.0 (upgradable) {stale clone}
    A longer description that is exactly sixty-three characters lon...
  ○ gamma v2.0.0 (available)
    Installable plugin with a description.
  ⊘ delta (unavailable) {hooks}
    Unavailable plugin that still surfaces its description.
```

### Disabled inventory row (D-54-01 / ENBL-04)

<!-- catalog-state: disabled-inventory -->

```text
● official [user] <autoupdate>
  ⊘ foo-plugin v1.2.3 (disabled)
```

Triggered when the state record carries the empty-resources + `installable: true` marker (the load-bearing predicate is `orchestrators/reconcile/plan.ts::isRecordedButDisabled`). The `(disabled)` token is the new closed-set `PluginStatus` token (D-54-01); the row uses the `⊘` glyph (shared with `will disable` per RESEARCH Pattern 5). Structurally distinct from `(unavailable)`: the variant carries no `reasons` (a disabled plugin is in the user-requested state, not a failure state), and the byte form differs (`(disabled)` vs `(unavailable)`). The recorded version pin (ENBL-02) is preserved and rendered in the `v<version>` slot. Severity `info`; no reload-hint (inventory row, not a state-changer). The `/claude:plugin disable` command's fresh cascade reuses this exact row byte form WITH the reload-hint trailer via the `disable-cascade` kind (UAT-03; see [`## /claude:plugin disable`](#claudeplugin-disable-pluginmarketplace)).

PL-4: when the manifest entry carries a non-empty `description` field, the renderer emits it on a second line indented four spaces beneath the plugin row. Descriptions longer than 66 characters are truncated to 63 characters and suffixed with `"..."` (landing exactly at column 66). The four list-surface variants (`present`, `upgradable`, `available`, `unavailable`) all support the description field; cascade-only variants (`installed`, `updated`, `reinstalled`, `uninstalled`) do not. The renderer emits the description line only when the field is defined and non-empty.

______________________________________________________________________

## `/claude:plugin install <plugin>@<marketplace>`

Single-plugin command. v2 grammar uses the always-marketplace-header form: a bare marketplace header (`mp.status === undefined`, no details) carries the marketplace identity and the plugin row indents two spaces beneath.

### Success

<!-- catalog-state: success -->

```text
● official [user]
  ● helper v1.0.0 (installed)

/reload to pick up changes
```

Marketplace header is SUB-BRANCH A (bare label header, no details). Plugin row omits the scope bracket because `plugin.scope === marketplace.scope`. Plugin status `installed` triggers the reload-hint per D-16-12.

### Success with soft-dep markers

<!-- catalog-state: success-with-soft-dep -->

```text
● official [user]
  ● helper v1.0.0 (installed) {requires pi-subagents, requires pi-mcp}

/reload to pick up changes
```

`helper` declares both `agents` and `mcp` dependencies; the probe reports both companion extensions unloaded so both markers fire inside one brace block (D-16-15).

### Failure -- unsupported features in manifest

<!-- catalog-state: failure-unsupported-features -->

```text
● official [user]
  ⊘ helper (unavailable) {hooks, lsp}
```

The manifest declares Claude features Pi doesn't support; the `unavailable` variant has no `scope` field (SNM-11) so the plugin row carries no bracket; reasons name the offending fields verbatim. No `cause:` trailer -- the reason carries the explanation. No reload-hint (no state-changing status); severity is info.

### Failure -- runtime error with cause chain

<!-- catalog-state: failure-runtime-with-cause -->

```text
1 plugin operation failed.

● official [user]
  ⊘ helper v1.0.0 (failed) {permission denied}
    cause: state.json at /path/to/state.json is not valid JSON: Unexpected token n in JSON at position 0
```

`failed` plugin variant carrying `cause?: Error`. The cause-chain trailer renders at 4-space indent below the plugin row (D-16-08). Multi-link causes use `->` between links (depth-bounded to 5 per MSG-CC-1). Severity: `error`. No reload-hint (no state-changing status; failed alone does not trigger).

### Failure with rollback-partial children

<!-- catalog-state: failure-rollback-partial -->

```text
1 plugin operation failed.

● official [user]
  ⊘ helper v1.0.0 (failed) {rollback partial}
    cause: orchestrator failed mid-staging
    [phase3a] (rollback failed)
      cause: failed to remove staged agent: EACCES
    [phase3b] (rollback failed)
      cause: orphan path: /.../helper.bak
```

`failed` variant carrying both `cause?` and `rollbackPartial`. The per-plugin `cause:` trailer renders at 4-space indent first; the rollback-partial child rows render at 4-space indent next (one `[<phase>] (rollback failed)` row per phase), each carrying an optional 6-space-indent cause-chain trailer when `phase.cause` is set (D-16-08). Severity: `error`. No reload-hint.

### Failure -- marketplace not added (ATTR-01 / ATTR-08)

Triggered when `install <plugin>@<marketplace>` names a marketplace that is NOT added in the target scope and the CMP-3 project-to-user fallback ALSO misses. The failure subject is the MARKETPLACE, not the plugin: the orchestrator emits the standalone Phase 46 `MarketplaceNotAddedMessage` variant (`kind: "marketplace-not-added"`, `name` set to the marketplace name) -- NOT `{not in manifest}` on a plugin row. This is the ATTR-08 split: "marketplace absent" reads `{not added}` on the marketplace subject, while "plugin absent from a PRESENT manifest" stays `{not in manifest}` on the plugin row (the `failure-runtime-with-cause` / PI-3 path). install always has a resolved scope (the edge defaults it), so the row always carries the `[scope]` bracket communicating "not added in the scope you asked for" (SCOPE-01). Two-block form: the `1 marketplace operation failed.` summary on the host `Error:` label line, then the bare column-0 detail row as its own block (GRAM-01 / GRAM-02). No cause-chain trailer. Severity `error`; no reload-hint.

<!-- catalog-state: missing-marketplace-not-added -->

```text
1 marketplace operation failed.

⊘ ghost-mp [project] (failed) {not added}
```

______________________________________________________________________

## `/claude:plugin uninstall <plugin>@<marketplace>`

Single-plugin command in v2 still renders the always-marketplace-header form; the marketplace appears as a bare header and the plugin row indents underneath.

### Success

<!-- catalog-state: success -->

```text
● official [user]
  ○ helper v1.0.0 (uninstalled)

/reload to pick up changes
```

`(uninstalled)` uses the `○` glyph per the effective-state rule (plugin no longer installed, no error). Plugin status `uninstalled` triggers the reload-hint per D-16-12.

### Success when the plugin declared soft-dep resources

<!-- catalog-state: success-soft-dep-omitted -->

```text
● official [user]
  ○ helper v1.0.0 (uninstalled)

/reload to pick up changes
```

The `uninstalled` variant has no `dependencies` field by construction (D-15-02 / MSG-SD-3); soft-dep markers cannot appear on uninstall rows. The byte form is identical to the plain success case above -- there is no way to expose a soft-dep here structurally.

### Failure -- permission denied

<!-- catalog-state: failure-permission-denied -->

```text
1 plugin operation failed.

● official [user]
  ⊘ helper v1.0.0 (failed) {permission denied}
    cause: EACCES: permission denied, unlink '/path/to/file'
```

Marketplace header is bare (SUB-BRANCH A); plugin row is `failed` with the typed `permission denied` reason and a 4-space-indent `cause:` trailer (D-16-08). Severity: `error`. No reload-hint -- no state-changing status (a failed uninstall did not remove anything, so there is nothing to reload).

### Failure -- marketplace not added (ATTR-04 / SCOPE-01)

Triggered when `uninstall <plugin>@<marketplace>` names a marketplace that was NEVER added in the requested scope, OR is present only in the OTHER scope. ATTR-04 makes this LOUD: the orchestrator emits the standalone `MarketplaceNotAddedMessage` variant (`{not added}` on the marketplace subject) instead of the former silent no-output. This is DISTINCT from the silent PU-5 converge for an already-gone plugin record (a marketplace that IS present but no longer holds the plugin row stays silent -- nothing to report). The `[scope]` bracket carries the REQUESTED scope: for an explicit `--scope` (or an other-scope-only target) the bracket communicates "not added in the scope you asked for" (SCOPE-01); the operator infers the other scope. A bare lifecycle form that misses in BOTH scopes carries no bracket. Two-block form: the `1 marketplace operation failed.` summary on the host `Error:` label line, then the bare column-0 detail row as its own block (GRAM-01 / GRAM-02). Severity `error`; no reload-hint.

<!-- catalog-state: missing-marketplace-not-added -->

```text
1 marketplace operation failed.

⊘ ghost-mp [user] (failed) {not added}
```

______________________________________________________________________

## `/claude:plugin reinstall`

Multi-plugin cascade. One marketplace header per affected marketplace; plugin rows indent two spaces underneath.

### Single marketplace, all reinstalled

<!-- catalog-state: single-mp-all-reinstalled -->

```text
● official [user]
  ● alpha v1.0.0 (reinstalled)
  ● beta v0.5.0 (reinstalled)

/reload to pick up changes
```

Bare marketplace header (no status, no details). Plugin status `reinstalled` triggers reload-hint per D-16-12.

### Success with soft-dep markers

<!-- catalog-state: success-with-soft-dep -->

```text
● official [user]
  ● alpha v1.0.0 (reinstalled) {requires pi-subagents, requires pi-mcp}

/reload to pick up changes
```

The `reinstalled` variant carries `dependencies` (D-15-02); both markers fire because both companions are unloaded.

### Single marketplace, mixed outcomes (reinstalled + skipped + failed)

<!-- catalog-state: single-mp-mixed-outcomes -->

```text
1 plugin operation failed.

● official [user]
  ● alpha v1.0.0 (reinstalled)
  ⊘ beta (skipped) {up-to-date}
  ⊘ delta (failed) {source missing}

/reload to pick up changes
```

Mixed-outcome cascade. Reload-hint fires because at least one plugin status is in the state-changing set (`reinstalled`). Severity: `error` (first-match wins; failed beats skipped/manual-recovery per D-16-11). `(skipped)` uses the `⊘` glyph per the renderer's switch (the renderer emits `⊘` for skipped/failed/unavailable/manual-recovery uniformly).

### Single marketplace, all failed (no reload-hint)

<!-- catalog-state: single-mp-all-failed -->

```text
2 plugin operations failed.

● official [user]
  ⊘ alpha (failed) {source missing}
  ⊘ beta (failed) {invalid manifest}
```

Failed-only cascade. No reload-hint per D-16-12 (no plugin in the state-changing set; no state-changing marketplace status). Severity: `error`.

### Plugin became unavailable after install (manifest now declares unsupported features)

<!-- catalog-state: plugin-became-unavailable -->

```text
● official [user]
  ● alpha v1.0.0 (reinstalled)
  ⊘ delta (unavailable) {hooks}

/reload to pick up changes
```

Mixed-outcome cascade. `delta`'s `unavailable` variant has no scope field; row carries no bracket. Reload-hint fires because `alpha` was reinstalled. Severity: info -- the `unavailable` status is not in the failed/skipped/manual-recovery set, so the severity ladder falls through to info.

### Across multiple marketplaces (bare `reinstall` form)

<!-- catalog-state: bare-multi-mp -->

```text
1 plugin operation failed.

● local-mp [project]
  ● helper v0.5.0 (reinstalled)
  ● tool v1.0.0 (reinstalled)

● official [user]
  ● alpha v1.0.0 (reinstalled)
  ⊘ beta (skipped) {up-to-date}
  ⊘ delta (failed) {source missing}

/reload to pick up changes
```

Two marketplace blocks joined by one blank line (D-16-07). Severity: `error` (the failed `delta` row in the second block triggers the first-match ladder).

### Same marketplace name in both scopes (orphan-fold absent; per-scope blocks)

<!-- catalog-state: same-mp-both-scopes -->

```text
● official [project]
  ● alpha v1.0.0 (reinstalled)

● official [user]
  ● beta v1.0.0 (reinstalled)

/reload to pick up changes
```

The marketplaces never collapse -- each per-scope header is a distinct marketplace block.

### Failure -- marketplace not added, explicit scope (ATTR-03 / SCOPE-01)

Triggered when `reinstall <plugin>@<marketplace>` or `reinstall @<marketplace>` names a marketplace that is NOT added in the requested `--scope` (or is present only in the OTHER scope). ATTR-03 makes the attribution form-INDEPENDENT: the explicit-scope-plugin, explicit-scope-marketplace, and bare forms ALL emit the standalone `MarketplaceNotAddedMessage` variant (`{not added}` on the marketplace subject) BEFORE any cascade row exists -- replacing the former per-form divergence (`(skipped) {not installed}` for the explicit-scope plugin form via a synthesized phantom target; `(failed) {not found}` for the explicit-scope-marketplace and bare forms via a raw throw -> synthetic `(reinstall)` row). The `[scope]` bracket carries the REQUESTED scope: the operator infers the other scope (SCOPE-01; resolved Open Question #1 -- the requested-scope bracket, no other-scope phrase). The legitimate "marketplace present, plugin not installed" case keeps its `(skipped) {not installed}` outcome -- only the marketplace-absent precondition is re-attributed. Two-block form: the `1 marketplace operation failed.` summary on the host `Error:` label line, then the bare column-0 detail row as its own block (GRAM-01 / GRAM-02). No cause-chain trailer. Severity `error`; no reload-hint.

<!-- catalog-state: missing-marketplace-not-added -->

```text
1 marketplace operation failed.

⊘ ghost-mp [project] (failed) {not added}
```

### Failure -- marketplace not added, bare form absent from both scopes (ATTR-03)

Triggered when the bare `reinstall @<marketplace>` form (no `--scope`) names a marketplace that is absent in BOTH scopes. The same standalone `{not added}` variant fires, but with NO `[scope]` bracket (the absent-from-both form: there is no requested scope to report). Byte-identical to `info`'s `missing-marketplace-not-added-absent-from-both` state. Severity `error`; no reload-hint.

<!-- catalog-state: missing-marketplace-not-added-absent-from-both -->

```text
1 marketplace operation failed.

⊘ ghost-mp (failed) {not added}
```

______________________________________________________________________

## `/claude:plugin update`

Multi-plugin cascade. Same shape as `reinstall` with version-arrow rows (`v<from> → v<to>`) per D-15-04 / Phase 16 `composeVersionArrow`.

### Single marketplace, mixed

<!-- catalog-state: single-mp-mixed -->

```text
1 plugin operation failed.

● official [user]
  ● alpha v0.5.0 → v1.0.0 (updated)
  ⊘ beta (skipped) {up-to-date}
  ⊘ delta (failed) {network unreachable}

/reload to pick up changes
```

The `updated` variant emits `v<from> → v<to>` (both sides carry the `v` prefix per `composeVersionArrow`). When a side is a PI-7 hash-version it is shortened to git-style `v#<7hex>`, e.g. `v#2ea95f8 → v#1c3d9a0` (SNM-35, D-23-05). The `failed` plugin row carries `version?` only (the v2 `PluginFailedMessage` has no `from`/`to` fields per D-15-04 -- `composeVersionArrow` is the `updated` variant's helper alone); `delta` here omits `version` because the orchestrator has no post-failure target version to surface. Severity: `error`. Reload-hint fires because `alpha` was updated.

### Failed with rollback-partial cause chain

<!-- catalog-state: failed-with-rollback-partial -->

```text
1 plugin operation failed.

● official [user]
  ⊘ delta v1.0.0 (failed) {rollback partial}
    cause: orchestrator failed mid-staging
    [phase3a] (rollback failed)
      cause: failed to remove staged agent: EACCES
    [phase3b] (rollback failed)
      cause: orphan path: /.../delta.bak
```

`failed` variant carrying both `cause?` and `rollbackPartial`. Per-plugin cause-chain at 4-space indent first; rollback-partial child rows + 6-space-indent per-phase cause chains next (D-16-08). Severity: `error`. No reload-hint.

### All up-to-date (no-op cascade)

<!-- catalog-state: all-up-to-date-noop -->

```text
● official [user]
  ⊘ alpha (skipped) {up-to-date}
  ⊘ beta (skipped) {up-to-date}
```

Skipped-only cascade. No reload-hint (no state-changing status). Severity: every reason is the benign `up-to-date` (in the benign closed set), so this all-benign skip cascade computes `info` per UXG-02 / D-28-06 -- the second arg is omitted. (A cascade with any actionable skip such as `{not installed}` would instead route to `warning`.)

### Across multiple marketplaces (bare `update` form)

<!-- catalog-state: bare-multi-mp -->

```text
1 plugin operation failed.

● local-mp [project]
  ● helper v0.5.0 → v1.0.0 (updated)

● official [user]
  ● alpha v0.5.0 → v1.0.0 (updated)
  ⊘ beta (skipped) {up-to-date}
  ⊘ delta (failed) {network unreachable}

/reload to pick up changes
```

Two marketplace blocks. Severity: `error`. Reload-hint fires (two `updated` plugin rows). The `failed` `delta` row omits the version-arrow slot per the v2 type model (`PluginFailedMessage` does not carry `from`/`to` -- only the `updated` variant does).

### Same marketplace name in both scopes

<!-- catalog-state: same-mp-both-scopes -->

```text
● official [project]
  ● alpha v0.9.0 → v1.0.0 (updated)

● official [user]
  ● beta v0.5.0 → v1.0.0 (updated)

/reload to pick up changes
```

Per-scope blocks; identical lock to `reinstall` -- marketplaces never collapse across scopes.

### Hash-version update arrow (PI-7 short-SHA display, both sides)

<!-- catalog-state: hash-version-arrow -->

```text
● official [user]
  ● hashed-plugin v#2ea95f8 → v#1c3d9a0 (updated)

/reload to pick up changes
```

Both `from` and `to` are PI-7 hash-versions (`hash-2ea95f85703d` -> `hash-1c3d9a0bbef1`); each is shortened to its git-style 7-hex form with a `v#` prefix (`v#2ea95f8`, `v#1c3d9a0`) per `composeVersionArrow` (SNM-35, D-23-05). Persistence keeps the full `hash-<12hex>` on both sides. Severity: info. Reload-hint fires because `hashed-plugin` was updated.

### Failure -- marketplace not added, explicit scope (ATTR-02 / SCOPE-01)

Triggered when `update <plugin>@<marketplace>` or `update @<marketplace>` names a marketplace that is NOT added in the requested `--scope` (or is present only in the OTHER scope). ATTR-02 makes the attribution form-INDEPENDENT: BOTH the `<plugin>@<mp>` and `@<mp>` forms flow through `enumerateMarketplaceTarget` and emit the standalone `MarketplaceNotAddedMessage` variant (`{not added}` on the marketplace subject) BEFORE any cascade row exists -- replacing the former raw `Error` (M10) / `MarketplaceNotFoundError` (M11) that escaped to a synthetic `(failed) {not found}` row. No raw throw escapes the orchestrator for the marketplace-existence case. The `[scope]` bracket carries the REQUESTED scope: the operator infers the other scope (SCOPE-01; resolved Open Question #1 -- the requested-scope bracket, no other-scope phrase). The cascade path (`updateSinglePlugin` / `preflightUpdate`) keeps its non-throwing concurrent-removal outcome and is unaffected (Pitfall 3 / A3). Two-block form: the `1 marketplace operation failed.` summary on the host `Error:` label line, then the bare column-0 detail row as its own block (GRAM-01 / GRAM-02). No cause-chain trailer. Severity `error`; no reload-hint.

<!-- catalog-state: missing-marketplace-not-added -->

```text
1 marketplace operation failed.

⊘ ghost-mp [user] (failed) {not added}
```

### Failure -- marketplace not added, bare form absent from both scopes (ATTR-02)

Triggered when the bare `update @<marketplace>` form (no `--scope`) names a marketplace that is absent in BOTH scopes. The same standalone `{not added}` variant fires, but with NO `[scope]` bracket (the absent-from-both form: there is no requested scope to report). Byte-identical to `info`'s `missing-marketplace-not-added-absent-from-both` state. Severity `error`; no reload-hint.

<!-- catalog-state: missing-marketplace-not-added-absent-from-both -->

```text
1 marketplace operation failed.

⊘ ghost-mp (failed) {not added}
```

______________________________________________________________________

## `/claude:plugin import`

Multi-marketplace + multi-plugin cascade. Each marketplace header carries its own state-change status (`added` / `skipped` is not a marketplace status in v2 -- use `updated` for "already added" or omit the marketplace from the payload; `failed` for an unreachable source). Plugin rows indent two spaces underneath.

### Fresh import (mixed outcomes across both scopes)

<!-- catalog-state: fresh-mixed-both-scopes -->

```text
● claude-plugins-official [project] (added)
  ● official-plugin (installed)

● claude-plugins-official [user] (added)
  ● official-plugin (installed)

● directory-marketplace [project] (added)
  ● local-plugin (installed)

● directory-marketplace [user] (added)
  ● local-plugin (installed)
  ⊘ unavailable-plugin (unavailable) {hooks}

● github-marketplace [project] (added)
  ● github-plugin (installed)

● github-marketplace [user] (added)
  ● github-plugin (installed)

/reload to pick up changes
```

Six marketplace blocks joined by blank lines (D-16-07). The `directory-marketplace [user]` block surfaces an `unavailable` plugin (`unavailable_plugin`) which has no `scope` field per SNM-11. Reload-hint fires (multiple `added` marketplace statuses + multiple `installed` plugin rows). Severity: info -- no `failed`, no `skipped/manual-recovery` in the payload; `unavailable` is not in the warning set.

### `import --scope project` (narrows writes to project scope only)

<!-- catalog-state: scope-project-narrow -->

```text
● claude-plugins-official [project] (added)
  ● official-plugin (installed)

● directory-marketplace [project] (added)
  ● local-plugin (installed)

● github-marketplace [project] (added)
  ● github-plugin (installed)

/reload to pick up changes
```

Three project-scope marketplace blocks. Reload-hint fires. Severity: info.

### Per-row soft-dep markers on import cascade rows

<!-- catalog-state: soft-dep-markers -->

```text
● claude-plugins-official [project] (added)
  ● agent-only-plugin (installed) {requires pi-subagents}
  ● dual-plugin (installed) {requires pi-subagents, requires pi-mcp}

/reload to pick up changes
```

Each `installed` row's `dependencies` field drives the marker. The combined-row brace block joins markers with a comma-space separator (the renderer's `composeReasons` helper). Reload-hint fires. Severity: info.

### Same marketplace name in both scopes

<!-- catalog-state: same-mp-both-scopes -->

```text
● official [project] (added)
  ● alpha (installed)

● official [user] (added)
  ● beta (installed)

/reload to pick up changes
```

Per-scope marketplace blocks. Reload-hint fires. Severity: info.

______________________________________________________________________

## `/claude:plugin bootstrap`

Single-shot setup of `anthropics/claude-plugins-official` in user scope. The marketplace header alone is the body -- no plugin children.

### Fresh bootstrap

<!-- catalog-state: fresh -->

```text
● claude-plugins-official [user] (added)
```

The bootstrap path is a marketplace add; the marketplace status `added` carries the `(added)` header arm. No reload-hint: a marketplace record is not a Pi-visible resource (SNM-33 / D-22-01). Bootstrap also enables autoupdate on the marketplace persistence record, but the v2 state-change header arm (`added`) does not carry the `<autoupdate>` marker -- the marker only appears on the list-surface header form (`mp.status === undefined`, `mp.details.autoupdate === true`). Subsequent `marketplace list` renders the marketplace with the marker.

### Re-run when already bootstrapped

<!-- catalog-state: already-bootstrapped -->

```text
● claude-plugins-official [user] (updated)
```

When the marketplace already exists, the bootstrap orchestrator renders the marketplace with status `updated` (the marketplace persistence record is touched but no plugins changed). No reload-hint: with no plugin children there is no Pi-visible resource change, so the touch alone does not warrant a `/reload` (SNM-33 / D-22-01). Severity: info. (Alternative implementations may render an empty `(updated)` payload as a no-op; the catalog asserts the structural shape, not the orchestrator's choice between `updated` and emitting nothing.)

______________________________________________________________________

## `/claude:plugin marketplace list`

Marketplace-list surface. Each marketplace renders as a list-surface header carrying its `MarketplaceDetails` (`<autoupdate>` token); no plugin children are emitted in this surface.

### Empty

<!-- catalog-state: empty -->

```text
(no marketplaces)
```

Empty top-level `marketplaces: []` renders the sentinel literal per D-16-17. No reload-hint, no severity arg.

### Mixed scopes -- per-scope rendering

<!-- catalog-state: mixed-scopes -->

```text
● alpha [project] <autoupdate>

● alpha [user]

● beta [user]

● zeta [project] <autoupdate>
```

Four marketplace blocks joined by one blank line each (D-16-07). Each list-surface header is SUB-BRANCH B (mp.status undefined; details set). `<autoupdate>` appears only when `details.autoupdate === true`. The `details.lastUpdatedAt` field is retained in state but is not rendered (UXG-01). Caller-supplied order is preserved (D-16-06); the catalog uses an alphabetic ordering for readability. No reload-hint, no severity arg.

______________________________________________________________________

## `/claude:plugin marketplace add <source>`

Single-marketplace command. The marketplace header alone is the body -- no plugin children.

D-48-A / ATTR-07: the `failed` marketplace header MAY now carry a closed-set reason brace (`(failed) {<reason>}`) when a precondition fails and there is no plugin child row to carry the cause. The five `marketplace add` preconditions -- duplicate name, stale clone, unsupported source, missing path source, invalid manifest -- each render their matching closed-set `REASONS` member on the marketplace subject instead of throwing raw past the orchestrator. The `failure-unreachable` state below carries NO reason brace (`reasons` omitted -> `composeReasons` returns `""` -> the brace collapses to a bare `(failed)`), so its byte form is unchanged. Post-manifest failures (duplicate name, stale clone) render the derived marketplace name as the subject; pre-clone/pre-manifest failures (unsupported source, source missing, invalid manifest) render the user-typed source string as the subject (A2).

### Success -- path source

<!-- catalog-state: path-source -->

```text
● local-mp [user] (added)
```

Path-source marketplaces default to autoupdate OFF; the `added` arm does not carry the marker. No reload-hint: `marketplace add` changes a marketplace record, not a Pi-visible resource (SNM-33 / D-22-01).

### Success -- GitHub source

<!-- catalog-state: github-source -->

```text
● claude-plugins-official [user] (added)
```

`marketplace add` never enables autoupdate for any source kind (github or path); the persisted record stores no `autoupdate` field on add. Autoupdate is opt-in -- enabled later via an explicit `marketplace autoupdate`, or by `bootstrap`. The `added` state-change arm carries `(added)`; subsequent `marketplace list` surfaces show the `<autoupdate>` / `<no autoupdate>` marker on the SUB-BRANCH B list-surface header only once the flag has been set. No reload-hint: a marketplace record is not a Pi-visible resource (SNM-33 / D-22-01).

### Failure -- unreachable source

<!-- catalog-state: failure-unreachable -->

```text
1 marketplace operation failed.

⊘ unreachable-mp [user] (failed)
```

Bare `failed` marketplace header at column 0; no plugin children. Severity: `error`. No reload-hint per D-16-12 (failed marketplace status does not trigger).

> Note: the v2 `notify()` renderer's `composeMarketplaceBlock` does not emit a marketplace-level cause-chain trailer below the failed header. The v2 type model places `cause?: Error` on plugin variants only; orchestrators wanting to surface the diagnostic must construct the payload as a per-plugin failed/manual-recovery row with `cause?: Error`. This catalog state is the bare failed-marketplace header byte form. D-48-A: this bare-`(failed)` form (reasons omitted) is byte-unchanged by the ATTR-07 reason-brace addition.

### Failure -- duplicate name (ATTR-07)

Triggered when `marketplace add <source>` resolves a manifest whose derived `name` already exists in the target scope (`MarketplaceDuplicateNameError`). Post-manifest failure: the subject is the derived marketplace name. Severity `error`; no reload-hint.

<!-- catalog-state: add-duplicate-name -->

```text
1 marketplace operation failed.

⊘ claude-plugins-official [user] (failed) {duplicate name}
```

### Failure -- stale clone (ATTR-07)

Triggered when a github `marketplace add` finds a pre-existing non-empty `sources/<derivedName>/` clone directory on the final destination (`StaleSourceCloneError`). Post-manifest failure: the subject is the derived marketplace name. The github guard's `cleanupStaging` runs before this row is emitted (no staging-dir leak). Severity `error`; no reload-hint.

<!-- catalog-state: add-stale-clone -->

```text
1 marketplace operation failed.

⊘ claude-plugins-official [user] (failed) {stale clone}
```

### Failure -- unsupported source (ATTR-07)

Triggered when the parsed source kind is `unknown` (e.g. an SSH `git@...` URL) or a valid-but-unimplemented kind (`url` / `git-subdir` / `npm`) -- `UnsupportedSourceError`. Pre-clone, pre-name failure: the subject is the user-typed source string. Severity `error`; no reload-hint.

<!-- catalog-state: add-unsupported-source -->

```text
1 marketplace operation failed.

⊘ git@github.com:foo/bar.git [user] (failed) {unsupported source}
```

### Failure -- source missing (ATTR-07)

Triggered when a path `marketplace add` points at a path that does not exist (ENOENT) or exists but is neither a file nor a directory (e.g. a socket; tagged ENOTDIR). Pre-name failure (no readable manifest): the subject is the user-typed source string. NFR-5: a path source never touches the network. Severity `error`; no reload-hint.

<!-- catalog-state: add-source-missing -->

```text
1 marketplace operation failed.

⊘ ./missing-mp [user] (failed) {source missing}
```

### Failure -- invalid manifest (ATTR-07)

Triggered when `marketplace add` reads a `marketplace.json` that is malformed JSON or schema-invalid (`InvalidMarketplaceManifestError`, D-48-B). Pre-name failure (the manifest is unreadable, so no derived name): the subject is the user-typed source string. For a github source, the clone has already happened and `cleanupStaging` runs before this row is emitted. Severity `error`; no reload-hint.

<!-- catalog-state: add-invalid-manifest -->

```text
1 marketplace operation failed.

⊘ anthropics/claude-plugins-official [user] (failed) {invalid manifest}
```

______________________________________________________________________

## `/claude:plugin marketplace info <name>`

Read-only detail surface (Phases 42-43). Renders the marketplace header at column 0 carrying the `<autoupdate>` or `<no autoupdate>` marker, followed by per-attribute lines (`github:` or `path:`; optional `last_updated:` for github sources; optional `description:` when `marketplace.json` carries one). Phase 43 / INFO-01 + INFO-03 + INFO-04 + INFO-07 lock the full state set below.

Severity routing: every success state is `info` (no second arg to `ctx.ui.notify`); the two `{not added}` failure states and the `{invalid manifest}` manifest-failure state route to `error`. No reload-hint fires on any state (info surfaces are read-only per SNM-33).

### Success -- github source with all optional fields

Triggered by `marketplace info <name> [--scope ...]` against a github-sourced marketplace present in the requested scope, with `autoupdate` enabled, a persisted `lastUpdatedAt` ISO timestamp, and a `marketplace.json` that carries a `description` field. Four-line body: the header (with `<autoupdate>` marker), the `github: <owner>/<repo>[#<ref>]` source line (with `#<ref>` suffix only when the ref was originally specified), the `last_updated:` line (github-only per INFO-01), and the single-attribute `description:` line. Severity `info`; no reload-hint.

<!-- catalog-state: github-single-scope-full -->

```text
● claude-plugins-official [user] <autoupdate>
github: anthropics/claude-plugins-official#main
last_updated: 2026-06-03T00:00:00Z
description: Official Claude plugin marketplace.
```

### Success -- github source, minimal (no ref, no lastUpdatedAt, no description)

Triggered by the same command against a github-sourced marketplace whose persisted record carries `autoupdate: false` (or omitted), no ref fragment in the source URL, no `lastUpdatedAt`, and a `marketplace.json` without a `description`. Two-line body: header with `<no autoupdate>` marker (INFO-01 emits BOTH `<autoupdate>` and `<no autoupdate>` markers, unlike the list surface's absence-conveys-off rule), and the `github:` line with NO `#<ref>` suffix. The `last_updated:` line is omitted (no source data); the `description:` line is omitted (no manifest data). Severity `info`.

<!-- catalog-state: github-single-scope-minimal -->

```text
● community-mp [user] <no autoupdate>
github: someuser/community-mp
```

### Success -- path source, minimal

Triggered against a path-sourced marketplace with `autoupdate: false` and no `marketplace.json` description. Two-line body: header with `<no autoupdate>` marker, and the `path: <abs-path>` source line. Path sources NEVER emit a `last_updated:` line (the renderer gates that on `source.sourceKind === "github"` per INFO-01); without a description on the manifest the `description:` line is omitted too. Severity `info`.

<!-- catalog-state: path-single-scope -->

```text
● local-mp [project] <no autoupdate>
path: /home/user/marketplaces/local-mp
```

### Success -- path source with description

Triggered against a path-sourced marketplace whose `marketplace.json` carries a `description` field. The `description:` line is INDEPENDENT of source kind (it appears on both github and path arms when the manifest provides one); the `last_updated:` line still does NOT appear because it is gated on the github-source arm. Three-line body: header with `<autoupdate>` marker, `path:` source line, and the single-attribute `description:` line. Severity `info`.

<!-- catalog-state: path-single-scope-with-description -->

```text
● dev-mp [user] <autoupdate>
path: /home/user/src/dev-mp
description: Local development marketplace; experimental plugins.
```

### Multi-scope fan-out -- both scopes hold the marketplace name

Triggered by `marketplace info <name>` with NO `--scope` filter when the requested marketplace name is present in BOTH the project scope AND the user scope (Phase 43 / INFO-03). The orchestrator emits a `MarketplaceInfoCascadeMessage` whose `blocks` array carries the per-scope `MarketplaceInfoMessage` payloads in project-first order (matches the existing list-surface row-order policy via MSG-GR-3 / Phase 18's `compareByNameThenScope` project-before-user tie-break). The renderer joins per-block bodies with `\n\n` (one blank line). Each block is byte-identical to what the same payload would produce as a standalone `marketplace-info` render -- the wrapper does not add any per-block decoration. Severity `info`.

<!-- catalog-state: both-scopes-fan-out -->

```text
● my-mp [project] <autoupdate>
path: /repo/path/my-mp

● my-mp [user] <no autoupdate>
github: someuser/my-mp
```

### Failure -- schema-invalid `marketplace.json` (`{invalid manifest}`)

Triggered when `marketplace info <name> [--scope ...]` reads a present-but-schema-invalid `marketplace.json` (a typed `InvalidMarketplaceManifestError` with NO `SyntaxError` cause -- the JSON parsed but failed validation). The read surface now classifies this as `{invalid manifest}` for parity with the `marketplace add` write path's `classifyAddError` (D-48-B / IN-02 close), instead of the former generic `{unreadable}` fallback -- the same on-disk condition surfaces the same truthful reason across read and write. The orchestrator emits the `buildManifestFailureMessage` `PluginInfoMessage` with `plugin.status: "failed"` + `reasons: ["invalid manifest"]` + `componentsResolved: false` on the marketplace subject; the renderer composes the marketplace header at column 0 (carrying the `<no autoupdate>` marker for a record with `autoupdate: false`), the failed row at 2-space indent, and the `components: not resolved` marker at 4-space indent (the manifest never parsed, so no component set could be resolved). The failed row carries NO `[scope]` bracket because `plugin.scope` equals the marketplace scope (the renderer's orphan-fold rule suppresses the bracket). A malformed-JSON manifest still reads `{unparseable}` -- that arm is preserved. Two-block form: the `1 plugin operation failed.` summary (the failed row is a PLUGIN subject, GRAM-02) on the host `Error:` label line, then the multi-line detail block (header + failed row + `components: not resolved`) as its own block (GRAM-01). Severity `error`; no reload-hint (info surfaces are read-only per SNM-33).

<!-- catalog-state: manifest-invalid -->

```text
1 plugin operation failed.

● bad-mp [user] <no autoupdate>
  ⊘ bad-mp (failed) {invalid manifest}
    components: not resolved
```

### Failure -- absent from both scopes

Triggered when `marketplace info <name>` (no `--scope` filter) is invoked against a marketplace name that is NOT present in EITHER scope. The orchestrator emits the standalone `MarketplaceNotAddedMessage` variant (`kind: "marketplace-not-added"`) with `scope` OMITTED (because the marketplace is in neither scope -- emitting a `[user]` or `[project]` bracket would be misleading). The renderer's bracket short-circuit suppresses the `[scope]` token, leaving the bare `⊘ <name> (failed) {not added}` row at column 0. Distinct from `scope-mismatch-not-added` below: this state has NO scope bracket because the marketplace is in neither scope; the scope-mismatch state DOES have a bracket because the user asked for a specific scope. Two-block form: the `1 marketplace operation failed.` summary on the host `Error:` label line, then the bare detail row as its own block (GRAM-01 / GRAM-02). Severity `error`; no reload-hint.

<!-- catalog-state: absent-from-both -->

```text
1 marketplace operation failed.

⊘ ghost-mp (failed) {not added}
```

### Failure -- `--scope` mismatch (`{not added}`)

Surfaced when `marketplace info <name> --scope <wrong-scope>` is invoked against a marketplace present only in the OTHER scope (e.g., requesting `--scope user` when `my-mp` lives only in `project`). The standalone `MarketplaceNotAddedMessage` variant (`kind: "marketplace-not-added"`) distinguishes this from a truly-absent marketplace name and uniquely identifies the scope-mismatch surface. The renderer emits a bare row at column 0 (no marketplace header above it -- the marketplace IS the thing that is not added in the requested scope). The `[user]` bracket is present because the user explicitly asked for a specific scope; the `absent-from-both` state above omits the bracket to avoid misleading the user when the marketplace is in NEITHER scope. Two-block form: the `1 marketplace operation failed.` summary on the host `Error:` label line, then the bare detail row as its own block (GRAM-01 / GRAM-02). Severity `error`; no reload-hint (info surfaces are read-only per SNM-33).

<!-- catalog-state: scope-mismatch-not-added -->

```text
1 marketplace operation failed.

⊘ my-mp [user] (failed) {not added}
```

______________________________________________________________________

## `/claude:plugin info <plugin>@<marketplace>`

Read-only detail surface (Phase 44). Renders the install-cascade always-marketplace-header form (mirrors `install`'s shape per INFO-02) with a per-plugin row at 2-space indent, optional description block hard-wrapped at col 4 / 66-col text width, then either per-kind component lists (sorted: `agents`, `commands`, `mcp`, `skills`) with an optional `dependencies:` line LAST, OR the `components: not resolved` marker (INFO-05). Phase 44 / INFO-02 + INFO-05 + INFO-07 lock the full state set below.

Severity routing: every success state (installed / available / unavailable / installed-both-scopes / components-not-resolved) is `info` severity (no second arg to `ctx.ui.notify`); the three `(failed)` states (`{not added}` missing-marketplace, `{not added}` --scope mismatch, `{not in manifest}` missing-plugin) route to `error`. No reload-hint fires on any state (info surfaces are read-only per SNM-33).

### Success -- installed single scope

Triggered by `plugin info <plugin>@<marketplace> --scope user` against an installed plugin in the user scope whose manifest entry declares per-kind components (skills/commands/agents/mcpServers) reachable from a path-source marketplace clone. Body: marketplace header at column 0 with `<autoupdate>` marker; plugin row at 2-space indent (status glyph `●` + name + `v<version>` + `(installed)`); description at 4-space indent (hard-wrapped via `wrapDescription(text, 4, 66)`); per-kind component lines at 4-space indent in the fixed `agents, commands, mcp, skills` order (alphabetical kind order; alphabetical within each kind). Severity `info`; no reload-hint.

<!-- catalog-state: installed-single-scope -->

```text
● claude-plugins-official [user] <autoupdate>
  ● commit-commands v1.2.0 (installed)
    Helpful git commit commands for everyday use.
    agents: review-bot
    commands: c1, c2
    skills: commit-summary
```

### Success -- installed single scope with dependencies

Same as above but with a `dependencies: <plugin>@<marketplace>, ...` line emitted LAST (after every per-kind component line) per INFO-02. PI-13 keeps the field opaque at the manifest layer; when it contains an array of `<plugin>@<marketplace>` strings the orchestrator passes them through (sorted alphabetically). Severity `info`.

<!-- catalog-state: installed-single-scope-with-dependencies -->

```text
● claude-plugins-official [user] <autoupdate>
  ● commit-commands v1.2.0 (installed)
    Helpful git commit commands for everyday use.
    agents: review-bot
    commands: c1, c2
    skills: commit-summary
    dependencies: helper@utils-mp
```

### Success -- available single scope

Triggered by `plugin info <plugin>@<marketplace>` against a plugin declared in `marketplace.json` but NOT installed in the requested scope. The status glyph switches to `○` (per `pluginInfoStatusGlyph` in `shared/notify.ts`) and the row reads `(available)`. Components remain rendered for path-source plugins because the marketplace clone is local and the plugin entry's source can be resolved without a fetch. Severity `info` (only the `failed` plugin-info row routes to error).

<!-- catalog-state: available-single-scope -->

```text
● community-mp [user] <no autoupdate>
  ○ chat-helper v0.5.0 (available)
    Quick chat helper plugin; experimental.
    commands: chat
    skills: chat-init
```

### Disabled inventory row (D-54-01 / ENBL-04)

The `info` surface conveys a recorded-but-disabled plugin via the SAME `(disabled)` token used by the list surface (see [`## /claude:plugin list`](#claudeplugin-list) `disabled-inventory` catalog state). The orchestrator renders through the cascade path (list-arm marketplace header + `PluginDisabledMessage` row) rather than the `PluginInfoMessage` standalone variant -- a disabled plugin has no materialized artefacts (ENBL-02), so the per-kind component/dependencies block would be misleading. Severity `info`; no reload-hint. Byte form: see the list section's `disabled-inventory` state.

### Success -- unavailable single scope

Triggered when `resolveStrict` returns `installable: false` for the plugin entry (typically because the manifest declares an unsupported component such as `hooks` or `lspServers`). The status glyph is `⊘`; the row reads `(unavailable)` followed by a closed-set REASON brace (`{hooks}` / `{lsp}` / `{unsupported source}` per `narrowResolverNotes`). The renderer's `componentsResolved: false` switch arm fires for the unavailable arm, emitting the `components: not resolved` marker line in place of per-kind component lists -- the plugin is not installable so its component layout is moot. Severity `info` (unavailable is not a failure on the info surface; only `failed` routes to error).

<!-- catalog-state: unavailable-single-scope -->

```text
● community-mp [user] <no autoupdate>
  ⊘ legacy-plugin v0.1.0 (unavailable) {hooks}
    Old plugin that declares hooks; not installable in Pi.
    components: not resolved
```

### Multi-scope fan-out -- both scopes hold the plugin

Triggered by `plugin info <plugin>@<marketplace>` with NO `--scope` filter when the marketplace name is present in BOTH the project scope AND the user scope AND each scope's state records the plugin (the install orchestrator clones the marketplace record across scopes when a plugin is installed cross-scope). The orchestrator emits a `PluginInfoCascadeMessage` whose `blocks` array carries the per-scope `PluginInfoMessage` payloads in project-first order (matches the existing list-surface row-order policy via MSG-GR-3 / Phase 18's `compareByNameThenScope` project-before-user tie-break). The renderer joins per-block bodies with `\n\n` (one blank line). Each block carries its own marketplace header at column 0 (mirrors the install-cascade `composeMarketplaceBlock` join). Severity `info`.

<!-- catalog-state: installed-both-scopes-fan-out -->

```text
● mp [project] <autoupdate>
  ● foo v1.0.0 (installed)
    skills: s1

● mp [user] <no autoupdate>
  ● foo v2.0.0 (installed)
    agents: a1
```

### Components not resolved (external source)

Triggered when the plugin entry's `source` field parses as `npm` / `git-subdir` / `url` (any non-`path` kind). Per INFO-05 + NFR-5 the orchestrator deliberately does NOT fetch the external source; the renderer emits the marker line `components: not resolved` at 4-space indent (column 4) in place of per-kind component lists. The plugin row still carries its status (`installed` / `available`) and description; the marker is the structural signal that the component layout lives at an unsynced external location. Severity `info`.

<!-- catalog-state: components-not-resolved -->

```text
● remote-mp [user] <no autoupdate>
  ● remote-plugin v1.0.0 (installed)
    Remote plugin sourced from an external npm package.
    components: not resolved
```

### Failure -- plugin not in manifest

Triggered when the marketplace IS added in the requested scope but its `marketplace.json` does NOT contain a plugin entry with the requested name. The orchestrator emits a `PluginInfoMessage` with `plugin.status: "failed"` + `reasons: ["not in manifest"]`; the renderer composes the marketplace header at column 0 followed by the failed plugin row at 2-space indent. The `{not in manifest}` REASON is the same closed-set member that `update.ts` uses post-Phase 29 / UXG-08 for the same failure semantics; this catalog state extends its surface to the new `plugin info` command. Two-block form: the `1 plugin operation failed.` summary (the failed row is a PLUGIN subject, GRAM-02) on the host `Error:` label line, then the header + failed row as its own block (GRAM-01). Severity `error`; no reload-hint (info surfaces are read-only per SNM-33).

<!-- catalog-state: missing-plugin-not-in-manifest -->

```text
1 plugin operation failed.

● mp [user] <no autoupdate>
  ⊘ ghost-plugin (failed) {not in manifest}
```

### Failure -- missing marketplace (no `--scope` filter)

Triggered when `plugin info <plugin>@<marketplace>` is invoked against a marketplace name that is NOT present in EITHER scope. The orchestrator emits the standalone `MarketplaceNotAddedMessage` variant (`kind: "marketplace-not-added"`) with `name` set to the MARKETPLACE name (not the plugin name -- the user-facing failure is "the marketplace is not added", not "the plugin doesn't exist"); `scope` is OMITTED so the renderer's bracket short-circuit suppresses the `[scope]` token (D-03: absent-from-both states have no scope bracket because the marketplace is in neither scope). The renderer emits the bare row at column 0 with no marketplace header. Two-block form: the `1 marketplace operation failed.` summary on the host `Error:` label line, then the bare detail row as its own block (GRAM-01 / GRAM-02). Severity `error`; no reload-hint.

<!-- catalog-state: missing-marketplace-not-added-absent-from-both -->

```text
1 marketplace operation failed.

⊘ ghost-mp (failed) {not added}
```

### Failure -- missing marketplace (`--scope` mismatch)

Triggered when `plugin info <plugin>@<marketplace> --scope <wrong-scope>` is invoked against a marketplace present only in the OTHER scope. The renderer emits the same bare-row form as the absent-from-both variant above, but WITH the `[scope]` bracket because the user explicitly asked for a specific scope. This is the plugin-info-surface mirror of the `scope-mismatch-not-added` state under `marketplace info`; the distinction from `missing-marketplace-not-added-absent-from-both` is the bracket presence (no bracket when neither scope holds the marketplace; bracket present when a specific scope was requested). Two-block form: the `1 marketplace operation failed.` summary on the host `Error:` label line, then the bare detail row as its own block (GRAM-01 / GRAM-02). Severity `error`; no reload-hint.

<!-- catalog-state: missing-marketplace-not-added-scope-mismatch -->

```text
1 marketplace operation failed.

⊘ ghost-mp [user] (failed) {not added}
```

______________________________________________________________________

## `/claude:plugin preview`

DIFF-01 SC #2 / D-53-01 read-only diff/preview surface. Renders the bidirectional difference between the merged config (`claude-plugins.json` + `claude-plugins.local.json`) and the recorded state (`state.json`) for the next reload's reconcile. Runs against both scopes when `--scope` is omitted. NEVER writes any file, NEVER touches the network (NFR-5). Running it twice produces byte-identical output (DIFF-01 SC #2). DIFF-02: rows render subject-first `<glyph> <name> [<scope>] (will ...)` with the closed-set pending-tense token set (`will add` / `will remove` / `will install` / `will uninstall` / `will enable` / `will disable`). The `/reload to pick up changes` trailer is STRUCTURALLY EXCLUDED -- preview rows are pre-transition and the trailer would mislead the user.

### Empty steady-state (no actions pending)

The merged config matches the recorded state byte-for-byte in every scope -- the next reload's reconcile would apply zero actions. The orchestrator emits a free-form advisory body line (no cascade, no marketplaces array projection). Severity `info`; no reload-hint; no summary line.

<!-- catalog-state: empty-steady-state -->

```text
Preview: next reload will apply 0 actions.
```

### Marketplace add with child plugin install

A new marketplace declared in `claude-plugins.json` (`will add`) carries one child plugin row declared with the same key (`will install`). Subject-first row grammar per DIFF-02: `● new-mp [user] (will add)` / `● new-plugin (will install)`. Orphan-fold (D-13-18 / MSG-PL-6): the plugin row omits its `[scope]` bracket because its scope matches the parent marketplace's scope. Severity `info`; no reload-hint.

<!-- catalog-state: mp-add-plugin-install -->

```text
● new-mp [user] (will add)
  ● new-plugin (will install)
```

### Plugin pending uninstall under existing marketplace

A plugin recorded in `state.json` but no longer declared in `claude-plugins.json`. The marketplace itself is still declared (source matches the recording) so its header renders status-less (list-arm: SUB-BRANCH A bare header) and only the plugin row carries the `(will uninstall)` token (`○` glyph -- the pre-transition analog of the realized `(uninstalled)` open-circle row). Severity `info`; no reload-hint.

<!-- catalog-state: plugin-pending-uninstall -->

```text
● mp [user]
  ○ old-plugin (will uninstall)
```

### Enable / disable transitions (Phase 54 hand-off shape)

A marketplace with two plugin children: one newly enabled in config (`will enable`, `●` glyph) and one newly disabled (`will disable`, `⊘` glyph). Phase 53 produces ZERO `will enable` rows in practice (Pitfall 53-4: the Phase 53 state model has no disabled marker on a recorded plugin); the variant and renderer arm ship so Phase 54's enable-bucket wiring lands against a type-complete model. Severity `info`; no reload-hint.

<!-- catalog-state: enable-disable-transitions -->

```text
● mp [user]
  ● to-enable (will enable)
  ⊘ to-disable (will disable)
```

### Source mismatch (declared source diverges from recorded source)

A declared marketplace whose recorded source string does not match the declaration byte-for-byte (the apply path cannot honour the declaration without first removing the recording). The row reuses the existing `"source mismatch"` REASONS member (Pitfall 53-7 -- REASONS stays at 29 entries). Severity `error` (a `(failed)` mp row); summary line prepended (GRAM-01 / GRAM-02): `1 marketplace operation failed.`.

<!-- catalog-state: source-mismatch -->

```text
1 marketplace operation failed.

⊘ mp [project] (failed) {source mismatch}
```

### Invalid config abort (CFG-03 -- Pitfall 53-1)

A `claude-plugins.json` (or `claude-plugins.local.json`) that is malformed, unparseable, or schema-invalid. The orchestrator routes the scope through a structured `(failed) {invalid manifest}` row and does NOT call `planReconcile` for it -- invalid input is NEVER silently coerced to an empty desired state (which would otherwise render as a mass-uninstall preview). The row body carries the file BASENAME (never the absolute path -- RESEARCH Security Threat Pattern "Information disclosure" T-53-02-02). Severity `error`; summary line prepended.

<!-- catalog-state: invalid-config-abort -->

```text
1 marketplace operation failed.

⊘ claude-plugins.json [project] (failed) {invalid manifest}
```

______________________________________________________________________

## reconcile-applied-cascade

RECON-04 (Phase 55 Plan 02) load-time reconcile apply cascade emitted by `applyReconcile` after every `resources_discover` invocation that performed at least one apply action OR carried at least one invalid-config / source-mismatch row. Wraps the same per-status `MarketplaceNotificationMessage[]` shape the cascade arm carries -- realized transition tokens (`added` / `removed` / `installed` / `uninstalled` / `disabled` / `failed`) reused per RESEARCH Pattern 5 Option A -- so the rendered bytes match each token's standalone-command counterpart. The `Run /reload to pick up changes` trailer is STRUCTURALLY EXCLUDED (Pitfall 4 / RECON-04 -- the reconcile already ran ON /reload). Empty-and-clean reconciles are silent (no notify) per the load-time silence contract (NFR-2 / A4).

### Success cascade -- mixed marketplace add + plugin install across both scopes

A reconcile that materialized one new marketplace + one plugin install per scope. Subject-first row grammar; the `(added)` mp row carries the `●` glyph and the `(installed)` plugin row reuses the standalone-install byte form. Severity `info`; no reload-hint; no summary line.

<!-- catalog-state: success-cascade-mixed -->

```text
● new-mp [project] (added)
  ● new-plugin (installed)

● other-mp [user] (added)
  ● other-plugin (installed)
```

### Soft-fail per-entry -- one (failed) {network unreachable} row, other entries continue

A reconcile where one declared github-source marketplace failed during `addMarketplace` clone (NFR-5 per-entry soft-fail) but a sibling declared marketplace + plugin install succeeded. Severity `error` (the cascade has a failed mp row); summary line prepended.

<!-- catalog-state: soft-fail-mixed -->

```text
1 marketplace operation failed.

⊘ flaky-mp [user] (failed) {network unreachable}

● ok-mp [user] (added)
  ● ok-plugin (installed)
```

### CFG-03 invalid-config row -- BASENAME only (T-55-02-01)

A reconcile where `claude-plugins.json` is unparseable. The read pass surfaces the scope as `(failed) {invalid manifest}` carrying the file BASENAME (never the absolute path -- T-55-02-01 / T-53-02-02 information-disclosure mitigation); that scope's apply pass is skipped (CFG-03 abort -- never a mass-uninstall). Severity `error`; summary line prepended.

<!-- catalog-state: invalid-config-row -->

```text
1 marketplace operation failed.

⊘ claude-plugins.json [project] (failed) {invalid manifest}
```

### CFG-03 invalid-config row -- with cause-chain trailer (I5 / PR #51)

Same CFG-03 surface as above, but the read pass threaded `loadConfig`'s diagnostic detail (EACCES / JSON-parse / schema key) into the rendered cause-chain trailer via a synthetic plugin child. Absolute paths are stripped at the boundary via `redactAbsolutePaths` (T-53-02-02 / T-55-02-01 information-disclosure mitigation) -- the parse / permission detail itself is preserved so the operator can debug without re-loading the file. The synthetic child reuses the SNM-10 pattern (marketplace headers cannot carry a cause; plugin rows can), so adding the trailer required no new MarketplaceNotificationMessage shape.

<!-- catalog-state: invalid-config-row-with-cause -->

```text
1 plugin operation and 1 marketplace operation failed.

⊘ claude-plugins.json [project] (failed) {invalid manifest}
  ⊘ claude-plugins.json (failed) {invalid manifest}
    cause: schema validation failed: /marketplaces: Expected object
```

### Partial marketplace remove -- per-plugin children (I1 / PR #51)

A reconcile-driven `marketplace remove` whose cascade unstaged a subset of the marketplace's plugins and failed others. The orchestrated `RemoveMarketplaceOutcome.partial` arm carries BOTH the unstaged plugin names AND the per-plugin failures; the apply pass renders one row per plugin (○ `(uninstalled)` for unstaged, ⊘ `(failed) {reason}` for failed) under a bare `(failed)` mp header -- mirrors the standalone `marketplace remove` `partial` byte form. Pre-fix the orchestrated arm collapsed the cascade to a single mp-failed row with the first failure's reason, silently dropping the N-1 other rows (D-22-02 violation).

<!-- catalog-state: partial-marketplace-remove -->

```text
2 plugin operations and 1 marketplace operation failed.

⊘ acme-mp [user] (failed)
  ○ plugin-ok (uninstalled)
  ⊘ plugin-fail-a (failed) {permission denied}
  ⊘ plugin-fail-b (failed) {source missing}
```

______________________________________________________________________

## `/claude:plugin marketplace remove <name>`

Single-marketplace command that cascades plugin unstaging.

### Clean removal

<!-- catalog-state: clean -->

```text
● local-mp [user] (removed)
  ○ helper (uninstalled)

/reload to pick up changes
```

Clean (no-failure) removal carries one `PluginUninstalledMessage` row (`○` glyph, `(uninstalled)` token) per successfully unstaged plugin (D-22-02). The name-only row has no `v<version>` token because the `successfullyUnstaged` accumulator is a `string[]` of plugin names. The reload-hint fires because at least one plugin row carries the `uninstalled` state-change token (SNM-33 / D-22-01). An empty `marketplace remove` (no plugins were staged) renders the header alone with no trailer (G-MIL-02).

### Partial removal (some plugins unstaged, others failed)

<!-- catalog-state: partial -->

```text
1 plugin operation and 1 marketplace operation failed.

⊘ local-mp [user] (failed)
  ○ helper (uninstalled)
  ⊘ tool (failed) {permission denied}
    cause: EACCES: permission denied

/reload to pick up changes
```

Marketplace header is `failed` (the marketplace remove did not fully complete). Plugin rows mix outcomes: `helper` uninstalled successfully (`○` glyph, `(uninstalled)` token); `tool` failed (`⊘` glyph, `{permission denied}` reason, 4-space-indent cause-chain trailer). Reload-hint fires because at least one plugin is in the state-changing set (`uninstalled` is in the set per D-16-12). Severity: `error` (any failed → error per D-16-11).

The v1.0 free-text retry-anchor trailer (a sentence above the reload-hint instructing the operator to remediate and re-run) is no longer emitted -- it is not expressible in `NotificationMessage` (per D-17-09).

### Failure -- missing marketplace (explicit `--scope`)

Triggered when `marketplace remove <name> --scope <scope>` targets a name that is NOT present in the requested scope (ATTR-06 / S3). The orchestrator's pre-guard existence check routes the miss to the standalone `MarketplaceNotAddedMessage` `{not added}` variant (`kind: "marketplace-not-added"`, `name`, `scope`) and returns BEFORE entering `withStateGuard` -- no raw `MarketplaceNotFoundError` escapes past the orchestrator (D-48-C Shape 1), and state is left untouched. The variant carries the requested `[scope]` bracket (SCOPE-01). Routed via `isInfoKind` -> `error` severity, no reload-hint. Two-block form: the `1 marketplace operation failed.` summary on the host `Error:` label line, then the bare detail row as its own block (GRAM-01 / GRAM-02).

<!-- catalog-state: remove-missing-not-added -->

```text
1 marketplace operation failed.

⊘ ghost-mp [user] (failed) {not added}
```

### Failure -- missing marketplace (bare form, absent from both scopes)

Triggered when `marketplace remove <name>` (no `--scope`) targets a name absent from BOTH scopes (ATTR-06 / S4). The bare-form `resolveScopeFromState` `MarketplaceNotFoundError` is caught at the orchestrator entrypoint and routed to the SAME standalone `MarketplaceNotAddedMessage` variant -- but with NO `scope`, so the renderer's bracket short-circuit suppresses the `[scope]` token ("absent from both"). `resolveScopeFromState`'s throw contract is unmodified (it is shared with `update.ts`); the catch lives at the remove entrypoint. Severity `error`; no reload-hint. Two-block form: the `1 marketplace operation failed.` summary on the host `Error:` label line, then the bare detail row as its own block (GRAM-01 / GRAM-02).

<!-- catalog-state: remove-missing-not-added-bare -->

```text
1 marketplace operation failed.

⊘ ghost-mp (failed) {not added}
```

______________________________________________________________________

## `/claude:plugin marketplace update <name>`

Single marketplace, multi-plugin cascade. The marketplace header carries `(updated)`; plugin rows indent two spaces underneath. On the autoupdate-OFF path (manifest-only refresh, no plugin cascade) the header distinguishes a no-op from a genuine change: an unchanged manifest renders `(skipped) {up-to-date}` (UXG-05), a changed manifest renders `(updated)`. The same no-op vs changed distinction applies on the autoupdate-ON cascade path: when the validated manifest content is unchanged AND every cascaded plugin is `unchanged` (up-to-date), the marketplace converges to the SAME `(skipped) {up-to-date}` byte form (`plugins: []`, no cascade rows) rather than `(updated)`.

### Autoupdate-off manifest refresh -- no change (no-op)

<!-- catalog-state: update-no-op-skipped -->

```text
● local-mp [user] (skipped) {up-to-date}
```

Manifest-only refresh whose validated `marketplace.json` content was byte-identical pre/post (UXG-05). The autoupdate-OFF path compares the parsed, typebox-validated manifest content (not `lastUpdatedAt`, not the git SHA), so the no-op is source-kind-uniform: a path source whose local manifest is unchanged, and a github source whose clone advanced but yielded byte-identical manifest content, both render this. `mp.status = "skipped"`, `mp.reasons = ["up-to-date"]`; no plugin children (`plugins: []`). Severity: `info` -- `up-to-date` is in the benign closed set, so this benign no-op computes info (the second arg is omitted) per UXG-02 / D-28-06/07. No reload-hint: with no plugin children there is no Pi-visible resource change, so a manifest-only refresh never warrants a `/reload` (SNM-33 / D-22-01 / G-MIL-06).

### Autoupdate-on cascade -- no change (no-op)

<!-- catalog-state: update-autoupdate-noop-skipped -->

```text
● official [user] (skipped) {up-to-date}
```

Autoupdate-ON cascade refresh whose validated `marketplace.json` content was byte-identical pre/post AND whose every cascaded plugin was `unchanged` (up-to-date) (UXG-05). The autoupdate-ON path consults the same content-compare detector as the OFF path (`snapshot.changed === false`) PLUS the cascade outcomes (`outcomes.every(o => o.partition === "unchanged")`); when both hold, the marketplace converges to the SAME `(skipped) {up-to-date}` byte form as the autoupdate-OFF no-op -- the all-`unchanged` cascade rows are dropped (`plugins: []`), so this is byte-identical to the OFF no-op (a distinct mp name, `official`, matches the autoupdate-ON cascade examples in this section). `mp.status = "skipped"`, `mp.reasons = ["up-to-date"]`. Severity: `info` -- `up-to-date` is benign, so this no-op computes info (the second arg is omitted) per UXG-02 / D-28-06/07. No reload-hint: with no plugin children there is no Pi-visible resource change (SNM-33 / D-22-01 / G-MIL-06). This is exactly what the Phase 27 UAT Test-3 gap missed: prior to the fix the autoupdate-ON branch emitted `status: "updated"` unconditionally and never consulted `snapshot.changed`, so a true no-op on an autoupdate-ON marketplace (e.g. `claude-plugins-official`) always rendered `(updated)`.

### Autoupdate-off manifest refresh -- changed

<!-- catalog-state: manifest-refresh-changed -->

```text
● local-mp [user] (updated)
```

Manifest-only refresh whose validated `marketplace.json` content actually changed (UXG-05). Bare marketplace `updated` block (no plugin children; `plugins: []` renders as the bare header alone per D-15-08). `mp.status = "updated"`. No reload-hint: with no plugin children there is no Pi-visible resource change, so a manifest-only refresh does not warrant a `/reload` (SNM-33 / D-22-01 / G-MIL-06).

### Mixed plugin outcomes

<!-- catalog-state: mixed-outcomes -->

```text
1 plugin operation failed.

● official [user] (updated)
  ● alpha v0.5.0 → v1.0.0 (updated)
  ⊘ beta (skipped) {up-to-date}
  ⊘ delta (failed) {network unreachable}

/reload to pick up changes
```

Marketplace header carries `(updated)`; plugin rows mix outcomes. Reload-hint fires (multiple state-changing rows). Severity: `error`. The `failed` `delta` row carries no version-arrow because `PluginFailedMessage` has no `from`/`to` fields (only the `updated` variant does per D-15-04).

### Marketplace update failed (manifest unreachable)

<!-- catalog-state: mp-failure-network -->

```text
1 marketplace operation failed.

⊘ official [user] (failed)
```

Marketplace-level failure with no plugin children evaluated. No reload-hint (failed marketplace does not trigger per D-16-12). Severity: `error`. The cause-chain trailer for failed marketplaces is not emitted by the current `notify()` renderer (the v2 type model places `cause?: Error` on plugin variants only); orchestrators surfacing the cause must do so via a per-plugin manual-recovery or failed row inside the block.

### Marketplace update failed (path-source invalid manifest)

Triggered when `marketplace update <name>` refreshes a PATH-source marketplace whose `marketplace.json` is malformed JSON or schema-invalid (ATTR-10 / D-48-B). `loadMarketplaceManifest` throws the typed `InvalidMarketplaceManifestError`; `refreshRecord` wraps it as `MarketplaceUpdateError`, and the `refreshOneMarketplace` catch classifies it via `reasonsFromCascadeError` (which now recognizes the typed manifest error before the `?? ["network unreachable"]` default) to `{invalid manifest}` -- carried on the synthetic-child failed row (the marketplace header has no `reasons` field for this recipe; the reason rides the child, mirroring `mp-failure-network`). A path-source refresh touches ZERO network (NFR-5), so the former lying `{network unreachable}` default MUST NOT fire here. github-source no-errno failures KEEP `{network unreachable}` as the catch-all (the classification did not collapse). No reload-hint (failed marketplace does not trigger per D-16-12). Severity: `error`. The summary prefix counts the synthetic child as one plugin operation.

<!-- catalog-state: update-path-invalid-manifest -->

```text
1 plugin operation and 1 marketplace operation failed.

⊘ official [user] (failed)
  ⊘ official (failed) {invalid manifest}
```

### Failure -- marketplace not added, explicit scope (SC#1 / ATTR-06 / D-48-C)

Triggered when `marketplace update <name> --scope <scope>` names a marketplace that is NOT added in the requested scope (or is present only in the OTHER scope). SC#1 cross-op convergence: the marketplace-form update now joins `install` / `uninstall` / `reinstall` / `update` (plugin form) / `marketplace remove` / `autoupdate` in routing the marketplace-absent precondition to the SAME standalone `MarketplaceNotAddedMessage` variant -- replacing the former raw `MarketplaceNotFoundError` escape past the orchestrator boundary (the last residual Class-C instance). A single pre-guard `loadState` existence read (NFR-5: network-free) blocks the miss BEFORE it reaches `snapshotAfterRefresh`'s `withStateGuard` throw; the `[scope]` bracket carries the REQUESTED scope (SCOPE-01). Genuine refresh failures (clone/manifest/lock) are untouched -- only `MarketplaceNotFoundError` reroutes here; everything else keeps its `(failed)` cascade (`mp-failure-network` / `update-path-invalid-manifest`). Two-block form: the `1 marketplace operation failed.` summary on the host `Error:` label line, then the bare column-0 detail row as its own block (GRAM-01 / GRAM-02). No cause-chain trailer. Severity `error`; no reload-hint.

<!-- catalog-state: update-missing-not-added -->

```text
1 marketplace operation failed.

⊘ ghost-mp [project] (failed) {not added}
```

### Failure -- marketplace not added, bare form absent from both scopes (SC#1 / ATTR-06)

Triggered when the bare `marketplace update <name>` form (no `--scope`) names a marketplace that is absent in BOTH scopes. `resolveScopeFromState` throws `MarketplaceNotFoundError`; the pre-guard catches it and emits the same standalone `{not added}` variant, but with NO `[scope]` bracket (the absent-from-both form: there is no requested scope to report). Byte-identical to `info`'s `missing-marketplace-not-added-absent-from-both` state and to the corresponding `reinstall` / `update` rows -- the cross-op byte convergence SC#1 proves. Severity `error`; no reload-hint.

<!-- catalog-state: update-missing-not-added-absent-from-both -->

```text
1 marketplace operation failed.

⊘ ghost-mp (failed) {not added}
```

______________________________________________________________________

## `/claude:plugin enable <plugin>@<marketplace>`

D-54-01 / ENBL-01 / ENBL-03. Re-materializes a previously-disabled plugin from the cached marketplace clone -- the orchestrator reads `marketplace.json` from disk (PI-2 cached read; NFR-5: no network), reuses the install ledger's 5-phase sequence with `version: installed.version` (the pinned version from the state record), and writes `enabled: true` back to the config file at the resolved scope. A `--local` flag targets `claude-plugins.local.json` (Pitfall 54-5: the base `claude-plugins.json` mtime is unchanged). The cascade renders the BARE always-marketplace-header form (`mp.status === undefined`, no `(added)` token -- that header belongs to `marketplace add`; v1.12 milestone UAT-04 decision, 2026-06-11) with the existing `(installed)` PluginStatus row token (state-changer; reload-hint fires).

### Fresh enable

<!-- catalog-state: enable-fresh -->

```text
● claude-plugins-official [user]
  ● foo-plugin v1.2.3 (installed)

/reload to pick up changes
```

Fresh enable -- a previously-disabled plugin is re-materialized. The marketplace header is the bare always-marketplace-header form (`mp.status === undefined`, no details -- byte-identical to the install command's header; the former `(added)` token leaked from reusing the install-cascade header shape and was dropped per UAT-04); plugin row = `PluginInstalledMessage` (status: `"installed"`, the existing state-change token). Severity `info`; reload-hint fires per SNM-33 (the plugin row is a state-change transition).

### Idempotent enable

<!-- catalog-state: enable-idempotent -->

```text
● claude-plugins-official [user]
  ⊘ foo-plugin (skipped) {already enabled}
```

Idempotent no-op -- the plugin is already enabled. Plugin row = `PluginSkippedMessage` carrying `reasons: ["already enabled"]`; `already enabled` is in `BENIGN_REASONS`, so the cascade routes to `info` severity via the UXG-02 / D-28-06 first-match ladder (mirrors the `already autoupdate` precedent). No reload-hint (skipped is not a state-changer).

### Source missing -- cached clone gone

<!-- catalog-state: enable-source-missing -->

```text
1 plugin operation failed.

● claude-plugins-official [user]
  ⊘ foo-plugin (failed) {source missing}
```

Triggered when the cached marketplace clone has been deleted between the recorded state and the enable invocation. The orchestrator aborts pre-ledger -- no artefacts are partially materialized, no state mutation occurs, and the config file is unchanged. Severity `error` (the cascade carries a failed row); the summary line names the failed plugin operation per GRAM-02.

### Not installed -- marketplace present, plugin row absent

<!-- catalog-state: enable-not-installed -->

```text
1 plugin operation skipped.

● claude-plugins-official [user]
  ⊘ foo-plugin (skipped) {not installed}
```

Triggered when the marketplace container is recorded in the target scope but the plugin row is absent from state.json (never installed, or concurrently uninstalled). Mirrors the reinstall/update precedent: `{not in manifest}` is reserved for "plugin absent from a PRESENT manifest"; "marketplace present, plugin not installed" is the actionable `(skipped) {not installed}` skip (ATTR-08 taxonomy). `not installed` is NOT in the benign closed set, so the skip routes to `warning` severity with the `1 plugin operation skipped.` summary (D-28-03). No reload-hint. The same arm fires for `disable` (the orchestrator's not-recorded outcome is shared by both verbs).

### Marketplace not added (ENBL / SCOPE-01)

<!-- catalog-state: enable-marketplace-not-added -->

```text
1 marketplace operation failed.

⊘ ghost-mp [user] (failed) {not added}
```

Triggered when the requested marketplace is not added in the resolved scope (or is present only in the OTHER scope). Routes through the standalone `MarketplaceNotAddedMessage` variant (`{not added}` on the marketplace subject) -- same pattern as install/uninstall (ATTR-01..04). Severity `error`; no reload-hint.

### Invalid config (CFG-03)

<!-- catalog-state: enable-invalid-config -->

```text
1 plugin operation failed.

● claude-plugins-official [user]
  ⊘ foo-plugin (failed) {invalid manifest}
```

Triggered when the target config file (`claude-plugins.json` or, with `--local`, `claude-plugins.local.json`) fails CFG-03 validation (0-byte, malformed JSON, or schema-invalid). The orchestrator aborts BEFORE entering the cascade -- state.json mtime is UNCHANGED. The `cause:` summary cites `path.basename(targetConfigPath)` (the file basename only, never the absolute path; T-53-02-02 information-disclosure mitigation reused from Phase 53). Severity `error`; no reload-hint.

______________________________________________________________________

## `/claude:plugin disable <plugin>@<marketplace>`

D-54-01 / ENBL-02. Removes a plugin's materialized artefacts (skills/commands/agents/MCP entries) via the existing uninstall cascade while PRESERVING the state record's `version` / `resolvedSource` / `compatibility` / `installedAt` fields. The four `resources.*` arrays reset to `[]`; the `installable: true` flag is retained. The combination is the load-bearing "currently disabled" marker (`orchestrators/reconcile/plan.ts::isRecordedButDisabled`). The config file gains `enabled: false` for the entry; `--local` targets the local file. The cascade-row form uses the closed-set `(disabled)` PluginStatus token -- the SAME glyph + token as the list/info `disabled-inventory` row, version slot kept (v1.12 milestone UAT-03 decision, 2026-06-11, superseding the original `(uninstalled)`-token choice: a disable is not an uninstall, and the row should name the state the plugin entered). The reload-hint still fires: the orchestrator dispatches the cascade with the `disable-cascade` kind, the SNM-33 carve-out under which a `(disabled)` row counts as a realized transition; kind-less list/info inventory surfaces stay hint-free.

### Fresh disable

<!-- catalog-state: disable-fresh -->

```text
● claude-plugins-official [user]
  ⊘ foo-plugin v1.2.3 (disabled)

/reload to pick up changes
```

Fresh disable -- a previously-enabled plugin's artefacts are unstaged via `cascadeUnstagePlugin`. Plugin row = `PluginDisabledMessage` (status: `"disabled"`, byte-identical to the `disabled-inventory` row); the cascade is dispatched with the `disable-cascade` kind, so the reload-hint fires (artefacts were removed -- SNM-33 / UAT-03). Severity `info`.

### Idempotent disable

<!-- catalog-state: disable-idempotent -->

```text
● claude-plugins-official [user]
  ⊘ foo-plugin (skipped) {already disabled}
```

Idempotent no-op -- the plugin is already disabled (state record carries the empty-resources marker). Plugin row = `PluginSkippedMessage` carrying `reasons: ["already disabled"]`; `already disabled` is in `BENIGN_REASONS`, so the cascade routes to `info` severity. No reload-hint.

### Marketplace not added

<!-- catalog-state: disable-marketplace-not-added -->

```text
1 marketplace operation failed.

⊘ ghost-mp [user] (failed) {not added}
```

Triggered when the requested marketplace is not added in the resolved scope (or is present only in the OTHER scope). Routes through the standalone `MarketplaceNotAddedMessage` variant. Severity `error`; no reload-hint.

### Invalid config (CFG-03)

<!-- catalog-state: disable-invalid-config -->

```text
1 plugin operation failed.

● claude-plugins-official [user]
  ⊘ foo-plugin (failed) {invalid manifest}
```

Triggered when the target config file fails CFG-03 validation. The orchestrator aborts BEFORE entering the cascade -- state.json mtime is UNCHANGED. The `cause:` summary cites `path.basename(targetConfigPath)` (basename only; T-53-02-02 mitigation). Severity `error`.

______________________________________________________________________

## `/claude:plugin marketplace autoupdate|noautoupdate <name>`

Marketplace-only flag flip. The orchestrator emits a single marketplace block with no plugin children; the block's `mp.status` discriminates between the V2 outcomes. V2 distinguishes six user-visible states for this surface: fresh-flip enable, fresh-flip disable, idempotent enable (no-op), idempotent disable (no-op), and -- when the marketplace persistence record cannot be found -- the standalone `{not added}` failure in two forms (explicit `--scope` carrying the scope bracket, and the bare absent-from-both form; ATTR-05 / D-48-C Shape 1). The per-state catalog blocks below give the exact byte form for each outcome. UXG-04: the flip surface now renders the autoupdate state as the `<autoupdate>` / `<no autoupdate>` marker (byte-form parity with the list surface), reversing the Phase 17.1 / D-18-05 status-token design; fresh flips render the bare marker, idempotent no-ops render the marker plus an `{already autoupdate}` / `{already no autoupdate}` idempotence brace. This shares byte form with the list-surface markers documented under [`## /claude:plugin marketplace list`](#claudeplugin-marketplace-list), but the two surfaces differ: the **list** surface conveys autoupdate-off by marker _absence_ (it emits `<autoupdate>` iff `mp.details.autoupdate === true`, with no off-marker), whereas this **flip** surface emits the explicit `<no autoupdate>` off-marker. The `<no autoupdate>` off-marker is therefore emitted only on this flip surface, never on the list surface (UXG-04 does not change the list surface).

### Fresh enable

<!-- catalog-state: enable-fresh -->

```text
● foo [user] <autoupdate>
```

Fresh state change -- the marketplace record was mutated. `mp.status` = `"autoupdate enabled"` (Strategy B: the discriminator is unchanged; only the emitted bytes are the `<autoupdate>` marker per UXG-04); severity = info (no severity arg). No reload-hint: the autoupdate flag lives on the marketplace record, not on any Pi-visible resource, so a fresh flip does not warrant a `/reload` (SNM-33 / D-22-01 / D-22-03, superseding the reload-trigger half of D-17.1-02).

### Fresh disable

<!-- catalog-state: disable-fresh -->

```text
● foo [user] <no autoupdate>
```

Fresh state change -- the marketplace record was mutated. `mp.status` = `"autoupdate disabled"` (Strategy B: discriminator unchanged; UXG-04 emits the explicit `<no autoupdate>` off-marker); severity = info (no severity arg). No reload-hint: the autoupdate flag lives on the marketplace record, not on any Pi-visible resource, so a fresh flip does not warrant a `/reload` (SNM-33 / D-22-01 / D-22-03, superseding the reload-trigger half of D-17.1-02).

### Idempotent enable

<!-- catalog-state: enable-idempotent -->

```text
● foo [user] <autoupdate> {already autoupdate}
```

Idempotent no-op -- the flag was already in the requested state. `mp.status` = `"skipped"`; `mp.reasons` = `["already autoupdate"]`; UXG-04 renders the marker-as-outcome plus the `{already autoupdate}` idempotence brace (no `(skipped)` token -- the marker conveys the state, the brace conveys idempotence); severity = `info` (`already autoupdate` is in the benign closed set, so this benign no-op computes info -- the second arg is omitted -- per UXG-02 / D-28-06/07); reload-hint suppressed.

### Idempotent disable

<!-- catalog-state: disable-idempotent -->

```text
● foo [user] <no autoupdate> {already no autoupdate}
```

Idempotent no-op -- the flag was already in the requested state. `mp.status` = `"skipped"`; `mp.reasons` = `["already no autoupdate"]`; UXG-04 renders the explicit `<no autoupdate>` off-marker plus the `{already no autoupdate}` idempotence brace (no `(skipped)` token); severity = `info` (`already no autoupdate` is in the benign closed set, so this benign no-op computes info -- the second arg is omitted -- per UXG-02 / D-28-06/07); reload-hint suppressed.

### Failure -- missing marketplace (explicit `--scope`)

Triggered when `marketplace autoupdate <name> --scope <scope>` (or `noautoupdate`) targets a name NOT added in the requested scope (ATTR-05 / S1). The explicit-scope `MarketplaceNotFoundError` raised by `applyAutoupdateFlipInPlace` is a missing-marketplace precondition, NOT a flip failure -- the orchestrator routes it to the standalone `MarketplaceNotAddedMessage` `{not added}` variant (`kind: "marketplace-not-added"`, `name`, `scope`) carrying the requested `[scope]` bracket (D-48-C Shape 1). This supersedes the former reason-less / synthetic-child `{not found}` byte form: the reason is now the truthful `{not added}`. Routed via `isInfoKind` -> `error` severity, no reload-hint. Two-block form: the `1 marketplace operation failed.` summary on the host `Error:` label line, then the bare detail row as its own block (GRAM-01 / GRAM-02). A `StateLockHeldError` is NOT a missing-marketplace and keeps its separate synthetic-child `(failed) {lock held}` routing (unchanged by ATTR-05).

<!-- catalog-state: autoupdate-missing-not-added -->

```text
1 marketplace operation failed.

⊘ missing-mp [user] (failed) {not added}
```

### Failure -- missing marketplace (bare form, absent from both scopes)

Triggered when `marketplace autoupdate <name>` (no `--scope`) targets a name absent from EVERY iterated scope (ATTR-05 / S2). The former byte form was a reason-LESS bare `(failed)` row; it is superseded by the SAME standalone `MarketplaceNotAddedMessage` `{not added}` variant. The bare form carries `first.scope` -- the scope where the first not-found was observed; SC-6 iterates project-before-user, so the bracket is `[project]`. Severity `error`; no reload-hint. Two-block form: the `1 marketplace operation failed.` summary on the host `Error:` label line, then the bare detail row as its own block (GRAM-01 / GRAM-02).

<!-- catalog-state: autoupdate-missing-not-added-bare -->

```text
1 marketplace operation failed.

⊘ missing-mp [project] (failed) {not added}
```

The blocks above span two ladders. The severity ladder runs fresh → info, benign skipped → info, failed (and the `{not added}` precondition miss) → error (per D-16-11 + Phase 17.1's mp-level skipped extension, refined by UXG-02 / D-28-06: the two idempotent autoupdate no-ops carry benign reasons -- `already autoupdate` / `already no autoupdate` -- so they compute info, not warning; an mp-level `skipped` with non-benign or missing reasons would still route to warning). The reload-hint ladder is uniform here: every autoupdate flag flip suppresses the trailer (per SNM-33 / D-22-01 / D-22-03). The autoupdate flag lives on a marketplace record, not on any Pi-visible resource, so neither a fresh flip nor an idempotent no-op nor a missing-marketplace `{not added}` failure contributes to "/reload to pick up changes" -- only a plugin row state change does.

______________________________________________________________________

## Manual recovery anchors

In v2, the manual-recovery surface is the per-plugin `PluginManualRecoveryMessage` variant emitted inside a marketplace block. The v1.0 system-level `install-failure-with-anchor` state (a top-level `(manual recovery)` line decoupled from the failed install row) is retired per D-17-10 -- the v2 type model has no system-level free-form recovery anchor field.

### Per-plugin manual-recovery row inside a marketplace block

<!-- catalog-state: per-plugin-manual-recovery -->

```text
1 plugin operation skipped.

● official [user]
  ⊘ helper v1.0.0 (manual recovery) {unreadable}
    cause: bridge: agent staging conflict
```

The per-plugin `manual recovery` variant emits the literal `(manual recovery)` token (with the space) as the status discriminator. The `cause?: Error` trailer renders at 4-space indent below the row (D-16-08). Severity: `warning` (manual recovery triggers warning per D-16-11). No reload-hint (manual-recovery is not in the state-changing set).

______________________________________________________________________

## Empty / no-op surfaces

| Surface                                  | Output                                                 |
| ---------------------------------------- | ------------------------------------------------------ |
| Empty top-level `marketplaces: []`       | `(no marketplaces)` (literal body)                     |
| Per-marketplace block with `plugins: []` | Bare marketplace header alone (no `(no plugins)` line) |
| List filtered to non-existent scope      | Empty token form per the rows above                    |

Notes:

- `(no marketplaces)` is the renderer's sentinel for an empty top-level `marketplaces: []` per D-16-17. No reload-hint, no severity arg.
- An empty per-marketplace `plugins: []` IS the structural representation of an empty cascade per D-15-08; the renderer does not emit a `(no plugins)` body line under the header.

______________________________________________________________________

## Usage errors

Routed via `notifyUsageError(ctx, UsageErrorMessage)`. The on-the-wire string is `${message}\n\n${usage}` with `"error"` severity (always; severity is structural, not a field).

<!-- catalog-state: usage-error -->

```text
Usage: /claude:plugin <subcommand> [args]

Subcommands: install, uninstall, update, reinstall, list, bootstrap, import, marketplace
```

The exact wording is renderer-/orchestrator-specific; the contract is that `notifyUsageError` is called with a structured `UsageErrorMessage` and the renderer emits the two-section body separated by one blank line. The catalog's expected output mirrors the structural shape (`message` block, blank line, `usage` block).

______________________________________________________________________

## Out-of-band notifications

Notifications emitted directly via `ctx.ui.notify(message, severity?)` from outside the structured `notify(ctx, pi, NotificationMessage)` entrypoint. These bypass the renderer's severity / reload-hint / soft-dep pipeline and are reserved for surfaces that pre-date the `NotificationMessage` payload contract (e.g. interactive Device Flow prompts where the message is produced by a domain-tier state machine, not an orchestrator-tier outcome).

The byte form is locked by per-surface unit tests (NOT by `tests/architecture/catalog-uat.test.ts`, whose driver only knows the structured `notify()` entrypoint). The `<!-- catalog-state: -->` annotations below are for human-readable discoverability; the catalog-uat parser intentionally skips this section because its H2 title is not a `/claude:plugin` command header.

### Device Flow user-code prompt (AUTH-03)

<!-- catalog-state: device-flow-prompt -->

```text
Open https://github.com/login/device and enter: ABCD-1234
```

Emitted exactly once by `initiateDeviceFlow` (in `extensions/pi-claude-marketplace/domain/github-auth.ts`) after a successful `POST /login/device/code` and before the poll loop starts. The literal example shows GitHub's standard verification URL plus a mock user code; the production string interpolates `deviceCode.verification_uri` and `deviceCode.user_code` from the GitHub response. Severity: `info` (the second arg to `ctx.ui.notify` is the magic string `"info"`).

AUTH-03 contract: the user is shown a one-time code (`user_code`) AND a verification URL (`verification_uri`) so they can authorize the OAuth App from any browser. AUTH-09 contract: the access token is NOT yet acquired when this notification fires (the poll loop runs AFTER), so `access_token` / `accessToken` / `cred.password` are NOT interpolatable into this message. The byte form is locked by `tests/shared/device-flow-prompt.test.ts` -- any change to the emission string requires a lockstep update of the catalog AND the byte-form lock test.

Triggers: `marketplace add <owner>/<private-repo>` (first access; Phase 35 Plan 35-01) and -- rarely -- `marketplace update <name>` when the stored credential has been evicted from the OS keychain (Phase 35 Plan 35-02). The post-Phase-35-01 happy path on `marketplace update` is silent reuse (AUTH-02): the stored token in the keychain hits on `credentialOps.fill`, no Device Flow runs, no notification fires.

______________________________________________________________________

## Cross-references

- [`docs/messaging-style-guide.md`](messaging-style-guide.md) -- v2.0 thin-pointer style guide; binding closed-set authority via `as const` tuples in `shared/notify.ts`.
- [`docs/adr/v2-001-structured-notify.md`](adr/v2-001-structured-notify.md) -- design rationale for the v1.4 structured `NotificationMessage` model; landed via Phase 17 -- spec + catalog UAT migration.
- [`extensions/pi-claude-marketplace/shared/notify.ts`](../extensions/pi-claude-marketplace/shared/notify.ts) -- the v2 renderer (`notify(ctx, pi, message)` + `notifyUsageError(ctx, message)`); SOLE site for v2 grammar emission.
- [`tests/architecture/notify-types.test.ts`](../tests/architecture/notify-types.test.ts) -- compile-time closed-set membership proof.
- [`tests/architecture/catalog-uat.test.ts`](../tests/architecture/catalog-uat.test.ts) -- user-contract gate; drives this catalog's `<!-- catalog-state: STATE -->` annotated fixtures through `notify()` via mock `ctx` and asserts byte-equality (rewritten in Plan 17-03; until then the V1 catalog UAT byte-mismatches against the v2 catalog -- Pitfall 2 documented in 17-RESEARCH.md).
- [`docs/prd/pi-claude-marketplace-prd.md`](prd/pi-claude-marketplace-prd.md) §6.12 ES-5 -- the stable user-contract strings origin; the 5 ES-5 markers were superseded by the v1.3 style guide and remain blocked by `tests/architecture/no-legacy-markers.test.ts`.
