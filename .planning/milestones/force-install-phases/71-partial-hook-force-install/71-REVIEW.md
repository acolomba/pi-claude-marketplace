---
phase: 71-partial-hook-force-install
reviewed: 2026-06-28T17:45:00Z
depth: standard
files_reviewed: 5
files_reviewed_list:
  - extensions/pi-claude-marketplace/domain/components/hooks.ts
  - extensions/pi-claude-marketplace/domain/resolver.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/info.ts
  - extensions/pi-claude-marketplace/shared/concerns/hooks.ts
  - extensions/pi-claude-marketplace/shared/probe-classifiers.ts
findings:
  critical: 0
  warning: 2
  info: 2
  total: 4
status: issues_found
---

# Phase 71: Code Review Report

**Reviewed:** 2026-06-28T17:45:00Z
**Depth:** standard
**Files Reviewed:** 5
**Status:** issues_found

## Summary

Phase 71 converts the hooks supportability gate from reject-all to an accumulating
partition (`partitionHooks`), routes degradable drops through `partial.unsupported`,
and wires dropped-handler enumeration into the strict info reader. The structural
boundary (S1 JSON-parse, S2 schema, X1 table-desync) is preserved as `{ok:false}`.

The partition logic itself is correct: the three-tier hierarchy (P1 event,
P2–P5 group, P6 handler) accumulates into `DroppedHook[]` without short-circuiting,
the X1 programmer-bug is re-raised through `HooksTableDesyncError` rather than
silently degrading, and `detectOrphanRewake` runs exclusively over the filtered
subset (T-71-04 constraint). The resolver verdict split (`applyHooksConfig`
three-way outcome) and the Q2 empty-subset edge (Stop-only → no `hooksConfigPath`,
no staging, still routes `unsupported`) are implemented correctly.

Two warnings found: one rendering defect in the info dropped-handler projection
(latent, untested at integration level) and one comment policy violation. Two
info items: a dead-code field on the installable arm schema, and a known deferred
cross-surface parity gap.

## Warnings

### WR-01: P6 handler drop on a match-all group renders `event() (unsupported)`

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/info.ts:319`

**Issue:** `partitionGroupHandlers` stores dropped handlers with the raw matcher
string, where a match-all group (no `matcher` field in the source JSON) produces
`drop.matcher === ""`. In `projectDroppedHookEntries`:

```typescript
// line 319
const matcher = drop.kind === "event" ? undefined : drop.matcher;
```

For `kind:"handler"` with `drop.matcher === ""`, this yields `matcher = ""` — not
`undefined`. The guard at line 330:

```typescript
...(matcher !== undefined && { matcher }),
```

therefore spreads `matcher: ""` into the lenient `HookSummaryEntry`. Then in
`appendHooksBlock` (`shared/concerns/hooks.ts:111`):

```typescript
const matcherPart = entry.matcher === undefined ? "" : `(${entry.matcher})`;
```

`entry.matcher === ""` is not `undefined`, so `matcherPart = "()"`, yielding
`      PreToolUse() (unsupported)` instead of `      PreToolUse (unsupported)`.

This path is reachable for any bucket-A event group that (a) carries no `matcher`
field (match-all), (b) mixes at least one `command` handler with at least one
non-command handler (P6/Q1). The group survives with only its `command` handlers,
and the non-command handler generates a `kind:"handler"` drop with `matcher: ""`.
The info tests added in this phase exercise P1 (`Stop (unsupported)`) and a P2
regex group (`PreToolUse(.*) (unsupported)`), but not P6 on a match-all group,
so this defect is latent and untested at integration level.

**Fix** (one-line in `projectDroppedHookEntries`):
```typescript
// Treat empty-string matcher (match-all group) the same as absent —
// renders bare `event (unsupported)` rather than `event() (unsupported)`.
const matcher = drop.kind === "event" || drop.matcher === "" ? undefined : drop.matcher;
```

---

### WR-02: `T-71-04` is a per-phase planning-matrix ID in two resolver comments

**File:** `extensions/pi-claude-marketplace/domain/resolver.ts:856,893`

Two comments added in this phase include `T-71-04`:

```typescript
// line 856 (JSDoc for applyHooksConfig):
* SURF-05 / D-63-08 / T-71-04: on the materialized-subset branch only, ...

// line 893 (inline):
// SURF-05 / D-63-08 / T-71-04: `detectOrphanRewake` runs over the FILTERED
```

`T-71-04` is a row label from the RESEARCH.md phase validation test-map, not a
stable spec anchor. The comment policy (`typescript-comments.md`) permits decision
IDs (`D-NN`), requirement-family IDs (`SURF-NN`, `HOOK-NN`, `NFR-N`, etc.), and
explicitly forbids identifiers whose only purpose is to record which planning
artefact produced the line. `T-NN-NN` matches the forbidden pattern (per-phase
test-matrix references restart numbering per RESEARCH document).

The constraint these comments encode (orphan-rewake over the filtered subset only)
is already fully anchored by `SURF-05` and `D-63-08` plus the surrounding prose.

**Fix:** Remove `/ T-71-04` from both occurrences:
```typescript
* SURF-05 / D-63-08: on the materialized-subset branch only, ...
// SURF-05 / D-63-08: `detectOrphanRewake` runs over the FILTERED
```

---

## Info

### IN-01: `droppedHooks` on the `installable` arm schema and spread is dead code

**File:** `extensions/pi-claude-marketplace/domain/resolver.ts:115,337`

`ResolvedPluginInstallableSchema` carries an optional `droppedHooks` field
(line 115), and the `installable()` builder spreads it (line 337):

```typescript
...(partial.droppedHooks !== undefined && { droppedHooks: partial.droppedHooks }),
```

`partial.droppedHooks` is only set inside `applyHooksConfig` when
`hooksResult.dropped.length > 0`, which unconditionally also pushes `"hooks"` into
`partial.unsupported`. `decideResolution` returns `unsupported` (not `installable`)
whenever `partial.unsupported.length > 0`. Therefore the spread in `installable()`
always evaluates to `{}` and the field on the installable arm schema is never
populated at runtime.

No correctness impact — the field is harmlessly inert and available if future
consumers need it. It does add schema weight and a spread that will never fire.

---

### IN-02: No-force install failure renders `{unsupported source}`, not `{unsupported hooks}` (RESOLVED -- commit 46bc0757)

**Status:** RESOLVED in commit 46bc0757 (`fix(71): IN-02 render typed
unsupported reason on no-force failure row`). The resolver threads its typed
`unsupported[]` list onto the thrown `PluginShapeError` (`unsupportedKinds`),
and `narrowResolverReasons` narrows it through the shared
`narrowUnsupportedKinds` helper FIRST, deduped against the note-derived
markers. The no-force failure row, `list`, and `info` now agree:
hooks-unsupported reads `{unsupported hooks}`, lsp reads `{lsp}`. Genuinely
`unavailable` (structural) rows carry an empty typed list and keep their
notes-sourced reasons unchanged. Regression coverage added to
`tests/orchestrators/plugin/install.test.ts` and
`tests/orchestrators/plugin/cross-surface-reason-parity.test.ts`.

**File:** `extensions/pi-claude-marketplace/domain/resolver.ts` / install orchestrator

Acknowledged in 71-04-SUMMARY.md and logged to `deferred-items.md`. The no-force
`(unavailable)` install-failure row renders the generic `{unsupported source}`
token because the install-failure composer reads the structural `notes` path, while
the `hooks` kind rides the typed `unsupported[]` list. The `list`, `info`, and
force-installed-success surfaces all correctly render `{unsupported hooks}` via
`narrowUnsupportedKinds`. The SEV-02 block and `--force` hint requirements are
satisfied; only the failure-row reason token diverges from the other surfaces. Out
of scope for this phase; no action needed here.

---

_Reviewed: 2026-06-28T17:45:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
