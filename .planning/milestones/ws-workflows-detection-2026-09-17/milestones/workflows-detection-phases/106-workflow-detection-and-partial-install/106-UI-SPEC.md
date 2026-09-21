---
phase: 106
slug: workflow-detection-and-partial-install
status: approved
shadcn_initialized: false
preset: none
created: 2026-08-29
---

# Phase 106 - UI Design Contract

> Visual and interaction contract for the terminal command and notification surface.

---

## Design System

| Property | Value |
|----------|-------|
| Tool | Existing `notify(ctx, pi, NotificationMessage)` terminal renderer |
| Preset | Not applicable |
| Component library | None |
| Icon library | Closed glyph constants in `shared/notify.ts` |
| Font | Host terminal font. The extension does not select a font. |

This phase has no React, Next.js, Vite, HTML, CSS, or graphical component surface. The shadcn initialization gate does not apply.

The renderer in `extensions/pi-claude-marketplace/shared/notify.ts` remains the only output grammar authority. All user-visible output must use `ctx.ui.notify(message, severity)` through the existing structured notification path.

### Terminal component inventory

| Element | Contract |
|---------|----------|
| Marketplace header | Preserve the existing glyph, name, scope, status, and marker grammar. |
| Plugin row | Preserve `<glyph> <name> [<scope>]? <version>? (<status>) {<reasons>}?`. |
| Workflow reason | Add the exact closed-set token `workflows`. It renders only as `{workflows}` inside the existing reason brace. |
| Summary line | Preserve the existing structural severity summary. A rejected install starts with `A plugin operation has failed.` |
| Partial-install hint | Preserve `Re-run with --partial to install the supported components.` exactly. |
| Partial-update hint | Preserve `Re-run with --partial to update with the supported components.` exactly. |
| Reload trailer | Preserve `/reload to pick up changes` and its existing trigger rules. |

Do not add a workflow-specific icon, status, heading, prompt, trailer, or free-text explanation.

---

## Spacing Scale

This phase introduces no pixel spacing scale. Do not add CSS spacing tokens.

The terminal byte grammar uses character columns. These values are not graphical spacing tokens and must not be normalized to an 8-point scale.

| Token | Value | Usage |
|-------|-------|-------|
| Header | Column 0 | Marketplace header and a standalone summary subject |
| Plugin row | 2 spaces | Plugin rows below a marketplace header |
| Detail | 4 spaces | Partial hint, description, component detail, and plugin cause |
| Nested detail | 6 spaces | Cause text below a rollback child |

Exceptions: the existing 0 / 2 / 4 / 6 indentation ladder is a byte-level terminal contract. Preserve one blank line between marketplace blocks. Preserve the existing blank line before the reload trailer.

The interactive TUI can display one extra leading space. Do not change renderer bytes to compensate for that host behavior.

---

## Typography

The renderer does not control font size or weight. The host terminal controls both. Do not emit ANSI styling or markdown emphasis for workflow states.

| Role | Size | Weight | Line Height |
|------|------|--------|-------------|
| Summary | Host default | Host severity style | 1 terminal row |
| Marketplace header | Host default | Normal | 1 terminal row |
| Plugin row | Host default | Normal | 1 terminal row |
| Hint and trailer | Host default | Normal | 1 terminal row |

Status glyphs, status text, and reason text must carry the meaning. Typography must not be the only signal.

---

## Color

The extension does not own terminal colors. Do not add hex values, ANSI colors, or workflow-specific color rules.

| Role | Value | Usage |
|------|-------|-------|
| Dominant (60%) | Host controlled | Terminal background and normal text |
| Secondary (30%) | Host controlled | Existing terminal chrome |
| Accent (10%) | None | No phase-specific accent |
| Destructive | None | This phase adds no destructive action or destructive color. |

Accent reserved for: none.

Severity remains semantic and structural:

- Inventory rows use info severity.
- A normal install rejection uses error severity.
- A direct `--partial` install success uses info severity unless an independent existing warning applies.
- Autoupdate and update paths keep their existing newly-degraded and already-degraded severity rules.

The adjacent status and reason text must keep every state understandable without color.

---

## Copywriting Contract

| Element | Copy |
|---------|------|
| Primary CTA | No button or prompt. The explicit opt-in is the existing `--partial` command option. |
| Empty state heading | No new empty state. Preserve `(no marketplaces)` where the existing surface uses it. |
| Empty state body | None. The absence of workflow-bearing rows requires no extra copy. |
| Error summary | `A plugin operation has failed.` |
| Unsupported reason | `workflows` rendered as `{workflows}` |
| Install retry hint | `Re-run with --partial to install the supported components.` |
| Update retry hint | `Re-run with --partial to update with the supported components.` |
| Reload hint | `/reload to pick up changes` |
| Destructive confirmation | None. `--partial` is explicit command-line consent and must not open a second confirmation. |

### Vocabulary lock

Use the lowercase plural token `workflows` exactly. Do not emit `workflow`, `unsupported workflows`, `unsupported workflow`, `workflow files`, or the generic `unsupported component` for this kind.

Render all reasons in one brace block. Separate multiple reasons with comma-space. Preserve first-wins deduplication.

Append `workflows` to the existing `REASONS` tuple. Append the `workflows` kind to `UNSUPPORTED_COMPONENT_KINDS`. These tail positions preserve all existing tuple positions and establish the canonical order for combined reasons.

Examples of canonical reason order:

```text
{lsp, workflows}
{unsupported component, workflows}
```

A declaration and a conventional `workflows/` directory still produce one token:

```text
{workflows}
```

---

## Interaction Contract

The resolver result controls the interaction. The command surface must not add per-command workflow branches.

```text
workflow signal found
+-- plugin is structurally sound
|   +-- no --partial: reject and show the existing partial-install hint
|   `-- --partial: install supported components only and show partially-installed
`-- plugin has a structural defect
    `-- preserve unavailable precedence because --partial cannot admit the plugin
```

### Consent and behavior

1. A normal install must reject a workflow-bearing plugin before materialization.
2. The rejection must show `(partially-available) {workflows}` with the existing `--partial` hint.
3. The `--partial` option must admit the same resolution without another prompt.
4. The partial path must stage supported components only.
5. The installation record must retain `compatibility.unsupported: ["workflows"]` in canonical order.
6. No resource inventory can include a workflow path.
7. No runtime path can execute workflow files.
8. The command must remain safe to retry and must preserve existing atomic rollback behavior.
9. The `--partial` option must not bypass a structural failure.

### Surface matrix

| Surface and state | Required row | Severity | Trailer behavior |
|-------------------|--------------|----------|------------------|
| `list`, `info`, or fetch result before install | `⊖ ... (partially-available) {workflows}` | Info | No partial hint and no reload hint |
| Normal `install` rejection | `⊖ ... (partially-available) {workflows}` | Error | Add the install `--partial` hint and no reload hint |
| Successful `install --partial` | `◉ ... (partially-installed) {workflows}` | Info unless another existing warning applies | Add reload hint when supported artifacts changed |
| Installed inventory | `◉ ... (partially-installed) {workflows}` | Info | No reload hint |
| Targeted update decline without `--partial` | `● ... (partially-upgradable) {workflows}` | Warning | Add the update `--partial` hint and no reload hint |
| Bulk update decline without `--partial` | `● ... (partially-upgradable) {workflows}` | Info | Preserve the existing bulk no-op headline |
| Partial update or autoupdate success | `◉ ... (partially-installed) {workflows}` | Preserve existing update severity rules | Add reload hint when supported artifacts changed |
| Structurally malformed plugin that also has workflows | Preserve `⊘ ... (unavailable) {<structural reason>}` | Preserve existing surface severity | Do not add a partial hint |
| Disabled record | Preserve the existing `(disabled)` reason-suppression rules | Info | Preserve existing inventory behavior |
| Pending partial install | Preserve `(will partially install)` | Info | No reason brace and no reload hint |

The last two rows remain intentionally reason-free. They are not unsupported-reason surfaces in the structured message model.

### Byte examples

Inventory before install:

```text
● official [user]
  ⊖ helper v1.0.0 (partially-available) {workflows}
```

Normal install rejection:

```text
A plugin operation has failed.

● official [user]
  ⊖ helper (partially-available) {workflows}
    Re-run with --partial to install the supported components.
```

Successful partial install:

```text
● official [user]
  ◉ helper v1.0.0 (partially-installed) {workflows}

/reload to pick up changes
```

The examples define renderer bytes before the TUI display layer. Names, scopes, versions, marketplace markers, descriptions, component detail, and multi-marketplace grouping follow the existing catalog grammar.

---

## Cross-Surface Parity

Map the typed kind `workflows` to the reason `workflows` in `shared/probe-classifiers.ts`. All reason-bearing consumers must use the shared `narrowUnsupportedKinds` path.

This path includes list, info, fetch completion, install rejection, partial-install success, update, autoupdate, enable, reconcile, and backfill projections. Do not duplicate a `workflows` mapping in an orchestrator.

Update the output catalog and byte-level fixtures in the implementation phase. The tests must establish these invariants:

- Every reason-bearing surface emits `{workflows}` for the same typed kind.
- Declaration and convention detection collapse to one reason.
- Multiple reasons keep canonical order.
- Existing reason, glyph, status, summary, hint, and indentation bytes do not change.
- The closed glyph and status sets do not grow.
- The reason set grows by one tail member only.
- A partial install never records or writes a workflow resource.

---

## UI Considerations

The post-verification probe found 21 applicable states. All 21 states have an explicit resolution. No state remains unresolved.

| Category | Element(s) | Status | Resolution / Reason |
|----------|------------|--------|---------------------|
| Empty | Marketplace header, plugin row | ✓ explicit | An empty top-level collection renders `(no marketplaces)`. A marketplace with no plugins renders only its header. |
| Loading | Marketplace header, plugin row | ✓ explicit | The renderer emits one final notification after the operation completes. It does not add an intermediate loading state. |
| Error | Marketplace header, plugin row | ✓ explicit | A workflow-only rejection keeps the bare header and uses the existing error summary. Its row is `⊖ ... (partially-available) {workflows}`. Structural failures keep `⊘ ... (unavailable)` and take precedence. |
| Populated | Marketplace header, plugin row | ✓ explicit | Populated blocks keep the column-0 header, two-space-indented plugin rows, and one blank line between marketplace blocks. |
| Partial | Marketplace header, plugin row | ✓ explicit | The header does not gain a partial state. The plugin row carries the partial status and the deduplicated `workflows` reason in canonical order. |
| Overflow | Marketplace header, plugin row, summary, partial hint, reload trailer | ✓ explicit | Headers, rows, and fixed copy keep their existing bytes. Optional list descriptions keep column-66 truncation. The host terminal handles other display wrapping. |
| Zero / one / many | Marketplace header, plugin row | ✓ explicit | Zero marketplaces use the sentinel. Zero plugins use a bare header. One and many items reuse the same grammar and spacing. |
| Long text | Marketplace header, plugin row, summary, partial hint, reload trailer | ✓ explicit | Fixed copy has no variable interpolation. Names keep the existing byte grammar. The renderer adds no workflow-specific wrapping or ellipsis. |

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| shadcn official | None | Not applicable because no graphical frontend exists |
| Third-party registries | None | No registry code can enter this phase |

---

## Sources of Truth

| Source | Decisions used |
|--------|----------------|
| `106-CONTEXT.md` | Six locked unsupported-component, ordering, consent, persistence, and structural-precedence decisions |
| `.planning/workstreams/workflows-detection/REQUIREMENTS.md` | WDET-01 through WDET-06 |
| `.planning/workstreams/workflows-detection/ROADMAP.md` | Phase goal and five success criteria |
| `docs/output-catalog.md` | Existing glyphs, statuses, indentation, severity, hint, reload, and byte-parity grammar |
| `shared/notify.ts` | Closed vocabularies and sole renderer authority |
| `shared/probe-classifiers.ts` | Shared typed-kind-to-reason parity seam |

Deferred workflow validation, materialization, and execution do not appear in this contract.

---

## Checker Sign-Off

- [x] Dimension 1 Copywriting: PASS
- [x] Dimension 2 Visuals: PASS
- [x] Dimension 3 Color: PASS
- [x] Dimension 4 Typography: PASS
- [x] Dimension 5 Spacing: PASS
- [x] Dimension 6 Registry Safety: PASS

**Approval:** Approved after execution and byte-contract verification.
