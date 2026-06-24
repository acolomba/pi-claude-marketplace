# Phase 1: Localized type model & command-context spine - Context

**Gathered:** 2026-06-24
**Status:** Ready for planning

<domain>
## Phase Boundary

Reshape the notification type model so that **each command owns its own
notification vocabulary locally** and `notify()` is handed everything it needs at
the call site — with **zero rendered-output change** (the reducer spine and
content-ladder deletions arrive in Phase 2; the summary surface redesign in
Phase 3).

Concretely, this phase delivers:

1. A shared `CommandContext` shape (and the universal base-message structure) used
   identically by all commands.
2. Per-command co-located ownership of: its private status set, its owned reasons,
   its operation label (via `CommandContext.Messaging`), and a per-status render
   map total over its own statuses.
3. The row/message type model gains the universal caller-intent fields
   (`severity`, `needsReload`, `dependencies`) — **optional this phase, not yet
   reduced** — and structural cardinality (tuple-vs-array).
4. `notify()` takes the command's `CommandContext` + rows as arguments instead of
   looking anything up in a central registry.

**Output-neutral:** `npm run check` and `catalog-uat` must stay byte-identical.
No central registry is built; no `present`→`installed` collapse, no
`disable-cascade` removal, no reducer behavior change (all Phase 2+).

**Architecture pivot (this discussion):** The original ROADMAP/REQUIREMENTS named
a *central registry* (`satisfies`-pinned value+type union) and a central
`Record<Status, RenderFn>` exhaustiveness anchor. The user rejected the central
registry as unnecessary central control over what is inherently command-local.
MOD-01/02/03 and the Phase 1 criteria were rewritten to **intent** (no drift, no
missing render arm, bidirectional proofs deleted) achieved via **command-local
ownership** instead. The requirement edits are committed alongside this context.

</domain>

<decisions>
## Implementation Decisions

### No central registry (MOD-02 revised)
- **D-01:** There is **no central status/reason registry** and no central
  `satisfies` value↔type drift gate. Each command owns its statuses and message
  shapes locally. Value/type drift is caught at the command module — a command
  cannot construct a message whose status it did not declare. Reason: statuses are
  inherently command-specific, so central control over "are these the same as what
  the command provided" adds no value.
- **D-02:** `notify()` receives the command's `CommandContext` and its rows **at
  the call site** (roughly `notify(context, rows)`), rather than unioning
  contributions from a central registry.
- **D-03:** The bidirectional `notify-types.test.ts` set-equality proofs are
  **deleted** — the central tuples they guarded are gone; per-command ownership
  makes drift a local compile error instead.

### CommandContext + Messaging (the only horizontal surface)
- **D-04:** Each command exposes a **`CommandContext`** (class-typed) const. Its
  **`Messaging`** member carries the **`label`** (the human operation name, e.g.
  `"Plugin install"`, `"Marketplace add"`). The label is the *one* thing published
  horizontally, because it applies across many plugins/commands. **Nothing else is
  exposed centrally** beyond what the context carries.
- **D-05:** **Shared naming convention.** The member/field names must be identical
  across every command: `CommandContext`, `Messaging`, `label`, `severity`,
  `needsReload`, `dependencies`. This consistency is a hard requirement — downstream
  commands must look the same.

### Universal base-message fields (not per-command grammar)
- **D-06:** `severity`, `needsReload`, and `dependencies` are part of the **base
  message structure common to all commands** — NOT per-command declarations. They
  live on the universal row/message shape.
- **D-07:** This phase introduces `severity`/`needsReload` as **optional** fields
  that the Phase-1 reducer does **not** read (output stays byte-identical). Phase 2
  flips the reduction on (max-severity / OR-needsReload / tally) and adds the
  GATE-01 architecture test. (Exact typing of the introduction is at planner
  discretion — see Claude's Discretion — constrained by output-neutrality.)

### Statuses & reasons
- **D-08:** **Statuses are command-internal.** Each command keeps its own status
  set privately; the notification system neither unions nor validates them centrally.
- **D-09:** **Reasons are split:** shared reasons become **topic-grouped enums**
  (e.g. an "unsupported components" group covering hooks / LSP / … soft-dep topics);
  command-specific reasons stay private to the command. No central enforcement in
  the notification system. (Planner: identify the topic groups from today's
  `REASONS` membership and group accordingly; the closed `reasons` set is preserved
  for catalog stability — OUT-08.)

### Rendering (MOD-03 revised → command-local)
- **D-10:** Each command renders its own rows via a **render map total over its OWN
  status set** — omitting an arm for one of the command's statuses is a **compile
  error**. This is where MOD-03's missing-arm-is-a-compile-error intent relocates
  (from a central `Record<Status, RenderFn>` to per-command render maps).
- **D-11:** The **shared presentation vocabulary stays central** in `notify.ts`:
  `ICON_*` constants, `renderScopeBracket`, `composeReasons`, version/scope
  composers, the row-composition primitives. Command render maps *call* these
  helpers; they do not duplicate them.

### Cardinality (OUT-07)
- **D-12:** Cascade cardinality (single marketplace/plugin vs. plural) is expressed
  via **tuple-vs-array typing**: single = a 1-tuple (`[Row]`), plural = an array
  (`Row[]`). The type system enforces cardinality directly; render-time row
  counting no longer determines it.

### Migration breadth
- **D-13:** **Migrate all 18 commands now.** Full cutover this phase — every command
  gets its `CommandContext`/`Messaging.label`, its command-local statuses, reasons,
  and render map. The notification monolith is not left half-migrated across a phase
  boundary, and the Phase 4 ≤3-central-files / 0-`notify.ts`-edits proof gets a clean
  baseline.

### Claude's Discretion
- Exact typing mechanism for introducing the optional `severity`/`needsReload`
  fields (D-07), provided output stays byte-identical and `catalog-uat` is green.
- Whether `CommandContext` is literally a `class` vs an interface + const factory —
  user said "class," planner picks the most idiomatic TS that keeps the `Messaging`
  member contract and shared naming (D-04/D-05); the contract (a command can't be
  wired without supplying `Messaging.label` and a total render map) must hold.
- The precise topic-group taxonomy for shared reasons (D-09), derived from the
  existing closed `REASONS` set.
- Internal file layout for the command-local declarations (sibling module vs.
  co-located in the orchestrator) — keep it per-command, idiomatic, and additive.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & roadmap (this workstream)
- `.planning/workstreams/notification-refactor/REQUIREMENTS.md` — MOD-01, MOD-02,
  MOD-03 (revised 2026-06-24 to command-local intent), OUT-07, OUT-08. The Phase 1
  requirement set.
- `.planning/workstreams/notification-refactor/ROADMAP.md` §"Phase 1" — revised
  success criteria 1–5 (command-local ownership, no central registry, tuple-vs-array
  cardinality, output-neutral).

### Coupling audit (the WHY — read before designing)
- `.planning/workstreams/notification-refactor/research/MESSAGING-COUPLING.md` —
  the open-closed coupling audit. **Note:** Parts B/C propose the central-registry +
  `Record<Status,RenderFn>` mechanism that this discussion REPLACED with
  command-local ownership. Read it for the construct inventory (which tuples/unions/
  switches exist and where), the two end-to-end traces (install, marketplace add),
  and the shared-vs-localize-vs-delete classification (Part B) — but the *registry*
  shape in Part C is superseded by the `CommandContext` model captured here.

### Code (the surfaces being reshaped)
- `extensions/pi-claude-marketplace/shared/notify.ts` — the 3119-line monolith.
  Shared vocabulary that STAYS central: `ICON_*` (~:1323), `renderScopeBracket`/
  version/scope composers (~:1590–1706), `composeReasons` (~:1706), the envelope +
  `notify()` dispatcher (~:2987). Everything per-status/per-command moves out.
- `extensions/pi-claude-marketplace/edge/router.ts` — the 18-command routing surface
  (`SubcommandHandlers`, `*_SUBCOMMANDS`, switch arms, usage strings).
- `extensions/pi-claude-marketplace/edge/register.ts` — handler wiring (one line per
  command).
- `extensions/pi-claude-marketplace/orchestrators/{plugin,marketplace,import,reconcile}/`
  — one file per command; the vertical slices that will co-locate their
  `CommandContext`/statuses/reasons/render map.
- `tests/architecture/notify-types.test.ts` — the bidirectional proofs to be DELETED
  (D-03).
- `tests/shared/notify-v2.test.ts` — the per-status notify grammar mini-spec
  (binding contract); the render/icon/scope-bracket invariants that must stay
  byte-identical.
- `tests/architecture/catalog-uat.test.ts` + `docs/output-catalog.md` — GATE-02
  byte-equality gate; must stay green and byte-identical this phase.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **Shared presentation vocabulary** in `notify.ts` (`ICON_*`, `renderScopeBracket`,
  `composeReasons`, version/scope composers, `pluginRow` primitive): keep central;
  command render maps call into them (D-11).
- **One-file-per-command orchestrators** already exist under
  `orchestrators/{plugin,marketplace,import,reconcile}/` — clean homes for the
  co-located `CommandContext`/render-map declarations. No restructuring needed to
  host them.
- **`edge/register.ts`** already does one-line-per-command wiring — the natural place
  to thread each command's `CommandContext` if needed.

### Established Patterns
- `(typeof X)[number]` literal-union idiom is used ~16× in `notify.ts` — the
  command-local status sets can keep using `as const` tuples for their own statuses.
- Discriminated unions narrowed on `status` with per-arm field access — preserved,
  but the union now assembles from command-local message interfaces rather than a
  central list.
- Message shapes already carry optional `scope?` etc. (see `notify-v2.test.ts`
  mini-spec) — adding optional `severity?`/`needsReload?` follows the same
  optionality pattern and stays output-neutral.

### Integration Points
- `notify(context, rows)` call sites in every orchestrator (e.g.
  `orchestrators/plugin/install.ts`, `orchestrators/marketplace/add.ts`) — the
  signature change to pass `CommandContext` threads through all 18 producers.
- `notify.ts` envelope/dispatcher consumes the per-command render maps + shared
  vocabulary to produce byte-identical output.

</code_context>

<specifics>
## Specific Ideas

- User's exact words for the mechanism: *"let's have commands expose a
  CommandContext class and a const with a Messaging member that contains the label
  — don't think anything else is necessary. this context is passed to the
  notification commands — forget the registry."*
- User explicitly rejected the "grammar" naming and the central-registry control
  over statuses: *"statuses are up to the command, so i don't see the value in
  having the central notification system check that they are the same as what the
  command provided."*
- Shared reasons grouping idea: *"an enum of the shared ones (by topic, e.g.
  unsupported components for hooks, lsp, …)."*
- Hard constraint on naming: *"let's make sure that the names used for these things
  would be common to all plugins"* → the `CommandContext`/`Messaging`/`label`/
  `severity`/`needsReload`/`dependencies` names are a fixed convention.

</specifics>

<deferred>
## Deferred Ideas

- **Reducer behavior** (max-severity / OR-needsReload / tally), content-ladder
  deletions (`BENIGN_REASONS`/`allBenign`/`cascadeSeverity`/`shouldEmitReloadHint`),
  `present`→`installed` collapse, `disable-cascade` removal, GATE-01 architecture
  test → **Phase 2**.
- **Summary surface redesign** (leading severity sentence, trailing tally, always-
  rendered marketplace header) + atomic catalog supersession → **Phase 3**.
- **Concern-module extraction** (`appendHooksBlock`, soft-dep marker injection) and
  the ≤3-central-files / 0-`notify.ts`-edits open-closed proof → **Phase 4**.

None — discussion stayed within phase scope (the architecture pivot revised the
*mechanism* of MOD-01/02/03, not the phase boundary).

</deferred>

---

*Phase: 1-localized-type-model-command-context-spine*
*Context gathered: 2026-06-24*
