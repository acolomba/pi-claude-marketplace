---
status: resolved
phase: 78-plugin-git-source-lifecycle
source: [78-VERIFICATION.md]
started: 2026-07-12T12:39:24Z
updated: 2026-07-13T04:35:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Cross-layer removal reconciles cleanly on a real /reload
expected: Remove a marketplace/plugin installed by a prior extension version with a local-only config declaration (the exact round-1 reproduction); the next /reload reconciles cleanly with zero failures, and neither physical config file still declares the removed marketplace or plugin. If an orphaned declaration is deliberately left in place instead, the diagnostic now reads {dangling reference}, not {source mismatch}.
result: pass
notes: Both halves verified live. (a) Round-1 residue (local-only superpowers declaration, empty state) rendered {dangling reference} on startup — the truthful new token. (b) After cleanup, a disable --local wrote the local-layer entry, marketplace remove swept BOTH claude-plugins.json and claude-plugins.local.json plus state and the marketplace source clone, and the next /reload printed nothing.

### 2. Live update of a git-source plugin after a real upstream sha bump
expected: update detects the sha change against the real remote (a genuine repo, not a mocked GitOps stub), materializes the new clone, swaps the plugin atomically, records the new resolvedSha, and garbage-collects the old clone once unreferenced. (Carried forward from round 1, which stopped at the removal blocker before reaching this test.)
result: pass
notes: Path-source marketplace pinning https://github.com/obra/superpowers.git; partial install at real sha 7d8d3d4b (v6.1.0, 14 skills, hooks unsupported per D-58-06 matcher rule), manifest pin bumped to real upstream HEAD d884ae04 (v6.1.1). Strict update refused with --partial guidance (correct FSTAT arm); update --partial fetched the new sha cold from the remote, swapped atomically, recorded resolvedSha d884ae04..., re-staged all 14 skills, and GC'd the old 7d8d3d4b clone. Clone content verified as v6.1.1 on disk.

### 3. Install completion offers git-source plugins
expected: after adding a marketplace whose manifest carries git-source plugins (url / git-subdir / github), install completion offers them the same way list classifies them (available).
result: issue
reported: "when i go to install one of the newly available plugins, superpowers, i dont' get completion"
severity: major

### 4. Marketplace remove garbage-collects git-source plugin clones
expected: removing a marketplace whose cascade uninstalls git-source plugins drops their now-unreferenced plugin-clones/ directories (PURL-06 last-ref GC), same as a standalone plugin uninstall does.
result: issue
reported: "plugin-clones/8c6014a36ca9-d884ae04edeb (superpowers@claude-plugins-official, created 14:32 local) survived the test-1 marketplace remove and was still on disk two hours later"
severity: minor

## Summary

total: 4
passed: 2
issues: 2
pending: 0
skipped: 0
blocked: 0

## Gaps

- truth: "Install completion offers the same available plugins that list reports — one classification for list, completion, install, and update surfaces"
  status: resolved
  reason: "User reported: when i go to install one of the newly available plugins, superpowers, i dont' get completion. Sandbox completion cache classifies superpowers (and every git-source entry — 204 of 255 in claude-plugins-official) as unavailable while list renders them (available)."
  severity: major
  test: 3
  root_cause: "D-67-02 unified the classifier but left the resolve policy per call site. The D-78-03 git-source short-circuit (not-installed url/git-subdir/github entries are installable-from-manifest) and the D-78-04 warm-cache presence probe were added only to list.ts (availableRowMessage 586-604; candidate probe 444-453). The completion bucketizer in orchestrators/edge-deps.ts never got either: classifyNotInstalledPluginRow (117-133) calls resolveStrict with only marketplaceRoot, the resolver's git arm requires a clone-cache resolver, the catch folds to unavailable, and install completion filters unavailable out (FORCE-05, --partial included). Cached rows persist under plugin-index schemaVersion 4 with no TTL, so the wrong statuses outlive the fix unless the schema version is bumped."
  artifacts:
    - path: "extensions/pi-claude-marketplace/orchestrators/edge-deps.ts"
      issue: "classifyNotInstalledPluginRow (117-133) lacks the D-78-03 git-source short-circuit; classifyInstalledPluginRow (81-107) candidate probe lacks the D-78-04 presence probe (upgradable vs partially-upgradable split degrades for git plugins)"
    - path: "extensions/pi-claude-marketplace/orchestrators/plugin/list.ts"
      issue: "git-source resolve policy (586-604, 444-453) lives inline instead of in a shared probe next to the shared classifier"
    - path: "extensions/pi-claude-marketplace/shared/completion-cache.ts"
      issue: "plugin-index caches written at schemaVersion 4 carry the wrong unavailable rows; D-03 drop+rebuild only triggers on a schema version mismatch"
    - path: "tests/orchestrators/edge-deps.test.ts"
      issue: "parity drift-guard locks classifier identity only; both surfaces can feed the shared classifier divergent resolve inputs and stay green"
  missing:
    - "Shared probe helpers colocated with the shared classifier (probeManifestEntry owning the D-78-03 short-circuit + catch-to-unavailable fold; probeUpgradeCandidate owning the D-78-04 presence probe + CR-01 degrade), consumed by both list.ts and edge-deps.ts"
    - "Plugin-index cache schemaVersion bump 4 -> 5 so stale caches drop+rebuild on next read"
    - "Output-parity drift-guard: same fixture manifest (url / git-subdir / github / path entries) through list's row builder and edge-deps' bucketizer must produce identical status buckets"
    - "Architecture lock: no direct resolveStrict call sites outside the probe module and the install/update/reinstall orchestrators"

- truth: "Marketplace remove garbage-collects the plugin clones its cascade unreferences (PURL-06 last-ref GC applies to every uninstall path)"
  status: resolved
  reason: "Live sandbox: plugin-clones/8c6014a36ca9-d884ae04edeb (from the earlier superpowers@claude-plugins-official partial install) survived the marketplace remove of claude-plugins-official; it was still on disk when the next install created a sibling clone two hours later."
  severity: minor
  test: 4
  root_cause: "garbageCollectPluginClones (orchestrators/plugin/clone-gc.ts, D-78-01 derive-not-persist global sweep) is invoked only by plugin/uninstall.ts and plugin/update.ts. orchestrators/marketplace/remove.ts tears plugins down whole-cloth (bridge unstage + state delete + config cascade) without importing clone-gc or routing through the plugin uninstall orchestrator, so the cascade never sweeps plugin-clones/. The orphan self-heals only if a LATER plugin uninstall/update runs in the same scope; removing the only marketplace leaves the clones leaked indefinitely (NFR-3's next idempotent pass is never scheduled on this path)."
  artifacts:
    - path: "extensions/pi-claude-marketplace/orchestrators/marketplace/remove.ts"
      issue: "cascade teardown cleans marketplace data dir + sources clone (MR-7) but never calls garbageCollectPluginClones for the uninstalled plugins' clone-cache dirs"
    - path: "extensions/pi-claude-marketplace/orchestrators/plugin/clone-gc.ts"
      issue: "the sweep itself is correct and idempotent; it is just not wired into the marketplace-remove cascade"
  missing:
    - "marketplace remove calls garbageCollectPluginClones after its state mutation commits (same post-commit placement as uninstall/update), when the cascade uninstalled at least one git-source plugin"
    - "test covering: remove a marketplace with an installed git-source plugin, assert its plugin-clones/<key>/ dir is gone"
