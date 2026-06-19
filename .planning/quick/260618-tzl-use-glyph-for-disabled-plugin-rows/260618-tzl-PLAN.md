---
phase: quick-260618-tzl
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - extensions/pi-claude-marketplace/shared/notify.ts
  - tests/architecture/notify-grammar-invariant.test.ts
  - tests/orchestrators/plugin/enable-disable.test.ts
  - tests/orchestrators/plugin/list.test.ts
  - tests/orchestrators/plugin/info.test.ts
  - tests/shared/notify-v2.test.ts
  - docs/output-catalog.md
autonomous: true
requirements:
  - D-54-01
  - ENBL-04
  - UAT-03

must_haves:
  truths:
    - "(disabled) realized plugin row renders with U+25CC `◌` instead of U+2298 `⊘`."
    - "(will disable) pending-tense plugin row renders with U+25CC `◌` instead of U+2298 `⊘`."
    - "(unavailable), (failed), (skipped) {already disabled}, and (manual recovery) plugin rows still render with U+2298 `⊘` (unchanged)."
    - "`npm run check` is green for the files touched by this change (the pre-existing unstaged docs/hooks.md edit is not staged)."
  artifacts:
    - path: extensions/pi-claude-marketplace/shared/notify.ts
      provides: "ICON_DISABLED constant plus updated render-arm bindings for (disabled) and (will disable)."
      contains: "ICON_DISABLED"
    - path: docs/output-catalog.md
      provides: "Legend, row map, and rendered examples updated to show ◌ for the two disabled-class rows."
      contains: "◌"
  key_links:
    - from: extensions/pi-claude-marketplace/shared/notify.ts
      to: "(disabled) and (will disable) render arms"
      via: "ICON_DISABLED constant referenced by both arms"
      pattern: "ICON_DISABLED"
    - from: tests/architecture/notify-grammar-invariant.test.ts
      to: extensions/pi-claude-marketplace/shared/notify.ts
      via: "regex byte-form invariant for the (disabled) row asserting `◌` as the leading glyph"
      pattern: "◌.*\\(disabled\\)"
---

<objective>
Split the disabled-class plugin row glyph out of `ICON_UNINSTALLABLE`. The realized
`(disabled)` row and the pending-tense `(will disable)` row both move from
`⊘` (U+2298 CIRCLED DIVISION SLASH) to `◌` (U+25CC DOTTED CIRCLE). The
prohibited-symbol glyph `⊘` continues to mark error / blocked states
(`(unavailable)`, `(failed)`, `(skipped) {already disabled}`,
`(manual recovery)`). This matches the realized + pending-tense precedent
already in the grammar (`●` for both `(installed)` and `(will add)`; `○` for
both `(available)` and `(will remove)`).

Purpose: a deliberate, user-requested `(disabled)` state is not a failure
state and should not share a glyph with `(failed)` / `(unavailable)` /
`(manual recovery)`. The new `◌` makes the disabled-class row visually
distinct on output surfaces (list, info, disable cascade, pending diff).

Output: source change (one new constant, two render-arm switches, comment
fix-ups), test updates (regex + byte-equality assertions), and doc updates
(legend, row map, rendered examples). One feature-branch commit (or a
two-commit split source+tests / docs if the executor prefers); no merge.
</objective>

<execution_context>
@$HOME/.claude/gsd-core/workflows/execute-plan.md
</execution_context>

<context>
@CLAUDE.md
@.claude/rules/typescript-comments.md
@extensions/pi-claude-marketplace/shared/notify.ts
@docs/output-catalog.md
@tests/architecture/notify-grammar-invariant.test.ts
@tests/orchestrators/plugin/enable-disable.test.ts
@tests/orchestrators/plugin/list.test.ts
@tests/orchestrators/plugin/info.test.ts
@tests/shared/notify-v2.test.ts
</context>

<tasks>

<task type="auto">
  <name>Task 1: Introduce ICON_DISABLED and rewire the two disabled-class render arms in notify.ts</name>
  <files>extensions/pi-claude-marketplace/shared/notify.ts</files>
  <action>
    In `extensions/pi-claude-marketplace/shared/notify.ts`:

    1. Add a new module-private glyph constant `ICON_DISABLED = "◌"` immediately
       below `ICON_UNINSTALLABLE` at line ~1326. Keep the existing
       `Grammar icon literals.` jsdoc the same; add a brief inline jsdoc on
       `ICON_DISABLED` describing its closed-set role: it marks the
       deliberate, user-requested disabled-class rows (`(disabled)` and
       `(will disable)`), distinct from `⊘`'s error / blocked-state role.
       STRICT comment policy applies — no `Phase NN` / `Plan NN` / `Wave N` /
       `Pitfall N` / `milestone vX.Y` references in the new comment.
       Decision IDs (`D-54-01`) and requirement IDs (`ENBL-04`) are allowed
       and encouraged as traceability anchors.

    2. Flip the realized `(disabled)` render arm (currently around line
       1945-1958, `case "disabled":`) from `ICON_UNINSTALLABLE` to
       `ICON_DISABLED`. Update the inline comment so it no longer says
       "reuses ICON_UNINSTALLABLE (`⊘`)" — instead state that this arm uses
       the dedicated `ICON_DISABLED` (`◌`) glyph, the same glyph the
       `(will disable)` pending-tense row carries. Keep the surviving
       `D-54-01 / ENBL-04` anchor; KEEP the substantive rationale about
       subject-first grammar and the absence of reasons. Do NOT add any
       phase/wave/pitfall/milestone references.

    3. Flip the `(will disable)` cascade arm (currently around line 1934-1944,
       `case "will disable":`) from `ICON_UNINSTALLABLE` to `ICON_DISABLED`.
       Rewrite the inline comment so it no longer claims the row "Reuses
       ICON_UNINSTALLABLE (`⊘`) -- the same glyph the (skipped) / (failed)
       rows carry, mirroring the prohibited-symbol semantics of a deliberate
       disable." That rationale is now false. Replace with: the arm uses
       `ICON_DISABLED` (`◌`), the same glyph the realized `(disabled)`
       inventory row uses; this mirrors the precedent that realized +
       pending-tense rows for the same row class share a glyph
       (`●` for `(installed)` / `(will add)`, `○` for `(available)` /
       `(will remove)`). Keep the `DIFF-02` anchor.

    4. Update the comment at line 653 from
       `(\`⊘\`) -- the same glyph the \`will disable\` row uses.` to
       `(\`◌\`) -- the same glyph the \`will disable\` row uses.` and
       change the prose so it no longer says `Reuses ICON_UNINSTALLABLE` —
       the disabled-inventory variant now uses `ICON_DISABLED`. Keep the
       surrounding `isRecordedButDisabled` / UAT-03 anchors and the structural
       contrast with `(unavailable)`.

    5. Grep the file for any other comment referencing `⊘` in a disabled
       context (use `grep -n "⊘" extensions/pi-claude-marketplace/shared/notify.ts`
       and read each hit). Comments referencing `⊘` for unavailable / failed
       / skipped / manual-recovery STAY as-is. Only the two disabled-class
       references should be flipped to `◌`. As of the latest read, the
       known hits to inspect are lines 69, 653, 1214, 1326 (constant
       definition — stays on `⊘`), 1442, 1936, 1947, 2661, and 2767; only
       653, 1936, and 1947 should change.

    6. Do NOT remove `ICON_UNINSTALLABLE` — it remains in use for `(failed)`,
       `(skipped)`, `(unavailable)`, and `(manual recovery)` arms. Do NOT
       touch unrelated comments or formatting.

    Strict comment policy (per `.claude/rules/typescript-comments.md`) applies
    to every comment edited in this task. Forbidden tokens in new/edited
    comments: `Phase NN`, `Plan NN`, `Wave N`, `Pitfall N`,
    `milestone vX.Y`, parentheticals like `(Phase 56 review)`. Allowed:
    decision IDs (`D-54-01`), requirement IDs (`ENBL-02`, `ENBL-04`,
    `UAT-03`, `DIFF-02`, `SNM-33`). If existing forbidden references are
    INSIDE the touched lines, strip them as part of the edit; do not
    proactively scrub comments outside the touched lines.
  </action>
  <verify>
    <automated>grep -n "ICON_DISABLED" extensions/pi-claude-marketplace/shared/notify.ts | grep -v '^[0-9]*:[ ]*\*' | grep -v '^[0-9]*:[ ]*//' | wc -l | awk '$1 >= 3 {print "ok"; exit 0} {print "fail:", $1; exit 1}'</automated>
  </verify>
  <done>
    - `ICON_DISABLED = "◌"` declared exactly once in `notify.ts`.
    - `ICON_DISABLED` referenced in at least two render arms: the `"disabled"`
      case and the `"will disable"` case.
    - `ICON_UNINSTALLABLE` still declared and still referenced by the
      `(failed)`, `(skipped)`, `(unavailable)`, and `(manual recovery)`
      paths (verify by `grep -n "ICON_UNINSTALLABLE" extensions/pi-claude-marketplace/shared/notify.ts`
      showing at least 3 active references in renderer arms).
    - No new forbidden planning-artefact tokens introduced in edited
      comments (`grep -nE "Phase [0-9]+|Plan [0-9]+|Wave [0-9]+|Pitfall [0-9]+|milestone v[0-9]+\.[0-9]+" extensions/pi-claude-marketplace/shared/notify.ts | grep -v "two-phase commit"` returns no NEW hits in the edited regions).
    - `npx tsc --noEmit` (or equivalent typecheck via `npm run check`) passes
      for the edited file.
  </done>
</task>

<task type="auto">
  <name>Task 2: Update test byte-form assertions and the grammar-invariant regex</name>
  <files>tests/architecture/notify-grammar-invariant.test.ts, tests/orchestrators/plugin/enable-disable.test.ts, tests/orchestrators/plugin/list.test.ts, tests/orchestrators/plugin/info.test.ts, tests/shared/notify-v2.test.ts</files>
  <action>
    Flip every test byte assertion for the `(disabled)` and `(will disable)`
    rows from `⊘` to `◌`. Use Edit, not Write — these are surgical changes.

    **Known sites to flip (verified by grep):**

    1. `tests/architecture/notify-grammar-invariant.test.ts`:
       - Line 229: comment line — flip `⊘` to `◌` in the prose describing
         the (disabled) byte form.
       - Line 234: regex literal — flip the leading `⊘` to `◌`. The regex
         currently reads
         `/^⊘ [A-Za-z0-9_-]+(?: \[(?:user|project)\])?(?: v[A-Za-z0-9.#_-]+)? \(disabled\)$/`
         and should become
         `/^◌ [A-Za-z0-9_-]+(?: \[(?:user|project)\])?(?: v[A-Za-z0-9.#_-]+)? \(disabled\)$/`.
       - Line 318: test title — flip `⊘` to `◌` in the rendered byte-form
         description string.

    2. `tests/orchestrators/plugin/enable-disable.test.ts`:
       - Lines 322 and 390: flip `⊘ foo v9.9.9 (disabled)` to
         `◌ foo v9.9.9 (disabled)`.

    3. `tests/orchestrators/plugin/list.test.ts`:
       - Line 429 (explanatory comment), 431, 457, 484: flip `⊘ alpha v...
         (disabled)` byte assertions to `◌`. The explanatory comment on line
         429 should mention `◌` (and may reference `ICON_DISABLED` instead of
         `ICON_UNINSTALLABLE` if currently named).

    4. `tests/orchestrators/plugin/info.test.ts`:
       - Line 1261: flip `⊘ foo v1.2.3 (disabled)` to `◌ foo v1.2.3 (disabled)`.
       - Line 1308: `assert.match(all, /⊘ foo v1\.2\.3 \(disabled\)/, all)` —
         flip the regex from `/⊘ foo .../` to `/◌ foo .../`. (Caught by the
         straggler grep below; not in the original task-intent list.)

    5. `tests/shared/notify-v2.test.ts`:
       - Line 3702: flip `⊘ to-disable (will disable)` to
         `◌ to-disable (will disable)`.
       - Line 3793: `⊘ foo-plugin v1.2.3 (disabled)` → `◌ foo-plugin v1.2.3 (disabled)`.
       - Line 3811: `⊘ foo-plugin (disabled)` → `◌ foo-plugin (disabled)`.
       - Line 3829: `⊘ foo-plugin [project] v1.2.3 (disabled)` → `◌ ...`.
       - Line 3847: `⊘ foo-plugin v1.2.3 (disabled)` → `◌ ...`.
       - Line 3877: `⊘ foo-plugin v1.2.3 (disabled)` (inside multi-line
         array literal) → `◌ ...`.
       - Lines 3906 and 3961: `⊘ foo-plugin (skipped) {already disabled}` —
         **DO NOT FLIP**. These are `(skipped)` rows, not `(disabled)` rows.
         The `⊘` glyph stays on `(skipped)`. Verify by inspecting the
         surrounding `assert.equal(args[0], ...)` context before deciding.

    **Straggler grep (mandatory before claiming done):**

    Run this exact command at the repo root and inspect every hit:

    ```
    grep -rn -E '⊘[^⊘]*\((disabled|will disable)\)' tests/ extensions/
    ```

    Every match in `tests/` is a byte-form assertion that must be flipped.
    Every match in `extensions/` (other than the constant declaration in
    `shared/notify.ts:1326` and comments referring to `⊘`'s OTHER row classes)
    is a comment that must be flipped per Task 1's policy. Add any missed
    sites to the edit set and flip them.

    Also run:

    ```
    grep -rn -E '⊘[^⊘]*\(skipped\) \{already disabled\}' tests/
    ```

    Every match here STAYS on `⊘`. Do NOT flip these — `(skipped)` is a
    skipped-class row, not a disabled-class row.

    Strict comment policy applies to any test-title or test-comment string
    edited: no new `Phase NN` / `Plan NN` / `Wave N` / `Pitfall N` /
    `milestone vX.Y` references. Decision IDs and requirement IDs are
    encouraged.
  </action>
  <verify>
    <automated>npm run check</automated>
  </verify>
  <done>
    - `grep -rn -E '⊘[^⊘]*\((disabled|will disable)\)' tests/ extensions/` returns
      ZERO hits (only the constant declaration site `ICON_UNINSTALLABLE = "⊘"`
      and `⊘`-referencing comments about (failed)/(unavailable)/(skipped)/
      (manual recovery) survive).
    - `grep -rn -E '◌[^◌]*\((disabled|will disable)\)' tests/` returns at least
      11 hits across the five test files listed (one regex literal in
      notify-grammar-invariant + multiple byte-form string literals).
    - `grep -rn -E '⊘[^⊘]*\(skipped\) \{already disabled\}' tests/` STILL returns
      its existing hits (the `(skipped) {already disabled}` row was NOT flipped).
    - `npm run check` exits 0. The pre-existing `tests/docs/hooks-doc.test.ts`
      failure (caused by the unstaged `docs/hooks.md` edit on the working tree)
      is NOT this task's concern; if the docs/hooks.md edit is still present
      and the test fails for that reason, leave `docs/hooks.md` unstaged and
      surface the result to the user but consider the disabled-glyph work
      complete provided every other test in `npm run check` passes.
  </done>
</task>

<task type="auto">
  <name>Task 3: Update docs/output-catalog.md (legend, row map, rendered examples)</name>
  <files>docs/output-catalog.md</files>
  <action>
    Update `docs/output-catalog.md` so the legend, row map, and every
    rendered example for the two disabled-class rows reflect the new `◌`
    glyph. Every `⊘` example for `(unavailable)` / `(failed)` /
    `(skipped) {already disabled}` / `(manual recovery)` STAYS unchanged.

    **Surgical edits (use Edit, not Write):**

    1. **Line 11 (legend)** — currently:
       `` `⊘` -- prohibited symbol. On plugin rows: error / blocked state -- `(unavailable)`, `(skipped)`, `(failed)`, `(manual recovery)`, or the pending-tense `(will disable)`. On marketplace headers: `(failed)` only. ``
       Change to remove `(will disable)` from the list:
       `` `⊘` -- prohibited symbol. On plugin rows: error / blocked state -- `(unavailable)`, `(skipped)`, `(failed)`, `(manual recovery)`. On marketplace headers: `(failed)` only. ``
       Add a NEW legend bullet immediately after the `⊘` entry:
       `` `◌` -- dotted circle. On plugin rows: deliberate, user-requested disabled state -- `(disabled)` realized inventory row and `(will disable)` pending-tense row. Not used on marketplace headers. ``

    2. **Line 36 (icon legend in the row-map preamble)** — currently:
       `` `<icon>` -- one of `●` / `○` / `⊘` per the effective-state rule above. ``
       Change to:
       `` `<icon>` -- one of `●` / `○` / `⊘` / `◌` per the effective-state rule above. ``

    3. **Line 144 (row map for `(will disable)`)** — flip the Icon column
       value from `⊘` to `◌`. Leave the row-description column unchanged.

    4. **Add new row-map entry for `(disabled)`** — currently no row exists.
       Add a new table row after line 144 (`(will disable)`) following the
       existing column shape:
       `| `(disabled)`                                | ◌    | Plugin row -- list / info inventory surfaces and the `/claude:plugin disable` fresh-cascade row when the state record carries the empty-resources + `installable: true` marker. |`
       Keep alignment loose — the column widths in this table are not
       strict; match the visual style of the surrounding rows.

    5. **Line 311 (rendered example for `disabled-inventory`)** — flip
       `⊘ foo-plugin v1.2.3 (disabled)` to `◌ foo-plugin v1.2.3 (disabled)`.

    6. **Line 314 (explanatory text)** — currently contains:
       `the row uses the \`⊘\` glyph (shared with \`will disable\` per RESEARCH Pattern 5)`
       Replace this clause with phrasing that drops the per-phase RESEARCH
       reference (forbidden in code; the policy spirit applies in docs too
       for GSD-internal planning artefacts):
       `the row uses the \`◌\` glyph (shared with \`will disable\` to match the realized/pending-tense precedent: \`●\` for \`(installed)\` / \`(will add)\`, \`○\` for \`(available)\` / \`(will remove)\`)`.
       Leave the rest of the paragraph (D-54-01, isRecordedButDisabled,
       UAT-03, etc.) untouched.

    7. **Line 1281 (explanatory text for enable/disable transitions)** —
       currently contains:
       `one newly disabled (\`will disable\`, \`⊘\` glyph). Phase 53 produces ZERO \`will enable\` rows in practice (Pitfall 53-4: ...)`
       Flip the `⊘` to `◌`, and STRIP the `Pitfall 53-4: ...` parenthetical
       and any inline `Phase 53` / `Phase 54` history clauses. Rewrite to:
       `one newly disabled (\`will disable\`, \`◌\` glyph). Severity \`info\`; no reload-hint.`
       Remove the surrounding history-of-changes clauses (`Phase 53 produces
       ZERO will enable rows in practice`, `the variant and renderer arm
       ship so Phase 54's enable-bucket wiring lands against a type-complete
       model`) — they are GSD planning history per
       `.claude/rules/typescript-comments.md`. Section heading at line 1279
       (`### Enable / disable transitions (Phase 54 hand-off shape)`) should
       be renamed to `### Enable / disable transitions` (drop the
       `(Phase 54 hand-off shape)` parenthetical).

    8. **Line 1288 (rendered example for `enable-disable-transitions`)** —
       flip `⊘ to-disable (will disable)` to `◌ to-disable (will disable)`.

    9. **Line 1648 (rendered example for `disable-fresh`)** — flip
       `⊘ foo-plugin v1.2.3 (disabled)` to `◌ foo-plugin v1.2.3 (disabled)`.

    10. **Line 1661 (rendered example for `disable-idempotent`)** —
        `⊘ foo-plugin (skipped) {already disabled}` STAYS on `⊘`. Do NOT
        flip — this is a skipped-class row.

    **Straggler grep (mandatory before claiming done):**

    ```
    grep -nE '⊘[^⊘]*\((disabled|will disable)\)' docs/output-catalog.md
    ```

    Every match must be flipped. After the edits this command must return
    ZERO hits.

    ```
    grep -nE '◌[^◌]*\((disabled|will disable)\)' docs/output-catalog.md
    ```

    Must return at least 5 hits after the edits (legend + row map +
    line 311 + line 1288 + line 1648, plus the new `(disabled)` row-map
    entry).

    ```
    grep -nE '⊘[^⊘]*\((skipped|failed|unavailable|manual recovery)\)' docs/output-catalog.md | wc -l
    ```

    Must still return its pre-edit count — those examples are unchanged.

    Limit scope: do NOT edit `CHANGELOG.md`, the `.planning/` tree,
    `README.md`, or any other docs. Do NOT touch `docs/hooks.md` (the
    user has unstaged edits there unrelated to this task).
  </action>
  <verify>
    <automated>grep -cE '⊘[^⊘]*\((disabled|will disable)\)' docs/output-catalog.md | awk '$1 == 0 {print "ok"; exit 0} {print "fail:", $1; exit 1}'</automated>
  </verify>
  <done>
    - Legend line 11 no longer claims `⊘` covers `(will disable)`.
    - A new `◌` legend bullet exists immediately after the `⊘` bullet,
      covering `(disabled)` and `(will disable)`.
    - Icon legend at line ~36 includes `◌` alongside `●` / `○` / `⊘`.
    - Row map contains an entry for `(disabled)` with the `◌` glyph column.
    - Row map entry for `(will disable)` shows `◌` in the glyph column.
    - Rendered examples at the three disabled-class sites (lines ~311, ~1288,
      ~1648) all show `◌`.
    - The `(skipped) {already disabled}` example at line ~1661 still
      shows `⊘`.
    - Forbidden planning-artefact references (`Phase 53`, `Phase 54`,
      `Pitfall 53-4`) in the edited paragraph at ~1281 have been
      stripped. Section heading no longer carries the `(Phase 54 hand-off
      shape)` parenthetical.
    - All other `⊘` usages (`(failed)`, `(unavailable)`, `(skipped)`,
      `(manual recovery)`) preserved.
    - `markdownlint` (run as part of `pre-commit run --files docs/output-catalog.md`
      via the project's pre-commit suite) passes against the edited file.
  </done>
</task>

</tasks>

<verification>
**Whole-plan verification (run after all three tasks complete):**

1. **Source-level invariant:**
   ```
   grep -rn -E '⊘[^⊘]*\((disabled|will disable)\)' extensions/ tests/ docs/
   ```
   MUST return ZERO hits.

2. **New-glyph presence:**
   ```
   grep -rn -E '◌[^◌]*\((disabled|will disable)\)' extensions/ tests/ docs/
   ```
   MUST return at least 18 hits (1 in `notify.ts` jsdoc + 1 grammar regex +
   ~12 test byte-form strings + 5 docs sites).

3. **Negative invariant (other `⊘` rows unchanged):**
   ```
   grep -rn -E '⊘[^⊘]*\((skipped|failed|unavailable|manual recovery)\)' tests/ docs/ | wc -l
   ```
   MUST return the same count as before the change (no collateral flips).

4. **Comment policy:**
   ```
   grep -nE "Phase [0-9]+|Plan [0-9]+|Wave [0-9]+|Pitfall [0-9]+|milestone v[0-9]+\.[0-9]+" \
     extensions/pi-claude-marketplace/shared/notify.ts \
     | grep -v "two-phase commit"
   ```
   MUST NOT show any new hits in the lines touched by this plan. (Pre-existing
   forbidden references outside the touched regions are out of scope per the
   policy — do not proactively scrub.)

5. **Build + tests + lint:**
   ```
   npm run check
   ```
   MUST exit 0. Caveat: if the pre-existing unstaged `docs/hooks.md` edit
   triggers `tests/docs/hooks-doc.test.ts` failure, leave `docs/hooks.md`
   unstaged and report the result to the user without staging unrelated
   work; the disabled-glyph work itself must not introduce any new
   failures.

6. **Pre-commit gate (mandatory before staging the commit):**
   ```
   pre-commit run --files \
     extensions/pi-claude-marketplace/shared/notify.ts \
     tests/architecture/notify-grammar-invariant.test.ts \
     tests/orchestrators/plugin/enable-disable.test.ts \
     tests/orchestrators/plugin/list.test.ts \
     tests/orchestrators/plugin/info.test.ts \
     tests/shared/notify-v2.test.ts \
     docs/output-catalog.md
   ```
   MUST pass cleanly. Re-stage and re-run on each iteration until green;
   never use `--no-verify`.

**Commit policy:**
- Stay on branch `features/v1.13-hook-bridge`. Do NOT create a worktree
  (the 260618-qkz dispatch misfired with worktrees; user requested sequential
  mode).
- Stage ONLY the files this plan touched. Specifically do NOT stage
  `docs/hooks.md` (unstaged user edit) or `README.md` (unstaged user edit).
- Commit message: Conventional Commits. Title ≤ 72 chars (suggested:
  `feat(notify): split (disabled) glyph from ⊘ to ◌`). Body lines ≤ 80
  chars.
- Executor's call whether to split into multiple commits (source + tests +
  docs) or land as one. If splitting, source + tests should land together
  so `npm run check` is green per-commit.
- No PR creation, no push, no tag — single local commit.
</verification>

<success_criteria>
- `ICON_DISABLED = "◌"` exists in `shared/notify.ts` and is referenced by
  exactly the two arms it should cover: `case "disabled":` and
  `case "will disable":`. `ICON_UNINSTALLABLE` continues to back the other
  four arms (`(failed)`, `(skipped)`, `(unavailable)`, `(manual recovery)`).
- Every disabled-class byte-form assertion across the five named test files
  matches `◌`, not `⊘`. The grammar-invariant regex matches `◌`.
- `docs/output-catalog.md` legend, row map, and rendered examples show `◌`
  for `(disabled)` and `(will disable)`; all other `⊘` usages preserved.
- `npm run check` and `pre-commit run --files <touched>` both pass.
- One (or two/three, executor's call) clean conventional commit(s) on
  `features/v1.13-hook-bridge`. No staging of `docs/hooks.md` or
  `README.md`.
</success_criteria>

<output>
Create `.planning/quick/260618-tzl-use-glyph-for-disabled-plugin-rows/260618-tzl-SUMMARY.md`
recording: glyph constant added, render arms flipped, doc sites flipped,
straggler grep results, `npm run check` outcome, commit SHA(s).
</output>
