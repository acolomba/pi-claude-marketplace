# Phase 3: Marketplace Layers and Cross-Scope Install - Pattern Map

**Mapped:** 2026-11-21
**Files analyzed:** 16 (4 feature files, 4 step/library modules, 1 product source + 1 unit test, 1 trimmed and 3 deleted integration files, 1 SUMMARY convention)
**Analogs found:** 16 / 16 (all analogs are git-tracked; `git ls-files` verified)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `features/marketplace/autoupdate.feature` (A01-A03) | test (behavioral) | request-response | same file, `:262` "Enabling autoupdate without --local on a marketplace added with --local fails ..." | exact |
| `features/marketplace/remove.feature` (M01-M06) | test (behavioral) | request-response | same file, `:343` "Removing without --local a marketplace added with --local ..." | exact |
| `features/marketplace/url-source.feature` (R01, R02, U01, U02, `.git` variant) | test (behavioral) | request-response + git host log | same file, `:7` "Adding a url marketplace clones it from the git host" | exact |
| `features/plugin/cross-scope-install.feature` (C01-C05) | test (behavioral) | request-response | same file, `:6` (dependency marketplace into project) | exact |
| `features/step_definitions/marketplace/publishing.steps.ts` (+ "offers these plugins from its own repository:") | test step (Given) | file-I/O (republish + manifest rewrite) | `features/step_definitions/plugin/publishing.steps.ts:180-197` ("offers these plugins from git repositories:") | exact |
| `features/lib/git-plugin.ts` (own-repository entry builder + table reader) | test utility | transform | same file: `gitPluginEntry`/`gitPluginSource` (`:324-367`), `readGitPluginOffers`/`parsePinned` (`:273-306`) | exact |
| `features/step_definitions/marketplace/checkout.steps.ts` (MA-12, MA-13 Givens; checkout-files Then) | test step | file-I/O | same file, `:34-42` ("has lost the checkout") and `:44-56` (`holds no marketplace checkout`) | exact |
| `features/step_definitions/plugin/installation.steps.ts` ("has written ... to its data directory", "holds no plugin data") | test step | file-I/O | same file, `:242-253` (data directory Given), `:174-206` helpers, `:622-624` (`holds no git clones`) | exact |
| `extensions/pi-claude-marketplace/orchestrators/plugin/clone-cache.ts` (seeding fix, `:686-697`, `:800`) | service (orchestrator seam) | file-I/O / transform | itself (`seedSameRepoPluginMirrors`, `seedOnePluginMirror`) | exact |
| `test/orchestrators/plugin/clone-cache.test.ts` (new `.git` SEED case) | test (unit, direct-coverage pair) | file-I/O | same file, `:1722-1753` (SEED-01/03), `:1890-1916` (SEED-04) | exact |
| `test/integration/marketplace-layer-remove.test.ts` (trim to `:418`, `:576`, `:708`) | test (integration) | — | itself (import block `:10-40`) | exact |
| `test/integration/marketplace-layer-autoupdate.test.ts` | delete | — | — | — |
| `test/integration/marketplace-layer-redeclare.test.ts` | delete | — | — | — |
| `test/integration/project-install-adds-user-marketplace.test.ts` | delete | — | — | — |
| `test/integration/marketplace-add-seed-mirrors.test.ts` | unchanged (internal cases stay for Phase 8) | — | — | — |
| `03-0N-SUMMARY.md` red-proof records | doc | — | `.planning/phases/02-plugin-layers-names-and-list-fold/02-02-SUMMARY.md` | exact |

## Pattern Assignments

### `features/step_definitions/marketplace/publishing.steps.ts` (new Given: own-repository offer)

**Analog:** `features/step_definitions/plugin/publishing.steps.ts:180-197`

```ts
Given(
  "the marketplace {string} offers these plugins from git repositories:",
  async function (this: ScenarioWorld, name: string, table: DataTable) {
    const published = this.requirePublished(name);
    const entries = readGitPluginOffers(table).map((offer) =>
      gitPluginEntry(offer, this.requireGitRepository(offer.repository), this.gitHost),
    );
    ...
    await rewritePublishedManifest(published, offerGitPlugins(text, entries));
    const manifest = JSON.parse(await readFile(published.manifestPath, "utf8")) as {
      plugins: Array<{ name: string }>;
    };
    assert.deepStrictEqual(
      entries.map((entry) => manifest.plugins.find((plugin) => plugin.name === entry.name)),
      entries,
```

The step must first republish the plugin files the way the existing `offer()` helper does (`marketplace/publishing.steps.ts:53-60`):

```ts
async function offer(world: ScenarioWorld, name: string, plugins: readonly OfferedPlugin[]): Promise<void> {
  await republishMarketplace(world.requirePublished(name), name, plugins);
}
```

Then read HEAD for the pin (`runGit(published.root, published.gitHome, "rev-parse", "HEAD")`, as the scratch step does), rewrite each entry's `source` to `{ source: "git-subdir", url, path: "plugins/<name>", ...(pinned ? { sha } : {}) }`, and call `rewritePublishedManifest`. Expand the `url` cell with `expandTokens(row.url, this.tokens)` (already imported at `:47`). Assert `published.kind === "url" || "github"` with `assert.fail` naming the marketplace. Imports to add follow the existing block (`:14-51`): `runGit` from `../../lib/hermetic-git.ts`, the new builder from `../../lib/git-plugin.ts`. Update the `@fileoverview` (`:1-12`) to mention the own-repository offer. Verified behavior (untyped) is in the scratch `probe-steps/probe.steps.ts:18-40`; do not copy its `this: any` or the `spelling` column.

### `features/lib/git-plugin.ts` (new builder + reader)

**Analog:** same file. Table reader pattern (`:284-306`):

```ts
const OFFER_COLUMNS = ["name", "source kind", "repository", "pinned"] as const;
export function readGitPluginOffers(table: DataTable): GitPluginOffer[] {
  ...
  requireColumns(table, declaresDependencies ? [...OFFER_COLUMNS, "dependencies"] : OFFER_COLUMNS);
  return table.hashes().map((row) => { ... pinned: parsePinned(String(row.pinned)), ... });
}
```

Reuse `parsePinned` (`:273-282`) and `requireColumns` for `| name | version | url | pinned |`. Source construction follows `gitPluginSource` (`:347-367`):

```ts
const sha = offer.pinned ? { sha: latestRevision(repository) } : {};
...
case "git-subdir":
  return { source: offer.kind, url, path: pluginPath, ...sha };
```

Merge into the manifest with the existing `offerGitPlugins(text, entries)` (`:374-386`) rather than a hand loop. Every export needs an explicit return type and a `/** */` doc citing D-SEED-01.

### `features/step_definitions/marketplace/checkout.steps.ts` (MA-12, MA-13, checkout files)

**Analog:** same file. Imports (`:11-18`) and helper (`:29-32`):

```ts
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile, readdir, rm, stat } from "node:fs/promises";
import path from "node:path";

import { Given, Then } from "@cucumber/cucumber";

import type { ScenarioWorld } from "../../support/world.ts";

function extensionRootOf(world: ScenarioWorld, scope: string): string {
  return path.join(world.scopeRoot(scope), "pi-claude-marketplace");
}
```

Given pattern (`:34-42`): compute the checkout path, act, assert the post-condition:

```ts
Given(
  "the {word} scope has lost the checkout of the marketplace {string}",
  async function (this: ScenarioWorld, scope: string, name: string) {
    const checkout = path.join(extensionRootOf(this, scope), "sources", name);
    assert.equal((await stat(checkout)).isDirectory(), true);
    await rm(checkout, { recursive: true });
    assert.equal(existsSync(checkout), false);
  },
);
```

Then pattern (`:44-56`): `assert.deepStrictEqual` of a sorted listing against the expected value. For `holds these files:` compare `[["file"], ...rows]` to `table.raw()` (same shape as `installation.steps.ts:602-620`). The MA-12 Given body is the typed skeleton in RESEARCH "Code Examples" (real `git clone` of `published.bareRepository`, `remote set-url origin <repositoryUrl>`, marker `.git/pi-claude-marketplace.json` `{ generatedBy: "pi-claude-marketplace" }`, `stale.txt`). Add `mkdir`, `writeFile` and `type DataTable` to imports, and `runGit` from `../../lib/hermetic-git.ts`. Files the step plants outside a clone should register cleanup with `this.onRelease(...)` as `installation.steps.ts:205` does. Extend the `@fileoverview` (`:1-9`).

### `features/step_definitions/plugin/installation.steps.ts` (data written by a plugin; no plugin data)

**Analog:** same file, `:242-253`:

```ts
Given(
  "the data directory of {string} in the {word} scope holds the file {string} with the text {string}",
  async function (this: ScenarioWorld, id: string, scope: string, name: string, text: string) {
    const directory = pluginDataDirectory(this, scope, id);
    assert.ok(existsSync(directory), `${directory} does not exist, so the install did not create it`);
    assert.ok((await stat(directory)).isDirectory(), `${directory} is not a directory`);
    await writeUserFile(this, directory, name, text);
  },
);
```

The new "has written" Given reuses `pluginDataDirectory` (`:174-194`, validates `plugin@marketplace`) and `writeUserFile` (`:196-207`, `wx` flag + `onRelease`), replacing the existence asserts with `await mkdir(directory, { recursive: true })`. Note the parameter order differs: `(id, name, text, scope)`. The "holds no plugin data" Then follows `:622-624` (`holds no git clones`) with `extensionRoot(this, scope)` (`:69-71`) and an absent-or-empty `readdir` of `data`. Add both to the `@fileoverview` list (`:1-29`).

### `extensions/pi-claude-marketplace/orchestrators/plugin/clone-cache.ts` (seeding fix, D-SEED-01)

**Analog:** itself. Comparison site (`:798-802`):

```ts
// SEED-03: a different-repo git source is unaffected -- skip it so it keeps
// its normal `(remote)` -> network-clone behavior.
if (canonicalCloneUrl(src) !== marketplaceUrl) {
  continue;
}
```

Key site (`:694-697`):

```ts
const key =
  source.sha === undefined
    ? pluginMirrorKey(marketplaceUrl)
    : pluginCloneKey(marketplaceUrl, source.sha);
```

Fix shape (RESEARCH, tried and reverted): compare both URLs with one trailing `.git` removed, and key by `canonicalCloneUrl(source)` so the seed lands where install's probe looks. Keep the SEED-03/SEED-04 comments; cite D-SEED-01 in the new comment. Cognitive complexity ceiling 15 (ESLint + fallow); a small local helper (`withoutGitSuffix`) keeps the loop flat. Callers: `orchestrators/marketplace/add.ts:1236-1248` only. Do not change `canonicalCloneUrl` itself (`test/domain/clone-key.test.ts:303` pins it).

### `test/orchestrators/plugin/clone-cache.test.ts` (new `.git` case)

**Analog:** same file `:1722-1753` and helpers `:1643-1721`:

```ts
const GITHUB_REPO_URL = "https://github.com/owner/repo";
...
void test("SEED-01/03: same-repository git source kinds seed once ...", async (t) => {
  // arrange
  const locations = await freshLocations(t);
  const marketplaceRoot = await buildMarketplaceCheckout(t, {
    originUrl: GITHUB_REPO_URL,
    plugins: [ ..., gitSubdirEntry("subdir", GITHUB_REPO_URL), ... ],
  });
  await saveMarketplace(locations, marketplaceRoot, GITHUB_REPO_URL);

  // act
  await seedSameRepoPluginMirrors({ locations, marketplaceName: "marketplace" });
  const mirrorRoot = await locations.pluginCloneDir(pluginMirrorKey(GITHUB_REPO_URL));

  // assert
  assert.equal(await pathExists(mirrorRoot), true);
```

New cases: `gitSubdirEntry("subdir", `${GITHUB_REPO_URL}.git`)` seeds the mirror at the key install's probe derives (unpinned), and a pinned variant like `:1890-1916` (`createGitOps()`, `pluginCloneKey(..., PIN_40)`). Title cites `D-SEED-01`. Arrange/act/assert comments; `void test(...)`.

### Feature files (all four)

**Analog for a refusal that changes nothing** (`features/plugin/configuration.feature:120-140`): `Given the files of the project scope are remembered` before `When`, every result row listed, `Then the files of the project scope are unchanged` last. Do not use it before the project `.pi` exists (cross-scope C01/C03 remember the user scope only) or around MA-13 (it creates `sources-staging/`).

**Analog for a url scenario with a git host log** (`features/marketplace/url-source.feature:7-23`):

```gherkin
  Scenario: Adding a url marketplace clones it from the git host
    Given the marketplace "tools" is published as a url source
    When the user runs "/claude:plugin marketplace add https://{git host}/acme/tools.git --scope project"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | false   |
    Then the result lists these marketplaces:
      | name  | scope   | status |
      | tools | project | added  |
    ...
    Then the git host receives these requests:
```

**Analog for a layer refusal row** (`features/marketplace/remove.feature:343-359`, `autoupdate.feature:262-277`): the full `marketplace name | ... | rollback partial` header with the cause chain text. **Analog for cross-scope** (`features/plugin/cross-scope-install.feature:6-31`): dependency row `name` cell is `lib@tools`. Titles end with the spec ID in parentheses. No implementation tags (builtin selects 0, DUAL-02). Scenario text: copy the verified drafts in `research-03/probe/{autoupdate,url,remove,cross}.feature`.

### `test/integration/marketplace-layer-remove.test.ts` (trim)

Keep tests at `:418`, `:576`, `:708`. Remove imports only deleted cases use, from the block at `:10-40`: `lockfile` (`proper-lockfile`, `:15`), `planReconcile` (`:25`), `emptyReconcilePlan` (`:26`), `loadConfig`/`saveConfig` (`:27-30`), `mergeScopeConfigs` (`:31`), plus any file-local helper left unused. Update the header comment (`:1-8`) to say the file holds the EACCES fault-injection cases (PRUNE-03 and the partial/failure-only removes). Verify with `npm run typecheck`, `npm run lint`, and `node --import "$PWD/scripts/isolated-pi-home.mjs" --test test/integration/marketplace-layer-remove.test.ts`.

## Shared Patterns

### Red-proof SUMMARY record
**Source:** `.planning/phases/02-plugin-layers-names-and-list-fold/02-02-SUMMARY.md:108-157`
**Apply to:** every plan SUMMARY.
- `## Red proofs`: scratch folder `$D`, checkout root (first log line `root=<worktree>`), plan base sha, green runs (`N scenarios (N passed)`, `exit=0`), builtin run `0 scenarios` (DUAL-02), then one bullet per break: `file:line`, the `-`/`+` change, log path, `N scenarios (x passed, y failed)`, `exit=1`, each failed scenario as title + `file:line` + failing step, and "Passed: the other N". Each log ends `restored=clean`.
- `## Case map` table: integration case (`file:line` "title") | replacing scenario(s) | break that failed it.
- `## Parent lines` (CHANGELOG line for the seeding fix goes here), `## Threat Flags` ("None -- ..."), `## Self-Check`. Frontmatter lists deletions in `files_deleted`.
- Record the `fallow audit` `weakened-tests` warn per deleted or trimmed file; no `.fallowrc.json` change.

### Break helper
**Source:** Phase 2 `break.sh` pattern (02-02-SUMMARY `:26`, `:117`): roots at `git rev-parse --show-toplevel`, refuses a dirty `extensions/`, sets the EXIT trap before the one-substring replacement (exit 3 unless the old text occurs once), runs `npm run --silent test:cucumber:profile -- --profile adapter --parallel 1|2 <features>` with the nondac-sh prefix. Match failures with `^  [0-9]+\) .* # features/<dir>/<file>\.feature:[0-9]+$` and reject `0 scenarios`.

### Step module conventions
**Source:** `features/step_definitions/marketplace/checkout.steps.ts:1-32`
- `@fileoverview` describing what the steps set up and read; `this: ScenarioWorld` (never `any`); `node:assert/strict`; import order builtin / external / internal / type-only last; each Given asserts its own post-condition; cleanup of user files via `this.onRelease`.
- Lower-case step text, one owning module per step; `npm run check:features` rejects unused, undefined or ambiguous steps.

## No Analog Found

None. Every new step has a same-module analog, and the scratch module verified behavior.

## Metadata

**Analog search scope:** `features/step_definitions/{marketplace,plugin}/`, `features/lib/`, `features/{marketplace,plugin}/*.feature`, `extensions/pi-claude-marketplace/orchestrators/plugin/clone-cache.ts`, `test/orchestrators/plugin/clone-cache.test.ts`, `test/integration/marketplace-layer-remove.test.ts`, Phase 2 SUMMARY.
**Files scanned:** 14
**Pattern extraction date:** 2026-11-21
