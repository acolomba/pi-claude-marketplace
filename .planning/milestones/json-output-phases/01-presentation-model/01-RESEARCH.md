# Phase 1: Presentation Model - Research

**Researched:** 2026-09-28
**Domain:** Internal presentation plumbing of a byte-locked TypeScript text renderer (Pi extension), plus a Node module-hook capture tool
**Confidence:** HIGH for the in-repo inventory and the capture-tool feasibility (both measured in this session); MEDIUM for the proposed module split and plan order (design recommendations)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Wire-corpus baseline (first plan of the phase)

- **D-01:** Capture with a **committed loader-hook tool**. A `scripts/` tool
  runs the unit and integration suites under a Node `--import` loader hook. The
  hook rewrites every `X.ui.notify(` call in `extensions/**` into a recorder at
  load time. IL-2's single-site ban (only `shared/notification-dispatch.ts`
  calls `ctx.ui.notify`) makes the match exact, and it survives file splits and
  renames in Phases 1–3. No production seam is added
  (`no-test-only-production-surface.test.ts` stays satisfied). The tool must be
  re-runnable with one command at every phase end through Phase 7, and it is
  removed at milestone close. — **Reversibility:** reversible — tooling only,
  deleted at close.
- **D-02:** **Diff rule is a per-file multiset, baseline ⊆ now.** Each test
  file maps to a multiset of `(message, severity, argc)` entries, where `argc`
  is the `ctx.ui.notify` argument count. Every baseline entry must still appear,
  with its multiplicity, in the same file's re-capture. Entries that exist only
  in the new capture are allowed but listed for review. A changed byte therefore
  shows up as a missing baseline entry, and the diff fails. Test insertions and
  reordering inside a file do not cause false alarms.
- **D-03:** **The baseline is a committed planning artifact** under
  `.planning/phases/01-presentation-model/`. The re-diff is a named
  verification step at each phase end (in the phase's plans and in the
  verifier's must-haves). It is **not** added to `npm run check`. The durable
  byte lock stays `docs/output-catalog.md`. Phase 4's PMOD-04 redaction is the
  only sanctioned difference, and that phase states it explicitly.
- **D-04:** **Non-vacuity has two guards.** A companion `*.negative` script,
  following the house `scripts/*.negative.mjs` pattern, plants a one-byte drift
  in a scratch copy. It asserts that the diff exits non-zero and names the
  file. The diff also refuses a capture whose total emission count is below
  the baseline's. Both run in Phase 1 and again whenever the tool changes.

#### Probe snapshot plumbing

- **D-05:** **The command takes the snapshot and passes it.** Each command run
  calls `softDepStatus(pi)` exactly once. The same snapshot feeds
  `companionSeverity` (severity stamping stays with the producers, per the
  recorded "notify is a dumb renderer" preference) and the notify family. The
  snapshot replaces today's `pi` argument in the notify-family signatures,
  about 80 calls in 40 files: `notify`, `notifyWithContext`,
  `emitContextCascade`, `emitUpdateNoOpCascade`,
  `emitReconcileAppliedContextCascade`, and the update-cascade emitter.
  Multi-emission commands (the info failure loops, import cascade plus
  diagnostics, reconcile cascade plus post-install warnings) probe once for the
  whole run. The strict `getAllTools()` pins in the 31 suites that use
  `tests/edge/notification-boundary.ts`, and in `catalog-uat/mock-pi.ts`, move
  from per-emission to per-command. — **Reversibility:** costly — reverting
  re-threads `pi` through ~80 call sites and their tests.
- **D-06:** **What replaces `pi` is a per-invocation object, not a bare
  `SoftDepStatus`.** In Phase 1 its only member is the soft-dep snapshot, which
  resolve reads. Phase 5 adds the entry sink, and Phase 6 adds `invocationId`
  and the machine command id. Each member lands with its first reader, so the
  unused-type-member gate holds, and the ~80 call sites are touched once. Later
  phases change only the construction sites. The name must not be `mode` or
  sit under `notifications`, because `opts.notifications?.mode ===
  "orchestrated"` already exists for another concept (`autoupdate.ts:419`,
  `add.ts:549`). — **Reversibility:** costly — the same ~80 call sites.
- **D-07:** **The object is built at the edge and lifecycle roots**, once per
  run: the `/claude:plugin` command handler, the `resources_discover` load
  pass, and the hook callbacks that emit. Orchestrators receive it. Nested runs
  share the parent's object: import with its N installs, and reconcile with its
  installs and uninstalls. That boundary is also Phase 6's `invocationId`
  boundary, so construction never has to move.
- **D-08:** SC-3's proof: a test whose `pi` probe answers differently on a
  second call shows that one snapshot drives both the severity stamp and the
  marker composition.

#### Model shape

- **D-09:** **The model is internal readonly TS interfaces in `shared/`** (for
  example `shared/notification-model.ts` and `shared/notification-resolve.ts`;
  exact names at the planner's discretion). It is **not** typebox, and it is
  **not** the wire schema. Phase 4 authors the typebox wire schema and an
  explicit, total-map converter from the model to a DTO. As a result, internal
  refactors never become wire changes, and PITFALLS #10 holds by construction:
  JSON serializes a built DTO, never the model, and never with a replacer. —
  **Reversibility:** costly — merging model and wire later means rewriting both
  strategies' inputs.
- **D-10:** **The model carries the facts and the composed summary line.**
  Resolve computes count, subject, and severity, and it composes the English
  line with today's `summaryPhrase` / `buildSummaryLine` logic, moved out of
  text composition. The line is model data that the text strategy reads
  verbatim, and Phase 4's JSON will read it too (WIRE-05) without re-deriving
  English. The tally is numeric counts. Hints are ids, such as partial-install,
  partial-update, stale-gate-update, and enable. `needsReload` is a boolean.
  The text strategy composes the tally sentence, the hint trailers, and the
  `/reload to pick up changes` trailer.
- **D-11:** **Failure detail is serialized in resolve.** Producers keep putting
  the live `Error` in `NotificationMessage`, so the producer vocabulary does not
  change. Resolve walks it once, reusing today's `causeChainTrailer` /
  `manualRecoveryLeaks` semantics (`CAUSE_CHAIN_MAX_DEPTH = 5` in
  `shared/errors.ts`, including `CleanupContextError` link messages). It
  produces `causeChain: string[]` with a `truncated` flag, per-phase
  rollback-partial entries with serialized causes, and manual-recovery leaks as
  strings. No live `Error` reaches the renderer. Phase 4 adds PMOD-04 redaction
  at this single site.
- Text-only formatting stays in the text strategy: 66-column description
  truncation and wrapping, glyphs, scope-bracket elision, version display
  (`#sha7`, `v` prefix, arrows), the 4- and 6-space cause-chain indents, block
  separators, and the `(no marketplaces)` sentinel. The model keeps the full
  description, the real scope, and the raw versions (research ARCHITECTURE §2).

#### Phase 1/2 seam

- **D-12:** **The per-verb marker suppression table is a marker-only policy on
  each `CommandContext`.** It is a total per-status `markers` switch, keeping
  the `as const satisfies CommandContext<...>` exhaustiveness anchor, and
  resolve reads it. The legacy central `notify()` path gets the equivalent
  default table. Phase 2 extends this same map with content-reason switches and
  the other divergences, so the data lands once, in its final home. The
  probe-to-marker derivation has its own owner test that states the table as
  data (SC-5). `tests/architecture/workflows-marker-coverage.test.ts` is
  re-pointed at the new derivation site, not deleted.
- **D-13:** **Render arms take resolved rows in Phase 1.** `RenderFn` becomes
  `(resolvedRow, mpScope) => string`. Arms receive final reasons from resolve
  and never see a probe, which meets SC-2 literally. The 70 direct render-arm
  test calls in 12 test files are updated now to pass resolved rows. Phase 2
  migrates them again, to policy and formatter asserts, when the arms are
  deleted. No probe-shaped adapter carries into Phase 2.

### Claude's Discretion

- Module names and the split between model, resolve, and text within
  `shared/` (no new top-level folder or zone).
- The capture tool's file layout and output format, how it identifies the test
  file per process, and newline normalization.
- The plan breakdown and migration order inside Phase 1, subject to these
  rules: the corpus baseline is the first plan; no intermediate commit leaves
  an export without a reader; `npm run check` is green after every plan.
- Where the SC-3 proof test lives.

### Deferred Ideas (OUT OF SCOPE)

None. The discussion stayed within the phase scope. The later-phase seams
(entry sink, `invocationId`, command id, row-policy extension, redaction) are
already scheduled in Phases 2–6 and are recorded above only as constraints on
Phase 1's shapes.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PMOD-01 | Every presentation decision -- severity, `needsReload`, tally, summary line, composed reasons including `{requires ...}` soft-dep markers, and hints -- is computed in one model step upstream of rendering; neither strategy probes state or walks `Error` objects. The render-time `softDepStatus` probe leaves `shared/notification-dispatch.ts`, and one probe per invocation is shared with severity computation. | §"Per-verb soft-dep suppression table" (source data for D-12), §"Decision vs text split" (D-10), §"Snapshot plumbing" (D-05..D-08: three render-time probes, three severity-time probes, call-site inventory, construction roots), §"Plan breakdown" (Plans 02, 04, 05) |
| PMOD-03 | Failure detail is carried as a serialized, redacted cause chain (`causeChain: string[]` with a `truncated` flag, plus per-phase rollback entries), never as a live `Error`. (Redaction lands in Phase 4 under PMOD-04; Phase 1 text is byte-identical.) | §"Decision vs text split" rows for cause chain, leaks, rollback partials; Code Example "Structured cause-chain walk"; Plan 03 |

</phase_requirements>

## Project Constraints (from AGENTS.md)

Directives the planner must verify each plan against. [VERIFIED: /home/acolomba/src/pi-claude-marketplace-json/AGENTS.md, read this session]

- **Git:** never commit to `main`; branch `features/json` is current. Conventional Commits, title 5-72 chars, body lines <= 80, no GSD milestone/phase mentions. Run `pre-commit run --files <changed>` (or `--all-files`) **before** `git commit`; never `--no-verify`; never rebase or amend; in a worktree prefix commits with `SKIP=trufflehog`.
- **Quality bar (NFR-6):** `npm run check` stays green: typecheck, ESLint, `lint:workflows` (+negative), `fallow` (4 sub-gates), Prettier check, corresponding-tests (+negative), direct-coverage negative, 100% unit coverage, integration tests, `lint:type-members` (+negative).
- **Output channel (IL-2):** all user-visible output via `ctx.ui.notify` inside `shared/notification-dispatch.ts`; no `process.stdout`/`stderr` in `extensions/**`.
- **Recovery (NFR-2):** no throw may escape `resources_discover`, `session_start`, or hook callbacks.
- **Redaction (NFR-9):** no absolute path disclosure beyond what text already shows.
- **Comments:** follow `skills/typescript-comments/SKILL.md` -- no `Phase N`/`Plan N`/`Wave N`/bare `Pitfall N` references; no narration of removed code ("the former X"); decision/requirement IDs (`D-12`, `PMOD-01`, `SNM-16`) are allowed anchors.
- **Tests:** follow `skills/typescript-unit-testing/SKILL.md` -- one mirrored `tests/**` owner per production module, 100% line/branch/function coverage **when run alone**; `test()` not `it()`; `// arrange // act // assert`; **build expected values independently -- do not compute test data with production code** (this bans building D-13 resolved rows by calling the real resolve); strong-mock `exactParams: true`, `verify()` every mock; no `t.mock.module()` or custom loader in tests.
- **Style:** `skills/typescript-google-style-review/SKILL.md` -- interfaces for object types, named exports, `import type` for type-only imports, every export used outside its module.
- **Fallow local gate:** run `fallow audit --format json --quiet --explain --gate-marker agent` before commit; fix `fail`.
- **Versioning:** offer a version bump + CHANGELOG entry before a PR (not a Phase 1 task).

## Summary

The phase moves every presentation decision out of three render-time sites and into one resolve step, without changing a byte. The renderer's inputs today are the raw producer `NotificationMessage`, a per-verb string-returning `RenderFn` map, and a `SoftDepStatus` probe taken inside `shared/notification-dispatch.ts` at three places (`:280`, `:387`, `:433`). A second, independent probe is taken for severity at three producer sites (`install-flow.ts:406`, `update-cascade.ts:190`, `enable-disable.ts:1347`). Cause chains, manual-recovery leaks and rollback-partial causes are walked from live `Error` objects inside `notification-grammar.ts` (`:1069`, `:1643-1650`). Severity, the summary sentence, the tally and the reload trailer are composed together in `notification-summary.ts` and `notification-dispatch.ts`.

The capture tool D-01 asks for is feasible and was prototyped in this session: an `--import` preload that calls `module.registerHooks()` and rewrites `X.ui.notify(` in `extensions/pi-claude-marketplace/**` source (the load hook receives raw TypeScript with `format: "module-typescript"`, before type stripping). Under the real unit + integration globs it recorded 2622 emissions from 68 test files plus 1 forked child in about 2 minutes, with all 7291 tests passing. Two consecutive captures are **not** byte-identical: 81 entries differ, from mkdtemp paths, UUID staging names, and write-file-atomic numeric suffixes, plus a racy forked child process. Three normalizers and a "test files only" filter make the two runs identical. The tool must ship those normalizers and a self-diff determinism check, or D-02's "baseline ⊆ now" rule fails on an unchanged tree.

The per-verb marker table (the research flag) is simpler than the partial list in PITFALLS suggests: soft-dep markers can only appear on the four statuses whose row type carries `dependencies` (`installed`, `updated`, `reinstalled`, `partially-installed`). Every arm for those statuses composes markers **except** `plugin list`'s `partially-installed` arm. Every other arm, every marketplace header, and every info surface is structurally marker-free. The content-reason divergences (`plugin list` available/remote ON, `fetch` available/remote OFF, reconcile-applied `uninstalled` OFF) are Phase 2's concern, but the arms keep making that choice over the resolved reasons in Phase 1.

**Primary recommendation:** Land six sequential plans: (01) corpus tool + baseline; (02) envelope facts into resolve; (03) failure serialization + hint ids + not-added reason into resolve; (04) `markers` policy + resolved-row `RenderFn` + probe-free grammar; (05) the per-invocation object, built in `edge/register.ts`'s command closure and in `index.ts`'s `resources_discover`, replacing `pi` across the notify family; (06) phase-gate verification. Keep the render-time probe inside dispatch until Plan 05 so each intermediate plan stays small and green.

## Architectural Responsibility Map

This is a single-process Pi extension; the "tiers" are the repo's own layers (`.fallowrc.json` zones).

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Soft-dep snapshot (one probe per run) | `edge/` (command root) and `entry` (`index.ts` load root) | `shared/` (run-object type + constructor) | D-07: built once at the roots; `shared` may import `platform` (`softDepStatus`). |
| Severity stamping per row | `orchestrators/` (producers) | -- | Recorded "notify is a dumb renderer" preference; D-05 feeds them the same snapshot. |
| Resolve (markers, final reasons, hints, failure serialization, summary line, tally counts, needsReload, noOp) | `shared/` | -- | Leaf zone; must sit above `bridges/` (`no-probe-in-workflows-bridge`) and below orchestrators. |
| Marker policy data (per verb) | `orchestrators/*.messaging.ts` (`CommandContext.markers`) | `shared/` (default table for legacy `notify()`) | D-12: the data lives on each command's context. |
| Text formatting (glyphs, brackets, versions, truncation, indents, joins, trailers) | `shared/notification-grammar.ts` (text strategy) | -- | D-10/D-11 text-only list. |
| The single `ctx.ui.notify` call | `shared/notification-dispatch.ts` | -- | IL-2 sole sink (unchanged). |
| Corpus capture/diff | `scripts/` (tooling) | `.planning/phases/01-presentation-model/` (baseline) | D-01/D-03; `scripts/**` is `allowUnmatched` in fallow boundaries. |

## Standard Stack

No new runtime or dev dependency is needed. [VERIFIED: package.json read this session]

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `node:module` `registerHooks()` | Node >= 22.15 / 23.5 (release candidate since 24.13.1 / 25.4.0) | In-thread synchronous load hook for the corpus capture preload | `module.register()` is runtime-deprecated (DEP0205) in Node 26; `registerHooks` is the documented replacement [CITED: nodejs.org/api/module.html]. Local Node is 26.10.0; CI pins Node 24 (`.github/workflows/ci.yml:75`). Prototype ran clean on 26.10.0 with no ExperimentalWarning [VERIFIED: prototype this session]. |
| `node:test` + `node:assert/strict` + `strong-mock` | existing | All new owner tests | House testing skill mandates exactly these. |
| TypeScript strict (`tsc --noEmit`), ESLint 10, fallow, Prettier | existing | Gates | NFR-6. |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `typebox` | existing | **Not used in Phase 1** | D-09: model is plain readonly TS interfaces; typebox is Phase 4's wire schema. |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `module.registerHooks` | `module.register` (off-thread async hooks) | Runtime-deprecated in Node 26; the recorder global would live on a different thread from the rewritten module. Do not use. |
| Source-text regex rewrite | TS AST transform in the hook | The regex is exact because IL-2 leaves only 9 `ctx.ui.notify(` call sites, all in one file; an AST pass adds cost for no gain. |

**Installation:** none.

## Package Legitimacy Audit

This phase installs no external packages. The capture tool uses only Node built-ins (`node:module`, `node:fs`, `node:path`, `node:os`, `node:child_process`).

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### System Architecture Diagram

```
 /claude:plugin <args>                     resources_discover (load pass)
        |                                            |
  edge/register.ts command closure            index.ts handler
   run = openNotificationRun(pi)  <-- ONE softDepStatus(pi) per run -->  run = openNotificationRun(pi)
        |                                            |
  routeClaudePlugin(args, handlers, ctx, run)   applyReconcile({ ctx, run, ... })
        |                                            |
  edge handler --> orchestrator(s) ----------------> nested install/uninstall/update share `run`
        |   producers build NotificationMessage (unchanged vocabulary, live Error in `cause`)
        |   severity stamp: companionSeverity(declares, run.softDeps)   <-- same snapshot
        v
  notify / notifyWithContext / notifyUpdate*(ctx, run, [context], message)
        v
  shared/notification-resolve.ts  resolve(message, markerPolicy, run.softDeps)
        |  rows:   final reasons = content reasons ++ softDepMarkers(policy && declares, snapshot)
        |          hints: ["partial-install" | "partial-update" | "stale-gate-update" | "enable"]
        |          failure: { causeChain: string[], truncated, leaks: string[] }, rollbackPartial[]
        |          fallback: status with no arm -> severity floored to error (see Pitfall A)
        |  envelope: severity (MAX), summary line (English, composed here), tally counts,
        |            needsReload, noOp
        v
  ResolvedNotification (readonly interfaces, no Error, no probe)
        v
  shared/notification-grammar.ts (text strategy): arms(resolvedRow, mpScope), glyphs, brackets,
        versions, truncation, indents, block joins, sentinel, tally sentence, trailers
        v
  shared/notification-dispatch.ts: ctx.ui.notify(text) at info | ctx.ui.notify(text, sev)
```

### Recommended Project Structure

```
extensions/pi-claude-marketplace/shared/
├── notification-resolve.ts   # NEW: model interfaces + resolve (rows, markers, hints, failure, envelope)
├── notification-run.ts       # NEW (Plan 05): per-invocation object type + constructor
├── notification-summary.ts   # MODIFIED: severity/count/summary-line/tally-count/reload FACTS only
├── notification-grammar.ts   # MODIFIED: text strategy; no SoftDepStatus, no errors.ts walk
├── notification-dispatch.ts  # MODIFIED: resolve -> format -> one ctx.ui.notify; no softDepStatus
├── notify-context.ts         # MODIFIED: CommandContext.markers; RenderFn over resolved rows
└── errors.ts                 # MODIFIED: structured cause-chain walk; causeChainTrailer delegates
scripts/
├── notify-corpus.mjs           # NEW: capture + diff CLI (exports pure diff for the negative)
├── notify-corpus.hook.mjs      # NEW: --import preload (registerHooks + recorder)
└── notify-corpus.negative.mjs  # NEW: D-04 non-vacuity controls
.planning/phases/01-presentation-model/
└── notify-corpus/              # NEW: committed baseline (ASCII-escaped .jsonl + meta)
```

Keep model interfaces in `notification-resolve.ts` rather than a separate type-only `notification-model.ts`. A type-only module needs a type-only owner test and an entry in the ESLint `sonarjs/no-empty-test-file` exemption list, which is pinned as an exact ten-file list (`eslint.config.js:389-408`). [VERIFIED: eslint.config.js:389-408 read this session] Planner may still split if the file grows; the cost is known.

### Pattern 1: Resolve-then-format under unchanged public signatures

**What:** Each public notify entry resolves first, then hands the resolved value to a text formatter. Callers keep their signatures until Plan 05.
**When to use:** Plans 02-04. This is Pitfall 11's "migrate through the dispatch seam" rule; no intermediate commit leaves an export without a production reader.

### Pattern 2: Resolved row as a distributive mapping over the producer row

**What:** `type Resolved<M> = M extends unknown ? Omit<M, "reasons" | "dependencies" | "cause" | "rollbackPartial" | "partialHint" | "enableHint"> & ResolvedRowFacts : never;` keeps `status` narrowing without a `{ status: K }` literal, and `RenderFn<M>` keeps its message-type parameter: `(row: Resolved<M>, mpScope: Scope) => string`.
**Why:** (1) The eight `*_RENDER` annotations of the form `RenderFn<Extract<XMsg, { status: K }>>` keep their text, so their `lint:type-members` contract pins do not need re-authoring (only line shifts). (2) Every new `Extract<…, { status: K }>` spelling creates a new `type-selection` candidate that needs a `contracts.json` entry (see Pitfall D).

### Pattern 3: Marker policy as data on the context

**What:** `CommandContext` gains `readonly markers: { readonly [K in Status]: boolean }`; resolve reads `context.markers[row.status]`. The legacy central path reads a default table keyed by `PluginNotificationMessage["status"]`.
**Optional tightening:** type each value as `false` when the status's row type has no `dependencies` field (makes MSG-SD-3 structural). It needs an `Extract<Msg, { status: K }>` spelling, so it costs a `type-selection` pin; the planner decides.

### Pattern 4: One construction site per run (Option A)

**What:** `edge/register.ts`'s `handler: (args, ctx) => …` builds the run object and passes it through `routeClaudePlugin(args, handlers, ctx, run)`; every `SubcommandHandlers` member gains a third `run` parameter. `index.ts` builds one run per `resources_discover` pass.
**Why this over per-handler construction (Option B):** it is literally one site, it is where Phase 6 mints `invocationId` and wraps unexpected throws (JOUT-04), and `browse` can hand its own run to the handlers it calls (D-07 "nested runs share"). Cost: every command, including a usage error, probes once (three cheap `getAllTools()` reads); handler- and orchestrator-level tests stop needing a `pi` probe mock and pass a snapshot literal instead. [ASSUMED: interpretation of D-07's "the `/claude:plugin` command handler"; Option B -- construct inside each edge handler after argument parsing -- also satisfies D-05 but needs ~20 construction sites and breaks nested sharing in `browse`.]

### Anti-Patterns to Avoid

- **Keeping `softDepStatus` in dispatch past Plan 05:** SC-2 fails, and two snapshots can disagree (the SC-3 hazard).
- **Model members nobody reads yet** (for example summary `count`/`subject`, a `leaked` field JSON would use): `lint:type-members` fails with `unread`. Carry only what the text strategy reads; Phase 4 adds wire-only facts with their reader. [VERIFIED: docs/unused-type-member-gate.md "Production and test reads are separate observations" read this session]
- **Sorting or de-duplicating the merged reasons:** marker position is part of the bytes (catalog state `success-with-orphan-rewake-and-soft-dep` renders `{orphan rewake, requires pi-subagents}`). [VERIFIED: docs/output-catalog.md:617-625]
- **Changing catalog fixtures in the same commit as the renderer:** fixtures keep carrying `pi: MockPi`; move the snapshot construction into the contract driver (`catalog-contract.test.ts`), so all 205 fixtures stay untouched.

## Research-Flag Deliverable 1: Per-verb soft-dep suppression table

Source of truth: each `*_RENDER` / `render:` map, re-derived from the live tree this session. [VERIFIED: every file below read this session; line numbers from `rg -n` this session]

**Mechanism.** Markers come only from `softDepMarkers(declaresAgents, declaresMcp, declaresWorkflows, probe)` called inside `composeReasons` (`shared/notification-grammar.ts:500-515`), appended after the caller's reasons:

```ts
// shared/notification-grammar.ts:507-514 (verbatim)
  const composed: Reason[] = reasons === undefined ? [] : [...reasons];
  composed.push(...softDepMarkers(declaresAgents, declaresMcp, declaresWorkflows, probe));

  if (composed.length === 0) {
    return "";
  }

  return `{${composed.join(", ")}}`;
```

Order is fixed agents, mcp, workflows (`shared/concerns/soft-dep.ts:62-73`). Only three helpers pass real declares-flags: `installedLikeRow` (`grammar:633-660`, flags from `p.dependencies.includes(...)`), `partiallyInstalledRow` (`grammar:573-598`, `p.dependencies?.includes(...) ?? false`), and `marketplace/update.messaging.ts:72-90` (inline `updated` arm). Every other helper (`pluginRow`, `renderUninstalledRow`, `renderAvailableRow`, `renderRemoteRow`, `renderUnavailableRow`, `renderPartiallyAvailableRow`, `renderDisabledRow`, the import `renderUnavailable`, reconcile `renderUninstalled`) hard-codes `false, false, false`. **Structural fact:** only four row types declare `dependencies` -- `PluginInstalledMessage`, `PluginUpdatedMessage`, `PluginReinstalledMessage` (required) and `PluginPartiallyInstalledMessage` (optional) (`shared/notification-types.ts:207-236, 323-331`). [VERIFIED]

Legend: **M** = markers ON (declares-flags from `dependencies`); **off** = hard-coded false; **—** = no `composeReasons` call at all. "Content" = which reasons reach the brace (Phase 2 data; recorded here because the arms keep choosing it over resolved reasons in Phase 1).

| Context (file:line of map) | Status arm | Markers | Content reasons | Helper |
|---|---|---|---|---|
| `INSTALL_CONTEXT` (`plugin/install.messaging.ts:108`) | installed | **M** | `p.reasons` | `installedLikeRow` (:110) |
| | partially-installed | **M** | `p.reasons` | `partiallyInstalledRow` (:123) |
| | unavailable | off | `p.reasons` | `renderUnavailableRow` |
| | partially-available | off | `p.reasons` | `renderPartiallyAvailableRow` |
| | failed | off | `p.reasons` | `pluginRow` |
| | disabled | off | `p.reasons` | `pluginRow(ICON_DISABLED)` |
| `LIST_CONTEXT` (`plugin/list.messaging.ts:101`) | installed | **M** | `p.reasons` | `installedLikeRow` (:103) |
| | available | off | **`p.reasons`** | `renderAvailableRow(..., p.reasons)` (:115) |
| | unavailable | off | `p.reasons` | `renderUnavailableRow` |
| | partially-available | off | `p.reasons` | `renderPartiallyAvailableRow` |
| | upgradable | off | `p.reasons` | `pluginRow` |
| | **partially-installed** | **off (divergence)** | `p.reasons` | `pluginRow(ICON_PARTIALLY_INSTALLED)` (:127) |
| | partially-upgradable | off | `p.reasons` | `pluginRow` |
| | disabled | off | `p.reasons` | `renderDisabledRow` |
| | failed | off | `p.reasons` | `pluginRow` |
| | remote | off | **`p.reasons`** | `renderRemoteRow(..., p.reasons)` (:151) |
| `FETCH_CONTEXT` (`plugin/fetch.messaging.ts:62`) | available | off | **none** (`undefined`, :65) | `renderAvailableRow` |
| | partially-available | off | `p.reasons` | `renderPartiallyAvailableRow` |
| | unavailable | off | `p.reasons` | `renderUnavailableRow` |
| | remote | off | **none** (`undefined`, :78) | `renderRemoteRow` |
| | skipped | off | `p.reasons` | `pluginRow` |
| | failed | off | `p.reasons` | `pluginRow` |
| `UPDATE_CONTEXT` plugin (`plugin/update.messaging.ts:57`) | updated | **M** | `p.reasons` | `installedLikeRow` (:63) |
| | partially-installed | **M** | `p.reasons` | `partiallyInstalledRow` (:76) |
| | skipped | off | `p.reasons` | `pluginRow` |
| | partially-upgradable | off | `p.reasons` | `pluginRow` |
| | failed | off | `p.reasons` | `pluginRow` |
| `ENABLE_CONTEXT` (`plugin/enable-disable.messaging.ts:76`) | installed | **M** | `p.reasons` | `installedLikeRow` (:78) |
| | partially-installed | **M** | `p.reasons` | `partiallyInstalledRow` (:87) |
| | skipped | off | `p.reasons` | `pluginRow` |
| | failed | off | `p.reasons` | `pluginRow` |
| `DISABLE_CONTEXT` (`:105`) | disabled | off (ENBL-15/18) | `p.reasons` | `renderDisabledRow` |
| | skipped / failed | off | `p.reasons` | `pluginRow` |
| `REINSTALL_CONTEXT` (`plugin/reinstall.messaging.ts:73`) | reinstalled | **M** | `p.reasons` | `installedLikeRow` (:79) |
| | skipped / failed / manual recovery | off | `p.reasons` | `pluginRow` |
| `UNINSTALL_CONTEXT` (`plugin/uninstall.messaging.ts:41`) | uninstalled | off (MSG-SD-3) | `p.reasons` | `renderUninstalledRow` |
| | failed | off | `p.reasons` | `pluginRow` |
| `PLUGIN_INFO_CONTEXT` (`plugin/info.messaging.ts:67`) | skipped | off | `p.reasons` | `pluginRow` |
| `IMPORT_CONTEXT` (`import/execute.messaging.ts:113-121`) | installed | **M** | `p.reasons` | `installedLikeRow` (:65) |
| | skipped / failed | off | `p.reasons` | `pluginRow` |
| | unavailable | off | `p.reasons` | inline `joinTokens` (byte-identical to `renderUnavailableRow`) |
| `UPDATE_CONTEXT` marketplace (`marketplace/update.messaging.ts:66-96`) | updated | **M** | `p.reasons` | inline, flags at :81-83 |
| | partially-installed | **M** | `p.reasons` | `partiallyInstalledRow` (:92) |
| | skipped / failed | off | `p.reasons` | `pluginRow` |
| `REMOVE_CONTEXT` (`marketplace/remove.messaging.ts:41`) | uninstalled | off | `p.reasons` | `renderUninstalledRow` |
| | failed | off | `p.reasons` | `pluginRow` |
| `AUTOUPDATE_CONTEXT` / `NOAUTOUPDATE_CONTEXT` (`marketplace/autoupdate.messaging.ts:44, 57`) | failed | off | `p.reasons` | `pluginRow` |
| `ADD_CONTEXT` (`marketplace/add.messaging.ts:30`) | (no statuses) | — | — | `render: {}` |
| `LIST_CONTEXT` marketplace (`marketplace/list.messaging.ts:22`) | (no statuses) | — | — | `render: {}` |
| `PENDING_CONTEXT` (`reconcile/reconcile.messaging.ts:120-128`) | will install / will uninstall / will enable / will disable | — (probe ignored, `_probe`) | — | `joinTokens` |
| | failed | off | `p.reasons` | `pluginRow` |
| `RECONCILE_APPLIED_CONTEXT` (`reconcile.messaging.ts:221-229`) | installed | **M** | `p.reasons` | `installedLikeRow` (:162) |
| | **uninstalled** | off | **none** (`composeReasons(undefined, …)`, :184) | inline |
| | disabled | off | `p.reasons` | `pluginRow(ICON_DISABLED)` |
| | failed | off | `p.reasons` | `pluginRow` |
| | partially-installed | **M** | `p.reasons` | `partiallyInstalledRow` (:197) |

**Default table for legacy central `notify()` (`renderPluginRow`, `grammar:902-1014`):** M for `installed`, `updated`, `reinstalled`, `partially-installed`; off for the other 15 statuses. `available` and `remote` pass `undefined` content reasons (:975, :985); `uninstalled` passes `p.reasons`; the four `will *` arms have no brace. [VERIFIED]

**Non-row surfaces (all marker-free by construction, no policy needed):** `renderMpHeader` `failed`/`skipped` arms pass `false,false,false` (`grammar:246, 273`); `renderPluginInfo` (`:1453`); `renderMarketplaceNotAdded` (`:1379`); `renderMarketplaceInfo`/`…Cascade` and `renderPluginInfoCascade` ignore the probe. [VERIFIED]

**Byte consequence of the one divergence:** `plugin list`'s producer never sets `dependencies` on a `partially-installed` row (`orchestrators/plugin/list-installed-row.ts:124-132` returns `{ status, name, reasons, version, ...scopeField, ...descriptionField }`), so `markers: false` there is a data fact with no byte effect today. Keep it `false` anyway: D-12 records the table as data, and Phase 2 extends it. [VERIFIED]

**SC-5 owner test shape.** State the table above as an independent literal (19 contexts plus the default table) and compare it with `deepStrictEqual` against each context's `markers` map. Put it in `tests/architecture/` (non-corresponding root, cross-cutting claim, one owner -- the same shape as `workflows-marker-coverage`), and keep the derivation cases (policy × dependencies × snapshot -> markers after content reasons, fixed order) in `tests/shared/notification-resolve.test.ts`. [ASSUMED: location choice; CONTEXT leaves it open]

## Research-Flag Deliverable 2: Named-file gates the extraction must re-point (Pitfall 9)

[VERIFIED: grep over `tests/architecture/`, `scripts/`, `eslint.config.js`, `.fallowrc.json`, `rule-packs/`, `sonar-project.properties` this session; each file named below opened this session]

| Gate / artifact | What it names / asserts | Hit by | Action |
|---|---|---|---|
| `tests/architecture/gate-targets.ts:223-227` `NO_CONSOLE_EXEMPT_TARGETS` | `persistence/migrate.ts`, `shared/debug-log.ts`, `shared/notification-dispatch.ts` are the only `no-console: off` modules | Nothing, if dispatch stays the sink and new modules add no console | None. New `shared/*` modules must not resolve `no-console` off (`eslint-effective-config.test.ts` measures the set). |
| `eslint.config.js:141-143` `no-restricted-syntax` selector + messages at `:132`, `:143` | Bans `X.ui.notify(` outside dispatch; messages say "use notify(ctx, pi, NotificationMessage)" | Plan 05 (signature change) | Update both message strings to the new signature. No test pins the strings (grep this session found none). |
| `eslint.config.js:152-165` per-file override for `shared/notification-dispatch.ts` | Lets the sink call `ctx.ui.notify` | Nothing | Keep. |
| `gate-targets.ts:341-344` `COMPAT_NO_EXPANSION_TARGETS` (`compat-01-no-expansion.test.ts`) | Reads `shared/notification-grammar.ts` as data: exactly 7 glyph declarations; calls `renderPartiallyAvailableRow`, `renderPluginInfo`, `renderRemoteRow` with `ALL_COMPANIONS_LOADED` probe (`:151-155`) | Plans 02-04 if glyphs move; Plan 04 (helper signatures) | Keep all glyph declarations in `notification-grammar.ts`. Update the three direct calls to resolved-row/probe-free signatures. |
| `gate-targets.ts:478-483` `SCOPE_FENCE_TARGETS` | `notification-types.ts`, `install.messaging.ts`, `list-flow.ts`, `edge/handlers/plugin/list.ts` | Only if `notification-types.ts` moves | D-11 keeps producer vocabulary in `notification-types.ts`; no action expected. |
| `gate-targets.ts:616-621` `WORKFLOWS_MARKER_COVERAGE_TARGETS` + `workflows-marker-coverage.test.ts` | Case 1 drives 7 `Dependency[]` derivation sites through `notify(ctx, pi, …)` / `installPlugin({ ctx, pi, … })` / `listPlugins` / `importClaudeSettings`; case 2 scans `orchestrators/` for `DERIVATION_SHAPE` | Plan 05 (signatures); D-12 re-point | Change `makeCtx` to yield a run snapshot; pass `run` to the three orchestrator drives. **Add** a third case that scans `extensions/pi-claude-marketplace/` for `softDepMarkers(` call sites and asserts set-equality with `[shared/notification-resolve.ts]` (both directions), plus a planted control. This is the "scans the new derivation site" clause. The `Dependency[]` sites do not move in Phase 1. |
| `no-probe-in-workflows-bridge.test.ts` | Bans probe composer, snapshot type, engine probe, flag field and `getAllTools` in `bridges/workflows/**`; prose exempts `orchestrators/plugin/install.ts` | Plan 05 | Keep resolve in `shared/`, never called from `bridges/`. The run object's snapshot member name must not be introduced under `bridges/workflows/`. Refresh the stale exemption prose (it names a file that no longer exists and a probe that moves to the root). |
| `no-test-only-production-surface.test.ts` | Bans `__`-prefixed members, `_set…ForTest`, `__test_` in `extensions/**` | Plan 01 | Satisfied: the hook rewrites in memory; `globalThis.__corpusNotify` never appears in committed extension source. |
| `catalog-uat/catalog-contract.test.ts:38-39`, `mock-pi.ts`, `fixture-types.ts`, fixtures | `EXPECTED_STATE_COUNT = 205`, `EXPECTED_UTF8_BYTES = 26_619`; drives `notify(ctx, pi, message)`; `makePi` pins `getAllTools().times(3)` | Plan 05 | Keep fixtures unchanged. The contract driver builds the snapshot from `fixture.pi` once per fixture (still 3 reads), then calls `notify(ctx, run, message)`; `emit?(ctx, pi)` fixtures get the run. Counts must not move. |
| `notify-grammar-invariant.test.ts`, `notify-will-reload-agreement.test.ts`, `cross-surface-reason-parity.test.ts`, `notify-producer-wire-coverage.test.ts`, `cross-op-convergence.test.ts`, `config-state-consistency.test.ts` | Drive `notify` / `notifyWithContext` / orchestrators with `pi` (some strict `getAllTools().times(3)`) | Plan 05 | Mechanical signature update. `notify-will-reload-agreement` prose (`:19-21`) says `shouldEmitReloadHint`/`RELOAD_HINT_TRAILER` live in `notification-summary.ts`; restate the claim wherever they land (Pitfall 9: change the claim, not just the path). |
| `closed-set-enrollment.test.ts` | Imports `softDepMarkers` from `shared/concerns/soft-dep.ts` | Only if `softDepMarkers` moves | Keep `softDepMarkers` in `concerns/soft-dep.ts`; resolve calls it. |
| `hooks-cap-notify`, `hooks-async-rewake`, `hooks-lifecycle` | Raw hook surfaces (`notifyStopHookOverrideCap`, rewake) | Nothing in Phase 1 | None (raw surfaces are Phase 3). |
| `partial-vocabulary-guard.test.ts` | Scans for retired vocabulary with an exact allow-list by file | Any new file/prose | Run it; do not reintroduce retired tokens in new comments. |
| `unowned-exports-census` (`UNOWNED_EXPORT_CENSUS = {}`, `gate-targets.ts:658`) | Exact-equality census of exports production never reads | Every plan | No export read only by tests. |
| `fallow-production-mode.test.ts` / `PRODUCTION_FINDING_CENSUS` (all empty, `gate-targets.ts:679-685`) | Exact production dead-code finding set | Every plan | No dead export between commits; no new `fallow-ignore`. |
| `sonar-project.properties:93` `sonar.cpd.exclusions` | Names `import/execute.messaging.ts`, `plugin/fetch.messaging.ts`, `plugin/install.messaging.ts`, `plugin/list.messaging.ts` (plus stage files, `plugin/shared.ts`) | Only if those files are renamed | No rename planned; no action. |
| `scripts/check-unused-type-members.contracts.json` | 108 contracts; line:col pins in this phase's files: `notification-dispatch.ts:216:43`, `notification-grammar.ts:838:7` and `:1562:46`, `notification-summary.ts:41:40`, `notification-types.ts:459:48`, `notify-context.ts:66:61`, `:283:52`, `:346:29`, the eight `*_RENDER` annotations (`enable-disable.messaging.ts:76:75`, `:105:78`; `fetch.messaging.ts:62:72`; `install.messaging.ts:108:78`; `list.messaging.ts:101:69`; `reinstall.messaging.ts:73:60`, `:213:42`; `uninstall.messaging.ts:41:60`; `update.messaging.ts:57:75`), `platform/pi-api.ts` (6 pins, lines 100-124) and `reconcile/notify.ts` (2), plus pins in the orchestrators Plan 05 edits (`enable-disable.ts` 11, `uninstall.ts` 4, `update-swap.ts` 2, `update-flow.ts` 2, `list-flow.ts` 2, `add.ts` 2, `remove.ts` 2, `info.ts` 1, `install-outcome.ts` 1, `reconcile/apply.ts` 1) | Every plan | Run Prettier, then `npm run lint:type-members`, then re-pin by shifting the LINE only. A deleted pin target (`dispatchRow`'s `arm` at `:346`, `renderPendingRow.p` at `:838`) must be removed from the JSON in the same commit. New `{ status: K }` spellings need new `type-selection` entries. |
| `docs/output-catalog.md` | Text byte lock | Every plan | `git diff --exit-code` empty. |

`.fallowrc.json` needs no change: all new modules sit in the existing `shared` zone (`shared -> [platform]`), and `scripts/**` is in `boundaries.coverage.allowUnmatched`. [VERIFIED: .fallowrc.json read this session] `rule-packs/architecture.json` bans only `process.stdout.*`/`process.stderr.*` in `extensions/**`; the capture scripts may write to stdout. [VERIFIED]

## Capture Tool Feasibility (D-01..D-04)

**IL-2 exactness.** `rg -n "\.ui\.notify\(" extensions --include='*.ts'` finds exactly 9 non-comment call sites, all in `shared/notification-dispatch.ts` (lines 97, 99, 113, 120, 151, 172, 201, 352, 354). [VERIFIED: grep this session]

**Measured prototype** (scratchpad, not committed). A preload using `module.registerHooks({ load })` that rewrites `/\b([A-Za-z_$][\w$]*)\.ui\.notify\(/g` to `globalThis.__corpusNotify($1.ui, ` for URLs under `/extensions/pi-claude-marketplace/` and ending `.ts`, with a recorder `(ui, ...args) => { record(args[0], args[1] ?? null, args.length); return ui.notify(...args); }`. [VERIFIED: prototype run this session]

| Question | Finding |
|---|---|
| Does the load hook see TypeScript before stripping? | Yes: `format: "module-typescript"` and the source still contains `interface` declarations. Stripping runs after the hook. [VERIFIED: probe this session] |
| Does `--import` reach `node --test` child processes? | Yes. Each test file runs in its own child (default process isolation) with the preload. [VERIFIED] |
| How does the recorder know its test file? | `process.argv[1]` in the child is the test file path. [VERIFIED] |
| Are receiver/getter semantics preserved? | Yes: `X.ui` is evaluated once (strict `ctx.ui … .times(n)` mocks still pass) and `ui.notify(...args)` keeps `this === ui`. The full suite passed under the hook: 7291 tests, 0 failures. [VERIFIED] |
| Volume | 2622 emissions (argc 1: 1378, all info; argc 2: 1244 = 860 error, 356 warning, 28 explicit info) from 68 test files + 1 forked child; about 450 KB of message text; wall time about 2 min for unit + integration. [VERIFIED] |
| Determinism | **Not deterministic raw.** Two consecutive runs differed by 81 entries in 15 files. Causes: mkdtemp paths (`/tmp/<prefix>-XXXXXX/...`), UUID staging directory names (`commands-staging/<uuid>`), write-file-atomic numeric temp suffixes (`claude-plugins.json.4273587976`), and the forked `tests/integration/concurrent-install-child.ts` (racy by design). With three normalizers -- whole tmp-rooted path token -> `<TMPPATH>`, UUID -> `<UUID>`, `(\.json)\.\d{4,}` -> `$1.<N>` -- and recording only when `argv[1]` ends in `.test.ts`, the two runs matched exactly (0 missing, 0 extra). [VERIFIED: diff this session] |
| Machine independence | No `/home/<user>` paths and no credentials appeared in the capture. Normalize `os.homedir()` and `process.cwd()` anyway, so a CI capture matches. [VERIFIED] |
| Node version sensitivity | Messages embed Node/V8 error text (`EISDIR: illegal operation on a directory`, `Unexpected token 'i', "invalid json" is not valid JSON`). Capture and re-diff on the same Node major; record `process.version` in the baseline meta and warn on mismatch. [ASSUMED: CI Node 24 text equals local Node 26 text; not probed] |

**Suite globs.** Read the quoted globs from `package.json` `scripts.test` and `scripts["test:integration"]`, the same way `tests/architecture/unit-suite-glob-completeness.test.ts` does, so the capture cannot drift from the suites. [VERIFIED: that test's `pathsMatchedByScript` read this session] Pass `TEST_CONCURRENCY` through if set.

**Baseline format.** Commit `.jsonl` (one entry per line, `{ file, message, severity, argc }`), **ASCII-escaped** (`\uXXXX` for every non-ASCII character), sorted by file then message for stable diffs. Reasons:
- `format:check` runs `prettier --check "**/*.{js,json,ts}"` and `.prettierignore` does not exclude `.planning/`, so a `.json` baseline would be reformatted by the pre-commit Prettier hook and must stay Prettier-clean for `npm run check`. `.jsonl` is not matched. [VERIFIED: package.json, .prettierignore, .pre-commit-config.yaml read this session]
- `check-json` matches `.json` only; `check-added-large-files` excludes `^\.planning/`; the texthooks `fix-spaces` hook is **not** excluded for `.planning/` and would rewrite non-ASCII spaces. ASCII escaping makes the file immune. Glyphs (`●○⊘◌◉◍⊖`) become escapes. [VERIFIED: .pre-commit-config.yaml]

**Diff CLI and negative.** Export a pure `diffCorpus(baseline, capture)` from `scripts/notify-corpus.mjs` returning `{ missing: [{file, entry, count}], extra: [...], totals }`; the CLI exits 1 on any missing entry or `capture.total < baseline.total`, printing the file names. `scripts/notify-corpus.negative.mjs` (house pattern `scripts/check-workflow-install-scripts.negative.mjs`: `mkdtemp` fixture, `assert.deepStrictEqual`, `process.stdout.write` on pass, `rm` in `finally`) plants:
1. a one-byte change in one message of a scratch copy -> exit non-zero, report names that file;
2. entries removed from one file -> count refusal fires;
3. benign controls -> reordered entries and one added entry pass, and the extra entry is listed.

A cheap end-to-end control also belongs in the negative: run the capture over one small test file and assert it recorded at least one entry, so a hook that stops matching fails loudly.

**Gates that cover `scripts/`.** ESLint `scripts/**/*.mjs` block (`eslint.config.js:414-431`: `disableTypeChecked`, Node globals, `import-x/order`, `no-console: warn`), Prettier (`scripts/**/*.mjs`), `fallow dupes` (whole repo) and the non-production cycle run. Not covered: `test:corresponding` (`nonCorrespondingRoots` includes `scripts`), the production dead-code run, and boundaries (`scripts/**` allowUnmatched). [VERIFIED: scripts/check-corresponding-tests.mjs:9, .fallowrc.json] A `package.json` entry such as `"corpus:notify"` is optional and must not join `check` (D-03); no gate pins the script list except `fallow`, `check`, `test`, and the type-member scripts. [VERIFIED: grep of tests/architecture this session]

## Snapshot Plumbing (D-05..D-08)

**Render-time probes (leave dispatch in Plan 05).** [VERIFIED: notification-dispatch.ts read this session]

```ts
// shared/notification-dispatch.ts:280   (notify)
  const probe = softDepStatus(pi);
// shared/notification-dispatch.ts:387   (emitCascadeWith: emitContextCascade + emitReconcileAppliedContextCascade)
  const probe = softDepStatus(pi);
// shared/notification-dispatch.ts:433   (emitUpdateNoOpCascade)
  const probe = softDepStatus(pi);
```

**Severity-time probes (switch to `run.softDeps`).** [VERIFIED]
- `orchestrators/plugin/install-flow.ts:406` -- `: companionSeverity({ declaresAgents, declaresMcp, declaresWorkflows }, softDepStatus(pi));` inside `composeInstalledRow(installCtx, pi)` (`:364`), reached only in standalone mode (`:1122`, under `if (!orchestrated)`).
- `orchestrators/plugin/update-cascade.ts:190` -- `const marketplaces = groupCascadeOutcomes(outcomes, softDepStatus(pi), cardinality);` in `composeUpdateCascade(ctx, pi, …)`, which then calls `notifyUpdateNoOpWithContext` (`:204`) or `notifyUpdateWithContext` (`:212`).
- `orchestrators/plugin/enable-disable.ts:1347` -- `probe: softDepStatus(pi),` passed to `composeOutcomeRow`, then `notifyWithContext(ctx, pi, ENABLE_CONTEXT | DISABLE_CONTEXT, …)` (`:1367`, `:1380`).

`companionSeverity` itself is pure (`shared/notify-reasons.ts:84-97`). [VERIFIED]

**Structured notify-family call sites** (non-comment, excluding definitions). [VERIFIED: `rg` this session] 67 production calls outside the family's own files:

| File | Calls |
|---|---:|
| `orchestrators/plugin/reinstall-flow.ts` | 7 |
| `orchestrators/plugin/info.ts` | 6 |
| `orchestrators/marketplace/update.ts` | 6 |
| `orchestrators/plugin/uninstall.ts` | 5 |
| `orchestrators/plugin/install-flow.ts` | 5 |
| `orchestrators/plugin/enable-disable.ts` | 5 |
| `orchestrators/marketplace/info.ts` | 4 |
| `orchestrators/marketplace/autoupdate.ts` | 4 |
| `orchestrators/plugin/update-flow.ts`, `plugin/shared.ts`, `marketplace/remove.ts` | 3 each |
| `orchestrators/reconcile/pending.ts`, `plugin/update-cascade.ts`, `plugin/list-flow.ts`, `marketplace/shared.ts`, `marketplace/add.ts`, `edge/handlers/plugin/browse.ts` | 2 each |
| `orchestrators/reconcile/apply.ts`, `plugin/update-swap.ts`, `plugin/reinstall.messaging.ts`, `plugin/fetch.ts`, `marketplace/list.ts`, `import/execute.ts`, `edge/handlers/plugin/enable-disable.ts`, `edge/handlers/plugin/bootstrap.ts` | 1 each |

Plus internal calls: 9 in `notification-dispatch.ts`, 4 in `notify-context.ts`.

**How `pi` reaches orchestrators today.** Edge handler factories close over `pi: ExtensionAPI` (`edge/register.ts:92-126`) and pass it in option bags; orchestrators declare `readonly pi: ToolInventory` (for example `install-flow.ts:83`, `marketplace/update.ts:175, 208, 314`, `marketplace/remove.ts:141`, `marketplace/autoupdate.ts:109`, `marketplace/add.ts:156`, `plugin/enable-disable.ts:199, 746, 1113, 1165, 1330`, `plugin/update-swap.ts:173`, `reconcile/pending.ts:70`, `reconcile/types.ts:260`) or `readonly pi: ExtensionAPI` (`marketplace/list.ts:39`, `marketplace/info.ts:32`, `import/execute.ts:175`, `plugin/fetch.ts:108`, `plugin/bootstrap.ts:73`). `update-swap.ts:173-183` uses a `pi?: never` discriminant for cascade mode. [VERIFIED] **No orchestrator reads any `pi` member other than to probe or pass it on** (`rg "\bpi\.[a-zA-Z]+"` over `orchestrators/` finds only `skill-alias-state.ts:83 pi.getCommands()`, which is unrelated). So the run object can replace `pi` in every notify-related option bag. [VERIFIED]

**Construction roots for Phase 1.**
1. `edge/register.ts:129-131` -- `handler: (args, ctx) => routeClaudePlugin(args, handlers, ctx)`: build the run here (Option A) and thread it through the router to all `SubcommandHandlers` (`edge/router.ts:26-58`). `browse` passes its run to the handlers it calls.
2. `index.ts` `resources_discover` (`:92-175`): build inside the reconcile `try` and pass to `applyReconcile({ ctx, run, cwd, hooksRouting, completionCache })` (`:116`). `softDepStatus` cannot throw (each probe catches `getAllTools()` failures), so NFR-2 is not affected.
3. **Hook callbacks: not in Phase 1.** The only hook emitters (`notifyAsyncRewakeSummary`, `notifyStopHookOverrideCap`) are raw surfaces with no snapshot reader. D-06 "each member lands with its first reader" means hook construction arrives with their typed kinds (Phase 3/5). [ASSUMED: interpretation]

**Nested runs.** Import runs installs in orchestrated mode (no install-level notify or probe); reconcile runs install/uninstall orchestrated; bootstrap composes add/autoupdate; `marketplace update` calls plugin update through the `PluginUpdateFn` seam (`orchestrators/types.ts:404-408`), which takes no `pi` and does not notify. Passing the parent run through option bags covers every nested emitter. [VERIFIED for the seam signature; orchestrated-mode suppression per `install-flow.ts:60-78` doc]

**Test pins that move.**
- `tests/edge/notification-boundary.ts` (used by 32 files, 336 `createNotificationBoundary(` calls): `toolProbes` is documented as `emissions * 3`; install cases state `6` today (`tests/edge/handlers/plugin/install.test.ts:525, 573, 600`) because of the double probe. Under Option A, handler/orchestrator tests pass a run literal and state `toolProbes` 0; the per-command claim (exactly 3 reads per run, independent of emission count) moves to `tests/edge/register.test.ts` and the SC-3 test. Update the helper's doc comment (it states the per-emission model as the contract).
- `tests/architecture/catalog-uat/mock-pi.ts` `makePi(...).times(3)`: unchanged if the contract driver snapshots once per fixture.
- `tests/shared/notification-dispatch.test.ts` (183 family calls) builds plain `pi` stubs (`piWithAllLoaded()` etc., `:48-70`): retarget those helpers to return run literals.
- `tests/e2e/_helpers.ts` and `tests/live-uat/*.mjs` drive the real extension factory through `command.handler`, so they keep working unchanged. `live-uat` is excluded from typecheck and CI; grep it after any option-bag rename anyway. [VERIFIED]

**SC-3 / D-08 proof.** Drive a real `/claude:plugin install` through `registerClaudePluginCommand` (or a workflows-marker-coverage-style seeded project) with a stateful `getAllTools` that reports no companion on its first 3 reads and `workflow_control`/`subagent` loaded on any later read. Assert the emitted text carries `A plugin operation needs attention.` (severity from the snapshot) **and** the `{requires …}` marker (markers from the same snapshot), and assert exactly 3 reads. Under two probes, the second snapshot would render the row without the marker while the summary still says "needs attention"; that makes the case discriminating. [ASSUMED: location; the CONTEXT leaves it open]

## Decision vs Text Split (D-10 / D-11)

[VERIFIED: notification-summary.ts, notification-grammar.ts, notification-dispatch.ts, errors.ts read in full or in the cited ranges this session]

| Today (file:line) | Decision -> resolve | Text join -> grammar | Byte trap |
|---|---|---|---|
| `computeSeverity` / `cascadeSeverity` (`summary.ts:147-212`) | MAX over stamped row severities; kind map for standalone kinds | none | Rank 0 means **one** `ctx.ui.notify` argument (`dispatch.ts:96-100`); raw info surfaces pass `"info"` explicitly. |
| `summaryPhrase` / `buildSummaryLine` / `buildSummaryLineForCascade` (`summary.ts:303-416`) | The composed English line (D-10) | Prepend `${summary}\n\n${body}` only at warning/error (`summary.ts:642-652`) | Mixed-subject drops the noun and switches `A`->`An`; plugin-info summary only when `plugin.status === "failed"`. |
| `composeTally` (`summary.ts:472-538`) | Numbers **and presence**: tally absent unless `cardinality === "plural"` and `label` defined; failures/warnings counts; success category present iff `successes > 0` or (`marketplaces.length > 0` and no other category); bare headers (no `status`, no `severity`) subtracted; override `{verb, count}` owns the success category and is present only when `count > 0` | `${label}: ${parts.join(", ")}`, `tallyCategory` pluralization (`success`/`successes`, verb unpluralized for the override) | The **"0 successes"** case is a presence decision, not a text rule. |
| `shouldEmitReloadHint` (`summary.ts:575-626`) + entry-point overrides | `needsReload`: OR of stamped rows for cascades; **false** for all standalone kinds, for `emitReconcileAppliedContextCascade` (`dispatch.ts:459`, hint `""`) and for `emitUpdateNoOpCascade` | `RELOAD_HINT_TRAILER = "/reload to pick up changes"` (`summary.ts:104`) | |
| `emitUpdateNoOpCascade` (`dispatch.ts:423-446`) | `noOp: true`, no tally, no reload | `UPDATE_NO_OP_HEADLINE = "Plugin update: nothing to update"` (`summary.ts:116`) folded in the **tally slot** | **No `(no marketplaces)` sentinel** on this path (`blocks.join("\n\n")`, and `foldTallyAndHint` drops the empty body), and no advisories. The plain cascade **does** use the sentinel (`dispatch.ts:316, 396`; `grammar.ts:1517`). |
| `foldAdvisories` (`dispatch.ts:367-370`), `foldTallyAndHint` (`summary.ts:546-548`) | none | `advisories` joined by `\n` as their own block after the body; then `[body, tally, hint].filter(s => s !== "").join("\n\n")` | Order: body, advisories, tally, reload trailer, then summary prepended. |
| `reconcile-pending-empty` body (`dispatch.ts:243`) | none | `"Pending: next reload will apply 0 actions."` + advisories | |
| `renderIndentedCauseChain` -> `causeChainTrailer(cause)` (`grammar.ts:1069-1076`, `errors.ts:149-167`) | Serialize: `chain: string[]` (each `linkMessage`, `CleanupContextError` -> `"<msg> (cleanup: <phase> <artifact> <basename>: <diag>; …)"`), `truncated: boolean` (last link still has an onward cause) | `    cause: ${chain.join(" -> ")}${truncated ? " (truncated)" : ""}` (4 spaces; 6 for rollback phases) | `" (truncated)"` attaches to the **last** link, so appending after the join is byte-equal. `cause === undefined` means no line; `causeChainTrailer` also returns `""` for `null`. |
| `manualRecoveryLeaks(p.cause)` (`grammar.ts:1648`, `errors.ts:598-606`) | `leaks: string[]` (first `ManualRecoveryError` link with non-empty leaks, depth 5) | `    leaked: ${leak}` per entry | Only for `failed` and `manual recovery` rows, after the cause line. |
| `composeRollbackPartialLines` (`grammar.ts:1085-1100`) | `rollbackPartial: { phase, causeChain? }[]` | `    [${phase}] (rollback failed)` + optional 6-space cause line | `failed` rows only. |
| `partialHintTrailerFor` + `enableHint` (`grammar.ts:1591-1605, 1638-1640`) | hint ids: `unavailable`/`partially-available` + `partialHint` -> partial-install; `partially-upgradable` + `partialHint` -> partial-update; `failed` + `partialHint` -> stale-gate-update; `disabled` + `enableHint` -> enable | literals at `grammar.ts:1024, 1035-1036, 1049, 1059`, 4-space indent | At most one partial hint per row; the enable hint sits after it. Order: row, description, partial hint, enable hint, cause, leaks, rollback. |
| `notAddedReasonFor` (`grammar.ts:1398-1406`) | `Reason` token | brace | |
| `DESCRIPTION_BEARING_STATUS` + `truncateDescription` (`grammar.ts:1526-1564, 113-119`) | full description stays on the row | 66-column truncation to 63 + `"..."` | Only non-empty descriptions render. |
| `renderMpHeader` autoupdate special cases (`grammar.ts:279-285`) | none | `<autoupdate>` / `<no autoupdate>` in place of `(skipped)` | Data already present. |

**Cause-chain constants.** `const CAUSE_CHAIN_MAX_DEPTH = 5;` (`errors.ts:30`); `const PREFIX = "cause: ";` and `const JOINER = " -> ";` (`errors.ts:154-155`). [VERIFIED] `causeChainTrailer` has other producer-side callers (`bridges/commands/discover.ts:102`, `orchestrators/plugin/install.messaging.ts:336`, `errors.ts:205` `composeErrorWithCauseChain`), so it must stay; re-express it over the new structured walk rather than duplicating the walk. [VERIFIED]

## Plan-Ordering Constraints and Proposed Breakdown

**Constraints that shape the order.** [VERIFIED unless noted]
- **Type-member gate:** a member lands with its first production reader; `test-only-observed` passes but is recorded; JSON serialization credits every member (irrelevant in Phase 1: no JSON). Run Prettier before `lint:type-members` (about 85 s); `:negative` (about 7 min) runs in `check`.
- **Fallow production dead-code** with empty `PRODUCTION_FINDING_CENSUS` and `UNOWNED_EXPORT_CENSUS`: no export without a production reader at any commit; no new `fallow-ignore` (count stays at 11 per CONVENTIONS).
- **Coverage:** `test:coverage:unit` 100% aggregate; the pre-commit `npm-coverage-direct` hook runs `test:coverage:direct` on each changed source/test pair, which must reach 100% when run alone. Each new `shared/*.ts` needs a mirrored `tests/shared/*.test.ts`. [VERIFIED: .pre-commit-config.yaml, package.json]
- **Complexity:** ESLint `sonarjs/cognitive-complexity: 15` and fallow `maxCognitive: 15`, `maxCyclomatic: 20`, `maxUnitSize: 60` (lines per function), scored independently. Resolve per kind and per status through maps, not one big switch.
- **Dupes:** threshold 3% (1.41% measured in research). Moving code is neutral; do not leave both old and new copies.
- **Exhaustive switches:** `@typescript-eslint/switch-exhaustiveness-check` with no `default` on exhaustive unions (`eslint.config.js:55-61` per PITFALLS).

**Proposed plans** (each its own wave; all touch dispatch/grammar/notify-context, so none run in parallel):

| Plan | Scope | Key gates to re-point | Probe location after the plan |
|---|---|---|---|
| **01 Corpus baseline** | `scripts/notify-corpus{,.hook,.negative}.mjs`; baseline under `.planning/phases/01-presentation-model/notify-corpus/`; capture twice and self-diff must be empty; negative passes | none | dispatch (unchanged) |
| **02 Envelope facts** | `notification-resolve.ts` (new) with `ResolvedEnvelope` (severity, summary line, needsReload, tally counts, noOp); `notification-summary.ts` keeps the facts; the text joins (`RELOAD_HINT_TRAILER`, `UPDATE_NO_OP_HEADLINE`, `foldTallyAndHint`, tally sentence, summary prepend) move to grammar; dispatch resolves, then formats | `notify-will-reload-agreement` prose; summary-owner test relocation | dispatch. **Keep body rendering before envelope resolution** until Plan 04 (see Pitfall A). |
| **03 Failure detail + hints** (PMOD-03) | `errors.ts` structured walk (exported, read by resolve) with `causeChainTrailer` rebuilt on it; resolve serializes `cause`, leaks, rollback partials; hint ids; not-added reason; grammar trailers read serialized data; grammar stops importing `errors.ts` | `tests/shared/errors.test.ts` additions | dispatch |
| **04 Marker policy + resolved arms** (D-12, D-13, SC-5) | `CommandContext.markers` on all 19 contexts; default table; resolve composes final reasons (content, then markers); `RenderFn` over `Resolved<M>` without a probe; grammar helpers drop `SoftDepStatus`; `dispatchRow` missing-arm fallback moves into resolve; 70 arm calls in 12 test files use literal resolved rows; SC-5 table test; `workflows-marker-coverage` third case | COMPAT-01 direct calls; `*_RENDER` pins (line shifts); `notify-context.ts:346` pin removed | dispatch passes its probe to resolve (still one per entry function) |
| **05 Per-invocation run** (D-05..D-08, SC-3) | `shared/notification-run.ts` (type + `openNotificationRun(pi)`); family signatures `pi -> run`; `register.ts` + router + handlers; `index.ts`; 67 production call sites; option bags; three severity sites read `run.softDeps`; `softDepStatus` import leaves dispatch; test pins; SC-3 test; eslint messages; stale prose in `pi-api.ts:7-14`, `concerns/soft-dep.ts:13`, `notify-reasons.ts:80`, `orchestrators/types.ts:422`, `no-probe-in-workflows-bridge` | catalog driver, notification-boundary doc, strict mocks in the architecture gates | roots only |
| **06 Phase gate** (or the final task of 05) | Corpus re-diff; `git diff --exit-code <phase-base> -- docs/output-catalog.md`; catalog counts; `rg softDepStatus shared/notification-dispatch.ts` empty; full `npm run check`; e2e in CI | — | — |

Run the corpus re-diff at the end of **every** plan (about 2 min, not in `check`), not just at phase end. It localizes drift to one plan. [ASSUMED: D-03 requires phase end only; per-plan is a recommendation]

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Loader rewrite | A custom `--loader`, `module.register` worker, or a production seam | `module.registerHooks({ load })` in an `--import` preload | In-thread, sync, undeprecated; the recorder shares `globalThis` with the rewritten module. |
| Soft-dep marker derivation | A second marker function in resolve | `softDepMarkers` (`concerns/soft-dep.ts:54-77`) | Owns the byte-critical order; `closed-set-enrollment` imports it. |
| Cause-chain walk | A new walker in resolve | Extend `errors.ts` (`causeChain` generator, `hasOnwardCause`, `linkMessage`) with a structured export | Depth bound, cycle guard and `CleanupContextError` basename redaction must stay single-sourced. |
| Suite discovery for the capture | A hard-coded glob list | Parse `package.json` `scripts.test` / `scripts["test:integration"]` quoted globs | Same method as `unit-suite-glob-completeness.test.ts`. |
| Multiset diff | Line-order `diff` | A `Map<key, count>` per file | D-02 semantics; order-insensitive. |

**Key insight:** every decision already has exactly one implementation. Phase 1 moves call sites, not logic. Anything that re-implements a rule (marker order, cause formatting, tally presence) creates a second copy that the byte lock only catches for the 205 catalog states.

## Runtime State Inventory

This is a refactor phase; each category was checked.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None: `state.json`, `claude-plugins.json`, `agents-index.json` hold no presentation data. [VERIFIED: persistence modules untouched by this phase's file set] | none |
| Live service config | None: no external service. | none |
| OS-registered state | None. | none |
| Secrets/env vars | None renamed. The capture tool reads `TEST_CONCURRENCY` (optional) and its own output-dir variable. | none |
| Build artifacts | None: no build step (native TS stripping). The committed corpus baseline is a new planning artifact that D-01 says is removed at milestone close, together with the three scripts and any `package.json` script entry. | Record the removal in the milestone-close checklist. |

## Common Pitfalls

### Pitfall A: Render-time severity mutation in `dispatchRow`
**What goes wrong:** Resolving the envelope before rendering changes bytes. `dispatchRow` (`notify-context.ts:339-367`) writes `severity = "error"` onto the **caller's** row when a status has no render arm; `emitWithSummary` computes severity afterwards from the same objects. A **frozen** row rejects the write (caught, `hookDebugLog`), so it stays info with no summary line (`tests/shared/notify-context.test.ts:515-562`), while a normal row gains `"A plugin operation has failed."` (`:458-513`, which also asserts the input row was mutated).
**How to avoid:** In Plan 02 keep "render body, then resolve envelope". In Plan 04 move missing-arm detection into resolve and preserve **both** outcomes: attempt the same write on the input row inside `try` and read the effective severity back. [ASSUMED: preserving the frozen-row bytes is required by D-03; flooring every fallback to error would be a corpus difference needing sign-off -- see Open Questions]
**Warning signs:** the notify-context fallback cases change expected text, or the corpus reports a missing entry in `tests/shared/notify-context.test.ts`.

### Pitfall B: Nondeterministic capture
**What goes wrong:** Raw captures differ run to run (81 entries measured), so D-02 fails on an unchanged tree, or a normalizer gets added ad hoc during a real drift.
**How to avoid:** Ship the three normalizers and the `.test.ts` entry-point filter in Plan 01; require two back-to-back captures to self-diff clean **before** committing the baseline; record Node version.

### Pitfall C: Baseline mutated by formatters
**What goes wrong:** A `.json` baseline fails `format:check` or is rewritten by the Prettier/`fix-spaces` hooks.
**How to avoid:** ASCII-escaped `.jsonl`.

### Pitfall D: New `type-selection` candidates
**What goes wrong:** Every `Extract<X, { status: K }>` (or any object literal type whose member is only a discriminant) adds a candidate the gate reports `unread` unless a contract explains it. The existing eight `*_RENDER` annotations and `CommandContext.render` already carry such pins.
**How to avoid:** Pattern 2 (distributive conditional, unchanged `RenderFn<M>` parameter); add contract entries in the same commit when a new `{ status: K }` is unavoidable.

### Pitfall E: Model members read only in later phases
**What goes wrong:** `unread` findings for summary `count`/`subject`, per-row `leaked` for JSON, `invocationId`, and so on.
**How to avoid:** Phase 1 model = exactly what the text strategy reads.

### Pitfall F: Test data computed with production code
**What goes wrong:** Building D-13 resolved rows by calling resolve breaks the testing skill's independence rule and makes the arm tests tautological.
**How to avoid:** Literal resolved rows (typed with `satisfies`), with final reasons written out (for example `["orphan rewake", "requires pi-subagents"]`).

### Pitfall G: Marker order and position
**What goes wrong:** Merged reasons are sorted, deduplicated, or markers are placed first.
**How to avoid:** `[...contentReasons, ...softDepMarkers(...)]`, verbatim.

### Pitfall H: Sentinel and no-op asymmetry
**What goes wrong:** The text strategy applies `(no marketplaces)` to the update no-op path, or drops it from reconcile-applied.
**How to avoid:** Carry `noOp` as data. The sentinel applies to the plain cascade and to reconcile-applied (both `emitCascadeWith` and `composeReconcileAppliedBody`), never to no-op.

### Pitfall I: Stale architecture claims
**What goes wrong:** Gates and helper docs keep describing a per-emission probe (`notification-boundary.ts:3-11, 61-85`) or a file that holds the reload oracle.
**How to avoid:** Restate each claim as it now holds (Pitfall 9 in PITFALLS.md).

### Pitfall J: `module.register`
**What goes wrong:** Following CONTEXT's parenthetical literally uses a runtime-deprecated API (DEP0205 in Node 26).
**How to avoid:** `module.registerHooks`. D-01's decision is "a loader hook"; the API choice is a HOW detail.

## Code Examples

### Capture preload (measured shape)
```js
// scripts/notify-corpus.hook.mjs -- shape verified by the session prototype
import { appendFileSync, mkdirSync } from "node:fs";
import { registerHooks } from "node:module";
import path from "node:path";

const outDir = process.env.NOTIFY_CORPUS_OUT; // name at planner's discretion
const entry = process.argv[1] ?? "";
const testFile = path.relative(process.cwd(), entry);
const recording = entry.endsWith(".test.ts"); // excludes forked children such as concurrent-install-child.ts

globalThis.__corpusNotify = (ui, ...args) => {
  if (recording) {
    // write { file: testFile, message: args[0], severity: args[1] ?? null, argc: args.length }
  }
  return ui.notify(...args);
};

registerHooks({
  load(url, context, nextLoad) {
    const result = nextLoad(url, context);
    if (!url.includes("/extensions/pi-claude-marketplace/") || !url.endsWith(".ts")) {
      return result;
    }
    const source = String(result.source); // raw TypeScript; format "module-typescript"
    return {
      ...result,
      source: source.replace(/\b([A-Za-z_$][\w$]*)\.ui\.notify\(/g, "globalThis.__corpusNotify($1.ui, "),
    };
  },
});
```

### Normalizers that made two runs identical
```js
const TMP = os.tmpdir().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const normalize = (s) =>
  s
    .replace(new RegExp(`${TMP}/[^\\s'")]*`, "g"), "<TMPPATH>")
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g, "<UUID>")
    .replace(/(\.json)\.\d{4,}/g, "$1.<N>");
// also map os.homedir() and process.cwd() defensively
```

### Structured cause-chain walk (reuses the existing primitives)
```ts
// shared/errors.ts -- sketch; names at planner's discretion
export interface SerializedCauseChain {
  readonly links: readonly string[];
  readonly truncated: boolean;
}

export function serializeCauseChain(err: unknown): SerializedCauseChain | undefined {
  if (err === undefined || err === null) {
    return undefined;
  }
  const links = [...causeChain(err)];
  return { links: links.map(linkMessage), truncated: hasOnwardCause(links.at(-1)) };
}

export function causeChainTrailer(err: unknown): string {
  const chain = serializeCauseChain(err);
  return chain === undefined
    ? ""
    : `cause: ${chain.links.join(" -> ")}${chain.truncated ? " (truncated)" : ""}`;
}
```
The text strategy writes the same `cause: …` string from the serialized value. Export one formatter from `errors.ts` for both callers so the format string exists once. [VERIFIED: equivalence follows from `errors.ts:149-167`, where the suffix is appended to the last rendered link before the join]

### Resolved row typing (Pattern 2)
```ts
type ResolvedRowFacts = {
  readonly reasons: readonly Reason[]; // content reasons, then markers
  readonly hints?: readonly RowHint[];
  readonly failure?: ResolvedFailure; // causeChain, truncated, leaks, rollbackPartial
};
export type Resolved<M extends PluginNotificationMessage> = M extends unknown
  ? Omit<M, "reasons" | "dependencies" | "cause" | "rollbackPartial" | "partialHint" | "enableHint"> &
      ResolvedRowFacts
  : never;
export type RenderFn<M extends PluginNotificationMessage> = (row: Resolved<M>, mpScope: Scope) => string;
```
(The house style prefers `interface` for object types; declare `ResolvedRowFacts` as an interface.)

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `module.register()` (off-thread async loader hooks) | `module.registerHooks()` (in-thread sync) | Deprecated v25.9.0, runtime-deprecated v26.0.0 (DEP0205); `registerHooks` release candidate since v24.13.1 / v25.4.0 [CITED: nodejs.org/api/module.html] | Use `registerHooks` for the capture preload. |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | D-07's "the `/claude:plugin` command handler" means the single registered closure in `edge/register.ts` (Option A), not each subcommand handler | Pattern 4, Snapshot Plumbing | Choosing A changes all `SubcommandHandlers` signatures and moves probe pins out of handler tests; if the user meant B, construction moves into ~20 handlers and `browse` nesting needs explicit passing. |
| A2 | The frozen missing-arm row's current bytes (info, no summary) must be preserved | Pitfall A | If flooring to error is acceptable, resolve gets simpler, but the corpus shows a missing entry that needs sign-off. |
| A3 | CI Node 24 and local Node 26 produce identical error text in captured messages | Capture Tool Feasibility | A baseline captured on one major may not re-diff on another; mitigated by recording and checking `process.version`. |
| A4 | Hook callbacks get no run object in Phase 1 | Snapshot Plumbing | If D-07 is read as requiring hook construction now, the object has no reader there and fails `lint:type-members`. |
| A5 | Summary count/subject are computed but not carried as model members in Phase 1 | Anti-Patterns, Pitfall E | Carrying them now fails `lint:type-members` (`unread`). |
| A6 | The SC-5 table test lives in `tests/architecture/` | Deliverable 1 | Low; a `tests/shared/` placement would import orchestrator contexts into a shared owner test. |
| A7 | Running the corpus re-diff after every plan (not only at phase end) is acceptable overhead | Plan breakdown | None (additive). |

## Open Questions

1. **Missing-arm fallback severity for frozen rows.**
   - What we know: today a frozen out-of-band row keeps its original severity (write rejected); a normal row is floored to error.
   - What's unclear: whether D-03 treats this defense-in-depth path (type-unreachable for checked callers) as byte-locked.
   - Recommendation: preserve it (resolve performs the same guarded write); ask the user only if the planner prefers the simpler floor.
2. **Run-object construction root (A1).**
   - Recommendation: Option A (`edge/register.ts` closure + `index.ts`). Confirm during plan review if in doubt.
3. **Name of the per-invocation object.**
   - Constraint: not `mode`, not under `notifications`. Suggest type `NotificationRun`, field `run`, member `softDeps`, constructor `openNotificationRun(pi)`. Planner's discretion.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Everything; `registerHooks` needs >= 22.15 | ✓ local | 26.10.0 (CI: 24) | — |
| npm + `node_modules` | `npm run check` | ✓ (worktree has `node_modules/`) | — | — |
| `pre-commit` | commit hooks | not probed | — | Run `npm run check` pieces manually |
| `fallow` | `npm run fallow`, audit | via devDependency `^3.27.0` | — | — |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** none.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | `node:test` (Node 26 local / 24 CI) + `node:assert/strict` + `strong-mock` |
| Config file | none (npm scripts in `package.json`) |
| Quick run command | `node --test <test-path>`; pair coverage `npm run test:coverage:direct -- <path>` |
| Full suite command | `npm run check` |
| Corpus re-diff | `node scripts/notify-corpus.mjs diff` (name at planner's discretion; about 2 min; not in `check`) |

### Phase Requirements -> Test Map
| Req / SC | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SC-1 (PMOD-01/03 bytes) | Corpus re-diff empty; catalog diff empty; counts unchanged | tooling + architecture | corpus diff CLI; `git diff --exit-code <phase-base> -- docs/output-catalog.md`; `node --test tests/architecture/catalog-uat/catalog-contract.test.ts` | Tool ❌ Wave 0 (Plan 01); catalog ✅ |
| SC-1 non-vacuity | Planted drift fails and names the file; count refusal fires | negative script | `node scripts/notify-corpus.negative.mjs` | ❌ Plan 01 |
| SC-2 (PMOD-01) | One resolve step; content reasons then markers in fixed order; dispatch has no `softDepStatus`; text renderer takes no probe | unit + scan | `node --test tests/shared/notification-resolve.test.ts`; `rg -n "softDepStatus" extensions/pi-claude-marketplace/shared/notification-dispatch.ts` (expect none); `rg -n "SoftDepStatus" extensions/pi-claude-marketplace/shared/notification-grammar.ts` (expect none) | ❌ Plan 02-04 |
| SC-3 (PMOD-01) | One probe per run feeds severity and markers | integration-style unit | SC-3 case (for example in `tests/edge/register.test.ts`): stateful `getAllTools`, exactly 3 reads, warning summary **and** marker present | ❌ Plan 05 |
| SC-4 (PMOD-03) | No live `Error` in rendering; cause-chain bytes unchanged | type proof + scan + corpus | `@ts-expect-error` proof that a resolved row has no `cause: Error`; `rg -n "errors.ts" extensions/pi-claude-marketplace/shared/notification-grammar.ts` (expect none); corpus diff; `node --test tests/shared/errors.test.ts` | ❌ Plan 03 |
| SC-5 | Per-verb marker table stated as data; `workflows-marker-coverage` scans the new derivation site | architecture | `node --test tests/architecture/<marker-policy>.test.ts tests/architecture/workflows-marker-coverage.test.ts` | ❌ Plan 04 (new file + new case) |

### Sampling Rate
- **Per task commit:** `node --test` on touched owner tests; `npm run test:coverage:direct -- <pair>` (pre-commit hook enforces it); `npm run lint`, `npm run typecheck`.
- **Per plan:** `npm run check` (includes `lint:type-members` after Prettier) + corpus re-diff.
- **Phase gate:** full `npm run check` green, corpus re-diff empty, catalog `git diff` empty, e2e job green in CI, before `/gsd-verify-work`.

### Wave 0 Gaps
- [ ] `scripts/notify-corpus.mjs`, `scripts/notify-corpus.hook.mjs`, `scripts/notify-corpus.negative.mjs` -- SC-1 tooling
- [ ] `.planning/phases/01-presentation-model/notify-corpus/` baseline + meta (Node version, capture date, counts)
- [ ] `tests/shared/notification-resolve.test.ts` -- owner of the new resolve module (100% direct)
- [ ] `tests/shared/notification-run.test.ts` -- owner of the run constructor (Plan 05)
- [ ] `tests/architecture/<marker-policy>.test.ts` -- SC-5 table
- [ ] New case in `tests/architecture/workflows-marker-coverage.test.ts` -- `softDepMarkers(` call-site scan with a planted control
- [ ] SC-3 case (location per A1)

## Security Domain

`security_enforcement` is absent from `.planning/config.json`, so the section applies. [VERIFIED: config.json read this session]

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | — (device flow is Phase 3) |
| V3 Session Management | no | — |
| V4 Access Control | no | — |
| V5 Input Validation | no new input | Producer vocabulary unchanged (D-11) |
| V6 Cryptography | no | — |
| V7 Error Handling and Logging | yes | Serialized cause chains carry only `Error.message` (no `.stack`), `CleanupContextError` paths reduced to basenames (`errors.ts:186-190`), depth bound 5 (T-13-04). Reuse, do not re-implement. |
| V8 Data Protection | yes (tooling) | Committed baseline must hold no local paths or secrets: normalizers map tmp, home and cwd; trufflehog pre-commit runs on it (worktree commits use `SKIP=trufflehog`, so run trufflehog on the main checkout or review manually). |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Test-only production seam used as a bypass | Tampering | Rewrite in memory only; `no-test-only-production-surface` stays green. |
| Stack/path disclosure through serialized failures | Information disclosure | Serialize messages only; NFR-9 unchanged; redaction lands in Phase 4 at the single resolve site. |
| Probe influencing bridge writes | Tampering | Resolve stays in `shared/`, never called from `bridges/workflows/` (`no-probe-in-workflows-bridge`). |

## Sources

### Primary (HIGH confidence)
- Repository at `features/json` HEAD `21a58cc1`, files read this session: `shared/notification-{dispatch,grammar,summary,types}.ts`, `shared/notify-{context,reasons}.ts`, `shared/concerns/soft-dep.ts`, `shared/errors.ts`, `platform/pi-api.ts`, all 15 `orchestrators/**/*.messaging.ts`, `orchestrators/plugin/{install-flow,update-cascade,enable-disable,list-installed-row,update-swap}.ts` (cited ranges), `edge/{register,router}.ts`, `index.ts`, `tests/architecture/{gate-targets.ts,workflows-marker-coverage,no-probe-in-workflows-bridge,no-test-only-production-surface,compat-01-no-expansion,catalog-uat/*,notify-producer-wire-coverage,unit-suite-glob-completeness,unused-type-member-gate}.ts`, `tests/edge/notification-boundary.ts`, `tests/shared/notify-context.test.ts:440-562`, `eslint.config.js`, `.fallowrc.json`, `rule-packs/architecture.json`, `sonar-project.properties`, `scripts/check-unused-type-members.contracts.json`, `scripts/check-corresponding-tests.mjs`, `scripts/check-workflow-install-scripts.negative.mjs`, `package.json`, `.pre-commit-config.yaml`, `.prettierignore`, `docs/unused-type-member-gate.md`, `docs/output-catalog.md:617-625`, `skills/typescript-{unit-testing,comments,google-style-review}/SKILL.md`.
- Measurements this session: capture-hook prototype (two full unit + integration runs, determinism diff, TypeScript-format probe).

### Secondary (MEDIUM confidence)
- https://nodejs.org/api/module.html -- `registerHooks` stability/history; `module.register` DEP0205.

### Tertiary (LOW confidence)
- `.planning/research/{PITFALLS,ARCHITECTURE}.md` counts that were not re-measured here (dupes 1.41%, "31 suites" -- re-measured as 32 files importing the boundary helper).

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new packages; the Node API was verified by prototype and docs.
- Architecture: MEDIUM -- the module split and Option A are recommendations; the inventory under them is HIGH.
- Pitfalls: HIGH -- A through D were found in source; B was measured.

**Research date:** 2026-09-28
**Valid until:** 2026-10-28 (stable tree; re-check line:col pins after any merge from `main`)
