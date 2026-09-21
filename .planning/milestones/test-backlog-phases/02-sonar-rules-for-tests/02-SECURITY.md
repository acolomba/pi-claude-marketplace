---
phase: "02"
slug: "sonar-rules-for-tests"
status: secured
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
created: "2026-09-19"
register_authored_at_plan_time: false
---

# Phase 02 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|----------------|
| Developer/CI ↔ repository quality gate | `eslint.config.js` is the single enforcement point; invoked by `npm run lint` → `npm run check` in CI and `pre-commit run --all-files` | Lint rule config, source/test files (read-only) |
| Test process ↔ filesystem | `tests/architecture/sonar-test-rules.test.ts` reads exactly one path, `path.join(REPO_ROOT, "eslint.config.js")` | Read-only; no writes, no temp dirs, no env/argv/network input |
| Dev-dependency boundary | `eslint@10.10.0` + `eslint-plugin-sonarjs@4.2.0` loaded into the test process | Both `dev: true` with `sha512` integrity; neither in `dependencies` |
| Publish boundary | `package.json` `files` ships only `extensions/pi-claude-marketplace/**` | No file this phase touched is shipped to a user |
| Production runtime boundary | Not crossed by this phase | No auth, credential, network, filesystem-write, CI-secret, or entry-point code modified |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-02-01 | Tampering | Adopted rule enforcement | medium | mitigate | Rules live at `eslint.config.js:366-368` (`assertions-in-tests`, `no-empty-test-file`, `no-trivial-assertions` = `error`). Effective-config probe returns `[2]` for all three; 6 discriminating controls at `tests/architecture/sonar-test-rules.test.ts:33-86` including an override-detection case. Live re-run: 15/15 pass. | closed |
| T-02-02 | Tampering | Blanket suppression erosion | medium | mitigate | Zero file-level or rule-less `eslint-disable` in `tests/`/`extensions/`; exactly 5 suppressions, all line-scoped and rule-named. No `tests/**` off-switch for any of the three rules; no `.eslintignore`. | closed |
| T-02-03 | Tampering | Exemption glob scope | medium | mitigate | `eslint.config.js:383-393` is an exact literal path list (no wildcards), overrides only `no-empty-test-file`. Effective-config probe confirms `assertions-in-tests`/`no-trivial-assertions` still `[2]` on exempt paths; each carries an inverse control. | closed |
| T-02-04 | Tampering / Elevation of privilege | Production Sonar rule block | high | mitigate | Diff of the `extensions/pi-claude-marketplace/**/*.ts` block in `08fe8e65` changes comment text only — `sonarjs.configs.recommended.rules` spread/scope untouched. Effective-config probe confirms severity 2 for 7 production security rules (`no-hardcoded-passwords`, `publicly-writable-directories`, etc.). | closed |
| T-02-05 | Elevation of privilege | Planted offender snippets | medium | mitigate | Snippets are module-local string constants passed to `eslint.lintText()` — parse/analyze only, never `eval`/`import`/`spawn`. No `child_process`, `vm`, dynamic import. | closed |
| T-02-06 | Tampering | Config-path resolution | low | mitigate | `overrideConfigFile` path is module-URL derived (`source-scan.ts:39-42`), no `process.env`/`process.argv`/caller input. | closed |
| T-02-07 | Information disclosure | Fixture/assertion content | medium | mitigate | Grep of added lines for `token/secret/password/api_key/bearer/ghp_/home paths/AKIA` → 0 hits. Compensating control: `trufflehog` + `detect-private-key` run repo-wide in CI lint workflow (test tree is not covered by ESLint credential rules by pre-existing design). | closed |
| T-02-08 | Repudiation | Gate bypass audit trail | low | mitigate | All 5 suppressions carry a `-- <reason>` justification; both config blocks carry rationale comments; all 23 measured rule clusters have a recorded disposition in `02-SONAR-POLICY.md`. | closed |
| T-02-09 | Tampering (supply chain) | ESLint/sonarjs dependency | medium | mitigate | `package-lock.json` pins both packages `dev: true` with `sha512` integrity; zero production imports of `eslint`; `tests/**` and `eslint.config.js` excluded from `files`. | closed |
| T-02-10 | Denial of service | Control test resource bound | low | mitigate | Fixed case count (15), all in-memory `lintText`, no filesystem loops, no network. Measured: 16.5s for 15/15. | closed |
| T-02-11 | Spoofing | New entry point / identity surface | low | mitigate | Zero files under `extensions/` modified by `08fe8e65`; only lint config and test files touched, neither published. | closed |
| T-02-12 | Tampering (incomplete gate coverage) | `tests/live-uat/` ESLint ignore | low | mitigate | The global ignore list (`eslint.config.js:10-21`) excludes `tests/live-uat/` entirely, so the three adopted rules can never fire there. No control detects a future `*.test.ts` landing in that path. Exploitability today: nil — that directory holds 3 non-test files. | open — below high threshold (non-blocking) |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|

*No accepted risks; T-02-12 is tracked open (non-blocking) rather than accepted — see Unregistered Flags follow-up.*

---

## Unregistered Flags

`02-01-SUMMARY.md` has no `## Threat Flags` section; the register above was reconstructed from the implementation diff (`08fe8e65`) rather than an executor self-report.

**Informational, post-phase drift (maps to T-02-03, not a gap):** the `no-empty-test-file` exemption allow-list grew from 7 paths at phase-commit time to 9 today (`tests/bridges/hooks/exec-result.test.ts`, `tests/domain/resolver-types.test.ts` added by later commits `080d395e`/`6a463603`). Both additions are exact literal paths with inverse controls; the control suite grew 13 → 15 cases accordingly. `02-01-SUMMARY.md`, `02-REVIEW.md`, and `02-VERIFICATION.md` still say "seven"/"13 controls" and are stale on this point; the shipping config comment correctly says "nine".

**Follow-up worth tracking, not blocking:** close T-02-12 by adding a control that fails if a `*.test.ts` appears under `tests/live-uat/`, or by narrowing the ignore to the `.mjs` canaries.

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-09-19 | 12 | 11 | 1 (non-blocking) | gsd-security-auditor (retroactive STRIDE audit ahead of catch-up PR; commit `08fe8e65`) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-09-19
