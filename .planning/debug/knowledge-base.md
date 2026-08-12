---
status: resolved
---

# GSD Debug Knowledge Base

Resolved debug sessions. Used by `gsd-debugger` to surface known-pattern hypotheses at the start of new investigations.

`status: resolved` is bookkeeping, not a session state: `audit-open` treats every
top-level `.md` under `.planning/debug/` as a debug session, and this file is the
knowledge base itself. The marker keeps it out of the open-session count.

---

## test-suite-hang-phase79 — npm run check hangs indefinitely with a varying stall point after auth threading
- **Date:** 2026-07-11
- **Error patterns:** npm run check hang, node --test never exits, varying stall point, test suite hang, ref'd timer, device flow poll loop, sleepMs, high concurrency race, worker event loop kept alive
- **Root cause:** The test mock `makeMockDeviceFlowHttp` (tests/helpers/device-flow-mock.ts) defaulted `deviceCode.interval` to 5, contradicting its own header comment (tests use `interval: 0` to spin the poll loop synchronously). A test that drove `onAuthRequired()` without an explicit `deviceCode` inherited `interval: 5`, so `runPollLoop` in domain/github-auth.ts fired a REAL, ref'd `sleepMs(5000ms)` (node:timers/promises) before consuming the queued result. The ref'd timer held an isolated node:test worker's event loop alive; under the saturated 16-way `npm run check` pool this intermittently pushed the run past the timeout and, with poll-loop scheduling variability, surfaced as an indefinite hang with a varying stall point. Serial and low-concurrency runs passed, which is the signature of a high-concurrency real-timer/handle race (not a deterministic single-file leak).
- **Fix:** Changed the mock default `deviceCode.interval` from 5 to 0, aligning it with the helper's documented intent. Removes the accidental real sleep and hardens every future test that drives the poll loop without an explicit deviceCode. No `--test-force-exit` band-aid. Byte-frozen device-flow tests unaffected (they override deviceCode explicitly or never reach runPollLoop).
- **Files changed:** tests/helpers/device-flow-mock.ts
---

## disabled-partial-record-unrecognized — disabling a partially installed plugin produces a record no surface recognizes as disabled
- **Date:** 2026-08-07 diagnosed, 2026-08-09 fixed, 2026-08-11 live-verified
- **Error patterns:** disable has no effect, plugin still shows as installed after disable, enable reports already enabled, disable is not idempotent, reconcile re-plans a disable forever, update re-stages a disabled plugin, silently wrong branch with no error
- **Root cause:** The disabled-detection predicate `compatibility.installable && !enabled` was duplicated across four files (plugin-state-classifier.ts, enable-disable.ts, reconcile/plan.ts, plugin/update.ts). It was written when `installable: false` implied soft-degradation, a state the disable orchestrator was assumed never to produce. Partial installs broke that assumption: a partial install always persists `installable: false`, and the disable path has no `installable` gate, so disabling a partially installed plugin writes a record whose two fields make it invisible to every consumer. Because `installable: true` had become equivalent to an empty `unsupported` set, the conjunct excluded exactly one shape — the partial-disabled record — and nothing else. Five surfaces then took a silently wrong branch, with zero errors, which is why it went unnoticed. Latent since partial installs landed.
- **Fix:** Collapsed the four copies into one definition, `isRecordedButDisabled` in persistence/state-io.ts, keyed only on `enabled`. The dropped conjunct was not load-bearing: `enabled: false` is written only by the disable orchestrator, and the schema migration backfills `enabled: true` for legacy records. The truth-table cell that had pinned the wrong behavior as intended was corrected rather than left green. A drift gate inverted from "the twin has the right body" to "no twin survives" now blocks a fifth copy, and it catches the operator-adjacent, destructured, bracket-access, and `Boolean()`-coercion spellings.
- **Generalizable lesson:** A guard whose two conditions have silently become mutually exclusive is worse than a redundant one — it excludes exactly one reachable shape and reports no error. When a feature makes a field's meaning shift (here, `installable: false` going from "soft-degraded" to "also partially installed"), audit every predicate that reads it, not just the ones the feature touched.
- **Files changed:** persistence/state-io.ts, orchestrators/plugin-state-classifier.ts, orchestrators/plugin/enable-disable.ts, orchestrators/reconcile/plan.ts, orchestrators/plugin/update.ts, tests/orchestrators/reconcile/plan.test.ts
---

## async-rewake-lane-inert — an asyncRewake hook handler never spawns its async child in a live session
- **Date:** 2026-08-04 diagnosed, 2026-08-11 closed as no-defect
- **Error patterns:** hook edit has no effect, asyncRewake never spawns, only the sync lane runs, hooks.json change ignored after /reload, no error and no marker file, live behavior disagrees with the marketplace source
- **Root cause:** Not a code defect. Install stages a plugin's parsed hooks config to `<scope>/pi-claude-marketplace/hooks/<slug>/hooks.json`, and the event router hydrates ONLY from that staged copy. `/reload` re-reads the staged copy; only install, reinstall, and update rewrite it. The investigation had edited the MARKETPLACE SOURCE 14 minutes after install and reloaded, so routing kept executing the first fixture attempt faithfully — a sync-only PreToolUse bucket plus an asyncRewake handler parked on Stop, where it is inert by design. Zero errors because nothing failed.
- **Fix:** None needed in product code. Re-stage the fixture (reinstall or update the plugin) so the staged copy carries the intended config. A seam test through the unmodified production path confirmed the corrected config spawns both children with full env parity, 2/2.
- **Generalizable lesson:** `/reload` reads staged artifacts, not sources. Any UAT that edits a plugin's source mid-session must reinstall before reloading, or it will measure the previous install. A "feature is inert" symptom with no error is more often a stale staged artifact than a broken lane — compare the staged file's mtime against the record's `installedAt` before suspecting the code.
- **Files changed:** none
---
