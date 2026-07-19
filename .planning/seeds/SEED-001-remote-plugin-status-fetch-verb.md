---
id: SEED-001
status: dormant
planted: 2026-07-13
planted_during: url-source milestone (post-audit, pre-completion)
trigger_when: next milestone planning (any plugin/marketplace UX or lifecycle scope)
scope: medium
---

# SEED-001: (remote) plugin status, fetch verb, and glyph reassignment

## Why This Matters

`info` on a git-source plugin renders `components: not resolved`, so users
cannot assess whether a plugin will install. Worse, `list`/completion classify
unfetched git-source plugins `(available)` straight from the manifest — an
over-claim, since nothing is validated until fetched. The fix is a coherent
status model (honest `(remote)` state), a `fetch` verb to warm the clone cache
early, and fs-only warm-cache resolution that fixes the biggest gap (installed
git-source plugins) with no network-policy change at all.

## When to Surface

**Trigger:** next milestone planning — this is a ready-made requirement set
(RSTA-01..06, FTCH-01..06, consistency-checked 2026-07-13) for a small focused
milestone in the house style.

## Scope Estimate

**Medium** — ~2-3 phases: (a) status token + glyph reassignment + probe
reclassification + cache schema bump, (b) fetch orchestrator + `info --fetch`
+ warm-cache info resolution, (c) catalog/docs rows.

## Breadcrumbs

- Full requirement set + decisions: `.planning/workstreams/url-source/todos/pending/2026-07-13-remote-plugin-status-fetch-verb-glyph-reassignment.md`
  (archives with the url-source workstream at completion; git commits
  `7def75a1`, `7f24c3db`, `121277b6` preserve every revision)
- Code seams: `extensions/pi-claude-marketplace/orchestrators/plugin/git-source-probe.ts`
  (shared classification), `orchestrators/plugin/info.ts` (INFO-05 gate),
  `orchestrators/plugin/clone-gc.ts`, `shared/notify.ts` (STATUS_TOKENS /
  PLUGIN_STATUSES / ICON constants), `shared/completion-cache.ts`
  (schemaVersion), `docs/output-catalog.md`, `docs/messaging-style-guide.md`

## Notes

Requirement summary (details in the todo file):

- RSTA-01: `(remote)` closed-set status for not-installed git-source plugins
  with no materialized clone (replaces manifest-only `(available)`).
- RSTA-02: glyph reassignment — `◌` U+25CC to (remote); disabled/`will
  disable` to `◍` U+25CD (fallback `◎`; verify terminal rendering first). No
  dotted-circle-with-fill codepoint exists in Unicode.
- RSTA-03: classification in shared git-source-probe (list + completion
  parity); plugin-index cache schemaVersion 5→6.
- RSTA-04: warm-cache fs-only component resolution in bare `info`
  (network-free).
- RSTA-05: post-fetch three-way resolver classification; D-78-04 degrade kept.
- RSTA-06: unpinned fetched-state via plugin-clones/<urlhash12>-* prefix scan
  (SC-7 chokepoint; no persisted fetch state).
- RSTA-07: `list --remote` filter flag (joins the PL-1 union family:
  --installed/--available/--unavailable/--partial); network-free; `--available`
  intentionally stops including unfetched git-source plugins.
- FTCH-01: pi-only `fetch <plugin>@<marketplace>` verb (upstream has none).
- FTCH-02: idempotent no-op at info severity (path source / warm cache).
- FTCH-03: `info --fetch` = fetch + resolve; failures degrade with existing
  closed-set reasons.
- FTCH-04: network on cache miss only (NFR-5 amendment).
- FTCH-05: fetched-uninstalled clones stay GC-sweepable; self-heal to
  (remote).
- FTCH-06 DECIDED 2026-07-13: fetch auth at parity with install
  (buildAuthForHost, once-per-host memo).

Amends INFO-05, PURL-08, NFR-5. Resolver three-way union untouched (NFR-7).
Open discuss-phase decisions: fetch granularity (recommend single plugin v1);
unpinned prefix-scan ambiguity (manifest pin wins).
