# Roadmap: pi-claude-marketplace

## Milestones

- ✅ **v1.16 stop-hooks** — Phases 87-89 (shipped 2026-07-31, target npm 0.12.0) — full detail: `milestones/v1.16-ROADMAP.md`
- ✅ **v1.15 frontmatter-compliance** — Phase 86 (shipped 2026-07-27, npm 0.11.1) — full detail: `milestones/v1.15-ROADMAP.md`
- ✅ **v1.14 mcp-string-refs** — Phase 85 (shipped 2026-07-23) — full detail: `milestones/v1.14-ROADMAP.md`

## Phases

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
| 87. Bucket-A admission & platform floor | v1.16 | 3/3 | Complete | 2026-07-30 |
| 88. `agent_settled` dispatcher, Stop contract & StopFailure | v1.16 | 5/5 | Complete | 2026-07-30 |
| 89. Documentation reconcile | v1.16 | 3/3 | Complete | 2026-07-31 |
| 86. Skill and command frontmatter compliance | v1.15 | 5/5 | Complete | 2026-07-26 |
| 85. `mcpServers` string file-path references | v1.14 | 2/2 | Complete | 2026-07-23 |
