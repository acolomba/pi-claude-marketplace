---
quick_id: 261030-ogp
status: complete
---

# Quick 261030-ogp: bootstrap runs only marketplace add

`/claude:plugin bootstrap` no longer runs the `marketplace autoupdate` step after its add. The official name already has autoupdate on by default (D-PL8-07), so a fresh bootstrap writes the same config as before. A re-run on an added `claude-plugins-official` whose `claude-plugins.json` sets `autoupdate: false` now keeps it off, and reports only `(skipped) {already added}`.

## Changes

- `orchestrators/plugin/bootstrap.ts`: drops the `setMarketplaceAutoupdate` call. A failed add still renders through `notifyAddFailure`, and a missing-dependency throw after the add commits still reaches the handler as `BootstrapStepError`.
- Help text: `bootstrap` reads "add anthropics/claude-plugins-official to user scope".
- Unit tests drop the autoupdate rows; the off-autoupdate case now asserts the config bytes are unchanged; the autoupdate-child failure case is gone with the step.
- `features/plugin/bootstrap.feature`: new scenario for the user's off setting, which fails against the old bootstrap; the other scenarios lose the `{already autoupdate}` row.
- `docs/output-catalog.md` and `CHANGELOG.md` updated. `README.md` is not touched (line 458 still says bootstrap "makes sure autoupdate is on").

## Finding: marketplace remove

`marketplace remove` (user-run) deletes the whole marketplace entry, `autoupdate` included, from both `claude-plugins.json` and `claude-plugins.local.json` (`commitFullRemove` -> `cascadeRemoveFromLayer` -> `deleteMarketplaceConfigEntryWithCascade`). So remove-then-bootstrap does not revive an old `false`. An `apply`-driven remove skips the write-back, because the config it reconciles from no longer declares the marketplace.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.
