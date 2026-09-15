# Phase 4: Install provenance - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-09-15 (opened), 2026-09-15 (resumed and closed)
**Phase:** 4-Install provenance
**Areas discussed:** What provenance stores, What the desired-state config holds, Schema versioning and legacy records, Where the config-write reversal lands, What reconcile does with orphans

---

## What provenance stores

| Option | Description | Selected |
|--------|-------------|----------|
| Mode only — `"explicit" \| "dependency"` | Two values, nothing else; `--prune` re-derives the declarer set at prune time | ✓ |
| Mode plus a declaring-plugin list | Records which plugins pulled it in, so `--prune` can read the answer directly | |

**User's choice:** Mode only.
**Notes:** A stored declarer list is a cache of another plugin's manifest. It drifts on every install, update and uninstall, and nothing in the system would keep it honest. Re-deriving "does anything still need this?" from the installed plugins' declarations is offline, cheap, and cannot go stale.

---

## What the desired-state config holds

Not a presented option list — the operator raised this directly while reviewing Phase 3's CR-01 fix: *"dependencies are written in claude-plugins.json? the desired state configuration??"*

| Option | Description | Selected |
|--------|-------------|----------|
| Config holds only explicit plugins | Dependencies live in the state record and are derived, never declared | ✓ |
| Config holds everything installed (Phase 3's shipped fix) | Every cascade member gets a config entry, which is what stops reconcile sweeping it | |

**User's choice:** Config holds only explicit plugins.
**Notes:** This reverses the shape of a fix that Phase 3 shipped, reviewed, verified and UAT-closed. The fix works — that was never in doubt. It is the wrong design: it conflates what the user asked for with what was pulled in to satisfy it, which is exactly the distinction `--prune` is built on. Nothing in Phase 3's own test suite could have raised this; it came from one observation about the meaning of a file.

The knock-on: provenance stops being a bookkeeping field for Phase 5 and becomes load-bearing for reconcile correctness in Phase 4.

---

## Schema versioning and legacy records

| Option | Description | Selected |
|--------|-------------|----------|
| Bump 2 → 3, required field, silent fill with `"explicit"` | Truthful default; mirrors the `enabled` / ENBL-02 precedent exactly | ✓ |
| Optional additive field, no bump | Follows the `resolvedSha` / `hookEntries` precedent; absence means "unknown" | |
| Required field with no fill, report the record as stale | The ROADMAP's original reading — validation failure IS the staleness detector | |

**User's choice:** Bump to 3, required, silent fill.
**Notes:** The default is truthful rather than a guess: no released version through v0.18.3 had a dependency cascade, so every record a released build wrote genuinely is explicit. Records Phase 3 wrote on development trees are mislabelled, which the ROADMAP had already accepted in advance ("lands on development trees only, and this milestone releases as a single version").

Two consequences the operator accepted explicitly: PROV-04 no longer says what it says (see below), and the third option above — which the ROADMAP had reasoned toward in its "a required field is the staleness detector" note — is superseded.

| Option | Description | Selected |
|--------|-------------|----------|
| Reword PROV-04 to match the silent upgrade | "upgraded with a truthful default, and no record is misreported as a dependency" | ✓ |
| Keep PROV-04 and abandon the silent upgrade | Emit a stale-state report naming a recovery command, per the original wording | |

**User's choice:** Reword PROV-04.
**Notes:** The MIGR-01 guard-wording question (notify text and recovery command for "stale state, absent config") returns to MIGR-01 in the backlog rather than being half-answered here. This phase now borrows nothing from MIGR-01.

---

## Where the config-write reversal lands

*This question was open when the session paused; answered on resume, 2026-09-15.*

| Option | Description | Selected |
|--------|-------------|----------|
| All in Phase 4, in a fixed 3-step order | provenance → reconcile guard → remove the write. Phase 3 stays closed; the sweep is never reopened between steps | ✓ |
| Reopen Phase 3 to revert the write | Fixes it at the source, but leaves a window where dependencies ARE swept, and re-verifies a phase closed at 5/5 | |
| Defer the removal to Phase 5 | Phase 4 ships provenance + the guard only; makes Phase 5 the largest phase in the milestone | |

**User's choice:** All in Phase 4 — the recommended option.
**Notes:** The ordering is the whole point and is recorded as part of the decision, not as advice. The config write is currently the only thing stopping `buildUninstallBucket` from sweeping cascade dependencies; removing it before the reconcile guard exists re-opens CR-01, a blocker-severity data-loss defect. CR-01's regression test stays honest across all three steps — it asserts the dependency survives a reload, which stays true throughout, via a changing mechanism.

---

## What reconcile does with orphans

*This question was open when the session paused; answered on resume, 2026-09-15.*

| Option | Description | Selected |
|--------|-------------|----------|
| Keep sweeping, exempt only `provenance: "dependency"` | Today's rule plus exactly one exemption — the smallest change that makes the model work | ✓ |
| Keep the orphan and report it instead | Safer against an accidental config hand-edit; needs its own reason token and catalog byte form | |

**User's choice:** Keep sweeping — the recommended option.
**Notes:** The rejected arm is recorded in CONTEXT.md's Deferred Ideas rather than dropped. It changes established reconcile behavior beyond this phase's scope, and this phase is already carrying an architectural reversal.

---

## Claude's Discretion

- Exact field name on the install record and how the two values are typed.
- Whether the `dependency` exemption in `buildUninstallBucket` is an inline condition or a named helper.
- Whether the fixed 3-step order maps to three plans or to waves within fewer plans.
- How the provenance value is threaded from the cascade into each member's record.

## Deferred Ideas

- Reporting a genuine orphan instead of sweeping it (the rejected arm above).
- MIGR-01's staleness gate — wording, recovery command, and the `migrate.ts` deletion.
