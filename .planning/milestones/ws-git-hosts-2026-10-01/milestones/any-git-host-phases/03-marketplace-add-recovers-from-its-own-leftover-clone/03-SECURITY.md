---
phase: "03"
slug: "marketplace-add-recovers-from-its-own-leftover-clone"
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
created: "2026-09-28"
---

# Phase 03 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail. Built from the
> `<threat_model>` blocks of 03-01..03-04 (authored at plan time). T-3-05 was open after the audit
> (review WR-11) and is closed by quick task 260928-tt9.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| Leftover `<finalDir>/.git/config` -> `listRemotes` -> removal decision | Disk state from an earlier process decides whether `sources/<name>` is deleted | origin url, or `no-origin` / `not-a-repo` / `unreadable` |
| Manifest `source` -> `parsePluginSource` -> `canonicalCloneUrl` | Third-party source; https-only admission before any comparison | canonical identity url |
| `locations.sourceCloneDir(name)` -> `finalDir` | Path containment chokepoint: `assertSafeName`, `assertPathInside`, symlink refusal including the leaf | absolute path under `sources/` |
| Thrown error -> notification (MA-14) | Leak text reaches the user via `appendLeakToError` | path and fs errno only |
| Failed add -> `state.json` | A partly removed destination must never be recorded | none written |
| Cascade clone url -> `hostFromCloneUrl` -> bundle host | Autoupdate bundle can hold credentials; host binding keeps them on their host | host, `credentialOps` |
| Missing `ctx` -> Device Flow arm | Background caller must not reach the Device Flow | none (declined) |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-3-01 | Tampering | removal decision in `add.ts` leftover recognition | high | mitigate | `recognizeLeftover` removes only on the `origin` arm with `stripGitSuffix(url) === canonicalCloneUrl(source)`; every other arm throws `StaleSourceCloneError` and removes nothing; target fixed by `locations.ts` containment; MA-12 / MA-13 table tests assert the leftover survives a refusal | closed |
| T-3-02 | Information Disclosure | origin url returned by `listRemotes` | medium | mitigate | The url is only compared; `StaleSourceCloneError` carries `absPath` and `mpName` only; leak text holds dir and errno; `no-credential-leak` gate registers git.ts and add.ts | closed |
| T-3-03 | Denial of Service | fs probe in `listRemotes` | low | accept | See AR-01 | closed |
| T-3-04 | Tampering | `finalDir` path derivation | low | accept | See AR-02 | closed |
| T-3-05 | Spoofing | leftover `origin` crafted to be accepted as the source | medium | mitigate | Whole-string byte equality in `recognizeLeftover`; five near-miss shapes refuse. WR-11 (two `url` lines: isomorphic-git read the last, git fetches the first) fixed in `add75890`: `listRemotes` reads every value with `git.getConfigAll` and returns `no-origin` unless exactly one string. `ORIGIN_SECTION_SHAPES` rows (foreign-first, foreign-second, two sections) and `add.test.ts` "MA-13 / WR-11: a leftover whose origin section names two urls refuses as stale clone" fail on the old code and pass now | closed |
| T-3-06 | Tampering | partly removed destination recorded in state | high | mitigate | MA-14 throw precedes `mkdir`, `rename` and the state mutation; the single-fault test reads persisted state directly | closed |
| T-3-07 | Information Disclosure | `buildAuthForHost` with no `ctx` on a registry host | medium | mitigate | Guard `provider === undefined \|\| ctx === undefined` returns the no-provider bundle before any Device Flow call; test asserts `deviceFlow.calls` empty | closed |
| T-3-08 | Elevation of Privilege | cascade bundle that can now hold credentials | medium | mitigate | Bundle host from `hostFromCloneUrl`; `onAuth` cancels on scheme/host mismatch before `fill`; cascade test asserts `auth.host` on both seam arms | closed |
| T-3-09 | Repudiation | completion claim read from a glyph, pipe or subset | high | mitigate | Literal `CHECK_EXIT=0` recorded unpiped; re-measured at later HEADs with clean source status (03-04-SUMMARY, 03-VERIFICATION, quick task 260928-tt9 gate log) | closed |
| T-3-10 | Denial of Service | `origin` section with no url | medium | mitigate | Url-less section maps to `no-origin` -> `StaleSourceCloneError`; platform and end-to-end tests (standalone and orchestrated) | closed |
| T-3-11 | Tampering | removal after an interrupted config rewrite | high | mitigate | `listRemotes` never synthesizes a url; both end-to-end cases assert `.git/config` byte-unchanged | closed |
| T-3-12 | Repudiation | GATE-01 / SC4 claim for the post-fix tree | high | mitigate | `CHECK_EXIT=0` with scope fence recorded; re-measured at every later HEAD, including after `add75890` | closed |
| T-3-SC | Tampering | package installs | low | accept | See AR-03 | closed |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-01 | T-3-03 | `listRemotes` reads only `<dir>/.git/config` and never walks a directory; a `.git` file redirecting to another gitdir fails the probe and becomes `not-a-repo`. | plan 03-01 threat model | 2026-09-28 |
| AR-02 | T-3-04 | Recognition reuses the `finalDir` that `sourceCloneDir` already passed through `assertSafeName`, `assertPathInside` and the symlink refusal, and appends only fixed segments. | plan 03-01 threat model | 2026-09-28 |
| AR-03 | T-3-SC | No dependency added and no package install; `package.json` and the lockfile are unchanged. | plans 03-01..03-04 | 2026-09-28 |

*Accepted risks do not resurface in future audit runs.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-09-28 | 13 | 12 | 1 (T-3-05, medium, non-blocking) | gsd-security-auditor (ASVS L1) |
| 2026-09-28 | 13 | 13 | 0 | orchestrator, after `add75890` closed WR-11 |

## Security Audit 2026-09-28

| Metric | Count |
|--------|-------|
| Threats found | 13 |
| Closed | 13 |
| Open | 0 |

Side effect of the WR-11 fix, pinned by a `git.test.ts` row: a capitalized `[Remote "origin"]`
section is now read as origin, as git reads it (resolves review IN-07). Related, by design: a
user-placed clone of the same repository in `sources/<name>` is still removed (WR-03, D-3-02).

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-09-28
