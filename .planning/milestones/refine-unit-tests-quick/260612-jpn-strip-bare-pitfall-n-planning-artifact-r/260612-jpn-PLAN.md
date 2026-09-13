---
phase: quick-260612-jpn
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - extensions/pi-claude-marketplace/bridges/agents/stage.ts
  - extensions/pi-claude-marketplace/edge/register.ts
  - extensions/pi-claude-marketplace/orchestrators/import/execute.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/autoupdate.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/shared.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/update.ts
  - extensions/pi-claude-marketplace/persistence/migrate.ts
  - extensions/pi-claude-marketplace/persistence/state-io.ts
  - extensions/pi-claude-marketplace/platform/git-credential.ts
  - tests/architecture/catalog-uat.test.ts
  - tests/architecture/config-state-consistency.test.ts
  - tests/architecture/cross-op-convergence.test.ts
  - tests/architecture/no-credential-leak.test.ts
  - tests/architecture/no-orchestrator-network.test.ts
  - tests/architecture/no-split-01-cast-reads.test.ts
  - tests/architecture/notify-grammar-invariant.test.ts
  - tests/architecture/notify-types.test.ts
  - tests/architecture/reconcile-planner-purity.test.ts
  - tests/domain/manifest-cache.test.ts
  - tests/domain/name.test.ts
  - tests/integration/load-reconcile-race.test.ts
  - tests/orchestrators/import/execute.test.ts
  - tests/orchestrators/marketplace/add.test.ts
  - tests/orchestrators/marketplace/autoupdate.test.ts
  - tests/orchestrators/marketplace/remove.test.ts
  - tests/orchestrators/marketplace/update.test.ts
  - tests/orchestrators/plugin/install.test.ts
  - tests/orchestrators/plugin/reinstall.test.ts
  - tests/orchestrators/plugin/uninstall.test.ts
  - tests/orchestrators/plugin/update.test.ts
  - tests/orchestrators/reconcile/apply.test.ts
  - tests/persistence/migrate.test.ts
  - tests/persistence/state-io.test.ts
  - tests/platform/git-credential.test.ts
  - tests/shared/notify-v2.test.ts
  - tests/transaction/phase-ledger.test.ts
  - .claude/rules/typescript-comments.md
autonomous: true
requirements: []

must_haves:
  truths:
    - "Bare `Pitfall N` references (with N a single digit) no longer appear in any extensions/**/*.ts or tests/**/*.ts file."
    - "`npm run check` remains green: typecheck + ESLint + Prettier + all 1795 tests + the byte-equality catalog-uat gate."
    - "Rendered user-visible output is byte-identical: docs/output-catalog.md is untouched and catalog-uat asserts the same fixtures."
    - "Comments retain the inline rationale (the WHY) that the `Pitfall N` token used to anchor; surviving requirement/decision IDs (WB-01, MIG-02, RECON-04, D-48-A, etc.) carry the traceability."
    - "Test titles that previously led with `Pitfall N` either keep their requirement-ID prefix (`WB-01: --local routes ...`) or describe the behavior directly (`Concurrent first-load race: ...`)."
    - "The typescript-comments.md policy explicitly forbids bare `Pitfall N` (and `Pattern N`) planning references going forward, with at least one before/after example."
  artifacts:
    - path: ".claude/rules/typescript-comments.md"
      provides: "Updated comment policy adding `Pitfall N` / `Pattern N` to the Forbidden list"
      contains: "Pitfall N"
  key_links:
    - from: "extensions/**/*.ts and tests/**/*.ts"
      to: ".claude/rules/typescript-comments.md (Forbidden section)"
      via: "post-sweep absence: `grep -rE 'Pitfall [0-9]' extensions/ tests/ --include='*.ts'` returns zero hits"
      pattern: "Pitfall [0-9]"
---

<objective>
Strip every bare `Pitfall N` (where N is a single digit) planning-artifact
reference from `extensions/**/*.ts` and `tests/**/*.ts`, then amend the
TypeScript comment policy to forbid them going forward. This finishes the
job that commits 6843255 and f0ae1af started (phase-qualified forms
`Pitfall NN-N`, `RESEARCH Pitfall N`, `Phases NN`), which left the bare
taxonomy "untouched pending a rule-file ruling" -- that ruling is now in
place (2026-06-12).

Purpose: `Pitfall N` numbers cite per-phase RESEARCH.md lists whose
numbering restarts per phase, so the same number means different things
in different files; the earliest source docs no longer exist; all
underlying hazards are gate-enforced by tests, so the IDs track nothing.
Removing them severs the dangling references and prevents new ones.

Output: 119 sites rewritten across 38 source/test files plus one policy
amendment, in one or two Conventional Commits, with `npm run check` green
and the catalog-uat byte-equality gate untouched.
</objective>

<execution_context>
@$HOME/.claude/gsd-core/workflows/execute-plan.md
@$HOME/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@CLAUDE.md
@.claude/rules/typescript-comments.md

# Precedent commits whose rewording style this sweep MUST match
# (do NOT re-read these from a fresh sub-agent -- the patterns below
# inline the directly-applicable shapes):
#
#   6843255 docs(reconcile): scrub planning-artifact comments and rewrite README
#   f0ae1af refactor(comments): drop phase-numbered pitfall refs from TS comments
</context>

<tasks>

<task type="auto">
  <name>Task 1: Sweep all 119 bare `Pitfall N` sites across extensions/ and tests/</name>
  <files>
    extensions/pi-claude-marketplace/bridges/agents/stage.ts,
    extensions/pi-claude-marketplace/edge/register.ts,
    extensions/pi-claude-marketplace/orchestrators/import/execute.ts,
    extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts,
    extensions/pi-claude-marketplace/orchestrators/marketplace/autoupdate.ts,
    extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts,
    extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts,
    extensions/pi-claude-marketplace/orchestrators/plugin/shared.ts,
    extensions/pi-claude-marketplace/orchestrators/plugin/update.ts,
    extensions/pi-claude-marketplace/persistence/migrate.ts,
    extensions/pi-claude-marketplace/persistence/state-io.ts,
    extensions/pi-claude-marketplace/platform/git-credential.ts,
    tests/architecture/catalog-uat.test.ts,
    tests/architecture/config-state-consistency.test.ts,
    tests/architecture/cross-op-convergence.test.ts,
    tests/architecture/no-credential-leak.test.ts,
    tests/architecture/no-orchestrator-network.test.ts,
    tests/architecture/no-split-01-cast-reads.test.ts,
    tests/architecture/notify-grammar-invariant.test.ts,
    tests/architecture/notify-types.test.ts,
    tests/architecture/reconcile-planner-purity.test.ts,
    tests/domain/manifest-cache.test.ts,
    tests/domain/name.test.ts,
    tests/integration/load-reconcile-race.test.ts,
    tests/orchestrators/import/execute.test.ts,
    tests/orchestrators/marketplace/add.test.ts,
    tests/orchestrators/marketplace/autoupdate.test.ts,
    tests/orchestrators/marketplace/remove.test.ts,
    tests/orchestrators/marketplace/update.test.ts,
    tests/orchestrators/plugin/install.test.ts,
    tests/orchestrators/plugin/reinstall.test.ts,
    tests/orchestrators/plugin/uninstall.test.ts,
    tests/orchestrators/plugin/update.test.ts,
    tests/orchestrators/reconcile/apply.test.ts,
    tests/persistence/migrate.test.ts,
    tests/persistence/state-io.test.ts,
    tests/platform/git-credential.test.ts,
    tests/shared/notify-v2.test.ts,
    tests/transaction/phase-ledger.test.ts
  </files>
  <action>
    Strip every bare `Pitfall N` token (single-digit N, 0-9) from the 38
    files listed in `<files>`. Pre-sweep authoritative count: `grep -rE
    'Pitfall [0-9]' extensions/ tests/ --include='*.ts' | wc -l` returns
    119. Post-sweep count MUST be 0.

    Re-derive the per-file hit list at execution time with `grep -nE
    'Pitfall [0-9]' <file>` (the 38-file enumeration above and the
    per-file counts -- update.ts:11, notify-v2.test.ts:6,
    git-credential.test.ts:6, git-credential.ts:6, etc. -- match the
    `grep -rE 'Pitfall [0-9]' extensions/ tests/ --include='*.ts'`
    snapshot taken 2026-06-12).

    REWORDING RULES (in priority order):

    1. **If the line already carries a requirement/decision ID on the
       same line, drop the `Pitfall N` token (and any leading `/ ` or
       trailing ` /` glue) and let the surviving ID(s) carry the
       anchor.** This is the dominant pattern. Examples drawn from the
       actual hits:

       - `// WB-01 / Pitfall 2: target-path selection happens ONCE`
         becomes
         `// WB-01: target-path selection happens ONCE`
       - `* WB-01 / WB-02 / Pitfall 2: when true, target`
         becomes
         `* WB-01 / WB-02: when true, target`
       - `// WB-01 / A7 / Pitfall 5: deep-equal short-circuit`
         becomes
         `// WB-01 / A7: deep-equal short-circuit`
       - `* WB-01 / Pitfall 2 / UAT-05: select the targeted physical`
         becomes
         `* WB-01 / UAT-05: select the targeted physical`
       - `// WB-03 / Pitfall 8: after all per-entry`
         becomes
         `// WB-03: after all per-entry`
       - `* Failure-mode contract (Pitfall 7): when git is absent`
         becomes
         `* Failure-mode contract: when git is absent`
       - `* Error-message discipline (Pitfall 8 / AUTH-09):`
         becomes
         `* Error-message discipline (AUTH-09):`

    2. **If the line has no other ID and the `Pitfall N` is a trailing
       parenthetical or a sentence-final aside, drop the parenthetical
       and tighten grammar.** Match the f0ae1af precedent style:

       - `// Residual risk (accepted, RESEARCH Pitfall 3): a same-size`
         was rewritten in f0ae1af to
         `// Residual risk (accepted): a same-size`.
         Apply the same shape here:
         `* never serialized back (Pitfall 1).`
         becomes
         `* never serialized back.`
         and
         `// Per Pitfall 9, ENOENT and missing/empty marketplaces`
         becomes
         `// ENOENT and missing/empty marketplaces`.

    3. **If the `Pitfall N` IS the only anchor and the line would
       become a bare gerund/fragment, rephrase to keep the rationale
       as a complete sentence describing the behavior.** Examples:

       - `// Pitfall 9: missing file -> default state (NOT throw).`
         becomes
         `// missing file -> default state (NOT throw).`
         (or, if a complete sentence reads better,
         `// Missing file -> default state (NOT throw).`).
       - `// Pitfall 7: carry forward from EXISTING sRecord, NOT from`
         becomes
         `// Carry forward from EXISTING sRecord, NOT from` (kept as
         the directive imperative the surrounding code already
         reads as).
       - `/** First-run default (Pitfall 9: ENOENT and empty treated identically). */`
         becomes
         `/** First-load default (ENOENT and empty treated identically). */`.

    4. **Cross-references that name a Pitfall in another doc.** Same
       rule: the ID is metadata, not a contract. Drop it.

       - `// branch handles that silent converge (Pitfall 4).`
         becomes
         `// branch handles that silent converge.`
       - `// non-throwing concurrent-removal outcome (Pitfall 3 / A3).`
         becomes
         `// non-throwing concurrent-removal outcome (A3).`
       - `// CANONICAL ROWS (two, per RESEARCH "Pitfall 4"):`
         becomes
         `// CANONICAL ROWS (two):` (the surrounding header prose
         already says WHY two; the citation adds nothing).
       - `* absence per RESEARCH M13 / Pitfall 4).`
         becomes
         `* absence per RESEARCH M13).` (M13 is a matrix ID, kept).

    5. **Multi-line / mid-sentence hits.** Several files have the
       token mid-paragraph spanning multiple comment lines (e.g.
       `extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts`
       lines 1-N: `// 'invalid manifest' too (Pitfall 3 -- only typed
       manifest errors map here,`). Drop the parenthetical glue and
       reflow the wrapped lines so the prose still flows.

    6. **TEST TITLES.** The `<background>` lists the exact two
       precedents to follow:

       - `"WB-01 / Pitfall 2: --local routes ..."` ->
         `"WB-01: --local routes ..."` (keep the requirement-ID prefix
         when one is present; this covers the majority of WB-01-,
         RECON-04-, MA-9-, CFG-03-, MIG-NN-, SK-2-, CM-2-, AG-1-,
         D-48-A-anchored titles).
       - `"Pitfall 9 loadState on missing state.json returns DEFAULT_STATE"`
         -> keep the behavior description (the surrounding suite
         header already establishes ST-1 / state-io context, so
         `"loadState on missing state.json returns DEFAULT_STATE"`
         reads correctly). Do NOT invent a new ID like `ST-1` here
         unless the suite header (file-level comment / describe block)
         already establishes that anchor for the suite -- the
         f0ae1af precedent did NOT mint IDs, it dropped tokens or kept
         the description.
       - The `Pitfall 9 migrate on null ...` titles in
         `tests/persistence/migrate.test.ts` follow the same shape:
         drop the leading `Pitfall 9 ` token.

       Apply the same logic to runtime assertion messages that carry
       `Pitfall N`. These behave like in-source documentation, not
       contract strings:

       - `tests/orchestrators/marketplace/add.test.ts:264`:
         `` `MA-9 / Pitfall 4: cleanupStaging must run before ...` ``
         becomes
         `` `MA-9: cleanupStaging must run before ...` ``
       - `tests/orchestrators/marketplace/autoupdate.test.ts:561`:
         `"idempotent flip MUST be byte-identical (Pitfall 5)"`
         becomes
         `"idempotent flip MUST be byte-identical"`
       - `tests/orchestrators/reconcile/apply.test.ts:154`:
         `` `RECON-04 / Pitfall 4: applyReconcile cascade ...` ``
         becomes
         `` `RECON-04: applyReconcile cascade ...` ``

       These template-string messages flagged in the `<constraints>`
       CAUTION (1) are safe to reword -- the `Pitfall N` token is
       metadata, not a contract substring asserted by any other test.

    DO NOT TOUCH:

    - `.planning/**` -- PITFALLS.md, RESEARCH.md, and historical phase
      docs keep their numbering. Sweep is restricted to
      `extensions/**/*.ts` and `tests/**/*.ts`.
    - `docs/output-catalog.md` -- byte-equality gate (catalog-uat).
    - Domain-language uses of `phase` already carved out in
      `.claude/rules/typescript-comments.md` (two-phase commit
      narration in `bridges/agents/stage.ts`, the `phase ledger`
      transaction concept in `tests/transaction/phase-ledger.test.ts`,
      `plugin update phase 3 failed` fixtures, URL pins like `#v1.0`).
      The sweep is for `Pitfall [0-9]` specifically, not `phase`, so
      these are not at risk -- but if a hit lives ADJACENT to such a
      domain-language sentence, leave the adjacent sentence alone.
    - Any executable code, exported names, function bodies, control
      flow, control predicates, type definitions, or runtime
      argument values. The sweep is COMMENT-AND-TEST-TITLE only.
      Byte-equality for catalog-uat fixtures and all rendered output
      MUST hold.
    - Requirement IDs (WB-01, MIG-02, RECON-04, etc.), decision IDs
      (D-48-A, D-13, D-15, etc.), finding IDs, GitHub refs, version
      pins: PRESERVE per `.claude/rules/typescript-comments.md`
      Allowed section.

    GREP-AS-YOU-GO: after each file edit, run `grep -nE 'Pitfall [0-9]'
    <file>` and confirm zero remaining hits in THAT file before moving
    on. Do not batch all 38 files then verify at the end -- a missed
    pattern shape (e.g. a Pitfall token inside a JSDoc `@param` body)
    will not surface until the final grep, and you will not remember
    which file or comment shape was responsible.

    Run `npx prettier --write` on the edited files (or let
    `pre-commit run` do it -- the project's prettier hook normalizes
    on commit anyway) so the reflowed comment wrapping passes
    Prettier's max-line-length check.
  </action>
  <verify>
    <automated>
      grep -rcE 'Pitfall [0-9]' extensions/ tests/ --include='*.ts' | grep -v ':0$' ; test $? -ne 0 && \
      npm run check
    </automated>
  </verify>
  <done>
    - `grep -rE 'Pitfall [0-9]' extensions/ tests/ --include='*.ts'`
      returns zero hits (exit code 1; no matching lines).
    - `npm run check` exits 0: typecheck clean, ESLint clean, Prettier
      clean, all 1795+ unit tests + 10 integration tests pass, and the
      catalog-uat byte-equality gate is GREEN.
    - `git diff --stat docs/output-catalog.md` shows zero changes.
    - `git diff --stat -- '*.ts' | wc -l` reflects the 38 source/test
      files touched (no executable-code paths modified -- diffs are
      confined to comments and test/assertion title strings).
  </done>
</task>

<task type="auto">
  <name>Task 2: Amend `.claude/rules/typescript-comments.md` to forbid bare `Pitfall N` (and `Pattern N`) going forward</name>
  <files>.claude/rules/typescript-comments.md</files>
  <action>
    Extend the `## Forbidden in comments and test titles` section to
    add bare `Pitfall N` and `Pattern N` planning references to the
    forbidden list, and add at least one before/after example pair to
    the `## Examples` section mirroring the style of the existing
    `Phase NN Plan NN` -> stripped example.

    Specifically:

    1. Under `## Forbidden in comments and test titles`, append a
       new bullet between the existing `Parentheticals like
       \`(Phase 56 review)\`...` bullet and the trailing
       `Any other phrasing whose only purpose ...` bullet:

       ```text
       - Bare `Pitfall N` and `Pattern N` references (where N is a
         single digit) that cite per-phase RESEARCH.md numbered
         hazard lists. Per-phase numbering restarts per RESEARCH
         document, so the same `Pitfall N` token means different
         things in different files, the earliest source docs no
         longer exist, and the underlying hazards are gate-enforced
         by tests. Drop the token and let the surrounding comment's
         rationale (or surviving requirement/decision IDs) carry the
         anchor. Phase-qualified forms (`Pitfall NN-N`, `RESEARCH
         Pitfall N`) are already covered by the planning-artifact
         clause above.
       ```

    2. Under `## Examples`, append a new before/after pair after the
       existing `test("Phase 8 / PRL-10 replacePreparedSkills ...")`
       example, preserving the existing fenced-block style and the
       `Forbidden -> Allowed:` framing:

       ```text
       Forbidden -> Allowed:

       \```text
       // WB-01 / Pitfall 2: target-path selection happens ONCE
       \```

       becomes

       \```text
       // WB-01: target-path selection happens ONCE
       \```

       \```text
       test("Pitfall 9 loadState on missing state.json returns DEFAULT_STATE", ...)
       \```

       becomes

       \```text
       test("loadState on missing state.json returns DEFAULT_STATE", ...)
       \```
       ```

       (Use real backticks in the file -- the escapes above are only
       to keep this PLAN.md's own fence intact. Match the existing
       file's ``` \```text ``` fence style verbatim.)

    Do NOT touch the `## Domain language is not GSD history` carve-out
    section -- the `phase 3` / two-phase commit / `phase ledger`
    callouts there are independent of the `Pitfall N` taxonomy.

    Do NOT touch the `## Allowed (and encouraged) as traceability
    anchors` section -- WB-NN, RECON-NN, D-NN, etc. all stay allowed.

    The amendment is markdown-only, byte-neutral for any runtime
    output, and only adds rule lines; no existing lines are deleted.
  </action>
  <verify>
    <automated>
      grep -c "Pitfall N" .claude/rules/typescript-comments.md | grep -v '^0$' && \
      grep -c "Pattern N" .claude/rules/typescript-comments.md | grep -v '^0$' && \
      npm run check
    </automated>
  </verify>
  <done>
    - `.claude/rules/typescript-comments.md` contains a new Forbidden
      bullet naming `Pitfall N` AND `Pattern N` (greps above return
      non-zero match counts).
    - The `## Examples` section gains at least one before/after pair
      demonstrating a `Pitfall N` strip (line-comment OR test-title
      form -- either is acceptable; both is the goal above).
    - The Allowed section and the Domain-language carve-out section
      are byte-unchanged outside the targeted edits.
    - `npm run check` is GREEN (no rule consumes the policy at runtime,
      so this is a regression check that the markdown edit did not
      somehow disturb anything else in the same commit).

    NOTE on commit granularity: Task 1 and Task 2 MAY be folded into
    a SINGLE Conventional Commit if the executor judges the policy
    amendment small enough to ride along (the `<constraints>` permit
    "One or two Conventional Commits max"). The natural split, if
    two commits are preferred, is:

      1. `refactor(comments): drop bare Pitfall N refs from TS comments`
         (the 38-file sweep)
      2. `docs(rules): forbid bare Pitfall N planning refs`
         (the policy amendment)

    Both fit under the 72-char title cap. Body lines wrap at 80.

    `pre-commit run --files <changed files>` MUST be run and pass
    BEFORE each `git commit`; on failure, fix and re-stage rather
    than committing-and-amending. NEVER `--no-verify`.
  </done>
</task>

</tasks>

<verification>
Full-repo gate after both tasks land:

1. `grep -rE 'Pitfall [0-9]' extensions/ tests/ --include='*.ts'`
   returns zero hits (exit code 1).
2. `npm run check` exits 0:
   - `tsc --noEmit` clean (no comment edit broke a TSDoc reference).
   - `eslint .` clean (Prettier-style wrap holds; no padding-line
     regression from reflow).
   - `prettier --check` clean.
   - `node --test "tests/**/*.test.ts"` -- 1795 unit tests pass.
   - integration tests (10) pass.
   - catalog-uat gate GREEN (byte-equality across docs/output-catalog.md
     and the renderer fixtures -- guarantees the comment-only sweep did
     not perturb any rendered token).
3. `git diff --stat docs/output-catalog.md` reports zero changes
   (catalog must NOT be edited; the `<constraints>` make this a hard
   gate).
4. `git diff -- '*.ts' | grep -vE '^(diff|index|---|\+\+\+|@@|[+-]\s*(//|\*|\s|`|"|\w*\.))$' | head` -- a
   spot-check that the diff body is dominated by comment/test-title
   token lines and not executable statements. (If this surfaces a
   non-comment line, abort and re-audit -- the constraint is
   COMMENT-AND-TEST-TITLE only.)
</verification>

<success_criteria>
- 119 bare `Pitfall N` sites stripped; post-sweep grep returns 0.
- `.claude/rules/typescript-comments.md` forbids bare `Pitfall N`
  (and `Pattern N`) with at least one before/after example.
- `npm run check` GREEN.
- `docs/output-catalog.md` and all rendered-output fixtures
  byte-unchanged (catalog-uat asserts this; no human verification
  needed).
- One or two Conventional Commits, each title <=72 chars, body lines
  <=80; pre-commit hooks run cleanly before each commit; never
  `--no-verify`.
- The amendment to the comment policy closes the rule-file ruling
  that f0ae1af's commit body explicitly deferred ("bare Pitfall N
  taxonomy left untouched pending a rule-file ruling").
</success_criteria>

<output>
Create `.planning/quick/260612-jpn-strip-bare-pitfall-n-planning-artifact-r/260612-jpn-SUMMARY.md`
when done, recording: the 38 files touched, the final commit SHA(s),
the post-sweep `grep -rE 'Pitfall [0-9]' extensions/ tests/
--include='*.ts'` evidence (exit 1, no output), and the
`npm run check` final summary line (test count + GREEN).
</output>
