# Phase 81: Fetch verb & info --fetch - Context

**Gathered:** 2026-07-14
**Status:** Ready for planning

<domain>
## Phase Boundary

The pi-only `fetch` verb — warming a git-source plugin's clone/mirror cache without installing — in all three shapes (`fetch <plugin>@<marketplace>`, `fetch @<marketplace>`, bare `fetch` across all marketplaces), plus `info --fetch` (fetch then resolve in one step). Covers FTCH-01..07 (FTCH-07 promoted from v2 at this discuss). Fetched-but-uninstalled clones stay GC-sweepable and self-heal to `(remote)` (Phase 80's classification); no persisted fetch state anywhere.

Post-79.1 semantics: fetch on an unpinned source = refresh the mutable mirror (marketplace-update parity, `materializeOrRefreshPluginMirror`); fetch on a pinned source = materialize the per-sha clone (`materializePluginClone` warm short-circuit = no-op). Path sources have nothing to fetch (no-op).

</domain>

<decisions>
## Implementation Decisions

### Fetch shapes (FTCH-07 promoted to v1)
- **D-81-01:** ALL THREE shapes ship in this phase (operator decision, overriding the seed's single-plugin-only proposal): `fetch <plugin>@<marketplace>` (single), `fetch @<marketplace>` (marketplace-wide), bare `fetch` (all marketplaces). Bulk sweeps act on the fetchable set — `(remote)` plugins (materialize) and unpinned-warm plugins (mirror refresh); pinned-warm and path sources are no-ops. A per-plugin fetch failure never aborts the sweep.

### Output grammar
- **D-81-02:** Fetch success renders the plugin's POST-FETCH derived status row — exactly what `list`/`info` now show for it (`(available)` / `(partially-available)` / `(unavailable)` from the three-way resolver on the fresh warm tree). Derive-not-persist: no `fetched` token exists and none is added (closed sets do not grow — the Phase 80 amendment was this milestone's only closed-set change). No-ops render `(skipped)` + an existing closed-set reason at info severity (update-verb no-op parity; `up-to-date` is the natural member for a warm cache — planner picks within the existing REASONS set). Bulk output at bulk-update grammar parity: marketplace headers, per-plugin rows, summary line prepended to error/warning cascades per the established grammar. No new REASONS members (FTCH-03), no new output machinery.

### Completion
- **D-81-03:** `fetch <tab>` offers `(remote)` + unpinned-warm git-source plugins (the set fetch meaningfully acts on); pinned-warm and path sources excluded (pure no-ops — still accepted if typed, rendering the no-op row). `fetch @<tab>` offers marketplace names.

### info --fetch (locked by FTCH-03)
- **D-81-04:** `info --fetch <plugin>@<marketplace>` fetches then resolves and lists components. A fetch failure degrades to the normal info row with `components: not resolved` + an existing closed-set reason (e.g. `network unreachable`) and NEVER fails the info command. Bare `info` stays network-free.

### Network & auth (locked)
- **D-81-05:** Network on cache miss only (FTCH-04; for unpinned sources the mirror refresh IS the consented fetch); auth at install parity — `buildAuthForHost`, once-per-host memo, PROV-02/03/04 semantics (FTCH-06, DECIDED 2026-07-13, do not re-litigate).

### Claude's Discretion
- Where the fetch orchestrator sits relative to the `no-orchestrator-network` architecture gate: either exempt like `update.ts` (Pattern S-9) or git-free via the `cloneCacheSeam` injection like `install.ts` — researcher/planner pick whichever keeps the gate honest with the smaller exemption surface.
- Exact `(skipped)` reason member selection per no-op case, within the existing REASONS set.
- Bulk iteration order and header grouping — follow the bulk-update precedent exactly.
- Whether `fetch` gets a catalog section of its own in `docs/output-catalog.md` (it must — new verb = new catalog rows; wording follows catalog prose style) and the docs/README note documenting fetch as a pi-only extension (FTCH-01: upstream `/plugin` has no fetch verb, verified 2026-07-13).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & roadmap
- `.planning/workstreams/url-source/REQUIREMENTS.md` — FTCH-01..07 (FTCH-07 promoted to v1), constraints
- `.planning/workstreams/url-source/ROADMAP.md` — Phase 81 section with resolved discuss decisions
- `.planning/workstreams/url-source/todos/pending/2026-07-13-remote-plugin-status-fetch-verb-glyph-reassignment.md` — SEED-001 (FOLDED into this phase; auto-closes at completion)

### Cache seams to drive (shipped 79.1 + 77)
- `extensions/pi-claude-marketplace/orchestrators/plugin/clone-cache.ts` — `materializeOrRefreshPluginMirror` (unpinned), `materializePluginClone` (pinned, warm short-circuit), `resolvePluginPin`, `canonicalCloneUrl`
- `extensions/pi-claude-marketplace/orchestrators/plugin/install.ts` — `cloneCacheSeam` injection pattern + `buildAuthForHost` consumption (the auth-parity template)
- `extensions/pi-claude-marketplace/orchestrators/plugin/update.ts` — the gitOps-exempt orchestrator precedent (Pattern S-9) + bulk-update grammar (headers/rows/summary)
- `extensions/pi-claude-marketplace/orchestrators/plugin/git-source-probe.ts` — presence probe + post-fetch classification (Phase 80's warm-tree three-way)

### Output discipline
- `extensions/pi-claude-marketplace/shared/notify.ts` — closed sets (REASONS ~89, STATUS_TOKENS, PLUGIN_STATUSES); no growth this phase
- `docs/output-catalog.md` + `docs/messaging-style-guide.md` — new fetch verb rows land here
- `tests/architecture/no-orchestrator-network.test.ts` — the gate that decides where fetch's git surface lives

### Edge / completion
- `extensions/pi-claude-marketplace/shared/completion-cache.ts` — status literals incl. `remote` (schemaVersion 6)
- `extensions/pi-claude-marketplace/orchestrators/edge-deps.ts` + edge handlers — verb registration, flag parsing, completion buckets

### Project rules
- `.claude/rules/typescript-comments.md` — comment policy

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `materializeOrRefreshPluginMirror` / `materializePluginClone` — fetch IS these seams driven by a new verb; no new cache machinery.
- `buildAuthForHost` + once-per-host memo — auth parity for free.
- Bulk-update grammar (update verb) — headers, per-plugin rows, failure-tolerant sweep, summary lines.
- Phase 80's `probeManifestEntry` warm-tree classification — the post-fetch status row derivation.

### Established Patterns
- Tri-state severity: fetch reaching desired state (warm cache) = info; carried-out-but-short (partial bulk failures) = warning with summary line; not-carried-out (single fetch failure) = error.
- Derive-not-persist: no fetch registry; `plugin-clones/` contents ARE the state; GC sweeps unreferenced clones and status self-heals to `(remote)` (FTCH-05).
- Subject-first row grammar; summary line before error/warning cascades.

### Integration Points
- New verb registration at the edge (parser, usage, completion) alongside install/update/uninstall.
- `info.ts` `--fetch` flag → fetch-then-resolve path reusing Phase 80's warm resolution.
- `docs/output-catalog.md` gains the fetch verb's rows; README/docs note the pi-only extension.

</code_context>

<specifics>
## Specific Ideas

- Fetch's output should read as "here is what you now have" — the post-fetch status row IS the receipt (no celebratory new grammar).
- Upstream `/plugin` has no fetch verb (verified code.claude.com/docs 2026-07-13) — document explicitly as a pi-only extension.

</specifics>

<deferred>
## Deferred Ideas

None — the previously deferred bulk shapes (FTCH-07) were promoted INTO this phase by the operator.

</deferred>

---

*Phase: 81-fetch-verb-info-fetch*
*Context gathered: 2026-07-14*
