# Phase 6: Assertion and Module Refinement - Research

**Researched:** 2026-09-08
**Domain:** TypeScript test-contract strengthening, hermetic Node.js tests, and responsibility-aligned module extraction
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

### Extracted Public Surface

- **D-06-01:** Give each extracted module the smallest genuine production surface. Export only symbols used by real production composition and the module's paired owner test. Do not add a barrel export unless a current production consumer needs it.
- **D-06-02:** Extraction may include broad API cleanup: rename symbols and reshape awkward parameters when the new responsibility boundary admits a clearer contract. Every tracked production caller and owner test must migrate atomically in the same plan; retain no deprecated overload or compatibility call form. — **Reversibility:** costly — Undoing a cleaned contract requires coordinated edits across every migrated caller and paired owner test.

### Exact-Output Ownership

- **D-06-03:** Narrowly documented body-focused tests may remain, including cases that intentionally omit a tally suffix from their local observation. Each affected producer boundary must also own independently authored zero/one/many cases that assert the complete exact output bytes.
- **D-06-04:** Keep complete expected strings as owner-local constants beside the affected producer tests. The output catalog remains an independent cross-check and must not become the value from which owner-test expectations are derived.
- **D-06-05:** Make paths, timestamps, counts, plugin names, and other dynamic values deterministic in fixtures, then compare the entire final string byte-for-byte. Do not normalize the observed output or replace exact comparisons with patterns.
- **D-06-06:** Use strict collaborator doubles that reject extra or missing notifications, and deep-compare the captured notification array with the complete expected sequence, including severity and ordering.

### Split Rollout Order

- **D-06-07:** Complete assertion strengthening and authorized global-patch removal before the module split program. Then split the leaf-oriented catalog, resolver, and notify responsibilities before the command flows.
- **D-06-08:** Use dependency-aware parallel waves for disjoint splits. Catalog work must follow its emitter and notify contracts. Serialize plans that touch the same structural gates, documentation, ownership maps, or completeness invariants.
- **D-06-09:** When dependencies permit, split command flows in this order: install, update, reinstall, then list.
- **D-06-10:** Verify each plan with its focused direct owner pair and command-flow proof, run affected structural gates at the end of each wave, and close Phase 6 with the complete `npm run check` suite.

### No Forwarding Seams

- **D-06-11:** Do not leave a temporary forwarding module, compatibility adapter, or old-path re-export during extraction. Move the responsibility and migrate its callers atomically within one plan.
- **D-06-12:** If cycles or caller overlap make an extraction too large for one atomic plan, replan around a smaller genuine leaf contract and retry the move. Do not use a forwarding seam as an intermediate state.
- **D-06-13:** After its responsibilities move, delete the original large module rather than retaining a thin orchestration facade or stable re-export path. Move all remaining sequencing and composition behavior to named new owners and update every import. — **Reversibility:** costly — Restoring an old module path would require reconstructing ownership and migrating the new call graph again.
- **D-06-14:** Before deleting an original module, map every exported symbol, invariant, source-scanning gate reference, documentation reference, completeness check, and owner test to a named new owner. A stale-path scan must return zero.

### Carried-Forward Constraints

- `MF-DEC-06` remains binding: structural single/plural cardinality comes from invocation form, plural tallies remain user-visible, and row-count inference is forbidden.
- `MF-DEC-07` and Phase 5 decisions D-05-01 through D-05-03 remain binding: use case-owned real temporary filesystems by default; introduce a narrow consumer-owned production port only for authorized irreproducible faults, timing, schedules, rollback points, probes, hydration reads, or races. No test-only export, dead default, `__deps` bag, or ignore pragma is permitted.
- `MF-DEC-02` remains binding: complete only the seven approved split families, give every new production module exactly one mirrored owner test with direct-pair coverage, retain one end-to-end proof per command flow, and perform the four-part gate/documentation/ownership/completeness repointing checklist.
- The current evidence grants no file-specific authorization to alter `tests/bridges/skills/stage.test.ts` merely because it uses builtin patching. Uninstall and the independently deferred info split remain excluded.

### the agent's Discretion

- Exact new file, symbol, parameter, and local factory names, provided they express the selected responsibility and obey the minimal-surface rule.
- Exact wave membership among genuinely disjoint leaf splits, provided shared gates, documentation, and ownership artifacts are serialized.
- The smallest atomic leaf boundary used to break a cyclic or overly broad extraction, provided it is a real production responsibility and not a forwarding seam.

### Deferred Ideas (OUT OF SCOPE)

- The unused-type-member gate described in `.planning/todos/pending/2026-09-02-detect-unused-code-and-type-members.md` remains evidence-only history for Phase 9 closure; no new terminal evidence authorizes it here.
- The info split remains independently deferred, and uninstall remains a cohesive transactional flow outside `MF-DEC-02`.
- `tests/bridges/skills/stage.test.ts` remains unchanged without a dedicated terminal finding, despite appearing in the raw builtin-patch census.

### Reviewed Todos (not folded)

- `2026-09-02-detect-unused-code-and-type-members.md` — reviewed and left deferred because REQUIREMENTS.md explicitly classifies the unused-type-member proposal as evidence-only without terminal authorization.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| TREF-07 | Observable assertions use complete exact outcomes, including structural single/plural cardinality and visible plural tallies, while documented caveats remain protected. | Preserve the current owner-local zero/one/many exact cases, replace inert label-only assertions only where output is observable, and require strict ordered notification arrays. [VERIFIED: .planning/REQUIREMENTS.md:67-69; .planning/phases/01-live-evidence-revalidation/01-REVALIDATION.json:88889-88905] |
| TREF-08 | Global prototype and builtin-module patching and dishonest dense-index cases are removed through real case-owned state or narrow production-owned ports without ignore pragmas. | Use the Phase 5 ownership/port manifest, remove only authorized shared-process surgery, preserve the explicit stage/uninstall exclusions, and retain public outcomes rather than substituting interaction checks. [VERIFIED: .planning/REQUIREMENTS.md:70-72; .planning/phases/01-live-evidence-revalidation/01-REVALIDATION.json:88908-88948] |
| TREF-09 | After Phase 2 and 3 prerequisites, the approved resolver, notify, install, update, reinstall, list, and catalog splits land at named seams with paired tests, one end-to-end proof per flow, and the four-part gate, documentation, ownership, and completeness checklist; uninstall and the independently deferred info split remain outside this requirement. | Use the responsibility maps below, leaf-first rollout, direct-pair coverage, final old-path deletion, and four-part repoint gate. [VERIFIED: .planning/REQUIREMENTS.md:73-77; .planning/phases/01-live-evidence-revalidation/01-REVALIDATION.json:88791-88833] |
</phase_requirements>

## Summary

Phase 6 should be planned as a contract-preserving refactor, not as a general cleanup. The terminal ledger selects three exact policies: `"Trace-preserving removal"`, `"Enforce structural cardinality and honor plural tallies"`, and `"Classify each use and eliminate global patching"`. [VERIFIED: .planning/phases/01-live-evidence-revalidation/01-REVALIDATION.json:88725-88788,88889-88948] The implementation order is load-bearing: strengthen assertions and remove authorized shared-process surgery first; then extract catalog, resolver, and notify leaves; then migrate install, update, reinstall, and list. [VERIFIED: .planning/phases/06-assertion-and-module-refinement/06-CONTEXT.md:28-40]

The split program is justified by durable responsibility seams, not line count. The seven approved families are exactly `"resolver"`, `"notify"`, `"install"`, `"update"`, `"reinstall"`, `"list"`, and `"catalog"`; `"info"` is deferred and `"uninstall"` is excluded. [VERIFIED: .planning/phases/06-assertion-and-module-refinement/06-CONTEXT.md:42-47] Each legacy hub may remain temporarily only while it still owns real behavior. Once its final responsibility moves, the plan must delete it and atomically migrate every caller, owner test, scanning gate, document, and completeness invariant—never leave a forwarding path. [VERIFIED: .planning/phases/06-assertion-and-module-refinement/06-CONTEXT.md:35-40]

The current observable contracts already provide strong anchors. Plugin list owns byte-exact plural outputs for zero, one, and many results, including `"Plugin list: 0 successes"`, `"Plugin list: 1 success"`, and `"Plugin list: 3 successes"`; marketplace autoupdate and marketplace list likewise own exact plural tally examples. [VERIFIED: tests/orchestrators/plugin/list.test.ts:321-340,373-398,3410-3423; tests/orchestrators/marketplace/autoupdate.test.ts:339-395,397-447; tests/orchestrators/marketplace/list.test.ts:168-228,455-477] These are migration invariants. Body-focused cases may retain their documented suffix omission, but no extraction may remove the independent exact boundary cases. [VERIFIED: tests/orchestrators/plugin/list.test.ts:76-108]

**Primary recommendation:** Plan small atomic ownership moves around the prescribed leaves below, and make every plan end with exact observable proof, the direct source-test pair, affected architecture gates, and a zero-stale-path check.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Exact output ownership and notification sequencing | API / Backend (orchestrator/shared rendering) | Test contract | Producers stamp structural cardinality and shared rendering emits final bytes; tests observe the public notification boundary. [VERIFIED: extensions/pi-claude-marketplace/shared/notify-context.ts:120-176; extensions/pi-claude-marketplace/shared/notify.ts:3121-3200] |
| Resolver decomposition | API / Backend (domain) | Filesystem boundary | Pure schemas/policy stay in `domain`; manifest, hook, MCP, and path reads remain explicit collaborators. [VERIFIED: .planning/reviews/unit-test-adversarial/domain-resolver.md:135-178] |
| Notify decomposition | API / Backend (shared presentation) | Pi host boundary | Closed vocabulary, grammar, summary, info rendering, and dispatch form a one-way dependency chain ending at the Pi notification port. [VERIFIED: .planning/reviews/unit-test-adversarial/shared-notify.md:69-77] |
| Install/update/reinstall/list flows | API / Backend (orchestrators) | Database / Storage | Orchestrators own sequencing and transactions; persistence and filesystem collaborators remain below them. [VERIFIED: .fallowrc.json:75-132] |
| Catalog contract | Test architecture | Documentation | The test scanner parses documented examples and drives production notification emitters; it is not production runtime code. [VERIFIED: .planning/reviews/unit-test-adversarial/architecture-catalog-uat.md:117-150] |
| Global-patch removal | Test infrastructure | Production-owned ports | Ordinary behavior uses per-case temporary state; only terminally authorized irreproducible faults use existing narrow ports. [VERIFIED: .planning/phases/05-injection-and-ownership-design/05-34-SUMMARY.md:91-107] |

## Project Constraints (from AGENTS.md)

- When `.codegraph/` exists, use CodeGraph before grep/find or direct file reading to understand or locate code. The repository has `.codegraph/`, and this research used `codegraph explore` before targeted source reads. [VERIFIED: AGENTS.md:2-9]

## Standard Stack

### Core

| Library / Tool | Version | Purpose | Why Standard |
|----------------|---------|---------|--------------|
| Node.js | local `v26.8.1`; CI `24` | Native TypeScript execution and `node:test` | The package declares `"node": ">=20.19.0"`, and CI's authoritative job uses Node 24. [VERIFIED: package.json:32-34; .github/workflows/ci.yml:46-78; environment probe 2026-09-08] |
| TypeScript | `6.0.3` installed | Strict compile-time contracts | The repo enables `"strict": true`, `"noUncheckedIndexedAccess": true`, `"exactOptionalPropertyTypes": true`, and `"noEmit": true`. [VERIFIED: package.json:28-30; tsconfig.json:2-20; npm ls --depth=0, 2026-09-08] |
| `node:test` + `node:assert/strict` | Node built-ins | Test runner and exact assertions | Strict equality uses `Object.is`; deep strict equality recursively checks own properties, types, and prototypes. [CITED: https://nodejs.org/api/assert.html#assertstrictequalactual-expected-message] [CITED: https://nodejs.org/api/assert.html#assertdeepstrictequalactual-expected-message] |
| `strong-mock` | `9.2.2` installed | Exact collaborator expectations | Existing notification boundaries use `exactParams: true`, exact call counts, verification, and full capture. [VERIFIED: package.json:27; tests/edge/notification-boundary.ts:90-131; npm ls --depth=0, 2026-09-08] |
| TypeBox | `1.3.14` installed | Runtime schemas and static types | Resolver and persistence contracts already use TypeBox as their schema authority. [VERIFIED: package.json:28; extensions/pi-claude-marketplace/persistence/state-io.ts:81-129; npm ls --depth=0, 2026-09-08] |

### Supporting

| Tool | Version | Purpose | When to Use |
|------|---------|---------|-------------|
| ESLint | `10.8.1` installed | Type-aware style, boundary, output, and complexity checks | Run on every wave; exported functions require explicit return types and cognitive complexity is capped at 15. [VERIFIED: eslint.config.js:24-83; npm ls --depth=0, 2026-09-08] |
| Fallow | `3.20.0` installed | Dead code, graph boundaries, duplication, and health gates | Run after ownership moves; thresholds are `maxCyclomatic: 20`, `maxCognitive: 15`, `maxUnitSize: 60`, `maxCrap: 0`. [VERIFIED: .fallowrc.json:2-13; package.json:76-77; npm ls --depth=0, 2026-09-08] |
| Prettier | `3.9.6` installed | Repository formatting | Run after each plan; configuration is `printWidth: 100`, `tabWidth: 2`, `trailingComma: "all"`, `useTabs: false`. [VERIFIED: .prettierrc.json:1-6; npm ls --depth=0, 2026-09-08] |
| Direct-pair coverage script | repository script | One source + mirrored owner test coverage | Run once for every new production module; a single path maps to its source-test pair. [VERIFIED: scripts/test-coverage-direct.mjs:480-510] |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Existing built-in runner/assertions | Add Jest/Vitest | Rejected: adds a package and new runtime semantics without solving the selected ownership problem. [VERIFIED: package.json:75-96] |
| Real temp filesystem or existing narrow ports | Global builtin/prototype mutation | Rejected: `syncBuiltinESMExports()` republishes changed CommonJS builtin properties into ESM live bindings, creating shared-process mutation. [CITED: https://nodejs.org/api/module.html#modulesyncbuiltinesmexports] |
| Atomic import migration | Compatibility re-export | Forbidden by D-06-11 through D-06-13. [VERIFIED: .planning/phases/06-assertion-and-module-refinement/06-CONTEXT.md:35-40] |

**Installation:** None. This phase must add no dependency; use the existing lockfile and toolchain. [VERIFIED: .planning/phases/06-assertion-and-module-refinement/06-CONTEXT.md:42-47]

## Package Legitimacy Audit

Not applicable. Phase 6 installs no external package, so the package-legitimacy gate has no candidate packages to evaluate. [VERIFIED: package.json:8-30; phase recommendation above]

## Architecture Patterns

### System Architecture Diagram

```text
CLI / Pi event
    |
    v
edge handler
    |
    v
named command-flow owner (install -> update -> reinstall -> list)
    |                    \
    |                     -> persistence / transaction / filesystem ports
    v
domain resolver leaves -> structured notification message
                              |
                              v
notification types -> grammar -> summary/info -> dispatch -> ctx.ui.notify
                              |
                              v
owner exact-output tests + catalog parser/fixtures/driver -> documented bytes
```

The arrows reflect the enforced layer direction: edge may call orchestrators/domain/shared/platform; orchestrators may call lower layers; domain may call only shared/platform; shared may call only platform. [VERIFIED: .fallowrc.json:69-132]

### Recommended Project Structure

Use these names as the planning baseline; if a dependency cycle appears, split a smaller genuine leaf without creating a forwarding module. [VERIFIED: .planning/phases/06-assertion-and-module-refinement/06-CONTEXT.md:37-40,49-53]

```text
extensions/pi-claude-marketplace/
├── domain/
│   ├── resolver-types.ts              # schemas and exported resolution types
│   ├── unsupported-components.ts      # supported/unsupported closed-set policy
│   ├── component-paths.ts             # component path reading and validation
│   ├── mcp-resolution.ts              # standalone/referenced MCP resolution
│   ├── hooks-resolution.ts            # hooks config and orphan-rewake resolution
│   └── plugin-resolver.ts             # source/manifest policy and public resolve flow
├── shared/
│   ├── notification-types.ts          # closed notification vocabulary and unions
│   ├── notification-grammar.ts        # row/header grammar and icons
│   ├── notification-summary.ts        # severity, summary, tally, reload folding
│   ├── notification-info.ts           # info-surface rendering
│   ├── notification-dispatch.ts       # public emit/notify boundary
│   ├── redact-absolute-paths.ts        # security leaf
│   └── compare-name-scope.ts          # general sorting leaf
└── orchestrators/plugin/
    ├── install-{clone-probe,declared-enabled,disable-cascade,outcome,flow}.ts
    ├── update-{preflight,swap,cascade,flow}.ts
    ├── reinstall-{targets,clone-probe,replace,record,flow}.ts
    └── list-{installed-row,candidate-row,orphan-fold,flow}.ts

tests/
├── domain/                             # one mirrored owner test per domain module
├── shared/                             # one mirrored owner test per shared module
├── orchestrators/plugin/               # one mirrored owner test per flow/leaf
└── architecture/catalog-uat/
    ├── catalog-parser.ts
    ├── catalog-parser.test.ts
    ├── fixture-types.ts
    ├── mock-pi.ts
    ├── fixtures/*.ts                   # 20 command-surface slices
    └── catalog-contract.test.ts        # driver and inverse-walk proof
```

The resolver seams come from the terminal responsibility analysis. [VERIFIED: .planning/reviews/unit-test-adversarial/domain-resolver.md:144-178] The notify seams come from the layered type → grammar → summary → info → dispatch analysis, with the two general utilities moved to independent leaves. [VERIFIED: .planning/reviews/unit-test-adversarial/shared-notify.md:69-77] Install adds the fixed `makeInstallCloneProbe` + `deriveInstallVersion` seam to declared-enabled, disabled-cascade, outcome, and flow owners. [VERIFIED: .planning/reviews/unit-test-adversarial/adversarial/orchestrators-plugin-install-c.md:506-519,719-726; .planning/reviews/unit-test-adversarial/orchestrators-plugin-install.md:237-274] Update, reinstall, and list follow their reviewed responsibility boundaries. [VERIFIED: .planning/reviews/unit-test-adversarial/orchestrators-plugin-update.md:43-52; .planning/reviews/unit-test-adversarial/orchestrators-plugin-reinstall.md:248-283; .planning/reviews/unit-test-adversarial/orchestrators-plugin-list-uninstall.md:36-61] The terminal ledger corrects the catalog fixture count to **20**, not the historical first-pass estimate of 18. [VERIFIED: .planning/phases/01-live-evidence-revalidation/01-REVALIDATION.json:88807]

### Pattern 1: Move Leaves While the Hub Still Owns Real Behavior

Extract one dependency-light responsibility and its tests; update all real consumers directly; do not re-export it from the hub. The hub may remain only while it still owns other behavior. The final family plan moves sequencing into the named `*-flow.ts` owner, migrates every import, and deletes the legacy hub and its old owner test. [VERIFIED: .planning/phases/06-assertion-and-module-refinement/06-CONTEXT.md:35-40]

For each extracted production file, create exactly one mirrored test whose relative path matches the source and which directly imports that source. The correspondence gate computes `tests/<relative>.test.ts` and rejects missing, proxy-owned, wrong-import, and unexpected test paths. [VERIFIED: scripts/check-corresponding-tests.mjs:7-43,92-173]

### Pattern 2: Exact Output at the Producer Boundary

The structural cardinality vocabulary is verbatim `"single" | "plural"`; a single target is a readonly one-tuple and a bulk operation is a readonly array. [VERIFIED: extensions/pi-claude-marketplace/shared/notify-context.ts:65-76] The producer, not the renderer's row count, supplies cardinality. The label is observable only when the plural tally renders. [VERIFIED: extensions/pi-claude-marketplace/shared/notify-context.ts:140-176; extensions/pi-claude-marketplace/shared/notify.ts:3121-3143]

```typescript
// Source pattern: tests/orchestrators/plugin/list.test.ts:373-398
const expectedMessage = [
  "● mp1 [user]",
  "  ● alpha v1.0.0 (installed)",
  "  ○ beta v2.0.0 (available)",
  "  ⊘ gamma v3.0.0 (unavailable) {unsupported source}",
  "",
  "Plugin list: 3 successes",
].join("\n");

assert.deepStrictEqual(notifications, [{ message: expectedMessage }]);
```

Expected strings must be authored in the owner test, never imported or derived from production renderers or `docs/output-catalog.md`. [VERIFIED: .planning/phases/06-assertion-and-module-refinement/06-CONTEXT.md:21-26]

### Pattern 3: Strict Notification Boundary

Use a strict `strong-mock` boundary with an exact emission count and deep-compare the final ordered array of `{ message, severity? }`. The existing boundary deliberately leaves zero-count methods unstubbed because `times(0)` in `strong-mock` is not a limit. [VERIFIED: tests/edge/notification-boundary.ts:18-23,90-131]

Node's test-context mock tracker is per test and restored after the test completes; the global tracker requires manual care. [CITED: https://nodejs.org/api/test.html#class-mocktracker] This supports `t.mock` for case-owned object methods when the behavior is honest, but it does not authorize mutation of `String.prototype`, `Object.prototype`, builtin CommonJS exports, validators, or cross-test singleton state. [VERIFIED: .planning/phases/01-live-evidence-revalidation/01-REVALIDATION.json:88753-88788]

### Pattern 4: Four-Part Repoint Gate Before Deletion

Every final hub-deletion plan must contain an explicit table with these four verbatim categories: `"source-scanning gate"`, `"documentation comment"`, `"test ownership"`, and `"completeness invariant"`, plus a row for every exported symbol and production caller. [VERIFIED: .planning/phases/01-live-evidence-revalidation/01-REVALIDATION.json:88832-88833] The task is incomplete until a repository scan over `extensions tests scripts docs eslint.config.js` finds zero references to the deleted old path. [VERIFIED: .planning/phases/06-assertion-and-module-refinement/06-CONTEXT.md:39-40]

### Pattern 5: Authorized Global-Patch Delta, Not a Global Zero

The reviewed baseline is exactly **13 files / 85** `syncBuiltinESMExports(` calls and **9 files / 9** `createRequire(` calls. [VERIFIED: .planning/phases/05-injection-and-ownership-design/05-34-SUMMARY.md:128-164] The phase must remove every authorized use, including the scope-tree prebinding workaround after its consumers stop patching builtins. [VERIFIED: .planning/phases/01-live-evidence-revalidation/01-REVALIDATION.json:88947-88948]

Do not assert repository-wide zero: the locked exclusions leave `tests/bridges/skills/stage.test.ts` unchanged with **16** sync calls and **1** create call, and leave `tests/orchestrators/plugin/uninstall.test.ts` outside the phase with **2** sync calls and **1** create call. Therefore the planned end-state manifest is exactly **2 files / 18** sync calls and **2 files / 2** create calls, unless new terminal evidence changes scope. [VERIFIED: .planning/phases/05-injection-and-ownership-design/05-34-SUMMARY.md:132-164; .planning/phases/06-assertion-and-module-refinement/06-CONTEXT.md:42-47] This is a derived acceptance target from the two locked exclusions and the complete reviewed baseline.

### Anti-Patterns to Avoid

- **Thin compatibility hub:** violates D-06-11 through D-06-13 even if tests pass. [VERIFIED: .planning/phases/06-assertion-and-module-refinement/06-CONTEXT.md:35-40]
- **Expected output derived from the renderer/catalog:** lets implementation and expectation share one mistake. [VERIFIED: .planning/phases/06-assertion-and-module-refinement/06-CONTEXT.md:21-26]
- **Fragment or normalized output assertion where bytes are deterministic:** misses ordering, spacing, severity, and extra emissions. [VERIFIED: .planning/reviews/unit-test-adversarial/orchestrators-plugin-list-uninstall.md:49-57]
- **Interaction-only replacement:** collaborator calls supplement public result/state/tree/output proof; they do not replace it. [VERIFIED: .planning/phases/01-live-evidence-revalidation/01-REVALIDATION.json:88947-88948]
- **Uniform filesystem port:** ports are allowed only for the classified irreproducible boundaries, not ordinary portable filesystem behavior. [VERIFIED: .planning/phases/05-injection-and-ownership-design/05-34-SUMMARY.md:91-107]
- **Broad parallel edits:** notify, catalog, shared gates, docs, and final deletion maps are shared resources and must be serialized. [VERIFIED: .planning/phases/06-assertion-and-module-refinement/06-CONTEXT.md:28-33]

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Exact assertions | Custom matcher/normalizer | `node:assert/strict` whole-string and `deepStrictEqual` | Existing built-in semantics already compare exact primitives and complete arrays/objects. [CITED: https://nodejs.org/api/assert.html] |
| Collaborator sizing | Ad hoc call arrays without rejection | Existing `strong-mock` notification boundary pattern | It rejects unexpected or missing calls and preserves ordered observable capture. [VERIFIED: tests/edge/notification-boundary.ts:90-131] |
| Source-test ownership | New naming convention | Existing correspondence and direct-pair scripts | The scripts already define path mapping, direct import ownership, and complete direct coverage. [VERIFIED: scripts/check-corresponding-tests.mjs:29-43,135-173; scripts/test-coverage-direct.mjs:480-510] |
| Filesystem failures | Builtin export mutation | Real case-owned temp trees or the Phase 5 owner port | Global mutation republishes bindings process-wide; the authorized ports already express real production responsibilities. [CITED: https://nodejs.org/api/module.html#modulesyncbuiltinesmexports] [VERIFIED: .planning/phases/05-injection-and-ownership-design/05-34-SUMMARY.md:91-107] |
| Module transition | Forwarder/barrel/overload compatibility layer | Atomic caller migration | Compatibility tails are explicitly forbidden. [VERIFIED: .planning/phases/06-assertion-and-module-refinement/06-CONTEXT.md:35-40] |
| Catalog aggregation | Generated expectations from production | Independent fixture slices + parser + driver | The catalog must remain an independent byte cross-check. [VERIFIED: .planning/phases/06-assertion-and-module-refinement/06-CONTEXT.md:21-26] |

**Key insight:** This phase succeeds when ownership becomes narrower while observable contracts remain independently overdetermined by owner tests, command-flow proofs, structural gates, and documentation—not when files merely become shorter. [VERIFIED: .planning/phases/01-live-evidence-revalidation/01-REVALIDATION.json:88807-88833]

## Runtime State Inventory

| Category | Items Found | Action Required |
|----------|-------------|-----------------|
| Stored data | None requiring migration. The persisted plugin-record source of truth contains the verbatim fields `"version"`, `"resolvedSource"`, `"resolvedSha"`, `"hookEntries"`, `"compatibility"`, `"resources"`, `"enabled"`, `"installedAt"`, and `"updatedAt"`; no internal TypeScript module specifier is stored. [VERIFIED: extensions/pi-claude-marketplace/persistence/state-io.ts:81-126] | Code/import edits only; run existing state/config/tree behavior proofs. |
| Live service config | None requiring migration. The package's runtime entry remains verbatim `"./extensions/pi-claude-marketplace/index.ts"`; Phase 6 moves internal modules below that entry. [VERIFIED: package.json:65-69] | Keep the extension entry unchanged; no external UI/API patch. |
| OS-registered state | None in phase scope; the selected identifiers are repository-internal module/test paths, and the package entry remains unchanged. [VERIFIED: package.json:35-40,65-69; .planning/phases/06-assertion-and-module-refinement/06-CONTEXT.md:7-10] | None. |
| Secrets/env vars | No key rename. The runtime's durable path ledger is verbatim `"PI_CLAUDE_MARKETPLACE_PATH"`; session keys are verbatim `"CLAUDECODE"`, `"CLAUDE_CODE_SESSION_ID"`, and `"CLAUDE_SESSION_ID"`, none of which is an internal module path. [VERIFIED: extensions/pi-claude-marketplace/shared/session-env.ts:16-19,37-46,62-70] | None; do not alter environment contracts. |
| Build artifacts / installed packages | TypeScript uses verbatim `"noEmit": true`; tests execute `.ts` sources directly, and direct coverage removes its temporary coverage directory in `finally`. [VERIFIED: tsconfig.json:2-20; package.json:82-95; scripts/test-coverage-direct.mjs:420-434] | No artifact migration. Regenerate normal test/coverage output; do not commit it. |

## Common Pitfalls

### Pitfall 1: Deleting a Hub Before Its Non-Import References Move

**What goes wrong:** Tests compile, but ESLint exemptions, architecture scans, documentation links, closed-set locks, or catalog ownership still name the old file. [VERIFIED: eslint.config.js:86-147; docs/output-catalog.md:3-63]

**How to avoid:** Build the D-06-14 export/caller/invariant/gate/doc/test map before the final move, update the complete map in one plan, then require a zero stale-path scan. [VERIFIED: .planning/phases/06-assertion-and-module-refinement/06-CONTEXT.md:35-40]

### Pitfall 2: Treating Test File Isolation as Permission for Global Surgery

**What goes wrong:** Global prototype or builtin changes still affect every test in the same test-file process, and disabling process isolation permits cross-file state interaction. [CITED: https://nodejs.org/api/test.html#test-runner-execution-model]

**How to avoid:** Use real temporary state first; use only the existing consumer-owned ports for classified faults/races/schedules. Delete the patch and restoration code together. [VERIFIED: .planning/phases/01-live-evidence-revalidation/01-REVALIDATION.json:88947-88948]

### Pitfall 3: “Fixing” the Documented Body-Only List Helper

**What goes wrong:** Converting every list case into a tally case obscures the row behavior each narrow case owns and violates D-06-03's explicit caveat. [VERIFIED: tests/orchestrators/plugin/list.test.ts:76-108]

**How to avoid:** Retain the body-focused helper and preserve separate exact zero/one/many final-message cases. [VERIFIED: tests/orchestrators/plugin/list.test.ts:321-340,373-398,3410-3423]

### Pitfall 4: Using the Historical 18-Section Catalog Count

**What goes wrong:** Two fixture families disappear during the split.

**How to avoid:** Plan **20** self-contained fixture slices and make the driver inverse-walk both catalog states and fixture keys. [VERIFIED: .planning/phases/01-live-evidence-revalidation/01-REVALIDATION.json:88807]

### Pitfall 5: Moving Weak Tests Into New Owner Files

**What goes wrong:** The split makes ownership look correct while preserving fragment assertions, missing notification capture, or duplicate cases.

**How to avoid:** Assertion strengthening is a prerequisite. Install's reviewed weak era must be converted before cases are redistributed, and each new leaf test must assert the leaf's public result directly. [VERIFIED: .planning/reviews/unit-test-adversarial/adversarial/orchestrators-plugin-install-b.md:603-610,647-658]

### Pitfall 6: Expecting Zero Remaining Builtin Patches

**What goes wrong:** A global-zero gate forces unauthorized edits to skills stage or excluded uninstall.

**How to avoid:** Gate the exact residual allowlist: `tests/bridges/skills/stage.test.ts` and `tests/orchestrators/plugin/uninstall.test.ts`, with the derived **18 sync / 2 create** counts. [VERIFIED: .planning/phases/05-injection-and-ownership-design/05-34-SUMMARY.md:128-164; .planning/phases/06-assertion-and-module-refinement/06-CONTEXT.md:42-47]

### Pitfall 7: Letting File Size Choose the Split

**What goes wrong:** New modules become arbitrary buckets or forwarding seams.

**How to avoid:** Each extraction task must name the production responsibility, real production consumer, minimal exported surface, and its one owner test. File length is inventory evidence only. [VERIFIED: .planning/phases/01-live-evidence-revalidation/01-REVALIDATION.json:88807-88833]

## Code Examples

### Exact Ordered Notification Proof

```typescript
// Pattern source: tests/edge/notification-boundary.ts:95-130
const notifications: Notification[] = [];
const ui = mock<NotificationUi>({ exactParams: true, name: "notification UI" });
when(() => ui.notify)
  .thenReturn((message, severity) => {
    notifications.push(severity === undefined ? { message } : { message, severity });
  })
  .times(expectedEmissions);

await operation();
assert.deepStrictEqual(notifications, expectedNotifications);
verify(ui);
```

This pattern proves bytes, severity, ordering, missing emissions, and extra emissions together. [VERIFIED: tests/edge/notification-boundary.ts:95-130]

### Direct Owner Pair Verification

```bash
node --test tests/domain/unsupported-components.test.ts
npm run test:coverage:direct -- extensions/pi-claude-marketplace/domain/unsupported-components.ts
npm run test:corresponding
```

The first two paths are prescribed Phase 6 names under the agent's discretion; the command forms are the live repository interfaces. [VERIFIED: package.json:82-90; scripts/test-coverage-direct.mjs:480-510]

### Final Hub Deletion Scan

```bash
! rg -n 'domain/resolver\.ts|shared/notify\.ts|orchestrators/plugin/(install|update|reinstall|list)\.ts|tests/architecture/catalog-uat\.test\.ts' \
  extensions tests scripts docs eslint.config.js
```

Run this only in each family's final deletion plan, after all old-path references have named new owners. [VERIFIED: .planning/phases/06-assertion-and-module-refinement/06-CONTEXT.md:35-40]

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Fragment/label-object checks | Independently authored exact final bytes at observable producer boundaries; type-only enforcement when the label cannot render | MF-DEC-06 / Phase 6 | Assertions discriminate cardinality, tally grammar, ordering, and severity. [VERIFIED: .planning/phases/01-live-evidence-revalidation/01-REVALIDATION.json:88889-88905] |
| CommonJS builtin mutation + `syncBuiltinESMExports()` | Per-case real filesystem or narrow production-owned port | MF-DEC-07 / Phases 5-6 | Removes authorized shared-process test state while retaining fault/race proof. [VERIFIED: .planning/phases/01-live-evidence-revalidation/01-REVALIDATION.json:88908-88948] |
| Large hub retained as public facade | Leaf extraction followed by final hub deletion and atomic caller migration | D-06-11 through D-06-14 | No stable old path or compatibility tail survives. [VERIFIED: .planning/phases/06-assertion-and-module-refinement/06-CONTEXT.md:35-40] |
| One 5,638-line catalog test | Parser + 20 fixture slices + contract driver | MF-DEC-02 / Phase 6 | Parser, fixture ownership, and gate behavior become separately reviewable while retaining independent byte parity. [VERIFIED: current `wc -l` 2026-09-08; .planning/phases/01-live-evidence-revalidation/01-REVALIDATION.json:88807-88833] |

**Deprecated/outdated:**

- The historical notify/resolver/list recommendations that leave the original file as a thin entrypoint are superseded by D-06-13; final hubs must be deleted. [VERIFIED: .planning/reviews/unit-test-adversarial/shared-notify.md:69-77; .planning/reviews/unit-test-adversarial/domain-resolver.md:167-178; .planning/reviews/unit-test-adversarial/orchestrators-plugin-list-uninstall.md:61; .planning/phases/06-assertion-and-module-refinement/06-CONTEXT.md:39-40]
- The ledger's earlier 80-call builtin census is superseded by Phase 5's reviewed exact **85-call** manifest. [VERIFIED: .planning/phases/01-live-evidence-revalidation/01-REVALIDATION.json:88923; .planning/phases/05-injection-and-ownership-design/05-34-SUMMARY.md:128-174]

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| — | None. Recommendations are derived from locked decisions, terminal ledger evidence, current source/configuration, focused test runs, and official Node.js documentation. | — | — |

## Open Questions

1. **Does any final hub export map reveal a cycle too broad for one atomic move?**
   - What we know: D-06-12 explicitly anticipates this case and authorizes a smaller genuine leaf, not a forwarding seam. [VERIFIED: .planning/phases/06-assertion-and-module-refinement/06-CONTEXT.md:37-38]
   - What's unclear: The exact cycle can only be known after each preceding leaf move changes the import graph.
   - Recommendation: Put a pre-task export/caller/graph checkpoint in each final deletion plan; if it fails, replan a smaller leaf before editing.

2. **Which MF-DEC-01 artificial cases remain after prior phases' implementation drift?**
   - What we know: MF-DEC-01 routes prototype, validator-singleton, getter-sequence, and related shared-process surgery to Phase 6, but routes the two production index-loop rewrites to Phase 8. [VERIFIED: .planning/phases/01-live-evidence-revalidation/01-REVALIDATION.json:88725-88788]
   - What's unclear: Some earlier phases may have removed individual cases since the terminal ledger snapshot.
   - Recommendation: Begin the TREF-08 plan with a fresh CodeGraph-assisted census keyed by all 24 MF-DEC-01 IDs; schedule only surviving Phase 6-routed cases and explicitly leave `ER-F19` for Phase 8.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | all tests/type stripping | ✓ | `v26.8.1` local; Node `24` CI | CI is the release authority. [VERIFIED: environment probe 2026-09-08; .github/workflows/ci.yml:46-78] |
| npm | scripts and dependency graph | ✓ | `11.19.0` | — [VERIFIED: environment probe 2026-09-08] |
| ripgrep | stale-path and patch manifests | ✓ | `15.2.0` | — [VERIFIED: environment probe 2026-09-08] |
| CodeGraph | required code discovery | ✓ | `1.6.0` | Shell `codegraph explore`. [VERIFIED: AGENTS.md:2-9; environment probe 2026-09-08] |
| git | atomic plan commits and changed-pair discovery | ✓ | `2.55.0` | — [VERIFIED: environment probe 2026-09-08] |
| jq | terminal-ledger queries | ✓ | `1.8.1` | Node JSON parsing. [VERIFIED: environment probe 2026-09-08] |

**Missing dependencies with no fallback:** None. [VERIFIED: environment probe 2026-09-08]

**Missing dependencies with fallback:** None. [VERIFIED: environment probe 2026-09-08]

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Node.js built-in `node:test` on local `v26.8.1`; CI Node 24 [VERIFIED: package.json:82-95; .github/workflows/ci.yml:46-78] |
| Assertion library | `node:assert/strict` [VERIFIED: .planning/codebase/TESTING.md:5-13] |
| Config file | No runner config; package scripts define globs and `TEST_CONCURRENCY` forwarding. [VERIFIED: package.json:75-95] |
| Quick run command | `node --test <affected owner tests and command-flow proof>` |
| Direct-pair command | `npm run test:coverage:direct -- <source-or-test-path>` [VERIFIED: package.json:88-91; scripts/test-coverage-direct.mjs:480-510] |
| Structural command | `npm run test:corresponding && npm run test:coverage:direct:negative` [VERIFIED: package.json:83-91] |
| Full suite command | `npm run check` [VERIFIED: package.json:75-96] |

The current exact-output anchor run passed `tests/orchestrators/marketplace/autoupdate.test.ts`, `tests/orchestrators/marketplace/list.test.ts`, and `tests/orchestrators/plugin/list.test.ts` with 3/3 files passing, zero failures, skips, or todos; `npm run test:corresponding` also passed. [VERIFIED: focused commands executed 2026-09-08]

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| TREF-07 | Exact zero/one/many final bytes, structural cardinality from invocation form, visible plural tallies, full ordered notification arrays | owner unit + integration-style command proof | `node --test tests/orchestrators/marketplace/autoupdate.test.ts tests/orchestrators/marketplace/list.test.ts tests/orchestrators/plugin/list.test.ts tests/orchestrators/plugin/install.test.ts tests/orchestrators/plugin/update.test.ts tests/orchestrators/plugin/reinstall.test.ts` | ✅ current owners; redistributed leaf owners are ❌ Wave 0 |
| TREF-08 | Authorized global builtin/prototype/singleton/getter surgery removed; real temp state or existing port used; exact residual exclusion manifest | owner unit + static manifest | Run changed owner tests, then assert residual **2 files/18 sync** and **2 files/2 create**, plus no new ignore/test-only surface | ✅ current owners; manifest command belongs in plan verification |
| TREF-09 | Every new production module has one direct mirrored owner; each command retains one end-to-end proof; old hubs and references disappear | direct coverage + architecture + command-flow | `npm run test:corresponding && npm run test:coverage:direct -- <each-new-source> && node --test <affected architecture tests>` | ❌ new owner pairs are Wave 0 deliverables |
| TREF-09 | Final repository integration | full suite | `npm run check` | ✅ [VERIFIED: package.json:75-96] |

### Sampling Rate

- **Per task commit:** focused owner test plus `npm run test:coverage:direct -- <new-source>` for production pairs; catalog-only tasks run their parser/fixture/driver architecture tests. [VERIFIED: scripts/test-coverage-direct.mjs:480-510]
- **Per wave merge:** all changed command-flow proofs, `npm run test:corresponding`, affected architecture gates, `npm run typecheck`, `npm run lint`, and `npm run fallow`. [VERIFIED: package.json:75-96]
- **Phase gate:** complete `npm run check`, then the exact global-patch residual manifest and zero stale-path scans. [VERIFIED: .planning/phases/06-assertion-and-module-refinement/06-CONTEXT.md:28-40]

### Wave 0 Gaps

- [ ] Create each prescribed mirrored owner test in the same atomic task as its new production source; no orphan production file may exist between commits. [VERIFIED: scripts/check-corresponding-tests.mjs:135-173]
- [ ] Create `tests/architecture/catalog-uat/catalog-parser.test.ts` and `catalog-contract.test.ts` with the parser/driver split; fixture slices are test data, not production pairs. [VERIFIED: .planning/reviews/unit-test-adversarial/architecture-catalog-uat.md:117-150]
- [ ] Before moving tests, make an explicit ownership ledger from every legacy test block to exactly one new owner or retained command-flow proof. [VERIFIED: .planning/phases/06-assertion-and-module-refinement/06-CONTEXT.md:39-40]
- [ ] No framework installation or config is needed. [VERIFIED: package.json:75-96]

### Suggested Plan/Wave Shape

1. **Wave 1 — assertions:** TREF-07 exact-output/strict-boundary repairs and duplicate cleanup; preserve documented focused-body caveats. [VERIFIED: D-06-03 through D-06-07 in .planning/phases/06-assertion-and-module-refinement/06-CONTEXT.md:21-30]
2. **Wave 2 — shared-process surgery:** TREF-08 case-by-case patch removal using Phase 5 ports and real temp state; verify exact residual exclusions. [VERIFIED: .planning/phases/01-live-evidence-revalidation/01-REVALIDATION.json:88947-88948]
3. **Wave 3 — independent leaves:** resolver types/unsupported/path/MCP/hooks; notify types/grammar/summary/info/utilities; serialize any shared gate/doc edits. [VERIFIED: D-06-07/D-06-08 in .planning/phases/06-assertion-and-module-refinement/06-CONTEXT.md:28-31]
4. **Wave 4 — final resolver and notify owners:** move remaining sequencing/dispatch, migrate all callers, repoint gates/docs/invariants/tests, delete `resolver.ts` and `notify.ts`. [VERIFIED: D-06-11 through D-06-14 in .planning/phases/06-assertion-and-module-refinement/06-CONTEXT.md:35-40]
5. **Wave 5 — catalog:** split parser, 20 fixtures, and driver only after notification/emitter paths are stable; delete the old catalog test. [VERIFIED: D-06-07/D-06-08 in .planning/phases/06-assertion-and-module-refinement/06-CONTEXT.md:30-31]
6. **Waves 6-9 — command flows:** install, update, reinstall, list in that order; within each family move leaves first and delete the old hub only in its final serialized plan. [VERIFIED: D-06-09 in .planning/phases/06-assertion-and-module-refinement/06-CONTEXT.md:32]
7. **Closure — integration:** complete check, exact residual patch census, zero stale old paths, and explicit proof that info/uninstall/skills-stage exclusions did not change. [VERIFIED: .planning/phases/06-assertion-and-module-refinement/06-CONTEXT.md:33,42-47]

## Security Domain

Security enforcement is enabled because `.planning/config.json` does not set `security_enforcement` to `false`. [VERIFIED: .planning/config.json, read 2026-09-08]

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | No authentication behavior changes in this refactor. Preserve existing auth collaborators and tests. [VERIFIED: Phase boundary, .planning/phases/06-assertion-and-module-refinement/06-CONTEXT.md:7-10] |
| V3 Session Management | no | No session-lifecycle contract changes; environment keys remain unchanged. [VERIFIED: extensions/pi-claude-marketplace/shared/session-env.ts:37-70] |
| V4 Access Control | no new control | Preserve existing scope/path boundaries while moving owners. [VERIFIED: .fallowrc.json:69-132] |
| V5 Input Validation | yes | Preserve TypeBox resolver/persistence schemas, closed status/reason sets, path validation, and source classification under new owners. [VERIFIED: extensions/pi-claude-marketplace/persistence/state-io.ts:81-129,287-302; extensions/pi-claude-marketplace/shared/notify.ts:93-240,319-366,509-582] |
| V6 Cryptography | no | No cryptographic implementation is introduced or changed. [VERIFIED: Phase boundary, .planning/phases/06-assertion-and-module-refinement/06-CONTEXT.md:7-10] |

### Known Threat Patterns for This Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Path traversal or symlink escape weakened during resolver/path-safety moves | Tampering | Keep lexical containment, `lstat`/`readlink` inspection, exact error classes, and real filesystem proofs owned by `PathSafetyInspector`. [VERIFIED: .planning/phases/05-injection-and-ownership-design/05-34-SUMMARY.md:103-105] |
| Prototype pollution or inherited-property confusion in artificial tests | Tampering | Remove global prototype surgery; retain `prefer-object-has-own` and real own-property input validation. [VERIFIED: eslint.config.js:43-83; .planning/phases/01-live-evidence-revalidation/01-REVALIDATION.json:88753-88788] |
| Absolute-path disclosure through moved notification code | Information Disclosure | Keep `redactAbsolutePaths` as a production-used security leaf with its direct owner test and migrate every consumer atomically. [VERIFIED: extensions/pi-claude-marketplace/shared/notify.ts:288-299; .planning/reviews/unit-test-adversarial/shared-notify.md:75-77] |
| Direct output bypass after deleting `notify.ts` | Repudiation / Information Disclosure | Repoint the single sanctioned ESLint exemption to `notification-dispatch.ts`; keep direct `ctx.ui.notify`, stdout, stderr, and console calls forbidden elsewhere. [VERIFIED: eslint.config.js:86-147] |
| Shared-process test mutation masks race/order defects | Tampering | Use case-owned state or the exact Phase 5 ports; verify cleanup and public state/tree/output, not only calls. [VERIFIED: .planning/phases/01-live-evidence-revalidation/01-REVALIDATION.json:88947-88948] |

## Sources

### Primary (HIGH confidence)

- `.planning/phases/01-live-evidence-revalidation/01-REVALIDATION.json` — terminal decisions, finding routes, approved split program, assertion policy, and global-patch policy.
- `.planning/phases/06-assertion-and-module-refinement/06-CONTEXT.md` — locked Phase 6 decisions and exclusions.
- `.planning/phases/05-injection-and-ownership-design/05-34-SUMMARY.md` — exact port and builtin-patch manifests.
- Current production, test, script, configuration, and documentation files cited inline — live contracts and infrastructure.
- CodeGraph current repository index — symbol/call-path discovery before targeted reads, as required by AGENTS.md.

### Secondary (MEDIUM confidence)

- [Node.js v26.8.1 test runner documentation](https://nodejs.org/api/test.html) — test isolation and mock-tracker lifecycle.
- [Node.js v26.8.1 module documentation](https://nodejs.org/api/module.html#modulesyncbuiltinesmexports) — builtin ESM live-binding synchronization.
- [Node.js v26.8.1 assert documentation](https://nodejs.org/api/assert.html) — strict and deep-strict comparison semantics.

### Tertiary (LOW confidence)

- None.

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — live package/configuration inspection and environment probes.
- Architecture: HIGH — terminal ledger plus current CodeGraph/source responsibility traces.
- Pitfalls: HIGH — locked decisions, current source/test examples, and official Node.js behavior.
- Validation: HIGH — live package scripts, gate source, focused exact-output test run, and passing correspondence gate.

**Research date:** 2026-09-08
**Valid until:** 2026-10-08, or earlier if the terminal ledger, Phase 6 context, or module ownership graph changes.
