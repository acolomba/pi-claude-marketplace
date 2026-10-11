---
phase: 02-adapter-file-delivery
reviewed: 2026-10-04T10:11:32Z
depth: deep
scope: gap-closure (3ca08c36^..HEAD, plans 02-09..02-12, D-02-21); last pass narrow re-review of 4a206e4a (WR-01 fix, D-02-22)
files_reviewed: 30
files_reviewed_list:
  - docs/output-catalog.md
  - docs/prd/pi-claude-marketplace-prd.md
  - extensions/pi-claude-marketplace/bridges/mcp/adapter-doc.ts
  - extensions/pi-claude-marketplace/bridges/mcp/adapter-entry.ts
  - extensions/pi-claude-marketplace/bridges/mcp/marker.ts
  - extensions/pi-claude-marketplace/bridges/mcp/stage.ts
  - extensions/pi-claude-marketplace/bridges/mcp/types.ts
  - extensions/pi-claude-marketplace/bridges/mcp/unstage.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/prune-rollback.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/prune.ts
  - extensions/pi-claude-marketplace/shared/atomic-json.ts
  - extensions/pi-claude-marketplace/shared/errors-bridges.ts
  - extensions/pi-claude-marketplace/shared/notification-dispatch.ts
  - scripts/check-unused-type-members.contracts.json
  - tests/architecture/mcp-config-notices.test.ts
  - tests/bridges/mcp/adapter-doc.test.ts
  - tests/bridges/mcp/adapter-entry.test.ts
  - tests/bridges/mcp/marker.test.ts
  - tests/bridges/mcp/stage.test.ts
  - tests/bridges/mcp/unstage.test.ts
  - tests/integration/mcp-override-lifecycle.test.ts
  - tests/orchestrators/marketplace/shared.test.ts
  - tests/orchestrators/plugin/enable-disable.test.ts
  - tests/orchestrators/plugin/install-flow.test.ts
  - tests/orchestrators/plugin/prune-rollback.test.ts
  - tests/orchestrators/plugin/prune.test.ts
  - tests/orchestrators/plugin/uninstall.test.ts
  - tests/shared/atomic-json.test.ts
  - tests/shared/notification-dispatch.test.ts
findings:
  critical: 0
  warning: 0
  info: 6
  total: 6
status: clean
---

# Phase 2: Code Review Report (gap closure)

**Reviewed:** 2026-10-04T10:11:32Z (gap-closure review first run 2026-10-04T05:34:46Z)
**Depth:** deep for the last pass, limited to the write-back seam
**Files Reviewed:** 30 (gap scope; the last pass re-read 6 of them)
**Status:** clean (no Critical or Warning; 6 Info)

## Summary

This review covers the gap-closure diff `3ca08c36^..HEAD`: plans 02-09 to 02-12 and decisions D-02-21 and D-02-22. The previous full-phase review (commit 5bfa6baf) and its open Info items in `02-REVIEW-DISPOSITION.md` are not repeated here.

**This last pass was narrow.** It re-reviewed only commit 4a206e4a, the fix for WR-01, and only the write-back seam: `adapter-entry.ts`, `adapter-doc.ts`, and the four test files the commit changed. The rest of the 30-file scope was not re-read. Its findings stand as recorded on the first run (05:34:46Z).

The first run's verdicts still hold for this seam:

- **Credentials.** `carriedFields` reads only the nine `CARRIED_FIELDS`. `restoredOverride` (adapter-entry.ts:124-139) takes nothing else from the live entry. Each non-carried field comes from the kept override through `safeSet`. A probe with a live entry that holds `env`, `headers` and `command` wrote back none of them.
- **Write-back exactly once.** `restoredOverrideNames` and `survivingEntry` still use the same `restorableOverride` test. A restaged name still returns `undefined` before the overlay runs (adapter-doc.ts:313-316).
- **NFR-3 prune rollback.** The prune records the bytes the unstage actually wrote (prune-rollback.ts:242-263, 397). The overlay only changes those bytes, so the byte compare is not affected.

The targeted suites pass at HEAD: `node --test` over adapter-doc, adapter-entry, unstage and the integration lifecycle file ran 115 tests, all passing.

## Resolved

### WR-01 (resolved by 4a206e4a, D-02-22): a kept override no longer replaces the user's later carried choice

`survivingEntry` now returns `restoredOverride(kept, entry)`. Each kept field outside the carried set comes back as kept, in kept key order. Each carried field takes the live entry's value. Both reproductions now show the user's choice. `tmp/review-gap/repro1.ts` writes back `{"disabled": false, "env": {...}}` after uninstall. `tmp/review-gap/repro2.ts` prints `active disabled after plugin disable+enable: false`.

Checks made on this pass:

- **The "absent field is left out" choice is right.** pi-mcp-adapter 5.0.0's `writeProjectServerDisabledOverride(..., false)` (`/tmp/pmaverify/package/dist/config.js:1555-1576`) removes `disabled` from the entry. It writes `disabled: false` only when a lower source disables the server. A literal `{ ...kept, ...liveCarried }` would bring back `disabled: true` after the usual enable, so WR-01 would stay open. The stage path also copies only carried fields that the replaced entry holds (`carriedFields`, adapter-entry.ts:87-100). After an absorb, the live entry holds every carried field that the override kept. So a missing field always means that something removed it later. D-02-22 says the carried fields "overlay" the kept override. The code replaces the kept carried subset. That matches the decision's purpose ("a choice the user made ... wins"). Change the wording in 02-CONTEXT.md to "replace", so the text matches the code.
- **AFILE-05 still holds.** No carried field is a transport (`command`, `url`, `socket`). So the result is never a full definition, and `restorableOverride` rejects a kept full definition before the overlay runs.
- **Key order.** Kept carried fields keep their kept position. Carried fields that only the live entry holds are added at the end, in `CARRIED_FIELDS` order. An own `__proto__` field in the kept override stays an own key, and the prototype is not changed (probe C in `tmp/review-wr01/probe.ts`).
- **The five changed fixtures are legitimate.** Three are in adapter-doc.test.ts (`kept`, `gone`/`moved`, `__proto__`) and two are in unstage.test.ts. Before the change, each fixture's live entry was missing a carried field that its `keptOverride` held. A real absorb cannot produce that state, because `stampServers` makes every kept carried field active. The expected outputs did not change, and these cases test position, notices and the `__proto__` key, not the overlay. The overlay itself, including the case with the field missing, is tested by the new cases.
- **The new tests fail without the fix.** In a `git archive HEAD` copy, `survivingEntry` was changed back to return the kept override as it is. The new adapter-doc `withPluginServers` case and the new integration case failed (2 fail / 113 pass). The four `restoredOverride` unit cases test the new export directly.

## Info

### IN-01: The fold's "a later keep replaces the earlier one, in first-set position" rule has no test that fails without it

**File:** `extensions/pi-claude-marketplace/shared/notification-dispatch.ts:286-298`; `tests/shared/notification-dispatch.test.ts:5962`

**Issue:** The only same-key keep-then-keep case ("a repeated override-kept notice renders once") uses two identical notices. That case passes even if `standing.set` is changed to keep the first notice (`if (!standing.has(key))`), because the `Set` in `notifyMcpConfigNotices` removes the identical line anyway. The documented replace semantics and the first-set ordering across servers are not pinned.

**Fix:** Add a case with two `override-kept` notices for the same (scope, file, server) and different `fields` or `plugin`, between notices for another server. Assert that the later line renders in the first notice's position.

### IN-02: Stage write-backs emit no `override-restored` fact, so the fact model is asymmetric

**File:** `extensions/pi-claude-marketplace/bridges/mcp/stage.ts:290-312`

**Issue:** An update that drops a server writes its kept override back through `withPluginServers` (stage path), but the stage reports only `comments-dropped` and `override-kept`. Unstage reports every write-back. Today no single command keeps an override and then drops the same server in a later stage, so no stale warning can appear. A future flow that does both (for example install, then update inside one reconcile run) would show "It comes back when you uninstall" for an override that is already back.

**Fix:** In `prepareStageMcpServers`, emit `override-restored` for each owned name not in `newNames` whose `restorableOverride` is defined. `restoredOverrideNames` already uses that same test, so the same helper can feed both paths.

### IN-03: `marker.ts` adds a fifth private `isPlainObject` copy next to an inline copy of the same check

**File:** `extensions/pi-claude-marketplace/bridges/mcp/marker.ts:30-32` (and readMarker at lines 42 and 51)

**Issue:** The bridge now has five identical `isPlainObject` helpers: substitute.ts:92, adapter-doc.ts:82, marker.ts:30, adapter-entry.ts:49 and stage.ts:137. `readMarker` also repeats the same predicate inline twice, a few lines below the new helper. This extends the deferred IN-03 (duplicated helpers) from the previous review.

**Fix:** Use the new helper inside `readMarker` for its two inline checks. Fold the copies into one bridge-local export when IN-03 is taken up.

### IN-04: A plugin's own carried fields are written into the user's override at unstage and stay there after the plugin is gone

**File:** `extensions/pi-claude-marketplace/bridges/mcp/adapter-entry.ts:128,138`

**Issue:** `restoredOverride` adds every carried field the live entry holds. The live entry is the plugin's translated entry with the stub's carried fields on top (`stampServers`, adapter-entry.ts:172-180). So a carried key that the plugin declares and the stub does not also reaches the override. This was reproduced with `tmp/review-wr01/probe.ts` (probe B). The stub is `{ env }` and the plugin server declares `lifecycle: "eager", requestTimeoutMs: 5`. After uninstall the file holds `srv: { env, lifecycle: "eager", requestTimeoutMs: 5 }`. These values now override the user's lower-precedence definition of `srv` after the plugin is gone. Before 4a206e4a, uninstall wrote back only the user's fields. This is the literal reading of D-02-22 ("the live entry's carried fields"), and the fix report flags it. Today it happens only when a plugin's server entry uses one of the nine pi-mcp-adapter keys, which Claude's `.mcp.json` format does not define. It becomes common once ANAME-07 writes `requestTimeoutMs` (see the Phase 3 hand-off under "Deferred Ideas" in 02-CONTEXT.md). It is classed as Info because it follows a recorded operator decision. If D-02-22 was meant to cover only the user's own choices, promote it to Warning.

**Fix:** Ask the operator to confirm. If only user choices should come back, the stage can record in the marker which carried keys came from the plugin's translated entry. `restoredOverride` would then skip a live carried value that still equals the plugin's declared value. Settle this with the Phase 3 ANAME-07 carry-forward decision, not separately.

### IN-05: An override that the overlay empties is written back as `{}`, where pi-mcp-adapter would delete the entry

**File:** `extensions/pi-claude-marketplace/bridges/mcp/adapter-doc.ts:313-316`

**Issue:** This was reproduced with `tmp/review-wr01/probe.ts` (probe A). The stub `{ disabled: true }` is absorbed, `/mcp-adapter enable` removes `disabled`, and uninstall then writes back `srv: {}`. Reinstall keeps `{}`, and a second uninstall writes `{}` again, so the value is stable and does not grow. pi-mcp-adapter's own writer deletes an entry that becomes empty (`config.js:1580-1581`). When a lower source defines `srv`, `{}` merges to nothing and the result is the same. When no lower source defines it (the stub had no target), the adapter now loads a server with no transport. It throws "Server srv must configure exactly one of command, url, or socket" when it tries to connect (`server-manager.js:847-851`), where upstream would have no entry. The fix report records this choice as defensible and leaves it as a possible follow-up.

**Fix:** In `keptServers`, drop the name when the restored override has no own keys **and** the kept override had at least one, so a user-authored `{}` stub still round-trips. Or record the choice in D-02-22.

### IN-06: The rewrapped `withPluginServers` doc comment has a 112-column line

**File:** `extensions/pi-claude-marketplace/bridges/mcp/adapter-doc.ts:351`

**Issue:** 4a206e4a added "with the entry's carried fields" to the comment and did not rewrap the paragraph. Line 351 is now 112 columns, over the project's 100-column `printWidth`. Prettier does not rewrap comments, so no gate catches it.

**Fix:** Rewrap lines 347-356 to 100 columns.

---

_Reviewed: 2026-10-04T10:11:32Z (narrow re-review of 4a206e4a; gap-closure first run 2026-10-04T05:34:46Z)_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep (write-back seam only)_
