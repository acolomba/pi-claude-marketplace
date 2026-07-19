---
status: resolved
phase: 81-fetch-verb-info-fetch
source: [81-VERIFICATION.md]
started: 2026-07-14T05:30:00Z
updated: 2026-07-15T10:42:31Z
---

## Current Test

[testing complete]

## Tests

### 1. Live fetch against a real remote (FTCH-04/06)
expected: Cold fetch → network + derived status row; pinned-warm re-fetch → (skipped) {up-to-date} with no network; unpinned re-fetch → in-place mirror refresh; auth at most once per host; subsequent install offline from warm cache.
result: pass

### 2. Warm git-subdir plugin resolves components in info (RSTA-04/05 follow-up)
expected: `info` on a fetched (warm-clone) git-subdir plugin anchors resolution at `<clone>/<source.path>` and lists its components fs-only (canva: 6 skills + mcp server), with an honest three-way verdict.
result: issue
reported: "if i do an info on the canva plugin, after fetching it, i see [marketplace header + '○ canva (available)' + description, nothing else] — shouldn't i see its components?"
severity: major

## Summary

total: 2
passed: 1
issues: 1
pending: 0
skipped: 0
blocked: 0

## Gaps

- truth: "info on a warm git-subdir plugin lists its components resolved fs-only from <clone>/<source.path>, and the three-way verdict is computed against that subdir root"
  status: resolved
  reason: "User reported: info on canva after fetching it shows only the (available) row + description — no components, no 'components: not resolved' marker"
  severity: major
  test: 2
  root_cause: "makePresenceProbe (orchestrators/plugin/git-source-probe.ts:132 mirror arm, :138 pinned arm) returns the bare clone/mirror dir as pluginRoot and never appends source.path for git-subdir sources. The resolver delegates subdir anchoring + containment to the injected callback (D-77-03), so warm git-subdir plugins resolve at the monorepo root: plugin.json absence is tolerated (resolver PR-2 case 4), no conventional component dirs or .mcp.json exist at the root, so the verdict is installable with an EMPTY components map — and componentsResolved: true with empty components renders neither per-kind lines nor the 'components: not resolved' marker. The install path is unaffected: clone-cache.ts resolveSubdirRoot does path.resolve(cloneRoot, subPath) with escapes/missing-subdir containment. Impact is the whole shared fs-only classification seam (info, info --fetch via makeFetchProbe, list, completion bucketizer, fetch post-fetch status row): for git-subdir sources the three-way verdict runs against the wrong root and can over-claim (available) for a plugin whose real subdir has unsupported components — RSTA-04/05 honesty gap. git-subdir is the dominant source kind in claude-plugins-official; whole-repo url/github and path sources are unaffected."
  artifacts:
    - path: "extensions/pi-claude-marketplace/orchestrators/plugin/git-source-probe.ts"
      issue: "makePresenceProbe materialized arms omit the git-subdir source.path join + containment (escapes/missing-subdir) before returning pluginRoot"
    - path: "extensions/pi-claude-marketplace/orchestrators/plugin/info.ts"
      issue: "makeFetchProbe's warm/post-fetch path inherits the same rootless pluginRoot for git-subdir sources"
  missing:
    - "Presence/fetch probe materialized arms anchor pluginRoot at <cloneDir>/<source.path> for git-subdir sources — fs-only join + containment at parity with clone-cache.ts resolveSubdirRoot, with escapes/missing-subdir folded into the probe's existing result vocabulary (never a leaked out-of-tree root)"
    - "Regression coverage: warm git-subdir fixture resolves components (skills + mcp) and an honest three-way verdict across info, info --fetch, list, and completion classification; monorepo-root-without-plugin.json no longer classifies (available) with silently-empty components"
  debug_session: ""
