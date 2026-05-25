# Phase 12: Messaging Foundations & Renderer Primitives - Context

**Gathered:** 2026-05-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 12 lands the **primitives** that Phase 13's mechanical conformance refactor will consume. Concretely:

1. Closed `status-tokens` and `reasons` constants modules (CMC-08, CMC-11)
2. `presentation/reload-hint.ts` composer collapsed to the single canonical trailer `/reload to pick up changes` (CMC-14)
3. The four sanctioned notify wrappers (`notifySuccess`, `notifyWarning`, `notifyError`, `notifyUsageError`) affirmed unchanged in shape (CMC-19)
4. `persistence/migrate.ts:178` `console.warn` rewritten to the §14.1 sentence-form wording (CMC-36)
5. IL-3 inline `eslint-disable-next-line` comment preserved verbatim above the rewritten call (CMC-37)

**Out of scope (deferred to Phase 13):** every per-command callsite rewrite, the `<marker>` slot rendering, marketplace-header form, per-row soft-dep emission, manual-recovery / rollback-partial new line structure, per-scope rendering + folding + adoption, ES-5 atomic three-file edit (`shared/markers.ts` + snapshot test + PRD §6.12), cause-chain rewrite to MSG-CC-1 form.

**Cross-cutting constraints:** NFR-6 (`npm run check` stays green throughout), IL-2 / IL-3 (output channel discipline preserved), D-30 (style guide + catalog are v1.3 user-contract; ES-5 supersession is the only user-contract change in milestone -- but see D-CMC-A10 below for an authorized Phase 12 carve-out on the reload-hint surfaces).

</domain>

<decisions>
## Implementation Decisions

### Constants Module Shape (CMC-08, CMC-11)

- **D-CMC-01:** Location is a new `extensions/pi-claude-marketplace/shared/grammar/` subdirectory. Anchors a "messaging grammar" surface that Phase 14's drift-guard can target as a single import root; sibling to the existing `shared/markers.ts` (which holds deferred ES-5 strings until Phase 13's atomic three-file edit).

- **D-CMC-02:** Module split is **one file per set**: `shared/grammar/status-tokens.ts` and `shared/grammar/reasons.ts`. Each file owns one closed enum.

- **D-CMC-03:** TS shape is **`as const` array + derived literal union**:
  ```ts
  export const STATUS_TOKENS = ["installed", "updated", /* ... */] as const;
  export type StatusToken = (typeof STATUS_TOKENS)[number];
  ```
  Single source: the array iterates for Phase 14's drift test (`for (const tok of STATUS_TOKENS) assert(frontmatter.status_tokens.includes(tok))`); the derived literal union types Phase 13 callsites (`function renderRow(status: StatusToken)`). Zero runtime cost; idiomatic strict TS; matches the codebase's existing pattern at `presentation/plugin-list.ts` (`type PluginRenderStatus = "installed" | "available" | "uninstallable"`). TypeBox unions were considered and rejected -- these are token constants, not validated runtime payloads, so JIT-compile overhead is wasted.

- **D-CMC-04:** YAML drift-test infrastructure is **test-local**: a new test file under `tests/architecture/` (e.g. `grammar-frontmatter.test.ts`) reads `docs/messaging-style-guide.md`, parses the frontmatter, and asserts set-equality against `STATUS_TOKENS` and `REASONS`. **No** `shared/` frontmatter loader utility is published in Phase 12. Phase 14's broader drift-guard (which will also need `markers:` and `pattern_classes:`) builds its own richer reader when it lands; the Phase 12 surface stays minimal.

- **D-CMC-05:** `(no marketplaces)` and `(no plugins)` are **flat members** of the single `STATUS_TOKENS` array -- no `BARE_STATUS_TOKENS` sub-union, no branded `BareStatusToken` derived type. The render-shape distinction (bare-token form vs `<icon> <name> ... (status) {reasons}` compact form) is a renderer concern that Phase 13 branches on at emission time. Constants module mirrors the frontmatter shape 1:1; the drift test is one assertion per set.

### Reload-Hint Composer Migration (CMC-14)

- **D-CMC-06:** Migration strategy is **replace-in-place + mechanically migrate the 6 callsites**. Phase 12 rewrites `presentation/reload-hint.ts` so `reloadHint(names: readonly string[]): string` returns `"/reload to pick up changes"` when `names.length > 0` and `""` otherwise; the verb argument is dropped from the signature. All callsites are updated in the same phase to drop the `verb` argument:
  - `orchestrators/plugin/install.ts:690`
  - `orchestrators/plugin/uninstall.ts:237`
  - `orchestrators/plugin/update.ts:731`
  - `orchestrators/marketplace/update.ts:358`
  - `orchestrators/marketplace/remove.ts:278`
  - `orchestrators/import/execute.ts:339-341`
  The `ReloadVerb` type export is deleted; `presentation/index.ts` barrel is updated accordingly. The side-by-side option was rejected because roadmap criterion #2 requires "the three-verb selector is gone from `presentation/reload-hint.ts`" -- keeping the old composer alongside violates that criterion.

- **D-CMC-07:** The new trailer literal `/reload to pick up changes` lives as a **local `const` inside `presentation/reload-hint.ts`** -- not as a new export in `shared/markers.ts`, not as a new file under `shared/grammar/`. Justifications: (a) markers.ts is a transitional contract surface until Phase 13's ES-5 atomic edit deletes the legacy prefix -- mixing the v1.3 replacement into the same file would confuse reviewers; (b) extracting into `shared/grammar/reload-hint.ts` is over-extraction for a constant with exactly one consumer in the codebase, ever; (c) keeping the literal local matches `presentation/plugin-list.ts`'s pattern of private layout constants (`MAX_LINE_COLUMN`).

- **D-CMC-08:** `RELOAD_HINT_PREFIX = "Run /reload to "` in `shared/markers.ts` is **retained** as a snapshot-test-only export. Source code stops importing it in Phase 12 (the composer no longer needs it), but `tests/architecture/markers-snapshot.test.ts` continues to assert it byte-equals the PRD §6.12 literal. Phase 13's atomic three-file edit (`shared/markers.ts` + snapshot test + PRD §6.12) deletes both the constant and its snapshot test row in one commit. Phase 12 MUST NOT delete it standalone -- the snapshot test would fail and `npm run check` would regress (violating NFR-6).

- **D-CMC-09:** The existing test suite at `tests/presentation/reload-hint.test.ts` is **rewritten in Phase 12** to assert the new behavior: `reloadHint([])` returns `""`; `reloadHint(["any-name"])` returns `"/reload to pick up changes"` (constant -- names ignored beyond the non-empty check). Coverage for the three verb variants is **deleted** (they no longer exist). The test file remains under the same path.

- **D-CMC-10 (carve-out flag for downstream):** Roadmap Phase 12 success criterion #4 says "user-visible output is unchanged except for the single migrate.ts diagnostic." Under D-CMC-06, the 6 reload-hint callsites emit the new trailer `/reload to pick up changes` in Phase 12 instead of the legacy `Run /reload to <verb> "..."`. This is a real user-visible change beyond migrate.ts. The roadmap criterion is read as authorized by criterion #2 (the three-verb selector MUST be gone), which structurally requires the trailer to change wherever the composer is called. Planner SHOULD record this carve-out explicitly in PLAN.md / CHANGELOG.md so reviewers don't mis-read criterion #4 as forbidding the reload-hint surface change. Phase 13's mechanical refactor is still required to migrate the OTHER (non-reload-hint) user-visible surfaces.

### Notify Wrapper Signature Evolution (CMC-19)

- **D-CMC-11:** The four wrappers in `shared/notify.ts` (`notifySuccess`, `notifyWarning`, `notifyError`, `notifyUsageError`) keep their current pure-string signatures `(ctx, message: string)` (plus `cause?: unknown` on `notifyError`, plus `usageBlock: string` on `notifyUsageError`). **No 5th `notifyCascadeSummary` helper** is introduced. **No optional structured-payload arg** is added to the existing wrappers. Composition (cascade summaries, manual-recovery lines, per-row soft-dep markers) lives in `presentation/` modules that Phase 13 builds; those composers return strings that the wrappers receive verbatim. This preserves D-07 (`shared/notify.ts` is the SOLE `ctx.ui.notify` callsite; severity is the wrapper name) and keeps the four-wrapper minimalism intact.

- **D-CMC-12:** `notifyError(ctx, message, cause?)` signature **and body** are left untouched in Phase 12. The current body renders `\nCause: ${errorMessage(cause)}` (single level, capital `C`, no arrow chain). Phase 13 rewrites this to the MSG-CC-1 form (`cause: <link1> -> <link2> -> ...`, lowercase, depth-5 bounded, `(truncated)` suffix) when it lands `formatErrorWithCauses`. Phase 12's wrapper-affirmation step is API-level only -- wrapper bodies are out of scope.

- **D-CMC-13:** Phase 12 deliverable for CMC-19 is a **two-part inventory affirmation**, not a code change to `shared/notify.ts`:
  1. A docs comment in `shared/notify.ts` (or a section in `shared/notify.ts`'s README, if one exists) that names the four wrappers and links to style guide §10 MSG-SR-1..7 as the governance contract.
  2. A typed re-export or barrel through which Phase 13 callers can import the four wrappers consistently. If `presentation/index.ts` does not already barrel the wrappers (`shared/notify.ts` exports them directly today), no new barrel is required -- just affirm the import path is stable.

### Migrate.ts Wording (CMC-36, CMC-37)

- **D-CMC-14:** Roadmap wins the doc conflict against style-guide §14.1's "Phase 13 planner discretion" sentence. Phase 12 locks the §14.1 proposed bytes **literally** at `persistence/migrate.ts:178`:
  ```text
  Legacy marketplace migration could not be persisted to <path>; the in-memory normalized state is being used and the on-disk state.json is unchanged. Cause: <errMsg>.
  ```
  Where `<path>` and `<errMsg>` are the existing template variables. No wording tightening; the §14.1 proposal becomes the binding text.

- **D-CMC-15:** Same Phase 12 commit/PR includes the corresponding **style-guide §14.1 update**: remove the "Phase 13 PROPOSES the new wording (below); Phase 13 owns the `persistence/migrate.ts:178` byte change" framing and the "Phase 13's planner has FINAL discretion on the exact wording" sentence. Replace with text affirming the wording landed in Phase 12 per D-CMC-14. Keeps style guide and code aligned within the same PR -- no transient window where the doc says "discretion" while the bytes already exist.

- **D-CMC-16:** The IL-3 inline `eslint-disable-next-line no-restricted-syntax, no-console -- IL-3: load-time migrate save fail` comment is preserved **verbatim** on the line directly above the rewritten `console.warn(...)` call. The rationale text after `-- IL-3:` stays "load-time migrate save fail" -- the wording change does not invalidate the rationale (the disable still exists because this is the load-time migrate save-failure diagnostic). No config-file rule widening; `eslint.config.js` is not touched for this requirement. Phase 14's drift guard will read the eslint surface as the binding contract for CMC-37.

### Claude's Discretion

- **Plan decomposition.** Phase 12 has 5 distinct deliverable areas (constants modules, reload-hint collapse + 6 callsite migrations + test rewrite, notify wrapper affirmation, migrate.ts + style-guide edit, drift-test scaffolding). Planner decides whether these split into 4 plans, 5 plans, or fewer with grouped deliverables. The constants modules + drift test naturally pair (same drift test exercises both); the reload-hint migration is a self-contained unit; migrate.ts + style-guide §14.1 update is atomic; notify wrapper affirmation is light-touch docs-only.

- **YAML parser choice for the drift test.** `node:test` has no built-in YAML parser. Options: `yaml` (small, ESM, current), `js-yaml` (popular, larger, CJS-compatible), or a hand-rolled regex extraction of the frontmatter block (it's a known shape -- `---` … `---` at file head, simple key + bullet list). For a single test file, hand-rolling is reasonable; for forward-compatibility with Phase 14's richer reader, `yaml` is the modern pick. Planner / researcher decides; no decision locked here.

- **Reload-hint test rewrite shape.** D-CMC-09 specifies the new behavior; planner decides the exact test names and how many assertions. Suggested minimum: empty-array case, single-name case, multi-name case (all three return the same trailer; only the empty case returns `""`).

### Folded Todos

No todos folded -- `gsd-sdk query todo.match-phase` reports no pending todos relevant to Phase 12.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Normative Style + Catalog Contract (THE binding inputs for v1.3)

- `docs/messaging-style-guide.md` v1.0 -- Normative; supersedes PRD §6.12 ES-5. Read **§3** (status tokens), **§4** (reasons enum), **§5** (reload hint), **§10** (severity routing), **§14** (IL-3 console.warn), **§14.1** (proposed migrate.ts wording -- Phase 12 locks per D-CMC-14), **§15** (ES-5 replacement table). The frontmatter `status_tokens:` and `reasons:` lists are the binding contract -- Phase 12 constants MUST match.
- `docs/output-catalog.md` -- Per-command rendered contract. Phase 12 doesn't consume directly (it's Phase 13's conformance target), but planners should be aware of it as the downstream consumer of Phase 12's primitives.

### Phase Scope + Requirements

- `.planning/ROADMAP.md` §Phase 12 (lines 125-156) -- Authoritative Phase 12 scope, success criteria, in/out-of-scope demarcation. Criterion #2 (verb selector gone) authorizes D-CMC-06; criterion #4 (output unchanged except migrate.ts) needs the D-CMC-10 carve-out.
- `.planning/REQUIREMENTS.md` -- CMC-08, CMC-11, CMC-14, CMC-19, CMC-36, CMC-37 are Phase 12's six requirements. **Resolved in Plan 12-01 (Task 3):** CMC-08 previously appended "plus the `reinstalled` token used in reinstall cascades" to the closed set -- but the frontmatter has 14 tokens, no `reinstalled`, and roadmap criterion #1 says "exactly the frontmatter set" (14). Phase 12 research §3.1 confirmed `reinstalled` is the `ReinstallPluginPartition` discriminant in `orchestrators/plugin/reinstall.ts`, an internal partition kind never rendered as a user-visible status token. Plan 12-01 dropped the "+ reinstalled" clause from REQUIREMENTS.md CMC-08; the closed set is the 14 frontmatter entries, drift-guarded by `tests/architecture/grammar-frontmatter.test.ts`.

### V1 Architecture + Stable User-Contract Primitives

- `docs/prd/pi-claude-marketplace-prd.md` §6.12 ES-2 (no `[error]`/`[warning]` prefix embedding -- reaffirmed by CMC-19), §6.12 ES-5 (legacy marker strings -- deferred deletion to Phase 13), §6.13 IL-2 (single output channel via `ctx.ui.notify`), §6.13 IL-3 (single sanctioned `console.warn` -- preserved by CMC-37).
- `docs/messaging-style-guide.md` §14.1 -- Phase 12 locks per D-CMC-14; also updated per D-CMC-15 to remove the discretion-deferral framing.

### Existing Source Files Phase 12 Touches

- `extensions/pi-claude-marketplace/shared/markers.ts` -- `RELOAD_HINT_PREFIX` (D-CMC-08 retains for snapshot test); also holds `PI_SUBAGENTS_NOT_LOADED`, `PI_MCP_ADAPTER_NOT_LOADED`, `MANUAL_RECOVERY_REQUIRED`, `ROLLBACK_PARTIAL` (Phase 13 atomic ES-5 edit deletes; Phase 12 does NOT touch). NEW exports under `shared/grammar/` do NOT replace markers.ts -- they are sibling modules.
- `extensions/pi-claude-marketplace/shared/notify.ts` -- Four sanctioned wrappers; D-CMC-11..D-CMC-13 affirm the API shape unchanged.
- `extensions/pi-claude-marketplace/presentation/reload-hint.ts` -- Collapsed per D-CMC-06; new local trailer constant per D-CMC-07; `ReloadVerb` type removed.
- `extensions/pi-claude-marketplace/presentation/index.ts` -- Barrel updated: remove `ReloadVerb` export; `reloadHint` and `appendReloadHint` exports retained (signature changes per D-CMC-06).
- `extensions/pi-claude-marketplace/persistence/migrate.ts:178` -- `console.warn` body rewritten per D-CMC-14; IL-3 comment preserved per D-CMC-16.

### Existing Test Files Phase 12 Touches

- `tests/architecture/markers-snapshot.test.ts` -- Phase 12 leaves untouched (Phase 13's atomic ES-5 edit deletes the `RELOAD_HINT_PREFIX` row alongside markers.ts and PRD §6.12).
- `tests/presentation/reload-hint.test.ts` -- Rewritten per D-CMC-09 to assert new single-trailer behavior.
- **NEW:** `tests/architecture/grammar-frontmatter.test.ts` (or planner-chosen name) -- Drift test asserting `STATUS_TOKENS` and `REASONS` set-equality against `docs/messaging-style-guide.md` frontmatter (D-CMC-04).

### Reinstall Cascade Awareness (for the CMC-08 doc conflict)

- `extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts` -- Source for the `reinstalled` partition kind referenced in CMC-08 text. Planner should grep this file to confirm `reinstalled` is an internal partition vs a user-visible status token before resolving the REQUIREMENTS.md conflict.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- **`as const` + literal-union pattern** at `extensions/pi-claude-marketplace/presentation/plugin-list.ts:45` (`type PluginRenderStatus = "installed" | "available" | "uninstallable"`). Direct template for D-CMC-03's constants shape.
- **Barrel re-export pattern** at `extensions/pi-claude-marketplace/presentation/index.ts` (`export { ... } from "./reload-hint.ts"; export type { ReloadVerb } from "./reload-hint.ts"`). Phase 12 follows this when removing `ReloadVerb` and (optionally) adding any new grammar barrel.
- **Sentence-form `console.warn` body composition** at `persistence/migrate.ts:177-181` -- existing template-string structure (`${...path...} (${errMsg}); ...`) can be reused for D-CMC-14's locked wording with minimal structural change.
- **Private layout constants idiom** at `presentation/plugin-list.ts:30` (`const MAX_LINE_COLUMN = 66`) -- pattern for D-CMC-07's local trailer constant inside `presentation/reload-hint.ts`.

### Established Patterns

- **D-11 layering boundary:** `presentation/` does NOT import from `persistence/`; it is imported by orchestrators. Phase 12's new `shared/grammar/` modules sit BELOW both -- pure data, importable from anywhere without violating layering. (Reaffirmed in PROJECT.md PRD §6.10 module diagram.)
- **D-07 single-callsite discipline for `ctx.ui.notify`:** Only `shared/notify.ts` calls `ctx.ui.notify` directly (per-file eslint override). D-CMC-11 reaffirms this -- composers in Phase 13 will return strings that flow into the four wrappers; no new direct callsite is added.
- **IL-3 single-callsite discipline for `console.warn`:** Inline `eslint-disable-next-line` comment with `-- IL-3: <rationale>` is the audit surface (not a config-file rule). D-CMC-16 preserves the comment verbatim. CMC-37 reaffirms.
- **Markers as stable user-contract constants:** `shared/markers.ts` is the durable home for user-contract strings that the markers-snapshot test asserts against PRD §6.12. D-CMC-07 / D-CMC-08 keep Phase 12's NEW trailer OUT of markers.ts because markers.ts is in transition until Phase 13's atomic edit.

### Integration Points

- **5 orchestrator callsites + 1 import callsite** receive the `reloadHint` signature change (D-CMC-06 enumeration). Each call is a localized 1-line edit dropping the verb argument; existing names array passes through unchanged.
- **`presentation/index.ts` barrel** is the public surface for `presentation/` -- updates here affect every orchestrator import.
- **`shared/grammar/` is new** -- no existing consumers; Phase 13 will be the first downstream consumer; Phase 14's drift guard is the second.
- **`tests/architecture/`** is the standing home for cross-cutting architectural assertions (existing examples: `markers-snapshot.test.ts`, `import-boundaries.test.ts`, `no-orchestrator-network.test.ts`). The new `grammar-frontmatter.test.ts` fits naturally.

</code_context>

<specifics>
## Specific Ideas

- **§14.1 wording locked verbatim** (D-CMC-14). The proposed sentence -- `Legacy marketplace migration could not be persisted to <path>; the in-memory normalized state is being used and the on-disk state.json is unchanged. Cause: <errMsg>.` -- becomes the binding text. No tightening pass; planner does not bikeshed this in PLAN.md.
- **Constants module shape mirrors `plugin-list.ts`'s `PluginRenderStatus`** pattern -- the codebase precedent is the template (D-CMC-03).
- **Single PR contains migrate.ts byte change + style-guide §14.1 doc edit** (D-CMC-15) -- atomic alignment of code and contract.

</specifics>

<deferred>
## Deferred Ideas

- **REQUIREMENTS.md CMC-08 vs frontmatter `reinstalled` reconciliation** -- Resolved in Plan 12-01 Task 3. The "+ `reinstalled`" clause was dropped from REQUIREMENTS.md CMC-08; the closed set is the 14 frontmatter entries (no internal partition-kind tokens are surfaced to users). The drift test at `tests/architecture/grammar-frontmatter.test.ts` (D-CMC-04) enforces set-equality against the binding frontmatter.

- **REQUIREMENTS.md CMC-11 / ROADMAP / CONTEXT reasons-count reconciliation** -- Resolved in Plan 12-01 Task 3. The frontmatter binding count is 23 (verified at `docs/messaging-style-guide.md:18-41`). Earlier drafts of REQUIREMENTS.md CMC-11, ROADMAP.md Phase 12 scope, and ROADMAP Success Criterion #1 stated a count of twenty-four reasons/entries; Plan 12-01 reconciled all three to twenty-three (the binding frontmatter count). The drift test enforces this count on every CI run.

- **Reload-hint test-coverage breadth** (Claude discretion). D-CMC-09 specifies the rewrite minimum; planner decides whether to add additional assertions (e.g., names array longer than 10 entries, names with embedded quotes/whitespace -- though under the new composer, names are no longer interpolated into the trailer, so these edge cases become irrelevant by design).

- **Shared frontmatter loader** -- Decision D-CMC-04 explicitly defers this to Phase 14. If Phase 14's drift-guard turns out to need substantially richer YAML parsing (e.g., `pattern_classes:` cross-reference walks), the loader becomes a natural extraction point at that time.

- **Cause-chain rewrite to MSG-CC-1 form** (depth 5, lowercase `cause:`, ` -> ` separator, `(truncated)` suffix) is explicitly **Phase 13's** work per D-CMC-12 -- `notifyError`'s body stays untouched in Phase 12.

</deferred>

---

*Phase: 12-messaging-foundations-renderer-primitives*
*Context gathered: 2026-05-22*
