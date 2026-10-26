---
quick_id: 261026-glv
status: complete
date: 2026-10-26
---

# Quick task 261026-glv summary

- Upstream (Claude Code 2.1.310 binary, 2026-10-26):
  - Update (`updatePluginOp`): with no tag (`ae` unset) it is `up_to_date`
    only when `B.version === qe` (or the install path matches); the write
    `pDr(..., ae?.version, ...)` reaches `MYn`, which runs
    `if (w !== void 0) we.resolvedVersion = w; else delete
    we.resolvedVersion`. So a record at a tag's commit moves once to the
    version without the commit and loses `resolvedVersion`; the next
    update compares equal strings.
  - Plugin directory, install: `mCo` sets `xe = e.endsWith("@" + Sn)`
    (`Sn = "anthropic-plugin-directory"`) and `Ge = xe ? void 0 : y`. The
    cascade (`qs`) never calls `IOr` for such a member: `if
    (ii.endsWith("@" + Sn)) Wa = Ga.range === "*" ? void 0 : Ga.range`,
    passed as `mCo`'s `be`. After the fetch, `if (be !== void 0 &&
    !zXn(ft.manifest.version, be)) throw new rNe(ft.manifest.version)`,
    where `zXn` is `valid ?? coerce`, then `satisfies`, and an absent
    version fails. The cascade maps `rNe` to `directory-pin-unsatisfied`,
    rolls back (`vs()`), and reports `"<name>" from the ${Hr} is pinned to
    its listed commit (version <v> | no version), which does not satisfy
    <ranges> required by "<plugin>".`, with `Hr = "Anthropic Directory"`
    and failure code `dependency_pinned_version_unsatisfied`.
  - Plugin directory, update: `if (Y !== null && v.range !== "*" &&
    !b.endsWith("@" + Sn))` guards `IOr`. With no tag, the post-fetch guard
    reads `fn = Ae.manifest?.version` (`valid ?? coerce`) and skips with
    `pinner_blocked` when a dependent's range rejects it.
- This extension (33c9ac69):
  - `isSameRevision` takes `{ resolvedVersion, searched }`. A candidate
    from a verb that lets a range pick a tag (`update`, autoupdate,
    install's moves) and selects none compares the recorded string, so
    `update` rewrites `2.0.0-<commit>` to `2.0.0` and drops
    `resolvedVersion`; `apply` (D-23, no tag listing) and convergence
    still read the two as one version, so `apply` never undoes `update`.
  - `isPluginDirectoryMarketplace` gates both tag chokepoints: the update
    gate (`evaluateUpdateConstraint`, which serves update, autoupdate,
    reinstall and the UPD-DEP-D1 moves) admits the range unpinned, and the
    install cascade (`resolveOneMember`, which serves install, import,
    MISS-01 and the plan's fresh nodes) carries a `directoryPin` to the
    ledger instead of probing. The install preflight checks the copy's
    `plugin.json` version and throws `DirectoryPinUnsatisfiedError` with
    Claude Code's message, reported as `{version conflict}` (catalog state
    `dependency-directory-pin-unsatisfied`). `apply` lists no tags anyway.
  - `withoutTagCommit` makes `rangeVersionOf`, the post-fetch guard,
    `plannedRangeVersion` and the plan's recorded nodes read a pinned
    directory plugin (`1.0.0-<pin 12>`) as its declared `1.0.0`, as
    Claude Code reads `manifest.version`.
- Old records: a record at a tag's commit, written by 2638b001, moves once
  on its next `update` when no range picks its tag any more, with an
  `(updated)` row from `<v>-<commit 12>` to `<v>`; then it is stable. A
  record that a range still holds at its tag is unchanged, as before. A
  pinned directory plugin recorded before this change keeps its record; a
  range now reads it by its declared version. A directory dependency
  installed earlier at a tag stays until its next update, which moves it
  to the listed copy when that copy satisfies the range, or holds it.
- Divergences kept: `list` and completion still read `<v>-<commit 12>` at
  the recorded commit as `<v>` (they read no tags, so they cannot tell
  whether a range still picks it). The MISS-01 refusal names no requirer,
  because the reload's root carries its requirer outside the cascade.
  Claude Code's update short-circuits a pinned directory listing at the
  recorded commit before its range guard; this extension runs the guard.
- Cucumber: six new scenarios fail on f1ba9adf (`git archive` under the
  scratchpad, `node_modules` symlinked, unchanged step definitions), each
  in a `Then`, and pass on Node 22.22.2, 24.22.1 and 26.12.1.
- `npm run check` at 33c9ac69 exits 0 (898 scenarios; direct coverage 291
  records).

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.
