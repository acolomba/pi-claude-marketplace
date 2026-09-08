# Deferred items — 114

Out-of-scope discoveries found during execution. Logged, not fixed.

## `docs/messaging-style-guide.md`'s variant enumeration is stale (found in 114-04 Task 3)

Three claims in that document are wrong against the tree, and none of them is
one of the six prose corrections plan 114-04 scopes:

| Line | Claim | Tree |
|---|---|---|
| 25 | ``export type PluginNotificationMessage; // 16-variant discriminated union on `status` `` | 19 members in `PLUGIN_STATUSES` |
| 26 | ``export type PluginStatus; // 16 literal strings, derived from PLUGIN_STATUSES tuple`` | 19 literal strings |
| 36-54 | the `PluginNotificationMessage` union listing | lists `PluginPresentMessage` (`present` is a retired status; `grep -c 'PluginPresentMessage' extensions/pi-claude-marketplace/shared/notify.ts` prints 0) and omits `partially-installed` and `partially-upgradable` |

Not fixed here: it is a different defect from the soft-dependency prose sweep
114-04 owns, it touches a block the plan does not name, and correcting the
enumeration properly means re-deriving the whole 19-row listing rather than
editing a count. The same document's line 33 already says "do not re-enumerate
a count in prose", which is the rule the stale counts on lines 25-26 break.

Fixing it is a self-contained docs task against
`extensions/pi-claude-marketplace/shared/notify.ts`.
