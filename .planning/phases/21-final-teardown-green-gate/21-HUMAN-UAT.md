---
status: resolved
phase: 21-final-teardown-green-gate
source: [human-reported]
started: 2026-05-27T22:30:00Z
updated: 2026-05-28T02:50:00Z
---

## Current Test

[gap closed by Plan 21-04 -- commit 5a82471]

## Tests

### 1. `plugin list` must not append `/reload to pick up changes`

expected: A read-only `plugin list` invocation must NOT emit `/reload to pick up changes`. No state was changed; no reload is required. Per SNM-15 / D-16-12, the reload-hint trailer is reserved for state-changing notifications (install / update / reinstall / uninstall / marketplace add / remove / update / autoupdate flip).

result: PASS -- closed by Plan 21-04 (commit 5a82471). `installedRowMessage` now emits `status: "present"` (the new list-only inventory token); `shouldEmitReloadHint` body is unchanged and continues to fire only on the four state-change tokens. Renderer arm for `present` is byte-identical to `installed`, so existing list-row byte assertions still hold. Regression tests added in `tests/shared/notify-v2.test.ts` (inventory-vs-transition discriminator).

## Summary

total: 1
passed: 1
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

### G-21-01 -- Reload-hint misfires on `plugin list`

status: resolved
resolved_by: Plan 21-04 (commit 5a82471 -- `fix(21): close UAT G-21-01 reload-hint misfire on plugin list`)
severity: warning
surface: `orchestrators/plugin/list.ts` → `shared/notify.ts`
related_requirements: SNM-15 (reload-hint computed from message contents), SNM-12 (V2 notify entry point), SNM-03 (PluginNotificationMessage discriminated union)
discovered_via: human report during phase 21 execution (post-merge)

**Symptom:**

```
$ /claude:plugin list
...
● <plugin-a> v1.2.0
● <plugin-b> v0.3.1

/reload to pick up changes        ← incorrect; nothing changed
```

**Root cause:** Status-token semantic overload.

`PluginInstalledMessage` (`status: "installed"`) is emitted by two distinct callers with two distinct meanings:

1. **State transitions** -- `orchestrators/plugin/install.ts`, `orchestrators/plugin/update.ts`, cascade install rows. After a write completes. JSDoc at `shared/notify.ts:343` says "single-shot install or cascade install row" -- i.e. a transition row.
2. **Steady-state inventory** -- `orchestrators/plugin/list.ts:240` (`installedRowMessage`). Describes the current state of a plugin record on disk; no transition just happened.

`shouldEmitReloadHint` (`shared/notify.ts:1066-1075`) checks `p.status === "installed"` without distinguishing the two semantics, so every list result that has at least one installed plugin appends the hint.

This is pre-existing (both call sites blame to commits before Phase 21 -- `1f6e2727` for the trigger, `25239e20` / `751836d6` for the list emit). The Phase 21 consolidation of `shared/notify.ts` did not introduce the bug but also did not catch it during teardown.

**Affected behavior:**
- Every `/claude:plugin list` that has at least one installed plugin (the common case)
- Cascade-list rendering inside `install` / `update` summaries is correct -- the cascade rows ARE state transitions, so the same token's reload-hint is correct there

**Proposed fix (recommended Option 1 from diagnosis):**

Introduce a new list-only status token (e.g., `status: "present"`) for `installedRowMessage` in `list.ts`. Mirrors the existing list-only `PluginAvailableMessage` / `PluginUnavailableMessage` / `PluginUpgradableMessage` tokens whose JSDoc structurally constrains them to the list surface. The reload-hint trigger in `shouldEmitReloadHint` stays unchanged -- it correctly fires only on the four state-change tokens (`installed` / `updated` / `reinstalled` / `uninstalled`).

Touches:
- `extensions/pi-claude-marketplace/shared/notify.ts` -- add `PluginPresentMessage` interface; add `"present"` to `PluginStatus` union; add to `PluginNotificationMessage` union; renderer `switch (msg.status)` arm (likely renders identically to the `installed` arm); update JSDoc
- `extensions/pi-claude-marketplace/orchestrators/plugin/list.ts:240` -- change `status: "installed"` → `status: "present"` in `installedRowMessage`
- Catalog UAT -- regenerate the list-surface fixtures using `present` instead of `installed`; update `docs/output-catalog.md` v2.0 spec for the list family
- Tests -- add a notify-time unit test asserting `plugin list`-shaped messages do NOT emit the reload-hint trailer; existing list integration tests update to assert `(present)` byte form (if rendered text changes) or `(installed)` if the renderer arm is byte-equivalent

**Out of scope for this gap:**
- Renaming the four state-change tokens (they remain `installed` / `updated` / `reinstalled` / `uninstalled` -- the JSDoc already correctly describes them as transition rows)
- WR-02 / WR-03 from the phase 21 code review (already documented in 21-REVIEW-FIX.md as deferred to dedicated planning)

**Verification:**
- `npm run check` GREEN
- New unit test: a `notify()` invocation with `marketplaces[].plugins[]` containing only `status: "present"` rows returns body WITHOUT the `/reload to pick up changes` trailer
- New unit test: a `notify()` invocation with at least one `status: "installed"` (or other transition) row DOES emit the trailer
- Catalog UAT byte-equality re-passes
