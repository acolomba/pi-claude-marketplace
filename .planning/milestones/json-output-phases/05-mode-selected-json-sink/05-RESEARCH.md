# Phase 5: Mode-Selected JSON Sink - Research

**Researched:** 2026-10-06
**Domain:** Pi extension notification transport and lifecycle containment
**Confidence:** MEDIUM

<user_constraints>
## User Constraints (from CONTEXT.md)

The following decisions, discretion, and deferrals are copied verbatim.
[VERIFIED: .planning/phases/05-mode-selected-json-sink/05-CONTEXT.md:25-77,126-131]

<!-- DATA_H7c3L9q2_START -->
## Implementation Decisions

### Lifecycle failure handling

The user accepted all three recommendations with "yes" on 2026-10-06.

- **D-05-01:** An unsupported mode during loading prevents mutations, but
  existing resources are still discovered through the read-only path. Do not
  abort discovery merely because output cannot be selected.
- **D-05-02:** Contain lifecycle output failures and continue independent
  cleanup and discovery. Ending the entire callback immediately is not the
  default. This does not authorize continuing mutations in an unsupported
  mode, rolling back completed work merely because delivery failed, or
  swallowing command-handler errors globally.
- **D-05-03:** Record these failures through the existing opt-in debug logger.
  With `PI_CLAUDE_MARKETPLACE_DEBUG` unset, logging remains silent. No new
  always-on error log is introduced.

### Existing decisions carried forward

- **D-05-04:** One exhaustive mode switch selects text or JSON at emit time;
  never cache the mode or strategy in the run. Validate a plain string with a
  membership check that raises `UnsupportedModeError` before state changes.
- **D-05-05:** Extend the existing per-invocation `NotificationRun` with the
  entry sink (Phase 1 D-06). Construct runs at command and lifecycle roots;
  nested operations reuse the parent run (Phase 1 D-07). Hook callbacks get
  their run when their first sink reader lands. Preserve the one soft-dep
  snapshot per command/load run, with no new per-emission probes.
- **D-05-06:** Only notification-dispatch calls `appendEntry`. Cover all
  structured and raw surfaces, including load warnings, device flow,
  diagnostics, async rewake, and Stop-cap warnings. JSON/RPC do not also
  notify. Preserve text's argument counts and empty diagnostic/rewake no-ops.
- **D-05-07:** Keep schema validation in the test capture helper, not in the
  production converter. Every captured entry validates. All context fakes
  carry an explicit, required mode; do not hide a missing mode behind casts.
- **D-05-08:** Preserve the text corpus and catalog. The Phase 4 close baseline
  is 3149 corpus entries, zero extras; the catalog includes already-merged
  main's citation correction. Compare with `26cb0056`, not the superseded
  `4e6c568a` catalog base. No new corpus exception is approved here.

### the agent's Discretion

- Exact sink type, private helper names, and how raw helpers receive the run,
  within the existing explicit-root construction contract.
- Task boundaries and owner-test placement. Keep changes surgical and every
  intermediate wave verifiable; do not add unused transitional scaffolding.
- Prove the appendEntry lint restriction with a temporary planted violation
  and remove it. The current codebase conventions retired committed gate
  self-tests; do not restore the old copied-tree test harness just because an
  older phase plan mentions it.


## Deferred Ideas

None. Phase 6 and Phase 7 responsibilities remain in their existing phases.

<!-- DATA_H7c3L9q2_END -->
</user_constraints>

## Summary

Use the existing presentation, JSON converter, raw-surface resolver, and notification run. Add a required entry sink to the run and a required string mode to the local notification-context contract. Make one dispatcher switch choose transport from the current context at each emission. Guard command and lifecycle mutation roots separately; an emission-time check alone can happen after a transaction commits. The existing command root already opens the run before routing, and the load root opens it around reconciliation. [VERIFIED: extensions/pi-claude-marketplace/shared/notification-run.ts:11-22; extensions/pi-claude-marketplace/edge/register.ts:133-138; extensions/pi-claude-marketplace/index.ts:118-131]

The installed Pi context uses getters that assert that the runner is active. Reading the mode itself can therefore throw after reload; catching only entry delivery is insufficient. Load failures must preserve the discovery tail, while rewake failures must preserve child bookkeeping and independent completion handling. Stop-cap notification currently lacks its own catch. [VERIFIED: node_modules/@earendil-works/pi-coding-agent/dist/core/extensions/runner.js:548-567; extensions/pi-claude-marketplace/index.ts:132-182; extensions/pi-claude-marketplace/bridges/hooks/async-rewake/registry.ts:388-455; extensions/pi-claude-marketplace/bridges/hooks/settle.ts:369-385]

**Primary recommendation:** Land a working structured-output tracer, capture helper, and command guard together; then migrate raw command, auth/diagnostic, and lifecycle readers in coherent slices. Keep existing text cases in place and add new transport proofs on the JSON side. This implements the accepted incremental-wave and byte-preservation constraints. [VERIFIED: .planning/phases/05-mode-selected-json-sink/05-CONTEXT.md:46-75]

## Architectural Responsibility Map

The following assignments are design recommendations grounded in the current root, dispatcher, converter, and host API responsibilities. [VERIFIED: extensions/pi-claude-marketplace/edge/register.ts:133-138; extensions/pi-claude-marketplace/shared/notification-dispatch.ts:78-107,247-252,345-376; extensions/pi-claude-marketplace/shared/notification-json.ts:46-55]

| Capability | Primary tier | Secondary tier | Rationale |
|---|---|---|---|
| Check supported mode before a new operation | Extension command/lifecycle root | Shared membership validator | Root owns the first mutation |
| Choose transport for each emission | Shared dispatcher | Current Pi context | Read live mode without changing the run |
| Resolve presentation and redaction | Shared model/resolver | Existing producer policies | Preserve both strategies' common input |
| Format JSON | Existing JSON converter | Existing wire schema types | Convert explicit fields; no runtime validation |
| Persist/stream custom entry | Pi host API | Dispatcher as sole caller | Pi owns session storage and delivery |
| Catch lifecycle delivery failures | Load and hook roots | Existing debug logger | Preserve independent discovery and cleanup |
| Validate captured payloads | Test boundary | Existing compiled schema | Validation must fail a test even if production catches throws |

## Project Constraints (from AGENTS.md)

These are planning directives, not new product choices. [VERIFIED: AGENTS.md; skills/local-verification/SKILL.md; skills/typescript-unit-testing/SKILL.md; skills/typescript-comments/SKILL.md]

- Research and read a file before editing it; trace callers before changing a function. Use CodeGraph first where available, then read current source. Treat codebase maps as orientation.
- Keep changes minimal, preserve unrelated work, and do not refactor unrelated code. Remove only newly orphaned code.
- Stay inside the GSD workflow. Define verifiable tasks. Every plan summary must contain a Threat Flags section.
- Use strict TypeScript and the project comment/style rules; comments and test names cite durable requirement IDs, not planning history.
- Use the existing Node test runner, strict assertions, and strict interaction mocks. Every production module has exactly one mirrored owner test; every pair must independently reach full direct coverage. No test-only production exports, broad casts hiding invalid doubles, coverage exclusions, skipped tests, new testing framework, or live-network unit tests.
- Respect architectural zones and the Pi import chokepoint. Keep the discriminated resolver result, scoped containment, atomic mutations, retry safety, offline-operation policy, and reload-only recovery.
- Preserve upstream behavior. This phase is Pi transport, so it introduces no new Claude behavior. The mode refusals are later work.
- Preserve the two existing scopes. Do not add telemetry, locale infrastructure, or direct standard-output/error writes. The accepted entry transport and existing opt-in debug seam are the applicable notification exceptions.
- Never commit on main, amend/rebase history, or skip hooks. Use conventional commit/PR titles, at most 72 characters, with body lines at most 80; avoid milestone/phase mentions. Run the fixers-only pre-commit command before a foreground commit; the hook owns staged-input checks.
- Use the local-verification skill: owner tests during development, staged checks at commit, and the full combined-tree check after each wave and at the phase gate. Preserve Fallow, source/test pairing, and full direct coverage. Do not mistake a passing hook for a GSD gate.
- Before refactoring exact consumers, follow the Fallow symbol-impact rule; before changing architectural boundaries use Fallow guard; before committing use Fallow audit. The parent owns commits for this research.
- If later creating a PR, use the project prose skills, offer the coordinated version bump, record the changelog, and use squash merge. Milestone closure precedes a shipping merge. These are not implementation tasks for this phase.

The source-of-truth runtime constraint is quoted verbatim: "^22.22.2 || ^24.15.0 || >=26.0.0". The peer floor is ">=0.86.1"; the current development declaration is "^0.87.1". Do not downgrade the installed development dependency to match an older map or AGENTS prose. [VERIFIED: package.json:16-36,58-62]

<phase_requirements>
## Phase Requirements

Descriptions below are copied from the requirement file; the support column is the proposed implementation mapping. [VERIFIED: .planning/REQUIREMENTS.md]

| ID | Description | Research support |
|---|---|---|
| MODE-01 | The strategy is chosen by an exhaustive switch over `ctx.mode`, read at emit time and never cached: `tui` -> text (plus the interactive browse strategy), `print` -> text, `json` and `rpc` -> JSON. | One switch accepting the resolved presentation/raw union; live-getter tests |
| MODE-02 | Any other mode value raises a typed `UnsupportedModeError` from a membership check that runs before any state change; lifecycle handlers log it and never rethrow. | Plain-string boundary, typed validator, ordering proofs and guarded mutation roots |
| JOUT-01 | In `json` and `rpc` modes, every `/claude:plugin` output is emitted through `pi.appendEntry("claude-plugin", payload)` and none through `ctx.ui.notify`; `appendEntry` is callable only from the dispatch module, enforced by an ESLint rule proven by a planted violation. | Required run sink; complete caller migration; composed lint restriction |
| JOUT-05 | Output calls that can newly throw -- `appendEntry` before bind, a stale `pi` or `ctx` after `/reload` -- never escape lifecycle or hook callbacks (NFR-2). | Separate mutation guard and narrow delivery catches, preserving cleanup |
| TENB-01 | A JSON capture helper for in-process tests records every `appendEntry` payload and validates each one against the schema. | Test capture with persistent validation-failure ledger and explicit verification |
| TENB-02 | Every test fake of the notification or extension context carries an explicit `mode`, required by the type; the `as unknown as ExtensionContext` casts that hide a missing `mode` are removed or given one. | Required mode in narrow context; explicit mode in shared and local fakes |
</phase_requirements>

## Standard Stack

Retain the installed dependencies. This phase needs no installation or version change, so no new-package legitimacy audit or latest-registry recommendation is needed. The versions below were read from installed package metadata and checked against the current manifest; they describe the workspace, not registry freshness. [VERIFIED: package.json:16-36,58-62; session installed-package metadata probe]

| Existing component | Installed version | Use |
|---|---|---|
| Pi coding-agent peer | 0.87.1, peer floor 0.86.1 | Current context declarations, append-entry API, lifecycle behavior |
| TypeScript | 6.0.3 | Required context mode, exhaustive switch, narrow sink contract |
| typebox | 1.3.34 | Existing schema and test-only Compile validator |
| ESLint | 10.11.0 | Single-module append-entry restriction |
| strong-mock | 9.2.2 | Exact sink calls, no unintended notify/probe |
| Node | v26.10.0 | Existing native TypeScript test and coverage commands |

The installed Pi declaration is exactly 'export type ExtensionMode = "tui" | "rpc" | "json" | "print";', and its context member is 'mode: ExtensionMode;'. Its entry method is 'appendEntry<T = unknown>(customType: string, data?: T): void;'. The local notification context currently has only 'readonly ui: NotificationUi;'. [VERIFIED: node_modules/@earendil-works/pi-coding-agent/dist/core/extensions/types.d.ts:209-216,1059-1060; extensions/pi-claude-marketplace/platform/pi-api.ts:133-141]

**Recommendation:** Re-export the upstream mode type through the existing Pi boundary if needed, but accept a required plain string in the consumer-owned notification context and membership validator. Keep the union narrowing after the check. This lets unsupported-mode tests use real strings without a cast while preserving the compiler's exhaustive switch. Do not use the UI-capability flag as the transport selector: the declaration explicitly describes dialog support separately from mode. [VERIFIED: node_modules/@earendil-works/pi-coding-agent/dist/core/extensions/types.d.ts:209-216; .planning/phases/05-mode-selected-json-sink/05-CONTEXT.md:46-60]

## Architecture Patterns

### System data flow

This diagram is the proposed architecture. It preserves the existing resolver/converter split and implements the locked mode selection. [VERIFIED: extensions/pi-claude-marketplace/shared/notification-json.ts:46-55; .planning/phases/05-mode-selected-json-sink/05-CONTEXT.md:46-60]

~~~mermaid
flowchart TD
  C[Command or lifecycle callback] --> G{Supported live mode?}
  G -->|No: command| E[Typed error before mutation]
  G -->|No: lifecycle| L[Debug log; safe cleanup and read-only discovery]
  G -->|Yes| R[Open or reuse invocation run]
  R --> O[Operation produces structured or raw data]
  O --> P[Resolve/redact once]
  P --> S{Dispatcher reads live mode}
  S -->|tui or print| T[Existing text formatter]
  T --> N[Existing notify tuple delivery]
  S -->|json or rpc| J[Existing JSON converter]
  J --> A[Single dispatcher appendEntry call]
  A --> H[Pi session transport]
  S -->|throws in lifecycle| L
~~~

### Run and sink contract

Recommendation: give the run one required narrow sink object whose method is structurally compatible with the Pi entry method. Store the Pi object as the sink and invoke its method only from the dispatcher. Do not wrap the call in a root-level arrow that invokes appendEntry outside dispatch, and do not put mode, context copies, or selected strategy in the run. Keep the existing constructor's snapshot semantics. It currently returns exactly '{ softDeps: softDepStatus(pi) }'; each snapshot consists of three inventory calls, one per companion probe. [VERIFIED: extensions/pi-claude-marketplace/shared/notification-run.ts:21-22; extensions/pi-claude-marketplace/platform/pi-api.ts:158-205; tests/shared/notification-run.test.ts:13-40]

Account for the two LLM-tool run constructors as well as the command/load roots when widening the constructor's input. These tools already use the converter for returned details; adding the sink must not make tool execution append notifications. [VERIFIED: extensions/pi-claude-marketplace/edge/handlers/tools.ts:47,120,487; .planning/phases/04-wire-schema-and-json-strategy/04-CONTEXT.md:93-118]

### One selection switch, two guards

Recommendation: a small shared validator accepts a string, checks membership, and narrows it to the upstream mode union or throws the required typed error. Call it before command routing or lifecycle writes. Inside the dispatcher, read the current context mode again, validate it, and use the single exhaustive switch. A root check proves permission to begin; it does not choose or freeze later output. Preserve mode reads as live getters and keep them within lifecycle catches. [VERIFIED: extensions/pi-claude-marketplace/edge/register.ts:133-138; node_modules/@earendil-works/pi-coding-agent/dist/core/extensions/runner.js:548-567,627-631; .planning/phases/05-mode-selected-json-sink/05-CONTEXT.md:46-53]

Use a resolved-source union at the common internal transport entry so structured and raw paths share the switch. The existing converter already accepts the same two source categories and discriminates on '"envelope" in source'. Keep all existing public structured entry points and thin raw kind constructors. A private text-only formatter switch may remain; it is not another mode selector. [VERIFIED: extensions/pi-claude-marketplace/shared/notification-json.ts:46-55; extensions/pi-claude-marketplace/shared/notification-dispatch.ts:94-107,247-252,312-376]

### Complete plumbing inventory

These are migration targets, not proposed new modules. Source locations identify the current owners. [VERIFIED: extensions/pi-claude-marketplace/shared/notification-dispatch.ts:113-237,247-252,349-376]

| Surface | Current owner/call chain | Required change |
|---|---|---|
| Structured notifications | notify, context cascade, update no-op, reconcile applied | Forward their existing run into the common transport selector |
| Usage error/help | Router; shared edge parsing; marketplace/plugin handlers | Pass the same run through every error/help helper and parser wrapper |
| Diagnostics | Import diagnostics, plugin discovery warnings, reconcile post-commit warnings | Thread existing parent run through each warning surface |
| Device-flow prompt | Auth host -> provider callback -> raw helper | Carry the existing run through auth bundles, clone/probe options, and callers |
| Load warnings | Index reconciliation catch and skipped PATH scopes | Reuse the load run; catch each emission independently |
| Async rewake summary | Child finalization in rewake registry | Construct the hook run inside the protected callback; preserve cleanup |
| Stop-cap warning | Settle reentry limiter | Construct/pass hook run at the callback root and catch cap delivery |

The edge migration must include error paths in parseMapModelArgs, parsePositionalsWithFlags, withParsedArgs, outer flag parsing, and marketplace scope/error helpers. Updating only the successful subcommand invocation leaves their raw output on text. [VERIFIED: extensions/pi-claude-marketplace/edge/handlers/plugin/shared.ts:64-79,110-125,191-205; extensions/pi-claude-marketplace/edge/handlers/shared.ts:72-104; extensions/pi-claude-marketplace/edge/router.ts:201-264]

Auth plumbing is wider than auth-host itself. buildAuthForHost binds the device-code callback; buildCloneAuth forwards the auth object. Install and reinstall clone probes, dependency tag resolution, fetch, update preflight, and info-fetch reach this seam, while marketplace add/update call the host builder directly. Carry the parent run through these typed option objects; never create a fresh command run inside an auth challenge or nested dependency lookup. The existing install-probe auth object lists 'readonly ctx: NotificationContext;', 'readonly credentialOps: CredentialOps;', 'readonly deviceFlowHttp?: DeviceFlowHttp;', and 'readonly authMemo?: Map<string, AuthAttemptResult>;'. [VERIFIED: extensions/pi-claude-marketplace/orchestrators/auth-host.ts:168-202,221-237; extensions/pi-claude-marketplace/orchestrators/plugin/install-clone-probe.ts:25-34,50-57; current caller search for buildCloneAuth/buildAuthForHost]

### Lifecycle containment and mutation ordering

| Boundary | Current evidence | Plan behavior |
|---|---|---|
| Command | Run opens directly in registered handler before router | Validate before invoking routing; propagate typed unsupported-mode error normally |
| Resource discovery | Hydrate -> reconcile -> PATH recompute -> aggregate resources | Check before mutating sections; unsupported mode skips them but reaches read-only aggregation |
| Session start | Hook hydration/rebuild/mkdir, hook dispatch, session-env assignment, autocomplete installation are separate handlers | Guard each affected mutation root; contain stale-context reads in each registered callback |
| Async rewake | Child is taken and PID persistence scheduled before generation check and summary | Preserve terminal cleanup; suppress new unsupported-mode work; catch output separately so an output failure alone does not prevent independent valid completion work |
| Stop settle | Cached assistant is consumed; hook reduction precedes reentry counter/cap warning | Check mode before new hook work; keep generation checks; catch cap output without undoing or repeating cap transition |

Evidence for the table: [VERIFIED: extensions/pi-claude-marketplace/index.ts:96-202; extensions/pi-claude-marketplace/edge/register.ts:133-170; extensions/pi-claude-marketplace/bridges/hooks/event-router.ts:904-939; extensions/pi-claude-marketplace/bridges/hooks/async-rewake/registry.ts:388-455; extensions/pi-claude-marketplace/bridges/hooks/settle.ts:125-159,225-295,369-385]

**Factory-time wrinkle:** the bridge factory advances its generation, shuts down prior children, hydrates, creates the shared directory for existing SessionStart hooks, and reaps orphans before callbacks receive a context. The directory is constructed with 'path.join(loc.dataRoot, "_shared")' and created with 'await mkdir(sharedDir, { recursive: true });'. Recommendation: move fresh shared-directory creation into the guarded session-start path for both scopes. Preserve registration, read-only hydration, generation invalidation, and old-child/orphan cleanup; these are recovery, not permission to start new plugin operations. A check only in resource discovery cannot precede this factory write. [VERIFIED: extensions/pi-claude-marketplace/bridges/hooks/event-router.ts:766-770,816-877,916-934]

Do not wrap an entire lifecycle callback and return immediately on the first delivery failure. In resource discovery retain the existing independent PATH and aggregate-resource stages when mode is supported; on unsupported mode retain only safe cleanup and read-only discovery. The discovery implementation imports read-only filesystem operations and collects paths; it provides the existing safe tail. [VERIFIED: extensions/pi-claude-marketplace/orchestrators/discover.ts:1-4,17-53,76-126; .planning/phases/05-mode-selected-json-sink/05-CONTEXT.md:32-39]

The debug seam checks exactly 'process.env.PI_CLAUDE_MARKETPLACE_DEBUG === "1"'. Keep this opt-in behavior; use the existing logger for guard/delivery failures and avoid an always-on error sink. [VERIFIED: extensions/pi-claude-marketplace/shared/debug-log.ts:22-25]

### Empty output and text preservation

The text formatter suppresses 'case "diagnostic"' when 'surface.lines.length === 0', and 'case "async-rewake-summary"' when 'surface.summary.length === 0'. Recommendation: apply the same model-data no-op check before JSON conversion/delivery. An empty line within a nonempty list is not an empty diagnostic; whitespace-only summary is not an empty summary. Do not trim. Preserve all other empty payloads, including empty lists and pending output. [VERIFIED: extensions/pi-claude-marketplace/shared/notification-grammar.ts:1139-1159; extensions/pi-claude-marketplace/shared/notification-json.ts:110-123,150-171]

Keep the existing text deliver helper with its exact one-argument and two-argument notify branches. The presentation-sink architecture test currently pins both calls inside deliver and pins direct formatter-to-deliver calls; adapt its real-tree assertions alongside dispatch changes. Its literal allowlist also needs the intentional transport literal, without weakening the prose prohibition. [VERIFIED: extensions/pi-claude-marketplace/shared/notification-dispatch.ts:78-96; tests/architecture/presentation-sink.test.ts:89-105,134-182]

### Capture helper and explicit context modes

Recommendation: extend the existing notification testing concern with a JSON capture that records the custom type and payload, validates every entry against the existing schema, and returns an explicit verify operation. Validate the raw captured object and its JSON round trip as appropriate to preserve the existing undefined/non-JSON-value guarantees. Keep failure records even if the append call also throws, and assert them after the lifecycle callback settles: lifecycle catches must not turn a swallowed assertion into a passing test. The existing catalog already compiles the schema and distinguishes serialized validation from whole-object safety checks. [VERIFIED: tests/architecture/catalog-uat/catalog-wire.test.ts:10-21,29-36,79-82]

Every context factory must explicitly provide mode, including narrow notification literals, strict context mocks, catalog helpers, hook helpers, integration builders, and command/lifecycle roots. The shared boundary is currently a strict ExtensionCommandContext mock; the catalog mock aliases NotificationContext; the settle test currently contains '{} as unknown as ExtensionContext' and a notification-only object cast. Give these an explicit mode and type-check the narrow shape. Do not introduce a production default for absent mode. [VERIFIED: tests/edge/notification-boundary.ts:29-32,65-87; tests/architecture/catalog-uat/mock-pi.ts:3-10,29-44; tests/bridges/hooks/settle.test.ts:28-29,59-67]

Recommendation: update shared run seeds with a required entry sink, defaulting in text-only tests to a sink that rejects unexpected delivery rather than silently dropping it. New JSON cases inject the real capture. Keep exact inventory reads at root tests; do not add any-times expectations or per-emission probes. [VERIFIED: tests/shared/notification-run-seeds.ts:4-20; tests/shared/notification-run.test.ts:13-40; tests/edge/notification-boundary.ts:20-25]

### ESLint ownership restriction

Use the existing no-restricted-syntax mechanism to forbid direct/optional/computed append-entry calls outside dispatch; tests may define and exercise capture implementations. Ensure the production rule covers the entry root, edge, shared, bridges, platform, and both network-exempt and network-free orchestration modules. Do not put it only in the network-free block. [CITED: https://eslint.org/docs/latest/rules/no-restricted-syntax]

Later ESLint rule configuration takes precedence. The current network-free block sets '"no-restricted-syntax": ["error", ...NETWORK_FREE_SYNTAX_SELECTORS]'; tests and scripts later disable that rule. Compose the append-entry selectors into overlapping production blocks rather than overwriting the existing network restriction. Verify representative effective configurations and temporarily plant a call in both an ordinary extension module and a network-free one. Remove each planting before commit; retain the observed lint result in the execution summary. [VERIFIED: eslint.config.js:335-358,422-440,529-532] [CITED: https://eslint.org/docs/latest/use/configure/rules]

## Incremental Tracer-First Decomposition

These are recommended ownership slices. Each lands production readers, owner tests, and all required signature callers together. They follow D-05-05/D-05-07 and the green-wave contract; no optional sink/run compatibility adapter is needed. [VERIFIED: .planning/phases/05-mode-selected-json-sink/05-CONTEXT.md:49-75; skills/local-verification/SKILL.md]

1. **Structured tracer and test boundary.** Add required context mode, validator/error, required run sink, capture helper, and one common mode switch with the structured path connected. Update all run constructors/seeds and context fakes required by the stronger contracts, including LLM tools. Guard the command root. Add the entry-site lint rule and adapt the existing sink scan in this same slice. Prove a real registered list/info/pending path reaches a schema-valid entry and makes no notify call. New test support has its first consumer in this commit.
2. **Usage and help.** Thread the run through router error branches, help, flag parsing, shared argument wrappers, marketplace helpers, and all verb handlers. Make the raw internal dispatch path use the common selector as each migrated public helper begins reading its required run. No helper accepts an optional run or creates a nested one.
3. **Diagnostics and authentication.** Carry the run through the three diagnostic producers and their helper callers; thread it through host/clone auth options and all clone, tag, fetch, and update/info callers. Exercise the typed device prompt via the bound callback. Keep auth polling/refusal behavior unchanged.
4. **Load and hook lifecycle completion.** Migrate load warnings, rewake, and Stop cap. Establish guarded mutation blocks in resource discovery/session start, relocate the pre-context shared-directory write, and preserve cleanup/discovery tails. Runs for raw-only hooks are constructed when the callback actually needs its sink, not while registering an extension. Catch stale mode getters, pre-bind entry errors, and stale sink calls without replaying completed work.
5. **Combined acceptance.** Close owner-test gaps for all six success criteria, run transient lint proof, audit every remaining raw caller/fake, and run the combined check plus corpus/catalog comparisons. This is verification and any concrete gap fix, not a new permanent gate framework.

A slice may be split into several commits only when each keeps all its typed callers coherent and the new exports/members have production readers. Do not commit unused sink scaffolding followed by a later wiring wave. The first slice need not already provide all raw transport: intermediate work is deliberately scoped, while final acceptance covers every surface. [VERIFIED: .planning/phases/01-presentation-model/01-CONTEXT.md, D-06/D-07; .planning/phases/05-mode-selected-json-sink/05-CONTEXT.md:68-75]

## Don't Hand-Roll

| Problem | Use instead | Grounding |
|---|---|---|
| Session entry persistence or streaming | Pi's entry method; no custom files, stdout or timer | Installed API declaration and locked startup limitation |
| Wire serialization | Existing toWirePayload over resolved values | Explicit field conversion already implemented |
| Production payload validation | Existing schema only in test capture | D-05-07 |
| Context-mode inference | Required mode string plus membership guard | D-05-04 |
| Error-output logging | Existing opt-in hookDebugLog | D-05-03 |
| Negative gate framework | Temporary planted lint violation | D-05 discretion and current conventions |

Evidence: [VERIFIED: node_modules/@earendil-works/pi-coding-agent/dist/core/extensions/types.d.ts:1059-1060; extensions/pi-claude-marketplace/shared/notification-json.ts:27-55; extensions/pi-claude-marketplace/shared/debug-log.ts:22-25; .planning/phases/05-mode-selected-json-sink/05-CONTEXT.md:18-22,40-75]

## Runtime State Inventory

This is a transport refactor. The recommendation is to migrate code and callback bindings, not persisted record contents. The inventory is limited to extension-owned systems exposed by the inspected source; it does not claim to audit unrelated machine services. [VERIFIED: extensions/pi-claude-marketplace/shared/notification-run.ts:11-22; extensions/pi-claude-marketplace/bridges/hooks/event-router.ts:816-877]

| Category | Items found | Action |
|---|---|---|
| Stored data | Existing Pi custom entries; plugin state and resource paths; async child PID records | New output uses Pi entry API; no record rename/backfill; preserve terminal PID cleanup |
| Live service config | No external service configuration change in this design | No migration task; notification context and sink references are in-process |
| OS-registered state | Existing child-process shutdown/orphan recovery at bridge registration | Preserve recovery; do not rename process markers or alter PID ownership checks |
| Secrets/env vars | Existing opt-in debug environment variable; session-env and PATH mutations | Keep names; guard new mutation work and keep approved silent debug behavior |
| Build artifacts/installed packages | Existing installed Pi and tools; captured run/context references can outlive reload | Do not reinstall or bump packages; preserve generation defenses and contain stale access |

Evidence: [VERIFIED: node_modules/@earendil-works/pi-coding-agent/dist/core/extensions/types.d.ts:1059-1060; extensions/pi-claude-marketplace/index.ts:148-202; extensions/pi-claude-marketplace/bridges/hooks/async-rewake/registry.ts:388-425; extensions/pi-claude-marketplace/bridges/hooks/event-router.ts:843-877; extensions/pi-claude-marketplace/shared/debug-log.ts:22-25]

## Common Pitfalls

- **Checking after mutation.** The current load path reaches reconcile before final output. Put membership validation at roots and prove ordering with an observable mutation recorder or unchanged real temporary state. Dispatcher validation remains necessary for live-mode changes. [VERIFIED: extensions/pi-claude-marketplace/index.ts:123-159]
- **Treating stale mode as harmless data.** The mode getter calls the active-runner assertion. Enclose run construction and the getter in the callback's protected region. Do not spread a Pi context to add the sink. [VERIFIED: node_modules/@earendil-works/pi-coding-agent/dist/core/extensions/runner.js:548-567,627-631]
- **Swallowing capture failures.** Lifecycle catches will contain a validator assertion just like a host exception. Test-tail verification of recorded invalid entries must fail independently. [VERIFIED: extensions/pi-claude-marketplace/index.ts:132-145; extensions/pi-claude-marketplace/bridges/hooks/async-rewake/registry.ts:432-437]
- **Breaking text while adding coverage.** The corpus tool records notify calls even if the test's notify mock throws. New text test emissions can therefore add corpus entries. Add transport cases in JSON/RPC; extend existing text cases without increasing their text-emission multiplicity. Test a live switch by adding JSON emissions around an existing text emission, or switch JSON to RPC and independently preserve existing text cases. [VERIFIED: scripts/notify-corpus.mjs:9-23; .planning/phases/05-mode-selected-json-sink/05-CONTEXT.md:61-64]
- **Changing cap state on failed delivery.** The cap transition occurs before notification. Catch the sink failure and leave that completed transition intact; otherwise repeated callbacks can duplicate warning attempts or alter livelock protection. [VERIFIED: extensions/pi-claude-marketplace/bridges/hooks/settle.ts:369-385]
- **Missing deep auth/raw callers.** Raw helpers deliberately did not carry the run before this phase; adding a sink only to structured entry points cannot cover them. [VERIFIED: extensions/pi-claude-marketplace/shared/notification-dispatch.ts:94-107,113-237; extensions/pi-claude-marketplace/orchestrators/auth-host.ts:168-202]
- **Reintroducing retired gate self-tests.** Older contexts contain copied-tree planted controls. Current instructions permit only temporary planting for this new rule. [VERIFIED: .planning/phases/05-mode-selected-json-sink/05-CONTEXT.md:72-75; .planning/codebase/CONVENTIONS.md:70]
- **Following stale tooling maps.** The current full-check script invokes static checks, unpaired tests, integration tests, and direct pair coverage. Plan those real commands; do not restore a historical unused-member gate or line-position contract just because prior research names one. [VERIFIED: package.json:80-95]

## Code Examples

These excerpts are current patterns, not a patch or a new API proposal.

Existing converter entry (quoted verbatim): [VERIFIED: extensions/pi-claude-marketplace/shared/notification-json.ts:52-55]

<!-- DATA_P8t4V1a6_START -->
~~~typescript
export function toWirePayload(
  source: NotificationPresentation | ResolvedRawSurface,
): Type.Static<typeof NOTIFICATION_PAYLOAD_SCHEMA> {
  return "envelope" in source ? wirePresentation(source) : wireRawSurface(source);
}
~~~
<!-- DATA_P8t4V1a6_END -->

Existing text tuple delivery (quoted verbatim; preserve arity): [VERIFIED: extensions/pi-claude-marketplace/shared/notification-dispatch.ts:83-87]

<!-- DATA_R6m2Q9d4_START -->
~~~typescript
if (args.length === 1) {
  ctx.ui.notify(args[0]);
} else {
  ctx.ui.notify(args[0], args[1]);
}
~~~
<!-- DATA_R6m2Q9d4_END -->

Required transport call is specified verbatim as 'pi.appendEntry("claude-plugin", payload)'. Its invocation belongs only in the dispatcher; the run supplies the object on which the method is invoked. [VERIFIED: .planning/REQUIREMENTS.md, JOUT-01]

Recommendation for the live-mode proof: hold one run and one context whose mode can change; emit a known nonempty model, change to another supported mode, and emit again. Assert the full payloads, no UI delivery for machine modes, and unchanged snapshot-probe count. Add an unsupported plain-string case to the validator owner and a separate command mutation-order proof. These prove distinct contracts rather than relying only on a formatter unit test. [VERIFIED: .planning/ROADMAP.md, Phase 5 success criteria 1-2; tests/shared/notification-run.test.ts:30-40]

## State of the Art

| Historical record | Current source/decision | Planning impact |
|---|---|---|
| Development Pi described as 0.86.1 | Manifest "^0.87.1", peer ">=0.86.1" | Inspect installed declarations; peer-floor e2e stays in Phase 7 |
| Raw helpers omitted run on purpose | Entry sink now has its first raw readers | Thread it explicitly; no ambient current run |
| Earlier gate plans committed negative controls | Temporary planted proof only | Do not resurrect copied-tree test support |
| Earlier corpus/catalog totals and bases | "3149 corpus entries, zero extras" and "26cb0056" | Use the accepted current baselines |

Evidence: [VERIFIED: package.json:16-17,58-62; .planning/phases/03-typed-raw-surfaces/03-CONTEXT.md, D-04; .planning/phases/05-mode-selected-json-sink/05-CONTEXT.md:49-75]

## Assumptions Log

No unverified external compatibility assumption is required to execute the proposed design. Implementation recommendations are explicitly labeled and derive from inspected code and approved decisions. The pre-context directory-write adjustment is an implementation consequence to include in planning, not a new product feature. No claim is made that the installed version proves behavior at the minimum peer floor; that real-Pi proof belongs to Phase 7. [VERIFIED: .planning/phases/05-mode-selected-json-sink/05-CONTEXT.md:18-22,32-39; package.json:17,59]

| # | Assumed claim | Risk |
|---|---|---|
| — | None required; no new package, service, performance target, retention rule, or compatibility policy proposed | — |

## Open Questions

No user decision blocks planning. Two implementation checks must be explicit tasks: determine the smallest guarded session-start extraction that moves fresh shared-directory creation for both scopes while preserving factory recovery; and inventory all narrow/auth option carriers before changing signatures. The relevant existing behavior and constraint are already established. [VERIFIED: extensions/pi-claude-marketplace/bridges/hooks/event-router.ts:816-877,904-939; extensions/pi-claude-marketplace/orchestrators/auth-host.ts:168-237; .planning/phases/05-mode-selected-json-sink/05-CONTEXT.md:32-39]

## Environment Availability

| Dependency | Available | Observed version | Fallback |
|---|---|---|---|
| Node | Yes | v26.10.0 | None needed |
| npm | Yes | 11.19.1 | None needed |
| Installed Pi declarations | Yes | 0.87.1 | None needed |
| Existing test/compile/lint tools | Yes | Versions in Standard Stack | None needed |
| CodeGraph | Yes | MCP successfully returned current sources | Current source reads |
| Context7 MCP/CLI | Not exposed/found in this session | — | Official ESLint documentation fetched with web tool |
| Graphify | Disabled by project config | — | CodeGraph/current source |

These are session availability probes, not minimum-version assertions. No missing dependency blocks this code/config phase. No external service is needed. [VERIFIED: session command probes and tool discovery; .planning/config.json; research-plan/init output]

## Validation Architecture

Enabled explicitly by '"nyquist_validation": true'; the configured gate is '"test_command": "npm run check"'. [VERIFIED: .planning/config.json:19-22]

### Test framework and commands

| Property | Required plan value |
|---|---|
| Framework | Existing node:test and node:assert/strict, strong-mock where interaction is the behavior |
| Owner feedback | node --test <changed owner test> |
| Direct pair coverage | npm run test:coverage:direct -- <source path or paired test path> |
| Combined wave/phase gate | npm run check |
| Text corpus | node scripts/notify-corpus.mjs check |
| Catalog | git diff --exit-code 26cb0056 -- docs/output-catalog.md |

The package provides the direct coverage script as 'node scripts/test-coverage-direct.mjs'; the all-pair script is 'mkdir -p coverage && node scripts/test-coverage-direct.mjs --all --lcov coverage/direct.lcov'. The corpus location is constructed from '".planning/phases/01-presentation-model/notify-corpus"' and '"baseline.jsonl"'. Its current line count was 3149. Corpus checking is explicitly separate from the full check. [VERIFIED: package.json:94-95; scripts/notify-corpus.mjs:20-23,30-37; session wc probe; .planning/phases/05-mode-selected-json-sink/05-CONTEXT.md:61-64]

### Requirements to tests

Commands below are focused owner commands for development. If a lifecycle owner is slow, use Node's test-name filter for the added cases; the required combined gate still runs every pair. Proposed new mode/error owner filenames are planner discretion and must follow the existing pairing rule. [VERIFIED: skills/local-verification/SKILL.md; skills/typescript-unit-testing/SKILL.md]

| Requirement / criterion | Behavior | Owner / command | Gap to add |
|---|---|---|---|
| MODE-01 / SC1-2 | Supported modes route exclusively; one run sees live mode changes | node --test tests/shared/notification-dispatch.test.ts | JSON/RPC matrix, live getter, no notify, no extra probes |
| MODE-02 / SC2 | Plain unsupported string throws typed error before write | Validator owner plus node --test tests/edge/register.test.ts | Class/field assertion and ordered mutation recorder |
| MODE-02 / D-05-01 | Unsupported loading discovers existing artifacts without new writes | node --test tests/index.test.ts | Seed real temporary resources, compare state before/after |
| JOUT-01 / SC1 | Every structured/raw kind reaches capture | Dispatch owner; router/handler/auth owner tests | All kinds, including help, rejected args, diagnostics/device prompt |
| JOUT-01 / SC3 | appendEntry forbidden outside dispatch | npm run lint, temporary planted violation, effective config check | Prove restriction and retained network selectors |
| JOUT-05 / SC4 | Pre-bind and stale accesses do not escape discovery/session callbacks | node --test tests/index.test.ts; node --test tests/edge/register.test.ts; hook event-router owner | Throwing sink and throwing mode getter; independent work still completes |
| JOUT-05 / SC4 | Rewake output failure still completes child bookkeeping and valid independent work | node --test tests/bridges/hooks/async-rewake/registry.test.ts | JSON throw + stale generation + stale getter |
| JOUT-05 / SC4,6 | Stop-cap failure contained with cap intact | node --test tests/bridges/hooks/settle.test.ts | Throwing append and getter; no repeated cap reset/reentry |
| TENB-01 / SC5 | Every captured payload validates and invalid entries cannot be swallowed | Capture users in dispatch/root/lifecycle owners | Explicit test-tail validation; malformed payload proof in consuming test |
| TENB-02 / SC5 | Required mode appears in every context fake | npm run typecheck plus context-construction audit | Shared boundaries, literals, strict mocks, hook/integration helpers |
| SC6 | Empty diagnostics/rewake emit nothing in machine modes | node --test tests/shared/notification-dispatch.test.ts | Zero entries for empty data; preserve whitespace/nonempty cases |
| SC1 text | Existing exact bytes and argument counts retained | Existing catalog contract and corpus/catalog commands | Zero missing entries, zero extras, empty catalog diff |

### Wave 0 gaps and sampling

- Land capture support with its first production-path test in the tracer slice; no separate unused scaffolding wave.
- Update mode-bearing contexts and sink-bearing run seeds together with the contracts that require them.
- Add paired tests whenever extracting a new production mode/error module.
- Extend existing owner tests rather than adding a permanent lint-rule self-test or testing a private dispatcher helper.
- For each task, run the appropriate owner case while editing. Before commit run the project fixers-only pre-commit step; the commit hook runs staged-input verification. After each combined wave and at phase close run the full check.
- After each transport migration, run the corpus check so accidental new text emissions are found in the responsible slice. Its generic tool permits extras, but this phase does not: inspect the result and require zero extras.
- Record exact command, exit status, commit/tree inputs, and Node version. Reuse only unchanged-input passing results from the same session. This research did not run a production full check.

These are the required local verification and accepted text-baseline policies. [VERIFIED: skills/local-verification/SKILL.md; scripts/notify-corpus.mjs:13-23; .planning/phases/05-mode-selected-json-sink/05-CONTEXT.md:61-75]

## Security Domain

This is a local host transport change. Use the ASVS categories as a review aid, not a claim that a web-application certification applies. Current ASVS uses different category numbering from the older research template; the relevant current chapter includes error handling and graceful failure. [CITED: https://owasp.org/projects/asvs] [CITED: https://github.com/OWASP/ASVS/blob/master/5.0/docs_en/OWASP_Application_Security_Verification_Standard_5.0.0_en.json]

| Category/concern | Applicability | Planned control |
|---|---|---|
| ASVS 5 error handling, V16 | Direct | Guard mode before new writes; contain host output errors without fail-open mutation |
| Input validation / business logic | Direct | Closed-mode membership and exhaustive transport selection |
| Data protection | Direct | Existing resolved redaction and explicit wire projection; validate capture |
| Authentication | Existing flow only | Forward the same run into device prompt; never expose tokens |
| Session management | Pi-owned persistence | Use host API and preserve stale-instance/generation checks |
| Access control / cryptography | No new mechanism proposed | Keep existing containment and credential abstractions |

Threat planning should cover information disclosure through accidental model serialization, unsupported-mode mutations, output exceptions aborting recovery, stale callback delivery, and gate configuration accidentally dropping a restriction. Use existing redaction/model conversion, independent lifecycle boundaries, generation guards, exact sink ownership, and effective-config proof. Do not invent a token store, auth policy, retention policy, or always-on telemetry/logging requirement. [VERIFIED: extensions/pi-claude-marketplace/shared/notification-json.ts:27-38; extensions/pi-claude-marketplace/orchestrators/auth-host.ts:189-202; extensions/pi-claude-marketplace/bridges/hooks/async-rewake/registry.ts:415-437; .planning/phases/05-mode-selected-json-sink/05-CONTEXT.md:32-60]

## Sources

Primary project evidence was read from the approved phase context, requirements, all six roadmap criteria, state, earlier locked contexts, current source, installed Pi declarations/loader/runner, current test support, and current lint/package configuration. CodeGraph was used first to locate the paths, then source was read with line numbers. No fresh Claude upstream behavior was researched. [VERIFIED: research tool transcript]

External documentation used:

- [ESLint rule configuration](https://eslint.org/docs/latest/use/configure/rules): precedence when the same rule is configured more than once.
- [ESLint no-restricted-syntax](https://eslint.org/docs/latest/rules/no-restricted-syntax): selector/message configuration.
- [OWASP ASVS](https://owasp.org/projects/asvs) and [official ASVS source](https://github.com/OWASP/ASVS/blob/master/5.0/docs_en/OWASP_Application_Security_Verification_Standard_5.0.0_en.json): current category/error-handling context.

The research-plan seam selected Context7 for the ESLint question, but neither MCP nor CLI was available; the official-documentation web fallback was used. The confidence seam returned MEDIUM for websearch verified against official sources. Its local-provider result was LOW because local source reading is not a recognized authority in that classifier; this is a tooling classification limit, not a claim that the directly quoted repository declarations are uncertain. Local factual findings carry precise verified source citations instead of a fabricated provider rating. The external digest was cached under the temporary research workspace to keep this agent's repository ownership limited to this file. [VERIFIED: research-plan/classify-confidence/research-store tool outputs]

## Metadata

| Area | Confidence | Basis |
|---|---|---|
| Existing stack/contracts | Directly verified local evidence | Manifest, installed declarations, current sources; no registry freshness claim |
| Architecture recommendation | MEDIUM | Approved constraints plus current call paths; implementation still requires owner proofs |
| Lint behavior | MEDIUM | Official docs, confidence seam, current overlapping rules |
| Lifecycle hazards | Directly verified local evidence | Active getters, throwing loader stubs, current callback sequencing |

**Valid until:** Relevant source, installed Pi version, or approved context changes. Re-read touched definitions after concurrent edits. No production code or commits were made by this researcher.
