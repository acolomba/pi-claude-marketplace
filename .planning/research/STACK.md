# Stack Research — v1.19 Unit Test Refactor

**Project:** pi-claude-marketplace
**Domain:** Brownfield TypeScript unit-test migration
**Researched:** 2026-08-28
**Confidence:** HIGH

## Recommendation

Keep the current production stack. Do not add a test framework or coverage
package. Use Node 24, `node:test`, `node:assert/strict`, and Node's built-in V8
coverage. Use `strong-mock` only for typed behavior-heavy ports.

Each executable plan and commit must own one production source file and its one
mirrored test file. Retained source or test commits are only the brownfield
baseline. They are never completion evidence for v1.19.

## Brownfield Baseline

The production root contains 204 TypeScript modules. The live pair audit at
`/tmp/pi-cm-pair-audit.CJWiph/results.tsv` reports:

| Pair result     |   Count | Meaning for v1.19                                         |
| --------------- | ------: | --------------------------------------------------------- |
| `PASS`          |      59 | Candidate baseline only. Reprove the pair in its plan.    |
| `COVERAGE_FAIL` |      83 | The mirrored test does not give complete direct coverage. |
| `MISSING`       |      60 | The mirrored test file is absent.                         |
| `TEST_FAIL`     |       2 | The mirrored test fails when it runs as the direct pair.  |
| **Total**       | **204** | All modules remain open until v1.19 records new proof.    |

The audit ran locally with Node 26.7.0. CI uses Node 24. Coverage closure must
run on Node 24 because V8 coverage data can change between Node releases.

## Recommended Stack

### Core Runtime and Language

| Technology         | Version         | Purpose                                            | Why                                                                                                                     |
| ------------------ | --------------- | -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Node.js            | CI 24.x         | Execute source and TypeScript tests                | This is the repository's current CI runtime. Node 24 includes stable `node:test` and native TypeScript type stripping.  |
| TypeScript         | 6.0.3 locked    | Strict static checks and structural script parsing | The repository already uses strict `NodeNext`, `noEmit`, and explicit `.ts` imports. No compiler migration is required. |
| ECMAScript modules | Native Node ESM | Production and test module system                  | `package.json` uses `type: module`. Source and tests already use explicit `.ts` relative imports.                       |

The product contract still states Node `>=20.19.0`. That floor does not define
the test migration runtime. Use Node 24 for reproducible v1.19 proof.

### Test and Mock Tools

| Technology                | Version                     | Purpose                                          | When to Use                                                                                                                      |
| ------------------------- | --------------------------- | ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| `node:test`               | Bundled with Node 24        | Test runner, per-test context, spies, and timers | Use for every mirrored unit test. Prefer `t.mock` and `t.mock.timers` for case-owned state.                                      |
| `node:assert/strict`      | Bundled with Node 24        | Assertions                                       | Assert public results, effects, protocol payloads, and error identity.                                                           |
| `strong-mock`             | 9.2.2 locked                | Typed mocks for behavior-heavy ports             | Use when exact calls, arguments, or call order are part of the public contract. Use `mock`, `when`, `verify`, and `exactParams`. |
| Real temporary filesystem | Node `fs`, `os`, and `path` | Filesystem behavior                              | Use fresh case-owned directories and real path semantics. Do not add an in-memory filesystem.                                    |

Use literal fakes for simple collaborators. Keep a fake in its concern-local
test module when several nearby tests share the same protocol. Do not create a
generic helper inventory that hides subjects, inputs, or expected values.

### Verification and Quality Tools

| Tool                    | Declared or locked version | Purpose                                   | v1.19 role                                                                           |
| ----------------------- | -------------------------- | ----------------------------------------- | ------------------------------------------------------------------------------------ |
| Node V8 coverage        | Bundled with Node 24       | Line, function, and branch coverage       | Enforce 100% for the paired production source during the paired test run.            |
| TypeScript compiler API | 6.0.3 locked               | Parse imports and exports                 | Power small fail-closed structural checks without another parser package.            |
| ESLint                  | 10.8.1 locked              | Typed lint and architecture boundaries    | Keep the current strict configuration. Test relaxations remain narrow.               |
| Fallow                  | 3.17.0 locked              | Dead-code, health, and duplication checks | Enable production dead-code analysis without using tests as production reachability. |
| Prettier                | 3.9.6 locked               | Formatting                                | Keep the existing format gate.                                                       |
| SonarQube input         | Existing LCOV flow         | Aggregate repository reporting            | Keep for project reporting. Do not use aggregate coverage as pair proof.             |

There is no database or service infrastructure for this milestone. Tests must
stay local and deterministic. Unit tests must not use the network, user state,
or project state outside their temporary directory.

## Installation

No new package is required.

```bash
npm ci
```

Do not add Jest, Vitest, Sinon, c8, nyc, or a filesystem emulator. Each would
duplicate a capability that the current stack already provides.

## Compiler Configuration

Keep these existing choices:

- `strict: true`
- `module: "NodeNext"`
- `moduleResolution: "NodeNext"`
- `noEmit: true`
- `allowImportingTsExtensions: true`
- `exactOptionalPropertyTypes: true`
- `noUncheckedIndexedAccess: true`

Add these checks during v1.19:

```json
{
  "erasableSyntaxOnly": true,
  "verbatimModuleSyntax": true
}
```

Node's TypeScript runtime removes erasable types and ignores `tsconfig.json`.
These options make `tsc` reject syntax and import forms that native execution
cannot handle safely. A validation run with both flags already passes at HEAD.

Do not add `rewriteRelativeImportExtensions`. This project uses `noEmit`, and
both source and test files already use explicit `.ts` extensions.

## Direct Pair Mechanics

The existing scripts are useful retained foundations. They are not v1.19
completion proof until the milestone revalidates their rules and negative
controls.

### Correspondence and Direct Import

`scripts/check-corresponding-tests.mjs` derives this mapping:

```text
extensions/pi-claude-marketplace/<path>/<name>.ts
                       ↓
tests/<path>/<name>.test.ts
```

It uses the TypeScript compiler API to read static imports and exports. It then
requires the mirrored test to import its production source directly.

Keep the source-to-test rule. Refine the reverse rule before using the script
as a closure gate. The current rule labels every unmatched unit-test file as
unexpected. This conflicts with valid concern-local fake and contract modules.
Support tests may exist, but they must not replace the mirrored test or own its
direct coverage proof.

Static import validation proves module ownership. It does not prove that the
test calls every public export. The direct coverage gate and pair review must
provide that evidence. Type-only modules and intentional barrels need explicit,
small rules instead of a general exemption register.

### Direct Coverage

`scripts/test-coverage-direct.mjs` runs only the mirrored test in a child Node
process. It reads LCOV for exactly the paired source record and requires:

```text
BRH = BRF
FNH = FNF
LH  = LF
```

The gate fails when the pair, source record, or full branch, function, or line
coverage is missing. A type-only source may omit an LCOV record only when its
transpiled runtime output is the empty `export {}` module.

During migration, always pass the production source explicitly. The no-argument
mode selects all changed files from the merge base. That scope crosses pair
boundaries and is not valid proof for a one-pair plan.

```bash
npm run test:coverage:direct -- \
  extensions/pi-claude-marketplace/<path>/<name>.ts
```

Node also offers native line, branch, and function thresholds. Keep the LCOV
record check because a pair test can import dependencies. The milestone must
prove exactly one paired source record, including missing-record failures.

### Negative Controls

The retained negative scripts currently pass, but their coverage is incomplete.
Keep planted failures for correspondence and direct coverage. Add a focused
negative control for each fail-closed class:

- missing mirrored test
- wrong direct import
- invalid or outside-root path
- missing non-type source record
- duplicate paired-source record
- incomplete line, function, and branch coverage
- valid type-only source without runtime statements

Do not use baseline counts. A newly introduced violation must fail even when
the total count does not change.

## Fallow Configuration

The current `.fallowrc.json` sets `production` to `false`. Replace that setting
during v1.19 with:

```json
{
  "production": {
    "deadCode": true,
    "health": false,
    "dupes": false
  }
}
```

This catches exports that exist only for tests without treating every test call
as production reachability. Do not add a broad `ignoreExports` list. Use a
narrow documented suppression only for a real runtime API that static analysis
cannot discover.

## Command Contract

### Every Pair Plan

Use the mirrored test path and source path explicitly:

```bash
node --test tests/<path>/<name>.test.ts
npm run test:coverage:direct -- \
  extensions/pi-claude-marketplace/<path>/<name>.ts
npm run check
```

The executable plan and commit contain one production source and its mirrored
test. A necessary configuration or gate correction may travel with that pair.
Do not batch several pairs into one plan or commit.

### Milestone Closure

After every pair passes, run the global gates on Node 24:

```bash
npm run test:corresponding
npm run test:coverage:direct:all
npm run check
```

The current `npm run check` does not call the correspondence or direct-coverage
gates. Add both global gates to `check` only when all pairs pass, so the required
quality command stays green throughout the migration. Make this change with the
final pair, not in a separate tooling-only executable plan.

Direct-all starts one coverage process per source pair. Measure its Node 24 CI
duration before closure. If it exceeds the 15-minute CI timeout, use bounded
child-process concurrency. Keep one isolated LCOV directory per pair and one
in-memory result list. Do not restore coverage shards or reconciliation files.

## Test Implementation Guidance

For each pair:

1. Trace production callers and public effects before changing code.
2. Import the production source directly from the mirrored test.
3. Create the subject and mutable collaborators inside each test case.
4. Use Arrange, Act, Assert sections in that order.
5. Cover meaningful success, failure, and boundary behavior.
6. Verify exact port calls when interaction is part of the contract.
7. Use a fresh temporary directory for every filesystem case.
8. Assert public behavior, not private constants, regular expressions, or file layout.
9. Run the focused test, explicit direct coverage, and normal quality gate.
10. Record new v1.19 evidence before marking the pair complete.

Do not use process-wide `mock` state from `node:test`. Do not use global
`verifyAll`, `resetAll`, or shared mutable mock instances. Do not add a
test-only production export. If code is hard to test, improve its real runtime
seam through the pair plan.

## Alternatives Considered

| Category             | Recommended                                    | Alternative                     | Why Not                                                                                                                                     |
| -------------------- | ---------------------------------------------- | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Test runner          | `node:test`                                    | Jest or Vitest                  | The built-in runner already executes this native ESM TypeScript repository. Another runner adds configuration and competing mock semantics. |
| Coverage             | Node V8 coverage plus exact LCOV record checks | c8 or nyc                       | Node already produces the needed line, function, and branch data. Pair ownership still needs repository-specific record validation.         |
| Simple doubles       | Literal fakes and `t.mock`                     | Sinon                           | Existing tools cover simple stubs, spies, and timers without a dependency.                                                                  |
| Behavior-heavy ports | `strong-mock`                                  | Untyped hand-written mocks      | The installed library preserves interface types and provides explicit interaction verification.                                             |
| Filesystem tests     | Real case-owned temporary directories          | memfs                           | Real paths, permissions, renames, and cleanup behavior are part of this product's contracts.                                                |
| Direct import checks | TypeScript compiler API                        | Regex or runtime module loaders | The compiler API reads ESM syntax reliably. Runtime module replacement would weaken direct ownership.                                       |

## Explicit Non-Choices

Do not restore or create:

- historical coverage shards, matrices, reconciliation files, or baselines
- mirrored-test exemption registers or ownership registries
- adapter participation scanners or preservation checkers
- generic helper directories that conceal the tested subject or expected values
- module-mocking loaders or process-wide mock state
- test-only production exports
- migration-history comments or historical module partitions
- the abandoned handoff patch or any patch-application mechanism

Aggregate test success and Sonar coverage remain useful repository signals.
They cannot prove that one mirrored test directly owns one production source.

## Risks and Mitigations

| Risk                                                        | Evidence at HEAD                                                                                                 | Mitigation                                                                                                          |
| ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Coverage differs by Node and V8 version.                    | Local audit used Node 26.7.0, while CI uses Node 24.                                                             | Treat Node 24 output as the closure result.                                                                         |
| The advertised Node floor conflicts with current tools.     | Fallow 3.17 requires Node 22 or newer. `write-file-atomic` 8 requires newer Node 22, Node 24, or Node 26 ranges. | Track runtime-floor alignment outside the pair migration. Do not silently expand v1.19 into a dependency migration. |
| Coverage APIs remain experimental.                          | Node 24 documents test coverage as experimental.                                                                 | Pin CI to Node 24 for the milestone and retain planted negative controls.                                           |
| The global correspondence gate rejects valid support tests. | The live run reports 43 unmatched test files in addition to pair defects.                                        | Make enforcement source-driven and define a narrow support-test rule.                                               |
| Direct-all can exceed CI time.                              | It launches up to 204 isolated child processes.                                                                  | Measure first. Add bounded concurrency only when the Node 24 timing requires it.                                    |
| Existing pair tests can pass in the suite but fail alone.   | The live audit reports two `TEST_FAIL` pairs.                                                                    | Require focused isolated execution for every pair.                                                                  |
| Old structure can distort the refactor.                     | The handoff explicitly retires old partitions and patch mechanisms.                                              | Design each pair from current callers and behavior. Write comments only for current invariants.                     |

## Roadmap Implications

- Start future work at Phase 108.
- Use Phase 108 to revalidate the small gates and complete its first source-test pair.
- Use one source-test pair per later executable plan and commit.
- Order pairs by present dependencies and risk, not by retired phase boundaries.
- Enable the two global gates in `npm run check` with the final pair.
- End with Node 24 correspondence, direct-all, and normal quality-gate evidence.

## Sources

### Repository Evidence

- `package.json`, `package-lock.json`, `tsconfig.json`, and `.fallowrc.json` at HEAD
- `.github/workflows/ci.yml` and `.github/workflows/sonarqube.yml` at HEAD
- `scripts/check-corresponding-tests.mjs` and its negative control at HEAD
- `scripts/test-coverage-direct.mjs` and its negative control at HEAD
- `docs/guidelines/typescript-unit-testing-guidelines.md`
- `.claude/rules/typescript-unit-testing.md`
- `.planning/inputs/unit-test-refactor-handoff/START-HERE.md` and linked handoff decisions
- `/tmp/pi-cm-pair-audit.CJWiph/results.tsv`

### Official Documentation

- [Node.js test runner](https://nodejs.org/docs/latest-v24.x/api/test.html)
- [Node.js TypeScript support](https://nodejs.org/docs/latest-v24.x/api/typescript.html)
- [Node.js command-line coverage options](https://nodejs.org/docs/latest-v24.x/api/cli.html)
- [TypeScript `allowImportingTsExtensions`](https://www.typescriptlang.org/tsconfig/allowImportingTsExtensions.html)
- [TypeScript module resolution](https://www.typescriptlang.org/tsconfig/moduleResolution.html)
- [Fallow configuration](https://fallow.tools/docs/configuration/overview/)
- [`strong-mock` documentation](https://github.com/NiGhTTraX/strong-mock)

Repository findings have HIGH confidence because they come from HEAD and live
commands. External behavior has MEDIUM confidence under the research provider
classification, even though the cited pages are primary documentation.
