---
phase: "01"
slug: "reliable-negative-controls"
status: secured
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
created: "2026-09-19"
register_authored_at_plan_time: false
---

# Phase 01 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|----------------|
| Developer/CI shell to harness | The harness runs at the invoking user's privilege under `npm run check`, locally and on the CI runner | CLI arguments, ambient environment, working directory |
| Harness parent to child process | A child's outcome must reach the parent as five independent facts, not one conflated verdict | Command name, argument array, stdio descriptors; launch error, signal, exit status, stdout bytes, stderr bytes |
| Harness to temporary fixture root | Every fixture, git repository and captured stream lives under one `mkdtemp` root and is removed unconditionally | Fixture files, fixture git repositories, captured child stdout/stderr |
| Gate CLI to the real repository | The gate reads the working tree and asks git for refs; ref names are the one input that comes back from git rather than from a literal | Git ref names, changed paths, source and test file reads (read-only) |
| Repository to published package | No crossing: `scripts/` is excluded from `package.json` `files` | (none) |

---

## Threat Register

Evidence paths are relative to the repository root. `negative.mjs` = `scripts/test-coverage-direct.negative.mjs`; `direct.mjs` = `scripts/test-coverage-direct.mjs`.

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-01-01 | Tampering | Negative-control observation path | high | mitigate | File-backed capture avoids the sandbox pipe path (`negative.mjs:38-69`); launch error, signal, status, stdout and stderr checked as five independent facts (`negative.mjs:72-84`); both real CLI mapping refusals require exact status 1, empty stdout, exact stderr (`negative.mjs:344-350,352-358`) | closed |
| T-01-02 | Tampering | Offender/benign discrimination | high | mitigate | An inert observer cannot pass: benign success, deliberate nonzero failure, wrong-status offender, missing-diagnostic offender, launch failure ENOENT, signal termination SIGTERM all discriminated (`negative.mjs:259-341`) | closed |
| T-01-03 | Repudiation | Fixture git result (`fixtureGit`) | medium | mitigate | Launch error, then signal, then nonzero status refused separately, each with its own message (`negative.mjs:113-130`) | closed |
| T-01-04 | Repudiation | Shallow-parent refusal control | medium | mitigate | Refusal requires no launch error, no signal, status 128, empty stdout, nonempty stderr (`negative.mjs:559-569`). Residual disclosed as AR-01-01 | closed — accepted residual |
| T-01-05 | Elevation of privilege | Subprocess argument construction | high | mitigate | No `shell: true`/`exec`/`execSync` anywhere; every launch is `spawnSync(command, argsArray, …)` (`negative.mjs:51`; `direct.mjs:110,615`). The one non-literal ref name is matched against `baseCandidateName` (`direct.mjs:141`, excludes leading `-`) at both entry points that can carry it (`direct.mjs:156,179`) | closed |
| T-01-06 | Information disclosure | Captured child output on disk | medium | mitigate | Every capture path composed under the `mkdtemp` root (0700, unpredictable suffix); fresh monotonic index per observation; `openSync(…, "w")` truncates | closed |
| T-01-07 | Denial of service | Descriptor and temp-file lifetime | low | mitigate | Nested `try`/`finally` closes both descriptors even on open/launch throw (`negative.mjs:44-60`); one top-level `finally` removes the whole root (`negative.mjs:928-929`) | closed |
| T-01-08 | Tampering | Gate strength (no silent weakening) | high | mitigate | `96dd81f4` touches only the two scripts plus planning docs; pin/exception files untouched. Both expected diagnostics byte-identical to pre-phase text; assertion strengthened (exact status 1 + empty stdout + exact stderr, from a looser `notEqual`+`match`) | closed |
| T-01-09 | Tampering | `gitLines` stdio narrowing | medium | mitigate | Only stdin set to `ignore`; stdout/stderr remain separate pipes (`direct.mjs:110-114`); launch-error and nonzero-status refusals unchanged, still carry stderr | closed |
| T-01-10 | Repudiation | Backlog history reconciliation (plan 02) | low | mitigate | No archived record rewritten: `3b246091` touches no file under `.planning/milestones/`; closure appends a dated header, preserves original report as history; deferred todo history labelled explicitly | closed |
| T-01-11 | Spoofing | Fixture git identity and configuration | low | mitigate | Fixture repos never touch global git config: `user.email`/`user.name`/`commit.gpgsign` set locally per fixture root (`negative.mjs:143-146`); explicit cwd under temp root; shallow clone over `file://` from a sibling fixture — no network | closed |
| T-01-12 | Tampering | Child environment inheritance | low | mitigate | No mitigation found: every `spawnSync` inherits ambient `process.env` (no `env:` option, no `GIT_*` scrubbing). An exported `GIT_DIR`/`GIT_WORK_TREE`/`GIT_CONFIG_GLOBAL`/`GIT_INDEX_FILE` could redirect fixture git commands away from the temp root. Severity low: requires the poisoned value already exported in the invoking shell | open — below high threshold (non-blocking) |

*Status: open · closed · closed — accepted residual · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-01-01 | T-01-04 | The shallow `HEAD~1` control requires nonempty stderr rather than exact stderr bytes, because git localizes that diagnostic. The other four facts (no launch error, no signal, status 128, empty stdout) still discriminate a launch failure, a signal, a wrong status, and a silent git; the residual is only that a differently-worded status-128 git failure would satisfy this one control. | Phase 01 code review (gsd-code-reviewer), 2026-09-14 | 2026-09-14 |

*T-01-12 is tracked open (non-blocking, low severity) rather than accepted — see Unregistered Flags follow-up.*

---

## Unregistered Flags

Neither `01-01-SUMMARY.md` nor `01-02-SUMMARY.md` contains a `## Threat Flags` section. `01-01-SUMMARY.md:131` states "no new threat surface remains" as a self-check line rather than a register. The register above was built retroactively from the implementation diff (`96dd81f4`, `3b246091`), which surfaced one item the executor never flagged:

- `observeChild` (`negative.mjs:38-69`) is a new subprocess-spawning helper introduced by this phase and inherits the ambient environment — registered above as **T-01-12** (open, non-blocking).

**Follow-up worth tracking, not blocking:** T-01-12 closes by passing an explicit `env` to the fixture git launches in `scripts/test-coverage-direct.negative.mjs` (strip/override `GIT_DIR`, `GIT_WORK_TREE`, `GIT_INDEX_FILE`, `GIT_CONFIG_GLOBAL`) — a one-line hardening at `negative.mjs:51`, not a shipped-code fix.

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-09-19 | 12 | 11 | 1 (non-blocking) | gsd-security-auditor (retroactive STRIDE audit ahead of catch-up PR; commits `96dd81f4`, `3b246091`) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-09-19
