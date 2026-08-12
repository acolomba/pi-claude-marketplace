# Phase 99: Post-audit tech-debt closure - Research

**Researched:** 2026-08-10
**Domain:** In-repo refactor + contract/documentation closure (TypeScript, node:test, no new dependencies)
**Confidence:** HIGH (every finding read out of the working tree this session)

## Summary

This phase has no external technical domain. Every item is an in-tree structural
change against contracts the repo already enforces with its own architectural
tests. The research therefore reads the live source and reports what a plan must
account for: the exact shapes, the exact byte-pinned suites, and one ordering
hazard that will otherwise produce a TypeScript error mid-phase.

The one non-obvious finding: **D-99-02c (rename the string-array
`stagedAgents`/`stagedMcpServers`) and D-99-03 work item 1 (make
`PluginUpdateUpdatedOutcome` inherit the shared `LedgerDegradationSignals`)
collide at the type level.** `LedgerDegradationSignals` declares
`stagedAgents?: boolean`; `PluginUpdateUpdatedOutcome` declares
`stagedAgents: readonly string[]`. An `extends` across those two is a
`TS2430` incompatible-property-declaration error. `install.ts` already dodges it
with `Omit<LedgerDegradationSignals, "stagedAgents" | "stagedMcpServers">`. The
rename must land BEFORE (or in the same task as) the inheritance, or the plan
must accept the `Pick`/`Omit` workaround permanently — which is exactly the
type-confusion hazard the audit item exists to remove.

The second correction to the phase's inherited framing: the string-array
collision is **not confined to `reinstall.ts`**. It is declared on TWO outcome
interfaces in `orchestrators/types.ts` and populated by `update.ts` as well as
`reinstall.ts`. Bounding the rename to reinstall alone leaves half the hazard in
place, and leaves the D-99-03 collision unresolved.

**Primary recommendation:** sequence the phase as (1) rename both string-array
field pairs in `orchestrators/types.ts` + both producers + their test consumers,
(2) WR-12 threading, now able to inherit cleanly, (3) the `ManifestLookup`
export, (4) the drift-gate widening, (5) the doc deferrals, (6) resolvedSource,
(7) the bounded coverage sweep. Items 3-7 are mutually independent.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-99-01:** All four debt groups land in this phase; none re-deferred.
  Runtime UAT before archive was explicitly waived (coverage judged
  sufficient).
- **D-99-02 (fragility trio):** (a) export the `ManifestLookup` discriminant
  from its authoring module and make info's and update's absence judgments
  consume the value/derivation rather than re-implementing the
  successful-read + exact-identity rule; (b) widen the ENBL-05 drift-gate
  regexes to catch destructured `{ enabled }`, bracket access, and
  `Boolean(...)` comparison twins (verify each new pattern flags a planted
  twin and does not flag the legitimate consumers); (c) rename reinstall's
  `stagedAgents`/`stagedMcpServers` string-array fields apart from the shared
  `LedgerDegradationSignals` boolean names.
- **D-99-03 (WR-12):** thread degradation signals through the update verb per
  the carrier's seven work items (`.planning/todos/pending/`
  `2026-08-10-update-verb-drops-degradation-signals.md`) — optional `reasons`
  on the updated transition variant, WARN-01 raise, BOTH the central renderer
  arm AND `update.messaging.ts` (the WR-09 lesson), catalog state +
  style-guide amendment. Note the carrier's dropped-vs-malformed axis table:
  `partialDegrade` covers dropped kinds; malformed kinds are the gap.
- **D-99-04 (doc deferrals):** catalog state + FIXTURES entry for the
  version-less autoupdate cascade skip row; correct the description-bearing
  variant count (9, not 7); re-anchor or drop residual `RLD-04`/`D-08` at the
  six sites in `list.ts` (4) and `list.messaging.ts` — NOT the four files
  where `D-08` legitimately carries its other meaning.
- **D-99-05 (legacy carriers):** (a) stale-resolvedSource fix per the
  carrier's option 1 (`2026-08-09-disabled-record-stale-resolvedsource-on-`
  `unchanged-version.md` — the deep-equal guard drafted and reverted in the
  97 fix loop becomes load-bearing so an unchanged version with a moved
  source still refreshes); (b) the 2026-06-12 coverage sweep bounded to the
  todo's named rare-failure arms in update/reinstall/install — no open-ended
  expansion.

### Claude's Discretion
Module placement for the exported absence discriminant (respect layer
boundaries — list.ts currently authors it; a shared home must not create
cycles), plan/wave structure, exact regex forms for the drift gate, the
renamed reinstall field names, and fixture design for the coverage sweep.

### Deferred Ideas (OUT OF SCOPE)
None — the operator explicitly pulled every open item into scope.
</user_constraints>

## Project Constraints (from CLAUDE.md)

- Never commit to `main`; work stays on `features/manifest-independent-plugin-info`.
- Conventional Commits; title 5-72 chars; body lines ≤80; **no GSD milestone/phase
  mentions in commit messages or PR titles**.
- `pre-commit run --files <changed>` BEFORE `git commit`; never `--no-verify`;
  never `--amend` to recover from a hook failure.
- Worktree commits: `SKIP=trufflehog` only after a clean filesystem-mode
  TruffleHog scan (`--results=verified,unknown --fail`) over the changed paths.
- `npm run check` must stay green (NFR-6).
- Comments cite durable spec IDs (`D-NN`, `WR-NN`, `NFR-N`, …), never
  `Phase NN` / `Plan NN` / `Wave N` / `Pitfall N` (`.claude/rules/typescript-comments.md`).
- All user-visible output through `shared/notify.ts` (IL-2).
- ESLint: `sonarjs/cognitive-complexity` ceiling 15; explicit return types on
  every exported function; `import-x/order` groups with type-only imports last.

<phase_requirements>
## Phase Requirements

The phase carries no `REQ-ID`s from REQUIREMENTS.md; its spec is the audit's
`tech_debt` frontmatter plus the three carrier todos. The decision IDs act as
the requirement IDs.

| ID | Description | Research Support |
|----|-------------|------------------|
| D-99-02a | Export `ManifestLookup`; info + update consume it | §Item 1 — exact shape, three call sites, cycle-free home |
| D-99-02b | Widen the ENBL-05 drift gate | §Item 2 — the three live regexes verbatim, twin designs, false-positive survey |
| D-99-02c | Rename the string-array staged fields | §Item 3 — the collision is on TWO interfaces, not one; full consumer list |
| D-99-03 | WR-12: degradation signals through `update` | §Item 4 — the `reinstall` composer to copy, verbatim |
| D-99-04 | Three doc deferrals | §Item 5 — exact line numbers for all three |
| D-99-05a | Stale `resolvedSource` on unchanged version | §Item 6 |
| D-99-05b | Bounded coverage sweep | §Item 7 |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Manifest-membership rule (`declared`/`absent`/`unverified`) | `domain/` | `orchestrators/plugin/` | Pure, network-free resolution over an already-loaded `MarketplaceManifest` — the exact charter of `domain/` per ARCHITECTURE.md. All three consumers already import `domain/manifest.ts`. |
| Soft-read wrapper (`ScopedManifest`, ok/err) | `orchestrators/plugin/list.ts` | — | It is a per-surface I/O outcome, not a domain fact; list is the only surface that continues past a failed read. |
| Degradation-signal shape | `orchestrators/plugin/shared.ts` | — | Already the declared home (`LedgerDegradationSignals`), placed there specifically to avoid the `install.ts` ↔ `enable-disable.ts` cycle (IN-07 / D-98-01). |
| Row composition from an outcome | verb module (`reinstall.ts`, `update.ts`) | `shared/notify.ts` | WR-09 pattern: ONE composer per row, so standalone and cascade cannot drift. |
| Rendered vocabulary (reasons, tokens, glyphs) | `shared/notify.ts` + `notify-reasons.ts` | `docs/output-catalog.md` | Closed sets pinned by COMPAT-01; catalog is byte-equal to the renderer. |
| Structural drift enforcement | `tests/` (architectural tests) | — | This repo enforces boundaries with source-walking tests, not lint rules. |

## Standard Stack

No new dependency is required or permitted by this phase. Everything used is
already in the tree.

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `node:test` | Node ≥20.19.0 built-in | every suite | repo-wide test runner [VERIFIED: package.json `scripts.test` = `node --test ... "tests/{architecture,bridges,docs,domain,edge,helpers,orchestrators,persistence,platform,shared,transaction}/**/*.test.ts"`] |
| `typescript` | `^6.0.3` | `tsc --noEmit` typecheck | [VERIFIED: package.json `scripts.typecheck` = `tsc --noEmit`] |
| `eslint` | `^10.4.0` | `eslint extensions tests eslint.config.js` | [VERIFIED: package.json `scripts.lint`] |
| `prettier` | `^3.8.3` | `prettier --check "**/*.{js,json,ts}"` | [VERIFIED: package.json `scripts.format:check`] |

### Alternatives Considered
None. Adding a library to close in-tree tech debt would itself be new debt.

**Installation:** none.

## Package Legitimacy Audit

**Not applicable.** This phase installs no external packages. No registry
lookup, no `SLOP`/`SUS` verdict, no `checkpoint:human-verify` gate is needed.

## Item 1 — D-99-02a: export the `ManifestLookup` discriminant

### The authoring site (verbatim)

`extensions/pi-claude-marketplace/orchestrators/plugin/list.ts:870-874`
[VERIFIED: extensions/pi-claude-marketplace/orchestrators/plugin/list.ts:870-874]:

```ts
type ManifestLookup =
  | { readonly kind: "declared"; readonly entry: MarketplaceManifest["plugins"][number] }
  | { readonly kind: "absent" }
  | { readonly kind: "unverified" };
```

The derivation, `list.ts:885-892`
[VERIFIED: extensions/pi-claude-marketplace/orchestrators/plugin/list.ts:885-892]:

```ts
function manifestLookupFor(scopedManifest: ScopedManifest, pluginName: string): ManifestLookup {
  if (!scopedManifest.ok) {
    return { kind: "unverified" };
  }

  const entry = scopedManifest.manifest.plugins.find((p) => p.name === pluginName);
  return entry === undefined ? { kind: "absent" } : { kind: "declared", entry };
}
```

`ScopedManifest` is declared at `list.ts:870` region and consumed at
`list.ts:804`, `:911`, `:1099`, `:1114` [VERIFIED: grep over `extensions/` returns
those five `ScopedManifest` hits and no others].

### What the other two surfaces actually do

They do **not** have a `ScopedManifest`. Their read-failure handling is
structurally different, and that is the crux of the placement decision.

- `info.ts:832-843` [VERIFIED: extensions/pi-claude-marketplace/orchestrators/plugin/info.ts:832-843]:
  `loadMarketplaceManifest` inside `try/catch`; the catch **returns a `failed`
  row** (`reasons: [narrowProbeError(err)]`). On success it does
  `const entry = manifest.plugins.find((p) => p.name === pluginName);` then
  branches on `entry === undefined`.
- `update.ts:1026-1027` [VERIFIED: extensions/pi-claude-marketplace/orchestrators/plugin/update.ts:1026-1027]:
  `const manifest = await loadCachedMarketplaceManifest(mp.manifestPath);` — no
  try/catch here, the read failure **propagates as a throw**; then
  `const entryRaw = manifest.plugins.find((p) => p.name === plugin);`.

So the shared rule is only the *successful-read half*: exact string identity on
`plugins[].name`, no case folding, no Unicode normalization. The `unverified`
arm is list-specific because list is the only surface that continues rendering
past a failed read (BOUND-03 / D-95-05).

### Recommended shape and home

**Home: `extensions/pi-claude-marketplace/domain/manifest.ts`** (or a new
`domain/manifest-lookup.ts` beside it).

Why this is cycle-free and correct:
- `domain/` depends only on `shared/`; orchestrators may import `domain/`
  [CITED: .planning/codebase/ARCHITECTURE.md §Layers].
- All three consumers already import from `domain/manifest.ts`
  [VERIFIED: `list.ts:55`, `info.ts:44`, `update.ts:87` each read
  `import { loadMarketplaceManifest, type MarketplaceManifest } from "../../domain/manifest.ts";`
  (update.ts imports `loadMarketplaceManifest` only)].
- `MarketplaceManifest` is exported from `domain/manifest.ts:37`
  [VERIFIED: extensions/pi-claude-marketplace/domain/manifest.ts:37 —
  `export type MarketplaceManifest = Type.Static<typeof MARKETPLACE_SCHEMA>;`].
- Putting it in `orchestrators/plugin/shared.ts` would also work (no cycle:
  `shared.ts` is imported by install/enable already) but it is a *pure domain
  rule over a domain type* — `domain/` is the honest home and gives the widest
  gate (a future `bridges/` or `edge/` surface can consume it too).

Suggested signature — the pure half in `domain/`, the soft wrapper staying in
`list.ts`:

```ts
// domain/manifest-lookup.ts
export type ManifestLookup =
  | { readonly kind: "declared"; readonly entry: MarketplaceManifest["plugins"][number] }
  | { readonly kind: "absent" }
  | { readonly kind: "unverified" };

/** The successful-read half: exact string identity, no folding, no normalization. */
export function lookupDeclaredPlugin(
  manifest: MarketplaceManifest,
  pluginName: string,
): Extract<ManifestLookup, { kind: "declared" | "absent" }>;
```

`list.ts::manifestLookupFor` then becomes `scopedManifest.ok ?
lookupDeclaredPlugin(scopedManifest.manifest, name) : { kind: "unverified" }`.
`info.ts` and `update.ts` call `lookupDeclaredPlugin` and switch on `.kind`
instead of `entry === undefined`.

**The bar the integration checker set** [CITED:
.planning/v1.18-MILESTONE-AUDIT.md tech_debt]: *"a fourth surface copying the
lookup idiom without the read-success guard would reintroduce the BOUND-03
defect ungated."* Meeting that bar means more than exporting the type — consider
adding a drift gate in the D-99-02b style: a source walk asserting that no file
outside the domain module writes `.plugins.find(` with a `.name ===` predicate.
That is the mechanism that makes a fourth surface *unable* to re-derive.
[ASSUMED] — the audit does not prescribe a gate, only the export; treat the gate
as a recommendation for the planner to accept or drop.

### Tests pinning current absence behavior

Grep the following before editing; each is a byte- or shape-pin on the current
rule and must stay green unchanged (a change here means the refactor was not
behavior-preserving):
- `tests/orchestrators/plugin/list.test.ts` — INV-01 / INV-02 / BOUND-03 rows.
- `tests/orchestrators/plugin/info.test.ts` — INFO-09 / INFO-10 / BOUND-01 /
  BOUND-02 arms.
- `tests/orchestrators/plugin/update.test.ts` — the `{not in manifest}` failed
  and skipped rows.
- `tests/architecture/catalog-uat.test.ts` — the `Manifest-absent inventory
  row (INV-01)` and `Manifest-absent partially-installed inventory row (INV-02)`
  catalog states [VERIFIED: docs/output-catalog.md:410, :421].
[ASSUMED] on the specific test-file paths above: identified from directory
convention and catalog section names, not enumerated by reading each suite.

## Item 2 — D-99-02b: widen the ENBL-05 drift gate

### The live gate (verbatim)

`tests/orchestrators/reconcile/plan.test.ts:741` and `:749-753`
[VERIFIED: tests/orchestrators/reconcile/plan.test.ts:741,749-753]:

```ts
const TWO_AXIS_CONJUNCTION = /compatibility\.installable\s*&&\s*![\w.]+\.enabled/;

const INLINE_REDERIVATIONS: ReadonlyArray<RegExp> = [
  /!\s*[\w.]+\.enabled\b/,
  /\.enabled\s*===\s*false/,
  /\.enabled\s*!==\s*true/,
];
```

Supporting constants [VERIFIED: same file]:
- `:727-732` `FORMER_DEFINITION_SITES` = `reconcile/plan.ts`,
  `plugin/update.ts`, `plugin/enable-disable.ts`,
  `plugin/plugin-state-classifier.ts`.
- `:738` `PREDICATE_DEFINITION_SITE = "extensions/pi-claude-marketplace/persistence/state-io.ts"`.
- `:775-776` `SINGLE_PREDICATE_IMPORT` — the import-presence half.
- `:778-782` `stripComments` — strips block then line comments, applied FIRST.
- `:756+` `extensionSourceFiles()` — whole-tree `.ts` walk under
  `extensions/pi-claude-marketplace/`.
- `:901-903` — the definition site is skipped for `INLINE_REDERIVATIONS` only;
  `TWO_AXIS_CONJUNCTION` is tested against every file including the definition
  site.

Note the deliberate exclusion documented at `:743-748`: `entry.enabled !== false`
is the **config-declaration axis** (`persistence/config-io.ts`), a different fact
about a different object whose default is enabled-when-absent. Any widened
pattern that drops the leading `\.` risks catching it.

### The three missing twins and candidate patterns

| Twin spelling | Example that escapes today | Candidate pattern | False-positive risk |
|---|---|---|---|
| Destructured | `const { enabled } = record; if (!enabled) {` | `/(?:^|[^.\w])!\s*enabled\b/` | HIGH — must not match `!record.enabled` twice (already caught) nor any local named `enabled` that is the config axis. Pair it with a destructuring-presence pattern instead: `/\{[^}]*\benabled\b[^}]*\}\s*=\s*[\w.]+/`. |
| Bracket access | `record["enabled"] === false`, `!record["enabled"]` | `/\[\s*["']enabled["']\s*\]/` | LOW — bracket access to `enabled` has no legitimate use in the tree. Flag the access itself, not the comparison; simplest and strictest. |
| `Boolean()` comparison | `!Boolean(record.enabled)`, `Boolean(record.enabled) === false` | `/Boolean\s*\([^)]*\.enabled[^)]*\)/` | LOW — same reasoning. |

Why the existing regexes miss them: `/!\s*[\w.]+\.enabled\b/` requires `!`
immediately followed by an identifier path ending in `.enabled` — a `(` (Boolean),
a `[` (bracket), or a bare identifier (destructured) all break the match.
[VERIFIED: pattern read verbatim above; the escape is a direct reading of the
regex, not a claim about runtime].

**Recommended posture:** flag the *access shape*, not the comparison. Bracket
access and `Boolean(x.enabled)` have no legitimate use anywhere in this tree, so
matching them unconditionally is both simpler and stricter than trying to match
every negation spelling. Destructuring is the one that needs care: flag
`{ … enabled … } = ` destructuring of a plugin record, and accept that a
legitimate future destructure would have to be allowlisted deliberately — which
is the correct default for a gate whose whole point is that a natural-looking
spelling must not slip through.

### The nine legitimate consumers (must NOT be flagged)

`isRecordedButDisabled` appears in 12 source files and one README
[VERIFIED: `grep -rln` over `extensions/` returns `orchestrators/plugin-path.ts`,
`orchestrators/plugin/plugin-state-classifier.ts`, `orchestrators/plugin/info.ts`,
`orchestrators/reconcile/README.md`, `orchestrators/reconcile/notify.ts`,
`orchestrators/reconcile/types.ts`, `orchestrators/plugin/enable-disable.ts`,
`orchestrators/reconcile/plan.ts`, `persistence/state-io.ts`,
`shared/notify.ts`, `orchestrators/reconcile/apply.ts`,
`orchestrators/plugin/update.ts`, `orchestrators/plugin/list.ts` — 31 total
occurrences]. Note this is a `grep -l` result: it confirms the string occurs in
those files, not what each occurrence does.

### Verification method (mandated by D-99-02b)

For each new pattern, prove BOTH halves:
1. **Catches the planted twin** — a unit assertion `assert.ok(RE.test("<twin
   source line>"))` beside the constant, in the style of the existing
   `GLYPH_DECLARATION` self-test at `tests/architecture/compat-01-no-expansion.test.ts:321-336`
   [VERIFIED: that file's test list includes `COMPAT-01: the glyph-declaration
   pattern recognises every spelling a glyph export can take` with an inline
   `GLYPH_DECLARATION.test("return \`${ICON_EIGHTH} ${name}\`;")` assertion].
   Prefer this to physically planting a twin in a source file — it is
   repeatable, reviewable, and cannot be forgotten in the tree.
2. **Does not fire on the tree** — the existing whole-walk assertion already
   proves this the moment the pattern is added and the suite stays green.

**Regex hazard:** the file's own comment at `:107` warns *"`/g/` regex carries
`lastIndex` across `.test()` calls"* [VERIFIED: tests/architecture/compat-01-no-expansion.test.ts:107].
The drift-gate regexes are correctly non-global; any new pattern must be too, or
it will silently skip files on alternating iterations of the file walk.

## Item 3 — D-99-02c: the staged-field rename (WIDER than the audit states)

### The collision, verbatim

Shared boolean signals, `orchestrators/plugin/shared.ts:84,90`
[VERIFIED: extensions/pi-claude-marketplace/orchestrators/plugin/shared.ts:84,90]:

```ts
  readonly stagedAgents?: boolean;
  readonly stagedMcpServers?: boolean;
```

String arrays on **two** outcome interfaces in `orchestrators/types.ts`
[VERIFIED: extensions/pi-claude-marketplace/orchestrators/types.ts:26-27 and
:148-149]:

```ts
export interface ReinstallReinstalledOutcome extends ReinstallOutcomeBase {
  readonly partition: "reinstalled";
  readonly version: string;
  readonly resourcesChanged: boolean;
  readonly stagedAgents: readonly string[];
  readonly stagedMcpServers: readonly string[];
```

```ts
export interface PluginUpdateUpdatedOutcome extends PluginUpdateBase {
  readonly partition: "updated";
  readonly fromVersion: string;
  readonly toVersion: string;
  readonly stagedAgents: readonly string[];
  readonly stagedMcpServers: readonly string[];
```

**The audit names reinstall only. `update` carries the identical hazard.**

### Producers

- `reinstall.ts:1759-1760` [VERIFIED: extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts:1759-1760]:
  `stagedAgents: resources.agents,` / `stagedMcpServers: resources.mcpServers,`
  followed immediately by `declaresAgents: resources.agents.length > 0,`.
- `update.ts:1898-1899` and `:1940-1943` [VERIFIED: extensions/pi-claude-marketplace/orchestrators/plugin/update.ts:1898-1899,1940-1943]:
  `const stagedAgents = handles.agents.result.recorded.map((r) => r.generatedName);`
  … `stagedAgents,` / `stagedMcpServers,` / `declaresAgents: stagedAgents.length > 0,`.

### Boolean-side consumers (the ones a confusion would hit)

[VERIFIED: grep over `extensions/`, lines quoted]
- `enable-disable.ts:304-305` — `...(ledgerCtx.stagedAgentNames.length > 0 && { stagedAgents: true }),`
- `enable-disable.ts:909-910`, `:1028-1029` — `outcome.stagedAgents === true`
- `reconcile/apply.ts:682-683` — `...(result.stagedAgents === true && { stagedAgents: true }),`
- `shared.ts:101,104,108` — `signals: Pick<LedgerDegradationSignals, "stagedAgents" | "stagedMcpServers">`, `if (signals.stagedAgents === true)`
- `install.ts:258` — `Omit<LedgerDegradationSignals, "stagedAgents" | "stagedMcpServers">`, with the doc comment at `:239` explaining it: *"advertised `stagedAgents` / `stagedMcpServers` that `installPlugin` never …"*.

Note every boolean consumer uses `=== true`, which is why the confusion has not
bitten yet: a `readonly string[]` is not `=== true`. The hazard is a future
`enableRowDependencies(reinstallOutcome)`-shaped call whose parameter is typed
`Pick<LedgerDegradationSignals, …>` — a `readonly string[]` is NOT assignable to
`boolean | undefined`, so TypeScript would in fact reject it. **The realistic
hazard is therefore the reverse: the two names cannot coexist on one interface,
which is what blocks D-99-03.** Rank the rename accordingly — it is an enabler,
not only a hygiene fix.

### Test consumers to update (bounded list)

[VERIFIED: grep over `tests/`]
- `tests/orchestrators/marketplace/update.test.ts` — 22 occurrences, all
  `stagedAgents: []` / `stagedMcpServers: []` object-literal fixtures at
  `:875,876,925,926,1220,1221,1319,1320,1415,1416,1540,1541,1570,1571,1600,1601,1619,1620,1637,1638,1672,1673`.
- `tests/orchestrators/plugin/reinstall.test.ts` — `:343-344` are the two real
  assertions (`assert.deepEqual(outcome.stagedAgents, [\`${GENERATED_AGENT_PREFIX}hello-bot\`])`,
  `assert.deepEqual(outcome.stagedMcpServers, ["server1"])`); `:1563-1564,
  3624-3625, 3647-3648` are literal fixtures.
- `tests/orchestrators/plugin/update.test.ts` — [ASSUMED] additional fixtures
  likely present; the grep above was head-truncated at 30 lines. **The planner
  must re-run `grep -rn "stagedAgents\|stagedMcpServers" tests/ | wc -l` to get
  the true total before bounding the task.**

### Naming

Discretionary. `stagedAgentNames` / `stagedMcpServerNames` mirrors the ledger
context field already named `ledgerCtx.stagedAgentNames`
[VERIFIED: enable-disable.ts:304], which makes the name-vs-flag distinction
self-documenting and matches an existing in-tree precedent. Recommend those.

## Item 4 — D-99-03 (WR-12): degradation signals through `update`

### The composer to copy, verbatim

`reinstall.ts:909-926` [VERIFIED: extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts:909-926]:

```ts
function reinstalledRowFromOutcome(
  outcome: ReinstallReinstalledOutcome,
  rowScope: Scope | undefined,
): PluginReinstalledMessage {
  const malformed = malformedReasonsForKinds(outcome.degradedKinds);
  return {
    status: "reinstalled",
    name: outcome.name,
    dependencies: dependenciesFromOutcome(outcome),
    ...(outcome.version !== "" && { version: outcome.version }),
    ...(rowScope !== undefined && { scope: rowScope }),
    ...(malformed.length > 0 && { reasons: malformed }),
    severity: malformed.length > 0 ? "warning" : "info",
```

The reason-mapping helper already exists and needs no change
[VERIFIED: extensions/pi-claude-marketplace/shared/notify-reasons.ts:176-187]:

```ts
export function malformedReasonsForKinds(
  kinds: Iterable<DegradeKind> | undefined,
): readonly FailureReason[] {
  if (kinds === undefined) {
    return [];
  }

  const present = new Set(kinds);
  return DEGRADE_KIND_ORDER.filter((kind) => present.has(kind)).map(
    (kind) => MALFORMED_REASON_BY_KIND[kind],
  );
}
```

Collection site to mirror, `reinstall.ts:1740` [VERIFIED: grep — `const degradedKinds = Array.from(`]
and `:1764` `...(degradedKinds.length > 0 && { degradedKinds }),`.

### Where the update signals come from

`update.ts:1170` `handles.skills = await prepareStageSkills({…})` and `:1181`
`handles.commands = await prepareStageCommands({…})`
[VERIFIED: extensions/pi-claude-marketplace/orchestrators/plugin/update.ts:1170,1181].
The success-outcome site is `update.ts:1898-1943` — the same function that
already maps `handles.agents.result.recorded` and `handles.mcp.result.recorded`,
so `handles.skills.result.degraded` / `handles.commands.result.degraded` are in
scope with no plumbing.

### Render sites — BOTH, per the WR-09 lesson

1. Central: `shared/notify.ts` has `case "updated":` at **:1745** and **:2237**
   [VERIFIED: grep — two `case "updated"` hits]. The plan must determine which is
   `renderPluginRow` and which is the second switch (likely a severity or
   dependency reducer) and thread the field through the correct one — **and check
   whether the second also needs it**. Two arms with the same label is precisely
   the shape that produced WR-09.
2. Verb-local: `orchestrators/plugin/update.messaging.ts:62` — the `updated:`
   entry of the command-local render map [VERIFIED: grep line `62: updated: (p, probe, mpScope) =>` and `:68: "(updated)",`].
   The file's own comment at `:75` already says *"fire on a degraded update
   exactly as on a clean `(updated)` row"* — evidence a prior pass anticipated
   this.

### The message type

`shared/notify.ts:697-703` [VERIFIED: extensions/pi-claude-marketplace/shared/notify.ts:697-703]:

```ts
export interface PluginUpdatedMessage extends TransitionMessageBase {
  readonly status: "updated";
  readonly name: string;
  readonly from: string;
  readonly to: string;
  readonly dependencies: readonly Dependency[];
  readonly scope?: Scope;
```

— no `reasons`. The sibling `PluginReinstalledMessage` at `:717` is preceded by
the WR-09 doc block at `:709-716` stating *"`reasons` is OPTIONAL here, exactly
as on `PluginInstalledMessage` … Absent `reasons` renders the legacy brace-less
row byte-for-byte"* [VERIFIED: same file]. Copy that doc block's contract onto
`PluginUpdatedMessage`.

`shared/notify.ts:2175` carries the WR-13 note — *"carries no `reasons` field.
That gap is a known one: `update` stages through …"* [VERIFIED: notify.ts:2175] —
which is the `installedLikeRow` helper's comment (`:2183-2190` show its param
list ending `reasons: readonly ContentReason[] | undefined,`). **That comment must
be corrected in this phase**, or the tree ships a doc statement that the code has
just falsified — the exact defect class 98-06 spent a plan removing.

### No new reason token is needed — COMPAT-01 stays green

`malformedReasonsForKinds` returns members of the existing closed `REASONS` set
(`{malformed skill}` / `{malformed command}`), already emitted by the reinstall
row [VERIFIED: notify-reasons.ts:176-187 + reinstall.ts:913]. The COMPAT-01 gate
pins `REASONS`, `STATUS_TOKENS`, `PLUGIN_STATUSES`, `MARKETPLACE_STATUSES`, glyph
code points, the install-record key set, the install-outcome signal set, and the
state-schema version union [VERIFIED: tests/architecture/compat-01-no-expansion.test.ts
test names at :126, :173, :206, :234, :250, :274, :301, :321, :342, :359, :388,
:412, :420, :428]. None of those sets grows. **Therefore D-99-03 requires no
COMPAT-01 amendment** — a strictly better outcome than the CONTEXT's contingency
allowed for. If a plan finds itself minting a token, that is a signal it took a
wrong turn.

### Catalog work

Add a state under `## /claude:plugin update` (section spans
`docs/output-catalog.md:836-1023`) [VERIFIED: docs/output-catalog.md heading walk].
The direct model is `### Reinstall with a degraded component (WARN-01 / D-86-03 / WR-09)`
at `docs/output-catalog.md:688` [VERIFIED: same walk] — copy its shape for the
update verb. Ship the `FIXTURES` entry in `tests/architecture/catalog-uat.test.ts`
in the SAME commit: the suite runs an inverse walk,
*"catalog UAT inverse walk: every FIXTURES (section,state) has a matching catalog
annotation (no orphan/stale fixture)"* at `:4694` [VERIFIED: tests/architecture/catalog-uat.test.ts:4694],
so a catalog state without a fixture (or vice versa) fails in both directions.
The `FIXTURES` map starts at `:280` and is keyed by section
[VERIFIED: catalog-uat.test.ts:16, :220, :280, :4472].

`docs/messaging-style-guide.md` — extend the optional-`reasons` bullet from two
variants to three [CITED: the WR-12 carrier, work item 6].

### The tally question the carrier leaves open

*"the trailing tally counts by stamped severity, so a degraded bulk update will
read `N warnings` rather than `N successes`, as reinstall now does … if it is
wrong, it is wrong for both verbs and the lever is the tally, not the row."*
[CITED: 2026-08-10-update-verb-drops-degradation-signals.md:99-103]. Take the
consistent path: match reinstall, change nothing in the tally. Note it in the
SUMMARY as a deliberate call rather than a side effect.

## Item 5 — D-99-04: the three doc deferrals

### (1) Version-less autoupdate cascade skip row

The mapper's `skipped` arm forwards name, scope and reasons but no version, so
the cascade row is `⊘ hello (skipped) {not in manifest}` while the plugin-update
row is `⊘ hello v1.0.0 (skipped) {not in manifest}`. Both forms are byte-pinned,
and the asymmetry is narrated above the two cases in
`tests/orchestrators/marketplace/update.test.ts` [CITED: 98-06-SUMMARY.md
Deferred Items §1]. Work = ADD a catalog state under
`## /claude:plugin marketplace update` + its `FIXTURES` entry. **No code change**
— 98-06's finding was explicit that *"the asymmetry looks deliberate"*.

Note: the heading walk performed this session lists `## /claude:plugin marketplace add`
(:1231), `## /claude:plugin marketplace info` (:1347) and
`## /claude:plugin marketplace list` (:1199) but the walk output was truncated
before reaching a `marketplace update` heading. **[ASSUMED]** that the section
exists; the planner must confirm whether the state is added to an existing
section or the section itself must be created (which changes the FIXTURES key).

### (2) The stale variant count — exact site

`docs/output-catalog.md:340` [VERIFIED: docs/output-catalog.md:340], verbatim
fragment: *"The seven list-surface variants (`installed`, `upgradable`,
`available`, `remote`, `partially-available`, `unavailable`, `disabled`) all
support the description field; the cascade-only variants (`updated`,
`reinstalled`, `uninstalled`) do not."* Correct to nine by adding
`partially-installed` and `partially-upgradable` (both declare `description?`
per the 98-06 finding) [CITED: 98-06-SUMMARY.md Deferred Items §2]. This line
sits inside the `### Disabled inventory row with a description (PL-4)` /
`### Description lines (PL-4)` region (`:313`, `:329`, `:342`) — check whether
the sentence is inside a fenced example block that `catalog-uat` byte-compares
before editing.

### (3) The six `RLD-04` / `D-08` sites — exact, and the exclusions

**In scope (the six)** [VERIFIED: `grep -rn "RLD-04\|D-08" extensions/ docs/`]:

| File | Line | Text fragment |
|---|---|---|
| `orchestrators/plugin/list.ts` | 29 | `// when (declares AND companion unloaded). RLD-04 / D-08: the list` |
| `orchestrators/plugin/list.ts` | 103 | `* subset per shared/notify.ts. RLD-04 / D-08: the installed bucket emits the` |
| `orchestrators/plugin/list.ts` | 1116 | `// RLD-04 / D-08: \`installedRowMessage\` emits \`status: "installed"\` with` |
| `orchestrators/plugin/list.ts` | 1217 | `// is the only safe access path under TS strict. RLD-04 / D-08: the list` |
| `orchestrators/plugin/list.messaging.ts` | 37 | `* RLD-04 / D-08: the list surface's steady-state inventory row uses the` |
| `shared/notify.ts` | 459 | `* RLD-04 / D-08: the list-only inventory row uses \`"installed"\` with` |

**Correction to the CONTEXT's framing:** the six sites are list.ts (4) +
list.messaging.ts (1) + **`shared/notify.ts:459` (1)** — not list.ts (4) +
list.messaging.ts (2). 98-06 reported removing `RLD-04`/`D-08` from `notify.ts`
"as a side effect of rewriting the `PluginInstalledMessage` doc block", but a
second occurrence survives at `:459`. There is also `shared/notify.ts:3751`
carrying `PL-4 (RLD-04 / D-08)` — a **seventh** site. The planner should treat
the in-scope set as **seven**, all `RLD-04 / D-08` paired occurrences.

**Explicitly OUT of scope — `D-08` with its other, live meaning** (a mechanical
sweep here would be wrong; each was read this session and none pairs with
`RLD-04`) [VERIFIED: same grep]:

| File | Lines | Live meaning |
|---|---|---|
| `bridges/skills/stage.ts` | 12 | substitution helper is `shared/vars.ts::substituteClaudeVars` |
| `domain/source.ts` | 6, 67 | `unknown` forward-compat tail (with NFR-12) |
| `orchestrators/plugin/install.ts` | 7, 28, 883, 1656 | POST-state-commit ordering (with AS-6) |
| `orchestrators/plugin/uninstall.ts` | 624 | POST-state-commit ordering (with PU-2) |
| `shared/errors.ts` | 293 | fail-fast cross-process state lock |
| `shared/notify-context.ts` | 124 | row-type registry (with D-01) |
| `shared/vars.ts` | 4, 7 | substitution helper lock; PI-10 vs D-08 resolution |
| `bridges/agents/convert.ts` | 4, 425, 535 | D-08 corollary — agents DO get substitution |

That is **eight** files, not the four the CONTEXT names. The four the 98-06
summary named (`install.ts`, `uninstall.ts`, `convert.ts`, `source.ts`) are a
subset. `ROADMAP.md` records that neither `RLD-04` nor `D-08`-as-inventory-row is
defined in any surviving artifact [CITED: 98-06-SUMMARY.md Deferred Items §3], so
for the seven paired sites the correct action is **drop the anchor pair, keep the
sentence** — the prose is true, only the ID is dangling.

## Item 6 — D-99-05a: stale `resolvedSource` on unchanged version

### Mechanism [CITED: 2026-08-09-disabled-record-stale-resolvedsource-on-unchanged-version.md]

`preflightUpdate` returns the `unchanged` outcome as soon as
`toVersion === fromVersion`, BEFORE `runThreePhaseUpdate` reaches the
disabled-record branch, so `refreshDisabledRecord` never runs. That is right for
`version` but `refreshDisabledRecord` also owns `resolvedSource` and the
`compatibility` block, which move independently: a path-source marketplace
re-added from a different directory, or a manifest entry that gains/loses an
unsupported kind without a version bump. The record then points a future `enable`
at a path that may not exist (`(failed) {source missing}`) or gates it on a stale
availability flag.

### Option 1 (the locked choice)

*"Let the disabled-record branch run before the version short-circuit, and have
`refreshDisabledRecord` no-op when nothing moved (the deep-equal guard drafted and
reverted during the 97 fix pass — it is unreachable only because of the current
ordering, so reordering makes it load-bearing)."*

**Reachability:** the guard becomes reachable exactly when the reordering lands;
before it, the short-circuit prevents the branch from ever seeing an unchanged
record. This is why the 97 pass reverted it as dead code. Its post-reorder
reachability is what must be pinned by a test, or it will look like dead code
again to the next reader.

**Idempotency is the load-bearing property.** The ENBL-09 test suite in
`tests/orchestrators/plugin/update.test.ts` pins that a repeated refresh writes
nothing [CITED: the carrier's "see the ENBL-09 idempotency test and
`97-REVIEW-FIX.md`"]. With the reorder, that suite's guarantee now depends on the
deep-equal guard rather than on the ordering. **The plan must add a test that
fails without the guard** — otherwise the suite passes for the wrong reason.

**The row contract must be an explicit call, not a side effect.** The carrier:
*"the artifact state genuinely is unchanged, so `(skipped) {up-to-date}` may still
be right even when the pin moved — but that should be an explicit, documented
call."* Recommend keeping `(skipped) {up-to-date}` unchanged: the byte-pinned row
(catalog `### All up-to-date (no-op cascade)` at `docs/output-catalog.md:878`
[VERIFIED: heading walk]) then needs no amendment, and the fix is a pure
state-correctness change with zero rendered-vocabulary surface. Document the call
in the code comment citing the carrier's decision, and pin it in ENBL-09.

### Tests pinning the current short-circuit

`tests/orchestrators/plugin/update.test.ts` — the ENBL-09 suite and the
`(skipped) {up-to-date}` byte assertions. [ASSUMED] on the exact test names; the
planner should `grep -n "ENBL-09\|up-to-date" tests/orchestrators/plugin/update.test.ts`
as the first action of that task.

## Item 7 — D-99-05b: the bounded coverage sweep

### The todo's named scope [VERIFIED: 2026-06-12-coverage-sweep-…md, table quoted]

| File | Coverage at capture | Uncovered lines |
|---|---|---|
| `orchestrators/edge-deps.ts` | 49.7% | 94 |
| `orchestrators/plugin/update.ts` | 87.9% | 213 |
| `orchestrators/plugin/reinstall.ts` | 93.1% | 83 |
| `orchestrators/plugin/install.ts` | 93.4% | 77 |
| `orchestrators/marketplace/update.ts` | 93.7% | 49 |
| `orchestrators/import/execute.ts` | 94.1% | 34 |

Solution as written: *"Targeted sweep, biggest absolute chunks first: update.ts
failure arms (three-phase update rollback paths), then reinstall.ts /
install.ts / marketplace/update.ts / import/execute.ts. Separately decide whether
`orchestrators/edge-deps.ts` (DI wiring glue, 49.7%) gets tests or a
`sonar.coverage.exclusions` entry … an exclusion inflates the metric without
adding safety, so make it an explicit call. Estimated landing point: ~97%
overall."*

**D-99-05b bounds this to update/reinstall/install only** — `marketplace/update.ts`,
`import/execute.ts` and the `edge-deps.ts` exclusion decision are outside the
locked scope as written in CONTEXT ("bounded to the todo's named rare-failure arms
in update/reinstall/install"). The planner should surface the `edge-deps.ts`
decision as an explicit non-goal in the plan rather than silently dropping it, and
consider re-filing it as a fresh todo.

### The numbers are 2026-06-12 vintage and are almost certainly stale

Phases 95-98 added substantial coverage to exactly these files. **The first task
of this item must be to re-measure, not to write tests.** Run:

```bash
PI_SUBAGENTS_ROOT=/home/acolomba/.pi/agent/npm/node_modules/pi-subagents npm run test:coverage:unit
```

then read the per-file lines from `coverage/unit.lcov` for the three in-scope
files. Only the arms still uncovered after that measurement are the residual
list. Writing a test for an arm phase 97 already covered is pure waste and will
trip `sonarjs/no-identical-functions` against the existing test.
[VERIFIED: package.json `scripts.test:coverage:unit` emits `coverage/unit.lcov`
via `--test-reporter=lcov --test-reporter-destination=coverage/unit.lcov`].

**Honest assessment:** the true residual list cannot be produced by reading source
— it requires the coverage run above, which this research did not execute (a full
coverage run over 3300+ tests is a multi-minute operation better spent inside the
phase than inside research). The plan should carry this as a measure-then-scope
task, with the test-writing sub-tasks defined only after the measurement lands.
[ASSUMED] that coverage has materially improved since 2026-06-12 — inferred from
phases 95-98 all being nyquist-compliant with passing verification, not measured.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Map degrade kinds → reason tokens | a local `kinds.map(k => …)` in `update.ts` | `malformedReasonsForKinds` (`shared/notify-reasons.ts:176`) | It enforces `DEGRADE_KIND_ORDER`, which is what makes the brace byte-stable. A local map produces the right tokens in the wrong order and fails `catalog-uat`. |
| Compose the `(updated)` row twice | separate literals in the standalone and cascade paths | ONE `updatedRowFromOutcome` composer, mirroring `reinstalledRowFromOutcome` | The WR-09 lesson, stated in the carrier: the two surfaces drift the moment they are two literals. |
| Re-derive manifest absence | a fourth `plugins.find(p => p.name === x)` | the exported `lookupDeclaredPlugin` | The whole point of D-99-02a. |
| Re-derive the disabled state | any of the twin spellings | `isRecordedButDisabled` from `persistence/state-io.ts` | The drift gate exists to make this impossible; widening it is this phase's job. |
| Structural enforcement | an ESLint custom rule | a source-walking test in `tests/architecture/` or `tests/orchestrators/` | The repo's established mechanism (`no-orchestrator-network.test.ts`, the ENBL-05 gate, `compat-01-no-expansion.test.ts`). Tests are where boundaries live here. |
| Deep-equal comparison for the refresh guard | a hand-rolled recursive compare | `node:assert`-free structural compare already drafted in the 97 pass, or `JSON.stringify` on a normalized projection | [ASSUMED] — the reverted draft's exact form was not recovered this session; the planner should find it in the 97 fix-loop history (`git log -S` on `refreshDisabledRecord`). |

**Key insight:** every capability this phase needs already exists in the tree,
usually in the sibling verb. The failure mode is not "built the wrong thing" but
"built a second copy of the right thing" — which is, recursively, the exact
defect class every one of these debt items records.

## Common Pitfalls

### Pitfall 1: the `extends LedgerDegradationSignals` type collision
**What goes wrong:** `PluginUpdateUpdatedOutcome extends LedgerDegradationSignals`
fails to compile — `stagedAgents: readonly string[]` is not assignable to
`stagedAgents?: boolean`.
**Why it happens:** D-99-03 work item 1 and D-99-02c touch the same two field
names from opposite directions.
**How to avoid:** land the rename first. If the plan orders WR-12 first, it must
use `Pick<LedgerDegradationSignals, "degradedKinds">` as an interim — and then
remember to widen it after the rename, which is a step nobody remembers.
**Warning signs:** `TS2430: Interface 'X' incorrectly extends interface 'Y'`.

### Pitfall 2: fixing the central renderer arm and stopping
**What goes wrong:** severity rises to `warning` but the `{malformed skill}`
brace never appears on the actual verb output.
**Why it happens:** `update.messaging.ts` holds the command-local render map that
actually renders the verb; the central `renderPluginRow` arm is a different path.
**How to avoid:** the carrier's work item 4 says **"Do not skip this one"**. Assert
the rendered bytes through the public verb, not through `renderPluginRow`.
**Warning signs:** a unit test on the renderer passes while an end-to-end byte
assertion shows a brace-less row.

### Pitfall 3: `shared/notify.ts` has TWO `case "updated":` arms
**What goes wrong:** threading `reasons` into `:1745` and missing `:2237` (or the
reverse).
**How to avoid:** read both switch statements before editing either; determine
what each one computes (row text vs. severity/dependency reduction).

### Pitfall 4: catalog and FIXTURES must move together
**What goes wrong:** `catalog-uat` fails in one of two directions — a catalog
annotation with no fixture, or an orphan/stale fixture with no annotation
(`:4694` inverse walk).
**How to avoid:** same commit, both files, every time.

### Pitfall 5: a global regex in the drift gate
**What goes wrong:** `/…/g.test()` carries `lastIndex` across calls, so the gate
silently skips every other file in the walk.
**How to avoid:** never add the `g` flag to a gate pattern. The file's own comment
at `compat-01-no-expansion.test.ts:107` documents this exact trap.

### Pitfall 6: widening the drift gate into the config axis
**What goes wrong:** a pattern that drops the leading `\.` starts matching
`entry.enabled !== false` in `persistence/config-io.ts` — a deliberately excluded
different fact about a different object.
**How to avoid:** the gate's comment at `:743-748` states the exclusion; every new
pattern must be checked against it, and the whole-tree walk will fail loudly if a
pattern crosses over.

### Pitfall 7: `stripComments` runs FIRST
**What goes wrong:** a new pattern is written to match a spelling that only ever
appears inside a doc comment, and never fires.
**Why it matters here:** several files legally *describe* the removed rule in
prose. Comments are stripped before any test, so prose is invisible to the gate —
by design.

### Pitfall 8: `sonarjs/cognitive-complexity: 15`
**What goes wrong:** adding the disabled-record branch reordering to
`preflightUpdate` or the degradation collection to `update.ts`'s success-outcome
function pushes a function over the ceiling and fails `npm run lint`.
**How to avoid:** extract a named helper (the repo's established response — see
`runInstallLedger`, `reinstalledRowFromOutcome`, `malformedReasonsForKinds`).

### Pitfall 9: update-fixture `process.cwd()` hazard
**What goes wrong:** update fixtures that resolve project scope pick up the
runner's cwd rather than the fixture's.
**How to avoid:** user scope + hermetic home for update fixtures, per the
CONTEXT's `code_context` note [CITED: 99-CONTEXT.md].

### Pitfall 10: `PI_SUBAGENTS_ROOT` absent
**What goes wrong:** the two pi-subagents integration tests resolve the peer from
the global npm root and fail locally on a stale global version.
**How to avoid:** always run the gate as
`PI_SUBAGENTS_ROOT=/home/acolomba/.pi/agent/npm/node_modules/pi-subagents npm run check`
and capture the exit code directly.

### Pitfall 11: worktree TruffleHog
**What goes wrong:** `pre-commit` aborts with
`failed to read index file: open <worktree>/.git/index: not a directory`.
**How to avoid:** filesystem-mode scan over the changed paths, then
`SKIP=trufflehog` on that commit only — never extended to another hook
[CITED: CLAUDE.md §Git].

### Pitfall 12: comment vocabulary guard
**What goes wrong:** a new comment writes `Phase 99` or `Wave 2` and trips the
comment-policy rule.
**How to avoid:** cite `WR-12`, `D-99-0x`, `ENBL-05`, `BOUND-03`, `WARN-01`,
`NREG-01` — decision and requirement IDs only [CITED: .claude/rules/typescript-comments.md,
.planning/codebase/CONVENTIONS.md §Comments].

## Runtime State Inventory

This phase is a source-level refactor + documentation change. It writes no new
on-disk artifact, changes no persisted schema, and touches no external service.

| Category | Items Found | Action Required |
|----------|-------------|-----------------|
| Stored data | None. No `state.json` schema field is added, removed or renamed. The renamed `stagedAgents`/`stagedMcpServers` live on **in-memory outcome interfaces** (`orchestrators/types.ts`), not on `PluginRecord` — verified by reading both declaration sites, which are on `ReinstallReinstalledOutcome` / `PluginUpdateUpdatedOutcome`, and by COMPAT-01's separate "persisted install record holds exactly its inherited key set" pin at `compat-01-no-expansion.test.ts:342` remaining untouched. | None — no data migration. |
| Live service config | None — verified: the phase adds no marketplace, no MCP entry, no agent index mutation. | None |
| OS-registered state | None — verified: no task, service, or launch registration exists in this project. | None |
| Secrets / env vars | None renamed. `PI_SUBAGENTS_ROOT`, `TEST_CONCURRENCY`, `PI_CM_E2E_REF` are read-only test inputs and are unchanged. | None |
| Build artifacts | None — the project has no build step (`tsc --noEmit`; Node runs `.ts` directly). | None |

**The one runtime-adjacent change** is D-99-05a: it makes an update run WRITE a
refreshed `resolvedSource`/`compatibility` onto a disabled record where it
previously wrote nothing. That is a behavior change to an existing field, not a
schema change, and it is self-healing (the next update refreshes a stale record).
No migration of existing `state.json` files is required — a stale record is
repaired the first time the user runs `update`.

## Code Examples

### Composing a degraded transition row (the WR-09 pattern to mirror)
```ts
// Source: extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts:909-926 (read verbatim)
function reinstalledRowFromOutcome(
  outcome: ReinstallReinstalledOutcome,
  rowScope: Scope | undefined,
): PluginReinstalledMessage {
  const malformed = malformedReasonsForKinds(outcome.degradedKinds);
  return {
    status: "reinstalled",
    name: outcome.name,
    dependencies: dependenciesFromOutcome(outcome),
    ...(outcome.version !== "" && { version: outcome.version }),
    ...(rowScope !== undefined && { scope: rowScope }),
    ...(malformed.length > 0 && { reasons: malformed }),
    severity: malformed.length > 0 ? "warning" : "info",
    // …
  };
}
```
The optional-spread idiom (`...(cond && { field })`) is what preserves NREG-01:
an unaffected outcome renders byte-identically because the key is absent, not
`undefined`.

### Collecting the degrade signal at the success-outcome site
```ts
// Source: extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts:1740,1764 (read verbatim)
const degradedKinds = Array.from(/* … */);
// …
    ...(degradedKinds.length > 0 && { degradedKinds }),
```

### A self-testing gate pattern (for the widened drift regexes)
```ts
// Source: tests/architecture/compat-01-no-expansion.test.ts:321-336 (read verbatim)
test("COMPAT-01: the glyph-declaration pattern recognises every spelling a glyph export can take", () => {
  // …
    GLYPH_DECLARATION.test("return `${ICON_EIGHTH} ${name}`;"),
```

## State of the Art

Not applicable — no external library, framework or ecosystem practice is in
scope. The relevant "state of the art" is this repo's own established mechanisms,
already documented in `.planning/codebase/ARCHITECTURE.md` and unchanged by this
phase.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The specific test-file paths pinning absence behavior (`list.test.ts`, `info.test.ts`, `update.test.ts`) | Item 1 | LOW — planner greps them as task step 1; a wrong path is caught immediately. |
| A2 | Adding a `.plugins.find(…name ===…)` drift gate is desirable (audit prescribes only the export) | Item 1 | LOW — a scope suggestion; planner may drop it. |
| A3 | `tests/orchestrators/plugin/update.test.ts` holds additional `stagedAgents` fixtures beyond those enumerated | Item 3 | MEDIUM — under-bounds the rename task. Mitigated: research names the exact re-grep command. |
| A4 | A `## /claude:plugin marketplace update` catalog section already exists | Item 5 | MEDIUM — if absent, the FIXTURES key and section must both be created, changing the task shape. |
| A5 | Coverage has materially improved since 2026-06-12, making the sweep mostly done | Item 7 | MEDIUM — the plan is structured as measure-then-scope precisely to absorb this. |
| A6 | The reverted deep-equal guard is recoverable from the 97 fix-loop history | Item 7 / Don't Hand-Roll | LOW — worst case it is rewritten; it is a small function. |
| A7 | ENBL-09 test names in `update.test.ts` | Item 6 | LOW — grep-verifiable in one command. |
| A8 | `shared/notify.ts:1745` is `renderPluginRow`'s arm and `:2237` is a second switch | Item 4 | MEDIUM — misidentifying which arm needs the thread reproduces WR-09. Mitigated by the instruction to read both. |

## Open Questions

1. **Should the rename cover `update`'s string arrays as well as `reinstall`'s?**
   - What we know: the identical collision exists on `PluginUpdateUpdatedOutcome`
     (`types.ts:148-149`), and leaving it blocks D-99-03's clean inheritance.
   - What's unclear: D-99-02c's text names reinstall only.
   - Recommendation: **rename both.** The locked decision's *intent* (remove the
     type-confusion hazard, enable the shared shape) is not served by half. Record
     it as a scope clarification in the plan, not a scope expansion — the operator
     locked the hazard, and the hazard has two sites.

2. **Does the `RLD-04` / `D-08` set have six sites or seven?**
   - What we know: this session's grep found seven paired occurrences
     (`list.ts` ×4, `list.messaging.ts` ×1, `notify.ts` ×2 at `:459` and `:3751`).
     The CONTEXT and 98-06 both say six.
   - Recommendation: treat the grep as authoritative and close all seven. The
     discrepancy is 98-06 having partially cleaned `notify.ts` and miscounted the
     remainder.

3. **Is a runtime UAT genuinely unnecessary for D-99-03?**
   - What we know: D-99-01 waived runtime UAT before archive.
   - What's unclear: WR-12 is a rendered-output change with a byte fixture; the
     fixture IS the verification, so the waiver is defensible.
   - Recommendation: honor the waiver; rely on the byte assertions through the
     public verb (carrier work item 7, which mandates BOTH the degraded and the
     clean row — the clean one being the NREG-01 guard).

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | everything | ✓ | ≥20.19.0 required by `engines` | — |
| npm scripts (`check`, `typecheck`, `lint`, `format:check`, `test`, `test:integration`, `test:coverage:unit`) | the phase gate | ✓ | [VERIFIED: package.json scripts read this session] | — |
| `pi-subagents` peer at `PI_SUBAGENTS_ROOT` | 2 integration tests | ✓ (per CONTEXT) | resolved from `/home/acolomba/.pi/agent/npm/node_modules/pi-subagents` | tests skip in CI when absent |
| `pre-commit` + TruffleHog binary | commit gate | ✓ | filesystem-mode scan required in worktree | documented `SKIP=trufflehog` protocol |
| Network | none | — | — | this phase is fully offline |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** none.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | `node:test` (Node ≥20.19.0 built-in), `node:assert/strict` |
| Config file | none — glob-driven from `package.json` scripts [VERIFIED: package.json] |
| Quick run command | `node --test tests/orchestrators/plugin/update.test.ts` (single suite) |
| Full suite command | `PI_SUBAGENTS_ROOT=/home/acolomba/.pi/agent/npm/node_modules/pi-subagents npm run check` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| D-99-02a | list/info/update absence rows unchanged after the refactor | unit (regression) | `node --test tests/orchestrators/plugin/list.test.ts tests/orchestrators/plugin/info.test.ts tests/orchestrators/plugin/update.test.ts` | ✅ existing — must pass UNCHANGED |
| D-99-02a | (optional gate) no surface re-derives the lookup | architecture | `node --test tests/orchestrators/reconcile/plan.test.ts` or a new gate file | ❌ Wave 0 if the gate is adopted |
| D-99-02b | each new regex catches its planted twin | unit (self-test) | `node --test tests/orchestrators/reconcile/plan.test.ts` | ✅ existing file, new assertions |
| D-99-02b | no new pattern fires on the tree | architecture (whole-walk) | same command | ✅ existing test, unchanged |
| D-99-02b | import-presence half still green | architecture | same command | ✅ existing, unchanged |
| D-99-02c | rename compiles; no residual old name | typecheck + grep | `npm run typecheck && ! grep -rn "stagedAgents:" extensions/ \| grep -v boolean` | ✅ typecheck is the gate |
| D-99-03 | degraded update renders the brace + `warning` severity, **through the public verb** | integration (byte) | `node --test tests/orchestrators/plugin/update.test.ts` | ❌ Wave 0 — new case |
| D-99-03 | clean update renders byte-identically (NREG-01) | integration (byte) | same | ✅ existing rows must not move |
| D-99-03 | catalog state ↔ FIXTURES both directions | architecture | `node --test tests/architecture/catalog-uat.test.ts` | ✅ existing, new entry |
| D-99-03 | closed sets unchanged | architecture | `node --test tests/architecture/compat-01-no-expansion.test.ts` | ✅ existing, must pass UNCHANGED |
| D-99-04 | catalog byte-equality after the three doc edits | architecture | `node --test tests/architecture/catalog-uat.test.ts` | ✅ existing + 1 new fixture |
| D-99-05a | moved `resolvedSource` on an unchanged version DOES refresh | unit | `node --test tests/orchestrators/plugin/update.test.ts` | ❌ Wave 0 — new case |
| D-99-05a | the deep-equal guard is load-bearing (nothing-moved ⇒ no write) | unit | same | ❌ Wave 0 — **must fail without the guard** |
| D-99-05a | `(skipped) {up-to-date}` row bytes unchanged | integration (byte) | same | ✅ existing, unchanged |
| D-99-05b | residual uncovered arms | unit | measure first: `npm run test:coverage:unit`, read `coverage/unit.lcov` | ❌ scope determined by measurement |

### Sampling Rate
- **Per task commit:** the single affected suite via `node --test <file>` (seconds),
  plus `npm run typecheck` when a type moved.
- **Per wave merge:** `npm run typecheck && npm run lint && npm test`.
- **Phase gate:** `PI_SUBAGENTS_ROOT=… npm run check` → capture `CHECK_EXIT`
  directly; 0 required before `/gsd-verify-work`.

### Wave 0 Gaps
- [ ] Degraded-update byte case in `tests/orchestrators/plugin/update.test.ts` — covers D-99-03
- [ ] Clean-update NREG-01 guard assertion (may already exist; confirm) — covers D-99-03
- [ ] `FIXTURES` entry + catalog state for `update-degraded-component` — covers D-99-03
- [ ] `FIXTURES` entry + catalog state for the version-less autoupdate cascade skip row — covers D-99-04
- [ ] Regex self-test assertions beside `INLINE_REDERIVATIONS` — covers D-99-02b
- [ ] Moved-source-unchanged-version refresh case — covers D-99-05a
- [ ] Guard-is-load-bearing case (fails without the deep-equal guard) — covers D-99-05a
- [ ] Coverage measurement task (produces the D-99-05b scope; not itself a test)

No framework install is needed; no `conftest`-equivalent shared fixture file is
missing — the repo's `tests/helpers/` already supplies the mock factories.

## Security Domain

`security_enforcement` was not read from `.planning/config.json` this session, so
this section is included by default.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | This phase touches no credential path. `platform/git-credential.ts` is untouched. |
| V3 Session Management | no | No session concept exists in this extension. |
| V4 Access Control | no | No multi-user model; scope separation (`user`/`project`) is unchanged by this phase. |
| V5 Input Validation | yes (unchanged) | `typebox` schemas in `domain/components/*.ts` and `MARKETPLACE_VALIDATOR` (`domain/manifest.ts:40`) remain the validation boundary. The `ManifestLookup` export operates on an ALREADY-validated `MarketplaceManifest`, so it introduces no new parsing surface. |
| V6 Cryptography | no | `shaVersion` (`domain/version.ts`) is a content identifier, not a security primitive, and is untouched. |
| V12 File & Resource | yes (unchanged) | NFR-10 containment via `shared/path-safety.ts::assertPathInside` is unchanged. D-99-05a writes a `resolvedSource` that ALREADY flowed through the resolver's containment check on the refresh path — the reordering changes WHEN it is written, not WHETHER it was validated. Confirm this in review. |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Path traversal via a plugin-controlled `source` | Tampering | `assertPathInside` chokepoint (NFR-10); unchanged, but D-99-05a's new write path must go through the same `refreshDisabledRecord` that already calls it |
| A stale `resolvedSource` pointing at a path outside the owning clone root | Tampering | This phase's D-99-05a fix REDUCES this exposure — a stale pin is exactly the condition that survives today |
| Secret in a committed diff | Information Disclosure | TruffleHog filesystem scan before every worktree commit (CLAUDE.md protocol) |
| Regex denial of service in the widened drift gate | DoS (test-time only) | Keep patterns anchored and non-backtracking; the candidates in Item 2 use bounded character classes, no nested quantifiers |

No new threat is introduced by this phase.

## Sources

### Primary (HIGH confidence)
- Working tree at `/home/acolomba/pi-claude-marketplace/.worktrees/manifest-independent-plugin-info`, branch `features/manifest-independent-plugin-info` — all source and test line citations above were displayed verbatim this session.
- `package.json` scripts block (read via `node -e` on the parsed JSON).
- `.planning/v1.18-MILESTONE-AUDIT.md` frontmatter (lines 1-40).
- `.planning/todos/pending/2026-08-10-update-verb-drops-degradation-signals.md` (full).
- `.planning/todos/pending/2026-08-09-disabled-record-stale-resolvedsource-on-unchanged-version.md` (full).
- `.planning/todos/pending/2026-06-12-coverage-sweep-test-rare-failure-arms-in-update-reinstall-in.md` (full).
- `.planning/phases/98-lifecycle-regression-and-contract-documentation/98-06-SUMMARY.md` §Deferred Items (lines 209-238).
- `.planning/phases/99-post-audit-tech-debt-closure/99-CONTEXT.md` (full).

### Secondary (MEDIUM confidence)
- `CLAUDE.md` + `.planning/codebase/{STACK,CONVENTIONS,ARCHITECTURE}.md` — project-instruction context, current as of 2026-08-07.

### Tertiary (LOW confidence)
- None. No web search, no external documentation lookup, and no package registry
  query was performed or needed: this phase has no external technical domain.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependency; every command read from `package.json`.
- Architecture / placement: HIGH — layer rules read from ARCHITECTURE.md and cross-checked against the actual import lines in all three consumer files.
- Exact shapes and line numbers: HIGH — quoted verbatim from the tree this session.
- Pitfalls: HIGH for 1-8 and 12 (each traced to a specific line or an explicit in-repo comment); MEDIUM for 9-11 (carried from CONTEXT / CLAUDE.md rather than re-verified).
- Coverage-sweep scope: LOW — the 2026-06-12 numbers are stale by construction and were not re-measured. This is the single genuinely open item and the plan absorbs it as a measure-then-scope task.

**Research date:** 2026-08-10
**Valid until:** until the working tree changes — every citation is a line number in a mutable file. Re-verify line numbers if any of `list.ts`, `update.ts`, `reinstall.ts`, `types.ts`, `notify.ts`, `plan.test.ts` or `output-catalog.md` is edited before planning completes.

---
*Phase: 99-post-audit-tech-debt-closure*
