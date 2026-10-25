---
phase: 20-path-source-version-and-missing-source
plan: 01
requirements-completed: [VER-02, SRC-01]
status: complete
---

# 20-01 Summary: path-source version and missing source

## What changed

- `list-candidate-row.ts`: a path-source candidate row whose resolver yields a
  plugin root (`installable`, `partially-available`) shows
  `resolveDeclaredPluginVersion` -- plugin.json's version, then the entry's
  (D-02). An `unavailable` row keeps the entry version.
- `info.ts::buildNotInstalledRow`: the same rule for the `available` and
  `partially-available` rows of a not-installed path plugin (D-03).
- `shared/probe-classifiers.ts`: new exported `SOURCE_DIR_MISSING_NOTE` and a
  `classifyResolverNote` arm mapping the resolver's
  `source dir does not exist` note to `source missing`; `ResolverNoteReason`
  widens by that token (D-06).
- `install.messaging.ts::classifyResolverReason`: the same arm, placed before
  the `includes("source")` catch-all, so install reads `{source missing}` too.
- Scenarios: `list.feature` (declared path version; `{source missing}` row;
  a fetched not-installed git plugin whose entry declares no version shows
  plugin.json's version), `info.feature` (declared version;
  `{source missing}`), `install.feature` (records plugin.json's version over
  the entry's; a missing directory reads `(unavailable) {source missing}`).

## Verification

- Unit suites for the four sources and `cross-surface-reason-parity` pass;
  new tests cover the declared-over-entry path version on available and
  partially-available rows, the entry version on an unavailable row, and the
  note arm on both classifiers.
- With the four source files reverted, 5 of the 7 new scenarios fail (the
  version and `source missing` ones). The fetched-git list scenario and the
  install-version scenario pass on the old code: they pin behavior VER-01
  already delivered (D-05, D-08).
- `npx cucumber-js features/plugin/{list,info,install}.feature`: 49/49.

## Deviations

- Install of a missing path plugin renders the existing
  `(unavailable) {source missing}` row, not a `(failed)` row: install already
  reports a structurally unavailable plugin that way (unchanged).
- The plan, execution, and summary were done inline by the phase session
  rather than by separate planner and executor agents: the phase is one plan
  of four small source edits.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.
