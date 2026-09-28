# Phase 109: Kind inversion - Research

**Researched:** 2026-09-04
**Domain:** In-repo closed-set inversion — resolver component-kind tuples, the `REASONS` closed set, and the byte-pinned catalog contract
**Confidence:** HIGH (every load-bearing claim below was measured by applying the change and running the real gates; see *Evidence Grades*)

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions

#### The `{workflows}` reason

- **D-109-01:** Retire the `{workflows}` member of the `REASONS` closed set —
  44 members become 43. It is the tail member, so removal leaves every other
  token's catalog index unmoved. The deletion covers the `REASONS` tuple entry
  in `shared/notify.ts`, the `UnsupportedReason` member in
  `shared/notify-reasons.ts`, and both the `UnsupportedReason` member and the
  `kindToReason` arm in `shared/probe-classifiers.ts`.
  — **Reversibility:** costly — re-adding it means a new tail append plus a
  catalog row, a renderer arm and a fixture in the same change, per the
  append-only discipline `compat-01` enforces.

  Rationale recorded so a later reader does not re-litigate it: no phase in
  this milestone produces a plugin-level workflows reason. Phase 111 reports
  refused scripts through `warnings[]`, not reasons, and the two workflow
  tokens the spike branch carries — `stale workflow command` and
  `requires pi-dynamic-workflows` — are separate closed-set members that land
  in Phases 113 and 114. Keeping the member would leave the catalog documenting
  output that no code path can emit, which is the same defect WINV-05 corrects
  in the prose.

- **D-109-02:** Record the removal by appending, not by rewriting.
  `tests/architecture/notify-closed-set-locks.test.ts` gains a new ledger line
  below the existing `WDET-04 / D-106-04: +1 … (43 -> 44)` line, reading as a
  reversal (`WINV-03: -1 for the retired workflows member (44 -> 43)`). The
  WDET-04 line stays. This matches the project comment policy: decision and
  requirement IDs are traceability and are kept; only planning refs are
  stripped.
  — **Reversibility:** reversible — comment text.

- **D-109-03:** Amend `compat-01-no-expansion.test.ts`'s assertion message
  narrowly. It currently reads "no reason token may be added, removed, or
  renamed". The new message keeps additions append-only at the tail and admits
  a removal **only** when a kind moves from unsupported to supported, and only
  when it arrives with its catalog rows in the same change. Do not replace it
  with a general "additions and removals both arrive with their catalog rows"
  rule — that stops naming the append-only tail discipline, which is the
  property the test's order-sensitive `deepEqual` actually enforces.
  — **Reversibility:** reversible — assertion message text; the enumeration
  above it is the real gate.

#### The three catalog states

- **D-109-04:** Turn each of the three `catalog-state` blocks in
  `docs/output-catalog.md` into its post-inversion form rather than deleting
  it, so each fixture goes red against current code and green after.

  1. `workflow-partially-available-inventory` → the clean **not-installed**
     inventory row for a workflow-bearing plugin: no reason brace, no `⊖`.
  2. `workflow-partial-install-success` → the clean **`(installed)`** success
     row: `●`, no brace. This is WINV-02's user-visible inversion, byte-pinned.
  3. `workflow-install-rejection` → has no successor, because nothing rejects a
     workflow-only plugin any more. Repoint it to a plugin carrying `workflows`
     **and** a still-unsupported kind (e.g. `themes`). The rejection still
     renders, and its brace names the other kind — which is what proves
     `workflows` stopped contributing a token.

  `catalog-uat` pairs each annotation with its fixture's `notify()` output
  byte-for-byte and imposes no uniqueness rule across states, so two states
  rendering identical bytes is permitted. Verified by reading the pairing test
  (`tests/architecture/catalog-uat.test.ts`, the `CATALOG_STATE_RE` pairing and
  the "every annotation pairs byte-equal" test) — do not add a uniqueness
  workaround.
  — **Reversibility:** costly — each state is a byte contract paired against a
  fixture; changing one means changing both halves together.

- **D-109-05:** Rename the three `catalog-state` ids to match what the blocks
  now render (e.g. `workflow-installed-inventory`,
  `workflow-install-success`, `workflow-plus-unsupported-rejection`) and retag
  the section headings from `(WDET-04)` to `(WINV-04)`. `catalog-uat` pairs
  purely by id string, so a rename is mechanically free. An id reading
  "partial" above a clean row is the same stale-contract problem WINV-05
  corrects in the prose.
  — **Reversibility:** reversible — id strings, changed in two paired places.

#### The 109-111 window

- **D-109-06:** Accept that between this phase and Phase 111 a workflow-bearing
  plugin resolves `installable`, renders `● (installed)` with no brace, and
  materializes zero workflow commands — which is less honest than today's
  `partially-available {workflows}`. Record the intermediate state explicitly in
  this phase's SUMMARY and VERIFICATION, and cut no release from the branch
  before Phase 111 lands.

  Containment evidence: this is `features/workflow`; `ci.yml` deliberately
  carries no `push` trigger on `features/**`; the milestone runs end to end in
  one session. The window has no external surface.

  Two alternatives were considered and rejected. Splitting the tuples (remove
  from `UNSUPPORTED_COMPONENT_KINDS` now, add to the supported tuples at 111)
  leaves `workflows` in neither closed set — precisely the silently-ignored-kind
  failure the T-02-25 security note on `UNSUPPORTED_COMPONENT_KINDS` warns
  about, so it is strictly worse than the window it avoids. A temporary
  install-time note would need its own closed-set reason and catalog state,
  both retired again in Phase 111, in a phase that has already changed the
  reason set once.
  — **Reversibility:** reversible — an accepted intermediate, closed by Phase
  111 landing.

#### How far the proof reaches

- **D-109-07:** Prove WINV-02 at two levels.

  1. **Resolver owner test** (`tests/domain/resolver.test.ts`): the
     `{ kind: "workflows", relativePath: "workflows", stat: "dir" }` row at
     line 101 leaves the `unsupportedConventionScenarios` table and becomes a
     supported-convention case asserting the `installable` arm and a populated
     `componentPaths.workflows`. Mandatory regardless under the
     corresponding-test rule, since `domain/resolver.ts` is the module changing.
  2. **Install-level window test**: drive a real install of a workflow-bearing
     plugin and assert **both** halves — it succeeds with no `--partial`, and
     no workflow artifact exists on disk. This turns D-109-06's accepted window
     from an undocumented gap into a pinned fact.

  The `--partial`-free success half survives Phase 111 unchanged. The
  no-artifact half is inverted there deliberately; see the Deferred Ideas
  section for the carry-forward.
  — **Reversibility:** reversible — test-side; the second assertion is expected
  to flip in Phase 111.

### Claude's Discretion

- Comment wording throughout, and which file carries which half of the reason
  deletion.
- The fixture plugin name and shape used by the install-level window test, and
  the choice of second unsupported kind for the repointed rejection state
  (`themes` is a suggestion, not a requirement).
- Whether the resolver exports a `SupportedKind` type alongside
  `SUPPORTED_COMPONENT_KINDS`. The spike branch does
  (`resolver.ts:340` on `features/workflows-spike`); main does not. Export it
  only if something in this phase needs it — do not add an unused export, which
  `fallow dead-code` would flag.
- Whether the manifest schema move (`workflows` from
  `UNSUPPORTED_COMPONENT_FIELDS` to `SUPPORTED_COMPONENT_PATH_FIELDS` in
  `domain/components/plugin.ts`) also gets a positive locking test mirroring the
  `HOOK-01: UNSUPPORTED_COMPONENT_KINDS does NOT contain 'hooks'` precedent in
  `tests/architecture/hooks-foundation.test.ts`. The precedent exists and the
  mirror is cheap; take it if it does not duplicate what the resolver owner
  test already proves.
- Rewording the `notify.ts` doc comments at lines 930 and 1778 that name
  workflows as a `--partial` example. They become false and must change; the
  wording is open.

### Deferred Ideas (OUT OF SCOPE)

- **Phase 111 must flip the install-level window assertion.** D-109-07's second
  test asserts *no workflow artifact exists on disk* after installing a
  workflow-bearing plugin. That is true only until `bridges/workflows/` lands.
  Phase 111 has to invert it to assert the envelopes **are** written. Carry this
  into Phase 111's CONTEXT.md so it is not left behind — an assertion that
  quietly stays green while meaning the opposite is worse than no assertion.
- **`docs/workflows-compatibility.md` does not exist yet** and is Phase 114's
  deliverable (WDOC-01..03). Nothing in this phase creates or references it.
- **The soft-dependency marker** (`requires pi-dynamic-workflows`) and the
  `stale workflow command` reason are Phase 114 and Phase 113 closed-set
  additions respectively. They are the reason D-109-01 does not try to
  repurpose the retired token — but they are not this phase's work, and this
  phase must not pre-add them.
- **`WNAM-06` needs rewording** — it requires reuse of a shared colon-name
  helper that does not exist on this branch. Recorded in
  `.planning/workstreams/workflows/port/README.md`; belongs to Phase 110.

</user_constraints>

<phase_requirements>

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| WINV-01 | `workflows` leaves `UNSUPPORTED_COMPONENT_KINDS` and its `UNSUPPORTED_COMPONENT_CONVENTIONS` entry, and joins `SUPPORTED_COMPONENT_KINDS` and `SUPPORTED_COMPONENT_PATH_KINDS`. The convention directory `<pluginRoot>/workflows/` keeps the same name and the same probe; only which tuple reads it changes. | §*The five production edits* names all five sites with line numbers. §*Measured: the probe is literally identical* proves the convention claim by running the resolver before and after. |
| WINV-02 | A plugin that resolved `partially-available {workflows}` before the inversion resolves `installable` after it, and installs its workflow envelopes on a normal install rather than needing `--partial`. This is the user-visible inversion and the one that must not be silent. | §*Measured resolver verdicts* (before/after table). §*Pattern 4: the install-level window test* gives the file, template, and both assertion halves. |
| WINV-03 | The dedicated `workflows` member of the `REASONS` closed set is retired together with its `probe-classifiers` arm, or kept with a stated second meaning. Whichever way it goes, the closed-set counts named in the `notify-reasons.ts` header comment and the byte-pinned catalog states move with it. | §*Complete blast radius of retiring the `{workflows}` reason* — 7 count sites, 4 deletion sites, and the compile-time proof that catches a partial removal. |
| WINV-04 | Every test #154 wrote that locks the unsupported reading is turned rather than deleted; each must assert the new meaning, so the inversion is proved by a red-then-green test and not by an absence. | §*The red-then-green obligation* — measured red set (five test files, not three), exact per-file commands, and the sequencing that makes `catalog-uat` actually go red. |
| WINV-05 | `docs/output-catalog.md` and any `docs/` prose stating that workflow-bearing plugins degrade is corrected in the same phase that changes the behavior. | §*Complete documentation sweep* — every line, classified as becomes-false / stays-true. |

</phase_requirements>

## Summary

This phase is a closed-set inversion with **zero new dependencies, zero new
modules, and zero production-code errors from the change itself**. I applied
the full production-side edit to a scratch working tree, ran `tsc --noEmit`,
`eslint`, `fallow` (all three sub-gates), the unit suite, the integration
suite, and the three corresponding-test gates, then restored the tree. The
measured result: **131 TypeScript errors, all of them in test files, none in
`extensions/`**; **five test files red at runtime, not the three the CONTEXT
names**; and **every static-analysis gate green**.

The three surprises the planner needs are:

1. **Two locking tests beyond the three named.** `tests/architecture/hooks-foundation.test.ts:199`
   pins `SUPPORTED_COMPONENT_KINDS` as an exact 4-tuple, and
   `tests/shared/notify.test.ts:5008` carries a *second* `REASONS.length === 44`
   assertion. Both go red. Neither is in the CONTEXT's "gates that must be
   turned" list.
2. **`catalog-uat` does not go red from the production change alone.** Its three
   workflow fixtures pass `reasons: ["workflows"]` as literals; the renderer
   prints whatever string it is handed. With only production edited,
   `catalog-uat` is red at **typecheck** (`"workflows"` is no longer a
   `ContentReason`) but **green at runtime**. To satisfy criterion 4's
   red-then-green obligation, the doc block must be turned *first*.
3. **`componentPaths` widening costs 131 test-side edits, but the two biggest
   files carry 120 of them.** `tests/bridges/agents/stage.test.ts` (62) and
   `tests/bridges/skills/stage.test.ts` (58) each construct a
   `componentPaths` object literal per test case. A further ~10 sites are
   `assert.deepStrictEqual` payloads that the compiler cannot see and that fail
   only at runtime.

**Primary recommendation:** Do the production edit first and let `tsc` enumerate
the test-side widening (it is mechanical and complete). Turn the three catalog
doc blocks *before* the production change so `catalog-uat` is observed red.
Put the install-level window test in `tests/integration/`, modelled on
`tests/integration/transaction-lifecycle-cascade.test.ts`, and assert the
absent artifact as "`<HOME>/.pi/workflows` does not exist" — the exact path
Phase 111 will invert.

### Evidence Grades

Every claim in this document carries one of:

- **[MEASURED]** — I applied the change and ran the named command in this
  session; the output quoted is real.
- **[READ]** — I opened the named file and line range this session and quote it
  verbatim.
- **[ASSUMED]** — training knowledge or inference, not confirmed here.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Deciding whether `workflows` is a supported kind | `domain/` (`resolver.ts`) | `domain/components/plugin.ts` | The resolver owns the closed sets; the schema layer only declares the field opaquely. No I/O, no rendering. |
| Declaring the manifest field group a kind belongs to | `domain/components/plugin.ts` | — | Both bags are `Type.Optional(Type.Unknown())`; the move is documentary at the schema layer and semantic at the resolver. |
| The rendered reason vocabulary | `shared/notify.ts` (`REASONS` tuple) | `shared/notify-reasons.ts` (topic groups + proof), `shared/probe-classifiers.ts` (`kindToReason`) | `notify.ts` is the single source of catalog truth; the other two are typed views and a classifier over it. |
| Classifying a typed unsupported kind into a reason | `shared/probe-classifiers.ts` | — | The single shared render-time seam every surface routes through (`list`, `info`, `install`, `update`, `reconcile`, `enable-disable`, `fetch`). |
| The published byte contract | `docs/output-catalog.md` | `tests/architecture/catalog-uat.test.ts` | The doc is the contract; the test is the gate that pairs it byte-for-byte with live `notify()` output. |
| Materializing workflow artifacts | **none in this phase** | Phase 111 `bridges/workflows/` | Deliberately absent — this is the D-109-06 window. |

**Sanity check for the planner:** no task in this phase belongs in
`orchestrators/`, `bridges/`, `persistence/`, `transaction/`, or `platform/`.
If a plan puts one there, the tier is wrong.

## Project Constraints (from CLAUDE.md)

| Directive | Source | Consequence for this phase |
|-----------|--------|---------------------------|
| Read a file before editing it; trace callers before modifying a function | `CLAUDE.md` §Guidelines | The `componentPaths` widening has ~140 read sites; the compiler enumerates them (see §*Blast radius*). |
| `npm run check` must stay green | `CLAUDE.md` §Constraints | The chain is `typecheck && lint && fallow && format:check && test:corresponding && test:corresponding:negative && test:coverage:direct:negative && test && test:integration` [READ: `package.json` `scripts.check`]. |
| Two independent cognitive-complexity gates (ESLint `sonarjs/cognitive-complexity: 15` and fallow `maxCognitive: 15`) | `.planning/codebase/CONVENTIONS.md` §Fallow | Not engaged: this phase adds no branching. `fallow health` reported `0 above threshold` under the applied change [MEASURED]. |
| Comments cite decision/requirement IDs, never planning refs | `.claude/rules/typescript-comments.md` | See §*Pitfall 6* — the rule also forbids narrating removed code, which bears directly on D-109-02's ledger line. |
| CHANGELOG entries: one user-visible change, ≤25-word sentences, `simple-english` + `humanizer` applied | `.claude/rules/changelog.md` | See §*Pitfall 7* — the 0.18.1 CHANGELOG entry describes the pre-inversion behavior. |
| Run `pre-commit run --all-files` before committing; never `--no-verify` | `CLAUDE.md` §Git | `docs/output-catalog.md` edits pass through `mdformat` + `markdownlint-cli2`, **not** prettier (`format:check` globs only `js,json,ts`) [READ: `package.json` `scripts.format:check`]. |
| Worktree trufflehog caveat: prefix `SKIP=trufflehog`, verify by filesystem scan first | `CLAUDE.md` §Git | This phase runs in the `/home/acolomba/pi-claude-marketplace-workflows` worktree, so the caveat applies to every commit. |
| Never commit to `main`; branch is `features/workflow` | `CLAUDE.md` §Git | Confirmed: `git rev-parse --abbrev-ref HEAD` → `features/workflow` [MEASURED]. |

## Standard Stack

**No new libraries. No installs. No package changes.**

This phase edits five production `.ts` files, one markdown contract, and a set
of test files. It adds no import, no dependency, and no build step.

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `typebox` | `^1.1.38` (already a direct + peer dep) | The `ComponentPathsSchema` and `PLUGIN_ENTRY_SCHEMA` shapes that widen | Already the project's runtime-schema layer [READ: `package.json`] |
| `node:test` | built in | Every test touched | The project's only test runner [READ: `.planning/codebase/STACK.md`] |

### Alternatives Considered

None. The change is fully determined by WINV-01..05 and D-109-01..07.

## Package Legitimacy Audit

**Not applicable.** This phase installs no external packages. No `npm install`
appears anywhere in its scope. No `[SLOP]`, no `[SUS]`, no
`checkpoint:human-verify` gate is required.

## Architecture Patterns

### System Architecture Diagram

```text
        marketplace.json entry / plugin.json manifest / <pluginRoot>/ on disk
                                     │
                                     ▼
   ┌──────────────────────────── domain/resolver.ts ───────────────────────────┐
   │                                                                            │
   │  SUPPORTED_COMPONENT_PATH_KINDS ──▶ collectStrictComponentKind (per kind)  │
   │     (351/360)                          declared paths ∪ <pluginRoot>/<kind>│
   │                                        ─▶ partial.componentPaths[kind]     │
   │                                        ─▶ partial.supported.push(kind)     │
   │                                                                            │
   │  UNSUPPORTED_COMPONENT_KINDS ────▶ collectUnsupportedKinds (declared OR    │
   │     (380) + CONVENTIONS (392)          UNSUPPORTED_COMPONENT_CONVENTIONS)  │
   │                                        ─▶ notes "contains <kind>"          │
   │                                        ─▶ partial.unsupported.push(kind)   │
   │                                                                            │
   │                    decideResolution (1624)                                 │
   │      structuralDirty ─▶ unavailable                                        │
   │      unsupported.length > 0 ─▶ partially-available                         │
   │      else ─▶ installable                                                   │
   └──────────────┬──────────────────────────────────────┬──────────────────────┘
        resolved.unsupported[]                   resolved.componentPaths
                  │                                       │
                  ▼                                       ▼
   shared/probe-classifiers.ts             bridges/{skills,commands,agents}
     narrowUnsupportedKinds(kinds)           discover ─▶ stage ─▶ commit
       ─▶ kindToReason arm per kind        ( bridges/workflows joins here
       ─▶ readonly UnsupportedReason[]        in Phase 111, reading
                  │                            componentPaths.workflows )
                  ▼
   shared/notify.ts REASONS tuple ─▶ composeReasons ─▶ "{lsp, unsupported component}"
                  │
                  ▼
   docs/output-catalog.md  ◀── byte-paired by ── tests/architecture/catalog-uat.test.ts
```

**What this phase moves:** `workflows` crosses from the lower-left branch
(`UNSUPPORTED_COMPONENT_KINDS`) to the upper-left branch
(`SUPPORTED_COMPONENT_PATH_KINDS`). Everything downstream of `resolved.unsupported`
stops seeing it; `resolved.componentPaths.workflows` starts existing but has no
consumer until Phase 111.

### Pattern 1: The five production edits (WINV-01)

Each is a one-line or two-line change. All five are byte-transferable from
`features/workflows-spike` (see §*Prior art*).

| # | File:line | Current [READ] | After |
|---|-----------|----------------|-------|
| 1 | `extensions/pi-claude-marketplace/domain/resolver.ts:67-71` | `const ComponentPathsSchema = Type.Object({` / `  skills: Type.Array(Type.String()),` / `  commands: Type.Array(Type.String()),` / `  agents: Type.Array(Type.String()),` / `});` | add `  workflows: Type.Array(Type.String()),` |
| 2 | `resolver.ts:351` | `export const SUPPORTED_COMPONENT_KINDS = ["skills", "commands", "agents", "hooks"] as const;` | append `, "workflows"` |
| 3 | `resolver.ts:360` | `const SUPPORTED_COMPONENT_PATH_KINDS = ["skills", "commands", "agents"] as const;` | append `, "workflows"` |
| 4 | `resolver.ts:388` (inside the tuple opened at 380) | `  "workflows",` | delete the line |
| 5 | `resolver.ts:403` | `  workflows: [{ relativePath: "workflows", kind: "dir" }],` | delete the line |
| 5a | `resolver.ts:410` | `  componentPaths: { skills: string[]; commands: string[]; agents: string[] };` | add `; workflows: string[]` |
| 5b | `resolver.ts:438` | `    componentPaths: { skills: [], commands: [], agents: [] },` | add `workflows: []` |
| 6 | `domain/components/plugin.ts:29-32` / `:45` | `workflows: Type.Optional(Type.Unknown()),` sits in `UNSUPPORTED_COMPONENT_FIELDS` (line 45) | move the identical line into `SUPPORTED_COMPONENT_PATH_FIELDS` |

Edits 1, 5a and 5b are three spellings of the same field and **must move
together**: `ComponentPathsSchema` (typebox) types the public
`ResolvedPluginInstallable["componentPaths"]`, while `PartialResolution`
(line 406) is the internal accumulator and `emptyResolution` (line 430) its
initializer. Widening only the schema leaves `materializableFields`
(`resolver.ts:473`, `componentPaths: partial.componentPaths`) unassignable.

### Pattern 2: The convention probe needs no new code — MEASURED

CONTEXT asserts "only which tuple reads it changes". This is literally true and
I confirmed the mechanism by reading the loop and by running the resolver.

`collectStrictComponentKind` derives the convention directory from the kind
name itself [READ: `extensions/pi-claude-marketplace/domain/resolver.ts:1051-1053`]:

```ts
  if ((await statKindOf(ctx)(path.join(pluginRoot, kind))) === "dir") {
    addComponentPath(partial, kind, seenPaths, kind);
  }
```

Because the kind string *is* `"workflows"`, the probed path is
`<pluginRoot>/workflows` — byte-identical to what
`UNSUPPORTED_COMPONENT_CONVENTIONS.workflows` probes today
(`{ relativePath: "workflows", kind: "dir" }`, `resolver.ts:403`). No special
case, no new probe.

#### Measured resolver verdicts, before and after

Driven through the real `resolveStrict` / `resolveLoose` with an injected
`statKind` stub. **Before** = current `features/workflow` HEAD; **after** = the
five edits applied. [MEASURED]

| Scenario | Before | After |
|----------|--------|-------|
| strict, `workflows/` dir on disk | `partially-available` · notes `["contains workflows"]` · unsupported `["workflows"]` · supported `[]` | `installable` · notes `[]` · unsupported `[]` · **supported `["workflows"]`** · **`componentPaths.workflows === ["workflows"]`** |
| strict, entry declares `workflows: "workflows"` | `partially-available` · `["contains workflows"]` | `installable` · supported `["workflows"]` · `componentPaths.workflows === ["workflows"]` |
| strict, `workflows/` **and** `themes/` on disk | `partially-available` · notes `["contains themes","contains workflows"]` · unsupported `["themes","workflows"]` | `partially-available` · notes `["contains themes"]` · **unsupported `["themes"]`** · supported `["workflows"]` |
| loose, `workflows/` dir on disk (no declaration) | `partially-available` · `["contains workflows"]` | `installable` · supported `[]` · **`componentPaths.workflows === []`** |
| loose, entry declares `workflows` | `partially-available` | `installable` · supported `["workflows"]` |
| loose, **manifest-only** `workflows` (entry silent) | `partially-available` · `["contains workflows"]` | **`unavailable`** · notes `["component declarations conflict: manifest declares \"workflows\" but entry does not"]` |

Row 3 is the exact fixture the repointed rejection catalog state needs (see
§*The three catalog states*). Row 4 and Row 6 are the two behavior changes the
CONTEXT does not name — see §*Pitfall 1* and §*Pitfall 2*.

### Pattern 3: The reason retirement is compiler-enforced to be all-or-nothing

`shared/notify-reasons.ts` ends with a structural completeness proof
[READ: `extensions/pi-claude-marketplace/shared/notify-reasons.ts`, final block]:

```ts
type _AssertNever<T extends never> = T;
type _UncoveredReason = Exclude<Reason, SharedTopicReason | CommandPrivateReason>;
type _ExtraReason = Exclude<SharedTopicReason | CommandPrivateReason, Reason>;
export type _ReasonsCoverageProof = [_AssertNever<_UncoveredReason>, _AssertNever<_ExtraReason>];
```

Removing `"workflows"` from `REASONS` (`notify.ts:237`) without removing it
from the `UnsupportedReason` group (`notify-reasons.ts:107`) makes
`_ExtraReason` resolve to `"workflows"` and fails `_AssertNever` with TS2344.
Removing it from the group without removing it from `REASONS` makes
`_UncoveredReason` resolve to `"workflows"` and fails the other half. **The
proof cannot be left half-updated.** [READ + inferred from the `Exclude`
semantics; the applied change produced zero errors in `notify-reasons.ts`,
which is the positive confirmation that both halves moved. MEASURED]

`shared/probe-classifiers.ts` is a *separate* union that happens to share a
name. Its `UnsupportedReason` (line 77) is a five-member alias declared
independently of `notify-reasons.ts`'s eight-member group; the coverage proof
does **not** span it. Its `kindToReason` arm (lines 216-218) must be deleted by
hand, and the only thing that catches a miss is
`tests/shared/probe-classifiers.test.ts:266`.

### Pattern 4: The install-level window test (D-109-07 half 2)

**Where it goes:** a new file under `tests/integration/`.

`scripts/check-corresponding-tests.mjs` exempts three roots
[READ: `scripts/check-corresponding-tests.mjs:11`]:

```js
const nonCorrespondingRoots = new Set(["architecture", "e2e", "integration"]);
```

So an `tests/integration/*.test.ts` file needs no production pair — which is
correct, because the behavior under test belongs to no single module. It runs
under `npm run test:integration`, which is a member of the `check` chain
[READ: `package.json`].

**The template to follow:** `tests/integration/transaction-lifecycle-cascade.test.ts`.
It is the closest existing thing to "install a fixture plugin end to end and
assert on the materialized footprint" and is fully self-contained
[READ: `tests/integration/transaction-lifecycle-cascade.test.ts:1-235`]:

- `makeCtx()` (line 27) — captures `ctx.ui.notify` calls into a
  `NotifyRecord[]` so the test can assert on rendered bytes.
- `withHermeticHome()` (line 46) — `mkdtemp` + `process.env.HOME` override +
  restore.
- `seedHooksPlugin()` (line 63) — writes `<pluginRoot>/.claude-plugin/plugin.json`,
  a skill under `skills/tool/SKILL.md`, the marketplace's
  `.claude-plugin/marketplace.json`, then seeds `state.json` via
  `saveState(locations.extensionRoot, …)` with a `pathSource(...)` marketplace
  record.
- The install is then a direct call:
  `await installPlugin({ ctx, pi, scope: "project", cwd, marketplace: "mp", plugin: "hello" })`.
- Assertions read `notifications.map((n) => n.message).join("\n")` and the
  on-disk file through `locationsFor("project", cwd)`.

`tests/orchestrators/plugin/install.test.ts` carries a byte-identical
`withHermeticHome` at line 305 and drives real installs too, so it is a viable
fallback home. I recommend `tests/integration/` because the assertion spans
resolver + orchestrator + a filesystem root that no single module owns, and
because this phase does not change `install.ts`.

**Confirming the CONTEXT's suspicion:** `tests/edge/handlers/plugin/install.test.ts`
uses "workflow" only in the generic sense ("the workflow never ran") — it is a
handler-arg-parsing test with a mocked orchestrator, not an install driver
[MEASURED: `grep -n -i workflow tests/edge/handlers/plugin/*.ts` returns only
prose usages]. It is the wrong home.

#### How to assert "no artifact of kind X exists"

There is no `locations.workflowsSavedDir` on this branch — it arrives in
Phase 110. The assertion must therefore be made against the engine's storage
root directly.

`features/workflow-port-wip` shows the exact target
[READ: `git show features/workflow-port-wip:extensions/pi-claude-marketplace/platform/workflow-home.ts`]:

```ts
/** `<homedir>/.pi/workflows` unless a test has relocated it. */
export function workflowHomeDir(): string {
  return override ?? path.join(os.homedir(), ".pi", "workflows");
}
```

and the artifact path it composes
[READ: the `locations.ts` diff on `features/workflow-port-wip`]:

- user scope: `<workflowsHomeDir>/saved/<generatedName>.json`
- project scope: `<workflowsHomeDir>/projects/<key>/saved/<generatedName>.json`

`os.homedir()` honors `$HOME` on this platform — measured:
`HOME=/tmp/fakehome node -e "console.log(require('os').homedir())"` prints
`/tmp/fakehome` [MEASURED]. So `withHermeticHome` already isolates the
workflows root, and the assertion is:

```ts
// D-109-06 window: the kind resolves supported, but no bridge materializes it
// yet, so the host engine's storage root must not exist at all.
await assert.rejects(stat(path.join(process.env.HOME!, ".pi", "workflows")), {
  code: "ENOENT",
});
```

This is the single line Phase 111 inverts, which is exactly the property the
Deferred Ideas carry-forward asks for.

### Pattern 5: The resolver owner test turn (D-109-07 half 1)

`unsupportedConventionScenarios` (`tests/domain/resolver.test.ts:91-102`) is
consumed **twice**, not once — a detail the CONTEXT does not mention
[READ: `tests/domain/resolver.test.ts`]:

- line 855: `for (const scenario of unsupportedConventionScenarios)` → the
  strict `PR-4 discovers the unsupported ${scenario.kind} default location` test,
  which asserts `state === "partially-available"`, the `contains <kind>` note,
  and `unsupported.includes(scenario.kind)`.
- line 3100: the same loop for `resolveLoose`, asserting
  `partially-available` + the note.

Removing the row at line 101 removes it from **both** loops. Two positive
replacements are therefore needed, and they are **not symmetric** (see the
measured table above — loose mode gets `installable` with an *empty*
`componentPaths.workflows`, because the loose collector never probes disk):

- **strict** — model it on the existing supported-convention test
  [READ: `tests/domain/resolver.test.ts:1700-1721`, `PR-4 implicit-by-convention
  populates componentPaths.skills when neither entry nor manifest declares it`],
  asserting `state === "installable"`,
  `componentPaths.workflows` deep-equals `["workflows"]`, and
  `supported.includes("workflows")`.
- **loose** — assert `state === "installable"` and the **absence** of any
  `contains workflows` note. Do not assert a populated
  `componentPaths.workflows`: the loose collector takes no `ctx` "precisely
  because it never probes disk" [READ: `resolver.ts:1665-1668` comment], so the
  measured value is `[]`.

### Anti-Patterns to Avoid

- **Reordering `REASONS` while removing the tail member.** `compat-01` asserts
  membership *and order* with `deepEqual`. Removing the last element is the
  only removal that leaves every surviving index unmoved — that is why D-109-01
  targets the tail specifically.
- **Deleting a locking test to make room.** WINV-04 and criterion 4 both forbid
  it; `catalog-uat`'s inverse-walk test would also fail on an orphan fixture.
- **Adding a state probe to `notify.ts`.** `notify.ts` is a dumb renderer;
  commands stamp severity and reasons. Nothing in this phase may change that.
- **Editing the expected bytes of the repointed rejection to match whatever
  comes out.** The CONTEXT is explicit: if the chosen second kind does not
  produce the `partially-available` arm plus the `--partial` trailer, pick a
  different kind. (It does — see the measured bytes below — so this should not
  arise.)
- **Adding an unused `SupportedKind` export.** `fallow dead-code` reported
  `✓ No issues found` under the applied change without it [MEASURED]. Nothing
  in this phase consumes it. Phase 111 may.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Finding every `componentPaths` construction site | A grep sweep | `npm run typecheck` after edits 1/5a/5b | The compiler enumerated all 131 in one pass, with file:line:column; grep misses `assert.deepStrictEqual` payloads and over-reports comments (I measured 140+ grep hits vs 131 real errors). |
| Detecting a half-removed reason | A test that counts members | The existing `_ReasonsCoverageProof` | It already fires at TS2344 on either half being missed. |
| A convention-directory probe for `workflows/` | A new `WORKFLOW_CONVENTION` entry | `SUPPORTED_COMPONENT_PATH_KINDS` membership | `collectStrictComponentKind` derives `<pluginRoot>/<kind>` from the kind name (resolver.ts:1051). |
| Byte-verifying the new catalog rows | Hand-composing the expected string | Drive `notify()` in a scratch script and paste the output | The 4-space `--partial` trailer indent, the summary-line prefix, and the blank-line placement are all renderer behavior. I did this — see the bytes below. |
| Asserting "no workflow artifact" through a locations getter | Adding `workflowsSavedDir` early | `path.join(HOME, ".pi", "workflows")` | The getter is Phase 110's deliverable; adding it here would be an unused export and would widen this phase's boundary. |

**Key insight:** every "find all the places" question in this phase has a
compiler or an existing gate that answers it exactly. Use them as the
enumeration mechanism rather than as the check afterwards.

## Blast Radius — Measured

**Method:** applied all five production edits plus the four reason deletions to
the working tree, ran each gate, captured output, then restored with
`git checkout --`. Tree verified clean afterwards (`git status --porcelain
extensions/ tests/ docs/` → empty) [MEASURED].

### Complete blast radius of retiring the `{workflows}` reason (WINV-03)

**Four deletion sites** [READ]:

| # | File:line | What |
|---|-----------|------|
| 1 | `shared/notify.ts:234-237` | The `REASONS` tail entry `"workflows",` plus its three-line `WDET-04 / D-106-04` doc comment |
| 2 | `shared/notify-reasons.ts:107` | The `| "workflows"` member of the `UnsupportedReason` topic group |
| 3 | `shared/probe-classifiers.ts:77` | The `| "workflows"` member of the `UnsupportedReason` alias (a *different* union from #2) |
| 4 | `shared/probe-classifiers.ts:216-218` | The `if (kind === "workflows") { return "workflows"; }` arm of `kindToReason` |

**Seven count/narrative sites naming 44** — the CONTEXT names only one of them
[MEASURED: `grep -rn "44-entry\|44 members\|44-member\|The 44\|, 44)" extensions/ docs/ tests/`]:

| File:line | Text | Action |
|-----------|------|--------|
| `shared/notify.ts:83` | `44-entry membership AND order are catalog-stable` | → 43 |
| `shared/notify-reasons.ts:7` | `OUT-08: the 44-entry` | → 43 |
| `shared/notify-reasons.ts:14` | `44-entry set` | → 43 |
| `shared/notify-reasons.ts:24-26` | `WDET-04 / D-106-04 appended the dedicated `workflows` reason (43 to 44).` | the D-109-02 ledger sentence lands here |
| `docs/output-catalog.md:63` | `The 44-member … REASONS tuple defines the closed set. The typed `workflows` kind maps to the final append-only member, `{workflows}`.` | → 43, and the second sentence is deleted |
| `tests/architecture/notify-closed-set-locks.test.ts:29` | test title `REASONS is the closed 44-entry reason set` | → 43 |
| `tests/architecture/notify-closed-set-locks.test.ts:51` | `assert.equal(REASONS.length, 44);` | → 43, ledger comment appended above |
| `tests/shared/notify.test.ts:5008` | `assert.equal(REASONS.length, 44);` — **a second, independent length pin the CONTEXT does not name** | → 43 |

**Five doc comments in `probe-classifiers.ts` naming workflows** [MEASURED:
`grep -n workflow extensions/pi-claude-marketplace/shared/probe-classifiers.ts`]:
lines **73**, **82**, **101**, **170**, **204**. Line 101 (`Workflows do not use
this axis, so this helper never emits `workflows``) and line 204 (`three kinds
have dedicated mappings … `workflows` -> `workflows``) become outright false;
73, 82 and 170 describe the deleted member.

**Two `notify.ts` doc comments naming workflows as a `--partial` example**
[READ: `shared/notify.ts:930` and `:1778`] — both read "…unsupported kinds
(LSP, partial hooks, other components, or workflows). Thus, `--partial` can
install its supported components." Both become false; wording is Claude's
discretion per CONTEXT.

**Sites the CONTEXT flagged for a read that turn out to need no edit:**

- `orchestrators/plugin/install.messaging.ts:410-425` — the comment names
  `lspServers` as the *sole* manifest-field carve-out and `hooks` as the
  supported-kind exception. It does **not** name workflows [READ]. No edit.
- `shared/errors.ts:520-531` — the `unsupportedKinds` doc comment discusses
  `hooks`; it does not name workflows [READ]. No edit.

### What `SUPPORTED_COMPONENT_PATH_KINDS` gaining a member costs

**Production: zero errors.** `npm run typecheck` under the applied change
produced **131 errors, none of them in `extensions/`** [MEASURED].

Two production sites *look* like they should break and do not:

- `orchestrators/plugin/info.ts:646-656` — `composeResolvedComponents` declares
  its parameter *structurally* as `{ componentPaths: { readonly skills; readonly
  commands; readonly agents } }` [READ]. A wider argument satisfies it, so
  `info` compiles and simply does not enumerate workflows. That is the correct
  Phase-109 behavior and the seam Phase 111 widens.
- `orchestrators/plugin/info.ts:1901` — constructs
  `componentPaths: { skills: ["skills"], commands: ["commands"], agents: ["agents"] }`
  for that same narrow parameter [READ]. No error.

`noUncheckedIndexedAccess` and `exactOptionalPropertyTypes` do **not** make any
of this harder: `componentPaths[kind]` is indexed by the closed
`SupportedPathKind` union (an object-key index, not a numeric one), and the new
field is required, not optional.

**Tests: 131 errors across 10 files** [MEASURED, `tsc --noEmit`]:

| File | Errors | Shape |
|------|--------|-------|
| `tests/bridges/agents/stage.test.ts` | 62 | per-test `componentPaths: { skills: [], commands: [], agents: ["agents"] }` literals |
| `tests/bridges/skills/stage.test.ts` | 58 | same |
| `tests/architecture/catalog-uat.test.ts` | 3 | `TS2322: Type '"workflows"' is not assignable to type 'ContentReason'` at **919, 1226, 1328** — the three workflow fixtures |
| `tests/orchestrators/plugin/plugin-state-classifier.test.ts` | 2 | literals at 58, 73 |
| `tests/shared/probe-classifiers.test.ts` | 1 | `TS2322` at 269: `"workflows"` not assignable to `UnsupportedReason` |
| `tests/orchestrators/plugin/shared.test.ts` | 1 | literal at 133 |
| `tests/orchestrators/plugin/discover-names.test.ts` | 1 | literal at 27 |
| `tests/bridges/skills/discover.test.ts` | 1 | literal at 26 |
| `tests/bridges/commands/stage.test.ts` | 1 | literal at 50 |
| `tests/bridges/commands/discover.test.ts` | 1 | literal at 28 |

Error codes: 67 × `TS2741` (missing property) + 64 × `TS2322` (not assignable
to `MaterializablePlugin`); the two usually come in pairs on the same fixture.

**The invisible set — sites the compiler will NOT flag.** `assert.deepStrictEqual`
takes an untyped second argument, so whole-arm equality assertions compile
clean and fail at runtime. Measured runtime failures of this shape:

- `tests/domain/resolver.test.ts` — five tests: `resolveStrict returns the
  complete installable true arm` (literal at 3346), `… complete
  partially-available true arm` (3372), `… unwraps a standalone mcpServers
  document`, `… reads a real manifest through the default file reader`, `…
  preserves declared-first implicit-last ordering with first-wins deduplication`
  (3421, 3617, 3762).
- `tests/orchestrators/plugin/install.test.ts:7331` — `runInstallLedger projects
  a complete empty-plugin summary and preserves a caller pin` (literal at 7363).
- `tests/orchestrators/plugin/git-source-probe.test.ts` — `returns a complete
  warm candidate for a same-version entry` and `… for a newer entry` (literals
  at 492, 521).

The diff each reports is `+ workflows: []`.

**Not affected [MEASURED]:** `tests/domain/components/plugin.test.ts` (lines 51,
103, 242 use `workflows` in manifest fixtures) stays green — both schema field
bags are `Type.Optional(Type.Unknown())`, so moving the field between them
changes no validation outcome.

## Prior art on `features/workflows-spike` — what transfers and what does not

**Do not merge or cherry-pick.** Read-only reference, per the CONTEXT.

### Transfers verbatim (byte-identical to what I applied and typechecked)

[MEASURED: `git show features/workflows-spike:<path>` diffed against the edit I
applied, which produced zero production typecheck errors]

| Site | Spike form |
|------|-----------|
| `ComponentPathsSchema` (spike `resolver.ts:67-72`) | `workflows: Type.Array(Type.String()),` added as the fourth key |
| `SUPPORTED_COMPONENT_KINDS` (spike `resolver.ts:333-340`) | the same five members, formatted multi-line |
| `SUPPORTED_COMPONENT_PATH_KINDS` (spike `resolver.ts:355`) | `["skills", "commands", "agents", "workflows"] as const` |
| `UNSUPPORTED_COMPONENT_KINDS` (spike `resolver.ts:373-382`) | the same seven members, `workflows` absent |
| `UNSUPPORTED_COMPONENT_CONVENTIONS` (spike) | the same five entries, `workflows` absent |
| `PartialResolution.componentPaths` (spike) | `{ skills: string[]; commands: string[]; agents: string[]; workflows: string[] }` |
| `plugin.ts` field move | `workflows: Type.Optional(Type.Unknown()),` in `SUPPORTED_COMPONENT_PATH_FIELDS`, absent from `UNSUPPORTED_COMPONENT_FIELDS` |

### Does NOT transfer

| Spike artifact | Why not |
|----------------|---------|
| The `UNSUPPORTED_COMPONENT_KINDS` doc comment | Spike reads `PR-3: any of these kinds declared in entry OR manifest disqualifies install with note \`contains <kind>\``. Main rewrote it to the partially-available / `--partial` framing and added the D-90-06 `bin` paragraph [READ, both]. **Keep main's text**; only delete the `"workflows"` member. |
| `export type SupportedKind` (spike `resolver.ts:340`) | Main has no such export. Nothing in Phase 109 consumes it; adding it is an unused export. Discretion item — recommend **not** adding it. |
| The `SUPPORTED_COMPONENT_PATH_KINDS` WFLW-01 comment paragraph | Optional. It explains *why* `workflows` is path-bearing where `hooks` is not, which is genuinely useful; but it is spike prose citing WFLW-01, and this phase's requirement is WINV-01. Reword and retag if kept. |
| Anything about the reason | The spike **predates PR #154**, which is what introduced the `{workflows}` member. It offers no guidance on D-109-01 [confirmed: the spike's `UNSUPPORTED_COMPONENT_KINDS` never carried `workflows`, so there was never a reason to retire]. |
| The `plugin.ts` `SUPPORTED_COMPONENT_PATH_FIELDS` inline comment | Spike carries `// WFLW-01: path-bearing (\`string | array\`), same shape as the three above.` Retag to WINV-01 if kept. |

### `features/workflow-port-wip` and `port/README.md`

Single commit `3a338536`, 12 files, 1999 insertions — the mechanical half of
Phases 110-111 [MEASURED: `git diff --stat`]. **Phase 109 ports nothing from
it.** Its only relevance here is the forward contract:

`bridges/workflows/discover.ts:233` reads
`input.resolved.componentPaths.workflows` [READ: `git show
features/workflow-port-wip:extensions/pi-claude-marketplace/bridges/workflows/discover.ts`].
That single field is this phase's entire obligation to Phase 111. The port
README states the branch's typecheck error is exactly that read.

`port/README.md` also records that `tests/helpers/` no longer exists, which is
consistent with the `npm test` glob
(`tests/{architecture,bridges,domain,edge,orchestrators,persistence,platform,shared,transaction}/**/*.test.ts`
— no `helpers`) [READ: `package.json`].

## The three catalog states — exact post-inversion bytes

**Method:** drove the real `notify()` from `shared/notify.ts` with the same
`piWithBothLoaded()` shape `catalog-uat` uses (`{ getAllTools: () => [{name:
"subagent"}, {name: "mcp"}] }`), captured the string passed to `ctx.ui.notify`
and its severity argument [MEASURED].

### State 1 — the not-installed inventory row

**Fixture** (replaces `tests/architecture/catalog-uat.test.ts:907-924`), in the
`/claude:plugin list` section:

```ts
{ status: "available", name: "helper", version: "1.0.0" }
```

Note: `status: "available"` carries **no** `reasons` field. Rendered bytes:

```text
● official [user]
  ○ helper v1.0.0 (available)
```

Severity argument: **none** (info). The glyph is `○` (`ICON_AVAILABLE`), matching
the `gamma` row in the existing `single-mp-mixed` state
[READ: `docs/output-catalog.md:196`].

> **Naming tension for the planner.** D-109-05 suggests the id
> `workflow-installed-inventory`, but D-109-04 item 1 specifies the *not-installed*
> inventory row, which renders `(available)`. `workflow-available-inventory`
> matches what the block renders; `workflow-installed-inventory` would repeat
> the stale-id defect D-109-05 exists to fix. The ids in D-109-05 are marked
> "e.g.", so this is a naming choice inside the decision, not a change to it.

### State 2 — the clean install success row

**Fixture** (replaces `catalog-uat.test.ts:1209-1230`), in the
`/claude:plugin install <plugin>@<marketplace>` section:

```ts
{
  status: "installed",
  name: "helper",
  version: "1.0.0",
  dependencies: [],
  severity: "info",
  needsReload: true,
}
```

Rendered bytes:

```text
● official [user]
  ● helper v1.0.0 (installed)

/reload to pick up changes
```

Severity argument: **none** (info).

**This is byte-identical to the existing `success` state**
[READ: `docs/output-catalog.md:496-503`] and the fixture is a verbatim copy of
`catalog-uat.test.ts:1064-1084`. D-109-04 explicitly permits it, and I confirmed
the pairing test imposes no uniqueness rule: it walks `examples` and calls
`checkCatalogExample(example)` per annotation, with an exact-count assertion
(`examples.length === 182`) and an inverse orphan walk keyed on
`${section}::${state}` [READ: `tests/architecture/catalog-uat.test.ts:5228-5252`
and `:5374-5409`]. Renaming ids keeps the count at 182 — do **not** change that
number.

### State 3 — the repointed rejection

**Fixture** (replaces `catalog-uat.test.ts:1311-1331`), in the install section:

```ts
{
  status: "partially-available",
  name: "helper",
  reasons: ["unsupported component"],
  partialHint: true,
  severity: "error",
}
```

Rendered bytes:

```text
A plugin operation has failed.

● official [user]
  ⊖ helper (partially-available) {unsupported component}
    Re-run with --partial to install the supported components.
```

Severity argument: **`"error"`** → the fixture keeps `expectedSeverity: "error"`.

**Why `{unsupported component}` and not `{themes}`** — measured on two axes:

1. `narrowUnsupportedKinds(["themes"])` returns `["unsupported component"]`.
   `themes` has no carve-out; only `lspServers → lsp` and `hooks → unsupported
   hooks` do [MEASURED, and consistent with the existing note at
   `tests/orchestrators/plugin/list.test.ts:3590`: "`themes` is not one of
   `narrowUnsupportedKinds`' carve-outs"].
2. Post-inversion, a plugin with **both** `workflows/` and `themes/` on disk
   resolves `partially-available` with `unsupported: ["themes"]` and
   `supported: ["workflows"]` [MEASURED, table row 3 above]. So the brace names
   only the other kind — which is precisely the proof D-109-04 item 3 wants.

The `--partial` trailer **does** render (the `partialHint: true` path), and its
wording is byte-identical to the frozen `failure-unsupported-features` state
[READ: `docs/output-catalog.md:606-616`], so `docs/messaging-style-guide.md` is
undisturbed.

**Fallback if `themes` were unsuitable:** it is suitable. `monitors`,
`outputStyles`, `channels`, `userConfig` and `settings` would all also produce
`{unsupported component}`. `lspServers` would produce `{lsp}` and is the only
alternative that yields a *different* brace.

### Prose in `docs/output-catalog.md` that must change with them

| Line | Current claim | Disposition |
|------|---------------|-------------|
| 63 | "`{workflows}` for `workflows`" carve-out; "The 44-member … REASONS tuple"; "The typed `workflows` kind maps to the final append-only member" | Becomes false. Drop the workflows carve-out clause and the last sentence; 44 → 43. |
| 65 | "The typed `workflows` kind uses the second path." | Becomes false. Delete the sentence. |
| 147 | `(partially-available)` table row lists "LSP / hooks / unsupported component / workflows" and "carries `{unsupported hooks}` / `{lsp}` / `{unsupported component}` / `{workflows}`" | Becomes false twice. Remove both workflows mentions. |
| 431-442 | State 1's heading, id, fence and prose | Turn per D-109-04/05 |
| 565-573 | State 2's heading, id, fence and prose | Turn per D-109-04/05 |
| 618-630 | State 3's heading, id, fence and prose | Turn per D-109-04/05 |
| 1947 | "These kinds include `lspServers`, workflows, other unsupported components…" | Becomes false. Drop "workflows,". |
| 1949 | "The partial arm uses `narrowUnsupportedKinds` for … or `{workflows}`." | Becomes false. Drop the `{workflows}` alternative. |

## Complete documentation sweep (WINV-05)

**Method:** `for f in $(git ls-files '*.md' | grep -v '^\.planning/'); do grep -c -i workflow "$f"; done`,
then read every hit [MEASURED].

| File | Lines | Verdict |
|------|-------|---------|
| `docs/output-catalog.md` | 63, 65, 147, 431, 433, 437, 440, 442, 565, 567, 571, 618, 620, 626, 630, 1947, 1949 | **17 mentions, all become false.** Full disposition table above. |
| `CHANGELOG.md` | 5, 7 | Under the released `## [0.18.1] - 2026-08-29` heading; `package.json` version and `EXTENSION_VERSION` are both `0.18.1` [MEASURED]. **Stays true as a record of what 0.18.1 shipped.** See §*Pitfall 7*. |
| `CHANGELOG.md` | 159 | "config-file workflow" — generic English. No change. |
| `README.md` | 10 | `actions/workflows/ci.yml` CI badge URL only. **No plugin-workflow prose exists on this branch.** No change. |
| `README.es.md` | 10 | Identical CI badge URL. **The Spanish Workflows bullet STATE.md line 222 asks about does not exist on this branch** — it was added on `features/workflows-spike` by the archived Phase 105 and belongs to Phase 114 (WDOC). **No change here.** |
| `docs/competitive-analysis/pi-claude-plugins.md` | 159 | "no CI workflow" — generic. No change. |
| `docs/guidelines/typescript-unit-testing-guidelines.md` | 490 | "ticket-workflow references" — generic. No change. |
| `docs/research/claude-hook-config-syntax.md` | 727 | A cited blog-post title. No change. |
| `docs/research/claude-hooks-vs-pi-events.md` | 331 | "feature workflow with sub-agents" — describes a Claude plugin's own name. No change. |
| `.agents/skills/humanizer/{README,SKILL}.md` | — | Generic. No change. |
| `CLAUDE.md` | 110-124 | GSD workflow-enforcement block. Unrelated. No change. |
| `extensions/**/*.md` | — | **None exist** [MEASURED: `git ls-files '*.md'` lists no file under `extensions/`]. |

**Net:** WINV-05's whole surface is `docs/output-catalog.md`. Nothing else under
`docs/` states that workflow-bearing plugins degrade.

## The red-then-green obligation (criterion 4)

### Single-file run command

```bash
node --test tests/architecture/compat-01-no-expansion.test.ts
```

`node --test <file>` runs one file with no build step (Node strips TypeScript
natively). This is far cheaper than `npm run check`, which chains nine gates
including the ~10-minute type-aware ESLint pass [MEASURED: `npm run lint`
exceeded a 600 s foreground budget and had to be backgrounded].

### Baseline (restored tree) — all green [MEASURED]

| File | pass | fail |
|------|------|------|
| `tests/architecture/compat-01-no-expansion.test.ts` | 14 | 0 |
| `tests/architecture/notify-closed-set-locks.test.ts` | 4 | 0 |
| `tests/architecture/catalog-uat.test.ts` | 6 | 0 |
| `tests/architecture/hooks-foundation.test.ts` | 8 | 0 |
| `tests/shared/notify.test.ts` | 253 | 0 |
| `tests/shared/probe-classifiers.test.ts` | 41 | 0 |
| `tests/domain/resolver.test.ts` | 157 | 0 |

### With the production change applied — the measured red set [MEASURED]

| Test file | Failing test | Observed failure |
|-----------|--------------|------------------|
| `tests/architecture/compat-01-no-expansion.test.ts` | `COMPAT-01: REASONS holds exactly its inherited members, in order` | `deepEqual` diff on the tail |
| `tests/architecture/notify-closed-set-locks.test.ts` | `OUT-08: REASONS is the closed 44-entry reason set` | `43 !== 44` |
| **`tests/architecture/hooks-foundation.test.ts`** | `HOOK-01: SUPPORTED_COMPONENT_KINDS is the closed 4-tuple [skills,commands,agents,hooks]` | tuple grew to 5 — **not in the CONTEXT's gate list** |
| **`tests/shared/notify.test.ts:4933`** | `closed notification constants preserve exact public values` | `43 !== 44` at line 5008 — **a second length pin, not in the CONTEXT's gate list** |
| `tests/shared/probe-classifiers.test.ts:266` | `classifies workflows as the dedicated workflows reason` | `['unsupported component']` vs `['workflows']` |
| `tests/domain/resolver.test.ts` | `PR-4 discovers the unsupported workflows default location` (strict) and `PR-4 loose discovers …` (loose) | now `installable` |
| `tests/domain/resolver.test.ts` | 5 whole-arm `deepStrictEqual` tests | `+ workflows: []` |
| `tests/orchestrators/plugin/install.test.ts:7331` | `runInstallLedger projects a complete empty-plugin summary…` | `+ workflows: []` |
| `tests/orchestrators/plugin/git-source-probe.test.ts` | 2 warm-candidate tests | `+ workflows: []` |
| `tests/architecture/catalog-uat.test.ts` | **none at runtime — 6 pass, 0 fail** | red only at `tsc` (3 × TS2322) |

### The catalog-uat sequencing problem — and the fix

`catalog-uat` compares the doc's fenced block against live `notify()` output.
The three workflow fixtures pass `reasons: ["workflows"]` as *string literals*;
the renderer prints whatever it is handed, so with only production edited both
halves still say `{workflows}` and the test stays green.

**To observe the red honestly, turn the documentation half first:**

1. Edit the three `catalog-state` blocks in `docs/output-catalog.md` to the
   post-inversion bytes above (ids renamed, headings retagged to WINV-04).
2. Run `node --test tests/architecture/catalog-uat.test.ts` → **red**, with a
   `catalog UAT failures` diff naming each turned state. This is the observed
   failure that satisfies criterion 4.
3. Then update the three fixtures in `catalog-uat.test.ts` and apply the
   production change → **green**.

The same ordering happens to satisfy the inverse-walk gate at every step: it
fails on a fixture id with no annotation, so rename both halves together.

### Suggested wave shape

| Wave | Content | Gate observed |
|------|---------|---------------|
| 0 (red) | Turn the three doc blocks; add the ledger comment and amended message to `notify-closed-set-locks` / `compat-01`; turn the resolver scenario rows | `node --test` on `catalog-uat`, `compat-01`, `notify-closed-set-locks`, `hooks-foundation`, `resolver` — each observed red, output pasted into VERIFICATION |
| 1 (green) | The five production edits + the four reason deletions | `npm run typecheck` enumerates the test-side widening |
| 2 | The 131 typecheck sites + the ~10 runtime `deepStrictEqual` payloads; the `catalog-uat` fixtures; `notify.test.ts:5008`; `probe-classifiers.test.ts:266` | `npm test` green |
| 3 | The install-level window test; the remaining prose (docs lines 63/65/147/1947/1949, the seven 44-counts, the five probe-classifiers comments, `notify.ts:930/1778`) | `npm run check` green |

## Common Pitfalls

### Pitfall 1: The loose scenario row is not symmetric with the strict one

**What goes wrong:** the planner turns
`tests/domain/resolver.test.ts:101` into one supported-convention case and
assumes both loops (line 855 strict, line 3100 loose) get the same assertions.
**Why it happens:** the two loops iterate the same table and read identically.
**Measured reality:** loose mode with a `workflows/` dir on disk yields
`installable` but `componentPaths.workflows === []` and `supported === []`,
because `collectLooseComponentKind` never probes disk.
**How to avoid:** write two distinct positive tests. The loose one asserts
`installable` and the absence of a `contains workflows` note; only the strict
one asserts a populated `componentPaths.workflows`.
**Warning sign:** a loose test asserting `["workflows"]` fails with `[] !==
["workflows"]`.

### Pitfall 2: A manifest-only `workflows` declaration flips to `unavailable` in loose mode

**What goes wrong:** a plugin whose `.claude-plugin/plugin.json` declares
`workflows` while the marketplace entry stays silent resolves `partially-available`
today and **`unavailable`** after the inversion, with the note
`component declarations conflict: manifest declares "workflows" but entry does not`.
[MEASURED]
**Why it happens:** `collectLooseComponentKind` (`resolver.ts:1416-1424`) treats
a manifest-only *supported-path-kind* declaration as a structural conflict
(MM-6). Unsupported kinds are not subject to that rule.
**Blast radius:** none in production. `resolveLoose` has **no production
consumer** — the only import outside `domain/resolver.ts` is a comment in
`domain/manifest.ts:24`, and the only importers are
`tests/architecture/hooks-foundation.test.ts` [MEASURED: `grep -rn resolveLoose
--include=*.ts extensions/`].
**How to avoid:** record it in the SUMMARY as an intended consequence of the
kind becoming path-bearing, and do not add a carve-out. It is the same rule
`skills` / `commands` / `agents` already obey.

### Pitfall 3: The two length pins and the tuple pin the CONTEXT does not list

**What goes wrong:** the plan turns three gates, `npm test` still fails on two
more.
**Measured reality:** `tests/shared/notify.test.ts:5008` carries a second
`REASONS.length === 44`, and `tests/architecture/hooks-foundation.test.ts:199`
pins `SUPPORTED_COMPONENT_KINDS` as an exact 4-tuple with the message
"`SUPPORTED_COMPONENT_KINDS` is a public closed-set contract -- shape and order
are locked" [READ].
**How to avoid:** enumerate all five red files in the plan. The
`hooks-foundation` turn is also the natural home for the optional positive
`UNSUPPORTED_COMPONENT_KINDS does NOT contain 'workflows'` mirror the CONTEXT
leaves to discretion — the precedent for `hooks` is right beside it at line 207.

### Pitfall 4: `assert.deepStrictEqual` payloads are invisible to `tsc`

**What goes wrong:** typecheck goes green after fixing 131 errors, then `npm
test` fails in ten more places.
**Why it happens:** `assert.deepStrictEqual(actual, { … })` types its second
argument as `unknown`; a missing `workflows` key is not a compile error.
**Measured list:** `resolver.test.ts` ×5, `install.test.ts:7363`,
`git-source-probe.test.ts` ×2.
**How to avoid:** after typecheck is green, run `npm test` before assuming the
widening is done. Grep as a cross-check:
`grep -rn 'componentPaths: {' tests/ | wc -l` finds the superset.

### Pitfall 5: Renaming a catalog-state id in only one of its two homes

**What goes wrong:** `catalog UAT inverse walk: every FIXTURES (section,state)
has a matching catalog annotation` fails with `[ORPHAN FIXTURE]`, or the forward
walk reports an undocumented state.
**Why it happens:** the pairing is a pure string match on
`${section}::${state}`; the id lives in `docs/output-catalog.md` as
`<!-- catalog-state: ID -->` and in `catalog-uat.test.ts` as a `FIXTURES`
inner-map key.
**How to avoid:** change both in the same edit. Also leave
`examples.length === 182` alone — three renames do not change the count.

### Pitfall 6: The comment policy forbids narrating removed code

**What goes wrong:** the D-109-02 ledger line is written as "the `workflows`
member no longer exists" or the surviving WDET-04 line is left describing a
member that is gone, and the comment reads as narration of a removed shape.
**Why it happens:** `.claude/rules/typescript-comments.md` explicitly bans
`X no longer ...`, `the former X`, `X used to ...`, and "narration of code that
no longer exists" [READ].
**How to avoid:** keep the ledger strictly arithmetic and ID-anchored — it is a
running derivation of a count, not a description of a shape. Something like
`// WINV-03: -1 for the retired workflows member (44 -> 43).` reads as
arithmetic; `// workflows is no longer a reason` does not. The same rule bars
writing "byte-identical to the former `{workflows}` row" in the catalog prose —
name the gate (`catalog-uat`) instead.

### Pitfall 7: The CHANGELOG entry is a released record, not live prose

**What goes wrong:** the phase edits `CHANGELOG.md:5-7` to match the new
behavior, silently rewriting history for a shipped version.
**Measured reality:** those two bullets sit under `## [0.18.1] - 2026-08-29`,
and `package.json` version + `EXTENSION_VERSION` are both `0.18.1` — the entry
describes released behavior.
**How to avoid:** leave the 0.18.1 entry intact. The inversion belongs in the
*next* version's entry, which is release work the STATE.md "Outstanding" list
already carries. `CHANGELOG.md` is not under `docs/`, so WINV-05 does not reach
it. Record the choice in the SUMMARY so a later reader does not read the
untouched entry as an oversight.

### Pitfall 8: `withHermeticHome` mutates `process.env.HOME` process-wide

**What goes wrong:** the new integration test runs concurrently with a sibling
that also relies on `HOME`, and one of them sees the other's temp root.
**Why it happens:** both existing helpers set `process.env.HOME` directly
[READ: `tests/integration/transaction-lifecycle-cascade.test.ts:46-61` and
`tests/orchestrators/plugin/install.test.ts:305-320`].
**How to avoid:** follow the precedent — one `test(...)` per hermetic-home
block, as `transaction-lifecycle-cascade` does. Do not add a second concurrent
test to the same file that reads `HOME` outside its own block.

### Pitfall 9: Markdown formatting is `mdformat`, not prettier

**What goes wrong:** someone runs `prettier --write docs/output-catalog.md` and
reflows the whole 2000-line contract, including byte-pinned fences.
**Why it happens:** `format:check` globs only `**/*.{js,json,ts}` plus
`scripts/**/*.mjs` [READ: `package.json`], so prettier never touches markdown
in the gate; `pre-commit` runs `mdformat` + `markdownlint-cli2` instead
[READ: `.planning/codebase/STACK.md` §Build/Dev].
**How to avoid:** edit `docs/output-catalog.md` by hand and let
`pre-commit run --all-files` normalize it. Verify `catalog-uat` after the hook
run, not before — an `mdformat` pass that touched a fence would show up there.

## Code Examples

### Widening the componentPaths triple (the three spellings that move together)

```ts
// extensions/pi-claude-marketplace/domain/resolver.ts:67
const ComponentPathsSchema = Type.Object({
  skills: Type.Array(Type.String()),
  commands: Type.Array(Type.String()),
  agents: Type.Array(Type.String()),
  workflows: Type.Array(Type.String()),
});

// :410 -- the internal accumulator
  componentPaths: { skills: string[]; commands: string[]; agents: string[]; workflows: string[] };

// :438 -- its initializer
    componentPaths: { skills: [], commands: [], agents: [], workflows: [] },
```

### The mechanical test-side widening (131 sites)

```ts
// before
componentPaths: { skills: [], commands: [], agents: ["agents"] },
// after
componentPaths: { skills: [], commands: [], agents: ["agents"], workflows: [] },
```

`tests/orchestrators/plugin/discover-names.test.ts:27-30` spreads its keys
rather than listing them, so it needs a fourth spread line:

```ts
    componentPaths: {
      agents: [...componentPaths.agents],
      commands: [...componentPaths.commands],
      skills: [...componentPaths.skills],
      workflows: [...componentPaths.workflows],
    },
```

### The strict supported-convention resolver test (turn of line 101)

Modelled on `tests/domain/resolver.test.ts:1700-1721`:

```ts
test("WINV-01 implicit-by-convention populates componentPaths.workflows from <pluginRoot>/workflows/", async () => {
  // arrange
  const context = resolveContext(marketplaceRoot, {
    [pathUnderMarketplace("./local")]: "dir",
    [path.join(pathUnderMarketplace("./local"), "workflows")]: "dir",
  });

  // act
  const resolvedPlugin = await resolveStrict(pluginEntry({ source: "./local" }), context);

  // assert
  assert.strictEqual(
    resolvedPlugin.state,
    "installable",
    `notes if not: ${resolvedPlugin.notes.join(" / ")}`,
  );

  if (resolvedPlugin.state === "installable") {
    assert.deepStrictEqual(resolvedPlugin.componentPaths.workflows, ["workflows"]);
    assert.ok(resolvedPlugin.supported.includes("workflows"));
  }
});
```

### The install-level window test skeleton (D-109-07 half 2)

```ts
// tests/integration/workflow-kind-inversion.test.ts
// WINV-02: a workflow-bearing plugin installs on a plain install.
// D-109-06: and materializes nothing, because no workflows bridge exists yet.

test("WINV-02 / D-109-06: a workflow-bearing plugin installs with no --partial and writes no workflow artifact", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "workflow-inversion-"));
    try {
      // arrange -- seed <pluginRoot>/workflows/<script>, a skill, and the marketplace
      await seedWorkflowPlugin({ cwd, marketplaceRoot: path.join(cwd, "mp-src") });
      const { ctx, pi, notifications } = makeCtx();

      // act -- a plain install; NO partial flag
      await installPlugin({ ctx, pi, scope: "project", cwd, marketplace: "mp", plugin: "hello" });

      // assert -- WINV-02: it succeeded, cleanly, on the (installed) row
      const summary = notifications.map((n) => n.message).join("\n");
      assert.ok(summary.includes("(installed)"), summary);
      assert.ok(!summary.includes("(partially-available)"), summary);
      assert.ok(!summary.includes("--partial"), summary);
      assert.ok(!summary.includes("{workflows}"), summary);

      // assert -- D-109-06: the host engine's storage root does not exist.
      // Phase 111 inverts this half once bridges/workflows/ lands.
      await assert.rejects(stat(path.join(process.env.HOME ?? "", ".pi", "workflows")), {
        code: "ENOENT",
      });
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});
```

`seedWorkflowPlugin` is `seedHooksPlugin` from
`tests/integration/transaction-lifecycle-cascade.test.ts:63-123` with the
`hooks/hooks.json` write replaced by a `workflows/<name>.js` write; keep the
`skills/tool/SKILL.md` seed so the install stages something visible.

## State of the Art

| Old (before this phase) | New (after) | Impact |
|-------------------------|-------------|--------|
| `workflows` in `UNSUPPORTED_COMPONENT_KINDS` (#154, WDET-04) | `workflows` in both supported tuples | A workflow-bearing plugin installs on a plain `install` |
| `REASONS` = 44 members, tail `"workflows"` | 43 members | Every surviving token's index unmoved |
| `kindToReason` has three carve-outs (`lspServers`, `hooks`, `workflows`) | two (`lspServers`, `hooks`) | A stray `"workflows"` in a legacy record's `compatibility.unsupported` now renders `{unsupported component}`, not `{workflows}` |
| `componentPaths` is a triple | a quadruple | The Phase-111 seam exists |
| Three catalog states describe degradation | three describe clean install (two) and a mixed rejection (one) | The published contract matches behavior |

**Deprecated by this phase:** the `{workflows}` reason token and everything that
documents it. Nothing else.

## Runtime State Inventory

This phase renames no string that any runtime holds, but the kind's *meaning*
changes, and one stored field carries it.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | `state.json` per scope: `plugins.<name>.compatibility.unsupported` on any pre-existing record whose install predates this phase may contain the literal `"workflows"`, and `compatibility.supported` will not. [READ: `persistence/state-io.ts:164`, `orchestrators/plugin/install.ts:1203`] | **Code edit only, no data migration.** A stale `"workflows"` in `unsupported` renders `{unsupported component}` via `kindToReason`'s fall-through — truthful enough, and self-correcting on the next `update` / `reinstall`, both of which rewrite `compatibility` from a fresh resolve (`update.ts:1585`, `reinstall.ts:1399`). |
| Live service config | None. This extension registers nothing with an external service. | None — verified: no network surface in any file this phase touches. |
| OS-registered state | None. No task scheduler, no launchd, no pm2 registration exists in this project. | None — verified: `grep` for scheduler/registration surfaces in `extensions/` finds none. |
| Secrets / env vars | None. The only env vars in play are `HOME` / `PI_CODING_AGENT_DIR` / `TEST_CONCURRENCY`, none of which name a component kind. [READ: `.planning/codebase/STACK.md` §Configuration] | None. |
| Build artifacts | None. `tsconfig.json` is `noEmit: true`; there is no build step, no bundler, no compiled artifact carrying the kind name. [READ: `.planning/codebase/STACK.md`] | None. |
| **Load-time convergence (special)** | `orchestrators/reconcile/backfill.ts:343` calls `supportedSetGrew(record.compatibility.supported, resolved.supported)`. A pre-inversion `--partial`-installed workflow-bearing record has `installable: false`, so it **is** in the scan's population (`backfill.ts:267` returns early only on `installable === true`), and its resolved supported set now grows by `"workflows"` → the scan would reinstall it. [READ] | **No action, but record it.** The scan is gated by `state.lastReconciledExtensionVersion === EXTENSION_VERSION` (`backfill.ts:76`). `EXTENSION_VERSION` stays `0.18.1` through this phase, so an existing install's stamp already matches and the scan does not run. The convergence fires on the *next version bump*, by which time Phase 111 has landed and the reinstall materializes real workflow commands — which is WCONV-01's intent. Note this in the SUMMARY: **do not bump the version during the 109-111 window.** That is a second, independent reason for D-109-06's "cut no release before Phase 111 lands". |

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | everything | ✓ | v26.8.1 [MEASURED] | — |
| npm + `node_modules` in this worktree | `npm run check` | ✓ | real directory, not a symlink [MEASURED: all nine gates ran] | — |
| `features/workflows-spike` ref | prior-art reads | ✓ | `git show` succeeded [MEASURED] | — |
| `features/workflow-port-wip` ref | forward-contract read | ✓ | commit `3a338536` [MEASURED] | — |
| `fallow` | `npm run fallow` | ✓ | `^3.16.0`, ran all three sub-gates [MEASURED] | — |
| `pre-commit` + trufflehog | commit | assumed present | — | Worktree caveat applies: `SKIP=trufflehog` after a filesystem-mode scan (CLAUDE.md §Git) |
| Network | — | not needed | — | Nothing in this phase touches the network |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** none.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | `node:test` (Node 26.8.1 built-in), TypeScript stripped natively |
| Config file | none — configured through `package.json` scripts |
| Quick run command | `node --test <path/to/file.test.ts>` (< 5 s for the architecture files) |
| Full suite command | `npm test && npm run test:integration` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| WINV-01 | `workflows` absent from `UNSUPPORTED_COMPONENT_KINDS`, present in `SUPPORTED_COMPONENT_KINDS` | unit (tuple pin) | `node --test tests/architecture/hooks-foundation.test.ts` | ✅ (turn line 199-205; add the optional negative mirror beside line 207) |
| WINV-01 | `<pluginRoot>/workflows/` populates `componentPaths.workflows` | unit (owner) | `node --test tests/domain/resolver.test.ts` | ✅ (turn line 101; two new positive tests) |
| WINV-01 | manifest field lives in `SUPPORTED_COMPONENT_PATH_FIELDS` | unit | `node --test tests/domain/components/plugin.test.ts` | ✅ (green as-is; a positive assertion is discretionary) |
| WINV-02 | resolver arm flips to `installable` | unit | `node --test tests/domain/resolver.test.ts` | ✅ |
| WINV-02 | a plain `install` succeeds, no `--partial` | integration | `node --test tests/integration/workflow-kind-inversion.test.ts` | ❌ **Wave 0** |
| WINV-02 | no workflow artifact on disk (D-109-06 window) | integration | same file | ❌ **Wave 0** |
| WINV-03 | `REASONS` is 43, ordered | unit | `node --test tests/architecture/compat-01-no-expansion.test.ts` | ✅ (turn line 173 + the message) |
| WINV-03 | `REASONS.length === 43` (both pins) | unit | `node --test tests/architecture/notify-closed-set-locks.test.ts` and `node --test tests/shared/notify.test.ts` | ✅ (turn line 51 and line 5008) |
| WINV-03 | `kindToReason` no longer maps `workflows` | unit (owner) | `node --test tests/shared/probe-classifiers.test.ts` | ✅ (turn or drop line 266) |
| WINV-04 | the three states render the post-inversion bytes | architecture (byte-pair) | `node --test tests/architecture/catalog-uat.test.ts` | ✅ (turn lines 907/1211/1316 + the three doc blocks) |
| WINV-05 | no `docs/` prose claims workflow-bearing plugins degrade | manual read + the vocabulary guard's doc scan | `node --test tests/architecture/partial-vocabulary-guard.test.ts` | ✅ (partial coverage only — it scans `docs/output-catalog.md` for *retired vocabulary*, not for workflows prose) |

### Sampling Rate

- **Per task commit:** `node --test` on the single file the task touched.
- **Per wave merge:** `npm test` (the unit glob).
- **Phase gate:** `npm run check` green, then `/gsd-verify-work`.

### Wave 0 Gaps

- [ ] `tests/integration/workflow-kind-inversion.test.ts` — covers WINV-02 at
      install level (both halves of D-109-07 part 2). New file; no production
      pair required (`tests/integration/` is in `nonCorrespondingRoots`).
- [ ] No new framework, config, or fixture infrastructure needed. The
      `makeCtx` / `withHermeticHome` / `seed*Plugin` triple is copied from
      `tests/integration/transaction-lifecycle-cascade.test.ts`; that file
      declares its own local copies rather than importing shared helpers
      (`tests/helpers/` does not exist on this branch).

## Security Domain

`security_enforcement` is not set in `.planning/config.json`, so it is treated
as enabled.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | No auth surface is touched. |
| V3 Session Management | no | No sessions. |
| V4 Access Control | no | No principals. |
| V5 Input Validation | **yes** | `typebox` schemas in `domain/components/plugin.ts` (unchanged semantics — both bags are `Type.Optional(Type.Unknown())`) and `assertPathInside` in the resolver's `validateComponentPath` (`resolver.ts:990`), which now runs for a fourth kind. |
| V6 Cryptography | no | None involved. |
| V12 File and Resources | **yes** | `<pluginRoot>/workflows` becomes a probed and path-validated location. |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation | Status in this phase |
|---------|--------|---------------------|----------------------|
| **T-02-25 — a kind in neither closed set is silently ignored** | Tampering / Repudiation | Both sets are closed and audited; every kind must be in exactly one | **Directly engaged.** This is why D-109-06 rejects the split-tuple alternative. The plan must move the kind out of one tuple and into the other **in the same commit**; a commit where `workflows` is in neither set reintroduces the exact defect the security note at `resolver.ts:369-372` warns about. |
| NFR-10 — a declared component path escaping the plugin root | Tampering | `assertPathInside` inside `validateComponentPath` | **Newly applied to `workflows`.** A declared `workflows: "../../etc"` now routes through the same containment check as `skills` — a strict improvement over today, where the path is never validated because the kind is opaque. |
| Untrusted `meta.name` reaching `path.join` | Tampering | `assertPathInside` + `assertSafeName` in `workflowArtifactPath` | **Not in this phase.** No workflow script is read. The window is safe precisely because nothing is materialized. |
| Symlinked `<pluginRoot>/workflows` | Tampering | `statKind` returns the resolved kind; `assertPathInside` carries the D-14 all-symlink refusal | Unchanged behavior — the same probe already ran for the unsupported convention. |

**No new attack surface is opened.** The phase strictly *adds* path validation
to a location that previously received none, and materializes nothing.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `pre-commit` and its trufflehog hook are installed in this worktree | Environment Availability | A commit fails on a missing hook; recoverable — install and retry. I did not run `pre-commit` this session. |
| A2 | `mdformat` will not reflow the byte-pinned fenced blocks in `docs/output-catalog.md` | Pitfall 9 | If it does, `catalog-uat` goes red after a hook run. Detectable in one command; the existing 182 blocks survive today's hooks, which is indirect evidence it is safe. |
| A3 | SonarCloud CPD will not flag the byte-identical `workflow-install-success` fixture as a new duplication | Pitfall — gates | A Sonar PR quality-gate finding. `sonar.cpd.exclusions` already lists seven files as precedent for deliberate parallel structure [READ: `sonar-project.properties:49`]; `catalog-uat.test.ts` is not among them. Measured: `fallow dupes` does **not** flag it (840 duplicated lines before and after the fixture copy [MEASURED]), but Sonar uses a different engine and is not part of `npm run check`. |
| A4 | The `WDET-04` ledger line in `notify-closed-set-locks.test.ts` may stay despite the comment policy's ban on narrating removed code | Pitfall 6 | Low. D-109-02 locks it, and the ledger reads as running arithmetic rather than as a description of a removed shape. Worth one sentence in the SUMMARY explaining the reading. |
| A5 | No third catalog-state block elsewhere in the catalog will collide with the new State 2 bytes in a way a future gate cares about | The three catalog states | None today — I confirmed the pairing test imposes no uniqueness rule by reading it. Listed here because I did not exhaustively diff all 182 blocks against each other. |

## Open Questions

1. **Should `hooks-foundation.test.ts` gain the positive `UNSUPPORTED_COMPONENT_KINDS
   does NOT contain 'workflows'` mirror?**
   - What we know: the precedent exists at line 207 for `hooks`, the turned
     4-tuple test at line 199 already proves membership in the supported set,
     and the resolver owner test proves the behavior end to end.
   - What's unclear: whether the mirror adds signal or duplicates.
   - Recommendation: **take it.** It is two lines and it is the only assertion
     that would catch a future re-addition of `workflows` to the unsupported
     tuple while the supported tuple also keeps it — the "in both sets" state
     that neither of the other two tests can see.

2. **What becomes of `tests/shared/probe-classifiers.test.ts:266`?**
   - What we know: `narrowUnsupportedKinds(["workflows"])` will return
     `["unsupported component"]` after the change [MEASURED].
   - What's unclear: whether to turn it (assert the fall-through) or delete it.
   - Recommendation: **turn it, retitled** — e.g. "WINV-03: a stray `workflows`
     kind in a legacy record falls through to `unsupported component`". That is
     a real behavior (see Runtime State Inventory) and turning rather than
     deleting matches WINV-04's spirit. Deleting it would be the "proved by an
     absence" the requirement forbids.

3. **Which id for catalog State 1?**
   - What we know: D-109-05's examples say `workflow-installed-inventory`;
     D-109-04 item 1 specifies the not-installed row, which renders `(available)`.
   - Recommendation: `workflow-available-inventory`. The ids are explicitly
     "e.g." in D-109-05.

## Sources

### Primary (HIGH confidence — measured in this session)

- `npm run typecheck` under the applied change — 131 errors, zero in `extensions/`
- `npm test` under the applied change — the five red files and their exact assertions
- `npm run test:integration` under the applied change — 31 pass, 0 fail
- `npm run lint` under the applied change — exit 0
- `npm run fallow` under the applied change — `dead-code ✓ No issues found`;
  `health ✗ 0 above threshold` (informational glyph, exit 0); `dupes 840 lines
  (1.2%)`, exit 0
- `npm run test:corresponding`, `test:corresponding:negative`,
  `test:coverage:direct:negative` under the applied change — all passed
- `node --test <file>` per-file baselines and reds (tables above)
- A scratch driver calling the real `notify()` and `narrowUnsupportedKinds` to
  capture the three post-inversion byte blocks
- A scratch driver calling the real `resolveStrict` / `resolveLoose` before and
  after, to produce the verdict table
- `HOME=/tmp/fakehome node -e "console.log(require('os').homedir())"`

### Primary (HIGH confidence — read in this session)

- `extensions/pi-claude-marketplace/domain/resolver.ts` (lines 62-72, 160-235,
  340-440, 990-1057, 1406-1424, 1575-1680)
- `extensions/pi-claude-marketplace/domain/components/plugin.ts:1-80`
- `extensions/pi-claude-marketplace/shared/notify.ts:180-260, 83, 930, 1778`
- `extensions/pi-claude-marketplace/shared/notify-reasons.ts` (header + full tail)
- `extensions/pi-claude-marketplace/shared/probe-classifiers.ts:60-240`
- `extensions/pi-claude-marketplace/orchestrators/reconcile/backfill.ts:70-120,
  155-200, 255-360, 454-461`
- `extensions/pi-claude-marketplace/orchestrators/plugin/info.ts:630-690, 1894-1905`
- `extensions/pi-claude-marketplace/orchestrators/plugin/install.messaging.ts:405-430`
- `extensions/pi-claude-marketplace/shared/errors.ts:518-535`
- `tests/architecture/catalog-uat.test.ts` (fixture map header, the three
  workflow fixtures, `CATALOG_STATE_RE`, the pairing and inverse-walk tests)
- `tests/architecture/compat-01-no-expansion.test.ts:150-185`
- `tests/architecture/notify-closed-set-locks.test.ts:1-80`
- `tests/architecture/hooks-foundation.test.ts:199-211`
- `tests/architecture/partial-vocabulary-guard.test.ts:1-60`
- `tests/shared/notify.test.ts:4933-5010`
- `tests/domain/resolver.test.ts:80-130, 240-330, 855-887, 1696-1725, 3100-3127`
- `tests/integration/transaction-lifecycle-cascade.test.ts:1-235`
- `tests/orchestrators/plugin/install.test.ts:300-330`
- `scripts/check-corresponding-tests.mjs:1-120`
- `docs/output-catalog.md` (lines 55-70, 143-150, 176-250, 420-450, 490-525,
  555-585, 605-650, 1940-1955)
- `package.json` scripts, `.fallowrc.json`, `sonar-project.properties:49`
- `.claude/rules/typescript-comments.md`, `.claude/rules/changelog.md`
- `git show features/workflows-spike:extensions/.../{resolver.ts,components/plugin.ts,platform/workflow-home.ts}`
- `git show features/workflow-port-wip:extensions/.../bridges/workflows/{stage,discover}.ts`
  and the `persistence/locations.ts` diff
- `.planning/workstreams/workflows/{REQUIREMENTS.md,STATE.md,port/README.md}`
- `.planning/workstreams/workflows/phases/109-kind-inversion/109-CONTEXT.md`

### Secondary / Tertiary

None. No web search, no external documentation, and no package registry lookup
was needed — the phase is entirely in-repo.

## Metadata

**Confidence breakdown:**

- Standard stack: **HIGH** — there is none to get wrong; no package changes.
- Blast radius: **HIGH** — enumerated by the compiler and the test runner, not
  by grep. Both the visible (131 typecheck) and invisible (~10 runtime) sets
  were measured.
- Catalog bytes: **HIGH** — produced by driving the real renderer, not composed
  by hand.
- Resolver verdicts: **HIGH** — produced by driving the real resolver before and
  after.
- Gate hazards: **HIGH for `npm run check`** (all nine gates run under the
  change); **MEDIUM for SonarCloud CPD** (a different engine, outside the
  local gate — see A3).
- Documentation sweep: **HIGH** — every tracked non-planning markdown file
  counted and every hit read.
- Runtime state inventory: **HIGH** for the five standard categories;
  **HIGH (read, not run)** for the backfill convergence note — I read the
  version gate and the `installable` filter but did not drive a reconcile.

**Research date:** 2026-09-04
**Valid until:** stable — the findings are pinned to files in this repository at
commit `dfd117d3`. Re-measure only if `features/workflow` advances before
planning.
