# Project Research Summary

**Project:** pi-claude-marketplace — json-output milestone (Mode-Keyed Presentation Strategies)
**Domain:** Brownfield Pi extension output layer — adding a versioned JSON presentation strategy alongside the byte-locked text renderer for `/claude:plugin`, selected by `ctx.mode`
**Researched:** 2026-09-28
**Confidence:** HIGH

> Written by the orchestrator from the synthesizer's inline return (the harness
> blocked the subagent's file write). Three corrections were applied against the
> source files: Stack's build-order advice (it recommends signature/sink views
> first, not last), the characterization-phase contradiction, and production
> payload validation (an open question in STACK.md, not resolved).

## Executive Summary

This milestone pulls a presentation model out of a mature, byte-locked text renderer (`shared/notification-grammar.ts`, ~1655 lines, 205 catalog states) and adds a peer JSON formatter that emits a versioned typebox wire schema via `pi.appendEntry("claude-plugin", payload)`. No new dependencies are needed — `typebox ^1.1.38` (already in use) covers the schema, and the already-pinned Pi peer (`>=0.86.1`) supplies `ctx.mode` and `appendEntry`. All four researchers converged on the same shape: a `Report` model computed once (severity, reload-needed, tally, summary, composed soft-dep markers, serialized cause chains) that text and JSON format independently, with no probe or `Error`-walking left in either renderer. The wire contract should mirror the project's existing closed-set vocabulary (`Reason`, `Severity`, `PluginStatus`) verbatim rather than inventing a parallel snake_case code system the way upstream Claude Code did — upstream's `--json` output is the useful precedent for shape (envelope + `message`, typed failure codes, absolute-path leaks to avoid) but is not the transport: Pi's own `ctx.mode`/`appendEntry` machinery, not a `--json` flag, is the selection axis (D3).

The main risk is not build effort but drift and disclosure. Every researcher independently flagged the same two families of danger: (1) the two-renderer split reintroducing byte drift in the already-locked text output (catalog gate, 26,619 bytes, 205 states) because the ~50 call sites and 64 status arms are non-uniform per verb, and (2) the JSON payload persisting to the session JSONL — unlike today's ephemeral `ctx.ui.notify` string — so paths, URL userinfo, device-flow codes, and `Error` causes that were safe to *display once* become shareable artifacts that must be redacted at the model boundary, not display-time. A third, Pi-specific risk sits underneath both: Pi binds extensions and fires `session_start`/`resources_discover` *before* the JSON/RPC writer subscribes to session events, so any `appendEntry` made during that startup window is saved to the in-memory session but never streamed to `--mode json` or RPC stdout — a real regression for RPC clients, who today see that output via `ctx.ui.notify`'s live forwarding (RPC clients can recover it with `get_entries`; json-mode clients cannot). Mitigation is architectural discipline (one `resolve()` step upstream of both strategies, redaction proven by a whole-payload test, the lifecycle-timing gap decided and documented rather than raced against with timers) plus a "characterize before moving" build order that keeps `npm run check` green and the catalog byte-identical throughout.

## Key Findings

### Recommended Stack

Add nothing. `typebox ^1.1.38` (installed 1.3.31, already the house schema library in `domain/components/*.ts`) supplies `Type.Union`/`Type.Literal`-tagged discriminated unions, `Compile()` validators for tests, and JSON Schema export for free (1.x schemas are plain JSON Schema 2020-12 objects with no symbol keys — `JSON.stringify` round-trips them byte-equal). The Pi peer stays pinned at `>=0.86.1`; 0.87.1 changes nothing on the surfaces this milestone uses, so there is no reason to bump the floor. `Type.Discriminated` does not exist in typebox 1.x — the idiom is a union of literal-tagged objects, each with `additionalProperties: false`.

**Core technologies:**
- `typebox` — versioned wire schema, `Static<>` for TS types, compiled validators for the JSON capture helper — already a dependency, no new source of truth
- `@earendil-works/pi-coding-agent >=0.86.1` — `ctx.mode`, `pi.appendEntry`, `entry_appended` session event — every surface verified against the installed binary and a real headless `pi` run (`pi -p --mode json --no-session --offline` runs a slash command with no model/credentials; stdin must be closed)

### Expected Features

**Must have (table stakes, all P1):**
- Envelope with `schemaVersion` (integer) and a written additive-vs-breaking compatibility policy (unknown fields/enum members must be ignorable)
- One discriminated union keyed by `kind`, mapped 1:1 from the existing `NotificationMessage` vocabulary plus new kinds for every D2 raw surface
- `severity` and `needsReload` required on every payload (the only outcome channel — Pi exits 0 in print/json regardless, per D5)
- Raw, un-abbreviated values (full version strings, full ISO dates, real booleans) — never the text form's display abbreviations
- Explicit `scope` wherever the text form elides it (JSON must not need to reproduce the orphan-fold rule)
- Serialized `causeChain: string[]` (with a `truncated` flag) — never a live `Error` object, which `JSON.stringify`s to `{}`
- Typed `usage-error`/`usage-info` payloads (upstream prints nothing on usage errors; a JSON consumer needs to be able to tell a usage error from silence)
- No new path disclosure beyond what text already shows (NFR-9) — payloads now persist to a shareable session file
- Closed-set tokens (`Reason`, `Severity`, `scope`, `status`) emitted verbatim, never a second snake_case vocabulary
- `origin` field distinguishing command output from load-time/hook-time output, since all three now share one event stream
- All 8 raw surfaces get typed kinds, including the **two callers D2's own list misses** (see Cross-Cutting Findings)
- A published schema reference doc and an in-process JSON capture helper for tests

**Should have (differentiators, P2):**
- `summary` string on warning/error payloads (a generic client that ignores `kind` still gets one human line)
- Numeric `tally` (`{failures, warnings, successes}`)
- Exported JSON Schema file plus a drift test
- `id: "<name>@<marketplace>"` on plugin rows (mirrors upstream's `pluginId` convention)

**Defer (v1.x/v2+):**
- `invocationId` correlating multi-payload command runs (P3; RPC's `response` boundary already covers most of this)
- Marketplace `source` field on `marketplace list` rows (upstream parity item, needs a model change text would then have to ignore)
- Pagination, a per-command `--json` flag, a snake_case `failureCode` vocabulary, streaming progress frames, embedding rendered text in the payload — all explicitly rejected as anti-features that either duplicate a locked decision (D3) or reintroduce the exact scraping problem JSON exists to end

### Architecture Approach

Layered extraction, all new code staying inside the existing `shared/` zone (no new fallow/ESLint zone needed — a new top-level `presentation/` folder would force zone-matrix changes across three gates for no benefit). The target pipeline: **producers** (orchestrators/edge handlers, unchanged `NotificationMessage` vocabulary) → **resolve()** (one `softDepStatus` probe, severity, tally, reload flag, composed reasons, serialized causes — this is where D1's "computed upstream of rendering" lives) → **Report** (the typebox `Static` type, also the wire schema) → **`presentationFor(ctx.mode)`** exhaustive selector → **text strategy** (`notification-grammar.ts`, byte-locked) or **JSON strategy** (`notification-json.ts`, new) → single sink (`ctx.ui.notify` or `pi.appendEntry`, both still living only in `shared/notification-dispatch.ts`).

**Major components:**
1. `shared/notification-model.ts` (new) — typebox schemas, `Static` types, `SCHEMA_VERSION`
2. `shared/notification-resolve.ts` (new) — turns `NotificationMessage` + row policy + probe into a Report; owns every presentation decision currently scattered across 64 status arms in 16 `*.messaging.ts` files
3. `shared/notification-mode.ts` (new) — `parseExtensionMode` membership check + exhaustive `switch`, `UnsupportedModeError` on anything else
4. `shared/notification-json.ts` (new) — pure Report→payload formatter
5. `shared/notification-grammar.ts` (modified, largest byte-drift risk) — becomes a pure formatter of Report, taking no probe and walking no `Error`
6. `platform/pi-api.ts` (modified) — derives `ExtensionMode` (not root-exported by the peer), adds `EntrySink`/`PresentationHost` consumer-owned views; `NotificationContext` gains a required `mode`

### Critical Pitfalls

1. **Startup emissions never reach the JSON/RPC stream.** Pi binds extensions (firing `session_start`/`resources_discover`) before the print/RPC writer subscribes to session events, so `appendEntry` calls made during the *first* `resources_discover` are saved to the in-memory session but never appear on stdout in `--mode json` or RPC — a real regression for RPC, which today sees this via live `notify` forwarding. Must be decided and documented, not raced against with `setTimeout`. Separately, emissions after the command handler's promise settles are lost in json mode (Pi disposes the runtime).
2. **Text byte drift hidden by fixtures that move with the code.** ~50 call sites and 64 status arms are non-uniform per verb (the same status renders through different helper functions in different commands); markers are suppressed per-verb-per-status via hard-coded `false` flags, not derived uniformly. Avoid by characterizing the full wire corpus (every `(message, severity)` pair) *before* extraction and diffing after, keeping `docs/output-catalog.md`'s byte count unchanged throughout.
3. **Persisted leaks.** `appendEntry` data lands in the session JSONL (shareable, exportable to HTML, attachable to bug reports) — unlike today's ephemeral notify text. Absolute paths, URL userinfo, device codes, and `Error.stack` all become at-rest artifacts. Redact once at the model boundary and prove it with a whole-payload walk test; add the new sink to `CREDENTIAL_LEAK_TARGETS` (AUTH-09).
4. **`appendEntry`/`ctx.mode` throw where `ctx.ui.notify` never did.** `ctx.ui.notify` is a no-op stub in print/json and cannot throw; `appendEntry` throws before bind and on a stale post-reload context, and `ctx.mode` is a live getter with the same stale-context throw. Long-lived callbacks (async-rewake, Stop-cap) that capture `ctx` must never let this propagate (NFR-2); `bridges/hooks/settle.ts:378` currently has no surrounding try/catch.
5. **Unknown-mode typed error timing/lint conflict.** A `default: throw` arm on an exhaustive `ExtensionMode` switch is an ESLint error (`switch-exhaustiveness-check`, no default allowed); the fix is a `parseExtensionMode(value: unknown)` membership check before any state mutation, tested with a plain unknown string — never `as unknown as`.

## Cross-Cutting Findings (converged across 3-4 researchers)

- **Startup entries never stream (Architecture/Pitfalls/Stack, all HIGH).** `bindExtensions` fires `session_start`/`resources_discover` before `print-mode.js`/`rpc-mode.js` subscribe. RPC clients specifically lose today's `extension_ui_request` notify text, including the device-flow code — the most dangerous instance, because auth then polls until the flow times out.
- **`appendEntry` lives only on `pi`, `mode` only on `ctx`; raw-string sites need `pi` threaded (Stack/Architecture).** ~70 structured call sites already carry `(ctx, pi)`, but the ~50 raw-string call sites (`notifyUsageError`, `notifyUsageInfo`, `notifyDiagnostic`, `makeRawNotifyFn`, `notifyAsyncRewakeSummary`, `notifyStopHookOverrideCap`) take only `ctx` today and need signature changes (router, help handler, argument parsers, auth option bags, two diagnostic helpers). `appendEntry` throws during factory-body load and on a stale `pi` after `/reload`.
- **`makeRawNotifyFn` has three callers, not one — D2's list is incomplete (Features/Architecture/Pitfalls, all confirmed against source).** Beyond the device-flow prompt (`auth-host.ts:112`), `index.ts:128` ("reconcile aborted") and `index.ts:149` ("plugin PATH not refreshed") are the same raw callback and need kinds (`reconcile-aborted`, `plugin-path-skipped`) for "total coverage" to actually hold.
- **Session persistence and leaks (Stack/Architecture/Pitfalls).** Payloads go into the session JSONL, are shareable/exportable (HTML export, bug-report bundles), and thereby persist absolute paths, URL userinfo, device codes, and `Error` causes that the ephemeral text form never wrote to disk. Note (Stack): for slash-command-only runs nothing is written to disk until an assistant message exists, so D4's "saved to session file" holds only for sessions with a model turn.
- **Unknown-mode must be a `parseExtensionMode(unknown)` membership check (Pitfalls/Architecture).** ESLint forbids a `default` arm on an exhaustive switch; lifecycle handlers (`resources_discover`, hooks) must never rethrow (NFR-2) and their own fallback paths must not depend on the mode they just failed to parse. The D6 `browse` refusal, by contrast, has a strategy and should be *emitted* as an error-severity payload, not thrown (a thrown handler error reaches json consumers only on stderr).
- **`origin`/command-id correlation (Features TS-16, Architecture, Pitfalls UX section).** All three flag the need for a machine command/verb id (not the human `Messaging.label`) so load-time, hook-time, and command-time entries in one stream can be told apart, and so `enable` can be distinguished from `install` even though both render `(installed)`.
- **Counts vs English summary strings (Features D-1/D-2, Pitfalls #8, Architecture Report shape).** Architecture and Pitfalls insist the wire model carries decisions and counts (`severity`, `tally: {failures, warnings, successes}`, `reloadHint: boolean`), never rendered English (`summary` line text, `/reload to pick up changes` trailer, glyphs) — a wording fix in the catalog would otherwise become a breaking JSON change. Features lists a `summary` string as a P2 differentiator; this is a requirements decision.
- **Whether production validates payloads (open — STACK.md Open Question 4).** Recommendation from the Pitfalls/Architecture analysis: compile-time `Static<typeof Schema>` typing in production; runtime `Compile().Check` only in the test capture helper, never as a pre-emit gate (a validation failure there would have to throw or drop output, both violating NFR-2).
- **Gate traps (Pitfalls #9/#10/#12, Architecture "Gates and tests that must change").** Type-member pins (~25 coordinates) sit in every file this milestone rewrites and move on any edit or Prettier reflow; `JSON.stringify` of a model object counts as a "read" of every member for the unused-type-member gate, so the JSON converter must serialize an explicitly built DTO, never the model object itself, never with a replacer. An ESLint `appendEntry` single-site ban needs a planted-violation test (a gate is proved by planting, per house convention), matching the existing `ctx.ui.notify` ban. 23 `as unknown as ExtensionContext` casts across 9 test files currently hide a missing `mode` from the compiler and will fail only at runtime — grep for them explicitly. The new concept must never be spelled `mode` in orchestrator option bags, which already use `opts.notifications?.mode === "orchestrated"` for an unrelated concept.

### Build Order — reconciled recommendation

Architecture's 7-step plan and Pitfalls' "characterize first" insistence agree on substance and sequence: the model/resolve layer lands **before** any row-policy or JSON-strategy work (D1's core invariant: no probe or `Error`-walk left in rendering), and emitting through `appendEntry` comes **last**, once the model and both strategies already exist as pure functions.

**Where Stack disagrees:** Stack recommends doing the *signature and sink-view* work **first** — extend the `pi-api.ts` views (`ExtensionMode`, `EntrySink`, required `mode` on `NotificationContext`) and thread `pi` into the six ctx-only raw functions — because every strategy phase depends on those types. Pitfalls adds a constraint that shapes the resolution: a new type member must land together with its first reader, or the unused-type-member gate fails. Reconciliation for the roadmapper: the type widening can only land early if something reads it (e.g. the raw surfaces consuming `pi` when they become typed kinds); otherwise it belongs with the mode-selection step. Either way, `appendEntry` emission itself stays last.

1. **Characterization baseline (Pitfalls' explicit addition).** Capture the full wire corpus — every `(message, severity)` pair `notification-dispatch.ts` emits across the unit and integration suites — via throwaway, never-merged instrumentation, before touching the renderer. This is the pattern the v1.18 retrospective already validated ("characterize first, then change") and it is the only way to catch byte drift in the ~50 call sites the 205-state catalog doesn't cover (raw surfaces, diagnostic headers).
2. **Model and resolve behind the text strategy (Architecture step 1; Pitfalls Pitfall 2 mitigation).** Add `notification-model.ts` and `notification-resolve.ts`; move the probe, markers, cause-chain/leak serialization, hints, summary facts, tally, and reload flag into resolve, with grammar formatting the Report. Keep a temporary adapter shape (`formatRow ∘ projectRow`) so the 70 existing direct-arm test calls stay green during this step — but only within this step; carrying it across a phase boundary is the dead-code-gate trap Pitfalls #11 and #12 both name.
3. **Per-command render maps become row policies (Architecture step 2 — largest production blast radius: 16 messaging files, 12 test files, 70 assertions).** Encode the per-verb divergences (Pitfall 2's table: `disabled`'s two different helper functions, `partially-installed`'s marker-suppression exception on `list`, etc.) as data in a total policy map, not as inferred-from-verb logic in the text converter.
4. **Raw-string surfaces into typed kinds, still text-only (Architecture step 3; Features TS-12/TS-17; closes the D2 gap including the two missed `index.ts` callers).** Structure usage-error, usage-info, diagnostic, device-code, lifecycle-warning, rewake, and stop-cap as Report kinds routed through one `present()`, before any JSON is wired.
5. **JSON strategy as a pure function, unwired (Architecture step 4; Stack's Q5/typebox guidance).** Build `notification-json.ts` and the wire schema; validate every catalog fixture converts and passes `Compile(...).Check`. No sink call yet — satisfies the dead-code gate by having the strategy function itself be the reader.
6. **Mode selection, host widening, and the sink (Architecture step 5 — largest test blast radius; Pitfalls #4/#5/#6/#10/#12 all land here).** `pi-api.ts` gets `mode`/`EntrySink`/`PresentationHost`; `notification-mode.ts`'s exhaustive switch and `parseExtensionMode`; thread `pi` through the ~50 raw call sites; add the ESLint `appendEntry` ban with a planted-violation test; add NFR-2 catches around every long-lived callback; make `mode` a required (never-defaulted) field on every test fake, including the 23 unsafe casts.
7. **Browse typed error (D6) and documentation.** Route the `browse`-outside-`tui` refusal through the Report as an error-severity payload; publish the schema reference (versioning policy, print-mode silence, the RPC notify-loss decision, the startup-emission gap), and amend AGENTS.md's IL-2 line (D8).

**Step 1/2 swap:** Architecture notes steps 2/3 could swap (policies before model) but rejects that ordering because it would leave the softDep probe inside rendering for a whole extra step, violating D1 earlier than necessary — Pitfalls' Pitfall 2 independently arrives at the same preference for the same reason.

## Implications for Roadmap

### Phase 1: Characterization + Model/Resolve Extraction
**Rationale:** Both Architecture and Pitfalls agree this must be first and isolated — it is the highest byte-drift risk step, and a wire-corpus baseline is the only way to catch regressions the 205-state catalog doesn't cover.
**Delivers:** wire-corpus baseline (first plan of the phase); `notification-model.ts` (internal Report types), `notification-resolve.ts`; probe/marker/cause-chain computation moved upstream of rendering; catalog and wire-corpus diffs empty.
**Addresses:** D1 (presentation model), the soft-dep marker composition (TS-8).
**Avoids:** Pitfall 2 (byte drift), Pitfall 11 (temporary adapters outliving their phase).

### Phase 2: Row Policies + Raw-Surface Typing
**Rationale:** Converts the remaining per-verb divergences and the D2 raw surfaces into data, still entirely within the text strategy, before any JSON exists — keeps blast radius contained to one representation at a time.
**Delivers:** Row-policy maps replacing 64 status-arm renderers across 16 messaging files; typed kinds for all 8 raw surfaces including the two `index.ts` callers D2's original list missed.
**Addresses:** TS-7 through TS-12, TS-17 (total coverage, D2).
**Avoids:** Pitfall 9 (named-file gates breaking on relocation — inventory gates to re-point before moving code).

### Phase 3: JSON Wire Schema + Strategy (Unwired)
**Rationale:** Build and validate the JSON converter as a pure function against every catalog fixture before wiring any sink, satisfying the dead-code gate and keeping the mode-selection blast radius separate.
**Delivers:** typebox wire schema (added to `notification-model.ts`), `notification-json.ts`, schema-conformance test over all 205 fixtures with a planted failing control, redaction walk test.
**Uses:** typebox `Type.Union`/`Type.Literal` idioms (Stack Q5), `Compile().Check`/`.Errors()` for the test-side validator.
**Implements:** the Report-as-wire-schema abstraction (Architecture section 4).
**Addresses:** Pitfall 3 (persisted leaks — redaction and walk test), Pitfall 7 (versioning policy, closed-set enrollment proof), Pitfall 8 (no rendered English on the wire).

### Phase 4: Mode Selection, Sink Wiring, and Test Plumbing
**Rationale:** Largest test-file blast radius (required `mode` on every fake, ~50 `pi`-threading sites); done last so it wires already-correct, already-tested strategies rather than half-built ones.
**Delivers:** `platform/pi-api.ts` widening (`ExtensionMode`, `EntrySink`, `PresentationHost`); `notification-mode.ts` exhaustive switch with `parseExtensionMode`; `pi.appendEntry` sink wired for json/rpc; ESLint ban + planted-violation test; NFR-2 catches around lifecycle/hook callbacks; JSON capture helper for tests.
**Uses:** the Pi timing facts from STACK.md (Q1/Q6), the required-field discipline from PITFALLS.md Pitfall 6.
**Avoids:** Pitfall 4 (new throw sites), Pitfall 5 (unknown-mode timing/lint), Pitfall 6 (implicit mode fallbacks), Pitfall 10 (type-member pin churn), Pitfall 12 (unbanned sink).

### Phase 5: Browse Typed Error, Docs, and Real-Pi Verification
**Rationale:** Closes D6 and publishes the contract; a real (non-mocked) `pi --mode json` run is the only way to pin the startup-emission gap and the RPC notify-loss consequence, both of which mock-Pi helpers cannot show.
**Delivers:** `browse` refusal routed through the Report; schema reference doc (versioning policy, print-mode silence, startup-timing decision, RPC change); AGENTS.md IL-2 amendment; a real-Pi e2e case asserting which entries do and do not stream (and pinning `entry_appended` at the peer floor).
**Addresses:** D6, TS-18 (published schema reference).

### Phase Ordering Rationale

- Model-before-policies-before-JSON-before-sink is the ordering Architecture and Pitfalls independently converge on, for the same structural reason: each layer must be provably correct on its own before the next layer builds on it, and the byte-locked catalog gate is the regression oracle at every step until JSON is wired. Stack's signature-first advice is reconcilable (see Build Order).
- Characterization is the first plan of Phase 1 rather than its own phase: Pitfalls treats it as a prerequisite artifact that protects every later step, and it has no deliverable of its own that ships.
- Mode/sink wiring is deliberately late because it is the only phase that touches ~90 `NotificationContext` references and every test fake — doing it after the strategies are already correct means test failures during this phase are wiring bugs, not logic bugs.

### Research Flags

Needs deeper research during planning:
- **Phase 1 (Characterization + Model):** the exact per-verb suppression table (which arms pass hard-coded `false` soft-dep flags) needs to be enumerated file-by-file before writing the row-policy data structure — PITFALLS.md Pitfall 2 has a partial list but flags it as needing verification per arm.
- **Phase 4 (Mode/Sink):** the startup-emission decision (accept-and-document vs. find-a-Pi-channel) is an open product decision, not a research gap — flag for requirements, not for `--research-phase`.
- **Phase 5 (Real-Pi verification):** needs an e2e harness pattern using the headless `pi` invocation Stack verified (`--mode json --no-session --offline`, stdin closed), which is new to this codebase's e2e suite.

Standard patterns (skip research-phase):
- **Phase 2 (Row policies):** typebox schema idioms and the total-map/`satisfies` pattern are already house convention (`domain/components/*.ts`).
- **Phase 3 (JSON strategy):** the strategy-selector and sink patterns are fully specified by Architecture's target data-flow diagram.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Every claim verified against the installed `@earendil-works/pi-coding-agent@0.86.1` source plus a real headless `pi` probe run; no third-party source needed |
| Features | HIGH for the upstream contract and Pi transport (binary/docs agree); MEDIUM for per-verb payload mapping (derived from types and catalog, not a built prototype) | Upstream `claude` 2.1.283 binary strings + official docs cross-checked |
| Architecture | HIGH for the inventory and Pi runtime facts (grep + source read); MEDIUM for the proposed layout (a design recommendation) | 119 call sites in 45 production files, counted and cross-checked |
| Pitfalls | HIGH for Pi runtime facts and repo gate facts (read from tree at `ab3d9c31`); MEDIUM for typebox 1.x behavior and size estimates; LOW for anything marked "inferred" | |

**Overall confidence:** HIGH

### Gaps to Address

- **Startup-emission decision (Pitfall 1 / Open Question 1 in FEATURES.md):** whether to accept the RPC startup-visibility regression and document it, or find a Pi-sanctioned channel, is unresolved and must be decided during requirements, not discovered during execution.
- **URL userinfo stripping (Pitfall 3, Features Open Question 5):** whether a stored `url`-source marketplace's userinfo should be redacted in JSON even though the text form shows it today — a parity-vs-safety tension for requirements to settle explicitly.
- **Device-flow behavior in `print` mode (Pitfalls Integration Gotchas):** print mode is silent by design (D5), so a device-flow prompt shown nowhere leaves the flow polling until it expires; needs a decision on whether to fail fast with a typed error when auth is needed in `print`.
- **Whether the tool-surface projection (`edge/handlers/tools.ts`) should align with the new JSON vocabulary** (Features Pitfall 8 note) — the LLM-tool `details` mapping already diverges from raw status names (`upgradable` → `[installed]`); left as an explicit decision, not silently reconciled.
- **Production payload validation** (STACK.md Open Question 4) and **summary string vs counts only** (Features vs Architecture) — requirements decisions.

## Sources

### Primary (HIGH confidence)
- Installed `@earendil-works/pi-coding-agent@0.86.1` dist source (types.d.ts, agent-session.js, session-manager.js, print-mode.js, rpc-mode.js, extensions/loader.js, extensions/runner.js) — read directly and measured via a throwaway hermetic probe extension
- Claude Code 2.1.283 binary (strings grepped) and https://code.claude.com/docs/en/plugins/cli-reference.md — cross-checked against each other
- Repo at `ab3d9c31` (this worktree): `.fallowrc.json`, `eslint.config.js`, `rule-packs/architecture.json`, `sonar-project.properties`, `docs/unused-type-member-gate.md`, `tests/architecture/*`, all `shared/notification-*.ts` and `*.messaging.ts` files
- `.planning/MILESTONE-CONTEXT.md` — locked decisions D1-D8

### Secondary (MEDIUM confidence)
- npm 11.19.1 and gh 2.97.0 CLI behavior, probed locally
- `docs/competitive-analysis/pi-plugins.md` (`@nklisch/pi-plugins` control channel) at commit `175142c`
- typebox 1.3.31 behavior measured in-process (union/literal JSON output, `additionalProperties` enforcement, `.Errors()` shape)

### Tertiary (LOW confidence)
- Terraform JSON output format and machine-readable UI docs (webfetch, used only as an analogy for versioning policy)
- kubectl `-o json` conventions (training knowledge, not re-verified)

---
*Research completed: 2026-09-28*
*Ready for roadmap: yes*
