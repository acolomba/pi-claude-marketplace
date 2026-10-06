---
phase: 261004-kwl
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - eslint.config.js
  - tests/architecture/import-boundaries.test.ts
  - tests/architecture/gate-targets.ts
  - tests/architecture/no-test-only-production-surface.test.ts
  - tests/architecture/no-orchestrator-network.test.ts
  - tests/architecture/gate-targets.test.ts
  - tests/architecture/compat-01-no-expansion.test.ts
  - tests/architecture/source-scan.ts
  - tests/architecture/marketplace-tag-probe-offline.test.ts
  - tests/architecture/reconcile-planner-purity.test.ts
  - tests/architecture/hooks-lifecycle.test.ts
  - tests/architecture/extension-version-sync.test.ts
  - tests/edge/handlers/plugin/fetch.test.ts
  - tests/orchestrators/plugin/install-flow.test.ts
  - tests/orchestrators/plugin/list-flow.test.ts
  - extensions/pi-claude-marketplace/orchestrators/auth-host.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/clone-cache.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/clone-gc.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/dependency-declaration-read.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/dependency-tag-probe.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/fetch.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/git-source-probe.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/info.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-outcome.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/list-flow.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/marketplace-tag-probe.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/plugin-state-classifier.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/update-constraint-gate.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/update-preflight.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/workflows-staging-gc.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/notify.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/pending.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/README.md
  - docs/competitive-analysis/asermax-pi-cc-plugins.md
  - docs/competitive-analysis/pi-plugins.md
  - docs/competitive-analysis/zmarketplace.md
  - tests/architecture/unowned-exports-census.test.ts
  - tests/architecture/fallow-report.ts
  - tests/architecture/fallow-production-mode.test.ts
  - tests/architecture/eslint-effective-config.test.ts
  - tests/architecture/eslint-effective-config.ts
  - tests/architecture/unit-suite-glob-completeness.test.ts
  - tests/architecture/unused-type-member-gate.test.ts
  - tests/domain/components/hook-events.test.ts
  - tests/shared/notify-reasons.test.ts
  - tests/architecture/notify-closed-set-locks.test.ts
  - tests/shared/notification-types.test.ts
autonomous: true
requirements: [KWL-01, KWL-02, KWL-03, KWL-04, KWL-05, KWL-06, KWL-07]

estimate:
  tokens: 120000
  raw_tokens: 120000
  tasks: 3
  confidence: low

must_haves:
  truths:
    - "D-03: BLOCK C of eslint.config.js carries four ledger zones after its eight layer zones. No file in orchestrators/marketplace/ may import a plugin ledger (install-flow, update-flow, uninstall, reinstall-flow, enable-disable); no plugin ledger may import a marketplace ledger (add, remove, update, autoupdate); no plugin ledger may import another plugin ledger; no marketplace ledger may import another marketplace ledger. Type-only, export-from, and dynamic imports count. tests/architecture/import-boundaries.test.ts is gone, with its fallow-script pin and its zone-matrix cases."
    - "D-02: eslint.config.js declares `const NETWORK_FREE_TARGETS = [` with the 27 paths gate-targets.ts carried (each exists; update-flow.ts and update-preflight.ts are not listed), and BLOCK F applies to exactly those files. There, no-restricted-imports rejects any `platform/git` specifier, type-only included, and no-restricted-syntax rejects a dynamic or type-position import() of platform/git and every identifier, key, string, or template text naming gitOps, DEFAULT_GIT_OPS, or refreshGitHubClone. The IL-2 output selectors and the Pi peer-import restriction still fire on those files. tests/architecture/no-orchestrator-network.test.ts is gone, and gate-targets.ts no longer declares the list."
    - "D-04: each new rule was shown to fire on lint-only offenders passed to ESLint's lintText (nothing written to disk, nothing committed), an exempt file stayed free of NFR-5 messages, and the real tree passes `npm run lint` in each commit's pre-commit run."
    - "D-01: tests/architecture/{unowned-exports-census.test.ts, fallow-report.ts, fallow-production-mode.test.ts, eslint-effective-config.test.ts, eslint-effective-config.ts, gate-targets.test.ts, unit-suite-glob-completeness.test.ts, unused-type-member-gate.test.ts} are gone. The planted-compile loop in hook-events.test.ts, the partition-control block in notify-reasons.test.ts, and the module-scope proofs asserting `false` in notify-closed-set-locks.test.ts and notification-types.test.ts are gone, while each file's real-tree exactness proofs remain."
    - "D-05 / D-06: every kept test passes. compat-01's network delegation case is deleted, because BLOCK F enforces NFR-5 directly, and no test reads eslint.config.js or package.json script strings in its place. No file under docs/, extensions/, tests/, skills/, .agents/, scripts/, AGENTS.md, or CONTRIBUTING.md names a deleted test, and no extension comment places the network list in gate-targets.ts. Every remaining gate-targets.ts export (21) has an importer under tests/. Every edited extension file keeps its line count, so `npm run lint:type-members` still passes. CHANGELOG.md and .planning/codebase/*.md are unchanged."
    - "Final: one explicit `npm run check`, started from an empty ESLint cache on the Task 3 commit, exits 0. Its seconds, the unit test count (planned 8399 -> 8364, 35 cases removed), the unit and integration duration_ms, and the per-commit pre-commit records are written to the SUMMARY beside the 669 s / 8399 baseline."
  artifacts:
    - path: "eslint.config.js"
      provides: "BLOCK C ledger zones (D-11) and BLOCK F network-free rules (NFR-5), with the IL-2 selectors and the Pi peer-import path hoisted so BLOCK F can restate them"
      contains: "const NETWORK_FREE_TARGETS = ["
    - path: "tests/architecture/compat-01-no-expansion.test.ts"
      provides: "COMPAT-01 gate without the network delegation case; its header points at BLOCK F for the network axis"
      contains: "COMPAT-01: the default state declares the current schema version"
    - path: "tests/architecture/gate-targets.ts"
      provides: "Registry pruned to the 21 exports that still have importers"
      contains: "export const MARKETPLACE_LEDGER_TARGETS = ["
    - path: "tests/architecture/no-test-only-production-surface.test.ts"
      provides: "Classified-seam targets without the moved network-list annotation"
      contains: "MARKETPLACE_LEDGER_TARGETS"
  key_links:
    - from: "eslint.config.js BLOCK F"
      to: "NETWORK_FREE_TARGETS"
      via: "the block's `files` key is the moved list itself"
      pattern: "files: NETWORK_FREE_TARGETS"
    - from: "eslint.config.js BLOCK F rules"
      to: "BLOCK A and BLOCK E options"
      via: "restated through OUTPUT_DISCIPLINE_SELECTORS and PI_PEER_IMPORT_RESTRICTION, because a later block replaces a rule's options"
      pattern: "...NETWORK_FREE_SYNTAX_SELECTORS"
    - from: "eslint.config.js BLOCK C zones"
      to: "PLUGIN_LEDGERS and MARKETPLACE_LEDGERS"
      via: "four zones that use the two ledger lists as target and from"
      pattern: "from: PLUGIN_LEDGERS"
    - from: ".pre-commit-config.yaml npm-check-changed"
      to: "npm run lint"
      via: "an eslint.config.js change selects the broad check, which lints the whole tree with the new rules"
      pattern: "entry: npm run check:changed"
---

# Replace the network and ledger gates with ESLint rules; remove tooling self-tests

<objective>
Move two architecture guarantees out of tests and into `eslint.config.js`, and delete the tooling self-tests the user no longer wants (D-01 to D-07). Each guarantee is then enforced once, by the tool that owns it.

Purpose: the user reviewed every remaining tooling-focused test with failure examples and decided to trust the toolset. The NFR-5 network-free rule and the D-11 ledger rule become lint rules that report at the offending line. The self-tests of Fallow's scope, the export census, the unit-suite glob, the type-member wiring, the registry, the effective ESLint config, and the compile-time controls go.

Output:

- Task 1 (tracer): BLOCK C gains the four D-11 ledger zones. Lint-only offenders prove each zone fires, and `tests/architecture/import-boundaries.test.ts` is deleted with the two registry groups only it read.
- Task 2: BLOCK F enforces NFR-5 on the moved `NETWORK_FREE_TARGETS` list. Lint-only offenders prove it. `no-orchestrator-network.test.ts` and the registry gate `gate-targets.test.ts` are deleted, and so is compat-01's network delegation case. no-test-only-production-surface stops reading the moved list, and every citation is rewritten without moving a type-member pin.
- Task 3: the remaining tooling self-tests and the type-gate self-tests are deleted, and the registry is pruned to exports with importers. One explicit `npm run check` then measures the finished tree against the 669 s / 8399-test baseline.
</objective>

## Requirement map

D-01 to D-07 below are this task's labels for the user's seven numbered decisions. They are not project decision IDs. Never cite D-01..D-07 or KWL-NN in code comments, test titles, assertion messages, or commit messages. The IDs that do belong in code are the project's own: NFR-5, PI-2, PL-3, PRL-07, D-11, D-98-09, D-07-05, COMPAT-01, IL-2.

| ID     | Decision | Outcome                                                                                                                   | Task    |
| ------ | -------- | ------------------------------------------------------------------------------------------------------------------------- | ------- |
| KWL-01 | D-01     | Tooling self-tests, their helper-only files, and the type-gate self-tests deleted; real-tree proofs kept                   | 2, 3    |
| KWL-02 | D-02     | NFR-5 network-free block in eslint.config.js, list moved there; `no-orchestrator-network.test.ts` and compat-01's network delegation case deleted | 2       |
| KWL-03 | D-03     | D-11 ledger zones in BLOCK C; `import-boundaries.test.ts` deleted with its fallow-script pin and zone-matrix cases          | 1       |
| KWL-04 | D-04     | Each new rule fires on lint-only offenders; nothing planted on disk or committed                                           | 1, 2    |
| KWL-05 | D-05     | `tests/scripts` analyzer tests and every other architecture test kept; only tests that read moved data adapt, and a clause that would need to parse tooling config is deleted, not re-pointed | 1, 2, 3 |
| KWL-06 | D-06     | Citations of deleted tests rewritten; registry exports that lost all importers deleted; CHANGELOG.md and `.planning/codebase/` untouched | 1, 2, 3 |
| KWL-07 | D-07     | ESLint content cache left on for task hooks; final explicit `npm run check` from an empty cache, with metrics             | 3       |

## Inventory

Counts are `node:test` cases, measured by running the deleted files at HEAD 5e161ce3. Planned removal is 35 cases, so the unit suite should drop from 8399 to 8364. Task 3 measures the real number, and that measured number is authoritative.

| Task | Delete | Adapt | Cases |
| ---- | ------ | ----- | ----- |
| 1 | `tests/architecture/import-boundaries.test.ts`; registry `ZONE_FOLDER_TARGETS`, `PLUGIN_LEDGER_TARGETS` | eslint.config.js (CFG-1 to CFG-3); gate-targets.ts docs (TXT-1, TXT-2); no-test-only-production-surface comment (TXT-3) | -5 |
| 2 | `tests/architecture/no-orchestrator-network.test.ts`, `tests/architecture/gate-targets.test.ts`; compat-01's network delegation case and the constant only it read; registry `NETWORK_FREE_TARGETS` (moved) | eslint.config.js (CFG-4 to CFG-7); gate-targets.ts header (TXT-4); compat-01 header and import (TXT-6, TXT-7, TXT-9); no-test-only-production-surface (TXT-10 plus constants); CIT-01 to CIT-34 | -10 |
| 3 | `tests/architecture/{unowned-exports-census.test.ts, fallow-report.ts, fallow-production-mode.test.ts, eslint-effective-config.test.ts, eslint-effective-config.ts, unit-suite-glob-completeness.test.ts, unused-type-member-gate.test.ts}`; the hook-events planted-compile loop (2 cases); the type controls in notify-reasons, notify-closed-set-locks, notification-types (no cases); 17 registry exports | gate-targets.ts (registry prune, TXT-12); notify-closed-set-locks doc (TXT-11) | -20 |

Task 3's case count is census 4, production mode 2, effective config 3, unit glob 3, type-member wiring 6, and the hook-events loop 2.

Kept on purpose: every `tests/scripts/` analyzer test; every other `tests/architecture/` gate; the `@ts-expect-error` negatives on production types (for example "Events outside bucket A are not admitted"), because they test the production type, not the test's own proof helper; the compile-time proof in `tests/orchestrators/plugin/list-flow.test.ts` that list options expose no Git transport.

## Choices made within the decisions

1. Ledger scope (D-03). D-03 lists three bans: plugin ledgers do not import each other, marketplace ledgers do not import each other, and the plugin and marketplace families do not import across. The deleted test enforced only the two cross-family directions, so the two intra-family zones are new restrictions. They pass today: no ledger imports a ledger of its own family. Not covered: a type-position `import("../plugin/install-flow.ts")` in a marketplace file. The deleted test's dynamic-import regex matched that text, but import-x's module visitor never visits a type-position import. Covering it would need a composed `no-restricted-syntax` on the ledger files, which overlap the network-free list. This gap is recorded as accepted (T-kwl-04).
2. Flat-config composition (D-02). A later block that sets a rule's options replaces the earlier options for the files it matches. This was measured: a block that set `no-restricted-syntax` for `info.ts` alone silently dropped BLOCK A's `console.log` selector on that file. So BLOCK A's seven selectors and BLOCK E's Pi peer-import path move into constants, and BLOCK F restates both. The core `no-restricted-imports` rule is used, as D-02 names it.
3. Network forms (D-02). The deleted test banned the git surface anywhere outside comments: static, type-only, and dynamic imports of a `platform/git*` specifier, plus the three tokens anywhere. So the selectors also cover a type-position `import()`, string and template text, and a `#gitOps` private name. Planning measured zero hits for these selectors on the 27 listed files.
4. Rename safety (D-02, D-03). An ESLint `files` entry or zone path that stops matching is silent. The deleted network test failed on a missing target (WR-06). This risk is accepted under the user's decision to trust the toolset (T-kwl-03). Task 2 checks once that every listed path exists. Not taken: an existence assertion that runs when the ESLint config loads.
5. Lint-only offenders (D-04). Offenders go to ESLint's `lintText` with the real config and a real `filePath`. Nothing is written to disk, so nothing can be committed. The operator may be editing files in this checkout at the same time. This follows the guideline's manual plant-and-remove steps without touching the tree. The tree is proven clean by `npm run lint` in each commit's pre-commit run.
6. Order. `gate-targets.test.ts` goes in Task 2, not Task 3. Its D-07-06 scan rejects gate files that spell a production path the registry does not carry, and `orchestrators/plugin/fetch.ts`, which no-test-only-production-surface spells after Task 2, appears only in the network list. Its survey also asserts that it opened `no-orchestrator-network.test.ts`. `import-boundaries.test.ts` goes in Task 1, because it asserts exactly eight zones per file.
7. compat-01 delegation (D-01, D-05; coordinator revision). The network delegation case is deleted, not re-pointed. Its only job was to prove both info surfaces stay in the network test's target list, and re-pointing it at `eslint.config.js` would make it a test that parses tooling config, which is what the user asked to remove. BLOCK F enforces NFR-5 directly. The constant only that case read goes with it, and the header's network paragraph becomes a pointer to BLOCK F. No other kept test is re-pointed at `eslint.config.js` or at `package.json` script strings. `ESLINT_CONFIG_REL` then has no importer once `eslint-effective-config.ts` goes, so Task 3 deletes it. Accepted consequence: removing an info surface from `NETWORK_FREE_TARGETS` now passes silently (T-kwl-03).
8. no-test-only-production-surface (D-05). The four plugin-owner constants were annotated with the moved list. They become plain literals. `MARKETPLACE_LEDGER_TARGETS` stays in the registry because the two marketplace constants still use it as their annotation, so the four marketplace ledger paths now appear in both `eslint.config.js` and `gate-targets.ts`. Not taken: re-annotating those two constants with `CREDENTIAL_LEAK_TARGETS` and deleting the group.
9. Registry prune (D-06). The prune is driven by a consumer grep, not by Fallow. Fallow's production dead-code run does not analyze `tests/` (measured with `--trace`). `DIRECTORY_ROOT_TARGETS` and `REPO_MANIFEST_TARGETS` are deleted, because only the deleted registry gate imported them. The six root and manifest constants they typed that keep importers become plain literals; `ESLINT_CONFIG_REL`, `HOOKS_BRIDGE_REL`, and `ARCHITECTURE_DIR_REL` have none and are deleted. Making the two groups module-private would fail `@typescript-eslint/no-unused-vars` ("only used as a type"), which was measured.
10. Type-member pins (D-06). `scripts/check-unused-type-members.contracts.json` pins declarations by `file:line:col`, and 9 of the 18 extension files Task 2 edits carry pins. Every CIT replacement in `extensions/` therefore keeps its exact line count. Task 2 runs `npm run lint:type-members`, because the commit hook never does.
11. Citation scope (D-06). The rewrites cover every by-name citation of a deleted test in docs/, extensions/, and tests/, plus the four extension comments that place the network list in `gate-targets.ts`. They also cover two comments (hooks-lifecycle, extension-version-sync) that describe the registry's literal scan, which Task 2 deletes. Generic "network-free gate" phrasing that names no file stays. skills/, .agents/, AGENTS.md, CONTRIBUTING.md, docs/adr, docs/plans, and docs/research cite none of the deleted tests (measured), so they need no edit. Two stale facts inside rewritten sentences are corrected: clone-gc's comment said `uninstall.ts` is not gated, but it is listed; list-flow.test's header described a source grep where the file has a compile-time proof. Other staleness found during planning is reported only (see Out of scope).
12. Final measurement (D-07). The task hooks keep the ESLint content cache, which is safe for these file-local rules. The ESLint cache is deleted only before the final `npm run check`, so its duration compares with the 669 s baseline, which also started from an empty cache.

Out of scope (report, do not edit): the reconcile README "Preview path" section describes `preview.ts`, which no longer exists. `workflows-staging-gc.ts` names `install.ts`, which no longer exists. `.planning/codebase/*.md` still describes both deleted gates.

<assumption_delta_decision>
One real transition: two architecture rules each had a test plus a list in the test registry. They now have one enforcement point, the ESLint config, which also owns the network list.

- Primary noun: `eslint.config.js` is the single enforcement point for NFR-5 network-free modules and D-11 ledger imports. `NETWORK_FREE_TARGETS` lives only there.
- Decision: promote. The network list moves rather than being copied, and the tests that enforced both rules are deleted rather than kept alongside.
- Accepted debt: `MARKETPLACE_LEDGER_TARGETS` stays in the registry as a type annotation source for two constants (choice 8). A later edit to the marketplace ledger set has to touch both files.
- What would force a later change: a renamed listed file or ledger, which ESLint skips silently (T-kwl-03). The remedy is an existence check where the config loads, not a new test.
</assumption_delta_decision>

<execution_context>
@.claude/gsd-core/workflows/execute-plan.md
@.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@AGENTS.md
@skills/local-verification/SKILL.md
@skills/typescript-comments/SKILL.md
@eslint.config.js
@tests/architecture/gate-targets.ts
@.planning/quick/261004-f34-remove-negative-controls-and-planted-vio/261004-f34-SUMMARY.md

Facts measured during planning (2026-10-04, HEAD 5e161ce3, branch `features/faster-precommit`, main checkout, Node v26.10.0, ESLint 10.11.0, typescript-eslint 8.70.1, eslint-plugin-import-x 4.17.1). Rely on them instead of re-deriving them:

1. Baseline, reused. `git diff --stat f07734d1 HEAD -- . ':(exclude).planning'` shows only CHANGELOG.md (+2 lines), so quick task 261004-f34's final run is the baseline (`/tmp/f34-final.txt`, `/tmp/f34-final-check.log`): `npm run check` exit 0 in 669 s, ESLint cache empty at start. Unit: `tests 8399, suites 333, pass 8399, fail 0, cancelled 0, skipped 0, todo 0, duration_ms 329656.027673`. Integration: `tests 67, suites 0, pass 67, fail 0, cancelled 0, skipped 0, todo 0, duration_ms 12633.896838`.
2. Flat-config replacement is real. With an extra block that set `no-restricted-syntax` for `info.ts` alone, `console.log` in `info.ts` lost its IL-2 message, and `update-flow.ts` kept it. Hence CFG-4.
3. Grounding of the Task 2 design. CFG-6 and CFG-7, composed as specified, fire on a type-only `platform/git` import, a dynamic import of `platform/git-credential.ts`, a type-position `import()`, an interface member, an import specifier, an `export { … } from`, a `#gitOps` private name, a string key, a computed string access, and template text. They stay quiet on `gitOpsSeam`, `cloneCacheSeam`, and comments. The 27 listed files give zero hits, a listed file keeps its IL-2 and Pi peer-import messages, and `update-flow.ts` gets no NFR-5 message.
4. Grounding of the Task 1 design. The four CFG-2 zones fire on type-only, value, export-from, and dynamic imports. They stay quiet on `marketplace/update.ts` importing `../plugin/update-row.ts` and on `plugin/bootstrap.ts` importing `../marketplace/add.ts`. The current `orchestrators/` tree gives zero zone hits. The Task 1 verify script exits 1 on today's config, so it can tell the two configs apart.
5. Rule coverage. import-x's module visitor checks import and export declarations (type-only included) and dynamic `import()`, but not a type-position `import()`. Core `no-restricted-imports` supports `regex` patterns and reports type-only imports, but ignores dynamic `import()`; CFG-6 covers that. ESLint 10 has no `unix` formatter: use the `ESLint` API or `--format json`.
6. Type-member pins. `scripts/check-unused-type-members.contracts.json` pins `file:line:col` in 59 extension files. Task 2 edits nine of them: `dependency-tag-probe.ts`, `enable-disable.ts`, `info.ts`, `install-outcome.ts`, `list-flow.ts`, `marketplace-tag-probe.ts`, `update-constraint-gate.ts`, `update-preflight.ts`, `reconcile/notify.ts`. A comment edit that changes the line count above a pinned declaration makes `npm run lint:type-members` exit 2. `scripts/test-coverage-direct.pin.json` has no rows.
7. `@typescript-eslint/no-unused-vars` reports a module-private const that is read only through `typeof` ("is assigned a value but only used as a type").
8. Fallow. The production dead-code run does not see `tests/`: `--trace tests/architecture/gate-targets.ts:HOOKS_BRIDGE_REL` returns "not found". The non-production trace credits only the registry gate's namespace import, so registry orphans need a consumer grep. The `eslint` package stays credited to the `lint` script after its last test importer is deleted.
9. Registry consumers after all three tasks, from grep: 21 exports keep importers. Removed: Task 1 `ZONE_FOLDER_TARGETS`, `PLUGIN_LEDGER_TARGETS`; Task 2 `NETWORK_FREE_TARGETS`; Task 3 `DIRECTORY_ROOT_TARGETS`, `HOOKS_BRIDGE_REL`, `ARCHITECTURE_DIR_REL`, `REPO_MANIFEST_TARGETS`, `ESLINT_CONFIG_REL`, `NO_CONSOLE_EXEMPT_TARGETS`, `ZONE_REPRESENTATIVE_TARGETS`, `COMPLETION_DESCRIPTION_TARGETS`, `UNUSED_TYPE_MEMBER_GATE_TARGETS`, `TYPE_MEMBER_GATE_REL`, `TYPE_MEMBER_EXCEPTIONS_REL`, `WORKFLOWS_BRIDGE_TARGETS`, `WORKFLOWS_STAGING_SCAN_TARGETS`, `WORKFLOWS_SCRIPT_TARGETS`, `WORKFLOWS_MARKER_COVERAGE_TARGETS`, `UNOWNED_EXPORT_CENSUS`, `PRODUCTION_FINDING_CENSUS`. Every plugin-ledger path stays registered through other groups, so Task 1's prune keeps the registry gate green until Task 2 deletes it.
10. Citations. git grep, excluding `.planning/` and CHANGELOG.md, finds exactly the sites in CIT-01 to CIT-34, TXT-3, the compat-01 texts (TXT-6, TXT-7, TXT-9), and compat-01's network delegation case. `no-stale-test-citations.test.ts` polices only `tests/...` paths in docs/, extensions/, and tests/. The bare-name citations are rewritten anyway (D-06).
11. Commits. No git hook fires on `git commit` in this checkout, so run `pre-commit run --verbose --files …` yourself before each commit. The `prettier` and `mdformat` hooks rewrite files: run them first and restage. Pass only paths that exist. Stage deletions with `git rm`; the always-run changed-check hook reads them from git. CHANGELOG.md is committed and must not change. Stage explicit paths only, never `git add -A`, because the operator may edit files in this checkout during the run. Never revert a file with `git checkout --`.
12. Hook cost. An `eslint.config.js` change selects the broad check, and the changed config relints the whole tree (Tasks 1 and 2). Task 2 also selects direct coverage for 18 extension pairs and their consumer tests. Run the Task 1 and Task 3 hooks in the foreground with a 600000 ms timeout. Run Task 2's hook in the background once and wait for its completion notification. Never pipe a hook and never poll it.
13. Comment rules (`skills/typescript-comments/SKILL.md`, AGENTS.md). Comments describe the code as it stands, cite durable IDs only, and never say "no longer", "used to", "removed", or "formerly". `eslint.config.js` follows the same rules.
14. Edits in large files. Before each Edit, read only the cited line window (offset and limit). `info.ts` has more than 2000 lines.
</context>

## Exact config and text

Apply these verbatim. An OLD/NEW pair lists whole lines. Replace exactly the OLD lines with the NEW lines. In `extensions/`, every NEW block has the same number of lines as its OLD block (fact 6). Prettier does not rewrap comments, so keep the lines as written.

### CFG-1 (Task 1): ledger lists

Declare these after the imports and before `export default`, with this comment:

```text
/**
 * D-11: the plugin and marketplace ledger entry points, as BLOCK C zone paths.
 * A ledger owns a transactional verb end to end. Their `*-probe`, `*-swap`,
 * `*-record`, `*-row`, and `*-outcome` siblings are helpers and leaf
 * composers, and `orchestrators/plugin/bootstrap.ts` is a composer whose job
 * is calling marketplace verbs, so none of them is listed.
 */
const PLUGIN_LEDGERS = [
  "./extensions/pi-claude-marketplace/orchestrators/plugin/install-flow.ts",
  "./extensions/pi-claude-marketplace/orchestrators/plugin/update-flow.ts",
  "./extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts",
  "./extensions/pi-claude-marketplace/orchestrators/plugin/reinstall-flow.ts",
  "./extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts",
];

const MARKETPLACE_LEDGERS = [
  "./extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts",
  "./extensions/pi-claude-marketplace/orchestrators/marketplace/remove.ts",
  "./extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts",
  "./extensions/pi-claude-marketplace/orchestrators/marketplace/autoupdate.ts",
];
```

### CFG-2 (Task 1): four zones appended to BLOCK C

Append these after the `shared` zone, in this order:

```text
{ target: "./extensions/pi-claude-marketplace/orchestrators/marketplace", from: PLUGIN_LEDGERS,
  message: "D-11: orchestrators/marketplace/ must not import a plugin ledger module. Import the leaf row composer (plugin/update-row.ts), a shared type from orchestrators/types.ts, or the injected pluginUpdate seam instead." }
{ target: PLUGIN_LEDGERS, from: MARKETPLACE_LEDGERS,
  message: "D-11: a plugin ledger must not import a marketplace ledger module. Only orchestrators/marketplace/shared.ts is reachable from a plugin ledger." }
{ target: PLUGIN_LEDGERS, from: PLUGIN_LEDGERS,
  message: "D-11: plugin ledger modules must not import each other." }
{ target: MARKETPLACE_LEDGERS, from: MARKETPLACE_LEDGERS,
  message: "D-11: marketplace ledger modules must not import each other." }
```

### CFG-3 (Task 1): BLOCK C comment

OLD:

```text
    // BLOCK C (D-11): Import-direction enforcement. 8-zone no-restricted-paths
    // mapping: each folder declares which sibling folders MUST NOT import from
    // it (i.e. enforces the upward/inward direction of the dep graph).
```

NEW:

```text
    // BLOCK C (D-11): Import-direction enforcement. The first eight zones map
    // each layer folder to the sibling folders that MUST NOT import from it
    // (i.e. they enforce the upward/inward direction of the dep graph). The
    // last four keep the ledger modules apart, type-only and dynamic imports
    // included: no orchestrators/marketplace/ file imports a plugin ledger, no
    // plugin ledger imports a marketplace ledger, and no ledger imports another
    // ledger of its own kind. Cycle detection reports a cycle only once the
    // graph is already circular, so these zones stop the first edge.
```

### CFG-4 (Task 2): hoisted shared options

- `OUTPUT_DISCIPLINE_SELECTORS`: a top-level const holding BLOCK A's seven `{ selector, message }` objects, verbatim and in the same order. BLOCK A keeps its comment, and its rule becomes `"no-restricted-syntax": ["error", ...OUTPUT_DISCIPLINE_SELECTORS]`.
- `PI_PEER_IMPORT_RESTRICTION`: a top-level const holding BLOCK E's single `paths` element verbatim. BLOCK E becomes `paths: [PI_PEER_IMPORT_RESTRICTION]`.
- Nothing else in BLOCK A or BLOCK E changes. Prettier decides how the composed rule arrays wrap; the checks do not depend on it.

Comment above the two constants:

```text
// Options BLOCK A and BLOCK E apply to the whole extension. BLOCK F restates
// them for the network-free files, because a later block that sets a rule's
// options replaces the earlier options for the files it matches.
```

### CFG-5 (Task 2): the moved list

Declare it after the imports and before `export default`, with the exact opening line `const NETWORK_FREE_TARGETS = [` and the closing line `];`. The Task 2 verify script anchors on both. The body is today's `tests/architecture/gate-targets.ts` lines 39-144, verbatim: all 27 entries with the comment lines above each, in the same order. Doc comment:

```text
/**
 * NFR-5 / PI-2 / PL-3 / PRL-07: every module that must name no git surface of
 * its own. BLOCK F applies to exactly these files. That is a narrower claim
 * than "performs no network operation", and the membership splits two ways.
 * Most targets are network-free by contract -- the read surfaces (`list`,
 * plugin `info`, marketplace `info`), the reconcile pending/planner/projection
 * family, both reinstall owners (cached manifests only), and the resolver, one
 * file OUTSIDE the orchestrator layer. The resolver inherits its obligation
 * from the two read surfaces it answers for. The others are MUTATING verbs
 * that do reach git -- `install-flow.ts` and `fetch.ts` materialize a clone on
 * a cache miss, and `enable-disable.ts` re-materializes through the install
 * ledger -- and they qualify because they reach it ONLY through the
 * `clone-cache.ts` seam, by entrypoint name.
 *
 * The rule is per file, which a fallow boundary zone cannot express:
 * `orchestrators` -> `platform` is a legal edge for `update-flow.ts`,
 * `clone-cache.ts`, and `auth-host.ts`, and fallow zones are directory-scoped.
 *
 * Exempt files (do NOT add):
 *   - `orchestrators/plugin/update-flow.ts` and `update-preflight.ts`: PUP-2
 *     `syncClone` REQUIRES gitOps; they legitimately name the `GitOps` surface
 *     via the `orchestrators/marketplace/shared.ts` re-export (Pattern S-9).
 */
```

### CFG-6 (Task 2): network selectors

`NETWORK_FREE_SYNTAX_SELECTORS` is a top-level const array of these five `{ selector, message }` objects, in this order. The values are written as they must appear in JavaScript source, escapes included:

```text
selector: "ImportExpression[source.value=/platform\\/git/]"
message:  "NFR-5: network-free modules must not dynamically import a platform/git module."

selector: "TSImportType Literal[value=/platform\\/git/]"
message:  "NFR-5: network-free modules must not name a platform/git type through import()."

selector: ":matches(Identifier, PrivateIdentifier)[name=/^(?:gitOps|DEFAULT_GIT_OPS|refreshGitHubClone)$/]"
message:  "NFR-5: network-free modules must not name gitOps, DEFAULT_GIT_OPS, or refreshGitHubClone. Only update-flow.ts and update-preflight.ts may name the git seam."

selector: "Literal[value=/\\b(?:gitOps|DEFAULT_GIT_OPS|refreshGitHubClone)\\b/]"
message:  "NFR-5: network-free modules must not spell gitOps, DEFAULT_GIT_OPS, or refreshGitHubClone in a string."

selector: "TemplateElement[value.raw=/\\b(?:gitOps|DEFAULT_GIT_OPS|refreshGitHubClone)\\b/]"
message:  "NFR-5: network-free modules must not spell gitOps, DEFAULT_GIT_OPS, or refreshGitHubClone in a string."
```

### CFG-7 (Task 2): BLOCK F

Place a new config object directly after BLOCK E. Its key is `files: NETWORK_FREE_TARGETS`. Its rules are:

- `"no-restricted-imports"`: `["error", { paths: [PI_PEER_IMPORT_RESTRICTION], patterns: [{ regex: "platform/git", message: "NFR-5: network-free modules must not import a platform/git module, type-only imports included. Reach git through orchestrators/plugin/clone-cache.ts by entrypoint name." }] }]`
- `"no-restricted-syntax"`: `["error", ...OUTPUT_DISCIPLINE_SELECTORS, ...NETWORK_FREE_SYNTAX_SELECTORS]`

Its comment:

```text
    // BLOCK F (NFR-5 / PI-2 / PL-3 / PRL-07): the modules in NETWORK_FREE_TARGETS
    // name no git surface: no platform/git import of any kind (type-only and
    // dynamic included) and no gitOps / DEFAULT_GIT_OPS / refreshGitHubClone
    // identifier, key, or string. Both rules restate the extension-wide options
    // of BLOCK A and BLOCK E, because a later block that sets a rule's options
    // replaces the earlier options for the files it matches.
```

### TXT-1 (Task 1): `tests/architecture/gate-targets.ts`, `ORCHESTRATORS_REL` doc

OLD:

```text
/** The orchestrator layer. Root of the D-11 ledger walk and the cast-read walk. */
```

NEW:

```text
/** The orchestrator layer. Root of the cast-read walk. */
```

### TXT-2 (Task 1): `tests/architecture/gate-targets.ts`, `MARKETPLACE_LEDGER_TARGETS` doc

OLD:

```text
/**
 * D-11: the four marketplace ledger entry points, the other half of the
 * no-ledger-imports-a-ledger pair. A plugin ledger reaches marketplace code only
 * through `orchestrators/marketplace/shared.ts`.
 */
```

NEW:

```text
/**
 * D-11: the four marketplace ledger entry points. BLOCK C in `eslint.config.js`
 * keeps the ledgers from importing each other; a plugin ledger reaches
 * marketplace code only through `orchestrators/marketplace/shared.ts`.
 */
```

### TXT-3 (Task 1): `tests/architecture/no-test-only-production-surface.test.ts` lines 96-98

OLD:

```text
 * Non-global on purpose -- a `/g` regex carries `lastIndex` across `.test()`
 * calls and would skip every second file of a 200-file walk, which
 * `import-boundaries.test.ts` already records for the same reason.
```

NEW:

```text
 * Non-global on purpose -- a `/g` regex carries `lastIndex` across `.test()`
 * calls and would skip every second file of a 200-file walk.
```

### TXT-4 (Task 2): `tests/architecture/gate-targets.ts` header lines 4-9

OLD:

```text
 * D-07-05: every gate under `tests/architecture/` names the production files it
 * guards through a group exported from here, and composes no path of its own.
 * Each entry is a FULL literal repository-relative path -- never a joined
 * segment, never a template -- so one literal-match scan of this file sees every
 * guarded target. A composed entry defeats that in the only way that matters: it
 * makes a stale path invisible to the scan that exists to find stale paths.
```

NEW:

```text
 * D-07-05: a target group that more than one gate reads lives here. Each entry
 * is a FULL literal repository-relative path -- never a joined segment, never a
 * template -- so a search for a path finds every group that names it.
```

TXT-5 is intentionally unused: `ESLINT_CONFIG_REL` keeps its doc until Task 3 deletes it.

### TXT-6 (Task 2): `tests/architecture/compat-01-no-expansion.test.ts` lines 43-51

OLD:

```text
 *   Network (COMPAT-01 / D-98-09) -- DELEGATED, not duplicated. The NFR-5
 *   orchestrator-network gate already proves both info surfaces carry zero
 *   gitOps surface; this file asserts those two surfaces are still among that
 *   gate's targets, so the clause is documented here and proven there. The
 *   delegation is mechanical: both gates share the scanning helper in
 *   `tests/architecture/source-scan.ts`. This file MUST NOT import
 *   `no-orchestrator-network.test.ts` -- under `node:test`, importing a module
 *   that registers cases at its top level runs those cases a SECOND time and
 *   misreports the count.
```

NEW:

```text
 *   Network (COMPAT-01) -- not asserted here. BLOCK F in `eslint.config.js`
 *   lints both info surfaces, with every other network-free module, for git
 *   surface.
```

### TXT-7 (Task 2): `tests/architecture/compat-01-no-expansion.test.ts` line 77

OLD:

```text
 *   - An import of any `*.test.ts` module (see the network clause above).
```

NEW:

```text
 *   - An import of any `*.test.ts` module. Under `node:test`, importing a module
 *     that registers cases at its top level runs those cases a second time and
 *     misreports the count.
```

### TXT-8 (Task 2): `tests/architecture/compat-01-no-expansion.test.ts` lines 127-132

Delete these five lines and the blank line after them (line 132), with no replacement. Only the deleted network case read the constant.

OLD:

```text
/**
 * The registry module the delegation clause below reads. A test path, not a
 * production one, so D-07-05 does not cover it and it is spelled here.
 */
const NETWORK_GATE_REL = "tests/architecture/gate-targets.ts";
```

### TXT-9 (Task 2): `tests/architecture/compat-01-no-expansion.test.ts` lines 7-9

OLD:

```text
 * migration, NO status token, NO reason token, NO glyph, and NO new network
 * path. This one file holds every structural clause of that promise, so a
 * reviewer reads this file and knows the whole contract.
```

NEW:

```text
 * migration, NO status token, NO reason token, NO glyph, and NO new network
 * path. This one file holds every structural clause of that promise except the
 * network one, which ESLint enforces (see the Network paragraph below).
```

### TXT-10 (Task 2): `tests/architecture/no-test-only-production-surface.test.ts` lines 167-173

OLD:

```text
/*
 * The modules the classified seams live on, each annotated with the registry
 * group that already names it. The annotation is the membership check: assigning
 * a path the group does not name stops compiling, so these references cannot
 * drift away from the registry (D-07-05). `NETWORK_FREE_TARGETS` and
 * `MARKETPLACE_LEDGER_TARGETS` carry every module needed here.
 */
```

NEW:

```text
/*
 * The modules the classified seams live on. The two marketplace ledgers carry
 * the `MARKETPLACE_LEDGER_TARGETS` annotation, so naming a path that group does
 * not hold stops compiling (D-07-05). The four plugin owners are spelled here:
 * the network-free list in `eslint.config.js` is not a module this file can
 * read a type from.
 */
```

### TXT-11 (Task 3): `tests/architecture/notify-closed-set-locks.test.ts` lines 228-234

OLD:

```text
/**
 * Discriminating controls for the four maps above. An exhaustive `Record` is
 * only a tripwire if it actually rejects both drift directions, and a count over
 * a map the compiler never constrained would report the same number either way.
 * `IsExact` states what the map's key set is, so a control asserting `false`
 * fails HERE if the constraint had degenerated.
 */
```

NEW:

```text
/**
 * Exactness proofs for the enrollment maps above. An exhaustive `Record` is
 * only a tripwire if it rejects both drift directions; `IsExact` states what
 * each map's key set is, so a key set that drifts from its union stops
 * compiling.
 */
```

### TXT-12 (Task 3): `tests/architecture/gate-targets.ts`, `PACKAGE_JSON_REL` doc

OLD:

```text
/** The package manifest: version sync, peer floor, telemetry ban, unit-suite glob. */
```

NEW:

```text
/** The package manifest: version sync, peer floor, telemetry ban. */
```

### CIT-01 to CIT-34 (Task 2): citations of the deleted network test and of the moved list

```text
CIT-01 extensions/pi-claude-marketplace/orchestrators/auth-host.ts:28
OLD
 * under the no-orchestrator-network gate. It imports the provider registry
NEW
 * under BLOCK F in `eslint.config.js`. It imports the provider registry

CIT-02 extensions/pi-claude-marketplace/orchestrators/auth-host.ts:50-51
OLD
// `platform/git.ts` or `platform/git-credential.ts` directly -- the
// no-orchestrator-network gate greps for any `platform/git` import, even
NEW
// `platform/git.ts` or `platform/git-credential.ts` directly -- BLOCK F in
// `eslint.config.js` rejects any `platform/git` import, even

CIT-03 extensions/pi-claude-marketplace/orchestrators/plugin/clone-cache.ts:5-9
OLD
// install-outcome.ts is forbidden the git surface by the `no-orchestrator-network`
// architecture gate (NFR-5). The clone lives HERE, in a sibling seam install
// calls by name; this file imports DEFAULT_GIT_OPS from marketplace/shared.ts
// (the same re-export update.ts uses) and is legally allowed the git surface
// (NOT in the gate's forbidden list).
NEW
// install-outcome.ts is forbidden the git surface by BLOCK F in
// `eslint.config.js` (NFR-5). The clone lives HERE, in a sibling seam install
// calls by name; this file imports DEFAULT_GIT_OPS from marketplace/shared.ts
// (the same re-export update.ts uses) and is legally allowed the git surface
// (NOT in that config's `NETWORK_FREE_TARGETS`).

CIT-04 extensions/pi-claude-marketplace/orchestrators/plugin/clone-gc.ts:12-17
OLD
// This helper is fs-only: it imports loadState + the locations chokepoint +
// node:fs/promises rm/readdir ONLY. It never touches the git surface, so any
// orchestrator -- even one gated by
// tests/architecture/no-orchestrator-network.test.ts -- can import it without
// introducing a git token. (uninstall.ts itself is not on that gate's candidate
// list; it is network-free by convention.)
NEW
// This helper is fs-only: it imports loadState + the locations chokepoint +
// node:fs/promises rm/readdir ONLY. It never touches the git surface, so any
// orchestrator -- even one listed in `NETWORK_FREE_TARGETS` in
// `eslint.config.js`, which BLOCK F lints for git imports and identifiers --
// can import it without introducing a git token. uninstall.ts is one such
// listed orchestrator.

CIT-05 extensions/pi-claude-marketplace/orchestrators/plugin/dependency-declaration-read.ts:15-17
OLD
// fetch. The install owners that drive this read are pinned by name in the
// no-orchestrator-network gate, and routing the read through this module is
// what keeps them there.
NEW
// fetch. The install owners that drive this read are pinned by name in
// `eslint.config.js`'s `NETWORK_FREE_TARGETS`, and routing the read through
// this module is what keeps them there.

CIT-06 extensions/pi-claude-marketplace/orchestrators/plugin/dependency-tag-probe.ts:12
OLD
// `tests/architecture/gate-targets.ts`'s `NETWORK_FREE_TARGETS` while both
NEW
// `eslint.config.js`'s `NETWORK_FREE_TARGETS` while both

CIT-07 extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts:27-29
OLD
// The architecture gate at
// `tests/architecture/no-orchestrator-network.test.ts` (FORBIDDEN_TARGETS) is
// armed for this file -- adding any forbidden surface fails the gate.
NEW
// `eslint.config.js` lists this file in `NETWORK_FREE_TARGETS`, and BLOCK F
// of that config rejects any forbidden surface here -- adding one fails
// `npm run lint`.

CIT-08 extensions/pi-claude-marketplace/orchestrators/plugin/fetch.ts:12-14
OLD
//     helper, no platform-git import), a gate enforced by
//     tests/architecture/no-orchestrator-network.test.ts's forbidden-targets
//     set.
NEW
//     helper, no platform-git import). BLOCK F in `eslint.config.js` enforces
//     that, because its `NETWORK_FREE_TARGETS` list
//     names this file.

CIT-09 extensions/pi-claude-marketplace/orchestrators/plugin/git-source-probe.ts:14-15
OLD
// so `edge-deps.ts` can consume it while the no-orchestrator-network gate
// (NFR-5) stays green.
NEW
// so `edge-deps.ts` can consume it while BLOCK F in `eslint.config.js`
// (NFR-5) stays green.

CIT-10 extensions/pi-claude-marketplace/orchestrators/plugin/info.ts:165
OLD
 * is a FORBIDDEN_TARGET for the git surface (no-orchestrator-network gate), so
NEW
 * is in `NETWORK_FREE_TARGETS` (BLOCK F in `eslint.config.js`), so

CIT-11 extensions/pi-claude-marketplace/orchestrators/plugin/info.ts:488-489
OLD
 * forbids `info` touching the network, and this file is pinned BY NAME in the
 * no-orchestrator-network gate. The consequence is deliberate and worth
NEW
 * forbids `info` touching the network, and `eslint.config.js` pins this file BY
 * NAME in `NETWORK_FREE_TARGETS`. The consequence is deliberate and worth

CIT-12 extensions/pi-claude-marketplace/orchestrators/plugin/info.ts:1935
OLD
 * re-exports (no-orchestrator-network gate, NFR-5).
NEW
 * re-exports (BLOCK F in `eslint.config.js`, NFR-5).

CIT-13 extensions/pi-claude-marketplace/orchestrators/plugin/install-outcome.ts:59-61
OLD
// or the default git ops, and MUST NOT carry a gitOps field; the architectural
// test under tests/architecture/no-orchestrator-network.test.ts strips comments
// and greps this file's source for the forbidden surface tokens.
NEW
// or the default git ops, and MUST NOT carry a gitOps field; BLOCK F in
// `eslint.config.js` lints this file's code for that surface, so a comment
// may still name it.

CIT-14 extensions/pi-claude-marketplace/orchestrators/plugin/list-flow.ts:52-53
OLD
//   - `tests/architecture/no-orchestrator-network.test.ts` greps this source
//     after stripComments and asserts zero gitOps surface.
NEW
//   - BLOCK F in `eslint.config.js` lints this source and rejects any
//     gitOps surface.

CIT-15 extensions/pi-claude-marketplace/orchestrators/plugin/marketplace-tag-probe.ts:13
OLD
// `tests/architecture/gate-targets.ts`'s `NETWORK_FREE_TARGETS` for the same
NEW
// `eslint.config.js`'s `NETWORK_FREE_TARGETS` for the same

CIT-16 extensions/pi-claude-marketplace/orchestrators/plugin/plugin-state-classifier.ts:14-15
OLD
// boundary stay at the caller, where the architecture guard
// (tests/architecture/no-orchestrator-network.test.ts) enforces it.
NEW
// boundary stay at the caller, where the network-free ESLint block
// (BLOCK F in `eslint.config.js`) enforces it.

CIT-17 extensions/pi-claude-marketplace/orchestrators/plugin/update-constraint-gate.ts:8
OLD
// Deliberately ABSENT from `tests/architecture/gate-targets.ts`'s
NEW
// Deliberately ABSENT from `eslint.config.js`'s

CIT-18 extensions/pi-claude-marketplace/orchestrators/plugin/update-preflight.ts:129
OLD
   * one `tests/architecture/gate-targets.ts`'s network-free gate matches, and
NEW
   * one the network-free ESLint block in `eslint.config.js` bans, and

CIT-19 extensions/pi-claude-marketplace/orchestrators/plugin/workflows-staging-gc.ts:24-29
OLD
// None of them reaches the git surface, so any orchestrator -- even one gated
// by tests/architecture/no-orchestrator-network.test.ts -- can import this
// module without introducing a git token. The bridge import is the only one
// that is not a leaf, and it is safe on the terms that gate actually uses: the
// gate greps named files for git tokens, and `install.ts` is both gated and
// already importing the same bridge module directly.
NEW
// None of them reaches the git surface, so any orchestrator -- even one listed
// in `NETWORK_FREE_TARGETS` in `eslint.config.js` -- can import this module
// without introducing a git token. The bridge import is the only one that is
// not a leaf, and it is safe on the terms that block actually uses: BLOCK F
// lints the listed files for git imports and identifiers, and `install.ts` is
// both gated and already importing the same bridge module directly.

CIT-20 extensions/pi-claude-marketplace/orchestrators/reconcile/notify.ts:294
OLD
 * (guarded by the `no-orchestrator-network` architecture test); a probe throw
NEW
 * (guarded by BLOCK F in `eslint.config.js`); a probe throw

CIT-21 extensions/pi-claude-marketplace/orchestrators/reconcile/pending.ts:7-9
OLD
// `DEFAULT_GIT_OPS`, no `refreshGitHubClone`. The architecture grep-gate
// test in `tests/architecture/no-orchestrator-network.test.ts` enforces this
// structurally.
NEW
// `DEFAULT_GIT_OPS`, no `refreshGitHubClone`. The network-free ESLint
// block (BLOCK F in `eslint.config.js`) enforces this
// structurally.

CIT-22 extensions/pi-claude-marketplace/orchestrators/reconcile/README.md:89 (phrase inside the one-line paragraph)
OLD
(the architecture grep-gate at `tests/architecture/no-orchestrator-network.test.ts` arms this file)
NEW
(BLOCK F in `eslint.config.js` lints the reconcile `pending.ts`, `plan.ts`, and `notify.ts` for git surface)

CIT-23 tests/architecture/source-scan.ts:4-12
OLD
 * Two gates assert that a named set of repository files carries none of a named
 * set of forbidden textual surfaces: the NFR-5 orchestrator-network gate
 * (`tests/architecture/no-orchestrator-network.test.ts`) and the COMPAT-01
 * no-expansion gate (`tests/architecture/compat-01-no-expansion.test.ts`). The
 * mechanic lives here so the two share ONE implementation instead of
 * duplicating it, and so one gate can DELEGATE a clause to the other without
 * importing a `*.test.ts` module -- under `node:test`, importing a module that
 * registers cases at its top level registers those cases a SECOND time in the
 * importing file's run, doubling the work and misreporting the count (D-98-09).
NEW
 * Several gates assert that a named set of repository files carries none of a
 * named set of forbidden textual surfaces, for example
 * `tests/architecture/no-test-only-production-surface.test.ts` and
 * `tests/architecture/no-lifecycle-default-enabled-read.test.ts`. The mechanic
 * lives here so they share ONE implementation instead of duplicating it, and
 * so a gate can reuse it without importing a `*.test.ts` module -- under
 * `node:test`, importing a module that registers cases at its top level
 * registers those cases a SECOND time in the importing file's run, doubling the
 * work and misreporting the count (D-98-09).

CIT-24 tests/architecture/marketplace-tag-probe-offline.test.ts:6-10
OLD
 * `no-orchestrator-network.test.ts` proves the ABSENCE of a named forbidden
 * token; this gate instead pins the exact set of named imports to equality,
 * so a future edit that adds `listRemoteTags`, `clone`, `fetch`, or
 * `resolveRemoteRef` to THAT import clause fails on set inequality without
 * this gate having had to enumerate what is forbidden in advance.
NEW
 * BLOCK F in `eslint.config.js` proves the ABSENCE of named forbidden tokens in
 * the files it lists; this gate instead pins the exact set of named imports to
 * equality, so a future edit that adds `listRemoteTags`, `clone`, `fetch`, or
 * `resolveRemoteRef` to THAT import clause fails on set inequality without
 * this gate having had to enumerate what is forbidden in advance.

CIT-25 tests/architecture/reconcile-planner-purity.test.ts:20-21
OLD
 * The grep operates over the COMMENT-STRIPPED source (same `stripComments`
 * pattern as `tests/architecture/no-orchestrator-network.test.ts`) so the
NEW
 * The grep operates over the COMMENT-STRIPPED source (the same `stripComments`
 * pattern `tests/architecture/source-scan.ts` exports) so the

CIT-26 tests/edge/handlers/plugin/fetch.test.ts:59-61
OLD
// case adds an offline guard -- `orchestrators/plugin/fetch.ts` is a named
// member of the forbidden-targets set in
// tests/architecture/no-orchestrator-network.test.ts.
NEW
// case adds an offline guard -- `orchestrators/plugin/fetch.ts` is a named
// member of `NETWORK_FREE_TARGETS` in `eslint.config.js`, which BLOCK F
// lints.

CIT-27 tests/orchestrators/plugin/install-flow.test.ts:263-264
OLD
//   PI-2: no network -- covered architecturally by tests/architecture/
//         no-orchestrator-network.test.ts. End-to-end: installPlugin has no
NEW
//   PI-2: no network -- covered architecturally by BLOCK F in
//         `eslint.config.js`. End-to-end: installPlugin has no

CIT-28 tests/orchestrators/plugin/list-flow.test.ts:17-18
OLD
// Plus the redundant in-test source grep for NFR-5 / PI-2 / PL-3
// defense-in-depth (mirror of `tests/architecture/no-orchestrator-network`).
NEW
// Plus a compile-time proof that the list options expose no Git transport
// (NFR-5 / PI-2 / PL-3), defense in depth beside BLOCK F in `eslint.config.js`.

CIT-29 tests/architecture/hooks-lifecycle.test.ts:44-45
OLD
// WR-01 prefix lives come from `HOOKS_LIFECYCLE_TARGETS`, so a literal-match
// stale-path scan of the registry sees every one of them. The group is a tuple,
NEW
// WR-01 prefix lives come from `HOOKS_LIFECYCLE_TARGETS`, so the registry
// names every one of them. The group is a tuple,

CIT-30 tests/architecture/extension-version-sync.test.ts:19-20
OLD
 * `REPO_ROOT`, so the only path this gate names is one a literal-match scan of
 * the registry already sees.
NEW
 * `REPO_ROOT`, so the only path this gate reads is one the registry already
 * names.

CIT-31 docs/competitive-analysis/asermax-pi-cc-plugins.md:253 (phrase)
OLD
The test `tests/architecture/no-orchestrator-network.test.ts` greps our orchestrators for git surfaces and fails the build.
NEW
An ESLint rule block in `eslint.config.js` rejects git imports and git identifiers in our network-free orchestrators and fails the build.

CIT-32 docs/competitive-analysis/pi-plugins.md:416 (phrase)
OLD
Our offline promise is enforced by a test, not by convention. `tests/architecture/no-orchestrator-network.test.ts` greps
NEW
Our offline promise is enforced by a lint rule, not by convention. An ESLint block in `eslint.config.js` checks

CIT-33 docs/competitive-analysis/pi-plugins.md:694 (phrase)
OLD
Our offline guarantee is a grep gate. `tests/architecture/no-orchestrator-network.test.ts` scans
NEW
Our offline guarantee is a lint gate. An ESLint block in `eslint.config.js` checks

CIT-34 docs/competitive-analysis/zmarketplace.md:255 (phrase)
OLD
`tests/architecture/no-orchestrator-network.test.ts` greps the orchestrators for git surfaces and fails the build.
NEW
An ESLint block in `eslint.config.js` rejects git surfaces in the network-free orchestrators and fails the build.
```

<tasks>

<task type="tracer">
  <name>Task 1: D-11 ledger rule moves into ESLint zones; import-boundaries test retires (D-03, D-04, D-05, D-06)</name>
  <files>eslint.config.js, tests/architecture/import-boundaries.test.ts, tests/architecture/gate-targets.ts, tests/architecture/no-test-only-production-surface.test.ts</files>
  <precondition>The main checkout is on `features/faster-precommit` at 5e161ce3 or a descendant that differs from it only under `.planning/`; `git status --short` lists only `.planning/` paths; `.git/check-changed-full.lock` does not exist.</precondition>
  <read_first>
    - eslint.config.js (whole file, 471 lines): BLOCK A (lines 96-150), BLOCK C (186-285), BLOCK E (286-308)
    - tests/architecture/import-boundaries.test.ts lines 279-381 (the two ledger walks this task replaces)
    - tests/architecture/gate-targets.ts lines 166-172 and 229-297
    - tests/architecture/no-test-only-production-surface.test.ts lines 86-100
  </read_first>
  <action>
1. Record the start: write `git rev-parse HEAD` to `/tmp/kwl-start.txt`.

2. In `eslint.config.js`, per D-03: add CFG-1, append the CFG-2 zones to BLOCK C, and replace BLOCK C's comment with CFG-3. Use the zone order and messages exactly as given; the verify script matches message substrings. Leave the eight layer zones, `basePath`, and every other block unchanged.

3. Prove each zone fires on a lint-only offender, per D-04: run the `node --input-type=module` script from `<verify>` alone. It lints one type-only import per zone through `ESLint#lintText` with the real config and the target's real path, so nothing is written to disk. Expect `ledger plants fired`.

4. Delete `tests/architecture/import-boundaries.test.ts` with `git rm`, per D-03. Its two ledger walks are replaced by the zones. Its fallow-script pin and its two zone-matrix cases go with it, with no replacement, because fallow's boundaries own the layer matrix.

5. In `tests/architecture/gate-targets.ts`, per D-06: delete `ZONE_FOLDER_TARGETS` and `PLUGIN_LEDGER_TARGETS`, each with its doc comment and the blank line after it, since the deleted test was their only importer. Apply TXT-1 and TXT-2. Leave every other group, including `ZONE_REPRESENTATIVE_TARGETS`, until Task 3.

6. Apply TXT-3 to `tests/architecture/no-test-only-production-surface.test.ts`. Change nothing else in it in this task.

7. Feedback, then commit:
   - Run the `<verify>` command once.
   - Run `pre-commit run prettier --files eslint.config.js tests/architecture/gate-targets.ts tests/architecture/no-test-only-production-surface.test.ts` and restage anything it rewrites.
   - Stage the three modified paths by name. The `git rm` deletion is already staged.
   - Run `node scripts/check-changed.mjs --list` once. Expect scope `broad`, a reason starting "Broad check required by", and the six broad commands plus the tests the edited files select.
   - Run `pre-commit run --verbose --files eslint.config.js tests/architecture/gate-targets.ts tests/architecture/no-test-only-production-surface.test.ts > /tmp/kwl-precommit-task1.log 2>&1; echo "PRECOMMIT_EXIT=$?" >> /tmp/kwl-precommit-task1.log`. Run it in the foreground with a 600000 ms timeout; never pipe it and never poll it. Confirm `PRECOMMIT_EXIT=0`, and record the last `.git/check-changed.log` record (scope, reason, durationMs, exitStatus, lockWaitMs).
   - Run `npx fallow audit --format json --quiet --explain --gate-marker agent`. The verdict must not be `fail`.
   - Commit with `git commit -F <message file>`. Title: `test(architecture): enforce ledger imports with ESLint zones`. The body has lines of at most 80 characters, no milestone, phase, or plan references, and ends with `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`. Never use `--no-verify`. Then run `git status --short` and confirm that only `.planning/` paths remain.
  </action>
  <verify>
    <automated>test ! -e tests/architecture/import-boundaries.test.ts && ! grep -nE 'ZONE_FOLDER_TARGETS|PLUGIN_LEDGER_TARGETS|import-boundaries' tests/architecture/*.ts && grep -qF 'const PLUGIN_LEDGERS = [' eslint.config.js && grep -qF 'const MARKETPLACE_LEDGERS = [' eslint.config.js && node --input-type=module -e 'import { ESLint } from "eslint"; const eslint = new ESLint(); const plants = [["extensions/pi-claude-marketplace/orchestrators/marketplace/list.ts", `import type { X } from "../plugin/install-flow.ts";`, "must not import a plugin ledger module"], ["extensions/pi-claude-marketplace/orchestrators/plugin/update-flow.ts", `import type { X } from "../marketplace/add.ts";`, "must not import a marketplace ledger module"], ["extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts", `import type { X } from "./uninstall.ts";`, "plugin ledger modules must not import each other"], ["extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts", `import type { X } from "./remove.ts";`, "marketplace ledger modules must not import each other"]]; for (const [filePath, text, want] of plants) { const [result] = await eslint.lintText(text, { filePath }); if (!result.messages.some((m) => m.ruleId === "import-x/no-restricted-paths" && m.message.includes(want))) { console.error("ledger plant did not fire:", filePath, want); process.exit(1); } } console.log("ledger plants fired");' && node --test --test-reporter=./scripts/test-reporter.mjs tests/architecture/gate-targets.test.ts tests/architecture/no-test-only-production-surface.test.ts tests/architecture/eslint-effective-config.test.ts</automated>
  </verify>
  <done>The four ledger zones fire on lint-only type imports, both families included, and the real tree passes `npm run lint` in the pre-commit run. `import-boundaries.test.ts` and the two registry groups only it read are gone. The registry gate and the effective-config tests still pass. One commit exists, its hook record shows exit 0, and the tree is clean apart from `.planning/`.</done>
</task>

<task type="auto">
  <name>Task 2: NFR-5 network rule moves into ESLint BLOCK F; network test and registry gate retire; citations rewritten (D-01, D-02, D-04, D-05, D-06)</name>
  <files>eslint.config.js, tests/architecture/no-orchestrator-network.test.ts, tests/architecture/gate-targets.test.ts, tests/architecture/gate-targets.ts, tests/architecture/compat-01-no-expansion.test.ts, tests/architecture/no-test-only-production-surface.test.ts, tests/architecture/source-scan.ts, tests/architecture/marketplace-tag-probe-offline.test.ts, tests/architecture/reconcile-planner-purity.test.ts, tests/architecture/hooks-lifecycle.test.ts, tests/architecture/extension-version-sync.test.ts, tests/edge/handlers/plugin/fetch.test.ts, tests/orchestrators/plugin/install-flow.test.ts, tests/orchestrators/plugin/list-flow.test.ts, extensions/pi-claude-marketplace/orchestrators/auth-host.ts, extensions/pi-claude-marketplace/orchestrators/plugin/clone-cache.ts, extensions/pi-claude-marketplace/orchestrators/plugin/clone-gc.ts, extensions/pi-claude-marketplace/orchestrators/plugin/dependency-declaration-read.ts, extensions/pi-claude-marketplace/orchestrators/plugin/dependency-tag-probe.ts, extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts, extensions/pi-claude-marketplace/orchestrators/plugin/fetch.ts, extensions/pi-claude-marketplace/orchestrators/plugin/git-source-probe.ts, extensions/pi-claude-marketplace/orchestrators/plugin/info.ts, extensions/pi-claude-marketplace/orchestrators/plugin/install-outcome.ts, extensions/pi-claude-marketplace/orchestrators/plugin/list-flow.ts, extensions/pi-claude-marketplace/orchestrators/plugin/marketplace-tag-probe.ts, extensions/pi-claude-marketplace/orchestrators/plugin/plugin-state-classifier.ts, extensions/pi-claude-marketplace/orchestrators/plugin/update-constraint-gate.ts, extensions/pi-claude-marketplace/orchestrators/plugin/update-preflight.ts, extensions/pi-claude-marketplace/orchestrators/plugin/workflows-staging-gc.ts, extensions/pi-claude-marketplace/orchestrators/reconcile/notify.ts, extensions/pi-claude-marketplace/orchestrators/reconcile/pending.ts, extensions/pi-claude-marketplace/orchestrators/reconcile/README.md, docs/competitive-analysis/asermax-pi-cc-plugins.md, docs/competitive-analysis/pi-plugins.md, docs/competitive-analysis/zmarketplace.md</files>
  <precondition>Task 1's commit is HEAD and `git status --short` lists only `.planning/` paths.</precondition>
  <read_first>
    - eslint.config.js as Task 1 left it (BLOCK A, BLOCK C, BLOCK E)
    - tests/architecture/gate-targets.ts lines 1-145 and the `REPO_MANIFEST_TARGETS` scalars
    - tests/architecture/no-orchestrator-network.test.ts (whole, 91 lines): the forbidden forms CFG-6 and CFG-7 must cover
    - tests/architecture/compat-01-no-expansion.test.ts lines 1-12, 40-135, and 700-752 (the network case is the file's last, lines 723-752)
    - tests/architecture/no-test-only-production-surface.test.ts lines 55-66 and 160-186
    - only the line windows named in CIT-01 to CIT-30 (offset and limit), never whole large files
  </read_first>
  <action>
Write `git rev-parse HEAD` to `/tmp/kwl-t2-base.txt` first. The verify diffs against it.

1. Build BLOCK F in `eslint.config.js`, per D-02: hoist CFG-4, add CFG-5 (copy today's gate-targets.ts lines 39-144 verbatim as the body), add CFG-6, and add CFG-7 directly after BLOCK E. BLOCK A and BLOCK E must behave exactly as before; only where their options live changes.

2. Prove the rules on lint-only offenders, per D-04: run the `node --input-type=module` script from `<verify>` alone. It checks the moved list (27 existing paths, neither exempt update owner), then lints one offender of each form against `info.ts` and the same text against `update-flow.ts`. Expect `network plants fired on a listed file and stayed off an exempt one`. If a message is missing, fix the config, not the script.

3. Complete the move, per D-02 and D-06: delete `NETWORK_FREE_TARGETS` from `tests/architecture/gate-targets.ts`, with its doc comment and the blank line after it. Apply TXT-4. `ESLINT_CONFIG_REL` stays until Task 3, because `tests/architecture/eslint-effective-config.ts` still imports it.

4. `git rm tests/architecture/no-orchestrator-network.test.ts tests/architecture/gate-targets.test.ts`, per D-01 and D-02. The registry gate goes here rather than in Task 3: its D-07-06 scan would reject the `fetch.ts` path step 5 must spell, and it asserts that it opened the network test (choice 6).

5. `tests/architecture/no-test-only-production-surface.test.ts`, per D-05: drop the moved list from its gate-targets import, keeping `EXTENSION_ROOT_REL` and `MARKETPLACE_LEDGER_TARGETS`. Apply TXT-10. Remove the moved-list type annotation from `INSTALL_FLOW_REL`, `FETCH_REL`, `PLUGIN_INFO_REL`, and `REINSTALL_FLOW_REL`; their string values stay byte-identical. The two marketplace constants keep their `MARKETPLACE_LEDGER_TARGETS` annotation.

6. `tests/architecture/compat-01-no-expansion.test.ts`, per D-01 and D-05 (choice 7): delete the network delegation case, do not re-point it.
   - Delete today's lines 722-752: the blank line and the last case of the file, titled "COMPAT-01: the network clause is covered by the orchestrator-network gate". The `});` that closes "COMPAT-01: the default state declares the current schema version" then ends the file.
   - Apply TXT-8 (delete the constant only that case read), TXT-9, TXT-6, and TXT-7.
   - In the gate-targets import, drop the moved list and keep `COMPAT_NO_EXPANSION_TARGETS` and `SCOPE_FENCE_TARGETS`. Add no import.
   - Every other case, `readStrippedSource`, and the `readFile`, `path`, `REPO_ROOT`, and `stripComments` imports stay byte-identical; the other cases still use them.

7. Apply CIT-01 to CIT-34, per D-06. In `extensions/`, each NEW block must keep its OLD block's line count, because 9 of these files carry `file:line:col` type-member pins (fact 6). Generic "network-free gate" wording elsewhere stays.

8. Feedback, then commit:
   - Run `pre-commit run prettier --files` over the modified `.js` and `.ts` paths, and `pre-commit run mdformat --files` over the four Markdown paths. Restage what they change.
   - Run the `<verify>` command once. It includes `npm run lint:type-members`, about 90 s, which the commit hook never runs.
   - Stage the modified paths by name. The `git rm` deletions are already staged.
   - Run `node scripts/check-changed.mjs --list` once and record the selection.
   - Run the hook once in the background over the existing modified paths, with all output going to `/tmp/kwl-precommit-task2.log` and `PRECOMMIT_EXIT=$?` appended to that log. Wait for the completion notification; never poll and never pipe. Confirm `PRECOMMIT_EXIT=0` and record the last `.git/check-changed.log` record.
   - Run the Fallow audit. Its verdict must not be `fail`.
   - Commit with `git commit -F <message file>`. Title: `test(architecture): move the network-free gate into ESLint`. Use the same body rules and trailer as Task 1. Then confirm `git status --short` lists only `.planning/` paths.
  </action>
  <verify>
    <automated>test ! -e tests/architecture/no-orchestrator-network.test.ts && test ! -e tests/architecture/gate-targets.test.ts && ! git grep -nI -e no-orchestrator-network -e gate-targets -- docs extensions skills .agents AGENTS.md CONTRIBUTING.md && ! git grep -nI no-orchestrator-network -- tests && ! grep -n NETWORK_FREE_TARGETS tests/architecture/gate-targets.ts tests/architecture/no-test-only-production-surface.test.ts tests/architecture/compat-01-no-expansion.test.ts && ! grep -nE 'NETWORK_GATE_REL|requiredTargets|ESLINT_CONFIG_REL' tests/architecture/compat-01-no-expansion.test.ts && ! grep -n literal-match tests/architecture/hooks-lifecycle.test.ts tests/architecture/extension-version-sync.test.ts && grep -qF 'files: NETWORK_FREE_TARGETS' eslint.config.js && grep -qF '...NETWORK_FREE_SYNTAX_SELECTORS' eslint.config.js && grep -qF '...OUTPUT_DISCIPLINE_SELECTORS' eslint.config.js && NUMSTAT="$(git diff --numstat "$(cat /tmp/kwl-t2-base.txt)" -- extensions)" && test "$(printf '%s\n' "$NUMSTAT" | wc -l)" -eq 19 && printf '%s\n' "$NUMSTAT" | awk '$1 != $2 { bad = 1; print } END { exit bad }' && node --input-type=module -e 'import { existsSync, readFileSync } from "node:fs"; import { ESLint } from "eslint"; const config = readFileSync("eslint.config.js", "utf8"); const start = config.indexOf("const NETWORK_FREE_TARGETS = ["); const listed = start === -1 ? [] : [...config.slice(start, config.indexOf("];", start)).matchAll(/^\s*"([^"]+)",$/gm)].map((m) => m[1]); const exempt = ["extensions/pi-claude-marketplace/orchestrators/plugin/update-flow.ts", "extensions/pi-claude-marketplace/orchestrators/plugin/update-preflight.ts"]; if (listed.length !== 27 || !listed.every((rel) => existsSync(rel)) || exempt.some((rel) => listed.includes(rel))) { console.error("network list:", listed.length, listed.filter((rel) => !existsSync(rel))); process.exit(1); } const eslint = new ESLint(); const plant = [`import type { X } from "../../platform/git.ts";`, `import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";`, `void import("../../platform/git-credential.ts");`, `type G = import("../../platform/git.ts").X;`, `interface P { readonly gitOps?: unknown }`, `const k = { "refreshGitHubClone": 1 };`, `console.log(k);`, `export type { ExtensionAPI, G, P, X };`].join("\n"); const want = [["no-restricted-imports", "must not import a platform/git module"], ["no-restricted-imports", "Import Pi API types"], ["no-restricted-syntax", "must not dynamically import"], ["no-restricted-syntax", "through import()"], ["no-restricted-syntax", "must not name gitOps"], ["no-restricted-syntax", "in a string"], ["no-restricted-syntax", "IL-2"]]; const [hit] = await eslint.lintText(plant, { filePath: "extensions/pi-claude-marketplace/orchestrators/plugin/info.ts" }); const missing = want.filter(([id, text]) => !hit.messages.some((m) => m.ruleId === id && m.message.includes(text))); const [free] = await eslint.lintText(plant, { filePath: exempt[0] }); const leaked = free.messages.filter((m) => m.message.includes("NFR-5")).map((m) => m.message); const unlisted = [["no-restricted-syntax", "IL-2"], ["no-restricted-imports", "Import Pi API types"]].filter(([id, text]) => !free.messages.some((m) => m.ruleId === id && m.message.includes(text))); if (missing.length > 0 || leaked.length > 0 || unlisted.length > 0) { console.error(JSON.stringify({ missing, leaked, unlisted })); process.exit(1); } console.log("network plants fired on a listed file and stayed off an exempt one");' && node --test --test-reporter=./scripts/test-reporter.mjs tests/architecture/compat-01-no-expansion.test.ts tests/architecture/no-test-only-production-surface.test.ts tests/architecture/no-stale-test-citations.test.ts tests/architecture/hooks-lifecycle.test.ts tests/architecture/extension-version-sync.test.ts && npm run lint:type-members</automated>
  </verify>
  <done>BLOCK F applies to the 27 moved paths. On a listed file, every lint-only offender form is reported and the IL-2 and Pi peer-import messages still fire; an exempt update owner gets no NFR-5 message. `eslint.config.js` alone declares the network list. The network test, the registry gate, and compat-01's network delegation case are gone, and no test parses `eslint.config.js` in their place. No doc, skill, extension, or test text names the deleted network test or places the list in the registry. All 19 extension files keep their line counts, `npm run lint:type-members` passes, the hook record shows exit 0, and one commit exists.</done>
</task>

<task type="auto">
  <name>Task 3: Remove the remaining tooling self-tests and type-gate controls, prune the registry, run the final check (D-01, D-05, D-06, D-07)</name>
  <files>tests/architecture/unowned-exports-census.test.ts, tests/architecture/fallow-report.ts, tests/architecture/fallow-production-mode.test.ts, tests/architecture/eslint-effective-config.test.ts, tests/architecture/eslint-effective-config.ts, tests/architecture/unit-suite-glob-completeness.test.ts, tests/architecture/unused-type-member-gate.test.ts, tests/domain/components/hook-events.test.ts, tests/shared/notify-reasons.test.ts, tests/architecture/notify-closed-set-locks.test.ts, tests/shared/notification-types.test.ts, tests/architecture/gate-targets.ts</files>
  <precondition>Task 2's commit is HEAD and `git status --short` lists only `.planning/` paths.</precondition>
  <read_first>
    - tests/domain/components/hook-events.test.ts lines 1-20 and 36-132
    - tests/shared/notify-reasons.test.ts lines 50-90
    - tests/architecture/notify-closed-set-locks.test.ts lines 225-266
    - tests/shared/notification-types.test.ts lines 296-332
    - tests/architecture/gate-targets.ts as Task 2 left it (whole file)
  </read_first>
  <action>
Write `git rev-parse HEAD` to `/tmp/kwl-t3-base.txt` first.

1. Per D-01, `git rm` these seven files: `tests/architecture/unowned-exports-census.test.ts`, `tests/architecture/fallow-report.ts`, `tests/architecture/fallow-production-mode.test.ts`, `tests/architecture/eslint-effective-config.test.ts`, `tests/architecture/eslint-effective-config.ts`, `tests/architecture/unit-suite-glob-completeness.test.ts`, and `tests/architecture/unused-type-member-gate.test.ts`. Each helper goes in the same commit as its last importer.

2. Remove the type-gate self-tests, per D-01. Keep each file's real-tree proofs byte-identical.
   - `tests/domain/components/hook-events.test.ts`: delete today's lines 43-129. That is the module-scope loop that registers the two cases titled "checks the actual event coverage contract with complete registration" and "checks the actual event coverage contract with missing SessionStart registration", plus the blank line after its closing brace. One blank line then separates the `BucketAEventsCoverageProofIsExact` proof from `describe("BUCKET_A_EVENTS"`. Then delete the four imports only that loop used: the `node:fs/promises` import, the `node:os` import, the `node:path` import, and the `typescript` default import with the blank line after it. `assert`, `{ describe, test }`, and the hook-events and hooks imports stay.
   - `tests/shared/notify-reasons.test.ts`: delete today's lines 64-86. That is the block comment that begins "Controls for the gate the owner is annotated against", the generic gate alias, the three partition aliases, the three proofs that use them, and the blank line after them. The OUT-08 proof on line 62 and everything from `const skipSeverityCases` on stay.
   - `tests/architecture/notify-closed-set-locks.test.ts`: apply TXT-11. Then delete today's lines 262-266, the blank line, the two-line comment, and the two module-scope proofs that assert `false`, so that `} satisfies PluginWillUninstallMessage);` ends the file.
   - `tests/shared/notification-types.test.ts`: delete today's lines 307-328. That is the four-line comment that begins "Discriminating controls for the four proofs above", the five module-scope proofs below it that assert `false`, and the blank line after them. One blank line then separates the `MarketplaceStatus` exactness proof (line 305) from `const VOCABULARIES`.

3. Prune `tests/architecture/gate-targets.ts`, per D-06. Delete these 17 exports, each with its doc comment: `DIRECTORY_ROOT_TARGETS`, `HOOKS_BRIDGE_REL`, `ARCHITECTURE_DIR_REL`, `REPO_MANIFEST_TARGETS`, `ESLINT_CONFIG_REL` (its last importer, `eslint-effective-config.ts`, goes in step 1), `NO_CONSOLE_EXEMPT_TARGETS`, `ZONE_REPRESENTATIVE_TARGETS`, `COMPLETION_DESCRIPTION_TARGETS`, `UNUSED_TYPE_MEMBER_GATE_TARGETS`, `TYPE_MEMBER_GATE_REL`, `TYPE_MEMBER_EXCEPTIONS_REL`, `WORKFLOWS_BRIDGE_TARGETS`, `WORKFLOWS_STAGING_SCAN_TARGETS`, `WORKFLOWS_SCRIPT_TARGETS`, `WORKFLOWS_MARKER_COVERAGE_TARGETS`, `UNOWNED_EXPORT_CENSUS`, and `PRODUCTION_FINDING_CENSUS`. The six surviving constants the two deleted groups typed are `EXTENSION_ROOT_REL`, `ORCHESTRATORS_REL`, `PLUGIN_ORCHESTRATORS_REL`, `PLUGIN_EDGE_HANDLERS_REL`, `PACKAGE_JSON_REL`, and `PACKAGE_LOCK_REL`. Each becomes a plain `export const NAME = "<same literal>";` with its one-line doc. Apply TXT-12. Do not keep either deleted group as a module-private const: `@typescript-eslint/no-unused-vars` rejects a value used only as a type (fact 7). The 15 remaining groups stay byte-identical. Exactly 21 exports remain, and each has an importer (choice 9).

4. Feedback, then commit:
   - Run `pre-commit run prettier --files` over the five modified `.ts` paths and restage.
   - Run the `<verify>` command once.
   - Stage the modified paths by name. The `git rm` deletions are already staged.
   - Run `node scripts/check-changed.mjs --list` once.
   - Run `pre-commit run --verbose --files <the five modified paths> > /tmp/kwl-precommit-task3.log 2>&1; echo "PRECOMMIT_EXIT=$?" >> /tmp/kwl-precommit-task3.log` in the foreground with a 600000 ms timeout. Confirm `PRECOMMIT_EXIT=0` and record the last `.git/check-changed.log` record.
   - Run the Fallow audit. Its verdict must not be `fail`.
   - Commit with `git commit -F <message file>`. Title: `test: remove tooling self-tests and type-gate controls`. Use the same body rules and trailer as Task 1. Then confirm the tree is clean apart from `.planning/`.

5. Final verification, per D-07: the one explicit full check, on the Task 3 commit.
   - Delete `node_modules/.cache/eslint/`, so the duration compares with the 669 s baseline (choice 12).
   - Start, as one background command: `START=$(date +%s) && npm run check > /tmp/kwl-final-check.log 2>&1; CHECK_EXIT=$?; echo "HEAD=$(git rev-parse HEAD) NODE=$(node --version) CACHE_EMPTY=yes CHECK_EXIT=$CHECK_EXIT CHECK_SECONDS=$(( $(date +%s) - START ))" > /tmp/kwl-final.txt`.
   - Wait for the completion notification; never poll, and never pipe the check.
   - Read `/tmp/kwl-final.txt`. Extract the unit and integration summary lines (`tests N, suites …`) from `/tmp/kwl-final-check.log`.
   - `CHECK_EXIT` must be 0. Expect 8364 unit tests and 67 integration tests. If the unit count differs from 8364, find the cause before writing the summary; the measured number is authoritative.
   - If the check fails, fix the cause in a new commit (never amend) and rerun this step from the cache deletion.
  </action>
  <verify>
    <automated>[ -z "$(ls tests/architecture/unowned-exports-census.test.ts tests/architecture/fallow-report.ts tests/architecture/fallow-production-mode.test.ts tests/architecture/eslint-effective-config.test.ts tests/architecture/eslint-effective-config.ts tests/architecture/unit-suite-glob-completeness.test.ts tests/architecture/unused-type-member-gate.test.ts 2>/dev/null)" ] && ! git grep -nI -e unowned-exports-census -e fallow-report -e fallow-production-mode -e eslint-effective-config -e unit-suite-glob-completeness -e 'unused-type-member-gate\.test' -e no-orchestrator-network -e import-boundaries -e 'gate-targets\.test' -- docs extensions tests skills .agents scripts AGENTS.md CONTRIBUTING.md && ! grep -nE 'void \(false satisfies|GateProven|MissingReasonPartition|StrayReasonPartition|omittedLine|createProgram' tests/domain/components/hook-events.test.ts tests/shared/notify-reasons.test.ts tests/architecture/notify-closed-set-locks.test.ts tests/shared/notification-types.test.ts && grep -qF 'void (true satisfies BucketAEventsCoverageProofIsExact);' tests/domain/components/hook-events.test.ts && grep -qF 'typeof malformedReasonsForKinds>[number], FailureReason>);' tests/shared/notify-reasons.test.ts && grep -qF 'void (true satisfies IsExact<keyof typeof REASON_ENROLLMENT, Reason>);' tests/architecture/notify-closed-set-locks.test.ts && grep -qF 'void (true satisfies IsExact<Reason, (typeof EXPECTED_REASONS)[number]>);' tests/shared/notification-types.test.ts && node --input-type=module -e 'import { readdirSync, readFileSync } from "node:fs"; const registry = readFileSync("tests/architecture/gate-targets.ts", "utf8"); const names = [...registry.matchAll(/^export const (\w+)/gm)].map((m) => m[1]); const sources = readdirSync("tests", { recursive: true }).filter((rel) => rel.endsWith(".ts") && !rel.endsWith("gate-targets.ts")).map((rel) => readFileSync(`tests/${rel}`, "utf8")); const orphans = names.filter((name) => !sources.some((src) => new RegExp(`\\b${name}\\b`).test(src))); if (names.length !== 21 || orphans.length > 0) { console.error({ count: names.length, orphans }); process.exit(1); } console.log("all 21 registry exports have an importer");' && node --test --test-reporter=./scripts/test-reporter.mjs tests/domain/components/hook-events.test.ts tests/shared/notify-reasons.test.ts tests/architecture/notify-closed-set-locks.test.ts tests/shared/notification-types.test.ts tests/architecture/no-stale-test-citations.test.ts tests/architecture/compat-01-no-expansion.test.ts</automated>
  </verify>
  <done>The seven tooling self-test and helper files are gone, along with the hook-events planted-compile loop and the `false`-asserting type controls. Every real-tree exactness proof remains and compiles. The registry holds exactly 21 exports, each with an importer. No tracked text outside `.planning/` and CHANGELOG.md names a deleted test. The Task 3 hook record shows exit 0. `/tmp/kwl-final.txt` records `CHECK_EXIT=0` for the full `npm run check` on the Task 3 commit, started from an empty ESLint cache. Its unit and integration lines are captured for the summary.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
| --- | --- |
| source edit -> lint gate | NFR-5 (network-free modules) and D-11 (ledger imports) are now enforced only by `eslint.config.js`, through `npm run lint` in the commit hook's broad check, `npm run check`, and CI. |
| repository -> test suite | The registry gate, the Fallow scope and export-census tests, the unit-glob test, the type-member wiring test, the effective-config test, and the compile-time controls are gone. Each tool's run over the real tree is its only proof. |

## STRIDE Threat Register

ASVS level 1; blocking threshold `high`. No threat below is high.

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
| --- | --- | --- | --- | --- | --- |
| T-kwl-01 | Tampering | BLOCK F in eslint.config.js (network-free modules) | medium | mitigate | CFG-6 and CFG-7 cover every form the deleted test banned: static, type-only, dynamic, and type-position imports of `platform/git*`, plus the three tokens as identifiers, import specifiers, keys, private names, strings, and template text. Task 2's verify proves on a listed file that each form is reported and that an exempt update owner gets no NFR-5 message. Planning measured zero real-tree hits, and the commit hook's `npm run lint` re-proves it. |
| T-kwl-02 | Tampering | flat-config option replacement on the 27 listed files | medium | mitigate | CFG-4 hoists BLOCK A's IL-2 selectors and BLOCK E's Pi peer-import path, and BLOCK F restates both. Task 2's verify requires the IL-2 and Pi peer-import messages to fire on a listed file. |
| T-kwl-03 | Tampering | renamed, moved, or delisted network-free files and ledger paths | medium | accept | An ESLint `files` entry or zone path that matches nothing is silent, where the deleted test failed on a missing target. Removing an info surface from `NETWORK_FREE_TARGETS` is also silent, now that compat-01's delegation case is deleted (coordinator revision). The user decided to trust the toolset (D-01 to D-03). Task 2 checks once that all 27 paths exist. Not taken: an existence assertion that runs when the config loads. |
| T-kwl-04 | Tampering | ledger coupling through a type-position `import()` | low | accept | import-x's module visitor does not check a type-position `import()`, which the deleted regex matched. The coupling is type-only, and the zones cover import, export-from, and dynamic imports. Fallow's whole-tree cycle run still reports cycles. |
| T-kwl-05 | Repudiation | docs and comments claiming a deleted test enforces NFR-5 or D-11 | low | mitigate | CIT-01 to CIT-34, TXT-3, and TXT-6 to TXT-9 rewrite every claim. `no-stale-test-citations.test.ts` and the Task 2 and Task 3 repo-wide greps confirm that no tracked text outside `.planning/` and CHANGELOG.md names a deleted test. |
| T-kwl-06 | Tampering | deleted tooling self-tests (Fallow scope, export census, unit glob, type-member wiring, registry, effective ESLint config, compile-time controls) | medium | accept | This is the user's decision (D-01). A future misconfiguration of those tools can pass silently. Still running: `npm run fallow`, `npm run lint`, `npm run lint:type-members`, and the full unit glob in `npm run check` and CI on every pull request. |
| T-kwl-07 | Tampering | type-member pins in `scripts/check-unused-type-members.contracts.json` | medium | mitigate | Every extension CIT block keeps its line count. Task 2's verify checks numstat parity on all 19 extension files and runs `npm run lint:type-members`, and the final `npm run check` runs it again. |
| T-kwl-SC | Tampering | npm/pip/cargo installs | low | accept | This plan installs no package. |
</threat_model>

<verification>
- Each task's `<verify>` passed before its commit.
- Each task's pre-commit run exited 0. Logs: `/tmp/kwl-precommit-task1.log`, `/tmp/kwl-precommit-task2.log`, `/tmp/kwl-precommit-task3.log`.
- The Fallow audit verdict was not `fail` before any of the three commits.
- `/tmp/kwl-final.txt` records `CHECK_EXIT=0` for the explicit `npm run check` on the Task 3 commit, started from an empty ESLint cache.
- `git log --oneline -3` shows the three Conventional Commit titles, `git status --short` lists only `.planning/` paths, CHANGELOG.md is unchanged since 5e161ce3, and no `.git/check-changed-full.lock` remains.
</verification>

<success_criteria>
- The network-free and ledger rules are lint errors at the offending line, and their tests are gone.
- `eslint.config.js` is the only home of the network list.
- The tooling self-tests and type-gate controls the user named are gone, together with compat-01's network delegation case, and no remaining test parses `eslint.config.js` or `package.json` script strings in their place. Every other real-tree assertion and every `tests/scripts` analyzer test remains.
- No prose or comment claims a deleted test enforces anything, and no type-member pin moved.
- The finished tree passes `npm run check`. The summary reports the removed cases (planned 35) and the new check and unit-suite durations against 669 s / 8399.
</success_criteria>

## Source audit

| SOURCE   | ID     | Item                                                                                                  | Task    | Status  |
| -------- | ------ | ----------------------------------------------------------------------------------------------------- | ------- | ------- |
| GOAL     | -      | Remove tooling self-tests; replace the network and ledger gates with ESLint rules                      | 1, 2, 3 | COVERED |
| REQ      | KWL-01 | Tooling self-tests, helper-only files, and type-gate self-tests deleted; real-tree proofs kept          | 2, 3    | COVERED |
| REQ      | KWL-02 | Network-free ESLint block with the moved list; network test and compat-01's delegation case deleted     | 2       | COVERED |
| REQ      | KWL-03 | Ledger zones in BLOCK C; import-boundaries test deleted with its pin and matrix cases                   | 1       | COVERED |
| REQ      | KWL-04 | Each new rule fires on lint-only offenders; nothing committed                                           | 1, 2    | COVERED |
| REQ      | KWL-05 | Analyzer and other architecture tests kept; only readers of moved data adapt; no clause re-pointed at tooling config | 1, 2, 3 | COVERED |
| REQ      | KWL-06 | Citations rewritten; orphaned registry exports deleted; CHANGELOG.md and `.planning/codebase/` untouched | 1, 2, 3 | COVERED |
| REQ      | KWL-07 | Content cache kept for hooks; final `npm run check` from an empty cache with metrics                    | 3       | COVERED |
| CONTEXT  | D-01   | Delete the named tooling self-tests, helpers, and type-gate self-tests                                  | 2, 3    | COVERED |
| CONTEXT  | D-02   | Replace no-orchestrator-network with a files-scoped ESLint block; move the list                         | 2       | COVERED |
| CONTEXT  | D-03   | Replace import-boundaries with import-x zones (intra- and cross-family), drop its pin and matrix check   | 1       | COVERED |
| CONTEXT  | D-04   | Verify each new rule on a temporary offender, never committed                                            | 1, 2    | COVERED |
| CONTEXT  | D-05   | Keep tests/scripts analyzer tests and every other architecture test                                     | 1, 2, 3 | COVERED |
| CONTEXT  | D-06   | Update prose citing deleted tests; leave CHANGELOG.md and `.planning/codebase/`                          | 1, 2, 3 | COVERED |
| CONTEXT  | D-07   | ESLint content cache is safe for these file-local rules                                                 | 1, 2, 3 | COVERED |
| RESEARCH | -      | No research phase for this quick task                                                                   | -       | N/A     |

<output>
Create `.planning/quick/261004-kwl-remove-tooling-self-tests-replace-networ/261004-kwl-SUMMARY.md` with `status: complete` in its frontmatter. Record:

- the three commits;
- for each pre-commit run: the command, its exit status, the commit, the Node version, the selected scope and commands, and the `durationMs`, `exitStatus`, and `lockWaitMs` of its `.git/check-changed.log` record;
- the lint-only offender results from Tasks 1 and 2, as script output;
- the `npm run lint:type-members` result from Task 2;
- the final run: HEAD, Node version, `CHECK_EXIT`, `CHECK_SECONDS`, both summary lines, and confirmation that the ESLint cache was empty at start;
- a before/after table: `npm run check` seconds (669 before), unit tests (8399) and `duration_ms` (329656), and integration tests (67) and `duration_ms` (12634). Note that each figure comes from a single run on one machine;
- the removed files (count and list), the lines deleted and added by area, and the removed test cases (8399 minus the new unit count, against the planned 35);
- the judgment calls in "Choices made within the decisions", the out-of-scope staleness reported there, and any deviation.

State the verification scope: the explicit final `npm run check` is the full verification of the finished tree, and the hooks supplied only focused and broad evidence. Name the user's decision this implements, so STATE.md can record that the network-free and ledger rules live in `eslint.config.js` and that the tooling self-tests are retired.

Include the section AGENTS.md requires:

```markdown
## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.
```

Replace "None" with specifics if execution finds otherwise.
</output>
