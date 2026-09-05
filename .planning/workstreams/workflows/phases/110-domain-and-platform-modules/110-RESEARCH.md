# Phase 110: Domain and platform modules - Research

**Researched:** 2026-09-04
**Domain:** TypeScript module port + owner-test authoring against this repo's five-gate chain
**Confidence:** HIGH

## Summary

This phase lands three leaf modules that already exist verbatim on
`features/workflow-port-wip`, plus two additive edits (`domain/name.ts`,
`shared/errors.ts`). The modules are not the work. The work is four things the
port branch does not carry: the owner tests, the removal of one
`setWorkflowHomeDirForTesting` seam, the `acorn` dependency declaration, and a
commit ordering that keeps the tree green at every boundary.

Every load-bearing question was settled by measurement in a throwaway worktree
at `HEAD` with the port checkout applied, not by reading. The results are
unusually favourable: `domain/workflow-script.ts` reaches **100% function, line
and branch direct coverage** from the spike's own owner test plus **one** added
case; `domain/workflow-project-key.ts` reaches 100% from the spike's test
unchanged; the seam-free `platform/workflow-home.ts` reaches 100% from a single
`HOME`-relocating case; and `fallow dead-code` goes green with no
`fallow-ignore` marker, because `production: false` makes the owner tests count
as consumers. No eighth D-116-01a accepted-shortfall is created.

Two findings change the plan rather than confirm it. First, a lone `acorn`
declaration is **red** (`fallow` reports `unused-dependency`), so `acorn`,
`domain/workflow-script.ts` and its owner test are one atomic commit. Second,
`generatedWorkflowName` as ported does **not** satisfy WNAM-06's literal clause:
a `meta.name` carrying an interior space, a `\p{Cf}` format character or a bidi
control produces a name the engine's real `isSafeSavedWorkflowName` rejects.
That was measured against engine 3.10.1, not inferred.

**Primary recommendation:** Four path-scoped checkouts, four green commits, in
the order `workflow-home` → `workflow-project-key` → `name.ts + errors.ts` →
`acorn + workflow-script.ts`. Reuse the spike's two owner tests as the starting
draft rather than writing from scratch, restructure them to the v1.19 rule
(`describe()` per entrypoint, `strictEqual`, no source-reading case), add the
one numeric-`meta`-key case that closes the last branch, and delete
`setWorkflowHomeDirForTesting` outright.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

None recorded as a locked decision list. The CONTEXT is auto-generated and
records the following as settled facts of the phase boundary, which bind the
plan the same way:

- The three leaf modules — `domain/workflow-script.ts`,
  `domain/workflow-project-key.ts`, `platform/workflow-home.ts` — plus
  `generatedWorkflowName` in `domain/name.ts` and the collision error in
  `shared/errors.ts` are in scope.
- **Out of scope:** `bridges/workflows/*`, `persistence/locations.ts`,
  `shared/errors-bridges.ts` (`WorkflowTargetOccupiedError`) and the
  `"workflows"` widening of the `phase` union all belong to Phases 111-112 and
  must NOT be pulled in here — the port branch carries them in the same commit,
  so the checkout must be path-scoped rather than tree-wide.
- **The modules themselves are a port, not a rewrite.** The work of this phase
  is the owner tests and the seam removal.
- Criterion 1's "two error classes in `shared/errors.ts`" reads as **one class +
  one interface** here (`WorkflowNameCollisionError` +
  `WorkflowNameCollision`); `WorkflowTargetOccupiedError` lives in
  `shared/errors-bridges.ts` and belongs to Phase 111.
- **WNAM-06's rewording is already discharged** —
  `workflows-REQUIREMENTS.md:55` carries the 2026-09-04 amendment. No
  requirements edit is owed here.
- Do **not** bump `EXTENSION_VERSION` (A-03).

### Claude's Discretion

> All implementation choices are at Claude's discretion — pure infrastructure
> phase. Use the ROADMAP phase goal, its six success criteria, and the codebase
> conventions to guide decisions.

### Deferred Ideas (OUT OF SCOPE)

- **Phase 111 must invert the no-artifact half** of
  `tests/integration/workflow-kind-inversion.test.ts` — the
  `assert.rejects(stat(<HOME>/.pi/workflows), { code: "ENOENT" })` line becomes
  an assertion that the envelopes ARE written.
- **Phase 111 must bump `EXTENSION_VERSION`** in the same change that lands
  `bridges/workflows/`, to open the `backfill.ts:76` early-return gate.
- Both are Phase 111's, not this phase's, and this phase must not pre-empt
  either. Do **not** bump `EXTENSION_VERSION` here (A-03).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| WNAM-01 | Command name comes from the script's exported `meta.name`, extracted by a static acorn AST walk; never a regex, never by evaluation. | §Q2 maps the AST walk (`findMetaObject` → `metaPropertyKey` → `readMetaString`) and gives the three verbatim decoy sources from Spike 026 that prove the regex alternative wrong. §Security confirms no evaluator, no `vm`, no dynamic import. |
| WNAM-02 | `meta` with no `name` property, or a non-string-literal `name`, falls back to the file stem; the value is never evaluated. | §Q2 maps `MetaRead.no-literal` → `stemFallbackVerdict` → `fileStem`. `fileStem` and `WORKFLOW_SCRIPT_EXTENSIONS` must be imported by the owner test or `fallow` reports them unused (§Q5, measured). |
| WNAM-03 | A script with no `meta` declaration is skipped with a warning, not installed. | §Q2 maps `MetaLookup.no-meta` and the two sibling skip causes. All three `SkippedCause` arms carry distinct reason builders. |
| WNAM-04 | An unparseable script (acorn `SyntaxError`) is refused rather than name-scavenged. | §Q2 maps `parseScript` returning `undefined` → `refused/unparseable`, settled FIRST because acorn's `onComment`/`onToken` arrays are partially filled on a throw. |
| WNAM-05 | Two scripts resolving to one name fail the install with an explicit collision error. | `assertNoWorkflowNameCollisions` + `WorkflowNameCollisionError` (§Q2, §Q7 commit 3). The error carries `collisions` as structured data, which the assertion rule requires be asserted by class and field, not message substring. |
| WNAM-06 | Generated names take `<plugin>:<name>` and pass the engine's `isSafeSavedWorkflowName`, including RN-1 prefix elision. | §Q6b: **measured gap.** The ported `assertSafeSavedWorkflowName` carries only the length-128 and trim clauses; interior whitespace and `\p{Cc}\p{Cf}` pass ours and fail the engine's. Decision needed. |
| WPTH-02 | The deprecated `<cwd>/.pi/workflows/saved/` legacy project path is never written. | §Q1: `platform/workflow-home.ts` is the sole import site of the engine storage root, derives it from `os.homedir()` only, and reads no `cwd` and no environment override. The owner test can pin the negative directly. Verified against the engine's own `WORKFLOW_SAVED_DIR = ".pi/workflows/saved"` legacy constant. |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Static admission of an untrusted workflow script (`admitWorkflowScript`) | `domain/` | — | Pure, network-free, disk-free resolution of a script's fate. `.fallowrc.json` allows `domain → shared, platform` only, which is exactly what the module imports [VERIFIED: .fallowrc.json:104-107, `{ "from": "domain", "allow": ["shared", "platform"] }`]. |
| Engine project-key derivation (`workflowProjectKey`) | `domain/` | — | Pure string/hash function over a path. No disk, no env. Its output is consumed by `persistence/locations.ts` in Phase 111. |
| Engine storage-root discovery (`workflowHomeDir`) | `platform/` | — | A thin wrapper over a host-environment fact (`os.homedir()`), isolating the rest of the tree from the engine's rooting rule. Mirrors the position `getAgentDir` holds in `pi-api.ts`. Imports no Pi package, so the peer-import chokepoint is not engaged. |
| Generated-name construction (`generatedWorkflowName`) | `domain/name.ts` | — | Joins with the same rules the three sibling generators use. Deliberately NOT a shared helper — see `port/README.md` §"The one place the port is not verbatim". |
| Collision reporting (`WorkflowNameCollisionError`) | `shared/errors.ts` | — | Typed error class carrying structured `collisions`, per the house convention that structured data never lives only in the message string. |

**Nothing in this phase belongs to `bridges/`, `persistence/`, `orchestrators/`
or `edge/`.** Every capability above is a leaf. That is why the phase has zero
production consumers and why §Q5 matters.

## Project Constraints (from CLAUDE.md)

Directives extracted from `CLAUDE.md`, `.claude/CLAUDE.md`,
`.planning/codebase/CONVENTIONS.md` and `.claude/rules/typescript-unit-testing.md`
that bind this phase:

| Directive | Source | Bearing on this phase |
|-----------|--------|----------------------|
| Read a file before editing it; trace callers before modifying a function. | `CLAUDE.md` §General | The ported modules must be read, not assumed. |
| Never commit to `main`; work on `features/*`. | `CLAUDE.md` §Git | Current branch is `features/workflow`. |
| Conventional Commits; title 5-72 chars; body lines ≤80; **no GSD milestone/phase mentions**. | `CLAUDE.md` §Git | Commit subjects must not say "Phase 110". |
| Run `pre-commit run --files <changed files>` **before** `git commit`; fix, restage, re-run until clean. Never `--no-verify`. Never amend after a hook failure. | `CLAUDE.md` §Git | `npm-fallow` is `pass_filenames: false` and scans the **whole tree**, so an intermediate state with an unconsumed export fails even if the staged diff is clean. Drives §Q7. |
| No test-only seams. Make dependencies explicit; a `_setXForTest` module-global is forbidden. | `CONVENTIONS.md` §"Dependency injection over test-only seams" | Criterion 4. §Q1. |
| Two independent complexity ceilings: ESLint `sonarjs/cognitive-complexity: 15` **and** `fallow health` `maxCognitive: 15` / `maxCyclomatic: 20` / `maxUnitSize: 60`. Passing one does not imply the other. | `CONVENTIONS.md` §"Function Design" | Both measured green on the ported modules (§Environment). |
| Comments cite durable spec IDs (`D-NN`, `WNAM-NN`, `NFR-N`), never `Phase NN` / `Plan NN` / `Wave N` / `Pitfall N`. | `CONVENTIONS.md` §Comments, `.claude/rules/typescript-comments.md` | The ported module headers already comply. New test comments must too. |
| Imports ordered builtin → external → internal → parent → sibling → index → object → type, blank line between groups, alphabetised. | `CONVENTIONS.md` §"Import Organization" | ESLint enforces; measured green on the port as-is. |
| All exported functions carry explicit return types. | `@typescript-eslint/explicit-module-boundary-types: "error"` | Ported modules comply. |
| Every production `.ts` module has exactly **one** mirrored `.test.ts`; each pair reaches 100% function/line/branch coverage **run alone**; no coverage exceptions. | `.claude/rules/typescript-unit-testing.md` §"Pairing and coverage" | §Q4. Measured feasible for all three modules. |
| `describe()` one level deep, one per exported entrypoint, only when the module has several. Phases marked `// arrange` / `// act` / `// assert`. | same, §"Case structure" | The spike's `workflow-script.test.ts` is flat with none of these. Restructuring is required. |
| Build expected values independently; do not compute test data with production code. | same, §Assertions / §"Test data" | Bears on the relative-path key case (§Q6a). |
| Environment mutation: save the previous value and register restoration with `t.after()` **before** acting. | same, §Patterns/Environment | Sanctions the `HOME` relocation that replaces the seam (§Q1). |
| Assert errors by class and structured fields, never message substring. | same, §Assertions | `WorkflowNameCollisionError.collisions`, and the `RefusedCause` / `SkippedCause` discriminants rather than the human-readable `reason` string. |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `acorn` | `^8.16.0` | Static ES parse of untrusted workflow scripts; supplies the AST, comment ranges and token ranges from one `parse()` call | **The host engine itself declares exactly `acorn: ^8.16.0` as its only runtime dependency** [VERIFIED: npm registry — `npm view @quintinshaw/pi-dynamic-workflows version dependencies` → `version = '3.10.1'`, `dependencies = { acorn: '^8.16.0' }`]. Same parser, same job, same range. |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `node:crypto` `createHash` | builtin | `sha256(resolve(cwd)).hex.slice(0,12)` for the project key | Already used; no new dependency |
| `node:os` `homedir` | builtin | Engine storage-root derivation | Already used elsewhere (`index.ts:1`, `bridges/hooks/event-router.ts:42`) |
| `node:test` / `node:assert/strict` | builtin | Owner tests | House rule: no other runner or assertion library |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `acorn` | A regex over the raw source | Refuted by measurement in Spike 026: the comment decoy and the string decoy both make the regex return a **wrong name silently**, and the double-quoted-key form makes it return none. Real scripts carry long headers — `drafter.workflow.js` declares `meta` at line 26. Not available. |
| `acorn` | `@typescript-eslint/typescript-estree` or `meriyah` | Would diverge from the engine's own parser, and neither is already in the tree. |
| `acorn` + a walker package (`acorn-walk`) | — | Unnecessary: the module walks `ast.body` directly, one level, and gets comments and tokens from the same `parse()` call via `onComment` / `onToken`. Adding a walker would be a second dependency for nothing. |
| Declaring the engine `@quintinshaw/pi-dynamic-workflows` to import its real validators | Vendored copies + a parity test | Explicitly **Out of Scope** in `REQUIREMENTS.md`: "Would couple `npm run check` to a 0.x package with ~50 releases since May 2026 and no exported contract." |

**Installation:**

```bash
npm install --save acorn@^8.16.0
```

**Version verification (run 2026-09-04):**

```text
$ npm view acorn version time.modified repository.url dist-tags
version = '8.18.0'
time.modified = '2026-07-28T06:47:49.439Z'
repository.url = 'git+https://github.com/acornjs/acorn.git'
dist-tags = { latest: '8.18.0' }
```

`^8.16.0` admits 8.18.0. The tree already resolves **acorn 8.16.0** transitively
through `eslint` → `espree` and `@stylistic/eslint-plugin` → `espree` →
`acorn-jsx` [VERIFIED: `npm ls acorn` in this working tree]. Pin the range the
engine pins, not `^8.18.0`: matching the engine is the point.

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| `acorn` | npm | published 2026-07-28 (project dates to 2012) | 254,220,801/wk | `github.com/acornjs/acorn` | **OK** | Approved |

```text
$ gsd-tools query package-legitimacy check --ecosystem npm acorn
[{"name":"acorn","verdict":"OK","signals":{"exists":true,
"publishedAt":"2026-07-28T06:47:49.255Z","weeklyDownloads":254220801,
"repoUrl":"git+https://github.com/acornjs/acorn.git","deprecated":false,
"postinstall":null,"ecosystem":"npm"},"reasons":[]}]
```

`npm view acorn scripts.postinstall` → none (`postinstall: null` above).

**Packages removed due to [SLOP] verdict:** none.
**Packages flagged as suspicious [SUS]:** none.

`acorn` was **not** discovered by web search or from training memory. It was
discovered from the host engine's own published `dependencies` metadata, an
authoritative source for the claim "this is the range the engine pins", and
independently confirmed present in this tree. It therefore earns
`[VERIFIED: npm registry]` and needs **no** `checkpoint:human-verify` task.

### Effect of declaring `acorn` as a runtime dependency

| Question | Answer | Evidence |
|----------|--------|----------|
| `package-lock.json` diff | **2 lines.** One added entry under the root `dependencies`, and `"dev": true` dropped from the already-present `node_modules/acorn` record. | [VERIFIED: measured — ran `npm install --package-lock-only` in a probe worktree; `git diff --stat package-lock.json` → `1 insertion(+), 1 deletion(-)`] |
| `npm pack` | **No change to packed contents.** `package.json` `files` is `["CHANGELOG.md","LICENSE","README.md","extensions/pi-claude-marketplace/**"]` — a dependency declaration adds no file. Consumers now install acorn transitively. | [VERIFIED: package.json `files` array, read this session] |
| `engines` floor | **Unchanged.** `acorn`'s own `engines` is `{"node":">=0.4.0"}`, far below this project's `>=20.19.0`. | [VERIFIED: `node_modules/acorn/package.json` `engines`] |
| Architecture / boundary gates | **None tripped.** `.fallowrc.json` `boundaries.rules` govern zone-to-zone imports only; an external package import is not a zone edge. `fallow dead-code` went fully green with acorn declared and imported. ESLint `import-x/order` places `acorn` in the `external` group, which the port's import block already does. | [VERIFIED: measured — `fallow dead-code --fail-on-issues` → `✓ No issues found`; `eslint extensions tests` exit 0] |
| `@types/acorn` needed? | **No.** acorn ships `dist/acorn.d.ts` via its own `types` field, and `tsc --noEmit` passed with the port's `import type { Comment, Program, Property, SpreadElement, Token } from "acorn"`. | [VERIFIED: measured — `tsc --noEmit` exit 0 in the probe] |

## Architecture Patterns

### System Architecture Diagram

```text
                        ┌───────────────────────────────────────────┐
   untrusted plugin     │  <pluginRoot>/workflows/*.js  (Phase 111)  │
   script text ────────▶│  read by bridges/workflows/discover.ts     │
                        └────────────────────┬──────────────────────┘
                                             │ (pluginName, fileName, source)
                                             ▼
        ┌────────────────────────────────────────────────────────────────┐
        │  domain/workflow-script.ts :: admitWorkflowScript               │
        │                                                                 │
        │  1. assertSafeName(pluginName)   ──throw──▶ defect of the SET   │
        │  2. parseScript(source)  ── undefined ──▶ refused/unparseable   │
        │        one acorn parse() yields  { ast, comments, literalRanges }│
        │  3. findMetaObject(ast)                                          │
        │        ├─ no-meta ─────────────▶ skipped/no-meta                │
        │        └─ meta-not-object-lit ─▶ skipped/meta-not-object-literal│
        │  4. readMetaString(elements,"name")                              │
        │        └─ opaque (spread) ─────▶ skipped/meta-spread            │
        │  5. findDeterminismViolation(source, parsed)                     │
        │        classifySpan(match, comments, literals)                   │
        │        ├─ code    ─▶ refused/determinism-code   (returns FIRST) │
        │        ├─ comment ─▶ refused/determinism-comment                │
        │        ├─ literal ─▶ refused/determinism-string                 │
        │        └─ split   ─▶ refused/determinism-split                  │
        │  6. readMetaString(elements,"description")  (envelope input)     │
        │  7a. no-literal ─▶ stemFallbackVerdict(fileStem(fileName))       │
        │  7b. literal    ─▶ namedVerdict(metaName)                        │
        │        both route through generateOrRefuse ──catch──▶            │
        │                                       refused/unsafe-name        │
        └───────────────────┬─────────────────────────┬───────────────────┘
                            │ WorkflowVerdict[]        │ generatedName
                            ▼                          ▼
   ┌────────────────────────────────────┐   ┌──────────────────────────────┐
   │ assertNoWorkflowNameCollisions      │   │ domain/name.ts               │
   │   groups admitted by generatedName  │   │  generatedWorkflowName       │
   │   >1 claimant ──throw──▶             │   │   assertSafeName ×4          │
   │   shared/errors.ts                   │   │   elide "<plugin>-"          │
   │     WorkflowNameCollisionError       │   │   join with ":"              │
   │       .collisions: WorkflowNameCollision[]│   assertSafeSavedWorkflowName│
   └────────────────────────────────────┘   └──────────────────────────────┘

   ── independent leaf, no edge to the above ──────────────────────────────
   ┌──────────────────────────────┐        ┌────────────────────────────────┐
   │ platform/workflow-home.ts    │        │ domain/workflow-project-key.ts │
   │   os.homedir() ──▶            │        │   path.resolve(cwd)            │
   │   <home>/.pi/workflows        │        │   ──▶ basename ──▶ sanitize     │
   │   (SOLE import site of the    │        │   ──▶ sha256(resolved)[0:12]    │
   │    engine storage root)       │        │   ──▶ "<slug>-<hash>"           │
   └──────────────┬───────────────┘        └───────────────┬────────────────┘
                  │                                         │
                  └──────────── consumed together by ───────┘
                        persistence/locations.ts  (Phase 111)
                        ~/.pi/workflows/projects/<key>/saved/
```

### Recommended Project Structure

```text
extensions/pi-claude-marketplace/
├── domain/
│   ├── name.ts                    # + generatedWorkflowName, assertSafeSavedWorkflowName
│   ├── workflow-project-key.ts    # NEW
│   └── workflow-script.ts         # NEW (683 lines)
├── platform/
│   └── workflow-home.ts           # NEW (seam removed → ~8 lines of code)
└── shared/
    └── errors.ts                  # + WorkflowNameCollision, WorkflowNameCollisionError

tests/
├── domain/
│   ├── name.test.ts               # EXTEND: describe("generatedWorkflowName")
│   ├── workflow-project-key.test.ts  # NEW — exactly one file
│   └── workflow-script.test.ts    # NEW — exactly one file
├── platform/
│   └── workflow-home.test.ts      # NEW — exactly one file
└── shared/
    └── errors.test.ts             # EXTEND: describe("WorkflowNameCollisionError")
```

### Pattern 1: Owner test relocates a process global with `t.after()` registered before acting

**What:** The replacement for `setWorkflowHomeDirForTesting`. Save the previous
value, register restoration on the test context, *then* mutate.

**When to use:** Every case in `tests/platform/workflow-home.test.ts`, and any
Phase 111 bridge suite that needs a relocated storage root.

```ts
// Source: pattern in tests/index.test.ts:197-227 and
// tests/bridges/hooks/event-router.test.ts:99-120; measured to reach
// 100% direct coverage of the seam-free module.
async function hermeticHome(t: TestContext): Promise<string> {
  const home = await mkdtemp(path.join(tmpdir(), "workflow-home-"));
  const previousHome = process.env.HOME;

  t.after(async () => {
    if (previousHome === undefined) {
      delete process.env.HOME;
    } else {
      process.env.HOME = previousHome;
    }

    await rm(home, { recursive: true, force: true });
  });
  process.env.HOME = home;
  return home;
}
```

### Pattern 2: Measured-literal parity table, never a re-derived expectation

**What:** Every expected project key is a literal transcribed from the engine's
output. None is produced by calling the function under test.

**When to use:** `tests/domain/workflow-project-key.test.ts`. This is what makes
criterion 6's "fails when the hash width is changed" true.

```ts
// Source: features/workflows-spike:tests/domain/workflow-project-key.test.ts,
// re-verified against @quintinshaw/pi-dynamic-workflows@3.10.1 this session.
const KEY_CASES: readonly KeyCase[] = [
  { input: "/home/acolomba/some-project", expected: "some-project-e4c31526a114" },
  // Built with repeat() rather than pasted: a miscounted wall of characters
  // fails as a hash mismatch, which reads exactly like upstream drift.
  { input: "/home/acolomba/" + "a".repeat(47) + "-b", expected: "a".repeat(47) + "--79e41bdb3cef" },
];
```

### Pattern 3: The verdict is a literal-tagged discriminated union

**What:** `WorkflowVerdict` narrows on `outcome`, and each non-admitting arm
carries a `cause` discriminant separate from its human-readable `reason`.

**When to use:** Every assertion in the owner test. Assert `outcome` and
`cause`, not the `reason` substring — the house rule forbids message-substring
discrimination, and `reason` is the only field that changes when wording is
edited.

### Anti-Patterns to Avoid

- **A tree-wide `git checkout features/workflow-port-wip -- extensions/`.**
  Silently reverts Phase 109 with no conflict marker. The port branch predates
  the inversion and carries pre-109 `domain/resolver.ts`,
  `domain/components/plugin.ts`, `shared/notify.ts`, `shared/notify-reasons.ts`
  and `shared/probe-classifiers.ts`.
- **Splitting a large owner test across two files.** Measured: planting
  `tests/domain/workflow-script-decoys.test.ts` makes the gate report
  `unexpected-test: tests/domain/workflow-script-decoys.test.ts` and exit 1.
- **A `fallow-ignore` marker to silence the unused exports.** Unnecessary — the
  owner test *is* the consumer (measured, §Q5). Adding one would be the eleventh
  marker in a tree with a documented policy of nine.
- **Reading the module's own source from inside its owner test.** The spike's
  case at `workflow-script.test.ts:795` (`readFile(REPO_ROOT + module path)`)
  asserts the scan clone carries the vendored literal's flags by reading source
  text. Source scanning moved to `tests/architecture/` in v1.19. Replace it with
  the behavioural sibling already present at line 860 ("two scans in sequence
  both refuse") or relocate it.
- **Reintroducing a `_setXForTest` seam anywhere in the phase.** Criterion 4 is
  absolute, and `CONVENTIONS.md` treats the difficulty as a design signal, not a
  licence.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Extracting `meta.name` from an untrusted script | A regex over the raw text | `acorn.parse` + a one-level `ast.body` walk | Measured in Spike 026: the comment decoy returns `WRONG-from-comment` and the string decoy returns `WRONG-from-string`, both **silently**. The double-quoted key returns nothing. |
| Resolving a non-literal `meta.name` | `eval`, `new Function`, `vm`, dynamic `import()` | Classify by AST node type and deny the name | The script is untrusted third-party code. The module's own header states: "It parses; it never evaluates." |
| Finding comment and string spans in the source | A second hand-written scanner | `onComment` / `onToken` from the same `parse()` call | A second scan can drift from the first; the module's WVAL-01/WVAL-03 design exists precisely to attribute a match from evidence already in hand. |
| Walking the AST | `acorn-walk` or `estree-walker` | Direct iteration over `ast.body` | The walk is one level deep by construction — `meta` must be a top-level declarator. A walker is a dependency for nothing. |
| Deriving the engine's project key | A fresh reading of the algorithm | The transcribed `workflowProjectKey`, pinned by literal expectations | Two orderings are invertible and both pass every simple case (§Q6a). |
| Widening `assertSafeName` for the 128-char cap | Editing the shared validator | The local `assertSafeSavedWorkflowName` wrapper | Skills, commands and agents share `assertSafeName` and none of them wants a 128-character cap. |

**Key insight:** every "don't" here is backed by a measurement in this
workstream's own spike record, not by a general principle. The regex is not
*inelegant*; it was **run** and returned wrong names.

## Runtime State Inventory

Not a rename/refactor/migration phase in the sense this section governs — no
string is being renamed and no stored data is being re-keyed. Recorded
explicitly rather than omitted:

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | **None.** These three modules write nothing. `workflowProjectKey` computes a key; nothing persists it until Phase 111's `persistence/locations.ts`. Verified: no `writeFile`, `mkdir`, `rename` or `atomicWriteJson` anywhere in the three ported modules. | none |
| Live service config | **None.** No external service is configured by this phase. | none |
| OS-registered state | **None.** No command is registered until Phase 111 materializes envelopes and Pi's `/reload` discovers them. | none |
| Secrets/env vars | **One read, no write.** `platform/workflow-home.ts` reads `$HOME` indirectly via `os.homedir()`. It deliberately does **not** read `PI_CODING_AGENT_DIR` — the engine honours no override, so honouring ours would put artifacts where the engine never looks. | none |
| Build artifacts / installed packages | **`node_modules/acorn` moves from a dev-only to a runtime resolution.** No reinstall needed locally (already present at 8.16.0), but `npm ci` in CI will now place it under production deps. `package-lock.json` must be committed in the normalized form npm writes. | commit the lockfile as npm rewrites it |

## Common Pitfalls

### Pitfall 1: A lone `acorn` declaration is red

**What goes wrong:** Landing `package.json` + `package-lock.json` as a
standalone "declare the dependency" commit fails the `npm-fallow` pre-commit
hook.

**Why it happens:** `fallow dead-code` reports `unused-dependency` for a package
listed but never imported. Measured:

```text
● Unused dependencies (1)
  acorn
  Listed in dependencies but never imported
✗ 1 unused dependency (0.54s)
```

**How to avoid:** Land `acorn`, `domain/workflow-script.ts` and
`tests/domain/workflow-script.test.ts` in **one** commit.

**Warning signs:** `npm run fallow` exits 1 with a Dependencies section.

### Pitfall 2: An export the owner test does not import is dead code

**What goes wrong:** `fallow dead-code` fails on
`WORKFLOW_SCRIPT_EXTENSIONS`, `fileStem` and the type `AdmittedWorkflow` even
after the owner test exists, if the test does not import them.

**Why it happens:** `.fallowrc.json` sets `"production": false`, so the test
tree counts as consumers — but only for symbols a test actually imports.
Measured with the spike's owner test in place:

```text
● Unused exports (2)
  extensions/pi-claude-marketplace/domain/workflow-script.ts (2)
    :293 WORKFLOW_SCRIPT_EXTENSIONS
    :314 fileStem
● Unused type exports (1)
  extensions/pi-claude-marketplace/domain/workflow-script.ts
    :82 AdmittedWorkflow
✗ 2 exports · 1 type
```

**How to avoid:** The owner test imports **every** export by name, including
type-only ones. `AdmittedWorkflow` and `WORKFLOW_SCRIPT_EXTENSIONS` do gain
Phase 111 consumers (`bridges/workflows/stage.ts:74,99,142` and
`bridges/workflows/discover.ts:81` on the port branch), so exporting them is
correct; `fileStem` has no consumer even after Phase 111 and is justified by its
own docblock as the `info`-surface stem rule.

**Warning signs:** an "Unused Code" section naming a symbol you just added.

### Pitfall 3: A hard-coded key for the relative-path case is machine-specific

**What goes wrong:** `workflowProjectKey("relative/path")` hashes
`resolve(cwd, "relative/path")`, so a literal expectation passes only on the
machine that recorded it.

**Why it happens:** `resolve()` runs before `basename()`, and the hash covers
the **resolved** path.

**Evidence:** The Spike 025 record says `relative/path` → `path-c02fff3b6ab2`.
Running the identical engine function from a different working directory this
session produced `path-79046eb377f9`. Same code, same engine, different answer.

**How to avoid:** Either the spike's split pin (a `/^path-[0-9a-f]{12}$/` shape
assertion plus an equivalence to the resolved spelling), or `process.chdir("/")`
with restoration on `t.after()`, which makes a literal deterministic. See §Q6a
for the tradeoff — the equivalence form computes its expectation with production
code, which the current unit-testing rule discourages.

### Pitfall 4: Inverting the dash-strip and the 48-char slice passes every simple case

**What goes wrong:** A reimplementation that truncates before stripping dashes
agrees with the engine on every name shorter than 48 characters and diverges
only on a >48-character name whose 48th character is a dash.

**Why it happens:** The engine's `sanitizePathSegment` chains
`.replace(/^-+|-+$/g,"").slice(0,48)` in that order, so truncation can
**reintroduce** a trailing dash the strip already removed.

**How to avoid:** Keep the `"a".repeat(47) + "-b"` case, whose expected key is
`"a".repeat(47) + "--79e41bdb3cef"` — the doubled dash is the whole signal.

**Warning signs:** every project-key row green except that one.

### Pitfall 5: The `describe()` rule the spike's owner test does not follow

**What goes wrong:** The reviewer skill flags the ported test file.

**Why it happens:** `features/workflows-spike:tests/domain/workflow-script.test.ts`
is 1089 lines of flat top-level `test()` and `for`-loop rows with no
`describe()`, no `// arrange` / `// act` / `// assert` phase markers, and
`assert.equal` where the rule wants `assert.strictEqual` /
`assert.deepStrictEqual`. It predates the v1.19 refactor that wrote the current
rule.

**How to avoid:** Treat it as a **draft with a proven case set**, not as
finished work. The case coverage is the valuable part; the structure needs
rewriting to `describe("admitWorkflowScript")` /
`describe("assertNoWorkflowNameCollisions")` / `describe("fileStem")`.

**Warning signs:** ESLint stays green (measured exit 0) — this pitfall is
invisible to the toolchain and only a review catches it.

### Pitfall 6: SonarCloud duplication on `domain/name.ts`

**What goes wrong:** the PR quality gate raises a duplication finding on
`generatedWorkflowName`.

**Why it happens:** `generatedWorkflowName` deliberately mirrors
`generatedSkillName` / `generatedAgentName` (see `port/README.md`). Measured:
`fallow dupes` reports a new clone family in `domain/name.ts` — "2 groups, 70
lines" — that is absent on `HEAD`, taking the tree from 840 to 928 duplicated
lines. `fallow dupes --fail-on-issues` exits **0** in both states, so the local
gate does not fail. But `sonar-project.properties:49`'s
`sonar.cpd.exclusions` does **not** list `domain/name.ts`.

**How to avoid:** Expect it at `/babysit-pr` time. The remedy is an addition to
`sonar.cpd.exclusions` with the `port/README.md` rationale, not a refactor into
a shared helper — which WNAM-06's amendment explicitly declines.

**Warning signs:** a Sonar "Duplicated Lines" condition on the PR.

## Code Examples

### The one case that closes the last branch of `workflow-script.ts`

```ts
// A numeric property key is neither an Identifier nor a string Literal, so
// metaPropertyKey falls through to its `return undefined`. Without this the
// pair sits at 106/107 branches and 681/683 lines.
test("reads past a numeric meta key that no static key name can match", () => {
  // arrange
  const source = `export const meta = { 1: "x", name: "ship" };\n`;

  // act
  const verdict = admitWorkflowScript("acme", "ship.js", source);

  // assert
  assert.strictEqual(verdict.outcome, "named");
});
```

### The three decoys criterion 5 names, verbatim from Spike 026

```ts
// Source: .planning/spikes/026-meta-name-extraction/extract.mjs:53-64
// comment decoy — the regex returns "WRONG-from-comment"
`// Usage: set meta = { name: 'WRONG-from-comment' } at the top.
export const meta = { name: 'right-from-ast', description: 'x' };
return 1;`

// string decoy — the regex returns "WRONG-from-string"
`const help = "name: 'WRONG-from-string'";
export const meta = { name: 'right-again', description: 'x' };
return help;`

// double-quoted key — the regex returns nothing
`export const meta = { "name": "quoted-key", description: 'x' };
return 1;`
```

All three carry a top-level `return`, which is why the module's `parseScript`
sets `allowReturnOutsideFunction: true`.

### The seam-free `platform/workflow-home.ts`

```ts
// Measured: 1/1 functions, 2/2 branches, 8/8 lines from one HOME-relocating
// case. The module keeps its WPTH-04 header explaining why it reads no
// environment override of its own; only the setter and the sentence defending
// it are removed.
import os from "node:os";
import path from "node:path";

/** `<homedir>/.pi/workflows` -- the host engine's storage root. */
export function workflowHomeDir(): string {
  return path.join(os.homedir(), ".pi", "workflows");
}
```

### The engine's own rooting rule, for the header's citation

```js
// @quintinshaw/pi-dynamic-workflows@3.10.1 dist/workflow-paths.js:12-15
export const WORKFLOW_HOME_RELATIVE_DIR = ".pi/workflows";
export function workflowHomeDir() {
    return join(homedir(), WORKFLOW_HOME_RELATIVE_DIR);
}
```

## Research Questions

### Q1 — The seam removal (criterion 4)

**Answer: delete `setWorkflowHomeDirForTesting` outright. `HOME` relocation
works, and the header's concurrency argument does not describe a real risk on
this runner.**

The seam as ported:

```ts
// features/workflow-port-wip:extensions/pi-claude-marketplace/platform/workflow-home.ts:21-31
let override: string | undefined;

/** `<homedir>/.pi/workflows` unless a test has relocated it. */
export function workflowHomeDir(): string {
  return override ?? path.join(os.homedir(), ".pi", "workflows");
}

/** Test-only relocation seam. Pass `undefined` to restore the real root. */
export function setWorkflowHomeDirForTesting(dir: string | undefined): void {
  override = dir;
}
```

The header defends it on concurrency grounds:

> A test relocates storage by calling the setter rather than by mutating
> process-global environment state that concurrently-running suites also read.

**Falsification probe, run this session on `node v26.8.1`.** Two files; the
first has two top-level cases, each setting `HOME` to its own value and then
awaiting 200 ms before asserting. If top-level cases in a file ran concurrently,
the first case's assertion would read the second's value and fail:

```text
$ node --test a.test.mjs b.test.mjs
A1 pid 1514092 homedir /tmp/HOME-A1
✔ pid + homedir A1 (202.911857ms)
A2 pid 1514092 homedir /tmp/HOME-A2
✔ pid + homedir A2 (202.205693ms)
B pid 1514093 homedir /tmp/HOME-B
✔ B (302.80726ms)
ℹ pass 3   ℹ fail 0
```

Three facts follow, each directly observed:

1. **Test files are separate OS processes.** `a.test.mjs` ran in pid 1514092,
   `b.test.mjs` in pid 1514093. `$HOME` mutated in one file is invisible to
   every other file. `--test-concurrency` (and this repo's `TEST_CONCURRENCY`
   env var) governs how many **files** run at once, not intra-file scheduling.
2. **Top-level cases within one file run sequentially by default.** A1
   completed before A2 began, despite a 200 ms await inside each. Both
   assertions held.
3. **`os.homedir()` re-reads `$HOME` on every call and does not cache.** A1 and
   A2 got different answers from one process.

Intra-file concurrency is opt-in and this repo only ever opts **out** — the only
`concurrency` option anywhere in `tests/` is `{ concurrency: false }`, 20+ times
in `tests/bridges/hooks/async-rewake/registry.test.ts`. There is no
`{ concurrency: true }` in the tree.

**The repo already does exactly this, in unit tests, not just integration
tests.** `tests/index.test.ts:197-227` saves `HOME`, `PI_CODING_AGENT_DIR`,
`PATH` and the session-env keys, registers restoration with `t.after()`, sets
`process.env.HOME`, and even calls `process.chdir()`.
`tests/bridges/hooks/event-router.test.ts:99-120` does the same for `HOME` and
`PI_CODING_AGENT_DIR`. And the unit-testing rule sanctions it in terms:

> **Environment.** … When `process.env` or a global must change, save the
> previous value and register restoration with `t.after()` before acting.

**Measured result of the deletion.** With the setter removed and one
`HOME`-relocating case:

```text
ℹ    workflow-home.ts      | 100.00 |   100.00 |  100.00 |
extensions/pi-claude-marketplace/platform/workflow-home.ts FN 1/1 BR 2/2 LN 8/8
```

**Cost to Phase 111.** The spike's `tests/helpers/workflow-home.ts` exported two
helpers built on the seam. `tests/helpers/` no longer exists, so both are
already unported. The one substantive loss is the spike's deliberate split:
`withRelocatedWorkflowHome` relocated the storage root **without** touching
`HOME`, so a bridge case could assert `<tmp>/.pi/workflows` stays absent while
storage sat at `<tmp>/workflow-home`. Under `HOME`-only relocation those two
paths coincide. Phase 111 recovers the same isolation by giving the project cwd
a **second** temp directory distinct from the temp `HOME` — which is what
`tests/integration/workflow-kind-inversion.test.ts` already does today
(`hermeticHome` + a separate `cwd`). Record this in the phase summary so Phase
111 does not rediscover it.

**If deletion were unsafe** (it is not): the alternative satisfying criterion 4
is an explicit `homeDir: string` parameter on `workflowHomeDir`. Cost: every
Phase 111 call site in `persistence/locations.ts` and `bridges/workflows/*`
would have to thread a home directory it does not otherwise need, and
`locationsFor` would grow a parameter for a root that is deliberately *not*
scope-derived. That is a worse contract for a hazard that does not exist here.

### Q2 — `domain/workflow-script.ts` owner-test surface

**Exported units (4 runtime, 8 type):**

| Export | Kind | Reached by owner test how |
|--------|------|---------------------------|
| `admitWorkflowScript(pluginName, fileName, source)` | function | direct; the module's whole decision tree hangs off it |
| `assertNoWorkflowNameCollisions(verdicts)` | function | direct |
| `WORKFLOW_SCRIPT_EXTENSIONS` | `readonly [".js",".mjs",".cjs"]` | direct — **must be imported by name or `fallow` fails** |
| `fileStem(fileName)` | function | direct — same |
| `NamedWorkflow`, `StemFallbackWorkflow`, `SkippedWorkflow`, `RefusedWorkflow`, `WorkflowVerdict`, `SkippedCause`, `RefusedCause` | types | reachable through `WorkflowVerdict`; the spike test imports `RefusedCause`, `SkippedCause`, `WorkflowVerdict` |
| `AdmittedWorkflow` | type | **not** imported by the spike test → reported unused. Import it. |

**Internal units the spike reached through a seam: none.** `git grep` over
`features/workflow-port-wip -- extensions/` finds exactly one test-only export
in the whole five-file set, and it is `setWorkflowHomeDirForTesting`. There is
no `__test_*` re-export in `workflow-script.ts` or `workflow-project-key.ts`.
Criterion 4 has exactly one target, and it is in `platform/`.

**Every internal unit is reachable from `admitWorkflowScript` /
`assertNoWorkflowNameCollisions` alone** — proven, not argued: the spike's owner
test reaches **32 of 32 functions** with no seam.

**Criterion 5 mapping.** "Survives the comment decoy, the string decoy and the
double-quoted key":

| Decoy | Code path | Input that proves it |
|-------|-----------|----------------------|
| comment | `findMetaObject` walks the **AST**, never the text; the comment never enters `ast.body` | Spike 026 case 3 above → expect `outcome: "named"`, `metaName: "right-from-ast"` |
| string | same — a string literal is an initializer of an unrelated declarator | Spike 026 case 4 → `metaName: "right-again"` |
| double-quoted key | `metaPropertyKey` accepts `p.key.type === "Literal" && typeof p.key.value === "string"` | Spike 026 case 5 → `metaName: "quoted-key"` |

"Reports its four non-admission verdicts distinctly" — the four verdicts that
yield **no** name from `meta`:

| # | Verdict | `outcome` / `cause` | Code path | Proving input |
|---|---------|---------------------|-----------|---------------|
| 1 | no `meta` declarator | `skipped` / `no-meta` | `findMetaObject` falls off `ast.body` | `return 42;` |
| 2 | `meta` not an object literal | `skipped` / `meta-not-object-literal` | `d.init?.type !== "ObjectExpression"` | `export const meta = makeMeta();` and `let meta;` (the `?.` arm) |
| 3 | `meta` carries a spread | `skipped` / `meta-spread` | `readMetaString` sets `{kind:"opaque"}` on `SpreadElement` | `export const meta = { name: "a", ...extra };` |
| 4 | unparseable | `refused` / `unparseable` | `parseScript` returns `undefined`, settled **first** | `export const meta = { name: 'oops'` |

Each of the three `SkippedCause` arms has its own reason builder in the
`SKIPPED_REASONS` record, so "distinctly" is structural, not stylistic. Assert
`cause`, not `reason`.

The two **admitting** fallbacks are separate and must also be covered:
`meta` with no `name` key, and `meta.name` that is not a string literal — both
→ `stem-fallback`, via `fileStem`.

The six `RefusedCause` arms all need coverage for the 100% branch target:
`unparseable`, `determinism-code`, `determinism-comment`, `determinism-string`,
`determinism-split`, `unsafe-name`.

**One owner test file, not two.** `scripts/check-corresponding-tests.mjs`
requires a bidirectional 1:1 map: every `tests/<rel>.test.ts` outside
`{architecture, e2e, integration}` must have a matching
`extensions/pi-claude-marketplace/<rel>.ts`, else `unexpected-test`. Measured by
planting the file:

```text
$ node scripts/check-corresponding-tests.mjs
unexpected-test: tests/domain/workflow-script-decoys.test.ts
Corresponding-test gate failed with 1 violation(s).
```

The only exemption is the `tests/(domain|platform)/<name>-fake.test.ts`
structural supplement, which additionally requires `<name>-fake.ts` **and**
`<name>-contract.ts` to exist and be imported. That shape is for a
contract-plus-fake pair, not for splitting a big suite. A 1000+-line owner test
is the correct shape here; the tree already has
`tests/shared/errors.test.ts` at 1523 lines.

### Q3 — `acorn` at `^8.16.0`

Answered in full under **§Standard Stack** and **§Package Legitimacy Audit**.
Summary of the four sub-questions:

- **Does the engine pin that range?** Yes. `@quintinshaw/pi-dynamic-workflows@3.10.1`
  declares `dependencies = { acorn: '^8.16.0' }` and nothing else
  [VERIFIED: npm registry].
- **`dependencies` or `devDependencies`?** `dependencies`. The import is in
  shipped code (`extensions/pi-claude-marketplace/domain/workflow-script.ts`),
  and `files` ships `extensions/pi-claude-marketplace/**`. A devDependency would
  make the published package unloadable.
- **`npm pack`?** Unchanged contents; consumers gain one transitive install.
- **`engines` floor?** Unchanged (`acorn` requires `node >=0.4.0`).
- **`package-lock.json`?** Two lines (measured).
- **Any architecture/boundary gate?** None. `fallow` boundaries are zone-to-zone
  only; measured fully green with acorn declared and imported.

### Q4 — The corresponding-test and direct-coverage gates

**`scripts/check-corresponding-tests.mjs`** (in `npm run check`, and its
negative control too). For a NEW production module it demands:

1. `tests/<rel>.test.ts` **exists** at the mirrored path, else
   `missing-test`.
2. That test file **imports the module by a relative specifier** — the check
   parses the test's import/export declarations with the TypeScript AST and
   requires the resolved path to equal the source path. Reaching the module only
   through a barrel or another module yields the distinct verdict
   `proxy-owned`; reaching it not at all yields `wrong-import`. **Both are
   violations.** So: the owner test must import the module directly, not via a
   re-export.
3. No **extra** test file may exist whose mirrored source path does not exist
   (`unexpected-test`).
4. `tests/{architecture,e2e,integration}` are exempt from the mirror rule in
   both directions, so an integration test cannot stand in for a missing owner
   test.

Nothing in this gate cares whether the module has production consumers.

**`scripts/test-coverage-direct.mjs`** — **not** in `npm run check` and **not**
in CI. `npm run check` runs only `test:coverage:direct:negative` (the gate's own
planting control). Confirmed by grep across `package.json`,
`.pre-commit-config.yaml` and `.github/workflows/`. The gate itself is a
developer/reviewer command, mandated by `.claude/rules/typescript-unit-testing.md`
and by the `typescript-unit-testing-review` skill ("A red command, or a review
that never ran them, is itself a finding").

What it demands of a NEW module:

1. `runPair` spawns `node --test --experimental-test-coverage <testPath>` for
   the **owner test alone** and writes LCOV.
2. `assertCompleteCoverage` selects the LCOV record whose `SF` resolves to the
   source path, and throws unless `hit === found` for **branches, functions and
   lines**. There is no partial credit and no allow-list — D-117-20 explicitly
   bars a ledger-keyed verdict.
3. A module whose transpiled output is nothing but empty exports takes the
   `type-only` escape. None of these three modules qualifies.
4. Zero production consumers is **irrelevant** here — the measurement is of the
   module under its own test, in isolation.
5. `--all` additionally round-trips every pair and asserts no repeated source or
   test path.

**Consequence for the plan:** a new module that cannot reach 100% becomes an
eighth D-116-01a accepted shortfall, which needs an operator decision and makes
`test:coverage:direct:all` stop one entry earlier. **All three modules were
measured to reach 100%**, so this phase creates no such debt — see §Validation
Architecture.

### Q5 — `fallow dead-code` on unreachable exports

**Answer: the owner tests are the consumers. No `fallow-ignore` marker is
needed or warranted.**

`.fallowrc.json` sets `"production": false` and
`"entry": ["extensions/pi-claude-marketplace/index.ts"]`, and the run detects
~500 entry points (plugin entries + package.json entries + the manual one) —
the test tree is in the graph.

Measured, three states, same probe tree:

**(a) modules present, no owner tests, acorn undeclared → 9 issues:**

```text
● Unused exports (7)
  extensions/pi-claude-marketplace/domain/workflow-script.ts (4)
    :124 admitWorkflowScript      :190 assertNoWorkflowNameCollisions
    :293 WORKFLOW_SCRIPT_EXTENSIONS   :314 fileStem
  extensions/pi-claude-marketplace/platform/workflow-home.ts (2)
    :25 workflowHomeDir           :30 setWorkflowHomeDirForTesting
  extensions/pi-claude-marketplace/domain/workflow-project-key.ts
    :65 workflowProjectKey
● Unused type exports (1)
  extensions/pi-claude-marketplace/domain/workflow-script.ts :82 AdmittedWorkflow
● Unlisted dependencies (1)   acorn
✗ 7 exports · 1 type · 1 unlisted dependency
```

**(b) owner tests importing every export, acorn declared → clean:**

```text
✓ No issues found (0.36s)
```

**(c) owner tests present but not importing three symbols → still red:**

```text
● Unused exports (2)  … :293 WORKFLOW_SCRIPT_EXTENSIONS  :314 fileStem
● Unused type exports (1)  … :82 AdmittedWorkflow
✗ 2 exports · 1 type
```

**Sanctioned remedy:** import the symbol from its owner test. The repo's nine
`fallow-ignore` markers are reserved for compile-time proof types and the two
standalone live-UAT drivers, and the documented policy never applies them to
complexity or duplication. Adding markers here would be the wrong instrument for
a state the owner tests already resolve.

Also measured on the full port + tests + acorn state:

- `fallow health --fail-on-issues` → `✗ 0 above threshold · 11093 analyzed ·
  maintainability 92.3 (good)`, exit 0. Neither complexity ceiling is breached
  by the 683-line `workflow-script.ts`.
- `fallow dupes --fail-on-issues` → exit 0, but a **new** clone family appears
  in `domain/name.ts` (840 → 928 duplicated lines tree-wide). See Pitfall 6.

### Q6a — Project-key parity test shape (criterion 6)

**The engine is installable here and was installed.** Network is available;
`npm install @quintinshaw/pi-dynamic-workflows@3.10.1` succeeded in a scratch
prefix. The engine's derivation is **unchanged** from the 3.5.1 the spike
measured:

```js
// @quintinshaw/pi-dynamic-workflows@3.10.1 dist/workflow-paths.js:20-45
export function workflowProjectKey(cwd) {
    const projectPath = resolve(cwd);
    const slug = sanitizePathSegment(basename(projectPath) || "project");
    const hash = createHash("sha256").update(projectPath).digest("hex").slice(0, 12);
    return `${slug}-${hash}`;
}
function sanitizePathSegment(value) {
    const sanitized = value
        .toLowerCase()
        .replace(/[^a-z0-9._-]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 48);
    return sanitized || "project";
}
```

**Parity re-measured this session, ported TS module vs. the real engine
function, all 14 Spike 025 cases: `mismatches 0`.** The spike's recorded output
is therefore *not* the only oracle — a live one exists and was used.

**The 13 literal rows, re-derived from engine 3.10.1:**

| Input | Expected key | What it discriminates |
|-------|-------------|-----------------------|
| `/home/acolomba/some-project` | `some-project-e4c31526a114` | baseline; hash width |
| `/home/acolomba/UPPER-Case-Name` | `upper-case-name-68af6a471604` | `.toLowerCase()` |
| `/home/acolomba/name with spaces & symbols!` | `name-with-spaces-symbols-0dd0a90eb124` | run-collapse to one dash; trailing-dash strip |
| `/home/acolomba/проект` | `project-cd4339b8af82` | non-ASCII → sanitize fallback |
| `/home/acolomba/日本語プロジェクト` | `project-3cc7d84ca611` | same slug, different hash — proves the hash covers the path not the slug |
| `/home/acolomba/---leading-and-trailing---` | `leading-and-trailing-adab370c9067` | `^-+\|-+$` strip |
| `/home/acolomba/` + `"a".repeat(60)` | `"a".repeat(48) + "-243d40bfeca2"` | the 48-char slice width |
| `/home/acolomba/` + `"a".repeat(47) + "-b"` | `"a".repeat(47) + "--79e41bdb3cef"` | **strip-before-slice ordering** — the only row that catches an inversion |
| `/home/acolomba/.hidden` | `.hidden-c67d01a972fa` | `.` is inside the allowed class; no leading-dot strip |
| `/home/acolomba/dots.in.name` | `dots.in.name-a7042d00116c` | interior dots survive |
| `/` | `project-8a5edab28263` | `basename() \|\| "project"` — the *other* fallback |
| `/home/acolomba/trailing/` | `trailing-0a1fd85765a9` | `resolve()` drops the trailing separator |
| `/home/acolomba/../acolomba/some-project` | `some-project-e4c31526a114` | `..` normalization; identical to row 1 |

**Why literals and not recomputation.** A test that recomputes the expectation
agrees with any implementation including a wrong one. With literals, changing
`.slice(0, 12)` to any other width fails **all thirteen rows at once** — that is
criterion 6 satisfied by construction. Changing `.slice(0, 48)` fails rows 7 and
8. Inverting the strip/slice order fails row 8 only.

**The 14th case is the trap.** `relative/path` hashes `resolve(cwd, ...)`:

```text
Spike 025 record (recorded 2026-08):  relative/path => path-c02fff3b6ab2
This session, different cwd:          relative/path => path-79046eb377f9
```

Two options, both defensible:

1. **The spike's split pin** — `assert.match(key, /^path-[0-9a-f]{12}$/)` plus
   `assert.equal(workflowProjectKey(rel), workflowProjectKey(path.resolve(rel)))`.
   The regex still pins the hash width. The spike's own comment defends this as
   "an equivalence between two spellings rather than a re-derivation of one
   expected value". **Tension:** the current rule says "Build expected values
   independently. Do not … transform the adapter result" and "Do not compute
   test data with production code."
2. **`process.chdir("/")` with `t.after()` restoration**, then assert
   `workflowProjectKey("home/acolomba/some-project") === "some-project-e4c31526a114"`
   — a fully deterministic literal that additionally proves `resolve()` runs
   before `basename()`, because the hashed input is the absolute path. The
   spike's comment refused `chdir` on the belief that "`node --test` runs suites
   concurrently"; **§Q1 measured that belief false for top-level cases in one
   file**, and `tests/index.test.ts:201,213,224` already calls
   `process.chdir()`.

**Recommendation: option 2**, with option 1 as the fallback if the planner
prefers to avoid `chdir` on principle. Either way, keep the normalization pair
(rows 1 and 13) as the explicit collision check the spike also ran.

**Direct coverage:** the spike's `workflow-project-key.test.ts` reaches
`FN 2/2 · BR 5/5 · LN 71/71` unchanged. Both `chdir` and split-pin variants
preserve that.

### Q6b — A measured WNAM-06 gap, and the decision it forces

Not asked, but it falls out of Q6's live-oracle work and it changes what
criterion 1 and WNAM-06 mean.

The engine's real validator:

```js
// @quintinshaw/pi-dynamic-workflows@3.10.1 dist/workflow-saved.js:27-34
export function isSafeSavedWorkflowName(name) {
    return (name.length > 0 &&
        name.length <= 128 &&
        name.trim() === name &&
        !/[\s/\\\0]/u.test(name) &&
        !/[\p{Cc}\p{Cf}]/u.test(name) &&
        name !== "." &&
        name !== "..");
}
```

The port's wrapper claims the remaining four clauses are covered:

> The other four clauses -- the non-empty check, both dot forms, and the
> separator/NUL screening -- are already enforced by `assertSafeName`.

But `assertSafeName` screens only `charCode < 0x20 || charCode === 0x7f` for
controls, and `/` and `\` for separators [VERIFIED:
`extensions/pi-claude-marketplace/domain/name.ts:39-52`]. A plain **space**
(0x20) and every `\p{Cf}` code point are above that floor. Driven against the
real engine function:

```text
"ship"        -> "acme:ship"        engineSafe= true
"acme-ship"   -> "acme:ship"        engineSafe= true
"my name"     -> "acme:my name"     engineSafe= false   <-- interior space
"a b"         -> "acme:a b"         engineSafe= false
"zw<U+200B>sp"-> "acme:zw<U+200B>sp" engineSafe= false  <-- \p{Cf}
"bidi<U+202E>x"->"acme:bidi<U+202E>x" engineSafe= false <-- bidi control
" lead"       -> "acme: lead"       engineSafe= false   <-- leading space in SOURCE
"trail "      -> THROW (trim clause)                     <-- caught
"x"*130       -> THROW (128 clause)                      <-- caught
"a.b"         -> "acme:a.b"         engineSafe= true
```

`" lead"` is the subtle one: the `trim() === name` check runs on the **joined**
name `acme: lead`, which has no leading or trailing whitespace, so the source's
leading space survives.

**Consequence:** WNAM-06 says generated names "pass the engine's
`isSafeSavedWorkflowName`". As ported, some do not. In Phase 111 that becomes an
envelope written to `~/.pi/workflows/saved/acme:my name.json` that the engine
refuses to register — a silent install with no command.

**Two dispositions, planner's choice:**

- **(a) Complete the wrapper.** Add the `/[\s/\\\0]/u` and `/[\p{Cc}\p{Cf}]/u`
  clauses to `assertSafeSavedWorkflowName`. This is **not** a rewrite of a
  ported module — `assertSafeSavedWorkflowName` is new code the port itself
  introduces, and completing it makes us match the engine **exactly**, not
  exceed it (so WGATE-03's "never be stricter than the engine" concern does not
  apply). Cost: ~8 lines plus 4 test cases; the refusal already routes through
  `generateOrRefuse` into a per-file `refused/unsafe-name` verdict, so one bad
  script cannot block its nineteen siblings.
- **(b) Record it as a known deviation** and carry it to Phase 115 (the
  admission-gate hardening milestone, where `WGATE-01` already owns
  "install-time warning naming the refusing gate"). Cost: a workflow whose
  author put a space in `meta.name` installs and never runs, with no signal,
  until 115 ships.

**Recommendation: (a).** It closes WNAM-06's literal clause inside the phase
that owns it, and the change is additive to a function this phase is landing
anyway.

### Q7 — Ordering and commit shape

**The binding facts:**

1. `npm run check` order [VERIFIED: `package.json:76`]:
   `typecheck → lint → fallow → format:check → test:corresponding →
   test:corresponding:negative → test:coverage:direct:negative → test →
   test:integration`. A module without its owner test dies at `fallow` (step 3),
   before `test:corresponding` even runs.
2. The `npm-fallow` pre-commit hook is `pass_filenames: false` with
   `files: '^(\.fallowrc\.json|tsconfig\.json|eslint\.config\.js|(extensions|tests)/.*\.(ts|mjs)|scripts/.*\.mjs|package(-lock)?\.json)$'`
   [VERIFIED: `.pre-commit-config.yaml:116-121`]. It scans the **whole working
   tree**, not the staged diff. `npm-typecheck` and `npm-lint` behave the same
   way. (`STACK.md` says `npm-fallow` is `always_run: true`; it is not — it is
   `files:`-scoped. Either way it fires on every commit in this phase.)
3. Therefore **an untracked-but-present `workflow-script.ts` makes commits 1-3
   red** even though their staged content is fine. The checkout must be sliced,
   not done once up front.
4. `git checkout <branch> -- <paths>` writes **and stages** the paths. Measured:
   `git status --short` shows `M`/`A` in the index column.
5. `domain/name.ts` and `shared/errors.ts` are **purely additive** against
   `HEAD` — `git diff HEAD features/workflow-port-wip -- <path>` produces no
   deletions for either — so taking them whole is safe.
6. CI has **no `push` trigger on `features/**`**; the gate runs on PR to `main`.
   Local `pre-commit` is the only enforcement during the phase, and memory
   records that **no pre-commit hook is installed** in this checkout, so it must
   be run by hand.

**Recommended commit shape — four green commits, four path-scoped checkouts:**

| # | Checkout | Also written | Green because |
|---|----------|--------------|---------------|
| 1 | `platform/workflow-home.ts` | delete `setWorkflowHomeDirForTesting` and the header sentence defending it; write `tests/platform/workflow-home.test.ts` | one export, one consumer; measured 100% coverage |
| 2 | `domain/workflow-project-key.ts` | write `tests/domain/workflow-project-key.test.ts` (13 literals + the relative case) | one export, one consumer; measured 100% coverage |
| 3 | `domain/name.ts` **and** `shared/errors.ts` (both whole) | extend `tests/domain/name.test.ts` with `describe("generatedWorkflowName")`; extend `tests/shared/errors.test.ts` with `describe("WorkflowNameCollisionError")`, importing the `WorkflowNameCollision` **type** as well; apply the Q6b decision here | both new exports consumed by their existing owner tests; both files back to 100% |
| 4 | `domain/workflow-script.ts` | add `acorn: "^8.16.0"` to `dependencies`, run `npm install --package-lock-only`, write `tests/domain/workflow-script.test.ts` importing **all four runtime exports plus `AdmittedWorkflow`** | acorn declared *and* imported in one step; measured 100% coverage |

Commit 3 must precede commit 4: `workflow-script.ts` imports
`generatedWorkflowName` from `./name.ts` and `WorkflowNameCollisionError` /
`errorMessage` / the `WorkflowNameCollision` type from `../shared/errors.ts`.
Commits 1 and 2 are order-free relative to everything.

**Per-commit ritual** (from `CLAUDE.md` §Git):

```bash
git checkout features/workflow-port-wip -- <only this commit's production paths>
# write/edit the owner test(s)
npm run typecheck && npm run lint && npm run fallow && npm run format:check \
  && npm run test:corresponding && npm test
npm run test:coverage:direct -- <the source path>     # the 100% gate
pre-commit run --files <every changed path>            # fix, restage, re-run until clean
git add <explicit paths>                               # never -A, never -u .
git commit -F <message-file>
```

Run `pre-commit run --all-files` once before opening the PR — CI's Lint job
runs `--all-files` and a scoped run hides pre-existing violations.

**Deliberately-red alternative, and why to refuse it.** A single "land the port"
commit followed by a "write the tests" commit is simpler to sequence, but the
first commit cannot pass `pre-commit` (fallow reports 9 issues), and
`CLAUDE.md` forbids committing and recovering afterwards: "a failed pre-commit
hook means the commit did NOT happen, so iterating with `--amend` is wrong". The
four-slice route costs three extra `git checkout` invocations and buys a green
tree at every boundary.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `_setXForTest` / `__test_*` module seams to reach internals | Explicit parameters, extracted leaf modules, `t.mock` from the test context | v1.19 (Phases 108-117, shipped 2026-09-04) | Criterion 4 exists. `features/workflows-spike` is full of seams; `features/workflow-port-wip` carries exactly one into this phase. |
| `tests/helpers/` shared doubles directory | Support lives beside the tests of its concern; each file defines its own hermetic-home helper | v1.19 | `tests/helpers/workflow-home.ts` cannot be ported — the directory is gone. |
| Aggregate coverage across the whole suite | 100% function/line/branch per pair, **measured in isolation** | v1.19, `scripts/test-coverage-direct.mjs` | The owner test must carry the module alone. |
| Flat `test()` files with table-driven rows | `describe()` per exported entrypoint, `// arrange` / `// act` / `// assert` phases | v1.19 rule | The spike's 1089-line owner test needs restructuring, not just relocation. |
| `workflows` in `UNSUPPORTED_COMPONENT_KINDS` | `workflows` in both supported tuples; `componentPaths.workflows` exists | Phase 109, verified 12/12 | This phase's modules compile against the post-inversion resolver. |
| Engine 3.5.1 (spike measurements) | Engine 3.10.1 | re-measured in Spike 027 and again this session | `workflowProjectKey`, `sanitizePathSegment`, `isSafeSavedWorkflowName` and `DETERMINISM_BLOCKLIST` are all **unchanged**. Only the blocklist's line number moved (`dist/workflow.js:35` → `:37`), so the module header's citation is one release stale. |

**Deprecated/outdated:**

- `port/README.md`'s "**WNAM-06 needs rewording**" note: already discharged by
  the 2026-09-04 amendment at `workflows-REQUIREMENTS.md`. No requirements edit
  is owed.
- `STACK.md`'s claim that `npm-fallow` is `always_run: true`: it is `files:`-scoped.
- The spike test's comment "the working directory is process-global and
  `node --test` runs suites concurrently": measured false for top-level cases in
  one file (§Q1).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Node 24 (CI) behaves identically to Node 26.8.1 (local) for the `node:test` process model, `os.homedir()` env re-read, and V8 coverage counting. The probes ran on v26.8.1 only. | Q1, Validation | A `HOME`-relocating owner test that passes locally could fail in CI, or coverage denominators could differ. Mitigation: the v1.19 milestone already reports identical readings on v22.22.2 and v26.8.1 for 204 pairs, which brackets 24. Cheap to confirm by running the three owner tests under a Node 24 in CI. |
| A2 | The spike's `workflow-script.test.ts` case set, restructured to the v1.19 rule, retains 100% coverage. Measured coverage used the file **as written**; a restructure that drops the source-reading case at line 795 changes which cases execute `determinismScanner`. | Q2, Validation | The pair could land at 105/106 branches. Mitigation: re-run `npm run test:coverage:direct -- extensions/pi-claude-marketplace/domain/workflow-script.ts` after the restructure, before committing. |
| A3 | Extending `tests/domain/name.test.ts` and `tests/shared/errors.test.ts` restores both pairs to 100%. Measured only the shortfall the new code creates (`name.ts` 4/6 fns, `errors.ts` 42/44 fns), not the closure. | Validation | An accepted-shortfall would be created in a module that is currently complete. Mitigation: both new units are small and branch-simple. |
| A4 | Option (a) for Q6b (completing `assertSafeSavedWorkflowName`) is within this phase's "do not rewrite the ported modules" boundary, on the reading that the function is new code the port introduces. | Q6b | If the operator reads it as a rewrite, the change must move to Phase 115. It is a discussion item, not a blocker — option (b) is available. |
| A5 | `sonar.cpd.exclusions` will need `domain/name.ts` added at PR time. Measured only that `fallow dupes` reports a new clone family and that the file is absent from the exclusion list; SonarCloud's own duplication detector was not run. | Pitfall 6 | A red PR quality gate at `/babysit-pr` time, resolved by a one-line properties edit. |

## Open Questions

1. **Q6b: complete `assertSafeSavedWorkflowName`, or defer to Phase 115?**
   - What we know: measured, against the real engine 3.10.1 validator, that
     interior whitespace, `\p{Cf}` and bidi controls in `meta.name` produce a
     generated name the engine rejects. WNAM-06 requires the generated name pass
     it.
   - What's unclear: whether the operator reads a 8-line addition to a
     port-introduced function as a permitted completion or as the rewrite the
     ROADMAP forbids.
   - Recommendation: complete it here (option a). Raise it as the phase's one
     confirmation item during planning.

2. **Q6a: `process.chdir` or the split pin for the relative-path key?**
   - What we know: `chdir` is already used in `tests/index.test.ts`, top-level
     cases in a file do not interleave, and `chdir("/")` yields a deterministic
     literal. The split pin computes half its expectation with production code,
     which the rule discourages.
   - What's unclear: whether the operator prefers avoiding `chdir` in a unit
     test on principle.
   - Recommendation: `chdir("/")`, restored on `t.after()`. Note the choice in
     the test's header comment so a later reader does not "fix" it back.

3. **How much of the spike's 1089-line owner test survives the restructure?**
   - What we know: it reaches 32/32 functions and 106/107 branches against the
     ported module, ESLint-clean, but has no `describe()`, no phase markers, and
     one source-reading case.
   - What's unclear: whether the planner treats the restructure as a task of its
     own or folds it into the writing task.
   - Recommendation: one task, explicitly titled as a restructure of an
     inherited draft, with the direct-coverage command as its verification.

4. **Does `admitWorkflowScript` need a source-size cap?**
   - What we know: it hands unbounded third-party text to `acorn.parse`. A
     pathologically deep or huge script could exhaust the stack or the heap at
     install time. No cap exists in the module, and the engine has none either.
   - What's unclear: whether the threat is in scope for a bridge that only ever
     parses files the user already chose to install.
   - Recommendation: out of scope here; record as a Phase 115 candidate
     alongside the other admission-gate work. `[ASSUMED]` that the engine's
     absence of a cap is a deliberate posture rather than an oversight.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | everything | ✓ | v26.8.1 local; CI pins `node-version: "24"` in all five workflows | — |
| `acorn` | `domain/workflow-script.ts` | ✓ (transitive today) | 8.16.0 in `node_modules`; `^8.16.0` admits 8.18.0 | — |
| `fallow` | `npm run fallow` | ✓ | 3.20.0 installed (package.json declares `^3.17.0`); signature verified | — |
| `typescript` | `npm run typecheck` | ✓ | 6.0.3 | — |
| `prettier` / `eslint` | format/lint gates | ✓ | 3.8.3 / 10.8.1 | — |
| `strong-mock` | interaction mocks | ✓ | ^9.2.2 | not needed — these three modules have no injected collaborators |
| npm registry network | acorn install, engine parity oracle | ✓ | `npm view` and `npm install` both succeeded this session | the Spike 025 recorded table |
| `@quintinshaw/pi-dynamic-workflows` | **parity oracle only**, never a declared dependency | ✓ installable | 3.10.1 verified this session in a scratch prefix | Spike 025's recorded 14-row table |
| `pre-commit` | the hook pipeline | ✓ (framework) | hooks are **not installed** in this checkout — must be invoked manually | run `pre-commit run --files …` by hand |

**Missing dependencies with no fallback:** none.

**Missing dependencies with fallback:** none needed. Note the engine must stay
**out** of `package.json` — `REQUIREMENTS.md` lists declaring it as Out of
Scope. Use it as a throwaway scratch-prefix oracle when re-deriving expectations
(`npm install --prefix <scratch>`), exactly as this research did, and never
import it from `extensions/` or `tests/`.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | `node:test` (Node built-in) + `node:assert/strict`; `strong-mock ^9.2.2` for interaction mocks |
| Config file | none — configured entirely through `package.json` scripts |
| Quick run command | `node --test tests/domain/workflow-script.test.ts` |
| Full suite command | `npm test` (then `npm run test:integration`) |
| Pair coverage command | `npm run test:coverage:direct -- extensions/pi-claude-marketplace/domain/workflow-script.ts` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| WNAM-01 | `meta.name` wins over the file stem; comment/string/double-quoted-key decoys do not | unit | `node --test tests/domain/workflow-script.test.ts` | ❌ Wave 0 |
| WNAM-02 | absent or non-literal `name` → stem fallback; `fileStem` drops only `.js`/`.mjs`/`.cjs`, case-insensitively | unit | same | ❌ Wave 0 |
| WNAM-03 | `no-meta`, `meta-not-object-literal`, `meta-spread` each skip with their own cause | unit | same | ❌ Wave 0 |
| WNAM-04 | acorn `SyntaxError` → `refused/unparseable`, settled before any `meta` read | unit | same | ❌ Wave 0 |
| WNAM-05 | two admitted verdicts on one generated name throw `WorkflowNameCollisionError` carrying both file names | unit | same, plus `node --test tests/shared/errors.test.ts` | ❌ Wave 0 (script) / ✏️ extend (errors) |
| WNAM-06 | `<plugin>:<elided>` shape, RN-1 elision, 128-char cap, trim equality — pinned against the same cases `generatedSkillName` uses | unit | `node --test tests/domain/name.test.ts` | ✏️ extend |
| WPTH-02 | the storage root is home-derived and reads no `cwd` and no env override, so the legacy `<cwd>/.pi/workflows/saved/` can never be produced | unit | `node --test tests/platform/workflow-home.test.ts` | ❌ Wave 0 |
| (criterion 6) | project-key parity across the 14 Spike 025 cases, mutation-sensitive to the hash width | unit | `node --test tests/domain/workflow-project-key.test.ts` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `node --test <the owner test>` plus
  `npm run test:coverage:direct -- <the source path>`.
- **Per commit boundary:** `npm run typecheck && npm run lint && npm run fallow
  && npm run format:check && npm run test:corresponding && npm test`, then
  `pre-commit run --files <changed paths>`.
- **Phase gate:** full `npm run check` green, plus `pre-commit run --all-files`
  leaving no file modified, before `/gsd-verify-work`.

### Wave 0 Gaps

- [ ] `tests/platform/workflow-home.test.ts` — covers WPTH-02, criterion 4
- [ ] `tests/domain/workflow-project-key.test.ts` — covers criterion 6
- [ ] `tests/domain/workflow-script.test.ts` — covers WNAM-01..05, criterion 5
- [ ] `tests/domain/name.test.ts` — **extend**, covers WNAM-06
- [ ] `tests/shared/errors.test.ts` — **extend**, covers WNAM-05's error contract
- [ ] Framework install: none — `node:test` is built in

### Measured coverage baselines (probe worktree, HEAD + port checkout)

| Pair | With no new test | With the spike's test | After the one added case |
|------|------------------|----------------------|--------------------------|
| `domain/workflow-script.ts` | — | `FN 32/32 · BR 106/107 · LN 681/683` | **`FN 32/32 · BR 106/106 · LN 683/683`** |
| `domain/workflow-project-key.ts` | — | **`FN 2/2 · BR 5/5 · LN 71/71`** | unchanged |
| `platform/workflow-home.ts` (seam-free) | — | — | **`FN 1/1 · BR 2/2 · LN 8/8`** |
| `domain/name.ts` | `FN 4/6 · BR 33/33 · LN 184/207` | — | must return to complete |
| `shared/errors.ts` | `FN 42/44 · BR 98/99 · LN 637/651` | — | must return to complete |

The single uncovered branch in `workflow-script.ts` before the added case was
`BRDA:592` with `DA:593,0` / `DA:594,0` — the `return undefined` in
`metaPropertyKey`, reachable only by a property key that is neither an
`Identifier` nor a string `Literal`.

**No eighth D-116-01a accepted shortfall is created by this phase.**

## Security Domain

`security_enforcement` is absent from `.planning/config.json`, therefore enabled.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | no principal, no credential in these three modules |
| V3 Session Management | no | no session |
| V4 Access Control | no | no authorization decision |
| V5 Input Validation | **yes** | `assertSafeName` (RN-2) + `assertSafeSavedWorkflowName` on every generated name; `sanitizePathSegment` on the project key; acorn AST classification of `meta.name` with **no** evaluation of a non-literal |
| V6 Cryptography | **partially** | `sha256` is used as a **namespacing device, not a security boundary** — it must match the engine byte-for-byte, so it deliberately takes no salt and no HMAC. The module says so in its header. Do not "harden" it. |
| V12 Files and Resources | **yes (indirectly)** | `workflowProjectKey`'s output is joined under the workflow home in Phase 111 without an async containment check, on the argument that `.`, `..` and every path separator are **unreachable outputs** of the sanitizer. The owner test's `/` and `..` rows are what keep that argument true. |
| V14 Configuration | **yes** | one new runtime dependency; legitimacy audited above |

### Known Threat Patterns for `acorn` + untrusted third-party script text

| Pattern | STRIDE | Standard Mitigation | Status here |
|---------|--------|---------------------|-------------|
| Arbitrary code execution at install time via evaluating a plugin script | Elevation of Privilege | Parse only; never evaluate | **Held.** No `eval`, no `new Function`, no `node:vm`, no dynamic `import()`, no `require()` anywhere in `workflow-script.ts`. A non-literal `meta.name` is *denied a name*, never resolved. Worth a `tests/architecture` grep gate in Phase 111 if one does not already exist. |
| Path traversal via a crafted directory name reaching the storage root | Tampering | Sanitize to a closed character class; prove `.`/`..`/separators unreachable | **Held by construction and by test.** `[^a-z0-9._-]+ → "-"`, then a dash strip, then a 48-char slice, then a non-empty fallback. `/` and `..` rows in the parity table are the standing proof. |
| Prototype pollution through a `__proto__` key in the `meta` literal | Tampering | Never build a runtime object from the parsed properties | **Held.** `readMetaString` iterates AST nodes and returns a tagged union; no object is constructed from attacker-controlled keys. |
| ReDoS on the vendored determinism pattern | Denial of Service | Linear-time pattern, no nested quantifiers | **Held.** `/\bDate\s*\.\s*now\b\|\bMath\s*\.\s*random\b\|\bnew\s+Date\s*\(\s*\)/` has only flat `\s*` runs. The module also explains why the literal carries no `g` flag (a module-level `g` regex retains `lastIndex` between calls and would silently miss an early match on the second invocation) — a correctness bug the spike's test at line 860 pins. |
| Parser resource exhaustion on a huge or deeply nested script | Denial of Service | Size or depth cap before `parse()` | **Not held.** No cap exists. See Open Question 4; the host engine has none either, so matching it is the current posture. |
| Slopsquatted dependency | Tampering | Registry + provenance audit | **Held.** `acorn` verdict `OK`, 254M weekly downloads, no `postinstall`, discovered from the engine's own published metadata. |
| Silent misnaming installing a command the user did not intend | Spoofing | AST extraction, collision hard-error, per-file refusal | **Held**, except the WNAM-06 whitespace/`\p{Cf}` gap in §Q6b, which fails **closed at the engine** (the command never registers) rather than open. |

## Sources

### Primary (HIGH confidence)

- `@quintinshaw/pi-dynamic-workflows@3.10.1` — installed from npm into a scratch
  prefix this session; read `dist/workflow-paths.js` (project key, home dir),
  `dist/workflow-saved.js` (`isSafeSavedWorkflowName`), `dist/config.js`
  (`WORKFLOW_SAVED_DIR`), `dist/workflow.js:37` (`DETERMINISM_BLOCKLIST`)
- npm registry — `npm view @quintinshaw/pi-dynamic-workflows version dependencies`;
  `npm view acorn version time.modified repository.url dist-tags`;
  `npm ls acorn`; `gsd-tools query package-legitimacy check --ecosystem npm acorn`
- Measurement in a throwaway `git worktree` at `HEAD` (`ab9d49de`) with the
  port checkout applied — `fallow dead-code/health/dupes`, `tsc --noEmit`,
  `eslint`, `prettier --check`, `check-corresponding-tests.mjs`,
  `node --test --experimental-test-coverage` LCOV, `npm install --package-lock-only`
- `node --test` process-model probe on `node v26.8.1`
- Repo sources read this session: `package.json`, `.fallowrc.json`,
  `.pre-commit-config.yaml`, `sonar-project.properties`,
  `scripts/check-corresponding-tests.mjs`, `scripts/test-coverage-direct.mjs`,
  `scripts/check-corresponding-tests.negative.mjs`,
  `scripts/test-coverage-direct.negative.mjs`,
  `extensions/pi-claude-marketplace/domain/name.ts`,
  `.claude/rules/typescript-unit-testing.md`,
  `.agents/skills/typescript-unit-testing-review/SKILL.md`
- Port-branch sources read via `git show features/workflow-port-wip:…` and
  spike-branch tests via `git show features/workflows-spike:…`

### Secondary (MEDIUM confidence)

- `.planning/spikes/025-canonical-path-mechanics/README.md` and `keyparity.mjs`
  — the 14-case set and the EXDEV measurement (case set re-verified live; the
  relative-path key was found to be machine-dependent)
- `.planning/spikes/026-meta-name-extraction/README.md` and `extract.mjs` — the
  decoy corpus and the divergence measurement across two real plugins
- `.planning/workstreams/workflows/port/README.md`,
  `milestones/workflows-REQUIREMENTS.md`, `REQUIREMENTS.md`, `STATE.md`,
  `phases/110-domain-and-platform-modules/110-CONTEXT.md`

### Tertiary (LOW confidence)

- `.planning/codebase/STACK.md` — one claim found stale (`npm-fallow`
  `always_run`); treat its hook detail as advisory and prefer
  `.pre-commit-config.yaml`

## Metadata

**Confidence breakdown:**

- Standard stack: **HIGH** — the single dependency and its exact range come from
  the host engine's own published metadata, confirmed on the registry and
  already resolved in this tree.
- Architecture: **HIGH** — the modules exist and were read; every zone edge was
  checked against `.fallowrc.json` and confirmed by a green `fallow` run.
- Gates and ordering: **HIGH** — every gate verdict in this document was
  produced by running the gate, including three deliberately-planted failing
  states.
- Coverage feasibility: **HIGH** — measured to the branch, with the one
  uncovered branch identified by LCOV line number and closed by a named case.
- Pitfalls: **HIGH** for 1-4 and 6 (each measured); **MEDIUM** for 5 (a review
  judgement the toolchain cannot see).
- WNAM-06 gap (§Q6b): **HIGH** on the finding (driven against the real engine
  validator); **MEDIUM** on the recommended disposition, which is a scope call
  for the operator.

**Research date:** 2026-09-04
**Valid until:** 2026-10-04 for the repo-internal facts; **re-check on any
`@quintinshaw/pi-dynamic-workflows` release** for the four vendored engine
values (`workflowProjectKey`, `sanitizePathSegment`, `isSafeSavedWorkflowName`,
`DETERMINISM_BLOCKLIST`) — the package has no exported contract for any of them.
