---
quick_id: 261026-gvt
status: complete
date: 2026-10-26
---

# Quick task 261026-gvt summary

- Upstream (Claude Code 2.1.310 binary, 2026-10-26):
  - Install (`mCo`, 6th argument `y`): `Ge = xe ? void 0 : y`, where `xe`
    is a plugin of `anthropic-plugin-directory`. The closure's
    `materializeOne` passes `y` for any member, the root included, whose
    combined dependents' range is not `*`, found by `IOr` over
    `ls-remote --tags` for `<name>--v<semver>` (the peeled `^{}` oid, so
    the tag's commit). A relative-path entry becomes a `git-subdir`
    source of the marketplace repository (`POr`).
  - Recorded string: `Yt = Ge && (manifest.version || entry.version) ?
    vqt(Jt, Ge.sha) : Jt`, with `vqt(e,n)` appending
    `-${n.substring(0,12)}` once. `Jt` is the usual version (`pne`),
    computed with `Ge.sha`, so a plugin that declares none records the
    tag commit's version. The record also gets
    `resolvedVersion: Ge.version`, which the schema describes as the
    "Tag-derived semver ... Used by verifyAndDemote in preference to
    manifest.version".
  - Update (`updatePluginOp`): the same rule, `qe = ae && (...) ?
    vqt(Qe, ae.sha) : Qe`, and `up_to_date` when
    `ue.version === B.resolvedVersion && ue.sha === B.gitCommitSha`. The
    write (`MYn`) sets `resolvedVersion`, or deletes it when no tag
    applies.
  - Range read-back: `zXn` is `valid ?? coerce`, then `satisfies`, but
    upstream never feeds it the recorded string. The load check reads
    `v?.resolvedVersion ?? v?.manifest.version`, and the install closure
    reads `Yr.resolvedVersion ?? Yr.manifest.version`. So no upstream bug:
    the suffixed string, a prerelease that `^1.2.0` rejects, is never
    measured.
- This extension (2638b001, plus the integration expectations in
  47f07189): `withTagCommit` and `tagShaVersion` in
  `domain/version.ts`, `resolveTagPinnedPluginVersion` in
  `orchestrators/plugin/shared.ts`, an optional `resolvedVersion` on the
  install record, and `rangeVersionOf` / `atCatalogVersion` in
  `persistence/state-io.ts`. Install, the plan's moves, update,
  autoupdate, apply's converge, reinstall, enable, re-enable and
  promotion write or carry it. RESV-05, UPD-DEP-D1 (graph nodes and
  ruled-out versions), the load and final verdicts read it first.
  `isSameVersion` takes the record's commit, so list, completion and
  convergence read `<v>-<commit 12>` as `<v>`.
- Old records: a record written before this change at a tag holds the
  tag's semver as its version. It reads the same against ranges, and an
  update at the same tag and commit is unchanged with no write, so no
  one-time row (GV-02). A disabled one is rewritten quietly on its next
  update, with no row.
- Divergences kept: an unpinned candidate at the commit a tag already
  records reads as unchanged, where Claude Code rewrites the record; the
  `anthropic-plugin-directory` exclusion from tag selection is a
  selection rule, outside this task.
- Cucumber: five new scenarios and four updated ones fail on 5a4099a1
  (`git archive` under the scratchpad) on the version text, and pass on
  Node 22.22.2, 24.22.1 and 26.12.1.
- `npm run check` at 47f07189 exits 0 (892 scenarios; direct coverage
  291 records).

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.
