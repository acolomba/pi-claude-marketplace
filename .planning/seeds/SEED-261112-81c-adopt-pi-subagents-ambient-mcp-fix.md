---
id: SEED-261112-81c
status: dormant
planted: 2026-11-12
planted_during: parity-gaps / Phase 1
trigger_when: A published pi-subagents release contains the ambient direct-MCP child-launch fix from nicobailon/pi-subagents PR 3259; review when updating companions or starting a milestone
scope: small
---

# SEED-261112-81c: Adopt the pi-subagents ambient MCP fix

## Why This Matters

pi-subagents 0.88.0 gives children without an explicit MCP selector
`MCP_DIRECT_TOOLS=__none__`. Unrestricted and exclusion-only agents therefore
lose all direct MCP tools. Our long-name exclusion cannot be accepted on that
version because its permitted-tool control also fails. The local companion
fix passed all three real-child controls; this project's dependency is unchanged.

On 2026-11-12 the user explicitly asked to defer adoption until a fixed version
is available and move on from Phase 1. This is the carrier for the remaining
PG-MCP-02 acceptance, tracked as BACKLOG AGTAMBIENT-01. It does not waive a
failed upgrade test or claim the installed companion is fixed.

## When to Surface

**Trigger:** a published, supported pi-subagents release includes
[PR #3259](https://github.com/nicobailon/pi-subagents/pull/3259), or an equivalent
fix whose behavior is verified. Check the release contents before choosing a
version; no release number is assumed.

Review this seed during companion upgrades and new-milestone planning. GSD seeds
surface during milestone scans; they do not watch GitHub or install updates in
the background.

## Scope Estimate

**Small** — a dependency upgrade and automated acceptance task through GSD.

1. Verify the published package contains the fix. Update the shared suite pin,
   lockfile and launcher/canary pins as applicable. Set the supported floor to
   the first release proven to provide this behavior, updating its documented
   references consistently. Preserve unrelated companion versions.
2. Run `test/integration/pi-subagents-child-launch-conformance.test.ts` against
   the installed upgrade. The two known-bug assertions should fail; the four
   explicit-restriction controls should still pass. Investigate any other result.
3. Run `node .planning/debug/artifacts/real-child-mcp-automation/run.mjs` against
   the project's installed upgraded companion, without `PG_COMPANION_INDEX`
   pointing at an old local build. Require actual provider inventories and MCP
   calls: explicit short grant succeeds; unrestricted child offers and calls
   long; exclusion-only child omits long but offers and calls short.
4. Replace the two known-bug assertions with the intended behavior after those
   controls pass. Keep the four restriction controls and the independent adapter
   naming tests. Do not skip based on version or accept both behaviors.
5. Run `npm run check`. Update compatibility notes, the Phase 1 UAT/verification
   deferral, requirement traceability and AGTAMBIENT-01 using the adopted-version
   evidence. Retire the override only after the required behavior is proven.

## Breadcrumbs

- BACKLOG.md — AGTAMBIENT-01; AGTLONGNAME-01 is a separate explicit-grant bug.
- phases/01-companion-floors-and-mcp-defaults/01-VERIFICATION.md — accepted deferral.
- phases/01-companion-floors-and-mcp-defaults/01-UAT.md — original installed-peer evidence.
- quick/261112-jzs-add-installed-companion-characterization/ — tests and red/green proof.
- `test/integration/pi-subagents-child-launch-conformance.test.ts` — six permanent checks.
- debug/artifacts/real-child-mcp-automation/README.md — runnable positive acceptance and retained logs.
- `test/integration/optional-peer-suite-versions.json` — shared suite pin.

## Notes

PR #3259's reviewed branch head is `7629470d1d86f62e4fd4b6ccb1ee4b2c28953db4`.
The original fix is `1e79b864159430cc124783a7d7c9e4e5daa2a7bf`. The last recorded
PR state is open with CI passing; that is not publication evidence. No workaround
is introduced. AGTLONGNAME-01, the mismatch for explicit grants of shortened
adapter names, has its own trigger and is not fixed by this PR.
