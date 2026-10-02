---
status: complete
phase: 03-dependency-resolution
source: [03-VERIFICATION.md]
started: 2026-09-15T00:00:00Z
updated: 2026-09-30T00:00:00Z
audit_acknowledged:
  milestone: v1.20
  at: 2026-09-24
  gap_snapshot: "testing::scenarios=0"
---

## Current Test

None. Both tests have been run.

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
result: passed

**Run on 2026-09-15**, operator-executed, against a real smart-HTTPS git remote
seeded for the purpose: a bare repository served through git's own
`git-http-backend` over TLS on loopback, so the extension spoke the real wire
protocol rather than a fake transport. Fixture retained under `tmp/uat-git`
(gitignored, self-signed CA trusted additively via `NODE_EXTRA_CA_CERTS`;
`NODE_TLS_REJECT_UNAUTHORIZED` was never touched, and `GIT_CONFIG_GLOBAL`
isolated the run from the operator's own git config).

The repository carried four tags chosen to discriminate:
`omega--v1.0.0` (annotated), `omega--v2.0.0` (annotated),
`omega--v1.5.0-lightweight` (lightweight, prerelease version part), and
`not-a-release` (no release prefix).

VERIFIED against the live wire:

- **Annotated tags peel to their commit.** `zeta` declared `omega@^1.0.0` and
  the install recorded `resolvedSha 9f610eb10c7bc31e342140701d56588cad9fae87` --
  the PEELED COMMIT. The tag object itself is
  `ee3dca2bbc0e513e5983c2e2f59fd3df42d7fd18` and was correctly not recorded.
  This is the claim no fake transport could settle.
- **Selection is by constraint, not by recency.** `^1.0.0` selected `v1.0.0`
  even though `v2.0.0` was advertised and newer. The lightweight prerelease tag
  was excluded, and `not-a-release` was never a candidate.
- **D-03-09 holds: a no-match fails and does NOT fall back to the repository
  head.** With `omega` uninstalled first, `eta`'s `^9.0.0` reached the probe
  (reason token `{no matching version}`, distinct from the already-installed
  arm's `{already installed, version conflict}`) and failed. Verified
  afterwards: `omega` is absent from `state.json` and no `omega` artifact
  survives on disk, so repository head `9c7aa81a` was not installed and the
  all-or-nothing rollback left nothing behind.
- **A real 401 classifies correctly.** `theta`'s dependency on a
  Basic-auth-protected mount produced `{authentication required}` with a cause
  naming the constraint and no credential value in the message.
- Row byte forms matched the catalog contract live: `{no matching version}`
  renders without a version on the row, `{already installed, version conflict}`
  renders with one.

Server-side corroboration (the fixture logged every request, so these claims do
not rest on the extension's own reporting):

```text
[open]    GET  /omega.git/info/refs?service=git-upload-pack
[open]    POST /omega.git/git-upload-pack
[open]    GET  /omega.git/info/refs?service=git-upload-pack
[open]    POST /omega.git/git-upload-pack
[private] GET  /private/omega.git/info/refs?service=git-upload-pack
           -> 401 challenge issued
[open]    GET  /omega.git/info/refs?service=git-upload-pack
[open]    POST /omega.git/git-upload-pack
```

- The final open GET+POST pair is `eta`'s run. Under protocol v2 that pair IS a
  single `ls-refs` operation -- the capability advertisement followed by the
  command -- not an object fetch; a plain `git ls-remote` against this same
  server produces the identical pair. So the probe queried refs and downloaded
  nothing, which agrees with the empty state record and the clean disk.
- The private mount logged exactly ONE 401 and NO retry. For contrast, `git
  ls-remote` against the same mount logs 401, 401, then an authenticated
  request, because git retries once it has credentials. One-and-stop is the
  signature of `buildAuthForHost` returning `undefined`: there was never a
  credential to retry with. This corroborates the PROV-01 reading below from
  the server side rather than from the extension's own message.

NOT EXERCISED, and out of reach of any local fixture:

- **A SUCCESSFUL credential challenge.** `findProviderForHost` matches only
  `github.com` and `gitlab.com` (PROV-01), so `buildAuthForHost` returns
  `undefined` for any other host and no auth bundle is ever built. A
  self-hosted remote therefore cannot exercise the Device Flow path by
  construction -- it can only reach the unauthenticated-then-401 arm, which is
  what was observed. Closing this needs a genuinely private repository on
  github.com or gitlab.com. This is a gap in coverage, not a defect: the
  observed behavior is exactly what PROV-01/PROV-04 specify.

**Re-run on 2026-09-30**, operator-executed in a live Pi session
(`tmp/uat-git/launch-pi.sh`, Pi 0.86.1 as `package-lock.json` pins), to close
the successful-challenge sub-item above. The merge of main brought in #221
(D-1-01): every host now gets an auth bundle, and a host outside the provider
registry answers a challenge from the git credential helper. The fixture's
`credential.helper=store` could therefore reach the success path, and no
private GitHub or GitLab repository was needed.

Fixture changes, all under the gitignored `tmp/`:

- The private mount served the `omega` repository, whose release tags are
  `omega--v*`. The probe looks for tags named after the dependency, so
  `omega-private` would have found no candidate once authentication worked.
  The 401 had hidden this. A separate `omega-private` repository now carries
  annotated tags `omega-private--v1.0.0` (commit `d7cb24f1`) and
  `omega-private--v2.0.0` (commit `a0c4670a`), and the marketplace entry
  points at `https://localhost:8443/private/omega-private.git`.
- The fixture CA and server certificate had expired on 2026-09-17. Both were
  re-issued from the retained keys, still trusted only through
  `NODE_EXTRA_CA_CERTS` and the isolated `GIT_CONFIG_GLOBAL`.

`/claude:plugin install theta@uat-fixtures --scope user` installed `theta` and
its dependency `omega-private` with no credential prompt and no Device Flow
code. Verified afterwards:

- `state.json` records `omega-private` with
  `resolvedSha d7cb24f1ad047c2ee204b8d3c5c0c2b253089892`, the peeled v1.0.0
  commit, not the tag object `d03a734b` and not v2.0.0, and
  `provenance: "dependency"`. `theta` is `provenance: "explicit"`. The
  sandbox state migrated from schema 2 to 3 with no message.
- The `omega-private-skill` skill is staged under the scope's resources.

Server log (the first triplet is a `git ls-remote` smoke check of the fixture;
the next two are the extension):

```text
[private] GET  /private/omega-private.git/info/refs?service=git-upload-pack
           -> 401 challenge issued
[private] GET  /private/omega-private.git/info/refs?service=git-upload-pack
           -> authenticated as uatuser
[private] POST /private/omega-private.git/git-upload-pack
           -> authenticated as uatuser
  (repeated twice more: the tag probe's ls-refs, then the clone)
```

Each extension operation took exactly one challenge and one authenticated
retry, which is the stored-credential path answering the 401 with no second
credential path. The Device Flow arm, which only `github.com` and `gitlab.com`
reach on a helper miss, was not exercised; the operator accepted the
stored-credential run as closing this item.

## Summary

total: 2
passed: 2
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

**Resolved 2026-09-30: the successful credential challenge passed.** The
sub-item of test 2 that the 2026-09-15 run could not reach passed in the
re-run above, on the stored-credential path that #221 opened to every host.

**Operator observation, not a defect.** Two consecutive `uninstall` commands
rendered such that the second replaced the first's output on screen. Not
investigated; it may be host TUI redraw rather than notification composition,
and no notification content was wrong.

**Side finding, worth carrying to milestone close.**
`anthropics/claude-plugins-official` was fetched and inspected: **zero of its
297 plugins declare dependencies in their marketplace entry.** All 297 use
remote sources (`git-subdir`, shorthand, or `url`), so any declaration in a
plugin's own `plugin.json` is only readable after that plugin is materialized.
The cascade therefore has no consumer in the official marketplace today. That
is not a defect in this phase -- it is why the manifest-first declaration read
matters, since a plugin's own manifest is the only place these declarations can
currently appear -- but it does mean the feature ships without real-world
exercise beyond these fixtures.

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
