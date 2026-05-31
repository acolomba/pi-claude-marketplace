---
phase: 27-marketplace-autoupdate-output-grammar
reviewed: 2026-05-31T09:51:28Z
depth: standard
files_reviewed: 5
files_reviewed_list:
  - extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts
  - tests/orchestrators/marketplace/update.test.ts
  - tests/shared/notify-v2.test.ts
  - tests/architecture/catalog-uat.test.ts
  - docs/output-catalog.md
findings:
  critical: 0
  warning: 3
  info: 1
  total: 4
status: issues_found
---

# Phase 27: Code Review Report

**Reviewed:** 2026-05-31T09:51:28Z
**Depth:** standard
**Files Reviewed:** 5
**Status:** issues_found

> Gap-closure review of the 27-05 delta (UXG-05 / UAT Test-3). Diff base
> `932e405^`. This run supersedes the prior phase-27 review (WR-01/WR-02/WR-03
> were the closure targets); 27-01..27-04 already-shipped code is out of scope.

## Summary

Adversarial review of the 27-05 gap-closure delta: the autoupdate-ON branch of
`refreshOneMarketplace` now collapses a true no-op to `(skipped) {up-to-date}`
gated on `!snapshot.changed && cascadeIsNoOp`, plus the WR-01 comment correction
(removing the false typebox `.Parse` claim) and the WR-02 PRE-read catch
narrowing (only ENOENT maps to the changed-safe default; other errors re-throw
to `(failed)`).

The core no-op gate logic is **correct**. I traced the empty-`outcomes` edge
(`[].every(...) === true`), the `snapshot.changed === true` short-circuit, and
the zero-plugin autoupdate-ON path -- all converge on the right emission and stay
consistent with the autoupdate-OFF path. WR-01's factual claim is verified
against `domain/manifest.ts` (`MARKETPLACE_VALIDATOR.Check()` only, raw
`JSON.parse` returned -- never `.Parse()`/`.Clean()`). WR-02's errno gate is
verified against Node runtime behavior (ENOENT carries `code === "ENOENT"`;
`SyntaxError` and the schema-invalid `Error` both carry `code === undefined`).
The three targeted test files are green (85/85 in the relevant subset) and
ESLint on `update.ts` is clean.

The findings are not in the happy-path gate. They concern the WR-02 fix's
interaction with the PRE-read call site (which lives OUTSIDE `refreshRecord`'s
try/catch), a doc claim that contradicts the actual control flow, the absence of
any test exercising the new `throw err` branch, and a byte-form asymmetry in the
all-`unchanged` cascade that depends on the orthogonal manifest-content flag.

## Warnings

### WR-01: WR-02 re-thrown PRE-read error bypasses `refreshRecord`'s `MarketplaceUpdateError` wrapper and surfaces a misleading `{network unreachable}` reason

**File:** `extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts:306` (PRE-read call site) + `:275-292` (WR-02 catch) + `:660` (fallback reason)

**Issue:** The WR-02 doc comment (lines 270-273) claims the re-thrown non-ENOENT
PRE-read error "propagates to `refreshRecord`'s try/catch and routes to the
existing `(failed)` path -- the same routing `validateManifestAtRoot` already
uses for POST-read failures." That is **not what the code does**. The PRE-read
(`const preKey = await manifestContentKey(record);`, line 306) runs *before* the
`try {` at line 307, so a non-ENOENT throw escapes `refreshRecord` **un-wrapped**
-- it never becomes a `MarketplaceUpdateError` and never gets the
"Failed to update marketplace" diagnostic that POST-read failures get (lines
336-343).

The raw error propagates through `withStateGuard` (preserved via `toError`) to
`refreshOneMarketplace`'s catch at line 651, where `reasonsFromCascadeError(err)`
is consulted. For a **corrupt-but-present** PRE manifest:
- Malformed JSON → `SyntaxError`, `code === undefined`.
- Schema-invalid → plain `Error` (`marketplace.json schema invalid: ...`),
  `code === undefined`.

Neither is a `PluginShapeError` and neither carries an errno code, so
`reasonsFromCascadeError` returns `undefined` and line 660 falls through to
`typedReasons ?? (["network unreachable"] as const)`. The user sees
`⊘ <mp> [<scope>] (failed) {network unreachable}` for what is actually a local
malformed/invalid manifest -- a materially misleading reason. WR-02's stated
intent ("removes the silent always-`(updated)` failure mode") is met for routing
but the replacement is mislabeled. A POST-read failure of the same manifest goes
through `refreshRecord`'s catch → `MarketplaceUpdateError` and surfaces the real
schema/JSON message in the cause chain (the MU-5 test asserts
`cause:.*clone advanced but manifest could not be persisted`). The two paths the
comment calls "the same routing" diverge in both wrapper and reason.

**Fix:** Preferred -- move the PRE-read inside the `try` so a re-thrown PRE-read
failure is wrapped consistently with POST-read failures and carries the real
cause text (this also makes the WR-02 comment true):

```ts
let cloneAdvanced = false;
let preKey: string | undefined;
try {
  preKey = await manifestContentKey(record);
  if (source.kind === "github") {
    // ... existing body ...
  } /* ... */
  const postKey = await manifestContentKey(record);
  // ...
} catch (err) {
  throw new MarketplaceUpdateError(/* cloneAdvanced gate */, { cause: err, /* ... */ });
}
```

A PRE-read throw occurs while `cloneAdvanced === false`, so the non-retry-hint
branch is correctly selected (nothing was fetched). Alternative -- keep the
PRE-read outside but (a) fix the doc comment to say the error propagates *raw*
and (b) add a non-ENOENT errno/shape mapping so the surfaced reason is honest
(e.g. `invalid manifest` / `unreadable manifest`).

### WR-02: WR-02's new `throw err` branch has zero test coverage

**File:** `extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts:286-290`

**Issue:** The behavioral heart of the WR-02 fix is the errno gate:

```ts
if ((err as NodeJS.ErrnoException).code === "ENOENT") {
  return undefined;
}
throw err;
```

The `throw err` arm -- the entire point of WR-02 (a corrupt/unreadable
pre-existing manifest must route to `(failed)` instead of silently reading as
`(updated)`) -- is **not exercised by any test**. The MU-5 test was deliberately
rewritten *in this same delta* (update.test.ts:409-457) to seed a VALID PRE
manifest and corrupt the manifest only inside the `checkout` override, so the
PRE-read succeeds -- i.e. it now avoids the WR-02 path rather than covering it. No
other test constructs a malformed / EACCES / schema-invalid *pre-existing*
manifest and asserts the resulting emission.

Without a test, a future "simplification" back to `catch { return undefined; }`
(exactly the pre-WR-02 bug) reintroduces the silent-always-`(updated)` failure
mode with a green suite. The regression WR-02 exists to prevent is left
unguarded.

**Fix:** Add an orchestrator-level test seeding a marketplace whose persisted
`manifestPath` points at malformed JSON (or a schema-invalid manifest), run
`updateMarketplace`, and assert the `(failed)` emission (NOT `(skipped)
{up-to-date}` and NOT `(updated)`). This also pins the surfaced reason, forcing
the WR-01 mislabeling to the surface:

```ts
test("WR-02: corrupt pre-existing manifest routes to (failed), never silent no-op", async () => {
  await withHermeticHome(async ({ cwd }) => {
    const { cloneDir } = await seedGithubMarketplace({ cwd, name: "corrupt", ref: "main" });
    await writeFile(
      path.join(cloneDir, ".claude-plugin", "marketplace.json"),
      "{ not valid json",
      "utf8",
    );
    const { ctx, pi, notifications } = makeCtx();
    const { gitOps } = makeMockGitOps({
      remoteRefs: { "refs/remotes/origin/main": "abcdef0000000000000000000000000000000123" },
    });
    await updateMarketplace({ ctx, pi, name: "corrupt", scope: "project", cwd, gitOps });
    const first = notifications[0];
    assert.ok(first !== undefined);
    assert.equal(first.severity, "error");
    assert.match(first.message, /^⊘ corrupt \[project\] \(failed\)/m);
  });
});
```

### WR-03: all-`unchanged` cascade emits divergent byte forms depending on the orthogonal `snapshot.changed` flag

**File:** `extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts:741-766`

**Issue:** The no-op gate fires only when `!snapshot.changed && cascadeIsNoOp`.
Consider an autoupdate-ON marketplace where **every cascaded plugin is
`unchanged`** but the **manifest content changed** (`snapshot.changed === true`)
-- e.g. marketplace.json grew an `owner` field or reordered keys while every
already-installed plugin stayed up-to-date. The gate at line 742 does NOT fire
(`!snapshot.changed` is false), so control falls through to line 757 and emits
`status: "updated"` **with** the all-`unchanged` cascade rows, each rendering
`⊘ <plugin> (skipped) {up-to-date}`.

The identical cascade outcome (every plugin `unchanged`) thus produces two
different user-visible byte forms:
- manifest unchanged → `● <mp> [<scope>] (skipped) {up-to-date}` (rows dropped)
- manifest changed   → `● <mp> [<scope>] (updated)` + N `⊘ <p> (skipped) {up-to-date}` rows

A `(updated)` header over a body of nothing-but-`{up-to-date}` skip rows is a
confusing surface -- the header claims an update while every row says nothing
moved. The 27-05 comment block (lines 691-717, 732-740) documents the no-op
collapse but never acknowledges this manifest-changed-but-all-plugins-unchanged
crossover, and no test covers it (both new gate tests use
`snapshot.changed === false`). Whether this is intended (a manifest-level change
is a legitimate `(updated)`) is defensible, but it is undocumented and
unasserted -- unprotected against regression and unclear to a maintainer.

**Fix:** Decide and document the contract, then lock it with a test. If
`(updated)` + all-skip rows is intended, add a one-line note to the comment at
lines 732-740 explaining the crossover plus a regression test
(`snapshot.changed === true` + all `unchanged` outcomes → `(updated)` with skip
rows). If the all-`unchanged` cascade should always collapse regardless of the
manifest flag, change the ON-path gate to `if (cascadeIsNoOp)` (the manifest
signal is already surfaced on the OFF path) and update the catalog note.

## Info

### IN-01: stale `claude-plugins-official` reference in the UXG-05 inline comment vs. actual fixture names

**File:** `extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts:716`

**Issue:** The closing comment of the UXG-05 binding block cites
`claude-plugins-official` as the example marketplace that "always rendered
`(updated)`" pre-fix. The corresponding tests use `noupd` (no-op gate) and
`official` (regression guard), and the catalog fixture uses `official`. The
`claude-plugins-official` name appears only in prose, inviting a maintainer to
grep for a fixture that does not exist.

**Fix:** Drop the parenthetical example or align it with the actual fixture /
catalog name (`official`).

---

_Reviewed: 2026-05-31T09:51:28Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
