# Backlog

Ideas surfaced during planning that are deferred from active scope but worth retaining for future milestones.

## Manifest cache (NFR-8)

**Tracked in:** REQUIREMENTS.md NFR-8 (v1 pending) + PRD §11 backlog.
Phase 7 lands the seam (single chokepoint where `marketplace.json` is read) so a future caching layer can wrap it without orchestrator changes.

## Install error misattribution when marketplace is missing

**Surfaced by:** 2026-06-03 v1.8 scoping discussion.

When `/claude:plugin install foo@bar` is invoked and marketplace `bar` does not exist, current output is:

```text
Error: 1 plugin operation failed.

 ● bla [user]
   ⊘ bla (failed) {not in manifest}
     cause: Plugin "bla" not found in marketplace "bla".
```

The reason `{not in manifest}` and the cause string both blame the plugin, but the real blocker is the missing marketplace. Should instead report the marketplace as missing -- likely a new reason in the closed set (`{marketplace not added}` or similar) on a `(failed)` plugin row, or a bare failed marketplace header. The same misattribution likely applies to `uninstall`, `reinstall`, `update`, and the `info` commands once they land. Decide the canonical shape during the v1.8 `info` planning since both surfaces share the precondition check.

## Structural `{not added}` variant for `PluginInfoMessage`

**Surfaced by:** 2026-06-04 `/pr-review-toolkit:review-pr` follow-up on v1.8 info-command work (finding IM-1).

The `{not added}` scope-mismatch row is currently expressed as a `PluginInfoMessage` with a runtime-only invariant: the renderer's `renderPluginInfo` carve-out fires when `status === "failed" && reasons.length === 1 && reasons[0] === "not added"`, and emits the bare row with no marketplace header. Both info orchestrators construct this shape with placeholder `marketplaceScope: opts.scope ?? "user"` and `marketplaceDetails: { autoupdate: false }` values that are "never rendered" but typed identically to the standard-path fields.

The type currently allows `reasons: ["not added", "permission denied"]` and other invalid mixes. The runtime sole-reason length-1 guard catches them at render time, but the placeholder pattern is a foot-gun: if a future contributor relaxes the renderer predicate, the placeholders leak into output.

Split `PluginInfoMessage` into two variants:

- `PluginInfoScopeMismatchMessage { kind: "plugin-info-scope-mismatch", name: string, scope?: Scope }` -- only the fields the bare-row render actually consumes.
- `PluginInfoStandardMessage { kind: "plugin-info", marketplaceName, marketplaceScope, marketplaceDetails, plugin }` -- the always-marketplace-header form.

Required changes:

1. Add the 6th arm to `NotificationMessage` union; update `_Assert_NotifFiveArms` to `_Assert_NotifSixArms`.
2. Add a new renderer (or extend `renderPluginInfo`) that dispatches on the new kind; remove the runtime sole-reason carve-out.
3. Update `notify()`, `computeSeverity`, `shouldEmitReloadHint`, `buildSummaryLine`, and `dispatchInfoMessage` to handle the new arm (each currently short-circuits on the 4 info kinds; add a 5th).
4. Update `orchestrators/marketplace/info.ts::buildNotAddedMessage` and `orchestrators/plugin/info.ts`'s `(a)` branch to construct the new variant -- placeholder fields disappear from the construction sites.
5. Update tests: `tests/architecture/notify-types.test.ts` (union arity assertions + new shape assertion), `tests/shared/notify-v2.test.ts` (catalog states for the new kind), `tests/orchestrators/{marketplace,plugin}/info.test.ts` (carve-out assertions move to the new kind), `tests/architecture/catalog-uat.test.ts` (16 info catalog states may need re-keying).

Non-blocking -- the runtime guard works. Eliminates a foot-gun the placeholder code already telegraphs.
