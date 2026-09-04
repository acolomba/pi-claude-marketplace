# Phase 109: Shared Contracts - Context

**Gathered:** 2026-08-29
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver compliant mirrored owner tests for the 19 production modules under
`extensions/pi-claude-marketplace/shared/`. Each pair must reach 100 percent direct
function, line, and branch coverage while preserving the current public surface. Tests
must pin complete error, reason, notification, marker, environment, filesystem, and cache
contracts through exact public values and side effects. No production module gains a
test-only export, reset hook, state reader, or test mode.

</domain>

<decisions>
## Implementation Decisions

### Milestone test contract carried forward

- **D-01:** Normalize all 19 Phase 109 owner tests, including tests whose accepted-HEAD
  triage already passes focused coverage. A passing brownfield test is input, not evidence
  that the pair satisfies v1.19.
- **D-02:** Every runtime case created or modified in this phase uses exact lowercase
  `// arrange`, `// act`, and `// assert` comments in that order, with the canonical blank
  lines. Lowercase `// act & assert` is limited to one `assert.throws()` or
  `assert.rejects()` expression. Data rows use separate phases.
- **D-03:** Type-only evidence uses positive `satisfies` checks and negative
  `@ts-expect-error` checks without artificial runtime cases or phase comments.
- **D-04:** Each case owns and restores its filesystem, environment, cache, console,
  notification, timer, mock, and other mutable state. Use current public seams and
  concern-local support; do not add a generic helper directory or test-only production
  state.

### Notification suite consolidation

- **D-05:** Consolidate the distinct public contracts in the legacy shared notification
  suites into the mirrored owner tests and delete the absorbed legacy suites. Do not add
  correspondence-gate exceptions for them. — **Reversibility:** costly — Reversing this
  would restore unexpected legacy suites and weaken the one-source-to-one-owner structure
  across a large public rendering surface.
- **D-06:** Split cases that currently exercise `notify-context.ts` and `notify.ts`
  together according to the module that owns the contract. `notify-context.test.ts` owns
  dispatch behavior through controlled renderers; `notify.test.ts` owns exact rendered
  bytes. Do not preserve or duplicate the old cross-module cases merely as supplemental
  tests.
- **D-07:** Express the large `notify.ts` output matrix as named data rows grouped by
  public status. Every row carries an expected full byte string independent of production
  constants and computations, and every runtime row follows the separate lowercase
  arrange/act/assert phase contract.
- **D-08:** Preserve every distinct public behavior represented by the legacy suites, but
  remove cases that only duplicate an already-proved contract. Remove migration history,
  relocation notes, and work-session commentary while retaining durable product and spec
  identifiers that still explain the contract.

### the agent's Discretion

- Choose the exact section ordering, local data-row shapes, and case names inside each
  mirrored owner test while keeping case titles behavior-focused and expected values
  independent from production code.
- Choose the precise legacy-case-to-owner mapping when a test file contains several
  concerns, provided each distinct public contract survives under the production module
  that owns it and no duplicate supplemental copy remains.
- Make behavior-preserving internal production refactors only where an existing public
  seam cannot provide complete direct coverage, and follow `DES-01` through `DES-03`.

</decisions>

<canonical_refs>

## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Milestone scope and acceptance

- `.planning/ROADMAP.md` — Phase 109 boundary, 19 source-test pairs, success criteria,
  dependencies, and execution order.
- `.planning/REQUIREMENTS.md` — `MOD-02` plus owner mapping, exact assertion,
  hermeticity, direct coverage, production-design, pair-atomic delivery, and suite-quality
  requirements.
- `.planning/PROJECT.md` — v1.19 intent, accepted brownfield baseline, preserved public
  contracts, and one-pair-per-plan policy.

### Unit-testing contract

- `.claude/rules/typescript-unit-testing.md` — executable rules for lowercase phases,
  independent expected values, doubles, direct coverage, and concern-local support.
- `docs/guidelines/typescript-unit-testing-guidelines.md` — normative testing rationale
  and complete TypeScript examples.

### Shared public contracts

- `docs/messaging-style-guide.md` — stable notification grammar and marker conventions.
- `docs/output-catalog.md` — canonical user-visible notification rows and exact output
  vocabulary.
- `docs/env-vars.md` — authoritative environment-variable delivery and session behavior
  relevant to `session-env.ts` and `vars.ts`.

</canonical_refs>

<code_context>

## Existing Code Insights

### Reusable Assets

- `tests/shared/notify-v2.test.ts` and the legacy `notify-*` / `snm*` suites contain a
  broad exact-byte rendering matrix that must be treated as consolidation input, not as
  retained supplemental ownership.
- `extensions/pi-claude-marketplace/shared/notify-context.ts` already exposes typed
  command-context dispatch functions and render-map seams suitable for direct controlled
  owner tests.
- `extensions/pi-claude-marketplace/shared/completion-cache.ts` exposes injected time and
  public invalidation operations around its memory and filesystem caches; tests can use
  unique keys and per-case temporary paths without a reset hook.
- `extensions/pi-claude-marketplace/shared/session-env.ts` separates pure environment
  projection (`claudeSessionEnvFor`, `applyPathLedger`) from the live `process.env`
  mutation (`applySessionEnv`).
- `extensions/pi-claude-marketplace/shared/debug-log.ts` has a single environment-gated
  `console.error` effect with no module state.

### Established Patterns

- Production and test paths mirror one-to-one; architecture and integration suites can
  supplement, but never replace, the owner test.
- Public output contracts use complete stable values and byte-exact strings. Expected
  values are written independently instead of being assembled from production constants.
- Filesystem cases use fresh real temporary directories with case-owned cleanup. Mutable
  globals and environment values are restored by the same case that changed them.
- Closed unions and type-only modules use compile-time positive and negative evidence,
  without fake runtime coverage ceremonies.

### Integration Points

- `notify.ts`, `notify-context.ts`, and `notify-reasons.ts` form the shared rendering
  vocabulary used by many later orchestrator phases. Phase 109 must freeze their public
  contracts without claiming completion for those consumers.
- `completion-cache.ts` coordinates module memory, persisted cache files, injected clocks,
  and public invalidation. Its owner test must prove both layers without leaking keys or
  files between cases.
- `session-env.ts`, `debug-log.ts`, and `vars.ts` interact with process-global state or
  user-visible effects. Their owner tests must restore the live process after every case.
- Architecture snapshot tests for extension version and markers remain supplemental drift
  guards; the new mirrored owner tests still directly import and prove their paired shared
  modules.

</code_context>

<specifics>
## Specific Ideas

- Notification output tables should remain readable as named public-status rows, not
  opaque snapshots.
- The exact phase comments are lowercase: `// arrange`, `// act`, and `// assert`;
  lowercase `// act & assert` applies only to one throwing or rejection expression.
- Consolidation preserves public evidence, not the historical file layout or duplicate
  copies of the same assertion.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

_Phase: 109-Shared Contracts_
_Context gathered: 2026-08-29_
