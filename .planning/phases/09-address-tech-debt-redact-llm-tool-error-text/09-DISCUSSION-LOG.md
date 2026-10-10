# Phase 9: Address tech debt: redact LLM tool error text - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-10-10
**Phase:** 09-address-tech-debt-redact-llm-tool-error-text
**Areas discussed:** none (all delegated to Claude)

---

## Gray areas offered

| Option | Description | Selected |
|--------|-------------|----------|
| Redaction reach | Only the deferred catch text, or every string the two tools return to the LLM (catch text, content lines with sourceLogical, uncaught throws)? | |
| Uncaught throws | Wrap each tool's execute in one catch that returns isError with redacted text, or leave throws to Pi's generic error.message path? | |
| Redaction seam | Call redactCredentials at the tool return boundary, or route tool text through the notification resolve step? Path redaction too? | |
| Proof and closure | Owner tests vs extending the AUTH-09 gate; how to close the deferred item; requirement ID? | |

**User's choice:** "none, make your best decisions"

## Claude's Discretion

- Redaction reach: all `content` text of both tools (D-01, D-02).
- Uncaught throws: catch everything in both tools and return the TC-9 error shape (D-03).
- Redaction seam: `redactCredentials` at the tool return boundary; credentials only, no path redaction (D-04, D-05).
- Proof and closure: owner tests in `tools.test.ts`, no AUTH-09 change, close the deferred item, trace to PMOD-04 (D-06..D-08).

## Deferred Ideas

- Absolute-path redaction for LLM tool error text.
