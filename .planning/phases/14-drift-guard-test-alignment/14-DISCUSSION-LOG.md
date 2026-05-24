# Phase 14: Drift Guard & Test Alignment - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-24
**Phase:** 14-drift-guard-test-alignment
**Areas discussed:** Audit gap pre-condition, MSG-* detection technique mix, YAML parsing strategy, Test file structure + planted-violation gate

---

## Audit Gap Pre-Condition

### Sequencing question — how to handle CMC-16 + CMC-34 relative to landing CMC-38

| Option | Description | Selected |
|--------|-------------|----------|
| Absorb into Phase 14 scope | Phase 14 scope expands to include closing CMC-16 + CMC-34 alongside building the CMC-38 drift guard, with closures landing in Wave 1 before the guard activates in Wave 2. Mirrors the audit's path (B). Single milestone-gate phase; one VERIFICATION.md covers all three. Phase 14 plan count grows ~2-3 plans. | ✓ |
| Pre-phases 14.2 + 14.3 (the 14.1 pattern) | Insert 14.2 (CMC-16 closure) and 14.3 (CMC-34 closure) before Phase 14 lands, mirroring how 14.1 closed CMC-13. Phase 14 stays pure CMC-38 drift-guard work. Clean separation but adds two roadmap insertions and two more discuss→plan→execute cycles. | |
| Land the guard with known failures + close inline | Phase 14 builds the guard, runs it, lets it surface CMC-16 + CMC-34 as test failures, then fixes the failures as part of guard development. The guard itself proves the closures landed. Same end-state as Option 1 but the guard is the discovery mechanism, not a predetermined scope item. | |

**User's choice:** Absorb into Phase 14 scope (Recommended).
**Notes:** Locked as D-14-01. No 14.2 / 14.3 insertions. Phase 14 is the v1.3 milestone-close commit.

### CMC-16 closure direction

| Option | Description | Selected |
|--------|-------------|----------|
| Emit from reinstall.ts on ManualRecoveryError | Modify orchestrators/plugin/reinstall.ts so when ManualRecoveryError propagates, the orchestrator emits a top-level `⊘ <resource> (manual recovery) {<reason>}` line via renderManualRecovery instead of mapping it into the rollback-partial cascade row. Also requires marketplace/remove.ts:73,91-96 to actually consume the composer (drop the dead-code seam). Wider blast radius but closes the gap the requirement promises. | ✓ |
| Document + remove the orphan binding | Accept that manual-recovery anchors only fire from bridges/*/stage.ts migration failures (the actual call path today). Remove the catalog binding for the orphan state in docs/output-catalog.md, drop the dead-code import seam, and document the realized invariant. Smaller blast radius but narrows the user-contract surface vs. what CMC-16 originally promised. | |
| You decide | Defer to research/planner judgment. | |

**User's choice:** Emit from reinstall.ts on ManualRecoveryError.
**Notes:** Locked as D-14-02. Honors the catalog binding for `(manual recovery)`.

### Wave order

| Option | Description | Selected |
|--------|-------------|----------|
| Closures first, then guard | Wave 1: CMC-16 closure. Wave 2: CMC-34 closure. Wave 3: CMC-38 drift-guard suite lands green. Each wave keeps npm run check green; the guard arrives last with nothing to find. Cleanest commit history; each wave independently revertable. Wave 1 + Wave 2 may parallelize. | ✓ |
| Guard scaffolding + closures in parallel, activation last | Land drift-guard test infrastructure in Wave 1 in a passive/snapshot state. Land CMC-16 + CMC-34 closures in Wave 2 (parallel). Wave 3 flips assertions active. Lets infra work proceed without waiting; activation is the milestone moment. | |
| Single atomic wave | All three (closures + guard) land in one wave. Maximizes parallelism, smallest commit count; loses audit-trail benefit of independent revertability. | |

**User's choice:** Closures first, then guard.
**Notes:** Locked as D-14-03.

### WARNING-level audit findings (transaction/rollback.ts literal drift; MARKETPLACE_LABEL_PROBE duplication)

| Option | Description | Selected |
|--------|-------------|----------|
| Out of scope; allow-list rollback.ts, defer DRY | rollback.ts stays in the drift guard's ALLOW_LIST (no-legacy-markers precedent). MARKETPLACE_LABEL_PROBE DRY cleanup deferred to backlog. Keeps Phase 14 focused on CMC-38 + the two BLOCKER closures. | |
| Cover rollback.ts too; defer DRY | Drift guard treats the rollback.ts literal as a real violation; plan refactors rollback.ts emission through the renderer (requires plumbing plugin/scope/marketplace context into the transaction layer or accepting a partial-context renderer call). Closes the audit's exact concern but adds non-trivial refactor work. | |
| Cover both | Drift guard covers rollback.ts and the plan also dedupes MARKETPLACE_LABEL_PROBE into a single constant module. Maximum cleanup but materially expands Phase 14 scope. | ✓ |

**User's choice:** Cover both.
**Notes:** Locked as D-14-04 + D-14-05. Phase 14 absorbs all four audit-flagged closures (2 BLOCKER + 2 WARNING) plus the CMC-38 drift guard.

---

## MSG-* Detection Technique Mix

### Detection technique

| Option | Description | Selected |
|--------|-------------|----------|
| Two-technique: frontmatter-set tests + recursive source scan | Frontmatter set-equality tests + recursive source scan (no-legacy-markers pattern). Reuses two proven patterns; minimal infrastructure. | |
| Three-technique: above + small TS Compiler API AST passes | Adds typescript Compiler API for rules pure regex can't cleanly catch (e.g. `notifyError(ctx, msg + '\n' + USAGE)`). More accurate for 3-5 rules; new infrastructure for marginal precision gain. | |
| ESLint-rule-heavy: custom rules in eslint.config.js | Move MSG-* enforcement into custom ESLint rules with typescript-eslint AST. Lint participates in `npm run check`. Source-location attribution via ESLint reporting. Departs from Phase 12+13 precedent of test-suite assertions. | ✓ |

**User's choice:** ESLint-rule-heavy.
**Notes:** Locked as D-14-06. typescript-eslint AST infrastructure already in project deps.

### Rule layout

| Option | Description | Selected |
|--------|-------------|----------|
| Local plugin under tests/lint-rules/ | Custom rules as a local ESLint plugin module loaded via flat-config `plugins:`. Each MSG-* rule its own file with docstring referencing the style-guide section. RuleTester-testable. Mirrors typescript-eslint and import-x packaging. | ✓ |
| Inline in eslint.config.js | Rules as inline objects in eslint.config.js. Smallest file count; becomes unwieldy at 30+ rules. | |
| Separate top-level package: packages/eslint-plugin-msg/ | Promote to sibling workspace package. Maximum modularity; adds workspace setup the project doesn't use today. | |

**User's choice:** Local plugin under tests/lint-rules/.
**Notes:** Locked as D-14-07. Frontmatter consumed via shared memoized loader.

### Rule scope

| Option | Description | Selected |
|--------|-------------|----------|
| Per-rule scoping via flat-config files: patterns | Each rule registered under the narrowest files: pattern it needs. Minimal false-positive surface; rule-registry test asserts every rule has documented scope. | ✓ |
| Global scope with rule-internal allow-lists | Single file pattern; per-rule scope lives inside the rule code. Harder to audit scope from one place. | |
| You decide | Defer the boundary to the planner. | |

**User's choice:** Per-rule scoping via flat-config files: patterns.
**Notes:** Locked as D-14-08.

### Rule design archetype

| Option | Description | Selected |
|--------|-------------|----------|
| Composer-chokepoint + wrapper-routing | Two archetypes only: composer-chokepoint (forbid hand-composed canonical markers outside the composer) + wrapper-routing (notifyUsageError for Usage blocks). ~6-10 rules total. | |
| One rule per MSG-* ID | 34 ESLint rules, one per MSG-* rule ID. Maximum granularity, easiest reviewer-to-rule mapping; several MSG-* rules become no-ops or trivial duplicates of catalog-uat assertions. | ✓ |
| Hybrid: archetype rules + per-MSG-ID test-name aliases | Archetype-grouped rules; rule-registry test asserts every MSG-* ID has at least one rule citing it in metadata so SC #2 holds via cross-reference. | |

**User's choice:** One rule per MSG-* ID.
**Notes:** Locked as D-14-09. Rules whose semantic content is already structurally caught become thin "structural meta-assertion" rules.

---

## YAML Parsing Strategy

### Parser approach

| Option | Description | Selected |
|--------|-------------|----------|
| Adopt the `yaml` package | Already in node_modules as transitive dep. Promote to direct dev dep. Loader uses `yaml.parse()`. Bulletproof for v1.4 mutation; ~10 lines of loader code. Drift risk eliminated. | ✓ |
| Extract the regex extractor to a shared helper | Move existing extractFrontmatterList to a shared module; extend to 4 keys. No new dep; YAGNI-pure; fragile to YAML style changes. | |
| Hybrid: regex for current keys + yaml package fallback | Two parse paths to maintain for marginal benefit. | |

**User's choice:** Adopt the `yaml` package.
**Notes:** Locked as D-14-10. grammar-frontmatter.test.ts migrates and extends to 4 keys.

---

## Test File Structure + Planted-Violation Gate

### Per-rule companion test location

| Option | Description | Selected |
|--------|-------------|----------|
| Co-located under tests/lint-rules/ + extend test glob | Plugin convention: msg-sr-7.js paired with msg-sr-7.test.js. Extend npm-test glob to include tests/lint-rules/. Single discovery surface; failure messages map MSG-* ID → rule file → test file. Plus tests/architecture/msg-rule-registry.test.ts for cross-reference. | ✓ |
| Mirrored under tests/architecture/msg-rules/ | Tests under tests/architecture/msg-rules/msg-sr-7.test.ts, importing the rule from tests/lint-rules/. Test glob unchanged; preserves tests-under-tests/architecture/ posture. | |
| Single per-family file under tests/architecture/ | One large file with all 34 RuleTester sets. Compact discovery; harder to bisect failures. | |

**User's choice:** Co-located under tests/lint-rules/ + extend test glob.
**Notes:** Locked as D-14-11. RuleTester `invalid:` cases ARE the planted violations; SC #1 structurally satisfied.

### Canonical MSG-* ID set discovery

| Option | Description | Selected |
|--------|-------------|----------|
| Scan style-guide body for MSG-* IDs | Registry test regex-extracts unique `MSG-[A-Z]+-[0-9]+` tokens from the body (currently 34). No frontmatter duplication; adding a new MSG-* in v1.4 only requires adding the rule. Linear extractor (~10 lines). | ✓ |
| Add msg_rule_ids: list to the frontmatter | Fifth frontmatter key listing every MSG-* ID. Parallel to status_tokens/reasons/markers/pattern_classes. Trade-off: dual-edit burden. | |
| Hardcode the MSG-* list in the registry test | Literal array of 34 MSG-* IDs in the test. Simplest; violates SC #3 in spirit (adding a new MSG-* requires editing the test). | |

**User's choice:** Scan style-guide body for MSG-* IDs.
**Notes:** Locked as D-14-12. Mirrors the no-legacy-markers.test.ts pattern of pinning by-form rather than by-list.

---

## Claude's Discretion

Captured in CONTEXT.md `<decisions>` "Claude's Discretion" subsection:

- Wave 3 plan decomposition (3-6 plans total; wave structure is binding, plan count inside is discretionary)
- Rule-file extension (.js vs .ts)
- Grammar file layout for new closed sets (`markers.ts` / `pattern-classes.ts` new files vs additions to existing grammar/ files)
- transaction/rollback.ts refactor approach (D-14-04): plumbing partial context vs. accepting partial-context renderer variant
- MARKETPLACE_LABEL_PROBE constant location (D-14-05): shared/grammar/ vs shared/constants/
- Memoization mechanism for the frontmatter loader (plain module-scope cache is the simplest valid approach)

---

## Deferred Ideas

Captured in CONTEXT.md `<deferred>`:

- v1.4 frontmatter additions (new reason, status token, marker, pattern_class) — drift guard accepts these without test-code change per SC #3
- Future MSG-* rules (v1.4+) — adding requires only style-guide body edit + new rule file + RuleTester companion
- Restructuring grammar-frontmatter.test.ts into per-key files — single-file extension is also fine
- Promoting tests/lint-rules/ to a published eslint-plugin-pi-claude-marketplace-msg package
- MARKETPLACE_LABEL_PROBE rename or semantic tightening (dedup only in Phase 14)
- Replacing no-legacy-markers.test.ts with an ESLint rule
- Auto-generating in-code closed-set literal-unions from frontmatter at build time
