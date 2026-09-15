---
status: testing
phase: 03-dependency-resolution
source: [03-VERIFICATION.md]
started: 2026-09-15T00:00:00Z
updated: 2026-09-15T00:00:00Z
---

## Current Test

number: 2
name: Resolve a constrained dependency against a real git host
expected: |
  `listRemoteTags` reads the real wire protocol's tag advertisement and peels
  an annotated tag to its commit; a private source's credential challenge is
  answered by the existing host credential bundle with no separate prompt.
awaiting: a real remote carrying `<pluginName>--v<semver>` release tags

## Tests

### 1. Read the rendered cascade block in a live Pi session

Install a plugin that declares dependencies against a real Claude marketplace
over the network, and read the rendered cascade block in a live Pi session.

expected: One legible row per cascade member beside the requesting plugin's row; wrapping is readable; row ordering makes sense against a closure longer than two members; a failure's remedy sentence (e.g. `Run marketplace add <source> to add it.`) is a sentence an operator would actually act on.
why_human: Every case in the cascade messaging test drives a seeded fixture or a composed row through a fake host. No fixture settles subjective legibility, wrapping, or whether prose reads as actionable — that is a judgment call requiring a human reading real terminal output (03-06 SUMMARY D10, human_judgment: true).
result: passed

**Run on 2026-09-15**, operator-executed, in an isolated Pi home
(`scripts/pi.sh --home tmp/pi-uat --cd tmp/work`) against a local path-source
fixture marketplace (`tmp/uat-marketplace`, gitignored, retained for re-runs).
Five fixture plugins, each declaring its dependencies ONLY in its own
`plugin.json` — so this run also exercised the manifest-first declaration read,
not just the cascade.

Observed and accepted:

- `install alpha` over a closure of three with a diamond (`alpha` → `beta`,
  `gamma`; `beta` → `gamma`) rendered one legible row per member.
- `gamma`, installed beforehand, rendered `(skipped) {already installed}` —
  visibly distinct from the freshly installed members (RESV-05).
- **`/reload` then `list` kept `alpha`, `beta` and `gamma` installed.** This is
  the load-bearing RESV-01 reload clause, confirmed against the running system.
  Before the CR-01 fix `buildUninstallBucket` would have swept the two
  dependencies on exactly this reload.
- A dependency in a never-added marketplace failed with
  `{dependency marketplace not added}` and a remedy naming both the marketplace
  and the command (RESV-06).
- An unsatisfiable constraint against an already-installed copy failed with
  `{already installed, version conflict}`, naming the recorded version and the
  constraint (RESV-03).

Two things checked during the run and found NOT to be defects:

- A `cause:` line appearing inline in a pasted transcript was a terminal
  copy artifact; the operator confirmed correct formatting on screen, and the
  23 byte-equality cases plus the 4 catalog-contract cases independently pin
  the composed bytes.
- Cascade rows sort by `compareByNameThenScope`, so whether the dependency row
  precedes the requesting plugin's row depends on their names. This was
  considered and accepted: that comparator is the project-wide canonical row
  order used by 11 modules, and ordering the cascade block cause-first would
  make it the one block in the product that sorts differently.

### 2. Resolve a constrained dependency against a real git host

List a real repository's tags (including at least one annotated tag), and drive
a private-repository credential challenge through the tag probe.

expected: `listRemoteTags` (platform/git.ts) correctly reads the real wire protocol's tag advertisement and peels an annotated tag to its commit; a private source's credential challenge is answered by the existing host credential bundle with no separate prompt.
why_human: Every `dependency-tag-probe.test.ts` and `git.test.ts` case in this phase drives a faulted/fake transport double, never a live `isomorphic-git` wire exchange. The real `listServerRefs({ prefix, peelTags })` behavior against a real remote, and a real credential challenge, are unobserved (03-04 SUMMARY D8, 03-05 SUMMARY D12, both human_judgment: true).
result: [pending]

## Summary

total: 2
passed: 1
issues: 0
pending: 1
skipped: 0
blocked: 0

## Gaps

**Test 2 is unexercised, not verified.** Live tag listing, annotated-tag
peeling on the wire, and a real private-repository credential challenge have
never been run. Every `dependency-tag-probe.test.ts` and `git.test.ts` case in
this phase drives a fake transport. Closing this needs a real remote carrying
`<pluginName>--v<semver>` release tags.

**Side finding from UAT 1 preparation, worth carrying to milestone close.**
`anthropics/claude-plugins-official` was fetched and inspected: **zero of its
297 plugins declare dependencies in their marketplace entry.** All 297 use
remote sources (`git-subdir`, shorthand, or `url`), so any declaration in a
plugin's own `plugin.json` is only readable after that plugin is materialized.
The cascade therefore has no consumer in the official marketplace today. That
is not a defect in this phase — it is why the manifest-first declaration read
matters, since a plugin's own manifest is the only place these declarations can
currently appear — but it does mean the feature ships without real-world
exercise beyond the local fixture.
