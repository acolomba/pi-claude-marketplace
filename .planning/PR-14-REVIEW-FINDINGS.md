# PR #14 Review Findings

Aggregated output of a five-agent PR Toolkit review run on 2026-05-16 against branch `features/phase-8-atomic-reinstall` at commit `26c2891` vs `origin/main` (`f1855ec`).

Agents: `code-reviewer`, `pr-test-analyzer`, `silent-failure-hunter`, `type-design-analyzer`, `comment-analyzer`.

Findings intentionally captured for a fresh context to address. Each finding has: severity, file:line, what + why, fix sketch, source agent.

---

## Critical (must fix before merge)

### CR-1. NFR-1 atomicity violation — `mcp.json` rollback writes non-atomically

- **File:** `extensions/pi-claude-marketplace/bridges/mcp/stage.ts:296-297`
- **Source:** code-reviewer
- **What:** `rollbackMcpReplacement` calls `writeFile(replacement.prepared.locations.mcpJsonPath, internals.oldText, "utf8")` directly. Forward path (`commitPreparedMcp`) uses `atomicWriteJson`.
- **Why critical:** CLAUDE.md NFR-1 mandates atomic disk mutations. A crash during rollback would corrupt `mcp.json` — exactly when the orchestrator is already trying to recover from a prior failure. The corrupted file would survive `/reload` (violates NFR-2/NFR-3).
- **Fix:** Replace raw `writeFile` with `atomicWriteJson` (parse `oldText` to JSON first) or use `write-file-atomic` directly on the raw bytes. The `rm(..., { force: true })` branch when `oldText === undefined` is fine (unlink is atomic).

### CR-2. NFR-1 atomicity violation — `agents-index.json` rollback writes non-atomically

- **File:** `extensions/pi-claude-marketplace/bridges/agents/stage.ts:548` (in `restoreAgentsIndex`)
- **Source:** code-reviewer
- **What:** `restoreAgentsIndex` writes `oldIndexText` with raw `writeFile`. Forward write (`saveAgentsIndex` → `persistence/agents-index-io.ts:164`) goes through `atomicWriteJson`. Pure asymmetry.
- **Why critical:** Same as CR-1. Index corruption during rollback breaks every subsequent operation that loads it.
- **Fix:** Use `atomicWriteJson` after parsing `oldIndexText`, or use `write-file-atomic` directly on the bytes.

### CR-3. `abortPrepared{Commands,Skills,Mcp}` silently discard cleanup-leak strings

- **Files:**
  - `extensions/pi-claude-marketplace/bridges/commands/stage.ts:229-235`
  - `extensions/pi-claude-marketplace/bridges/skills/stage.ts:240-246`
  - `extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts:677-696` (caller `abortPartialHandles`)
- **Source:** silent-failure-hunter
- **What:** Three bridge aborts have `Promise<void>` signatures that drop `cleanupStaging`'s `string | undefined` return value. `abortPreparedAgents` does it correctly (returns the leak; orchestrator pushes via `pushLeak`).
- **Why critical:** When `prepareStageAgents` or `prepareStageMcpServers` throws in `prepareAllHandles`, `abortPartialHandles` runs. If the OS later denies `rm` on the skills/commands staging dir (read-only mount, EACCES on a parent dir, stale handles), the user sees only the original prepare error and never finds out about the orphaned `<extensionRoot>/{skills,commands}-staging/<uuid>/` directory. NFR-2 (`/reload` sufficient) is violated.
- **Fix:** Widen `abortPreparedCommands` and `abortPreparedSkills` to `Promise<string | undefined>` returning `cleanupStaging`'s value. `abortPreparedMcp` can stay void (sync no-op, nothing to clean). In `abortPartialHandles`, push the returned leaks via `pushLeak` for skills and commands (mirroring the agents call site).

### CR-4. `replacePreparedAgents` leaks `backupRoot` dir when `readOptionalText` throws non-ENOENT

- **File:** `extensions/pi-claude-marketplace/bridges/agents/stage.ts:403-407`
- **Source:** silent-failure-hunter
- **What:** Order of operations is `mkdir(backupRoot)` → `assertPathInside(backupRoot)` → `readOptionalText(agentsIndexPath)` → enter try/catch at line 415. If `readOptionalText` throws (EACCES/EIO non-ENOENT propagates per line 565), the throw escapes before the try/catch is entered. `backupRoot` is leaked because the WeakMap entry was never written and the orchestrator's `abortPreparedAgents` only cleans `stagingDir`.
- **Why critical:** Orphan `<extensionRoot>/agents-staging/backup-<uuid>/` directory on every failed reinstall under this condition.
- **Fix:** Move `readOptionalText` to before `mkdir(backupRoot)` (it's read-only, no ordering dependency), OR wrap the prelude in a try/catch that calls `cleanupStaging(backupRoot, "agents replacement backup directory")` on throw and appends the leak via `appendLeakToError`.

### CR-5. `ReinstallPluginOutcome` structurally weak — `resourcesChanged?` only meaningful for `reinstalled`

- **File:** `extensions/pi-claude-marketplace/orchestrators/types.ts:14-24`
- **Source:** type-design-analyzer
- **What:** Flat record with `partition: "reinstalled" | "skipped" | "failed"` discriminator, but every payload field (`version`, `notes`, `stagedAgents`, `stagedMcpServers`, `resourcesChanged`) is `?` at the type level — the type does not encode that `reinstalled` requires `resourcesChanged: boolean` or that `failed` requires non-empty `notes`. Call sites today defend with `=== true` checks (`reinstall.ts:336`, `:644`, `:819`).
- **Why critical:** This is exactly the NFR-7 anti-pattern (the resolver `installable: true | false` discriminated union was added to prevent reading `pluginRoot` from a non-installable plugin). Bug class is mid-tier: a renderer that forgets the `=== true` check would happily render `undefined` instead of `false`.
- **Fix:** Refactor into per-partition discriminated union:
  ```ts
  export type ReinstallPluginOutcome =
    | { partition: "reinstalled"; name; marketplace; scope; version; resourcesChanged: boolean;
        stagedAgents?: ...; stagedMcpServers?: ...; notes?: readonly string[] }
    | { partition: "skipped"; name; marketplace; scope; notes: readonly string[] }
    | { partition: "failed"; name; marketplace; scope; notes: readonly string[] };
  ```
  And remove the `=== true` defensive checks at the call sites.

### CR-6. `LockedStateTransaction` has no compile-time defense against post-release / double-save / save-after-throw

- **File:** `extensions/pi-claude-marketplace/transaction/with-state-guard.ts:39-42, 112-158`
- **Source:** type-design-analyzer
- **What:** The closure receives `tx.state` (mutable in place) and `tx.save()` directly. Nothing prevents calling `save()` twice, after a throw, or holding the `state` reference past the run callback's lifetime.
- **Why critical:** Same NFR-7 design-quality bar as CR-5. Invariants are runtime, not type-level. The "manual save" shape is genuinely necessary for reinstall rollback semantics, but the discipline isn't enforced.
- **Fix options (ranked):**
  1. Minimal: after `run` returns, reassign `tx.save` to a function that throws `"save called outside transaction window"`. Cheap, runtime-only.
  2. Stronger: wrap `state` in a `Proxy` that throws on access after release.
  3. CPS: make `save` return a sentinel the caller must `return` from the closure, type-system-forcing save-before-release.

### CR-7. `reinstall.ts` file header advertises wrong scope

- **File:** `extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts:1-9`
- **Source:** comment-analyzer
- **What:** Header says `PRL-02/06/07/08/09/10/11/12 single-plugin reinstall core`. The file now also contains `reinstallPlugins` (bulk), `enumerateReinstallTargets`, partition rendering, soft-dep aggregation, reload-hint composition — i.e. PRL-03/04/05/13/14/15.
- **Why critical:** A reader who trusts the header will look elsewhere for `reinstallPlugins` and not find it. Misleads onboarding.
- **Fix:** Update to reflect both exports. Suggested text:
  ```
  // PRL-02..15 reinstall orchestrators (single-plugin + bulk).
  //
  // Exports:
  //   - reinstallPlugin   : single-target, holds the per-scope state lock
  //                         for the full prepare -> replace -> save cycle,
  //                         rolls physical resources back on save failure.
  //   - reinstallPlugins  : bulk dispatcher across {kind: all | marketplace
  //                         | plugin} targets, partitions outcomes and
  //                         emits one notifySuccess with reload hint.
  ```

### CR-8. README `--force` description misleads about "foreign" semantics

- **File:** `README.md:243` (and matching in `edge/completions/provider.ts:85`)
- **Source:** comment-analyzer
- **What:** README says `--force can overwrite that plugin's previous agent content, but it does not override other-plugin ownership conflicts, unsafe names, path-containment failures, or MCP server name collisions`. The list is accurate but the prior sentence ("Use `--force` only when reinstalling a plugin whose own previous agent files were manually edited or otherwise look foreign") doesn't surface that `--force` specifically only flips the AG-5 self-owned-foreign-content guard at `bridges/agents/stage.ts:395-401`. The word "foreign" usually implies "owned by someone else" in this codebase (`AgentOwnershipConflictError` vocabulary).
- **Why critical:** Users could misread "previous foreign agent content" as "another plugin's agents" and expect `--force` to override ownership conflicts. It doesn't.
- **Fix:**
  - README: "Use `--force` when this plugin's own previously installed agent files have been manually edited and no longer carry the `pi-claude-marketplace` marker (AG-5 self-owned foreign-content). `--force` does not override other-plugin ownership conflicts, unsafe names, path-containment failures, or MCP server name collisions."
  - Completion flag description: `"Overwrite this plugin's own previous agent files when they no longer carry the pi-claude-marketplace marker"` (or shorter).

### CR-9. `provider.ts` header references nonexistent V1 dispatcher and omits new top-level verbs

- **File:** `extensions/pi-claude-marketplace/edge/completions/provider.ts:3-6, 9-11`
- **Source:** comment-analyzer
- **What:** Header says `Five branches mirror the V1 dispatcher (PRD §6.7 TC-1..TC-6) with status-aware refinements`. V1 had no `reinstall`. The TC-1 keyword list also omits `bootstrap` and `import` even though `TOP_LEVEL_SUBCOMMANDS` in `router.ts:51` includes them and `topLevelCompletions` surfaces them.
- **Why critical:** Misleads any maintainer who reads "V1 dispatcher" and looks for canonical behavior in V1.
- **Fix:** Drop "mirror the V1 dispatcher" framing; reference PRD §6.7 directly. Update TC-1 list to `(bootstrap / install / uninstall / update / reinstall / list / ls / import / marketplace)`.

---

## Important (should fix)

### IM-1. Bulk `reinstall @nonexistent --scope user` silently returns "No plugins installed."

- **File:** `extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts:206-209` + `enumerateMarketplaceReinstallTargets:294-302`
- **Source:** code-reviewer I1 + silent-failure-hunter I2 (independently flagged — strong agreement)
- **What:** When `mp === undefined && explicitScope !== undefined && target.kind === "marketplace"`, the function returns `[]`. The bulk caller treats `[]` as "success, nothing to do." Compare with `update.ts:850-852` which throws `Marketplace "<x>" not found in <scope> scope.`
- **Test pinning current behavior:** `tests/orchestrators/plugin/reinstall.test.ts:798-833` ("PRL-04 marketplace reinstall with explicit scope where marketplace lives in another scope returns empty") — codifies the buggy behavior. Must be updated alongside the fix.
- **Fix:** Throw `MarketplaceNotFoundError(marketplace, [explicitScope])`. Replace the existing test with an assertion that the error surfaces via `notifyError` and the cause chain mentions the explicit scope.

### IM-2. Single-plugin reinstall picks wrong scope when plugin lives in `user` but marketplace exists in both

- **File:** `extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts:284-291`
- **Source:** code-reviewer I2
- **What:** Uses `resolveScopeFromState(marketplace, ...)` which resolves to whichever scope has the marketplace name — regardless of where the *plugin* is installed. `update.ts:830-847` does this correctly by trying `resolveInstalledPluginTarget` first (walks both scopes for the actual plugin) and only falls back to `resolveInstalledMarketplaceTarget` for the marketplace-only case.
- **Concrete regression:** `reinstall foo@mp` with `foo` only in user but `mp` in both scopes resolves to `project` → returns `skipped: not installed`. Should reinstall the user-scope install.
- **Fix:** For `target.kind === "plugin"`, call `resolveInstalledPluginTarget({ cwd, marketplace, plugin: target.plugin })` first. For `target.kind === "marketplace"`, keep marketplace-scope resolution but consider `resolveInstalledMarketplaceTarget` for the "empty project, populated user" case.

### IM-3. Completion `--force` regression when `--scope` typed before `reinstall`

- **File:** `extensions/pi-claude-marketplace/edge/completions/provider.ts:213-214`
- **Source:** code-reviewer I3
- **What:** `rawHead = tokens.find((token) => token !== "--scope") ?? ""` returns the *value* of `--scope` (e.g. `"user"`) instead of `"reinstall"` when tokens are `["--scope", "user", "reinstall"]`. `booleanFlags` then resolves to `[]`, `--force` is treated as positional, the plugin-ref branch fails `positionals.length === 1`, and completion silently returns `null`.
- **AP-4 contract:** `--scope` is documented as position-independent. The merge-time refactor diverged from this.
- **Reproducer:** `getArgumentCompletions("--scope user reinstall --force ", resolver)` returns `null` instead of the expected installed-plugin completions.
- **Fix:** Compute `rawHead = extractPositionals(tokens)[0] ?? ""` — skip `--scope` and its value. Add a test fixture for `--scope user reinstall --force ` ordering.

### IM-4. `withLockedStateTransaction` swallows lock-release errors when `run` already failed

- **File:** `extensions/pi-claude-marketplace/transaction/with-state-guard.ts:143-150` (also `withStateGuard` at 90-97)
- **Source:** silent-failure-hunter I1
- **What:** Finally block: `if (primaryError === undefined) { primaryError = releaseErr; }` — when both fail, the release error is dropped.
- **Why important:** The user sees the meaningful run-error (correct), but a persistent release failure (FS read-only, parent unlinked) is silently masked. The lock sentinel remains on disk; next operation pays a 10-second stale-wait via `acquireStateLock`'s `stale: 10_000`.
- **Fix:** Chain via `Error.cause`:
  ```ts
  } catch (releaseErr) {
    if (primaryError === undefined) {
      primaryError = releaseErr;
    } else {
      primaryError = new Error(
        `${errorMessage(primaryError)} (additionally: lock release failed: ${errorMessage(releaseErr)})`,
        { cause: primaryError },
      );
    }
  }
  ```
  Add a test for the both-fail branch.

### IM-5. Double `MANUAL_RECOVERY_REQUIRED` marker concatenation in chained errors

- **File:** `extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts:762-771` (`errorWithManualRecovery`)
- **Source:** silent-failure-hunter I3
- **What:** When a bridge throws with `MANUAL_RECOVERY_REQUIRED` already in `err.message` (e.g. agents rollback at `bridges/agents/stage.ts:452`), the orchestrator's catch then runs further rollbacks that may produce more leaks, and `errorWithManualRecovery` wraps the message again with another `MANUAL_RECOVERY_REQUIRED:` segment.
- **Why important:** ES-5 marker is user-contract. Two markers in one message degrade the user-facing presentation.
- **Fix:**
  ```ts
  function errorWithManualRecovery(err: unknown, leaks: readonly string[]): Error {
    const base = err instanceof Error ? err : new Error(errorMessage(err));
    if (leaks.length === 0) return base;
    const message = base.message.includes(MANUAL_RECOVERY_REQUIRED)
      ? `${base.message}; ${leaks.join("; ")}`
      : `${base.message} ${MANUAL_RECOVERY_REQUIRED}${leaks.join("; ")}`;
    return new Error(message, { cause: base });
  }
  ```

### IM-6. `renderReinstallPartitionAndNotify` is not exhaustive over `ReinstallPluginPartition`

- **File:** `extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts:323-340`
- **Source:** type-design-analyzer
- **What:** Three hard-coded positional calls to `renderReinstallPartition(..., "Reinstalled" | "Skipped" | "Failed", ...)`. The `partitionReinstallOutcomes` initializer at `:360-364` is also hand-coded. A new `ReinstallPluginPartition` variant would type-check the initializer (Record type forces the key) but the renderer's three hard-coded calls would silently miss the new partition.
- **Contrast:** The `switch (entry.phase)` blocks at `:719-730, :749-760` over `BridgePhase` are exhaustive (no default, all branches return). The renderer should mirror that discipline.
- **Fix:** Iterate via `for (const partition of ALL_PARTITIONS)` with a `switch` + `assertNever(partition)` so adding a fourth member fails to compile.

### IM-7. `*ReplacementNoop.prepared` typed as wider union (allows incoherent states)

- **Files:** `extensions/pi-claude-marketplace/bridges/{agents,skills,commands,mcp}/types.ts`
- **Source:** type-design-analyzer
- **What:** Each `*ReplacementNoop` carries `prepared: PreparedXStaging` (the full union), not the narrowed `*Noop` variant. A `noop` replacement could hold a `staged`-shape `prepared` object.
- **Fix:** Narrow each `*ReplacementNoop.prepared` to the matching `*Noop` type. E.g. `AgentsReplacementNoop.prepared: PreparedAgentsNoop`.

### IM-8. `discoverGeneratedNames.agentsSourceDir = ""` sentinel anti-pattern

- **File:** `extensions/pi-claude-marketplace/orchestrators/plugin/discover-names.ts:23-28`
- **Source:** type-design-analyzer
- **What:** `agentsSourceDir: string` carries the sentinel `""` meaning "no agents component" (see usage at `reinstall.ts:457, :539-547` and dispatch at `discover-names.ts:41`). This is the same anti-pattern NFR-7 banned in the resolver.
- **Fix:** Replace with `agentsSourceDir: string | null`, or tag the field as `{ kind: "absent" } | { kind: "present"; dir: string }`. Update call sites to branch on the discriminator instead of comparing against `""`.

### IM-9. `--force` negative tests missing

- **Source:** pr-test-analyzer
- **What:** The `--force` contract claim ("does not override other-plugin ownership conflicts, unsafe names, path-containment failures, or MCP collisions") has no failing-test pin. Today's tests cover the positive AG-5 overwrite path only.
- **Why important:** Future regression risk — someone widening `force` to override more guards would not break a test.
- **Tests to add:**
  - `--force` + cross-plugin `(mp2, rival)` agent ownership conflict → outcome `failed` with `AgentOwnershipConflictError`.
  - `--force` + foreign MCP slot collision → outcome `failed` with `McpServerCollisionError`.
  - `--force` + unsafe `generatedName` in seeded `agents-index.json` → outcome `failed` with `assertSafeName` throw.
  - `--force` + path-traversal `targetPath` in seeded index → outcome `failed` with `PathContainmentError`.

### IM-10. PRL-13 determinism asserted only via rendered regex

- **File:** `tests/orchestrators/plugin/reinstall.test.ts:887-941`
- **Source:** pr-test-analyzer
- **What:** Test uses `assert.match(body, /Reinstalled:\n.*\[user\] z@u\n.../)` to prove sort ordering. Couples to render-text format. The orchestrator return value at line 930 is discarded.
- **Fix:** Capture the returned `outcomes` array and add `assert.deepEqual(outcomes.map(o => [o.scope, o.marketplace, o.name]), [...sorted reference array...])`. Keeps the render assertion for the user-facing format but adds a refactor-resilient API-contract assertion.

### IM-11. Concurrent reinstall through orchestrator render layer not tested

- **Source:** pr-test-analyzer
- **What:** `withLockedStateTransaction` primitive is tested in isolation at `tests/transaction/with-state-guard.test.ts:473-497`. The reinstall orchestrator wraps it but no test exercises the end-to-end concurrent path.
- **Fix:** Add a test that pre-acquires the scope lock, runs `reinstallPlugin` against an installed plugin, asserts outcome is `failed`, notes contain the canonical "Another pi-claude-marketplace operation is in progress" prefix, and confirms no staged resources or state changed.

### IM-12. Stale file headers in bridges and transaction module

- **Files:**
  - `extensions/pi-claude-marketplace/transaction/with-state-guard.ts:14-21` — mentions only `withStateGuard` example, not `withLockedStateTransaction`
  - `extensions/pi-claude-marketplace/bridges/skills/stage.ts:1-19` — no mention of Phase 8 replace/rollback/finalize triplet
  - `extensions/pi-claude-marketplace/bridges/commands/stage.ts:1-23` — same
  - `extensions/pi-claude-marketplace/bridges/agents/stage.ts:1-23` — same; doesn't mention `ReplacePreparedAgentsOptions` either
  - `extensions/pi-claude-marketplace/bridges/mcp/stage.ts:11-21` — same
  - `extensions/pi-claude-marketplace/bridges/skills/stage.ts:237-239` — abort doc says "Phase 5 transaction"; now also called from Phase 8 reinstall
- **Source:** comment-analyzer
- **Fix:** Add 2-3 line paragraphs to each bridge header noting the Phase 8 `replace/rollback/finalize` triplet. Update `with-state-guard.ts` header to gesture at when to use `withLockedStateTransaction` vs `withStateGuard`. Drop "Phase 5" qualifier where Phase 8 also calls in.

### IM-13. `provider.ts:241-243` comment misstates scope resolution

- **File:** `extensions/pi-claude-marketplace/edge/completions/provider.ts:241-243`
- **Source:** comment-analyzer
- **What:** Comment says `Uninstall/update/reinstall consume installed plugins, with project precedence when --scope is omitted.` Actually `pluginRefBranchConfig` (lines 178-194) passes `undefined` to `getPluginRefCompletions` for those modes when no explicit scope — precedence is enforced downstream, not here.
- **Fix:** Replace with `Uninstall/update/reinstall delegate scope resolution to getPluginRefCompletions when --scope is omitted.`

### IM-14. `LocationsResolver.marketplaceNamesCachePath` dead in edge layer

- **Files:** `extensions/pi-claude-marketplace/edge/completions/data.ts:56`, `extensions/pi-claude-marketplace/orchestrators/edge-deps.ts:58,77-79`
- **Source:** code-reviewer S1
- **What:** Merge-time refactor inlined `marketplaceNamesForScope` to bypass the cache. `marketplaceNamesCachePath` is no longer read from edge but still declared in `LocationsResolver` and implemented by `makeLocationsResolver`. Orchestrators still write/invalidate the file.
- **Decision needed:** keep the method as a non-edge concern, drop it from `LocationsResolver` and have orchestrators reach into `locationsFor(scope, cwd).marketplaceNamesCacheFile` directly, or delete the cache file write paths entirely. The per-keystroke `loadState` cost was explicitly accepted (doc comment at `data.ts:226-231`).

---

## Suggested (nice to have)

### SG-1. Brand the bridge replacement handles

- **Files:** `bridges/{agents,skills,commands,mcp}/stage.ts` — `*ReplacementReplaced` types
- **Source:** type-design-analyzer
- **What:** WeakMap is keyed by structural shape. A caller could fabricate `{ kind: "replaced", prepared }` and get a runtime "Unknown handle" throw. Brand the handle type with `& { readonly __brand: unique symbol }` to make counterfeiting a compile-time error.

### SG-2. Narrow `LockedSuccess.outcome` to exclude `failed`

- **File:** `extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts:133-136`
- **Source:** type-design-analyzer
- **What:** Producer (`runLockedReinstall:423-476`) never returns failed (failures throw). Type should encode this: `outcome: Exclude<ReinstallPluginOutcome, { partition: "failed" }>`.

### SG-3. `PluginRefBranchConfig` as discriminated union over `mode`

- **File:** `extensions/pi-claude-marketplace/edge/completions/provider.ts:164-168`
- **Source:** type-design-analyzer
- **What:** `targetScope?: Scope` is required for `install` (defaulted to `"user"`), optional for the rest. Encode as `{ mode: "install"; targetScope: Scope } | { mode: "uninstall" | "update" | "reinstall"; targetScope?: Scope }`.

### SG-4. `rollbackReplacementCommon` defensive path containment

- **File:** `extensions/pi-claude-marketplace/shared/fs-utils.ts:135-177`
- **Source:** code-reviewer S2
- **What:** No per-pair `assertPathInside` in the helper itself. All current callers validate upstream. Add per-pair assertion as forward-defense against future callers.

### SG-5. Document post-success maintenance runs outside the lock

- **File:** `extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts:175-187, 779-805`
- **Source:** code-reviewer S3
- **What:** `runPostSuccessMaintenance` runs after `withLockedStateTransaction` releases. Behavior is benign and intentional (data dir is owned, cache rebuild is idempotent), but undocumented.

### SG-6. Post-success cleanup warnings could carry `MANUAL_RECOVERY_REQUIRED`

- **File:** `extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts:732-747`
- **Source:** silent-failure-hunter M1
- **What:** Post-success `finalizeReplacements` leaks describe leftover backup dirs on disk. The leak text reads as FYI; could escalate via the ES-5 marker. Decision: keep as warning or escalate to manual-recovery.

### SG-7. `bridges/mcp/stage.ts` abort-noop comment

- **File:** `extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts:519-562`
- **Source:** silent-failure-hunter M2
- **What:** `abortPreparedMcp` is intentionally void no-op (MC-6). The orchestrator's correctness depends on the assignment ordering of `handles.mcp`. Add a one-line comment noting this.

### SG-8. Minor comment cleanups

- **Source:** comment-analyzer
- Various places: `pushLeak` justification, `abortHandles` forwarder rationale, `defaultRemoveDataDir` test-seam comment, `eslint-disable` justifications, etc. (See comment-analyzer report sections 16-20 for details.)

### SG-9. Per-bridge stage.ts: replace/rollback/finalize jsdoc additions

- **Source:** comment-analyzer #8-#11
- Each of the four bridges should add header text describing the Phase 8 lifecycle. See specific suggestions inline.

### SG-10. Drop "(Sonar new-code duplication)" parenthetical in `discover-names.ts`

- **File:** `extensions/pi-claude-marketplace/orchestrators/plugin/discover-names.ts:6-8`
- **Source:** comment-analyzer #12
- **What:** Transient justification. Either drop or pin to a specific Sonar rule code.

---

## What's solid (verified clean by the agents)

- NFR-5 (no network in reinstall) — architecture guard at `tests/architecture/no-orchestrator-network.test.ts:43-93` covers `reinstall.ts` with all four forbidden patterns asserted.
- IL-2 (output channel discipline) — every user-visible string goes through `shared/notify.ts`.
- NFR-7 narrowing — `runLockedReinstall:440` calls `requireInstallable(resolved, "install")` before reading `pluginRoot`.
- NFR-10 containment — `assertPathInside` and `assertSafeName` enforced on every name-derived path in the new bridge replacement helpers.
- `discoverGeneratedNames` and `rollbackReplacementCommon` extractions are clean refactors with no behavior change.
- `pluginRefBranchConfig` collapse correctly preserves the four-mode dispatch semantics.
- Soft-dep surfacing (`pi-subagents` / `pi-mcp-adapter` warnings) works end-to-end for both single-plugin and bulk paths.
- Retry safety: re-running reinstall against partially-rolled-back state self-heals via ENOENT tolerance and `pathExists` guards.
- `formatErrorWithCauses` correctly preserves the cause chain (depth-5 walk).
- `readOptionalText` non-ENOENT correctly propagates (orphan-dir issue is separate — CR-4).
- MCP rollback `writeFile` failure is correctly escalated through the orchestrator's `errorWithManualRecovery` chain.
- `runPostSuccessMaintenance` warnings correctly surface on both single-plugin and bulk render paths.
- Bulk-loop outer catch around `reinstallPlugin` is structurally dead today (inner always returns failed outcome). Defensive belt is acceptable.

---

## Recommended triage

- **This PR (CR-1..9, IM-1..3):** the NFR-1 atomicity violations, the silent-failure leaks, the file header lies, the README/completion `--force` description, and the three concrete regressions (silent typo'd marketplace, scope precedence, completion ordering). These are all small, well-scoped, with clear fix sketches.
- **Stretch (IM-4..14):** type system tightening, exhaustiveness, lock-release error chaining, double-marker dedup, test gaps. About a half-day of work together.
- **Defer to v1.2 polish (SG-1..10):** brand types, narrowing, comment cleanups.

---

## Source agents and full transcripts

- code-reviewer: 5 critical, 3 important, 3 suggested.
- pr-test-analyzer: 0 critical, 5 important (test gaps), confirms ~38 uncovered lines are acceptably defensive.
- silent-failure-hunter: 2 critical, 3 important, 2 minor.
- type-design-analyzer: 2 critical, 4 important, 4 suggested.
- comment-analyzer: 4 critical, 11 important, 5 suggested.

Total deduplicated count: 9 critical, 14 important, 10 suggested.
