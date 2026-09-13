# Phase 1: Live Evidence Revalidation - Pattern Map

**Mapped:** 2026-09-04
**Files analyzed:** 8 new/modified files
**Analogs found:** 8 / 8

## Authority and Search Notes

This map uses the live indexed tree. CodeGraph was queried before textual search and direct reads. The files under `.planning/codebase/` are dated, pre-v1.19 discovery maps; they are locator hints only and are not analog authorities. Every analog named below was verified with `git ls-files` on 2026-09-04. No `.gsd/` install/runtime mirror is referenced.

## File Classification

| New/Modified File | Role | Data Flow | Closest Tracked Analog | Match Quality |
|---|---|---|---|---|
| `scripts/revalidation.mjs` | utility / CLI validator-renderer | file-I/O, transform, batch | `scripts/check-corresponding-tests.mjs` plus `.planning/inputs/unit-test-refactor-handoff/check-preservation-kit.mjs` | exact composite |
| `scripts/revalidation.negative.mjs` | test fixture / negative-control runner | file-I/O, batch | `scripts/check-corresponding-tests.negative.mjs` | exact |
| `tests/architecture/revalidation.test.ts` | architecture test | file-I/O, request-response | `tests/architecture/unit-suite-glob-completeness.test.ts` plus `tests/architecture/source-scan.test.ts` | exact composite |
| `.planning/phases/01-live-evidence-revalidation/01-REVALIDATION.json` | config / canonical data model | CRUD, batch | `.planning/inputs/unit-test-refactor-handoff/BASELINE.yaml` as validated by `check-preservation-kit.mjs` | role-match |
| `.planning/phases/01-live-evidence-revalidation/01-REVALIDATION.md` | generated report | transform, file-I/O | generated preservation-kit artifacts checked by `check-preservation-kit.mjs` | role-match |
| `.planning/phases/01-live-evidence-revalidation/01-REVALIDATION-SCHEMA.md` | config / protocol document | transform | `.planning/inputs/unit-test-refactor-handoff/BEHAVIOR-CONTRACTS.yaml` validation pattern | role-match |
| `.planning/REQUIREMENTS.md` | config / planning contract | transform, batch | current `.planning/REQUIREMENTS.md` | self-pattern |
| `.planning/ROADMAP.md` | config / planning contract | transform, batch | current `.planning/ROADMAP.md` | self-pattern |

The 110 corpus Markdown files are inputs, not an upfront modification set. D-04 permits correcting one during review, but any such correction must reopen that file; planners should not predeclare all corpus files as modified.

## Pattern Assignments

### `scripts/revalidation.mjs` (utility / CLI validator-renderer, file-I/O + transform)

**Primary analog:** `scripts/check-corresponding-tests.mjs`

**Imports and repository-root pattern** (lines 1-10):

```javascript
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const defaultProjectRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
```

Copy the module-relative root derivation and accept an injected project root for hermetic validation. Do not depend on the caller's current directory.

**Deterministic inventory pattern** (lines 16-26):

```javascript
function filesBelow(projectRoot, relativeRoot, predicate) {
  const absoluteRoot = path.join(projectRoot, relativeRoot);
  if (!existsSync(absoluteRoot)) {
    throw new Error(`Required directory does not exist: ${relativeRoot}`);
  }
  return readdirSync(absoluteRoot, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && predicate(entry.name))
    .map((entry) => toProjectPath(projectRoot, path.join(entry.parentPath, entry.name)))
    .sort();
}
```

Apply this to `.planning/reviews/unit-test-adversarial/**/*.md`; normalize separators and compare the whole sorted list, not only the count.

**Semantic completeness pattern:** `scripts/test-coverage-direct.mjs` lines 339-369 checks duplicate identities, round-trip mapping, missing records, and total equality. Copy that ordered validation shape for paths, source-claim identities, finding links, and the literal 110 obligation.

**CLI and error boundary pattern** (`scripts/check-corresponding-tests.mjs`, lines 176-213):

```javascript
function main() {
  const projectRoot = parseProjectRoot(process.argv.slice(2));
  const violations = checkCorrespondingTests(projectRoot);
  if (violations.length === 0) {
    process.stdout.write("Corresponding-test gate passed.\n");
    return;
  }
  for (const violation of violations) process.stderr.write(`${violation.kind}: ${violation.path}\n`);
  process.exitCode = 1;
}

if (invokedPath === fileURLToPath(import.meta.url)) {
  try { main(); } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
```

Export pure `enumerate`, `validate`, and `render` functions; keep `validate` and `render` CLI dispatch behind the direct-invocation guard. Accumulate actionable semantic errors where possible, print them deterministically, and set `exitCode` rather than calling `process.exit()`.

**Generated-view drift pattern:** `.planning/inputs/unit-test-refactor-handoff/check-preservation-kit.mjs` lines 274-304 invokes its generator with `--check`, folds stale output into the validator's error collection, emits every error, and only then fails. `01-REVALIDATION.md` should be rendered in memory from parsed JSON and compared byte-for-byte with the checked-in file.

### `scripts/revalidation.negative.mjs` (test fixture, file-I/O + batch)

**Analog:** `scripts/check-corresponding-tests.negative.mjs`

**Hermetic fixture pattern** (lines 1-16, 55-67):

```javascript
import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const fixtureRoot = await mkdtemp(path.join(tmpdir(), "corresponding-tests-gate-"));
try {
  await mkdir(sourceDirectory, { recursive: true });
  await mkdir(testDirectory, { recursive: true });
  // write a complete benign tree first
  assert.deepStrictEqual(checkCorrespondingTests(fixtureRoot), []);
  // mutate exactly one invariant and assert the whole violation value
} finally {
  await rm(fixtureRoot, { recursive: true, force: true });
}
```

Start from one valid minimal ledger, then plant one defect at a time: missing/extra/duplicate corpus path, duplicate identity, dangling/cyclic duplicate link, illegal status/route, missing method-specific evidence, unresolved decision premise, unsafe path, and Markdown drift. Restore the benign fixture between plants. Never touch the real corpus, user state, credentials, or network.

### `tests/architecture/revalidation.test.ts` (architecture test, file-I/O)

**Primary analog:** `tests/architecture/unit-suite-glob-completeness.test.ts`

**Independent-witness pattern** (lines 81-107):

```typescript
function unitTestFilesOnDisk(): string[] {
  const entries = readdirSync(path.join(REPO_ROOT, TEST_ROOT), {
    recursive: true,
    withFileTypes: true,
  });
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".test.ts"))
    .map((entry) => toPosix(path.relative(REPO_ROOT, path.join(entry.parentPath, entry.name))))
    .sort();
}

test("COV-04 the test script reaches every unit test file that exists", () => {
  // arrange
  const expectedPaths = unitTestFilesOnDisk();
  // act
  const matchedPaths = pathsMatchedByScript("test");
  // assert
  assert.deepStrictEqual(matchedPaths, expectedPaths);
});
```

The expected corpus inventory must come from an independent recursive walk, while the actual value comes from the ledger/parser. Follow the project skill: `node:test`, `node:assert/strict`, one behavior per case, lowercase arrange/act/assert comments, whole-value comparisons, awaited async assertions, and public exports only.

**Gate-the-gate pattern:** `tests/architecture/source-scan.test.ts` lines 17-60 proves missing targets fail, an explicit per-path waiver is narrow, and a known offender is detected. Mirror this with one benign fixture and planted offenders; never ship only an absence assertion.

### `01-REVALIDATION.json` (canonical data model, CRUD + batch)

**Analog:** `.planning/inputs/unit-test-refactor-handoff/check-preservation-kit.mjs`

Use its explicit parse/error accumulation pattern (lines 29-75) and uniqueness/disposition checks (lines 112-125): parse once, record malformed input as a named error, validate closed vocabularies, and detect duplicates with a `Set`. Unlike the preservation kit's JSON-compatible YAML, this artifact is strict JSON.

Model normalized top-level collections (`files`, `sourceClaims`, `findings`, `decisions`, `scopeChanges`) so links can be validated in both directions. File outcomes are derived. Evidence status and downstream route are separate discriminants. An unavailable mandatory reference is an explicit structured `N/A` reason, never an omitted field. `inconclusive` and unresolved surviving decisions are blocking states.

### `01-REVALIDATION.md` (generated report, transform + file-I/O)

**Analog:** `.planning/inputs/unit-test-refactor-handoff/check-preservation-kit.mjs` lines 274-280.

Treat this file as output only. Render deterministically from JSON with stable collection order, stable headings, and a final newline. Validation compares exact bytes and reports `generated artifacts are stale`; reviewers never patch the Markdown independently.

### `01-REVALIDATION-SCHEMA.md` (protocol document, transform)

**Analog:** the preservation kit's contract artifacts as consumed by `check-preservation-kit.mjs` lines 205-270.

Document each collection, identity grammar, closed enum, required reference, evidence-method-specific field, derivation rule, decision prerequisite, and scope-impact rule. The executable validator is authoritative; every documented invariant needs a positive case and planted-invalid case.

### `.planning/REQUIREMENTS.md` and `.planning/ROADMAP.md` (planning contracts, transform + batch)

**Analogs:** the files themselves; preserve their existing headings, tables, IDs, and phase numbering.

Generate a scope-impact view from the terminal ledger before editing either file. Preserve stale-only requirement IDs and evidence trails rather than deleting or marking them implemented; split mixed clauses; retire an empty later phase without renumbering. Run the ledger validator after both edits so every active requirement and phase route resolves back to a canonical finding.

## Shared Patterns

### Authentication and authorization

Not applicable. All work is an offline repository audit. Adding credentials, network calls, or access to real user state violates D-14.

### Path safety

**Source:** `scripts/check-corresponding-tests.mjs` lines 12-26 and `scripts/test-coverage-direct.mjs` lines 48-60.

Normalize every stored path to a repository-relative POSIX path. Resolve against an injected root, reject paths outside it, require the corpus prefix, and reject missing targets unless a schema field explicitly carries a justified `N/A`. Do not accept absolute paths or `..` traversal.

### Error handling

**Source:** `scripts/check-corresponding-tests.mjs` lines 188-213 and `check-preservation-kit.mjs` lines 299-304.

Return structured violations from validation logic; the CLI prints all violations deterministically and sets a nonzero exit code. Unexpected parse or I/O errors cross one top-level catch and are rendered without unsafe casts.

### Hermeticity and cleanup

**Source:** `scripts/check-corresponding-tests.negative.mjs` lines 1-16, 55-67 and its final `rm(..., { recursive: true, force: true })` cleanup.

Every mutable fixture owns a unique `mkdtemp` root and removes it in `finally`. Revalidation probes use injected collaborators or temporary copies. Phase 1 records evidence but does not edit production/test modules to manufacture it.

### Current-evidence rule

CodeGraph and static scans are valid only for structural claims that cannot execute. Production-defect claims need failing behavioral probes; test-strength claims need surviving mutations. A stale disposition needs the current replacement location, an equivalent rerun, and a precise explanation of the premise that no longer holds. Old `c8417fbc` line references and `.planning/codebase/*` descriptions are never current proof.

## No Analog Found

None. The ledger's exact domain is new, but every implementation role has a strong tracked repository pattern. The planner must use `01-RESEARCH.md` for domain-specific schema semantics, not invent those semantics from an unrelated analog.

## Metadata

**Analog search scope:** `scripts/`, `tests/architecture/`, `.planning/inputs/unit-test-refactor-handoff/`, and current `.planning/` contracts
**Strong analogs retained:** 7 tracked files (four primary patterns plus supporting negative/control files)
**Pattern extraction date:** 2026-09-04
**Project skill applied:** `.agents/skills/typescript-unit-testing-review/SKILL.md` and `.claude/rules/typescript-unit-testing.md`
