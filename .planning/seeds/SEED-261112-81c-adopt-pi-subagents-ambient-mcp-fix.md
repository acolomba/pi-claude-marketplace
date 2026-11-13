---
id: SEED-261112-81c
status: completed
planted: 2026-11-12
planted_during: parity-gaps / Phase 1
trigger_when: none
scope: small
---

# SEED-261112-81c: Adopt the pi-subagents ambient MCP fix

## Why This Matters

The following is the 2026-11-12 rationale, before the published release was adopted.

pi-subagents 0.88.0 gives children without an explicit MCP selector
`MCP_DIRECT_TOOLS=__none__`. Unrestricted and exclusion-only agents therefore
lose all direct MCP tools. Our long-name exclusion cannot be accepted on that
version because its permitted-tool control also fails. The local companion
fix passed all three real-child controls; at that time, this project's tested companion was unchanged.

On 2026-11-12 the user explicitly asked to defer adoption until a fixed version
is available and move on from Phase 1. This is the carrier for the remaining
PG-MCP-02 acceptance, tracked as BACKLOG AGTAMBIENT-01. It does not waive a
failed upgrade test or claim the installed companion is fixed.

## Retired Disposition — 2026-11-13

Published pi-subagents 0.88.1 contains the ambient child-launch fix from
[PR #3259](https://github.com/nicobailon/pi-subagents/pull/3259). The shared
suite and local launcher now select 0.88.1. The optional peer floor remains
`>=0.87.0`: this adoption uses no new companion API. The installed release
passes six launch checks and all three actual detached-child controls; the
positive ambient checks fail only their two intended cases on 0.88.0. See the
[quick-task summary](../quick/261113-8yn-adopt-pi-subagents-0-88-1-ambient-mcp-fi/261113-8yn-SUMMARY.md)
for the package identity, commands, and evidence.

The release trigger is retired. Final PG-MCP-02 acceptance waits for the
parent's combined-tree `npm run check` after these commits are merged.

## Historical Scope Estimate — 2026-11-12

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

## Historical Notes — 2026-11-12

PR #3259's reviewed branch head is `7629470d1d86f62e4fd4b6ccb1ee4b2c28953db4`.
The original fix is `1e79b864159430cc124783a7d7c9e4e5daa2a7bf`. The last recorded
PR state was open with CI passing; that was not publication evidence. No workaround
is introduced. AGTLONGNAME-01, the mismatch for explicit grants of shortened
adapter names, has its own trigger and is not fixed by this PR.
