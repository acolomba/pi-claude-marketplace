# Command Output Catalog

Per-command rendered output for each user-visible state. Catalog v2.0 supersedes the v1.0 grammar (single-plugin one-line carve-out, V1 wrapper-name severity routing, frontmatter-driven closed sets) with the structured-`NotificationMessage` grammar emitted by the Phase 16 `notify(ctx, pi, message)` renderer at `extensions/pi-claude-marketplace/shared/notify.ts`. Every fenced output block in this catalog is byte-equal to what `notify()` emits given a corresponding structured fixture; `tests/architecture/catalog-uat.test.ts` drives that byte-equality as the user-contract gate.

## Conventions

### Glyphs

- `●` -- filled circle. On plugin rows: plugin is installed (covers `(installed)`, `(updated)`, `(reinstalled)`, `(upgradable)`). On marketplace headers: success / OK / state-changing outcome (`(added)`, `(removed)`, `(updated)`, and the list-surface label form).
- `○` -- empty circle. On plugin rows: plugin is not installed and there is no error -- either `(available)` (declared but never installed) or `(uninstalled)` (explicitly removed). Never used on marketplace headers.
- `⊘` -- prohibited symbol. On plugin rows: error / blocked state -- `(unavailable)`, `(skipped)`, `(failed)`, or `(manual recovery)`. On marketplace headers: `(failed)` only.

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

- A plugin status is in `{installed, updated, reinstalled, uninstalled}`.

The principle: marketplace records are bookkeeping, not Pi-visible resources; only plugin rows (skill / agent / command / MCP entry) are. A marketplace status alone (`added`, `removed`, `updated`, `autoupdate enabled`, `autoupdate disabled`) never warrants a `/reload` -- the trailer fires only when a plugin row carries one of the four state-change tokens. A `failed` marketplace does NOT trigger the trailer (rolled-back state has nothing to reload). A failed-only cascade (no successful or state-changing rows) also suppresses the trailer.

The list-only inventory token `present` (emitted by `/claude:plugin list` for already-installed plugins as a steady-state row -- distinct from the cascade-context `installed` transition token) is deliberately ABSENT from the plugin-status trigger set. This keeps `shouldEmitReloadHint`'s contents-derived decision unambiguous per SNM-15: every status discriminator either always triggers or never triggers; no token straddles both inventory and transition surfaces. See UAT gap G-21-01 in `.planning/phases/21-final-teardown-green-gate/21-HUMAN-UAT.md` for the failure mode the split closes.

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

Marketplace status tokens (4 entries):

| Token       | Icon | Where it appears                                                                                                                               |
| ----------- | ---- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `(added)`   | ●    | Marketplace header -- `marketplace add`, `bootstrap`, import cascade.                                                                          |
| `(removed)` | ●    | Marketplace header -- `marketplace remove` clean.                                                                                              |
| `(updated)` | ●    | Marketplace header -- `marketplace update`.                                                                                                    |
| `(failed)`  | ⊘    | Marketplace header -- `marketplace add` failure, `marketplace remove` partial, `marketplace update` failure, `marketplace autoupdate` failure. |

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

> Note: the v2 `notify()` renderer's `composeMarketplaceBlock` does not emit a marketplace-level cause-chain trailer below the failed header. The v2 type model places `cause?: Error` on plugin variants only; orchestrators wanting to surface the diagnostic must construct the payload as a per-plugin failed/manual-recovery row with `cause?: Error`. This catalog state is the bare failed-marketplace header byte form.

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

______________________________________________________________________

## `/claude:plugin marketplace autoupdate|noautoupdate <name>`

Marketplace-only flag flip. The orchestrator emits a single marketplace block with no plugin children; the block's `mp.status` discriminates between the V2 outcomes. V2 distinguishes five user-visible states for this surface: fresh-flip enable, fresh-flip disable, idempotent enable (no-op), idempotent disable (no-op), and failure when the marketplace persistence record cannot be found. The per-state catalog blocks below give the exact byte form for each outcome. UXG-04: the flip surface now renders the autoupdate state as the `<autoupdate>` / `<no autoupdate>` marker (byte-form parity with the list surface), reversing the Phase 17.1 / D-18-05 status-token design; fresh flips render the bare marker, idempotent no-ops render the marker plus an `{already autoupdate}` / `{already no autoupdate}` idempotence brace. This shares byte form with the list-surface markers documented under [`## /claude:plugin marketplace list`](#claudeplugin-marketplace-list), but the two surfaces differ: the **list** surface conveys autoupdate-off by marker _absence_ (it emits `<autoupdate>` iff `mp.details.autoupdate === true`, with no off-marker), whereas this **flip** surface emits the explicit `<no autoupdate>` off-marker. The `<no autoupdate>` off-marker is therefore emitted only on this flip surface, never on the list surface (UXG-04 does not change the list surface).

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

### Failure -- marketplace not found

<!-- catalog-state: failure-not-found -->

```text
1 marketplace operation failed.

⊘ missing-mp [user] (failed)
```

Marketplace persistence record lookup failed. `mp.status` = `"failed"`; severity = `"error"`; no reload-hint (failed state-change rolled back; nothing landed).

The five blocks above span two ladders. The severity ladder runs fresh → info, benign skipped → info, failed → error (per D-16-11 + Phase 17.1's mp-level skipped extension, refined by UXG-02 / D-28-06: the two idempotent autoupdate no-ops carry benign reasons -- `already autoupdate` / `already no autoupdate` -- so they compute info, not warning; an mp-level `skipped` with non-benign or missing reasons would still route to warning). The reload-hint ladder is uniform here: every autoupdate flag flip suppresses the trailer (per SNM-33 / D-22-01 / D-22-03). The autoupdate flag lives on a marketplace record, not on any Pi-visible resource, so neither a fresh flip nor an idempotent no-op nor a rolled-back failure contributes to "/reload to pick up changes" -- only a plugin row state change does.

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
