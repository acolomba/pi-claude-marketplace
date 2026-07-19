---
quick_task: 260612-bcs-fix-pr-51-five-agent-review-findings
type: execute
wave: 1
depends_on: []
files_modified:
  - CLAUDE.md
  - src/orchestrators/plugin/enable-disable.ts
  - src/orchestrators/plugin/update.ts
  - src/orchestrators/plugin/reinstall.ts
  - src/orchestrators/plugin/install.ts
  - src/orchestrators/plugin/uninstall.ts
  - src/orchestrators/plugin/shared.ts
  - src/orchestrators/marketplace/remove.ts
  - src/orchestrators/marketplace/autoupdate.ts
  - src/orchestrators/marketplace/add.ts
  - src/orchestrators/reconcile/apply.ts
  - src/orchestrators/reconcile/preview.ts
  - src/orchestrators/reconcile/plan.ts
  - src/orchestrators/reconcile/notify.ts
  - src/orchestrators/reconcile/types.ts
  - src/orchestrators/reconcile/apply-outcomes.ts
  - src/orchestrators/reconcile/README.md
  - src/persistence/config-io.ts
  - src/persistence/config-write-back.ts
  - src/persistence/config-merge.ts
  - src/persistence/migrate-config.ts
  - src/edge/handlers/plugin/enable-disable.ts
  - src/domain/source.ts
  - src/shared/notify.ts
  - src/index.ts
  - docs/output-catalog.md
  - tests/orchestrators/plugin/enable-disable.test.ts
  - tests/orchestrators/plugin/update.test.ts
  - tests/orchestrators/plugin/uninstall.test.ts
  - tests/orchestrators/marketplace/remove.test.ts
  - tests/orchestrators/marketplace/autoupdate.test.ts
  - tests/orchestrators/reconcile/apply.test.ts
  - tests/orchestrators/reconcile/plan.test.ts
  - tests/persistence/config-io.test.ts
  - tests/persistence/config-write-back.test.ts
  - tests/edge/handlers/plugin/enable-disable.test.ts
  - tests/shared/catalog-uat.test.ts
autonomous: true
requirements:
  - C1
  - I1
  - I2
  - I3
  - I4
  - I5
  - I6
  - T1
  - T2
  - T3
  - T4
  - T5
  - T6
  - Y1
  - Y2
  - Y3
  - Y4
  - Y5
  - Y6
  - Y7
  - D1
  - D2
  - D3
  - D4
  - D5
  - D6
  - D7
  - D8
  - D9
  - D10
  - D11
  - S1
  - S2
  - S3
  - S4
  - S5
  - S6
  - S7
  - S8
  - S9
  - S10

must_haves:
  truths:
    - "setPluginEnabled honors its never-rethrows contract even when state.json is corrupt in either scope (edge handler emits a notify row, not a raw throw)."
    - "Orchestrated partial marketplace-remove cascades render every successfully-uninstalled plugin row and every per-plugin failure, not just the first failure."
    - "Autoupdate write-back skips are surfaced as failed/skipped rows; no name in finalResult.changed renders success when its write-back was silently skipped."
    - "Disable cascade partial failure folds dropped artefacts into state before surfacing the failure (state.json never claims artefacts that are gone)."
    - "Enable failure renders rollback-partial recovery rows by threading InstallFailureCapture through runInstallLedger."
    - "loadConfig diagnostic detail (EACCES / JSON-parse / schema-key) reaches the rendered row's cause trailer instead of being flattened to {invalid manifest}, with absolute paths stripped (T-53-02-02)."
    - "reconcile apply classifies StateLockHeldError to 'lock held' and PluginShapeError to kind-mapped reasons (not-in-manifest / already-installed / unsupported), not {unreadable}."
    - "plugin update and marketplace autoupdate refresh a disabled plugin's record (version/source pin) but keep the plugin disabled with empty resources (per locked decision)."
    - "marketplace/remove.ts narrowCascadeFailure maps AgentsUnstageFailureError to 'source mismatch' (aligned with uninstall.ts ATTR-09 mapping, per locked decision)."
    - "samePlannedSource returns a 3-state string union; no truthy-coercion misreads a corrupt record as a source match."
    - "PlannedSourceMismatch is widened to four causes with per-cause variants; rendered output stays byte-identical."
    - "setPluginEnabled overload pair makes orchestrated mode return a guaranteed outcome; apply has no silent continue."
    - "MigrateFirstRunResult.error exists only on the existing-invalid arm (discriminant cut)."
    - "Load-time reconcile ENABLE row is exercised end-to-end through applyReconcile with a passing test; orchestrated enable-success is covered too."
    - "Predicate-drift test pins isRecordedButDisabled and isCurrentlyDisabled agreement over the populated/empty x installable matrix."
    - "First-run migration silence is documented as deliberate at migrate-config.ts:30-33 (contract comment fix only, no new notify)."
    - "CLAUDE.md NFR-10 enumerates the new sanctioned write paths (claude-plugins.json, claude-plugins.local.json)."
    - "reconcile/README.md is rewritten in domain terms (purity discipline, 7-bucket model, sentinel contracts) with no Phase/Plan/Wave/Task references."
    - "All forbidden process-history comments listed under D11 are stripped or rewritten to inline rationale; decision/requirement IDs are preserved as the only allowed traceability."
    - "npm run check stays green at the end of every commit; catalog-uat byte gate stays GREEN (with docs/output-catalog.md amended in lockstep for I1/I2/I5 row changes)."
  artifacts:
    - path: src/orchestrators/plugin/enable-disable.ts
      provides: "try/catch wrap of resolveCrossScopePluginTarget, threaded InstallFailureCapture on enable, dropped-fold on disable partial cascade, overload pair for orchestrated mode."
    - path: src/orchestrators/plugin/update.ts
      provides: "Disabled-record guard: refresh record (version/source pin) without re-materialization; resources.* stay empty."
    - path: src/orchestrators/marketplace/remove.ts
      provides: "Partial arm carrying unstaged + per-plugin failures; narrowCascadeFailure AgentsUnstageFailureError -> 'source mismatch'; flow header rewritten."
    - path: src/orchestrators/marketplace/autoupdate.ts
      provides: "writeAutoupdateBack returns skipped names; disabled-record refresh keeps disabled; honest failed/skipped rows for skipped write-backs."
    - path: src/orchestrators/reconcile/apply.ts
      provides: "classifyOrchestratorThrow handles StateLockHeldError and PluginShapeError; postCommitWarnings surfaced; no silent continue on outcome-less orchestrated calls."
    - path: src/persistence/config-io.ts
      provides: "loadConfig surfaces diagnostic detail to consumers via result.error; absolute paths stripped before rendering."
    - path: src/persistence/migrate-config.ts
      provides: "MigrateFirstRunResult.error only on existing-invalid arm; contract comment marks the silence as deliberate and informational."
    - path: src/domain/source.ts
      provides: "samePlannedSource: 'same' | 'different' | 'unknown-stored' 3-state result; callers updated."
    - path: src/orchestrators/reconcile/types.ts
      provides: "PlannedSourceMismatch widened to 4 causes with per-cause variants; SourceMismatchOutcome propagates."
    - path: src/orchestrators/reconcile/README.md
      provides: "Rewritten in domain terms (purity, 7-bucket model, sentinel contracts); no process-history voice."
    - path: docs/output-catalog.md
      provides: "Catalog amendments for any row bytes added/changed by I1/I2/I5; everything else byte-unchanged."
    - path: CLAUDE.md
      provides: "NFR-10 enumeration adds claude-plugins.json + claude-plugins.local.json sanctioned write paths."
  key_links:
    - from: src/edge/handlers/plugin/enable-disable.ts
      to: src/orchestrators/plugin/enable-disable.ts::setPluginEnabled
      via: try/catch wrapping resolveCrossScopePluginTarget
      pattern: "setPluginEnabled.*classifyTransactionThrow"
    - from: src/orchestrators/reconcile/apply.ts::classifyOrchestratorThrow
      to: src/orchestrators/plugin/shared.ts::PluginShapeError
      via: instanceof narrowing model from src/import/execute.ts::dispatchFailedOutcome
      pattern: "PluginShapeError.*kind"
    - from: src/orchestrators/plugin/update.ts
      to: src/orchestrators/reconcile/plan.ts::isRecordedButDisabled
      via: disabled-record guard before re-materialization
      pattern: "isRecordedButDisabled|isCurrentlyDisabled"
    - from: src/persistence/config-io.ts::loadConfig
      to: src/orchestrators/reconcile/apply.ts (and other consumers)
      via: result.error threaded into row cause trailer (paths stripped)
      pattern: "loadConfig.*error.*cause"
    - from: docs/output-catalog.md
      to: tests/shared/catalog-uat.test.ts
      via: lockstep byte-equality amendment for I1/I2/I5 row additions
      pattern: "catalog-uat"
---

<objective>
Fix every finding from the PR #51 five-agent review (1 CRITICAL, 6 IMPORTANT error-handling,
6 IMPORTANT test gaps, 7 IMPORTANT type-design cuts, 11 IMPORTANT comments/docs items, and
10 SUGGESTIONS) in three atomic commits. The CONTEXT.md is the authoritative list; every
finding in it is in scope.

Purpose: Close the review against `features/v1.12-config-files` so the PR can merge with no
outstanding behavior, error-channel, type-soundness, test-coverage, or comment-hygiene debt.
Decisions are locked (CONTEXT.md `<decisions>`): update-vs-disabled refresh-but-keep-disabled
(D-UPD), narrowCascadeFailure align to ATTR-09 source mismatch (D-NCF), first-run migration
silence is deliberate -- comment fix only (D-MIG).

Output: 3 commits on `features/v1.12-config-files` -- behavior/error-handling + tests (Task 1),
type-design cuts + remaining test gaps (Task 2), comments/docs cleanup (Task 3) -- with
`npm run check` GREEN at the end of each and `docs/output-catalog.md` + catalog-uat moved in
lockstep with any row-byte change.
</objective>

<execution_context>
@$HOME/.claude/gsd-core/workflows/execute-plan.md
@$HOME/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/quick/260612-bcs-fix-pr-51-five-agent-review-findings/260612-bcs-CONTEXT.md
@.planning/STATE.md
@CLAUDE.md
@.claude/rules/typescript-comments.md
@docs/output-catalog.md
@docs/messaging-style-guide.md

# Authoritative finding locations (file:line refs verified in CONTEXT.md; load only when working a specific finding)
@src/orchestrators/plugin/enable-disable.ts
@src/orchestrators/plugin/update.ts
@src/orchestrators/plugin/install.ts
@src/orchestrators/plugin/uninstall.ts
@src/orchestrators/plugin/reinstall.ts
@src/orchestrators/plugin/shared.ts
@src/orchestrators/marketplace/remove.ts
@src/orchestrators/marketplace/autoupdate.ts
@src/orchestrators/reconcile/apply.ts
@src/orchestrators/reconcile/preview.ts
@src/orchestrators/reconcile/plan.ts
@src/orchestrators/reconcile/notify.ts
@src/orchestrators/reconcile/types.ts
@src/orchestrators/reconcile/apply-outcomes.ts
@src/orchestrators/reconcile/README.md
@src/persistence/config-io.ts
@src/persistence/config-write-back.ts
@src/persistence/migrate-config.ts
@src/edge/handlers/plugin/enable-disable.ts
@src/domain/source.ts
@src/shared/notify.ts
@src/index.ts
@src/import/execute.ts
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Behavior + error-handling fixes (C1, I1-I6, S2-S6, Y7) with tests</name>
  <files>
    src/orchestrators/plugin/enable-disable.ts,
    src/orchestrators/plugin/update.ts,
    src/orchestrators/plugin/reinstall.ts,
    src/orchestrators/marketplace/remove.ts,
    src/orchestrators/marketplace/autoupdate.ts,
    src/orchestrators/reconcile/apply.ts,
    src/persistence/config-io.ts,
    src/persistence/migrate-config.ts,
    src/edge/handlers/plugin/enable-disable.ts,
    src/index.ts,
    docs/output-catalog.md,
    tests/orchestrators/plugin/enable-disable.test.ts,
    tests/orchestrators/plugin/update.test.ts,
    tests/orchestrators/marketplace/remove.test.ts,
    tests/orchestrators/marketplace/autoupdate.test.ts,
    tests/orchestrators/reconcile/apply.test.ts,
    tests/persistence/config-io.test.ts,
    tests/edge/handlers/plugin/enable-disable.test.ts,
    tests/shared/catalog-uat.test.ts
  </files>
  <behavior>
    Per finding (each pinned by at least one new or amended test):
    - C1 (setPluginEnabled never-rethrows): with a corrupt state.json in either scope,
      `setPluginEnabled` in orchestrated mode returns a (failed) outcome row (no throw,
      no leaked absolute path); the edge handler renders the failed row via notify and
      returns without re-throwing. Pin with a test that seeds a corrupt state.json and
      asserts: zero process.stdout writes, exactly one notify call, basename-only path
      tokens (T-53-02-02), and no exception escapes. Model the try/catch ladder on
      `reconcile/preview.ts:158-170`; map through the existing `classifyTransactionThrow`
      at enable-disable.ts:480.
    - I1 (orchestrated partial marketplace-remove cascade): add a partial arm to
      `applyMarketplaceRemoves` (`reconcile/apply.ts:268-275`) mirroring the standalone
      CMC-31 PARTIAL shape, carrying both `unstaged` (success rows) AND per-plugin
      failures from `marketplace/remove.ts:268-277`'s tx outcome. Render: one success row
      per unstaged plugin + one failed row per failed plugin (not just the first).
      Pin: a multi-plugin marketplace where N-1 uninstall succeed and the Nth fails
      renders N rows, not 1.
    - I2 (autoupdate skipped names): `writeAutoupdateBack` (`autoupdate.ts:484-501`)
      returns a `skipped: string[]` of names whose source could not be synthesized.
      Demote those names from `finalResult.changed` (`:343-347`) into honest failed or
      skipped rows (catalog amendment: pick existing tokens before adding a new one;
      if a new reason token is unavoidable, amend it in docs/output-catalog.md +
      catalog-uat fixtures in THIS commit per the closed-set rule).
      Pin: skip path renders a row, not silent success.
    - I3 (disable partial cascade fold): when `cascade.dropped` is non-empty on disable
      partial failure (`enable-disable.ts:252-259`), fold the dropped artefacts into the
      record, save the shrunken record, THEN surface the failure -- mirror the TR-03
      fold from `uninstall.ts:468-484`. Pin: after a partial disable cascade failure,
      state.json no longer references the dropped artefacts AND the failed row still
      renders.
    - I4 (enable threads InstallFailureCapture): pass a fresh `InstallFailureCapture`
      as the 4th arg to `runInstallLedger` on the enable branch (`enable-disable.ts:206-213`)
      and render `rollbackPartials` into the failed row via the existing
      `composeInstallFailureMessage` (`install.ts:343-352`) call shape used at
      install.ts:810/:967. Pin: enable failure with rollback-partial residue renders the
      rollback-partials trailer (matching install/uninstall pattern), not a bare failed row.
    - I5 (loadConfig diagnostic threading): `loadConfig` already returns `result.error`
      with the granular cause (EACCES vs JSON parse vs schema key). At every consumer
      surface listed in CONTEXT.md, thread `result.error` into the rendered row's `cause`
      trailer AFTER stripping absolute paths via the existing path-redaction helper used
      by T-53-02-02 (notify.ts neighborhood). Do NOT strip the parse detail itself.
      Pin: at least one surface (EACCES via chmod-0 + permission-denied bubble, OR
      schema-key reject via a deliberately malformed key) renders a cause trailer with
      the granular reason and basename-only path tokens. Amend docs/output-catalog.md +
      catalog-uat in THIS commit if the trailer adds new bytes.
    - I6 (apply.ts orchestrator-throw classification): extend
      `classifyOrchestratorThrow` at `reconcile/apply.ts:181-184, 420` to handle
      `StateLockHeldError -> "lock held"` and `PluginShapeError -> kind-mapped reasons`
      (not-in-manifest / already-installed / unsupported). Model: `import/execute.ts`'s
      `dispatchFailedOutcome` instanceof narrowing. Pin: a config declaring a plugin
      absent from the manifest renders `{not in manifest}`, not `{unreadable}`.
    - S2 (postCommitWarnings surfaced from reconcile installs): in
      `reconcile/apply.ts:389-433`, surface `result.postCommitWarnings` the same way
      `import/execute.ts:699-703` does. Pin: a reconcile-driven install whose result
      carries a postCommitWarning renders that warning row.
    - S3 (read-pass-throw attribution): in `apply.ts:596-603`, when the throw came from
      `saveConfig` inside `migrateFirstRunConfig` (EACCES on claude-plugins.json),
      attribute the failure to the config basename, not state.json. Pin a test where
      claude-plugins.json is unwritable and the failure row names claude-plugins.json
      (basename), not state.json.
    - S4 (synthesizeUndeclaredMarketplaceSource): in `plugin/shared.ts:284-285`, prefer
      to skip the config write and surface a row when synthesis returns undefined. If
      surface is structurally infeasible inside this PR's scope, add a decision-anchored
      comment at the call sites referencing CONTEXT.md S4 + the existing :250-257 doc.
      Pin behavior: at least one call site test asserts the chosen path (row OR
      documented decision).
    - S5 (reinstall/update invalid-config consistency): in `reinstall.ts:1090-1092` and
      `update.ts:1032-1034`, replace silent skip-of-write-back with the loud CFG-03
      abort the siblings perform (or, at minimum, append a warning row). Pick the same
      shape as the closest sibling and document it inline. Pin: invalid config no
      longer renders success.
    - S6 (outcome-less orchestrated calls): for the THREE non-toggle loops at
      `apply.ts:245-248, 303-306, 349-352`, adopt the fail-loud pattern from
      `import/execute.ts:613` ("returned no outcome in orchestrated mode") so the row
      never silently vanishes. (The fourth loop at :470-473 is covered by Y3 in Task 2.)
      Pin: a fixture that forces undefined return at one of the three loops renders a
      row, not silence.
    - Y7 (errorMessage at index.ts:31): replace `(err as Error).message` with the
      existing `errorMessage(err)` helper. Pin: throwing a non-Error (e.g. a string)
      renders `reconcile aborted: <stringified>`, not `reconcile aborted: undefined`.

    Update-vs-disabled (locked decision D-UPD) -- behavior + test:
    - In `plugin/update.ts` and the autoupdate cascade path, when the target plugin is
      currently disabled (`isCurrentlyDisabled`: populated config entry + empty
      resources.*), refresh the record (version pin / source pin) but DO NOT
      re-materialize artefacts; `resources.*` stay empty. Render the existing
      success-shape token (no new token if avoidable). Pin in
      `tests/orchestrators/plugin/update.test.ts` (seed disabled record per CONTEXT.md
      decision text) + an autoupdate cascade test.

    Catalog rule: if I1, I2, OR I5 changes rendered bytes, amend
    `docs/output-catalog.md` (relevant section) + `tests/shared/catalog-uat.test.ts`
    fixtures in THIS same commit. Every other byte must stay identical -- prefer the
    closest existing token to introducing a new one.
  </behavior>
  <action>
    Implement each finding per `<behavior>` above. Sequence inside this commit:

    1. Write or update the targeted test(s) FIRST (RED), one per finding (C1, I1, I2,
       I3, I4, I5, I6, S2, S3, S4-anchor, S5, S6, Y7, D-UPD update + autoupdate). Use
       node:test + the existing test harness/fixtures; mirror the seed shapes already
       used in the cited neighbours (e.g. WR-09 disable-axis at
       reconcile/apply.test.ts:443 for the load-time enable seed).
    2. Implement the source changes to make them GREEN. Apply the locked decisions
       verbatim:
         - D-UPD: refresh record, keep disabled, resources.* empty.
         - D-NCF: in `marketplace/remove.ts:159-165`, the narrowCascadeFailure switch
           on `AgentsUnstageFailureError` returns `"source mismatch"` (ATTR-09 align).
         - D-MIG: comment-only -- belongs in Task 3, NOT this commit.
    3. For C1, model the try/catch ladder on `reconcile/preview.ts:158-170`; the catch
       routes through `classifyTransactionThrow` at `enable-disable.ts:480` so the
       failed outcome is the same typed shape downstream consumers already handle. The
       edge handler at `edge/handlers/plugin/enable-disable.ts:48-57` adds a catch that
       calls `notify` with the existing severity routing; no new branches in notify.ts.
    4. For I5, locate the existing T-53-02-02 path-redactor helper in
       `shared/notify.ts` (search for the basename-only enforcement) and reuse it.
    5. For S6 + Y3 (Y3 lands in Task 2), keep import/execute.ts:613 as the canonical
       wording so all four loops converge on identical text.
    6. If a new catalog token is genuinely necessary (prefer NOT), amend
       docs/output-catalog.md + catalog-uat fixtures in THIS commit (closed-set rule).
       Update the catalog example for I1 (multi-row partial), I2 (skipped name), I5
       (cause trailer) if their rendered bytes shift.
    7. Run `npm run check` (typecheck + ESLint + Prettier + tests) until GREEN.
    8. Run `pre-commit run --files <changed files>` until GREEN.
    9. Commit atomically. If committing from inside a worktree, prefix
       `SKIP=trufflehog`. Conventional Commits, title <=72 chars, body lines <=80
       chars. Suggested title: `fix(pr-51): close behavior + error-channel review
       findings`.

    Notes:
    - Do NOT touch comments/docs cleanup here -- that's Task 3.
    - Do NOT do type-design widenings here -- that's Task 2 (the `samePlannedSource`
      tri-state, PlannedSourceMismatch widening, MigrateFirstRunResult cut, setPluginEnabled
      overload, etc. -- Task 2 layers ON TOP of these behavior fixes).
    - First-run migration silence (decision D-MIG): no behavior change here; the
      contract-comment fix at `migrate-config.ts:30-33` is Task 3.
  </action>
  <verify>
    <automated>npm run check</automated>
  </verify>
  <done>
    - Every test from `<behavior>` exists and is GREEN.
    - `npm run check` exit 0 (typecheck + ESLint + Prettier + full test suite).
    - `pre-commit run --files <changed>` GREEN.
    - One atomic Conventional Commit on `features/v1.12-config-files`.
    - Catalog-uat byte gate GREEN; docs/output-catalog.md updated in lockstep iff
      I1/I2/I5 changed rendered bytes; everything else byte-identical.
    - No raw throw escapes `setPluginEnabled` in orchestrated mode (corrupt-state test
      proves it); no leaked absolute paths in any failed-row trailer.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Type-design cuts (Y1-Y6, S7-S10) + remaining test gaps (T1-T6)</name>
  <files>
    src/domain/source.ts,
    src/orchestrators/reconcile/types.ts,
    src/orchestrators/reconcile/apply-outcomes.ts,
    src/orchestrators/reconcile/apply.ts,
    src/orchestrators/reconcile/plan.ts,
    src/orchestrators/reconcile/notify.ts,
    src/orchestrators/plugin/enable-disable.ts,
    src/persistence/config-io.ts,
    src/persistence/config-write-back.ts,
    src/persistence/migrate-config.ts,
    src/shared/notify.ts,
    tests/orchestrators/plugin/enable-disable.test.ts,
    tests/orchestrators/reconcile/apply.test.ts,
    tests/orchestrators/reconcile/plan.test.ts,
    tests/persistence/config-io.test.ts,
    tests/persistence/config-write-back.test.ts
  </files>
  <behavior>
    Type-design cuts (rendered output stays byte-identical for every Y/S item below):
    - Y1 (samePlannedSource tri-state): `domain/source.ts::samePlannedSource` returns
      `"same" | "different" | "unknown-stored"` instead of `boolean | "unknown-stored"`.
      Update every call site (incl. `plan.ts:138, 192` where `=== true` exists today)
      to switch on the new union. Truthy-coercion of `"unknown-stored"` is now a type
      error.
    - Y2 (PlannedSourceMismatch widened): in `reconcile/types.ts:137-150`, widen
      `cause` to `"source-mismatch" | "unknown-stored" | "dangling-reference" |
      "malformed-plugin-key"` with per-cause variants -- `plugin` REQUIRED on
      `dangling-reference`; `rawKey` (NOT `marketplace`-punned) REQUIRED on
      `malformed-plugin-key`. Propagate to `SourceMismatchOutcome` in
      `apply-outcomes.ts:130-134` and the renderer arms at `notify.ts:143` and
      `apply.ts:515`. Renderers KEEP byte-identical output by deriving the existing
      strings from the new variants. Replace sentinel string `"<marketplace not declared>"`
      with the discriminant.
    - Y3 (setPluginEnabled orchestrated overload): in `plugin/enable-disable.ts:287` add
      an overload pair so `opts & { notifications: { mode: "orchestrated" } }` returns
      `Promise<EnableDisablePluginOutcome>` (no `| undefined`). Mirror the pattern in
      `AddMarketplaceNotifications`. In `apply.ts:470-471` remove the dead
      `if (!outcome) continue` -- the type now forbids it (and S6's fourth loop is
      covered by this).
    - Y4 (InvalidBlockOutcome.marketplace rename): in `apply-outcomes.ts:138-147`,
      rename the field that carries a basename (e.g. `basename` or `configBasename`).
      Update the renderer to match.
    - Y5 (MigrateFirstRunResult cut): in `migrate-config.ts:41-53`, cut the result type
      along the existing `reason` discriminant so `error` exists ONLY on the
      `existing-invalid` arm. Update consumers to narrow on `reason` before reading
      `error`.
    - Y6 (PluginToggleAxes derived successStatus): in `apply.ts:435-450`, derive
      `successStatus` from `enable` inside `applyPluginToggles`; drop the redundant
      axis.
    - S7 (isDeclaredEnabled helper): export a single one-line predicate
      `isDeclaredEnabled(entry)` from a shared module (the natural home is
      `persistence/config-io.ts` next to ScopeConfig) and use it at every
      `enabled !== false` site (plan.ts and elsewhere). Search by exact substring to
      catch all occurrences.
    - S8 (MarketplaceBlock.status narrowed): in `reconcile/notify.ts:51-58`, narrow
      `status` to the 5 statuses the projection assigns + undefined; delete the
      defensive runtime throw at `:118-126`.
    - S9 (cascadeSeverity closed-set param): in `notify.ts:1865-1873`, tighten the
      cascadeSeverity structural-subset param's `status` from `string` to the closed
      union.
    - S10 (config-write-back.ts:58 cast comment): point the cast comment at saveConfig's
      validator backstop (per CONTEXT.md type-review note); no code change required if
      the cast already lands inside the documented backstop chain.

    Test gaps (each pinned with a new test):
    - T1 (load-time ENABLE through applyReconcile): mirror
      `tests/orchestrators/reconcile/apply.test.ts:443` (WR-09 disable axis). Seed:
      disabled record + config-enabled. Assert: applyReconcile renders `(installed)`,
      state is re-populated, both config files byte-unchanged, second reconcile silent.
      Plus an orchestrated enable-success test in
      `tests/orchestrators/plugin/enable-disable.test.ts` (`status: "enabled"` + version).
    - T2 (update-vs-disabled): Task 1 added the BEHAVIOR test; T2 here adds an EDGE
      matrix test (disabled + autoupdate ON + cascade) to lock the joint contract.
    - T3 (direct pluginsToUninstall through applyReconcile): marketplace stays
      declared, ONE plugin entry deleted from config -> `applyPluginUninstalls` ->
      one `(uninstalled)` row + WR-06 converged-row-drop. Today only the
      marketplace-remove cascade exercises this path.
    - T4 (applySourceMismatches + applied-cascade source-mismatch arm): exercise
      `apply.ts:515-524` and `notify.ts:353-364` end-to-end via applyReconcile,
      including the dangling-reference plugin child row from Y2's new variants.
    - T5 (predicate-drift agreement): in `tests/orchestrators/reconcile/plan.test.ts`,
      add a matrix test over `populated/empty resources` x `installable true/false`
      asserting `isRecordedButDisabled` (`plan.ts:285-295`) and `isCurrentlyDisabled`
      (`enable-disable.ts:167-183`) agree on every cell.
    - T6 (smaller arms):
        * `classifyReadPassThrow` lock-held arm at `apply.ts:193-203`: pin via a forced
          `StateLockHeldError`.
        * `loadConfig` non-ENOENT read-failure arm at `config-io.ts:128-133`: drive it
          portably with a DIRECTORY named claude-plugins.json (yields EISDIR on read).
        * `writeMarketplaceConfigEntry` partial patch on absent marketplace at
          `config-write-back.ts:58, 177` casts: pin saveConfig's loud refusal.
  </behavior>
  <action>
    Sequence inside this commit:

    1. Write the new tests (T1-T6) FIRST. Use the seed shapes documented in CONTEXT.md
       (and the neighbouring tests cited there) so the new tests slot in next to their
       analogs. For T6's EISDIR path, `await fs.mkdir(path)` portably yields EISDIR on
       subsequent `readFile`; do NOT use chmod tricks for read-failure portability.
    2. Apply Y1 (`samePlannedSource` 3-state) and let the TypeScript compiler enumerate
       every call site that breaks. Update each site to switch on the new union (delete
       the `=== true` patterns at plan.ts:138, 192). This is the safest cut to do
       first -- it surfaces shadow callers via the type system.
    3. Apply Y2 (PlannedSourceMismatch widening) and propagate through
       SourceMismatchOutcome + the renderers. KEEP rendered bytes identical: drive that
       by adding a per-variant renderer test asserting the same output strings the
       previous fused shape produced.
    4. Apply Y3 (setPluginEnabled overload) and delete the dead continue at
       `apply.ts:470-471`. Tighten apply's call sites to use the orchestrated overload.
    5. Apply Y4, Y5, Y6 in sequence. Y6 derivation should be a one-line helper inside
       `applyPluginToggles`; the axis field comes off the call sites.
    6. Apply S7-S10. S8 deletes the runtime throw at notify.ts:118-126 (now structurally
       unreachable); S9 + S10 are localized type tightenings.
    7. Catalog-uat byte gate MUST stay GREEN with NO catalog edits in this commit --
       every change here is type-only or test-only. If any rendered byte shifts, that's
       a bug in the widening; fix the renderer to preserve bytes BEFORE committing.
    8. Run `npm run check`. Run `pre-commit run --files <changed>`. Commit atomically.
       Suggested title: `refactor(pr-51): tighten review-flagged types + close test gaps`.
       (SKIP=trufflehog if in a worktree.)
  </action>
  <verify>
    <automated>npm run check</automated>
  </verify>
  <done>
    - All T1-T6 tests exist and are GREEN.
    - Type system rejects every truthy-coercion of `"unknown-stored"`; rejects reading
      `error` outside the `existing-invalid` arm of MigrateFirstRunResult; rejects
      `undefined` from the orchestrated overload of setPluginEnabled.
    - `apply.ts:470-471` no longer has a runtime `if (!outcome) continue` guard.
    - catalog-uat byte gate GREEN with NO docs/output-catalog.md edit in this commit
      (this commit is byte-neutral by design).
    - `npm run check` exit 0; `pre-commit run --files <changed>` GREEN.
    - One atomic Conventional Commit on `features/v1.12-config-files`.
  </done>
</task>

<task type="auto">
  <name>Task 3: Comments/docs cleanup (D1-D11, S1) + first-run migration contract comment (D-MIG)</name>
  <files>
    CLAUDE.md,
    src/orchestrators/reconcile/README.md,
    src/orchestrators/reconcile/apply.ts,
    src/orchestrators/reconcile/preview.ts,
    src/orchestrators/reconcile/plan.ts,
    src/orchestrators/reconcile/notify.ts,
    src/orchestrators/reconcile/types.ts,
    src/orchestrators/reconcile/apply-outcomes.ts,
    src/orchestrators/plugin/install.ts,
    src/orchestrators/plugin/uninstall.ts,
    src/orchestrators/plugin/enable-disable.ts,
    src/orchestrators/marketplace/remove.ts,
    src/persistence/migrate-config.ts,
    src/persistence/config-merge.ts,
    src/persistence/config-write-back.ts,
    src/shared/notify.ts
  </files>
  <behavior>
    Pure comment/docs cleanup; ZERO behavior change; ZERO rendered-byte change.
    Per finding:

    - D1 (`reconcile/README.md`): rewrite in DOMAIN terms -- purity discipline, the
      7-bucket model, sentinel contracts. Currently factually wrong: claims
      `pluginsToEnable` structurally empty (plan.ts:285-295/:375-382 populate it),
      predicts a `state.disabled` field that was deliberately never added (the marker
      is empty resources + installable), lists 5 of 7 files, and uses forbidden
      process-history voice (Phase/Plan tables). Replace with technical content
      grounded in the source.
    - D2 (`reconcile/apply.ts:18`): "four orchestrators" -> "five" (lists six actions).
      `apply.ts:533-534`: rewrite the order-rationale paragraph -- buildUninstallBucket
      (`plan.ts:386-414`) EXCLUDES plugins under a to-be-removed marketplace
      (apply.ts's own WR-02 comment at :251 confirms this). State the correct rationale.
    - D3 (`shared/notify.ts:163`, `:275-276`): rewrite the tuple-position claims so they
      reflect `disabled` being last (these comments are byte-load-bearing reasoning for
      catalog gates; correctness matters).
    - D4 (`uninstall.ts:193-204`): delete the orphaned JSDoc (or merge into the actual
      entrypoint doc at :348-351). Fix `:617`/`:630` variable references that no longer
      exist (`outcome` -> `localOutcome`, `cascadeResult` -> `cascadeFailure`, etc.).
    - D5 (`install.ts:16, :494`): replace `resolveInstallVersion` with the actual
      `resolvePluginVersion`; restate the 3-tier precedence (plugin.json > entry.version
      > hash) per `plugin/shared.ts:461-475`.
    - D6 (`reconcile/plan.ts:263-266`): strip the line-number cross-ref to
      `install.ts::statePhase`; rephrase as "the only path that POPULATES resources.*"
      (vs disable emptying them); use symbolic refs only.
    - D7 (`apply-outcomes.ts:145`): fix the provenance -- CFG-03 reason is the
      hard-coded literal "invalid manifest" (never narrowProbeError); the state-load
      arm can also yield "lock held".
    - D8 (`marketplace/remove.ts:19-35` Flow + `:111`): rewrite the Flow header to
      match the current implementation -- `resolveScopeOrNotifyNotAdded` +
      `withLockedStateTransaction` + `tx.save()`, include the CFG-03 gate and WB-01
      write-back. Drop the pre-rewrite `resolveScopeFromState` / `withStateGuard`
      narration. Fix the stale ref at `:111`.
    - D9 (`reconcile/notify.ts:226-228`, `types.ts:9`): change future-tense ("will land"
      / "future apply path") to present tense -- apply.ts exists.
    - D10 (line-number cross-refs): replace hard line-number refs with symbolic
      `file.ts::symbol` form. Specific corrections from CONTEXT.md:
        * `install.ts:1077` / `:1212` -> point at `notify.ts::renderScopeBracket`
          (actual location notify.ts:1475) symbolically.
        * `install.ts:1078` self-ref: drop.
        * `install.ts:807` and `uninstall.ts:633`: replace wrong output-catalog.md
          section refs with the correct section names.
        * `uninstall.ts:465` "shared.ts:339": replace with `shared.ts::<symbol>`.
        * `install.ts:1214-1215` "uninstall.ts:298-302": symbolic.
        * `apply.ts:34` external-dep line numbers: anchor to dep version, not lines.
        * `apply.ts:68` "(mirrors preview.ts:60)": symbolic.
    - D11 (policy violations): strip the listed Phase/Plan/Wave/Pitfall-N IDs and
      DIFF-01->DIFF-02 evolution notes; KEEP the inline rationale; preserve all
      requirement/decision IDs. Specific items:
        * `enable-disable.ts:35-38` Pitfall 54-2 landing-sequence note -> strip ID,
          keep rationale.
        * `reconcile/notify.ts:14-16` DIFF-01->DIFF-02 evolution note -> strip
          evolution narration, keep the current rule.
        * `notify.ts:274/:321` and `apply-outcomes.ts:96` "RESEARCH Pattern 5 Option A"
          -> strip planning-artifact ref, keep the rule.
        * `apply.ts:31` "RESEARCH Assumption A1" -> strip.
        * `preview.ts:69` "RESEARCH Security Threat Pattern" -> strip.
        * `plan.ts:271-272` "Rule 2 deviation from the original plan's behavior block"
          -> strip.
        * `plan.ts:25` "Pitfall 53-?" + `apply.ts:91` "Pitfall 54-N" -> strip.
        * Bare "Pitfall 1/2/3/4/5/8" + "Pattern 3/4" in apply.ts and install.ts ->
          strip the dead IDs; keep rationale.
        * `uninstall.ts:70/:132`, `remove.ts:75/:125`, `enable-disable.ts:85/:146`
          "byte-identical to today" -> "matches standalone behavior".
        * `config-write-back.ts:30` "v1.12 config family" -> "schemaVersion-1 config
          family".
        * `config-merge.ts:139` "downstream phases" -> "downstream layers".
        * `install.ts:1201-1217` and `uninstall.ts:635-640` changelog-voice blocks ->
          one durable sentence each.
    - D-MIG (LOCKED decision -- first-run migration contract comment): in
      `persistence/migrate-config.ts:30-33`, replace the comment with one that states
      the result is informational and callers intentionally discard it (NFR-2 load-time
      quiet). Do NOT add a notify call.
    - S1 (CLAUDE.md NFR-10 enumeration): add `<scopeRoot>/claude-plugins.json` and
      `<scopeRoot>/claude-plugins.local.json` to the sanctioned write-paths list in
      CLAUDE.md so the config-file location does not read as containment widening
      (locations.ts:133 context).
  </behavior>
  <action>
    Comment/docs cleanup commit. ZERO source-logic edits permitted in this commit (only
    comment bodies, docstrings, markdown content). Sequence:

    1. Rewrite `reconcile/README.md` end-to-end in domain terms. Anchor every claim to
       the current source (plan.ts populating `pluginsToEnable`; the empty-resources +
       installable disabled marker; the actual 7 files in the directory). NO Phase/Plan
       tables; NO process-history voice. Follow `.claude/rules/typescript-comments.md`
       and the Google Markdown style guide (per ~/.claude/CLAUDE.md). Treat domain-language
       uses of the word "phase" (per typescript-comments.md `## Domain language is not GSD
       history`) as preserved unchanged when they describe code concepts -- but the README
       has none of those; every "Phase" reference there IS GSD history and goes.
    2. Walk D2-D10 in file order; for each, edit ONLY the cited comment span. Verify the
       symbolic-ref replacement actually exists in the target file at the time of edit
       (don't trust the stale numbers in CONTEXT.md; grep the symbol name in the target
       file to confirm).
    3. Walk D11 across all listed sites. KEEP requirement/decision IDs
       (`PRL-NN`, `AUTH-NN`, `DIFF-NN`, `ATTR-NN`, `RECON-NN`, `ENBL-NN`, `SPLIT-NN`,
       `WR-NN`, `CR-NN`, `UAT-NN`, `SNM-NN`, `TYPE-NN`, `SC-N`, `NFR-N`, `D-XX-NN`,
       `Mxx`). STRIP Phase/Plan/Wave/Task IDs and unresolvable Pitfall-N / Pattern-N /
       RESEARCH-* labels. The rule: planning artefact -> strip; specification anchor ->
       keep.
    4. Apply D-MIG comment edit at `persistence/migrate-config.ts:30-33` (current line
       range may have shifted -- locate the contract comment by symbol).
    5. Update CLAUDE.md per S1: add the two claude-plugins paths to the NFR-10 list.
    6. Sanity grep before commit -- confirm NO surviving forbidden tokens in `src/`:
       `grep -RnE '(Phase [0-9]+|Plan [0-9]+|Wave [0-9]+|milestone v[0-9])' src/`
       should return only Domain-language `Phase` (the two-phase-commit narration in
       `bridges/agents/stage.ts`, `phase ledger`, `update phase 3` test fixture
       strings, `#v1.0` URL pins) -- those are explicitly allowed per
       `.claude/rules/typescript-comments.md`. ANY OTHER match is a miss; fix and re-grep.
    7. Run `npm run check` (should be GREEN: comment-only edits don't affect tests).
       Run `pre-commit run --files <changed>`. Commit atomically. Suggested title:
       `docs(pr-51): rewrite reconcile README + scrub planning-artifact comments`.
       (SKIP=trufflehog if in a worktree.)
  </action>
  <verify>
    <automated>npm run check</automated>
  </verify>
  <done>
    - `grep -RnE '(Phase [0-9]+|Plan [0-9]+|Wave [0-9]+)' src/` returns ONLY the
      whitelisted domain-language matches enumerated in
      `.claude/rules/typescript-comments.md` (`bridges/agents/stage.ts` two-phase
      narration; `phase ledger` concept; `update phase 3` fixture strings; URL
      version pins). Every Phase/Plan/Wave reference to GSD planning steps is gone.
    - `reconcile/README.md` is rewritten in domain terms; no Phase/Plan tables; every
      claim checks out against the source (especially: `pluginsToEnable` IS populated;
      no `state.disabled` field; all 7 files listed).
    - `persistence/migrate-config.ts:30-33` contract comment states the silence is
      deliberate (NFR-2) and the result is informational (callers intentionally
      discard); no notify call added.
    - CLAUDE.md NFR-10 enumeration lists `claude-plugins.json` and
      `claude-plugins.local.json` alongside the existing sanctioned write paths.
    - catalog-uat byte gate GREEN; no rendered byte changed (this commit is
      comments/docs only).
    - `npm run check` exit 0; `pre-commit run --files <changed>` GREEN.
    - One atomic Conventional Commit on `features/v1.12-config-files`.
  </done>
</task>

</tasks>

<verification>
End-of-quick-task verification (run after all three commits land):

1. `npm run check` -- typecheck + ESLint + Prettier + full test suite GREEN.
2. Catalog-uat byte gate GREEN (tests/shared/catalog-uat.test.ts).
3. Locked-decision spot checks:
   - Update vs disabled (D-UPD): tests/orchestrators/plugin/update.test.ts has a
     disabled-record seed proving refresh-but-keep-disabled; resources.* stay empty.
   - narrowCascadeFailure (D-NCF): tests/orchestrators/marketplace/remove.test.ts has
     an `AgentsUnstageFailureError` -> `"source mismatch"` alignment test.
   - First-run migration silence (D-MIG): migrate-config.ts:30-33 contract comment
     documents the deliberate silence; no notify call added; no behavior change.
4. NFR-10 (CLAUDE.md) enumerates `claude-plugins.json` and `claude-plugins.local.json`.
5. Comment scrub: `grep -RnE '(Phase [0-9]+|Plan [0-9]+|Wave [0-9]+)' src/` returns
   only the allowed domain-language matches enumerated in
   `.claude/rules/typescript-comments.md`.
6. Three atomic Conventional Commits on `features/v1.12-config-files`, each <=72 char
   titles, body lines <=80 chars, each landed via passing pre-commit hooks.
</verification>

<success_criteria>
- Every finding in `260612-bcs-CONTEXT.md <specifics>` (C1, I1-I6, T1-T6, Y1-Y7,
  D1-D11, S1-S10) is closed by a code change, a comment/doc edit, or a new test --
  per the batching in this plan.
- Every locked decision in `<decisions>` is implemented exactly as written (D-UPD,
  D-NCF, D-MIG).
- `npm run check` GREEN; catalog-uat byte gate GREEN; docs/output-catalog.md moved in
  lockstep ONLY for I1/I2/I5 row changes (Task 1); Tasks 2 and 3 are byte-neutral.
- IL-2 preserved (all user-visible output through notify); IL-3 preserved (exactly
  one sanctioned `console.warn` in migrate.ts); NFR-5 preserved (no new network
  paths); NFR-10 widened with the documented config files (S1); T-53-02-02 preserved
  (basename-only paths in rendered rows -- C1 + I5 specifically tested).
- Three atomic Conventional Commits on `features/v1.12-config-files`; pre-commit
  hooks GREEN on each; `SKIP=trufflehog` prefix used iff committing inside a
  worktree.
</success_criteria>

<output>
Create `.planning/quick/260612-bcs-fix-pr-51-five-agent-review-findings/260612-bcs-SUMMARY.md`
when done, capturing per-finding closure (which commit closed each ID) and any
follow-ups discovered during execution.
</output>
