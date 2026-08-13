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

## MRO-01: mode-aware structured output via `ctx.mode` and `pi.appendEntry`

Surfaced during the 2026-08-10 competitive analysis of `@nklisch/pi-plugins`
(`docs/competitive-analysis/pi-plugins.md`, recommendation #11). Verified
2026-08-13 directly against our own pinned `@earendil-works/pi-coding-agent`:
every `ExtensionContext` carries a real `mode: "tui" | "rpc" | "json" |
"print"` field, set by how the user invoked Pi (`pi` interactive, `pi -p`,
`pi --mode json`, or the RPC stdin/stdout protocol). We never read it. Our
sole output primitive, `ctx.ui.notify(message: string, type?)`, takes a plain
formatted string and a severity -- no structured-payload slot.

A user driving `/claude:plugin` through `pi --mode json` or RPC gets the same
human-formatted string wrapped in a JSON envelope today, not real
machine-readable data. `@nklisch/pi-plugins` solved this on the low-level
`pi.appendEntry<T>(customType, data)` primitive -- confirmed present in our
own pinned Pi version too, under "Append a custom entry to the session for
state persistence (not sent to LLM)". Their `pi-control-channel.ts` keys
output by mode: rpc/json modes emit `appendEntry` frames, print mode writes
stdout lines, tui is a no-op. A versioned grammar, closed exit-code
vocabulary, and pagination sit on top of that channel, none of which are
scoped here.

Direction for later: design a structured shape for the existing
`NotificationMessage` / `PluginInfoRow` discriminated types in
`shared/notify.ts` (most of the shape work already exists), and emit it via
`pi.appendEntry` when `ctx.mode` is `"json"` or `"rpc"`, alongside (not
instead of) the existing human `notify()` line.

Code seams: `shared/notify.ts` (message shapes), `platform/pi-api.ts`
(re-exports `ExtensionContext`), `edge/router.ts` (the `/claude:plugin`
command entry point every handler's `ctx` flows through).

<!--
Pruned 2026-06-08: both prior items shipped in v1.10 Error Attribution.
- "Install error misattribution when marketplace is missing" -> closed by ATTR-01..10
  (every op converges on the marketplace-subject `{not added}` model; see
  tests/orchestrators/plugin/install.test.ts "ATTR-01").
- "Structural `{not added}` variant for `PluginInfoMessage`" -> closed by TYPE-01..04
  (dedicated `marketplace-not-added` kind in shared/notify.ts; placeholder/sole-reason
  renderer carve-out removed).
-->
