---
milestone: any-git-host
audited: 2026-09-30T15:30:00Z
status: tech_debt
audited_head: f42e5dd6
scores:
  requirements: 10/10
  phases: 3/3
  integration: 10/10
  flows: 5/5
gaps:
  requirements: []
  integration: []
  flows: []
tech_debt:
  - phase: 01-private-repos-on-any-git-host
    carrier: GHRED-01
    items:
      - "WR-01: a 401 from a cross-origin redirect target still fills the bound host's credential; on a Device Flow host a second 401 evicts it (no credential reaches the other origin)"
      - "WR-03: the cross-origin scrub is a denylist (authorization, cookie); a GitCredentials.headers entry would survive a cross-origin hop"
      - "WR-04: an empty Location header is followed as a redirect to the same URL until `too many redirects`"
      - "IN-01..IN-05: docstring parity claim, untyped TypeError on a malformed Location, untyped `too many redirects`, undiscriminated guard contract cases, test row type placement"
  - phase: 03-marketplace-add-recovers-from-its-own-leftover-clone
    carrier: GHADD-01
    items:
      - "WR-03/WR-04: a user-placed clone of the same repository is recognized and removed; recognition follows a symlinked destination (intentional under D-3-01, unguarded)"
      - "WR-01/WR-06/WR-07: add.ts JSDoc and flow header still describe the pre-recognition refusal"
      - "WR-08: recognizeLeftover takes five positional parameters"
      - "IN-04: the `else if (finalDir !== undefined)` cleanup arm drops leftoverLeak"
      - "IN-05: a case-differing url host cannot recognize its own leftover (github.com folded by c1286475; other hosts and pre-fold leftovers still refuse as {stale clone})"
      - "IN-01 (partial): the listRemotes unreadable arm no longer uses chmod (c1286475); the MA-14 chmod cases in add.test.ts still pass vacuously as root"
      - "WR-02 (unverified): the standalone path's rendering of the leftover-removal leak"
      - "WR-09, IN-02, IN-03, IN-06, IN-07, IN-08: test structure, naming, substring assertions, double read, comment framing"
  - phase: milestone
    items:
      - "Advisory (02-VERIFICATION.md): the github.com host fold moves the cache identity of a capitalized-host, www. or :443 github URL, so a warm plugin clone keyed on the old spelling re-clones once (intended under D-76-02)"
nyquist:
  compliant_phases: [1, 2, 3]
  partial_phases: []
  not_validated_phases: []
  missing_phases: []
  overall: compliant
---

# Milestone audit: any-git-host

Status: **tech_debt**. All 10 requirements are satisfied, all 3 phases verified `passed`, every
threat model is `verified` with `threats_open: 0`, and both UAT files are `complete`. No blocker.
The debt is open code-review findings, none of which breaks a flow; each group has a
`BACKLOG.md` carrier.

The milestone shipped as PR #221, squash-merged to `main` as `a0d3aef1` on 2026-09-30 with every
CI check green. This audit ran after the merge, against `f42e5dd6` (the branch with `main` merged
back in, tree-identical to `a0d3aef1`).

## Requirements (3-source cross-reference)

| Req | Phase | VERIFICATION | SUMMARY frontmatter | REQUIREMENTS.md | Integration | Final |
|-----|-------|--------------|---------------------|-----------------|-------------|-------|
| GAUTH-03 | 1 | passed | 01-01, 01-03 | [x] | WIRED | satisfied |
| GAUTH-04 | 1 | passed (scoped to `update`, D-79-03) | 01-01 | [x] | WIRED | satisfied |
| GAUTH-05 | 1 | passed | 01-01, 01-03 | [x] | WIRED | satisfied |
| GAUTH-06 | 1 | passed | 01-02, 01-04 | [x] | WIRED, residual WR-01/03/04 | satisfied |
| MURL-08 | 2 | passed | 02-01..03 | [x] | WIRED | satisfied |
| MURL-09 | 2 | passed | 02-01..03 | [x] | WIRED | satisfied |
| MA-12 | 3 | passed | 03-01, 03-02 | [x] | WIRED | satisfied |
| MA-13 | 3 | passed | 03-01, 03-02, 03-04 | [x] | WIRED | satisfied |
| MA-14 | 3 | passed | 03-01, 03-02 | [x] | WIRED | satisfied |
| GATE-01 | 3 | passed | 03-03, 03-04 | [x] | CI green at merge | satisfied |

No orphaned requirement. GAUTH-06 holds as written: no credential reaches another origin. WR-01
is a spurious fill or eviction for the BOUND host, and WR-03 needs a credential that carries
custom headers, which `credentialFill` never produces.

## Phases

| Phase | Verification | Security | UAT | Nyquist |
|-------|--------------|----------|-----|---------|
| 1. Private repos on any git host | passed 5/5 | verified, 0 open | complete | COMPLIANT |
| 2. Endpoints that answer only at the verbatim URL | passed 9/9 | verified, 0 open | complete | COMPLIANT |
| 3. `marketplace add` recovers from its own leftover clone | passed 7/7 | verified, 0 open | n/a | COMPLIANT |

`query audit-open` reports every artifact type clear.

Phases 2 and 3 were validated by hand on 2026-09-30, at `3166c504` on PR #231 (`init.phase-op`
does not find archived phases). Neither had a gap. Phase 3 was checked against the tree after
quick task 260930-j4y, which changed its surface.

All three reports first read `stale`: commits `505dc912`, `23cc2218`, `ae8ce217`, `62ec0fa6` and
`c1286475` changed files they cover after they were written. On 2026-09-30 the verifier re-ran for
each phase against the final tree (5/5, 9/9, 7/7, no gaps), and `verification.status` now reads
`passed` for all three. The Phase 3 re-run found ROADMAP SC2 still naming `{stale clone}` for an
unreadable leftover. It was amended to match MA-13 before the archive.

## Integration

Traced statically at `f42e5dd6`, including the five commits that landed after the phase
verifications. The substantive one, `c1286475`, gave the auth bundle a `kind` discriminant
(`device-flow` | `stored-credential`), split the builders, and folded the `github.com` host case.

- Phase 1 into Phase 2: `materializePluginClone` and `materializeOrRefreshPluginMirror` require an
  auth bundle and take both the identity URL (`canonicalCloneUrl`) and the wire URL
  (`networkCloneUrl`). All callers pass both.
- Autoupdate cascade (D-3-04): `makeUpdateCloneProbe` uses `buildStoredCredentialAuth` when no
  notification context exists, so the cascade authenticates and never starts a Device Flow.
- GAUTH-05 after the refactor: `marketplace update` attaches the stored-credential cause line only
  when `auth.kind === "stored-credential"`, so a declined Device Flow keeps its bare row.
- Phase 2 into Phase 3: a clone made with `networkCloneUrl` records an origin that strips back to
  `canonicalCloneUrl`, so recognition matches for both `github` and `url` sources.

## E2E flows

| Flow | Status |
|------|--------|
| `marketplace add` of a private url source on an unregistered host, credential stored | complete |
| Same, nothing stored (bare row on add; cause line on update) | complete |
| Verbatim-only endpoint: add, then update and `resolveRemoteRef` | complete |
| Retry of `marketplace add` after a crash left `sources/<name>/` | complete |
| Plugin install and update on an unregistered host, including the autoupdate cascade | complete |

## Review-finding status at HEAD

Closed since the dispositions were recorded: Phase 1 WR-02 (`a2db444e`); Phase 3 CR-01 and WR-10
(`24f2da2c`, `235fdc17`), WR-11 (`add75890`), WR-05 (`ae8ce217`). Phase 3 WR-02 is probably
fixed (the leak now joins the thrown error at `add.ts:836`), but its standalone rendering was not
re-checked, so GHADD-01 carries it. Everything else in the `tech_debt` block remains open and is carried by GHRED-01
and GHADD-01.
