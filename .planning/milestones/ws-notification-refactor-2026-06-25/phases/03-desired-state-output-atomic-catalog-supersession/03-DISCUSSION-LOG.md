# Phase 3: Desired-state output & atomic catalog supersession - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md.

**Date:** 2026-06-24
**Phase:** 3-desired-state-output-atomic-catalog-supersession
**Areas discussed:** Severity divergence scope, Mixed-subject detection, Tally trigger, Absent-target policy, Idempotent policy

---

## Severity divergence scope

| Option | Description | Selected |
|--------|-------------|----------|
| Install-only divergence | only install-already -> error; rest keep today's severity | |
| Full desired-state revisit | reclassify absent-target + idempotent cases under the tri-state contract | ✓ |
| You decide | planner discretion | |

**User's choice:** Full desired-state revisit (triggers the Absent-target +
Idempotent follow-up questions below).

---

## Mixed-subject detection (OUT-06)

| Option | Description | Selected |
|--------|-------------|----------|
| Structurally declared | subject discriminant on the cascade type | |
| Detected at render time | inspect actual rows for heterogeneous subjects | ✓ |
| You decide | planner discretion | |

**User's choice:** Detected at render time (explicitly, over the structural
recommendation).

---

## Tally trigger (OUT-03/04)

| Option | Description | Selected |
|--------|-------------|----------|
| Bind to cardinality | single = 1-tuple omits tally; plural = array emits | ✓ |
| You decide | planner discretion | |

**User's choice:** Bind to cardinality (reuses Phase 1 OUT-07). (Re-asked once at
user request; same answer.)

---

## Absent-target policy (uninstall/reinstall/update of not-installed; mp remove of not-added)

| Option | Description | Selected |
|--------|-------------|----------|
| Error across the board | named target can't be operated on -> error, all cases | ✓ |
| Split by removal-intent | uninstall/remove-absent -> info; reinstall/update-absent -> error | |
| Keep today's mix | not-installed -> warning; mp remove not-added -> error | |

**User's choice:** Error across the board. (Changes uninstall/reinstall/update of
not-installed from warning/silent to error; mp-remove and mp-not-added stay error.)

---

## Idempotent "already in desired state" policy (enable/disable/autoupdate/bootstrap)

| Option | Description | Selected |
|--------|-------------|----------|
| Info (ensure-state met) | end-state already met -> info; install is the lone create-style error exception | ✓ |
| Match install (error) | treat already-in-state as error for all | |
| You decide | planner discretion | |

**User's choice:** Info (ensure-state met). install-already and mp-add-duplicate
remain the create-style error exceptions.

---

## Claude's Discretion

- Render-time mixed-subject detection mechanism; how leading sentence + tally read it.
- Producer emit-site stamping of the D-01 severities; converting the PU-5
  silent-converge path to an error row.
- Catalog supersession sequencing within the phase (green at every commit boundary).

## Deferred Ideas

- Concern-module extraction + open-closed proof -> Phase 4.
- Catalog generation/aggregation seam -> out of scope (MOD-06 floor).
