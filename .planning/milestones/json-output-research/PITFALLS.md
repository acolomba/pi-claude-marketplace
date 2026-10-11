# Pitfalls Research: json-output (Mode-Keyed Presentation Strategies)

**Domain:** Adding a second (JSON) presentation strategy to a mature Pi extension,
by pulling a presentation model out of a byte-locked text renderer, and selecting
the strategy with Pi's `ctx.mode`
**Researched:** 2026-09-28
**Confidence:** HIGH for the Pi runtime facts (read from the installed
`@earendil-works/pi-coding-agent` 0.86.1 `dist/`) and the repo gate facts (read
from the tree at `ab3d9c31`). MEDIUM for the typebox 1.x behavior (training data
plus the local usage pattern) and for the size estimates. LOW for anything
marked "inferred".

Locked decisions D1-D8 in `.planning/MILESTONE-CONTEXT.md` are taken as given.
Where a pitfall shows that a locked decision has a consequence nobody has decided
yet, it says **needs decision** and does not re-open the lock.

---

## Critical Pitfalls

### Pitfall 1: Pi binds extensions before the JSON/RPC writer subscribes, so lifecycle-time payloads never reach the stream

**What goes wrong:**
In both non-interactive writers, Pi runs `session.bindExtensions(...)` first. That
call emits `session_start` and then `resources_discover`. Pi calls
`session.subscribe(...)` only after it returns:

- `dist/modes/print-mode.js`: `await rebindSession()` binds first, then subscribes
- `dist/modes/rpc/rpc-mode.js:230` binds, and `:265` subscribes

`pi.appendEntry` emits `entry_appended` synchronously
(`dist/core/agent-session.js:2131-2136`). So every payload appended during the
startup `resources_discover` never appears on stdout in `--mode json` or RPC. That
covers the reconcile-applied cascade, the `notifyDiagnostic` post-commit warnings
(`orchestrators/reconcile/apply.ts:978`), the `reconcile aborted:` last-ditch line
and the `plugin PATH not refreshed` warnings (`index.ts:128`, `:149`). The payloads
still go into the in-memory session entries.

Today this is a **regression for RPC**. The RPC UI context writes `notify`
straight to stdout as `extension_ui_request`, with no subscription involved
(`rpc-mode.js:87-95`), so RPC clients currently DO see startup reconcile output.
Session replacement (new, fork, switch) has the same gap: `rebindSession` binds
the new session before it moves the subscription. `/reload` behaves differently,
because the subscription on the same session stays live. So reload-time payloads
arrive and startup-time payloads do not.

**Why it happens:**
The obvious mental model is "appendEntry is an event, and events stream". The
bind-then-subscribe order is an internal detail of Pi's mode runners. No Pi doc
covers it, and `entry_appended` is not in Pi's `docs/` or `CHANGELOG.md` at all.

**How to avoid:**
- Treat lifecycle-time emission as a named design question. Write it into the
  requirements before the JSON strategy is built. **Needs decision**: either
  (a) accept the gap, document it in the JSON schema reference, and pin it with a
  real-Pi e2e case that shows the entry is in the session but not on stdout, or
  (b) find a Pi-sanctioned channel. Do not use timer deferral
  (`setImmediate`/`setTimeout` from inside the handler) to "land after the
  subscribe". Whether it wins the race depends on how many awaits are left inside
  `bindExtensions`, and that changes between Pi patch releases.
- Give the RPC regression its own CHANGELOG line. It is a user-visible behavior
  change for RPC clients.
- Add a real-Pi e2e case under `tests/e2e/` that runs `pi --mode json` with a
  reconcile action pending, and asserts which entries do and do not appear. The
  mock-Pi helpers (`tests/e2e/_helpers.ts` `makePi`) cannot show this ordering.

**Warning signs:**
The in-process tests (fake `pi.appendEntry` capture) show a startup reconcile
payload, but `pi --mode json` stdout has none. RPC users report that "install on
reload" feedback disappeared.

**Phase to address:**
The JSON strategy / transport phase decides and documents. The e2e phase pins the
behavior against real Pi.

---

### Pitfall 2: Text byte drift during model extraction, hidden by fixtures that move with the code

**What goes wrong:**
D1 moves two things out of the renderers and into the model. The first is the
per-verb `renderPluginRowBody` callbacks (`*.messaging.ts`, reached through
`emitContextCascade` / `emitUpdateNoOpCascade` /
`emitReconcileAppliedContextCascade` in `shared/notification-dispatch.ts`). The
second is the render-time `softDepStatus(pi)` probe (`notification-dispatch.ts`
`notify()` and `emitCascadeWith`). Each has a byte-level trap:

- **Per-verb arms are not uniform.** One status renders through different helpers
  depending on the verb. `disabled` is `pluginRow(ICON_DISABLED, ...)` in
  `install.messaging.ts:137`, but `renderDisabledRow(...)` in
  `enable-disable.messaging.ts:106` and `list.messaging.ts:137`. A single
  status-to-row text converter picks one and silently changes the other verbs'
  bytes, unless the model carries the fact that tells them apart.
- **Soft-dep markers are suppressed per verb and per status, not derived
  uniformly.** Several arms pass hard-coded `false` soft-dep flags into
  `composeReasons` (ENBL-15 / ENBL-18 on `disabled`, MSG-SD-3 on `uninstalled`,
  marketplace headers at `notification-grammar.ts:246`, `:273`). A model that
  computes "declares agents && pi-subagents not loaded" for every row adds
  `{requires pi-subagents}` to rows that must never carry it.
- **Marker position inside the brace is part of the bytes.** `composeReasons`
  appends markers AFTER the caller's `reasons[]` ("orphan rewake" leads,
  `docs/output-catalog.md` state `success-with-orphan-rewake-and-soft-dep`). A
  model that merges markers into `reasons[]` before sorting, or that dedupes
  them, reorders the brace.
- **Whitespace folds.** `foldAdvisories`, `foldTallyAndHint`, `composeWithSummary`,
  the `(no marketplaces)` sentinel for an empty cascade (but not for the update
  no-op path), and the `\n\n` blocks in `notifyUsageError`, `notifyDiagnostic` and
  `notifyStopHookOverrideCap` each own exact separators. A model that computes
  "summary present" and "reload needed" but lets the text converter recompose
  the joins is where a doubled or missing blank line appears.
- **Text-only presentation.** The 66-column description truncation and wrapping
  (`truncateDescription`, `notification-grammar.ts:113`), glyphs, and the
  4-space and 6-space cause-chain indents are text decisions. If they move into
  the model, the JSON carries truncated descriptions and indent strings.

The catalog gate (`tests/architecture/catalog-uat/catalog-contract.test.ts`,
205 states, `EXPECTED_UTF8_BYTES = 26_619`) is the oracle. But it drives
`NotificationMessage` **fixtures** through `notify()`, and the probe comes from
`mock-pi.ts`. Once markers are resolved upstream, the fixtures must carry
resolved markers. If a fixture and the renderer change in the same commit, the
catalog stays green while the probe-to-marker derivation it used to cover moves
into a module the catalog never drives.

**Why it happens:**
"Byte form unchanged" is checked against one corpus (205 catalog states), but the
extraction touches ~59 files that call the notify family. Per-verb differences
live in arms nobody reads side by side.

**How to avoid:**
- **Characterize before moving.** Before extraction, capture a wire corpus: every
  `(message, severity)` pair that `notification-dispatch.ts` emits across the
  unit and integration suites. Use a throwaway, branch-local instrumentation
  commit that is never merged, because test-only production seams are banned
  (`no-test-only-production-surface.test.ts`). Key each pair by test file and
  call order. Re-capture after extraction and diff. This covers the raw surfaces
  and diagnostic headers that are not among the 205 catalog states. It is the
  "characterize first, then change" pattern from the v1.18 retrospective.
- `docs/output-catalog.md` must have an empty `git diff` for the whole extraction
  phase, and `EXPECTED_UTF8_BYTES` / `EXPECTED_STATE_COUNT` must not move. Put
  that in the phase's success criteria.
- Give the probe-to-marker derivation its own owner test in the model module,
  with the per-verb suppression table stated as data. Also keep
  `tests/architecture/workflows-marker-coverage.test.ts`: its derived site scan
  over `orchestrators/` must be re-pointed at wherever derivation now lives, not
  deleted when it goes red.
- Carry per-verb differences as explicit model facts (for example "markers
  suppressed on this row" or "enable hint"). Do not have the text converter infer
  the verb.

**Warning signs:**
A catalog fixture file changes in the same commit as `notification-grammar.ts`.
A `*.messaging.test.ts` owner test is deleted rather than moved. The model module
has one row builder per status, with no verb input.

**Phase to address:**
The model-extraction phase. The wire corpus is captured in a characterization step
at the start of that phase, or in a phase before it.

---

### Pitfall 3: The JSON payload persists what the text channel only displayed (paths, credentials-adjacent strings, untrusted text)

**What goes wrong:**
`ctx.ui.notify` text is ephemeral. `appendEntry` data is appended to the session
tree (`session-manager.js:855-866`) and written to the session JSONL once the
session has an assistant message (`_persist`, `session-manager.js:740-769`). From
there it flows into Pi's HTML export (`core/export-html/template.js` walks all
entries) and into the bug-report bundle, which can attach `session.jsonl`
(`core/bug-report.js:199-200`). Content that was acceptable to show once becomes
data at rest and data a user may share:

- **Absolute paths on purpose.** `MarketplaceInfoMessage.source.absPath` renders
  as `path: <abs>` (`notification-grammar.ts:1179`). It is correct for a local
  info display, but it discloses the home directory in a shared session file.
- **Absolute paths by accident.** Redaction happens only at some composition
  sites (`orchestrators/reconcile/apply.ts:177,187,811,962`,
  `plugin/shared.ts:1457`, `plugin/info.ts:830`, `reconcile/backfill.ts:156`,
  `enable-disable.ts:1206`). Several raw paths are not redacted:
  `index.ts:128` (`reconcile aborted: ${errorMessage(err)}`), `index.ts:149`
  (`skip.reason`), and every `cause?: Error` chain that `causeChainTrailer`
  walks (`shared/errors.ts:149`). `ManualRecoveryError.leaks` are file paths by
  design (`errors.ts:529`).
- **Credential-adjacent strings.** The device-flow line
  `Open ${verification_uri} and enter: ${user_code}` (`domain/github-auth.ts:436`,
  through `makeRawNotifyFn` from `orchestrators/auth-host.ts:112`) would be
  persisted. The user code is short-lived, but it now lives in a file. A
  `url`-source marketplace renders `url: ${source.url}` verbatim
  (`notification-grammar.ts:1174`). A URL with embedded `user:token@` userinfo
  would be written to the session. Nothing in `extensions/` strips URL userinfo
  today.
- **Untrusted third-party text.** Plugin `description` from marketplace
  manifests, hook `rewakeSummary` (`bridges/hooks/async-rewake/registry.ts:434`)
  and cause messages are not scrubbed of control characters.
  `JSON.stringify` escapes them, so the JSON stays valid, but a consumer that
  prints the field to a terminal gets ANSI and OSC injection. Text is safe today
  mostly because Pi's TUI owns rendering.
- **Error objects.** `PluginFailedMessage.cause?: Error` and
  `rollbackPartial[].cause?: Error` (`notification-types.ts`) serialize as `{}`
  (lossy), because `message` and `stack` are non-enumerable. The "fix" of
  serializing `stack` leaks every absolute `node_modules` and home path.

**Why it happens:**
The redaction discipline (NFR-9, `redactAbsolutePaths`) was built for a display
surface, where missing a site cost little. The AUTH-09 gate
(`tests/architecture/no-credential-leak.test.ts`) guards state-write paths
(`persistence/state-io.ts`, `migrate.ts`, `with-state-guard.ts`), not a session
write path, because none existed.

**How to avoid:**
- The model carries causes as already-projected, redacted string arrays: a
  cause chain plus leaks. It never carries an `Error`. The wire schema has no
  slot typed as an object that could hold one.
- Redact once, at the model boundary, for every free-text field, and prove it
  with a whole-payload walk test. That test serializes every catalog fixture's
  JSON payload and asserts that no substring matches the absolute-path regex from
  `redact-absolute-paths.ts`. Keep `absPath` only where the command's purpose is
  to show the path, and decide that per field (**needs decision** for
  `marketplace info` path sources).
- Add the JSON sink module to `CREDENTIAL_LEAK_TARGETS`
  (`tests/architecture/gate-targets.ts`) so AUTH-09 scans the new write path.
- Carry device-flow data as structured fields (`verificationUri`, `userCode`),
  not the English sentence. This means changing the `notifyFn` callback contract
  in `domain/github-auth.ts`, which is itself an AUTH-09 target, so that gate
  must be re-proved.
- Treat control characters with a deliberate choice. Strip C0/C1 (except `\n`)
  in the JSON converter only, so the text bytes cannot drift, or document the
  fields as untrusted raw text. Do not sanitize in the model; that changes the
  text output.

**Warning signs:**
`JSON.stringify(payload)` contains `/home/` or `/Users/` in any test. A schema has
`Type.Unknown()` or `Type.Any()` for a cause. The device-flow payload has a
`message` string and no structured fields.

**Phase to address:**
The model-extraction phase (causes as projected strings, redaction at the
boundary). The JSON-strategy phase adds the payload-walk test and the AUTH-09
target. The raw-surfaces phase handles device flow.

---

### Pitfall 4: `appendEntry` and `ctx.mode` throw where `ctx.ui.notify` never did

**What goes wrong:**
In json and print mode, `ctx.ui.notify` is the runner's `noOpUIContext.notify`
(`dist/core/extensions/runner.js:114-118`) and cannot throw. The new calls can:

- `pi.appendEntry` throws `Extension runtime not initialized` during extension
  loading (`core/extensions/loader.js:119`). It also throws the stale-context
  message after session replacement or `/reload` (`loader.js:288-290`, via
  `assertActive`).
- The `ctx.mode` getter itself calls `runner.assertActive()`
  (`runner.js:539-541`). A stale captured `ctx` therefore throws when the mode is
  read, before any strategy is chosen.

The long-lived callbacks capture a `ctx` and emit later. In
`bridges/hooks/async-rewake/registry.ts:434` the notify is wrapped in try/catch.
In `bridges/hooks/settle.ts:378` (`notifyStopHookOverrideCap`) it is not. With
the JSON strategy, a stale capture that used to fail quietly inside a no-op can
now throw out of a hook dispatcher. The existing generation guard
(`capturedGeneration !== runtime.currentGeneration()`) covers async-rewake only.

**Why it happens:**
The notify family has been infallible in non-TUI modes for the project's whole
history. Nothing in the code treats "emit output" as an operation that can fail.

**How to avoid:**
- The strategy sink wraps `appendEntry` and records a failure on the debug seam
  (`hookDebugLog`), consistent with NFR-2. It never lets the failure escape from a
  hook dispatcher or lifecycle handler. Decide whether command handlers let it
  propagate: Pi routes a command-handler throw to `emitError`, which is visible
  in every mode (`agent-session.js:1073-1078`).
- Resolve the strategy per invocation from the live `ctx`. Never cache it at
  module level or factory time. The only sanctioned process-lifetime state is
  `completion-cache.ts` and `bridges/hooks/routing-state.ts`.
- Add a test per long-lived emitter (async-rewake, settle cap) in which a stale
  `ctx.mode` getter throws, and assert that nothing propagates.

**Warning signs:**
`extension_error` events in the RPC stream after `/new` or `/reload`. The
strategy is resolved in `index.ts` factory scope.

**Phase to address:**
The raw-surfaces / lifecycle phase (async-rewake, settle, device flow). The
mode-selection phase decides where the strategy is resolved.

---

### Pitfall 5: The "unknown mode" typed error is thrown after the mutation committed, or out of a handler that must never throw

**What goes wrong:**
D3 requires an exhaustive switch over `ExtensionMode` with a typed error for any
other value. There are three traps.

1. **Timing.** If the mode is first read inside `notify()`, the typed error
   fires after `withLockedStateTransaction` has saved `state.json`. The install
   succeeded, but the command reports a thrown error. The user retries, and the
   retry hits `already installed`.
2. **Lifecycle handlers.** Reached from `resources_discover`, the error is caught
   by the existing NFR-2 wrapper (`index.ts:114-135`). But that wrapper's fallback
   calls `makeRawNotifyFn(ctx)`, which re-reads the mode and throws again. Only
   the inner catch saves it, so all output is lost silently into `hookDebugLog`.
3. **Lint and coverage conflict.** `eslint.config.js:55-61` sets
   `@typescript-eslint/switch-exhaustiveness-check` with
   `allowDefaultCaseForExhaustiveSwitch: false`. A `default: throw` arm on an
   exhaustive `ExtensionMode` switch is a lint **error**. A throw after the switch
   is unreachable under the type, but the 100% branch threshold
   (`test:coverage:unit`) still needs it covered. The obvious test forges the
   mode with `as unknown as`, which is exactly what the unit-test anti-pattern
   rules discourage (see the `compiler-forced-unreachable-branches` memory; no
   pragma is allowed under D-116-01a).

**Why it happens:**
The mode is ambient on every `ctx`, so it gets read wherever it is first needed.
"Exhaustive switch plus typed error" reads naturally as `default: throw`.

**How to avoid:**
- Parse the mode once, at the start of the invocation and before any side
  effect. Use a function like `parseExtensionMode(value: unknown): ExtensionMode`
  that checks membership against a `Set`. It throws the typed error on an unknown
  string, so a plain string literal reaches that branch in a test, with no cast.
  Then switch exhaustively over the parsed union, with no `default`.
- Command handlers validate the mode in the edge handler, before calling the
  orchestrator. Lifecycle handlers (`resources_discover`, `session_start`, hook
  dispatch) catch the typed error and log it, and never rethrow. The fallback
  path must not depend on the mode it just failed to parse.
- Import `ExtensionMode` from the peer through `platform/pi-api.ts` rather than
  hand-mirroring the union. Then a peer upgrade that adds a mode becomes a compile
  error at the switch (wanted), and an older build under a newer Pi hits the
  runtime typed error (D3).

**Warning signs:**
The first `ctx.mode` read is in `shared/notification-dispatch.ts`. The typed-error
test uses `as unknown as ExtensionMode`. A `// eslint-disable` sits next to a
switch default.

**Phase to address:**
The mode-selection phase. Its success criteria should include "the typed error is
raised before any state mutation" (an ordering assertion, not an end-state one).

---

### Pitfall 6: Implicit mode fallbacks in fakes and in production hide missing plumbing

**What goes wrong:**
39 test files build a `{ ui: { notify } }` fake. Nine cast to `ExtensionContext`
with `as unknown as`, which compiles whatever fields are missing. The e2e
`makeCtx` (`tests/e2e/_helpers.ts:85`) has no `mode`. When the parse/switch lands,
every fake without `mode` starts failing at once. Two tempting "fixes" each undo
D7:

- `ctx.mode ?? "tui"` in production. That also hides real plumbing gaps. For
  example, Pi's own runner defaults to `"print"` when `setUIContext` is called
  without a mode (`runner.js:296-298`).
- A helper default such as `makeCtx(cwd, mode = "tui")`. Every existing call site
  then silently tests only text, and the JSON path of each verb has no test.

A generic JSON converter also reaches 100% line coverage from a single test. So
the coverage threshold cannot show that each verb's payload was ever converted.

**Why it happens:**
The churn is large (about 90 `NotificationContext` references in `extensions/`,
59 files in the notify family), and a default parameter is the smallest diff.

**How to avoid:**
- Declare `mode` **required** on the widened `NotificationContext` in
  `platform/pi-api.ts`, so a missing field is a compile error. Test helpers take
  `mode` as a required parameter.
- Add per-verb JSON conformance cases driven by the existing catalog fixtures (the
  20 fixture maps in `catalog-contract.test.ts`). Every fixture goes through the
  JSON strategy and is validated against the wire schema, so every catalog state
  has a JSON twin. Reuse the fixtures; do not copy them (see Pitfall 11 on dupes).
- Add a planted control: a fixture whose model omits a required field must fail
  schema validation. Otherwise a permissive schema makes the conformance suite a
  green run that checked nothing.

**Warning signs:**
`?? "tui"` or `?? "print"` anywhere under `extensions/`. A `mode = ` default in a
test helper. JSON conformance tests that pass after the converter body is replaced
with `return {}`.

**Phase to address:**
The mode-plumbing phase (required field, fakes). The JSON-strategy phase adds the
conformance and control cases.

---

### Pitfall 7: Wire-schema versioning without a compatibility policy, and closed sets that grow silently

**What goes wrong:**
`schemaVersion` exists (D1), but nothing says what bumps it. The vocabularies are
closed sets that grow regularly. `Reason` gained `stale workflow command`,
`requires pi-dynamic-workflows` and `components now supported` in the last two
milestones (`notification-types.ts`). For text, an added token is additive. For a
JSON consumer that validates enums strictly, an added token is a breaking change.
There are two failure directions:

- **Silent omission (the `optional-field-silent-omission` class).** The row
  fields are mostly optional (`reasons?`, `scope?`, `partialHint?`,
  `enableHint?`, `description?`). A converter that picks fields by name compiles
  clean when a new optional field is added, and the JSON drops it. This shape
  shipped three times in the workflows milestone.
- **Silent inclusion.** A converter that spreads the row (`{ ...row }`) emits
  any new member, including presentation-only fields (`label`, `cardinality`) and
  non-serializable ones (`cause: Error` becomes `{}`).

`notify-closed-set-locks.test.ts` and `compat-01-no-expansion.test.ts` pin the
TypeScript unions. A second enumeration of the same tokens as typebox
`Type.Literal` unions is a fifth copy that neither gate reads.

**Why it happens:**
The text renderer tolerates additive change by construction, so the project has
never needed a compatibility policy.

**How to avoid:**
- Write the policy into the schema reference doc before the first release. For
  example: additive enum members and new optional fields keep `schemaVersion`;
  consumers MUST ignore unknown tokens and fields; removing or renaming a token or
  field, or changing a type, bumps it. Make the closed-set lock tests also require
  a schema-reference entry when a member is added (the deliberate-bump tripwire,
  extended).
- Derive the TypeScript vocabulary from the typebox schema, or prove
  bidirectional equality with a `Record<Reason, true>`-style enrollment against
  the schema's literal list. Do not keep two independent lists.
- Build the JSON converter as a total map (`satisfies Record<Status, ...>`) that
  names every field explicitly. Pin each row type's key set with a compile-time
  proof, so adding a member to a row interface is a type error at the converter.
- Use the catalog tokens verbatim on the wire (`"manual recovery"`,
  `"will install"`), not a re-cased second vocabulary. A second spelling is a
  permanent translation table that drifts.
- **typebox specifics.** (a) `Type.Object` admits extra properties by default.
  Set `additionalProperties: false` on every wire object in the schema used by
  tests, or a leaked field (a stray `cause`, a presentation flag) validates
  green. (b) The current model has unions whose discriminant is optional:
  `CascadeNotificationMessage.kind?: "cascade"` (dispatch treats `undefined` as
  cascade) and `MpList.status?: undefined`. Give every wire union a required
  literal tag. An untagged `Type.Union` validates by trying each arm, and its
  errors do not say which arm was meant. (c) Make the converter's return type
  `Static<typeof WireSchema>`, so schema and code cannot drift at compile time.
  Also run `Compile(...).Check` on every conformance fixture, so runtime-only
  constraints (formats, `additionalProperties`) are exercised. Under
  `exactOptionalPropertyTypes`, the converter must omit absent keys and not
  assign `undefined`.

**Warning signs:**
The converter uses object spread. The schema file has its own `Type.Literal`
list, and no test compares it to `Reason`. A PR adds a reason token and does not
touch the schema docs.

**Phase to address:**
The JSON-strategy / schema phase. The docs phase publishes the policy.

---

### Pitfall 8: Presentation decisions leak into the wire as English strings that become de-facto API

**What goes wrong:**
D1 says the model computes "severity, reload-needed, tally, summary line". If the
model carries **rendered strings**, JSON consumers start parsing English: the
summary line (`N plugin operations failed.`, the grammar pinned by
`notify-grammar-invariant.test.ts`), the `/reload to pick up changes` trailer
(`RELOAD_HINT_TRAILER`), `UPDATE_NO_OP_HEADLINE`, the cascade `label`, the
usage block, the `notifyDiagnostic` header, and the device-flow sentence. After
that, any wording fix in `docs/output-catalog.md` is a breaking JSON change.
Glyphs (`●○⊘◌◉◍⊖`) and indent-carrying rows are worse: they make the text
grammar part of the JSON contract. There is also already a third structured
projection: the LLM tool `details` in `edge/handlers/tools.ts`, which maps
`upgradable` to `[installed]`. A JSON payload that says `upgradable` for the same
plugin contradicts it.

**Why it happens:**
The fastest way to reach "total coverage" (D2) is to wrap each existing string in
`{ message: string }`.

**How to avoid:**
- The model carries decisions and counts: `reloadNeeded: boolean`,
  `summary: { failed, skipped, subject }`, `tally: { verb, count }` as a
  machine-readable verb id, and `hints: ["partial" | "enable"]`. The text
  converter owns every English word and glyph.
- Mark the free-text fields that have to remain free text (`advisories`,
  `notes`, usage text, diagnostic lines, `rewakeSummary`) as "human text,
  unstable" in the schema doc, in a separate property family.
- Record, as a decision, whether the tool-surface projection
  (`edge/handlers/tools.ts`) stays independent or is aligned. Otherwise the two
  structured surfaces will be found to disagree in review.

**Warning signs:**
Schema properties named `text`, `line`, `rendered` or `message` on structured
rows. A JSON golden file that contains `●`.

**Phase to address:**
The model-extraction phase (decisions, not strings). The JSON-strategy phase
(schema shape).

---

### Pitfall 9: Gates that grep named files break when the notification modules split

**What goes wrong:**
Many architecture gates name the exact files this milestone will split:

- `notification-dispatch.ts`: `NO_CONSOLE_EXEMPT_TARGETS`
  (`gate-targets.ts:223-227`), the ESLint per-file override
  (`eslint.config.js:152-165`), and direct imports in `hooks-cap-notify`,
  `notify-grammar-invariant`, `notify-will-reload-agreement`,
  `cross-surface-reason-parity` and `workflows-marker-coverage`
- `notification-grammar.ts`: `COMPAT_NO_EXPANSION_TARGETS`, which reads glyph
  code points
- `notification-types.ts`: `SCOPE_FENCE_TARGETS`, and COMPAT-01, which reads
  declaration order "as data"
- `*.messaging.ts`: `sonar.cpd.exclusions` in `sonar-project.properties:93`, and
  the no-orchestrator-network `FORBIDDEN_TARGETS`
- `docs/messaging-style-guide.md`: `messaging-guide-doc-pins.test.ts` derives the
  allowed variant set from the types and compares it to the guide

Moving a function breaks 2-3 gates at once. The fixes that are tempting under
time pressure all weaken the gates. D-07-03 requires a missing target to FAIL, so
at least the gates go red rather than green over nothing.

`no-probe-in-workflows-bridge.test.ts` is a special case. If the soft-dep marker
derivation (now "in the model") is called from any `bridges/workflows/` file, the
capability ban fires. That is correct, but it shows the model builder must live
above the bridges.

**Why it happens:**
The gates are deliberately path-anchored (D-07-05) so that they cannot pass
vacuously. The cost is that every relocation is a gate edit.

**How to avoid:**
- Before each extraction plan, run `fallow dead-code --symbol-impact` and grep
  `tests/architecture/` for the file name. Put the list of gates to re-point in
  the plan, with the new target named. Do not discover them at `npm run check`.
- Where a gate states a claim ("the sole sanctioned user-visible output
  surface"), change the claim to match the new structure, for example "the two
  sinks: `ctx.ui.notify` and `pi.appendEntry`". Do not quietly re-point it at one
  of them.
- Keep the text strategy's grammar in a file the COMPAT-01 group can name, and
  update that group in the same commit as the move.

**Warning signs:**
A plan that moves `composeReasons` or `softDepStatus` and lists no gate files. An
architecture test edited only to change a path string, with no change to the
claim it states.

**Phase to address:**
Every extraction plan. Put the gate inventory in the model-extraction phase's
research.

---

### Pitfall 10: `lint:type-members` pins, JSON serialization, and newly declared-but-unread members

**What goes wrong:**
There are three separate traps in `scripts/check-unused-type-members.*`:

1. **Coordinate drift.** About 25 contract pins sit in files this milestone
   rewrites: every `*.messaging.ts`, `notification-dispatch.ts:216`,
   `notification-grammar.ts:838,1562`, `notification-summary.ts:41`,
   `notification-types.ts:459`, `notify-context.ts:66,283,346`,
   `reconcile/notify.ts:694,790`, and `platform/pi-api.ts:100-124`. Any edit
   above a pin moves its `line:col`. The gate then refuses with exit 2, and
   empty stdout is possible (memory: `contracts-json-line-pinned`). Prettier
   reflow moves pins too (memory: `prettier-invalidates-type-member-pins`).
2. **JSON serialization counts as a read of every member.** The gate settles
   `JSON.stringify` as a whole-object read (`docs/unused-type-member-gate.md`,
   "What counts as a read"). Once the JSON converter serializes model objects,
   every model member reads as `runtime-observed`, and the gate can no longer
   find dead model fields. With a replacer function or a `toJSON` member, the
   serialized keys become `unsupported-analysis`, which **fails the gate and
   cannot be excused**.
3. **Declared before read.** Adding `mode` and `appendEntry` to
   `NotificationContext` / `ToolInventory` in `platform/pi-api.ts` before the
   strategy reads them gives an `unread` finding. The peer-mirror entries also
   carry `upstream` coordinates into `node_modules/.../types.d.ts`, which move on
   any peer bump.

**Why it happens:**
The gate is whole-program and exact. The JSON converter is precisely the
whole-object read the gate treats as a credit.

**How to avoid:**
- Serialize an explicitly built plain object (the total-map converter from
  Pitfall 7), never the model object itself, and never with a replacer. Then the
  model's own members are credited only by real reads.
- Land each new interface member in the same commit as its first reader.
- Run Prettier, then `lint:type-members`, then re-pin by shifting the line only,
  as the last step of every plan that touches these files. Budget about 85 seconds
  per run, and seven minutes for `:negative`.
- If the payload crosses to Pi (`appendEntry` data), consider the
  `external-output` contract category for members that exist only to be read by
  the consumer.

**Warning signs:**
The gate exits 2 with no findings listed. `JSON.stringify(model, (k, v) => ...)`
in the converter. A new `readonly mode` member with no reader in the same diff.

**Phase to address:**
Every phase touching `shared/notif*` or `platform/pi-api.ts`. The rule "no
replacer, serialize a built DTO" belongs in the JSON-strategy phase.

---

### Pitfall 11: Complexity, dead-code, duplication, zone and coverage gates bite parallel converters

**What goes wrong:**

- **Complexity.** A JSON converter written as a `switch` over the 19
  `PluginStatus` values plus 8 marketplace arms plus 8 message kinds exceeds
  fallow `maxCyclomatic: 20` and `maxCognitive: 15` (`.fallowrc.json`). ESLint
  `sonarjs/cognitive-complexity: 15` is scored independently, and the two tools
  disagree. The text side already avoids this with per-status render maps.
- **Duplication.** Current duplication is 1.41% (measured: 1,327 duplicated
  lines) against `duplicates.threshold: 3`. Headroom is about 1,500 lines
  repo-wide, tests included. Two mirrored converters, or JSON test fixtures
  copied from the catalog fixtures, can use it up. SonarCloud CPD scores new code
  separately, and the existing `sonar.cpd.exclusions` names `*.messaging.ts`
  paths that may be renamed.
- **Dead code in the middle.** Migrating verb by verb leaves the legacy
  `notify()` central switches (`notification-dispatch.ts`, "keeps serving
  not-yet-migrated call sites", `notify-context.ts` header) and the render maps
  half-used. Fallow in production dead-code mode fails as soon as an export's last
  reader moves. The escape (`fallow-ignore`) is counted: CONVENTIONS records
  exactly 11 markers.
- **Zones.** A new top-level directory such as `extensions/.../presentation/` is
  in none of the 14 fallow zones and none of the 8 ESLint `ZONE_FOLDER_TARGETS`.
  An unzoned folder escapes the boundary matrix without any error.
  `shared/` may import only `platform/`, so a model in `shared/` that needs
  domain types (`Dependency`, `HookSummaryEntry` are already in
  `shared/concerns/`) must stay in the leaf layer or move up. Cycles between
  new `shared/` model files and `notification-*.ts` are caught only by the fallow
  circular-deps run (ESLint `import-x/no-cycle` was removed).
- **Coverage.** `test:coverage:unit` enforces 100% lines, functions and branches
  on `extensions/**`. The corresponding-test gate requires a mirrored owner test
  per new module, and `unowned-exports-census` (empty record) rejects exports
  read only by tests. A converter helper exported "for testing" fails.

**Why it happens:**
Each gate is reasonable on its own. A two-strategy design doubles the surface
every gate measures.

**How to avoid:**
- Use total `Record<Status, fn>` maps for both converters, so complexity is per
  arm. Keep the two converters structurally unlike (the JSON arm builds an
  object, the text arm composes tokens) so CPD has nothing to match.
- Drive JSON conformance from the existing catalog fixtures (import them; do not
  copy them).
- Migrate through the dispatch seam: the model is introduced **under** the
  existing `notify` / `notifyWithContext` signatures. Callers stay unchanged
  until one sweep retires the old paths within a single phase. No intermediate
  commit leaves an export with no reader.
- If a new folder is created, add its zone to `.fallowrc.json`, to the ESLint
  zones and to the expected matrix in `import-boundaries.test.ts` in the same
  commit, with a planted cross-zone import proving the rule fires.

**Warning signs:**
`fallow dupes` percentage rises by more than 0.3 points in one plan. Check the
exit code, not the red glyph (memory: `fallow-dupes-red-glyph-green-exit`). A
`fallow-ignore` count above 11. A new directory that no test names.

**Phase to address:**
The model-extraction phase (seam strategy, zones). The JSON-strategy phase
(converter shape, dupes budget).

---

### Pitfall 12: New sink without a matching ban leaves `appendEntry` open to every producer

**What goes wrong:**
The IL-2 enforcement bans the `ctx.ui.notify` call shape outside the dispatch
file (`eslint.config.js:141-143`) and bans `process.stdout.*` / `process.stderr.*`
in `rule-packs/architecture.json`. Nothing bans `pi.appendEntry`. After this
milestone, any orchestrator or bridge can call `pi.appendEntry("claude-plugin", ...)`
directly. That bypasses the model, the redaction and the schema. It is the exact
bypass the notify ban exists to prevent. The existing notify selector matches
only the `X.ui.notify(...)` member-call shape, so `const { notify } = ctx.ui`
already slips past it. The new ban should not copy that gap.

**Why it happens:**
D8 amends IL-2 in prose. The enforcement is a separate artifact that has to be
amended too, and both lint messages still say "Use ctx.ui.notify via
shared/notification-dispatch.ts wrappers".

**How to avoid:**
- Add a `no-restricted-syntax` selector for `CallExpression[callee.property.name='appendEntry']`
  with a single-file exemption for the JSON sink. Add a planted-violation test in
  `tests/architecture/`: a gate is proved by planting, not by re-reading the
  config (CONVENTIONS).
- Update both lint messages, the rule-pack message and AGENTS.md's Output channel
  line in the same change (D8 already flags AGENTS.md).

**Warning signs:**
`grep -rn appendEntry extensions/` returns more than one file.

**Phase to address:**
The JSON-strategy phase.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|---|---|---|---|
| Wrap each existing string as `{ message }` for "total coverage" | D2 done in a day | JSON is text in quotes; wording fixes break consumers; no structured tests possible | Only for the fields that ARE human text (usage, advisories, rewake summary), and marked unstable |
| `ctx.mode ?? "tui"` / defaulted fake `mode` | Existing tests pass unchanged | Hides missing plumbing; JSON path of each verb untested; contradicts D7 | Never |
| `JSON.stringify(model)` instead of building a DTO | No converter code | Leaks presentation-only fields and `Error` as `{}`; neutralizes the type-member gate | Never |
| Keep the render-time `softDepStatus(pi)` probe alongside the new model-time probe | Smaller diff | Two probes can disagree; the text keeps a render-time decision D1 removed | Only within one plan, never across a phase boundary |
| Timer-deferred `appendEntry` to beat Pi's subscribe | Startup reconcile appears on stdout | Race on Pi internals; breaks on patch releases | Never |
| Hand-written typebox literal list beside the TS `Reason` union | Quick schema | Fifth unguarded copy of the vocabulary | Never, unless a bidirectional enrollment proof ties them |
| Verb-by-verb migration with temporary `fallow-ignore` | Small PRs | Suppression count drifts; half-migrated state lingers | Only if each marker is removed in the same phase and the count returns to 11 |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|---|---|---|
| Pi `--mode json` / RPC writers | Assume every `entry_appended` reaches stdout | Bind-then-subscribe ordering drops startup/replacement-time entries; decide and document (Pitfall 1) |
| Pi session persistence | Assume "saved to the session file" always | Entries flush to disk only after the first assistant message (`_persist`); `--no-session` keeps them in memory; `-p "/claude:plugin list"` usually writes nothing |
| Pi session tree | Treat custom entries as side-channel | `appendCustomEntry` sets `parentId: leafId` and advances `leafId` (`session-manager.js:855-866,770-775`); every payload is a tree node visible in `/tree`, forks and HTML export |
| RPC clients | Assume they read `extension_ui_request` notify | In `rpc` mode (D3) they receive no notify strings from `/claude:plugin`; they must handle `entry_appended` with `customType: "claude-plugin"`. CHANGELOG-worthy |
| Pi exit status | Script consumers test `$?` | Pi exits 0 in print/json regardless (D5); only payload severity tells success. Command-handler throws go to Pi's `emitError` (stderr in print, `extension_error` in RPC) |
| Device flow in `print` mode | Assume a silent failure | Print mode is silent (D5), so the user code is never shown and the flow polls until the code expires. **Needs decision**: fail fast with a typed error when auth is needed in `print` |
| `entry_appended` contract | Rely on it as documented API | Declared only in `agent-session.d.ts:57`; absent from Pi docs and CHANGELOG. Pin it in `peer-floor.test.ts` and a real-Pi e2e case |
| Existing `notifications.mode` option | Name the new concept `mode` too | `opts.notifications?.mode === "orchestrated"` already exists in 7 orchestrators (`install-flow.ts:660`, `uninstall.ts:645`, ...). Name the new one `extensionMode`/`strategy`; orchestrated sub-ops must still emit exactly once, at the cascade owner |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|---|---|---|---|
| Full `list` payload per invocation in a persisted RPC session | Session JSONL grows by tens of KB per `list`; slower resume (whole file parsed into `fileEntries`) | Lean DTO: no rendered strings, no duplicated rows, no stacks; untruncated descriptions only once | Inferred: official marketplace has ~180+ plugins, so an estimated 40-80 KB per `list`; noticeable after dozens of lists in one session |
| Synchronous `appendFileSync` per entry once flushed | Hook-driven emissions (async-rewake summary, stop cap) add sync I/O on the turn path | One entry per invocation; diagnostics folded into the same payload where the model allows | Many hook events per turn |
| Two probes per invocation (model + leftover render probe) | Double `pi.getAllTools()` walk | Probe once in the model | Negligible cost; the correctness risk (Pitfall 2) matters more |

## Security Mistakes

| Mistake | Risk | Prevention |
|---|---|---|
| Persisting unredacted cause chains / raw error messages | Home directory and repo layout disclosed in shared session files, exports and bug reports | Redact at the model boundary; whole-payload absolute-path walk test (Pitfall 3) |
| Persisting `url:` sources with userinfo | Token written to session JSONL and HTML export | Strip URL userinfo in the model for all URL fields (**needs decision**: text parity, since text shows it today) |
| Serializing `Error.stack` | Absolute `node_modules` and home paths | Causes are projected string arrays; schema has no `unknown` slot |
| Raw control characters in untrusted fields | Terminal injection in consumers that print JSON fields | Strip C0/C1 in the JSON converter, or document fields as untrusted |
| JSON sink not in AUTH-09 targets | A future change interpolates a credential into a payload unseen | Add the sink to `CREDENTIAL_LEAK_TARGETS` |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---|---|---|
| Several entries per invocation with no correlation | Consumer cannot group the cascade, `notifyDiagnostic` and device-flow entries of one command | Each payload names its command/verb and an invocation discriminator; one terminal payload per invocation |
| A path that emits nothing in JSON (for example standalone mode swallowing post-commit warnings, D-19-01) | Consumer cannot tell "succeeded quietly" from "never ran" | Every command invocation emits exactly one terminal payload; assert it per verb |
| Browse typed error thrown to Pi in json/rpc | Arrives as `extension_error`, not a schema payload | Emit the D6 error through the JSON strategy as a usage-class payload; throw only when no strategy exists (unknown mode) |
| Summary/tally only as English | Consumers regex the text | Structured counts (Pitfall 8) |

## "Looks Done But Isn't" Checklist

- [ ] **Model extraction:** `git diff` on `docs/output-catalog.md` is empty for the whole phase, and the wire corpus diff (every emitted `(message, severity)` across unit and integration) is empty. Verify both, not just the catalog.
- [ ] **Soft-dep markers:** per-verb suppression (disabled, uninstalled, mp headers) is data in the model. Verify that `workflows-marker-coverage` still scans the live derivation site and was not deleted.
- [ ] **JSON strategy:** every one of the 205 catalog fixtures converts and validates. A planted invalid fixture fails. Replacing the converter body with `return {}` turns the suite red.
- [ ] **Redaction:** a whole-payload walk finds no absolute path in any fixture's JSON, and no `Error` survives into a payload.
- [ ] **Raw surfaces (D2):** all six raw functions (`notifyUsageError`, `notifyUsageInfo`, `notifyDiagnostic`, `makeRawNotifyFn`, `notifyAsyncRewakeSummary`, `notifyStopHookOverrideCap`) plus the two `index.ts` lifecycle strings have a JSON test in `json` mode and a byte test in `tui` mode.
- [ ] **Mode:** the typed-error test uses an unknown plain string (no cast), and an ordering assertion shows no state write happens first.
- [ ] **Lifecycle:** a stale `ctx.mode` getter or throwing `appendEntry` in `resources_discover`, `session_start`, async-rewake and settle propagates nothing.
- [ ] **Gates:** a planted `pi.appendEntry` outside the sink fails lint. `NO_CONSOLE_EXEMPT_TARGETS`, COMPAT-01 and SCOPE_FENCE targets name the files that now hold the claims.
- [ ] **Type-members:** `lint:type-members` exits 0 (not 2) after Prettier. No replacer or `toJSON` in the converter.
- [ ] **Real Pi:** `pi -p --mode json --no-session --offline "/claude:plugin list"` produces exactly one `entry_appended` with `customType: "claude-plugin"`, and the startup-reconcile behavior matches the documented decision.
- [ ] **Docs:** the schema reference states the compatibility policy, the print-mode silence, the RPC notify change and the lifecycle-time gap. AGENTS.md IL-2 is amended.

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---|---|---|
| Text drift discovered after extraction | MEDIUM | Diff the wire corpus against the baseline to find the verb and status, restore the per-verb fact in the model, and add the missing corpus case to the owning `*.messaging` test |
| Secrets or paths already persisted in users' session files | HIGH (cannot be recalled) | Fix redaction, bump `schemaVersion` if a field is removed, and publish a CHANGELOG advisory telling users to review exported sessions |
| Type-member gate exit 2 after a merge or format | LOW | Prettier first, then re-derive pins by line shift from the gate's own report (never transcribe old coordinates) |
| Wire schema shipped without a compat policy | MEDIUM | Declare the policy retroactively at the current `schemaVersion`, and treat the next non-additive change as a bump |
| Half-migrated surfaces failing dead-code | LOW-MEDIUM | Finish the sweep in one plan, or reintroduce the old signature as a thin adapter over the model until the sweep lands |

## Pitfall-to-Phase Mapping

Stage names are topical. The roadmapper assigns numbers.

| Pitfall | Prevention Stage | Verification |
|---|---|---|
| 1 Bind-then-subscribe loss | JSON transport (decide), e2e (pin) | Real-Pi `--mode json` case with pending reconcile; documented outcome |
| 2 Text byte drift | Characterization baseline, then model extraction | Empty catalog diff and empty wire-corpus diff |
| 3 Persisted leaks | Model extraction (causes, redaction), JSON strategy (walk test, AUTH-09), raw surfaces (device flow) | Absolute-path walk test; AUTH-09 names the sink |
| 4 New throw sites | Raw surfaces / lifecycle | Stale-ctx tests for async-rewake and settle |
| 5 Unknown-mode timing and lint | Mode selection | No-cast typed-error test; ordering assertion before mutation |
| 6 Implicit fallbacks | Mode plumbing (first), JSON strategy | Required `mode`; grep finds no `??` fallback; per-fixture JSON conformance with planted control |
| 7 Schema versioning and closed sets | JSON schema, docs | Enrollment proof between schema literals and TS unions; policy doc exists |
| 8 English as API | Model extraction, JSON schema | Schema has no rendered-text properties on structured rows |
| 9 Named-file gates | Every extraction plan | Plan lists the gates it re-points; each claim restated |
| 10 Type-member pins and JSON reads | Every plan touching `shared/notif*` / `pi-api.ts`; JSON strategy | Gate exits 0; no replacer; member lands with its reader |
| 11 Complexity, dupes, dead code, zones, coverage | Model extraction, JSON strategy | Fallow exit 0; dupes delta measured; zones added with planted control |
| 12 Unbanned sink | JSON strategy | Planted `appendEntry` violation fails lint |

## Sources

- Pi 0.86.1 installed dist (primary source, HIGH):
  `dist/core/agent-session.js:2005-2036,2131-2136,1073-1078`;
  `dist/core/session-manager.js:740-775,855-866`;
  `dist/core/extensions/loader.js:106-145,288-290`;
  `dist/core/extensions/runner.js:114-130,296-298,423-432,535-545`;
  `dist/core/extensions/types.d.ts:209-214,991`;
  `dist/modes/print-mode.js`; `dist/modes/rpc/rpc-mode.js:84-100,225-273`;
  `dist/core/export-html/template.js`; `dist/core/bug-report.js:152-200`;
  `CHANGELOG.md` (no `entry_appended` entry; `ctx.mode` added around line 1347)
- Repo at `ab3d9c31` (HIGH): `shared/notification-dispatch.ts`,
  `shared/notification-types.ts`, `shared/notification-grammar.ts`,
  `shared/notify-context.ts`, `shared/redact-absolute-paths.ts`,
  `shared/errors.ts`, `platform/pi-api.ts`, `index.ts`,
  `orchestrators/plugin/{install,enable-disable,list,uninstall}.messaging.ts`,
  `edge/handlers/tools.ts`, `domain/github-auth.ts:436`,
  `bridges/hooks/{settle.ts,async-rewake/registry.ts}`, `eslint.config.js`,
  `.fallowrc.json`, `rule-packs/architecture.json`, `sonar-project.properties`,
  `tests/architecture/{gate-targets.ts,catalog-uat/catalog-contract.test.ts,compat-01-no-expansion,notify-*,no-probe-in-workflows-bridge,workflows-marker-coverage,no-credential-leak,no-test-only-production-surface}.test.ts`,
  `docs/unused-type-member-gate.md`, `scripts/check-unused-type-members.contracts.json`
- Measured: `fallow dupes` = 1.41% (1,327 lines) against threshold 3
- Project memory and retrospectives (MEDIUM, lessons not re-measured here):
  optional-field silent omission, compiler-forced unreachable branches,
  source-walk gates follow code, green runs that checked nothing, type-member
  pins and Prettier, hub splits dropping sequence assertions,
  `.planning/RETROSPECTIVE.md` (v1.18 characterize-first, v1.14 hand-mirrored
  classifiers)
- typebox 1.3.31 behavior (MEDIUM): `Type.Object` admits additional properties
  unless `additionalProperties: false`; union errors do not name the
  discriminant, so give every union a literal `kind`/`status` tag; `Static`
  optional fields interact with `exactOptionalPropertyTypes` (converters must
  omit keys, not assign `undefined`)

---
*Pitfalls research for: json-output (mode-keyed presentation strategies)*
*Researched: 2026-09-28*
