---
phase: "115"
slug: "install-time-admission-gate-warnings"
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
created: "2026-09-09"
---

# Phase 115 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

______________________________________________________________________

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| Plugin-authored workflow script | Everything reaching `admitWorkflowScript` and `scanWorkflowsDirectory` is third-party and untrusted | JavaScript source, `meta` object literals, AST node shapes |
| Plugin-supplied path names | File and directory names discovered under a plugin's `workflows/` tree | Arbitrary byte sequences, including ASCII controls and Unicode format characters |
| Rendered notification block | `shared/notify.ts` renders what it is handed **without inspecting it** | Composed warning lines reaching the user's terminal |

The consequence of the third boundary is the phase's governing rule: escaping belongs
where untrusted text enters the string, not at the render site.

______________________________________________________________________

## Threat Register

30 threats, `T-115-01` … `T-115-30`, authored at plan time across all six PLAN files
(`register_authored_at_plan_time: true`). All 30 verified closed by
`gsd-security-auditor` at ASVS L1, with L2/L3-depth verification on the six items
below. Full per-threat evidence is in the audit agent's verdict; this table records
the dispositions and the entries that changed.

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-115-01 | Elevation of privilege | `readEngineGate`, check-8 helpers | critical | mitigate | No evaluator surface; every predicate is a property test on an acorn node already in hand. Gated in source by `tests/architecture/workflows-single-parse.test.ts` | closed |
| T-115-02 | Spoofing | `GATE_REASONS` | high | mitigate | Six string literals, zero interpolation; closed-set lookup keyed by a compiler-locked union. **See falsification note 1** | closed |
| T-115-03 | Denial of service | gate output volume | medium | mitigate | First-failure-wins via `GATE_ORDER.find`; at most one line per file | closed |
| T-115-04 | Denial of service (plugin author) | `admitWorkflowScript` | high | mitigate | `gate?` exists only on the two ADMITTED arms, so a gate reading cannot construct a refusal; `readEngineGate` contains its own throws. Measured: nesting 40 → `named`, `gate=undefined` — a missed warning, not a refusal | closed |
| T-115-05 | Information disclosure | embedded absolute directory | medium | mitigate | Five render sites, five redactions | closed |
| T-115-06 | Tampering | dependency manifests | high | mitigate | `git diff --quiet` over `package.json`, `package-lock.json`, `sonar-project.properties`, `CHANGELOG.md` → clean | closed |
| T-115-07 | Repudiation | warning claiming a disposal that did not happen | medium | mitigate | Install-tense phrase states the admitted fact before the caveat | closed |
| T-115-08 | Elevation of privilege | the single-parse gate | critical | mitigate | Gate proven able to fail against five planted patterns plus a missing target | closed |
| T-115-09 | Tampering | the gate itself | high | mitigate | `readFile` not subprocess; `stripComments` before every match; missing-target assertion fires | closed |
| T-115-10 | Spoofing | gate predicates | medium | mitigate | Predicates read node types and a reserved-key set; no attacker-chosen text steers a verdict | closed |
| T-115-11 | Repudiation | comment truthfulness | low | accept | Reviewer-read; the ungated "eleven" counts were removed under WR-06 | closed |
| T-115-12 | Tampering | dependency manifests | high | mitigate | as T-115-06 | closed |
| T-115-13 | Information disclosure | new standalone render sites | high | mitigate | `redactAbsolutePaths` mapped over every line before `notifyDiagnostic`; both new sites assert the cwd does not appear | closed |
| T-115-14 | Denial of service (plugin author) | plugin-level row | high | mitigate | Whole-record `deepStrictEqual` against a gate-free baseline, with non-vacuity assertions | closed |
| T-115-15 | Spoofing | `softFailWarning` interpolation | medium | ~~accept~~ → **mitigate** | **Reclassified.** The accept rationale was falsified; fixed under CR-01. **See falsification note 2** | closed |
| T-115-16 | Repudiation | discovery-warning header | medium | ~~accept~~ → **mitigate** | **Reclassified.** Header rewritten under WR-01; Broken Windows #36 closed | closed |
| T-115-17 | Tampering | dependency manifests | high | mitigate | as T-115-06 | closed |
| T-115-18 | Information disclosure | `info` preview path | high | mitigate | `redactAbsolutePaths` at the preview render site, asserted positively | closed |
| T-115-19 | Spoofing | catalog fixture | medium | mitigate | Catalog state driven through the real `notify()` and byte-compared | closed |
| T-115-20 | Denial of service (plugin author) | `info` row | high | mitigate | Key-set assertion proves no severity key is added; note-line partition compared to a gate-free baseline | closed |
| T-115-21 | Tampering | dependency manifests | high | mitigate | as T-115-06 | closed |
| T-115-22 | Repudiation | doc rows vs source | high | mitigate | Doc rows bound to `GATE_ORDER` read from analyzer source | closed |
| T-115-23 | Tampering | the doc-pin gate | high | mitigate | Column partition is a separate assertion from the gate-name comparison; both assert on absence | closed |
| T-115-24 | Information disclosure | engine line-number citations | low | accept | New `src/...` citations each carry the "source-read at 3.10.1" pin. Carrier: Broken Windows #34, open | closed |
| T-115-25 | Spoofing | retired "seven gates" phrasing | medium | mitigate | Barred by the doc-pin gate; zero occurrences remain | closed |
| T-115-26 | Tampering | dependency manifests | high | mitigate | as T-115-06 | closed |
| T-115-27 | Repudiation | backlog pruned footer | medium | mitigate | Footer names both closing milestones in one sentence and cites requirement IDs | closed |
| T-115-28 | Tampering | backlog structure | medium | mitigate | Exactly one `##` heading changed in `.planning/BACKLOG.md` | closed |
| T-115-29 | Information disclosure | footer contents | low | accept | Public repository paths and requirement IDs only | closed |
| T-115-30 | Tampering | plan 06 scope | high | mitigate | Touched no source file and no manifest | closed |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above `workflow.security_block_on` count toward `threats_open`*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

______________________________________________________________________

## Two falsified register claims

Recorded because the pattern matters more than either instance: a mitigation can be
true of the component it names and false one function away.

**Note 1 — T-115-02.** The claim that "no script-derived text is interpolated, so no
`meta` key name, node type or declared identifier can carry a newline that forges an
output line" is true **of `GATE_REASONS`** and was verified. But the register offered
it as the phase's answer to output forgery, and the forgery lived in the sibling
composer: `softFailWarning` interpolated the plugin-controlled file name raw. The deep
code review demonstrated it against the real bridge; the fix pass then found a **third**
unescaped span the review had missed — `reason`, which on the two IO paths is
`errorMessage(err)`, and an errno message quotes the offending path back verbatim.
**This threat closed because of the review, not because the authored mitigation was
sufficient.**

**Note 2 — T-115-15.** The accept rationale read: *"The outer `softFailWarning`
interpolation of the discovered file name is PRE-EXISTING and unchanged by this phase …
Widening the render to two more verbs does not change the escaping posture."* Both
halves were wrong in the way that mattered. Pre-existing did not mean safe, and widening
the render to `install` and `reinstall` is precisely what made an unescaped span
reachable from two more verbs. **An `accept` justified by "unchanged" is a pattern worth
distrusting.**

All three spans now route through the exported `forMessage`
(`domain/workflow-script.ts:1124`), which escapes `\p{Cc}` and `\p{Cf}`. Verified by
running the real bridge against a hostile tree — a directory named `work\nflows`, a
script named `ok.js"\nworkflow script "forged.js"...\n.js`, an EACCES file whose errno
quotes the path back, and a name carrying U+202E: two warnings produced exactly two
rendered body lines, with zero raw control or format characters surviving.

______________________________________________________________________

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-115-01 | T-115-11 | Comment truthfulness is reviewer-read, not gateable. The two ungated "eleven" counts this covered were removed under WR-06, so nothing currently rests on it | autonomous run | 2026-09-09 |
| AR-115-02 | T-115-24 | Engine line-number citations will rot on an engine bump. Each new citation carries the inline "source-read at 3.10.1" pin, so the staleness is declared rather than silent. Carrier: Broken Windows #34, open; `WPIN-01` is the named future subject | autonomous run | 2026-09-09 |
| AR-115-03 | T-115-29 | The pruned backlog footer holds public repository paths and requirement IDs only — nothing that is not already in the repository's history | autonomous run | 2026-09-09 |

T-115-15 and T-115-16 were authored as `accept` and are **not** in this log: both were
reclassified to `mitigate` and fixed. All accepted risks sit below the `high` blocking
threshold, so `threats_open` is 0 regardless of how this log resolves.

______________________________________________________________________

## Residual flags (not introduced by this phase)

| Flag | Assessment |
|------|------------|
| `PathContainmentError` interpolates the untrusted resolved `child` path raw (`shared/path-safety.ts:13`) | Pre-existing, shared by five bridges, genuinely rendered into the user-facing cause-chain trailer. Escaping a caller's label closes nothing, which is why fixing the label alone was declined. Carrier: Broken Windows #37, open. Severity assessed **high**, not critical: the forged text lands inside an install *failure*, where the user is already reading an error, rather than inside a success notification |
| `forMessage` does not escape U+2028 / U+2029 | Residual, low. `notifyDiagnostic` joins on `\n` only and no terminal breaks on these |
| `assertSafeName` blocks ASCII control characters but not U+202E | Pre-existing and repo-wide — every notify row interpolates plugin names. Cannot forge a line; can reverse one |
| `redactAbsolutePaths` can consume the backslash of an adjacent `forMessage` marker | Cosmetic, and it errs safe — the control character stays neutralized |

______________________________________________________________________

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-09-09 | 30 | 30 | 0 | `gsd-security-auditor` (ASVS L1, L2/L3 depth on six items) |

Verification went beyond register review: the auditor drove the real bridge against a
hostile tree, proved the single-parse gate fails against five planted patterns plus a
missing target and a renamed declaration, and measured the depth budget's behaviour at
nesting 40, 1000–10000, and a 200,000-element array. It counted every set a mitigation
claimed to cover rather than accepting the claim — which is how both falsifications
above were found.

______________________________________________________________________

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-09-09
