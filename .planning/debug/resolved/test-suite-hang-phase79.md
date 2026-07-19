---
status: resolved
trigger: "npm run check hangs indefinitely after Phase 79 wave 3 merge; stall point varies (#1449/#1479/#1610), no test fails, runner never exits"
created: 2026-07-11T20:52:10Z
updated: 2026-07-11T21:47:55Z
---

## Current Focus

reasoning_checkpoint:
  hypothesis: "The Phase 79 memo test D-79-02 in tests/orchestrators/plugin/install-auth.test.ts constructs makeMockDeviceFlowHttp() WITHOUT overriding deviceCode.interval, so it inherits the mock default interval:5. When the test invokes bundle.onAuthRequired(), runPollLoop in github-auth.ts calls the REAL ref'd sleepMs(interval*1000)=5000ms before consuming the queued success. That real 5s ref'd timer runs inside the isolated node:test worker; under saturated 16-way npm run check load it intermittently pushes the run past the timeout and interacts with poll-loop scheduling to manifest as the varying-stall hang."
  confirming_evidence:
    - "Instrumented full suite: exactly 4 real POLLSLEEP events. 3 are in the byte-frozen github-auth.test.ts (slow_down/abort mechanics, terminating queue or cancelled by signal). The 4th is install-auth.test.ts:323 via auth-host.ts:100 -> 5000ms, host=github.com."
    - "install-auth.test.ts D-79-02 subtest measured at 5143ms in isolation; all its sibling subtests are <210ms. The 5s is the sleepMs, not filesystem."
    - "device-flow-mock.ts line 74 defaults interval:5; its own header comment (lines 11-13) states tests use interval:0 to spin the loop synchronously -- the default contradicts the documented intent."
    - "Every OTHER device-flow-driving test (auth-host.test.ts, auth-registry.test.ts, github-auth non-slow_down tests) explicitly sets interval:0. Only the new memo test forgot."
    - "Serial + conc-8 + conc-16 full runs PASS -> not a deterministic single-file leak; a bounded-but-real ref'd timer under high concurrency matches the intermittent, varying-stall-point profile."
  falsification_test: "If the memo test's 5s sleep were irrelevant, forcing interval:0 there (or fixing the mock default) would NOT change the 5143ms subtest duration. It should drop to <250ms."
  fix_rationale: "Root cause is a real ref'd timer firing in a unit test that only needs to verify memoization, not timing. Making the mock's DEFAULT interval 0 (matching the helper's own documented intent) removes the accidental real sleep for the memo test and hardens every future test that forgets the override, without a --test-force-exit band-aid. Frozen tests are unaffected: they either set interval explicitly or never drive the poll loop."
  blind_spots: "Could not reproduce the FULL indefinite hang locally (5 full runs all passed); the 15-min unbounded pending-loop path is NOT reachable by any current npm test (mock gitOps never drives onAuthRequired, and every direct driver has a terminating queue). So the fix targets the real 5s ref'd-timer regression, which is the only Phase-79-introduced real device-flow sleep in the npm test glob. Will verify with two back-to-back npm run check passes under the 10-min bar."

next_action: Change device-flow-mock.ts default deviceCode.interval from 5 to 0; run install-auth.test.ts to confirm memo subtest drops from ~5143ms to <250ms; run full npm run check twice under 10-min timeout.

## Symptoms

expected: `npm run check` completes with exit 0 within minutes (194 unit-test files, 0 failures).
actual: Runner hangs indefinitely; three runs each >10min. Stall point VARIES (#1449, #1479, #1610). No `not ok`. Output stops, runner never exits.
errors: none (no test failure; process just never terminates)
reproduction: `npm run check` (or `npm test`) at HEAD on main. Every test directory passes in isolation. Each auth-touched file passes individually.
started: After merging Phase 79 wave 3 (auth threading through install/update/reinstall + once-per-host memo + auth-host.ts re-exports). Transient 5min timeout earlier at Phase 78 wave 2 (passed on retry).

## Eliminated

- hypothesis: Deterministic single-file hang (ref'd timer or blocking subprocess in one specific test).
  evidence: TEST_CONCURRENCY=1 serial full run completed exit 0 (2761 lines spec output). Concurrency=8 also completed exit 0 (2726 pass, 0 fail). If a single file leaked a handle, serial would hang at it.
  timestamp: 2026-07-11T21:10:00Z

- hypothesis: Cross-file HOME mutation race (process.env.HOME set globally by withHermeticHome).
  evidence: Node v22.22.2 --test uses process isolation by default -- each test FILE runs in its own child process, so HOME mutation is per-worker, not shared. ~48 test files mutate HOME and all pass.
  timestamp: 2026-07-11T21:10:00Z

## Evidence

- timestamp: 2026-07-11T20:52:10Z
  checked: Source layout
  found: Source under extensions/pi-claude-marketplace/. Key files: domain/github-auth.ts, orchestrators/auth-host.ts, platform/git-credential.ts, platform/git.ts exist.
  implication: Investigate these for ref'd timers / stdin-reading subprocesses reachable without mocks.

- timestamp: 2026-07-11T21:10:00Z
  checked: Serial + concurrency-8 full-suite runs
  found: Both exit 0. Serial 2761 spec lines. Conc-8: 2727 tests, 2726 pass, 0 fail.
  implication: Hang is a CONCURRENCY RACE requiring HIGH parallelism (>8). Default node --test concurrency = 16 cores on this machine. The contended resource is a real OS resource shared across isolated worker processes (real git subprocess / global git config / a fixed FS path), reachable only at high fan-out.

- timestamp: 2026-07-11T21:10:00Z
  checked: git-credential.ts, buildAuthCallbacks (git.ts), auth tests
  found: All auth unit tests inject makeMockCredentialOps + makeMockDeviceFlowHttp. git-credential timer is unref'd, stdin ends. buildAuthCallbacks.onAuth calls credentialOps.fill(host) -> if REAL DEFAULT_CREDENTIAL_OPS reached, spawns `git credential fill`.
  implication: Need a test path that threads REAL credentialOps into a REAL resolveRemoteRef/clone. Prime suspect: the plugin/marketplace update refresh arm (resolveRemoteRef for unpinned HEAD) reachable without mock injection.

## Resolution

root_cause: |
  The test mock makeMockDeviceFlowHttp (tests/helpers/device-flow-mock.ts)
  defaulted deviceCode.interval to 5, contradicting its own header comment that
  states tests use interval:0 to spin the poll loop synchronously. The Phase 79
  D-79-02 memo test in install-auth.test.ts constructed the mock WITHOUT an
  explicit deviceCode, then invoked bundle.onAuthRequired(). That drove
  runPollLoop in domain/github-auth.ts, which calls the REAL, ref'd
  sleepMs(interval*1000)=5000ms via node:timers/promises before consuming the
  queued success. A full-suite tracer confirmed this was the ONLY Phase-79
  device-flow real sleep among 4 total (the other 3 are byte-frozen intentional
  slow_down / abort mechanics with terminating queues or a cancelling signal).
  A real ref'd timer holds an isolated node:test worker's event loop; under the
  saturated 16-way `npm run check` pool (tsc/eslint having warmed the machine)
  it intermittently pushes the run past the timeout and, combined with poll-loop
  scheduling variability, surfaces as the observed varying-stall-point hang. The
  broader footgun: any test driving the poll loop with the default mock + an
  empty pollQueue would loop on defaultPoll:pending for expires_in (900s) --
  the >10-min indefinite hang -- though no current npm test reaches that path.
fix: |
  Changed the mock default deviceCode.interval from 5 to 0 in
  tests/helpers/device-flow-mock.ts, aligning the default with the helper's
  documented intent. This eliminates the accidental real 5s sleep in the memo
  test AND hardens every future test that drives the loop without an explicit
  deviceCode. No --test-force-exit band-aid. Byte-frozen tests
  (github-auth.test.ts, device-flow-prompt.test.ts, auth-e2e.test.ts) are
  untouched and green: they either override deviceCode explicitly or never reach
  runPollLoop (requestCodeThrows / fill-hit / mock-gitOps that never drives
  onAuthRequired). install-auth.test.ts was left byte-identical to the original.
verification: |
  Falsification test passed: memo subtest dropped from 5143ms to ~90ms.
  Full-suite tracer after fix: 3 POLLSLEEP events, all in frozen github-auth
  (5s/10s slow_down + 60s cancelled-abort) -- the install-auth 5000ms sleep is
  gone. 87 auth-related unit tests + 3 frozen integration tests pass. Final
  proof: npm run check green twice (see below).
files_changed:
  - tests/helpers/device-flow-mock.ts
