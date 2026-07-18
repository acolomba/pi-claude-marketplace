# Phase 78: Plugin git-source lifecycle - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-11
**Phase:** 78-plugin-git-source-lifecycle
**Areas discussed:** Clone GC mechanism (PURL-05/06), Reinstall pin source (PURL-07), List/info git status (PURL-08), Unpinned update semantics (PURL-06)

---

## Clone GC mechanism (PURL-05/06)

| Option | Description | Selected |
|--------|-------------|----------|
| Derive from state at GC time | Scan scope state.json url+resolvedSha → clone key after the state mutation commits; no persisted artifact; crash leaves an orphan the next pass sweeps | ✓ |
| Persisted refcount index | clones-index.json with per-key refcounts — O(1) but a second source of truth that can drift | |

**User's choice:** Derive from state at GC time

---

## Reinstall pin source (PURL-07)

| Option | Description | Selected |
|--------|-------------|----------|
| Recorded resolvedSha | Warm cache by construction; offline guarantee unconditional; matches reinstall's installed-record identity | ✓ |
| Manifest's current sha | Picks up sha drift without update, but cold cache → network, breaking PURL-07; blurs reinstall/update boundary | |

**User's choice:** Recorded resolvedSha

---

## List/info git status (PURL-08)

| Option | Description | Selected |
|--------|-------------|----------|
| Same as path plugins | Inject cache-presence probe; uninstalled git plugins render like path plugins; no network marker | ✓ |
| Installable + cache marker | Distinguish warm/cold cache with a note — new closed-set amendment for marginal value | |

**User's choice:** Same as path plugins

| Option | Description | Selected |
|--------|-------------|----------|
| No status change (missing clone) | Clone cache is an implementation detail; installed components work from staged resources; reinstall refetches | ✓ |
| New warning marker | `(cache missing)` row marker — per-plugin FS probe on every list + token amendment for a rare self-healing condition | |

**User's choice:** No status change

---

## Unpinned update semantics (PURL-06)

| Option | Description | Selected |
|--------|-------------|----------|
| Confirm refresh-time contract | Pinned: swap on manifest sha change. Unpinned: re-resolve HEAD at update, swap if different from recorded. Existing 3-phase swap; v#old → v#new arrow; GC after swap | ✓ |
| Adjust something | — | |

**User's choice:** Confirm

---

## Claude's Discretion

- Swap staging/ordering inside withStateGuard (follow existing 3-phase swap)
- GC hook point after state commit
- Presence-probe wiring shape for list/info
- Update-time network failure classification (reuse existing REASONS tokens)
- Vanished-upstream-repo update behavior (fail-clean, stays on recorded sha)

## Deferred Ideas

- Private-host auth for update fetches — Phase 79
- Cache-presence list markers — rejected; revisit only on real-world confusion
