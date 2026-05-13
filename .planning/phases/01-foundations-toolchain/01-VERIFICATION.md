---
phase: 01-foundations-toolchain
verified: 2026-05-09T22:20:00-04:00
status: human_needed
score: 4/5 success criteria verified (SC5 requires GitHub Actions confirmation)
overrides_applied: 0
human_verification:
  - test: "Push the current branch to remote (git push origin features/initial-gsd) and confirm the 'CI / npm run check (Node 24)' workflow completes green on GitHub Actions"
    expected: "Workflow passes: npm ci succeeds, npm run check exits 0 (typecheck + ESLint + Prettier + 30/30 tests)"
    why_human: "User explicitly opted not to push during Phase 1 closure. The closing commit documents 'CI green confirmation deferred -- user opted not to push to remote; local npm run check is green (30/30 tests).' ROADMAP SC5 requires 'npm run check passes on Node 24 in CI' and that means the remote Actions run, not just local."
---

# Phase 1: Foundations & Toolchain Verification Report

**Phase Goal:** Every subsequent phase has atomic IO, symlink-safe containment, stable user-contract markers, output-channel discipline, ESM baseline, and CI matrix to build on
**Verified:** 2026-05-09T22:20:00-04:00
**Status:** human_needed
**Re-verification:** No -- initial verification

## Goal Achievement

### Observable Truths (5 ROADMAP Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| SC1 | JSON writes to state.json/mcp.json/agents-index.json survive a kernel-crash simulation (`write-file-atomic@^8` adopted) | VERIFIED | `shared/atomic-json.ts` wraps `write-file-atomic@^8` with fsync-by-default. `tests/shared/atomic-json.test.ts` passes 3 cases: format shape, auto-mkdir, concurrent-write serialization. Package.json lists `"write-file-atomic": "^8.0.0"` as a runtime dependency. |
| SC2 | A test plugin containing a symlink whose target escapes the scope root is rejected with `PathContainmentError` before any byte is written | VERIFIED | `shared/path-safety.ts` implements `assertPathInside` with per-component `lstat()` walk; `SymlinkRefusedError extends PathContainmentError`. `tests/shared/path-safety.test.ts` has 8 passing cases including "leaf symlink to outside path throws SymlinkRefusedError" and "parent-component symlink throws SymlinkRefusedError". Inheritance is confirmed by a dedicated hierarchy test. Function is called before any write in the design (documented in TOCTOU note in source). |
| SC3 | ESLint emits an error when any file under `extensions/pi-claude-marketplace/` calls `process.stdout.write` / `process.stderr.write` / `console.warn` outside the one sanctioned `migrateLegacyMarketplaceRecords` callsite | VERIFIED | `eslint.config.js` BLOCK A defines 7 `no-restricted-syntax` selectors covering `process.stdout.write`, `process.stderr.write`, `console.log`, `console.warn`, `console.error`, `console.info`, and direct `ctx.ui.notify`. Scope is `extensions/pi-claude-marketplace/**/*.ts`. BLOCK B carves out `shared/notify.ts` as the sole sanctioned call site. `import-boundaries.test.ts` canary test confirms the rule emits `import-x/no-restricted-paths` (verifying ESLint is operational). `npm run lint` exits 0 (no violations in current code). Note: the ROADMAP SC-3 text says "src/edge/, src/orchestrators/, or src/bridges/" -- this is a stale draft artifact; CONTEXT.md D-10 established `extensions/pi-claude-marketplace/` (no `src/` prefix); the actual ESLint scope covers these folders and is more protective than stated. |
| SC4 | `shared/markers.ts` exports the 5 ES-5 strings; snapshot test asserts byte-for-byte PREFIX of PRD §6.12 literals | VERIFIED | `shared/markers.ts` exports 5 named constants: `PI_SUBAGENTS_NOT_LOADED`, `PI_MCP_ADAPTER_NOT_LOADED`, `RELOAD_HINT_PREFIX`, `MANUAL_RECOVERY_REQUIRED`, `ROLLBACK_PARTIAL`. `tests/architecture/markers-snapshot.test.ts` reads `docs/prd/pi-claude-marketplace-prd.md` at runtime, extracts the ES-5 row backtick literals, strips from the first `<`, `[`, or `…` onward, and asserts byte-for-byte equality with each exported constant. Test passes. PRD §6.12 ES-5 row confirmed present at line 611. |
| SC5 | `npm run check` (typecheck + ESLint + Prettier + `node --test`) passes on Node 24 in CI | PARTIAL -- local VERIFIED, GitHub Actions DEFERRED | Local: `npm run check` exits 0 with 30/30 tests, `tsc --noEmit` clean, `eslint .` clean, `prettier --check` clean. GitHub Actions: CI workflow exists at `.github/workflows/ci.yml` targeting Node 24 with `npm ci && npm run check`. However, user explicitly opted not to push to remote during Phase 1 closure (commit `8f9a7f2` records "CI green confirmation deferred"). The workflow has never run on GitHub. |

**Score:** 4/5 success criteria fully verified; SC5 is verified locally but not via the remote CI run that the ROADMAP criterion describes.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `extensions/pi-claude-marketplace/index.ts` | Thin Pi entrypoint registering claude:plugin command and resources_discover event | VERIFIED | Registers 1 command (`claude:plugin`) and 1 event (`resources_discover`), 0 LLM tools. `index-smoke.test.ts` asserts exact registration surface. |
| `extensions/pi-claude-marketplace/shared/markers.ts` | 5 ES-5 prefix constants | VERIFIED | 5 named exports confirmed; content verified by snapshot test against PRD §6.12 at runtime. |
| `extensions/pi-claude-marketplace/shared/atomic-json.ts` | `atomicWriteJson` via write-file-atomic@^8 | VERIFIED | Substantive implementation (32 lines) wrapping `write-file-atomic` with mkdir, 2-space indent, trailing newline. |
| `extensions/pi-claude-marketplace/shared/path-safety.ts` | `assertPathInside` + `PathContainmentError` + `SymlinkRefusedError` | VERIFIED | 128-line implementation with per-component lstat walk, ENOENT tolerance, correct inheritance chain. |
| `extensions/pi-claude-marketplace/shared/notify.ts` | Severity-named ctx.ui.notify wrappers (sole sanctioned call site) | VERIFIED | `notifySuccess`, `notifyWarning`, `notifyError`, `notifyUsageError` all present. ES-3 primitive (`notifyUsageError`) exists; call sites and usage block strings land in Phase 6. |
| `extensions/pi-claude-marketplace/shared/errors.ts` | `errorMessage`, `appendLeakToError`, `appendLeaks` | VERIFIED | V1 verbatim port, 33 lines, Error.cause chaining verified by 4 tests. |
| `extensions/pi-claude-marketplace/platform/git.ts` | isomorphic-git wrapper (clone, fetch, pull, checkout, resolveRef, listBranches, listRemotes) | VERIFIED | 155-line substantive implementation; imports `isomorphic-git` and `isomorphic-git/http/node`. No `child_process` usage. `no-shell-out.test.ts` confirms no `child_process` imports anywhere in the extension tree. |
| 9-folder skeleton (`edge/`, `orchestrators/`, `bridges/`, `domain/`, `transaction/`, `persistence/`, `presentation/`, `platform/`, `shared/`) | Placeholder `index.ts` or `README.md` + import-boundary rules wired | VERIFIED | All 9 folders exist. `eslint.config.js` BLOCK C defines 9 `import-x/no-restricted-paths` zones. `import-boundaries.test.ts` asserts exactly 9 zones and verifies each zone's forbidden-set against the D-11 allowed-imports matrix. |
| `tests/architecture/markers-snapshot.test.ts` | D-09 PRD-driven snapshot (2 tests) | VERIFIED | 2 tests pass; reads PRD at runtime; tests both the positive assertion and the error case for missing ES-5 row. |
| `tests/architecture/import-boundaries.test.ts` | 9-zone introspection + canary fixture (3 tests) | VERIFIED | 3 tests pass: zone count, zone content, canary fixture fires `import-x/no-restricted-paths` not `import-x/no-unresolved`. |
| `tests/architecture/no-shell-out.test.ts` | D-21 supersession defense (1 test) | VERIFIED | 1 test passes; walks all `.ts` files in the extension tree and asserts no `child_process` import pattern. |
| `tests/architecture/no-telemetry-deps.test.ts` | IL-4 enforcement (1 test) | VERIFIED | 1 test passes; reads `package.json` and asserts no telemetry vendor patterns in any dep section. |
| `tests/helpers/prd-extract.ts` | Reusable PRD §6.12 extractor | VERIFIED | `extractEs5MarkerLiterals()` implemented; used by markers-snapshot test; reusable by Phase 3/5. |
| `.github/workflows/ci.yml` | Node 24 single-version CI matrix running `npm run check` | VERIFIED (structure) | Workflow exists, targets Node 24, runs `npm ci && npm run check` on push/PR to main and features/**. Has never executed on GitHub (human verification item). |
| `package.json` | `write-file-atomic@^8` runtime dep; `isomorphic-git@^1.37.6`; `tsx` removed; bumped versions; peer-dep floor; `node --test` test script | VERIFIED | `write-file-atomic: ^8.0.0` in `dependencies`; `isomorphic-git: ^1.37.6` in `dependencies`; no `tsx` in devDeps; `typebox: ^1.1.38`, `prettier: ^3.8.3`, `globals: ^17.6.0` bumped; `peerDependencies["@mariozechner/pi-coding-agent"]: ">=0.70.6"`; test script is `node --test "tests/**/*.test.ts"`. |
| `eslint.config.js` | 7 output-discipline selectors + 9-zone import boundary rules + per-file overrides | VERIFIED | BLOCK A: 7 `no-restricted-syntax` selectors. BLOCK B: shared/notify.ts override. BLOCK C: 9-zone import boundary. BLOCK D: test fixture ignore. Tests override. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `index.ts` | `shared/notify.ts` | import of `notifyWarning` | VERIFIED | `import { notifyWarning } from "./shared/notify.ts"` is the only import; `index.ts` calls `notifyWarning` in the command handler stub -- proving output-channel discipline in the entrypoint. |
| `shared/atomic-json.ts` | `write-file-atomic` | direct import | VERIFIED | `import writeFileAtomic from "write-file-atomic"` at line 4; used in `atomicWriteJson`. |
| `shared/path-safety.ts` | `node:fs/promises` lstat/readlink | direct import | VERIFIED | `import { lstat, readlink } from "node:fs/promises"` at line 1. |
| `platform/git.ts` | `isomorphic-git` + `isomorphic-git/http/node` | direct import | VERIFIED | Both imports present; all 7 git operations delegate to `git.*` functions. |
| `eslint.config.js` BLOCK A | `extensions/pi-claude-marketplace/**/*.ts` | `files` glob | VERIFIED | `files: ["extensions/pi-claude-marketplace/**/*.ts"]` -- covers edge/, orchestrators/, bridges/, and all other subfolders. |
| `eslint.config.js` BLOCK B | `extensions/pi-claude-marketplace/shared/notify.ts` | per-file override disabling `no-restricted-syntax` | VERIFIED | BLOCK B at line 118 with `"no-restricted-syntax": "off"` and `"no-console": "off"`. |
| `eslint.config.js` BLOCK C | 9 extension subfolders | `import-x/no-restricted-paths` zones | VERIFIED | 9 zones confirmed by import-boundaries.test.ts zone-count and zone-content assertions. |
| `markers-snapshot.test.ts` | PRD at `docs/prd/pi-claude-marketplace-prd.md` | `readFile` at runtime | VERIFIED | Reads PRD file path constructed from `REPO_ROOT`; test would fail if PRD is missing or ES-5 row absent. |
| `markers-snapshot.test.ts` | `shared/markers.ts` | direct ESM import | VERIFIED | `import * as markers from "../../extensions/pi-claude-marketplace/shared/markers.ts"`. |

### Data-Flow Trace (Level 4)

Not applicable for this phase. Phase 1 produces infrastructure primitives, toolchain configuration, and a stub entrypoint -- no components rendering dynamic data from a live data source. The atomic-json and path-safety modules are utility functions, not data-rendering components.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Full check pipeline passes | `npm run check` | 30/30 tests pass, typecheck clean, ESLint clean, Prettier clean | PASS |
| Markers constants match PRD §6.12 prefixes | `node --test tests/architecture/markers-snapshot.test.ts` (run as part of suite) | 2 tests PASS | PASS |
| ESLint 9-zone boundary matrix is correct | `node --test tests/architecture/import-boundaries.test.ts` (run as part of suite) | 3 tests PASS | PASS |
| No child_process imports in extension | `node --test tests/architecture/no-shell-out.test.ts` (run as part of suite) | 1 test PASS | PASS |
| No telemetry deps in package.json | `node --test tests/architecture/no-telemetry-deps.test.ts` (run as part of suite) | 1 test PASS | PASS |
| CI workflow fires on Node 24 and passes | Push to remote + inspect GitHub Actions | Not yet executed | SKIP -- human needed |

### Requirements Coverage

| Requirement | Description | Status | Evidence |
|-------------|-------------|--------|----------|
| NFR-1 | All disk mutations atomic (tmp + rename or atomic JSON write) | VERIFIED | `atomicWriteJson` via write-file-atomic@^8; concurrent-write test confirms no partial writes. |
| NFR-4 | Extension MUST work with Node ≥ 22 | VERIFIED | `package.json` `engines.node: ">=22"`; CI workflow targets Node 24 (within range). |
| NFR-6 | `npm run check` green (typecheck + ESLint + Prettier + tests) | VERIFIED locally; CI run DEFERRED | Local: all 4 gates pass. GitHub Actions: workflow defined but never triggered (SC5 human item). |
| NFR-9 | Never print sensitive paths beyond what's already in user's terminal | VERIFIED | `notifyError` surfaces only `cause.message`, not `cause.stack` or absolute paths. Test asserts this property explicitly. |
| NFR-10 | Refuse to write outside scope roots | VERIFIED | `PathContainmentError` thrown on string-level escape; tests confirm. |
| IL-1 | English-only messages in V1 | VERIFIED | All message strings in markers.ts and notify.ts are ASCII English. markers-snapshot.test.ts indirectly enforces this via PRD §6.12 byte-for-byte prefix match. |
| IL-2 | All user-visible messages through `ctx.ui.notify`; no direct stdout/stderr | VERIFIED | 7 `no-restricted-syntax` selectors in BLOCK A; BLOCK B carves out only `shared/notify.ts`. `npm run lint` passes (no violations in current code). |
| IL-3 | Single sanctioned `console.warn` in `migrateLegacyMarketplaceRecords` | PARTIALLY VERIFIED | ESLint rule is configured with `console.warn` selector; the exception mechanism (eslint-disable-next-line with `-- IL-3:` justification comment) is documented. The `migrateLegacyMarketplaceRecords` function itself lands in Phase 2's `persistence/state-io.ts` -- the exception incantation is not yet in use. Phase 1 establishes the rule; Phase 2 exercises the sanctioned exception. |
| IL-4 | No telemetry/analytics dependencies | VERIFIED | `no-telemetry-deps.test.ts` scans all dep sections of `package.json` against 9 forbidden vendor patterns. Test passes. |
| IL-5 | Successor SHOULD consider pluggable message catalog, structured event channel, severity-aware log levels | ACKNOWLEDGED | This is a SHOULD. Phase 1 documents the successor concern in `shared/notify.ts` (Phase 6 `formatErrorWithCauses` forward reference). No implementation required in Phase 1. |
| ES-1 | All user-visible failure modes through `ctx.ui.notify` | VERIFIED | `notifySuccess/Warning/Error/UsageError` wrappers are the sole call sites. `notify.test.ts` asserts each wrapper calls `ctx.ui.notify` exactly once with correct args. |
| ES-2 | Severity ladder: default/warning/error | VERIFIED | `notify.test.ts` tests all three severity levels explicitly. |
| ES-3 | Usage errors at `error` severity with Usage block appended | PRIMITIVE VERIFIED; CALL SITES DEFERRED TO PHASE 6 | `notifyUsageError(ctx, message, usageBlock)` exists in `shared/notify.ts` and implements `${message}\n\n${usageBlock}` at `"error"` severity. No test for `notifyUsageError` specifically (the 6 notify tests cover the other 3 wrappers). No call sites yet -- Phase 6 wires the Usage block strings at argument-validation sites in `edge/`. This split is by plan design (CONTEXT.md, SUMMARY Plan 02, SUMMARY Plan 07 all document it). |
| ES-4 | Errors include original cause via `Error.cause`; `formatErrorWithCauses` flattens chain | VERIFIED (cause chaining); Phase 6 adds `formatErrorWithCauses` | `notifyError` accepts optional `cause` and surfaces `cause.message`. `notify.test.ts` confirms. `appendLeakToError/appendLeaks` chain via `Error.cause`; `errors.test.ts` confirms. `formatErrorWithCauses` is a Phase 6 deliverable. |
| ES-5 | Specific marker strings stable as user contract | VERIFIED | `markers-snapshot.test.ts` reads PRD §6.12 at runtime and asserts 5 exported constants are byte-for-byte prefixes of the PRD literals. |
| PS-1 | Every name-derived path resolved and checked with `assertPathInside` | VERIFIED (chokepoint exists); call sites land in Phase 3 | `assertPathInside` is implemented as the single chokepoint (D-15). Phase 3 bridges will call it for every write. Phase 1 delivers the function; the PLAN explicitly notes "Phase 3 wires every callsite." |
| PS-2 | Plugin source paths MUST be relative | PRIMITIVE VERIFIED | `isPathInside` string-level check rejects absolute paths (the "direct escape" test confirms). Full resolver-level enforcement (where source.path fields are validated) lands in Phase 2 domain logic. |
| PS-3 | Component paths in manifests MUST be relative | PRIMITIVE VERIFIED | Same `assertPathInside` chokepoint; bridge-level component-path checks land in Phase 2/3. |
| PS-4 | Containment violations during rollback propagate (state corruption is loud) | PRIMITIVE VERIFIED | `SymlinkRefusedError` and `PathContainmentError` propagate without being caught internally (they re-throw). The "during rollback" aspect is not testable in Phase 1 because rollback code lands in Phase 5. Phase 1 delivers the error class that Phase 5 will observe propagating. |
| PS-5 | Generated agent files inside `locations.agentsDir`; staging inside `locations.agentsStagingDir`; both checked at every write | CHOKEPOINT VERIFIED; wiring deferred to Phase 3 | `assertPathInside` is the enforcement mechanism; `platform/` and `persistence/` will call it. Phase 3 wires these call sites. |
| AS-1 | All disk-write phases stage to tmp on same filesystem, then atomic-rename | VERIFIED for JSON writes; staging-dir atomic-rename lands in Phase 3 | `atomicWriteJson` delegates to write-file-atomic which handles tmp+fsync+rename. Staging-directory commits (mkdir+writeFile+rename pattern for agent trees) land in Phase 3. |
| AS-4 | Rollback collects per-phase failures into `(rollback partial: [phase] msg; …)` summary | CONSTANT VERIFIED | `ROLLBACK_PARTIAL = "(rollback partial: "` exported from `markers.ts`; snapshot test asserts it. The orchestrator code that assembles the full rollback-partial string lands in Phase 5. |
| AS-5 | Cleanup leaks appended to errors via `appendLeaks`/`appendLeakToError` | VERIFIED | `appendLeakToError` and `appendLeaks` implemented in `shared/errors.ts`; 4 tests confirm cause-chaining semantics. |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `extensions/pi-claude-marketplace/index.ts` | 29 | `return Promise.resolve()` in command handler stub | Info | Expected Phase 1 stub. Phase 6 replaces with real router. Not a blocker. |
| `extensions/pi-claude-marketplace/platform/git.ts` | - | `pull()` accepts `author` param required by isomorphic-git but unused in V1 public GitHub workflow | Info | isomorphic-git API requirement. Noted in FEATURES/deferred items (not a Phase 1 concern). |
| ROADMAP.md progress table | Line 121-128 | Phase 1 still shows "0/7 Not started" -- not updated to "7/7 Complete" at phase close | Warning | Documentation-only gap; does not affect code correctness. The closing commit (`8f9a7f2`) only updated the criterion notes, not the progress table. |

No blocker anti-patterns found. The `notify.ts` `return Promise.resolve()` in `index.ts` and the git wrapper's author param are intentional stubs/API-required fields.

### Human Verification Required

#### 1. GitHub Actions CI Run on Node 24

**Test:** Push the branch to remote: `git push origin features/initial-gsd`. Navigate to the repository's Actions tab on GitHub and wait for the "CI / npm run check (Node 24)" workflow to complete.

**Expected:** Workflow passes all steps:
- Checkout succeeds
- Setup Node 24 succeeds
- `npm ci` completes without lockfile drift errors
- `npm run check` exits 0 (typecheck + ESLint + Prettier + 30/30 tests)

**Why human:** The user explicitly opted not to push during Phase 1 closure. ROADMAP SC5 says "passes on Node 24 in CI." Local `npm run check` is verified green (30/30, all linting clean), and the workflow YAML is structurally correct. The only unconfirmed element is the actual remote execution on GitHub's Node 24 runner environment (package registry reachability, `npm ci` lockfile resolution, runner filesystem behavior).

## Gaps Summary

No code gaps were found. Phase 1's deliverables are substantive, wired, and tested (30/30 tests passing; full `npm run check` green locally). The single open item is the GitHub Actions CI run that the user deferred:

- SC5's "in CI" clause refers to GitHub Actions. The workflow is correctly authored but has never executed on the remote. This is the only item that cannot be verified programmatically without the remote run.

Items that look partial but are by design and fully consistent with the plan:
- **ES-3** (`notifyUsageError`): primitive exists; no test for it specifically; call sites in Phase 6. This split is documented in CONTEXT.md, SUMMARY Plans 02 and 07. The PLAN frontmatter explicitly marks ES-3 as primitive-delivered in Phase 1.
- **PS-4** (rollback propagation): error class propagates correctly; rollback orchestration code lands in Phase 5.
- **IL-3** (console.warn exception): ESLint rule is live; sanctioned exception incantation is documented for Phase 2's `migrateLegacyMarketplaceRecords`.
- **ROADMAP progress table** still showing "Not started": cosmetic documentation gap in the planning artifact, not a code gap.

---

_Verified: 2026-05-09T22:20:00-04:00_
_Verifier: Claude (gsd-verifier)_
