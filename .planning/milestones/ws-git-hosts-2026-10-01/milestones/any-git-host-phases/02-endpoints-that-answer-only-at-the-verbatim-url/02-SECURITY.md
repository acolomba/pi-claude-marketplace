---
phase: "02"
slug: "endpoints-that-answer-only-at-the-verbatim-url"
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
created: "2026-09-28"
---

# Phase 02 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail. Built from the
> `<threat_model>` blocks of 02-01..02-03 (authored at plan time), plus T-2-10, which the audit
> found unregistered and quick task 260928-tt9 then fixed.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| User-typed source -> `parseUrlSourceForm` | String-form admission gate; `https://` only | the `marketplace add` source string |
| Manifest / `state.json` object -> `urlObjectSource` -> `gatedUrlField` | Object-form gate; the manifest `source` field is third-party controlled (`Type.Unknown()`) | `{source\|kind, url, raw, ref, sha}` |
| `source.raw` -> `networkCloneUrl` -> `gitOps.clone` / `resolveRemoteRef` | Wire URL derivation | wire URL (slashes and `#ref` stripped, `.git` kept) |
| identity URL -> `pluginCloneKey` / `pluginMirrorKey` -> `plugin-clones/<key>/` | Scope-shared cache key | hash of the identity URL |
| wire URL -> isomorphic-git smart-HTTP | Credential released only when request host equals bound host (D-1-03) | URL + auth bundle |
| `gitOps.clone` thrown value -> user-visible row | Failure identity must survive unchanged | original Error; row subject is the typed source |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-2-01 | Tampering | `networkCloneUrl` `url` arm reads `source.raw` | medium | mitigate | Wire and identity strips share primitives and order (`source.ts` strip helpers); strip table and `URL_FIXED_POINT_CASES` in `tests/domain/source.test.ts`, `networkCloneUrl` cases in `tests/domain/clone-key.test.ts`; `raw` scheme-gated (`URL_OBJECT_GATE_CASES` rejects http/ssh/scp) | closed |
| T-2-02 | Information Disclosure | userinfo-bearing URL in a failure message | medium | mitigate | No new Error/notify template interpolates a URL; thrown value passes by reference (add.test.ts, clone-cache.test.ts); `no-credential-leak` gate covers add.ts, git.ts, auth-host.ts | closed |
| T-2-03 | Tampering | reintroduced fallback / status-gated retry | medium | mitigate | Every seam asserts call count 1 and the sent URL by value on success and failure (clone-cache.test.ts, add.test.ts 404/401 cases); one clone call per seam, no loop. The 01-04 redirect hop is server-directed, not a retry (02-VERIFICATION.md) | closed |
| T-2-04 | Spoofing | `.git` decision keyed on hostname text | low | mitigate | Derivation switches on `source.kind`; `github` kind only from the exact `https://github.com/` prefix or shorthand; mixed-case GitHub URL sent verbatim (add.test.ts) | closed |
| T-2-05 | Denial of Service | suffix-less source vs a `.git`-only host | low | accept | See AR-01 | closed |
| T-2-06 | Tampering | `networkUrl` silently defaulting to `cloneUrl` | medium | mitigate | `networkUrl` is required (no `?`) and read with no fallback in clone-cache.ts; all 9 production call sites derive it via `networkCloneUrl(...)` | closed |
| T-2-07 | Repudiation | a suite asserting the retired rule stays green | medium | mitigate | No allowlist admits only the `.git` form; by-value `cloneCalls[0].url` assertions; negative controls in 02-REVIEW-FIX.md | closed |
| T-2-08 | Tampering | a docstring records the inverse rule | medium | mitigate | `ensureGitSuffix` docstring states D-2-02 in its shipped direction; no retired-rule prose under `extensions/` | closed |
| T-2-09 | Repudiation | coverage pin or contract entry added to reach green | medium | mitigate | `test-coverage-direct.pin.json` rows `[]`; contracts count 108 unchanged, phase edits are line remaps only | closed |
| T-2-10 | Tampering / Spoofing | object-form `url` source whose `raw` names a different repository than `url` (content substitution through the scope-shared unpinned plugin mirror) | medium | mitigate | Fixed in `1cc96c97`: `urlObjectSource` admits `raw` only when its gated parse yields the same identity as `url`, otherwise the source parses `unknown` through the existing rejection path; decoration-only differences still admitted (D-2-05). Five `URL_OBJECT_GATE_CASES` rows (other host, `github.com/evil/x`, same host other path) fail on the old parser and pass now | closed |
| T-2-SC | Tampering | package installs | low | accept | See AR-02 | closed |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-01 | T-2-05 | A suffix-less `url` source against a host that serves only the `.git` path no longer resolves (D-2-02, upstream parity). It fails after one attempt with a row naming the typed URL (`{source missing}`), so the user can retry with the full clone URL. | plan 02-01 threat model | 2026-09-28 |
| AR-02 | T-2-SC | No dependency added and no package install; `package.json` and the lockfile are unchanged. | plans 02-01..02-03 | 2026-09-28 |

*Accepted risks do not resurface in future audit runs.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-09-28 | 11 | 11 | 0 | gsd-security-auditor (ASVS L1) + orchestrator; T-2-10 registered from audit W-1 and fixed in `1cc96c97` |

## Security Audit 2026-09-28

| Metric | Count |
|--------|-------|
| Threats found | 11 |
| Closed | 11 |
| Open | 0 |

Non-blocking follow-ups: the 02-0x SUMMARYs lack the `## Threat Flags` section AGENTS.md
requires (process gap; the audit, not the executors, surfaced W-1). Pre-existing, not a phase
regression: `gitSubdirObjectSource` has no scheme gate, so a `git-subdir` source accepts an
`http:` URL; no credential is offered because `onAuth` requires `https:`. Backlog candidate.

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-09-28
