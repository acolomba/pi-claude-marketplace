---
phase: 58-matcher-parser-tool-name-mapping-supportability-gate
plan: 04
subsystem: shared-notify-reasons + manifest-field-carve-out + catalog-uat
tags: [hooks, byte-rename, atomic, catalog, narrowResolverNotes, manifest-field-carveout, HOOK-04, D-58-01, D-58-02]
requirements_closed: [HOOK-04]
dependency_graph:
  requires:
    - 58-03 (parseHooksConfig emits the `unsupported hooks: <detail>` prefix
      that narrowResolverNotes now detects via the tightened `startsWith` arm)
  provides:
    - canonical `{unsupported hooks}` closed-set REASON byte form for the
      user contract (renderer + catalog-UAT + docs all in lockstep)
    - prefix-anchored narrowResolverNotes detection (Pitfall 2 lock)
    - `lspServers` as the SOLE manifest-field carve-out (D-58-02 dead-branch
      cleanup)
  affects:
    - every catalog state rendering `(unavailable) {unsupported hooks}` on
      install / reinstall / import / list / info / reconcile-apply surfaces
tech_stack:
  patterns:
    - prefix-anchored substring detection (`startsWith`) replacing the loose
      `includes(...)` form for closed-set Reason narrowing
    - atomic-supersession single-commit landing for closed-set REASONS member
      renames (the v1.3 / v1.10 / v1.11 lesson, applied to HOOK-04)
key_files:
  created:
    - tests/shared/probe-classifiers.test.ts
  modified:
    - extensions/pi-claude-marketplace/shared/notify.ts
    - extensions/pi-claude-marketplace/shared/probe-classifiers.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/install.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/list.ts
    - extensions/pi-claude-marketplace/domain/resolver.ts
    - docs/output-catalog.md
    - .planning/REQUIREMENTS.md
    - tests/architecture/catalog-uat.test.ts
    - tests/orchestrators/plugin/info.test.ts
    - tests/orchestrators/plugin/install.test.ts
    - tests/orchestrators/plugin/list.test.ts
    - tests/shared/notify-v2.test.ts
    - tests/shared/snm37-behavioral-smoke.test.ts
    - tests/shared/snm38-indent-ladder.test.ts
decisions:
  - "[HOOK-04 / D-58-01]: The closed-set REASONS member `\"hooks\"` is renamed
    to `\"unsupported hooks\"` at `shared/notify.ts:81`. Tuple length stays at
    31; the auto-derived `Reason` / `ContentReason` literal unions update with
    it. Every source emission site, doc occurrence, catalog-UAT fixture, and
    test snapshot lands in ONE atomic commit (no intermediate `{hooks}` byte
    form ever exists on this branch's history)."
  - "[HOOK-04 / D-58-02]: `MANIFEST_FIELD_REASONS` set in
    `orchestrators/plugin/install.ts` drops `\"hooks\"`;
    `MANIFEST_FIELD_TO_REASON` drops the `hooks: \"hooks\"` entry. Under v1.13,
    `hooks` is a SUPPORTED component kind (Phase 57's
    `SUPPORTED_COMPONENT_KINDS` 4-tuple), so the resolver no longer emits a
    `\"contains hooks\"` note in real traffic. The dead carve-out branch is
    removed; `lspServers` is now the SOLE manifest-field carve-out."
  - "[HOOK-04 Pitfall 2]: `narrowResolverNotes` substring detection is
    tightened from `note.includes(\"hooks\")` to `startsWith` checks on the
    four prefix tokens parseHooksConfig + the resolver wrapper emit:
    `hooks.json is not valid JSON:`, `hooks.json failed schema validation:`,
    `unsupported hooks:`, and `malformed hooks.json:`. A free-form note
    containing the word `hooks` mid-string no longer false-positives as the
    `{unsupported hooks}` Reason."
  - "[REQUIREMENTS.md amendment]: HOOK-04 reassigned from `Phase 63 / Pending`
    to `Phase 58 (Plan 04) / Complete`. Phase 63's requirement list shrinks
    by one as a result."
metrics:
  duration_minutes: 13
  tasks_completed: 2
  files_touched: 15
  atomic_commit: f74005b
  completed_at: "2026-06-14T14:52:22Z"
---

# Phase 58 Plan 04: HOOK-04 Atomic Byte Rename + MANIFEST Carve-out Drop Summary

REASONS member `"hooks"` is renamed to `"unsupported hooks"` in lockstep with every catalog/doc/test byte form, and the dead `"hooks"` manifest-field carve-out is dropped from install.ts -- one atomic commit, `npm run check` GREEN end-to-end.

## What was done

Plan 58-04 closes HOOK-04 by landing three interlocking changes in a single git commit (`f74005b`):

1. **D-58-01 atomic byte rename.** The closed-set `REASONS` tuple member at `shared/notify.ts:81` flips from `"hooks"` to `"unsupported hooks"`. The auto-derived `Reason` and `ContentReason` literal unions follow. Every downstream emission site, fixture row, and string snapshot is re-keyed in the same commit so the catalog-UAT byte-equality gate never sees an intermediate `{hooks}` vs `{unsupported hooks}` mismatch.
2. **D-58-02 manifest-field carve-out drop.** `MANIFEST_FIELD_REASONS` in `orchestrators/plugin/install.ts` drops `"hooks"` (keeps `"lspServers"`); `MANIFEST_FIELD_TO_REASON` drops the `hooks: "hooks"` entry. Under v1.13 `hooks` is a SUPPORTED component kind (Phase 57's `SUPPORTED_COMPONENT_KINDS` 4-tuple), so the resolver never emits a `"contains hooks"` note in real traffic; the dead carve-out branch is removed. The catalog `{unsupported hooks}` REASON is now sourced through `shared/probe-classifiers.ts::narrowResolverNotes` against parseHooksConfig prefix tokens, not through the manifest-field map.
3. **Pitfall 2 substring tightening.** `narrowResolverNotes` substring detection is tightened from `note.includes("hooks")` to `startsWith` checks anchored on the four prefix tokens the rest of the system actually emits: `hooks.json is not valid JSON:`, `hooks.json failed schema validation:`, `unsupported hooks:`, and the resolver's `malformed hooks.json:` wrapper. A new `tests/shared/probe-classifiers.test.ts` (9 GREEN tests) locks the tightened contract, including the negative case where a free-form note containing the word "hooks" mid-string falls through to the permissive `unsupported source` fallback instead of false-positiving as `{unsupported hooks}`.

## Files touched

**Source (5 files):**
- `extensions/pi-claude-marketplace/shared/notify.ts` -- REASONS member rename.
- `extensions/pi-claude-marketplace/shared/probe-classifiers.ts` -- return-type union rename, prefix-anchored detection (4 prefixes), JSDoc rewrite citing HOOK-04.
- `extensions/pi-claude-marketplace/orchestrators/plugin/install.ts` -- MANIFEST_FIELD_REASONS / MANIFEST_FIELD_TO_REASON carve-out drop, comment-block realignment, `narrowResolverReasons` JSDoc updated, example string `⊘ hookify [user] (unavailable) {unsupported hooks}`.
- `extensions/pi-claude-marketplace/orchestrators/plugin/list.ts` -- `ListReason` discriminated-union member rename `"hooks"` -> `"unsupported hooks"`.
- `extensions/pi-claude-marketplace/domain/resolver.ts` -- JSDoc comment rewrite for the prefix-anchored detection (drops the obsolete `note.includes("hooks")` reference).

**Docs (2 files):**
- `docs/output-catalog.md` -- 6 byte-form occurrences re-keyed; carve-out prose at line 59 corrected (lspServers is now the sole carve-out); status-token table description corrected; unavailable-info description prose corrected.
- `.planning/REQUIREMENTS.md` -- HOOK-04 row moves from `Phase 63 / Pending` to `Phase 58 (Plan 04) / Complete`.

**Tests (8 files, one new):**
- `tests/architecture/catalog-uat.test.ts` -- 7 fixture rows re-keyed (lines 272, 276, 507, 582, 829, 1175, 1708) + 1 comment.
- `tests/shared/notify-v2.test.ts` -- 4 byte-form fixture/snapshot updates.
- `tests/shared/snm37-behavioral-smoke.test.ts` -- epsilon row re-keyed + 2 doc comments.
- `tests/shared/snm38-indent-ladder.test.ts` -- epsilon row re-keyed + 2 doc comments.
- `tests/orchestrators/plugin/info.test.ts` -- 2 string snapshots + comments.
- `tests/orchestrators/plugin/install.test.ts` -- 3 `narrowResolverReasons` tests rewritten to reflect post-D-58-02 behavior (the synthetic `["contains hooks"]` input now falls through to `["unsupported source"]`; the `["contains hooks", "contains lspServers"]` input now returns `["lsp"]` only).
- `tests/orchestrators/plugin/list.test.ts` -- 1 regex assertion updated to `/{unsupported hooks}/` + comments.
- `tests/shared/probe-classifiers.test.ts` -- **NEW**; 9 GREEN tests covering the tightened-substring contract (4 happy-path prefix tests, 1 Pitfall 2 negative case, 1 lsp regression, 1 permissive fallback, 1 empty-input, 1 multi-note dedup).

## Verification

| Gate | Result |
|---|---|
| `npm run typecheck` | GREEN |
| `npm run lint` (ESLint flat config) | GREEN |
| `npm run format:check` (Prettier) | GREEN |
| `npm test` (1935 unit tests) | 1935 / 1935 pass |
| `npm run test:integration` (10 integration tests) | 10 / 10 pass |
| Pre-commit hooks (trim, prettier, mdformat, markdownlint, eslint, typecheck, trufflehog) | All pass |

The catalog-UAT byte-equality gate (`tests/architecture/catalog-uat.test.ts`) is the load-bearing assertion for this plan: it reads `docs/output-catalog.md`, extracts every `<!-- catalog-state: ... -->`-annotated fenced block, and asserts the renderer's output is byte-equal. With the atomic snapshot, every catalog state carrying the new `{unsupported hooks}` Reason renders byte-identically to the doc.

## Deviations from Plan

### Rule 2 -- additional test files updated beyond the plan's `files_modified` list

The plan's `files_modified` field listed 9 files; the actual atomic-rename surface required updating **15 files** to keep `npm run check` GREEN under D-58-01. The plan enumerated `tests/architecture/catalog-uat.test.ts`, `tests/architecture/notify-grammar-invariant.test.ts`, and `tests/shared/probe-classifiers.test.ts`, but the REASONS member rename + D-58-02 carve-out drop also broke type-checked assertions and string snapshots in:

- `tests/shared/notify-v2.test.ts` (4 sites)
- `tests/shared/snm37-behavioral-smoke.test.ts` (1 site + 2 doc comments)
- `tests/shared/snm38-indent-ladder.test.ts` (1 site + 2 doc comments)
- `tests/orchestrators/plugin/info.test.ts` (2 string snapshots + comments)
- `tests/orchestrators/plugin/install.test.ts` (3 narrowResolverReasons tests, rewritten for post-D-58-02 behavior)
- `tests/orchestrators/plugin/list.test.ts` (1 regex assertion + comments)

Plus the source files `extensions/pi-claude-marketplace/orchestrators/plugin/list.ts` (ListReason union) and `extensions/pi-claude-marketplace/domain/resolver.ts` (JSDoc comment), which the plan did not enumerate but which both carried `"hooks"` literals tied to the closed-set REASON. All four of these source-and-test files are direct downstream consequences of the REASONS rename + the D-58-02 carve-out drop -- applying them is the only way to honor the D-58-01 atomic-supersession invariant.

Rationale: D-58-01 mandates that the rename land in ONE commit with `npm run check` GREEN. Leaving any of these sites un-updated would have caused either type-check failures (the `Reason` literal union no longer includes `"hooks"`) or byte-equality failures (string snapshots in tests rendering `{hooks}` no longer match the renderer's `{unsupported hooks}` output). Both are blocking under D-58-01.

### Rule 1 -- additional fourth narrowResolverNotes detection prefix

The plan's `<behavior>` block listed three prefix tokens (`hooks.json is not valid JSON:`, `hooks.json failed schema validation:`, `unsupported hooks:`). Inspection of `domain/resolver.ts::readStandaloneHooks` showed that the resolver wraps the parseHooksConfig reason with the literal prefix `"malformed hooks.json: "` BEFORE pushing into `partial.notes`. The catalog-layer narrower receives this WRAPPED form, so the substring match must anchor on the wrapper too -- adding a fourth `startsWith("malformed hooks.json:")` arm. Without this, the resolver-emitted note would never classify and would silently fall through to `{unsupported source}`. The new `tests/shared/probe-classifiers.test.ts` includes a dedicated test for the wrapper prefix.

### Rule 3 -- no architectural changes; no checkpoints

No architectural changes, no Rule 4 checkpoints. The plan's atomic-commit invariant + the v1.13 SUPPORTED_COMPONENT_KINDS context fully constrained the work.

## Self-Check: PASSED

Files verified present:
- `extensions/pi-claude-marketplace/shared/notify.ts` -- REASONS member is `"unsupported hooks"` at line 81.
- `extensions/pi-claude-marketplace/shared/probe-classifiers.ts` -- 4 `startsWith` arms present.
- `extensions/pi-claude-marketplace/orchestrators/plugin/install.ts` -- `MANIFEST_FIELD_REASONS` is `new Set(["lspServers"])` (no "hooks").
- `tests/shared/probe-classifiers.test.ts` -- exists with 9 GREEN tests.
- `docs/output-catalog.md` -- 10 occurrences of `{unsupported hooks` (6 byte-form + 4 prose).
- `.planning/REQUIREMENTS.md` -- HOOK-04 row reads `Phase 58 (Plan 04)` and `Complete`.

Commit hash verified:
- `f74005b` -- present in `git log --oneline`; the SINGLE atomic byte-payload commit.

## Threat Flags

None. The change is a closed-set REASON rename + dead-branch cleanup; no new network surface, no new auth path, no new schema boundary.
