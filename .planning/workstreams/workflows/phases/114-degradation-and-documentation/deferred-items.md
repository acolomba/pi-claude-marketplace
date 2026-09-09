# Deferred items — 114

Out-of-scope discoveries found during execution. Logged, not fixed.

**All items in this file are closed.** See the closure section at the end.

## `docs/messaging-style-guide.md`'s variant enumeration is stale (found in 114-04 Task 3)

Three claims in that document are wrong against the tree, and none of them is
one of the six prose corrections plan 114-04 scopes:

| Line | Claim | Tree | Status |
|---|---|---|---|
| 25 | ``export type PluginNotificationMessage; // 16-variant discriminated union on `status` `` | 19 members in `PLUGIN_STATUSES` | status: closed |
| 26 | ``export type PluginStatus; // 16 literal strings, derived from PLUGIN_STATUSES tuple`` | 19 literal strings | status: closed |
| 36-54 | the `PluginNotificationMessage` union listing | lists `PluginPresentMessage` (`present` is a retired status; `grep -c 'PluginPresentMessage' extensions/pi-claude-marketplace/shared/notify.ts` prints 0) and omits `partially-installed` and `partially-upgradable` | status: closed |

Not fixed here: it is a different defect from the soft-dependency prose sweep
114-04 owns, it touches a block the plan does not name, and correcting the
enumeration properly means re-deriving the whole 19-row listing rather than
editing a count. The same document's line 33 already says "do not re-enumerate
a count in prose", which is the rule the stale counts on lines 25-26 break.

Fixing it is a self-contained docs task against
`extensions/pi-claude-marketplace/shared/notify.ts`.

## Closure, 2026-09-09

**Fixed** as quick task `260909-ox9` (commits `5f3cd340`, `5073e497`), not
waived. Recorded `closed` here rather than left `open`, for the reason
`WDOCS-01` exists: a record that advertises completed work as outstanding is
itself the defect.

The three claims above were all still true at closure time — re-measured, the
tuple carried 19 members against the stated 16, and `PluginPresentMessage` had
0 references in `shared/notify.ts`. What changed is the shape of the fix. The
listing was **deleted, not corrected**: it duplicated a nineteen-arm union
inside the section that opens by promising to point at definitions rather than
duplicate them, and it was the copy that rotted. A source pointer plus a
status-by-field table replaced it, and
`tests/architecture/messaging-guide-doc-pins.test.ts` (MSGDOC-01, 5 cases) binds
that table to the imported `PLUGIN_STATUSES` tuple, so a twentieth status turns
a case red instead of falsifying prose.

Four further false claims in the same section were found while re-deriving and
corrected in the same commits: the `reasons` partition (stated 8 + 6 + 5, and a
compile error that does not occur — `PluginUninstalledMessage.reasons?` exists;
actually 8 + 7 + 4), the reason-bearing variant count (stated 5, measured 15),
the no-scope family size (stated three members, actually four — `remote` also
has no `scope`), and the retired inventory token still named as live.

One claim was deliberately NOT fixed here and carries a carrier instead: the
reload-hint MECHANISM description is also stale, and it is a behavior claim
needing its own measurement of the `needsReload` plumbing rather than an
enumeration defect. Filed as Broken Windows entry 47.
