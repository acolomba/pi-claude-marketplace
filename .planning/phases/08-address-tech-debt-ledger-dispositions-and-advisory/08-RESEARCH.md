# Phase 8: Address tech debt: ledger dispositions and advisory - Research

**Researched:** 2026-10-10
**Domain:** GSD ledger bookkeeping, npm lockfile remediation, Node test-runner environment ordering, planning-record edits
**Confidence:** HIGH (every mechanism was exercised in a scratch copy or read from source this session; one evidence correction, see Open Question 1)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

The user selected the recommended option for every question on 2026-10-10.

#### Inherited ledger entries (ids 32-34, 41-58; 21 entries from test-backlog)

- **D-01:** Waive each entry with `gsd_run windows waive <id> "<reason>"`. The
  reason is prefixed `[json-output]` and names commit `d7213bc2` (#236,
  2026-10-05, "perf(checks): run only incremental checks before commits") as the
  change that deleted the tooling the entry records a deviation against:
  the unused-type-member live gate (32-34) or the coverage-producer pipeline
  (41-58). Shape: `[json-output] Moot: records a scope deviation against the
  <gate or pipeline>, which #236 (d7213bc2, 2026-10-05) deleted; nothing remains
  to fix. The shipped work was audited at the test-backlog close.`
- **D-02:** Not `fixed`: no code change resolved these entries, and `fixed`
  carries no reason, so a future reader could not tell retirement-by-deletion
  from repair. Not triaged individually: 15 of the 17 files the entries name
  are absent, and the two present ones (`bridges/hooks/stage.ts`,
  `edge/handlers/tools.ts`) are named only as sites the deleted analyzer
  under-credited.

#### This milestone's entries (84, 85, 88, 89)

- **D-03 (84):** Add a BACKLOG.md carrier **WOUT-01** ("workflow output quality
  unobserved: engine subagents declined every tool call under the only authed
  provider") holding the measured facts from the entry (engine 3.13.0, pi
  0.85.1, `tmp/pi-uat`, `modernize-harden-scan` completed in 16.5 s with zero
  findings, SCHEMA_NONCOMPLIANCE negative control, `agent.ts:818` default
  tools) and the settle recipe (an Anthropic key in `tmp/pi-uat/agent`, one
  re-run of the canary). Then `windows waive 84 "[json-output] Carried to
  BACKLOG.md WOUT-01: ..."`. Follows the workflows-replay precedent (#61, #64,
  #66, #72, #74, #79, #80 each name their carrier).
- **D-04 (85):** `gsd_run windows fixed 85`. Plan 01-03 shipped;
  `node --test tests/orchestrators/marketplace/update.test.ts` exits 0 on this
  tree (verified 2026-10-10 during discussion, and again by the audit).
- **D-05 (88):** Waive as accepted design. Reason records the constraint:
  `composeContextBlocks` in `shared/notification-dispatch.ts` is the one
  production reader of grammar's exported `renderMpHeader` and
  `composePluginLines`; deleting it fails the fallow dead-code gate, and 15 test
  files hold 138 references to those two exports. Output bytes are pinned by the
  corpus and catalog gates either way, so relocation buys no behavior.
  — **Reversibility:** reversible — a later phase can still move the composer;
  the waiver records why it was not moved here.
- **D-06 (89):** Fix the test ordering, then `gsd_run windows fixed 89`. Root
  cause (verified 2026-10-10): `createHermeticEnvironment` repoints `HOME` before
  `loadPiSubagentsSkillsModule` runs `npm root -g`, so npm never reads
  `~/.npmrc` (`prefix=/home/acolomba/.npm-global`) and returns the linuxbrew
  root, where pi-subagents is absent, and the case skips. The copied
  `src/agents/skills.ts` imports fine (probe: `IMPORT OK`, exports include
  `resolveSkillsWithFallback`). Fix: resolve the pi-subagents package root
  (`PI_SUBAGENTS_ROOT` override, else `npm root -g`) before the hermetic
  environment is entered, in both `tests/integration/skill-path-resolution.test.ts`
  and `tests/integration/provenance-invisibility.test.ts`, and pass it into the
  loader. Keep the `t.skip` for a genuinely absent peer. CI keeps its
  documented skip (no job installs pi-subagents globally); do not add a CI
  install step in this phase.

#### Advisory remediation (DEP-07-03-01)

- **D-07:** Apply `npm audit fix` to the root lock. Measured in a scratch copy
  on 2026-10-10: `npm audit fix --package-lock-only` changes exactly the
  `node_modules/brace-expansion` entry (version, resolved, integrity) from
  5.0.9 to 5.0.12 and leaves `package.json` untouched. Expect that 3-line diff
  and nothing else; a larger diff is a signal to stop and inspect.
- **D-08:** The second copy at
  `node_modules/@earendil-works/pi-coding-agent/node_modules/brace-expansion`
  stays at 5.0.9 and is accepted as upstream-pinned. Pi 0.87.1 publishes an
  `npm-shrinkwrap.json` that pins it; npm honors a dependency's shrinkwrap, so
  `overrides`, `npm dedupe`, and a fresh lock all left it at 5.0.9 (all three
  measured). Pi 0.99.2 still pins 5.0.9; Pi 1.1.0 ships no shrinkwrap. Deleting
  the nested lock entries by hand clears `npm audit` on paper but a real
  `npm ci` re-extracts the shrinkwrapped tree, so that route is not a fix and
  must not be used. The clearing action is a Pi >=1.0 devDependency bump, which
  is its own milestone.
- **D-09:** Record the residual as BACKLOG.md carrier **DEPADV-01** (facts above,
  GHSA-q2hr-2g5m-vwhr / GHSA-qhr7-859c-m2p7 / GHSA-6j4f-fj2g-mc7p, fix range
  >=5.0.12, clearing action) and update DEP-07-03-01 in
  `.planning/phases/07-mode-refusals-real-pi-verification-and-docs/deferred-items.md`
  to state the root fix and point at DEPADV-01. No new WINDOWS.md entry for the
  residual.
- **D-10:** Carried from Phase 7 D-11 and the peer-floor audit: the e2e fixture
  tree `tests/e2e/pi-peer-floor/` stays byte-identical, including its lock,
  which pins Pi 0.86.1's shrinkwrapped `brace-expansion@5.0.9`. No CI `npm audit`
  step is added (deferred idea).

#### Validation records (audit tech debt folded in)

- **D-11:** `03-VALIDATION.md` frontmatter becomes `nyquist_compliant: true`;
  its checklist is fully ticked. `01-VALIDATION.md` stays `nyquist_compliant:
  false` because its one open box records a missed feedback-latency target
  (404 s against 180 s); its ticked line "`nyquist_compliant: true` set in
  frontmatter" (line 124) is unticked so the file agrees with itself. The audit
  then grades 01 PARTIAL and 03 compliant, which is the truth.
- **D-12:** The `stale` verification digests of phases 1-6 are left alone.
  Phase 07's E7 evidence re-ran the whole-tree gate on the final tree, and the
  milestone archive retires the flag; six verifier re-runs would add no
  information.

### Claude's Discretion

- Carrier wording and section placement in BACKLOG.md (follow the WSTOR-01 /
  WPIN-01 shape: `## ID: title`, "Carried from ...", facts, "To settle it").
- How the 23 waivers and 2 fixes are batched (a scripted loop over
  `gsd_run windows waive|fixed` is fine); the SUMMARY records the absent-file
  evidence behind D-01 (the `ls` of the 17 named paths).
- The exact resolver refactor shape in the two integration tests, within D-06.
- How the plan proves the root bump: a lock assertion on
  `packages["node_modules/brace-expansion"].version` or `npm audit --json`
  filtered to the nested path; either is acceptable.
- Task boundaries and wave split. There is no production source change, so no
  new source-test pair; the lock change escalates the pre-commit hook to every
  direct-coverage pair, so stage `package-lock.json` in its own commit.

### Deferred Ideas (OUT OF SCOPE)

- **Pi 1.x devDependency bump** — clears the nested `brace-expansion` copy (no shrinkwrap in 1.1.0) but is a major upgrade across the peer floor and the pinned e2e ref; its own milestone. Carried by DEPADV-01.
- **CI `npm audit` gate** — a new gate, not requested; would fail today on the nested copy.
- **CI global `pi-subagents` install** — the TODO in `provenance-invisibility.test.ts` asks for it so both resolver cases run in CI; a pinned network install in the integration job. Not this phase.
- **Phase 04 deferred item: LLM plugin tool error text outside the redaction model** — a producer-side string, out of PMOD-04 scope by design; disposition belongs to the milestone close, not this phase.
- **Stale verification digests (phases 1-6)** — left for the archive per D-12.
</user_constraints>

<phase_requirements>
## Phase Requirements

The phase carries no REQ IDs (closeout phase; traceability lives in WINDOWS.md and BACKLOG.md). The roadmap success criteria stand in for them.

| ID | Description | Research Support |
|----|-------------|------------------|
| SC-1 | `windows status` reports `open_count: 0`; 85 and 89 `fixed`; every waived entry carries a `[json-output]` reason naming its cause or carrier | Verb behavior measured on a scratch ledger (Pattern 1, Pitfalls 1-3). **Evidence correction: 41-58 were retired by #202, not #236** (Open Question 1) |
| SC-2 | Both resolver tests resolve the package root before the HOME swap; SC-2 / AGSK-06 runs where the peer is installed; CI unchanged | Root cause re-confirmed; `PI_SUBAGENTS_ROOT=<global>` makes the case pass now (Pattern 2). `provenance-invisibility.test.ts` never swaps HOME and already passes (Open Question 2) |
| SC-3 | Root lock pins `node_modules/brace-expansion` >=5.0.12, `package.json` unchanged, only the Pi-nested path still reported, e2e fixture lock byte-identical | Scratch `npm audit fix --package-lock-only` re-measured: exactly 3 changed lines, Prettier-clean (Pattern 3) |
| SC-4 | BACKLOG.md carries WOUT-01 and DEPADV-01; DEP-07-03-01 points at DEPADV-01 | Carrier shape read from WSTOR-01 / WPIN-01 (Pattern 4) |
| SC-5 | 03 VALIDATION `nyquist_compliant: true`; 01 stays `false` with line 124 unticked; `npm run check` green, no new suppression, text corpus unchanged | Both files read; corpus tool is retired, so "unchanged" is a path-scoped `git diff` (Validation Architecture) |
</phase_requirements>

## Project Constraints (from AGENTS.md)

- Never commit to `main`; this work stays on `features/json`. Never rebase or rewrite history; never `--amend` after a failed hook; never `--no-verify`.
- Conventional Commits; title 5-72 chars, body lines <=80. Avoid GSD milestone/phase mentions in commit messages.
- Before each commit: `SKIP=npm-check pre-commit run --files <literal paths>`; restage if a fixer changes a file. Then `git commit` in the foreground with the longest timeout. Do not run ESLint, type checking, or tests just before committing; the hook runs them.
- GSD gates (wave merge, phase gate) run `npm run check` on the combined tree; a passing hook is not a gate verdict.
- Ledger text is prefixed with the milestone: `[json-output]`. Never hand-edit `.planning/WINDOWS.md`; mutate only through `windows` verbs.
- Every plan `SUMMARY.md` includes a `## Threat Flags` section, even when "None".
- TypeScript edits follow `skills/typescript-google-style-review`, `skills/typescript-comments`, `skills/typescript-unit-testing`: no GSD process references (`Phase NN`, `Plan NN`) in comments or titles; no narration of the replaced shape ("previously", "no longer"); `process.env` changes restored through the test context.
- Upstream parity does not apply (no Claude Code contract touched; CONTEXT `<upstream_compatibility>`).

## Summary

This phase is bookkeeping plus two small mechanical changes. Every tool it needs is already in the tree: the GSD `windows` verbs, npm 11.20.0, and the existing integration tests. Nothing new is installed except a patch-version bump of one transitive dev dependency.

I re-ran the discussion's key measurements and they hold. A scratch `npm audit fix --package-lock-only` changes exactly the three lines of `node_modules/brace-expansion` (5.0.9 to 5.0.12), and the result passes the repo's Prettier config. `npm audit --package-lock-only` afterwards reports one high vulnerability, and its only node is `node_modules/@earendil-works/pi-coding-agent/node_modules/brace-expansion`. Setting `PI_SUBAGENTS_ROOT` to the global peer turns the SC-2 / AGSK-06 skip into a pass, which proves the ordering fix will work. The `windows waive|fixed` verbs work as documented, but they have three sharp edges (Pitfalls 1-3). The worst: an unquoted reason is silently cut to its first word, and the entry cannot be waived a second time.

Three findings change what the planner should write. (1) Entries 41-58 were not retired by #236. The coverage-producer pipeline was removed on `features/test-backlog` by `0affe79e` (2026-09-20) before that branch squash-merged as #202 (`feb04658`). None of its files ever existed on main. Only 32-34 trace to #236 (`d7213bc2`). The waiver text and SC-1's wording need the correct commit (Open Question 1). (2) `provenance-invisibility.test.ts` never enters a hermetic environment and already passes on this machine. D-06's change there is a symmetry refactor with no behavior change (Open Question 2). (3) Phase 07's `07-VERIFICATION.md` lists both `package-lock.json` and `deferred-items.md` in `covered_files`, and its status is `passed` today. This phase will flip it to `stale` (Open Question 3).

**Primary recommendation:** Run the phase sequentially in this checkout (no executor worktrees). Commit the test fix, then the lock bump alone, then the planning records. Apply all 25 ledger dispositions last, through one retry-safe Node script that passes each reason as an argv element.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Ledger dispositions (SC-1) | GSD tooling (`.claude/gsd-core/bin/lib/broken-windows.cjs`) | `.planning/WINDOWS.md` (generated artifact) | The fenced JSON is the sole source of truth; only the verbs write it |
| Resolver ordering (SC-2) | Test harness (`tests/integration/*.test.ts`) | `tests/platform/hermetic-environment.ts` (unchanged) | The fault is call order inside the test; the helper's contract (swap HOME) is correct |
| Advisory remediation (SC-3) | Dependency lock (`package-lock.json`) | npm registry (read at fix time) | Lock-only change; `package.json` ranges already admit 5.0.12 (`minimatch` asks `^5.0.8`) |
| Residual tracking (SC-4) | Planning records (`.planning/BACKLOG.md`, phase 7 `deferred-items.md`) | — | Carrier pattern, no ledger entry (D-09) |
| Validation consistency (SC-5) | Planning records (`01-`/`03-VALIDATION.md`) | `npm run check` (gate) | Frontmatter is authoritative for audit §5.5 |

No production tier (`extensions/`) is touched.

## Standard Stack

### Core
| Tool | Version | Purpose | Why Standard |
|------|---------|---------|--------------|
| `gsd-tools windows` | in-repo `.claude/gsd-core/bin/gsd-tools.cjs` | `status`, `waive <id> "<reason>"`, `fixed <id>` | The only sanctioned ledger writer; `/gsd-ship` reads its `ledger.open_count` [VERIFIED: .claude/gsd-core/workflows/ship.md:132-155] |
| npm | 11.20.0 | `npm audit fix --package-lock-only`, `npm audit --package-lock-only --json` | Produces the measured 3-line diff [VERIFIED: scratch run this session] |
| Node | v26.11.1 | `node --test`, the ledger script | Within `engines` `^22.22.2 \|\| ^24.15.0 \|\| >=26.0.0` [VERIFIED: package.json] |
| `node:test` + `node:assert/strict` | built-in | The two integration tests | Project test standard [CITED: skills/typescript-unit-testing/SKILL.md] |

### Supporting
| Tool | Version | Purpose | When to Use |
|------|---------|---------|-------------|
| `pre-commit` | 4.5.1 | Fixers/linters before commit; `npm-check` hook at commit | Every commit |
| `fallow audit --base <ref>` | `^3.30.0` (devDep) | Confirms no introduced clone group from the test edit | Before the phase gate; CI's `fallow-audit` job fails on a `warn` verdict |
| pi-subagents (global, optional peer) | 0.47.1 at `/home/acolomba/.npm-global/lib/node_modules/pi-subagents` | Makes SC-2 / AGSK-06 run locally | Local proof of SC-2 only; never installed by this phase |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `npm audit fix --package-lock-only` | Hand-editing the three lock lines with the registry integrity | Same bytes, but bypasses npm's resolver; use only if the registry is unreachable, and then check `npm view brace-expansion@5.0.12 dist.integrity` |
| Per-file resolver change | A shared `tests/integration/pi-subagents-peer.ts` support module | Removes duplication, but a non-`.test.ts` file under `tests/` escalates the hook to every pair and adds an abstraction nobody asked for. Keep it per file |
| Shell loop over `windows waive` | Node script with `execFileSync` argv arrays | zsh globs `[json-output]` and splits unquoted words; argv arrays remove both hazards |

**Installation:** none. The phase installs nothing. Do not run `npm install` or `npm ci` in the real tree; nothing depends on the installed copy of `brace-expansion`, and CI's `npm ci` will install 5.0.12 from the lock.

**Version verification:** `npm view brace-expansion@5.0.12 dist.integrity` returns `sha512-YovQ3rzhaLMIrDjNDMkNS01tea93qhEhG5xy8f6+R0l+dw3Ki+5sCoIoI942iuLZTHWogWktgwVDhU09iNEimQ==`, which matches the scratch lock byte for byte. Published 2026-09-14 by `juliangruber`, gitHead `f3410159d768f56c9d9f4511d3e1b46425fc1099` [VERIFIED: npm registry].

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| brace-expansion@5.0.12 (transitive, dev) | npm | package 13 yrs (2013-10-13); this version 26 days (2026-09-14) | 631,615,529/wk | github.com/juliangruber/brace-expansion | [SUS] reason `too-new` | Flagged. Approved in substance by D-07 |

The `SUS` verdict comes only from the `too-new` heuristic, which reads the latest version's publish date. Every other signal is clean: no `postinstall` (scripts are `snap`, `test`, `format`, `prepare`; `prepare` does not run for registry installs), not deprecated, maintainers `juliangruber` and `isaacs`, and 5.0.12 is the lowest version in the advisory's fix range (`>=5.0.12`). This is a version bump of a package the lock already carries, not a new package.

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** brace-expansion@5.0.12. The protocol requires a `checkpoint:human-verify` before the install. D-07 records the user's choice of this exact bump with the measured diff, and the project runs `mode: yolo`. The planner should either cite D-07 as the human verification in the task, or add a one-line checkpoint. The task's `<verify>` must compare the lock's `integrity` to `npm view brace-expansion@5.0.12 dist.integrity`.

## Architecture Patterns

### System Architecture Diagram

```
               (wave 1)                        (wave 2, own commit)              (wave 3, last)
  test edit: resolve peer root       lock bump: npm audit fix              planning records
  BEFORE createHermeticEnvironment    --package-lock-only                   BACKLOG WOUT-01, DEPADV-01
          |                                   |                             deferred-items DEP-07-03-01
          v                                   v                             01/03 VALIDATION edits
  node --test <2 files>             git diff --numstat == "3 3"                    |
   SC-2 case: pass (peer present)   npm audit --package-lock-only --json           v
   both cases: skip (peer absent)    -> only Pi-nested node                 ledger script (25 verbs)
          |                                   |                              status gate: open -> apply
          |                                   v                              84 waive cites WOUT-01
          |                         pre-commit npm-check escalates           89 fixed after SC-2 pass
          |                         to ALL direct-coverage pairs                   |
          +-------------------+---------------+--------------------------------------+
                              v
                  phase gate: npm run check (unpiped) + fallow audit --base <BASE>
                  + windows status open_count == 0 + path-scoped git diffs
```

### Recommended Change Set
```
tests/integration/skill-path-resolution.test.ts    # resolve root before HOME swap; loader takes root
tests/integration/provenance-invisibility.test.ts  # same signature change (symmetry; no behavior change)
package-lock.json                                   # 3 lines at node_modules/brace-expansion
.planning/BACKLOG.md                                # + ## WOUT-01, + ## DEPADV-01 (append at end)
.planning/phases/07-.../deferred-items.md           # DEP-07-03-01 resolution note -> DEPADV-01
.planning/phases/01-presentation-model/01-VALIDATION.md  # line 124: [x] -> [ ]
.planning/phases/03-typed-raw-surfaces/03-VALIDATION.md  # line 7: nyquist_compliant: true
.planning/WINDOWS.md                                # written ONLY by the windows verbs
```

### Pattern 1: Ledger verbs (exact behavior, measured on a scratch copy)

Source: `.claude/gsd-core/bin/lib/broken-windows.cjs` and a scratch ledger run with `--cwd` this session.

- **Status:** `node .claude/gsd-core/bin/gsd-tools.cjs windows status` prints `{ "ok": true, "ledger": { schema_version, open_count, waived_count, fixed_count, total_count, last_updated, entries[] } }`. `--raw` gives the same JSON shape ("`--raw` is accepted ... but is a no-op") [VERIFIED: .claude/gsd-core/bin/gsd-tools.cjs:3402-3406]. Each entry carries `id, kind, phase, file, line, description, status, reason, recorded_at, resolved_at, milestone`. `--pick ledger.open_count` prints the bare number.
- **Waive:** `windows waive <id> "<reason>"` sets `status: "waived"`, `reason`, `resolved_at`, then prints `{ ok: true, ledger }` [VERIFIED: broken-windows.cjs:278-289, 1043-1066].
- **Fixed:** `windows fixed <id>` sets `status: "fixed"` and `resolved_at`. It leaves `reason` as `""` [VERIFIED: broken-windows.cjs:290-298, 1067-1087].
- **Refusals** carry the frozen REASON codes, quoted from broken-windows.cjs:83-105: `WINDOWS_ALREADY_RESOLVED: 'windows_already_resolved'`, `WINDOWS_WAIVE_REASON_EMPTY: 'windows_waive_reason_empty'`, `WINDOWS_ID_NOT_FOUND: 'windows_id_not_found'`, `WINDOWS_USAGE: 'windows_usage'`, `WINDOWS_LEDGER_TABLE_DRIFT: 'windows_ledger_table_drift'`, `WINDOWS_LEDGER_LOCK: 'windows_ledger_lock'`. Each makes the process exit 1. Measured messages: `Error: Window 32 is already waived (resolved_at=...)`, `Error: Expected 2 positional argument(s); got 1.`, `Error: Unknown flag: --x`.
- **Reason text:** `|` is escaped in the rendered table and stored raw in JSON. Backticks and double quotes round-trip. Only a 4-backtick run is rejected, and only in `description` [VERIFIED: broken-windows.cjs:179-191; scratch round-trip].
- **No commit:** the verbs write `.planning/WINDOWS.md` atomically under a ledger lock. They do not commit; the executor commits the file.
- **Expected end state:** `open_count: 0`, `waived_count: 50` (27 + 23), `fixed_count: 39` (37 + 2), `total_count: 89` [VERIFIED: current status 25/27/37/89].

### Pattern 2: Resolve the peer root before the HOME swap

**What:** `enterHermeticEnvironment` sets `process.env.HOME = home` at line 45 [VERIFIED: tests/platform/hermetic-environment.ts:44-46]. `skill-path-resolution.test.ts` calls `createHermeticEnvironment` at line 126 and only then `loadPiSubagentsSkillsModule(tmpRoot)` at line 131. That function calls `resolvePiSubagentsPackageRoot()`, which runs `npm root -g` [VERIFIED: tests/integration/skill-path-resolution.test.ts:65-81, 92-98, 124-135]. Measured: `npm root -g` prints `/home/acolomba/.npm-global/lib/node_modules` with the real HOME and `/home/linuxbrew/.linuxbrew/lib/node_modules` with HOME swapped.

**Proof the fix works (this session):** `PI_SUBAGENTS_ROOT=/home/acolomba/.npm-global/lib/node_modules/pi-subagents node --test tests/integration/skill-path-resolution.test.ts` gives `# pass 1`, `# skipped 0`. Without the override it gives `# skipped 1`. With `PI_SUBAGENTS_ROOT=/nonexistent`, both files give `# SKIP`, `# pass 0`, exit 0. That is the CI-equivalent absent-peer path.

**Shape (within D-06):** keep `resolvePiSubagentsPackageRoot()` unchanged, including the `PI_SUBAGENTS_ROOT` override. Call it as the first statement of the test body, before `createHermeticEnvironment`. Give the loader a `packageRoot: string | undefined` parameter instead of calling the resolver itself. Do not hoist the call to module scope: the unit-testing rules allow only stateless stubs there [CITED: skills/typescript-unit-testing/SKILL.md "Case structure"].

```typescript
// tests/integration/skill-path-resolution.test.ts (shape; names from lines 65-135)
async function loadPiSubagentsSkillsModule(
  packageRoot: string | undefined,
  scratchRoot: string,
): Promise<PiSubagentsSkillsModule | undefined> {
  if (!packageRoot) {
    return undefined;
  }

  const installedSrcDir = path.join(packageRoot, "src");
  // ...rest of the body unchanged
}

test("SC-2 / AGSK-06: emitted skillPath resolves ...", async (t) => {
  // npm reads its global prefix from ~/.npmrc, so the lookup must run before
  // the hermetic environment repoints HOME.
  const piSubagentsRoot = resolvePiSubagentsPackageRoot();
  const originalOffline = process.env.PI_OFFLINE;
  const { root: tmpRoot } = await createHermeticEnvironment(t, "skillpath-sc2-");
  // ...
  const skillsModule = await loadPiSubagentsSkillsModule(piSubagentsRoot, tmpRoot);
```

Do not change the test title. The `t.skip("pi-subagents resolver module not reachable in this environment")` branch stays as is. The comment states a present-tense reason; it does not mention a skip that used to happen (typescript-comments: no narration of replaced code).

`provenance-invisibility.test.ts` gets the same signature change: `loadPiSubagentsFrontmatterModule(packageRoot, scratchRoot)`, called with a root resolved at the top of the test [VERIFIED: tests/integration/provenance-invisibility.test.ts:56-72, 82-114, 116-123]. It uses plain `mkdtemp`, not the hermetic helper, so the order never mattered there and it already passes (`# pass 1`). Leave its CI-gap TODO comment as is; CI behavior does not change.

### Pattern 3: Lock-only advisory fix, proven by bytes

```bash
# Real tree, from the repo root. No node_modules change.
npm audit fix --package-lock-only --ignore-scripts
git diff --numstat -- package-lock.json     # expect exactly: 3	3	package-lock.json
git diff --exit-code -- package.json        # expect exit 0
```

Measured diff (scratch, this session), at `package-lock.json:3634-3637`:
```
-      "version": "5.0.9",
-      "resolved": "https://registry.npmjs.org/brace-expansion/-/brace-expansion-5.0.9.tgz",
-      "integrity": "sha512-ScQ4IuvIEF1TMlP7Zt+vjJ//9zlPb2SDcxWxM3bk8s6t6GGdJ7KO1dCcTidOPJKePW30LE/2cT7wCyPho9/Wxg==",
+      "version": "5.0.12",
+      "resolved": "https://registry.npmjs.org/brace-expansion/-/brace-expansion-5.0.12.tgz",
+      "integrity": "sha512-YovQ3rzhaLMIrDjNDMkNS01tea93qhEhG5xy8f6+R0l+dw3Ki+5sCoIoI942iuLZTHWogWktgwVDhU09iNEimQ==",
```
The nested entry at `package-lock.json:1307-1311` stays `"version": "5.0.9"`. Its parent entry carries `"hasShrinkwrap": true` (line 81), and `node_modules/@earendil-works/pi-coding-agent/npm-shrinkwrap.json` (lockfileVersion 3, Pi 0.87.1) pins `brace-expansion` 5.0.9 and `minimatch` 10.2.6 [VERIFIED: read this session]. Both copies are reached through `minimatch` asking `^5.0.8`, so 5.0.12 satisfies the root dependent.

`format:check` covers `package-lock.json`. The bumped lock passes `prettier --config .prettierrc.json --check` [VERIFIED: scratch run].

### Pattern 4: BACKLOG carrier shape

Copy from WSTOR-01 / WPIN-01 (`.planning/BACKLOG.md:3352-3392`): a `## ID: lower-case title` heading, a "Carried from ..." line naming the source (`WINDOWS #NN`, or the phase 7 deferred item), short fact paragraphs, then a `**To settle it:**` paragraph. New sections go at the end of the file. The newest carriers (GHCAN-01, GHCAN-02, GHRED-01, GHADD-01) sit at the end, so the order is chronological. Suggested headings:

- `## WOUT-01: workflow output quality is unobserved because engine subagents declined every tool call` / "Carried from the json-output close (WINDOWS #84)."
- `## DEPADV-01: Pi's shrinkwrap pins a vulnerable nested brace-expansion` / "Carried from the json-output close (DEP-07-03-01)."

`.planning/` is outside mdformat, markdownlint, and Prettier. Only `trailing-whitespace`, `end-of-file-fixer`, and `fix-spaces` apply [VERIFIED: .pre-commit-config.yaml:11-44, 84, 90].

### Anti-Patterns to Avoid
- **Deleting the nested lock entries:** `npm audit` reads clean, but `npm ci` re-extracts the shrinkwrapped tree (D-08). Forbidden.
- **`overrides` in `package.json`:** measured not to move the nested copy, and it changes `package.json` against SC-3.
- **Running `npm audit fix` without `--package-lock-only`:** it also rewrites `node_modules` and can drift the lock in ways unrelated to this fix (see the `bin` normalization history in memory). Lock-only keeps the diff to 3 lines.
- **Running `npm audit fix` in `tests/e2e/pi-peer-floor/`:** violates D-10.
- **`windows fixed 89` before the test fix lands:** the entry would claim a repair that is not on the branch.
- **Hand-editing `.planning/WINDOWS.md`:** any table/JSON drift makes every verb refuse with `windows_ledger_table_drift`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Ledger state change | Edits to WINDOWS.md JSON/table | `windows waive\|fixed` | Lock, atomic write, table regeneration, count recomputation |
| Lock bump | Manual JSON edit | `npm audit fix --package-lock-only` | Resolver picks a version within dependents' ranges and writes the matching integrity |
| "Only the nested path remains" | grep over `npm audit` text | `npm audit --package-lock-only --json` → `vulnerabilities.*.nodes` | Text output has no stable shape; `nodes` lists exact lock paths |
| Peer lookup | A new resolver | The existing `resolvePiSubagentsPackageRoot()` | D-06 keeps it, including the override |

**Key insight:** every mechanism here already exists. The risk is in invoking it (shell quoting, call order, commit grouping), not in building it.

## Common Pitfalls

### Pitfall 1: An unquoted reason is silently cut to one word, and the entry is then frozen
**What goes wrong:** `windows waive 34 '[json-output]' two words` exits 0 and stores the reason `"[json-output]"`. `parseArgs` only checks that there are at least 2 positionals; extra ones are dropped [VERIFIED: broken-windows.cjs:1137-1141; scratch run]. A second waive is refused with `windows_already_resolved`, so a bad reason cannot be fixed through the verbs.
**How to avoid:** pass each reason as one argv element from a Node script (Code Examples). Recovery, if it happens before commit: `git restore .planning/WINDOWS.md`, then re-run. That restores the committed JSON and is not a hand edit.
**Warning signs:** the reason in `status` output is shorter than intended.

### Pitfall 2: zsh globbing and leading dashes
**What goes wrong:** in zsh, an unquoted `[json-output]` is a glob: `no matches found`, and the command never runs. A reason that starts with `--` is parsed as a flag (`Unknown flag`).
**How to avoid:** argv arrays from Node; every reason starts with `[json-output]`.

### Pitfall 3: Re-running a half-finished batch
**What goes wrong:** if the batch stops at entry N, re-running it fails at entry 32 with `windows_already_resolved`.
**How to avoid:** read `windows status` once at the start and apply a verb only where `status === "open"`. The script is then safe to retry (NFR-3 spirit).

### Pitfall 4: GSD tooling and `node_modules` are absent in executor worktrees
**What goes wrong:** `.claude/gsd-core/*` is gitignored (`.gitignore:26`), so an agent worktree has no `gsd-tools` and no `node_modules`. The ledger task cannot run there, and test verification in a worktree tests nothing. Parallel worktrees that each write WINDOWS.md would also conflict in the JSON fence.
**How to avoid:** execute this phase sequentially in this checkout (`/home/acolomba/src/pi-claude-marketplace-json`, branch `features/json`), without worktree isolation. Put all ledger mutations in one task.

### Pitfall 5: The lock commit runs every direct-coverage pair
**What goes wrong:** `package-lock.json` is in `everyPairInputs`, so the hook runs every pair, not the staged ones [VERIFIED: scripts/test-coverage-direct.mjs:668-683]. `pre-commit` also stashes unstaged edits while the hook runs.
**How to avoid:** commit the lock alone, with no other unstaged edits in flight. Use the longest foreground timeout. Commit with a pathspec (`git commit -F <msg> -- package-lock.json`).

### Pitfall 6: `npm audit` exits 1 while the result is correct
**What goes wrong:** after the fix, `npm audit` still reports 1 high (the nested copy), so it exits 1. A verify step chained with `&&` fails for the wrong reason, or a piped one hides the real status.
**How to avoid:** write the JSON to a file, ignore the exit status, and assert on the parsed `nodes` (Validation Architecture). Use `--package-lock-only` so the audit reads the committed lock and not the local `node_modules`, which keeps 5.0.9 until the next `npm ci`.

### Pitfall 7: Green runs that checked nothing
**What goes wrong:** `npm run check | tail` reports the pipe's exit status. `pre-commit run --files "$VAR"` with a newline list checks zero files in this shell.
**How to avoid:** run gates unpiped in the foreground and read `$?`. Pass literal paths to `pre-commit`.

### Pitfall 8: The local SC-2 proof depends on the global peer version
**What goes wrong:** a stale global pi-subagents (below the `>=0.35.0` floor) makes the newly running case fail locally. That is an environment failure, not a regression.
**How to avoid:** record `node -p 'require("/home/acolomba/.npm-global/lib/node_modules/pi-subagents/package.json").version'` (0.47.1 today) in the SUMMARY next to the passing run.

## Code Examples

### Retry-safe ledger batch (scratch script, not committed)

```javascript
// $SCRATCH/dispose-ledger.mjs  -- run from the repo root: node $SCRATCH/dispose-ledger.mjs
import { execFileSync } from "node:child_process";

const GSD = ".claude/gsd-core/bin/gsd-tools.cjs";
const windows = (...args) =>
  JSON.parse(execFileSync("node", [GSD, "windows", ...args], { encoding: "utf8" }));

const TYPE_MEMBERS = "[json-output] Moot: ..."; // final wording per Open Question 1
const COVERAGE = "[json-output] Moot: ...";     // final wording per Open Question 1
const plan = [
  ...[32, 33, 34].map((id) => ["waive", id, TYPE_MEMBERS]),
  ...Array.from({ length: 18 }, (_, i) => ["waive", 41 + i, COVERAGE]),
  ["waive", 84, "[json-output] Carried to BACKLOG.md WOUT-01: ..."],
  ["fixed", 85],
  ["waive", 88, "[json-output] Accepted design: ..."],
  ["fixed", 89], // only after the resolver-order commit is on the branch
];

const status = new Map(windows("status").ledger.entries.map((e) => [e.id, e.status]));
for (const [verb, id, reason] of plan) {
  if (status.get(id) !== "open") {
    console.log(`skip ${id}: ${status.get(id)}`);
    continue;
  }
  windows(verb, String(id), ...(reason === undefined ? [] : [reason]));
}
console.log(windows("status").ledger.open_count); // expect 0
```

`execFileSync` throws on a non-zero exit, so the batch stops at the first refusal.

### Draft reasons (planner finalizes)

- 32-34: `[json-output] Moot: records a scope deviation against the unused-type-member live gate (lint:type-members), which #236 (d7213bc2, 2026-10-05) deleted; nothing remains to fix. The shipped work was audited at the test-backlog close.`
- 41-58 (evidence-correct; see Open Question 1): `[json-output] Moot: records a scope deviation against the coverage-producer pipeline, which test-backlog removed in 0affe79e (2026-09-20) before it merged as #202 (feb04658); none of its files reached main, so nothing remains to fix. The shipped work was audited at the test-backlog close.`
- 84: `[json-output] Carried to BACKLOG.md WOUT-01: workflow output quality is unobserved because engine subagents declined every tool call under the sandbox's only authed provider; settle it with an Anthropic key in tmp/pi-uat/agent and one canary re-run.`
- 88: `[json-output] Accepted design: composeContextBlocks stays in shared/notification-dispatch.ts as the one production reader of renderMpHeader and composePluginLines; removing it fails the fallow dead-code gate, 15 test files hold 138 references to the two exports, and the corpus and catalog gates pin the output bytes either way. Reversible: a later change can still move the composer.`

Evidence for 88 re-checked: `notification-dispatch.ts:4,11` are the only production imports of the two exports, and `composeContextBlocks` is defined at `:428` and called at `:449`. `grep -roE` over `tests/` counts 138 references in 15 files.

### Absent-file evidence for the SUMMARY (D-02 correction)

The 21 inherited entries name **18** distinct paths, not 17. **14 are absent.** 4 are present: `extensions/pi-claude-marketplace/bridges/hooks/stage.ts`, `extensions/pi-claude-marketplace/edge/handlers/tools.ts`, `.gitignore`, and `package.json`. For the last two, the specific content each entry describes is gone: `.gitignore` has 0 `vendor/coverage` lines (entry 42), and `package.json` has no `coverage:producer` or `lint:type-members` script (entries 43, 32). Use this loop, which was run this session:

```bash
for f in scripts/check-unused-type-members.contracts.json extensions/pi-claude-marketplace/bridges/hooks/stage.ts extensions/pi-claude-marketplace/edge/handlers/tools.ts scripts/coverage-producer.convert.mjs .gitignore package.json tests/scripts/coverage-source-map-fixtures.ts scripts/coverage-source-map.mjs tests/scripts/coverage-run-support.ts tests/scripts/coverage-correspondence-fixtures.ts scripts/coverage-capture.mjs scripts/coverage-validate.mjs tests/scripts/coverage-projection.ts tests/scripts/coverage-unit-fixtures.ts tests/scripts/coverage-source-map.test.ts tests/scripts/check-coverage-risk-fixtures.ts scripts/coverage-acceptance.mjs tests/architecture/pre-commit-hooks.ts; do [ -e "$f" ] && echo "PRESENT $f" || echo "absent  $f"; done
grep -c 'vendor/coverage' .gitignore; grep -n 'coverage:producer\|lint:type-members' package.json
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Notify corpus checked by `scripts/notify-corpus.mjs check` | Tool retired (`0a11761d`, 2026-10-09); baseline frozen at `.planning/phases/01-presentation-model/notify-corpus/` | Phase 7 close | "Text corpus unchanged" (SC-5) is a path-scoped `git diff`, not a command |
| Whole-suite `test:coverage:unit` | `test:coverage:direct:all` per-pair gate | #236 (`d7213bc2`) | Entry 85's "whole-suite `npm run test:coverage:unit` exits 1" names a script that no longer exists. D-04's owner-test proof is the right evidence |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Plain `npm audit` (without `--package-lock-only`) may read the installed `node_modules`, which keeps 5.0.9 locally | Pitfall 6 | Low. The recommended commands pass `--package-lock-only` either way |
| A2 | A hook run that escalates to all direct-coverage pairs takes about a minute (based on the memory note that full `npm run check` takes ~73 s) | Pitfall 5 | Low. Only affects the timeout choice |
| A3 | Changing the two loaders' signatures introduces no new fallow clone group (neither file is in any of the 32 current groups) | Validation | Low. `fallow audit --base` in the gate catches it |

## Open Questions

1. **SC-1 / D-01 name the wrong commit for entries 41-58 (blocking for wording).**
   - What we know: `scripts/coverage-*.mjs`, `tests/scripts/coverage-*`, and `vendor/coverage/*` appear in no commit reachable from any ref (`git log --all` is empty). `0affe79e` ("chore(coverage): enforce 100% unit coverage natively and remove the CRAP gate", 2026-09-20, 50 files, -17,500 lines) is not an ancestor of HEAD. The ledger entries 41-58 entered main in #202 (`feb04658`, 2026-09-20), and `scripts/coverage-producer.convert.mjs` is absent at that commit. `d7213bc2` (#236) deleted the unused-type-member gate (`scripts/check-unused-type-members.*`, `lint:type-members`), which is what 32-34 describe, plus `test:coverage:unit`. Entry 58's second file, `tests/architecture/pre-commit-hooks.ts`, was deleted by #234 (`e6c274bf`, 2026-10-01).
   - What's unclear: whether the user wants SC-1's literal wording ("names #236 (`d7213bc2`) or its BACKLOG carrier") kept. Entry 88's waiver names neither #236 nor a carrier either.
   - Recommendation: waive 41-58 with the evidence-correct reason (draft above). Have the planner record SC-1 as "names the commit that removed the subject (#236 for 32-34, #202 for 41-58), its BACKLOG carrier (84), or the accepted-design constraint (88)". The verifier then checks reason content, not a literal `d7213bc2` grep. Confirm with the user, because a waiver that names the wrong deleting commit is the audit trail D-02 exists to protect.

2. **What D-06 changes in `provenance-invisibility.test.ts`.**
   - What we know: it never swaps HOME and passes today (`# pass 1`).
   - Recommendation: honor D-06 as a symmetry refactor (resolve at the top of the test, pass the root to the loader). Expect no behavior change and verify `# pass 1` before and after. SC-2's "resolve before the swap" is true for it either way.

3. **Phase 07 verification will go `stale`.**
   - What we know: `verification status` reads `passed` for phase 07 today and `stale` for 01 and 06. `07-VERIFICATION.md` `covered_files` includes `package-lock.json` and `.planning/phases/07-mode-refusals-real-pi-verification-and-docs/deferred-items.md`, and SC-3 and SC-4 must edit both. (06 also lists `package-lock.json` but is already stale.)
   - Recommendation: accept it under D-12's reasoning (the archive retires the flag; this phase's gate re-runs `npm run check` on the final tree). Record it in the SUMMARY so `/gsd-progress` routing to phase 07 is not mistaken for a regression. Confirm with the user, because D-12 names only phases 1-6.

4. **TEST-07-06-01 in `deferred-items.md`.** After the fix, it describes a skip that no longer happens on a machine with the peer. CONTEXT asks only for the DEP-07-03-01 update. Optional: append one resolution sentence pointing at ledger 89 `fixed`. Planner's call; no criterion depends on it.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node | tests, ledger script | ✓ | v26.11.1 | — |
| npm + registry network | `npm audit fix`, `npm audit`, `npm view` | ✓ (registry reached this session) | 11.20.0 | Hand-apply the 3 measured lines and verify integrity with `npm view` |
| gsd-tools | ledger verbs | ✓ in this checkout only | in-repo | Not in executor worktrees (gitignored) |
| pre-commit + installed git hooks | commits | ✓ | 4.5.1; `pre-commit`, `commit-msg` hooks present in the common git dir | — |
| pi-subagents global peer | local SC-2 proof | ✓ | 0.47.1 at `/home/acolomba/.npm-global/lib/node_modules/pi-subagents` | `PI_SUBAGENTS_ROOT` override |
| `~/.npmrc` prefix | `npm root -g` resolving the peer | ✓ `prefix=/home/acolomba/.npm-global` | — | — |

**Missing dependencies with no fallback:** none.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | `node:test` (built-in), Node v26.11.1 |
| Config file | none; scripts in `package.json` |
| Quick run command | `node --test --test-reporter=tap tests/integration/skill-path-resolution.test.ts tests/integration/provenance-invisibility.test.ts` |
| Full suite command | `npm run check` (unpiped; ~73 s+ locally [ASSUMED from memory]) |

Set `BASE=a876e321` (HEAD when research ran). Planning commits after it touch only `.planning/phases/08-*`, so every path-scoped diff below stays valid. Write scratch files under the session scratchpad, not the repo.

### Phase Requirements → Test Map
| ID | Behavior | Type | Automated Command | Exists? |
|----|----------|------|-------------------|---------|
| SC-1 | zero open entries | ledger query | `node .claude/gsd-core/bin/gsd-tools.cjs windows status --pick ledger.open_count` → `0` | ✅ |
| SC-1 | dispositions and reasons | ledger query | `node .claude/gsd-core/bin/gsd-tools.cjs windows status \| node -e 'const L=JSON.parse(require("fs").readFileSync(0)).ledger;const by=new Map(L.entries.map(e=>[e.id,e]));const bad=[];for(const id of [85,89])if(by.get(id).status!=="fixed")bad.push(id);for(const id of [32,33,34,...Array.from({length:18},(_,i)=>41+i),84,88]){const e=by.get(id);if(e.status!=="waived"\|\|!e.reason.startsWith("[json-output] "))bad.push(id)}for(const id of [32,33,34])if(!by.get(id).reason.includes("d7213bc2"))bad.push(id);if(!by.get(84).reason.includes("WOUT-01"))bad.push(84);if(bad.length){console.error("bad",bad);process.exit(1)}'` (add the 41-58 commit check once Open Question 1 is settled) | ✅ |
| SC-2 | SC-2 case runs with the peer present | integration | `node --test --test-reporter=tap tests/integration/skill-path-resolution.test.ts tests/integration/provenance-invisibility.test.ts > $S/peer.tap; echo $?` → `0`; then `grep -c '# SKIP' $S/peer.tap` → `0` and `grep '^# pass 2$' $S/peer.tap` | ✅ |
| SC-2 | CI path unchanged (absent peer skips) | integration | `PI_SUBAGENTS_ROOT=/nonexistent node --test --test-reporter=tap <same 2 files> > $S/absent.tap; echo $?` → `0`; `grep '^# skipped 2$' $S/absent.tap` | ✅ |
| SC-2 | resolve precedes the swap | source check | `grep -n 'resolvePiSubagentsPackageRoot()\|createHermeticEnvironment(t' tests/integration/skill-path-resolution.test.ts` → the resolver call's line number is lower than the helper call's inside the test body | ✅ |
| SC-3 | root pinned >=5.0.12, exact diff | lock | `node -p 'require("./package-lock.json").packages["node_modules/brace-expansion"].version'` → `5.0.12`; `git diff --numstat $BASE -- package-lock.json` → `3	3	package-lock.json`; `git diff --exit-code $BASE -- package.json tests/e2e/pi-peer-floor/` → exit 0 | ✅ |
| SC-3 | integrity matches registry | lock | `test "$(node -p 'require("./package-lock.json").packages["node_modules/brace-expansion"].integrity')" = "$(npm view brace-expansion@5.0.12 dist.integrity)"` | ✅ |
| SC-3 | only the Pi-nested path is reported | audit | `npm audit --package-lock-only --json > $S/audit.json; node -e 'const j=require(process.argv[1]);const n=Object.values(j.vulnerabilities).flatMap(v=>v.nodes);const ok=n.length>0&&n.every(p=>p.startsWith("node_modules/@earendil-works/pi-coding-agent/"));console.log(n);process.exit(ok?0:1)' $S/audit.json` (ignore `npm audit`'s own exit 1) | ✅ |
| SC-4 | carriers present | grep | `grep -c '^## WOUT-01: \|^## DEPADV-01: ' .planning/BACKLOG.md` → `2`; `grep -c 'DEPADV-01' .planning/phases/07-mode-refusals-real-pi-verification-and-docs/deferred-items.md` → `>=1` | ✅ |
| SC-5 | validation records consistent | grep | `grep -n '^nyquist_compliant:' .planning/phases/03-typed-raw-surfaces/03-VALIDATION.md` → `true`; same for 01 → `false`; `grep -c '^- \[x\] `nyquist_compliant: true` set in frontmatter' .planning/phases/01-presentation-model/01-VALIDATION.md` → `0` | ✅ |
| SC-5 | gate green, no new suppression, corpus unchanged | gate + diff | `npm run check; echo $?` → `0` (unpiped); `git diff $BASE -U0 -- . ':(exclude).planning' \| grep -E '^\+.*(fallow-ignore\|eslint-disable\|@ts-expect-error\|@ts-ignore\|node:coverage)'` → no output; `git diff --exit-code $BASE -- extensions/ docs/output-catalog.md .planning/phases/01-presentation-model/notify-corpus/` → exit 0 | ✅ |
| (CI parity) | no introduced clone or finding | static | `npx fallow audit --base $BASE` → no `warn`/`fail` verdict | ✅ |

In the table, `\|` is Markdown escaping for `|`. Unescape it before running a command (`\|\|` is the JavaScript `||`).

### Sampling Rate
- **Per task commit:** the task's quick command above, then `SKIP=npm-check pre-commit run --files <literal paths>`, then `git commit` (the hook runs `check:commit`; for the lock commit that means every pair).
- **Per wave merge:** `npm run check` unpiped (sequential execution: run it after the last task of each plan).
- **Phase gate:** `npm run check` green, plus every SC row above, plus `npx fallow audit --base $BASE`, before `/gsd-verify-work`.

### Wave 0 Gaps
None. The existing test infrastructure covers every criterion; no new test file, fixture, or framework install is needed.

## Security Domain

`security_enforcement` is absent from `.planning/config.json`, so it is treated as enabled.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | — |
| V3 Session Management | no | — |
| V4 Access Control | no | — |
| V5 Input Validation | no (no runtime input path changes) | — |
| V6 Cryptography | no | — |
| V14 Configuration / dependencies (supply chain) | yes | Lock-only bump to the advisory fix floor; registry integrity cross-checked; no install scripts run (`--ignore-scripts`) |

### Known Threat Patterns for this phase

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Tampered or substituted package in the lock | Tampering | Compare lock `integrity` to `npm view ... dist.integrity`; the diff must be exactly 3 lines |
| ReDoS / recursion DoS through `brace-expansion` (GHSA-q2hr-2g5m-vwhr, GHSA-qhr7-859c-m2p7, GHSA-6j4f-fj2g-mc7p; range `4.0.0 - 5.0.11`) | Denial of service | Root copy fixed; the nested Pi copy is dev-only and carried as DEPADV-01 (clearing action: Pi >=1.0 bump) |
| A paper-only audit pass (deleted nested lock entries) | Repudiation | Forbidden by D-08; SC-3 requires the nested path to remain reported |
| Integration test reaching outside its sandbox | Information disclosure | Unchanged: the resolver only reads the global peer's `src/` and copies it into the case's temp root; the hermetic HOME still applies to everything after the lookup |

## Sources

### Primary (HIGH confidence)
- `.claude/gsd-core/bin/lib/broken-windows.cjs:83-105, 179-191, 266-298, 984-1143` and `.claude/gsd-core/bin/gsd-tools.cjs:3402-3442`: verb behavior, REASON codes, argument parsing
- Scratch ledger run (`--cwd` on a copy of WINDOWS.md): waive/fixed output shape, truncation, zsh glob, already-resolved refusal
- Scratch lock (`package.json` + `package-lock.json` copy): `npm audit fix --package-lock-only` diff, `npm audit --package-lock-only --json`, Prettier check
- `tests/integration/skill-path-resolution.test.ts`, `tests/integration/provenance-invisibility.test.ts`, `tests/platform/hermetic-environment.ts`: read in full; tests run with and without `PI_SUBAGENTS_ROOT`
- `scripts/test-coverage-direct.mjs:668-712`, `.pre-commit-config.yaml`, `package.json` scripts: hook escalation and gate composition
- `git show` / `git log --all` / `git merge-base` on `d7213bc2`, `feb04658`, `0affe79e`, `e6c274bf`, `0a11761d`: ledger-entry provenance
- `gsd-tools verification status <phase-dir>` for phases 01, 06, 07; `07-VERIFICATION.md` `covered_files`
- npm registry (`npm view brace-expansion@5.0.12`), package-legitimacy seam

### Secondary (MEDIUM confidence)
- docs.npmjs.com `npm-shrinkwrap.json` page: a shrinkwrap may be published with a package; library authors are discouraged from doing so. Nested enforcement is confirmed by measurement (D-08, three methods), not by the page text.

### Tertiary (LOW confidence)
- Memory notes on check durations and worktree behavior (A2; Pitfall 4 is also confirmed by `.gitignore:26`)

## Metadata

**Confidence breakdown:**
- Ledger verbs: HIGH. Read in source and exercised on a scratch copy.
- Lock remediation: HIGH. Re-measured; registry integrity cross-checked.
- Test refactor: HIGH. Root cause and fix proven by running the test with the override.
- Ledger reasons: MEDIUM until Open Question 1 is settled with the user.

**Research date:** 2026-10-10
**Valid until:** 2026-10-24. The lock fix depends on registry state, and a new `brace-expansion` or Pi release could change the diff. Re-measure in a scratch copy if planning slips past this date.
