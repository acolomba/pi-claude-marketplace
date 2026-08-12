# Phase 99: Post-audit tech-debt closure - Context

**Gathered:** 2026-08-10
**Status:** Ready for planning

<domain>
## Phase Boundary

Close every debt item the v1.18 milestone audit enumerated, before the milestone
completes. Four groups, all selected by the operator at the audit review
(2026-08-10): the integration fragility trio, the WR-12 update-verb
degradation-signal gap, the doc-only deferrals from 98-06, and the two legacy
carriers. No other scope; the milestone's no-expansion contract (COMPAT-01
gate) stays green — any closed-set amendment is deliberate, test-pinned, and
catalog-synchronized in the same commit.

</domain>

<decisions>
## Implementation Decisions

### Operator decisions (audit review, 2026-08-10)
- **D-99-01:** [informational] All four debt groups land in this phase; none re-deferred.
  Runtime UAT before archive was explicitly waived (coverage judged
  sufficient).
- **D-99-02 (fragility trio):** (a) export the `ManifestLookup` discriminant
  from its authoring module and make info's and update's absence judgments
  consume the value/derivation rather than re-implementing the
  successful-read + exact-identity rule; (b) widen the ENBL-05 drift-gate
  regexes to catch destructured `{ enabled }`, bracket access, and
  `Boolean(...)` comparison twins (verify each new pattern flags a planted
  twin and does not flag the legitimate consumers); (c) rename reinstall's
  `stagedAgents`/`stagedMcpServers` string-array fields apart from the shared
  `LedgerDegradationSignals` boolean names.
- **D-99-03 (WR-12):** thread degradation signals through the update verb per
  the carrier's seven work items (`.planning/todos/pending/`
  `2026-08-10-update-verb-drops-degradation-signals.md`) — optional `reasons`
  on the updated transition variant, WARN-01 raise, BOTH the central renderer
  arm AND `update.messaging.ts` (the WR-09 lesson), catalog state +
  style-guide amendment. Note the carrier's dropped-vs-malformed axis table:
  `partialDegrade` covers dropped kinds; malformed kinds are the gap.
- **D-99-04 (doc deferrals):** catalog state + FIXTURES entry for the
  version-less autoupdate cascade skip row; correct the description-bearing
  variant count (9, not 7); re-anchor or drop residual `RLD-04`/`D-08` at the
  six sites in `list.ts` (4) and `list.messaging.ts` — NOT the four files
  where `D-08` legitimately carries its other meaning.
- **D-99-05 (legacy carriers):** (a) stale-resolvedSource fix per the
  carrier's option 1 (`2026-08-09-disabled-record-stale-resolvedsource-on-`
  `unchanged-version.md` — the deep-equal guard drafted and reverted in the
  97 fix loop becomes load-bearing so an unchanged version with a moved
  source still refreshes); (b) the 2026-06-12 coverage sweep bounded to the
  todo's named rare-failure arms in update/reinstall/install — no open-ended
  expansion.

### Claude's Discretion
Module placement for the exported absence discriminant (respect layer
boundaries — list.ts currently authors it; a shared home must not create
cycles), plan/wave structure, exact regex forms for the drift gate, the
renamed reinstall field names, and fixture design for the coverage sweep.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### The debt inventory (the spec for this phase)
- `.planning/v1.18-MILESTONE-AUDIT.md` — tech_debt frontmatter + integration
  warnings with file:line evidence.
- `.planning/todos/pending/2026-08-10-update-verb-drops-degradation-signals.md`
  — WR-12 mechanism, repro, seven work items, dropped-vs-malformed table.
- `.planning/todos/pending/2026-08-09-disabled-record-stale-resolvedsource-on-unchanged-version.md`
  — mechanism + option 1.
- `.planning/todos/pending/2026-06-12-coverage-sweep-test-rare-failure-arms-in-update-reinstall-in.md`
  — the bounded sweep list.
- `.planning/phases/98-lifecycle-regression-and-contract-documentation/98-06-SUMMARY.md`
  — the three doc deferrals with why-deferred detail (incl. the D-08
  live-meaning caveat).

### Contracts this phase must keep green
- `tests/architecture/compat-01-no-expansion.test.ts` — closed-set
  enumeration pins (amend deliberately if a reason is minted for WR-12).
- `tests/architecture/catalog-uat.test.ts` + `docs/output-catalog.md` —
  byte-equality; amendments ship with FIXTURES entries in the same commit.
- `tests/orchestrators/reconcile/plan.test.ts` (drift gate) — the gate being
  widened; its import-presence half must keep passing.
- `orchestrators/plugin/shared.ts` `LedgerDegradationSignals` +
  `reinstalledRowFromOutcome` — the WR-09 composer pattern WR-12 mirrors.

</canonical_refs>

<code_context>
## Existing Code Insights

- Absence judgment sites: `list.ts:343/885` (ManifestLookup + manifestLookupFor),
  `info.ts:842`, `update.ts:1025` (throws on unreadable manifest).
- Drift gate: `tests/orchestrators/reconcile/plan.test.ts:882`,
  `extensionSourceFiles()` whole-tree walk, comment-stripping first.
- Reinstall collision: `reinstall.ts:1759-1760` (string arrays) vs
  `shared.ts:53` booleans.
- WR-12 seams: `update.ts:1170/1181` staging, `update.messaging.ts` render
  map, `partialDegrade` on `PluginUpdateUpdatedOutcome`.
- resolvedSource: `preflightUpdate`'s `toVersion === fromVersion`
  short-circuit precedes the disabled branch.
- Test env: PI_SUBAGENTS_ROOT=/home/acolomba/.pi/agent/npm/node_modules/pi-subagents
  for full runs; direct exit-code capture; user-scope + hermetic home for
  update fixtures (process.cwd() hazard); worktree trufflehog commit protocol.

</code_context>

<specifics>
## Specific Ideas

- The integration checker's verdict: exporting ManifestLookup "converts the
  largest remaining WARNING into a type-enforced connection" — that is the
  bar for D-99-02a: a fourth surface must not be able to re-derive the rule.

</specifics>

<deferred>
## Deferred Ideas

None — the operator explicitly pulled every open item into scope.

</deferred>

---

*Phase: 99-post-audit-tech-debt-closure*
*Context gathered: 2026-08-10*
