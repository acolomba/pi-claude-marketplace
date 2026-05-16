# Phase 11: Import Command Orchestration - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md - this log preserves the alternatives considered.

**Date:** 2026-05-14
**Phase:** 11-import-command-orchestration
**Areas discussed:** Import failure semantics, User-facing import output, Idempotency and skip behavior, End-to-end validation shape

---

## Import failure semantics

| Option | Description | Selected |
| ------ | ----------- | -------- |
| Continue whenever safe | If a marketplace cannot be added, skip only plugins that depend on that marketplace; continue other marketplaces/plugins and aggregate warnings/errors at the end. | ✓ |
| Fail fast on marketplace-add failure | Stop the whole import if any marketplace add fails, because later plugin installs may depend on it. | |
| Fail fast only on infrastructure/state-lock errors | Continue for unavailable/uninstallable plugins and unmappable marketplaces, but stop on state-lock, containment, malformed state, rollback, or unexpected internal errors. | |
| You decide | Planner chooses exact policy from existing orchestrator semantics. | |

**User's choice:** Continue whenever safe.
**Notes:** Marketplace-add failure should skip only plugins depending on that marketplace. Unrelated marketplaces/plugins should continue. Warnings/errors should be aggregated.

| Option | Description | Selected |
| ------ | ----------- | -------- |
| Yes, classify outcomes | Expected unavailable/uninstallable/already-installed cases become warning/skip diagnostics; unexpected failures include causes and stop only the affected plugin unless continuing would be unsafe. | ✓ |
| No, treat all install errors uniformly | Every install failure becomes a warning and import continues. | |
| Strict mode for unexpected errors | Unavailable/uninstallable continues, but unexpected install errors stop the entire import. | |
| You decide | Planner chooses exact policy. | |

**User's choice:** Yes, classify outcomes.
**Notes:** Expected unavailable/uninstallable/already-installed cases become warning/skip diagnostics. Unexpected failures should preserve causes and stop only the affected plugin unless continuing would be unsafe.

---

## User-facing import output

| Option | Description | Selected |
| ------ | ----------- | -------- |
| Summary-first with underlying action messages preserved | Reuse `addMarketplace` / `installPlugin` notifications, but add a final import summary listing installed/skipped/warned items by scope. | ✓ |
| Only underlying action messages | Rely on existing marketplace/plugin notifications; no import-level summary. | |
| Import summary only | Suppress or avoid per-action success messages where possible. | |
| You decide | Planner chooses exact policy. | |

**User's choice:** Summary-first/final-summary import output with underlying action messages preserved.
**Notes:** Import should add a final summary listing installed/skipped/warned items by scope.

| Option | Description | Selected |
| ------ | ----------- | -------- |
| Preserve existing per-install reload hints | Simplest reuse of `installPlugin`; tests assert reload hints appear after actual resource changes, not on pure skips. | |
| Aggregate reload hint once at import end | Better UX, but may require changing `installPlugin` or adding a notification-control seam. | ✓ |
| No additional import-level reload hint | Rely entirely on underlying install behavior. | |
| You decide | Planner chooses exact policy. | |

**User's choice:** Aggregate reload hint once at import end.
**Notes:** User added that the implementation may need to extract the place where the notification happens so internal plugin installs can reuse the internal API without messaging the user about reloading immediately.

| Option | Description | Selected |
| ------ | ----------- | -------- |
| Actionable detail per skipped item | Include `plugin@marketplace`, target scope, and reason; preserve cause text for unexpected failures. | ✓ |
| Compact counts only | Show counts by category, with details only from earlier underlying messages. | |
| Hybrid | Counts in the success summary, detailed warning notification for skipped/failed items. | |
| You decide | Planner chooses exact policy. | |

**User's choice:** Actionable detail per skipped item.
**Notes:** Final warnings should include `plugin@marketplace`, target scope, reason, and cause text for unexpected failures.

---

## Idempotency and skip behavior

| Option | Description | Selected |
| ------ | ----------- | -------- |
| Explicit in final summary only | Do not emit noisy per-skip messages; include skipped-existing counts/details by scope in the import summary. | |
| Silent skips | Skip existing marketplaces/plugins without mentioning them unless everything was already present. | ✓ |
| Per-skip notifications | Notify each already-added/already-installed item as it is skipped. | |
| You decide | Planner chooses exact policy. | |

**User's choice:** Silent skips.
**Notes:** Already-added marketplaces and already-installed plugins should be silent skips, except when everything was already present or no changes were made; then the summary should make clear import was already up to date.

| Option | Description | Selected |
| ------ | ----------- | -------- |
| Yes, trust existing Pi marketplace by name | If marketplace name exists in the target Pi scope, skip marketplace add and install from existing manifest/state. | |
| Warn on source mismatch, then install | Detect mismatch if possible; warn that Pi already has that marketplace name from a different source. | |
| Fail on source mismatch | Avoid installing from a potentially different marketplace. | ✓ |
| You decide | Planner chooses exact policy. | |

**User's choice:** Fail on source mismatch.
**Notes:** If a marketplace already exists but its source differs from the Claude settings source, import should fail/skip that marketplace-dependent import rather than installing from a potentially different marketplace.

---

## End-to-end validation shape

| Option | Description | Selected |
| ------ | ----------- | -------- |
| Single rich fixture | One end-to-end scenario covers official GitHub marketplace, extra-known directory marketplace, extra-known GitHub marketplace, local override disabling base plugin, already-installed skip, unavailable warning, both scopes, and final summary. | ✓ |
| Several focused fixtures | Smaller tests for each behavior, easier to debug but less proof that the full command works as a user runs it. | |
| Hybrid | One rich fixture plus focused unit tests for edge cases like source mismatch and reload-hint aggregation. | |
| You decide | Planner chooses exact policy. | |

**User's choice:** Single rich fixture.
**Notes:** Phase 11 should prioritize a rich end-to-end fixture proving the full command works as a user runs it.

| Option | Description | Selected |
| ------ | ----------- | -------- |
| Yes, include source mismatch in the rich fixture | Maximizes coverage in one scenario. | ✓ |
| No, keep source mismatch as a focused test | Keeps the rich fixture aligned with roadmap success criteria and avoids making it too hard to diagnose. | |
| You decide | Planner chooses exact policy. | |

**User's choice:** Include source mismatch in the rich fixture.
**Notes:** The end-to-end import scenario should also prove mismatched existing marketplace sources are skipped/failed safely.

---

## the agent's Discretion

- Exact import result type names and summary formatting.
- Exact diagnostic classification code names.
- Exact implementation approach for deterministic source mismatch detection.

## Deferred Ideas

None.
