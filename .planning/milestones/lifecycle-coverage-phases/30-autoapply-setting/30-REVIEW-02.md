---
phase: 30-autoapply-setting
reviewed: 2026-10-25T00:00:00Z
depth: deep
diff: b54e9765..46c6fc66
files_reviewed: 24
files_reviewed_list:
  - extensions/pi-claude-marketplace/edge/handlers/plugin/autoapply.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/autoapply-setting.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/pending.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/load.ts
  - extensions/pi-claude-marketplace/persistence/config-merge.ts
  - extensions/pi-claude-marketplace/persistence/config-write-back.ts
  - extensions/pi-claude-marketplace/shared/notification-dispatch.ts
  - extensions/pi-claude-marketplace/shared/notification-grammar.ts
  - extensions/pi-claude-marketplace/shared/notification-json.ts
  - extensions/pi-claude-marketplace/shared/notification-resolve.ts
  - extensions/pi-claude-marketplace/shared/notification-types.ts
  - extensions/pi-claude-marketplace/shared/notification-wire.ts
  - extensions/pi-claude-marketplace/edge/router.ts
  - extensions/pi-claude-marketplace/edge/register.ts
  - extensions/pi-claude-marketplace/edge/flag-catalog.ts
  - extensions/pi-claude-marketplace/edge/completions/provider.ts
  - features/plugin/autoapply.feature
  - features/plugin/help.feature
  - features/step_definitions/plugin/autoapply.steps.ts
  - docs/json-output.md
  - docs/output-catalog.md
  - README.md
  - README.es.md
  - test/orchestrators/reconcile/autoapply-setting.test.ts
findings:
  critical: 1
  warning: 3
  info: 8
  total: 12
status: issues_found
---

# Phase 30: Code Review Report (plan 30-02, the `autoapply` command)

**Reviewed:** 2026-10-25
**Depth:** deep (call chains traced into `migrate-config.ts`, `with-state-guard.ts`, `config-io.ts`, `probe-classifiers.ts`, `reconcile/plan.ts`, `read-pass.ts`)
**Files Reviewed:** 24 (plus the unit tests and the architecture test lists that the diff touched)
**Status:** issues_found

## Summary

The show path, precedence (`effectiveAutoapply`), filter logic, set-target defaults, argument parsing (including `--local` and `--scope` in any order), the raw-kind plumbing (types, resolve, grammar, JSON, wire schema, dispatch), and completions are correct. The JSON wire shape matches the typebox schema and `docs/json-output.md`.

The set path has one data-loss hole. The MIG-01 guard (T-30-07) runs `migrateFirstRunConfig`, but the set ignores its result. When the migration declines because the scope's local config is invalid, the set still creates the base config with only `autoapply` in it. That stops MIG-01 from capturing the scope's records on every later load. I reproduced this with a scratch test in a hermetic tree (details in CR-01). The same path also reports a write that succeeded as a failure (WR-01). The cucumber suite covers neither the migration nor this path.

## Critical Issues

### CR-01: A set into an absent base config while the local config is invalid skips MIG-01 and writes a base config that drops every recorded marketplace

**File:** `extensions/pi-claude-marketplace/orchestrators/reconcile/autoapply-setting.ts:161-178`
**Issue:** `writeUnderLock` calls `migrateFirstRunConfig(loc, tx.state)` and discards the result. `migrateFirstRunConfig` returns `{ migrated: false, reason: "local-invalid" }` and writes nothing when `claude-plugins.json` is absent and `claude-plugins.local.json` is invalid (FIX-02). The set then calls `loadConfig(base)`, gets `absent`, and writes `{ "schemaVersion": 1, "autoapply": <v> }`. From then on the base config exists, so MIG-01 (which fires only on the `absent` arm) never captures the scope's records. After the user repairs the local file, the next load plans every recorded marketplace and plugin of that scope as undeclared. `buildUninstallBucket` and `marketplacesToRemove` sweep them. With `autoapply on`, which this command just set, the load applies that plan with no prompt. This is the threat T-30-07 says is mitigated.

Reproduced with a scratch `node --test` file in a hermetic tree (project state recording marketplace `mp`, base config absent, local config `{ broken`, then `setAutoapply({ scope: "project", enabled: true })`):

```text
notification: "Some operations have failed. ... claude-plugins.local.json [project] (failed) {invalid manifest} ... Reconcile pending: 2 failures" (error)
BASE: { "schemaVersion": 1, "autoapply": true }      <- marketplace "mp" not captured
```

The unit test `AAP-04 / MIG-01` covers only the happy `absent` + valid-local arm.
**Fix:** Refuse to write when the migration could not run. The plan's own truth ("An invalid config fails show and set closed") argues for checking every config before the write. At minimum, check the target scope's local config:

```ts
return withLockedStateTransaction(loc, async (tx) => {
  if (filePath === loc.baseConfigJsonPath) {
    const migration = await migrateFirstRunConfig(loc, tx.state);
    if (!migration.migrated && migration.reason === "local-invalid") {
      return await loadConfig(loc.localConfigJsonPath); // invalid -> refused, nothing written
    }
  }
  ...
});
```

Also make the refusal report the file that actually blocked the write. Today `notifyInvalidConfigs` is called with the target `filePath`, so return `{ filePath, error }` from the locked body rather than a bare `ConfigLoadResult`. Add a unit case (absent base, invalid local, populated state, so the base must stay absent) and a cucumber scenario.

## Warnings

### WR-01: A set that writes the file but finds another invalid config reports only a failure, so the write is invisible

**File:** `extensions/pi-claude-marketplace/orchestrators/reconcile/autoapply-setting.ts:198-215` (and `docs/output-catalog.md`, "Autoapply status" last paragraph)
**Issue:** `setAutoapply` writes first and only then runs `statusOrReport` over the four files. If any file other than the target is invalid, the user gets the `{invalid manifest}` block at `error` severity ("Some operations have failed.") and no `Set autoapply to ... in ...` line. The file did change. The unit test `set writes a valid target, then reports another invalid config instead of a value` locks this in. A user who reads the error as "nothing happened" may retry or edit by hand, and a JSON consumer sees a `cascade` failure for a mutation that succeeded. The catalog says "An invalid config fails the command closed (D-03)", and plan truth 3 says "fails show and set closed". Neither matches a command that writes and then reports failure. CR-01 is the worst case of this ordering.
**Fix:** Pick one contract and document it. Either (a) fail closed: load the four files under the lock before the write and refuse with `notifyInvalidConfigs` when any is invalid (this also closes CR-01), or (b) keep the write but report it: emit the `set` confirmation, then the invalid-config block, and reword the catalog paragraph. Option (a) matches D-03's "we don't paper over corrupt data" and the plan truth.

### WR-02: No cucumber scenario fails without the MIG-01 step, or covers a set next to an invalid config

**File:** `features/plugin/autoapply.feature:449-472` ("Autoapply on keeps the plugins the config it writes declares")
**Issue:** The only set scenario with recorded plugins runs `install demo@fixtures --scope project` first. Install already writes `demo@fixtures` into the project base config, so the base config exists before the set. If `migrateFirstRunConfig` were deleted from `writeUnderLock`, every scenario would still pass. MIG-01 before a base write is user-visible: without it, the next load uninstalls the scope's plugins. AGENTS.md requires a behavioral scenario that fails without the change. Also, no scenario covers a set while a different config is invalid (WR-01) or a set into an absent base with an invalid local config (CR-01).
**Fix:** Add a scenario that records a plugin with no `claude-plugins.json` (for example, install, then delete the base config, or a state-only fixture step), runs `/claude:plugin autoapply on --scope project`, and asserts that the base config declares the recorded marketplace and plugin. Add one for the CR-01 or WR-01 contract once it is decided.

### WR-03: A set failure row names the config file even when state.json or the scope directory failed, and maps errno codes to source-vocabulary reasons

**File:** `extensions/pi-claude-marketplace/orchestrators/reconcile/autoapply-setting.ts:131-155`
**Issue:** `withLockedStateTransaction` runs `mkdir(extensionRoot)` and `loadState` before the body. Each failure becomes a row titled with the config file:
- A corrupt `state.json` gives `claude-plugins.json (failed) {unreadable}` with a cause about `state.json`. This also blocks `autoapply on --local`, which never needs state, because MIG-01 runs only for the base path.
- A scope root that cannot be created (ENOTDIR) gives `{source missing}`. The unit test `set whose scope root cannot be created` locks this in. `source missing` is the marketplace and plugin source vocabulary of `narrowProbeError`. Here no source is missing.

`read-pass.ts` solved the same attribution problem with `MigrateConfigSaveError` (S3 / PR #51), so the row names the file that failed.
**Fix:** Classify by phase. Wrap the lock and state load separately from the config write, and name the row after the file that failed (`state.json` vs the config file). Map the reason through a config-write classifier (`permission denied`, `unreadable`) rather than `narrowProbeError`, whose ENOENT/ENOTDIR to `source missing` mapping exists for sources.

## Info

### IN-01: Stale reference to the removed `loadAutoapply`

**File:** `extensions/pi-claude-marketplace/persistence/config-io.ts:65-66`
**Issue:** The CONFIG_SCHEMA comment still says "A load reads it through `config-merge.ts::loadAutoapply`". This diff renamed that function to `loadAutoapplyFiles` and `effectiveAutoapply`, and the comment now names a symbol that no longer exists.
**Fix:** Point it at `config-merge.ts::effectiveAutoapply`.

### IN-02: The step definition's comment describes a check it does not make

**File:** `features/step_definitions/plugin/autoapply.steps.ts:18-19`
**Issue:** "The whole file is compared apart from its `autoapply` member, so a write that dropped or changed another member fails here." The step compares the whole file, `autoapply` included, against exactly `{ schemaVersion: 1, autoapply }`. Every scenario that uses it starts from an absent file, so it cannot detect a dropped member. Members-kept is proved only by the "keeps the plugins" scenario.
**Fix:** Reword: "The file must hold exactly `schemaVersion` and the value written; nothing else may appear."

### IN-03: The JSON-docs drift test was not extended for the new outcome kind

**File:** `test/architecture/json-output-docs.test.ts:433-447`
**Issue:** `docs/json-output.md` adds `"autoapply-status"` to the outcome-kind list in both jq preparations (lines 38 and 85). The test that proves the preparation recognizes each outcome kind still iterates the old 13 kinds. Removing `autoapply-status` from the docs would go unnoticed.
**Fix:** Add `"autoapply-status"` to the loop's list.

### IN-04: `docs/json-output.md` inaccuracies

**File:** `docs/json-output.md:59` and the `autoapply-status` field table
**Issue:** (a) The `files` row says "Config files the scope and layer filter keeps". For the set form, `files` is only the written file. `autoapply on --scope project` lists one file, not the project scope's two. (b) The diff reformatted the extracted-rows example to `[{ "status": "installed", ... }]`. The command above it runs `jq -c`, which prints compact JSON with no spaces, so the example no longer shows the bytes jq prints. This change is unrelated to AAP-04 and was probably rewritten by the prettier hook.
**Fix:** Say "the config files the show filter keeps, or the one file a set wrote", and restore the compact example (protect it from the formatter if needed).

### IN-05: The file list is user-first, against the canonical project-first order

**File:** `extensions/pi-claude-marketplace/orchestrators/reconcile/autoapply-setting.ts:302-309`
**Issue:** `files` is reversed to user base, user local, project base, project local. Every other per-scope surface orders project before user (`compareByNameThenScope`, MSG-GR-3). D-14 does not set the order. Least-specific-first can be justified as reading in precedence order, but no comment or decision records that.
**Fix:** Either record the reason (precedence reading order) in the catalog and in a comment, or use the project-first order.

### IN-06: `writeUnderLock` return type is wider than it needs to be, and two places map a layer to its basename

**File:** `extensions/pi-claude-marketplace/orchestrators/reconcile/autoapply-setting.ts:166-209`
**Issue:** `writeUnderLock` returns `ConfigLoadResult | undefined` but only ever returns the `invalid` arm, so `refused?.status === "invalid"` re-checks a fact the type could carry. `setAutoapply` also rebuilds the file and layer to basename mapping (`target.file`, `filePath`) that `configFile()` and `loadAutoapplyFiles` already own, so the two could drift.
**Fix:** Return `{ filePath, error } | undefined`. Derive `target` with `configFile({ scope, layer })` from one `layer` value.

### IN-07: No scenario proves that a set never runs `apply`

**File:** `features/plugin/autoapply.feature` (set scenarios)
**Issue:** D-14 says "It never runs `apply`". Every set scenario has either nothing declared or everything already installed. A wrong implementation that applied after the write could still pass, depending on how the result step treats a second outcome.
**Fix:** Declare a not-installed plugin, run `autoapply on`, then assert that the installation record is unchanged and `pending` still lists the install.

### IN-08: The handler header promises "unknown flag" for every other flag

**File:** `extensions/pi-claude-marketplace/edge/handlers/plugin/autoapply.ts:10-12`
**Issue:** `extractLocalFlag` in array mode rejects only unknown long flags. A short option such as `-l` reaches `parsed.positional` and is reported as `Unknown argument "-l".`, not as an unknown flag.
**Fix:** Change the comment to "any other long flag", or use the consuming overload (`{ consumeLongFlags: [] }`) so short options are rejected as flags too.

---

_Reviewed: 2026-10-25_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
