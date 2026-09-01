# Command Output Catalog

Per-command rendered output for each user-visible state. Catalog v2.0 supersedes the v1.0 grammar (single-plugin one-line carve-out, V1 wrapper-name severity routing, frontmatter-driven closed sets) with the structured-`NotificationMessage` grammar emitted by the Phase 16 `notify(ctx, pi, message)` renderer at `extensions/pi-claude-marketplace/shared/notify.ts`. Every fenced output block in this catalog is byte-equal to what `notify()` emits given a corresponding structured fixture; `tests/architecture/catalog-uat.test.ts` drives that byte-equality as the user-contract gate.

## Conventions

### Glyphs

- `●` -- filled circle. On plugin rows: plugin is installed or pending a positive transition (covers `(installed)`, `(updated)`, `(reinstalled)`, `(upgradable)`, the currently-clean `(partially-upgradable)` -- both the list-inventory row and the manual update-decline row (XSURF-03) -- and the pending-tense `(will install)` / `(will enable)`). On marketplace headers: success / OK / state-changing outcome (`(added)`, `(removed)`, `(updated)`, and the list-surface label form, including the bare pending-preview header a marketplace add/remove renders).
- `○` -- empty circle. On plugin rows: plugin is not installed and there is no error -- `(available)` (declared but never installed), `(uninstalled)` (explicitly removed), or the pending-tense `(will uninstall)`. Never used on marketplace headers.
- `⊘` -- prohibited symbol. On plugin rows: error / blocked state -- `(unavailable)`, `(skipped)`, `(failed)`, `(manual recovery)`. On marketplace headers: `(failed)` only.
- `⊖` -- circled minus. On plugin rows: a partially-available plugin whose components would be dropped under `--partial` -- `(partially-available)` only, on the list / info inventory surfaces AND the install-failure surface (XSURF-01). Stays in the circled-operator family with `⊘` but reads "diminished / components dropped" rather than "blocked". Not used on marketplace headers.
- `◉` -- fisheye (a filled circle inside a ring). On plugin rows: a recorded-installed plugin that currently re-resolves `partially-available` -- `(partially-installed)` only, on the list / info inventory surfaces AND the install / update / enable success surfaces (FSTAT-02). Distinct from the clean `(installed)` row's `●` so a degraded install is visually separable. Not used on marketplace headers.
- `◌` -- dotted circle. On plugin rows: a not-installed git-source plugin whose clone/mirror is not yet materialized locally -- `(remote)` only (RSTA-01 / D-80-01). Not used on marketplace headers.
- `◍` -- circle with vertical fill. On plugin rows: deliberate, user-requested disabled state -- `(disabled)` realized inventory row and `(will disable)` pending-tense row (D-80-01: reassigned from `◌`). Not used on marketplace headers.

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

- `<icon>` -- one of `●` / `○` / `⊘` / `⊖` / `◉` / `◌` / `◍` per the effective-state rule above. The seven characters are the seven `ICON_*` constants `shared/notify.ts` exports; the COMPAT-01 gate pins each code point and the export count.
- `<name>` -- the plugin name from `p.name`. The `@<marketplace>` suffix is NEVER emitted on a plugin row in v2; the marketplace is already in the header above.
- `[<scope>]` -- emitted ONLY in the orphan-fold case (plugin's `scope` field is explicitly set AND differs from the marketplace's scope). Same-scope rows omit the bracket because the header carries it. The `available`, `partially-available`, and `unavailable` variants have no `scope` field at all (SNM-11 carve-out) and never emit the bracket.
- `<version-token>` -- `v<version>` on most variants when `version` is set; `v<from> → v<to>` on the `updated` variant (required from-/to-fields per D-15-04). A persisted PI-7 hash-version (`hash-<12hex>`) renders as a git-style short SHA `v#<7hex>` -- the `hash-` prefix is stripped and only the first 7 of the 12 hex chars are shown (matching git `--short=7`); e.g. `hash-2ea95f85703d` renders `v#2ea95f8`. Persistence is unchanged (`state.json` keeps the full `hash-<12hex>`, PI-7 intact, no migration); the short form exists only at render time (SNM-35, D-23-04 / D-23-05).
- `(<status>)` -- the discriminator literal. `(manual recovery)` includes the space verbatim.
- `{<reasons>}` -- single brace block, comma-space separated, emitted only on the 9 reason-bearing variants and only when the composed reasons list is non-empty. A variant is reason-bearing when its message interface in `shared/notify.ts` declares a `reasons` field; that set is `installed | unavailable | upgradable | failed | skipped | manual recovery | partially-installed | partially-upgradable | partially-available`, listed in `PLUGIN_STATUSES` order. The remaining 10 of the 19 plugin statuses have no `reasons` field and therefore cannot carry a brace. `installed` is the one variant whose `reasons` field is OPTIONAL: the list inventory row stamps it for the durable absence fact (INV-01) and the install cascade stamps it for `orphan rewake` (SURF-05), while every other producer omits it. When the composed list is empty -- no typed reasons and no soft-dependency marker -- `composeReasons` returns the empty string and NO brace is emitted, so the row renders with the status token as its last token.

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

Reasons render inside a single `{}` block, comma-space separated. Each reason is 1-3 words lowercase, hyphenated where natural (`{up-to-date}`, `{rollback partial}`, `{not in manifest}`). Typed-kind carve-outs render `{lsp}` for `lspServers` and `{workflows}` for `workflows`. HOOK-04 / D-58-02: `{unsupported hooks}` is a normal 2-word reason (no longer a manifest-field carve-out -- under v1.13 the `hooks` component kind is supported, and the reason is sourced through `shared/probe-classifiers.ts::narrowResolverNotes` against `parseHooksConfig` prefix tokens). The 44-member `extensions/pi-claude-marketplace/shared/notify.ts::REASONS` tuple defines the closed set. The typed `workflows` kind maps to the final append-only member, `{workflows}`.

Structural `unavailable` rows derive reasons from resolver notes through `narrowResolverNotes`. Partial rows derive typed unsupported kinds through `narrowUnsupportedKinds`. The typed `workflows` kind uses the second path.

Multi-reason emit order is contractual. `composeReasons` joins in ARRAY order, so the order the orchestrator writes into `reasons[]` is the order the brace shows, and the soft-dependency markers append AFTER every typed reason (MSG-GR-4). The orchestrators write the record's relationship to its marketplace first and the facts about the install itself after it, which is why an absent-and-degraded row reads `{not in manifest, lsp}` and never the reverse (INV-02). The DECLARED order of the `REASONS` tuple must also stay byte-stable: the fenced blocks below are byte contracts, so reordering the tuple would move the rendered bytes of every multi-reason row even though no member changed.

The soft-dep markers `requires pi-subagents` and `requires pi-mcp` live INSIDE the same brace block as the variant's typed reasons (D-16-15 injection). They are emitted by the renderer at render time from the plugin's `dependencies` field and the Pi-host probe; callers do not place them in `reasons` directly. The 4 dep-bearing variants (`installed | updated | reinstalled | partially-installed`) declare the `dependencies` field per D-15-02 and WR-03; the remaining 15 of the 19 plugin statuses cannot emit soft-dep markers structurally. `partially-installed` is the one variant whose `dependencies` field is OPTIONAL: the install / update / enable success rows thread the staged counts, while the list / info inventory rows omit it so they carry no marker.

### Reload-hint trailer

`notify()` appends `/reload to pick up changes` (with one blank line above the trailer) iff (SNM-33 / D-22-01):

- A plugin status is in `{installed, updated, reinstalled, uninstalled}`, or
- a plugin status is `disabled` AND the cascade is dispatched with the `disable-cascade` kind -- the `/claude:plugin disable` command's realized-transition cascade (v1.12 milestone UAT-03 decision, 2026-06-11).

The principle: marketplace records are bookkeeping, not Pi-visible resources; only plugin rows (skill / agent / command / MCP entry) are. A marketplace status alone (`added`, `removed`, `updated`, `autoupdate enabled`, `autoupdate disabled`) never warrants a `/reload` -- the trailer fires only when a plugin row carries a state-change token. A `failed` marketplace does NOT trigger the trailer (rolled-back state has nothing to reload). A failed-only cascade (no successful or state-changing rows) also suppresses the trailer.

The `installed` token straddles two surfaces: a list-only steady-state inventory row (emitted by `/claude:plugin list` for already-installed plugins) and a cascade-context install transition. On the list / info inventory surfaces it is deliberately ABSENT from the plugin-status trigger set, resolving its inventory-vs-transition straddle structurally at the KIND level: hint-free on kind-less / `cascade` payloads (the list / info inventory surfaces), trigger on the install cascade. This keeps `shouldEmitReloadHint`'s contents-derived decision unambiguous per SNM-15: within a given cascade kind, every status discriminator either always triggers or never triggers. The `disabled` token resolves its inventory-vs-transition straddle the same way (UAT-03): hint-free on kind-less / `cascade` payloads (the list / info inventory surfaces), trigger on `disable-cascade` payloads (the disable command's fresh cascade) -- mirroring the `reconcile-applied-cascade` kind's structural trailer exclusion. See UAT gap G-21-01 in `.planning/phases/21-final-teardown-green-gate/21-HUMAN-UAT.md` for the failure mode the original split closes.

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

The summary counts the operations that drive the severity, by stamped severity, across both plugin and marketplace subjects:

| Severity  | Counts (D-02 / SEV-02)                                                      | Verb phrase                          |
| --------- | --------------------------------------------------------------------------- | ------------------------------------ |
| `error`   | plugin rows + marketplace rows with caller-stamped `severity === "error"`   | `has failed` / `have failed`         |
| `warning` | plugin rows + marketplace rows with caller-stamped `severity === "warning"` | `needs attention` / `need attention` |

Wording (OUT-02 / D-02): `[A|Some] <subject> operation[s] has/have failed | needs/need attention.` -- `subject` is `plugin` or `marketplace`; `A` for a single row, `Some` for more than one; `operation` / `operations` pluralized by count; `has failed` / `have failed` for error and `needs attention` / `need attention` for warning; terminal period kept. D-03: when a cascade's rows span BOTH plugin and marketplace subjects (load-time `reconcile`, `import`) the subject noun is dropped and all rows are counted uniformly (`[A|Some] operation[s] has/have failed | needs/need attention.`), detected at render time from the live row counts. Examples: `"A plugin operation has failed."`, `"Some plugin operations have failed."`, `"A marketplace operation has failed."`, `"Some operations have failed."` (mixed-subject), `"A plugin operation needs attention."`. The summary is computed structurally from the `NotificationMessage` traversal `computeSeverity` performs -- it is not caller-supplied free text, so it does not violate the "no top-level free text" principle (D-17-09).

______________________________________________________________________

## Status token reference

The table below holds ONE row per member of the 19-member `PLUGIN_STATUSES` tuple. Two members that render the same glyph get two rows and the Icon column repeats the character: `(installed)`, `(updated)`, `(reinstalled)`, `(upgradable)`, `(partially-upgradable)` and `(will install)` / `(will enable)` all render `●`, and each keeps its own row, because the token is what the reader looks up and the glyph alone does not identify it.

| Token                    | Icon | Where it appears                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ------------------------ | ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `(installed)`            | ●    | Plugin row -- `list` (steady-state inventory), install, import cascade, reinstall (rare), update (rare). On the list surface the same token is the steady-state inventory row; it does not trigger the reload-hint per SNM-15 / G-21-01, while the install/cascade transition does.                                                                                                                                                                                                                                                         |
| `(partially-installed)`  | ◉    | Plugin row -- list / info inventory surfaces AND the install / update / enable success cascades for a recorded-installed plugin that currently re-resolves `partially-available` (FSTAT-02 / D-66-03). DERIVED, never persisted. Carries the dropped-component kinds in the brace; the success rows also thread `dependencies`, so the soft-dep markers can follow the kinds in the same brace.                                                                                                                                             |
| `(updated)`              | ●    | Plugin row -- update cascade; carries `v<from> → v<to>` version arrow.                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `(reinstalled)`          | ●    | Plugin row -- reinstall cascade.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `(uninstalled)`          | ○    | Plugin row -- uninstall single-plugin, marketplace-remove partial success rows.                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `(available)`            | ○    | Plugin row -- `marketplace list` / plugin-list surface (no scope bracket per MSG-PL-6 / SNM-11). It admits exactly one entry-derived token, the author-declared `{installs disabled}` install-time-state marker, answered from the marketplace entry in the cached manifest and never from the plugin's own `plugin.json`, which this path declines to fetch (OUT-02 / OUT-05).                                                                                                                                                             |
| `(remote)`               | ◌    | Plugin row -- list / info / install-completion surfaces for a not-installed git-source plugin whose clone/mirror is not yet materialized locally (RSTA-01 / D-80-03). No scope bracket (SNM-11), and no probe-derived or soft-dependency-derived reason brace -- no materialized tree exists to derive one from. It admits exactly one entry-derived token, the author-declared `{installs disabled}` install-time-state marker, which needs no tree because the marketplace entry is readable from the cached manifest (OUT-05 / RSTA-01). |
| `(partially-available)`  | ⊖    | Plugin row -- list / info surfaces AND the install-failure surface (XSURF-01) for a partially-available plugin (resolver `partially-available`: LSP / hooks / unsupported component / workflows); carries `{unsupported hooks}` / `{lsp}` / `{unsupported component}` / `{workflows}`. A normal install rejects this arm. With `--partial`, the install materializes its supported subset (USTAT-01 / D-64-01); the install-failure row carries the `--partial` hint trailer.                                                               |
| `(unavailable)`          | ⊘    | Plugin row -- install / reinstall / import / list / info surfaces for a STRUCTURALLY-unavailable plugin (malformed manifest / hooks.json, unreadable source, or a broken `mcpServers` string reference -- missing file / malformed JSON / wrapper-less / out-of-root -> `{malformed mcp}`); carries the structural reasons.                                                                                                                                                                                                                 |
| `(upgradable)`           | ●    | Plugin row -- plugin-list surface only (advisory).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `(partially-upgradable)` | ●    | Plugin row -- list inventory surface AND the manual update-decline surface (XSURF-03) for a currently-clean installed plugin whose newer no-network cache candidate would NEWLY degrade it (FSTAT-04 / D-66-02). REUSES `●` rather than `◉` because the row is clean today -- only its candidate would degrade. The decline row carries the update-worded `--partial` hint trailer; the inventory row renders byte-frozen.                                                                                                                  |
| `(failed)`               | ⊘    | Plugin row -- any failure variant; carries `reasons`, optional `cause:` trailer, optional `rollbackPartial` children.                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `(skipped)`              | ⊘    | Plugin row -- per-plugin skip inside cascades; carries `reasons` (e.g. `{up-to-date}`, `{already installed}`).                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `(manual recovery)`      | ⊘    | Plugin row -- per-plugin manual-recovery anchor inside a marketplace block; status discriminator includes the space literally.                                                                                                                                                                                                                                                                                                                                                                                                              |
| `(will install)`         | ●    | Plugin row -- `/claude:plugin pending` pending-tense install (DIFF-02).                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `(will uninstall)`       | ○    | Plugin row -- `/claude:plugin pending` pending-tense uninstall; the pre-transition analog of the realized `(uninstalled)` row.                                                                                                                                                                                                                                                                                                                                                                                                              |
| `(will enable)`          | ●    | Plugin row -- `/claude:plugin pending` pending-tense enable; applies on next reload.                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `(will disable)`         | ◍    | Plugin row -- `/claude:plugin pending` pending-tense disable.                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `(disabled)`             | ◍    | Plugin row -- list / info inventory surfaces, the `/claude:plugin disable` fresh-cascade row, and the install surfaces (`/claude:plugin install` and the load-time reconcile cascade) when the plugin's own `defaultEnabled: false` declaration made the install land disabled; the install surfaces carry `{installs disabled}` and the enable-hint trailer, the others render bare.                                                                                                                                                       |

Marketplace status tokens (drawn from the 7-member `MARKETPLACE_STATUSES` tuple; the `autoupdate enabled` / `autoupdate disabled` statuses render the marker-as-outcome forms `<autoupdate>` / `<no autoupdate>` per UXG-04 rather than parenthesised tokens):

| Token       | Icon | Where it appears                                                                                                                               |
| ----------- | ---- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `(added)`   | ●    | Marketplace header -- `marketplace add`, `bootstrap`, import cascade.                                                                          |
| `(removed)` | ●    | Marketplace header -- `marketplace remove` clean.                                                                                              |
| `(updated)` | ●    | Marketplace header -- `marketplace update`.                                                                                                    |
| `(failed)`  | ⊘    | Marketplace header -- `marketplace add` failure, `marketplace remove` partial, `marketplace update` failure, `marketplace autoupdate` failure. |
| `(skipped)` | ●    | Marketplace header -- mp-level skip (e.g. `{up-to-date}`); the autoupdate-idempotent reasons render the marker-as-outcome form instead.        |

______________________________________________________________________

## `/claude:plugin list`

Plugin-list surface. Marketplaces render as list-surface headers (`mp.status === undefined`); `mp.details.autoupdate` drives the `<autoupdate>` marker; plugin rows indent two spaces beneath.

The optional filter flags (`--installed`, `--available`, `--unavailable`, `--partial`) select buckets by union; with no flag every bucket renders. They partition cleanly (LIST-01 / D-67-01): `--installed` spans the full installed inventory -- `installed`, `upgradable`, `disabled`, and the derived `partially-installed` / `partially-upgradable` rows; `--available` selects not-installed installable plugins; `--partial` selects not-installed plugins that resolve `partially-available` (the partially-available candidates); `--unavailable` selects only structurally-unavailable plugins. The list surface de-collapses the render token by resolver state (USTAT-01 / D-64-01): a not-installed plugin resolving `partially-available` renders `(partially-available)` / `⊖`, while a structurally-unavailable plugin renders `(unavailable)` / `⊘`. The `--partial` / `--unavailable` filters key on the internal resolver-state bucket, which is independent of the render token (so the partition is unaffected by the token split). There is no `--upgradable` filter.

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
  ⊘ delta (unavailable) {unsupported hooks}
  ⊖ epsilon (partially-available) {unsupported hooks, lsp}
  ○ gamma v2.0.0 (available)
```

Notes:

- Marketplace header is SUB-BRANCH B (list-surface with `details.autoupdate: true`); `<autoupdate>` follows the scope bracket.
- Plugin rows carry no scope bracket -- the variants either have no `scope` field (`available` / `partially-available` / `unavailable`) or `p.scope === mp.scope`.
- `epsilon` resolves `partially-available` (carries `lsp`), so it renders the de-collapsed `(partially-available)` / `⊖` token; `delta` models a structurally-malformed plugin and keeps `(unavailable)` / `⊘` (USTAT-01 / D-64-01).
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
A marketplace operation has failed.

● other-mp [user] <autoupdate>
  ● helper v1.0.0 (installed)

⊘ unparseable-mp [user] (failed)
```

When a marketplace's manifest fails to parse, the marketplace renders as a bare `(failed)` header at column 0; the other parseable marketplaces in the list render normally. `notify()` does not emit a marketplace-level `cause:` trailer for failed marketplaces with empty `plugins: []` -- the v2 type model places `cause?: Error` on plugin variants only. Orchestrators wanting to surface the parse error must construct the payload as a per-plugin failed/manual-recovery row carrying the diagnostic as `cause?: Error`, or include a per-plugin error row inside the failed marketplace block. Severity: `error` (any failed → error). No reload-hint trailer fires on the list surface: the failed marketplace header is not in the marketplace-status trigger set (per D-16-12 + the SNM-15 ladder), and the other marketplace's `installed` plugin row is, on the list surface, the steady-state inventory token deliberately excluded from the trigger set (UAT gap G-21-01).

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

The plugin's persisted version is the PI-7 content hash `hash-2ea95f85703d`; the list row renders it as the git-style short SHA `v#2ea95f8` (first 7 of the 12 hex chars). Persistence is unchanged -- `state.json` retains the full `hash-2ea95f85703d` (PI-7 intact, no migration); the short form is renderer-only (SNM-35, D-23-04). The `installed` inventory row carries no `/reload` trailer on the list surface.

### Sha-version inventory row (git-source short-SHA display)

<!-- catalog-state: sha-version-list -->

```text
● official [user]
  ● git-plugin v#a1b2c3d (installed)
```

A git-source plugin (url / git-subdir / github) records its version as `sha-<12hex>` from the resolved commit (D-77-01, PURL-09); the list row renders it as the git-style short SHA `v#a1b2c3d` (the `sha-` prefix is stripped and only the first 7 of the 12 hex chars are shown, matching git `--short=7`). Persistence is unchanged -- `state.json` keeps the full `sha-a1b2c3d4e5f6` version plus the full 40-hex `resolvedSha` (D-77-02); the short form is renderer-only, and it never truncates the `resolvedSha` used for later comparison. The `installed` inventory row carries no `/reload` trailer on the list surface.

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
  ⊘ delta (unavailable) {unsupported hooks}
    Unavailable plugin that still surfaces its description.
```

### Disabled inventory row (D-54-01 / ENBL-04)

<!-- catalog-state: disabled-inventory -->

```text
● official [user] <autoupdate>
  ◍ foo-plugin v1.2.3 (disabled)
```

Triggered when the state record carries the explicit `enabled: false` marker (ENBL-05: the load-bearing predicate is `persistence/state-io.ts::isRecordedButDisabled`, which reads that boolean alone). Availability (`compatibility.installable`) is an ORTHOGONAL axis and is not part of the marker, so a partially-installed record the user disabled renders this same row -- ENBL-06, and the reason why no `(partially-installed)`-style brace appears on it. The `(disabled)` token is the new closed-set `PluginStatus` token (D-54-01); the row uses the `◍` glyph (D-80-01: reassigned from `◌`, which now marks `(remote)`; shared with `will disable` to match the realized/pending-tense precedent: `●` for `(installed)` / `(will install)`, `○` for `(available)` / `(will uninstall)`). Structurally distinct from `(unavailable)`: the byte form differs (`(disabled)` vs `(unavailable)`). The row carries at most ONE reason, `{not in manifest}`, and it carries that one only in the state below (ENBL-16 / D-100-07, which supersedes INV-04's "never carries a reason brace" clause); every other reason stays off a disabled row. The recorded version pin (ENBL-02) is preserved and rendered in the `v<version>` slot. Severity `info`; no reload-hint (inventory row, not a state-changer). The `/claude:plugin disable` command's fresh cascade reuses this exact row byte form WITH the reload-hint trailer via the `disable-cascade` kind (UAT-03; see [`## /claude:plugin disable`](#claudeplugin-disable-pluginmarketplace)); the fresh-disable site stamps no reason, so that row stays bare.

PL-4: when the manifest entry carries a non-empty `description` field, the renderer emits it on a second line indented four spaces beneath the plugin row. Descriptions longer than 66 characters are truncated to 63 characters and suffixed with `"..."` (landing exactly at column 66). Nine list-surface variants (`installed`, `upgradable`, `available`, `remote`, `partially-available`, `partially-installed`, `partially-upgradable`, `unavailable`, `disabled`) support the description field; the cascade-only variants (`updated`, `reinstalled`, `uninstalled`) do not. The count mirrors a runtime authority rather than a hand-kept list: a variant supports the line exactly when its message interface in `extensions/pi-claude-marketplace/shared/notify.ts` declares `description?`, and the two degraded-inventory variants (`PluginPartiallyInstalledMessage`, `PluginPartiallyUpgradableMessage`) are what last moved it off seven. The renderer emits the description line only when the field is defined and non-empty.

### Disabled inventory row with a description (PL-4)

<!-- catalog-state: disabled-inventory-with-description -->

```text
● official [user] <autoupdate>
  ◍ foo-plugin v1.2.3 (disabled)
    Disabled plugin that still surfaces its description.
```

### Disabled inventory row -- not in manifest (ENBL-16 / D-100-07)

<!-- catalog-state: disabled-inventory-not-in-manifest -->

```text
● official [user] <autoupdate>
  ◍ foo-plugin v1.2.3 (disabled) {not in manifest}
```

Two conditions cause this row. The state record carries the explicit `enabled: false` marker, and the marketplace manifest loaded successfully but does not declare the plugin.

`{not in manifest}` is the only reason a disabled row on THIS surface can carry. The governing rule: render durable facts that constrain what the user can do next; suppress facts about runtime behavior that is currently suspended. Manifest absence is such a durable fact. `/claude:plugin enable` re-runs the install ledger, and that ledger resolves the plugin from the marketplace manifest. Thus the user cannot re-enable a disabled plugin the manifest no longer declares. The bare row gave no warning before the attempt.

Every other reason stays off this row. A disabled record whose install-time resolution dropped a component kind keeps its unsupported-kind tokens hidden. The soft-dependency markers `{requires pi-subagents}` and `{requires pi-mcp}` cannot appear either: the renderer passes both soft-dependency flags as `false` (ENBL-15 / D-100-06). Disable preserves the record's component inventory (ENBL-18), but that inventory cannot change these bytes.

This surface builds the row from the installation record alone and reads no source, thus manifest absence is the only reason it ever HAS. The `info` surface applies the same rule to a larger set of facts, because it also reads disk: a disabled row there can additionally carry the failure class (`source missing`, `unreadable`, `permission denied`, `network unreachable`, `authentication required`). Those name a source the next `enable` cannot read, thus they limit the next action in the same way manifest absence does. See the `state-only-disabled-with-components` state under `## /claude:plugin info <plugin>@<marketplace>`.

A manifest that failed to load backs no absence claim (BOUND-01 / D-95-05). Such a marketplace renders a bare `(failed)` header with no plugin rows. Severity `info`; no reload-hint (inventory row, not a state-changer).

### Available inventory row that would install disabled (OUT-02 / DFEN-04)

<!-- catalog-state: available-installs-disabled -->

```text
● official [user] <autoupdate>
  ○ helper v1.0.0 (available) {installs disabled}
```

A not-installed plugin whose marketplace ENTRY declares `defaultEnabled: false` carries the closed-set `{installs disabled}` token on its `(available)` row, so the reader sees the author's install-time declaration BEFORE running the install rather than after it. Two declarations decide the token, in the order `install` itself applies them. Your own `enabled` value for the plugin in `claude-plugins.json` wins: where you have set one, in either direction, the marketplace default does not apply and the row stays bare. Where you have set none, the marketplace entry answers -- and it is readable from the cached `marketplace.json` for every declared plugin whatever its clone state, so this row reads no source tree and fires no network call to make the claim. The post-install row for the same plugin is the `install-disabled` state under `## /claude:plugin install <plugin>@<marketplace>`; the two blocks side by side are the whole story of the token for `helper`. Severity `info`; no reload-hint (inventory row) -- and for a different reason than the install row's: there the desired state WAS reached, while here nothing has happened at all, so the row states a fact about a future action rather than a shortfall of a completed one.

### Remote inventory row (RSTA-01 / D-80-03)

<!-- catalog-state: remote-inventory -->

```text
● official [user] <autoupdate>
  ◌ git-plugin v1.2.3 (remote)
```

A not-installed git-source plugin (source `url` / `git-subdir` / `github`) whose clone/mirror is not yet materialized locally renders `(remote)` instead of the manifest-only `(available)` over-claim (RSTA-01). The row uses the dedicated `◌` glyph (`ICON_REMOTE`, U+25CC), reassigned from the disabled rows which now wear `◍` (D-80-01). Bare row: no scope bracket (SNM-11 carve-out family, joining `available` / `partially-available` / `unavailable`), and no reasons brace. What the row excludes is every reason derived from a tree it does not have -- probe-derived reasons and the soft-dependency markers alike. The closed REASONS set still does not grow either way (parity with `available`, D-80-03), but that is no longer what keeps this row bare. The one token the row family now admits is derived from the marketplace ENTRY rather than from a tree, and this block's own fixture entry declares nothing, which is why its bytes are unchanged; for the declaring case see the `remote-installs-disabled` state below (OUT-05 / RSTA-01). Severity `info`; no reload-hint (inventory row).

### Remote inventory row with a description (PL-4)

<!-- catalog-state: remote-inventory-with-description -->

```text
● official [user] <autoupdate>
  ◌ git-plugin v1.2.3 (remote)
    Remote git-source plugin not yet fetched locally.
```

Same `remote-inventory` row as above, now carrying a `description`. The PL-4 second line renders identically to the other list-surface variants: 4-space indent, truncated at column 66. Severity `info`; no reload-hint.

Same `disabled-inventory` row as above, now carrying a `description`. The PL-4 second line renders identically to the other list-surface variants (`installed` / `upgradable` / `available` / `unavailable`): 4-space indent, truncated at column 66. The disabled inventory row is steady state, so severity stays `info` and no reload-hint fires.

### Remote inventory row that would install disabled (OUT-02 / OUT-05 / RSTA-01)

<!-- catalog-state: remote-installs-disabled -->

```text
● official [user] <autoupdate>
  ◌ git-plugin v1.2.3 (remote) {installs disabled}
```

The same not-yet-materialized git-source plugin as the `remote-inventory` row above, whose marketplace ENTRY declares `defaultEnabled: false`. This NARROWS that block's bare-row rule rather than reversing it (OUT-05 / RSTA-01). The row still refuses every probe-derived reason and both soft-dependency markers, because no materialized tree exists to derive either from; it admits exactly one declaration-derived token, on the terms the `available-installs-disabled` state above sets out. That token needs no tree at all, which is what lets the reader furthest from having fetched anything still see the author's install-time declaration. Severity `info`; no reload-hint (inventory row): nothing has happened at all, so the row states a fact about a future action rather than a shortfall of a completed one.

### Partially-installed inventory row (FSTAT-02 / D-66-03)

<!-- catalog-state: partially-installed-inventory -->

```text
● official [user] <autoupdate>
  ◉ degraded-plugin v1.0.0 (partially-installed) {lsp}
```

A recorded-installed plugin that currently re-resolves `partially-available` (installed with one or more components dropped) is DERIVED as `partially-installed` -- no persisted flag, no migration (FSTAT-01 / D-66-01). The row uses the dedicated `◉` glyph (`ICON_PARTIALLY_INSTALLED`), DISTINCT from the clean `(installed)` row's `●` so the degraded install is visually separable (FSTAT-02). The reasons brace carries the degradation detail, composed exactly like the `upgradable` row. Severity `info`; no reload-hint (inventory row). Once a fully-supported upgrade rewrites the recorded resolution the same deriver yields `(installed)` with no lingering state (FSTAT-03).

### Workflow partially-available inventory row (WDET-04)

<!-- catalog-state: workflow-partially-available-inventory -->

```text
● official [user]
  ⊖ helper v1.0.0 (partially-available) {workflows}
```

A workflow-bearing plugin uses the existing partial status before installation. The row has info severity and no hint or reload trailer.

This state adds no workflow-specific glyph, heading, or wrapping rule.

### Partially-installed inventory row -- partial-hook plugin (FSTAT-02 / PHOOK-04 / PHOOK-05 / D-71-04)

<!-- catalog-state: partially-installed-inventory-hooks -->

```text
● official [user] <autoupdate>
  ◉ hook-plugin v1.0.0 (partially-installed) {unsupported hooks}
```

A partial-hook plugin -- one whose `hooks.json` parses and validates cleanly but declares an unsupportable event (a non-bucket-A event such as `Notification`) or matcher group -- partially installs its supported components PLUS the supportable hook handlers, staging a `hooks.json` that is a strict subset of the source with only the unsupportable handlers dropped (PHOOK-04). Once recorded-installed it re-resolves `partially-available` and is DERIVED as `partially-installed`, identical to any other dropped-component degrade. The `hooks` kind rides the SINGLE aggregate `{unsupported hooks}` brace regardless of how many events / matcher groups dropped (D-71-04); the per-handler `event(matcher) (unsupported)` breakdown lives on the `info` surface (D-71-05). The aggregate marker is sourced through `shared/probe-classifiers.ts::narrowUnsupportedKinds` (the typed `unsupported` kind list), distinct from the structural `narrowResolverNotes` path that an `unavailable` malformed-`hooks.json` row uses. Severity `info`; no reload-hint (inventory row).

### Partially-upgradable inventory row (FSTAT-04 / D-66-02 / D-66-03)

<!-- catalog-state: partially-upgradable-inventory -->

```text
● official [user] <autoupdate>
  ● clean-plugin v1.0.0 (partially-upgradable) {unsupported component}
```

A currently-clean installed plugin whose newer no-network cache candidate would NEWLY degrade it is DERIVED as `partially-upgradable` (FSTAT-04 / D-66-02). The candidate is resolved without network (FSTAT-05). The row REUSES the `●` glyph (`ICON_INSTALLED`) because it is clean today -- only its candidate would degrade -- mirroring the `upgradable` precedent. A plugin already `partially-installed` is never `partially-upgradable` (already degraded). This is a list-inventory-only row; severity `info`, no reload-hint.

### Manifest-absent inventory row (INV-01)

<!-- catalog-state: manifest-absent-inventory -->

```text
● official [user] <autoupdate>
  ● orphan-plugin v1.0.0 (installed) {not in manifest}
```

An installed record whose marketplace manifest LOADED successfully but does not declare it carries the `not in manifest` reason (INV-01). The inventory is manifest-independent because it is RECORD-backed: `list` enumerates the installation records in `state.json` and the manifest supplies only decoration -- the PL-5 version compare and the PL-4 description. The list surface never checks whether the record's artifacts are materialized on disk, and it does not need to: the record is the statement that the install happened, and reconcile is what keeps the disk agreeing with it. So the row keeps the clean `(installed)` token and the `●` glyph, and the brace states the one fact the manifest settles. The claim is made ONLY about a manifest that was actually READ, and it is judged against the manifest the plugin's OWN marketplace record names (INV-01) -- on the cross-scope orphan fold that is the project-side record's manifest, even though the row renders under the user-scope header. A manifest-read failure claims nothing: a same-scope failure renders the bare `(failed)` marketplace header instead (BOUND-01), and a folded row whose own manifest failed to read keeps its bare `(installed)` form with no brace (BOUND-03 / D-95-05). A folded row describes the manifest that its own record names. This rule applies to the absence claim, the upgradable derivation and the description (D-96-02). If a marketplace cannot read its own manifest, the block shows the bare `(failed)` header with no child rows, and it also hides the folded rows that come from the other scope (BOUND-01). Severity `info`; no reload-hint (inventory row).

### Manifest-absent partially-installed inventory row (INV-02)

<!-- catalog-state: manifest-absent-partially-installed-inventory -->

```text
● official [user] <autoupdate>
  ◉ degraded-plugin v1.0.0 (partially-installed) {not in manifest, lsp}
```

A degraded record that is ALSO absent from a manifest that loaded prepends `not in manifest` to the dropped-component kinds (INV-02). The absence reason comes first because it describes the record's relationship to the marketplace, and the kinds describe the install itself; `narrowUnsupportedKinds` stays the sole producer of the kind tokens. The row keeps the `◉` glyph and the `partially-installed` token -- manifest absence is a separate axis from degradation and never changes the status. Severity `info`; no reload-hint (inventory row).

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
A plugin operation needs attention.

● official [user]
  ● helper v1.0.0 (installed) {requires pi-subagents, requires pi-mcp}

/reload to pick up changes
```

`helper` declares both `agents` and `mcp` dependencies; the probe reports both companion extensions unloaded so both markers fire inside one brace block (D-16-15). SEV-01: a declared companion that is unloaded silently degrades an otherwise-clean install, so the success row stamps `warning` and the cascade carries the `needs attention` summary line. The per-row bytes are unchanged from the info form -- only the severity (and therefore the summary line) moves.

### Success with orphan-rewake warning (SURF-05 / D-63-08)

<!-- catalog-state: success-with-orphan-rewake -->

```text
● official [user]
  ● helper v1.0.0 (installed) {orphan rewake}

/reload to pick up changes
```

`helper`'s `hooks/hooks.json` declares `rewakeMessage` or `rewakeSummary` on at least one handler WITHOUT `asyncRewake: true`. The companion field is admitted at the schema layer (HOOK-06 / EXEC-05) but produces no runtime effect; the install warns via the closed-set `{orphan rewake}` reason on the otherwise-successful install row. One row per plugin regardless of N orphan handlers. Severity `info` -- the install still succeeds.

### Success with orphan-rewake AND a soft-dep marker in the same brace

<!-- catalog-state: success-with-orphan-rewake-and-soft-dep -->

```text
A plugin operation needs attention.

● official [user]
  ● helper v1.0.0 (installed) {orphan rewake, requires pi-subagents}

/reload to pick up changes
```

The closed-set REASONS token and the soft-dep marker share ONE brace block per MSG-GR-4. The `composeReasons` helper appends the soft-dep markers AFTER the typed `reasons[]` so the orphan-rewake token leads. SEV-01: the declared `pi-subagents` companion is unloaded, so the success row stamps `warning` and the cascade carries the `needs attention` summary line (the per-row bytes are unchanged from the info form).

### Partial-install success with a soft-dep marker (WR-03)

<!-- catalog-state: success-partially-installed-with-soft-dep -->

```text
A plugin operation needs attention.

● official [user]
  ◉ helper v1.0.0 (partially-installed) {lsp, requires pi-subagents}

/reload to pick up changes
```

A `--partial` install that succeeds with one or more components dropped (the resolver's `partially-available` arm) renders the `(partially-installed)` row with the dedicated `◉` glyph. The partially-available arm still stages the SUPPORTED components, so a `(partially-installed)` success row carries `dependencies` exactly like a clean `(installed)` row (WR-03). With the `agents` companion extension unloaded the soft-dep marker fires inside the SAME brace as the dropped-component reason -- `composeReasons` appends the `{requires pi-...}` markers AFTER the typed `reasons[]` (MSG-GR-4), so the dropped-component token leads: `{lsp, requires pi-subagents}`. partially-installed is a realized transition, so the reload-hint fires (the caller stamps `needsReload: true`). SEV-01: the unloaded `agents` companion is a silent degradation independent of the dropped components, so the success row stamps `warning` and the cascade carries the `needs attention` summary line (the per-row bytes are unchanged from the info partially-installed form). The direct `--partial` opt-in itself stays benign info -- the warning here is the missing companion, not the partial install.

### Workflow partial-install success (WDET-04)

<!-- catalog-state: workflow-partial-install-success -->

```text
● official [user]
  ◉ helper v1.0.0 (partially-installed) {workflows}

/reload to pick up changes
```

Explicit partial consent installs the supported components. The existing reload trailer appears because the command changed the installed resources.

### Install that lands disabled (DFEN-04 / OUT-01 / OUT-04)

<!-- catalog-state: install-disabled -->

```text
● official [user]
  ◍ helper v1.0.0 (disabled) {installs disabled}
    Run enable on this plugin to use its components.
```

The plugin's own manifest entry declares `defaultEnabled: false` and the user's config states no opinion, so the ledger ran whole and the disable half then unstaged everything it staged. The `◍` row names the author-declared cause through the closed-set `{installs disabled}` token and carries the frozen enable-hint trailer, which interpolates nothing (T-69-01). Severity `info` -- the desired state WAS reached, because an install-disabled plugin is the author's declared intent, not a shortfall. No reload hint: nothing net entered or left Pi's resource view inside the command.

### Install that lands disabled over a degraded ledger run (WARN-01 / FSTAT-07)

<!-- catalog-state: install-disabled-degraded -->

```text
A plugin operation needs attention.

● official [user]
  ◍ helper v1.0.0 (disabled) {installs disabled, malformed skill, unsupported component}
    Run enable on this plugin to use its components.
```

The same row over a `--partial` install whose skill frontmatter could not be parsed. The cause leads and the durable degradation facts follow it in the same brace: both constrain what the `enable` this row advertises would produce, so suppressing them would leave the user with no surface for them at all (standalone mode drops `postCommitWarnings` per D-19-01). The frontmatter degrade is a shortfall this ledger run just produced, so the row stamps `warning` and the cascade carries the summary line. The soft-dep markers stay suppressed whatever the record retained (ENBL-15 / D-100-06) -- that concern is suspended while the plugin is disabled.

### Failure -- unsupported features in manifest (partially-available)

<!-- catalog-state: failure-unsupported-features -->

```text
A plugin operation has failed.

● official [user]
  ⊖ helper (partially-available) {unsupported hooks, lsp}
    Re-run with --partial to install the supported components.
```

The manifest declares Claude features Pi doesn't support, but the plugin is otherwise structurally sound, so the resolver verdict is the partially-available arm (SEV-02 / D-69-03 / XSURF-01). The install-failure surface renders the resolver-state-driven `(partially-available)` token with the dedicated `⊖` glyph -- consistent with how `list` / `info` describe the same plugin -- not the `⊘ (unavailable)` token reserved for structural defects. The `partially-available` variant has no `scope` field (SNM-11) so the plugin row carries no bracket; reasons name the offending fields verbatim. Because `--partial` can degrade-install the supported components, the row carries a 4-space-indented `--partial` hint trailer pointing the user at the flag, and the install renders at `error` severity (so the leading summary line fires). No `cause:` trailer -- the reason carries the explanation. No reload-hint (nothing landed). The hint references the user's own flag only, with no plugin/marketplace interpolation (T-69-01); the byte-exact wording is FROZEN as the DOC contract (D-70-01) and locked in `docs/messaging-style-guide.md`.

### Workflow install rejection (WDET-04)

<!-- catalog-state: workflow-install-rejection -->

```text
A plugin operation has failed.

● official [user]
  ⊖ helper (partially-available) {workflows}
    Re-run with --partial to install the supported components.
```

A normal install rejects the workflow-bearing plugin. With `--partial`, the install admits the partial arm and materializes only its supported components. A rejected install uses the existing error summary and partial-install hint, with no reload trailer.

### Failure -- structurally unavailable (`--partial` cannot help)

<!-- catalog-state: failure-structural-unavailable -->

```text
A plugin operation has failed.

● official [user]
  ⊘ helper (unavailable) {unsupported source}
```

The plugin has a structural defect (e.g. a missing source directory), so the resolver verdict is the `unavailable` arm -- `--partial` cannot degrade-install a structural defect (SEV-02 / D-69-03 / D-70-02). The row carries NO `--partial` hint trailer, but it still renders at `error` severity (so the leading summary line fires) because an install failure must read as an error, not a benign info row. The `unavailable` variant has no `scope` field (SNM-11) so the plugin row carries no bracket; the reason names the structural defect. No reload-hint (nothing landed). This install-failure error stamp is caller-stamped on the row by `composeUnavailableMessage`; the SAME `unavailable` variant continues to render at info on the list surface, where rows omit `severity`.

### Failure -- runtime error with cause chain

<!-- catalog-state: failure-runtime-with-cause -->

```text
A plugin operation has failed.

● official [user]
  ⊘ helper v1.0.0 (failed) {permission denied}
    cause: state.json at /path/to/state.json is not valid JSON: Unexpected token n in JSON at position 0
```

`failed` plugin variant carrying `cause?: Error`. The cause-chain trailer renders at 4-space indent below the plugin row (D-16-08). Multi-link causes use `->` between links (depth-bounded to 5 per MSG-CC-1). Severity: `error`. No reload-hint (no state-changing status; failed alone does not trigger).

### Failure with rollback-partial children

<!-- catalog-state: failure-rollback-partial -->

```text
A plugin operation has failed.

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

Triggered when `install <plugin>@<marketplace>` names a marketplace that is NOT added in the target scope and the CMP-3 project-to-user fallback ALSO misses. The failure subject is the MARKETPLACE, not the plugin: the orchestrator emits the standalone Phase 46 `MarketplaceNotAddedMessage` variant (`kind: "marketplace-not-added"`, `name` set to the marketplace name) -- NOT `{not in manifest}` on a plugin row. This is the ATTR-08 split: "marketplace absent" reads `{marketplace not added}` on the marketplace subject, while "plugin absent from a PRESENT manifest" stays `{not in manifest}` on the plugin row (the `failure-runtime-with-cause` / PI-3 path). install always has a resolved scope (the edge defaults it), so the row always carries the `[scope]` bracket communicating "not added in the scope you asked for" (SCOPE-01). Two-block form: the `A marketplace operation has failed.` summary on the host `Error:` label line, then the bare column-0 detail row as its own block (GRAM-01 / GRAM-02). No cause-chain trailer. Severity `error`; no reload-hint.

<!-- catalog-state: missing-marketplace-not-added -->

```text
A marketplace operation has failed.

⊘ ghost-mp [project] (failed) {marketplace not added}
```

### Failure -- marketplace not added, cross-scope (CMP-4 / SCOPE-01)

The same failure as above, with a DIFFERENT structural reason token, emitted when the marketplace CONTAINER is registered in the scope the command did NOT target. The bare row above says only that the container is absent; these two say it exists one scope over. The command still FAILS in both directions -- there is no retarget -- and the `error` severity and the summary line are unchanged. A miss in BOTH scopes renders the bare row above byte-for-byte.

The qualified token REPLACES `marketplace not added` rather than joining it. The two are competing structural claims about one subject -- the plain token says the container does not exist, the qualified one says it exists but not where the command looked -- so a brace carrying both would state both.

A qualified token requires a `[scope]` bracket. An ABSENT bracket means the caller consulted BOTH scopes and both missed (D-03), so there is no other scope left to be present in and the plain token is the only truthful one.

The token names the scope that MISSED, matching the bracket beside it. It is a reason, and reasons in this catalog describe state; the remedy (`--scope <other>`, or `marketplace add` at the target scope) is left to the operator, which is what keeps one token usable by every verb that renders this row rather than only by `install`.

Two-block form: the `A marketplace operation has failed.` summary on the host `Error:` label line, then the detail row, separated by one blank line, both at column 0. Severity `error`; no reload-hint.

**User target, container at project.** The repo-bundled-marketplace case: `install <plugin>@<marketplace>` with no `--scope` targets `user` and the marketplace is registered only at `project`. D-29 is Locked, so a user-target install may source only from user scope (CMP-4) -- no fallback, no retarget.

<!-- catalog-state: missing-marketplace-not-added-cross-scope -->

```text
A marketplace operation has failed.

⊘ mp [user] (failed) {marketplace not added to user scope}
```

**Project target, container at user.** Reachable from every verb EXCEPT `install`: the CMP-3 fallback lets a project-target install source a user-scope marketplace and adopt it into project scope, so `install` never renders this row. `info`, `update`, `reinstall`, `uninstall`, `enable`, `disable`, `marketplace info`, `marketplace update` and `marketplace remove` carry no such fallback and miss.

<!-- catalog-state: missing-marketplace-not-added-cross-scope-project -->

```text
A marketplace operation has failed.

⊘ mp [project] (failed) {marketplace not added to project scope}
```

### Failure -- a name a DISABLED plugin still owns (ENBL-18)

The pre-flight cross-plugin guard refuses an install when a generated skill, command, or agent name belongs to a different plugin in the same scope. A DISABLED plugin is such an owner. Disable keeps the installation record and its component inventory (ENBL-18), thus the names stay reserved even though the disable deleted every artifact from disk.

The reservation is deliberate. It is what lets `/claude:plugin enable` re-take the plugin's own names later, and what stops an `uninstall` of the disabled plugin from removing an artifact that a second plugin installed under the same name in the meantime.

The refusal is otherwise unexplainable from disk, because the name occupies no file. Thus the conflict line names the owner as disabled: `skill "a-foo" already owned by disabled plugin "alpha"`. An enabled owner keeps the shorter form: `skill "g-foo" already owned by plugin "gamma"`. The remedy is `/claude:plugin uninstall <owner>@<marketplace>`, which removes the record and releases the names. The row form is unchanged -- this text rides the `cause:` trailer of the `failure-runtime-with-cause` state above. Severity `error`; no reload-hint (nothing landed).

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
A plugin operation has failed.

● official [user]
  ⊘ helper v1.0.0 (failed) {permission denied}
    cause: EACCES: permission denied, unlink '/path/to/file'
```

Marketplace header is bare (SUB-BRANCH A); plugin row is `failed` with the typed `permission denied` reason and a 4-space-indent `cause:` trailer (D-16-08). Severity: `error`. No reload-hint -- no state-changing status (a failed uninstall did not remove anything, so there is nothing to reload).

### Failure -- marketplace not added (ATTR-04 / SCOPE-01)

Triggered when `uninstall <plugin>@<marketplace>` names a marketplace that was NEVER added in EITHER scope. A marketplace present only in the OTHER scope does NOT reach this state (SCOPE-01): nothing is installed at the requested scope, so the row's subject is the PLUGIN and it renders the `already-gone-cross-scope` state below. Naming the marketplace there would misdirect -- adding it at the requested scope would not make the uninstall succeed -- while a marketplace absent from BOTH scopes keeps this row so a typo'd marketplace name is not disguised as a plugin that merely is not installed. ATTR-04 makes this LOUD: the orchestrator emits the standalone `MarketplaceNotAddedMessage` variant (`{marketplace not added}` on the marketplace subject) instead of the former silent no-output. This is DISTINCT from the PU-5 already-gone path for a plugin record whose marketplace IS present (covered by the `already-gone-not-installed` state below). The `[scope]` bracket carries the REQUESTED scope: for an explicit `--scope` (or an other-scope-only target) the bracket communicates "not added in the scope you asked for" (SCOPE-01); the operator infers the other scope. A bare lifecycle form that misses in BOTH scopes carries no bracket. Two-block form: the `A marketplace operation has failed.` summary on the host `Error:` label line, then the bare column-0 detail row as its own block (GRAM-01 / GRAM-02). Severity `error`; no reload-hint.

<!-- catalog-state: missing-marketplace-not-added -->

```text
A marketplace operation has failed.

⊘ ghost-mp [user] (failed) {marketplace not added}
```

### Failure -- already gone, plugin not installed (D-01 / PU-5)

Triggered when `uninstall <plugin>@<marketplace>` names a marketplace that IS added in the requested scope, but the plugin row is already absent from `state.json` (never installed, or concurrently uninstalled by another process). D-01: the STANDALONE user command names an absent target it cannot operate on, so it now reports an `error` row (`(failed) {not installed}`) instead of the former literal silence -- a `failed` row because uninstall's render map renders `uninstalled` / `failed` only. The ORCHESTRATED reconcile-apply converge stays SILENT (WR-06 / NFR-2: a reconcile racing another process never reports an uninstall it did not perform). No `cause`, so no cause-chain trailer; severity `error`, no reload-hint (nothing changed).

<!-- catalog-state: already-gone-not-installed -->

```text
A plugin operation has failed.

● official [user]
  ⊘ helper (failed) {not installed}
```

### Failure -- not installed, marketplace one scope over (SCOPE-01)

Triggered when `uninstall <plugin>@<marketplace> --scope <scope>` names a scope whose state.json holds no such marketplace container, while the OTHER scope does. Nothing of that marketplace is installed at the named scope, so the PLUGIN is the row's subject (a marketplace absent from BOTH scopes keeps `missing-marketplace-not-added` instead). The brace carries the container's real scope beside `not installed`, because the remedy differs from the `already-gone-not-installed` state above: there the container is here and the fix is that the record is simply gone; here the fix is to target the other scope or add the marketplace at the one named. `marketplace in project scope` is a CONTENT reason and JOINS `not installed` rather than replacing it, unlike the structural `marketplace not added*` markers. The scope word names where the container IS, always the OPPOSITE of the row's `[scope]` bracket. The row keeps uninstall's `failed` token (its render map has no `skipped` arm). Severity `error`; no reload-hint.

<!-- catalog-state: already-gone-cross-scope -->

```text
A plugin operation has failed.

● official [user]
  ⊘ helper (failed) {not installed, marketplace in project scope}
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

Plugin reinstall: 2 successes

/reload to pick up changes
```

Bare marketplace header (no status, no details). Plugin status `reinstalled` triggers reload-hint per D-16-12. OUT-03/D-04: the bulk reinstall is a plural operation, so the trailing tally (`Plugin reinstall: 2 successes`) sits between the body and the reload-hint; the two `reinstalled` plugin rows are the two successes (the bare marketplace header is bookkeeping, not counted).

### Success with soft-dep markers

<!-- catalog-state: success-with-soft-dep -->

```text
● official [user]
  ● alpha v1.0.0 (reinstalled) {requires pi-subagents, requires pi-mcp}

Plugin reinstall: 1 success

/reload to pick up changes
```

The `reinstalled` variant carries `dependencies` (D-15-02); both markers fire because both companions are unloaded. OUT-03/D-04: the single `reinstalled` row is the one success in the plural-operation tally.

### Reinstall with a degraded component (WARN-01 / D-86-03 / WR-09)

<!-- catalog-state: reinstall-degraded-component -->

```text
A plugin operation needs attention.

● official [user]
  ● alpha v1.0.0 (reinstalled) {malformed skill}

Plugin reinstall: 1 warning

/reload to pick up changes
```

A reinstall drives the same bridges as an install, so a skill or command whose source frontmatter cannot be parsed degrades identically (skill -> synthesized `disable-model-invocation` block; command -> neutralized frontmatter). The row keeps `(reinstalled)` -- a degraded component is reinstalled-but-short, not dropped -- and carries one `{malformed skill}` / `{malformed command}` token per kind, composed through the same `malformedReasonsForKinds` seam the install, enable and backfill rows use. Severity `warning` with the summary line, the same raise those surfaces take for the same class of degrade: this one the reinstall's own ledger just produced. OUT-03/D-04: the tally counts by STAMPED severity, so the raised row lands in `1 warning` rather than `1 success` -- the operation completed, short of ideal, and the tally says so without a second vocabulary. Both reinstall row composers (the standalone verb and the bulk cascade mapper) read the one signal, so the two surfaces cannot disagree. A clean reinstall renders the brace-less rows above unchanged.

### Reinstall over an already-disabled record inside a cascade (ENBL-05 / ENBL-18 / DFEN-07)

<!-- catalog-state: reinstall-disabled-record-cascade -->

```text
● official [user]
  ● alpha v1.0.0 (reinstalled)
  ⊘ beta (skipped) {already disabled}

Plugin reinstall: 2 successes

/reload to pick up changes
```

A cascade reaching a plugin whose record carries the explicit `enabled: false` marker (ENBL-05) short-circuits before the resolve instead of re-staging, so a verb invoked to repair a plugin cannot silently turn it back on. Nothing is re-materialized and nothing is written: the record is left exactly as the disable wrote it, its `resources.*` component inventory included (ENBL-18), and that retained inventory is bookkeeping rather than evidence that anything sits on disk. Severity is `info` -- the outcome is benign and idempotent, and with every row informational the cascade emits no summary line at all. The reload-hint still fires, because the sibling `(reinstalled)` row IS state-changing. OUT-03/D-04: the plural tally counts the informational skip as a success alongside the reinstalled row, so a cascade that re-materialized one plugin reports `2 successes`; that is the tally's severity rule (idempotent -> info per D-01), not a miscount. The standalone verb renders the same skipped row over the same short-circuit (DFEN-07), but at single cardinality the tally composer returns nothing and the row stands alone -- byte-identical to the update surface's disabled-record refresh block, which is why it carries no separate state of its own.

### Single marketplace, mixed outcomes (reinstalled + skipped + failed)

<!-- catalog-state: single-mp-mixed-outcomes -->

```text
A plugin operation has failed.

● official [user]
  ● alpha v1.0.0 (reinstalled)
  ⊘ beta (skipped) {up-to-date}
  ⊘ delta (failed) {source missing}

Plugin reinstall: 1 failure, 2 successes

/reload to pick up changes
```

Mixed-outcome cascade. OUT-03/D-04: the plural tally counts the `failed` row as the one failure and the `reinstalled` + `(skipped) {up-to-date}` (idempotent -> info per D-01) rows as the two successes; zero-count categories (warnings) are omitted. Reload-hint fires because at least one plugin status is in the state-changing set (`reinstalled`). Severity: `error` (first-match wins; failed beats skipped/manual-recovery per D-16-11). `(skipped)` uses the `⊘` glyph per the renderer's switch (the renderer emits `⊘` for skipped/failed/unavailable/manual-recovery uniformly).

### Single marketplace, all failed (no reload-hint)

<!-- catalog-state: single-mp-all-failed -->

```text
Some plugin operations have failed.

● official [user]
  ⊘ alpha (failed) {source missing}
  ⊘ beta (failed) {invalid manifest}

Plugin reinstall: 2 failures
```

Failed-only cascade. OUT-03/D-04: both `failed` rows are the two failures in the plural tally; the success/warning categories are zero and omitted. No reload-hint per D-16-12 (no plugin in the state-changing set; no state-changing marketplace status). Severity: `error`.

### Plugin became unavailable after install (manifest now declares unsupported features)

<!-- catalog-state: plugin-became-unavailable -->

```text
● official [user]
  ● alpha v1.0.0 (reinstalled)
  ⊘ delta (unavailable) {unsupported hooks}

Plugin reinstall: 2 successes

/reload to pick up changes
```

Mixed-outcome cascade. `delta`'s `unavailable` variant has no scope field; row carries no bracket. OUT-03/D-04: both rows carry info severity (the `unavailable` row stamps no severity, defaulting to info per SEV-01), so the plural tally counts two successes. Reload-hint fires because `alpha` was reinstalled. Severity: info -- the `unavailable` status is not in the failed/skipped/manual-recovery set, so the severity ladder falls through to info.

### Across multiple marketplaces (bare `reinstall` form)

<!-- catalog-state: bare-multi-mp -->

```text
A plugin operation has failed.

● local-mp [project]
  ● helper v0.5.0 (reinstalled)
  ● tool v1.0.0 (reinstalled)

● official [user]
  ● alpha v1.0.0 (reinstalled)
  ⊘ beta (skipped) {up-to-date}
  ⊘ delta (failed) {source missing}

Plugin reinstall: 1 failure, 4 successes

/reload to pick up changes
```

Two marketplace blocks joined by one blank line (D-16-07). Severity: `error` (the failed `delta` row in the second block triggers the first-match ladder). OUT-03/D-04: the plural tally counts uniformly across both marketplace blocks -- one `failed` row and four info rows (three `reinstalled` + one idempotent `(skipped) {up-to-date}`) yield `1 failure, 4 successes`.

### Same marketplace name in both scopes (orphan-fold absent; per-scope blocks)

<!-- catalog-state: same-mp-both-scopes -->

```text
● official [project]
  ● alpha v1.0.0 (reinstalled)

● official [user]
  ● beta v1.0.0 (reinstalled)

Plugin reinstall: 2 successes

/reload to pick up changes
```

The marketplaces never collapse -- each per-scope header is a distinct marketplace block. OUT-03/D-04: the plural tally counts the two `reinstalled` rows across the per-scope blocks as two successes.

### Failure -- plugin not installed, standalone form (CR-02 / D-01)

Triggered when `reinstall <plugin>@<marketplace>` names a marketplace that IS added in the requested scope but whose plugin record is absent from state (never installed, or concurrently uninstalled). The standalone single-plugin path emits the absent-target row instead of returning silently: `not installed` is an absent-target precondition, so D-01 routes it to `error` ("absent-target -> error across the board") rather than the benign-skip `warning`. The row keeps its `(skipped) {not installed}` per-row grammar (severity is a stamp-only flip). Single cardinality, so no trailing tally. Two-block form: the `A plugin operation has failed.` summary on the host `Error:` label line, then the marketplace header + skipped row block (GRAM-01 / GRAM-02). No reload-hint (nothing changed on disk).

<!-- catalog-state: standalone-not-installed-error -->

```text
A plugin operation has failed.

● mp [project]
  ⊘ hello (skipped) {not installed}
```

### Failure -- not installed, marketplace one scope over (SCOPE-01)

Triggered when `reinstall <plugin>@<marketplace> --scope <scope>` names a scope whose state.json holds no such marketplace container, while the OTHER scope does. The plugin is the row's subject, and the brace names where the container really is beside `not installed`, so the row is distinguishable from the `standalone-not-installed-error` state above: there the container is here and the fix is to install the plugin, here the fix is to target the other scope or add the marketplace at the one named. `marketplace in user scope` is a CONTENT reason and JOINS `not installed` rather than replacing it. The scope word names where the container IS, always the OPPOSITE of the row's `[scope]` bracket. Severity `error`; no reload-hint.

<!-- catalog-state: reinstall-not-installed-cross-scope -->

```text
A plugin operation has failed.

● mp [project]
  ⊘ hello (skipped) {not installed, marketplace in user scope}
```

### Failure -- marketplace not added, explicit scope (ATTR-03 / SCOPE-01)

Triggered when `reinstall @<marketplace>` names a marketplace that is NOT added in the requested `--scope`, or when `reinstall <plugin>@<marketplace>` names one absent from BOTH scopes. SCOPE-01: the PLUGIN form with the marketplace present only in the OTHER scope renders the `reinstall-not-installed-cross-scope` row instead -- nothing is installed at the requested scope, so the plugin is the subject. ATTR-03 makes the attribution form-INDEPENDENT: the explicit-scope-plugin, explicit-scope-marketplace, and bare forms ALL emit the standalone `MarketplaceNotAddedMessage` variant (`{marketplace not added}` on the marketplace subject) BEFORE any cascade row exists -- replacing the former per-form divergence (`(skipped) {not installed}` for the explicit-scope plugin form via a synthesized phantom target; `(failed) {not found}` for the explicit-scope-marketplace and bare forms via a raw throw -> synthetic `(reinstall)` row). The `[scope]` bracket carries the REQUESTED scope: the operator infers the other scope (SCOPE-01; resolved Open Question #1 -- the requested-scope bracket, no other-scope phrase). The legitimate "marketplace present, plugin not installed" case keeps its `(skipped) {not installed}` outcome -- only the marketplace-absent precondition is re-attributed. Two-block form: the `A marketplace operation has failed.` summary on the host `Error:` label line, then the bare column-0 detail row as its own block (GRAM-01 / GRAM-02). No cause-chain trailer. Severity `error`; no reload-hint.

<!-- catalog-state: missing-marketplace-not-added -->

```text
A marketplace operation has failed.

⊘ ghost-mp [project] (failed) {marketplace not added}
```

### Failure -- marketplace not added, bare form absent from both scopes (ATTR-03)

Triggered when the bare `reinstall @<marketplace>` form (no `--scope`) names a marketplace that is absent in BOTH scopes. The same standalone `{marketplace not added}` variant fires, but with NO `[scope]` bracket (the absent-from-both form: there is no requested scope to report). Byte-identical to `info`'s `missing-marketplace-not-added-absent-from-both` state. Severity `error`; no reload-hint.

<!-- catalog-state: missing-marketplace-not-added-absent-from-both -->

```text
A marketplace operation has failed.

⊘ ghost-mp (failed) {marketplace not added}
```

______________________________________________________________________

## `/claude:plugin update`

Multi-plugin cascade. Same shape as `reinstall` with version-arrow rows (`v<from> → v<to>`) per D-15-04 / Phase 16 `composeVersionArrow`.

### Single marketplace, mixed

<!-- catalog-state: single-mp-mixed -->

```text
A plugin operation has failed.

● official [user]
  ● alpha v0.5.0 → v1.0.0 (updated)
  ⊘ delta (failed) {network unreachable}

Plugin update: 1 failure, 1 updated

/reload to pick up changes
```

UGRM-01: a bulk `update` suppresses the per-plugin `(skipped) {up-to-date}` row for every unchanged plugin, so the `beta` up-to-date row is absent here. UGRM-02/D-04: the headline counts realized transitions only -- the one `failed` row composes ahead of the one `updated` row as `1 failure, 1 updated` (the failure category is the unchanged `countRowsBySeverity` math; the updates-only `tally` override owns the success category, rendered with the verb `updated`, which has no plural-s). The `updated` variant emits `v<from> → v<to>` (both sides carry the `v` prefix per `composeVersionArrow`). When a side is a PI-7 hash-version it is shortened to git-style `v#<7hex>`, e.g. `v#2ea95f8 → v#1c3d9a0` (SNM-35, D-23-05). The `failed` plugin row carries `version?` only (the v2 `PluginFailedMessage` has no `from`/`to` fields per D-15-04 -- `composeVersionArrow` is the `updated` variant's helper alone); `delta` here omits `version` because the orchestrator has no post-failure target version to surface. Severity: `error`. Reload-hint fires because `alpha` was updated.

### Failed with rollback-partial cause chain

<!-- catalog-state: failed-with-rollback-partial -->

```text
A plugin operation has failed.

● official [user]
  ⊘ delta v1.0.0 (failed) {rollback partial}
    cause: orchestrator failed mid-staging
    [phase3a] (rollback failed)
      cause: failed to remove staged agent: EACCES
    [phase3b] (rollback failed)
      cause: orphan path: /.../delta.bak

Plugin update: 1 failure
```

OUT-03/D-04: the single `failed` row is the one failure in the plural tally (success/warning zero, omitted); the tally sits after the cause-chain block (there is no reload-hint on a failed-only cascade). `failed` variant carrying both `cause?` and `rollbackPartial`. Per-plugin cause-chain at 4-space indent first; rollback-partial child rows + 6-space-indent per-phase cause chains next (D-16-08). Severity: `error`. No reload-hint. UGRM-01/UGRM-02: this state is deliberately unaffected -- there are no `unchanged` rows to suppress and zero `updated` rows, so the updates-only `tally` override contributes nothing (its 0-count success category is dropped) and the failure math is unchanged at `1 failure`.

### All up-to-date (no-op cascade)

<!-- catalog-state: all-up-to-date-noop -->

```text
Plugin update: nothing to update
```

UGRM-01/UGRM-02: a bulk `update` whose targets are ALL up-to-date suppresses every per-plugin `(skipped) {up-to-date}` row (and drops the now-empty marketplace header), so the cascade body is empty. Rather than emit zero output (a perceived hang) or the `(no marketplaces)` sentinel, the orchestrator emits a single never-silent headline `Plugin update: nothing to update`. This is a hard-coded constant (mirroring the `reconcile-pending-empty` no-op byte-lock precedent), at `info` severity, with no reload-hint (nothing changed on disk).

### Across multiple marketplaces (bare `update` form)

<!-- catalog-state: bare-multi-mp -->

```text
A plugin operation has failed.

● local-mp [project]
  ● helper v0.5.0 → v1.0.0 (updated)

● official [user]
  ● alpha v0.5.0 → v1.0.0 (updated)
  ⊘ delta (failed) {network unreachable}

Plugin update: 1 failure, 2 updated

/reload to pick up changes
```

Two marketplace blocks. Severity: `error`. UGRM-01: the `beta` `(skipped) {up-to-date}` row is suppressed. UGRM-02/D-04: the headline counts realized transitions only -- the one `failed` row composes ahead of the two `updated` rows (`helper` + `alpha`) as `1 failure, 2 updated`. Reload-hint fires (two `updated` plugin rows). The `failed` `delta` row omits the version-arrow slot per the v2 type model (`PluginFailedMessage` does not carry `from`/`to` -- only the `updated` variant does).

### Same marketplace name in both scopes

<!-- catalog-state: same-mp-both-scopes -->

```text
● official [project]
  ● alpha v0.9.0 → v1.0.0 (updated)

● official [user]
  ● beta v0.5.0 → v1.0.0 (updated)

Plugin update: 2 updated

/reload to pick up changes
```

Per-scope blocks; identical lock to `reinstall` -- marketplaces never collapse across scopes. UGRM-02/D-04: the two `updated` rows across the per-scope blocks are the two realized transitions, so the updates-only headline reads `2 updated` (no suppression needed -- there are no up-to-date rows here).

### Hash-version update arrow (PI-7 short-SHA display, both sides)

<!-- catalog-state: hash-version-arrow -->

```text
● official [user]
  ● hashed-plugin v#2ea95f8 → v#1c3d9a0 (updated)

Plugin update: 1 updated

/reload to pick up changes
```

UGRM-02/D-04: the single `updated` row is the one realized transition, so the updates-only headline reads `1 updated`. Both `from` and `to` are PI-7 hash-versions (`hash-2ea95f85703d` -> `hash-1c3d9a0bbef1`); each is shortened to its git-style 7-hex form with a `v#` prefix (`v#2ea95f8`, `v#1c3d9a0`) per `composeVersionArrow` (SNM-35, D-23-05). Persistence keeps the full `hash-<12hex>` on both sides. Severity: info. Reload-hint fires because `hashed-plugin` was updated.

### Sha-version update arrow (git-source short-SHA display, both sides)

<!-- catalog-state: sha-version-arrow -->

```text
● official [user]
  ● git-plugin v#a1b2c3d → v#2222333 (updated)

Plugin update: 1 updated

/reload to pick up changes
```

D-78-06 / PURL-06: a git-source update swaps the recorded commit, so both `from` and `to` are git-source `sha-<12hex>` versions (`sha-a1b2c3d4e5f6` -> `sha-222233334445`). Each renders through the SAME `composeVersionArrow` -> `renderVersion` -> `formatShaVersionForDisplay` path the hash-version arrow uses, so it shortens to its git-style 7-hex form with a `v#` prefix (`v#a1b2c3d`, `v#2222333`) -- no new render grammar. Persistence keeps the full `sha-<12hex>` on both sides (D-77-01). Severity: info. Reload-hint fires because `git-plugin` was updated.

### Update with a degraded component (WARN-01 / D-86-03 / WR-12)

<!-- catalog-state: update-degraded-component -->

```text
A plugin operation needs attention.

● official [user]
  ● alpha v1.0.0 → v1.0.1 (updated) {malformed skill}

/reload to pick up changes
```

An update drives the same bridges as an install, so a skill or command whose source frontmatter cannot be parsed degrades identically (skill -> synthesized `disable-model-invocation` block; command -> neutralized frontmatter). The row keeps `(updated)` -- the transition happened, and the component is updated-but-short -- and carries one `{malformed skill}` / `{malformed command}` token per kind, composed through the same `malformedReasonsForKinds` seam the install, enable, reinstall and backfill rows use. A plugin that degrades both kinds renders one brace in that seam's canonical order: `{malformed skill, malformed command}`.

This is the MALFORMED-component axis, not the dropped-kind axis. A kind the resolver cannot support at all is DROPPED, and a `--partial` update reports that with the `(partially-installed)` row and its dropped-component brace. A malformed component is written, not dropped, so it stays on the `(updated)` row. The two axes are independent: an update can drop one kind and degrade another, and each names itself on the row its own axis owns -- see the combined state below.

Severity `warning` with the summary line, the same raise the install, enable and reinstall surfaces take for the same class of degrade: this one the update's own ledger just produced. The raise applies on BOTH surfaces that render this row -- the manual update cascade and the marketplace autoupdate cascade -- because a degraded component is short of ideal whichever surface reports it. It is orthogonal to each surface's own success-severity policy, so the autoupdate cascade's deliberate silence about an absent companion (WR-01) is unaffected. The trailing tally is unchanged: the count is taken by PARTITION, so a degraded update is still one update. A clean update renders the brace-less rows above unchanged.

### Update that materializes an orphan-rewake handler (SURF-05 / D-63-08 / WR-01)

<!-- catalog-state: update-orphan-rewake -->

```text
● official [user]
  ● alpha v1.0.0 → v1.0.1 (updated) {orphan rewake}

/reload to pick up changes
```

The re-materialized `hooks/hooks.json` declares `rewakeMessage` or `rewakeSummary` on a handler WITHOUT `asyncRewake: true`. `update` re-materializes that file exactly as install, enable and backfill do, so it can introduce the same config bug and now names it the same way: one token per plugin regardless of N orphan handlers, read off the re-resolved candidate. Severity `info` -- the config bug names itself in the brace; the update itself was carried out in full, so this axis moves no severity channel (unlike the malformed-component axis below it). When more than one signal is present they share ONE brace in the install row's emit order: `{orphan rewake, malformed skill}`. A dropped kind cannot join that brace on THIS row form: a non-empty dropped-kind set selects `(partially-installed)` instead, so the three-signal case renders there -- see `update-degraded-and-dropped` below.

### Update that both drops a kind and degrades a component (CR-01 / WARN-01 / FSTAT-07)

<!-- catalog-state: update-degraded-and-dropped -->

```text
A plugin operation needs attention.

● official [user]
  ◉ alpha v1.0.1 (partially-installed) {malformed skill, unsupported component}

/reload to pick up changes
```

The two axes above firing on one ledger run. The DROPPED kind picks the row form -- `(partially-installed)` with the `◉` glyph, carrying the post-update version rather than the arrow, exactly as the dropped-kind state does on its own -- and the MALFORMED component adds its own token to the same brace. Both tokens ride ONE brace in the install row's established emit order (malformed kinds first, then the dropped kinds; see `enable-orphan-rewake`), because a reader scanning a column of rows should meet the same token in the same position on every surface.

Both cascade surfaces compose this row through the one `updatedRowFromOutcome` seam, so neither can name one axis and swallow the other. The malformed raise applies here as it does on the `(updated)` row: severity `warning` with the summary line, whatever the surface's own base policy for the dropped kind was (the manual `--partial` opt-in stays `info` for the drop alone; the autoupdate cascade raises a NEWLY-degrading drop on its own). The reload-hint fires -- `partially-installed` is a realized transition. Dropping a kind with no malformed component renders `autoupdate-partially-installed-already-degraded` unchanged.

### Partially-upgradable decline, targeted update (SEV-04 / D-69-02)

<!-- catalog-state: decline-partially-upgradable-targeted -->

```text
A plugin operation needs attention.

● mp [project]
  ● hello v1.0.0 (partially-upgradable) {lsp}
    Re-run with --partial to update with the supported components.
```

WR-04 / D-98-04: this decline is for an ENABLED record. A DISABLED record takes the carve-out below instead -- `preflightUpdate` derives the candidate gate from the record as well as the flag, so a disabled record never reaches this row.

A TARGETED `update <plugin>@<marketplace>` (no `--partial`) whose candidate re-resolves `partially-available` declines the upgrade and renders the resolver-state-driven `(partially-upgradable)` token with the `●` glyph (XSURF-03) -- consistent with how `list` describes the same plugin, NOT the misleading `⊘ (skipped) {no longer installable}` (the plugin IS installable with `--partial`). The degrade reason is sourced through the SAME `narrowUnsupportedKinds` seam the `list (partially-upgradable)` inventory row uses, so the `{lsp}` brace is byte-identical across the two surfaces. Because `--partial` can degrade-update the supported components, the row carries a 4-space-indented update-worded `--partial` hint trailer pointing the user at the flag. The user explicitly named this plugin, so the decline is actionable -> severity `warning` (SEV-04 / D-69-02): the cascade prepends the `A plugin operation needs attention.` summary line. Single cardinality, so no trailing tally. The per-row bytes are identical to the bulk form below -- only the threaded invocation cardinality changes the stamped severity. No reload-hint (nothing changed on disk).

### Partially-upgradable skip, bulk update (SEV-04 / D-69-02)

<!-- catalog-state: skip-partially-upgradable-bulk -->

```text
● mp [project]
  ● hello v1.0.0 (partially-upgradable) {lsp}
    Re-run with --partial to update with the supported components.

Plugin update: nothing to update
```

The SAME partially-upgradable candidate skipped by a BULK `update @<marketplace>` (or bare `update`) the user did NOT individually target is benign -> severity `info` (SEV-04 / D-69-02). The per-row `(partially-upgradable) {lsp}` bytes + the `--partial` trailer are the Phase-73 lock, identical to the targeted form above; this is a zero-realized-transition bulk cascade -- one info `partially-upgradable` decline (partition `skipped`, NOT `updated`), 0 updated, 0 failures/warnings. UGRM-01/UGRM-02: the cascade BODY still renders the declined row + trailer, but the headline is the never-silent no-op constant `Plugin update: nothing to update` (the `partially-upgradable` decline contributes 0 to the updated count, so the override's 0-count success category collapses to `""`; the orchestrator owns the headline rather than letting it vanish). No reload-hint.

### Disabled-record refresh, no flag needed (WR-04 / D-98-04)

<!-- catalog-state: disabled-record-refresh -->

```text
● mp [project]
  ⊘ hello (skipped) {already disabled}
```

A targeted `update <plugin>@<marketplace>` against a DISABLED record that is ALREADY degraded and whose candidate re-resolves `partially-available`. `preflightUpdate` derives the candidate gate's partial argument from the record as well as the caller flag (the same record-derived stance the enable branch takes, ENBL-07 / D-69-01), so the candidate is admitted with no flag typed and the D-UPD short-circuit refreshes the record: `version`, `resolvedSource`, `resolvedSha` and the `compatibility` block are rewritten inside a state guard so a later `enable` reads the current pin. Nothing is materialized -- every `resources.*` array stays empty and the record stays disabled -- which is why the strict gate's do-not-materialize-an-unconsented-degrade rule does not apply here. WR-01: a disabled record that is still CLEAN is NOT admitted this way; it renders the `(partially-upgradable)` decline row instead, because flipping a clean record to degraded is a consent the user has not given. WR-02: the row does NOT claim `up-to-date`. This arm is reachable only when the version MOVED (an equal version short-circuits to the `unchanged` row before the disabled branch), so the reason names why nothing was materialized instead of denying the re-pin. The version slot is empty for the same reason: the record no longer holds the pre-update version. `--partial` stays admissible and reaches the same short-circuit. Severity `info` -- `already disabled` is in the benign closed set, so no summary line. Single cardinality, so no trailing tally. No reload-hint (no Pi-visible resource changed).

### Failure -- marketplace not added, explicit scope (ATTR-02 / SCOPE-01)

Triggered when `update @<marketplace>` names a marketplace that is NOT added in the requested `--scope`, or when `update <plugin>@<marketplace>` names one absent from BOTH scopes. SCOPE-01: the PLUGIN form with the marketplace present only in the OTHER scope renders the `update-not-installed-cross-scope` row instead -- nothing is installed at the requested scope, so the plugin is the subject. ATTR-02 makes the attribution form-INDEPENDENT: BOTH the `<plugin>@<mp>` and `@<mp>` forms flow through `enumerateMarketplaceTarget` and emit the standalone `MarketplaceNotAddedMessage` variant (`{marketplace not added}` on the marketplace subject) BEFORE any cascade row exists -- replacing the former raw `Error` (M10) / `MarketplaceNotFoundError` (M11) that escaped to a synthetic `(failed) {not found}` row. No raw throw escapes the orchestrator for the marketplace-existence case. The `[scope]` bracket carries the REQUESTED scope: the operator infers the other scope (SCOPE-01; resolved Open Question #1 -- the requested-scope bracket, no other-scope phrase). The cascade path (`updateSinglePlugin` / `preflightUpdate`) keeps its non-throwing concurrent-removal outcome and is unaffected (Pitfall 3 / A3). Two-block form: the `A marketplace operation has failed.` summary on the host `Error:` label line, then the bare column-0 detail row as its own block (GRAM-01 / GRAM-02). No cause-chain trailer. Severity `error`; no reload-hint.

<!-- catalog-state: missing-marketplace-not-added -->

```text
A marketplace operation has failed.

⊘ ghost-mp [user] (failed) {marketplace not added}
```

### Failure -- not installed, marketplace one scope over (SCOPE-01)

Triggered when `update <plugin>@<marketplace> --scope <scope>` names a scope whose state.json holds no such marketplace container, while the OTHER scope does. The plugin is the row's subject, and the brace names where the container really is beside `not installed`, so the row is distinguishable from the plain absent-target skip an in-scope container yields: there the container is here and the fix is to install the plugin, here the fix is to target the other scope or add the marketplace at the one named. `marketplace in project scope` is a CONTENT reason and JOINS `not installed` rather than replacing it, unlike the structural `marketplace not added*` markers. The scope word names where the container IS, always the OPPOSITE of the row's `[scope]` bracket. Severity `error`; no reload-hint.

<!-- catalog-state: update-not-installed-cross-scope -->

```text
A plugin operation has failed.

● mp [user]
  ⊘ hello (skipped) {not installed, marketplace in project scope}
```

### Failure -- marketplace not added, bare form absent from both scopes (ATTR-02)

Triggered when the bare `update @<marketplace>` form (no `--scope`) names a marketplace that is absent in BOTH scopes. The same standalone `{marketplace not added}` variant fires, but with NO `[scope]` bracket (the absent-from-both form: there is no requested scope to report). Byte-identical to `info`'s `missing-marketplace-not-added-absent-from-both` state. Severity `error`; no reload-hint.

<!-- catalog-state: missing-marketplace-not-added-absent-from-both -->

```text
A marketplace operation has failed.

⊘ ghost-mp (failed) {marketplace not added}
```

______________________________________________________________________

## `/claude:plugin fetch`

Pi-only extension: upstream Claude Code `/plugin` has no `fetch` verb (verified 2026-07-13). `fetch` warms the local clone/mirror cache for a git-source plugin WITHOUT installing it, so a later `install` resolves offline. It renders the always-marketplace-header cascade form: a bare marketplace header at column 0 and per-plugin rows at 2-space indent. A fetch changes no Pi-visible resource (nothing is installed), so no state row is a reload-trigger and no `/reload to pick up changes` trailer ever fires. A post-fetch success renders the plugin's DERIVED status row -- exactly what `list` / `info` show (`(available)` / `(partially-available)` / `(unavailable)`) -- because the fetch is followed by a fresh `probeManifestEntry` against the now-warm tree, never an install cascade (FTCH-02). The `available` / `partially-available` / `unavailable` rows are bare: no `[scope]` bracket (MSG-PL-6 / SNM-11 carve-out). No catalog row introduces a new status token, glyph, or reason -- every member already exists.

### Single plugin -- fetched, now available (FTCH-02)

Triggered by `fetch <plugin>@<marketplace>` against a cold git-source plugin whose warmed tree resolves installable. The post-fetch probe classifies `available`, so the row reads `○ <name> v<version> (available)` (bare, no scope bracket). Single cardinality -> no trailing tally. Severity `info`; no reload-hint.

<!-- catalog-state: single-available -->

```text
● official [user]
  ○ gp v1.0.0 (available)
```

### Single plugin -- fetched, partially available (FTCH-02)

The warmed tree resolves `partially-available` (some declared components are unsupported). The row reads `⊖ <name> v<version> (partially-available) {reason}` with the dedicated `⊖` glyph -- consistent with how `list` describes the same plugin. The degrade reason is sourced through the SAME `narrowUnsupportedKinds` seam as the `list` inventory row, so the `{lsp}` brace is byte-identical. Severity `info`; no reload-hint.

<!-- catalog-state: single-partially-available -->

```text
● official [user]
  ⊖ gp v1.0.0 (partially-available) {lsp}
```

### Single plugin -- no-op, nothing to fetch (FTCH-03 / D-81-02)

Triggered when the target is a path/non-git source (nothing to fetch) OR a pinned source whose clone is already materialized (a pinned-warm no-op). The no-op gate runs the fs-only presence probe FIRST and renders `⊘ <name> (skipped) {up-to-date}` at info severity WITHOUT touching the git seam (network-free). The existing `up-to-date` reason is carried in the row's `reasons`; the closed set does not grow. Single cardinality -> no trailing tally. Severity `info`; no reload-hint.

<!-- catalog-state: single-noop-skipped -->

```text
● official [user]
  ⊘ gp (skipped) {up-to-date}
```

### Bulk fetch -- mixed outcomes (FTCH-02 / D-81-01)

Triggered by the plural `fetch @<marketplace>` (or bare `fetch`) form: the failure-tolerant sweep enumerates the marketplace's fetchable manifest entries, and a per-plugin throw is captured as a `⊘ <name> (failed) {reason}` row (the sweep never aborts) while the succeeding plugin renders its fresh derived status row. The plural form carries a trailing tally under the `Plugin fetch` label. The default tally counts info rows uniformly as `successes` and the failure category folds in from the rows -> `Plugin fetch: 1 failure, 1 success`. Severity: `error` (a `failed` row drives the first-match ladder). No reload-hint (a fetch installs nothing).

<!-- catalog-state: bulk-mixed -->

```text
A plugin operation has failed.

● official [user]
  ○ ok v1.0.0 (available)
  ⊘ bad (failed) {network unreachable}

Plugin fetch: 1 failure, 1 success
```

______________________________________________________________________

## `/claude:plugin import`

Multi-marketplace + multi-plugin cascade. Each marketplace header carries its own state-change status (`added` / `skipped` is not a marketplace status in v2 -- use `updated` for "already added" or omit the marketplace from the payload; `failed` for an unreachable source). Plugin rows indent two spaces underneath.

### Fresh import (mixed outcomes across both scopes)

<!-- catalog-state: fresh-mixed-both-scopes -->

```text
A plugin operation needs attention.

● claude-plugins-official [project] (added)
  ● official-plugin (installed)

● claude-plugins-official [user] (added)
  ● official-plugin (installed)

● directory-marketplace [project] (added)
  ● local-plugin (installed)

● directory-marketplace [user] (added)
  ● local-plugin (installed)
  ⊘ unavailable-plugin (unavailable) {unsupported hooks}

● github-marketplace [project] (added)
  ● github-plugin (installed)

● github-marketplace [user] (added)
  ● github-plugin (installed)

Import: 1 warning, 12 successes

/reload to pick up changes
```

Six marketplace blocks joined by blank lines (D-16-07). WR-02: the import producer stamps `unavailable` rows `severity: warning` -- they are actionable (the user cannot complete the install without addressing them), so the envelope severity bumps to `warning` and the `A plugin operation needs attention.` summary line is prepended (GRAM-01 / GRAM-02). OUT-03/OUT-06/D-03/D-04: import is a plural mixed-subject operation, so the trailing tally counts all rows uniformly under the `Import` label -- the single `unavailable` row counts as `1 warning` and the six `added` marketplace rows plus six `installed` plugin rows count as `12 successes`. The `directory-marketplace [user]` block surfaces an `unavailable` plugin (`unavailable_plugin`) which has no `scope` field per SNM-11. Reload-hint fires (multiple `added` marketplace statuses + multiple `installed` plugin rows). Severity: warning -- no `failed` in the payload, but the actionable `unavailable` row routes the cascade to `warning`.

### `import --scope project` (narrows writes to project scope only)

<!-- catalog-state: scope-project-narrow -->

```text
● claude-plugins-official [project] (added)
  ● official-plugin (installed)

● directory-marketplace [project] (added)
  ● local-plugin (installed)

● github-marketplace [project] (added)
  ● github-plugin (installed)

Import: 6 successes

/reload to pick up changes
```

Three project-scope marketplace blocks. OUT-03/D-04: three `added` marketplace rows plus three `installed` plugin rows yield `6 successes`. Reload-hint fires. Severity: info.

### Per-row soft-dep markers on import cascade rows

<!-- catalog-state: soft-dep-markers -->

```text
● claude-plugins-official [project] (added)
  ● agent-only-plugin (installed) {requires pi-subagents}
  ● dual-plugin (installed) {requires pi-subagents, requires pi-mcp}

Import: 3 successes

/reload to pick up changes
```

OUT-03/D-04: one `added` marketplace row plus two `installed` plugin rows yield `3 successes`. Each `installed` row's `dependencies` field drives the marker. The combined-row brace block joins markers with a comma-space separator (the renderer's `composeReasons` helper). Reload-hint fires. Severity: info.

### Same marketplace name in both scopes

<!-- catalog-state: same-mp-both-scopes -->

```text
● official [project] (added)
  ● alpha (installed)

● official [user] (added)
  ● beta (installed)

Import: 4 successes

/reload to pick up changes
```

Per-scope marketplace blocks. OUT-03/D-04: two `added` marketplace rows plus two `installed` plugin rows yield `4 successes`. Reload-hint fires. Severity: info.

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
A marketplace operation has failed.

⊘ unreachable-mp [user] (failed)
```

Bare `failed` marketplace header at column 0; no plugin children. Severity: `error`. No reload-hint per D-16-12 (failed marketplace status does not trigger).

> Note: the v2 `notify()` renderer's `composeMarketplaceBlock` does not emit a marketplace-level cause-chain trailer below the failed header. The v2 type model places `cause?: Error` on plugin variants only; orchestrators wanting to surface the diagnostic must construct the payload as a per-plugin failed/manual-recovery row with `cause?: Error`. This catalog state is the bare failed-marketplace header byte form. D-48-A: this bare-`(failed)` form (reasons omitted) is byte-unchanged by the ATTR-07 reason-brace addition.

### Failure -- duplicate name (ATTR-07)

Triggered when `marketplace add <source>` resolves a manifest whose derived `name` already exists in the target scope (`MarketplaceDuplicateNameError`). Post-manifest failure: the subject is the derived marketplace name. Severity `error`; no reload-hint.

<!-- catalog-state: add-duplicate-name -->

```text
A marketplace operation has failed.

⊘ claude-plugins-official [user] (failed) {duplicate name}
```

### Failure -- stale clone (ATTR-07)

Triggered when a github `marketplace add` finds a pre-existing non-empty `sources/<derivedName>/` clone directory on the final destination (`StaleSourceCloneError`). Post-manifest failure: the subject is the derived marketplace name. The github guard's `cleanupStaging` runs before this row is emitted (no staging-dir leak). Severity `error`; no reload-hint.

<!-- catalog-state: add-stale-clone -->

```text
A marketplace operation has failed.

⊘ claude-plugins-official [user] (failed) {stale clone}
```

### Failure -- unsupported source (ATTR-07)

Triggered when the parsed source kind is `unknown` (e.g. an SSH `git@...` URL) or a valid-but-unimplemented kind (`url` / `git-subdir` / `npm`) -- `UnsupportedSourceError`. Pre-clone, pre-name failure: the subject is the user-typed source string. Severity `error`; no reload-hint.

<!-- catalog-state: add-unsupported-source -->

```text
A marketplace operation has failed.

⊘ git@github.com:foo/bar.git [user] (failed) {unsupported source}
```

### Failure -- source missing (ATTR-07)

Triggered when a path `marketplace add` points at a path that does not exist (ENOENT) or exists but is neither a file nor a directory (e.g. a socket; tagged ENOTDIR). Pre-name failure (no readable manifest): the subject is the user-typed source string. NFR-5: a path source never touches the network. Severity `error`; no reload-hint.

<!-- catalog-state: add-source-missing -->

```text
A marketplace operation has failed.

⊘ ./missing-mp [user] (failed) {source missing}
```

### Failure -- invalid manifest (ATTR-07)

Triggered when `marketplace add` reads a `marketplace.json` that is malformed JSON or schema-invalid (`InvalidMarketplaceManifestError`, D-48-B). Pre-name failure (the manifest is unreadable, so no derived name): the subject is the user-typed source string. For a github source, the clone has already happened and `cleanupStaging` runs before this row is emitted. Severity `error`; no reload-hint.

<!-- catalog-state: add-invalid-manifest -->

```text
A marketplace operation has failed.

⊘ anthropics/claude-plugins-official [user] (failed) {invalid manifest}
```

### Failure -- authentication required (D-76-08)

Triggered when a `url`-source `marketplace add` clones a private/unauthorized repo and the HTTP transport returns a 401/403 auth challenge (`HttpError` from isomorphic-git -- not an errno, so `classifyAddError` gains a dedicated arm rather than falling through to `unparseable`). Truthful attribution: the reason is `{authentication required}`, NOT `{network unreachable}` -- an auth failure is distinct from a network-reachability failure. The reason and the HTTP cause chain ride a synthetic-child failed row at 4-space indent (marketplace headers carry no `cause`; SNM-10), mirroring the `update-path-invalid-manifest` recipe. Pre-name failure: the subject is the user-typed URL. The synthetic child makes the cascade a mixed-subject failure, so the summary prefix is the generic `Some operations have failed.` (the child counts as one plugin operation). Severity `error`; no reload-hint. `PROV-04`'s provider-auth fail-clean case reuses this same token.

<!-- catalog-state: add-authentication-required -->

```text
Some operations have failed.

⊘ https://gitlab.com/acme/private-mp [user] (failed)
  ⊘ https://gitlab.com/acme/private-mp (failed) {authentication required}
    cause: HTTP Error: 401 Unauthorized
```

______________________________________________________________________

## `/claude:plugin marketplace info <name>`

Read-only detail surface. Renders the marketplace header at column 0 carrying the `<autoupdate>` or `<no autoupdate>` marker, followed by per-attribute lines (`github:`, `url:`, or `path:`; optional `last_updated:` for git-backed sources github + url per D-76-10; optional `description:` when `marketplace.json` carries one). INFO-01 + INFO-03 + INFO-04 + INFO-07 + MURL-05 lock the full state set below.

Severity routing: every success state is `info` (no second arg to `ctx.ui.notify`); the two `{marketplace not added}` failure states and the `{invalid manifest}` manifest-failure state route to `error`. No reload-hint fires on any state (info surfaces are read-only per SNM-33).

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

### Success -- url source with ref, lastUpdatedAt, and description

Triggered against a url-sourced marketplace (an arbitrary non-github HTTPS git host, e.g. GitLab) whose persisted record carries `autoupdate: true`, a `#<ref>` fragment, a `lastUpdatedAt` ISO timestamp, and a `marketplace.json` with a `description`. The `url: <url>[#<ref>]` line replaces the `github:`/`path:` line (kind-labeled per the label==kind convention, D-76-09). The `last_updated:` line renders because url is a git-backed kind (the gate widened from github-only to all non-path kinds per D-76-10). Four-line body: header with `<autoupdate>` marker, the `url:` line, the `last_updated:` line, and the `description:` line. Severity `info`; no reload-hint.

<!-- catalog-state: url-single-scope-full -->

```text
● acme-mp [user] <autoupdate>
url: https://gitlab.com/acme/mp#main
last_updated: 2026-06-03T00:00:00Z
description: An ACME marketplace hosted on GitLab.
```

### Success -- url source, minimal (no ref, no lastUpdatedAt, no description)

Triggered against the same url-sourced host whose record carries `autoupdate: false`, no `#<ref>` fragment, no `lastUpdatedAt`, and a `marketplace.json` without a `description`. Two-line body: header with `<no autoupdate>` marker and the `url:` line with NO `#<ref>` suffix. The `last_updated:` line is omitted (no source data) and the `description:` line is omitted (no manifest data). Severity `info`.

<!-- catalog-state: url-single-scope-minimal -->

```text
● acme-mp [user] <no autoupdate>
url: https://gitlab.com/acme/mp
```

### Success -- path source, minimal

Triggered against a path-sourced marketplace with `autoupdate: false` and no `marketplace.json` description. Two-line body: header with `<no autoupdate>` marker, and the `path: <abs-path>` source line. Path sources NEVER emit a `last_updated:` line (the renderer gates that on `source.sourceKind !== "path"` per D-76-10, and path is excluded); without a description on the manifest the `description:` line is omitted too. Severity `info`.

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

Triggered when `marketplace info <name> [--scope ...]` reads a present-but-schema-invalid `marketplace.json` (a typed `InvalidMarketplaceManifestError` with NO `SyntaxError` cause -- the JSON parsed but failed validation). The read surface now classifies this as `{invalid manifest}` for parity with the `marketplace add` write path's `classifyAddError` (D-48-B / IN-02 close), instead of the former generic `{unreadable}` fallback -- the same on-disk condition surfaces the same truthful reason across read and write. The orchestrator emits the `buildManifestFailureMessage` `PluginInfoMessage` with `plugin.status: "failed"` + `reasons: ["invalid manifest"]` + `componentsResolved: false` on the marketplace subject; the renderer composes the marketplace header at column 0 (carrying the `<no autoupdate>` marker for a record with `autoupdate: false`), the failed row at 2-space indent, and the `components: not resolved` marker at 4-space indent (the manifest never parsed, so no component set could be resolved). The failed row carries NO `[scope]` bracket because `plugin.scope` equals the marketplace scope (the renderer's orphan-fold rule suppresses the bracket). A malformed-JSON manifest still reads `{unparseable}` -- that arm is preserved. Two-block form: the `A plugin operation has failed.` summary (the failed row is a PLUGIN subject, GRAM-02) on the host `Error:` label line, then the multi-line detail block (header + failed row + `components: not resolved`) as its own block (GRAM-01). Severity `error`; no reload-hint (info surfaces are read-only per SNM-33).

<!-- catalog-state: manifest-invalid -->

```text
A plugin operation has failed.

● bad-mp [user] <no autoupdate>
  ⊘ bad-mp (failed) {invalid manifest}
    components: not resolved
```

### Failure -- absent from both scopes

Triggered when `marketplace info <name>` (no `--scope` filter) is invoked against a marketplace name that is NOT present in EITHER scope. The orchestrator emits the standalone `MarketplaceNotAddedMessage` variant (`kind: "marketplace-not-added"`) with `scope` OMITTED (because the marketplace is in neither scope -- emitting a `[user]` or `[project]` bracket would be misleading). The renderer's bracket short-circuit suppresses the `[scope]` token, leaving the bare `⊘ <name> (failed) {marketplace not added}` row at column 0. Distinct from `scope-mismatch-not-added` below: this state has NO scope bracket because the marketplace is in neither scope; the scope-mismatch state DOES have a bracket because the user asked for a specific scope. Two-block form: the `A marketplace operation has failed.` summary on the host `Error:` label line, then the bare detail row as its own block (GRAM-01 / GRAM-02). Severity `error`; no reload-hint.

<!-- catalog-state: absent-from-both -->

```text
A marketplace operation has failed.

⊘ ghost-mp (failed) {marketplace not added}
```

### Failure -- `--scope` mismatch (`{marketplace not added}`)

Surfaced when `marketplace info <name> --scope <wrong-scope>` is invoked against a marketplace present only in the OTHER scope (e.g., requesting `--scope user` when `my-mp` lives only in `project`). The standalone `MarketplaceNotAddedMessage` variant (`kind: "marketplace-not-added"`) distinguishes this from a truly-absent marketplace name and uniquely identifies the scope-mismatch surface. The renderer emits a bare row at column 0 (no marketplace header above it -- the marketplace IS the thing that is not added in the requested scope). The `[user]` bracket is present because the user explicitly asked for a specific scope; the `absent-from-both` state above omits the bracket to avoid misleading the user when the marketplace is in NEITHER scope. Two-block form: the `A marketplace operation has failed.` summary on the host `Error:` label line, then the bare detail row as its own block (GRAM-01 / GRAM-02). Severity `error`; no reload-hint (info surfaces are read-only per SNM-33).

<!-- catalog-state: scope-mismatch-not-added -->

```text
A marketplace operation has failed.

⊘ my-mp [user] (failed) {marketplace not added}
```

______________________________________________________________________

## `/claude:plugin info <plugin>@<marketplace>`

Read-only detail surface (Phase 44). Renders the install-cascade always-marketplace-header form (mirrors `install`'s shape per INFO-02) with a per-plugin row at 2-space indent, optional description block hard-wrapped at col 4 / 66-col text width, then either per-kind component lists (sorted: `agents`, `commands`, `mcp`, `skills`) with an optional `dependencies:` line LAST, OR the `components: not resolved` marker (INFO-05). Phase 44 / INFO-02 + INFO-05 + INFO-07 lock the full state set below.

Severity routing: every success state (installed / available / unavailable / installed-both-scopes / state-only-installed-both-scopes / components-not-resolved / state-only-installed / state-only-partially-installed / state-only-disabled-with-components) is `info` severity (no second arg to `ctx.ui.notify`); the `state-only-fetch-skipped` and `disabled-fetch-skipped` notes are the two `warning` states on this surface (the user asked for a fetch and the command did not do it); the three `(failed)` states (`{marketplace not added}` missing-marketplace, `{marketplace not added}` --scope mismatch, `{not in manifest}` missing-plugin with NO installation record) route to `error`. No reload-hint fires on any state (info surfaces are read-only per SNM-33).

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

### Success -- installed from the installation record (INFO-09)

The marketplace manifest loads correctly, but it does not declare the plugin. An enabled installation record for the plugin exists, so the row shows the plugin as installed and states the absence as a reason. The version comes from the installation record, because there is no manifest entry to supply one. No description line and no dependencies line show: the manifest is the only source of both, and this state does not reconstruct them. The component names are the Pi-generated INSTALLED names -- `<plugin>-<skill>` for skills, `<plugin>:<command>` for commands, and `pi-claude-marketplace-<plugin>-<agent>` for agents. These names are different from the source names that the manifest-backed states above show (D-96-01). MCP servers are the one exception: the installation record keeps their raw source keys. This state replaces the `error`-severity `missing-plugin-not-in-manifest` outcome for this input, so the severity for an installed record changes from `error` to `info`. Severity `info`; no reload-hint (read-only surface).

<!-- catalog-state: state-only-installed-single-scope -->

```text
● mp [user] <no autoupdate>
  ● alpha v1.0.0 (installed) {not in manifest}
    skills: alpha-skill
```

### Success -- partially installed from the installation record (INFO-10)

The unsupported kinds come from the persisted `compatibility.unsupported` field on the installation record. This state does no live resolve. `not in manifest` is always the FIRST reason in the brace; `narrowUnsupportedKinds` supplies the kind tokens that follow it. The persisted derivation stays separate from the live-resolver derivation that the path-source manifest-backed arm uses; this state does not unify the two (INFO-10). Severity `info`; no reload-hint (read-only surface).

<!-- catalog-state: state-only-partially-installed-single-scope -->

```text
● mp [user] <no autoupdate>
  ◉ alpha v1.0.0 (partially-installed) {not in manifest, lsp}
    skills: alpha-skill
```

### Success -- hooks listed from the materialized configuration (INFO-11)

The installation record keeps only the name of the hooks container, not the hook entries. Thus the hook entries come from the materialized configuration that the extension wrote at install time, and not from the plugin's source declaration. The entries keep the order of the materialized file. The four name-list kinds are sorted, but the hook entries are not: their order is the order in which the author declared them. A tool event shows as `<event>(<matcher>)`; all other events show as `<event>`. Fidelity note: the materialized file holds only the supported subset that the install path kept. Thus this list can be shorter than the plugin's initial declaration, and the entries that the install path removed do not show. This limit is documented and not corrected, in the same manner as the D-96-01 name divergence above. Severity `info`; no reload-hint (read-only surface).

<!-- catalog-state: state-only-installed-with-hooks -->

```text
● mp [user] <no autoupdate>
  ● alpha v1.0.0 (installed) {not in manifest}
    hooks:
      Stop
      PreToolUse(Bash)
    skills: alpha-skill
```

### Success -- recorded hooks that cannot be listed (D-96-03)

The installation record names a hooks container, but the materialized configuration is missing, unreadable, or malformed. The `hooks:` line does not show, and the row carries the read reason as the LAST reason in the brace. Thus the operator can see that hook entries exist but that the command could not list them. This state can show one of four reasons: `source missing` (no such file), `permission denied` (the file cannot be opened), `unparseable` (the content is not valid JSON or it fails the schema), and `unreadable` (all other failures, which include the refusal of a container name that points outside the hooks directory). The reason is attributable to the hooks read because the materialized hooks configuration is the ONLY file that this state reads. If the record names NO hooks container, the `hooks:` line does not show and NO reason is added. Thus the two conditions -- no hooks, and hooks that cannot be listed -- are different on the screen. No read failure removes the remainder of the block: the status, the version, the other reasons, and the four name-list kinds all continue to show. Severity `info`; no reload-hint (read-only surface).

<!-- catalog-state: state-only-installed-hooks-degraded -->

```text
● mp [user] <no autoupdate>
  ● alpha v1.0.0 (installed) {not in manifest, source missing}
    skills: alpha-skill
```

### Warning -- the requested fetch was skipped (D-96-04)

The user gives `--fetch`, the marketplace manifest loads, the manifest does not declare the plugin, and an installation record exists. There is no manifest entry, thus there is no source to fetch from, and the command fetches nothing. This note tells the user that the flag did not run. The info block shows beside this note, and its bytes are the same as those of a bare run. The row uses the `(skipped) {not in manifest}` form that `update` already emits. This is one of the two causes of a `warning` on this surface. The other is `disabled-fetch-skipped` below. A run that hits both causes shows `mixed-fetch-skipped`, which composes the two. The note is a SECOND notification, because the standalone info row cannot hold a `skipped` status. The `(disabled)` inventory row needs no second notification of its own: it renders inside the info block (ENBL-17). Thus a run with one disabled scope and one state-only scope emits two notifications, and not three. A bare run and a plugin that the manifest DOES declare show no note. Severity `warning`; no reload-hint (read-only surface).

Header note: this note uses the LIST-arm marketplace header, which shows the `<autoupdate>` marker only when autoupdate is on, and shows no marker at all when it is off. The standalone info block always spells one of `<autoupdate>` / `<no autoupdate>`. Thus, when autoupdate is off, one run shows two different headers for the same marketplace and scope: `● mp [user] <no autoupdate>` on the info block and `● mp [user]` on this note. The marker still agrees with the info block, because it shows in exactly the conditions in which the info block reports autoupdate as on. This difference is a property of the two header arms and is recorded here on purpose.

<!-- catalog-state: state-only-fetch-skipped -->

```text
A plugin operation needs attention.

● mp [user]
  ⊘ alpha v1.0.0 (skipped) {not in manifest}
```

### Warning -- the requested fetch was skipped for a disabled plugin (D-96-04)

The user gives `--fetch` and at least one found scope holds the recorded-but-disabled marker. A disabled plugin has no materialized artifacts (ENBL-02), thus there is nothing to refresh for that scope. The command emits the note per disabled scope, and one notification carries all of the rows in project-first scope order (MSG-GR-3). If EVERY found scope is disabled, no probe runs at all, thus without this note the run would show bytes that are the same as those of a bare run. If only some of the found scopes are disabled, the note shows beside the info block of each other scope. Each of those other scopes fetches only if the manifest declares its plugin. A scope whose installation record outlived its manifest entry fetches nothing (INFO-12), and adds its own `{not in manifest}` row to this same note. The reason token is different from the state-only note above because the cause is different: the plugin is disabled, and the manifest can still declare it. The `(disabled)` inventory block shows before this note and keeps its own `info` severity. A bare run on the same input shows no note. Severity `warning`; no reload-hint (read-only surface).

<!-- catalog-state: disabled-fetch-skipped -->

```text
A plugin operation needs attention.

● mp [user]
  ⊘ alpha v1.0.0 (skipped) {already disabled}
```

### Warning -- one run skips the fetch for both causes (D-96-04)

The two causes above can occur in one run. The example below shows the usual arrangement: one found scope holds the disabled marker, and a different scope holds a record that the manifest does not declare. One notification carries both rows in project-first scope order (MSG-GR-3). Each row keeps the reason token of its own cause, and each scope keeps its own marketplace header. The summary line takes the plural form, because the note now accounts for two rows. This state is the composition of the two states above, and not a third cause of a skipped fetch. Severity `warning`; no reload-hint (read-only surface).

The two causes do not always occur in different scopes. ONE scope can hold both: a disabled record that the manifest no longer declares. That scope emits ONE row, and the row names the disabled cause. Each scope reports one skip reason, and the disabled cause wins, thus two rows for one scope cannot occur. The two facts still show, but in different places, and the split follows one rule: this note tells the user why the fetch did nothing, and the inventory row above it tells the user what limits the next action. Thus such a scope shows `⊘ alpha v1.0.0 (skipped) {already disabled}` in this note, and `◍ alpha v1.0.0 (disabled) {not in manifest}` in the info block.

<!-- catalog-state: mixed-fetch-skipped -->

```text
Some plugin operations need attention.

● mp [project]
  ⊘ alpha v1.0.0 (skipped) {already disabled}

● mp [user]
  ⊘ alpha v2.0.0 (skipped) {not in manifest}
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

### Success -- available single scope that would install disabled (OUT-03 / DFEN-04)

The same not-installed plugin as the state above, whose marketplace ENTRY declares `defaultEnabled: false`. The `info` surface states the fact through the reason brace its row already had, so this render differs from `available-single-scope` by that brace alone: no extra body line, and the description and per-kind component lines are untouched. The two declarations behind the token, and their order, are the ones the `available-installs-disabled` list state sets out; `info` reads them the same way and reads nothing on disk to do it. Severity `info`; no reload-hint (read-only surface): nothing has happened at all, so the row states a fact about a future action rather than a shortfall of a completed one.

<!-- catalog-state: available-installs-disabled -->

```text
● community-mp [user] <no autoupdate>
  ○ chat-helper v0.5.0 (available) {installs disabled}
    Quick chat helper plugin; experimental.
    commands: chat
    skills: chat-init
```

### Success -- remote single scope (RSTA-01 / D-80-04)

Triggered by `plugin info <plugin>@<marketplace>` against a not-installed git-source plugin (source `url` / `git-subdir` / `github`) whose clone/mirror is not yet materialized locally. The status glyph switches to `◌` (`ICON_REMOTE`, per `pluginInfoStatusGlyph`) and the row reads `(remote)`, replacing the manifest-only `(available)` over-claim (RSTA-01). Because nothing is fetched there is no warm tree to resolve, so the `componentsResolved: false` arm fires and emits the `components: not resolved` marker (existing wording preserved, D-80-04). Severity `info`.

<!-- catalog-state: remote-single-scope -->

```text
● community-mp [user] <no autoupdate>
  ◌ git-helper v0.5.0 (remote)
    Git-source helper plugin; not yet fetched.
    components: not resolved
```

### Disabled inventory row (D-54-01 / ENBL-04 / ENBL-17)

The `info` surface conveys a recorded-but-disabled plugin via the SAME `(disabled)` token the list surface uses (see [`## /claude:plugin list`](#claudeplugin-list) `disabled-inventory` catalog state). That the row reports the plugin as disabled is preserved behavior, not new behavior.

What is new is the path. The orchestrator renders this row through the standalone `PluginInfoMessage` variant, and through the same block builder that every other installation record uses (ENBL-17). Earlier releases sent it through the cascade path (list-arm marketplace header + `PluginDisabledMessage` row) and showed no component block. Thus this row now carries lines the list-surface row does not: a description when the manifest supplies one, and the per-kind component inventory, which the disable preserves (ENBL-18).

A manifest that still declares the plugin supplies the description and the components, exactly as it does for a not-installed plugin, and the row carries no reason brace. A manifest that no longer declares it sends every line to the installation record; for that byte form see the state below. Severity `info`; no reload-hint.

### Success -- disabled from the installation record (ENBL-16 / ENBL-17)

The state record carries the explicit `enabled: false` marker (ENBL-05), and the marketplace manifest loads correctly but does not declare the plugin. Every line comes from the installation record. The manifest declares nothing about this plugin, and the disable deleted the materialized artifacts (ENBL-02), thus neither can supply a line. Disable preserves the record's component inventory (ENBL-18), and that inventory is what this state reports.

The hook entries come from the record's `hookEntries` key. For a disabled plugin this key is the ONLY source, because the materialized hooks configuration that the enabled states above read is gone. A record written before the key existed shows no `hooks:` line, because there is no file left to fall back to (D-100-03).

No description line and no dependencies line show. The manifest is the only source of both, and this state does not reconstruct them -- the same limit that the `state-only-installed-single-scope` state above records.

This row can carry two kinds of reason: manifest absence, and the failure class (`source missing`, `unreadable`, `permission denied`, `network unreachable`, `authentication required`). A disabled record whose install-time resolution dropped a component kind keeps its unsupported-kind tokens hidden, and the soft-dependency markers cannot appear (ENBL-15 / D-100-06). The governing rule: report the durable facts that limit what the user can do next, and hide the facts about runtime behavior that the disable suspended. `/claude:plugin enable` re-runs the install ledger against the manifest AND against the plugin source, thus a name the manifest no longer declares and a source that cannot be read both stop the user from enabling the plugin again. A dropped component kind describes a runtime that is not running, thus it stays hidden until the plugin runs again.

The version and the inventory can disagree. `/claude:plugin update` on a disabled plugin moves the version pin, the source and the compatibility block, and it changes no component (ENBL-02 keeps the disable in force, thus nothing is materialized). The inventory continues to describe the last installation. Thus, after `disable` then `update`, this row shows the new version above the components of the old one. The pin says what the next `enable` will install; the inventory says what the last install put on disk. Only `enable` makes the two agree.

The example below carries no failure reason, because the record supplies its hook entries through the `hookEntries` key and the state reads no file. A record written before that key existed names a hooks container that the disable deleted, thus the read fails and the row adds the read reason -- `{not in manifest, source missing}` for the usual case. This is the same read, and the same four tokens, that the `state-only-installed-hooks-degraded` state above records for an enabled record (D-96-03). The list surface shows no such reason on its own disabled row, because that surface reads no file at all (ENBL-16 / D-100-07).

Severity `info`; no reload-hint (read-only surface).

<!-- catalog-state: state-only-disabled-with-components -->

```text
● mp [user] <no autoupdate>
  ◍ alpha v1.0.0 (disabled) {not in manifest}
    hooks:
      SessionStart
      PostToolUse(Read)
    skills: alpha-skill
```

### Success -- unavailable single scope

Triggered when `resolveStrict` returns `state: "partially-available" | "unavailable"` for the plugin entry. USTAT-01 / D-64-01: the not-installed info row uses the resolver state. Its bytes match the list surface.

A structurally malformed plugin resolves to `unavailable`. Structural errors include invalid or schema-invalid `hooks/hooks.json`, unreadable or non-path sources, and broken `mcpServers` references. A broken reference uses the `{malformed mcp}` reason (MCPR-03 / D-02). The row uses the `⊘` glyph and the `(unavailable)` status.

A partially available plugin has typed unsupported kinds. These kinds include `lspServers`, workflows, other unsupported components, and supported subsets of `hooks.json`. The row uses the `⊖` glyph and the `(partially-available)` status (D-71-03 / PHOOK-03). After installation, the inventory row renders `(partially-installed)`.

Each row has one closed-set reason block. The structural arm uses `narrowResolverNotes` for `{unsupported source}` or `{malformed mcp}`. The partial arm uses `narrowUnsupportedKinds` for `{unsupported hooks}`, `{lsp}`, `{unsupported component}`, or `{workflows}`.

The example shows malformed `hooks.json`, so the row remains `⊘ (unavailable)`. Sources without a readable materialized tree use `componentsResolved: false`. Component-read failures also use that value. Then the renderer writes `components: not resolved` instead of the component list. For a path source or warm git source, the renderer tries to enumerate components for both non-installable states. It sets `componentsResolved` to `true` when that read succeeds.

Severity is `info` on this surface. Neither resolver state is a failed command. Only the `failed` status uses error severity.

<!-- catalog-state: unavailable-single-scope -->

```text
● community-mp [user] <no autoupdate>
  ⊘ legacy-plugin v0.1.0 (unavailable) {unsupported hooks}
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

### Multi-scope fan-out -- the record is in both scopes and in no manifest (INFO-09)

The manifest loads in both scopes and declares the plugin in neither, and each scope holds an installation record. Both blocks thus show `(installed) {not in manifest}`, and the pair renders as ONE `info`-severity cascade in project-first order, with one blank line between the blocks. Before this state, the same input made TWO `error`-severity notifications, each with its own summary line, because both blocks were `(failed)`. The change follows the outcome: an installation record that outlived its manifest entry is not a failure. The `(failed)` separation itself does not change. A block that IS a failure is still surfaced as its own `error` notification with its summary line, because a failure in one scope must not hide behind a healthy other scope (GRAM-04). Severity `info`; no reload-hint (read-only surface).

<!-- catalog-state: state-only-installed-both-scopes-fan-out -->

```text
● mp [project] <no autoupdate>
  ● alpha v1.0.0 (installed) {not in manifest}
    skills: alpha-skill

● mp [user] <no autoupdate>
  ● alpha v1.0.0 (installed) {not in manifest}
    skills: alpha-skill
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

Triggered when the marketplace IS added in the requested scope but its `marketplace.json` does NOT contain a plugin entry with the requested name. The orchestrator emits a `PluginInfoMessage` with `plugin.status: "failed"` + `reasons: ["not in manifest"]`; the renderer composes the marketplace header at column 0 followed by the failed plugin row at 2-space indent. The `{not in manifest}` REASON is the same closed-set member that `update.ts` uses post-Phase 29 / UXG-08 for the same failure semantics; this catalog state extends its surface to the new `plugin info` command. Two-block form: the `A plugin operation has failed.` summary (the failed row is a PLUGIN subject, GRAM-02) on the host `Error:` label line, then the header + failed row as its own block (GRAM-01). Severity `error`; no reload-hint (info surfaces are read-only per SNM-33).

<!-- catalog-state: missing-plugin-not-in-manifest -->

```text
A plugin operation has failed.

● mp [user] <no autoupdate>
  ⊘ ghost-plugin (failed) {not in manifest}
```

### Failure -- missing marketplace (no `--scope` filter)

Triggered when `plugin info <plugin>@<marketplace>` is invoked against a marketplace name that is NOT present in EITHER scope. The orchestrator emits the standalone `MarketplaceNotAddedMessage` variant (`kind: "marketplace-not-added"`) with `name` set to the MARKETPLACE name (not the plugin name -- the user-facing failure is "the marketplace is not added", not "the plugin doesn't exist"); `scope` is OMITTED so the renderer's bracket short-circuit suppresses the `[scope]` token (D-03: absent-from-both states have no scope bracket because the marketplace is in neither scope). The renderer emits the bare row at column 0 with no marketplace header. Two-block form: the `A marketplace operation has failed.` summary on the host `Error:` label line, then the bare detail row as its own block (GRAM-01 / GRAM-02). Severity `error`; no reload-hint.

<!-- catalog-state: missing-marketplace-not-added-absent-from-both -->

```text
A marketplace operation has failed.

⊘ ghost-mp (failed) {marketplace not added}
```

### Failure -- missing marketplace (`--scope` mismatch)

Triggered when `plugin info <plugin>@<marketplace> --scope <wrong-scope>` is invoked against a marketplace present only in the OTHER scope. The renderer emits the same bare-row form as the absent-from-both variant above, but WITH the `[scope]` bracket because the user explicitly asked for a specific scope. This is the plugin-info-surface mirror of the `scope-mismatch-not-added` state under `marketplace info`; the distinction from `missing-marketplace-not-added-absent-from-both` is the bracket presence (no bracket when neither scope holds the marketplace; bracket present when a specific scope was requested). Two-block form: the `A marketplace operation has failed.` summary on the host `Error:` label line, then the bare detail row as its own block (GRAM-01 / GRAM-02). Severity `error`; no reload-hint.

<!-- catalog-state: missing-marketplace-not-added-scope-mismatch -->

```text
A marketplace operation has failed.

⊘ ghost-mp [user] (failed) {marketplace not added}
```

______________________________________________________________________

## `/claude:plugin pending`

DIFF-01 SC #2 / D-53-01 read-only diff/pending surface. Renders the bidirectional difference between the merged config (`claude-plugins.json` + `claude-plugins.local.json`) and the recorded state (`state.json`) for the next reload's reconcile. Runs against both scopes when `--scope` is omitted. NEVER writes any file, NEVER touches the network (NFR-5). Running it twice produces byte-identical output (DIFF-01 SC #2). DIFF-02: rows render subject-first `<glyph> <name> [<scope>] (will ...)` with the closed-set pending-tense token set (`will install` / `will uninstall` / `will enable` / `will disable`). WILL-01 / D-65.1-02 / D-65.1-03: marketplace add/remove carry no pending token -- add is immediate, and a remove surfaces its reload-deferred plugin-uninstall cascade as per-plugin `will uninstall` rows under a bare header. The `/reload to pick up changes` trailer is STRUCTURALLY EXCLUDED -- pending rows are pre-transition and the trailer would mislead the user.

### Empty steady-state (no actions pending)

The merged config matches the recorded state byte-for-byte in every scope -- the next reload's reconcile would apply zero actions. The orchestrator emits a free-form advisory body line (no cascade, no marketplaces array projection). Severity `info`; no reload-hint; no summary line.

<!-- catalog-state: empty-steady-state -->

```text
Pending: next reload will apply 0 actions.
```

### Marketplace add with child plugin install

A new marketplace declared in `claude-plugins.json` carries one child plugin row declared with the same key (`will install`). WILL-01 / D-65.1-02: the marketplace add is immediate, so its header carries no `will add` token and renders status-less (list-arm bare header); only the reload-deferred child install carries a pending token. Subject-first row grammar per DIFF-02: `● new-mp [user]` / `● new-plugin (will install)`. Orphan-fold (D-13-18 / MSG-PL-6): the plugin row omits its `[scope]` bracket because its scope matches the parent marketplace's scope. Severity `info`; no reload-hint.

<!-- catalog-state: mp-add-plugin-install -->

```text
● new-mp [user]
  ● new-plugin (will install)
```

### Marketplace add with child plugin partial install (FSTAT-06 / D-66-04)

A new marketplace whose child plugin would resolve `partially-available` when installed: the no-network candidate resolve degrades, so the pending row carries the `partial` modifier and renders `(will partially install)` in place of `(will install)`. The token is a render MODIFIER on the existing `will install` discriminator, NOT a new closed-set token; there is deliberately no `will partially update` analog (the reconcile plan has no update bucket -- D-66-05). Severity `info`; no reload-hint.

<!-- catalog-state: mp-add-plugin-partial-install -->

```text
● new-mp [user]
  ● degraded-plugin (will partially install)
```

### Plugin pending uninstall under existing marketplace

A plugin recorded in `state.json` but no longer declared in `claude-plugins.json`. The marketplace itself is still declared (source matches the recording) so its header renders status-less (list-arm: SUB-BRANCH A bare header) and only the plugin row carries the `(will uninstall)` token (`○` glyph -- the pre-transition analog of the realized `(uninstalled)` open-circle row). Severity `info`; no reload-hint.

<!-- catalog-state: plugin-pending-uninstall -->

```text
● mp [user]
  ○ old-plugin (will uninstall)
```

### Marketplace remove with installed plugins

A marketplace recorded in `state.json` but no longer declared in `claude-plugins.json`, still carrying installed plugins. WILL-03 / D-65.1-03: de-registering the marketplace record is immediate (no `will remove` marketplace token), so its header renders status-less (list-arm bare header); the reload-deferred work is the plugin-uninstall cascade, surfaced as one `(will uninstall)` row per recorded plugin (`○` glyph). Severity `info`; no reload-hint.

<!-- catalog-state: marketplace-remove-with-installed-plugins -->

```text
● old-mp [user]
  ○ p1 (will uninstall)
  ○ p2 (will uninstall)
```

### Enable / disable transitions

A marketplace with two plugin children: one newly enabled in config (`will enable`, `●` glyph) and one newly disabled (`will disable`, `◍` glyph). Severity `info`; no reload-hint.

<!-- catalog-state: enable-disable-transitions -->

```text
● mp [user]
  ● to-enable (will enable)
  ◍ to-disable (will disable)
```

### Source mismatch (declared source diverges from recorded source)

A declared marketplace whose recorded source string does not match the declaration byte-for-byte (the apply path cannot honour the declaration without first removing the recording). The row reuses the existing `"source mismatch"` REASONS member (REASONS stays at 32 entries). Severity `error` (a `(failed)` mp row); summary line prepended (GRAM-01 / GRAM-02): `A marketplace operation has failed.`.

<!-- catalog-state: source-mismatch -->

```text
A marketplace operation has failed.

⊘ mp [project] (failed) {source mismatch}
```

### Invalid config abort (CFG-03 -- Pitfall 53-1)

A `claude-plugins.json` (or `claude-plugins.local.json`) that is malformed, unparseable, or schema-invalid. The orchestrator routes the scope through a structured `(failed) {invalid manifest}` row and does NOT call `planReconcile` for it -- invalid input is NEVER silently coerced to an empty desired state (which would otherwise render as a mass-uninstall pending list). The row body carries the file BASENAME (never the absolute path -- RESEARCH Security Threat Pattern "Information disclosure" T-53-02-02). Severity `error`; summary line prepended.

<!-- catalog-state: invalid-config-abort -->

```text
A marketplace operation has failed.

⊘ claude-plugins.json [project] (failed) {invalid manifest}
```

______________________________________________________________________

## reconcile-applied-cascade

RECON-04 (Phase 55 Plan 02) load-time reconcile apply cascade emitted by `applyReconcile` after every `resources_discover` invocation that performed at least one apply action OR carried at least one invalid-config / source-mismatch row. Wraps the same per-status `MarketplaceNotificationMessage[]` shape the cascade arm carries -- realized transition tokens (`added` / `removed` / `installed` / `uninstalled` / `disabled` / `failed`) reused per RESEARCH Pattern 5 Option A -- so the rendered bytes match each token's standalone-command counterpart. The `Run /reload to pick up changes` trailer is STRUCTURALLY EXCLUDED (RECON-04 -- the reconcile already ran ON /reload). OUT-03/OUT-06/D-03/D-04: a reconcile apply is a plural mixed-subject operation, so a trailing per-operation tally (`Reconcile: <n> failure(s), <n> warning(s), <n> success(es)`) is appended as the cascade's FINAL block, counting all marketplace + plugin rows uniformly under the `Reconcile` operation name (the reload-hint slot the apply structurally suppresses). Empty-and-clean reconciles are silent (no notify) per the load-time silence contract (NFR-2 / A4).

### Success cascade -- mixed marketplace add + plugin install across both scopes

A reconcile that materialized one new marketplace + one plugin install per scope. Subject-first row grammar; the `(added)` mp row carries the `●` glyph and the `(installed)` plugin row reuses the standalone-install byte form. Severity `info`; no reload-hint; no summary line. OUT-03/OUT-06/D-03/D-04: a reconcile apply is a plural mixed-subject operation, so the trailing tally (`Reconcile: 4 successes`) counts the two `added` marketplace rows + the two `installed` plugin rows uniformly under the operation name; it takes the reload-hint's structural slot (the reconcile already ran ON /reload, so no `/reload` trailer follows).

<!-- catalog-state: success-cascade-mixed -->

```text
● new-mp [project] (added)
  ● new-plugin (installed)

● other-mp [user] (added)
  ● other-plugin (installed)

Reconcile: 4 successes
```

### Soft-fail per-entry -- one (failed) {network unreachable} row, other entries continue

A reconcile where one declared github-source marketplace failed during `addMarketplace` clone (NFR-5 per-entry soft-fail) but a sibling declared marketplace + plugin install succeeded. Severity `error` (the cascade has a failed mp row); summary line prepended.

<!-- catalog-state: soft-fail-mixed -->

```text
A marketplace operation has failed.

⊘ flaky-mp [user] (failed) {network unreachable}

● ok-mp [user] (added)
  ● ok-plugin (installed)

Reconcile: 1 failure, 2 successes
```

OUT-03/D-04: the mixed-subject tally counts the failed marketplace row as one failure and the `added` marketplace + `installed` plugin rows as two successes, all under the `Reconcile` operation name.

### CFG-03 invalid-config row -- BASENAME only (T-55-02-01)

A reconcile where `claude-plugins.json` is unparseable. The read pass surfaces the scope as `(failed) {invalid manifest}` carrying the file BASENAME (never the absolute path -- T-55-02-01 / T-53-02-02 information-disclosure mitigation); that scope's apply pass is skipped (CFG-03 abort -- never a mass-uninstall). Severity `error`; summary line prepended.

<!-- catalog-state: invalid-config-row -->

```text
A marketplace operation has failed.

⊘ claude-plugins.json [project] (failed) {invalid manifest}

Reconcile: 1 failure
```

### CFG-03 invalid-config row -- with cause-chain trailer (I5 / PR #51)

Same CFG-03 surface as above, but the read pass threaded `loadConfig`'s diagnostic detail (EACCES / JSON-parse / schema key) into the rendered cause-chain trailer via a synthetic plugin child. Absolute paths are stripped at the boundary via `redactAbsolutePaths` (T-53-02-02 / T-55-02-01 information-disclosure mitigation) -- the parse / permission detail itself is preserved so the operator can debug without re-loading the file. The synthetic child reuses the SNM-10 pattern (marketplace headers cannot carry a cause; plugin rows can), so adding the trailer required no new MarketplaceNotificationMessage shape.

<!-- catalog-state: invalid-config-row-with-cause -->

```text
Some operations have failed.

⊘ claude-plugins.json [project] (failed) {invalid manifest}
  ⊘ claude-plugins.json (failed) {invalid manifest}
    cause: schema validation failed: /marketplaces: Expected object

Reconcile: 2 failures
```

OUT-03/D-04: both the mp-level failed row and its synthetic failed child are counted, so the plural tally reports `2 failures`.

### Partial marketplace remove -- per-plugin children (I1 / PR #51)

A reconcile-driven `marketplace remove` whose cascade unstaged a subset of the marketplace's plugins and failed others. The orchestrated `RemoveMarketplaceOutcome.partial` arm carries BOTH the unstaged plugin names AND the per-plugin failures; the apply pass renders one row per plugin (○ `(uninstalled)` for unstaged, ⊘ `(failed) {reason}` for failed) under a bare `(failed)` mp header -- mirrors the standalone `marketplace remove` `partial` byte form. Pre-fix the orchestrated arm collapsed the cascade to a single mp-failed row with the first failure's reason, silently dropping the N-1 other rows (D-22-02 violation).

<!-- catalog-state: partial-marketplace-remove -->

```text
Some operations have failed.

⊘ acme-mp [user] (failed)
  ○ plugin-ok (uninstalled)
  ⊘ plugin-fail-a (failed) {permission denied}
  ⊘ plugin-fail-b (failed) {source missing}

Reconcile: 3 failures, 1 success
```

OUT-03/D-04: the plural tally counts the failed mp header + the two failed plugin rows as three failures and the `uninstalled` plugin row as one success (`uninstalled` stamps info), all under the `Reconcile` operation name.

### Load-time backfill -- partially-installed promotion carries the dropped-kinds brace (SEV-05)

BFILL-01 / SEV-05 / D-69-04: a load-time backfill re-materialized a recorded partially-installed plugin in place (its supported set grew, but it still re-resolves `partially-available`). The promotion row reuses the `◉` `(partially-installed)` byte form and now carries a factual `{reasons}` brace composed from the re-resolved dropped-component kinds through the SAME shared `narrowUnsupportedKinds` seam the install / list / info surfaces use -- no per-state reasons mechanism (`installed` / `partially-installed` / `partially-upgradable` rows all route through `composeReasons`). The marketplace was already added, so its header is the bare always-marketplace-header form (no status token). SEV-03 / A3 / D-68-04: a backfill is a benign promotion (re-materializing now-supported components), NOT a new degradation, so the row stays `info` -- the SEV-03 newly-degrades warning fires only on the autoupdate cascade. The `Run /reload` trailer is structurally excluded (RECON-04); the trailing tally counts the row as one success.

<!-- catalog-state: backfill-partially-installed -->

```text
● local-mp [user]
  ◉ hello v1.0.0 (partially-installed) {lsp}

Reconcile: 1 success
```

### Load-time backfill -- no dropped kinds renders brace-less (byte-identical to today)

The degenerate case: a backfill `(partially-installed)` row whose re-resolved dropped-kind set is empty renders brace-less -- `narrowUnsupportedKinds([])` returns `[]`, so `composeReasons` emits no brace and the row is byte-identical to the pre-SEV-05 form. This proves the SEV-05 change is additive: rows WITHOUT reasons do not gain a brace (D-69-04).

<!-- catalog-state: backfill-partially-installed-no-reasons -->

```text
● local-mp [user]
  ◉ hello v1.0.0 (partially-installed)

Reconcile: 1 success
```

### Load-time enable whose companion extension is unloaded (WR-06)

The load-time reconcile re-enabled a config-declared-enabled disabled record, and the ledger staged at least one agent. The projected row derives its `dependencies` from the ledger's staged counts through the SAME seam the standalone `enable` row uses, so the `{requires pi-subagents}` marker fires here too -- it no longer depends on which surface drove the enable. Severity stays `info`: this projection applies the companion raise on NEITHER of its two arms (the sibling `plugin-installed` arm carries the marker at `info` as well), so the two arms of one file agree. The standalone `enable` verb, whose severity rule is the SEV-01 composition, DOES raise -- the marker is the shared fact, the severity stance is per surface.

<!-- catalog-state: reconcile-enable-soft-dep -->

```text
● local-mp [user]
  ● hello v1.0.0 (installed) {requires pi-subagents}

Reconcile: 1 success
```

### Load-time install that lands disabled (DFEN-04 / OUT-01 / OUT-04)

The load-time counterpart of the standalone install-disabled row: the user hand-added a bare `"hello@mp": {}` entry, reloaded, and the plugin's own `defaultEnabled: false` declaration made the install land disabled. This is the COMMON way a plugin arrives inert, and nobody is watching a command run when it happens, so the row carries the same closed-set cause token and the same frozen enable-hint trailer the standalone row carries -- without them it would be indistinguishable from a disable the user asked for. The reload stamp is the one deliberate difference: this row shares the realized-transition arm every other reconcile disable uses, whereas the standalone row stamps `false` because nothing net entered or left Pi's resource view inside that command. The trailing tally counts the row as one success.

<!-- catalog-state: reconcile-install-disabled -->

```text
● local-mp [user]
  ◍ hello v1.0.0 (disabled) {installs disabled}
    Run enable on this plugin to use its components.

Reconcile: 1 success
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
Some operations have failed.

⊘ local-mp [user] (failed)
  ○ helper (uninstalled)
  ⊘ tool (failed) {permission denied}
    cause: EACCES: permission denied

/reload to pick up changes
```

Marketplace header is `failed` (the marketplace remove did not fully complete). Plugin rows mix outcomes: `helper` uninstalled successfully (`○` glyph, `(uninstalled)` token); `tool` failed (`⊘` glyph, `{permission denied}` reason, 4-space-indent cause-chain trailer). Reload-hint fires because at least one plugin is in the state-changing set (`uninstalled` is in the set per D-16-12). Severity: `error` (any failed → error per D-16-11).

The v1.0 free-text retry-anchor trailer (a sentence above the reload-hint instructing the operator to remediate and re-run) is no longer emitted -- it is not expressible in `NotificationMessage` (per D-17-09).

### Failure -- missing marketplace (explicit `--scope`)

Triggered when `marketplace remove <name> --scope <scope>` targets a name that is NOT present in the requested scope (ATTR-06 / S3). The orchestrator's pre-guard existence check routes the miss to the standalone `MarketplaceNotAddedMessage` `{marketplace not added}` variant (`kind: "marketplace-not-added"`, `name`, `scope`) and returns BEFORE entering `withStateGuard` -- no raw `MarketplaceNotFoundError` escapes past the orchestrator (D-48-C Shape 1), and state is left untouched. The variant carries the requested `[scope]` bracket (SCOPE-01). Routed via `isInfoKind` -> `error` severity, no reload-hint. Two-block form: the `A marketplace operation has failed.` summary on the host `Error:` label line, then the bare detail row as its own block (GRAM-01 / GRAM-02).

<!-- catalog-state: remove-missing-not-added -->

```text
A marketplace operation has failed.

⊘ ghost-mp [user] (failed) {marketplace not added}
```

### Failure -- missing marketplace (bare form, absent from both scopes)

Triggered when `marketplace remove <name>` (no `--scope`) targets a name absent from BOTH scopes (ATTR-06 / S4). The bare-form `resolveScopeFromState` `MarketplaceNotFoundError` is caught at the orchestrator entrypoint and routed to the SAME standalone `MarketplaceNotAddedMessage` variant -- but with NO `scope`, so the renderer's bracket short-circuit suppresses the `[scope]` token ("absent from both"). `resolveScopeFromState`'s throw contract is unmodified (it is shared with `update.ts`); the catch lives at the remove entrypoint. Severity `error`; no reload-hint. Two-block form: the `A marketplace operation has failed.` summary on the host `Error:` label line, then the bare detail row as its own block (GRAM-01 / GRAM-02).

<!-- catalog-state: remove-missing-not-added-bare -->

```text
A marketplace operation has failed.

⊘ ghost-mp (failed) {marketplace not added}
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

Autoupdate-ON cascade refresh whose validated `marketplace.json` content was byte-identical pre/post AND whose every cascaded plugin was `unchanged` (up-to-date) (UXG-05). The autoupdate-ON path consults the same content-compare detector as the OFF path (`snapshot.changed === false`) PLUS the cascade outcomes (`outcomes.every(o => o.partition === "unchanged")`). `unchanged` is the ONLY partition that qualifies, and it is narrow by construction: it means the resolved version matched the record exactly and nothing was written. Every other partition leaves the gate -- `updated` and `failed` obviously, and `skipped` too, including the disabled-record re-pin the next state shows (WR-10), because a re-pin writes to the record even though it materializes no artifacts. When both conditions hold, the marketplace converges to the SAME `(skipped) {up-to-date}` byte form as the autoupdate-OFF no-op -- the all-`unchanged` cascade rows are dropped (`plugins: []`), so this is byte-identical to the OFF no-op (a distinct mp name, `official`, matches the autoupdate-ON cascade examples in this section). `mp.status = "skipped"`, `mp.reasons = ["up-to-date"]`. Severity: `info` -- `up-to-date` is benign, so this no-op computes info (the second arg is omitted) per UXG-02 / D-28-06/07. No reload-hint: with no plugin children there is no Pi-visible resource change (SNM-33 / D-22-01 / G-MIL-06). This is exactly what the Phase 27 UAT Test-3 gap missed: prior to the fix the autoupdate-ON branch emitted `status: "updated"` unconditionally and never consulted `snapshot.changed`, so a true no-op on an autoupdate-ON marketplace (e.g. `claude-plugins-official`) always rendered `(updated)`.

### Autoupdate-on cascade -- a disabled record's pin moved (WR-10)

<!-- catalog-state: update-autoupdate-disabled-repin -->

```text
● disabled-mp [user] (updated)
  ⊘ hello (skipped) {already disabled}
```

The near miss of the no-op above, and the reason the gate keys on `unchanged` alone. The hash-version ladder is CONTENT-derived, so a plugin's files can move while `marketplace.json` stays byte-identical: `snapshot.changed` is `false`, but the plugin's pin moved. Over a DISABLED record the update rewrites the record's version, `resolvedSource`, `resolvedSha` and `compatibility` block and then declines to re-materialize artifacts -- an `ENBL-09` refresh, reported as `skipped` with the idempotent `already disabled` reason. That outcome is not `unchanged`, so it leaves the no-op gate and the marketplace renders `(updated)` with the row underneath. Collapsing it to `(skipped) {up-to-date}` would restate at the marketplace level the same false version claim the plugin row itself stopped making. Severity `info` -- `already disabled` is in the benign idempotent set, so the row and the notification both compute info (the second arg is omitted) and no summary line is emitted. No reload-hint: a `skipped` plugin row materialized nothing (SNM-33 / D-22-01).

### Autoupdate-on cascade -- a plugin the refreshed manifest no longer declares (LIFE-06)

<!-- catalog-state: update-autoupdate-cascade-not-in-manifest -->

```text
A plugin operation needs attention.

● auto-skip [user] (updated)
  ⊘ hello (skipped) {not in manifest}
```

LIFE-06 / D-98-13: the refreshed `marketplace.json` no longer lists an installed record's entry, so the shared update preflight stamps `partition: "skipped"` with `reasons: ["not in manifest"]` and `cascadeAutoupdates` passes that outcome through untouched (only a THROW is caught and converted). The cascade row carries NO version token, and the omission is deliberate: `outcomeToCascadePluginMessage`'s `skipped` arm forwards name, scope and reasons only, while the single-plugin `update` surface renders the SAME skip as `⊘ hello v1.0.0 (skipped) {not in manifest}`. Both forms are byte-pinned -- the cascade one in `tests/orchestrators/marketplace/update.test.ts`, the version-carrying one in `tests/orchestrators/plugin/update.test.ts` -- so adding a version here would move a locked contract rather than correct a rendering bug. `not in manifest` is failure-class and not idempotent, so `skipSeverity` stamps the row `warning` and the cascade prepends the `A plugin operation needs attention.` summary line. The marketplace header keeps `(updated)`: a `skipped` outcome is not `unchanged`, so it leaves the all-unchanged no-op gate (UXG-05) exactly as the disabled re-pin above does. The record is left untouched -- a skipped plugin is a fixed point for the cascade, so a repeated `marketplace update` renders byte-identically. No reload-hint: a `skipped` plugin row materialized nothing (SNM-33 / D-22-01).

### Autoupdate-off manifest refresh -- changed

<!-- catalog-state: manifest-refresh-changed -->

```text
● local-mp [user] (updated)
```

Manifest-only refresh whose validated `marketplace.json` content actually changed (UXG-05). Bare marketplace `updated` block (no plugin children; `plugins: []` renders as the bare header alone per D-15-08). `mp.status = "updated"`. No reload-hint: with no plugin children there is no Pi-visible resource change, so a manifest-only refresh does not warrant a `/reload` (SNM-33 / D-22-01 / G-MIL-06).

### Mixed plugin outcomes

<!-- catalog-state: mixed-outcomes -->

```text
A plugin operation has failed.

● official [user] (updated)
  ● alpha v0.5.0 → v1.0.0 (updated)
  ⊘ beta (skipped) {up-to-date}
  ⊘ delta (failed) {network unreachable}

/reload to pick up changes
```

Marketplace header carries `(updated)`; plugin rows mix outcomes. Reload-hint fires (multiple state-changing rows). Severity: `error`. The `failed` `delta` row carries no version-arrow because `PluginFailedMessage` has no `from`/`to` fields (only the `updated` variant does per D-15-04).

### Autoupdate cascade takes the partial path -- already-degraded plugin (info)

<!-- catalog-state: autoupdate-partially-installed-already-degraded -->

```text
● official [user] (updated)
  ◉ degraded-plugin v1.0.0 (partially-installed) {lsp}

/reload to pick up changes
```

SEV-03 / D-69-01: the autoupdate cascade TAKES the partial path automatically (`updateSinglePlugin` sets `force: true`), so a partially-upgradable candidate that re-resolves `partially-available` degrades IN PLACE -- the supported components materialize, the unsupported kinds skip -- and renders `(partially-installed) {dropped kinds}` with the dedicated `◉` glyph instead of declining with `(skipped) {no longer installable}`. The byte form REUSES `partiallyInstalledRow` (the SOLE composition site, D-11 "call, never duplicate"), so it is identical to the install / update success surfaces. partially-installed is a realized transition, so the reload-hint fires. This state is the ALREADY-degraded case: the plugin's persisted `compatibility.unsupported` was already non-empty before the auto-update, so re-degrading it is benign -> severity `info` (no summary line). The NEWLY-degraded case (prior `partially-available` empty) raises the row to `warning` -- see `autoupdate-partially-installed-newly-degraded` below. `requirePartialInstallable` still BLOCKS an `unavailable`/structural candidate (FORCE-05), so that arm keeps its `(skipped) {no longer installable}` decline -- `--partial` never bypasses a hard failure.

### Autoupdate cascade takes the partial path -- newly-degraded plugin (warning)

<!-- catalog-state: autoupdate-partially-installed-newly-degraded -->

```text
A plugin operation needs attention.

● official [user] (updated)
  ◉ degraded-plugin v1.0.0 (partially-installed) {lsp}

/reload to pick up changes
```

SEV-03 / D-69-01: the SAME `(partially-installed)` autoupdate row as the already-degraded state above, but here the auto-update NEWLY degrades a previously-clean plugin -- the plugin's PERSISTED `compatibility.unsupported` was EMPTY before the auto-update applied (read from the prior install record, no new tracking, no schema change). An automatic upgrade that silently drops components the user never opted into is actionable, so the row stamps `warning` and the cascade prepends the `A plugin operation needs attention.` summary line. The per-row `◉ degraded-plugin v1.0.0 (partially-installed) {lsp}` bytes are identical to the already-degraded form -- only the stamped severity (and therefore the summary line) moves. The reload-hint still fires (partially-installed is a realized transition). The manual `update --partial` degrade is unaffected -- the explicit opt-in stays `info` (SEV-01); the warning fires ONLY on this autoupdate surface.

### Marketplace update failed (manifest unreachable)

<!-- catalog-state: mp-failure-network -->

```text
A marketplace operation has failed.

⊘ official [user] (failed)
```

Marketplace-level failure with no plugin children evaluated. No reload-hint (failed marketplace does not trigger per D-16-12). Severity: `error`. The cause-chain trailer for failed marketplaces is not emitted by the current `notify()` renderer (the v2 type model places `cause?: Error` on plugin variants only); orchestrators surfacing the cause must do so via a per-plugin manual-recovery or failed row inside the block.

### Marketplace update failed (path-source invalid manifest)

Triggered when `marketplace update <name>` refreshes a PATH-source marketplace whose `marketplace.json` is malformed JSON or schema-invalid (ATTR-10 / D-48-B). `loadMarketplaceManifest` throws the typed `InvalidMarketplaceManifestError`; `refreshRecord` wraps it as `MarketplaceUpdateError`, and the `refreshOneMarketplace` catch classifies it via `reasonsFromCascadeError` (which now recognizes the typed manifest error before the `?? ["network unreachable"]` default) to `{invalid manifest}` -- carried on the synthetic-child failed row (the marketplace header has no `reasons` field for this recipe; the reason rides the child, mirroring `mp-failure-network`). A path-source refresh touches ZERO network (NFR-5), so the former lying `{network unreachable}` default MUST NOT fire here. github-source no-errno failures KEEP `{network unreachable}` as the catch-all (the classification did not collapse). No reload-hint (failed marketplace does not trigger per D-16-12). Severity: `error`. The summary prefix counts the synthetic child as one plugin operation.

<!-- catalog-state: update-path-invalid-manifest -->

```text
Some operations have failed.

⊘ official [user] (failed)
  ⊘ official (failed) {invalid manifest}
```

### Failure -- marketplace not added, explicit scope (SC#1 / ATTR-06 / D-48-C)

Triggered when `marketplace update <name> --scope <scope>` names a marketplace that is NOT added in the requested scope (or is present only in the OTHER scope). SC#1 cross-op convergence: the marketplace-form update now joins `install` / `uninstall` / `reinstall` / `update` (plugin form) / `marketplace remove` / `autoupdate` in routing the marketplace-absent precondition to the SAME standalone `MarketplaceNotAddedMessage` variant -- replacing the former raw `MarketplaceNotFoundError` escape past the orchestrator boundary (the last residual Class-C instance). A single pre-guard `loadState` existence read (NFR-5: network-free) blocks the miss BEFORE it reaches `snapshotAfterRefresh`'s `withStateGuard` throw; the `[scope]` bracket carries the REQUESTED scope (SCOPE-01). Genuine refresh failures (clone/manifest/lock) are untouched -- only `MarketplaceNotFoundError` reroutes here; everything else keeps its `(failed)` cascade (`mp-failure-network` / `update-path-invalid-manifest`). Two-block form: the `A marketplace operation has failed.` summary on the host `Error:` label line, then the bare column-0 detail row as its own block (GRAM-01 / GRAM-02). No cause-chain trailer. Severity `error`; no reload-hint.

<!-- catalog-state: update-missing-not-added -->

```text
A marketplace operation has failed.

⊘ ghost-mp [project] (failed) {marketplace not added}
```

### Failure -- marketplace not added, bare form absent from both scopes (SC#1 / ATTR-06)

Triggered when the bare `marketplace update <name>` form (no `--scope`) names a marketplace that is absent in BOTH scopes. `resolveScopeFromState` throws `MarketplaceNotFoundError`; the pre-guard catches it and emits the same standalone `{marketplace not added}` variant, but with NO `[scope]` bracket (the absent-from-both form: there is no requested scope to report). Byte-identical to `info`'s `missing-marketplace-not-added-absent-from-both` state and to the corresponding `reinstall` / `update` rows -- the cross-op byte convergence SC#1 proves. Severity `error`; no reload-hint.

<!-- catalog-state: update-missing-not-added-absent-from-both -->

```text
A marketplace operation has failed.

⊘ ghost-mp (failed) {marketplace not added}
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

### Partial enable -- component kinds dropped (ENBL-07)

<!-- catalog-state: enable-partial -->

```text
● claude-plugins-official [user]
  ◉ foo-plugin v1.2.3 (partially-installed) {lsp}

/reload to pick up changes
```

ENBL-07 widens the enable ledger's admission gate for a record disabled while soft-degraded (`compatibility.installable: false`), so the re-materialization runs through `requirePartialInstallable` and drops one or more component kinds. The row follows the resolution rather than the verb: plugin row = `PluginPartiallyInstalledMessage` with the dedicated `◉` glyph and the dropped kinds composed through the shared `narrowUnsupportedKinds` seam (FSTAT-07 / D-66-04) -- the same token, glyph and brace `list` renders for the record the enable just wrote, and the reason a `(installed)` row here would contradict the very next `list`. `dependencies` is derived from the ledger's staged counts on BOTH enable arms (WR-06), so a partial re-enable that still staged an agent or an MCP server carries the soft-dep marker alongside the dropped kinds. Severity `info` (no summary line), matching the `install --partial` success row and the still-degraded `plugin-backfilled` arm per SEV-03: the shortfall predates the enable -- the record was already degraded when it was disabled -- so the requested enable was fully carried out and the dropped kinds ride the `{reasons}` brace rather than the severity channel. Reload-hint fires -- a partial re-materialization is still a realized transition. A fully-supported re-enable renders the `enable-fresh` row above unchanged.

### Enable with a degraded component (WARN-01 / D-86-03)

<!-- catalog-state: enable-degraded -->

```text
A plugin operation needs attention.

● claude-plugins-official [user]
  ● foo-plugin v1.2.3 (installed) {malformed skill}

/reload to pick up changes
```

The enable branch runs the SAME install ledger over the SAME bridges as `install`, so a skill or command whose source frontmatter cannot be parsed degrades identically on a re-enable (skill -> synthesized `disable-model-invocation` block; command -> neutralized frontmatter). The row keeps `(installed)` -- a degraded component is installed-but-short, NOT dropped, which is what `(partially-installed)` means -- and carries one `{malformed skill}` / `{malformed command}` token per kind. Severity `warning` with the summary line, the same raise the install success row takes: unlike the ENBL-07 dropped-kind case above, this degrade is one the enable's own ledger just produced, not a shortfall that predated the enable.

### Enable of a plugin with an orphan rewake handler (SURF-05 / D-63-08)

<!-- catalog-state: enable-orphan-rewake -->

```text
● claude-plugins-official [user]
  ● foo-plugin v1.2.3 (installed) {orphan rewake}

/reload to pick up changes
```

The re-materialized `hooks/hooks.json` declares `rewakeMessage` or `rewakeSummary` on a handler WITHOUT `asyncRewake: true`. One token per plugin regardless of N orphan handlers, exactly as on the install row. Severity `info` -- the config bug names itself in the brace; the enable itself was carried out in full. When more than one signal is present they share ONE brace in the install row's emit order: `{orphan rewake, malformed skill, lsp}`.

### Enable of a plugin whose companion extension is unloaded (SEV-01 / WR-06)

<!-- catalog-state: enable-soft-dep -->

```text
A plugin operation needs attention.

● claude-plugins-official [user]
  ● foo-plugin v1.2.3 (installed) {requires pi-subagents}

/reload to pick up changes
```

The re-enable's ledger staged at least one agent, so the row DECLARES the `pi-subagents` companion; `dependencies` is derived from the ledger's staged counts (agents -> `pi-subagents`, MCP servers -> `pi-mcp`), never from a hard-coded empty list. The soft-dep marker rides the same brace as any typed reasons, typed reasons first (MSG-GR-4): a re-enable that also degraded a skill renders `{malformed skill, requires pi-subagents}`. Severity `warning` per SEV-01 -- a declared companion that is not loaded silently degrades an otherwise clean re-enable, the same raise the install row takes for the same ledger run. The two raises COMPOSE: a malformed degrade is `warning` whatever the probe reports, and an unloaded companion is `warning` whatever degraded. A loaded companion -- or a plugin that stages neither agents nor MCP servers -- renders the `enable-fresh` row above unchanged.

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
A plugin operation has failed.

● claude-plugins-official [user]
  ⊘ foo-plugin (failed) {source missing}
```

Triggered when the cached marketplace clone has been deleted between the recorded state and the enable invocation. The orchestrator aborts pre-ledger -- no artifacts are partially materialized, no state mutation occurs, and the config file is unchanged. Severity `error` (the cascade carries a failed row); the summary line names the failed plugin operation per GRAM-02.

### Stale installable gate -- the manifest entry degraded while the plugin was disabled (WR-02 / D-98-03)

<!-- catalog-state: enable-failed-stale-gate -->

```text
A plugin operation has failed.

● claude-plugins-official [user]
  ⊘ foo-plugin v1.2.3 (failed) {lsp}
    Run update --partial on this plugin, then enable it again.
    cause: Plugin "foo-plugin" is not installable: contains lspServers
```

The enable branch derives its ledger gate from the PERSISTED record (ENBL-07 / D-69-01), so a record that was fully installable when the user disabled it runs the strict `requireInstallable` gate. The gate goes stale when the marketplace publishes an unsupported kind into that plugin's manifest entry while the record sits disabled: the live resolution comes back `partially-available`, the strict gate rejects it, and the enable fails. The row names the dropped kinds through the SAME `narrowUnsupportedKinds` seam the `list (partially-upgradable)` inventory row uses, so the `{lsp}` brace is byte-identical across the two surfaces, and it carries its own frozen remediation trailer (`STALE_GATE_UPDATE_HINT_TRAILER`): `update --partial` re-pins the record against the current manifest entry, after which `enable` takes the partial gate and re-materializes the supported components. CR-01: the trailer NAMES `update` rather than saying "re-run", because the command that failed is `enable`, and `enable` rejects `--partial` with an `Unknown flag` usage error -- the XSURF-03 update-decline trailer is truthful only where the failed command IS `update`. The trailer fires ONLY on this narrowing -- every other producer of a `(failed)` row omits `partialHint` and stays byte-frozen. The cause-chain trailer keeps its position below the hint. Fail-clean: the record stays disabled, every `resources.*` array stays empty, and no artifact is staged. Severity `error`; no reload-hint.

### Not installed -- marketplace present, plugin row absent

<!-- catalog-state: enable-not-installed -->

```text
A plugin operation has failed.

● claude-plugins-official [user]
  ⊘ foo-plugin (skipped) {not installed}
```

Triggered when the marketplace container is recorded in the target scope but the plugin row is absent from state.json (never installed, or concurrently uninstalled). Mirrors the reinstall/update precedent: `{not in manifest}` is reserved for "plugin absent from a PRESENT manifest"; "marketplace present, plugin not installed" is the actionable `(skipped) {not installed}` skip (ATTR-08 taxonomy). D-01: nothing was enabled or disabled, so the operation was NOT carried out and the row stamps `error` with the `A plugin operation has failed.` summary -- the same stamp `uninstall`'s already-gone row, `update`'s cascade skip, and `reinstall`'s in-scope skipped arm apply to the identical `{not installed}` reason set. `(skipped)` remains the status token; severity is the separate tri-state axis. No reload-hint. The same arm fires for `disable` (the orchestrator's not-recorded outcome is shared by both verbs).

### Not installed -- marketplace one scope over (SCOPE-01)

<!-- catalog-state: enable-not-installed-cross-scope -->

```text
A plugin operation has failed.

● claude-plugins-official [project]
  ⊘ foo-plugin (skipped) {not installed, marketplace in user scope}
```

Triggered when `enable`/`disable` names an explicit `--scope` whose state.json holds no such marketplace container, while the OTHER scope does. Nothing of that marketplace is installed at the scope the operator named, so the PLUGIN is the row's subject (a marketplace absent from BOTH scopes keeps the `enable-marketplace-not-added` row instead). The brace then carries TWO facts, because the two absent-target misses take two different remedies: `{not installed}` alone (the `enable-not-installed` state above) means the container is right here and the fix is to install the plugin; the joined `{not installed, marketplace in user scope}` means the container is one scope over, so the fix is to target that scope or add the marketplace at the one named. `marketplace in user scope` is a CONTENT reason -- its subject is the plugin row it rides, not the marketplace -- which is why it JOINS `not installed` rather than replacing it, unlike the three structural `marketplace not added*` markers. The scope word names where the container IS, so it is always the OPPOSITE of the row's `[scope]` bracket. Severity `error`; no reload-hint.

### Marketplace not added (ENBL / SCOPE-01)

<!-- catalog-state: enable-marketplace-not-added -->

```text
A marketplace operation has failed.

⊘ ghost-mp [user] (failed) {marketplace not added}
```

Triggered when the requested marketplace is not added in EITHER scope. Routes through the standalone `MarketplaceNotAddedMessage` variant (`{marketplace not added}` on the marketplace subject) -- same pattern as install (ATTR-01..04). SCOPE-01: a marketplace present only in the OTHER scope does NOT reach this state; nothing is installed at the requested scope, so the row's subject is the PLUGIN and it renders the `enable-not-installed` state. Severity `error`; no reload-hint.

### Invalid config (CFG-03)

<!-- catalog-state: enable-invalid-config -->

```text
A plugin operation has failed.

● claude-plugins-official [user]
  ⊘ foo-plugin (failed) {invalid manifest}
```

Triggered when the target config file (`claude-plugins.json` or, with `--local`, `claude-plugins.local.json`) fails CFG-03 validation (0-byte, malformed JSON, or schema-invalid). The orchestrator aborts BEFORE entering the cascade -- state.json mtime is UNCHANGED. The `cause:` summary cites `path.basename(targetConfigPath)` (the file basename only, never the absolute path; T-53-02-02 information-disclosure mitigation reused from Phase 53). Severity `error`; no reload-hint.

______________________________________________________________________

## `/claude:plugin disable <plugin>@<marketplace>`

D-54-01 / ENBL-02. Removes a plugin's materialized artifacts (skills/commands/agents/MCP entries) via the existing uninstall cascade while PRESERVING the state record's `version` / `resolvedSource` / `compatibility` / `installedAt` fields. Every `resources.*` array is PRESERVED exactly, and the `compatibility` block is carried over unchanged (ENBL-18 / D-100-10: disable changes `enabled` and `updatedAt` and nothing else, so the record keeps describing what the plugin installed). The load-bearing "currently disabled" marker is the explicit `enabled: false` boolean alone (`persistence/state-io.ts::isRecordedButDisabled`); the retained arrays are no part of the marker, and availability is an orthogonal axis. The config file gains `enabled: false` for the entry; `--local` targets the local file. The cascade-row form uses the closed-set `(disabled)` PluginStatus token -- the SAME glyph + token as the list/info `disabled-inventory` row, version slot kept (v1.12 milestone UAT-03 decision, 2026-06-11, superseding the original `(uninstalled)`-token choice: a disable is not an uninstall, and the row should name the state the plugin entered). The reload-hint still fires: the orchestrator dispatches the cascade with the `disable-cascade` kind, the SNM-33 carve-out under which a `(disabled)` row counts as a realized transition; kind-less list/info inventory surfaces stay hint-free.

### Fresh disable

<!-- catalog-state: disable-fresh -->

```text
● claude-plugins-official [user]
  ◍ foo-plugin v1.2.3 (disabled)

/reload to pick up changes
```

Fresh disable -- a previously-enabled plugin's artifacts are unstaged via `cascadeUnstagePlugin`. Plugin row = `PluginDisabledMessage` (status: `"disabled"`, byte-identical to the `disabled-inventory` row); the cascade is dispatched with the `disable-cascade` kind, so the reload-hint fires (artifacts were removed -- SNM-33 / UAT-03). Severity `info`.

### Idempotent disable

<!-- catalog-state: disable-idempotent -->

```text
● claude-plugins-official [user]
  ⊘ foo-plugin (skipped) {already disabled}
```

Idempotent no-op -- the plugin is already disabled (the state record carries `enabled: false`). Plugin row = `PluginSkippedMessage` carrying `reasons: ["already disabled"]`; `already disabled` is in `BENIGN_REASONS`, so the cascade routes to `info` severity. No reload-hint.

### Marketplace not added

<!-- catalog-state: disable-marketplace-not-added -->

```text
A marketplace operation has failed.

⊘ ghost-mp [user] (failed) {marketplace not added}
```

Triggered when the requested marketplace is not added in the resolved scope (or is present only in the OTHER scope). Routes through the standalone `MarketplaceNotAddedMessage` variant. Severity `error`; no reload-hint.

### Invalid config (CFG-03)

<!-- catalog-state: disable-invalid-config -->

```text
A plugin operation has failed.

● claude-plugins-official [user]
  ⊘ foo-plugin (failed) {invalid manifest}
```

Triggered when the target config file fails CFG-03 validation. The orchestrator aborts BEFORE entering the cascade -- state.json mtime is UNCHANGED. The `cause:` summary cites `path.basename(targetConfigPath)` (basename only; T-53-02-02 mitigation). Severity `error`.

______________________________________________________________________

## `/claude:plugin marketplace autoupdate|noautoupdate <name>`

Marketplace-only flag flip. The orchestrator emits a single marketplace block with no plugin children; the block's `mp.status` discriminates between the V2 outcomes. V2 distinguishes six user-visible states for this surface: fresh-flip enable, fresh-flip disable, idempotent enable (no-op), idempotent disable (no-op), and -- when the marketplace persistence record cannot be found -- the standalone `{marketplace not added}` failure in two forms (explicit `--scope` carrying the scope bracket, and the bare absent-from-both form; ATTR-05 / D-48-C Shape 1). The per-state catalog blocks below give the exact byte form for each outcome. UXG-04: the flip surface now renders the autoupdate state as the `<autoupdate>` / `<no autoupdate>` marker (byte-form parity with the list surface), reversing the Phase 17.1 / D-18-05 status-token design; fresh flips render the bare marker, idempotent no-ops render the marker plus an `{already autoupdate}` / `{already no autoupdate}` idempotence brace. This shares byte form with the list-surface markers documented under [`## /claude:plugin marketplace list`](#claudeplugin-marketplace-list), but the two surfaces differ: the **list** surface conveys autoupdate-off by marker _absence_ (it emits `<autoupdate>` iff `mp.details.autoupdate === true`, with no off-marker), whereas this **flip** surface emits the explicit `<no autoupdate>` off-marker. The `<no autoupdate>` off-marker is therefore emitted only on this flip surface, never on the list surface (UXG-04 does not change the list surface).

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

Triggered when `marketplace autoupdate <name> --scope <scope>` (or `noautoupdate`) targets a name NOT added in the requested scope (ATTR-05 / S1). The explicit-scope `MarketplaceNotFoundError` raised by `applyAutoupdateFlipInPlace` is a missing-marketplace precondition, NOT a flip failure -- the orchestrator routes it to the standalone `MarketplaceNotAddedMessage` `{marketplace not added}` variant (`kind: "marketplace-not-added"`, `name`, `scope`) carrying the requested `[scope]` bracket (D-48-C Shape 1). This supersedes the former reason-less / synthetic-child `{not found}` byte form: the reason is now the truthful `{marketplace not added}`. Routed via `isInfoKind` -> `error` severity, no reload-hint. Two-block form: the `A marketplace operation has failed.` summary on the host `Error:` label line, then the bare detail row as its own block (GRAM-01 / GRAM-02). A `StateLockHeldError` is NOT a missing-marketplace and keeps its separate synthetic-child `(failed) {lock held}` routing (unchanged by ATTR-05).

<!-- catalog-state: autoupdate-missing-not-added -->

```text
A marketplace operation has failed.

⊘ missing-mp [user] (failed) {marketplace not added}
```

### Failure -- missing marketplace (bare form, absent from both scopes)

Triggered when `marketplace autoupdate <name>` (no `--scope`) targets a name absent from EVERY iterated scope (ATTR-05 / S2). The former byte form was a reason-LESS bare `(failed)` row; it is superseded by the SAME standalone `MarketplaceNotAddedMessage` `{marketplace not added}` variant. The bare form carries `first.scope` -- the scope where the first not-found was observed; SC-6 iterates project-before-user, so the bracket is `[project]`. Severity `error`; no reload-hint. Two-block form: the `A marketplace operation has failed.` summary on the host `Error:` label line, then the bare detail row as its own block (GRAM-01 / GRAM-02).

<!-- catalog-state: autoupdate-missing-not-added-bare -->

```text
A marketplace operation has failed.

⊘ missing-mp [project] (failed) {marketplace not added}
```

The blocks above span two ladders. The severity ladder runs fresh → info, benign skipped → info, failed (and the `{marketplace not added}` precondition miss) → error (per D-16-11 + Phase 17.1's mp-level skipped extension, refined by UXG-02 / D-28-06: the two idempotent autoupdate no-ops carry benign reasons -- `already autoupdate` / `already no autoupdate` -- so they compute info, not warning; an mp-level `skipped` with non-benign or missing reasons would still route to warning). The reload-hint ladder is uniform here: every autoupdate flag flip suppresses the trailer (per SNM-33 / D-22-01 / D-22-03). The autoupdate flag lives on a marketplace record, not on any Pi-visible resource, so neither a fresh flip nor an idempotent no-op nor a missing-marketplace `{marketplace not added}` failure contributes to "/reload to pick up changes" -- only a plugin row state change does.

______________________________________________________________________

## Manual recovery anchors

In v2, the manual-recovery surface is the per-plugin `PluginManualRecoveryMessage` variant emitted inside a marketplace block. The v1.0 system-level `install-failure-with-anchor` state (a top-level `(manual recovery)` line decoupled from the failed install row) is retired per D-17-10 -- the v2 type model has no system-level free-form recovery anchor field.

### Per-plugin manual-recovery row inside a marketplace block

<!-- catalog-state: per-plugin-manual-recovery -->

```text
A plugin operation needs attention.

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

### Stop hook override cap reached (STOP-07 / D-88-01)

<!-- catalog-state: stop-override-cap -->

```text
Stop hook override cap reached.

`ralph-wiggum`'s Stop hook blocked 8 times in a row; the turn ended despite its active block.
```

Emitted exactly once by the settle dispatcher (`extensions/pi-claude-marketplace/bridges/hooks/settle.ts`) via `notifyStopHookOverrideCap` when Stop hooks drive 8 consecutive bridge re-entries -- block decisions and `additionalContext` continuations share one consecutive-re-entry counter (D-88-08). The loop protection (STOP-07) suppresses the 8th re-entry so a livelocking hook cannot spin the agent forever, and this warning surfaces the override so the suppression is never silent (D-88-01 transparency). Severity: `warning` (the second arg to `ctx.ui.notify` is the magic string `"warning"`) -- the turn ended (the protection worked) but the plugin's block was overridden. The one-shot latch is per-session: a plain-allow outcome with no re-entry resets the counter and re-arms it (D-88-08), so a fresh 8-re-entry run is required before the warning fires again. The literal example names a mock `ralph-wiggum` plugin; the production string interpolates the blocking plugin's id. The byte form is locked by `tests/architecture/hooks-cap-notify.test.ts` (NOT `catalog-uat.test.ts`, whose driver only knows the structured `notify()` entrypoint -- this seam is a bridge diagnostic, not a `NotificationMessage`).

______________________________________________________________________

## Cross-references

- [`docs/messaging-style-guide.md`](messaging-style-guide.md) -- v2.0 thin-pointer style guide; binding closed-set authority via `as const` tuples in `shared/notify.ts`.
- [`docs/adr/v2-001-structured-notify.md`](adr/v2-001-structured-notify.md) -- design rationale for the v1.4 structured `NotificationMessage` model; landed via Phase 17 -- spec + catalog UAT migration.
- [`extensions/pi-claude-marketplace/shared/notify.ts`](../extensions/pi-claude-marketplace/shared/notify.ts) -- the v2 renderer (`notify(ctx, pi, message)` + `notifyUsageError(ctx, message)`); SOLE site for v2 grammar emission.
- [`extensions/pi-claude-marketplace/shared/notify-reasons.ts`](../extensions/pi-claude-marketplace/shared/notify-reasons.ts) -- compile-time closed-set membership proof: the `_UncoveredReason` / `_ExtraReason` reason-coverage check, plus the per-command `satisfies CommandContext` checks in the `*.messaging.ts` modules.
- [`tests/architecture/catalog-uat.test.ts`](../tests/architecture/catalog-uat.test.ts) -- user-contract gate; drives this catalog's `<!-- catalog-state: STATE -->` annotated fixtures through `notify()` via mock `ctx` and asserts byte-equality (rewritten in Plan 17-03; until then the V1 catalog UAT byte-mismatches against the v2 catalog -- Pitfall 2 documented in 17-RESEARCH.md).
- [`docs/prd/pi-claude-marketplace-prd.md`](prd/pi-claude-marketplace-prd.md) §6.12 ES-5 -- the stable user-contract strings origin; the 5 ES-5 markers were superseded by the v1.3 style guide and remain blocked by `tests/architecture/no-legacy-markers.test.ts`.
