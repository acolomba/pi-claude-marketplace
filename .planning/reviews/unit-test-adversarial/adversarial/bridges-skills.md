# Bridges — skills — adversarial re-review

**Scope:** all 8 production modules under `extensions/pi-claude-marketplace/bridges/skills/` and all 8 test modules under `tests/bridges/skills/`, read in full (5,111 lines). Mutation-tested against the catalogue; every claim below was checked against source or against a throwaway Node probe.
**First-pass file:** `unit-test-findings/bridges-skills.md`
**Clean files attacked:** 9 (7 test + 2 production), plus the 6 production modules whose only recorded finding was the cosmetic JSDoc class
**Existing findings graded:** 10

## Verdict summary

| Metric | Count |
| --- | --- |
| New BLOCKER (missed by first pass) | 5 |
| New WARNING (missed by first pass) | 23 (18 test, 5 production) |
| Existing CONFIRMED | 2 |
| Existing UNDERSTATED | 2 |
| Existing OVERSTATED | 6 |
| Existing REFUTED | 0 |
| Existing DUPLICATE-OF | 0 |

The first pass's "0 blockers, one of the strongest areas" verdict does not hold. The
assertion *style* is genuinely excellent — whole-value `deepStrictEqual`, byte-exact
string compares, independently written expectations, no fragment matching anywhere.
What is missing is **cases**, not assertion strength: three documented security or
correctness contracts in `stage.ts` have literally no case, and two files on the clean
list monkeypatch `String.prototype`.

## New findings — from the clean lists

### `tests/bridges/skills/stage.test.ts`

- **[BLOCKER] The cleanup-only staged arm has no case, so dropping half the noop gate is undetectable** — `stage.ts:180`
  `prepareStageSkills` returns the `noop` variant only when `discovered.length === 0 && previousNames.length === 0`. Mutating that to `discovered.length === 0` makes an update whose upstream plugin dropped all its skills return `noop`; `commitPreparedSkills` then returns immediately at `stage.ts:320` and **the previously installed skill dirs are never removed** — a stale skill survives the update forever. All 9 `previousSkillNames` sites in this file (`775, 840, 1257, 1325, 1411, 1485, 1644, 1794, 1849`) pair the previous names with a non-empty `componentPaths.skills`, so `discovered.length === 0 && previousNames.length > 0` is never constructed and the mutation stays green.
  Add one case under `describe("prepareStageSkills")`: `componentPaths: { skills: [], … }` plus `previousSkillNames: ["acme-gone"]`, asserting `prepared.kind === "staged"`, `assert.deepStrictEqual(prepared.result, { stagedNames: [], recorded: [], warnings: [], degraded: [] })`, `assert.deepStrictEqual(prepared._renamePairs, [])`, `assert.deepStrictEqual(prepared._previousNames, ["acme-gone"])`. Add a matching `commitPreparedSkills` case that plants `<skillsTargetDir>/acme-gone/SKILL.md` first and asserts it is gone afterwards.

- **[BLOCKER] The T-03-15 symlink-escape hardening on `cp` has zero coverage** — `stage.ts:226-232`
  `cp` is called with `dereference: false, verbatimSymlinks: true` and the header at `stage.ts:17-18` states the reason: "a plugin author cannot escape the source tree by planting a symlink." Flipping either option — `dereference: true` or `verbatimSymlinks: false` — makes `cp` resolve a planted symlink and copy the *contents* of whatever it points at into the staged skill. `grep -n symlink tests/bridges/skills/stage.test.ts` returns exactly one planting site (line 653), and it plants the symlink at the **target boundary**, not inside the source tree. Both mutations survive every case in the file.
  Add a case that creates `skills/alpha/SKILL.md` plus `skills/alpha/leak -> <scopeRoot>/secret/` (a directory holding a known file), stages it, and asserts with `lstat` that `<stagingRoot>/acme-alpha/leak` is still a symlink (`isSymbolicLink() === true`) and that `readlink` returns the original target — not that the secret file was copied in. `tests/bridges/skills/discover.test.ts:221-225` is the in-repo template for planting the link.

- **[BLOCKER] The commit/replace containment guards have no case; the sibling file proves the identical guard** — `stage.ts:326, 328, 408, 410`
  `commitPreparedSkills` and `replacePreparedSkills` each run `assertSafeName(name, "previous skill name")` followed by `assertPathInside(skillsTargetDir, dir, "previous skill dir")` over `_previousNames` before any destructive `rm`/`rename`. Every case in this file passes safe names (`"previous"`, `"acme-alpha"`, `"missing"`), so deleting all four calls leaves the suite green — and a corrupt `state.json` carrying `"../../.."` would then be handed straight to `rm(dir, { recursive: true, force: true })`. This is the NFR-10 chokepoint.
  `tests/bridges/skills/unstage.test.ts:113-149` ("rejects an unsafe recorded name before changing the target tree") is the exact case to copy, including its post-assertion that the retained tree and the outside directory are byte-unchanged. Write one for `commitPreparedSkills` and one for `replacePreparedSkills`, each with `previousSkillNames: ["../escape"]`, asserting the thrown `Error` `{ name, message }` deep-equals `{ name: "Error", message: 'previous skill name "../escape" must not contain path separators.' }` and that no staged rename happened.

- **[WARNING] The ENOENT-race arm of the previous-dir removal is untested here but tested in the sibling** — `stage.ts:331-334`
  `commitPreparedSkills` swallows `ENOENT` from `rm` and rethrows anything else. Only the rethrow arm is covered (`stage.test.ts:804-880`, EACCES). `tests/bridges/skills/unstage.test.ts:197-238` covers exactly this shape for `unstage.ts:47-49` by mocking `rm` to throw a synthesized `ENOENT` after delegating to the real `rm`. Copy that mock into a new `commitPreparedSkills` case and assert the commit completes and the staged rename still landed.

- **[WARNING] The documented "a file at `pair.to` should surface ENOTDIR" contract has no case** — `stage.ts:349-357`
  The comment states that only a *directory* at the target is pre-removed and that a file there "is unexpected and should surface as a commit error (ENOTDIR)". Removing the `if (targetStat.isDirectory())` guard (unconditional `rm`) survives every case, because the only stale-target case (`stage.test.ts:735`, `staleDirectory`) plants a directory. Add a case that writes a regular *file* at `<skillsTargetDir>/acme-alpha` and asserts commit rejects with `code === "ENOTDIR"` and the file's bytes are unchanged.

- **[WARNING] `abortPreparedSkills` never returns a leak in any case** — `stage.ts:377-385`
  Both abort cases assert `leak === undefined` (`1126`, `1173-1174`). Mutating the body to `await cleanupStaging(...); return undefined;` — swallowing the leak — survives. The commit-side twin *is* covered (`stage.test.ts:1017-1089`). Add an abort case reusing that file's `rm`-throws-on-`prepared.stagingRoot` mock and assert the exact leak string.

- **[WARNING] `ManualRecoveryError.cause` is dropped without detection** — `stage.ts:444`, case at `stage.test.ts:1440-1558`
  The case asserts `instanceof ManualRecoveryError`, `.message` and `.leaks`, but never `.cause`. Removing `{ cause: err }` from the constructor call survives. `tests/bridges/skills/unstage.test.ts:135-142` and `:172-191` both fold `cause` into their `deepStrictEqual` object — copy that shape. Extend the assertion to `assert.deepStrictEqual({ name, message, leaks, cause: replacementError.cause }, …)` with the originating `Error` identity checked by `assert.strictEqual(replacementError.cause, …)` on the thrown PI-6 error.

- **[WARNING] The documented cap-before-substitution ordering is untested** — `stage.ts:124-134`
  The comment says the 1,536-unit cap is applied *pre*-substitution and gives the reason. Swapping the order (`substituteClaudeVars` then `truncate1536`) survives, because the only substituted-description case (`stage.test.ts:400`, `C:\Users\case\plugin`) is far below the cap and the only capped case (`stage.test.ts:314`, "folded") contains no path variable. Add one case whose authored `description` is 1,530 chars followed by `${CLAUDE_PLUGIN_ROOT}` and assert the exact emitted scalar.

- **[WARNING] Non-string `description` / `when_to_use` frontmatter values are untested** — `stage.ts:117-120`
  `typeof rawDescription === "string" ? … : ""` and the same for `when_to_use` are reachable from author input (`description: 42`, `when_to_use: [a, b]` both parse fine). Replacing either guard with `String(raw…)` survives every case. Add one skill whose source frontmatter carries `description: 42` and assert the staged bytes fall back to the first body paragraph, and one with `when_to_use: 7` asserting nothing is folded.

- **[WARNING] Weak assertions on the staging-dir inventory** — `lines 1281-1286` and `1857-1858`
  `assert.strictEqual(stagingEntries.length, 2)` + `.includes(…)` + `.some(name => name.startsWith("backup-"))` is length-plus-membership where the whole value is the promise; and `assert.notStrictEqual(backupDirectory, undefined)` followed by `backupDirectory ?? "missing"` is precisely the standalone-negative form the rules forbid (it passes for any value, and the `??` then silently substitutes a wrong path). Replace both with a single normalized whole-value compare, e.g. `assert.deepStrictEqual(stagingEntries.map(n => n.replace(/^backup-[0-9a-f-]{36}$/, "backup-<uuid>")).sort(), [path.basename(prepared.stagingRoot), "backup-<uuid>"].sort())`. This weakness is a direct consequence of the un-injected `randomUUID` (see grading of first-pass finding #8).

- **[WARNING] `readdir` compared to an ordered literal without `.sort()`; both sibling bridges sort** — `line 166`
  `assert.deepStrictEqual(stagedTree, ["acme-alpha", "acme-beta"])` assumes `readdir` order. Node returns OS order, which is insertion order on tmpfs but hash order on ext4/overlayfs — a latent CI flake. `tests/bridges/agents/stage.test.ts:2229` and `tests/bridges/commands/stage.test.ts:100` both write `(await readdir(dir)).sort()`. Apply the same here. (Same defect at `tests/bridges/skills/unstage.test.ts:290`.)

- **[WARNING] Third-party YAML error text pinned verbatim** — `lines 287-288` and `546-548`
  `parseFrontmatter` is re-exported from `@earendil-works/pi-coding-agent` (`platform/pi-api.ts:38`), a floating `^0.84.2` dev dependency. Two cases pin its `YAMLParseError` message character-for-character, including the caret-diagram. A patch release of the `yaml` package it wraps breaks both. For the `degraded[].parseError` case the vendored text arguably *is* the user-visible contract, so keep it but add a comment naming the coupling; for `stage.test.ts:546-548` (the PARSE-02 backstop) assert `name === "YAMLParseError"` and that the staging tree was cleaned, and drop the message pin. Same applies to `tests/bridges/skills/rewrite-frontmatter.test.ts:171-173`.

### `tests/bridges/skills/frontmatter-degrade.test.ts` and `tests/bridges/skills/rewrite-frontmatter.test.ts`

- **[BLOCKER] Five cases monkeypatch `String.prototype.split` to reach compiler-forced fallbacks** — `frontmatter-degrade.test.ts:111, 134, 156, 401`; `rewrite-frontmatter.test.ts:125`
  Each case replaces `String.prototype.split` with a function that fabricates a **sparse array** (`lines.length = 4` with holes), because the only way to make `(lines[i] ?? "")` in `firstBodyParagraph`/`setDescriptionScalar`/`rewriteNameNode` take its `?? ""` branch is to feed it an array `split` cannot produce. `String.prototype.split` never returns holes for any input, so these branches are **compiler-forced by `noUncheckedIndexedAccess`** (the D-116-01a category), not reachable behavior. `frontmatter-degrade.test.ts:156-179` goes further and installs an `Object.defineProperty` getter that returns a *different value on each read* to reach the same fallback twice.
  Three separate rules are broken: modifying a built-in prototype (Google style classifies this BLOCKER), the hermeticity rule on process-global mutation, and the rule that a case must discriminate the behavior in its title — "treats sparse split entries inside a fence as blank lines" names an input the production function cannot receive.
  Aggravating factor unique to `rewrite-frontmatter.test.ts:125`: the patch is still installed when `rewriteFrontmatterName` calls the **third-party** `parseFrontmatter` at `rewrite-frontmatter.ts:78`, and the replacement returns `[this]` for every string that misses its guard. The case's green result depends on an external package's internals not calling `String.prototype.split` — a dependency upgrade can turn it red for reasons unrelated to the code under test.
  Delete all five cases. They are not coverage of behavior; they are coverage of a type-system artifact. This lands in the same operator decision META-FINDINGS already opened (see "Meta-findings impact" — its file list is incomplete).

- **[WARNING] The ATX-heading boundary in `firstBodyParagraph` is untested** — `frontmatter-degrade.ts:100`
  The regex is `/^#{1,6}(\s|$)/`. Dropping the `(\s|$)` group (so `#hashtag prose` is treated as a heading and skipped) survives every row in the `firstBodyParagraph` table — no row starts a line with `#` immediately followed by a non-space. Likewise `#######` (seven hashes, not a heading) is untested and a mutation to `/^#+/` survives. Add two rows: `body: "#hashtag opener\n"` expecting `"#hashtag opener"`, and `body: "####### seven\n"` expecting `"####### seven"`.

### `tests/bridges/skills/discover.test.ts`

- **[BLOCKER] A symlinked `SKILL.md` is never planted, so `lstat` → `stat` is undetectable** — `discover.ts:47-50`
  `hasRegularSkillFile` uses `lstat` specifically so a `SKILL.md` that is a *symlink* does not qualify. Every case in the file plants a real regular `SKILL.md`; the only symlink planted (`discover.test.ts:221-225`) is the skill *directory*. Changing `lstat` to `stat` in `hasRegularSkillFile` therefore survives — and would make `skills/foo/SKILL.md -> /etc/passwd` a discoverable skill whose contents `stage.ts` then copies into the install tree.
  Add a row to the filter case: a `linked-document/` directory whose `SKILL.md` is a symlink to a real skill document elsewhere in the plugin root, and assert `linked-document` is absent from `discovered`.

- **[WARNING] `Object.freeze` on the returned arrays is asserted nowhere** — `discover.ts:205-206`
  `deepStrictEqual` does not compare frozen-ness, so removing both `Object.freeze` calls survives. `tests/bridges/skills/unstage.test.ts:64-65` asserts `Object.isFrozen` on both result arrays, and `stage.test.ts:1597, 1755, 1901` does so for `leaks` — this file and the `prepareStageSkills` result assertions are the only ones that skip it. Add `assert.strictEqual(Object.isFrozen(discovery.discovered), true)` (and `.warnings`) to one case here, and the equivalent for `prepared.result.stagedNames`/`recorded`/`warnings`/`degraded` and `prepared._renamePairs`/`_previousNames` in one `stage.test.ts` case.

- **[WARNING] Both `assertSafeName` throw arms are unreachable from any case** — `discover.ts:112` and `discover.ts:182`
  A POSIX directory name may legally contain `\` or a control character, both of which `assertSafeName` rejects (`domain/name.ts:40-50`). No case plants such a name, so deleting either call survives. This is a *reachable-untested* branch, and the behavior it implies (one hostile directory name hard-fails discovery for the whole plugin, contradicting the ENOENT-graceful posture of SK-5) has never been ratified by a test. Add one case with a `mkdir` of a name containing `\` and assert the thrown `{ name, message }`, or — if the intended behavior is a skip — record that instead.

- **[WARNING] The `chmod(…, 0o000)` "opaque" row proves nothing when the suite runs as root** — `lines 200-208`
  The row exists to show discovery is metadata-only, but discovery never opens `SKILL.md`, so the case passes identically whether or not the `chmod` took effect — and as root it does not. Either drop the `chmod` (the row's real content is that a plain skill dir is discovered, already covered by `visible`) or move the "does not read content" claim to an assertion that can fail, e.g. a `t.mock.method(filesystemPromises, "readFile", …)` that throws.

### `tests/bridges/skills/unstage.test.ts`

- **[WARNING] The only file in the test tree that reaches the `node:fs/promises` mock target through a default import** — `line 2`
  `import filesystemPromises, { … } from "node:fs/promises"` diverges from the house form used by its own directory sibling (`tests/bridges/skills/stage.test.ts:22-24`) and by every other file that mocks a builtin: `createRequire(import.meta.url)("node:fs/promises") as typeof import("node:fs/promises")` (`tests/bridges/commands/discover.test.ts:657`, `tests/orchestrators/plugin/reinstall.test.ts:337`, `tests/orchestrators/plugin/scope-tree-inventory.ts:17`). It works today because the two objects are identical in Node, but it is the sole outlier. Switch to the `createRequire` form.

- **[WARNING] `readdir` compared to a two-element ordered literal** — `line 290`
  `assert.deepStrictEqual(await readdir(locations.skillsTargetDir), ["acme-blocked", "other-keep"])`. Same defect and same fix as `stage.test.ts:166`: append `.sort()`.

### `tests/bridges/skills/types.test.ts`

- **[WARNING] Six `undefined!` assertions bypass the `ScopedLocations` brand instead of proving it** — `lines 25, 30, 70, 100, 130, 160, 213`
  Every fixture fills `locations` and `resolved` with `undefined!`. That is a non-null assertion with no stated reason (Google style: `!` only with an obvious or commented reason) and, more importantly, it is a missed opportunity: `persistence/locations.ts` carries a unique-symbol brand whose whole purpose is to reject a hand-built literal, and META-FINDINGS records that the brand is **never proven anywhere in the suite**. This file is the natural owner. Add `// @ts-expect-error a hand-built literal cannot satisfy the ScopedLocations brand` over a `const locations: ScopedLocations = { skillsTargetDir: "/x", skillsStagingDir: "/y", scope: "project" }` and keep the `undefined!` fixtures only where the brand is not the point (annotating each with a one-line reason comment).

- **[WARNING] `DiscoverPluginSkillsResult` is the one skills-bridge type with no owning case** — `discover.ts:42-45`
  Every other type in this bridge lives in `types.ts` and gets a positive `satisfies` fixture plus a `@ts-expect-error` negative in `types.test.ts`. `DiscoverPluginSkillsResult` is declared in `discover.ts` instead, is referenced nowhere outside its own module (`grep -rn DiscoverPluginSkillsResult extensions/` returns only its declaration), and has no `satisfies` owner. Either move it into `types.ts` and give it the same fixture/negative pair the other twelve types have, or add the pair to `discover.test.ts`.

### `tests/bridges/skills/index.test.ts`

- **[WARNING] `finalizeSkillsReplacement` has no unknown-handle case, unlike `rollbackSkillsReplacement`** — `stage.ts:485`
  Both functions call `requireSkillsReplacementInternals`, but only the rollback path has the cloned-handle case (`stage.test.ts:1665-1716`). Reaching the same throw through `finalizeSkillsReplacement` costs four lines and closes the pair. (Filed here because the barrel test is where the export symmetry is otherwise proved; the case itself belongs in `stage.test.ts`'s `describe("finalizeSkillsReplacement")`.)

## Production code findings (new)

### `extensions/pi-claude-marketplace/bridges/skills/discover.ts`

- **[WARNING] The comment justifying the `lstat` guard states a filesystem fact that is false, and a sibling module states the opposite correctly** — `lines 172-175`
  > `readdir`'s `withFileTypes` reports the link's TYPE (so a symlink to a directory shows isDirectory()=true). lstat is the only way to detect the link itself.

  `shared/fs-utils.ts:293-299` says the opposite and is right:
  > `readdir`'s `withFileTypes` does NOT report a symlink's target type: Node resolves a `UV_DIRENT_UNKNOWN` d_type through `lstat` before it constructs the `Dirent`, so a symlink to a directory answers `isSymbolicLink() === true` and `isDirectory() === false` on every filesystem.

  Verified by probe: a symlink-to-directory dirent reports `isDirectory()=false, isSymbolicLink()=true`. The consequence is that `entry.isDirectory()` at `discover.ts:53` already excludes symlinks, and the extra `lstat` at `58-59` is a TOCTOU-race guard, not the primary defense the comment claims. Rewrite the comment to say what the guard actually buys (closing the readdir→open race), and cite `shared/fs-utils.ts` as the authority rather than restating the fact a third time.

- **[WARNING] `!skillStat.isSymbolicLink()` is unreachable dead code** — `line 49`
  `lstat().isFile()` and `.isSymbolicLink()` are mutually exclusive (probe-confirmed), so the conjunct can never be `false` when `isFile() === true`. This is category (b) — unreachable by real input, not compiler-forced — and is safe to delete. The symlink refusal it is meant to express is already carried by `isFile()` being false for a link; say so in the comment.

- **[WARNING] `localeCompare` makes discovery order environment-dependent despite the "deterministic ordering" claim** — `line 167`, claim at `line 6`
  `a.name.localeCompare(b.name)` with no locale argument resolves against the process locale / ICU build. Probe: `["acme-foo","acme_foo","Zeta","alpha"]` sorts as `acme_foo, acme-foo, alpha, Zeta` under `localeCompare` and `Zeta, acme-foo, acme_foo, alpha` by code unit; a Swedish locale reorders `ä` relative to `z`. Source directory names are only constrained by `assertSafeName`, which permits uppercase, underscores, and non-ASCII — so `stagedNames` recorded into `state.json`, and in adversarial cases the first-wins dedup winner, can differ between machines. (Names restricted to `[a-z0-9-]` do agree, which is why no test catches it.) Replace with a fixed comparator — `(a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0)` or a module-level `new Intl.Collator("en", { sensitivity: "variant" })` — and add a case whose source dirs are `["Zeta", "alpha", "acme_foo", "acme-foo"]`.

### `extensions/pi-claude-marketplace/bridges/skills/stage.ts`

- **[WARNING] The noop arm's `warnings` spread is provably always empty and its comment claims otherwise** — `lines 177-179, 186`
  > D-07: discoverWarnings still surface even on noop -- a duplicate generated name across array elements is observable.

  `discover.ts:191-193` pushes a warning only when `seenByGenerated.get(generatedName)` returns a winner, which requires the map to be non-empty, which means `discovered.length > 0`. So `discovered.length === 0` implies `discoverWarnings.length === 0`, and `Object.freeze([...discoverWarnings])` on the noop arm can only ever be `[]` — as the test at `stage.test.ts:82-85` asserts. Delete the comment's claim (or the spread), and if the observability it describes is actually wanted, that is a `discover.ts` change, not a `stage.ts` one.

- **[WARNING] Two more plain-`Error`-with-structured-data-in-the-message sites, beyond the one the first pass logged** — `lines 435, 498`
  `throw new Error(\`Cannot replace skill target with non-previous content at ${pair.to}\`)` and `throw new Error("Unknown skills replacement handle.")`. Same convention breach as the SKILL-03 backstop the first pass recorded for `rewrite-frontmatter.ts:80-83`: `CONVENTIONS.md` requires typed subclasses carrying readonly structured fields, and the tests are consequently forced to assert composed message text (`stage.test.ts:1414-1434`, `1546-1549`, `1709-1712`). Fix all three together — one `SkillsBridgeError` family with `targetPath` / `producedName` / `expectedName` fields — rather than the single site the first pass named.

## Export ownership census

| Module | Export | Owning case | Status |
| --- | --- | --- | --- |
| `discover.ts` | `discoverPluginSkills` | `discover.test.ts:32-406` (10 cases) | owned |
| `discover.ts` | `DiscoverPluginSkillsResult` | — | NO CASE (type has no `satisfies` owner; see WARNING above) |
| `frontmatter-scan.ts` | `frontmatterBlockEnd` | `frontmatter-scan.test.ts:9-68` | owned |
| `frontmatter-scan.ts` | `keyValueEnd` | `frontmatter-scan.test.ts:70-179` | owned |
| `frontmatter-degrade.ts` | `synthesizeUnparseableSkill` | `frontmatter-degrade.test.ts:12-49` | owned |
| `frontmatter-degrade.ts` | `firstBodyParagraph` | `frontmatter-degrade.test.ts:51-180` | owned |
| `frontmatter-degrade.ts` | `foldWhenToUse` | `frontmatter-degrade.test.ts:182-221` | owned |
| `frontmatter-degrade.ts` | `truncate1536` | `frontmatter-degrade.test.ts:223-267` | owned |
| `frontmatter-degrade.ts` | `setDescriptionScalar` | `frontmatter-degrade.test.ts:269-420` | owned |
| `rewrite-frontmatter.ts` | `rewriteFrontmatterName` | `rewrite-frontmatter.test.ts:6-197` | owned |
| `stage.ts` | `prepareStageSkills` | `stage.test.ts:47-694` (10 cases) | owned, gate branch uncovered |
| `stage.ts` | `commitPreparedSkills` | `stage.test.ts:696-1090` (6 cases) | owned, 3 branches uncovered |
| `stage.ts` | `abortPreparedSkills` | `stage.test.ts:1092-1178` (2 cases) | owned, leak path uncovered |
| `stage.ts` | `replacePreparedSkills` | `stage.test.ts:1180-1559` (5 cases) | owned, name guards uncovered |
| `stage.ts` | `rollbackSkillsReplacement` | `stage.test.ts:1561-1717` (3 cases) | owned |
| `stage.ts` | `finalizeSkillsReplacement` | `stage.test.ts:1719-1903` (3 cases) | owned, unknown-handle arm uncovered |
| `unstage.ts` | `unstagePluginSkills` | `unstage.test.ts:37-299` (7 cases) | owned |
| `index.ts` | 8 runtime re-exports | `index.test.ts:87-189` + the `SkillsRuntimeExport` key-set `satisfies` at `:53-63` | owned — the key-set check makes an added or dropped barrel export a **compile** error |
| `index.ts` | `PreparedSkillsStaging`, `SkillsReplacement` (type) | `index.test.ts:43-85` | owned |
| `types.ts` | 12 interfaces/type aliases | `types.test.ts` (positive fixture + `@ts-expect-error` negative each) | owned |

No production module in this area lacks a paired test module; pairing is 1:1 in both directions.

## Branch census

**(a) Reachable and untested — findings above**

- `stage.ts:180` noop gate, `previousNames.length > 0` half — BLOCKER.
- `stage.ts:226-232` `cp` symlink options — BLOCKER.
- `stage.ts:326/328/408/410` name + containment guards — BLOCKER.
- `discover.ts:47-48` `lstat`-vs-`stat` on `SKILL.md` — BLOCKER.
- `stage.ts:331-334` ENOENT swallow arm; `stage.ts:349-357` file-at-target arm; `stage.ts:384` abort leak return; `stage.ts:117-120` non-string `description`/`when_to_use`; `stage.ts:131-134` cap ordering; `stage.ts:485` unknown-handle arm; `discover.ts:112, 182` `assertSafeName` throws; `frontmatter-degrade.ts:100` heading-boundary group — WARNINGs.
- `rewrite-frontmatter.ts:69` `!content.startsWith("---")` reached through `prepareStageSkills`: a source `SKILL.md` with **no frontmatter at all** is never staged end-to-end (the closest case, `stage.test.ts:400`, has a `---` block). `rewrite-frontmatter.test.ts:91-95` owns the unit behavior, so this is a low-priority integration gap only.

**(b) Unreachable by real input — production dead code, not test gaps**

- `discover.ts:49` `!skillStat.isSymbolicLink()` — mutually exclusive with `isFile()`; deletable.
- `stage.ts:186` noop-arm `warnings` spread — provably always `[]`.
- `stage.ts:203` `assertSafeName(skill.generatedName, …)` — `generatedSkillName` already asserts the same value (`domain/name.ts:75`).
- `stage.ts:194, 206, 401, 416` `assertPathInside` calls whose arguments are composed from a `randomUUID` or an already-asserted safe name — reachable only if the staging root itself is a symlink.
- `stage.ts:81` `indexOf("\n---", 3)` returning `-1` — the function is called only on the gate-1 throw arm, where a closed block exists by construction (as its own doc comment states).
- `stage.ts:228-231` `errorOnExist: true, force: false` — documented as belt-and-braces behind a fresh UUID dir.

**(c) Compiler-forced and not removable (D-116-01a)**

- `frontmatter-degrade.ts:68, 78, 97`, `frontmatter-scan.ts:15, 48`, `rewrite-frontmatter.ts:36`, `setDescriptionScalar` `182` — every `(lines[i] ?? "")`. `tsconfig.json` sets `noUncheckedIndexedAccess`, and `!` / `as` are unavailable inside `extensions/`. These are exactly the branches the five `String.prototype.split` cases exist to reach; the correct disposition is to leave the branches and **delete the cases**, not to keep manufacturing sparse arrays.

## Grading of first-pass findings

### `tests/bridges/skills/stage.test.ts`

- **CONFIRMED** — Duplicated `ResolvedPluginInstallable` arrange literal across 29 tests — `grep -c 'satisfies ResolvedPluginInstallable'` returns exactly 29, and `discover.test.ts:17-30` is a working in-file factory for the same type. The named fix is correct.

### `extensions/pi-claude-marketplace/bridges/skills/rewrite-frontmatter.ts`

- **UNDERSTATED** — SKILL-03 backstop throws a plain `Error` with structured data in the message. Real and correctly reasoned, but scoped to one of three sites: `stage.ts:435` and `stage.ts:498` have the identical shape and force the same message-text assertions at `stage.test.ts:1414-1434`, `1546-1549` and `1709-1712`. Should be one grouped finding covering all three, so the typed-error family is designed once.

### `extensions/pi-claude-marketplace/bridges/skills/stage.ts`

- **UNDERSTATED** — Inline `randomUUID()` is a hidden, un-injected dependency. Severity (WARNING) is right, but the recorded rationale — "this does not currently block or weaken any test" — is false. It is the direct cause of the two weakest assertions in the whole area: `stage.test.ts:1281-1286` (`length` + `includes` + `some` instead of a whole-value compare) and `stage.test.ts:1854-1858` (`readdir(...).find(startsWith("backup-"))` guarded by `assert.notStrictEqual(..., undefined)` and then `?? "missing"`). Injecting `generateId` removes both weaknesses, which raises the fix's value well above "forward-looking design note".
- **CONFIRMED** — `type` alias of an object literal where `interface` belongs (`SkillsReplacementInternals`, `line 55`). The rule is literal and the rewrite is mechanical. Weakest of the confirmed set: `Readonly<{…}>` is a mapped-type composition, so a reviewer could reasonably read it as outside the "type alias of an object literal" prohibition. Fix it, but do not prioritise it.

### The six JSDoc verb-phrase findings (`discover.ts:130`, `frontmatter-degrade.ts:41…158`, `frontmatter-scan.ts:12, 24`, `rewrite-frontmatter.ts:23, 52`, `stage.ts:67…388`, `unstage.ts:17`)

- **OVERSTATED** (all six) — The rule is real, but this is not a skills-bridge deviation: it is the repo's house style. Sampling `bridges/agents/*.ts`, `shared/fs-utils.ts` and `domain/name.ts` returns the same imperative/noun-phrase openings throughout ("Best-effort recursive removal of…", "TR-06: Pre-remove an orphan…", "Escape regex metacharacters so…", "AG-6: parse simple `key: value` frontmatter…"). The area file's own summary already calls it cross-cutting, yet still emitted it as six separate per-file findings — which is what made a file carrying five undetected BLOCKERs read as "one of the strongest areas in the codebase". Collapse to a single repo-wide note and drop the six.

## Still clean after attack

These are the mutations the cases genuinely catch — do not spend fixing-pass time here.

- `tests/bridges/skills/index.test.ts` — the strongest barrel test I have seen in this repo. `SkillsRuntimeExport satisfies <explicit 8-member union>` (`:53-63`) turns adding, removing, or renaming a barrel export into a **compile** error, and each `assert.strictEqual(barrelBinding, definingBinding)` catches a re-export rewired to a different function. I tried: swapping two re-exports, dropping one, re-exporting from the wrong module — all three fail.
- `tests/bridges/skills/frontmatter-scan.test.ts` — catches every off-by-one I tried on `keyValueEnd`: `i = keyIndex` instead of `keyIndex + 1`, `i <= blockEnd`, `return lastReplaced + 1`, absorbing trailing blanks, and dropping the `/^\s/` continuation test. Also covers negative `keyIndex` and `keyIndex > blockEnd`.
- `tests/bridges/skills/frontmatter-degrade.test.ts` (the non-prototype 30 rows) — catches all three `truncate1536` boundary mutations (`<`, `<=`, `slice(0, 1535)`), the surrogate-pair split at the cap, and — notably — the **escape ordering** in `emitSafeDoubleQuotedScalar`: swapping backslash-first to quote-first turns `\"` into `\\"` and the `line 361` case fails. `setDescriptionScalar`'s five multi-line-scalar forms each fail under a naive `^description:.*$` line replace.
- `tests/bridges/skills/rewrite-frontmatter.test.ts` (the non-prototype 13 rows) — catches every node-span mutation: replacing only the key line orphans continuations in five different scalar forms; inserting `name:` last instead of first fails; the CRLF row pins that untouched bytes keep their `\r`; the SKILL-03 verify fires on a name the parser coerces (`"42"`), on an injected sibling field, and on a name that makes the re-parse throw.
- `tests/bridges/skills/discover.test.ts` — whole-`{discovered, warnings}` `deepStrictEqual` in all 10 cases. Catches reversing the sort, dropping the hidden-file filter, dropping the `isDirectory` filter, following a symlinked skill dir, accepting a directory named `SKILL.md`, both self-skill-dir precedence directions, and both collision-warning texts character-for-character.
- `tests/bridges/skills/unstage.test.ts` — catches `removedNames` reporting attempted-instead-of-actual work, the ENOENT race, the EACCES propagation with exact partial filesystem state, the unsafe-name rejection **with** its post-state, and the symlink refusal with all five `SymlinkRefusedError` structured fields plus `cause`.
- `tests/bridges/skills/types.test.ts` — 22 `@ts-expect-error` negatives including readonly-array proofs and both discriminated-union cross-products (`{kind:"replaced", prepared: noop}` and `{kind:"noop", prepared: staged}`). Zero runtime assertions, which is the correct shape for a type-only module.
- `tests/bridges/skills/stage.test.ts` byte-exactness — every staged-content assertion compares the complete file (`Buffer` compare at `:167`, full-string compare at `:311, 394-396, 447, 515, 797, 1087`). No test in this area re-parses emitted frontmatter, normalizes it, or calls a production emitter to build its expected value; the first pass's claim on this point is fully upheld.
- No `test.only` / `test.skip` / `test.todo`, no `as any`, no `: any`, no bare `assert.ok(x)` content check, no unawaited `assert.rejects`, no `before()` hook, no module-scope mutable state, and every `mkdtemp` in all 8 files is registered for removal with `t.after`.
- `process.env.PI_CODING_AGENT_DIR` at `stage.test.ts:455-463` saves the previous value and registers restoration **before** mutating — the exact form the rules prescribe.

## Not covered

- I did not run any test, coverage, or lint command (brief prohibits it). Every coverage statement here is derived by reading plus the two read-only Node probes described inline; direct per-pair coverage remains unmeasured, as META-FINDINGS already records.
- I did not read `shared/fs-utils.ts`, `shared/vars.ts`, `shared/path-safety.ts`, `domain/name.ts`, or `persistence/locations.ts` in full — only the specific functions the skills bridge calls. Findings about `cleanupStaging`, `rollbackReplacementCommon`, `removeOrphanIfPresent`, `substituteClaudeVars` and `assertPathInside` belong to those modules' own areas; the skills tests exercise them incidentally, which is correct.
- I did not verify whether `@earendil-works/pi-coding-agent`'s `parseFrontmatter` actually calls `String.prototype.split`. The finding stands on the fragility of depending on that answer, not on a particular answer.
- `tests/integration/`, `tests/e2e/`, `tests/live-uat/` are out of scope and were not read, so I cannot say whether the uncovered `stage.ts` branches are exercised there.

## Meta-findings impact

### New cross-cutting evidence

**1. The prototype-surgery file list in META-FINDINGS is incomplete, and two of the missing files were on a "clean" list.**
META-FINDINGS names five files (`bridges/commands/{stage,discover}.test.ts`, `bridges/hooks/if-field/{bash,glob}.test.ts`, `orchestrators/marketplace/remove.test.ts`). A repo-wide grep for `.prototype` / `Symbol.hasInstance` / `Object.defineProperty` across the unit suite returns a materially larger set, including:

- `tests/bridges/skills/frontmatter-degrade.test.ts:111, 134, 156, 401` — `String.prototype.split` (declared clean by the first pass)
- `tests/bridges/skills/rewrite-frontmatter.test.ts:125` — `String.prototype.split` (declared clean by the first pass)
- `tests/bridges/hooks/if-field/index.test.ts:376-431` — `String.prototype.endsWith` **and** `RegExp.prototype.exec`
- `tests/bridges/agents/frontmatter.test.ts:281-291` — installs a property on `Object.prototype` (prototype *pollution*, not just replacement)
- `tests/shared/notify.test.ts:6250` — `String.prototype.lastIndexOf`
- `tests/edge/completions/normalize.test.ts` — same family
- `tests/orchestrators/marketplace/add.test.ts:1503, 1561` — `Symbol.hasInstance` returning a rotating prototype

The operator decision META-FINDINGS opened as item 1 under "Decisions the fixing pass cannot make" should be re-scoped against this larger list before it is priced. **Re-run the grep as the authoritative inventory rather than the five-file list.** Also worth noting: in the skills instances the branch being reached is provably compiler-forced by `noUncheckedIndexedAccess`, not defensive production code — which resolves the "two readings" META-FINDINGS poses, at least for this subclass. There is nothing to delete in production; the cases are simply chasing a type-system artifact.

**2. "Clean" verdicts correlate with a reviewer having found only cosmetic findings.**
In this area six of ten first-pass findings were one repo-wide JSDoc register issue, spread across six files to look per-file. The reviewer that produced them missed five BLOCKERs — including a case gap that lets a stale skill survive every update and a security mitigation with zero coverage. **Where an area file's findings are dominated by a single cosmetic class, treat its clean list as unreviewed rather than merely unverified.** Areas worth re-checking on this signal: any first-pass file whose findings are ≥50% documentation-register or naming.

**3. A named, documented hardening option is a coverage blind spot the assertion-quality lens does not see.**
`cp(..., { dereference: false, verbatimSymlinks: true })` carries a requirement ID (T-03-15) and a written threat model, and no test touches it. This is invisible to a reviewer scanning for weak assertions, because the assertions present are excellent — the defect is a missing *input*, not a weak *check*. Other bridges call `cp`/`copyFile` with the same hardening: **`bridges/agents/stage.ts` and `bridges/commands/stage.ts` should be checked for the same blind spot**, along with every other option-flag-encoded mitigation (`errorOnExist`, `force`, `withFileTypes`, `recursive`).

**4. Two comments in the same codebase state opposite filesystem facts.**
`bridges/skills/discover.ts:172-175` and `shared/fs-utils.ts:293-299` directly contradict each other about `readdir({withFileTypes:true})` and symlinks; the probe settles it in `fs-utils`'s favour. This is a new instance of META-FINDINGS' "doc comments cut both ways" observation, and a sharper one: not a comment that overclaims a symbol's status, but a comment that would mislead a future editor into deleting the guard that actually works. Worth a targeted sweep for restated filesystem/API facts that should instead cite the one module that owns them.

### Corrections to META-FINDINGS.md

- **"Decisions … 1. Unreachable branches and prototype surgery. Four test files monkeypatch global prototypes …"** — the count and the list are both wrong; see item 1 above. At minimum eight unit-test files do this, and the two in `tests/bridges/skills/` were reported clean. Correction: replace the enumerated list with the grep, and record that for the `bridges/skills` instances the branch is compiler-forced (`noUncheckedIndexedAccess`), not defensive production code, so the "delete the dead branch" reading is unavailable there.
- **`bridges-skills.md`'s "there are no BLOCKER findings in this area"** — refuted. Five, listed above. The area should be moved out of the "healthy" bucket in any planning rollup derived from the first pass.
- **"Ranked by leverage" item 3 ("Replace fragment assertions on rendered messages")** — this area is a clean counter-example and should be cited as such: `tests/bridges/skills/` contains **zero** `.includes()` / `.startsWith()` / partial-regex content checks. Every rendered-byte assertion is a whole-value compare. If the fixing pass wants a second reference implementation alongside `*.messaging.test.ts`, `tests/bridges/skills/frontmatter-degrade.test.ts` and `rewrite-frontmatter.test.ts` are it — they compare complete multi-line documents byte-for-byte across 30+ rows.

### Confirmations

- **"Clean verdicts are not reliable"** (Provenance) — independently confirmed, and strongly. Seven of the nine clean-listed files in this area carry findings; two carry BLOCKERs.
- **"Gates that do not gate", item 5 — "The `ScopedLocations` brand is never proven"** — confirmed from a second angle. `tests/bridges/skills/types.test.ts` is a fixture-heavy type-only test that would be the natural home for the negative and instead writes `locations: undefined!` seven times, sidestepping the brand rather than exercising it. Same at `stage.test.ts` and `unstage.test.ts`, which obtain real `ScopedLocations` from `locationsFor(...)` and so never test the rejection either.
- **"The dominant shape: sibling drift"** — confirmed with four fresh instances inside a single directory: `unstage.test.ts` asserts `Object.isFrozen` and `error.cause` where `discover.test.ts` and `stage.test.ts` do not; `unstage.test.ts` covers the ENOENT race arm where `stage.test.ts` does not for the identical guard; `unstage.test.ts` alone reaches the fs mock through a default import where `stage.test.ts:22` and seven other files use `createRequire`; and `tests/bridges/{agents,commands}/stage.test.ts` sort `readdir` output where both skills files do not. In every case the correct form already exists within one or two directories — propagation, not invention, exactly as META-FINDINGS predicts.
- **"Reviewing production alongside tests was worth it"** — confirmed. Four of this pass's production findings (the contradicting comment, the dead `isSymbolicLink` conjunct, the provably-empty noop `warnings`, and the locale-dependent sort) are invisible from the test side, and the locale one is a genuine cross-machine determinism defect.
