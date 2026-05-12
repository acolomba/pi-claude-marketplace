# Phase 1: Foundations & Toolchain -- Pattern Map

**Mapped:** 2026-05-09
**Files analyzed:** 21 (10 source + 9 READMEs + 8 tests + 4 config edits, with overlap)
**Analogs found:** 14 / 21 (the 9 README placeholders and the 3 entirely-new architecture tests have no V1 analog by design)

This pattern map drives the planner's tasks for the 9-folder skeleton, `shared/` core, `platform/git.ts`, `index.ts` rewire, eslint extensions, and `tests/` scaffolding. Closest analogs sit on the `features/initial` branch; the current `main` branch contains only a stub. Excerpts below are byte-accurate quotes from the analog files (verified 2026-05-09 via `git show features/initial:<path>`); divergences from the analog are called out explicitly so the planner does not blindly carry-forward V1.

---

## File Classification

| New / Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---------------------|------|-----------|----------------|---------------|
| `extensions/pi-claude-marketplace/index.ts` | entrypoint | event-driven (Pi API) | `features/initial:extensions/pi-claude-marketplace/index.ts` | exact (role) -- Phase 1 trims to skeleton |
| `extensions/pi-claude-marketplace/shared/atomic-json.ts` | utility | file-I/O (JSON write) | `features/initial:extensions/pi-claude-marketplace/fs-utils.ts` (atomicWriteJson) | role-match -- replace impl with `write-file-atomic` |
| `extensions/pi-claude-marketplace/shared/path-safety.ts` | utility | file-I/O (lstat walk) | NONE on `features/initial` (V1 had no symlink check); RESEARCH.md Pattern 2 is canonical | greenfield with embedded research code |
| `extensions/pi-claude-marketplace/shared/markers.ts` | constants module | request-response (read-only consts) | NONE on V1 (markers were inline literals in `presentation/reload-hint.ts` etc.); PRD §6.12 is the source of truth | greenfield (extracted from PRD) |
| `extensions/pi-claude-marketplace/shared/notify.ts` | utility (presentation seam) | request-response (sync wrapper) | NONE on V1 (callers used `ctx.ui.notify(...)` directly throughout); RESEARCH.md Pattern 7 is canonical | greenfield (new API surface) |
| `extensions/pi-claude-marketplace/shared/errors.ts` | utility (error helpers) | transform | `features/initial:extensions/pi-claude-marketplace/errors.ts` | exact (verbatim port) |
| `extensions/pi-claude-marketplace/platform/git.ts` | platform facade | request-response (network/IO) | `features/initial:extensions/pi-claude-marketplace/marketplace/git.ts` | role-match -- replace `execFile("git")` with `isomorphic-git` |
| `extensions/pi-claude-marketplace/{edge,orchestrators,bridges,domain,transaction,persistence,presentation,platform,shared}/README.md` | documentation | n/a | NONE on V1 (V1 had no folder READMEs) | greenfield -- 9 placeholder READMEs |
| `eslint.config.js` (modified) | config | n/a | current `eslint.config.js` (already on `features/initial-gsd`) | exact (extend, do not replace) |
| `package.json` (modified) | config | n/a | current `package.json` | exact (rewire) |
| `tests/architecture/markers-snapshot.test.ts` | test (snapshot) | file-I/O (PRD parse) | NONE on V1 (no architecture tests); RESEARCH.md Pattern 6 is canonical | greenfield |
| `tests/architecture/import-boundaries.test.ts` | test (meta) | request-response (eslint config introspection) | NONE on V1 (no architecture tests); CONTEXT.md Specific Idea + RESEARCH.md Pattern 4 | greenfield |
| `tests/architecture/no-telemetry-deps.test.ts` | test (meta) | file-I/O (package.json read) | NONE on V1 | greenfield (small) |
| `tests/shared/path-safety.test.ts` | test (unit) | file-I/O (tmp dir + symlinks) | NONE on V1 (path-safety is new); V1 test scaffolding pattern from `tests/agent/frontmatter.test.ts` | partial-match (scaffolding only) |
| `tests/shared/atomic-json.test.ts` | test (unit) | file-I/O | NONE on V1 (V1 atomic write was tested implicitly via state tests); V1 test scaffolding pattern | partial-match (scaffolding only) |
| `tests/shared/notify.test.ts` | test (unit) | request-response (mock ctx) | NONE on V1; V1 test scaffolding pattern | partial-match (scaffolding only) |
| `tests/shared/errors.test.ts` | test (unit) | transform | `features/initial:tests/` (V1 had implicit error tests); V1 scaffolding pattern | partial-match (scaffolding only) |
| `tests/helpers/prd-extract.ts` | test helper | transform (regex) | NONE on V1 | greenfield |
| `tests/fixtures/bad-imports/edge-imports-bridges.ts` | test fixture | n/a (canary) | NONE on V1 | greenfield (1-line file) |

---

## Pattern Assignments

### `extensions/pi-claude-marketplace/index.ts` (entrypoint, event-driven)

**Analog:** `features/initial:extensions/pi-claude-marketplace/index.ts`

**Imports + factory shape (lines 1, 21-28 of analog):**

```typescript
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

// ... (V1 imports from ./commands/*.ts, ./errors.ts, ./fs-utils.ts, ./location/index.ts) ...

export default function claudeMarketplaceExtension(pi: ExtensionAPI): void {
  // ...
}
```

**Resources-discover handler (analog lines 28-58) -- shape to keep at Phase 1:**

```typescript
pi.on("resources_discover", async (event) => {
  const cwd = event.cwd;
  const skillPaths: string[] = [];
  const promptPaths: string[] = [];
  const scopeFailures: string[] = [];

  for (const scope of ["user", "project"] as const) {
    const locations = locationsFor(scope, cwd);
    try {
      if (await pathExists(locations.resourcesSkillsDir)) {
        skillPaths.push(locations.resourcesSkillsDir);
      }
      // ...
    } catch (err) {
      scopeFailures.push(`${scope} scope (${locations.extensionRoot}): ${errorMessage(err)}`);
    }
  }
  // ...
  return { skillPaths, promptPaths };
});
```

**Command registration (analog lines 60-82) -- pattern to mimic, body to stub out:**

```typescript
pi.registerCommand("claude:plugin", {
  description:
    "Manage Claude plugin marketplaces and plugins. Usage: /claude:plugin <install|uninstall|update|marketplace> ...",
  handler: (args, ctx) => routeClaudePlugin(args, { /* dispatch table */ }, ctx),
  getArgumentCompletions: async (prefix) => { /* ... */ },
});
```

**Phase 1 divergences from V1 analog:**

1. **No imports from `./commands/*`, `./completions.ts`, `./location/*`** -- `edge/`, `orchestrators/` are empty in P1; the import-x boundary rule blocks index → those modules anyway. Phase 1's index.ts imports ONLY `./shared/notify.ts` (for `notifyWarning`).
2. **`resources_discover` handler returns empty arrays** instead of walking `locationsFor(scope, cwd)`. The walk lives in Phase 3 (skills/prompts bridges). Per RESEARCH.md Pattern 8: keep the handler registered so the boundary rule has something real to verify.
3. **`claude:plugin` handler stubs to `notifyWarning(ctx, "Claude marketplace access is not implemented yet (Phase 6 lands the edge layer).")`** -- mirrors current stub's "not implemented yet" warning, but routed through the new severity-named wrapper instead of direct `ctx.ui.notify`.
4. **No `getArgumentCompletions`, no `pi.on("session_start", ...)`, no `pi.registerTool(...)`** -- Phase 6 owns these. Per RESEARCH.md Open Question 3: register **NO** tools in P1's index.ts.
5. **No `routeClaudePlugin`** -- there is no router in P1. The handler body is 3 lines.

Result is roughly 25 lines vs V1's 200+. Skeleton from RESEARCH.md Pattern 8 is the canonical Phase 1 shape.

---

### `extensions/pi-claude-marketplace/shared/atomic-json.ts` (utility, file-I/O)

**Analog:** `features/initial:extensions/pi-claude-marketplace/fs-utils.ts` (the `atomicWriteJson` function specifically)

**V1 pattern to REPLACE (analog lines 41-49):**

```typescript
import { randomUUID } from "node:crypto";
import { mkdir, rename, writeFile } from "node:fs/promises";
import path from "node:path";

export async function atomicWriteJson(filePath: string, value: unknown): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  const tmp = filePath + "." + randomUUID() + ".tmp";
  await writeFile(tmp, JSON.stringify(value, null, 2) + "\n", "utf8");
  await rename(tmp, filePath);
}
```

**P1 replacement (per D-03 + RESEARCH.md Pattern 1):**

```typescript
import writeFileAtomic from "write-file-atomic";
import { mkdir } from "node:fs/promises";
import path from "node:path";

export async function atomicWriteJson(filePath: string, value: unknown): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFileAtomic(filePath, JSON.stringify(value, null, 2) + "\n", {
    encoding: "utf8",
    // fsync defaults to true (NFR-1 durability); chown left at default (Pitfall #2 risk
    // is moot for per-user dev/CI -- pass chown:false if a future audit forces it).
  });
}
```

**Divergences from V1:**

- Hand-rolled `randomUUID()` tmp suffix → library handles uniquely-named tmp internally.
- Manual `writeFile` + `rename` → library does fsync-by-default + concurrent-write queue serialization.
- Closes Pitfall #2 (atomicity-without-durability): V1 lacked parent-dir fsync; library now provides it.
- Used **only for JSON files** (`state.json`, `mcp.json`, `agents-index.json`). Staging-tree commits (Phase 3+) keep V1's hand-rolled `mkdir`+write+`rename` pattern (different problem shape, EXDEV risk lives there).

**Other V1 helpers in `fs-utils.ts` that are OUT of Phase 1 scope:**

- `pathExists` -- Phase 2 ports to `persistence/fs-utils.ts` (not `shared/`, since it's filesystem-state-aware)
- `dirExists` -- same
- `cleanupStaging` -- Phase 3 (bridges own staging cleanup)

Phase 1's `shared/atomic-json.ts` exports ONLY `atomicWriteJson`. Other fs helpers do not belong in `shared/` -- they have upward semantic dependencies on `persistence/`'s scope-root concept.

---

### `extensions/pi-claude-marketplace/shared/path-safety.ts` (utility, file-I/O)

**Analog:** NONE on `features/initial`. V1 had no symlink-aware containment; only string-level `path.relative` checks. **This is brand-new contract beyond V1** (CONTEXT.md D-14: "PRD doesn't specify symlink behavior -- this is new contract beyond V1").

**Source pattern:** RESEARCH.md Pattern 2 (lines 401-501), which the planner should treat as authoritative. Excerpt:

```typescript
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

export async function assertPathInside(parent: string, child: string, label: string): Promise<void> {
  if (!isPathInside(parent, child)) {
    throw new PathContainmentError(parent, child, label);
  }
  // walk every parent component from `parent` down to `child` with lstat()
  // ... (full body in RESEARCH.md lines 456-501)
}
```

**Divergences from V1 (V1 had a similar `assertPathInside` but without symlink-walk):**

- Per D-14: every component checked via `fs.lstat()`; on `isSymbolicLink()` throw `SymlinkRefusedError`.
- Per D-15: single chokepoint -- every PS-1 callsite uses this function and ONLY this function.
- Per D-16: walk every parent component, not just the leaf.
- Per D-17: `SymlinkRefusedError extends PathContainmentError` so PI-14 handling inherits, but distinguishable via `instanceof`.
- ENOENT mid-walk is benign (write-target case: leaf doesn't exist yet) -- return early.
- TOCTOU race window between lstat and write is documented as residual risk (RESEARCH.md inline note); not Phase 1's threat model.

**No V1 carry-forward for the error class shape** -- V1's errors.ts only had `errorMessage`, `appendLeakToError`, `appendLeaks` (no `PathContainmentError` class). Phase 1 introduces both error classes new.

---

### `extensions/pi-claude-marketplace/shared/markers.ts` (constants, request-response)

**Analog:** NONE on V1. V1 had marker strings INLINED at usage sites (e.g., `features/initial:extensions/pi-claude-marketplace/presentation/reload-hint.ts` line 16: `` ` Run /reload to ${verb} it.` ``). D-08 centralizes them.

**Source of truth:** PRD §6.12 ES-5 row, which lists 5 backtick-quoted literals.

**Concrete file shape (RESEARCH.md Pattern 6, lines 916-928):**

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

**Divergences from V1:** complete extraction. V1's `reloadHint(verb, names)` function in `presentation/reload-hint.ts` builds the runtime string from the inline literal `` ` Run /reload to ${verb} it.` ``. Phase 4-6 consumers re-import from `shared/markers.ts` instead. No P1 file consumes these yet -- `notify.ts`, `errors.ts`, `index.ts`, `path-safety.ts`, `atomic-json.ts`, `git.ts` do not need them.

---

### `extensions/pi-claude-marketplace/shared/notify.ts` (utility, request-response)

**Analog:** NONE on V1. V1 callers used `ctx.ui.notify(message, "warning")` directly throughout (e.g., current stub line 35: `ctx.ui.notify("Claude marketplace access is not implemented yet.", "warning");`).

**Source pattern:** RESEARCH.md Pattern 7 (lines 1003-1027).

```typescript
import type { ExtensionContext } from "@mariozechner/pi-coding-agent";

export function notifySuccess(ctx: ExtensionContext, message: string): void {
  // eslint-disable-next-line no-restricted-syntax -- shared/notify.ts is the sanctioned ctx.ui.notify call site
  ctx.ui.notify(message);
}

export function notifyWarning(ctx: ExtensionContext, message: string): void {
  // eslint-disable-next-line no-restricted-syntax
  ctx.ui.notify(message, "warning");
}

export function notifyError(ctx: ExtensionContext, message: string, cause?: unknown): void {
  const causeText = cause === undefined ? "" : `\nCause: ${cause instanceof Error ? cause.message : String(cause)}`;
  // eslint-disable-next-line no-restricted-syntax
  ctx.ui.notify(`${message}${causeText}`, "error");
}
```

**Divergences from V1:** entirely new -- V1 had no equivalent module. The wrapper IS the only sanctioned `ctx.ui.notify` callsite (per D-07). The `eslint-disable-next-line` comments inside the wrapper are the only such comments allowed for the `no-restricted-syntax` rule's `ctx.ui.notify` selector.

**Per-file ESLint override (paired in eslint.config.js):**

```javascript
{
  files: ["extensions/pi-claude-marketplace/shared/notify.ts"],
  rules: { "no-restricted-syntax": "off" },
},
```

The rule is on globally; the override turns it off only for `notify.ts` so the wrapper bodies don't need the inline disable-comments at all (alternative -- RESEARCH.md Pattern 7 keeps the inline disables AND the override; the planner picks one). Recommended: keep override AND inline `--` justification comments per Pitfall #5; redundancy here is the right call.

---

### `extensions/pi-claude-marketplace/shared/errors.ts` (utility, transform)

**Analog:** `features/initial:extensions/pi-claude-marketplace/errors.ts` (verbatim port).

**Verbatim file body to copy** (analog lines 1-40):

```typescript
/** Normalize a thrown `unknown` to its message text, since `instanceof Error`
 *  narrowing must be repeated everywhere a caught value is interpolated. */
export function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/**
 * If `leak` is non-undefined, return a new Error that names both `err` and
 * the leak so the user sees the original cause AND the manual-cleanup hint
 * in the same notification. ...
 */
export function appendLeakToError(err: unknown, leak: string | undefined): Error {
  const baseError = err instanceof Error ? err : new Error(String(err));
  if (leak === undefined) {
    return baseError;
  }

  return new Error(`${baseError.message} (additionally: ${leak})`, { cause: baseError });
}

export function appendLeaks(err: unknown, leaks: readonly (string | undefined)[]): Error {
  let wrapped = err instanceof Error ? err : new Error(String(err));
  for (const leak of leaks) {
    wrapped = appendLeakToError(wrapped, leak);
  }

  return wrapped;
}
```

**Divergences from V1:** **NONE**. Verbatim port. Only the file location moves: `extensions/pi-claude-marketplace/errors.ts` → `extensions/pi-claude-marketplace/shared/errors.ts`.

**Why `shared/`** (per RESEARCH.md Open Question 4): the helpers have no upward deps and every layer might catch + wrap. `shared/` is the only folder importable from everywhere.

---

### `extensions/pi-claude-marketplace/platform/git.ts` (platform facade, request-response)

**Analog:** `features/initial:extensions/pi-claude-marketplace/marketplace/git.ts` (V1's CLI shell-out version).

**V1 pattern to REPLACE (analog lines 1-55):**

```typescript
import { execFile } from "node:child_process";
import { readdir } from "node:fs/promises";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export interface CloneOptions {
  cloneUrl: string;
  ref?: string;
  targetDir: string;
}

export interface SyncOptions {
  dir: string;
  ref?: string;
}

export function buildCloneOptions(args: { cloneUrl: string; ref: string | undefined; targetDir: string }): CloneOptions {
  // ... exactOptionalPropertyTypes safe construction
}

// ... clone/fetch/pull all do execFileAsync("git", [...]) and parse stderr
```

**P1 replacement (per D-18..D-20 + RESEARCH.md Pattern 5, lines 833-889):**

```typescript
import * as git from "isomorphic-git";
import http from "isomorphic-git/http/node";
import * as fs from "node:fs";

export interface CloneOptions {
  /** Working-tree directory. */
  dir: string;
  /** Remote URL -- V1 accepts only https://github.com/<owner>/<repo>[.git] (SP-3). */
  url: string;
  ref?: string;
  singleBranch?: boolean;
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
    // No depth -- V1 keeps full history. No corsProxy. No onAuth -- public GitHub only.
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
// pull, checkout, resolveRef, listBranches stubbed identically; Phase 4's planner extends.
```

**Divergences from V1 (significant):**

- Field rename: `cloneUrl` → `url`, `targetDir` → `dir` (matches `isomorphic-git`'s argument names; also matches Phase 4's vocabulary).
- No more `execFile("git", [...])`, no stderr-regex parsing, no `git not found on PATH` failure path (which is why D-21 removes MA-7).
- No more `buildCloneOptions(...)` -- `exactOptionalPropertyTypes` safety is now achieved via spread-conditional `...(opts.ref !== undefined && { ref: opts.ref })` per ASSUMPTIONS.
- Sparse checkout (V1 deferred per PRD §11) is genuinely unsupported by `isomorphic-git` -- RESEARCH.md Deferred Ideas locks this in.
- Phase 1: NO callers. The wrapper exists purely so the import-x boundary rule has something to enforce when Phase 4 lands the marketplace orchestrators. Smoke test: `import("./platform/git.ts")` succeeds without throwing (proves the package resolves).

**ESM gotcha (RESEARCH.md Pitfall #3):** use `import * as git from "isomorphic-git"`, NOT `import git from "isomorphic-git"`. Under `module: "NodeNext"` the package's namespace import is the only stable form.

---

### 9 placeholder READMEs -- `{edge,orchestrators,bridges,domain,transaction,persistence,presentation,platform,shared}/README.md`

**Analog:** NONE on V1.

**Pattern (greenfield; per CONTEXT.md D-12):** each README has three sections -- Purpose, Allowed Imports (lifted from D-11), Planned Contents (TODO list pointing at the phase that lands real files). Markdown-formatted. mdformat will reflow them on commit per `.pre-commit-config.yaml`.

**Allowed-imports text** is the inverse of the eslint zone-list per folder. Example for `edge/README.md`:

```markdown
# edge/

## Purpose

Phase 6 lands the user-facing command surface: argument parsing for `/claude:plugin <subcommand>`, completion providers, the `pi_claude_marketplace_list` LLM tool, and the dispatch table that maps subcommands to orchestrators.

## Allowed Imports

`edge/` may import from: `orchestrators/`, `presentation/`, `shared/`. Imports from `bridges/`, `domain/`, `transaction/`, `persistence/`, `platform/` are forbidden by the import-x boundary rules in `eslint.config.js`.

## Planned Contents

- [ ] `router.ts` -- top-level subcommand dispatch (Phase 6)
- [ ] `args.ts` -- flag/positional parsing helpers (Phase 6)
- [ ] `completions.ts` -- getArgumentCompletions provider (Phase 6)
- [ ] `handlers/list.ts` -- `pi_claude_marketplace_list` LLM tool (Phase 6)
```

Same shape × 9. Per-folder text varies but the section structure is fixed.

---

### `eslint.config.js` (modified -- extend the existing flat-config array)

**Analog:** current `eslint.config.js` (already on `features/initial-gsd`, lines 1-77).

**Existing structure to PRESERVE (lines 7-58):**

```javascript
import js from "@eslint/js";
import stylistic from "@stylistic/eslint-plugin";
import importX from "eslint-plugin-import-x";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: [".claude/", "build/", "coverage/", "dist/", "node_modules/"] },
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  {
    files: ["**/*.{js,ts}"],
    plugins: { "@stylistic": stylistic, "import-x": importX },
    languageOptions: { /* parserOptions.projectService etc. */ },
    rules: {
      "no-console": "warn",
      // ... existing rules ...
    },
  },
  // existing tests/ override + eslint.config.js disable-typecheck override ...
);
```

**Phase 1 ADDS (per D-06 + D-11; RESEARCH.md Patterns 3 and 4):**

1. **Output-discipline block** scoped to `extensions/pi-claude-marketplace/**/*.ts` -- 6 `no-restricted-syntax` selectors covering `process.stdout.write`, `process.stderr.write`, `console.log/warn/error/info`, plus a 7th selector forbidding direct `ctx.ui.notify(` (D-07). Elevate `no-console` from `"warn"` to `"error"` for that scope.
2. **Import-boundary block** scoped to `extensions/pi-claude-marketplace/**/*.ts` -- `import-x/no-restricted-paths` with 9 zones (one per folder) per RESEARCH.md Pattern 4.
3. **Per-file overrides:**
   - `extensions/pi-claude-marketplace/shared/notify.ts` → `"no-restricted-syntax": "off"` (the wrapper IS the sanctioned site)
   - `tests/**/*.ts` → already exists; APPEND `"no-restricted-syntax": "off"`, `"no-console": "off"`
4. **NEW eslint config files override:** if `eslint.config.js` itself does not need the new restrictions (it doesn't import from the extension), the existing `disableTypeChecked` config block is sufficient.

**Verbatim 6-selector + 9-zone block:** see RESEARCH.md Pattern 3 (lines 534-600) and Pattern 4 (lines 643-778). The planner copies these verbatim -- they are pre-verified.

**Divergence from `features/initial`:** the V1 `eslint.config.js` has neither block. Both are NEW. The current branch's `eslint.config.js` already added `.claude/` to ignores (commit `a938c30`); preserve that.

---

### `package.json` (modified -- D-04 rewires)

**Analog:** current `package.json` (lines 1-51 above).

**Current state (must change):**

| Field | Current | Phase 1 target |
|-------|---------|----------------|
| `pi.extensions` | `["./extensions/pi-claude-marketplace/index.ts"]` | unchanged (already correct, but file does not exist yet -- Phase 1 makes it exist; per RESEARCH.md Pitfall #7) |
| `dependencies` | (none) | **NEW**: `"write-file-atomic": "^8.0.0"`, `"isomorphic-git": "^1.37.6"` |
| `devDependencies.tsx` | `"^4.21.0"` | **REMOVE** (per D-02) |
| `devDependencies.typebox` | `"^1.1.34"` | `"^1.1.38"` |
| `devDependencies.prettier` | `"^3.6.2"` | `"^3.8.3"` |
| `devDependencies.globals` | `"^17.5.0"` | `"^17.6.0"` |
| `devDependencies.@mariozechner/pi-coding-agent` | `"^0.70.6"` | `"^0.73.1"` (interim, per A6) |
| `devDependencies.memfs` (NEW) | -- | `"^4.57.2"` (RESEARCH.md Pattern 5 / CONTEXT.md Specific Idea -- for Phase 4's git tests; Phase 1 lands the dep) |
| `peerDependencies.@mariozechner/pi-coding-agent` | `"*"` | `">=0.70.6"` (interim floor per D-05) |
| `scripts.test` | `"node --import tsx --test \"tests/*.test.ts\" \"tests/{agent,commands,helpers,location,marketplace,mcp,plugin,presentation,resource,state,transaction}/**/*.test.ts\""` | `"node --test \"tests/**/*.test.ts\""` |
| `scripts.test:integration` | `"node --import tsx --test \"tests/integration/**/*.test.ts\""` | `"node --test \"tests/integration/**/*.test.ts\""` (drop `--import tsx`) |
| `engines.node` | `">=22"` | `">=22"` (unchanged; CI matrix handles Node-24-only per D-01, but the package supports the wider range) |

**Divergence from V1 `package.json` on `features/initial`:** V1 has the same legacy fields; Phase 1's rewire is identical to "what V1 should have been if D-02/D-03/D-04 had already happened."

---

### `tests/architecture/markers-snapshot.test.ts` (test, file-I/O / snapshot)

**Analog:** NONE on V1.

**Source pattern:** RESEARCH.md Pattern 6 (lines 932-995) -- the planner copies verbatim. Key shape:

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
  // Find ES-5 row, extract backtick-quoted literals, assert exported consts are prefix-equal
});
```

**V1 test scaffolding pattern** (mimic `features/initial:tests/fixtures.test.ts` for the import-style + `node:test` shape):

```typescript
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("test marketplace fixture is valid JSON", async () => {
  const manifest = JSON.parse(await readFile(fixtureManifest, "utf8")) as { /* ... */ };
  assert.equal(manifest.name, "test");
});
```

This V1 file confirms: `node:test` API, `node:assert/strict` import path, no helpers -- direct imports from `node:` namespace.

**Helper extraction:** per RESEARCH.md Pattern 6 closing note + CONTEXT.md Specific Ideas, factor the regex extraction into `tests/helpers/prd-extract.ts` so Phases 3 and 5 can reuse.

---

### `tests/architecture/import-boundaries.test.ts` (test, meta -- eslint introspection)

**Analog:** NONE on V1.

**Source pattern:** RESEARCH.md Pattern 4 closing paragraph (lines 780-782) + Pitfall #1 (lines 1150-1166) -- combined recipe:

```typescript
import test from "node:test";
import assert from "node:assert/strict";
import config from "../../eslint.config.js";

test("import-x/no-restricted-paths zones match the 9-folder spec", () => {
  // Walk config (it's the array tseslint.config returns), find the block with
  // import-x/no-restricted-paths, assert zones.length === 9, assert per-target
  // forbidden-set matches an expected map.
  const expected: Record<string, string[]> = {
    "./extensions/pi-claude-marketplace/edge": [
      "./extensions/pi-claude-marketplace/bridges",
      "./extensions/pi-claude-marketplace/domain",
      "./extensions/pi-claude-marketplace/transaction",
      "./extensions/pi-claude-marketplace/persistence",
      "./extensions/pi-claude-marketplace/platform",
    ],
    // ... 8 more entries ...
  };
  // assert each zone's `from` set equals expected[target]
});

test("canary fixture violates the rule (sanity check)", { todo: false }, async () => {
  // spawn `eslint tests/fixtures/bad-imports/edge-imports-bridges.ts`
  // assert exit code != 0 AND output mentions "no-restricted-paths"
});
```

The canary test requires `tests/fixtures/bad-imports/edge-imports-bridges.ts`:

```typescript
// Deliberately violates the import-x boundary. Run via the canary test.
import "../../../extensions/pi-claude-marketplace/bridges/index.ts";
export {};
```

(File is excluded from CI's normal eslint via the `tests/fixtures/` ignore -- the canary spawns eslint manually on it.)

**Greenfield** -- no V1 analog; pattern is research-derived.

---

### `tests/architecture/no-telemetry-deps.test.ts` (test, meta -- package.json read)

**Analog:** NONE on V1.

**Pattern (greenfield; per IL-4):**

```typescript
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const FORBIDDEN = ["@sentry/", "posthog", "mixpanel", "@opentelemetry/", "applicationinsights"];

test("no telemetry dependencies in package.json (IL-4)", async () => {
  const pkg = JSON.parse(await readFile("package.json", "utf8")) as {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  };
  const allDeps = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };
  for (const name of Object.keys(allDeps)) {
    for (const banned of FORBIDDEN) {
      assert.ok(!name.includes(banned), `Telemetry dep detected: ${name} (IL-4 forbids analytics/telemetry).`);
    }
  }
});
```

Mirrors `features/initial:tests/fixtures.test.ts` test-style (small, single-purpose, file-I/O check). 15 lines.

---

### `tests/shared/{path-safety,atomic-json,notify,errors}.test.ts` (test, unit)

**Analog scaffolding pattern:** `features/initial:tests/agent/frontmatter.test.ts` (excerpt above):

```typescript
import assert from "node:assert/strict";
import test from "node:test";

import {
  GENERATED_AGENT_MARKER,
  emitGeneratedAgentFile,
  // ...
} from "../../extensions/pi-claude-marketplace/agent/frontmatter.ts";

test("emitYamlScalar wraps double-quoted input in single quotes", () => {
  const out = emitYamlScalar('"hello world"');
  assert.equal(out, `'"hello world"'`);
});
```

This is the canonical V1 unit-test scaffolding: `import assert from "node:assert/strict"; import test from "node:test";` + per-behavior `test("...", () => { ... })` with `assert.equal`/`assert.ok`/`assert.deepEqual`. Phase 1's four `tests/shared/*.test.ts` files all follow this shape.

**Specific test inventory (per RESEARCH.md Validation Architecture lines 1404-1428):**

- `path-safety.test.ts` -- 7 tests covering happy path, direct escape, leaf symlink, parent-component symlink, non-existent leaf, ENOENT mid-walk, distinct-error-class instanceof. Setup uses `node:fs/promises mkdtemp` + `symlink` to build attack fixtures.
- `atomic-json.test.ts` -- 2-3 smoke tests: write happy path, concurrent-write serialization (kick off 5 in parallel, assert final content is one of them), parent-dir auto-create.
- `notify.test.ts` -- 4 smoke tests: `notifySuccess` calls `ctx.ui.notify(msg)` with no severity; `notifyWarning` passes `"warning"`; `notifyError` passes `"error"`; `notifyError` with `cause` appends `\nCause: ...`.
- `errors.test.ts` -- 3 smoke tests: `errorMessage` for Error/non-Error, `appendLeakToError` chains `Error.cause`, `appendLeaks` accumulates.

**Mocking note for `notify.test.ts`:** mock `ExtensionContext` is a small object literal `{ ui: { notify: mock.fn() } }` using `node:test`'s `mock.fn()`. No mocking framework needed.

---

## Shared Patterns

### Pattern: Severity-named notify wrappers (apply to ALL controller / presentation files in later phases)

**Source:** `extensions/pi-claude-marketplace/shared/notify.ts` (NEW, per D-07).
**Apply to:** every file in `edge/`, `orchestrators/`, `bridges/`, `presentation/` once those folders gain content. Phase 1: only `index.ts` consumes (one call to `notifyWarning`).

```typescript
import { notifySuccess, notifyWarning, notifyError } from "../shared/notify.ts";

notifySuccess(ctx, "Installed `hello@test`. Run /reload to load it.");
notifyWarning(ctx, "Plugin installed but pi-subagents is not loaded; agents skipped.");
notifyError(ctx, "Install failed: containment violation.", err);
```

Direct `ctx.ui.notify(...)` outside `shared/notify.ts` is forbidden by the eslint `no-restricted-syntax` selector targeting `ctx.ui.notify(`.

### Pattern: Atomic JSON write (apply to `state.json`, `mcp.json`, `agents-index.json` in P2/P3/P5)

**Source:** `extensions/pi-claude-marketplace/shared/atomic-json.ts` (NEW, per D-03).
**Apply to:** every JSON file write that participates in `withStateGuard`.

```typescript
import { atomicWriteJson } from "../shared/atomic-json.ts";

await atomicWriteJson(stateJsonPath, migrated);
```

NOT for staging-tree commits (Phase 3 keeps V1's hand-rolled `mkdir`+`writeFile`+`rename` for those -- different problem shape).

### Pattern: Path-containment chokepoint (apply to EVERY name-derived path in P3+)

**Source:** `extensions/pi-claude-marketplace/shared/path-safety.ts` (NEW, per D-14..D-17).
**Apply to:** every site that resolves a path from user input or plugin manifest -- bridges (Phase 3), orchestrators (Phase 4-5), persistence (Phase 2). Phase 1: zero callsites yet.

```typescript
import { assertPathInside, PathContainmentError, SymlinkRefusedError } from "../shared/path-safety.ts";

await assertPathInside(scope.agentsDir, candidatePath, "agent file");
// Throws PathContainmentError on string-level escape, SymlinkRefusedError on symlink walk.
```

### Pattern: Error-with-cause chaining (apply throughout)

**Source:** V1 `errors.ts` → ported verbatim to `shared/errors.ts`.
**Apply to:** every `try`/`catch` that wraps another error.

```typescript
import { errorMessage, appendLeakToError, appendLeaks } from "../shared/errors.ts";

try { /* ... */ } catch (err) {
  const leak = await cleanupStaging(stagingDir, "agents staging directory");
  throw appendLeakToError(err, leak);  // chains via Error.cause
}
```

### Pattern: ESLint output discipline (eslint.config.js)

**Source:** `eslint.config.js` (modified, per D-06).
**Apply to:** all files under `extensions/pi-claude-marketplace/`.

The 6-selector + `no-console: "error"` block is verbatim from RESEARCH.md Pattern 3. The single sanctioned `console.warn` site (load-time `migrateLegacyMarketplaceRecords` per IL-3) lands in Phase 2 -- its disable-comment incantation is documented in RESEARCH.md lines 611-621 for that planner.

### Pattern: ESLint import-direction enforcement

**Source:** `eslint.config.js` (modified, per D-11).
**Apply to:** all files under `extensions/pi-claude-marketplace/`.

The 9-zone `import-x/no-restricted-paths` block from RESEARCH.md Pattern 4 (lines 643-778) is verbatim. Each zone is `{ target, from: [forbidden_sources], message }`. Tests (`tests/architecture/import-boundaries.test.ts`) verify the zone array structure.

### Pattern: V1 test scaffolding (apply to all `tests/**/*.test.ts`)

**Source:** `features/initial:tests/agent/frontmatter.test.ts` and `features/initial:tests/fixtures.test.ts`.

```typescript
import assert from "node:assert/strict";
import test from "node:test";

import { /* SUT */ } from "../../extensions/pi-claude-marketplace/<path>.ts";

test("description", () => {
  // Arrange / Act / Assert
  assert.equal(actual, expected);
});

test("async description", async () => {
  // ...
});
```

`node:test` + `node:assert/strict` only -- no Jest, no Vitest, no Mocha. Tests run as `node --test "tests/**/*.test.ts"` (no `--import tsx` per D-02).

---

## No Analog Found

Files / decisions where V1 has zero precedent -- planner uses RESEARCH.md as canonical:

| File / Decision | Reason | Authoritative Source |
|-----------------|--------|----------------------|
| `shared/path-safety.ts` (`SymlinkRefusedError` + per-component lstat walk) | V1 had only string-level containment checks; symlink handling is brand-new contract | RESEARCH.md Pattern 2 (lines 401-501) |
| `shared/markers.ts` | V1 had marker strings inlined at usage sites | RESEARCH.md Pattern 6 + PRD §6.12 ES-5 row |
| `shared/notify.ts` (severity-named helpers) | V1 used `ctx.ui.notify(...)` directly throughout | RESEARCH.md Pattern 7 (lines 1003-1054) |
| `tests/architecture/markers-snapshot.test.ts` | V1 had no architecture-level tests | RESEARCH.md Pattern 6 (lines 932-995) |
| `tests/architecture/import-boundaries.test.ts` | V1 had no boundary rules to test | RESEARCH.md Pitfall #1 + Pattern 4 closing |
| `tests/architecture/no-telemetry-deps.test.ts` | V1 had no IL-4 enforcement test | RESEARCH.md Validation Architecture |
| `tests/helpers/prd-extract.ts` | V1 had no PRD-parsing helpers | CONTEXT.md Specific Ideas + RESEARCH.md Pattern 6 |
| `tests/fixtures/bad-imports/edge-imports-bridges.ts` | V1 had no canary fixtures | RESEARCH.md Pitfall #1 |
| 9 placeholder READMEs | V1 had no folder READMEs | CONTEXT.md D-12 (no precedent -- pure greenfield) |
| `eslint.config.js` `no-restricted-syntax` block | V1 had only `no-console: "warn"` | RESEARCH.md Pattern 3 (lines 534-600) |
| `eslint.config.js` `import-x/no-restricted-paths` block | V1 had no boundary rules | RESEARCH.md Pattern 4 (lines 643-778) |
| `platform/git.ts` `isomorphic-git` adoption | V1 used `execFile("git", [...])` | RESEARCH.md Pattern 5 (lines 833-889) + D-18..D-20 |

---

## Metadata

**Analog search scope:**

- `features/initial` branch (V1 source) -- `extensions/pi-claude-marketplace/{agent,commands,location,marketplace,mcp,plugin,presentation,resource,state,transaction}/` and `tests/{agent,commands,location,...}/`
- Current `features/initial-gsd` branch -- `extensions/pi-claude-marketplace.ts` (stub), `eslint.config.js`, `package.json`, `tsconfig.json`
- RESEARCH.md (HIGH-confidence patterns where V1 has no precedent)

**Files inspected (verified 2026-05-09 via `git show` or `Read`):**

- `features/initial:extensions/pi-claude-marketplace/index.ts` (V1 entrypoint, 200+ lines)
- `features/initial:extensions/pi-claude-marketplace/fs-utils.ts` (atomicWriteJson, pathExists, dirExists, cleanupStaging)
- `features/initial:extensions/pi-claude-marketplace/errors.ts` (errorMessage, appendLeakToError, appendLeaks -- verbatim port target)
- `features/initial:extensions/pi-claude-marketplace/marketplace/git.ts` (V1 `execFile("git")` wrapper -- replaced by isomorphic-git)
- `features/initial:extensions/pi-claude-marketplace/presentation/reload-hint.ts` (V1's inlined `Run /reload to ${verb}` literal -- extraction source for `RELOAD_HINT_PREFIX`)
- `features/initial:tests/fixtures.test.ts`, `features/initial:tests/agent/frontmatter.test.ts` (test scaffolding pattern)
- `features/initial:eslint.config.js` (V1 baseline -- identical to current except for `.claude/` ignore)
- Current `extensions/pi-claude-marketplace.ts` (stub registering `pi_claude_marketplace_list` tool + `pi-claude-marketplace:list` command)
- Current `eslint.config.js`, `package.json`, `tsconfig.json` (modification targets)

**Pattern extraction date:** 2026-05-09

**Key insight:** Phase 1 has TWO distinct pattern-source profiles:

1. **Verbatim V1 carry-forward** (1 file): `shared/errors.ts`. The V1 implementation is correct; only the location moves.
2. **V1 replacement with research-canonical implementation** (3 files): `shared/atomic-json.ts` (V1 hand-rolled → write-file-atomic), `platform/git.ts` (V1 `execFile` → isomorphic-git), `index.ts` (V1 fully-wired → P1 thin skeleton).
3. **Pure greenfield** (everything else): `shared/path-safety.ts`, `shared/markers.ts`, `shared/notify.ts`, all 9 READMEs, all 4 `tests/architecture/*` and 4 `tests/shared/*` test files, `tests/helpers/prd-extract.ts`, `tests/fixtures/bad-imports/*`, the eslint.config.js extensions.

The greenfield surface is the bulk of Phase 1. Planner should rely on RESEARCH.md sections (Pattern 1-8 + Validation Architecture) for those, not invent new shapes.

---

## PATTERN MAPPING COMPLETE
