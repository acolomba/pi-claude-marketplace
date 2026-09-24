---
phase: "117"
slug: "measured-agent-failure-evidence"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: validated
nyquist_compliant: true
wave_0_complete: true
created: "2026-09-09"
---

# Phase 117 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `node:test` + `node:assert/strict` (Node >= 20.19.0) |
| **Config file** | none — selection is the `package.json` brace glob |
| **Quick run command** | `node --test tests/architecture/workflows-doc-pins.test.ts tests/architecture/no-stale-test-citations.test.ts` |
| **Full suite command** | `npm run check` |
| **Estimated runtime** | quick run a few seconds; `npm run check` several minutes |

**The canary is deliberately outside all of it.** It is a standalone `.mjs`
driver: not part of `npm test`, not matched by the unit glob, not typechecked,
not linted, not prettier-checked. That is the established shape for
`tests/live-uat/`, and criterion 3 already frames the canary run as a HUMAN-UAT
item rather than an automated gate.

---

## Sampling Rate

- **Per task commit:** `pre-commit run --files <changed>` — which runs `npm run fallow`
  for any `tests/**/*.mjs` change — plus the two named architecture test files
- **Per wave merge:** `npm test` (the architecture suite is inside it)
- **Phase gate:** `npm run check` green, PLUS one recorded live canary run (green)
  and one recorded `--invert` run (red), both transcripts pasted into the SUMMARY
- **Max feedback latency:** a few seconds for the architecture pair

---

## Requirements → Validation Map

| Req | Behavior | Test type | Automated command | File exists? |
|---|---|---|---|---|
| WEVID-01 | a recoverable `agent()` failure resolves to `null` at engine 3.10.1 | live-UAT | `PI_CODING_AGENT_DIR=... PI_WORKFLOW_ENGINE_ROOT=... node tests/live-uat/workflow-agent-failure-canary.mjs` | ❌ Wave 0 |
| WEVID-01 | the assertion can fail (negative control) | live-UAT | same command with `--invert` (expect exit 1), plus the in-run differential control | ❌ Wave 0 |
| WEVID-01 | **A0: the run actually measured something** — a credentialed machine must not pass silently | live-UAT precondition | assert on `res.logs` for the missing-key failure before any verdict | ❌ Wave 0 |
| WEVID-01 | the canary parses | automated | `node --check tests/live-uat/workflow-agent-failure-canary.mjs` | ❌ Wave 0 |
| WEVID-02 | the doc names a canary path that resolves on disk | automated | `node --test tests/architecture/no-stale-test-citations.test.ts` | ✅ exists |
| WEVID-02 | the doc's pinned counts and classification table are unmoved by the edit | automated | `node --test tests/architecture/workflows-doc-pins.test.ts` | ✅ exists |
| WDOCS-02 | `105-VERIFICATION.md` carries no site claiming the W1/W2/W3 canary ran | reviewer-read | grep sweep over all four sites, reviewed | n/a |

---

## Wave 0 Requirements

- [x] `tests/live-uat/workflow-agent-failure-canary.mjs` — covers WEVID-01. MUST
      carry the whole-file `fallow-ignore-file unused-file` marker: a marker-less
      `tests/**/*.mjs` fails `fallow dead-code` with exit 1, measured by planting,
      and the `npm-fallow` pre-commit hook fires on it too.
- [x] `tests/live-uat/README.md` — a third row in the canary table plus a
      per-canary section. Note the "Needs live `pi`" column: this canary's answer
      is **no** (engine only), which is new for that table.
- [x] No framework install needed.

---

## The Negative Controls

Every gate this phase adds gets a control RUN before it is believed, and the
failing transcript goes in the SUMMARY. This milestone has shipped four guards
that were green while checking nothing.

1. **The canary's own assertion.** `--invert` must turn the green run RED at
   exit 1. A driver that cannot fail proves nothing.
2. **A0, the measurement precondition — the most important control here.** A
   machine that HAS provider credentials lets the `agent()` call succeed, so the
   canary would pass having measured nothing. Assert on `res.logs` that the
   missing-key failure actually occurred BEFORE reading any verdict, and prove
   that assertion fires by running once with credentials reachable (or by
   simulating the log absence).
3. **The doc-citation gate.** `no-stale-test-citations` fired during research
   only because the canary did not exist. After it exists, confirm the gate
   still fires by citing a path that does not resolve, then revert.

**The `agent()` doc section is UNPINNED** — proved by planting a full rewrite of
its rows and caveat, which left all four `workflows-doc-pins` cases green. Do not
invent a gate obligation that does not exist; do not claim the doc edit is
gated when it is not.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| The rewritten `agent()` section reads honestly — that the engines AGREE on the ordinary failure and diverge only on the non-recoverable class | WEVID-02 | Prose judgement; no gate reads it | Reviewer reads the section against the research's measured transcripts |
| `105-VERIFICATION.md`'s correction states what was actually closed and when, without rewriting history to look clean | WDOCS-02 | Prose and records judgement | Reviewer diffs the correction against the file's own `why_human` field |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] The live canary run (green) and the `--invert` run (red) both recorded as transcripts
- [x] A0 proven to fire, so a credentialed machine cannot pass silently
- [x] All four `105-VERIFICATION.md` contradiction sites corrected, including the `evidence:` block and the dangling `WINDOWS.md (id 5)` citation
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** validated 2026-09-09 — nyquist-compliant, 0 gaps

---

## Validation Audit 2026-09-09

| Metric | Count |
|--------|-------|
| Gaps found | 0 |
| Resolved | 0 |
| Escalated | 0 |

No auditor was spawned — both Wave 0 gaps closed during execution and every map
row has a real observation behind it. Measured rather than read:

| Map row | What closes it |
|---|---|
| recoverable `agent()` failure resolves to `null` at 3.10.1 | canary assertion A1, run green against a real scratch engine |
| the assertion can fail | `--invert` exits 1 naming A1; transcript verbatim in `117-01-SUMMARY.md` |
| **A0: the run actually measured something** | present at `workflow-agent-failure-canary.mjs:217-221`, asserted BEFORE any verdict is read, with its own `NOTHING WAS MEASURED` non-zero exit |
| the canary parses | `node --check` exits 0 |
| the doc names a path that resolves | `no-stale-test-citations` passes |
| the doc's pinned cases are unmoved | `workflows-doc-pins` passes (5 pass / 0 fail across the pair) |
| `105-VERIFICATION.md` claims no run that did not happen | five sites corrected, including the `evidence:` block |

**A0 was proven to fire, not merely written.** The seam
`const observedLogs = recoverable.logs;` was replaced with `[]` — the exact shape
a SUCCESSFUL call produces — and the run exited 1 with `NOTHING WAS MEASURED`
without reading a verdict. That control is the one that mattered most here: this
phase exists because a record once claimed a canary had run when it had not, and
a canary that passes on a credentialed machine having measured nothing would have
been the same defect wearing new clothes.

**Two risks the research rated open were closed by measurement.** The dupes gate
did not move — `fallow dupes` reports the same `1,045 lines (1.4%) across 40
files` as before the third canary existed, so no `ignoredClones` entry was added
or needed. And `PI_CODING_AGENT_DIR` alone proved sufficient isolation: `HOME`
was untouched on a machine that HAS working credentials, and every run still
induced the failure.

**One figure was deliberately not published.** The Anthropic clone turns out to
be pinned by a `.gcs-sha` the research missed, but the executor did not publish
that hash, because what it pins could not be established. Publishing a figure of
unverified semantics is the exact defect this phase corrects.
