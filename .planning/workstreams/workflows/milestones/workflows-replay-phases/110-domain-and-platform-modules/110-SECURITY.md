---
phase: "110"
slug: "domain-and-platform-modules"
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
block_on: high
register_authored_at_plan_time: true
created: "2026-09-09"
---

# Phase 110 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

Run retroactively. All three plans carried a `<threat_model>` block, so the
register is plan-time authored and complete — the audit verified mitigations
rather than reconstructing threats.

This is the phase that introduces **parsing of untrusted third-party
JavaScript**, so the audit ran deeper than L1 on two threat families named
below.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| Workflow script text to acorn | A third party's `.js` file is parsed to read `meta.name` off the AST | Fully attacker-controlled JavaScript source |
| `meta.name` to filesystem path | The declared name becomes a command name and a path segment | Attacker-controlled string, screened before use |
| Project path to project key | The absolute project path is slugged and hashed into a directory segment | Local path, not a secret; see R-110-01 |
| `acorn` as a new runtime dependency | A registry package now runs in-process | Third-party code; integrity-pinned |

---

## Threat Register

`T-110-SC` recurs once per plan and carries different severity and disposition
in plan 03 than in plans 01 and 02 — plan 03 is the one that actually installs
`acorn`. Each row was audited independently.

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-110-01 | Tampering | project-key slug as path segment | high | mitigate | `workflow-project-key.ts:44-52` collapse → strip → slice 48 → fallback; `/` row `workflow-project-key.test.ts:93-94`, `..` row `:105-107` | closed |
| T-110-02 | Tampering | `workflowHomeDir` relocation input | medium | mitigate | `workflow-home.ts:30-32` — one export, zero params, `path.join(os.homedir(),…)`; no `process.env`/`process.cwd` token; no test seam | closed |
| T-110-03 | Tampering | HOME/cwd mutation leaking from owner test | low | mitigate | `workflow-home.test.ts:24-34` — saved `:24`, `t.after()` `:26`, mutated `:34`; cwd pair same ordering `:56-64` | closed |
| T-110-04 | Information disclosure | key leaking absolute project path | low | accept | In-code acceptance at `workflow-project-key.ts:38-39` | closed |
| T-110-05 | Spoofing | two projects colliding on one key | low | accept | Same note `:38-39`; 12-hex slice is byte-parity with the engine `:68` | closed |
| T-110-SC (01) | Tampering | npm install | low | accept | Verified, not assumed — the only phase-110 `package.json` touch is `d3c5be6f`, in plan 03 | closed |
| T-110-06 | Spoofing | engine-unsafe generated name | high | mitigate | `name.ts:301` (`/[\s/\\\0]/u`), `:308` (`/[\p{Cc}\p{Cf}]/u`); interior/leading/trailing space rows `name.test.ts:539-557` | closed |
| T-110-07 | Tampering | bidi / zero-width control hiding a name | high | mitigate | `name.ts:308`; U+200B `name.test.ts:558-565`, U+202E RLO `:566-573` | closed |
| T-110-08 | Tampering | path traversal via generated name | high | mitigate | `name.ts:226` calls `assertSafeName`; re-screened at `:301` incl. NUL; separator row `name.test.ts:532-537` | closed |
| T-110-09 | Spoofing | one script silently claiming another's name | high | mitigate | `errors.ts:659-675` structured `collisions`, `Object.freeze([...])` `:674`; throw path `workflow-script.ts:250-271`, no first-wins dedup | closed |
| T-110-10 | Information disclosure | message echoes name and file names | low | accept | Echo deliberate, `errors.ts:662-672`, rationale `:648-658` | closed |
| T-110-11 | DoS | pathological `meta.name` validation cost | low | accept | Structurally true: both patterns are flat classes with **zero** quantifiers (`name.ts:301,308`) and run **after** the 128 cap `:287` | closed |
| T-110-SC (02) | Tampering | npm install | low | accept | Same git evidence | closed |
| T-110-12 | Elevation of privilege | untrusted script text | **critical** | mitigate | Whole-file scan for `eval`/`new Function`/`node:vm`/`require(`/`import(`/`child_process`/`execSync`/timers → **0 matches**. The only call into untrusted text is `parse()` at `workflow-script.ts:604`; non-literals are classified, never resolved (`:813-823`, `:980-1002`) | closed |
| T-110-13 | Tampering | prototype pollution via `__proto__` in `meta` | medium | mitigate | `readMetaString:763-787` returns a tagged union; key handling is a string compare `:777`. No computed assignment, no `Object.assign`, no spread-into-object. Strengthened by `RESERVED_META_KEYS:923,967` | closed |
| T-110-14 | Spoofing | comment or string decoy beating the declared name | high | mitigate | Walk is over `ast.body` `:661-673`; comments land in a separate array `:598,609`. Three decoy cases `workflow-script.test.ts:167-200` | closed |
| T-110-15 | Spoofing | one script claiming another's name (set level) | high | mitigate | `assertNoWorkflowNameCollisions:250-271`; both claimants asserted structurally `workflow-script.test.ts:1380-1394` | closed |
| T-110-16 | DoS | ReDoS on the vendored determinism pattern | low | accept | Literal read `:459` — flat alternations, only non-nested `\s*`/`\s+`; per-call clone `:476-478` prevents `lastIndex` carryover | closed |
| T-110-17 | DoS | parser resource exhaustion (no size or depth cap) | medium | accept | **No cap exists, deliberately** — `parseScript:597-624` hands `source` straight to acorn. See R-110-04 | closed |
| T-110-18 | Tampering | stale vendored blocklist vs upgraded engine | medium | accept | Standing re-read obligation in code, `workflow-script.ts:437-443` | closed |
| T-110-SC (03) | Tampering | `acorn` as a new runtime dependency | high | mitigate | `dependencies.acorn = "^8.16.0"`, absent from devDependencies; lockfile pins `8.16.0` from `registry.npmjs.org` with sha512 integrity (`package-lock.json:3371-3382`); no install-time lifecycle script npm will run | closed |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| R-110-01 | T-110-04, T-110-05 | The project key is a namespacing device, not a security boundary — no salt and no HMAC. It leaks the absolute project path to anyone who can read the key, and two projects can in principle collide on one key. Stated in code at `workflow-project-key.ts:38-39`. The 12-hex slice is byte-parity with the host engine, which is the reason not to widen it. | gsd-security-auditor (retroactive) | 2026-09-09 |
| R-110-02 | T-110-10 | Collision error messages deliberately echo the claimed name and the competing file names, because a collision the user cannot attribute to files is not actionable. Rationale at `errors.ts:648-658`. | gsd-security-auditor (retroactive) | 2026-09-09 |
| R-110-03 | T-110-11, T-110-16 | Neither the name screens nor the vendored determinism pattern is ReDoS-exposed: the name patterns carry zero quantifiers and run after a 128-character cap; the determinism pattern has only non-nested `\s*`/`\s+` and is cloned per call. Accepted as structurally safe rather than mitigated by a timeout. | gsd-security-auditor (retroactive) | 2026-09-09 |
| R-110-04 | T-110-17 | **No parse size or depth cap.** Deliberate: the host engine has none either, and a cap stricter than the engine's would refuse a script the engine accepts. Only the lax direction self-corrects across engine upgrades — a spurious warning costs a line of output, a spurious refusal costs an extension release. Documented three times (register row `110-03-PLAN.md:190`, prohibition `:46`, and its own section `110-03-SUMMARY.md:345-349`). Severity `medium`, below the `high` block threshold, so non-blocking on two independent grounds. | operator (via plan prohibition), re-confirmed by gsd-security-auditor | 2026-09-09 |
| R-110-05 | T-110-18 | The vendored determinism blocklist is a copy of an engine internal and can silently disagree with a newer engine. Carried as a standing human re-read obligation in the source comment rather than a machine check; `WPIN-01` in REQUIREMENTS.md tracks making it machine-checkable. | gsd-security-auditor (retroactive) | 2026-09-09 |
| R-110-06 | T-110-SC (plans 01, 02) | Neither plan installed a package; the only phase-110 dependency change is plan 03's `acorn`, which is separately registered at `high`/`mitigate`. | gsd-security-auditor (retroactive) | 2026-09-09 |

---

## Verdict on the two deep-audited families

**1. Parser-facing input handling — sound.** The module never leaves the
"parse, classify, never resolve" posture, and there is no evaluation construct
anywhere in the file, not even inside a comment. Every throw path out of
`admitWorkflowScript` is bounded: acorn's throw is caught at
`workflow-script.ts:612-614` and becomes a `refused`/`unparseable` verdict;
`generatedWorkflowName`'s throw becomes a per-file `refused`; and the gate walk
is contained by its own catch at `:842-848`, so its `GATE_WALK_MAX_DEPTH` throw
(`:981-983`) cannot escape either. The one deliberate throw is the plugin-name
defect at `:184`, a set-level fault by design.

**2. The name-gate loosening opened no containment hole.** The WNAM-06 override
is confined to `name.ts:211-212`: when stripping the `<plugin>-` prefix would
empty the head, `elided` falls back to the full `source` instead of throwing.
Every screen still runs unconditionally on the joined name afterwards —
`assertSafeName(generated)` at `:226`, `assertSafeSavedWorkflowName(generated)`
at `:231`, and the lone-surrogate screen at `:244`. The loosened branch cannot
reach a `return` that skips any of them, so separator, NUL and
control-character screening holds intact. The override supersedes a `must_have`,
not a mitigation; no register row depended on the empty-head throw.

---

## Divergences

1. **The implementation is stricter than the register in three places**, all
   from post-review fixes present in the current tree: the lone-surrogate screen
   `name.ts:244-249` (WR-12, no register row), the `meta-computed-key` opaque arm
   `workflow-script.ts:772-774` (WR-11), and `RESERVED_META_KEYS:923` covering
   `__proto__`/`constructor`/`prototype`, which strengthens T-110-13.

2. **`T-110-SC` reuses one ID across three plans at two different
   severities** — `low`/`accept` in plans 01 and 02, `high`/`mitigate` in plan
   03. Scoped per plan it is coherent, and all three verify closed
   independently, but a naive merge would silently pick one. Register hygiene,
   nothing turns on it.

3. **Precision on the `acorn` supply-chain claim.** "No `postinstall` script" is
   accurate. The published tarball does carry `"prepare": "cd ..; npm run
   build:main"`, which npm does not execute for a registry install — only for
   git-URL or local-directory installs. The mitigation holds; the sharper
   statement is "no install-time lifecycle script npm will run."

4. **No summary carries a `## Threat Flags` section.** Absence was not treated
   as evidence that no new surface appeared — every mitigation above was
   verified by reading the current implementation. The one threat-shaped
   disclosure an executor did write (`110-03-SUMMARY.md:345-349`) maps cleanly to
   T-110-17.

5. **Scope note.** `domain/workflow-script.ts` is now 1169 lines, not the 684
   this phase shipped — the `WGATE-*` engine-gate reader extended it in a later
   phase. The audit read the current tree; every phase-110 mitigation still holds
   there, and the extensions add screens rather than removing any.

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-09-09 | 21 | 21 | 0 | gsd-security-auditor (retroactive, opus) |

Register parse: 21 rows across 3 plans — 6 / 7 / 8. Matches the orchestrator's
independent mechanical count, so no plan was audited as a subset.

Live confirmation during the audit: `node --test` over `workflow-script.test.ts`,
`name.test.ts`, `workflow-project-key.test.ts`, `workflow-home.test.ts` and
`errors.test.ts` — 294 pass, 0 fail.

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-09-09
