# Phase 7: Path-Source Dependency Tags - Pattern Map

**Mapped:** 2026-11-23
**Files analyzed:** 8 (7 modified, 1 SUMMARY convention)
**Analogs found:** 8 / 8 (all analogs are git-tracked source)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `features/lib/git-marketplace.ts` (add `pushGitTag`) | test-harness utility | git file-I/O | same file, `pushGitRepository` (:45-49), `pushGitBranch` (:58-71) | exact |
| `features/lib/git-plugin.ts` (`pushTagOnlyRevision` calls `pushGitTag`) | test-harness utility | git file-I/O | same function, lines 206-223 | exact (refactor in place) |
| `features/step_definitions/marketplace/publishing.steps.ts` (new `Given ... tags its current commit {string}`) | step definition | event-driven (cucumber) | same file, `offers these plugins from its own repository:` (:170-195) | exact |
| `features/support/world.ts` (`marketplaceTags`, `recordMarketplaceTag`, tag tokens in `revisionTokens`) | test-harness store | transform | same file, `revisionTokens` (:440-449), `tokens` getter (:408-420), `recordErrorMessage` (:422-436) | exact |
| `features/plugin/install-dependencies.feature` (2 scenarios S1/S2, appended) | behavioral test | request-response | same file, scenario `:7-22` | exact |
| `.agents/skills/cucumber/rules/features.md` (token rule bullet) | doc/config | - | same file, `## Run tokens` bullets :134-135 | exact |
| `test/integration/path-source-tag-install.test.ts` (trim to CR-01 + `.git` guard, new header) | test | file-I/O | header: `test/integration/auth-e2e.test.ts` :1-13 | role-match |
| `07-01-SUMMARY.md` red proofs + case map | planning artifact | - | `.planning/phases/06-hooks-and-auth/06-02-SUMMARY.md` :63-93 | exact |

## Pattern Assignments

### `features/lib/git-marketplace.ts` (utility, git I/O)

**Analog:** same file. Doc comment style plus `runGit(workTree, home, ...)` calls (lines 45-49):
```ts
export async function pushGitRepository(workTree: string, home: string): Promise<void> {
  await runGit(workTree, home, "add", "-A");
  await runGit(workTree, home, "commit", "-q", "--allow-empty", "-m", "publish");
  await runGit(workTree, home, "push", "-q", "--atomic", "origin", "main", "main:stable");
}
```
Append `pushGitTag(workTree, home, tag): Promise<string>` exactly as RESEARCH "The shared builder (validated)": `tag`, `push -q origin refs/tags/<tag>`, return `rev-parse HEAD`. Doc comment ends with "Every git runs with the HOME `home`." like its siblings. Add one sentence about tags to the `@fileoverview` (lines 1-10). Explicit return type required (`explicit-module-boundary-types`).

### `features/lib/git-plugin.ts` (utility, git I/O)

**Analog:** lines 217-219 to replace (the clone fallow dupes would flag):
```ts
  await runGit(workTree, gitHome, "tag", tag);
  const revision = await runGit(workTree, gitHome, "rev-parse", "HEAD");
  await runGit(workTree, gitHome, "push", "-q", "origin", `refs/tags/${tag}`);
```
becomes `const revision = await pushGitTag(workTree, gitHome, tag);`, with `pushGitTag` added to the existing `./git-marketplace.ts` import. Order change (rev-parse after push) is harmless: HEAD is the same commit.

### `features/step_definitions/marketplace/publishing.steps.ts` (step, event-driven)

**Analog:** lines 170-185, a git-kind guarded step:
```ts
Given(
  "the marketplace {string} offers these plugins from its own repository:",
  async function (this: ScenarioWorld, name: string, table: DataTable) {
    const published = this.requirePublished(name);
    if (published.kind !== "url") {
      assert.fail(`the marketplace ${name} is published as a ${published.kind} source, not url`);
    }
    ...
    const commit = await runGit(published.root, published.gitHome, "rev-parse", "HEAD");
```
- New step: RESEARCH "The step (validated)", guard `kind !== "url" && kind !== "github"`, then `pushGitTag(published.root, published.gitHome, tag)`, verify `rev-parse <tag>^{commit}` in `published.bareRepository`, then `this.recordMarketplaceTag(name, tag, commit)`.
- Precede with a `// TAGS-01: ...` comment citing the spec ID (as `// D-SEED-01:` at :170).
- Import order (Pitfall 3): `import { pushGitTag } from "../../lib/git-marketplace.ts";` goes after the `earlier-version-state.ts` import block (:21-25) and before `git-plugin.ts` (:26-30). Not beside `hermetic-git.ts`.
- Update `@fileoverview` (:1-13) with one sentence on the tag step.

### `features/support/world.ts` (store, transform)

**Analog:** `revisionTokens` (lines 440-449):
```ts
  private revisionTokens(noun: string, value: (sha: string) => string): Map<string, string> {
    return new Map(
      [...this.gitRepositories.values()].flatMap((repository) =>
        repository.revisions.map((sha, index): [string, string] => [
          `{${repository.name} ${noun} ${index + 1}}`,
          value(sha),
        ]),
      ),
    );
  }
```
- Add `private readonly marketplaceTags: Array<{ marketplace; tag; commit }>` beside the other private maps (:308-311, e.g. `gitRepositories`).
- Add `recordMarketplaceTag(marketplace, tag, commit): void` with a one-line `/** ... */` doc, styled as `recordPublished` (:613-616); optionally assert no conflicting re-record as `recordErrorMessage` does (:428-433).
- Extend `revisionTokens` so it also emits `{<marketplace> <noun> <tag>}` → `value(commit)`; the `tokens` getter (:417-418) stays unchanged (both `revision` and `commit` nouns pick it up). `run-tokens.ts:114` unknown-token regex already accepts the form; optional doc touch at `run-tokens.ts:45-48`.
- Keep `revisionTokens` under cognitive 15 (two flatMaps concatenated is enough).

### `features/plugin/install-dependencies.feature` (behavioral test)

**Analog:** scenario `:7-22` (same step vocabulary, `kind cascade`, the full 8-column plugin table with `dependency current copy` reason). Append S1 and S2 verbatim from RESEARCH "The scenarios"; untagged (no MCP surface, DUAL-02). Use `is published as a github source` (Pitfall 1: url hash varies per run; github key `1969ce50f054` is stable). Every column of `the result lists these plugins:` must be stated (`field-rows.ts:93-99`). Feature description (:3-5) says "use a local marketplace"; optionally amend to mention a git marketplace for the tag scenarios.

### `.agents/skills/cucumber/rules/features.md` (doc)

**Analog:** lines 134-135:
```
- `{<repository> revision <n>}` is the version of the n-th revision, ...
- `{<repository> commit <n>}` is the full 40-hex commit of the same revision. ...
```
Add a bullet after :135: `{<marketplace> revision <tag>}` / `{<marketplace> commit <tag>}` stand for the commit a marketplace release tag names (step `the marketplace {string} tags its current commit {string}`), example `1.0.0-{tools revision formatter--v1.0.0}`. Keep the :148 constraints (no `<...>`, no `~` in a real token).

### `test/integration/path-source-tag-install.test.ts` (test, trim)

**Header analog:** `test/integration/auth-e2e.test.ts` lines 1-13: `// <path>` line, blank `//`, then prose saying which case stays and why (fault injection / no command shows it), and where the scenarios now live by feature path. Use the validated header in RESEARCH "The trimmed integration file header".
- Keep: `makeCtx` (:54), `buildTaggedMarketplace` (:97), CR-01 test (:243), `buildTwoTagMarketplace` (:328), `.git` guard test (:393).
- Delete: TAGS-01/03 test (:163), `buildNonSatisfyingTagMarketplace` (:456), TAGS-02 test (:524), and `marketplaceGitSnapshot` (:69) only if the kept `.git` test does not use it (RESEARCH Pitfall 6 says delete; verify with tsc `noUnusedLocals`). Drop any import left unused.
- Expected `fallow audit` `weakened-tests` warn (4 -> 2): record in SUMMARY, no config change.

### SUMMARY red proofs (planning artifact)

**Analog:** `.planning/phases/06-hooks-and-auth/06-02-SUMMARY.md` :63-93: `## Red proofs` bullets (scratch folder, `root=` line, plan base, helper `break.sh`, `check-red.mjs` printing `RED-PROOFS OK`), one bullet per break `**B1** (<file>:<line>, -old / +new): N scenarios (x passed, y failed). <scenario :line> failed at \`Then ...\``, then `## Case map` table `| Case at <sha> | Replaced by | Breaks | Commit |`. Breaks B1, B2, B4 (must-fail), B3/B5 informative, from RESEARCH "Deliberate breaks". Failed-scenario match form: `  N) <title> # <file>:<line>`. Add `## Threat Flags` (AGENTS.md) and the BACKLOG parent line for a dir-in-git publication kind.

## Shared Patterns

- **Git in the harness:** always `runGit(dir, home, ...args)` from `features/lib/hermetic-git.ts`; never a second tag+push copy (fallow dupes has no threshold).
- **Step guards:** `this.requirePublished(name)` then `assert.fail(...)` on wrong kind (`publishing.steps.ts:177-180`).
- **Comments:** cite spec IDs (TAGS-01/02/03, CR-01), never phase/plan numbers.
- **Breaks:** in the executor's own worktree via `break.sh`; failures must be on a When/Then.

## No Analog Found

None.

## Metadata

**Analog search scope:** `features/lib`, `features/step_definitions/marketplace`, `features/support`, `features/plugin`, `.agents/skills/cucumber/rules`, `test/integration`, `.planning/phases/06-hooks-and-auth`
**Files scanned:** 10
**Pattern extraction date:** 2026-11-23
