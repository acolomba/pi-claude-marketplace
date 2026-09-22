# Deferred Items — Phase 10

Out-of-scope discoveries logged during plan execution (per gsd-executor SCOPE BOUNDARY rule).
Not fixed here; tracked for a future, unrelated pass.

## 10-02: PDEF-01 test failure was a phase-10 fixture regression, not pre-existing

The entry previously logged here claimed this failure predated 10-02 and was out of scope. That
claim was wrong: the test passes at the phase-10 start commit (`07f797e2`, 155/155) and only starts
failing once `15530b66` adds the update constraint gate. The gate's fail-closed declaration walk
(D-10-05) reaches an unrelated hand-built `other-mp` state record whose `marketplace.json` the test
never created on disk, so the walk refuses closed and the update is skipped (`warning`) before it
ever reaches the agent-conflict path (`error`) the test is about.

Found and fixed in-phase, in this commit: `tests/orchestrators/plugin/update-flow.test.ts` now
seeds a real, loadable `other-mp/marketplace.json` so the declaration walk establishes `world`
declares nothing, letting the update proceed to the conflict it exists to prove.

No items remain deferred from this phase.
