---
phase: 12-messaging-foundations-renderer-primitives
reviewed: 2026-05-22T00:00:00Z
depth: standard
files_reviewed: 26
files_reviewed_list:
  - docs/messaging-style-guide.md
  - extensions/pi-claude-marketplace/orchestrators/import/execute.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/remove.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/update.ts
  - extensions/pi-claude-marketplace/persistence/migrate.ts
  - extensions/pi-claude-marketplace/presentation/README.md
  - extensions/pi-claude-marketplace/presentation/index.ts
  - extensions/pi-claude-marketplace/presentation/reload-hint.ts
  - extensions/pi-claude-marketplace/shared/grammar/reasons.ts
  - extensions/pi-claude-marketplace/shared/grammar/status-tokens.ts
  - tests/architecture/grammar-frontmatter.test.ts
  - tests/e2e/import-command.test.ts
  - tests/orchestrators/import/execute.test.ts
  - tests/orchestrators/marketplace/add.test.ts
  - tests/orchestrators/marketplace/remove.test.ts
  - tests/orchestrators/marketplace/update.test.ts
  - tests/orchestrators/plugin/install.test.ts
  - tests/orchestrators/plugin/reinstall.test.ts
  - tests/orchestrators/plugin/uninstall.test.ts
  - tests/orchestrators/plugin/update.test.ts
  - tests/persistence/migrate.test.ts
  - tests/presentation/reload-hint.test.ts
findings:
  critical: 0
  warning: 2
  info: 6
  total: 8
status: issues_found
---

# Phase 12: Code Review Report

**Reviewed:** 2026-05-22T00:00:00Z
**Depth:** standard
**Files Reviewed:** 26
**Status:** issues_found

## Summary

Phase 12 is a narrow messaging-foundations landing: the reload-hint composer
collapses to the single canonical trailer `/reload to pick up changes`, the
IL-3 sanctioned warn body at `persistence/migrate.ts:178` is rewritten to the
section 14.1 wording, all 8 orchestrator call sites swap from
`reloadHint(verb, names)` to `reloadHint(names)`, the
`presentation/index.ts` barrel drops the dead `ReloadVerb` re-export, two
new pure-data grammar modules (`shared/grammar/{status-tokens,reasons}.ts`)
ship with a frontmatter drift test, and `presentation/README.md` /
`docs/messaging-style-guide.md` reframe to past-tense around the Phase 12
contract change.

Correctness of the migration is good: every reload-hint call site uses the
new single-argument signature, no production caller still references
`ReloadVerb` or the legacy verb tokens, the byte-exact section 14.1 wording
at `persistence/migrate.ts:178` matches the style guide and the source-byte
tests (CMC-36 / CMC-37), the IL-3 inline `eslint-disable-next-line`
discipline is preserved, the new `REASONS` / `STATUS_TOKENS` constants are
set-equal to the style-guide frontmatter (asserted by the new drift test),
and the markers-snapshot test continues to pin `RELOAD_HINT_PREFIX` as a
snapshot-only constant per D-CMC-08 (Phase 13 deletes it). No correctness,
security, or data-loss defects were found.

The findings below are all comment / test-name drift (artefacts of the verb
collapse that the structural find-and-replace did not catch) plus one
explicitly TODO'd Phase-13-deferred grammar gap (`appendReloadHint` joins
with a single newline instead of the double-newline mandated by MSG-RH-1's
"preceded by a blank line"). None are blockers; the source itself is
functionally correct and the deferral is documented in-line.

## Structural Findings (fallow)

No structural-findings substrate was supplied with this review request. The
findings below are narrative only.

## Narrative Findings (AI reviewer)

## Warnings

### WR-01: Stale "verb 'drop'" / "RH-1, RH-2" comments left in production source after reload-hint collapse

**File:** `extensions/pi-claude-marketplace/orchestrators/marketplace/remove.ts:23,256`
**File:** `extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts:53,345`
**Issue:** The reload-hint call sites in `marketplace/remove.ts` and
`marketplace/update.ts` were correctly migrated to the single-argument
`reloadHint(names)` form, but the surrounding comments still describe the
retired verb selector. Specifically:

- `remove.ts:23` -- flow comment reads
  `notifySuccess body + soft-dep warnings (RH-5) + trailing reload hint (RH-1, verb 'drop')`.
- `remove.ts:256` -- inline comment reads
  `RH-1, RH-2 verb 'drop' with alphabetically-sorted names`.
- `update.ts:53` -- flow comment reads
  `RH-1/RH-2 reload hint (verb 'refresh')`.
- `update.ts:345` -- inline comment reads
  `RH-1 / RH-2: reload hint with verb 'refresh' iff updated[].length > 0`.

These four comments now contradict the code below them: the verb is no
longer selectable and `names` is no longer interpolated. Equivalent
comments in `plugin/install.ts`, `plugin/uninstall.ts`, `plugin/update.ts`,
`plugin/reinstall.ts`, and `import/execute.ts` were correctly updated to
reference `MSG-RH-1`, so this is uneven application of the comment
refresh, not a bigger pattern.

**Fix:** Rewrite the four comments to match the post-collapse semantics
(no verb, no name interpolation). Suggested wording for `remove.ts:256`:

```ts
// MSG-RH-1 / MR-8: reload hint emitted iff at least one plugin's
// resources were actually removed.
```

Same shape (mirroring the already-updated callsites) for the other three.

### WR-02: `appendReloadHint` joins body and trailer with a single newline; MSG-RH-1 mandates a blank line above

**File:** `extensions/pi-claude-marketplace/presentation/reload-hint.ts:46-57`
**Issue:** The section 5 / MSG-RH-1 rule from `docs/messaging-style-guide.md`
states the trailer is "preceded by a blank line, appended after the
compact-line body". The section 15 ES-5 replacement table reaffirms
"(single canonical trailer, blank line above)". The implementation joins
with a single `\n`, producing `body\n/reload to pick up changes` rather
than `body\n\n/reload to pick up changes`. The file's own TODO comment
acknowledges this and defers the one-line fix to Phase 13:

```ts
// TODO (Phase 13, MSG-RH-1): style-guide section 5 specifies the hint is
// "preceded by one blank line", i.e. a double-newline join. Phase 12
// intentionally retains the single-newline join to defer the conformance
// pass to Phase 13's mechanical refactor scope ...
```

Calling this out so it survives the review record rather than getting
lost in the TODO: the trailer text shipped, but the trailer's MSG-RH-1
positioning did NOT ship. Every Phase 12 success message that currently
emits a reload hint is therefore one blank line short of the rendered
form in the style guide's worked examples (sections 16.1 / 17.2 / 17.3).
Tests at `tests/presentation/reload-hint.test.ts:25-30` assert the
single-newline shape, so they would need to flip atomically with the
join change.

**Fix:** Phase 13 should flip `\n${hint}` to `\n\n${hint}` and update
the test assertion. The file already documents that this is the SOLE
remaining work to make MSG-RH-1 fully conformant on this composer.
No fix is required IN Phase 12 if the deferral is the recorded plan;
this finding is recorded so the gap is not forgotten.

## Info

### IN-01: Header comment in `persistence/migrate.ts` shows comma-without-space; actual disable uses comma-with-space

**File:** `extensions/pi-claude-marketplace/persistence/migrate.ts:8`
**Issue:** The file-header docstring documents the IL-3 disable
incantation as:

```ts
//   // eslint-disable-next-line no-restricted-syntax,no-console -- IL-3 ...
```

(no space between `no-restricted-syntax,` and `no-console`). The actual
disable comment at line 177 uses:

```ts
// eslint-disable-next-line no-restricted-syntax, no-console -- IL-3: load-time migrate save fail
```

(comma-then-space). ESLint accepts both forms, and the test
`tests/persistence/migrate.test.ts:191-198` asserts the with-space form
literally, so the live code matches the test. The mismatch is purely
between the file header's example and the file's own code.

**Fix:** Update the header at line 8 to use the with-space form so it
matches the live disable directive at line 177.

### IN-02: `tests/orchestrators/plugin/uninstall.test.ts` test names and comments still reference "verb 'drop'"

**File:** `tests/orchestrators/plugin/uninstall.test.ts:233,533`
**Issue:** The PU-1 test body comment at line 233 reads
`// PU-8: reload hint emitted (verb 'drop'); single dropped name -> "it" form.`
and the PU-8 (a) test name at line 533 is
`PU-8 (a): >=1 resource dropped -> reload hint present (verb 'drop', 'it' form)`.
The assertions inside those tests were correctly migrated to
`/\/reload to pick up changes$/`, so the tests pass -- but the test
names and comments describe rendering shapes that no longer exist
(`(verb 'drop')`, `'it' form`). A future reader debugging an uninstall
reload-hint regression will read "verb 'drop'" and waste time looking
for verb selection code that the composer no longer has.

**Fix:** Rename the test to
`PU-8 (a): >=1 resource dropped -> reload hint present` and rewrite the
inline comment to
`// PU-8 / MSG-RH-1: reload hint emitted iff anything dropped.`.

### IN-03: `MR-8 + MSG-RH-1` test in `tests/orchestrators/marketplace/remove.test.ts` over-seeds for an assertion the new grammar cannot reach

**File:** `tests/orchestrators/marketplace/remove.test.ts:267-308`
**Issue:** The test was renamed from
`MR-8 + RH-2: plugin whose skill is staged emits reload hint with alphabetical names`
to
`MR-8 + MSG-RH-1: plugin whose skill is staged emits the canonical reload hint trailer`
and its sole `assert.match` was rewritten to
`/\/reload to pick up changes$/`. The setup still seeds two plugins
(`hello` and `alpha`) along with two skill directories so the
orchestrator has a chance to compose the previously-asserted alphabetical
name ordering (`Run /reload to drop "alpha", "hello".`). Under the new
grammar the names are no longer interpolated, so seeding two plugins
and two skills proves nothing the single-plugin variant does not already
prove. Not a defect -- the test still asserts a meaningful invariant --
but the fixture is now larger than the assertion needs.

**Fix:** Either (a) trim the fixture to a single plugin/skill and rely
on the existing `PU-8 (a)` and `MR-2` tests for the multi-plugin
coverage, or (b) keep the two-plugin setup and add an explicit
assertion that the trailer line is invariant under multi-name input
(documents the deliberate "names ignored beyond non-empty check"
semantic called out in `reload-hint.ts:30-36`). Option (b) is the
smaller change.

### IN-04: `REASONS` / `STATUS_TOKENS` / `Reason` / `StatusToken` are exported but currently have no in-tree consumer

**File:** `extensions/pi-claude-marketplace/shared/grammar/reasons.ts`
**File:** `extensions/pi-claude-marketplace/shared/grammar/status-tokens.ts`
**Issue:** Both modules ship a runtime array (`as const`) plus a derived
literal-union type and have no production consumer in the Phase 12 tree
-- only the drift test at `tests/architecture/grammar-frontmatter.test.ts`
imports them. This is intentional per the file headers (Phase 13 will
consume them; the constants land in Phase 12 so the drift guard can be
in place when Phase 13 starts). Listed here so the review record
acknowledges the dead-code shape was inspected and accepted, not missed.

**Fix:** None. Accept as-is for Phase 12. Phase 13 will add the
consumer side and at that point the union types will start narrowing
real call sites.

### IN-05: `presentation/index.ts` barrel no longer re-exports the deleted `ReloadVerb` type -- verified clean

**File:** `extensions/pi-claude-marketplace/presentation/index.ts`
**Issue:** The Phase 12 barrel correctly drops
`export type { ReloadVerb } from "./reload-hint.ts";` and the
`ReloadVerb` type was deleted from `reload-hint.ts`. A grep across the
extension and tests for `ReloadVerb` returns no remaining references,
so the dead-export removal is clean.

**Fix:** None. Recorded as positive confirmation that the type deletion
landed atomically with its single re-export.

### IN-06: `tests/architecture/grammar-frontmatter.test.ts` regex extractor is fragile but acceptable

**File:** `tests/architecture/grammar-frontmatter.test.ts:36-60`
**Issue:** The frontmatter list extractor uses two regex stages:

```ts
const frontmatterMatch = /^---\n([\s\S]*?)\n---\n/.exec(md);
const keyBlockRe = new RegExp(`^${key}:\\n((?:  - .+\\n)+)`, "m");
```

It assumes (a) Unix line endings exactly (`\n`, not `\r\n`), (b) the
frontmatter is at byte 0, (c) bullet lines start with exactly two
spaces. If a future contributor edits `docs/messaging-style-guide.md`
on Windows or with a different indent the test will throw with a
"frontmatter not found" error rather than degrading gracefully. The
file header acknowledges this is the Phase 12 footprint and that Phase
14 will adopt a real YAML reader, so the brittleness is documented and
scoped.

**Fix:** None for Phase 12. Phase 14's broader drift-guard refactor
should absorb this extractor into a single project-wide YAML reader.
The header note already records this.

---

_Reviewed: 2026-05-22T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
