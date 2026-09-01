# Phase 106: Workflow Detection and Partial Install - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-29
**Phase:** 106-workflow-detection-and-partial-install
**Areas discussed:** Declaration meaning, directory detection, resolver coverage, combined reasons

---

## Alignment Policy

| Option | Description | Selected |
|--------|-------------|----------|
| Existing unsupported-component behavior | Apply the current schema, resolver, convention-probe, partial-install, and reason-deduplication patterns to workflows. | ✓ |
| Workflow-specific behavior | Introduce special declaration validation, directory-content rules, resolver-mode differences, or custom reason ordering. | |

**User's choice:** "none, make decisions aligned with how we treat the other unsupported components"
**Notes:** All four proposed discussion areas were delegated to the agent under this alignment rule. The milestone's explicit `{workflows}` token remains a locked exception to the current generic `{unsupported component}` fallback.

## the agent's Discretion

- Exact tuple placement that preserves existing kind ordering.
- Test layout and helper boundaries.
- Additional declaration namespaces only if an authoritative existing schema rule requires parity.

## Deferred Ideas

- Workflow validation, materialization, and execution.
