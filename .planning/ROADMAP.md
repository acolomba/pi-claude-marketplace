# Roadmap: pi-claude-marketplace

## Milestones

- 🚧 **v1.18 Manifest-Independent Installed Plugin Info** — Phases 95-100 (all six complete and verified; Phase 100 closed 2026-08-12 on human UAT; target npm 0.14.0) — installed plugins remain visible, inspectable, and uninstallable after their entry disappears from a valid marketplace manifest, a disabled partially-installed plugin is once again recognized as disabled, and a disabled plugin keeps describing itself
- ✅ **v1.17 env-parity** — Phases 90-94 (shipped 2026-08-05, target npm 0.13.0) — full detail: `milestones/v1.17-ROADMAP.md`
- ✅ **v1.16 stop-hooks** — Phases 87-89 (shipped 2026-07-31, npm 0.12.0) — full detail: `milestones/v1.16-ROADMAP.md`
- ✅ **v1.15 frontmatter-compliance** — Phase 86 (shipped 2026-07-27, npm 0.11.1) — full detail: `milestones/v1.15-ROADMAP.md`
- ✅ **v1.14 mcp-string-refs** — Phase 85 (shipped 2026-07-23) — full detail: `milestones/v1.14-ROADMAP.md`

## Phases

### In progress v1.18 Manifest-Independent Installed Plugin Info

**Phase Numbering:**

- Integer phases (95-98): planned milestone work continuing the global counter
  from Phase 94, the final v1.17 phase.

- Decimal phases (95.1, 96.1): urgent insertions only, marked `INSERTED`.

- [x] **Phase 95: Manifest-independent installed inventory** — characterize first, then change three things. The list inventory is already the union of a successfully loaded manifest and the installation records, and partial, disabled, and `--installed` behavior already survive manifest absence; those become characterization tests. The production changes are lifting the row builder's omission of reasons on installed rows so `{not in manifest}` can render, threading the manifest load error through the cross-scope orphan-fold path so an unreadable manifest is never reported as a missing entry, and widening the LLM tool surface's reason projection so the same fact reaches the agent. (INV-01, INV-02, INV-03, INV-04, INV-05, BOUND-03) (completed 2026-08-08)
- [x] **Phase 96: Installation-record-backed plugin info** — the milestone's substantive phase. Reorder the info lookup so a successful manifest load with no entry falls through to the installation record instead of returning `(failed)`, reconstruct the component inventory from existing resource fields and the materialized hook config, preserve installed and partial compatibility on the state-only arm, and add the explicit network guard the reorder now requires for `--fetch`. The unknown-name and manifest-read boundaries already hold and are pinned as regressions. (INFO-09, INFO-10, INFO-11, INFO-12, BOUND-01, BOUND-02) (completed 2026-08-09)
- [x] **Phase 97: Disabled-state classification repair** — the disabled-state predicate conjoins `compatibility.installable` with `!enabled`, and a partial install always persists `installable: false`, so disabling a partially-installed plugin produces a record no surface recognizes as disabled. Collapse the four copies of the predicate into one definition keyed only on `enabled`, then restore correct behavior across the five affected surfaces: list and info rendering, enable and disable idempotency, reconcile steady state, and the update short-circuit. This repairs ENBL-04, shipped in v1.12 and silently broken by partial installs. (ENBL-05, ENBL-06, ENBL-07, ENBL-08, ENBL-09) (completed 2026-08-09)
- [x] **Phase 98: Lifecycle regression and contract documentation** — no lifecycle production changes are expected. Uninstall is already installation-record-driven and update and autoupdate already skip manifest-absent records, so this phase pins those with coverage spanning all five resource kinds and all four update enumeration paths, asserts no persistence, token, or network expansion, and reconciles the output catalog, the PRD, and the design doc against the behavior the first three phases actually shipped. (LIFE-04, LIFE-05, LIFE-06, COMPAT-01, DOC-08) (completed 2026-08-10)

**Open decisions:** resolved at the Phase 95 discuss session on 2026-08-08
unless noted. Decision records live in
`phases/95-manifest-independent-installed-inventory/95-CONTEXT.md`.

1. **Reason braces on installed inventory rows — RESOLVED (D-95-01/02/03).**
   Installed rows may carry reason braces, under a **general rule**: the
   orchestrator stamps whatever typed reasons apply and `shared/notify.ts`
   renders them, exactly as every other status arm works. No allowlist in the
   render path, because the house invariant is that orchestrators determine
   state while notify stays a dumb renderer. The recorded guidance for future
   authors is **durable vs transient** — steady-state inventory rows may state
   durable facts about the record, not conditions tied to a pending action.

   Two corrections to the premise. There is no render-map suppression to
   reverse (see the criterion-2 correction above). And the recorded rationale
   cites `RLD-04` / `D-08`, of which only `D-08` is undefined — it appears
   only in source comments, where it also carries several unrelated meanings,
   so it is not carried forward. `RLD-04` IS defined, at
   `.planning/milestones/notification-refactor-REQUIREMENTS.md:30`, and is
   cited in a live test title at `tests/shared/notify-v2.test.ts:1299`; it
   stays a valid anchor. "orphan-rewake" appears nowhere but two `list.ts`
   comments.

   > Corrected during Phase 99. The original text said neither anchor was
   > defined in any surviving artifact, and `RLD-04` was dropped from seven
   > source comments on that basis before the phase's own review caught it;
   > the anchor was restored at the six sites whose sentences state its
   > content.

2. **Component name fidelity on the state-only info arm — DEFERRED to Phase 96
   discuss (D-95-11).** `resources.*` holds Pi-generated installed names; `info`
   renders raw source names today. Either display the generated names and
   document the divergence, or reverse-map them by stripping the deterministic
   prefixes. Re-gated because it governs no Phase 95 code — list rows carry
   plugin names, not component names — and Phase 96 discuss will have the
   `info.ts` reconstruction in front of it.

3. **LLM tool-surface exposure — RESOLVED (D-95-06/07).** v1.18 **widens** the
   projection: `pluginReasons` forwards reasons for both `installed` and
   `partially-installed`, tracked as INV-05 and landing in Phase 95 beside
   INV-01. Two findings drove this away from the prior Out of Scope position:
   `projectRowStatus` already flattens four statuses into `installed`, so a
   degraded install is today indistinguishable from a clean one in the tool
   payload; and `upgradable` already forwards reasons while also projecting to
   `installed`, so the exclusion was never a held principle.

<details>
<summary>✅ v1.17 env-parity (Phases 90-94) — SHIPPED 2026-08-05</summary>

- [x] **Phase 90: Session environment initialization** (3/3 plans) — completed 2026-08-04
  At session start the extension sets `CLAUDECODE=1`, `CLAUDE_CODE_SESSION_ID=<Pi
  session id>`, and the pi-only `CLAUDE_SESSION_ID` alias on Pi's live
  `process.env`, and appends each installed enabled plugin's `<pluginRoot>/bin`
  to `PATH` via the `PI_CLAUDE_MARKETPLACE_PATH` ledger (PENV-01). Gap-closure
  riders: `bin` install-by-default (D-90-06), the `{unsupported component}`
  reason token (D-90-05), and the arm-aware install reason classifier (SURF-01).
  (SENV-01, SENV-02, SENV-03, PENV-01)

- [x] **Phase 91: Hook environment parity** (1/1 plans) — completed 2026-08-03
  `CLAUDECODE=1` and `CLAUDE_CODE_SESSION_ID` (from the snapshotted
  `transCtx.sessionId`) join the existing four `CLAUDE_*` vars on both hook
  spawn lanes — `prepareEnv` and its hand-mirror `prepareAsyncEnv` — pinned
  together by a behavioral drift-guard test. (HENV-01, HENV-02)

- [x] **Phase 92: MCP staging parity** (2/2 plans) — completed 2026-08-03
  `stampServers` substitutes `${CLAUDE_PLUGIN_ROOT}`/`${CLAUDE_PLUGIN_DATA}`/
  (project-scope) `${CLAUDE_PROJECT_DIR}` throughout each server's
  `command`/`args`/`env` and injects the same set into each stdio server's `env`
  with declared-keys-win precedence, re-derived on every `update`/`reinstall`
  re-stage. (MENV-01, MENV-02, MENV-03, MENV-04)

- [x] **Phase 93: Substitution completion** (2/2 plans) — completed 2026-08-03
  `${CLAUDE_SKILL_DIR}` and project-scope `${CLAUDE_PROJECT_DIR}` join the
  install-time substitution set in staged skill/command/agent content;
  user-scope `${CLAUDE_PROJECT_DIR}` passes through untouched (documented).
  (SUB-01, SUB-02)

- [x] **Phase 94: Environment-variable documentation** (1/1 plans) — completed 2026-08-03
  New authoritative `docs/env-vars.md` (per-variable × per-surface matrix,
  two-mechanism model, divergences incl. the verified pi-mcp-adapter
  `resolveEnv` inheritance finding) with the `docs/hooks-compatibility.md` env
  table reconciled against it. (DOC-06, DOC-07)

</details>

<details>
<summary>✅ v1.16 stop-hooks (Phases 87-89) — SHIPPED 2026-07-31</summary>

- [x] **Phase 87: Bucket-A admission & platform floor** (3/3 plans) — completed 2026-07-30
  `BUCKET_A_EVENTS` grows 8→10, the per-event matcher dispositions land (`Stop` takes
  the `null` no-matcher sentinel; `StopFailure` takes the closed 10-value error-type
  set), and the `@earendil-works/pi-coding-agent` peer floor rises to `>=0.80.5` — so
  a plugin declaring `Stop`/`StopFailure` alongside already-supported events resolves
  available and `ralph-wiggum` + `hookify` flip to fully available, without yet
  dispatching.

- [x] **Phase 88: `agent_settled` dispatcher, Stop contract & StopFailure** (5/5 plans) — completed 2026-07-30
  One `agent_settled` subscriber gated on the final assistant message's `stopReason`
  fires `Stop` on genuine completion (`stop`) and `StopFailure` on `error`/`length`,
  suppressing both on `aborted`; `Stop` delivers the full hook-observable
  decision-control contract (block re-entry, exit-2, `additionalContext`,
  `continue:false` precedence) and loop protections (`stop_hook_active`, 8-re-entry
  cap), while `StopFailure` is observation-only with the classified error type.

- [x] **Phase 89: Documentation reconcile** (3/3 plans) — completed 2026-07-31
  `docs/hooks-compatibility.md` flips the `Stop`/`StopFailure` rows to supported
  (timing-shift caveat + error-type matcher row) and rewrites the stale hard-trip
  install-time disposition section for the force-install partial-partition model;
  `docs/research/claude-hooks-vs-pi-events.md` retires the "`agent_end` is
  observation-only" claim and adds `agent_settled`.

</details>

<details>
<summary>✅ v1.15 frontmatter-compliance (Phase 86) — SHIPPED 2026-07-27</summary>

- [x] Phase 86: Skill and command frontmatter compliance (5/5 plans) — completed 2026-07-26
  The skills and commands bridges parse source frontmatter with Pi's own
  `parseFrontmatter` before rewriting, never stage bytes Pi rejects, degrade a broken
  skill (synthesized `disable-model-invocation` block, body verbatim) or command
  (neutralized, name-from-filename) at Claude-Code parity, fold a skill's `when_to_use`
  into the description Pi actually reads, and surface + classify each failure as a warning —
  while the ~99% of already-valid components stay byte-for-byte unchanged (issue #101).

</details>

<details>
<summary>✅ v1.14 mcp-string-refs (Phase 85) — SHIPPED 2026-07-23</summary>

- [x] Phase 85: `mcpServers` string file-path references (2/2 plans) — completed 2026-07-23
  Resolves a `./`-relative string `mcpServers` (marketplace entry OR `plugin.json`)
  to a wrapped `.mcp.json` inside the plugin root and installs its servers at parity
  with the inline form; a missing / malformed / out-of-root reference isolates that
  one plugin to `(unavailable) {malformed mcp}`, never failing the marketplace load.

</details>

## Phase Details

### Phase 95: Manifest-independent installed inventory

**Goal:** Users see every installed plugin represented truthfully in list output after a valid marketplace manifest drops its entry, without flattening partial or disabled state.

**Depends on:** Nothing; this is the first v1.18 phase and touches the list inventory/classification path only.

**Requirements:** INV-01, INV-02, INV-03, INV-04, INV-05, BOUND-03

**Success Criteria:**

1. Characterization tests pin the current manifest-absent list behavior before any production edit: partial records keep `(partially-installed)` with their unsupported-kind reasons, disabled records stay `(disabled)`, and `--installed` spans both enabled forms. (INV-02, INV-03, INV-04)
2. The default list renders a fully supported enabled state-only record as `● <plugin> v<recorded-version> (installed) {not in manifest}` under its marketplace. The recorded version is used for the partial row too. (INV-01)
3. Soft-dependency markers still compose after the new reason rather than being displaced by it. (INV-01, INV-02)
4. A folded row whose manifest failed to load never renders `{not in manifest}`; the fold path distinguishes a failed read from a successful read with no entry. (BOUND-03)
5. The LLM tool payload carries the reason on both `installed` and `partially-installed` rows, so the slash command and the tool surface report the same fact. Asserted on the tool output, not inferred from the row builder. (INV-05)

**Criterion 2 note (2026-08-08, retracted and restated after Phase 95 research):** an earlier same-day amendment claimed there was no render-map suppression to lift. That claim was wrong and is withdrawn — the original criterion-2 wording is correct. The list surface does NOT render through the central `renderPluginRow` switch in `shared/notify.ts`; it dispatches through `context.render[row.status]` (`shared/notify-context.ts:110-113`, routed at `list.ts:1210` via `LIST_CONTEXT`). `LIST_RENDER.installed` (`orchestrators/plugin/list.messaging.ts:96-107`) hardcodes `undefined` into `installedLikeRow`'s `reasons` parameter. **INV-01 is therefore a two-file edit** — stamp `reasons` in the `list.ts` row builder AND pass `p.reasons` through in `list.messaging.ts`. Changing only `list.ts` produces no visible output change.

**Plans:** 2/2 plans complete

Plans:
**Wave 1**

- [x] 95-01-PLAN.md — characterize the manifest-absent list behavior, then thread the manifest-load outcome and render `{not in manifest}` on the installed and partially-installed rows (INV-01, INV-02, INV-03, INV-04, BOUND-03)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 95-02-PLAN.md — widen the LLM tool surface's reason projection so the agent-facing payload states the same fact as the rendered row (INV-05)

### Phase 96: Installation-record-backed plugin info

**Goal:** Users can inspect a manifest-absent installation from current local installation data while retaining accurate partial-state and failure-boundary semantics.

**Depends on:** Phase 95, whose state-only classification establishes the shared public inventory semantics that info must match.

**Requirements:** INFO-09, INFO-10, INFO-11, INFO-12, BOUND-01, BOUND-02

**Success Criteria:**

1. Info reports a fully supported state-only record as `(installed) {not in manifest}` with its recorded version, while a record with unsupported kinds remains `(partially-installed)` with both reason classes derived from the persisted record. The existing disabled carve-out runs before this path and must keep doing so. (INFO-09, INFO-10)
2. Info renders installed skills, commands, agents, and MCP server names sorted, plus hook entries in materialized declaration order, reconstructed from existing resources and the materialized hook configuration. Missing, unreadable, or malformed materialized hook config degrades rather than failing the block, and the read passes the containment guard. (INFO-11)
3. Missing, unreadable, malformed, and invalid manifests retain their current read-failure results, while a name absent from both a valid manifest and installation state remains `(failed) {not in manifest}`. (BOUND-01, BOUND-02)
4. Bare info and `info --fetch` perform no network operation for the state-only fallback, asserted against injected clone and auth seams with a zero-call check rather than inferred from the control flow. (INFO-12)

**Plans:** 4/4 plans complete

Plans:
**Wave 1**

- [x] 96-01-PLAN.md — pin the manifest-read-failure boundary with a record present, then split `buildBlock`'s not-in-manifest arm and render the installation record end to end with its four name-list component kinds (INFO-09, INFO-10, INFO-11, BOUND-01, BOUND-02)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 96-02-PLAN.md — reconstruct hook entries from the materialized configuration behind the containment guard, with the truthful degradation split (INFO-11)

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 96-03-PLAN.md — assert network abstinence against injected clone and auth seams, and report a requested `--fetch` as skipped instead of swallowing it (INFO-09, INFO-12)

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 96-04-PLAN.md — ratify the folded-row manifest authority with regression pins and close the open question in the source comments and the output catalog (BOUND-01, BOUND-02)

### Phase 97: Disabled-state classification repair

**Goal:** A disabled partially-installed plugin is recognized as disabled by every surface, restoring the orthogonality of declared, enabled, and available that ENBL-04 asserts.

**Depends on:** Phase 95, which establishes the disabled-row characterization for the canonical shape that this phase widens to the partial shape. Independent of Phase 96.

**Requirements:** ENBL-05, ENBL-06, ENBL-07, ENBL-08, ENBL-09

**Success Criteria:**

1. One disabled-state predicate keyed only on `enabled` replaces the four independently-drifting copies; the drift-guard test and the truth-table cell that pins the defective behavior are both updated, and the reconcile comment asserting a false invariant is corrected. (ENBL-05)
2. `list` and `info` render a disabled partially-installed record as `(disabled)`, distinct from an enabled partial, and a manifest-absent one carries no `{not in manifest}` reason. (ENBL-06, composing with INV-04)
3. `enable` re-materializes a disabled partial record rather than reporting "already enabled"; `disable` on an already-disabled partial record is idempotent rather than re-running the unstage cascade. (ENBL-07)
4. Reconcile reaches steady state for a disabled partial record across repeated passes. (ENBL-08)
5. `update` leaves a disabled partial record alone rather than re-staging its artifacts. (ENBL-09)
6. No state migration or schema-version change is introduced; records already on disk in the unrecognized shape reclassify correctly on the next load.

**Plans:** 5/5 plans complete

Plans:
**Wave 1**

- [x] 97-01-PLAN.md — tracer: collapse the four disabled-state predicate copies into one definition in `persistence/state-io.ts`, repoint every consumer, update the truth-table cell and replace the drift gate, and turn the CR-01 repro green (ENBL-05, ENBL-06)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 97-02-PLAN.md — byte-pin the disabled-partial `(disabled)` row against the enabled-partial contrast, pin the `--fetch` skip-note switch, and reconcile the stale two-axis-marker prose across the render surfaces and the output catalog (ENBL-06)
- [x] 97-03-PLAN.md — partial-capable enable branch plus the re-materialization, manifest-absent fail-clean boundary, and disable-idempotency byte-locks (ENBL-07)
- [x] 97-04-PLAN.md — guard the load-time backfill scan against disabled records and pin the two-pass planner fixed point (ENBL-08)
- [x] 97-05-PLAN.md — derive the availability discriminant in the disabled-record refresh and pin the `update --partial` short-circuit and its idempotency (ENBL-09)

### Phase 98: Lifecycle regression and contract documentation

**Goal:** The new read behavior and the disabled-state repair ship without mutation, persistence, network, or public-contract regressions.

**Depends on:** Phases 95, 96, and 97; lifecycle and documentation coverage describe and verify the completed behavior.

**Requirements:** LIFE-04, LIFE-05, LIFE-06, COMPAT-01, DOC-08

**Success Criteria:**

1. Uninstall after manifest-entry removal removes every owned resource and the installation record through the existing path, with coverage spanning all five resource kinds including hooks and MCP cleanup. (LIFE-04)
2. Targeted, marketplace-bulk, and global-bulk plugin update plus marketplace autoupdate all continue to render `(skipped) {not in manifest}` for the state-only record. (LIFE-05, LIFE-06)
3. Architecture/contract checks prove no manifest snapshot, orphan field, schema migration, status, reason, glyph, or network path was added. Any new source-scanning gate reads files directly rather than shelling out to `grep`, because a line tool that classifies a file as binary reports nothing and exits cleanly, greening a clause on a file it never read. The premise the rule was written from is resolved: `orchestrators/plugin/info.ts` holds its hook-dedup separator as an ESCAPE with an inline comment saying why, so the file is ordinary text today. The rule stands on the silent-skip hazard alone. (COMPAT-01)
4. `docs/output-catalog.md` and the PRD document fully installed, partially-installed, disabled, unknown-name, manifest-read, update, and uninstall behavior, including the repaired disabled-partial case, and the known documentation defects named in DOC-08 are corrected. (DOC-08)

**Plans:** 6/6 plans complete

Plans:
**Wave 1**

- [x] 98-01-PLAN.md — thread the orphan-rewake signal through the install outcome and the staged agent and MCP counts through both enable arms, on one shared signals shape (IN-07, WR-06)
- [x] 98-02-PLAN.md — per-kind uninstall regression coverage for a manifest-absent record across all five resource kinds plus the empty-resources edge (LIFE-04)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 98-03-PLAN.md — remediation affordance on a stale-gate enable failure, and disabled records reachable by plain update (WR-02, WR-04)

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 98-04-PLAN.md — the single no-expansion contract gate: closed-set enumeration equality, glyph pins, record key set, schema version, delegated network clause (COMPAT-01)
- [x] 98-05-PLAN.md — update-skip coverage across the three enumeration paths and autoupdate-skip coverage in both halves (LIFE-05, LIFE-06)

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 98-06-PLAN.md — bounded documentation accuracy sweep: output catalog, design document with a redrawn flowchart, and four source-comment sites (DOC-08)

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 95. Manifest-independent installed inventory | v1.18 | 2/2 | Complete    | 2026-08-08 |
| 96. Installation-record-backed plugin info | v1.18 | 4/4 | Complete    | 2026-08-09 |
| 97. Disabled-state classification repair | v1.18 | 5/5 | Complete    | 2026-08-09 |
| 98. Lifecycle regression and contract documentation | v1.18 | 6/6 | Complete    | 2026-08-10 |
| 99. Post-audit tech-debt closure | v1.18 | 7/7 | Complete    | 2026-08-10 |
| 100. Disabled-plugin information retention | v1.18 | 5/5 | Complete    | 2026-08-12 |
| 90. Session environment initialization | v1.17 | 3/3 | Complete    | 2026-08-04 |
| 91. Hook environment parity | v1.17 | 1/1 | Complete    | 2026-08-03 |
| 92. MCP staging parity | v1.17 | 2/2 | Complete    | 2026-08-03 |
| 93. Substitution completion | v1.17 | 2/2 | Complete    | 2026-08-03 |
| 94. Environment-variable documentation | v1.17 | 1/1 | Complete    | 2026-08-03 |
| 87. Bucket-A admission & platform floor | v1.16 | 3/3 | Complete | 2026-07-30 |
| 88. `agent_settled` dispatcher, Stop contract & StopFailure | v1.16 | 5/5 | Complete | 2026-07-30 |
| 89. Documentation reconcile | v1.16 | 3/3 | Complete | 2026-07-31 |
| 86. Skill and command frontmatter compliance | v1.15 | 5/5 | Complete | 2026-07-26 |
| 85. `mcpServers` string file-path references | v1.14 | 2/2 | Complete | 2026-07-23 |

### Phase 99: Post-audit tech-debt closure — COMPLETE 2026-08-10

**Goal:** Every debt item the v1.18 milestone audit enumerated is closed before the milestone ships: the three integration fragility warnings, the update-verb degradation-signal gap, the documentation deferrals, and the two legacy carriers.

**Outcome:** All seven items closed and verified against the code. Verification `passed` 5/5, nyquist-compliant; security `SECURED`, `threats_open: 0`. The two-iteration review loop additionally closed a user-visible defect (a degraded `update --partial` rendered a clean-looking row on a path the autoupdate cascade reaches with no user flag) and corrected three documents that asserted things the code had falsified — including an `ARCHITECTURE.md` claim that a no-cycle rule enforced the D-11 boundary when none existed.

**Requirements:** none — post-audit debt closure; items tracked in `.planning/v1.18-MILESTONE-AUDIT.md` (tech_debt frontmatter) and the three pending todos (operator decision 2026-08-10: address all four groups before completing v1.18)

**Depends on:** Phase 98

**Success Criteria:**

1. `ManifestLookup` is exported and consumed as a value by every surface that judges manifest absence (list, info, update) — no surface re-derives the successful-read rule independently.
2. The ENBL-05 drift gate catches the destructured, bracket-access, and Boolean-comparison twin spellings; reinstall's colliding `stagedAgents`/`stagedMcpServers` string-array fields are renamed apart from the shared signal booleans.
3. `update` threads degradation signals: a malformed skill pulled by an update renders its reasons brace with the WARN-01 raise, on both the standalone and cascade surfaces, with catalog + style-guide amendments (closes WR-12).
4. The autoupdate cascade skip row has a catalog state with a FIXTURES entry; the description-bearing variant count is corrected; the residual `RLD-04`/`D-08` anchors are re-anchored or dropped at the six named sites (skipping the four files where `D-08` legitimately means something else).
5. A disabled record whose `resolvedSource` moved while the version pin did not is refreshed rather than left stale; the rare-failure-arm coverage sweep lands the tests named in the 2026-06-12 todo (bounded to its named arms in update/reinstall/install).

**Plans:** 7/7 plans complete

Plans:
**Wave 1**

- [x] 99-01-PLAN.md — Rename the colliding staged-name string arrays on BOTH outcome interfaces (D-99-02c; the enabler that unblocks 99-04)
- [x] 99-02-PLAN.md — Widen the ENBL-05 drift gate to the destructured, bracket-access and Boolean twin spellings (D-99-02b)
- [x] 99-03-PLAN.md — Close the three 98-06 documentation deferrals: cascade skip-row catalog state, nine-variant count, seven dangling anchor sites (D-99-04)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 99-04-PLAN.md — Thread the malformed-component degradation signal through `update` on both render surfaces, with catalog state, fixture and style-guide amendment (WR-12 / D-99-03)

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 99-05-PLAN.md — Export the manifest-membership discriminant from `domain/` and rewire list, info and update onto it, behind a drift gate (D-99-02a)

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 99-06-PLAN.md — Refresh a disabled record whose source or compatibility moved under an unchanged version, with the deep-equal guard made load-bearing (D-99-05a)

**Wave 5** *(blocked on Wave 4 completion)*

- [x] 99-07-PLAN.md — Measure the residual rare-failure arms, then cover them in update/reinstall/install within the locked bound (D-99-05b)

### Phase 100: Disabled-plugin information retention

**Goal:** Disabling a plugin deregisters its resources from Pi without discarding
the record's description of them, so `info` on a disabled plugin reports what the
plugin contains even when the marketplace manifest no longer declares it.

**Operator decision (2026-08-11):** a disabled plugin's artifacts must be removed
or deregistered from Pi, but its own descriptor stays. `info` must not lose
information, and it must still say the plugin is disabled.

**Requirements**: ENBL-10, ENBL-11, ENBL-12, ENBL-13, ENBL-14, ENBL-15, ENBL-16,
ENBL-17, ENBL-18, ENBL-19 — assigned at planning from the research pass's proposed
set. ENBL-19 covers a hazard no discuss decision anticipated: retaining the record's
resource names makes `plugin enable` self-conflict against its own record unless the
install ledger's cross-plugin guard excludes it. ENBL-16 supersedes INV-04.

**Depends on:** Phase 99

**Problem.** `toDisabledRecord` zeroes all five `resources.*` arrays, and the
`DisabledPluginRecord` branded type pins them to the empty tuple so a populated
disabled record is a compile error. The inventory is therefore destroyed at
disable time. Combined with a manifest that later drops the entry, nothing
anywhere can say what the plugin installed -- the one case v1.18 otherwise
repaired for enabled records. Observed 2026-08-11: a disabled, manifest-absent
plugin renders a bare `(disabled)` row from both `list` and `info`, with
`resources` empty in `state.json`.

**Scoping already established** (verified against the code, not assumed):

- Nothing reads resources-emptiness as a signal any more; ENBL-05 removed the
  last reader, so relaxing the shape breaks no predicate.

- Unstage is ENOENT-tolerant per name, so uninstalling a disabled record whose
  artifacts are already gone stays a no-op rather than an error.

- `enable` re-runs `runInstallLedger`, whose state phase OVERWRITES `resources`
  wholesale and sets `enabled: true`, so a populated disabled record cannot
  stale-merge on re-enable.

- COMPAT-01 pins the install record's KEY SET, not its values, so the change
  trips no architecture gate.

- 14 test files assert the disabled+empty shape and 3 reference the branded
  type; each assertion needs judging as pinning the retired MARKER (now wrong)
  or the still-correct BEHAVIOR.

**Open decisions for discuss:**

1. **Hooks while disabled.** `readStateOnlyHookEntries` reads the materialized
   `hooks/<slug>/hooks.json`, which disable correctly unstages, so the hooks line
   would report a read failure -- trading one wrong answer for another. Needs a
   distinct not-materialized-while-disabled arm, or the detail must live in the
   record. Same truthful-split problem D-96-03 solved for manifest absence.

2. **Records disabled before this change.** Their inventory is already gone and
   is unrecoverable from the record. It can be re-derived from the manifest only
   while the plugin is still declared -- which excludes the very case this phase
   exists to fix. Decide backfill-on-cycle, backfill-on-reconcile, or none.

3. **Reasons on a disabled row.** The catalog suppresses them because "a disabled
   plugin is in the user-requested state, not a failure state", a rationale that
   predates v1.18 establishing that reasons are not failures (`{not in manifest}`
   rides a successful `(installed)` row). Today a disabled plugin whose
   marketplace dropped it gets no signal. Settle it here rather than touching the
   disabled arm twice.

> **Scoping correction (2026-08-11, recorded at discuss and confirmed at
> planning).** The claim above that nothing reads resources-emptiness as a signal
> is FALSE. Four readers were found. One is a correctness hazard —
> `hydrateScopeFromState` uses emptiness as the disabled filter for hook routing
> and carries no enabled guard — and one is phase-breaking: the install ledger's
> cross-plugin conflict guard walks every record's resource names against the RAW
> state, so retention makes an enable self-conflict. Two of the three readers
> named at discuss need no code change; a fourth, found at research, does.

**Plans:** 5/5 plans complete

Plans:
**Wave 1**

- [x] 100-01-PLAN.md — retention spine: disable keeps the inventory, hooks stay deregistered, enable still works (ENBL-13, ENBL-14, ENBL-18, ENBL-19)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 100-02-PLAN.md — the `hookEntries` record key, its three write sites and its read ladder (ENBL-10, ENBL-11, ENBL-12)
- [x] 100-03-PLAN.md — the disabled list row carries `{not in manifest}`; INV-04 superseded (ENBL-15, ENBL-16)

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 100-04-PLAN.md — the disabled `info` arm routes through the shared block builder (ENBL-17)

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 100-05-PLAN.md — disabled-info catalog state, byte fixture and coverage (ENBL-16, ENBL-17)
