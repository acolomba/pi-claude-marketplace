---
phase: 261004-tbe
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - tests/architecture/workflows-doc-pins.test.ts
  - tests/architecture/dependency-doc-agreement.test.ts
  - tests/architecture/messaging-guide-doc-pins.test.ts
  - tests/architecture/partial-vocabulary-guard.test.ts
  - tests/architecture/gate-targets.ts
  - docs/messaging-style-guide.md
  - .github/workflows/ci.yml
  - scripts/check-changed.mjs
  - skills/local-verification/SKILL.md
  - CHANGELOG.md
autonomous: true
requirements: [TBE-01, TBE-02, TBE-03, TBE-04]

estimate:
  tokens: 45000
  raw_tokens: 45000
  tasks: 2
  confidence: low

must_haves:
  truths:
    - "D-01: the three documentation-agreement suites (workflows-doc-pins, dependency-doc-agreement, messaging-guide-doc-pins) are deleted, and no file under tests/architecture names README.md, README.es.md, or any document other than docs/output-catalog.md."
    - "D-01: the five tests that compare docs/output-catalog.md with real notify() output still exist and pass: catalog-uat/catalog-contract, catalog-uat/catalog-parser, hooks-cap-notify (STOP-07), compat-01-no-expansion, and partial-vocabulary-guard."
    - "D-01: partial-vocabulary-guard.test.ts still scans the extension tree, the unit-test tree, and docs/output-catalog.md with every non-PRD case intact; it no longer reads the style guide or the PRD and carries no style-guide waiver or mapping category."
    - "D-01: VOCABULARY_GUARD_DOC_TARGETS holds docs/output-catalog.md first and the catalog-contract test second; every gate-targets.ts export still has an importer; npm run typecheck, lint, and fallow exit 0."
    - "D-01: both ci.yml paths lists and the check-changed documentationFiles set name docs/output-catalog.md as their only document; the documentation selector still runs test:architecture."
    - "D-01: skills/local-verification/SKILL.md names only docs/output-catalog.md as a documentation input, the #236 CHANGELOG entry mentions the change, docs/messaging-style-guide.md cites no deleted suite, and CONTRIBUTING.md and .planning/codebase/ needed no edit."
    - "Two Conventional Commits with explicit paths; each pre-commit run ended PRECOMMIT_EXIT=0, gitlint passed, the Fallow audit was not fail, and .planning/STATE.md is in neither."
  artifacts:
    - path: "tests/architecture/partial-vocabulary-guard.test.ts"
      provides: "the retired-vocabulary guard over the extension tree, the unit tests, and the output catalog"
      contains: 'readInto(files, [path.join(REPO_ROOT, "docs", "output-catalog.md")]);'
    - path: "tests/architecture/gate-targets.ts"
      provides: "VOCABULARY_GUARD_DOC_TARGETS with the catalog as its first entry"
      contains: "export const VOCABULARY_GUARD_DOC_TARGETS = ["
    - path: "scripts/check-changed.mjs"
      provides: "the commit-time documentation input set"
      contains: 'const documentationFiles = new Set(["docs/output-catalog.md"]);'
    - path: ".github/workflows/ci.yml"
      provides: "the CI build-input allowlist with one document"
      contains: '- "docs/output-catalog.md"'
  key_links:
    - from: "tests/architecture/hooks-cap-notify.test.ts"
      to: "VOCABULARY_GUARD_DOC_TARGETS first entry"
      via: "positional destructuring; the catalog must stay first"
      pattern: "const [OUTPUT_CATALOG_REL] = VOCABULARY_GUARD_DOC_TARGETS;"
    - from: ".github/workflows/ci.yml paths"
      to: "scripts/check-changed.mjs documentationFiles"
      via: "the same single document in both lists"
      pattern: "scripts/check-changed.mjs keeps the"
    - from: "partial-vocabulary-guard TOKEN_WAIVERS"
      to: "the waiver load-bearing case"
      via: "a waiver whose file leaves the scanned surface fails that case"
      pattern: "D-75-01 guard: every token waiver is load-bearing"
---

# Remove the documentation-agreement tests; keep only the output catalog as a documentation input

<objective>
Per D-01 (operator decision, locked): tests that pin documentation prose leave the build. Delete the three suites that compare READMEs and docs with code, trim the retired-vocabulary guard to the extension tree, the unit tests, and `docs/output-catalog.md`, and make that catalog the only document that CI and the commit-time selector treat as a build input. Every test that compares the catalog with real `notify()` output stays.

Purpose: a wording edit to a README or a design doc must not fail or start a build. The catalog stays because it is a code contract.

Output: Task 1 (tracer) deletes the suites and trims the guard and registry, then proves end to end that only the catalog is still read and that its readers pass. Task 2 narrows the four allowlist places and the changelog to that proven state.
</objective>

<execution_context>
@/home/acolomba/pi-claude-marketplace/.claude/gsd-core/workflows/execute-plan.md
@/home/acolomba/pi-claude-marketplace/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@AGENTS.md
@skills/local-verification/SKILL.md
@skills/typescript-unit-testing/SKILL.md
</context>

## Requirement map

TBE IDs and D-01 are plan-local labels. Never cite them in code, comments, or commit messages.

| ID     | Outcome                                                                                                       | Task |
| ------ | ------------------------------------------------------------------------------------------------------------- | ---- |
| TBE-01 | The three doc-agreement suites are deleted; no test reads a document other than the catalog (D-01)             | 1    |
| TBE-02 | The vocabulary guard and `VOCABULARY_GUARD_DOC_TARGETS` drop the style guide and PRD; every export keeps an importer (D-01) | 1    |
| TBE-03 | `ci.yml` (both lists), `check-changed.mjs`, and the local-verification skill name only the catalog; CONTRIBUTING.md verified (D-01) | 2    |
| TBE-04 | Stale references fixed: the style-guide citation (Task 1) and the #236 changelog entry (Task 2); `.planning/codebase/` verified clean | 1, 2 |

## Facts measured during planning

2026-10-04, branch `features/faster-precommit`, main checkout, HEAD a8928ece. Rely on these.

1. Doc readers. Outside the three suites, five tests read a repository document, all under `tests/architecture/`: `catalog-uat/catalog-contract`, `catalog-uat/catalog-parser`, `hooks-cap-notify`, `compat-01-no-expansion` (catalog only), and `partial-vocabulary-guard` (catalog, style guide, PRD). No other test or script reads one. `README.md` strings in `tests/platform/`, `tests/bridges/skills/`, and `tests/scripts/` are fixture files written into temp roots. Two comments mention docs (`tests/domain/plugin-resolver.test.ts`, `tests/orchestrators/reconcile/apply.test.ts`); they stay.
2. Importers. `VOCABULARY_GUARD_DOC_TARGETS` has one importer, `hooks-cap-notify.test.ts`, which binds `const [OUTPUT_CATALOG_REL] = VOCABULARY_GUARD_DOC_TARGETS;`. The guard hardcodes its own paths. The three suites import only `REPO_ROOT` and `stripComments` from `source-scan.ts`, so every export of `gate-targets.ts` and `source-scan.ts` keeps an importer after the deletions.
3. Citations. The only citation of a deleted suite outside the suites is the last sentence of the "Field discipline per status" paragraph in `docs/messaging-style-guide.md`. `no-stale-test-citations` polices `extensions/` and `tests/` only. The three citations of the guard (`domain/manifest.ts`, `tests/edge/completions/provider.test.ts`, `tests/edge/handlers/plugin/reinstall.test.ts`) stay valid.
4. Waivers. The two style-guide waiver rows are the only `mapping` rows. Once the guide leaves the surface, "every token waiver is load-bearing" fails unless both rows go. The two retired soft-dependency sentences occur in no file of the remaining surface.
5. Registries. `check-corresponding-tests.mjs` exempts the `architecture` root; no script, config, or type-member data file names the deleted suites.
6. Selector. The documentation rule runs before the missing-file rule. In Task 1 the deletions select broad, and the style-guide edit still selects documentation, so that hook runs the whole architecture suite. Task 2 selects broad (`ci.yml`, `check-changed.mjs`). `check-changed.mjs` has no test.
7. `README.md` sits in `package.json` `files` beside `CHANGELOG.md` and `LICENSE`; `npm pack --dry-run` cannot fail on its content, and the allowlist already excludes the other two.
8. Concurrency. Quick task 261004-t4g committed during planning (1da67a83, a8928ece). It dropped the rule-pack line from both `ci.yml` lists and from `check-changed.mjs`, and its #236 line reads "... CI runs only on build-input changes, and ESLint alone bans stdio calls. (#236)". After it, the seven document lines in each `ci.yml` list are still one contiguous run, and the precondition passes. Anchor on content, never on line numbers. The operator may edit files at any time: stage explicit paths only.
9. Commits. No git `pre-commit` or `commit-msg` hook is installed: run pre-commit and gitlint by hand. `/tmp/` is gitignored, so logs go to `tmp/tbe/`. zsh does not split `$VAR`: type paths literally. mdformat uses `wrap = "no"`.

## Kept and removed cases

- `workflows-doc-pins.test.ts`: all 4 cases read `docs/workflows-compatibility.md` or both READMEs. The code facts they bind to are owned elsewhere: the peer floor by `tests/architecture/peer-floor.test.ts`, `GATE_ORDER` by `tests/domain/workflow-script.test.ts`. Deleted whole.
- `dependency-doc-agreement.test.ts`: all 11 cases read `docs/dependency-resolution.md`, `README.md`, or both. Two carry code assertions that owners already make: the XMKT-01 cause text (`tests/orchestrators/plugin/install-cascade.messaging.test.ts`; one template, no direct/nested branch) and the UPDT-02 held arm (`tests/orchestrators/plugin/update-preflight.test.ts`). Deleted whole.
- `messaging-guide-doc-pins.test.ts`: all 5 cases read the guide. Its module-level `FIELD_DISCIPLINE` literal is compile-time only and exists to be compared with the guide's table; the compiler enforces field discipline at every producer and consumer, and `tests/shared/notification-types.test.ts` owns the type contract. Deleted whole.
- `partial-vocabulary-guard.test.ts`: the 11 PRD cases go (10 token absences, 1 presence). Every other case stays; the docs sanity case loses its style-guide clause.
- No case is kept from the deleted files: none checks a code-only fact that its owner does not already check.

## Choices within D-01

1. The documentation selector keeps `test:architecture`. Narrowing it needs a hand-kept list of five test paths that would go stale silently.
2. `VOCABULARY_GUARD_DOC_TARGETS` is trimmed, not deleted, so `hooks-cap-notify.test.ts` needs no edit.
3. The `mapping` waiver category goes with its only two rows.
4. The changelog gets one sub-bullet under the #236 line. After t4g, that line is one sentence at the rule's 25-word limit, and `.claude/rules/changelog.md` allows one sub-bullet per further change in the same PR.
5. CONTRIBUTING.md line 60 says "documentation" generically and names no file, so it stays. `.planning/codebase/` names none of the deleted suites, so it stays.

<tasks>

<task type="tracer">
  <name>Task 1: Delete the doc-agreement suites and trim the guard and registry to the catalog</name>
  <files>tests/architecture/workflows-doc-pins.test.ts, tests/architecture/dependency-doc-agreement.test.ts, tests/architecture/messaging-guide-doc-pins.test.ts, tests/architecture/partial-vocabulary-guard.test.ts, tests/architecture/gate-targets.ts, docs/messaging-style-guide.md</files>
  <precondition>Quick task 261004-t4g has committed: `test ! -e rule-packs/architecture.json && test -z "$(git status --porcelain -- .github/workflows/ci.yml scripts/check-changed.mjs CHANGELOG.md eslint.config.js)"` succeeds. If not, halt and report.</precondition>
  <read_first>
    - tests/architecture/partial-vocabulary-guard.test.ts (whole file)
    - tests/architecture/gate-targets.ts (the VOCABULARY_GUARD_DOC_TARGETS block)
    - tests/architecture/hooks-cap-notify.test.ts (the import and the positional binding)
    - skills/typescript-comments/SKILL.md and skills/typescript-google-style-review/SKILL.md
  </read_first>
  <action>
1. Run `mkdir -p tmp/tbe` and `git rev-parse HEAD > tmp/tbe/start-1.txt`.
2. Per D-01, delete the three suites with `git rm tests/architecture/workflows-doc-pins.test.ts tests/architecture/dependency-doc-agreement.test.ts tests/architecture/messaging-guide-doc-pins.test.ts`. Do not move any of their code: see "Kept and removed cases".
3. Per D-01, edit `tests/architecture/partial-vocabulary-guard.test.ts`. Keep the extension-tree, unit-test-tree, and output-catalog coverage, and leave every case not named here byte-identical.
   a. Header comment: the glyph-file parenthetical lists notify.ts, info.ts, and output-catalog.md, without the PRD. The two-docs bullet becomes one bullet naming only `docs/output-catalog.md`. Delete the four-line PRD bullet.
   b. `collectGuardedSources`: its doc comment says the extension tree plus the output catalog and the recursive unit-test tree. The `readInto` call passes only the catalog path, written on one line as the `contains` string in must_haves states.
   c. The case "D-75-01 guard: the docs surface loaded (sanity)": drop the style-guide `has()` clause, and change "the docs" in its message to "the output catalog". Keep its title.
   d. Waivers: delete the two rows whose `file` is the style guide. Remove `"mapping"` from the `TokenWaiver` `category` union. In the comment block above the waivers, change "Three categories" to "Two categories" and delete the `mapping` bullet.
   e. The comment above `ABSENT_SOFT_DEP_PROSE`: replace its last clause, which says the mapping table is waived by name, with a statement that no guarded file may spell the retired sentences.
   f. Delete the whole PRD section: from the dashed rule line above the "PRD surface" comment through the closing `});` of the case "D-75-01 guard: PRD keeps FORCE-/FSTAT- IDs and the component `unsupported` homonyms". That removes `PRD_REL`, `PRD_CONTENT`, `maskPrdAllowlist`, `MASKED_PRD`, `PRD_ABSENT_TOKENS`, its loop, and the presence case. The completion-description section that follows stays.
4. Per D-01, in `tests/architecture/gate-targets.ts`, delete the style-guide and PRD entries from `VOCABULARY_GUARD_DOC_TARGETS`. Keep `docs/output-catalog.md` first and the catalog-contract entry second. In its doc comment, the sentence about a retired token names the catalog only ("surviving in the catalog is still live as far as anyone reading it is concerned"). Change no other export.
5. In `docs/messaging-style-guide.md`, delete only the last sentence of the "Field discipline per status" paragraph, the one that names the deleted MSGDOC-01 suite by path. Keep the paragraph on one line.
6. Record each exit code in its log, never through a pipe: `node --test tests/architecture/catalog-uat/catalog-contract.test.ts tests/architecture/catalog-uat/catalog-parser.test.ts tests/architecture/hooks-cap-notify.test.ts tests/architecture/compat-01-no-expansion.test.ts tests/architecture/partial-vocabulary-guard.test.ts > tmp/tbe/node-test-1.log 2>&1; echo "NODE_TEST_EXIT=$?" >> tmp/tbe/node-test-1.log`, then the same shape for `npm run typecheck` (TYPECHECK_EXIT, `tmp/tbe/typecheck-1.log`), `npm run lint` (LINT_EXIT, `tmp/tbe/lint-1.log`), and `npm run fallow` (FALLOW_EXIT, `tmp/tbe/fallow-1.log`). Fix any failure before going on.
7. Run `pre-commit run --files tests/architecture/partial-vocabulary-guard.test.ts tests/architecture/gate-targets.ts docs/messaging-style-guide.md > tmp/tbe/precommit-1.log 2>&1; echo "PRECOMMIT_EXIT=$?" >> tmp/tbe/precommit-1.log` in the foreground with a 600000 ms timeout. Pass only existing paths; the always-run check-changed hook sees the deletions through git. If it may outlast the limit, background it once and wait for the notification; never poll. If a hook fails or rewrites a file, inspect the diff, fix, restage, and re-run until the log ends `PRECOMMIT_EXIT=0`.
8. Run `npx fallow audit --format json --quiet --explain --gate-marker agent > tmp/tbe/audit-1.json 2>&1`. A `fail` verdict blocks the commit; a JSON runtime error does not.
9. Stage by name: `git add tests/architecture/partial-vocabulary-guard.test.ts tests/architecture/gate-targets.ts docs/messaging-style-guide.md` (the deletions are already staged). Confirm `git diff --cached --name-status` lists those three as `M`, the three suites as `D`, and nothing else. Write `tmp/tbe/commit-1.txt`: title `test(architecture): remove documentation agreement tests`; body lines of 80 characters or fewer saying that tests no longer pin documentation prose, that `docs/output-catalog.md` stays because tests compare it with real `notify()` output, and that the vocabulary guard keeps the extension, unit-test, and catalog scans. End it with the attribution trailers your session instructions give. Check it with `pre-commit run gitlint --hook-stage commit-msg --commit-msg-filename tmp/tbe/commit-1.txt`, then `git commit -F tmp/tbe/commit-1.txt`. Never use `--no-verify`, never amend, never stage `.planning/STATE.md`.
  </action>
  <verify>
    <automated>S="$(cat tmp/tbe/start-1.txt)" && test "$(git rev-list --count "$S"..HEAD)" -eq 1 && D="$(git diff --name-only "$S" HEAD)" && test "$(printf '%s\n' "$D" | LC_ALL=C sort | tr '\n' ' ')" = "docs/messaging-style-guide.md tests/architecture/dependency-doc-agreement.test.ts tests/architecture/gate-targets.ts tests/architecture/messaging-guide-doc-pins.test.ts tests/architecture/partial-vocabulary-guard.test.ts tests/architecture/workflows-doc-pins.test.ts " && { git grep -qE 'messaging-style-guide|dependency-resolution|workflows-compatibility|pi-claude-marketplace-prd|README(\.es)?\.md' -- tests/architecture; test $? -eq 1; } && { git grep -qE 'doc-(pins|agreement)\.test' -- . ':!.planning'; test $? -eq 1; } && E="$(grep -oE '^export const [A-Z_]+' tests/architecture/gate-targets.ts)" && test -n "$E" && test -z "$(printf '%s\n' "$E" | awk '{print $3}' | while read -r s; do git grep -qw "$s" -- tests ':!tests/architecture/gate-targets.ts' || echo "$s"; done)" && node --test tests/architecture/catalog-uat/catalog-contract.test.ts tests/architecture/catalog-uat/catalog-parser.test.ts tests/architecture/hooks-cap-notify.test.ts tests/architecture/compat-01-no-expansion.test.ts tests/architecture/partial-vocabulary-guard.test.ts && test "$(tail -1 tmp/tbe/typecheck-1.log)" = "TYPECHECK_EXIT=0" && test "$(tail -1 tmp/tbe/lint-1.log)" = "LINT_EXIT=0" && test "$(tail -1 tmp/tbe/fallow-1.log)" = "FALLOW_EXIT=0" && test "$(tail -1 tmp/tbe/precommit-1.log)" = "PRECOMMIT_EXIT=0"</automated>
  </verify>
  <done>One commit after `tmp/tbe/start-1.txt` holds exactly six paths: the three suites deleted and the guard, the registry, and the style guide modified. No file under `tests/architecture` names a removed document, and nothing outside `.planning/` cites a deleted suite. Every `gate-targets.ts` export has an importer. The five catalog readers pass, and the typecheck, lint, fallow, and pre-commit logs end with exit 0. The Fallow audit was not `fail`.</done>
</task>

<task type="auto">
  <name>Task 2: Make docs/output-catalog.md the only documentation build input</name>
  <files>.github/workflows/ci.yml, scripts/check-changed.mjs, skills/local-verification/SKILL.md, CHANGELOG.md</files>
  <read_first>
    - .github/workflows/ci.yml (both `paths:` lists, as committed by 261004-t4g)
    - scripts/check-changed.mjs (the `documentationFiles` block and `selectDocumentation`)
    - skills/local-verification/SKILL.md (the selector paragraph under "Planning and implementation")
    - CHANGELOG.md (the `## [Unreleased]` head and the #236 entry) and .claude/rules/changelog.md
    - .agents/skills/simple-english/SKILL.md and .agents/skills/humanizer/SKILL.md
    - CONTRIBUTING.md (the paragraph that begins "`check:changed` checks the edited", verify only)
  </read_first>
  <action>
1. Run `git rev-parse HEAD > tmp/tbe/start-2.txt`.
2. Per D-01, edit `.github/workflows/ci.yml`. In each `paths:` list, seven consecutive document lines run from the `docs/dependency-resolution.md` entry through the `README.es.md` entry; replace that run with the single `docs/output-catalog.md` entry. The run is identical in both lists, so one replace-all edit covers both. Keep every comment and every other entry.
3. Per D-01, edit `scripts/check-changed.mjs`. `documentationFiles` becomes a one-line `Set` holding only `docs/output-catalog.md`. Its doc comment says this is the one document tests read, that they compare it with real `notify()` output, and that `ci.yml` lists it too. The comment on `selectDocumentation` says every test that reads the output catalog is an architecture test. `selectDocumentation` keeps adding `test:architecture` (choice 1).
4. In `skills/local-verification/SKILL.md`, replace the two sentences that start with the two READMEs and "the five documents architecture tests read by name" and end "Other documents are not build inputs." with: "`docs/output-catalog.md` runs `test:architecture`, because architecture tests compare it with real `notify()` output. No test reads any other document, so the READMEs and the other documents are not build inputs." Keep the rest of the paragraph.
5. In `CHANGELOG.md`, read the current #236 entry, then load the simple-english skill in Plain mode and the humanizer skill. Add one sub-bullet under the #236 line, after a blank line and indented two spaces, as the #221 entry does: "Tests no longer check documentation wording, so `docs/output-catalog.md` is the only document that is a build input." The top line and every other line stay unchanged, and the PR number stays on the top line only. Adjust the wording only if a self-check rejects it.
6. Leave CONTRIBUTING.md and `.planning/codebase/` unedited (choice 5).
7. Run `npm run lint > tmp/tbe/lint-2.log 2>&1; echo "LINT_EXIT=$?" >> tmp/tbe/lint-2.log` and `node scripts/check-changed.mjs --list > tmp/tbe/selection-2.json 2>&1; echo "LIST_EXIT=$?" >> tmp/tbe/selection-2.json`. Both logs end with exit 0, and the selection shows scope `broad`.
8. Run `pre-commit run --files .github/workflows/ci.yml scripts/check-changed.mjs skills/local-verification/SKILL.md CHANGELOG.md > tmp/tbe/precommit-2.log 2>&1; echo "PRECOMMIT_EXIT=$?" >> tmp/tbe/precommit-2.log` under the same rules as Task 1 step 7, until the log ends `PRECOMMIT_EXIT=0`.
9. Run the Fallow audit into `tmp/tbe/audit-2.json` as in Task 1 step 8. Stage by name: `git add .github/workflows/ci.yml scripts/check-changed.mjs skills/local-verification/SKILL.md CHANGELOG.md`, and confirm nothing else is staged. Write `tmp/tbe/commit-2.txt`: title `perf(checks): keep only the output catalog as a documentation input`; body lines of 80 characters or fewer saying that no test reads the READMEs or the other docs, so edits to them no longer start CI or commit-time checks, and that the CI paths, the selector, and the verification skill now list only `docs/output-catalog.md`. Add the attribution trailers, run the gitlint check, and commit with `git commit -F tmp/tbe/commit-2.txt`, under the same rules as Task 1 step 9.
  </action>
  <verify>
    <automated>S="$(cat tmp/tbe/start-2.txt)" && test "$(git rev-list --count "$S"..HEAD)" -eq 1 && D="$(git diff --name-only "$S" HEAD)" && test "$(printf '%s\n' "$D" | LC_ALL=C sort | tr '\n' ' ')" = ".github/workflows/ci.yml CHANGELOG.md scripts/check-changed.mjs skills/local-verification/SKILL.md " && test "$(grep -oE '^      - "(docs/|README)[^"]*"' .github/workflows/ci.yml | tr '\n' '|')" = '      - "docs/output-catalog.md"|      - "docs/output-catalog.md"|' && grep -qF 'const documentationFiles = new Set(["docs/output-catalog.md"]);' scripts/check-changed.mjs && grep -qF 'docs/output-catalog.md' skills/local-verification/SKILL.md && { git grep -qE 'README\.es\.md|(dependency-resolution|messaging-style-guide|workflows-compatibility|pi-claude-marketplace-prd)\.md' -- .github/workflows/ci.yml scripts/check-changed.mjs skills/local-verification/SKILL.md CONTRIBUTING.md; test $? -eq 1; } && awk '/\(#236\)/{n++} END{exit n!=1}' CHANGELOG.md && awk '/\(#236\)$/{f=1;next} f&&/^- /{exit} f&&/^  - .*docs\/output-catalog\.md/{ok=1} END{exit !ok}' CHANGELOG.md && test "$(tail -1 tmp/tbe/lint-2.log)" = "LINT_EXIT=0" && test "$(tail -1 tmp/tbe/selection-2.json)" = "LIST_EXIT=0" && test "$(tail -1 tmp/tbe/precommit-2.log)" = "PRECOMMIT_EXIT=0"</automated>
  </verify>
  <done>One commit after `tmp/tbe/start-2.txt` holds exactly the four paths. Both `ci.yml` lists and `documentationFiles` name `docs/output-catalog.md` as their only document, and `selectDocumentation` still runs `test:architecture`. The skill names only the catalog, and CONTRIBUTING.md names no removed document. The #236 entry is still one top-level bullet, with a sub-bullet naming the catalog. The lint, selection, and pre-commit logs end with exit 0, gitlint passed, and the Fallow audit was not `fail`.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
| --- | --- |
| changed file set -> CI trigger | The `ci.yml` `paths` lists decide whether `npm run check`, e2e, direct coverage, and the package check run. |
| changed file set -> commit-time selection | `check-changed` decides which local checks run; a non-input file selects none. |

## STRIDE Threat Register

ASVS level 1; blocking threshold `high`. No threat below is high.

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
| --- | --- | --- | --- | --- | --- |
| T-tbe-01 | Tampering | narrowed allowlist (`ci.yml`, `check-changed.mjs`) | low | mitigate | A test that still read a removed document would break unseen when that document changed. Task 1's grep proves no file under `tests/architecture` names one, and planning found no reader elsewhere (fact 1). Unfiltered backstops stay: the tag-triggered `workflow_call`, `workflow_dispatch`, and `npm run check` at PR handoff. |
| T-tbe-02 | Repudiation | removed prose gates | low | accept | Operator decision D-01. Prose accuracy returns to review. Each code fact the removed cases touched keeps its owner test ("Kept and removed cases"). |
| T-tbe-03 | Tampering | vocabulary-guard waivers | low | mitigate | The load-bearing waiver case still runs, and the guide's two waivers leave with the guide, so every remaining waiver still has a file to silence. |
| T-tbe-SC | Tampering | npm/pip/cargo installs | low | accept | This plan installs no package. |
</threat_model>

<verification>
Both task `<verify>` commands pass on the committed tree. Task 1's pre-commit run includes the whole `test:architecture` suite (fact 6), and that suite includes `no-stale-test-citations`. Do not run `npm run check`. The member gate and the integration suite run at PR handoff.
</verification>

<success_criteria>
- Three suites deleted; the guard, the registry, and the style guide trimmed; the five catalog readers pass.
- `docs/output-catalog.md` is the only document in both `ci.yml` lists, in `check-changed.mjs`, and in the local-verification skill. The #236 changelog entry says so.
- Two commits; every recorded exit code is 0; `.planning/STATE.md` was never staged.
</success_criteria>

## Source audit

| Source | Item | Plan coverage | Status |
| --- | --- | --- | --- |
| GOAL | Doc-agreement tests leave the build; the catalog is the only documentation input | Tasks 1-2 | COVERED |
| CONTEXT | D-01: delete prose-pinning tests, keep every catalog-vs-`notify()` test | Task 1 | COVERED |
| CONTEXT | D-01: trim only the guard's style-guide and PRD parts | Task 1 step 3 | COVERED |
| CONTEXT | D-01: prune `VOCABULARY_GUARD_DOC_TARGETS`; every export keeps an importer | Task 1 step 4, verify | COVERED |
| CONTEXT | D-01: citations of deleted suites in `extensions/`, `tests/`, and docs | Task 1 step 5, verify | COVERED |
| CONTEXT | D-01: four allowlist places in sync, anchored on content | Task 2 steps 2-4, 6 | COVERED |
| CONTEXT | D-01: CHANGELOG #236 and `.planning/codebase/` | Task 2 step 5; choice 5 | COVERED |
| REQ | TBE-01 to TBE-04 | Requirement map | COVERED |
| RESEARCH | None: the orchestrator asked for no research | - | N/A |

<output>
Create `.planning/quick/261004-tbe-remove-doc-agreement-tests-keep-only-out/261004-tbe-SUMMARY.md`. Record both commit SHAs, the last line of every `tmp/tbe/*.log`, the scope each pre-commit run selected, both Fallow audit verdicts, the final changelog wording, and "focused task verification passed; full phase/PR verification pending". Include:

```markdown
## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.
```

Replace "None" with specifics if execution finds otherwise.
</output>
