# Phase 28: Severity Routing & Label Discipline - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md -- this log preserves the alternatives considered.

**Date:** 2026-05-31
**Phase:** 28-severity-routing-label-discipline
**Areas discussed:** Benign-skip reason set, Info-softening scope, UXG-03 spike acceptance bar, UXG-03 label discriminator

---

## Area selection

| Option | Description | Selected |
|--------|-------------|----------|
| Benign-skip reason set | Which REASONS flip a skip to info | ✓ |
| Info-softening scope | mp-level / manual-recovery / mixed-cascade routing | ✓ |
| UXG-03 spike acceptance bar | What the spike proves + fallback policy | ✓ |
| UXG-03 label discriminator | How to distinguish cascade vs usage error | ✓ |

**User's choice:** All four areas.

---

## Benign-skip reason set (UXG-02)

| Option | Description | Selected |
|--------|-------------|----------|
| Strict 4 | Benign = exactly {up-to-date, already installed, already autoupdate, already no autoupdate}; everything else warning | |
| 4 + `not installed` | Also treat `not installed` as benign (uninstall no-op) | |
| Define a principle, you classify | Lock the principle, classify all ~28 REASONS against it | ✓ |

**User's choice:** Define a principle, classify.
**Notes:** Principle locked as "benign = idempotent no-op where the resource
already matches the exact requested state." Applied, it converges on exactly the
strict 4 benign reasons; all others reaching a skip row -> warning;
hooks/lsp/requires-*/rollback-partial are moot (non-skip rows).

### Follow-up: `not installed` ruling (the one flagged ambiguous member)

First sub-question -- how should `not installed` route?

| Option | Description | Selected |
|--------|-------------|----------|
| Actionable / warning | Safer default when reason straddles no-op vs mistake | |
| Benign / info | Calmer uninstall no-ops, risks silent typo'd update | |
| Split the reason | Two reasons, one per intent | ✓ (initial) |

**User's initial choice:** Split the reason.

Codebase evidence then surfaced: `not installed` is emitted only at
`update.ts:597-598` and `reinstall.ts:878` (both actionable); the benign
uninstall-of-absent case uses PU-5 silent-converge (`uninstall.ts:7,13`) and
emits no skip row. So a split would create a `REASONS` member with zero
emission sites. Re-asked:

| Option | Description | Selected |
|--------|-------------|----------|
| Single + warning | One reason -> warning; no churn; benign uninstall already silent-converge | ✓ |
| Split anyway (forward-proof) | Add unused closed-set member for a future benign surface | |

**User's final choice:** Single + warning.
**Notes:** Evidence-driven reversal of the initial split decision once the
emission sites were confirmed.

---

## Info-softening scope (UXG-02)

Two-question turn presenting the proposed 5-arm first-match ladder rewrite.

**Q1 -- mp-level softening + empty-reasons default:**

| Option | Description | Selected |
|--------|-------------|----------|
| Symmetric, empty->warning | mp-level skipped softens when all reasons benign; missing/empty -> warning | ✓ |
| Plugin-level only | Soften only plugin-level; leave mp-level warning | |

**Q2 -- actionable side of the ladder:**

| Option | Description | Selected |
|--------|-------------|----------|
| Confirm: manual-recovery + any non-benign skip = warning | First-match poisoning; failures still error | ✓ |
| Adjust | Change manual-recovery / mixed-cascade routing | |

**User's choice:** Symmetric softening (empty->warning) + confirmed actionable side.
**Notes:** Closes the Plan 27-04 deferral; mp-level skipped covers UXG-04
idempotent autoupdate + UXG-05 `(skipped) {up-to-date}`.

---

## UXG-03 spike acceptance bar

Two-question turn. Grounding evidence presented: host API is
`notify(message, type?)` with no options param; label + color both derive from
`type`; the only in-extension lever (force info) drops color AND nullifies
UXG-02.

**Q1 -- acceptance bar / fallback policy:**

| Option | Description | Selected |
|--------|-------------|----------|
| Color non-negotiable -> upstream finding | No colorless workaround; record finding if host can't separate | ✓ |
| Label-removal first, accept colorless interim | Force cascades to info; loses color + nullifies UXG-02 | |
| Spike decides, no bar set | Defer the criteria to spike findings | |

**Q2 -- deliverable if upstream finding:**

| Option | Description | Selected |
|--------|-------------|----------|
| In-repo finding, SNM-39 pattern | Written finding + line refs + evidence + STATE.md deferral; operator files upstream | ✓ |
| In-repo finding + draft upstream issue | Also draft a ready-to-file issue body | |

**User's choice:** Color non-negotiable -> upstream finding; SNM-39-pattern deliverable.

---

## UXG-03 label discriminator (contingent)

| Option | Description | Selected |
|--------|-------------|----------|
| By entrypoint | `notify()` suppresses label, `notifyUsageError()` keeps it | ✓ |
| By literal line count | Suppress on any newline -- wrongly strips usage-error label (`\n\n`) | |
| Defer entirely to spike | Decide discriminator after spike | |

**User's choice:** By entrypoint.
**Notes:** Recorded as conditional intent -- mechanism depends on the spike
outcome; if the host can't suppress the label at all (likely), this policy is moot.

---

## Claude's Discretion

- Exact shape of `BENIGN_REASONS` const + the all-benign predicate.
- Test naming/placement within the existing notify-v2 / catalog-uat structure.
- Spike harness design (reuse vs extend the SNM-37 rig).

## Deferred Ideas

None -- discussion stayed within phase scope.
