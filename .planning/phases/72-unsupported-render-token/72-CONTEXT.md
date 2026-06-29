# Phase 72: Unsupported Render Token - Context

**Gathered:** 2026-06-28
**Status:** Ready for planning
**Source:** Direct decision capture (interactive session with maintainer)

<domain>
## Phase Boundary

The resolver already produces a clean three-way state (`installable` / `unsupported` / `unavailable`, `domain/resolver.ts` `decideResolution`). The list/info **filter** layer already partitions these correctly (that is why `--unsupported` finds the force-installable plugins). The defect is purely in the **render** layer: decision D-64-01 deliberately collapsed both resolver `unsupported` (force-installable) and `unavailable` (structural) into a single `(unavailable)` / `⊘` row, deferring distinct glyphs/states to "a later phase". This is that phase.

In scope:
- A new `(unsupported)` render status token + a dedicated `⊖` glyph.
- De-collapsing the resolver `unsupported` arm in the two render collapse points:
  - `availableRowMessage` in `orchestrators/plugin/list.ts` (~line 490)
  - `buildNotInstalledRow` in `orchestrators/plugin/info.ts` (~line 987)
- The typed notify message union gains an `unsupported` variant; `STATUS_TOKENS` gains `"unsupported"` (closed-set tripwire bump).
- Updating the OUT-08 closed-set invariant test and any `list`/`info` catalog/golden fixtures that currently assert `(unavailable)` for not-installed hooks/LSP-bearing plugins.

Out of scope:
- Resolver logic, filter-bucket logic (`--unsupported` / `--unavailable` already correct — must stay unaffected).
- The installed-degraded `force-installed` row (`◉`) — already shipped in Phase 66; untouched.
- Any change to reason-brace derivation (`narrowUnsupportedKinds` stays as-is; the `{unsupported hooks}` / `{lsp}` braces already survive the collapse and must continue to render on the new row).

</domain>

<decisions>
## Implementation Decisions

### Glyph (LOCKED by maintainer)
- The not-installed force-installable `unsupported` row uses a NEW glyph `⊖` (circled minus, U+2296), exported as `ICON_UNSUPPORTED`.
- Rationale: `⊖` stays in the circled-operator family as `⊘` (`ICON_UNINSTALLABLE`) but reads "diminished / components dropped" rather than "blocked". It is deliberately distinct from `◉` (`ICON_FORCE_INSTALLED`, the *installed*-degraded row) — the maintainer explicitly rejected glyphs too close to `◉`.
- `⊘` stays RESERVED for `unavailable` / blocked / failed / manual-recovery rows. Do not reuse it for `unsupported`.

### Final glyph grammar (target state)
```
○  available            ⊖  available, would degrade  (unsupported)   ← new
●  installed            ◉  installed, degraded        (force-installed)
                        ⊘  unavailable / blocked / failed
```

### Status token
- Add `"unsupported"` to the closed `STATUS_TOKENS` tuple in `shared/notify.ts`. The closed-set tripwire test must be bumped in the same lockstep commit (precedent: Phase 66 bumped it 20→22 for the force states; this bump is anticipated in project memory).
- Add a `PluginUnsupportedMessage` variant to the notify discriminated union with `status: "unsupported"`, mirroring `PluginUnavailableMessage` (carries `name`, `version?`, `description?`, `reasons`). The exhaustiveness `assertNever` gates must be widened to include it.

### De-collapse (the actual fix)
- In `availableRowMessage` (`list.ts`): the `switch (resolved.state)` currently routes BOTH `case "unsupported"` and `case "unavailable"` to `status: "unavailable"`. Split them: the `unsupported` arm emits `status: "unsupported"` (reasons from `narrowUnsupportedKinds(resolved.unsupported)`); the `unavailable` arm and the probe-error `catch` keep `status: "unavailable"`.
- In `buildNotInstalledRow` / `buildNonInstallableRowFields` (`info.ts`): same split — the `unsupported` arm emits the new token; structural `unavailable` and the local-unresolvable / error paths keep `(unavailable)`.
- The internal `FilterBucket` is already distinct from the render status and must NOT change — `--unsupported` / `--unavailable` keep keying on the pre-collapse bucket.

### Reasons
- The new `(unsupported)` row carries the same per-kind `{unsupported hooks}` / `{lsp}` / `{unsupported source}` braces it carries today (via `narrowUnsupportedKinds`). No change to that helper; just verify the braces still render on the relocated token.

### Severity / messaging
- Match the severity the not-installed `unsupported` row renders at today (this is a render-token rename, not a severity change). Do not introduce new severities.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Render layer
- `extensions/pi-claude-marketplace/shared/notify.ts` — `STATUS_TOKENS` (~line 198), the `ICON_*` glyph constants (~lines 1359-1383), `PluginUnavailableMessage` (~line 668) as the template for the new variant, and the render switch(es) that map status → glyph/word.

### Collapse points
- `extensions/pi-claude-marketplace/orchestrators/plugin/list.ts` — `availableRowMessage` (~line 490) and the `FilterBucket` / `shouldShow` logic (~lines 117-227).
- `extensions/pi-claude-marketplace/orchestrators/plugin/info.ts` — `buildNotInstalledRow` (~line 987) and `buildNonInstallableRowFields` (~line 816).

### Resolver (read-only — do not modify)
- `extensions/pi-claude-marketplace/domain/resolver.ts` — `decideResolution` (~line 1082) and the three-way `ResolvedPlugin` union.

### Reason mapping (read-only)
- `extensions/pi-claude-marketplace/shared/probe-classifiers.ts` — `narrowUnsupportedKinds` (~line 151).

### Byte-form contract
- `docs/output-catalog.md` and `docs/messaging-style-guide.md` — DOC-02 already names the `unsupported` token; reconcile the catalog rows for the not-installed `unsupported` plugins to the new `⊖` / `(unsupported)` byte form.

### Decision anchor
- D-64-01 (inline at `list.ts:490` and `info.ts:987`) — the deferral this phase closes.

</canonical_refs>

<specifics>
## Specific Ideas

- Observed real output that motivated this (official marketplace, before the change):
  ```
  ⊘ hookify (unavailable) {unsupported hooks}
  ⊘ clangd-lsp v1.0.0 (unavailable) {lsp}
  ```
  Target after the change (hooks/LSP plugins are force-installable → `unsupported`):
  ```
  ⊖ hookify (unsupported) {unsupported hooks}
  ⊘ clangd-lsp v1.0.0 (unavailable) {lsp}   # IF lsp-only plugins are structurally unavailable
  ```
  NOTE for the researcher/planner to resolve: confirm whether LSP-only plugins resolve `unsupported` (force-installable) or `unavailable` (structural). The `{lsp}` brace renders for both arms today; whichever arm an LSP-only plugin lands in determines its glyph. The render split must follow the resolver state, not the reason brace.

- The closed-set tripwire bump is a known, expected lockstep change (project memory: "Phase 72 Will Bump Again").

</specifics>

<deferred>
## Deferred Ideas

None — the phase scope is the render-token distinction only.

</deferred>

---

*Phase: 72-unsupported-render-token*
*Context captured: 2026-06-28 via direct decision capture*
