# Roadmap: pi-claude-marketplace — defaults-enabled (defaultEnabled Manifest Field)

## Milestones

- 🚧 **defaults-enabled defaultEnabled Manifest Field** — Phases 101-105 (planning) — a plugin author can ship a plugin that installs disabled, and nothing later re-enables it behind the user's back
- ✅ **v1.18 Manifest-Independent Installed Plugin Info** — Phases 95-100 (shipped 2026-08-12, npm 0.14.0) — full detail: `.planning/milestones/v1.18-ROADMAP.md`

Earlier milestones (v1.0-v1.17, url-source, force-install, fetch-plugin,
agent-skill-preloads) are archived under `.planning/milestones/` and indexed in
`.planning/MILESTONES.md`.

## Phases

### In progress defaults-enabled (defaultEnabled Manifest Field)

**Phase numbering:** integer phases 101-105 continue the global counter from
Phase 100, the final v1.18 phase. This milestone is name-labeled rather than
version-numbered because concurrent workstreams cannot share a global version
sequence (`url-source` and `force-install` are the prior precedents). Decimal
phases (101.1, 102.1) are urgent insertions only, marked `INSERTED`.

- [ ] **Phase 101: Manifest field and precedence resolution** — `defaultEnabled` becomes an optional boolean on both declaration sites through the shared `PLUGIN_METADATA_FIELDS` group, and the marketplace-entry-wins precedence rule is evaluated once, in the resolver, rather than re-derived by each consumer. No observable behavior changes in this phase. (DFEN-01, DFEN-02, DFEN-03)

- [ ] **Phase 102: Reason token, install write-through and notification** — the milestone's substantive phase. Installing a plugin that resolves `defaultEnabled: false` records it disabled AND writes `enabled: false` through to that scope's `claude-plugins.json` entry — the first field the install write-back's plugin patch has ever carried — so the disabled state lives where reconcile already looks for it. An `enabled` value already in the entry wins in both directions. The `installs disabled` token lands as one indivisible closed-set amendment, and the install notification says what happened at informational severity. (OUT-01, DFEN-04, DFEN-05, OUT-04)

- [ ] **Phase 103: Reconcile stability and lifecycle non-reapplication** — closes the silent-re-enable hazard by verifying it against the reconcile planner itself, not at the install boundary: a `/reload` after an install-disabled plugin plans no action for it and never reaches `acc.enable.push(...)`. `update` and `reinstall` never re-read `defaultEnabled` for an already-installed plugin, so a later release that flips the field cannot flip the user. (DFEN-06, DFEN-07)

- [ ] **Phase 104: Pre-install read surfaces** — `list` and `info` tell a user that a plugin will install disabled BEFORE they commit to the install, and stay network-free doing it. The marketplace entry is always readable from the cached manifest; `plugin.json` is not, without a clone. Where the entry is silent, the surfaces decline to claim rather than fetch. (OUT-02, OUT-03, OUT-05)

- [ ] **Phase 105: No-op parity sweep and contract documentation** — a plugin that says `defaultEnabled: true`, or says nothing, behaves byte-identically to pre-milestone across all six surfaces; the output catalog carries the new token and its emitters; and the dependency-requirement override is documented as a known divergence rather than half-built. (DFEN-08, DOC-01, DOC-02)

**Milestone-wide constraints** (apply at every phase boundary, not owned by any
single phase):

- `npm run check` — typecheck + ESLint + Prettier + tests — stays green at
  every phase boundary (NFR-6).
- No phase introduces a network call on a read path (NFR-5). `list`, `info`,
  `uninstall` and `marketplace remove` stay offline.
- No state schema migration. `defaultEnabled` is read at install time and lands
  in the existing `enabled` flag and config entry; no new persisted field.
- These are CLI/backend phases. The `ui_safety_gate` keyword scan matches this
  project's domain vocabulary ("component", "view", "form") as a known false
  positive — pass `--skip-ui` to `/gsd-plan-phase` for every phase here.

**Rejected design, not to reappear in any phase:** teaching `isDeclaredEnabled`
(`persistence/config-io.ts`) the manifest value. The reconcile planner has no
manifest access, a manifest edit would flip a user's plugin off underneath them
on reload, and it contradicts the upstream install-time-only timing. The design
is install-time write-through, in every phase.

<details>
<summary>✅ v1.18 Manifest-Independent Installed Plugin Info (Phases 95-100) — SHIPPED 2026-08-12</summary>

- [x] Phase 95: Manifest-independent installed inventory (2/2 plans) — completed 2026-08-08
- [x] Phase 96: Installation-record-backed plugin info (4/4 plans) — completed 2026-08-09
- [x] Phase 97: Disabled-state classification repair (5/5 plans) — completed 2026-08-09
- [x] Phase 98: Lifecycle regression and contract documentation (6/6 plans) — completed 2026-08-10
- [x] Phase 99: Post-audit tech-debt closure (7/7 plans) — completed 2026-08-10
- [x] Phase 100: Disabled-plugin information retention (5/5 plans) — completed 2026-08-12

Full phase details: `.planning/milestones/v1.18-ROADMAP.md`
Audit: `.planning/milestones/v1.18-MILESTONE-AUDIT.md` (passed — 32/32 requirements, 6/6 phases, 5/5 seams, 3/3 flows)

Phase 97 and Phase 100 are load-bearing for this milestone: the disabled-state
predicate now reads only `enabled`, and a disabled plugin keeps its recorded
inventory while its artifacts are dropped. An install-disabled plugin's terminal
state is that same shape.

</details>

## Phase Details

### Phase 101: Manifest field and precedence resolution

**Goal**: The `defaultEnabled` declaration is readable from both sites it may appear on, and the "marketplace entry wins" rule is answered in exactly one place, so no later consumer re-derives it.
**Depends on**: Nothing (first phase of the milestone; builds on the shipped v1.18 tree)
**Requirements**: DFEN-01, DFEN-02, DFEN-03
**Success Criteria** (what must be TRUE):

  1. A marketplace plugin entry OR a `plugin.json` carrying `defaultEnabled: false` validates and is readable — the field is added once to the shared `PLUGIN_METADATA_FIELDS` group (`domain/components/plugin.ts`) so `PLUGIN_ENTRY_SCHEMA` and `PLUGIN_MANIFEST_SCHEMA` both carry it, rather than being declared twice.
  2. A non-boolean `defaultEnabled` fails validation the same way any other schema violation does — no bespoke error class, no silent coercion — and the D-09 lenient unknown-key tolerance is unchanged: a plugin declaring an unrelated unknown key still resolves.
  3. When both sites declare `defaultEnabled`, the marketplace entry value is the resolved one; absent at both sites resolves to `true`.
  4. The resolved value is readable from the resolver's output by the install path, so precedence is evaluated once rather than per consumer.
  5. Nothing a user can observe changes in this phase: install, list, info, update, reinstall and reconcile produce identical output to today for every plugin, including one that declares `defaultEnabled: false`.

**Plans**: 3 plans

Plans:

- [ ] 101-01-PLAN.md — the vertical slice: schema field, non-optional resolver output field, the single precedence helper threaded through the shared resolution path, the 16 fixture repairs the compile fan-out forces, and the compile-time proof that the value is exposed to the install path and absent from the `unavailable` arm
- [ ] 101-02-PLAN.md — the precedence matrix in both directions and both resolution modes, the agreement and fallback cases, and the two resolution-time validation guards
- [ ] 101-03-PLAN.md — schema accept/reject on both compiled validators, the whole-manifest rejection with its contrast to per-plugin containment, and the no-observable-change characterization across install and `info`

**Notes**:

  - Both declaration sites already flow through the same metadata group, so the
    schema half is small; the substance is where the resolved value hangs on the
    resolver's discriminated output and which arms carry it. A plugin resolving
    `unavailable` cannot be installed at all, so whether the value is exposed on
    that arm is a design question for the plan, not a requirement.
  - Upstream contract (verified 2026-08-14 against
    code.claude.com/docs/en/plugins-reference): default is `true`; Claude Code
    v2.1.154+ honors it, earlier versions ignore it and enable on install.

### Phase 102: Reason token, install write-through and notification

**Goal**: Installing a plugin whose author declared `defaultEnabled: false` leaves it disabled — recorded disabled, written through to config, and reported as such — so the state lands where reconcile already reads desired enablement from.
**Depends on**: Phase 101 (the single resolved `defaultEnabled` value)
**Requirements**: OUT-01, DFEN-04, DFEN-05, OUT-04
**Success Criteria** (what must be TRUE):

  1. Installing a plugin that resolves `defaultEnabled: false` produces an installation record marked disabled AND an `enabled: false` field in that scope's `claude-plugins.json` plugin entry — the first field the install write-back's currently-empty plugin patch has ever carried.
  2. That plugin's artifacts are not materialized. Its terminal state matches an ordinary disable: the record keeps its inventory (ENBL-18) and no skills, commands, agents, hooks or MCP entries appear on disk.
  3. An `enabled` value already present in the config entry wins over `defaultEnabled` and is never overwritten, in either direction — a user who wrote `enabled: true` for a `defaultEnabled: false` plugin gets it enabled, and a user who wrote `enabled: false` for a `defaultEnabled: true` plugin stays disabled.
  4. The install notification states that the plugin installed disabled and how to enable it, at informational severity — the desired state WAS reached (an install-disabled plugin is the author's declared intent, not a shortfall).
  5. The `installs disabled` token exists as one indivisible closed-set amendment: appended at the tail of `REASONS` (`shared/notify.ts`) with no existing entry reordered or reworded, and given a home in the `notify-reasons.ts` topic partition, whose compile-time completeness proof would otherwise fail.

**Plans**: TBD

**Notes**:

  - **OPEN QUESTION for `/gsd-discuss-phase` — materialization path for an
    install-disabled plugin.** The install ledger is a fixed literal 6-phase
    array (`orchestrators/plugin/install.ts:1239`) whose order is a contract
    under D-01 literal-array discipline ("never refactor to a dynamic builder").
    Does a `defaultEnabled: false` install run the five materialization phases
    and then drop the artifacts, or skip them and run only the state phase? This
    changes the ledger's shape and its rollback story. Do NOT resolve this at
    execution time.
  - **OPEN QUESTION for `/gsd-discuss-phase` — orchestrated-mode installs.** The
    config write-back is deliberately skipped in orchestrated mode
    (`orchestrators/plugin/install.ts:1409`), because reconcile derives desired
    state FROM the config and writing back would clobber a per-machine override.
    A cascade install (import, reconcile) of a `defaultEnabled: false` plugin
    therefore has no write-back seam, and its config entry already exists with
    `enabled` absent. Decide whether that pre-existing entry counts as the user's
    explicit setting (DFEN-05 wins, plugin enables) or as no setting at all
    (DFEN-04 applies). Do NOT resolve this at execution time.
  - The write-back seam is `persistence/config-write-back.ts::writePluginConfigEntry`,
    the sole sanctioned writer per SPLIT-02, with entry-level patch semantics.
  - Reason-token discipline (D-09 / OUT-08): membership and order are
    catalog-stable. New tokens append at the tail; existing entries never
    reorder. The last such amendment was `{unsupported component}` (D-90-05,
    REASONS 37→38).

### Phase 103: Reconcile stability and lifecycle non-reapplication

**Goal**: Once a plugin is installed disabled, nothing re-enables it behind the user's back — not the next `/reload`, not an `update`, not a `reinstall`.
**Depends on**: Phase 102 (the config entry the planner reads)
**Requirements**: DFEN-06, DFEN-07
**Success Criteria** (what must be TRUE):

  1. A `/reload` after installing a `defaultEnabled: false` plugin plans NO action for it. Verified against the reconcile planner's own output (`orchestrators/reconcile/plan.ts`), not merely asserted at the install boundary — the record must not land in `acc.enable.push(...)`, which is the exact path that would silently re-enable it.
  2. The steady state is a fixed point: a second and third `/reload` also plan nothing, so the plugin cannot oscillate between enabled and disabled across reloads.
  3. `update` and `reinstall` on an already-installed plugin never consult `defaultEnabled`, so a plugin release that changes the field does not flip a user who already installed.
  4. The converse holds: a user who ran `enable` on a `defaultEnabled: false` plugin stays enabled across reload, update and reinstall — their explicit choice survives, matching the upstream "an existing setting persists across update and reinstall" rule.

**Plans**: TBD

**Notes**:

  - This is the requirement that closes the hazard the design anchor names:
    reconcile is a config-to-record convergence loop rerunning on every
    `/reload`, and desired enabled-state comes ONLY from `claude-plugins.json`
    via the `isDeclaredEnabled` call at `orchestrators/reconcile/plan.ts:301`.
    Installing a `defaultEnabled: false` plugin as a disabled record while
    leaving its config entry `{}` would take the recorded-and-declared-enabled
    path and re-enable it at the next reload. Phase 102's write-through is what
    makes this stable; this phase proves it at the planner.
  - Whether the DFEN-07 guarantee needs new code or is already structural
    (update/reinstall have no reason to read the manifest's `defaultEnabled`) is
    a characterization question for the plan. If it is already true, pin it as a
    regression rather than inventing a mechanism.

### Phase 104: Pre-install read surfaces

**Goal**: A user can see that a plugin will install disabled before committing to the install, and both read paths stay offline while saying so.
**Depends on**: Phase 101 (resolved value), Phase 102 (the token, and the install behavior these surfaces are claiming)
**Requirements**: OUT-02, OUT-03, OUT-05
**Success Criteria** (what must be TRUE):

  1. `plugin list` renders `{installs disabled}` on the row of a not-installed plugin whose resolved `defaultEnabled` is `false`, in the established subject-first row grammar (`<glyph> <name> [scope] (status) {reason}`).
  2. `plugin info` reports that the plugin will install disabled, so the fact is visible before the install is run.
  3. Neither surface issues a network call (NFR-5). The marketplace entry is always readable from the cached manifest, so an entry-declared `defaultEnabled: false` renders on every plugin including an unfetched `(remote)` one.
  4. When the marketplace entry is silent and the value could only come from a `plugin.json` inside an unmaterialized clone, neither surface claims `{installs disabled}` and neither fetches in order to read it. Declining to claim is the correct answer, not a gap.
  5. An installed plugin's row is unaffected — `{installs disabled}` is a statement about a future install, so it never appears on an installed, disabled, partially-installed or degraded row.

**Plans**: TBD

**Notes**:

  - Criterion 5 follows the durable-vs-transient guidance recorded at the Phase
    95 discuss session (D-95-01/02/03): steady-state inventory rows state
    durable facts about the record; `{installs disabled}` is a claim about an
    action not yet taken, so it belongs on not-installed rows only. Confirm the
    exact arm set at discuss.
  - Where a warm clone already exists, `plugin.json` IS readable fs-only with no
    network (the Phase 80 warm-cache resolution path). Whether to read it there —
    and accept that the same plugin renders differently warm vs cold — is a
    design question for discuss, not a requirement. OUT-05 only forbids
    fetching.

### Phase 105: No-op parity sweep and contract documentation

**Goal**: A plugin that says `defaultEnabled: true`, or says nothing at all, behaves exactly as it did before this milestone; and the contract records both the new token and the divergence this milestone deliberately does not close.
**Depends on**: Phase 102, Phase 103, Phase 104 (all behavior in place before the sweep and the catalog reconcile)
**Requirements**: DFEN-08, DOC-01, DOC-02
**Success Criteria** (what must be TRUE):

  1. `defaultEnabled: true` and an absent `defaultEnabled` produce byte-identical behavior and output to pre-milestone across all six surfaces — install, update, reinstall, list, info and reconcile — so the overwhelming majority of plugins are untouched by this milestone.
  2. `docs/output-catalog.md` carries the `installs disabled` token and every surface that emits it, reconciled against what actually shipped rather than what was planned.
  3. The dependency-requirement override is documented as a known divergence: Claude Code writes an explicit `enabled: true` for a plugin another active plugin requires, and we cannot, because plugin dependency declarations are dropped entirely today (BACKLOG.md PDEP-01). A reader can tell this is a stated limit, not an oversight.
  4. The closed sets stay closed: `REASONS` grew by exactly one member at the tail, and no status token, glyph, installation-record key or state schema version was added.

**Plans**: TBD

**Notes**:

  - House precedent for this shape: v1.18 Phase 98 and v1.17 Phase 94 both
    landed the regression sweep and the contract reconcile last, after the
    behavior phases, so the docs describe shipped behavior instead of intent.
  - The v1.18 architecture test already holds the structural clauses of the
    no-expansion promise (four closed sets by enumeration equality, seven glyph
    code points with an eighth-glyph tripwire, the record's key set, the
    schema-version union, the network clause). Criterion 4 is that test
    continuing to pass with exactly one intended enumeration delta.
  - DFEN-V2-01 (honoring the dependency-requirement override) stays out of
    scope and blocked on PDEP-01; DOC-02 is what makes that visible to a reader.

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 101. Manifest field and precedence resolution | defaults-enabled | 0/3 | Planned | - |
| 102. Reason token, install write-through and notification | defaults-enabled | 0/? | Not started | - |
| 103. Reconcile stability and lifecycle non-reapplication | defaults-enabled | 0/? | Not started | - |
| 104. Pre-install read surfaces | defaults-enabled | 0/? | Not started | - |
| 105. No-op parity sweep and contract documentation | defaults-enabled | 0/? | Not started | - |

## Requirement Coverage

All 15 v1 requirements map to exactly one phase. No orphans, no duplicates.

| Phase | Requirements | Count |
|-------|--------------|-------|
| 101 | DFEN-01, DFEN-02, DFEN-03 | 3 |
| 102 | OUT-01, DFEN-04, DFEN-05, OUT-04 | 4 |
| 103 | DFEN-06, DFEN-07 | 2 |
| 104 | OUT-02, OUT-03, OUT-05 | 3 |
| 105 | DFEN-08, DOC-01, DOC-02 | 3 |
| **Total** | | **15/15** |
