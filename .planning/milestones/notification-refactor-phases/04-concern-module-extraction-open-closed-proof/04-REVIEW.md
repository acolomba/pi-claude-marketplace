---
phase: "04"
phase_name: concern-module-extraction-open-closed-proof
workstream: notification-refactor
depth: standard
status: clean
files_reviewed: 14
findings:
  critical: 0
  warning: 0
  info: 2
  total: 2
reviewed: 2026-06-24
---

# Code Review: Phase 4 -- Concern-module extraction & open-closed proof

## Scope

14 files (from SUMMARY.md `key_files`):

- `extensions/pi-claude-marketplace/shared/concerns/soft-dep.ts` (new)
- `extensions/pi-claude-marketplace/shared/concerns/hooks.ts` (new)
- `extensions/pi-claude-marketplace/shared/notify.ts` (slimmed 3431 -> 3315)
- `extensions/pi-claude-marketplace/domain/components/hook-events.ts`
- `extensions/pi-claude-marketplace/orchestrators/import/execute.ts`
- `extensions/pi-claude-marketplace/orchestrators/plugin/{info,install,list,reinstall,update}.ts`
- `extensions/pi-claude-marketplace/orchestrators/reconcile/{apply,apply-outcomes}.ts`
- `docs/open-closed-proof.md` (new)
- `tests/shared/notify-v2.test.ts`

Depth: standard (with cross-file import-graph + git-history verification on the
load-bearing claims). Per the review brief, the absence of a concern-registry
(D-01) and the absence of an architecture test (D-02) are explicit user
decisions and are NOT treated as findings.

## Verdict: clean

The extraction is output-neutral and behavior-preserving, `notify.ts` is now a
clean envelope + reducer + shared-vocabulary spine, and `docs/open-closed-proof.md`
measures the MOD-05/MOD-06 claims honestly against the MESSAGING-COUPLING.md
baseline. No critical or warning findings. Two info-level observations below.

---

## Focus area 1 -- output-neutral & behavior-preserving extraction

PASS.

- **composeReasons soft-dep delegation.** `composeReasons` stays central in
  `notify.ts:1671` and delegates its soft-dep branch via
  `composed.push(...softDepMarkers(declaresAgents, declaresMcp, probe))`. The
  extracted `softDepMarkers` (`shared/concerns/soft-dep.ts:49`) reproduces the
  prior agents-before-mcp push order exactly (byte-critical for the `{<r1>, <r2>}`
  brace join). The `probe` (`SoftDepStatus`) stays threaded by the renderer per
  D-01; the concern is pure given the probe result. No constant moved without its
  call site following.
- **Hooks concern.** `appendHooksBlock` (`shared/concerns/hooks.ts:91`) is byte-for-byte
  the prior renderer: same `"    hooks:"` header, same 6-space entry indent, same
  three-arm dispatch (`"kind" in entry` -> lenient with ` (unsupported)` suffix;
  `"matcher" in entry` -> `event(matcher)`; else bare `event`). `COMPONENT_KINDS`
  correctly STAYS in `notify.ts:2766` per D-01; only the `kind === "hooks"` arm of
  `appendResolvedComponentLines` dispatches into the concern.
- **shared/ -> domain/ import fence.** Holds. No `shared/` module imports from
  `domain/`. The fence is preserved by relocating the hook *types*
  (`ClaudeHookEvent`, `HookSummaryEntry`, `HookSummary`) into `shared/concerns/hooks.ts`;
  `domain/components/hook-events.ts` imports `ClaudeHookEvent` type-only from
  `shared/` (correct direction) and pins its runtime tuples with
  `satisfies readonly ClaudeHookEvent[]`, so any drift breaks the typecheck at the
  source-of-truth assertion site.
- **No runtime import cycle.** `notify.ts` imports `softDepMarkers` (value) and
  `appendHooksBlock` (value) from the concerns. `hooks.ts` imports nothing from
  `notify.ts` (strongest no-cycle position). `soft-dep.ts` imports only
  `type { Reason }` from `notify.ts` -- type-only, erased at runtime, so the
  notify<->soft-dep edge is a type-level back-reference with no runtime cycle.
  `import-x/no-cycle` is not configured (only `no-restricted-paths`); the type-only
  import is the deliberate safeguard, and the call direction (renderer -> concern)
  is one-way at runtime.
- **Catalog byte-equality.** The two Phase-4 refactor commits (`8ab786d7`,
  `8dbd78fc`) touch ZERO catalog files -- neither `docs/output-catalog.md` nor
  `tests/architecture/catalog-uat.test.ts`. (The `output-catalog.md` prose delta
  visible in `git diff main` belongs to Phase 3, not Phase 4.) Extraction is a pure
  move + import-rewire.
- **Test change.** The only edit to `tests/shared/notify-v2.test.ts` is the
  `HookSummaryEntry` import-path rewire (now from `concerns/hooks.ts`). No assertion
  weakened, no test deleted.

## Focus area 2 -- notify.ts as envelope + reducer + vocabulary

PASS. No dead/orphaned definitions of the extracted symbols remain in `notify.ts`
(`SOFT_DEP_MARKER_*`, `DEPENDENCIES`, `appendHooksBlock`, the hook-summary types are
all gone from the file and now imported). The `Dependency` type import is genuinely
used (rows at `:548/:565/:576/:1782`). All orchestrator files that referenced
`Dependency` / the hook types were correctly rewired to import from the new concern
modules. What stays central matches the D-01 target: envelope (`NotificationMessage`,
`notify()`), reducer spine (severity max-reduce / OR-needsReload / tally / summary),
`isInfoKind`, the shared vocabulary (`ICON_*`, `renderScopeBracket`, `renderVersion`,
`composeVersionArrow`, core `composeReasons`, `pluginRow`, `joinTokens`),
`RELOAD_HINT_TRAILER`, and `redactAbsolutePaths` (NFR-9).

## Focus area 3 -- docs/open-closed-proof.md accuracy

PASS, and notably honest.

- **3315-line claim verified:** `wc -l` confirms 3315 (3431 before).
- **3-central-files claim is real, not overstated.** The `edge/router.ts` line
  spans the doc cites (interface `:26`, `TOP_LEVEL_SUBCOMMANDS` `:55`,
  `MARKETPLACE_SUBCOMMANDS` `:75`, `TOP_LEVEL_USAGE` `:87`, `MARKETPLACE_USAGE` `:102`)
  all match the current file. `edge/register.ts` handlers object and
  `docs/output-catalog.md` per-state section are correctly enumerated.
- **Baseline restatement is faithful.** MESSAGING-COUPLING.md records "5 central
  files" (no new grammar), "9-11 central edit sites" (new grammar), and "notify.ts
  ... accounts for 6 of those edit sites" (audit lines 9/13-14/152-165). The proof
  doc reproduces 5 / 9-11 / "6 inside notify.ts" exactly. The audit's own §A.3
  independently reaches the same "3 central files" end state (audit line 431).
- **Honest, not inflated.** The doc does NOT claim absolute zero-touch. Its "honest
  caveat: partially irreducible" section explicitly reports that
  `edge/completions/provider.ts` and the `catalog-uat.test.ts` `FIXTURES` map may
  each need an entry for novel grammar -- both outside `notify.ts`, so the
  0-notify.ts-edits claim is preserved while the residual touch-points are disclosed
  rather than papered over. The MOD-06 catalog floor is documented as a deliberate
  deferral (D-03), with the byte-equality gate named as the honesty mechanism.

## Quality gate (GATE-03)

`npm run check` = typecheck + ESLint + Prettier + tests. Typecheck/lint/format
green. Tests: 2329/2333 pass, 2 skipped, **2 failures that are NOT Phase-4
regressions** -- both are `ENOTEMPTY` temp-dir teardown races in
`tests/orchestrators/marketplace/{autoupdate,update}.test.ts` (parallel-run
filesystem cleanup, unrelated to notify/concerns). Re-running those two suites in
isolation passes 62/62. Phase 4 touches no marketplace orchestrator logic. Flaggable
as a pre-existing suite-level flake, but out of scope for this phase's code.

## Comment policy (.claude/rules/typescript-comments.md)

Clean. The Phase-4 commits introduce no forbidden `Phase NN` / `Plan NN` /
`Wave N` / `Task N` / bare `Pitfall N` planning-artifact references into any changed
source file. Decision/requirement anchors used (D-01, D-58-06, D-63-0x, SNM-06,
SURF-02, TOOL-02) are all allowed. The word "Pitfall:" in
`hook-events.ts:141`/`:159` is plain English ("a Pitfall: a plugin author may
write..."), not a numbered RESEARCH reference -- allowed.

---

## Findings

### IN-01 (info) -- composeReasons docstring names constants that now live in the concern

`shared/notify.ts:1658-1659` -- the `composeReasons` JSDoc still reads
"Appends `SOFT_DEP_MARKER_AGENTS` iff ..." / "`SOFT_DEP_MARKER_MCP` iff ...". Those
constants are now file-private to `shared/concerns/soft-dep.ts` and are not in scope
at this call site. The comment is accurate as a *behavioral* description (it duplicates
the concern's own docstring), so this is cosmetic, not misleading. Optional: reword to
"the soft-dep markers (see `softDepMarkers` in `concerns/soft-dep.ts`)" to avoid naming
symbols no longer resident in the file. No behavior impact.

### IN-02 (info) -- pre-existing full-suite teardown flake (not introduced by Phase 4)

The two `ENOTEMPTY` failures in the marketplace autoupdate/update suites are a
parallel-run temp-dir cleanup race, surfaced by the full `npm run check` run but
passing in isolation. Not a Phase-4 regression (Phase 4 touches no marketplace
orchestrator code). Noted so the milestone-close GATE-03 reviewer is not misled by a
red full-suite run; worth a separate hardening pass on the affected tests' teardown,
outside this phase.
