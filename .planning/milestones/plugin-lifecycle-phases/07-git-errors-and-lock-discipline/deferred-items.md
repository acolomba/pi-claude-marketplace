# Deferred items: phase 07

## From 07-03

- `test/edge/register.test.ts` (near line 1851): "registered prune removes one
  orphan only from user scope" and "registered prune --scope project removes
  one orphan only from project scope" pin `lockSpy.mock.callCount()` at 1.
  Since 07-02, prune collects plugin clones under a fresh scope lock after its
  state guard (`collectPluginClonesLocked` -> `withExistingScopeLock` ->
  `lockfile.lock`), so the count is 2. `npm run test:modules` fails on these
  two cases. 07-03 does not list this file and its change does not cause the
  failure. The fix is the same as commit 6071a677 made in
  `test/orchestrators/plugin/operations.test.ts`: pin 2 calls and name both
  locks. WINDOWS.md carries the entry.
  **Status:** resolved
  Both parameterized cases now expect three locks and name the state guard,
  package cleanup lock, and clone cleanup lock. The focused owner test passes.

## From 07-06

- `bridges/skills/stage.ts` passes the raw `cp` error up when a skill file
  cannot be copied. On Node 26 its message names the staging target
  `<extensionRoot>/skills-staging/<random uuid>/<skill>/<file>`, so a direct
  or cascade update row whose cause is that error prints a path no user can
  act on and no cucumber run token can stand for. The commands bridge wraps
  the same failure in `BridgeStagingError` naming the command and plugin
  (`contextualStagingError`). Since 07-06 the autoupdate cascade carries this
  cause too (D-PL7-12), so `features/marketplace/update.feature`'s
  installed-order autoupdate scenario now fails its plugin on an unreadable
  command file instead of an unreadable skill file. A skills-bridge wrapper
  like the commands one would let a scenario pin the skill case again.
  **Status:** resolved
  Strict public-error redaction now replaces the random absolute staging path
  with `[redacted path]`. The unreadable-skill step records the stable
  `{unreadable skill file copy error}` token, and the focused install scenario
  proves that no absolute sandbox path reaches the result.
