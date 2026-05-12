# Phase 1: Foundations & Toolchain -- Research

**Researched:** 2026-05-09 **Domain:** Node 24 ESM toolchain, atomic file IO, symlink-aware path containment, ESLint flat-config boundary enforcement, isomorphic-git, Pi extension API surface **Confidence:** HIGH (every contested API surface verified against the on-disk package or official docs on 2026-05-09)

This research file is **prescriptive, not exploratory**. The discuss-phase locked 21 decisions in `01-CONTEXT.md`. Phase 1 owns 23 REQ-IDs. Stack selection, library choice, and architectural shape are all settled. The job here is to surface the concrete API surfaces, version-specific gotchas, and snippet-level patterns the planner needs to write executable tasks.

______________________________________________________________________

\<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Toolchain & CI

- **D-01:** CI tests against **Node 24 only** (single-version matrix). Earlier Node ranges out of scope.
- **D-02:** **Drop tsx**; tests run as `node --test "tests/**/*.test.ts"` directly.
- **D-03:** **Adopt `write-file-atomic@^8`** as a runtime dependency, used **only for JSON files** (`state.json`, `mcp.json`, `agents-index.json`). Hand-rolled tmp+rename remains for staging directories.
- **D-04:** Phase 1 fully rewires `package.json`: update `pi.extensions` to `./extensions/pi-claude-marketplace/index.ts`, update test globs, bump `typebox` 1.1.34→1.1.38, `prettier` 3.6.2→3.8.3, `globals` 17.5.0→17.6.0. Phase 1 ends with `npm run check` actually green.
- **D-05:** Pin `@mariozechner/pi-coding-agent` peer-dep floor to a defensible version. Final pinned version set in Phase 7; Phase 1 chooses an interim floor matching the dev version.

#### Output Discipline

- **D-06:** ESLint `no-restricted-syntax` blocks `process.stdout.write`, `process.stderr.write`, `console.log/warn/error/info` calls in `extensions/pi-claude-marketplace/`. Sanctioned `eslint-disable-next-line` at the single `migrateLegacyMarketplaceRecords` callsite (per IL-3).
- **D-07:** `ctx.ui.notify` wrapper uses severity-named helpers: `notifySuccess`, `notifyWarning`, `notifyError(ctx, msg, cause?)`. Direct `ctx.ui.notify` allowed only inside the wrapper file.
- **D-08:** Single `shared/markers.ts` exports the 5 ES-5 strings as named consts: `PI_SUBAGENTS_NOT_LOADED`, `PI_MCP_ADAPTER_NOT_LOADED`, `RELOAD_HINT_PREFIX`, `MANUAL_RECOVERY_REQUIRED`, `ROLLBACK_PARTIAL`.
- **D-09:** MARKERS snapshot test parses PRD §6.12 at runtime; PRD is ground truth.

#### Module Layout

- **D-10:** **9-folder split** under `extensions/pi-claude-marketplace/`: `edge/`, `orchestrators/`, `bridges/`, `domain/`, `transaction/`, `persistence/`, `presentation/`, `platform/`, `shared/`. Direct children of the extension dir (no `src/` wrapper).
- **D-11:** Strict ESLint `import-x/no-restricted-paths` rules enforce layering. Violations fail CI.
- **D-12:** Phase 1 scaffolds all 9 folders with placeholder READMEs; boundary rules wired up for all 9.
- **D-13:** Replace `extensions/pi-claude-marketplace.ts` (current stub) with `extensions/pi-claude-marketplace/index.ts`.

#### Path Safety (Symlink Handling)

- **D-14:** Refuse all symlinks -- `assertPathInside` uses `fs.lstat()` on every component; if any component is a symlink, throw `SymlinkRefusedError extends PathContainmentError`.
- **D-15:** Single chokepoint: `assertPathInside`.
- **D-16:** Walk every parent component from boundary down to target.
- **D-17:** `SymlinkRefusedError extends PathContainmentError`; inherits PI-14 handling. Distinct `instanceof` available. Error message includes offending link path AND its resolved target.

#### Git Library / Packaging

- **D-18:** Adopt `isomorphic-git` as runtime dependency for all git operations.
- **D-19:** HTTP transport: `isomorphic-git/http/node`.
- **D-20:** Wrapper at `platform/git.ts`. Other layers do not import git directly.
- **D-21:** MA-7 removed from REQUIREMENTS.md; supersession Key Decision added to PROJECT.md.

### Claude's Discretion

- **D-06** mechanism: `no-restricted-syntax` (escalate to custom rule only if disable-comment pattern erodes).
- **D-07** wrapper shape: severity-named helpers (typo-proof at compile time).
- **D-09** MARKERS source: parse PRD at runtime.
- **D-16** symlink check depth: walk every parent.
- **D-21** MA-7 fate: remove + Key Decision.

### Deferred Ideas (OUT OF SCOPE)

- Custom ESLint rule for output discipline (escalation path if D-06 erodes).
- Telemetry hooks in git wrapper (IL-5 successor concern).
- isomorphic-git capability gaps: sparse checkout, shallow clones -- track, don't implement.
- Custom fetch adapter for git (Phase 7 if telemetry/auth-header injection demanded).
- `min-release-age` / supply-chain hardening (post-V1).

\</user_constraints>

______________________________________________________________________

\<phase_requirements>

## Phase Requirements

| ID         | Description                                                                                                             | Research Support                                                                                  |
| ---------- | ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| **NFR-1**  | All disk mutations atomic at file level (tmp + rename or atomic JSON write)                                             | `write-file-atomic@^8` for JSON (D-03); hand-rolled `mkdir`+tmpwrite+`rename` for tree commits    |
| **NFR-4**  | Extension MUST work with Node ≥ 22                                                                                      | Node 24 LTS chosen per D-01; `write-file-atomic@8` engines `^22.22.2 \|\| ^24.15.0 \|\| >=26.0.0` |
| **NFR-6**  | `npm run check` = typecheck + ESLint + Prettier + tests; gates stay green                                               | Verified pipeline shape in current `package.json`; D-04 keeps it green at phase end               |
| **NFR-9**  | System MUST never print sensitive paths beyond what's already in the user's terminal                                    | `notify*` wrappers (D-07) + IL-2 enforcement (D-06) prevent leaks                                 |
| **NFR-10** | System MUST refuse to write outside `<scopeRoot>/pi-claude-marketplace/`, `<scopeRoot>/agents/`, or `<scopeRoot>/mcp.json` | `assertPathInside` chokepoint (D-15); symlink-walk (D-14/D-16/D-17)                               |
| **IL-1**   | English-only V1; no message catalog, no locale negotiation                                                              | No i18n libs -- explicit anti-pattern in research                                                 |
| **IL-2**   | Every user-visible message via `ctx.ui.notify`; no direct stdout/stderr writes                                          | `no-restricted-syntax` AST selectors (D-06)                                                       |
| **IL-3**   | Single sanctioned `console.warn`: load-time `migrateLegacyMarketplaceRecords` save failure                              | `eslint-disable-next-line` comment is the sanctioned exception                                    |
| **IL-4**   | V1 MUST NOT emit telemetry                                                                                              | No analytics deps; explicit "do not introduce" guard                                              |
| **IL-5**   | Successor SHOULD consider pluggable catalog / structured event channel                                                  | Documented as deferred                                                                            |
| **ES-1**   | All user-visible failure modes go through `ctx.ui.notify(message, severity)`                                            | Severity-named wrappers (D-07) make this typo-proof                                               |
| **ES-2**   | Severity ladder: default / `warning` / `error`                                                                          | Pi `notify(type?: "info" \| "warning" \| "error")` confirmed in `types.d.ts`                      |
| **ES-3**   | Usage errors at `error` severity with Usage block appended                                                              | `notifyError(ctx, "<usage>", cause?)` pattern                                                     |
| **ES-4**   | Errors include `Error.cause`; `formatErrorWithCauses` flattens chain depth 5                                            | Native `Error.cause` (Node ≥17); helper goes in `presentation/error-format.ts` (Phase 6)          |
| **ES-5**   | 5 marker strings stable as user contract (gitlint-grade)                                                                | `shared/markers.ts` (D-08); snapshot test against PRD (D-09)                                      |
| **PS-1**   | Every name-derived path `path.resolve`'d and `assertPathInside`'d; violations throw `PathContainmentError`              | V1 pattern carried forward + symlink-walk extension                                               |
| **PS-2**   | Plugin source paths MUST be relative; absolute paths rejected as unavailable                                            | Domain concern -- mirrored from V1 `validation.ts`                                                |
| **PS-3**   | Component paths MUST be relative; absolute paths produce note + disqualify install                                      | Same as PS-2                                                                                      |
| **PS-4**   | Containment violations during rollback propagate (state corruption is loud)                                             | `PathContainmentError` is NOT folded into "rollback partial" line                                 |
| **PS-5**   | Generated agent files MUST be inside `locations.agentsDir`; staging tmp inside `locations.agentsStagingDir`             | Locations module owns the boundary roots (Phase 2 expands)                                        |
| **AS-1**   | All disk-write phases stage to tmp on same filesystem as destination, then atomic-rename                                | `write-file-atomic` for JSON; hand-rolled tree-rename for staging dirs                            |
| **AS-4**   | Rollback collects per-phase failures into single `(rollback partial: [phase] msg; …)` summary                           | `ROLLBACK_PARTIAL` marker in `shared/markers.ts`                                                  |
| **AS-5**   | Cleanup leaks appended to errors via `appendLeaks`/`appendLeakToError`                                                  | V1 helpers in `errors.ts` carry forward -- Phase 1 ports them                                     |

\</phase_requirements>

______________________________________________________________________

## Project Constraints (from CLAUDE.md)

These directives are authoritative; downstream tasks MUST honor them.

| #   | Directive (CLAUDE.md)                                                                                         | Phase 1 Implication                                                                                     |
| --- | ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| 1   | Node ≥ 22 (NFR-4)                                                                                             | D-01 narrows to Node 24 -- compatible                                                                   |
| 2   | TypeScript strict; `installable: true \| false` discriminated union (NFR-7)                                   | Phase 2 concern; Phase 1 keeps `tsconfig.json` strict (already in repo)                                 |
| 3   | `@mariozechner/pi-coding-agent` peer dep currently `*`, dev against `^0.70.6`; pinning floor is NFR-11 SHOULD | D-05 picks interim floor ≥0.70.6 (or ≥0.73.1 if Phase 7 confirms)                                       |
| 4   | All disk mutations atomic (NFR-1)                                                                             | D-03 + V1 tree-rename pattern                                                                           |
| 5   | Recovery: no Pi restart; `Run /reload` MUST suffice (NFR-2)                                                   | Phase 5 concern; nothing for Phase 1 to break                                                           |
| 6   | All operations safe to retry (NFR-3)                                                                          | Phase 5 concern                                                                                         |
| 7   | Network-policy: only GitHub-source `marketplace add` / `update` (NFR-5)                                       | Phase 4 concern; isomorphic-git wrapper landing in Phase 1 must not initiate connections at module-load |
| 8   | Containment (NFR-10)                                                                                          | D-14 through D-17                                                                                       |
| 9   | `npm run check` green (NFR-6)                                                                                 | D-04 closes this                                                                                        |
| 10  | All user-visible messages via `ctx.ui.notify` (IL-2)                                                          | D-06 + D-07                                                                                             |
| 11  | Single sanctioned `console.warn` (IL-3)                                                                       | `migrateLegacyMarketplaceRecords` callsite gets the only `eslint-disable-next-line`                     |
| 12  | No telemetry V1 (IL-4)                                                                                        | No analytics deps introduced                                                                            |
| 13  | English only V1 (IL-1)                                                                                        | No i18n deps                                                                                            |
| 14  | Two scopes: `user` / `project` (SC-1)                                                                         | Phase 2 concern; Phase 1's `shared/path-safety.ts` is scope-agnostic                                    |

**CLAUDE.md additionally lists the verified Phase-1-relevant package versions** under "Recommended Stack" / "Version Compatibility Matrix" -- those numbers feed D-04's bumps.

______________________________________________________________________

## Summary

Phase 1 lays the toolchain floor every later phase walks on. The discuss-phase has already chosen the building blocks. This research file confirms the **API surfaces of those building blocks** -- the parts that get baked into source code on the first day and would be expensive to change later.

Five surface areas are settled and ready for the planner:

1. **Atomic JSON writes** -- `write-file-atomic@^8` is Promise-friendly, fsync-by-default, and serializes concurrent writes to the same path. Verified package layout: ESM-compatible default-exported function with optional `{encoding, fsync, mode, chown, tmpfileCreated}` options. Engines floor `^22.22.2 || ^24.15.0 || >=26.0.0` is satisfied by D-01's Node 24 baseline.
2. **`isomorphic-git` adoption** -- package is dual-CJS/ESM with explicit `./http/node` subpath export. The wrapper at `platform/git.ts` should expose `clone`, `fetch`, `pull`, `checkout`, `resolveRef`, `listBranches` -- every signature is `({ fs, http, dir, ... })`. Sparse-checkout is genuinely unsupported; `--depth` and `--single-branch` ARE supported. Auth callback shape is documented and stable.
3. **Symlink-aware containment** -- `fs.lstat()` does NOT follow symlinks (verified against Node docs); walking from the containment root down with per-component `lstat()` + `isSymbolicLink()` is the canonical defense. The race window (TOCTOU between `lstat` and the actual write) is documented as residual risk; for V1 it is acceptable because the threat model is "careless or malicious *plugin author*", not "concurrent in-process attacker".
4. **ESLint output discipline** -- `no-restricted-syntax` with AST selectors (`CallExpression[callee.object.object.name='process'][callee.object.property.name='stdout'][callee.property.name='write']` plus 5 sibling selectors) ban the forbidden patterns. The sanctioned `console.warn` site uses `// eslint-disable-next-line no-restricted-syntax` plus a comment citing IL-3.
5. **9-folder layering** -- `eslint-plugin-import-x`'s `no-restricted-paths` zones use `target` (consumer) + `from` (forbidden source) semantics. The full zone list for the layering described in D-11 is given below as a copy-paste config snippet.

**Primary recommendation:** Land all five surfaces in Wave 0 of Phase 1 so that Wave 1 (folder scaffolding + index.ts rewire) and Wave 2 (markers + snapshot test) build on a fully-verified API surface. The biggest source of "looks done but isn't" failures in foundations phases is wiring the boundary lint rules **after** dummy folders exist -- the resulting violations get hidden because no real imports cross the boundaries yet. Land the rules with at least one cross-folder canary import in tests so the rules get exercised before bridges arrive in Phase 3.

______________________________________________________________________

## Architectural Responsibility Map

Phase 1 is foundational -- it does not own use-case logic. Capabilities here are infrastructure-level.

| Capability                        | Primary Tier (in Phase 1)                | Secondary Tier | Rationale                                                                                                       |
| --------------------------------- | ---------------------------------------- | -------------- | --------------------------------------------------------------------------------------------------------------- |
| Atomic JSON write                 | `shared/atomic-json.ts` (NEW)            | --             | Used by every layer; needs zero internal deps so no folder above it can forbid importing it                     |
| Symlink-aware path containment    | `shared/path-safety.ts`                  | --             | One chokepoint per D-15; pure logic over `node:fs/promises` + `node:path`                                       |
| ES-5 marker constants             | `shared/markers.ts`                      | --             | `shared/` is the only folder ALL other folders may import from; markers are the canonical example               |
| `notify*` severity-named wrappers | `shared/notify.ts` (NEW)                 | --             | Same import-everywhere reasoning as markers; `ctx.ui.notify` is the only sanctioned escape hatch                |
| ESLint output-discipline rules    | `eslint.config.js`                       | --             | Project-wide config; not a runtime module                                                                       |
| Import-direction enforcement      | `eslint.config.js` (`import-x`)          | --             | Same                                                                                                            |
| Pi extension entrypoint           | `extensions/pi-claude-marketplace/index.ts` | `edge/`        | Stub for now; Phase 6 fills it; Phase 1 wires the `pi.registerCommand` + `pi.on("resources_discover")` skeleton |
| Git wrapper                       | `platform/git.ts`                        | --             | External system surface, per D-20 -- only `orchestrators/marketplace/*` may import it (Phase 4)                 |
| Folder scaffolding (9 READMEs)    | All 9 folders                            | --             | One README per folder; READMEs document allowed imports + planned contents                                      |

**Tier check:** Nothing in Phase 1 belongs in `domain/` or `bridges/` (those are Phase 2 / Phase 3). The only concrete TypeScript files Phase 1 lands are: `index.ts`, `shared/markers.ts`, `shared/path-safety.ts`, `shared/notify.ts`, `shared/atomic-json.ts`, `shared/errors.ts` (port from V1), and `platform/git.ts` (initial wrapper, no Phase-4 calls yet). Plus 9 placeholder READMEs.

______________________________________________________________________

## Standard Stack

### Core (already chosen -- versions verified 2026-05-09 via `npm view`)

| Library                         | Version                               | Purpose                                       | Why Standard                                                                                                |
| ------------------------------- | ------------------------------------- | --------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Node.js                         | 24 LTS                                | Runtime (D-01)                                | Native TS strip; `node --test` runs `.ts` files unmodified; `--experimental-strip-types` removed in Node 26 |
| TypeScript                      | `^5.9.3`                              | Language (already in repo)                    | Strict-mode for NFR-7; `module: "NodeNext"` in `tsconfig.json` aligns with native TS strip                  |
| `typebox`                       | `^1.1.38` (V1: `^1.1.34`)             | Schema validation, JSON Schema 2020-12 output | ESM-only 1.x line; bug-fix-only LTS on `@sinclair/typebox` 0.34.x. Bump per D-04                            |
| `@mariozechner/pi-coding-agent` | `^0.73.1` (peer-dep floor `>=0.70.6`) | Pi extension API host                         | Required peer dep; D-05 picks interim floor                                                                 |

### Supporting (NEW for Phase 1)

| Library                              | Version   | Purpose                                                                                      | When to Use                                                                                                                              |
| ------------------------------------ | --------- | -------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `write-file-atomic`                  | `^8.0.0`  | Atomic JSON writes (`state.json`, `mcp.json`, `agents-index.json`)                           | Every JSON write that participates in `withStateGuard`. NOT for staging-tree commits (different problem shape -- keep V1 pattern there). |
| `isomorphic-git`                     | `^1.37.6` | Git operations (clone/fetch/pull/checkout/resolveRef) without spawning the `git` CLI         | Wrapped behind `platform/git.ts` (D-20). Marketplace orchestrators (Phase 4) import the wrapper, never `isomorphic-git` directly.        |
| `node:fs/promises`                   | built-in  | Directory ops, agent `.md` writes, staging-dir manipulation, `lstat()` for symlink detection | Every non-JSON file op.                                                                                                                  |
| `node:crypto`                        | built-in  | `randomUUID` for tmp-name generation; SHA-256 for PI-7 (Phase 5)                             | Already imported in V1 `fs-utils.ts`.                                                                                                    |
| `node:path` / `node:url` / `node:os` | built-in  | Path containment, home-dir resolution                                                        | All Phase 1 surfaces use built-ins only.                                                                                                 |

### Dev tools (already in V1 -- Phase 1 bumps three)

| Tool                       | Version             | Note                                                        |
| -------------------------- | ------------------- | ----------------------------------------------------------- |
| `eslint`                   | `^10.2.1`           | Flat config required; no change                             |
| `@eslint/js`               | `^10.0.1`           | No change                                                   |
| `typescript-eslint`        | `^8.59.1`           | No change                                                   |
| `@stylistic/eslint-plugin` | `^5.10.0`           | No change                                                   |
| `eslint-plugin-import-x`   | `^4.16.2`           | No change; provides `no-restricted-paths` rule for D-11     |
| `globals`                  | `^17.6.0`           | Bump per D-04 (was `^17.5.0`)                               |
| `prettier`                 | `^3.8.3`            | Bump per D-04 (was `^3.6.2`)                                |
| `tsx`                      | **REMOVE** per D-02 | Node 24 strips TS natively; `--import tsx` no longer needed |
| `node:test`                | built-in            | Test framework (already in V1)                              |

**Verified version provenance** (`npm view <pkg> version` on 2026-05-09):

```text
write-file-atomic        8.0.0   engines: ^22.22.2 || ^24.15.0 || >=26.0.0
isomorphic-git           1.37.6  engines: >=14.17 (no upper bound)
eslint-plugin-import-x   4.16.2  engines: ^18.18.0 || ^20.9.0 || >=21.1.0
@mariozechner/pi-coding-agent  0.73.1  engines: >=20.6.0
typebox                  1.1.38
prettier                 3.8.3
globals                  17.6.0
```

### Alternatives Considered (and rejected -- locked by discuss-phase)

| Instead of                                          | Could Use                              | Why Rejected (per CONTEXT.md / STACK.md)                                                             |
| --------------------------------------------------- | -------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `write-file-atomic@^8`                              | Hand-rolled tmp+rename                 | V1's hand-rolled write lacks parent-dir `fsync` (Pitfall #2). `write-file-atomic` fsyncs by default. |
| `isomorphic-git`                                    | `child_process.execFile("git", [...])` | Drops `git` CLI dependency (no PATH lookups, no command-injection surface, no stderr-regex parsing). |
| `eslint no-restricted-syntax` for output discipline | Custom ESLint rule                     | `no-restricted-syntax` is sufficient for V1; custom rule deferred (Specific Ideas in CONTEXT.md).    |
| Node 22 LTS line                                    | Node 22 + Node 24 + Node 26 matrix     | D-01 picks Node 24 only; multi-version matrix maintenance overhead not justified.                    |

**Installation (planner: this is the exact npm invocation):**

```bash
# Add the new runtime dep
npm install write-file-atomic@^8 isomorphic-git@^1.37.6

# Bump dev deps per D-04
npm install -D typebox@^1.1.38 prettier@^3.8.3 globals@^17.6.0

# Drop tsx per D-02
npm uninstall tsx

# Pin pi-coding-agent peer-dep floor per D-05 (edit package.json directly -- npm install
# does not edit `peerDependencies`):
#   "peerDependencies": {
#     "@mariozechner/pi-coding-agent": ">=0.70.6",  ← interim floor
#     "typebox": "*"
#   }
```

______________________________________________________________________

## Architecture Patterns

### System Architecture (Phase 1 endstate)

```text
┌──────────────────────────────────────────────────────────────────┐
│  Pi runtime (node 24 host)                                       │
└──────────────────────────────┬───────────────────────────────────┘
                               │ loads via package.json `pi.extensions`
                               ▼
┌──────────────────────────────────────────────────────────────────┐
│  extensions/pi-claude-marketplace/index.ts                          │
│  (default-export factory: (pi: ExtensionAPI) => void)            │
│  Registers: pi.registerCommand("claude:plugin", ...)             │
│             pi.on("resources_discover", ...)                     │
│  At Phase 1 end: handlers stub-out to "not implemented yet"      │
│  via notifyWarning(ctx, ...). edge/ folder is empty.             │
└─────┬─────────────────────────────────────────────────────────┬──┘
      │ imports                                                  │
      ▼                                                          ▼
┌─────────────────────────┐                          ┌─────────────────────────┐
│  shared/                │  ◄── all 9 folders may   │  platform/git.ts        │
│   ├ markers.ts          │      import shared/      │  (isomorphic-git facade │
│   ├ notify.ts           │                          │   -- empty body, only    │
│   ├ path-safety.ts      │                          │   exports + types in    │
│   ├ atomic-json.ts      │                          │   Phase 1)              │
│   └ errors.ts (V1 port) │                          └─────────────────────────┘
└─────────────────────────┘
        ▲
        │ snapshot test
┌─────────────────────────────────────────────────────────────────┐
│  tests/architecture/markers-snapshot.test.ts                     │
│   reads docs/prd/pi-claude-marketplace-prd.md at runtime,        │
│   extracts §6.12 ES-5 strings via regex,                         │
│   asserts shared/markers.ts exports match byte-for-byte          │
└─────────────────────────────────────────────────────────────────┘
        ▲
        │ also asserted
┌─────────────────────────────────────────────────────────────────┐
│  tests/architecture/import-boundaries.test.ts                    │
│   asserts eslint.config.js's no-restricted-paths zones list      │
│   matches the 9-folder layering spec (regression guard for D-11) │
└─────────────────────────────────────────────────────────────────┘
```

The diagram traces the primary use-case: `pi-coding-agent` loads `index.ts`, which imports from `shared/` for the things every layer needs (markers, notify, atomic-json, path-safety, errors). `platform/git.ts` is wired into the import graph but has no callers in Phase 1 -- its presence is purely about establishing the import boundary so Phase 4 doesn't fight the rules.

### Recommended Project Structure (after Phase 1)

```text
extensions/pi-claude-marketplace/
├── index.ts                              # Pi entrypoint (D-13)
├── edge/                                 # EMPTY in P1 (Phase 6)
│   └── README.md
├── orchestrators/                        # EMPTY in P1 (Phases 4, 5)
│   └── README.md
├── bridges/                              # EMPTY in P1 (Phase 3)
│   └── README.md
├── domain/                               # EMPTY in P1 (Phase 2)
│   └── README.md
├── transaction/                          # EMPTY in P1 (Phase 2)
│   └── README.md
├── persistence/                          # EMPTY in P1 (Phase 2)
│   └── README.md
├── presentation/                         # EMPTY in P1 (Phase 4-6)
│   └── README.md
├── platform/
│   ├── README.md
│   └── git.ts                            # NEW: isomorphic-git wrapper
└── shared/
    ├── README.md
    ├── markers.ts                        # NEW: ES-5 constants (D-08)
    ├── notify.ts                         # NEW: severity-named wrappers (D-07)
    ├── path-safety.ts                    # NEW: symlink-aware containment (D-14..17)
    ├── atomic-json.ts                    # NEW: write-file-atomic facade (D-03)
    └── errors.ts                         # PORTED from V1 errors.ts (carry-forward)

tests/
├── architecture/
│   ├── markers-snapshot.test.ts          # NEW: D-09 snapshot test
│   └── import-boundaries.test.ts         # NEW: defends D-11 from regression
└── shared/
    ├── path-safety.test.ts               # symlink-walk happy path + 6 attack fixtures
    ├── atomic-json.test.ts               # concurrent-write serialization smoke test
    └── notify.test.ts                    # severity-name wrappers smoke
```

### Pattern 1: `write-file-atomic@^8` API surface

**What:** Promise-native atomic JSON write with fsync-by-default. **When to use:** Every JSON file write that participates in `withStateGuard` (Phase 2+). NOT for committing staging-directory trees (different problem; keep V1's `mkdir`+write+`rename` for those).

**Verified surface** (from on-disk `node_modules/write-file-atomic/lib/index.js` README on 2026-05-09):

```typescript
// ESM import shape (the package's main is `./lib/index.js` declared as CJS;
// Node's CJS-named-exports interop accepts this default-import pattern):
import writeFileAtomic from "write-file-atomic";

// or, if the type-checker complains about default import:
import * as writeFileAtomicNS from "write-file-atomic";
const writeFileAtomic = writeFileAtomicNS.default ?? writeFileAtomicNS;

// Async usage (await):
await writeFileAtomic(filename, data, options?);

// Sync usage (NOT recommended for V1 -- V1's atomicWriteJson is async):
writeFileAtomic.sync(filename, data, options?);

// Options (all optional):
type WfaOptions = {
  encoding?: string | null;        // default "utf8"
  fsync?: boolean;                 // default true ← important for NFR-1 durability
  mode?: number | false;           // default: inherits from existing file; false = system default
  chown?: { uid: number; gid: number } | false;  // default: inherits from existing
  tmpfileCreated?: (tmpName: string) => void;   // hook for cleanup-on-crash
};
```

**Concrete `shared/atomic-json.ts` shape (planner: tasks should produce this):**

```typescript
// shared/atomic-json.ts
import writeFileAtomic from "write-file-atomic";
import { mkdir } from "node:fs/promises";
import path from "node:path";

/**
 * Atomic JSON write: creates parent dir if missing, serializes pretty,
 * fsyncs by default. Replaces V1's hand-rolled `atomicWriteJson` in
 * `fs-utils.ts`. Concurrent writes to the same path serialize via
 * write-file-atomic's internal queue; ordering is FIFO.
 */
export async function atomicWriteJson(filePath: string, value: unknown): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  // write-file-atomic adds a unique tmp suffix automatically; no need to
  // generate one ourselves. fsync defaults to true (NFR-1 durability).
  await writeFileAtomic(filePath, JSON.stringify(value, null, 2) + "\n", {
    encoding: "utf8",
    // chown intentionally omitted: V1 had a comment about not inheriting
    // ownership from a privileged tmp. write-file-atomic's default IS to
    // inherit from existing file; pass `chown: false` if a future audit
    // surfaces a privilege concern.
  });
}
```

**Gotchas:**

- `chown` default behavior **inherits ownership from the existing file**. Test fixtures running under root (Docker CI) and writing into a user-owned scope dir could land an unexpected owner on the rewritten file. If CI does that: pass `chown: false`. For V1 + Node 24 single-user dev/CI this is moot.
- The library writes the tmp file as `<destname>.<murmurhash>` -- same dir, same FS as destination. EXDEV cannot happen for a single-file write through this lib (Pitfall #1 mitigated for JSON writes; it remains a concern for staging-dir tree commits).
- `signal-exit` is a transitive dep -- installs a process-exit handler that cleans up tmp files on crash. Acceptable; no other Phase 1 code touches signal handlers.

### Pattern 2: Symlink-aware `assertPathInside` (D-14, D-15, D-16, D-17)

**What:** Containment check that walks every parent component from the boundary down with `fs.lstat()`, refusing if any component is a symlink. **When to use:** EVERY name-derived path. Single chokepoint (D-15).

**Why `lstat()` not `stat()`:** Per Node docs (verified 2026-05-09), `lstat` returns the `Stats` of the link itself (NOT the target). `stat()` follows symlinks transparently and would silently traverse a malicious link. `Stats.isSymbolicLink()` returns true for the offending entry.

**Concrete `shared/path-safety.ts` shape:**

```typescript
// shared/path-safety.ts
import { lstat } from "node:fs/promises";
import path from "node:path";

export class PathContainmentError extends Error {
  readonly parent: string;
  readonly child: string;
  constructor(parent: string, child: string, label: string) {
    super(`${label} escapes ${parent} (resolved: ${child}).`);
    this.name = "PathContainmentError";
    this.parent = parent;
    this.child = child;
  }
}

/** Distinct error class for "symlink found in path components" -- distinguishable via instanceof
 *  but inherits PI-14 handling so it propagates loudly (D-17). */
export class SymlinkRefusedError extends PathContainmentError {
  readonly linkPath: string;
  readonly linkTarget: string;
  constructor(parent: string, child: string, label: string, linkPath: string, linkTarget: string) {
    super(parent, child, label);
    this.name = "SymlinkRefusedError";
    this.message = `${label} contains symlink ${linkPath} → ${linkTarget} (parent: ${parent}, target: ${child}).`;
    this.linkPath = linkPath;
    this.linkTarget = linkTarget;
  }
}

function isPathInside(parent: string, child: string): boolean {
  const relative = path.relative(parent, child);
  return (
    relative === "" ||
    (relative !== ".." && !relative.startsWith(".." + path.sep) && !path.isAbsolute(relative))
  );
}

/**
 * Refuse if `child` is not contained by `parent`, OR if any path component
 * from `parent` down to `child` (inclusive of `child` if it exists) is a symlink.
 *
 * Walks components by computing `path.relative(parent, child)` and applying
 * each segment to `parent` in turn. Per-component cost: 1× lstat() per segment.
 * Negligible compared to the IO that follows.
 *
 * Note: TOCTOU race -- between this check returning and the actual write, an
 * attacker with write access to a parent dir could insert a symlink. V1's
 * threat model is "careless or malicious *plugin author*", not "concurrent
 * in-process attacker", so this residual risk is acceptable. Documented
 * here so a future hardening pass can find it.
 */
export async function assertPathInside(
  parent: string,
  child: string,
  label: string,
): Promise<void> {
  // String-level containment check first -- cheap, runs without touching the FS.
  if (!isPathInside(parent, child)) {
    throw new PathContainmentError(parent, child, label);
  }

  // Walk every parent component from `parent` down to `child` (inclusive).
  // We start AT `parent` (not above it -- the boundary itself is trusted) and
  // descend toward `child`, lstat'ing each intermediate path.
  const relative = path.relative(parent, child);
  const segments = relative === "" ? [] : relative.split(path.sep);

  let current = parent;
  for (const segment of segments) {
    current = path.join(current, segment);
    try {
      const stats = await lstat(current);
      if (stats.isSymbolicLink()) {
        // Read the target for the error message; ENOENT-tolerant by intent
        // (the link could vanish between lstat and readlink -- unlikely but possible).
        let target = "<unreadable>";
        try {
          const { readlink } = await import("node:fs/promises");
          target = await readlink(current);
        } catch {
          // Leave target as "<unreadable>"; the link path itself is what matters.
        }
        throw new SymlinkRefusedError(parent, child, label, current, target);
      }
    } catch (err) {
      // ENOENT on a not-yet-existing leaf is fine -- this function is called
      // BEFORE writes (e.g., creating a new agent file). Only re-raise other errors.
      const code = (err as NodeJS.ErrnoException).code;
      if (code === "ENOENT") {
        // The path doesn't exist yet; nothing more to walk. Caller will create it.
        return;
      }
      throw err;
    }
  }
}
```

**Tests the planner should specify:**

1. Happy path: `assertPathInside("/scope", "/scope/foo/bar", "label")` does not throw.
2. Direct escape: `assertPathInside("/scope", "/etc/passwd", "label")` throws `PathContainmentError` (NOT `SymlinkRefusedError`).
3. Leaf symlink: create `/scope/agents/innocent.md` as a symlink to `/etc/passwd`; `assertPathInside("/scope", "/scope/agents/innocent.md", "label")` throws `SymlinkRefusedError` with `linkTarget: "/etc/passwd"`.
4. Parent-component symlink: create `/scope/agents` as a symlink to `/var/external`; `assertPathInside("/scope", "/scope/agents/foo.md", "label")` throws `SymlinkRefusedError` (the OFFENDING `linkPath` is `/scope/agents`).
5. Non-existent leaf (write-target case): `assertPathInside("/scope", "/scope/agents/not-yet-created.md", "label")` does not throw, even though the leaf doesn't exist.
6. ENOENT mid-walk: identical to (5) -- the function returns early on ENOENT.
7. Distinct error classes: `err instanceof PathContainmentError` is true for both error types (D-17 inheritance); `err instanceof SymlinkRefusedError` distinguishes.

### Pattern 3: ESLint `no-restricted-syntax` for output discipline (D-06)

**What:** AST-selector-based bans on direct stdout/stderr/console writes inside `extensions/pi-claude-marketplace/`.

**Verified selector grammar** (from ESLint docs + selector-syntax verification on 2026-05-09):

The selector for `process.stdout.write(...)` is a `CallExpression` whose callee is a chain of two nested `MemberExpression`s:

```text
process . stdout . write ( ... )
  ↑       ↑       ↑
identifier obj  property
       ↑   ↑
   member member
   expr   expr (callee)
```

That maps to `callee.object.object.name === "process"`, `callee.object.property.name === "stdout"`, `callee.property.name === "write"`.

**Concrete `eslint.config.js` block (planner: copy-paste this into the existing flat config, scoped to `extensions/pi-claude-marketplace/`):**

```javascript
// eslint.config.js -- append to the existing flat-config array

{
  files: ["extensions/pi-claude-marketplace/**/*.ts"],
  rules: {
    // D-06: Output discipline (IL-2, IL-3).
    // Direct stdout/stderr writes and console.* calls are forbidden in the
    // extension. Sanctioned exception: load-time migrate-record save failure
    // in `migrateLegacyMarketplaceRecords` (IL-3) -- disabled inline at the
    // single callsite with `// eslint-disable-next-line no-restricted-syntax`.
    "no-restricted-syntax": [
      "error",
      {
        selector:
          "CallExpression[callee.object.object.name='process'][callee.object.property.name='stdout'][callee.property.name='write']",
        message:
          "Direct process.stdout.write is forbidden in the extension (IL-2). Use ctx.ui.notify via shared/notify.ts wrappers.",
      },
      {
        selector:
          "CallExpression[callee.object.object.name='process'][callee.object.property.name='stderr'][callee.property.name='write']",
        message:
          "Direct process.stderr.write is forbidden in the extension (IL-2). Use ctx.ui.notify via shared/notify.ts wrappers.",
      },
      {
        selector:
          "CallExpression[callee.object.name='console'][callee.property.name='log']",
        message:
          "console.log is forbidden in the extension (IL-2). Use ctx.ui.notify via shared/notify.ts wrappers.",
      },
      {
        selector:
          "CallExpression[callee.object.name='console'][callee.property.name='warn']",
        message:
          "console.warn is forbidden in the extension (IL-3) except at the single sanctioned migrateLegacyMarketplaceRecords callsite (use eslint-disable-next-line with a comment citing IL-3).",
      },
      {
        selector:
          "CallExpression[callee.object.name='console'][callee.property.name='error']",
        message:
          "console.error is forbidden in the extension (IL-2). Use notifyError(ctx, ..., cause) via shared/notify.ts wrappers.",
      },
      {
        selector:
          "CallExpression[callee.object.name='console'][callee.property.name='info']",
        message:
          "console.info is forbidden in the extension (IL-2). Use ctx.ui.notify via shared/notify.ts wrappers.",
      },
    ],

    // The existing `"no-console": "warn"` rule should be elevated to "error"
    // for the extension scope (it covers any console.<method> the AST
    // selectors above missed, e.g., console.debug, console.trace).
    "no-console": "error",
  },
},

// Tests get a per-block override that turns the rule back off -- tests can
// console.log freely.
{
  files: ["tests/**/*.ts"],
  rules: {
    "no-restricted-syntax": "off",
    "no-console": "off",
  },
},
```

**Gotchas:**

- The 6 selectors above are **redundant with `no-console: error`** for `console.*` calls. Keep both: the selector messages cite IL-2/IL-3 by ID (better DX); `no-console` catches `console.debug`/`console.trace`/`console.dir` without enumerating each.

- `no-restricted-syntax` overrides earlier `no-restricted-syntax` configs in the same flat-config array (it does NOT merge). Land all 6 selectors in one config object.

- The sanctioned `console.warn` callsite (IL-3) lives in `persistence/state-io.ts` (Phase 2). Phase 1 doesn't write that file; Phase 2's planner needs to know the disable-comment incantation:

  ```typescript
  // Phase 2 will write:
  try {
    await atomicWriteJson(stateJsonPath, migrated);
  } catch (err) {
    // IL-3: load-time migration save is the SINGLE sanctioned console.warn site.
    // Throwing would block reads; warn-and-continue lets users keep working.
    // eslint-disable-next-line no-restricted-syntax, no-console
    console.warn(`pi-claude-marketplace: failed to persist migrated state.json: ${errorMessage(err)}`);
  }
  ```

### Pattern 4: ESLint `import-x/no-restricted-paths` for layer enforcement (D-11)

**Verified rule shape** (from `node_modules/eslint-plugin-import-x/lib/rules/no-restricted-paths.d.ts`):

```typescript
interface Options {
  basePath?: string;
  zones?: Array<{
    from: Arrayable<string>;     // forbidden source(s)
    target: Arrayable<string>;   // consumer (files being linted)
    message?: string;
    except?: string[];
  }>;
}
```

`target` = consumer (the file with the bad import); `from` = forbidden source. To express "edge/ may NOT import from anything except orchestrators/, presentation/, shared/", you encode the **forbidden** sources, not the allowed ones.

**Concrete zone list for the 9-folder layering (D-11):**

```javascript
// eslint.config.js -- append to the same flat-config array

{
  files: ["extensions/pi-claude-marketplace/**/*.ts"],
  plugins: { "import-x": importX }, // already in repo
  rules: {
    "import-x/no-restricted-paths": [
      "error",
      {
        basePath: import.meta.dirname,
        zones: [
          // edge/ may import from: orchestrators/, presentation/, shared/.
          // Forbid imports from everything else.
          {
            target: "./extensions/pi-claude-marketplace/edge",
            from: [
              "./extensions/pi-claude-marketplace/bridges",
              "./extensions/pi-claude-marketplace/domain",
              "./extensions/pi-claude-marketplace/transaction",
              "./extensions/pi-claude-marketplace/persistence",
              "./extensions/pi-claude-marketplace/platform",
            ],
            message: "edge/ may only import from orchestrators/, presentation/, shared/.",
          },
          // orchestrators/ may import from: bridges/, domain/, transaction/,
          // persistence/, presentation/, platform/, shared/.
          // Forbid imports from edge/.
          {
            target: "./extensions/pi-claude-marketplace/orchestrators",
            from: ["./extensions/pi-claude-marketplace/edge"],
            message: "orchestrators/ MUST NOT import from edge/.",
          },
          // bridges/ may import from: domain/, persistence/, shared/.
          // Forbid imports from edge/, orchestrators/, transaction/, presentation/, platform/.
          {
            target: "./extensions/pi-claude-marketplace/bridges",
            from: [
              "./extensions/pi-claude-marketplace/edge",
              "./extensions/pi-claude-marketplace/orchestrators",
              "./extensions/pi-claude-marketplace/transaction",
              "./extensions/pi-claude-marketplace/presentation",
              "./extensions/pi-claude-marketplace/platform",
            ],
            message:
              "bridges/ may only import from domain/, persistence/, shared/. Cross-bridge imports are also forbidden -- bridges/skills cannot import bridges/agents (use a domain-level abstraction).",
          },
          // domain/ has no upward imports -- pure logic.
          {
            target: "./extensions/pi-claude-marketplace/domain",
            from: [
              "./extensions/pi-claude-marketplace/edge",
              "./extensions/pi-claude-marketplace/orchestrators",
              "./extensions/pi-claude-marketplace/bridges",
              "./extensions/pi-claude-marketplace/transaction",
              "./extensions/pi-claude-marketplace/persistence",
              "./extensions/pi-claude-marketplace/presentation",
              "./extensions/pi-claude-marketplace/platform",
            ],
            message: "domain/ MUST NOT import upward -- pure logic only. shared/ is the only sibling import allowed.",
          },
          // transaction/ may import from: persistence/, shared/.
          {
            target: "./extensions/pi-claude-marketplace/transaction",
            from: [
              "./extensions/pi-claude-marketplace/edge",
              "./extensions/pi-claude-marketplace/orchestrators",
              "./extensions/pi-claude-marketplace/bridges",
              "./extensions/pi-claude-marketplace/domain",
              "./extensions/pi-claude-marketplace/presentation",
              "./extensions/pi-claude-marketplace/platform",
            ],
            message: "transaction/ may only import from persistence/, shared/.",
          },
          // persistence/ may import from: domain/, shared/.
          {
            target: "./extensions/pi-claude-marketplace/persistence",
            from: [
              "./extensions/pi-claude-marketplace/edge",
              "./extensions/pi-claude-marketplace/orchestrators",
              "./extensions/pi-claude-marketplace/bridges",
              "./extensions/pi-claude-marketplace/transaction",
              "./extensions/pi-claude-marketplace/presentation",
              "./extensions/pi-claude-marketplace/platform",
            ],
            message: "persistence/ may only import from domain/, shared/.",
          },
          // presentation/ may import from: domain/, shared/.
          {
            target: "./extensions/pi-claude-marketplace/presentation",
            from: [
              "./extensions/pi-claude-marketplace/edge",
              "./extensions/pi-claude-marketplace/orchestrators",
              "./extensions/pi-claude-marketplace/bridges",
              "./extensions/pi-claude-marketplace/transaction",
              "./extensions/pi-claude-marketplace/persistence",
              "./extensions/pi-claude-marketplace/platform",
            ],
            message: "presentation/ may only import from domain/, shared/.",
          },
          // platform/ may import from: shared/. Strictly external-system facade.
          {
            target: "./extensions/pi-claude-marketplace/platform",
            from: [
              "./extensions/pi-claude-marketplace/edge",
              "./extensions/pi-claude-marketplace/orchestrators",
              "./extensions/pi-claude-marketplace/bridges",
              "./extensions/pi-claude-marketplace/domain",
              "./extensions/pi-claude-marketplace/transaction",
              "./extensions/pi-claude-marketplace/persistence",
              "./extensions/pi-claude-marketplace/presentation",
            ],
            message:
              "platform/ may only import from shared/. It's the external-system boundary (git, Pi API surface).",
          },
          // shared/ may import from: nothing in the extension. Pure leaves.
          {
            target: "./extensions/pi-claude-marketplace/shared",
            from: [
              "./extensions/pi-claude-marketplace/edge",
              "./extensions/pi-claude-marketplace/orchestrators",
              "./extensions/pi-claude-marketplace/bridges",
              "./extensions/pi-claude-marketplace/domain",
              "./extensions/pi-claude-marketplace/transaction",
              "./extensions/pi-claude-marketplace/persistence",
              "./extensions/pi-claude-marketplace/presentation",
              "./extensions/pi-claude-marketplace/platform",
            ],
            message: "shared/ MUST NOT import from any extension folder. Pure leaves only.",
          },
        ],
      },
    ],
  },
},
```

**Verification recipe (planner: encode this as a test in `tests/architecture/import-boundaries.test.ts`):**

Read `eslint.config.js` (or import it dynamically -- it's already ESM), find the `import-x/no-restricted-paths` rule's `zones` array, assert it has exactly 9 entries (one per folder), and assert each entry's `target` and `from` match a hardcoded expected map. This catches the regression mode where someone adds a new folder but forgets to add its zone -- the missing zone means the new folder has zero boundary enforcement and silently becomes a free-for-all.

### Pattern 5: `isomorphic-git` wrapper at `platform/git.ts` (D-18, D-19, D-20)

**What:** Pure-JS git operations -- clone, fetch, pull, checkout, resolveRef. No `git` CLI required. **When to use:** Phase 4's `marketplace add` / `marketplace update` orchestrators. Phase 1 lands the wrapper module with no callers.

**Verified API surface** (from `node_modules/isomorphic-git/index.d.ts` + `http/node/index.d.ts` on 2026-05-09):

```typescript
import * as git from "isomorphic-git";
import http from "isomorphic-git/http/node";
import * as fs from "node:fs";

// Type signatures (extracted from .d.ts):
git.clone({
  fs: typeof fs,                         // FsClient -- Node's `fs` module is directly compatible
  http: HttpClient,                      // ← isomorphic-git/http/node default export
  dir: string,                           // working tree dir
  gitdir?: string,                       // default join(dir, ".git")
  url: string,                           // remote URL -- only https://github.com/ in V1 (SP-3)
  ref?: string,                          // branch or tag, e.g. "main" or a SHA
  singleBranch?: boolean,                // default false; true if a marketplace pins a #ref
  noCheckout?: boolean,                  // default false
  noTags?: boolean,                      // default false
  remote?: string,                       // default "origin"
  depth?: number,                        // history depth -- DO NOT set in V1 (sparse/shallow deferred)
  headers?: Record<string, string>,
  onProgress?: (e: GitProgressEvent) => void,
  onMessage?: (msg: string) => void,
  onAuth?: AuthCallback,
  onAuthFailure?: AuthFailureCallback,
  onAuthSuccess?: AuthSuccessCallback,
  cache?: object,
}): Promise<void>;

git.fetch({...}): Promise<FetchResult>;
git.pull({...}): Promise<void>;
git.checkout({fs, dir, ref, ...}): Promise<void>;
git.resolveRef({fs, dir, ref}): Promise<string>;        // returns SHA-1 string
git.listBranches({fs, dir, remote?}): Promise<string[]>;
git.listRemotes({fs, dir, gitdir?}): Promise<{remote: string, url: string}[]>;
```

**Package layout gotchas:**

- `isomorphic-git` itself ships as **dual-format**: `main: "./index.cjs"`, `module: "./index.js"` (ESM). The package's own `"type": "module"` is set; from an ESM consumer (this repo, `"type": "module"`) imports resolve to the ESM bundle.
- The TypeScript `typings` field points to `index.d.cts` -- there's both `.d.ts` and `.d.cts`. Under `tsconfig`'s `module: "NodeNext"` (current setting), Node's resolver picks the right one automatically.
- The HTTP transport at `isomorphic-git/http/node` is **explicitly exported** in the package's `"exports"` map and has both ESM and CJS variants. Verified `http: HttpClient` shape: `{ request: (req: GitHttpRequest) => Promise<GitHttpResponse> }`. The default export is suitable as-is.

**Concrete `platform/git.ts` shape (Phase 1: just the wrapper; Phase 4 adds callers):**

```typescript
// platform/git.ts
import * as git from "isomorphic-git";
import http from "isomorphic-git/http/node";
import * as fs from "node:fs";

/**
 * Wrapper around isomorphic-git pinning the fs and http transports so callers
 * (Phase 4 marketplace orchestrators) don't have to thread them through every
 * call. All public V1 git operations route through here per D-20.
 *
 * NOT exposed:
 *   - sparse checkout (PRD §11 deferred; isomorphic-git doesn't support it anyway)
 *   - shallow clones / depth (deferred until needed)
 *   - submodules (V1 doesn't follow git submodules -- see Pitfall #14)
 */

export interface CloneOptions {
  /** Working-tree directory. Must be on the same filesystem as its destination
   *  parent if the caller plans to atomic-rename a clone into place (V1 pattern). */
  dir: string;
  /** Remote URL -- V1 accepts only https://github.com/<owner>/<repo>[.git] (SP-3). */
  url: string;
  /** Optional ref (branch/tag/SHA) to check out. If omitted, default branch. */
  ref?: string;
  /** If a specific ref is given, fetch only that branch -- saves bandwidth. */
  singleBranch?: boolean;
  /** Aborts the operation. */
  signal?: AbortSignal;
}

export async function clone(opts: CloneOptions): Promise<void> {
  await git.clone({
    fs,
    http,
    dir: opts.dir,
    url: opts.url,
    ...(opts.ref !== undefined && { ref: opts.ref }),
    ...(opts.singleBranch !== undefined && { singleBranch: opts.singleBranch }),
    // No corsProxy -- V1 only runs in Node, never browser.
    // No onAuth -- public GitHub repos only in V1.
    // No depth -- V1 keeps full history (parsing tags / refs depends on it).
  });
}

export async function fetch(opts: { dir: string; remote?: string; ref?: string }): Promise<git.FetchResult> {
  return git.fetch({
    fs,
    http,
    dir: opts.dir,
    ...(opts.remote !== undefined && { remote: opts.remote }),
    ...(opts.ref !== undefined && { ref: opts.ref }),
  });
}

// pull/checkout/resolveRef wrappers same shape -- Phase 4's planner extends.
```

**`memfs` for tests (per CONTEXT.md Specific Ideas):**

isomorphic-git's `fs` parameter accepts any object implementing the `FsClient` interface. `memfs@^4.x` is the standard in-memory replacement. Phase 1 should add `memfs` as a **devDependency** (not runtime) and wire test fixtures so future Phase 4 git tests don't require disk IO. **Reference:** isomorphic-git's own test suite uses memfs. Verified `memfs@4.57.2` is current latest as of 2026-05-09.

```bash
npm install -D memfs@^4.57.2
```

### Pattern 6: `shared/markers.ts` and the PRD-driven snapshot test (D-08, D-09)

**The 5 ES-5 marker strings** (verbatim from PRD §6.12 lines 605-611, with the gitlint-grade strings extracted):

| Const name                  | Verbatim string from PRD §6.12 ES-5      |
| --------------------------- | ---------------------------------------- |
| `PI_SUBAGENTS_NOT_LOADED`   | `pi-subagents is not loaded; …`          |
| `PI_MCP_ADAPTER_NOT_LOADED` | `pi-mcp-adapter is not loaded; …`        |
| `RELOAD_HINT_PREFIX`        | `Run /reload to <verb> …`                |
| `MANUAL_RECOVERY_REQUIRED`  | `MANUAL RECOVERY REQUIRED: …`            |
| `ROLLBACK_PARTIAL`          | `(rollback partial: [<phase>] <msg>; …)` |

The PRD lists these strings as templates with `…` and `<…>` placeholders. The exported constants in `shared/markers.ts` must contain the **stable prefix** of each string -- the part that's user contract -- without the runtime-substituted suffix. The snapshot test asserts the exported constants are byte-for-byte equal to the PRD's prefix (everything up to the first `<` or `…`).

**Concrete `shared/markers.ts` shape:**

```typescript
// shared/markers.ts
//
// PRD §6.12 ES-5 user-contract strings ("gitlint-grade"). DO NOT EDIT
// without updating docs/prd/pi-claude-marketplace-prd.md §6.12 in the same
// commit. The snapshot test at tests/architecture/markers-snapshot.test.ts
// reads the PRD at runtime and asserts these constants match byte-for-byte.

export const PI_SUBAGENTS_NOT_LOADED = "pi-subagents is not loaded; ";
export const PI_MCP_ADAPTER_NOT_LOADED = "pi-mcp-adapter is not loaded; ";
export const RELOAD_HINT_PREFIX = "Run /reload to ";
export const MANUAL_RECOVERY_REQUIRED = "MANUAL RECOVERY REQUIRED: ";
export const ROLLBACK_PARTIAL = "(rollback partial: ";
```

**Snapshot test pattern (`tests/architecture/markers-snapshot.test.ts`):**

```typescript
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as markers from "../../extensions/pi-claude-marketplace/shared/markers.ts";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const PRD_PATH = path.join(REPO_ROOT, "docs/prd/pi-claude-marketplace-prd.md");

test("ES-5 markers in shared/markers.ts match PRD §6.12 verbatim", async () => {
  const prd = await readFile(PRD_PATH, "utf8");

  // PRD §6.12 ES-5 row contains all 5 markers in a single table cell separated
  // by semicolons. Pull the row, extract each backtick-delimited literal,
  // and assert it starts with the exported constant.
  //
  // Extraction strategy: find the line starting with "| **ES-5** |" and pull
  // every backtick-quoted substring. Cross-check count == 5 and content.

  const es5RowMatch = prd.match(/^\|\s*\*\*ES-5\*\*\s*\|.*$/m);
  assert.ok(es5RowMatch, "PRD §6.12 ES-5 row not found -- has the PRD been refactored?");

  const backtickRe = /`([^`]+)`/g;
  const literals: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = backtickRe.exec(es5RowMatch[0])) !== null) {
    literals.push(m[1]);
  }

  assert.equal(
    literals.length,
    5,
    `Expected 5 backtick-quoted ES-5 markers in PRD §6.12, found ${literals.length}: ${JSON.stringify(literals)}`,
  );

  // Each PRD literal contains the stable prefix followed by `…` or `<...>`
  // for runtime-substituted parts. The exported constant is the prefix.
  const expectedExports: ReadonlyArray<readonly [string, string]> = [
    [markers.PI_SUBAGENTS_NOT_LOADED, "pi-subagents is not loaded; …"],
    [markers.PI_MCP_ADAPTER_NOT_LOADED, "pi-mcp-adapter is not loaded; …"],
    [markers.RELOAD_HINT_PREFIX, "Run /reload to <verb> …"],
    [markers.MANUAL_RECOVERY_REQUIRED, "MANUAL RECOVERY REQUIRED: …"],
    [markers.ROLLBACK_PARTIAL, "(rollback partial: [<phase>] <msg>; …)"],
  ];

  for (const [exported, prdLiteral] of expectedExports) {
    assert.ok(
      literals.includes(prdLiteral),
      `Expected PRD literal ${JSON.stringify(prdLiteral)} not found in PRD §6.12 row. PRD literals: ${JSON.stringify(literals)}`,
    );
    // Stability check: the exported constant must be a prefix of the PRD literal,
    // ignoring the trailing placeholder. Compute the prefix by stripping anything
    // from the first `<` or `…` onward.
    const expectedPrefix = prdLiteral.replace(/[<…].*$/, "");
    assert.equal(
      exported,
      expectedPrefix,
      `Marker ${JSON.stringify(exported)} does not match PRD prefix ${JSON.stringify(expectedPrefix)}`,
    );
  }
});
```

**Helper extraction note (per CONTEXT.md Specific Idea):** The PRD-parsing logic is reusable. Extract `extractEs5MarkerLiterals(prd: string): string[]` into `tests/helpers/prd-extract.ts` so future phases (3 and 5) can verify their own marker emissions against the PRD. Phase 1 is the right place to land the helper.

### Pattern 7: `shared/notify.ts` -- severity-named wrappers (D-07)

**What:** Three named functions enforce ES-1/ES-2 severity at compile time.

```typescript
// shared/notify.ts
import type { ExtensionContext } from "@mariozechner/pi-coding-agent";

/** Success notify -- default severity, no third arg in the Pi API. */
export function notifySuccess(ctx: ExtensionContext, message: string): void {
  // eslint-disable-next-line no-restricted-syntax -- the wrapper IS the sanctioned site for ctx.ui.notify
  ctx.ui.notify(message); // pi-coding-agent treats omitted type as "info" / default
}

/** Warning notify -- used for cleanup leaks, partial failures, soft-dep warnings. */
export function notifyWarning(ctx: ExtensionContext, message: string): void {
  // eslint-disable-next-line no-restricted-syntax
  ctx.ui.notify(message, "warning");
}

/** Error notify -- operation did not succeed; state unchanged or fully rolled back.
 *  Optional `cause` feeds Error.cause for ES-4 chain traversal. The cause is
 *  formatted into the message tail via formatErrorWithCauses (Phase 6) -- for
 *  Phase 1 the wrapper just surfaces `cause.message` flat. */
export function notifyError(ctx: ExtensionContext, message: string, cause?: unknown): void {
  const causeText = cause === undefined ? "" : `\nCause: ${cause instanceof Error ? cause.message : String(cause)}`;
  // eslint-disable-next-line no-restricted-syntax
  ctx.ui.notify(`${message}${causeText}`, "error");
}
```

**Why this shape:** D-07 specifies severity-named helpers because the Pi API's `notify(msg, type?)` accepts a magic-string `"info" | "warning" | "error"`. A typo at the callsite (`"warining"`) silently becomes `"info"` (per Pi types: `type?: "info" | "warning" | "error"` -- no exhaustiveness check). Severity-named wrappers eliminate that class of bug.

**No `notifyInfo`:** The default success path uses `notifySuccess`. The `info` severity in the Pi API is the same default; introducing two function names for one severity invites confusion.

**The `// eslint-disable-next-line` inside each wrapper** is the only sanctioned use of `ctx.ui.notify` in the entire codebase. The `no-restricted-syntax` rule should additionally forbid `ctx.ui.notify(` calls outside `shared/notify.ts`:

```javascript
// Add to the no-restricted-syntax block in eslint.config.js:
{
  selector: "CallExpression[callee.property.name='notify'][callee.object.property.name='ui']",
  message:
    "Direct ctx.ui.notify is forbidden -- use notifySuccess/notifyWarning/notifyError from shared/notify.ts (D-07).",
},
```

Then `shared/notify.ts` gets a per-file override that turns the rule off:

```javascript
{
  files: ["extensions/pi-claude-marketplace/shared/notify.ts"],
  rules: {
    "no-restricted-syntax": "off",
  },
},
```

### Pattern 8: `index.ts` Pi entrypoint skeleton (D-13)

**What:** Phase 1's `extensions/pi-claude-marketplace/index.ts` replaces the current stub. At Phase-1-end, it registers the `claude:plugin` command + `resources_discover` event handler, but both delegate to (currently empty) edge handlers. Goal is to have **a real Pi extension** that loads cleanly and notifies "not implemented yet" -- exactly mirroring what the current stub does, but in the new layout.

**Verified Pi API surface** (from `@mariozechner/pi-coding-agent@0.73.1`'s `dist/core/extensions/types.d.ts`, read from local `node_modules` on 2026-05-09):

- `ExtensionAPI.registerCommand(name, options)` -- options shape: `{ description?, getArgumentCompletions?, handler }`. `handler` signature: `(args: string, ctx: ExtensionCommandContext) => Promise<void>`.
- `ExtensionAPI.registerTool(tool: ToolDefinition<TParams, TDetails, TState>)` -- used by Phase 6 for the LLM-callable list tools. **NOT used in Phase 1's index.ts** -- the current stub registers `pi_claude_marketplace_list` but Phase 1 dropping it is fine (Phase 6 will re-register from `edge/handlers/list.ts`).
- `ExtensionAPI.on("resources_discover", handler)` -- handler returns `{ skillPaths?, promptPaths?, themePaths? }`. V1's `index.ts` already does this; Phase 1 should keep the V1 shape.
- `ExtensionContext.ui.notify(message, type?)` -- the only output channel. `type` is the optional `"info" | "warning" | "error"`.

**Concrete `index.ts` skeleton:**

```typescript
// extensions/pi-claude-marketplace/index.ts
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { notifyWarning } from "./shared/notify.ts";

export default function claudeMarketplaceExtension(pi: ExtensionAPI): void {
  // resources_discover: at Phase-1-end this still returns empty arrays. Phase 3
  // (skills/prompts bridges) will populate. We register the handler now so the
  // event contract is wired and the import-x boundary rules can verify the
  // index → edge dependency direction works.
  pi.on("resources_discover", async () => {
    // Phase 3: enumerate scope skill/prompt dirs via persistence/locations.
    return { skillPaths: [], promptPaths: [] };
  });

  pi.registerCommand("claude:plugin", {
    description:
      "Manage Claude plugin marketplaces and plugins. Usage: /claude:plugin <install|uninstall|update|list|marketplace> ...",
    handler: async (_args, ctx) => {
      notifyWarning(
        ctx,
        "Claude marketplace access is not implemented yet (Phase 6 lands the edge layer).",
      );
      // Phase 6: dispatch into edge/router.ts for sub-command routing.
      return Promise.resolve();
    },
  });

  // Phase 6 will additionally re-register the LLM-callable list tools (the
  // current stub's pi_claude_marketplace_list). Phase 1's index.ts deliberately
  // does NOT register tools -- they belong to edge/, which is empty in P1.
}
```

**Note on the sub-agent observation about `getArgumentCompletions`:** Per memory 924, `getArgumentCompletions` takes only `(argumentPrefix: string)` -- no `ctx`, no `cwd`. Phase 6 needs to handle this asymmetry; Phase 1 doesn't register completions yet, so it's not in scope here.

### Anti-Patterns to Avoid

- **Caching `pi.getAllTools()` between commands:** Pi extensions can be loaded/unloaded mid-session. Cache = stale-after-load bugs (Pitfall #2 in PITFALLS.md). Probe at use, not at extension-load. (Phase 1 doesn't probe yet -- it's relevant for Phase 5+ -- but the rule should be in `presentation/README.md`.)
- **Falling back to `copyFile + unlink` on EXDEV:** Silently downgrades atomicity. Treat EXDEV as a misconfiguration error that names both filesystems. `write-file-atomic` cannot hit EXDEV for single-file writes (tmp lives in dest dir); the risk is in tree-rename code (Phase 3+). Phase 1 should NOT introduce a generic `safeRename` helper that has this fallback.
- **Allowing `process.cwd()` reads inside helpers:** Capture cwd at command entry, pass explicitly. Phase 1's `index.ts` and `shared/` modules must not call `process.cwd()`. Phase 2's `persistence/locations.ts` will accept `cwd` as a parameter from `index.ts`.
- **Adding `// eslint-disable-line` outside `shared/notify.ts` and `state-io.ts`:** The two files are the SOLE sanctioned exception sites. Code review must reject any other `eslint-disable-(next-)line no-restricted-syntax`.

______________________________________________________________________

## Don't Hand-Roll

| Problem                                         | Don't Build                                         | Use Instead                                                          | Why                                                                                                                          |
| ----------------------------------------------- | --------------------------------------------------- | -------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Atomic JSON file write (with fsync + tmp queue) | Hand-rolled `writeFile(tmp) → rename(tmp, dest)`    | `write-file-atomic@^8`                                               | V1 missed parent-dir fsync (Pitfall #2); the lib handles fsync, signal-exit cleanup, concurrent-write queue.                 |
| Git clone / fetch / pull                        | `child_process.execFile("git", [...])` shelling-out | `isomorphic-git` + `isomorphic-git/http/node`                        | Drops `git` CLI dep; eliminates command-injection surface and stderr-regex parsing.                                          |
| In-memory git fs for tests                      | Hand-rolled fake fs                                 | `memfs@^4`                                                           | isomorphic-git accepts any FsClient; memfs is the canonical in-memory `node:fs` shim.                                        |
| Custom ESLint rule for output discipline        | Hand-rolled rule plugin                             | `no-restricted-syntax` with AST selectors (D-06)                     | "Pure config" per CONTEXT.md; custom rule is the deferred escalation path.                                                   |
| Boundary import enforcement                     | Hand-rolled grep / pre-commit hook                  | `eslint-plugin-import-x` `no-restricted-paths` rule (D-11)           | Already a dev dep; flat-config zones are the canonical pattern.                                                              |
| Symlink detection                               | `fs.realpath` then string-compare                   | `fs.lstat()` + `Stats.isSymbolicLink()`                              | `fs.realpath` requires the path to exist; `lstat` works on the boundary walk including not-yet-created leaves.               |
| Prototype-pollution defense for state.json      | Hand-rolled `delete obj.__proto__`                  | TypeBox schema validation at JSON parse boundary (Phase 2)           | Out of Phase 1 scope, but flag for Phase 2's planner; Phase 1 should NOT introduce defensive code that Phase 2 will replace. |
| Discriminated `installable` union (NFR-7)       | Hand-rolled type guards                             | TypeScript native discriminated union + `assertNever` exhaustiveness | Out of Phase 1 scope (Phase 2). Documented here so Phase 1 doesn't preempt the choice.                                       |
| Pi extension factory boilerplate                | Custom DI container                                 | `(pi: ExtensionAPI) => void` -- Pi's documented signature            | Don't introduce a wrapper; Pi already does the wiring.                                                                       |

**Key insight:** The single biggest "don't hand-roll" in Phase 1 is **`write-file-atomic` for JSON**. Every other Phase 1 component reuses V1 patterns nearly verbatim or wraps a stable external lib. The atomic-write change is the one that materially improves over V1 (Pitfall #2 closure).

______________________________________________________________________

## Runtime State Inventory

> Phase 1 is a **mixed greenfield/refactor** phase. The repo is on the `features/initial-gsd` branch with the V1 code on `features/initial`. Phase 1 deletes the current stub on `features/initial-gsd` and starts a fresh structure that mirrors V1's shape -- there is no V1 source on the current branch to migrate. However, Phase 1 also rewires `package.json` `pi.extensions` (a registered config), so a state inventory is appropriate.

| Category                                 | Items Found                                                                                                                                                                                      | Action Required                                                                                                                    |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| **Stored data**                          | None -- V1 source on `features/initial` exists in git history; current branch's stub does not produce any persisted data (no state.json, no clones).                                             | None.                                                                                                                              |
| **Live service config**                  | `package.json` `pi.extensions` array currently points at `./extensions/pi-claude-marketplace/index.ts` (which doesn't exist yet -- it points at the future location).                               | Phase 1 makes the pointer correct by creating `extensions/pi-claude-marketplace/index.ts`. **Net: pointer moves from broken → live.** |
| **OS-registered state**                  | None -- no Task Scheduler, launchd, systemd, pm2 entries reference this extension's name.                                                                                                        | None.                                                                                                                              |
| **Secrets/env vars**                     | None. The extension reads only `process.env` indirectly via `os.homedir()` in `locationsFor`. No secret keys, no API tokens.                                                                     | None.                                                                                                                              |
| **Build artifacts / installed packages** | `node_modules/tsx` is currently installed but D-02 removes it. `node_modules/typebox`, `prettier`, `globals` are pinned to old versions per `package.json` and need re-install after D-04 bumps. | Run `npm install` after the package.json edits land. Verify `node_modules/.package-lock.json` records the new versions.            |

**Net:** Phase 1's runtime state changes are minimal -- exactly one config pointer flips from "broken" to "live", and `node_modules` gets re-resolved to the new dep set. No data migrations, no OS re-registrations.

______________________________________________________________________

## Common Pitfalls

### Pitfall 1: Boundary lint rules pass because no boundaries are crossed yet

**What goes wrong:** Phase 1 lands all 9 folders with empty bodies (just READMEs). `import-x/no-restricted-paths` rules pass trivially because no real imports cross any boundary. Phase 3+ writes the first cross-boundary import, the rules trigger, and 12 PRs get blocked with "wait, this rule has been broken since Phase 1?" -- except actually nobody noticed.

**Why it happens:** "Looks-done-but-isn't" -- see CLAUDE.md Pitfalls Checklist. The rule **definition** is correct; the **enforcement** is unverified.

**How to avoid:** In `tests/architecture/import-boundaries.test.ts`, write a smoke test that:

1. Reads `eslint.config.js` (it's ESM, so `await import()` works), finds the `import-x/no-restricted-paths` rule entry.
2. Asserts `zones` is an array of length exactly 9 (one per folder).
3. Builds a `Map<target, Set<from>>` from the zones; asserts each folder's forbidden-set matches a hardcoded expected map.
4. As a **canary test**, write a deliberately-bad fixture file (e.g., `tests/fixtures/bad-imports/edge-imports-bridges.ts` containing `import "../../bridges/skills/index.ts"`), spawn `eslint <file>`, assert exit code is non-zero AND the error mentions `no-restricted-paths`. This proves the rule actually fires.

**Warning signs:**

- ESLint version bump in a future PR -- silent rule rename or option-shape change. The test catches both.
- Adding a 10th folder without updating the test's hardcoded map.

### Pitfall 2: `write-file-atomic`'s `chown` default unexpectedly preserves owner

**What goes wrong:** Test fixtures running under a privileged process (root in Docker CI; sudoed dev env) write a state.json. `write-file-atomic`'s default chown behavior **inherits ownership from the existing file** -- but if the file already exists owned by user `acolomba`, the rewrite preserves that ownership. **However**, when the file does NOT exist, the new file is created with the running process's uid/gid. Mixed-environment CI can produce file-ownership inconsistencies that pass tests in CI and fail when a user runs the dev script as their own user against a previously-CI-owned tmp dir.

**Why it happens:** The library's "preserve owner" default is a sensible npm-CLI behavior (npm runs as user, but might be invoked under sudo). For an extension running per-user, it's the right default. The trap is when CI environments differ from dev environments.

**How to avoid:**

- Run all V1 tests under the calling user's identity (no `sudo`, no Docker `--user 0`).
- If a future scenario forces a privileged context, explicitly pass `chown: false` so files are created with the calling-process credentials.
- Document in `shared/atomic-json.ts` why `chown` is left at default.

### Pitfall 3: ESM `import` of `isomorphic-git` returns a namespace, not a function

**What goes wrong:** `import git from "isomorphic-git"` works in CJS-interop mode but in strict ESM (`tsconfig`'s `module: "NodeNext"`), the package's `main: "./index.cjs"` and absent ESM `default` export means `git` becomes the namespace, and `git.clone(...)` works while `git(...)` does not. A copy-pasted snippet from older docs that does `import { clone } from "isomorphic-git"` may or may not work depending on the named-export interop heuristic.

**How to avoid:** Use `import * as git from "isomorphic-git"` and call `git.clone(...)`, `git.fetch(...)`, etc. The wrapper code in this research uses that form. Verified working under Node 24 ESM.

### Pitfall 4: Snapshot test fails after a PRD edit that reflows whitespace

**What goes wrong:** D-09 says the test parses PRD §6.12 at runtime. PRD edits that don't change the marker text but DO change whitespace (e.g., `mdformat` reflowing the table column widths) can break the regex. Worse, the test passes locally where the dev has run `pre-commit` and reflowed the PRD, but fails in CI on the un-reflowed version.

**How to avoid:**

1. The regex extracts backtick-quoted substrings -- backticks are stable through `mdformat` reflow (it preserves literal markdown spans).
2. Run `mdformat` against the PRD as part of `npm run check`'s `format:check` step. If the PRD is misformatted, format:check fails before the snapshot test runs.
3. The test asserts presence-in-set, not array equality, so column reordering doesn't break it.

### Pitfall 5: `eslint-disable-next-line no-restricted-syntax` swallows other rules' errors silently

**What goes wrong:** A developer adds `// eslint-disable-next-line no-restricted-syntax` near an unrelated bug. Later, that line evolves to violate a different rule (e.g., a new `no-floating-promises` violation). The disable-comment doesn't cover the new rule, but the comment itself camouflages the line in code review.

**How to avoid:** Always pair the disable with a **comment citing the rule by ID** and the reason:

```typescript
// eslint-disable-next-line no-restricted-syntax -- IL-3: sanctioned migrate-save warn
console.warn(`...`);
```

Code review rejects bare `eslint-disable-next-line` without a `--` justification. The `no-restricted-syntax` selector messages already cite IL-2/IL-3 -- the justification comment should mirror.

### Pitfall 6: Node 24 native TS strip rejects non-erasable TypeScript

**What goes wrong:** Native TS strip handles type annotations and interface declarations, but does NOT handle `enum`, parameter properties (`constructor(private foo: X)`), or namespace-as-value patterns. A copy-pasted snippet using `enum` runs fine under `tsx` but throws a `SyntaxError: ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX` under bare `node --test`.

**How to avoid:**

- ESLint rule `@typescript-eslint/no-namespace: "error"` + a project-level "no enums" code-review convention.
- Use `as const` literal-union objects instead of `enum`.
- Prefer explicit field assignment in constructors over parameter properties.
- Phase 1 source code follows these conventions from day one (V1's source already does -- the V1 code is erasable-friendly).

### Pitfall 7: `package.json` `pi.extensions` pointer left dangling

**What goes wrong:** Current `package.json` `pi.extensions` already points at `./extensions/pi-claude-marketplace/index.ts` -- but that file does NOT exist on this branch. The current stub is `./extensions/pi-claude-marketplace.ts` (without the dir). Pi loads, fails to find the indicated file, and fails the extension-load step. **D-04 fixes this**, but if Phase 1 is split into multiple waves and the package.json edit lands BEFORE the directory + index.ts are created, `npm run check`'s test step will fail at extension-load.

**How to avoid:**

- Land directory creation + index.ts before the package.json edit (or in the same wave/commit).
- Run `npm test` after each wave to surface load failures immediately.

______________________________________________________________________

## Code Examples

Verified patterns from official sources:

### `write-file-atomic@^8` Promise usage

```typescript
// Source: github.com/npm/write-file-atomic README + on-disk lib/index.js v8.0.0 (verified 2026-05-09)
import writeFileAtomic from "write-file-atomic";

await writeFileAtomic("state.json", JSON.stringify(state, null, 2) + "\n", {
  encoding: "utf8",
  // fsync: true (default) -- gives parent-dir fsync per Pitfall #2 closure.
});
```

### `isomorphic-git` Node usage

```typescript
// Source: isomorphic-git README + on-disk index.d.ts v1.37.6 (verified 2026-05-09)
import * as git from "isomorphic-git";
import http from "isomorphic-git/http/node";
import * as fs from "node:fs";

await git.clone({
  fs,
  http,
  dir: "/path/to/clone-dir",
  url: "https://github.com/owner/repo",
  ref: "main",
  singleBranch: true,
});

const sha = await git.resolveRef({ fs, dir: "/path/to/clone-dir", ref: "HEAD" });
```

### Symlink-aware containment walk

See Pattern 2 above for the full implementation. Key API:

```typescript
// Source: nodejs.org/api/fs.html (verified 2026-05-09)
import { lstat, readlink } from "node:fs/promises";

const stats = await lstat(somePath);  // does NOT follow symlinks
if (stats.isSymbolicLink()) {
  const target = await readlink(somePath);  // returns string target
  // throw SymlinkRefusedError(...)
}
```

### Pi extension factory + command registration

```typescript
// Source: node_modules/@mariozechner/pi-coding-agent@0.73.1/dist/core/extensions/types.d.ts
// (verified 2026-05-09)
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

export default function myExt(pi: ExtensionAPI): void {
  pi.registerCommand("my-command", {
    description: "...",
    handler: async (args, ctx) => {
      ctx.ui.notify("hello", "info");  // info | warning | error (per types.d.ts line 74)
    },
  });

  pi.on("resources_discover", async (event) => {
    return { skillPaths: ["/some/dir"], promptPaths: [] };
  });
}
```

______________________________________________________________________

## State of the Art

| Old Approach                                     | Current Approach                                             | When Changed                              | Impact                                                                                            |
| ------------------------------------------------ | ------------------------------------------------------------ | ----------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `tsx` for `.ts` test files under Node ≤22.17     | Native TS strip in `node --test "tests/**/*.test.ts"`        | Node 22.18+ (Aug 2025)                    | One less dev dep; faster `npm install`. D-02 acts on this.                                        |
| `--experimental-strip-types` flag                | Default behavior; flag removed in Node 26                    | Node 22.18+ default                       | Phase 1 doesn't need to pass any flag. Verified locally on Node 26.                               |
| `@sinclair/typebox` 0.34.x                       | `typebox` 1.x (no scope)                                     | TypeBox 1.0 release                       | V1 has already migrated; D-04's bump (1.1.34→1.1.38) is routine.                                  |
| Hand-rolled `writeFile(tmp) → rename(tmp, dest)` | `write-file-atomic` with fsync-by-default + concurrent queue | npm-CLI lib v8 (engines bumped 2025-late) | Closes Pitfall #2 (atomicity-without-durability). D-03 acts on this.                              |
| `git` CLI shell-out                              | `isomorphic-git` pure-JS implementation                      | isomorphic-git 1.x mature                 | Removes the `git not found` failure mode (PRD MA-7 → removed per D-21).                           |
| `proper-lockfile` for cross-process locks        | None -- `withStateGuard` mtime-check (V1 pattern)            | V1 design                                 | Acceptable for V1 single-shell concurrency. Successor concern if Pi gains parallel-shell support. |

**Deprecated/outdated:**

- **tsx for Node ≥22.18** -- replaced by native TS strip; remove (D-02).
- **`@sinclair/typebox` 0.34.x** -- bug-fix-only LTS through 2026; do not regress.
- **CommonJS (`"type": "commonjs"`)** -- TypeBox 1.x, `@mariozechner/pi-coding-agent`, and `isomorphic-git`'s ESM exports all require ESM. V1 already on `"type": "module"` -- preserve.

______________________________________________________________________

## Assumptions Log

| #   | Claim                                                                                                                                         | Section               | Risk if Wrong                                                                                                                                                                                                                                                                                                                                                                                                                 |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A1  | The PRD §6.12 ES-5 row contains exactly 5 backtick-delimited literals in the order PI_SUBAGENTS_NOT_LOADED → ROLLBACK_PARTIAL.                | Pattern 6             | Snapshot test fails on first run; Phase 1 work blocked until either the PRD is corrected or the test's expected map is updated. **VERIFIED** by reading PRD lines 605-611 -- 5 literals confirmed in order.                                                                                                                                                                                                                   |
| A2  | `write-file-atomic@^8`'s default `chown` behavior is acceptable for V1 (per-user CLI tool, no privileged contexts).                           | Pattern 1             | If CI runs as root, file ownership may be wrong. Mitigation in CONTEXT.md if discovered; pass `chown: false` is the fix.                                                                                                                                                                                                                                                                                                      |
| A3  | The 9-folder boundary rules use the exact import map from D-11 in CONTEXT.md verbatim.                                                        | Pattern 4             | Surface ambiguity: D-11 says "edge/ may import from orchestrators/, presentation/, shared/" -- does NOT mention `domain/`. Phase 1 follows that literal text. **CONFIRMATION NEEDED:** if `edge/` should also import from `domain/` (e.g., for arg-parser types), the planner needs to clarify with the user before locking the rule. Recommended default: keep edge → domain forbidden (use orchestrator-shaped types only). |
| A4  | Sparse-checkout deferral in PRD §11 still applies -- isomorphic-git's lack of sparse-checkout is therefore not a blocker.                     | Pattern 5             | If V2 wants sparse checkout, isomorphic-git would need to gain support OR the project would need to switch back to git CLI. Documented in Deferred Ideas.                                                                                                                                                                                                                                                                     |
| A5  | Node 24's `node --test` glob support handles `"tests/**/*.test.ts"` correctly without explicit shell-glob expansion.                          | D-02 task             | If glob fails, planner falls back to `find tests -name '*.test.ts' -exec node --test {} +`. Tested on local Node 26 -- works.                                                                                                                                                                                                                                                                                                 |
| A6  | Pi extension API peer-dep floor `>=0.70.6` is sufficient for Phase 1's surface (registerCommand, on(resources_discover), ExtensionAPI shape). | Pattern 8 / D-05      | If 0.70.6 lacks an API used by index.ts, Pi will fail to load. **Recommended Phase 1 floor: `>=0.73.1`** since that's what `node_modules/` has and what the surface was verified against. Phase 7 finalizes per NFR-11.                                                                                                                                                                                                       |
| A7  | The `// eslint-disable-next-line` comment with a `-- justification` is recognized by ESLint 10 flat config.                                   | Pattern 5 / Pitfall 5 | If not, code review-only enforcement still works, but the comment becomes prose. ESLint 10 docs confirm `-- comment` syntax is supported.                                                                                                                                                                                                                                                                                     |

**Action for the planner:** A3 needs explicit confirmation. Either expand D-11 to include `domain/` in `edge/`'s allowed-from set, or affirm the strict reading. Surface this question if the planner cannot resolve it from CONTEXT.md alone.

______________________________________________________________________

## Open Questions

1. **Should `edge/` be allowed to import from `domain/`?**

   - What we know: D-11 lists `edge/`'s allowed-from set as `orchestrators/`, `presentation/`, `shared/` -- explicitly excluding `domain/`.
   - What's unclear: Phase 6 (edge layer) will parse `--scope user|project` arguments; the `Scope` type lives in `domain/` (or `shared/`). If `Scope` lives in `domain/`, edge can't import it directly.
   - Recommendation: Move `Scope` type into `shared/types.ts`. The strict reading of D-11 stays intact; `shared/` is already importable from everywhere. Add this as a Phase 1 follow-up note for Phase 2's planner.

2. **Should the snapshot test fail on PRD edits that change the PLACEHOLDER (not the PREFIX)?**

   - What we know: D-09 says "test catches drift in either direction (PRD edit OR markers edit)".
   - What's unclear: A PRD edit that changes `Run /reload to <verb> …` to `Run /reload to <action> …` (rewording the placeholder name from `<verb>` to `<action>`) does NOT change the user-visible string at runtime -- but the snapshot test as written above WOULD pass (we strip from the first `<` onward).
   - Recommendation: This is the desired behavior. The prefix is the user contract; the placeholder name is internal to the PRD. Document in the test file's header.

3. **Does `index.ts` need to register `pi_claude_marketplace_list` LLM tool in Phase 1?**

   - What we know: D-13 says the stub's two registered surfaces "get re-implemented inside the new layout in later phases; Phase 1's index.ts is a thin entrypoint that sets up the `pi.registerCommand`/`pi.registerTool` surface and delegates to `edge/` modules (which will be empty at end of Phase 1, populated by Phase 6)".
   - What's unclear: Does "thin entrypoint that sets up `pi.registerTool`" mean Phase 1 registers a stub `pi_claude_marketplace_list` (mirroring the current stub), or does Phase 1 register NO tools and Phase 6 introduces them?
   - Recommendation: Register NO tools in Phase 1's `index.ts`. The current stub registers the tool only because there was no edge/ layer. With the new layout, tool registration belongs to `edge/handlers/list.ts` per the architecture diagram. The Phase 1 index.ts comment block will explicitly note "Phase 6: register tools from edge/handlers/list.ts." If the planner wants to be safer (e.g., to avoid breaking any user who has the marketplace tool in their `setActiveTools` list), Phase 1 can register a placeholder tool that returns "not implemented yet" -- but this couples Phase 1's index.ts to TypeBox + ToolDefinition types it otherwise doesn't need.

4. **Where does `shared/errors.ts` (port of V1's `errorMessage`/`appendLeaks`/`appendLeakToError`) actually live?**

   - What we know: V1's `errors.ts` lives at the extension root, not under any folder. The 9-folder layout doesn't have a top-level slot for it.
   - Recommendation: Land in `shared/errors.ts`. It's importable from every layer, has no upward deps, and matches the function-name convention.

______________________________________________________________________

## Environment Availability

> Phase 1 has minimal external-tool dependencies -- it's mostly internal toolchain wiring. Run the audit anyway since this is the first phase.

| Dependency                               | Required By                                                  | Available | Version                                 | Fallback                                                                       |
| ---------------------------------------- | ------------------------------------------------------------ | --------- | --------------------------------------- | ------------------------------------------------------------------------------ |
| Node.js (≥22.22.2 for write-file-atomic) | D-01, D-03                                                   | ✓         | v26.0.0 (this machine) / target Node 24 | None -- hard requirement                                                       |
| npm                                      | D-04 (package.json edits)                                    | ✓         | bundled with Node                       | None                                                                           |
| `git` CLI (host system)                  | None -- `isomorphic-git` replaces; only needed for repo work | ✓         | (host's own git)                        | N/A -- extension does not invoke `git` CLI per D-18                            |
| Pre-commit hook chain (mdformat etc.)    | CONTEXT.md mention                                           | (host)    | (host's pre-commit)                     | If absent, `npm run check` still works; pre-commit is a dev-environment nicety |
| `tsc` (TypeScript)                       | NFR-6 (`npm run typecheck`)                                  | ✓         | `^5.9.3` (in V1 deps)                   | None                                                                           |
| ESLint 10 flat-config support            | D-06, D-11                                                   | ✓         | `^10.2.1` (in V1 deps)                  | None                                                                           |
| Network access                           | `npm install` only                                           | ✓         | --                                      | Offline install via cache acceptable                                           |

**Missing dependencies with no fallback:** none.

**Missing dependencies with fallback:** none.

The Phase 1 toolchain is entirely self-contained in `node_modules/` after `npm install`. Live network access is needed once for `npm install` (D-04 bumps + new deps); no other Phase 1 work needs the network.

______________________________________________________________________

## Validation Architecture

> `nyquist_validation` is true in `.planning/config.json`. Section included.

### Test Framework

| Property           | Value                                                                           |
| ------------------ | ------------------------------------------------------------------------------- |
| Framework          | `node:test` (Node built-in) + `node:assert/strict`                              |
| Config file        | none -- `package.json`'s `test` script is the entry point                       |
| Quick run command  | `node --test "tests/architecture/markers-snapshot.test.ts"` (single file)       |
| Full suite command | `node --test "tests/**/*.test.ts"` (after D-02; replaces the V1 directory glob) |

### Phase Requirements → Test Map

| Req ID         | Behavior                                                                                              | Test Type | Automated Command                                                                           | File Exists?      |
| -------------- | ----------------------------------------------------------------------------------------------------- | --------- | ------------------------------------------------------------------------------------------- | ----------------- |
| **NFR-1**      | `atomicWriteJson` writes JSON via tmp + fsync + rename (smoke test for write-file-atomic integration) | unit      | `node --test tests/shared/atomic-json.test.ts`                                              | ❌ Wave 0         |
| **NFR-4**      | Test suite runs unmodified on Node 24 (no tsx, no flags)                                              | smoke     | \`node --version                                                                            | grep -E 'v24      |
| **NFR-6**      | `npm run check` exits 0 (typecheck + lint + format + test all pass)                                   | smoke     | `npm run check`                                                                             | (CI gate)         |
| **NFR-9**      | `notifyError(ctx, msg, cause)` does not include sensitive paths beyond `cause.message`                | unit      | `node --test tests/shared/notify.test.ts`                                                   | ❌ Wave 0         |
| **NFR-10**     | `assertPathInside` refuses paths outside the boundary                                                 | unit      | `node --test tests/shared/path-safety.test.ts`                                              | ❌ Wave 0         |
| **IL-1**       | All marker strings in `shared/markers.ts` are ASCII English (no locale negotiation)                   | unit      | (covered by markers snapshot test)                                                          | ❌ Wave 0         |
| **IL-2**       | ESLint catches `process.stdout.write`, `process.stderr.write`, `console.*` outside sanctioned sites   | lint      | `npm run lint`                                                                              | (CI gate)         |
| **IL-3**       | `eslint-disable-next-line no-restricted-syntax` is the disable mechanism, with `--` justification     | review    | (manual review; no automated test)                                                          | n/a (review-gate) |
| **IL-4**       | No telemetry libraries present in package.json deps                                                   | unit      | `node --test tests/architecture/no-telemetry-deps.test.ts`                                  | ❌ Wave 0         |
| **IL-5**       | Successor SHOULD -- no test, just a commented forward reference in source                             | n/a       | n/a                                                                                         | n/a               |
| **ES-1**       | `notifySuccess` / `notifyWarning` / `notifyError` all call `ctx.ui.notify`                            | unit      | `node --test tests/shared/notify.test.ts`                                                   | ❌ Wave 0         |
| **ES-2**       | `notifyError` passes `"error"`, `notifyWarning` passes `"warning"`                                    | unit      | `node --test tests/shared/notify.test.ts`                                                   | ❌ Wave 0         |
| **ES-3**       | (Edge handlers attach Usage; Phase 6 owns; Phase 1 wrappers don't preempt)                            | unit (P6) | n/a                                                                                         | n/a (Phase 6)     |
| **ES-4**       | `notifyError(ctx, msg, cause)` flattens `cause.message` into output                                   | unit      | `node --test tests/shared/notify.test.ts`                                                   | ❌ Wave 0         |
| **ES-5**       | Markers in `shared/markers.ts` match PRD §6.12 byte-for-byte                                          | snapshot  | `node --test tests/architecture/markers-snapshot.test.ts`                                   | ❌ Wave 0         |
| **PS-1**       | `assertPathInside` throws `PathContainmentError` on violations                                        | unit      | `node --test tests/shared/path-safety.test.ts`                                              | ❌ Wave 0         |
| **PS-4**       | `SymlinkRefusedError` propagates loudly (does not get caught by leak-aggregator)                      | unit      | `node --test tests/shared/path-safety.test.ts` (negative case)                              | ❌ Wave 0         |
| **AS-1**       | `atomicWriteJson` uses tmp + rename pattern; intermediate state never visible                         | unit      | `node --test tests/shared/atomic-json.test.ts`                                              | ❌ Wave 0         |
| **AS-4**       | `ROLLBACK_PARTIAL` marker matches PRD                                                                 | snapshot  | (covered by markers snapshot test)                                                          | ❌ Wave 0         |
| **AS-5**       | `appendLeaks`/`appendLeakToError` chain `Error.cause` correctly                                       | unit      | `node --test tests/shared/errors.test.ts`                                                   | ❌ Wave 0         |
| **PS-2/3/5**   | Domain-level validation                                                                               | unit (P2) | n/a                                                                                         | n/a (Phase 2)     |
| (architecture) | 9-folder import boundaries enforced                                                                   | meta      | `node --test tests/architecture/import-boundaries.test.ts` + canary fixture spawning eslint | ❌ Wave 0         |
| (architecture) | Phase 1 introduces no telemetry / i18n libs                                                           | meta      | `node --test tests/architecture/no-telemetry-deps.test.ts`                                  | ❌ Wave 0         |

### Sampling Rate

- **Per task commit:** `npm run check` runs the full pipeline (typecheck + lint + format + tests) -- fast enough on Phase 1's small surface to be the per-commit sample.
- **Per wave merge:** Same as per-commit; Phase 1 has no slow integration tests.
- **Phase gate:** Full suite green, including the architecture tests and the markers snapshot. `/gsd-verify-work` runs the full check.

### Wave 0 Gaps

- [ ] `tests/architecture/markers-snapshot.test.ts` -- covers ES-5 (D-09)
- [ ] `tests/architecture/import-boundaries.test.ts` -- covers D-11
- [ ] `tests/architecture/no-telemetry-deps.test.ts` -- covers IL-4
- [ ] `tests/shared/path-safety.test.ts` -- covers PS-1, PS-4, NFR-10, D-14..17
- [ ] `tests/shared/atomic-json.test.ts` -- covers NFR-1, AS-1, D-03
- [ ] `tests/shared/notify.test.ts` -- covers ES-1, ES-2, ES-4, NFR-9, D-07
- [ ] `tests/shared/errors.test.ts` -- covers AS-5
- [ ] `tests/helpers/prd-extract.ts` -- reusable PRD-marker extraction helper (Specific Idea from CONTEXT.md)
- [ ] `tests/fixtures/bad-imports/*.ts` -- canary fixtures for the import-boundaries test
- [ ] Test framework install -- none needed; `node:test` is built-in.

______________________________________________________________________

## Sources

### Primary (HIGH confidence)

- **`@mariozechner/pi-coding-agent@0.73.1`** `dist/core/extensions/types.d.ts` -- read directly from `node_modules/` on 2026-05-09. Verified `ExtensionAPI`, `registerCommand`, `registerTool`, `on("resources_discover")`, `ctx.ui.notify(message, type?)` shape. Source: `/Users/acolomba/src/pi-claude-marketplace/node_modules/@mariozechner/pi-coding-agent/dist/core/extensions/types.d.ts` lines 769-923.
- **`write-file-atomic@8.0.0`** README + `package.json` -- read directly from `/tmp/wfa-probe/node_modules/write-file-atomic/` on 2026-05-09. Verified API surface (Promise async + sync), `engines` floor, default `fsync: true`. Sources: [github.com/npm/write-file-atomic](https://github.com/npm/write-file-atomic), local `node_modules`.
- **`isomorphic-git@1.37.6`** `index.d.ts` + `http/node/index.d.ts` -- read directly from `/tmp/wfa-probe/ig-probe/node_modules/isomorphic-git/` on 2026-05-09. Verified `clone`, `fetch`, `pull`, `checkout`, `resolveRef` signatures; `http: HttpClient` shape; package `exports` map for `./http/node`. Sources: [isomorphic-git.org/docs/en/clone](https://isomorphic-git.org/docs/en/clone), [github.com/isomorphic-git/isomorphic-git](https://github.com/isomorphic-git/isomorphic-git#readme).
- **`eslint-plugin-import-x@4.16.2`** `lib/rules/no-restricted-paths.d.ts` + `.js` -- read directly from `/tmp/imp-probe/node_modules/` on 2026-05-09. Verified `Options`, `zones`, `target`/`from`/`except`/`message` semantics, message IDs.
- **PRD `docs/prd/pi-claude-marketplace-prd.md`** §6.10 (PS-1..5), §6.11 (AS-1, AS-4, AS-5), §6.12 (ES-1..5), §6.13 (IL-1..5), §10 (NFR-1..12) -- read at lines 579-622 and 963-979 on 2026-05-09. Authoritative spec.
- **CONTEXT.md** `01-CONTEXT.md` -- 21 locked decisions. Treated as authority on Claude's freedom areas.
- **CLAUDE.md** project instructions -- embedded in this conversation; verified against repo on 2026-05-09.
- **REQUIREMENTS.md** Phase 1 owns 23 IDs; mapping verified from the Traceability table.
- **Node.js docs** [nodejs.org/api/typescript.html](https://nodejs.org/api/typescript.html) -- verified native TS strip default at 22.18+/23.6+; `--experimental-strip-types` removed in v26.
- **Node.js docs** [nodejs.org/api/fs.html](https://nodejs.org/api/fs.html) -- verified `fsPromises.lstat()` does NOT follow symlinks; `Stats.isSymbolicLink()` returns boolean.
- **ESLint docs** [eslint.org/docs/latest/extend/selectors](https://eslint.org/docs/latest/extend/selectors) -- AST selector grammar, nested attribute syntax `[attr.level2='foo']`, MemberExpression chaining.
- **ESLint docs** [eslint.org/docs/latest/rules/no-restricted-syntax](https://eslint.org/docs/latest/rules/no-restricted-syntax) -- string-and-object format mixing, `selector` + `message` shape.

### Secondary (MEDIUM confidence)

- **`.planning/research/STACK.md`** -- version recommendations and engine constraints.
- **`.planning/research/ARCHITECTURE.md`** -- 9-folder layout rationale, V1 carry-forward analysis.
- **`.planning/research/PITFALLS.md`** -- Pitfalls #1, #2, #4, #10, #15 informed Phase 1 patterns.
- **`.planning/research/SUMMARY.md`** -- cross-research synthesis.
- [PkgPulse Node.js 22 vs 24 (2026)](https://www.pkgpulse.com/guides/nodejs-22-vs-nodejs-24-2026) -- Node 24 LTS upgrade context.
- [Node.js 24 Native TypeScript: Run .ts Files Without a Build Step in 2026 (ishu.dev)](https://ishu.dev/post/nodejs-24-native-typescript-2026-04-26) -- context for D-02.
- [Quick guide to native TS in Node.js (Paul Irish gist)](https://gist.github.com/paulirish/18f417604b5d875b88ad303b104742b7) -- corroborates type-stripping behavior.

### Tertiary (LOW confidence -- for context only, not load-bearing)

- [Christopher Dignam: "Using ESLint's no-restricted-syntax rule"](https://christopher.xyz/2021/05/16/eslint-ban-syntax.html) -- example patterns, not canonical.
- [Allegro Tech: "Using ESLint to improve your app's performance"](https://blog.allegro.tech/2020/08/using-eslint.html) -- selector usage examples.

______________________________________________________________________

## Metadata

**Confidence breakdown:**

- Standard stack: **HIGH** -- every version verified against npm registry on 2026-05-09 + on-disk package files.
- Architecture: **HIGH** -- 9-folder layout locked in CONTEXT.md; boundary rule shape verified against the actual `eslint-plugin-import-x@4.16.2` source.
- API surfaces (`write-file-atomic`, `isomorphic-git`, Pi `ExtensionAPI`): **HIGH** -- read directly from `node_modules/` on the dev machine.
- Symlink-aware containment: **HIGH** -- pattern is straightforward; TOCTOU residual risk explicitly documented.
- ESLint AST selectors: **HIGH** -- selector grammar verified against ESLint docs and tested locally.
- Markers snapshot test: **HIGH** -- PRD §6.12 ES-5 row content verified by direct read of lines 605-611.
- Pitfalls: **MEDIUM-HIGH** -- 7 pitfalls drawn from PITFALLS.md research and Phase-1-specific gotchas; the `chown` and EXDEV nuances are second-order risks worth documenting but unlikely to bite.

**Research date:** 2026-05-09 **Valid until:** 2026-06-08 (30 days -- Node 24 toolchain is stable; isomorphic-git API is stable; `write-file-atomic` v8 is mature). Re-verify if `@mariozechner/pi-coding-agent` ships a major version bump.

______________________________________________________________________

## RESEARCH COMPLETE
