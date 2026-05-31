---
phase: 24-grammar-consistency
reviewed: 2026-05-29T00:00:00Z
depth: standard
files_reviewed: 8
files_reviewed_list:
  - docs/messaging-style-guide.md
  - docs/output-catalog.md
  - extensions/pi-claude-marketplace/orchestrators/plugin/install.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/list.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts
  - extensions/pi-claude-marketplace/shared/notify.ts
  - tests/architecture/catalog-uat.test.ts
  - tests/orchestrators/plugin/install.test.ts
findings:
  critical: 0
  warning: 2
  info: 3
  total: 5
status: issues_found
---

# Phase 24: Code Review Report

**Reviewed:** 2026-05-29T00:00:00Z
**Depth:** standard
**Files Reviewed:** 8
**Status:** issues_found

## Summary

Phase 24 renames the user-facing closed-set `REASONS` member `"lspServers"` to `"lsp"` while keeping the manifest-derived DETECTION substrings/keys (`note.includes("lspServers")`, the `MANIFEST_FIELD_REASONS` set, the manifest JSON key) in camelCase. I reviewed the detection-vs-emission seam in `install.ts` (the new `MANIFEST_FIELD_TO_REASON` typed map) and `list.ts::narrowResolverNotes` (the `seen` dedup-key vs pushed-value parallelism), traced the resolver note-production path (`domain/resolver.ts::addUnsupportedKindNotes` emits `contains lspServers`, camelCase, one kind per note), and cross-checked the catalog/style-guide doc edits and the fixture updates.

Correctness of the rename is sound. The seam is implemented correctly:

- `install.ts::manifestFieldTokenFromNote` gates on the camelCase token via `MANIFEST_FIELD_REASONS.has(token)` (detection) then maps through `MANIFEST_FIELD_TO_REASON` (emission). The `!== undefined` guard at the call site (`narrowResolverReasons`, line 1296) prevents `undefined` from reaching the `Reason[]` accumulator. Verified clean under `noUncheckedIndexedAccess: true`.
- `list.ts::narrowResolverNotes` updates BOTH the pushed value (`out.push("lsp")`) AND the dedup key (`seen.has("lsp")` / `seen.add("lsp")`) in parallel -- the dedup key now matches the emitted value, which is internally consistent. The `hooks`-first ordering with `continue` is safe because the resolver emits exactly one kind per note string (verified at `resolver.ts:684-687`), so there is no `hooks`/`lspServers` substring collision.
- The closed-set tuple (`notify.ts::REASONS`), both orchestrator emit paths, the catalog byte fixtures (`{hooks, lsp}`), and the doc surfaces (`{hooks}` / `{lsp}` carve-out) are mutually consistent.

I confirmed `npm run typecheck` is clean and the four affected test files pass (install.test.ts: 44/44; catalog-uat.test.ts: included; list.test.ts: 50/50; notify-types + errors: green). No correctness, security, or data-loss defect was found in the phase-24 change. The findings below are maintainability concerns, two of which are latent traps the rename leaves in place.

## Warnings

### WR-01: `MANIFEST_FIELD_REASONS` and `MANIFEST_FIELD_TO_REASON` must stay in sync by hand, and a drift fails silently

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/install.ts:1223-1234,1244-1259`
**Issue:** The detection seam is split across two independent structures that the rename now requires to stay in lockstep:

```ts
const MANIFEST_FIELD_REASONS: ReadonlySet<string> = new Set(["hooks", "lspServers"]);
const MANIFEST_FIELD_TO_REASON: Readonly<Record<string, Reason>> = {
  hooks: "hooks",
  lspServers: "lsp",
};
```

A future maintainer who adds a detection token to `MANIFEST_FIELD_REASONS` but forgets the matching `MANIFEST_FIELD_TO_REASON` entry hits a silent failure, not a compile error. Under the project's `noUncheckedIndexedAccess: true`, `MANIFEST_FIELD_TO_REASON[token]` is typed `Reason | undefined`. For such a token, `manifestFieldTokenFromNote` returns `undefined`, the carve-out is skipped in `narrowResolverReasons`, and the row silently degrades to `{unsupported source}` -- the exact dead-carve-out failure mode that task 260525-cjr C5 (cited in the in-code comment at lines 1215-1219) was created to fix. The code comment at lines 1220-1222 documents the manual-sync requirement, but documentation is not enforcement.

**Fix:** Derive the detection set from the map's keys so the two cannot drift, removing the duplicated source of truth:

```ts
const MANIFEST_FIELD_TO_REASON = {
  hooks: "hooks",
  lspServers: "lsp",
} as const satisfies Readonly<Record<string, Reason>>;

// Detection set derived from the map keys -- adding a map entry is the
// single edit point; the set can never drift out of sync.
const MANIFEST_FIELD_REASONS: ReadonlySet<string> = new Set(
  Object.keys(MANIFEST_FIELD_TO_REASON),
);
```

With this shape, the `MANIFEST_FIELD_REASONS.has(token)` gate guarantees `token` is a key of `MANIFEST_FIELD_TO_REASON`, but the `noUncheckedIndexedAccess` type still surfaces `Reason | undefined`, so the existing `!== undefined` guard at the call site remains correct and required.

### WR-02: `list.ts::narrowResolverNotes` and `install.ts::manifestFieldTokenFromNote` are divergent re-implementations of the same detection-vs-emission seam

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/list.ts:271-299`
**Issue:** Two separate detection paths now encode the identical `lspServers -> lsp` / `hooks -> hooks` carve-out, and the rename had to be applied to both independently (it was applied correctly here, but the duplication is the risk). `list.ts::narrowResolverNotes` hardcodes the mapping inline with `note.includes("lspServers")` + `out.push("lsp")`, while `install.ts` routes through the typed `MANIFEST_FIELD_TO_REASON` map (WR-01). A future addition or rename of a manifest-field carve-out must be made in two places with two different code shapes; missing one produces an asymmetric user surface (e.g. the install row shows `{lsp}` while the list row shows `{lspServers}` or vice versa). This is precisely the class of inconsistency phase 24 exists to eliminate. Additionally, `narrowResolverNotes` uses substring matching (`note.includes("lspServers")`) where `install.ts` uses the more precise prefix-strip-then-exact-set-membership (`startsWith("contains ")` + `Set.has(token)`), so the two paths can classify the same note differently for adversarial note strings.

**Fix:** Extract the camelCase-detection-token -> emitted-`Reason` mapping into a single shared helper (e.g. in `orchestrators/plugin/shared.ts` or a small `domain` helper) consumed by both `narrowResolverNotes` and `manifestFieldTokenFromNote`, so the carve-out set lives at one edit point. At minimum, make `narrowResolverNotes` consume the same `MANIFEST_FIELD_TO_REASON` map rather than re-encoding the literals inline.

## Info

### IN-01: `narrowResolverNotes` fallback can emit a spurious `{unsupported source}` for a repeated `hooks`/`lspServers` note (pre-existing; not introduced by phase 24)

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/list.ts:276-296`
**Issue:** When a `hooks` (or `lspServers`) carve-out has already been seen, a second note containing the same token fails the first `if` (`!seen.has("hooks")` is false), falls through past the `lspServers` branch, and reaches the `unsupported source` fallback -- pushing `unsupported source` for what is really a duplicate `hooks` note. The resolver currently emits one note per kind (verified at `resolver.ts:684-687`), so this is not reachable today, but the loop structure makes the dedup contract fragile: the `seen` set guards three distinct emitted values but the fallback fires for any note that doesn't match the two specific branches. This is orthogonal to the phase-24 rename (the rename did not introduce it) and is noted only because the file was under review.
**Fix:** Restructure as detect-then-classify: first map the note to its emitted `Reason` (or `undefined`), then dedup on the resolved value, so a repeat-token note that resolves to `hooks` is deduped rather than falling through to `unsupported source`.

### IN-02: Stale `shared/grammar/reasons.ts` path lingers in explanatory comments

**File:** `extensions/pi-claude-marketplace/shared/notify.ts:192`; also `tests/e2e/install-soft-deps.test.ts:11` (out of scope)
**Issue:** Phase 24 correctly repointed the doc surfaces (`messaging-style-guide.md`, `output-catalog.md`) from `shared/grammar/reasons.ts` to `shared/notify.ts::REASONS`, but a historical comment in `notify.ts` still names the retired `shared/grammar/reasons.ts` path. The comment is phrased as "previously imported from", so it is accurate-as-history, but it is the kind of stale path reference the phase-24 doc sweep aimed to retire. Low priority -- the path no longer exists, so there is no functional consequence.
**Fix:** Optional. If a follow-up doc-consistency pass runs, drop or annotate the legacy path reference so a future reader does not search for a deleted file.

### IN-03: `install.ts:1141` JSDoc still describes the carve-out as passing manifest field names "verbatim"

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/install.ts:1140-1146`
**Issue:** The `classifyEntityShapeError` JSDoc says: "manifest field names (`hooks` / `lspServers` etc.) pass verbatim per the MSG-GR-4 manifest-field carve-out". After phase 24, `lspServers` no longer passes verbatim -- it is mapped to `lsp`. Only `hooks` passes verbatim now. The doc comment was not updated alongside the code, so it describes the pre-rename behavior and contradicts the new `MANIFEST_FIELD_TO_REASON` seam documented 80 lines below at 1226-1234.
**Fix:** Update the JSDoc to reflect the detection-vs-emission seam, e.g.: "manifest field-detection tokens (`hooks` / `lspServers` etc.) are narrowed to their emitted closed-set `Reason` via `MANIFEST_FIELD_TO_REASON` (`hooks` -> `hooks`, `lspServers` -> `lsp`)".

---

_Reviewed: 2026-05-29T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
