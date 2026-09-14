---
phase: 260612-liv
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - extensions/pi-claude-marketplace/orchestrators/plugin/shared.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/update.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts
  - README.md
autonomous: true
requirements: []
must_haves:
  truths:
    - "SonarCloud CPD set #1 (update.ts:1101-1138 vs reinstall.ts:1134-1167, the post-success config write-back gate) is single-sourced."
    - "SonarCloud CPD set #2 (enable-disable.ts:313-327 vs uninstall.ts:252-266, the TR-03 partial-cascade dropped-fold) is single-sourced."
    - "Every rendered byte string is unchanged: catalog-uat and notify-v2 stay GREEN with NO docs/output-catalog.md edits."
    - "The two README user-scope config-path cells read `~/.pi/agent/claude-plugins.json` and `~/.pi/agent/claude-plugins.local.json`."
    - "The operator's uncommitted README wording edits (Local configuration files heading, colon -> period changes) are preserved in the same commit."
    - "Two atomic Conventional Commits land (refactor(cpd): ... and docs(readme): ...), pre-commit hooks GREEN each time, no --no-verify."
  artifacts:
    - path: "extensions/pi-claude-marketplace/orchestrators/plugin/shared.ts"
      provides: "Both new shared helpers and their rationale comments"
      contains: "maybeWritePluginConfigBack"
    - path: "extensions/pi-claude-marketplace/orchestrators/plugin/update.ts"
      provides: "Call sites delegate to shared.ts; no in-file duplicate"
    - path: "extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts"
      provides: "Call sites delegate to shared.ts; no in-file duplicate"
    - path: "extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts"
      provides: "Call sites delegate to shared.ts; no in-file duplicate"
    - path: "extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts"
      provides: "Call sites delegate to shared.ts; no in-file duplicate"
    - path: "README.md"
      provides: "Correct user-scope config paths under the agent dir"
      contains: "~/.pi/agent/claude-plugins.json"
  key_links:
    - from: "update.ts / reinstall.ts post-success gate"
      to: "shared.ts::maybeWritePluginConfigBack"
      via: "imported helper call"
      pattern: "maybeWritePluginConfigBack\\("
    - from: "enable-disable.ts / uninstall.ts cascade fold"
      to: "shared.ts::applyPartialCascadeFold"
      via: "imported helper call"
      pattern: "applyPartialCascadeFold\\("
---

<objective>
Resolve the two SonarCloud CPD duplication sets surfaced on PR #51 by folding
each pair into a single shared helper in `orchestrators/plugin/shared.ts`, and
fix the README user-scope config-path cells (`~/.pi/claude-plugins.json` ->
`~/.pi/agent/claude-plugins.json`, ditto `.local.json`) on top of the
operator's uncommitted heading/punctuation edits.

Purpose: Close the CPD findings (precedent: 7fa0a2c, 17a0e97) without
changing any rendered byte. Correct the documented user-scope paths to match
the actual `locations.ts::locationsFor` behavior (`getAgentDir()` default
`~/.pi/agent/`, honors `PI_CODING_AGENT_DIR`).

Output: One refactor commit (single-sourced helpers, four call sites
delegated, byte-neutral) and one docs commit (README path fix bundled with
the operator's uncommitted wording edits).
</objective>

<execution_context>
@$HOME/.claude/gsd-core/workflows/execute-plan.md
</execution_context>

<context>
@.planning/STATE.md
@./CLAUDE.md
@.claude/rules/typescript-comments.md
@extensions/pi-claude-marketplace/orchestrators/plugin/shared.ts
@extensions/pi-claude-marketplace/orchestrators/plugin/update.ts
@extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts
@extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts
@extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts
@extensions/pi-claude-marketplace/persistence/locations.ts
@README.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Fold both CPD duplication sets into shared.ts (byte-neutral)</name>
  <files>
    extensions/pi-claude-marketplace/orchestrators/plugin/shared.ts,
    extensions/pi-claude-marketplace/orchestrators/plugin/update.ts,
    extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts,
    extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts,
    extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts
  </files>
  <action>
    Refactor BOTH SonarCloud CPD sets into shared helpers in
    `orchestrators/plugin/shared.ts` (which already imports `loadConfig`,
    `ScopeConfig`, `ScopedLocations`, and `writePluginConfigEntry`'s sibling
    types — confirmed natural home, and is already imported by all four
    call-site files). Make NO change to rendered bytes; the catalog-uat and
    notify-v2 byte gates must stay GREEN, and `docs/output-catalog.md` is
    NOT edited.

    Helper A — config write-back gate (CPD set #1):
    Add `export async function maybeWritePluginConfigBack(opts: { readonly
    locations: ScopedLocations; readonly marketplace: string; readonly
    plugin: string; readonly local: boolean }): Promise<{ readonly
    invalidConfig: boolean }>` to `shared.ts`. Body is the unified version
    of the two existing implementations (update.ts:1094-1138 and
    reinstall.ts:1125-1167): pick `local ? configLocalJsonPath :
    configJsonPath`, `await loadConfig(targetConfigPath)`, return `{
    invalidConfig: true }` on `cfg.status === "invalid"`, build `current`
    from valid|absent fallback `{ schemaVersion: 1 }`, build `key =
    \`${plugin}@${marketplace}\``, if `current.plugins?.[key] !== undefined`
    return `{ invalidConfig: false }` (preserves RECON-05 mtime stability),
    else `await writePluginConfigEntry(current, targetConfigPath,
    locations.scopeRoot, plugin, marketplace, {})` and return `{
    invalidConfig: false }`.

    Move the load-bearing comments ONTO the helper (not the call sites):
    keep the S5 invalid-config rationale (the caller surfaces the abort via
    a warning row — state mutation already committed; CFG-03 aborts at
    preflight render `{invalid manifest}` while this post-success path's
    skip would lie), and keep the RECON-05 mtime-stability rationale on the
    `existingEntry !== undefined` short-circuit (the patched shape is
    `{...existing, ...{}}` so the byte-stable no-op MUST skip the write).
    Drop the duplicate rationale prose at the call sites. Comments MUST
    follow `.claude/rules/typescript-comments.md` — keep decision/requirement
    IDs (`WB-01`, `RECON-05`, `S5`, `CFG-03`, `D-04`) but strip any
    phase/plan/wave/milestone tokens. The reinstall variant's `_state:
    ExtensionState` parameter (currently unused, prefixed `_`) is dropped
    in the unified signature.

    Replace call sites:
    - `update.ts:1072-1081`: replace the call to
      `maybeWritePluginConfigBackUpdate(locations, marketplace, plugin,
      args.local === true)` with
      `maybeWritePluginConfigBack({ locations, marketplace, plugin, local:
      args.local === true })` and delete the local
      `maybeWritePluginConfigBackUpdate` function (lines 1086-1138 incl.
      its docstring).
    - `reinstall.ts:1078-1085`: replace the call to
      `maybeWritePluginConfigBack(state, locations, marketplace, plugin,
      { local: args.local })` with the shared form `maybeWritePluginConfigBack({
      locations, marketplace, plugin, local: args.local === true })` and
      delete the local `maybeWritePluginConfigBack` function (lines
      1106-1167 incl. its docstring).
    - Add `import { maybeWritePluginConfigBack } from "./shared.ts";` to
      both files' shared.ts import block (already present — extend the
      named-import list).
    - In `shared.ts`, add the `writePluginConfigEntry` import from
      `../../persistence/config-write-back.ts` (NEW import for this file)
      and re-export nothing new (helper is `export`ed directly).

    Helper B — partial-cascade dropped-fold (CPD set #2):
    Add `export function applyPartialCascadeFold(installed: { resources: {
    skills: string[]; prompts: string[]; agents: string[]; mcpServers:
    string[] } }, dropped: { readonly skills: readonly string[]; readonly
    commands: readonly string[]; readonly agents: readonly string[];
    readonly mcpServers: readonly string[] }): void` to `shared.ts`. Body
    is the unified filter form from
    `uninstall.ts::applyPartialCascadeFold` (lines 243-266) /
    `enable-disable.ts::applyPartialDisableCascadeFold` (lines 306-327):
    four in-place `filter(n => !dropped.X.includes(n))` assignments,
    asymmetric `dropped.commands -> resources.prompts` mapping per TR-03
    cascade-primitive naming.

    Move the load-bearing TR-03 rationale comment onto the helper. Verify
    the parameter type `installed: { resources: ... }` is structurally
    compatible with BOTH call sites — `uninstall.ts` already uses the
    inline structural shape, and `enable-disable.ts` calls the helper with
    `installed: InstalledPluginRecord` (a state-record alias whose
    `resources.*` arrays match). If TypeScript flags a readonly/mutable
    mismatch on the arrays, accept the structural shape on the helper as
    mutable `string[]` (matches both today). Comments stripped per
    typescript-comments policy.

    Replace call sites:
    - `uninstall.ts:469`: keep the call shape
      `applyPartialCascadeFold(installed, localOutcome.dropped)` but route
      to the shared import; delete the local
      `applyPartialCascadeFold` function (lines 236-266 incl. its
      docstring).
    - `enable-disable.ts:278`: rename the call from
      `applyPartialDisableCascadeFold(installed, cascade.dropped)` to
      `applyPartialCascadeFold(installed, cascade.dropped)`; delete the
      local `applyPartialDisableCascadeFold` function (lines 301-327 incl.
      its docstring); update the prose comment at line 276 (`Mirrors the
      uninstall.ts:applyPartialCascadeFold TR-03 path; ...`) to point at
      the shared helper, e.g. `Uses the shared
      applyPartialCascadeFold helper (TR-03 path); ...`.
    - Add `applyPartialCascadeFold` to the shared.ts named-import list in
      both `uninstall.ts` and `enable-disable.ts`.

    Test pins: Any tests added today (e.g. CR-followups for PR #51) may pin
    source shapes (function names, file locations) in these orchestrators
    via grep/architecture-test patterns. After moving, run `npm run check`
    once and if any pin breaks because the symbol moved to shared.ts, fix
    the pin to point at shared.ts in the SAME commit. Do not relax the
    pin; relocate it. Look in `tests/architecture/`, `tests/shared/`, and
    any `tests/orchestrators/plugin/*` files for hard-coded references to
    `maybeWritePluginConfigBack`, `maybeWritePluginConfigBackUpdate`,
    `applyPartialCascadeFold`, or `applyPartialDisableCascadeFold` —
    re-anchor each to its new home.

    Commit AFTER all gates pass. Pre-commit:
    `pre-commit run --files <changed files>` (and outside `git commit`,
    a one-shot `pre-commit run trufflehog --all-files` if working in a
    worktree). Commit message:

      refactor(cpd): fold PR #51 plugin write-back + cascade-fold sets

      Body (≤80 char lines) names the two helpers, the four call-site files,
      and explicitly states "byte-neutral on rendered output (catalog-uat
      GREEN, no docs/output-catalog.md edits)".

    From a worktree, prefix `SKIP=trufflehog` per CLAUDE.md. Never
    `--no-verify`.
  </action>
  <verify>
    <automated>
      bash -c '
        set -e
        cd /home/acolomba/pi-claude-marketplace
        npm run check
        # Confirm the four duplicate ranges are gone (each pattern survives ONLY in shared.ts).
        test "$(grep -rln "maybeWritePluginConfigBackUpdate" extensions/ | wc -l)" -eq 0
        test "$(grep -rln "applyPartialDisableCascadeFold" extensions/ | wc -l)" -eq 0
        test "$(grep -l "^async function maybeWritePluginConfigBack" extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts | wc -l)" -eq 0
        test "$(grep -l "^function applyPartialCascadeFold" extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts | wc -l)" -eq 0
        # Both unified helpers live in shared.ts.
        grep -q "export async function maybeWritePluginConfigBack" extensions/pi-claude-marketplace/orchestrators/plugin/shared.ts
        grep -q "export function applyPartialCascadeFold" extensions/pi-claude-marketplace/orchestrators/plugin/shared.ts
      '
    </automated>
  </verify>
  <done>
    Both CPD sets are single-sourced in `shared.ts` with load-bearing
    rationale comments on the helpers (not duplicated at call sites). All
    four orchestrator call sites delegate via named import. No
    `maybeWritePluginConfigBackUpdate` or `applyPartialDisableCascadeFold`
    symbol survives anywhere under `extensions/`. `npm run check` is
    GREEN (typecheck + ESLint + Prettier + tests, including catalog-uat
    byte-equality and notify-v2 byte gates). `docs/output-catalog.md` is
    unedited. The refactor commit is recorded with a Conventional Commit
    title `refactor(cpd): ...` (≤72 chars), body lines ≤80 chars, all
    pre-commit hooks GREEN, no `--no-verify`.
  </done>
</task>

<task type="auto">
  <name>Task 2: Fix README user-scope config paths on top of operator's uncommitted edits</name>
  <files>README.md</files>
  <action>
    The working tree carries the OPERATOR'S uncommitted edits to README.md
    (heading rename to "Local configuration files", colon -> period
    changes). DO NOT revert or re-stage around them. Use `git status` and
    `git diff README.md` FIRST to enumerate the operator's untracked
    edits, and preserve them verbatim. The final commit MUST include both
    the path corrections AND the operator's edits in one atomic commit.

    Edits to apply (in addition to preserving the operator's wording):
    - Line 136 (or wherever the base-config table's `user` row sits in the
      current working tree): change `~/.pi/claude-plugins.json` to
      `~/.pi/agent/claude-plugins.json`.
    - Line 147 (or wherever the local-config table's `user` row sits in
      the current working tree): change `~/.pi/claude-plugins.local.json`
      to `~/.pi/agent/claude-plugins.local.json`.

    Rationale (do NOT add to the README — the README's existing prose is
    correct after the path fix; this is a path-cell-only correction):
    `locations.ts::locationsFor` derives the user scope root from
    `getAgentDir()`, which defaults to `~/.pi/agent/` and honors
    `PI_CODING_AGENT_DIR`. The two project-scope cells
    (`<cwd>/.pi/claude-plugins.json` and
    `<cwd>/.pi/claude-plugins.local.json`) are CORRECT — do not touch
    them. The `.gitignore` example block at line 165-166 also does NOT
    change (it is a project-scope hint).

    Pre-commit before commit:
    `pre-commit run --files README.md` (and the one-shot
    `pre-commit run trufflehog --all-files` outside `git commit` if in a
    worktree). Commit only `README.md`. Commit message:

      docs(readme): correct user-scope config file paths

      Body (≤80 char lines) notes the user-scope root is
      `~/.pi/agent/` (locations.ts::locationsFor honors
      PI_CODING_AGENT_DIR) and explicitly mentions the commit also
      carries the local-config heading + punctuation edits already in the
      working tree.

    From a worktree, prefix `SKIP=trufflehog` per CLAUDE.md. Never
    `--no-verify`.
  </action>
  <verify>
    <automated>
      bash -c '
        set -e
        cd /home/acolomba/pi-claude-marketplace
        npm run check
        # The two user-scope cells now reference the agent dir.
        grep -F "~/.pi/agent/claude-plugins.json" README.md
        grep -F "~/.pi/agent/claude-plugins.local.json" README.md
        # The two stale paths are gone from the user-scope cells. Project-scope
        # cells (`<cwd>/.pi/...`) and the .gitignore example (`.pi/...`) are
        # unaffected because they do not contain `~/.pi/claude-plugins`.
        ! grep -F "~/.pi/claude-plugins.json" README.md
        ! grep -F "~/.pi/claude-plugins.local.json" README.md
      '
    </automated>
  </verify>
  <done>
    Both README user-scope path cells read the agent-dir form. Operator's
    uncommitted wording edits (Local configuration files heading +
    colon→period changes) are preserved verbatim in the same commit. No
    other README region changed (project-scope cells and `.gitignore`
    example untouched). `npm run check` GREEN. The docs commit is
    recorded with a Conventional Commit title `docs(readme): ...` (≤72
    chars), body lines ≤80 chars, all pre-commit hooks GREEN, no
    `--no-verify`.
  </done>
</task>

</tasks>

<verification>
- `npm run check` GREEN after each task (typecheck + ESLint + Prettier +
  tests, including catalog-uat byte-equality and notify-v2 byte gates).
- After Task 1: zero matches for `maybeWritePluginConfigBackUpdate` and
  `applyPartialDisableCascadeFold` anywhere under `extensions/`; the two
  unified helpers exported from `shared.ts`; `docs/output-catalog.md`
  unedited (`git diff docs/output-catalog.md` empty).
- After Task 2: the two `~/.pi/agent/claude-plugins{,.local}.json` strings
  present in README.md; the two stale `~/.pi/claude-plugins{,.local}.json`
  strings absent from README.md.
- Two atomic commits recorded:
    refactor(cpd): fold PR #51 plugin write-back + cascade-fold sets
    docs(readme): correct user-scope config file paths
  Pre-commit hooks GREEN at each commit, no `--no-verify` anywhere,
  `SKIP=trufflehog` only if committing from a worktree per CLAUDE.md.
</verification>

<success_criteria>
- SonarCloud CPD set #1 (post-success config write-back gate) single-sourced
  in `orchestrators/plugin/shared.ts::maybeWritePluginConfigBack`; both
  call sites delegate.
- SonarCloud CPD set #2 (TR-03 partial-cascade dropped-fold) single-sourced
  in `orchestrators/plugin/shared.ts::applyPartialCascadeFold`; both call
  sites delegate.
- Rendered output bytes unchanged (catalog-uat + notify-v2 GREEN; no
  `docs/output-catalog.md` edits).
- README user-scope config-path cells correct
  (`~/.pi/agent/claude-plugins.json` and
  `~/.pi/agent/claude-plugins.local.json`).
- Operator's uncommitted README wording edits preserved in the docs
  commit.
- Two Conventional Commits land cleanly with pre-commit GREEN; no
  `--no-verify`.
</success_criteria>

<output>
Create `.planning/quick/260612-liv-fold-pr-51-cpd-duplication-sets-and-fix-/260612-liv-SUMMARY.md` when done.
</output>
