---
status: resolved
trigger: "Removing the official Claude marketplace (installed with a previous version of the pi-claude-marketplace extension) fails during /reload reconcile with 'source mismatch' for both the marketplace and its installed plugin."
created: 2026-07-11T22:30:00Z
updated: 2026-07-12T12:39:24Z
---

## Current Focus
<!-- OVERWRITE on each update - reflects NOW -->

hypothesis: CONFIRMED — cross-config-layer removal gap. `marketplace remove` cascades the config deletion through exactly ONE physical file (base claude-plugins.json by default), leaving a same-marketplace plugin declaration in claude-plugins.local.json behind. The merged config then contains a plugin key whose marketplace is undeclared → planner emits a report-only `dangling-reference` PlannedSourceMismatch on every reload, rendered as `(failed) {source mismatch}` for both the marketplace row and the plugin child (2 failures).
test: Ran the dev planner (planReconcile + loadMergedScopeConfig + loadState) against the ACTUAL UAT sandbox files (PI_CODING_AGENT_DIR=/home/acolomba/pi-claude-marketplace/tmp/pi-uat/agent).
expecting: sourceMismatches contains exactly one dangling-reference entry (mp claude-plugins-official, plugin pr-review-toolkit) — REPRODUCED byte-for-byte against the UAT report.
next_action: none — root cause confirmed; diagnose-only mode, hand off to plan-phase --gaps.

reasoning_checkpoint:
  hypothesis: "marketplace remove's WB-01 config write-back targets a single physical file (remove.ts:651-652 picks base OR local via opts.local); a plugin declaration for the removed marketplace living in the OTHER layer survives, and the merged config's dangling plugin key makes planReconcile emit a report-only dangling-reference mismatch rendered {source mismatch} on every reload"
  confirming_evidence:
    - "tmp/pi-uat/agent/claude-plugins.json (base, rewritten tonight 22:08 by the remove) has empty marketplaces+plugins; claude-plugins.local.json (untouched since Jun 11) still declares pr-review-toolkit@claude-plugins-official"
    - "Running the dev planner against these exact files reproduces sourceMismatches = [{cause: dangling-reference, marketplace: claude-plugins-official, plugin: pr-review-toolkit}] — the only outcome shape that renders mp+child both {source mismatch} = 2 failures (notify.ts:590-604)"
    - "remove.ts loadConfig/deleteMarketplaceConfigEntryWithCascade operate only on targetConfigPath; no code path loads or checks the sibling config layer"
  falsification_test: "If deleting the pr-review-toolkit entry from claude-plugins.local.json makes the next /reload reconcile clean, the dangling local declaration is confirmed as the sole cause (planner already proves an empty sourceMismatches without it)"
  fix_rationale: "Cascade the marketplace-remove config deletion across BOTH layers (base + local are both in the NFR-10 sanctioned write set), or at minimum surface the leftover same-key declaration with an actionable message naming the file; separately, dangling-reference deserves its own reason token instead of reusing 'source mismatch'"
  blind_spots: "Did not run the full applyReconcile end-to-end (planner + renderer read verified separately); did not verify which exact command form the user typed (no session log persisted), but file mtimes + content make the remove-write unambiguous"

## Symptoms
<!-- Written during gathering, then IMMUTABLE -->

expected: Removing a marketplace (and its installed plugin) that was installed with a previous extension version reconciles cleanly on /reload — entries are removed with no failures.
actual: |
  On reload after attempting to remove, reconcile reports failures:
  Error: Some operations have failed.
  ⊘ claude-plugins-official [user] (failed) {source mismatch}
    ⊘ pr-review-toolkit (failed) {source mismatch}
  Reconcile: 2 failures
errors: "source mismatch" reason token on both the marketplace row (claude-plugins-official [user]) and the nested plugin row (pr-review-toolkit); summary "Reconcile: 2 failures".
reproduction: Test 1 in 78-UAT.md — claude-plugins-official + pr-review-toolkit installed by a PREVIOUS extension version (June 11 sandbox, plugin declared in claude-plugins.local.json); run `/claude:plugin marketplace remove claude-plugins-official`, then /reload.
started: Discovered during Phase 78 UAT (2026-07-11). Phase 78 introduced git-source plugin lifecycle; the failing entries predate it.

## Eliminated
<!-- APPEND only - prevents re-investigating -->

- hypothesis: samePlannedSource fails on legacy stored source shape (object {kind: github, raw, owner, repo} vs declared owner/repo string) after phase 76-78 parser changes
  evidence: Direct execution — samePlannedSource(storedObject, "anthropics/claude-plugins-official") returns "same"; planner against the real ~/.pi/agent files yields an EMPTY plan (zero mismatches).
  timestamp: 2026-07-11T23:05:00Z
- hypothesis: AgentsUnstageFailureError (foreign-content marker check) during the remove cascade narrows to "source mismatch"
  evidence: Staged agent files carry both the pi-claude-marketplace- basename prefix and the "generated by pi-claude-marketplace" body marker (frozen user contract, verified by reading ~/.pi/agent/agents/*.md); isOwnedAgentFile passes. Also state teardown in the UAT sandbox SUCCEEDED (state.marketplaces is empty), so the cascade never failed.
  timestamp: 2026-07-11T23:20:00Z
- hypothesis: Phase 78 version-gated backfill (lastReconciledExtensionVersion) skipping legacy migration causes the mismatch
  evidence: applyBackfillForScope only promotes force-installed (installable: false) plugins; unrelated to source comparison. Both records are installable: true.
  timestamp: 2026-07-11T23:15:00Z
- hypothesis: The failing reconcile came from the concurrently-loaded npm 0.5.0 extension
  evidence: Neither the "Reconcile" cascade label (reconcile.messaging.ts RECONCILE_APPLIED_CONTEXT) nor the "Some operations have failed." OUT-02 header exists in the installed 0.5.0 package — both are dev-build-only strings. Also the failing run used scripts/pi.sh --no-extensions, loading ONLY the dev extension + pi-mcp-adapter + pi-subagents.
  timestamp: 2026-07-11T23:30:00Z
- hypothesis: Phase 78 regression in the source-comparison/reconcile path
  evidence: The dangling-reference planner arm, the single-file WB-01 config write-back, and the "source mismatch" reason reuse all exist identically in npm 0.5.0 (pre-phase-76). This is a latent cross-layer gap surfaced by the UAT scenario, not a phase-78 regression.
  timestamp: 2026-07-11T23:45:00Z

## Evidence
<!-- APPEND only - facts discovered -->

- timestamp: 2026-07-11T22:30:00Z
  checked: .planning/debug/knowledge-base.md
  found: Single entry (test-suite-hang-phase79); no keyword overlap with "source mismatch" / reconcile.
  implication: No known-pattern candidate; fresh investigation.
- timestamp: 2026-07-11T22:45:00Z
  checked: grep "source mismatch" across extensions/pi-claude-marketplace
  found: Reason token produced by (a) planner PlannedSourceMismatch causes source-mismatch/unknown-stored/dangling-reference/malformed-plugin-key rendered via reconcile notify.ts, and (b) AgentsUnstageFailureError narrowing in remove.ts/uninstall.ts cascade-failure classifiers.
  implication: Two candidate producers to discriminate.
- timestamp: 2026-07-11T23:00:00Z
  checked: Real user-scope files ~/.pi/agent/claude-plugins.json (mtime Jun 14) + ~/.pi/agent/pi-claude-marketplace/state.json (mtime Jul 11 02:29)
  found: Config still declares both mp entries + both plugin keys; state still records everything; source stored as {kind: github, raw, owner, repo} object.
  implication: The default HOME environment was NOT modified by the failing remove.
- timestamp: 2026-07-11T23:05:00Z
  checked: Ran dev planner against real ~/.pi/agent files (sandbox copy, PI_CODING_AGENT_DIR override)
  found: samePlannedSource returns "same" for both marketplaces; planReconcile returns a completely empty plan.
  implication: The failure could not have come from these files — the failing run used a different scope root.
- timestamp: 2026-07-11T23:25:00Z
  checked: reconcile/notify.ts renderer (lines 590-604) + apply.ts foldRemoveOutcome
  found: cause "dangling-reference" is the ONLY outcome that renders an mp row {source mismatch} PLUS a plugin child {source mismatch} (= 2 counted failures). Planner-only mp mismatch renders 1 row; mp-remove-failed renders 1 row; partial renders a bare (failed) header without braces.
  implication: The pasted byte form uniquely identifies a single dangling-reference outcome.
- timestamp: 2026-07-11T23:35:00Z
  checked: fish history + scripts/pi.sh
  found: UAT runs use `scripts/pi.sh --home $(pwd)/tmp/pi-uat --cd $(pwd)/tmp/work`, which sets PI_CODING_AGENT_DIR=/home/acolomba/pi-claude-marketplace/tmp/pi-uat/agent and loads ONLY the dev extension (+pi-mcp-adapter, +pi-subagents) via --no-extensions.
  implication: The failing "user" scope is tmp/pi-uat/agent, not ~/.pi/agent.
- timestamp: 2026-07-11T23:40:00Z
  checked: tmp/pi-uat/agent contents
  found: claude-plugins.json (rewritten Jul 11 22:08) = {marketplaces: {}, plugins: {}}; claude-plugins.local.json (Jun 11 22:01, untouched) = {plugins: {"pr-review-toolkit@claude-plugins-official": {}}}; state.json = {schemaVersion: 2, lastReconciledExtensionVersion: "0.8.0", marketplaces: {}}.
  implication: The remove SUCCEEDED against state and the base config; only the local-layer plugin declaration survived.
- timestamp: 2026-07-11T23:45:00Z
  checked: Ran dev planner against the actual UAT sandbox files
  found: PLAN.sourceMismatches = [{scope: "user", cause: "dangling-reference", marketplace: "claude-plugins-official", plugin: "pr-review-toolkit"}] — exact reproduction of the reported output (2 failures).
  implication: Root cause confirmed by direct reproduction.
- timestamp: 2026-07-11T23:50:00Z
  checked: remove.ts targetConfigPath selection (lines 651-652) + commitFullRemove + persistence/config-write-back.ts deleteMarketplaceConfigEntryWithCascade
  found: targetConfigPath = opts.local ? configLocalJsonPath : configJsonPath; loadConfig and the WB-01 cascade delete operate on that single file only. commitFullRemove's own WR-09 comment acknowledges declarations "may live only in claude-plugins.local.json" — but only to SKIP write-back in orchestrated mode; the standalone path never inspects the sibling layer.
  implication: The gap is by-construction: cross-layer declarations are known to exist but the remove cleanup is single-layer.

## Resolution
<!-- OVERWRITE as understanding evolves -->

root_cause: |
  `marketplace remove` cleans the declarative config in exactly ONE physical layer. In
  orchestrators/marketplace/remove.ts the write-back target is chosen once
  (line 651-652: `opts.local === true ? locations.configLocalJsonPath : locations.configJsonPath`)
  and `deleteMarketplaceConfigEntryWithCascade` (persistence/config-write-back.ts:81) removes the
  marketplace entry and its `@<marketplace>` plugin keys from that file only. A plugin declaration
  for the same marketplace living in the OTHER layer (here: `pr-review-toolkit@claude-plugins-official`
  in claude-plugins.local.json, installed --local on Jun 11 by a previous extension version) survives
  the remove. The base+local merge (config-merge.ts, no tombstones — local can only add/override)
  then yields a plugin key whose marketplace is undeclared, which planReconcile classifies as a
  report-only `dangling-reference` PlannedSourceMismatch on EVERY subsequent reload. The reconcile
  renderer (reconcile/notify.ts:590-604) reuses the `"source mismatch"` reason token for
  dangling references and renders both an mp `(failed) {source mismatch}` row and a plugin child
  `(failed) {source mismatch}` row — the reported "Reconcile: 2 failures". The state teardown itself
  succeeded (state.json has no marketplaces); the persistent failure is purely the orphaned local
  declaration, which nothing self-heals and which the "source mismatch" wording misattributes to a
  source-comparison problem.
fix: ""
verification: ""
files_changed: []
