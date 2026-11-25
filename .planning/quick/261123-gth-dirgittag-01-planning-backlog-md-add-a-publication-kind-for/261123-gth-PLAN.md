---
quick_id: 261123-gth
description: "DIRGITTAG-01: a git-folder publication kind for a dir marketplace in a git work tree, and a scenario that installs a constrained relative-path dependency from its release tag"
date: 2026-11-23
mode: quick-batch
phase: quick-261123-gth
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - features/lib/git-marketplace.ts
  - features/lib/published-marketplace.ts
  - features/support/source-kind.ts
  - features/step_definitions/marketplace/publishing.steps.ts
  - features/plugin/install-dependencies.feature
  - .agents/skills/cucumber/rules/features.md
autonomous: true
requirements: [TAGS-01, TAGS-03]

must_haves:
  truths:
    - "A scenario publishes a marketplace as a git-folder source with `the marketplace <name> is published as a git-folder source`: the dir fixture in a folder that is a git work tree with no origin, which `the marketplace <name> is added to the <scope> scope` adds by its path as a dir source. Every later change to it is a new local commit, and nothing is pushed."
    - "`the marketplace <name> tags its current commit <tag>` tags a git-folder marketplace in its folder and records the tag token through tagPublishedCommit, and still pushes and confirms the tag of a url or github marketplace, so S1 and S2 of install-dependencies.feature pass unchanged."
    - "Every switch over the source kind in features/lib/published-marketplace.ts lists git-folder with a work-tree behavior: a commit on every change, folder removal for a removed source, no branch, and refusals for unreadable files and read-only directories."
    - "The new scenario after S2 in features/plugin/install-dependencies.feature installs app 1.1.0 from the folder and formatter as 1.0.0-{tools revision formatter--v1.0.0} from the formatter--v1.0.0 tag, staged from plugin-clones/d1e3927ef215-{tools revision formatter--v1.0.0}, and the git host receives no request (TAGS-01, TAGS-03, NFR-5)."
    - "With B-D1 or B-D2 applied to extensions/, the new scenario fails in a Then step, each break run ends restored=clean, and check-red.mjs prints RED-PROOFS OK."
    - "On the unbroken tree, install-dependencies.feature passes whole under the adapter profile (62 scenarios) and the builtin profile (1 scenario), the git-publishing neighbor features pass, and npm run check:static passes from an empty ESLint cache."
    - "No file under extensions/ changes, and .agents/skills/cucumber/rules/features.md documents the git-folder kind and names it in the marketplace tag token rule."
  artifacts:
    - path: features/lib/published-marketplace.ts
      provides: "the git-folder kind (LocalGitPublication), its case in every source-kind switch, and the tag dispatch tagPublishedCommit"
      contains: "export async function tagPublishedCommit"
    - path: features/lib/git-marketplace.ts
      provides: "initGitWorkTree, commitGitWorkTree, and tagGitCommit, which the url and github publishers reuse"
      contains: "export async function commitGitWorkTree"
    - path: features/support/source-kind.ts
      provides: "the source kind parameter type, which matches git-folder"
      contains: "git-folder"
    - path: features/step_definitions/marketplace/publishing.steps.ts
      provides: "the tag step through the library dispatch"
      contains: "tagPublishedCommit"
    - path: features/plugin/install-dependencies.feature
      provides: "the git-folder tag scenario after S2"
      contains: "is published as a git-folder source"
    - path: .agents/skills/cucumber/rules/features.md
      provides: "the git-folder source-kind paragraph and the widened marketplace tag token rule"
      contains: "git-folder"
  key_links:
    - from: features/step_definitions/marketplace/publishing.steps.ts
      to: features/lib/published-marketplace.ts
      via: "the step `the marketplace {string} tags its current commit {string}` calls tagPublishedCommit, which dispatches on the recorded source kind"
      pattern: "tagPublishedCommit\\("
    - from: features/lib/published-marketplace.ts
      to: features/lib/git-marketplace.ts
      via: "the git-folder arms call initGitWorkTree (publish), commitGitWorkTree (changePublication), and tagGitCommit (tagPublishedCommit), and never push"
      pattern: "commitGitWorkTree\\("
    - from: features/support/source-kind.ts
      to: features/lib/published-marketplace.ts
      via: "the parameter regexp and SOURCE_KINDS name the same six kinds; parseSourceKind is the transformer"
      pattern: "git-folder"
    - from: features/plugin/install-dependencies.feature
      to: extensions/pi-claude-marketplace/orchestrators/plugin/clone-cache.ts
      via: "the expected clone key half d1e3927ef215 is sha256('marketplace-name:tools')[0:12], the no-origin fallback of materializeMarketplaceTagClone (the B-D2 site, lines 972-974)"
      pattern: "d1e3927ef215"
    - from: features/plugin/install-dependencies.feature
      to: extensions/pi-claude-marketplace/orchestrators/plugin/install-cascade.ts
      via: "resolveMemberTagSource's path arm hands the dir record's marketplaceRoot to the local tag probe (the B-D1 site, lines 843-845)"
      pattern: "is published as a git-folder source"
---

<objective>
BACKLOG DIRGITTAG-01 (`.planning/BACKLOG.md` line 5514; read it, never edit it). Claude Code also resolves a relative-path dependency's version constraint against the `<plugin>--v<version>` tags of a marketplace that the user added as a local folder, when that folder is a git repository. The harness has no publication kind for that form, so every tag scenario in `features/plugin/install-dependencies.feature` uses a github marketplace. After this plan:

(a) The harness publishes a marketplace as a new source kind, `git-folder`: the dir fixture in a folder that is a git work tree with no `origin`. The user adds it by its path (a dir source). Every later change is a new local commit, and the existing tag step tags the folder's own commit without a push.

(b) One new scenario, right after S2 (which ends at line 746), installs `formatter@^1.0.0` from the `formatter--v1.0.0` tag of such a marketplace. It states the tag-resolved version, the tag clone keyed `marketplace-name:tools` (`d1e3927ef215`, `orchestrators/plugin/clone-cache.ts:972-974`), the app staged from the folder at HEAD, and no request to the git host.

(c) Two deliberate product breaks (B-D1, B-D2) each fail the new scenario in a Then step and are reverted with `extensions/` clean.

No product file changes: the product already reads a dir record's own tags (research section 1). Upstream parity: Claude Code 2.1.330 resolves a relative-path member of a directory marketplace as a git-subdir at the folder's file URL and reads its tags with or without an origin; the user sees the same result here. The clone key and `pluginRoot` are Pi-internal, so no divergence is pinned and no decision ID is needed.

Purpose: the last uncovered form of TAGS-01/TAGS-03 gets a scenario that fails when the behavior breaks.
Output: Task 1 (tracer) ships the kind, the tag dispatch, and the scenario. Task 2 proves the scenario red under B-D1 and B-D2. Task 3 documents the kind in the cucumber rules and runs the regression set and the static gate.
</objective>

<execution_context>
@/home/user/pi-claude-marketplace/.claude/gsd-core/workflows/execute-plan.md
@/home/user/pi-claude-marketplace/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@AGENTS.md
@.planning/quick/261123-gth-dirgittag-01-planning-backlog-md-add-a-publication-kind-for/261123-gth-RESEARCH.md
@features/lib/published-marketplace.ts
@features/lib/git-marketplace.ts
@features/step_definitions/marketplace/publishing.steps.ts
@features/support/source-kind.ts

Records (read, do not edit): `.planning/BACKLOG.md` DIRGITTAG-01 (line 5514); TAGS-01 and TAGS-03 in `.planning/milestones/v1.20-REQUIREMENTS.md` (lines 158-167).

Project skills that bind this plan: `.agents/skills/cucumber/SKILL.md` with `rules/features.md` (Steps, Data tables, Source kinds, Run tokens), `rules/steps.md`, `rules/world-and-stand-ins.md` (line 37: the library dispatches on the recorded source kind, and a new kind changes library code only), and `rules/layout.md`; `.agents/skills/typescript-style/SKILL.md` with `rules/comments.md` (cite TAGS-01 and TAGS-03; never a quick id, phase, or plan; no narration of removed code; load the `simple-english` skill in Plain mode and the `humanizer` skill for every comment and for the features.md paragraph); `.agents/skills/committing/SKILL.md`; `.agents/skills/local-verification/SKILL.md` with `rules/commands.md` and `rules/gates.md`.

Cross-item note: no sibling item needs this one first, and this one needs none. Sibling 261123-gti adds a hooks scenario and may also edit cucumber skill docs; the batch's file-overlap partition sequences shared files. Merge, never rebase.

Environment (the container runs as uid 0): prefix every npm command, and every `git commit` (its hook runs npm), with
`PATH="$X/bin:$PATH" npm_config_script_shell=/tmp/claude-0/-home-user-pi-claude-marketplace/36571f01-5770-4f51-bd77-b22d58691339/scratchpad/nondac-sh NODE_OPTIONS=--max-old-space-size=6144`.
`$X` is this executor's own scratchpad directory. Executor setup below records it in the worktree's git dir, so every `<automated>` command reads it back with `X=$(cat "$(git rev-parse --git-path dirgittag-scratch)")`. `$X/bin/fd` is a link to `/usr/bin/fdfind`, because Pi in the cucumber runs needs `fd` on PATH. Node is v24.22.3 and git is 2.43.0; `flock` is present.

Executor rules for this run:
- Run every command from the executor's checkout root. Read each file before you edit it, and trace the callers of each function you change (`npx --no codegraph explore "<symbol>"` works here). The callers are listed under Interfaces.
- One commit per code or doc task; Task 2 commits nothing. Before each commit, run the committing skill's fixer pass, `SKIP=npm-check${SKIP:+,$SKIP} pre-commit run --files <changed files>`, and restage its edits. Then run `git commit` in the foreground with the longest tool timeout and the environment prefix above; leave `SKIP` as the session exports it (never add a hook to it for the commit), and never use `--no-verify`, `--amend`, `git add -A`, or a bare `git stash`. A failed hook means no commit: fix, restage, and commit again.
- If the hook output shows the `npm run check:commit` hook as Skipped inside a worktree, run `npm run check:static` and `npm run test:unpaired` by hand right after the commit, with the prefix, and record both; fix any failure in a new commit.
- Commit titles follow Conventional Commits, 5 to 72 characters, and name no quick id, batch id, or backlog id (keep the body free of them too). End each message with the attribution lines your session gives.
- Write every temporary file under `$X/dirgittag/`. Never run a file in another plan's folder: copy it first (Executor setup).
- Do not edit `.planning/BACKLOG.md`, `.planning/STATE.md`, `.planning/ROADMAP.md`, or `CHANGELOG.md`. Do not commit the PLAN or SUMMARY files; the orchestrator does.

<interfaces>
Current code at 85c323b (read the files for the bodies):

`features/lib/git-marketplace.ts` (84 lines): `publishGitRepository(workTree, bareRepository, home): Promise<void>` (lines 24-37: `init -q`, `add -A`, `commit -q --allow-empty -m publish`, mkdir of the parent, `clone -q --bare`, `remote add origin`, `push -q origin main:stable`); `pushGitRepository(workTree, home): Promise<void>` (47-51: `add -A`, the same commit, `push -q --atomic origin main main:stable`); `pushGitBranch(workTree, home, branch, write): Promise<void>` (60-72: `checkout -q -B <branch> main`, `write()`, `add -A`, the same commit, `push -q origin <branch>`, `checkout -q main`); `pushGitTag(workTree, home, tag): Promise<string>` (80-84: `tag <tag>`, `push -q origin refs/tags/<tag>`, returns `rev-parse HEAD`). Every git call goes through `runGit(cwd, home, ...args)` from `features/lib/hermetic-git.ts` (lines 35-42: execFile with an argv array, `-c init.defaultBranch=main -c commit.gpgsign=false`, and `hermeticGitEnvironment(home)`).
Callers that keep their behavior: `features/lib/git-plugin.ts` (`publishGitRepository` 169, `pushGitRepository` 192 and 256, `pushGitTag` 217 inside `pushTagOnlyRevision`, which relies on the returned commit being the tagged HEAD), `features/lib/mcp-verdict-git.ts` (`pushGitRepository` 45), `features/step_definitions/plugin/git-source.steps.ts` (`pushGitRepository` 42), `features/lib/published-marketplace.ts` (line 30 imports `publishGitRepository`, `pushGitBranch`, `pushGitRepository`), `features/step_definitions/marketplace/publishing.steps.ts` (line 28 imports `pushGitTag`).

`features/lib/published-marketplace.ts` (898 lines): `SourceKind` (44) and `SOURCE_KINDS` (46); `PathPublication` (96-101, kind dir|file; `features/lib/earlier-version-state.ts:63` types its writer input as this interface, so it stays dir|file); `GitPublication` (109-118, url|github, with `owner`, `repository`, `bareRepository`, `gitHome`); `HostedPublication` (126-135); `PublishedMarketplace` union (138); `parseSourceKind` (147-154). Switches over the kind, all without a default: `changePublication` (162-181, returns nothing), `requireFreeRoot` (198-216, returns the root), `publishMarketplaceIn` (239-279, returns the publication), `removePublishedSource` (425-442, returns nothing), `unreadableSkillFile` (584-598, returns a path), `readOnlySkillDirectory` (663-677, returns a path), `describeMarketplaceBranch` (881-898, returns nothing). If-guards: `makeManifestUnreadable` (483-493) and `publishUnreadableCommandFile` (518-533) refuse url and github; `publishConventionalDecoy` (445-462) refuses every kind but file, so it refuses git-folder already. TypeScript (`noImplicitReturns`) catches a missing case only in the switches that return a value; ESLint's `@typescript-eslint/switch-exhaustiveness-check` (`eslint.config.js` lines 332-343, all `**/*.{js,ts}`, no default allowed) catches it in every switch, the three that return nothing included.

`features/step_definitions/marketplace/publishing.steps.ts`: fileoverview (1-15, names url or github for the tag step); `runGit` import (34, also used by the own-repository step at 188); the publish step (72-83); `the marketplace {string} is added to the {word} scope` (259-269, runs `marketplace add <published.source>`); the tag step (334-351: refuses all but url/github, calls `pushGitTag`, checks `rev-parse <tag>^{commit}` in `bareRepository`, then `this.recordMarketplaceTag`).

`features/support/source-kind.ts`: fileoverview line 5 ("Only the five kinds match"), `regexp: /dir|file|url|github|hosted/` (15). The alternation order is safe for `git-folder`: `github` fails at its fourth character and the engine moves on.

`features/support/world.ts` `recordMarketplaceTag(marketplace, tag, commit)` (446-458) refuses a second tag on a commit that already carries one, so the scenario republishes between tags.

Guards that stay as they are (each refuses any kind it does not name): `features/step_definitions/git-host.steps.ts` 64-72, `marketplace/add.steps.ts` 37, `marketplace/publishing.steps.ts` 182 and 275, `marketplace/checkout.steps.ts` 84, `mcp-server/invalid-configs.steps.ts` 50, `plugin/publishing.steps.ts` 369, `features/lib/mcp-server-files.ts` 208 and 265, `features/lib/hook-files.ts` 577. The new scenario uses none of them.

`scripts/check-features.mjs`: `localKinds = {dir, file}` (44) and the source tags `@url`/`@github` (35, 391-400), so any `git-folder` row in an `Examples:` block is a finding. The new scenario is not an Outline.

Product facts (read only; the break sites): `orchestrators/plugin/install-cascade.ts` 838-845 (a path entry's tag source is `{ kind: "path", marketplaceRoot: record.marketplaceRoot }`, whatever the marketplace kind) and 925-948 (the path probe; `no-matching-tag` and `tag-listing-failed` both fall back to the current copy); `orchestrators/plugin/marketplace-tag-probe.ts` 119-124 (a listing that throws is `tag-listing-failed`); `orchestrators/plugin/clone-cache.ts` 607-673 (`deriveMarketplaceUrl` reads `.git/config`'s `[remote "origin"] url` for a path source and returns undefined without one) and 972-975 (the key falls back to `marketplace-name:${args.marketplaceName}`); `domain/clone-key.ts` 39-42 (`pluginCloneKey`: 12 hex of sha256 of the URL, a hyphen, 12 hex of the commit).
</interfaces>

## Planner measurements (at 85c323b; the executor need not repeat them)

- `node -e` with `node:crypto`: sha256 of `marketplace-name:tools`, first 12 hex, is `d1e3927ef215`.
- A folder made with system git 2.43 under the harness's hermetic environment (init, commit, `tag formatter--v1.0.0`, commit past it, no remote): `platform/git.ts` `listTags` returns `["formatter--v1.0.0"]`, `resolveTagOid` returns the tagged commit, and the `.git` copy with its index dropped checks out the tag's files (assumption A2 holds). `.git/config` holds no `[remote "origin"]`, so the key falls back to the marketplace name. `listTags` on the missing folder `<root>/.no-tags` returns `[]`, so B-D1 falls back to the current copy (assumption A1 holds).
- BD1, BD1b, and BD2 below: each old text occurs exactly once in its file, and each broken file still parses after type stripping (`node --check` on `stripTypeScriptTypes` output).
- `parsePluginSource` reads a stored `{ kind: "path", raw }` record source as kind `path` (`domain/source.ts` 299-306; `persistence/state-io.ts` 563-565 keeps a path record's source in that shape), so B-D1's condition holds for a dir record and not for the github records of S1 and S2.
- Phase 7 ran the whole `install-dependencies.feature` in 22 seconds (61 scenarios, adapter) and the builtin profile selected 1 scenario (`scratchpad/fix-07b/final-deps-*.log`). Each whole-file run here takes well under a minute.

## Design (decided by the planner; the SUMMARY reports each)

1. The kind is named `git-folder` (research recommendation): a dir source whose folder is a git work tree, as upstream's docs say "a local folder path ... when the folder is a git repository". The step reads `the marketplace "tools" is published as a git-folder source`.
2. The publication type is a new `LocalGitPublication`, not a widening of `PathPublication`, which `earlier-version-state.ts` reads as dir|file only.
3. The tag step's dispatch moves into the library as `tagPublishedCommit`, by `world-and-stand-ins.md` line 37.
4. `git-marketplace.ts` gains `initGitWorkTree`, `commitGitWorkTree`, and `tagGitCommit`, and the four existing publishers reuse them, so the add-and-commit pair exists once. `git-plugin.ts` keeps its own tag-only commit (message `publish <tag>`): it is a different commit, outside this item.
5. The scenario follows research section 3 with one change: the second publish offers app 1.1.0 (the tag holds app 1.0.0), as S1's later publishes do. The staged app skill then shows the user's own folder still at HEAD after the tag install, which guards against a checkout of the tag in place in the user's folder.
6. The git-incompatible fixtures (an unreadable file, a read-only directory, a branch) refuse a git-folder publication, and removing its source removes the folder, as for dir.
7. The scenario sits after S2 in `install-dependencies.feature`, beside the github tag scenarios, because the item names this file and the tag scenarios stay together. It is not an Outline: `check-features.mjs` admits only dir and file in an untagged `Examples:` block.
8. The break runs cover the whole feature file, so their logs also show which other scenarios each break fails. The research expects none.

## Executor setup (once, before Task 1, from the checkout root)

```bash
X=<this executor's own scratchpad directory>
T=/tmp/claude-0/-home-user-pi-claude-marketplace/36571f01-5770-4f51-bd77-b22d58691339/scratchpad
mkdir -p "$X/dirgittag" "$X/bin"
printf '%s\n' "$X" > "$(git rev-parse --git-path dirgittag-scratch)"
cp "$T/fix-07b/break.sh" "$T/fix-07b/check-red.mjs" "$X/dirgittag/"
cp "$T/nondac-sh" "$X/nondac-sh"
chmod +x "$X/dirgittag/break.sh" "$X/nondac-sh"
ln -sf /usr/bin/fdfind "$X/bin/fd"
sha256sum "$X/dirgittag/break.sh" "$X/dirgittag/check-red.mjs" "$X/nondac-sh"
git rev-parse HEAD > "$X/dirgittag/base.sha"
test -e node_modules/.package-lock.json || npm ci --ignore-scripts --no-audit --no-fund
mkdir -p node_modules/.cache
MAIN=$(git worktree list --porcelain) && MAIN=${MAIN%%$'\n'*} && MAIN=${MAIN#worktree } && echo "main checkout: $MAIN"
test -d node_modules/.cache/optional-peers || cp -a "$MAIN/node_modules/.cache/optional-peers" node_modules/.cache/
```

The three hashes must be `8302926cc0a62259fa976c2a7d50e23c285100470746c92483f3815808428fdd` (break.sh), `6ff8829511800884cbcbf4cca6df377ef476783b70d6ea808e57b9371e42c9f3` (check-red.mjs), and `4418e2ba9569443cfa0e8dd338cf421dbba620b96b0c111c3a1d606046179182` (nondac-sh); stop and report if one differs. `break.sh` takes its wrapper from `$X/nondac-sh` and its lock from `$X/phase07-heavy.lock`, because `$X` is the parent of its folder. `base.sha` is the commit before this plan's first edit, which `check-red.mjs` diffs the feature file against. The optional peer cache is copied from the main checkout (the first entry of `git worktree list`), so `install-test-peers.mjs` finds the suite versions without the network; it installs them from the registry only if the copy is missing.

## Scenario shape (research section 3, with Design item 5)

The writer owns the step text, but every fact below must stay. All the steps exist today, and the tables are aligned exactly as in S1.

```gherkin
  Scenario: Installing a plugin installs its path-source dependency from a release tag of a marketplace added from a local git folder (TAGS-01, TAGS-03)
    Given the marketplace "tools" is published as a git-folder source
    Given the marketplace "tools" offers these plugins with dependencies:
      | name      | version | dependencies     |
      | app       | 1.0.0   | formatter@^1.0.0 |
      | formatter | 1.0.0   |                  |
    Given the marketplace "tools" tags its current commit "formatter--v1.0.0"
    Given the marketplace "tools" offers these plugins with dependencies:
      | name      | version | dependencies     |
      | app       | 1.1.0   | formatter@^1.0.0 |
      | formatter | 2.0.0   |                  |
    Given the marketplace "tools" is added to the project scope
    When the user runs "/claude:plugin install app@tools --scope project"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | true    |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id              | name            | status    | reasons | scope   | version                                  |
      | tools            | project           | app@tools       | app             | installed |         | project | 1.1.0                                    |
      | tools            | project           | formatter@tools | formatter@tools | installed |         | project | 1.0.0-{tools revision formatter--v1.0.0} |
    Then the installation record of the project scope holds these plugins:
      | id              | version                                  | enabled |
      | app@tools       | 1.1.0                                    | true    |
      | formatter@tools | 1.0.0-{tools revision formatter--v1.0.0} | true    |
    Then the staged skills directory of the project scope holds these files:
      | file                     | text |
      | app-skill/               |      |
      | app-skill/SKILL.md       | ---\nname: app-skill\ndescription: A skill of app 1.1.0.\npi-claude-marketplace: {"names":["app:app-skill","app-skill"],"pluginRoot":"{home}/marketplaces/tools/plugins/app","pluginData":"{project dir}/.pi/pi-claude-marketplace/data/tools/app"}\n---\n\nVersion 1.1.0.\n |
      | formatter-skill/         |      |
      | formatter-skill/SKILL.md | ---\nname: formatter-skill\ndescription: A skill of formatter 1.0.0.\npi-claude-marketplace: {"names":["formatter:formatter-skill","formatter-skill"],"pluginRoot":"{project dir}/.pi/pi-claude-marketplace/plugin-clones/d1e3927ef215-{tools revision formatter--v1.0.0}/plugins/formatter","pluginData":"{project dir}/.pi/pi-claude-marketplace/data/tools/formatter"}\n---\n\nVersion 1.0.0.\n |
    Then the git host receives no request
```

What each part guards: a probe that skips the folder's tags installs formatter 2.0.0 with `dependency current copy` (rows); a version taken from HEAD shows in the version cells; a tag clone keyed from anything but the marketplace name changes the `d1e3927ef215` half of the `pluginRoot`; a checkout of the tag in the user's folder stages app's skill at 1.0.0 or stages formatter from the folder; any network use shows in the last step (NFR-5). The scenario is untagged, so it runs under the adapter profile only (DUAL-02): it is not an MCP scenario.

## Red-proof inputs

Each break file is one JSON line, the `break.sh` form `[[file, old, new]]`, with `file` relative to `extensions/pi-claude-marketplace/`. Write each one with the exact bytes below.

`$X/dirgittag/BD1.json` (B-D1: the tag source of a dir-source marketplace points at a folder with no tags, so its members never read the folder's tags):

```json
[["orchestrators/plugin/install-cascade.ts","    return { kind: \"path\", marketplaceRoot: record.marketplaceRoot };","    return { kind: \"path\", marketplaceRoot: parsePluginSource(record.source).kind === \"path\" ? `${record.marketplaceRoot}/.no-tags` : record.marketplaceRoot };"]]
```

`$X/dirgittag/BD2.json` (B-D2: the key of a no-origin tag clone derives from the folder path instead of the marketplace name):

```json
[["orchestrators/plugin/clone-cache.ts","`marketplace-name:${args.marketplaceName}`","`marketplace-root:${args.marketplaceRoot}`"]]
```

`$X/dirgittag/BD1b.json`, the fallback of research assumption A1, used only if BD1 does not fail the new scenario or `break.sh` refuses it (a dir-source member then has no tag source, so the install fails, which the first Then shows; it also fails the file's other dir scenarios with a constrained dependency):

```json
[["orchestrators/plugin/install-cascade.ts","    return { kind: \"path\", marketplaceRoot: record.marketplaceRoot };","    return parsePluginSource(record.source).kind === \"path\" ? { kind: \"absent\" } : { kind: \"path\", marketplaceRoot: record.marketplaceRoot };"]]
```

`$X/dirgittag/red-tables.md` (the `scenarios` cell is the count of each run's count line, 62 with the new scenario; if BD1b replaces BD1, rename its rows):

```markdown
<!-- break-runs:begin -->
| break | profile | scenarios | files |
| --- | --- | --- | --- |
| BD1 | adapter | 62 | features/plugin/install-dependencies.feature |
| BD2 | adapter | 62 | features/plugin/install-dependencies.feature |
<!-- break-runs:end -->

<!-- must-fail:begin -->
| break | profile | file | title | row |
| --- | --- | --- | --- | --- |
| BD1 | adapter | features/plugin/install-dependencies.feature | Installing a plugin installs its path-source dependency from a release tag of a marketplace added from a local git folder (TAGS-01, TAGS-03) | |
| BD2 | adapter | features/plugin/install-dependencies.feature | Installing a plugin installs its path-source dependency from a release tag of a marketplace added from a local git folder (TAGS-01, TAGS-03) | |
<!-- must-fail:end -->

<!-- survivors:begin -->
| break | profile | file | title | reason |
| --- | --- | --- | --- | --- |
<!-- survivors:end -->
```

<tasks>

<task type="tracer">
  <name>Task 1: Publish a git-folder marketplace and install a dependency from its tag, end to end</name>
  <files>features/lib/git-marketplace.ts, features/lib/published-marketplace.ts, features/support/source-kind.ts, features/step_definitions/marketplace/publishing.steps.ts, features/plugin/install-dependencies.feature</files>
  <read_first>
    - 261123-gth-RESEARCH.md sections 1, 3, and 5 (pitfalls 1 to 4 and 6)
    - features/lib/published-marketplace.ts (whole file), features/lib/git-marketplace.ts, features/lib/hermetic-git.ts
    - features/support/source-kind.ts; features/step_definitions/marketplace/publishing.steps.ts lines 1-83 and 259-351; features/support/world.ts lines 441-470
    - features/lib/git-plugin.ts lines 150-260 (the callers of the git helpers that must keep their behavior)
    - features/plugin/install-dependencies.feature lines 1-37, 672-760, and 1460-1472 (a dir-source pluginRoot)
    - .agents/skills/cucumber/rules/features.md (Steps, Data tables, Source kinds, Run tokens), rules/steps.md, and .agents/skills/typescript-style/rules/comments.md
  </read_first>
  <action>
Follow research sections 1, 3, and 5, and the Interfaces block. Change nothing under `extensions/`.

(a) In `features/lib/git-marketplace.ts`, add three exported helpers, each with a doc comment, so the add-and-commit pair exists once (Design item 4):
- `initGitWorkTree(workTree: string, home: string): Promise<void>` runs `init -q` in `workTree`, then `commitGitWorkTree`.
- `commitGitWorkTree(workTree: string, home: string): Promise<void>` runs `add -A`, then `commit -q --allow-empty -m publish`, so every call makes a new commit even when no file changed.
- `tagGitCommit(workTree: string, home: string, tag: string): Promise<string>` runs `tag <tag>` (a lightweight tag, never forced, so an existing tag fails) and returns `rev-parse HEAD`.
Then rewrite the four publishers on top of them, with the same git arguments in the same order: `publishGitRepository` is `initGitWorkTree`, then the mkdir, `clone -q --bare`, `remote add origin`, and the `main:stable` push; `pushGitRepository` is `commitGitWorkTree`, then its atomic push; `pushGitBranch` is the branch checkout, `write()`, `commitGitWorkTree`, the branch push, and the checkout of `main`; `pushGitTag` is `tagGitCommit`, then the tag push, and it returns the commit that `tagGitCommit` returned (`pushTagOnlyRevision` in `git-plugin.ts` relies on it). Add one sentence to the fileoverview: the git-folder kind commits the same work tree with no `origin`, so a change is a new local commit and a release tag stays in the folder (TAGS-01).

(b) In `features/lib/published-marketplace.ts` (Design items 1, 2, 6):
- Add `"git-folder"` to `SourceKind` and to `SOURCE_KINDS`. Add an exported interface `LocalGitPublication` with readonly `kind: "git-folder"`, `root`, `source`, `manifestPath`, and `gitHome`, a doc comment (a local folder that is a git work tree with no remote; `root` is the folder the user adds by its path, which is also its `source`; `gitHome` is the HOME of the git that commits and tags it), and add it to the `PublishedMarketplace` union.
- Give every switch over the kind a `git-folder` case. `changePublication`: run `write()`, then `commitGitWorkTree(published.root, published.gitHome)`, and never push. This commit is load-bearing: without it, HEAD stays at the tag after the second publish, and the scenario can no longer tell the tag from HEAD (research pitfall 1). `requireFreeRoot`: as dir (only the work tree under the marketplaces root must be absent). `publishMarketplaceIn`: `writeMarketplace` as for dir, then `initGitWorkTree(root, sites.gitHost.gitHome)`, and return `{ kind, root, source: root, manifestPath, gitHome: sites.gitHost.gitHome }`; the user types the folder path, so `marketplace add` records a dir source whose `marketplaceRoot` is the folder. `removePublishedSource`: as dir (remove the folder through `ownedTarget`, its `.git` included). `unreadableSkillFile` and `readOnlySkillDirectory`: join the url and github arm, which throws (git cannot commit a file nobody may read or a directory mode). `describeMarketplaceBranch`: join the dir, file, and hosted arm, which throws (a folder added by its path has no branch to add).
- `makeManifestUnreadable` and `publishUnreadableCommandFile`: refuse git-folder with the git-repository message, as they refuse url and github.
- Add an exported `tagPublishedCommit(published: PublishedMarketplace, tag: string): Promise<string>` with one switch over the kind and no default. The url and github arm calls `pushGitTag(published.root, published.gitHome, tag)` and confirms the tag in `published.bareRepository`. The git-folder arm calls `tagGitCommit(published.root, published.gitHome, tag)` and confirms the tag in `published.root`. The dir, file, and hosted arm throws an Error that names the kind and says it has no commit to tag. Both confirmations go through one private helper that checks `rev-parse <tag>^{commit}` in the given repository, with `runGit` from `./hermetic-git.ts` and `assert.strictEqual`, against the commit, and returns the commit. That keeps the two arms from repeating it (fallow dupes).
- Update the fileoverview (one sentence for the git-folder kind) and the doc comments of `changePublication`, `requireFreeRoot`, `removePublishedSource`, and `describeMarketplaceBranch` for the new kind.

(c) In `features/support/source-kind.ts`, add `git-folder` to the parameter `regexp`, after `hosted`, and make the fileoverview say six kinds.

(d) In `features/step_definitions/marketplace/publishing.steps.ts`, the step `the marketplace {string} tags its current commit {string}` gets the commit from `tagPublishedCommit(this.requirePublished(name), tag)`, then calls `this.recordMarketplaceTag(name, tag, commit)`. Its own kind check and its rev-parse check move into the library (Design item 3). Remove the import of `../../lib/git-marketplace.ts`, which the step no longer uses, and keep `runGit` (the own-repository step at line 188 uses it). Update the fileoverview (tag the current commit of a url, github, or git-folder marketplace) and the TAGS-01 comment above the step.

(e) In `features/plugin/install-dependencies.feature`, insert the scenario of "Scenario shape" after S2 (which ends at line 746), with one blank line before and after it, so it comes before "Installing a second plugin that asks for a dependency's range leaves the dependency recorded at its release tag in place" (Design items 5 and 7). Keep every fact of that shape, keep its column alignment, and give it no tag. It adds no step text.

Comments describe the code as it stands and cite TAGS-01 and TAGS-03 (typescript-style rules/comments.md). Then run the verify command. Run the fixer pass on the five files, restage, and commit with the environment prefix, for example `test(plugin): install a dependency from a local git marketplace tag`. The body says why: the tag scenarios used a github marketplace only, and Claude Code also reads the tags of a local folder that is a git repository. The hook runs `npm run check:commit`, which covers typecheck, lint (the switch exhaustiveness rule), fallow, Prettier, and `check:features`.
  </action>
  <verify>
    <automated>X=$(cat "$(git rev-parse --git-path dirgittag-scratch)") && test -x "$X/bin/fd" && L=$(grep -n 'release tag of a marketplace added from a local' features/plugin/install-dependencies.feature | cut -d: -f1) && test -n "$L" && PATH="$X/bin:$PATH" npm_config_script_shell=/tmp/claude-0/-home-user-pi-claude-marketplace/36571f01-5770-4f51-bd77-b22d58691339/scratchpad/nondac-sh NODE_OPTIONS=--max-old-space-size=6144 npm run test:cucumber:profile -- --profile adapter "features/plugin/install-dependencies.feature:672:716:$L"</automated>
  </verify>
  <acceptance_criteria>
    - The verify run prints `3 scenarios (3 passed)`: S1 (line 672), S2 (line 716), and the new scenario.
    - `grep -vE '^\s*(\*|//|/\*)' features/lib/published-marketplace.ts | grep -c '"git-folder"'` prints at least 11 [HEAD=0 EXPECT>=11 @85c323b] (the type, the kind list, the interface, and a case in each of the eight switches).
    - `grep -cE 'export async function (initGitWorkTree|commitGitWorkTree|tagGitCommit)\(' features/lib/git-marketplace.ts` prints 3 [HEAD=0 EXPECT==3 @85c323b]
    - `grep -c '"commit", "-q", "--allow-empty"' features/lib/git-marketplace.ts` prints 1 [HEAD=3 EXPECT==1 @85c323b] (one commit builder, reused)
    - `grep -c 'commitGitWorkTree(published.root, published.gitHome)' features/lib/published-marketplace.ts` prints 1 [HEAD=0 EXPECT==1 @85c323b] (the changePublication arm commits)
    - `grep -cE 'export async function tagPublishedCommit\(' features/lib/published-marketplace.ts` prints 1 [HEAD=0 EXPECT==1 @85c323b]
    - `grep -cE 'export interface LocalGitPublication \{' features/lib/published-marketplace.ts` prints 1 [HEAD=0 EXPECT==1 @85c323b]
    - `grep -cE 'regexp: /.*git-folder' features/support/source-kind.ts` prints 1 [HEAD=0 EXPECT==1 @85c323b]
    - `grep -c 'tagPublishedCommit' features/step_definitions/marketplace/publishing.steps.ts` prints at least 2 [HEAD=0 EXPECT>=2 @85c323b]
    - `grep -cE '^\s*Scenario:' features/plugin/install-dependencies.feature` prints 62 [HEAD=61 EXPECT==62 @85c323b]
    - `grep -c 'is published as a git-folder source' features/plugin/install-dependencies.feature` prints 1 [HEAD=0 EXPECT==1 @85c323b]
    - `grep -c 'plugin-clones/d1e3927ef215-{tools revision formatter--v1.0.0}/plugins/formatter' features/plugin/install-dependencies.feature` prints 1 [HEAD=0 EXPECT==1 @85c323b]
    - `git diff --quiet "$(cat "$X/dirgittag/base.sha")" HEAD -- extensions/; echo $?` prints 0 [HEAD=0 EXPECT==0 @85c323b GUARD MUTATION: any committed edit under extensions/]
    - The commit hook passes (or the by-hand fallback of the executor rules ran and passed); its result is in the SUMMARY.
  </acceptance_criteria>
  <done>A scenario can publish a git-folder marketplace, every later change commits in the folder, and the tag step tags it there through tagPublishedCommit while url and github tags still push. The new scenario, S1, and S2 pass under the adapter profile, nothing under extensions/ changed, and the commit is in the branch with a passing hook.</done>
</task>

<task type="auto">
  <name>Task 2: Prove the new scenario red under B-D1 and B-D2</name>
  <precondition>The three copied tools in $X match the sha256 values of Executor setup, and `git diff --quiet 85c323b HEAD -- extensions/pi-claude-marketplace/orchestrators/plugin/install-cascade.ts extensions/pi-claude-marketplace/orchestrators/plugin/clone-cache.ts` exits 0, so both break sites apply to this tree.</precondition>
  <files>none in the repository: the break files, logs, red tables, and checker output live under $X/dirgittag/ only</files>
  <read_first>
    - 261123-gth-RESEARCH.md section 4 and the assumptions log (A1, A2)
    - "Red-proof inputs" above, and the header comments of $X/dirgittag/break.sh and $X/dirgittag/check-red.mjs
    - extensions/pi-claude-marketplace/orchestrators/plugin/install-cascade.ts lines 820-948 and extensions/pi-claude-marketplace/orchestrators/plugin/clone-cache.ts lines 956-976 (read only)
  </read_first>
  <action>
Follow research section 4. Run every break from the executor's worktree: `break.sh` runs `git checkout -- extensions/` when it exits, so `git rev-parse --show-toplevel` must not be the main checkout (the first entry of `git worktree list`). If this executor works in the main checkout (no isolation), first create a detached scratch worktree at `$X/dirgittag/tree` from HEAD, install its dependencies as Executor setup does, write the same `dirgittag-scratch` file into its git dir (`git -C "$X/dirgittag/tree" rev-parse --git-path dirgittag-scratch`), run the breaks and the verify command from there, and remove it afterwards with `git worktree remove --force`.

1. Write `$X/dirgittag/BD1.json` and `$X/dirgittag/BD2.json` with the exact content of "Red-proof inputs".
2. Run `"$X/dirgittag/break.sh" BD1 adapter "$X/dirgittag/BD1.json" features/plugin/install-dependencies.feature` with `PATH="$X/bin:$PATH"`, in the foreground with the longest tool timeout. Then run the same for BD2. Never start a break while another runs: `break.sh` refuses a dirty `extensions/`, and it never stacks breaks.
3. Read each log `$X/dirgittag/<break>-adapter.log`: the first line is `root=<checkout root>`, then the diff of the one edit, the count line (expected `62 scenarios (1 failed, 61 passed)`), the failed-scenario list naming the new scenario at a Then step, `exit=1`, and `restored=clean`. Expected failing steps: B-D1 at `the result lists these plugins:` (formatter shows `dependency current copy` and 2.0.0), B-D2 at `the staged skills directory of the project scope holds these files:` (the key half of formatter's `pluginRoot` differs). If BD1 does not fail the new scenario, or `break.sh` refuses it, run BD1b instead and record why. If more scenarios than the new one fail, list them in the SUMMARY; that is information, not a failure of this task.
4. Write `$X/dirgittag/red-tables.md` from the template in "Red-proof inputs", with each `scenarios` cell equal to the count in that run's count line.
5. Run the verify command; it writes the checker's output to `$X/dirgittag/check-red.out`.

Commit nothing. The SUMMARY records, for each break, the log path, the diff, the count line, the failed scenario and its step, `exit=`, and `restored=`, then the checker output. A run that shows a cucumber step timeout, or fails for want of memory or CPU, is not red evidence (the checker rejects a timeout): rerun it when the machine is idle.
  </action>
  <verify>
    <automated>X=$(cat "$(git rev-parse --git-path dirgittag-scratch)") && node "$X/dirgittag/check-red.mjs" "$X/dirgittag/red-tables.md" "$X/dirgittag" "$(git rev-parse --show-toplevel)" "$(cat "$X/dirgittag/base.sha")" > "$X/dirgittag/check-red.out" && test "$(tail -n 1 "$X/dirgittag/check-red.out")" = 'RED-PROOFS OK' && S=$(git status --porcelain -- extensions/) && test -z "$S"</automated>
  </verify>
  <acceptance_criteria>
    - `tail -n 1 "$X/dirgittag/check-red.out"` prints `RED-PROOFS OK`: both runs fail the new scenario in a When or a Then step at its current line, each log is valid, and every scenario this plan added has a must-fail row.
    - `grep -c '^restored=clean$' "$X/dirgittag/BD1-adapter.log"` prints 1 [HEAD=error:2 EXPECT==1 UNPINNED]
    - `grep -c '^restored=clean$' "$X/dirgittag/BD2-adapter.log"` prints 1 [HEAD=error:2 EXPECT==1 UNPINNED]
    - `git diff --quiet HEAD -- extensions/; echo $?` prints 0 [HEAD=0 EXPECT==0 @85c323b GUARD MUTATION: a break left applied after break.sh exits]
  </acceptance_criteria>
  <done>Each of B-D1 and B-D2 (or BD1b, with its reason) failed the new scenario in a Then step and was reverted with extensions/ clean, the checker printed RED-PROOFS OK, and the SUMMARY holds the evidence.</done>
</task>

<task type="auto">
  <name>Task 3: Document the git-folder kind and run the regression set and the static gate</name>
  <files>.agents/skills/cucumber/rules/features.md</files>
  <read_first>
    - .agents/skills/cucumber/rules/features.md lines 57-103 (Source kinds) and 126-149 (Run tokens)
    - .agents/skills/local-verification/rules/commands.md (the ESLint cache note)
  </read_first>
  <action>
(a) In `.agents/skills/cucumber/rules/features.md`, add a paragraph right after the hosted paragraph (line 101), in the file's plain style (the `simple-english` skill in Plain mode, then the `humanizer` skill). It begins `A marketplace can also be published as \`git-folder\`` and says: it is the files of the `dir` kind in a folder that is a git work tree with no remote; the user adds it by its path, as a `dir` source; every later change to it is a new commit in the folder, and nothing is pushed; the step `the marketplace <name> tags its current commit <tag>` tags the folder's current commit, so a path-source dependency can install from a release tag of the folder itself (TAGS-01); it has no branch, no unreadable file, and no read-only directory, because git cannot commit those, and removing its source removes the folder; its scenarios never sit in a source-kind Outline, and `npm run check:features` rejects `git-folder` in the `source kind` column of any `Examples:` block. In the run-token rule for `{<marketplace> revision <tag>}` (line 136), widen "in a git marketplace" so it names the url, github, and git-folder kinds.

(b) Run the verify command: the whole `install-dependencies.feature` and the features that exercise the rewritten git helpers (`update-dependencies`, plugin `git-source`, marketplace `url-source` and `github-source`) under the adapter profile; `install-dependencies.feature` under the builtin profile, where it still selects only the `@mcp` scenario at line 112; then `npm run check:static` after deleting `node_modules/.cache/eslint/`, so every file lints fresh after the union change, as CI lints.

(c) Run the fixer pass on `features.md`, restage, and commit with the environment prefix, for example `docs(features): describe the git-folder marketplace source kind`. `features.md` is not a build input, so the hook runs only the Markdown fixers and linters.
  </action>
  <verify>
    <automated>X=$(cat "$(git rev-parse --git-path dirgittag-scratch)") && PATH="$X/bin:$PATH" npm_config_script_shell=/tmp/claude-0/-home-user-pi-claude-marketplace/36571f01-5770-4f51-bd77-b22d58691339/scratchpad/nondac-sh NODE_OPTIONS=--max-old-space-size=6144 npm run test:cucumber:profile -- --profile adapter --parallel 2 features/plugin/install-dependencies.feature features/plugin/update-dependencies.feature features/plugin/git-source.feature features/marketplace/url-source.feature features/marketplace/github-source.feature && PATH="$X/bin:$PATH" npm_config_script_shell=/tmp/claude-0/-home-user-pi-claude-marketplace/36571f01-5770-4f51-bd77-b22d58691339/scratchpad/nondac-sh NODE_OPTIONS=--max-old-space-size=6144 npm run test:cucumber:profile -- --profile builtin features/plugin/install-dependencies.feature && rm -rf node_modules/.cache/eslint && PATH="$X/bin:$PATH" npm_config_script_shell=/tmp/claude-0/-home-user-pi-claude-marketplace/36571f01-5770-4f51-bd77-b22d58691339/scratchpad/nondac-sh NODE_OPTIONS=--max-old-space-size=6144 npm run check:static</automated>
  </verify>
  <acceptance_criteria>
    - The adapter run's count line shows every scenario passed, with none failed, undefined, ambiguous, or pending; install-dependencies.feature alone accounts for 62 of them. The builtin run prints `1 scenario (1 passed)`. `npm run check:static` exits 0.
    - `grep -cE '^A marketplace can also be published as .git-folder.' .agents/skills/cucumber/rules/features.md` prints 1 [HEAD=0 EXPECT==1 @85c323b]
    - `grep -cE '^- .\{<marketplace> revision <tag>\}.*git-folder' .agents/skills/cucumber/rules/features.md` prints 1 [HEAD=0 EXPECT==1 @85c323b]
    - The docs commit is in the branch, and its hook passed.
  </acceptance_criteria>
  <done>The cucumber rules describe the git-folder kind and its tag token, the whole dependency feature and the git-publishing neighbors pass on the unbroken tree under the adapter profile, the builtin profile still selects its one scenario, check:static passes from an empty ESLint cache, and the docs commit landed.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| feature file to harness git | Marketplace and tag names from the feature file reach `git init`, `git commit`, and `git tag` through `runGit`. |
| red-proof runs to product sources | `break.sh` edits `extensions/` for the length of one run; the tree must come back exactly as committed. |
| copied tools to this executor | `break.sh`, `check-red.mjs`, and `nondac-sh` come from another session's scratchpad. |
| scenario sandbox to network and home | A scenario must not reach the network, a real account, or the user's `~/.pi`. |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-261123-gth-01 | Tampering | break.sh edits of extensions/ | medium | mitigate | `break.sh` refuses a dirty `extensions/`, restores it with `git checkout -- extensions/` in an EXIT trap, and logs `restored=clean`; it runs only from the executor's worktree (or a scratch worktree), never the main checkout; `check-red.mjs` rejects a log without `restored=clean`; Task 2 checks that `git status --porcelain -- extensions/` is empty, and Task 1 checks that the branch changes no file under `extensions/`. |
| T-261123-gth-02 | Tampering | copied red-proof tools | low | mitigate | The tools are copied, never run in place, and their sha256 values are checked against the recorded ones before the first run (the Task 2 precondition). |
| T-261123-gth-03 | Elevation of privilege | harness git with feature-file input | low | mitigate | `runGit` runs `execFile` with an argv array and no shell, under `hermeticGitEnvironment` (`GIT_CONFIG_NOSYSTEM=1`, `GIT_CONFIG_GLOBAL=/dev/null`, a scratch HOME); `tagGitCommit` makes a lightweight tag and never forces one. |
| T-261123-gth-04 | Information disclosure | scenario sandbox | low | mitigate | The git-folder kind is a local folder under the sandbox HOME; `Then the git host receives no request` asserts that the install made no request or connection (NFR-5); the sandbox HOME and agent directory keep `~/.pi` out of reach. |
| T-261123-gth-05 | Repudiation | red-proof evidence | low | mitigate | The SUMMARY records each break's log path, diff, count line, failed step, `exit=`, and `restored=`, and the checker output, so a reviewer can tell a red run from a broken setup. |
| T-261123-gth-SC | Tampering | npm installs | low | mitigate | No dependency changes: `package.json` and `package-lock.json` stay as they are. A fresh worktree installs from the committed lockfile with `npm ci --ignore-scripts`, and the optional peers come from the main checkout's cache or from `install-test-peers.mjs` at the pinned suite versions with registry integrity checks. |
</threat_model>

<verification>
- Each task's `<verify>` command passes, and each commit's hook passes (or the by-hand fallback ran and passed).
- `git diff --quiet "$(cat "$X/dirgittag/base.sha")" HEAD -- extensions/` exits 0.
- `$X/dirgittag/check-red.out` ends with `RED-PROOFS OK`, and both break logs end with `restored=clean`.
- After the merge, the orchestrator runs `npm run check` in the main checkout (AGENTS.md, Build verification), because Task 1 commits build inputs.
</verification>

<success_criteria>
- `features/lib/published-marketplace.ts` publishes the git-folder kind, with a `git-folder` case in all eight switches over the kind and refusals in the two if-guards; `features/lib/git-marketplace.ts` holds one commit builder that every publisher reuses.
- The tag step dispatches through `tagPublishedCommit`; S1 and S2 still pass.
- The new scenario passes on the unbroken tree and fails in a Then step under B-D1 and under B-D2 (`RED-PROOFS OK`); each break was reverted with `restored=clean`.
- `install-dependencies.feature` passes whole (62 adapter, 1 builtin), the neighbor features pass, and `npm run check:static` passes from an empty ESLint cache.
- `.agents/skills/cucumber/rules/features.md` documents the kind and its tag token.
- No product file, CHANGELOG line, version, or planning record changed.
</success_criteria>

## For the orchestrator

- BACKLOG: DIRGITTAG-01 closes once the scenario lands. Use the repo form: change the heading at `.planning/BACKLOG.md` line 5514 to `## ~~DIRGITTAG-01: no scenario installs a dependency from a tag of a local git marketplace~~ -- CLOSED`, and add one line that names the git-folder source kind, the scenario title, the Task 1 commit, and the two red proofs.
- STATE.md: remove DIRGITTAG-01 from the "Still open" line of the integration-rescope closeout, and add the quick task row.
- Gate: Task 1 commits build inputs, so run `npm run check` in the main checkout after this item's worktree merges (AGENTS.md, Build verification), with the nondac-sh prefix and a PATH that has `fd`.
- No CHANGELOG line and no version bump: the change is test-only and no user-visible behavior changes.
- If 261123-gti also edits `.agents/skills/cucumber/rules/features.md`, merge the two; never rebase.

<output>
Create `.planning/quick/261123-gth-dirgittag-01-planning-backlog-md-add-a-publication-kind-for/261123-gth-SUMMARY.md` with `status: complete` in its frontmatter. Do not commit it; the orchestrator commits it. It holds:
- the commits (hash and title) and each commit hook's result;
- the Task 1 run (`3 scenarios (3 passed)`) and the Task 3 runs (each count line) and the `npm run check:static` result;
- for B-D1 and B-D2 (or BD1b, with its reason): the log path, the diff, the count line, the failed scenario and its step, `exit=`, and `restored=`; then the `check-red.mjs` output;
- each Design item as built, and every deviation from this plan;
- `## For the orchestrator`, copied from this plan and updated with the real commit hashes;
- `## Threat Flags` (AGENTS.md), even when the answer is "None -- no security-relevant surface outside the plan's `<threat_model>` was introduced."
</output>
