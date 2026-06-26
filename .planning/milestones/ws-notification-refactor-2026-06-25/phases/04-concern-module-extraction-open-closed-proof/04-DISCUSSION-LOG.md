# Phase 4: Concern-module extraction & open-closed proof - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md.

**Date:** 2026-06-24
**Phase:** 4-concern-module-extraction-open-closed-proof
**Areas discussed:** Concern wiring mechanism, Open-closed proof mechanism

---

## Concern wiring (MOD-04)

| Option | Description | Selected |
|--------|-------------|----------|
| Direct function calls | concern modules export plain functions the composer imports/calls; no registry | ✓ |
| Concern-contribution interface | a Concern interface + iterated contribution list | |
| You decide | planner discretion | |

**User's choice:** Direct function calls. Mirrors the Phase 1 "forget the registry"
decision. soft-dep probe stays threaded by the renderer (environment).

---

## Open-closed proof (MOD-05)

| Option | Description | Selected |
|--------|-------------|----------|
| Arch test + measurement | a test asserting notify.ts has no per-command grammar + documented count | |
| Documented measurement only | written proof/walkthrough of the <=3-files / 0-notify.ts-edits count vs baseline | ✓ |
| Sample command as living proof | add a real sample command end-to-end + doc | |

**User's choice:** Documented measurement only. Explicitly lighter than an
enforceable architecture test; accepts that nothing structurally prevents future
grammar creeping back into notify.ts. GATE-03 (npm run check green) remains the only
automated gate at close.

---

## Claude's Discretion

- Module paths/names under shared/concerns/ and the composer/info-renderer call
  signatures.
- Where the proof + MOD-06 floor note live (a durable doc, not just a comment).
- Import-fence handling when relocating HookSummaryEntry types.

## Deferred Ideas

- Catalog generation/aggregation seam -> out of scope (MOD-06 floor).
- Architecture test enforcing notify.ts purity -> declined this phase; future hardening.
