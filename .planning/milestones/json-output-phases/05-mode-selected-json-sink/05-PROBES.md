# Phase 5 probe record

SPEC is absent; EDGE_ABSENT and PROHIB_ABSENT are true. This record uses the required spec-less fallback. It records planning dispositions, not execution evidence.

## Capability probes, in contribution order

| Probe | Observed result | Authoring consequence |
|---|---|---|
| API coverage | Final PLAN bodies plus Phase 5 ROADMAP scope: detected=true; signals wire/api and API surface. An earlier empty-input invocation reported skipped and supplied no verdict. | Complete 26-member Pi API subtraction matrix in COVERAGE.md. |
| Assumption delta | gsd-tools.cjs query assumption-delta scan 5 --json: detected=false, signals=[] on the actual roadmap section. | No invented Assumption Delta block. |
| Database schema push | No owned file matches the ORM/database schema patterns; schema_push=false. | No schema-push task. Existing JSON wire schema is unchanged. |
| Security | ASVS level 1; block high. Twenty unique threats plus reserved T-05-SC. | Every high threat has a mitigation and owner verification. No installs or package checkpoint. |

Estimate calibration returned factor 1, zero samples, confidence low. Discovery level 0 is sufficient: existing owners, converter/schema, installed Pi declarations, no new dependency or external service.

## Edge coverage

The supplied deterministic report surfaced 13 rows. None is dropped: 11 have explicit predicates; two remain unclassified/unresolved. Full rows are in 05-EDGE-COVERAGE.json. Resolved here means a checkable predicate has been planned.

| Requirement / category | Explicit predicate | Task |
|---|---|---|
| MODE-01 / empty | An empty mode string raises UnsupportedModeError before any command routing, inventory probe, or mutation. | 05-01.1 |
| MODE-01 / encoding | Only exact tui, print, json, and rpc strings pass; case, padding, and Unicode-lookalike strings are rejected without normalization. | 05-01.1 |
| JOUT-01 / adjacency | Two equal usage emissions append two distinct entries in their original call order. | 05-02.2 |
| JOUT-01 / empty | Diagnostic lines [] and rewake text "" emit nothing; [""] and whitespace-only rewake text each emit one entry, while structured empty arrays remain valid payload data. | 05-03.2; 05-06.1; 05-07.1 |
| JOUT-01 / ordering | The dispatcher preserves emission order and diagnostic line order, including equal adjacent values. | 05-02.2; 05-03.2 |
| TENB-01 / adjacency | Capture retains two equal payloads as two ordered entries and validates both. | 05-01.1 |
| TENB-01 / empty | An empty capture passes assertValid; a recorded empty object fails schema validation and remains a final assertion failure. | 05-01.1 |
| TENB-01 / ordering | An invalid middle entry remains a final assertValid failure even when valid entries surround it and the immediate throw was caught. | 05-01.1; 05-03.2 |
| TENB-02 / adjacency | Two context fakes each supply independent explicit mode values; changing one does not change the other. | 05-01.1 |
| TENB-02 / empty | Omitting mode fails the consumer-owned TypeScript context contract; test fakes cannot hide the missing member with assertion casts. | 05-01.1 |
| TENB-02 / ordering | A getter-backed context on one run exposes its changed mode to the next emission without a second soft-dependency snapshot. | 05-01.1; 05-02.2 |

Flagged assumptions: **A-05-01** (MODE-02, unclassified) requires independent review that every fresh-mutation root is guarded; 05-01.1, 05-05.1/2, and 05-06.1/2 provide evidence but cannot automatically resolve classification uncertainty. **A-05-02** (JOUT-05, unclassified) requires independent callback/caller review for stale pi/ctx and pre-bind containment; 05-05/06 provide the cases. Both remain unresolved with verification=null, not backstop-resolved.

## Prohibition recall and precision

Each row records ten adversarial candidates followed by precision disposition. Routine correctness belongs to ordinary tests/edge coverage. Canon security is referred rather than minted. Only two bespoke intent constraints survive.

| Requirement | Ten recalled candidates and precision disposition |
|---|---|
| MODE-01 | cached selection (routine); normalized modes (routine); invented fallback (routine); duplicate emission (routine); reordered output (routine); fake getter (routine); second snapshot (routine); global mode (routine); hidden model-setting change (already explicitly excluded product scope); credentials exposed (canon). |
| MODE-02 | writes before guard (routine); untyped error (routine); absent mode value (routine); lifecycle throw (routine); suppressed discovery (routine); suppressed cleanup (routine); environment mutation (routine); extra probe (routine); directory escape (canon); automatic network access (canon). |
| JOUT-01 | wrong custom type (routine); malformed DTO (routine); omitted surface (routine); duplicate transport (routine); wrong empty rule (routine); unstable order (routine); optional sink (routine); path/credential leakage (canon); report converted into model instruction (KEEP P-05-01); report-triggered model turn (same P-05-01). |
| JOUT-05 | captured failure hidden (routine); stale mode outside catch (routine); cap reset (routine); orphan cleanup skipped (routine); discovery skipped (routine); opt-in logger bypass (routine); stale-generation output (routine); missing run (routine); deliberately concealed/softened cap warning (KEEP P-05-02); credential-bearing logs (canon). |
| TENB-01 | validator absent (routine); only serialized safety check (routine); wrong type accepted (routine); invalid entry lost (routine); duplicate overwritten (routine); invalid middle lost (routine); empty capture rejected (routine); expected object generated by subject (routine); catalog tuple dropped (routine); real secret fixtures (canon). |
| TENB-02 | inferred mode (routine); missing mode cast away (routine); shared mutable mode (routine); zero-read expectation (routine); unlimited expectation (routine); hidden extra snapshot (routine); spread live context (routine); any-typed factory (routine); mode frozen at fixture creation (routine); identity-sensitive discrimination (fairness canon). |

Credential/path/injection and privacy risks are canon: refer to $gsd-secure-phase plus existing security/ESLint checks; no duplicate prohibition is minted. Model-setting changes already fall outside the output-only scope.

05-PROHIBITION-RECALL.json contains the kept items. The real projectProhibitions serializer in .codex/gsd-core/bin/lib/probe-core.cjs projected them into 05-01 and 05-06 must_haves.prohibitions. P-05-01 and P-05-02 remain unresolved, descriptorless, flagged-unverified. No wired descriptor or fabricated proof exists. Full tests cannot automatically turn these judgments into passing claims.
