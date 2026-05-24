---
phase: 14-drift-guard-test-alignment
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/remove.ts
  - tests/orchestrators/plugin/reinstall.test.ts
autonomous: true
requirements:
  - CMC-16

must_haves:
  truths:
    - "When reinstallPlugins catches a ManualRecoveryError on a per-plugin try/catch, the cascade body emitted by renderReinstallPartitionAndNotify is followed by a separate top-level manual-recovery anchor line preceded by a blank line."
    - "The cascade row's `(failed) {rollback partial}` semantics (catalog byte-binding) are preserved unchanged by this plan."
    - "The dead-code `void renderManualRecovery;` seam at `orchestrators/marketplace/remove.ts:96` is removed; either `renderManualRecovery` is no longer imported by that file, or the import is consumed by a real (non-`void`) call path."
    - "`presentation/manual-recovery.ts::renderManualRecovery` is a live (production-consumed) function -- grep finds at least one non-test, non-`void` caller outside `presentation/`."
    - "`npm run check` is green at the wave-1 commit (typecheck + lint + format:check + node:test)."
  artifacts:
    - path: extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts
      provides: "ManualRecoveryLine emission path inside renderReinstallPartitionAndNotify"
      contains: "renderManualRecovery"
    - path: extensions/pi-claude-marketplace/orchestrators/marketplace/remove.ts
      provides: "Dead-code seam removed; either `renderManualRecovery` no longer imported here, or a real caller consumes it."
      contains_not: "void renderManualRecovery"
  key_links:
    - from: extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts
      to: extensions/pi-claude-marketplace/presentation/manual-recovery.ts
      via: "import renderManualRecovery + invocation inside renderReinstallPartitionAndNotify"
      pattern: "renderManualRecovery\\("
    - from: tests/orchestrators/plugin/reinstall.test.ts
      to: extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts
      via: "test asserting a manual-recovery anchor appears after the cascade body on a manual-recovery outcome"
      pattern: "manual recovery|ManualRecovery"
---

<objective>
Close CMC-16 (per audit BLOCKER finding in `.planning/v1.3-MILESTONE-AUDIT.md` lines 19-25) by wiring `presentation/manual-recovery.ts::renderManualRecovery` into production via `orchestrators/plugin/reinstall.ts`. Today's behavior at `reinstall.ts:521-548` correctly tags failure-class `"manual-recovery"` and emits a `(failed) {rollback partial}` cascade row, but loses the separate top-level manual-recovery anchor line MSG-MR-1/MSG-MR-2 mandates. After this plan, when a ManualRecoveryError propagates through `reinstallPlugin`, the cascade body is followed by a separate top-level compact line of the form `⊘ <resource> (manual recovery) {<reasons>}` preceded by a blank line.

Also drop the dead-code `void renderManualRecovery;` seam at `orchestrators/marketplace/remove.ts:96` -- once the production caller exists in reinstall.ts, the remove.ts seam no longer serves the "reachable from this orchestrator if a future deviation surfaces" hedge documented at remove.ts:91-95. Either delete the import + `void` statement entirely, or replace with a real consumption if a remove-side manual-recovery emission path is also required (per RESEARCH.md §Pitfall 5, the recommended path is to delete from remove.ts and centralize the emission in reinstall.ts where the actual ManualRecoveryError surfaces).

Purpose: Close audit BLOCKER CMC-16; restore the MSG-MR-1 / MSG-MR-2 contract on the only production ManualRecoveryError-catching surface; satisfy the v1.3 milestone-gate property "no orphan composer in `presentation/`". Per D-14-02 (LOCKED).
Output: Reinstall orchestrator emits a separate manual-recovery anchor line on manual-recovery failure-class outcomes; remove.ts seam removed; test coverage proves the structural shape.
</objective>

<execution_context>
@/home/acolomba/pi-claude-marketplace/.claude/get-shit-done/workflows/execute-plan.md
@/home/acolomba/pi-claude-marketplace/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/ROADMAP.md
@.planning/phases/14-drift-guard-test-alignment/14-CONTEXT.md
@.planning/phases/14-drift-guard-test-alignment/14-RESEARCH.md
@.planning/v1.3-MILESTONE-AUDIT.md
@docs/messaging-style-guide.md
@extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts
@extensions/pi-claude-marketplace/orchestrators/marketplace/remove.ts
@extensions/pi-claude-marketplace/presentation/manual-recovery.ts
@extensions/pi-claude-marketplace/presentation/compact-line.ts

<interfaces>
<!-- Key contracts the executor needs. Extracted from codebase. -->

From extensions/pi-claude-marketplace/presentation/compact-line.ts:
- `interface ManualRecoveryLine { readonly kind: "manual-recovery"; readonly resource: string; readonly reasons: readonly Reason[]; readonly orphanDetails?: readonly string[]; }`
- `type RowSpec = PluginInlineRow | PluginInlineUninstalledRow | PluginCascadeRow | PluginListRow | MarketplaceRow | EmptyToken | ManualRecoveryLine | RollbackChild | EntityErrorRow;`
- `function renderRow(row: RowSpec, probe: SoftDepProbe): string`

From extensions/pi-claude-marketplace/presentation/manual-recovery.ts:
- `export function renderManualRecovery(line: ManualRecoveryLine, probe: SoftDepProbe): string`  (caller composes blank-line separator above the returned string)

From extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts (current):
- `function renderReinstallPartitionAndNotify(ctx, pi, outcomes): void`  at lines 416-483 (this is where the emission belongs per RESEARCH.md §Pitfall 5)
- `function outcomeToCascadeRow(outcome): PluginCascadeRow`  at lines 498-554 (preserves `(failed) {rollback partial}` shape -- UNCHANGED by this plan)
- `failureClass: "manual-recovery"` is already tagged in reinstallPlugin (line 201) and reinstallPlugins (line 278) catch blocks. This plan consumes that tag -- does NOT change the tagging.

From extensions/pi-claude-marketplace/orchestrators/marketplace/remove.ts:
- Line 73 imports `renderManualRecovery` from `../../presentation/manual-recovery.ts`
- Lines 91-96 carry the `void renderManualRecovery;` dead-code seam with documented hedge

Reason literal constraints (from shared/grammar/reasons.ts):
- `"rollback partial"` is the canonical Reason for a failed-with-rollback-partial outcome; this is the closed-set token MSG-MR-1 expects for the anchor's `{reasons}` slot in this case.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Wire ManualRecoveryLine emission inside renderReinstallPartitionAndNotify</name>
  <files>extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts</files>
  <read_first>
    - extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts (focus lines 416-483 renderReinstallPartitionAndNotify; lines 498-554 outcomeToCascadeRow; lines 180-205 + 267-282 where failureClass:"manual-recovery" is tagged)
    - extensions/pi-claude-marketplace/presentation/manual-recovery.ts (the existing composer; signature `renderManualRecovery(line: ManualRecoveryLine, probe: SoftDepProbe): string`)
    - extensions/pi-claude-marketplace/presentation/compact-line.ts (focus lines 200-260: ManualRecoveryLine interface; RowSpec union; renderRow signature)
    - .planning/phases/14-drift-guard-test-alignment/14-RESEARCH.md §Pitfall 5 (Where in the pipeline?)
    - .planning/phases/14-drift-guard-test-alignment/14-RESEARCH.md "Code Examples" subsection on reinstall.ts ManualRecoveryLine emission (NEW)
    - docs/messaging-style-guide.md §7 (MSG-MR-1 / MSG-MR-2 contract)
  </read_first>
  <action>
    Implements D-14-02 (CMC-16 closure) per RESEARCH.md §Pitfall 5 recommendation: emit the ManualRecoveryLine SEPARATELY from `renderReinstallPartitionAndNotify` (lines 416-483) AFTER composing the cascade body, NOT from inside `outcomeToCascadeRow`. The cascade row's `(failed) {rollback partial}` shape (lines 521-548) MUST remain unchanged -- catalog byte-binding at docs/output-catalog.md depends on it.

    Sequence inside `renderReinstallPartitionAndNotify`:
    1. After existing cascade body composition (line 474 `const body = bodySegments.join("\n\n");`) and before computing the reload hint, walk `outcomes` for any whose `failureClass === "manual-recovery"`.
    2. For each such outcome, construct a `ManualRecoveryLine`:
       - `kind: "manual-recovery" as const`
       - `resource: ` the canonical resource label for the failure (per MSG-MR-2 system-level form). For a reinstall manual-recovery failure the per-plugin context IS available here (the outcome carries `name`, `marketplace`, `scope`). Per MSG-MR-2, manual-recovery anchors do NOT carry `@<marketplace>` or `[<scope>]` (the interface enforces this -- `ManualRecoveryLine` has no marketplace/scope fields), so collapse to `${o.name}@${o.marketplace}` as the resource label. (NOTE: this `name@marketplace` composition is acceptable inside the `resource` string slot because `resource: string` is free-form per the ManualRecoveryLine contract; the `@<marketplace>` carve-out only restricts SCHEMA fields, not free-form resource names.)
       - `reasons: Object.freeze(["rollback partial" as const])` (matches the per-row Reason already set on the cascade row by outcomeToCascadeRow lines 533-536; the cause chain renders separately via the notify boundary so no additional detail is needed in this slot)
    3. Call `renderManualRecovery(line, probe)` for each anchor; join multiple anchors with `\n\n` (each anchor is its own top-level compact line per MSG-MR-1).
    4. Compose the final body: `manualRecoveryLines.length === 0 ? body : ${body}\n\n${manualRecoveryLines.join("\n\n")}`. The `\n\n` separator BEFORE the first anchor satisfies MSG-MR-1's blank-line discipline.
    5. Existing reload-hint composition (`appendReloadHint(body, hint)`) consumes the new `composedBody` instead of `body`.
    6. Severity dispatch unchanged: `aggregatedSeverity === "warning" ? notifyWarning : notifySuccess` -- `notifyError` MUST NOT be used (MSG-SR-6 forbids cascade notifyError; the manual-recovery anchor co-exists with the warning-severity cascade summary per CMC-15 / MSG-RH-1 dual-trailer pattern).

    Type narrowing: the filter callback needs a type guard like `(o): o is ReinstallFailedOutcome & { failureClass: "manual-recovery" }` -- inspect the outcome union type in reinstall.ts to match the existing `ReinstallFailedOutcome` shape (the file already exports a `ReinstallPluginOutcome` discriminated union with `partition` discriminator; the `failureClass` is an optional field on the `failed` variant per lines 201-203). Define this guard inline or hoist as a small helper.

    Layering check (NFR-7 + D-11): `orchestrators/plugin/reinstall.ts` is already allowed to import from `presentation/` via `eslint.config.js` BLOCK C. The new emission path adds an import of `renderManualRecovery` from `../../presentation/manual-recovery.ts` (already in the project's import-path conventions -- see remove.ts:73 for the exact path shape). The cascade-row `(failed) {rollback partial}` shape is unchanged -- this plan only ADDS the separate top-level anchor.

    NEVER place fenced code blocks in this action; the read_first artifacts contain the templates. Implementation follows RESEARCH.md's sketch verbatim except the resource label slot uses `${o.name}@${o.marketplace}` per the discussion above.
  </action>
  <behavior>
    - When `outcomes` contains zero entries with `failureClass === "manual-recovery"`: rendered body is unchanged from today (preserves byte-equality with current behavior for non-manual-recovery cascades).
    - When `outcomes` contains one entry with `failureClass === "manual-recovery"`: rendered body is `${cascadeBody}\n\n${renderManualRecovery({kind:"manual-recovery", resource: "<name>@<marketplace>", reasons: ["rollback partial"]}, probe)}` followed by the existing reload-hint trailer composition.
    - When `outcomes` contains multiple manual-recovery entries: anchors are joined by `\n\n` so each occupies its own top-level compact line (MSG-MR-1).
    - Severity dispatch is unchanged: any (failed) row already yields `notifyWarning`; manual-recovery anchor inherits that.
    - The existing cascade-row `(failed) {rollback partial}` text for the same outcomes is PRESERVED unchanged (preserves catalog byte-binding).
  </behavior>
  <verify>
    <automated>
      cd /home/acolomba/pi-claude-marketplace
      npm run typecheck 2>&1 | tail -20
      # Confirms ManualRecoveryLine emission compiles with the type guard.
      # Then a focused grep proves the emission path exists:
      grep -nE 'renderManualRecovery\(|"manual-recovery"' extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts | grep -v '^[^:]*:.*//' | head -10
      # Expect: at least 1 import line + 1 invocation of renderManualRecovery + the kind:"manual-recovery" literal in the new ManualRecoveryLine construction.
    </automated>
  </verify>
  <done>
    1. `extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts` imports `renderManualRecovery` from `../../presentation/manual-recovery.ts`.
    2. `renderReinstallPartitionAndNotify` contains a filter over `outcomes` selecting `failureClass === "manual-recovery"` entries and emits ManualRecoveryLine anchors via `renderManualRecovery(line, probe)`.
    3. The cascade body composition path stays unchanged for non-manual-recovery cascades (byte-equal output).
    4. `npm run typecheck` is green.
    5. No new ESLint failures introduced (`npm run lint` no new errors on this file).
  </done>
</task>

<task type="auto">
  <name>Task 2: Drop dead-code `void renderManualRecovery;` seam from orchestrators/marketplace/remove.ts</name>
  <files>extensions/pi-claude-marketplace/orchestrators/marketplace/remove.ts</files>
  <read_first>
    - extensions/pi-claude-marketplace/orchestrators/marketplace/remove.ts (focus lines 73 import and lines 91-96 dead-code seam + comment)
    - .planning/v1.3-MILESTONE-AUDIT.md lines 19-25 (CMC-16 evidence for the dead-code seam)
    - .planning/phases/14-drift-guard-test-alignment/14-CONTEXT.md D-14-02 (LOCKED) decision text
    - .planning/phases/14-drift-guard-test-alignment/14-RESEARCH.md §Pitfall 5 (recommended location for the manual-recovery emission)
  </read_first>
  <action>
    Implements D-14-02 final sub-clause: remove the dead-code `void renderManualRecovery;` seam from `orchestrators/marketplace/remove.ts`. Per RESEARCH.md §Pitfall 5, the canonical manual-recovery emission lives in `reinstall.ts` (Task 1 above); the remove.ts hedge "reachable from this orchestrator if a future deviation surfaces" is no longer needed.

    Concrete edits to remove.ts:
    1. Delete line 73's import of `renderManualRecovery` from `../../presentation/manual-recovery.ts` IF and only if no other call site in remove.ts uses it (`grep -n renderManualRecovery extensions/pi-claude-marketplace/orchestrators/marketplace/remove.ts` returns only the import + the line 96 `void` statement after Task 1's changes -- confirm before deleting).
    2. Delete lines 91-96 (the 5-line `// 'renderManualRecovery' is imported above so manual-recovery emission ...` comment block plus the `void renderManualRecovery;` statement).
    3. If grep finds any OTHER caller of `renderManualRecovery` inside remove.ts (e.g. a future Wave 1 edit added one elsewhere), STOP and report to the developer -- do NOT delete the import; remove only the `void` statement and the explanatory comment.

    Verify lint+typecheck still green after the deletion: `eslint-plugin-import-x` may have considered the import as resolved via the `void` consumption; removing both at once keeps the unused-import rule happy.
  </action>
  <verify>
    <automated>
      cd /home/acolomba/pi-claude-marketplace
      grep -c 'void renderManualRecovery' extensions/pi-claude-marketplace/orchestrators/marketplace/remove.ts
      # Expect: 0
      grep -c 'renderManualRecovery' extensions/pi-claude-marketplace/orchestrators/marketplace/remove.ts
      # Expect: 0 (no remaining references -- import + void both gone)
      npm run lint 2>&1 | grep -i 'remove.ts' | head -5
      # Expect: empty (no new lint failures on remove.ts)
      npm run typecheck 2>&1 | tail -5
      # Expect: success
    </automated>
  </verify>
  <done>
    1. `grep -c 'void renderManualRecovery' extensions/pi-claude-marketplace/orchestrators/marketplace/remove.ts` returns 0.
    2. `grep -c 'renderManualRecovery' extensions/pi-claude-marketplace/orchestrators/marketplace/remove.ts` returns 0 (or, if a real new caller emerged, only that caller -- but the `void` statement is gone).
    3. `npm run lint` and `npm run typecheck` both green.
    4. The 5-line `// 'renderManualRecovery' is imported above ...` comment block (lines 91-95 of the original file) is removed.
  </done>
</task>

<task type="auto">
  <name>Task 3: Cover the new emission path with a reinstall.test.ts assertion + run full check</name>
  <files>tests/orchestrators/plugin/reinstall.test.ts</files>
  <read_first>
    - tests/orchestrators/plugin/reinstall.test.ts (use the file as it stands; search for an existing `failureClass: "manual-recovery"` fixture -- there is at least one existing __test_outcomeToCascadeRow regression that pins the cascade-row mapping; the NEW test asserts the SEPARATE anchor line co-exists with that mapping)
    - extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts (after Task 1 changes -- to know the exact emission path)
    - extensions/pi-claude-marketplace/presentation/manual-recovery.ts (signature for what the anchor renders as)
    - docs/messaging-style-guide.md §7 (MSG-MR-1 / MSG-MR-2 -- what the anchor line MUST look like)
  </read_first>
  <action>
    Add ONE focused test case (or extend an existing manual-recovery test) that exercises `reinstallPlugins` (or `renderReinstallPartitionAndNotify` directly if a test seam exists) against a synthetic outcome list containing a `failureClass: "manual-recovery"` entry, captures the notify body, and asserts:

    1. The body contains the cascade `(failed) {rollback partial}` text for the failed row (preserves existing byte-binding).
    2. The body ALSO contains a SEPARATE line of the form `⊘ <name>@<marketplace> (manual recovery) {rollback partial}` (MSG-MR-1 anchor shape -- extract the exact `⊘` icon and grammar from the existing renderRow output by calling `renderRow({kind:"manual-recovery", resource: "<name>@<marketplace>", reasons:["rollback partial"]}, probe)` from the test, not by hand-composing the expected string -- this preserves the contract through the renderer).
    3. The anchor line is preceded by `\n\n` separating it from the cascade body (MSG-MR-1 blank-line discipline).
    4. The reload-hint trailer composition is unaffected (severity routing still warning, hint still appended where applicable).

    If the existing test file uses a notify-capture helper (look for `notify.captures` / `recordNotify` / `mockNotify` pattern in adjacent tests), reuse it. If not, the test can call `renderReinstallPartitionAndNotify` directly through a ctx whose `ui.notify` records the body string into a captured array, then assert against the captured string.

    Discovery point: the existing test file may already have ONE test covering the cascade-row mapping (`outcomeToCascadeRow` regression test mentioned in reinstall.ts comments). If so, ADD a sibling test for the anchor emission rather than modifying that test. Name it clearly: `"D-14-02 / CMC-16: manual-recovery outcome emits separate top-level anchor line below cascade body"`.

    Do NOT introduce new test fixtures or scaffolding; reuse the existing patterns from neighboring tests.
  </action>
  <verify>
    <automated>
      cd /home/acolomba/pi-claude-marketplace
      node --test tests/orchestrators/plugin/reinstall.test.ts 2>&1 | tail -20
      # Expect: new test passes; no existing test fails.
      npm run check 2>&1 | tail -10
      # Expect: SUCCESS (NFR-6 milestone gate per D-14-03)
    </automated>
  </verify>
  <done>
    1. `tests/orchestrators/plugin/reinstall.test.ts` contains a new test named `"D-14-02 / CMC-16: manual-recovery outcome emits separate top-level anchor line below cascade body"` (or equivalent) that captures the notify body for a manual-recovery outcome and asserts both the cascade row and the separate anchor co-exist with `\n\n` between them.
    2. `node --test tests/orchestrators/plugin/reinstall.test.ts` passes.
    3. `npm run check` is green at the wave-1 commit.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| (none new in Phase 14) | This plan modifies internal orchestrator emission and removes dead code; no new untrusted-input boundary is introduced |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-14-01 | Information | reinstall.ts manual-recovery anchor | accept | The anchor's `resource` slot uses `${name}@${marketplace}` -- same content the cascade row already exposes; no new info leak. Cause-chain trailer still bounded to depth 5 by notifyError per Phase 13 / T-13-04 mitigation (no change). |
| T-14-02 | Tampering | renderManualRecovery import added to reinstall.ts | mitigate | Import flows through the established `../../presentation/` path; ESLint BLOCK C zone enforces orchestrators/ → presentation/ direction. No new path containment risk (no file I/O touched). |
</threat_model>

<verification>
- `npm run check` green at the Plan 01 commit (typecheck + lint + format:check + node:test).
- `grep -c 'renderManualRecovery' extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts` returns ≥1 (production caller exists).
- `grep -c 'void renderManualRecovery' extensions/pi-claude-marketplace/orchestrators/marketplace/remove.ts` returns 0 (dead-code seam removed).
- `node --test tests/orchestrators/plugin/reinstall.test.ts` passes including the new MSG-MR-1 anchor assertion.
- Existing `outcomeToCascadeRow` regression (the `__test_outcomeToCascadeRow` binding test) still asserts the `(failed) {rollback partial}` cascade row shape -- that shape is PRESERVED by this plan.
</verification>

<success_criteria>
1. CMC-16 audit BLOCKER closed: `renderManualRecovery` has at least one production caller in `orchestrators/`.
2. Dead-code `void renderManualRecovery;` seam removed from `orchestrators/marketplace/remove.ts`.
3. Reinstall test suite asserts the new separate-anchor emission path on manual-recovery outcomes.
4. `npm run check` is green; no regression in Phase 12/13 byte-binding tests (catalog UAT, grammar-frontmatter).
</success_criteria>

<output>
Create `.planning/phases/14-drift-guard-test-alignment/14-01-SUMMARY.md` when done.
</output>
