# Roadmap: pi-claude-marketplace

## Milestones

- ✅ **v1.18 Manifest-Independent Installed Plugin Info** — Phases 95-100 (shipped 2026-08-12, npm 0.14.0) — full detail: `milestones/v1.18-ROADMAP.md`
- ✅ **v1.17 env-parity** — Phases 90-94 (shipped 2026-08-05, target npm 0.13.0) — full detail: `milestones/v1.17-ROADMAP.md`
- ✅ **v1.16 stop-hooks** — Phases 87-89 (shipped 2026-07-31, npm 0.12.0) — full detail: `milestones/v1.16-ROADMAP.md`
- ✅ **v1.15 frontmatter-compliance** — Phase 86 (shipped 2026-07-27, npm 0.11.1) — full detail: `milestones/v1.15-ROADMAP.md`
- ✅ **v1.14 mcp-string-refs** — Phase 85 (shipped 2026-07-23) — full detail: `milestones/v1.14-ROADMAP.md`

## Phases

<details>
<summary>✅ v1.18 Manifest-Independent Installed Plugin Info (Phases 95-100) — SHIPPED 2026-08-12</summary>

- [x] **Phase 95: Manifest-independent installed inventory** (2/2 plans) — completed 2026-08-08
  `list` states `{not in manifest}` on installed and degraded rows whose
  marketplace no longer declares them, and never states it about a manifest it
  failed to read — the claim authority is a `ManifestLookup` discriminated value
  that keeps a failed read distinguishable from a successful read that missed.
  The LLM tool surface forwards reasons on all four installed-family arms.
  (INV-01..05, BOUND-03)

- [x] **Phase 96: Installation-record-backed plugin info** (4/4 plans) — completed 2026-08-09
  `info` falls through to the installation record when a valid manifest lacks
  the entry, reconstructing the component inventory locally and reading hooks
  from the new additive `hookEntries` record key — and when it cannot read them
  the `hooks:` line disappears in favor of a closed-set reason, so silence never
  passes for a verified absence. D-96-02 settles that a folded row reads its own
  record's manifest. (INFO-09..12, BOUND-01, BOUND-02)

- [x] **Phase 97: Disabled-state classification repair** (5/5 plans) — completed 2026-08-09
  Four independently-drifting copies of `installable && !enabled` collapse into
  one `persistence/state-io.ts` predicate reading only `enabled`, so a
  soft-degraded plugin the user disabled is recognized as disabled by every
  surface. `enable` re-materializes a partial through the partially-available
  ledger arm, load-time backfill is a fixed point for disabled records, and the
  update short-circuit derives its persisted availability discriminant. Repairs
  ENBL-04, shipped in v1.12 and silently broken when partial installs landed.
  (ENBL-05..09)

- [x] **Phase 98: Lifecycle regression and contract documentation** (6/6 plans) — completed 2026-08-10
  Uninstall is pinned across all five resource kinds after manifest removal, and
  `(skipped) {not in manifest}` is pinned on all three update enumeration
  targets plus both halves of the autoupdate cascade. One architecture test now
  holds every structural clause of the no-expansion promise — four closed sets
  by enumeration equality, seven glyph code points with an eighth-glyph
  tripwire, the install record's key set, the schema-version union, and the
  network clause. The catalog, PRD and design doc are reconciled against what
  shipped. (LIFE-04..06, COMPAT-01, DOC-08)

- [x] **Phase 99: Post-audit tech-debt closure** (7/7 plans) — completed 2026-08-10
  The question "does this manifest declare this plugin" is now asked in one
  place and answered identically on every rendering surface, with a source walk
  standing between the tree and a fourth copy. A disabled record repairs its
  source and availability discriminant when they move under an unchanged
  version, and the coverage residual was re-measured against the tree the
  milestone actually left — the seven reachable arms now assert what the failure
  left behind rather than that the line ran.

- [x] **Phase 100: Disabled-plugin information retention** (5/5 plans) — completed 2026-08-12
  Added 2026-08-11 by operator decision rather than opening v1.19. Disable keeps
  the installation record's inventory and drops only the artifacts, so a
  disabled plugin keeps describing itself on both `list` and `info`. That
  retired ENBL-04's empty-resources marker as a disabled signal, so the two
  guards which had read emptiness as intent — hook-routing suppression and the
  enable-path self-conflict exclusion — were re-based on the explicit `enabled`
  boolean in the same change. Closed on live human UAT against Pi 0.84.1.
  (ENBL-18)

</details>

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
