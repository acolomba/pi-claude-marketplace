# Phase 102: Reason token, install write-through and notification - Context

**Gathered:** 2026-08-14
**Status:** Ready for planning

<domain>
## Phase Boundary

Installing a plugin whose resolved `defaultEnabled` is `false` leaves it
disabled: recorded disabled, written through to that scope's
`claude-plugins.json` entry, and reported as such at informational severity.
This is the milestone's substantive phase — the first one where the resolved
value changes what a user observes.

The state must land where reconcile already reads desired enablement from, so
the next `/reload` is a fixed point rather than a silent re-enable. Proving that
at the reconcile planner itself is the next phase's job; this phase's job is to
put the state there.

Out of scope: the pre-install read surfaces (`list`, `info`) that warn before
the install is run, and the no-op parity sweep.

</domain>

<decisions>
## Implementation Decisions

### Materialization path for an install-disabled plugin

- **D-102-01:** An install that resolves `defaultEnabled: false` runs the full
  six-phase ledger and then the existing disable cascade — materialize, then
  disable. The D-01 literal array
  (`[skills, commands, agents, hooks, mcp, state]`) is untouched, and so are all
  five materialization phase bodies.
  — **Rationale:** the terminal state is byte-identical to `install` followed by
  `disable` *by construction* rather than by careful re-implementation, and
  `toDisabledRecord` remains the sole sanctioned producer of the disabled shape
  (ENBL-02). The rejected alternatives both break one of those: a discover-only
  path gives the disabled shape a second producer, and a state-phase-only path
  leaves `resources` empty, contradicting ENBL-18 (a disabled plugin keeps its
  recorded inventory, shipped deliberately in the v1.18 close).
  — **Cost accepted:** artifacts are written and then removed on this path. It
  is bounded and only affects install-disabled plugins.
  — **Precedent:** the `enable` branch already reuses `runInstallLedger`; this
  is that composition in reverse.

- **D-102-02:** If the ledger succeeds but the disable cascade then fails, the
  behavior is **whatever a failed disable cascade does today** — the existing
  partial-drop reporting through `cascade.dropped` and the existing surfaced
  error, unchanged. No new failure semantics are invented for a path that is
  structurally an install followed by a disable, and no new rollback composition
  is built.

### Enablement semantics per caller

- **D-102-03:** `import` never applies `defaultEnabled`.
  `extractEnabledPluginRefs` (`orchestrators/import/refs.ts`) skips
  `enabled: false` entries outright, so every plugin reaching `installPlugin`
  through import arrived because the source Claude Code settings said
  `enabled: true`. That is an explicit user setting, and DFEN-05 says an existing
  `enabled` value wins over `defaultEnabled` and is never overwritten. There is
  no absent case to decide on this path.
  — **Do not** treat `import` and `reconcile` as one "orchestrated mode" when
  reasoning about enablement. They skip the config write-back for the same
  reason but have opposite relationships to user intent.

- **D-102-04:** `reconcile` DOES apply `defaultEnabled`, and stamps the key. A
  user who hand-adds `"p@mp": {}` to `claude-plugins.json` has declared *which*
  plugin, not *whether* it is enabled — which is exactly the gap `defaultEnabled`
  exists to fill. So a reconcile-driven install of a `defaultEnabled: false`
  plugin records it disabled AND writes `enabled: false` into that entry.
  — **Narrow scope:** the write happens ONLY when the `enabled` key is absent,
  and writes ONLY that field. A pre-existing `enabled` value — `true` or
  `false` — is never touched.
  — **Why this does not violate the write-back skip:** the WB-01 / WR-09 rule
  exists so reconcile cannot clobber a per-machine override. Adding a key the
  user omitted is not clobbering. Without the stamp, the next `/reload` reads
  absent-as-enabled (`isDeclaredEnabled`), finds the record disabled, and pushes
  `acc.enable` (`orchestrators/reconcile/plan.ts:338`) — the exact silent
  re-enable this milestone exists to close.
  — **The alternative was rejected:** treating the bare entry as "enable it"
  would make `/claude:plugin install p@mp` and a hand-edit + `/reload` produce
  different outcomes for the same plugin and the same manifest, a divergence
  that would then need documenting rather than avoiding.

### Reason token, notification and write-back mechanics

- **D-102-05:** `installs disabled` is appended at the **tail** of `REASONS`
  (`shared/notify.ts`), at position 39, after `"malformed command"`. No existing
  entry is reordered or reworded. The COMPAT-01 architecture test
  (`tests/architecture/compat-01-no-expansion.test.ts`) pins `REASONS` by exact
  enumeration equality, so it takes exactly one intended delta.

- **D-102-06:** The token gets a **shared** home in the `notify-reasons.ts` topic
  partition, not a command-private one. The read surfaces will emit it in the
  next phase, so a command-private home would only have to move one phase later.
  The partition's compile-time completeness proof (`_UncoveredReason` /
  `_ExtraReason`) fails until it has a home, which is the mechanism that makes
  this non-optional.

- **D-102-07:** The install notification states that the plugin installed
  disabled and how to enable it, at **informational** severity. The desired
  state WAS reached — an install-disabled plugin is the author's declared intent,
  not a shortfall — and severity is the desired-state axis, not a
  something-is-unusual axis.

- **D-102-08:** The install orchestrator determines the state and stamps both the
  reason token and the severity. `notify.ts` stays a dumb renderer and must not
  probe state to decide either.

- **D-102-09:** The write-back seam is
  `persistence/config-write-back.ts::writePluginConfigEntry`, the sole sanctioned
  writer per SPLIT-02, with its existing entry-level patch semantics. This phase
  gives the currently-empty plugin patch its first field.

- **D-102-10:** OUT-04's "how to enable it" is delivered as a **boolean hint
  field** on `PluginDisabledMessage` plus **one byte-frozen trailer literal**,
  modeled exactly on the existing `partialHint` / `PARTIAL_INSTALL_HINT_TRAILER`
  precedent (`notify.ts`). Boolean in, fixed literal out — no interpolation, per
  T-69-01. This upholds D-102-08: the orchestrator decides, the renderer only
  renders. The token-only alternative (let `{installs disabled}` carry the fact
  and leave the remedy to the docs) was considered and rejected as an
  under-delivery of OUT-04's plain reading. This is the only new field in the
  phase and the only render-layer touch beyond a lifted arm.

### Claude's Discretion

- How the disabled-install path is threaded through `installPlugin` /
  `runInstallLedger` — a parameter, a post-ledger branch in the caller, or
  another shape — provided D-102-01's composition and D-102-02's failure
  behavior hold.
- The exact wording of the notification message, subject to D-102-07 and the
  established row grammar.
- Where the reconcile-side stamp is invoked from, provided it satisfies D-102-04's
  absent-key-only scope.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets

- `runInstallLedger` (`orchestrators/plugin/install.ts`) — the guard-free ledger
  body, already reused by the `enable` branch of
  `orchestrators/plugin/enable-disable.ts`.
- The disable branch of `enable-disable.ts` — cascade-unstages all five artifact
  kinds, then calls `toDisabledRecord`, which sets `enabled: false`, bumps
  `updatedAt`, and passes `resources` through unchanged (ENBL-02 / ENBL-18).
- `writePluginConfigEntry` (`persistence/config-write-back.ts`) — merges a
  `Partial<PluginConfigEntry>` patch over the existing entry
  (`{ ...existing, ...patch }`), so an absent-key stamp is a natural fit.
- `resolveDefaultEnabled` and the non-optional `defaultEnabled` on both
  materializable resolver arms, landed last phase. `InstallCtx.resolved` is
  already typed `MaterializablePlugin`, so the value reads with no narrowing.

### Established Patterns

- The install ledger is a literal six-element array whose order is a contract
  under D-01 — never refactored to a dynamic builder.
- `isDeclaredEnabled(entry) => entry.enabled !== false` (`persistence/config-io.ts`)
  is the single home of the absent-means-enabled default (D-04 consume-time).
- The reconcile planner partitions into action buckets; `acc.install.push` at
  `orchestrators/reconcile/plan.ts:328` and `acc.enable.push` at `:338` are the
  two that matter here.
- Reason tokens are catalog-stable: new members append at the tail, existing
  entries never reorder. The last such amendment was `unsupported component`.

### Integration Points

- `orchestrators/plugin/install.ts` — the ledger composition and the standalone
  write-back site.
- `orchestrators/plugin/enable-disable.ts` — the disable cascade being composed.
- `orchestrators/reconcile/apply.ts` — the reconcile-side install path that needs
  the absent-key stamp.
- `shared/notify.ts` and `shared/notify-reasons.ts` — the token and its topic.
- `tests/architecture/compat-01-no-expansion.test.ts` — takes exactly one
  enumeration delta.

</code_context>

<specifics>
## Specific Ideas

- Upstream contract (verified 2026-08-14 against
  `code.claude.com/docs/en/plugins-reference`): `defaultEnabled` is consulted at
  install and enable time only; an existing `enabledPlugins` setting takes
  precedence and persists across update and reinstall. D-102-03 and D-102-04 are
  our analog of that rule, split by whether the caller carries a setting.
- The `enabled: false` write is the first field the install write-back's plugin
  patch has ever carried.

</specifics>

<deferred>
## Deferred Ideas

- Proving reconcile stability at the planner itself — a `/reload` planning no
  action, and the second and third reload being fixed points too — is the next
  phase (DFEN-06), as is `update`/`reinstall` never re-reading `defaultEnabled`
  (DFEN-07).
- `list` and `info` warning that a plugin will install disabled, and the
  network-free constraint on saying so, is a later phase (OUT-02, OUT-03,
  OUT-05).
- The six-surface byte-identical no-op sweep and the output-catalog amendment
  are the closing phase (DFEN-08, DOC-01, DOC-02).
- Honoring Claude's dependency-requirement override stays out of scope for the
  milestone, blocked on plugin dependency declarations being dropped entirely
  today.

</deferred>
