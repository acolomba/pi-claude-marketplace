# Requirements Archive: json-output Mode-Keyed Presentation Strategies

**Archived:** 2026-10-11
**Status:** SHIPPED

For current requirements, see `.planning/REQUIREMENTS.md`.

---

# Requirements: json-output -- Mode-Keyed Presentation Strategies

**Defined:** 2026-09-28 on `features/json`
**Core Value:** A Pi user can install a Claude plugin and load each supported
component as a working Pi artifact.

**Milestone goal:** `/claude:plugin` output is produced by one of two
architecturally uniform presentation strategies selected by Pi's `ctx.mode` --
text for `tui` and `print`, JSON for `json` and `rpc` -- both formatting a single
model that already carries every presentation decision.

## Constraints

- Locked decisions D1-D8 (recorded in `.planning/PROJECT.md` Current Milestone
  and `.planning/research/SUMMARY.md`) are not re-opened by any phase.
- Text byte form stays locked by `docs/output-catalog.md`; the only sanctioned
  text change is credential redaction (PMOD-04).
- `npm run check` stays green after every plan (NFR-6), including fallow
  boundaries, the unused-type-member gate, and 100% coverage thresholds.
- Research: `.planning/research/` (STACK, FEATURES, ARCHITECTURE, PITFALLS,
  SUMMARY). Pi facts are verified against the pinned 0.86.1.

## v1 Requirements

### Presentation Model

- [x] **PMOD-01**: Every presentation decision -- severity, `needsReload`,
  tally, summary line, composed reasons including `{requires ...}` soft-dep
  markers, and hints -- is computed in one model step upstream of rendering;
  neither strategy probes state or walks `Error` objects. The render-time
  `softDepStatus` probe leaves `shared/notification-dispatch.ts`, and one probe
  per invocation is shared with severity computation.
- [x] **PMOD-02**: Per-verb rendering differences are expressed as model data
  (row policies) instead of the `CommandContext` render callbacks in
  orchestrators' `*.messaging.ts`; every known per-command divergence is
  preserved.
- [x] **PMOD-03**: Failure detail is carried as a serialized, redacted cause
  chain (`causeChain: string[]` with a `truncated` flag, plus per-phase rollback
  entries), never as a live `Error`.
- [x] **PMOD-04**: Credentials -- URL userinfo and any token -- are absent from
  every presentation, text and JSON; the model redacts them before either
  strategy sees them, and the credential-leak gate (AUTH-09) covers the JSON
  path.
- [x] **PMOD-05**: The `pending` retained-workflow-staging advisory is
  structured model data (`{name, envelopeCount?}`), and the text strategy
  composes its sentence.

### Text Strategy

- [x] **TEXT-01**: Text output in `tui` and `print` is a pure formatter of the
  model and its bytes are unchanged: the `docs/output-catalog.md` diff is empty,
  and a pre-refactor capture of every emitted `(message, severity)` pair across
  the unit and integration suites diffs empty, except for PMOD-04 redaction.

### Wire Schema

- [x] **WIRE-01**: Every JSON payload carries an integer `schemaVersion` and a
  `kind` discriminant from one typebox union that covers every notification
  kind and every raw surface.
- [x] **WIRE-02**: Every payload carries required `severity` (the info /
  warning / error tri-state), `needsReload`, and `origin` (`command` with a
  machine command id, `load`, or `hook`).
- [x] **WIRE-03**: Status, reason, scope, and severity tokens are emitted
  verbatim from the existing closed sets; no second code vocabulary exists.
- [x] **WIRE-04**: Values are raw -- full version strings, ISO timestamps, real
  booleans; install-scoped rows always carry an explicit `scope`; optional
  fields are absent, never `null`; empty collections are `[]`; arrays keep model
  order.
- [x] **WIRE-05**: Payloads carry the model's `summary` line on warning and
  error, a numeric `tally`, and a `noOp` flag on the update no-op cascade.
- [x] **WIRE-06**: Plugin rows carry `id: "<name>@<marketplace>"`.
- [x] **WIRE-07**: Every command-origin payload of one command run carries the
  same `invocationId`, minted by an injectable generator.
- [x] **WIRE-08**: No payload discloses a path the text form does not show
  (NFR-9), proven by a whole-payload walk test.
- [x] **WIRE-09**: A JSON Schema file generated from the typebox source is
  committed and shipped in the npm package, and a test fails when it drifts.

### JSON Strategy and Transport

- [x] **JOUT-01**: In `json` and `rpc` modes, every `/claude:plugin` output is
  emitted through `pi.appendEntry("claude-plugin", payload)` and none through
  `ctx.ui.notify`; `appendEntry` is callable only from the dispatch module,
  enforced by an ESLint rule proven by a planted violation.
- [x] **JOUT-02**: The JSON strategy is a format-only peer of the text strategy:
  every catalog fixture converts and validates against the schema, and a
  planted invalid fixture fails.
- [x] **JOUT-03**: Every command emits all of its payloads before its handler's
  promise settles.
- [x] **JOUT-04**: In `json` and `rpc` modes, an unexpected throw from a command
  handler becomes a typed `internal-error` payload with a redacted cause chain,
  so every command yields at least one payload; `tui` and `print` behavior is
  unchanged.
- [x] **JOUT-05**: Output calls that can newly throw -- `appendEntry` before
  bind, a stale `pi` or `ctx` after `/reload` -- never escape lifecycle or hook
  callbacks (NFR-2).

### Raw-Surface Coverage

- [x] **RAWS-01**: Usage errors and help are typed payloads (`usage-error` with
  message and usage, `usage-info`) for every verb.
- [x] **RAWS-02**: Diagnostics are typed payloads (`diagnostic {header,
  lines[]}`).
- [x] **RAWS-03**: The device-flow prompt is a typed payload carrying
  `verificationUri` and `userCode` as fields; the domain passes the values, not
  a pre-formatted string.
- [x] **RAWS-04**: The load-time "reconcile aborted" and "plugin PATH not
  refreshed" warnings are typed payloads (`reconcile-aborted`,
  `plugin-path-skipped`) -- the two raw surfaces D2's list missed.
- [x] **RAWS-05**: Hook rewake summaries and the Stop-hook override-cap warning
  are typed payloads with `origin: hook`; rewake text passes through as data.

### Mode Selection

- [x] **MODE-01**: The strategy is chosen by an exhaustive switch over
  `ctx.mode`, read at emit time and never cached: `tui` -> text (plus the
  interactive browse strategy), `print` -> text, `json` and `rpc` -> JSON.
- [x] **MODE-02**: Any other mode value raises a typed `UnsupportedModeError`
  from a membership check that runs before any state change; lifecycle handlers
  log it and never rethrow.
- [x] **MODE-03**: `browse` outside `tui` emits an error-severity payload that
  names `list`, replacing the `list` fallback.
- [x] **MODE-04**: In `print` mode, an operation that needs device-flow
  authentication fails fast with a typed error pointing at `--mode json` or
  `tui`, instead of polling until the code expires.

### LLM Tool Surface

- [x] **LLMT-01**: The `details` of both LLM tools (`edge/handlers/tools.ts`)
  use the wire schema's marketplace-block and plugin-row shapes and verbatim
  status tokens (`upgradable` is no longer projected to `[installed]`); the
  tools' line-format text content is unchanged.

### Test Enablement

- [x] **TENB-01**: A JSON capture helper for in-process tests records every
  `appendEntry` payload and validates each one against the schema.
- [x] **TENB-02**: Every test fake of the notification or extension context
  carries an explicit `mode`, required by the type; the `as unknown as
  ExtensionContext` casts that hide a missing `mode` are removed or given one.
- [x] **TENB-03**: A real-Pi e2e test runs
  `pi -p --mode json --no-session --offline "/claude:plugin list"` and asserts a
  schema-valid `claude-plugin` entry on stdout, pinning `entry_appended` at the
  peer floor and pinning that startup-emitted entries are not streamed.

### Documentation

- [x] **JDOC-01**: A schema reference documents kinds, fields, the
  compatibility policy (additive changes -- new optional field, kind, or
  closed-set member -- do not bump `schemaVersion`; removals, renames, type or
  meaning changes do), and the verdict rule (maximum severity over
  command-origin entries), with a `jq` example.
- [x] **JDOC-02**: The documented limitations: print mode is silent (scripts use
  `--mode json`); Pi exits 0 regardless; startup (`session_start` /
  `resources_discover`) entries are not streamed in `json`/`rpc` (RPC clients can
  use `get_entries`); RPC front-ends no longer receive notify text and must
  render `claude-plugin` entries, the device-flow prompt at minimum; a
  slash-command-only run writes no session file until an assistant message
  exists.
- [x] **JDOC-03**: AGENTS.md's IL-2 output-channel line is amended to match
  PROJECT.md (D8), and backlog MRO-01 is closed with its two wrong claims
  corrected.

## Future Requirements

Deferred. Tracked but not in the current roadmap.

- Marketplace `source` on `marketplace list` rows (upstream `marketplace list
  --json` parity; needs an `MpList` model change the text form must ignore).
- Migrating existing test suites to JSON assertions.
- New behavioral suites built on the capture helper.
- Browse TUI polish (separate milestone).

## Out of Scope

| Feature | Reason |
|---------|--------|
| Per-command `--json` flag | D3: selection is by mode only; upstream's flag is on the `claude plugin` shell CLI, not `/plugin` |
| Any stdout/stderr channel for print mode | Pi takes over stdout in non-interactive modes; IL-2 still forbids direct writes (D5, D8) |
| snake_case `failureCode` vocabulary | Doubles the closed-set gates and drifts from `Reason`; tokens are emitted verbatim (WIRE-03) |
| Rendered text embedded in JSON payloads | Reintroduces scraping and breaks the D1 peer architecture |
| Runtime payload validation in production | Adds a throw/drop path inside the NFR-2 boundary; the capture helper validates in tests |
| Pagination and streaming progress frames | No consumer need; one payload per emission is the contract |
| Timer-deferred workaround for startup emissions | Races Pi's lifecycle; the gap is accepted and documented (JDOC-02) |
| RPC dual-emit of notify text | D3 kept as is; the RPC text loss is accepted and documented (JDOC-02) |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| PMOD-01 | Phase 1 | Complete |
| PMOD-02 | Phase 2 | Complete |
| PMOD-03 | Phase 1 | Complete |
| PMOD-04 | Phase 4 | Complete |
| PMOD-05 | Phase 2 | Complete |
| TEXT-01 | Phase 3 | Complete |
| WIRE-01 | Phase 4 | Complete |
| WIRE-02 | Phase 6 | Complete |
| WIRE-03 | Phase 4 | Complete |
| WIRE-04 | Phase 4 | Complete |
| WIRE-05 | Phase 4 | Complete |
| WIRE-06 | Phase 4 | Complete |
| WIRE-07 | Phase 6 | Complete |
| WIRE-08 | Phase 4 | Complete |
| WIRE-09 | Phase 4 | Complete |
| JOUT-01 | Phase 5 | Complete |
| JOUT-02 | Phase 4 | Complete |
| JOUT-03 | Phase 6 | Complete |
| JOUT-04 | Phase 6 | Complete |
| JOUT-05 | Phase 5 | Complete |
| RAWS-01 | Phase 3 | Complete |
| RAWS-02 | Phase 3 | Complete |
| RAWS-03 | Phase 3 | Complete |
| RAWS-04 | Phase 3 | Complete |
| RAWS-05 | Phase 3 | Complete |
| MODE-01 | Phase 5 | Complete |
| MODE-02 | Phase 5 | Complete |
| MODE-03 | Phase 7 | Complete |
| MODE-04 | Phase 7 | Complete |
| LLMT-01 | Phase 4 | Complete |
| TENB-01 | Phase 5 | Complete |
| TENB-02 | Phase 5 | Complete |
| TENB-03 | Phase 7 | Complete |
| JDOC-01 | Phase 7 | Complete |
| JDOC-02 | Phase 7 | Complete |
| JDOC-03 | Phase 7 | Complete |

**Coverage:**
- v1 requirements: 36 total
- Mapped to phases: 36
- Unmapped: 0 ✓

---
*Requirements defined: 2026-09-28*
*Last updated: 2026-09-28 after roadmap creation (7 phases)*
