# Testing Patterns

**Analysis Date:** 2026-08-18

## Test Framework

**Runner:**
- Node's built-in test runner (`node:test`), invoked via `node --test`
- No third-party test framework (no Jest, Vitest, Mocha)

**Assertion Library:**
- `node:assert/strict`

**Run Commands:**
```bash
npm test                 # unit-ish suite: tests/{architecture,bridges,domain,edge,helpers,orchestrators,persistence,platform,shared,transaction}/**/*.test.ts
npm run test:integration # tests/integration/**/*.test.ts
npm run test:e2e         # tests/e2e/**/*.test.ts (PI_CM_E2E_REF=pinned)
npm run test:coverage    # runs unit + integration + e2e each with --experimental-test-coverage, emits coverage/{unit,integration,e2e}.lcov
npm run check            # typecheck && lint && fallow && format:check && test && test:integration (npm test does NOT include e2e)
```

`TEST_CONCURRENCY` env var, when set, is threaded into every `node --test` invocation as `--test-concurrency=$TEST_CONCURRENCY`.

## Test File Organization

**Location:** separate `tests/` tree, not co-located with source. Mirrors the `extensions/pi-claude-marketplace/` layer structure one-to-one.

**Verified directory listing of `tests/` (2026-08-18):**
```
tests/
├── architecture/     # architectural boundary/gate tests (grep/AST-scan the source tree)
├── bridges/
├── domain/
├── edge/
├── e2e/              # separate script (test:e2e), not part of `npm test`
├── fixtures/         # static JSON/data fixtures consumed by tests; NO .test.ts files here
├── helpers/          # shared mocks/utilities; contains its own tests (e.g. source-scan.test.ts)
├── integration/      # separate script (test:integration), not part of `npm test`
├── live-uat/         # standalone operator-run .mjs drivers, NOT .test.ts, excluded from the typed tree and from ESLint's typed project
├── orchestrators/
├── persistence/
├── platform/
├── shared/
└── transaction/
```
There is **no `tests/docs` directory** — do not reference one. `tests/fixtures/` and `tests/live-uat/` hold zero `.test.ts` suites; `live-uat/*.mjs` are standalone command-line drivers, each invoked directly with `node tests/live-uat/<file>.mjs`, never imported by any module (each carries a `fallow-ignore-file unused-file` marker for that reason).

**Verified counts (2026-08-18):**
- 230 total `.test.ts` files under `tests/`
- 214 of those fall under the `npm test` glob (`architecture,bridges,domain,edge,helpers,orchestrators,persistence,platform,shared,transaction`)
- 10 under `tests/integration/`
- 6 under `tests/e2e/`

**Naming:**
- `<subject>.test.ts`, e.g. `atomic-json.test.ts` for `shared/atomic-json.ts`, `import-boundaries.test.ts` for the architecture gate it enforces
- Test titles cite durable spec IDs inline (`NFR-1`, `AS-1`, `D-03`, `PI-2`) as traceability anchors — never GSD process artifacts like "Phase 12" or "Wave 3"

## Test Structure

**Suite Organization** (flat `test()` calls, no `describe` nesting — `node:test`'s `test()` is used directly):
```typescript
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { atomicWriteJson } from "../../extensions/pi-claude-marketplace/shared/atomic-json.ts";

test("happy path: write succeeds with 2-space indent + trailing newline (AS-1)", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "aj-"));
  try {
    const file = path.join(dir, "out.json");
    await atomicWriteJson(file, { ok: true, n: 7 });
    const got = await readFile(file, "utf8");
    assert.equal(got, '{\n  "ok": true,\n  "n": 7\n}\n', `unexpected JSON shape: ${JSON.stringify(got)}`);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
```

**Patterns:**
- Setup/teardown: `mkdtemp` a real temp directory per test (not shared across tests), `finally { await rm(dir, { recursive: true, force: true }) }` — always real filesystem, never an in-memory fs mock
- Assertion: `assert.equal`/`assert.deepEqual`/`assert.ok`/`assert.rejects` from `node:assert/strict`, with an explicit failure-message third argument when the raw diff would be unhelpful (e.g. `` `unexpected JSON shape: ${JSON.stringify(got)}` ``)
- Concurrency/race testing: `Promise.all` over multiple candidate writes to the same path, then assert the final on-disk state is one complete valid candidate, never a torn write

## Mocking

**Framework:** No mocking library (no Sinon, no `node:test`'s built-in mock). All test doubles are hand-written factory functions in `tests/helpers/`.

**Patterns** (`tests/helpers/credential-mock.ts`, mirroring `tests/helpers/git-mock.ts`):
```typescript
export interface MockCredentialState {
  store: Map<string, GitCredentials>;
  fillCalls: { host: string }[];
  approveCalls: { host: string; cred: GitCredentials }[];
  rejectCalls: { host: string; cred: GitCredentials }[];
  fillThrows?: Error;
  approveThrows?: Error;
  rejectThrows?: Error;
}
```
- Closure-scoped state object, exposing a `state` handle tests can assert against directly (call logs, throw overrides) and a `CredentialOps`-shaped object satisfying the production interface
- `makeMock*` factory naming (`makeMockCredentialOps`, `makeMockGitOps`, `makeMockDeviceFlowHttp`)
- Mocks are **pure in-memory**: no filesystem ops, no environment mutation, no subprocess spawn — explicitly called out in the header comment for `credential-mock.ts` ("credential mocks do NOT need a real keychain backend")
- Mocks import production types with `import type` only, so the mock file never pulls runtime production code into a test-helper module (deliberate discipline noted in the file header, applied even though the ESLint platform import boundary only constrains production code)
- Throw-simulation is opt-in per call (`fillThrows?: Error`, etc.) so a test can exercise its own try/catch around a specific seam (e.g. simulating ENOENT or a subprocess timeout) without a full mocking-library API

**What to Mock:**
- External subprocess/network/credential-store boundaries: `git` operations (`GitOps`), OS credential helper subprocess calls (`CredentialOps`), device-flow HTTP calls (`DeviceFlowHttp`)

**What NOT to Mock:**
- The filesystem for state/config I/O — tests use real `mkdtemp` temp directories throughout, never an in-memory fs layer (confirmed: no `withHermeticHome`-style fs-mocking helper exists in `tests/helpers/`; each test manages its own real temp dir and cleans it up in `finally`)
- Production modules under test — dependency injection is used instead of module-mocking/monkey-patching; see CONVENTIONS.md's "Dependency injection over test-only seams" for the underlying principle (`bridges/hooks/routing-state.ts` is the non-test worked example of the same discipline)

**Public-interface testing philosophy:** tests are written against a module's exported public interface, not against internals reached by exporting them solely "for test." When testing a unit is hard through its public surface, that difficulty is treated as signal that an inner concern wants to be extracted into its own module (with its own public interface) — not a reason to widen the original module's exports to satisfy a test. Passing a dependency (e.g. `spawn`, `gitOps`, `credentialOps`) into a function as a parameter is the sanctioned way to make that dependency testable, because it becomes part of the function's real public interface rather than a back door; a module-global `_setSpawnForTest`-style seam is the anti-pattern this guards against.

## Fixtures and Factories

**Test Data:**
- Static JSON/data fixtures live under `tests/fixtures/` (e.g. `tests/fixtures/hookify-hooks.json`, `tests/fixtures/hooks-notification-only.json`, `tests/fixtures/ralph-wiggum-hooks.json`), plus nested fixture directories like `tests/fixtures/bad-imports/` and `tests/fixtures/import-command/`
- Programmatic seed helpers, e.g. `tests/helpers/marketplace-seed.ts`, build in-memory or on-disk marketplace/plugin structures for a test to install/reconcile against

**Location:**
- `tests/fixtures/` for static data; `tests/helpers/` for both mocks and seed-building functions (helpers has its own `.test.ts` file, `tests/helpers/source-scan.test.ts`, testing the helper logic itself — e.g. `source-scan.ts`'s `stripComments`/`assertNoForbiddenSurface` used by the architecture gates)

## Coverage

**Requirements:** Not gated in `npm run check` — `test:coverage` is a separate script, not part of the `check` chain. Coverage feeds SonarCloud (`sonar-project.properties`) rather than acting as a local pass/fail gate.

**View Coverage:**
```bash
npm run test:coverage
# emits coverage/unit.lcov, coverage/integration.lcov, coverage/e2e.lcov
```

**Caveat — fallow does not compute usable coverage/CRAP data for this repo:** `fallow health`'s `maxCrap: 0` threshold is nominally set, but CRAP scoring needs Istanbul-format JSON coverage, and fallow rejects `lcov` input. Node's `c8`-style coverage output also emits `-1` columns in places, which get silently clamped to zero and zero out coverage for many files if fed through naively. Treat `maxCrap` as inert in practice; `maxCyclomatic`/`maxCognitive`/`maxUnitSize` are the load-bearing fallow health thresholds (see CONVENTIONS.md).

## Test Types

**Unit Tests:**
- The bulk of `tests/{bridges,domain,edge,helpers,orchestrators,persistence,platform,shared,transaction}/` — exercise a single module's exported functions against real temp-directory filesystem state and injected mocks for external boundaries

**Architecture Tests:**
- `tests/architecture/` — a distinct category from unit tests: source-tree grep/AST scans (`tests/helpers/source-scan.ts`'s `assertNoForbiddenSurface`, `stripComments`) or programmatic config introspection (loading `eslint.config.js` at test time) that assert structural invariants hold across the whole codebase, e.g. `tests/architecture/no-orchestrator-network.test.ts` (NFR-5: no orchestrator file may import `gitOps`/`platform/git` except the exempted `clone-cache.ts` seam) and `tests/architecture/import-boundaries.test.ts` (D-11/D-21-02: the layered import matrix, the ledger-to-ledger directed-edge ban, and an ALLOWLIST over the `fallow dead-code` invocation's tokens -- the `import-x/no-cycle` rule it used to pin was removed after being measured inert, and cycles are now gated by that bare fallow run)

**Integration Tests:**
- `tests/integration/` (10 files, `npm run test:integration`) — exercise multiple layers together (e.g. full install/uninstall ledgers against real temp-directory scope roots) without a live network dependency

**E2E Tests:**
- `tests/e2e/` (6 files, `npm run test:e2e`) — exercise the extension against a real upstream ref, selected via `PI_CM_E2E_REF` (`pinned` or `main`); run with `--experimental-test-coverage` under `test:coverage:e2e`

**Live UAT (not a `.test.ts` category):**
- `tests/live-uat/*.mjs` — standalone, human-invoked scripted drivers (e.g. `manifest-absence-canary.mjs`, `stop-canary.mjs`) that exercise the extension against a live Pi process end-to-end; run manually via `node tests/live-uat/<file>.mjs`, never picked up by any `npm test*` script or import graph

## Common Patterns

**Async Testing:**
```typescript
test("concurrent writes serialize cleanly (NFR-1 -- write-file-atomic queue)", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "aj-"));
  try {
    const candidates = [{ i: 1 }, { i: 2 }, { i: 3 }, { i: 4 }, { i: 5 }];
    await Promise.all(candidates.map((c) => atomicWriteJson(file, c)));
    // assert final state is exactly one complete candidate, never a torn write
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
```

**Error Testing:**
- Mocks' `*Throws?: Error` override fields (see Mocking above) let a test force a specific failure mode through the injected seam, then assert the caller's typed error class and its structured fields (`instanceof`, never message-substring matching — mirrors the production discrimination convention in CONVENTIONS.md)

---

*Testing analysis: 2026-08-18*
