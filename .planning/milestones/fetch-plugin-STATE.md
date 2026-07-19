---
gsd_state_version: 1.0
milestone: fetch-plugin
milestone_name: Remote Plugin Status & Fetch
current_phase: 81
status: complete
stopped_at: Phase 81 gap 81-06 closed (warm git-subdir subdir-anchoring) and re-verified passed (6/6); all fetch-plugin phases done (79.1/80/81, 14/14 plans); milestone lifecycle (workstream complete + audit/close) pending
last_updated: "2026-07-15T10:40:54.211Z"
last_activity: 2026-07-15
last_activity_desc: Quick task 260715-b9u complete (flag-catalog SSOT)
progress:
  total_phases: 3
  completed_phases: 3
  total_plans: 14
  completed_plans: 14
  percent: 100
current_phase_name: Fetch verb & info --fetch
---

# Project State

## Project Reference

See: .planning/PROJECT.md (## Current Milestone: fetch-plugin, updated 2026-07-13)

**Core value:** A Pi user can `/claude:plugin install <plugin>@<marketplace>` and, after `/reload`, have every supported Claude plugin component appear as a working Pi-native artefact — atomically, recoverably, with soft-dependency degradation that never blocks the install.
**Current focus:** Milestone fetch-plugin lifecycle close — all phases complete; next is workstream completion + milestone audit/close

## Deferred Items

Items acknowledged and deferred at milestone close on 2026-07-13:

| Category | Item | Status |
|----------|------|--------|
| pending_todo | 2026-07-13-remote-plugin-status-fetch-verb-glyph-reassignment (plugin) | Deliberate next-milestone carry — full RSTA/FTCH requirement set; durably seeded as `.planning/seeds/SEED-001-remote-plugin-status-fetch-verb.md`, which `/gsd-new-milestone` auto-surfaces |
| uat_gap | Phase 77: 77-UAT.md flagged "incomplete" by audit-open | Tool false-positive — file is `status: passed` with 0 pending scenarios; independently confirmed all-clear by `/gsd-audit-uat` 2026-07-13 |

## Current Position

Phase: 81 (Fetch verb & info --fetch) — COMPLETE (last phase of milestone fetch-plugin)
Plan: 6/6 executed
Status: All fetch-plugin phases complete (79.1, 80, 81); Phase 81 verification passed and live-fetch UAT passed 1/1. Gap-closure plan 81-06 (warm git-subdir subdir-anchoring) executed and re-verified (passed, 6/6). Milestone lifecycle pending: `/gsd-workstreams complete url-source`, then milestone audit/close once workstream `milestone` finishes.
Last activity: 2026-07-15 — Completed quick task 260715-b9u: flag-catalog SSOT (completion gains list --remote, info --fetch)

## Roadmap Summary

Milestone fetch-plugin — 2 phases, 13 requirements (RSTA-01..07 + FTCH-01..06). url-source phases 76-79 archived to `.planning/milestones/url-source-ROADMAP.md`.

| Phase | Goal | Requirements |
|-------|------|--------------|
| 80. Remote status, glyph reassignment & warm-cache resolution | Not-installed git-source plugins read `(remote)` instead of over-claiming `(available)`; warm clones resolve fs-only; `list --remote` filters the `(remote)` bucket | RSTA-01, RSTA-02, RSTA-03, RSTA-04, RSTA-05, RSTA-06, RSTA-07 |
| 81. Fetch verb & info --fetch | Pi-only `fetch <plugin>@<marketplace>` warms the clone cache without installing; `info --fetch` fetches then resolves; fetched-uninstalled clones stay GC-sweepable and self-heal to `(remote)` | FTCH-01, FTCH-02, FTCH-03, FTCH-04, FTCH-05, FTCH-06 |

## Accumulated Context

### Decisions

Decisions logged in PROJECT.md. Milestone framing:

- Phasing follows the closed-set-then-verb gradient: Phase 80 lands the `(remote)` status + glyph reassignment + fs-only warm-cache resolution + `list --remote` (the classification-layer milestone, all 7 RSTA requirements); Phase 81 adds the `fetch` orchestrator + `info --fetch` on top (all 6 FTCH requirements). Fetch's self-heal target and `info --fetch`'s warm-cache resolution both depend on Phase 80, so the order is forced.
- Catalog/docs rows are NOT a standalone phase: the closed-set lockstep discipline requires the `(remote)` token, glyph reassignment, catalog byte forms, catalog-UAT fixtures, and style-guide frontmatter to land atomically inside Phase 80's amendment commit.
- Two discuss-phase decisions are deliberately deferred (do not resolve during planning): fetch granularity (single plugin v1; bulk = v2 FTCH-07) and unpinned prefix-scan ambiguity (manifest pin wins; exactly-one match resolves; multiple matches = "fetched" without component resolution).
- FTCH-06 is DECIDED (fetch auth at install parity); do not re-litigate.
- Resolver three-way union untouched (NFR-7); `(remote)` derives at the classification layer in shared `git-source-probe.ts`. Amends INFO-05, PURL-08, NFR-5.
- [Phase 81]: `info --fetch` is a probe-swap (`makePresenceProbe` → `makeFetchProbe`) at the existing row-builder injection site, not a parallel code path — bare-info and post-fetch classification stay byte-identical (81-03).
- [Phase 81]: `classifyFetchFailure` duck-types HttpError 401/403 + errno ladder onto existing REASONS (`authentication required` / `network unreachable`), falling back to `narrowProbeError`; no closed-set growth (81-03).
- [Phase 81]: `(skipped)` no-op rows carry the existing `up-to-date` reason at info severity via the Plan-02 producer (reason-agnostic render arm, update-verb parity) (81-01/02).
- [Phase 81]: `parseFetchTarget` exported as a pure parser so the three fetch shapes are asserted directly (hermetic fixtures can't distinguish them via output); shim stays thin (81-04).

Carried url-source decisions (context for the shared seams this milestone amends):

- Phasing follows the difficulty gradient: marketplace URL sources first (light — existing clone-per-marketplace lifecycle), then the genuinely new plugin clone cache, then provider auth. Public-repo unauthenticated clone works from Phase 76 onward.
- MURL-06 (config reconcile) and MURL-07 (import) fold into Phase 76 rather than a thin standalone phase — same URL-source capability reaching two more declarative surfaces.
- PURL-09 (recorded version = resolved sha) lands with install (Phase 77), since the sha is resolved at install time.
- [Phase 78]: 78-07: standalone marketplace remove and plugin uninstall cascade config deletion across BOTH claude-plugins.json and claude-plugins.local.json; opts.local now scopes only the CFG-03 abort target, not the write-back
- [Phase 78]: dangling reference is a distinct closed-set FAILURE_REASONS member (PURL-06), not a reuse of source mismatch, so the reconcile diagnostic names an undeclared marketplace truthfully
- [Phase 78]: The reconcile source-mismatch header reason is derived from the planner cause at both render sites: dangling-reference -> dangling reference, other three causes -> source mismatch
- [Phase 78]: 78-09: list.ts's git-source short-circuit + warm-cache presence probe extracted into a shared fs-only module both list and the completion bucketizer consume, so install completion offers git-source plugins as (available) at parity with list (PURL-08)
- [Phase 78]: 78-09: plugin-index cache schemaVersion bumped 4 -> 5 so pre-fix caches carrying git-source rows misclassified `unavailable` drop+rebuild on next read
- [Phase 78]: 78-10: marketplace remove now calls garbageCollectPluginClones in its post-commit full-remove branch, so PURL-06 last-ref GC applies to the remove cascade at parity with uninstall/update; fs-only helper keeps remove.ts free of git surface (NFR-5)

### Pending Todos

None yet.

### Blockers/Concerns

None yet.

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 260715-b9u | Flag-catalog SSOT for CLI flag parsing and completion (list --remote, info --fetch) | 2026-07-15 | 74534df4 | [260715-b9u-flag-catalog-ssot-for-cli-flag-parsing-a](../../quick/260715-b9u-flag-catalog-ssot-for-cli-flag-parsing-a/) |

### Roadmap Evolution

- Phase 79.1 inserted after Phase 79: Mutable mirror clones for unpinned git plugin sources (re-scope decided at Phase 80 discuss: prefix-scan design rejected)

## Deferred Verification

| Phase | State | Resume |
|-------|-------|--------|
| *(none — Phase 81 human verification resolved 2026-07-15: live-fetch UAT passed, 81-VERIFICATION.md canonicalized to passed)* | | |

## Deferred Items

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| *(none)* | | | |

## Session Continuity

Last session: 2026-07-15T01:02:12Z
Stopped at: Phase 81 complete (UAT 1/1 passed, verification passed) — milestone fetch-plugin phase work done, ready for workstream completion
Resume file: None

## Operator Next Steps

- Archive this workstream: `/gsd-workstreams complete url-source`
- Milestone audit/close (`/gsd-audit-milestone` / `/gsd-complete-milestone`) once workstream `milestone` (force-install closeout, status: verifying) also finishes
