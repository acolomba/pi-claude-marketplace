# Phase 98: Lifecycle regression and contract documentation - Research

**Researched:** 2026-08-09
**Domain:** In-repo characterization coverage, architecture contract gates, documentation reconciliation, and four deferred code carriers in an existing TypeScript Pi extension
**Confidence:** HIGH (every claim below was read from the working tree this session; no external package or web research was required)

## Summary

This phase adds no new technology. Every deliverable is an extension of machinery that already
exists in this repository: three characterization suites extended in place, one new architecture
test in `tests/architecture/`, a bounded documentation accuracy sweep, and four small code
carriers deferred out of the Phase 97 fix loop. The research below locates every seam, names the
exact file and line for each named documentation defect, and resolves the one open design choice
(WR-04) that discuss left to plan time.

Two findings materially change the plan's shape. First, **the COMPAT-01 NUL-byte premise is
already resolved in the working tree**: `orchestrators/plugin/info.ts` contains no literal NUL
byte — the separator is written as the `\u0000` *escape* with an in-source comment explaining
exactly why. The D-98-10 rule (read files with Node `fs`, never shell out to `grep`) is still the
correct rule and is already the unbroken house pattern, but the planner must not write a task that
tries to "work around" a binary file that is not binary. Second, **`EnableDegradationSignals`
cannot simply be imported by `install.ts`**: `enable-disable.ts` already imports `install.ts`
(`runInstallLedger`), so widening the shape in place and importing it back creates a module cycle.
The sibling `orchestrators/plugin/shared.ts` is imported by *both* files and is the cycle-free
home for a shared `LedgerDegradationSignals`.

**Primary recommendation:** Sequence the four carriers first (D-98-05), each with its catalog
amendment and byte pins in the same commit; then author the single COMPAT-01 enumeration-equality
gate against the post-carrier closed sets; then extend the three LIFE suites in place; then run the
DOC-08 accuracy sweep last, so the documentation describes the code as it actually ships. For
WR-04, take direction (2) — make the disabled short-circuit reachable without `--partial` — because
it leaves `classifyInstalledRecord` and every one of its consumers completely untouched, which is
the tiebreaker D-98-04 names.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| LIFE-04 uninstall regression coverage | Test suite (`tests/orchestrators/plugin/`) | Bridges (assertion targets) | The behavior already holds; the deliverable is characterization, not code |
| LIFE-05 three update enumeration paths | Test suite | Orchestrator `update.ts` (unchanged) | All three targets funnel through one preflight; coverage is per-target-shape |
| LIFE-06 autoupdate cascade skip | Test suite (`tests/orchestrators/marketplace/`) | Orchestrator `marketplace/update.ts` mapper | Skip originates in plugin preflight, re-narrowed by the marketplace cascade mapper |
| COMPAT-01 no-expansion gate | Architecture test (`tests/architecture/`) | `shared/notify.ts`, `persistence/state-io.ts` (read-only) | Closed sets and the state schema are runtime constants; the gate imports and compares them |
| DOC-08 reconciliation | Documentation (`docs/`) + source comments | — | Prose only; no behavior change |
| IN-07 orphanRewake threading | Orchestrator (`plugin/install.ts` → `reconcile/*`) | Shared type module | Outcome-contract widening across the install→reconcile projection |
| WR-06 enable soft-dep markers | Orchestrator (`plugin/enable-disable.ts` + `reconcile/notify.ts`) | `shared/notify-reasons.ts` (`companionSeverity`) | Both enable arms compose the row; the counts already exist on `installCtx` |
| WR-02 enable remediation hint | Renderer (`shared/notify.ts` trailer gate) | Orchestrator (`narrowEnableFailure`) | Hint trailers are a renderer concern gated on a message field |
| WR-04 disabled-record update reachability | Orchestrator (`plugin/update.ts` gate derivation) | Completion data (unchanged under the recommended direction) | Recommended direction confines the change to one gate expression |

## Project Constraints (from CLAUDE.md)

These are binding and the planner must not produce tasks that violate them.

| Directive | Impact on this phase |
|-----------|----------------------|
| Never commit to `main`; work on `features/manifest-independent-plugin-info` in the worktree | All work happens in `.worktrees/manifest-independent-plugin-info` |
| Run `pre-commit run --files <changed>` **before** `git commit`; never `--no-verify`; never `--amend` to recover | Each commit task must include the pre-commit step ahead of the commit |
| Commits from a worktree prefix `SKIP=trufflehog`, only after a clean filesystem trufflehog scan | Documented worktree protocol; do not extend `SKIP=` further |
| Conventional Commits; title 5–72 chars; body lines ≤ 80; no GSD milestone/phase mentions | Commit and PR titles |
| `npm run check` must stay green (typecheck + lint + format:check + test + test:integration) — NFR-6 | The phase gate |
| All user-visible output through `notify()` in `shared/notify.ts` (IL-2) | WR-02's hint must ride the existing renderer, not a new emit site |
| Comment policy (`.claude/rules/typescript-comments.md`): durable requirement/decision IDs only; no `Phase NN` / `Plan NN` / `Wave N` / bare `Pitfall N` | Every comment and test title added by this phase |
| COMPAT-01 itself: no manifest snapshot, orphan field, schema migration, status token, reason token, glyph, or network path | The carriers are constrained by the gate they precede (D-98-05) |

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| LIFE-04 | A manifest-absent installed plugin remains fully uninstallable through its existing installation record, with every owned resource and the plugin record removed through the normal uninstall path. Regression coverage spanning all five resource kinds including hooks and MCP cleanup. | §LIFE-04 below: `uninstall.ts` imports no manifest/resolver module (verified); `seedFullPlugin` covers 4 of 5 kinds and omits hooks; per-kind artifact paths and the `cascadeUnstagePlugin` hooks arm are located |
| LIFE-05 | Targeted and bulk plugin update retain `(skipped) {not in manifest}`; coverage must span targeted, marketplace-bulk, and global-bulk enumeration paths. | §LIFE-05: all three `UpdatePluginsTarget` shapes located; the single origin at `update.ts:1034-1046`; PUP-5 already covers the targeted shape |
| LIFE-06 | Marketplace autoupdate retains `(skipped) {not in manifest}`; the skip originates in the shared update preflight and is re-narrowed by the cascade mapper. | §LIFE-06: `cascadeAutoupdates` → `outcomeToCascadePluginMessage` located; the `updateSinglePlugin` `process.cwd()` fixture hazard and its user-scope workaround identified |
| COMPAT-01 | No manifest snapshot, orphan field, state-schema migration, status token, reason token, glyph, or new network path; any source-scanning gate reads files directly rather than shelling out to `grep`. | §COMPAT-01: all four closed-set tuples, all seven glyph constants, the typebox record schema and its `.properties` key set, and the existing network gate's delegation shape are located and quoted |
| DOC-08 | The output catalog and the PRD document the manifest-independent behavior; four named documentation defects corrected, plus the disabled-state repair documentation. | §DOC-08: every named defect verified with file and line; three additional falsified statements found in the same touched sections |

## Standard Stack

### Core

No new dependency is introduced by this phase. The stack it operates on is already installed and
already exercised by every suite it extends.

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `node:test` | bundled with Node 22.22.2 | Every suite this phase extends | House test runner; no external framework `[VERIFIED: package.json scripts, read this session]` |
| `node:assert/strict` | bundled | Byte-equality and deep-equality assertions | Used by every existing suite |
| `node:fs/promises` (`readFile`) | bundled | Source-scanning architecture gates | The existing `no-orchestrator-network.test.ts` already uses it — never a `grep` subprocess `[VERIFIED: tests/architecture/no-orchestrator-network.test.ts:2, :100]` |
| `typebox` | `^1.1.38` | `STATE_SCHEMA` / `PLUGIN_INSTALL_RECORD_SCHEMA` — the COMPAT-01 no-migration and no-new-field assertions read these | Already the validation layer `[VERIFIED: extensions/pi-claude-marketplace/persistence/state-io.ts:30, :54-80, :190-200]` |

**Installation:** none — `npm install` is not part of this phase.

## Package Legitimacy Audit

**Not applicable.** This phase installs no external packages. No `npm install`, `pip install`, or
`cargo add` task belongs in the plan. The legitimacy gate was therefore not run.

## Architecture Patterns

### System Architecture Diagram

```text
                     ┌────────────────────────────────────────────┐
  /claude:plugin     │  edge/handlers/plugin/{update,uninstall,    │
  update|uninstall   │  enable,disable}.ts                        │
  |enable ──────────►│  edge/completions/data.ts (WR-04 surface)   │
                     └───────────────┬────────────────────────────┘
                                     │
     ┌───────────────────────────────┼───────────────────────────────┐
     ▼                               ▼                               ▼
┌─────────────────┐  ┌──────────────────────────┐  ┌──────────────────────────┐
│ update.ts       │  │ uninstall.ts             │  │ enable-disable.ts        │
│                 │  │  (imports NO manifest,   │  │  runEnableBranch         │
│ enumerateTargets│  │   NO resolver — LIFE-04) │  │   partial = !record      │
│  ├ kind:"plugin"│  │                          │  │     .compatibility       │
│  ├ kind:"mktpl" │  │  cascadeUnstagePlugin ──►│  │     .installable         │
│  └ kind:"all"   │  │   skills/commands/agents │  │        │                 │
│        │        │  │   /hooks/mcp             │  │        ▼                 │
│        ▼        │  └──────────────────────────┘  │  runInstallLedger        │
│ runThreePhase   │                                │   ├ installCtx           │
│  Update         │                                │   │  .stagedAgentNames   │
│   │             │                                │   │  .stagedMcpServer    │
│   ▼             │                                │   │   Names  (WR-06)     │
│ preflightUpdate │◄─── the SINGLE origin of       │   ├ .resolved            │
│  entryRaw ===   │     (skipped) {not in          │   │  .orphanRewake       │
│  undefined  ────┼───► manifest}  [update.ts:1034]│   └ .frontmatter         │
│        │        │                                │      Degradations        │
│        ▼        │                                └───────────┬──────────────┘
│ isRecordedBut   │                                            │
│  Disabled ──►   │                                            │
│ refreshDisabled │                                            │
│  Record (WR-04) │                                            │
└────────┬────────┘                                            │
         │ PluginUpdateFn                                      │
         ▼                                                     │
┌──────────────────────────────┐                               │
│ marketplace/update.ts        │                               │
│  cascadeAutoupdates          │                               │
│   └► outcomeToCascadePlugin  │                               │
│      Message  (re-narrow)    │                               │
└────────────┬─────────────────┘                               │
             │                                                 │
             ▼                                                 ▼
      ┌───────────────────────────────────────────────────────────┐
      │  reconcile/apply.ts → reconcile/notify.ts                  │
      │   installedRowFromOutcome  (IN-07 target)                  │
      │   enabledRowFromOutcome    (WR-06 second arm)              │
      └────────────────────────┬──────────────────────────────────┘
                               ▼
      ┌───────────────────────────────────────────────────────────┐
      │  shared/notify.ts  — the ONLY emit surface (IL-2)           │
      │   REASONS(38) STATUS_TOKENS(24) PLUGIN_STATUSES(19)         │
      │   MARKETPLACE_STATUSES(7)  ICON_*(7)                        │
      │   renderPluginRow → hint-trailer gate (WR-02 target)        │
      └────────────────────────┬──────────────────────────────────┘
                               ▼
      ┌───────────────────────────────────────────────────────────┐
      │  docs/output-catalog.md  ← byte-equality gate               │
      │  tests/architecture/catalog-uat.test.ts                     │
      └───────────────────────────────────────────────────────────┘
```

### Pattern 1: Architecture gate reads source with Node `fs`, never a subprocess

**What:** Every source-scanning architecture test resolves `REPO_ROOT` from `import.meta.url`,
reads each target with `readFile(..., "utf8")`, strips comments where the prose legitimately names
the forbidden token, then applies regular expressions.

**When to use:** The COMPAT-01 gate, for any clause that must inspect source text rather than a
runtime constant.

**Example:**

```ts
// Source: tests/architecture/no-orchestrator-network.test.ts:1-6, :88-118 (read this session)
const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "") // block comments
    .replace(/^\s*\/\/.*$/gm, ""); // line comments
}

const src = await readFile(path.join(REPO_ROOT, rel), "utf8");
const stripped = stripComments(src);
```

`tests/architecture/partial-vocabulary-guard.test.ts` states the rationale explicitly in its
header: it reads files "as UTF-8 in Node so the glyph-bearing files -- notify.ts, info.ts,
output-catalog.md, and the PRD -- are NOT mis-detected as binary the way a recursive shell `grep`
would" `[VERIFIED: tests/architecture/partial-vocabulary-guard.test.ts:10-13]`. The rule is
therefore already universal in this tree; the COMPAT-01 gate inherits it rather than inventing it.

### Pattern 2: Prefer runtime-constant comparison over source scanning

Three of the five COMPAT-01 clauses need no source scanning at all, because the thing being pinned
is an exported runtime value:

- Closed sets: `import { REASONS, STATUS_TOKENS, PLUGIN_STATUSES, MARKETPLACE_STATUSES }` and
  `assert.deepEqual([...REASONS], [ ...literal list... ])`.
- Glyphs: `import { ICON_INSTALLED, ICON_AVAILABLE, ... }` — all seven are exported.
- State schema + record field set: `STATE_SCHEMA` and the record schema are typebox objects whose
  `.properties` expose their key sets at runtime.

Prefer these. Source scanning is only needed for the "no new network path" clause, and that clause
delegates (below).

### Pattern 3: Delegation without importing a `*.test.ts`

D-98-09 requires the COMPAT-01 gate to DELEGATE to `no-orchestrator-network.test.ts` rather than
duplicate it. **Do not `import` that file.** Under `node:test`, importing a module whose top level
calls `test(...)` registers those tests again in the importing file's run, producing duplicate
executions and a misleading count.

Two viable delegation shapes:

1. **Extract a shared helper** into a non-test module (e.g. `tests/helpers/source-scan.ts`) that
   exports `REPO_ROOT`, `stripComments`, and an `assertNoForbiddenSurface(targets, patterns)`
   function; both gates import it. `tests/helpers/` already holds non-test modules
   (`credential-mock.ts`, `git-mock.ts`) `[VERIFIED: tests/helpers/ listing this session]`.
2. **Meta-assert** — the COMPAT-01 gate reads `no-orchestrator-network.test.ts` as text and asserts
   its `FORBIDDEN_TARGETS` array still names the two `info.ts` files, so the network clause is
   proven *covered elsewhere* without re-running it.

Shape (1) is cleaner and matches house convention; shape (2) is cheaper. Either satisfies "a
reviewer reads that one file and knows the whole contract" if the COMPAT-01 file's header narrates
the delegation. Recommend (1) with the extracted helper.

### Pattern 4: Catalog amendment ships in the same commit as the behavior change

`tests/architecture/catalog-uat.test.ts` parses `docs/output-catalog.md`, pairing every
`<!-- catalog-state: STATE -->` comment with the next fenced block inside a per-command `##`
section, and asserts byte equality against a programmatic `NotificationMessage` fixture
`[VERIFIED: tests/architecture/catalog-uat.test.ts:1-34]`. Any carrier that changes rendered bytes
must, in one commit: add the catalog state + fenced block, add the matching `FIXTURES` entry, and
add the orchestrator-level row assertion.

### Anti-Patterns to Avoid

- **Importing `EnableDegradationSignals` into `install.ts`.** `enable-disable.ts:74` already does
  `import { runInstallLedger } from "./install.ts"`. Importing the type back creates a cycle. Both
  files already import `./shared.ts` (`install.ts:153`, `enable-disable.ts:80`) — put the shared
  shape there. `[VERIFIED: extensions/pi-claude-marketplace/orchestrators/plugin/{install,enable-disable}.ts import lines, read this session]`
- **Shelling out to `grep` from a test.** Forbidden by D-98-10 and unnecessary — see Pattern 1.
- **Count-only closed-set pins.** `tests/architecture/notify-closed-set-locks.test.ts` already does
  counts (38 / 24 / 19 / 7). D-98-08 requires the new gate to hold the full literal member list and
  assert *set equality*. Do not duplicate the counts; assert membership.
- **Minting a new status token, reason token, or glyph in any carrier.** D-98-05 makes this a
  blocker to surface, not a silent addition. All four carriers can be implemented within the
  existing vocabulary — see the per-carrier sections.
- **Writing `` `unsupported` `` bare in a backtick.** `tests/architecture/partial-vocabulary-guard.test.ts`
  forbids the standalone backticked form outside an explicit allowlist. Write `unsupported` array
  or `unsupported` kind.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Reading source files in a gate | A `child_process` `grep`/`rg` call | `readFile(..., "utf8")` + `stripComments` | D-98-10; also the only form that is portable and encoding-safe |
| Comparing a closed set | A new snapshot file or count constant | `assert.deepEqual([...TUPLE], [literal])` against the exported tuple | D-98-08 demands enumeration equality; a snapshot file adds a second source of truth |
| Reading the plugin-record field set | A hand-maintained list of field names | `Object.keys(PLUGIN_INSTALL_RECORD_SCHEMA.properties)` | The typebox schema IS the source of truth; a hand list drifts |
| The `--partial` hint text | A new trailer literal | `PARTIAL_UPDATE_HINT_TRAILER` (`shared/notify.ts:2458`) | The literal is FROZEN as a documented contract; reusing it adds no bytes to pin |
| Enable-row soft-dep severity | A hand-written `info`/`warning` ternary | `companionSeverity(...)` (`shared/notify-reasons.ts:71`) | Already the sanctioned SEV-01 producer; `install.ts:1811` shows the call shape |
| Enable-row degrade tokens | A per-kind `if` ladder | `malformedReasonsForKinds` / `narrowUnsupportedKinds` | Both are already the shared composition seams both arms consume |
| Hermetic user-scope test isolation | A bespoke temp-dir dance | The existing `withHermeticHome` helper duplicated per suite | Already present in `update.test.ts:88` and `uninstall.test.ts:119` |

**Key insight:** Almost every "new" thing this phase appears to need already exists as an exported
seam. The plan's job is to *wire* existing seams, not to author new mechanism. The one genuine
addition is the `PluginFailedMessage.partialHint` optional field for WR-02.

## LIFE-04 — uninstall after manifest-entry removal

**The behavior already holds.** `orchestrators/plugin/uninstall.ts` imports no manifest module and
no resolver: its import list is `node:fs/promises`, `bridges/hooks/index.ts`,
`persistence/config-io.ts`, `persistence/config-write-back.ts`, `shared/completion-cache.ts`,
`shared/errors.ts`, `shared/notify-context.ts`, `shared/notify.ts`,
`transaction/with-state-guard.ts`, `orchestrators/marketplace/shared.ts`, `./clone-gc.ts`,
`./shared.ts`, `./uninstall.messaging.ts` `[VERIFIED: extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts:44-59]`.
The deliverable is characterization only.

### Where each kind's artifact lives

`cascadeUnstagePlugin` (`orchestrators/marketplace/shared.ts`) drops all five kinds; its `dropped`
accumulator declares `hooks: [] as string[]` and the hooks arm calls
`removeHookConfig({ locations, pluginName: plugin })`
`[VERIFIED: extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts:307-315, :344, :387-389]`.

| Kind | On-disk assertion target | Source of truth |
|------|--------------------------|-----------------|
| skills | `<locations.skillsTargetDir>/<generatedName>/SKILL.md` (dir removed) | `tests/orchestrators/plugin/uninstall.test.ts:152-154` |
| commands | `<locations.promptsTargetDir>/<generatedName>.md` | `tests/orchestrators/plugin/uninstall.test.ts:157-159` |
| agents | `<locations.agentsDir>/<GENERATED_AGENT_PREFIX><plugin>-<agent>.md` + the row removed from `locations.agentsIndexPath` | `tests/orchestrators/plugin/uninstall.test.ts:162-183` |
| hooks | `<locations.hooksDir>/<plugin>/hooks.json` — i.e. `path.join(locations.hooksDir, plugin, "hooks.json")` | `[VERIFIED: extensions/pi-claude-marketplace/bridges/hooks/stage.ts:34-36]` (`hookConfigPathFor`); removal is `rm(path.join(locations.hooksDir, pluginName), { recursive: true, force: true })` `[VERIFIED: bridges/hooks/stage.ts:233-235]` |
| mcp | the owned server key removed from `<locations.mcpJsonPath>`'s `mcpServers` object | `tests/orchestrators/plugin/uninstall.test.ts:185-200` |

### Gap in the existing fixture

`seedFullPlugin` seeds **four** kinds and omits hooks entirely — no `hooksDir` write and no
`hooks: [...]` entry in `makePluginRecord`. It returns `{ skillDir, commandFile, agentFile, mcpJson }`
`[VERIFIED: tests/orchestrators/plugin/uninstall.test.ts:141-226]`. The existing `PU-1` test asserts
only three of the four it seeds — `mcpJson` is returned but never asserted absent
`[VERIFIED: tests/orchestrators/plugin/uninstall.test.ts:248-250]`. `LIFE-01` hooks coverage exists
but lives in `tests/orchestrators/marketplace/cascade.test.ts:158`, at the `cascadeUnstagePlugin`
level, not through `uninstallPlugin`.

**Consequence for the plan:** D-98-12's five per-kind cases need `seedFullPlugin` extended with a
`hooks` seed (write `hookConfigPathFor(locations, plugin)` and add the plugin name to
`resources.hooks`), and each of the five cases seeds a **manifest-absent** record — which for this
orchestrator means simply that no manifest file needs to exist at all, since `uninstall` never
reads one. Point `manifestPath` at a path that does not exist to make the absence explicit and
self-documenting.

## LIFE-05 — the three update enumeration paths

All three forms are one discriminated union and all three converge on one preflight.

```ts
// Source: extensions/pi-claude-marketplace/orchestrators/plugin/update.ts:170-173
export type UpdatePluginsTarget =
  | { readonly kind: "all" }
  | { readonly kind: "marketplace"; readonly marketplace: string }
  | { readonly kind: "plugin"; readonly plugin: string; readonly marketplace: string };
```

- `enumerateTargets` routes `"plugin"` and `"marketplace"` to `enumerateMarketplaceTarget`, and
  handles `"all"` inline by walking `["project","user"]` (or the explicit scope) and pushing every
  `(plugin, marketplace, scope)` triple `[VERIFIED: update.ts:2655-2680]`.
- `enumerateMarketplaceTarget` returns a single-element array for `"plugin"` and
  `Object.keys(mp.plugins).map(...)` for `"marketplace"` `[VERIFIED: update.ts:2709-2725]`.
- Every resolved target runs `runThreePhaseUpdate` → `preflightUpdate` `[VERIFIED: update.ts:1553-1561]`.

### The single origin of the skip

```ts
// Source: extensions/pi-claude-marketplace/orchestrators/plugin/update.ts:1034-1046
  if (entryRaw === undefined) {
    // Installed but no longer listed in the refreshed manifest -> skipped
    // {not in manifest} with the recorded `fromVersion` (preserved behavior).
    return {
      partition: "skipped",
      name: plugin,
      fromVersion: record.version,
      notes: ["not in manifest"],
      reasons: ["not in manifest"] as const,
      declaresAgents: false,
      declaresMcp: false,
    };
  }
```

### Existing coverage and the exact gap

`PUP-5` already covers the **targeted** shape end-to-end and pins the byte form:

```
"A plugin operation needs attention.\n\n● mp [project]\n  ⊘ hello v1.0.0 (skipped) {not in manifest}"
```

with `severity === "warning"` `[VERIFIED: tests/orchestrators/plugin/update.test.ts:425-463]`.

Grepping the whole test tree for `(skipped) {not in manifest}` returns **only** that one update
assertion plus five `info-manifest-absent.test.ts` occurrences
`[VERIFIED: repo-wide grep this session]`. The marketplace-bulk and global-bulk shapes are
uncovered. The gap is therefore exactly two new tests in `tests/orchestrators/plugin/update.test.ts`,
reusing `seedPathMarketplace` + `rewriteManifest` verbatim from `PUP-5` and varying only the
`target` argument:

- `target: { kind: "marketplace", marketplace: "mp" }`
- `target: { kind: "all" }` with `scope: "project"`

Both should produce the same byte row (the `[project]` bracket is on the marketplace header; the
plugin-row scope bracket is suppressed by orphan-fold when `plugin.scope === mp.scope`).

## LIFE-06 — autoupdate cascade skip

`cascadeAutoupdates(snapshot, name, scope, pluginUpdate)` iterates `snapshot.plugins` and calls
`await pluginUpdate(plugin, name, scope)`, pushing each outcome; only a *throw* is caught and
converted `[VERIFIED: extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts:531-583]`.
A `partition: "skipped"` outcome flows through untouched to
`outcomeToCascadePluginMessage(outcome, scope)`, whose documented contract maps
`skipped -> PluginSkippedMessage{ reasons: [<narrowed>] }` via `narrowSkipReason`
`[VERIFIED: orchestrators/marketplace/update.ts:698-709]`. That mapper's fallback is the permissive
`"not in manifest"` (`marketplace/update.ts:854-855`, `:892-893`), which is why D-98-13 calls it a
*re-narrowing*: the reason is already correct from the preflight, and the mapper would also arrive
there from the substring fallback.

### The `process.cwd()` fixture hazard

`updateSinglePlugin` takes no `cwd` and does `const cwd = process.cwd()`
`[VERIFIED: extensions/pi-claude-marketplace/orchestrators/plugin/update.ts:544-550]`. A test that
injects the real function and seeds a **project**-scope marketplace under a `mkdtemp` directory will
not find it, because `locationsFor("project", cwd)` composes `path.join(cwd, ".pi")`
`[VERIFIED: extensions/pi-claude-marketplace/persistence/locations.ts:144-145]`.

Two ways out; the second is strongly preferred:

- `process.chdir(tmpDir)` in a `try/finally`. **Hazard:** `process.chdir` is process-global and
  `node --test` may run tests within a file concurrently; this can corrupt sibling tests.
- **Use `scope: "user"` with the existing `withHermeticHome` helper.** `locationsFor("user", cwd)`
  ignores `cwd` entirely and derives from `getAgentDir()`
  `[VERIFIED: persistence/locations.ts:145]`, so the real `updateSinglePlugin` resolves the seeded
  hermetic state regardless of the process cwd.

### Recommended two-part LIFE-06 coverage

1. **Mapper-level** (cheap, deterministic): inject a `pluginUpdate` stub returning
   `{ partition: "skipped", name, fromVersion, notes: ["not in manifest"], reasons: ["not in manifest"], declaresAgents: false, declaresMcp: false }`
   and assert the rendered cascade row. This pins the *re-narrowing* half.
2. **End-to-end** (proves the origin): inject the real `updateSinglePlugin`, seed a user-scope
   path-source marketplace with `autoupdate: true` and one installed plugin, rewrite the manifest to
   drop the entry, and assert the same row. This pins the *origin* half.

The existing `MU-6 / MU-8` test at `tests/orchestrators/marketplace/update.test.ts:810` shows the
`autoupdate: true` + injected-`pluginUpdate` seed shape; the file's `seedMarketplace` helper already
takes an `autoupdate?: boolean` option `[VERIFIED: tests/orchestrators/marketplace/update.test.ts:99, :122, :131-139]`.
D-98-11's "whichever file owns that path today" resolves to
`tests/orchestrators/marketplace/update.test.ts` — `autoupdate.test.ts` covers the
`setMarketplaceAutoupdate` *flag flip*, not the cascade.

## COMPAT-01 — the no-expansion contract gate

### Clause 1 — closed sets (enumeration equality, D-98-08)

All four tuples are exported from `shared/notify.ts` and are already imported by
`tests/architecture/notify-closed-set-locks.test.ts:22-27`. Their verbatim members, read this
session:

`REASONS` — 38 entries. The full member list is split across `shared/notify-reasons.ts`'s topic
groups, which the compile-time `_ReasonsCoverageProof` proves is an exact partition of `REASONS`
`[VERIFIED: extensions/pi-claude-marketplace/shared/notify-reasons.ts:31-38, :85-94, :101-136, :201-208, :219-222]`:

- `IDEMPOTENT_REASONS` (6): `"up-to-date"`, `"already installed"`, `"already autoupdate"`,
  `"already no autoupdate"`, `"already enabled"`, `"already disabled"`
- `UNSUPPORTED_REASONS` (7): `"unsupported hooks"`, `"lsp"`, `"requires pi-subagents"`,
  `"requires pi-mcp"`, `"unsupported source"`, `"unsupported component"`, `"no longer installable"`
- `FAILURE_REASONS` (18): `"permission denied"`, `"source missing"`, `"network unreachable"`,
  `"authentication required"`, `"unreadable"`, `"unparseable"`, `"unreadable manifest"`,
  `"invalid manifest"`, `"malformed mcp"`, `"malformed skill"`, `"malformed command"`,
  `"not in manifest"`, `"rollback partial"`, `"lock held"`, `"source mismatch"`,
  `"dangling reference"`, `"concurrently uninstalled"`, `"concurrently updated"`
- `CommandPrivateReason` (7): `"not found"`, `"not installed"`, `"plugins remain"`, `"stale clone"`,
  `"duplicate name"`, `"not added"`, `"orphan rewake"`

6 + 7 + 18 + 7 = 38 ✓ (matches the pinned `REASONS.length`). **Note the ordering caveat:** the
authoritative *order* lives in the `REASONS` tuple in `notify.ts:90+`, not in the topic groups, and
`notify-reasons.ts:6-10` states the order must stay byte-identical for catalog stability. The
enumeration-equality assertion should therefore compare **sets**, or read the literal order directly
off `notify.ts` when the plan authors the literal list.

```ts
// Source: extensions/pi-claude-marketplace/shared/notify.ts:243-288 (verbatim members, in order)
export const STATUS_TOKENS = [
  "installed", "updated", "reinstalled", "uninstalled", "added", "removed",
  "available", "unavailable", "upgradable", "skipped", "failed",
  "rollback failed", "manual recovery", "no marketplaces", "no plugins",
  "will install", "will uninstall", "will enable", "will disable", "disabled",
  "partially-installed", "partially-upgradable", "partially-available", "remote",
] as const;                                                        // 24 entries
```

```ts
// Source: extensions/pi-claude-marketplace/shared/notify.ts:472-509 (verbatim members, in order)
export const PLUGIN_STATUSES = [
  "installed", "updated", "reinstalled", "uninstalled", "available",
  "unavailable", "upgradable", "failed", "skipped", "manual recovery",
  "will install", "will uninstall", "will enable", "will disable", "disabled",
  "partially-installed", "partially-upgradable", "partially-available", "remote",
] as const;                                                        // 19 entries
```

```ts
// Source: extensions/pi-claude-marketplace/shared/notify.ts:524-532 (verbatim members, in order)
export const MARKETPLACE_STATUSES = [
  "added", "removed", "updated", "failed",
  "autoupdate enabled", "autoupdate disabled", "skipped",
] as const;                                                        // 7 entries
```

### Clause 2 — glyphs

Seven exported constants, all in `shared/notify.ts`
`[VERIFIED: extensions/pi-claude-marketplace/shared/notify.ts:1546, 1547, 1548, 1562, 1570, 1581, 1593]`:

```ts
export const ICON_INSTALLED = "●";            // :1546
export const ICON_AVAILABLE = "○";            // :1547
export const ICON_UNINSTALLABLE = "⊘";        // :1548
export const ICON_DISABLED = "◍";             // :1562
export const ICON_REMOTE = "◌";               // :1570
export const ICON_PARTIALLY_INSTALLED = "◉";  // :1581
export const ICON_PARTIALLY_AVAILABLE = "⊖";  // :1593
```

There is no exported *collection* of glyphs, so "set equality" for this clause means asserting each
constant's exact code point **and** that `shared/notify.ts` declares no eighth `ICON_` export. The
latter is the one place a small source scan earns its keep:
`(src.match(/^export const ICON_[A-Z_]+ = /gm) ?? []).length === 7`.

### Clause 3 — no state-schema migration, no new record field

```ts
// Source: extensions/pi-claude-marketplace/persistence/state-io.ts:190-200 (verbatim)
export const STATE_SCHEMA = Type.Object({
  schemaVersion: Type.Union([Type.Literal(1), Type.Literal(2)]),
  lastReconciledExtensionVersion: Type.Optional(Type.String()),
  marketplaces: Type.Record(Type.String(), MARKETPLACE_RECORD_SCHEMA),
});
```

`DEFAULT_STATE` is frozen at `schemaVersion: 2` `[VERIFIED: state-io.ts:208-209]`, and
`persistMigratedState` "always writes schemaVersion 2" `[VERIFIED: state-io.ts:184-189 doc block]`.

The plugin record's exact key set, verbatim `[VERIFIED: extensions/pi-claude-marketplace/persistence/state-io.ts:54-80]`:

```ts
const PLUGIN_INSTALL_RECORD_SCHEMA = Type.Object({
  version: Type.String(),
  resolvedSource: Type.String(),
  resolvedSha: Type.Optional(Type.String()),
  compatibility: Type.Object({
    installable: Type.Boolean(),
    notes: Type.Array(Type.String()),
    supported: Type.Array(Type.String()),
    unsupported: Type.Array(Type.String()),
  }),
  resources: Type.Object({
    skills: Type.Array(Type.String()),
    prompts: Type.Array(Type.String()),
    agents: Type.Array(Type.String()),
    mcpServers: Type.Array(Type.String()),
    hooks: Type.Array(Type.String()),
  }),
  enabled: Type.Boolean(),
  installedAt: Type.String(),
  updatedAt: Type.String(),
});
```

Nine top-level keys: `version`, `resolvedSource`, `resolvedSha`, `compatibility`, `resources`,
`enabled`, `installedAt`, `updatedAt` — that is eight; the ninth slot is deliberately *absent* and
that absence is the point. Assert the key set equals exactly those eight, and that neither
`"manifestSnapshot"` nor `"orphan"` (nor any manifest-cache-shaped key) appears. `PLUGIN_INSTALL_RECORD_SCHEMA`
is module-private; either export it for the gate or read the key set off `STATE_SCHEMA`'s nested
`.properties` chain. Exporting it is cleaner and is a test-only widening with no runtime cost.

### Clause 4 — no new network path (delegated)

`tests/architecture/no-orchestrator-network.test.ts` already gates
`orchestrators/plugin/info.ts` and `orchestrators/marketplace/info.ts` — the two surfaces
COMPAT-01's network clause names `[VERIFIED: tests/architecture/no-orchestrator-network.test.ts:61-62]`.
Its forbidden patterns are `from "…platform/git…"`, `\bDEFAULT_GIT_OPS\b`, `\bgitOps\b`,
`\brefreshGitHubClone\b` `[VERIFIED: :81-86]`. Delegate per Pattern 3.

### The NUL-byte premise is already resolved — DO NOT plan around it

`orchestrators/plugin/info.ts` contains **no** literal NUL byte. A byte scan of the file finds none;
`file(1)` reports `ASCII text`; `grep` matches it normally
`[VERIFIED: byte scan + `file` + `grep` run this session]`. The separator is written as an escape,
with the reason stated inline:

```ts
// Source: extensions/pi-claude-marketplace/orchestrators/plugin/info.ts:421-426 (verbatim)
    // The separator is U+0000 because it cannot occur in an event name or a
    // matcher, so no `(event, matcher)` pair can collide with another. Written
    // as an ESCAPE rather than a literal control character: a raw NUL byte in
    // the source makes `grep` and other line tools classify this whole file as
    // binary and refuse to print matches.
    const key = `${drop.event}\u0000${matcher ?? ""}`;
```

The only files in the tree carrying literal NUL bytes are three archived planning documents and
three binary assets `[VERIFIED: repo-wide byte scan this session]`. **Implication for the plan:**
D-98-10's *rule* stands and the gate must still read files with Node `fs`, but no task should be
written to "handle" a binary source file, and no verification step should assert that `grep` fails
on `info.ts` — it does not. The requirement text's justification is historical. Consider noting the
resolution in the gate's header comment so a future reader does not re-litigate it.

## The four Phase-97 carriers

### IN-07 (D-98-01) — thread `orphanRewake` through the install outcome

**Current asymmetry, verified.** The standalone install row reads
`installCtx.resolved.orphanRewake` directly, but `InstallPluginOutcome`'s `installed` arm carries
only `resourcesChanged`, `declaresAgents`, `declaresMcp`, `postCommitWarnings?`, `degradedKinds?`
`[VERIFIED: extensions/pi-claude-marketplace/orchestrators/plugin/install.ts:223-239]`. Meanwhile
`enabledRowFromOutcome` already pushes the token:

```ts
// Source: extensions/pi-claude-marketplace/orchestrators/reconcile/notify.ts:536-538
  const malformed = malformedReasonsForKinds(outcome.degradedKinds);
  ...(outcome.orphanRewake === true ? (["orphan rewake"] as const) : []),
```

while `installedRowFromOutcome` composes from `degradedKinds` alone
`[VERIFIED: reconcile/notify.ts:494-495]`.

**Seams to touch (four, all small):**

1. `orchestrators/plugin/install.ts` — the `installed` return at `:1858-1865` gains
   `...(installCtx.resolved.orphanRewake === true && { orphanRewake: true })`, beside the existing
   `degradedKinds` derivation at `:1856`. Omit when false so a clean install's outcome shape is
   unchanged.
2. `orchestrators/reconcile/apply-outcomes.ts` — `PluginInstalledOutcome` (`:82`) gains the matching
   optional field, documented against SURF-05 / D-63-08 as `degradedKinds` (`:101-109`) is
   documented against WARN-01 / D-86-03.
3. `orchestrators/reconcile/apply.ts` — the install arm's outcome construction at `:609-611` gains
   the spread, mirroring the enable arm at `:693-698`.
4. `orchestrators/reconcile/notify.ts::installedRowFromOutcome` — push `"orphan rewake"` **ahead of**
   the malformed tokens, matching the emit order both `install.ts` and `enabledRowFromOutcome` use.

**The shared-shape question (D-98-01's "prefer that if it makes the asymmetry class a compile
error").** `EnableDegradationSignals` lives in `enable-disable.ts:115-139` and is already
`extends`-ed by `PluginEnabledOutcome` `[VERIFIED: reconcile/apply-outcomes.ts:172]`. **Do not
import it into `install.ts`** — `enable-disable.ts:74` imports `runInstallLedger` from `install.ts`,
so that direction closes a cycle. (Note: `eslint.config.js` configures no `import-x/no-cycle` rule
`[VERIFIED: grep of eslint.config.js this session]`, so the cycle would not be linted — it would
just be a latent ESM initialization hazard. `ARCHITECTURE.md`'s claim that no-cycle is enforced is
itself inaccurate; that is a `.planning` doc and outside DOC-08's named scope.)

**Recommended:** move the interface to `orchestrators/plugin/shared.ts` — imported by both
`install.ts:153` and `enable-disable.ts:80` — renamed `LedgerDegradationSignals`, with
`EnableDegradationSignals` kept as a re-exported alias if the churn in `apply-outcomes.ts:30` and
`apply.ts:79` is undesirable. Then have both `InstallPluginOutcome["installed"]` and
`PluginInstalledOutcome` intersect it, which is what turns the next such asymmetry into a compile
error.

**Severity is unaffected:** `orphan rewake` moves no severity channel; the
`degradedKinds.length > 0 ? "warning" : "info"` rule stays. **No catalog state is needed** —
`success-with-orphan-rewake` already pins the rendered form; this only makes a second surface reach
it. Coverage: mirror the existing enable-arm row assertion in
`tests/orchestrators/reconcile/notify.test.ts`.

### WR-06 (D-98-02) — thread staged agent/MCP counts into both enable arms

**Current state, verified verbatim:**

```ts
// Source: extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts:1010-1028
  if (unsupported.length > 0) {
    return {
      status: "partially-installed",
      name: plugin,
      // SEV-01: `dependencies` stays empty here -- the enable row does not yet
      // thread the ledger's staged agent / mcp names, so the soft-dep markers
      // never fire on either enable arm.
      dependencies: [],
      ...
  return {
    status: "installed",
    name: plugin,
    dependencies: [],
```

The counts already exist on the ledger context and `runEnableBranch` already holds `ledgerCtx`:

```ts
// Source: extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts:305-316
    const ledgerCtx = result.installCtx;
    const resolved = ledgerCtx.resolved;
    const degradedKinds = Array.from(new Set(ledgerCtx.frontmatterDegradations.map((d) => d.kind)));
    return {
      kind: "fresh",
      version: recordedVersion,
      ...(resolved.state === "partially-available" && { unsupported: [...resolved.unsupported] }),
      ...(resolved.orphanRewake === true && { orphanRewake: true }),
      ...(degradedKinds.length > 0 && { degradedKinds }),
    };
```

`InstallCtx` declares `stagedAgentNames: readonly string[]` and
`stagedMcpServerNames: readonly string[]` `[VERIFIED: install.ts:381-382]`, populated at `:999` and
`:1084`. The consuming pattern to copy is verbatim in `install.ts`:

```ts
// Source: extensions/pi-claude-marketplace/orchestrators/plugin/install.ts:1743-1749, :1811-1814
    const dependencies: Dependency[] = [];
    if (installCtx.stagedAgentNames.length > 0) { dependencies.push("agents"); }
    if (installCtx.stagedMcpServerNames.length > 0) { dependencies.push("mcp"); }
    ...
      : companionSeverity(
          { declaresAgents: installCtx.stagedAgentNames.length > 0,
            declaresMcp: installCtx.stagedMcpServerNames.length > 0 },
```

**Seams to touch:**

1. `SetEnabledOutcome`'s `"fresh"` arm and `EnableDisablePluginOutcome`'s `"enabled"` arm both
   intersect `EnableDegradationSignals` (`enable-disable.ts:206-209`, `:156-160`). If IN-07 moves
   that interface, add `declaresAgents?`/`declaresMcp?` (or a `Dependency[]`) to the *same* shared
   shape so both carriers land in one type — this is the cheapest sequencing.
2. `freshEnableRow` (`:999-1036`) replaces both `dependencies: []` with the derived array and
   composes `severity` through `companionSeverity(...)` rather than
   `malformed.length > 0 ? "warning" : "info"`. **Careful:** the two raises must compose — a
   malformed degrade is `warning` regardless of the companion probe, and a missing companion is
   `warning` regardless of malformed kinds. Take the max, do not replace one rule with the other.
3. `reconcile/notify.ts::enabledRowFromOutcome` (`:536+`) mirrors both changes.

**`companionSeverity` needs a `SoftDepStatus` probe.** Its signature is
`companionSeverity({declaresAgents, declaresMcp}, probe: SoftDepStatus)`
`[VERIFIED: shared/notify-reasons.ts:71-78]`. `install.ts` obtains the probe at the emit site;
the enable path must obtain it the same way. Confirm at plan time which of `enable-disable.ts`'s
emit sites already holds `pi` (the options bundle carries `pi: ExtensionAPI` at `:181-182`, so it
does).

**Catalog impact (real, byte-changing):** a soft-dep state under `## /claude:plugin enable`
mirroring `soft-dep-on-installed`, its `FIXTURES` entry in `catalog-uat.test.ts`, plus row
assertions in `tests/orchestrators/plugin/enable-disable.test.ts` and
`tests/orchestrators/reconcile/notify.test.ts`. **No new token:** `"requires pi-subagents"` and
`"requires pi-mcp"` are existing `UNSUPPORTED_REASONS` members.

### WR-02 (D-98-03) — remediation affordance on a failed enable with a stale gate

**The mechanism.** The hint trailer is a renderer concern gated on `p.partialHint`:

```ts
// Source: extensions/pi-claude-marketplace/shared/notify.ts:2447, :2458-2459, :3726-3738
const PARTIAL_INSTALL_HINT_TRAILER = "Re-run with --partial to install the supported components.";
const PARTIAL_UPDATE_HINT_TRAILER =
  "Re-run with --partial to update with the supported components.";
...
  if ((p.status === "unavailable" || p.status === "partially-available") && p.partialHint === true) {
    lines.push(`    ${PARTIAL_INSTALL_HINT_TRAILER}`);
  }
  if (p.status === "partially-upgradable" && p.partialHint === true) {
    lines.push(`    ${PARTIAL_UPDATE_HINT_TRAILER}`);
  }
```

`partialHint?: boolean` exists on three message interfaces (`notify.ts:811`, `:837`, `:908`) but
**not** on `PluginFailedMessage`, whose fields are `status`, `severity`, `name`, `reasons`,
`version?`, `scope?`, `cause?`, `rollbackPartial?` `[VERIFIED: shared/notify.ts:918-938]`.

**The gate that fails.** `runEnableBranch` derives `const partial = !installed.compatibility.installable`
from the *persisted* record `[VERIFIED: enable-disable.ts:259]`. A record installable at disable time
whose manifest entry has since gained an unsupported kind derives `partial = false`, the ledger runs
`requireInstallable`, and `PluginShapeError` is thrown. `narrowEnableFailure` recognizes only ENOENT
and otherwise returns `[]` `[VERIFIED: enable-disable.ts:1173-1186]` — a bare `⊘ <plugin> (failed)`
plus a cause trailer.

**Recommended minimal shape (mints nothing):**

1. Add `partialHint?: boolean` to `PluginFailedMessage`.
2. Extend the second renderer gate to `(p.status === "partially-upgradable" || p.status === "failed") && p.partialHint === true`,
   reusing the FROZEN `PARTIAL_UPDATE_HINT_TRAILER` — `update --partial` is the actual remedy, so
   the update wording is truthful.
3. In `composeOutcomeRow`'s `"enable-failed"` arm (`:1100-1126`), narrow the cause the way
   `composeUpdateDeclineRow` does: when
   `outcome.cause instanceof PluginShapeError && cause.shape.kind === "no-longer-installable" && cause.shape.partialable`,
   stamp `reasons: narrowUnsupportedKinds(cause.shape.unsupportedKinds ?? [])` and
   `partialHint: true`. The precedent is verbatim at `update.ts:943-958`.
4. Document the choice at the gate derivation (`enable-disable.ts:259`).

This adds no status token, reason token, glyph, or trailer literal — only one optional message
field and one widened render gate. It **does** change bytes on that failure path, so it is a
catalog amendment under `## /claude:plugin enable` with a `catalog-uat` fixture and an
`enable-disable.test.ts` row assertion, in the same commit (D-98-03).

**Do not** take the alternative "accept `--partial` on `enable`" route: it adds a flag to the arg
schema, a `flag-catalog-drift.test.ts` entry, and completion surface — a much wider change for the
same user outcome, and it contradicts "use the existing hint / cause-trailer mechanism."

### WR-04 (D-98-04) — `update` reachability for disabled records

This is the one genuine design decision. Both directions were researched.

**The situation.** `classifyInstalledRecord` short-circuits every disabled record to `"installed"`:

```ts
// Source: extensions/pi-claude-marketplace/orchestrators/plugin/plugin-state-classifier.ts:136-138
  if (isRecordedButDisabled(record)) {
    return "installed";
  }
```

`"installed"` is in `INSTALLED_INVENTORY_STATUSES` but **not** in `PARTIAL_UPDATE_STATUSES`
(`{"upgradable", "partially-installed-upgradable", "partially-upgradable"}`)
`[VERIFIED: extensions/pi-claude-marketplace/edge/completions/data.ts:51-57, :87-91]`. Meanwhile
`update`'s disabled short-circuit sits *after* the candidate gate, so a disabled **partial** record
only reaches `refreshDisabledRecord` when `--partial` widened the gate
`[VERIFIED: update.ts:1558-1573 and :896-908]`. The existing suite header states this explicitly:

```
// Source: tests/orchestrators/plugin/update.test.ts:2914-2919 (verbatim)
// Every test below passes `partial: true`. Without it `resolveUpdateCandidate`
// runs the strict `requireInstallable` gate, the degraded candidate throws, and
// the throw is converted into a skipped outcome BEFORE the disabled-record
// short-circuit is reached -- so a test without the flag would prove nothing
// about the short-circuit at all.
```

**Direction 1 — distinct `disabled` classification consumed by completion.**
Touches: `InstalledClassification` union (`plugin-state-classifier.ts:44-49`); the short-circuit
return; `PluginIndexRow["status"]` union (`shared/completion-cache.ts:119-128`);
`INSTALLED_INVENTORY_STATUSES` must gain `"disabled"` or every installed-mode completion loses
disabled records (a byte regression); `PARTIAL_UPDATE_STATUSES` gains `"disabled"`; the
`edge-deps.test.ts:606` parity drift-guard; and the `plugin-state-classifier.test.ts` pins at
`:185`, `:187`, `:191`, `:206`, `:208`. `list.ts` happens to stay byte-stable because its own
`isRecordedButDisabled` guard returns at `:431` *before* the classifier call at `:488`, and it uses
`if` chains rather than an exhaustive `switch` — but that safety is incidental, not structural.

**Direction 2 — make the disabled short-circuit reachable without `--partial`.** RECOMMENDED.
A disabled record stages nothing (`refreshDisabledRecord` only rewrites `version`,
`resolvedSource`, `resolvedSha`, `compatibility`, `updatedAt` inside a state guard
`[VERIFIED: update.ts:1353-1396]`), so the strict-gate rationale — "do not silently materialize a
degrade the user did not consent to" — does not apply. Derive the candidate gate's `partial` from
the record when the record is disabled, exactly as `runEnableBranch` already does, and cite the
same D-69-01 precedent `runEnableBranch` cites at `enable-disable.ts:249-258`.

Why it satisfies D-98-04's tiebreaker: it touches `classifyInstalledRecord` **zero** times, so
every consumer — `list.ts`, the completion bucketizer, the parity drift-guard, and the classifier's
own pins — is untouched and byte-stable by construction. It also *dissolves* the discoverability
problem rather than patching it: with no flag required, the record is offered under plain `update`,
which already spans `INSTALLED_INVENTORY_STATUSES`.

**What it costs (be explicit in the plan):**

- The rendered row for `update` (no flag) against a disabled **partial** record changes from
  `(skipped) {<dropped kinds>}` + `--partial` hint trailer to the `(unchanged)` byte form the
  `--partial` path already produces. That is a catalog-relevant behavior change and needs its
  catalog state + fixture + assertion.
- The `update.test.ts:2914-2919` suite header currently *asserts the opposite* and must be
  rewritten — it is falsified prose inside the phase's own test tree.
- The mechanical change is confined to `preflightUpdate`: the `record` is already in scope at
  `:1005` and the `resolveUpdateCandidate` call is at `:1083-1087`, so
  `partial: args.partial === true || isRecordedButDisabled(record)` is a one-line derivation.
  `isRecordedButDisabled` is already imported by `update.ts:97`.
- Add one test proving the no-flag path reaches the short-circuit; keep every existing
  `partial: true` ENBL-09 test unchanged (they still pass — `partial: true` remains admissible).

**Reversibility note carried from D-98-04:** direction 2 is *more* reversible than direction 1,
because it does not pin a new classification into `edge-deps.test.ts` and the completion buckets.

## DOC-08 — every named defect, located and verified

| # | Defect | Location (verified this session) | Current text / problem |
|---|--------|----------------------------------|------------------------|
| 1 | PRD PL-6 row describes the retired v1 manifest-failure renderer | `docs/prd/pi-claude-marketplace-prd.md:357` | Claims the section "MUST display `[warning] could not load manifest: <reason>`". BOUND-01 settles the actual output as a bare `(failed)` marketplace header with no child rows |
| 2 | PRD §5.3.1 flowchart | `docs/prd/pi-claude-marketplace-prd.md:348` (heading), mermaid block immediately after the PL-9 row | The flowchart still branches `D -- warning --> F[fallback to installed-from-state]`. D-98-07: REDRAW to `manifest load → lookup → ManifestLookup discriminant → row form` |
| 3 | Catalog brace-bearing-variant count is stale | `docs/output-catalog.md:54` and the surrounding Conventions section | The Conventions bullets enumerate which variants carry a brace; verify the count against the current reason-bearing arm set |
| 4 | `(partially-installed)` missing from the catalog status-token reference table | `docs/output-catalog.md:133-149` | The plugin token table runs `(installed)`…`(disabled)` and omits **both** `(partially-installed)` (`◉`) and `(partially-upgradable)` (`●`), though both are `STATUS_TOKENS` members |
| 5 | `notify-reasons.ts` header says 37, set holds 38 | `extensions/pi-claude-marketplace/shared/notify-reasons.ts:6-14` | Verbatim: "the 37-entry membership AND order must stay byte-identical" and "instead of the flat 37-entry set". `REASONS.length === 38` (pinned at `notify-closed-set-locks.test.ts:37`) |
| 6 | `orchestrators/reconcile/README.md:34` two-axis-marker prose | `extensions/pi-claude-marketplace/orchestrators/reconcile/README.md:34` | Verbatim: "reads the empty-resources marker (all four `resources.*` arrays empty AND `compatibility.installable === true`)". ENBL-05 collapsed this: `isRecordedButDisabled` reads `!record.enabled` **alone** (`state-io.ts:155-157`), there are **five** resources arrays, and `compatibility.installable` is deliberately NOT an input |
| 7 | Stale `notify.ts` comments | `extensions/pi-claude-marketplace/shared/notify.ts:2178-2186` | Verbatim: "The list inventory row OMITS `reasons` … so it renders byte-identically to a bare `(installed)` row." INV-01 falsified this — `list.ts:553` stamps `reasons: ["not in manifest"]`. The `PluginInstalledMessage` doc block carries the same claim |
| 8 | Retired `RLD-04 / D-08` anchors in `tools.ts` | `extensions/pi-claude-marketplace/edge/handlers/tools.ts:161, :327, :403` | Three comments cite anchors on lines the milestone did not touch |
| 9 | Catalog ~line 411 on-disk materialization claim | `docs/output-catalog.md:412` | Verbatim: "The inventory is manifest-independent: the record is materialized on disk, so the row keeps the clean `(installed)` token". The list surface never checks on-disk materialization |
| 10 | D-96-01 fold-divergence documentation | `docs/output-catalog.md:1480, :1504`; `orchestrators/plugin/info.ts:948, :1011` | The divergence between Pi-generated installed names and manifest source names is described in two catalog states; confirm the PRD/info sections name it consistently |

### Additional falsified prose found in the same touched sections

D-98-06 authorizes correcting statements v1.18 falsified while inside each touched section. Three
were found and should be folded in rather than left for a later phase:

- **PRD PL-4 glyph roster** (`docs/prd/pi-claude-marketplace-prd.md`, the PL-4 row): the icon set
  reads `(one of ● / ○ / ⊘ / ◌ / ◉)` — missing `⊖` (`ICON_PARTIALLY_AVAILABLE`) and `◍`
  (`ICON_DISABLED`).
- **PRD PL-4 glyph meanings**: the row says "`◌` deliberate user-requested disabled state". D-80-01
  reassigned `◌` to `(remote)` and moved `(disabled)` to `◍`
  `[VERIFIED: shared/notify.ts:1562, :1570; docs/output-catalog.md:149]`. The PRD row is now wrong
  about which glyph means what.
- **PRD PL-4 token set** lists `(present)`, which is not a `STATUS_TOKENS` member.

### DOC-08 style and lint constraints

- The repo runs `mdformat`, `markdownlint`, and `prettier` via pre-commit
  `[VERIFIED: .planning/codebase/STACK.md and .pre-commit-config.yaml presence]`. Run
  `pre-commit run --files <changed docs>` before committing, per CLAUDE.md.
- `tests/architecture/partial-vocabulary-guard.test.ts` scans `docs/output-catalog.md`,
  `docs/messaging-style-guide.md`, and the PRD for retired vocabulary. Any rewrite must not
  reintroduce `force-installed`, `force-upgradable`, a bare backticked `` `unsupported` ``, or the
  `(unsupported)` render token outside the documented allowlist.
- Every catalog edit inside a fenced block annotated `<!-- catalog-state: … -->` is a **byte
  contract**; `catalog-uat.test.ts` will fail on a stray space. Prose *outside* the fences is free.
- The `simple-english` project skill (`.claude/skills/simple-english/SKILL.md`) governs the
  documentation register in this repo; the catalog's newer sections (e.g. `:1531`, `:1546`) are
  already written in it. Match the surrounding register per the surgical-changes rule.

## Common Pitfalls

### Pitfall: assuming `info.ts` is binary

**What goes wrong:** A task is written to work around `grep` skipping `info.ts`, or a verification
step asserts that `grep` fails on it.
**Why it happens:** The requirement text and D-98-10 state the NUL byte as present tense; it was
true historically and is not true now.
**How to avoid:** The rule (read with Node `fs`) stands; the workaround does not. Note the
resolution in the gate header.
**Warning signs:** A plan task mentioning "binary file" or a `--binary-files=text` flag.

### Pitfall: closing an import cycle for the IN-07 shared shape

**What goes wrong:** `install.ts` imports `EnableDegradationSignals` from `enable-disable.ts`, which
already imports `runInstallLedger` from `install.ts`. ESM tolerates type-only cycles but the moment
anyone converts it to a value import it becomes a live initialization hazard, and no lint rule
catches it (`import-x/no-cycle` is not configured).
**How to avoid:** Put the shared shape in `orchestrators/plugin/shared.ts`, imported by both.
**Warning signs:** A diff adding `from "./enable-disable.ts"` to `install.ts`.

### Pitfall: byte-pinned catalog tests tripping on the new rendered forms

**What goes wrong:** WR-06 and WR-02 both change rendered bytes. `catalog-uat.test.ts` fails with a
byte diff, and so does the corresponding orchestrator suite.
**How to avoid:** Ship the catalog state, the `FIXTURES` entry, and the row assertion in the same
commit as the behavior change (D-98-03, and house convention).
**Warning signs:** A wave that lands a carrier without a `docs/output-catalog.md` edit.

### Pitfall: the two severity raises in `freshEnableRow` colliding

**What goes wrong:** WR-06 replaces `severity = malformed.length > 0 ? "warning" : "info"` with
`companionSeverity(...)`, silently losing the WARN-01 malformed raise.
**How to avoid:** Compose — `warning` if either rule says `warning`.
**Warning signs:** An existing malformed-enable assertion flipping from `warning` to `info`.

### Pitfall: `process.chdir` in the LIFE-06 end-to-end test

**What goes wrong:** `updateSinglePlugin` reads `process.cwd()`; a project-scope fixture forces a
chdir, which is process-global and unsafe under `node --test` concurrency.
**How to avoid:** Use `scope: "user"` with `withHermeticHome` — `locationsFor("user", cwd)` ignores
`cwd`.
**Warning signs:** `process.chdir` anywhere in a new test.

### Pitfall: importing a `*.test.ts` for COMPAT-01 delegation

**What goes wrong:** `node:test` re-registers the imported file's top-level `test()` calls, so the
network gate runs twice and the reported counts mislead.
**How to avoid:** Extract to `tests/helpers/`, or meta-assert on the file's text.
**Warning signs:** `import ... from "./no-orchestrator-network.test.ts"`.

### Pitfall: comment-policy violations in new test titles

**What goes wrong:** A test titled `"Phase 98: LIFE-04 …"` or a comment citing `Wave 2`.
**How to avoid:** Cite `LIFE-04` / `COMPAT-01` / `D-98-12` only. Decision and requirement IDs are
explicitly allowed anchors `[VERIFIED: .claude/rules/typescript-comments.md]`.

### Pitfall: `sonarjs/cognitive-complexity` on touched functions

**What goes wrong:** `freshEnableRow` and `composeOutcomeRow` both gain branches. The ceiling is 15
and it is an **error**, not a warning `[VERIFIED: .planning/codebase/CONVENTIONS.md]`.
`runThreePhaseUpdate` already carries an explicit
`// eslint-disable-next-line sonarjs/cognitive-complexity` at `update.ts:1552`.
**How to avoid:** Extract a small `enableRowDependencies(outcome)` helper rather than inlining two
more conditionals into `freshEnableRow`. Also mind `sonarjs/no-nested-conditional` (error) and
`@stylistic/padding-line-between-statements` (blank line after every block-like statement).

## Code Examples

### Enumeration-equality assertion (COMPAT-01, D-98-08)

```ts
// Pattern derived from tests/architecture/notify-closed-set-locks.test.ts (counts) and
// the deepEqual idiom used throughout tests/orchestrators/.
import {
  MARKETPLACE_STATUSES,
  PLUGIN_STATUSES,
  REASONS,
  STATUS_TOKENS,
} from "../../extensions/pi-claude-marketplace/shared/notify.ts";

test("COMPAT-01: STATUS_TOKENS is exactly the 24 members this milestone inherited", () => {
  assert.deepEqual(
    [...STATUS_TOKENS],
    [
      "installed", "updated", "reinstalled", "uninstalled", "added", "removed",
      "available", "unavailable", "upgradable", "skipped", "failed",
      "rollback failed", "manual recovery", "no marketplaces", "no plugins",
      "will install", "will uninstall", "will enable", "will disable", "disabled",
      "partially-installed", "partially-upgradable", "partially-available", "remote",
    ],
  );
});
```

### Record field-set assertion (COMPAT-01, no new field / no migration)

```ts
// PLUGIN_INSTALL_RECORD_SCHEMA is module-private today; export it for this gate.
test("COMPAT-01: the install record grew no manifest-snapshot or orphan field", () => {
  assert.deepEqual(Object.keys(PLUGIN_INSTALL_RECORD_SCHEMA.properties).sort(), [
    "compatibility", "enabled", "installedAt", "resolvedSha", "resolvedSource",
    "resources", "updatedAt", "version",
  ]);
});

test("COMPAT-01: the state schema version union is unchanged and the default still writes 2", () => {
  assert.deepEqual(STATE_SCHEMA.properties.schemaVersion.anyOf.map((s) => s.const), [1, 2]);
  assert.equal(DEFAULT_STATE.schemaVersion, 2);
});
```

*(The `anyOf`/`const` access shape is typebox-version-dependent — confirm the exact runtime shape at
plan time by logging `STATE_SCHEMA.properties.schemaVersion`; if it is awkward, assert against
`STATE_VALIDATOR` behavior instead: `schemaVersion: 3` must fail validation.)*

### LIFE-05 marketplace-bulk test (mirrors PUP-5 exactly)

```ts
// Derived verbatim from tests/orchestrators/plugin/update.test.ts:425-463; only `target` differs.
test("LIFE-05: marketplace-bulk update renders `(skipped) {not in manifest}` for a state-only record", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "update-life05-mp-"));
    try {
      const seeded = await seedPathMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        manifestPlugins: { hello: { version: "1.0.0", hasSkill: true } },
        installedVersions: { hello: "1.0.0" },
      });
      await rewriteManifest(seeded.manifestPath, "mp", {});

      const { ctx, pi, notifications } = makeCtx();
      await updatePlugins({
        ctx, pi, scope: "project", cwd,
        target: { kind: "marketplace", marketplace: "mp" },
      });

      assert.equal(
        notifications[0]?.message ?? "",
        "A plugin operation needs attention.\n\n● mp [project]\n  ⊘ hello v1.0.0 (skipped) {not in manifest}",
      );
      assert.equal(notifications[0]?.severity, "warning");
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});
```

### Hooks seed for the LIFE-04 per-kind case

```ts
// Source path from bridges/hooks/stage.ts:34-36 (hookConfigPathFor).
const hooksFile = path.join(locations.hooksDir, plugin, "hooks.json");
await mkdir(path.dirname(hooksFile), { recursive: true });
await writeFile(hooksFile, JSON.stringify({ hooks: {} }));
// ... and the record slot:
makePluginRecord({ hooks: [plugin] })
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Literal NUL byte in `info.ts`'s hook-dedup key | `\u0000` escape with an explanatory comment | before this phase | The D-98-10 grep hazard is historical; the rule remains, the workaround is moot |
| `isRecordedButDisabled` reads empty-resources + `installable === true` | reads `!record.enabled` alone | ENBL-05 (Phase 97) | `reconcile/README.md:34` is now wrong (DOC-08 defect 6) |
| `(disabled)` used `◌` | `(disabled)` uses `◍`; `◌` is `(remote)` | D-80-01 | PRD PL-4 glyph meanings are now wrong |
| List inventory rows omit `reasons` | `list.ts` stamps `reasons` and `LIST_RENDER.installed` forwards them | INV-01 (Phase 95) | `notify.ts:2178-2186` comments are now wrong (DOC-08 defect 7) |
| `REASONS` held 37 members | 38 (`unsupported component` added, D-90-05) | D-90-05 | `notify-reasons.ts` header is now wrong (DOC-08 defect 5) |

**Deprecated/outdated:**

- The PRD's `(present)` status token — not a `STATUS_TOKENS` member.
- `ARCHITECTURE.md`'s claim that circular imports are "enforced by `eslint-plugin-import-x`'s
  no-cycle rule" — no such rule is configured. Out of DOC-08's named scope (`.planning` doc), but
  worth a backlog note.

## Runtime State Inventory

Not a rename/refactor/migration phase in the sense this section targets — no string is being
renamed across stored data, live service config, OS registrations, secrets, or build artifacts.
For completeness, checked explicitly:

| Category | Items Found | Action Required |
|----------|-------------|-----------------|
| Stored data | None — this phase writes no new state field and performs no data migration (COMPAT-01 forbids both) | none |
| Live service config | None — no external service configuration is involved | none |
| OS-registered state | None — the extension registers nothing at the OS level | none |
| Secrets/env vars | None new. Existing test-only vars unchanged: `PI_SUBAGENTS_ROOT`, `TEST_CONCURRENCY`, `PI_CODING_AGENT_DIR`, `PI_CM_E2E_REF` | none |
| Build artifacts | None — no build step exists (`tsc --noEmit`; Node runs `.ts` natively) | none |

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | every suite | ✓ | v22.22.2 (engines require `>=20.19.0`) | — |
| `pi-subagents` global peer | two integration tests that resolve it via `PI_SUBAGENTS_ROOT` | ✓ | present at `/home/acolomba/.pi/agent/npm/node_modules/pi-subagents` | those two tests skip when absent (CI path) |
| `pre-commit` | the commit protocol | assumed present (CLAUDE.md mandates it) | — | none — a failed hook means the commit did not happen |
| `trufflehog` (from the pre-commit cache) | worktree commit protocol | assumed present | — | none |
| Network | nothing in this phase | not needed | — | — |

**Missing dependencies with no fallback:** none.

**Test invocation note (carried from the phase brief and consistent with `package.json`):**
run the suite with
`PI_SUBAGENTS_ROOT=/home/acolomba/.pi/agent/npm/node_modules/pi-subagents npm run check`, and
capture the exit code directly — never through a pipe, which masks it. IDE diagnostics on `.ts`
files in this harness are stale noise; trust `npm run typecheck`.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | `node:test` (Node 22.22.2 built-in) + `node:assert/strict` |
| Config file | none — the glob lives in `package.json` `scripts.test` |
| Quick run command | `node --test "tests/orchestrators/plugin/update.test.ts"` (single file; substitute the file under edit) |
| Full suite command | `PI_SUBAGENTS_ROOT=/home/acolomba/.pi/agent/npm/node_modules/pi-subagents npm run check` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| LIFE-04 | Uninstall of a manifest-absent record removes the skill artifact + the install record | unit | `node --test tests/orchestrators/plugin/uninstall.test.ts` | ✅ (extend) |
| LIFE-04 | …the command artifact | unit | same | ✅ (extend) |
| LIFE-04 | …the agent file + its `agents-index.json` row | unit | same | ✅ (extend) |
| LIFE-04 | …the staged `<hooksDir>/<plugin>/hooks.json` | unit | same | ✅ (extend; `seedFullPlugin` needs a hooks seed) |
| LIFE-04 | …the owned `mcp.json` server entry | unit | same | ✅ (extend; currently seeded but unasserted) |
| LIFE-05 | Targeted update renders `(skipped) {not in manifest}` | unit | `node --test tests/orchestrators/plugin/update.test.ts` | ✅ (PUP-5, already passing) |
| LIFE-05 | Marketplace-bulk update renders the same row | unit | same | ❌ new test |
| LIFE-05 | Global-bulk (`kind: "all"`) update renders the same row | unit | same | ❌ new test |
| LIFE-06 | Autoupdate cascade mapper renders the row from a skipped outcome | unit | `node --test tests/orchestrators/marketplace/update.test.ts` | ❌ new test |
| LIFE-06 | Autoupdate cascade end-to-end via the real `updateSinglePlugin` | integration-ish unit | same | ❌ new test (user scope + hermetic HOME) |
| COMPAT-01 | The four closed sets equal their literal member lists | architecture | `node --test tests/architecture/<new>.test.ts` | ❌ new file |
| COMPAT-01 | Exactly seven `ICON_` glyph exports, each byte-exact | architecture | same | ❌ new file |
| COMPAT-01 | No schema-version bump; the record key set is unchanged | architecture | same | ❌ new file |
| COMPAT-01 | No new network path (delegated to the existing gate) | architecture | `node --test tests/architecture/no-orchestrator-network.test.ts` | ✅ (delegate) |
| DOC-08 | Every catalog fenced block still matches `notify()` byte-for-byte after the prose sweep | architecture | `node --test tests/architecture/catalog-uat.test.ts` | ✅ existing |
| DOC-08 | Retired vocabulary is not reintroduced into the rewritten docs | architecture | `node --test tests/architecture/partial-vocabulary-guard.test.ts` | ✅ existing |
| IN-07 | Reconcile install row renders `{orphan rewake}` | unit | `node --test tests/orchestrators/reconcile/notify.test.ts` | ✅ (mirror the enable-arm case) |
| WR-06 | Both enable arms render `{requires pi-subagents}` and take the SEV-01 raise | unit | `node --test tests/orchestrators/plugin/enable-disable.test.ts tests/orchestrators/reconcile/notify.test.ts` | ✅ (extend) + catalog fixture |
| WR-02 | A failed enable with a stale gate renders the `--partial` remediation trailer | unit | `node --test tests/orchestrators/plugin/enable-disable.test.ts` | ✅ (extend) + catalog fixture |
| WR-04 | `update` without `--partial` reaches the disabled short-circuit | unit | `node --test tests/orchestrators/plugin/update.test.ts` | ❌ new test; existing ENBL-09 header prose must be corrected |

### Sampling Rate

- **Per task commit:** the single suite file(s) the task edited, plus
  `node --test "tests/architecture/**/*.test.ts"` whenever a carrier changed rendered bytes or a
  closed set.
- **Per wave merge:** `npm run typecheck && npm run lint && npm test`.
- **Phase gate:** full `npm run check` green (with `PI_SUBAGENTS_ROOT` set) before
  `/gsd-verify-work`.

### Wave 0 Gaps

- [ ] `tests/architecture/<compat-01-name>.test.ts` — the new COMPAT-01 gate file (D-98-09: one
      file holds all structural clauses).
- [ ] `tests/helpers/source-scan.ts` — optional, only if delegation shape (1) is chosen for D-98-09.
- [ ] `seedFullPlugin` in `tests/orchestrators/plugin/uninstall.test.ts` — extend with a hooks seed
      so the fifth per-kind case has something to assert (D-98-12).
- [ ] Export `PLUGIN_INSTALL_RECORD_SCHEMA` from `persistence/state-io.ts` — test-only widening for
      the record-field-set clause.
- No framework install is needed.

## Security Domain

`security_enforcement` is not set to `false` in `.planning/config.json`, so this section is
included. This phase is characterization coverage, contract gates, and documentation, plus four
small in-tree carriers; it introduces no new input surface, no new file write, and no new network
call.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | No auth surface is touched; the credential path (`platform/git-credential.ts`) is untouched |
| V3 Session Management | no | No sessions |
| V4 Access Control | no | Scope model (SC-1) unchanged; no new scope-crossing operation |
| V5 Input Validation | yes | The typebox `STATE_SCHEMA` / `PLUGIN_INSTALL_RECORD_SCHEMA` remain the validation boundary; COMPAT-01 *pins* them rather than widening them |
| V6 Cryptography | no | None used or added |
| V12 Files & Resources | yes (indirectly reinforced) | NFR-10 containment via `assertPathInside` is untouched; the LIFE-04 hooks assertion exercises `removeHookConfig`'s existing `assertSafeName` + `assertPathInside` chokepoint |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Path traversal via a plugin name into `hooksDir` | Tampering | `assertSafeName(pluginName)` + `assertPathInside(locations.hooksDir, …)` — already in `bridges/hooks/stage.ts:231-234`; the LIFE-04 hooks case exercises this path |
| Shelling out to a system tool from a test with attacker-influenced input | Tampering / Elevation | D-98-10 forbids `grep` subprocesses outright; the gate reads with Node `fs`. `tests/architecture/no-shell-out.test.ts` already gates this class |
| Silent widening of the persisted record (a field that later flows to disk unvalidated) | Tampering | The COMPAT-01 record-key-set assertion is itself the control |
| Silent introduction of a network call into a read-only orchestrator | Information disclosure | Delegated to `no-orchestrator-network.test.ts`; COMPAT-01 asserts the delegation still covers both `info.ts` surfaces |

No new threat is introduced by this phase. The WR-02 carrier adds one optional boolean to a message
type and one renderer branch — no user-supplied text enters a new position, and the hint literal is
a frozen constant with no interpolation (`notify.ts:2452-2456` states this explicitly).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `typebox` exposes `schema.properties` and `schema.anyOf[].const` at runtime in the shape the example assertions assume | COMPAT-01 clause 3 / Code Examples | The record-field-set and schema-version assertions need a different access shape. Mitigation stated inline: log the runtime shape at plan time, or assert via `STATE_VALIDATOR` behavior (`schemaVersion: 3` must fail) instead |
| A2 | `enable-disable.ts`'s emit site holds a `pi: ExtensionAPI` reference usable for the `softDepStatus(pi)` probe `companionSeverity` needs | WR-06 | If the probe is not reachable at the row-composition point, WR-06 needs an extra threading hop. `EnableDisablePluginOptions.pi` exists (`:181-182`), so the risk is low but the *row composer* is a pure function that may not receive it |
| A3 | The catalog's brace-bearing-variant count claim (DOC-08 defect 3) is genuinely stale | DOC-08 | The requirement asserts staleness; the exact numeric claim was not isolated to a single line this session. Verify the specific sentence before editing, and if it is already correct, record that and move on |
| A4 | Extending the WR-02 trailer gate to `p.status === "failed"` affects no *other* failed row | WR-02 | Other failed rows never set `partialHint` (the field does not exist on `PluginFailedMessage` today), so the gate is inert for them by construction. Low risk, but the plan should assert one unrelated failed row stays byte-identical |
| A5 | `pre-commit` and the cached `trufflehog` binary are installed on this machine | Environment | Commit tasks fail; recovery is documented in CLAUDE.md |

## Open Questions

1. **Which delegation shape for D-98-09?**
   - What we know: importing a `*.test.ts` re-registers its tests; two clean alternatives exist
     (extract a helper into `tests/helpers/`, or meta-assert on the gate file's text).
   - What's unclear: whether the operator's "one file tells the whole contract" preference is better
     served by a shared helper (mechanical delegation) or a meta-assertion (documentary delegation).
   - Recommendation: extract the helper — it is the house pattern and makes the delegation real
     rather than narrative. Narrate it in the gate's header either way.

2. **Should WR-04's direction-2 catalog change get its own state, or amend an existing one?**
   - What we know: `update` (no flag) on a disabled partial moves from a `(skipped)` + hint row to
     the `(unchanged)` byte form the `--partial` path already produces.
   - What's unclear: whether the `(unchanged)` form is already a catalog state reachable from this
     input, in which case the amendment is prose-only.
   - Recommendation: resolve at plan time by grepping the catalog's `## /claude:plugin update`
     section for the `unchanged` state; prefer amending over adding.

3. **Does DOC-08 defect 3 (brace-variant count) still exist?**
   - What we know: the Conventions section enumerates brace-bearing variants; the specific numeric
     claim was not isolated this session.
   - Recommendation: verify before editing; if already correct, record the verification in the
     plan's notes so the requirement is closed honestly rather than silently.

## Sources

### Primary (HIGH confidence)

All findings in this document were read directly from the working tree at
`/home/acolomba/pi-claude-marketplace/.worktrees/manifest-independent-plugin-info` on 2026-08-09.

- `extensions/pi-claude-marketplace/shared/notify.ts` — closed-set tuples (`:90`, `:243-288`,
  `:472-509`, `:524-532`), glyph constants (`:1546-1593`), `PluginFailedMessage` (`:918-938`),
  hint trailers (`:2447`, `:2458-2459`), `renderPluginRow` (`:2172-2199`), trailer gates
  (`:3726-3738`)
- `extensions/pi-claude-marketplace/shared/notify-reasons.ts` — full file (topic groups, the
  37→38 header defect, `skipSeverity`, `companionSeverity`, `malformedReasonsForKinds`)
- `extensions/pi-claude-marketplace/orchestrators/plugin/update.ts` — `:170-248`, `:533-592`,
  `:880-970`, `:972-1122`, `:1340-1396`, `:1547-1600`, `:2655-2778`
- `extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts` — `:44-59` (import list)
- `extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts` — `:96-218`,
  `:218-325`, `:990-1215`
- `extensions/pi-claude-marketplace/orchestrators/plugin/install.ts` — `:218-252`, `:381-382`,
  `:1725-1865`
- `extensions/pi-claude-marketplace/orchestrators/plugin/plugin-state-classifier.ts` — full file
- `extensions/pi-claude-marketplace/orchestrators/plugin/list.ts` — `:335-346`, `:430-569`
- `extensions/pi-claude-marketplace/orchestrators/plugin/info.ts` — `:405-441` (the escape comment)
- `extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts` — `:520-629`, `:690-759`
- `extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts` — `:307-415`
- `extensions/pi-claude-marketplace/orchestrators/reconcile/apply-outcomes.ts`,
  `apply.ts`, `notify.ts`, `README.md:26-41`
- `extensions/pi-claude-marketplace/persistence/state-io.ts` — `:30-209`
- `extensions/pi-claude-marketplace/persistence/locations.ts` — `:82-89`, `:144-212`
- `extensions/pi-claude-marketplace/bridges/hooks/stage.ts` — `:34-36`, `:176-238`
- `extensions/pi-claude-marketplace/edge/completions/data.ts` — `:20-113`
- `extensions/pi-claude-marketplace/shared/completion-cache.ts` — `:116-130`
- `extensions/pi-claude-marketplace/edge/handlers/tools.ts` — `:161`, `:327`, `:403`
- `tests/architecture/{no-orchestrator-network,notify-closed-set-locks,catalog-uat,partial-vocabulary-guard,markers-snapshot,notify-producer-wire-coverage,notify-stamp-coverage,import-boundaries}.test.ts`
- `tests/orchestrators/plugin/{update,uninstall,plugin-state-classifier}.test.ts`,
  `tests/orchestrators/marketplace/{update,cascade}.test.ts`, `tests/orchestrators/edge-deps.test.ts`
- `docs/output-catalog.md` — `:54`, `:62`, `:133-159`, `:167`, `:331`, `:372-423`, `:1445`,
  `:1480-1546`, `:1606`, `:1662-1672`, `:2201`
- `docs/prd/pi-claude-marketplace-prd.md` — `:346-420`
- `.planning/REQUIREMENTS.md` (LIFE-04/05/06, COMPAT-01, DOC-08, traceability table),
  `.planning/STATE.md` (`:200-260`), `.planning/config.json`, `package.json`, `eslint.config.js`
- `.planning/todos/pending/2026-08-09-{install-arm-orphan-rewake-asymmetry,enable-row-suppresses-soft-dep-markers,enable-partial-remediation-affordance,update-partial-completion-excludes-disabled-records}.md`
  and `2026-08-08-notify-stale-comments-doc08-reconciliation.md`
- `CLAUDE.md`, `.claude/rules/typescript-comments.md`,
  `.planning/codebase/{STACK,CONVENTIONS,ARCHITECTURE}.md`

### Secondary (MEDIUM confidence)

None — no web or external documentation lookup was performed. The phase's entire technical domain
is this repository.

### Tertiary (LOW confidence)

None.

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — no new dependency; every tool named was verified in `package.json` or by
  invocation.
- Architecture: HIGH — every seam was opened and read; line ranges are cited and values quoted
  verbatim.
- Pitfalls: HIGH — the NUL-byte resolution, the import-cycle hazard, the `process.cwd()` fixture
  hazard, and the `node:test` import hazard were each verified against the tree rather than assumed.
- WR-04 recommendation: HIGH on the mechanics (both directions' touch-sets were enumerated from
  source), MEDIUM on the byte-form consequence of direction 2 (the exact current no-flag row for a
  disabled partial was derived from `resolveUpdateCandidate`'s decline arm rather than observed from
  a test run — Open Question 2 closes this at plan time).

**Research date:** 2026-08-09
**Valid until:** 2026-09-08 (30 days — the subject is a stable in-repo codebase; the only
invalidator is further work on this same branch)
