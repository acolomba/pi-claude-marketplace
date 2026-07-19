# Quick Task 260612-bcs: Fix PR #51 five-agent review findings - Context

**Gathered:** 2026-06-12
**Status:** Ready for planning

<domain>
## Task Boundary

Fix all findings from a five-agent review (code-reviewer, pr-test-analyzer,
silent-failure-hunter, type-design-analyzer, comment-analyzer) of PR #51
(branch `features/v1.12-config-files` vs `main`). Findings span the reconcile
subsystem, config persistence, enable/disable commands, and comments/docs.
All file:line references below were verified by the review agents against the
current branch HEAD.

</domain>

<decisions>
## Implementation Decisions

### Update vs disabled plugins (user ruling)
- `plugin update` and marketplace autoupdate cascade must NOT re-materialize a
  disabled plugin's artefacts. **Update the record (version/source pin) but
  keep the plugin disabled** — `resources.*` stay empty. Enable later
  re-materializes from the current manifest.
- Rendering: prefer NO new catalog tokens. If a new reason token proves
  necessary, it is a closed-set catalog amendment: docs/output-catalog.md +
  notify.ts tuple + catalog-uat tests must move in the same atomic commit.
- Pin the chosen semantics with tests in tests/orchestrators/plugin/update.test.ts
  (seed a disabled record: empty resources.* + installable true) and the
  autoupdate cascade path.

### narrowCascadeFailure divergence (user ruling)
- Align `orchestrators/marketplace/remove.ts:159-165` to uninstall.ts's
  ATTR-09 mapping: `AgentsUnstageFailureError` → `"source mismatch"` (not
  `"not in manifest"`). Add a test pinning the alignment.

### First-run migration silence (user ruling)
- Silence is deliberate (NFR-2 load-time quiet). Fix the contract comment in
  `persistence/migrate-config.ts:30-33` to say the result is informational and
  callers intentionally discard it. Do NOT add a notify.

### Claude's Discretion
- Batching of findings into tasks, exact discriminant/field names for type
  cuts, and comment rewording details.

</decisions>

<specifics>
## Findings to fix (all of them)

### CRITICAL

C1. `orchestrators/plugin/enable-disable.ts:292-297` — `setPluginEnabled`
violates its own "never re-throws" contract (doc at :281-284):
`resolveCrossScopePluginTarget` runs BEFORE the try/catch and calls
`loadState`, which throws on corrupt/unparseable state.json in either scope.
Edge handler (`edge/handlers/plugin/enable-disable.ts:48-57`) has no catch →
zero notify output (IL-2 violation) and leaks absolute state.json path
(contradicts T-53-02-02 basename-only). Fix: wrap resolution in the same
try/catch ladder mapping through `classifyTransactionThrow` (already at :480)
to a `(failed)` row / typed outcome. Model to copy:
`reconcile/preview.ts:158-170`. Add a test (corrupt state.json → enable
renders a failed row, no throw).

### IMPORTANT — error handling

I1. `marketplace/remove.ts:268-277` + `reconcile/apply.ts:268-275` —
orchestrated partial marketplace remove drops the successfully-uninstalled
plugin rows and failures 2..N. State was saved (`remove.ts:489` calls
tx.save() even with failedPlugins), plugins are gone from disk, but the
reconcile cascade renders only one `(failed)` row with the first failure's
reason. Fix: add a partial arm (or carry `unstaged` + per-plugin failures on
the failed arm) mirroring the standalone CMC-31 PARTIAL shape; fold it in
`applyMarketplaceRemoves`. Test it.

I2. `marketplace/autoupdate.ts:343-347` vs :484-501 — `writeAutoupdateBack`
silently skips entries with no synthesizable source, but the name stays in
`finalResult.changed`, so the final notify renders success for a flip that
was never persisted. Fix: return skipped names from `writeAutoupdateBack` and
demote them to honest failed/skipped rows. Test it.

I3. `enable-disable.ts:252-259` — disable branch ignores `cascade.dropped` on
partial cascade failure: state.json keeps claiming artefacts gone from disk
(fail-clean/NFR-3 gap). Mirror the TR-03 fold from `uninstall.ts:468-484`:
apply the dropped-fold, save the shrunken record, then surface the failure.
Test it.

I4. `enable-disable.ts:206-213` — enable branch doesn't thread
`InstallFailureCapture` into `runInstallLedger` (4th arg), so rollback-partial
recovery rows are lost on enable failure. Thread a capture and render
`rollbackPartials` into the failed row like `composeInstallFailureMessage`
does (`install.ts:343-352`, used at :810/:967).

I5. `persistence/config-io.ts:119-155` + consumers (`reconcile/apply.ts:152-169`,
`reconcile/preview.ts:72-80`, `enable-disable.ts:507/618`, `install.ts:1019`,
`uninstall.ts:296`, `marketplace/remove.ts:543`, `marketplace/autoupdate.ts:373`,
`migrate-config.ts:151-158`) — loadConfig's diagnostic detail (EACCES vs JSON
parse vs schema key) is dropped at every surface; everything renders
`{invalid manifest}`, misdirecting users to syntax when the problem is
permissions. Fix: thread `result.error` into the row's `cause` (cause-chain
trailer already exists) after stripping absolute paths (T-53-02-02 hides
paths, not parse detail). Test at least one surface (EACCES or schema-key).

I6. `reconcile/apply.ts:181-184, 420` — `classifyOrchestratorThrow` (bare
`narrowProbeError`) flattens `PluginShapeError` (not-in-manifest,
already-installed, unsupported) and `StateLockHeldError` to `{unreadable}`.
Fix: extend with `StateLockHeldError → "lock held"` and `PluginShapeError →`
kind-mapped reasons (model: `import/execute.ts`'s `dispatchFailedOutcome`
instanceof narrowing). Test: config declares a plugin absent from the
manifest → apply renders `{not in manifest}`, not `{unreadable}`.

### IMPORTANT — test gaps

T1. Load-time ENABLE never exercised through `applyReconcile`
(`reconcile/apply.ts:551-556`, `reconcile/notify.ts:320-335` plugin-enabled
arm has zero test hits). Add a test mirroring the WR-09 disable-axis test in
`tests/orchestrators/reconcile/apply.test.ts:443`: disabled record + config
enabled → apply → `(installed)` row, state re-populated, both config files
byte-unchanged, second reconcile silent. Also add an orchestrated
enable-success test (`status: "enabled"` + version) in
`tests/orchestrators/plugin/enable-disable.test.ts` (currently only
standalone fresh-enable at :339).

T2. Update-vs-disabled semantics (see decision above) — currently NO guard in
update.ts and no test seeds a disabled record. Implement the decided behavior
and pin it.

T3. Direct `pluginsToUninstall` bucket through `applyReconcile`
(`apply.ts:333-387`): marketplace stays declared, one plugin entry deleted
from config → applyPluginUninstalls, incl. WR-06 converged-row-drop at the
apply layer. Currently only covered via marketplace-remove cascade.

T4. `applySourceMismatches` (`apply.ts:515-524`) and applied-cascade
`source-mismatch` arm (`notify.ts:353-364`) never rendered through apply in
any test, incl. the dangling-reference plugin child row. Add one.

T5. Predicate-drift agreement test between `isRecordedButDisabled`
(`plan.ts:285-295`) and `isCurrentlyDisabled` (`enable-disable.ts:167-183`):
matrix over populated/empty resources × installable true/false, assert the
two predicates agree.

T6. Smaller: `classifyReadPassThrow` lock-held arm (`apply.ts:193-203`)
untested; `loadConfig` non-ENOENT read-failure arm (`config-io.ts:128-133`,
portable via directory named claude-plugins.json → EISDIR);
`writeMarketplaceConfigEntry` partial patch on absent marketplace
(`config-write-back.ts:58, 177` casts) — pin saveConfig's loud refusal.

### IMPORTANT — type design

Y1. `domain/source.ts:399` — `samePlannedSource(): boolean | "unknown-stored"`:
the sentinel is truthy; one careless `if (...)` treats a corrupt record as a
source match. Change to `"same" | "different" | "unknown-stored"` and update
the comparison sites (plan.ts:138, 192 use `=== true` today).

Y2. `reconcile/types.ts:137-150` — `PlannedSourceMismatch` overloads 4
diagnostics onto 2 discriminant values with sentinel strings in data fields
(`recordedSource: "<marketplace not declared>"`, `marketplace` carrying a raw
malformed config key). Widen the discriminant:
`cause: "source-mismatch" | "unknown-stored" | "dangling-reference" | "malformed-plugin-key"`
with per-cause variants (`plugin` required on dangling-reference, `rawKey` on
malformed-plugin-key instead of punning `marketplace`). Propagate to
`SourceMismatchOutcome` (`apply-outcomes.ts:130-134`) and the renderers
(`notify.ts:143`, `apply.ts:515` currently treat all identically — keep
rendered output byte-identical).

Y3. `enable-disable.ts:287` + `apply.ts:470-471` — `setPluginEnabled`'s
mode-blind `| undefined` return; apply handles impossible undefined by
`continue`, silently dropping a reconcile outcome row. Add an overload pair
(`opts & {notifications: {mode:"orchestrated"}}` → `Promise<EnableDisablePluginOutcome>`),
mirroring the existing `AddMarketplaceNotifications` pattern; remove the dead
continue (or make it fail-loud like `import/execute.ts:613` records
"returned no outcome in orchestrated mode").

Y4. `apply-outcomes.ts:138-147` — `InvalidBlockOutcome.marketplace` carries a
file basename, not a marketplace name. Rename the field (e.g. `basename`) and
update the renderer.

Y5. `migrate-config.ts:41-53` — cut `MigrateFirstRunResult` along the
existing `reason` discriminant so `error` exists only on the
`existing-invalid` arm.

Y6. `apply.ts:435-450` — `PluginToggleAxes.successStatus` is derivable from
`enable`; derive it inside `applyPluginToggles` and drop the redundant axis.

Y7. (smaller, from failure-hunter minor list) `index.ts:31` — use
`errorMessage(err)` instead of `(err as Error).message` so non-Error throws
don't render "reconcile aborted: undefined".

### IMPORTANT — comments/docs

D1. `orchestrators/reconcile/README.md` — rewrite in domain terms (keep the
technical content: purity discipline, 7-bucket model, sentinel contracts).
Currently factually wrong: claims `pluginsToEnable` structurally empty
(plan.ts:285-295/:375-382 populate it), predicts a `state.disabled` field
that was deliberately never added (the marker is empty resources +
installable), lists 5 of 7 files, and is written in forbidden
process-history voice (Phase 53/54/55, Plan 01/02 tables).

D2. `reconcile/apply.ts:18` — "drive the four orchestrators" → five (lists
six actions). `apply.ts:533-534` — order rationale contradicts the planner:
buildUninstallBucket (plan.ts:386-414) EXCLUDES plugins under a to-be-removed
marketplace (apply.ts's own WR-02 comment at :251 says so); fix the wording.

D3. `shared/notify.ts:163` and :275-276 — tuple-position claims broken by the
`disabled` token ("will * appended at the END" / "four trailing will *
entries" — `"disabled"` is now last). These are byte-load-bearing reasoning
for catalog gates; correct them.

D4. `uninstall.ts:193-204` — orphaned JSDoc ("PU-1..8 entrypoint... Returns
void") sits above the helper `emitCascadeFailure`; the real entrypoint is at
:356 returning `Promise<UninstallPluginOutcome | undefined>`. Delete or merge
into the entrypoint doc at :348-351. Also :617/:630 reference variables that
no longer exist (`outcome`, `cascadeResult`; locals are `removedVersion`,
`cascadeFailure`, `localOutcome`).

D5. `install.ts:16` — names nonexistent `resolveInstallVersion` with stale
2-tier precedence; actual is `resolvePluginVersion`, 3-tier
(plugin.json > entry.version > hash, per plugin/shared.ts:461-475). Same
stale 2-tier note at install.ts:494.

D6. `reconcile/plan.ts:263-266` — stale line range ("install.ts::statePhase
lines 617-664"; actual :671) + self-contradiction ("only code path that
writes resources.*" vs disable emptying them). Say "the only path that
POPULATES them"; drop line numbers.

D7. `apply-outcomes.ts:145` — wrong provenance: CFG-03 reason is the
hard-coded literal "invalid manifest" (never narrowProbeError) and the
state-load arm can also yield "lock held"; fix the doc.

D8. `marketplace/remove.ts:19-35` header Flow narrates the pre-rewrite
implementation (resolveScopeFromState, withStateGuard; code uses
resolveScopeOrNotifyNotAdded / withLockedStateTransaction + tx.save(), and
omits the CFG-03 gate and WB-01 write-back). Rewrite the Flow. Same stale ref
at :111.

D9. `reconcile/notify.ts:226-228` future tense for landed enable wiring;
`types.ts:9` "future apply path" — apply.ts exists. Fix tense.

D10. Replace hard line-number cross-references with symbolic ones
(file.ts::functionName); several already wrong: `install.ts:1077` and :1212
give two different wrong locations for renderScopeBracket (actual
notify.ts:1475); `install.ts:1078` self-ref; `install.ts:807` and
`uninstall.ts:633` point at wrong output-catalog.md sections;
`uninstall.ts:465` "shared.ts:339"; `install.ts:1214-1215`
"uninstall.ts:298-302"; `apply.ts:34` external-dep line numbers (anchor to
dep version instead); `apply.ts:68` "(mirrors preview.ts:60)".

D11. Policy violations to strip: `enable-disable.ts:35-38` Pitfall 54-2
landing-sequence note; `reconcile/notify.ts:14-16` DIFF-01→DIFF-02 evolution
note; unresolvable planning-artifact refs ("RESEARCH Pattern 5 Option A" at
notify.ts:274/:321 and apply-outcomes.ts:96, "RESEARCH Assumption A1"
apply.ts:31, "RESEARCH Security Threat Pattern" preview.ts:69, "Rule 2
deviation from the original plan's behavior block" plan.ts:271-272);
broken pitfall placeholders ("Pitfall 53-?" plan.ts:25, "Pitfall 54-N"
apply.ts:91) and bare unresolvable ones ("Pitfall 1/2/3/4/5/8",
"Pattern 3/4" in apply.ts and install.ts) — keep the inline rationale,
strip the dead IDs; "byte-identical to today" (uninstall.ts:70/:132,
remove.ts:75/:125, enable-disable.ts:85/:146) → "matches standalone
behavior"; `config-write-back.ts:30` "v1.12 config family" → "schemaVersion-1
config family"; `config-merge.ts:139` "downstream phases" → "downstream
layers"; changelog-voice blocks `install.ts:1201-1217` and
`uninstall.ts:635-640` → one durable sentence each.

### SUGGESTIONS (also in scope — user said fix everything)

S1. CLAUDE.md NFR-10 enumeration: add `<scopeRoot>/claude-plugins.json` and
`<scopeRoot>/claude-plugins.local.json` to the sanctioned write paths so the
config-file location doesn't read as containment widening
(locations.ts:133 context).

S2. Reconcile-driven installs drop `result.postCommitWarnings`
(`apply.ts:389-433`; install.ts:1108-1163 collects them for cascade callers;
import/execute.ts:699-703 surfaces them). Surface them in the reconcile
cascade like import does, or add a decision-anchored comment if deliberately
dropped — prefer surfacing.

S3. `apply.ts:596-603` — read-pass throw misattributes the failing file to
state.json even when the throw came from saveConfig inside
migrateFirstRunConfig (EACCES on claude-plugins.json). Attribute correctly.

S4. `plugin/shared.ts:284-285` — `synthesizeUndeclaredMarketplaceSource`
returning undefined silently seals the destructive dangling-declaration fate
its own doc (:250-257) warns about. At minimum document at the call sites;
better: skip the config write and surface a row when synthesis fails.

S5. `reinstall.ts:1090-1092` and `update.ts:1032-1034` — invalid config →
silent skip of write-back while success notify proceeds. Make consistent with
the loud CFG-03 aborts siblings perform (or at minimum append a warning row).

S6. `apply.ts:245-248, 303-306, 349-352, 470-473` — outcome-less orchestrated
call vanishes from cascade; adopt import/execute.ts:613's fail-loud pattern
(covered partly by Y3 for toggles; apply to the other three loops).

S7. `config-io.ts` ScopeConfig consumers repeat `enabled !== false`; export a
one-line `isDeclaredEnabled(entry)` helper and use it (plan.ts etc.).

S8. `reconcile/notify.ts:51-58` MarketplaceBlock.status — narrow to the 5
statuses the projection assigns + undefined; delete the defensive runtime
throw at :118-126.

S9. `notify.ts:1865-1873` cascadeSeverity structural-subset param widens
status to string; tighten to the closed set.

S10. `config-write-back.ts:58` cast comment: point at saveConfig's validator
backstop (per type-review note).

</specifics>

<constraints>
## Execution constraints

- `npm run check` must stay green (typecheck + ESLint + Prettier + tests) —
  NFR-6. Run it before every commit.
- Rendered output is byte-frozen by catalog-uat tests: any change that alters
  message bytes requires updating docs/output-catalog.md and the catalog
  tests in the SAME commit. Prefer fixes that keep output byte-identical
  unless a finding explicitly demands new output (I1, I2, I5 do add/change
  rows — treat each as a catalog amendment).
- Output row grammar: `<glyph> <name> [scope] (status) {reason}` — status
  token never precedes the subject; new tokens are closed-set catalog
  amendments.
- Comment policy: .claude/rules/typescript-comments.md — no process history;
  decision IDs and requirement IDs are the allowed traceability anchors.
- Conventional Commits; titles ≤72 chars; body lines ≤80 chars.
- Run `pre-commit run --files <changed files>` before every git commit; never
  --no-verify.
- IL-2: all user-visible messages through notify(); IL-3: exactly one
  sanctioned console.warn (migrate.ts).
- Tests use node:test. Full suite: `npm test`.
</constraints>

<canonical_refs>
## Canonical References

- .claude/rules/typescript-comments.md (comment policy)
- docs/output-catalog.md, docs/messaging-style-guide.md (output contracts)
- CLAUDE.md (NFR/IL constraints; NFR-10 is itself amended by S1)
</canonical_refs>
