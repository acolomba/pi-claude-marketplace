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

<!--
Pruned 2026-06-08: both prior items shipped in v1.10 Error Attribution.
- "Install error misattribution when marketplace is missing" -> closed by ATTR-01..10
  (every op converges on the marketplace-subject `{not added}` model; see
  tests/orchestrators/plugin/install.test.ts "ATTR-01").
- "Structural `{not added}` variant for `PluginInfoMessage`" -> closed by TYPE-01..04
  (dedicated `marketplace-not-added` kind in shared/notify.ts; placeholder/sole-reason
  renderer carve-out removed).
-->
