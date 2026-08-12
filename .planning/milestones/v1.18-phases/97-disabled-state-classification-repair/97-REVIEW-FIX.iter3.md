---
phase: 97-disabled-state-classification-repair
fixed_at: 2026-08-10T00:15:00Z
review_path: .planning/phases/97-disabled-state-classification-repair/97-REVIEW.md
iteration: 2
findings_in_scope: 3
fixed: 3
skipped: 0
status: all_fixed
---

# Phase 97: Code Review Fix Report

**Fixed at:** 2026-08-10T00:15:00Z
**Source review:** `.planning/phases/97-disabled-state-classification-repair/97-REVIEW.md`
**Iteration:** 2 (cumulative disposition across both iterations)

**Summary — iteration 2 scope:**

- Findings in scope (the three NEW warnings): 3
- Fixed: 3 (WR-07, WR-08, WR-09)
- Skipped: 0
- Info findings (IN-01..IN-06): out of scope by declared policy, listed below

**Verification:** `PI_SUBAGENTS_ROOT=... npm run check` — **CHECK_EXIT=0**
(typecheck + ESLint + Prettier + 3331 unit tests, 0 failures, 1 skipped; 18
integration tests, 0 failures). Log at `97-fix3-check.log`. `pre-commit run
--files <every touched path>` also clean (exit 0).

**Where verification ran:** in the worktree
`/home/acolomba/pi-claude-marketplace/.worktrees/manifest-independent-plugin-info`
— the checkout the agent was handed, which carries `node_modules`. Not a
separate throwaway worktree, so the numbers reproduce from the tree under
review. `workflow.use_worktrees` isolation was not applied: the orchestrator
handed over an existing worktree and instructed all work to happen there.

## Disposition (cumulative)

| ID | Severity | Disposition | Commit |
|----|----------|-------------|--------|
| CR-01 | BLOCKER | fixed (iteration 1), verified RESOLVED | `b94684c8`, `96a05a9` |
| CR-02 | BLOCKER | fixed (iteration 1), verified RESOLVED | `e755bc92` |
| WR-01 | WARNING | fixed (iteration 1), verified RESOLVED | `9d4431b4` |
| WR-02 | WARNING | deferred + carrier (Phase 98) | `d601e0fb` |
| WR-03 | WARNING | fixed (iteration 1), verified RESOLVED | `93bd994d` |
| WR-04 | WARNING | deferred + carrier (Phase 98) | `d601e0fb` |
| WR-05 | WARNING | reclassified — premise disproved; pinned instead | `ad794396`, `276122a` |
| WR-06 | WARNING | deferred + carrier (Phase 98) | `d601e0fb` |
| **WR-07** | **WARNING** | **fixed** | `8367bb10` |
| **WR-08** | **WARNING** | **fixed** | `97b600b7` |
| **WR-09** | **WARNING** | **fixed** | `72316b7e` |
| IN-01..IN-06 | INFO | out of scope (not attempted) | — |

## Fixed Issues (iteration 2)

### WR-07: the enable row discarded two of the three degradation signals

**Files modified:** `orchestrators/plugin/enable-disable.ts`,
`orchestrators/reconcile/apply-outcomes.ts`,
`orchestrators/reconcile/apply.ts`, `orchestrators/reconcile/notify.ts`,
`docs/output-catalog.md`, `tests/architecture/catalog-uat.test.ts`,
`tests/orchestrators/plugin/enable-disable.test.ts`,
`tests/orchestrators/reconcile/notify.test.ts`
**Commit:** `8367bb10`

The finding reproduced exactly as described: CR-01's fix read
`result.installCtx` but took only `resolved.unsupported` off it, so a re-enable
of a plugin with malformed agent/skill frontmatter rendered
`● foo-plugin v1.2.3 (installed)` at `info` while `install` of the same plugin
rendered `(installed) {malformed skill}` at `warning`.

**Shape.** Rather than adding two more loose fields, the three signals are now
one exported `EnableDegradationSignals` interface in `enable-disable.ts`,
intersected into the local `SetEnabledOutcome.fresh` arm and the exported
`EnableDisablePluginOutcome.enabled` arm, and `extends`-inherited by
`PluginEnabledOutcome`. That is the structural half of the fix: a fourth signal
added to that shape cannot be silently dropped on one arm, which is the drift
that produced this finding in the first place. Fields stay FLAT on each outcome
(matching `PluginInstalledOutcome.degradedKinds`); only the `PluginToggleAxes`
`buildSuccess` parameter carries them nested as `degradation?`, spread flat by
the enable axis and explicitly destructured-and-discarded by the disable axis.

**Composition.** Both consumers compose in `install.ts`'s emit order —
`{orphan rewake}`, then per-kind `{malformed skill}` / `{malformed command}`,
then the dropped kinds — so the brace stays byte-comparable across the two verbs
that share the ledger. Verified end-to-end: `{orphan rewake, malformed skill,
malformed command, lsp}`.

**Severity, per the fix guidance.** `degradedKinds.length > 0` raises the row
from `info` to `warning`, identical to `install.ts::successSeverity`. This does
NOT revisit the SEV-03 operator decision: SEV-03 covers the clean partial
shortfall (a degradation that PREDATES the enable — the record was already
degraded when it was disabled), which still stamps `info` on both arms. A
malformed component is a different fact — a degrade this enable's own ledger
just produced — and it was already a warning-class signal on install.

**Catalog + pins.** Two new byte-equality states: `enable-degraded`
(`(installed) {malformed skill}` at `warning`, with the summary line) and
`enable-orphan-rewake` (`(installed) {orphan rewake}` at `info`), each with its
`catalog-uat.test.ts` fixture — the runner passes, including its inverse
orphan-fixture walk. The standalone verb gained an end-to-end pin that seeds a
plugin whose only skill has unparseable frontmatter (`name: [unterminated`) and
asserts the full cascade bytes plus the `warning` severity arg; **verified
failing against the pre-fix source** (`git stash` + re-run). Three projection
pins were added on the reconcile arm (malformed, orphan rewake, all-three
ordering).

**Not addressed here:** `dependencies` stays `[]` on both enable arms — that is
WR-06's carrier (`2026-08-09-enable-row-suppresses-soft-dep-markers.md`,
`resolves_phase: 98`), untouched. Its anchor comment now cites `SEV-01` (see
WR-09).

### WR-08: `refreshDisabledRecord` moved the clone reference without the GC sweep

**Files modified:** `orchestrators/plugin/update.ts`,
`tests/orchestrators/plugin/update.test.ts`
**Commit:** `97b600b7`

Confirmed on the merits: `refreshDisabledRecord` writes both `resolvedSource`
and `resolvedSha` at the clone `preflightUpdate` already materialized, then the
disabled arm returns the `unchanged` outcome — a path that never reaches the
only `garbageCollectPluginClones` call in the file, which sits after
`finalizeUpdateRecord`.

The same gated sweep now runs on the disabled arm itself, in the same shape the
finalize path uses: **outside the state guard** (the refresh's `withStateGuard`
has committed and released before the call — no nested lock acquisition), gated
on `preflight.resolvedSha !== undefined` so path / github-name sources add no
sweep, and swallowed per D-19-01. No network surface added (`clone-gc.ts` is
fs-only by construction and already imported in this file).

**Pin.** The clone-dir seam IS observable in the existing fixtures:
`seedGitPluginMarketplace` warms the old clone at `recordedSha` on disk. The
ENBL-09 / PURL-09 git-source refresh test now asserts
`readdir(locations.pluginClonesDir)` equals exactly `[pluginCloneKey(cloneUrl,
SHA_NEW)]` after the refresh. **Verified failing against the pre-fix source.**
(`readdir` was added to that file's static `node:fs/promises` import; a sibling
test's local dynamic import of the same symbol was left alone.)

### WR-09: ambiguous finding-ID anchors

**Files modified:** `orchestrators/plugin/enable-disable.ts`,
`orchestrators/reconcile/apply.ts`
**Commit:** `72316b7e` — comments only, no behavior change.

`enable-disable.ts` carried six `WR-03` anchors with three distinct meanings,
two `WR-01` anchors with two meanings, plus `WR-09`, `CR-01`, `CR-02` and
`WR-04` tokens that now collide with unrelated findings. Rather than fix only
the two anchors this phase added, every ambiguous anchor in that file was
resolved, so the token stops being worthless there:

| was | now | why |
|-----|-----|-----|
| `WR-03 / FORCE-05` (partial opt-in) | `FORCE-05 / D-69-01` | the precedent it cites |
| `WR-06` (`dependencies: []`) | `SEV-01` | the soft-dep marker requirement |
| `WR-01` (row-union narrowing, ×2) | `D-10` | render-map totality |
| `WR-03` (`{not installed}` taxonomy) | `ATTR-08` | already cited in the prose |
| `WR-09` (orchestrated write-back skip) | `RECON-03` | the mode selector |
| `CR-02` (marketplace re-declaration) | `CMP-3` | the clone-adoption rule |
| `WR-09 / UAT-05` | `UAT-05` | the surviving durable half |
| `CR-01` (locking model, ×3), `WR-01` (save discipline), `WR-03` (cache/hooks lockstep, ×3), `WR-04` (×3) | anchor dropped | no durable ID exists; the prose already carries the rationale, exactly as the comment policy's `Pitfall N` clause prescribes |

In `reconcile/apply.ts` the four already-touched-dedupe anchors became
`RECON-04` — the single-emit rule they implement.

**Residual, deliberately not swept:** `reconcile/apply.ts` still carries legacy
`WR-01` / `WR-02` / `WR-05` / `CR-01` anchors from earlier reviews on unrelated
subjects (read-pass isolation, backfill throw-isolation, write-free read pass,
no-outer-lock). They are not ambiguous within that file, and re-anchoring them
is a repo-wide sweep the finding did not ask for. Noted, not carried — it is
hygiene, not a defect.

## Notes on approach

**Reason composition is duplicated, not extracted.** `freshEnableRow`
(standalone) and `enabledRowFromOutcome` (reconcile projection) each compose the
brace from the shared `malformedReasonsForKinds` / `narrowUnsupportedKinds`
seams rather than calling one shared row builder. That is the established
pattern in this codebase — `install.ts` and `reconcile/notify.ts::
installedRowFromOutcome` already duplicate exactly this composition for the
install arm — and it avoids a new `reconcile/notify.ts` -> `orchestrators/plugin/*`
runtime import edge into a module documented as a pure projection. The shared
TYPE (`EnableDegradationSignals`) is what keeps the two honest; the byte
agreement is pinned by the catalog fixtures plus the standalone end-to-end test.

**IN-05 is slightly narrowed, not fixed.** WR-07 moved the enable-only fields on
`PluginToggleAxes.buildSuccess` from a loose `unsupported?` into a single
`degradation?` carrier, and the disable axis now destructures it off explicitly
instead of relying on the caller never passing it. The type still cannot express
the constraint (object spread bypasses the excess-property check), so IN-05
stands as written.

## Deferred (carriers created in iteration 1 — unchanged)

All three land in Phase 98; none was touched this iteration.

- **WR-02** — no `--partial` affordance when the enable gate's persisted flag is
  stale. Carrier: `2026-08-09-enable-partial-remediation-affordance.md`.
- **WR-04** — `update --partial` completion excludes disabled records. Carrier:
  `2026-08-09-update-partial-completion-excludes-disabled-records.md`.
- **WR-06** — fresh-enable row hard-codes `dependencies: []`. Carrier:
  `2026-08-09-enable-row-suppresses-soft-dep-markers.md`. WR-07 explicitly does
  NOT overlap this: it threads the ledger's degradation signals, not the staged
  agent / mcp name counts the soft-dep markers need.
- **WR-05 residual** — a disabled record keeps a stale `resolvedSource` when the
  version is unchanged but the source moved. Carrier:
  `2026-08-09-disabled-record-stale-resolvedsource-on-unchanged-version.md` (no
  `resolves_phase` — post-milestone backlog).

**No new carrier is needed for anything in this iteration.** All three findings
were fixed in full.

### Info findings (out of scope, not attempted)

- **IN-01** — retired `force-*` vocabulary in `edge-deps.test.ts` titles and
  comments; consider reserving the three spellings in the vocabulary guard.
- **IN-02** — `reconcile/plan.ts` disable-branch comment still describes the
  retired empty-resources marker.
- **IN-03** — the completion fixture seeds disabled records with populated
  `resources.skills`, a shape `DisabledPluginRecord` forbids.
- **IN-04** — the new drift gate over-matches any `.enabled` field and
  under-strips trailing comments; both make its failure message misleading the
  first time it fires.
- **IN-05** — `PluginToggleAxes.buildSuccess` accepts enable-only fields on the
  disable axis (narrowed by WR-07; see above).
- **IN-06** — `docs/output-catalog.md` asserts a state "breaks IL-2" where the
  code documents a sanctioned RECON-04 exception.

IN-01, IN-02 and IN-06 are one-line comment / prose edits that fold cleanly into
the Phase 98 documentation sweep already carried by
`2026-08-08-notify-stale-comments-doc08-reconciliation.md`.

## Commits (cumulative)

| Commit | Subject |
|--------|---------|
| `b94684c8` | `fix(97): CR-01 render a degraded re-enable as partially-installed` |
| `e755bc92` | `fix(97): CR-02 move resolvedSha with the sha-derived version` |
| `9d4431b4` | `fix(97): WR-01 route every disabled-state read through one predicate` |
| `93bd994d` | `docs(97): WR-03 record the automatic partial opt-in for enable` |
| `ad794396` | `test(97): WR-05 pin state.json mtime stability on a no-op refresh` |
| `d601e0fb` | `docs(97): carry three enable-path affordance gaps forward` |
| `96a05a9` | `fix(97): CR-01 stamp the degraded enable row info per SEV-03` |
| `276122a` | `docs(97): carry the stale disabled-record resolvedSource gap forward` |
| `8367bb10` | `fix(97): WR-07 carry every enable degradation signal onto the row` |
| `97b600b7` | `fix(97): WR-08 sweep the orphan clone on the disabled-record refresh` |
| `72316b7e` | `docs(97): WR-09 replace ambiguous finding-ID anchors with durable IDs` |

---

_Fixed: 2026-08-10T00:15:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 2_
