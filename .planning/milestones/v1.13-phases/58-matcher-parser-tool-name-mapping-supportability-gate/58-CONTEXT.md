# Phase 58: Matcher Parser, Tool-Name Mapping & Supportability Gate - Context

**Gathered:** 2026-06-14
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 58 layers four contracts on top of Phase 57's leaf-foundation
(`HOOKS_CONFIG_SCHEMA` + `parseHooksConfig` + resolver admission):

1. **Matcher parser (MATCH-01).** Normalize a hook group's `matcher` field
   into a Pi-form `Set<string>` (after translating Claude-form tool names
   via TOOL-01's static reverse map at parse time) plus a `MATCH_ALL`
   sentinel for `""` / `"*"`. MCP literals (`mcp__server__tool`) pass
   through unchanged (byte-identical on both sides).
2. **Regex rejection (MATCH-02).** Any matcher token containing a character
   outside `[A-Za-z0-9_|\-]` (and not part of an `mcp__` prefix) is a regex
   and trips TOOL-02(a) — plugin flips `(unavailable) {unsupported hooks}`.
3. **Bidirectional tool-name table (TOOL-01).** A static Claude ↔ Pi
   tool-name map lives at `domain/components/hook-tool-names.ts` (NOT
   `bridges/hooks/tool-names.ts` per amended REQ). An architecture test
   asserts every Pi `toolName` literal exported by the peer-dep types has a
   mapping. MCP tools bypass the table.
4. **Supportability gate (TOOL-02).** Resolver flips
   `installable: false` with reason `{unsupported hooks}` if the plugin's
   `hooks.json` declares ANY entry meeting: (a) regex matcher per MATCH-02;
   (b) Claude-form tool-name matcher token with no TOOL-01 entry
   (`MultiEdit`, `NotebookEdit`, `WebFetch`, `Task`, ...); (c) event key
   outside the bucket-A 8-event closed set; (d) handler `type !== "command"`.
   No per-entry soft-degrade — strict per-PLUGIN gating. All four conditions
   render the SAME reason byte form; debug-log carries the distinguishing
   detail.

The phase ALSO pulls **HOOK-04** forward from Phase 63 (D-58-01) to land
the REASONS rename (`"hooks"` → `"unsupported hooks"`) + catalog +
catalog-uat fixtures + messaging-style-guide + `MANIFEST_FIELD_REASONS`
carve-out drop atomically with the new TOOL-02 emissions (atomic-
supersession lesson from v1.3 / v1.10 / v1.11).

The phase ALSO pulls forward the per-non-tool-event closed-set + Pi-payload
mapping (D-58-06) so SessionStart / SessionEnd / PreCompact / PostCompact /
UserPromptSubmit matchers either translate to a Pi-side filter at
registration time (Phase 59) or trip TOOL-02 at parse time.

Phase 58 is parser + closed sets + supportability gate + lockstep byte
rename. The actual `pi.on(piEventName, h => ...)` registration is Phase 59
(DISP-01..04). Hook execution / payload translation / env vars / `if` field
/ `asyncRewake` / surface / docs all belong to Phases 60-63.

</domain>

<decisions>
## Implementation Decisions

### REASONS rename and carve-out cleanup (HOOK-04 pull-forward)

- **D-58-01 (atomic byte-form rename):** HOOK-04 lands atomically with
  Phase 58's TOOL-02 emissions, NOT in Phase 63. The closed-set REASONS
  member `"hooks"` is renamed to `"unsupported hooks"` (2-word descriptive
  reason — no longer a manifest-field carve-out token). `docs/output-catalog.md`,
  the catalog-uat byte-equality fixtures, every existing `(unavailable) {hooks}`
  row across the orchestrator surfaces, `docs/messaging-style-guide.md`,
  and the notify-grammar-invariant tests are updated in lockstep with the
  source rename. ROADMAP Phase 58 SC#4's `(unavailable) {unsupported hooks}`
  wording becomes truthful from Phase 58 forward.
  Rationale: emitting `(unavailable) {hooks}` from new TOOL-02 catalog
  states in Phase 58 then renaming in Phase 63 means TWO catalog updates +
  intermediate bytes that diverge from the ROADMAP SC wording. The v1.3
  atomic-supersession lesson + v1.10 `will * NOT to *` + v1.11 GRAM-01..05
  pattern: catalog/byte-equality must land WITH the closed-set rename in
  one commit.

- **D-58-02 (manifest-field carve-out drop):** `MANIFEST_FIELD_REASONS` in
  `orchestrators/plugin/install.ts:1478` drops `"hooks"` (keeps
  `"lspServers"`); `MANIFEST_FIELD_TO_REASON` drops the `"hooks"` entry.
  HOOK-04 fully closes in Phase 58. Rationale: under v1.13, `hooks` is a
  SUPPORTED component kind (Phase 57's `SUPPORTED_COMPONENT_KINDS` 4-tuple);
  the manifest-field-rejection branch for `hooks` is dead code once the
  TOOL-02 supportability gate takes over.

  REQUIREMENTS amendment in lockstep with Phase 58: HOOK-04 moves from
  Phase 63 to Phase 58; Phase 63's requirement list shrinks by one.

### TOOL-02 supportability gate placement

- **D-58-03 (single seam):** TOOL-02 extends `parseHooksConfig`'s
  discriminated result with a third arm so the resolver consumes ONE failure
  path for both structural parse failure (Phase 57 D-57-04) and
  supportability failure (Phase 58). Shape:
  `{ ok: true, value, supportability: { ok: true } | { ok: false, debugDetail } }`
  — or fold into the existing `{ ok: false, reason, debugDetail }` arm
  if the discriminator gets unwieldy. Single seam means the resolver code
  doesn't branch on which gate fired; both flip `installable: false` with
  reason `"unsupported hooks"`. Per-condition detail (`(a) regex` /
  `(b) unmapped tool: MultiEdit` / `(c) non-bucket-A event: Stop` /
  `(d) non-command handler: http`) goes to `hookDebugLog` only.
  Same module (`domain/components/hooks.ts`) grows from ~150 lines to maybe
  ~400 lines — acceptable; stays at single-file leaf-pure scope.

### Tool-name table location

- **D-58-04 (domain-layer co-location):** The bidirectional Claude ↔ Pi
  tool-name map lives at `domain/components/hook-tool-names.ts`, NOT
  `bridges/hooks/tool-names.ts` (REQ TOOL-01's original path). `domain/`
  stays leaf-pure (no upward imports from `bridges/`); Phase 60's payload
  translators in `bridges/hooks/payloads/` import from `domain/` — same
  direction as resolver → bridge today. Phase 59's dispatch core in
  `bridges/hooks/` also imports the table from `domain/`.

  REQUIREMENTS amendment in lockstep with Phase 58: TOOL-01's path moves
  from `bridges/hooks/tool-names.ts` → `domain/components/hook-tool-names.ts`.

- **D-58-05 (`find ↔ Glob`):** The TOOL-01 mapping includes `find ↔ Glob`
  in v1.13 (with a paired architecture-test fixture). Semantic mismatch
  risk (Pi `find` is Unix-find-style; Claude `Glob` is glob-pattern
  file-finder; Claude also has `LS` for directory listing) is accepted —
  no first-party plugin is blocked solely on `Glob` per the marketplace
  audit, so the regression risk is bounded. v1.14+ may refine if real
  plugin use surfaces a divergence.

  Full TOOL-01 mapping locked for v1.13:

  | Pi `toolName` literal | Claude tool name |
  | --------------------- | ---------------- |
  | `bash`                | `Bash`           |
  | `read`                | `Read`           |
  | `edit`                | `Edit`           |
  | `write`               | `Write`          |
  | `grep`                | `Grep`           |
  | `find`                | `Glob`           |
  | `ls`                  | `LS`             |

  Claude tools with NO Pi analog (any plugin matchering these flips
  unavailable via TOOL-02(b)): `MultiEdit`, `NotebookEdit`, `NotebookRead`,
  `WebFetch`, `WebSearch`, `Task`, `TodoWrite`, `TodoRead`, `ExitPlanMode`.

### Matcher parser model shape

- **Pi-form `Set<string>` at parse time (no runtime translation).** Plugin
  authors write Claude form per Claude Code's hook contract; Phase 58
  translates Claude → Pi at parse time using TOOL-01's reverse map. The
  parser's normalized output for a hook group's `matcher` field is one of:
  - `MATCH_ALL` sentinel for `""` or `"*"`
  - `Set<PiToolName>` of Pi-form lowercase tool names (e.g.
    `{"edit", "write"}` for matcher `"Edit|Write"`)
  - MCP literal pass-through (Claude and Pi forms identical for
    `mcp__server__tool`)
  Phase 59 then wires `pi.on("tool_call", h => piFormSet.has(h.toolName))`
  directly — no per-event runtime translation cost; no hot-path TOOL-01
  lookup. TOOL-02(b) catches Claude-form tokens with no Pi analog
  (`MultiEdit`, ...) BEFORE translation — the unmapped-token check runs
  while we still have the Claude form.

  SURF-01 (Phase 63) renders matchers in Claude form for display by
  reading the raw `hooks.json` content separately (not from the parser's
  normalized output).

### Non-tool-event matcher handling

- **D-58-06 (strict closed-set + Pi-payload mapping):** Non-tool bucket-A
  events (SessionStart, SessionEnd, PreCompact, PostCompact, UserPromptSubmit)
  use source/reason/trigger matchers, NOT tool-name matchers. Phase 58
  ships a per-non-tool-event Claude → Pi field-name + value-set mapping
  table so the matcher value can be translated to a Pi-side filter at
  registration time (Phase 59). A matcher value not in the closed set per
  event → TOOL-02-equivalent unavailable.

  Specific per-event rules (planner verifies against Pi peer-dep at
  research time):
  - **SessionStart** Claude `source` ∈ {`startup`, `resume`, `clear`,
    `compact`} ↔ Pi `session_start` event field carrying the same/mapped
    value set (research now).
  - **SessionEnd** Claude `reason` ∈ {`clear`, `resume`, `logout`,
    `prompt_input_exit`, `bypass_permissions_disabled`, `other`} ↔ Pi
    `session_shutdown` event field.
  - **PreCompact** / **PostCompact** Claude `trigger` ∈ {`manual`, `auto`}
    ↔ Pi `session_before_compact` / `session_compact` event field.
  - **UserPromptSubmit:** Claude has NO matcher support upstream. Any
    non-empty matcher → TOOL-02 unavailable (fail loudly instead of
    silently ignoring, per strict-supportability stance).

  Match-all path: empty `""` or `"*"` matcher on any non-tool event is
  always supportable (no filter; handler fires for all events of that
  type). First-party coverage check: `outpost`, `commit-commands`,
  `frosthaven` all use SessionStart without a matcher — match-all path
  covers them.

  Rationale: strict-supportability says silent never-fires AND silent
  over-fires are both failure modes. If Phase 58 can't translate the
  Claude matcher to a Pi-side filter at registration, the plugin should
  flip unavailable instead of installing with a broken hook. v1.14+ may
  relax per-event as Pi's event surface evolves.

  These per-event source/reason/trigger tables live alongside the
  TOOL-01 map. Planner decides whether they co-locate in
  `domain/components/hook-tool-names.ts` or a sibling
  `domain/components/hook-events.ts` (Claude's Discretion below).

### MATCH-02 regex character set

- **Locked by REQ:** A matcher token contains regex if it has any
  character outside `[A-Za-z0-9_|\-]` that is not part of an `mcp__`
  prefix. The MCP token shape extends the safe set to
  `mcp__[A-Za-z0-9_-]+__[A-Za-z0-9_-]+` (any divergence — e.g.
  `mcp__server__*` with `*`, or `mcp__server` with no tool — is regex,
  trips TOOL-02(a)). Mechanical; no Claude's-discretion choice here.

### Claude's Discretion

- **Bucket-A event closed-set tuple location:** likely a sibling export in
  `domain/components/hooks.ts` or `domain/components/hook-events.ts`.
  Phase 63's SURF-02 will reference it (typed `ClaudeHookEvent` tuple);
  Phase 58 can ship the bare tuple now and let SURF-02 layer the typed
  notify model on top.
- **Per-non-tool-event source/reason/trigger maps file placement:**
  co-locate in `hook-tool-names.ts` (single file, all closed sets) OR
  sibling `hook-events.ts`. Either is fine; planner picks based on file
  size.
- **Matcher parser internal API split:** likely
  `parseMatcher(rawString) → ParsedMatcher` discriminated union
  + `checkMatcherSupportability(parsedMatcher, eventName, eventBucket) →
  Supportability`. Follow Phase 57's `parseHooksConfig` discriminated-result
  shape.
- **Pipe-OR parser edge case:** matcher `""` (empty) ≠ matcher `"|"`
  (pipe with no left/right). The latter probably trips TOOL-02 (or is
  silently treated as match-all). Planner picks.
- **Catalog-state count:** TOOL-02 emits via the existing resolver-
  unavailable cascade. The catalog gets new states per orchestrator
  surface (install, preview, reconcile-apply, info, list) for the
  `{unsupported hooks}` reason. Estimate: ~5-8 new catalog states + the
  existing `{hooks}`-keyed states re-keyed to `{unsupported hooks}`.
  Planner decides the exact catalog state taxonomy.
- **Architecture-test source-of-truth for TOOL-01 completeness:** the test
  asserts every Pi `toolName` literal exported by
  `@earendil-works/pi-coding-agent`'s `types.d.ts` has a TOOL-01 mapping
  entry. Implementation: either static `Type.Static<...>` introspection
  via TypeBox, or a hard-coded const tuple in the test mirroring the
  peer-dep union with a paired `satisfies` proof. Planner picks.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & roadmap

- `.planning/REQUIREMENTS.md` — MATCH-01, MATCH-02, TOOL-01, TOOL-02
  (Phase 58 closure list). HOOK-04 moves to Phase 58 per D-58-01 in
  lockstep with this CONTEXT.md commit. TOOL-01's file path amends from
  `bridges/hooks/tool-names.ts` → `domain/components/hook-tool-names.ts`
  per D-58-04.
- `.planning/ROADMAP.md` — Phase 58 goal + 4 success criteria; Phase 63
  loses HOOK-04 per D-58-01.
- `.planning/PROJECT.md` § "Current Milestone: v1.13 Claude Hook Bridge" —
  locked scope (bucket-A only); strict per-PLUGIN supportability stance.

### Prior phase decisions (Phase 57 — leaf foundation)

- `.planning/phases/57-schema-component-type-payload-extension-tolerance/57-CONTEXT.md`
  — D-57-01 (no `schemaVersion` bump, `resources.hooks: string[]` additive),
  D-57-02 (lenient top-level `Type.Record(Type.String(), ...)`), D-57-03
  (`generatedName`-based persistence — no absolute paths in state.json),
  D-57-04 (parse failure → `installable: false` with `{unsupported hooks}`
  reason). Phase 58 extends D-57-04's discriminated result to also cover
  TOOL-02 supportability failure.
- `.planning/phases/57-schema-component-type-payload-extension-tolerance/57-04-SUMMARY.md`
  — architecture-test invariants pinning HOOK-01/02/03/D-57-01/NFR-7.
  Phase 58's new architecture tests (TOOL-01 completeness, supportability
  closed-set introspection) follow the same pattern.

### v1.13 research (advisory; scope-mismatch caveat applies)

- `.planning/research/SUMMARY.md` — § Convergences (regex rejection,
  matcher-set vocabulary), § Pitfall 8 (matcher silent-mis-handling). Note
  scope-mismatch caveat: any reference to bucket-D events, soft-dep
  Subagent events is v1.14+ (PAYL-V2-*).
- `.planning/research/ARCHITECTURE.md` — § 6.0 build order; § "Bridge plan
  / matcher" recommends `bridges/hooks/matcher.ts` — Phase 58 deviates by
  keeping matcher parsing in `domain/components/hooks.ts` per D-58-03 /
  D-58-04, since matcher compilation is leaf-pure parse-time work.
- `.planning/research/PITFALLS.md` — § Pitfall 8 (matcher translation
  failure modes — regex confusion, pipe-OR mis-split, empty-matcher drop,
  tool-name mapping table); § Pitfall 10 (soft-dep tool-name mapping
  drift). Phase 58's matcher parser directly mitigates Pitfall 8.

### Authority sources (cross-reference at planning time)

- `docs/research/claude-hook-config-syntax.md` § 2 (MatcherGroup-level
  fields), § "Matcher semantics summary table", § "Matcher target field
  per event type" — definitive Claude-side per-event matcher semantics
  (tool-name vs source vs reason vs trigger vs no-matcher). Read before
  designing the per-event closed-set maps (D-58-06).
- `docs/research/claude-hooks-vs-pi-events.md` § "Scoping primitive", §
  bucket-A 1:1 mapping table — Pi event names and payload shape per bucket
  A event. Read before locking the Claude → Pi field-name + value-set
  mapping (D-58-06).

### Codebase landing sites (Phase 58 extends)

- `extensions/pi-claude-marketplace/domain/components/hooks.ts` — Phase 57
  baseline (HOOKS_CONFIG_SCHEMA + HOOKS_VALIDATOR + parseHooksConfig).
  Phase 58 extends with matcher parser + TOOL-02 gate + non-tool-event
  closed-set checks. Discriminated parse result extended per D-58-03.
- `extensions/pi-claude-marketplace/domain/components/hook-tool-names.ts`
  (NEW) — Pi ↔ Claude bidirectional tool-name map (TOOL-01); imported by
  `hooks.ts` for the TOOL-02(b) unmapped check at parse time and by
  Phase 60's payload translators at dispatch time.
- `extensions/pi-claude-marketplace/domain/components/hook-events.ts`
  (NEW, file name Claude's discretion) — bucket-A event closed-set tuple
  + per-non-tool-event Claude → Pi field-name maps + per-event closed-set
  source/reason/trigger value sets (D-58-06). Sibling to
  `hook-tool-names.ts`.
- `extensions/pi-claude-marketplace/domain/resolver.ts` — `probeHooksConfig`
  helper (Phase 57 added) reads `parseHooksConfig`'s result and either
  records `partial.hooksConfigPath` or appends to `partial.notes` with
  the `{unsupported hooks}` reason. Phase 58 needs zero or one-line
  changes here — the gate fires inside `parseHooksConfig` per D-58-03.
- `extensions/pi-claude-marketplace/shared/notify.ts` — `REASONS` tuple
  member `"hooks"` is renamed to `"unsupported hooks"` per D-58-01 in
  lockstep with catalog/byte-equality.
- `extensions/pi-claude-marketplace/orchestrators/plugin/install.ts` —
  `MANIFEST_FIELD_REASONS` set (line 1478) drops `"hooks"`;
  `MANIFEST_FIELD_TO_REASON` (line 1486) drops the `"hooks"` entry per
  D-58-02.
- `docs/output-catalog.md` — `(unavailable) {hooks}` byte forms become
  `(unavailable) {unsupported hooks}` in lockstep + NEW catalog states per
  surface for the four TOOL-02 trigger conditions (single byte form for
  all four; debug-log carries the distinguishing detail).
- `docs/messaging-style-guide.md` — `{hooks}` REASONS member renamed in
  the closed-set documentation; `MARKERS` / `STATUS_TOKENS` unchanged.
- `tests/architecture/catalog-uat.test.ts` (catalog-uat byte-equality
  gate) — FIXTURES keyed on `{hooks}` re-keyed to `{unsupported hooks}`
  + new fixtures per TOOL-02 trigger / surface.
- `tests/architecture/notify-types.test.ts` — REASONS length lock stays
  unchanged (rename, no count delta); per-variant shape proofs adjust if
  any narrowed Reason references the member literal.
- `tests/architecture/notify-grammar-invariant.test.ts` — `{unsupported
  hooks}` participates in the existing failed-row subject-first grammar
  invariant; no new invariant.
- `tests/architecture/hooks-foundation.test.ts` (Phase 57 baseline) —
  closed-set tuples for HOOK-01 stay; Phase 58 adds a separate
  architecture-test file for TOOL-01 completeness + TOOL-02 closed-set
  invariants.

### Peer dep — Pi tool-name + event-payload source-of-truth

- `node_modules/@earendil-works/pi-coding-agent/dist/core/extensions/types.d.ts`
  — `ToolCallEvent` discriminated union exports the Pi `toolName` literal
  set (`bash` / `read` / `edit` / `write` / `grep` / `find` / `ls` plus
  `CustomToolCallEvent` open-ended). Phase 58's TOOL-01 table covers the
  literal closed set; `CustomToolCallEvent` is intentionally not bridged.
- Same file — `session_start` / `session_shutdown` /
  `session_before_compact` / `session_compact` / `input` (or equivalent)
  event payload shapes. Planner verifies which carry source/reason/trigger
  fields per D-58-06 at research time.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- **`parseHooksConfig` discriminated result pattern**
  (`domain/components/hooks.ts`) — Phase 57's `{ ok: true, value,
  relativePath } | { ok: false, reason }` shape extends to also cover
  TOOL-02. Either fold supportability into the existing `ok: false` arm
  or add a third arm with a supportability sub-result (D-58-03).
- **`hookDebugLog` stub** (`domain/components/hooks.ts`) — Phase 57's
  `PI_CLAUDE_MARKETPLACE_DEBUG === "1"` gated stub is the OBS-01 hand-off
  seam. Phase 58 uses it to log the per-condition TOOL-02 detail
  (`(a) regex` / `(b) unmapped tool: MultiEdit` / etc.). The per-file
  ESLint override for `console.error` already in place from Phase 57.
- **`SUPPORTED_COMPONENT_KINDS` 4-tuple** (`domain/resolver.ts:126`,
  exported) — Phase 57 added `"hooks"`. Phase 58 changes nothing here.
- **`UNSUPPORTED_COMPONENT_KINDS` tuple** (`domain/resolver.ts:138`,
  exported by Phase 57 P04) — Phase 58 changes nothing here.
- **`REASONS` tuple** (`shared/notify.ts:72`) — Phase 58 renames the
  `"hooks"` member to `"unsupported hooks"`; tuple length unchanged
  (rename, not addition).
- **Phase 57 P04 architecture-test pattern**
  (`tests/architecture/hooks-foundation.test.ts`) — pin TOOL-01
  completeness + TOOL-02 closed-set invariants the same way (static
  JSON-Schema introspection or hard-coded const tuple + `satisfies`).

### Established Patterns

- **Discriminated `installable: true | false` with `assertNever`
  exhaustiveness** (NFR-7) — Phase 58 preserves: any TOOL-02 trip flips
  to `installable: false` via the resolver's existing not-installable
  builder.
- **Closed-set TypeBox tuple as PUBLIC source-of-truth** —
  `SUPPORTED_COMPONENT_KINDS`, `REASONS`, `STATUS_TOKENS`, `MARKERS`,
  `PLUGIN_STATUSES`, `MARKETPLACE_STATUSES` are all the established
  pattern. Phase 58's TOOL-01 + non-tool-event source/reason/trigger
  tuples follow the same shape (`as const` tuples; `Type.Static<...>`
  introspection for architecture tests).
- **Atomic supersession on closed-set rename** (v1.3 lesson + v1.10
  `will * NOT to *` + v1.11 GRAM-01..05) — D-58-01 / D-58-02 land
  REASONS rename + carve-out drop + catalog states + catalog-uat fixtures
  + messaging-style-guide in ONE commit. Any intermediate commit
  breaks `npm run check` byte-equality gates.
- **Generated-name persistence** (D-57-03) — `resources.hooks` is `[]`
  for non-installable plugins by the existing not-installable cascade;
  Phase 58 doesn't touch persistence.
- **Architecture-test source-of-truth gates** (Phase 57 P04 pattern) —
  Phase 58 adds:
  - TOOL-01 completeness gate: every Pi `toolName` literal has a
    Claude-side mapping; closed-set membership symmetrical with
    UNSUPPORTED list (architectural deepEqual lock).
  - TOOL-02 closed-set gate: bucket-A 8-event tuple + per-non-tool-event
    source/reason/trigger value-set membership lock.

### Integration Points

- `domain/components/hooks.ts` — extended with matcher parser + TOOL-02
  supportability check.
- `domain/components/hook-tool-names.ts` (NEW) — TOOL-01 bidirectional
  map.
- `domain/components/hook-events.ts` (NEW, file name Claude's discretion)
  — bucket-A event tuple + per-event source/reason/trigger maps.
- `domain/resolver.ts` — `probeHooksConfig` consumes the extended
  `parseHooksConfig` discriminated result; the existing
  not-installable-builder path covers the TOOL-02 cases.
- `orchestrators/plugin/install.ts` — `MANIFEST_FIELD_REASONS` +
  `MANIFEST_FIELD_TO_REASON` updates per D-58-02.
- `shared/notify.ts` — REASONS rename per D-58-01.
- `docs/output-catalog.md` + `tests/architecture/catalog-uat.test.ts` +
  `tests/architecture/notify-grammar-invariant.test.ts` — atomic byte-form
  rename + new TOOL-02 catalog states.
- Phase 58 does NOT touch `bridges/`, `orchestrators/reconcile/`,
  `orchestrators/import/`, `shared/event-router.ts` (doesn't exist yet —
  Phase 59), `index.ts`, the persistence layer, or the install/update/
  reinstall ledger paths (other than `MANIFEST_FIELD_REASONS`). Those
  wire-ups are Phases 59-63.

</code_context>

<specifics>
## Specific Ideas

- The user explicitly clarified the architecture: Claude-form matchers
  translate to Pi-form at REGISTRATION TIME via a static table; the Pi
  runtime fires Pi-form events that our Pi-form handlers consume
  directly. NO runtime Claude↔Pi translation. "If a hook is not
  supported, plugin is unavailable — no need to catch or translate
  anything at runtime." This locks: (a) parser output is Pi-form; (b)
  hooks-with-inputs (e.g. `if: Bash(...)`, command arguments) translate at
  registration time too. Phase 58 ships the table; Phase 59 does the
  registration translation; Phase 61's `if` field uses the same per-tool
  argument-extraction map.
- The user explicitly chose strict closed-set + Pi-payload mapping for
  non-tool bucket-A events (D-58-06) — even though no first-party plugin
  exercises matchered non-tool events. The strict stance is the
  load-bearing design choice; "if we can't fully honor the matcher, plugin
  is unavailable" beats "install with broken hook".
- The user explicitly pulled HOOK-04 forward (D-58-01) — the atomic-
  supersession lesson means renaming the closed-set member + emitting the
  new bytes happens in ONE commit, not split across phases. The carve-out
  cleanup (D-58-02) lands in the same commit because v1.13's supported-
  component status makes the install.ts manifest-field path dead code.
- `find ↔ Glob` mapping (D-58-05) accepted with the LOW-confidence flag —
  semantic mismatch is a known risk; no first-party plugin currently
  blocked solely on `Glob`. Fixture test pins the mapping; v1.14+ may
  refine.
- The user did NOT ask for catalog work to defer to a follow-up plan; the
  rename + new states + fixtures are part of Phase 58.

</specifics>

<deferred>
## Deferred Ideas

- **MATCH-V2-01 (full regex matchers)** — v1.14+ if marketplace coverage
  demand surfaces. Today's strict-supportability stance + 100%
  first-party coverage without regex makes it deferrable.
- **PROM-01 (`MultiEdit` / `NotebookEdit` / `WebFetch` / `WebSearch` /
  `Task` / `TodoWrite` / `TodoRead` / `ExitPlanMode` Pi-side analogs)** —
  v1.14+ unblocker for `security-guidance` and any future plugin
  blocked solely on TOOL-02(b). Each new mapping is a TOOL-01 table
  update + paired fixture test.
- **Per-non-tool-event matcher value-set extensions** — when upstream
  Claude Code adds new source/reason/trigger values, our closed-set lists
  need a lockstep update. Document the verification protocol at planning
  time so future maintainers can re-audit.
- **`if`-field implementation (MATCH-03)** — Phase 61. The user's
  clarification ("for hooks that have inputs (e.g. Bash(...) or find), we
  at registration time translate the claude form to a pi form or handler
  code") applies; Phase 61 will use Phase 58's TOOL-01 + per-tool
  argument-extraction infrastructure. Phase 58's matcher parser does NOT
  parse `if` syntax — that's strictly Phase 61.
- **`asyncRewake` registry (HOOK-06 + EXEC-05)** — Phase 62. Phase 58's
  matcher parser silently accepts unknown extension fields per HOOK-03
  (Phase 57); `asyncRewake` is one of those. Phase 62 promotes it to
  load-bearing.
- **SURF-01 / SURF-02 `info <plugin>` hooks line rendering** — Phase 63.
  Phase 58's parser output stores Pi-form for dispatch; SURF-01 will
  render Claude-form by reading raw `hooks.json` separately.
- **Catalog state count reduction by surface consolidation** — if the
  Phase 58 catalog grows large (~8 new states), consider whether some
  surface variants are byte-identical and can share fixtures. Planner
  decides at write time.

### Reviewed Todos (not folded)

- `2026-06-12-coverage-sweep-test-rare-failure-arms-in-update-reinstall-in.md`
  matched at score 0.6 via keywords (test, claude, plugin). It is v1.12
  orchestrator-coverage backlog (uncovered failure arms in
  `orchestrators/plugin/{update,reinstall,install}.ts` +
  `orchestrators/marketplace/update.ts` + `orchestrators/edge-deps.ts`),
  unrelated to v1.13 hooks-supportability scope. Kept in the pending todo
  pile for a future milestone (same disposition as Phase 57).

</deferred>

---

*Phase: 58-Matcher Parser, Tool-Name Mapping & Supportability Gate*
*Context gathered: 2026-06-14*
