---
phase: 43-marketplace-info-command
reviewed: 2026-06-04T00:00:00Z
depth: deep
files_reviewed: 13
files_reviewed_list:
  - extensions/pi-claude-marketplace/shared/notify.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/info.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/index.ts
  - extensions/pi-claude-marketplace/edge/handlers/marketplace/info.ts
  - extensions/pi-claude-marketplace/edge/router.ts
  - extensions/pi-claude-marketplace/edge/register.ts
  - extensions/pi-claude-marketplace/edge/completions/provider.ts
  - tests/architecture/notify-types.test.ts
  - tests/shared/notify-v2.test.ts
  - tests/orchestrators/marketplace/info.test.ts
  - tests/edge/handlers/marketplace/info.test.ts
  - tests/edge/completions/provider.test.ts
  - tests/edge/router.test.ts
  - docs/output-catalog.md
  - tests/architecture/catalog-uat.test.ts
findings:
  critical: 0
  warning: 2
  info: 4
  total: 6
status: issues_found
---

# Phase 43: Code Review Report

**Reviewed:** 2026-06-04T00:00:00Z
**Depth:** deep
**Files Reviewed:** 15 (13 Wave 1 + 2 Wave 2)
**Status:** issues_found (no blockers; 2 warnings + 4 info)

## Summary

Adversarial review of commits `2de2fb8` (Wave 1: production surface) and `94ce34e` (Wave 2: catalog + UAT). All ten review-focus areas check out. The contract-critical guarantees hold: Phase 42 SC#4 byte-equality is preserved (`composeMarketplaceBlock`, `renderMpHeader`, `renderPluginRow`, `composePluginLines`, `joinTokens`, `composeReasons`, `renderMarketplaceInfo`, `composeMpInfoHeader` are unchanged -- verified by `git diff`). NFR-5 enforcement is structurally locked by a grep-gate test that strips comments before searching, so the file header that documents the prohibition does not produce false positives. The `dispatchInfoMessage` helper extraction preserves the `assertNever` exhaustiveness gate at the outer dispatcher level (any new `kind` literal compile-errors at the `notify()` switch's `assertNever(message)` default arm). The "Rule 1" test updates in `provider.test.ts` (TC-2) and `router.test.ts` (`makeHandlers`) are symmetric extensions, not coverage deletions -- both add the missing `info`/`marketplaceInfo` reference forced by the production-side additions. INFO-03 fan-out byte form (project-first / one blank line) is locked in both the orchestrator integration test and the catalog UAT fixture. Wave 1 (13 files) and Wave 2 (2 files) are clean atomic commits; no scope creep observed. `npm run check` GREEN at the post-Wave-2 boundary (1419/1419).

Findings below are quality-tier (warnings + info); none gate shipping.

## Warnings

### WR-01: Stale forward-compat comment in `buildBlock` mis-describes which source kinds actually reach the orchestrator

**File:** `extensions/pi-claude-marketplace/orchestrators/marketplace/info.ts:82-87`
**Issue:** The comment block above the source-dispatch in `buildBlock` claims that "non-github sources (`url`, `git-subdir`, `npm`, `unknown` -- NFR-12 forward-compat) coerce to the `path` arm." In practice, `persistence/state-io.ts::normalizeStoredSource` (line 108-137) rejects any persisted `source` whose `kind` is not `"path" | "github" | "unknown"`; a `url | git-subdir | npm` value either (a) comes from a raw-string source and gets thrown at load time when `parsePluginSource` returns `"unknown"`, or (b) is malformed and throws "missing kind/raw". The only source kind that can reach `buildBlock` besides `path` and `github` is `unknown`. The comment overstates the reachable set and a future contributor reading the comment may conclude that the path-fallback is exercised more broadly than it is. The path-fallback for `unknown` sources also renders `path: <marketplaceRoot>` which would be the local clone dir, not the user-supplied source string -- potentially confusing on the user surface for true forward-compat kinds. Worth a clarifying refactor: either narrow the comment to "the `unknown` forward-compat kind coerces to `path`" or document that `marketplaceRoot` is the right fallback because `unknown` sources have no canonical display form.
**Fix:** Narrow the comment to match the actual reachable set:
```ts
// Phase 42 type supports only `github | path`. The persistence layer
// (state-io::normalizeStoredSource) admits a third stored kind -- `unknown`
// (NFR-12 forward-compat tail) -- which has no canonical display form;
// coerce it to the `path` arm with `record.marketplaceRoot` so the
// renderer never receives an invalid discriminator. `url | git-subdir |
// npm` cannot reach this point: state-io rejects them at load time.
```
And consider adding a unit test that covers the `unknown`-kind branch to prove the fallback is actually exercised (currently no test triggers it).

### WR-02: `found.length === 1` branch silently falls through to the fan-out path if the defensive guard fails

**File:** `extensions/pi-claude-marketplace/orchestrators/marketplace/info.ts:188-198`
**Issue:** The single-record branch is structured as:
```ts
if (found.length === 1) {
  const sole = found[0];
  if (sole !== undefined) {
    const block = await buildBlock(sole.record);
    notify(opts.ctx, opts.pi, block);
    return;
  }
}
// ... falls through to fan-out below
```
If `sole === undefined` (impossible at runtime under standard array semantics, but the guard is type-driven for `noUncheckedIndexedAccess`), execution falls through to the two-records branch at the bottom of the function. That branch would call `Promise.all(found.map(...))` over a single-entry `found` array and emit a `MarketplaceInfoCascadeMessage` with one block -- which happens to render byte-identically to the bare `MarketplaceInfoMessage` (locked by the notify-v2 single-block fan-out test). So the fall-through is observationally indistinguishable from the intended path, but the code is structured so that an impossible runtime condition silently switches the message variant. Either lift the variant choice unambiguous (early return in the else arm, or use a non-null assertion with a brief comment) or document that the fall-through is intentional and byte-safe.
**Fix:** Either restructure to make the variant choice unambiguous:
```ts
if (found.length === 1) {
  const sole = found[0];
  // `found.length === 1` guarantees `found[0]` is defined; the explicit
  // guard satisfies @typescript-eslint/no-non-null-assertion. The early
  // throw matches the runtime invariant and avoids the silent fall-through
  // to the multi-block fan-out branch.
  if (sole === undefined) {
    throw new Error("unreachable: found.length === 1 implies found[0] is defined");
  }
  const block = await buildBlock(sole.record);
  notify(opts.ctx, opts.pi, block);
  return;
}
```
Or destructure to sidestep the `noUncheckedIndexedAccess` issue entirely:
```ts
const [sole, ...rest] = found;
if (rest.length === 0 && sole !== undefined) {
  const block = await buildBlock(sole.record);
  notify(opts.ctx, opts.pi, block);
  return;
}
```

## Info

### IN-01: `as` cast loses ParsedSource discriminated-union narrowing in `buildBlock`

**File:** `extensions/pi-claude-marketplace/orchestrators/marketplace/info.ts:88`
**Issue:** `const src = record.source as { kind?: unknown; owner?: unknown; repo?: unknown; ref?: unknown };` discards the strong discriminated union from `domain/source.ts::ParsedSource`. The persistence layer guarantees `record.source` is a `ParsedSource`, and a `switch (src.kind)` over `"path" | "github" | "unknown"` would expose the same fields with full type-safety and enable `assertNever` exhaustiveness if a new source kind ever lands. The current shape works (it manually validates each field with `typeof`), but it's a missed opportunity for compile-time discipline that the rest of the codebase favors.
**Fix:** Cast to `ParsedSource` and switch on `src.kind`:
```ts
const src = record.source as ParsedSource;
let source: MarketplaceInfoMessage["source"];
switch (src.kind) {
  case "github":
    source = { sourceKind: "github", owner: src.owner, repo: src.repo,
               ...(src.ref !== undefined && { ref: src.ref }) };
    break;
  case "path":
  case "unknown":
  case "url":
  case "git-subdir":
  case "npm":
    source = { sourceKind: "path", absPath: record.marketplaceRoot };
    break;
  default:
    assertNever(src);
}
```
(Yes, the schema only admits `path | github | unknown` at runtime, but the switch covers the type-level enum to keep exhaustiveness honest.)

### IN-02: `marketplaceScope: opts.scope ?? "user"` placeholder relies on renderer carve-out staying invariant

**File:** `extensions/pi-claude-marketplace/orchestrators/marketplace/info.ts:170-175`
**Issue:** The `{not added}` `PluginInfoMessage` carries `marketplaceScope: opts.scope ?? "user"` as a "non-rendered placeholder per the INFO-04 carve-out." The renderer (`renderPluginInfo` lines 1963-1976) currently early-returns on the `{not added}` predicate before ever touching `marketplaceScope`. If a future renderer change adds an arm that consumes `marketplaceScope` BEFORE the carve-out check, the placeholder value would leak into the output as a misleading scope hint. The inline comment ("DO NOT 'fix' them") guards against contributor misreading but cannot prevent a renderer-side change. Consider strengthening the structural protection: either make `marketplaceScope` `undefined` (which would require type changes) or add a notify-v2 test that asserts the carve-out path is byte-stable even when the placeholder value is varied. Acceptable as-is given the explicit comment, but worth noting as a contract surface that depends on the renderer's predicate ordering.
**Fix:** No code change required if the carve-out is treated as load-bearing. Optionally add a notify-v2 test that varies `marketplaceScope` across `"user"` / `"project"` for an INFO-04 `{not added}` payload and asserts the rendered output is byte-identical (proves the renderer truly does not read the placeholder).

### IN-03: Phase 42 `scope-mismatch-not-added` narrative was modified (anchor block preserved byte-identical, but verification claim is slightly loose)

**File:** `docs/output-catalog.md:899-901`
**Issue:** The Phase 43 VERIFICATION.md SC#3 claims "Phase 42 `scope-mismatch-not-added` block (catalog narrative + annotation + fenced text + FIXTURE payload + `expectedSeverity: \"error\"`) is preserved byte-identical." In fact, the narrative paragraph above the annotation was extended by one sentence (the new distinction-from-`absent-from-both` clarification). The annotation itself and the fenced text block are byte-identical (the catalog-uat parser only consumes those), so the catalog UAT contract is preserved -- but the verification language overstates what was kept verbatim. Cosmetic; the change to the prose is helpful for readers comparing the two `{not added}` states. The PLAN itself permits narrative reorganization ("the anchor block itself is byte-unchanged"), so this is a verification-document-only discrepancy, not a code-quality issue.
**Fix:** No code change. If you want to tighten verification language for future phases, scope the byte-identity claim to "annotation + fenced text + FIXTURE payload + severity" and call out narrative refresh separately.

### IN-04: Wave 1 commit footprint includes `tests/edge/router.test.ts` not enumerated in Plan 43-01's `files_modified`

**File:** `.planning/phases/43-marketplace-info-command/43-01-PLAN.md:7-19`
**Issue:** Plan 43-01's `files_modified` frontmatter lists 12 files; the Wave 1 commit (`2de2fb8`) actually touches 13 (`tests/edge/router.test.ts` was added). The plan's Task 3 ACTION did mention this as conditional ("If the file doesn't exist, add the assertions to `tests/edge/handlers/marketplace/info.test.ts` instead"), and the executor opted to touch the existing `tests/edge/router.test.ts` to update the `makeHandlers` factory (the type extension forced it). This is documented as "Rule 1" in VERIFICATION.md and is unavoidable given the `SubcommandHandlers` interface extension. The frontmatter `files_modified` field would have benefited from including this file ahead of time, but the work is appropriate and atomic. Not a defect -- flagged as a documentation accuracy note for future phase planning.
**Fix:** No code change. Future plans that extend a closed-set interface should pre-list any test file that constructs literals of that interface (the typecheck-forced update is mechanical).

---

## Review Focus Coverage

| # | Focus area | Result |
|---|------------|--------|
| 1 | Correctness (INFO-01/03/06/07 end-to-end) | PASS -- all paths exercised by orchestrator + UAT |
| 2 | Phase 42 byte-equality carry-forward | PASS -- `git diff` confirms forbidden list unchanged |
| 3 | NFR-5 enforcement (grep-gate test exists) | PASS -- comment-stripped grep in info.test.ts |
| 4 | Dispatcher exhaustiveness (new info variant compile-fails) | PASS -- assertNever gate at outer switch holds |
| 5 | Test weakening check (Rule 1 updates symmetric) | PASS -- additions only, no deletions |
| 6 | Fan-out byte form (project-first, ONE blank line) | PASS -- locked by orchestrator test + UAT fixture |
| 7 | Catalog matrix completeness (6 new fixtures) | PASS -- 64 states total; 7 under marketplace info H2 |
| 8 | Atomic commit footprint (Wave 1 one commit / Wave 2 one commit) | PASS -- clean, no scope creep |
| 9 | Code quality (dead code, TODOs, abstractions) | PASS -- see WR-01, WR-02, IN-01 for minor concerns |
| 10 | Output channel (IL-2: all output via `ctx.ui.notify`) | PASS -- orchestrator + shim + dispatcher single-call discipline preserved |

---

_Reviewed: 2026-06-04T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
