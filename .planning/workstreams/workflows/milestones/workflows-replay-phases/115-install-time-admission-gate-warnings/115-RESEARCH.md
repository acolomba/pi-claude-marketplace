# Phase 115: Install-time admission-gate warnings - Research

**Researched:** 2026-09-08
**Domain:** static AST gate reading over untrusted JavaScript; per-script warning
plumbing across four orchestrator verbs; published-contract documentation
**Confidence:** HIGH on everything measured first-hand this session (the engine
gate table, the bridge cross-table, the warning channel trace, the doc-pin
assertions); MEDIUM on the two naming decisions left to the planner.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Where the gate reading lives**

- **The gate checks read the acorn AST `admitWorkflowScript` already produces.**
  WGATE-02 forbids a second parse, and `parseScript` already returns the AST,
  the comment ranges and the tokens from one `parse()` call. Anything a gate
  needs is already in hand; if a gate appears to need something that is not,
  that is a finding to report, not a licence to parse again.

- **The result rides on the ADMITTED verdict.** A warned script is admitted --
  it installs, its envelope is written, its command registers. So the warnings
  attach to `NamedWorkflow` / `StemFallbackWorkflow`, never to `SkippedWorkflow`
  or `RefusedWorkflow`. Putting them on a refusal arm would encode the opposite
  of WGATE-03.

- **The gate name is a closed set** -- a literal union of the warnable gates,
  bound by a totality construct to the rows of the doc's admit-versus-run table,
  so a gate added to one and not the other fails to compile. **Run the negative
  control**: add a gate to one side only, confirm the tree goes red, restore,
  and paste the transcript into the SUMMARY. This milestone has shipped two
  guards that were green because they checked nothing, and one of them was a
  forcing construct that was unconditionally `never`.

- **A gate reading NEVER changes the verdict** (WGATE-03). It cannot refuse a
  script, cannot fail a plugin, cannot alter a status token, a glyph or a
  disposition. This is the whole reason the warn direction was chosen over the
  refuse direction: if a later engine relaxes a gate, the cost is one spurious
  warning that a reader can ignore, rather than a blocked install that only an
  extension release can clear. The strict direction does not self-correct.

**How the warning surfaces**

- **Reuse the existing `warnings[]` accumulator.** `discoverPluginWorkflows`
  already returns one, `bridges/workflows/stage.ts` already threads it into both
  the staged and the failure arms, and `install` already renders it. No new
  plumbing, no second channel to keep in sync.

- **No new `REASONS` member, and certainly not seven.** Criterion 2 says no
  plugin-level status, glyph or disposition changes, and a token in the row's
  reasons brace IS a plugin-level rendering change -- it moves the row's bytes
  and would drag the catalog byte gate with it. Per-script gate warnings ride
  the existing per-script line channel instead. Seven tokens would also blow a
  closed set that just reached 45 members.

- **Follow the `tense: "install" | "preview"` discriminant** Phase 113 added to
  `discover.ts`. Gate warnings need both tenses, and the phrase tables are
  already module constants there.

- **`info` shows gate warnings, in preview tense.** That is precisely where a
  plugin author looks before installing, and the phase's goal is that they learn
  it at install time or earlier. An install-only warning would tell them after
  the decision they wanted help with.

**Which gates, and how many**

- **Re-derive the gate list from the 3.10.1 source AND the table Phase 114
  published. Trust neither the ROADMAP nor this document.** The ROADMAP's
  criterion 1 names six shapes in a sentence that says "seven". Phase 114
  measured nine checks total with two replicated, which does make seven
  unreplicated -- but the six-item list is not the seven, and the discrepancy has
  to be resolved by reading, not by arithmetic.

  **This milestone's enumerations have been short five times running:** seven
  engine gates were nine; five `composeReasons` translation sites were six; two
  `piWithBothLoaded` definitions were four; seven closed-set amendment sites were
  eight; and the marker-coverage gate's seven-entry literal was bound to nothing.
  Every one was found by removing something and watching what went red. Assume
  this phase's enumeration is short until measured.

- **Not every unreplicated gate becomes a warning.** Criterion 4's `neither`
  column exists because some shapes cannot be detected without evaluating the
  script -- a substituted template-literal `meta.name` is the clear case: the
  engine refuses it at its own check 8, and the bridge cannot resolve it without
  running the script. Warn on the structurally detectable shapes; record
  `neither` for the rest, with the reason stated in the table.

- **The two existing refusal paths are unchanged, and pinned.** A script acorn
  cannot parse is still refused whole with NO gate warnings attached -- there is
  no tree to read the gates off, and attaching them would be inventing findings.
  A determinism-blocklist match is still refused by file with its existing
  four-way reason. The decision order in `admitWorkflowScript` is documented as
  load-bearing (determinism screens before the parse, and unparseable settles
  first because acorn partially fills its comment and token arrays before
  throwing); do not reorder it to make gate reading more convenient.

**Documentation and backlog**

- **The admit-versus-run table's `Replicated by this bridge?` column becomes
  `replicate / warn / neither`,** one row per gate, and every row must agree with
  what the bridge actually does. A table that describes intent rather than
  behavior is the failure WGATE-05 exists to prevent.

- **`docs/workflows-compatibility.md` currently claims the opposite of this
  phase and must be corrected in the same change.** The sentence reading
  "Install-time warnings for these shapes are deliberately not implemented;
  replicating the engine's structural rules would make this extension refuse
  scripts for reasons a future engine release may drop" is now half wrong: the
  warnings ARE implemented, and the refusal concern is exactly why they are
  warnings rather than refusals. Rewrite the paragraph to say what is warned,
  what is not, and why the warn direction was chosen. Do not leave the old
  sentence standing with a note appended.

- **WDOCS-01 -- prune `WFLW-01` from `.planning/BACKLOG.md`** under the file's
  existing pruned-footer convention, naming the milestone that closed it, so the
  backlog stops advertising shipped work as open. Follow the convention already
  in the file; do not delete the entry outright and do not invent a new footer
  format.

### Claude's Discretion

- Plan and task decomposition; the exact spelling of the gate names in the closed
  union; the wording of each warning phrase in both tenses; the precise shape of
  the totality construct.

### Deferred Ideas (OUT OF SCOPE)

- Replicating the unreplicated gates as install-time REFUSALS -- deliberately not
  done, and recorded in REQUIREMENTS.md's "Out of Scope" table: it only makes the
  bridge stricter than the engine, and the strict direction does not self-correct
  across engine upgrades.
- `WPIN-01`, a machine-checkable re-read of the vendored `DETERMINISM_BLOCKLIST`
  and the envelope internals against a newer engine -- a future requirement, and
  the named subject of Broken Windows #34.
- The uncapped double read of every candidate script body on the `info` surface
  (code-review IN-02, deferred from Phase 113) -- logged in `.planning/BACKLOG.md`.

</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| WGATE-01 | A workflow script whose shape the host engine will refuse at invocation installs with a per-script warning naming the refusing gate, so a plugin author learns at install time instead of at first invocation. The install still succeeds and sibling scripts are unaffected. | §"The gate table, measured" gives the exact six warnable gates and the AST predicate for each. §"The warning channel, end to end" gives the four verbs and the one that currently drops the channel. |
| WGATE-02 | The six gate checks read off the acorn parse `admitWorkflowScript` already performs. No second parse, and no vendored engine internal beyond what is needed to name the gate. | §"`parseScript` gives you everything" -- `ParsedScript.ast` is a full `Program`; every one of the six predicates is decidable from `ast.body[0]` plus the `meta` object literal already in hand. Measured: zero gates need a second parse. |
| WGATE-03 | A gate warning never refuses a script and never fails a plugin. | §"What criterion 2 forbids, mechanically" -- the install channel is a *second* `ctx.ui.notify` call (`notifyDiagnostic`), not a row mutation; the `info` channel is a `note:` line the catalog already documents as severity-neutral. |
| WGATE-04 | The determinism blocklist keeps its existing refusal behavior. | §"Criterion 3: the two refusal paths" -- both refusal arms are settled before the admitted arms exist, so gate reading is structurally unreachable from them. Pin as a regression. |
| WGATE-05 | The admit-versus-run table restates its column as replicate / warn / neither. | §"The gate table, measured" is the row-by-row source for that column; §"The doc-pin gate" states exactly which assertions the edit must not redden. |
| WDOCS-01 | `WFLW-01` is pruned from `.planning/BACKLOG.md` under the file's existing pruned-footer convention, naming the milestone that closed it. | §"The BACKLOG pruned-footer convention" quotes the one existing footer verbatim and resolves the milestone-name ambiguity. |
</phase_requirements>

## Summary

Every factual claim in this document about the host engine was re-measured this
session against `@quintinshaw/pi-dynamic-workflows@3.10.1`, fetched with
`npm pack` and read from `package/src/workflow.ts`. Every claim about this
bridge's behavior was measured by running the real `admitWorkflowScript` against
the real `parseWorkflowScript` over 35 hand-built script shapes. **Nothing below
is inherited from Phase 114's document or from the ROADMAP.**

The headline result resolves the six-versus-seven discrepancy the CONTEXT flagged,
and it resolves it in the direction nobody expected. There are **nine** engine
checks, **two** replicated (determinism, parse), leaving **seven** unreplicated.
Of those seven, **six are structurally warnable** from the AST the bridge already
holds -- checks 3, 4, 5, 6, 8 and 9. The seventh, check 7 ("the declarator has an
initializer"), is **unreachable dead code in the engine**: `export const meta;`
is a `SyntaxError` that acorn rejects at check 2, and every non-`const` form is
caught by check 4 first. So seven unreplicated, six warnable, one `neither` --
and WGATE-02's "six gate checks" was right all along while the ROADMAP's
six-shape list was wrong in a different way (it names check 3 twice, names the
unreachable check 7, and omits check 6 entirely).

The second headline is a defect this phase will walk straight into. **Standalone
`install` currently drops every workflow discovery warning on the floor.** The
workflows phase pushes its warnings onto `installCtx.bridgeWarnings`, and
`collectPostCommitWarnings` gates that array behind an `orchestrated` check
(D-19-01). `update` classifies the same array into the *discovery* half and does
surface it standalone; `reinstall` classifies it into the *bridge* half and drops
it; `info` renders it as a `note:` line. So the `INSTALL_OUTCOMES` phrase table
Phase 113 built has, today, exactly one standalone reader: `update`. A gate
warning added to that channel and nothing else would satisfy the letter of
WGATE-01 while failing its stated purpose on the verb the phase is named after.

**Primary recommendation:** add a `gates: readonly WorkflowGate[]` field to the
two admitted verdict arms, computed by one first-failure-wins reader that walks
the engine's own check order over `ast.body[0]`; render one warning line per
gate through the existing `softFailWarning` shape with a sixth
`WorkflowOutcomeSite` member; and reclassify the workflows bridge's warnings in
`install.ts` from `bridgeWarnings` to `discoveryWarnings` so the standalone
install surfaces them the way `update` already does.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Reading the engine's structural gates off the AST | `domain/` (`workflow-script.ts`) | -- | Pure, network-free, disk-free decision over a `Program` node. The layer already owns `findMetaObject`, `readMetaString` and `literalString`; a gate reader is the same kind of function over the same tree. |
| Naming the gate in a closed union | `domain/` | -- | The union is a fact about the engine's admission path, which is what `domain/workflow-script.ts` already models (`RefusedCause`, `SkippedCause`). |
| Composing the warning sentence, per tense | `bridges/workflows/discover.ts` | -- | The two phrase tables and the `tense` discriminant already live there; `verdictWarning` is the single composition site. |
| Carrying the warning out of the bridge | `bridges/workflows/stage.ts` | -- | `prepareStageWorkflows` already copies `discoverWarnings` into both prepared arms. No change needed. |
| Deciding whether a standalone user sees it | `orchestrators/plugin/{install,update,reinstall}.ts` | -- | The discovery-versus-hygiene split is an orchestrator policy (D-141-03), not a bridge fact. This is where the `install` defect lives. |
| Rendering the preview tense | `orchestrators/plugin/info.ts` | `shared/notify.ts` | `previewWorkflows` already redacts and forwards; `notes` is already an existing row field. |
| Publishing the contract | `docs/workflows-compatibility.md` | `tests/architecture/workflows-doc-pins.test.ts` | The doc is the artifact; the pin test is the only mechanism that keeps its internal counts honest. |

## Project Constraints (from CLAUDE.md)

Directives the planner must honor, extracted from `./CLAUDE.md`,
`.planning/codebase/{STACK,CONVENTIONS,ARCHITECTURE}.md`, and
`.claude/rules/typescript-comments.md`:

- **Read before edit.** Trace callers before modifying a function.
- **`npm run check` must stay green.** It is `typecheck && lint && fallow &&
  format:check && test:corresponding && test:corresponding:negative &&
  test:coverage:direct:negative && test && test:integration`
  [VERIFIED: package.json `scripts.check`, read this session]. **`fallow` is a
  mandatory member**, and its `health` thresholds (`maxCognitive: 15`,
  `maxCyclomatic: 20`, `maxUnitSize: 60`, `maxCrap: 0`) are computed
  independently of ESLint's `sonarjs/cognitive-complexity: 15`. A gate reader
  written as one big `if/else` ladder will fail one or both.
- **`test:corresponding` pairs every production module 1:1 with a test file.**
  `scripts/check-corresponding-tests.mjs` maps
  `extensions/pi-claude-marketplace/<rel>.ts` -> `tests/<rel>.test.ts`, with
  `architecture`, `e2e` and `integration` exempt [VERIFIED:
  scripts/check-corresponding-tests.mjs:9-11,29-32 -- `const productionRoot =
  "extensions/pi-claude-marketplace"`, `const nonCorrespondingRoots = new
  Set(["architecture", "e2e", "integration"])`, `return
  \`${testRoot}/${relativePath}.test.ts\``]. **A new `domain/workflow-gates.ts`
  needs `tests/domain/workflow-gates.test.ts` in the same commit or the gate
  fails.**
- **All user-visible output through `shared/notify.ts`.** Two independent gates
  forbid `process.stdout`/`process.stderr` in `extensions/**`: the ESLint
  `no-restricted-syntax` rule and fallow's `boundaries.calls.forbidden`.
- **Import boundaries.** `domain/` may import from `shared/` only.
  `bridges/workflows/` may not import a sibling bridge kind (fallow's 13-zone
  `boundaries` block is the only gate that sees this).
- **Comment policy** (`.claude/rules/typescript-comments.md`): no `Phase NN`,
  `Plan NN`, `Wave N`, `milestone vX.Y`, bare `Pitfall N` / `Pattern N`, and no
  narration of code that no longer exists ("the former X", "X used to..."). Keep
  requirement and decision IDs (`WGATE-01`, `D-141-03`) as traceability anchors.
- **Commits:** Conventional Commits, title 5-72 chars, body lines <= 80. Run
  `pre-commit run --all-files` (CI runs `--all-files`; a scoped `--files` run
  hides pre-existing violations) *before* `git commit`. Never `--no-verify`.
  Never commit to `main`.
- **Markdown is formatted by `mdformat` + `markdownlint-cli2` in pre-commit, not
  by prettier.** `npm run format` covers only `**/*.{js,json,ts}` and
  `scripts/**/*.mjs` [VERIFIED: package.json `scripts.format`]. Running
  `prettier --write docs/*.md` is always wrong here.
- **Version bump and CHANGELOG are milestone-close work**, explicitly out of
  this phase's scope per CONTEXT.

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `acorn` | `^8.16.0` (already a direct dependency) | The one `parse()` call `admitWorkflowScript` performs; its `Program` AST is what every gate reads | Already vendored, already the engine's own parser at the same range, already imported by `domain/workflow-script.ts:26` |

### Supporting

**None.** This phase adds no dependency. Every predicate is a property test on
an acorn node type the module already imports (`Program`, `Property`,
`SpreadElement`, `VariableDeclarator` are already in the type-only import at
`domain/workflow-script.ts:33`).

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Reading `ast.body[0]` by hand | `acorn-walk` | A new dependency for a fixed-depth read of one array index. The module header already explains why no AST-walker package is needed. Rejected. |
| Importing `parseWorkflowScript` from the engine and catching its throw | direct engine dependency | Explicitly Out of Scope in REQUIREMENTS.md: "Would couple `npm run check` to a 0.x package with ~50 releases since May 2026 and no exported contract." Also would *evaluate* nothing but would add a network-installed peer to the unit suite. Rejected. |

**Installation:** none.

## Package Legitimacy Audit

**Not applicable -- this phase installs no external packages.** The only library
involved (`acorn`) is a pre-existing direct dependency declared in
`package.json` and imported at `extensions/pi-claude-marketplace/domain/workflow-script.ts:26`
(`import { parse, tokTypes } from "acorn";`). No registry lookup, no new
`postinstall` surface, no `SLOP`/`SUS` verdict to report.

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### System Architecture Diagram

```text
    a workflow script's bytes
              |
              v
  +-------------------------------------------------------------+
  | domain/workflow-script.ts :: admitWorkflowScript             |
  |                                                              |
  |   parseScript(source) --> { ast, comments, literalRanges }   |
  |        |                                                     |
  |        +-- undefined? --> RefusedWorkflow(unparseable) ------)---> NO GATES
  |        |                                                     |
  |   findMetaObject(ast)                                        |
  |        +-- not object-literal --> SkippedWorkflow -----------)---> NO GATES
  |   readMetaString(name)                                       |
  |        +-- opaque --> SkippedWorkflow ----------------------)---> NO GATES
  |   findDeterminismViolation(...)                              |
  |        +-- hit --> RefusedWorkflow(determinism-*) ----------)---> NO GATES
  |        |                                                     |
  |        v                                                     |
  |   *** NEW: readEngineGates(ast, meta) ***                    |
  |        walks the engine's own check order over ast.body[0]   |
  |        first failure wins; returns WorkflowGate[] (0 or 1)   |
  |        |                                                     |
  |        v                                                     |
  |   NamedWorkflow | StemFallbackWorkflow  + gates[]            |
  +-------------------------------------------------------------+
              |
              v
  +-------------------------------------------------------------+
  | bridges/workflows/discover.ts :: verdictWarning              |
  |   INSTALL_OUTCOMES[site] / PREVIEW_OUTCOMES[site]            |
  |   -> softFailWarning(file, dir, phrase, reason)              |
  |   -> warnings[]                                              |
  +-------------------------------------------------------------+
              |
              +-------------------+-------------------+
              |                   |                   |
              v                   v                   v
  prepareStageWorkflows      previewWorkflows    (unchanged)
  (.result.warnings)         (redacted notes)
              |                   |
   +----------+---------+         |
   |          |         |         |
   v          v         v         v
install    update   reinstall   info
   |          |         |         |
bridgeWarn discovery bridgeWarn  notes[] on the row
   |          |         |         |
   X DROPPED  |         X DROPPED |
 standalone   |       standalone  |
   |          |         |         |
   v          v         v         v
outcome.  surfaceDiscoveryWarnings   notify() renders
postCommit    -> notifyDiagnostic     "note: ..." lines
Warnings      (2nd ctx.ui.notify,     INSIDE the row
(orchestrated  severity "warning")
 only)
```

### `parseScript` gives you everything (WGATE-02, answered)

`ParsedScript` is
[VERIFIED: extensions/pi-claude-marketplace/domain/workflow-script.ts:85-90]:

```ts
interface ParsedScript {
  readonly ast: Program;
  readonly comments: readonly Comment[];
  /** String, template and regex token ranges -- the text a script quotes rather than runs. */
  readonly literalRanges: readonly Range[];
}
```

`ast` is a full acorn `Program`. Every one of the six warnable gates is a
property test on `ast.body[0]` or on the `meta` object literal `findMetaObject`
already returned. **Measured: zero gates require anything the one `parse()` call
does not already supply.** The bridge's parse options match the engine's on
every flag that affects the tree:

| option | bridge (`workflow-script.ts:535-542`) | engine (`src/workflow.ts:1513-1519`) |
|---|---|---|
| `ecmaVersion` | `"latest"` | `"latest"` |
| `sourceType` | `"module"` | `"module"` |
| `allowReturnOutsideFunction` | `true` | `true` |
| `allowAwaitOutsideFunction` | `true` | `true` |
| `ranges` | (default) | `false` |
| `onComment` / `onToken` | collected | not collected |

`ranges: false` is acorn's default, and `onComment`/`onToken` add products
without changing the tree. **The two ASTs are structurally identical.**
[VERIFIED: both files read this session; engine source at
`/tmp/.../package/src/workflow.ts:1513-1519` from `npm pack
@quintinshaw/pi-dynamic-workflows@3.10.1`]

### The gate table, measured

**The engine's nine checks, read verbatim from `src/workflow.ts:1504-1564` at
3.10.1 this session.** The line numbers Phase 114 published are correct and
still land: `parseWorkflowScript` opens at 1504 and closes at 1564; `validateMeta`
runs 1611-1626.

The nine throw sites, in the order the engine reaches them:

| # | Engine line | Predicate (verbatim) | Message (verbatim) |
|---|---|---|---|
| 1 | 1505 | `if (DETERMINISM_BLOCKLIST.test(script))` | `"Workflow scripts must be deterministic: Date.now()/Math.random()/new Date() are unavailable"` |
| 2 | 1513 | `const ast = parse(script, {...})` | acorn's own `SyntaxError` |
| 3 | 1522 | `if (first?.type !== "ExportNamedDeclaration")` | ``"`export const meta = { name, description, phases }` must be the first statement in the script"`` |
| 4 | 1531 | `if (declaration?.type !== "VariableDeclaration" \|\| declaration.kind !== "const")` | ``"meta export must be `export const meta = ...`"`` |
| 5 | 1540 | `if (declaration.declarations.length !== 1)` | ``"meta export must declare only `meta`"`` |
| 6 | 1547 | `if (declarator.id?.type !== "Identifier" \|\| declarator.id.name !== "meta")` | ``"meta export must declare `meta`"`` |
| 7 | 1552 | `if (!declarator.init)` | `"meta must have a literal value"` |
| 8 | 1557 | `const meta = evaluateLiteral(declarator.init, "meta");` | per-node; see below |
| 9 | 1558 | `validateMeta(meta);` | one of six; see below |

[VERIFIED: `package/src/workflow.ts:1504-1564`, read this session]

**Check 8 is itself eleven throw sites, and the doc says nothing about that --
correctly.** `evaluateLiteral` (1566-1602) throws at: `spread not allowed in
${path}` (1571), `only plain properties allowed in ${path}` (1572), `computed
keys not allowed in ${path}` (1573), `methods/accessors not allowed in ${path}`
(1574), `reserved key name not allowed in ${path}: ${key}` (1577), `sparse
arrays not allowed in ${path}` (1585), `spread not allowed in ${path}` (1586,
the array arm), `template interpolation not allowed in ${path}` (1592), `only
negative-number unary allowed in ${path}` (1598), `non-literal node type in
${path}: ${node.type}` (1600); and `propertyKey` (1604-1609) throws `unsupported
key type in ${path}: ${node.type}` (1608). The document's standing rule -- "This
document states no total count of the engine's refusal messages, and none should
be added" -- is what keeps that sub-enumeration out of the counts, and it should
stay out. **Do not add a count of check 8's sub-messages to the doc; it would
redden nothing today but would create a fourth number with no counting rule.**

**Check 9's six messages, verbatim from `src/workflow.ts:1611-1626`:**
`"meta must be an object"`, `"meta.name must be a non-empty string"`,
`"meta.description must be a non-empty string"`, `"meta.model must be a string"`,
`"meta.phases must be an array"`, `"each meta phase must have a title string"`.
[VERIFIED: `package/src/workflow.ts:1611-1626`] Six. The doc's count holds.

#### The cross-table: what the bridge does with each gate's shape

Measured this session by running the real `parseWorkflowScript` (from the packed
3.10.1 `dist/workflow.js`) beside the real `admitWorkflowScript` (from
`extensions/pi-claude-marketplace/domain/workflow-script.ts`) over one script per
shape, plugin name `acme`, file name `s.js`:

| Engine gate + shape | Engine says | Bridge verdict | Warnable? |
|---|---|---|---|
| 3: `const x=1;` before `export const meta` | check 3 | `named` `acme:a` | **YES** |
| 3: `const meta = {...}` never exported | check 3 | `named` `acme:a` | **YES** |
| 3: `export default 1;` first | check 3 | `named` `acme:a` | **YES** |
| 4: `export let meta = {...}` | check 4 | `named` `acme:a` | **YES** |
| 4: `export var meta = {...}` | check 4 | `named` `acme:a` | **YES** |
| 4: `export { meta };` first (declaration is `null`) | check 4 | `named` `acme:a` | **YES** |
| 4: `export function f(){}` first | check 4 | `named` `acme:a` | **YES** |
| 5: `export const meta = {...}, other = 1;` | check 5 | `named` `acme:a` | **YES** |
| 6: `export const other = 1;` first, meta later | check 6 | `named` `acme:a` | **YES** |
| 6: `export const { meta } = pkg;` (ObjectPattern id) | check 6 | `skipped` `no-meta` | no -- already skipped |
| 7: `export const meta;` | **acorn `Unexpected token (1:17)`** -> check 2 | `refused` `unparseable` | **UNREACHABLE** |
| 8: `phases:[{title:'t',...r}]` (nested spread) | check 8 | `named` `acme:a` | **YES** |
| 8: `` name:`a${x}` `` (template interpolation) | check 8 | `stem-fallback` `acme:s` | **YES** (already warned; see below) |
| 8: `f(){}` method in meta | check 8 | `named` `acme:a` | **YES** |
| 8: `get g(){...}` accessor in meta | check 8 | `named` `acme:a` | **YES** |
| 8: `prototype:1` reserved key | check 8 | `named` `acme:a` | **YES** |
| 8: `phases:[,{title:'t'}]` sparse array | check 8 | `named` `acme:a` | **YES** |
| 8: `model: someVar` (non-literal) | check 8 | `named` `acme:a` | **YES** |
| 9: no `description` | check 9 | `named` `acme:a` | **YES -- the widest row** |
| 9: `description:'   '` (whitespace only) | check 9 | `named` `acme:a` | **YES** |
| 9: `description: 5` | check 9 | `named` `acme:a` | **YES** |
| 9: `model: 5` | check 9 | `named` `acme:a` | **YES** |
| 9: `model: -1` (negative-number unary) | check 9 | `named` `acme:a` | **YES** |
| 9: `phases: {}` | check 9 | `named` `acme:a` | **YES** |
| 9: `phases: [{}]` (no title) | check 9 | `named` `acme:a` | **YES** |
| 9: `export const meta = 5;` | check 9 `"meta must be an object"` | `skipped` `meta-not-object-literal` | no -- already skipped |
| 9: `name: ''` | check 9 `"meta.name must be a non-empty string"` | `refused` `unsafe-name` | no -- already refused |
| control: well-formed | ADMITS | `named` `acme:a` | n/a |

[VERIFIED: measured this session; probe run from the repo root against
`extensions/pi-claude-marketplace/domain/workflow-script.ts` and the packed
engine `dist/workflow.js`; probe artifacts removed after the run]

#### Therefore: the `replicate / warn / neither` column

| # | Check | Column value | Why |
|---|-------|--------------|-----|
| 1 | determinism blocklist | **replicate** | `DETERMINISM_BLOCKLIST` is vendored byte-identical; WGATE-04 keeps it a refusal |
| 2 | `parse` | **replicate** | `parseScript` returns `undefined` -> `refused` `unparseable` |
| 3 | first statement is `ExportNamedDeclaration` | **warn** | `ast.body[0]?.type !== "ExportNamedDeclaration"` |
| 4 | declaration is a `const` `VariableDeclaration` | **warn** | covers `let`/`var`, `export {meta}` (declaration `null`), and a non-variable first export |
| 5 | exactly one declarator | **warn** | `declaration.declarations.length !== 1` |
| 6 | declarator id is `Identifier` named `meta` | **warn** | reachable on the `Identifier`-but-wrong-name arm; the `ObjectPattern` arm is already a skip |
| 7 | declarator has an initializer | **neither** | **unreachable**: `export const meta;` is a `SyntaxError` acorn rejects at check 2, and every non-`const` form fails check 4 first. The engine cannot reach this throw from a parseable script. |
| 8 | `evaluateLiteral` on the initializer | **warn** | all eleven sub-throws are decidable from node type, `computed`, `kind`, `method`, key name and `expressions.length` -- no evaluation needed |
| 9 | `validateMeta` on the evaluated object | **warn** | the `description`, `model` and `phases` arms are decidable from the literal shapes; the `object` and empty-`name` arms are already covered by an existing skip/refusal |

**Seven unreplicated, six warnable, one `neither`.** The CONTEXT's predicted
`neither` case -- the substituted template-literal `meta.name` -- is *not* the
`neither` case: detecting `TemplateLiteral` with `expressions.length > 0` is a
one-property test, and the engine's own `evaluateLiteral` decides it the same
way. What the bridge cannot do is *resolve* that name to a value; it can name
the gate perfectly. **This is a genuine finding that contradicts the CONTEXT's
stated example, and the doc's rewritten paragraph must not repeat the old
example as the reason `neither` exists.**

#### The one constraint that makes gate reading sound

**A `const meta` in the first statement is the only `meta` binding in a
parseable module.** Measured: `export const meta = {...};\nvar meta = 1;` gives
`Identifier 'meta' has already been declared (2:4)`; so does `var meta=1;` before
it; so does a later `function meta(){}`. Only a `var meta` *inside a function*
parses, and `findMetaObject` walks `ast.body` only, so it never sees one.
[VERIFIED: acorn probe, this session]

Two consequences the planner must encode:

1. **When the engine passes checks 3-7, `findMetaObject`'s object IS the first
   statement's declarator init.** So checks 8 and 9 may safely read the `meta`
   elements already in hand. No second lookup, no divergence.
2. **When an earlier gate fails, the engine never evaluates the object, so
   reporting checks 8 or 9 would be inventing findings.** The reader must be
   **first-failure-wins in the engine's own order**, returning at most one gate
   per script. `export const other = 1; const meta = {name:'a'}` fails check 6;
   reporting "no description" as well would describe an object the engine never
   looks at.

#### Interaction with the existing `stem-fallback` warning

`unrunnableWarning` (`discover.ts:220-232`) already fires for every
`stem-fallback` verdict, with the reason
`"the engine loads a command only from a literal `meta.name` with a non-empty
`meta.description`, and this script declares no readable name"`
[VERIFIED: extensions/pi-claude-marketplace/bridges/workflows/discover.ts:229-231].
A stem-fallback script whose name is an interpolated template would otherwise
earn **two** lines: the existing unrunnable caveat and a new check-8 gate line.
Both are true, but two lines for one file is the kind of noise that makes a
warning channel ignorable. **Design decision for the planner:** either suppress
the gate line when the verdict is `stem-fallback` and the gate is 8-or-9-on-name
(the unrunnable line already says it), or let `unrunnableWarning` *become* the
check-8/9 gate line by naming the gate in it. The second is cleaner and keeps
one line per file per condition.

### `admitWorkflowScript`'s decision order, and where the gate read goes

The order, from the function body
[VERIFIED: extensions/pi-claude-marketplace/domain/workflow-script.ts:125-169]:

1. `assertSafeName(pluginName, "plugin name")` -- throws; a defect of the SET
2. `parseScript(source)`; `undefined` -> `refused` `unparseable`
3. `findMetaObject(parsed.ast)`; `kind !== "object-literal"` -> `skipped`
4. `readMetaString(meta.elements, "name")`; `opaque` -> `skipped`
5. `findDeterminismViolation(...)` -> `refused` `determinism-{code,comment,string,split}`
6. `readMetaString(meta.elements, "description")` -> `description`
7. `metaName.kind === "no-literal"` -> `stemFallbackVerdict` else `namedVerdict`
   (either may still return `refused` `unsafe-name` via `generateOrRefuse`)

The header calls the order load-bearing for two stated reasons, both quoted
verbatim from the doc comment at lines 105-123:

> The decision order is fixed and load-bearing: unparseable is settled FIRST,
> because acorn pushes into the comment and token arrays as it scans and only
> then throws -- on a parse failure those arrays are partially filled, so any
> classification built on them would be unsound.

> `meta` before determinism is deliberate. Detection is convention-based over
> `<pluginRoot>/workflows/**`, so every `.js` file under that tree arrives here,
> shared helper modules included.

**The gate read belongs at step 6 or 7 -- after determinism, before the verdict
is constructed.** Placing it earlier would mean reading gates off a script that
is about to be refused, which is exactly what criterion 3 forbids. Placing it
inside `namedVerdict`/`stemFallbackVerdict` is the tidiest seam: both already
take the `meta` elements' products and both already return the two admitted
arms.

### The verdict types, and every consumer

The exact shapes
[VERIFIED: extensions/pi-claude-marketplace/domain/workflow-script.ts:35-83]:

```ts
export interface NamedWorkflow {
  readonly outcome: "named";
  readonly fileName: string;
  readonly metaName: string;
  readonly generatedName: string;
  readonly description?: string; // WBRG-01 envelope input; unused by the verdict
}

export interface StemFallbackWorkflow {
  readonly outcome: "stem-fallback";
  readonly fileName: string;
  readonly generatedName: string;
  readonly description?: string;
}

export type SkippedCause =
  "no-meta" | "meta-not-object-literal" | "meta-spread" | "meta-computed-key";

export type RefusedCause =
  | "unparseable"
  | "determinism-code"
  | "determinism-comment"
  | "determinism-string"
  | "determinism-split"
  | "unsafe-name";

export interface SkippedWorkflow {
  readonly outcome: "skipped";
  readonly fileName: string;
  readonly reason: string; // human-readable
  readonly cause: SkippedCause;
}

export interface RefusedWorkflow {
  readonly outcome: "refused";
  readonly fileName: string;
  readonly reason: string; // human-readable
  readonly cause: RefusedCause;
}

export type WorkflowVerdict =
  NamedWorkflow | StemFallbackWorkflow | SkippedWorkflow | RefusedWorkflow;

/** The two arms that carry a `generatedName`, and so the two a collision can involve. */
export type AdmittedWorkflow = NamedWorkflow | StemFallbackWorkflow;
```

`findMetaObject`'s contract
[VERIFIED: extensions/pi-claude-marketplace/domain/workflow-script.ts:563-566,589-607]:
it returns `MetaLookup = { kind: "object-literal"; elements: readonly MetaElement[] } | { kind: "no-meta" } | { kind: "meta-not-object-literal" }`, scanning
`ast.body` top level only, unwrapping `ExportNamedDeclaration` to its
`declaration`, accepting only `declarator.id.type === "Identifier" && name ===
"meta"`, and applying **LAST WINS about rebinding** -- a declarator with no
initializer never supersedes an earlier one.

**Every consumer of these types outside the defining module** (measured by grep
over `extensions/` and `tests/`):

| File | Uses | Impact of adding `gates` to the two admitted arms |
|---|---|---|
| `bridges/workflows/stage.ts` | `AdmittedWorkflow` (type-only import, line 67); `admittedVerdict` (72-74); `buildEnvelope` (99-105) | **None structurally.** `buildEnvelope` picks fields explicitly (`name`, `description`, `script`), so a new field cannot leak into the envelope bytes. |
| `bridges/workflows/discover.ts` | `WorkflowVerdict` (type-only, line 49); `verdictWarning` (251-270) | **This is the composition site** -- it gains the gate arm. |
| `bridges/workflows/types.ts` | `WorkflowVerdict` on `DiscoveredWorkflow.verdict` (line 29) | None -- carries the union transparently. |
| `tests/domain/workflow-script.test.ts` | 17 references | Existing assertions use property reads, not exhaustive object equality; verify per-assertion. |

**No orchestrator, no `edge/`, no `persistence/`, and no `shared/notify.ts` file
touches these types.** The blast radius of the type change is four files.

**Envelope byte-identity is preserved by construction** -- and that matters,
because `tests/orchestrators/plugin/install.test.ts` installs one fixture twice
and compares raw envelope bytes (documented in the compatibility doc at line
192). `buildEnvelope` is
[VERIFIED: extensions/pi-claude-marketplace/bridges/workflows/stage.ts:99-105]:

```ts
function buildEnvelope(admitted: AdmittedWorkflow & { readonly source: string }): WorkflowEnvelope {
  return {
    name: admitted.generatedName,
    ...(admitted.description === undefined ? {} : { description: admitted.description }),
    script: admitted.source,
  };
}
```

### The warning channel, end to end

**Phrase tables** [VERIFIED: extensions/pi-claude-marketplace/bridges/workflows/discover.ts:114-137]:

```ts
const INSTALL_OUTCOMES: Record<WorkflowOutcomeSite, string> = {
  skipped: "was not installed",
  refused: "was refused",
  "stem-fallback": "was installed but will not run",
  read: "could not be read and was skipped",
  inspect: "could not be inspected and was skipped",
};

const PREVIEW_OUTCOMES: Record<WorkflowOutcomeSite, string> = {
  skipped: "will not be installed",
  refused: "will be refused",
  "stem-fallback": "would be installed but will not run",
  read: "could not be read",
  inspect: "could not be inspected",
};
```

**The discriminants** [VERIFIED: extensions/pi-claude-marketplace/bridges/workflows/types.ts:66,77]:

```ts
export type WorkflowOutcomeTense = "install" | "preview";
export type WorkflowOutcomeSite = "skipped" | "refused" | "stem-fallback" | "read" | "inspect";
```

**How a new phrase joins them:** add a member to `WorkflowOutcomeSite` and the
two `Record<WorkflowOutcomeSite, string>` annotations force an entry in each
table or the tree fails to typecheck. **That is the existing totality construct
and it genuinely fires** -- there is no separate order-and-length lock test for
this union (grep found none), because the `Record` annotation is the lock. The
`INSTALL_OUTCOMES` doc comment already states the contract: "a sixth site cannot
be composed without an entry here AND in the preview table below". The gate line
is that sixth site.

**Message shape** [VERIFIED: extensions/pi-claude-marketplace/bridges/workflows/discover.ts:98-105]:

```ts
function softFailWarning(
  fileName: string,
  workflowsDir: string,
  outcome: string,
  reason: string,
): string {
  return `workflow script "${fileName}" in "${workflowsDir}" ${outcome}: ${reason}`;
}
```

**Production and threading:** `scanWorkflowsDirectory` pushes each
`verdictWarning` into `warnings[]` (`discover.ts:397-401`);
`discoverPluginWorkflows` freezes and returns it (`discover.ts:343-346`);
`prepareStageWorkflows` copies it verbatim into **both** prepared arms --
`kind: "noop"` at `stage.ts:200` and `kind: "staged"` at `stage.ts:249`, both
`warnings: Object.freeze([...discoverWarnings])`.

**Where it goes per verb -- and this is the finding:**

| Verb | Site | Array | Standalone user sees it? | Orchestrated? |
|---|---|---|---|---|
| `install` | `install.ts:1229` `c.bridgeWarnings.push(...prep.result.warnings)` | `bridgeWarnings` | **NO** | yes |
| `update` | `update.ts:1428-1432` `[...discovery, ...handles.workflows.result.warnings, ...]` | discovery half | **YES** | yes |
| `reinstall` | `reinstall.ts:1054-1063` `bridgeWarnings = [...staging.bridge, ...handles.workflows.result.warnings, ...]` | bridge half | **NO** | yes (via `notes`) |
| `info` | `info.ts:730` `notes: workflows.warnings` | row `notes[]` | **YES** | n/a |

The install drop is mechanical
[VERIFIED: extensions/pi-claude-marketplace/orchestrators/plugin/install.ts:1665-1671,1718-1720]:

```ts
  const warnings: string[] = [];
  // Hygiene warnings only; the standalone drop is D-19-01.
  const push = (msg: string): void => {
    if (orchestrated) {
      warnings.push(msg);
    }
  };
  ...
  for (const w of installCtx.bridgeWarnings) {
    push(w);
  }
```

and `install.ts:1676` pushes `installCtx.discoveryWarnings` *ungated*
(`warnings.push(...installCtx.discoveryWarnings);`), which is the array
`surfaceDiscoveryWarnings` then renders at `install.ts:2554-2558`.

`update.ts` already made the opposite call and explained why
[VERIFIED: extensions/pi-claude-marketplace/orchestrators/plugin/update.ts:1422-1427]:

> WLIF-02: the workflow prepare's warnings join the DISCOVERY half, and they
> join it HERE rather than through `splitStagingWarnings`. They describe the
> plugin's declared scripts -- a fact a standalone user needs -- not a
> hygiene note only the cascade forwards.

**That argument is the phase goal, restated.** The planner should reclassify
`install.ts:1229` (and, for symmetry with the same argument, `reinstall.ts:1062`)
from the bridge half to the discovery half. The install site's own comment gives
the reason it went to `bridgeWarnings` -- "The bridge's array mixes per-file
soft-fails with discovery warnings and is not separable at this site" -- which is
also true of `update.ts`, and `update.ts` decided the mixture belongs on the
discovery side anyway.

**Confirmed: `orchestrators/plugin/info.ts` is the preview-tense consumer.**
`previewWorkflows` (`info.ts:771-792`) is the only call site passing
`tense: "preview"`, and it applies `redactAbsolutePaths` to every warning before
returning (`info.ts:790`) -- NFR-9, so the row's bytes do not vary by machine.

### What criterion 2 forbids, mechanically

**The install channel does not touch the row's bytes at all.** It is a second
`ctx.ui.notify` call [VERIFIED: extensions/pi-claude-marketplace/shared/notify.ts:439-449]:

```ts
export function notifyDiagnostic(
  ctx: ExtensionContext,
  header: string,
  lines: readonly string[],
): void {
  if (lines.length === 0) {
    return;
  }

  ctx.ui.notify(`${header}\n\n${lines.join("\n")}`, "warning");
}
```

reached through `surfaceDiscoveryWarnings`
[VERIFIED: extensions/pi-claude-marketplace/orchestrators/plugin/shared.ts:1438-1456], whose
header is `Plugin "<name>" installed; 1 declared component was skipped.` or
`... ; N declared components were skipped.` and whose lines are the warnings
after `redactAbsolutePaths`.

Three consequences the planner can pin as byte assertions:

1. **The plugin row is emitted by a *separate*, *earlier* `notifyWithContext`
   call** (`install.ts:2543-2553`) and is composed by `composeInstalledRow`. A
   gate warning changes nothing that function reads. Criterion 2 is therefore
   pinnable as: *render the same plugin twice, once with a gate-tripping script
   and once without, and assert the first `ctx.ui.notify` argument is
   byte-identical.*
2. **`docs/output-catalog.md` carries no catalog state for the
   `notifyDiagnostic` discovery-warning block.** Grepped: neither `declared
   components were skipped` nor `notifyDiagnostic` appears in the catalog. So
   `tests/architecture/catalog-uat.test.ts` -- which pairs
   `<!-- catalog-state: STATE -->` blocks with `NotificationMessage` fixtures and
   drives `notify()` -- **cannot be reddened by an install-side gate warning.**
3. **The `info` surface DOES change the row's bytes**, by adding a `note:` line.
   The catalog already documents that this is severity-neutral, in the state
   `installed-with-workflow-preview-note` at `docs/output-catalog.md:1891-1903`:
   "A `note:` line does not change the severity of the row: it is a statement
   about one file, and not a failure of the read." The existing exemplar block is
   verbatim:

   ```text
   ● claude-plugins-official [user] <autoupdate>
     ● commit-commands v1.2.0 (installed)
       Helpful git commit commands for everyday use.
       skills: commit-summary
       workflows: commit-commands:changelog
       note: workflow script "roll.js" in "workflows" will be refused: roll.js calls `Math.random`, which the workflow engine refuses as nondeterministic
   ```

   Its fixture is a hand-written `NotificationMessage`, not a discovery run, so
   **the catalog stays green unless the fixture is edited.** Adding a second
   catalog state for a gate-warning `note:` line is optional and recommended, but
   it is a new state rather than an edit to this one.

**`REASONS` is at 45 members** [VERIFIED: `extensions/pi-claude-marketplace/shared/notify.ts:93`,
counted programmatically this session: `"up-to-date"` ... `"requires
pi-dynamic-workflows"`], and the CONTEXT's decision not to add one is what keeps
`tests/architecture/notify-closed-set-locks.test.ts`,
`tests/architecture/compat-01-no-expansion.test.ts` and the catalog byte gate
entirely out of this phase.

### Criterion 3: the two refusal paths, and why they are structurally safe

Both refusal arms are settled **before any admitted verdict exists**, so a gate
reader placed at step 6/7 of the decision order is unreachable from them. That
is stronger than a policy -- it is control flow. But it must still be *pinned*,
because a future refactor could move the gate read earlier:

- **`unparseable`:** `parseScript` returns `undefined` and
  `admitWorkflowScript` returns immediately (`workflow-script.ts:134-141`). There
  is no `ast`, so a gate reader could not run even if called. Pin: the returned
  verdict has `outcome: "refused"`, `cause: "unparseable"`, and (once the field
  exists) carries **no** `gates` -- the field is absent on the refused arm by
  type, which is itself the guarantee, so the pin is a type-level one plus a
  runtime assertion that `verdictWarning` produced exactly one line for that
  file.
- **`determinism-*`:** four causes,
  `"determinism-code" | "determinism-comment" | "determinism-string" |
  "determinism-split"`, classified by `classifySpan` against acorn's own comment
  and literal token ranges (`workflow-script.ts:431-505`). Pin: one script per
  cause, asserting the existing `cause` and the existing `reason` text survive
  unchanged and that no gate line joins them.

### The doc-pin gate

`tests/architecture/workflows-doc-pins.test.ts` carries three tests
[VERIFIED: read this session, 161 lines]. Which assertions a
`replicate / warn / neither` column change can redden:

| Assertion | Line | Reddened by the column change? |
|---|---|---|
| `assert.deepEqual(tableRows, [1,2,3,4,5,6,7,8,9])` from `/^\| (\d+)\s+\| /gm` | 86, 97-101 | **Only if** the edited table stops opening its rows with `\| <n>  \| `, or if a *second* numbered table is added anywhere in the doc (the regex is document-wide, not section-scoped). Changing a later column is safe. |
| `messageBullets.length === 6` from `doc.slice(doc.indexOf("**six distinct messages**")).split("\n\n")[1]` | 91-93, 102-106 | **Only if** the paragraph structure around `**six distinct messages**` changes -- the body is taken as the *second* `\n\n`-delimited chunk after that marker. Inserting a paragraph between the marker sentence and the bullet list breaks it. |
| `assert.match(doc, /\*\*nine distinct checks\*\*/)` | 107-111 | The literal `**nine distinct checks**` must survive verbatim. |
| `assert.match(doc, /\*\*six distinct messages\*\*/)` | 112-116 | Must survive verbatim. |
| `assert.doesNotMatch(doc, /seven gates/i)` | 119-123 | **THIS IS THE TRAP.** A rewritten paragraph saying "the seven gates the bridge does not replicate" or "seven gates, six of them warned" **turns the tree red**. The bar is case-insensitive and matches the two words adjacent. The doc's existing safe phrasing is "It admits shapes the other seven refuse" (line 52) -- *seven* alone is fine; *seven gates* is not. |
| peer-floor test | 50-78 | Unaffected. |
| README parity test (2 engine mentions, 1 doc link, identical line numbers) | 126-161 | Unaffected unless a README is edited. Note it asserts `es.engineLines` deepEqual `en.engineLines` -- *line numbers*, so any line inserted into one README alone reddens it. |

**The honest update to this gate.** The pin currently checks the doc's internal
agreement on two counts. After this phase the doc gains a third checkable
enumeration: the `replicate / warn / neither` column. The honest extension is a
fourth assertion that **the set of gate names in the doc's table equals the
closed union in the source** -- which is exactly the totality construct the
CONTEXT mandates, and the only version of it that can actually fail. Read the
column values out of the doc's table rows, read the union members out of
`domain/workflow-*.ts` (by parsing the source text, the way
`tests/architecture/source-scan.ts` does), and `deepEqual` the two sets. Its
negative control is trivial to run and to paste: add a gate to the union, watch
red; restore; remove a doc row, watch red; restore.

Note the existing tests' own header states what they deliberately do **not**
claim: "that `nine` and `six` are the engine's real figures. Those are
source-read at 3.10.1 and only a re-read of the engine can confirm them
(recorded as open debt against `WPIN-01`)." **That debt is now partly paid for
this phase's purposes -- the nine and the six were re-read this session and both
hold** -- but the gate should keep its disclaimer, because the re-read is not
machine-checkable and WPIN-01 remains deferred.

### The sentence that must be retracted, and everything that leans on it

The full paragraph, verbatim from `docs/workflows-compatibility.md:69`:

> The `meta.description` gap is the widest of the eight rows, because it is
> invisible to the author: a script that declares a perfectly good `meta.name`
> and no description installs, registers a command, and dies at first
> invocation. Install-time warnings for these shapes are deliberately not
> implemented; replicating the engine's structural rules would make this
> extension refuse scripts for reasons a future engine release may drop. See
> Spike 027 for the re-measurement all of the above rests on.

**Everything else in the repository that asserts or depends on that claim.** All
must move with it, or the tree contradicts itself:

| Location | Text | Why it moves |
|---|---|---|
| `docs/workflows-compatibility.md:52` | "This bridge replicates **two** of them: the determinism screen and the parse. It admits shapes the other seven refuse, which means a script can install cleanly here and then refuse to run there." | Still true about *admission*. Needs a clause saying six of the seven now produce an install-time warning. Keep the words `seven` and away from `seven gates`. |
| `docs/workflows-compatibility.md:54` | "The failure is bounded and visible: the envelope is written, the command registers, and the engine reports the refusal the first time anyone runs it." | Still true, but the phase adds an *earlier* signal. Needs one sentence. |
| `docs/workflows-compatibility.md:75-85` (the classification table) | the `This bridge` column, values `replicates` / `no` / `partly` / `name only` | **This is the WGATE-05 column.** Restate as replicate / warn / neither per the measured table above. |
| `docs/workflows-compatibility.md:89` | "The three `partly` rows are where the bridge's own walk looks for the same thing for a different reason -- finding `meta.name` -- and reaches a softer verdict" | The word `partly` disappears with the column. This sentence goes or is rewritten. |
| `docs/workflows-compatibility.md:106` | Script-semantics row: "`export const meta` as the first statement \| ✓ \| ⚠ \| required upstream and by the engine; **not enforced at install time here**" | "not enforced" becomes "not enforced, but warned" -- check 3 is now a warn. |
| `docs/workflows-compatibility.md:107` | "`meta.name`, `meta.description` required \| ✓ \| ⚠ \| the bridge requires a readable name and **never checks the description**" | **Directly false after this phase.** The description check is the widest warn. |
| `docs/workflows-compatibility.md:108` | "`meta` must be a pure literal \| ✓ \| ⚠ \| ... the bridge stem-names a non-literal name instead of refusing it" | Still true; add that it warns. |
| `docs/workflows-compatibility.md:205-238` ("Install-time disposition") | five responses; "**Installed with a caveat**" currently lists only the two stem-fallback shapes | The gate warnings are a new population of "installed with a caveat". Either widen that response's bullet list or add a sixth response. Widening is truer: nothing new happens on disk. |
| `extensions/pi-claude-marketplace/domain/workflow-script.ts:274-280` (`stemFallbackVerdict` doc) | "Narrowing the fallback to the shapes the engine can load would mean replicating its structural rules here, which the module header declines... Telling the user belongs to the bridge that writes the envelope... **Tracked there as a roadmap criterion so the arm does not stay a silent dead-command factory.**" | The last sentence becomes stale the moment this ships. Under the comment policy, replace with a present-tense fact about the current code. |
| `extensions/pi-claude-marketplace/domain/workflow-script.ts:385-388` (`DETERMINISM_BLOCKLIST` doc) | "This is the ONLY engine gate replicated. `parseWorkflowScript` carries further structural rules, but they are unexported internals of a **0.x package**, and copying them would make our install refuse scripts for reasons an engine upgrade may drop." | Two defects, one pre-existing. (a) It is not the only replicated gate -- the parse is the second, as the doc's own table says. (b) **`@quintinshaw/pi-dynamic-workflows` is at 3.10.1, not 0.x** [VERIFIED: package.json in the packed tarball]; the same stale "0.x" claim is corrected in the doc at line 196 ("the package is well past 1.0"). And the reason clause needs the warn-versus-refuse distinction this phase installs. |
| `extensions/pi-claude-marketplace/bridges/workflows/discover.ts:234-250` (`verdictWarning` doc) | "the warning a verdict earns, or `undefined` for the `named` arm alone" | **Directly false after this phase** -- a `named` arm can now earn a gate warning. |

### The BACKLOG pruned-footer convention

**The convention exists exactly once in the file.** Grepped for `^<!--` /
`^-->`: two hits, at lines 2544 and 2552, one block. Verbatim
[VERIFIED: .planning/BACKLOG.md:2544-2552]:

```markdown
<!--
Pruned 2026-06-08: both prior items shipped in v1.10 Error Attribution.
- "Install error misattribution when marketplace is missing" -> closed by ATTR-01..10
  (every op converges on the marketplace-subject `{not added}` model; see
  tests/orchestrators/plugin/install.test.ts "ATTR-01").
- "Structural `{not added}` variant for `PluginInfoMessage`" -> closed by TYPE-01..04
  (dedicated `marketplace-not-added` kind in shared/notify.ts; placeholder/sole-reason
  renderer carve-out removed).
-->
```

The convention, read off that one instance:

1. An **HTML comment block**, `<!--` and `-->` each alone on a line.
2. First line: `Pruned <ISO date>: <one-sentence reason naming the milestone>.`
3. Then one bullet per pruned entry: `- "<the entry's subject>" -> closed by
   <requirement IDs> (<parenthetical naming the code seam or the test that
   proves it>).`
4. **It sits in the body of the file, immediately after the entry that
   superseded it** -- at line 2544 it follows the surrogate-screen entry and
   precedes `## CASCADEAX-01`. It is *not* a trailing footer at the end of the
   file, despite the requirement's wording ("the file's existing pruned-footer
   convention" / REQUIREMENTS.md's seam note "the trailing `<!-- Pruned -->`
   convention"). **Follow the file, not the wording.** Placing the WFLW-01
   footer where the WFLW-01 entry stood is the faithful read.

**The current `WFLW-01` entry** occupies `.planning/BACKLOG.md:891-936`, from the
heading `## WFLW-01: \`workflows\` component kind -- mechanical fix shipped, bridge
planned` through the `Code seams:` paragraph ending
"`shared/notify.ts` / `docs/output-catalog.md` (the closed REASONS set)." Its two
operative paragraphs are verbatim:

> **Half of this is done.** PR #154 (2026-08-29) landed the mechanical fix:
> `workflows` is in `UNSUPPORTED_COMPONENT_KINDS` with a `workflows/` convention
> entry, and a workflow-bearing plugin now resolves `partially-available` and
> reports a dedicated `workflows` reason.

> It is now the `workflows-replay` milestone, Phases 109-114, in the `workflows`
> workstream. Phase 109 is the inversion of what #154 landed. This entry stays
> open until that milestone ships, and closes with it.

**Which milestone name to cite -- and this needs a decision, not a guess.** Three
sources disagree in wording:

- `WFLW-01` itself: "closes with" **`workflows-replay`**.
- The ROADMAP's criterion 5 (line 589): "naming the **`workflows`** milestone
  that closed it".
- `.planning/MILESTONES.md:21`: the shipped milestone is
  `## workflows-detection -- Workflow Detection (Shipped: 2026-08-29)` -- the
  *mechanical* half, i.e. PR #154.

There is no milestone literally named `workflows`; the ROADMAP is using it as a
family label. **Recommendation: name both, because the entry itself has two
halves and each was closed by a different milestone** -- e.g. `closed by
workflows-detection (the mechanical half, shipped 2026-08-29) and
workflows-replay (the bridge)`. That is the only phrasing under which every
sentence of the pruned footer is true. Flag it for the operator at plan time;
it is a one-line choice with no code consequence.

**Note also:** `.planning/BACKLOG.md:2498` contains the string "workflow
milestone's own never-turn-a-reading-into-a-refusal anchor" -- an unrelated entry
that references this phase's posture. Read it before editing so the prune does
not orphan a cross-reference.

### Anti-Patterns to Avoid

- **A gate reader that runs before the verdict is settled.** It would read gates
  off a script about to be refused, which is what criterion 3 forbids and what
  the load-bearing decision order exists to prevent.
- **Reporting more than one gate per script.** The engine stops at its first
  failure. Reporting checks 8 and 9 for a script that already failed check 3
  describes an object the engine never evaluates.
- **A second `parse()` call.** WGATE-02 forbids it, and nothing needs it.
- **A new `REASONS` member.** Moves the row's bytes, drags the catalog byte gate,
  and grows a closed set the CONTEXT explicitly froze at 45.
- **The phrase `seven gates` anywhere in `docs/workflows-compatibility.md`.**
  `workflows-doc-pins.test.ts:119-123` bars it case-insensitively.
- **Suppressing the gate line silently when it coincides with the stem-fallback
  caveat.** Whichever way the overlap is resolved, it must be a stated rule in a
  comment and a pinned test -- not an accident of ordering.
- **Adding a fifth member to `splitStagingWarnings`.** Both `update.ts` and
  `reinstall.ts` state, in comments, that the classifier is deliberately left at
  four members because a fifth "would drag every other consumer of it into this
  change." Reclassify at the call site, as `update.ts` already does.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Walking the AST to find `meta` | A recursive walker or `acorn-walk` | `findMetaObject(ast)` + `ast.body[0]` | The engine reads exactly `ast.body[0]`; the bridge already reads the whole top level. Nothing deeper is needed and a walker would drift from the engine's shallowness. |
| Reading a `meta` property's literal text | A `JSON.parse` of a slice, or a regex | `readMetaString(elements, key)` / `literalString(node)` | They already implement the engine's `evaluateLiteral` leaf rules exactly (string `Literal`, substitution-free `TemplateLiteral`, `cooked` not `raw`), and the reasoning is documented at `workflow-script.ts:710-733`. |
| Escaping untrusted plugin text into a message | A `JSON.stringify` or an ad-hoc replace | `forMessage(text)` (`workflow-script.ts:771-776`) | It screens `\p{Cc}` and `\p{Cf}` -- the same two classes the engine's own `isSafeSavedWorkflowName` screens -- covering newline forgery in a POSIX file name and U+202E bidi override in a `meta.name`. **Every new gate reason string must go through it.** |
| Composing the warning sentence | A new template string | `softFailWarning(...)` + a new `WorkflowOutcomeSite` member | One shape for every per-file soft-fail is what makes the channel scannable, and the `Record<WorkflowOutcomeSite, string>` annotation is the compile-time totality lock. |
| Hiding absolute paths from a rendered warning | A `path.basename` at the composition site | `redactAbsolutePaths(...)` at the render site | NFR-9. `info.ts:790` and `shared.ts:1450` already do it; the bridge deliberately embeds the absolute directory and lets each surface reduce it. |
| Deciding whether a standalone user sees a warning | A new boolean on the bridge result | the orchestrator's discovery/hygiene split (D-141-03) | The split is orchestrator policy, and putting it on the bridge would give four verbs four answers. |

**Key insight:** every primitive this phase needs already exists in
`domain/workflow-script.ts` and `bridges/workflows/discover.ts`. The phase is
a *composition* of existing seams plus one new pure function and one closed
union. If a task in the plan is building a new mechanism, it is probably
re-implementing one of the six rows above.

## Common Pitfalls

### Pitfall: the enumeration is short (again)

**What goes wrong:** the gate union ships with fewer members than the engine has
reachable gates, and nothing fails.
**Why it happens:** the union is written from a list in prose rather than from
the engine's source, and the totality construct binds the union to a table that
was written from the same prose.
**How to avoid:** the union is derived from the measured table in this document,
and the doc-pin test compares the doc's rows to the source's union members --
two artifacts that must be edited separately. **Then run the negative control in
both directions**: add a union member without a doc row (red), remove a doc row
without touching the union (red).
**Warning signs:** a "totality" construct whose type parameter is inferred
rather than annotated; a `Record<K, V>` where `K` is `string`; a test that reads
the union and asserts `.length`.

### Pitfall: check 7 is warned on, and the warning can never fire

**What goes wrong:** the union gets a seventh member for "missing initializer",
a doc row is written for it, a test is written that constructs
`export const meta;` -- and the test asserts the *unparseable* refusal instead,
or is quietly written against `export let meta;` which lands on check 4.
**Why it happens:** the ROADMAP's criterion-1 sentence names "a missing
initializer" as one of its six shapes.
**How to avoid:** check 7's column value is `neither`, and the reason stated in
the doc is *unreachable*, not *undetectable*. The evidence is one line:
`export const meta;` gives acorn `Unexpected token (1:17)`.
**Warning signs:** a fixture named for check 7 whose expected verdict is
`refused` / `unparseable`.

### Pitfall: the install warning lands where nobody reads it

**What goes wrong:** the gate warnings are correct, the tests are green, and a
standalone `/claude:plugin install` prints nothing.
**Why it happens:** `install.ts:1229` puts the bridge's warnings on
`bridgeWarnings`, which `collectPostCommitWarnings` gates behind `orchestrated`.
**How to avoid:** reclassify to `discoveryWarnings` and pin it with a test that
drives a standalone install and asserts the *second* `ctx.ui.notify` call
contains the gate line.
**Warning signs:** every new test asserting on `outcome.postCommitWarnings` or
running with `orchestrated: true`; no test that inspects `ctx.ui.notify` calls
on the standalone path.

### Pitfall: two warning lines for one file

**What goes wrong:** a stem-fallback script with an interpolated `meta.name`
earns both `unrunnableWarning` and a check-8 gate line, saying the same thing
twice in different words.
**Why it happens:** the gate reader is added beside `verdictWarning`'s existing
arms rather than folded into them.
**How to avoid:** decide the overlap rule explicitly (recommendation: let the
gate name *enrich* the stem-fallback line rather than add a second one) and pin
it with a test that counts lines per file.
**Warning signs:** a discovery test whose expected `warnings` array is longer
than the number of non-admitted-plus-caveated files.

### Pitfall: the doc edit reddens `seven gates`

**What goes wrong:** the rewritten paragraph naturally reaches for "the seven
gates the bridge does not replicate" and `workflows-doc-pins.test.ts` fails with
a message about a "retired figure" that reads like a stale-content complaint.
**Why it happens:** the bar is case-insensitive on two adjacent words and the
phrase is the obvious one.
**How to avoid:** write "the other seven checks", "seven unreplicated checks",
or "six of the seven". The doc already uses `checks` as its noun throughout.
**Warning signs:** the failure message quoting "carries the retired 'seven
gates' figure".

### Pitfall: the doc-pin count regexes are document-wide

**What goes wrong:** a new numbered table added to the doc (for instance, a
per-gate detail table) makes `tableRows` deepEqual `[1..9]` fail with rows like
`[1,2,3,4,5,6,7,8,9,1,2,3]`.
**Why it happens:** `/^\| (\d+)\s+\| /gm` is run over the whole document, not
over one section.
**How to avoid:** put the new column on the existing nine-row table -- which is
what WGATE-05 asks for anyway -- and do not add a second numbered table.
**Warning signs:** a diff that introduces `| 1  |` outside the classification
table.

### Pitfall: `fallow health` on the gate reader

**What goes wrong:** the reader is written as one function with a seven-branch
ladder and fails `maxCognitive: 15` or `maxCyclomatic: 20` -- possibly only on
fallow, which uses a different algorithm from `sonarjs/cognitive-complexity`.
**Why it happens:** the six checks read naturally as one sequential `if` chain.
**How to avoid:** one small predicate per gate, driven by an ordered array of
`{ gate, test }` pairs -- which also *is* the totality construct, if the array is
typed as an exact-coverage map over the union.
**Warning signs:** a single function over 40 lines with six `return` statements;
a green ESLint run treated as proof fallow will pass. There are currently **zero**
`health.thresholdOverrides` entries in `.fallowrc.json`, so there is no escape
hatch.

## Code Examples

### The measured predicate for each warnable gate

```ts
// Source: measured against @quintinshaw/pi-dynamic-workflows 3.10.1,
// src/workflow.ts:1522-1552, read 2026-09-08. First failure wins, in the
// engine's own order. Check 7 is omitted: it is unreachable behind check 2.
//
// `ast` is `ParsedScript.ast`, already in hand from the one parse().

const first = ast.body[0];

if (first?.type !== "ExportNamedDeclaration") {
  return "meta-not-first-export";              // engine check 3
}

const declaration = first.declaration;

if (declaration?.type !== "VariableDeclaration" || declaration.kind !== "const") {
  return "meta-not-const";                     // engine check 4
}

if (declaration.declarations.length !== 1) {
  return "meta-not-sole-declarator";           // engine check 5
}

const declarator = declaration.declarations[0];

if (declarator?.id.type !== "Identifier" || declarator.id.name !== "meta") {
  return "meta-not-named-meta";                // engine check 6
}

// checks 8 and 9 read `declarator.init`, which -- because a top-level
// `const meta` is unique in a parseable module -- is the same ObjectExpression
// `findMetaObject` already returned.
```

### The existing totality construct this phase extends

```ts
// Source: extensions/pi-claude-marketplace/bridges/workflows/discover.ts:114-137
// The `Record<WorkflowOutcomeSite, string>` annotation is the lock: a sixth
// member of the union cannot compile without an entry in BOTH tables.
const INSTALL_OUTCOMES: Record<WorkflowOutcomeSite, string> = { /* 5 entries */ };
const PREVIEW_OUTCOMES: Record<WorkflowOutcomeSite, string> = { /* 5 entries */ };
```

### The existing warning composition the gate line joins

```ts
// Source: extensions/pi-claude-marketplace/bridges/workflows/discover.ts:98-105
function softFailWarning(
  fileName: string,
  workflowsDir: string,
  outcome: string,
  reason: string,
): string {
  return `workflow script "${fileName}" in "${workflowsDir}" ${outcome}: ${reason}`;
}
```

### The install-side reclassification, modelled on `update.ts`

```ts
// Source: extensions/pi-claude-marketplace/orchestrators/plugin/update.ts:1428-1432
// update already routes the workflows bridge's warnings to the DISCOVERY half,
// which is the half a standalone user sees. install.ts:1229 routes the same
// array to bridgeWarnings, which collectPostCommitWarnings gates on
// `orchestrated`.
return Object.freeze([
  ...discovery,
  ...handles.workflows.result.warnings,
  ...(cascade ? bridge : []),
]);
```

## State of the Art

| Old claim | Current claim | Evidence |
|---|---|---|
| "seven engine gates" (archived requirement text) | nine checks, two replicated | `src/workflow.ts:1504-1564`, re-read 2026-09-08 |
| "the six shapes" (ROADMAP criterion 1) | six *warnable* gates: checks 3, 4, 5, 6, 8, 9 -- but the ROADMAP's list names check 3 twice, names the unreachable check 7, and omits check 6 | cross-probe, this session |
| "some shapes cannot be detected without evaluating the script" (CONTEXT) | **none of the seven require evaluation.** `evaluateLiteral` is a pure AST-shape checker; the `neither` case is unreachability, not undetectability | `src/workflow.ts:1566-1609` + acorn probe |
| "the engine is a 0.x package" (`workflow-script.ts:387`) | 3.10.1; 57 versions across three majors in fourteen weeks | packed `package.json`; the compatibility doc already corrects this at line 196 |
| "Install-time warnings ... deliberately not implemented" (`docs/workflows-compatibility.md:69`) | implemented as warnings, not refusals, for the self-correction reason the sentence itself gives | this phase |

**Deprecated/outdated:**
- The `partly` / `no` / `name only` values in the classification table's `This
  bridge` column -- replaced by `replicate` / `warn` / `neither` (WGATE-05).
- `verdictWarning`'s doc claim that `named` alone earns no warning.
- `stemFallbackVerdict`'s "Tracked there as a roadmap criterion" sentence.

## Runtime State Inventory

**Omitted -- this is not a rename, refactor or migration phase.** The phase adds
a computed field to two in-memory verdict types and a line to a warning array.
Nothing is persisted: `buildEnvelope` picks its three fields explicitly, so the
envelope bytes on disk are unchanged, and `state.json`'s `resources.workflows`
records generated names only. No stored data, no live service config, no
OS-registered state, no secrets and no build artifacts carry a gate name.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | everything | ✓ | v26.8.1 (engines floor `>=20.19.0`; CI pins 24) | -- |
| `acorn` | the gate predicates | ✓ | `^8.16.0`, already a direct dependency | -- |
| `@quintinshaw/pi-dynamic-workflows` | **research only** -- the measurement above | ✓ via `npm pack ...@3.10.1` (network) | 3.10.1 | Not needed at plan or execute time. It is deliberately NOT a declared dependency (REQUIREMENTS.md Out of Scope), so no task may import it. |
| `pre-commit` | the commit gate | ✓ (config present; note `.git/hooks` has no `pre-commit` hook installed, so it must be run by hand) | -- | -- |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** none.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | `node:test` (Node's built-in runner), no external test library |
| Config file | none -- driven entirely by `package.json` scripts |
| Quick run command | `node --test "tests/domain/workflow-script.test.ts" "tests/bridges/workflows/*.test.ts"` |
| Full suite command | `npm run check` (typecheck, lint, fallow, format, corresponding-tests, direct-coverage negative, unit, integration) |

[VERIFIED: package.json `scripts`, read this session]

### Phase Requirements -> Test Map

| Req ID | Behavior | Test type | Automated command | File exists? |
|---|---|---|---|---|
| WGATE-01 | each of the six warnable gates produces exactly one warning naming the file and the gate, and the envelope is still written | unit | `node --test tests/domain/workflow-script.test.ts` | ✅ (extend) |
| WGATE-01 | the warning reaches a **standalone** install's rendered output | unit | `node --test tests/orchestrators/plugin/install.test.ts` | ✅ (extend) |
| WGATE-01 | the warning reaches the `info` preview surface in preview tense | unit | `node --test tests/orchestrators/plugin/info.test.ts` | ✅ (extend) |
| WGATE-01 | sibling scripts in the same plugin install with no warning of their own | unit | `node --test tests/bridges/workflows/discover.test.ts` | ✅ (extend) |
| WGATE-02 | one `parse()` per script -- no second parse | unit | `node --test tests/domain/workflow-script.test.ts` (spy/count on the acorn import is not available; assert instead that no new `parse(` call site exists, via `tests/architecture/source-scan.ts`) | ❌ Wave 0 (architecture test) |
| WGATE-03 | a gate warning changes no plugin-level status, glyph or disposition | unit (byte) | `node --test tests/orchestrators/plugin/install.test.ts` | ✅ (extend) |
| WGATE-03 | a gate-warned script's verdict stays `named` / `stem-fallback` | unit | `node --test tests/domain/workflow-script.test.ts` | ✅ (extend) |
| WGATE-04 | the four determinism causes and their reasons are unchanged; no gate line joins them | unit (regression) | `node --test tests/domain/workflow-script.test.ts` | ✅ (extend) |
| WGATE-04 | `unparseable` is refused whole with no gate reading | unit (regression) | `node --test tests/domain/workflow-script.test.ts` | ✅ (extend) |
| WGATE-05 | every doc table row's column value equals what the bridge does | architecture | `node --test tests/architecture/workflows-doc-pins.test.ts` | ✅ (extend) |
| WGATE-05 | the doc's gate-name set equals the source's closed union | architecture | `node --test tests/architecture/workflows-doc-pins.test.ts` | ✅ (extend) |
| WDOCS-01 | `WFLW-01` no longer appears as an open `##` entry in BACKLOG.md | manual review | -- | n/a -- planning-artifact edit, reviewer-read |

### Sampling Rate

- **Per task commit:** `node --test tests/domain/workflow-script.test.ts tests/bridges/workflows/*.test.ts tests/architecture/workflows-doc-pins.test.ts` (seconds)
- **Per wave merge:** `npm test && npm run typecheck && npm run fallow`
- **Phase gate:** `npm run check` green before `/gsd-verify-work`. Note the suite
  is currently 5564 unit + 34 integration and passes; do not re-run it as a
  research or spot-check step.

### Wave 0 Gaps

- [ ] `tests/domain/workflow-gates.test.ts` -- **required by
      `npm run test:corresponding` if and only if the gate reader lands in a new
      module.** If the reader lives inside `domain/workflow-script.ts`, the
      existing `tests/domain/workflow-script.test.ts` satisfies the pairing gate
      and no new file is needed. *Decide the module boundary before writing
      tasks; it changes the file list.*
- [ ] An architecture assertion for WGATE-02 ("no second parse"). The existing
      `tests/architecture/source-scan.ts` provides `assertNoForbiddenSurface`,
      which is the right primitive: assert `domain/workflow-script.ts` contains
      exactly one `parse(` call site. This does not exist today.
- [ ] Everything else: **no gaps.** Every other target file already exists and
      already has a paired suite.

### The negative control for the gate-name totality construct

CONTEXT mandates a negative control and a pasted transcript. The construct binds
two artifacts that a single edit cannot change together: the closed union in the
source, and the rows of the doc's classification table. The control must
therefore be run in **both directions**, because a construct can be one-way
green:

1. **Union grows, doc does not.** Add a fabricated member to the gate union.
   Expect: `npm run typecheck` red (the ordered predicate map is not total) AND
   `node --test tests/architecture/workflows-doc-pins.test.ts` red (set
   mismatch). Restore.
2. **Doc row is removed, union does not change.** Delete one `warn` row's gate
   name from the doc table. Expect: the doc-pin test red. Restore.
3. **A doc row's column VALUE is falsified.** Change one row from `warn` to
   `neither` without touching code. Expect: the doc-pin test red **only if the
   test compares column values and not merely gate names.** If it stays green,
   the construct is checking half of what criterion 4 asks and must be
   strengthened -- this is precisely the "green because it checked nothing"
   failure the CONTEXT names.
4. **The construct's own liveness.** Confirm the union type is *referenced* by
   the predicate map's annotation. The milestone has already shipped one forcing
   construct that was unconditionally `never` and one seven-entry literal bound
   to nothing; the check is to comment out the annotation and confirm the tree
   goes red anyway from step 1, which proves step 1's redness came from the
   annotation rather than from an unrelated error.

Paste the four transcripts, not a summary.

### Pinning criterion 3 as a regression rather than an assumption

"Unchanged" is only checkable against a recorded baseline. Two options, and the
second is stronger:

- **Weak:** assert the existing `cause` and `reason` for one script per refusal
  path. This catches a rewrite but not a *reordering* of `admitWorkflowScript`.
- **Strong (recommended):** assert the two facts that make the refusal paths
  structurally unreachable from gate reading, as *behavior*, not as comments:
  1. A script that is BOTH unparseable AND would trip a gate (e.g.
     `const x=1;\nexport const meta = {name:'a'` -- unbalanced brace) returns
     `refused` / `unparseable` and produces **exactly one** warning line, whose
     text is the existing `unparseableReason`.
  2. A script that is BOTH determinism-matching AND would trip a gate (e.g.
     `const x = Date.now();\nexport const meta = {name:'a',description:'d'};` --
     measured this session: engine says determinism, bridge says
     `refused` / `determinism-code`) returns the existing cause and produces
     **exactly one** warning line.

  The "exactly one line" assertion is what makes a later reordering fail: if a
  gate read is hoisted above the refusal arms, the count becomes two.

### Criterion 2 as a byte assertion, not a hope

Render the same plugin twice through the standalone install path -- once with a
gate-tripping workflow script present, once without -- and assert the **first**
`ctx.ui.notify` call's message argument and severity argument are byte-identical
between the two runs. The gate line then appears only in the **second**
`ctx.ui.notify` call (the `notifyDiagnostic` block). This is exactly the shape
`tests/orchestrators/plugin/install.test.ts` already uses for the
engine-present/engine-absent envelope-byte comparison, so the fixture pattern
exists.

## Security Domain

`security_enforcement` is not set to `false` in `.planning/config.json`, so this
section is required.

### Applicable ASVS categories

| ASVS Category | Applies | Standard control |
|---|---|---|
| V2 Authentication | no | no auth surface in this phase |
| V3 Session Management | no | none |
| V4 Access Control | no | none |
| V5 Input Validation | **yes** | the gate reader consumes **untrusted third-party JavaScript ASTs**. Every string that reaches a message must pass `forMessage()` (`workflow-script.ts:771-776`), which escapes `\p{Cc}` and `\p{Cf}`. |
| V6 Cryptography | no | none |
| V12 File Handling | **yes** (indirectly) | unchanged: `assertPathInside` and the two symlink layers are untouched by this phase. |
| V14 Configuration | no | none |

### Known threat patterns for this stack

| Pattern | STRIDE | Standard mitigation |
|---|---|---|
| A gate reason quoting attacker-controlled text (a `meta` key name, a node type derived from source, a file name) into a one-line notification | Spoofing / Tampering (forged output lines via newline; visual reversal via U+202E) | **Every interpolation goes through `forMessage()`.** This is the single most important security constraint of the phase: the new reasons interpolate *more* plugin-controlled text than the existing ones do if a key name or declared identifier is quoted back. Prefer reasons that name the GATE and not the offending token. |
| Evaluating a script to decide a gate | Elevation of privilege | **Forbidden and unnecessary.** The module header's security claim is absolute: "It parses; it never evaluates. There is no evaluator call, no function constructor, no vm module, and no dynamic module load anywhere in it." Every measured gate is decidable from node shape. Any task that reaches for `eval`, `Function`, `vm`, or a dynamic `import()` is wrong by construction. |
| A gate reading that refuses a script | Denial of service (against the plugin author) | WGATE-03: the reading is advisory only. Pinned by the criterion-2 byte assertion and the "exactly one line" refusal-path pins. |
| A gate warning disclosing the user's home path | Information disclosure | NFR-9: `redactAbsolutePaths` at every render site (`info.ts:790`, `shared.ts:1450`). The bridge deliberately embeds the absolute directory; only the surfaces reduce it. A new render site must reduce too. |
| Unbounded gate text from a pathological script | Denial of service (output flooding) | First-failure-wins caps the output at one gate line per script. Do not emit a list of every failing gate. |

## Assumptions Log

| # | Claim | Section | Risk if wrong |
|---|---|---|---|
| A1 | The overlap between a new check-8/9 gate line and the existing `unrunnableWarning` should be resolved by enriching the existing line rather than adding a second. | Interaction with the existing stem-fallback warning | Cosmetic. Two lines per file is noisier but not incorrect; the planner may choose either as long as the rule is stated and pinned. |
| A2 | The BACKLOG pruned footer should name **both** `workflows-detection` and `workflows-replay`. | The BACKLOG pruned-footer convention | Low. Naming only `workflows-replay` matches WFLW-01's own closing sentence; naming only the family label `workflows` matches the ROADMAP. Operator's call; one line. |
| A3 | Reclassifying `reinstall.ts:1062` alongside `install.ts:1229` is in scope. | The warning channel, end to end | Medium. `reinstall` is not named in the phase goal, and the CONTEXT's "Out of scope" list does not exclude it either. Leaving it means `reinstall` keeps dropping the warnings standalone while `install` and `update` show them -- a three-way split instead of a two-way one. Recommend including it; confirm with the operator. |
| A4 | No new `catalog-state` block is required in `docs/output-catalog.md`. | What criterion 2 forbids | Low. Adding one is recommended for the `info` gate-warning `note:` line but is not forced by any gate; the existing state's fixture is hand-written and unaffected. |
| A5 | The gate reader can live inside `domain/workflow-script.ts` rather than a new module. | Wave 0 gaps | Low, but it changes the file list: a new module triggers `test:corresponding` and needs a paired test file in the same commit. `workflow-script.ts` is 816 lines and already carries five distinct responsibilities; a separate module may read better and costs one extra test file. |

## Open Questions

1. **Does the `neither` column have exactly one member?**
   - What we know: measured, check 7 is the only unreachable gate, and every
     other unreplicated gate is structurally decidable. Checks 6-`ObjectPattern`
     and 9-`meta-must-be-object` and 9-`name-non-empty` are *pre-empted by an
     existing skip or refusal* rather than undetectable.
   - What's unclear: whether the doc's column should distinguish "unreachable"
     (check 7) from "already covered by an existing skip or refusal" (three
     sub-arms), or fold both into `neither` with a per-row note.
   - Recommendation: one column value per ROW (there are nine rows), `neither`
     for check 7, `warn` for 3-6 and 8-9, and a per-row Notes cell recording the
     pre-empted sub-arms. The column then stays a clean three-valued set and the
     nuance rides the existing Notes column.

2. **Where does the `info` surface's ordering put a gate line?**
   - What we know: `info.ts:730` sets `notes: workflows.warnings` in discovery
     order, and the catalog states the `note:` lines render "after every
     component line and after any `dependencies:` line, one line per affected
     script, in the order the scan found them".
   - What's unclear: nothing structurally -- a gate line is just another warning
     in the same array.
   - Recommendation: no special handling. Pin the order in a test so a future
     sort does not silently reorder them.

3. **Should the doc-pin test's `WPIN-01` disclaimer change?**
   - What we know: the nine and the six were re-read against 3.10.1 this session
     and both hold; the test's header explicitly disclaims verifying them.
   - What's unclear: whether recording that re-read in the header is worth the
     churn, given WPIN-01 remains deferred and the next engine release
     invalidates it again.
   - Recommendation: leave the disclaimer. Record the re-read date in the
     compatibility doc's evidence-grade prose instead, where dated claims already
     live.

## Sources

### Primary (HIGH confidence)

- `@quintinshaw/pi-dynamic-workflows@3.10.1` -- fetched this session via
  `npm pack`, read `package/src/workflow.ts:1504-1626` (`parseWorkflowScript`,
  `evaluateLiteral`, `propertyKey`, `validateMeta`) and `package/package.json`.
- `extensions/pi-claude-marketplace/domain/workflow-script.ts` (816 lines, read
  end to end).
- `extensions/pi-claude-marketplace/bridges/workflows/{discover,types,stage}.ts`.
- `extensions/pi-claude-marketplace/orchestrators/plugin/{install,update,reinstall,info,shared}.ts`
  (the warning-channel regions).
- `extensions/pi-claude-marketplace/shared/notify.ts:93,439-449` (`REASONS`,
  `notifyDiagnostic`).
- `tests/architecture/workflows-doc-pins.test.ts` (161 lines, read end to end).
- `tests/architecture/catalog-uat.test.ts` (scope header).
- `docs/workflows-compatibility.md` (243 lines, read end to end).
- `docs/output-catalog.md:1891-1903` (the workflow preview-note state).
- `.planning/BACKLOG.md:891-936, 2544-2552`.
- `.planning/workstreams/workflows/{REQUIREMENTS,ROADMAP,STATE}.md`.
- `.planning/MILESTONES.md:21`.
- `package.json`, `scripts/check-corresponding-tests.mjs`.
- **Executable measurement, this session:** a cross-probe running the packed
  engine's `parseWorkflowScript` beside the repository's `admitWorkflowScript`
  over 35 script shapes, plus an acorn-only reachability probe for check 7 and
  for `meta` redeclaration. Probe files were written under the repo root (acorn
  resolution) and removed after the run.

### Secondary (MEDIUM confidence)

- `.planning/codebase/{STACK,CONVENTIONS,ARCHITECTURE}.md` -- project analysis
  dated 2026-08-18; the gate lists and thresholds quoted from them were
  spot-checked against `package.json` this session, the zone counts were not.

### Tertiary (LOW confidence)

- None. Nothing in this document rests on a web search or on training memory.

## Metadata

**Confidence breakdown:**

- Engine gate enumeration: **HIGH** -- source-read at 3.10.1 this session, and
  cross-checked by running the packed engine.
- Bridge verdict cross-table: **HIGH** -- executed against the real module.
- Check 7 unreachability: **HIGH** -- falsification attempted and observed:
  `export const meta;` gives acorn `Unexpected token (1:17)`.
- Warning-channel trace: **HIGH** -- every hop read in source, four verbs
  compared.
- Doc-pin interaction: **HIGH** -- test read in full; the `seven gates` bar is a
  literal assertion at line 119-123.
- BACKLOG convention: **HIGH** for the convention's shape (one instance, read
  verbatim); **MEDIUM** for which milestone name to cite -- three artifacts
  disagree and it is an operator choice.
- The stem-fallback overlap resolution and the `reinstall` scope question:
  **MEDIUM** -- both are design calls, flagged in the Assumptions Log.

**Research date:** 2026-09-08
**Valid until:** 2026-10-08 for the repository claims; **the engine claims are
valid only for 3.10.1** and must be re-driven against any newer release, per the
document's own pinning rule and `WPIN-01`.
