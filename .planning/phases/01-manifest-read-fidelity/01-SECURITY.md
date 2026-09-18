---
phase: "1"
slug: "manifest-read-fidelity"
status: verified
threats_open: 0
asvs_level: 1
block_on: high
register_authored_at_plan_time: true
nonblocking_threats_open: 0
created: "2026-09-14"
---

# Phase 1 — Security

The four plans contain authored STRIDE registers. This audit checks their mitigations at the configured ASVS level 1 and blocking threshold `high`; it does not claim an ASVS certification or a new whole-application threat analysis. The non-file manifest disagreement and ineffective third-reader assertion found during review are repaired. All nine register rows are closed by verified mitigation or an existing documented acceptance; no new risk acceptance is made.

## Trust Boundaries

| Boundary | Data crossing |
| --- | --- |
| Third-party plugin tree to manifest readers | Untrusted JSON, including the added bare `plugin.json` candidate |
| Declared component/source paths to filesystem | Author-supplied paths resolved under an owning marketplace or plugin root |
| Dependency declarations to notification output | Untrusted string/object declarations and caller-supplied marketplace names |
| Plugin tree to component discovery | Directory entries and command files mapped to generated names |

## Threat Register

Duplicate IDs in different plans are qualified by component where their disposition differs. The nine rows below preserve all planned threats and accepted risks.

| Threat ID / qualifier | Category | Component | Severity | Disposition | Mitigation and evidence | Status |
| --- | --- | --- | --- | --- | --- | --- |
| T-01-01 | Tampering / information disclosure | `domain/component-paths.ts` | high | mitigate | `validateComponentPath` calls `resolveContainedComponentPath` before `path.relative`, retaining raw spelling in refusals and dot for root. `tests/domain/component-paths.test.ts` and `tests/domain/plugin-resolver.test.ts` pass. | closed |
| T-01-02 / parsing | Denial of service / tampering | `domain/plugin-resolver.ts`, `orchestrators/plugin/shared.ts`, `orchestrators/plugin/info.ts` | medium | mitigate | Resolver parse and schema/dependency checks are inside the classified failure path; the version reader returns no tier-1 value on parse/read failure; info catches JSON/read failures. Commit `4053f227` adds a regular-file check before info reads bytes, excluding devices and FIFOs. Real device, directory and non-directory-wrapper tests verify shared absence handling. Commit `b64f0b98` adds observable malformed/ELOOP/non-object refusal assertions, proved by four failures under an info-only mutation and 177 passes after restoration. | closed |
| T-01-02 / input size | Denial of service | `domain/dependencies.ts` | low | accept | Linear array traversal remains bounded by the already-read JSON document; no array-count or manifest-byte cap is introduced. Individual rendered-field bounds were added by D-01-36. | closed |
| T-01-03 | Spoofing / output forgery | Dependency parser and info renderer | high | mitigate | Positive allowlists restrict all four rendered fields; name/marketplace are at most 256 characters, version 64, SHA 7–40 hex. Marketplace fill-in is validated before rendering. D-01-35 rejects the entire declaration on failure. Error reasons contain field paths, not raw rejected text. Parser and info tests pass. | closed |
| T-01-04 | Information disclosure / elevation | `resolveInfoPluginRootFsOnly` | high | mitigate | Path sources pass `derivePluginRootForInfo` and `assertPathInside`; failures return no root. Git sources accept only `makePresenceProbe`'s materialized arm. No materializing probe is called in these helpers. Cold-read/no-clone and architecture network tests pass. | closed |
| T-01-05 / parser | Tampering | `domain/dependencies.ts` object arm | medium | mitigate | Four named values are validated and copied into a newly constructed object. No arbitrary raw key is assigned or spread into the parsed dependency. The JSON boundary and field allowlists prevent an attacker-controlled extra key from becoming a result property. | closed |
| T-01-05 / skill discovery | Tampering | `bridges/skills/discover.ts` | medium | accept | Existing path containment and entry checks refuse symlinks. Same-directory tracking adds no filesystem read and does not bypass `isSkillDir` or name validation. | closed |
| T-01-06 | Tampering | `shared/path-safety.ts` | low | accept | The documented interval between containment checking and use remains; the accepted model excludes a concurrent in-process attacker. | closed |
| T-01-SC | Supply-chain tampering | Package installation | high | accept | The four implementation plans introduce no runtime dependency or semver library. Development dependency changes arriving through the main-branch merge are outside this plan-authored register and are not represented as audited by this acceptance. | closed |

## Accepted Risks Log

These acceptances were already present in the executed plans; this audit adds no new risk acceptance on the user's behalf.

| Risk ID | Threat reference | Rationale | Accepted by | Date |
| --- | --- | --- | --- | --- |
| R-01-size | T-01-02 / input size, plan 01-02 | No manifest-byte or dependency-count cap; linear parsing of an already-read JSON document | Existing plan disposition | 2026-09-14 audit |
| R-01-skill-links | T-01-05 / skill discovery, plan 01-03 | Existing containment and symlink policy remains in force; dedup introduces no new read | Existing plan disposition | 2026-09-14 audit |
| R-01-race | T-01-06, plans 01-01/03/04 | Documented containment/use race outside the stated concurrent-attacker model | Existing plan disposition | 2026-09-14 audit |
| R-01-packages | T-01-SC, all four plans | No package introduced by the planned implementation | Existing plan disposition | 2026-09-14 audit |

## Evidence Corrections

The plan's claim that `JSON.parse` does not create an own `__proto__` property is inaccurate: it can create that ordinary data property without changing the object's prototype. The relevant control is that the dependency parser never copies arbitrary keys or performs prototype assignment. Likewise, reading four named keys does not itself prove they are own properties; this audit relies on the JSON boundary, value validation, and controlled result construction, not that stronger claim.

The original silent-drop wording is superseded by D-01-35. Invalid declarations reject as a whole; `domain/manifest.ts` preserves valid marketplace siblings while isolating invalid entries, and info renders rejection for recorded installations. D-01-34 extends same-source dedup to commands without weakening containment. D-01-36 adds explicit field-length bounds.

## Security Audit Trail

| Audit date | Register rows | Blocking threats open | Run by | State |
| --- | --- | --- | --- | --- |
| 2026-09-14 initial | 9 | 0 | Validation/security hook agent | 8 closed; 1 medium open; sign-off withheld |
| 2026-09-14 after repairs | 9 | 0 | Validation/security hook agent | 9 closed; no blocking or nonblocking threats open |

All thirteen targeted files named in `01-VALIDATION.md` pass, including parser rejection/bounds, manifest refusal, source containment, command/skill dedup and no-network checks. The corresponding-test gate passes. The summary threat flags add no new register entry.

T-01-02 / parsing is closed by the repaired file-kind boundary and effective refusal assertions. `01-REVIEW-FIX.md` records full `npm run check` success (6,124 unit and 32 integration tests), info direct coverage at 100%, 177 focused passing tests, and a four-case negative control that fails specifically on the info notification. The temporary mutation was restored before the passing run. No source changes were made by this security audit.

The configured ASVS level is 1, every plan contained an authored threat register, and no open threats remain. This satisfies secure-phase's inline L1 closeout route; a deeper security-auditor dispatch is not required. This security result does not approve the separate logic-change human verification or the two pending live plugin UAT checks.

Independent re-review in `01-REVIEW.md` is clean: zero blockers, zero warnings, and 12 focused tests passed. CR-03 and CR-04 are closed. This does not replace the pending human verification.

## Sign-Off

- [x] All planned threats have dispositions.
- [x] Existing accepted risks are documented.
- [x] Planned high-severity mitigation evidence is present.
- [x] Resource-handling findings reconciled against their committed fixes and negative-control evidence.
- [x] `threats_open: 0` and `nonblocking_threats_open: 0` confirmed.
- [x] Final `status: verified` set.

**Approval:** automated ASVS L1 mitigation verification completed 2026-09-14; existing accepted risks remain as documented.
