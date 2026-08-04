# Deferred Items — Phase 90

Out-of-scope discoveries surfaced during execution. NOT fixed here (executor
scope boundary: only auto-fix issues directly caused by the current task).

## 90-03 execution

- **Pre-existing environment failure (pi-subagents global peer):** two integration
  tests in `tests/integration/skill-path-resolution.test.ts` fail locally —
  `T-d8i-01` and `SC-2 / AGSK-06` — with
  `resolveSkillsWithFallback must resolve the generated skill by name via the
  emitted skillPath`. These tests resolve the `pi-subagents` peer from the GLOBAL
  npm install (`npm root -g`) and fail on a stale global version; they skip in CI
  (peer absent) and pass on a fresh global peer. Unrelated to the 90-03 install
  reason-classifier change (which touches only
  `orchestrators/plugin/install.ts::narrowResolverReasons`). The full unit suite
  (`npm test`) is green (3234 pass, 1 skip); typecheck + lint + format are green.
