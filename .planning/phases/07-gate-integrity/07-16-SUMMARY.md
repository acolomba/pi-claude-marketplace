---
phase: 07-gate-integrity
plan: 16
subsystem: testing
tags: [architecture-gates, target-registry, meta-gate, composed-targets, d-07-05, d-07-06, d-07-07, ggat-01]

requires:
  - phase: 07-gate-integrity
    provides: "tests/architecture/gate-targets.ts — the literal target registry as waves 2 through 5 left it"
  - phase: 07-gate-integrity
    provides: "tests/architecture/temp-root-control.ts — withTempRoot / materializeTargets / plantOffender / plantBenignNearMiss"
  - phase: 07-gate-integrity
    provides: "tests/architecture/source-scan.ts — REPO_ROOT and stripComments"
  - phase: 07-gate-integrity
    provides: "the literal census in 07-02-SUMMARY.md and the composed-target census in 07-06-SUMMARY.md"
provides:
  - "two enforcement rules over tests/architecture/** that make the registry self-hosting, each observed failing on a real offender before it was closed"
  - "a cross-instrument corroboration clause: every path the registry exports at runtime must be visible to the literal scan the rules run"
  - "the re-measured literal and composed censuses over all 74 gate-corpus files, with every row of both resolved"
  - "the fired-controls ledger for every gate this phase created or modified"
affects: [gate-integrity, architecture-gates]

actuals:
  tokens: 4983
  tasks: 3
  commits: 2
  plan_head_before: 5a250bb5fc544a27fe7ac1b94e4397ce1e339640

tech-stack:
  added: []
  patterns:
    - "Registry membership as the naming rule's anchor: a production literal outside the registry module is an offender when the registry does not carry that exact path, because that is precisely the condition under which one literal scan of one file stops seeing every guarded target"
    - "Segment-keyed assembly rule: the offence is a bare `.ts` module NAME joined onto a root, not the presence of `path.join`, so the shared scan mechanic is exonerated by a case rather than by an exclusion"
    - "Cross-instrument corroboration: the registry's runtime-exported values are compared against a text scan of the same file, so a blinded extractor fails loudly instead of greening every clause it feeds"

key-files:
  created: []
  modified:
    - tests/architecture/gate-targets.test.ts
    - tests/architecture/gate-targets.ts
    - tests/architecture/hooks-dispatch.test.ts

key-decisions:
  - "The naming rule's anchor is registry MEMBERSHIP, not a type annotation. Two of the five remaining second references live only as keys of UNOWNED_EXPORT_CENSUS, a path-keyed Record with no `[number]` form to annotate against, so requiring the annotation is impossible for them. Membership is exactly what D-07-05 promises: one literal scan of one file sees every guarded target."
  - "The assembly rule keys on the SEGMENT, not on path.join. 350 composition sites exist repo-wide and fewer than 20 hide a target name; a bare `.ts` basename joined onto a root is the only shape a literal-match scan cannot see. `path.join(scanRoot, rel)` and `path.join(ROOT, <whole literal>)` both stay, and a dedicated case materializes source-scan.ts and proves the rule does not fire on it."
  - "Two exclusions, not three. The plan's acceptance criterion named temp-root-control.ts as a third; measurement shows it carries no production literal and no `.ts` literal inside any composition, so excluding it would be a dead exclusion. T-07-49 and the plan's own prohibition both say the exclusion list must not grow, and a dead entry is how such a list starts."
  - "The test-path question is answered NEITHER way: no registry section and no exemption list. Rule one's pattern reaches only paths beginning `extensions/pi-claude-marketplace/`, so a `tests/` literal is out of scope by construction. Rule two does police a `.ts` segment regardless of tree, because a bare basename carries no evidence of which tree it lands in — its remedy names the inline whole-path form for test targets."
  - "The assembly rule's `.ts` scope leaves composed production DIRECTORY names uncaught, and that is recorded rather than papered over. A directory root cannot go stale silently: renaming `extensions/pi-claude-marketplace` breaks every import in the repository, which is a louder failure than a gate can produce."

requirements-completed: [GGAT-01, GGAT-03, GGAT-04]

coverage:
  - id: D1
    description: "A production path named anywhere under tests/architecture/** that the registry does not carry fails a gate that has been observed to fire"
    requirement: GGAT-01
    verification:
      - kind: unit
        ref: "tests/architecture/gate-targets.test.ts#D-07-06: no gate file names a production path the registry does not carry"
        status: pass
      - kind: unit
        ref: "tests/architecture/gate-targets.test.ts#the naming rule reports a production path planted outside the registry"
        status: pass
      - kind: other
        ref: "observed RED against the real tree: `partial-vocabulary-guard.test.ts names extensions/pi-claude-marketplace/edge/completions/provider.ts`; closed by registering COMPLETION_DESCRIPTION_TARGETS"
        status: pass
    human_judgment: false
  - id: D2
    description: "A production module name assembled from segments anywhere under tests/architecture/** is an offender, and the shared scan mechanic is not"
    requirement: GGAT-01
    verification:
      - kind: unit
        ref: "tests/architecture/gate-targets.test.ts#D-07-06: no gate file assembles a production module name from segments"
        status: pass
      - kind: unit
        ref: "tests/architecture/gate-targets.test.ts#the assembly rule does not report the shared scan mechanic itself"
        status: pass
      - kind: other
        ref: "observed RED against the real tree: `hooks-dispatch.test.ts assembles hooks.ts`; closed by re-pointing the read at HOOKS_SCHEMA_TARGETS"
        status: pass
    human_judgment: false
  - id: D3
    description: "Module specifiers and comments are excluded from both rules, with the reason recorded in the source"
    requirement: GGAT-01
    verification:
      - kind: unit
        ref: "tests/architecture/gate-targets.test.ts#neither rule reports the same production path carried inside a comment"
        status: pass
      - kind: command
        ref: "the naming pattern anchors on `extensions/` or `./extensions/`, so a `../`-prefixed specifier cannot match; rationale written into namedProductionPaths' doc block"
        status: pass
    human_judgment: false
  - id: D4
    description: "The meta-gate's zero-offender result is corroborated by an instrument other than the scan it runs"
    requirement: GGAT-01
    verification:
      - kind: unit
        ref: "tests/architecture/gate-targets.test.ts#T-07-48: every production path the registry exports is visible to a literal scan of it"
        status: pass
      - kind: other
        ref: "blinded-extractor control: PRODUCTION_PATH_LITERAL re-pointed at a non-existent root → 5 of 14 cases failed, including this one with `the literal scan of the registry module found nothing`; restored, 14 pass"
        status: pass
    human_judgment: false
  - id: D5
    description: "Every literal and every composition from the phase's starting tree is accounted for against both censuses"
    requirement: GGAT-01
    verification:
      - kind: other
        ref: "re-measured over all 74 .ts files under tests/architecture/**: 20 production literals outside the registry (2 of them in the meta-gate itself), every one registry-carried; 1 `.ts`-segment composition, closed; both census tables reproduced below with every row resolved"
        status: pass
    human_judgment: false
  - id: D6
    description: "The whole quality chain is green and every gate this phase touched has a fired control"
    requirement: GGAT-03
    verification:
      - kind: command
        ref: "npm run check → exit 0; npm test → 5949 pass / 0 fail; npm run test:integration → 32 pass / 0 fail; npm run test:coverage:direct:negative → exit 0"
        status: pass
      - kind: other
        ref: "fired-controls ledger below: 14 gate rows, 13 with a named planted offender and an observing command; the one exception is named with its reason"
        status: pass
    human_judgment: false
  - id: D7
    description: "The four roadmap success criteria are each answered with a named command and a named SUMMARY"
    requirement: GGAT-04
    verification:
      - kind: other
        ref: "criterion-by-criterion table below; each row names the command run this cycle and the SUMMARY that records the work"
        status: pass
    human_judgment: false

duration: 80min
completed: 2026-09-10
status: complete
---

# Phase 7 Plan 16: Self-Hosting Target Registry Summary

**The registry now enforces itself: two rules scan the 72 other files of the gate corpus, and both were watched failing on real offenders they found — a completion-description module no registry group carried, and a hooks component path still assembled segment by segment — before either was closed.**

## Performance

- **Duration:** 80 min
- **Tasks:** 3 of 3
- **Files modified:** 3 (0 created)

## Task Commits

1. **Task 1: the two enforcement rules, their controls, and the two migrations that closed the offenders they found** — `f7997ff9` (test)
2. **Task 2: the cross-instrument corroboration clause** — `f677bff4` (test)
3. **Task 3: close the phase on the full chain** — no code change; its evidence is this SUMMARY and the commit that carries it.

`plan_head_before` is `5a250bb5`. `git rev-list 5a250bb5..HEAD --count` reports **2**, and `git log --oneline --grep='(07-16)' | wc -l` agrees: this is the only executor running, so the range is uncontaminated.

## The Two Rules, and Why They Are Shaped This Way

### Rule one — a production path the registry does not carry

Over every `.ts` file under `tests/architecture/**` except the registry and this gate, strip comments and find every string literal beginning `extensions/pi-claude-marketplace/` or `./extensions/pi-claude-marketplace/`. Each such literal is an offender **unless the registry module spells the same path as a literal.**

Membership rather than absence is the load-bearing choice, and it was forced by measurement. Of the 18 production literals outside the registry today, **13 are already compile-anchored** — declared `(typeof GROUP)[number]` or `ReadonlyArray<(typeof GROUP)[number]>`, so the compiler rejects a path the named group does not carry. That idiom is what `07-02` established and `07-04`, `07-05`, `07-07` and `07-13` adopted; forbidding it outright would have broken thirteen compile-checked references and pushed them into a weaker form.

The remaining **5** live in `partial-vocabulary-guard.test.ts` and are plain literals. Requiring the annotation of them is not merely inconvenient — it is impossible. Two of the three paths they name (`edge/completions/data.ts`, `edge/flag-catalog.ts`) reach the registry only as keys of `UNOWNED_EXPORT_CENSUS`, and `07-15` made that a path-keyed `Readonly<Record<...>>` precisely because the meta-gate stats every array-valued export. A `Record` has no `[number]` form to annotate against.

So the anchor is membership, which is exactly what `D-07-05` promises: *one literal scan of one file sees every guarded target*. The annotation is the stronger property on top, carried voluntarily by 13 of 18 sites; the failure message names it as the sanctioned repair.

**The exclusion for module specifiers is structural, not a list.** A relative specifier begins `../`, and the pattern anchors at `extensions/` — so it cannot match one. The reason is recorded beside the extractor: a stale specifier breaks `npm run typecheck` or throws at import time, which is louder and earlier than any gate. **Comments are stripped** for the reason every scanning clause in this tree strips them: a file header legally names the path it guards.

### Rule two — a production module name assembled from segments

Over the same file set, find every `path.join` / `path.resolve` call carrying a `.ts`-suffixed string literal that is **not** a whole repository-relative path. Each is an offender.

`07-06` measured the fact this rule had to be built on: **350 composition sites exist across 33 of the 70 files it scanned, and fewer than 20 hide a production target name.** `path.join(ROOT, rel)` where `rel` is a whole literal is `source-scan.ts:106` — the mechanic every gate in this phase runs on. Keying on `path.join` would have fired the meta-gate on its own foundation.

The discriminator is therefore the **segment**: a bare `"install-flow.ts"` joined onto a root produces a path that appears nowhere as text, which is the only shape a literal-match scan cannot see. A whole literal inside a join is rule one's business; a variable is the mechanic. **A dedicated case materializes `source-scan.ts` into a temp root, asserts it still carries `path.join(scanRoot, rel)`, and asserts zero offenders** — the exoneration is a case, not an exclusion.

### Exclusions: exactly two, both exact paths

```
grep -c "EXCLUDED\|SELF" tests/architecture/gate-targets.test.ts  →  2
tests/architecture/gate-targets.test.ts:340:    .filter((rel) => rel !== REGISTRY_REL && rel !== SELF_REL)
```

The registry, because it IS the sanctioned declaration site. This gate, because its controls must carry the offender text they plant. Both are exact strings and not a pattern, because a pattern is an allow-list that grows — the `T-07-49` failure.

**The plan's acceptance criterion named a third, `temp-root-control.ts`. It was not added, and the reason is measured:** that module joins a caller-supplied root with a caller-supplied relative path and carries no production literal and no `.ts` literal inside any composition. It is not an offender under either rule, so excluding it would be a dead exclusion — and a dead exclusion is how an exclusion list starts growing. The plan's own `prohibitions` block says the only exclusions are the registry and the meta-gate; that reading was taken over the acceptance criterion's.

## Controls Observed

All five plant/benign controls, plus the blinded-extractor control, were run this cycle.

| # | Control | Observed |
|---|---------|----------|
| 1 | **Literal offender.** A production path derived at plant time from the registry's first sorted `.ts` entry, mutated to `.../renamed-out-from-under-the-registry.ts`, appended as `const probe = "<path>";` to a temp-root copy of the real `no-orchestrator-network.test.ts` | rule one reports exactly `no-orchestrator-network.test.ts names <derived path>`; rule two reports nothing |
| 2 | **Composed offender.** `const probe = path.join(PLUGIN_ORCHESTRATORS_REL, "<basename of a real registry entry>");` appended to the same copy | rule two reports exactly `no-orchestrator-network.test.ts assembles <basename>`; rule one reports nothing |
| 3 | **Unmutated benign.** The same file materialized and left alone | both rules report nothing; `visited` is exactly the one file |
| 4 | **Comment near-miss.** The same derived production path appended as `// <path>` | both rules report nothing |
| 5 | **The mechanic.** `source-scan.ts` materialized unmutated | rule two reports nothing, and the case first asserts the file still carries `path.join(scanRoot, rel)` so it cannot pass by having lost its subject |
| 6 | **Blinded extractor** (T-07-48). `PRODUCTION_PATH_LITERAL` re-pointed at `extensions/pi-claude-marketplace-NOPE/` | **5 of 14 cases failed**, including `T-07-48 … the literal scan of the registry module found nothing`, both plant controls, and rule one's own case. Restored: 14 pass, 0 fail |

Control 1 and control 2 both **derive** their offender from a real registry entry rather than hard-coding one, in the `offenderLineFor` shape `07-05` established, and each derivation asserts loudly if it fails to produce something the rule should catch (`the derived offender … is itself registered, so planting it would prove nothing`).

Control 6 is the answer to `T-07-48`. A zero-offender result is consistent with total compliance and with a rule that matches nothing; the corroboration clause reads every path the registry **exports at runtime** — array group entries, named scalars, and the keys of the path-keyed record, all from `Object.values(registry)` — and requires each to be visible to the text scan. Two instruments over one file, so a blinded extractor cannot green the suite.

## The Two Offenders Found, and How They Were Closed

Both rules were RED against the real tree on first run. This is the observed output:

```
✖ D-07-06: no gate file names a production path the registry does not carry
    tests/architecture/partial-vocabulary-guard.test.ts names extensions/pi-claude-marketplace/edge/completions/provider.ts
✖ D-07-06: no gate file assembles a production module name from segments
    tests/architecture/hooks-dispatch.test.ts assembles hooks.ts
```

**Offender one.** `partial-vocabulary-guard.test.ts` scans three completion-description modules; two of them reach the registry as `UNOWNED_EXPORT_CENSUS` keys, and `edge/completions/provider.ts` was in no group at all. Closed by registering `COMPLETION_DESCRIPTION_TARGETS` — the single registry write Task 2 authorises — holding all three, so the obligation has one home rather than two accidental ones.

**Offender two.** `hooks-dispatch.test.ts` built its target as `path.join(process.cwd(), "extensions", "pi-claude-marketplace", "domain", "components", "hooks.ts")`. `07-06`'s census recorded this row as *owned by `07-07`*; `07-07` did not migrate it, and it is the one row of that census that reached this plan unresolved. Closed by importing `HOOKS_SCHEMA_TARGETS` and declaring `HOOKS_COMPONENT_REL: (typeof HOOKS_SCHEMA_TARGETS)[number]`, with the sibling extension-root join re-pointed at `REPO_ROOT` + `EXTENSION_ROOT_REL` in the same edit. Both of the file's own cases still pass.

## Two-Census Reconciliation

### The literal census (`07-02`: 89 literals across 24 files)

Re-measured this cycle over all **74** `.ts` files under `tests/architecture/**` (47 are `*.test.ts`), of which **72** are scanned once the registry and this gate are excluded. The registry itself now spells **173 production-path literal occurrences, 111 distinct**. Outside it, **20** remain across 7 files — 2 of them inside this gate, which is excluded:

| File | Literals | What each one is now |
|------|----------|----------------------|
| `no-test-only-production-surface.test.ts` | 6 | `(typeof NETWORK_FREE_TARGETS)[number]` ×4, `(typeof MARKETPLACE_LEDGER_TARGETS)[number]` ×2 |
| `partial-vocabulary-guard.test.ts` | 5 | plain literals, all registry-carried: `plugin/info.ts` ×1, `COMPLETION_DESCRIPTION_TARGETS` ×4 |
| `eslint-effective-config.test.ts` | 3 | `(typeof NO_CONSOLE_EXEMPT_TARGETS)[number]` ×1, `(typeof ZONE_REPRESENTATIVE_TARGETS)[number]` ×2 |
| `compat-01-no-expansion.test.ts` | 2 | `ReadonlyArray<(typeof NETWORK_FREE_TARGETS)[number]>` |
| `hooks-dispatch.test.ts` | 1 | `(typeof HOOKS_SCHEMA_TARGETS)[number]` — added by this plan |
| `import-boundaries.test.ts` | 1 | `(typeof ZONE_REPRESENTATIVE_TARGETS)[number]` |
| `gate-targets.test.ts` | 2 | this gate's own resolution-control fixtures; excluded by exact path |

**13 compile-anchored + 5 registry-carried = 18, and zero unaccounted.** Every literal that existed at phase start is now one of: a registry entry, a compile-anchored second reference, a registry-carried plain second reference, a module specifier (which the pattern cannot reach, deliberately), or a comment (stripped). The claim is not an argument — it is the gate's own zero-offender result over 72 files, corroborated by the `T-07-48` clause.

`07-02`'s per-file table is superseded for every row: the 24 files it listed have all been migrated by `07-04`, `07-05`, `07-06`, `07-07`, `07-14` or this plan.

### The composed census (`07-06`: 350 sites across 33 files)

Every "production composer" row re-checked against the tree as it stands. **The measured `.ts`-segment count over all 74 files is now 0.**

| `07-06` row | Disposition, verified this cycle |
|-------------|----------------------------------|
| `hooks-lifecycle.test.ts` — 5 named + 1 walk | migrated by `07-06`; 0 segments today |
| `import-boundaries.test.ts` — 40 zone + 9 ledger | owned by `07-07`; 0 segments today. Its `` `import { x } from "../plugin/${name}.ts";` `` templates are ESLint **module specifiers synthesised as offender input** (the `D-07-08` per-name control), not target paths — out of scope by the module-specifier rule |
| **`hooks-dispatch.test.ts`** — `domain/components/hooks.ts` + the extension-root walk | **routed to `07-07` and NOT migrated. Closed by this plan.** The one open row of the census |
| `partial-vocabulary-guard.test.ts` | owned by `07-14`; 0 `.ts` segments today |
| `config-state-write-seams`, `manifest-read-seam`, `no-shell-out` | `07-04` / `07-05`; extension-root walk roots now from the registry |
| `no-split-01-cast-reads`, `scope-order-drift`, `no-hooks-strict-additional-properties` | `07-05`; 0 segments today |

**No row is left open.** The non-production classifications `07-06` recorded were also re-measured, and two need their reclassification stated explicitly rather than inherited:

1. **Directory roots re-spelled as segments — 1 site remains.** `partial-vocabulary-guard.test.ts:58` still writes `path.join(REPO_ROOT, "extensions", "pi-claude-marketplace")`; the identical site in `hooks-dispatch.test.ts` was re-pointed at `EXTENSION_ROOT_REL` by this plan. **Classified out of the assembly rule's scope, with evidence:** the product is a directory root, not a target file name, and the registry carries it literally as `EXTENSION_ROOT_REL`. A root cannot go stale silently — renaming `extensions/pi-claude-marketplace` breaks every import in the repository, which is a louder failure than a gate can produce. This is style residue, not the invisibility criterion 4 names.
2. **Template zone composition — 3 sites in `eslint-effective-config.ts`.** `` `${EXTENSION_ROOT_REL}*.ts` ``, `` `./${EXTENSION_ROOT_REL}/shared` ``, `` `./${EXTENSION_ROOT_REL}/edge` ``. **Same classification:** each is built *from* a registry constant, and each product (`./extensions/pi-claude-marketplace/shared`, `.../edge`) is itself a literal `ZONE_FOLDER_TARGETS` already carries, so the registry scan still sees it. One is an ESLint glob, not a path at all.
3. **A composed production path whose contract is that it does NOT resolve — 1 site.** `scope-fences-63.test.ts:66` composes `` `${EXTENSION_ROOT_REL}/commands/plugin` ``. Neither rule reaches it (a template, and not a `.ts` name), which is the right outcome here: the gate's whole assertion is that the historical directory is absent, so "going stale" is its steady state. See the declined registry addition below.

### The `.mjs` gate scripts keep their own censuses, by design

`scripts/check-corresponding-tests.mjs` and `scripts/test-coverage-direct.mjs` each carry their own path handling and read **nothing** from `tests/architecture/gate-targets.ts`. `D-07-07` scopes the registry to `tests/architecture/**` because a `.mjs` module cannot import a `.ts` one. Recorded here so a later reader does not assume one registry covers both — `scripts/test-coverage-direct.mjs:151` mirrors `check-corresponding-tests.mjs`'s `nonCorrespondingRoots` set independently, and that duplication is the accepted cost of the language boundary.

## Registry Totals

| Quantity | Count |
|----------|-------|
| Array-valued groups | **24** |
| Entries across those groups | **121** |
| Entries that resolve on disk | **117** |
| `MISSING_TARGET_PROBES` — deliberately non-resolving | **4** |
| Named scalars typed `(typeof GROUP)[number]` | **11** |
| Path-keyed records | **1** (`UNOWNED_EXPORT_CENSUS`) |
| Census files / pinned export names | **59 / 100** |
| Production-path literal occurrences in the registry source | **173** (111 distinct) |

Against `07-02`'s close (22 groups / 117 entries / 10 scalars): **+2 groups, +4 entries, +1 scalar.** `EVIDENCE_RECORD_TARGETS` (1 entry) and `FINDING_DISPOSITIONS_REL` came from `07-15`; `COMPLETION_DESCRIPTION_TARGETS` (3 entries) is this plan's single registry write.

**The census pin still reads 100** (`extensions/` 89 + `scripts/` 11) across 59 files — `tests/architecture/unowned-exports-census.test.ts` passes unchanged. This plan added an array group, not a census key, so no delta was possible.

## Registry Additions Deferred to This Plan

Six plans routed additions here. Each is adopted or declined explicitly.

| Request | From | Disposition |
|---------|------|-------------|
| A group for historical paths whose contract is that they do NOT resolve (`extensions/pi-claude-marketplace/commands/plugin`) | `07-02`, `07-04` | **Declined.** `07-02`'s reason still holds and this plan depends on it: the resolution clause partitions groups binarily (`registryGroups().filter(name !== MISSING_TARGET_PROBES)`), and a second must-not-resolve group breaks that partition. Measured additionally: the site composes a template, not a whole literal, and names no `.ts`, so neither new rule reaches it — there is no gate pressure to add it. |
| `orchestrators/marketplace` as a directory root | `07-07` | **Declined.** No file under `tests/architecture/**` names that path as a literal today, so the group would have no consumer and no offender to catch. Adding a root nothing asks for dilutes the single scan point. |
| A `NO_CONSOLE_PROBE_TARGETS` pair (currently borrowing `ZONE_REPRESENTATIVE_TARGETS`) | `07-07` | **Declined.** A relabel with no gate consequence: the three probes are already compile-anchored into a resolution-checked group, so the compiler rejects drift today. Group names carry obligations, and "a representative extension module" is the obligation these three actually serve. |
| Repository-relative forms behind the two non-ledger negative-control specifiers | `07-07` | **Declined.** Those specifiers are synthesised ESLint *input*, not targets the gate opens; rule one's structural specifier exclusion covers them, and registering them would assert a resolution obligation the gate does not have. |
| `PLUGIN_INFO_REL`, `MARKETPLACE_INFO_REL`, `LIFECYCLE_ENABLED_READ_CONTROL_TARGET` | `07-05` | **Declined.** All three paths are already registry entries; these are naming conveniences for their consumers, and the consumers already anchor them with `(typeof GROUP)[number]`. Neither rule reports them. |
| `orchestrators/plugin/reinstall-replace.ts` in no group; `CLASSIFIED_KEPT_SEAM_TARGETS`; `TEST_ONLY_SURFACE_CONTROL_TARGETS` | `07-13` | **Declined.** `reinstall-replace.ts` **is** in the registry — as a `UNOWNED_EXPORT_CENSUS` key — so rule one is satisfied and the meta-gate reports nothing. The two proposed groups would restate memberships the existing groups already carry. |
| Completion-description modules (`edge/completions/provider.ts` absent entirely) | found by this plan's own rule | **ADOPTED** as `COMPLETION_DESCRIPTION_TARGETS`, 3 entries. The only registry write in this wave. |
| **The test-path question:** registry section, or meta-gate exemption? | `07-05`, `07-14` | **DECIDED: neither.** Rule one's pattern reaches only `extensions/pi-claude-marketplace/…`, so `compat-01-no-expansion.test.ts:111`'s literal `tests/architecture/gate-targets.ts` and `07-14`'s ten policed `tests/` root names are out of scope *by construction* — no exemption entry needed, and none added. This gate names `no-orchestrator-network.test.ts` and `source-scan.ts` as whole literals for the same reason, and says so in the source. Rule two **does** police a `.ts` segment regardless of tree, because a bare basename carries no evidence of which tree it lands in; its remedy names the inline whole-path form as the sanctioned repair for a test target. |

## Fired-Controls Ledger

One row per gate this phase created or modified. `CONVENTIONS.md` states the rule plainly — a gate wants a test that plants the violation, not one that reads the config.

| Gate | Plan | Planted offender | Observing command | Recorded in |
|------|------|------------------|-------------------|-------------|
| `no-orchestrator-network.test.ts` | 07-01 | a `gitOps` surface written into a temp-root copy of a real target | `node --test tests/architecture/no-orchestrator-network.test.ts` | `07-01-SUMMARY.md` §Negative Controls Observed |
| `gate-targets.test.ts` (registry clauses) | 07-02 | a non-resolving entry appended to `NETWORK_FREE_TARGETS`; `NETWORK_FREE_TARGETS` emptied to `[]` | `node --test tests/architecture/gate-targets.test.ts` | `07-02-SUMMARY.md` §Negative Controls Observed |
| `scripts/test-coverage-direct.negative.mjs` (base selection) | 07-03 | four planted git states: chain head with no `origin/main`, chain tail in a shallow clone, resolved-but-empty docs-only change set, failed selection outside a repository | `npm run test:coverage:direct:negative` | `07-03-SUMMARY.md` |
| six re-pointed gates (manifest, credential, config-seam, shell-out, disabled-state, scope-fence) | 07-04 | twelve controls — shortened read sets and reordered basename pins | per-file `node --test` | `07-04-SUMMARY.md` §Negative Controls Observed |
| seven re-pointed gates incl. `no-lifecycle-default-enabled-read.test.ts` | 07-05 | a declared-enablement read derived from the target's own first `const` binding at plant time; the injected root removed | `node --test tests/architecture/no-lifecycle-default-enabled-read.test.ts` | `07-05-SUMMARY.md` |
| seven visitation-assertion gates incl. `hooks-lifecycle.test.ts` | 07-06 | six planted controls, one per new assertion | per-file `node --test` | `07-06-SUMMARY.md` §Negative Controls Observed |
| `eslint-effective-config.test.ts` | 07-07 | three offender configs (`BLANKET_NO_CONSOLE_OFF`, `ZONE_SUBSTITUTION`, `RESTRICTED_PATHS_OFF`) via `overrideConfig` | `node --test tests/architecture/eslint-effective-config.test.ts` | `07-07-SUMMARY.md` |
| `import-boundaries.test.ts` | 07-07 | one appended block; a derived ledger-name count | `node --test tests/architecture/import-boundaries.test.ts` | `07-07-SUMMARY.md` §Negative control 1 / 2 |
| `closed-set-enrollment.test.ts` | 07-08 | `"Notification"` planted in the `ClaudeHookEvent` union (TS2344) and in `BUCKET_A_EVENTS` (TS2322) | `npx tsc --noEmit` | `07-08-SUMMARY.md` §Observed Gate Negative Controls |
| hooks required-field oracle | 07-09 | `SessionStart: ["text"]`, `SessionStart: ["reason"]`, `UserPromptSubmit: []` | `node --test` on the hooks gate | `07-09-SUMMARY.md` §Negative controls observed |
| `markers-snapshot.test.ts` | 07-11 | **none — see below** | — | `07-11-SUMMARY.md` |
| `no-test-only-production-surface.test.ts` | 07-13 | `readonly __probeMember?: string` planted into a copy of a real module, plus further members | `node --test tests/architecture/no-test-only-production-surface.test.ts` | `07-13-SUMMARY.md` §Observations |
| `partial-vocabulary-guard.test.ts` | 07-14 | `// force-installed` appended to the real `tests/bridges/skills/stage.test.ts` → exactly one clause failed | `node --test tests/architecture/partial-vocabulary-guard.test.ts` | `07-14-SUMMARY.md` |
| `unowned-exports-census.test.ts` | 07-15 | `export const CENSUS_DRIFT_PROBE` appended to `shared/markers.ts` | `node --test tests/architecture/unowned-exports-census.test.ts` | `07-15-SUMMARY.md` |
| `gate-targets.test.ts` (meta-gate) | **07-16** | literal offender, composed offender, unmutated benign, comment near-miss, mechanic control, blinded extractor — all six above | `node --test tests/architecture/gate-targets.test.ts` | this SUMMARY §Controls Observed |

**`hooks-dispatch.test.ts`** was modified by this plan but adds no assertion — its two existing cases were re-pointed at the registry and both still pass. The class it belongs to is proved by the meta-gate's composed control, which is what caught it.

**`markers-snapshot.test.ts` is the one gate row with no planted offender, and that is a gap rather than an exemption.** `07-11`'s change there was a *deletion* of duplicated byte pins, not a new assertion, and `07-11` recorded honestly that no gate names the five surviving literals by value — the control is structural and indirect. **Not fixed here:** the file is outside this plan's `files_modified`. See Open Items.

**`07-10` and `07-12` created and modified no architecture gate** — they wired production collaborators (`ReinstallTransaction.replaceOperations`, the typed reinstall options) and their owner unit tests, so they have no row. Their contribution to criterion 3 is the production seam the closed-set gates now exercise.

## The Four Roadmap Success Criteria

| # | Criterion | Answered by | Command run this cycle | SUMMARY |
|---|-----------|-------------|------------------------|---------|
| 1 | Terminal scanning-gate gaps prove visitation, an offender, and a benign control; changed-pair discovery proves deterministic base selection and a fail-closed zero-selection case | `07-01` established the shape; `07-04`/`07-05`/`07-06` carried it to twenty gates; `07-03` closed base selection | `node --test "tests/architecture/*.test.ts"` → **410 pass / 0 fail**; `npm run test:coverage:direct:negative` → exit 0, printing *"Base-selection negative controls passed: chain head with no origin/main, chain tail in a shallow clone, resolved-but-empty docs-only change set, failed selection outside a repository."* | `07-01`, `07-03`, `07-04`, `07-05`, `07-06` |
| 2 | `FLOW-07` varies effective config sources and broad overrides across both gaps, with visitation proved | `07-07` resolved both boundary gates through `ESLint#calculateConfigForFile` and deleted the two superseded gates | `node --test tests/architecture/eslint-effective-config.test.ts` (within the 410 above); `npm run lint` inside `npm run check` → exit 0 | `07-07` |
| 3 | Closed-set and delegated-contract gates exercise real production consumers and the public seams the approved splits created | `07-08` (`ClaudeHookEvent` / `Dependency` enrollment), `07-09` (hooks required-field oracle derived from production behaviour), `07-13` (`__`-prefixed surface), against the seams `07-10` and `07-12` promoted | `npm test` → **5949 pass / 0 fail**; `npm run test:integration` → **32 pass / 0 fail** | `07-08`, `07-09`, `07-10`, `07-12`, `07-13` |
| 4 | Every gate addressing targets by an assembled path is discoverable without a literal path in its own source, and still resolves each target | `07-06`'s census plus its migrations, `07-07`'s `import-boundaries` work, and **this plan's two rules** — the last unmigrated row (`hooks-dispatch.test.ts`) closed here | `node --test tests/architecture/gate-targets.test.ts` → **14 pass / 0 fail**, with the composed rule observed failing on `hooks-dispatch.test.ts assembles hooks.ts` before the migration and the naming rule on `partial-vocabulary-guard.test.ts names …/provider.ts` | `07-02`, `07-06`, `07-07`, `07-16` |

## Chain Results

| Command | Result |
|---------|--------|
| `npm run check` | **exit 0** (typecheck, lint, fallow, format:check, test:corresponding, test:corresponding:negative, test:coverage:direct:negative, test, test:integration) |
| `npm test` | **5949 pass / 0 fail / 0 skipped / 0 todo** |
| `node --test "tests/architecture/*.test.ts"` | **410 pass / 0 fail** |
| `node --test tests/architecture/gate-targets.test.ts` | **14 pass / 0 fail** (6 registry clauses + 7 meta-gate + 1 corroboration) |
| `npm run test:integration` | **32 pass / 0 fail** |
| `npm run test:coverage:direct:negative` | **exit 0** — direct-coverage and base-selection negative controls both passed |
| `npx fallow health --fail-on-issues` | **0 above threshold · 12833 analyzed · maintainability 91.8** |
| `npx fallow dead-code --fail-on-issues` | no issues |
| `npx fallow dupes --fail-on-issues` | exit 0 — 879 lines (1.1%) across 38 files, unchanged; the new module joins no clone group |
| `npx eslint tests/architecture --max-warnings=0` | exit 0 |
| `npx prettier --check "tests/architecture/*.ts"` | all matched files use Prettier code style |

### Unit-suite case-count attribution

| Recorded by | Count |
|-------------|-------|
| `07-06` | 5924 |
| `07-14` (includes `07-13`) | 5940 |
| **this plan** | **5949** |

**+9 over `07-14`, attributed:** **+8 authored here** — `tests/architecture/gate-targets.test.ts` went from 6 cases to 14, verified by running the file before and after. The residual **+1** is `07-15`'s net, whose SUMMARY recorded no whole-suite count: its `unowned-exports-census.test.ts` adds 3 cases, and `188da750` refolds 3 top-level `test(` calls in `tests/domain/manifest.test.ts` into surviving cases when `MARKETPLACE_VALIDATOR` lost its export. No case was silently dropped anywhere in the phase.

### Retired-symbol greps

Scoped to `extensions tests scripts eslint.config.js .fallowrc.json` — a bare repository-wide `git grep` matches the `.planning/` prose that *describes* each removal:

| Token | Files matching |
|-------|----------------|
| `__operations` | **0** |
| `loadZones` | **0** |
| `bad-imports` | **0** (and `tests/fixtures/bad-imports/` does not exist) |
| `__deps` | **1** — `tests/architecture/no-test-only-production-surface.test.ts:99`, inside a comment naming the very shape the gate forbids. Attributed, not zero: a gate legally names its own subject, and its own `stripComments` step means the token is invisible to its scan. |

## `pre-commit run --all-files`

Run **before** the commits, not after, per project policy. `SKIP=trufflehog` is required in this worktree (TruffleHog cannot read `.git` when it is a file).

**Per-commit runs, scoped to this plan's files: clean.** Every hook Passed or Skipped for `tests/architecture/gate-targets.test.ts`, `tests/architecture/gate-targets.ts`, and `tests/architecture/hooks-dispatch.test.ts`, including the four whole-repo local hooks (`npm lint`, `npm format check`, `npm typecheck`, `npm fallow`).

**The whole-repository run exits 1 on seven pre-existing files this plan does not own.** Two hooks rewrote them:

| Hook | Files rewritten |
|------|-----------------|
| `fix-unicode-dashes` | `tests/architecture/revalidation.test.ts` |
| `mdformat` | `.planning/phases/01-live-evidence-revalidation/01-VERIFICATION.md`, `.planning/phases/03-production-defect-corrections/03-VERIFICATION.md`, `.planning/phases/04-hermetic-test-infrastructure/04-VERIFICATION.md`, `.planning/phases/06-assertion-and-module-refinement/06-31-SUMMARY.md`, `docs/output-catalog.md`, `docs/prd/pi-claude-marketplace-prd.md` |

All seven were reverted with `git checkout -- <path>`, and the tree was re-verified: `node --test tests/architecture/revalidation.test.ts` → 136 pass / 0 fail, `git status --short` clean apart from two files the operator had already modified before this plan started (`.claude/settings.json`, `.codex/config.toml`).

**The dash rewrite is not cosmetic and must not be applied blind.** `.pre-commit-config.yaml:56` excludes `scripts/revalidation.mjs` from `fix-unicode-dashes` but does **not** exclude `tests/architecture/revalidation.test.ts`. The script emits six em-dashes (`scripts/revalidation.mjs:1024,1484,1493,1501,1510`); the test pins that exact output. Applying the hook to only one side desynchronizes the pin — measured: **2 of 136 cases fail.** Closing this needs the exclusion widened to the test, or the em-dash removed from both sides in one commit. Neither is in this plan's scope. Recorded in Open Items.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocker] `hooks-dispatch.test.ts` migrated, outside the declared `files_modified`**

- **Found during:** Task 1, on the assembly rule's first run against the real tree.
- **Issue:** `path.join(process.cwd(), "extensions", "pi-claude-marketplace", "domain", "components", "hooks.ts")` is the exact offence criterion 4 names. `07-06`'s census routed the row to `07-07`, which did not migrate it, so it reached this plan unresolved. The plan's `must_haves` require zero offenders and the phase requires `npm run check` green; the only alternatives were a per-file exclusion (forbidden by the plan's own `prohibitions` and by `T-07-49`) or shipping the gate red.
- **Fix:** imported `HOOKS_SCHEMA_TARGETS` and `EXTENSION_ROOT_REL`, declared `HOOKS_COMPONENT_REL: (typeof HOOKS_SCHEMA_TARGETS)[number]`, and re-pointed both joins at `REPO_ROOT`. Net −11 lines of segment assembly.
- **Files modified:** `tests/architecture/hooks-dispatch.test.ts`
- **Verification:** `node --test tests/architecture/hooks-dispatch.test.ts` → 2 pass / 0 fail; both meta-gate rules green.
- **Commit:** `f7997ff9`

**2. [Rule 2 - Missing critical] The exclusion list is two files, not the three the acceptance criterion named**

- **Found during:** Task 1, designing the rules against the measurement.
- **Issue:** the plan's `<acceptance_criteria>` names `temp-root-control.ts` as a third exclusion, while its `<prohibitions>` block says the only exclusions are the registry and the meta-gate. Measured: `temp-root-control.ts` carries no production literal and no `.ts` literal inside any composition, so it is not an offender under either rule.
- **Fix:** two exclusions, both exact paths. `T-07-49` names a growing exclusion list as the failure mode a meta-gate exists to prevent, and a dead exclusion is how such a list starts.
- **Verification:** `grep -c "EXCLUDED\|SELF" tests/architecture/gate-targets.test.ts` → 2; the corpus filter is one line, `rel !== REGISTRY_REL && rel !== SELF_REL`.
- **Commit:** `f7997ff9`

**3. [Rule 3 - Blocker] Seven pre-existing files rewritten by `pre-commit run --all-files`, reverted**

- **Found during:** Task 3.
- **Issue:** the whole-repository hook run rewrote six markdown files from three prior phases plus one gate test, none of them this plan's. Applying the dash rewrite breaks 2 of 136 cases in `revalidation.test.ts`, because `.pre-commit-config.yaml:56` excludes the production script from the same hook but not its test.
- **Fix:** all seven reverted with per-file `git checkout --`; the executor scope boundary forbids fixing pre-existing failures in unrelated files, and the dash fix is not safely applicable to one side alone.
- **Verification:** `node --test tests/architecture/revalidation.test.ts` → 136 pass / 0 fail; `git status --short` shows only the operator's two pre-existing modifications.
- **Recorded as an open item below rather than closed here.**

**Total deviations:** 3 auto-fixed (1 blocking migration, 1 design correction against a self-contradictory acceptance criterion, 1 scope-boundary revert). **Impact:** the two code deviations made the gate shippable and stricter; the third leaves a pre-existing CI-Lint exposure documented instead of silently absorbed.

## Open Items

Each is outside this plan's `files_modified` and is recorded so the phase verifier sees it.

1. **`.planning/codebase/CONVENTIONS.md` states "exactly 11 `fallow-ignore` markers exist repo-wide".** Re-measured this cycle with the document's own command — `grep -rn "fallow-ignore" extensions tests scripts` → **12 markers across 10 files.** Breakdown: 9 `fallow-ignore-next-line` under `extensions/` (`domain/resolver-types.ts` ×3; `bridges/hooks/async-rewake/registry.ts`, `domain/components/hook-events.ts`, `orchestrators/marketplace/add.messaging.ts`, `orchestrators/marketplace/remove.messaging.ts`, `orchestrators/plugin/reinstall-replace.ts`, `shared/notify-reasons.ts` ×1 each), 1 under `scripts/` (`revalidation.mjs`, the temporary function-scoped complexity exception), and 2 `fallow-ignore-file` under `tests/live-uat/`. The twelfth is `07-08`'s `SCN-F025` completeness-proof marker in `hook-events.ts:90`, the same approved compile-time-proof class as `shared/notify-reasons.ts`. The count and the class breakdown both need updating.
2. **`extensions/pi-claude-marketplace/shared/concerns/hooks.ts:20-24` carries the same falsified `satisfies` claim `07-08` corrected in `hook-events.ts`** — it credits `satisfies` with a guarantee the compiler does not give. A one-line correction; `07-08` could not make it and neither can this plan.
3. **`.planning/PROJECT.md` promises `tests/architecture/no-legacy-markers.test.ts`**, which `git log --all` shows was never written (`07-11` measured this). The dangling citation in `shared/markers.ts` is fixed; PROJECT.md still promises the file.
4. **`markers-snapshot.test.ts` should shed its three agents-bridge marker pins.** `tests/bridges/agents/marker.test.ts` already byte-pins all three at lines 16, 27 and 38, so retaining them is the duplication `SHC-F047` describes, one module over. `07-11` kept them because its acceptance criterion required four surviving cases. The correct disposition is to move them to the agents-bridge owner test, leaving `markers-snapshot.test.ts` with only the `locationsFor` assertion no owner test can express — which would also give that gate the fired control it currently lacks.
5. **`pre-commit run --all-files` exits 1 on seven pre-existing files** (listed above). CI's Lint job runs `--all-files`, so this will fail there until it is closed. The `fix-unicode-dashes` asymmetry between `scripts/revalidation.mjs` (excluded) and `tests/architecture/revalidation.test.ts` (not excluded) is the mechanism for one of them and needs a deliberate decision, not a blind hook run.
6. **A composed production DIRECTORY name is not policed by either rule.** Two sites remain (`partial-vocabulary-guard.test.ts:58`; `eslint-effective-config.ts` ×3 templates). Classified above with evidence rather than left open, but a future plan wanting total coverage would have to widen rule two to template compositions and migrate those files first.

## Issues Encountered

None beyond the deviations and open items above. No checkpoint was reached; no authentication gate occurred.

## Known Stubs

None. No hardcoded empty value, placeholder string, `TODO`, `FIXME`, `test.only`, `test.skip`, `test.todo`, coverage-ignore directive, or new `fallow-ignore` marker was introduced.

## Next Step

This is the last plan of Phase 7. The phase closes on a green `npm run check`, a fired-controls ledger covering every gate it created or modified, and a criterion-by-criterion answer backed by commands run this cycle. Ready for phase verification.
