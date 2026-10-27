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
