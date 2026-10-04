---
phase: 02-adapter-file-delivery
reviewed: 2026-10-04T00:42:27Z
depth: deep
iteration: 3
files_reviewed: 76
files_reviewed_list:
  - AGENTS.md
  - docs/output-catalog.md
  - docs/prd/pi-claude-marketplace-prd.md
  - extensions/pi-claude-marketplace/bridges/mcp/adapter-doc.ts
  - extensions/pi-claude-marketplace/bridges/mcp/adapter-entry.ts
  - extensions/pi-claude-marketplace/bridges/mcp/collision-ancestors.ts
  - extensions/pi-claude-marketplace/bridges/mcp/collision-slots.ts
  - extensions/pi-claude-marketplace/bridges/mcp/safe-set.ts
  - extensions/pi-claude-marketplace/bridges/mcp/stage.ts
  - extensions/pi-claude-marketplace/bridges/mcp/types.ts
  - extensions/pi-claude-marketplace/bridges/mcp/unstage.ts
  - extensions/pi-claude-marketplace/orchestrators/import/execute.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/remove.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-cascade.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-disable-cascade.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-flow.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-outcome.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/prune-rollback.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/prune.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/reinstall-flow.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/reinstall-replace.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/update-flow.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/update-swap.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/apply-outcomes.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/backfill.ts
  - extensions/pi-claude-marketplace/orchestrators/types.ts
  - extensions/pi-claude-marketplace/persistence/locations.ts
  - extensions/pi-claude-marketplace/shared/atomic-json.ts
  - extensions/pi-claude-marketplace/shared/errors-bridges.ts
  - extensions/pi-claude-marketplace/shared/notification-dispatch.ts
  - package.json
  - scripts/check-unused-type-members.contracts.json
  - tests/architecture/catalog-block.ts
  - tests/architecture/catalog-uat/catalog-contract.test.ts
  - tests/architecture/catalog-uat/fixtures/plugin-prune.ts
  - tests/architecture/config-state-write-seams.test.ts
  - tests/architecture/hooks-cap-notify.test.ts
  - tests/architecture/integration-materialization-gate.test.ts
  - tests/architecture/mcp-config-notices.test.ts
  - tests/bridges/mcp/adapter-doc.test.ts
  - tests/bridges/mcp/adapter-entry.test.ts
  - tests/bridges/mcp/collision-ancestors.test.ts
  - tests/bridges/mcp/collision-slots.test.ts
  - tests/bridges/mcp/stage.test.ts
  - tests/bridges/mcp/types.test.ts
  - tests/bridges/mcp/unstage.test.ts
  - tests/e2e/install-soft-deps.test.ts
  - tests/orchestrators/import/execute.test.ts
  - tests/orchestrators/marketplace/remove.test.ts
  - tests/orchestrators/marketplace/shared.test.ts
  - tests/orchestrators/marketplace/update.test.ts
  - tests/orchestrators/plugin/enable-disable.test.ts
  - tests/orchestrators/plugin/install-cascade.test.ts
  - tests/orchestrators/plugin/install-disable-cascade.test.ts
  - tests/orchestrators/plugin/install-flow.test.ts
  - tests/orchestrators/plugin/install-outcome.test.ts
  - tests/orchestrators/plugin/prune-rollback.test.ts
  - tests/orchestrators/plugin/prune.test.ts
  - tests/orchestrators/plugin/reinstall-flow.test.ts
  - tests/orchestrators/plugin/reinstall-replace.test.ts
  - tests/orchestrators/plugin/shared.test.ts
  - tests/orchestrators/plugin/uninstall.test.ts
  - tests/orchestrators/plugin/update-flow.test.ts
  - tests/orchestrators/plugin/update-swap.test.ts
  - tests/orchestrators/reconcile/apply-outcomes.test.ts
  - tests/orchestrators/reconcile/apply.test.ts
  - tests/orchestrators/reconcile/backfill.test.ts
  - tests/persistence/locations.test.ts
  - tests/shared/atomic-json.test.ts
  - tests/shared/errors-bridges.test.ts
  - tests/shared/notification-dispatch.test.ts
findings:
  critical: 0
  warning: 0
  info: 8
  total: 8
status: clean
---

# Phase 2: Code Review Report (iteration 3, plus a narrow post-cap pass)

**Reviewed:** 2026-10-04T00:42:27Z
**Depth:** deep (post-cap pass, two files)
**Files Reviewed:** 76 (full scope in frontmatter); the last pass read 2
**Status:** issues_found

## Summary

The 3-iteration auto-fix loop ended with two Warnings (WR-01, WR-02 of
iteration 3; saved as `02-REVIEW.iter4.md`). Both came from the rename-aside
metadata restore that `f692a2c7` added. The operator chose D-02-20, and
commit `4658eb59` implements it.

**This last pass was narrow.** It covered two files only:
`extensions/pi-claude-marketplace/orchestrators/plugin/prune-rollback.ts` and
`tests/orchestrators/plugin/prune-rollback.test.ts`. The other 74 files in the
frontmatter list were not re-read. Their carried Info findings (IN-01..IN-06)
are copied unchanged from iteration 3.

What I checked:

- `git diff f692a2c7^ 4658eb59 -- prune-rollback.ts` touches only the
  metadata seam: the new `writeMetadata` member (`prune-rollback.ts:50`), the
  `ownWrite` field on the verdict (`:204`, `:237-239`), `holdsBytes`
  (`:242-246`), and the D-02-20 branch (`:259-266`). `restoreArtifact`
  (`:164-199`) has no diff against `f692a2c7^`. It is back to its
  pre-`f692a2c7` behavior byte for byte. `rename` and `publishBackupCopy` are
  gone, and no `.prune-restore-` staging is created for metadata. The only
  remaining `mkdtemp` is the artifact restore (`:182`), as before.
- D-02-19: the restore runs only when the live bytes equal the prune's last
  recorded write (`:237`, re-checked at `:263`). Anything else throws the
  unchanged "occupied metadata path" refusal (`:270`).
- D-02-20: the final compare (`:263`) runs right before
  `writeFileAtomic` (`:264`). Nothing awaits between them except the compare
  itself. The live file is never renamed or deleted, and no staging directory
  is made. The window is documented at `:259-262`. The accepted window is not
  a finding.
- Every failure path of the metadata restore. A missing, non-file, or
  different live file at the final compare gives the refusal (`:263`, `:270`).
  A throw from `holdsBytes` or from the write escapes as a raw error. In each
  case the live file is left as it was, `failures` is non-empty, and the backup
  is kept (`:415-416`, `:431`). A failed `writeFileAtomic` cleans up its own
  temp file and leaves the target alone.
- Gates on the two files: `prune-rollback.test.ts` passes 43/43.
  `npm run lint:type-members` passes, so the optional `writeMetadata` member
  needs no contracts pin. ESLint shows 0 errors. Its three
  unused-directive warnings (`:346`, `:404`, `:413`) are older than this
  commit and outside the seam.
- Test strength, measured by mutating a scratch copy of the module (since
  deleted):
  - Removing the final recheck at `:263` fails 2 tests (`:1231`, `:1333`).
  - Replacing `ops.writeMetadata ?? writeFileAtomic` with the bare call fails
    `:1281`.
  - Removing `pathExists` from `holdsBytes` fails `:1333`.
  - Removing `.isFile()` from `holdsBytes` fails **nothing** (see WR-03).

### Resolved after the iteration cap

| ID (iter. 3) | Status | Evidence |
|----|--------|----------|
| WR-01 (staging dir outside NFR-10, not reported) | Resolved by `4658eb59` / D-02-20 | The metadata restore makes no staging directory. The only `mkdtemp` left is the artifact restore at `prune-rollback.ts:182`, whose targets lie under `extensionRoot`/`agentsDir`. The raw `EEXIST` departure from D-02-19 is gone: every compare mismatch throws the refusal at `:270`. The test that pinned `EEXIST` was rewritten (`prune-rollback.test.ts:1281-1331`), and it now asserts that the config directory holds no extra entry at write time and after the rollback. |
| WR-02 (non-`EEXIST` failure deletes the live MCP file) | Resolved by `4658eb59` / D-02-20 | The live file is never moved. The only mutation is `writeFileAtomic` (`:264`), which replaces the file or leaves it alone. `prune-rollback.test.ts:1281` faults the write and asserts that the live file still holds the prune's bytes and the backup is kept. `:1333` deletes the file after the verdict and asserts that it stays absent, the refusal is raised, and the backup is kept. |
| WR-03 (narrow pass: no test pins the `isFile()` guard) | Resolved by `25ea04c6` | The orchestrator added the review's proposed case, "D-02-20: a symlink swapped in after the rollback reads the recorded unstage write is refused" (`prune-rollback.test.ts`). It passes on the real module and fails when `.isFile()` is removed from `holdsBytes` (checked by mutation, module restored). |
| IN-07 (in-place writer lost by `rm(stagingRoot)`) | Superseded by `4658eb59` | The rename and the staging `rm` it cited (old `:287`, `:291`, `:305-308`) no longer exist. An in-place writer that writes between the final compare and the rename is now part of the window D-02-20 accepts. The original text is kept below for the record. |

## Narrative Findings (AI reviewer)

## Warnings

None open. WR-03 below is kept for the record and is resolved (see the table above).

### WR-03 (resolved by `25ea04c6`): No test pins the `isFile()` guard in the final compare, and without it the restore writes through a symlink outside the scope

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/prune-rollback.ts:242-246`, `:263-264`; `tests/orchestrators/plugin/prune-rollback.test.ts:1231-1373`
**Issue:** `holdsBytes` checks `(await lstat(file)).isFile()` (`:244`) before
it reads the bytes. That check is what stops the D-02-20 write when someone
swaps the live MCP file for a symlink after the verdict (`:219-222` runs only
at verdict time). `readFile` follows symlinks, and so does `writeFileAtomic`,
which resolves the real path before it writes. Without the check, a symlink
to a file holding the prune's bytes passes the compare. The restore then
writes the original over the symlink's target, which can be outside
`<scopeRoot>` (NFR-10). Because the rollback then reports no failure, the
backup is deleted too (`:431-433`).

The current module is correct. The gap is in the tests: none of the three
tests that drive the post-verdict window (`:1231`, `:1281`, `:1333`) puts a
non-regular file at the target. I deleted `.isFile()` in a scratch copy and
all 43 tests still passed. This seam has regressed in three fix rounds in a
row, so a guard that the suite does not hold should be treated as unprotected.

Reproduced with a throwaway test in the scratch copy (since deleted).
`afterMetadataRead` replaces `mcp-adapter.json` with a symlink to
`<cwd>/outside.json`, which holds the recorded own-write bytes.
- Real module: the result is `[["mcp adapter","Prune rollback found an occupied metadata path at …/.pi/mcp-adapter.json."]]`, and `outside.json` is unchanged.
- `.isFile()` removed: the result is `[]`, and `outside.json` is overwritten
  with the backup's `{ "mcpServers": { "orphan": 1 } }`.

**Fix:** Add a case next to `:1333`. It swaps a symlink in after the verdict
and asserts the refusal, the untouched link target, and the kept backup:
```ts
test("D-02-20: a symlink swapped in after the rollback reads the recorded unstage write is refused", async () => {
  await withHermeticEnvironment("prune-rollback-own-write-symlink-", async ({ cwd }) => {
    // arrange
    const locations = locationsFor("project", cwd);
    const fixture = await seed(locations);
    const original = Buffer.from('{ "mcpServers": { "orphan": 1 } }\n');
    await writeFile(locations.mcpAdapterJsonPath, original);
    const ownBytes = Buffer.from('{\n  "mcpServers": {}\n}\n');
    const outside = path.join(cwd, "outside.json");
    const rollback = await preparePruneRollback(locations, [fixture.member], {
      removeBackup: rm,
      afterMetadataRead: async (target: string): Promise<void> => {
        if (target === locations.mcpAdapterJsonPath) {
          await writeFile(outside, ownBytes);
          await rm(target);
          await symlink(outside, target);
        }
      },
    });
    await writeFile(locations.mcpAdapterJsonPath, ownBytes);
    rollback.recordMcpWrites([{ path: locations.mcpAdapterJsonPath, bytes: ownBytes }]);

    // act
    const failures = await rollback.rollback();

    // assert
    assert.deepStrictEqual(
      failures.map(({ phase, cause }) => ({ phase, message: cause.message })),
      [{ phase: "mcp adapter", message: `Prune rollback found an occupied metadata path at ${locations.mcpAdapterJsonPath}.` }],
    );
    assert.deepStrictEqual(
      {
        outside: await readFile(outside),
        backup: await readFile(path.join(locations.extensionRoot, rollback.backupName, "6")),
      },
      { outside: ownBytes, backup: original },
    );
  });
});
```

## Info

### IN-01: Stub absorption drops the stub's other fields without notice, and uninstall then loses the user's override (carried forward)

**File:** `extensions/pi-claude-marketplace/bridges/mcp/stage.ts:219-233`, `extensions/pi-claude-marketplace/bridges/mcp/adapter-doc.ts:259`
**Issue:** Unchanged. D-02-10 copies only the carried fields from a
marker-less stub, and `withPluginServers` then drops the stub. Any other field
the user put in it is deleted without a notice.
**Fix:** Consider a closed-catalog notice, or a BACKLOG entry next to MCPOVR-01.

### IN-02: Update and reinstall leave the plugin's stale legacy `mcp.json` entries live until Phase 5 (carried forward)

**File:** `extensions/pi-claude-marketplace/bridges/mcp/stage.ts:233`, `:285`
**Issue:** Unchanged. Staging rewrites only `mcp-adapter.json`, so a dropped
or renamed server keeps its marked legacy entry. Since the iteration-2 WR-02
fix, a partial unstage now keeps such a name in the record. That is correct,
but it means the stale legacy entry lasts longer.
**Fix:** Add a Phase 5 note: migrate only names the record lists, and delete
orphaned legacy entries.

### IN-03: Duplicated helpers with diverging policies (carried forward)

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/install-flow.ts:651` and `orchestrators/marketplace/shared.ts:357` (`mcpConfigNoticesMember`); `orchestrators/marketplace/shared.ts:364` (`writtenMcpFilesMember`); `bridges/mcp/adapter-doc.ts:102-107` (`readOptionalText`, which treats `ENOTDIR` as absent) vs `bridges/mcp/stage.ts:362-371` (`readOptionalBytes`, which throws on `ENOTDIR`)
**Issue:** Unchanged. The prepare step reads `ENOTDIR` as an absent file, but
replace throws on it.
**Fix:** Import `mcpConfigNoticesMember` in install-flow. Give
`readOptionalBytes` the same `ENOENT || ENOTDIR` rule, or share one reader.

### IN-04: A non-object `mcp-servers` blocks every install and uninstall even when the adapter ignores it (carried forward)

**File:** `extensions/pi-claude-marketplace/bridges/mcp/adapter-doc.ts:124`, `:174-175`
**Issue:** Unchanged. `collectServerMaps` validates every server key that is
present, including the one pi-mcp-adapter never reads.
**Fix:** Validate the selected key, and the other key only when it holds an
object.

### IN-05: Bulk-update abort arms show comments-dropped notices for plugins whose updated rows are never shown (carried forward, was IN-06)

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/update-flow.ts:307`, `:342` (vs `:372-373`)
**Issue:** Unchanged. These two arms show the notices but skip
`renderUpdateCascadeIfAny`, which the phase-3a arm calls. The fix report
deferred this on purpose because it changes existing output, so it is an
operator call.
**Fix:** Call `renderUpdateCascadeIfAny(...)` before
`surfaceUpdateMcpConfigNotices` in both arms.

### IN-06: `MarketplaceRemoveFailureError` lives in an orchestrator file, not with the typed errors (carried forward, was IN-07)

**File:** `extensions/pi-claude-marketplace/orchestrators/marketplace/remove.ts:102`; imported at `orchestrators/reconcile/apply.ts:78`
**Issue:** Unchanged. CONVENTIONS.md puts every domain error class in
`shared/errors.ts` / `errors-bridges.ts`.
**Fix:** Move it to `shared/errors.ts` next to `MarketplaceUpdateError`.

### IN-08: A race inside `holdsBytes` raises a raw errno instead of the occupied-path refusal

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/prune-rollback.ts:242-246`
**Issue:** `holdsBytes` makes three separate calls: `pathExists`, `lstat`, and
`readFile`. If the file is removed or replaced between them, `lstat` or
`readFile` throws `ENOENT` (or `EISDIR`). That raw error replaces the D-02-19
"occupied metadata path" refusal (`:270`). Nothing is written, and the backup
is kept (`:431`), so the only effect is the wording on the failed row. The
same pattern already exists in `metadataVerdict` (`:215-229`).
**Fix:** Optional. Catch `ENOENT`/`ENOTDIR`/`EISDIR` inside `holdsBytes` and
return `false`, so every "the file is not the prune's write" outcome takes
the refusal path.

### IN-09: The failed-write test keeps a `link` stub that no longer drives any path

**File:** `tests/orchestrators/plugin/prune-rollback.test.ts:1292-1298`
**Issue:** The metadata restore no longer calls `ops.link`
(`prune-rollback.ts:263-264`). The artifact restores call it with
non-adapter targets, so the stub's throwing branch is never reached. A return
to rename-aside would already fail on `entriesAtWrite` (`:1320-1323`). The
stub is therefore dead arrangement. It suggests a link path that the module
no longer has.
**Fix:** Remove the `link` override, or add a one-line comment saying it is a
regression trap for a link-based restore.

## Superseded

### IN-07 (superseded by `4658eb59`, not counted): An in-place writer that opened the file before the rename can still lose its write

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/prune-rollback.ts:287`, `:291`, `:305-308`
**Issue:** The rename closes the window for writers that replace the file,
like write-file-atomic and most editors. Some writers instead open the file
and write in place, for example vim with `backupcopy=yes`. If such a writer
opened `target` before the rename, its write lands in the inode now at
`aside`. If that write happens after `holdsBytes` has read the bytes (`:291`),
the publish succeeds. Then `rm(stagingRoot)` (`:308`) deletes the edited
inode. The window is small, and this is not a regression: the earlier
`writeFileAtomic` overwrite had the same exposure.
**Fix:** Optional. After a successful publish, re-check that `aside` still
holds `ownWrite` before removing the staging directory. If it does not, keep
the staging directory and report it, as WR-01 suggests.

---

_Reviewed: 2026-10-04T00:42:27Z (narrow post-cap pass over 2 files; iteration 3 covered 76 files on 2026-10-03T23:30:00Z)_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep (post-cap pass), standard (iteration 3)_
