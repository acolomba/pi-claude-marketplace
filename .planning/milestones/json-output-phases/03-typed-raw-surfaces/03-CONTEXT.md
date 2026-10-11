# Phase 3: Typed Raw Surfaces - Context

**Gathered:** 2026-10-02
**Status:** Ready for planning
**Mode:** Autonomous smart discuss; the user accepted every recommended answer

<domain>
## Phase Boundary

Every output surface that still hands `ctx.ui.notify` a string built outside
the text strategy becomes a typed model kind. The text strategy formats each
kind back into today's exact bytes and argument count. The surfaces are: usage
errors and help for every verb, the three diagnostics, the device-flow prompt,
the two load-time warnings in `index.ts`, the async-rewake summary, and the
Stop-hook override-cap warning.

Requirements: RAWS-01, RAWS-02, RAWS-03, RAWS-04, RAWS-05, TEXT-01.

Out of this phase:

- The typebox wire schema, the JSON strategy, and credential redaction
  (Phase 4, PMOD-04).
- `ctx.mode`, the `appendEntry` sink, and threading `pi` or the sink into raw
  call sites (Phase 5).
- The `origin` field, `invocationId`, and the machine command id (Phase 6).
  This phase only makes `origin: hook` derivable from the type.
- The `browse` and print-mode device-flow refusals (Phase 7).

**Upstream contract:** none applies. This phase is internal output plumbing
with byte-identical text, so no Claude Code position exists. Recommendations
come from Pi and project constraints (per `skills/claude-code-compat-research`).

</domain>

<decisions>
## Implementation Decisions

### Kind vocabulary and entry path

- **D-01:** The raw-surface kinds are readonly interfaces in
  `shared/notification-types.ts`, grouped in their own union(s). They are
  **not** merged into `NotificationMessage`, so `notify()`'s required `run`
  does not spread to the roughly 50 raw call sites that have none.
- **D-02:** "The one presentation path" is one internal function in
  `shared/notification-dispatch.ts`. It takes a raw kind, asks the text
  strategy for the text and the argument-count rule, and makes the single
  `ctx.ui.notify` call. The structured path (`emitWithSummary`) and this path
  share the one sink call shape. Exact names are the planner's choice.
- **D-03:** The public helpers stay as thin kind constructors:
  `notifyUsageError`, `notifyUsageInfo`, `notifyDiagnostic`,
  `notifyAsyncRewakeSummary`, `notifyStopHookOverrideCap`, plus new helpers for
  the device-flow prompt and the two load-time warnings. The 45
  `notifyUsageError` call sites in 21 files do not change.
- **D-04:** No `run` or `pi` is threaded into raw call sites in this phase.
  Nothing reads it until Phase 5's sink, and a member lands with its first
  reader (Phase 1 D-06). Unused parameters would also fail lint.

### What is data and what is text

- **D-05:** `diagnostic {header, lines[]}`, exactly as RAWS-02 and SC-1 state.
  The three producers (`import/execute.ts` `surfaceImportDiagnostics`,
  `plugin/shared.ts` `surfaceDiscoveryWarnings`, `reconcile/apply.ts`
  `surfacePostCommitWarnings`) keep composing their header sentences, and the
  existing `redactAbsolutePaths` calls on the lines stay where they are. The
  text strategy owns the `\n\n` join, the `\n` line join, and the
  empty-lines no-op.
- **D-06:** `usage-error {message, usage}` (the `UsageErrorMessage` fields) and
  `usage-info {usage}`. Message and usage stay verbatim strings. The text
  strategy owns the SNM-13 `\n\n` separator.
- **D-07:** The Stop-hook override-cap kind carries `{pluginId, cap}`. The
  settle bridge passes its own cap constant, which removes the duplicated
  literal `8` from `shared/notification-dispatch.ts`. The text strategy
  composes the sentence. The `hooks-cap-notify` byte pin holds.
- **D-08:** The async-rewake kind carries `{summary}`. The plugin author's
  text passes through verbatim, and an empty summary stays a no-op. No
  `pluginId` field is added until something reads it.

### Device-flow prompt (RAWS-03, AUTH-09)

- **D-09:** `domain/github-auth.ts`'s `NotifyFn` string callback becomes a
  typed `onDeviceCode({verificationUri, userCode})` callback (exact name at the
  planner's discretion). `orchestrators/auth-host.ts` binds it to the dispatch
  module's device-flow helper. The `Open <uri> and enter: <code>` sentence
  moves into the text strategy, and the prompt keeps its explicit `"info"`
  second argument. `makeRawNotifyFn` and the `NotifyFn` type are deleted once
  their last callers are gone.
- **D-10:** The kind carries only `verificationUri` and `userCode`, which is
  what the text shows. There is no `host`, expiry, or interval field.
- **D-11:** The AUTH-09 gate (`tests/architecture/no-credential-leak.test.ts`)
  is retargeted at the new callback in every provider file. The user code and
  the verification URI may appear. No token field (`access_token`, `cred.*`,
  `r.accessToken`) may reach the callback's argument. A planted violation of the
  new call form must still fail the gate, following the house planted-violation
  pattern.
- **D-12:** The kind name is `device-flow-prompt`, the wording RAWS-03 uses.

### Load-time and hook kinds, arity, and proof

- **D-13:** `reconcile-aborted {cause}` carries the live thrown value, and
  resolve serializes it to today's `errorMessage(err)` text. This keeps one
  serialization site where Phase 4 adds redaction, as Phase 1 D-11 did for
  failure detail. `plugin-path-skipped {scope, reason}` carries the skipped
  scope and its reason string. Both keep their NFR-2 try/catch wrappers in
  `index.ts`.
- **D-14:** Hook kinds (`async-rewake summary`, `Stop-hook override cap`) and
  load-time kinds (`reconcile-aborted`, `plugin-path-skipped`) are separate
  type groups, each with its own public entry point. Phase 6 derives `origin`
  from the type. Hook callbacks still get no run object (Phase 1 D-07
  refinement). Diagnostics stay one kind, because their origin depends on the
  caller (import is a command, reconcile post-install is load).
- **D-15:** The argument count is a text-strategy rule keyed on kind. Every
  raw kind passes its severity explicitly (2 arguments), and structured
  info-severity emissions keep 1 argument. A test pins the rule for every raw
  kind. The model carries no `explicitSeverity` flag.
- **D-16:** SC-5 ("no output surface hands the text sink a pre-composed
  string") gets an architecture source-scan test with a planted-violation
  control. Every `ctx.ui.notify(` argument in the dispatch module must come
  from the text strategy's output. The corpus re-diff and the catalog diff are
  also empty at phase end.

### Corpus exception (approved after research)

- **D-17:** On 2026-10-02 the user approved a narrow corpus exception
  ("Approve (Recommended)"). Deleting `makeRawNotifyFn` (D-09) deletes its unit
  test in `tests/shared/notification-dispatch.test.ts`, which owns exactly two
  synthetic baseline entries: `"plain"` (argc 1) and `"failed"` at `"error"`
  (argc 2). Those two removals are allowed. Extra entries from the new helpers'
  owner tests are allowed and listed. Record both in
  `03-CORPUS-CHANGES.json` in the Phase 2 ledger format, with exact entries,
  owner file, multiplicity, and the behavior each test preserves. Every
  production byte, the catalog, and every other corpus entry stay fixed. No
  full recapture and no blanket acceptance.

### Research follow-ups resolved by the orchestrator

- D-14's "own public entry point" means internal group entry functions behind
  the exported helpers; the planner picks names, and no export lacks a
  production reader.
- `docs/output-catalog.md` prose (around lines 4088-4090) that says the domain
  emits the device-flow prompt goes stale. The catalog diff must stay empty,
  so the prose fix is carried by Phase 7's sanctioned catalog prose edit
  (recorded in ROADMAP Phase 7, criterion 6).
- The catalog diff base for this phase is the current tree
  (`git diff --exit-code 4e6c568a -- docs/output-catalog.md`).

### Claude's Discretion

- Exact kind spellings other than `usage-error`, `usage-info`, `diagnostic`,
  `device-flow-prompt`, `reconcile-aborted`, and `plugin-path-skipped`, which
  the requirements fix.
- Module placement of the raw-surface text formatting inside `shared/` (for
  example `notification-grammar.ts` or a small sibling), with no new zone.
- Plan breakdown and migration order, subject to: no export without a reader
  at any commit, and `npm run check` green after every plan.
- How the source-scan test identifies "text strategy output", as long as the
  planted control proves it fires.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Milestone scope and locked decisions

- `.planning/ROADMAP.md`, Phase 3: goal, success criteria 1-5, and the
  milestone invariants.
- `.planning/REQUIREMENTS.md`: RAWS-01..05 and TEXT-01. Also PMOD-04, WIRE-02,
  JOUT-01, and MODE-04, for the seams this phase must leave room for.
- `.planning/PROJECT.md`, Current Milestone section (Pi facts, IL-2 as amended
  by D8).
- `.planning/research/SUMMARY.md` (locked decisions D1-D8) and
  `.planning/research/ARCHITECTURE.md` §1 "Raw-string surfaces (D2)" (the
  per-surface inventory and arity table) and §5 (what Phase 5 will thread).
- `.planning/phases/01-presentation-model/01-CONTEXT.md` D-05..D-13 and
  `.planning/phases/02-row-policies/02-CONTEXT.md` D-01..D-07.

### Byte-lock and gate contracts

- `docs/output-catalog.md`: the text byte lock; must diff empty.
- `node scripts/notify-corpus.mjs check`: the corpus re-diff against the
  committed baseline under
  `.planning/phases/01-presentation-model/notify-corpus/`; must exit 0 with
  nothing missing.
- `tests/architecture/catalog-uat/catalog-contract.test.ts`: the state-count
  and UTF-8-byte pins must not move.
- `tests/architecture/hooks-cap-notify.test.ts` and the async-rewake hook
  tests: byte pins hold.
- `tests/architecture/no-credential-leak.test.ts`: AUTH-09, retargeted (D-11).
- `tests/shared/notification-dispatch.test.ts`: the SNM-13 usage-error case.
- `docs/unused-type-member-gate.md` and
  `scripts/check-unused-type-members.contracts.json`: every new member needs a
  reader; re-pin after Prettier by shifting the line only.
- `AGENTS.md`, `skills/typescript-google-style-review/SKILL.md`,
  `skills/typescript-comments/SKILL.md`,
  `skills/typescript-unit-testing/SKILL.md`, and
  `skills/typescript-unit-testing-review/SKILL.md`.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- `shared/notification-dispatch.ts` holds every raw surface today:
  `notifyUsageError` (:100), `notifyUsageInfo` (:107), `notifyDiagnostic`
  (:130), `notifyAsyncRewakeSummary` (:155), `notifyStopHookOverrideCap`
  (:188), and `makeRawNotifyFn` (:335). `emitWithSummary` (:82) is the
  structured sink call with the 1-or-2-argument rule.
- `UsageErrorMessage` (`shared/notification-types.ts:319`) already has the
  `usage-error` fields.
- The standalone kinds in `NotificationMessage` (`prune-committed-warning`,
  `marketplace-not-added`, `reconcile-pending-empty`) show the house shape for
  small typed kinds, including a live `cause: Error` that resolve serializes.
- `errorMessage` (used at `index.ts:142`) is today's reconcile-aborted text
  semantics.

### Established Patterns

- Raw callers: `index.ts:142` and `:163` (`makeRawNotifyFn`, inside NFR-2
  try/catch), `bridges/hooks/settle.ts:378`,
  `bridges/hooks/async-rewake/registry.ts:434`,
  `edge/handlers/plugin/help.ts:18,23`, `orchestrators/auth-host.ts:182`
  (device flow, bound per host), `orchestrators/import/execute.ts:1446`,
  `orchestrators/plugin/shared.ts:1595`, and
  `orchestrators/reconcile/apply.ts:1482`. There are 45 `notifyUsageError`
  calls in 21 files.
- `domain/github-auth.ts:115` defines `NotifyFn`, and `:436` builds the
  device-flow prompt string. The domain imports no `ctx` (D-32-04).
- Arity: raw info surfaces pass `"info"` explicitly (2 arguments). Structured
  info emissions pass 1 argument. The corpus records `argc`, so any arity
  change shows up as a missing baseline entry.

### Integration Points

- The `shared/` zone hosts everything new; `bridges/hooks` and `domain/`
  already import from `shared/`, so no fallow zone edge changes.
- Named-file gates that may need re-pointing when functions move: the
  credential-leak scan, `hooks-cap-notify`, and any source-scan listing
  `notification-dispatch.ts` symbols. Check
  `tests/architecture/source-scan.ts` users before moving code.

</code_context>

<specifics>
## Specific Ideas

- The user accepted all recommended answers, which follow the requirement
  wording literally and keep call-site churn minimal.
- "Total coverage" has a closed boundary: MCP tool results, `hookDebugLog`,
  the IL-3 `console.warn`, and `pi.sendMessage` model context are not output
  surfaces (research ARCHITECTURE §1).

</specifics>

<deferred>
## Deferred Ideas

None. The discussion stayed within the phase scope. Sink threading, origin,
redaction, and mode refusals are already scheduled in Phases 4-7.

</deferred>

---

*Phase: 03-typed-raw-surfaces*
*Context gathered: 2026-10-02*
