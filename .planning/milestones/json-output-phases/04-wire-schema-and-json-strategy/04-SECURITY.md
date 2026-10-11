---
phase: "4"
slug: "wire-schema-and-json-strategy"
status: verified
threats_open: 0
threats_total: 22
threats_closed: 22
asvs_level: 1
block_on: high
register_authored_at_plan_time: true
created: "2026-10-06"
---

# Phase 4 — Security

## Trust Boundaries

User input and stored sources enter the presentation model; the model crosses
into text, JSON, and LLM details. The generated schema crosses into the npm
package. Thrown errors and hook prose are untrusted inputs to presentation.

## Threat Register

Source paths below are under extensions/pi-claude-marketplace; tests use the
matching owner path or tests/architecture. Evidence was checked by the
gsd-security-auditor against the current tree.

| Threat ID | Category | Component | Severity | Disposition | Evidence | Status |
| --- | --- | --- | --- | --- | --- | --- |
| T-04-01 | Information disclosure | Plugin tool details (edge/handlers/tools.ts, notification-json.ts) | medium | mitigate | tools.ts:487-497; notification-json.ts:253-280; tools.test.ts:927-981 | closed |
| T-04-02 | Tampering | Context-cascade text bytes after the presentation step | high | mitigate | notification-dispatch.ts:280-304; notify-context.test.ts:147; presentation-sink.test.ts:198; corpus 3149/0 | closed |
| T-04-03 | Tampering | Published wire contract (schema file and field names) | medium | mitigate | notification-wire.ts:51-159; tests/architecture/wire-schema.test.ts:47-129 | closed |
| T-04-04 | Denial of service | Soft-dependency probe the plugin tool now makes | low | accept | tools.ts:477-487; platform/pi-api.ts:158-205; tools.test.ts:319-352,950-951 | closed |
| T-04-SC | Tampering | npm/pip/cargo installs | high | mitigate | No new package introduced; TypeBox predates phase; package-lock.json equals origin/main; dependency updates inherited from main | closed |
| T-04-05 | Information disclosure | Marketplace tool details (edge/handlers/tools.ts) | medium | mitigate | tools.ts:120-130; notification-json.ts:253-260; tools.test.ts:446-486 | closed |
| T-04-06 | Information disclosure | Marketplace tool content line (`sourceLogical` of a stored url source) | medium | accept | tools.ts:107-115; 04-02-SUMMARY.md carried risk and user scope decision | closed |
| T-04-07 | Tampering | No-op and reconcile-applied text bytes after the presentation step | high | mitigate | notification-present.ts:269-276; notification-dispatch.ts:300-317; notify-context.test.ts:290,304; corpus 3149/0 | closed |
| T-04-08 | Repudiation | `noOp` misreporting an update outcome | low | mitigate | notification-resolve.ts:153; notification-json.ts:184,225-226; catalog-wire.test.ts:411 | closed |
| T-04-09 | Information disclosure | Prune-committed-warning cause (presentation step) | high | mitigate | notification-present.ts:178-185; notification-present.test.ts:893-918 | closed |
| T-04-10 | Information disclosure | `absPath` of a path-source marketplace-info payload | low | accept | notification-json.ts:292; catalog-wire.test.ts:508-521 | closed |
| T-04-11 | Tampering | Raw-kind severity drifting between text and JSON | medium | mitigate | notification-json.ts:146; notification-grammar.ts:1143-1171; notification-resolve.ts:567-576; notification-json.test.ts:1604 | closed |
| T-04-12 | Tampering | Rewake summary prose interpreted by the converter | low | mitigate | notification-json.ts:164-165; notification-json.test.ts:1559-1568,1638 | closed |
| T-04-13 | Information disclosure | Thrown-message strings (cause chains, leaks, reconcile-aborted, plugin-path reason, usage-error message, diagnostics) | high | mitigate | errors.ts:169; notification-resolve.ts:525-530,603-621; no-credential-leak.test.ts:734-889 | closed |
| T-04-14 | Information disclosure | Stored url-source userinfo in marketplace-info output | high | mitigate | notification-present.ts:136,148,209; no-credential-leak.test.ts:891; notification-present.test.ts:613-649 | closed |
| T-04-15 | Information disclosure | Token forms outside the D-05 set (short bodies, other hosts' token prefixes) | medium | accept | redact-credentials.ts:35-38; redact-credentials.test.ts:128-130 | closed |
| T-04-16 | Repudiation | Over-redaction hiding failure detail | medium | mitigate | redact-credentials.ts:40-45; redact-credentials.test.ts:13-26,123-135,198-206; accepted masking rules | closed |
| T-04-17 | Repudiation | Catalog-wide validation going vacuous | high | mitigate | catalog-wire.test.ts:156-173,297-393; positive counts, tuple equality, rejecting controls | closed |
| T-04-18 | Information disclosure | Absolute paths or live Error objects in payloads | high | mitigate | catalog-wire.test.ts:217-282,495-565; recursive walk and planted path/Error/undefined cases | closed |
| T-04-19 | Information disclosure | Typed subject names: a failed `marketplace add` block name (`addSubjectName` returns the raw source), the not-added name (a `marketplace remove` or `update` positional, or the marketplace half of `<plugin>@<marketplace>`), and a plugin row name from a hand-edited `enabledPlugins` key | high | mitigate | notification-resolve.ts:357,371-389; notification-present.ts:173; no-credential-leak.test.ts:939-991 | closed |
| T-04-20 | Repudiation | Over-redaction hiding which marketplace or plugin a row is about (scp-style or token-shaped names) | medium | mitigate | redact-credentials.ts:35-45; notification-resolve.test.ts:829; user acceptance 2026-10-06; corpus 3149/0 | closed |
| T-04-21 | Information disclosure | A name cut before its userinfo `@`, such as a malformed `enabledPlugins` key whose last `@` is the userinfo `@` | low | mitigate | notification-resolve.ts:388-389; notification-resolve.test.ts:883-900; no-credential-leak.test.ts:962-983; fix fbbacb2f | closed |

## Accepted Risks Log

| Threat | Rationale | Accepted by | Record |
| --- | --- | --- | --- |
| T-04-04 | Three synchronous local inventory reads on the non-empty tool path; no network. | Existing approved plan; no new acceptance | Corresponding Phase 4 PLAN threat register |
| T-04-06 | D-09 preserves marketplace LLM content bytes. Stored URL userinfo can remain there; user explicitly excluded this surface. | Existing approved plan; no new acceptance | Corresponding Phase 4 PLAN threat register |
| T-04-10 | Path-source info shows a user-provided absolute path already visible in text; WIRE-08 enforces that boundary. | Existing approved plan; no new acceptance | Corresponding Phase 4 PLAN threat register |
| T-04-15 | D-05 fixes the credential vocabulary and token-length floor; other forms need a separate scope decision. | Existing approved plan; no new acceptance | Corresponding Phase 4 PLAN threat register |

T-04-21 was initially accepted. The split-key fix now mitigates it; its former
acceptance is superseded. The user confirmed conservative row-name and Bearer
masking on 2026-10-06. Those trade-offs are recorded under T-04-16/T-04-20.

## Security Audit Trail

| Date | Total | Mitigated | Accepted | Open | Run by |
| --- | --- | --- | --- | --- | --- |
| 2026-10-06 | 22 | 18 | 4 | 0 | gsd-security-auditor; parent recorded authorized accepts |

All six SUMMARY Threat Flags sections report no additional surface. The
SSH username masking Info finding falls within existing over-redaction risks.

## Verification Evidence

At c5494971, Node v26.10.0, npm run check exited 0, including all 264 direct
coverage pairs. The corpus check exited 0: 3149 entries present, zero extra.
The six additional entries were reconciled from main in 69a6ade8. Catalog
output bytes are unchanged; the sole older-base prose difference is main’s
d7213bc2 citation correction. Package dry run includes the schema.

## Sign-Off

- [x] All threats have an explicit disposition and evidence.
- [x] Four authorized accepts are recorded above.
- [x] threats_open: 0 (high threshold); no lower-severity opens remain.
- [x] status: verified.

**Approval:** verified 2026-10-06.
