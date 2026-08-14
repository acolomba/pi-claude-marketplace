---
phase: 101
slug: manifest-field-and-precedence-resolution
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
created: 2026-08-14
---

# Phase 101 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

Blocking severity: `high`. No threat in this register is rated `high` or
`critical`, so nothing here blocks phase advancement.

This is an honest short register. The phase adds one optional boolean to two
input schemas and computes one derived boolean in a pure, disk-free,
network-free domain function. It opens no new input channel, writes no file,
composes no path, runs no command, and introduces no authorization decision.
The one real consideration is that the new field arrives from untrusted
third-party content — and it is handled by the same compiled TypeBox validator
that already guards every other field on those two schemas.

The register was authored at plan time across all three plans
(`register_authored_at_plan_time: true`), so this audit verified that each
declared mitigation exists rather than scanning for new threats.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| `marketplace.json` → extension | Third-party marketplace manifest content crosses here on every cached load. The new field is one more property inside the already-validated `plugins[]` entry. | Untrusted third-party JSON |
| `plugin.json` → extension | Third-party plugin-authored manifest content crosses here in `readManifest`. Same validator posture. | Untrusted third-party JSON |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-101-01 | Tampering | `domain/manifest.ts::loadMarketplaceManifestUncached` via `MARKETPLACE_VALIDATOR.Check` | medium | mitigate | A hostile `marketplace.json` supplying a non-boolean `defaultEnabled` is rejected before any consumer reads it. The field is `Type.Optional(Type.Boolean())` inside the entry schema `MARKETPLACE_SCHEMA` embeds, so the whole manifest fails with a typed `InvalidMarketplaceManifestError`. No coercion, no bespoke error class, no per-plugin skip. | closed |
| T-101-02 | Tampering | `domain/resolver.ts::readManifest` via `PLUGIN_MANIFEST_VALIDATOR.Check` | medium | mitigate | A hostile `plugin.json` supplying a non-boolean value fails the same validator and `preflightStages` resolves `unavailable` with the existing `malformed plugin.json:` note — the plugin cannot install at all. The note prefix is unchanged, so downstream classifiers keying on it are unaffected. | closed |
| T-101-03 | Tampering | `domain/resolver.ts::resolveDefaultEnabled` | low | mitigate | A caller that casts a garbage entry past the validator reaches the helper with a non-boolean. The uniform `typeof === "boolean"` narrow on both sides degrades that to the `true` default rather than returning a non-boolean where a boolean is typed. Defense-in-depth, not a validation layer. | closed |
| T-101-04 | Elevation of privilege | install path, `orchestrators/plugin/install.ts` | low | accept | A plugin could declare `defaultEnabled: false` to appear inert while still materializing its artifacts. Nothing acts on the value in this phase, so the deception has no effect here. The mitigation belongs to the phase that makes an install-disabled plugin genuinely not materialize. | closed (accepted) |
| T-101-05 | Tampering | `domain/resolver.ts::resolveLoose` conflict machinery | low | mitigate | Widening the loose-mode conflict accumulators from closed tuples to open key iteration would turn every metadata field into conflict material and push ordinary plugins to `unavailable`. Nothing in this phase does that; the loose-mode non-conflict test is the regression guard. | closed |
| T-101-06 | Repudiation | `tests/orchestrators/plugin/install.test.ts` seeding fixture | low | mitigate | A seeder knob that silently altered the default seeded shape would make every pre-existing test in a 3000-line file assert against a different fixture than its author intended, invisibly in review. Both new opts are strictly additive and `!== undefined`-guarded with no default. | closed |
| T-101-SC | Tampering | npm/pip/cargo installs | low | accept | This phase installs no external package and adds no `package.json` entry, so the package-legitimacy gate has no input. `typebox` and `node:test` are existing pinned dependencies. Recorded rather than omitted so a later task adding an install cannot inherit silence. | closed (accepted) |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Mitigation Evidence

Each `mitigate` disposition was confirmed against the tree, not against the
SUMMARY's claim.

| Threat ID | Evidence |
|-----------|----------|
| T-101-01 | `extensions/pi-claude-marketplace/domain/components/plugin.ts` declares `defaultEnabled: Type.Optional(Type.Boolean())`. `tests/domain/manifest.test.ts` — "one malformed defaultEnabled rejects the WHOLE marketplace.json" writes a malformed entry with a valid sibling, asserts `instanceof InvalidMarketplaceManifestError` and matches `/\/plugins\/0\/defaultEnabled/`, so partial trust in a failed file is excluded by construction. Rejection cases cover both `string` and `null`. |
| T-101-02 | `tests/domain/resolver-strict.test.ts` — "non-boolean defaultEnabled in plugin.json -> unavailable + malformed plugin.json" asserts the arm and the note prefix. |
| T-101-03 | `resolveDefaultEnabled` in `domain/resolver.ts` uses `typeof entry.defaultEnabled === "boolean"` then `typeof manifest?.defaultEnabled === "boolean"`, falling through to `return true`. Both sides narrow identically; there is no error path. |
| T-101-05 | `tests/domain/resolver-loose.test.ts` carries the D-101-08 non-conflict proof placed directly after the MM-6 conflict test it inverts. |
| T-101-06 | `tests/orchestrators/plugin/install.test.ts` guards both knobs with `if (opts.entryDefaultEnabled !== undefined)` and `if (opts.pluginJsonDefaultEnabled !== undefined)`; the full suite passes unmodified. |
| T-101-SC | `git diff --name-only 75dba75b..HEAD -- package.json package-lock.json` is empty — no dependency was added. |

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| R-101-01 | T-101-04 | The deceptive-declaration case has no effect while nothing acts on the resolved value. The install characterization tests pin today's honest behavior — the plugin installs enabled and its artifacts ARE materialized, so nothing is hidden from the user at this phase. Mitigation is owned by the phase implementing DFEN-04. | acolomba | 2026-08-14 |
| R-101-02 | T-101-SC | No external package is installed and no `package.json` entry is added, so the package-legitimacy gate has no input. Recorded so a later task adding an install cannot inherit silence. | acolomba | 2026-08-14 |

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-08-14 | 7 | 7 | 0 | gsd-secure-phase (orchestrator, ASVS L1 short-circuit) |

The ASVS L1 short-circuit applied: `threats_open: 0` with
`register_authored_at_plan_time: true` at level 1 means grep-depth verification
is sufficient and no separate auditor pass was required.

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-08-14
