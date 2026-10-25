---
phase: 29-load-converges-on-the-catalog
plan: 05
subsystem: notifications
tags: [apply, reload-hint, reconcile, missing-dependency, output-catalog, json-output, cucumber]

requires:
  - phase: 29-load-converges-on-the-catalog
    provides: "29-02: apply.ts serves only the apply verb; load.ts owns the load; openScopePass carries the MCP move"
  - phase: 29-load-converges-on-the-catalog
    provides: "29-04: an empty apply reports `Apply: nothing to change.`"
provides:
  - "shouldEmitReloadHint answers the RLD-02 row OR-reduce for reconcile-applied-cascade through the private rowsNeedReload helper, shared with the cascade path"
  - "`/claude:plugin apply` ends with `/reload to pick up changes` when a row stamps a reload; failure-only and warning-only reports carry none"
  - "ApplyReconcileOptions, McpMigrationInput and ScopePassInput no longer carry `reason`"
  - "applyDependencyInstalls runs on every apply; the MCP move's plannedInstall counts pluginsToDependencyInstall unconditionally (D-22)"
  - "docs/output-catalog.md reconcile-applied-cascade section: new intro, the trailer on 15 states, headings that name apply; EXPECTED_UTF8_BYTES = 51_025"
affects: [29-06, 29-07, 29-08, apply, load, notifications, output-catalog]

actuals:
  tokens: 34000
  tasks: 2
  commits: 2
plan_head_before: cc66b0791169b2670445107861e3a65cb2df1b2d
plan_head_after: 4068f2168d363ec6d8ea1e75408f954ca71d6011

tech-stack:
  added: []
  patterns:
    - "A standalone kind that carries rows answers the reload question from its rows, as the cascade arm does"

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/shared/notification-summary.ts
    - extensions/pi-claude-marketplace/shared/notification-resolve.ts
    - extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts
    - extensions/pi-claude-marketplace/orchestrators/reconcile/types.ts
    - extensions/pi-claude-marketplace/orchestrators/reconcile/mcp-migration.ts
    - extensions/pi-claude-marketplace/orchestrators/reconcile/read-pass.ts
    - extensions/pi-claude-marketplace/orchestrators/reconcile/README.md
    - test/shared/notification-summary.test.ts
    - test/shared/notification-dispatch.test.ts
    - test/shared/notification-present.test.ts
    - test/shared/notification-resolve.test.ts
    - test/architecture/notify-grammar-invariant.test.ts
    - test/architecture/catalog-uat/catalog-contract.test.ts
    - test/orchestrators/reconcile/apply.test.ts
    - test/orchestrators/reconcile/load.test.ts
    - test/orchestrators/reconcile/mcp-migration.test.ts
    - test/orchestrators/reconcile/read-pass.test.ts
    - test/orchestrators/reconcile/types.test.ts
    - test/integration/mcp-migration.test.ts
    - test/integration/plugin-layer-consistency.test.ts
    - test/integration/reserved-record-keys.test.ts
    - docs/output-catalog.md
    - docs/json-output.md
    - features/plugin/apply.feature

key-decisions:
  - "The reconcile-applied-cascade arm of shouldEmitReloadHint returns rowsNeedReload(message.marketplaces), the same OR-reduce the cascade path uses, so the trailer comes from row stamps only (RLD-02, D-08)"
  - "Test fixtures that stamped needsReload:true on a failed row were changed to false, because a failed row changes nothing the session must load; the failure-only cases now prove the absent trailer"
  - "The old startup-versus-omitted D-09-13 pair was deleted; the existing MISS-01 case, which already ran a plain apply over an installable dependency, now proves the every-run install and is renamed for it"
  - "Tests whose fixture holds a dependency its marketplace does not list now expect that dependency's `{not in manifest}` failed row beside the dependency-disable row, because every apply tries the install (D-02, D-09-14)"

patterns-established:
  - "A test that drives apply over a missing dependency the marketplace does not list expects the dependency's failed row; once the dependent is down, the failed row is the whole report (SECRETS_VAULT_NOT_IN_MANIFEST in apply.test.ts)"

requirements-completed: []

coverage:
  - id: D1
    description: "apply's report ends with `/reload to pick up changes` when a row changed something, and carries no trailer when its rows only failed or warned"
    requirement: APL-01
    verification:
      - kind: unit
        ref: "test/shared/notification-summary.test.ts#D-08: an apply report with a realized row requests reload"
        status: pass
      - kind: unit
        ref: "test/shared/notification-summary.test.ts#D-08: an apply report whose rows only failed or warned requests no reload"
        status: pass
      - kind: unit
        ref: "test/shared/notification-dispatch.test.ts#D-08: an apply report with a realized row ends with the reload trailer"
        status: pass
      - kind: unit
        ref: "test/shared/notification-dispatch.test.ts#D-08: an apply report with only failed rows carries no reload trailer"
        status: pass
      - kind: e2e
        ref: "features/plugin/apply.feature (8 scenarios read `needs reload | true`; the failure-only and empty scenarios keep false)"
        status: pass
    human_judgment: false
  - id: D2
    description: "apply installs a recorded plugin's missing declared dependency on every run, and the dependent stays enabled"
    requirement: APL-01
    verification:
      - kind: unit
        ref: "test/orchestrators/reconcile/apply.test.ts#MISS-01 / D-02: a plain apply installs a missing declared dependency and the dependent stays enabled"
        status: pass
      - kind: unit
        ref: "test/orchestrators/reconcile/apply.test.ts#LOAD-02 / D-09-14: a second apply over an unchanged unsatisfied tree plans the retry bucket and retries the install"
        status: pass
    human_judgment: false
  - id: D3
    description: "The MCP move skips an owner the plan installs as a missing dependency, with no reason given"
    requirement: APL-01
    verification:
      - kind: unit
        ref: "test/orchestrators/reconcile/mcp-migration.test.ts#AMIG-04: an owner the plan installs as a missing dependency with no record here gets 0 unowned row(s) and no write"
        status: pass
    human_judgment: false
  - id: D4
    description: "The catalog and the JSON reference describe the apply report and its trailer"
    requirement: APL-01
    verification:
      - kind: unit
        ref: "test/architecture/catalog-uat/catalog-contract.test.ts"
        status: pass
      - kind: unit
        ref: "test/architecture/json-output-docs.test.ts"
        status: pass
    human_judgment: false

duration: 40min
completed: 2026-10-24
status: complete
---

# Phase 29 Plan 05: Apply Ends With the Reload Hint and Installs Missing Dependencies Summary

**`/claude:plugin apply` now ends with `/reload to pick up changes` whenever one of its rows changed something, and it installs a recorded plugin's missing declared dependency on every run. The `reason` option that limited that install to a `/reload` event is gone.**

## Performance

- **Duration:** 40 min
- **Started:** 2026-10-24T16:19:16Z
- **Completed:** 2026-10-24T16:59:26Z
- **Tasks:** 2
- **Files modified:** 24

## Accomplishments

- `notification-summary.ts`: a private `rowsNeedReload(marketplaces)` holds the RLD-02 OR-reduce. The `reconcile-applied-cascade` arm of `shouldEmitReloadHint` and the cascade path both call it. The RECON-04 kind exclusion and its comment are gone.
- The trailer follows the tally on every apply report with an installed, uninstalled, enabled, disabled, dependency-disabled or backfilled row. A report of failed or warning rows alone has none. The load only emits this kind for its read-pass rows and per-session warnings, which stamp `needsReload: false`.
- `apply.ts`: `applyDependencyInstalls` lost its `opts.reason !== "reload"` gate. The module header and the step-5 doc comment say that every apply runs it (D-02 supersedes D-09-13).
- `types.ts`, `read-pass.ts`, `mcp-migration.ts`: `reason` left `ApplyReconcileOptions`, `McpMigrationInput` and `ScopePassInput`. `plannedInstall` counts `pluginsToDependencyInstall` unconditionally (D-22). Two unused `ResourcesDiscoverEvent` imports were dropped.
- `docs/output-catalog.md`: new section intro; the trailer on 15 states; prose that said "no reload-hint" or "structurally excluded" now names the trailer; the headings name `apply` (or "Load or apply" for the two per-session warnings); MISS-01, MISS-02 and the foreign-dependency state name `apply` as the command that installs and retries. `EXPECTED_UTF8_BYTES` = 51_025 (15 x 28 bytes).
- `docs/json-output.md`: the kind reads "The changes `/claude:plugin apply` made, or a load's per-session warnings. `needsReload` is true when a change needs a reload."
- `features/plugin/apply.feature`: 8 scenarios now read `needs reload | true`. The partial-support failure, the empty apply and the git-source failure-only scenarios keep `false`.

## Task Commits

1. **Task 1: End-to-end apply report ends with the reload trailer** - `52c64f1b` (feat). Tracer gate: the full `<verify>` chain re-ran green after the commit.
2. **Task 2: `apply` installs missing dependencies on every run** - `4068f216` (feat)

## Decisions Made

See `key-decisions` in the frontmatter. In short: the trailer comes from row stamps only; failed rows in test fixtures stamp `false`, as production stamps them; the existing MISS-01 case carries the every-run proof; and the tests with an unlisted dependency now expect its failed row.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Tests outside the plan's list asserted the old kind exclusion**
- **Found during:** Task 1
- **Issue:** `test/architecture/notify-grammar-invariant.test.ts` asserted that a `reconcile-applied-cascade` never carries the trailer, and its subject-first check read the trailer line as a row. `test/shared/notification-present.test.ts` and `test/shared/notification-resolve.test.ts` expected `needsReload: false` on applied envelopes with an installed row.
- **Fix:** The invariant test now asserts the trailer ends each realized-row fixture and strips it before the row check. The present and resolve cases expect `needsReload: true` and their titles say so.
- **Committed in:** 52c64f1b

**2. [Rule 1 - Bug] Stale doc comment in notification-resolve.ts**
- **Found during:** Task 1
- **Issue:** `resolveEnvelope`'s comment said `needsReload` is false for every standalone kind. That was already false for the committed prune warning and became false for the applied cascade.
- **Fix:** The comment names both exceptions.
- **Committed in:** 52c64f1b

**3. [Rule 1 - Bug] A path-leak assertion read the trailer as a path**
- **Found during:** Task 1
- **Issue:** The MISS-02 closure-failure case asserted that its message holds no `/`. The trailer `/reload to pick up changes` now ends that message.
- **Fix:** The assertion strips the trailer block first, so it still checks the body for leaked paths.
- **Committed in:** 52c64f1b

**4. [Rule 3 - Blocking] load.test.ts recorded the removed `reason`**
- **Found during:** Task 2 (typecheck)
- **Issue:** `test/orchestrators/reconcile/load.test.ts` (not in the plan's list) read `input.reason` in its recording MCP move.
- **Fix:** It records scope, cwd and installs only.
- **Committed in:** 4068f216

**5. [Rule 1 - Bug] Stale D-09-13 text in the reconcile README**
- **Found during:** Task 2
- **Issue:** `orchestrators/reconcile/README.md` said the dependency install runs only on reload.
- **Fix:** It says the install runs on every apply (D-02 supersedes D-09-13).
- **Committed in:** 4068f216

**6. [Rule 1 - Behavior follow-on] Expectations that depended on the reason gate**
- **Found during:** Task 2
- **Issue:** Seven `apply.test.ts` cases (LOAD-01 x2, CR-01, D-06-02, LOAD-02 x2, and the AFILE-04 dependency disable) used a dependency that the marketplace does not list and passed no reason, so the install never ran. Every apply now tries it. The LOAD-03 still-declared case reinstalls the uninstalled dependency on its second pass instead of holding the dependent down.
- **Fix:** Those cases now also expect the dependency's `(failed) {not in manifest}` row and the matching header, tally and severity. The two second-pass cases expect `SECRETS_VAULT_NOT_IN_MANIFEST` instead of `Apply: nothing to change.`. The LOAD-03 case expects the `{dependency installed}` row on pass 2 and asserts that `keeper` stays enabled. Titles that named "reload" in the dependency-install section now name "apply".
- **Committed in:** 4068f216

---

**Total deviations:** 6 auto-fixed (2 blocking, 3 bug, 1 behavior follow-on)
**Impact on plan:** All of them follow from the two behavior changes the plan asked for. No scope creep.

## Issues Encountered

None.

## Notes for Later Plans

- Every apply report with a realized row now ends with `\n\n/reload to pick up changes`. A test that drives `createApplyReconcile` over a change needs it. The JSON payload carries `needsReload: true`.
- 29-04's known gap is closed: a plan with only `pluginsToDependencyInstall` now installs (or reports the failure row), so `pending` and `apply` agree on that bucket.
- A dependency that its marketplace does not list now yields a `(failed) {not in manifest}` row on every apply, beside the dependent's disable row on the first pass and alone on later passes (D-09-14).
- The `/claude:plugin apply` empty advisory is untouched. The empty branch in `applyReconcileWithReader` is still the one place that reports "nothing to change".

## Verification

- Task 1 `<verify>`: the owner tests (summary, dispatch, apply, enable-disable, install-flow, catalog-contract, catalog-wire, notify-will-reload-agreement) passed. Direct coverage of `notification-summary.ts` and `notification-resolve.ts` passed at 100%. `npm run test:integration` exit 0. `npx cucumber-js features/plugin/apply.feature features/plugin/git-source.feature` 29/29. The tracer gate re-ran the whole chain after the commit: exit 0.
- Task 2 `<verify>`: apply, mcp-migration, read-pass, types and load tests passed (210). Direct coverage passed at 100% for `reconcile/apply.ts`, `mcp-migration.ts`, `read-pass.ts`, `types.ts`, and `load.ts`. `npm run typecheck` exit 0. `npm run test:integration` exit 0. The full cucumber suite gave 775/775.
- Acceptance: `rowsNeedReload` 3 in notification-summary.ts; `| needs reload *| true` 8 in apply.feature; `opts.reason` 0 in apply.ts; `input.reason` 0 in mcp-migration.ts.
- Both commit hooks ran `npm run check:commit`: Passed.
- No file under `~/.pi/agent` changed during the run.
- Full `npm run check` after the last task commit (4068f216, Node v26.12.1): **exit 0**. Log tail:

```text
passed typecheck (11.6 s)
passed lint (4.4 s)
passed lint:workflows (0.4 s)
passed fallow (5.6 s)
passed format:check (8.1 s)
passed test:corresponding (3.8 s)
passed check:features (3.3 s)
16 hooks (16 passed)
775 scenarios (775 passed)
7398 steps (7398 passed)
Merged LCOV: coverage/direct.lcov (284 records)
```

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- 29-08's load block can rely on the load staying trailer-free: its rows stamp `needsReload: false`, and `rowsNeedReload` reads only stamps.
- A catalog-move (`will update`) bucket added later reaches the trailer through its rows' stamps. Nothing here needs a kind change.

## Self-Check: PASSED

- Commits 52c64f1b and 4068f216 are ancestors of HEAD.
- Every modified file listed above exists.

---
*Phase: 29-load-converges-on-the-catalog*
*Completed: 2026-10-24*
