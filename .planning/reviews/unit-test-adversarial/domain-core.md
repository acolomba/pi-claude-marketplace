# Domain — manifest, source, auth, naming

**Scope:** `tests/domain/{github-auth,source,manifest-cache,name,manifest,version,plugin-root,clone-key,manifest-lookup,auth-registry}.test.ts`, `tests/domain/device-flow-{contract.ts,fake.ts,fake.test.ts}`, and the paired `extensions/pi-claude-marketplace/domain/*.ts` modules (excluding `resolver.ts` and `components/`).
**Test files reviewed:** 13
**Production modules reviewed:** 10

## Summary

This area is the healthiest slice of the domain layer: every production module has exactly one paired test module, coverage is data-driven with one `test()` per row, expected values are independent literals (never computed by re-running the production formatter/hasher), errors are asserted by `instanceof` and structured fields, and every filesystem case uses a fresh `mkdtemp` with `t.after()` cleanup. The GitHub Device Flow shared-adapter contract (`device-flow-contract.ts`) is a model implementation of the pattern: it is invoked from both the fake's test and the real fetch-backed adapter's test, and a deliberately broken fake is proven to fail exactly one contract case with an independently written expectation. No BLOCKER findings came out of this sweep. The few WARNINGs cluster around three things a fixing pass should prioritize: (1) `manifest-cache.test.ts` uses a `t.mock.fn()` stub with manual call-count/argument assertions everywhere a `strong-mock` interaction mock is the tool the project has standardized on for this exact role; (2) a fixture directory (`tests/domain/fixtures/hash-stability/`) is orphaned — no test anywhere references it; (3) `github-auth.ts`'s poll-loop deadline reads `Date.now()` inline instead of taking the same kind of injectable seam already used for `waitForPoll`.

## Unit test findings

### `tests/domain/manifest-cache.test.ts`

- **[WARNING] Stub-with-call-count-assertions should be a `strong-mock` interaction mock** — `lines 27–44` (representative; the same shape repeats at `46–67`, `74–91`, `104–129`, `131–158`, `160–185`, `187–218`, `220–247`, `249–282`, `284–313`, `315–360`, `362–388`, `390–440` — all 13 cases in the file).
  Every case builds `load` with `t.mock.fn<ManifestLoader>(...)` and then asserts `load.mock.callCount()` and `load.mock.calls[n]?.arguments` by hand (e.g. lines 42–43). `ManifestLoader` is exactly the kind of injected, side-effecting collaborator the project mocks with `strong-mock` elsewhere (see `NotifyFn`/`DeviceFlowHttp` in `tests/domain/github-auth.test.ts`), and the call count here is not incidental — it is the only thing that discriminates "cached, did not reload" from "reloaded but happened to return the same object" (a broken always-reload implementation would still pass the `assert.strictEqual(x, marketplaceManifest)` checks because the loader always resolves to the same literal object). That makes this a textbook "stub whose call count is asserted" per the test-doubles rule, just not a vacuous one. Convert `load` in every case to `mock<ManifestLoader>({ exactParams: true, name: "load" })`, replace `t.mock.fn`'s canned resolution with `when(() => load(manifestPath)).thenResolve(...)` / `.thenReject(...)` (use `load.mockImplementationOnce`-style call-ordering via separate `when()` expectations keyed by argument, since `strong-mock` does not sequence by call index the way `t.mock.fn().mock.mockImplementationOnce` does — for the tests that vary the response by call order (e.g. `reloads a successful entry after its size changes`), express the two expected calls as two `when()` statements against the same arguments if `strong-mock` supports FIFO consumption, or fall back to the project's own documented pattern for order-sensitive mocks: "each promised method is replaced by a recorder pushing into one shared log, the whole log is compared, and every mock is still verified"), and add `verify(load)` at the end of each case instead of the manual `callCount`/`calls[...].arguments` assertions.

### `tests/domain/device-flow-contract.ts`

- **[WARNING] "overwrite" contract category is neither covered nor recorded as inapplicable** — `lines 61–63`, `152–387`.
  The project's shared-adapter-contract rule calls out six categories a contract should cover or explicitly excuse: missing values, aliasing, overwrite, ordering, deletion, validation. This file explicitly and correctly records why "validation" does not apply (lines 61–63), and clearly covers missing values (`reports a request-code failure`), aliasing (`copies the device-code response before use`, `copies polling responses before use`), ordering (`consumes polling responses in order`), and a deletion/reset analogue (`resets queued state between fresh participants`). "Overwrite" (e.g. issuing a fresh scenario against a participant whose queued poll responses were only partially consumed, or re-running `run()` twice on the same participant) has no case and no comment saying why it does not apply to this contract's shape. Add either a short comment next to the existing validation note stating why overwrite is inapplicable to a single-shot device-flow run, or add a case exercising it (e.g., asserting that calling `.run()` twice on the same `DeviceFlowContractParticipant` is unsupported/undefined vs. that a second `createDeviceFlow(...)` call is required for fresh state, which the existing "resets queued state between fresh participants" case only partially shows for two *different* participants sharing one `contractScenario` object).

### `tests/domain/device-flow-fake.test.ts`

- **[WARNING] Vestigial meta-test of the contract's own case-name list** — `lines 6`, `72–81`.
  `DEVICE_FLOW_CASE_NAMES` is exported from `device-flow-contract.ts` purely as a hand-copied literal of the case names already present in `deviceFlowContractCases`, and its only consumer anywhere in the repo is this test, which asserts the two lists are equal. This is a meta-test of test-support content ("Test support (fakes, seeds, contracts) needs no meta-tests"): it does not exercise `createDeviceFlowFake` or `initiateDeviceFlow` behavior, and a wrong Device Flow implementation could not fail it — only a hand-edit drift between two lists defined in the same file could. Delete the `DEVICE_FLOW_CASE_NAMES` export from `device-flow-contract.ts` and this test; nothing else in the tree depends on it (confirmed by search — its only references are this export and this one test).

### `tests/domain/fixtures/hash-stability/`

- **[WARNING] Orphaned fixture directory, unreferenced by any test** — `tests/domain/fixtures/hash-stability/sample-plugin/`, `sample-lf/`, `sample-crlf-bom/`.
  This tree (a `plugin.json`, `skills/foo.md`, a `.git/HEAD`, a `.DS_Store`, plus LF/CRLF+BOM sample files) looks purpose-built to pin `computeHashVersion`'s stability contract against a *committed* fixture — which would additionally guard against git itself normalizing line endings on checkout, something the inline `mkdtemp` scenarios in `tests/domain/version.test.ts` cannot detect since they write bytes directly with `writeFile`. No test file in the repository (`tests/domain/version.test.ts` included, and `tests/domain/resolver.test.ts`, which uses a *different* `tests/fixtures/` directory) reads any file under this path. Either wire it into a `version.test.ts` case that reads the fixture path with `readFile`/`computeHashVersion` and asserts a recorded literal hash (matching the brief's stability-fixture intent), or delete the orphaned directory.

### Clean files

- `tests/domain/auth-registry.test.ts`
- `tests/domain/clone-key.test.ts`
- `tests/domain/manifest-lookup.test.ts`
- `tests/domain/name.test.ts`
- `tests/domain/plugin-root.test.ts`
- `tests/domain/source.test.ts`
- `tests/domain/version.test.ts`
- `tests/domain/manifest.test.ts`
- `tests/domain/github-auth.test.ts` — thorough and exemplary: consistent `strong-mock` usage (`exactParams: true`, exact `when()` args, `verify()` on every mock at case end), correct fake-timer usage only where scheduling itself is the behavior, `t.mock.method(globalThis, "fetch", ...)` returning a fresh `Response` per call, and the shared device-flow contract registered against the real fetch-backed adapter.
- `tests/domain/device-flow-fake.ts`

## Production code findings

### `extensions/pi-claude-marketplace/domain/github-auth.ts`

- **[WARNING] Inline `Date.now()` in the poll deadline is a hidden dependency** — `lines 354, 356`.
  `runPollLoop` computes `const deadlineMs = Date.now() + deviceCode.expires_in * 1000;` and loops on `while (Date.now() < deadlineMs)`. `waitForPoll` right next to it is already an injected, overridable dependency (`opts.waitForPoll ?? waitForPoll`) specifically so tests can control scheduling; the wall clock is not given the same treatment. Today's timeout test (`times out without polling after the device code expires`) only works because real time is monotonic and `expires_in: 0` collapses the window to zero — it cannot express "the deadline is 30 seconds out and an injected clock advances past it" without a real `setTimeout`/`t.mock.timers` dance. Add a `now?: () => number` field to `InitiateDeviceFlowOpts` (default `Date.now`), thread it into `runPollLoop`, and use it for both the deadline computation and the loop condition — the same "make the hidden dependency an explicit parameter" fix already applied to `waitForPoll`.
- **[WARNING] `InitiateDeviceFlowOpts` and `DeviceFlowResult` fields are not `readonly`** — `lines 117–136`, `144–146`.
  Every other domain result/options shape in this area (`GitAuthProvider`, `ParsedSource` variants, `ManifestLookup`) marks its fields `readonly`; these two do not, and neither is ever intentionally mutated by a test the way `DeviceCodeResponse`/`PollResult` deliberately are (those two must stay mutable for the "copies ... before use" aliasing tests in `device-flow-contract.ts`). Mark `InitiateDeviceFlowOpts` and `DeviceFlowResult`'s members `readonly` for consistency with the rest of the domain layer; this does not affect `DeviceCodeResponse`/`PollResult`, which need to stay mutable.

### Clean files

- `extensions/pi-claude-marketplace/domain/auth-registry.ts`
- `extensions/pi-claude-marketplace/domain/clone-key.ts`
- `extensions/pi-claude-marketplace/domain/manifest-cache.ts` — good example of the sanctioned design: factory-owned `Map`, no module-level mutable state, no test-only reset hook.
- `extensions/pi-claude-marketplace/domain/manifest-lookup.ts`
- `extensions/pi-claude-marketplace/domain/manifest.ts` — its module-level `manifestCache` singleton is the deliberate, documented (D-01) result of already applying the "extract a coherent module" fix, not an untreated hidden dependency.
- `extensions/pi-claude-marketplace/domain/name.ts`
- `extensions/pi-claude-marketplace/domain/plugin-root.ts`
- `extensions/pi-claude-marketplace/domain/source.ts`
- `extensions/pi-claude-marketplace/domain/version.ts`

## Not covered

- No toolchain commands were run (`node --test`, `npm run check`, coverage), per this sweep's diagnostic-review constraint; coverage-percentage claims above are based on reading, not measurement.
- `domain/components/*` and `tests/domain/components/` were out of scope per the assignment and not opened.
- `domain/resolver.ts` and `tests/domain/resolver.test.ts` are out of scope (owned by another reviewer) and were not opened, except for the one grep needed to confirm it does not reference `tests/domain/fixtures/hash-stability/`.
