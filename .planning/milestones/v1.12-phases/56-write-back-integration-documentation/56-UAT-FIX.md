---
phase: 56
fixed_at: 2026-06-12T00:25:00Z
review_path: (n/a -- v1.12 milestone runtime UAT operator decisions 2026-06-11)
iteration: 1
findings_in_scope: 2
fixed: 2
skipped: 0
status: all_fixed
---

# Phase 56: UAT Fix Report (UAT-03 + UAT-04)

**Fixed at:** 2026-06-12T00:25:00Z
**Source:** v1.12 milestone runtime UAT, operator decisions 2026-06-11
**Iteration:** 1

**Summary:**

- Findings in scope: 2
- Fixed: 2
- Skipped: 0

Both amendments landed in ONE atomic lockstep commit (`e7c04e9`) per the
v1.3 atomic-supersession discipline: renderer/type changes,
`docs/output-catalog.md`, `docs/messaging-style-guide.md`, catalog-uat
fixtures, and every pinned test moved together. `npm run check` GREEN:
1806 unit (baseline 1804 + 2 new UAT-03 notify-v2 tests) + 10
integration.

## Fixed Issues

### UAT-03: fresh-disable cascade row renders `(disabled)`, not `(uninstalled)`

**Files modified:**
`extensions/pi-claude-marketplace/shared/notify.ts`,
`extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts`,
`docs/output-catalog.md`, `docs/messaging-style-guide.md`,
`tests/architecture/catalog-uat.test.ts`,
`tests/architecture/notify-types.test.ts`,
`tests/orchestrators/plugin/enable-disable.test.ts`,
`tests/shared/notify-v2.test.ts`
**Commit:** e7c04e9

**Applied fix:**

- `composeOutcomeRow`'s fresh-disable arm now emits the existing
  `PluginDisabledMessage` cascade variant (`status: "disabled"`, version
  slot kept) instead of `PluginUninstalledMessage`. The byte form is
  identical to the disabled-inventory row (option 1a):
  `⊘ foo-plugin v1.2.3 (disabled)` under a bare marketplace header, with
  the `/reload to pick up changes` trailer.
- **Reload-hint wiring (kind/context, NOT a blanket token add):** the
  list and info inventory surfaces emit structurally identical
  `disabled` rows through the SAME kind-less cascade arm (verified:
  `list.ts` plugin enumeration and `info.ts::buildDisabledInventoryBlock`
  -- the latter can be byte-for-byte indistinguishable from the disable
  cascade when autoupdate is off), so blanket-adding `disabled` to
  `shouldEmitReloadHint`'s trigger set would have leaked the trailer onto
  inventory output and broken the catalog's `disabled-inventory`
  byte-equality. Instead, `CascadeNotificationMessage.kind` gained the
  `"disable-cascade"` literal; `dispatchOutcome` sets it for the disable
  verb, and `shouldEmitReloadHint` promotes `disabled` rows to
  transition status ONLY under that kind. This resolves the G-21-01
  inventory-vs-transition straddle structurally at the KIND level,
  mirroring `reconcile-applied-cascade`'s structural exclusion.
- Closed sets NOT grown: `PLUGIN_STATUSES` stays at 16 (length-lock
  intact); discriminated-union exhaustiveness (`assertNever`) preserved
  (the `notify()` dispatcher switch gained the `"disable-cascade"`
  case arm).
- Idempotent-disable arm (`(skipped) {already disabled}`) unchanged;
  pinned by a new notify-v2 test proving the kind alone is not a
  blanket trigger.
- Docs: disable H2 intro rewritten to the new contract (supersedes the
  `(uninstalled)`-token choice and the "(disabled) is inventory-only"
  claim), `disable-fresh` fenced block + prose updated,
  disabled-inventory prose cross-references the disable cascade; style
  guide's union comment, PLUGIN_STATUSES prose, and reload-hint trailer
  bullet amended in lockstep.

### UAT-04: fresh-enable cascade header drops `(added)`

**Files modified:** (same atomic commit as UAT-03)
`extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts`,
`docs/output-catalog.md`, `tests/architecture/catalog-uat.test.ts`,
`tests/orchestrators/plugin/enable-disable.test.ts`
**Commit:** e7c04e9

**Applied fix:**

- `composeOutcomeRow`'s fresh-enable arm no longer sets
  `mpStatus: "added"` (the leak from reusing the install-cascade header
  shape); the header now renders the bare always-marketplace-header
  form (`mp.status === undefined`, SUB-BRANCH A), matching install's
  SUB-BRANCH A and disable-fresh. Row keeps `(installed)` per operator
  decision 2b, so the reload-hint trigger is unchanged.
- The now-dead `mpStatus?: "added"` wrapper was removed:
  `composeOutcomeRow` returns `PluginNotificationMessage` directly.
- Docs: enable H2 intro + `enable-fresh` fenced block + prose updated;
  catalog-uat `enable-fresh` fixture drops `status: "added"`; CR-01
  orchestrator byte assertion updated.

## Verification

- `npx tsc --noEmit` clean (one notify-types union-arity proof updated
  for the widened kind union).
- `npm run check` exit 0: typecheck + ESLint + Prettier + 1806 unit +
  10 integration tests (catalog byte-equality + inverse-walk GREEN;
  grammar-invariant `(disabled)`-inventory no-trailer locks GREEN).
- `pre-commit run --files <changed>` clean except the documented
  trufflehog worktree-sandbox failure; committed with
  `SKIP=trufflehog`; separate `pre-commit run trufflehog --all-files`
  scan run from the main repo after fast-forward (clean).

______________________________________________________________________

_Fixed: 2026-06-12T00:25:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
