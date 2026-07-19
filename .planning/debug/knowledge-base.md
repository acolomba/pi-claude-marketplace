# GSD Debug Knowledge Base

Resolved debug sessions. Used by `gsd-debugger` to surface known-pattern hypotheses at the start of new investigations.

---

## test-suite-hang-phase79 — npm run check hangs indefinitely with a varying stall point after auth threading
- **Date:** 2026-07-11
- **Error patterns:** npm run check hang, node --test never exits, varying stall point, test suite hang, ref'd timer, device flow poll loop, sleepMs, high concurrency race, worker event loop kept alive
- **Root cause:** The test mock `makeMockDeviceFlowHttp` (tests/helpers/device-flow-mock.ts) defaulted `deviceCode.interval` to 5, contradicting its own header comment (tests use `interval: 0` to spin the poll loop synchronously). A test that drove `onAuthRequired()` without an explicit `deviceCode` inherited `interval: 5`, so `runPollLoop` in domain/github-auth.ts fired a REAL, ref'd `sleepMs(5000ms)` (node:timers/promises) before consuming the queued result. The ref'd timer held an isolated node:test worker's event loop alive; under the saturated 16-way `npm run check` pool this intermittently pushed the run past the timeout and, with poll-loop scheduling variability, surfaced as an indefinite hang with a varying stall point. Serial and low-concurrency runs passed, which is the signature of a high-concurrency real-timer/handle race (not a deterministic single-file leak).
- **Fix:** Changed the mock default `deviceCode.interval` from 5 to 0, aligning it with the helper's documented intent. Removes the accidental real sleep and hardens every future test that drives the poll loop without an explicit deviceCode. No `--test-force-exit` band-aid. Byte-frozen device-flow tests unaffected (they override deviceCode explicitly or never reach runPollLoop).
- **Files changed:** tests/helpers/device-flow-mock.ts
---
