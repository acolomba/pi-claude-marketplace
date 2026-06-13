---
quick_task: 260612-bcs-fix-pr-51-five-agent-review-findings
sub_plan: 07
type: execute
wave: 7
date_completed: 2026-06-12
commit: 6843255
files_modified:
  - CHANGELOG.md
  - CLAUDE.md
  - extensions/pi-claude-marketplace/orchestrators/marketplace/remove.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/README.md
  - extensions/pi-claude-marketplace/orchestrators/reconcile/apply-outcomes.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/notify.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/plan.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/preview.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/types.ts
  - extensions/pi-claude-marketplace/persistence/config-merge.ts
  - extensions/pi-claude-marketplace/persistence/config-write-back.ts
  - extensions/pi-claude-marketplace/persistence/migrate-config.ts
  - extensions/pi-claude-marketplace/shared/notify.ts
requirements:
  - D1
  - D2
  - D3
  - D4
  - D5
  - D6
  - D7
  - D8
  - D9
  - D10
  - D11
  - S1
  - D-MIG
byte_contract: byte-neutral
---

# Sub-Plan 07 Summary: Comments and docs scrub

Final sub-plan of quick task 260612-bcs. Comments / docs only over the
post-Plans-01-06 source. ZERO source-logic edits; ZERO rendered-byte
change. Commit `6843255` on `features/v1.12-config-files`.

## Findings closed

### D1 - reconcile/README.md rewrite

`extensions/pi-claude-marketplace/orchestrators/reconcile/README.md`
rewritten end-to-end in domain terms:

- Lists all 7 files (README + `types.ts` + `apply-outcomes.ts` +
  `plan.ts` + `notify.ts` + `preview.ts` + `apply.ts`) with a one-line
  role each.
- Asserts `pluginsToEnable` IS populated and pins the assertion to
  `plan.ts::isRecordedButDisabled` and
  `plan.ts::classifyDeclaredPlugin`.
- Drops the stale `state.disabled` prediction; documents the empty-
  resources + `installable: true` marker as the structural "currently
  disabled" sentinel.
- Removes the Plan 01 / Plan 02 split table and all Phase 53 / Phase 54
  / Phase 55 narration.
- Adds explicit sections on Purity discipline, the 7-bucket model,
  Sentinel contracts (empty-resources + tri-state `samePlannedSource`),
  Apply path, Preview path, and Analog modules.

Note: `mdformat` re-flowed the file during pre-commit (its standard
whitespace + table-cell normalization); content unchanged.

### D2 - reconcile/apply.ts textual corrections

- File header: "drive the four orchestrators" -> "drive the five
  orchestrators (uninstallPlugin, removeMarketplace, addMarketplace,
  installPlugin, setPluginEnabled)".
- `applyPlan` order rationale rewritten: step 1 (uninstall) now
  correctly states that `buildUninstallBucket` (plan.ts) EXCLUDES
  plugins under a to-be-removed marketplace, and that the remove
  cascade (WR-02 at `foldRemoveOutcome`) handles them whole-cloth.
- "Pitfall 8 data dependency" / "Pattern 3 / Pitfall 3 / CR-01"
  rationale lines retained only the spec anchor (CR-01) plus a
  one-sentence explanation of `proper-lockfile`'s non-re-entrancy.

### D3 - shared/notify.ts tuple-position claims

- `STATUS_TOKENS` header (lines 193-198 in the pre-edit source): now
  describes the 6 `"will *"` entries as sitting AFTER the four head-
  of-tuple state-change tokens (not as "trailing"), and explicitly
  states that the `"disabled"` entry is appended LAST after the
  `"will *"` block while the head-of-tuple invariant remains
  preserved.
- `PLUGIN_STATUSES` header (lines 341-347 in the pre-edit source):
  rewritten to drop "trailing" framing, name `"disabled"` as the
  trailing D-54-01 / ENBL-04 token, and explain that `"disabled"`
  joins the reload-hint set only under the `disable-cascade` kind
  (UAT-03).

### D4 - uninstall.ts JSDoc cleanup + variable-ref fixes

- Orphaned `PU-1..8 entrypoint ... Returns void` JSDoc above
  `emitCascadeFailure` deleted (the actual entrypoint at the bottom
  of the file already carries the correct doc).
- Stale variable references `outcome.dropped.*` and `outcome.cause`
  inside the cascade-handling comment block re-pointed at the local
  names (`localOutcome.dropped.*`, `localOutcome.cause`).
- Post-state-commit comment that referenced a `cascadeResult ===
  undefined` defensive-guard branch (no longer present) replaced
  with a one-sentence reachability narration referring to the
  surviving `alreadyGone` + `cascadeFailure` checks.
- `shared.ts:339` line-number ref re-pointed at
  `orchestrators/marketplace/shared.ts::cascadeUnstagePlugin`.

### D5 - install.ts version-resolver docstring

- File header (line 16 pre-edit): "PI-7: `resolveInstallVersion`
  (entry.version > hash fallback)" -> "PI-7: `resolvePluginVersion`
  -- 3-tier precedence (plugin.json > entry.version > hash); see
  `shared.ts::resolvePluginVersion`".
- In-body comment at the version resolution site (line 494 pre-edit):
  "PI-7 version precedence (entry > hash)" -> "PI-7 version
  precedence: `resolvePluginVersion`'s 3-tier ladder (plugin.json >
  entry.version > hash), per `shared.ts::resolvePluginVersion`".

### D6 - reconcile/plan.ts isRecordedButDisabled docstring

- Dropped the stale `install.ts::statePhase (lines 617-664)` line
  range.
- Rephrased "the only code path that writes `resources.*`" to "the
  only path that POPULATES `resources.*`" (the disable orchestrator
  is the only path that empties them while keeping the record), so
  the docstring no longer self-contradicts.

### D7 - reconcile/apply-outcomes.ts InvalidBlockOutcome.reason

- Single-line JSDoc on `reason: ContentReason` expanded to a multi-
  line block that names the two provenances accurately:
  - CFG-03 read-pass arm: hard-coded literal `"invalid manifest"`.
  - State-load throw arm: `classifyReadPassThrow` (apply.ts) yields
    `"lock held"`, `"unparseable"`, or another `narrowProbeError`
    token.

### D8 - marketplace/remove.ts Flow header

- Rewrote the Flow narration to match the current implementation:
  `resolveScopeOrNotifyNotAdded` (standalone) /
  `resolveScopeOrFailedOutcome` (orchestrated) for scope resolution;
  `withLockedStateTransaction` with the CFG-03
  `loadConfig`-then-abort gate; the per-plugin cascade loop with
  successfullyUnstaged / failedPlugins tracking; WB-01
  `deleteMarketplaceConfigEntryWithCascade` write-back; explicit
  `tx.save()` on the mutating arms.
- Stale `resolveScopeFromState` reference at the
  `RemoveMarketplaceOptions.scope` JSDoc re-pointed at
  `resolveScopeOrNotifyNotAdded` / `resolveScopeOrFailedOutcome`.

### D9 - notify.ts + types.ts present-tense

- `reconcile/notify.ts` header: dropped the "DIFF-02 replaces the
  initial DIFF-01 placeholder strings" evolution narration; the
  surviving header is a single tense-stable description of the
  current projection.
- `reconcile/types.ts` header: removed the parenthetical "actions a
  future apply path would take" and replaced with "actions the
  apply path takes".

### D10 - line-number cross-refs replaced with symbolic refs

Across `install.ts`, `uninstall.ts`, `apply.ts`,
`apply-outcomes.ts`, `plan.ts`, `marketplace/remove.ts`:

- `shared/notify.ts:743` and `shared/notify.ts:719` -> symbolic
  `shared/notify.ts::renderScopeBracket`.
- `install.ts:936-944`, `install.ts:1098-1166`,
  `uninstall.ts:298-302`, `reinstall.ts:247-252` -> symbolic
  references to the orchestrator entrypoint names instead of line
  ranges.
- `shared.ts:339` -> `marketplace/shared.ts::cascadeUnstagePlugin`.
- `install.ts:617-664` (statePhase) -> `install.ts::statePhase` in
  the plan.ts disabled-marker docstring.
- `docs/output-catalog.md:308-314` / `:340-348` line-number refs
  replaced with section-name references ("Failure" arm,
  "Failure with rollback-partial children" arm, the
  `/claude:plugin uninstall <plugin>@<marketplace>` "Success" arm).
- `apply.ts:34` external-dep line numbers narration retained
  (it now reads as a generic "agent-session.js: bindExtensions
  emits session_start, then ..." flow description, anchored on
  symbol names rather than line ranges).
- `apply.ts:68` "(mirrors preview.ts:60)" -> "mirrors
  `preview.ts::previewReconcile`'s scope fan-out".

### D11 - policy violations stripped

Tokens stripped across the listed files (specification anchors
preserved per `.claude/rules/typescript-comments.md`):

- `Pitfall 51-1`, `Pitfall 51-4`, `Pitfall 52-1`, `Pitfall 52-2`,
  `Pitfall 52-3`, `Pitfall 52-4`, `Pitfall 52-5`, `Pitfall 52-6`,
  `Pitfall 53-1`, `Pitfall 53-2`, `Pitfall 53-4`, `Pitfall 53-7`,
  `Pitfall 53-?`, `Pitfall 54-1`, `Pitfall 54-2`, `Pitfall 54-4`,
  `Pitfall 54-5`, `Pitfall 54-6`, `Pitfall 54-N`, `Pitfall 1`,
  `Pitfall 2`, `Pitfall 3`, `Pitfall 4`, `Pitfall 5`, `Pitfall 8`
  -- removed; inline rationale kept.
- `Pattern 3 / Pitfall 3` rationale -> `CR-01` only.
- `Pattern 4 / A1` -> `A1` only (Pattern 4 stripped).
- `RESEARCH Assumption A1` -> `A1` only.
- `RESEARCH Pattern 5 Option A` (apply-outcomes.ts:119,
  notify.ts:294 + :348 ~) -> generic "reuse existing transition
  tokens / no new closed-set literal" rationale.
- `RESEARCH Pattern 5` (shared/notify.ts:547, :1410, :1415,
  :1773, :1796, :1808, :1820) -> generic "reuses
  ICON_INSTALLED / ICON_UNINSTALLABLE -- same glyph as ..."
  rationale.
- `RESEARCH Security Threat Pattern "Information disclosure"
  T-53-02-02` -> "information-disclosure mitigation T-53-02-02".
- `Rule 2 deviation from the original plan's behavior block`
  (plan.ts:262) -> generic "is load-bearing" framing.
- `byte-identical to today` (uninstall.ts:70 + :132,
  enable-disable.ts:92 + :148 + :153, remove.ts:75 + :138)
  -> `matches standalone behavior`.
- `v1.12 config family` -> `schemaVersion-1 config family`
  (config-write-back.ts header).
- `downstream phases` -> `downstream layers`
  (config-merge.ts loadMergedScopeConfig docstring).
- install.ts:1201-1217 IN-02 / IN-04 changelog-voice block
  condensed into a single durable sentence pair describing the
  current behaviour (version pass-through; row-scope omission
  convention).
- uninstall.ts:635-640 CMC-24 changelog-voice block condensed
  similarly into a single durable narration of the survivor
  guard + the renderer's structural empty-version handling.

### S1 - CLAUDE.md NFR-10 enumeration

`CLAUDE.md` Containment bullet updated to include
`<scopeRoot>/claude-plugins.json` and
`<scopeRoot>/claude-plugins.local.json` alongside
`<scopeRoot>/pi-claude-marketplace/`, `<scopeRoot>/agents/`, and
`<scopeRoot>/mcp.json`. The config-file location now reads as
sanctioned containment rather than containment widening.

### D-MIG - persistence/migrate-config.ts contract comment (LOCKED)

`MigrateFirstRunResult` docstring rewritten to lead with two
sentences declaring that:

- The result is INFORMATIONAL and the load-time caller intentionally
  discards it.
- First-run migration is deliberately load-time silent (NFR-2):
  every successful arm produces no `notify()` call.

The remaining trichotomy narration (`existing-valid` /
`existing-invalid` / `empty-state` arms and the type-system narrowing
on `reason`) is preserved. NO `notify` call added.

## Additional scope - CHANGELOG.md amendment

Per user instruction (the `[0.5.0]` entry is still unreleased -- PR
#51 open):

- Refreshed the date from `2026-06-11` to `2026-06-12`.
- Added 6 new bullets covering the user-visible changes landed in
  sub-plans 01-06:
  1. Reconcile cascade reports each plugin individually on partial
     marketplace remove (instead of collapsing to one failure row).
  2. Reconcile classifies lock-contention and plugin-shape failures
     honestly (`{lock held}` / `{not in manifest}` / etc.) instead
     of all flattening to `{unreadable}`.
  3. Invalid-config rows now carry the underlying parse / permission
     detail as an indented cause line (paths redacted to basenames).
  4. `plugin update` and autoupdate cascade on a disabled plugin
     refresh the record but keep the plugin disabled.
  5. Autoupdate no longer reports success for a flip it could not
     persist (`(failed)` row replaces a misleading `(autoupdate
     enabled)`).
  6. `reinstall` and `update` warn when the config write-back is
     skipped because the config file is invalid.

## Verification

- `grep -RnE '(Phase [0-9]+|Plan [0-9]+|Wave [0-9]+|milestone v[0-9])'`
  across the scope file list returns no matches.
- `grep -RnE 'Pitfall|RESEARCH|Pattern [0-9]'` across the scope file
  list returns no matches.
- `npm run check` GREEN (typecheck + ESLint + Prettier + tests + the
  catalog-uat byte-equality gate -- 1853 unit tests + 10 integration
  tests passed).
- `pre-commit run --files ...` GREEN. `mdformat` re-flowed the
  rewritten reconcile/README.md once on first run; second run was
  clean.
- Pre-commit committed all 17 files in one atomic Conventional
  Commit (`6843255`, type `docs`, title 60 chars).
- Diff is comments + markdown + CLAUDE.md prose ONLY; ZERO source-
  logic edits. Confirmed via per-file scan against added/removed
  lines that are not comments, JSDoc, blank, or pure whitespace --
  the only matches were two single-line JSDoc lines whose text
  changes are themselves the D-7 / D-8 corrections.

## Notes on findings already handled by prior sub-plans

The CONTEXT.md line references predate six landed commits. Spot
checks against current source confirmed:

- D-UPD (update.ts comment fixes that were tagged for sub-plan 03)
  -- already in place at this scrub; nothing to do.
- S4 (synthesizeUndeclaredMarketplaceSource doc warnings) --
  sub-plan 03 already addressed; nothing to add here.
- The `STATUS_TOKENS` / `PLUGIN_STATUSES` tuple-position narrations
  (D3) had drifted twice in the interim; both spots fixed in this
  scrub against the current tuple order.

## Files NOT touched (deliberately out of scope)

- `extensions/pi-claude-marketplace/bridges/README.md`,
  `domain/README.md`, `edge/README.md`, `orchestrators/README.md`,
  `persistence/README.md`, `platform/README.md`,
  `shared/README.md`: all contain `Phase N` narration but were NOT
  flagged by the five-agent review and were NOT in this sub-plan's
  file list. Scope boundary preserved.
- `bridges/agents/stage.ts` "two-phase commit" narration: domain
  language per `.claude/rules/typescript-comments.md`; preserved.
- `orchestrators/plugin/update.ts` `Phase 2a/2b/3a/3b` headers:
  domain language (the three-phase update protocol); preserved.

## Commit

```
6843255 docs(reconcile): scrub planning-artifact comments and rewrite README
```
