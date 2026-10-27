---
quick_id: 261027-cyg
description: answer an installed copy with no manifest (or a gone copy) from its marketplace entry alone; choose a record's owning root by where its copy lies, so a stale-sha path record reads its marketplace clone again
date: 2026-10-27
mode: quick
phase: quick-261027-cyg
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - extensions/pi-claude-marketplace/orchestrators/plugin/dependency-index.ts
  - test/orchestrators/plugin/dependency-index.test.ts
  - features/lib/git-plugin.ts
  - features/step_definitions/plugin/publishing.steps.ts
  - features/plugin/enable.feature
  - extensions/pi-claude-marketplace/orchestrators/plugin/dependency-declaration-read.ts
  - test/orchestrators/plugin/dependency-declaration-read.test.ts
  - test/orchestrators/reconcile/convergence.test.ts
  - test/orchestrators/plugin/update-swap.test.ts
  - .planning/phases/02-apply-ordering-and-installed-declarations/02-CONTEXT.md
  - .planning/phases/02-apply-ordering-and-installed-declarations/02-02-SUMMARY.md
  - .planning/phases/02-apply-ordering-and-installed-declarations/02-04-SUMMARY.md
autonomous: true
requirements: [RCN-05, RCN-08]

estimate:
  tokens: 110000
  raw_tokens: 110000
  tasks: 3
  confidence: low

must_haves:
  truths:
    - "When readInstalledRecordDeclarations reads a record that has resolvedSha and its installed copy answers absent (the copy is gone, or holds no manifest), the record's declarations are its marketplace entry's `dependencies` alone, parsed as the catalog read parses an entry; the catalog copy's own manifest is never read (D-PL2-22)"
    - "A delisted record whose installed copy answers absent still fails closed as `not in manifest` with the existing cause line (D-05-07); a record without resolvedSha still answers exactly what the catalog read answers (D-PL2-07)"
    - "/claude:plugin enable of a git-source plugin whose installed copy has no manifest enables the dependency its marketplace entry declares, not the one the warm catalog copy of a newer revision declares; the enable.feature scenario fails on the pre-change source"
    - "installedCopyReadOptions gives every record exactly one owning root: plugin-clones/ with the plugin-directory boundary only when the record has resolvedSha AND its resolvedSource lies under plugin-clones/; every other record owns its marketplace clone with the plugin-and-marketplace-directory boundary (D-PL2-23, amends D-PL2-12)"
    - "A path record that an older version left with a stale resolvedSha and its files in its marketplace clone is read in place there: the installed detail walk (the update holder walk), the enable closure read, the delisted catalog-first read and convergence no longer fail its scope as unreadable, and an update repairs the record (WR-01)"
    - "A real containment escape still answers `unusable`: a copy under neither clone root, a symlinked segment below the owning root, or a manifest link that leaves the D-PL2-17 boundary; a record without resolvedSha whose copy sits under plugin-clones/ still fails closed"
    - "02-CONTEXT.md records D-PL2-22, D-PL2-23 and the E2 refinement by adding lines only; 02-02-SUMMARY uncertain choices 2, 3 and 4 read as resolved; the 02-04-SUMMARY D-PL2-12 row notes the resolution of 261027-a3r uncertain choice 1"
    - "npm run check exits 0 on the final tree"
  artifacts:
    - path: extensions/pi-claude-marketplace/orchestrators/plugin/dependency-index.ts
      provides: "readInstalledRecordDeclarations with the entry-alone answer for an absent copy"
      contains: "D-PL2-22"
    - path: extensions/pi-claude-marketplace/orchestrators/plugin/dependency-declaration-read.ts
      provides: "installedCopyReadOptions choosing the owning root by resolvedSha and where resolvedSource lies"
      contains: "D-PL2-23"
    - path: features/plugin/enable.feature
      provides: "the D-PL2-22 enable scenario over a git copy with no manifest"
      contains: "no manifest"
    - path: .planning/phases/02-apply-ordering-and-installed-declarations/02-CONTEXT.md
      provides: "D-PL2-22 and D-PL2-23, the E2 refinement, pointers on D-PL2-06 and D-PL2-12"
      contains: "D-PL2-23"
  key_links:
    - from: "enableCascadeLookup (orchestrators/plugin/enable-disable.ts)"
      to: "readInstalledRecordDeclarations"
      via: "unchanged call; the absent arm now answers the entry alone"
      pattern: "readInstalledRecordDeclarations"
    - from: "REAL_UPDATE_CONSTRAINT_SEAM (orchestrators/plugin/update-constraint-gate.ts)"
      to: "buildInstalledScopeDeclarationDetail"
      via: "unchanged seam; each record read through readInstalledRecordDeclarations"
      pattern: "buildInstalledScopeDeclarationDetail"
    - from: "readInstalledRecordDeclarations, readInstalledCopy (dependency-index.ts) and installedCopyDeclarations (reconcile/convergence.ts)"
      to: "installedCopyReadOptions"
      via: "every installed-copy read takes its boundary and owning root from this one helper"
      pattern: "installedCopyReadOptions"
---

<objective>
Two user decisions (2026-10-27) on `features/plugin-lifecycle-p2`, follow-ups to quick tasks
261027-92s and 261027-a3r in the installed-copy dependency read:

1. **D-PL2-22 (decision 2.15).** When `readInstalledRecordDeclarations` finds no manifest in a
   pinned record's installed copy, or finds the copy gone, it answers from the marketplace entry
   alone, as Claude Code does when the copy it loads has no `plugin.json`. Today it runs the whole
   catalog read: the catalog copy's own manifest first, then the entry. A delisted record (no
   entry) keeps the D-05-07 `not in manifest` failure.
2. **D-PL2-23 (decision 2.17, amends D-PL2-12).** `installedCopyReadOptions` chooses the owning
   root by where the record's copy lies, not by `resolvedSha` alone. `plugin-clones/` owns a
   record only when it has `resolvedSha` and its `resolvedSource` lies under `plugin-clones/`.
   Every other record owns its marketplace clone, the root NFR-10 names for path sources. This
   folds in 261027-a3r uncertain choice 1: a path record that an older version left with a stale
   `resolvedSha` reads its files in its marketplace clone again. It stops failing every update in
   its scope, and every enable whose closure reaches it, as `{unreadable}`. A real containment
   escape still answers `unusable`.

Purpose: parity with Claude Code's installed-manifest read (E2), and removal of a regression in
which one legacy record blocks a whole scope.

Output: the entry-alone answer and its enable scenario (Task 1, tracer). The owning-root
discriminator with the legacy-shape unit proofs (Task 2). The decision records and the final
`npm run check` (Task 3).
</objective>

<execution_context>
@.claude/gsd-core/workflows/execute-plan.md
@.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@AGENTS.md
@.planning/phases/02-apply-ordering-and-installed-declarations/02-CONTEXT.md
@.planning/phases/02-apply-ordering-and-installed-declarations/02-02-SUMMARY.md
@.planning/phases/02-apply-ordering-and-installed-declarations/02-04-SUMMARY.md
@.planning/quick/261027-a3r-install-time-manifest-link-containment/261027-a3r-SUMMARY.md
@extensions/pi-claude-marketplace/orchestrators/plugin/dependency-index.ts
@extensions/pi-claude-marketplace/orchestrators/plugin/dependency-declaration-read.ts

Project skills that bind this plan: `.agents/skills/committing/SKILL.md`,
`.agents/skills/local-verification/SKILL.md` (and `rules/commands.md`, `rules/gates.md`),
`.agents/skills/typescript-unit-tests/SKILL.md` (`rules/cases.md`), and
`.agents/skills/typescript-style/SKILL.md` (`rules/comments.md`). Also
`.agents/skills/cucumber/SKILL.md` with all four `rules/*.md`.

Executor rules for this run:

- BASE is `ee8911d5` (HEAD when this plan was written). Work sequentially in this checkout. Find
  every function and test case by its name, and re-read it before you edit. Line numbers in this
  plan are hints only.
- Commit with `git commit -F <message file> -- <paths>`, in the foreground and unpiped. `git add`
  a new file before you commit it. Never use `--no-verify`, `--amend`, `gsd-tools commit`,
  `git add -A`, or a bare `git stash` (the stash stack is shared). Before each commit, run
  `SKIP=npm-check pre-commit run --files <changed files>` and restage what it rewrites.
- Every test is hermetic. Unit cases use the existing `SCOPE_ROOT`/`tmpdir()` constants or their
  own `mkdtemp` roots with `locationsFor(<scope>, <temp root>)`. A suite that already uses
  `withHermeticHome` keeps using it. Nothing reads or writes the real `HOME` or `~/.pi/agent`.
  Cucumber runs in its sandbox HOME by construction.
- Do not edit CHANGELOG.md, PROJECT.md or BACKLOG.md. In 02-CONTEXT.md, add whole lines only:
  never delete or reword an existing line.
- Comments and test titles cite durable IDs (D-PL2-22, D-PL2-23, D-PL2-12, D-05-07, NFR-10,
  WR-01, E2). They never cite phase, plan or task numbers, and never narrate the code they
  replace (`typescript-style/rules/comments.md`).
- TDD: write each task's new or changed cases first and run them on the unchanged source. Record
  the failing excerpt as RED, then implement. The commit hook rejects a failing test, so RED is
  observed locally and each task lands as one commit with its tests.
- Neighbor suites. A case outside the files named in a task may change only when its new output
  differs from its old expectation in one of two ways. (i) A record with `resolvedSha` whose copy
  is gone or has no manifest now answers its entry's `dependencies`, not the catalog copy's
  manifest (D-PL2-22). (ii) A record with `resolvedSha` whose copy lies in its marketplace clone
  is now read there in place, not refused (D-PL2-23). List each such case, with its file and the
  reason, in the SUMMARY. For any other failure, stop and report it.

Layer check (done while planning): both source edits stay in `orchestrators/plugin/`, which may
import `domain/` (`parseDeclaredDependencies` in `domain/dependencies.ts`,
`toClosureLookupResult` in `domain/dependency-closure.ts`, both already imported by
`dependency-declaration-read.ts`). Neither file names a git surface, so ESLint BLOCK F and the
network-free gate are unaffected. The reads stay offline (NFR-5).
</context>

## Upstream finding (claude-code-compat-research evidence record)

- **Question.** What does Claude Code read as an installed plugin's dependencies when its
  installed copy has no `plugin.json`, or when the copy is gone? And how does it admit a recorded
  install path?
- **Evidence.** Binary 2.1.310
  (`/home/linuxbrew/.linuxbrew/Caskroom/claude-code@latest/2.1.310/claude`), grepped 2026-10-27.
  - `VJ` (read manifest) walks the candidates. When none exists it returns
    `{manifest: {name, description: "Plugin from …"}, manifestPath: null, depConstraints: undefined}`,
    a stub with no `dependencies`.
  - `q9n` (load one plugin from its install path) calls `$le` → `VJ`. Then
    `if (!hasManifest) { … Qme(entry, "marketplace-entry", …); we.manifest = je.manifest … }`, so
    the marketplace entry becomes the whole manifest, `dependencies` included. With a manifest
    present, the entry adds display fields only (displayName, description, author, homepage,
    repository, license, keywords).
  - The enable closure (`smn`) and update's dependents scan (`Y`/`r3s`) read
    `manifest.dependencies` of the loaded plugins (E2, unchanged).
  - `z9n` (load from an install record), git source: it uses the versioned cache dir of the
    installed version when present (`NMe`), else the seed cache (`qsn`). Otherwise it downloads
    again, first at the installed commit (`{...source, sha: <recorded commit>}`), else
    "fetching its source as the marketplace lists it instead". It then loads that copy through
    `q9n`. A failed download pushes `Failed to download/cache plugin …`, and the plugin does not
    load.
  - A delisted plugin is not loaded at all (E5, `plugin-not-found`). The install path is checked
    textually against the cache, seed and marketplace-source roots (E5).
- **Confidence.** High for the no-manifest arm (one explicit branch). High that a gone copy is
  downloaded again before it is read.
- **Consequences for this plan.**
  - The no-manifest arm of D-PL2-22 is exact parity.
  - The gone-copy arm cannot be parity. This read is offline (NFR-5, network-free gate), so it
    cannot download again. The user's rule (entry alone) is the offline stand-in, and the plan
    applies it. The open point is reported to the user (see `<output>`).
  - Delisted: there is no upstream rule that reads a delisted plugin's declarations (DLS-01 is
    already a recorded divergence), so `not in manifest` (D-05-07) stays.
  - D-PL2-23: Claude Code's textual check of the recorded path against its roots supports a
    discriminator keyed on where the copy lies.
- **Discriminator decided for D-PL2-23.** `resolvedSha` together with the lexical location of
  `resolvedSource`. This is the test clone GC already applies in `deriveLiveCloneKeys`
  (`orchestrators/plugin/clone-gc.ts`): a record with `resolvedSha` whose `resolvedSource` lies
  under `plugin-clones/` names a live per-commit clone.
  - Rejected: the catalog entry's source kind. It is missing for a delisted record (the DLS-01
    read has no entry). It also describes the marketplace's current listing, not the install, so
    a marketplace that later changes a plugin's source kind would move the owning root under an
    unchanged record.
  - Rejected: location alone, without `resolvedSha`. It would also admit a record with no commit
    under `plugin-clones/`. No install writes that shape: git sources and `resolvedSha` both
    arrived in 0.9.0 (D-77-02).
  - Accepted consequence: a git record whose `resolvedSource` was edited to point into its own
    marketplace clone now reads that clone in place, under the D-PL2-17 in-place boundary. Records
    carry no source kind, so this shape cannot be told apart from the legacy path record.

## Multi-source coverage audit

| Source | Item | Covered by |
| --- | --- | --- |
| GOAL | (A) gone or manifest-less copy answers from the entry alone; upstream rule confirmed first | Task 1; evidence record above |
| GOAL | (A) delisted record keeps `not in manifest` / D-05-07 | Task 1 (case U4) |
| GOAL | (B) one owning root per record, chosen by `resolvedSha` + where `resolvedSource` lies; a real escape stays `unusable` | Task 2 |
| GOAL | a3r choice 1: the legacy stale-sha path record reads its marketplace clone and stops blocking its scope; a unit case for exactly that shape; scenario only if a supported path writes it | Task 2 (cases L1-L3, the restored WR-01 case); `## Proof scope` in the SUMMARY |
| GOAL | records: D-PL2-22, D-PL2-23 additive in 02-CONTEXT.md; 02-02 choices 2, 3, 4; the 02-04 D-PL2-12 row | Task 3 |
| GOAL | final `npm run check`, unpiped | Task 3 |
| REQ | RCN-05 (installed-copy declarations for enable and the update preflight) | Tasks 1, 2 |
| REQ | RCN-08 (installed-copy containment) | Task 2 |
| RESEARCH | E2 refined (no-manifest arm; gone copy downloaded again upstream) | Task 3 (E2 refinement), the open point in `<output>` |
| CONTEXT | D-PL2-06 / D-PL2-07 (installed-first read; path records keep the catalog read) | Task 1 keeps the D-PL2-07 branch |
| CONTEXT | D-PL2-12 (amended), D-PL2-17, D-PL2-25 (refusals stay `unusable`; convergence fails closed) | Task 2 (cases R1-R3, C1) |

<tasks>

<task type="tracer" tdd="true">
  <name>Task 1: Enable answers a pinned plugin's copy with no manifest from its marketplace entry alone (D-PL2-22)</name>
  <files>extensions/pi-claude-marketplace/orchestrators/plugin/dependency-index.ts, test/orchestrators/plugin/dependency-index.test.ts, features/lib/git-plugin.ts, features/step_definitions/plugin/publishing.steps.ts, features/plugin/enable.feature</files>
  <precondition>`git status --porcelain -- extensions test features` is empty, and `grep -rn 'D-PL2-22\|D-PL2-23' extensions test features .planning/phases` prints nothing (the IDs are free). If either fails, stop and report.</precondition>
  <read_first>
    - extensions/pi-claude-marketplace/orchestrators/plugin/dependency-index.ts: `readCatalogDeclarations`, `readInstalledRecordDeclarations` and its JSDoc, `unusableDeclaration`, `addressedDeclarations`, `unreadableDeclarer`
    - test/orchestrators/plugin/dependency-index.test.ts: helpers `marketplaceRecord`, `manifestOf`, `ownManifests`, `copyRoot`, `pinnedAppScope`, `APP_CLONE`, `APP_SHA`. The cases titled "D-PL2-06: an installed copy that holds no manifest …" and "D-PL2-06: an installed copy that is gone … on real disk", the D-PL2-07 case, and "D-05-07: an unusable declaration ends the walk as invalid manifest with the parser's field path" (the message shape)
    - features/lib/git-plugin.ts (whole file), features/step_definitions/plugin/publishing.steps.ts (whole file), and features/lib/path-marketplace.ts `writePluginFiles`
    - features/plugin/enable.feature: the scenario "Enabling a git-source plugin enables the dependency its installed copy declares, not the one its marketplace now lists" (the shape to follow), and features/plugin/fetch.feature "Fetching a git-source plugin downloads its new revision from the git host" (fetch moves the URL mirror to the new revision)
  </read_first>
  <behavior>
    Unit cases in test/orchestrators/plugin/dependency-index.test.ts:
    - U1 (changed, RED): retitle the D-PL2-06 no-manifest case to state the D-PL2-22 behavior. Example: "D-PL2-22: an installed copy that holds no manifest answers its marketplace entry alone, not the catalog copy's manifest". Keep `pinnedAppScope({ app: { dependencies: ["lib"] }, lib: {} })`. The reader now also serves a manifest at the catalog copy, `path.join(copyRoot("app"), ".claude-plugin", "plugin.json")`, declaring `["kit"]`. Expected `{ ok: true, declared: [{ name: "lib", marketplace: "mp" }] }`. On BASE it answers `kit`.
    - U2 (changed, RED): the gone-copy case on real disk, retitled the same way ("… that is gone answers its marketplace entry alone on real disk"). It also writes `<marketplaceRoot>/plugins/app/.claude-plugin/plugin.json` declaring `["kit"]`. Expected `lib`. On BASE it answers `kit`.
    - U3 (new, pins the unusable branch): the copy holds no manifest and the entry declares `dependencies: [42]`. Expected failure `{ declarer: "app@mp", reason: "invalid manifest", message: "cannot read the dependencies of app@mp: dependencies.0: Invalid input" }`.
    - U4 (new, pins D-05-07): a delisted record pinned to a commit whose copy holds no manifest (`pinnedAppScope({ lib: {} })`, `ownManifests()`). Expected failure `{ reason: "not in manifest", message: "cannot read the dependencies of app@mp: not declared by its marketplace, and its installed copy cannot be read" }`.
    - The D-PL2-07 case ("a record with no recorded commit answers exactly what the catalog read answers") passes unchanged.
    Scenario S1 (new, features/plugin/enable.feature, RED on BASE). Suggested title: "Enabling a git-source plugin whose installed copy has no manifest enables the dependency its marketplace entry declares". It proves that the enable closure follows the entry, not the warm catalog copy of a newer revision:
    - Revision 1 of the git repository `app` holds the plugin `app` at its root with no `.claude-plugin/plugin.json`.
    - The dir marketplace `tools` offers the path plugins `lib` 1.2.0 and `kit` 1.0.0, and offers `app` from that repository as an unpinned `url` (or `github`) source whose marketplace entry declares the dependency `lib`.
    - `tools` is added to the project scope, and `lib`, `kit` and `app` are installed there.
    - Revision 2 of `app` holds `app` 2.0.0, whose manifest declares `kit`.
    - The user has run `/claude:plugin fetch app@tools --scope project`, so the URL mirror (the catalog copy) holds revision 2.
    - The user has disabled `app`, then `lib`, then `kit`.
    - When the user runs `/claude:plugin enable app@tools --scope project`, the result is a `cascade` at `info`, needs reload `true`. It lists exactly `app` (installed, version `{app revision 1}`) and `lib@tools` (installed, `dependency enabled`, 1.2.0). The project installation record holds `app` `{app revision 1}` enabled, `kit` 1.0.0 disabled, and `lib` 1.2.0 enabled.
    - On BASE the closure reads the mirror's revision-2 manifest and enables `kit` instead, so the plugin rows and the record differ.
  </behavior>
  <action>
    Fixture support (shared cucumber library and topic step module). The step text belongs to the writer under `cucumber/rules/features.md`: lower case after the keyword, `these <things>:` before a table, and no implementation names.
    - In features/lib/git-plugin.ts, let a repository plugin be published with no manifest. One way: an optional flag on `RepositoryPlugin` that `writeRepositoryPlugins` honors by removing the plugin's `.claude-plugin` directory after `writePluginFiles` writes it. Leave features/lib/path-marketplace.ts untouched.
    - In the same file, let a git offer carry entry dependencies. Accept an optional last `dependencies` column in `readGitPluginOffers`, read with `readDependencyCell`, as `readRepositoryPlugins` already does. Add an optional `dependencies` to `GitPluginOffer` and `GitPluginEntry`, and let `gitPluginEntry` put it on the entry. The existing offer step's round-trip assertion must still compare whole entries.
    - In features/step_definitions/plugin/publishing.steps.ts, add the Given that publishes or pushes a revision whose plugins hold no manifest. It reuses `publishRepositoryRevision` and records the repository. It asserts, as the link steps do, that the pushed revision has no `.claude-plugin/plugin.json` for each such plugin (for example `git ls-tree main -- <path>` prints nothing).
    - Add scenario S1 to features/plugin/enable.feature. Do not edit any existing scenario there.

    Source, per D-PL2-22, in extensions/pi-claude-marketplace/orchestrators/plugin/dependency-index.ts:
    - Extract a module-private helper that returns the `not in manifest` failure with the existing phrase "not declared by its marketplace, and its installed copy cannot be read". Use it in `readCatalogDeclarations`, so the phrase has one home.
    - Add a module-private helper that answers one entry's `dependencies` alone: `toClosureLookupResult(parseDeclaredDependencies(entry.dependencies))`, mapped to `unusableDeclaration(key, read)` on `unusable` and to `addressedDeclarations(read.dependencies, marketplace, false)` on `found`.
    - Restructure `readInstalledRecordDeclarations`:
      - A record without `resolvedSha` returns `readCatalogDeclarations` directly (D-PL2-07, unchanged).
      - Otherwise read the copy through `readInstalledCopyDeclaration` with `installedCopyReadOptions` as today, and look up the entry once with `lookupDeclaredPlugin`.
      - `absent`: a delisted record answers the `not in manifest` helper (D-05-07), and a listed one answers the entry-alone helper.
      - `unusable` and `found`: unchanged.
    - Rewrite the JSDoc of `readInstalledRecordDeclarations`. State the D-PL2-22 rule and the E2 parity: Claude Code makes the entry the whole manifest of a copy with no `plugin.json`. State that a gone copy takes the same answer because this read cannot download it again (NFR-5), that a delisted record keeps D-05-07, and that a record without `resolvedSha` keeps D-PL2-07. For the copy-root rule, say only that the copy is admitted inside the one clone root that owns the record, as chosen by `installedCopyReadOptions`, and bounded by D-PL2-17. Task 2 changes that helper, and this JSDoc must stay true. Remove the sentence that compares the old fallback with E2.

    Order: fixtures, then U1-U4 and S1 (record the RED excerpts on BASE), then the source change.
    Commit: `fix(plugin): answer a manifest-less installed copy from its entry`. The body explains D-PL2-22 in two or three plain sentences, with lines of 80 characters or fewer. Paths: the five files of this task, plus any neighbor-suite case changed under the executor rules.
  </action>
  <verify>
    <automated>node --test test/orchestrators/plugin/dependency-index.test.ts && npm run test:coverage:direct -- extensions/pi-claude-marketplace/orchestrators/plugin/dependency-index.ts && npm run check:features && npx cucumber-js features/plugin/enable.feature features/plugin/fetch.feature features/plugin/git-source.feature features/plugin/update-dependencies.feature && node --test test/orchestrators/plugin/enable-disable.test.ts test/orchestrators/plugin/update-constraint-gate.test.ts test/orchestrators/plugin/update-preflight.test.ts test/orchestrators/plugin/update-swap.test.ts</automated>
  </verify>
  <done>
    - U1, U2 and S1 failed on BASE for the stated reason, and pass now. U3 and U4 pass.
    - `grep -c 'D-PL2-22' extensions/pi-claude-marketplace/orchestrators/plugin/dependency-index.ts` is at least 1 (baseline 0).
    - `grep -c 'falls back to the catalog read' test/orchestrators/plugin/dependency-index.test.ts` is 0 (baseline 2).
    - `grep -c 'slightly broader' extensions/pi-claude-marketplace/orchestrators/plugin/dependency-index.ts` is 0 (baseline 1).
    - `grep -c 'Scenario' features/plugin/enable.feature` is at least 13 (baseline 12), and `git diff ee8911d5 -- features/plugin/enable.feature` deletes no line.
    - Direct coverage for dependency-index.ts is 100%. The commit landed through the hook.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: A record's owning root follows where its copy lies, so a stale-sha path record reads its marketplace clone (D-PL2-23)</name>
  <files>extensions/pi-claude-marketplace/orchestrators/plugin/dependency-declaration-read.ts, test/orchestrators/plugin/dependency-declaration-read.test.ts, test/orchestrators/plugin/dependency-index.test.ts, test/orchestrators/reconcile/convergence.test.ts, test/orchestrators/plugin/update-swap.test.ts</files>
  <read_first>
    - extensions/pi-claude-marketplace/orchestrators/plugin/dependency-declaration-read.ts: `installedCopyReadOptions` and its JSDoc, `InstalledCopyDeclarationReadOptions`, `copyRootAdmitted`, `readInstalledCopyDeclaration`
    - extensions/pi-claude-marketplace/orchestrators/plugin/clone-gc.ts `deriveLiveCloneKeys` (the lexical under-plugin-clones test this rule shares) and extensions/pi-claude-marketplace/shared/path-containment.ts `isPathInside` (module-private; the lexical shape)
    - extensions/pi-claude-marketplace/orchestrators/reconcile/convergence.ts: `installedCopyDeclarations`, `isPinnedCopy`, `installedCopyReader` (read only; no source change expected)
    - test/orchestrators/plugin/dependency-declaration-read.test.ts: `OWNER_ROOTS`, `CLONES_ROOT`, the two `installedCopyReadOptions` cases, and the "D-PL2-12 / NFR-10: an installed copy outside its owning root …" and "… under the other clone root …" cases
    - test/orchestrators/plugin/dependency-index.test.ts: `readDelistedApp`, `APP_UNREADABLE_MANIFEST`, and the cases "D-PL2-12 / NFR-10: a delisted record pinned to a commit whose copy sits under the marketplace clone …" and "D-PL2-12 / NFR-10: the installed-first read of a record pinned to a commit whose copy sits outside the plugin clones …"
    - test/orchestrators/reconcile/convergence.test.ts: `stageTools`, `pluginRecord` (overrides spread last), `heldDependentChain`, `WIDGET_UNREADABLE_MANIFEST`, the fixed-point case "D-12 / DLS-D1: a held dependent is judged by its catalog and installed copies together, to a fixed point", and "D-PL2-12 / D-PL2-25: a dependent whose copy sits outside the root its record owns ends the cascade with no move"
    - test/orchestrators/plugin/update-swap.test.ts: the cases "WR-01: a successful path-source swap drops a stale resolvedSha …", "UPR-02: …" and "UPR-03: …". Each holds three lines that a3r added (`git show f4fb6b32 -- test/orchestrators/plugin/update-swap.test.ts`).
  </read_first>
  <behavior>
    dependency-declaration-read.test.ts:
    - R1 (new, RED): `installedCopyReadOptions({ resolvedSource: "/mp/alpha", resolvedSha: "0123456" }, { marketplaceRoot: "/mp", pluginClonesDir: "/clones" })` deep-equals the in-place options `{ boundary: { pluginRoot: "/mp/alpha", roots: ["/mp/alpha", "/mp"], label: "plugin directory and its marketplace directory" }, ownerRoot: "/mp" }`. On BASE it answers the copy owned by `/clones`.
    - R2 (new, pins the check order): plugin clones nested inside the marketplace clone, `{ resolvedSource: "/mp/.pi/clones/alpha", resolvedSha }` with `{ marketplaceRoot: "/mp", pluginClonesDir: "/mp/.pi/clones" }`. Expected: the copy options with the plugin-directory boundary, owned by `/mp/.pi/clones`.
    - R3 (new, pins a real escape): `readInstalledCopyDeclaration` of a record with `resolvedSha` whose `resolvedSource` lies under neither `OWNER_ROOTS` root (`path.join(tmpdir(), "elsewhere", "alpha")`). Expected: the fixed-detail refusal, and `reader.opened` stays `[]`.
    - The two existing `installedCopyReadOptions` cases, and the no-commit-under-the-plugin-clones refusal, pass unchanged.
    dependency-index.test.ts:
    - L1 (changed, RED): the delisted case whose copy sits under the marketplace clone with `resolvedSha`, retitled to D-PL2-23 ("… reads that copy in place"). Expected `{ ok: true, declared: [{ name: "lib", version: "^2.0.0", marketplace: "mp" }], delisted: true }`.
    - L2 (changed, RED; this is the legacy-shape unit case a3r choice 1 asks for): `buildInstalledScopeDeclarationDetail` over a scope holding `app` and `lib`. `app` has `{ resolvedSource: copyRoot("app"), resolvedSha: APP_SHA }`, its in-place manifest declares `lib@^2.0.0`, and its entry declares `entry@mp`. Expected: the walk is ok with `app@mp: [lib ^2.0.0]` and `lib@mp: []`. The scope is not blocked, and the update holder walk and the enable closure read through the same function. On BASE the walk fails with `APP_UNREADABLE_MANIFEST`. This replaces the installed-first cross-root case. A second variant, whose in-place copy holds no manifest and answers `entry@mp` through D-PL2-22, may be added.
    - L3 (new, pins a real escape): the installed-first read of a record with `resolvedSha` whose `resolvedSource` is `path.join(SCOPE_ROOT, "elsewhere", "app")`, with an entry that declares `entry@mp`. Expected `APP_UNREADABLE_MANIFEST`, with no catalog read.
    - The no-commit-under-the-plugin-clones case ("D-PL2-12 / NFR-10: a delisted record with no recorded commit …") passes unchanged.
    convergence.test.ts:
    - C1 (changed): the D-PL2-12 / D-PL2-25 cascade case keeps its fail-closed point with a real escape. Its widget override becomes `{ resolvedSha: "a".repeat(40), resolvedSource: <a path under the fixture's cwd outside both clone roots> }`, retitled to name a copy under neither clone root. Expected: unchanged (`WIDGET_UNREADABLE_MANIFEST`, no moves).
    - C2 (new, RED): `heldDependentChain("widget-installed")` with only `resolvedSha` added to widget (the legacy shape: the copy lies in the marketplace clone). `planConvergenceCascade` plans what the fixed-point case plans (holds for `core` and `widget`, no moves, no declines), with no `installedCopyFailure`. On BASE it fails closed.
    update-swap.test.ts:
    - W1 (restored, RED): in "WR-01: a successful path-source swap drops a stale resolvedSha …", remove the three lines a3r added (the D-PL2-12 comment and the `resolvedSource` reassignment). The record goes back to the legacy shape: a stale `resolvedSha` on a path record whose files are in the marketplace tree. The case proves that an update repairs it again. On Task 1's tree the preflight holder walk fails it as unreadable.
    - W2: remove the same three lines in the UPR-02 and UPR-03 cases. Their seeded copy in the marketplace tree is valid under D-PL2-23, and the removed comment describes the fallback that D-PL2-22 replaced. If either case then fails for any other reason, keep its fixture and correct only the comment: the gone copy answers its entry (D-PL2-22).
  </behavior>
  <action>
    Source, per D-PL2-23, in extensions/pi-claude-marketplace/orchestrators/plugin/dependency-declaration-read.ts:
    - `installedCopyReadOptions` answers the copy options (`copyManifestBoundary(resolvedSource)`, owner `pluginClonesDir`) only when `resolvedSha` is set AND `resolvedSource` lies lexically under `pluginClonesDir`. Lexically under means the relative path from `pluginClonesDir` to `resolvedSource` is non-empty and does not climb out with `..`, the test `deriveLiveCloneKeys` applies.
    - Every other record answers the in-place options (`inPlaceManifestBoundary(resolvedSource, marketplaceRoot)`, owner `marketplaceRoot`).
    - Keep the helper synchronous and module-local. Do not export `isPathInside` from shared/, and do not reuse convergence's `isPinnedCopy`: that would be a layering inversion, and it is async. Write it so that no compiler-forced branch is left uncovered (`noUncheckedIndexedAccess` on `split()[0]`).
    - `copyRootAdmitted` and `readInstalledCopyDeclaration` are unchanged. They still refuse a copy that is not under the chosen root, or that has a symlinked segment, as `unusable`. The D-PL2-17 boundary still refuses an escaping manifest link.
    - Rewrite the JSDoc of `installedCopyReadOptions`, and the `ownerRoot` doc on `InstalledCopyDeclarationReadOptions` if it names the old key. State the D-PL2-23 rule: one owning root per record, chosen by `resolvedSha` and where `resolvedSource` lies. Explain why. Records carry no source kind. A path record that an older version left with a stale `resolvedSha` keeps its files in the marketplace clone, the root NFR-10 names for path sources. Clone GC uses the same test. A copy under neither root still fails closed (D-PL2-12).
    - Touch dependency-index.ts only if a JSDoc sentence there still claims that a record with `resolvedSha` is always owned by `plugin-clones/`. If you do, add that file to this task's commit.
    - Tests: R1-R3, L1-L3, C1, C2, W1 and W2 as stated. Record the RED excerpts on Task 1's tree before the source change.
    - Then run the neighbor suites in `<verify>` and apply the executor rules on neighbor cases.
    Commit: `fix(plugin): read a path record's copy in its marketplace clone`. The body states D-PL2-23 and the stale-sha repair (WR-01), with lines of 80 characters or fewer. Paths: this task's files, plus any neighbor-suite case changed under the executor rules.
  </action>
  <verify>
    <automated>node --test test/orchestrators/plugin/dependency-declaration-read.test.ts test/orchestrators/plugin/dependency-index.test.ts test/orchestrators/reconcile/convergence.test.ts test/orchestrators/plugin/update-swap.test.ts && npm run test:coverage:direct -- extensions/pi-claude-marketplace/orchestrators/plugin/dependency-declaration-read.ts && npm run test:coverage:direct -- extensions/pi-claude-marketplace/orchestrators/plugin/dependency-index.ts && npm run test:coverage:direct -- extensions/pi-claude-marketplace/orchestrators/reconcile/convergence.ts && npm run test:modules && npm run test:unpaired && npm run fallow</automated>
  </verify>
  <done>
    - R1, L1, L2, C2 and W1 failed on Task 1's tree for the stated reason, and pass now. R2, R3, L3 and C1 pass.
    - `grep -c 'D-PL2-23' extensions/pi-claude-marketplace/orchestrators/plugin/dependency-declaration-read.ts` is at least 1 (baseline 0).
    - `grep -c 'gone here, so the update reads its catalog declarations' test/orchestrators/plugin/update-swap.test.ts` is 0 (baseline 3).
    - `npm run test:modules`, `npm run test:unpaired` and `npm run fallow` exit 0. Direct coverage is 100% for the three pairs. The commit landed through the hook.
  </done>
</task>

<task type="auto">
  <name>Task 3: Record D-PL2-22 and D-PL2-23, resolve the handoff items, run the full check</name>
  <files>.planning/phases/02-apply-ordering-and-installed-declarations/02-CONTEXT.md, .planning/phases/02-apply-ordering-and-installed-declarations/02-02-SUMMARY.md, .planning/phases/02-apply-ordering-and-installed-declarations/02-04-SUMMARY.md</files>
  <read_first>
    - 02-CONTEXT.md: the E2 and E5 bullets under `<upstream_evidence>` (E5 shows how to append a refinement as continuation lines), the D-PL2-06 bullet, the "D-PL2-12 (amended)" and D-PL2-17 bullets, and the D-PL2-24 bullet under "### Amendments after research (2026-10-26)"
    - 02-02-SUMMARY.md: "## Uncertain choices (for user review)", items 2, 3 and 4
    - 02-04-SUMMARY.md: the D-PL2-12 (amended) row of "## Decision rows", and item 1 of its "## Uncertain choices" (the "Resolved 2026-10-27 by user decision (…)" format to copy)
  </read_first>
  <action>
    Apply the `simple-english` (Plain) and `humanizer` skills to every sentence you add.
    02-CONTEXT.md. Add whole lines only; `git diff --numstat ee8911d5` must show 0 deleted lines for the file.
    - Under `<upstream_evidence>`, add continuation lines to the E2 bullet starting "E2 refined 2026-10-27 (same binary):". State the q9n no-manifest replacement by the entry, and that a gone copy is downloaded again before it is read (installed commit first, else the listed source), with no load on a failed download (the evidence record above).
    - Under "### Amendments after research (2026-10-26)", insert two new bullets immediately before the D-PL2-24 bullet, so the IDs stay in ascending order.
      - **D-PL2-22 — An installed copy with no manifest answers from its marketplace entry alone.** (user decision 2026-10-27) The content: the rule and its scope (records with `resolvedSha`, read by the enable closure and the update preflight); a delisted record keeps `not in manifest` (D-05-07); a record without `resolvedSha` keeps D-PL2-07; the E2 parity; the gone-copy arm as the offline stand-in for Claude Code's download (NFR-5). Say that it amends the gone-copy clause of D-PL2-06.
      - **D-PL2-23 — One owning root per record, chosen by where its copy lies.** (user decision 2026-10-27; amends D-PL2-12) The content: the rule; the stale-sha path record (the state WR-01/WR-02/WR-05 repair), which reads its marketplace clone again so its scope's updates and enables no longer fail `{unreadable}` (resolves 261027-a3r uncertain choice 1); what still answers `unusable`; the two rejected discriminators with their reasons; the accepted consequence for an edited git record; the E5 textual-root evidence; and the proof scope (unit only, because no supported command writes the legacy shape).
    - Add one continuation line at the end of the D-PL2-06 bullet: "**Amended 2026-10-27 (D-PL2-22):** a gone copy also answers from the entry alone." Add one at the end of the "D-PL2-12 (amended)" bullet: "**Amended 2026-10-27 (D-PL2-23):** the owning root follows `resolvedSha` together with where `resolvedSource` lies."
    02-02-SUMMARY.md: under items 2, 3 and 4 of "## Uncertain choices (for user review)", add an indented paragraph in the 02-04 item-1 format.
    - Item 2: "Resolved 2026-10-27 by user decision (D-PL2-22): the entry alone answers; the catalog copy's manifest is not read."
    - Item 3: "Resolved 2026-10-27 by user decision (D-PL2-22): kept; the read answers `not in manifest` directly, with no second copy read. Claude Code does not load a delisted plugin at all (E5)."
    - Item 4: "Resolved 2026-10-27 by user decision (D-PL2-23): a record whose copy lies in its marketplace clone is owned by that clone and read in place; `plugin-clones/` owns a record only when it has `resolvedSha` and its copy lies there."
    02-04-SUMMARY.md: append to the Decision cell of the D-PL2-12 (amended) row: "Amended 2026-10-27 (D-PL2-23): …" with the rule. Say that it resolves 261027-a3r uncertain choice 1: a path record that an older version left with a stale `resolvedSha` reads its files in the marketplace clone again, no longer fails its scope's updates and enables `{unreadable}`, and an update repairs it (WR-01).
    Commit these three files: `docs(plugin): record the entry-only and owning-root decisions`.
    Then run the full gate from the checkout root, unpiped and in the foreground (allow up to 40 minutes): `npm run check > "${TMPDIR:-/var/tmp}/261027-cyg-check.log" 2>&1; echo "exit=$?"`. Read the exit status from that echo. On a failure, read the log, fix the cause in the owning task's files, commit the fix through the hook, and rerun.
  </action>
  <verify>
    <automated>P=.planning/phases/02-apply-ordering-and-installed-declarations; NUMSTAT=$(git diff --numstat ee8911d5 -- "$P/02-CONTEXT.md") && test "$(grep -c 'D-PL2-22' "$P/02-CONTEXT.md")" -ge 2 && test "$(grep -c 'D-PL2-23' "$P/02-CONTEXT.md")" -ge 2 && test "$(grep -c 'E2 refined' "$P/02-CONTEXT.md")" -ge 1 && test "$(printf '%s\n' "$NUMSTAT" | cut -f2)" = 0 && test "$(grep -c 'Resolved 2026-10-27' "$P/02-02-SUMMARY.md")" -ge 3 && test "$(grep -c 'D-PL2-23' "$P/02-04-SUMMARY.md")" -ge 1 && echo "gates=ok"; npm run check > "${TMPDIR:-/var/tmp}/261027-cyg-check.log" 2>&1; echo "exit=$?"</automated>
  </verify>
  <done>
    - The record gates print `gates=ok`. Baselines at ee8911d5: D-PL2-22 0 and D-PL2-23 0 in 02-CONTEXT.md, E2 refined 0, Resolved 2026-10-27 0 in 02-02-SUMMARY.md, D-PL2-23 0 in 02-04-SUMMARY.md, so each gate fails at BASE.
    - The docs commit landed.
    - `npm run check` printed `exit=0` on the final tree, and the SUMMARY records the command, the exit status, HEAD, `node --version` and the log tail.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| plugin repository or marketplace tree → installed-copy read | A plugin author controls a copy's files and links; a hand edit or an older version controls `resolvedSource` and `resolvedSha` in `state.json` |
| installed-copy read → enable closure, update holder walk, convergence | The read decides which declarations hold an update, which dependencies an enable turns on, and whether a scope fails closed |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-cyg-01 | Information disclosure / Tampering | D-PL2-23 admits the marketplace clone for a record with `resolvedSha` whose copy lies there | low | mitigate | The read stays inside the record's own marketplace clone and under the D-PL2-17 in-place boundary. `copyRootAdmitted`'s lstat walk still refuses a symlinked segment. A copy under neither root stays `unusable` (cases R3, L3, C1) |
| T-cyg-02 | Tampering | D-PL2-22 entry-alone answer when a copy's manifest is removed | low | accept | The entry comes from the marketplace manifest the user added, the source the catalog read already trusts. This is Claude Code's own rule for a copy with no `plugin.json` (E2 refined) |
| T-cyg-03 | Repudiation | a refused copy silently read as "declares nothing" | medium | mitigate | `unusable` still fails closed through `unusableDeclaration` (D-05-07, D-PL2-25). A delisted absent copy stays `not in manifest` (case U4) |
| T-cyg-04 | Information disclosure | failure cause lines | low | mitigate | Only the fixed phrases are reused (T-05-04). No path or manifest text enters a cause |
| T-cyg-SC | Tampering | npm/pip/cargo installs | low | accept | This plan installs no package |
</threat_model>

<verification>
- Task 1: dependency-index unit cases and direct coverage; `check:features`; the enable, fetch, git-source and update-dependencies features; the enable, update-gate, preflight and swap suites; RED excerpts for U1, U2 and S1 on BASE.
- Task 2: the declaration-read, index, convergence and swap suites; direct coverage for three pairs; `test:modules`, `test:unpaired` and `fallow`; RED excerpts for R1, L1, L2, C2 and W1 on Task 1's tree.
- Task 3: the record gates; `npm run check` printed exit=0.
</verification>

<success_criteria>
- An installed copy with no manifest, or a gone copy, of a record with `resolvedSha` answers its marketplace entry's dependencies alone. A delisted record still fails `not in manifest`, and a path record without `resolvedSha` still reads the catalog. The enable scenario fails on BASE and passes after.
- Each record has one owning root, chosen by `resolvedSha` and where `resolvedSource` lies. The legacy stale-sha path record reads its marketplace clone and no longer blocks its scope, and an update repairs it. A real escape still answers `unusable`.
- 02-CONTEXT.md, 02-02-SUMMARY.md and 02-04-SUMMARY.md carry the decisions and resolutions, and 02-CONTEXT.md only gains lines.
- `npm run check` exits 0.
</success_criteria>

<output>
Create `.planning/quick/261027-cyg-entry-only-fallback-and-path-source-owne/261027-cyg-SUMMARY.md`. Do not commit it; the orchestrator commits it with STATE.md. It holds:
- the commits and BASE (`ee8911d5`);
- the RED evidence for each task, the S1 excerpt on BASE included;
- the upstream finding record (copy it from this plan);
- `## Proof scope`. D-PL2-23 is proven by unit cases only (R1-R3, L1-L3, C1, C2, W1), with no scenario. No supported command writes the legacy shape. Every pinned path install materializes under `plugin-clones/` (`materializeMarketplaceTagClone`). Update, reinstall and the disabled-record refresh clear a stale sha (WR-01). Enable materializes again at the recorded pin. Only a `state.json` that an older version wrote, or a hand edit, holds the shape, and the harness drives the public surface and has no step that writes installation records (the 02-04 / TST-01 unit-only precedent);
- the neighbor-suite cases changed under the executor rules, each with its reason;
- the final check record;
- open points for the user:
  1. the gone-copy arm of D-PL2-22: Claude Code downloads a gone copy again and reads its `plugin.json`. The offline read answers the entry instead (NFR-5). The alternative is to keep the catalog read for a gone copy only, which needs `readInstalledCopyDeclaration` to tell gone from manifest-less;
  2. a git record whose `resolvedSource` was edited into its own marketplace clone now reads that clone in place (D-PL2-23's accepted consequence);
  3. observed, not changed: enabling the legacy stale-sha record itself materializes it again at its stale pin (GIT-01 `recordedSourcePin`), which fails for a marketplace that is not a git checkout. An update repairs the record first;
- a suggested CHANGELOG line (not written to CHANGELOG.md);
- `## Threat Flags` (AGENTS.md requires it even when the answer is None).
</output>
