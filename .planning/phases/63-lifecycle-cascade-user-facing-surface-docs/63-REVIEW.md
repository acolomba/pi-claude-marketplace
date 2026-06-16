---
phase: 63-lifecycle-cascade-user-facing-surface-docs
reviewed: 2026-06-16T00:00:00Z
depth: standard
files_reviewed: 30
files_reviewed_list:
  - docs/hooks.md
  - docs/output-catalog.md
  - extensions/pi-claude-marketplace/bridges/hooks/index.ts
  - extensions/pi-claude-marketplace/bridges/hooks/stage.ts
  - extensions/pi-claude-marketplace/domain/components/hook-events.ts
  - extensions/pi-claude-marketplace/domain/resolver.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/info.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/update.ts
  - extensions/pi-claude-marketplace/orchestrators/types.ts
  - extensions/pi-claude-marketplace/shared/errors.ts
  - extensions/pi-claude-marketplace/shared/notify.ts
  - tests/architecture/catalog-uat.test.ts
  - tests/architecture/notify-types.test.ts
  - tests/architecture/scope-fences-63.test.ts
  - tests/bridges/hooks/stage.test.ts
  - tests/bridges/hooks/symlink-escape.test.ts
  - tests/docs/hooks-doc.test.ts
  - tests/domain/resolver-strict.test.ts
  - tests/orchestrators/marketplace/cascade.test.ts
  - tests/orchestrators/marketplace/remove.test.ts
  - tests/orchestrators/plugin/info.test.ts
  - tests/orchestrators/plugin/install.test.ts
  - tests/orchestrators/plugin/reinstall.test.ts
  - tests/orchestrators/plugin/uninstall.test.ts
  - tests/orchestrators/plugin/update.test.ts
  - tests/shared/notify-v2.test.ts
  - tests/transaction/lifecycle-cascade.test.ts
findings:
  critical: 1
  warning: 5
  info: 3
  total: 9
status: issues_found
---

# Phase 63: Code Review Report

**Reviewed:** 2026-06-16
**Depth:** standard
**Files Reviewed:** 30
**Status:** issues_found

## Summary

Phase 63 wires the v1.13 hook bridge into the user-visible surface: the 5th lifecycle cascade slot (`bridges/hooks/index.ts` + `bridges/hooks/stage.ts`), the resolver's orphan-rewake detection, the multi-line `hooks:` info render, the `(installed) {orphan rewake}` REASONS extension, plus `docs/hooks.md` + `docs/output-catalog.md` updates. The cascade plumbing through `install.ts` / `update.ts` / `reinstall.ts` / `marketplace/shared.ts::cascadeUnstagePlugin` looks structurally sound and the closed-set discipline (REASONS / STATUS_TOKENS / COMPONENT_KINDS) is preserved end-to-end.

The headline correctness defect is LIFE-03's symlink-escape guard: the `readdir(..., { recursive: true })` walker that backs `assertNoSymlinkEscapeInHooksSubtree` follows symlinks to directories, so the walker descends INTO an escaping symlink target and emits entries from outside `pluginRoot`. The walker still rejects because the symlink entry itself is also emitted with `isSymbolicLink() === true`, but (a) the in-walk fs reads against an attacker-controlled external tree have already happened before rejection, (b) the rejection error names a path inside the external dir as `hooks subtree symlink <ext-path>`, and (c) the worst-case walk time scales with the external tree's contents. The threat model LIFE-03 was designed to close (read `/etc/shadow` via a symlink) is still mitigated for the eventual rejection, but the walker performs UNCONTAINED filesystem reads first. The mitigation is a one-line opt-out: use a hand-rolled non-following walk, or call `lstat`-based recursion that explicitly does not descend through symlink dirs.

Several warnings catalog quality / robustness concerns: ledger-side hooks-parse failure modes are inconsistently wrapped, the `dropped.hooks` semantics in `UnstageOutcome` diverge from sibling fields, the `orphan rewake` predicate is `=== true` strict-only against an `unknown` schema field, `process.cwd()` is used in `info.ts` even when an explicit `opts.cwd` is available, and the test fixtures in `tests/bridges/hooks/stage.test.ts` use a `{ hooks: { ... } }` shape that does not match the runtime `HOOKS_VALIDATOR` schema (the bridge writes whatever bytes it gets, so the test passes — but a future caller that round-trips through the validator would not).

Info findings cover style + doc accuracy concerns.

## Structural Findings (fallow)

None — no `<structural_findings>` block was provided in this review request.

## Critical Issues

### CR-01: `assertNoSymlinkEscapeInHooksSubtree` follows symlinks to directories before rejecting

**File:** `extensions/pi-claude-marketplace/bridges/hooks/stage.ts:55-67`
**Issue:** The symlink-escape guard relies on `readdir(hooksRoot, { recursive: true, withFileTypes: true })`. Node's recursive `readdir` follows symlinks to directories, so a symlink at `<pluginRoot>/hooks/escape -> /etc` causes the walker to enumerate the contents of `/etc` BEFORE the loop reaches the `escape` symlink entry itself and rejects.

Reproduced behavior on Node 22:
```
const ents = fs.readdirSync(hooksDir, { recursive: true, withFileTypes: true });
// emits: hooks/dirlink (isSymbolicLink=true)
// emits: hooks/dirlink/secret.txt (isSymbolicLink=false)  <-- contents of /external
```

Consequences:
1. **Filesystem reads outside pluginRoot occur before rejection** — a malicious plugin can probe attacker-chosen paths (e.g. `~/.ssh/`, `/proc/self/`) by symlinking them in. The bridge eventually throws, but the `readdir` syscall has already enumerated the target. Probe time scales linearly with the external tree size (DOS risk on large symlinked dirs).
2. **The rejection error message names an external path** as the "hooks subtree symlink". `entry.parentPath` for entries discovered inside the followed symlink points outside `pluginRoot`, producing `hooks subtree symlink /etc/shadow` or similar misleading text in the user-visible error.
3. **Non-symlink entries inside the followed target are silently skipped** (`if (!entry.isSymbolicLink()) continue`), so a secondary symlink-loop inside the external dir would not be examined defensively.

Tests at `tests/bridges/hooks/symlink-escape.test.ts` only assert that an error is thrown; they do not verify the message subject or the absence of pre-rejection filesystem activity.

**Fix:** Replace `readdir({ recursive: true })` with an explicit hand-rolled walk that calls `lstat` (not `stat`) at each entry, refuses to descend through any entry whose `lstat` reports `isSymbolicLink()`, and short-circuits the moment it sees a symbolic link. The walk should never enumerate paths outside `pluginRoot/hooks/`. Sketch:

```ts
async function assertNoSymlinkEscapeInHooksSubtree(pluginRoot: string): Promise<void> {
  const hooksRoot = path.join(pluginRoot, "hooks");
  const stack: string[] = [hooksRoot];
  while (stack.length > 0) {
    const dir = stack.pop()!;
    let entries: import("node:fs").Dirent[];
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      if (code === "ENOENT" || code === "ENOTDIR") {
        continue;
      }
      throw err;
    }
    for (const entry of entries) {
      const entryPath = path.join(dir, entry.name);
      if (entry.isSymbolicLink()) {
        const resolved = await realpath(entryPath);
        try {
          await assertPathInside(pluginRoot, resolved, `hooks subtree symlink ${entryPath}`);
        } catch (err) {
          // existing translation to SymlinkRefusedError
          ...
        }
        // Do NOT descend through symlinks even when realpath stays inside.
        continue;
      }
      if (entry.isDirectory()) {
        stack.push(entryPath);
      }
    }
  }
}
```

Add a regression test that creates `<pluginRoot>/hooks/dirlink -> <externalDir>` where `<externalDir>` contains a sentinel file, and asserts that (a) `writeHookConfig` rejects, (b) the rejection message names `<pluginRoot>/hooks/dirlink` (NOT the sentinel), and (c) `<externalDir>/sentinel` is never `stat`-ed (use a counting fs stub).

## Warnings

### WR-01: Ledger hooks-phase re-parse swallows resolver/file drift silently

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/install.ts:713-746` (also `reinstall.ts:1322-1345`, `update.ts:1313-1337`)
**Issue:** Each orchestrator's hooks phase re-reads `<pluginRoot>/<hooksConfigPath>` from disk and re-parses via `parseHooksConfig` even though the resolver already validated the same file at install-entry time. The phase throws `new Error(\`hooks.json re-parse failed: ${parsed.reason}\`)` on parse failure, which unwinds the ledger via the rollback-partial path.

There are two intertwined problems:
1. **TOCTOU window:** a plugin author who mutates `hooks.json` between resolver validation and ledger commit can flip a previously-installable plugin into a parse failure mid-install, surfacing as `(failed) {rollback partial}` instead of `(unavailable) {unsupported hooks}`. The user message blames the wrong subject.
2. **Defensive comments mislabel the contract:** the comment at install.ts:706-712 claims "the resolver already validated the file at install-entry under D-57-04" so the re-parse "is a defensive guard." But the re-parse is REQUIRED for correctness — the resolver discards `parsed.value` and `writeHookConfig` needs structured bytes to write. Framing it as "defensive" obscures that this is the SOLE source of the bytes the bridge persists.

**Fix:** Either (a) make the resolver carry the parsed `HooksConfig` value on `ResolvedPluginInstallable` so the ledger phase reads the in-memory value (eliminating the TOCTOU and the re-parse cost), or (b) tighten the error classification so a re-parse failure surfaces as `(unavailable) {unsupported hooks}` via `narrowResolverNotes` rather than `(failed) {rollback partial}` — `narrowResolverNotes` already understands the `hooks.json` failure prefix. Option (a) is structurally cleaner; option (b) is the smaller change.

### WR-02: `UnstageOutcome.dropped.hooks` is misleadingly always-populated

**File:** `extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts:298-307, 376-377`
**Issue:** `cascadeUnstagePlugin` UNCONDITIONALLY calls `removeHookConfig` for every plugin and records `dropped.hooks = [hooksResult.removed]`. Because `removeHookConfig` is idempotent (rm -rf with `force: true`) and always returns `{ removed: pluginName }`, `dropped.hooks` is ALWAYS `[plugin]` even for plugins that never staged a single hook.

This diverges from every other field on `UnstageOutcome.dropped`:
- `dropped.skills` / `dropped.commands` / `dropped.agents` / `dropped.mcpServers` are populated from the bridges' `removedNames` arrays and ARE empty when nothing was staged.
- `dropped.hooks` carries the plugin NAME (not a hook NAME), conflating "this plugin was processed" with "these resources were removed."

The cascade test at `tests/orchestrators/marketplace/cascade.test.ts:200` codifies this divergence as intentional. Downstream consumers reading `dropped.hooks.length > 0` to gate logic (e.g. "did anything actually get removed?") will misclassify every plugin as having hooks.

**Fix:** Only populate `dropped.hooks` when the plugin's installed record declared hooks (`installedPlugin.resources.hooks.length > 0`), or when the on-disk subtree existed before removal. The cleanest path: have `removeHookConfig` return `{ removed: pluginName, existed: boolean }` and let the cascade populate `dropped.hooks` conditionally on `existed`. This restores semantic parity with the other `dropped.*` fields.

### WR-03: `detectOrphanRewake` strict-equality check against `unknown` schema field

**File:** `extensions/pi-claude-marketplace/domain/resolver.ts:721-736`
**Issue:** The orphan-rewake predicate is:
```ts
const hasRewakeField =
  handler.rewakeMessage !== undefined || handler.rewakeSummary !== undefined;
const asyncRewakeTrue = handler.asyncRewake === true;
```

`asyncRewake` is admitted at the schema layer with `Type.Unknown` per HOOK-06 (`HOOK_HANDLER_SCHEMA` allows any value: empty-object JSON Schema). A plugin author who wrote `"asyncRewake": "true"` (string) or `"asyncRewake": 1` (truthy number) intended to enable async-rewake; the strict `=== true` check rejects this and produces a misleading `(installed) {orphan rewake}` row. The same handler at runtime in `bridges/hooks/async-rewake/registry.ts` may apply its own narrowing — but if THAT narrowing also requires `=== true`, the handler's `rewakeMessage` will never fire and the warning is structurally correct. If the runtime narrowing is looser (e.g. `Boolean(asyncRewake)`), the warning is a false positive.

Same applies to `rewakeMessage !== undefined`: a `null` rewakeMessage counts as "has rewake field" and triggers the warning, but `null` at runtime is functionally the same as absent.

**Fix:** Either tighten the schema (force `asyncRewake: boolean`, reject non-booleans at install-entry) so the strict equality is justified, OR loosen the predicate (`asyncRewakeTrue = handler.asyncRewake === true || handler.asyncRewake === "true"` and `hasRewakeField = ...!== undefined && handler.rewakeMessage !== null && ...`) so the warning fires only when the runtime would actually treat the field as orphan. Document the chosen contract alongside the registry's narrowing rules so the two stay in lockstep.

### WR-04: `info.ts` and `resolver.ts` use `process.cwd()` instead of the orchestrator's `cwd`

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/info.ts:260` and `extensions/pi-claude-marketplace/domain/resolver.ts:697`
**Issue:** Both construct the `ifCtx` for `parseHooksConfig` using `cwd: process.cwd()` + `projectRoot: process.cwd()`. In `info.ts`, `GetPluginInfoOptions.cwd` is in scope and the `loadMergedScopeConfig(locations)` / `loadState(locations.extensionRoot)` calls already thread it correctly — but the hooks parse silently falls back to the process-global cwd.

Today this is mitigated by `skipIfMap: true`, which discards the `ifCtx` entirely. So the divergence is unobservable on the info path. But:
1. The pattern is a hazard: if a future caller drops `skipIfMap: true` or adds a new code path that consumes `ifPredicates`, the `info`-surface output will start resolving `~/`-prefixed if-globs against the test-runner's cwd instead of the user's project cwd.
2. The resolver's comment at line 686-696 acknowledges the same fallback for the same reason. Both call sites should explicitly comment WHY they pick `process.cwd()` and what the failure mode would be if `skipIfMap` were dropped — or thread the real cwd through.

**Fix:** In `info.ts`, replace `process.cwd()` with `opts.cwd` (available in the enclosing `getPluginInfo`); pass `opts.cwd` down through `readHookSummaryEntries`. In `resolver.ts`, accept an optional `cwd` on `ResolveContext` so callers that have it (every orchestrator does) can supply it. Even with `skipIfMap: true`, the values then describe the user-facing truth and the pattern is safe to extend.

### WR-05: Hooks bridge stage tests use a hooks.json shape that does not validate

**File:** `tests/bridges/hooks/stage.test.ts:37-41` (and `symlink-escape.test.ts:38`, `lifecycle-cascade.test.ts` fixture)
**Issue:** The `HOOKS_VALUE` test fixture is:
```ts
const HOOKS_VALUE = {
  hooks: {
    PreToolUse: [{ matcher: "Bash", hooks: [...] }],
  },
};
```

The runtime schema (`HOOKS_CONFIG_SCHEMA = Type.Record(Type.String(), HOOK_EVENT_ARRAY_SCHEMA)`) expects event keys at the TOP level, not nested under a `hooks` key:
```ts
// SCHEMA-VALID shape:
{ PreToolUse: [{ matcher: "Bash", hooks: [...] }] }
```

The bridge tests pass because `writeHookConfig` does not validate — it just JSON-serializes whatever value is passed and writes it. The orchestrator-level `install.ts` re-parses via `parseHooksConfig` and would reject the fixture shape with a schema-validation failure, but the bridge tests never exercise that path.

The discrepancy means:
1. The bridge tests do not actually exercise the bytes a production plugin would ship; they exercise an arbitrary JSON object.
2. A future developer copy-pasting the fixture into a new test that DOES round-trip through `parseHooksConfig` will be confused when the parse fails.
3. The `cascade.test.ts:166` and `lifecycle-cascade.test.ts:90` fixtures use the CORRECT top-level-keys shape, so the two test families have diverged.

**Fix:** Update `HOOKS_VALUE` in the bridge tests to the schema-valid shape (drop the outer `hooks:` wrapper):
```ts
const HOOKS_VALUE = {
  PreToolUse: [{ matcher: "Bash", hooks: [{ type: "command", command: "echo hi" }] }],
};
```

This preserves the test intent (write/remove a representative hooks.json) while ensuring the test bytes are actually parseable by the runtime validator. Apply the same fix to `symlink-escape.test.ts`.

## Info

### IN-01: `noopCompileIf` declared inline in two call sites instead of shared

**File:** `extensions/pi-claude-marketplace/domain/resolver.ts:698` and `extensions/pi-claude-marketplace/orchestrators/plugin/info.ts:261`
**Issue:** Both files declare `const noopCompileIf = (): null => null;` and pass it with `{ skipIfMap: true }`. The literal is small, but the pattern is duplicated and the type `() => null` only happens to satisfy the generic `CompileIfCallback<P>` because `P` infers to `null`. A shared `NOOP_COMPILE_IF` exported from `domain/components/hooks.ts` (next to `parseHooksConfig`) would document the supported "I don't care about the if-map" pattern and prevent drift.

**Fix:** Add `export const NOOP_COMPILE_IF: CompileIfCallback<null> = () => null;` (or similar) in `domain/components/hooks.ts` and import at the two consumer sites.

### IN-02: `docs/hooks.md` "Currently unmapped Claude tools" semantics overstate v1.13 behavior

**File:** `docs/hooks.md:230`
**Issue:** The paragraph reads:
> A matcher value naming one of these tools cannot be translated because there is no Pi-side analog; the plugin will install with `(unavailable) {unsupported hooks}` unless the matcher also matches a tool name that does have a mapping (for example, `Edit|Write|MultiEdit` would still install if the bridge accepts at least one of the alternatives -- but the unmapped alternative will never fire).

The hedge "if the bridge accepts at least one of the alternatives" implies a partial-pipe-OR behavior that the project's strict-supportability stance (D-58-06) explicitly forbids. Per `hook-events.ts` and `checkMatcherSupportability`, any unmappable token in a pipe-OR alternation trips TOOL-02 and flips the plugin to `(unavailable) {unsupported hooks}`. The doc paragraph should either be deleted ("unmapped tools cause `(unavailable)`, period") or rewritten to state that `Edit|Write|MultiEdit` ALSO trips because one alternative is unmapped.

**Fix:** Replace the qualifier with: "A matcher value containing any unmapped tool name -- even as one alternative in a pipe-OR list like `Edit|Write|MultiEdit` -- causes the plugin to install with `(unavailable) {unsupported hooks}`. The bridge does not partially honor mappable alternatives; the entire plugin is held back until the gap closes."

### IN-03: `docs/hooks.md` "Permanently inapplicable" vs the "Currently unmapped" claim conflict on stability

**File:** `docs/hooks.md:207-214` (Permanently inapplicable section)
**Issue:** The "Permanently inapplicable to Pi" section says "These last five events stay unsupported regardless of future upstream work" — but the section actually lists FOUR groups (`ConfigChange`, `Setup`, `InstructionsLoaded`, `TaskCreated`/`TaskCompleted`). Counting `TaskCreated and TaskCompleted` as one entry gives four; counting them as two gives five. The "five" count appears to include the implicit pair-split.

Minor ambiguity but the wording could mislead a reader counting entries.

**Fix:** Replace "These last five events" with "These four event groups" (or list TaskCreated and TaskCompleted on separate lines and keep the "five" count). Clarify so a casual reader's mental model matches the list.

---

_Reviewed: 2026-06-16_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
