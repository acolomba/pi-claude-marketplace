# Phase 8: Direct Coverage - Context

**Gathered:** 2026-09-10
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 8 makes direct per-pair coverage an honest, enforced instrument again. It
regenerates one measured baseline for every current source-test pair (`RCOV-01`),
reclassifies every terminal shortfall so that the removable ones are removed and
the genuinely compiler-forced ones carry current recorded evidence rather than an
exclusion (`RCOV-02`), and wires the same strict changed-pair gate into scoped
local pre-commit and a dedicated authoritative CI job with fail-closed base and
pair selection (`RCOV-03`).

It also gives `cleanupStaging` a narrow production-owned removal port so the
staging leak-message and leaked-residue cases become observable through a real
collaborator instead of through builtin-module patching. That closes the accepted
override recorded as the open remainder of `06-VERIFICATION.md` G1 — the one
must-have that phase deferred here by name.

Coverage remains reachability evidence only. Nothing in this phase may treat a
complete reading as proof of assertion strength.

Out of scope: `FLOW-05` CRAP integration (a separate coverage-format and
metric-policy decision, listed in REQUIREMENTS.md "Out of Scope"); the
`GGAT-02`/`AGCOL-01` and `RCOV-04`/`COV-01` evidence-only records; the unused
type-member gate (`D-22`, no terminal evidence); assertion-strength work, which
belongs to `CLOSE-01`; and any coverage remediation for a module that is not a
measured current shortfall.

</domain>

<decisions>
## Implementation Decisions

Discussion mode: the operator directed "choose the recommended option, prefer
doing the right thing even if it is more effort." Every decision below is
therefore taken by the agent, biased toward the correct-but-larger option, and is
binding on planning.

### Measured Corrections to the Phase's Own Premises

Three of this phase's stated premises are stale against the live tree. All three
were reproduced during discussion, and correcting them is inside scope precisely
because `RCOV-01`'s contract is a baseline "without stale counts."

- **D-08-01:** The pair count is **230**, not 204. `productionPaths()` in
  `scripts/test-coverage-direct.mjs` returns 230 entries on the milestone branch;
  the Phase 6 split program added modules after the roadmap text was written. Every
  artifact naming 204 — `.planning/ROADMAP.md` §"Phase 8", `.planning/REQUIREMENTS.md`
  `RCOV-01` — is corrected to the measured count in this phase, together with the
  reproduction command. A count is a claim; this phase does not get to ship a stale
  one while requiring the baseline not to carry any.
- **D-08-02:** There are **eight** current shortfalls, not seven. The eighth is
  `extensions/pi-claude-marketplace/bridges/commands/discover.ts`, reading
  `branches 55/57, lines 412/414` with lines 289-290 uncovered. Reproduced with
  `node scripts/test-coverage-direct.mjs extensions/pi-claude-marketplace/bridges/commands/discover.ts`.
- **D-08-03:** The eighth shortfall is classified **compiler-forced, accepted**,
  not a regression to repair. Lines 289-290 are the
  `if (!(err instanceof CommandNameError)) { throw err; }` narrowing arm.
  `BC-019`'s ledger disposition already ruled it: "the arm is unreachable, but
  deleting the narrowing check without restructure still breaks typing — treat as
  compiler-forced narrowing, not removable production behavior." It went uncovered
  when `6527a944 test(06-02): remove bridge builtin mutation` deleted the
  `Symbol.hasInstance` surgery that was the only thing reaching it. It is the honest
  reading `TREF-08` left behind, and re-covering it would mean reinstating the exact
  patching `TREF-08` forbids. `RCOV-02`'s "seven" is amended to eight with this
  evidence recorded as a scope change under `RVAL-04`, in the coordinated
  `REQUIREMENTS.md` + `scripts/revalidation.mjs` form that requirement demands.
- **D-08-04:** The retained artifact `coverage/all-pairs.jsonl` holds **83 of 230**
  rows, dated 2026-09-07, ending at `edge/args-schema.ts` — the run stopped at the
  first shortfall, `edge/args.ts`. It is not a baseline and must not be read as one.
  The regenerated baseline supersedes it entirely.

### The Accepted-Shortfall Pin

- **D-08-05:** The accepted readings become a **committed, machine-readable pin**
  that the gate reads and compares against **exactly and bidirectionally**. This is
  `D-07-19`'s pinned-snapshot mechanism, already adopted in this milestone for the
  91-entry unowned-export census, applied to the same class of problem: a
  must-be-zero gate that cannot ship green, where an allow-list is forbidden.

  The distinction `D-07-19` drew holds here verbatim and must be restated in the
  pin's own header: **an allow-list forgives named entries silently and forever; a
  pinned set fails on an addition, on a removal, and on a swap.** A module that
  falls short and is absent from the pin fails. A pinned module whose reading
  changed — better or worse — fails. A pinned module that now reads complete fails
  as a stale pin. Every change to the tree's coverage surface must therefore be
  written down in the commit that causes it. That is enforcement, not exemption.
  — **Reversibility:** reversible — the pin is one committed data file plus the
  comparison layer that reads it.

- **D-08-06:** The pin is a **committed JSON data file**, not a TypeScript
  constant. `tests/architecture/gate-targets.ts` holds `UNOWNED_EXPORT_CENSUS` and
  is the natural sibling, but `D-07-07` scoped that registry to
  `tests/architecture/**` on the explicit ground that the `.mjs` gate scripts are
  plain JavaScript and cannot import a `.ts` registry. The direct-coverage gate is
  `scripts/test-coverage-direct.mjs`. A JSON file is the source of truth both can
  read, and it is exactly the "`.mjs` or JSON source of truth" Phase 7 named in its
  own deferred idea when it declined to solve this. The file is committed and lives
  outside `coverage/`, which is gitignored.

- **D-08-07:** Each pinned row carries four fields, not just a path: the
  `sourcePath`, the **exact reading string** the gate produces
  (`"branches 109/110"`), the **finding id** that authorizes it (`ER-F05`,
  `EHR-F16`, `BC-019`, …), and the **reason the arm is unreachable**. A pin whose
  rows carry no evidence is an allow-list wearing a pin's shape. The reading is
  compared as the gate's own formatted string so the pin cannot drift from the
  gate's vocabulary.

- **D-08-08:** The pin is **generated by measurement, not hand-authored**, and it
  is regenerated **after** the two loop rewrites and the removal port land, so the
  committed artifact reflects the final tree rather than an intermediate one. Order
  within the phase is therefore: rewrite and port first, full report last, pin
  committed from that run.

### Rewriting the Two Removable Guards

- **D-08-09:** Both dense-index guards are rewritten, behavior-preserving, and
  drop out of the pin entirely rather than being pinned. `ER-F05` established that
  `edge/args.ts`'s shortfall (`branches 28/29, lines 86/89`, lines 35-37 uncovered)
  yields to a `for...of` rewrite that removes the index guard with no non-null
  assertion; `ER-F19` established the same for `edge/handlers/shared.ts`
  (`branches 14/15, lines 83/85`), and `EHR-F16` routed that module's shortfall to
  this same decision rather than to an invented test. Both are typed iteration, not
  `!` or `as` — neither is available under this project's rules.

  This reopens the ratified `D-116-01a` disposition for these two modules only.
  `ER-F05` names that as the operator's choice and the operator has taken it: the
  accepted "compiler-forced" premise is false for these two iterable shapes, so the
  honest resolution is to remove the guards, not to keep pinning readings that a
  rewrite can make complete. The remaining six keep `D-116-01a` untouched.
  — **Reversibility:** reversible — each rewrite is one loop body with its owner
  test unchanged in contract.

- **D-08-10:** Expected end state: **230 pairs, 2 rewritten to complete, 6 pinned
  compiler-forced**. If measurement after the rewrites disagrees with that shape,
  the measurement wins and the divergence is recorded — this number is a
  prediction, not a target to make the instrument report.

### The `cleanupStaging` Removal Port

- **D-08-11:** The port is a **narrow, named, typed collaborator created by a
  production factory**, in the established `GitOps` / `CredentialOps` /
  `DeviceFlowHttp` house shape, threaded as an **explicit required parameter**
  from the public bridge and orchestrator entry points down to `cleanupStaging`
  and `rollbackReplacementCommon`. It is not a parameter bolted onto
  `cleanupStaging` alone. — **Reversibility:** costly — the parameter becomes part
  of the public shape of every bridge stage/commit/unstage entry point and both
  orchestrator call sites, so reverting means migrating roughly forty call sites
  and their owner tests back.

  **Why the reach is the point, not an accident.** `06-VERIFICATION.md` G1's open
  remainder is the *interleaved* leak-message ordering and the leaked-residue
  partition. Both are observable only when one specific `cleanupStaging` call fails
  while its siblings succeed, driven from **outside**, through the entry point the
  G1 tests actually call (`commitPreparedSkills`, `prepareStageSkills`, and their
  commands/agents twins). A port that stops at `cleanupStaging`'s own signature is
  unreachable from those tests and closes nothing. That is precisely the
  distinction G1's override analysis drew, and it is why this is a phase of its own
  rather than a gap fix.

- **D-08-12:** The parameter is **required, with no default**. `D-05-01` forbids a
  dead default, and a defaulted port also lets the obligation go quiet the moment a
  new call site forgets it. Composition roots supply the real operations. Every
  production caller migrates atomically in the same plan that introduces the port —
  `D-06-11` forbids a forwarding module, compatibility adapter, or old-path
  re-export as an intermediate state, and `D-06-12` says a migration too large for
  one atomic plan is replanned around a smaller genuine leaf contract, never
  bridged by a seam.

- **D-08-13:** The port's verb set is **`rm` and `rename` only** — the two
  operations the G1 leak paths traverse. `rollbackReplacementCommon` needs both:
  it removes each renamed replacement, restores each backup by rename, and then
  calls `cleanupStaging` twice, accumulating leak messages from all three stages.
  That accumulation *is* the residue partition G1 wants observable.

  `pathExists`, `removeOrphanIfPresent`, `readDirEntriesTolerant`, and
  `isPlainMarkdownFile` keep calling `fs.lstat` / `fs.stat` / `fs.readdir`
  directly. Widening the port to every filesystem verb in `fs-utils.ts` is not
  authorized by criterion 4 and has no terminal finding behind it.

- **D-08-14:** Residual builtin-module patching is closed **only where the port
  reaches**. The census pins two files. In `tests/shared/fs-utils.test.ts` the
  `t.mock.method(fs, "rm")` and `t.mock.method(fs, "rename")` sites convert to the
  port and the patching goes; the `lstat` / `stat` / `readdir` sites in the same
  file stay, because `D-08-13` leaves those verbs unported. In
  `tests/orchestrators/marketplace/add.test.ts` the patches are on
  `path.dirname` / `path.basename` / `path.join`, which the removal port does not
  touch at all; that file is untouched by this phase. Record the residual census
  honestly with its new membership rather than claiming the class is closed.

### Gate Wiring

- **D-08-15:** The CI job checks out with **`fetch-depth: 0`**. `actions/checkout`
  defaults to a depth-1 clone in which `origin/main` does not exist, so
  `D-07-13`'s ordered chain would silently fall through to `HEAD~1` and diff one
  commit while reporting a resolved base. Fail-closed base selection is worth
  nothing if the base it closes on is the wrong one. `fetch-depth: 0` is already
  the house answer — the `fallow-audit` job in `.github/workflows/lint.yml` uses
  it for the same reason. The job asserts the selected base it printed, so a
  regression to `HEAD~1` fails visibly rather than passing quietly.

- **D-08-16:** CI gets a **dedicated job**, not a step folded into `check`.
  `RCOV-03` says "a dedicated authoritative CI job" and the separation earns its
  keep: the sweep spawns one focused test run per changed pair, so it wants its own
  timeout and its own legible red signal rather than sitting behind a typecheck
  failure in a fifteen-minute composite.

- **D-08-17:** The pre-commit hook is a **scoped local hook** in the shape of the
  four existing `npm-*` hooks — `language: system`, `pass_filenames: false`, and a
  `files:` pattern over the production root, the corresponding test root, and
  `scripts/revalidation.mjs` (the one special pair). It invokes the same
  `npm run test:coverage:direct` the CI job runs; `RCOV-03` says "the same strict
  changed-pair gate," and two implementations of one gate is how gates drift apart.

  Record its cost plainly in `CONTRIBUTING.md` rather than hiding it: a commit
  touching ten pairs spawns ten focused test runs. `SKIP=<hook-id>` is the
  pre-commit-native escape for a developer who needs one; `--no-verify` remains
  forbidden.

- **D-08-18:** The gate's pin comparison is proved by **planting, not by
  configuration reading**, extending `scripts/test-coverage-direct.negative.mjs` —
  which already plants refusals against this exact gate through an injected
  `mkdtemp` root and already runs inside `npm run check` (`D-07-15`). Four cases,
  one per divergence class plus the control: an unpinned shortfall, a pinned module
  reading differently, a pinned module that now reads complete, and an unmutated
  tree that passes. This is what puts the pin machinery under `npm run check` even
  though the slow sweep itself stays out of it.

### Instrument Separation

- **D-08-19:** Three instruments, three jobs, and the boundary between them stays
  where it is. `test-coverage-direct.report.mjs` **measures** every pair and files
  no verdict — its header states outright that it does not read the ledger and its
  exit code is not a coverage verdict. It is what generates the pin. The committed
  pin **records**. The `test-coverage-direct.mjs` gate arms **enforce** by
  comparing measurement against the pin.

  `assertCompleteCoverage` stays pure — it answers "is this reading complete?" and
  nothing else. The pin comparison is a separate layer the gate arms call. Teaching
  `assertCompleteCoverage` about the pin would leak the ledger into the reporter
  through its shared `runPair` import and destroy the independence the reporter's
  header promises.

### Scope Boundary Taken Deliberately

- **D-08-20:** The `fix-unicode-dashes` pre-commit blocker is **fixed in this
  phase**, by widening the existing exclusion to cover
  `tests/architecture/revalidation.test.ts` alongside `scripts/revalidation.mjs`.

  Two reasons it cannot wait for `CLOSE-01`. First, `pre-commit run --all-files` is
  what CI's Lint job runs verbatim, and it is red today: this phase's own
  deliverable is a new pre-commit hook, and a new hook cannot be verified inside a
  run that is already failing. Second, this phase edits `.pre-commit-config.yaml`
  anyway.

  Widening beats the alternative — dropping the em-dash from both sides — because
  the test pins the exact bytes `scripts/revalidation.mjs` emits, and those bytes
  are the `.planning/` house convention the hook already excludes wholesale.
  Changing them means changing the script's output and every planning record its
  `RVAL-04` scan parses. One convention, one exclusion, matching reasons.

  `CLOSE-01` keeps its identity and records the early closure with evidence — the
  same treatment `D-07-19` gave `ORA-F32`'s instance.

### Carried-Forward Constraints

- `MF-DEC-07` and `D-05-01` through `D-05-03` remain binding: no test-only export,
  dead default, `__deps` bag, or ignore pragma. Case-owned real temporary
  filesystems by default; a narrow production-owned port only where authorized —
  which criterion 4 authorizes here, and nowhere wider.
- `D-06-11` through `D-06-14` remain binding on the port migration: no forwarding
  seam, no compatibility tail, and every moved responsibility mapped to a named
  owner before the old form goes.
- `D-07-13` and `D-07-14` are already implemented and are inputs, not work:
  deterministic ordered base selection that prints its choice, and a zero-selection
  outcome that distinguishes "resolved and held nothing pairable" from "resolution
  failed." `D-07-16` explicitly assigned the wiring of that already-correct gate to
  this phase.
- Both complexity ceilings apply independently to every new helper: ESLint's
  `sonarjs/cognitive-complexity: 15` and Fallow's `health.maxCognitive: 15` /
  `maxCyclomatic: 20` / `maxUnitSize: 60`. Passing one does not predict the other.
- `duplicates.threshold: 3` applies to the four negative-control cases. Shared
  fixture setup is extracted, not copied.
- Coverage is reachability evidence only. `RCOV-03` says so and `CLOSE-01` owns
  assertion strength; no artifact this phase writes may blur the two.

### Claude's Discretion

- Exact filename and location of the pin, provided it is committed, sits outside
  gitignored `coverage/`, and is readable by `scripts/test-coverage-direct.mjs`
  without importing a `.ts` module.
- Exact name and member names of the removal collaborator interface and its
  factory, provided the factory name follows the production-role convention
  (`create*`) and the reusable test double follows `create*Fake`.
- Whether the pin comparison lives in `test-coverage-direct.mjs` or a sibling
  module it imports, provided `assertCompleteCoverage` stays pure per `D-08-19`.
- Plan granularity and wave membership, provided the port migration is atomic per
  `D-08-12`, and provided the full report run that generates the pin is serialized
  after the rewrites and the port per `D-08-08`.
- Whether the two loop rewrites are one plan or two.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Scope and Evidence Authority

- `.planning/ROADMAP.md` §"Phase 8: Direct Coverage" — goal, boundary, and the four
  success criteria, including criterion 4's `cleanupStaging` port obligation and its
  full rationale. Its "204 pairs" and "seven shortfalls" are corrected by `D-08-01`
  and `D-08-02`.
- `.planning/REQUIREMENTS.md` §"Direct Coverage" — the active `RCOV-01`, `RCOV-02`,
  and `RCOV-03` contracts, and the `RCOV-04`/`COV-01` evidence-only record.
- `.planning/phases/01-live-evidence-revalidation/01-REVALIDATION.json` — the
  terminal finding routes. Authority over historical review prose. The findings this
  phase acts on are `AUDIT-011` (the seven measured shortfalls and the two loop
  rewrites), `ER-F05` and `ER-F19` (the two rewritable dense-index guards),
  `EHR-F16` (`edge/handlers/shared.ts` routed to the same decision), `BC-019` (the
  eighth shortfall's compiler-forced disposition), and `TXA-F022` (the gating
  omission). Note that the ledger's `route` strings use an earlier phase numbering
  and are not the current roadmap's phase numbers — read the finding, not the route.
- `.planning/phases/01-live-evidence-revalidation/01-REVALIDATION-SCHEMA.md` —
  interpretation rules for the live evidence ledger.

### The Deferred Obligation This Phase Closes

- `.planning/phases/06-assertion-and-module-refinement/06-VERIFICATION.md`
  §"G1 — why the remainder is an override, not a gap" — the exact statement of what
  is unobservable, why re-patching `node:fs/promises` is forbidden, and why the
  roughly forty call sites make this a phase rather than a gap fix. Read this before
  designing the port; it is the acceptance criterion.

### Prior Phase Contracts

- `.planning/phases/07-gate-integrity/07-CONTEXT.md` — `D-07-13` through `D-07-16`
  (base selection, zero-selection, the negative-harness owner, and the explicit
  handoff of the wiring to this phase), `D-07-19` (the pinned-snapshot-is-not-an-
  allow-list argument this phase reuses), and `D-07-07` (why a `.ts` registry cannot
  serve an `.mjs` gate).
- `.planning/phases/06-assertion-and-module-refinement/06-CONTEXT.md` — `D-06-11`
  through `D-06-14`, the no-forwarding-seam and atomic-migration rules that govern
  the port rollout.
- `.planning/phases/05-injection-and-ownership-design/05-CONTEXT.md` — legitimate
  production ports, ownership boundaries, and the no-dead-default rule.

### Codebase Guidance

- `.planning/codebase/CONVENTIONS.md` §"Dependency injection over test-only seams"
  — the rule the removal port implements, and §"Fallow" for the two independent
  complexity ceilings and the plant-the-violation gate rule.
- `.planning/codebase/TESTING.md` — direct source-test pairing and owner-test
  conventions. Dated 2026-08-18 and stale in one respect: it describes a
  `tests/helpers/` tree that no longer exists. Validate paths against the live tree.
- `CONTRIBUTING.md` §"Coverage sweeps (manual)" and §"The whole-tree report" — the
  current seven-row table, the "the gate is deliberately not taught this list"
  paragraph, and the "neither script has a CI job" rationale. All three are
  superseded by `D-08-05`, `D-08-15`, and `D-08-16` and must be rewritten in this
  phase, not left contradicting the code.

### Live Reproduction Commands

- `node scripts/test-coverage-direct.mjs <source path>` — one pair, refuses on
  shortfall.
- `npm run test:coverage:direct:report` — every pair, records rather than enforces.
  This is the baseline generator.
- `node -e 'import("./scripts/test-coverage-direct.mjs").then(m => console.log(m.productionPaths().length))'`
  — the live pair count.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- `tests/architecture/unowned-exports-census.test.ts` — the worked example of the
  pinned-census pattern `D-08-05` reuses, including the header that states what a
  pin is and is not, the bidirectional deep comparison, and the benign control that
  asks the same question a second way. Read it before writing the coverage pin.
- `tests/architecture/gate-targets.ts` — holds `UNOWNED_EXPORT_CENSUS`. The
  structural sibling of the new pin, and the reason `D-08-06` chose JSON: this file
  is `.ts` and the direct-coverage gate is `.mjs`.
- `scripts/test-coverage-direct.negative.mjs` — already plants refusals against this
  exact gate through an injected `mkdtemp` root, already exports the harness shape,
  and already runs inside `npm run check` via `test:coverage:direct:negative`. The
  established owner for `D-08-18`'s four cases.
- `scripts/test-coverage-direct.mjs` — `selectBase` and `changedPaths` already
  implement `D-07-13`/`D-07-14` completely, carrying `attempted` on both outcomes and
  discriminating a failed git invocation from an empty change set. `pairForPath`,
  `assertCompleteCoverage`, and `assertReportComplete` all already take a
  `selectedProjectRoot` parameter, so the negative harness can point them at a
  fixture tree.
- `tests/platform/git-ops-fake.ts` — the reusable concern-owned fake for an injected
  `*Ops` collaborator, and the naming precedent (`createGitOpsFake`) the removal
  port's double should follow.
- `extensions/pi-claude-marketplace/shared/fs-utils.ts` —
  `rollbackReplacementCommon` already accumulates leak messages from three stages
  into one frozen array. That accumulation is the residue partition G1 wants
  observable; the port makes each stage independently faultable.

### Established Patterns

- A gate wants a test that plants the violation, not one that reads the config.
  `.planning/codebase/CONVENTIONS.md` records this after `import-x/no-cycle` sat
  configured-but-inert while a config-reading test stayed green.
- Pinned sets fail in both directions and name the file to update in their failure
  message, so the fix is discoverable from the red run alone.
- Injected collaborators are explicit parameters and part of the public interface,
  never module-global seams reached from a test.
- `npm run check` chains typecheck, lint, fallow, format, the two correspondence
  gates, the direct-coverage negative gate, unit tests, and integration tests.
  Fallow is a mandatory member of the chain.

### Integration Points

- `extensions/pi-claude-marketplace/bridges/{skills,commands,agents}/stage.ts` —
  the three bridges holding most `cleanupStaging` call sites, across
  `prepareStage*`, `commitPrepared*`, `unstage*`, and each bridge's replacement
  rollback. These are the public entry points the G1 tests drive.
- `extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts` and
  `orchestrators/plugin/clone-cache.ts` — the two orchestrator call sites, covering
  marketplace clone staging, final clone cleanup, plugin clone staging, mirror
  staging, and mirror seed staging.
- `extensions/pi-claude-marketplace/edge/args.ts` and
  `edge/handlers/shared.ts` — the two dense-index loops `D-08-09` rewrites.
  `args.ts`'s uncovered region is lines 35-37.
- `extensions/pi-claude-marketplace/bridges/commands/discover.ts:287-290` — the
  eighth shortfall's `CommandNameError` narrowing arm.
- `.pre-commit-config.yaml` — the four `npm-*` local hooks are the shape
  `D-08-17` copies, and the `fix-unicode-dashes` exclusion at the texthooks block
  is what `D-08-20` widens.
- `.github/workflows/ci.yml` — four jobs today (`check`, `integration-tests`,
  `e2e-tests`, `package`), all on `actions/checkout@v7` at default depth.
  `.github/workflows/lint.yml`'s `fallow-audit` job is the in-repo precedent for
  `fetch-depth: 0`.
- `scripts/revalidation.mjs` — carries requirement status alongside
  `.planning/REQUIREMENTS.md` and must be updated in the same change under
  `RVAL-04`. It is also the file whose em-dash output `D-08-20` protects.

</code_context>

<specifics>
## Specific Ideas

- The failure mode this phase exists to prevent is a coverage instrument that
  reports success having measured a stale or partial tree. The retained
  `coverage/all-pairs.jsonl` is that failure mode already realised: 83 of 230 rows,
  three days stale, ending mid-alphabet at the first refusal, and readable at a
  glance as a completed run. Regenerating it is not bookkeeping.
- Distinguish measuring, recording, and enforcing, and keep them in three separate
  instruments. The moment the reporter learns what is acceptable, it stops being
  able to tell anyone what is actually there.
- A pin earns its place only if it can fail in both directions. Prove that by
  planting each direction, not by describing it in a comment.
- Prefer removing an unreachable guard over pinning its reading, wherever a
  behavior-preserving rewrite exists. Two of the eight yield to typed iteration; the
  correct outcome is six pinned rows, not eight.

</specifics>

<deferred>
## Deferred Ideas

- **`FLOW-05` CRAP integration** — needs a coverage-format conversion and a
  metric-policy decision. Named in `REQUIREMENTS.md` "Out of Scope"; unchanged here.
- **A shared target registry for the `.mjs` gate scripts** — Phase 7 deferred
  enrolling `scripts/check-corresponding-tests.mjs` and
  `scripts/test-coverage-direct.mjs` in one registry for want of a source of truth
  both could import (`D-07-07`). `D-08-06` creates a JSON pin that establishes the
  precedent, but this phase does not migrate the two scripts' path handling into a
  shared registry — that remains its own work.
- **`path` builtin patching in `tests/orchestrators/marketplace/add.test.ts`** —
  outside the removal port's verb set per `D-08-13` and carrying no terminal
  finding of its own. It stays in the residual census.
- **The remaining `fs.lstat` / `fs.stat` / `fs.readdir` patches in
  `tests/shared/fs-utils.test.ts`** — same reason. Criterion 4 authorizes a removal
  port, not a filesystem facade.
- **Assertion strength for the newly covered leak paths** — `RCOV-03` fixes
  coverage as reachability evidence only. Whether the restored G1 assertions are
  strong enough belongs to `CLOSE-01` in Phase 9.
- **The unused type-member gate** (`.planning/todos/pending/2026-09-02-detect-unused-code-and-type-members.md`)
  — no phase-8 match returned by `todo.match-phase`, and `D-22` still forbids a new
  gate without independent revalidation. Named again in `CLOSE-02`.

</deferred>

---

*Phase: 8-Direct Coverage*
*Context gathered: 2026-09-10*
