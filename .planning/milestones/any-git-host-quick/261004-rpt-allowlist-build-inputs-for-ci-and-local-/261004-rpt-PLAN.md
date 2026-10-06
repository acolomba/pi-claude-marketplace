---
phase: 261004-rpt
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - .github/workflows/ci.yml
  - scripts/check-changed.mjs
  - package.json
  - .pre-commit-config.yaml
  - CHANGELOG.md
  - CONTRIBUTING.md
  - skills/local-verification/SKILL.md
  - docs/unused-type-member-gate.md
autonomous: true
requirements: [RPT-01, RPT-02, RPT-03, RPT-04, RPT-05]

estimate:
  tokens: 70000
  raw_tokens: 70000
  tasks: 3
  confidence: low

must_haves:
  truths:
    - "D-01: .github/workflows/ci.yml has no denylist. Its push and pull_request triggers carry the same 24-entry paths allowlist (CI-1); workflow_call and workflow_dispatch stay unfiltered, and the sonarcloud uses line is unchanged."
    - "D-01: node scripts/check-changed.mjs --list selects nothing (scope none, reason No build inputs changed) for a change confined to non-build files: CHANGELOG.md, AGENTS.md, .pre-commit-config.yaml, .planning/, docs/adr/, docs/research/, skills/, scripts/*.sh, a non-workflow .github/ file, a non-TypeScript demos/ file, an unknown root file, or a removed CODE_OF_CONDUCT.md."
    - "D-01: documents under docs/ outside the dated records and the two READMEs select test:architecture; package.json, sonar-project.properties, .gitattributes, .editorconfig, demos/*.ts, a new workflow file, and a removed rule pack select the broad check; type-member data and test fixtures keep their focused selections."
    - "D-01: on all 24 harness scenarios, the ci.yml allowlist (GitHub path-filter semantics) and check-changed agree on whether a build runs, and every allowlist pattern matches a tracked file."
    - "D-02: npm run format, npm run format:check, and the pre-commit Prettier hook cover the old Prettier set minus the non-build files (866 -> 733 at planning). Only .planning/, .vscode/, .sonarlint/, .pi/, and gsd-capabilities/ files drop, none is added, and npm run format:check passes."
    - "D-02: isFormatted in scripts/check-changed.mjs is isBuildInput intersected with the old Prettier extension rule."
    - "C-01: CONTRIBUTING.md, skills/local-verification/SKILL.md, docs/unused-type-member-gate.md line 17, and the #236 CHANGELOG entry describe the allowlist; line 19 of the gate doc is unchanged; .planning/codebase/ is unchanged and its stale lines are listed in the SUMMARY."
  artifacts:
    - path: ".github/workflows/ci.yml"
      provides: "the build-input paths allowlist on push and pull_request"
      contains: "!docs/research/**"
    - path: "scripts/check-changed.mjs"
      provides: "isBuildInput: files outside the allowlist select no checks"
      contains: "function isBuildInput(file) {"
    - path: "package.json"
      provides: "format and format:check scoped to the build inputs"
      contains: "{extensions,rule-packs,tests}/**/*.{js,json,ts}"
    - path: ".pre-commit-config.yaml"
      provides: "the Prettier hook scoped to the same files"
      contains: "package(-lock)?"
  key_links:
    - from: ".github/workflows/ci.yml paths"
      to: "scripts/check-changed.mjs isBuildInput"
      via: "the same 24 inputs; each file's comment names the other"
      pattern: "scripts/check-changed.mjs keeps the"
    - from: "scripts/check-changed.mjs rules"
      to: "isBuildInput"
      via: "the first rule maps every non-build file to none"
      pattern: "[(file) => !isBuildInput(file), \"none\"],"
    - from: "package.json format:check"
      to: ".pre-commit-config.yaml prettier files"
      via: "the same file set, proven by tmp/rpt/prettier-scope.mjs"
      pattern: "files: '^((extensions|rule-packs|tests)"
    - from: ".pre-commit-config.yaml npm-check-changed"
      to: "scripts/check-changed.mjs"
      via: "npm run check:changed; with the package.json script, the only consumers of the selector (lint.yml SKIPs the hook in CI)"
      pattern: "entry: npm run check:changed"
---

# Trigger builds from an allowlist of build inputs, in CI and at commit time

<objective>
Replace the CI denylist and the commit-time selector's unknown-input fallback with one allowlist of build inputs (D-01), and narrow Prettier to the same inputs (D-02). A change to a file that no npm build or CI job reads then starts no CI run and selects no commit-time check. The docs that describe the selector change with it (C-01).

Purpose: the operator rejected the `ci.yml` denylist rationale ("over-running CI costs minutes, while under-running is indistinguishable from a pass"). Full builds ran for planning files, an extra changed file, or an uncommitted file. The allowlist names only what the build truly reads. `docs/output-catalog.md` stays in because a test reads it, and the same rule keeps in `demos/browse-demo.ts`, which Fallow reads.

Output:

- Task 1 (tracer): the allowlist end to end. `ci.yml` filters push and pull_request with it (CI-1), and `scripts/check-changed.mjs` classifies every file outside it as `none` (CC-1 to CC-4). A scratch harness proves 24 scenarios on the committed tree, with CI and the selector agreeing on each.
- Task 2: Prettier covers only build inputs: `format`, `format:check`, the pre-commit hook, and the selector's `isFormatted` (PR-1, PR-2, CC-5). A scratch check proves the new file set is the old set minus the non-build files.
- Task 3: CONTRIBUTING.md, the local-verification skill, the type-member gate doc, and the #236 changelog entry describe the allowlist (DOC-1 to DOC-4). `.planning/codebase/` stays untouched; the SUMMARY lists its stale lines.
</objective>

## Requirement map

D-01 and D-02 are the operator's two locked decisions, and C-01 is the coordinator's scope addition. They and the RPT IDs are plan-local labels. Never cite them in code, comments, or commit messages.

| ID     | Source | Outcome                                                                                                                                                   | Task |
| ------ | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- |
| RPT-01 | D-01   | `ci.yml` push and pull_request use one 24-entry `paths` allowlist; the denylist and its rationale comment are gone                                          | 1    |
| RPT-02 | D-01   | check-changed: non-build files select nothing; a build input no rule claims selects broad; removal broadens only for build inputs; documentation narrowed | 1    |
| RPT-03 | D-02   | `format`, `format:check`, the pre-commit Prettier hook, and `isFormatted` cover only build inputs                                                          | 2    |
| RPT-04 | C-01   | CONTRIBUTING.md, `skills/local-verification/SKILL.md`, `docs/unused-type-member-gate.md` (line 17; line 19 verified), and the #236 changelog entry       | 3    |
| RPT-05 | Orchestrator | `.planning/codebase/*.md` untouched; the SUMMARY lists their stale lines as follow-ups                                                               | 3    |

## Facts measured during planning

2026-10-04, branch `features/faster-precommit`, main checkout, HEAD fe83cae0, Node v26.10.0, Prettier 3.9.6. Rely on these instead of re-deriving them.

1. Concurrency. Quick task 261004-re9 edited files in this checkout during planning. It finished at fe83cae0, and its commits touched none of this plan's eight files. The operator may edit files at any time: stage explicit paths only.
2. Consumers. `scripts/check-changed.mjs` has exactly two: the `check:changed` script in `package.json` and the `npm-check-changed` pre-commit hook. `lint.yml` runs pre-commit in CI with `SKIP: prettier,npm-check-changed`, so CI never runs the selector or the Prettier hook. The selector has no test file, deleted on purpose on this branch. Do not add one.
3. What the build reads. `tsc` reads `tsconfig.json` (include: `extensions/**/*.ts`, `tests/**/*.ts`). ESLint runs over `extensions tests scripts eslint.config.js`. Prettier's normalized arguments show `ignorePath: [".gitignore", ".prettierignore"]` and `editorconfig: true`, so it reads `.prettierrc.json`, `.prettierignore`, `.gitignore`, and `.editorconfig`. Fallow reads `.fallowrc.json` and `rule-packs/architecture.json`, honors `.gitignore`, and discovers `demos/browse-demo.ts` (`fallow list --files`). That file carries a `fallow-ignore-file unused-file` marker, and `.fallowrc.json` lists `demos/**` under `allowUnmatched`. Fallow health, dupes, and cycle runs therefore analyze it. `lint:workflows` reads every file under `.github/workflows/`. The `sonarcloud` job reads `sonar-project.properties`. `npm ci` reads `package.json` and `package-lock.json`. `actions/checkout` applies `.gitattributes` (eol and LFS rules) to every file the jobs read.
4. Docs read by tests. `tests/architecture/no-stale-test-citations.test.ts` polices `.md`, `.ts`, and `.mjs` under `docs/` except `docs/adr/`, `docs/plans/`, and `docs/research/`. Pins read `docs/output-catalog.md`, `docs/messaging-style-guide.md`, `docs/prd/pi-claude-marketplace-prd.md`, `docs/workflows-compatibility.md`, `docs/dependency-resolution.md`, `README.md`, and `README.es.md`. `docs/` holds only Markdown plus `docs/plans/.gitkeep`.
5. Not read by any npm build or CI job: `CHANGELOG.md` and `LICENSE` (`npm pack --dry-run` lists them but cannot fail on their content), AGENTS.md, CONTRIBUTING.md, CODE_OF_CONDUCT.md, COPYING, `.pre-commit-config.yaml`, `zizmor.yml`, `.yamlfmt`, `.gitlint`, `.markdownlint-cli2.yaml`, `.mdformat.toml` (the unfiltered `lint.yml` pre-commit job covers these), `.mcp.json`, `.github/dependabot.yml`, `scripts/init.sh`, `scripts/pi.sh` (only a comment in `tests/pi-runtime.ts` names it), `images/`, the non-TypeScript files in `demos/`, `skills/`, `.agents/`, `.claude/`, `.codex/`, `.pi/`, `.planning/`, `.vscode/`, `.sonarlint/`, `gsd-capabilities/`, and the three dated docs directories. Simulated over `git ls-files`, CI-1 ignores 3,937 of 4,727 tracked files, exactly these groups, and every CI-1 pattern matches at least one tracked file.
6. GitHub path filters (docs source). `**` matches any character, including `/`, and `**/` may match no directory. `*` does not match `/`. `?` and `+` quantify the preceding character; CI-1 uses neither. `!` excludes paths that earlier patterns matched, and the last matching pattern wins. `paths` and `paths-ignore` cannot share an event. Tag pushes skip path filters. A diff over 3,000 files can skip a run. No dot-file exception exists, so `tests/**` covers the 17 tracked fixtures under `.claude-plugin/` and `.claude/` directories.
7. Prettier sets. The old globs check 866 files: tests 439, extensions 268, `.planning` 128, scripts 18, `.vscode` 2, `.sonarlint` 1, `rule-packs` 1, `.pi` 1, `gsd-capabilities` 1, `demos` 1, and six root files (`.fallowrc.json`, `.prettierrc.json`, `eslint.config.js`, `package-lock.json`, `package.json`, `tsconfig.json`). `.mcp.json` is Prettier-ignored, and `skills-lock.json` and `.gsd-capabilities.json` are gitignored. The PR-1 globs check 733 files, exactly the old set filtered by the PR-2 regex. Of the tracked files the PR-2 regex passes, only three are not in that set, and Prettier ignores all three: the invalid-manifest fixture and two `.claude/settings*.json` fixtures. `.planning/**/*.json` passes Prettier today, so the old `format:check` is green.
8. Validation. All of CI-1, CC-1 to CC-5, PR-1, and PR-2 were committed in a throwaway detached worktree. On that tree: the SCN harness 24/24; PSC prints `Prettier scope: 866 -> 733 files; dropped 133 under .pi, .planning, .sonarlint, .vscode, gsd-capabilities`; `npm run format:check`, ESLint, Prettier, and Fallow (`dead-code`, the cycle run, `health --complexity`, `dupes`) all exit 0. `check-yaml`, `yamllint`, `yamlfmt` (no rewrite), and `zizmor` pass on the CI-1 file. `check-changed --list --base HEAD~1` selects broad by `.github/workflows/ci.yml`, `package.json`, and `scripts/check-changed.mjs`; `.pre-commit-config.yaml` selects nothing. Against today's selector, the harness fails exactly its 12 `none` scenarios: the behavior this task changes.
9. `uses: $/.github/workflows/sonarcloud.yml` in `ci.yml` is valid: recent CI runs on this branch and on main succeeded with it. Leave it.
10. A detached worktree created under this checkout's gitignored `tmp/` resolves `typescript` from this checkout's `node_modules`, with no symlink. That is how SCN checks a clean committed tree while the main checkout may be dirty.
11. Commits. No git hook is installed in this checkout, so run `pre-commit run --verbose --files …` yourself before each commit. Pass only paths that exist. Use `git commit -F`. Never `--no-verify`, never amend, never `git add -A`, never `git checkout --` to revert. The shell is zsh, which does not word-split unquoted variables: pass paths literally. The Prettier and yamlfmt hooks may rewrite files: inspect, restage, and re-run.
12. Hook cost. Tasks 1 and 2 select the broad check (warm caches: about 80 s for the last broad run in `check-changed.log`). Task 3 selects only `test:architecture`. Run each hook in the foreground with a 600000 ms timeout; never pipe or poll it.

## Choices made within the decisions

1. `demos/**/*.ts` is a build input (D-01). The coordinator's findings listed `demos/` as unread, but Fallow analyzes `demos/browse-demo.ts` (fact 3), so a change there can fail `npm run fallow`. This follows the operator's own rule for `docs/output-catalog.md`. The other `demos/` files (GIFs, tapes, a shell script) stay out. Prettier keeps checking `demos/browse-demo.ts`, because D-02's scope is the old Prettier set limited to the allowlist. Not taken: adding `demos/**` to Fallow's `ignorePatterns` and dropping it from both lists. That changes what Fallow checks, which neither decision asked for.
2. `.gitattributes` is a build input (D-01). `actions/checkout` applies it to every file the jobs read: a stray `eol=crlf` or LFS rule would fail Prettier or the tests in CI.
3. One list, two places (D-01). `isBuildInput` mirrors CI-1 entry for entry, so `sonar-project.properties` and `.gitattributes` select the broad check locally too. That is the fallback for any build input no finer rule claims. Both comments name the other file.
4. Documentation (D-01) is any file under `docs/` except the three dated directories, plus `README.md` and `README.es.md` by exact name. This matches the `docs/**` entry in CI-1 and the test's `.md`/`.ts`/`.mjs` policing. Tests read only those two READMEs, so the old language-variant regex goes. `CHANGELOG.md` drops out.
5. `isFormatted` (D-02) becomes `isBuildInput(file)` intersected with the old extension rule. It then follows the allowlist without a third list. On today's tree it equals the PR-1 file set; it would admit a future JSON file under `docs/` that PR-1 does not glob, which is harmless.
6. Prettier root files (D-02) are named explicitly, not `*.{js,json,ts}`, so a new root JSON file is not swept in. Prettier matches the dotfiles `.fallowrc.json` and `.prettierrc.json` (fact 7). A pattern that matches nothing is a Prettier error; if a listed path is ever deleted, remove it from PR-1 and PR-2 together.
7. `.prettierignore` stays unchanged (D-02). Its entries still guard runs that pass explicit paths, such as an editor's format-on-save and the pre-commit hook: `.claude/`, `.opencode/`, `tmp/`, the invalid-manifest fixture, `*.md`, and `.mcp.json`.
8. The changelog line folds into the existing #236 entry (DOC-4), because `.claude/rules/changelog.md` allows one top-level bullet per pull request, and PR #236 is this branch's open PR.
9. `docs/unused-type-member-gate.md` line 17 is rewritten (planner addition to C-01): it says CI runs on every pull request, which CI-1 makes false. Line 19 was verified accurate and stays.
10. The scratch scripts (SCN, PSC) live in the gitignored `tmp/rpt/` and are never committed, in line with this branch's removal of tooling self-tests. The SCN worktree is a disposable verification checkout: never edit or commit in it, and remove it after each run.

## Out of scope (list in the SUMMARY, do not edit)

- `.planning/codebase/STACK.md` line 40 (Prettier scope) and line 92 ("paths-ignore for docs/planning"); `.planning/codebase/CONVENTIONS.md` line 33 (format scope); `.planning/codebase/CONCERNS.md` lines 43-44 (the docs `paths-ignore` concern, now resolved).
- AGENTS.md line 43 and `skills/local-verification/SKILL.md` line 26 say CI runs `npm run check` on pull requests; it now runs only on those that change a build input.
- `.agents/skills/babysit-pr/SKILL.md` line 50 waits up to about 15 minutes for SonarCloud, which never runs on a pull request that changes no build input.
- Selector gap that predates this task: an `extensions/**/*.md` edit selects broad, which does not run `test:architecture`, although the stale-citation test polices extension Markdown.
- The `.prettierignore` comment on `.mcp.json` says the file is never committed; it is committed.

## Exact text

Each OLD/NEW pair lists whole lines unless it says otherwise. Replace exactly the OLD text with the NEW text; every OLD string is unique at fe83cae0. Prettier does not rewrap comments, so keep comment lines as written.

### CI-1 (Task 1): `.github/workflows/ci.yml`, today's lines 10-39

OLD:

```yaml
  push:
    branches:
      - main
    # Denylist, not an allowlist: package.json, the lockfile, tsconfig and
    # the lint config live outside extensions/ + tests/ and MUST still
    # trigger CI.
    #
    # `**/*.md` and `docs/**` were removed from this list. They rested on
    # "no test reads repo markdown", which is false:
    # tests/architecture/catalog-uat.test.ts reads `docs/output-catalog.md`
    # and byte-compares 166 annotated examples against notify() output. A
    # docs-only edit that broke that contract skipped the only gate that
    # would catch it. `paths-ignore` cannot negate a single path, so the
    # whole markdown ignore goes: over-running CI costs minutes, while
    # under-running it is indistinguishable from a pass.
    paths-ignore:
      - "images/**"
      - "demos/**"
      - ".planning/**"
      - "COPYING"
  pull_request:
    branches:
      - main
    # Same reasoning as the push trigger above: docs/output-catalog.md is
    # test-examined, so markdown cannot be ignored wholesale.
    paths-ignore:
      - "images/**"
      - "demos/**"
      - ".planning/**"
      - "COPYING"
```

NEW:

```yaml
  push:
    branches:
      - main
    # Build inputs only: the files that an npm build or a CI job reads. A
    # change to any other file skips CI. scripts/check-changed.mjs keeps the
    # same list for commit-time checks; change both together.
    paths:
      - "extensions/**"
      - "tests/**"
      - "scripts/**/*.mjs"
      - "scripts/**/*.json"
      - "rule-packs/**"
      - "demos/**/*.ts"
      - "docs/**"
      - "!docs/adr/**"
      - "!docs/plans/**"
      - "!docs/research/**"
      - "README.md"
      - "README.es.md"
      - ".github/workflows/**"
      - ".editorconfig"
      - ".fallowrc.json"
      - ".gitattributes"
      - ".gitignore"
      - ".prettierignore"
      - ".prettierrc.json"
      - "eslint.config.js"
      - "package-lock.json"
      - "package.json"
      - "sonar-project.properties"
      - "tsconfig.json"
  pull_request:
    branches:
      - main
    # Same list as the push trigger.
    paths:
      - "extensions/**"
      - "tests/**"
      - "scripts/**/*.mjs"
      - "scripts/**/*.json"
      - "rule-packs/**"
      - "demos/**/*.ts"
      - "docs/**"
      - "!docs/adr/**"
      - "!docs/plans/**"
      - "!docs/research/**"
      - "README.md"
      - "README.es.md"
      - ".github/workflows/**"
      - ".editorconfig"
      - ".fallowrc.json"
      - ".gitattributes"
      - ".gitignore"
      - ".prettierignore"
      - ".prettierrc.json"
      - "eslint.config.js"
      - "package-lock.json"
      - "package.json"
      - "sonar-project.properties"
      - "tsconfig.json"
```

### CC-1 (Task 1): `scripts/check-changed.mjs`, today's lines 211-226

OLD:

```js
/** Planning records and agent instruction Markdown select no checks: no test reads them. */
function isInstruction(file) {
  return (
    file.startsWith(".planning/") ||
    (/^(skills|\.agents|\.claude)\//.test(file) && file.endsWith(".md")) ||
    ["AGENTS.md", "CLAUDE.md", "CONTRIBUTING.md"].includes(file)
  );
}

function isDocumentation(file) {
  return (
    (file.startsWith("docs/") && file.endsWith(".md")) ||
    /^README(\.[a-z]{2,3}(-[A-Za-z0-9]+)*)?\.md$/.test(file) ||
    file === "CHANGELOG.md"
  );
}
```

NEW:

```js
/**
 * Architecture tests read both READMEs and every document under `docs/` except
 * the dated records in `adr/`, `plans/`, and `research/`.
 */
function isDocumentation(file) {
  return (
    (file.startsWith("docs/") && !/^docs\/(adr|plans|research)\//.test(file)) ||
    file === "README.md" ||
    file === "README.es.md"
  );
}

/** Root files a build reads: tool configuration, the SonarCloud settings, and git's rules. */
const buildConfigFiles = new Set([
  ".editorconfig",
  ".fallowrc.json",
  ".gitattributes",
  ".gitignore",
  ".prettierignore",
  ".prettierrc.json",
  "eslint.config.js",
  "package-lock.json",
  "package.json",
  "sonar-project.properties",
  "tsconfig.json",
]);

/**
 * The files an npm build or a CI job reads. The `paths` filters in
 * `.github/workflows/ci.yml` name the same files; change both together.
 * Fallow analyzes the TypeScript under `demos/`.
 */
function isBuildInput(file) {
  return (
    buildConfigFiles.has(file) ||
    /^(extensions|tests|rule-packs|\.github\/workflows)\//.test(file) ||
    /^scripts\/.*\.(json|mjs)$/.test(file) ||
    /^demos\/.*\.ts$/.test(file) ||
    isDocumentation(file)
  );
}
```

### CC-2 (Task 1): `scripts/check-changed.mjs`, today's lines 243-245

OLD:

```js
/** First match wins; `broad` is also the fallback for unrecognized inputs. */
const rules = [
  [isInstruction, "none"],
```

NEW:

```js
/**
 * First match wins. A file outside the build inputs selects nothing, and a
 * build input that no rule claims falls back to `broad`.
 */
const rules = [
  [(file) => !isBuildInput(file), "none"],
```

The rest of `rules` and `classify` (with its `?? "broad"` fallback) stay unchanged. Order matters: the documentation rule still precedes the missing-file rule, so a removed document selects `test:architecture`, and a removed non-build file selects nothing.

### CC-3 (Task 1): `scripts/check-changed.mjs`, today's line 521

OLD:

```js
    return { scope: "none", reason: "No executable inputs changed", commands: [] };
```

NEW:

```js
    return { scope: "none", reason: "No build inputs changed", commands: [] };
```

### CC-4 (Task 1): `scripts/check-changed.mjs`, today's lines 549-552

OLD:

```js
/**
 * Plans commit-time checks. Unknown inputs broaden to the broad check; no plan
 * runs `npm run check`, and a focused or broad pass is never a full verdict.
 */
```

NEW:

```js
/**
 * Plans commit-time checks. A build input that no rule recognizes broadens to
 * the broad check; no plan runs `npm run check`, and a focused or broad pass is
 * never a full verdict.
 */
```

### CC-5 (Task 2): `scripts/check-changed.mjs`, `isFormatted` (today's lines 228-230; after Task 1 it directly follows `isBuildInput`)

OLD:

```js
function isFormatted(file) {
  return /\.(js|json|ts)$/.test(file) || /^scripts\/.*\.mjs$/.test(file);
}
```

NEW:

```js
/** The build inputs Prettier checks: JavaScript, JSON, and TypeScript files, and the scripts. */
function isFormatted(file) {
  return isBuildInput(file) && (/\.(js|json|ts)$/.test(file) || /^scripts\/.*\.mjs$/.test(file));
}
```

### PR-1 (Task 2): `package.json`, today's lines 82-83

OLD:

```json
    "format": "prettier --write \"**/*.{js,json,ts}\" \"scripts/**/*.mjs\" --cache --cache-strategy content",
    "format:check": "prettier --check \"**/*.{js,json,ts}\" \"scripts/**/*.mjs\" --cache --cache-strategy content",
```

NEW:

```json
    "format": "prettier --write \"{extensions,rule-packs,tests}/**/*.{js,json,ts}\" \"scripts/**/*.{json,mjs}\" \"demos/**/*.ts\" .fallowrc.json .prettierrc.json eslint.config.js package-lock.json package.json tsconfig.json --cache --cache-strategy content",
    "format:check": "prettier --check \"{extensions,rule-packs,tests}/**/*.{js,json,ts}\" \"scripts/**/*.{json,mjs}\" \"demos/**/*.ts\" .fallowrc.json .prettierrc.json eslint.config.js package-lock.json package.json tsconfig.json --cache --cache-strategy content",
```

### PR-2 (Task 2): `.pre-commit-config.yaml`, today's lines 96-100

OLD:

```yaml
      - id: prettier
        name: prettier
        entry: node_modules/.bin/prettier --write --cache --cache-strategy content
        language: system
        files: '\.(js|json|ts)$|^scripts/.*\.mjs$'
```

NEW:

```yaml
      # Same files as `npm run format`: the JavaScript, JSON, and TypeScript
      # build inputs.
      - id: prettier
        name: prettier
        entry: node_modules/.bin/prettier --write --cache --cache-strategy content
        language: system
        files: '^((extensions|rule-packs|tests)/.*\.(js|json|ts)|scripts/.*\.(json|mjs)|demos/.*\.ts|\.fallowrc\.json|\.prettierrc\.json|eslint\.config\.js|package(-lock)?\.json|tsconfig\.json)$'
```

### DOC-1 (Task 3): `CONTRIBUTING.md`, line 60 (two sentence replacements inside the one-line paragraph)

OLD sentence A:

```text
Unpaired tests, test support, fixtures, documentation, analyzer scripts, and type-member contract data select their own targeted checks, and files under `.planning/` and the agent skill and instruction Markdown need none, because no test reads them.
```

NEW sentence A:

```text
Unpaired tests, test support, fixtures, documentation, analyzer scripts, and type-member contract data select their own targeted checks. A file that no build reads selects none. The build inputs are the paths that `.github/workflows/ci.yml` lists, and CI runs only when one of them changes.
```

OLD text B (a prefix of the next sentence; the rest of that sentence stays):

```text
Removed files, configuration, tooling, scripts without a matching `tests/scripts` test, and unknown inputs select the broad check: whole-repository Prettier, type checking,
```

NEW text B:

```text
Configuration, tooling, scripts without a matching `tests/scripts` test, removed build inputs other than documentation, and any other build input that no rule recognizes select the broad check: Prettier on the JavaScript, JSON, and TypeScript build inputs, type checking,
```

### DOC-2 (Task 3): `skills/local-verification/SKILL.md`, line 20 (three replacements inside the one-line paragraph)

OLD 1:

```text
Documentation, the READMEs, and CHANGELOG.md run `test:architecture`.
```

NEW 1:

```text
`README.md`, `README.es.md`, and the documents under `docs/` run `test:architecture`. The dated records under `docs/adr/`, `docs/plans/`, and `docs/research/` are not build inputs.
```

OLD 2:

```text
Files under `.planning/` and Markdown under `skills/`, `.agents/`, and `.claude/`, plus AGENTS.md, CLAUDE.md, and CONTRIBUTING.md, need the document hooks only, because no test reads them.
```

NEW 2:

```text
A file that is not a build input needs the document hooks only, because no build reads it. The build inputs are the paths in the `paths` filters of `.github/workflows/ci.yml`, and CI runs only when one of them changes.
```

OLD 3 (a prefix of the next sentence; the rest of that sentence stays):

```text
Removals, package, tool, configuration, and CI changes, scripts without a matching `tests/scripts` test, end-to-end and live-UAT files, and unrecognized or uncertain inputs run the broad check:
```

NEW 3:

```text
Package, tool, configuration, and CI changes, scripts without a matching `tests/scripts` test, end-to-end and live-UAT files, removed build inputs other than documentation, and any other build input that no rule recognizes run the broad check:
```

### DOC-3 (Task 3): `docs/unused-type-member-gate.md`, line 17 (one sentence)

OLD:

```text
Continuous integration runs `npm run check` on every run, which includes every pull request, the path every change takes to main.
```

NEW:

```text
Continuous integration runs `npm run check` on every pull request that changes a build input, the path every such change takes to main. Every file the gate reads is a build input.
```

### DOC-4 (Task 3): `CHANGELOG.md`, line 5 (the #236 entry)

OLD:

```text
- Internal: pre-commit now runs only incremental checks, and the full `npm run check` runs at GSD checkpoints, at PR handoff, and in CI. (#236)
```

NEW (one sentence, 24 words before the PR number):

```text
- Internal: commits run only incremental checks, `npm run check` runs at GSD checkpoints and PR handoff, and CI runs only when build inputs change. (#236)
```

### SCN: `tmp/rpt/scenarios.mjs` (scratch, never committed)

Write verbatim. Run it as `node tmp/rpt/scenarios.mjs tmp/rpt-wt`, where `tmp/rpt-wt` is a detached worktree at the commit to verify.

```js
// Scratch verification for the build-input allowlist. Never commit this file.
// Usage: node tmp/rpt/scenarios.mjs <checkout>, where <checkout> is a clean
// worktree under the main checkout's tmp/ (its node_modules resolve upward).
import { spawnSync } from "node:child_process";
import { appendFileSync, existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(process.argv[2] ?? ".");
const CI = path.join(ROOT, ".github/workflows/ci.yml");
const MOVED = "tmp/rpt/moved";
const FIXTURE = "tests/orchestrators/marketplace/_fixtures/valid-marketplace/.claude-plugin/marketplace.json";
const CONTRACTS = "scripts/check-unused-type-members.contracts.json";

// [kind, path, expected]. kind: new = untracked file, edit = append a line to
// a tracked file, remove = move a tracked file away. expected: none,
// documentation, broad, typeMembers, fixture.
const SCENARIOS = [
  ["edit", "CHANGELOG.md", "none"],
  ["edit", ".pre-commit-config.yaml", "none"],
  ["edit", "AGENTS.md", "none"],
  ["new", ".planning/rpt-scratch.json", "none"],
  ["new", "docs/adr/rpt-scratch.md", "none"],
  ["new", "docs/research/rpt-scratch.md", "none"],
  ["new", "rpt-scratch-notes.txt", "none"],
  ["new", "scripts/rpt-scratch.sh", "none"],
  ["new", ".github/rpt-scratch.yml", "none"],
  ["new", "demos/rpt-scratch.tape", "none"],
  ["new", "skills/rpt-scratch.md", "none"],
  ["remove", "CODE_OF_CONDUCT.md", "none"],
  ["edit", "docs/output-catalog.md", "documentation"],
  ["edit", "README.es.md", "documentation"],
  ["new", "docs/guidelines/rpt-scratch.md", "documentation"],
  ["edit", "package.json", "broad"],
  ["edit", "sonar-project.properties", "broad"],
  ["edit", ".gitattributes", "broad"],
  ["edit", ".editorconfig", "broad"],
  ["new", "demos/rpt-scratch.ts", "broad"],
  ["new", ".github/workflows/rpt-scratch.yml", "broad"],
  ["remove", "rule-packs/architecture.json", "broad"],
  ["edit", CONTRACTS, "typeMembers"],
  ["edit", FIXTURE, "fixture"],
];

function run(args) {
  const child = spawnSync(args[0], args.slice(1), { cwd: ROOT, encoding: "utf8" });
  if (child.status !== 0) {
    throw new Error(`${args.join(" ")} failed: ${child.stderr}`);
  }

  return child.stdout;
}

function listPlan() {
  return JSON.parse(run([process.execPath, "scripts/check-changed.mjs", "--list"]));
}

function status() {
  return run(["git", "status", "--porcelain", "--untracked-files=all"]).split("\n").filter(Boolean);
}

// GitHub path filter semantics: ** spans directories (and `**/` may match
// none), * stays inside one segment, and the last matching pattern wins.
function toRegExp(glob) {
  let source = "";
  for (let index = 0; index < glob.length; index += 1) {
    if (glob.startsWith("**/", index)) {
      source += "(?:.*/)?";
      index += 2;
    } else if (glob.startsWith("**", index)) {
      source += ".*";
      index += 1;
    } else if (glob[index] === "*") {
      source += "[^/]*";
    } else {
      source += glob[index].replace(/[.+?^${}()|[\]\\]/g, "\\$&");
    }
  }

  return new RegExp(`^${source}$`);
}

function pathLists() {
  const lines = readFileSync(CI, "utf8").split("\n");
  const lists = [];
  for (let index = 0; index < lines.length; index += 1) {
    if (/^ {4}paths:\s*$/.test(lines[index])) {
      const list = [];
      for (index += 1; /^ {6}- "/.test(lines[index] ?? ""); index += 1) {
        list.push(/^ {6}- "(.*)"\s*$/.exec(lines[index])[1]);
      }

      lists.push(list);
    }
  }

  return lists;
}

function ciRuns(patterns, file) {
  return patterns.reduce((included, pattern) => {
    const negated = pattern.startsWith("!");
    return toRegExp(negated ? pattern.slice(1) : pattern).test(file) ? !negated : included;
  }, false);
}

function matches(expected, plan, file) {
  const commands = JSON.stringify(plan.commands);
  switch (expected) {
    case "none":
      return plan.scope === "none" && plan.commands.length === 0 && plan.reason === "No build inputs changed";
    case "documentation":
      return plan.scope === "focused" && plan.reason === "Documentation" && commands === '[["npm","run","test:architecture"]]';
    case "broad":
      return plan.scope === "broad" && plan.reason.includes(file);
    case "typeMembers":
      return plan.scope === "focused" && commands.includes(`"--check"`) && commands.includes(`"${file}"`) && commands.includes('["npm","run","lint:type-members"]');
    case "fixture":
      return plan.scope === "focused" && commands.includes(`"--check"`) && commands.includes(`"${file}"`) && commands.includes('["npm","run","test:architecture"]') && commands.includes('["npm","run","test:modules"]');
    default:
      throw new Error(`unknown expectation ${expected}`);
  }
}

function apply(kind, relative) {
  const file = path.join(ROOT, relative);
  if (kind === "new") {
    if (existsSync(file)) {
      throw new Error(`${file} already exists`);
    }

    writeFileSync(file, "rpt scratch\n");
    return () => rmSync(file);
  }

  const original = readFileSync(file);
  if (kind === "edit") {
    appendFileSync(file, "\n");
    return () => writeFileSync(file, original);
  }

  const moved = path.join(ROOT, MOVED, path.basename(file));
  mkdirSync(path.dirname(moved), { recursive: true });
  renameSync(file, moved);
  return () => renameSync(moved, file);
}

const before = status();
const foreign = before.filter((line) => !line.slice(3).startsWith(".planning/"));
if (foreign.length > 0) {
  console.error("Changes outside .planning/; commit or wait first:\n" + foreign.join("\n"));
  process.exit(1);
}

const [push, pullRequest] = pathLists();
if (!push || JSON.stringify(push) !== JSON.stringify(pullRequest)) {
  console.error("ci.yml must carry two identical paths lists", { push, pullRequest });
  process.exit(1);
}

const baseline = listPlan();
if (baseline.scope !== "none") {
  console.error("Baseline selects checks; expected none:", baseline);
  process.exit(1);
}

const failures = [];
for (const [kind, file, expected] of SCENARIOS) {
  const restore = apply(kind, file);
  let plan;
  try {
    plan = listPlan();
  } finally {
    restore();
  }

  const ok = matches(expected, plan, file) && ciRuns(push, file) === (expected !== "none");
  console.log(`${ok ? "ok  " : "FAIL"} ${kind.padEnd(6)} ${file} -> ${plan.scope} (${plan.reason}); CI runs: ${ciRuns(push, file)}`);
  if (!ok) {
    failures.push(file);
  }
}

const tracked = run(["git", "ls-files"]).split("\n").filter(Boolean);
const dead = push.filter((pattern) => !pattern.startsWith("!") && !tracked.some((file) => toRegExp(pattern).test(file)));
const after = status();
if (dead.length > 0) {
  failures.push(`patterns matching no tracked file: ${dead.join(", ")}`);
}

if (JSON.stringify(after) !== JSON.stringify(before)) {
  failures.push(`git status changed:\n${after.join("\n")}`);
}

if (failures.length > 0) {
  console.error(`\n${failures.length} failure(s):\n${failures.join("\n")}`);
  process.exit(1);
}

console.log(`\nall ${SCENARIOS.length} scenarios match; CI ignores ${tracked.filter((file) => !ciRuns(push, file)).length} of ${tracked.length} tracked files`);
```

### PSC: `tmp/rpt/prettier-scope.mjs` (scratch, never committed)

Write verbatim. Run it from the checkout root after both Prettier logs exist.

```js
// Scratch check for the Prettier scope. Never commit this file.
// Usage, from the checkout root: node tmp/rpt/prettier-scope.mjs
import { readFileSync } from "node:fs";
import path from "node:path";

const SCOPE = String.raw`^((extensions|rule-packs|tests)/.*\.(js|json|ts)|scripts/.*\.(json|mjs)|demos/.*\.ts|\.fallowrc\.json|\.prettierrc\.json|eslint\.config\.js|package(-lock)?\.json|tsconfig\.json)$`;
const ARGS =
  '"{extensions,rule-packs,tests}/**/*.{js,json,ts}" "scripts/**/*.{json,mjs}" "demos/**/*.ts" .fallowrc.json .prettierrc.json eslint.config.js package-lock.json package.json tsconfig.json';
const NON_BUILD = /^(\.planning|\.vscode|\.sonarlint|\.pi|gsd-capabilities)\//;

function checkedFiles(log) {
  const text = readFileSync(log, "utf8");
  if (!text.includes("All matched files use Prettier code style!")) {
    throw new Error(`${log}: the Prettier run did not pass`);
  }

  const prefix = process.cwd() + path.sep;
  const files = [...text.matchAll(/^\[debug\] resolve config from '(.*)'$/gm)].map((match) =>
    match[1].replace(prefix, ""),
  );
  return [...new Set(files)].sort();
}

const before = checkedFiles("tmp/rpt/prettier-old.log");
const after = checkedFiles("tmp/rpt/prettier-new.log");
const scripts = JSON.parse(readFileSync("package.json", "utf8")).scripts;
const hook = /^ {8}files: '(.*)'$/m.exec(readFileSync(".pre-commit-config.yaml", "utf8"))?.[1];
const scope = new RegExp(SCOPE);
const dropped = before.filter((file) => !after.includes(file));
const droppedInputs = dropped.filter((file) => !NON_BUILD.test(file));
const failures = [
  scripts["format:check"] !== `prettier --check ${ARGS} --cache --cache-strategy content` &&
    "format:check differs from PR-1",
  scripts.format !== `prettier --write ${ARGS} --cache --cache-strategy content` &&
    "format differs from PR-1",
  hook !== SCOPE && `the pre-commit Prettier files regex differs from PR-2: ${hook}`,
  after.length === 0 && "the new Prettier run checked no file",
  JSON.stringify(before.filter((file) => scope.test(file))) !== JSON.stringify(after) &&
    "the new set is not the old set filtered by the PR-2 regex",
  after.some((file) => !before.includes(file)) && "the new set adds files",
  droppedInputs.length > 0 && `dropped build inputs: ${droppedInputs.join(", ")}`,
].filter(Boolean);
if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exit(1);
}

const groups = [...new Set(dropped.map((file) => file.split("/")[0]))].sort().join(", ");
console.log(
  `Prettier scope: ${before.length} -> ${after.length} files; dropped ${dropped.length} under ${groups}`,
);
```

<execution_context>
@.claude/gsd-core/workflows/execute-plan.md
@.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@AGENTS.md
@skills/local-verification/SKILL.md
@skills/typescript-comments/SKILL.md
@.claude/rules/changelog.md
</context>

<tasks>

<task type="tracer">
  <name>Task 1: The build-input allowlist, end to end: CI triggers and the commit-time selector (D-01)</name>
  <files>.github/workflows/ci.yml, scripts/check-changed.mjs</files>
  <precondition>HEAD is fe83cae0 or a descendant whose diff from it touches none of this plan's eight files; `git status --short` lists only `.planning/` paths; `git worktree list` shows no `tmp/rpt-wt`; no `check-changed-full.lock` exists in `$(git rev-parse --git-common-dir)`.</precondition>
  <read_first>
    - .github/workflows/ci.yml lines 1-48 and line 117
    - scripts/check-changed.mjs lines 205-260 and 510-565
    - This plan's CI-1, CC-1 to CC-4, and SCN sections
  </read_first>
  <action>
1. Set up the scratch area. Run `mkdir -p tmp/rpt` and write `git rev-parse HEAD` to `tmp/rpt/start.txt`. With the Write tool, copy the SCN block verbatim to `tmp/rpt/scenarios.mjs` and the PSC block verbatim to `tmp/rpt/prettier-scope.mjs`. `tmp/` is gitignored, so neither file reaches a commit or the changed-file selector.

2. Per D-01, in `.github/workflows/ci.yml` replace the CI-1 OLD block (the push and pull_request triggers, today's lines 10-39) with the CI-1 NEW block. Change nothing else in the file. Keep the `uses: $/.github/workflows/sonarcloud.yml` line (it is valid; fact 9) and the unfiltered `workflow_call` and `workflow_dispatch` triggers. Both lists must stay identical, entry for entry, with the negations after `docs/**`.

3. Per D-01, in `scripts/check-changed.mjs` apply CC-1, CC-2, CC-3, and CC-4, in that order, each by exact OLD/NEW replacement. CC-5 waits for Task 2. Keep the file's style: comments say why, cite no GSD artifacts, and describe the code as it stands (`skills/typescript-comments/SKILL.md`).

4. Feedback: run `node --check scripts/check-changed.mjs`, then `node scripts/check-changed.mjs --list` once. Expect scope `broad` and reason `Broad check required by .github/workflows/ci.yml, scripts/check-changed.mjs`. Any `.planning/` path in `files` selects nothing.

5. Hooks: run `pre-commit run --verbose --files .github/workflows/ci.yml scripts/check-changed.mjs > tmp/rpt/precommit-task1.log 2>&1; echo "PRECOMMIT_EXIT=$?" >> tmp/rpt/precommit-task1.log` in the foreground with a 600000 ms timeout. Never pipe or poll it. Confirm the last line is `PRECOMMIT_EXIT=0`, and read only the tail of the log on failure. If a hook rewrote a file, inspect the diff and run the hook again. Record the last line of `$(git rev-parse --git-common-dir)/check-changed.log` (scope, reason, durationMs, exitStatus, lockWaitMs).

6. Run `npx fallow audit --format json --quiet --explain --gate-marker agent`. The verdict must not be `fail`.

7. Commit. Stage by name: `git add .github/workflows/ci.yml scripts/check-changed.mjs`. Write `tmp/rpt/msg-task1.txt` with the title `perf(checks): run checks only when a build input changes` and a body of at most 80 characters per line. The body says that CI and the commit-time selector now run only when a file an npm build or CI job reads changes, and names the main groups. It carries no milestone, phase, plan, D-NN, or RPT-NN reference, and it ends with the attribution trailer your session instructions give. Check it with `pre-commit run gitlint --hook-stage commit-msg --commit-msg-filename tmp/rpt/msg-task1.txt`, then `git commit -F tmp/rpt/msg-task1.txt`. Confirm `git status --short` lists only `.planning/` paths.

8. Run the `<verify>` command once, after the commit: the harness checks the committed tree in the disposable detached worktree `tmp/rpt-wt` and removes it afterwards (choice 10). Expect `all 24 scenarios match`. If anything fails, fix the cause in a new commit (hooks first, never amend), then run `<verify>` again. If `git worktree add` reports that `tmp/rpt-wt` exists, run `git worktree remove --force tmp/rpt-wt` and `git worktree prune` first.
  </action>
  <verify>
    <automated>! grep -n 'paths-ignore' .github/workflows/ci.yml && ! grep -n 'isInstruction' scripts/check-changed.mjs && grep -qF '[(file) => !isBuildInput(file), "none"],' scripts/check-changed.mjs && grep -qF 'reason: "No build inputs changed"' scripts/check-changed.mjs && grep -qF 'uses: $/.github/workflows/sonarcloud.yml' .github/workflows/ci.yml && git worktree add --detach tmp/rpt-wt HEAD && node tmp/rpt/scenarios.mjs tmp/rpt-wt > tmp/rpt/scenarios-task1.log 2>&1; SCN=$?; git worktree remove --force tmp/rpt-wt; tail -1 tmp/rpt/scenarios-task1.log; test "$SCN" -eq 0</automated>
  </verify>
  <done>Both `ci.yml` triggers carry the same 24-entry allowlist, and nothing else in the file changed. check-changed selects nothing for non-build files and keeps its documentation, pair, test, fixture, type-member, and analyzer rules; every other build input broadens. On the committed tree the harness reports all 24 scenarios matching, with `ci.yml` and the selector agreeing on each, and every allowlist pattern matches a tracked file. One commit exists, its hook log ends `PRECOMMIT_EXIT=0`, the Fallow audit was not `fail`, and no `tmp/rpt-wt` worktree remains.</done>
</task>

<task type="auto">
  <name>Task 2: Prettier covers only build inputs: format scripts, pre-commit hook, and isFormatted (D-02)</name>
  <files>package.json, .pre-commit-config.yaml, scripts/check-changed.mjs</files>
  <precondition>Task 1's commit is HEAD, `git status --short` lists only `.planning/` paths, and `tmp/rpt/prettier-scope.mjs` exists.</precondition>
  <read_first>
    - package.json lines 78-86
    - .pre-commit-config.yaml lines 94-110
    - scripts/check-changed.mjs from `isDocumentation` through `isFormatted`, as Task 1 left them
    - This plan's PR-1, PR-2, CC-5, and PSC sections
  </read_first>
  <action>
1. Before any edit, record the old Prettier set: `node_modules/.bin/prettier --check "**/*.{js,json,ts}" "scripts/**/*.mjs" --log-level debug > tmp/rpt/prettier-old.log 2>&1`. Run it without `--cache`, so every checked file is logged; it takes about a minute. The log must end with `All matched files use Prettier code style!`.

2. Per D-02, apply PR-1 to `package.json`. Only the file arguments of `format` and `format:check` change, and the two scripts differ only in `--write` versus `--check`. Apply PR-2 to `.pre-commit-config.yaml`: the comment plus the new `files` regex on the prettier hook. Apply CC-5 to `scripts/check-changed.mjs`, so `isFormatted` derives from `isBuildInput` (choice 5). Leave `.prettierignore` unchanged (choice 7).

3. Record the new set: `node_modules/.bin/prettier --check "{extensions,rule-packs,tests}/**/*.{js,json,ts}" "scripts/**/*.{json,mjs}" "demos/**/*.ts" .fallowrc.json .prettierrc.json eslint.config.js package-lock.json package.json tsconfig.json --log-level debug > tmp/rpt/prettier-new.log 2>&1`. Then run `node tmp/rpt/prettier-scope.mjs`. At planning it printed `Prettier scope: 866 -> 733 files; dropped 133 under .pi, .planning, .sonarlint, .vscode, gsd-capabilities`. The counts move if `.planning/` gained JSON files since; the dropped groups must not.

4. Run `npm run format:check` once; it must exit 0.

5. Hooks: run `pre-commit run --verbose --files package.json .pre-commit-config.yaml scripts/check-changed.mjs > tmp/rpt/precommit-task2.log 2>&1; echo "PRECOMMIT_EXIT=$?" >> tmp/rpt/precommit-task2.log` in the foreground with a 600000 ms timeout. The changed-check hook takes the broad scope, triggered by `package.json` and the selector; `.pre-commit-config.yaml` alone selects nothing. Confirm `PRECOMMIT_EXIT=0` and record the last `check-changed.log` line.

6. Run the Fallow audit as in Task 1; the verdict must not be `fail`. Commit the three paths by name with `git commit -F tmp/rpt/msg-task2.txt`. The title is `perf(checks): limit Prettier to build inputs`, the body rules and the gitlint check are as in Task 1, and the body says that planning data and editor settings no longer reach Prettier. Confirm `git status --short` lists only `.planning/` paths.

7. Run the `<verify>` command once, after the commit, as in Task 1.
  </action>
  <verify>
    <automated>node tmp/rpt/prettier-scope.mjs && grep -qF 'return isBuildInput(file) && (' scripts/check-changed.mjs && npm run format:check && git worktree add --detach tmp/rpt-wt HEAD && node tmp/rpt/scenarios.mjs tmp/rpt-wt > tmp/rpt/scenarios-task2.log 2>&1; SCN=$?; git worktree remove --force tmp/rpt-wt; tail -1 tmp/rpt/scenarios-task2.log; test "$SCN" -eq 0</automated>
  </verify>
  <done>`format`, `format:check`, and the pre-commit Prettier hook cover the old Prettier set minus the non-build files, as `prettier-scope.mjs` proves, and add nothing. `npm run format:check` passes. `isFormatted` derives from `isBuildInput`. The harness still reports 24 of 24 on the committed tree. One commit exists, its hook log ends `PRECOMMIT_EXIT=0`, and the Fallow audit was not `fail`.</done>
</task>

<task type="auto">
  <name>Task 3: Docs describe the allowlist; codebase-map follow-ups listed (C-01, D-01, D-02)</name>
  <files>CHANGELOG.md, CONTRIBUTING.md, skills/local-verification/SKILL.md, docs/unused-type-member-gate.md</files>
  <precondition>Task 2's commit is HEAD and `git status --short` lists only `.planning/` paths.</precondition>
  <read_first>
    - .claude/rules/changelog.md
    - CHANGELOG.md lines 1-8
    - CONTRIBUTING.md line 60
    - skills/local-verification/SKILL.md lines 1-20
    - docs/unused-type-member-gate.md lines 15-19
    - This plan's DOC-1 to DOC-4 sections
  </read_first>
  <action>
1. As `.claude/rules/changelog.md` requires for any CHANGELOG.md edit, load the `simple-english` skill in Plain mode and the `humanizer` skill.

2. Per C-01, apply DOC-1 to CONTRIBUTING.md, DOC-2 to `skills/local-verification/SKILL.md`, DOC-3 to `docs/unused-type-member-gate.md`, and DOC-4 to CHANGELOG.md. Use the Edit tool with each OLD string; every one was unique at fe83cae0. If an OLD string no longer matches because someone changed the line since, apply the same meaning to the current sentence and record it as a deviation. Keep each one-line paragraph on one line; mdformat runs with `wrap = "no"`.

3. Leave line 19 of `docs/unused-type-member-gate.md` unchanged and record why it still holds. The gate script and helpers with a `tests/scripts` test run `test:analyzers`. Other helpers and dependency or toolchain configuration select the broad check. Contract data runs `lint:type-members` when the selection stays focused, and the broad check never runs the gate.

4. Run the changelog rule's self-checks on the DOC-4 line. Change its wording only if a check fails. It must stay the only #236 bullet: one sentence of at most 25 words that keeps "build input" and ends with `(#236)`.

5. Leave `.planning/codebase/*.md` untouched (RPT-05). The SUMMARY lists their stale lines (see Out of scope).

6. Hooks: run `pre-commit run --verbose --files CHANGELOG.md CONTRIBUTING.md skills/local-verification/SKILL.md docs/unused-type-member-gate.md > tmp/rpt/precommit-task3.log 2>&1; echo "PRECOMMIT_EXIT=$?" >> tmp/rpt/precommit-task3.log` in the foreground with a 600000 ms timeout. Expect a focused selection that runs `test:architecture`, because the gate doc is documentation and the other three files select nothing. If mdformat rewrites a file, inspect it, restage, and run the hook again. Confirm `PRECOMMIT_EXIT=0` and record the last `check-changed.log` line.

7. Run the `<verify>` command. Run the Fallow audit. Commit the four paths by name with `git commit -F tmp/rpt/msg-task3.txt`. The title is `docs: describe the build-input allowlist`, and the body rules and gitlint check are as in Task 1.

8. Wrap up. Run the SCN harness once more on the final HEAD with the worktree sequence from Task 1's `<verify>`, writing to `tmp/rpt/scenarios-final.log`, and record its last line. Confirm that `git worktree list` shows no `tmp/rpt-wt`, `git status --short` lists only `.planning/` paths, and no `check-changed-full.lock` exists in the git common directory. Delete `tmp/rpt/` after the SUMMARY records what it needs.
  </action>
  <verify>
    <automated>! grep -n 'whole-repository Prettier' CONTRIBUTING.md && ! grep -n 'unknown inputs select' CONTRIBUTING.md && ! grep -n 'unrecognized or uncertain inputs' skills/local-verification/SKILL.md && ! grep -n 'and CHANGELOG.md run' skills/local-verification/SKILL.md && ! grep -n 'which includes every pull request' docs/unused-type-member-gate.md && grep -qF 'A file that no build reads selects none.' CONTRIBUTING.md && grep -qF 'A file that is not a build input needs the document hooks only' skills/local-verification/SKILL.md && grep -qF 'on every pull request that changes a build input' docs/unused-type-member-gate.md && grep -q '^name: local-verification$' skills/local-verification/SKILL.md && grep -qE '^- Internal: .*build input.*\(#236\)$' CHANGELOG.md && awk '/\(#236\)$/ { bullets += 1; words = NF - 2 } END { exit !(bullets == 1 && words > 0 && words <= 25) }' CHANGELOG.md && git diff --quiet "$(cat tmp/rpt/start.txt)" -- .planning/codebase && node --test --test-reporter=./scripts/test-reporter.mjs tests/architecture/no-stale-test-citations.test.ts</automated>
  </verify>
  <done>CONTRIBUTING.md, the local-verification skill, line 17 of the gate doc, and the #236 changelog entry describe the allowlist, either as DOC-1 to DOC-4 give it or with recorded deviations. Line 19 of the gate doc is unchanged. `.planning/codebase/` has not changed since the start commit. The stale-citation test passes. One commit exists, and its hook log ends `PRECOMMIT_EXIT=0`. The final harness run reports 24 of 24, and no scratch worktree or lock remains.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
| --- | --- |
| changed file set -> CI trigger | GitHub evaluates the `ci.yml` `paths` filters against a push or pull request diff. No run means no `npm run check`, e2e tests, direct coverage, SonarCloud scan, or package check for that change. |
| changed file set -> commit-time selection | `check-changed` decides which local checks run. A `none` selection leaves only the document hooks. |

## STRIDE Threat Register

ASVS level 1; blocking threshold `high`. No threat below is high.

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
| --- | --- | --- | --- | --- | --- |
| T-rpt-01 | Tampering | CI-1 allowlist and `isBuildInput` | medium | mitigate | A build input missing from the allowlist would let its change land unverified. Planning derived the list from what each npm script and CI job reads (facts 3-5), added `demos/**/*.ts` and `.gitattributes` beyond the coordinator's list, and simulated the filter over every tracked file. Backstops stay unfiltered: `publish.yml`'s `workflow_call` on `v*` tags, `workflow_dispatch`, `lint.yml` on every pull request, and the full `npm run check` required at PR handoff. |
| T-rpt-02 | Tampering | the two copies of the list (`ci.yml`, `check-changed.mjs`) | low | accept | They can drift. Each file's comment names the other, and the SCN harness cross-checks both on 24 scenarios during this task. No committed test guards the pair; this branch removed tooling self-tests on purpose. |
| T-rpt-03 | Repudiation | a pull request whose CI run was skipped | low | accept | A skipped run shows no CI checks. The `main` ruleset has only deletion and non-fast-forward rules, so a skip neither blocks a merge nor reports a pass. `lint.yml` still runs. |
| T-rpt-04 | Tampering | GitHub path-filter limits | low | accept | A diff over 3,000 files can skip a run (fact 6). Such pull requests are rare, and PR handoff still requires `npm run check`. |
| T-rpt-05 | Tampering | narrowed Prettier scope | low | mitigate | `prettier-scope.mjs` proves that the new set equals the old set filtered by the hook regex, adds nothing, and drops only `.planning/`, `.vscode/`, `.sonarlint/`, `.pi/`, and `gsd-capabilities/` files. |
| T-rpt-06 | Tampering | scratch harness edits to tracked files | low | mitigate | It runs only in a disposable detached worktree under the gitignored `tmp/`. It restores each change in a `finally` block, fails if `git status` differs afterwards, and the worktree is removed after every run. |
| T-rpt-SC | Tampering | npm/pip/cargo installs | low | accept | This plan installs no package. |
</threat_model>

<verification>
- Tasks 1 and 2 ran `<verify>` after their commits (the harness needs the committed tree); Task 3 ran it before its commit. All exited 0.
- `tmp/rpt/precommit-task1.log`, `tmp/rpt/precommit-task2.log`, and `tmp/rpt/precommit-task3.log` each end with `PRECOMMIT_EXIT=0`, and the Fallow audit before each commit was not `fail`.
- `tmp/rpt/scenarios-task1.log`, `tmp/rpt/scenarios-task2.log`, and `tmp/rpt/scenarios-final.log` each end with `all 24 scenarios match`.
- `git log --oneline -3` shows the three Conventional Commit titles. `git diff --name-only "$(cat tmp/rpt/start.txt)" HEAD -- . ':(exclude).planning'` lists exactly the eight `files_modified` paths. `git status --short` lists only `.planning/` paths, `git worktree list` shows no `tmp/rpt-wt`, and no `check-changed-full.lock` remains.
- Per `skills/local-verification/SKILL.md`, this is focused task verification. Do not run `npm run check`; the full check runs at the PR handoff.
</verification>

<success_criteria>
- A push or pull request that changes no build input starts no CI run. One that changes a build input runs the same jobs as before. Releases (`workflow_call`) and manual runs stay unfiltered.
- A commit that changes only non-build files runs no npm check: no broad check for planning files, instruction Markdown, the changelog, or stray untracked files.
- Documentation edits still run `test:architecture`. Every other build input still reaches its focused check or the broad check.
- Prettier, both in npm scripts and in the hook, checks only build inputs, and the old set loses nothing else.
- CONTRIBUTING.md, the local-verification skill, the gate doc, and the changelog describe the new behavior. The SUMMARY lists the out-of-scope follow-ups.
</success_criteria>

## Source audit

| SOURCE  | ID      | Item | Task | Status |
| ------- | ------- | ---- | ---- | ------ |
| GOAL    | -       | Replace denylist build triggering with an allowlist of true build inputs, in CI and in local commit-time checks | 1, 2 | COVERED |
| REQ     | RPT-01  | `ci.yml` `paths` allowlist on push and pull_request; denylist comment rewritten | 1 | COVERED |
| REQ     | RPT-02  | Selector: non-build files select none; build-input fallback to broad; removal broadens only build inputs; documentation narrowed; old fallback comments updated | 1 | COVERED |
| REQ     | RPT-03  | Prettier scope in `format`, `format:check`, the pre-commit hook, and `isFormatted` | 2 | COVERED |
| REQ     | RPT-04  | CHANGELOG #236 entry, CONTRIBUTING.md, local-verification skill, gate doc line 17; line 19 verified | 3 | COVERED |
| REQ     | RPT-05  | `.planning/codebase/*.md` untouched; follow-ups in the SUMMARY | 3 | COVERED |
| CONTEXT | D-01    | Allowlist for every npm build, CI and local, naming only what the build reads; `docs/output-catalog.md` stays in | 1 | COVERED |
| CONTEXT | D-02    | Narrow Prettier (`format`, `format:check`, the pre-commit hook) to allowlisted paths | 2 | COVERED |
| CONTEXT | C-01    | Rewrite the CONTRIBUTING.md and SKILL.md selector sentences; verify gate doc line 19; name the selector's consumers | 3 (consumers: fact 2) | COVERED |
| RESEARCH | -      | No research phase for this quick task | - | N/A |

<output>
Create `.planning/quick/261004-rpt-allowlist-build-inputs-for-ci-and-local-/261004-rpt-SUMMARY.md` with `status: complete` in its frontmatter. Record:

- the three commits;
- for each pre-commit run: the command, its exit status, the commit, the Node version, the selected scope and commands, and the `durationMs`, `exitStatus`, and `lockWaitMs` of its `check-changed.log` record;
- the last lines of `tmp/rpt/scenarios-task1.log`, `tmp/rpt/scenarios-task2.log`, and `tmp/rpt/scenarios-final.log`, and the `prettier-scope.mjs` output line;
- the Fallow audit verdict before each commit;
- the judgment calls under "Choices made within the decisions", especially choice 1 (`demos/**/*.ts` is a build input, against the coordinator's finding) and choice 2 (`.gitattributes`), and any deviation, including a reworded DOC string;
- why line 19 of `docs/unused-type-member-gate.md` still holds;
- every item under "Out of scope" as a follow-up, with file and line.

State the verification scope: "focused task verification passed; full phase/PR verification pending" (`skills/local-verification/SKILL.md`). Name the decisions this implements, so STATE.md can record that CI and the commit-time selector trigger from one allowlist of build inputs and that Prettier covers only those inputs.

Include the section AGENTS.md requires:

```markdown
## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.
```

Replace "None" with specifics if execution finds otherwise.
</output>
