# Phase 28: Severity Routing & Label Discipline - Context

**Gathered:** 2026-05-31
**Status:** Ready for planning

<domain>
## Phase Boundary

This phase makes the v2 `NotificationMessage` surface present *severity* the way
operators expect, in two independent halves that both converge on
`extensions/pi-claude-marketplace/shared/notify.ts`:

- **UXG-02 (severity routing):** refine the first-match severity ladder
  (`computeSeverity`) so a cascade whose only non-success rows are *benign*
  no-op skips computes `info` (no severity arg) instead of `warning`. Actionable
  skips and manual-recovery still compute `warning`; failures still compute
  `error`. This is a pure severity-arg change -- the rendered byte string is
  unchanged.
- **UXG-03 (label discipline):** a feasibility spike on whether the Pi host can
  render the severity *color* on multi-line cascades *without* the
  `Error:`/`Warning:` label prefix (which breaks the 0/2 indent ladder and
  duplicates the inline per-row status). If the host cannot, UXG-03 resolves as
  an upstream-tracked finding rather than a forced in-extension change.

**Not in scope:** changing the reload-hint ladder (independent of severity per
SNM-33), changing any rendered byte form / catalog string, changing
uninstall's PU-5 silent-converge behavior, or any new notification capability.

</domain>

<decisions>
## Implementation Decisions

### UXG-02 -- Benign-skip reason set

- **D-28-01:** Lock the classification *principle*: **benign = an idempotent
  no-op where the resource already matches the exact state the command
  requested.** Downstream agents classify any current or future `REASONS`
  member against this principle rather than against a hard-coded list.
- **D-28-02:** `BENIGN_REASONS` (the closed set that routes a skip to `info`) =
  `{ "up-to-date", "already installed", "already autoupdate", "already no autoupdate" }`.
  These are the four idempotent "already in requested state" reasons. The
  requirement text's stale `{already enabled}` / `{already disabled}` map to the
  Phase-27/UXG-04-renamed `already autoupdate` / `already no autoupdate`.
- **D-28-03:** `not installed` routes to **`warning`** as a single reason -- no
  split, no closed-set widening. Evidence: `not installed` is emitted only at
  `orchestrators/plugin/update.ts:597-598` and
  `orchestrators/plugin/reinstall.ts:878`, both the actionable
  "can't update/reinstall a plugin that isn't there" case. The benign
  uninstall-of-absent case the split was meant to protect does **not** emit this
  reason -- uninstall uses PU-5 silent-converge (`uninstall.ts:7,13`:
  `alreadyGone=true`, returns with no notification). A split would add a
  `REASONS` member with zero emission sites plus catalog/fixture churn for a
  case already handled.
- **D-28-04:** All other reasons that can reach a skip row route to `warning`:
  `not found`, `not in manifest`, `invalid manifest`, `unreadable manifest`,
  `no longer installable`, `unsupported source`, `source mismatch`,
  `plugins remain`, `concurrently uninstalled`, `concurrently updated`,
  `stale clone`, `duplicate name`, `lock held`, `unreadable`, `unparseable`,
  `source missing`, `network unreachable`, `permission denied`.
- **D-28-05:** `hooks`, `lsp`, `requires pi-subagents`, `requires pi-mcp`, and
  `rollback partial` are **moot** for the ladder -- they annotate `installed` /
  `failed` rows (soft-degrade / rollback sub-state), never `skipped` rows, so
  they are handled by the success / error arms regardless.

### UXG-02 -- Info-softening scope (the rewritten ladder)

- **D-28-06:** Rewrite `computeSeverity` as a 5-arm first-match ladder:
  1. any `plugin.status==="failed"` OR `mp.status==="failed"` -> `"error"`
  2. any `plugin.status==="manual recovery"` -> `"warning"` (always actionable)
  3. any `plugin.status==="skipped"` whose `reasons` are NOT all in
     `BENIGN_REASONS` -> `"warning"`
  4. any `mp.status==="skipped"` whose `reasons` are NOT all in
     `BENIGN_REASONS` (including missing/empty `reasons?`) -> `"warning"`
  5. otherwise -> `undefined` (info, omit the 2nd arg)
- **D-28-07:** mp-level `skipped` softens **symmetrically** with plugin-level.
  Today this covers the UXG-04 idempotent autoupdate flip
  (`<autoupdate> {already autoupdate}` / `<no autoupdate> {already no autoupdate}`)
  and the UXG-05 update no-op (`(skipped) {up-to-date}`) -- all benign -> `info`.
  This closes the Plan 27-04 deferral ("UXG-02 info-softening is Phase 28").
- **D-28-08:** mp-level `skipped` carries **optional** `reasons?`; plugin-level
  `skipped` carries **required** `reasons`. When an mp `skipped` has
  missing/empty reasons it cannot be proven benign -> `warning` (safe default).
- **D-28-09:** First-match poisoning is intentional: a *mixed* cascade (one
  benign skip + one actionable skip, or any manual-recovery row) routes the
  whole notification to `warning`. Matches the requirement's "*only* non-success
  rows are benign skips -> info".

### UXG-03 -- Spike acceptance bar

- **D-28-10:** **Color is non-negotiable.** The spike's job is to confirm
  whether the Pi host can render the severity color on a multi-line cascade
  *without* the `Error:`/`Warning:` label. If it cannot, UXG-03 resolves as an
  upstream-tracked finding -- do **not** ship a colorless in-extension
  workaround.
- **D-28-11:** The only in-extension lever is the severity arg itself, and it is
  self-defeating: the public host API is `notify(message, type?)` with
  `type?: "info" | "warning" | "error"` and **no options/structured/color-only
  parameter** (verified at
  `node_modules/@earendil-works/pi-coding-agent/dist/core/extensions/types.d.ts:75`).
  Label and color are both derived from `type` in the host bundle (literal
  `Warning: ` / `Error: ` forms in `dist/main.js`). Forcing cascades to `info`
  to drop the label also drops the color **and** nullifies UXG-02's
  warning/error routing -- so it is rejected.
- **D-28-12:** If UXG-03 resolves as an upstream finding, the deliverable
  mirrors the SNM-39 / G-MIL-07 precedent: a written in-repo finding with exact
  host line refs + spike evidence, a UAT/REQUIREMENTS note, and a STATE.md
  deferral row. Filing the actual upstream issue against
  `@earendil-works/pi-coding-agent` is the **operator's call** (not auto-filed,
  not auto-drafted).

### UXG-03 -- Label discriminator (contingent)

- **D-28-13:** *If* a label-suppression capability ever exists (a future host
  API param or a landed upstream change), the policy is **entrypoint-based**:
  `notify()` (the structured cascade surface, which always renders a marketplace
  header + rows) suppresses the label; `notifyUsageError()` always keeps it.
  Not line-count -- `notifyUsageError` emits `message\n\n usage`
  (`notify.ts:169`), so a literal newline test would wrongly strip the label the
  requirement says to keep. This decision is recorded for intent; the mechanism
  depends entirely on the spike outcome (D-28-10/11).

### Claude's Discretion

- Exact shape of the `BENIGN_REASONS` const (tuple vs `Set`), the `all-benign`
  helper predicate, and how it is shared between the plugin-skip and mp-skip
  arms.
- Test naming/placement for the new severity coverage, within the existing
  `tests/shared/notify-v2.test.ts` + `tests/architecture/catalog-uat.test.ts`
  structure.
- Spike harness design (reuse vs extend the SNM-37 `scripts/pi.sh` +
  `snm37-behavioral-smoke.test.ts` rig).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & source findings
- `.planning/REQUIREMENTS.md` -- UXG-02 (line 20) and UXG-03 (line 21)
  definitions; the v1.5 milestone goal (lines 6-8).
- `.planning/BACKLOG.md` §`## v1.4 UAT findings` -- findings 2 (benign skips)
  and 3 (label suppression) are the source UX change-requests.
- `.planning/v1.4-MILESTONE-UAT.md` -- the 2026-05-30 hands-on UAT sweep that
  surfaced both findings.

### Implementation surface (UXG-02)
- `extensions/pi-claude-marketplace/shared/notify.ts` -- `computeSeverity`
  (line 1079, the ladder to rewrite), `REASONS` closed set (lines 63-92),
  `notify` entry (line 1268), `notifyUsageError` (line 168). Single sanctioned
  `ctx.ui.notify` call site.
- `extensions/pi-claude-marketplace/orchestrators/plugin/update.ts` -- emits
  `not installed` (lines 597-598); actionable context.
- `extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts` -- emits
  `not installed` (line 878); actionable context.
- `extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts` -- PU-5
  silent-converge (lines 7, 13): benign uninstall-of-absent emits no skip row.

### Test gates (move in lockstep)
- `tests/architecture/catalog-uat.test.ts` -- byte-equality gate; carries an
  `expectedSeverity?: "warning" | "error"` per fixture (lines 19-21, 184,
  201-204). Benign-skip fixtures lose their `expectedSeverity` (warning -> info).
  Rendered strings are unchanged.
- `tests/shared/notify-v2.test.ts` -- deep-equals the full `[string, severity]`
  arguments array of `ctx.ui.notify`; benign-skip per-variant tests drop the
  2nd arg, plus new coverage for the still-`warning` actionable / mixed /
  manual-recovery cases.

### Spec / contract docs to sync
- `docs/output-catalog.md` -- byte forms unchanged (severity is not in the
  string); review only for any per-state severity prose that should match the
  new ladder.
- `docs/messaging-style-guide.md` -- binding contract; sync any severity-ladder
  prose.
- `docs/adr/v2-001-structured-notify.md` -- D-16-11 ("any skipped -> warning")
  is documented here and MUST be amended to reflect the benign-softening
  refinement.

### UXG-03 spike
- `node_modules/@earendil-works/pi-coding-agent/dist/core/extensions/types.d.ts:75`
  -- the host `notify(message, type?)` signature (no options param).
- `scripts/pi.sh` + `tests/shared/snm37-behavioral-smoke.test.ts` -- the SNM-37
  source-load rig + pre-tui `ctx.ui.notify` boundary capture; natural spike
  harness.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `computeSeverity` (`notify.ts:1079`) is the single chokepoint -- the entire
  UXG-02 change lives in this function plus a new `BENIGN_REASONS` const near
  the existing `REASONS` declaration (lines 63-92).
- The SNM-37 spike rig (`scripts/pi.sh` sandbox source-load +
  `snm37-behavioral-smoke.test.ts` pre-tui boundary capture) can be reused to
  exercise the host notify path for the UXG-03 feasibility spike.

### Established Patterns
- Severity is the *second arg* to `ctx.ui.notify`, never part of the rendered
  string -- so UXG-02 changes assertions, not byte forms. The catalog-uat byte
  gate stays GREEN on strings; only `expectedSeverity` metadata moves.
- Reload-hint and severity are independent ladders (`shouldEmitReloadHint` vs
  `computeSeverity`); SNM-33's plugin-row-only reload trigger is untouched.
- Upstream-finding precedent: SNM-39 / G-MIL-07 recorded a host-side limitation
  in-repo (exact line refs + UAT entry + STATE.md deferral row) without
  contorting extension code. UXG-03 follows the same shape if the spike refutes
  feasibility.

### Integration Points
- `notify()` is the cascade entrypoint (multi-line, always mp-header + rows);
  `notifyUsageError()` is the usage-error entrypoint (`message\n\n usage`,
  always `error`). The UXG-03 label-discriminator policy (D-28-13) splits on
  exactly this boundary.

</code_context>

<specifics>
## Specific Ideas

- The requirement text for UXG-02 predates Phase 27's UXG-04 rename: its
  `{already enabled}` / `{already disabled}` benign examples are now
  `already autoupdate` / `already no autoupdate` in the `REASONS` set. Use the
  renamed reasons (D-28-02).
- Plan 27-04's SUMMARY explicitly left mp-level `(skipped) {up-to-date}` at
  `warning` and noted "UXG-02 info-softening is Phase 28, NOT pre-empted" --
  D-28-07 closes that hand-off.
- The two namespaces matter for UXG-03: the extension API contract is
  `@mariozechner/pi-coding-agent` (peer dep per CLAUDE.md) but the installed
  runtime host that renders label+color is `@earendil-works/pi-coding-agent`
  (+ `@earendil-works/pi-tui`). The spike inspects the `@earendil-works` host.

</specifics>

<deferred>
## Deferred Ideas

None -- discussion stayed within phase scope.

</deferred>

---

*Phase: 28-severity-routing-label-discipline*
*Context gathered: 2026-05-31*
