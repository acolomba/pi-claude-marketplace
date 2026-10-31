# Phase 7: Mode Refusals, Real-Pi Verification, and Docs - Discussion Log

> **Audit trail only.** Downstream agents read CONTEXT.md, not this log.

**Date:** 2026-10-09 (America/New_York)
**Areas discussed:** Refusal messages, documentation layout, script examples

## Refusal messages

### How should browse explain its refusal?

1. Name the current mode (recommended)
2. Name the required mode

**User's choice:** Name the current mode: Browse is unavailable in json mode. Use /claude:plugin list instead. Substitute the actual mode.

### Which device-flow refusal wording?

1. Explain why the prompt cannot be displayed (recommended)
2. Keep it brief

**User's choice:** Device-flow authentication is unavailable in print mode. Retry with --mode json or interactive Pi.

### Should a browse refusal include usage help?

1. Refusal and remedy only (recommended)
2. Include usage help

**User's choice:** Initially selected refusal and remedy only, then explicitly corrected: usage help can always appear in json. Include existing usage help with JSON browse refusals. This does not request help on successful payloads.

### Should RPC refusals include usage help too?

1. Yes (recommended)
2. JSON only

**User's choice:** Yes, keep JSON and RPC payloads consistent.

### Move to documentation layout or discuss refusals further?

1. Move to documentation layout (recommended)
2. Discuss refusal messages further

**User's choice:** Move to documentation layout.

## Documentation layout

### Where should JSON documentation live?

1. README quick start + dedicated reference (recommended)
2. Dedicated guide only

**User's choice:** Dedicated guide only: short README link; all instructions and reference material in docs/json-output.md.

### How should the guide begin?

1. Runnable example first (recommended)
2. Contract first

**User's choice:** Runnable example first: command and extracted result, then the format.

### Where should key limitations appear?

1. Immediately after the example (recommended)
2. In a later limitations section

**User's choice:** In a later limitations section; opening focuses on normal usage.

### How should the field reference be organized?

1. Common fields once, then each payload kind (recommended)
2. Complete fields under every kind

**User's choice:** Common fields once, then each payload kind and its own fields.

### Move to script examples or discuss documentation layout further?

1. Move to script examples (recommended)
2. Discuss documentation layout further

**User's choice:** Move to script examples.

## Script examples

### How extensive should script examples be?

1. Small task-based examples (recommended)
2. One complete script

**User's choice:** Small task-based examples: extract plugin rows, calculate command severity, and detect reload needs separately.

### How should warnings affect the shell exit-status example?

1. Fail only on errors (recommended)
2. Fail on warnings too

**User's choice:** Fail only on errors. Display warnings without failing; this is example policy and does not change payload severity.

### What if no command outcome arrives?

1. Fail with No command outcome received (recommended)
2. Report unknown without failing

**User's choice:** Fail with No command outcome received. Silence does not prove success.

### How should examples explain partial failure?

1. Show earlier results plus the final error (recommended)
2. Use a prose note only

**User's choice:** Show earlier results plus the final error, demonstrating that completed changes remain and needsReload may still be true.

### Finish discussion or discuss script examples further?

1. Finish the discussion (recommended)
2. Discuss script examples further

**User's choice:** Finish discussion and review captured decisions before planning.

## Final confirmation

The user selected option 1: write context and continue planning.

## Agent discretion

Internal implementation and test organization within existing project rules.

## Deferred ideas

None.

## Research follow-up: corpus exception

Research showed that tests of the newly required print refusals add notify
samples even when their notification fake is silent.

1. Allow only new refusal samples (recommended): preserve all 3,149 existing
   samples, record every addition, and keep catalog examples unchanged.
2. Keep the corpus fixed: revisit how to verify the new refusals.

**User's choice:** 1. The user then explicitly said "continue".
The approved exception is recorded as D-14 in CONTEXT.md.
