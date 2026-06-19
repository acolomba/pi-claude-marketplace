---
quick: 260618-qkz-show-components-on-unavailable-info-rows
plan: 01
type: execute
wave: 1
status: complete
requirements: [INFO-05]
files_modified:
  - extensions/pi-claude-marketplace/orchestrators/plugin/info.ts
  - tests/orchestrators/plugin/info.test.ts
commits:
  - 8a7c278: "fix(plugin/info): enumerate components on path-source not-installable rows"
completed_date: 2026-06-18
---

# Quick Task 260618-qkz: Show components on (unavailable) info rows — Summary

## One-liner

Path-source plugins whose resolver returns the not-installable variant (e.g. unsupported hooks) now enumerate on-disk skills / commands / agents / mcp in the info row instead of rendering `components: not resolved`.

## What changed

### `extensions/pi-claude-marketplace/orchestrators/plugin/info.ts`

- Added `derivePluginRootForInfo(marketplaceRoot, source)`: re-derives `pluginRoot` for a `PathSource` via `path.resolve(marketplaceRoot, source.raw)`, mirroring `preflightStages`. NFR-7 keeps `pluginRoot` off the not-installable variant; the helper re-derives it from inputs that are NOT gated by `installable`, preserving the discriminated-union invariant.
- Added `buildNotInstallablePathRowFields(resolved, marketplaceRoot, parsedSource)`: composes the `componentsResolved` arm + reasons for a path-source not-installable verdict. Calls `composeResolvedComponents` against the not-installable variant (which carries symmetric `componentPaths` / `mcpServers` / `hooksConfigPath`). On discovery throw, falls back to `componentsResolved: false` with `narrowProbeError(err)` appended to `narrowResolverNotes(resolved.notes)`.
- `buildBlock` now threads `parsedSource` into both `buildInstalledRow` and `buildNotInstalledRow` (replacing the prior `resolvable: boolean` parameter on `buildInstalledRow`).
- `buildInstalledRow` `!resolved.installable` branch: routes through `buildNotInstallablePathRowFields` for path sources; non-path sources still emit `componentsResolved: false` with no per-kind enumeration.
- `buildNotInstalledRow` `!resolved.installable` branch: same treatment. The `catch (err)` arm (resolver THREW, no `resolved` value) is unchanged.
- Updated the file header comment to document the new behavior: the INFO-05 gate excludes non-path SOURCES, not the not-installable verdict.

### `tests/orchestrators/plugin/info.test.ts`

Four new tests + three updated tests:

- **NEW Test A** (`INFO-05: (unavailable) {unsupported hooks} path-source plugin enumerates on-disk skills + commands`): malformed hooks.json + skills/s1/ + commands/c1.md on disk → row renders `(unavailable) {unsupported hooks}` followed by `commands: c1` + `skills: s1`. No `hooks:` line (resolver bailed before recording `hooksConfigPath`); no `components: not resolved` marker.
- **NEW Test B** (`INFO-05: (installed) {unsupported hooks} path-source plugin enumerates on-disk skills + commands`): same as A but plugin is installed → row renders `(installed) {unsupported hooks}` + per-kind component lines.
- **NEW Test C** (`INFO-05: not-installed npm-source plugin still emits 'components: not resolved' (non-path gate preserved)`): npm-source, NOT installed → row renders `(unavailable) {unsupported source}` + `components: not resolved`. Anti-regression for the INFO-05 source-kind gate.
- **NEW Test D** (`INFO-05: composeResolvedComponents throw on the unavailable arm falls back to 'componentsResolved: false' with merged reasons (POSIX)`): malformed hooks + chmod 000 on the skills dir → row renders `(unavailable) {unsupported hooks, permission denied}` + `components: not resolved`. POSIX-only via `t.skip("win32")`.
- **UPDATED** `INFO-02: single-scope unavailable (malformed hooks/hooks.json) ...`: expected message body no longer contains `components: not resolved` (path source, no components on disk → no per-kind lines and no marker).
- **UPDATED** `WR-01: installed plugin with malformed hooks/hooks.json surfaces '{unsupported hooks}' on the (installed) row`: same — no `components: not resolved` line.
- **UPDATED** `SURF-01 / D-63-04: unavailable plugin (malformed hooks/hooks.json) ...`: asserts `components: not resolved` is suppressed for the path-source unavailable row, replacing the prior `assert.match(msg, /components: not resolved/)` assertion. The `hooks:` suppression assertion is unchanged.

## Behavior delta

| Scenario                                                                         | Before                                                  | After                                                              |
| -------------------------------------------------------------------------------- | ------------------------------------------------------- | ------------------------------------------------------------------ |
| Path-source plugin, `(unavailable) {unsupported hooks}`, components on disk      | `components: not resolved`                              | per-kind component lines                                           |
| Path-source plugin, `(installed) {unsupported hooks}`, components on disk        | `components: not resolved`                              | per-kind component lines                                           |
| Path-source plugin, `(unavailable)`, NO components on disk                       | `components: not resolved`                              | row terminates after description (or row itself) — no marker, no lines |
| Non-path source (npm/github/url/git-subdir), `(unavailable) {unsupported source}` | `components: not resolved`                              | `components: not resolved` (unchanged — INFO-05 source-kind gate)  |
| Path-source plugin, `composeResolvedComponents` throws (EACCES on skills dir)    | `(unavailable) {unsupported hooks}` + `components: not resolved` (broken) | `(unavailable) {unsupported hooks, permission denied}` + `components: not resolved` (merged reasons) |
| `buildNotInstalledRow` `catch (err)` arm (resolver THREW)                        | `(unavailable) {<probe-reason>}` + `components: not resolved` | unchanged                                                          |

## Deviations from Plan

None. The plan was followed exactly:

1. Added the `derivePluginRootForInfo` helper inside `info.ts` (no new exports, no resolver extraction).
2. Routed both not-installable arms through a single shared `buildNotInstallablePathRowFields` helper to keep cognitive complexity within the lint budget (sonarjs/cognitive-complexity limit is 15; without the extraction both `buildInstalledRow` and `buildNotInstalledRow` measured 16). The helper preserves the plan's stated behavior contract — gate on `parsedSource.kind === "path"`, try/catch around `composeResolvedComponents`, fall back to `componentsResolved: false` + `narrowProbeError` on throw with `narrowResolverNotes(resolved.notes)` reasons merged in.
3. INFO-05 comment block in the file header updated to reflect the new behavior (the gate excludes non-path sources, not the not-installable verdict).
4. NFR-10 rationale recorded in the `derivePluginRootForInfo` doc comment (no second `assertPathInside` at the info surface — the resolver's `sourceEscapeReason` already accepted these paths before either variant was returned, and the info surface is read-only).
5. Only INFO-05 (+ existing NFR-7 / NFR-10) anchors used in new comments. No phase / plan / wave / pitfall / milestone references.
6. Surgical edits only. `parsePluginSource`, `domain/resolver.ts`, `composeResolvedComponents`'s signature, and `shared/notify.ts` are unchanged. `buildAvailableRow` and the `buildNotInstalledRow` outer catch arm are unchanged.

## Verification

### Automated

- `npx tsx --test tests/orchestrators/plugin/info.test.ts`: **38 / 38 pass** (was 34; added 4).
- `pre-commit run --files extensions/pi-claude-marketplace/orchestrators/plugin/info.ts tests/orchestrators/plugin/info.test.ts`: all hooks pass (trim trailing whitespace, fix end of files, prettier, npm lint, npm format check, npm typecheck, trufflehog, ...).
- `npm run check` full suite: 2313 / 2315 pass, 1 skipped, 1 failure. The single failure is `tests/docs/hooks-doc.test.ts: "docs/hooks.md ships all 6 worked-example sections"` and is caused entirely by pre-existing uncommitted changes to `docs/hooks.md` (the worktree had `M docs/hooks.md` from prior unrelated work before this dispatch started). Reproduced on the baseline by stashing only my two changed files — the same test fails identically with `docs/hooks.md` modified and `info.ts` / `info.test.ts` reverted. Explicitly out of scope per the dispatch constraints ("Pre-existing uncommitted changes in README.md and docs/hooks.md are NOT part of this task — do NOT stage them; leave them in the working tree") and Rule 3 SCOPE BOUNDARY ("Only auto-fix issues DIRECTLY caused by the current task's changes").

### Must-haves coverage

All six `must_haves.truths` from the plan are observable in the test suite:

1. **`(unavailable) {unsupported hooks}` row on a path-source plugin enumerates skills / commands / agents / mcp from disk** — Test A.
2. **`(installed) {<reason>}` row that hit the resolver's not-installable fallback enumerates components from disk** — Test B (+ the updated WR-01 test).
3. **`(unavailable)` row on a non-path source still emits `componentsResolved: false` — no regression of the INFO-05 source-kind gate** — Test C (+ the existing INFO-05 npm-installed test at line ~374, unchanged).
4. **Hook summary entries (`hooks:` block) appear on the not-installable arm only when `resolved.hooksConfigPath` is set** — code path: `composeResolvedComponents` already gates `hooks` on `resolved.hooksConfigPath === undefined`. Test A demonstrates the absent case (parse-failure path → no `hooks:` line).
5. **Component-discovery I/O failures on the not-installable arm fall back to the existing `componentsResolved: false` + classified-reason path — no silent rendering as `no components`** — Test D.
6. **The catch-arm in `buildNotInstalledRow` (resolver THREW, no `resolved` value) is unchanged** — code: unchanged. Existing WR-02 test (line ~745) and `narrowProbeError` ladder tests (lines ~631-682) cover this path and still pass.

## Self-Check: PASSED

- `extensions/pi-claude-marketplace/orchestrators/plugin/info.ts` — modified, present in commit `8a7c278`.
- `tests/orchestrators/plugin/info.test.ts` — modified, present in commit `8a7c278`.
- Commit `8a7c278` exists on `features/v1.13-hook-bridge`: confirmed via `git log --oneline -3`.
