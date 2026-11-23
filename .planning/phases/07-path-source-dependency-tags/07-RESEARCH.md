# Phase 7: Path-Source Dependency Tags - Research

**Researched:** 2026-11-22
**Domain:** cucumber harness (a marketplace release-tag step) and two install scenarios that replace the user-visible cases of `test/integration/path-source-tag-install.test.ts`
**Confidence:** HIGH. Every draft was run green in a scratch worktree of `0410e82`. Every break was applied, run, and reverted. `check:static` and `fallow audit` were run on the combined patch.

## Summary

The integration file has 4 tests. Two are user-visible and get scenarios: TAGS-01/TAGS-03 (a constrained path-source dependency installs from `formatter--v1.0.0` while the marketplace HEAD has moved past it) and TAGS-02 (no tag satisfies the range, so both plugins install from HEAD). Two stay as internal cases for Phase 8: CR-01 (untracked files kept out of the tag clone) and the two-member `.git/index`/`.git/HEAD` check. No product bug showed up.

The smallest harness addition is one `Given` in `marketplace/publishing.steps.ts`: `the marketplace {string} tags its current commit {string}`. It tags the published work tree's HEAD and pushes the tag. Its builder is `pushGitTag` in `features/lib/git-marketplace.ts`, and `git-plugin.ts::pushTagOnlyRevision` now calls the same builder, so fallow sees no clone. The step only works on a git publication (`url` or `github`). A later `offers these plugins with dependencies` step republishes, which commits and pushes, so HEAD moves past the tag. No new publication kind is needed.

Two harness facts drive the design. First, a tag-pinned dependency records and reports `1.0.0-<first 12 hex of the tag's commit>`. A scenario can only state that through a run token, so `features/support/world.ts` gains `recordMarketplaceTag` and a `{<marketplace> revision <tag>}` token, e.g. `{tools revision formatter--v1.0.0}`. Second, the staged SKILL.md of a tag-pinned plugin names its root `plugin-clones/<url-hash>-<tag12>/plugins/formatter`. The url hash covers the git host's random port for a `url` marketplace, so the text changes every run. It is stable for a `github` marketplace: `1969ce50f054` in 3 runs. **Use `is published as a github source`.**

**Primary recommendation:** one plan, one wave. Apply the validated patch (`intree-final.diff`, 6 files, +128/-283). Update the token rule in the cucumber skill and the `@fileoverview` comments. Run breaks B1, B2, and B4. Validate with `check-red.mjs`, then run `npm run check`.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- [Tag step] Q: "Where does the marketplace-tag step go?" → Selected: "In `features/step_definitions/marketplace/publishing.steps.ts`, with its builder in the marketplace library under `features/lib/` beside the plugin tag builder of `features/lib/git-plugin.ts` (reuse, do not copy: fallow dupes fails on clones); step text names the marketplace and the tag" — layout rule; harness code is cheap to change.
- [Placement] Q: "Which feature file gets the scenarios?" → Selected: "The existing feature that owns constrained dependency installs (research maps it by file:line); a new file only when none does" — reversible.
- [Tags] Q: "How are the scenarios tagged?" → Selected: "Untagged when they have no MCP surface (adapter only; builtin selects 0, DUAL-02)" — DUAL-02.
- [CR-01] Q: "Does the untracked-file case get a scenario?" → Selected: "Only if a user can see the file in the installed plugin (research checks what lands under the plugin root); otherwise it stays internal for Phase 8 with the reason in the file header" — follows the ROADMAP note.
- [Content checks] Q: "How is 'shows the tag's version and content' proved?" → Selected: "The list/info row with the version, and the installed artifact's text from the tag (not HEAD), compared whole; the fallback scenario shows both plugins installed with HEAD's content" — whole checks per the review lessons.
- [Breaks] Q: "How is each replaced case checked before deletion?" → Selected: "One reverted deliberate break per behavior, failing on a When/Then (not a Given), recorded in SUMMARY.md, checked with Phase 6's `check-red.mjs` if it fits" — test approach.
- [Deletion] Q: "What happens to path-source-tag-install?" → Selected: "It keeps only its internal cases (the `.git/index`/`.git/HEAD` check, and CR-01 if it stays internal) with a header saying why; helpers no remaining case uses go" — git history keeps the rest.
- [Bugs] Q: "What if a scenario exposes a product bug?" → Selected: "Rule 4: fix it when small, with a unit test beside its source pair and a CHANGELOG parent line; otherwise a BACKLOG.md entry and the guarding integration case stays" — milestone rule.

### Claude's Discretion
- Scenario titles, step wording, tables; break edits; plan count (one plan is likely).

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ITMIG-07 | A step publishes a marketplace repository with a tag, and scenarios cover a path-source dependency installed from the tag its constraint selects while the marketplace HEAD has moved past it, plus the TAGS-02 fallback to the current checkout. | Step `the marketplace {string} tags its current commit {string}` (below). Scenarios S1 (TAGS-01/03) and S2 (TAGS-02) are green under adapter, and builtin selects neither. Breaks B1 and B2 fail S1 on a `Then`; B4 fails S2 on a `Then`; `check-red.mjs` printed `RED-PROOFS OK`. Tests 1 and 4 are deleted; tests 2 and 3 stay as internal cases. |
</phase_requirements>

## Project Constraints (from AGENTS.md)

- Never commit to `main`; never rebase; commit through `.agents/skills/committing/SKILL.md`; never `--no-verify`; never `SKIP=` a hook.
- A visible `/claude:plugin` behavior change ships with a failing-without-it cucumber scenario. This phase changes no behavior; it moves coverage.
- Upstream parity: a scenario expects Claude Code's behavior or names the licensing decision ID (milestone rule; AGENTS.md "Upstream parity").
- GSD gates run `npm run check` on the combined tree. A passing commit hook is not a verdict. Inside `.claude/worktrees/...` the hook may check nothing, so run `npm run check:static` and the touched scenarios by hand.
- Every plan `SUMMARY.md` has a `## Threat Flags` section (use the "None --" form).
- `windows append --description` is prefixed `[integration-rescope]`.
- Parent lines (CHANGELOG, BACKLOG, Key Decisions) go in the last SUMMARY, not in those files. Expected: all "None" (test-only change), as in `06-02-SUMMARY.md:141-145`.
- Comments and titles cite durable IDs (TAGS-01, D-07-03), never "Phase 7" or "Plan 01" (CONVENTIONS.md "Comments").
- Exported functions declare return types; `import-x/order` is alphabetized per group (the first draft failed lint on this; see Pitfall 3).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Publish a marketplace release tag | cucumber harness (`features/lib/git-marketplace.ts`) | step module `marketplace/publishing.steps.ts` | Git fixtures live in the lib; the step reads the publication from the world and checks the bare repo |
| Token for the tag's commit | `features/support/world.ts` (`tokens` getter) | `features/lib/run-tokens.ts` (unchanged; it already expands/projects `revisions`) | All revision tokens come from the world |
| Tag selection (product, unchanged) | `orchestrators/plugin/install-cascade.ts:925-948` | `orchestrators/plugin/marketplace-tag-probe.ts` | Path arm of `probeMemberPin` |
| Tag materialization (product, unchanged) | `orchestrators/plugin/clone-cache.ts:956-1016` | `orchestrators/plugin/install-outcome.ts:846` | `materializeMarketplaceTagClone` |
| Internal git-state and CR-01 guards | `test/integration/path-source-tag-install.test.ts` (trimmed) | Phase 8 | No command shows them |

## Standard Stack

No new package. The phase uses only what is in the tree: `@cucumber/cucumber` (the existing harness), the system `git` via `features/lib/hermetic-git.ts::runGit`, `node:test` for the trimmed integration file, and fallow, ESLint, and Prettier for the gates. [VERIFIED: the patch passed `check:static` and `fallow audit` in the scratch worktree]

## Package Legitimacy Audit

Not applicable. The phase installs no external package.

## Architecture Patterns

### Data flow the scenarios drive

```
Given github marketplace "tools" ──publishGitRepository──> bare repo on git host (main, stable)
Given offers app(formatter@^1.0.0), formatter 1.0.0 ──pushGitRepository──> commit A
Given tags its current commit "formatter--v1.0.0" ──pushGitTag──> refs/tags/formatter--v1.0.0 -> A   (world records token)
Given offers ... formatter 2.0.0 ──pushGitRepository──> commit B (HEAD past the tag)
Given added to project ──marketplace add (isomorphic-git clone, tags fetched)──> .pi/pi-claude-marketplace/sources/tools
When install app@tools
   └─ cascade closure: formatter (range ^1.0.0) -> probeMemberPin path arm
        ├─ listTags(sources/tools) -> selectHighestSatisfyingTag(prefix "formatter--v", range)
        │    pinned A  ──> materializeMarketplaceTagClone: copy .git only, checkout A
        │                  └─> plugin-clones/1969ce50f054-<A12>/plugins/formatter   (S1)
        └─ no-matching-tag / tag-listing-failed ──> fellBackToCurrentCopy
                           └─> sources/tools/plugins/formatter at B, row {dependency current copy}  (S2)
Then result rows + record + staged skills (whole SKILL.md text, incl. pluginRoot)
```

### Production lines the scenarios guard (read this session)

- Path arm, `install-cascade.ts:925` `if (tagSource.kind === "path") {` and `:943-944` [VERIFIED: install-cascade.ts:943-944]:
  ```ts
  if (probed.kind === "no-matching-tag" || probed.kind === "tag-listing-failed") {
    return { kind: "resolved", member: { ...member, fellBackToCurrentCopy: true } };
  ```
- Selection, `marketplace-tag-probe.ts:146-147` [VERIFIED: marketplace-tag-probe.ts:146-147]:
  ```ts
      `${options.pluginName}${RELEASE_TAG_SEPARATOR}`,
      options.range,
  ```
- Materialization, `clone-cache.ts:986-991` calls `checkoutGitDirCopy(gitOps, path.join(args.marketplaceRoot, ".git"), staging, args.tagOid)`. `checkoutGitDirCopy` (`clone-cache.ts:282-292`) copies only `.git`, removes the index, and checks out `ref` [VERIFIED: clone-cache.ts:282-292, 982-991].

### Case inventory: `test/integration/path-source-tag-install.test.ts` at `0410e82`

| # | Test (line) | What it asserts | Class | Replaced by |
|---|---|---|---|---|
| 1 | `TAGS-01/TAGS-03: a constrained path-source dependency installs from the marketplace tag that satisfies it` (`:163`) | Both records exist; the formatter root holds the tag's `plugin.json` `{name, version: "1.0.0"}` and `MARKER.txt` `tagged-content`; record `version`=`1.0.0-<tag12>`, `resolvedVersion`=`1.0.0`, `resolvedSha`=tag oid; root under `plugin-clones/`; the marketplace's `.git/HEAD`, `.git/index`, and two work-tree files are byte-identical | User-visible, apart from `resolvedVersion`/`resolvedSha` (stored fields) and the git-state snapshot (internal) | **S1**. The result row and the record show `1.0.0-{tools revision formatter--v1.0.0}`. The staged `formatter-skill/SKILL.md` text is the tag's (`A skill of formatter 1.0.0.`, `Version 1.0.0.`) and its `pluginRoot` is under `plugin-clones/`. The git-state part stays guarded by test 3 (break B5 fails test 3; see Breaks) |
| 2 | `CR-01: an untracked file in the marketplace root does not leak into the materialized tag clone` (`:243`) | Gitignored `top-level.secret`, `plugins/formatter/leaked.secret`, and untracked `plugins/formatter/UNTRACKED.txt` are absent from the clone | **Internal: stays** | None (see "CR-01 decision") |
| 3 | `TAGS-01: two cascade members resolving against the SAME marketplace clone leave its git state untouched` (`:393`) | Two members pinned to the tag oid; `.git/index` and `.git/HEAD` byte-identical | **Internal: stays** (ROADMAP note) | None |
| 4 | `TAGS-02: a constraint no marketplace tag satisfies still installs both plugins, from the CURRENT checkout` (`:524`) | Both installed; the formatter root holds HEAD's `plugin.json` 2.0.0 and `current-checkout-content`; record `version` 2.0.0; one notification, the block with `{dependency current copy}` and no severity (info); git snapshot unchanged | User-visible (the snapshot part is internal, as in test 1) | **S2**. The result fields show `severity info`, the row `{dependency current copy}` and version `2.0.0`, the record shows `2.0.0`, and the staged SKILL.md text is HEAD's (`2.0.0`, `pluginRoot` under `sources/tools/`) |

Existing coverage, measured with breaks (not just read):
- No existing scenario pins a path-source dependency to a tag. B1 and B2 fail only S1 among the 61 scenarios of `install-dependencies.feature` plus the 23 of `update-dependencies.feature` (`B1w`/`B2w` runs: 84 scenarios, 83 passed, 1 failed). [VERIFIED: break runs]
- The fallback arm is already partly covered. `install-dependencies.feature:7` ("Installing a plugin whose dependency carries a version constraint installs the dependency too", a dir source with no `.git`) goes through `no-matching-tag`, not `tag-listing-failed`: isomorphic-git `listTags` returns `[]` for a non-git dir. So B3 (no fallback on `no-matching-tag`) fails `:7`, `:24`, `:491`, `update-dependencies.feature:713`, and S2. What only S2 catches is "a real tag exists, but outside the range": B4 (selection ignores the range) fails S2 alone. [VERIFIED: break runs B3w, B4w]

### CR-01 decision: stays internal (Phase 8)

The planted files sit at the marketplace root and the plugin root, not inside a component. A leaking implementation would put them only under `.pi/pi-claude-marketplace/plugin-clones/<key>/`. No command lists that directory, and no skill, prompt, agent, hook, or MCP entry reads them. In the cucumber harness, the marketplace root is the extension's own clone under `sources/`, which git creates clean. No user action and no step puts an untracked file there. For a user to see a leak, the planted file would have to be a component, such as a file inside a tracked skill directory: skill staging copies the whole skill dir (`bridges/skills/stage.ts:329` `await cp(skill.skillDir, stagedDir, {`). That would need a new "dir source that is a git work tree" publication, which this phase does not need.

Measured evidence:
- B6, a naive work-tree copy before the checkout, fails CR-01 (and test 1). It also fails S1, because the checkout refuses: `Your local changes to the following files would be overwritten by checkout`.
- A careful leak, one that copies only untracked files, would pass S1.

So CR-01 stays as the only guard. Phase 8 may move it to a unit test beside `clone-cache.ts`: the `materializeMarketplaceTagClone` unit tests at `test/orchestrators/plugin/clone-cache.test.ts:2217-2354` have no untracked-file case, while the mirror copy has one (GIT-01, `:2549`). [VERIFIED: grep and Read this session]

### Placement

`features/plugin/install-dependencies.feature`. The ROADMAP table names `plugin/{install-dependencies,update-dependencies}.feature`; every replaced case is an install, so `update-dependencies.feature` is unchanged. Insert both scenarios directly after "Installing a plugin records a git-source dependency installed at a release tag with the tag's commit" (`:643-670`) and before "Installing a second plugin that asks for a dependency's range leaves the dependency recorded at its release tag in place" (`:672` at `0410e82`). That keeps the tag scenarios together. After insertion, S1 is at `:672` and S2 at `:704`.

### Existing steps used (read this session)

| Step | Definition |
|---|---|
| `the marketplace {string} is published as a {source kind} source` | `features/step_definitions/marketplace/publishing.steps.ts:70`; `SourceKind` is `"dir" \| "file" \| "url" \| "github" \| "hosted"` [VERIFIED: features/lib/published-marketplace.ts:44] |
| `the marketplace {string} offers these plugins with dependencies:` | `publishing.steps.ts:152` → `republishMarketplace` → `changePublication` (url/github: write, then `pushGitRepository`) [VERIFIED: published-marketplace.ts:162-181] |
| `the marketplace {string} is added to the {word} scope` | `publishing.steps.ts:257` |
| `the user runs {string}` | `command.steps.ts` |
| `the result has these fields:` | `command.steps.ts:217` |
| `the result lists these plugins:` | `command.steps.ts:225-230`; `recordTable` puts unstated columns in the table, so every column must be stated (`features/lib/field-rows.ts:93-99`, `namesLike`) |
| `the installation record of the {word} scope holds these plugins:` | `installation.steps.ts:478-490` (`id`, `version`, `enabled`; the version goes through `projectTokens`) |
| `the staged skills directory of the {word} scope holds these files:` | `installation.steps.ts:557-565`; each file's whole text, with tokens |

Plugin fixture text, which shows the version in the skill: `writePluginFiles` writes `description: A skill of ${plugin.name} ${plugin.version}.` and the body `Version ${plugin.version}.` [VERIFIED: features/lib/path-marketplace.ts writePluginFiles]

### New step and harness changes (validated in tree, then reverted)

1. `features/lib/git-marketplace.ts`: new export (shown in Code Examples) `pushGitTag(workTree, home, tag): Promise<string>`. It runs `git tag`, then `git push -q origin refs/tags/<tag>`, and returns `rev-parse HEAD`.
2. `features/lib/git-plugin.ts:206` `pushTagOnlyRevision`: replace its three lines (`tag`, `rev-parse`, `push`) with `const revision = await pushGitTag(workTree, gitHome, tag);` and add `pushGitTag` to the `./git-marketplace.ts` import. Every existing "has a revision only the tag ... reaches" scenario still passes (61/61 and 23/23).
3. `features/step_definitions/marketplace/publishing.steps.ts`: new `Given("the marketplace {string} tags its current commit {string}")`. It fails unless the kind is `url` or `github`, checks `rev-parse <tag>^{commit}` in the bare repository, and calls `this.recordMarketplaceTag`. Add `import { pushGitTag } from "../../lib/git-marketplace.ts";` **between** the `earlier-version-state.ts` and `git-plugin.ts` imports (`import-x/order`).
4. `features/support/world.ts`: a private `marketplaceTags` array, a public `recordMarketplaceTag(marketplace, tag, commit)`, and `revisionTokens` that also emits `{<marketplace> <noun> <tag>}`. `revision` takes the first 12 hex digits and `commit` the full sha. The current code [VERIFIED: features/support/world.ts:417-418, 440-449]:
   ```ts
         revisions: this.revisionTokens("revision", (sha) => sha.slice(0, 12)),
         commits: this.revisionTokens("commit", (sha) => sha),
   ```
   `expandTokens`' unknown-token check `/\{[a-z][a-z0-9 ._-]*\}/iu` accepts the new form (letters, digits, spaces, `.`, `-`) [VERIFIED: features/lib/run-tokens.ts:114].
5. Not in the validated patch; the plan must add these doc edits:
   - `.agents/skills/cucumber/rules/features.md:134-135`: one bullet for `{<marketplace> revision <tag>}` (and `{<marketplace> commit <tag>}`), beside the existing rule, which reads "`{<repository> revision <n>}` is the version of the n-th revision, counted from 1, that a scenario published to a git plugin repository." [VERIFIED: features.md:134]
   - The `@fileoverview` of `publishing.steps.ts` (it lists what the module publishes) and of `git-marketplace.ts` (it describes pushes): one sentence each about the tag.
   - `features/lib/run-tokens.ts:45-48`: the doc comments of `revisions` and `commits` name only `{ghp revision 1}` and `{ghp commit 1}`; add the tag form (optional).

### Anti-patterns to avoid
- **A `url` marketplace in S1.** The staged `pluginRoot` hash changes every run: `ab684a8e35e0` and `02c42a9fb5d9` in two runs, against a constant `1969ce50f054` for github. `features/lib/git-clones.ts:8-9` says why: "The URL hash covers the git host's random port".
- **Registering the marketplace as a `GitPluginRepository` to get a token.** That gives `{tools revision 1}`, but it lets `requireGitRepository("tools")` resolve to the marketplace. Use the separate `marketplaceTags` record.
- **Omitting the `version` column, or checking only the skill description.** Every column must be stated, and a wrong implementation that pins the tag but materializes HEAD shows up only in the staged text or the version (B2 shows `2.0.0-{tools revision formatter--v1.0.0}`).
- **Tagging on a side branch** (as `pushTagOnlyRevision` does for plugins). The ROADMAP wants a tag that HEAD has moved past on the same history, as in the integration fixture.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Moving the marketplace HEAD past the tag | A new "commit and push" step | The existing `offers these plugins with dependencies:` republish (`changePublication` → `pushGitRepository`) | It already commits and pushes for url/github |
| Tag and push | A second copy of `git tag` + `push` | One `pushGitTag` in `git-marketplace.ts`, used by both builders | fallow `dupes` fails on clones (no threshold since 3.32) |
| Red-proof validation | Ad hoc greps | Phase 6 `break.sh` and `check-red.mjs` (copies in the research folder) | `check-red.mjs` already rejects a failure in a Given |
| Clone-key value in staged text | A new token | A github marketplace, whose key is stable (`1969ce50f054`) | `legacy-move.feature:875` already states a literal key (`66356916cc08`) for a github source |

## Runtime State Inventory

Not a rename or migration phase. Nothing is stored outside the repository: scenarios run in per-scenario sandboxes, and the research worktree was removed (`git worktree list` shows only the main checkout).

## Common Pitfalls

### Pitfall 1: The marketplace kind decides whether the staged text is stable
**What goes wrong:** S1's staged `pluginRoot` differs between runs. **Why:** the clone key hashes the marketplace URL, which holds the git host port for `url`. **Avoid:** `is published as a github source`. **Warning sign:** a different 12-hex prefix before `-{tools revision formatter--v1.0.0}` on each run.

### Pitfall 2: The dir-source scenario already covers part of the fallback arm
**What goes wrong:** a planner picks B3 (disable the `no-matching-tag` fallback) as S2's break and thinks S2 is the only guard. **Why:** `listTags` on a non-git dir returns `[]`, so `install-dependencies.feature:7` goes through `no-matching-tag` too. **Avoid:** use B4 as S2's red proof (only S2 fails). Record B3 as informative only (5 failures, 2 of them in a `Given`: `:24` and `:491` fail in `Given the user has run ...`).

### Pitfall 3: Import order in `publishing.steps.ts`
The first draft put `git-marketplace.ts` beside `hermetic-git.ts` and failed `import-x/order` (`check:static` exit 1 at 192 s, lint only). It must go after `earlier-version-state.ts`, before `git-plugin.ts`.

### Pitfall 4: `fallow audit` reports `weakened-tests`
`test/integration/path-source-tag-install.test.ts  weakened-tests (removed-tests) [warn]  test cases: 4 -> 2`. This is expected; per the 2026-11-21 user decision, record it in the SUMMARY and change no config. Every other audit metric is 0 (dead code, complexity, duplication).

### Pitfall 5: Breaks run in the plan's own worktree
`break.sh` roots itself at `git rev-parse --show-toplevel` and restores `extensions/` with `git checkout`. Run it from the executor's worktree, never the main checkout. The research copy sets `WRAP` to the shared `nondac-sh`, `LOCK` to its own folder, and `--parallel 2`.

### Pitfall 6: Helpers after the trim
Tests 2 and 3 keep `makeCtx`, `buildTaggedMarketplace` (CR-01 uses it; its `tagOid` return is now unread, which tsc allows), and `buildTwoTagMarketplace`. Delete `marketplaceGitSnapshot` (tests 1 and 4 only) and `buildNonSatisfyingTagMarketplace` (test 4 only). The trimmed file passed typecheck, lint, and `node --test` (2/2).

## Code Examples

### The shared builder (validated)
```ts
// features/lib/git-marketplace.ts (appended)
/**
 * Tags the commit the published work tree `workTree` has checked out as
 * `tag`, pushes the tag alone to its bare repository, and returns the tagged
 * commit. Every git runs with the HOME `home`.
 */
export async function pushGitTag(workTree: string, home: string, tag: string): Promise<string> {
  await runGit(workTree, home, "tag", tag);
  await runGit(workTree, home, "push", "-q", "origin", `refs/tags/${tag}`);
  return runGit(workTree, home, "rev-parse", "HEAD");
}
```

### The step (validated)
```ts
// TAGS-01: a release tag of a plugin the marketplace offers from a relative
// path names the marketplace repository's own commit, `<plugin>--v<version>`.
Given(
  "the marketplace {string} tags its current commit {string}",
  async function (this: ScenarioWorld, name: string, tag: string) {
    const published = this.requirePublished(name);
    if (published.kind !== "url" && published.kind !== "github") {
      assert.fail(`the marketplace ${name} is published as a ${published.kind} source, not git`);
    }

    const commit = await pushGitTag(published.root, published.gitHome, tag);
    assert.strictEqual(
      await runGit(published.bareRepository, published.gitHome, "rev-parse", `${tag}^{commit}`),
      commit,
    );
    this.recordMarketplaceTag(name, tag, commit);
  },
);
```

### The scenarios (green under adapter; builtin selects neither)

```gherkin
  Scenario: Installing a plugin installs its path-source dependency from the marketplace tag that its version constraint selects, not from a later marketplace commit (TAGS-01, TAGS-03)
    Given the marketplace "tools" is published as a github source
    Given the marketplace "tools" offers these plugins with dependencies:
      | name      | version | dependencies     |
      | app       | 1.0.0   | formatter@^1.0.0 |
      | formatter | 1.0.0   |                  |
    Given the marketplace "tools" tags its current commit "formatter--v1.0.0"
    Given the marketplace "tools" offers these plugins with dependencies:
      | name      | version | dependencies     |
      | app       | 1.0.0   | formatter@^1.0.0 |
      | formatter | 2.0.0   |                  |
    Given the marketplace "tools" is added to the project scope
    When the user runs "/claude:plugin install app@tools --scope project"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | true    |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id              | name            | status    | reasons | scope   | version                                  |
      | tools            | project           | app@tools       | app             | installed |         | project | 1.0.0                                    |
      | tools            | project           | formatter@tools | formatter@tools | installed |         | project | 1.0.0-{tools revision formatter--v1.0.0} |
    Then the installation record of the project scope holds these plugins:
      | id              | version                                  | enabled |
      | app@tools       | 1.0.0                                    | true    |
      | formatter@tools | 1.0.0-{tools revision formatter--v1.0.0} | true    |
    Then the staged skills directory of the project scope holds these files:
      | file                     | text |
      | app-skill/               |      |
      | app-skill/SKILL.md       | ---\nname: app-skill\ndescription: A skill of app 1.0.0.\npi-claude-marketplace: {"names":["app:app-skill","app-skill"],"pluginRoot":"{project dir}/.pi/pi-claude-marketplace/sources/tools/plugins/app","pluginData":"{project dir}/.pi/pi-claude-marketplace/data/tools/app"}\n---\n\nVersion 1.0.0.\n |
      | formatter-skill/         |      |
      | formatter-skill/SKILL.md | ---\nname: formatter-skill\ndescription: A skill of formatter 1.0.0.\npi-claude-marketplace: {"names":["formatter:formatter-skill","formatter-skill"],"pluginRoot":"{project dir}/.pi/pi-claude-marketplace/plugin-clones/1969ce50f054-{tools revision formatter--v1.0.0}/plugins/formatter","pluginData":"{project dir}/.pi/pi-claude-marketplace/data/tools/formatter"}\n---\n\nVersion 1.0.0.\n |

  Scenario: Installing a plugin whose path-source dependency's version constraint no marketplace tag satisfies installs the dependency's current copy as a note (TAGS-02, D-07-03)
    Given the marketplace "tools" is published as a github source
    Given the marketplace "tools" offers these plugins with dependencies:
      | name      | version | dependencies     |
      | app       | 1.0.0   | formatter@^9.0.0 |
      | formatter | 1.0.0   |                  |
    Given the marketplace "tools" tags its current commit "formatter--v1.0.0"
    Given the marketplace "tools" offers these plugins with dependencies:
      | name      | version | dependencies     |
      | app       | 1.0.0   | formatter@^9.0.0 |
      | formatter | 2.0.0   |                  |
    Given the marketplace "tools" is added to the project scope
    When the user runs "/claude:plugin install app@tools --scope project"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | true    |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id              | name            | status    | reasons                 | scope   | version |
      | tools            | project           | app@tools       | app             | installed |                         | project | 1.0.0   |
      | tools            | project           | formatter@tools | formatter@tools | installed | dependency current copy | project | 2.0.0   |
    Then the installation record of the project scope holds these plugins:
      | id              | version | enabled |
      | app@tools       | 1.0.0   | true    |
      | formatter@tools | 2.0.0   | true    |
    Then the staged skills directory of the project scope holds these files:
      | file                     | text |
      | app-skill/               |      |
      | app-skill/SKILL.md       | ---\nname: app-skill\ndescription: A skill of app 1.0.0.\npi-claude-marketplace: {"names":["app:app-skill","app-skill"],"pluginRoot":"{project dir}/.pi/pi-claude-marketplace/sources/tools/plugins/app","pluginData":"{project dir}/.pi/pi-claude-marketplace/data/tools/app"}\n---\n\nVersion 1.0.0.\n |
      | formatter-skill/         |      |
      | formatter-skill/SKILL.md | ---\nname: formatter-skill\ndescription: A skill of formatter 2.0.0.\npi-claude-marketplace: {"names":["formatter:formatter-skill","formatter-skill"],"pluginRoot":"{project dir}/.pi/pi-claude-marketplace/sources/tools/plugins/formatter","pluginData":"{project dir}/.pi/pi-claude-marketplace/data/tools/formatter"}\n---\n\nVersion 2.0.0.\n |
```

Titles are the planner's choice (CONTEXT discretion). If a title changes, the `title` cell of the must-fail table must change with it.

### The trimmed integration file header (validated)
```ts
// test/integration/path-source-tag-install.test.ts
//
// Internal cases of the path-source tag install (TAGS-01, D-07-04), driven
// end to end against a REAL git repository with NO injected seams: the real
// `addMarketplace` and `installPlugin` orchestrators run
// `probeMarketplaceTags` and `materializeMarketplaceTagClone` as production
// wires them. The user-visible cases -- a dependency installed from the tag
// its constraint selects while the marketplace has moved past it, and the
// TAGS-02 fallback -- are cucumber scenarios in
// `features/plugin/install-dependencies.feature`.
//
// What stays here is what no command shows:
// - CR-01: a gitignored or untracked file in the marketplace checkout never
//   reaches `plugin-clones/<key>/`. The planted files are not plugin
//   components, so only the clone directory on disk would hold them.
// - Two cascade members that read one marketplace clone's tags leave its
//   `.git/index` and `.git/HEAD` byte-identical.
```

## Deliberate breaks (each applied, run, and reverted in this session)

Edits are `[file, old, new]`, with the file relative to `extensions/pi-claude-marketplace/`. Each old text is unique at `0410e82`. The JSON files are in the research folder.

| Break | Behavior broken | Edit | Result over `install-dependencies.feature` with the patch (61 scenarios) |
|---|---|---|---|
| **B1** | TAGS-01: a satisfying tag is ignored, and every path member falls back | `install-cascade.ts:943` `if (probed.kind === "no-matching-tag" \|\| probed.kind === "tag-listing-failed") {` → `if (probed.kind !== undefined) {` | S1 fails at `Then the result lists these plugins:` (`dependency current copy`, `2.0.0`); 60 pass |
| **B2** | TAGS-03: the pin is kept, but the files come from HEAD | `clone-cache.ts:988-990` `path.join(args.marketplaceRoot, ".git"),\n        staging,\n        args.tagOid,` → `... "HEAD",` | S1 fails at `Then the result lists these plugins:` (`2.0.0-{tools revision formatter--v1.0.0}`); 60 pass |
| **B4** | TAGS-02: with no satisfying tag, the highest tag installs anyway | `marketplace-tag-probe.ts:146-147` `options.range,` → `"*",` | S2 fails at `Then the result lists these plugins:` (`''` reason, `1.0.0-{tools revision formatter--v1.0.0}`); 60 pass |
| B3 (informative) | The `no-matching-tag` arm does not fall back | `install-cascade.ts:943` → `if (probed.kind === "tag-listing-failed") {` | S2 and `:7` fail on a `Then`; `:24`, `:491`, and `update-dependencies.feature:713` fail in a `Given`. Not a red proof for S2 (Pitfall 2) |
| B5 (survivor) | A stray in-place checkout of the tag in the marketplace clone | `clone-cache.ts` insert `await gitOps.checkout({ dir: args.marketplaceRoot, ref: args.tagOid });` before the `checkoutGitDirCopy(` call of `materializeMarketplaceTagClone` | 61/61 pass. Integration test 3 (kept) fails, which shows the internal guard is still needed |
| B6 (not for the plan) | Copy the marketplace work tree before the checkout | insert `await cp(args.marketplaceRoot, staging, { recursive: true });` at the same place | CR-01 and test 1 fail; S1 fails on `Then the result has these fields:` because the checkout refuses to overwrite. A careful leak would pass S1, so CR-01 stays |

`check-red.mjs` on the B1, B2, and B4 logs, with must-fail rows S1/B1, S1/B2, S2/B4, against base `HEAD` (`0410e82`), printed:
```
B1-adapter: 61 scenarios (60 passed, 1 failed) exit=1
  failed features/plugin/install-dependencies.feature:672 [Then] Installing a plugin installs its path-source dependency ...
B2-adapter: 61 scenarios (60 passed, 1 failed) exit=1
  failed features/plugin/install-dependencies.feature:672 [Then] ...
B4-adapter: 61 scenarios (60 passed, 1 failed) exit=1
  failed features/plugin/install-dependencies.feature:704 [Then] Installing a plugin whose path-source dependency's ...
RED-PROOFS OK
```
Builtin needs no break row: both scenarios are untagged, so `check-red.mjs` asks only for adapter coverage.

## Upstream parity

Claude Code's own docs (`code.claude.com/docs/en/plugin-dependencies`, fetched this session) state each behavior the scenarios pin:

| Behavior pinned | Claude Code | Licence |
|---|---|---|
| A relative-path dependency resolves against the **marketplace repository's** `<name>--v<version>` tags, highest that satisfies (S1) | "Relative path such as `./plugins/secrets-vault`: the marketplace repository, so the marketplace maintainer creates the tags"; "the dependency installs from the highest `secrets-vault--v` tag that satisfies `~2.1.0`" [CITED] | Parity (TAGS-01) |
| The installed files come from the tag (S1) | Same sentence, "installs from the highest ... tag" [CITED] | Parity (TAGS-03) |
| Version `1.0.0-<12 hex>` (S1) | "A tag-resolved dependency shows its version with a 12-character commit suffix, such as `2.1.0-8713c5b11005`" [CITED] | Parity (GV-01) |
| No tag satisfies → the current copy installs (S2) | "Plugin referenced by a relative path: the install uses the marketplace's current copy instead, and the constraint is checked when the plugin loads" [CITED] | Parity (TAGS-02) |
| The fallback is an `info` note, not a warning (S2's `severity info`, no warning) | PROJECT.md Key Decisions `:1988`: "D-07-03 ... stays a quiet `info`-level note, not a warning — a deliberate divergence from upstream, which surfaces the analogous fallback as a warning." The docs page fetched does not state the severity [CITED: .planning/PROJECT.md:1988] | **Divergence, licensed by D-07-03**. S2's title names it |

No case pins an unlicensed divergence, so no case stays behind as a question for the user. Upstream also resolves tags for a local-folder marketplace that is a git repository (the English page states it; a search summary of the zh-TW page names Claude Code v2.1.196 as the minimum [ASSUMED]). The integration fixture used that form, a dir source that is a git work tree. The scenarios use a github marketplace: the code path is the same (`record.marketplaceRoot`), and only the clone-key URL derivation differs (`clone-cache.ts:972-974`). See Open Question 1.

## State of the Art

| Old approach | Current approach | When changed | Impact |
|---|---|---|---|
| Tag scenarios only for plugin repositories (`git-plugin.ts::pushTagOnlyRevision`) | A marketplace tag step on the same builder (`pushGitTag`) | This phase | A path-source tag is now testable in cucumber |
| Revision tokens only per plugin repository revision | Plus `{<marketplace> revision <tag>}` | This phase | A pinned path-source version can be stated whole |

## Assumptions Log

| # | Claim | Section | Risk if wrong |
|---|-------|---------|---------------|
| A1 | Upstream reports the relative-path fallback as a warning; the wording comes from D-07-03 in PROJECT.md, not from the docs page fetched | Upstream parity | Low: S2 pins `info` under D-07-03 either way |
| A2 | The github clone key `1969ce50f054` depends only on the canonical `https://github.com/<owner>/tools` URL (3 identical runs) | Pitfall 1 | Low: if the harness changes the default owner, the literal changes in S1 only |
| A3 | No CHANGELOG line is needed (test-only change), as in Phase 6 | Project Constraints | Low |

## Open Questions

1. **Should a dir-source git checkout marketplace get a scenario too?**
   - What we know: the deleted test 1 used a dir source whose directory is a git work tree, and upstream supports it. The product path is the same; only the clone-key URL fallback (`marketplace-name:<name>` when there is no origin) differs, and unit tests cover the materializer.
   - What's unclear: whether reviewers count "dir-in-git" as a separate user-visible case.
   - Recommendation: not in this phase (ITMIG-07 names "a marketplace repository with a tag", which the github step satisfies). If the planner wants it, it needs a new publication kind in the shared `published-marketplace.ts`; record it as a BACKLOG parent line instead.
2. **Token name.** `{tools revision formatter--v1.0.0}` mirrors `{<repository> revision <n>}` with the tag in place of `<n>`. `{tools tag formatter--v1.0.0}` is the alternative. Planner's discretion; the validated patch uses the first.

## Environment Availability

| Dependency | Required by | Available | Version | Fallback |
|---|---|---|---|---|
| Node | everything | ✓ | v24.22.3 | — |
| system `git` | `runGit` fixtures and the git host CGI | ✓ | (used by every run this session) | — |
| `nondac-sh` wrapper | npm scripts | ✓ | `/tmp/claude-0/-home-user-pi-claude-marketplace/36571f01-5770-4f51-bd77-b22d58691339/scratchpad/nondac-sh` | — |
| `flock` | `break.sh` | ✓ | util-linux | — |
| optional peers cache | `test:cucumber:profile` (`install-test-peers.mjs`) | ✓ | present | — |

Nothing is missing.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | `@cucumber/cucumber` (profiles `adapter`, `builtin`) + `node:test` (integration) |
| Config file | `cucumber.json` (adapter: `not @builtin-only`; builtin: `(@mcp or @builtin-only) and not @adapter-only`) |
| Quick run command | `npm_config_script_shell=<nondac-sh> NODE_OPTIONS=--max-old-space-size=6144 npm run test:cucumber:profile -- --profile adapter --parallel 2 features/plugin/install-dependencies.feature:672 features/plugin/install-dependencies.feature:704` (about 7 s for the two) |
| Feature run | same, the whole file: 61 scenarios, 15 s at `--parallel 2`; builtin: 1 scenario (an existing `@mcp` one), a few seconds |
| Integration | `node --test test/integration/path-source-tag-install.test.ts`: 2 tests, under 1 s |
| Full suite command | `npm run check` (phase gate) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ITMIG-07 / TAGS-01, TAGS-03 | Dependency from the tag while HEAD has moved | cucumber | `... --profile adapter features/plugin/install-dependencies.feature:672` | after patch |
| ITMIG-07 / TAGS-02, D-07-03 | No satisfying tag → current copy, info note | cucumber | `... --profile adapter features/plugin/install-dependencies.feature:704` | after patch |
| internal (kept) | CR-01; two-member git state | integration | `node --test test/integration/path-source-tag-install.test.ts` | ✅ (trimmed) |
| red proofs | B1, B2 fail S1; B4 fails S2 on a `Then` | break + checker | `break.sh B1 adapter B1.json features/plugin/install-dependencies.feature` ...; `node check-red.mjs <plan> <logs> <root> <base>` | research folder |

### Sampling Rate
- **Per task commit:** the two scenarios (about 7 s), plus `npx --no eslint -- --max-warnings 0 <touched .ts>` (12 s warm), plus `npm run check:features` (13 s).
- **Before deleting the cases:** B1, B2, and B4 (about 20 s each), then `check-red.mjs`.
- **Phase gate:** `npm run check` on the combined tree. Measured pieces: `check:static` 192 s cold (lint dominates; typecheck 45 s, format 61 s, fallow 12 s). Run `test:coverage:direct:all` with the minimal `env -i` environment from CONTEXT.

### Wave 0 Gaps
None. The harness additions are the phase's first task and need no framework install.

## Security Domain

Test-harness only. No product code, input path, credential, or network surface changes. The step runs `git` with the hermetic environment (`hermetic-git.ts`: no system or global config, scratch HOME) and a tag name from the feature file, passed as one argv element (no shell). ASVS V5 (input validation): not applicable beyond that. CR-01, a hygiene guard (no secret files copied into clones), stays covered by the kept integration case.

| Pattern | STRIDE | Mitigation |
|---|---|---|
| A gitignored or untracked file copied into `plugin-clones/` | Information disclosure | Kept integration case CR-01; production copies only `.git` (`clone-cache.ts:289`) |

## Research artifacts

`/tmp/claude-0/-home-user-pi-claude-marketplace/36571f01-5770-4f51-bd77-b22d58691339/scratchpad/research-07/`:
- `intree-final.diff` (sha256 `df537dfe100fb32ea608ca3c666cd5a44b1565d57487095b913f673dc84f61e3`): the validated patch. `git apply --check` passes on `0410e82`.
- `ref/<path>`: the final state of each of the 6 changed files.
- `final/break.sh`, `final/B1.json`..`B5.json`, `final/B*-adapter.log`, `final/plan-tables.md`.
- `check-red.mjs` (unchanged Phase 6 copy), `README.md`, `SHA256SUMS` (sha256 `ec13e47eb9028c76cfc04e283a436f6901374ccccac1fd8fa5e8c94799027521`).

## Plan split

**One plan, one wave** (`07-01`). The tasks:
1. Harness: apply the `git-marketplace.ts`, `git-plugin.ts`, `publishing.steps.ts`, and `world.ts` parts of the patch, plus the `@fileoverview` comments and the `features.md` token rule. Verify: ESLint on the touched files, typecheck, `check:features`, and the existing tag scenarios of `install-dependencies.feature` and `update-dependencies.feature` green.
2. Scenarios: insert S1 and S2 in `install-dependencies.feature` after `:670`. Verify: both green under adapter; builtin selects neither.
3. Red proofs: B1, B2, and B4 with `break.sh`, then `check-red.mjs` → `RED-PROOFS OK`. Record B3, B5, and B6 as informative.
4. Trim the integration file: delete tests 1 and 4, `marketplaceGitSnapshot`, and `buildNonSatisfyingTagMarketplace`; write the new header. Verify: `node --test` 2/2, and `fallow audit` shows only `weakened-tests` (record it).
5. Gate: `npm run check`.

`files_modified`: `features/lib/git-marketplace.ts`, `features/lib/git-plugin.ts`, `features/step_definitions/marketplace/publishing.steps.ts`, `features/support/world.ts`, `features/plugin/install-dependencies.feature`, `test/integration/path-source-tag-install.test.ts`, `.agents/skills/cucumber/rules/features.md` (optionally `features/lib/run-tokens.ts` comments). `files_deleted`: none (the integration file keeps 2 cases).

## Sources

### Primary (HIGH confidence)
- Codebase, read this session: `test/integration/path-source-tag-install.test.ts`; `orchestrators/plugin/{install-cascade,marketplace-tag-probe,clone-cache,install-outcome}.ts`; `features/lib/{git-marketplace,git-plugin,published-marketplace,path-marketplace,run-tokens,field-rows,git-clones}.ts`; `features/support/world.ts`; `features/step_definitions/{marketplace/publishing,marketplace/checkout,plugin/installation,command}.steps.ts`; `features/plugin/install-dependencies.feature`; `docs/dependency-resolution.md:90-120`; `.planning/PROJECT.md:1576-1586, 1988`.
- Runs this session: drafts green (3 runs); feature file 61/61 adapter, 1/1 builtin; breaks B1-B6; `check-red.mjs`; `check:static`; `fallow audit`; `tsc`; Prettier.
- Claude Code docs: https://code.claude.com/docs/en/plugin-dependencies ("How a constraint resolves against tags", "Confirm the resolved version", "Release a plugin that others depend on").

### Secondary
- `.planning/phases/06-hooks-and-auth/06-RESEARCH.md` and `06-02-SUMMARY.md` (format, Parent lines).
- `.planning/phases/03-marketplace-layers-and-cross-scope-install/03-03-SUMMARY.md` (the earlier change to `publishing.steps.ts` and `git-plugin.ts`, merged; no conflict at `0410e82`).

## Metadata

**Confidence breakdown:**
- Harness design: HIGH (validated patch, `check:static` pieces green after the import fix)
- Scenarios and breaks: HIGH (run green, run red, checker OK)
- Parity: HIGH for TAGS-01/02/03 and GV-01 (upstream docs); MEDIUM for the "upstream warns" wording (A1)

**Research date:** 2026-11-22
**Valid until:** until `features/support/world.ts`, `publishing.steps.ts`, or `install-dependencies.feature` changes on main (rebase line numbers then)
