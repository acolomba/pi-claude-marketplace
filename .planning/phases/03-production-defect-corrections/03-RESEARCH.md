# Phase 3: Production Defect Corrections - Research

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

### Scope and sequencing

- **D-01:** Derive the implementation inventory from the active Phase 3 scope
  changes and terminal finding records in `01-REVALIDATION.json`; the historical
  review corpus supplies provenance, not independent authorization.
- **D-02:** Give every changed production owner a regression that demonstrably
  fails without its correction. Keep each defect and its owner regression
  independently reviewable where dependencies allow.
- **D-03:** Land behavior corrections before later test-architecture work and
  before the approved Phase 6 module splits. Do not combine a correction with a
  size-only extraction.

### Agent discovery (`PDEF-08`)

- **D-04:** Preserve the agents bridge's real multi-directory contract. Consume
  every resolved `componentPaths.agents` directory instead of flattening the
  list to its first member.
- **D-05:** Preserve resolved directory order and the bridge's deterministic
  first-wins duplicate policy. A later duplicate generated name is skipped with
  the existing discovery-warning behavior; it must not silently replace the
  first agent.
- **D-06:** Use the resolved plugin component paths as the production source of
  truth. Remove the single-directory asymmetry and any now-redundant flattened
  input rather than maintaining two competing agent-source representations.
- **D-07:** Prove a plugin with a declared agents directory plus the conventional
  `agents/` directory materializes agents from both, and prove duplicate handling
  across the two directories.

### Compact triggers (`PDEF-08`)

- **D-08:** Translate Pi compaction reasons with the direct three-to-two mapping:
  `manual` becomes Claude `manual`; `threshold` and `overflow` become Claude
  `auto`.
- **D-09:** Apply the same mapping to pre-compact and post-compact payloads.
  Update the associated supportability contract so both events admit exactly the
  translated `manual` and `auto` matcher values.
- **D-10:** Replace stale fixtures and comments rather than preserving the old
  constant-`auto` behavior. Give each Pi reason an independently asserted case
  in both payload owner suites, plus the relevant closed-set architecture proof.

### Rollback errors (`PDEF-08`)

- **D-11:** Ship the existing ES-4 rollback cause-chain contract and make
  `formatRollbackError` the single production rule used by the install ledger.
  — **Reversibility:** costly — removing the cause-chain later would change
  diagnostic behavior across the transaction-to-install boundary and require
  coordinated test and documentation changes.
- **D-12:** Preserve the original `PathContainmentError` object verbatim and
  suppress rollback-partial framing for that safety path. Preserve the original
  error object when no rollback partial exists. When partials exist, wrap once
  with the original error as `cause` and carry the structured partial rows.
- **D-13:** Delete the duplicate install-side formatting logic and correct every
  caller comment in the same change. Prove both the transaction owner and the
  live install integration; a test-only rollback module is not an acceptable
  endpoint.

### Typed failure classification (`PDEF-05`)

- **D-14:** Known lock-contention, sibling-sweep, and malformed-input outcomes
  must be classified from explicit error types, discriminants, or stable error
  codes. Error names and user-controlled message text are diagnostic data only,
  never control flow.
- **D-15:** Map the existing `StateLockHeldError` explicitly to the closed
  `lock held` reason wherever the terminal uninstall/cascade path reaches it.
  Align sibling narrowers for the same cause instead of letting equivalent
  failures render different reasons.
- **D-16:** Keep typed classifiers with their production owner unless two or
  more live owners genuinely share the same domain rule. Shared transport and
  errno helpers may be reused; do not create a universal error taxonomy.
- **D-17:** Remove message-substring fallbacks for the confirmed known cases.
  Unknown failures use the owner's existing honest generic reason. Regression
  cases must vary the human-readable message while preserving the typed signal
  to prove classification is message-independent.

### Cleanup, warnings, and diagnostics (`PDEF-06`)

- **D-18:** The operation's original failure remains the primary error. Cleanup
  failure never replaces it, changes its reason, or erases its cause chain.
- **D-19:** Carry cleanup problems as structured, readonly context using the
  existing phase/bridge failure channels where possible. Render text only at the
  notification boundary; do not make later control flow parse a cleanup string.
- **D-20:** Capture every terminal update prepare, abort, commit, and rollback
  cleanup descriptor currently discarded, including commands and skills paths.
  Successful cleanup adds no warning.
- **D-21:** For each failure-path regression, assert the primary error by
  identity or cause, assert the exact cleanup context, and inspect the temporary
  filesystem to prove no staging, backup, or temporary artifact remains. If
  cleanup itself is deliberately failed, assert the exact residual-artifact
  descriptor instead of pretending removal succeeded.
- **D-22:** Do not broaden terminal update cleanup work into the separately
  deferred warning-channel product decisions.

### Dynamic lookups and unreachable branches (`PDEF-07`)

- **D-23:** Guard open-string lookup tables with own-key membership or a `Map`.
  Prototype members such as `constructor` and `toString` are unsupported input,
  not valid table entries or fallbacks.
- **D-24:** Preserve real trust-boundary guards. Remove only branches proven to
  have no production producer, or restructure locally so compiler-forced
  fallbacks become honestly reachable through the public contract. Delete the
  artificial test case with the removed branch.
- **D-25:** Do not add ignore pragmas, test-only exports, invalid casts, prototype
  mutation, or mutable-discriminator fixtures to manufacture coverage.

### Reconcile aliases and selected output behavior (`PDEF-01`, `PDEF-08`)

- **D-26:** Carry the resolved Phase 1 alias decision unchanged: resolve declared
  plugin keys through a one-to-one declared-key-to-recorded-name source-claim
  map, preserve the manifest-derived canonical state identity, and fail closed
  when a claim is absent or ambiguous.
- **D-27:** Exercise the alias plan and apply path with distinct independently
  authored declared and manifest names. Apply twice and prove fixed-point
  convergence with no repeated failure or network work.
- **D-28:** Carry the resolved structural-cardinality decision unchanged. Current
  `notifyWithContext` producers must declare single versus plural from invocation
  structure, never row count; newly visible tallies require exact output-catalog
  and owner-test updates in the same change.

### the agent's Discretion

- Choose local type and helper names, and choose the smallest production-owned
  placement that satisfies the contracts above.
- Sequence independent owner corrections to minimize overlapping edits in the
  large update and notification modules.
- Choose whether a cleanup detail extends an existing failure record or uses a
  narrowly scoped sibling type, provided it remains structured and readonly.
- Choose the exact own-key implementation (`Object.hasOwn` or `Map`) that best
  fits each existing lookup table.

### Deferred Ideas (OUT OF SCOPE)

- Broad resolver, notify, install, update, reinstall, list, and catalog module
  splits remain in Phase 6 after production behavior is corrected.
- Assertion-strength, test-double, hidden-dependency, and broader hermeticity
  work remains in Phases 4-6 unless a direct Phase 3 owner regression requires a
  narrowly scoped fixture.
- Coverage and general gate enforcement remain in Phases 7-8.
- Warning-channel product decisions `ENWARN-01`, `UPCASC-01`, and `WCHAN-01`
  remain outside this milestone scope.

### Reviewed Todos (not folded)

- `Detect unused code and type members in the real production program` remains
  assigned to Phase 7. It is a structural gate and does not correct a Phase 3
  production defect.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|---|---|---|
| PDEF-01 | Each terminally confirmed production defect routed to Phase 3 has a direct owner regression that fails without the correction and passes with it; stale, struck, and evidence-only claims authorize no implementation. | Inventory and per-owner validation commands below. [VERIFIED: `.planning/REQUIREMENTS.md:26-28`] |
| PDEF-05 | Terminal lock-contention, sibling-sweep, and malformed-input reasons use explicit typed classifications instead of message-substring flow. | Typed classification owner map and varying-message test pattern below. [VERIFIED: `.planning/REQUIREMENTS.md:35-36`] |
| PDEF-06 | Terminal update cleanup, warning, and diagnostic paths preserve the primary error, attach cleanup context, and leave no persistent artifact. | Structured cleanup propagation map and filesystem assertions below. [VERIFIED: `.planning/REQUIREMENTS.md:37-38`] |
| PDEF-07 | Terminal dynamic lookups reject unsupported values safely and unreachable test-shaped branches are removed without weakening real guards. | Own-key lookup correction and trace-proof gate below. [VERIFIED: `.planning/REQUIREMENTS.md:39-40`] |
| PDEF-08 | The one-to-one reconcile-alias source-claim map fails closed while preserving manifest-derived state identity; independently terminal agent-discovery, compact-trigger, and rollback behavior keeps its own route. | Four separate owner clusters below. [VERIFIED: `.planning/REQUIREMENTS.md:41-43`] |
</phase_requirements>

## Summary

Phase 3 should be planned as eight production-owner corrections, not as a general cleanup phase: agent-directory propagation; compact trigger translation; install rollback ownership; typed failure classification; update cleanup propagation; safe dynamic lookup plus trace-proven dead-branch removal; reconcile alias mapping; and structural notification cardinality. Each cluster has an existing production seam and existing paired tests, so the plan should keep them independently reviewable and run direct-pair coverage after each owner change. [VERIFIED: `.planning/phases/03-production-defect-corrections/03-CONTEXT.md:9-19`, `.planning/phases/03-production-defect-corrections/03-CONTEXT.md:28-36`]

No new package or external service is required. The correction should use existing types, bridges, notification rendering, transaction formatting, and Node test infrastructure. [VERIFIED: `package.json:8-30`, `package.json:75-96`]

**Primary recommendation:** plan one task per correction cluster, with the production owner and its direct regression in the same task; put the shared `plugin/update.ts` cleanup/classification work in its own wave to avoid overlapping edits. [VERIFIED: `.planning/phases/03-production-defect-corrections/03-CONTEXT.md:31-36`, `.planning/phases/03-production-defect-corrections/03-CONTEXT.md:146-151`]

## Authorized Implementation Inventory

| Cluster | Production owners | Required correction | Direct proof |
|---|---|---|---|
| Multi-directory agents | `orchestrators/plugin/discover-names.ts`, `bridges/agents/types.ts`, `bridges/agents/stage.ts`, and install/update/reinstall callers | Replace singular `agentsSourceDir` propagation with all resolved agent directories; preserve order and first-wins warning behavior. Current singular value is verbatim `readonly agentsSourceDir: string | null`. [VERIFIED: `extensions/pi-claude-marketplace/orchestrators/plugin/discover-names.ts:24-65`, `extensions/pi-claude-marketplace/bridges/agents/types.ts:66-75`] | Declared plus conventional directories both materialize; later duplicate is warned and skipped. [VERIFIED: `.planning/phases/03-production-defect-corrections/03-CONTEXT.md:40-52`] |
| Compact triggers | pre/post compact translators and `domain/components/hook-events.ts` | Map Pi reasons verbatim `"manual" | "threshold" | "overflow"` to Claude triggers verbatim `"manual" | "auto"`; admit exactly those two target matcher values for both events. [VERIFIED: `node_modules/@earendil-works/pi-coding-agent/dist/core/extensions/types.d.ts:442-461`, `extensions/pi-claude-marketplace/bridges/hooks/payloads/pre-compact.ts:19-36`, `extensions/pi-claude-marketplace/bridges/hooks/payloads/post-compact.ts:15-29`] | Three independent source-reason cases in each payload suite and exact closed-set assertions in `hook-events.test.ts`. [VERIFIED: `.planning/phases/03-production-defect-corrections/03-CONTEXT.md:56-64`] |
| Rollback ownership | `transaction/rollback.ts`, `orchestrators/plugin/install.ts`, install messaging only as needed | Make the failed ledger path call `formatRollbackError`; capture its returned partials and throw its returned error. Remove duplicate path/partial interpretation in the install owner while retaining notification rendering. [VERIFIED: `extensions/pi-claude-marketplace/transaction/rollback.ts:33-74`, `extensions/pi-claude-marketplace/orchestrators/plugin/install.ts:1252-1270`] | Transaction identity/cause/partials tests plus live install failure integration. [VERIFIED: `.planning/phases/03-production-defect-corrections/03-CONTEXT.md:68-80`] |
| Typed reasons | `orchestrators/plugin/uninstall.ts`, `orchestrators/plugin/update.ts`, affected sibling narrowers | Add explicit `StateLockHeldError` handling and replace confirmed update message-substring branches with local error classes/discriminants/stable codes. Preserve owner-generic fallbacks. The closed token is verbatim `"lock held"`. [VERIFIED: `extensions/pi-claude-marketplace/shared/errors.ts:334-345`, `extensions/pi-claude-marketplace/shared/notify.ts:113-130`, `extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts:160-193`, `extensions/pi-claude-marketplace/orchestrators/plugin/update.ts:657-688`, `extensions/pi-claude-marketplace/orchestrators/plugin/update.ts:2877-2924`] | Construct the same typed signal with different messages and assert the same exact reason. [VERIFIED: `.planning/phases/03-production-defect-corrections/03-CONTEXT.md:84-98`] |
| Update cleanup | `orchestrators/plugin/update.ts` plus existing bridge cleanup returns | Preserve commands and skills descriptors currently discarded by abort and commit paths; carry frozen structured rows while keeping the original failure by identity or `cause`. Current update aborts await commands/skills without collecting returns, and command commit ignores its return. [VERIFIED: `extensions/pi-claude-marketplace/orchestrators/plugin/update.ts:1393-1415`, `extensions/pi-claude-marketplace/orchestrators/plugin/update.ts:2086-2115`] | Assert primary error, exact cleanup rows, and actual absence of staging/backup/temp files; deliberately failed cleanup asserts the exact residual descriptor. [VERIFIED: `.planning/phases/03-production-defect-corrections/03-CONTEXT.md:102-116`] |
| Lookup and trace correction | `domain/components/hook-tool-names.ts`, `domain/components/hooks/matcher.ts`, plus only terminally authorized no-producer branches | Guard both open-string object reads with own-key membership. Remove a branch only after a producer trace proves it unreachable; preserve filesystem/path guards. Current reads index plain objects directly. [VERIFIED: `extensions/pi-claude-marketplace/domain/components/hook-tool-names.ts:76-87`, `extensions/pi-claude-marketplace/domain/components/hook-tool-names.ts:132-134`, `extensions/pi-claude-marketplace/domain/components/hooks/matcher.ts:44-58`] | `constructor` and `toString` reject as unsupported while real keys and custom passthrough remain correct; dead-branch task records its producer proof and deletes the artificial case. [VERIFIED: `.planning/phases/03-production-defect-corrections/03-CONTEXT.md:120-128`] |
| Reconcile aliases | `orchestrators/reconcile/plan.ts`, `apply.ts` only where outcome threading requires it | Replace the recorded-name-only claim set with a one-to-one declared-key → canonical recorded-name mapping; zero or multiple source matches fail closed; use canonical marketplace identity for plugin action lookup. Current source matching returns the first eligible record and discards the declared-to-recorded association. [VERIFIED: `extensions/pi-claude-marketplace/orchestrators/reconcile/plan.ts:93-135`, `extensions/pi-claude-marketplace/orchestrators/reconcile/plan.ts:137-225`, `extensions/pi-claude-marketplace/orchestrators/reconcile/plan.ts:259-343`] | Independently authored declared alias and manifest name; exact plan, exact apply outcome, second apply has no operation and no network call. [VERIFIED: `.planning/phases/03-production-defect-corrections/03-CONTEXT.md:132-138`, `extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts:292-320`] |
| Output cardinality | marketplace `autoupdate.ts`, `list.ts`, owner tests, `tests/architecture/catalog-uat.test.ts` | Pass verbatim `"single" | "plural"` from invocation shape, not row count. Named autoupdate is single; bare autoupdate and list are plural, including zero/one-row outcomes. Current producers omit cardinality. [VERIFIED: `extensions/pi-claude-marketplace/shared/notify-context.ts:140-172`, `extensions/pi-claude-marketplace/orchestrators/marketplace/autoupdate.ts:538-543`, `extensions/pi-claude-marketplace/orchestrators/marketplace/autoupdate.ts:606-609`, `extensions/pi-claude-marketplace/orchestrators/marketplace/list.ts:98-104`] | Exact owner output plus catalog fixtures for single named, plural bare zero, plural bare one, and plural multi-row cases. [VERIFIED: `.planning/phases/03-production-defect-corrections/03-CONTEXT.md:139-142`, `tests/architecture/catalog-uat.test.ts:2911-2941`, `tests/architecture/catalog-uat.test.ts:4167-4248`] |

Anything stale, struck, superseded, supporting-only, evidence-only, size-only, or assigned to Phases 4-8 is not authorized here. [VERIFIED: `.planning/phases/03-production-defect-corrections/03-CONTEXT.md:9-19`, `.planning/phases/03-production-defect-corrections/03-CONTEXT.md:268-281`]

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|---|---|---|---|
| Plugin lifecycle and reconcile planning | API / Backend | Database / Storage | Orchestrators decide actions; persisted config/state supplies canonical identity. [VERIFIED: `extensions/pi-claude-marketplace/orchestrators/reconcile/plan.ts:137-225`] |
| Component materialization | API / Backend | Database / Storage | Bridges discover and stage filesystem resources; orchestrators own sequencing. [VERIFIED: `extensions/pi-claude-marketplace/bridges/agents/discover.ts:57-115`, `extensions/pi-claude-marketplace/bridges/agents/stage.ts:97-140`] |
| Hook payload translation | API / Backend | — | Payload bridges translate Pi event types into Claude-compatible envelopes. [VERIFIED: `extensions/pi-claude-marketplace/bridges/hooks/payloads/pre-compact.ts:19-37`, `extensions/pi-claude-marketplace/bridges/hooks/payloads/post-compact.ts:15-30`] |
| Error classification and notification rendering | API / Backend | — | Owners classify typed causes; shared notify code renders final text. [VERIFIED: `.planning/phases/03-production-defect-corrections/03-CONTEXT.md:84-98`, `.planning/phases/03-production-defect-corrections/03-CONTEXT.md:104-106`] |

## Project Constraints (from AGENTS.md)

- Because `.codegraph/` exists, use CodeGraph before grep/find/direct file reading when locating or understanding code; `codegraph explore "<question>"` is the always-available shell form. [VERIFIED: `AGENTS.md:2-9`]

## Standard Stack

### Core

| Library/runtime | Version | Purpose | Why standard here |
|---|---|---|---|
| Node.js | `>=20.19.0` (workspace: `v24.12.0`) | Runtime and built-in test runner | Existing engine and scripts; no replacement. [VERIFIED: `package.json:32-34`, `node --version`] |
| TypeScript | `^6.0.3` | Strict source typing | Existing dev dependency. [VERIFIED: `package.json:28-30`] |
| Pi Coding Agent types | `^0.84.2` | Event contracts | Installed declaration supplies compact reason union. [VERIFIED: `package.json:14-16`, `node_modules/@earendil-works/pi-coding-agent/dist/core/extensions/types.d.ts:442-461`] |
| `node:test` + `node:assert/strict` | built into Node | Owner regressions | Project test standard. [VERIFIED: `.agents/skills/typescript-unit-testing-review/SKILL.md:12-19`] |

### Supporting

| Library/tool | Version | Purpose | When to use |
|---|---|---|---|
| `strong-mock` | `^9.2.2` | Strict interaction doubles | Only when the interaction itself is public behavior. [VERIFIED: `package.json:27`, `.agents/skills/typescript-unit-testing-review/SKILL.md:66-72`] |
| Direct-pair coverage script | repository script | Per-owner 100% line/function/branch check | After every changed production owner. [VERIFIED: `package.json:88-91`, `.agents/skills/typescript-unit-testing-review/SKILL.md:14-15`, `.agents/skills/typescript-unit-testing-review/SKILL.md:23-26`] |

No installation or package legitimacy audit is needed: this phase introduces no dependency. [VERIFIED: `.planning/phases/03-production-defect-corrections/03-CONTEXT.md:213-225`]

## Architecture Patterns

### System Architecture Diagram

```text
Pi event / command / persisted declaration
                 |
                 v
     owner translator or orchestrator
        | typed decision / mapping |
        +-------------+------------+
                      v
       bridge / transaction / state boundary
        | success                 | failure
        v                         v
 canonical state/artifacts   typed error + structured context
        |                         |
        +------------+------------+
                     v
          shared notification renderer
                     |
                     v
             exact operator output
```

The diagram reflects the existing separation: classification stays with the production owner, bridge/transaction results stay structured, and text is rendered only at the notification boundary. [VERIFIED: `.planning/phases/03-production-defect-corrections/03-CONTEXT.md:92-106`, `.planning/phases/03-production-defect-corrections/03-CONTEXT.md:220-225`]

### Recommended Project Structure

Keep corrections in the existing mirrored owners; do not create a Phase 3 umbrella module. [VERIFIED: `.planning/phases/03-production-defect-corrections/03-CONTEXT.md:34-36`, `.planning/phases/03-production-defect-corrections/03-CONTEXT.md:92-94`]

```text
extensions/pi-claude-marketplace/
├── bridges/                 # discovery, staging, payload translation
├── domain/components/       # matcher/supportability contracts
├── orchestrators/           # lifecycle and reconcile decisions
├── shared/                  # genuinely shared errors/notification types
└── transaction/             # phase ledger and rollback formatting
tests/
├── bridges|domain|orchestrators|transaction/  # mirrored owner suites
└── architecture/            # closed-set and exact output catalog proofs
```

### Pattern 1: Ordered first-wins discovery

The existing bridge already uses a `Map`, iterates directories in supplied order, warns on a duplicate, and keeps the first value. Reuse that contract; fix upstream flattening. [VERIFIED: `extensions/pi-claude-marketplace/bridges/agents/discover.ts:57-115`]

### Pattern 2: Typed cause, structured context, boundary rendering

The existing update phase failure record has verbatim fields `readonly phase`, `readonly msg`, and `readonly cause`, with phase values `"skills" | "commands" | "agents" | "hooks" | "mcp"`. Extend this shape or add a narrow sibling rather than parsing cleanup text. [VERIFIED: `extensions/pi-claude-marketplace/shared/errors.ts:348-370`]

### Anti-Patterns to Avoid

- Do not add module splits, test-only exports, casts, prototype mutation, ignored coverage, or broad warning-channel work. [VERIFIED: `.planning/phases/03-production-defect-corrections/03-CONTEXT.md:123-128`, `.planning/phases/03-production-defect-corrections/03-CONTEXT.md:268-281`]
- Do not decide cardinality from `rows.length`; invocation structure owns it. [VERIFIED: `.planning/phases/03-production-defect-corrections/03-CONTEXT.md:139-142`]
- Do not use error message substrings as semantic signals. [VERIFIED: `.planning/phases/03-production-defect-corrections/03-CONTEXT.md:84-98`]
- Do not treat source-match iteration order as proof of alias uniqueness. [VERIFIED: `extensions/pi-claude-marketplace/orchestrators/reconcile/plan.ts:118-135`, `.planning/phases/03-production-defect-corrections/03-CONTEXT.md:132-135`]

## Don't Hand-Roll

| Problem | Don't build | Use instead | Why |
|---|---|---|---|
| Agent deduplication | A second orchestrator-side merge | Existing `discoverPluginAgents` ordered `Map` policy | It already produces deterministic first-wins rows and warnings. [VERIFIED: `extensions/pi-claude-marketplace/bridges/agents/discover.ts:57-115`] |
| Rollback composition | Install-local partial/cause formatting | `formatRollbackError` | It already encodes containment bypass, identity, cause, and structured partial rules. [VERIFIED: `extensions/pi-claude-marketplace/transaction/rollback.ts:38-74`] |
| Failure taxonomy | A universal error classifier | Owner-local typed classes plus existing errno/transport helpers | Locked decision requires smallest genuine owner. [VERIFIED: `.planning/phases/03-production-defect-corrections/03-CONTEXT.md:84-98`] |
| Cleanup strings | A concatenated diagnostic later parsed by control flow | Readonly cleanup records rendered at notify boundary | Preserves the primary failure and exact cleanup context. [VERIFIED: `.planning/phases/03-production-defect-corrections/03-CONTEXT.md:102-114`] |
| Alias identity | Renaming state to the declared alias | One-to-one source-claim map to canonical recorded name | Manifest-derived state identity is locked. [VERIFIED: `.planning/phases/03-production-defect-corrections/03-CONTEXT.md:132-138`] |

## Common Pitfalls

### Scope creep from historical findings

**What goes wrong:** a stale or later-phase review item becomes an implementation task. **Avoidance:** every task must cite an active Phase 3 requirement and a locked decision; otherwise omit it. [VERIFIED: `.planning/phases/03-production-defect-corrections/03-CONTEXT.md:9-19`, `.planning/phases/03-production-defect-corrections/03-CONTEXT.md:28-36`]

### Fixing the helper but not the live path

**What goes wrong:** rollback unit tests pass while install still throws `result.error` directly. **Warning sign:** `formatRollbackError` has no production caller. [VERIFIED: `extensions/pi-claude-marketplace/orchestrators/plugin/install.ts:1252-1270`, `.planning/phases/03-production-defect-corrections/03-CONTEXT.md:77-80`]

### Losing cleanup results at an `await`

**What goes wrong:** abort/commit executes, but its descriptor is discarded. **Warning sign:** a cleanup call is awaited without assigning or aggregating its return. [VERIFIED: `extensions/pi-claude-marketplace/orchestrators/plugin/update.ts:1393-1415`, `extensions/pi-claude-marketplace/orchestrators/plugin/update.ts:2099-2103`]

### Alias fixtures with equal names

**What goes wrong:** tests never exercise declared-to-canonical mapping. **Avoidance:** use visibly different independently authored names, then apply twice. [VERIFIED: `.planning/phases/03-production-defect-corrections/03-CONTEXT.md:136-138`, `.planning/phases/03-production-defect-corrections/03-CONTEXT.md:258-259`]

### Row-count cardinality

**What goes wrong:** a plural zero/one-row invocation omits its tally or a single target gains one. **Avoidance:** choose cardinality before results exist. [VERIFIED: `.planning/phases/03-production-defect-corrections/03-CONTEXT.md:139-142`, `extensions/pi-claude-marketplace/shared/notify-context.ts:161-172`]

## Code Examples

### Existing first-wins pattern to preserve

```typescript
// Source: extensions/pi-claude-marketplace/bridges/agents/discover.ts:93-108
if (seenByGenerated.has(generatedName)) {
  warnings.push(duplicateWarning(sourceName, agentsDir, generatedName));
  continue;
}

seenByGenerated.set(generatedName, {
  sourceName,
  generatedName,
  sourcePath,
  sourceHash,
  raw,
  body,
});
```

### Existing rollback rule to wire into production

```typescript
// Source: extensions/pi-claude-marketplace/transaction/rollback.ts:63-74
if (originalError instanceof PathContainmentError) {
  return { error: originalError, rollbackPartials: [] };
}

if (result.rollbackPartials.length === 0) {
  return { error: originalError, rollbackPartials: [] };
}

return {
  error: new Error(originalError.message, { cause: originalError }),
  rollbackPartials: result.rollbackPartials,
};
```

## State of the Art

| Current code | Required Phase 3 state | Impact |
|---|---|---|
| Singular agent directory | Ordered list of all resolved directories | Restores existing bridge contract. [VERIFIED: `extensions/pi-claude-marketplace/orchestrators/plugin/discover-names.ts:54-64`, `extensions/pi-claude-marketplace/bridges/agents/discover.ts:57-66`] |
| Constant compact `"auto"` | Direct three-to-two reason mapping | Manual compaction remains distinguishable. [VERIFIED: `extensions/pi-claude-marketplace/bridges/hooks/payloads/pre-compact.ts:27-37`, `extensions/pi-claude-marketplace/bridges/hooks/payloads/post-compact.ts:23-30`] |
| Message-driven known cases | Typed/discriminated/code-driven known cases | Diagnostics can change without changing semantics. [VERIFIED: `extensions/pi-claude-marketplace/orchestrators/plugin/update.ts:674-687`, `extensions/pi-claude-marketplace/orchestrators/plugin/update.ts:2896-2924`] |
| First source match, association discarded | One-to-one fail-closed claim map | Alias plan/apply reaches a fixed point. [VERIFIED: `extensions/pi-claude-marketplace/orchestrators/reconcile/plan.ts:118-135`, `extensions/pi-claude-marketplace/orchestrators/reconcile/plan.ts:145-170`] |

## Assumptions Log

All implementation constraints and code observations in this research were verified against current repository sources or the locked phase context. No `[ASSUMED]` claim is used to authorize a task.

## Open Questions

None block planning. Local helper/type names and whether cleanup detail extends `Phase3Failure` or uses a narrow sibling remain intentionally within the agent's discretion. [VERIFIED: `.planning/phases/03-production-defect-corrections/03-CONTEXT.md:144-153`]

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|---|---|---|---|---|
| Node.js | tests/typecheck/runtime | ✓ | `v24.12.0` | — [VERIFIED: `node --version`] |
| npm | project gates | ✓ | `11.19.0` | — [VERIFIED: `npm --version`] |
| Git | repository workflow | ✓ | `2.55.0` | — [VERIFIED: `git --version`] |

**Missing dependencies with no fallback:** none. [VERIFIED: environment probes above]

## Validation Architecture

### Test Framework

| Property | Value |
|---|---|
| Framework | Node built-in `node:test` with `node:assert/strict` [VERIFIED: `.agents/skills/typescript-unit-testing-review/SKILL.md:12-19`] |
| Config file | none; commands live in `package.json` [VERIFIED: `package.json:75-96`] |
| Quick run command | `node --test <owning-test-path>` [VERIFIED: `.agents/skills/typescript-unit-testing-review/SKILL.md:12-15`] |
| Direct coverage | `npm run test:coverage:direct -- <source-path>` [VERIFIED: `.agents/skills/typescript-unit-testing-review/SKILL.md:12-15`] |
| Full suite command | `npm run check` [VERIFIED: `package.json:75-96`] |

The current targeted baseline is green: 15 owner suites passed, with zero failures, on 2026-09-06. [VERIFIED: `node --test` targeted baseline executed this session]

### Phase Requirements → Test Map

| Req ID | Behavior | Test type | Automated command | File exists? |
|---|---|---|---|---|
| PDEF-01 | Every correction has a discriminating owner regression | unit + direct coverage | `node --test <owner>.test.ts && npm run test:coverage:direct -- <owner>.ts` | ✅ owners exist; new cases required [VERIFIED: `package.json:82-90`] |
| PDEF-05 | Typed lock/sibling/malformed classification ignores message wording | unit | `node --test tests/orchestrators/plugin/uninstall.test.ts tests/orchestrators/plugin/update.test.ts` | ✅ [VERIFIED: targeted baseline] |
| PDEF-06 | Primary error and cleanup context survive; temp artifacts do not | unit/integration-style filesystem | `node --test tests/orchestrators/plugin/update.test.ts` | ✅ [VERIFIED: targeted baseline] |
| PDEF-07 | Prototype keys reject and genuine guards remain | unit + structural | `node --test tests/domain/components/hook-tool-names.test.ts tests/domain/components/hooks/matcher.test.ts` | ✅ [VERIFIED: targeted baseline] |
| PDEF-08 | Alias, agents, compact, rollback, cardinality | unit + catalog | `node --test tests/orchestrators/reconcile/plan.test.ts tests/orchestrators/reconcile/apply.test.ts tests/bridges/agents/discover.test.ts tests/bridges/agents/stage.test.ts tests/bridges/hooks/payloads/pre-compact.test.ts tests/bridges/hooks/payloads/post-compact.test.ts tests/domain/components/hook-events.test.ts tests/transaction/rollback.test.ts tests/orchestrators/plugin/install.test.ts tests/orchestrators/marketplace/autoupdate.test.ts tests/orchestrators/marketplace/list.test.ts tests/architecture/catalog-uat.test.ts` | ✅; new cases required [VERIFIED: targeted baseline and repository file inventory] |

### Sampling Rate

- **Per task commit:** owning `node --test` suite, then direct-pair coverage for every changed production file. [VERIFIED: `.agents/skills/typescript-unit-testing-review/SKILL.md:12-15`, `.agents/skills/typescript-unit-testing-review/SKILL.md:23-26`]
- **Per wave merge:** `npm run check`. [VERIFIED: `package.json:75-96`]
- **Phase gate:** full `npm run check` green before verification. [VERIFIED: `.agents/skills/typescript-unit-testing-review/SKILL.md:12-15`]

### Wave 0 Gaps

- No framework/config gap. Add missing regression cases inside existing mirrored owner suites. [VERIFIED: targeted baseline and repository test inventory]
- Correct the PDEF-08 test-map typo when planning: the exact existing paths are `tests/bridges/hooks/payloads/pre-compact.test.ts` and `tests/bridges/hooks/payloads/post-compact.test.ts`. [VERIFIED: repository file inventory]

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---|---|---|
| V2 Authentication | no | No authentication change in this phase. [VERIFIED: `.planning/phases/03-production-defect-corrections/03-CONTEXT.md:9-19`] |
| V3 Session Management | no | Session events are translated, not authenticated or persisted as sessions. [VERIFIED: `extensions/pi-claude-marketplace/bridges/hooks/payloads/pre-compact.ts:19-37`] |
| V4 Access Control | no | No authorization boundary changes. [VERIFIED: `.planning/phases/03-production-defect-corrections/03-CONTEXT.md:9-19`] |
| V5 Input Validation | yes | Own-key membership for open strings; typed errors/codes for failure control flow; fail-closed alias uniqueness. [VERIFIED: `.planning/phases/03-production-defect-corrections/03-CONTEXT.md:84-98`, `.planning/phases/03-production-defect-corrections/03-CONTEXT.md:120-135`] |
| V6 Cryptography | no | No cryptographic behavior changes. [VERIFIED: authorized inventory above] |

### Known Threat Patterns

| Pattern | STRIDE | Standard mitigation |
|---|---|---|
| Inherited prototype member accepted as a tool mapping | Spoofing / Tampering | Own-key membership before lookup; test `constructor` and `toString`. [VERIFIED: `extensions/pi-claude-marketplace/domain/components/hook-tool-names.ts:132-134`, `extensions/pi-claude-marketplace/domain/components/hooks/matcher.ts:44-58`, `.planning/phases/03-production-defect-corrections/03-CONTEXT.md:120-122`] |
| Ambiguous source claim selects arbitrary canonical record | Tampering | Require exactly one source claim; zero or multiple matches fail closed. [VERIFIED: `.planning/phases/03-production-defect-corrections/03-CONTEXT.md:132-138`] |
| Cleanup failure hides the primary operation failure | Repudiation | Preserve primary error identity/cause and attach readonly cleanup rows. [VERIFIED: `.planning/phases/03-production-defect-corrections/03-CONTEXT.md:102-114`] |
| Dead-branch deletion weakens a path safety guard | Tampering | Require producer trace; preserve real trust-boundary guards. [VERIFIED: `.planning/phases/03-production-defect-corrections/03-CONTEXT.md:123-128`] |

## Sources

### Primary (HIGH confidence)

- Current production and paired test sources cited inline — exact runtime contracts and defects.
- `.planning/phases/03-production-defect-corrections/03-CONTEXT.md` — locked scope and implementation decisions.
- `.planning/REQUIREMENTS.md` — authoritative Phase 3 requirement text.
- `package.json` and installed Pi type declarations — runtime, scripts, and compact event contract.

### Secondary (MEDIUM confidence)

- `.planning/codebase/TESTING.md` — mapped repository testing conventions, cross-checked against current scripts and project skills.

### Tertiary (LOW confidence)

- None used to authorize work. The research-plan seam returned no external fetches because this is a local codebase phase and external research providers are disabled. [VERIFIED: `.planning/config.json:6-8`, `.planning/config.json:16-22`]

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — current manifest, installed type declarations, and local tool probes.
- Architecture: HIGH — current source owners and call paths inspected with CodeGraph and direct source reads.
- Pitfalls: HIGH — each pitfall is a locked decision or an observed current-code seam.

**Research date:** 2026-09-06
**Valid until:** 2026-10-06 (stable local-code research; re-check if Phase 3 sources change)
