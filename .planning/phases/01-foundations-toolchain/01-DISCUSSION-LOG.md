# Phase 1: Foundations & Toolchain - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents. Decisions are captured in CONTEXT.md -- this log preserves the alternatives considered.

**Date:** 2026-05-09 **Phase:** 1-Foundations & Toolchain **Areas discussed:** CI Node matrix & toolchain, Output discipline enforcement, Module layout adoption, Symlink handling policy, Git library/packaging

______________________________________________________________________

## CI Node matrix & toolchain

### Q1 -- What Node range should CI test against?

| Option            | Description                                                         | Selected |
| ----------------- | ------------------------------------------------------------------- | -------- |
| 22.22.2 / 24 / 26 | Three-version matrix; lowest is write-file-atomic@^8's engine floor |          |
| 22 / 26           | Two-version matrix; broadest user support                           |          |
| 26 only           | Single latest version; simplest CI                                  |          |
| You decide        | Use STACK research's recommendation                                 |          |

**User's choice:** Free text -- "node 24" **Notes:** Single Node 24 matrix. Cascades to: tsx not needed (24 has native TS strip), write-file-atomic@^8 floor satisfied (24 ≥ 22.22.2), simpler CI maintenance.

### Q2 -- Drop tsx and switch tests to native TS strip on Node 24?

| Option                           | Description                                                          | Selected |
| -------------------------------- | -------------------------------------------------------------------- | -------- |
| Drop tsx, use native node --test | Node 24 strips TS natively; remove dev dep, simplify test invocation | ✓        |
| Keep tsx                         | Maintain V1's `node --import tsx --test` invocation                  |          |
| You decide                       | Drop tsx since Node 24 is locked                                     |          |

**User's choice:** Drop tsx, use native node --test **Notes:** Test script becomes `node --test "tests/**/*.test.ts"` (no `--import tsx`).

### Q3 -- Where should write-file-atomic@^8 be used?

| Option                    | Description                                                                                  | Selected |
| ------------------------- | -------------------------------------------------------------------------------------------- | -------- |
| JSON files only           | Use lib for state.json, mcp.json, agents-index.json; hand-rolled tmp+rename for staging dirs | ✓        |
| All file writes           | Replace every tmp+rename callsite                                                            |          |
| JSON + ESLint custom rule | Same as JSON-only plus rule banning bare fs.writeFile                                        |          |
| You decide                | Use the JSON-only split                                                                      |          |

**User's choice:** JSON files only (Recommended) **Notes:** Architecture-research-aligned split. Lib is purpose-built for atomic JSON; dir staging is a different problem (Phase 3's bridges).

### Q4 -- package.json's pi.extensions and test globs reference V1 paths that don't exist on this branch. When to rewire?

| Option                    | Description                                                              | Selected |
| ------------------------- | ------------------------------------------------------------------------ | -------- |
| Phase 1 -- full rewire    | Rewire pi.extensions + test globs + dependency bumps; Phase 1 ends green | ✓        |
| Phase 1 -- minimal rewire | Bump only what Phase 1 needs; defer pi.extensions and test globs         |          |
| Defer all to later phase  | Phase 1 only adds files; doesn't touch package.json                      |          |
| You decide                | Full rewire -- foundations phase should leave the build green            |          |

**User's choice:** Phase 1 -- point to new layout up front (Recommended) **Notes:** Includes typebox 1.1.34→1.1.38, prettier 3.6.2→3.8.3, globals 17.5.0→17.6.0 bumps.

______________________________________________________________________

## Output discipline enforcement

### Q1 -- What enforcement mechanism should block orphan stdout/stderr/console writes?

| Option                           | Description                                                                   | Selected              |
| -------------------------------- | ----------------------------------------------------------------------------- | --------------------- |
| ESLint no-restricted-syntax      | Pure config; no custom rule code; eslint-disable-next-line at sanctioned site | ✓ (Claude discretion) |
| Custom ESLint rule               | Rule that knows the sanctioned callsite by file path                          |                       |
| no-restricted-syntax + grep hook | Belt-and-suspenders; ESLint + pre-commit grep                                 |                       |
| You decide                       | Use no-restricted-syntax                                                      |                       |

**User's choice:** You decide **Notes:** Claude chose `no-restricted-syntax`. Escalation to custom rule allowed only if the disable-comment pattern erodes.

### Q2 -- ctx.ui.notify wrapper shape

| Option                                    | Description                                                                               | Selected              |
| ----------------------------------------- | ----------------------------------------------------------------------------------------- | --------------------- |
| Severity-named helpers                    | notifySuccess / notifyWarning / notifyError(ctx, msg, cause?); typo-proof at compile time | ✓ (Claude discretion) |
| Single notify(ctx, msg, severity, cause?) | Mirror ctx.ui.notify shape; severity is free-form string                                  |                       |
| Facade with builder                       | notify(ctx).success(msg).withCause(err)                                                   |                       |
| You decide                                | Use severity-named helpers                                                                |                       |

**User's choice:** You decide **Notes:** Claude chose severity-named helpers. The `cause` argument feeds Error.cause per ES-4.

### Q3 -- MARKERS module organization

| Option                   | Description                                       | Selected |
| ------------------------ | ------------------------------------------------- | -------- |
| Single shared/markers.ts | All 5 ES-5 strings as exported consts in one file | ✓        |
| Per-surface split        | markers/agent.ts, markers/mcp.ts, etc.            |          |
| You decide               | Use single shared/markers.ts                      |          |

**User's choice:** Single shared/markers.ts (Recommended) **Notes:** The PRD organizes them as one set in §6.12 -- module structure follows.

### Q4 -- MARKERS snapshot test source of truth

| Option                            | Description                                                                      | Selected              |
| --------------------------------- | -------------------------------------------------------------------------------- | --------------------- |
| Parse PRD §6.12 at test time      | Test reads PRD, extracts marker strings via regex, asserts MARKERS exports match | ✓ (Claude discretion) |
| Static fixture file in tests/     | tests/fixtures/markers.json holds the contract                                   |                       |
| MARKERS.ts itself is ground truth | Test asserts MARKERS exports match a frozen literal in the test file             |                       |
| You decide                        | Parse PRD §6.12 at test time                                                     |                       |

**User's choice:** You decide **Notes:** Claude chose PRD-parsing. The PRD is the user contract per ES-5; if PRD drifts, the test catches it; if MARKERS drifts, the test catches it.

______________________________________________________________________

## Module layout adoption

### Q1 -- What module layout should the new code adopt?

| Option                                    | Description                                                                                            | Selected |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------ | -------- |
| 9-folder split                            | edge / orchestrators / bridges / domain / transaction / persistence / presentation / platform / shared | ✓        |
| V1 flat layout                            | agent/ commands/ marketplace/ mcp/ plugin/ + top-level files                                           |          |
| Hybrid: V1 names + new top-level grouping | V1 leaf names under bridges/orchestrators/shared                                                       |          |
| You decide                                | Use 9-folder split                                                                                     |          |

**User's choice:** 9-folder architecture-research split (Recommended) **Notes:** No V1 migration cost on this branch -- adopt the recommended layout from day one.

### Q2 -- Enforce import-direction rules between layers?

| Option                            | Description                                    | Selected |
| --------------------------------- | ---------------------------------------------- | -------- |
| Strict ESLint import-x boundaries | no-restricted-paths config; violations fail CI | ✓        |
| Advisory only (warn)              | Same rules at warn severity                    |          |
| Convention-only                   | Document in CONTRIBUTING.md, trust review      |          |
| You decide                        | Use strict boundaries                          |          |

**User's choice:** Yes -- strict ESLint import-x boundaries (Recommended) **Notes:** Without enforcement, the rename is just cosmetic.

### Q3 -- Where do the 9 folders live relative to extensions/pi-claude-marketplace/?

| Option                                        | Description                                             | Selected |
| --------------------------------------------- | ------------------------------------------------------- | -------- |
| Directly inside extension dir                 | extensions/pi-claude-marketplace/{edge,orchestrators,...}/ | ✓        |
| Wrapped in extensions/pi-claude-marketplace/src/ | Adds one path level                                     |          |
| You decide                                    | Mirror V1: folders directly inside the extension dir    |          |

**User's choice:** Directly inside extension dir (Recommended) **Notes:** Replaces current stub `pi-claude-marketplace.ts` with a directory; entrypoint is `extensions/pi-claude-marketplace/index.ts`.

### Q4 -- Phase 1 scaffold scope

| Option                                   | Description                                                                                                               | Selected |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | -------- |
| All 9 with placeholder README per folder | Every folder created with README explaining purpose, allowed imports, planned contents; boundary rules wired up for all 9 | ✓        |
| Only folders Phase 1 populates           | Lean Phase 1 diff; other folders created by phase that first populates them                                               |          |
| All 9 with .gitkeep only                 | Folders visible from day one but no documentation                                                                         |          |
| You decide                               | Use the README approach                                                                                                   |          |

**User's choice:** All 9 with placeholder README per folder (Recommended) **Notes:** READMEs lock the rationale per folder so later phases don't drift.

______________________________________________________________________

## Symlink handling policy

### Q1 -- What's the policy for symlinks during plugin staging?

| Option                         | Description                                            | Selected |
| ------------------------------ | ------------------------------------------------------ | -------- |
| Refuse all symlinks            | fs.lstat; isSymbolicLink() → throw SymlinkRefusedError | ✓        |
| Follow + check resolved target | fs.realpath then assertPathInside on target            |          |
| Follow + warn-but-allow        | Resolve and stage with warning notify                  |          |
| You decide                     | Refuse all symlinks for V1                             |          |

**User's choice:** Refuse all symlinks (Recommended for V1) **Notes:** Strictest defense against Pitfall #2 attack surface.

### Q2 -- Where does the symlink check happen?

| Option                          | Description                                                    | Selected |
| ------------------------------- | -------------------------------------------------------------- | -------- |
| Inside assertPathInside         | Single chokepoint; every PS-1 callsite gets the check for free | ✓        |
| Separate assertNoSymlink helper | Two helpers; bridges call both                                 |          |
| Per-bridge wrappers             | Each bridge wraps its own readDir/readFile                     |          |
| You decide                      | Use assertPathInside chokepoint                                |          |

**User's choice:** Inside assertPathInside (Recommended) **Notes:** Adding the check to the chokepoint propagates automatically per PS-1.

### Q3 -- How deep does the symlink check inspect?

| Option                               | Description                                               | Selected              |
| ------------------------------------ | --------------------------------------------------------- | --------------------- |
| Walk every parent up to the boundary | lstat every component; catches parent-dir symlink escapes | ✓ (Claude discretion) |
| Single realpath() check              | Resolve full path with fs.realpath, assert under boundary |                       |
| Leaf only                            | Only check whether the leaf is a symlink                  |                       |
| You decide                           | Walk every parent                                         |                       |

**User's choice:** You decide **Notes:** Claude chose walk-every-parent -- most thorough; per-component cost is negligible compared to the IO already happening.

### Q4 -- How should the symlink-refused error relate to PathContainmentError?

| Option                                                     | Description                                                         | Selected |
| ---------------------------------------------------------- | ------------------------------------------------------------------- | -------- |
| Subclass: SymlinkRefusedError extends PathContainmentError | Existing PI-14 handling catches symlink errors without code changes | ✓        |
| Separate class                                             | Distinct class with its own handling                                |          |
| Plain PathContainmentError with note                       | Reuse PathContainmentError, set error.cause                         |          |
| You decide                                                 | Subclass                                                            |          |

**User's choice:** Subclass: SymlinkRefusedError extends PathContainmentError (Recommended) **Notes:** Inherits PI-14 handling (not folded into "rollback partial" line). Distinct instanceof when distinguishing matters.

______________________________________________________________________

## Git library/packaging

(Area added by user during gray-area selection -- "i want to explore to packages to work with git")

### Q1 -- How should the extension perform git operations?

| Option                                  | Description                                                                         | Selected |
| --------------------------------------- | ----------------------------------------------------------------------------------- | -------- |
| Shell out to git CLI (V1 carry-forward) | execFile + parse stdout/stderr; V1's pattern                                        |          |
| isomorphic-git (pure JS)                | No git CLI dep; ~2-3 MB; sparse checkout unsupported (already deferred per PRD §11) | ✓        |
| simple-git (CLI wrapper)                | JS wrapper around git CLI; still needs git on PATH                                  |          |
| @npmcli/git                             | npm's git wrapper; CLI-based; heavier dep tree                                      |          |

**User's choice:** isomorphic-git (pure JS, no native binding) **Notes:** Drops the git CLI dependency entirely. Cascades to MA-7's removal (see Q2).

### Q2 -- MA-7's fate (with isomorphic-git, git CLI is no longer required)

| Option                         | Description                                                                    | Selected |
| ------------------------------ | ------------------------------------------------------------------------------ | -------- |
| Remove MA-7 from REQUIREMENTS  | Failure mode no longer exists; mark as "removed: superseded by isomorphic-git" | ✓        |
| Keep as documentation-only     | Mark "N/A under isomorphic-git" but leave in REQUIREMENTS                      |          |
| Repurpose for new failure mode | Reframe as isomorphic-git initialization failure                               |          |
| You decide                     | Remove MA-7 + add Key Decision to PROJECT.md                                   |          |

**User's choice:** Remove MA-7 from REQUIREMENTS (Recommended) **Notes:** Honest reflection of the new contract. Add a Key Decision to PROJECT.md noting the supersession.

### Q3 -- HTTP transport for isomorphic-git

| Option                    | Description                                                 | Selected |
| ------------------------- | ----------------------------------------------------------- | -------- |
| isomorphic-git/http/node  | Node-specific adapter shipped with the lib; zero extra deps | ✓        |
| Custom Node fetch adapter | Thin adapter around globalThis.fetch; ~30 lines             |          |
| You decide                | Use isomorphic-git/http/node                                |          |

**User's choice:** isomorphic-git/http/node (Recommended) **Notes:** Standard, well-tested. Custom adapter only if Phase 7 telemetry hooks demand middleware later.

### Q4 -- Where does the isomorphic-git wrapper live in the 9-folder layout?

| Option             | Description                               | Selected |
| ------------------ | ----------------------------------------- | -------- |
| platform/git.ts    | platform/ holds external-surface wrappers | ✓        |
| persistence/git.ts | Group git with file IO under persistence  |          |
| shared/git.ts      | Treat git as a shared utility             |          |
| You decide         | Use platform/git.ts                       |          |

**User's choice:** platform/git.ts (Recommended) **Notes:** Git is an external system, not application logic.

______________________________________________________________________

## Claude's Discretion

The user said "You decide" on these -- Claude made the call:

- **Q1 (Output discipline)**: ESLint `no-restricted-syntax` (vs custom rule)
- **Q2 (Output discipline)**: Severity-named notify helpers (vs single notify or facade)
- **Q4 (Output discipline)**: Parse PRD §6.12 at test time (vs static fixture or MARKERS-as-truth)
- **Q3 (Symlink handling)**: Walk every parent component (vs realpath or leaf-only)
- **Q2 (Git library)**: Remove MA-7 + add Key Decision (vs keep as N/A or repurpose)

## Deferred Ideas

- **Custom ESLint rule** for output discipline -- escalation path if `no-restricted-syntax` disable-comment pattern erodes
- **Telemetry hooks** in the git wrapper -- IL-5 successor concern
- **isomorphic-git capability gaps** -- sparse checkout, shallow clones -- track for marketplace orchestrator phase
- **Custom fetch adapter** for git HTTP -- only if Phase 7 wants to inject auth/telemetry/retry middleware
- **`min-release-age` and supply-chain hardening** -- 2026 npm ecosystem trend; successor concern not Phase 1
- **Test fixture strategy for symlink attacks** -- test helper for staging plugins with malicious symlinks
- **`tests/architecture/import-boundaries.test.ts`** -- assert eslint.config.js emits expected restrictions
- **`tests/helpers/prd-extract.ts`** -- reusable helper for parsing PRD strings (used by MARKERS snapshot first, others later)
