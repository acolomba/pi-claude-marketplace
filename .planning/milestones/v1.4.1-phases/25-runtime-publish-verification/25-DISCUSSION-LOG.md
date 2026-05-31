# Phase 25: Runtime Publish & Verification - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md -- this log preserves the alternatives considered.

**Date:** 2026-05-29
**Phase:** 25-runtime-publish-verification
**Areas discussed:** Delivery mechanism, Work split / hand-off, G-MIL-03 indent resolution, G-MIL-07 completion scope, SNM-37 sandbox amendment

---

## Delivery mechanism (SNM-37)

| Option | Description | Selected |
|--------|-------------|----------|
| npm link from source tree | `npm link` the working tree into the global Pi runtime; reversible, no registry pollution | |
| Source-tree `--extension` load | Point interactive Pi at `--extension .../index.ts` directly | |
| Real npm publish | Publish 0.2.0 to npm and install it; faithful but public/polluting | |
| Throwaway sandbox install | npm pack + install into an isolated HOME/agent-dir sandbox | |

**User's choice:** "we already have a script under scripts/ to do this" → resolved to `scripts/pi.sh`.
**Notes:** `scripts/pi.sh` loads the v0.2.0 source tree directly (`-e .../index.ts`) plus `pi-mcp-adapter` + `pi-subagents` companions, with optional `--home <sandbox>` isolation and `--cd`. This is a superset of the "source-tree `--extension` load" option and supersedes the publish/npm-link framing entirely. (D-25-01, D-25-02)

---

## Work split / hand-off (SNM-37 → 38/39)

| Option | Description | Selected |
|--------|-------------|----------|
| I prep, you run live + paste back | Claude sets up, user runs in live Pi, pastes output | |
| I automate as much as possible first | Automate byte-capture + payload checks; escalate only what needs the live tui | ✓ |
| You do the whole publish, I only diagnose | User owns all runtime steps; Claude only analyzes | |

**User's choice:** I automate as much as possible first.
**Notes:** Combined with the follow-up auto-ceiling decision: G-MIL-03 byte-capture fully automated; G-MIL-07 goes straight to a live interactive trigger because the unit test already covers the provider and the suspected gap is tui consumption. (D-25-07, D-25-08)

---

## G-MIL-03 indent resolution (SNM-38)

| Option | Description | Selected |
|--------|-------------|----------|
| Byte-evidence first, then decide | Capture leading-whitespace bytes at `ctx.ui.notify`; fix only if code emits the wrong ladder, else not-a-bug + catalog clarification | ✓ |
| Match what the user sees | Treat the live 1/3 visual as the contract; compensate in the renderer | |
| Defer if root cause is tui-side | Document + defer if it's a Pi-tui leading-space strip | |

**User's choice:** Byte-evidence first, then decide.
**Notes:** The UAT itself flags that markdown rendering can obscure single-space differences, so the byte-exact capture at the notify boundary is the arbiter. (D-25-09)

---

## G-MIL-07 completion scope (SNM-39)

| Option | Description | Selected |
|--------|-------------|----------|
| Fix in our code if feasible | Workaround/wiring fix on our side even if cause is tui consumption | |
| Root-cause, then fix-or-defer | Trace to actual cause; fix if ours, document + defer if Pi-tui-external | ✓ |
| Refute-or-fix only, no upstream | Scope strictly to reproduce + fix-if-ours; no upstream filing | |

**User's choice:** Root-cause, then fix-or-defer.
**Notes:** Two completion surfaces exist (`getArgumentCompletions` at `register.ts:98`, `addAutocompleteProvider` wrapper at `:108`); divergence between them is a prime suspect alongside scope-root mismatch and Pi-tui consumption. (D-25-10)

---

## SNM-37 sandbox amendment (follow-up)

| Option | Description | Selected |
|--------|-------------|----------|
| Amend SNM-37 + isolated `--home` | Amend wording to source-load; run in tmp sandbox with controlled fixture | (basis) |
| Amend SNM-37 + your real Pi home | Same wording, run against real `~/.pi` | |
| Keep SNM-37 as-is | Don't amend; treat script as just methodology | |
| **Confirm: lock with all 3 caveats** | Amend + behavioral-smoke SC#1 + G-MIL-07 real-home fallback + publish-validation deferred | ✓ |

**User's choice:** Asked Claude's opinion first ("does it make sense? can the script serve all SNM-37 purposes?"), then locked "Yes, lock it with all 3 caveats."
**Notes:** Claude's assessment: yes -- `scripts/pi.sh` serves all of SNM-37's reproduction-enablement purposes (interactive runtime, companions loaded, /claude:plugin live, behavioral smoke). Three caveats locked: (1) v1.4 identity verified behaviorally not via `pi --version`; (2) G-MIL-07 keeps a real-`~/.pi` fallback to avoid false-refute on a scope-root mismatch; (3) packaged-artifact/real-publish validation recorded as deferred. (D-25-03, D-25-04, D-25-05, D-25-06)

---

## Claude's Discretion

- Regression-test policy when a finding is refuted (recommended default: still lock the 2/4/6 ladder with a byte test; planner's call).
- Exact sandbox fixture shape (≥1 installed plugin per marketplace; a reason-brace + installed/available mix).
- Plan/wave decomposition (SNM-37 gate → SNM-38 ∥ SNM-39).
- Whether `runPiRuntimeSmoke` is extended or a new thin behavioral smoke is added.

## Deferred Ideas

- Real `npm publish` / packaged-artifact (release tarball) validation -- out of v1.4.1 scope.
- State migration for already-installed hash-versioned plugins -- carried v1.4.1 deferral.
