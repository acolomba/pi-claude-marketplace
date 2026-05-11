---
phase: 06-edge-layer-tab-completion
plan: 02
type: execute
wave: 1
depends_on:
  - 06-01
files_modified:
  - extensions/claude-marketplace/edge/args.ts
  - extensions/claude-marketplace/edge/args-schema.ts
  - extensions/claude-marketplace/edge/router.ts
  - extensions/claude-marketplace/edge/types.ts
  - extensions/claude-marketplace/persistence/locations.ts
  - tests/edge/args.test.ts
  - tests/edge/args-schema.test.ts
  - tests/edge/router.test.ts
  - tests/edge/completions/normalize.test.ts
  - extensions/claude-marketplace/edge/completions/normalize.ts
autonomous: true
requirements:
  - AP-1
  - AP-2
  - AP-3
  - AP-4
  - TC-2
  - TC-7
must_haves:
  truths:
    - "`parseArgs(\"--scope user install foo@bar\")` returns `{ positional: [\"install\",\"foo@bar\"], scope: \"user\" }`"
    - "`parseArgs(\"--scope foo\")` throws `Invalid --scope value: \"foo\". Must be \"user\" or \"project\".`"
    - "`parseArgs(\"--scope\")` throws `--scope requires a value: \"user\" or \"project\".`"
    - "`parseCommandArgs(args, schema, notifyError)` returns undefined and calls notifyError with the schema usage when required positional missing"
    - "`routeClaudePlugin(\"\", handlers, ctx)` emits TOP_LEVEL_USAGE at error severity via `notifyUsageError` (not direct `ctx.ui.notify`)"
    - "`routeClaudePlugin(\"unknownverb\", handlers, ctx)` emits `Unknown subcommand: \"unknownverb\".\\n\\n<TOP_LEVEL_USAGE>` at error severity"
    - "`routeMarketplace(\"rm myname\", handlers, ctx)` dispatches to `handlers.marketplaceRemove` (rm alias TC-2)"
    - "`isClaudePluginCommandLine(\"/claude:plugin:42 install\")` returns true (collision-suffix tolerance)"
    - "`normalizeCompletionWhitespace` collapses doubled spaces at cursor; is idempotent"
    - "`ScopedLocations` exposes `cacheDir`, `marketplaceNamesCacheFile`, and `pluginCacheFile(marketplace)`"
    - "Skipped tests for AP-1, AP-2, AP-3, AP-4, TC-2 router/dispatch, and TC-7 are now unskipped and green"
  artifacts:
    - path: extensions/claude-marketplace/edge/args.ts
      provides: "AP-1 tokenizer + AP-2/AP-4 --scope validation"
      exports: ["parseArgs", "ParsedArgs"]
    - path: extensions/claude-marketplace/edge/args-schema.ts
      provides: "Schema-driven positional validator"
      exports: ["parseCommandArgs", "PositionalSpec", "ParsedCommandArgs"]
    - path: extensions/claude-marketplace/edge/router.ts
      provides: "routeClaudePlugin + routeMarketplace + Usage consts (AP-3)"
      exports: ["routeClaudePlugin", "routeMarketplace", "TOP_LEVEL_USAGE", "MARKETPLACE_USAGE", "SubcommandHandlers"]
    - path: extensions/claude-marketplace/edge/types.ts
      provides: "EdgeDeps interface (D-04)"
      exports: ["EdgeDeps"]
    - path: extensions/claude-marketplace/edge/completions/normalize.ts
      provides: "TC-7 fish-style whitespace normalizer + isClaudePluginCommandLine regex"
      exports: ["normalizeCompletionWhitespace", "isClaudePluginCommandLine"]
    - path: extensions/claude-marketplace/persistence/locations.ts
      provides: "Cache path helpers (cacheDir, marketplaceNamesCacheFile, pluginCacheFile)"
      contains: "pluginCacheFile"
  key_links:
    - from: extensions/claude-marketplace/edge/router.ts
      to: extensions/claude-marketplace/shared/notify.ts
      via: "import { notifyUsageError } from \"../shared/notify.ts\""
      pattern: "notifyUsageError"
    - from: extensions/claude-marketplace/edge/args-schema.ts
      to: extensions/claude-marketplace/edge/args.ts
      via: "import { parseArgs } from \"./args.ts\""
      pattern: "from \"./args"
    - from: extensions/claude-marketplace/persistence/locations.ts
      to: extensions/claude-marketplace/shared/path-safety.ts
      via: "assertPathInside for cache path containment"
      pattern: "assertPathInside.*cacheDir"
---

<objective>
Land the edge-layer parser, router, types, and TC-7 normalizer primitives, plus the `persistence/locations.ts` cache-path helpers. This plan ports V1's `args.ts`, `commands/_args.ts`, `commands/router.ts`, and the TC-7 helpers from `completions.ts` verbatim into the new `edge/` directory, with only the import paths refactored to reach `shared/`. It also extends `ScopedLocations` with the three cache path helpers that Plan 03 will consume.

Purpose: Plans 03 (cache + completions) and 04 (handlers + LLM tools) depend on these primitives. Landing them in a single small plan keeps Wave 1 atomic.

Output:
- 5 new files under `extensions/claude-marketplace/edge/`
- 1 modified file (`persistence/locations.ts`)
- 4 unskipped + green tests (args, args-schema, router, normalize)
</objective>

<execution_context>
@/Users/acolomba/src/pi-claude-marketplace/.claude/get-shit-done/workflows/execute-plan.md
@/Users/acolomba/src/pi-claude-marketplace/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/06-edge-layer-tab-completion/06-CONTEXT.md
@.planning/phases/06-edge-layer-tab-completion/06-RESEARCH.md
@.planning/phases/06-edge-layer-tab-completion/06-PATTERNS.md
@.planning/phases/06-edge-layer-tab-completion/06-01-SUMMARY.md

<!-- Phase 1 carry-forward consumed here -->
@extensions/claude-marketplace/shared/notify.ts
@extensions/claude-marketplace/shared/errors.ts
@extensions/claude-marketplace/shared/types.ts
@extensions/claude-marketplace/shared/path-safety.ts
@extensions/claude-marketplace/persistence/locations.ts

<!-- Orchestrator types that EdgeDeps imports -->
@extensions/claude-marketplace/orchestrators/marketplace/shared.ts
@extensions/claude-marketplace/orchestrators/types.ts

<interfaces>
<!-- Key V1 source to port verbatim. Run these commands to retrieve full content; do NOT re-read 06-PATTERNS.md, the snippets there are abridged. -->

Run:
```bash
git show features/initial:extensions/claude-marketplace/args.ts
git show features/initial:extensions/claude-marketplace/commands/_args.ts
git show features/initial:extensions/claude-marketplace/commands/router.ts
git show features/initial:extensions/claude-marketplace/completions.ts | sed -n '1,310p'
```

`shared/notify.ts` exports (verified):
```typescript
export function notifySuccess(ctx: ExtensionContext, message: string): void;
export function notifyWarning(ctx: ExtensionContext, message: string): void;
export function notifyError(ctx: ExtensionContext, message: string, cause?: unknown): void;
export function notifyUsageError(ctx: ExtensionContext, message: string, usageBlock: string): void;
```

Phase 6 router MUST use `notifyUsageError(ctx, message, usageBlock)` -- not `ctx.ui.notify` (ESLint BLOCK A forbids direct notify in `edge/`).

`SubcommandHandlers` interface (per 06-PATTERNS.md lines 68-81):
```typescript
export interface SubcommandHandlers {
  install: (args: string, ctx: ExtensionCommandContext) => Promise<void>;
  uninstall: (args: string, ctx: ExtensionCommandContext) => Promise<void>;
  update: (args: string, ctx: ExtensionCommandContext) => Promise<void>;
  list: (args: string, ctx: ExtensionCommandContext) => Promise<void>;
  marketplaceAdd: (args: string, ctx: ExtensionCommandContext) => Promise<void>;
  marketplaceRemove: (args: string, ctx: ExtensionCommandContext) => Promise<void>;
  marketplaceList: (args: string, ctx: ExtensionCommandContext) => Promise<void>;
  marketplaceUpdate: (args: string, ctx: ExtensionCommandContext) => Promise<void>;
  marketplaceAutoupdate: (args: string, ctx: ExtensionCommandContext) => Promise<void>;
  marketplaceNoautoupdate: (args: string, ctx: ExtensionCommandContext) => Promise<void>;
}
```

`EdgeDeps` interface (D-04, per 06-PATTERNS.md lines 607-615):
```typescript
import type { GitOps } from "../orchestrators/marketplace/shared.ts";
import type { PluginUpdateFn } from "../orchestrators/types.ts";

export interface EdgeDeps {
  readonly gitOps: GitOps;
  readonly pluginUpdate: PluginUpdateFn;
}
```

`persistence/locations.ts` extension pattern (per 06-PATTERNS.md lines 800-833):
- Add `cacheDir: string`, `marketplaceNamesCacheFile: string` as readonly properties on `ScopedLocations`.
- Add `pluginCacheFile(marketplace: string): Promise<string>` method using `assertSafeName` + `assertPathInside` (mirror existing `pluginDataDir` at lines 133-145).
- `cacheDir = path.join(extensionRoot, "cache")`.
- `marketplaceNamesCacheFile = path.join(cacheDir, "marketplace-names.json")`.

`TOP_LEVEL_USAGE` and `MARKETPLACE_USAGE` are PRD-stable strings (carried verbatim from V1, exact text in 06-PATTERNS.md lines 85-101).
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Port edge/args.ts + edge/args-schema.ts; unskip and pass args + args-schema tests</name>
  <files>extensions/claude-marketplace/edge/args.ts, extensions/claude-marketplace/edge/args-schema.ts, tests/edge/args.test.ts, tests/edge/args-schema.test.ts</files>
  <action>
1. Run `git show features/initial:extensions/claude-marketplace/args.ts` and create `extensions/claude-marketplace/edge/args.ts` with the V1 content verbatim, modulo the import: change `import type { Scope } from "./types.ts"` to `import type { Scope } from "../shared/types.ts"`.

2. Run `git show features/initial:extensions/claude-marketplace/commands/_args.ts` and create `extensions/claude-marketplace/edge/args-schema.ts` with the V1 content verbatim, modulo imports:
   - `./args.ts` for `parseArgs` (V1 imported from `../args.ts`)
   - `../shared/errors.ts` for `errorMessage`
   - `../shared/types.ts` for `Scope`

3. Unskip every test in `tests/edge/args.test.ts` (created in Plan 01) and implement the assertions. Specifically:
   - Replace each `test.skip(name, () => {})` with `test(name, () => { ... })`.
   - REMOVE the `// @ts-expect-error` directive on the import (the module now exists).
   - Implement assertions per the test name (e.g., for "AP-1 :: tokenize single-quoted spaced argument", assert `parseArgs("install 'foo bar'").positional === ["install", "foo bar"]`).
   - For throwing tests, use `assert.throws(() => parseArgs("--scope foo"), /Invalid --scope value/)`.

4. Same for `tests/edge/args-schema.test.ts`. Implement the four schema-driven validator cases with concrete fixtures:
   - Schema example: `{ positional: [{ name: "ref" }] as const, usage: "Usage: /claude:plugin install <ref>" }`
   - For tokenizer-throw case, pass `"--scope foo"` and assert notifyError received the throw message.

5. Verify the ESLint BLOCK C rule (`edge/` may only import from `orchestrators/`, `presentation/`, `shared/`) by checking imports manually -- neither file should import from `domain/`, `persistence/`, `transaction/`, `bridges/`, or `platform/`.

Use `notify` callbacks (the function injected as a parameter to `parseCommandArgs`) -- args-schema.ts itself does NOT import `notifySuccess`/`notifyError` from `shared/notify.ts`; the caller (handler) passes a closure that wraps `notifyError(ctx, ...)`.
  </action>
  <verify>
    <automated>node --test tests/edge/args.test.ts tests/edge/args-schema.test.ts && npx tsc --noEmit && npx eslint extensions/claude-marketplace/edge/args.ts extensions/claude-marketplace/edge/args-schema.ts tests/edge/args.test.ts tests/edge/args-schema.test.ts</automated>
  </verify>
  <done>Both files exist. All previously-skipped args/args-schema tests are unskipped, green, and assert the named behaviors. Typecheck clean. ESLint clean.</done>
</task>

<task type="auto">
  <name>Task 2: Port edge/router.ts + edge/types.ts + edge/completions/normalize.ts; unskip router + normalize tests</name>
  <files>extensions/claude-marketplace/edge/router.ts, extensions/claude-marketplace/edge/types.ts, extensions/claude-marketplace/edge/completions/normalize.ts, tests/edge/router.test.ts, tests/edge/completions/normalize.test.ts</files>
  <action>
1. Run `git show features/initial:extensions/claude-marketplace/commands/router.ts` and create `extensions/claude-marketplace/edge/router.ts` with two refinements:
   - Replace every `ctx.ui.notify(message, "error")` direct call with `notifyUsageError(ctx, message, usageBlock)` (or `notifyUsageError(ctx, "Usage error.", TOP_LEVEL_USAGE)` for the empty-args case where V1 had no leading message).
   - Import path: `import { notifyUsageError } from "../shared/notify.ts"` and `import type { ExtensionCommandContext } from "@mariozechner/pi-coding-agent"`.
   - Export: `routeClaudePlugin`, `routeMarketplace`, `TOP_LEVEL_USAGE`, `MARKETPLACE_USAGE`, `SubcommandHandlers`.
   - `routeMarketplace` MUST accept `case "remove": case "rm":` (TC-2 alias carry-forward).
   - The unknown-subcommand path uses the form: `notifyUsageError(ctx, \`Unknown subcommand: "${head}".\`, TOP_LEVEL_USAGE)`. For empty input use `notifyUsageError(ctx, "Usage error.", TOP_LEVEL_USAGE)`.

2. Create `extensions/claude-marketplace/edge/types.ts` with the `EdgeDeps` interface (and re-export `SubcommandHandlers` from `./router.ts` so consumers can `import type { EdgeDeps, SubcommandHandlers } from "./types.ts"` -- single import surface):
   ```typescript
   export type { SubcommandHandlers } from "./router.ts";

   import type { GitOps } from "../orchestrators/marketplace/shared.ts";
   import type { PluginUpdateFn } from "../orchestrators/types.ts";

   export interface EdgeDeps {
     readonly gitOps: GitOps;
     readonly pluginUpdate: PluginUpdateFn;
   }
   ```

3. Create `extensions/claude-marketplace/edge/completions/normalize.ts` containing:
   - `normalizeCompletionWhitespace` (V1 verbatim, see 06-PATTERNS.md lines 326-340)
   - `isClaudePluginCommandLine` (V1 verbatim)
   - `CLAUDE_PLUGIN_LINE` regex (V1 verbatim: `/^\/claude:plugin(?::\d+)?(?:\s|$)/`)

4. Unskip every test in `tests/edge/router.test.ts` and implement the 15 cases:
   - Use the `makeCtx()` helper pattern from `tests/orchestrators/marketplace/list.test.ts`.
   - Construct `handlers: SubcommandHandlers` as a record of spy functions (each spy records that it was invoked with what `args`).
   - For each dispatch case: invoke `routeClaudePlugin(args, handlers, ctx)`, assert the corresponding spy was called once with the expected `rest` string.
   - For AP-3 cases: assert `notifications` array contains one entry with severity `"error"` and message containing the relevant Usage block.
   - For the rm alias case: invoke `routeClaudePlugin("marketplace rm myname", handlers, ctx)`, assert `handlers.marketplaceRemove` was called with `"myname"`.

5. Unskip every test in `tests/edge/completions/normalize.test.ts` and implement the 10 cases against the concrete functions.

6. CRITICAL: Verify (via `grep -n 'ctx.ui.notify' extensions/claude-marketplace/edge/router.ts`) that the router does NOT call `ctx.ui.notify` directly. Only `notifyUsageError`/`notifyError`/`notifyWarning`/`notifySuccess` are allowed. ESLint BLOCK A will block direct notify anyway, but the grep is faster feedback.
  </action>
  <verify>
    <automated>grep -v '^#' extensions/claude-marketplace/edge/router.ts | grep -c 'ctx\.ui\.notify' | grep -qx 0 &amp;&amp; node --test tests/edge/router.test.ts tests/edge/completions/normalize.test.ts &amp;&amp; npx tsc --noEmit &amp;&amp; npx eslint extensions/claude-marketplace/edge/router.ts extensions/claude-marketplace/edge/types.ts extensions/claude-marketplace/edge/completions/normalize.ts tests/edge/router.test.ts tests/edge/completions/normalize.test.ts</automated>
  </verify>
  <done>router.ts, types.ts, normalize.ts exist. Router contains zero direct `ctx.ui.notify` calls (notify-discipline gate). All router and normalize tests green. Typecheck + ESLint clean.</done>
</task>

<task type="auto">
  <name>Task 3: Extend persistence/locations.ts with cache path helpers; verify path containment</name>
  <files>extensions/claude-marketplace/persistence/locations.ts</files>
  <action>
1. Read the existing `extensions/claude-marketplace/persistence/locations.ts` to confirm the `ScopedLocations` interface and `locationsFor` function shape.

2. Add three additions per 06-PATTERNS.md lines 810-831:

   **Interface additions** (inside `ScopedLocations`):
   ```typescript
   readonly cacheDir: string;
   readonly marketplaceNamesCacheFile: string;
   pluginCacheFile(marketplace: string): Promise<string>;
   ```

   **Implementation additions** (inside `locationsFor` body, near the existing `dataRoot`, `sourcesDir` declarations):
   ```typescript
   const cacheDir = path.join(extensionRoot, "cache");
   const marketplaceNamesCacheFile = path.join(cacheDir, "marketplace-names.json");
   ```

   **Frozen-bundle additions**:
   ```typescript
   cacheDir,
   marketplaceNamesCacheFile,

   async pluginCacheFile(marketplace: string): Promise<string> {
     assertSafeName(marketplace, `pluginCacheFile marketplace name "${marketplace}"`);
     const candidate = path.join(cacheDir, "plugins", `${marketplace}.json`);
     await assertPathInside(cacheDir, candidate, `pluginCacheFile(${marketplace})`);
     return candidate;
   },
   ```

3. Verify symbol availability: `assertSafeName` (already used by `pluginDataDir`) and `assertPathInside` (already used). No new imports needed.

4. Spot-check containment by adding a smoke test inline at the end of an existing `locations.test.ts` if it exists -- OR rely on the cache module's tests in Plan 03 to catch a broken helper. Per the planner's discretion: if `tests/persistence/locations.test.ts` exists, add three small assertions:
   - `loc.cacheDir.endsWith("/cache")`
   - `loc.marketplaceNamesCacheFile.endsWith("/cache/marketplace-names.json")`
   - `await loc.pluginCacheFile("safe-name")` resolves; `await loc.pluginCacheFile("../../etc")` throws via `assertSafeName`.
   If no such test file exists, defer this check to Plan 03 (the completion-cache tests will exercise the helper).
  </action>
  <verify>
    <automated>npx tsc --noEmit &amp;&amp; npx eslint extensions/claude-marketplace/persistence/locations.ts &amp;&amp; node -e 'import("./extensions/claude-marketplace/persistence/locations.ts").then(m => { const l = m.locationsFor("user", "/tmp/cwd"); if (!l.cacheDir.endsWith("/cache")) process.exit(1); if (!l.marketplaceNamesCacheFile.endsWith("/cache/marketplace-names.json")) process.exit(2); l.pluginCacheFile("safe-name").then(p => { if (!p.endsWith("/cache/plugins/safe-name.json")) process.exit(3); l.pluginCacheFile("../../etc").then(() => process.exit(4), () => process.exit(0)); }); }).catch(() => process.exit(99))'</automated>
  </verify>
  <done>locations.ts exports cacheDir + marketplaceNamesCacheFile properties on ScopedLocations and pluginCacheFile method. Typecheck clean. ESLint clean. The smoke verify above exits 0 (safe-name path is correct, traversal name rejected).</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| User stdin -> args tokenizer | Untrusted free-form string crosses into parser; mitigated by lack of escape semantics (V1 carry-forward; no shell injection vector because Pi already split at process-arg level) |
| Marketplace name (D-03 path input) -> `pluginCacheFile(marketplace)` | Marketplace names originate in user-supplied manifests; mitigated by `assertSafeName` + `assertPathInside` (NFR-10) |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-EDGE-2 | Tampering | --scope argument injection via shell | mitigate | Tokenizer treats --scope value as a positional string and validates against literal `user\|project` allowlist (AP-2). Any other value throws. NFR-10 containment in `assertPathInside` blocks downstream path effects. |
| T-EDGE-5b | Spoofing | Marketplace name used to compose `pluginCacheFile` path | mitigate | `assertSafeName` rejects names containing path separators, `..`, control chars; `assertPathInside(cacheDir, candidate)` blocks symlink escape (Phase 1 D-14..17). |
| T-EDGE-6 | Information Disclosure | Router error messages reveal subcommand list to user | accept | TOP_LEVEL_USAGE is the documented user contract (AP-3). No sensitive data is in the Usage block. |

All threats classified LOW; none block the plan (`security_block_on` default `high`). Mitigations are implemented inline by the V1 carry-forward semantics.
</threat_model>

<verification>
- 5 new files exist (`edge/args.ts`, `edge/args-schema.ts`, `edge/router.ts`, `edge/types.ts`, `edge/completions/normalize.ts`).
- 1 modified file (`persistence/locations.ts`) exposes `cacheDir`, `marketplaceNamesCacheFile`, `pluginCacheFile`.
- 4 test files (args, args-schema, router, normalize) have all stubs unskipped and passing.
- `npm run check` exits 0 (full typecheck + lint + format + tests).
- `grep -v '^#' extensions/claude-marketplace/edge/router.ts | grep -c 'ctx\.ui\.notify' | grep -qx 0` confirms zero direct notify calls (notify-discipline self-invariant).
- Total test count increase: roughly 36+ tests transitioned from skipped to passing.
</verification>

<success_criteria>
- All Wave 1 modules ship with V1-parity behavior for AP-1, AP-2, AP-3, AP-4, TC-2 (router rm alias), TC-7 (normalize + regex).
- ESLint BLOCK A enforces zero direct `ctx.ui.notify` calls under `edge/` -- verified by per-file lint.
- `ScopedLocations` cache helpers ready for Plan 03 to consume.
- The phase test baseline remains green at every commit.
</success_criteria>

<output>
After completion, create `.planning/phases/06-edge-layer-tab-completion/06-02-SUMMARY.md` noting:
- Verbatim V1 ports vs. refinements (notify path).
- Decision-ID traceability (AP-1, AP-2, AP-3, AP-4, TC-2 router slice, TC-7, D-04 EdgeDeps placement).
- The two `notify` discipline checkpoints (router.ts grep, ESLint BLOCK A).
- Any unskipped-test deviations from Plan 01's stub names.
</output>
