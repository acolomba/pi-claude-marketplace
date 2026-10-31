# Phase 3: Typed Raw Surfaces - Research

**Researched:** 2026-10-02
**Domain:** Internal output plumbing (TypeScript, `shared/` notification layer, architecture gates)
**Confidence:** HIGH (every claim below was read from the tree at `4e6c568a` this session, except the items in the Assumptions Log)

## Summary

Phase 3 moves eight raw-string output surfaces onto typed kinds. The text strategy formats them back into today's bytes and argument count. No library, package, or network access is involved. All the risk is in this repository's gates: the corpus byte lock, the AUTH-09 credential-leak scan, the unused-type-member gate with its `line:col` pins, fallow's production dead-code census (which is pinned empty), 100% per-pair direct coverage, and the gate-file path rules.

The design follows the existing structured path. Producers build a kind object. Resolve serializes anything live (only `reconcile-aborted`'s `cause`). The text strategy returns the exact `ctx.ui.notify` argument tuple, or nothing for the two empty no-ops. One private sink in `notification-dispatch.ts` spreads that tuple into the only `ctx.ui.notify(` calls in the extension. A tuple union `readonly [string] | readonly [string, Severity]` lets the text strategy own the arity rule (D-15). TypeScript 6.0.3 narrows it on `.length` under the project's strict flags (verified with a scratch `tsc` run).

Two facts shape the plan more than anything else. **First, the corpus cannot stay byte-for-byte identical in the test tree.** Deleting `makeRawNotifyFn` deletes the test that emits the baseline entries `["plain"]` (argc 1) and `["failed","error"]` (argc 2) in `tests/shared/notification-dispatch.test.ts`, and no typed kind can reproduce them. Pair-direct coverage also forces the new helpers to be called from that same test file, which adds extra entries. Both need an exact ledger and user approval, as Phase 2 did. **Second, the AUTH-09 gate goes vacuous by rename.** Every `notifyFn(` regex in `no-credential-leak.test.ts` will match zero call sites once the callback becomes `onDeviceCode`, and the gate will still pass. The retarget needs a positive call-site count and a planted control.

**Primary recommendation:** Build the work as three sequential plans that all edit `notification-dispatch.ts` and its test. (1) Add the kind vocabulary, the text strategy, the single sink, and all non-device-flow surfaces. (2) Move the device flow onto `onDeviceCode`, delete `makeRawNotifyFn` and `NotifyFn`, and retarget AUTH-09 with planted controls. (3) Add the D-16 sink gate and the D-15 arity pin, then run the phase-end corpus and catalog verification against an approved ledger.

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Kind vocabulary and entry path

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

#### What is data and what is text

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

#### Device-flow prompt (RAWS-03, AUTH-09)

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

#### Load-time and hook kinds, arity, and proof

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

### Deferred Ideas (OUT OF SCOPE)

None. The discussion stayed within the phase scope. Sink threading, origin,
redaction, and mode refusals are already scheduled in Phases 4-7.

</user_constraints>

<phase_requirements>

## Phase Requirements

| ID | Description | Research Support |
| --- | --- | --- |
| RAWS-01 | Usage errors and help are typed payloads (`usage-error` with message and usage, `usage-info`) for every verb. | All usage text reaches Pi through two helpers, `notifyUsageError` and `notifyUsageInfo` (dispatch `:100`, `:107`). Turning those two helpers into kind constructors covers every verb, and no caller changes (Pattern 2). |
| RAWS-02 | Diagnostics are typed payloads (`diagnostic {header, lines[]}`). | There are three producers, verified at `import/execute.ts:1446`, `plugin/shared.ts:1595`, and `reconcile/apply.ts:1482`. `notifyDiagnostic(ctx, header, lines)` keeps its signature (Pattern 2). |
| RAWS-03 | The device-flow prompt is a typed payload carrying `verificationUri` and `userCode`; the domain passes the values. | `github-auth.ts:436` builds the string today. The new `onDeviceCode` field, one shared payload type, the `auth-host.ts:182` rebinding, and the AUTH-09 retarget are covered in Pattern 4 and Pitfalls 2 and 6. |
| RAWS-04 | `reconcile-aborted` and `plugin-path-skipped` are typed payloads. | `index.ts:142` and `:163-166` (verbatim strings below). Resolve serializes `cause` with `errorMessage` (Pattern 3). |
| RAWS-05 | Hook rewake summaries and the Stop-hook override-cap warning are typed payloads with `origin: hook`; rewake text passes through as data. | `settle.ts:378` and `registry.ts:434`. The cap constant `STOP_OVERRIDE_CAP = 8` is at `bridges/hooks/runtime.ts:8` (module-private today). Hook kinds form their own union, so `origin` can be derived from the type in Phase 6. |
| TEXT-01 | Text output is a pure formatter of the model; bytes unchanged. | Text strategy plus single sink (Pattern 1). The corpus and catalog procedure is in Validation Architecture. The unavoidable corpus delta is described in Pitfall 1 and Open Question 1. |

</phase_requirements>

## Project Constraints (from CLAUDE.md / AGENTS.md)

- Read a file before editing it, and trace a function's callers before changing it.
- Never commit to `main`. This worktree is on `features/json`. Use Conventional Commits with a title of 5-72 characters and body lines of at most 80 characters. Do not mention GSD milestones or phases in commit messages.
- Run `pre-commit run --files <changed>` **before** `git commit`. Never use `--no-verify`, `--amend` to recover from a hook failure, or a rebase. In a worktree, prefix the command with `SKIP=trufflehog`.
- Every `.ts` edit follows `skills/typescript-google-style-review/SKILL.md` and `skills/typescript-comments/SKILL.md`. Comments cite durable IDs (D-NN, NFR-N, AUTH-09). They must not cite phases, plans, waves, or bare `Pitfall N` references.
- Every `tests/**/*.ts` edit follows `skills/typescript-unit-testing/SKILL.md`. Key rules for this phase:
  - One `.test.ts` per production module, at 100% function, line, and branch coverage **when the pair runs alone**.
  - Never test one source module from another module's test.
  - Build expected values independently and never call the production formatter in a test.
  - Use `// arrange`, `// act`, `// assert` phases.
  - Data-driven cases are one `test()` per row.
  - Use `t.mock`, not the process-wide `mock` (`hooks-cap-notify.test.ts` still imports `mock` from `node:test`; leave that as it is unless the file is touched).
  - Do not export a symbol for a test.
- Follow `skills/local-verification/SKILL.md`. Focused owner tests plus the pre-commit hooks complete a task. Full `npm run check` is required at the combined phase gate.
- IL-2: only `shared/notification-dispatch.ts` may call `ctx.ui.notify`. This is enforced by the ESLint `no-restricted-syntax` selector `CallExpression[callee.property.name='notify'][callee.object.property.name='ui']` [VERIFIED: eslint.config.js:141], with the BLOCK B exemption for the dispatch file [VERIFIED: eslint.config.js:152-154].
- Upstream parity: none applies, because this is internal plumbing with byte-identical text (CONTEXT `<domain>`).
- Fallow zones: `shared` may import only `platform`, `domain` may import `shared` and `platform`, and `bridges-hooks` may import `domain`, `persistence`, `shared`, and `platform` [VERIFIED: .fallowrc.json boundaries, printed this session].

## Architectural Responsibility Map

The repo has a single process-layer architecture. Its tiers are the project's zones, not web tiers.

| Capability | Primary Tier (zone) | Secondary | Rationale |
| --- | --- | --- | --- |
| Raw kind vocabulary (interfaces, unions) | `shared` (`notification-types.ts`) | — | D-01. The domain and bridges already import `shared`. |
| Serializing a live `cause` to text | `shared` (`notification-resolve.ts`) | — | D-13. Resolve already imports `errorMessage` [VERIFIED: notification-resolve.ts:3]. Phase 4 redaction goes here. |
| Composing text and choosing arity | `shared` text strategy (`notification-grammar.ts` or a sibling) | — | D-05/D-06/D-15. Text-only formatting lives in the text strategy (Phase 1 D-09/D-10). |
| The one `ctx.ui.notify` call | `shared` (`notification-dispatch.ts`) | — | IL-2. The ESLint exemption covers only this file, and the corpus hook depends on it. |
| Device-flow values | `domain` (`github-auth.ts`) | `orchestrators` (`auth-host.ts` binds) | D-09. The domain imports no `ctx` (D-32-04). The orchestrator binds the callback to the shared helper. |
| Stop cap value | `bridges-hooks` (`runtime.ts`) | `shared` receives it as data | D-07. `shared` must not import `bridges` (the `shared` rule allows only `platform`). |
| Load-time warnings | `entry` (`index.ts`) | `shared` helpers | NFR-2 try/catch wrappers stay in `index.ts` (D-13). |

## Standard Stack

No new dependency is installed. The phase uses only what is already in the tree:

| Tool | Version (verified) | Purpose here |
| --- | --- | --- |
| TypeScript | 6.0.3 [VERIFIED: `npx tsc --version`] | Tuple-union arity type, `satisfies` exhaustiveness |
| Node | v26.10.0 [VERIFIED: `node --version`], matching the corpus baseline `"nodeVersion": "v26.10.0"` [VERIFIED: notify-corpus/meta.json] | Test runner `node:test` and native TS stripping |
| `strong-mock` / `node:test` `t.mock` | existing | Test doubles per the unit-testing skill |
| fallow | existing `node_modules/.bin/fallow` | Boundaries, dead code, dupes, health |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
| --- | --- | --- |
| A tuple `NotifyArguments` returned by the text strategy | An `{ text, severity, explicit }` object | D-15 forbids an `explicitSeverity` flag *on the model*. A tuple puts arity in the text output itself, with no extra member for the type-member gate. Recommend the tuple. |
| A balanced-paren lexical capture for the AUTH-09 retarget | The TypeScript compiler API | The house gates are lexical (`source-scan.ts`). An exact-form allow-list (Pattern 4) is simpler and cannot be bypassed by a stray `)` in a string. |

## Package Legitimacy Audit

Not applicable. This phase installs no external package. **Packages removed:** none. **Packages flagged:** none.

## Architecture Patterns

### System Architecture Diagram

```
 producers (unchanged call shapes)                     shared/ (one presentation path)
 ───────────────────────────────────                   ──────────────────────────────────────────
 edge handlers / router ── notifyUsageError(ctx,{message,usage}) ─┐
 help.ts ───────────────── notifyUsageInfo(ctx, usage) ───────────┤
 import/execute, plugin/shared,                                   │   build kind object
   reconcile/apply ─────── notifyDiagnostic(ctx, header, lines) ──┤   (CommandRawSurface |
 auth-host (bound per host) ─ notifyDeviceFlowPrompt(ctx,prompt) ─┤    HookSurface | LoadSurface)
   ▲ domain/github-auth: opts.onDeviceCode({verificationUri,userCode})   │
 index.ts (NFR-2 try/catch) ─ notifyReconcileAborted(ctx, err) ───┤          │
                            ─ notifyPluginPathSkipped(ctx, skip) ─┤          ▼
 bridges/hooks/registry ───── notifyAsyncRewakeSummary(ctx, s) ───┤   resolveRawSurface()   (notification-resolve.ts)
 bridges/hooks/settle ─────── notifyStopHookOverrideCap(ctx,id,cap)┘   cause -> errorMessage(cause)
                                                                              │
 structured path: notify()/emit*Cascade -> resolveEnvelope -> body            ▼
            └───────────────── formatEnvelopeArguments(envelope, body) ─┐  formatRawSurface(resolved)
                                                                         │   -> NotifyArguments | undefined
                                                                         ▼
                                                  deliver(ctx, args)  (private sink, dispatch.ts)
                                                     undefined -> no call (empty diagnostic / summary)
                                                     [text]           -> ctx.ui.notify(args[0])
                                                     [text, severity] -> ctx.ui.notify(args[0], args[1])
```

### Recommended Layout (no new zone)

```
extensions/pi-claude-marketplace/shared/
├── notification-types.ts     # APPEND raw kind interfaces + unions after line 992 (avoids moving the :647 pin)
├── notification-resolve.ts   # + resolveRawSurface (reconcile-aborted cause -> string)
├── notification-grammar.ts   # + NotifyArguments, formatRawSurface, envelope-arity function (text strategy)
└── notification-dispatch.ts  # + private deliver sink; helpers become kind constructors; makeRawNotifyFn deleted
extensions/pi-claude-marketplace/bridges/hooks/runtime.ts  # export STOP_OVERRIDE_CAP (reader: settle.ts)
extensions/pi-claude-marketplace/domain/github-auth.ts      # NotifyFn -> onDeviceCode(prompt: DeviceFlowPrompt)
tests/architecture/<sink gate>.test.ts                      # D-16 (new) + a gate-targets.ts group
```

A separate `shared/notification-raw-text.ts` is acceptable (discretion). It would need its own mirrored `tests/shared/notification-raw-text.test.ts` at 100% direct coverage, and the D-16 gate would have to name two text-strategy modules. Keeping everything in `notification-grammar.ts` gives the gate one module to point at.

### Pattern 1: Text strategy returns the exact notify argument tuple; one sink spreads it

**What:** The text strategy returns `NotifyArguments | undefined`. The dispatch module has exactly one private sink, and the sink holds the only two `ctx.ui.notify(` spellings in the extension.

```typescript
// Pattern (types verified to narrow under TS 6.0.3 --strict --exactOptionalPropertyTypes
// --noUncheckedIndexedAccess in a scratch file this session).
export type NotifyArguments = readonly [text: string] | readonly [text: string, severity: Severity];

// notification-dispatch.ts (private)
function deliver(ctx: NotificationContext, args: NotifyArguments | undefined): void {
  if (args === undefined) {
    return;
  }

  if (args.length === 1) {
    ctx.ui.notify(args[0]);
  } else {
    ctx.ui.notify(args[0], args[1]);
  }
}
```

`emitWithSummary` becomes `deliver(ctx, formatEnvelopeArguments(envelope, body))`. The grammar function wraps today's `formatNotificationText` and applies the rule that already exists at dispatch `:84-88`: `if (envelope.severity === "info") { ctx.ui.notify(text); } else { ctx.ui.notify(text, envelope.severity); }` [VERIFIED: notification-dispatch.ts:82-89].

**Corpus-hook compatibility:** the hook rewrites `/(?<![\w$.])([A-Za-z_$][\w$]*)\.ui\.notify\(/g` and refuses to load any extension module whose total count of `ui.notify(` differs from the number of rewritable sites [VERIFIED: scripts/notify-corpus.hook.mjs:33,66-74]. `ctx.ui.notify(args[0])` qualifies. Do **not** write `opts.ctx.ui.notify(` or a destructured `ui.notify(` anywhere in extension source, **including comments and string literals**, because the raw-text rewrite counts those too.

### Pattern 2: Thin public helpers construct kinds; call sites unchanged

**What:** Each public helper builds a kind object and passes it to one internal path. D-14 asks for separate groups. Recommend three unions, `CommandRawSurface` (`usage-error`, `usage-info`, `diagnostic`, `device-flow-prompt`), `HookSurface`, and `LoadSurface`, each with its own internal entry (`emitHookSurface`, `emitLoadSurface`, and so on). Those entries feed one `emitRawSurface(ctx, surface)` that runs resolve, then format, then deliver. Do **not** export the group entries, because their only readers would be the helpers in the same file, which fails the empty `UNOWNED_EXPORT_CENSUS` (see Pitfall 4).

The current bytes, quoted verbatim, which the text strategy must reproduce:

| Kind (recommended spelling) | Today | Severity / argc | Source |
| --- | --- | --- | --- |
| `usage-error` | `` `${message.message}\n\n${message.usage}` `` | `"error"` / 2 | [VERIFIED: notification-dispatch.ts:100-101] |
| `usage-info` | `usage` | `"info"` / 2 | [VERIFIED: notification-dispatch.ts:107-108] |
| `diagnostic` | `` `${header}\n\n${lines.join("\n")}` ``; `if (lines.length === 0) { return; }` | `"warning"` / 2 | [VERIFIED: notification-dispatch.ts:130-139] |
| `async-rewake-summary` | `summary`; `if (summary.length === 0) { return; }` | `"info"` / 2 | [VERIFIED: notification-dispatch.ts:155-160] |
| `stop-override-cap` (matches catalog state `stop-override-cap`) | `` `Stop hook override cap reached.\n\n\`${pluginId}\`'s Stop hook blocked 8 times in a row; the turn ended despite its active block.` `` | `"warning"` / 2 | [VERIFIED: notification-dispatch.ts:188-192] |
| `device-flow-prompt` | `` `Open ${deviceCode.verification_uri} and enter: ${deviceCode.user_code}` `` | `"info"` / 2 | [VERIFIED: domain/github-auth.ts:436] |
| `reconcile-aborted` | `` `reconcile aborted: ${errorMessage(err)}` `` | `"error"` / 2 | [VERIFIED: index.ts:142] |
| `plugin-path-skipped` | `` `plugin PATH not refreshed for ${skip.scope} scope (install state unreadable): ${skip.reason}` `` | `"warning"` / 2 | [VERIFIED: index.ts:163-166] |

`errorMessage` is `export function errorMessage(err: unknown): string { return err instanceof Error ? err.message : String(err); }` [VERIFIED: shared/errors.ts:3-5]. `SkippedPathScope` is `readonly scope: "user" | "project"; readonly reason: string;` [VERIFIED: orchestrators/plugin-path.ts:64-68]. `shared` cannot import that type, so declare `{ scope: Scope; reason: string }` in `shared` (`Scope = "user" | "project"` [VERIFIED: shared/types.ts:16]). Have the helper read `skip.scope` and `skip.reason` explicitly, so that `SkippedPathScope`'s members keep a production read once `index.ts` no longer interpolates them.

**The `8` becomes `${cap}`:** `const STOP_OVERRIDE_CAP = 8;` is module-private [VERIFIED: bridges/hooks/runtime.ts:8], and `settle.ts` imports `runtime.ts` as type-only today (`import type { HooksRuntime } from "./runtime.ts";` [VERIFIED: settle.ts:27]). Export the constant and import it as a value in `settle.ts`. `runtime.ts` has only type imports, so no cycle forms. The helper signature becomes `notifyStopHookOverrideCap(ctx, pluginId, cap)`, which is positional and fits the 1-3 required-values convention.

### Pattern 3: Resolve serializes the only live value

`resolveRawSurface(surface): ResolvedRawSurface` maps `reconcile-aborted { cause: unknown }` to a resolved arm carrying `errorMessage(cause)` as a string. Every other kind passes through. Build `ResolvedRawSurface` with `Exclude<RawSurface, ReconcileAbortedMessage> | ResolvedReconcileAborted`. Do not use `Extract<…, { kind: … }>` (see Pitfall 5). The prune precedent serializes in dispatch (`causeChainTrailer(redactCauseChain(message.cause))` [VERIFIED: notification-dispatch.ts:243]). D-13 deliberately chooses resolve instead.

### Pattern 4: Device flow through one shared payload type

- Declare `DeviceFlowPrompt { readonly verificationUri: string; readonly userCode: string }` **once**, in `shared/notification-types.ts`. Import it with `import type` from `domain/github-auth.ts` (allowed edge: `domain` to `shared`). The `device-flow-prompt` kind can extend it. Do not declare a second, structurally identical interface in the domain. If you do, its members are initialized there but read only through the shared declaration, so the type-member gate reports them `unread`.
- `InitiateDeviceFlowOpts.notifyFn: NotifyFn` [VERIFIED: github-auth.ts:122-123] becomes `onDeviceCode: (prompt: DeviceFlowPrompt) => void`. The call becomes `opts.onDeviceCode({ verificationUri: deviceCode.verification_uri, userCode: deviceCode.user_code });`.
- In `auth-host.ts`, `const notifyFn = makeRawNotifyFn(ctx);` [VERIFIED: auth-host.ts:182] becomes `onDeviceCode: (prompt) => { notifyDeviceFlowPrompt(ctx, prompt); }`.
- `makeRawNotifyFn` has three production callers today, `index.ts` (2) and `auth-host.ts` (1), and two test readers: `tests/shared/notification-dispatch.test.ts:5745` and `tests/integration/auth-e2e.test.ts:30,132`. Delete it in the same commit that removes its last production reader, and update the two test readers in that commit.

### Anti-Patterns to Avoid

- **Building the string in the helper and passing it to the sink.** This defeats D-16. Every string must come out of a text-strategy function.
- **Exporting a text-strategy function that only dispatch's same-file code or tests read.** The census is empty, so an export without a production importer fails. If `formatNotificationText` loses its only production importer (dispatch), either keep dispatch importing it or un-export it and move its grammar tests (`tests/shared/notification-grammar.test.ts:1297-1450`) onto the new function.
- **Editing `docs/output-catalog.md` prose.** The diff must stay empty, even where the device-flow prose becomes slightly stale (see Open Question 3).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
| --- | --- | --- | --- |
| Temp-root planted controls | Inline `mkdtemp` / `copyFile` / `rm` | `withTempRoot`, `materializeTargets`, `plantOffender`, `plantBenignNearMiss` (`tests/architecture/temp-root-control.ts`) | `duplicates.threshold: 3`. Inline copies are a reportable clone (header of `temp-root-control.ts`). |
| Read-strip-scan of named targets | Your own `readFile` loop | `assertNoForbiddenSurface(targets, patterns, describe, { root })` (`tests/architecture/source-scan.ts`) | Fails on a missing target (WR-06) and returns `visited` for the D-07-03 deep-compare. |
| Production path literals in a gate | A path spelled in the gate file | A new group in `tests/architecture/gate-targets.ts` (full literal path) | Enforced by `D-07-06: no gate file names a production path the registry does not carry` [VERIFIED: gate-targets.test.ts:462]. Relative `../` import specifiers are exempt. |
| Corpus re-baseline | Hand-editing `baseline.jsonl` | `parseCorpus` / `serializeCorpus` from `scripts/notify-corpus.mjs` (how quick task 261002-dys spliced its 8 entries) | Keeps the file sorted, ASCII-escaped, and multiset-correct. |
| Comment stripping | Your own regex | `stripComments` from `source-scan.ts` | Same strip rule for every gate. |

## Runtime State Inventory

This phase is a refactor, so the five categories are answered explicitly:

| Category | Items Found | Action Required |
| --- | --- | --- |
| Stored data | None. Kinds are in-memory only. `state.json` and `mcp.json` are untouched, verified by reading every modified call path (none writes state). | None |
| Live service config | None. No external service carries these names. | None |
| OS-registered state | None. | None |
| Secrets/env vars | None renamed. The device-flow token path (`credentialOps.approve`) is unchanged. Only the prompt callback changes. | None |
| Build artifacts | `node_modules/.cache/typescript/tsconfig.tsbuildinfo` (incremental typecheck) refreshes itself. The corpus **baseline** is a committed artifact that does change (2 removals plus N additions; see Pitfall 1). | A ledgered re-baseline with user approval |

## Common Pitfalls

### Pitfall 1: The corpus cannot stay literally identical

**What goes wrong:** `node scripts/notify-corpus.mjs check` reports `missing in tests/shared/notification-dispatch.test.ts: "plain" (argc 1, severity null)` and `"failed" (argc 2, severity error)`, and lists extras for every new dispatch-test emission.

**Why:** The diff is a per-file multiset. A missing baseline entry fails, and a smaller capture is refused [VERIFIED: notify-corpus.mjs:173-183, 274-293]. The deleted `makeRawNotifyFn` test emits exactly those two entries [VERIFIED: baseline grep, one each]. No typed kind can produce a bare `"plain"` with argc 1 or `"failed"` without `\n\n`. Pair-direct coverage forces the new helpers (`notifyDeviceFlowPrompt`, `notifyReconcileAborted`, `notifyPluginPathSkipped`) to be called from `tests/shared/notification-dispatch.test.ts`, and each call is recorded as an extra.

**How to avoid:** Keep every other test file's emissions identical. Rewire existing tests so they emit the same bytes from the same file: the hooks-cap test gains `cap`, auth-e2e binds through the new helper, and the settle and index tests are unchanged. Record a `03-CORPUS-CHANGES.json` ledger in the Phase 2 format (`line`, `file`, `before`/`after` or removal, `multiplicity`, `test`, `preserves`) and get user approval through a checkpoint before re-baselining.

**Warning signs:** Any `missing in` line for a file other than `tests/shared/notification-dispatch.test.ts`, which means a real byte or arity change. Also any extra outside the ledger.

### Pitfall 2: The AUTH-09 gate passes vacuously after the rename

**What goes wrong:** The regexes `ERROR_OR_NOTIFY_FN_LITERAL_CALL_SITE` and `errorOrNotifyWithToken` match `notifyFn\s*\(` [VERIFIED: no-credential-leak.test.ts:162-164, 230-231, 372-373]. Once `notifyFn` is gone they match nothing for the callback and still pass on the `new Error(` half.

**How to avoid:** Retarget both the github-auth test and the PROV-05 test (provider files `domain/auth-registry.ts` and `orchestrators/auth-host.ts`).

- Assert a **positive count**: at least one `onDeviceCode\s*\(` call exists in `github-auth.ts` (the D-07-03 non-vacuity idiom this file already uses for `hookDebugLog`).
- Make the strongest check an **exact-form allow-list**: count all `onDeviceCode\s*\(` call sites and require each one to match `\.onDeviceCode\(\s*\{\s*verificationUri:\s*deviceCode\.verification_uri,\s*userCode:\s*deviceCode\.user_code,?\s*\}\s*\)`. Any other argument shape fails, including a variable or a spread object, so a stray `)` inside a string cannot defeat a bounded scan.
- Keep the existing credential-identifier scan (`CREDENTIAL_IN_LITERAL` [VERIFIED: :140-141]) as defense in depth over the captured argument text.
- In `auth-host.ts`, scan the binding `onDeviceCode: (prompt) => … notifyDeviceFlowPrompt(ctx, prompt)` the same way.

### Pitfall 3: Type-member pins move when dispatch or types are edited

**What goes wrong:** `npm run lint:type-members` exits 2 with empty stdout.

**Why:** These contracts pin `line:col`:

- `"id": "extensions/pi-claude-marketplace/shared/notification-dispatch.ts:204:43"` / `"filter": "…notification-dispatch.ts:204:12"` (owner `dispatchInfoMessage.message`)
- `"…notification-types.ts:647:48"` / `"…:647:11"` (owner `isScopeBearingListRow`)

[VERIFIED: scripts/check-unused-type-members.contracts.json:590-619]. Every Phase 3 plan edits dispatch above line 204.

**How to avoid:** Append the new types **after line 992** of `notification-types.ts` so the `:647` pin stays put. Run Prettier **before** `lint:type-members`. When re-pinning, shift the **line only** (the pins sit on the same token, and owner plus key is not unique). The gate itself takes about 85 seconds, and its negative controls take about 7 minutes [CITED: docs/unused-type-member-gate.md].

### Pitfall 4: Exports and types without a production reader fail the census

**Why:** `UNOWNED_EXPORT_CENSUS` is `{}`, and the gate compares it for exact equality [VERIFIED: gate-targets.ts:696]. `.fallowrc.json` sets `"private-type-leaks": "error"` and `includeEntryExports: true` [VERIFIED: printed this session].

**How to avoid:**

- Export a type only when another production module imports it. A type used in an exported signature must be exported (no private leak) and must be imported somewhere in production.
- The same applies to new exports: `STOP_OVERRIDE_CAP` (read by `settle.ts`), `DeviceFlowPrompt` (read by `github-auth.ts` and dispatch), the new helpers (read by `auth-host.ts` and `index.ts`), and the text and resolve functions (read by dispatch). These all have readers.
- At no commit may `makeRawNotifyFn` lose its last production reader while it is still exported.

### Pitfall 5: `Extract<Union, { kind: … }>` creates type-selection findings

**Why:** Each such position gets its own `"category": "type-selection"` contract with a pinned line and column [VERIFIED: contracts.json:590-596, the dispatch `Extract<NotificationMessage, { kind: StandaloneKind }>` at `:204`].

**How to avoid:** Narrow with `switch (surface.kind)` inside the text strategy and the resolver. Build resolved types with `Exclude<…, NamedInterface>` or explicit interfaces, not with object-literal `Extract`.

### Pitfall 6: Domain test support churn broadens verification

`tests/domain/github-auth.test.ts` has about 23 `notifyFn:` sites asserting the composed string [VERIFIED: grep count 23]. `tests/domain/device-flow-contract.ts` (shared contract support, used by `github-auth.test.ts` and `device-flow-fake.test.ts`) records `notifications: { message, severity }[]` [VERIFIED: device-flow-contract.ts:106-125]. Both move to `{ verificationUri, userCode }` observations. Changing shared test support makes `check:changed` fall back to the full check and all-pair coverage (local-verification skill), so budget for about 8 minutes of all-pair coverage plus the full check on that commit.

### Pitfall 7: Planted-control dupes

The offender, benign, and near-miss trio is near-identical across gate files. Use the `temp-root-control.ts` helpers and keep the gate-specific code short. Run `npx fallow dupes` before committing a new gate.

## Code Examples

### D-16 sink gate (recommended design, house pattern)

```typescript
// tests/architecture/<presentation-sink>.test.ts -- target from a NEW gate-targets.ts group,
// e.g. PRESENTATION_SINK_TARGETS = ["extensions/pi-claude-marketplace/shared/notification-dispatch.ts"].
// (Two groups naming one path is legal; one group naming it twice is not -- gate-targets.test.ts:206.)
const SINK_PATTERNS = [
  // Clause 1: any ui.notify( call whose argument list is not one of the two sanctioned sink forms.
  { name: "notify argument not from the text strategy",
    pattern: /\bui\.notify\((?!args\[0\]\)|args\[0\], args\[1\]\))/ },
  // Clause 2: any deliver( call whose second argument is not a direct call (array/template/identifier).
  { name: "sink handed a pre-composed value",
    pattern: /\bdeliver\(\s*ctx\s*,\s*(?![A-Za-z_$][\w$]*\()/ },
  // Clause 3: no text-strategy function defined inside the dispatch module itself.
  { name: "format function declared in dispatch", pattern: /\bfunction\s+format[A-Z]/ },
];
```

The plan should also assert the following:

- **Non-vacuity:** the stripped source holds exactly two `ui.notify(` occurrences, and `deliver(ctx,` occurs at least once for the structured path and once for the raw path. Assert this positively, in the style of `hookDebugLog` counting.
- **Visitation:** `report.visited` deep-equals the group (D-07-03).
- **Offender control:** plant `export function leak(ctx: NotificationContext): void { ctx.ui.notify(\`x\`, "info"); }` in a temp copy, and the scan rejects.
- **Second offender control:** plant `deliver(ctx, [\`pre-composed\`, "info"]);`, and the scan rejects.
- **Benign control:** the unmutated copy passes.
- **Near-miss control:** `plantBenignNearMiss(root, target, 'ctx.ui.notify(\`x\`)')` passes, which proves comment stripping.

(The `ui.notify(\`x\`` example above appears in a test file, so the corpus hook never loads it. The hook only rewrites `/extensions/pi-claude-marketplace/` URLs [VERIFIED: notify-corpus.hook.mjs:57].)

### D-15 arity pin

Use one `test()` per raw kind. Type the rows as `{ … } satisfies Record<RawSurface["kind"], Row>`, so that adding a kind without a row fails `npm run typecheck`. Each row asserts the full `NotifyArguments` tuple against an independently written literal (for example `["reconcile aborted: boom", "error"]`). Add a separate case pinning that an info-severity envelope yields a 1-tuple.

## State of the Art (in-repo)

| Old Approach | Current Approach | When Changed | Impact |
| --- | --- | --- | --- |
| Renderers walked live `Error`s | Resolve serializes; text formats (Phase 1 D-11) | json-output Phase 1 | `reconcile-aborted` follows suit (D-13) |
| Per-status render callbacks | Row-policy data (Phase 2) | json-output Phase 2 | Raw surfaces are the last pre-composed strings |
| Corpus nondeterminism in prune tests | Injected backup-root creator | quick 261002-dys (`741581f8`) | `notify-corpus.mjs check` now exits 0: `Notify corpus check passed: 3133 baseline entries present, 0 extra.` [CITED: 261002-dys-SUMMARY.md:101] |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
| --- | --- | --- | --- |
| A1 | The ROADMAP invariant ("re-diffs empty"; user-approved exceptions only) means the 2 removals **and** the new extras need explicit user approval with a ledger. | Pitfall 1, Open Q1 | The plan lacks a checkpoint, or adds one that is not needed. |
| A2 | Fallow flags `formatNotificationText` as an unused export if dispatch stops importing it, even though grammar's own body and tests still use it. | Anti-Patterns | A plan step that is not needed, or a red `npm run fallow`. |
| A3 | The type-member gate credits a `switch (surface.kind)` on a union to each constituent's `kind` declaration, as it does for `NotificationMessage` today. | Pattern 2 | New `kind` members report `unread`, and contracts are needed. |
| A4 | D-14's "each with its own public entry point" is satisfied by per-group internal entry functions behind the exported thin helpers, which keeps the census clean. | Pattern 2 | The user wanted exported group entry points, which need production readers. |
| A5 | The phase catalog base is the phase-start commit `4e6c568a` (main's #198 already moved the catalog past the Phase 2 base `e40d3dda`). | Validation | The wrong diff base yields a false red or a false green. |

## Open Questions

1. **Corpus delta approval (blocking at the phase gate).**
   - Known: −2 entries (the `makeRawNotifyFn` test), plus extras from new dispatch-test emissions. Exact count depends on the test design: about 3-6 if each new helper gets one or two cases.
   - Unclear: whether the user treats extras as approval-requiring. Phase 2 required zero extras.
   - Recommendation: add a `checkpoint:human-verify` in the last plan with the full ledger. Keep extras minimal by covering each helper with one emission case, and test the formatting arms purely in the grammar test, which emits nothing.
2. **The empty no-op seam for Phase 5.** The text strategy owns "empty diagnostic or summary emits nothing" (D-05, D-08). The JSON strategy will need the same rule. Record this, but do not resolve it now.
3. **Catalog prose drift.** `docs/output-catalog.md` says the prompt is "Emitted exactly once by `initiateDeviceFlow`" and "The byte form is locked by `tests/domain/github-auth.test.ts`" [VERIFIED: docs/output-catalog.md:4088-4090]. After D-09 the bytes are locked by the dispatch and grammar owner tests. The unit-testing skill forbids testing dispatch from the domain test. The catalog diff must stay empty, so record this as a known drift for Phase 7's catalog close-out and do not edit it now. `no-stale-test-citations` still passes, because the cited file exists.
4. **`settle.ts:377` has no try/catch around the cap notify.** This becomes relevant only when the Phase 5 sink can throw. Out of scope here.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
| --- | --- | --- | --- | --- |
| Node | All tests and the corpus | ✓ | v26.10.0 (matches the baseline) | — |
| npm | scripts | ✓ | 11.19.1 | — |
| tsc / fallow | typecheck, gates | ✓ | 6.0.3 / local bin | — |
| pre-commit | commit gate | ✓ | 4.5.1 | — |

No missing dependencies.

## Validation Architecture

### Test Framework

| Property | Value |
| --- | --- |
| Framework | `node:test` + `node:assert/strict` + `strong-mock` (existing) |
| Config file | `package.json` scripts; `tsconfig.json` |
| Quick run command | `node --test tests/shared/notification-dispatch.test.ts tests/shared/notification-grammar.test.ts tests/shared/notification-resolve.test.ts` |
| Full suite command | `npm run check` (observed 22m57s to 27m; the GSD `test_gate_timeout` is 2400 s) |
| Corpus | `node scripts/notify-corpus.mjs check` (about 136-140 s; it is not part of `check`). Require `0 extra` beyond the ledger. Exit 0 alone is insufficient (Phase 2 VALIDATION). |
| Catalog | `git diff --exit-code 4e6c568a -- docs/output-catalog.md` and `node --test tests/architecture/catalog-uat/catalog-contract.test.ts` (pins `EXPECTED_STATE_COUNT = 260`, `EXPECTED_UTF8_BYTES = 39_143` [VERIFIED: catalog-contract.test.ts:40-41]) |

### Phase Requirements to Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
| --- | --- | --- | --- | --- |
| RAWS-01 | usage-error/usage-info bytes and arity (SNM-13) | unit | `node --test tests/shared/notification-dispatch.test.ts tests/edge/handlers/plugin/help.test.ts` | ✅ |
| RAWS-02 | diagnostic join and empty no-op | unit | `node --test tests/shared/notification-dispatch.test.ts tests/orchestrators/import/execute.test.ts tests/orchestrators/reconcile/apply.test.ts` | ✅ |
| RAWS-03 | domain passes values; prompt bytes; AUTH-09 | unit + arch | `node --test tests/domain/github-auth.test.ts tests/domain/device-flow-fake.test.ts tests/orchestrators/auth-host.test.ts tests/architecture/no-credential-leak.test.ts && npm run test:integration` | ✅ (planted controls ❌ Wave 0) |
| RAWS-04 | reconcile-aborted / plugin-path-skipped bytes; resolve serializes `cause` | unit | `node --test tests/index.test.ts tests/shared/notification-resolve.test.ts` | ✅ |
| RAWS-05 | rewake passthrough; cap from the bridge constant | unit + arch | `node --test tests/bridges/hooks/settle.test.ts tests/bridges/hooks/async-rewake/registry.test.ts tests/architecture/hooks-cap-notify.test.ts` | ✅ |
| TEXT-01 | arity rule per kind (D-15); sink-only strings (D-16); bytes | unit + arch + tooling | `node --test tests/shared/notification-grammar.test.ts tests/architecture/<sink-gate>.test.ts && node scripts/notify-corpus.mjs check` | ❌ Wave 0 (sink gate) |

### Sampling Rate

- **Per task commit:** the owner tests above, plus `npm run typecheck`, plus pre-commit (which runs `check:changed` and selected direct coverage).
- **Per plan end:** `npm run check` unpiped, with the exit code written to a log. Then the corpus check, the catalog diff, and `npm run lint:type-members` after Prettier.
- **Phase gate:** full `npm run check` green, the corpus matching the approved ledger exactly, and the catalog diff empty before `/gsd-verify-work`.

### Wave 0 Gaps

- [ ] `tests/architecture/<presentation-sink>.test.ts`, plus a `gate-targets.ts` group (D-16)
- [ ] Planted-control cases in `tests/architecture/no-credential-leak.test.ts` (the gate has none today, and its scans read `REPO_ROOT` directly, so the github-auth scan must take a `root` first)
- [ ] D-15 per-kind arity rows in `tests/shared/notification-grammar.test.ts` (or the sibling's test)
- [ ] `.planning/phases/03-typed-raw-surfaces/03-CORPUS-CHANGES.json` ledger

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
| --- | --- | --- |
| V2 Authentication | yes (device flow) | GitHub OAuth Device Flow is unchanged. Only the prompt plumbing changes. |
| V3 Session Management | no | — |
| V4 Access Control | no | — |
| V5 Input Validation | no new input | `DeviceCodeResponse` field validation stays in `requestCodeImpl` (github-auth.ts:208-209) |
| V7 Error handling and logging | yes | AUTH-09: no token in any user-visible message. Exact-form allow-list on `onDeviceCode` plus a planted control. |
| V6 Cryptography | no | — |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
| --- | --- | --- |
| Token interpolated into the device-flow prompt | Information disclosure | The kind type admits only `verificationUri` and `userCode` (D-10). The AUTH-09 exact-form gate has a planted offender. |
| A gate that greens over zero call sites after a rename | Repudiation of the control | Positive call-site counts plus `visited` deep-compare (D-07-03) |
| Absolute paths or URL userinfo inside `reconcile aborted: …` | Information disclosure | Not changed this phase (bytes locked). Resolve is the single serialization site where Phase 4 PMOD-04 adds redaction (D-13). |
| A pre-composed string bypassing the text strategy | Tampering (of the output contract) | D-16 sink gate with planted offenders |

## Sources

### Primary (HIGH confidence, read this session)

- `extensions/pi-claude-marketplace/shared/notification-{dispatch,resolve,grammar,types}.ts`, `shared/errors.ts`, `index.ts`, `domain/github-auth.ts`, `orchestrators/auth-host.ts`, `orchestrators/plugin-path.ts`, `bridges/hooks/{settle,runtime}.ts`, `bridges/hooks/async-rewake/registry.ts`, `edge/handlers/plugin/help.ts`
- `tests/architecture/{no-credential-leak,hooks-cap-notify,no-orchestrator-network,gate-targets}.test.ts`, `tests/architecture/{source-scan,temp-root-control,gate-targets}.ts`, `tests/shared/notification-dispatch.test.ts`
- `scripts/notify-corpus.mjs`, `scripts/notify-corpus.hook.mjs`, the baseline `.planning/phases/01-presentation-model/notify-corpus/{baseline.jsonl,meta.json}`
- `scripts/check-unused-type-members.contracts.json`, `docs/unused-type-member-gate.md`, `.fallowrc.json`, `eslint.config.js`, `package.json`
- `.planning/phases/0{1,2}-*/` CONTEXT, VALIDATION, VERIFICATION, and `02-CORPUS-CHANGES.json`; `.planning/research/ARCHITECTURE.md` §1, §4, and §5 (line numbers re-verified against the current tree)
- A scratch `tsc` 6.0.3 probe of tuple-length narrowing (exit 0)

### Secondary / Tertiary

- None. No external sources were needed for an internal-plumbing phase.

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH. No new dependencies, and versions were probed.
- Architecture: HIGH. Every surface, byte string, and zone edge was read from source.
- Pitfalls: HIGH for the corpus, pins, and AUTH-09 vacuity, all verified. MEDIUM for the census and type-member read model (A2, A3).

**Research date:** 2026-10-02
**Valid until:** the next merge from `main` (it shifts the pins and corpus) or 2026-11-01, whichever comes first.
