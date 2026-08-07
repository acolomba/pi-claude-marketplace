# Testing Patterns

**Analysis Date:** 2026-08-07

## Test Framework

**Runner:**
- Node's built-in `node:test` (no Jest/Vitest/Mocha) — 538 `*.test.ts` files across the repo
- No separate config file; invoked directly against glob patterns in `package.json` scripts
- TypeScript files run natively (no `tsx`/`ts-node` transpile step for tests — Node's native TS support is relied on; imports use explicit `.ts` extensions)

**Assertion Library:**
- `node:assert/strict` (`assert.equal`, `assert.deepEqual`, `assert.ok`, `assert.match`, `assert.rejects`, etc.)

**Run Commands:**
```bash
npm test                        # Unit tests: tests/{architecture,bridges,docs,domain,edge,helpers,orchestrators,persistence,platform,shared,transaction}/**/*.test.ts
npm run test:integration        # tests/integration/**/*.test.ts (separate script; check package.json for exact name)
npm run test:coverage           # Full coverage run: unit + integration + e2e, writes lcov to coverage/
npm run test:coverage:e2e       # PI_CM_E2E_REF=pinned node --test --experimental-test-coverage tests/e2e/**/*.test.ts
npm run test:coverage:integration
npm run check                   # typecheck && lint && format:check && test && test:integration (full CI gate)
TEST_CONCURRENCY=1 npm test     # Override test concurrency (env var respected by the test script)
```

## Test File Organization

**Location:**
- Fully separate top-level `tests/` directory (not co-located with source), mirroring the source layer structure:
  - `tests/domain/`, `tests/orchestrators/`, `tests/bridges/`, `tests/edge/`, `tests/platform/`, `tests/persistence/`, `tests/transaction/`, `tests/shared/`, `tests/architecture/`
  - Plus test-type directories that cut across layers: `tests/integration/`, `tests/e2e/`, `tests/live-uat/` (excluded from typed tree / `npm run check`; requires a real `pi` binary + sandbox), `tests/helpers/` (shared mocks/fixtures), `tests/fixtures/`

**Naming:**
- `<subject>.test.ts`, kebab-case, often prefixed with the feature area (`hooks-spawn-end-to-end.test.ts`, `git-failure-classifiers.test.ts`, `atomic-json.test.ts`)
- Some files carry an internal tracking tag in the name itself when tied to a specific spec sweep (`snm38-indent-ladder.test.ts`, `snm37-behavioral-smoke.test.ts`) — matches the durable-ID convention from CONVENTIONS.md, not a GSD phase reference

**Structure:**
```
tests/
├── architecture/     # Import-boundary / layering rule tests
├── bridges/          # Tests for bridges/{agents,mcp,hooks,commands,skills}
├── domain/           # Tests for domain/* (auth, manifest, resolver, components, ...)
├── e2e/               # End-to-end tests (may hit real git refs via PI_CM_E2E_REF)
├── edge/              # Tests for edge/{handlers,completions}
├── fixtures/          # Static test data (manifests, plugin trees, etc.)
├── helpers/           # Shared mock factories (credential-mock.ts, git-mock.ts, device-flow-mock.ts)
├── integration/       # Multi-module integration tests (race conditions, end-to-end hook dispatch)
├── live-uat/          # Standalone .mjs drivers requiring a real `pi` binary; excluded from lint/check
├── orchestrators/     # Tests for orchestrators/{reconcile,marketplace,plugin,import}
├── persistence/       # Tests for persistence layer (state.json, migration)
├── platform/          # Tests for platform/{git*, pi-api}
├── shared/            # Tests for shared/* utilities (errors, notify, atomic-json, fs-utils, ...)
└── transaction/       # Tests for the phase-ledger transaction system
```

## Test Structure

**Suite Organization:**
No `describe` blocks used in sampled files — flat, top-level `test()` calls with long, descriptive title strings that embed the requirement/decision ID:

```typescript
test("PROV-01 findProviderForHost('github.com') returns the GitHub descriptor", () => {
  const provider = findProviderForHost("github.com");
  assert.ok(provider, "expected a provider for github.com");
  assert.equal(provider.id, "github");
});

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
- **Title convention:** `<REQ-ID> <plain-English behavior description>` — titles double as living traceability documentation; grep `<REQ-ID>` across `tests/` to find all tests covering a requirement
- **Setup pattern:** temp directories via `mkdtemp(path.join(os.tmpdir(), "<prefix>-"))`, always cleaned up in a `finally` block with `rm(dir, { recursive: true, force: true })`
- **Assertion pattern:** every `assert.*` call includes a descriptive failure-message third argument (e.g. `` `unexpected JSON shape: ${JSON.stringify(got)}` ``) so CI failures are self-explanatory without re-running locally
- **File-level doc comment**: each test file opens with a `/** ... */` block explaining what's under test, which requirement IDs it covers, and any non-obvious rationale (e.g. why concurrency is tested via `Promise.all`)

## Mocking

**Framework:** No mocking library (no Sinon/jest.mock) — hand-rolled in-memory stub factories in `tests/helpers/`.

**Patterns:**
```typescript
// tests/helpers/credential-mock.ts
export interface MockCredentialState {
  store: Map<string, GitCredentials>;
  fillCalls: { host: string }[];
  approveCalls: { host: string; cred: GitCredentials }[];
  rejectCalls: { host: string; cred: GitCredentials }[];
  fillThrows?: Error;
  approveThrows?: Error;
  rejectThrows?: Error;
}
// makeMockCredentialOps(...) returns { ops: CredentialOps, state: MockCredentialState }
```
- Mock factories are named `makeMock<Subject>Ops` / `makeMock<Subject>` and return a handle exposing both the ops object (implementing the production interface) and an inspectable state object (call logs, in-memory store)
- Optional `*Throws?: Error` fields on the state let a test force a method to throw, simulating subprocess/IO failures without touching real subprocess/filesystem code
- `memfs` (in `devDependencies`) is available for in-memory filesystem mocking where a full `fs`-shaped mock is needed (used selectively — not in every test)
- Test helpers use **type-only imports** of production interfaces (`import type { CredentialOps } from "..."`) to avoid pulling runtime production code into pure-mock files — this is called out explicitly as deliberate discipline in `tests/helpers/credential-mock.ts`

**What to Mock:**
- External subprocess boundaries (git operations, credential helpers, device-flow HTTP) — anything crossing into `platform/`
- Never mock pure `domain/` logic; test it directly against real inputs

**What NOT to Mock:**
- Filesystem for simple JSON round-trips — real `mkdtemp`/`readFile`/`rm` against the OS temp dir is preferred over mocking `fs` when the test is fast and side-effect-free (see `atomic-json.test.ts`)
- Production error classes — tests assert on real `instanceof` checks against the actual `errors.ts` classes, not stand-ins

## Fixtures and Factories

**Test Data:**
- Static fixtures (sample manifests, plugin directory trees) live under `tests/fixtures/`
- Dynamic/in-memory fixtures are built inline per-test or via the `tests/helpers/*-mock.ts` factories described above

**Location:**
- `tests/fixtures/` for static data
- `tests/helpers/` for reusable mock/stub constructors

## Coverage

**Requirements:** Enforced via `npm run test:coverage` (`--experimental-test-coverage`), split into `unit`, `integration`, and `e2e` runs writing separate `lcov` files (`coverage/e2e.lcov`, `coverage/integration.lcov`, plus a unit variant) — no single blanket threshold observed in sampled scripts; check CI config for an enforced minimum.

**View Coverage:**
```bash
npm run test:coverage
# then inspect coverage/*.lcov, or open an lcov-html viewer against them
```

## Test Types

**Unit Tests:**
- `tests/{domain,shared,platform,edge,bridges,orchestrators,persistence,transaction,architecture}/` — fast, in-process, real filesystem via temp dirs or hand-rolled mocks for subprocess/network boundaries

**Integration Tests:**
- `tests/integration/` — cross-module flows: concurrent installs, hook dispatch end-to-end, load/reconcile races, auth end-to-end. Run as a separate `npm run test:integration` script and gated separately in `npm run check`.

**E2E Tests:**
- `tests/e2e/` — run with `PI_CM_E2E_REF=pinned` against real pinned git refs; separate coverage target (`test:coverage:e2e`)
- `tests/live-uat/` — standalone `.mjs` drivers requiring a real `pi` binary + sandbox; explicitly excluded from the typed source tree, ESLint, and `npm run check` (see `eslint.config.js` ignores)

## Common Patterns

**Async Testing:**
```typescript
test("concurrent writes serialize cleanly (NFR-1 -- write-file-atomic queue)", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "aj-"));
  try {
    const candidates = [{ i: 1 }, { i: 2 }, { i: 3 }, { i: 4 }, { i: 5 }];
    await Promise.all(candidates.map((c) => atomicWriteJson(file, c)));
    // assert final state is one of the candidates, never a partial write
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
```
- Concurrency/race tests fire multiple async operations via `Promise.all` and assert the final state is one complete, valid outcome — never a partial/corrupt intermediate state (matches NFR-1 atomic-write guarantees)

**Error Testing:**
- Assert on `instanceof <TypedErrorClass>`, then inspect the typed public fields (never substring-match `error.message`)
- Mock `*Throws?: Error` state fields simulate subprocess/IO failures at the exact seam under test

---

*Testing analysis: 2026-08-07*
