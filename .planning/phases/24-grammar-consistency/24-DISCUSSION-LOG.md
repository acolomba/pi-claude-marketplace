# Phase 24: Grammar Consistency - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md -- this log preserves the alternatives considered.

**Date:** 2026-05-29
**Phase:** 24-grammar-consistency
**Areas discussed:** Translation strategy, Grammar-path hygiene, Fixture partition

---

## Translation strategy

| Option | Description | Selected |
|--------|-------------|----------|
| (a) Closed-set rename | Rename the `REASONS` member; keep manifest-detection substrings camelCase; map `lspServers → <new token>` at the 2 emission seams. Keeps the closed set pure. Matches SC #3. | ✓ |
| (b) Render-point translation | Keep `"lspServers"` in the closed set; translate only inside `composeReasons` (`notify.ts:863`). Smallest blast radius, but violates SC #3 and re-hides the camelCase smell in the renderer. | |

**User's choice:** Option (a) -- with the rendered token changed from the
proposed `"lsp servers"` to **`"lsp"`**.
**Notes:** User reviewed the full 28-entry `REASONS` closed set on request,
observed that `lspServers` is the only camelCase outlier (every other reason is
lowercase, and the only peer carve-out `hooks` is already a single lowercase
word), and chose the terser single-word `"lsp"`. Consequence recorded in
CONTEXT.md (D-24-03): ROADMAP SC #1/#3 + REQUIREMENTS SNM-36 say `"lsp servers"`
and will be amended to `"lsp"` in lockstep (Phase 23 / SNM-34 precedent). The
detection-vs-emission seam (D-24-04) is the same regardless of the token string.

---

## Grammar-path hygiene

| Option | Description | Selected |
|--------|-------------|----------|
| Fold all 6 | Fix every stale `shared/grammar/reasons.ts` pointer (install.ts:1219,1239; uninstall.ts:99; messaging-style-guide.md:54,146; output-catalog.md:58) → re-point to `shared/notify.ts::REASONS`. | ✓ |
| Touched files only | Fix only where the rename edits anyway (install.ts:1219,1239; output-catalog.md:58); leave 3 stale pointers. | |
| Defer all | Note all 6 as a deferred doc-hygiene item; touch nothing extra. | |

**User's choice:** Fold all 6 into this phase.
**Notes:** `shared/grammar/` was retired in Phase 21 (confirmed absent). The
stale pointers cite the exact token being renamed, so correcting them here keeps
the grammar docs/comments truthful (D-24-08).

---

## Fixture partition

| Option | Description | Selected |
|--------|-------------|----------|
| Lock in CONTEXT.md | Record which occurrences RENAME (rendered-Reason / byte form) vs STAY camelCase (manifest / error-message / detection-input), giving the planner an explicit map. | ✓ |
| Leave to planner | Capture only the principle; let research/planning derive the per-fixture split. | |

**User's choice:** Lock the partition in CONTEXT.md.
**Notes:** Partition verified against source during discussion -- `errors.test.ts:201-208`
(PluginShapeError raw reasons + composed `…is not installable: hooks; lspServers`
message) confirmed as the manifest/error-message layer that STAYS camelCase;
`catalog-uat.test.ts:246,490` + `install.test.ts:1589,1698,1712` (narrowed
closed-set output) confirmed as the RENAME side. Full split recorded in D-24-06.

---

## Claude's Discretion

- Seam mechanism: a `MANIFEST_FIELD_TO_REASON` lookup vs inline conditional at
  each push site (D-24-05). Principle (detect-camelCase / emit-`"lsp"`, never
  blanket-rename) is locked.
- Plan/wave decomposition (single SNM-36, converging on
  notify.ts + list.ts + install.ts + catalog/fixtures).
- Whether the manifest-side JSDoc at `plugin.ts:46` stays verbatim (D-24-09 --
  default leave, it describes the JSON field, not the rendered reason).

## Deferred Ideas

None -- discussion stayed within (and slightly tightened) phase scope.
