# Phase 87: Bucket-A admission & platform floor - Context

**Gathered:** 2026-07-29
**Status:** Ready for planning

<domain>
## Phase Boundary

Make `Stop` and `StopFailure` first-class supported hook events at the
resolver/admission layer — the prerequisite plumbing for the Phase 88
dispatcher. `BUCKET_A_EVENTS` grows 8→10 with per-event matcher dispositions
(`Stop`: `null` no-matcher sentinel; `StopFailure`: closed 10-value error-type
set), and the `@earendil-works/pi-coding-agent` peer floor rises
`>=0.74.0` → `>=0.80.4`. A plugin whose `hooks.json` declares `Stop` and/or
`StopFailure` alongside already-supported bucket-A events resolves available
(no `{unsupported hooks}` partition drop for these events) and `plugin info`
lists both as supported. Dispatch is NOT wired in this phase (Phase 88).

Requirements: ADMIT-01, ADMIT-02, FLOOR-01.

</domain>

<decisions>
## Implementation Decisions

### Peer-floor semantics (FLOOR-01)
- **D-87-01:** The floor is **declarative only** — bump
  `package.json` `peerDependencies` `@earendil-works/pi-coding-agent` to
  `>=0.80.4`. No runtime version detection, no load-time probe, no
  environment-conditional admission. The resolver's supportability verdict
  stays static per config bytes (byte-stable list/info outputs across Pi
  versions). Below the floor is off-contract, exactly like every prior floor
  bump (e.g. `parseFrontmatter` at `>=0.74.0`). "Stay unsupported rather than
  degrading" means the floor-bump design was chosen INSTEAD of a
  runtime-degrade path — do not build capability detection.

### Doc surface (FLOOR-01)
- **D-87-02:** **No doc edits in Phase 87.** The user's decision: package.json
  already enforces version dependencies — that is the sufficient user-facing
  declaration surface. Do NOT touch README.md (§ Prerequisites keeps its
  unversioned Pi bullet) and do NOT touch `docs/hooks-compatibility.md` (its
  full Stop/StopFailure reconcile is Phase 89, DOC-04). FLOOR-01's
  "user-facing docs" clause is satisfied by the peer-range declaration itself.

### ADMIT-02 verification
- **D-87-03:** **Unit fixtures, offline.** Restore the Stop arm that was
  deliberately slimmed out of the existing hookify fixture
  (`tests/fixtures/hookify-hooks.json`, derived from real
  claude-plugins-official wire bytes) and add a ralph-wiggum fixture (Stop-only
  `hooks.json`, likewise derived from real wire bytes). Assert at the resolver
  partition level (plugins resolve available, no `{unsupported hooks}` drop for
  these events) and at the `plugin info` supported-events listing. Everything
  runs in `npm run check` — no network. Live resolution against the real
  claude-plugins-official marketplace stays a milestone-audit/UAT concern, not
  a Phase 87 test.

### Research-surfaced decisions (post-discuss, user-confirmed)
- **D-87-04:** **Decouple key domains.** Growing `BUCKET_A_EVENTS` 8→10 breaks
  the typecheck at three production dispatch tables
  (`Record<BucketAEvent>` in `bridges/hooks/dispatch-exec.ts` and
  `bridges/hooks/async-rewake/registry.ts`) that would demand Phase 88's
  translators. Introduce a dispatchable-event subset type (the current 8
  events) as the key domain for the dispatch/rewake tables; the admission
  tuple grows to 10 independently. Phase 87 stays purely admission; Phase 88
  extends the subset + adds translators. — **Reversibility:** reversible —
  Phase 88 folds the subset back up to the full union when translators land.
- **D-87-05:** **Peer floor is `>=0.80.5`, not `>=0.80.4`.** The npm registry
  has no 0.80.4 release (0.80.3 → 0.80.5); `agent_settled` first appears in
  0.80.5 (verified by tarball type-def diff). Update REQUIREMENTS.md FLOOR-01
  and ROADMAP wording to `>=0.80.5` during planning; the authority doc's
  0.80.4 misattribution is corrected in Phase 89's doc reconcile.
- **D-87-06:** **`docs/output-catalog.md` Stop-as-unsupported example defers
  to Phase 89** — UNLESS the catalog-UAT byte-equality runner or any
  `npm run check` test breaks in Phase 87 because of it, in which case the
  minimal lockstep edit lands in 87 (NFR-6 checks-green wins over the
  D-87-02 doc freeze). Test code (as opposed to docs) that uses Stop as the
  canonical non-bucket-A example is re-pointed in 87 to a still-deferred
  event (e.g. `Notification`).

### Claude's Discretion
- Tuple placement of the two new events in `BUCKET_A_EVENTS` (append vs
  lifecycle order) — order is a deterministic registration order for
  downstream consumers; pick and document.
- `ClaudeHookEvent` lockstep widening in
  `extensions/pi-claude-marketplace/shared/concerns/hooks.ts` (the
  `satisfies readonly ClaudeHookEvent[]` pin forces it at compile time).
- Doc-comment updates in `hook-events.ts` (the "eight v1.13-supported" prose,
  the per-event derivation notes for the two new dispositions) and any other
  stale "8 events" comment the widening touches.
- ralph-wiggum fixture derivation details (fetch real bytes vs transcribe from
  the marketplace repo — match how the hookify fixture was produced).
- Whether `StopFailure`'s closed-set values need pipe-OR (`|`) splitting at the
  existing non-tool matcher validation seam — verify how the SessionStart
  closed-set check tokenizes matchers and keep StopFailure consistent
  (SFAIL-03's charset: letters, digits, `_`, `|`).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Authority analysis (issue #103)
- `docs/research/issue-103-stop-stopfailure-promotion.md` — session-verified
  feasibility analysis: dispatcher design, matcher dispositions (§ Dispatcher
  design: Stop `null`-sentinel drop, StopFailure 10-value closed set), peer
  floor rationale (`agent_settled` added in 0.80.4), marketplace effect
  (ralph-wiggum + hookify flip). THE design authority for this milestone.
- `.planning/REQUIREMENTS.md` — ADMIT-01, ADMIT-02, FLOOR-01 (Phase 87 rows);
  SFAIL-03 defines the 10-value vocabulary the StopFailure closed set encodes.

### v1.13 taxonomy (superseded rows noted)
- `docs/research/claude-hooks-vs-pi-events.md` — bucket taxonomy; its
  Stop/StopFailure rows are superseded by the issue-103 doc (do not follow
  them; Phase 89 retires them).
- `docs/research/claude-hook-config-syntax.md` — Claude hook config field
  reference from v1.13.

### Upstream contract
- <https://code.claude.com/docs/en/hooks> — Stop/StopFailure contract,
  verified 2026-07-28 (matcher vocabularies, no-matcher-support for Stop).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `extensions/pi-claude-marketplace/domain/components/hook-events.ts` — the
  entire change surface for ADMIT-01: `BUCKET_A_EVENTS` tuple (ordered,
  deterministic registration order), `TOOL_EVENTS`,
  `NonToolEvent = Exclude<BucketAEvent, ToolEvent>`, `NON_TOOL_EVENT_FIELDS`
  (TOTAL over NonToolEvent — a new non-tool event without a disposition is a
  compile error at the table literal), `NON_TOOL_EVENT_CLOSED_SETS` (Partial;
  gains `StopFailure`; `Stop` intentionally omitted like `UserPromptSubmit`).
- `extensions/pi-claude-marketplace/shared/concerns/hooks.ts` —
  `ClaudeHookEvent` literal union (currently 8) pinned to `BUCKET_A_EVENTS`
  via `satisfies`; widen in lockstep. Lives on the `shared/` side of the
  import-direction fence.
- `extensions/pi-claude-marketplace/domain/components/hooks.ts` —
  `partitionHooks` + `checkMatcherSupportability` already implement the exact
  dispositions the two new events need: `null` sentinel →
  `cond:"no-matcher-support"` group drop (UserPromptSubmit precedent); closed
  set → `cond:"closed-set"` (SessionStart precedent); WR-04 table-desync guard
  (field declared but no closed-set entry = loud X1 programmer-bug throw —
  StopFailure MUST land both table entries together).
- `tests/fixtures/hookify-hooks.json` — hookify wire bytes, bucket-A slim
  (Stop arm removed); restore the arm in this phase.

### Established Patterns
- D-58-06 strict supportability: unmappable matcher values trip, never
  silently no-op. Stop's `null` sentinel reports a non-empty matcher as a
  `no-matcher-support` drop (issue #103 acceptance criterion) — reuse, don't
  reinvent.
- Since force-install, a tripped hook entry produces per-entry drops /
  `(partially-available)`, not a whole-plugin hard `(unavailable)` flip; the
  hooks-compatibility.md § Install-time disposition text describing the hard
  trip is stale (Phase 89 rewrites it) — do not treat that doc section as
  behavioral truth.
- Fixture provenance: derive fixtures from real claude-plugins-official wire
  bytes (hookify fixture precedent, commented with its derivation path).
- Comment policy: `.claude/rules/typescript-comments.md` — decision IDs
  (D-58-06, WR-04) and requirement IDs (ADMIT-01, SFAIL-03) are allowed
  anchors; no phase/milestone references, and the existing "v1.13" phrasing in
  hook-events.ts comments should not be extended (rewrite touched comments to
  drop version-history narration).

### Integration Points
- `package.json` `peerDependencies` (line ~56):
  `"@earendil-works/pi-coding-agent": ">=0.74.0"` → `">=0.80.4"`.
- `domain/components/hooks.ts` `BUCKET_A_MEMBERS` set is derived from
  `BUCKET_A_EVENTS` — admission follows automatically once the tuple grows.
- `plugin info` hook listing flows through `shared/concerns/hooks.ts`
  (`HookSummaryEntry` / `appendHooksBlock`) — the widened union carries the
  two events to the info surface; verify the non-tool arm renders them.
- `tests/domain/components/hooks.test.ts` — existing partition/supportability
  suites; the natural home for the new admission tests.

</code_context>

<specifics>
## Specific Ideas

- StopFailure's closed set is exactly the upstream 10-value vocabulary:
  `rate_limit`, `overloaded`, `authentication_failed`, `oauth_org_not_allowed`,
  `billing_error`, `invalid_request`, `model_not_found`, `server_error`,
  `max_output_tokens`, `unknown` (SFAIL-03) — same table shape as the
  SessionStart source matcher, narrower exact-match charset (letters, digits,
  `_`, `|`).
- The observable outcome of this phase is the resolver's verdict: fixtures for
  `ralph-wiggum` (Stop-only) and `hookify` (Stop + bucket-A) flip to fully
  available, and `plugin info` lists both events as supported — even though no
  dispatch exists yet.

</specifics>

<deferred>
## Deferred Ideas

- Dispatch wiring, payload translators, wire-protocol arms, event-router
  subscription — Phase 88 (`agent_settled` dispatcher, Stop contract &
  StopFailure).
- `docs/hooks-compatibility.md` + `docs/research/claude-hooks-vs-pi-events.md`
  reconcile — Phase 89 (DOC-04, DOC-05).
- Any user-facing doc mention of the new peer floor — explicitly declined for
  Phase 87 (D-87-02); if it ever lands, it rides Phase 89's doc reconcile.

### Reviewed Todos (not folded)
- "Coverage sweep: test rare failure arms in update/reinstall/install"
  (`.planning/todos/pending/2026-06-12-coverage-sweep-test-rare-failure-arms-in-update-reinstall-in.md`)
  — keyword-only match (score 0.6); install/update/reinstall failure-arm
  coverage is unrelated to hook admission. Left pending for a future
  coverage-focused task.

</deferred>

---

*Phase: 87-bucket-a-admission-platform-floor*
*Context gathered: 2026-07-29*
