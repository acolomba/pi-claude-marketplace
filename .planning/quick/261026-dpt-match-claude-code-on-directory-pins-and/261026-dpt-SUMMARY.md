---
quick_id: 261026-dpt
status: complete
date: 2026-10-26
---

# Quick task 261026-dpt summary

- Upstream (Claude Code 2.1.310 binary, 2026-10-26):
  - Update (`updatePluginOp`): after the range intersection (`cWt`,
    `pinner_blocked` when disjoint) and before any fetch, `let an =
    AZ(b, k.source); if (an !== void 0 && (D || B.gitCommitSha === an))`
    returns `up_to_date` with `Yn(ce, N)`, "<name> is already at the
    latest version (<recorded>)." (`noCloneShortCircuit`). `AZ` returns
    the entry's `sha` only for `@anthropic-plugin-directory`. The
    post-fetch range guard comes later, so it never runs there.
  - Cascade refusal (`qs`): `"${name}" from the ${Hr} is pinned to its
    listed commit (...), which does not satisfy ${rs.join(", ")} required
    by ${(dr.get(ii) ?? []).map(quoted name).join(", ")}.` `dr` starts
    from `_Co`, the installed plugins outside the closure whose
    `depConstraints` carry a version, then gains each cascade member that
    declares one. `resolveMissingDependencies` (`bae`) installs a missing
    dependency through that cascade, so its requirers are the installed
    declarers with a range; upstream only logs the refusal there.
  - Installed versus available: the only check is the install hint
    (`Rt`/`vt`), `availableVersion !== installedVersion`, a plain string
    compare. `yi` computes `availableVersion` only for relative-path and
    `claudeai` entries; `claude plugin list` shows the version with no
    upgrade state.
- This extension (ece42b45):
  - `unchangedDirectoryPin` in `preparePluginUpdate` returns `unchanged`
    (`{up-to-date}`, no cause) for a pinned directory plugin whose listed
    commit is `resolvedSha`, after the gate's `held` and before the clone,
    under every `skipSameRevision` policy (update, autoupdate, apply's
    converge, UPD-DEP-D1 moves). `reinstall` re-materializes. A GV-02
    record whose version lacks the pin still moves once.
  - `PlannedDependencyInstall.requirers` keeps the ranged declarers;
    `apply` passes them, the cascade's `rootRequiredBy` reaches the root's
    `directoryPin.requiredBy` (now a list), and the message names each.
    `apply` maps `DirectoryPinUnsatisfiedError` to `{version conflict}`
    with the message as cause (it was `{unreadable}` with no cause).
  - `list-installed-row` and `edge-deps` compare the recorded string;
    convergence and `pending`/`apply` keep D-23.
- Still differs: `list` reports upgradable for git sources too (PL-5),
  where Claude Code shows nothing; a non-root cascade member names only
  the first declarer that reached it, where Claude Code names every
  member that declared a range; Claude Code truncates names and ranges at
  120 characters, this extension bounds ranges its own way; MISS-01 shows
  a failed row where Claude Code only logs.
- Cucumber: three new scenarios fail on 6c0eaf69 (`git archive` under the
  scratchpad, `node_modules` symlinked, unchanged step definitions), each
  in a `Then`, and pass on Node 22.22.2, 24.22.1 and 26.12.1.
- `npm run check` at ece42b45 exits 0 (901 scenarios; direct coverage 291
  records).

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.
