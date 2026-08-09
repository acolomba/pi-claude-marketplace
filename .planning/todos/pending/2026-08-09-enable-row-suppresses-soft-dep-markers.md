---
created: 2026-08-09
resolves_phase: 98
source: 97-REVIEW.md WR-06
---

# The fresh-enable row hard-codes `dependencies: []`, suppressing soft-dep markers

Both fresh-enable arms in `orchestrators/plugin/enable-disable.ts`
(`freshEnableRow`) and the reconcile projection
(`orchestrators/reconcile/notify.ts::enabledRowFromOutcome`) emit
`dependencies: []` unconditionally. A re-enable that stages agents or MCP
servers therefore never renders `{requires pi-subagents}` / `{requires pi-mcp}`
and never takes the SEV-01 info -> warning raise that `install.ts` applies for
an unloaded companion.

The enable ledger stages exactly the same artifacts as the install ledger, so
the signal is equally relevant. The condition predates the phase, but ENBL-07
makes `enable` the sanctioned re-materialization surface for degraded records —
the ones most likely to need the marker.

## Why deferred

Threading the counts is small (`runInstallLedger`'s `installCtx` already
carries `stagedAgentNames` / `stagedMcpServerNames`, which `install.ts` reads),
but the result CHANGES byte-pinned output on both enable arms: rows gain a
`{requires pi-...}` marker and the cascade gains a warning summary line. That
needs its own catalog states and fixtures, which is a wider surface than the
classification repair Phase 97 scoped.

## Where it lands

Thread the staged-name counts out of `runInstallLedger`'s `installCtx` through
`SetEnabledOutcome`'s fresh arm and `EnableDisablePluginOutcome`'s `enabled`
arm (both already carry the `unsupported` kind list added for CR-01, so the
seam exists), then build `dependencies` + `severity` through
`companionSeverity` rather than pinning them.

Needs: a soft-dep catalog state under `## /claude:plugin enable` in
`docs/output-catalog.md` (mirroring `soft-dep-on-installed`), its fixture in
`tests/architecture/catalog-uat.test.ts`, and row assertions in
`tests/orchestrators/plugin/enable-disable.test.ts` +
`tests/orchestrators/reconcile/notify.test.ts`.
