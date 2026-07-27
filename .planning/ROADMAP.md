# Roadmap: pi-claude-marketplace

## Milestones

- 🚧 **v1.15 frontmatter-compliance** — Phase 86 (in progress, target npm 0.12.0) — skills & commands bridge frontmatter parity with Claude Code (issue #101)
- ✅ **v1.14 mcp-string-refs** — Phase 85 (shipped 2026-07-23) — full detail: `milestones/v1.14-ROADMAP.md`

## Phases

### In progress v1.15 frontmatter-compliance

**Phase Numbering:**

- Integer phases (86): Planned milestone work (continues the global counter from
  Phase 85, the v1.14 mcp-string-refs phase).

- Decimal phases (86.1, 86.2): Urgent insertions (marked with INSERTED).

- [x] **Phase 86: Skill and command frontmatter compliance** — The skills and commands bridges parse source frontmatter with Pi's own `parseFrontmatter` before rewriting, never stage bytes Pi rejects, degrade a broken skill (synthesized `disable-model-invocation` block, body verbatim) or command (neutralized, name-from-filename) at Claude-Code parity, fold a skill's `when_to_use` into the description Pi actually reads, and surface + classify each failure as a warning — while the ~99% of already-valid components stay byte-for-byte unchanged (GitHub issue #101). (completed 2026-07-26)

<details>
<summary>✅ v1.14 mcp-string-refs (Phase 85) — SHIPPED 2026-07-23</summary>

- [x] Phase 85: `mcpServers` string file-path references (2/2 plans) — completed 2026-07-23
  Resolves a `./`-relative string `mcpServers` (marketplace entry OR `plugin.json`)
  to a wrapped `.mcp.json` inside the plugin root and installs its servers at parity
  with the inline form; a missing / malformed / out-of-root reference isolates that
  one plugin to `(unavailable) {malformed mcp}`, never failing the marketplace load.

</details>

## Phase Details

### Phase 86: Skill and command frontmatter compliance

**Goal**: The skills and commands bridges reach observable parity with Claude Code's frontmatter-loading behavior. Source frontmatter is parsed with Pi's own `parseFrontmatter` (re-exported through the `platform/pi-api.ts` boundary) *before* name-rewrite and variable substitution — establishing attribution ground truth and the degrade trigger — and the staged bytes are re-parsed afterward as a Pi-acceptability backstop. A skill whose source cannot be parsed installs with a synthesized `disable-model-invocation` block (body verbatim); a command whose source cannot be parsed installs neutralized (name-from-filename, description-from-first-body-line); a description-less skill gets a first-paragraph fallback; `when_to_use` triggers are folded into the description Pi reads. Every degraded/neutralized component surfaces an install-time warning row classified under a new `FAILURE_REASONS` token paralleling `malformed mcp`. The ~99% of already-valid components are written byte-for-byte unchanged.
**Depends on**: Nothing (single phase of this milestone; extends the existing skills/commands staging seams — `bridges/skills/stage.ts`, `bridges/skills/rewrite-frontmatter.ts`, `bridges/commands/stage.ts` — the `platform/pi-api.ts` Pi-API boundary, and the `shared/notify-reasons.ts` REASONS tuple).
**Requirements**: PARSE-01, PARSE-02, SKILL-01, SKILL-02, SKILL-03, WTU-01, WTU-02, CMD-01, WARN-01, CLASS-01, NREG-01
**Success Criteria** (what must be TRUE):

  1. A skill whose source frontmatter cannot be parsed still installs (the plugin never hard-fails); after `/reload`, `/skill:<generated-name>` resolves and the model never auto-invokes it — the synthesized frontmatter block carries the generated `name`, a short fixed placeholder `description`, and `disable-model-invocation: true`, with the markdown body preserved verbatim, matching Claude Code's observable malformed-skill behavior (SKILL-01, PARSE-01).
  2. A skill with an absent or empty `description` (well-formed frontmatter) installs with a first-paragraph-of-body fallback description and stays model-invocable; a skill's `when_to_use` text is appended to the Pi `description`, and the combined text is truncated at 1,536 characters — so a converted skill keeps its auto-invocation triggers even though Pi's loader reads only `description` (SKILL-02, WTU-01, WTU-02).
  3. A command whose source frontmatter cannot be parsed still loads after `/reload`, taking its name from the filename and its description from the first body line — the literal Claude Code malformed-command behavior, with no synthesized placeholder and no disable flag (Pi's command loader has no non-empty-description gate) (CMD-01).
  4. Each degraded skill or neutralized command emits an install-time warning row naming the source component and its parse error — the surfaced analog of Claude Code's `--debug`-only message — classified as a new failure-class reason token paralleling `malformed mcp` (filed under `FAILURE_REASONS`, not the unsupported family); the `REASONS` tuple amendment is byte-stable (OUT-08) (WARN-01, CLASS-01).
  5. A skill or command that already parses, has a non-empty `description`, and has no `when_to_use` to fold is written byte-for-byte as it is today: the source is parsed as attribution ground truth, the written skill `name` is verified to equal the generated name (a folded or multi-line source scalar cannot silently corrupt it), and the staged bytes are re-parsed as a self-inflicted-defect backstop — all with no behavior change for the ~99% that already work (NREG-01, SKILL-03, PARSE-02).

**Plans**: 5/5 plans executed

Plans:
**Wave 1**

- [x] 86-01-PLAN.md — Foundation: `parseFrontmatter` re-export, `malformed skill`/`malformed command` catalog tokens, and the skills degrade-helper module (SKILL-02/WTU helpers)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 86-02-PLAN.md — Tracer: end-to-end unparseable-skill degrade (source+staged gates, synth block, degrade-record wire, standalone `(installed) {malformed skill}`) + NREG byte-equality

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 86-03-PLAN.md — Skill augment arms: first-paragraph description, `when_to_use` fold + 1,536 truncation, SKILL-03 name verification
- [x] 86-04-PLAN.md — Command neutralize: parse gates + strip-malformed-block so Pi loads name-from-filename + first-body-line (CMD-01)
- [x] 86-05-PLAN.md — Orchestrated reason-token wire: `PluginInstalledOutcome.degradedKinds` -> reconcile row token at warning severity + redacted detail (WARN-01)

## Progress

**Execution Order:**
Single phase: 86

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 86. Skill and command frontmatter compliance | v1.15 | 5/5 | Complete    | 2026-07-26 |
| 85. `mcpServers` string file-path references | v1.14 | 2/2 | Complete | 2026-07-23 |
