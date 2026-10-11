---
phase: 08-clear-milestone-debt
reviewed: 2026-10-10T00:00:00Z
depth: standard
files_reviewed: 110
files_reviewed_list:
  - CONTRIBUTING.md
  - docs/mcp-compatibility.md
  - docs/output-catalog.md
  - extensions/pi-claude-marketplace/bridges/agents/stage.ts
  - extensions/pi-claude-marketplace/bridges/mcp/adapter-doc.ts
  - extensions/pi-claude-marketplace/bridges/mcp/adapter-entry.ts
  - extensions/pi-claude-marketplace/bridges/mcp/legacy.ts
  - extensions/pi-claude-marketplace/bridges/mcp/marker.ts
  - extensions/pi-claude-marketplace/bridges/mcp/stage.ts
  - extensions/pi-claude-marketplace/bridges/mcp/substitute.ts
  - extensions/pi-claude-marketplace/bridges/mcp/types.ts
  - extensions/pi-claude-marketplace/bridges/mcp/unstage.ts
  - extensions/pi-claude-marketplace/domain/claude-mcp-variables.ts
  - extensions/pi-claude-marketplace/domain/mcp-server-features.ts
  - extensions/pi-claude-marketplace/domain/name.ts
  - extensions/pi-claude-marketplace/domain/plugin-resolver.ts
  - extensions/pi-claude-marketplace/edge/completions/data.ts
  - extensions/pi-claude-marketplace/orchestrators/edge-deps.ts
  - extensions/pi-claude-marketplace/orchestrators/import/execute.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/autoupdate.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/list.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/remove.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/clone-cache.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/git-source-probe.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/info-mcp-status.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/info.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-cascade.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-declared-enabled.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-disable-cascade.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-flow.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-outcome.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/list-flow.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/prune-rollback.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/reinstall-clone-probe.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/reinstall-flow.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/reinstall-record.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/reinstall-replace.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/reinstall-targets.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/shared.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/update-flow.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/update-preflight.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/update-swap.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/mcp-migration.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/plan.ts
  - extensions/pi-claude-marketplace/orchestrators/scope-fanout.ts
  - extensions/pi-claude-marketplace/persistence/config-write-back.ts
  - extensions/pi-claude-marketplace/platform/mcp-status.ts
  - extensions/pi-claude-marketplace/platform/pi-api.ts
  - extensions/pi-claude-marketplace/shared/notification-dispatch.ts
  - extensions/pi-claude-marketplace/shared/notify-context.ts
  - extensions/pi-claude-marketplace/shared/own-key.ts
  - extensions/pi-claude-marketplace/shared/session-env.ts
  - README.es.md
  - README.md
  - scripts/pi.sh
  - tests/architecture/catalog-uat/fixtures/plugin-info.ts
  - tests/architecture/integration-materialization-gate.test.ts
  - tests/architecture/mcp-migration-notice.test.ts
  - tests/bridges/mcp/adapter-doc.test.ts
  - tests/bridges/mcp/adapter-entry.test.ts
  - tests/bridges/mcp/stage.test.ts
  - tests/bridges/mcp/types.test.ts
  - tests/bridges/mcp/unstage.test.ts
  - tests/domain/claude-mcp-variables.test.ts
  - tests/domain/mcp-server-features.test.ts
  - tests/domain/name.test.ts
  - tests/domain/plugin-resolver.test.ts
  - tests/e2e/adapter-detection-rpc.test.ts
  - tests/edge/handlers/plugin/uninstall.test.ts
  - tests/index.test.ts
  - tests/integration/mcp-adapter-entry-conformance.test.ts
  - tests/integration/mcp-override-lifecycle.test.ts
  - tests/integration/pi-mcp-adapter-peer.ts
  - tests/integration/reserved-record-keys.test.ts
  - tests/live-uat/manifest-absence-canary.mjs
  - tests/live-uat/openai-stub-server.mjs
  - tests/live-uat/stop-canary.mjs
  - tests/live-uat/workflow-storage-canary.mjs
  - tests/orchestrators/import/execute.test.ts
  - tests/orchestrators/marketplace/add.test.ts
  - tests/orchestrators/marketplace/shared.test.ts
  - tests/orchestrators/plugin/enable-disable.test.ts
  - tests/orchestrators/plugin/git-source-probe.test.ts
  - tests/orchestrators/plugin/info-mcp-status.test.ts
  - tests/orchestrators/plugin/info.test.ts
  - tests/orchestrators/plugin/install-cascade.test.ts
  - tests/orchestrators/plugin/install-flow.test.ts
  - tests/orchestrators/plugin/install-outcome.test.ts
  - tests/orchestrators/plugin/prune-rollback.test.ts
  - tests/orchestrators/plugin/reinstall-clone-probe.test.ts
  - tests/orchestrators/plugin/reinstall-flow.test.ts
  - tests/orchestrators/plugin/reinstall-record.test.ts
  - tests/orchestrators/plugin/reinstall-replace.test.ts
  - tests/orchestrators/plugin/reinstall-targets.test.ts
  - tests/orchestrators/plugin/shared.test.ts
  - tests/orchestrators/plugin/uninstall.test.ts
  - tests/orchestrators/plugin/update-flow.test.ts
  - tests/orchestrators/plugin/update-swap.test.ts
  - tests/orchestrators/reconcile/mcp-migration.test.ts
  - tests/orchestrators/reconcile/plan.test.ts
  - tests/platform/pi-inventory-seed.ts
  - tests/shared/notification-dispatch.test.ts
  - tests/shared/own-key.test.ts
  - tests/shared/session-env.test.ts
findings:
  critical: 0
  warning: 4
  info: 3
  total: 7
status: issues_found
---

# Phase 8: Code Review Report

**Reviewed:** 2026-10-10
**Depth:** standard
**Files Reviewed:** 110
**Status:** issues_found

## Summary

I reviewed the changed hunks of `6f11df72..HEAD` across the 110 files in scope.
I read the source changes in full context and spot-checked the test changes for
hermeticity, assertions and GSD-history comments.

These parts hold:

- **OWNKEY-01.** Every name-indexed read of `marketplaces`, `plugins` and the
  config maps now goes through `ownValue`, and every write goes through
  `setOwn`. The only bracket forms left are `delete` statements, which are
  safe. `__proto__` is refused for plugin names (`plugin-resolver.ts:517`) and
  marketplace names (`add.ts:333`).
- **D-08-06.** `StageMcpInput.env` is required. Every entry factory defaults it
  to `process.env`.
- **D-08-04.** The OAuth gate in `adapter-entry.ts` agrees with the doc table.
- **Migration probes.** The new stub-probe failure path and the locked re-read
  both report correctly.
- **Tests.** The new tests use `withHermeticEnvironment`, or they save and
  restore `process.env` in `finally`. None of them touches the real `~/.pi/agent`.
- **Comments.** The added comments carry no phase, plan or wave history.

I found no BLOCKER. The four warnings are:

- **WR-01.** `restoredOverrideNames` (the notice side) and the new
  `writtenBackOverride` (the write side) now decide differently. I reproduced
  this with a scratch script.
- **WR-02.** The choice store matches by plugin name only. The docs and code
  comments claim more isolation than the code gives.
- **WR-03.** Override field names in the `override-kept` notice are printed
  without escaping. They come straight from a config file that may be
  untrusted.
- **WR-04.** The new `source-outdated` migration row also covers `escapes` and
  the mirror-HEAD case. For those cases its text or its remedy is wrong.

## Warnings

### WR-01: `restoredOverrideNames` no longer agrees with the write-back it describes

**File:** `extensions/pi-claude-marketplace/bridges/mcp/adapter-doc.ts:290-306` (vs `:316-326`, `:334-346`)

**Issue:**

This phase made `survivingEntry` call `writtenBackOverride`. That function
removes an owned entry whose kept override comes back emptied: the kept
override is non-empty, but every field in it is a carried field that the live
entry has since dropped, for example after `/mcp-adapter enable`.

`restoredOverrideNames` still tests only `restorableOverride(entry) !== undefined`.
Its doc comment says "The same `restorableOverride` test decides both, so the
names and the write-back agree". That claim is now false.

Reproduction: an entry `srv` with marker `keptOverride: { disabled: true }` and
no live `disabled`.

- `restoredOverrideNames(...)` returns `['srv']`.
- `withPluginServersKeepingChoices(cfg, "p", "m", {})` writes
  `{"mcpServers":{}}`.

So `unstage.ts:127` emits an `override-restored` notice for an override that
was not written back. The new stage-time `overrideRestoredNotices`
(`stage.ts:283-292`) does the same for a server that an update drops.

Today an `override-restored` notice only cancels an `override-kept` line, and
an override that raised `override-kept` cannot come back emptied. So nothing
visible breaks yet. The function's published contract is still wrong, though,
and any new consumer of the notice will get wrong data. No test covers this
case: `adapter-doc.test.ts:846` tests only the write.

**Fix:** Use the same predicate on both sides:

```ts
if (isOwnedBy(entry, pluginName, marketplaceName) && writtenBackOverride(entry) !== undefined) {
  names.add(name);
}
```

Then add a `restoredOverrideNames` test beside `adapter-doc.test.ts:846`.

### WR-02: Stored server choices match by plugin name only; docs claim per-plugin isolation

**File:** `extensions/pi-claude-marketplace/bridges/mcp/adapter-doc.ts:417-420, 469-487, 512-527`; `docs/mcp-compatibility.md:198`; `docs/output-catalog.md` (override section)

**Issue:**

`StoredChoice` records only `plugin`, and `storedChoicesFor` matches on
`choice.plugin === pluginName`. The server key (`plugin_<plugin>_<server>_`)
does not hold the marketplace either.

The rest of the bridge treats a plugin as the pair (plugin, marketplace). For
example, `isOwnedBy` checks both names. So after `foo@mpA` is uninstalled,
installing `foo@mpB` in the same scope consumes the choices that `foo@mpA`
left.

Both of these claims are therefore false for a same-named plugin from another
marketplace:

- the code comment "never reaches a different plugin's server under a
  colliding key"
- the doc sentence "A stored choice never applies to a server of another
  plugin, even one with the same key"

Some carried fields matter for security. In pi-mcp-adapter
(`tool-approval.ts:32-33`), a per-server `approveTools` overrides the global
`settings.approveTools`. A stored `approveTools: false` therefore turns off a
global approval gate for the new marketplace's server. A stored `lifecycle`
value of `eager` starts that server at session start.

Upstream also keys `disabledMcpServers` without the marketplace
(`plugin:<plugin>:<server>`), so name-only matching may be acceptable parity
for `disabled`. Either way, the docs and comments must say what the code does.

**Fix:** Pick one:

- Record the marketplace too: `{ plugin, marketplace, fields }`. Match on both
  in `storedChoicesFor` and in the `consumed` filter of
  `withPluginServersKeepingChoices`. Pass `marketplaceName` to
  `storedChoicesFor` from `stage.ts:531`.
- Keep name-only matching as upstream parity, and correct the two doc
  sentences and the `storedChoicesFor` comment to say that a plugin with the
  same name from another marketplace gets the choices.

### WR-03: `override-kept` notice prints file-derived field names without escaping

**File:** `extensions/pi-claude-marketplace/shared/notification-dispatch.ts:330-332`

**Issue:**

This phase escaped plugin and server names in every MCP config line. The
`fields` list in `mcpOverrideKeptLine` is still joined as raw text.

Those names are not a closed set. `overrideKeptNotices` (`stage.ts:258-262`)
builds them from `inactiveOverrideFields(overlay, ...)`, which returns
`Object.keys(overlay)` filtered against the carried set. So each name is any
key of a marker-less overlay in the scope's `mcp-adapter.json`.

The project-scope file `<cwd>/.pi/mcp-adapter.json` can come from a cloned
repository. A key that holds ANSI escapes, a line separator or a bidi control
reaches the notice unescaped.

The other two lists are safe:

- The `names` in `variables-missing` and `credentials-blanked` match
  `[A-Za-z_][A-Za-z0-9_]*` (`claude-mcp-variables.ts:78`).
- The `tool-rules-unenforced` fields are fixed literals.

So only this list needs the fix.

**Fix:**

```ts
... these fields of it stop applying: ${notice.fields.map(printable).join(", ")}. ...
```

Then add a dispatch test with a control or bidi character in a field name.

### WR-04: `source-outdated` row names an update remedy that cannot clear an `escapes` miss, and can describe the wrong commit

**File:** `extensions/pi-claude-marketplace/orchestrators/reconcile/mcp-migration.ts:288, 297-304`; `extensions/pi-claude-marketplace/orchestrators/plugin/git-source-probe.ts:208-215`; `shared/notification-dispatch.ts:798-799`

**Issue:**

`offlineCloneRead` sets `missing` for both `missing-subdir` and `escapes`, and
`missKind` maps both to `source-outdated`. That row says "The installed commit
of X has no plugin at its declared path. Run /claude:plugin update X@mp".

There are two problems:

1. **The `escapes` case.** `escapes` comes from `resolveGitSubdirRoot`'s
   containment check on the path that the marketplace declares
   (`fs-utils.ts:341-346`). `gitSubdirObjectSource` does not reject `..` in the
   path (`domain/source.ts:240-247`). A lexically escaping path escapes in
   every commit. An update re-resolves the same declared path and fails the
   same way. The row then repeats on every reload with a remedy that cannot
   clear it. This breaks the module's contract, "Each row names a remedy that
   clears its cause".
2. **The mirror case.** For an unpinned source with a present mirror,
   `makeRecordedShaPresenceProbe` returns the mirror's result. The
   `missing-subdir` then describes the mirror's checked-out HEAD, not the
   installed commit, so the row's "installed commit" wording is inaccurate.

D-08-05 names both `missing-subdir` and `escapes`. The decision did not
consider that an update cannot clear a lexical escape.

**Fix:** Map only `missing-subdir` to `source-outdated`. Send `escapes` to
`marketplace-unreadable`: its remedies, a marketplace update or an uninstall,
can clear a bad declared path. Also reword the row to something like "The
cached source of X has no plugin at its declared path", or tell the two probe
paths apart. Update D-08-05, the catalog block and
`tests/architecture/mcp-migration-notice.test.ts` together.

## Info

### IN-01: Local `ownValue` in adapter-doc.ts duplicates and shadows `shared/own-key.ts`

**File:** `extensions/pi-claude-marketplace/bridges/mcp/adapter-doc.ts:428-430`

**Issue:** This phase added `shared/own-key.ts` `ownValue` as the shared
own-key read (D-08-07). It also added a private `ownValue` here with the same
name, a narrower signature (the map cannot be `undefined`) and the same body.
Two helpers with one name and different signatures invite import mix-ups.

**Fix:** Import `ownValue` from `../../shared/own-key.ts`. The bridges-mcp zone
may import `shared`. Then delete the local copy.

### IN-02: The migration probe swallows every mirror error; reinstall swallows only the HEAD read

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/git-source-probe.ts:211-213` (vs `reinstall-clone-probe.ts:80-90`)

**Issue:** The comment says the migration probe falls through "as reinstall
does". It doesn't quite:

- In reinstall, `readUsableMirrorSha` catches only the `readMirrorHeadSha` read.
- The migration probe's `.catch(() => undefined)` covers all of `probeMirror`.
  That includes the `pluginCloneDir` containment check (NFR-10) and any non-
  containment error from `resolveGitSubdirRoot`, such as `EACCES`.

So the migration can fall through to the recorded-sha clone in cases where
reinstall would throw.

**Fix:** In `git-source-probe.ts`, guard only the `readMirrorHeadSha` call,
for example with a shared `readUsableMirrorSha` helper, so both probes fall
through in the same cases.

### IN-03: The `marketplace-unreadable` row still offers `marketplace update` for a missing checkout

**File:** `extensions/pi-claude-marketplace/shared/notification-dispatch.ts:800-801`; `docs/output-catalog.md` (left-in-place block); `docs/mcp-compatibility.md` (cause table)

**Issue:** The docs now say "When the marketplace checkout itself is missing,
a marketplace update cannot restore it, so remove the marketplace and add it
again". The row emitted for that cause still leads with "Run /claude:plugin
marketplace update <mp>". The second remedy, uninstall, does clear it, so a
working remedy is listed. But the row and the docs now disagree on the first
remedy.

**Fix:** Pick one:

- Split out a checkout-missing cause and give it its own remedy row.
- Note in the docs that the row lists both remedies and that only uninstall
  helps when the checkout is missing.

---

_Reviewed: 2026-10-10_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
