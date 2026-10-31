# Phase 8: Address tech debt: ledger dispositions and advisory - Context

**Gathered:** 2026-10-10
**Status:** Ready for planning

<domain>
## Phase Boundary

Every one of the 25 open WINDOWS.md ledger entries receives a `fixed` or
`waived` disposition with an auditable reason, so `gsd-tools windows status`
reports `open_count: 0` and the `/gsd-ship` broken-windows gate passes. The
`brace-expansion` denial-of-service advisory (DEP-07-03-01) is remediated in the
root `package-lock.json` as far as this repository controls, and the residual
copy that Pi's own shrinkwrap pins is recorded and carried. Two VALIDATION.md
records that contradict their own checklists are made self-consistent.

Not in this phase: refreshing the stale verification digests of phases 1-6,
bumping Pi to 1.x, adding a CI `npm audit` gate, installing pi-subagents in CI,
relocating `composeContextBlocks`, or any production source change.

</domain>

<upstream_compatibility>
## Upstream Compatibility Record

**Does the phase touch the Claude Code contract?** No. The work is ledger
bookkeeping, a dev-dependency advisory, test plumbing for an optional Pi
companion, and planning-record edits. None of it is component translation,
install lifecycle, command surface, scope, or enablement. **No upstream
position applies**; every recommendation below comes from Pi and project
constraints (`skills/claude-code-compat-research/SKILL.md`, first section).

</upstream_compatibility>

<decisions>
## Implementation Decisions

The user selected the recommended option for every question on 2026-10-10.

### Inherited ledger entries (ids 32-34, 41-58; 21 entries from test-backlog)

- **D-01:** Waive each entry with `gsd_run windows waive <id> "<reason>"`. The
  reason is prefixed `[json-output]` and names the commit that removed the
  subject the entry records a deviation against (corrected by research on
  2026-10-10; the discussion had attributed both groups to #236):
  - 32-34: the unused-type-member live gate (`lint:type-members`,
    `scripts/check-unused-type-members.*`), deleted by #236 (`d7213bc2`,
    2026-10-05). Reason: `[json-output] Moot: records a scope deviation against
    the unused-type-member live gate (lint:type-members), which #236 (d7213bc2,
    2026-10-05) deleted; nothing remains to fix. The shipped work was audited at
    the test-backlog close.`
  - 41-58: the coverage-producer pipeline (`scripts/coverage-*.mjs`,
    `tests/scripts/**`, `vendor/coverage/`), removed on the test-backlog branch
    by `0affe79e` (2026-09-20) before that branch squash-merged as #202
    (`feb04658`), so none of those files ever reached `main` (`git log --all`
    finds no commit adding them). Entry 58's second file,
    `tests/architecture/pre-commit-hooks.ts`, was deleted by #234 (`e6c274bf`,
    2026-10-01). Reason: `[json-output] Moot: records a scope deviation against
    the coverage-producer pipeline, which test-backlog removed in 0affe79e
    (2026-09-20) before it merged as #202 (feb04658); none of its files reached
    main, so nothing remains to fix. The shipped work was audited at the
    test-backlog close.`
- **D-02:** Not `fixed`: no code change resolved these entries, and `fixed`
  carries no reason, so a future reader could not tell retirement-by-deletion
  from repair. Not triaged individually: the 21 entries name 18 distinct paths,
  14 are absent, and the four present ones no longer hold what the entries
  describe: `bridges/hooks/stage.ts` and `edge/handlers/tools.ts` are named
  only as sites the deleted analyzer under-credited, `.gitignore` has no
  `vendor/coverage` line (entry 42), and `package.json` has no
  `coverage:producer` or `lint:type-members` script (entries 43, 32). The
  SUMMARY records this evidence with the `ls` loop in 08-RESEARCH.md.

### This milestone's entries (84, 85, 88, 89)

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

### Advisory remediation (DEP-07-03-01)

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

### Validation records (audit tech debt folded in)

- **D-11:** `03-VALIDATION.md` frontmatter becomes `nyquist_compliant: true`;
  its checklist is fully ticked. `01-VALIDATION.md` stays `nyquist_compliant:
  false` because its one open box records a missed feedback-latency target
  (404 s against 180 s); its ticked line "`nyquist_compliant: true` set in
  frontmatter" (line 124) is unticked so the file agrees with itself. The audit
  then grades 01 PARTIAL and 03 compliant, which is the truth.
- **D-12:** The `stale` verification digests of phases 1-6 are left alone.
  Phase 07's E7 evidence re-ran the whole-tree gate on the final tree, and the
  milestone archive retires the flag; six verifier re-runs would add no
  information. Phase 07 will join them: its VERIFICATION `covered_files` lists
  `package-lock.json` and its own `deferred-items.md`, both of which this phase
  edits (D-07, D-09), so phase 07 reads `stale` after this phase. Accepted under
  the same reasoning; the SUMMARY records it so the `/gsd-progress` route to
  phase 07 is not mistaken for a regression.

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

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase inputs
- `.planning/phases/08-address-tech-debt-ledger-dispositions-and-advisory/08-RESEARCH.md` — measured verb behavior, pitfalls (unquoted reasons truncate, zsh globs `[json-output]`, half-finished batches refuse), the retry-safe batch skeleton, draft reasons, and the Validation Architecture
- `.planning/json-output-MILESTONE-AUDIT.md` — the `tech_debt` list this phase answers; frontmatter `tech_debt:` and the "Phase Verification" table
- `.planning/WINDOWS.md` — the ledger (JSON is the sole source of truth; mutate only through `gsd_run windows fixed|waive|status`, never by hand)
- `.planning/phases/07-mode-refusals-real-pi-verification-and-docs/deferred-items.md` — DEP-07-03-01 (advisory) and TEST-07-06-01 (the skip behind ledger 89)
- `.planning/phases/07-mode-refusals-real-pi-verification-and-docs/07-PEER-FLOOR-AUDIT.md` §"Transitive Dependency Advisory Disposition" — the fixture-preservation decision carried as D-10
- `.planning/phases/04-wire-schema-and-json-strategy/04-02-SUMMARY.md` — deviation 2, the origin of ledger 88
- `.planning/phases/01-presentation-model/01-VALIDATION.md` and `.planning/phases/03-typed-raw-surfaces/03-VALIDATION.md` — the two records D-11 edits
- `.planning/BACKLOG.md` §WSTOR-01, §WPIN-01 — carrier shape to copy for WOUT-01 and DEPADV-01

### Project rules that govern the work
- `AGENTS.md` §Git, §GSD records — commit policy, `SKIP=npm-check pre-commit run --files`, `[json-output]` prefix for ledger text, `## Threat Flags` in every SUMMARY
- `skills/local-verification/SKILL.md` — which check runs when; `npm run check` is the gate
- `skills/typescript-unit-testing/SKILL.md` and `skills/typescript-unit-testing-review/SKILL.md` — govern the two integration-test edits
- `.claude/gsd-core/workflows/ship.md` lines 132-155 — the broken-windows gate reads `ledger.open_count` and accepts `fixed` or `waived`

No external specs beyond these.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `gsd_run windows status|fixed <id>|waive <id> "<reason>"` — the only sanctioned ledger mutations; `status --raw` returns `ledger.entries[]` with `id`, `kind`, `phase`, `file`, `line`, `description`, `status`, `reason`
- `tests/platform/hermetic-environment.ts` — `enterHermeticEnvironment`/`createHermeticEnvironment` swap `HOME` and `PI_CODING_AGENT_DIR`; the resolver fix must run before this swap
- `resolvePiSubagentsPackageRoot()` exists in both resolver tests (`skill-path-resolution.test.ts:65`, `provenance-invisibility.test.ts:56`) with a `PI_SUBAGENTS_ROOT` override; keep the override
- Global peer on this machine: `/home/acolomba/.npm-global/lib/node_modules/pi-subagents` 0.47.1, `src/agents/skills.ts` present

### Established Patterns
- Waived entries carry a reason naming a cause or a BACKLOG carrier; fixed entries carry none (ledger entries 59-87)
- Ledger text is prefixed with the milestone, `[json-output]`
- Every SUMMARY.md ends with `## Threat Flags`
- `package-lock.json` staged -> the pre-commit hook runs every direct-coverage pair (`check:commit` escalation); `npm run check` on the combined tree is the phase gate
- No `.planning/` file is formatted by prettier or mdformat; BACKLOG.md and deferred-items.md edits need no formatter run

### Integration Points
- `package-lock.json` (root only; `node_modules/` here is a real directory, not a symlink, so a local `npm install --ignore-scripts` after the bump is safe but optional: no test depends on the installed `brace-expansion` version)
- `tests/integration/skill-path-resolution.test.ts`, `tests/integration/provenance-invisibility.test.ts` (non-corresponding roots: no direct-coverage pair)
- `.planning/BACKLOG.md` (two new sections), `.planning/WINDOWS.md` (via verbs), `.planning/phases/07-*/deferred-items.md`, `01-VALIDATION.md`, `03-VALIDATION.md`

</code_context>

<specifics>
## Specific Ideas

Evidence measured during discussion on 2026-10-10 (all in scratch copies, tree untouched):

- `npm audit --json`: 1 high, `brace-expansion` range `4.0.0 - 5.0.11`, `fixAvailable: true`, three GHSA advisories, fix range `>=5.0.12`; `npm view brace-expansion versions` ends at 5.0.12.
- `npm audit fix --package-lock-only` in a copy: 3-line lock diff at `node_modules/brace-expansion`; audit afterwards still 1 high (the nested copy).
- `overrides: {"brace-expansion": "^5.0.12"}` plus lock-only install, `npm dedupe --package-lock-only`, and a fresh lock from `package.json` alone: nested copy stays 5.0.9 in all three.
- `node_modules/@earendil-works/pi-coding-agent/npm-shrinkwrap.json` exists (lockfileVersion 3) and pins `brace-expansion 5.0.9`, `minimatch 10.2.6`; the 0.99.2 tarball's shrinkwrap pins the same; the 1.1.0 tarball has no shrinkwrap.
- `HOME=<other> npm root -g` returns `/home/linuxbrew/.linuxbrew/lib/node_modules` instead of `/home/acolomba/.npm-global/lib/node_modules`; `CI=1 node --test tests/integration/skill-path-resolution.test.ts` reports the one skip with "pi-subagents resolver module not reachable in this environment".
- `node --test tests/orchestrators/marketplace/update.test.ts` exits 0.
- `git show --stat d7213bc2`: 271 files changed, 18,932 insertions, 28,039 deletions, including every `scripts/check-unused-type-members.*` file and the `lint:type-members` script. `git log --all --diff-filter=A -- scripts/coverage-producer.convert.mjs scripts/coverage-validate.mjs` is empty: the coverage-producer files were removed by `0affe79e` on the test-backlog branch (not an ancestor of HEAD) before #202 (`feb04658`) squash-merged, so they never existed on `main`. `tests/architecture/pre-commit-hooks.ts` was deleted by #234 (`e6c274bf`). Today no `coverage:producer` or `lint:type-members` script is in `package.json`.

</specifics>

<deferred>
## Deferred Ideas

- **Pi 1.x devDependency bump** — clears the nested `brace-expansion` copy (no shrinkwrap in 1.1.0) but is a major upgrade across the peer floor and the pinned e2e ref; its own milestone. Carried by DEPADV-01.
- **CI `npm audit` gate** — a new gate, not requested; would fail today on the nested copy.
- **CI global `pi-subagents` install** — the TODO in `provenance-invisibility.test.ts` asks for it so both resolver cases run in CI; a pinned network install in the integration job. Not this phase.
- **Phase 04 deferred item: LLM plugin tool error text outside the redaction model** — a producer-side string, out of PMOD-04 scope by design; disposition belongs to the milestone close, not this phase.
- **Stale verification digests (phases 1-6)** — left for the archive per D-12.

</deferred>

---

*Phase: 08-address-tech-debt-ledger-dispositions-and-advisory*
*Context gathered: 2026-10-10*
