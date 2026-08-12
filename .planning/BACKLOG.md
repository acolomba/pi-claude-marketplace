# Backlog

Ideas surfaced during planning that are deferred from active scope but worth retaining for future milestones.

## UAT-02: reconcile cascade invisible on `/reload` (host TUI limitation)

Surfaced by v1.12 milestone runtime UAT (2026-06-11). The load-time reconcile
cascade (RECON-04) is emitted correctly via `ctx.ui.notify`, and IS visible at
Pi startup -- but on `/reload`, pi's `handleReloadCommand` calls
`rebuildChatFromMessages()` after `session.reload()`, reconstructing the chat
from the LLM transcript only. Extension notifications (any severity) emitted
during the reload pipeline are erased. `@earendil-works/pi-coding-agent` is not
our fork; operator decided (2026-06-11) NOT to file an upstream issue for now.

Candidate directions for later brainstorming:
- queue-and-flush: stash the cascade when `reason === "reload"`, emit on the
  next extension event with a live UI (deterministic but late-arriving)
- persistent `ui.setWidget` badge summarizing the last reconcile
- upstream change: re-append extension notifications after the chat rebuild
- do nothing: results remain verifiable via `/claude:plugin pending` / `list`

Workaround today: run `/claude:plugin pending` before reloading, or `list` after.

## REASON-01: unify malformed-input failures under a "malformed X" reason family

Surfaced during v1.14 Phase 85 discuss (2026-07-22). The `UNSUPPORTED_REASONS`
tokens (`unsupported hooks`, `lsp`, `unsupported source`) semantically mean a
*well-formed but unsupported component KIND* -- lsp / monitors / themes / etc.,
whose content the resolver never parses. Malformed input to a *supported*
feature is a different axis (a parse / structural defect) and belongs with the
failure family, parallel to `{invalid manifest}` and `{unparseable}`.

Two existing cases mislabel that axis:
- inline malformed `mcpServers` -> `{unsupported source}` (the `narrowResolverNotes` catch-all)
- malformed `hooks.json` (invalid JSON / schema) -> `{unsupported hooks}`

Phase 85 introduces the correct token `{malformed mcp}` for a broken/malformed
mcpServers *string reference*, but deliberately leaves the two cases above
unchanged (existing behavior, out of scope for this milestone).

Direction for later: introduce a consistent `{malformed <feature>}` failure-class
family and reroute the mislabeled supported-feature parse failures to it. Requires
re-auditing `narrowResolverNotes`, which currently forces every resolver note into
the unsupported family -- parse / structural notes need to reach failure-class
tokens (the `narrowProbeError` path already does this for I/O errors).

## RSTA/FTCH: `(remote)` plugin status, `fetch` verb, and glyph reassignment

Promoted from `SEED-001` at the v1.18 close (2026-08-12). Planted 2026-07-13
during the url-source milestone; its trigger was "next milestone planning".

`info` on a git-source plugin renders `components: not resolved`, so a user
cannot tell whether a plugin will install. `list` and completion classify
unfetched git-source plugins `(available)` straight from the manifest, which
over-claims -- nothing is validated until the clone is materialized. The fix is
a coherent status model (an honest `(remote)` state), a `fetch` verb that warms
the clone cache early, and fs-only warm-cache resolution that closes the biggest
gap (installed git-source plugins) with no network-policy change.

Ready-made requirement set, consistency-checked 2026-07-13. Estimated 2-3 phases:
(a) status token + glyph reassignment + probe reclassification + cache schema
bump, (b) fetch orchestrator + `info --fetch` + warm-cache info resolution,
(c) catalog/docs rows.

- RSTA-01: `(remote)` closed-set status for not-installed git-source plugins
  with no materialized clone (replaces the manifest-only `(available)`).
- RSTA-02: glyph reassignment -- `◌` U+25CC to (remote); disabled / `will
  disable` to `◍` U+25CD (fallback `◎`; verify terminal rendering first). No
  dotted-circle-with-fill codepoint exists in Unicode.
- RSTA-03: classification in the shared git-source probe (list + completion
  parity); plugin-index cache schemaVersion 5 -> 6.
- RSTA-04: warm-cache fs-only component resolution in bare `info` (network-free).
- RSTA-05: post-fetch three-way resolver classification; D-78-04 degrade kept.
- RSTA-06: unpinned fetched-state via `plugin-clones/<urlhash12>-*` prefix scan
  (SC-7 chokepoint; no persisted fetch state).
- RSTA-07: `list --remote` filter flag, joining the PL-1 union family
  (`--installed` / `--available` / `--unavailable` / `--partial`); network-free.
  `--available` intentionally stops including unfetched git-source plugins.
- FTCH-01: pi-only `fetch <plugin>@<marketplace>` verb (upstream has none).
- FTCH-02: idempotent no-op at info severity (path source / warm cache).
- FTCH-03: `info --fetch` = fetch + resolve; failures degrade with the existing
  closed-set reasons.
- FTCH-04: network on cache miss only (NFR-5 amendment).
- FTCH-05: fetched-uninstalled clones stay GC-sweepable; self-heal to `(remote)`.
- FTCH-06: fetch auth at parity with install (`buildAuthForHost`, once-per-host
  memo). Decided 2026-07-13.

Amends INFO-05, PURL-08, NFR-5. The resolver three-way union is untouched
(NFR-7). Two decisions remain for discuss-phase: fetch granularity (single
plugin recommended for v1) and unpinned prefix-scan ambiguity (manifest pin
wins).

Code seams: `orchestrators/plugin/git-source-probe.ts` (shared classification),
`orchestrators/plugin/info.ts` (INFO-05 gate), `orchestrators/plugin/clone-gc.ts`,
`shared/notify.ts` (STATUS_TOKENS / PLUGIN_STATUSES / ICON constants),
`shared/completion-cache.ts` (schemaVersion), `docs/output-catalog.md`,
`docs/messaging-style-guide.md`. Full revision history in git commits `7def75a1`,
`7f24c3db`, `121277b6`.

## COV-01: coverage exclusion policy, and the two out-of-bound orchestrators

Promoted from the 2026-08-10 todo at the v1.18 close (2026-08-12). Both parts sit
outside the D-99-05b bound (update / reinstall / install only), which is why the
bounded sweep could not carry them.

**The premise has already narrowed.** A fresh unit-coverage run on 2026-08-10
measured `orchestrators/edge-deps.ts` at **100%** line coverage, against the
49.7% capture from 2026-06-12 that raised the question. Whatever landed between
the two captures answered it by measurement: no exclusion is needed there, and
adding one now would exclude a module that already carries real tests.

**1. The exclusion policy itself.** Record the reasoning, not only the verdict,
because the next low-coverage wiring module raises the same question. A
`sonar.coverage.exclusions` entry raises the reported percentage without
executing one additional line -- the excluded file's uncovered arms stay
uncovered, they merely stop being counted. That trades a true statement about the
tree for a flattering one, and it does it silently: a later reader sees a high
number and infers safety the tests do not provide. An exclusion is defensible
only for code that cannot regress in a way tests would catch (generated files,
type-only declarations). Wiring glue does not qualify -- a mis-wired dependency
is exactly the defect an integration test catches. So the default answer is
tests, and any exclusion must carry its justification in
`sonar-project.properties` next to the entry.

**2. The two remaining orchestrators.** `import/execute.ts` (59 uncovered lines,
94.53%) and `marketplace/update.ts` (50 uncovered, 95.49%) were named by the
original carrier. Their uncovered remainder is the same shape the bounded sweep
worked -- rare-failure and cascade-diagnostic arms. Decide whether they get a
follow-on bounded sweep or are accepted as-is. Do not decide it by exclusion.

<!--
Pruned 2026-06-08: both prior items shipped in v1.10 Error Attribution.
- "Install error misattribution when marketplace is missing" -> closed by ATTR-01..10
  (every op converges on the marketplace-subject `{not added}` model; see
  tests/orchestrators/plugin/install.test.ts "ATTR-01").
- "Structural `{not added}` variant for `PluginInfoMessage`" -> closed by TYPE-01..04
  (dedicated `marketplace-not-added` kind in shared/notify.ts; placeholder/sole-reason
  renderer carve-out removed).
-->
