# Phase 29: Notification Label Suppression & Update Classification - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md -- this log preserves the alternatives considered.

**Date:** 2026-05-31
**Phase:** 29-notification-label-suppression-update-classification
**Areas discussed:** computeSeverity fate, UXG-09 scope boundary

---

## computeSeverity fate

| Option | Description | Selected |
|--------|-------------|----------|
| Retire completely | Delete computeSeverity, BENIGN_REASONS, allBenign, expectedSeverity in catalog fixtures | |
| Keep dormant | Preserve with comment pointing to D-28-13 future host API potential | |
| Keep active + add summary line | Retain severity routing; add human-readable summary before cascade body for error/warning | ✓ |

**User's choice:** "this may have been a mistake. i want to report errors and warnings as we've been doing. i just want the formatting to be a bit different"

**Clarification follow-up on what "formatting" means:**

| Option | Description | Selected |
|--------|-------------|----------|
| Remove Error:/Warning: prefix, accept no color | Route cascades to info (UXG-07 as written in REQUIREMENTS.md) | |
| Keep Error:/Warning: prefix and color as-is | Revert UXG-07 | |
| Keep prefix+color, add summary line | "how about 1 plugin operation failed -- focus on operation rather than plugin" | ✓ |

**Notes:** The user clarified they want the `Error:`/`Warning:` label preserved (and the color), but want the prefix to be meaningful by adding a summary line. The REQUIREMENTS.md UXG-07 spec (suppress label by routing to `info`) is overridden by this decision. The summary focuses on the "operation" (command) rather than the plugin's state, since the cascade body already shows per-plugin conditions.

**Summary wording confirmed:**

| Option | Description | Selected |
|--------|-------------|----------|
| N plugin operation(s) failed / skipped | Symmetric pattern with plugin+marketplace counts | ✓ |
| N operation(s) failed / skipped | Shorter, drop "plugin"/"marketplace" | |

**Count scope confirmed:**

| Option | Description | Selected |
|--------|-------------|----------|
| Plugins only | Count plugin-row failures/skips only | |
| Plugins + marketplaces | Count both layers | ✓ |

---

## UXG-09 scope boundary

| Option | Description | Selected |
|--------|-------------|----------|
| Out of scope for Phase 29 | Keep install <already-installed> as (failed); summary framing covers it | ✓ |
| Reclassify to (skipped) {already installed} | Change partition in install.ts | |
| Soften summary for already-installed only | Split summary by reason | |

**User's choice:** "how about 1 plugin operation failed -- focus on operation (the command) rather than what happened to each plugin, which is going to display its condition anyway"

**Notes:** User's suggestion of "plugin operation failed" framing implicitly resolved UXG-09 as out of scope. The summary says the *operation* failed (accurate for install-of-already-installed since the command couldn't complete), and the per-row `{already installed}` reason explains why. No reclassification needed.

---

## Claude's Discretion

- Exact sentence structure for mixed plugin+marketplace summary counts
- Whether to extract `buildSummaryLine()` helper or inline counting in `notify()`
- Pluralization logic ("1 plugin operation" vs "2 plugin operations")
- Restructure approach in `preflightUpdate` for UXG-08 fix
- Test naming for new summary-line assertions in `notify-v2.test.ts`
- Catalog commentary wording for summary line behavior

## Deferred Ideas

- **UXG-09** -- reclassify `install <already-installed>` from `failed` to `skipped`. Deferred; "plugin operation failed" summary framing makes Phase 29 acceptable without it. Future phase candidate.
