---
milestone: any-git-host
audited: 2026-09-30T15:30:00Z
status: passed
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

Status: **passed**. All 10 requirements are satisfied, all 3 phases verified `passed`, every
threat model is `verified` with `threats_open: 0`, and both UAT files are `complete`. No blocker.

This audit first read `tech_debt`: open code-review findings carried by `BACKLOG.md` entries
GHRED-01 (Phase 1) and GHADD-01 (Phase 3). Quick task 260930-j4y fixed or disposed of every one of
them on PR #231 (`4f7e4f35`, `727939fc`, `0476e0f9`), and both carriers are closed. The one item
left is the intended host-fold advisory below.

The milestone shipped as PR #221, squash-merged to `main` as `a0d3aef1` on 2026-09-30 with every
CI check green. This audit ran after the merge, against `f42e5dd6` (the branch with `main` merged
back in, tree-identical to `a0d3aef1`).

## Requirements (3-source cross-reference)

| Req | Phase | VERIFICATION | SUMMARY frontmatter | REQUIREMENTS.md | Integration | Final |
|-----|-------|--------------|---------------------|-----------------|-------------|-------|
| GAUTH-03 | 1 | passed | 01-01, 01-03 | [x] | WIRED | satisfied |
| GAUTH-04 | 1 | passed (scoped to `update`, D-79-03) | 01-01 | [x] | WIRED | satisfied |
| GAUTH-05 | 1 | passed | 01-01, 01-03 | [x] | WIRED | satisfied |
| GAUTH-06 | 1 | passed | 01-02, 01-04 | [x] | WIRED | satisfied |
| MURL-08 | 2 | passed | 02-01..03 | [x] | WIRED | satisfied |
| MURL-09 | 2 | passed | 02-01..03 | [x] | WIRED | satisfied |
| MA-12 | 3 | passed | 03-01, 03-02 | [x] | WIRED | satisfied |
| MA-13 | 3 | passed | 03-01, 03-02, 03-04 | [x] | WIRED | satisfied |
| MA-14 | 3 | passed | 03-01, 03-02 | [x] | WIRED | satisfied |
| GATE-01 | 3 | passed | 03-03, 03-04 | [x] | CI green at merge | satisfied |

No orphaned requirement. GAUTH-06 holds as written: no credential reaches another origin. The
residual edges the first audit listed are closed: a 401 or 203 after a cross-origin redirect now
fails as `CrossOriginChallengeError` before any credential lookup (WR-01), and a cross-origin hop
keeps only protocol headers (WR-03).

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

All closed. Before the audit: Phase 1 WR-02 (`a2db444e`); Phase 3 CR-01 and WR-10 (`24f2da2c`,
`235fdc17`), WR-11 (`add75890`), WR-05 (`ae8ce217`). After it, quick task 260930-j4y closed the
rest; the per-finding dispositions are in the closed GHRED-01 and GHADD-01 entries in
`.planning/BACKLOG.md`.

- GHRED-01: WR-01, WR-03, WR-04 and IN-01 to IN-05 fixed in `4f7e4f35`.
- GHADD-01: WR-01, WR-03, WR-06, WR-08, IN-02, IN-04, IN-05, IN-06 and IN-08 fixed in `727939fc`;
  WR-02, WR-09, IN-03 and the IN-01 remainder fixed in `0476e0f9`; WR-07 and IN-07 were already
  fixed. WR-04 was wrong: `assertPathInside` refuses a symlinked destination before recognition.

Recorded consequences of those fixes, not debt: a leftover from a released version has no
ownership marker, so it refuses as `{stale clone}` and needs one manual delete; and an owner or
repository letter-case difference in `origin` still refuses.
