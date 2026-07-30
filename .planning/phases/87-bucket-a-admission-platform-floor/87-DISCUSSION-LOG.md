# Phase 87: Bucket-A admission & platform floor - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-29
**Phase:** 87-bucket-a-admission-platform-floor
**Areas discussed:** Peer-floor semantics, Floor doc surface, ADMIT-02 verification

---

## Todo cross-reference

| Option | Description | Selected |
|--------|-------------|----------|
| Don't fold | Keyword match is generic (extensions/claude/marketplace/plugin); leave pending | ✓ |
| Fold into Phase 87 | Phase 87 also picks up rare-failure-arm coverage for update/reinstall/install | |

**User's choice:** Don't fold — "Coverage sweep: test rare failure arms in
update/reinstall/install" (score 0.6) stays pending; unrelated to hook
admission.

---

## Peer-floor semantics (FLOOR-01)

| Option | Description | Selected |
|--------|-------------|----------|
| Declarative only | Bump package.json peer range + docs; no runtime detection — the floor IS the guarantee; resolver stays environment-independent | ✓ |
| Load-time probe + warn | Detect running Pi version at load, one-shot warning below 0.80.4; new pattern, needs version-detection seam | |
| Env-conditional admission | Feature-detect agent_settled; below floor Stop/StopFailure keep tripping unsupported; resolver verdict becomes Pi-version-dependent | |

**User's choice:** Declarative only (recommended option).
**Notes:** Matches every prior floor bump (no runtime peer-version checks
exist anywhere today); keeps list/info outputs byte-stable across
environments.

---

## Floor doc surface (FLOOR-01)

| Option | Description | Selected |
|--------|-------------|----------|
| README only | Add the version floor to the existing Pi bullet in § Prerequisites | |
| README + compat note | Also drop a minimal floor line into hooks-compatibility.md now | |
| Defer to Phase 89 | package.json only in 87; all doc mentions ride the Phase 89 reconcile | |
| Other (free text) | — | ✓ |

**User's choice:** "no need to touch the readme because the package json
already enforces version dependencies"
**Notes:** Stronger than the presented "defer" option — no doc edits at all
for the floor in Phase 87, and none required later either; the peer-range
declaration is the sufficient user-facing surface. FLOOR-01's "user-facing
docs" clause is read as satisfied by package.json.

---

## ADMIT-02 verification

| Option | Description | Selected |
|--------|-------------|----------|
| Unit fixtures | Restore hookify fixture's Stop arm + add ralph-wiggum fixture (real wire bytes); assert resolver partition + plugin-info listing; offline, in npm run check | ✓ |
| Unit + live UAT in-phase | Additionally resolve against the real claude-plugins-official marketplace in Phase 87 verification | |
| You decide | Claude picks the verification surface during planning | |

**User's choice:** Unit fixtures (recommended option).
**Notes:** Live marketplace resolution stays a milestone-audit/UAT concern.

---

## Claude's Discretion

- `BUCKET_A_EVENTS` tuple placement of the two new events (append vs
  lifecycle order).
- `ClaudeHookEvent` lockstep widening in `shared/concerns/hooks.ts`.
- Doc-comment updates in `hook-events.ts` and other stale "8 events" prose.
- ralph-wiggum fixture derivation details (match hookify fixture provenance).
- Pipe-OR tokenization consistency for the StopFailure closed-set matcher.

## Deferred Ideas

- Dispatch wiring (Phase 88); docs reconcile (Phase 89); floor doc mention
  explicitly declined (D-87-02).
- Reviewed-not-folded todo: coverage sweep for rare failure arms in
  update/reinstall/install.
