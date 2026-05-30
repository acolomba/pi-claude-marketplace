# Phase 25: Runtime Publish & Verification - Context

**Gathered:** 2026-05-29
**Status:** Ready for planning

<domain>
## Phase Boundary

Get the v0.2.0 source (the v1.4 milestone) into a Pi runtime that can be
exercised **interactively**, then reproduce-or-refute the two UAT findings that
could not be checked against the old v0.1.7 runtime:

- **SNM-37 (delivery / gate):** Load v0.2.0 source into an interactive Pi via
  the existing `scripts/pi.sh` (sandbox home). Behavioral smoke confirms v1.4
  conformance. This is the gating prerequisite for SNM-38 + SNM-39.
- **SNM-38 (G-MIL-03 indent ladder):** Reproduce-or-refute the observed 1/3
  indent vs the catalog's documented 2/4/6 ladder (D-16-08). Fix the renderer
  if it truly emits the wrong ladder; otherwise record not-a-bug + catalog
  wording clarification.
- **SNM-39 (G-MIL-07 tab completion):** Reproduce-or-refute `update @<TAB>`
  returning nothing in the live runtime despite the passing unit test at
  `tests/edge/completions/provider.test.ts:806`. Root-cause it; fix if it's our
  code, defer-with-finding if the cause is Pi-tui-external.

**This is an operational + investigation phase, not feature-building.** Nothing
new is added to the user-facing command surface. The only code changes that may
land are a renderer indent fix (SNM-38) and/or a completion-wiring fix (SNM-39),
each gated on its reproduction outcome.

**In scope:** the source-load runtime methodology (`scripts/pi.sh` sandbox),
the behavioral smoke verification, the two byte-exact reproductions, any
resulting renderer/completion fix + regression test, and the
requirement-text amendments to SNM-37 / SC#1 in lockstep.

**Out of scope:** real `npm publish` / packaged-artifact (release-tarball)
validation (deferred -- SNM-37 is reproduction-enablement, not a release gate);
the GREEN-gate close (Phase 26); state migration for hash-versioned plugins
(REQUIREMENTS Out of Scope); any new commands or capabilities.
</domain>

<decisions>
## Implementation Decisions

### Delivery mechanism (SNM-37) -- user-locked
- **D-25-01:** Use the **existing `scripts/pi.sh`** as the delivery mechanism --
  NOT a real `npm publish` or `npm link`. It loads the v0.2.0 source tree
  directly (`-e extensions/pi-claude-marketplace/index.ts`) into an interactive
  Pi, and also loads the `pi-subagents` + `pi-mcp-adapter` companions
  (`ensure_global_package`). Loading the companions is *better* fidelity than a
  bare publish/link, because soft-dep probes (SNM-16) then resolve against
  real companion presence/absence.
- **D-25-02:** Run reproductions under **`scripts/pi.sh --home <tmp sandbox>`**
  (sets `PI_CODING_AGENT_DIR` / `PI_CODING_AGENT_SESSION_DIR`). Sandbox is the
  PRIMARY environment: reproducible, non-destructive, leaves the user's real
  `~/.pi` untouched. The script's `--cd` controls cwd -- relevant because the
  completion provider captures `process.cwd()` at registration
  (`edge/register.ts:95-99`).
- **D-25-03 (SNM-37 amendment, lockstep -- mirrors D-23-01 / D-24-03):** Amend
  SNM-37's "published to npm or npm-linked into the user's Pi runtime" wording
  to "loaded from source via `scripts/pi.sh` (sandbox home)." The requirement's
  *purpose* (reproduction-enablement for SNM-38/39) is unchanged; only the
  methodology text is corrected to match what's actually being done. Amend in
  the same commit as the phase work.

### SNM-37 verification -- behavioral, not version-string (user-locked, all 3 caveats)
- **D-25-04:** SC#1's "`pi --version`" verification half is **moot under a
  source-load** -- `pi --version` reports *Pi's* version, not the source-loaded
  extension's (in `-e` mode the extension is not a separately-versioned
  installed package). **Amend SC#1: the v1.4-identity proof is the BEHAVIORAL
  smoke** -- a `/claude:plugin list` that shows v1.4 catalog-conformant byte
  forms: no `/reload to pick up changes` trailer on a read-only list,
  `v#<7hex>` hash display (SNM-35), `{lsp}` not `{lspServers}` (SNM-36). This is
  *stronger* evidence than a version string -- it proves the new code paths
  execute. Reuse the Phase-07 runtime-smoke pattern (`runPiRuntimeSmoke`) where
  it helps, but the binding signal is the byte forms.
- **D-25-05:** **Keep a real-`~/.pi`-home fallback for G-MIL-07 only.** The
  recon's cause (c) is a runtime scope-root mismatch; if the original bug was
  specific to the user's real home layout, a clean sandbox could *false-refute*
  it. If the sandbox does not reproduce G-MIL-07, a quick real-home spot-check
  confirms before concluding "refuted." G-MIL-03 (pure rendering) carries no
  such risk -- sandbox alone is sufficient.
- **D-25-06:** **Packaged-artifact / real-publish validation is explicitly
  deferred** (recorded, not silently skipped). `scripts/pi.sh` does not validate
  the `files:` tarball or a real npm install; SNM-37 is not a release gate, so
  that's acceptable. Real publish-validation belongs to an actual release
  effort, out of v1.4.1 scope.

### Work split / automation ceiling (user-locked)
- **D-25-07:** **Automate as much as possible first.** G-MIL-03 byte-capture is
  **fully automated** -- capture leading-whitespace byte counts at the
  `ctx.ui.notify` boundary (before any tui/markdown rendering), independent of
  the live tui.
- **D-25-08:** For G-MIL-07, **go straight to a live `scripts/pi.sh`
  interactive trigger** with the user -- do NOT build a new harness layer. The
  unit test (`provider.test.ts:806`) already covers `getArgumentCompletions`;
  the suspected gap is tui consumption, which only manifests at the live
  keystroke. The final confirmation is an interactive escalation to the user.

### G-MIL-03 resolution boundary (SNM-38) -- user-locked
- **D-25-09:** **Byte-evidence first, then decide.** Capture what the renderer
  actually emits at `ctx.ui.notify`:
  - If the code emits the catalog 2/4/6 ladder correctly → the observed 1/3 is a
    **tui/markdown display artifact** (markdown collapses a leading space).
    Record as **not-a-bug** + a catalog wording clarification noting the
    display-layer caveat. No renderer change.
  - Only if the renderer *actually emits* 1/3 (or any non-2/4/6 ladder) is it a
    real D-16-08 violation → fix at the renderer with a byte-equality regression
    test. The two render chokepoints are `renderPluginRow` / `renderMpHeader`
    (plugin row prefix = 2 spaces per D-16-04; cause-chain at 4/6 via
    `renderIndentedCauseChain`).

### G-MIL-07 resolution boundary (SNM-39) -- user-locked
- **D-25-10:** **Root-cause first, then fix-or-defer.** Trace to the actual
  cause among the recon's three candidates: (a) provider code-path divergence,
  (b) Pi-tui consumption/display of the `AutocompleteItem[]` payload, (c)
  `getInstalledPluginToMarketplacesMap` returning empty due to a scope-root
  mismatch at runtime.
  - If the cause is **our code** (provider wiring, scope-root resolution, the
    dual completion surfaces -- `getArgumentCompletions` at `register.ts:98` vs
    the `addAutocompleteProvider` wrapper at `register.ts:108`) → fix it + add
    regression coverage.
  - If the cause is **genuinely Pi-tui-external** (a `@earendil-works/pi-tui`
    consumption behavior we don't own) → record the finding (with an upstream
    note) and **defer** per SNM-39's "fix or defer" clause. Do NOT contort our
    code to fight the host.

### Claude's Discretion
- **Regression-test policy on a refuted finding:** whether to still add a
  byte-equality test locking the 2/4/6 ladder even when G-MIL-03 is refuted
  (recommended default: yes -- cheap drift insurance, feeds Phase 26's GREEN
  gate), and similarly for G-MIL-07. Planner's call.
- **Exact sandbox fixture shape** (marketplaces + plugins): must include ≥1
  installed plugin per marketplace (G-MIL-07 precondition) and a row that
  exercises the `{...}` reason brace + an installed/available mix (G-MIL-03
  ladder). Planner/executor own the concrete fixture.
- **Plan/wave decomposition.** SNM-37 is the gate; SNM-38 and SNM-39
  parallelize after it. SNM-38 is fully automatable; SNM-39 ends in a live
  interactive escalation. Likely: one setup/smoke plan (SNM-37) → SNM-38 plan ∥
  SNM-39 plan. Planner owns the split.
- Whether `runPiRuntimeSmoke` is extended for the behavioral smoke or a new
  thin smoke is added -- discretion.
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirement & gap source
- `.planning/REQUIREMENTS.md` §SNM-37 (`:28`), §SNM-38 (`:30`), §SNM-39 (`:32`)
  -- the three requirements this phase closes. **NOTE:** SNM-37's
  "published to npm or npm-linked" methodology and `pi --version` verification
  are CORRECTED by D-25-01/D-25-03 (use `scripts/pi.sh`) and D-25-04
  (behavioral smoke) -- amend in lockstep.
- `.planning/ROADMAP.md` -- Phase 25 goal + SC#1-#3 (`:466-481`); cross-cutting
  v1.4.1 constraints (`:85-91`). SC#1's `pi --version` half is amended per
  D-25-04. **UI hint: yes** (`:481`) -- the changes touch user-visible output
  rendering (indent), so a UI-SPEC pass may apply.
- `.planning/v1.4-MILESTONE-UAT.md` -- the source of both findings and the
  reproduction methodology:
  - **G-MIL-03** (`:476-494`): indent ladder, with the user's visual sample and
    the explicit note that "markdown rendering can obscure single-space
    differences" -- grounds the byte-evidence-first decision (D-25-09).
  - **G-MIL-07** (`:686-721`): tab completion, with the recon's three candidate
    causes and the "reproduce in v1.4 build first" action -- grounds D-25-10.
  - `runtime_caveat` (`:11-24`) + Triage table (`:739-749`) + Recommended
    follow-up (`:765-770`): why these two were deferred to a v1.4-runtime UAT
    and the publish-then-reproduce sequencing.

### Delivery / runtime methodology (SNM-37)
- `scripts/pi.sh` -- **the delivery mechanism (D-25-01/D-25-02).** Loads the
  project extension from source (`-e .../index.ts`) + `pi-mcp-adapter` +
  `pi-subagents`; supports `--home <PATH>` (sandbox via `PI_CODING_AGENT_DIR` /
  `PI_CODING_AGENT_SESSION_DIR`), `--cd <PATH>`, `--clear`. Forwards remaining
  args to `pi`.
- `tests/e2e/_helpers.ts` -- `runPiRuntimeSmoke` (the Phase-07 automated
  source-load smoke: `pi --offline --no-extensions --extension <path> --help`
  under isolated HOME/cwd) + `makeMockPi` / `makeCtx` notify-capture harness.
  Reference for the behavioral-smoke automation (D-25-04, D-25-07).
- `tests/e2e/pi-runtime-smoke.test.ts` -- the existing runtime-smoke test that
  asserts the extension loads via the installed `pi` bin.
- `package.json` -- already at `version: 0.2.0` (no bump needed for SNM-37). No
  `project.json` / `sonar.properties` exist in this repo (the CLAUDE.md note is
  a generic global). Peer deps are `@earendil-works/pi-coding-agent` +
  `@earendil-works/pi-tui` (NOT the stale `@mariozechner/*` from CLAUDE.md).

### G-MIL-03 indent surface (SNM-38)
- `extensions/pi-claude-marketplace/shared/notify.ts` -- `renderPluginRow`
  (plugin row prefix = 2 spaces, D-16-04; `:887`), `renderMpHeader`, and
  `renderIndentedCauseChain` (4-space per-plugin cause / 6-space per-phase
  cause, `:1184-1226`). The D-16-08 2/4/6 ladder contract lives here. Capture
  bytes at the `ctx.ui.notify` call boundary.
- `docs/output-catalog.md` -- the canonical indent examples (project-orphan-fold
  / list states around L155-189 per the UAT reference) that the byte counts are
  compared against.

### G-MIL-07 completion surface (SNM-39)
- `extensions/pi-claude-marketplace/edge/completions/provider.ts` --
  `parseUpdateMode` sets `allowMarketplaceOnly: true` for `update` (`:196,202`);
  `getArgumentCompletions` (`:213`) returns `AutocompleteItem[] | null`.
- `extensions/pi-claude-marketplace/edge/completions/data.ts` --
  `getMarketplaceOnlyCompletions` (`:383`), `getInstalledPluginToMarketplacesMap`
  (`:313`), `getPluginToMarketplacesMap` (`:346`). Candidate cause (c)
  scope-root mismatch lives in this map's resolver.
- `extensions/pi-claude-marketplace/edge/register.ts` -- **the dual completion
  wiring (key to root-cause):** `getArgumentCompletions` is registered on the
  command (`:98-100`, captures `process.cwd()` at registration, `:95`) AND a
  separate `addAutocompleteProvider` wrapper is installed on `session_start`
  (`:108-122`). Divergence between these two surfaces is a prime suspect.
- `extensions/pi-claude-marketplace/tests/edge/completions/provider.test.ts:806`
  -- the passing unit test (`update @` → `["@mp-a","@mp-b"]`). The gap is
  between this GREEN unit path and live tui delivery.
- `@earendil-works/pi-tui` (peer dep) -- the external host that consumes the
  `AutocompleteItem[]` payload; candidate cause (b). If the cause lands here,
  defer-with-finding (D-25-10).

### Precedent to mirror
- `.planning/phases/23-version-display-bundle/23-CONTEXT.md` (D-23-01) +
  `.planning/phases/24-grammar-consistency/24-CONTEXT.md` (D-24-03) -- the
  requirement-text-correction-in-lockstep pattern this phase repeats for the
  SNM-37 / SC#1 amendments (D-25-03, D-25-04).
- `.planning/STATE.md` Blockers/Concerns (`:143`) -- the operator-gated SNM-37
  hand-off this phase resolves via the `scripts/pi.sh` sandbox decision.
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`scripts/pi.sh`** is a ready-made interactive source-loader with companion
  bootstrapping and `--home` sandboxing -- it removes any need to build publish
  tooling for SNM-37.
- **`runPiRuntimeSmoke` + `makeCtx`/`makeMockPi`** (`tests/e2e/_helpers.ts`)
  give a notify-capturing harness for the fully-automated G-MIL-03 byte-capture
  (D-25-07) and the behavioral smoke (D-25-04).
- The completion provider, its data layer, and `provider.test.ts:806` already
  exist and pass -- SNM-39 is a *delivery-gap* investigation, not a missing
  feature.

### Established Patterns
- **Persistence/display separation** carries into verification: byte-exact
  output is captured at the `ctx.ui.notify` boundary (pre-tui), because the live
  tui/markdown layer can mutate leading whitespace (the whole premise of
  D-25-09).
- **Requirement-text amendment in lockstep** (Phase 23/24 precedent) -- SNM-37
  and SC#1 are corrected in the same commit as the work.
- **Catalog UAT byte-equality + `npm run check` GREEN** stay green at the phase
  boundary (v1.4.1 cross-cutting constraint); any renderer fix ships with
  catalog + fixtures in the same commit.

### Integration Points
- `scripts/pi.sh` is the seam between the source tree and the interactive Pi
  runtime; `--home` isolates the sandbox; `--cd` controls the cwd that the
  completion provider closes over at registration.
- The two completion surfaces in `edge/register.ts` (command-registered
  `getArgumentCompletions` vs `session_start` `addAutocompleteProvider`) are the
  integration boundary where G-MIL-07's runtime divergence most likely hides.
- No persistence-layer or domain-resolver behavior changes are anticipated --
  only (conditionally) the renderer indent and/or completion wiring.
</code_context>

<specifics>
## Specific Ideas

- Delivery command shape: `scripts/pi.sh --home <tmp> --cd <fixture-project>`
  then a smoke `/claude:plugin list` showing v1.4 byte forms (no `/reload`
  trailer, `v#<7hex>`, `{lsp}`).
- G-MIL-03 capture target: leading-whitespace byte counts per line at
  `ctx.ui.notify`, compared against catalog 2/4/6. The user's observed sample
  was a 1-space marketplace header / 3-space plugin row -- to be confirmed as
  real-emit vs markdown-collapse.
- G-MIL-07 reproduction: install ≥1 plugin per marketplace in the sandbox, type
  `/claude:plugin update @` and trigger completion in the live `scripts/pi.sh`
  session; expected `@<mp>` candidates. Real-`~/.pi` spot-check if the sandbox
  shows the candidates (false-refute guard, D-25-05).
- v1.4-identity proof is behavioral (byte forms), not `pi --version` (D-25-04).
</specifics>

<deferred>
## Deferred Ideas

- **Real `npm publish` / packaged-artifact (release tarball) validation** --
  out of v1.4.1 scope (D-25-06). SNM-37 is reproduction-enablement, not a
  release gate; `scripts/pi.sh` does not exercise the `files:` tarball or a real
  npm install. Belongs to an actual release effort.
- **State migration for already-installed hash-versioned plugins** -- carried
  from the v1.4.1 milestone deferral (REQUIREMENTS Out of Scope `:103`); not
  re-litigated here.
- Discussion otherwise stayed within phase scope.

</deferred>

---

*Phase: 25-runtime-publish-verification*
*Context gathered: 2026-05-29*
