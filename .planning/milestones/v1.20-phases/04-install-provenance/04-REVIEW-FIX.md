---
phase: 04-install-provenance
fixed_at: 2026-09-16T18:21:12Z
review_path: .planning/phases/04-install-provenance/04-REVIEW.md
iteration: 4
findings_in_scope: 2
fixed: 2
skipped: 0
status: all_fixed
---

# Phase 4: Code Review Fix Report

**Fixed at:** 2026-09-16T18:21:12Z
**Source review:** .planning/phases/04-install-provenance/04-REVIEW.md
**Iteration:** 4

**Summary:**
- Findings in scope: 2 (fix scope: all)
- Fixed: 2
- Skipped: 0

Iterations 1-3 fixed fourteen findings (reports preserved at `04-REVIEW-FIX.iter2.md`, `04-REVIEW-FIX.iter4.md`, and `04-REVIEW-FIX.iter6.md`; summarized below under "Fixed in iterations 1-3"). This iteration addresses the two findings of the iteration-4 review. The operator decisions from iteration 1 (`04-REVIEW.iter2.md` § Operator Decisions) stay binding -- WR-02, "the promotion writes what the enable path writes" -- and the import surface now meets that on BOTH config files.

## Where this ran

`workflow.use_worktrees` reads `true`, but the orchestrator's repo rules pin the root to this checkout (`/home/acolomba/src/pi-claude-marketplace-manifest`, itself a linked worktree on `features/manifest`) and require `pre-commit run --files` and `npm run check`, both of which need this tree's `node_modules`. No nested worktree was created; every edit, hook run, and commit happened in this checkout on `features/manifest`, with the pathspec commit form (`git commit -F <msgfile> -- <paths>`). The developer's uncommitted edits (`.claude/settings.json`, `.codex/config.toml`, `.planning/config.json`, `.planning/state.json`, `04-REVIEW.md`) and the untracked files were never staged. All verification numbers below are reproducible from this tree.

## Verification

- Every commit: `SKIP=trufflehog pre-commit run --files <committed files>` green (prettier, npm lint, format check, typecheck, fallow, direct coverage for the changed pairs). Prettier rewrote nothing during the hook runs; the test file was formatted with `prettier --write` before the CR-01 hook run.
- CR-01's `--local` mirror case was proven red against HEAD (`27a516ee`) before the production change: it failed on the base-file bytes, `"dep@fixture-mp": { "enabled": true }` where the bare key is expected -- the reviewer's reproduction, seen from the base file. The identity-rule case (local file declaring only other keys) was proven discriminating by mutating the key check to "any valid local file takes the stamp": it failed under the mutation and passes with the real check.
- `npm run check` on the final tree (`a54d1519`), run in this checkout: **exit 0** -- typecheck, lint, fallow (`No issues found`, `0 above threshold`, dupes clean), format:check, test:corresponding x2, test:coverage:direct:negative, unit 6399/6399 (three new cases), integration 32/32.
- Direct pair coverage: `execute.ts` 168/168 branches, 35/35 functions, 1316/1316 lines; `install.messaging.ts` green under the `npm-coverage-direct` hook.
- Complexity: fallow health `0 above threshold`; the local routing lives in its own helper (`stampReenabledWhereLocalDeclares`, two guards and a loop), and `writeBatchedConfigForScope`'s lock closure gained one `await` and no branch.
- Gates touched by name: the write-seam gate (`config-state-write-seams.test.ts`) pins `atomicWriteJson` call sites only, so `writePluginConfigEntry` from `execute.ts` needed no amendment; the unowned-export census is unaffected because `PROMOTED_ROW_REASONS` has a production consumer; the catalog contract (`catalog-contract.test.ts`) is green with the byte lock and state count untouched (no catalog edit this iteration).

## Fixed Issues

### CR-01: The CR-01 fix stamps `{ enabled: true }` in the base file, but a `disable --local` left `{ enabled: false }` in the local file, which still wins; the `/reload` the row asks for disables the plugin again

**Files modified:** `extensions/pi-claude-marketplace/orchestrators/import/execute.ts`, `tests/orchestrators/import/execute.test.ts`
**Commit:** 77e69efb
**Applied fix:** the reviewer's PRIMARY fix, as the guidance directed: the re-enable stamp goes to the file that declares the key (D-103-16), the rule the enable verb and the standalone promotion already follow. Inside `writeBatchedConfigForScope`'s post-pass lock, after the CFG-03 base-invalid check and before the base batch is merged, a new helper `stampReenabledWhereLocalDeclares` walks this scope's `installedPlugins` entries carrying `reenabled: true`, reads the local file, and where it declares the key writes `{ enabled: true }` there through `writePluginConfigEntry` (the sanctioned single-entry writer, which adds no `marketplaces` key to a file that declares none) and drops that key's base patch to the bare key; an absent, invalid, or non-declaring local file leaves the base `{ enabled: true }` as before. The local file is re-read per stamp so a second re-enabled key in the same file cannot clobber the first (the single-entry writer takes a config snapshot, so reusing one across two writes would drop the earlier patch). The alternative (letting the orchestrated promotion arm write config) was not taken: it breaks the "every write arm skips in orchestrated mode" rule at `install-flow.ts`. `writeBatchedConfigForScope`'s "targets `configJsonPath` unconditionally" doc line now states the one exception. Two cases. (1) The `--local` mirror of the base arm with production collaborators: import (cascade records `dep`, which carries a skill), `disable dep --local` through `createNodeSetPluginEnabled` (asserting the local file reads `{ enabled: false }` and the skill is gone), import naming `dep`; asserts the result entry (`promoted`, `reenabled`, `resourcesChanged`), the record enabled with `provenance: "explicit"`, the skill back on disk, the LOCAL file bytes `{ "dep@fixture-mp": { "enabled": true } }` (with the `marketplaces: {}` the disable verb's write left), the BASE file bytes with `sample` and `dep` as bare keys, the merged view `{ entry: { enabled: true }, source: "local" }`, an EMPTY `planReconcile` against `emptyReconcilePlan("project")`, and the rendered block with the reload trailer. (2) A collaborator-stub case pinning the identity rule: a disabled dependency record, `{ enabled: false }` in the base file, and a local file declaring only `other@mp`; the stamp lands in the base file and the local bytes are unchanged.

### IN-01: The promotion brace is spelled twice, and the catalog's "same on both surfaces" claim is not pinned

**Files modified:** `extensions/pi-claude-marketplace/orchestrators/plugin/install.messaging.ts`, `extensions/pi-claude-marketplace/orchestrators/import/execute.ts`, `tests/orchestrators/plugin/install.messaging.test.ts`
**Commit:** a54d1519
**Applied fix:** `PROMOTED_ROW_REASONS` (`["already installed", "dependency promoted"] as const satisfies readonly ContentReason[]`) is exported from `install.messaging.ts` beside `composePromotedRow`, which now returns it, and `execute.ts`'s promoted row reads the same binding (the `orchestrators` zone imports within itself; `execute.ts` already imports `install-flow.ts` from the same directory, and `install.messaging.ts` is not a ledger module, so neither the fallow zones nor `import-boundaries.test.ts` are touched). The messaging test gains the one-line equality pin: `composePromotedRow(...).reasons` is `PROMOTED_ROW_REASONS` by identity (`strictEqual`), and the tuple deep-equals the catalog's literal. The catalog-uat fixture and the four import promotion expectations keep their literal renderings, so the rendered bytes on both surfaces stay pinned independently of the constant.

## Fixed in iterations 1-3

Carried forward (commits on `features/manifest`):

Iteration 3 (`04-REVIEW-FIX.iter6.md`):

- **CR-01** (8e911215) -- `import` stamps `reenabled: true` on a promotion of a disabled record and the post-pass declares `{ enabled: true }` for it (this iteration routes that stamp to the declaring file).
- **WR-01** (0fb83baa) -- import's promoted row carries `{already installed, dependency promoted}`; catalog paragraph.
- **IN-01** (27a516ee) -- `InstallPluginOutcome.installed` carries `promoted?: true`, stamped by `promotedRowOutcome`; import reads it, so a lock-time promotion is marked.
- **IN-02** -- skipped by policy (a 77-character commit title cannot be rewritten; the repository squash-merges).

Iteration 2 (`04-REVIEW-FIX.iter4.md`):

- **WR-01** (005f596f) -- `import` promotes a partially installed dependency with the record's own consent.
- **IN-01** (8d88a6de) -- a pure promotion inside `import` carries no reload hint.
- **IN-02** (343b8f58) -- the promotion's version rule described as a user can act on it.
- **IN-03** (55634182) -- `isRetainedRecorded` names the retained-marketplace predicate once.

Iteration 1 (`04-REVIEW-FIX.iter2.md`):

- **CR-01** (110bb637) -- `holdsDependencyRecord` retains a recorded-but-undeclared marketplace while a dependency record sits under it.
- **WR-01** (39fd4619) -- `import`'s pre-check skips only a non-`"dependency"` record.
- **WR-02** (f3b4f045) -- promotion ENABLES a disabled record through the guard-free ledger; config write is `{ enabled: true }`.
- **WR-03** (d1d7bcb1) -- `refusesPromotion`: a version pin refuses; a partially installed record needs `--partial`.
- **IN-01** (b723f7f9) -- dependency guide describes promotion and the one-way ratchet.
- **IN-02** (08123f13) -- `reinstall-record.ts` comment states that reinstall does not promote.
- **IN-03** (4ef065ee) -- `plan.test.ts` fixture at `schemaVersion: 3`.

## Notes for the verifier

- CR-01 changes the config bytes an import writes for exactly one arm: a promotion of a record the disable verb disabled with `--local` (or with a plain `disable` while the local file already declared the key) now writes `{ enabled: true }` to `claude-plugins.local.json` and the bare key to `claude-plugins.json`. The base-file arm from iteration 3 is unchanged. A live check: import a config naming a plugin, `disable --local` a dependency the cascade recorded, import again naming that dependency, then `/reload` -- the plugin must stay installed and enabled, `claude-plugins.local.json` must read `"enabled": true` for it, and `claude-plugins.json` must carry the bare key.
- The local write happens before the base batch write, under the same scope lock. If the base write then fails, the local file already declares the key enabled and the next import's WR-01 repair pass adds the bare base key; the merged view is consistent either way.
- The pre-existing "every write arm skips in orchestrated mode" rule in `install-flow.ts` is untouched; the post-pass remains the only config writer for the import command.
- IN-01 is a refactor with no rendered-byte change; the catalog is unchanged.

---

_Fixed: 2026-09-16T18:21:12Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 4_
