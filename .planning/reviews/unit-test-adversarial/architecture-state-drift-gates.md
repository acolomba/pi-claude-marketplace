# Architecture — state, config and drift gates

**Scope:** `tests/architecture/{config-state-consistency,compat-01-no-expansion,cross-op-convergence,manifest-lookup-drift,disabled-state-classification,config-state-write-seams,scope-fences-63,scope-order-drift,flag-catalog-drift,manifest-read-seam}.test.ts`
**Test files reviewed:** 10
**Production modules reviewed:** 10 (`persistence/state-io.ts`, `persistence/config-io.ts`, `persistence/config-write-back.ts`, `persistence/config-merge.ts`, `domain/manifest.ts`, `domain/manifest-lookup.ts`, `edge/flag-catalog.ts`, `shared/notify.ts` closed-set/comparator exports, `shared/types.ts`, `orchestrators/reconcile/{plan,types}.ts`)

## Summary

Most of this area is a family of source-scanning drift gates, and the best of them (`manifest-lookup-drift`, `disabled-state-classification`, `config-state-write-seams`) are model examples of the brief's central principle: each embeds synthetic "planted twin" offenders and benign controls and proves its own regex fires on the former and not the latter, so the gate is demonstrably not inert. `compat-01-no-expansion.test.ts` is exemplary throughout — clean AAA structure, whole-value `deepEqual` pins, and a real compile-time proof for its trickiest clause. Three themes are worth a fixing pass: (1) five files each hand-roll a near-identical recursive `.ts`-file walker instead of importing the one already built for this in `tests/architecture/source-scan.ts`, and two of them also duplicate its `stripComments`/`REPO_ROOT`; (2) `cross-op-convergence.test.ts` and `flag-catalog-drift.test.ts` loop several data rows inside one `test()` body instead of emitting one sibling `test()` per row, which both violates the mandated structure and hides every failure after the first; (3) `config-state-consistency.test.ts` — the one file in this set that is a real behavioral round-trip test rather than a static scan — has a genuine assertion gap (an untested `configSource` field) plus narrative numbered comments instead of arrange/act/assert. `manifest-read-seam.test.ts` is the one gate that never proves its own regex against a planted positive. Production code across `persistence/`, `domain/manifest*`, `edge/flag-catalog.ts`, and the reviewed `shared/`/`reconcile/` exports is uniformly clean.

## Unit test findings

### `tests/architecture/config-state-consistency.test.ts`

Gate verdict: not a static scan — this file invokes real orchestrators (`addMarketplace`, `setMarketplaceAutoupdate`, `removeMarketplace`, `installPlugin`) against a real temp filesystem and would fail on a genuine config/state round-trip regression; the terminal `assert.deepEqual(plan, emptyReconcilePlan(...))` in five of its seven tests is a strong, whole-value proof.

- **[BLOCKER] Incomplete object assertion hides an untested field** — `test('config-state-consistency: writeMarketplaceConfigEntry + planReconcile reads back the one declared marketplace')`, lines 139–148. The assertions check `plan.marketplacesToAdd[0].marketplace` and `.source` only. `PlannedMarketplaceAdd` (`orchestrators/reconcile/types.ts:50–65`) also carries `scope` and `configSource: "base" | "local"`, neither of which is asserted anywhere in this test. A wrong implementation that always stamped `configSource: "local"` (or the wrong per-item `scope`) would still pass. Replace the eight separate `assert.equal` calls with one `assert.deepEqual(plan, { scope: "user", marketplacesToAdd: [{ scope: "user", marketplace: "mp1", source: "owner/repo", configSource: "base" }], marketplacesToRemove: [], pluginsToInstall: [], pluginsToUninstall: [], pluginsToEnable: [], pluginsToDisable: [], sourceMismatches: [] })`.
- **[WARNING] Dead statement with an inaccurate comment** — lines 43–47. The comment claims `saveConfig`'s "direct import is retained for symmetry with sibling tests" and is exercised only "transitively," then adds `void saveConfig;`. This is false: `saveConfig` is called directly at line 236. Delete the `void saveConfig;` line and the comment above it.
- **[WARNING] Narrative numbered comments instead of arrange/act/assert** — e.g. lines 117–153 (`// 1. Empty starting config...` through `// 4. Run the planner...`) and lines 232–300 (`// 1. Seed the config...` through `// 4. Post-mutation reconcile...`). Per the skill, phases are marked `// arrange` / `// act` / `// assert`, not narrated step numbers. Relabel each block's comments accordingly (steps that are pure setup collapse under `// arrange`; the orchestrator calls under `// act`; the read-backs and checks under `// assert`).
- **[WARNING] Dynamic `await import(...)` inside test bodies for modules already statically imported elsewhere in the file** — e.g. lines 167–170, 215–218, 307–310, 368–371, 429–433, 494–499, 591–592 each re-import `locationsFor`, `loadState`, `saveState`, `pathSource`, `installPlugin`, or `node:fs/promises`/`node:os` helpers dynamically, per test, instead of once at the top alongside `loadConfig`/`saveConfig`. Hoist these into the file's static import block.
- **[WARNING] `as never` casts hide the ctx/pi doubles' shape** — lines 178–179, 226–227, 318–319, 379–380, 441–442, 546–547, 601–602 (`{ ui: { notify: ... } } as never`, `{ getAllTools: ... } as never`). This is a repo-wide idiom driven by orchestrators taking the full host `ExtensionContext`/`ExtensionAPI` type rather than a narrow consumer-declared port, so it is not unique to this file and not a one-file fix — but per the skill the production fix is to inject a narrow, consumer-declared port so the double can be `satisfies`-checked instead of cast past the compiler. Worth a deliberate, repo-wide follow-up rather than a per-file patch.

### `tests/architecture/compat-01-no-expansion.test.ts`

Gate verdict: every closed-set clause (`REASONS`, `STATUS_TOKENS`, `PLUGIN_STATUSES`, `MARKETPLACE_STATUSES`, the seven glyphs, the persisted-record key set, the schema-version union) is pinned against a hand-written literal and would fail on any real member added, removed, renamed, or reordered. The glyph-declaration-count clause and the install-outcome-signal clause both include a self-test proving the pattern/type actually catches a planted violation (lines 345–390, 419–451). Not inert anywhere. No findings — this file is a model for the rest of the area.

### `tests/architecture/cross-op-convergence.test.ts`

Gate verdict: invokes eight real orchestrators against a hermetic missing-marketplace state and compares actual `ctx.ui.notify` emissions to a fixed canonical byte string; would fail on exactly the kind of per-op divergence the file's own header describes as its original motivation (Class-C).

- **[WARNING] Data-driven rows looped inside one `test()` instead of one sibling test per row** — lines 265–292, 294–326, and 328–347 each iterate `OPS_EXPLICIT_SCOPE`/`OPS_BARE` inside a single test body via a `for` loop with assertions per iteration, so a failure on the second op is never reported once the first op's assertion has already thrown. Convert each loop into a top-level `for (const op of OPS_...) { test(\`... ${op} ...\`, async () => {...}); }` producing one sibling `test()` per op. Because every op is checked against the same fixed `CANONICAL_EXPLICIT`/`CANONICAL_BARE` literal, cross-op byte-identity follows by transitivity, so the manually-threaded `canonicalBody` bookkeeping (lines 269, 280–289, 295, 305–314) becomes unnecessary and can be dropped.
- **[WARNING] Double assertion through `unknown` hides the ctx/pi doubles' shape** — `makeCtx()`, lines 78–85 (`} as unknown as ExtensionContext;` / `} as unknown as ExtensionAPI;`). Same repo-wide pattern noted in `config-state-consistency.test.ts` above; not a one-file fix.

### `tests/architecture/manifest-lookup-drift.test.ts`

Gate verdict: proven against six planted synthetic twins and three benign controls in the same file (lines 136–187, 261–294), plus a self-test that every proven pattern actually reaches the source walk and is non-global (lines 277–294). Not inert — would fail on any new local re-derivation of the manifest-membership rule.

- **[WARNING] `extensionSourceFiles` duplicate walker** — lines 194–210 hand-roll the same recursive `.ts`-file walk that four other files in this assignment also hand-roll (see Summary). Otherwise the file is clean and exemplary.

### `tests/architecture/disabled-state-classification.test.ts`

Gate verdict: the drift-scan clauses are proven against three planted twin spellings and two benign controls (lines 200–268), so they are not inert. The eight `isRecordedButDisabled` behavior cases (lines 104–166) call the real predicate directly and would fail on a wrong implementation.

- **[WARNING] `describe()` groups two unrelated concerns under one wrapper** — line 103's `describe("disabled-state classification architecture", ...)` wraps both the behavioral unit tests of `isRecordedButDisabled` and the unrelated whole-tree drift-scan tests. Per the skill, `describe()` exists "one per exported entrypoint, and only when the module has several," not as a file-level catch-all. Drop the wrapping `describe()` and leave the `test()` calls flat.
- **[WARNING] Mock records carry a mis-shaped, functionally-irrelevant `resources` field** — lines 112–116 build `resources: enabled ? ["skill-a"] : []` (a plain array), but the real `PluginInstallRecord.resources` (`persistence/state-io.ts` `PLUGIN_INSTALL_RECORD_SCHEMA`) is an object of five named arrays. `isRecordedButDisabled`'s actual parameter type is the narrow `{ readonly enabled: boolean }`, so the field is both wrongly shaped and never read. Simplify the four rows to bare `{ enabled }` literals matching the predicate's real signature, dropping the `compatibility`/`resources` scaffolding (the deliberate "installable doesn't matter" invariant is still exercised by the `installable` row values, which don't depend on this field).
- **[WARNING] Duplicated `stripComments`/`REPO_ROOT`** — lines 15 and 99–101 are exact copies of `tests/architecture/source-scan.ts`'s exports of the same names. Import both from `./source-scan.ts` instead (cross-file duplication theme).

### `tests/architecture/config-state-write-seams.test.ts`

Gate verdict: proven against five synthetic offender strings and three benign callsites (lines 176–222); would fail on any new `atomicWriteJson(...stateJsonPath/configJsonPath/configLocalJsonPath...)` call outside the two allow-lists. Not inert.

- **[WARNING] `walkTsFiles` duplicate walker** — lines 84–94 (cross-file duplication theme; see Summary). Otherwise clean.

### `tests/architecture/scope-fences-63.test.ts`

Gate verdict: straightforward token-presence/absence scans against real source files; would fail if any of the four pinned clauses (SURF-03 lossy-synthesis tokens, SURF-04 hooks-edge-handler absence, SURF-04 hook-count-column absence, HOOK-04 REASONS/MANIFEST_FIELD_REASONS pins) regressed via the exact spellings enumerated. Like several siblings, it has no self-test proving the token lists themselves would catch a differently-spelled violation — an accepted, if here undocumented, residual risk shared with the file's neighbors.

- **[WARNING] File name doesn't describe its contents** — `scope-fences-63.test.ts` holds four clauses (SURF-03, two SURF-04 clauses, HOOK-04) with no "scope fence" concept anywhere in the file. Rename it to reflect its actual content next time it is touched (e.g. `surf-03-04-hook-04-locks.test.ts`).

### `tests/architecture/scope-order-drift.test.ts`

Gate verdict: a real repo-wide regex scan with an explicit allowlist; would fail against a new `["user", "project"]` literal or `=== "user" ? x : y` ternary planted anywhere under `extensions/`. Unlike `manifest-lookup-drift.test.ts` and `config-state-write-seams.test.ts`, it carries no embedded self-test proving either regex fires on a synthetic positive line.

- **[WARNING] Planning-artifact-style tag in both test titles** — lines 95 and 132 both prefix the title with `260525-cjr B3:`. Per `.claude/rules/typescript-comments.md`, comments and test titles carry durable spec IDs, not dated/initialed review-ticket tags that mean nothing once the referenced artifact is gone. Drop the `260525-cjr B3:` prefix from both titles (the requirement is otherwise well-documented in the file's own header comment, which already cites `msg-gr-3-per-scope`).
- **[WARNING] `walkTsFiles` duplicate walker** — lines 60–85 (cross-file duplication theme; see Summary).

### `tests/architecture/flag-catalog-drift.test.ts`

Gate verdict: exercises real production functions (`getArgumentCompletions`, `completionFlagEntries`, `parseFlagNames`, `BOOLEAN_FLAGS`) rather than scanning source text, so it would fail on a real catalog/handler drift. Two of its four tests reconcile two values both *derived from* production code against each other rather than against an independently-authored expectation, which cannot catch a bug present identically on both derived sides — but the file's fourth test (`HANDLER_ACCEPTED_PARSE_SETS`, an independently hand-written pin) covers that gap, so the file as a whole is not inert.

- **[WARNING] Data-driven rows looped inside one `test()`** — lines 85–101 iterate `COMPLETION_HEADS` (13 rows) and lines 142–156 iterate `CATALOG_VERBS` (12 rows), both inside a single test body with assertions per iteration, so only the first-failing row is ever reported. Convert each to one sibling `test()` per row, title-interpolated with the verb/head.

### `tests/architecture/manifest-read-seam.test.ts`

Gate verdict: scans real source files and would fail on a genuine second `readFile(...marketplace.json...)` call outside `domain/manifest.ts` today — but unlike its siblings in this same assignment (`manifest-lookup-drift`, `disabled-state-classification`, `config-state-write-seams`), it carries no self-test proving `hasMarketplaceManifestRead` fires on a synthetic positive or stays silent on a benign negative. The regex's own correctness is unverified by the suite.

- **[WARNING] No planted-violation self-test for the regex** — the file has one test (lines 36–57) that runs `hasMarketplaceManifestRead` only against real, already-compliant files. Add a case asserting it returns `true` against a synthetic string such as `` `await readFile(path.join(root, "marketplace.json"), "utf8")` `` and `false` against a benign read of a different filename, mirroring the "walker catches a synthetic offender" pattern already established in `config-state-write-seams.test.ts`.
- **[WARNING] Duplicated `stripComments`/`collectTypeScriptFiles` walker** — lines 11–25 and 27–29 (cross-file duplication theme; see Summary).

### Clean files

- `tests/architecture/compat-01-no-expansion.test.ts`

## Production code findings

### Clean files

- `extensions/pi-claude-marketplace/persistence/state-io.ts` — `isRecordedButDisabled` is a one-line, narrowly-typed pure predicate; the schema/type declarations are well documented and closed-set derived (`PLUGIN_STATUSES`-style pattern). No testability or style issues found in the reviewed sections.
- `extensions/pi-claude-marketplace/persistence/config-io.ts` — `loadConfig`'s discriminated-union return never throws; `saveConfig` runs `assertPathInside` before the write. No findings.
- `extensions/pi-claude-marketplace/persistence/config-write-back.ts` — each writer is a small, single-purpose function; the one `as MarketplaceConfigEntry` cast (`writeMarketplaceConfigEntry`, line 67) carries an inline comment explaining why it is safe and naming the runtime backstop. No findings.
- `extensions/pi-claude-marketplace/persistence/config-merge.ts` — pure reducer, no I/O; clear interfaces, no findings.
- `extensions/pi-claude-marketplace/domain/manifest.ts` — the sole `marketplace.json` read/parse/validate seam; malformed JSON and schema failures are converted to a typed `InvalidMarketplaceManifestError` rather than left as raw `SyntaxError`. No findings.
- `extensions/pi-claude-marketplace/domain/manifest-lookup.ts` — a single six-line pure function with a well-scoped parameter type (the `plugins` collection, not the whole manifest). No findings.
- `extensions/pi-claude-marketplace/edge/flag-catalog.ts` — the whole per-verb flag model is one data table with three small derivation functions; no findings.
- `extensions/pi-claude-marketplace/shared/notify.ts` (reviewed exports: `REASONS`, `STATUS_TOKENS`, `PLUGIN_STATUSES`, `MARKETPLACE_STATUSES`, the icon constants, `compareByNameThenScope`, `makeRawNotifyFn`) — closed sets are consistently the `as const` tuple + indexed-type pattern; `compareByNameThenScope` is a short, pure, well-documented comparator. No findings in the reviewed sections.
- `extensions/pi-claude-marketplace/shared/types.ts` — two lines, `Scope` and `SCOPES`; no findings.
- `extensions/pi-claude-marketplace/orchestrators/reconcile/plan.ts`, `orchestrators/reconcile/types.ts` — pure diff functions, well-documented interfaces, no I/O. No findings in the reviewed sections.

## Not covered

- `config-state-consistency.test.ts` and `cross-op-convergence.test.ts` also exercise `orchestrators/plugin/{install,uninstall,reinstall,update,info}.ts` and `orchestrators/marketplace/{add,remove,update,autoupdate}.ts` as collaborators. These are the primary subject of their own dedicated test files elsewhere in the sweep, so I did not give them a full `typescript-google-style-review` pass here to avoid duplicating that work; I focused production review on the modules these ten architecture gates most directly assert against.
- `shared/notify.ts` is 4000+ lines; only the exports these gates read or scan for (closed sets, icons, `compareByNameThenScope`, `makeRawNotifyFn`) were reviewed, not the file's rendering logic as a whole.
- Per the review brief, no command (`npm run check`, `node --test`, etc.) was run against any of these files — this is a read-only diagnostic pass.
