---
phase: 260618-qkz-show-components-on-unavailable-info-rows
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - extensions/pi-claude-marketplace/orchestrators/plugin/info.ts
  - tests/orchestrators/plugin/info.test.ts
autonomous: true
requirements: [INFO-05]
must_haves:
  truths:
    - "`(unavailable) {unsupported hooks}` row on a path-source plugin enumerates skills / commands / agents / mcp from disk instead of rendering `components: not resolved`."
    - "`(installed) {<reason>}` row that hit the resolver's not-installable fallback (e.g. unsupported hooks, persistence-vs-disk disagreement) enumerates components from disk instead of rendering `components: not resolved`."
    - "`(unavailable)` row on a non-path source (github / npm / url / git-subdir / unknown) still emits `componentsResolved: false` -- no regression of the INFO-05 source-kind gate."
    - "Hook summary entries (`hooks:` block) appear on the not-installable arm only when `resolved.hooksConfigPath` is set (resolver succeeded at parsing hooks.json); a hooks-parse failure leaves the hooks bucket absent and the row still renders the other component buckets."
    - "Component-discovery I/O failures (EACCES on skills / commands / agents) on the not-installable arm fall back to the existing `componentsResolved: false` + classified-reason path -- no silent rendering as `no components`."
    - "The catch-arm in `buildNotInstalledRow` (resolver THREW, no `resolved` value) is unchanged and continues to emit `componentsResolved: false`."
  artifacts:
    - path: extensions/pi-claude-marketplace/orchestrators/plugin/info.ts
      provides: "Path-source `pluginRoot` derivation + `composeResolvedComponents` invocation on the not-installable arms of `buildInstalledRow` and `buildNotInstalledRow`."
    - path: tests/orchestrators/plugin/info.test.ts
      provides: "Fixture-based coverage of the four new behaviors above."
  key_links:
    - from: extensions/pi-claude-marketplace/orchestrators/plugin/info.ts
      to: extensions/pi-claude-marketplace/orchestrators/plugin/info.ts:composeResolvedComponents
      via: "direct call against the not-installable variant when `parsedSource.kind === \"path\"`"
      pattern: "composeResolvedComponents\\("
    - from: extensions/pi-claude-marketplace/orchestrators/plugin/info.ts
      to: extensions/pi-claude-marketplace/domain/source.ts:parsePluginSource
      via: "already-derived `parsedSource` from `buildBlock` threaded into both row builders"
      pattern: "parsedSource"
---

<objective>
Fix the user-reported `(unavailable) {unsupported hooks}` row that renders `components: not resolved`. Today only `buildInstalledRow`'s installable arm runs `composeResolvedComponents`; the not-installable arms emit `componentsResolved: false` because they cannot read `pluginRoot` (NFR-7 keeps it off the not-installable variant).

But the not-installable variant DOES carry `componentPaths` and `mcpServers`. For the read-only info surface, `pluginRoot` can be re-derived exactly the way `preflightStages` does (`path.resolve(mpRecord.marketplaceRoot, parsedSource.raw)`), and `composeResolvedComponents` can be reused against the not-installable variant -- it only reads `componentPaths`, `mcpServers`, and `hooksConfigPath`, all symmetric across the discriminated union.

Purpose: deliver the user's expected info-surface behavior for path-source plugins -- componentwise visibility even when the plugin is structurally `(unavailable)` (e.g. ralph-loop's unsupported hooks).
Output: updated `info.ts` + new tests in `tests/orchestrators/plugin/info.test.ts`; `npm run check` GREEN.
</objective>

<execution_context>
@$HOME/.claude/gsd-core/workflows/execute-plan.md
@$HOME/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@CLAUDE.md
@.claude/rules/typescript-comments.md
@extensions/pi-claude-marketplace/orchestrators/plugin/info.ts
@extensions/pi-claude-marketplace/domain/resolver.ts
@extensions/pi-claude-marketplace/domain/source.ts
@extensions/pi-claude-marketplace/shared/notify.ts
@tests/orchestrators/plugin/info.test.ts
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Enumerate components on path-source not-installable info rows</name>
  <files>extensions/pi-claude-marketplace/orchestrators/plugin/info.ts, tests/orchestrators/plugin/info.test.ts</files>
  <behavior>
    Behavior changes are scoped to two existing arms of `info.ts`:

    1. `buildNotInstalledRow` `!resolved.installable` branch (around line 563): when the source is path-resolvable, re-derive `pluginRoot` (via `path.resolve(mpRecord.marketplaceRoot, parsedSource.raw)`, mirroring `preflightStages`) and call `composeResolvedComponents(pluginRoot, resolved)`. Emit `componentsResolved: true` + `components` together with the existing `narrowResolverNotes(resolved.notes)` reasons (the `status: "unavailable"` and reasons brace are unchanged). If `composeResolvedComponents` throws (e.g. EACCES on a declared component dir during discovery), fall back to the existing `componentsResolved: false` + `narrowProbeError(err)` classified-reason path.

    2. `buildInstalledRow` `!resolved.installable` branch (around line 503): same treatment. Status stays `"installed"`, `resolverReasons` brace is preserved, but when `parsedSource.kind === "path"` enumerate components from the not-installable variant via the same `composeResolvedComponents` call. On throw, fall back to the existing `componentsResolved: false` path.

    Arms that MUST remain unchanged:
    - `buildNotInstalledRow` `catch (err)` arm (resolver THREW -- no `resolved` value exists, so there are no `componentPaths` to read).
    - The (a) / (b) / (d) arms in `buildBlock` (manifest read failure, plugin not in manifest, the existing installable arms).
    - Non-path-source rows (github / npm / url / git-subdir / unknown): MUST continue to emit `componentsResolved: false` -- INFO-05 source-kind gate is preserved.

    Plumbing:
    - `buildBlock` already computes `parsedSource` at line 410. Thread `parsedSource` into both `buildInstalledRow` and `buildNotInstalledRow` (replacing or supplementing the existing `resolvable: boolean` parameter on `buildInstalledRow`). Inside the row builders, gate the new code path on `parsedSource.kind === "path"` so non-path arms keep emitting `componentsResolved: false`. The `resolvable` boolean shortcut at the top of `buildInstalledRow` (lines 472-480, the early-return for non-path sources) stays as-is -- that arm renders without resolver probing.
    - Add a small private helper inside `info.ts` (do NOT extract from `domain/resolver.ts`) -- e.g. `derivePluginRootForInfo(marketplaceRoot: string, parsedSource: ParsedSource): string` -- that returns `path.resolve(marketplaceRoot, parsedSource.raw)`. Constrain its input type via a discriminant check (caller asserts `parsedSource.kind === "path"` first) so the helper only ever runs against `PathSource`. This keeps the resolver's NFR-7 discriminated-union safety intact -- `pluginRoot` is still unreadable from the not-installable variant; the helper re-derives it from inputs that are NOT gated by `installable`.
    - NFR-10 path-containment: `assertPathInside` is enforced at install time; for the read-only info surface, we walk paths the resolver itself accepted (its own `sourceEscapeReason` ran before either variant was returned). A second containment check on the info surface is not required -- record this rationale in a single inline comment anchored to NFR-10 + INFO-05.

    Comment policy (`.claude/rules/typescript-comments.md`):
    - The only acceptable inline anchor for this change is INFO-05 (the existing source-kind gate token already used in info.ts).
    - Update the existing INFO-05 inline comment block in `info.ts` to reflect the new behavior: path-resolvable not-installable variants ALSO enumerate components (the gate only excludes non-path sources, not the not-installable verdict). Keep it minimal.
    - Do NOT add new phase/plan/wave/pitfall references. Do NOT mention the user report. Do NOT cite ralph-loop or any other concrete plugin.

    Tests (`tests/orchestrators/plugin/info.test.ts`) -- match the existing `seedPathMarketplace` / `withHermeticHome` / byte-stable `notifications[0]!.message` style:

    - Test A: `(unavailable) {unsupported hooks}` with on-disk skills + commands.
      Seed a path-source marketplace with a plugin whose `hooks/hooks.json` is malformed (resolver flips `installable: false` with the `malformed hooks.json:` note -> `narrowResolverNotes` -> `"unsupported hooks"`) AND seed `skills/s1/` (dir) + `commands/c1.md` (file) on disk. The plugin is NOT in the installed bucket.
      Expected `notifications[0]!.message`:
      ```
      ● mp [user] <no autoupdate>
        ⊘ <name> v0.1.0 (unavailable) {unsupported hooks}
          <description-if-any>
          commands: c1
          skills: s1
      ```
      No `hooks:` line (the resolver bailed before recording `hooksConfigPath`).

    - Test B: `(installed) {unsupported hooks}` with on-disk components.
      Same setup as Test A but the plugin IS in the installed bucket. Expected output mirrors the existing WR-01 `legacy v0.1.0 (installed) {unsupported hooks}` test (line ~692) but the `components: not resolved` line is replaced by per-kind component lines (no hooks line).

    - Test C: INFO-05 anti-regression -- non-path source `(unavailable)` still defers.
      Seed an entry whose `source` is an npm object (`{ source: "npm", package: "..." }`) and is NOT in the installed bucket. Even with the resolver returning `installable: false`, the row MUST still emit `    components: not resolved` (because the source is not path-resolvable, there are no on-disk components to enumerate).

    - Test D: composeResolvedComponents throw on the unavailable arm.
      Path-source, NOT installed, malformed hooks.json (flips not-installable), seed `skills/s1/` on disk then `chmod 000` the `skills/` dir (POSIX-only with `t.skip` on Windows, mirroring the existing pattern). The discovery throw must propagate to the unavailable-arm catch and fall back to `componentsResolved: false` + `{permission denied}` reason brace. The expected message body contains `(unavailable) {unsupported hooks, permission denied}` (or whatever order `composeReasons` produces -- assert via `assert.match` on the two reason tokens being present rather than locking exact order if the reason-merge ordering is renderer-driven).

    No changes to `parsePluginSource`, `domain/resolver.ts`, `composeResolvedComponents`'s signature, or `shared/notify.ts` -- the `componentsResolved: true | false` discriminator semantics are invariant. The fix is entirely contained within `buildInstalledRow` / `buildNotInstalledRow` + tests.
  </behavior>
  <action>
    Per INFO-05, extend the info surface so path-resolvable not-installable resolver variants enumerate components via the existing `composeResolvedComponents` helper, while preserving the source-kind gate for non-path sources and the existing throw-fallback path. Implementation outline:

    1. Inside `info.ts`, add a private helper `derivePluginRootForInfo(marketplaceRoot: string, source: PathSource): string` (or pass `parsedSource: ParsedSource` and narrow inside) that returns `path.resolve(marketplaceRoot, source.raw)`. Mirrors `preflightStages` derivation. No new exports.

    2. Update `buildBlock` to pass `parsedSource` into both `buildInstalledRow` and `buildNotInstalledRow` (replace the boolean `resolvable` parameter on `buildInstalledRow` with `parsedSource`; recompute `resolvable` inline as needed, or pass both -- whichever is cleaner).

    3. In `buildInstalledRow`'s `!resolved.installable` branch (line ~503), when `parsedSource.kind === "path"`, wrap a try/catch around a `composeResolvedComponents(pluginRoot, resolved)` call. On success, emit `componentsResolved: true, components` together with the existing `resolverReasons` brace. On throw, fall back to the existing `componentsResolved: false` + `narrowProbeError(err)` ladder. For non-path parsedSource kinds, keep the existing `componentsResolved: false` emission (no behavior change).

    4. In `buildNotInstalledRow`'s `!resolved.installable` branch (line ~563), same treatment: gate on `parsedSource.kind === "path"`, try/catch around `composeResolvedComponents`, fall back to the existing `componentsResolved: false` + `narrowProbeError(err)` path on throw. The `narrowResolverNotes(resolved.notes)` reasons are preserved across both arms.

    5. Leave the `buildNotInstalledRow` `catch (err)` arm (probe THREW before resolver returned) unchanged -- there is no `resolved` value to read componentPaths from.

    6. Update the existing INFO-05 inline comment block in `info.ts` to note that path-resolvable not-installable variants also enumerate components (the gate excludes non-path sources, not the not-installable verdict). Add a single inline note anchored to NFR-10 + INFO-05 explaining why a second `assertPathInside` is not required at the info surface (the resolver's own `sourceEscapeReason` already accepted these paths before returning either variant; info is read-only).

    7. Add tests A-D in `tests/orchestrators/plugin/info.test.ts` (see `<behavior>` for fixture details). Place them alongside the existing SURF-01 / INFO-02 / WR-01 cluster and follow the file's existing `seedPathMarketplace` / `withHermeticHome` style. Test D guards with `t.skip` on `win32` exactly like the existing chmod tests.

    8. Comment-policy check: only INFO-05 is permitted as an inline anchor for this change. Do NOT introduce new phase/plan/pitfall/milestone references. Surgical edits only -- do not "improve" adjacent code, do not refactor `composeResolvedComponents`, do not touch `parsePluginSource` or the resolver.

    9. Run `npm run check` (typecheck + ESLint + Prettier + tests). Iterate until green. Then `pre-commit run --files <changed files>` (or `pre-commit run --all-files` for safety), restage, and commit on the current `features/v1.13-hook-bridge` branch.

    10. Commit message (Conventional Commits, <=72-char title, <=80-char body lines):
        ```
        fix(plugin/info): enumerate components on path-source not-installable rows

        info.ts now reuses composeResolvedComponents against the resolver's
        not-installable variant when the source is path-resolvable. Path
        sources that flip installable=false (unsupported hooks, persistence-
        vs-disk disagreement) render their skills / commands / agents / mcp
        from disk instead of `components: not resolved`. Non-path sources
        still defer per INFO-05; the catch arm (resolver THREW) is unchanged.
        ```
  </action>
  <verify>
    <automated>npm run check</automated>
  </verify>
  <done>
    - `npm run check` is GREEN (typecheck + ESLint + Prettier + tests).
    - Tests A, B, C, D pass.
    - Existing tests in `tests/orchestrators/plugin/info.test.ts` still pass unmodified (the four pre-existing `components: not resolved` assertions on non-path sources are anti-regression for INFO-05; the malformed-hooks tests at lines ~325 and ~692 may need updates to reflect the new component-enumeration behavior -- the EXPECTED post-fix output for those plugins is per-kind component lines, NOT `components: not resolved`).
    - Single atomic commit on `features/v1.13-hook-bridge`.
    - No new inline anchors other than INFO-05 (+ existing NFR-10 reference allowed).
    - No changes to `parsePluginSource`, `domain/resolver.ts`, `composeResolvedComponents`'s signature, or `shared/notify.ts`.
  </done>
</task>

</tasks>

<verification>
- `npm run check` GREEN locally.
- Manual spot check (optional, not required for plan completion): the failure mode from the user report (`(unavailable) {unsupported hooks}` rendering `components: not resolved`) is now covered by Test A; if a real ralph-loop fixture is handy the operator can run `/claude:plugin info ralph-loop@claude-plugins-official` and confirm the per-kind component lines appear.
- Grep gate: `grep -n "components: not resolved" tests/orchestrators/plugin/info.test.ts` -- the existing INFO-05 (npm-source) anti-regression assertion is preserved; the two malformed-hooks tests that previously asserted `components: not resolved` are updated to assert per-kind component lines instead.
</verification>

<success_criteria>
- The four behaviors in the `must_haves.truths` list are observable in `npm run check` test output.
- INFO-05 source-kind gate is preserved (Test C).
- No regression in throw-fallback semantics (Test D + the existing chmod tests).
- Single atomic commit; no scope creep into resolver / source / notify.
</success_criteria>

<output>
Create `.planning/quick/260618-qkz-show-components-on-unavailable-info-rows/260618-qkz-SUMMARY.md` when done.
</output>
