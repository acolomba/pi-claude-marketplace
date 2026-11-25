# Quick 261123-gth: DIRGITTAG-01 (dir marketplace in a git work tree) - Research

**Researched:** 2026-11-23 (base `b4ce8d1`)
**Domain:** cucumber harness (a new marketplace publication kind) plus one install scenario
**Confidence:** HIGH for the product path, the upstream contract, and the harness shape (read this session). MEDIUM for the breaks: their edits were checked for unique old text, but they were not run this session (repo read-only).

## Summary

The product needs no change. A dir source records `marketplaceRoot` as the user's own folder. A relative-path member's tag source is `{ kind: "path", marketplaceRoot: record.marketplaceRoot }`, whatever the marketplace's source kind is, so the tag probe lists that folder's own tags (local isomorphic-git `listTags`). `materializeMarketplaceTagClone` copies only the folder's `.git` and checks out the tag. With no `origin`, the clone key is `pluginCloneKey("marketplace-name:tools", tagOid)`, which is `d1e3927ef215-<tag12>` for a marketplace named `tools`. That value is stable across runs, unlike the `url` kind.

The harness work is one new `SourceKind`, recommended name `git-folder`, dispatched in `features/lib/published-marketplace.ts`, plus small helper splits in `features/lib/git-marketplace.ts`. The existing tag step `the marketplace {string} tags its current commit {string}` learns to tag that kind without a push, by moving its dispatch into the library. The scenario reuses only existing steps, so no new step text is needed. It is untagged, so it runs under the adapter profile only (DUAL-02), the same as S1/S2.

**Primary recommendation:** add the `git-folder` kind and its library dispatch, and add one scenario after S2 (`install-dependencies.feature:746`). Red-prove it with B-D1 (the tag source of a dir marketplace is ignored) and B-D2 (the no-origin clone key changes). Run both through Phase 7's `break.sh`/`check-red.mjs`.

## User Constraints

There is no CONTEXT.md (quick-batch item). The constraints come from AGENTS.md and the task:
- A behavior scenario must fail without the change. Here the "change" is coverage, so the proof is a deliberate product break that fails the scenario in a When or Then step. A failure in a Given does not count.
- Do not commit to `main`, do not rebase, never use `--no-verify` or `SKIP=`. The executor runs `npm run check` on the combined tree after its worktree is merged.
- Upstream parity: the scenario must expect Claude Code's behavior (verified below).
- Comments and titles cite durable IDs (TAGS-01, TAGS-03, DIRGITTAG-01), never phase or plan numbers.
- The plan SUMMARY carries `## Threat Flags` ("None -- ...").
- The change is test-only, so no CHANGELOG line is needed (same as Phase 7, A3 there). Close the BACKLOG entry with the repo form `## ~~DIRGITTAG-01: ...~~ -- CLOSED` plus a one-line note [VERIFIED: .planning/BACKLOG.md:32 uses that form].

## 1. How the harness publishes today, and what the new kind needs

`SourceKind` [VERIFIED: features/lib/published-marketplace.ts:44]: `export type SourceKind = "dir" | "file" | "url" | "github" | "hosted";`. The parameter type regex is `regexp: /dir|file|url|github|hosted/,` [VERIFIED: features/support/source-kind.ts:15], and its fileoverview says "Only the five kinds match".

- `dir`/`file` (`publishMarketplaceIn`, :249-254): `writeMarketplace(root, ...)` under `{home}/marketplaces/<name>`, with `source` = root or the manifest. There is no git.
- `url`/`github` (:255-274): `writeMarketplace`, then `publishGitRepository(root, bareRepository, gitHost.gitHome)`, which runs `init`, `add -A`, `commit`, `clone --bare`, `remote add origin`, and pushes `main:stable` [VERIFIED: features/lib/git-marketplace.ts:24-37]. Every later change goes through `changePublication`, which writes and then runs `pushGitRepository` (`add -A`, `commit --allow-empty`, `push --atomic origin main main:stable`) [VERIFIED: git-marketplace.ts:47-51; published-marketplace.ts:162-181].
- `hosted`: serves the manifest bytes from the git host.

The new kind `git-folder` is a dir source, so the user types the folder path, and the folder is a git work tree with no `origin`:
- New interface `LocalGitPublication { kind: "git-folder"; root; source: root; manifestPath; gitHome }`, added to the `PublishedMarketplace` union. Keep it separate from `PathPublication`, because `earlier-version-state.ts:63` types `PathPublication` as `dir|file` only.
- `git-marketplace.ts`: split out `commitGitWorkTree(workTree, home)` (`add -A` + `commit -q --allow-empty -m publish`) and `initGitWorkTree(workTree, home)` (`init -q` + commit). `publishGitRepository` and `pushGitRepository` then call them, and `tagGitCommit(workTree, home, tag)` (`tag` + `rev-parse HEAD`) is what `pushGitTag` calls before its push. This keeps fallow `dupes` quiet, because one builder is reused, not copied.
- `published-marketplace.ts`: every `switch (published.kind)` needs the new case. TypeScript catches only the ones that return a value (`unreadableSkillFile` :584, `readOnlySkillDirectory` :663, `requireFreeRoot` :198, `publishMarketplaceIn` :239). **The `void` switches fall through silently and must be edited by hand**: `changePublication` :166 (write, then `commitGitWorkTree`, no push), `removePublishedSource` :426 (rm the root, as `dir` does), and `describeMarketplaceBranch` :886 (throw "has no branch"). `makeManifestUnreadable` :484 and `publishUnreadableCommandFile` :522 should refuse it as a git repository, because git cannot commit a file nobody may read.
- Tagging: move the body of the step `the marketplace {string} tags its current commit {string}` (`features/step_definitions/marketplace/publishing.steps.ts`, last step) into a library function `tagPublishedCommit(published, tag): Promise<string>`. For url/github it calls `pushGitTag` and checks `rev-parse <tag>^{commit}` in the bare repository, as it does now. For `git-folder` it calls `tagGitCommit` and checks the work tree. Other kinds throw. The step then calls this function and `this.recordMarketplaceTag`. This follows the rule "The world records the source kind of each published marketplace, and the library code dispatches on it. A new source kind changes library code only, not the steps." [VERIFIED: .agents/skills/cucumber/rules/world-and-stand-ins.md:37].
- `source-kind.ts`: add `git-folder` to the regex and change "five" to "six".
- Docs: in `.agents/skills/cucumber/rules/features.md`, add a paragraph after the hosted paragraph (:101) for the new kind. Its scenarios never sit in a source-kind Outline: `scripts/check-features.mjs:44` `const localKinds = new Set(["dir", "file"]);` rejects any other kind in an untagged Examples block. Widen the token rule (:136, "in a git marketplace") to include the new kind. Update the fileoverviews of `published-marketplace.ts`, `git-marketplace.ts`, and `publishing.steps.ts` (which says "a url or github marketplace").

The other kind guards in step and library files (`add.steps.ts:37`, `publishing.steps.ts:275`, `checkout.steps.ts:84`, `git-host.steps.ts:64`, `mcp-server-files.ts:208/265`, `hook-files.ts:577`, `invalid-configs.steps.ts:50`, `plugin/publishing.steps.ts:369`) already refuse any kind they do not name. They can stay as they are, because the scenario uses none of them.

**Product side** (read this session):
- `marketplace add <dir>`: `addPathInGuard` sets `marketplaceRoot = onDiskPath` (the user's folder, with no copy) and `source` = the parsed `PathSource` [VERIFIED: orchestrators/marketplace/add.ts:1895-1933].
- Tag source: `if (parsed.kind === "path") { return { kind: "path", marketplaceRoot: record.marketplaceRoot }; }`. This depends only on the plugin entry's source, not on the marketplace kind [VERIFIED: orchestrators/plugin/install-cascade.ts:843-845]. The path arm probes with `marketplaceRoot: tagSource.marketplaceRoot` and falls back on `no-matching-tag`/`tag-listing-failed` [VERIFIED: install-cascade.ts:925-948].
- Probe: `listTags({ fs, dir })`, local only [VERIFIED: platform/git.ts:792-794; marketplace-tag-probe.ts:131-148].
- Clone key: `(await deriveMarketplaceUrl(args.marketplaceSource, args.marketplaceRoot)) ?? \`marketplace-name:${args.marketplaceName}\`` [VERIFIED: orchestrators/plugin/clone-cache.ts:972-974]. For a path source, `deriveMarketplaceUrl` reads `.git/config` `[remote "origin"] url` and returns `undefined` when there is none, or when the origin is not url/github/git-subdir [VERIFIED: clone-cache.ts:607-673]. `pluginCloneKey` is `sha256(url).hex.slice(0, 12)` + `-` + `sha.slice(0, 12)` [VERIFIED: domain/clone-key.ts:28, 39-42]. Computed this session: `sha256("marketplace-name:tools")[0:12] = d1e3927ef215` [VERIFIED: node crypto].

## 2. Upstream parity

- Docs: "For a plugin the marketplace references by a relative path, a marketplace you added as a local folder path also resolves constraints against that folder's git tags, when the folder is a git repository. A local folder that isn't a git repository has no tags, so Claude Code installs the dependency from the folder's current contents instead." Also: "Tag each release as `<plugin-name>--v<version>`", and "A tag-resolved dependency shows its version with a 12-character commit suffix" [CITED: https://code.claude.com/docs/en/plugin-dependencies, fetched 2026-11-23].
- Binary: **Claude Code 2.1.330** (`/opt/claude-code/bin/claude`, `claude --version`). Grepped this session: `case"directory":return gqr(e.path).href` (the marketplace source becomes a `file://` URL of the folder), `function dir(e,o){let r=hpe(e);...return{source:"git-subdir",url:r,path:g}}`, and `var xCn="--v";function W9o(e,o){return\`${e}${xCn}${o}\`}` [VERIFIED: binary grep, 2.1.330]. So upstream resolves a relative-path member of a directory marketplace as a git-subdir at the folder's own file URL. It reads that folder's tags whether or not it has an `origin`. Pi reads the same tags through `listTags(marketplaceRoot)`, so the visible result is the same. The clone-cache key and `pluginRoot` path are Pi-internal; no upstream counterpart applies.
- No divergence is pinned, so no decision ID is needed. The minimum upstream version for local-folder tags is unknown. A Phase 7 search summary named v2.1.196 [ASSUMED]. This does not matter here, because no behavior depends on it.

## 3. Gherkin shape

Place it in `features/plugin/install-dependencies.feature` right after S2 (which ends at :746) and before "Installing a second plugin that asks for a dependency's range ..." (:748), so the tag scenarios stay together. It is untagged, so it runs under the adapter profile only; the builtin profile selects `(@mcp or @builtin-only) and not @adapter-only` [CITED: features.md:118]. It has no MCP surface, so no tag is owed. All its steps exist already. It adds the request-log step for NFR-5; log steps are allowed in this file, which already uses them at :1171 [VERIFIED: grep].

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
      | app-skill/SKILL.md       | ---\nname: app-skill\ndescription: A skill of app 1.0.0.\npi-claude-marketplace: {"names":["app:app-skill","app-skill"],"pluginRoot":"{home}/marketplaces/tools/plugins/app","pluginData":"{project dir}/.pi/pi-claude-marketplace/data/tools/app"}\n---\n\nVersion 1.0.0.\n |
      | formatter-skill/         |      |
      | formatter-skill/SKILL.md | ---\nname: formatter-skill\ndescription: A skill of formatter 1.0.0.\npi-claude-marketplace: {"names":["formatter:formatter-skill","formatter-skill"],"pluginRoot":"{project dir}/.pi/pi-claude-marketplace/plugin-clones/d1e3927ef215-{tools revision formatter--v1.0.0}/plugins/formatter","pluginData":"{project dir}/.pi/pi-claude-marketplace/data/tools/formatter"}\n---\n\nVersion 1.0.0.\n |
    Then the git host receives no request
```

Where these values come from:
- The app `pluginRoot` form `{home}/marketplaces/tools/plugins/<p>` matches existing dir scenarios [VERIFIED: install-dependencies.feature:1469]. `marketplacesRoot` is `path.join(sandbox.home, "marketplaces")` [VERIFIED: features/support/pi-process.ts:188].
- The formatter key is `d1e3927ef215` (§1).
- The other row and record shapes are copied from S1/S2 (:672-746).
- The kind name `git-folder` is the planner's choice. If it is renamed, the regex, the union, and the scenario line change together.

## 4. Deliberate breaks and red-proof method

Edits use the `break.sh` JSON form `[[file, old, new]]`, with each file relative to `extensions/pi-claude-marketplace/`. Each old text occurs exactly once at `b4ce8d1` [VERIFIED: grep -c = 1].

| Break | Behavior broken | Edit | Expected failure (not run this session) |
|---|---|---|---|
| **B-D1** | The tag probe ignores a dir-source marketplace, so a dir marketplace's member never reads the folder's tags | `orchestrators/plugin/install-cascade.ts`: `    return { kind: "path", marketplaceRoot: record.marketplaceRoot };` -> `    return { kind: "path", marketplaceRoot: parsePluginSource(record.source).kind === "path" ? \`${record.marketplaceRoot}/.no-tags\` : record.marketplaceRoot };` (`parsePluginSource` is already imported, :103) | New scenario fails at `Then the result lists these plugins:` (`dependency current copy`, `2.0.0`). S1/S2 (github) and the non-git dir scenarios still pass, because the latter fall back already. So the new scenario is the only guard |
| **B-D2** | The no-origin clone key no longer derives from the marketplace name | `orchestrators/plugin/clone-cache.ts`: `` `marketplace-name:${args.marketplaceName}` `` -> `` `marketplace-root:${args.marketplaceRoot}` `` | Rows and record pass. Fails at `Then the staged skills directory of the project scope holds these files:` (the key half differs and changes per run with the sandbox HOME). S1 is unaffected, because github derives a URL |
| B1/B2 (Phase 7, informative) | A satisfying tag is ignored, or the files come from HEAD | as in 07-RESEARCH "Deliberate breaks" | Also fail the new scenario. No need to rerun |

Method. Copy the Phase 7 tooling (identical in `plan-07/inputs`, `fix-07`, `fix-07b`; sha256 `8302926c...` break.sh, `6ff88295...` check-red.mjs) from `/tmp/claude-0/-home-user-pi-claude-marketplace/36571f01-5770-4f51-bd77-b22d58691339/scratchpad/fix-07b/`:
- `break.sh` and `check-red.mjs` go into `<executor scratchpad>/dirgittag/`.
- `break.sh` sets `WRAP="$S/nondac-sh"` and `LOCK="$S/phase07-heavy.lock"`, where `S` is the parent of its own folder. So also copy `/tmp/claude-0/-home-user-pi-claude-marketplace/36571f01-5770-4f51-bd77-b22d58691339/scratchpad/nondac-sh` to `<executor scratchpad>/nondac-sh`.
- Write `BD1.json` and `BD2.json`. Run `break.sh BD1 adapter BD1.json features/plugin/install-dependencies.feature` from the executor's worktree, never the main checkout (it runs `git checkout -- extensions/` on exit), and the same for BD2.
- Write a red table file shaped like `fix-07b/red-tables.md`, with `break-runs`, `must-fail` (title verbatim), and an empty `survivors`. Then run `node check-red.mjs <tables> <logs dir> <worktree root> <base sha>` and expect `RED-PROOFS OK`.
- Record both runs and the checker output in the SUMMARY. Running the whole file shows that B-D1 and B-D2 fail only the new scenario.

## 5. Pitfalls

1. **Silent `void` switches.** `changePublication`, `removePublishedSource`, and `describeMarketplaceBranch` compile with a missing case and then do nothing. Without a commit in `changePublication`, the second `offers ...` leaves HEAD at the tag, and the scenario still passes for the wrong reason (HEAD == tag). Add the cases explicitly. Optionally assert in the tag function that HEAD moved, or rely on the 2.0.0 republish.
2. **Git identity.** It is solved already: `runGit` uses `hermeticGitEnvironment` (author/committer `features`, `GIT_CONFIG_GLOBAL=/dev/null`, `-c init.defaultBranch=main -c commit.gpgsign=false`) [VERIFIED: features/lib/hermetic-git.ts:17-41]. Use `sites.gitHost.gitHome` as the HOME, as the git kinds do. Never call bare `git` without `runGit`.
3. **No origin.** Do not reuse `publishGitRepository` (it adds `origin`) or `pushGitTag` (it pushes). A local-path origin would still fall back to `marketplace-name:` (it is not url/github), but an origin breaks the "no origin" premise of the item.
4. **One token per commit.** `recordMarketplaceTag` refuses a second tag on the same commit [VERIFIED: features/support/world.ts:446-458]. Republish between tags, as the shape above does.
5. **NFR-5.** A local git folder is a path source: `marketplace add`, `listTags`, and the `.git` copy are all local. `marketplace-tag-probe.ts` is in `NETWORK_SEAMS` only because it imports `platform/git.ts`; `test/architecture/marketplace-tag-probe-offline.test.ts` pins its import set to `listTags`/`resolveTagOid` [VERIFIED: marketplace-tag-probe.ts:12-22]. `Then the git host receives no request` states this visibly. NFR-5 permits no network here, and the scenario proves it.
6. **check:features.** The new kind must not appear in any Outline Examples block (localKinds rejects it). No step is added, so there is no unused-step risk. `npm run check:features` must pass.
7. **Environment.** The container runs as uid 0, so every npm script goes through `nondac-sh` with `NODE_OPTIONS=--max-old-space-size=6144`. Inside `.claude/worktrees/...` the commit hook may check nothing, so run `npm run check:static` and the scenario by hand. Node is v24.22.3, git 2.43.0, `flock` is present, `fd` is not on PATH (only `fdfind`; this matters only for `hook/tool-use.feature`). The optional peers cache is present.
8. **Batch overlap.** Sibling item 261123-gti also adds a cucumber scenario and may touch the cucumber skill docs. Merge, do not rebase.

## Validation

| Step | Command |
|---|---|
| Scenario green | `npm_config_script_shell=<scratch>/nondac-sh NODE_OPTIONS=--max-old-space-size=6144 npm run test:cucumber:profile -- --profile adapter --parallel 2 features/plugin/install-dependencies.feature:<line>` |
| Whole feature + tag neighbours | same, with `features/plugin/install-dependencies.feature features/plugin/update-dependencies.feature` (adapter), plus the builtin profile (it must still select only the existing `@mcp` scenario) |
| Static | `npm run check:features`, then `npm run check:static` (typecheck catches the value-returning switches; fallow dupes the helper split) |
| Red proofs | B-D1, B-D2 via `break.sh`, then `check-red.mjs` -> `RED-PROOFS OK` |
| Gate | `npm run check` in the main checkout after the merge (AGENTS.md "Build verification") |

## Security

The change touches the test harness only. Git runs hermetically with argv arrays and no shell. The tag name comes from the feature file. The product, its inputs, credentials, and network surface are unchanged.

## Assumptions Log

| # | Claim | Risk if wrong |
|---|---|---|
| A1 | B-D1 makes `listTags` on a missing dir return `[]` or throw; both fall back to the current copy | Low: either arm gives the same failing row. If it does neither, swap in `return { kind: "absent" };` for dir sources (which fails the install instead, still in a Then) |
| A2 | isomorphic-git reads a repository made by system git 2.43 (loose refs, lightweight tags). The deleted Phase 7 integration test 1 used exactly this form | Low |
| A3 | Upstream minimum version for local-folder tags (v2.1.196) | None for this task |

## Sources

- Code read this session: `features/lib/{published-marketplace,git-marketplace,hermetic-git,path-marketplace}.ts`, `features/support/{world,source-kind,pi-process}.ts`, `features/step_definitions/marketplace/publishing.steps.ts`, `features/plugin/install-dependencies.feature:1-37,672-747`, `scripts/check-features.mjs:30-60,400-450`, `orchestrators/plugin/{clone-cache,install-cascade,install-outcome,marketplace-tag-probe}.ts`, `orchestrators/marketplace/add.ts:1870-1945`, `domain/{clone-key,source}.ts`, `platform/git.ts:792`.
- `.planning/milestones/integration-rescope-phases/07-path-source-dependency-tags/07-{CONTEXT,RESEARCH,REVIEW-FIX}.md`.
- https://code.claude.com/docs/en/plugin-dependencies (2026-11-23). Claude Code 2.1.330 binary grep.
- Red-proof tooling: `/tmp/claude-0/-home-user-pi-claude-marketplace/36571f01-5770-4f51-bd77-b22d58691339/scratchpad/fix-07b/{break.sh,check-red.mjs,red-tables.md,WR1C.json}`, `/tmp/claude-0/-home-user-pi-claude-marketplace/36571f01-5770-4f51-bd77-b22d58691339/scratchpad/nondac-sh`.
